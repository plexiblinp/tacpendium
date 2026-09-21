package main

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	healthapi "github.com/plexiblinp/tacpendium/internal/api/health"
)

// healthProbeTimeout は既存インスタンスの確認にかける上限。
//
// ★短く保つ。⇒ 起動のたびに必ず 1 回通る経路であり、ここで待たせると
// 「ダブルクリックしてから画面が出るまで」がそのぶん伸びる。
const healthProbeTimeout = 700 * time.Millisecond

// notifyTitleAlreadyRunning は既存インスタンスの画面を開けなかったときの表題。
const notifyTitleAlreadyRunning = "Tacpendium は既に起動しています"

// detectRunningInstance は「同じアプリが既にそのポートで動いているか」を確かめ、
// 動いていればその画面の URL を返す(M34-02 段 6 / M34-overview §4.4)。
//
// ★★常駐化すると二重起動が起きる ————————————————————————————————————————
// 黒窓が無いので「もう起動している」ことに気づきにくく、利用者はもう一度
// ダブルクリックする。★着手前の挙動では L-04 のポート探索が働いて 2 つ目の
// インスタンスが別ポートで上がり、同じ DB を 2 プロセスで開くことになっていた。
// ⇒ 既存を見つけたら、その画面を開いて後から起動した側は退く。
//
// ★★誤判定を避けるために 3 つを要求する(同 §4.4 の危険) ——————————————————
// (1) GET /api/health が 200 を返すこと。★同ルートは認証の素通し対象である。
// (2) 本体の応答型と厳密に一致すること(status / version の 2 キーのみ。
// 未知のキーを許さない)。⇒ 別のソフトがそのポートを使っていたときに、
// 偶然 200 を返しただけで「同じアプリ」と読まないため。
// (3) status が "ok" で version が空でないこと。
//
// ★残る限界を隠さない —— 応答にアプリ名が入っていないため、同じ 2 キーだけを返す
// 別のソフトがそのポートに居た場合は区別できない。⇒ /api/health へ識別子を足すのは
// API 契約の変更(CHANGE)であり、本サブでは踏み込まない。完了報告 §7 の候補へ回す。
func detectRunningInstance(port int) (bool, string) {
	url := localAppURL(port)
	ctx, cancel := context.WithTimeout(context.Background(), healthProbeTimeout)
	defer cancel()
	client := &http.Client{Timeout: healthProbeTimeout}
	if tacpendiumRespondsAt(ctx, client, url) {
		return true, url
	}
	return false, ""
}

// tacpendiumRespondsAt は baseURL に本体が居るかを判定する。
// ★baseURL は末尾 "/" 付きの http://host:port/ 形式(localAppURL の形)。
func tacpendiumRespondsAt(ctx context.Context, client *http.Client, baseURL string) bool {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, baseURL+"api/health", nil)
	if err != nil {
		return false
	}
	resp, err := client.Do(req)
	if err != nil {
		// 接続できない = 誰も居ない(通常の起動)。
		return false
	}
	defer func() {
		// 応答は捨てるが、読み切らずに閉じるとコネクションが再利用できない。
		_, _ = io.Copy(io.Discard, io.LimitReader(resp.Body, 1<<10))
		_ = resp.Body.Close()
	}()
	if resp.StatusCode != http.StatusOK {
		return false
	}

	// ★★デコード先は実物の応答型そのものである(レビュー指摘 中-10) ——————————
	// 手書きの匿名構造体で写すと、healthapi.Response にフィールドが 1 つ増えた瞬間に
	// DisallowUnknownFields が**自分自身の応答**を弾き、二重起動の判別が黙って
	// 無効化する。★実物の型を使えば、その変更はコンパイル単位で結び付く。
	// ⇒ あわせて TestTacpendiumRespondsAt_UsesTheRealHealthHandler が実ハンドラの
	// 応答で固定する。
	var body healthapi.Response
	dec := json.NewDecoder(io.LimitReader(resp.Body, 1<<12))
	dec.DisallowUnknownFields()
	if err := dec.Decode(&body); err != nil {
		return false
	}
	return body.Status == "ok" && body.Version != ""
}

// openExistingInstance は既存インスタンスの画面を開く。
//
// ★利用者へのフィードバックは「既存の画面が開くこと」そのものである。⇒ 正常な結果
// なので MessageBox は出さない。★開けなかったときだけ伝える(黙って終わると
// 「ダブルクリックしても何も起きない」になる)。
func openExistingInstance(url string) {
	if err := desktopOpenURL(url); err != nil {
		notifyProblem(notifyTitleAlreadyRunning, fmt.Errorf("%s を開けませんでした: %w", url, err))
	}
}
