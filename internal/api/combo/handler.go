// Package combo はコンボ CRUD の HTTP ハンドラを提供する。
//
// 設計参照: M1-03 指示書 §4.1(エンドポイント一覧)、§4.7(DTO)、§4.8(エラー形式)。
package combo

import (
	"errors"
	"log/slog"
	"net/http"
	"strconv"
	"strings"

	"github.com/labstack/echo/v4"

	mw "github.com/plexiblinp/tacpendium/internal/api/middleware"
	"github.com/plexiblinp/tacpendium/internal/model"
	combosvc "github.com/plexiblinp/tacpendium/internal/service/combo"
	"github.com/plexiblinp/tacpendium/internal/service/notation"
	setupsvc "github.com/plexiblinp/tacpendium/internal/service/setup"
)

// Handler はコンボ API のハンドラ集合。
type Handler struct {
	service     combosvc.Service
	notationSvc notation.Service
	setupSvc    setupsvc.Service
}

// NewHandler は Handler を構築する。notationSvc は GET /api/combos/:id/recipe で
// プリセット解決後のレシピ文字列を返すために利用する(M1-04 §4.5.3、M1-05 で実装)。
// 他のハンドラからは参照されないため、recipe エンドポイントを使わないテストでは nil 可。
// setupSvc は GET /api/combos/:id のレスポンスに setups を埋め込む(M4-02 案 B1)。nil 可(テスト用)。
func NewHandler(service combosvc.Service, notationSvc notation.Service, setupSvc setupsvc.Service) *Handler {
	return &Handler{service: service, notationSvc: notationSvc, setupSvc: setupSvc}
}

// ===========================================================================
// POST /api/combos
// ===========================================================================

func (h *Handler) Create(c echo.Context) error {
	var req CreateRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, model.NewAPIError("invalid_request", "リクエスト形式が不正です: "+err.Error()))
	}

	combo, result, err := h.service.Create(c.Request().Context(), toServiceCreateInput(req, mw.UserIDFrom(c)))
	if err != nil {
		if errors.Is(err, combosvc.ErrInvalidTagID) {
			return c.JSON(http.StatusBadRequest, model.NewAPIError("invalid_tag_id", "存在しないタグ ID が tagIds に含まれています"))
		}
		// M19-07: setups[].verifiedConditions の値域外(§4-6)。
		// コード・文言は api/setup の setupResultError と同一にする(第 3 の語彙を作らない)。
		if errors.Is(err, setupsvc.ErrInvalidResultValue) {
			return c.JSON(http.StatusBadRequest,
				model.NewAPIError("invalid_setup_result", "受け身種別または検証結果の値が不正です"))
		}
		// M24-11: write lock を取れなかった。入力の誤り(400)でも版の衝突(409)でもない。
		if errors.Is(err, combosvc.ErrDatabaseBusy) {
			return c.JSON(http.StatusServiceUnavailable,
				model.NewAPIError(model.ErrorCodeDatabaseBusy,
					"データベースが混み合っています。少し時間をおいて再度お試しください"))
		}
		slog.ErrorContext(c.Request().Context(), "create combo", slog.String("err", err.Error()))
		return c.JSON(http.StatusInternalServerError, model.NewAPIError("internal_error", "コンボ作成中にサーバーエラーが発生しました"))
	}
	if result.HasError() {
		return c.JSON(http.StatusBadRequest, model.NewValidationFailedError(result))
	}

	resp := toComboResponse(combo, &result)

	// M4-04: セットプレイ同時登録時、レスポンスに setups を含める
	if h.setupSvc != nil && len(req.Setups) > 0 {
		svcSetups, sErr := h.setupSvc.ListSetupsByComboID(c.Request().Context(), combo.ID)
		if sErr != nil {
			slog.WarnContext(c.Request().Context(), "create combo: load setups failed", slog.String("err", sErr.Error()))
		} else {
			summaries := make([]SetupSummary, len(svcSetups))
			for i, sv := range svcSetups {
				summaries[i] = SetupSummary{
					ID:             sv.Setup.ID,
					CharacterID:    sv.Setup.CharacterID,
					Name:           sv.Setup.Name,
					Description:    sv.Setup.Description,
					StepCount:      sv.Setup.StepCount,
					Version:        sv.Setup.Version,
					DefaultRecipe:  sv.DefaultRecipe,
					ParentComboIds: sv.ParentComboIDs,
				}
			}
			resp.Setups = summaries
		}
	}
	if resp.Setups == nil {
		resp.Setups = []SetupSummary{}
	}

	// M23-05: VAL-C14(ゴミ箱に同じものがある)。★本経路だけで走らせる(M23-05 §4.5-1)——
	// PUT は旧行を論理削除して新行を積むため、走らせると編集のたびに自分の旧行に当たる。
	// ★警告であって登録は既に成功している。ここで 4xx へ倒さないこと(§4.1-1)。
	// ★0 件のときはキーごと出さない(M23-04 §4.3-2)。空配列を代入しないこと。
	if trashWarnings := h.service.CheckTrashDuplicate(c.Request().Context(), combo.ID); len(trashWarnings.Issues) > 0 {
		resp.Warnings = trashWarnings.Issues
	}

	return c.JSON(http.StatusCreated, resp)
}

// ===========================================================================
// GET /api/combos/:id
// ===========================================================================

func (h *Handler) Get(c echo.Context) error {
	id, err := parseIDParam(c, "id")
	if err != nil {
		return c.JSON(http.StatusBadRequest, model.NewAPIError("invalid_id", err.Error()))
	}

	combo, err := h.service.Get(c.Request().Context(), id, mw.UserIDFrom(c))
	if err != nil {
		if errors.Is(err, combosvc.ErrNotFound) {
			return c.JSON(http.StatusNotFound, model.NewAPIError("not_found", "コンボが見つかりません"))
		}
		slog.ErrorContext(c.Request().Context(), "get combo", slog.String("err", err.Error()))
		return c.JSON(http.StatusInternalServerError, model.NewAPIError("internal_error", "サーバーエラーが発生しました"))
	}

	resp := toComboResponse(combo, nil)

	// M4-02 案 B1: setup 一覧を埋め込む
	if h.setupSvc != nil {
		svcSetups, sErr := h.setupSvc.ListSetupsByComboID(c.Request().Context(), id)
		if sErr != nil {
			slog.WarnContext(c.Request().Context(), "get combo: load setups failed", slog.String("err", sErr.Error()))
		} else {
			summaries := make([]SetupSummary, len(svcSetups))
			for i, sv := range svcSetups {
				summaries[i] = SetupSummary{
					ID:             sv.Setup.ID,
					CharacterID:    sv.Setup.CharacterID,
					Name:           sv.Setup.Name,
					Description:    sv.Setup.Description,
					StepCount:      sv.Setup.StepCount,
					Version:        sv.Setup.Version,
					DefaultRecipe:  sv.DefaultRecipe,
					ParentComboIds: sv.ParentComboIDs,
				}
			}
			// M19-03 §4.3.1 (a): 成立条件をコンボ詳細に同梱する。1 コンボ分を
			// 1 クエリでまとめて取り、setup_id で振り分ける(セットプレイごとに
			// 引くと N+1 になる)。取得失敗は表示欠落に留め、詳細自体は返す。
			attachSetupResults(c, h.setupSvc, id, summaries)
			resp.Setups = summaries
		}
	}

	return c.JSON(http.StatusOK, resp)
}

// GetDeleted は GET /api/combos/:id/deleted。ゴミ箱の行から開く読み取り専用詳細を返す
// (M23-07 §4.2-2。DES-005 §5.15「行クリック → 詳細表示(読み取り専用のコンボ詳細)」)。
//
// ★Get とは別の経路である。Get にフラグを足していない——足すと通常の詳細表示で
// 削除済みが返る事故の余地が残る(M23-06 の教訓＝求めている集合が違えば入口も別に要る)。
//
// ★応答型は ComboResponse を流用する(新しい DTO を作らない)。deletedAt は既に
// 同型が持っている(dto.go の「ゴミ箱 API 用」フィールド)。
//
// ★setups は載せない。読み取り専用詳細は復元・完全削除の判断材料であり、
// セットプレイは親コンボ経由でしか画面に出ない以上、単独の詳細という概念が無い
// (M23-07 §4.2-5)。紐付きの操作導線は読み取り専用詳細に出さない(同 §4.2-3)。
func (h *Handler) GetDeleted(c echo.Context) error {
	id, err := parseIDParam(c, "id")
	if err != nil {
		return c.JSON(http.StatusBadRequest, model.NewAPIError("invalid_id", err.Error()))
	}

	combo, err := h.service.GetDeleted(c.Request().Context(), id, mw.UserIDFrom(c))
	if err != nil {
		if errors.Is(err, combosvc.ErrNotFound) {
			return c.JSON(http.StatusNotFound, model.NewAPIError("not_found", "コンボが見つかりません"))
		}
		slog.ErrorContext(c.Request().Context(), "get deleted combo", slog.String("err", err.Error()))
		return c.JSON(http.StatusInternalServerError, model.NewAPIError("internal_error", "サーバーエラーが発生しました"))
	}

	return c.JSON(http.StatusOK, toComboResponse(combo, nil))
}

// attachSetupResults は 1 コンボ分の成立条件を取得し、setup_id で summaries へ振り分ける。
// 結果が 0 行のセットプレイは Results が nil のままで、JSON でもキーが出ない
// (= 全 4 セル未検証。フロントは hidden-when-empty で要素自体を出さない)。
func attachSetupResults(c echo.Context, svc setupsvc.Service, comboID int64, summaries []SetupSummary) {
	if len(summaries) == 0 {
		return
	}
	results, err := svc.ListResultsByComboID(c.Request().Context(), comboID)
	if err != nil {
		slog.WarnContext(c.Request().Context(), "get combo: load setup results failed", slog.String("err", err.Error()))
		return
	}
	if len(results) == 0 {
		return
	}
	bySetupID := make(map[int64][]model.ComboSetupResult, len(summaries))
	for _, r := range results {
		bySetupID[r.SetupID] = append(bySetupID[r.SetupID], r)
	}
	for i := range summaries {
		summaries[i].Results = bySetupID[summaries[i].ID]
	}
}

// ===========================================================================
// GET /api/combos
// ===========================================================================

func (h *Handler) List(c echo.Context) error {
	filter := combosvc.ListFilter{}

	if v := c.QueryParam("character_id"); v != "" {
		id, err := strconv.ParseInt(v, 10, 64)
		if err != nil {
			return c.JSON(http.StatusBadRequest, model.NewAPIError("invalid_query", "character_id は整数"))
		}
		filter.CharacterID = &id
	}
	if v := c.QueryParam("is_draft"); v != "" {
		b, err := strconv.ParseBool(v)
		if err != nil {
			return c.JSON(http.StatusBadRequest, model.NewAPIError("invalid_query", "is_draft は真偽値である必要があります"))
		}
		filter.IsDraft = &b
	}
	if v := c.QueryParam("tag_ids"); v != "" {
		parts := strings.Split(v, ",")
		tagIDs := make([]int64, 0, len(parts))
		for _, p := range parts {
			id, err := strconv.ParseInt(strings.TrimSpace(p), 10, 64)
			if err != nil {
				return c.JSON(http.StatusBadRequest, model.NewAPIError("invalid_query_param", "tag_ids の値が不正です"))
			}
			tagIDs = append(tagIDs, id)
		}
		filter.TagIDs = tagIDs
	}
	// ★★M27-03(P4M-022): 始動技による絞り込み。
	//
	// 開発者の逐語＝「コンボ一覧のフィルターで、始動技も指定したい。」
	//
	// ★リポジトリ層は着手前から StarterMoveIDs と `starter_move_id IN (…)` を持っており
	//   (repository.go)、確定反撃サーチだけが呼んでいた。⇒ 本経路に足りていなかったのは
	//   クエリパラメータの受け口だけである。SQL は 1 バイトも変えていない。
	// ★画面の絞り込みは 1 件だが、フィルタ側は複数値を表現できる。将来 tag_ids と同じ
	//   カンマ区切りへ広げるときは、ここだけを直せばよい形にしてある。
	if v := c.QueryParam("starter_move_id"); v != "" {
		// ★★エラーコードは既存の 2 系統へ合わせる(`DES-002` §4.2 の `GET /api/combos` 行)。
		//   パース失敗＝`invalid_query`(先例＝`character_id` / `is_draft` / `setup_in_corner`)
		//   ／ 値不正＝`invalid_query_param`(先例＝`setup_result` / `setup_tech_type`)。
		//   ★2 系統に割れていること自体は followup `combos-query-error-code-split` の射程で
		//     あり、本サブでは統一しない——**新しい 3 つ目の判断を持ち込まないことだけを守る**。
		id, err := strconv.ParseInt(v, 10, 64)
		if err != nil {
			return c.JSON(http.StatusBadRequest, model.NewAPIError("invalid_query", "starter_move_id は整数"))
		}
		// ★0 と負値は弾く。id は正の整数であり、0 を通すと「指定したのに全件」になる。
		//   ★`character_id` / `tag_ids` は弾いていないが、それに揃えて緩めることはしない
		//     (緩い側へ揃える理由が無い)。
		if id <= 0 {
			return c.JSON(http.StatusBadRequest, model.NewAPIError("invalid_query_param", "starter_move_id の値が不正です"))
		}
		filter.StarterMoveIDs = []int64{id}
	}
	if v := c.QueryParam("position"); v != "" {
		filter.Position = &v
	}
	if v := c.QueryParam("hit_type"); v != "" {
		filter.HitType = &v
	}
	if v := c.QueryParam("opponent_stance"); v != "" {
		filter.OpponentStance = &v
	}
	// 始動技の持続当てによる絞り込み(M37-07・開発者裁定 2026-09-14)。
	// ★既存の真偽値の絞り込みと同じ形にする(新しい流儀を作らない)。
	// ★値域外は 400 に落とす —— 「絞り込まない」に倒すと typo が全件返却に見える
	//   (affected_by_game_update / setup_in_corner と同じ扱い)。
	if v := c.QueryParam("starter_meaty"); v != "" {
		b, err := strconv.ParseBool(v)
		if err != nil {
			return c.JSON(http.StatusBadRequest, model.NewAPIError("invalid_query_param", "starter_meaty の値が不正です"))
		}
		filter.StarterMeaty = &b
	}
	// FR702「影響可能性あり」による絞り込み(M28-02a §2.6-2)。
	// ★既存の絞り込みと同じ形にする(新しい流儀を作らない)。
	// ★値域外は 400 に落とす —— 「絞り込まない」に倒すと typo が全件返却に見える
	//   (setup_in_corner と同じ扱い)。
	if v := c.QueryParam("affected_by_game_update"); v != "" {
		b, err := strconv.ParseBool(v)
		if err != nil {
			return c.JSON(http.StatusBadRequest, model.NewAPIError("invalid_query_param", "affected_by_game_update の値が不正です"))
		}
		filter.AffectedByGameUpdate = &b
	}
	// セットプレイ成立条件による絞り込み(M19-06)。3 項目は独立だが、
	// setup_result が無いときは軸(setup_tech_type / setup_in_corner)も効かない
	// (リポジトリ層 setupResultWhere のコメント参照)。ここでは値域だけを見る。
	if v := c.QueryParam("setup_result"); v != "" {
		if !model.IsValidSetupResultFilterValue(v) {
			return c.JSON(http.StatusBadRequest, model.NewAPIError("invalid_query_param", "setup_result の値が不正です"))
		}
		filter.SetupResult = &v
	}
	if v := c.QueryParam("setup_tech_type"); v != "" {
		if !model.IsValidOkiTechType(v) {
			return c.JSON(http.StatusBadRequest, model.NewAPIError("invalid_query_param", "setup_tech_type の値が不正です"))
		}
		filter.SetupTechType = &v
	}
	if v := c.QueryParam("setup_in_corner"); v != "" {
		b, err := strconv.ParseBool(v)
		if err != nil {
			return c.JSON(http.StatusBadRequest, model.NewAPIError("invalid_query", "setup_in_corner は真偽値である必要があります"))
		}
		filter.SetupInCorner = &b
	}
	if c.QueryParam("only_deleted") == "true" {
		filter.OnlyDeleted = true
	} else if c.QueryParam("include_deleted") == "true" {
		filter.IncludeDeleted = true
	}
	filter.Sort = c.QueryParam("sort")
	filter.Order = c.QueryParam("order")
	if v := c.QueryParam("limit"); v != "" {
		if n, err := strconv.Atoi(v); err == nil {
			filter.Limit = n
		}
	}
	if v := c.QueryParam("offset"); v != "" {
		if n, err := strconv.Atoi(v); err == nil {
			filter.Offset = n
		}
	}

	filter.UserID = mw.UserIDFrom(c)
	combos, err := h.service.List(c.Request().Context(), filter)
	if err != nil {
		slog.ErrorContext(c.Request().Context(), "list combos", slog.String("err", err.Error()))
		return c.JSON(http.StatusInternalServerError, model.NewAPIError("internal_error", "サーバーエラーが発生しました"))
	}

	// セットプレイ情報をバッチ取得（N+1 回避）
	var setupsByComboID map[int64][]*setupsvc.SetupResponse
	if h.setupSvc != nil && len(combos) > 0 {
		comboIDs := make([]int64, len(combos))
		for i, c := range combos {
			comboIDs[i] = c.ID
		}
		sMap, sErr := h.setupSvc.ListSetupsByComboIDs(c.Request().Context(), comboIDs)
		if sErr != nil {
			slog.WarnContext(c.Request().Context(), "list combos: load setups failed", slog.String("err", sErr.Error()))
		} else {
			setupsByComboID = sMap
		}
	}

	items := make([]ComboResponse, len(combos))
	for i, combo := range combos {
		items[i] = toComboResponse(combo, nil)
		svcSetups := setupsByComboID[combo.ID]
		if svcSetups != nil {
			summaries := make([]SetupSummary, len(svcSetups))
			for j, sv := range svcSetups {
				summaries[j] = SetupSummary{
					ID:             sv.Setup.ID,
					CharacterID:    sv.Setup.CharacterID,
					Name:           sv.Setup.Name,
					Description:    sv.Setup.Description,
					StepCount:      sv.Setup.StepCount,
					Version:        sv.Setup.Version,
					DefaultRecipe:  sv.DefaultRecipe,
					ParentComboIds: sv.ParentComboIDs,
				}
			}
			items[i].Setups = summaries
		}
		if items[i].Setups == nil {
			items[i].Setups = []SetupSummary{}
		}
	}
	// ★総数は LIMIT を掛けずに数え直す。⇒ Total > Count が「上限で切り捨てた」の
	//   観測になる(M29-02 §2.1)。数えられなかった場合も一覧は返す
	//   (数えられないことを理由に一覧そのものを落とすと、被害が広がる)。
	total := len(items)
	if n, cErr := h.service.Count(c.Request().Context(), filter); cErr != nil {
		slog.WarnContext(c.Request().Context(), "list combos: count failed",
			slog.String("err", cErr.Error()))
	} else {
		total = n
	}
	return c.JSON(http.StatusOK, ListResponse{
		Items: items,
		Count: len(items),
		Total: total,
	})
}

// ===========================================================================
// PATCH /api/combos/:id
// ===========================================================================

func (h *Handler) UpdateMetadata(c echo.Context) error {
	id, err := parseIDParam(c, "id")
	if err != nil {
		return c.JSON(http.StatusBadRequest, model.NewAPIError("invalid_id", err.Error()))
	}

	var req UpdateMetadataRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, model.NewAPIError("invalid_request", err.Error()))
	}

	combo, result, err := h.service.UpdateMetadata(c.Request().Context(), id, req.Version, toServiceUpdateMetadataInput(req, mw.UserIDFrom(c)))
	if err != nil {
		switch {
		case errors.Is(err, combosvc.ErrNotFound):
			return c.JSON(http.StatusNotFound, model.NewAPIError("not_found", "コンボが見つかりません"))
		case errors.Is(err, combosvc.ErrConflict):
			return c.JSON(http.StatusConflict, model.NewAPIError(model.ErrorCodeVersionConflict, "このコンボは他の処理で更新されました。再取得してください"))
		case errors.Is(err, combosvc.ErrInvalidTagID):
			return c.JSON(http.StatusBadRequest, model.NewAPIError("invalid_tag_id", "存在しないタグ ID が tagIds に含まれています"))
		case errors.Is(err, combosvc.ErrInvalidSetupCarryMode):
			return c.JSON(http.StatusBadRequest, model.NewAPIError("invalid_setup_carry_mode", "不正なセットプレイ引き継ぎモードです"))
		case errors.Is(err, combosvc.ErrMissingSetupCarryOptions):
			return c.JSON(http.StatusBadRequest, model.NewAPIError("missing_setup_carry_options", "knockdown_advantage 変更時はセットプレイ引き継ぎオプションが必要です"))
		}
		slog.ErrorContext(c.Request().Context(), "update metadata", slog.String("err", err.Error()))
		return c.JSON(http.StatusInternalServerError, model.NewAPIError("internal_error", "サーバーエラーが発生しました"))
	}
	// 本登録昇格(is_draft: false)時のフルバリデーションで ERROR があると
	// サービスは combo=nil, err=nil を返す。Create / UpdateWithKeyChange と同様に
	// 400 + validations で返す(これがないと combo=nil を toComboResponse して 500 になる)。
	if result.HasError() {
		return c.JSON(http.StatusBadRequest, model.NewValidationFailedError(result))
	}

	return c.JSON(http.StatusOK, toComboResponse(combo, &result))
}

// ===========================================================================
// PUT /api/combos/:id(キー変更編集)
// ===========================================================================

func (h *Handler) UpdateWithKeyChange(c echo.Context) error {
	id, err := parseIDParam(c, "id")
	if err != nil {
		return c.JSON(http.StatusBadRequest, model.NewAPIError("invalid_id", err.Error()))
	}

	var req PutRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, model.NewAPIError("invalid_request", err.Error()))
	}

	combo, result, err := h.service.UpdateWithKeyChange(c.Request().Context(), id, req.Version, toServiceCreateInput(req.CreateRequest, mw.UserIDFrom(c)))
	if err != nil {
		switch {
		case errors.Is(err, combosvc.ErrNotFound):
			return c.JSON(http.StatusNotFound, model.NewAPIError("not_found", "コンボが見つかりません"))
		case errors.Is(err, combosvc.ErrConflict):
			return c.JSON(http.StatusConflict, model.NewAPIError(model.ErrorCodeVersionConflict, "このコンボは他の処理で更新されました。再取得してください"))
		case errors.Is(err, combosvc.ErrInvalidTagID):
			return c.JSON(http.StatusBadRequest, model.NewAPIError("invalid_tag_id", "存在しないタグ ID が tagIds に含まれています"))
		case errors.Is(err, combosvc.ErrInvalidSetupCarryMode):
			return c.JSON(http.StatusBadRequest, model.NewAPIError("invalid_setup_carry_mode", "不正なセットプレイ引き継ぎモードです"))
		case errors.Is(err, combosvc.ErrMissingSetupCarryOptions):
			return c.JSON(http.StatusBadRequest, model.NewAPIError("missing_setup_carry_options", "knockdown_advantage 変更時はセットプレイ引き継ぎオプションが必要です"))
		}
		// M24-11: write lock を取れなかった。入力の誤り(400)でも版の衝突(409)でもない。
		if errors.Is(err, combosvc.ErrDatabaseBusy) {
			return c.JSON(http.StatusServiceUnavailable,
				model.NewAPIError(model.ErrorCodeDatabaseBusy,
					"データベースが混み合っています。少し時間をおいて再度お試しください"))
		}
		slog.ErrorContext(c.Request().Context(), "update with key change", slog.String("err", err.Error()))
		return c.JSON(http.StatusInternalServerError, model.NewAPIError("internal_error", "サーバーエラーが発生しました"))
	}
	if result.HasError() {
		return c.JSON(http.StatusBadRequest, model.NewValidationFailedError(result))
	}
	return c.JSON(http.StatusCreated, toComboResponse(combo, &result))
}

// ===========================================================================
// DELETE /api/combos/:id
// ===========================================================================

func (h *Handler) Delete(c echo.Context) error {
	id, err := parseIDParam(c, "id")
	if err != nil {
		return c.JSON(http.StatusBadRequest, model.NewAPIError("invalid_id", err.Error()))
	}

	if err := h.service.Delete(c.Request().Context(), id); err != nil {
		if errors.Is(err, combosvc.ErrNotFound) {
			return c.JSON(http.StatusNotFound, model.NewAPIError("not_found", "コンボが見つかりません"))
		}
		slog.ErrorContext(c.Request().Context(), "delete combo", slog.String("err", err.Error()))
		return c.JSON(http.StatusInternalServerError, model.NewAPIError("internal_error", "サーバーエラーが発生しました"))
	}
	return c.NoContent(http.StatusNoContent)
}

// ===========================================================================
// POST /api/combos/:id/restore
// ===========================================================================

func (h *Handler) Restore(c echo.Context) error {
	id, err := parseIDParam(c, "id")
	if err != nil {
		return c.JSON(http.StatusBadRequest, model.NewAPIError("invalid_id", err.Error()))
	}

	// ★警告が付いても復元は成功しており、200 で返す(M23-04 §4.1)。
	// warnings はエラーではない——DES-002 §4.2 のとおり 200 OK の本文に載せる。
	warnings, err := h.service.Restore(c.Request().Context(), id)
	if err != nil {
		if errors.Is(err, combosvc.ErrNotFound) {
			return c.JSON(http.StatusNotFound, model.NewAPIError("not_found", "コンボが見つかりません"))
		}
		slog.ErrorContext(c.Request().Context(), "restore combo", slog.String("err", err.Error()))
		return c.JSON(http.StatusInternalServerError, model.NewAPIError("internal_error", "サーバーエラーが発生しました"))
	}

	combo, err := h.service.Get(c.Request().Context(), id, mw.UserIDFrom(c))
	if err != nil {
		slog.ErrorContext(c.Request().Context(), "post-restore get", slog.String("err", err.Error()))
		return c.JSON(http.StatusInternalServerError, model.NewAPIError("internal_error", "サーバーエラーが発生しました"))
	}
	resp := toComboResponse(combo, nil)
	// ★0 件のときはキーごと出さない(§4.3-2)。空配列を代入しないこと。
	if len(warnings.Issues) > 0 {
		resp.Warnings = warnings.Issues
	}
	return c.JSON(http.StatusOK, resp)
}

// AcknowledgeGameVersion は POST /api/combos/:id/acknowledge-version。
// コンボの基準を現在のデータバージョンへ進める(FR702 の「確認した」・M28-02a §2.3-4)。
//
// ★★これは「破綻していない」の断定ではない。利用者が中身を見たという記録である
// (FR307: アプリは破綻も無事も自動で断定しない)。
// ★冪等ではない —— 版が進んだ後に再度呼べば、そのときの最新まで進む。
//
//	ただし同じ版のまま何度呼んでも結果は変わらない。
//
// ★ゴミ箱の行は対象外(リポジトリ側の deleted_at IS NULL)。⇒ 404 になる。
// ★本サブでは API まで。
// ★【2026-09-13・M37-01】旧記述「画面は M28-02b」は失効。M28-02b は実装しないまま
// 完了しており(M-137)、3 方式入力の画面は M37-01 が作った。
func (h *Handler) AcknowledgeGameVersion(c echo.Context) error {
	id, err := parseIDParam(c, "id")
	if err != nil {
		return c.JSON(http.StatusBadRequest, model.NewAPIError("invalid_id", err.Error()))
	}

	if _, err = h.service.AcknowledgeGameVersion(c.Request().Context(), id); err != nil {
		if errors.Is(err, combosvc.ErrNotFound) {
			return c.JSON(http.StatusNotFound, model.NewAPIError("not_found", "コンボが見つかりません"))
		}
		if errors.Is(err, combosvc.ErrDatabaseBusy) {
			return c.JSON(http.StatusServiceUnavailable, model.NewAPIError("database_busy", "データベースが混み合っています。少し待って再試行してください"))
		}
		slog.ErrorContext(c.Request().Context(), "acknowledge game version", slog.String("err", err.Error()))
		return c.JSON(http.StatusInternalServerError, model.NewAPIError("internal_error", "サーバーエラーが発生しました"))
	}

	// ★タグを利用者スコープで載せるため、他の応答と同じく Get を通す(M22-02 §4.5-13)。
	combo, err := h.service.Get(c.Request().Context(), id, mw.UserIDFrom(c))
	if err != nil {
		slog.ErrorContext(c.Request().Context(), "post-acknowledge get", slog.String("err", err.Error()))
		return c.JSON(http.StatusInternalServerError, model.NewAPIError("internal_error", "サーバーエラーが発生しました"))
	}
	return c.JSON(http.StatusOK, toComboResponse(combo, nil))
}

// ===========================================================================
// GET /api/combos/:id/recipe?preset_id=X
// ===========================================================================

// GetRecipe は指定プリセットでコンボを文字列化したレシピを返す。
func (h *Handler) GetRecipe(c echo.Context) error {
	id, err := parseIDParam(c, "id")
	if err != nil {
		return c.JSON(http.StatusBadRequest, model.NewAPIError("invalid_id", err.Error()))
	}

	rawPreset := c.QueryParam("preset_id")
	if rawPreset == "" {
		return c.JSON(http.StatusBadRequest, model.NewAPIError("invalid_query", "preset_id クエリパラメータが必須です"))
	}
	presetID, err := strconv.ParseInt(rawPreset, 10, 64)
	if err != nil {
		return c.JSON(http.StatusBadRequest, model.NewAPIError("invalid_query", "preset_id は整数である必要があります"))
	}

	if h.notationSvc == nil {
		return c.JSON(http.StatusInternalServerError, model.NewAPIError("internal_error", "notation service is not configured"))
	}

	if _, err := h.service.Get(c.Request().Context(), id, mw.UserIDFrom(c)); err != nil {
		if errors.Is(err, combosvc.ErrNotFound) {
			return c.JSON(http.StatusNotFound, model.NewAPIError("not_found", "コンボが見つかりません"))
		}
		slog.ErrorContext(c.Request().Context(), "get combo for recipe", slog.String("err", err.Error()))
		return c.JSON(http.StatusInternalServerError, model.NewAPIError("internal_error", "サーバーエラーが発生しました"))
	}

	text, err := h.notationSvc.ResolveComboRecipe(c.Request().Context(), id, presetID)
	if err != nil {
		if errors.Is(err, notation.ErrPresetNotFound) {
			return c.JSON(http.StatusNotFound, model.NewAPIError("not_found", "プリセットが見つかりません"))
		}
		slog.ErrorContext(c.Request().Context(), "resolve combo recipe", slog.String("err", err.Error()))
		return c.JSON(http.StatusInternalServerError, model.NewAPIError("internal_error", "サーバーエラーが発生しました"))
	}
	return c.JSON(http.StatusOK, RecipeResponse{
		ComboID:  id,
		PresetID: presetID,
		Text:     text,
	})
}

// ===========================================================================
// 内部ヘルパ
// ===========================================================================

func parseIDParam(c echo.Context, name string) (int64, error) {
	raw := c.Param(name)
	id, err := strconv.ParseInt(raw, 10, 64)
	if err != nil {
		return 0, errors.New(name + " は整数である必要があります")
	}
	return id, nil
}
