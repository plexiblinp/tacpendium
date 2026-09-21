# M7-06 ヒューマンノート（フロント embed + 単一バイナリ + 配布 UX）

| 項目 | 内容 |
|------|------|
| 対象 | M7-06 本体 + Windows E2E 修正 + 追補 A-1 / A-2 |
| 作成日 | 2026-06-07 |
| 作成者 | 製造担当 Claude |
| 状態 | 実装・自動テスト完了。配布構成の実機最終確認は開発者作業として残置 |

> 目的: (1) 開発者が再テストすべき箇所、(2) 設計担当への伝達事項（実装判断・残課題）を 1 枚にまとめる。
> 詳細な実装記録は `docs/progress/progress-log.md` の M7-06 各節を参照。

---

## 1. 開発者が再テストすべき箇所

**前提**: stdout 起動案内・migration 修正・LAN トグルを反映するには、ホスト OS で `combomgr.exe` の**再ビルドが必須**。
`make build`（= `pnpm build` → `go build -tags=embed_web`）、またはクロスビルド `make build-windows`。

### 1.1 配布構成（embed 単一バイナリ）の基本動作 〔必須〕
- [ ] `combomgr.exe` 起動 → ブラウザ自動起動 → 同一オリジンで全機能スモーク（コンボ一覧/詳細/編集/タグ/設定）。
- [ ] **コンソール画面に起動案内が出る**（A-1）: local モードで `http://localhost:<port>/`。実ポート（L-04 フォールバック）に追従しているか。
- [ ] SPA 直 URL/リロード（例 `/combos/123`）で 200、`/api/*` が index.html に飲まれていない。

### 1.2 LAN 共有モード切替トグル（A-2） 〔必須〕
- [ ] 設定 →「ネットワーク」の **「LAN 共有モード」スイッチを ON** → 確認ダイアログ（ポート番号 + 外部公開の注意）→「有効にする」→ 再起動要トースト。
- [ ] 再起動後、設定画面ネットワークに LAN URL/QR が表示され、`config.toml` が `mode="lan"` に更新されている（**手編集なしで LAN 化できる**こと）。
- [ ] スイッチ OFF（lan→local）は確認ダイアログなしで即時適用 → 再起動でローカルに戻る。
- [ ] 切替後に警告バナーが常時表示されない（DES-002 §3.4「静かに動作」）。

### 1.3 lan モードでのスマホ実機接続（U-1） 〔必須・前回の本丸〕
- [ ] lan 起動時、**コンソールにスマホ用 LAN URL 一覧 + FW/AV 許可ヒント**が出る（A-1）。
- [ ] **ファイアウォール/ウイルス対策ソフトで inbound 許可**後、まず PC 自身で `http://<LAN-IP>:<port>/`、次にスマホ実機で接続 → 全機能操作。
  - ※前回は **Norton** が Windows FW を代替制御しており、Norton 側許可で解決。同等環境では AV 側設定を要確認。
- [ ] 検出 LAN IP が複数列挙される環境（有線+無線等）で、スマホと同じネットワーク側の IP で接続できるか。
- [ ] 結果を `docs/progress/m7-integration-e2e-results.md` の F-5 / U-1 に記入。

### 1.4 Windows 初回起動（migration 修正の確認） 〔推奨〕
- [ ] `%APPDATA%\combomgr\` が存在しない**まっさらな状態**から起動 → DB が自動作成され migration 完走（旧: `sqlite://C:\...` の URL パースエラーで起動不能だった件）。

### 1.5 既存非破壊 / dev 構成 〔推奨〕
- [ ] dev 構成（`make run-web` + `make run-server`、Vite + proxy）が従来どおり動作（stdout 起動案内は dev では出ない＝embed のみ、で正しい）。
- [ ] クロスビルド成果物（win/mac/linux）が `make build-all` で生成できる（mac/Linux は非公式・コンパイル成立まで）。

### 自動テスト済み（再確認不要・参考）
`go test ./...` 全パス / `go vet`（両ビルドタグ）/ `pnpm lint`(tsc) / `pnpm test` 81 ファイル 439 テスト。
stdout 起動案内は local/lan ともコンテナ内で出力確認済み（実ポート追従含む）。

---

## 2. 設計担当への伝達事項

### 2.1 設計書反映の候補（製造側は実装のみ。設計書本体は設計担当が更新）

| # | 反映先候補 | 内容 | 根拠/位置づけ |
|---|-----------|------|--------------|
| C-1 | **SUPP-001 §5.6（ロギング戦略）** | 「起動時のユーザー向け案内は **level 非依存で stdout** に出す（運用ログ=ファイル とは別カテゴリの CLI UX）」を追記。実装は `printStartupNotice`（A-1）。 | 指示書 A-1 で「設計書追記は設計担当が行う」と明記。現状 SUPP-001 は info=ファイルのみ。 |
| C-2 | **DES-002 §11 / §14（配布・LAN）** | LAN 利用の前提として「inbound ファイアウォール許可が必要。**サードパーティ AV（Norton 等）が Windows FW を代替制御し、Windows 設定では解決しない場合がある**。製品ごとに設定が異なり本アプリでは保証外」を既知制約として明文化するか検討。 | E2E 実機で判明（Norton）。現状 README + progress-log のみに記載。 |

> いずれも **CHANGE 不要の範囲**（embed/LAN/起動案内は DES-002 §3.4・§5.1・§11、NFR303/304 に既定。実装=準拠）。C-1/C-2 は「あるべき姿」を設計書へ反映するかの編集判断であり、製造判断で本体編集はしていない。

### 2.2 主な実装判断（レビュー/handover の前提）

- **dev/embed 両立 = build タグ `embed_web`**（既存 `-tags=debug` と同 idiom）。dev/test は stub FS で `web/dist` 不要。配布は `go build -tags=embed_web`。`web/dist` は `.gitignore` 済み。
- **SPA フォールバックの /api 非干渉**: catch-all ハンドラ内で `/api`・`/api/*` を明示 404（echo ルーティング優先 + 二重保護）。`/assets/` 欠落も 404。`api-client`(`API_BASE=""`)・CORS は両構成で成立済みのため無変更。
- **Windows migration**: `sqlite://`+path を `sqlite.WithInstance(開済み *sql.DB)` + `migrate.NewWithInstance` に変更し URL パースを回避（クロスプラットフォーム）。親ディレクトリ作成も追加。migration 接続は旧挙動どおり PRAGMA 非適用（FK オフ）で意味論不変。**スキーマ変更なし**。
- **A-1 stdout 出力**: `fmt.Println` 散発ではなく専用命名関数 `printStartupNotice`。CLAUDE.md §10 の `fmt.Println` 禁止は「散発デバッグ出力の残留防止」が趣旨で、意図的なユーザー向け起動案内は対象外、と整理。`WebEmbedded` 配布ビルドのみ（`launchBrowser` と同 gating）。slog ファイルログは記録として維持（記録=ログ / 案内=stdout の二重持ち）。
- **A-2 切替**: 永続化はウィザード（`WizardPage.tsx`）と同一の `useUpdateConfig`（PUT /api/config 部分更新 `{server:{mode}}`）。**バックエンド変更なし**。確認ダイアログは **LAN 有効化時のみ**（DES-002 §3.4「LAN 共有モードへの切替操作時にのみ」。local 化は露出減のため即時）。mode 変更は `restartRequired`。
- **依存追加**: `github.com/pkg/browser`（BSD-2-Clause、DES-002 §11.1 指定済）。

### 2.3 残課題 / 持ち越し

| # | 内容 | 区分 | メモ |
|---|------|------|------|
| R-1 | **A-2 確認ダイアログで LAN IP を事前提示できない** | 仕様上の制約 | local→lan の確認時点では `resolveNetwork` が IP 未返却（lan 時のみ）。ダイアログはポートを明示し、IP は再起動後にネットワーク欄/起動案内で表示する方式とした。事前提示が要件なら別 API（候補 IP プレビュー）が必要＝フェーズ2+。 |
| R-2 | **クロスビルド mac/Linux は実機未起動**（コンパイル成立のみ） | 軽微・持ち越し | §11.1 非公式 OS。実機起動確認は将来。 |
| R-3 | **GitHub Actions CI（§11.3）未整備** | 軽微・持ち越し | 本タスク範囲外と確定済み。 |
| R-4 | **pkg/browser のバージョンが約2年前** | 情報 | DES-002 §11.1 指定で採用は正当。後続フェーズの依存ライブラリ棚卸し時に代替検討。 |
| R-5 | **P-01: RecipeBuilder console.warn 既知課題** | 情報 | M7-06 とは無関係。後続で対応要（既存メモ）。 |

### 2.4 フェーズ 1 完了判定に向けて

- M7-06 本体 DoD（単一バイナリ成立 / 配布スモーク / SPA フォールバック / 起動 UX）= 充足。
- スマホ LAN 実機検証（U-1）= 前回 Norton 許可で接続成立を実機確認済み。再ビルド後の最終確認（§1.3）が残るのみ。
- **設計担当作業**: M7-overview §13 DoD + 上記をもってフェーズ 1 完了判定 → `m7-to-phase2-handover.md` 作成（製造担当スコープ外）。フェーズ2/3 送り確定項目は progress-log M7-05/M7-06 各節を参照。

---

*以上。詳細は `docs/progress/progress-log.md`（M7-06 各節）および `docs/progress/m7-integration-e2e-results.md` を参照。*
