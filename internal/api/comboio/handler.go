// Package comboio はコンボ CSV エクスポート(FR401)・インポート(FR405)の HTTP ハンドラを提供する。
//
//   - GET  /api/export/csv          対象コンボ + 紐づくセットプレイを zip(2 CSV)で返す
//   - POST /api/import/csv/preview  コンボ CSV(+任意セットプレイ CSV / zip)を検証・無害化(DB 書込なし)
//   - POST /api/import/csv          選択 local_id を取り込み、行単位レポートを返す
//
// 解析・検証・無害化・code→id 解決・starter 導出・重複判定・タグ解決・セットプレイ反映は
// service/comboio の共通ロジックへ委ねる。
package comboio

import (
	"archive/zip"
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"

	"github.com/labstack/echo/v4"

	mw "github.com/plexiblinp/tacpendium/internal/api/middleware"
	"github.com/plexiblinp/tacpendium/internal/model"
	comboiosvc "github.com/plexiblinp/tacpendium/internal/service/comboio"
)

// Handler は comboio API のハンドラ。
type Handler struct {
	svc comboiosvc.Service
}

// NewHandler は Handler を構築する。
func NewHandler(svc comboiosvc.Service) *Handler {
	return &Handler{svc: svc}
}

const (
	comboFileField = "combo_file" // コンボ CSV または zip
	setupFileField = "setup_file" // 任意: セットプレイ CSV
	zipMagic       = "PK\x03\x04"
	comboEntryName = "combos.csv"
	setupEntryName = "setups.csv"
	// maxUploadBytes は 1 ファイル(またはアップロード zip)の受領上限・zip エントリ
	// 展開上限。VAL-I01(10MiB)と対称。**全量メモリ展開前に上限で頭打ち**することで、
	// 巨大アップロード・解凍爆弾(小さな zip が GB 級に展開)による DoS を防ぐ。
	maxUploadBytes = 10 << 20 // 10 MiB

	// 書出の観測ヘッダ(M29-02 §2.1)。zip 本体に警告欄を混ぜられないため
	// ヘッダで運ぶ。★契約であり、変えると FE の観測が静かに消える。
	headerExportTotal           = "X-Export-Total"
	headerExportIncluded        = "X-Export-Included"
	headerExportTruncated       = "X-Export-Truncated"
	headerExportReimportBlocked = "X-Export-Reimport-Blocked"
)

// errUploadTooLarge はアップロードが上限(10MiB)を超えたことを表す番兵。
//
// ★★番兵にする理由(M29-02 §2.1) —— 「添付されていない」と「大きすぎる」を
// 呼び出し元が区別できないと、任意ファイル(setup_file)の上限超過を
// 「無かったこと」として黙って読み飛ばしてしまう。着手前がその形だった。
var errUploadTooLarge = errors.New("アップロードファイルが上限(10MiB)を超えています")

// Export は GET /api/export/csv を処理する。対象範囲をクエリで受け、zip を返す。
func (h *Handler) Export(c echo.Context) error {
	query, err := parseExportQuery(c)
	if err != nil {
		return badRequest(c, err.Error())
	}
	// ★載るタグを出力する利用者のものへ絞る(M22-02 §4.5-9・§4.5-16)。
	query.UserID = mw.UserIDFrom(c)
	res, err := h.svc.ExportCSV(c.Request().Context(), query)
	if err != nil {
		return badRequest(c, err.Error())
	}
	c.Response().Header().Set(echo.HeaderContentDisposition, `attachment; filename="tacpendium-export.zip"`)
	setExportObservationHeaders(c, res)
	return c.Blob(http.StatusOK, "application/zip", res.Data)
}

// setExportObservationHeaders は書出の観測(切り捨て・往復不能)を応答ヘッダへ載せる。
//
// ★★ヘッダで運ぶ理由(M29-02 §2.1) —— 本体は zip のバイト列であり、JSON の
// 警告欄を混ぜられない。⇒ 画面を経由しない呼び出し元(API を直に叩く場合)にも
// 観測が届くのはヘッダだけである。画面側の確認ダイアログは送信前に出るが、
// それは画面を通る経路にしか効かない。両方を置くことで全経路に観測が付く。
//
// ★切り捨てが無いときも Total / Included を必ず出す。「ヘッダが無い」と
// 「切り捨てていない」を呼び出し元が区別できるようにするためである
// (キーが消えると「判定していない」と区別が付かない = DES-002 §4.2 の
// affectedByGameUpdate と同じ考え方)。
func setExportObservationHeaders(c echo.Context, res *comboiosvc.ExportResult) {
	h := c.Response().Header()
	h.Set(headerExportTotal, strconv.Itoa(res.TotalCombos))
	h.Set(headerExportIncluded, strconv.Itoa(res.IncludedCombos))
	h.Set(headerExportTruncated, strconv.FormatBool(res.Truncated()))
	h.Set(headerExportReimportBlocked, strconv.FormatBool(res.ReimportBlocked()))
	// ★ブラウザの fetch は既定で CORS セーフリスト外のヘッダを読めない。
	//   同一オリジン配信でも、明示しておかないと LAN 共有時に静かに読めなくなる。
	h.Set("Access-Control-Expose-Headers", strings.Join([]string{
		headerExportTotal, headerExportIncluded,
		headerExportTruncated, headerExportReimportBlocked,
	}, ", "))
}

// Preview は POST /api/import/csv/preview を処理する(dry-run、DB 書込なし)。
func (h *Handler) Preview(c echo.Context) error {
	comboCSV, setupCSV, err := readImportFiles(c)
	if err != nil {
		return badRequest(c, err.Error())
	}
	res, err := h.svc.ParsePreview(c.Request().Context(), comboCSV, setupCSV)
	if err != nil {
		return badRequest(c, err.Error())
	}
	return c.JSON(http.StatusOK, toPreviewResponse(res))
}

// Commit は POST /api/import/csv を処理する(選択 local_id のみ取り込み)。
func (h *Handler) Commit(c echo.Context) error {
	comboCSV, setupCSV, err := readImportFiles(c)
	if err != nil {
		return badRequest(c, err.Error())
	}
	selected, err := parseSelected(c.FormValue("selected"))
	if err != nil {
		return badRequest(c, err.Error())
	}
	action := parseDupAction(c.FormValue("dupAction"))
	res, err := h.svc.Commit(c.Request().Context(), comboCSV, setupCSV, selected, action, mw.UserIDFrom(c))
	if err != nil {
		return badRequest(c, err.Error())
	}
	return c.JSON(http.StatusOK, toCommitResponse(res))
}

// parseExportQuery はクエリパラメータを ExportQuery へ変換する。
func parseExportQuery(c echo.Context) (comboiosvc.ExportQuery, error) {
	q := comboiosvc.ExportQuery{Range: comboiosvc.ExportRangeKind(c.QueryParam("range"))}
	if q.Range == "" {
		q.Range = comboiosvc.RangeAll
	}
	switch q.Range {
	case comboiosvc.RangeAll, comboiosvc.RangeFilter, comboiosvc.RangeMyCombo, comboiosvc.RangeSelected:
	default:
		return q, errors.New("range が不正です(all/filter/selected/mycombo)")
	}

	if v := c.QueryParam("characterId"); v != "" {
		id, err := strconv.ParseInt(v, 10, 64)
		if err != nil {
			return q, errors.New("characterId が不正です")
		}
		q.CharacterID = &id
	}
	if v := c.QueryParam("position"); v != "" {
		q.Position = &v
	}
	if v := c.QueryParam("hitType"); v != "" {
		q.HitType = &v
	}
	if v := c.QueryParam("opponentStance"); v != "" {
		q.OpponentStance = &v
	}
	if v := c.QueryParam("isDraft"); v != "" {
		b := v == "true"
		q.IsDraft = &b
	}
	for _, raw := range splitCSVParam(c.QueryParam("tagIds")) {
		id, err := strconv.ParseInt(raw, 10, 64)
		if err != nil {
			return q, errors.New("tagIds が不正です")
		}
		q.TagIDs = append(q.TagIDs, id)
	}
	for _, raw := range splitCSVParam(c.QueryParam("ids")) {
		id, err := strconv.ParseInt(raw, 10, 64)
		if err != nil {
			return q, errors.New("ids が不正です")
		}
		q.SelectedIDs = append(q.SelectedIDs, id)
	}
	return q, nil
}

// readImportFiles は multipart の combo_file(CSV or zip)+ 任意 setup_file(CSV)を読む。
// combo_file が zip の場合は combos.csv / setups.csv を自動展開する(往復対称)。
func readImportFiles(c echo.Context) (comboCSV, setupCSV string, err error) {
	comboBytes, err := readFormFile(c, comboFileField)
	if err != nil {
		// ★★上限超過を「必要です」に差し替えないこと(M29-02 §2.1)。
		//   着手前は err の中身を捨てていたため、10MiB を超えたアップロードが
		//   「コンボ CSV(combo_file)が必要です」と表示されていた。
		//   ⇒ 利用者は「ファイルを選び直せばよい」と読むが、何度選び直しても直らない。
		if errors.Is(err, errUploadTooLarge) {
			return "", "", err
		}
		return "", "", errors.New("コンボ CSV(combo_file)が必要です")
	}
	if bytes.HasPrefix(comboBytes, []byte(zipMagic)) {
		return extractZip(comboBytes)
	}
	comboCSV = string(comboBytes)
	setupBytes, sErr := readFormFile(c, setupFileField)
	switch {
	case sErr == nil:
		setupCSV = string(setupBytes)
	case errors.Is(sErr, errUploadTooLarge):
		// ★★上限超過を握り潰さない(M29-02 §2.1)。
		//   着手前は `if ..., e := ...; e == nil` の形であり、上限を超えた
		//   セットプレイ CSV は **1 件も取り込まれないのに何も言わなかった**。
		//   ⇒ 利用者は「セットプレイは無かった」と思う。これは黙って落ちる形である。
		//   ★「添付されていない」は従来どおり黙って続ける(セットプレイ CSV は任意)。
		//     区別することが要点である。
		return "", "", sErr
	}
	return comboCSV, setupCSV, nil
}

// extractZip は zip から combos.csv / setups.csv を取り出す。
func extractZip(data []byte) (comboCSV, setupCSV string, err error) {
	zr, err := zip.NewReader(bytes.NewReader(data), int64(len(data)))
	if err != nil {
		return "", "", errors.New("zip の展開に失敗しました")
	}
	for _, f := range zr.File {
		base := f.Name
		if i := strings.LastIndex(base, "/"); i >= 0 {
			base = base[i+1:]
		}
		switch base {
		case comboEntryName:
			comboCSV, err = readZipEntry(f)
		case setupEntryName:
			setupCSV, err = readZipEntry(f)
		}
		if err != nil {
			return "", "", err
		}
	}
	if comboCSV == "" {
		return "", "", errors.New("zip 内に " + comboEntryName + " が見つかりません")
	}
	return comboCSV, setupCSV, nil
}

func readZipEntry(f *zip.File) (string, error) {
	rc, err := f.Open()
	if err != nil {
		return "", errors.New("zip エントリを開けませんでした")
	}
	defer func() { _ = rc.Close() }()
	// 解凍爆弾ガード: 展開後サイズを maxUploadBytes で頭打ちする(io.LimitReader)。
	b, err := io.ReadAll(io.LimitReader(rc, maxUploadBytes+1))
	if err != nil {
		return "", errors.New("zip エントリの読み取りに失敗しました")
	}
	if len(b) > maxUploadBytes {
		return "", errors.New("zip 内ファイルが展開上限(10MiB)を超えています(解凍爆弾の可能性)")
	}
	return string(b), nil
}

func readFormFile(c echo.Context, field string) ([]byte, error) {
	fh, err := c.FormFile(field)
	if err != nil {
		return nil, err
	}
	f, err := fh.Open()
	if err != nil {
		return nil, err
	}
	defer func() { _ = f.Close() }()
	// 巨大アップロードガード: 受領サイズを maxUploadBytes で頭打ちしてから読む。
	b, err := io.ReadAll(io.LimitReader(f, maxUploadBytes+1))
	if err != nil {
		return nil, err
	}
	if len(b) > maxUploadBytes {
		// ★番兵付きで返す。呼び出し元が「添付されていない」と区別できないと、
		//   上限超過を黙って読み飛ばす形に戻る(M29-02 §2.1)。
		return nil, fmt.Errorf("%w(%s)", errUploadTooLarge, field)
	}
	return b, nil
}

func parseSelected(raw string) ([]string, error) {
	if raw == "" {
		return []string{}, nil
	}
	var sels []string
	if err := json.Unmarshal([]byte(raw), &sels); err != nil {
		return nil, errors.New("selected の JSON 解析に失敗しました")
	}
	return sels, nil
}

func parseDupAction(raw string) comboiosvc.DupAction {
	if comboiosvc.DupAction(raw) == comboiosvc.DupSetupsOnly {
		return comboiosvc.DupSetupsOnly
	}
	return comboiosvc.DupSkip // 既定 skip(廃止した "add" を含む未知値も skip 扱い)
}

func splitCSVParam(raw string) []string {
	if raw == "" {
		return nil
	}
	parts := strings.Split(raw, ",")
	out := make([]string, 0, len(parts))
	for _, p := range parts {
		if p = strings.TrimSpace(p); p != "" {
			out = append(out, p)
		}
	}
	return out
}

func badRequest(c echo.Context, msg string) error {
	return c.JSON(http.StatusBadRequest, model.APIErrorResponse{
		Error: model.APIError{Code: "invalid_request", Message: msg},
	})
}
