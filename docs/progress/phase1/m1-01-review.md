# M1-01 レビュー報告書

| 項目 | 内容 |
|------|------|
| レビュー対象 | M1-01(プロジェクト骨格・基盤構築) |
| 対象指示書 | `docs/instructions/M1-01-project-skeleton.md` v1.1.0 |
| レビューチェックリスト | `docs/instructions/M1-01-review-checklist.md` v1.0.0 |
| レビュー日 | 2026-04-30 |
| レビュー担当 | 品質レビュー Claude(Opus 4.7) |
| 対象コミット範囲 | feature/m1-core-foundation 上の作業ツリー(未コミット差分含む) |

---

## 総評

M1-01 の成果物は、指示書 §2 のファイル一覧・§4 の詳細仕様・§5 のテスト要件を概ね高い忠実度で満たしている。CORS 実装は SUPP-001 §2.6.1 が禁ずる「リクエスト時動的判定」「ワイルドカード許可」「全プライベート IP 許可」をいずれも回避し、起動時固定リストとして実装されており、本指示書の最重要ポイントを正確に押さえている。ロギング初期化(slog + lumberjack、ローテーション値)、設定読込(BurntSushi/toml + 環境変数上書き + バリデーション)、`netutil` の代表 IP 選定ロジックも設計書通り。テスト網羅性も指示書要件を全て満たしている。中位の指摘として「VirtualBox 既定 192.168.56.0/24 の優先度降格」が未実装である点(SUPP-001 §2.6.2)、軽微な指摘として README の必要 Go バージョン表記揺れがあるが、いずれも M1 完了をブロックしない。後続(M1-02〜)の土台として安全に着手可能と判断する。

---

## 設計準拠性レビュー結果

| チェック項目 | 結果 | 詳細 |
|-------------|------|------|
| SUPP-001 §5.2 Go パッケージ構成 | ◎ | `cmd/combomgr/`、`internal/{api,service,repository,model,config,infra}/` および各ドメイン別サブパッケージが SUPP-001 §5.2 の図と一致。`internal/api/health/` は指示書 §2.1 で明示要求(設計書には不在のため拡張)。`internal/infra/log/` も指示書 §4.5 が許容するパターン。`migrations/` は M1-02 担当のため未作成で正しい。 |
| SUPP-001 §5.3 フロントエンド構成 | ○ | `web/src/{pages,lib,locales,types}/`、`App.tsx`、`main.tsx`、`router.tsx` 等は指示書 §2.2 通り作成済み。SUPP-001 §5.3 が掲げる `features/`、`components/`、`layouts/`、`lib/utils.ts` は M1-01 段階では不要(後続指示書で追加)であり指示書 §2.2 にも記載がないため、現段階での未作成は規約違反ではない。`prototypes/` は M0 成果物として残置されている前提。 |
| SUPP-001 §5.6 ロギング戦略 | ◎ | `internal/infra/log/log.go` で `lumberjack.Logger` の MaxSize/MaxBackups/MaxAge を `cfg` から取り、Compress=false 固定。debug 時のみ `io.MultiWriter(os.Stdout, rotator)` で標準出力へも出力し `slog.NewTextHandler` を使用、それ以外は `slog.NewJSONHandler` のファイル出力のみ。SUPP-001 §5.6 の指針と完全一致。 |
| SUPP-001 §5.8 設定ファイルフォーマット | ◎ | `[server]/[database]/[logging]/[security]` の 4 セクションを TOML タグ付き構造体で定義。`config.toml.example` も SUPP-001 §5.8 のサンプルとフィールド名・既定値が一致(`port = 47318`、`max_size_mb = 10` 等)。`Default()` がフォールバック値を返し、ファイル不在時にエラーにせず継続する挙動も §4.4 の要件通り。 |
| SUPP-001 §2.6.1 CORS 実装方針 | ◎ | `cmd/combomgr/main.go` の `buildAllowedOrigins()` が起動時に 1 回だけ実行され、結果を `internal/api/middleware.CORS()` のクロージャ内 `map[string]struct{}` にキャッシュ。リクエスト時に NIC を再列挙する処理は皆無。`mode=local` では `http://localhost:<port>` と `http://127.0.0.1:<port>` のみ、`mode=lan` ではこれに `SelectPrimaryLANIP()` の代表 IP 1 つを追加。ワイルドカード `*` の使用なし。完全一致比較で許可外 Origin には CORS ヘッダを付けない。 |
| SUPP-001 §2.6.2 仮想 NIC 除外パターン | ○ | 12 パターン(`docker`、`veth`、`br-`、`vEthernet`、`tailscale`、`tun`、`tap`、`vmnet`、`vboxnet`、`utun`、`ppp`、`zt`)を `virtualPrefixes` に定義し、大文字小文字非依存で判定。SUPP-001 §2.6.2 の列挙と完全一致。**ただし** SUPP-001 §2.6.2 が要求する「VM/コンテナ用と判明している範囲(`192.168.56.0/24` VirtualBox 既定、`172.17.0.0/16`〜`172.31.0.0/16` Docker 既定)は除外せず優先度最下位まで落とす」のうち、172.17-31 は元から最下位(prio172)なので結果一致するが、`192.168.56.0/24` は他の 192.168 と同列(prio192)で最高優先度になる。VirtualBox 既定環境で誤った代表 IP が選ばれ得る。中レベル指摘として後述。 |

---

## コード品質レビュー結果

| チェック項目 | 結果 | 詳細 |
|-------------|------|------|
| エラーラップ `fmt.Errorf("...: %w", err)` | ◎ | `cmd/combomgr/main.go`、`internal/config/config.go`、`internal/infra/log/log.go`、`internal/infra/netutil/private_ip.go` のすべての error path で `%w` ラップを徹底。 |
| `context.Context` 第一引数 | ○ | M1-01 ではサービス層が空(doc.go のみ)のため適用対象が事実上ない。`Logger` ミドルウェアは `req.Context()` を `slog.LogAttrs` に渡しており取り扱いは妥当。 |
| 公開関数の godoc | ◎ | `Load`、`Default`、`Init`、`IsVirtualInterface`、`IsPrivateIPv4`、`ListPrivateIPv4`、`SelectPrimaryLANIP`、`CORS`、`Logger`、`RequestID`、`Handler` などすべての公開シンボルに用途・参照節・挙動が日本語で簡潔に記載。 |
| `panic` の不使用 | ◎ | `internal/`、`cmd/` 配下に `panic(` の実装なし(`grep` で 0 件)。fatal 時は `run() error` 経由で `os.Exit(1)` に集約。 |
| TypeScript strict・`any` 不使用 | ◎ | `web/tsconfig.json` で `"strict": true`、`noUnusedLocals`、`noUnusedParameters`、`noFallthroughCasesInSwitch` 全て有効。`web/src/` 全体で `any`/`as any`/`<any>` の出現 0 件。 |
| ブラウザストレージ API 不使用 | ◎ | `localStorage`、`sessionStorage`、`IndexedDB` の出現 0 件。 |

### コード品質の追加所見

- `internal/api/middleware/cors.go`: 許可リストを `map[string]struct{}` に展開して O(1) 判定。OPTIONS では `Access-Control-Request-Headers` が来ていればエコーバックし、無ければ既定値を返す堅実な実装。`Vary: Origin` も付与しており CDN/プロキシキャッシュ汚染の予防が効いている。
- `internal/api/middleware/logger.go`: `crypto/rand` で 16byte の hex を採番し、`google/uuid` の依存追加を回避(指示書 §4.2「M1-01 では UUID ライブラリを追加しない」を厳守)。失敗時のフォールバックも持つ。
- `cmd/combomgr/main.go`: lan モードで LAN IP 取得失敗時に「config.toml の mode を local に戻すか、ネットワーク接続を確認」と明示する日本語エラーメッセージを返しており、運用者に優しい。
- `internal/config/config.go`: TOML デコード後に `validate()` でモード値・ポート範囲を検査、不正値は起動を止める。`COMBOMGR_LOG_LEVEL` が空文字のときに上書きしないガード(`strings.TrimSpace(v) != ""`)も適切。
- `web/src/pages/HealthCheckPage.tsx`: `cancelled` フラグで unmount 後の `setState` を抑止。`err instanceof Error` 判定で型安全。

---

## 完成度レビュー結果

| チェック項目 | 結果 | 詳細 |
|-------------|------|------|
| `make run-server` 起動可能性 | ○ | `Makefile` に `run-server: go run ./cmd/combomgr` あり。`main.run()` が config 読込→ロガー初期化→Echo 起動の順で組まれており、コードレビュー上は起動可能と判断。実機検証は別途。 |
| `make run-web` 起動可能性 | ○ | `Makefile` に `run-web: cd web && npm run dev` あり。`web/package.json` に `"dev": "vite"`、`vite.config.ts` で port=5173・`/api` プロキシ設定済み。`npm install` 後に起動可能と推定。 |
| HealthCheckPage の OK 表示 | ◎ | `useEffect` で `/api/health` を fetch し、成功時に i18n キー `health.ok` を `version` 補間付きで緑色表示、失敗時は `health.error` を赤色表示。`router.tsx` で `/` から `/health` へリダイレクトされるため、開発サーバー root アクセスで即時確認可能。 |
| `make test` の Go・フロント両対応 | ◎ | `test: test-go test-web` で連結、`test-go: go test ./...`、`test-web: cd web && npm test -- --run` で Vitest を非ウォッチモード実行。CI からも単発実行に適した形。 |

---

## 禁止事項違反の有無

| チェック項目 | 結果 | 詳細 |
|-------------|------|------|
| `localStorage`/`sessionStorage`/`IndexedDB` の使用 | ◎ | 出現なし。 |
| `console.log` / `fmt.Println` の本番コード残存 | ◎ | `web/src/`、`internal/`、`cmd/` で出現 0 件。`fmt.Fprintf(os.Stderr, ...)` のみで、これは fatal 時の意図的なエラー出力。 |
| Git 操作の Bash 実行 | ◎ | コード中に Git コマンド呼出なし。`.gitignore` の編集のみで完結。 |
| 設計書外の独自機能追加 | ◎ | 確認した範囲では指示書・SUPP-001 の範囲外の機能は追加されていない。`Logger` ミドルウェアの request_id・status・latency は SUPP-001 §5.6 のログ出力項目に該当。 |

---

## テスト網羅性

| チェック項目 | 結果 | 詳細 |
|-------------|------|------|
| `internal/config/config_test.go` | ◎ | 7 ケース実装(Default、ファイル不在→Default、有効ファイル、不正 TOML、不正 mode、env 上書き(ファイル不在時)、env 上書き(ファイル値より優先))。指示書 §5 の必須 4 観点をすべてカバー。`TestLoad_InvalidMode` は仕様(`validate()`)を裏付ける追加テストで好印象。 |
| `internal/infra/netutil/private_ip_test.go` | ◎ | `IsVirtualInterface` 18 ケース(大文字 `DOCKER1` も含む)、`IsPrivateIPv4` 13 ケース(各範囲境界・CGNAT・ループバック・パブリック)、IPv6 リンクローカルの追加検証、`selectByPriority` 7 サブテスト(空・単一・優先順位の対比・同一優先度内順序・範囲外混在)、`ListPrivateIPv4` のスモークテスト。指示書 §5 の要件を超えて十分。 |
| `web/src/lib/api-client.test.ts` | ◎ | 200 系 JSON 復元、500 系で `HTTP 500` を含む例外、カスタムヘッダのマージ(Content-Type を維持)を検証。指示書 §5 の必須 2 観点に加えてヘッダマージも検査しており頑健。 |

### テストの追加所見

- ハンドラの httptest テストは指示書 §5「任意」のため未実装で問題なし(`/api/health` は実装が極めて薄く、レビュー上のリスクも低い)。
- `selectByPriority` を `SelectPrimaryLANIP` から分離してテスト容易性を確保した点は設計判断として優れている。

---

## 設計準拠性以外の指摘事項

### コーディング規約・整合性

- **README.md の Go バージョン表記揺れ(低)**: README は「Go 1.22 以上」と記載するが `go.mod` は `go 1.26.2`。指示書 §4.1 は「1.22 以上」を最低要件として定めており論理的には矛盾しないが、開発者向けに分かりにくい。`go.mod` を `1.22` に下げるか、README を「Go 1.22 以上(devContainer は 1.26 を使用)」のように補足する選択肢がある。CLAUDE.md のメモリ(`go_version.md`)で 1.26.2 採用は意図的であることが分かるため、READMEへの追記が現実的。
- **指示書側のリンク不整合(参考、Claude 作業範囲外)**: 指示書 §6 と `M1-overview.md` §5 はレビューチェックリストを `docs/instructions/reviews/M1-01-review-checklist.md` と参照するが、実体は `docs/instructions/M1-01-review-checklist.md` に存在(`reviews/` サブディレクトリは未作成)。製造担当 Claude の責務外。開発者または指示書整備担当が後追い修正すべき。

### ライブラリ選択

- 指示書 §4.2 で列挙された 4 ライブラリ(`echo/v4`、`modernc.org/sqlite`、`BurntSushi/toml`、`lumberjack.v2`)のみ direct require に追加。マイグレーションライブラリ・UUID ライブラリの先行追加なし。SUPP-001 §5.7 の方針通り。
- `modernc.org/sqlite` は `internal/infra/db/doc.go` の blank import で依存をビルドに含めており、M1-02 への引き継ぎを意識した良い実装。

### セキュリティ

- CORS 実装が `Access-Control-Allow-Credentials: true` を許可 Origin にのみ付与し、`Allow-Origin` を完全一致 Origin で返している。`Vary: Origin` も付与済みで CDN キャッシュポイズニング耐性あり。許可外 Origin には何も返さず、ブラウザに拒否させる方式は適切。
- `internal/config/config.go` の TOML 読込で 0o600 等のパーミッション検査はしていないが、`config.toml` は機密(パスワードハッシュ等)を含む想定なので将来的に検討の余地あり。M1 では `password_hash` 未使用のため低優先。

### 細部

- `cmd/combomgr/main.go` で `slog.Info("server starting", ...)` 後に Echo の `HideBanner=true`、`HidePort=true` を設定しているのは、起動メッセージを slog 経由のみで一元化する明確な意図が読み取れて好印象。
- `internal/api/middleware/logger.go::toAttrSlice` は `attrs := []any{slog.String(...), ...}` の型を `[]slog.Attr` に再構築するヘルパだが、最初から `attrs := []slog.Attr{slog.String(...), ...}` と書けば不要(可読性軽微改善の余地)。動作には影響しない。

---

## 推奨修正(優先度別)

### 高(M1 完了前に修正必須)

- なし。

### 中(M1-02 着手と並行可)

1. **`netutil.selectByPriority` で VirtualBox 既定範囲(`192.168.56.0/24`)の優先度を最下位に降格**
   - 現状: `192.168.56.5` も `192.168.1.10` と同じ最高優先度(prio192)で扱われ、列挙順次第で誤って QR コード/CORS の代表 IP に選ばれる。
   - 期待: SUPP-001 §2.6.2「VM/コンテナ用と判明している範囲は優先度最下位まで落とす(除外はしない、手動指定用途のため残す)」の通り、`192.168.56.0/24` を別優先度(`prioOut` 直前など)に分類。
   - 影響範囲: `internal/infra/netutil/private_ip.go::selectByPriority`、テスト追加。
   - 注: 172.17-31(Docker 既定)は元から prio172(最下位)なので結果整合しており、追加対応不要。

2. **README.md と `go.mod` の Go バージョン表記揃え**
   - 案 A: README に「実行は 1.22+、devContainer は 1.26.2」と補足。
   - 案 B: `go.mod` の `go 1.26.2` を下げる。ただし CLAUDE.md メモリの `go_version.md` で 1.26.2 採用が記録されているため、開発者の意図確認が必要。

### 低(将来対応)

3. **`logger.go::toAttrSlice` の不要なヘルパ排除**: `[]slog.Attr` を最初から構築すれば中間 `[]any` 経由が不要(可読性微改善)。
4. **`config.toml` のパーミッション検査**: M6 でパスワードハッシュを config に書く段階で、0o600 未満の場合に警告ログ出力する検討。
5. **指示書側のチェックリスト参照パス整理**: `M1-overview.md` および各指示書の `docs/instructions/reviews/*` 参照を実体に合わせる(製造担当外の作業)。

---

## 良かった点(Claude Code へのフィードバック)

1. **CORS の起動時固定構築を厳格に守った**: SUPP-001 §2.6.1 が最も重視する設計判断を、`buildAllowedOrigins()` を `run()` 内で 1 回だけ呼び `CORS(allowedOrigins []string)` ミドルウェアにスライスを閉じ込める形で実装。リクエスト時の動的判定や NIC 再列挙が一切ないことがコード上で明白に読み取れる。
2. **lan モードで LAN IP 取得失敗時の運用者向けエラー文言**: 「config.toml の mode を local に戻すか、ネットワーク接続を確認してください」と日本語で具体的な復旧手順を案内。fatal を `panic` ではなく `return error` で返し、`run()` で集約処理する設計も良好。
3. **`selectByPriority` をテスト容易性のため切り出した判断**: OS の NIC 列挙は単体テストできないが、優先順位ロジックを純粋関数として分離したことで境界条件・優先度の対比・同一優先度内順序のテストが網羅できている。
4. **`google/uuid` を依存に追加せず `crypto/rand` で request_id を採番**: 指示書 §4.2「M1-01 の go.mod には 4 ライブラリのみ追加」を厳守しつつ、フォールバック(時刻ベース文字列)も用意した堅実な実装。
5. **`config.toml.example` の説明コメント**: mode の意味、DB パスの OS 別既定、環境変数優先の旨など、SUPP-001 §5.8 の補足を運用者向けに親切に記載。
6. **テスト網羅性が指示書要件以上**: `IsVirtualInterface` の大文字判定(`DOCKER1`)、`IsPrivateIPv4` の境界値(172.15/172.32)、env 上書きとファイル値の優先関係比較など、要求の上を行く検証。
7. **`HealthCheckPage` の unmount 安全性**: `cancelled` フラグで競合状態を抑止しており、React 開発モードの二重マウントでも警告が出ない。
8. **`internal/infra/db/doc.go` で `_ "modernc.org/sqlite"` を blank import**: M1-01 では DB 接続を作らないが、go.mod の require が tidy 時に削除されないよう保険を打った点が玄人的。
9. **エラーラップとセンチネルエラーの併用**: `netutil` で `ErrNoLANIP` を `errors.New` で公開し、呼出側で `errors.Is` 判定可能にしつつ、上位レイヤーは `%w` ラップで原因を保持。Go の良い慣行。

---

## 制約事項

- 本レビューはコード上で判定可能な範囲のみ対象。`make run-server` / `make run-web` の実機起動、`go test ./...` / `npm test` の実行結果、CORS のブラウザ実挙動、ログローテーションの実回転、devContainer 内の `go mod tidy` 整合性は別途実機検証が必要。
- M0 プロトタイプ(`web/prototypes/`)、`docs/`、`.claude/settings.json` は本レビュー対象外。
- 指示書側のリンク不整合(`docs/instructions/reviews/`)は製造担当 Claude の責務外のため、本レビューでは「参考所見」として記載した。

---

*以上*
