package preset

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"strconv"

	"github.com/labstack/echo/v4"
	mw "github.com/plexiblinp/tacpendium/internal/api/middleware"
	"github.com/plexiblinp/tacpendium/internal/model"
	presetsvc "github.com/plexiblinp/tacpendium/internal/service/preset"
)

// Handler はプリセット API のハンドラ。
//
// M1-04 では読み取り 2 本のみでリポジトリを直接持っていたが、M20-04 で
// 書き込み 3 本 ＋ エイリアス読み取り 1 本が加わり、保護・上限・トランザクションを
// 持つサービス層を経由する形になった。
type Handler struct {
	service presetsvc.Service
	// rebuildRecipeCache は当該プリセット分の recipe_cache を作り直す(M24-08 第 2 部 B)。
	// ★関数注入にしてあるのは、api 層から notation サービスへの直接依存を増やさないため
	//   (先例＝main.go が config サービスへ同じ形で渡している)。nil 可＝機能を出さない。
	rebuildRecipeCache RecipeCacheRebuilder
}

// RecipeCacheRebuilder は当該プリセット分の recipe_cache を全コンボ・全セットプレイに
// 対して作り直す。実体は notation.Service.RecomputePresetCache である。
//
// ★書き込みトランザクションの外で呼ぶこと(D-360)。本ハンドラは tx を持たない。
type RecipeCacheRebuilder func(ctx context.Context, presetID int64) error

// NewHandler は Handler を構築する。
//
// rebuildRecipeCache は nil を渡してよい(その場合 POST /presets/:id/recipe-cache/rebuild は
// 501 を返す)。テストは読み書きの検証だけを行うため nil を渡している。
func NewHandler(service presetsvc.Service, rebuildRecipeCache RecipeCacheRebuilder) *Handler {
	return &Handler{service: service, rebuildRecipeCache: rebuildRecipeCache}
}

// RebuildRecipeCache は POST /api/presets/:id/recipe-cache/rebuild を処理する。
//
// 【なぜ本ルートが要るか】(M24-08 第 2 部 B / D-615)
// recipe_cache は {presetId: 表示文字列} の JSON であり、preset_aliases を直すだけでは
// 追随しない。着手前は作り直す手段が実質存在しなかった:
//   - 起動時の自動再構築は無い(main.go は RecomputePresetCache を注入するだけ)
//   - 設定画面の「キャッシュ再構築」ボタンは disabled の未実装で、対応 API も無かった
//   - 組み込みプリセット(official_ja_move)は PUT /presets/:id が 403 のため、
//     エイリアス更新経由の再計算にも乗せられない
//
// ⇒ マイグレで alias_text を直しても既存 DB の表示が古いままになる。本ルートで解く。
//
// 【★authorizeMutation を通さない】
// あれは「組み込みは編集も削除もできない」(VAL-P01 / D-290)の門番である。
// 本ルートはプリセットの中身を変えず、キャッシュを真実(preset_aliases)から
// 作り直すだけであり、編集ではない。★むしろ組み込みでこそ必要になる。
// ⇒ 実在検査(Get)だけを行う。
//
// 【★所有者検査も行わない。その判断の根拠】
// カスタムプリセットについて requester と preset.UserID を突き合わせていない
// (VAL-P07 は「他ユーザーが作成したものは参照のみ可」と定めている)。理由 3 つ:
//  1. 本操作はプリセットの中身を 1 バイトも変えない。真実である preset_aliases から
//     表示文字列を作り直すだけであり、結果は誰が押しても同じである。
//  2. 応答は presetId だけを返す。他ユーザーのプリセットの中身は 1 つも漏れない。
//  3. recipe_cache は「そのユーザーのコンボの表示文字列」であり、作り直しても
//     見えるものは変わらない(古い文字列が新しい文字列に置き換わるだけ)。
//
// ★逆に所有者検査を入れると、組み込みを 403 にしたのと同じ理由で詰む——
// 既定プリセットが他ユーザーの作ったカスタムであるとき、作り直せなくなる。
// ★この判断を変えるなら、VAL-P07 の射程に「キャッシュ保守」を含めるかの
// 設計判断が要る(本サブの射程外)。
func (h *Handler) RebuildRecipeCache(c echo.Context) error {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		return c.JSON(http.StatusBadRequest, model.NewAPIError("invalid_id", "invalid id"))
	}

	if h.rebuildRecipeCache == nil {
		return c.JSON(http.StatusNotImplemented,
			model.NewAPIError("not_implemented", "recipe cache rebuild is not wired"))
	}

	ctx := c.Request().Context()
	if _, err := h.service.Get(ctx, id); err != nil {
		if errors.Is(err, presetsvc.ErrNotFound) {
			return c.JSON(http.StatusNotFound, model.NewAPIError("not_found", "preset not found"))
		}
		slog.ErrorContext(ctx, "get preset for cache rebuild", slog.String("err", err.Error()))
		return c.JSON(http.StatusInternalServerError, model.NewAPIError("internal_error", "internal error"))
	}

	if err := h.rebuildRecipeCache(ctx, id); err != nil {
		slog.ErrorContext(ctx, "rebuild recipe cache",
			slog.Int64("preset_id", id), slog.String("err", err.Error()))
		return c.JSON(http.StatusInternalServerError,
			model.NewAPIError("internal_error", "failed to rebuild recipe cache"))
	}

	return c.JSON(http.StatusOK, RecipeCacheRebuildResponse{PresetID: id})
}

// List は GET /api/presets を処理する。★契約は M1-04 から不変。
func (h *Handler) List(c echo.Context) error {
	presets, err := h.service.List(c.Request().Context())
	if err != nil {
		slog.ErrorContext(c.Request().Context(), "list presets", slog.String("err", err.Error()))
		return c.JSON(http.StatusInternalServerError, model.NewAPIError("internal_error", "internal error"))
	}

	resp := make([]PresetResponse, len(presets))
	for i, p := range presets {
		resp[i] = toPresetResponse(p)
	}
	return c.JSON(http.StatusOK, resp)
}

// Get は GET /api/presets/:id を処理する。★契約は M1-04 から不変。
func (h *Handler) Get(c echo.Context) error {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		return c.JSON(http.StatusBadRequest, model.NewAPIError("invalid_id", "invalid id"))
	}

	p, err := h.service.Get(c.Request().Context(), id)
	if err != nil {
		if errors.Is(err, presetsvc.ErrNotFound) {
			return c.JSON(http.StatusNotFound, model.NewAPIError("not_found", "preset not found"))
		}
		slog.ErrorContext(c.Request().Context(), "get preset", slog.String("err", err.Error()))
		return c.JSON(http.StatusInternalServerError, model.NewAPIError("internal_error", "internal error"))
	}

	return c.JSON(http.StatusOK, toPresetResponse(p))
}

// ListAliases は GET /api/presets/:id/aliases?character_id=N[&limit=M] を処理する。
//
// ★本ルートは指示書 §4.2 の表に無いが追加した。プリセット編集画面
// (DES-005 §5.11「エイリアス一覧、キャラ別にグループ化、編集可能」)を実装する
// 手段が他に無いためである(GET /api/presets/:id はメタ情報しか返さない)。
// character_id は必須にしている——1 プリセットのエイリアスは最大 1,653 行あり、
// 全件を 1 応答で返すべきではない。
func (h *Handler) ListAliases(c echo.Context) error {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		return c.JSON(http.StatusBadRequest, model.NewAPIError("invalid_id", "invalid id"))
	}

	rawChar := c.QueryParam("character_id")
	if rawChar == "" {
		return c.JSON(http.StatusBadRequest,
			model.NewAPIError("invalid_query", "character_id は必須です"))
	}
	characterID, err := strconv.ParseInt(rawChar, 10, 64)
	if err != nil || characterID < 1 {
		return c.JSON(http.StatusBadRequest,
			model.NewAPIError("invalid_query", "character_id は正の整数で指定してください"))
	}

	limit := 0
	if raw := c.QueryParam("limit"); raw != "" {
		limit, err = strconv.Atoi(raw)
		if err != nil || limit < 1 {
			return c.JSON(http.StatusBadRequest,
				model.NewAPIError("invalid_query", "limit は正の整数で指定してください"))
		}
	}

	details, err := h.service.ListAliases(c.Request().Context(), id, characterID, limit)
	if err != nil {
		if errors.Is(err, presetsvc.ErrNotFound) {
			return c.JSON(http.StatusNotFound, model.NewAPIError("not_found", "プリセットが見つかりません"))
		}
		slog.ErrorContext(c.Request().Context(), "list preset aliases", slog.String("err", err.Error()))
		return c.JSON(http.StatusInternalServerError, model.NewAPIError("internal_error", "internal error"))
	}

	resp := make([]AliasResponse, len(details))
	for i, d := range details {
		resp[i] = toAliasResponse(d)
	}
	return c.JSON(http.StatusOK, resp)
}

// Create は POST /api/presets を処理する(組み込みをコピーしてカスタムを作る)。
func (h *Handler) Create(c echo.Context) error {
	var req CreatePresetRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest,
			model.NewAPIError("invalid_request", "リクエスト形式が不正です: "+err.Error()))
	}

	p, err := h.service.Create(c.Request().Context(), mw.UserIDFrom(c), req.BasePresetCode, req.Name)
	if err != nil {
		return h.writeServiceError(c, err, "create preset")
	}
	return c.JSON(http.StatusCreated, toPresetResponse(p))
}

// Update は PUT /api/presets/:id を処理する。★組み込みは 403。
func (h *Handler) Update(c echo.Context) error {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		return c.JSON(http.StatusBadRequest, model.NewAPIError("invalid_id", "invalid id"))
	}

	var req UpdatePresetRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest,
			model.NewAPIError("invalid_request", "リクエスト形式が不正です: "+err.Error()))
	}

	aliases := make([]presetsvc.AliasUpdate, len(req.Aliases))
	for i, a := range req.Aliases {
		aliases[i] = presetsvc.AliasUpdate{MoveID: a.MoveID, AliasText: a.AliasText}
	}

	p, err := h.service.Update(c.Request().Context(), mw.UserIDFrom(c), id, req.Name, aliases)
	if err != nil {
		return h.writeServiceError(c, err, "update preset")
	}
	return c.JSON(http.StatusOK, toPresetResponse(p))
}

// Delete は DELETE /api/presets/:id を処理する。★組み込みは 403。
func (h *Handler) Delete(c echo.Context) error {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		return c.JSON(http.StatusBadRequest, model.NewAPIError("invalid_id", "invalid id"))
	}

	if err := h.service.Delete(c.Request().Context(), mw.UserIDFrom(c), id); err != nil {
		return h.writeServiceError(c, err, "delete preset")
	}
	return c.NoContent(http.StatusNoContent)
}

// writeServiceError はサービス層のセンチネルを HTTP 応答へ写像する。
//
// ★一意制約違反(表記の衝突)を 500 にしないこと。利用者の入力誤りであり、
// 監視から見ると偽の障害として上がる(ボード D-275 と同型。指示書 §4.2)。
func (h *Handler) writeServiceError(c echo.Context, err error, op string) error {
	switch {
	case errors.Is(err, presetsvc.ErrNotFound):
		return c.JSON(http.StatusNotFound, model.NewAPIError("not_found", "プリセットが見つかりません"))

	case errors.Is(err, presetsvc.ErrBuiltinProtected):
		return c.JSON(http.StatusForbidden, model.NewAPIError("builtin_protected",
			"組み込みプリセットは編集・削除できません。コピーしてカスタムプリセットを作成してください"))

	case errors.Is(err, presetsvc.ErrForbidden):
		return c.JSON(http.StatusForbidden, model.NewAPIError("forbidden",
			"他のユーザーが作成したプリセットは編集・削除できません"))

	case errors.Is(err, presetsvc.ErrLimitExceeded):
		// ★件数は定数から組み立てる。VAL-P05 の値は M20-01 で 10 → 8 へ変わった
		// 実績があり、リテラルで書くとメッセージだけが古い数字のまま残る。
		return c.JSON(http.StatusConflict, model.NewAPIErrorWithDetails("preset_limit_exceeded",
			fmt.Sprintf("プリセットは全体で %d 件までです。不要なカスタムプリセットを削除してください",
				presetsvc.PresetTotalLimit),
			map[string]any{"limit": presetsvc.PresetTotalLimit}))

	case errors.Is(err, presetsvc.ErrNameDuplicate):
		return c.JSON(http.StatusConflict, model.NewAPIError("preset_name_duplicate",
			"同名のプリセットが既に存在します"))

	case errors.Is(err, presetsvc.ErrNameEmpty):
		return c.JSON(http.StatusBadRequest, model.NewAPIError("preset_name_empty",
			"プリセット名は必須です"))

	case errors.Is(err, presetsvc.ErrBaseNotFound):
		return c.JSON(http.StatusBadRequest, model.NewAPIError("invalid_base_preset",
			"コピー元には組み込みプリセットを指定してください"))

	case errors.Is(err, presetsvc.ErrAliasTextEmpty):
		return c.JSON(http.StatusBadRequest, model.NewAPIError("alias_text_empty",
			"エイリアスは空にできません"))

	case errors.Is(err, presetsvc.ErrAliasMoveNotFound):
		return c.JSON(http.StatusBadRequest, model.NewAPIError("alias_move_not_found",
			"このプリセットに存在しない技のエイリアスは編集できません"))

	case errors.Is(err, presetsvc.ErrAliasConflict):
		// ★どの表記が衝突したかを利用者へ伝える(指示書 §4.2 / §4.6-5)。
		var conflict *presetsvc.AliasConflictError
		text := ""
		if errors.As(err, &conflict) {
			text = conflict.AliasText
		}
		return c.JSON(http.StatusConflict, model.NewAPIErrorWithDetails("alias_conflict",
			"同じキャラクター内で「"+text+"」が別の技と重複しています。別の表記にしてください",
			map[string]any{"aliasText": text}))

	case errors.Is(err, presetsvc.ErrInUseByConfig):
		return c.JSON(http.StatusConflict, model.NewAPIError("preset_in_use_by_config",
			"既定のプリセットに設定されているため削除できません。設定で別のプリセットを選んでから削除してください"))
	}

	slog.ErrorContext(c.Request().Context(), op, slog.String("err", err.Error()))
	return c.JSON(http.StatusInternalServerError,
		model.NewAPIError("internal_error", "サーバーエラーが発生しました"))
}
