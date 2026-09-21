# M6-02 機械レビューチェックリスト

| 項目 | 内容 |
|------|------|
| 対応指示書 | M6-02: 設定画面 + 初回起動ウィザード + ConfigResponse 拡張(network 情報追加 + defaults セクション追加)**v1.0.2** |
| バージョン | 1.0.2 |
| 推奨モデル | Sonnet 4.6(機械レビュー) |
| 役割 | M6-02 の実装が指示書通りか、構造的問題がないかを機械的に検査する。**実機テストは別途実施が必要**(playbook §14、M4-02 E2E 由来運用知見: レビュー完了承認 ≠ サブマイルストーン完了承認) |
| 作成日 | 2026-05-23 |

## 更新履歴

| バージョン | 更新日 | 更新内容 |
|-----------|--------|----------|
| 1.0.0 | 2026-05-23 | 初版作成。M6-02 指示書 v1.0.0 に対応 |
| 1.0.1 | 2026-05-23 | M6-02 指示書 v1.0.0 → v1.0.1 改訂(確認事項 1 案 2-c + 確認事項 2 案 1 統合反映)に伴う改訂。(1) §1.1 / §1.2 ファイル一覧に `Config.Defaults` 系追加(BE 6 ファイル拡張 + ヘッダ修正)。(2) §1.4 スコープ外に「プリセット管理画面 `/presets` 未実装」+ 「既存 4 サブ構造体(Server / Database / Logging / Security)未変更」追加。(3) §1.5 例外条項 (f) / (g) / (h) 追加。(4) §2 着手前確認に §3.4.7 設定画面 6 セクション ↔ 既存実装実態の対応表(15 項目)網羅検証追加(M6-3 / M6-4 / M6-5 反省踏襲、最重要)。(5) §3 Plan Mode 必須項目を 7 → 8 件(必須項目 8 = `[defaults]` フィールド設計)。(6) §4 配下に §4.4 / §4.5 として `Config.Defaults` 拡張のチェック節新設。(7) §8 設定画面チェックに「セクション 5 disabled」「基本セクション defaults 表示・編集」「ヘッダのプリセットリンク disabled」追加。(8) §9 テスト件数 BE 5 → 14 件、フロント 13 → 20 件以上に更新。(9) §10 E2E シナリオ A〜G → A〜I に拡張(H = 永続化、I = プリセット管理リンク disabled)。(10) §11 重大判定基準に defaults / プリセット管理リンク系追加。(11) §13 レビュー報告書フォーマットの §4 architecture-patterns §2.1 準拠確認に defaults 拡張時の Service インターフェース戻り値拡張も対象に明示 |
| 1.0.2 | 2026-05-23 | M6-02 指示書 v1.0.1 → v1.0.2 改訂(連絡事項 3 + 4 反映の軽微改訂)に伴う改訂。(1) §0 レビュー実施前の確認で対応指示書を v1.0.2 に更新、retrospective-log v1.0.19 → v1.0.20 参照(M6-6 追加)。(2) §1.3 修正ファイル「`web/src/components/Header.tsx`」のチェック項目に「設定」リンク新規追加チェックを追加(プリセットリンク disabled 化と並ぶ 2 件目の Header.tsx 修正)。(3) §1.4 スコープ外の Header.tsx 行を「プリセット disabled + 設定追加の 2 修正に限定」に拡張。(4) §2.2 §3.4.7 対応表確認に「ヘッダ主要ナビゲーション 4 リンクと既存実装実態の網羅対応確認」サブ項目を追加(M6-6 教訓踏襲、対応表スコープの UI 全範囲拡張)。(5) §8.1 ステップ構成チェックに「ステップ 3 スキップボタンが実装され、押下で `Defaults.CharacterID = 1` 送信」を追加(指示書 v1.0.2 §4.4.1 + シナリオ J-2 と対応)。(6) §9 設定画面チェックに **§9.8 を新設**(ヘッダの「設定」ナビゲーションリンク追加チェック)、既存 §9.8 QR コードモーダルを **§9.9 にリナンバリング**(節番号繰り下げ)。(7) §11 E2E シナリオ実行結果チェックに **シナリオ J**(ヘッダ「設定」リンク経由の `/settings` 遷移 + ウィザード Step 3 スキップ動作)を追加。(8) §14 重大判定基準に「ヘッダの『設定』ナビゲーションリンクが新規追加されていない(URL 直入力以外で `/settings` アクセス不可)」+ 「ウィザード Step 3 スキップボタン未実装」を追加。**新規 CHANGE 通知書なし**(設計書本体改訂なし、指示書 v1.0.2 と整合)|

---

## 0. レビュー実施前の確認

- [ ] M6-02 指示書 v1.0.2 を読了している
- [ ] M6-01 完了報告(2026-05-23)を確認している(`ConfigResponse` 確定構造 / CSRF ヘッダー要件)
- [ ] M6-RESEARCH-01 調査レポート(2026-05-23)を確認している(`netutil.SelectPrimaryLANIP()` の M1 既存実装)
- [ ] M6-overview v1.0.0 §4.3 を確認している
- [ ] DES-005 v2.8.0 §5.1 初回ウィザード + §5.16 設定画面 + §4 共通 UI 要素(**v1.0.2 で §4.1 主要ナビゲーション規定整合の確認が最重要**)を確認している
- [ ] DES-002 v1.8.0 §5.4 i18n(react-i18next)を確認している
- [ ] **(v1.0.1 改訂)SUPP-001 v1.14.0** §2.6.1 / §2.6.2 / §4.2 / **§5.8 `[defaults]` セクション(v1.14.0 で追加)** / §5.9 を確認している
- [ ] **architecture-patterns.md v1.0.4 §2.1 サービス層インターフェース定義パターン**(M6-1 反省踏襲)を確認している
- [ ] **(v1.0.2 改訂)retrospective-log.md v1.0.20** §1 構造的アンチパターン + §6.1 M6-1〜M6-6(**v1.0.2 で M6-6 = ヘッダ「設定」リンク追加指示漏れを追加**)+ §6.2 構造的分類(8 件、M6 期間 6 件)+ §6.3 教訓(対応表のスコープ拡張) + §6.6 M6-5 由来 P-1 持ち越し + 連絡事項 1 / 2 / 4 を確認している

---

## 1. ファイル一覧チェック(指示書 §2.1 / §2.2)

### 1.1 バックエンド拡張(§2.1 BE 部分、M6-01 既存ファイル拡張)

#### 1.1.1 network フィールド追加(v1.0.0 由来、M6-3 由来)

- [ ] `internal/api/config/dto.go` に `NetworkDTO` 構造体が追加されている(`PrimaryLanIp string` / `LanUrl string`)
- [ ] `internal/api/config/dto.go` の `ConfigResponse` に `Network NetworkDTO` フィールドが追加されている
- [ ] `internal/service/config/service.go` の `Service` インターフェース or 戻り値が拡張され、`network` 情報を返すようになっている
- [ ] `internal/service/config/service_test.go` に network 関連テスト 3 件以上が追加されている
- [ ] `internal/api/config/handler_test.go` に network 関連テスト 2 件以上が追加されている

#### 1.1.2 defaults フィールド追加(v1.0.1 新規、M6-4 由来)

- [ ] **`internal/config/config.go` に `DefaultsConfig` 構造体が追加されている**(`CharacterID int64` / `PresetID int64`)
- [ ] **`internal/config/config.go` の `Config` に `Defaults DefaultsConfig` フィールドが追加されている**(TOML タグ `"defaults"`)
- [ ] **`internal/config/config.go` の `Default()` 関数が `Defaults` フィールドのデフォルト値(`CharacterID: 1, PresetID: 1`)を返すように拡張されている**
- [ ] **`internal/config/config.go` の `validate()` 関数に `Defaults.CharacterID >= 1` + `Defaults.PresetID >= 1` のバリデーション追加**
- [ ] **`internal/config/config_test.go` に defaults 関連テスト 4 件以上が追加されている**(既存 7 ケースは変更されていない)
- [ ] `internal/api/config/dto.go` に `DefaultsDTO` 構造体が追加されている(`CharacterID int64` / `PresetID int64`、JSON タグ camelCase)
- [ ] `internal/api/config/dto.go` の `ConfigResponse` に `Defaults DefaultsDTO` フィールドが追加されている(JSON タグ `"defaults"`)
- [ ] `internal/api/config/dto.go` の `UpdateConfigRequest` に `Defaults *DefaultsUpdate` フィールド(部分更新対応、`*int64` ポインタ型)が追加されている
- [ ] `internal/service/config/service.go` の `Update()` が `req.Defaults` の部分更新に対応している(SUPP-001 §5.9 ポリシー)
- [ ] `internal/service/config/service_test.go` に defaults 関連テスト 3 件以上が追加されている
- [ ] `internal/api/config/handler_test.go` に defaults 関連テスト 2 件以上が追加されている

### 1.2 フロントエンド新規作成(§2.1 フロント部分)

- [ ] `web/src/lib/configApi.ts`(新規)が作成されている
- [ ] `web/src/features/config/useConfig.ts`(新規)が作成されている
- [ ] `web/src/features/config/useUpdateConfig.ts`(新規)が作成されている
- [ ] `web/src/features/config/types.ts`(新規、または configApi.ts 内に同居)で TypeScript 型が定義されている
- [ ] **(v1.0.1 追加)TypeScript 型 `ConfigResponse` に `defaults: { characterId: number; presetId: number }` が含まれている**
- [ ] **(v1.0.1 追加)TypeScript 型 `UpdateConfigRequest` に `defaults?: { characterId?: number; presetId?: number }` が含まれている**(部分更新可能、SUPP-001 §5.9 ポリシー)
- [ ] `web/src/pages/SettingsPage.tsx`(新規)が作成されている
- [ ] `web/src/pages/WizardPage.tsx`(新規)が作成されている
- [ ] 設定画面の 6 セクション(基本 / ユーザー / ネットワーク / データ / プリセット管理 / 詳細)が独立コンポーネントとして実装されている(指示書 §2.1 推奨形式 + §3.4.8 必須項目 5 確定方針)
- [ ] ウィザード 7 ステップ(または LAN 無効時 6 ステップ)が独立コンポーネント or 集約コンポーネントで実装されている
- [ ] `WizardProgress` 進捗バーコンポーネントが実装されている
- [ ] `QRCodeModal` コンポーネントが実装されている
- [ ] react-i18next 初期化ファイル(`web/src/lib/i18n.ts` 等)の有無は §3.4.3 確認結果に応じて(未実装なら新設、既存なら拡張)
- [ ] フロントエンドテスト(useConfig / useUpdateConfig / SettingsPage / WizardPage 等)が新規作成されている

### 1.3 修正ファイル(§2.2)

- [ ] `web/src/App.tsx` に `/wizard` / `/settings` ルートが追加されている
- [ ] `web/src/App.tsx` にアプリ起動時の `GET /api/config` 呼出 + `isInitialized: false` 時の `/wizard` リダイレクトが実装されている
- [ ] `web/package.json` に QR コード生成ライブラリ(`qrcode.react` 推奨)が追加されている
- [ ] react-i18next が未導入だった場合、`web/package.json` に追加されている
- [ ] `cmd/combomgr/main.go` の `configService := configsvc.NewService(...)` 呼出が、サービス層シグネチャ変更に対応している(`lanIpResolver` 引数追加等)
- [ ] **(v1.0.1 追加)`web/src/components/Header.tsx`(または相当ファイル)で「プリセット」ナビゲーションリンクが disabled + ツールチップ「今後実装予定」表示に修正されている**(M6-5 由来)
- [ ] **(v1.0.2 追加)`web/src/components/Header.tsx`(または相当ファイル)に「設定」ナビゲーションリンクが新規追加されている**(リンク先 `/settings`、DES-005 §4.1 主要ナビゲーション規定整合、M6-6 由来、Q-C 案 a)

### 1.4 スコープ外への変更がないこと(§2.3、最重要、v1.0.1 で追加項目あり)

- [ ] M6-01 で実装した `internal/api/config/handler.go` / `routes.go` の **既存ハンドラ関数本体が `ConfigResponse` 構造拡張 + Defaults 対応のみ** に限定されている(レスポンス構築ロジックは温存、`Get()` / `Update()` の HTTP ステータスコード判定等は変更なし)
- [ ] **(v1.0.1 改訂)`internal/config/config.go` の既存 `Server` / `Database` / `Logging` / `Security` の 4 サブ構造体が変更されていない**(`Defaults` 構造体の追加のみ許容)
- [ ] **(v1.0.1 改訂)`internal/config/config_test.go` の既存 7 ケースが変更されていない**(追加テスト 4 件のみ)
- [ ] `cmd/combomgr/main.go:determineBindAddr()` が変更されていない(行 176-185 想定)
- [ ] `cmd/combomgr/main.go:buildAllowedOrigins()` が変更されていない
- [ ] `cmd/combomgr/main.go:e.Start(bindAddr)` が変更されていない
- [ ] `internal/infra/netutil/` 配下の関数本体が変更されていない(読出のみ、`SelectPrimaryLANIP()` を呼ぶだけで実装変更なし)
- [ ] 設計書本体(REQ-001 / DES-001〜DES-006)が変更されていない
- [ ] **(v1.0.1 改訂)SUPP-001 が変更されていない**(本セッションで v1.13.0 → v1.14.0 改訂済み、製造担当は §5.8 v1.14.0 表記を参照して実装する)
- [ ] playbook / architecture-patterns.md / handover が変更されていない
- [ ] 他ドメイン(combo / preset / move / tag / character / setup / debug)のハンドラ・サービス・リポジトリが変更されていない
- [ ] 既存フロント画面(コンボ一覧 / マイコンボ / コンボ詳細 / コンボ登録 / セットプレイ / タグ管理 / ゴミ箱 / 比較)が **`App.tsx` のルーティング追加以外で変更されていない**
- [ ] **(v1.0.1 追加 + v1.0.2 拡張)`web/src/components/Header.tsx`(または相当)が「プリセット」リンクの disabled 化(v1.0.1)+ 「設定」リンクの新規追加(v1.0.2)以外で変更されていない**(ヘッダの他のリンク = コンボ一覧 / マイコンボ + プリセット切替プルダウン + 言語切替 + ユーザー表示 + モード表示 はすべて未変更)
- [ ] DB マイグレーションが新規追加されていない
- [ ] **新機能の追加実装が含まれていない**(本指示書 §1.3 規定、最重要)
- [ ] **LAN 共有モード切替トグル UI が実装されていない**(SUPP-001 §4.2 フェーズ 2 送り、§1.3 既定)
- [ ] **パスワード認証ロジックが実装されていない**(SUPP-001 §4.2 / CLAUDE.md §10、§1.3 既定)
- [ ] **複数ユーザー管理 API が実装されていない**(§1.3 既定)
- [ ] **バックアップ / リストア / レシピキャッシュ再構築機能が実装されていない**(Q-ii 案 i、§1.3 既定)
- [ ] **手動 IP 指定機能が実装されていない**(SUPP-001 §2.6.2 フェーズ 2 検討、§1.3 既定)
- [ ] **スマホホーム(/home)が実装されていない**(M6-03 スコープ、§1.3 既定)
- [ ] **下書き自動保存が実装されていない**(M6-04 スコープ、§1.3 既定)
- [ ] **既存画面のスマホレスポンシブ調整が実装されていない**(M7 スコープ、§1.3 既定)
- [ ] **(v1.0.1 追加)プリセット管理画面 `/presets`(DES-005 §5.10 + §5.11)が実装されていない**(P-1 持ち越し、§1.3、M6 終了間近で再協議)
- [ ] **新規 CHANGE 通知書が起票されていない**(M6-overview §9、§1.3 既定)
- [ ] **shadcn/ui が導入されていない**(playbook §17.2、M7 まで未導入)

### 1.5 例外条項適用箇所のチェック(§2.4、v1.0.1 で 3 件追加)

- [ ] (a) `ConfigResponse.network` 追加実装が `NetworkDTO` 構造体 + サービス層拡張で対応されている
- [ ] (b) QR コード生成ライブラリの依存追加が `web/package.json` で行われ、Plan Mode で開発者承認済み(完了報告で承認結果明示)
- [ ] (c) react-i18next 初期化が必要な場合、設定画面 + ウィザード分の翻訳キーのみ追加されている(全画面整備していない、M7 スコープ)
- [ ] (d) TypeScript 型が M6-01 JSON キーと 1:1 で camelCase 統一されている
- [ ] (e) 新規エラーコード文字列が小文字スネークケース統一(`network_unavailable` 等)
- [ ] **(v1.0.1 追加)(f) `internal/config/config.go` の拡張が `DefaultsConfig` 構造体追加 + `Config.Defaults` フィールド追加 + `Default()` / `validate()` 拡張に限定されている**(既存 4 サブ構造体は変更なし)
- [ ] **(v1.0.1 追加)(g) `internal/config/config_test.go` への defaults テスト追加が既存 7 ケースを変更していない**(追加のみ)
- [ ] **(v1.0.1 追加)(h) SUPP-001 §5.8 設定ファイル例への `[defaults]` セクション追記は設計担当が本セッションで v1.14.0 として既改訂済み、製造担当は SUPP-001 自体を変更していない**

---

## 2. 着手前確認結果のチェック(§3.4、retrospective-log v1.0.19 §6.1 M6-1 反省踏襲)

製造担当の Plan Mode 計画提示に以下の確認結果が **すべて含まれている** こと:

### 2.1 §3.4.1〜§3.4.6 着手前確認(v1.0.0 既設)

- [ ] §3.4.1 既存サービス層インターフェース定義パターンの確認結果(architecture-patterns §2.1、M6-01 実装の Service インターフェース + 非公開構造体 + NewService コンストラクタ)
- [ ] §3.4.2 既存ルート定義 + ページパターンの確認結果(`/wizard` / `/settings` の予約状況、`/` ルートの既存実装)
- [ ] §3.4.3 react-i18next の実装状態確認結果(`package.json` + 初期化ファイル + 翻訳キーの実態)
- [ ] §3.4.4 `web/src/lib/fetchJSON.ts` の `X-Requested-With` 自動付与確認結果
- [ ] §3.4.5 既存フォーム部品の 3 点セット確認結果(`useCharacters` / `usePresets` + 構造 + 責務 + Props、再利用 / 新規実装の判断根拠)
- [ ] §3.4.6 `netutil.SelectPrimaryLANIP()` の戻り値挙動確認結果

### 2.2 §3.4.7 設定画面 6 セクション ↔ 既存実装実態の対応表(v1.0.1 で新設 + v1.0.2 で拡張、M6-3 / M6-4 / M6-5 / M6-6 反省踏襲、最重要)

- [ ] **製造担当の Plan Mode 計画提示に「設定画面 6 セクション ↔ 既存実装実態の対応表」が完全に埋められている**(15 項目すべて、M6-3 / M6-4 / M6-5 反省踏襲、最重要)
- [ ] 対応表の各行(基本 / ユーザー / ネットワーク / データ / プリセット管理リンク / 詳細)について、表示項目 + 既存実装の有無 + M6-02 でのアクションが明記されている
- [ ] 未確認項目がない(あった場合は §4 着手不可)
- [ ] **ヘッダの「プリセット」ナビゲーションリンクの現状実装** が `view web/src/components/Header.tsx`(または相当)で確認されている
- [ ] **(v1.0.2 追加)ヘッダの主要ナビゲーション 4 リンク(コンボ一覧 / マイコンボ / プリセット / 設定)それぞれの現状実装と既存ルートの対応関係** が `view web/src/components/Header.tsx`(または相当)で確認されている(M6-6 反省踏襲、対応表のスコープを UI 全範囲に拡張、retrospective-log v1.0.20 §6.3)
- [ ] **(v1.0.2 追加)「設定」リンクが v1.0.1 までヘッダに未実装だった事実が確認されており**、v1.0.2 での新規追加対象であることが Plan Mode 計画提示に明記されている
- [ ] **(v1.0.2 追加)スマホフッター(DES-005 §4.2)の「設定」ボタンが本指示書 v1.0.2 のスコープ外**(M6-03 スコープ)であることが明示されており、Plan Mode で誤って範囲拡張する記述がない

---

## 3. Plan Mode 必須項目の確認(§3.4.8、retrospective-log v1.0.19 §6.1 M6-2 反省踏襲、v1.0.1 で +1 件)

製造担当の完了報告に以下 **8 項目** の **開発者承認結果が明示** されていること:

- [ ] **必須項目 1**: `ConfigResponse.network` の最終形 + LAN IP 取得失敗時の挙動 — 開発者承認方針の明記
- [ ] **必須項目 2**: QR コード生成ライブラリの選定(`qrcode.react` / `react-qr-code` / その他)— 開発者承認方針の明記
- [ ] **必須項目 3**: アプリ起動時の初回判定リダイレクトの実装位置(`App.tsx` / ルーター層 / ページ層)— 開発者承認方針の明記
- [ ] **必須項目 4**: ウィザード進捗バーの実装方式(専用コンポーネント / 各 Step 独立)— 開発者承認方針の明記
- [ ] **必須項目 5**: 設定画面の各セクションのレスポンシブ実装(Tailwind ブレークポイント / JS メディアクエリ監視)— 開発者承認方針の明記
- [ ] **必須項目 6**: 言語選択の実装方式(react-i18next 初期化 / ハードコード / M7 まで disabled)— 開発者承認方針の明記
- [ ] **必須項目 7**: ウィザード完了時の遷移先(コンボ一覧固定 / スマホ判定で分岐)— 開発者承認方針の明記
- [ ] **(v1.0.1 追加)必須項目 8**: `[defaults]` セクションのフィールド設計(TOML 命名 / JSON タグ / フィールド型 / バリデーション)— 開発者承認方針の明記

---

## 4. `ConfigResponse.network` 拡張のチェック(§4.1、v1.0.0 由来、M6-3 由来)

### 4.1 DTO 拡張(§4.1.1)

- [ ] `NetworkDTO` 構造体に `PrimaryLanIp string` / `LanUrl string` が含まれている
- [ ] `ConfigResponse` に `Network NetworkDTO` フィールドが追加されている(JSON タグ `"network"`)
- [ ] JSON タグが camelCase 統一(`primaryLanIp` / `lanUrl`)
- [ ] `Network NetworkDTO` フィールドが **常に含まれる**(`omitempty` なし、ローカルモード時は空文字)

### 4.2 サービス層拡張(§4.1.2)

- [ ] `Service` インターフェースが M6-01 で確立した形(non-pointer return type)を維持している(architecture-patterns §2.1 厳守、retrospective-log v1.0.19 §6 M6-1 反省踏襲)
- [ ] サービス層が `netutil.SelectPrimaryLANIP()` を呼び出して LAN IP を取得している
- [ ] LAN IP 取得失敗時(エラー)に **空 `NetworkInfo` + ログ警告**(エラー伝搬せず)を返している(§3.4.8 必須項目 1 設計担当推奨)
- [ ] `mode == "local"` 時に `NetworkInfo` が空構造体を返している
- [ ] `mode == "lan"` 時に `NetworkInfo.PrimaryLanIp` + `LanUrl` が `http://<ip>:<port>` 形式で構築されている
- [ ] `lanIpResolver` 等の依存性注入パターンが採用されている(テスト時のモック差し込み容易性、設計担当推奨)

### 4.3 ハンドラ層対応修正(§4.1.3)

- [ ] `Get()` メソッドが `Network` フィールドを `ConfigResponse` に詰めている
- [ ] `Update()` メソッドも同様に `Network` を含む `ConfigResponse` を返している
- [ ] `toConfigResponse` ヘルパ関数(または相当)が `network` 引数を受け取って詰める形になっている

### 4.4 network テスト追加(§4.1.4 / §4.1.5)

- [ ] **TestService_Get_NetworkLocalMode** 実装あり、テスト通過
- [ ] **TestService_Get_NetworkLanMode** 実装あり、テスト通過(モック `lanIpResolver`)
- [ ] **TestService_Get_NetworkLanModeFailure** 実装あり、テスト通過(`lanIpResolver` エラー時の空 `NetworkInfo` + ログ警告確認)
- [ ] **TestHandler_Get_NetworkLocalMode** 実装あり、テスト通過(JSON レスポンス `network` が空文字)
- [ ] **TestHandler_Get_NetworkLanMode** 実装あり、テスト通過(JSON レスポンスに正しい IP + URL)

---

## 5. `Config.Defaults` 拡張のチェック(§4.1bis、v1.0.1 新規、M6-4 由来、最重要)

### 5.1 Config 構造体拡張(§4.1bis.1)

- [ ] **`DefaultsConfig` 構造体が `internal/config/config.go` に追加されている**(`CharacterID int64` / `PresetID int64`)
- [ ] **TOML タグが snake_case**(`character_id` / `preset_id`、SUPP-001 §5.8 v1.14.0 表記と整合)
- [ ] **Go フィールドが PascalCase**(`CharacterID` / `PresetID`、CLAUDE.md §4 規約踏襲)
- [ ] **`Config` に `Defaults DefaultsConfig` フィールドが追加されている**(TOML タグ `"defaults"`)
- [ ] **既存 4 サブ構造体(`ServerConfig` / `DatabaseConfig` / `LoggingConfig` / `SecurityConfig`)は変更されていない**(architecture-patterns §2.1 厳守、最重要)

### 5.2 Default() / validate() 拡張(§4.1bis.2 / §4.1bis.3)

- [ ] **`Default()` の戻り値に `Defaults: DefaultsConfig{CharacterID: 1, PresetID: 1}` が含まれている**
- [ ] **`validate()` に `Defaults.CharacterID < 1` チェック追加**(エラー返却)
- [ ] **`validate()` に `Defaults.PresetID < 1` チェック追加**(エラー返却)
- [ ] 既存 4 サブ構造体のデフォルト値設定 + バリデーションは変更されていない(追加のみ)

### 5.3 DTO 拡張(§4.1bis.4)

- [ ] **`DefaultsDTO` 構造体が追加されている**(`CharacterID int64` / `PresetID int64`、JSON タグ `characterId` / `presetId`)
- [ ] **`ConfigResponse` に `Defaults DefaultsDTO` フィールドが追加されている**(JSON タグ `"defaults"`)
- [ ] **`DefaultsUpdate` 構造体が追加されている**(`CharacterID *int64` / `PresetID *int64`、`omitempty` 付き)
- [ ] **`UpdateConfigRequest` に `Defaults *DefaultsUpdate` フィールドが追加されている**(部分更新可能、SUPP-001 §5.9 ポリシー)

### 5.4 サービス層対応(§4.1bis.5)

- [ ] サービス層 `Update()` が `req.Defaults` の部分更新に対応している(`req.Defaults.CharacterID != nil` / `req.Defaults.PresetID != nil` の個別チェック)
- [ ] サービス層 `Get()` が `Defaults` 情報を返している
- [ ] M6-01 で確立した `Service` インターフェースパターン(non-pointer return type、architecture-patterns §2.1)が維持されている

### 5.5 defaults テスト追加(§4.1bis.6〜§4.1bis.8)

- [ ] **TestLoad_DefaultsFromFile** 実装あり、テスト通過(`config.toml` の `[defaults]` セクション値を読み込み)
- [ ] **TestLoad_DefaultsFromDefault** 実装あり、テスト通過(`[defaults]` 不在時に `Default()` 値適用、後方互換性確認)
- [ ] **TestValidate_DefaultsCharacterIDZero** 実装あり、テスト通過(`CharacterID == 0` でバリデーション失敗)
- [ ] **TestValidate_DefaultsPresetIDZero** 実装あり、テスト通過(`PresetID == 0` でバリデーション失敗)
- [ ] **TestService_Update_DefaultsPartial** 実装あり、テスト通過(`CharacterID` のみ送って `PresetID` が変更されない、部分更新ポリシー)
- [ ] **TestService_Update_DefaultsValidationFailure** 実装あり、テスト通過(`CharacterID == 0` で `config.toml` が変更されない原子性)
- [ ] **TestService_Get_DefaultsValues** 実装あり、テスト通過
- [ ] **TestHandler_Get_DefaultsValues** 実装あり、テスト通過(JSON レスポンス `defaults.characterId` / `defaults.presetId`)
- [ ] **TestHandler_Update_DefaultsPartial** 実装あり、テスト通過(部分更新で `characterId` のみ変更)

### 5.6 後方互換性(§4.1bis.9)

- [ ] 既存 `config.toml`(`[defaults]` セクション不在)を読み込んだ場合に `Default()` のデフォルト値(`CharacterID: 1, PresetID: 1`)が適用される(BurntSushi/toml の標準挙動、回帰テストで確認)

---

## 6. フロントエンド API クライアントのチェック(§4.2)

### 6.1 TypeScript 型定義(§4.2.1)

- [ ] `ConfigResponse` 型が M6-01 確定 JSON キーと 1:1 対応(`server` / `database` / `logging` / `security` / `network` / **`defaults`(v1.0.1)** / `isInitialized` / `restartRequired`)
- [ ] `NetworkInfo` 型に `primaryLanIp: string` / `lanUrl: string` が含まれている
- [ ] **(v1.0.1 追加)`DefaultsInfo`(または相当)型に `characterId: number` / `presetId: number` が含まれている**
- [ ] `UpdateConfigRequest` 型が部分更新可能な `Partial<...>` で定義されている(SUPP-001 §5.9 ポリシー)
- [ ] **(v1.0.1 追加)`UpdateConfigRequest.defaults` が `{ characterId?: number; presetId?: number }` で定義されている**(部分更新可能)
- [ ] camelCase JSON キーと TypeScript フィールド名が完全一致(`maxSizeMb` / `passwordEnabled` / `isInitialized` / `restartRequired` / `characterId` / `presetId`)

### 6.2 API クライアント関数(§4.2.2)

- [ ] `configApi.get()` が `GET /api/config` を呼んでいる
- [ ] `configApi.update(req)` が `PUT /api/config` を呼んでいる
- [ ] `X-Requested-With: XMLHttpRequest` ヘッダーが付与されている(既存 `fetchJSON` 経由 or 明示付与、§3.4.4 結果による)

### 6.3 TanStack Query ロジックフック(§4.2.3)

- [ ] `useConfig` フックが `queryKey: ['config']` で `useQuery` を使用
- [ ] `useUpdateConfig` フックが `useMutation` で実装、`onSuccess` で `['config']` invalidate
- [ ] queryKey が flat tuple 形式(architecture-patterns §1.1 規約、ID パラメータなしのため number 正規化対象外)

---

## 7. アプリ起動時の初回判定リダイレクトのチェック(§4.3)

- [ ] `web/src/App.tsx` でアプリ起動時に `useConfig()` 呼出 + `isLoading` 中のローディング表示
- [ ] `config.isInitialized: false` かつ現在のパスが `/wizard` でない場合に `/wizard` リダイレクト(`<Navigate to="/wizard" replace />`)
- [ ] ウィザード途中で URL 直接アクセス(`/combos` 等)した場合も `/wizard` に再リダイレクト
- [ ] `config.isInitialized: true` の場合は通常起動(コンボ一覧表示)

---

## 8. 初回起動ウィザードのチェック(§4.4)

### 8.1 ステップ構成(§4.4.1、DES-005 §5.1)

- [ ] 7 ステップが実装されている(ようこそ / 言語 / キャラ / プリセット / LAN / パスワード / 完了)
- [ ] LAN 無効時はステップ 6「パスワード設定」が **スキップ** され、ステップ 5 → 7 に遷移する(`totalSteps = 6`)
- [ ] LAN 有効時はステップ 6 が **表示** される(`totalSteps = 7`)
- [ ] **(v1.0.2 強調)スキップボタンがステップ 3(デフォルトキャラ選択)に画面下部の可視ボタンとして実装され動作する**(「次へ」「戻る」「スキップ」の 3 ボタン構成、軽微-3 連絡事項 4 由来、v1.0.1 では「スキップ可能」と書いたが実装漏れだった補正)
- [ ] **(v1.0.1 追加)ステップ 3 で選択したデフォルト表示キャラが `UpdateConfigRequest.defaults.characterId` として送信される**
- [ ] **(v1.0.1 追加)ステップ 3 でスキップした場合にデフォルト値 1(リュウ)が送信される**
- [ ] **(v1.0.1 追加)ステップ 4 で選択したデフォルトプリセットが `UpdateConfigRequest.defaults.presetId` として送信される**
- [ ] **(v1.0.1 追加)ステップ 4 で選択しない場合にデフォルト値 1(`official_ja_move`)が送信される**

### 8.2 ウィザード状態管理(§4.4.2)

- [ ] ローカル状態(`useState`)でステップ番号 + 各ステップ入力値を管理
- [ ] 「次へ」「戻る」ボタンで遷移
- [ ] 完了ボタンで `useUpdateConfig().mutate()` 呼出
- [ ] mutation 成功で `navigate('/', { replace: true })` でコンボ一覧へ遷移(履歴に `/wizard` を残さない)
- [ ] mutation 失敗時(バリデーションエラー等)はエラー表示 + ユーザーが戻って修正可能
- [ ] **ウィザード中の入力値のブラウザストレージ保存はしていない**(M6-04 スコープ、本指示書 §4.4.2 既定)

### 8.3 進捗バー(§4.4.3、§3.4.8 必須項目 4)

- [ ] `WizardProgress` コンポーネントが実装されている
- [ ] 表示専用(Props のみ、副作用なし、architecture-patterns §1)
- [ ] LAN 有効 / 無効で `totalSteps` が動的に切り替わる(6 or 7)

### 8.4 LAN 共有モード設定(§4.4.4)

- [ ] ステップ 5 に「LAN 共有を有効にする」チェックボックス(初期値 OFF)
- [ ] ON にすると次のステップが「パスワード設定」になる
- [ ] OFF のままなら次のステップが「完了」になる
- [ ] 注釈「LAN 共有を有効にするとアプリ再起動後に設定が反映されます」が表示されている

### 8.5 完了時の `config.toml` 自動生成(§4.4.5)

- [ ] ステップ 7「完了」ボタン押下で `PUT /api/config` 呼出
- [ ] リクエストボディが `UpdateConfigRequest` 形式(**v1.0.1: `defaults` フィールド含む**)
- [ ] 成功時に `config.toml` が自動生成される(`[server]` / `[database]` / `[logging]` / `[security]` / **(v1.0.1)`[defaults]`** すべて含む、SUPP-001 §5.8 v1.14.0)
- [ ] `isInitialized: true` レスポンス確認後にコンボ一覧へ遷移

---

## 9. 設定画面のチェック(§4.5、v1.0.1 で 6 セクション仕様 + プリセット管理リンク + ヘッダのプリセットリンク追加、**v1.0.2 でヘッダの「設定」リンク追加 §9.8 新設 + QR モーダル §9.8 → §9.9 リナンバリング**)

### 9.1 6 セクション構成(§4.5.1、DES-005 §5.16)

- [ ] **基本セクション**: 言語選択 / **(v1.0.1)デフォルトキャラ / デフォルトプリセット** が実装されている
- [ ] **ユーザーセクション**: ユーザー追加・編集ボタン + パスワード変更ボタンが **disabled + ツールチップ「フェーズ 2 で実装」** 表示
- [ ] **ネットワークセクション**: モード表示 + 接続情報 + QR コード表示ボタンが実装されている
- [ ] **データセクション**: DB ファイルパス表示が実装 + 他ボタン(バックアップ / リストア / キャッシュ再構築)が **disabled + ツールチップ「フェーズ 2 で実装」**
- [ ] **(v1.0.1 改訂)プリセット管理リンク(セクション 5)**: `/presets` への遷移ボタンが **disabled + ツールチップ「今後実装予定」**(クリック時に画面遷移しない、§4.5.6 仕様)
- [ ] **詳細セクション**: ログファイルパス表示 + バージョン情報

### 9.2 基本セクション defaults 表示・編集(v1.0.1 新設、§4.5.2、M6-4 由来、最重要)

- [ ] **基本セクションでデフォルト表示キャラ選択プルダウンが実装されている**(`useCharacters()` フックで一覧取得、現在の `config.defaults.characterId` を初期選択)
- [ ] **基本セクションでデフォルトプリセット選択プルダウンが実装されている**(`usePresets()` フックで一覧取得、現在の `config.defaults.presetId` を初期選択)
- [ ] **変更後「保存」ボタン押下で `useUpdateConfig().mutate({ defaults: { ... } })` 呼出**(部分更新、SUPP-001 §5.9 ポリシー)
- [ ] **既存パターン踏襲**: キャラクター選択プルダウンが DES-005 §4.3 共通要素「キャラクター選択プルダウン」既存パターン踏襲(§3.4.5 確認結果次第)

### 9.3 レスポンシブ実装(§4.5.3、§3.4.8 必須項目 5)

- [ ] PC(`md:` 以上)でセクション横並び表示(Tailwind grid)
- [ ] スマホ(`sm` 未満)でアコーディオン折りたたみ表示
- [ ] DES-005 §4.4 ブレークポイントに準拠

### 9.4 ネットワークセクション(§4.5.4)

- [ ] `mode == "local"` 時に「ローカルモード」表示 + `127.0.0.1:<port>` 表示
- [ ] `mode == "lan"` 時に「LAN 共有モード」表示 + `<network.primaryLanIp>:<port>` 表示
- [ ] `network.primaryLanIp` が空文字の場合「LAN IP が取得できません」エラー表示
- [ ] **LAN 切替トグルが表示されていない**(本指示書 §1.3 + §4.5.4、フェーズ 2 送り)
- [ ] QR コード表示ボタンが **LAN モード時かつ `network.lanUrl !== ""` で有効**、ローカルモード時は disabled + ツールチップ

### 9.5 設定変更の保存挙動(§4.5.5)

- [ ] 各セクションのフィールド変更でローカル状態に反映
- [ ] 「保存」ボタンで `useUpdateConfig().mutate()` 呼出
- [ ] **部分更新**(変更されたフィールドのみ送信、SUPP-001 §5.9 ポリシー、**v1.0.1: `defaults` フィールドも対応**)
- [ ] 成功時に Toast 通知「設定を保存しました」
- [ ] `restartRequired: true` 時に「再起動が必要です」追加表示
- [ ] バリデーション失敗(422)時に `details.validations.issues` を表示

### 9.6 プリセット管理リンクセクション disabled(v1.0.1 新設、§4.5.6、M6-5 由来)

- [ ] **「プリセット管理」ボタンが disabled で表示されている**
- [ ] **ホバー時にツールチップ「今後実装予定」が表示される**
- [ ] **クリックしても画面遷移しない**(`navigate('/presets')` 等が呼ばれていない)
- [ ] `<button disabled>` 等で実装(`<a href>` でもクリックされない実装)

### 9.7 ヘッダのプリセットナビゲーションリンク disabled(v1.0.1 新設、§4.5.7.1、M6-5 由来)

- [ ] **`web/src/components/Header.tsx`(または相当)で「プリセット」リンクが disabled で表示されている**
- [ ] **ホバー時にツールチップ「今後実装予定」が表示される**(設定画面セクション 5 と統一文言)
- [ ] **クリックしても画面遷移しない**
- [ ] **ヘッダの他のナビゲーション(コンボ一覧 / マイコンボ 等)+ プリセット切替プルダウンは変更されていない**(M3-03 実装の現在表示中コンボのプリセット切替プルダウンは別物、温存)

### 9.8 ヘッダの「設定」ナビゲーションリンク追加(v1.0.2 新設、§4.5.7.2、M6-6 由来)

- [ ] **`web/src/components/Header.tsx`(または相当)に「設定」ナビゲーションリンクが新規追加されている**(v1.0.1 までヘッダに未実装だった項目、DES-005 §4.1 主要ナビゲーション規定整合)
- [ ] **リンク先が `/settings`**(M6-02 v1.0.1 で新設したルート)
- [ ] **クリックで `/settings` に遷移する**(設定画面 6 セクションが表示される)
- [ ] **DES-005 §4.1 主要ナビゲーション順序を踏襲した配置**(「プリセット」リンクの後ろが推奨、Plan Mode で開発者確認、既存ヘッダ実装構造との整合性で確定)
- [ ] **既存リンクの実装パターン(`<Link to>` / `<a href>` / `<NavLink>` 等)に統一されている**(混在を避ける)
- [ ] **「プリセット」リンク disabled 化と混同していない**(設定リンクは通常リンクとして動作、プリセットは disabled のまま)
- [ ] **スマホフッター(DES-005 §4.2)の「設定」ボタンが実装されていない**(本指示書 v1.0.2 スコープ外、M6-03 で対応、§1.3 既定)

### 9.9 QR コードモーダル(§4.5.8、§3.4.8 必須項目 2、v1.0.2 で §9.8 → §9.9 にリナンバリング)

- [ ] `QRCodeModal` コンポーネントが実装されている
- [ ] QR コードに `network.lanUrl` を含む
- [ ] QR コードに **パスワードは含まれていない**(SUPP-001 §5.16、§4.5.4)
- [ ] 接続 URL のテキスト表示も併設(QR コード読取できない環境用)
- [ ] 閉じるボタン

---

## 10. テスト要件のチェック(§5.1、v1.0.1 で件数更新)

### 10.1 バックエンドテスト(§5.1.1、必須 14 件)

#### network 系(v1.0.0 5 件)

- [ ] サービス層テスト 3 件追加すべて通過(NetworkLocalMode / NetworkLanMode / NetworkLanModeFailure)
- [ ] ハンドラ層テスト 2 件追加すべて通過(NetworkLocalMode / NetworkLanMode)

#### defaults 系(v1.0.1 追加 9 件、M6-4 由来)

- [ ] **`config_test.go` defaults テスト 4 件**(DefaultsFromFile / DefaultsFromDefault / DefaultsCharacterIDZero / DefaultsPresetIDZero)
- [ ] **サービス層 defaults テスト 3 件**(Update_DefaultsPartial / Update_DefaultsValidationFailure / Get_DefaultsValues)
- [ ] **ハンドラ層 defaults テスト 2 件**(Get_DefaultsValues / Update_DefaultsPartial)

#### 既存テスト回帰

- [ ] M6-01 既存サービス層テスト 7 件 + ハンドラ層テスト 6 件すべて通過(回帰なし)
- [ ] `internal/config/config_test.go` 既存 7 ケース通過(変更なし、追加テスト 4 件と独立)

### 10.2 フロントエンドテスト(§5.1.2、必須 20 件以上)

#### v1.0.0 由来 13 件

- [ ] **useConfig** テスト実装あり、通過(MSW モック)
- [ ] **useUpdateConfig** テスト実装あり、通過(`['config']` invalidate 確認)
- [ ] **SettingsPage**: 6 セクションすべてレンダリングテスト通過
- [ ] **SettingsPage**: ネットワークセクションの QR ボタン有効・無効テスト通過
- [ ] **SettingsPage**: バックアップ / リストア / キャッシュ再構築ボタンの disabled + ツールチップテスト通過
- [ ] **SettingsPage**: ユーザー追加・編集ボタンの disabled テスト通過
- [ ] **WizardPage**: 7 ステップ全件レンダリングテスト通過
- [ ] **WizardPage**: LAN 無効時の 6 ステップ遷移テスト通過(ステップ 5 → 7)
- [ ] **WizardPage**: LAN 有効時の 7 ステップ遷移テスト通過(ステップ 5 → 6 → 7)
- [ ] **WizardPage**: 完了ボタンで `PUT /api/config` + コンボ一覧遷移テスト通過
- [ ] **QRCodeModal** テスト通過
- [ ] **WizardProgress** テスト通過
- [ ] **App.tsx 初回判定リダイレクト**: `isInitialized: false` で `/wizard` リダイレクトテスト通過 + `isInitialized: true` で通常起動テスト通過

#### v1.0.1 追加 7 件以上(M6-4 / M6-5 由来)

- [ ] **(v1.0.1 追加)SettingsPage**: 基本セクションでデフォルト表示キャラ変更 → `PUT /api/config` に `{ defaults: { characterId: <選択値> } }` 送信されるテスト
- [ ] **(v1.0.1 追加)SettingsPage**: 基本セクションでデフォルトプリセット変更 → `PUT /api/config` に `{ defaults: { presetId: <選択値> } }` 送信されるテスト
- [ ] **(v1.0.1 追加)SettingsPage**: セクション 5「プリセット管理リンク」ボタンが disabled + ツールチップ「今後実装予定」表示テスト
- [ ] **(v1.0.1 追加)Header**: 「プリセット」ナビゲーションリンクが disabled + ツールチップ「今後実装予定」表示テスト
- [ ] **(v1.0.1 追加)WizardPage**: ステップ 3 でデフォルトキャラを選択、ステップ 7 完了時に `defaults.characterId` がリクエストに含まれるテスト
- [ ] **(v1.0.1 追加)WizardPage**: ステップ 4 でデフォルトプリセットを選択、ステップ 7 完了時に `defaults.presetId` がリクエストに含まれるテスト
- [ ] **(v1.0.1 追加)WizardPage**: ステップ 3 でスキップした場合、`defaults.characterId` がデフォルト値 1 で送信されるテスト

### 10.3 既存テスト回帰なし(§5.1.3)

- [ ] M5-01 比較画面 + M4-05 セットプレイ + M3-05 マイコンボ + M2 編集系 + M1 コア API の vitest 全件通過
- [ ] `cd web && pnpm test` 全件通過
- [ ] `cd web && pnpm build` 成功

### 10.4 ビルド・型チェック(§5.1.4)

- [ ] `pnpm test` / `pnpm build` 通過(フロントエンド)
- [ ] TypeScript 型エラーなし
- [ ] `go test ./...` 全件通過
- [ ] `go build ./...` 成功
- [ ] `go vet ./...` でエラーなし

---

## 11. E2E シナリオ実行結果のチェック(§5.2、v1.0.1 で H / I 追加、**v1.0.2 で J 追加**)

製造担当の完了報告に以下のシナリオ手順 + 開発者実機検証結果が **すべて含まれている** こと:

- [ ] **シナリオ A**: 初回ウィザード正常系(7 ステップ通過 + `config.toml` 自動生成 + **(v1.0.1)`[defaults]` セクション含む** + コンボ一覧遷移)
- [ ] **シナリオ B**: LAN モード設定時の挙動(ステップ 6 表示 + アプリ再起動後 LAN 端末アクセス確認)
- [ ] **シナリオ C**: 設定画面表示 + 言語切替 + QR コード表示
- [ ] **シナリオ D**: データセクションの disabled 確認(DB パス表示 + 他ボタン無効)
- [ ] **シナリオ E**: ユーザーセクションの disabled 確認(全項目無効 + ツールチップ)
- [ ] **シナリオ F**: アプリ起動時のリダイレクト確認(`isInitialized: true` で通常起動)
- [ ] **シナリオ G**: 既存機能の回帰確認(コンボ一覧 / マイコンボ / 比較等 すべて動作)
- [ ] **(v1.0.1 追加)シナリオ H**: ウィザードのデフォルトキャラ / プリセット選択の永続化確認(`config.toml` の `[defaults]` セクション書き込み + 設定画面での反映 + 変更後の永続化)
- [ ] **(v1.0.1 追加)シナリオ I**: プリセット管理リンク disabled 確認(設定画面セクション 5 + ヘッダの「プリセット」リンク両方 disabled、ヘッダのプリセット切替プルダウンは動作する)
- [ ] **(v1.0.2 追加)シナリオ J**: ヘッダの「設定」リンクとウィザード Step 3 スキップボタンの動作確認(J-1 = ヘッダ「設定」リンククリックで `/settings` 遷移 + 各画面からアクセス可能、J-2 = ウィザード Step 3 スキップボタン押下でステップ 4 遷移 + 完了時に `config.toml` の `[defaults].character_id = 1` 書き込み)

---

## 12. コード品質・規約遵守

- [ ] CLAUDE.md §2 技術スタック遵守(react-i18next / TanStack Query / Vite)
- [ ] CLAUDE.md §4 規約遵守(JSON タグ camelCase、TOML タグ snake_case、Go フィールド PascalCase、TypeScript 型 1:1 対応)
- [ ] CLAUDE.md §5 テスト規約遵守
- [ ] CLAUDE.md §6 依存追加ポリシー遵守(QR ライブラリ + react-i18next 追加、Plan Mode 承認後)
- [ ] CLAUDE.md §10 禁止事項に抵触なし(セキュリティ自己判断なし、機微情報のログ出力なし等)
- [ ] **architecture-patterns.md v1.0.4 §1 プレゼンテーション層/ロジック層分離パターン遵守**
- [ ] **architecture-patterns.md v1.0.4 §1.1 queryKey 規約遵守**(`['config']` flat tuple)
- [ ] **architecture-patterns.md v1.0.4 §2 3 層パターン遵守**(BE)
- [ ] **architecture-patterns.md v1.0.4 §2.1 サービス層インターフェース定義パターン遵守**(M6-1 反省踏襲、最重要、network 拡張 + defaults 拡張の両方で同パターン)
- [ ] **architecture-patterns.md v1.0.4 §3 エラーレスポンス共通型遵守**
- [ ] **shadcn/ui を使用していない**(playbook §17.2、M7 まで未導入)
- [ ] **設計書本体への影響なし**(M6-overview §9 既定、CHANGE 通知書起票なし)

---

## 13. ドキュメント・進捗ログ(§7.4、v1.0.1 で項目追加)

- [ ] `docs/progress/progress-log.md` に M6-02 完了報告が追記されている
- [ ] **§3.4 着手前確認サマリ(必須)**(M6-01 製造担当伝達事項 3 由来の運用改善 + **v1.0.1 で §3.4.7 設定画面 6 セクション対応表追加**)が完了報告に含まれている
- [ ] **(v1.0.1 改訂)§3.4.8 Plan Mode 必須項目 8 件**(v1.0.0 7 件 + v1.0.1 追加 1 件 = `[defaults]` フィールド設計)の開発者承認結果が完了報告に含まれている
- [ ] §4.6 設計判断事項表との整合確認結果が明記されている
- [ ] **(v1.0.2 改訂)§5.2 E2E シナリオ A〜J**(v1.0.1 で H / I 追加、v1.0.2 で J 追加)の実行結果が明記されている
- [ ] **(v1.0.1 改訂)例外条項適用箇所(§2.4 (a)〜(h))**(v1.0.1 で (f) / (g) / (h) 追加)の明示
- [ ] M5-RESEARCH-01 / M6-RESEARCH-01 / M6-01 で確立した「製造担当からの実装完了後連絡事項」(handover §6.2)が含まれている、または「乖離なし」が明記

---

## 14. 重大な問題の判定基準(v1.0.1 で項目追加)

以下のいずれかに該当する場合、**重大な問題** と判定し M6-02 完了承認を保留する:

- §1.1 / §1.2 新規ファイルが指示書 §2.1 と乖離(主要コンポーネント欠落)
- §1.3 修正ファイル `App.tsx` への `/wizard` / `/settings` ルート追加 + 初回判定リダイレクト未実装
- **(v1.0.1 追加)§1.3 修正ファイル `web/src/components/Header.tsx`(または相当)でのプリセットリンク disabled 化未実装**
- **§1.4 スコープ外への変更が含まれている**(M6-01 ハンドラ既存ロジック改変、`internal/config/config.go` の既存 4 サブ構造体変更、LAN 切替 UI 実装、パスワード認証実装、バックアップ機能実装、スマホホーム実装、下書き保存実装、**(v1.0.1)プリセット管理画面 `/presets` 実装**、shadcn/ui 導入、CHANGE 起票等、最重要)
- §2 着手前確認結果が完了報告に含まれていない(retrospective-log v1.0.19 §6 M6-1 反省踏襲、最重要観点)
- **(v1.0.1 追加)§2.2 §3.4.7 設定画面 6 セクション ↔ 既存実装実態の対応表が Plan Mode 計画提示に含まれていない**(M6-3 / M6-4 / M6-5 反省踏襲の最重要観点)
- **§3 Plan Mode 必須項目(8 件、v1.0.1 で +1)の開発者承認結果が完了報告に含まれていない**(retrospective-log v1.0.19 §6 M6-2 反省踏襲、最重要観点)
- §4 `ConfigResponse.network` 拡張が architecture-patterns §2.1 サービス層インターフェース定義パターンに違反(retrospective-log v1.0.19 §6 M6-1 違反、最重要)
- **(v1.0.1 追加)§5 `Config.Defaults` 拡張が architecture-patterns §2.1 違反 or 既存 4 サブ構造体(Server / Database / Logging / Security)に変更を含む**(M6-1 反省再発防止 + §2.3 違反、最重要)
- §6 / §7 アプリ起動時の初回判定リダイレクトが未実装または不整合
- §8 / §9 ウィザード / 設定画面の主要セクション欠落 or disabled 化されるべきボタンが有効化されている
- **(v1.0.1 追加)§9.2 基本セクションのデフォルト表示キャラ / デフォルトプリセット選択 UI が未実装または永続化されない**(M6-4 反省再発防止、最重要)
- **(v1.0.1 追加)§9.6 設定画面セクション 5 プリセット管理リンクボタンが disabled 化されていない**(M6-5 反省再発防止)
- **(v1.0.1 追加)§9.7 ヘッダのプリセットナビゲーションリンクが disabled 化されていない**(M6-5 反省再発防止)
- **(v1.0.2 追加)§9.8 ヘッダの「設定」ナビゲーションリンクが新規追加されていない**(URL 直入力以外で `/settings` にアクセス不可、DES-005 §4.1 主要ナビゲーション規定違反、M6-6 反省再発防止、最重要)
- **(v1.0.2 追加)§8.1 ウィザード Step 3「デフォルト表示キャラ選択」にスキップボタンが画面下部に可視ボタンとして実装されていない**(指示書 v1.0.2 §4.4.1 明示違反、軽微-3 連絡事項 4 由来)
- §10 必須テスト(BE 14 件 + フロント 20 件以上、v1.0.1 で件数増)のいずれかが未実装または失敗
- §10.3 既存テスト回帰
- §10.4 ビルド・型チェック失敗
- **(v1.0.2 改訂)§11 E2E シナリオ A〜J**(v1.0.1 で H / I 追加、v1.0.2 で J 追加)のいずれかが完了報告に含まれていない
- §12 architecture-patterns.md v1.0.4 違反(特に §2.1、M6-1 反省再発防止の最重要観点)
- §13 progress-log.md 完了報告に必須項目が含まれていない

---

## 15. 軽微な問題の判定基準(完了承認可、改善推奨、v1.0.1 で項目追加)

以下は軽微な問題で、完了承認は可だが次回マイルストーン以降の改善対象として記録する:

- §1.5 例外条項適用箇所の理由明記が不十分
- §4 / §5 / §9 UI 細部(色 / アニメーション / アコーディオン展開動作の細部)が DES-005 §5.16 と微妙に異なる(機能には影響なし)
- §8 ウィザード進捗バーの視覚デザイン詳細が DES-005 §5.1 規定と微妙に異なる
- §9 設定画面のセクション順序が DES-005 §5.16 と微妙に異なる(機能には影響なし)
- **(v1.0.1 追加)§9.6 / §9.7 disabled 化のツールチップ文言が「今後実装予定」と完全一致しない**(意味が同等ならば軽微、例: 「実装予定」「Coming soon」等)
- §10 テストヘルパ関数の重複(M6-01 と config 系で似たモック設定パターンが共通化されていない、YAGNI 観点で許容)
- **(v1.0.1 追加)§5.1 `[defaults]` フィールド命名が `character_id` / `preset_id` 以外(例: `default_character_id` / `default_preset_id`)**(Plan Mode で開発者承認済みなら許容、SUPP-001 §5.8 v1.14.0 表記とは乖離するが機能には影響なし)
- ドキュメント記述の細部不整合(完了報告の節構成、文体等、機能には影響なし)

---

## 16. レビュー報告書フォーマット(v1.0.1 で §4 拡張、**v1.0.2 で §2 / §5 微更新 + シナリオ範囲 A〜J**)

機械レビュー完了時に以下を含む報告書を `docs/progress/m6-02-review.md` として出力:

```markdown
# M6-02 機械レビュー報告書

## 1. レビュー実施日
2026-XX-XX

## 2. レビュー結果サマリ
- ✅ / ⚠️ / ❌ §1 ファイル一覧チェック(network 系 + defaults 系 + ヘッダ修正、v1.0.1 で項目追加、**v1.0.2 でヘッダ「設定」リンク追加**)
- ✅ / ⚠️ / ❌ §2 着手前確認結果(retrospective-log v1.0.20 §6 M6-1 反省踏襲 + §3.4.7 設定画面 6 セクション対応表 + **(v1.0.2)ヘッダ主要ナビゲーション網羅対応**)
- ✅ / ⚠️ / ❌ §3 Plan Mode 必須項目 8 件(retrospective-log v1.0.20 §6 M6-2 反省踏襲、v1.0.1 で +1 件、最重要)
- ✅ / ⚠️ / ❌ §4 ConfigResponse.network 拡張
- ✅ / ⚠️ / ❌ §5 Config.Defaults 拡張(v1.0.1 新規、最重要)
- ✅ / ⚠️ / ❌ §6 フロントエンド API クライアント
- ✅ / ⚠️ / ❌ §7 アプリ起動時の初回判定リダイレクト
- ✅ / ⚠️ / ❌ §8 初回起動ウィザード(**v1.0.2 で Step 3 スキップボタン明示配置確認**)
- ✅ / ⚠️ / ❌ §9 設定画面(v1.0.1 で基本セクション defaults + プリセット管理リンク disabled + ヘッダのプリセットリンク disabled 追加、**v1.0.2 でヘッダ「設定」リンク追加 §9.8 新設 + QR モーダル §9.9 リナンバリング**)
- ✅ / ⚠️ / ❌ §10 テスト要件(BE 14 件 + フロント 20 件以上、v1.0.1 で件数増)
- ✅ / ⚠️ / ❌ §11 E2E シナリオ A〜**J**(v1.0.1 で H / I 追加、**v1.0.2 で J 追加**)
- ✅ / ⚠️ / ❌ §12 コード品質・規約遵守
- ✅ / ⚠️ / ❌ §13 ドキュメント

## 3. Plan Mode 必須項目 8 件の開発者承認結果確認(v1.0.1 で +1 件、最重要)
- 必須項目 1(`ConfigResponse.network` 最終形): 承認方針 = ...、実装 = ...
- 必須項目 2(QR ライブラリ): 承認方針 = ...、実装 = ...
- 必須項目 3(初回判定リダイレクト位置): 承認方針 = ...、実装 = ...
- 必須項目 4(進捗バー実装方式): 承認方針 = ...、実装 = ...
- 必須項目 5(レスポンシブ実装): 承認方針 = ...、実装 = ...
- 必須項目 6(言語選択実装): 承認方針 = ...、実装 = ...
- 必須項目 7(ウィザード完了遷移先): 承認方針 = ...、実装 = ...
- **(v1.0.1 追加)必須項目 8(`[defaults]` フィールド設計)**: 承認方針 = ...、実装 = ...(TOML 命名 / JSON タグ / 型 / バリデーション)

## 4. architecture-patterns.md v1.0.4 §2.1 準拠確認(M6-1 反省再発防止の最重要観点、v1.0.1 で defaults 拡張も対象)
### 4.1 network 拡張(§4.1)
- サービス層 `Service` インターフェース定義: ○ / ×
- 非公開 `service` 構造体実装: ○ / ×
- `NewService` がインターフェース型返却: ○ / ×

### 4.2 defaults 拡張(§4.1bis、v1.0.1 新規)
- `Service` インターフェース戻り値拡張が同パターン踏襲: ○ / ×(`*Service` 具象型ポインタを返していないか)
- 既存 4 サブ構造体(Server / Database / Logging / Security)の変更なし: ○ / ×
- `DefaultsConfig` 構造体追加が `internal/config/config.go` 内で完結: ○ / ×

## 5. 設定画面 6 セクション ↔ 既存実装実態の対応表確認(v1.0.1 新規 + **v1.0.2 で拡張**、M6-3 / M6-4 / M6-5 / **M6-6** 反省踏襲、最重要)
- 製造担当の Plan Mode 計画提示に対応表 15 項目が完全に埋められているか: ○ / ×
- 未確認項目の有無: あり / なし
- **(v1.0.2 追加)ヘッダ主要ナビゲーション 4 リンク(コンボ一覧 / マイコンボ / プリセット / 設定)の現状実装と既存ルートの対応関係確認**: ○ / ×(M6-6 教訓踏襲、対応表のスコープを UI 全範囲に拡張)

## 6. 検出した問題
### 6.1 重大な問題(完了承認保留)
(該当する場合、§14 判定基準のどれに該当するか明記)

### 6.2 軽微な問題(完了承認可、改善推奨)
(該当する場合、§15 判定基準のどれに該当するか明記)

### 6.3 改善提案(次回マイルストーン以降)
(該当する場合)

## 7. 制約事項
- 本レビューは静的コードレビュー。**実機テスト(ブラウザでの動作確認、E2E シナリオ A〜J の実行、LAN モード切替の実機検証、QR コード読取テスト、`config.toml` の `[defaults]` セクション確認、ヘッダのプリセットリンク disabled 視覚確認、**(v1.0.2)ヘッダの「設定」リンクからの `/settings` 遷移視覚確認**、**(v1.0.2)ウィザード Step 3 スキップボタンの可視配置 + 動作確認**)は別途実施が必要**(playbook §14)
- 動作確認シナリオの手動確認は開発者の責任範囲

## 8. 完了承認判定
- ✅ 完了承認可 / ⚠️ 条件付き承認(改善後) / ❌ 完了承認保留(重大な問題あり)
```

---

*以上*
