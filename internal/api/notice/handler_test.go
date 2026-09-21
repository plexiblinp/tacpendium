package notice_test

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"testing"
	"time"

	"github.com/labstack/echo/v4"

	noticeapi "github.com/plexiblinp/tacpendium/internal/api/notice"
	"github.com/plexiblinp/tacpendium/internal/infra/datadir"
)

func newRequest(t *testing.T, h *noticeapi.Handler, method, path string) *httptest.ResponseRecorder {
	t.Helper()
	e := echo.New()
	req := httptest.NewRequest(method, path, nil)
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)
	var err error
	if method == http.MethodGet {
		err = h.Get(c)
	} else {
		err = h.Ack(c)
	}
	if err != nil {
		t.Fatalf("handler: %v", err)
	}
	return rec
}

func writeNotice(t *testing.T, dir string) {
	t.Helper()
	n := datadir.Notice{
		Status:  datadir.StatusMigrated,
		Message: "データの保存場所を移しました",
		From:    filepath.Join(dir, "..", "combomgr"),
		To:      dir,
		At:      time.Date(2026, 9, 5, 0, 0, 0, 0, time.UTC),
	}
	if err := datadir.WriteNotice(dir, n); err != nil {
		t.Fatalf("WriteNotice: %v", err)
	}
}

func TestGet_NoNoticeReturns204(t *testing.T) {
	rec := newRequest(t, noticeapi.NewHandler(t.TempDir()), http.MethodGet, "/api/notices/data-migration")
	if rec.Code != http.StatusNoContent {
		t.Errorf("code = %d, want 204", rec.Code)
	}
}

func TestGet_ReturnsNoticeOnce(t *testing.T) {
	dir := t.TempDir()
	writeNotice(t, dir)
	h := noticeapi.NewHandler(dir)

	rec := newRequest(t, h, http.MethodGet, "/api/notices/data-migration")
	if rec.Code != http.StatusOK {
		t.Fatalf("code = %d, want 200", rec.Code)
	}
	var body map[string]any
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if body["status"] != "migrated" {
		t.Errorf("status = %v", body["status"])
	}
	// ★JSON タグは camelCase(CLAUDE.md §4)。
	if _, ok := body["retireFailed"]; !ok {
		t.Error("retireFailed が camelCase で出ていない")
	}

	// 閉じたら以後は出ない ——「1 度だけ」を再起動をまたいで満たすため、
	// メモリではなくデータディレクトリ直下のファイルで持つ。
	if rec := newRequest(t, h, http.MethodPost, "/api/notices/data-migration/ack"); rec.Code != http.StatusNoContent {
		t.Fatalf("ack code = %d, want 204", rec.Code)
	}
	if rec := newRequest(t, h, http.MethodGet, "/api/notices/data-migration"); rec.Code != http.StatusNoContent {
		t.Errorf("閉じた後も告知が出ている: code = %d", rec.Code)
	}
	// 別の Handler(＝再起動相当)でも出ない。
	if rec := newRequest(t, noticeapi.NewHandler(dir), http.MethodGet, "/api/notices/data-migration"); rec.Code != http.StatusNoContent {
		t.Errorf("再起動後に告知が復活している: code = %d", rec.Code)
	}
}

func TestNoticeFor_SkipsQuietCases(t *testing.T) {
	if _, ok := datadir.NoticeFor(datadir.Result{Status: datadir.StatusSkipped, Reason: datadir.ReasonNoLegacyDir}); ok {
		t.Error("移行が要らなかった起動で告知を出している")
	}
	// ★旧が残っているのに移行していない状態は黙っていてはいけない。
	if _, ok := datadir.NoticeFor(datadir.Result{Status: datadir.StatusSkipped, Reason: datadir.ReasonNewDBExists}); !ok {
		t.Error("新旧の両方が在る状態を黙って飛ばしている")
	}
	if _, ok := datadir.NoticeFor(datadir.Result{Status: datadir.StatusFailed}); !ok {
		t.Error("検証に失敗したことを利用者へ伝えていない")
	}
}

// ★★閉じた告知が、次の起動で復活しないこと(中-1)。
//
// 経路 b / d は移行が完了しないので起動のたびに同じ告知が作られる。
// 無条件に上書きすると Acknowledged が毎回 false へ戻り、閉じたバナーが必ず復活する。
func TestUpsertNotice_KeepsAcknowledgementAcrossBoots(t *testing.T) {
	dir := t.TempDir()
	boot := func(at time.Time) datadir.Notice {
		return datadir.Notice{
			Status:  datadir.StatusSkipped,
			Reason:  datadir.ReasonNewDBExists,
			Message: "移行先に既存のデータがあるため移行しません",
			From:    "/old",
			To:      "/new",
			At:      at,
		}
	}
	if err := datadir.UpsertNotice(dir, boot(time.Date(2026, 9, 5, 1, 0, 0, 0, time.UTC))); err != nil {
		t.Fatal(err)
	}
	if err := datadir.AckNotice(dir, time.Now()); err != nil {
		t.Fatal(err)
	}

	// 2 回目の起動。At だけが違う同じ状況。
	if err := datadir.UpsertNotice(dir, boot(time.Date(2026, 9, 6, 9, 30, 0, 0, time.UTC))); err != nil {
		t.Fatal(err)
	}
	n, ok, err := datadir.ReadNotice(dir)
	if err != nil || !ok {
		t.Fatalf("ReadNotice: %v / ok=%v", err, ok)
	}
	if !n.Acknowledged {
		t.Fatal("閉じた告知が次の起動で復活している")
	}
	if rec := newRequest(t, noticeapi.NewHandler(dir), http.MethodGet, "/api/notices/data-migration"); rec.Code != http.StatusNoContent {
		t.Errorf("閉じた告知が API から返っている: code = %d", rec.Code)
	}
}

// 状況が変われば新しい告知として出す(閉じたまま握り潰さない)。
func TestUpsertNotice_NewSituationReappears(t *testing.T) {
	dir := t.TempDir()
	if err := datadir.UpsertNotice(dir, datadir.Notice{Status: datadir.StatusSkipped, Reason: datadir.ReasonNewDBExists, Message: "a"}); err != nil {
		t.Fatal(err)
	}
	if err := datadir.AckNotice(dir, time.Now()); err != nil {
		t.Fatal(err)
	}
	if err := datadir.UpsertNotice(dir, datadir.Notice{Status: datadir.StatusFailed, Message: "b"}); err != nil {
		t.Fatal(err)
	}
	n, _, err := datadir.ReadNotice(dir)
	if err != nil {
		t.Fatal(err)
	}
	if n.Acknowledged || n.Status != datadir.StatusFailed {
		t.Errorf("状況が変わったのに新しい告知が出ていない: %+v", n)
	}
}

// ★★条件 (b): 検証に失敗した告知は、閉じても次の起動でまた出る。
//
// 設計卓の裁定（2026-09-05）の逐語＝「規則 5 の『1 度だけ』は成功時の話です。
// 失敗時は毎回出してください。1 度だけだと、利用者は旧のまま動き続けていることに
// 気づけません」。
func TestUpsertNotice_FailureReappearsAfterAck(t *testing.T) {
	dir := t.TempDir()
	boot := func(at time.Time) datadir.Notice {
		return datadir.Notice{
			Status:  datadir.StatusFailed,
			Reason:  datadir.ReasonVerifyFailed,
			Message: "データの移行を検証できなかったため、何も移動せずに中止しました",
			From:    "/old",
			To:      "/new",
			At:      at,
		}
	}
	if err := datadir.UpsertNotice(dir, boot(time.Date(2026, 9, 5, 1, 0, 0, 0, time.UTC))); err != nil {
		t.Fatal(err)
	}
	if err := datadir.AckNotice(dir, time.Now()); err != nil {
		t.Fatal(err)
	}
	// 2 回目の起動。まだ失敗している。
	if err := datadir.UpsertNotice(dir, boot(time.Date(2026, 9, 6, 9, 0, 0, 0, time.UTC))); err != nil {
		t.Fatal(err)
	}
	n, ok, err := datadir.ReadNotice(dir)
	if err != nil || !ok {
		t.Fatalf("ReadNotice: %v / ok=%v", err, ok)
	}
	if n.Acknowledged {
		t.Fatal("失敗の告知が閉じたまま残っている。旧のまま動き続けていることに気づけない")
	}
	if rec := newRequest(t, noticeapi.NewHandler(dir), http.MethodGet, "/api/notices/data-migration"); rec.Code != http.StatusOK {
		t.Errorf("失敗の告知が API から返っていない: code = %d", rec.Code)
	}
}

// ★データが取り残されている告知も、閉じても次の起動でまた出る。
func TestUpsertNotice_StrandedReappearsAfterAck(t *testing.T) {
	dir := t.TempDir()
	n := datadir.Notice{
		Status:  datadir.StatusSkipped,
		Reason:  datadir.ReasonOldDataStranded,
		Message: "いま開いているデータは空です",
	}
	if err := datadir.UpsertNotice(dir, n); err != nil {
		t.Fatal(err)
	}
	if err := datadir.AckNotice(dir, time.Now()); err != nil {
		t.Fatal(err)
	}
	if err := datadir.UpsertNotice(dir, n); err != nil {
		t.Fatal(err)
	}
	got, _, err := datadir.ReadNotice(dir)
	if err != nil {
		t.Fatal(err)
	}
	if got.Acknowledged {
		t.Fatal("取り残しの告知が閉じたまま残っている。開いているのが空の DB だと気づけない")
	}
}

// ★対照: 移行できた／新旧の両方が在る（良性）は、閉じたら二度と出ない。
// 旧を消すのは開発者の手番(D-196)であり、先送りしている作業を毎起動で催促しない。
func TestUpsertNotice_ResolvedStatesStayAcknowledged(t *testing.T) {
	for _, tc := range []struct {
		name   string
		notice datadir.Notice
	}{
		{"移行できた", datadir.Notice{Status: datadir.StatusMigrated, Message: "移しました", RetiredTo: "/old.migrated-20260905"}},
		{"新旧の両方(良性)", datadir.Notice{Status: datadir.StatusSkipped, Reason: datadir.ReasonNewDBExists, Message: "移行しません"}},
	} {
		t.Run(tc.name, func(t *testing.T) {
			dir := t.TempDir()
			if err := datadir.UpsertNotice(dir, tc.notice); err != nil {
				t.Fatal(err)
			}
			if err := datadir.AckNotice(dir, time.Now()); err != nil {
				t.Fatal(err)
			}
			if err := datadir.UpsertNotice(dir, tc.notice); err != nil {
				t.Fatal(err)
			}
			got, _, err := datadir.ReadNotice(dir)
			if err != nil {
				t.Fatal(err)
			}
			if !got.Acknowledged {
				t.Error("解決済みの告知が復活している。先送りしている作業を毎起動で催促することになる")
			}
		})
	}
}

// API が reason を返すこと（画面が良性形と危険形を出し分けるのに要る）。
func TestGet_ExposesReason(t *testing.T) {
	dir := t.TempDir()
	if err := datadir.WriteNotice(dir, datadir.Notice{
		Status:  datadir.StatusSkipped,
		Reason:  datadir.ReasonOldDataStranded,
		Message: "いま開いているデータは空です",
	}); err != nil {
		t.Fatal(err)
	}
	rec := newRequest(t, noticeapi.NewHandler(dir), http.MethodGet, "/api/notices/data-migration")
	if rec.Code != http.StatusOK {
		t.Fatalf("code = %d, want 200", rec.Code)
	}
	var body map[string]any
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatal(err)
	}
	if body["reason"] != "old_data_stranded" {
		t.Errorf("reason = %v, want old_data_stranded", body["reason"])
	}
}
