# M7-06 レビュー報告書

## 総評

embed 配信の根幹（SPA フォールバック・/api 非干渉・build タグ分離・起動 UX）に加え、追補 A-2（設定画面 LAN トグル）・A-1（起動案内 stdout 出力）もすべて設計準拠で正しく実装されており、**重大な問題（完了承認を妨げるもの）は発見されなかった**。最重要の落とし穴と指示書が再三強調していた「/api/* を SPA フォールバックに飲ませない」点は二重保護で担保。A-2 は `window.confirm` なし・AlertDialog ベース・ウィザードと同一永続化経路で DES-002 §3.4 を遵守。A-1 は専用関数 `printStartupNotice` に集約され、CLAUDE.md §10 の「散発的 fmt.Println 禁止」の趣旨に反していない。`go test ./...`（cmd/combomgr 含む）/ `pnpm test`（81 ファイル 439 件）全パス。指摘事項は小項目のみ。

---

## 設計準拠性レビュー結果

### §1 SPA フォールバック + ルーティング（最重要）◎

- `/api` と `/api/` プレフィックスの両方を catch-all より先に 404 返却。未登録 API パス（`/api/does-not-exist`）も index.html を返さないことをテストで確認。
- 実 API ルートは `e.Group("/api")` で具体ルートとして先に登録 → catch-all `/*` より優先。さらに catch-all 内部の `/api` チェックが二重安全網。
- React Router 直 URL（`/combos/123` 相当）が index.html フォールバックを返すことをテストで確認。
- `/assets/` 欠落ファイルは 404（index.html を返さない）をテストで確認。
- `path.Clean` + `embed.FS` のパス検証（`/` 始まり不可）でパストラバーサルを多層防御。

### §2 同一オリジン化 + dev proxy 両立 ◎

- `web/src/lib/api-client.ts` の `API_BASE=""` は変更なし。embed 同一オリジン・Vite dev proxy 双方で成立済み。
- CORS ミドルウェアは固定許可リスト・ワイルドカードなし。同一オリジン配信で過剰な CORS 許可が残らない（ヘッダ付与のみ、有害でない）。
- `vite.config.ts` の dev proxy 追従ロジック（M7-05）は温存されており dev 構成は変更なし。

### §3 静的アセット MIME / キャッシュ ◎

- `/assets/`（フィンガープリント付き）: `public, max-age=31536000, immutable`。
- `index.html`: `no-cache`。
- Content-Type: `mime.TypeByExtension` で拡張子から推定。`http.ServeContent` が既存 Content-Type を上書きしない仕様のため二重設定なし。JS/CSS MIME のテストが通過（`text/javascript` 含有確認）。
- `embed.FS` のファイルは `ModTime()` がゼロ値のため `Last-Modified` ヘッダは設定されないが、immutable/no-cache 戦略のもとでは実害なし。

### §4 dev / embed 両立方式 ◎

- `//go:build embed_web` / `//go:build !embed_web` の build タグ分離。既存の `-tags=debug` と同一イディオム。
- `embed_web_stub.go` により `web/dist` 不在・空でも `go build` / `go test` / `go run` が成功（stub が nil を返し、`if combomgr.WebEmbedded` で分岐）。
- `embed_web_release.go` の冒頭コメントで dev/embed 区別を明記（開発者方針遵守）。
- `//go:embed all:web/dist`: `_` や `.` 始まりファイルを含む（指示書 §4.1 の `all:` 考慮）。

### §5 起動 UX（NFR303/304、DES-002 §11.1）◎

- `launchBrowser(actualPort)` を goroutine で実行 → サーバー起動をブロックしない設計。
- L-04 実ポートを正確に引数に受け取り自動起動 URL に使用。ポートフォールバック発生時も追従。
- `browser.OpenURL` 失敗時は `slog.Warn` + URL をログ出力 → 利用者が実ポートを知らなくても案内あり（NFR303/304 の「exe 起動だけで使える」要件を充足）。
- `github.com/pkg/browser`（BSD-2-Clause）は DES-002 §11.1 で指定済み・設計承認済み。

### §6 クロスコンパイル + 配布物 ◎

- Makefile に `build-windows`（GOOS=windows GOARCH=amd64）、`build-darwin`（arm64）、`build-linux`（amd64）、`build-all` を追加。全て `CGO_ENABLED=0`（modernc.org/sqlite = 純 Go のためクロスコンパイル可能）。
- 出力先 `dist/` は `.gitignore` 済み。
- progress log の検証記録: windows/amd64・darwin/arm64・linux/amd64 コンパイル成立を確認。
- `README.txt` に起動方法・実ポート案内・LAN モード設定・データ保存場所・注意事項を記載。

### §7 既存非破壊・スキーマ非変更 ◎

- `go test ./...`（static ハンドラ含む）全パス、`go vet` クリーン確認済み。
- スキーマ変更なし（embed は配信層の追加のみ）。
- 既存 API の挙動変更なし（API ルート登録順・ハンドラ実装の変更なし）。

### §8 配布構成検証 ○（一部開発者実施待ち）

- 単一バイナリ起動 + curl スモーク（GET / → 200/no-cache/html、/combos/123 → 200 フォールバック、/api/health → 200 JSON、/api/does-not-exist → 404、/assets/*.js → 200/immutable/text/javascript、/assets/missing.js → 404、/api/config → 200）: progress log に合格記録あり。
- `m7-integration-e2e-results.md` F-5 手順を配布構成（embed 単一バイナリ + 実ポート直アクセス）に整合（M7-05 Q3 保留分の解消を確認）。
- **スマホ LAN 実機検証（U-1）は開発者実施待ち**（コード上判定不能。手順整備は適切に完了）。

---

---

## 追補 A-2: 設定画面 LAN 共有モード切替トグル

### 切替実装（表示のみでない）◎

`SettingsSectionNetwork.tsx` の `Switch` コンポーネントが `handleToggle` → `applyMode` → `useUpdateConfig.mutate({ server: { mode } })` を呼ぶ。`PUT /api/config` 経由で実際に config.toml に書き込まれる。表示のみの実装ではない。

### 確認ダイアログ（DES-002 §3.4 遵守）◎

LAN 有効化（`next === true`）時のみ `LanModeConfirmDialog` を表示し `applyMode` は呼ばない。`LanModeConfirmDialog` は `AlertDialog`（M7-05 で AlertDialog 化済みの仕組み）を使用。`window.confirm` の新規持込なし（grep 確認済み）。ダイアログに公開ポート番号 `port={config.server.port}` を渡しており DES-002 §3.4 の「接続可能になるポート番号を明示」を充足。LAN 無効化（local 化）は確認なしで即時適用（露出を減らす操作のため DES-002 §3.4 と整合）。

### restartRequired 表示 ◎

`applyMode` の `onSuccess` で `data.restartRequired === true` なら `t("settings.basic.restartRequired")` をトースト表示。ウィザードと同じ扱いで UI に明示される。

### 永続化経路（ウィザードと同一）◎

`useUpdateConfig`（`useMutation` → `configApi.update` → `PUT /api/config`）を再利用。ウィザード Step05（server.mode）と完全に同一の経路。独自の永続化経路なし。

### テスト ◎

`SettingsSectionNetwork.test.tsx` に 4 ケース:
- local→LAN: 確認ダイアログ表示、即時 mutate なし
- 確認「有効にする」: `{ server: { mode: "lan" } }` で mutate
- 確認「キャンセル」: mutate なし
- LAN→local: 確認なしで即時 `{ server: { mode: "local" } }` を mutate

---

## 追補 A-1: 起動時案内の stdout 出力

### 専用関数として実装 ◎

`printStartupNotice(w io.Writer, mode string, port int, lanIPs []net.IP)` として独立。`cmd/combomgr/main.go` 内の `fmt.Print*` 系呼び出しは **この関数内の `fmt.Fprintln/Fprintf(w, ...)`** と、エントリポイントの `fmt.Fprintf(os.Stderr, "fatal: %v\n", err)`（fatal エラーの stderr 出力、正当）のみ。各所に散発した `fmt.Println` なし（grep 確認済み）。

### 出力内容 ◎

- PC URL: `http://localhost:<実ポート>/`（常時）
- lan モード時: 全 LAN IP の URL 一覧（複数 NIC 環境で利用者が正しい IP を選べる）+ FW/AV ヒント（Windows Defender Firewall + サードパーティ製セキュリティソフト例: Norton）
- IP 未検出時: クラッシュせずにその旨と FW ヒントを案内

### 実ポート追従 ◎

`actualPort`（L-04 で確定した実ポート）を引数に受け取る。固定ポート決め打ちなし。

### slog 運用ログの維持 ◎

`logLANAccessGuide`（slog.Info で LAN URL をファイルログへ記録）と `launchBrowser`（slog.Info/Warn でブラウザ起動ログ）は変更なく維持。`printStartupNotice` はそれとは別の「ユーザー向け CLI UX 出力」として stdout に書く二軸構成。ファイルログを壊していない。

### CLAUDE.md §10 趣旨遵守 ◎

「デバッグ出力の混入」なし。利用者向け起動案内に限定した意図的な stdout 出力であり、運用ログや散発的デバッグ出力ではない旨がコメントに明記されている。

### テスト ◎

`cmd/combomgr/main_test.go` に 3 ケース（`io.Writer` を引数に受け出力内容を検証）:
- local モード: PC URL あり、LAN/FW 行なし
- lan モード IP あり: PC URL・全 LAN URL・FW ヒント・Norton 言及あり + 実ポート追従
- lan モード IP なし: IP 未検出メッセージあり・FW ヒントあり

### 軽微な観察

`lanIPs, _ = netutil.ListPrivateIPv4()`（main.go:222）のエラーを `_` で破棄している。`printStartupNotice` 内の「IP 未検出」フォールバックがあるため実害はないが、エラー内容を `slog.Warn` に記録してもよかった（持ち越し許容）。

---

## 追補 既存非破壊・スコープ確認

- `go test ./...`（cmd/combomgr 含む新規テスト含む）: 全パス確認。
- `pnpm test`（SettingsSectionNetwork.test.tsx 含む）: 81 ファイル 439 件全パス確認。
- dev 構成（Vite + proxy）: 変更対象外のため継続動作を確認。
- スキーマ変更なし: A-1/A-2 はいずれも配信・UI・stdout 出力層の追加のみ。
- スコープ外への着手なし: A-1・A-2 以外の新機能追加は確認されず。

---

## 設計準拠性以外の指摘事項

### [軽微-1] HEAD テストが未作成

`internal/api/static/handler.go` は `e.HEAD("/*", h.serve)` を登録しているが、`handler_test.go` に HEAD メソッドのテストケースが存在しない。`http.ServeContent` が HEAD を適切に処理する仕様ではあり実害は低いが、意図を明示するテストがあるほうが望ましい。

### [軽微-2] progress log のテストケース数の誤記

`progress-log.md` の M7-06 節に「7ケース」と記載されているが、`handler_test.go` の実際のテスト関数は 6 つ（`TestRoot_ServesIndexNoCache` / `TestClientRoute_FallsBackToIndex` / `TestAPIRoute_NotSwallowed` / `TestUnknownAPIRoute_Returns404` / `TestAsset_ServedWithImmutableCacheAndMIME` / `TestMissingAsset_Returns404`）。ドキュメント上の軽微な誤記。

### [軽微-3] `pkg/browser` の更新日付

`go.mod` で採用しているバージョン `v0.0.0-20240102092130-5ac0b6a4141c`（2024-01-02 タイムスタンプ）は、`CLAUDE.md §6` の「最終更新が 2 年以上前は原則不使用」から 2026-06-06 時点で約 2 年 5 ヶ月が経過している。ただし DES-002 §11.1 で明示指定されており設計承認済みであるため、今回の採用は正当。後続フェーズの依存ライブラリ棚卸し時に代替を検討しておくとよい。

### [情報-4] `README.txt` のデータ保存場所の記述

「実行ファイル付近の SQLite データベース」という表現は DES-002 §6.1（OS アプリデータディレクトリへの配置）と比べて曖昧。現行実装での実際のデータ保存先確認は設計担当スコープ。

### [情報-5] `build-debug` は embed_web を含まない

`Makefile` の `build-debug` は `-tags=debug` のみ（embed なし）。debug + embed_web 両立ターゲットは存在しない。progress log に「据え置き」と明示されており意図的。将来 debug 機能を配布構成で使いたい場合はターゲット追加が必要。

---

## 推奨修正（優先度別）

- **高（M7 完了前に修正必須）**: なし。

- **中（M8 着手と並行可）**: [軽微-1] HEAD テストの追加を検討。

- **低（将来対応）**: [軽微-2] progress log のテストケース数を 7→6 に修正。[軽微-3] pkg/browser の更新確認を依存ライブラリ棚卸し時に実施。[軽微-A1] `lanIPs, _ = netutil.ListPrivateIPv4()` のエラーを slog.Warn に記録することを検討。

---

## 良かった点

1. **SPA フォールバックの /api 除外が二重保護で確実**: echo ルーティング優先順序 + handler 内明示チェックの組み合わせが堅牢。コメントも「最重要の落とし穴」と明記されており意図が明確。
2. **build タグ分離が既存イディオムと一貫**: `-tags=debug` と同じイディオムで dev/embed を分離。両ファイル冒頭のコメントが区別の意図を説明しており可読性が高い。
3. **ブラウザ自動起動の goroutine + エラーハンドリング**: サーバー起動をブロックせず、失敗時も URL 案内で利用者が詰まらない設計。NFR303/304 の UX 要件を満たしている。
4. **`fstest.MapFS` を使ったシンプルなテスト**: 実運用のルーティング順序（API → catch-all）を再現しつつ、embed.FS なしで常時実行できるテスト構成が優秀。
5. **CORS 無変更の判断**: 同一オリジン配信での CORS ミドルウェアの影響を正確に評価し「変更不要」と判断。不必要な変更を加えなかったことがスコープ厳守につながっている。
6. **配布物 README.txt の質**: ポートフォールバック・ブラウザ自動起動の案内・LAN モード切り替え手順が利用者視点で具体的かつ簡潔に書かれている。
7. **A-2: `io.Writer` を引数に持つ `printStartupNotice` 設計**: テスト可能な設計で、`bytes.Buffer` を使った 3 ケースが実ポート追従・FW ヒント・IP 未検出を確実に検証している。
8. **A-2: LAN トグルの AlertDialog 選択**: `window.confirm` に退行せず M7-05 で整備済みの AlertDialog 仕組みを再利用。DES-002 §3.4 のポート番号明示要件も port prop で充足しており設計への準拠が正確。

---

## 制約事項

- 本レビューはコード上で判定可能な範囲のみ対象。実際の動作確認（配布バイナリ起動・PCブラウザ全機能スモーク・スマホLAN実機検証）は別途開発者実施が必要。
- クロスビルド成果物の実機起動（Windows 公式、macOS/Linux 非公式）は progress log 記載の「ビルドコンパイル成立」の範囲のみコード上確認。実機での起動・配信確認は開発者実施が必要。
