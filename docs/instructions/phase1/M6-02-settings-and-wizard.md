# 指示書 M6-02: 設定画面 + 初回起動ウィザード + ConfigResponse 拡張(network 情報追加 + defaults セクション追加)

| 項目 | 内容 |
|------|------|
| 指示書ID | M6-02 |
| バージョン | 1.0.2 |
| 推奨モデル | Opus 4.6(関心数 2 + UI 規模大 + 複数システム統合 + アプリ起動時の初期判定リダイレクト + `Config` 構造体 + SUPP-001 §5.8 拡張) |
| Plan Mode | **必須**(下記 §3.4.8 に必須 8 項目あり、v1.0.1 で +1 件追加) |
| 機械レビュー | 必須(レビューモデル: Sonnet 4.6、別ファイル M6-02-review-checklist.md **v1.0.2**) |
| 並列性 | 単独 |
| 依存指示書 | M6-01 完了済み(2026-05-23) |
| 想定所要時間 | 150〜180 分(v1.0.1 で +30 分の `Config` 構造体 + プリセット管理リンク disabled 化対応含む = 実質 180〜210 分)+ **(v1.0.2 追加)+30〜60 分**(ヘッダ「設定」リンク追加 + ウィザード Step 3 スキップボタン追加) |
| 作成者・作成日 | 設計担当 Claude(M6 期間担当)、2026-05-23 |

## 更新履歴

| バージョン | 更新日 | 更新内容 |
|-----------|--------|----------|
| 1.0.0 | 2026-05-23 | 初版作成。M6-overview v1.0.0 §4.3 + M6-01 完了報告(2026-05-23)を踏まえて作成。M6-01 で確定した `ConfigResponse` 構造を `network: { primaryLanIp, lanUrl }` で拡張する追加実装を含む(設計担当の M6-RESEARCH-01 スコープ設定時の見落とし、retrospective-log v1.0.18 §6 に M6-3 として記録予定) |
| 1.0.1 | 2026-05-23 | M6-02 v1.0.0 製造担当 Plan Mode 着手後の確認事項 1 + 2 由来の改訂。**3 つの追加スコープを反映**: (1) **確認事項 1 案 2-c**: `config.go` への `DefaultsConfig` 構造体 + `Config.Defaults` フィールド追加 + SUPP-001 §5.8 追記(retrospective-log v1.0.19 §6.1 M6-4 由来、SUPP-001 v1.13.0 → v1.14.0 で本セッション改訂済み)。ウィザード ステップ 3-4 + 設定画面基本セクションの「デフォルト表示キャラ / デフォルトプリセット」の永続化対応。(2) **確認事項 2 案 1**: 設定画面セクション 5「プリセット管理へのリンク」+ ヘッダの「プリセット」ナビゲーションリンクを **disabled + ツールチップ「今後実装予定」** 化(retrospective-log v1.0.19 §6.1 M6-5 由来、P-1 として §6.6 暫定記録)。`/presets` ルートは実装漏れ判定(解釈 A、フェーズ 2 送り意図ではない)、ただし実装マイルストーン割当は M6 終了間近で再協議。(3) **§3.4.7 Plan Mode 必須項目 +1 件追加**(必須項目 8 = `[defaults]` セクションのフィールド設計、M6-2 反省踏襲)。**§3.4 着手前確認 +1 件追加**(§3.4.X = 設定画面 6 セクション ↔ 既存実装実態の対応表作成、M6-3 / M6-4 / M6-5 反省踏襲)。**§2.4 例外条項 +3 件追加**(f / g / h、`config.go` 拡張 + `internal/config/config_test.go` 拡張 + SUPP-001 §5.8 追記)|
| 1.0.2 | 2026-05-23 | M6-02 v1.0.1 E2E 完了後の連絡事項 3 + 4 反映の軽微改訂(M6-6 由来 + 軽微-3、retrospective-log v1.0.20 §6.1 M6-6 + §6.6 連絡事項 4)。**2 件の追加スコープを反映**: (1) **連絡事項 3(M6-6、Q-C 案 a 採用)**: DES-005 §4.1 主要ナビゲーション規定の整合確保のため、`web/src/components/Header.tsx`(または相当)に **`/settings` への「設定」ナビゲーションリンクを新規追加**。M6-02 v1.0.1 時点では URL 直入力以外で `/settings` に到達できない UX 劣化状態だったため、§4.5.7 を「ヘッダのプリセットリンク disabled 化 + 設定リンク追加」の併記節に拡張(節タイトル変更、内容追記)。(2) **連絡事項 4(軽微-3)**: ウィザード Step 3「デフォルト表示キャラ選択」に **スキップボタン** を実装明示(指示書 §4.4.1 v1.0.1 で「スキップ可能」と書いたが実装漏れだったため補正、スキップ時は `UpdateConfigRequest.Defaults.CharacterID = 1` 送信)。**追加スコープ**: §1.2 目的 +2 項目、§2.2 修正ファイル(Header.tsx)に「設定リンク追加」記載追加、§4.4.1 Step 3 にスキップボタン仕様明示追加、§4.5.7 節タイトル + 内容拡張(設定リンク追加仕様)、§5.2 E2E シナリオ J 新規追加(ヘッダ「設定」リンク経由の `/settings` 遷移確認)、§7.1 完了条件 +2 項目、§9.4 Plan Mode 計画提示時の項目に E2E シナリオ範囲 A〜J を反映。**新規 CHANGE 通知書なし**(DES-005 §4.1 主要ナビゲーション規定との整合確保のため、設計書本体改訂は不要)。**スマホフッター(DES-005 §4.2)の「設定」ボタンは本指示書スコープ外**、M6-03 で対応(対応表のスコープを「指示書で扱う UI 全範囲」に拡張する M6-6 教訓踏襲、§1.3 で明示)。**連絡事項 1(Step 6 パスワード設定 UI 省略)+ 連絡事項 2(ウィザード中 LAN 接続情報表示見送り)** は設計担当が追認のみ、本指示書改訂不要(連絡事項 1 はフェーズ 2 でのパスワード認証実装時に Step 6 復活必要、m6-to-m7-handover で記録予定)。**ついでに修正**: メタ情報の Plan Mode 行で「§3.4.7 に必須 8 項目」と誤って参照していた箇所を **「§3.4.8」に訂正**(必須項目リストの実体は §3.4.8、v1.0.1 から残っていた軽微な誤記)|

---

## 1. 背景と目的

### 1.1 背景

M6(初期体験系)スコープのうち、設定画面 + 初回起動ウィザードを M6-02 として実装する。M6-01 で実装済みの `GET /api/config` / `PUT /api/config` を消費するフロント実装が中心。

M6-01 完了報告(2026-05-23)で以下が確定済み:

- `GET /api/config` レスポンス DTO 構造(`server` / `database` / `logging` / `security` + `isInitialized` + `restartRequired`)
- `PUT /api/config` 部分更新ポリシー(SUPP-001 §5.9、JSON 未指定フィールドは変更なし)
- `isInitialized` 判定(`os.Stat(configPath)`、サービス層 `fileExists()`)
- `restartRequired` 仕様(mode 変更時のみ true)
- CSRF ヘッダー `X-Requested-With: XMLHttpRequest` 必須

本指示書では設定画面 + 初回起動ウィザードに加えて、**M6-01 で見落とした `ConfigResponse.network` フィールド追加**(LAN IP + LAN URL、設定画面のネットワークセクション + QR コード表示に必要)も含む。

### 1.2 目的

本指示書完了時に以下を達成する:

- 設定画面(`/settings`)が動作し、6 セクション(基本 / ユーザー / ネットワーク / データ / プリセット管理リンク / 詳細)の表示・編集が可能
- 初回起動ウィザード(`/wizard`)が動作し、7 ステップを通じて基本設定の対話的セットアップが可能
- ウィザード完了時に `PUT /api/config` 経由で `config.toml` が自動生成され、コンボ一覧へ遷移
- アプリ起動時に `GET /api/config` を呼び、`isInitialized: false` なら `/wizard` に自動リダイレクト
- `ConfigResponse.network` フィールド(`primaryLanIp` / `lanUrl`)が追加され、設定画面のネットワークセクション表示と QR コード表示で活用される
- **(v1.0.1 追加)`ConfigResponse.defaults` フィールド(`characterId` / `presetId`)が追加され、ウィザード ステップ 3-4 + 設定画面基本セクションで選択した値が `config.toml` に永続化される**
- **(v1.0.1 追加)設定画面セクション 5「プリセット管理へのリンク」+ ヘッダの「プリセット」ナビゲーションリンクが disabled + ツールチップ「今後実装予定」で表示される**(`/presets` ルート未実装、P-1 持ち越し)
- **(v1.0.2 追加)ヘッダの主要ナビゲーションに「設定」リンクが追加され、`/settings` へ URL 直入力以外の手段で遷移可能になる**(DES-005 §4.1 主要ナビゲーション規定との整合確保、M6-6 由来、Q-C 案 a)
- **(v1.0.2 追加)ウィザード Step 3「デフォルト表示キャラ選択」でスキップボタンが動作する**(指示書 §4.4.1 v1.0.1「スキップ可能」明示の実装漏れ補正、スキップ時はデフォルト値 1 = リュウを送信、軽微-3)
- `web/src/lib/configApi.ts` が 1 ファイル設計で実装され、設定画面・初回ウィザードの両方から共有される
- 既存機能(M1〜M5 + M6-01)に回帰なし

### 1.3 このマイルストーンで作らないもの

- **LAN 共有モード切替トグル UI**(SUPP-001 §4.2 でフェーズ 2 送り明記、M6-overview §1.3 既定): ネットワークセクションには「現在のモード表示」+「接続情報表示」+「QR コード表示」のみ、モード切替トグルはフェーズ 2 送り
- **パスワード設定の認証ロジック**(SUPP-001 §4.2 / CLAUDE.md §10、M6-overview §1.3 既定): ウィザードステップ 6 / 設定画面ユーザーセクションのパスワード設定 UI は表示するが、**実際の認証フローへの組み込みは行わない**。`PUT /api/config` で `SecurityConfig.PasswordEnabled` を送信する程度に留める(`PasswordHash` 等の機微情報フィールドは現状未実装)
- **複数ユーザー管理機能の実装**(SUPP-001 §4.2 認証フェーズ 2 関連): ユーザーセクションのユーザー追加・編集・削除 UI は **構造だけ用意 + disabled + ツールチップ「フェーズ 2 で実装」**。実際のユーザー管理 API(`GET /api/users` 等)は実装しない
- **バックアップ / リストア / レシピキャッシュ再構築機能**(DES-005 §5.16 データセクション、Q-ii 案 i 採用): データセクションは **DB ファイルパス表示のみ実装**(`ConfigResponse.database.path` から取得)、バックアップ/リストア/キャッシュ再構築ボタンは **UI 構造のみ用意 + disabled + ツールチップ「フェーズ 2 で実装」**。実際のバックアップ系 API は実装しない
- **手動 IP 指定機能**(SUPP-001 §2.6.2 「想定されないケースでの備え」フェーズ 2 検討事項): ネットワークセクションには `netutil.SelectPrimaryLANIP()` で自動選定した IP のみ表示、手動指定 UI は実装しない
- **`extra_allowed_origins` 設定 UI**(SUPP-001 §2.6.1 フェーズ 2 検討事項): ネットワークセクションには表示しない
- **ホーム画面(スマホ専用)**(DES-005 §5.2): M6-03 で実装、M6-02 では扱わない。ウィザード完了時の遷移先は **常にコンボ一覧**(`/`)に統一(スマホ判定によるホーム画面分岐は M6-03 で追加実装する想定)
- **(v1.0.2 追加)スマホフッター(DES-005 §4.2)の「設定」ボタン**: M6-03(スマホ専用ホーム)スコープに含めて対応する(スマホフッター 4 ボタン = コンボ一覧 / マイコンボ / 新規登録 / 設定 はスマホ UI 全般のため、M6-03 で集約実装)。本 M6-02 v1.0.2 ではヘッダ(PC + スマホハンバーガー)の「設定」リンク追加のみ対応
- **下書き自動保存機能**(FR603): M6-04 で実装、M6-02 では扱わない
- **既存画面(M1〜M5 実装済み + M6-01 API)のスマホ向けレスポンシブ調整**: M7「レスポンシブ仕上げ」で対応(handover §3.1 R-1、M6-overview §1.3 既定)
- **設計書本体(REQ-001 / DES-001〜DES-006)の改訂**: 現時点で M6-02 期間中の追加 CHANGE 起票見込みなし(M6-overview §9)
- **(v1.0.1 追加)プリセット管理画面 `/presets`(DES-005 §5.10 + §5.11)の実装**: SUPP-001 §4.1 マイルストーン分割表で M1〜M7 のどこにも実装割当なし(設計担当の見落とし、retrospective-log v1.0.19 §6.1 M6-5 で独立記録)。開発者と協議の結果「実装漏れ」と判定(解釈 A、フェーズ 2 送り意図ではない)、ただし実装マイルストーン割当(M7 / M6 末尾 / 新規 M6.5 の 3 択)は M6 終了間近で再協議。本指示書では設定画面セクション 5「プリセット管理へのリンク」+ ヘッダの「プリセット」ナビゲーションリンクを **disabled + ツールチップ「今後実装予定」** で表示(§4.5.X / §4.X 詳細仕様参照)、P-1 として retrospective-log v1.0.19 §6.6 に暫定記録 + m6-to-m7-handover 作成時に正式移管予定
- 持ち越し課題 C-2 / C-3 / C-4 / L-02 / L-03 / L-04 / R-1〜R-3 / M-1〜M-4 / **P-1(v1.0.1 追加)**: M6-02 スコープ外

---

## 2. 成果物

### 2.1 作成するファイル

#### バックエンド(`ConfigResponse.network` フィールド追加、M6-01 拡張)

- `internal/service/config/service.go`(M6-01 で新設、本指示書で **追加メソッド + フィールド追加**)
- `internal/api/config/dto.go`(M6-01 で新設、本指示書で **NetworkDTO 追加 + ConfigResponse 拡張**)
- `internal/service/config/service_test.go`(M6-01 で新設、本指示書で **network 関連テスト追加**)
- `internal/api/config/handler_test.go`(M6-01 で新設、本指示書で **network 関連テスト追加**)

#### バックエンド(`Config.Defaults` 構造体追加、v1.0.1 で追加、M6-4 由来)

- `internal/config/config.go`(M1 既存、本指示書 v1.0.1 で **`DefaultsConfig` 構造体追加 + `Config.Defaults` フィールド追加 + `Default()` のデフォルト値追加 + `validate()` のバリデーション項目追加**)
- `internal/config/config_test.go`(M1 既存、本指示書 v1.0.1 で **`[defaults]` セクション関連テスト追加**)
- `internal/api/config/dto.go`(本指示書 v1.0.0 で network 拡張済み、v1.0.1 で **DefaultsDTO 追加 + `ConfigResponse.Defaults` フィールド追加 + `UpdateConfigRequest.Defaults` 部分更新対応**)
- `internal/service/config/service.go`(本指示書 v1.0.0 で network 拡張済み、v1.0.1 で **defaults フィールドの読み書き対応**)
- `internal/service/config/service_test.go`(同上、v1.0.1 で **defaults 関連テスト追加**)
- `internal/api/config/handler_test.go`(同上、v1.0.1 で **defaults 関連テスト追加**)

**注 v1.0.1**: `internal/config/config.go` の変更は M6-02 v1.0.0 で **§2.3 「変更しないもの」に明記** されていたが、確認事項 1 案 2-c 採用で **§2.4 例外条項 (f) として許容**(M6-4 反省踏襲、retrospective-log v1.0.19 §6.1)。既存 `Server` / `Database` / `Logging` / `Security` の 4 サブ構造体は **変更しない**(`Defaults` 構造体の追加のみ許容)。

#### フロントエンド(新設、M6-02 主要スコープ)

- `web/src/lib/configApi.ts`(新規) — `GET /api/config` / `PUT /api/config` の API クライアント、設定画面 + 初回ウィザードで共有
- `web/src/features/config/`(新規ディレクトリ、配下ファイル一覧は Plan Mode で確定):
  - `web/src/features/config/useConfig.ts`(新規) — `GET /api/config` のロジックフック(TanStack Query)
  - `web/src/features/config/useUpdateConfig.ts`(新規) — `PUT /api/config` の mutation フック
  - `web/src/features/config/types.ts`(新規) — TypeScript 型定義(`ConfigResponse` / `UpdateConfigRequest`)、M6-01 確定の JSON キーと 1:1 対応
- `web/src/pages/SettingsPage.tsx`(新規) — `/settings` ルートの設定画面
- `web/src/pages/WizardPage.tsx`(新規) — `/wizard` ルートの初回ウィザード
- `web/src/features/config/SettingsSectionBasic.tsx`(新規想定) — 基本セクション(言語選択 / デフォルトキャラ / デフォルトプリセット)
- `web/src/features/config/SettingsSectionUser.tsx`(新規想定) — ユーザーセクション(disabled + ツールチップ表示)
- `web/src/features/config/SettingsSectionNetwork.tsx`(新規想定) — ネットワークセクション(モード表示 / 接続情報 / QR コード表示ボタン)
- `web/src/features/config/SettingsSectionData.tsx`(新規想定) — データセクション(DB パス表示のみ + 他は disabled)
- `web/src/features/config/SettingsSectionDetails.tsx`(新規想定) — 詳細セクション(ログパス / バージョン)
- `web/src/features/config/QRCodeModal.tsx`(新規) — QR コード表示モーダル(FR407、LAN モード時のみ有効)
- `web/src/features/wizard/`(新規ディレクトリ、配下ファイル一覧は Plan Mode で確定):
  - `web/src/features/wizard/WizardProgress.tsx`(新規想定) — 進捗バー(7 ステップの現在地表示)
  - `web/src/features/wizard/Step01Welcome.tsx`(新規想定) — ようこそ
  - `web/src/features/wizard/Step02Language.tsx`(新規想定) — 言語選択
  - `web/src/features/wizard/Step03Character.tsx`(新規想定) — デフォルトキャラ
  - `web/src/features/wizard/Step04Preset.tsx`(新規想定) — プリセット選択
  - `web/src/features/wizard/Step05Lan.tsx`(新規想定) — LAN 共有モード
  - `web/src/features/wizard/Step06Password.tsx`(新規想定) — パスワード設定(LAN 有効時のみ表示、UI 表示のみ)
  - `web/src/features/wizard/Step07Complete.tsx`(新規想定) — 完了
- `web/src/lib/i18n.ts`(新規 or 既存拡張) — react-i18next 初期化(§3.4 着手前確認で実態確認、初期化済みなら拡張、未実装なら新規)

**注**: 上記コンポーネント分割は **推奨形式**。`Step01〜Step07` を 1 ファイルに集約するか分割するかは Plan Mode で確定(製造担当の実装裁量範囲)。各セクションコンポーネントの分離も同様に Plan Mode で確定(設計担当推奨は **5 セクション独立コンポーネント分離**、表示専用 + ロジックは親 `SettingsPage` から props 渡し、architecture-patterns §1 プレゼンテーション層/ロジック層分離パターン踏襲)。

#### テスト(新規)

- `web/src/features/config/useConfig.test.tsx`(新規想定) — TanStack Query ロジックテスト
- `web/src/features/config/useUpdateConfig.test.tsx`(新規想定)
- `web/src/pages/SettingsPage.test.tsx`(新規想定) — 設定画面の表示確認
- `web/src/pages/WizardPage.test.tsx`(新規想定) — ウィザードフロー確認

### 2.2 修正するファイル

- `web/src/App.tsx`(既存) — `/wizard` / `/settings` ルートを追加、アプリ起動時の `GET /api/config` 呼出 + `isInitialized: false` 時の `/wizard` リダイレクト処理を追加
- `web/src/main.tsx`(既存、必要時のみ) — react-i18next 初期化が `main.tsx` に書かれる場合
- `web/package.json`(既存) — QR コード生成ライブラリ追加(`qrcode.react` 推奨、Plan Mode で確定)+ react-i18next が未導入の場合追加
- `cmd/combomgr/main.go`(既存) — `NewService` 関数シグネチャ変更が発生した場合に DI 配線修正(M6-01 サービス層拡張で `netutil.SelectPrimaryLANIP()` を呼ぶための依存追加が必要、Plan Mode で確定)
- **(v1.0.1 追加 + v1.0.2 拡張)`web/src/components/Header.tsx`(または相当ファイル、既存)** — DES-005 §4.1 主要ナビゲーションの 2 点修正:
  - (v1.0.1)「プリセット」リンクを **disabled + ツールチップ「今後実装予定」** で表示する修正(`/presets` ルート未実装、retrospective-log v1.0.19 §6.1 M6-5 由来、M6-02 v1.0.1 §3.4.7 着手前確認で実態確認後に対応位置確定)
  - **(v1.0.2 追加)**「設定」ナビゲーションリンクの新規追加(リンク先 `/settings`、M6-02 v1.0.1 で新設したルート、retrospective-log v1.0.20 §6.1 M6-6 由来 + 連絡事項 3 = Q-C 案 a)。DES-005 §4.1 主要ナビゲーション規定「コンボ一覧、マイコンボ、プリセット、設定へのリンク」の「設定」項目との整合確保

### 2.3 変更しないもの(原則)

- M6-01 で実装した `internal/api/config/handler.go` / `routes.go` の **既存ハンドラ関数本体**(`ConfigResponse` 構造拡張 + Defaults 対応のみ許容、レスポンス構築ロジックは温存)
- **(v1.0.1 改訂)`internal/config/config.go` の既存 `Server` / `Database` / `Logging` / `Security` の 4 サブ構造体定義** は変更しない(M1 既存、M6-01 でも変更しなかった)。**ただし `Defaults` サブ構造体の追加 + `Config.Defaults` フィールド追加 + `Default()` の defaults デフォルト値追加 + `validate()` の defaults バリデーション追加 は §2.4 例外条項 (f) として許容**(M6-4 反省踏襲)
- `cmd/combomgr/main.go:determineBindAddr()` / `buildAllowedOrigins()`(M1 既存、M6-01 でも変更しなかった)
- `internal/infra/netutil/`(M1 既存、M6-02 では `SelectPrimaryLANIP()` を **読出のみ** 利用、関数本体は変更しない)
- 設計書本体(REQ-001 / DES-001〜DES-006)
- playbook / architecture-patterns.md / handover
- **(v1.0.1 改訂)SUPP-001 は §5.8 設定ファイル例 `[defaults]` セクション追記済み**(本セッションで v1.13.0 → v1.14.0 改訂済み、CHANGE 通知書不要 = SUPP-001 自由改訂)。製造担当は **SUPP-001 自体を変更しない**(設計担当が改訂済み)
- 他ドメインのハンドラ・サービス・リポジトリ(combo / preset / move / tag / character / setup / debug)
- 既存フロント画面(コンボ一覧 / マイコンボ / コンボ詳細 / コンボ登録 / セットプレイ / タグ管理 / ゴミ箱 / 比較)— `App.tsx` のルーティング追加以外で変更しない
- **(v1.0.1 改訂 + v1.0.2 追加)`web/src/components/Header.tsx`(または相当ファイル)** は **「プリセット」ナビゲーションリンクの disabled 化(v1.0.1)+ 「設定」ナビゲーションリンクの新規追加(v1.0.2)** のみ修正、他の項目(コンボ一覧 / マイコンボ等の既存リンク、プリセット切替プルダウン、言語切替、ユーザー表示、モード表示)は変更しない

### 2.4 例外条項

以下は本指示書スコープ内で実施を **許容** する例外:

- (a) **M6-01 `ConfigResponse` の拡張**: `Network NetworkDTO` フィールド追加、`NetworkDTO` 構造体新設(`PrimaryLanIp string` / `LanUrl string`)。サービス層 `Get()` メソッドで `netutil.SelectPrimaryLANIP()` を呼ぶ実装追加。これは M6-01 完了報告時点の API 構造を拡張するため例外条項として明示。M6-01 設計担当(本セッション)の M6-RESEARCH-01 スコープ設定時の見落としに起因(retrospective-log v1.0.19 §6 M6-3)
- (b) **`web/package.json` 依存追加**(CLAUDE.md §6 依存追加ポリシー準拠): QR コード生成ライブラリ(`qrcode.react` 推奨)+ react-i18next が未導入なら追加。Plan Mode で開発者承認後に追加
- (c) **react-i18next 初期化ファイル新設**(`web/src/lib/i18n.ts` 等): §3.4 着手前確認で実態確認、未実装なら本指示書スコープ内で初期化 + 最低限の翻訳キー(設定画面 + ウィザード用)を追加。**全画面の翻訳キー整備は M7「i18n(英語ロケール整備)」のスコープ送り**(M6-overview §10.4 リスク対策)、本指示書では M6-02 範囲のキーのみ
- (d) **DTO 型定義の細部設計**: M6-01 確定の `ConfigResponse` JSON キー(`maxSizeMb` / `passwordEnabled` / `isInitialized` / `restartRequired`)と 1:1 で TypeScript 型を定義(camelCase 統一)。これは M6-01 完了報告の指示通り
- (e) **新規エラーコード文字列の追加**: M6-01 と同じく **小文字スネークケース統一**(`network_unavailable` / `lan_ip_not_found` 等、§4.x で具体化、Plan Mode で確定)
- **(v1.0.1 追加)(f) `internal/config/config.go` への `DefaultsConfig` 構造体追加 + `Config.Defaults` フィールド追加 + `Default()` defaults デフォルト値追加 + `validate()` defaults バリデーション追加**: M6-02 v1.0.0 §2.3 で「変更しない」と明記していたが、確認事項 1 案 2-c 採用で追加実装を許容(retrospective-log v1.0.19 §6.1 M6-4)。**既存 4 サブ構造体(Server / Database / Logging / Security)は変更しない**(`Defaults` の追加のみ)
- **(v1.0.1 追加)(g) `internal/config/config_test.go` への defaults 関連テスト追加**: 上記 (f) に伴うテスト追加。既存 7 テストケースは変更しない(追加のみ許容)
- **(v1.0.1 追加)(h) SUPP-001 §5.8 設定ファイル例への `[defaults]` セクション追記**: 設計担当が本セッションで SUPP-001 v1.13.0 → v1.14.0 として **既に改訂済み**。製造担当は SUPP-001 自体を変更せず、§5.8 v1.14.0 の表記を参照して実装する

許容しないもの(再掲、§2.3 参照):

- M6-01 のハンドラ層既存ロジックの変更(`ConfigResponse` 構造拡張 + Defaults 対応のみ許容)
- 既存設定 API のエンドポイントパス変更
- 既存 `Config.Server` / `.Database` / `.Logging` / `.Security` の 4 サブ構造体への変更
- 設計書本体の変更
- **(v1.0.1 改訂)プリセット管理画面 `/presets`(DES-005 §5.10 + §5.11)の実装**(P-1 持ち越し、M6 終了間近で再協議)
- 新規 CHANGE 通知書の起票(M6-overview §9 既定、本指示書スコープ内では起票見込みなし、必要発生時は Plan Mode 停止 → 開発者協議)

---

## 3. 前提条件

### 3.1 必読ドキュメント

| ID / ファイル | 関連箇所 |
|--------------|---------|
| REQ-001 v2.11.0 | FR101 ユーザー管理(初回ウィザード ステップ 6 関連、M6-02 では UI のみ)、FR407 QR コード表示、FR603 下書き保存(M6-04 スコープ、本書では参照のみ) |
| DES-002 v1.8.0 | §3.2 バインドアドレスの制御 / §3.4 公開状態の明示と警告 / §4.2 主要エンドポイント表 / §4.4 CORS・CSRF / §5.4 多言語対応(react-i18next) |
| DES-005 v2.8.0 | §4.1 ヘッダ / §4.3 共通要素 / §4.4 レスポンシブブレークポイント / **§5.1 初回起動ウィザード** / **§5.16 設定画面** |
| SUPP-001 v1.13.0 | §2.6.1 CORS 許可 Origin / §2.6.2 QR コード IP 選定(`netutil.SelectPrimaryLANIP()` の実装範囲) / §4.2 LAN 共有バインドロジック / §5.8 設定ファイルフォーマット(初回ウィザード完了時の自動生成規定) / §5.9 PATCH 系省略可能フィールド送信ポリシー |
| architecture-patterns.md v1.0.4 | §1 プレゼンテーション層/ロジック層分離 / §1.1 TanStack Query queryKey 規約 / §2 BE 3 層パターン / **§2.1 サービス層インターフェース定義パターン**(M6-01 で確立、本指示書のサービス層拡張で踏襲) / §3 エラーレスポンス共通型 |
| CLAUDE.md | §2 技術スタック(react-i18next、TanStack Query)/ §4 規約(JSON タグ camelCase) / §5 テスト規約 / §6 依存追加ポリシー / §10 禁止事項 |
| M6-RESEARCH-01 調査レポート(2026-05-23) | §4.3 既存サーバー起動コード + `netutil.SelectPrimaryLANIP()` 呼出箇所 |
| M6-overview v1.0.0 | §1.3 このマイルストーンで作らないもの / §2.2 設定 API スコープ / §2.3 設定画面と初回ウィザードの API 共通化 / §2.5 スマホホーム遷移先 / §2.7 初回判定方法 / §4.3 M6-02 概要 |
| M6-01 完了報告(2026-05-23) | `ConfigResponse` 確定構造 / `PUT` 部分更新ポリシー / `isInitialized` 実装 / `restartRequired` 仕様 / CSRF ヘッダー要件 |

### 3.2 任意参照(必要時のみ)

| ID / ファイル | 用途 |
|--------------|------|
| `web/src/pages/CompareComboPage.tsx`(M5-01 で実装) | 直近の新規ページ追加パターン参照(ルーティング + データ取得 + レンダリング) |
| `web/src/pages/MyCombosPage.tsx`(M3-04 で実装) | 軽量フロント実装の参照例 |
| `web/src/features/combo/`(M1-06 / M2 / M3 / M4 で実装) | 既存 feature ディレクトリ構成の参照 |
| `internal/service/config/service.go`(M6-01 で実装) | サービス層拡張の起点、既存 `Get()` メソッドへの `network` 取得追加 |
| `internal/infra/netutil/private_ip_test.go`(M1 既存) | `SelectPrimaryLANIP()` の挙動確認(テスト関数名から推測) |

### 3.3 参照不要

- マイグレーション関連(`internal/infra/migration/`、本 M6-02 では DB マイグレーション追加なし)
- M1〜M5 の指示書本体(必要箇所は本指示書で要約済み、M6-01 完了報告で詳細伝達済み)
- バックアップ / リストア / レシピキャッシュ再構築機能の実装詳細(Q-ii 案 i 採用でスコープ外)

### 3.4 着手前の確認(製造担当 Plan Mode で実施、結果を計画提示に含める)

製造担当 Claude Code は §4 着手前に、以下を `view` で実コード確認し、Plan Mode の計画提示に **結果を含める**。M4 期間 9 件 + M6 期間 1 件発生した「実コード確認の省略」(retrospective-log §6.2)を本指示書でも厳格に防ぐ。

#### 3.4.1 既存サービス層インターフェース定義パターンの確認(M6-1 反省踏襲、architecture-patterns §2.1)

- [ ] `view internal/service/config/service.go` で M6-01 実装の `Service` インターフェース定義 + 非公開 `service` 構造体 + `NewService` コンストラクタを確認
- [ ] 本指示書 §4.1(`ConfigResponse.network` 追加実装)で `Service.Get()` メソッドへの拡張時、既存インターフェースに **`Get()` シグネチャの追加引数なし**(戻り値の `*Config` 構造体内に `Network` が含まれる形)で対応可能か確認
- [ ] `internal/service/setup/`、`internal/service/character/` 等の既存サービス層実装と本パターンの整合性確認

#### 3.4.2 既存ルート定義 + ページパターンの確認

- [ ] `view web/src/App.tsx`(または相当ファイル)で既存ルート定義を確認(`/` / `/combos` / `/mycombos` / `/compare` / `/presets` / `/setups/:id` / `/trash` 等の予約状況、M5-RESEARCH-01 §4.4 既確認だが念のため再確認)
- [ ] `/wizard` / `/settings` ルートが **既に予約されていない** ことを確認(予約されている場合は Plan Mode 停止 → 開発者協議)
- [ ] `/` ルートの既存実装(`HomePage` or `CombosPage` への直接マウント等)を確認、M6-02 で `/wizard` リダイレクトを追加する位置を確定

#### 3.4.3 react-i18next の実装状態確認(M6-overview §10.4 リスク対策)

- [ ] `view web/package.json` で `react-i18next` / `i18next` パッケージの追加有無確認
- [ ] `find web/src -name 'i18n*'` で初期化ファイル(`web/src/lib/i18n.ts` 等)の存在確認
- [ ] 翻訳キー定義ファイル(`web/src/locales/ja.json` / `en.json` 等)の存在確認
- [ ] 既存画面で `useTranslation()` フックが使われているか確認(M1〜M5 で実装済みなら、本指示書はキー追加のみ。未実装なら初期化 + 最低限のキー(設定画面 + ウィザード用)を本指示書スコープ内で追加、M7「i18n(英語ロケール整備)」で全画面整備)

#### 3.4.4 `web/src/lib/fetchJSON.ts` の `X-Requested-With` ヘッダー自動付与確認(M6-01 完了報告で CSRF ヘッダー要件確認)

- [ ] `view web/src/lib/fetchJSON.ts`(または相当ファイル)で `X-Requested-With: XMLHttpRequest` ヘッダーが **既存ヘルパで自動付与** されているか確認
- [ ] 自動付与なしの場合は `configApi.ts` で明示付与する必要があるため Plan Mode で対処方針確定
- [ ] M4-02 由来既知パターン(M3-05 完了時に PUT/PATCH 系全件で X-Requested-With 統一済みなら追加対応不要、未統一なら本指示書スコープ内で追加実装)

#### 3.4.5 既存フォーム部品の確認(架構パターン §1 / §4.9 既存 UI コンポーネントの 3 点セット確認)

- [ ] **キャラクター選択 UI**: `useCharacters` フック(M3-04 由来)+ キャラクター選択コンポーネント(コンボ登録画面で使用、M2 / M4-04 で確立)の構造 + 責務 + Props を確認、ウィザード ステップ 3「デフォルトキャラ選択」+ 設定画面基本セクション「デフォルト表示キャラ」で再利用可能か判断
- [ ] **プリセット選択 UI**: `usePresets` フック(M3-03 由来)+ プリセット選択コンポーネント(プリセット管理画面 / ヘッダプルダウンで使用、M3-05 / M4 で確立)の構造 + 責務 + Props を確認、ウィザード ステップ 4「プリセット選択」+ 設定画面基本セクション「デフォルトプリセット」で再利用可能か判断
- [ ] 確認結果は完了報告に明示(再利用採用 / 新規実装、判断根拠)

#### 3.4.6 `netutil.SelectPrimaryLANIP()` の戻り値挙動確認(M6-01 サービス層拡張で利用)

- [ ] `view internal/infra/netutil/` 配下(M6-RESEARCH-01 §4.3 で確認済み、再確認)で `SelectPrimaryLANIP()` の戻り値型(`(net.IP, error)`)を確認
- [ ] エラー発生条件(候補が 1 つも見つからない場合等、SUPP-001 §2.6.2 規定)を確認
- [ ] `IsVirtualInterface()` / `ListPrivateIPv4()` の役割を確認(本指示書では `SelectPrimaryLANIP()` 経由のみ利用、これらの関数は直接呼ばない)

#### 3.4.7 設定画面 6 セクション ↔ 既存実装実態の対応表作成(v1.0.1 で新設、M6-3 / M6-4 / M6-5 反省踏襲、最重要)

製造担当は §4 着手前に、**設定画面 6 セクション(DES-005 §5.16)の表示項目すべて** に対して、対応する既存実装(`Config` 構造体 / API DTO / フロントルート / 既存 API)の有無を **表形式で網羅検証** する。これは M6-02 v1.0.0 で見落とされた 3 件(M6-3 ネットワーク / M6-4 デフォルト値 / M6-5 プリセット管理リンク)の再発防止策。

表の各行(製造担当が完成させる):

| セクション | 表示項目 | 対応する既存実装 | 実装有無 | M6-02 でのアクション |
|----------|--------|--------------|--------|-------------------|
| 基本 | 言語選択 | react-i18next の `useTranslation()` フック + 翻訳キー | §3.4.3 結果次第 | i18n 初期化 + キー追加(例外条項 c)|
| 基本 | デフォルト表示キャラ | `Config.Defaults.CharacterID`(v1.0.1 で本指示書スコープ追加)| 不在 → v1.0.1 で追加実装 | `config.go` 拡張(例外条項 f)|
| 基本 | デフォルトプリセット | `Config.Defaults.PresetID`(v1.0.1 で本指示書スコープ追加)| 不在 → v1.0.1 で追加実装 | `config.go` 拡張(例外条項 f)|
| ユーザー | ユーザー追加・編集 | `GET /api/users` 等 | 不在(フェーズ 2 送り)| disabled + ツールチップ |
| ユーザー | パスワード変更 | `Config.Security.PasswordEnabled`(構造体は存在、認証ロジック未実装)| 構造体のみ | UI 表示のみ、認証フロー組み込みなし |
| ネットワーク | LAN モード表示 | `Config.Server.Mode`(M1 既存)| 実装済み | 既存値を表示 |
| ネットワーク | 接続可能 IP / ポート表示 | `ConfigResponse.network.primaryLanIp` + `Config.Server.Port`(v1.0.0 で本指示書スコープ追加)| 不在 → v1.0.0 で追加実装 | サービス層拡張(例外条項 a)|
| ネットワーク | 接続用 QR コード表示 | `ConfigResponse.network.lanUrl`(v1.0.0 で本指示書スコープ追加)| 不在 → v1.0.0 で追加実装 | サービス層拡張 + qrcode.react(例外条項 a + b)|
| データ | DB ファイルパス | `Config.Database.Path`(M1 既存)| 実装済み | 既存値を表示 |
| データ | 手動バックアップ | `POST /api/backup` 等 | 不在(フェーズ 2 送り)| disabled + ツールチップ |
| データ | リストア | `POST /api/restore` 等 | 不在(フェーズ 2 送り)| disabled + ツールチップ |
| データ | レシピキャッシュ再構築 | `POST /api/cache/rebuild` 等 | 不在(フェーズ 2 送り)| disabled + ツールチップ |
| プリセット管理リンク | `/presets` 遷移ボタン | フロント `/presets` ルート | 不在(P-1 持ち越し)| **(v1.0.1 追加)disabled + ツールチップ「今後実装予定」** |
| 詳細 | ログファイルパス | `Config.Logging.File`(M1 既存)| 実装済み | 既存値を表示 |
| 詳細 | バージョン情報 | バージョン定数 or 別 API | §3.4 確認次第 | ハードコード or API 追加(Plan Mode で確定)|

製造担当は上記表を **完全に埋めた状態** を Plan Mode 計画提示時に開発者へ提示する。**未確認項目があった場合は §4 詳細仕様の実装に着手しない**(M6-3 / M6-4 / M6-5 と同種の見落とし再発防止、最重要)。

**ヘッダのプリセットナビゲーションリンク確認**(v1.0.1 追加、M6-5 由来):

- [ ] `view web/src/components/Header.tsx`(または相当ファイル)で DES-005 §4.1 主要ナビゲーションの「プリセット」リンクの現状実装を確認
- [ ] リンク先(`/presets` ルート、現状未実装)へのクリック時の挙動を確認(catch-all 等)
- [ ] M6-02 v1.0.1 で disabled 化する対応位置を確定(開発者ご回答 Q-2「ヘッダのプリセットリンクは未実装」を踏まえる、設定画面セクション 5「プリセット管理へのリンク」と同じツールチップ文言で統一)

**(v1.0.2 追加)ヘッダの「設定」ナビゲーションリンク追加位置の確認**(M6-6 由来):

- [ ] 同じ `view web/src/components/Header.tsx`(または相当ファイル)で DES-005 §4.1 主要ナビゲーション「コンボ一覧、マイコンボ、プリセット、設定」の規定に対する **現状の実装状態を網羅確認**(コンボ一覧 / マイコンボ は既存実装あり、プリセットは v1.0.1 で disabled 化対象、**設定は v1.0.1 までヘッダ未実装** → v1.0.2 で新規追加対象)
- [ ] 既存リンクの実装パターン(`<Link to>` / `<a href>` / `<NavLink>` 等)を確認、「設定」リンク追加時は同じパターンで統一
- [ ] 「設定」リンクの配置位置(既存「プリセット」リンクの後ろ、DES-005 §4.1 順序踏襲)を確定
- [ ] スマホフッター(DES-005 §4.2)の「設定」ボタンは **本指示書 v1.0.2 スコープ外**(M6-03 で対応、§1.3 既定)。Plan Mode で誤って範囲拡張しないよう注意

#### 3.4.8 Plan Mode で開発者協議が必要な必須項目(計画提示に必ず明示列挙、M6-2 反省踏襲、v1.0.1 で +1 件追加)

製造担当は Plan Mode で計画提示時に **以下 8 項目すべての方針** を開発者に提示し、判断を仰ぐ(M6-2 反省踏襲: 本文中の「Plan Mode で確定」指示は §3.4.8 必須項目リストにも必ず明示列挙する):

1. **`ConfigResponse.network` の最終形 + LAN IP 取得失敗時の挙動**:
   - フィールド構成: `network: { primaryLanIp: string; lanUrl: string }` で確定か、別構成(例: `lanInfo` 等)を選ぶか
   - ローカルモード(`mode == "local"`)時の値: 空文字 / null / フィールドそのものを omit のいずれを選ぶか
   - LAN モード時の `SelectPrimaryLANIP()` 失敗時の挙動: エラー伝搬(500 返却) / 空文字返却 + ログ警告 / フォールバックで `127.0.0.1` 返却 のいずれを選ぶか
   - **設計担当の推奨**: `network: { primaryLanIp: string; lanUrl: string }` 構造、ローカルモード時は空文字、LAN モード時の失敗時は空文字 + ログ警告(設定画面で「LAN IP が取得できません」と表示)

2. **QR コード生成ライブラリの選定**:
   - 候補: `qrcode.react`(MIT、React コンポーネント、シンプル)/ `react-qr-code`(MIT、依存少)/ その他
   - 依存サイズ + 直近メンテナンス状況 + ライセンス(CLAUDE.md §6 依存追加ポリシー)で判断
   - **設計担当の推奨**: `qrcode.react`(コミュニティ実績 + MIT)

3. **アプリ起動時の初回判定リダイレクトの実装位置**:
   - 候補: (a) `web/src/App.tsx` でグローバル判定 / (b) ルーター層で gate コンポーネント / (c) 各ページの先頭で個別チェック
   - **設計担当の推奨**: (a) `web/src/App.tsx`(M3-04 で確立した「グローバル状態を `App.tsx` で初期化」パターン踏襲、M3-04 マイコンボ画面実装で利用)
   - Plan Mode 時に既存 `App.tsx` の構造を再確認してから判断

4. **ウィザード進捗バーの実装方式**:
   - 候補: (a) 専用コンポーネント `WizardProgress` でステップ番号管理 / (b) 各 Step コンポーネントが独立にレンダリング + 親 `WizardPage` が状態管理
   - **設計担当の推奨**: (a) 専用コンポーネント分離(architecture-patterns §1 プレゼンテーション層/ロジック層分離パターン、`WizardPage` が状態管理 + `WizardProgress` が表示専用)

5. **設定画面の各セクションのレスポンシブ実装**:
   - DES-005 §5.16 規定「PC はセクション横並び、スマホはアコーディオン折りたたみ」の実装方式
   - 候補: (a) Tailwind の `sm:` / `md:` ブレークポイントで CSS 切替 / (b) JS でメディアクエリ監視して条件レンダリング
   - **設計担当の推奨**: (a) Tailwind ブレークポイント(レスポンシブの単純化、DES-005 §4.4 既定)
   - アコーディオン UI コンポーネントの選定(既存 `Accordion` 等の存在有無は §3.4.5 で確認)

6. **言語選択の実装方式**(react-i18next 未実装の場合):
   - 候補: (a) M6-02 内で `react-i18next` 初期化 + 最低限の翻訳キー(設定 + ウィザード)追加 / (b) react-i18next なしで日英ハードコード切替 / (c) M7 まで言語選択 UI を disabled
   - **設計担当の推奨**: (a) react-i18next 初期化(CLAUDE.md §2 採用済み + DES-002 §5.4 既定義)、ただし M7「i18n 全画面整備」までは設定画面 + ウィザード分のキーのみ
   - §3.4.3 確認結果次第で判断変更

7. **ウィザード完了時の遷移先**:
   - 候補: (a) コンボ一覧(`/`)固定 / (b) スマホ判定でホーム(`/home` 等)/ コンボ一覧分岐
   - **設計担当の推奨**: (a) コンボ一覧固定(M6-03 でホーム画面実装時にこのリダイレクト先を変更する想定、M6-02 では分岐を作らない、YAGNI)
   - M6-overview §2.5 既定方針と整合

8. **(v1.0.1 追加)`[defaults]` セクションのフィールド設計**(M6-4 由来):
   - フィールド命名(TOML): `character_id` / `preset_id` で確定か(SUPP-001 §5.8 v1.14.0 表記)、別名(`default_character_id` / `default_preset_id` 等)を選ぶか
   - JSON タグ命名: camelCase `characterId` / `presetId`(CLAUDE.md §4 規約踏襲)
   - フィールド型: `int64` 値型 or `*int64` ポインタ型(ポインタ型なら未選択時 `nil`、値型なら未選択時デフォルト値 `1` 適用)
   - **設計担当の推奨**: TOML `character_id` / `preset_id`(snake_case)+ JSON `characterId` / `presetId`(camelCase)+ Go フィールド `CharacterID` / `PresetID`(PascalCase)、値型 `int64` でデフォルト値 `1`(リュウ + official_ja_move)
   - `validate()` バリデーション: `character_id >= 1` + `preset_id >= 1` の最小チェック(存在チェックは DB アクセスを伴うためサービス層で対応 or 省略、Plan Mode で確定)

#### 3.4.9 §4 着手の前提条件

§3.4.1〜§3.4.8 すべての確認結果を Plan Mode の計画提示に含めること。未確認のまま §4 詳細仕様の実装に着手しないこと(retrospective-log v1.0.19 §6.2「実コード確認の省略」防止)。

**特に §3.4.7 設定画面 6 セクション ↔ 既存実装実態の対応表は M6-3 / M6-4 / M6-5 反省踏襲の最重要観点**: 表を完全に埋めた状態で開発者へ提示することが §4 着手の絶対条件。

---

## 4. 詳細仕様

### 4.1 `ConfigResponse.network` フィールド追加(M6-01 サービス層拡張)

architecture-patterns §2 3 層パターン + §2.1 サービス層インターフェース定義パターンに従う。

#### 4.1.1 DTO 拡張(`internal/api/config/dto.go`)

```go
type NetworkDTO struct {
    PrimaryLanIp string `json:"primaryLanIp"`
    LanUrl       string `json:"lanUrl"`
}

type ConfigResponse struct {
    Server          ServerDTO   `json:"server"`
    Database        DatabaseDTO `json:"database"`
    Logging         LoggingDTO  `json:"logging"`
    Security        SecurityDTO `json:"security"`
    Network         NetworkDTO  `json:"network"`         // 新規追加
    IsInitialized   bool        `json:"isInitialized"`
    RestartRequired bool        `json:"restartRequired"`
}
```

**設計判断**:

- `Network NetworkDTO` を **常に含む**(`omitempty` なし)、ローカルモード時は空文字
- フロント側は `network.primaryLanIp === ""` でローカルモード時の挙動を判定可能
- 機微情報除外規約(M6-01 §4.2.1 で確立): NetworkDTO に機微情報フィールドを追加する場合は JSON タグ `-` で除外

#### 4.1.2 サービス層拡張(`internal/service/config/service.go`)

`Service.Get()` メソッドの戻り値構造を拡張。インターフェース型 `Service` は変更せず、戻り値の `*Config` に `Network` 情報を含む形で対応(architecture-patterns §2.1 で確立した既存インターフェースの温存)。

**実装方針**(Plan Mode で確定):

- `service` 構造体に `lanIpResolver` 等のフィールドを追加(依存性注入、`netutil.SelectPrimaryLANIP` を呼び出すための抽象化)、または直接 `netutil` をインポートして呼び出す
- `Get()` メソッド内で:
  - `cfg.Server.Mode == "local"` → `PrimaryLanIp: ""`, `LanUrl: ""`
  - `cfg.Server.Mode == "lan"` → `netutil.SelectPrimaryLANIP()` を呼び、成功時 IP + URL を返す、失敗時(候補なし等)は空文字 + ログ警告
- `Update()` メソッドは変更不要(LAN IP はランタイム情報、`config.toml` には書き戻さない)
- `NewService()` シグネチャに依存追加(IP 取得関数を引数で受ける形を推奨、テスト時のモック化容易性確保)

**コード例**(参考、製造担当の実装裁量範囲):

```go
type Service interface {
    Get() (cfg *appconfig.Config, network NetworkInfo, isInitialized bool, err error)
    Update(req UpdateRequest) (updated *appconfig.Config, network NetworkInfo, validationErrs []ValidationIssue, restartRequired bool, err error)
}

type NetworkInfo struct {
    PrimaryLanIp string
    LanUrl       string
}

type LanIpResolver func() (net.IP, error)

type service struct {
    mu            sync.Mutex
    cfg           *appconfig.Config
    configPath    string
    lanIpResolver LanIpResolver // 依存性注入、テスト時はモック差し込み
}

func NewService(cfg *appconfig.Config, configPath string, lanIpResolver LanIpResolver) Service {
    return &service{cfg: cfg, configPath: configPath, lanIpResolver: lanIpResolver}
}

func (s *service) Get() (*appconfig.Config, NetworkInfo, bool, error) {
    s.mu.Lock()
    defer s.mu.Unlock()
    cfgCopy := *s.cfg
    network := s.resolveNetwork(&cfgCopy)
    initialized := fileExists(s.configPath)
    return &cfgCopy, network, initialized, nil
}

func (s *service) resolveNetwork(cfg *appconfig.Config) NetworkInfo {
    if cfg.Server.Mode != "lan" {
        return NetworkInfo{} // ローカルモード時は空
    }
    ip, err := s.lanIpResolver()
    if err != nil {
        // ログ警告、空文字返却
        return NetworkInfo{}
    }
    return NetworkInfo{
        PrimaryLanIp: ip.String(),
        LanUrl:       fmt.Sprintf("http://%s:%d", ip.String(), cfg.Server.Port),
    }
}
```

**重要**:

- `Service` インターフェースの戻り値拡張は **後方互換性破壊** だが、`Service` は本コードベース内のみで使用される非公開 API のため、ハンドラ層の呼出側も同時に更新すれば問題なし
- インターフェース拡張時、ハンドラ層 `handler.go` の `Get()` / `Update()` メソッドも対応修正が必要
- M6-01 で確立した既存パターン(`*Service` 具象型ポインタを返さない、インターフェース型を返す)を **厳守**(retrospective-log §6 M6-1 反省踏襲、architecture-patterns §2.1)

#### 4.1.3 ハンドラ層対応修正

`internal/api/config/handler.go` の `Get()` / `Update()` メソッド内で、サービス層から `NetworkInfo` を受け取り、`ConfigResponse.Network` に詰める処理を追加。

```go
func (h *Handler) Get(c echo.Context) error {
    cfg, network, isInitialized, err := h.svc.Get()
    if err != nil { ... }
    return c.JSON(http.StatusOK, toConfigResponse(cfg, network, isInitialized, false))
}
```

`toConfigResponse` ヘルパ関数(M6-01 で実装、製造担当の実装裁量範囲)に `network` 引数を追加。

#### 4.1.4 サービス層テスト追加(`internal/service/config/service_test.go`)

M6-01 で既存 7 テストケースに加えて、以下を追加:

- [ ] **TestService_Get_NetworkLocalMode**: ローカルモード時に `NetworkInfo` が空構造体を返すことを確認
- [ ] **TestService_Get_NetworkLanMode**: LAN モード時にモック `lanIpResolver` が IP を返し、`NetworkInfo.PrimaryLanIp` + `LanUrl` が正しく構築されることを確認
- [ ] **TestService_Get_NetworkLanModeFailure**: LAN モード時に `lanIpResolver` がエラーを返した場合、空 `NetworkInfo` + ログ警告(エラー伝搬しない)を確認

#### 4.1.5 ハンドラ層テスト追加(`internal/api/config/handler_test.go`)

- [ ] **TestHandler_Get_NetworkLocalMode**: `mode == "local"` 時に JSON レスポンス `network` が `{ primaryLanIp: "", lanUrl: "" }` であることを確認
- [ ] **TestHandler_Get_NetworkLanMode**: `mode == "lan"` 時に `network.primaryLanIp` / `lanUrl` が正しく含まれることを確認(モックサービスで `NetworkInfo` を返す)

### 4.1bis `Config.Defaults` 構造体追加(v1.0.1 で新設、M6-4 由来、§2.4 例外条項 (f) / (g) / (h))

本指示書 v1.0.0 で見落とされた「ウィザード ステップ 3-4 + 設定画面基本セクションのデフォルト表示キャラ / デフォルトプリセットの永続化」を実装する。確認事項 1 案 2-c 採用に基づき、`config.go` への `DefaultsConfig` 構造体追加 + SUPP-001 §5.8 追記(本セッションで v1.13.0 → v1.14.0 改訂済み)で対応。

#### 4.1bis.1 Config 構造体拡張(`internal/config/config.go`、§2.4 例外条項 (f))

既存 `Config` 構造体に `Defaults DefaultsConfig` フィールド + `DefaultsConfig` 構造体定義を追加。**既存 `Server` / `Database` / `Logging` / `Security` の 4 サブ構造体は変更しない**(追加のみ)。

```go
// internal/config/config.go

type Config struct {
    Server   ServerConfig   `toml:"server"`
    Database DatabaseConfig `toml:"database"`
    Logging  LoggingConfig  `toml:"logging"`
    Security SecurityConfig `toml:"security"`
    Defaults DefaultsConfig `toml:"defaults"` // v1.0.1 で追加
}

// v1.0.1 で追加(M6-4 由来、retrospective-log v1.0.19 §6.1 参照)
type DefaultsConfig struct {
    CharacterID int64 `toml:"character_id"` // ウィザード選択のデフォルト表示キャラ
    PresetID    int64 `toml:"preset_id"`    // ウィザード選択のデフォルトプリセット
}
```

**フィールド命名規約**(§3.4.8 必須項目 8 で Plan Mode 確定):

- TOML タグ: snake_case(`character_id` / `preset_id`)、SUPP-001 §5.8 v1.14.0 表記と整合
- Go フィールド: PascalCase(`CharacterID` / `PresetID`)、CLAUDE.md §4 規約踏襲
- JSON タグ: camelCase(`characterId` / `presetId`)、DTO 側で別途定義(後述 §4.1bis.4)

#### 4.1bis.2 デフォルト値追加(`Default()` 関数拡張)

既存 `Default()` 関数の戻り値に `Defaults` フィールドのデフォルト値を追加。**既存 4 サブ構造体のデフォルト値設定は変更しない**(追加のみ)。

```go
const (
    defaultServerMode    = "local"
    defaultServerPort    = 47318
    // ... 既存定数
    defaultCharacterID   = 1 // v1.0.1 追加: リュウ(M1 期間 seed の唯一のキャラ)
    defaultPresetID      = 1 // v1.0.1 追加: official_ja_move(M1 期間 seed の組み込みプリセット 5 種の 1 つ目)
)

func Default() *Config {
    return &Config{
        Server: ServerConfig{
            Mode: defaultServerMode,
            Port: defaultServerPort,
        },
        // ... 既存サブ構造体
        Defaults: DefaultsConfig{ // v1.0.1 で追加
            CharacterID: defaultCharacterID,
            PresetID:    defaultPresetID,
        },
    }
}
```

#### 4.1bis.3 バリデーション追加(`validate()` 関数拡張)

既存 `validate()` 関数に `Defaults` フィールドのバリデーション追加。**既存 4 サブ構造体のバリデーションロジックは変更しない**(追加のみ)。

```go
func (c *Config) validate() error {
    // 既存バリデーション(Server / Database / Logging / Security)はそのまま

    // v1.0.1 追加: Defaults バリデーション
    if c.Defaults.CharacterID < 1 {
        return fmt.Errorf("config: invalid defaults.character_id %d (must be >= 1)", c.Defaults.CharacterID)
    }
    if c.Defaults.PresetID < 1 {
        return fmt.Errorf("config: invalid defaults.preset_id %d (must be >= 1)", c.Defaults.PresetID)
    }

    return nil
}
```

**注**: 存在チェック(`characters` / `presets` テーブルに該当 ID が存在するか)は DB アクセスを伴うため、`config.go` の validate() ではなく **サービス層で対応** する選択も可(§3.4.8 必須項目 8 で Plan Mode 確定)。設計担当の暫定推奨は **存在チェックを省略**(最小チェックのみ、未存在 ID の場合はフロント側で「該当データが見つかりません」表示 + デフォルト値 1 にフォールバック)。

#### 4.1bis.4 DTO 拡張(`internal/api/config/dto.go`、§4.1.1 で network 拡張と同時対応)

`ConfigResponse` に `Defaults DefaultsDTO` フィールド追加 + `UpdateConfigRequest` に `Defaults *DefaultsUpdate` フィールド追加(部分更新対応、SUPP-001 §5.9 ポリシー)。

```go
type DefaultsDTO struct {
    CharacterID int64 `json:"characterId"`
    PresetID    int64 `json:"presetId"`
}

type ConfigResponse struct {
    Server          ServerDTO   `json:"server"`
    Database        DatabaseDTO `json:"database"`
    Logging         LoggingDTO  `json:"logging"`
    Security        SecurityDTO `json:"security"`
    Network         NetworkDTO  `json:"network"`         // v1.0.0 追加
    Defaults        DefaultsDTO `json:"defaults"`        // v1.0.1 追加
    IsInitialized   bool        `json:"isInitialized"`
    RestartRequired bool        `json:"restartRequired"`
}

type DefaultsUpdate struct {
    CharacterID *int64 `json:"characterId,omitempty"`
    PresetID    *int64 `json:"presetId,omitempty"`
}

type UpdateConfigRequest struct {
    Server   *ServerUpdate   `json:"server,omitempty"`
    Database *DatabaseUpdate `json:"database,omitempty"`
    Logging  *LoggingUpdate  `json:"logging,omitempty"`
    Security *SecurityUpdate `json:"security,omitempty"`
    Defaults *DefaultsUpdate `json:"defaults,omitempty"` // v1.0.1 追加
}
```

#### 4.1bis.5 サービス層対応(`internal/service/config/service.go`、v1.0.0 で network 拡張済み、v1.0.1 で defaults 対応)

サービス層の `Get()` / `Update()` メソッドで `Config.Defaults` フィールドを読み書きする処理を追加。`UpdateConfigRequest.Defaults` 部分更新ポリシー(SUPP-001 §5.9)に対応。

```go
func (s *service) Update(req UpdateRequest) (...) {
    // 既存処理(Server / Database / Logging / Security 部分更新)はそのまま

    // v1.0.1 追加: Defaults 部分更新
    if req.Defaults != nil {
        if req.Defaults.CharacterID != nil {
            next.Defaults.CharacterID = *req.Defaults.CharacterID
        }
        if req.Defaults.PresetID != nil {
            next.Defaults.PresetID = *req.Defaults.PresetID
        }
    }

    // 既存処理(バリデーション → 書き戻し → メモリ更新)
}
```

#### 4.1bis.6 既存 `internal/config/config_test.go` への追加テスト(§2.4 例外条項 (g))

**既存 7 テストケースは変更しない**(追加のみ)。以下を追加:

- [ ] **TestLoad_DefaultsFromFile**: `config.toml` に `[defaults]` セクションあり + 値を指定した場合、Config 構造体に正しく読み込まれることを確認
- [ ] **TestLoad_DefaultsFromDefault**: `[defaults]` セクション不在の `config.toml` の場合、`Default()` の値(`CharacterID: 1, PresetID: 1`)が適用されることを確認(後方互換性確認)
- [ ] **TestValidate_DefaultsCharacterIDZero**: `Defaults.CharacterID == 0` でバリデーション失敗を確認
- [ ] **TestValidate_DefaultsPresetIDZero**: `Defaults.PresetID == 0` でバリデーション失敗を確認

#### 4.1bis.7 サービス層テスト追加(`internal/service/config/service_test.go`、§4.1 で追加した network 系 + 本節 defaults 系)

- [ ] **TestService_Update_DefaultsPartial**: `UpdateRequest.Defaults.CharacterID` のみ送って `PresetID` を送らないリクエストで、`PresetID` が変更されないことを確認(部分更新ポリシー)
- [ ] **TestService_Update_DefaultsValidationFailure**: `CharacterID == 0` で `Update()` を呼び、`validationErrs` が返ること + `config.toml` が変更されていないことを確認(原子性)
- [ ] **TestService_Get_DefaultsValues**: 現状の `Config.Defaults` 値が `Get()` レスポンスに正しく含まれることを確認

#### 4.1bis.8 ハンドラ層テスト追加(`internal/api/config/handler_test.go`)

- [ ] **TestHandler_Get_DefaultsValues**: JSON レスポンス `defaults.characterId` / `defaults.presetId` が正しく含まれることを確認
- [ ] **TestHandler_Update_DefaultsPartial**: 部分更新リクエストで `characterId` のみ変更されることを確認

#### 4.1bis.9 後方互換性

既存 `config.toml` ファイル(`[defaults]` セクション不在)を読み込んだ場合、`Default()` のデフォルト値(`CharacterID: 1, PresetID: 1`)が適用される(BurntSushi/toml の標準挙動)。**M1 期間で `config.toml` を作成していた既存ユーザーがいる場合でも互換性破壊なし**(M6-RESEARCH-01 §4.2 (e) 確認結果: 現状リポジトリに `config.toml` は不在のため、互換性破壊リスクは事実上ゼロ)。

### 4.2 フロントエンド: 設定 API クライアント(`web/src/lib/configApi.ts`)

#### 4.2.1 TypeScript 型定義

M6-01 完了報告で確定した JSON キーと **1:1 対応**(camelCase 統一):

```typescript
// web/src/features/config/types.ts(または web/src/lib/configApi.ts 内)

export type ServerInfo = {
  mode: 'local' | 'lan';
  port: number;
};

export type DatabaseInfo = {
  path: string;
};

export type LoggingInfo = {
  level: 'debug' | 'info' | 'warn' | 'error';
  file: string;
  maxSizeMb: number;
  maxBackups: number;
  maxAgeDays: number;
};

export type SecurityInfo = {
  passwordEnabled: boolean;
};

export type NetworkInfo = {
  primaryLanIp: string;
  lanUrl: string;
};

export type ConfigResponse = {
  server: ServerInfo;
  database: DatabaseInfo;
  logging: LoggingInfo;
  security: SecurityInfo;
  network: NetworkInfo;
  isInitialized: boolean;
  restartRequired: boolean;
};

export type UpdateConfigRequest = {
  server?: Partial<ServerInfo>;
  database?: Partial<DatabaseInfo>;
  logging?: Partial<LoggingInfo>;
  security?: Partial<SecurityInfo>;
};
```

#### 4.2.2 API クライアント関数

```typescript
// web/src/lib/configApi.ts

import { fetchJSON } from './fetchJSON'; // 既存ヘルパ、§3.4.4 で実態確認

export const configApi = {
  get: async (): Promise<ConfigResponse> => {
    return fetchJSON('/api/config');
  },

  update: async (req: UpdateConfigRequest): Promise<ConfigResponse> => {
    return fetchJSON('/api/config', {
      method: 'PUT',
      body: JSON.stringify(req),
    });
  },
};
```

**注**: `fetchJSON` の実態(`X-Requested-With` 自動付与有無)は §3.4.4 で確認、未付与なら明示付与する形に修正。

#### 4.2.3 TanStack Query ロジックフック

`web/src/features/config/useConfig.ts`(新規):

```typescript
import { useQuery } from '@tanstack/react-query';
import { configApi } from '../../lib/configApi';

export function useConfig() {
  return useQuery({
    queryKey: ['config'],
    queryFn: () => configApi.get(),
    staleTime: 60_000, // 設定値は変化頻度低、1 分キャッシュ
  });
}
```

`web/src/features/config/useUpdateConfig.ts`(新規):

```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { configApi, UpdateConfigRequest } from '../../lib/configApi';

export function useUpdateConfig() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (req: UpdateConfigRequest) => configApi.update(req),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['config'] });
    },
  });
}
```

**queryKey 規約**(architecture-patterns §1.1):
- `['config']` の flat tuple 形式を採用(設定 API は ID パラメータを持たないため number 正規化は不要、本規約の対象外)
- 既存 combo 系 flat tuple との整合を保つ

### 4.3 アプリ起動時の初回判定リダイレクト

#### 4.3.1 `web/src/App.tsx` 修正(§3.4.7 必須項目 3 で実装位置確定後)

```typescript
function App() {
  const { data: config, isLoading } = useConfig();

  if (isLoading) return <LoadingSpinner />;

  // 初回起動時はウィザードへリダイレクト
  if (config && !config.isInitialized && location.pathname !== '/wizard') {
    return <Navigate to="/wizard" replace />;
  }

  return (
    <Routes>
      <Route path="/wizard" element={<WizardPage />} />
      <Route path="/settings" element={<SettingsPage />} />
      {/* 既存ルート */}
      <Route path="/" element={<CombosPage />} />
      <Route path="/combos" element={<CombosPage />} />
      <Route path="/mycombos" element={<MyCombosPage />} />
      {/* 等 */}
    </Routes>
  );
}
```

**注**: 上記は **参考実装**、製造担当の Plan Mode で実装位置確定後に修正(M3-04 で確立したパターン踏襲、既存 `App.tsx` 構造に揃える)。

#### 4.3.2 ウィザード途中離脱時の挙動

- ユーザーがウィザード途中で `/wizard` 以外のパス(例: `/combos`)に URL 直接アクセスした場合、`isInitialized: false` なら `/wizard` に再リダイレクトされる
- これにより「ウィザード未完了状態でアプリを使用」を防ぐ
- ウィザード完了 = `PUT /api/config` 成功 = `config.toml` 自動生成 = 次回 `GET /api/config` で `isInitialized: true` 返却

### 4.4 初回起動ウィザード(`/wizard`)

#### 4.4.1 ステップ構成(DES-005 §5.1 規定、7 ステップ)

1. **ようこそ画面**: アプリ概要説明 + 「開始」ボタン
2. **言語選択**: 日本語 / English、ブラウザ言語から推定して初期選択(react-i18next 採用、§3.4.3 実装状況次第)
3. **デフォルト表示キャラ選択**: characters 一覧から 1 体選択、スキップ可能(`useCharacters` 既存フック再利用、§3.4.5 確認結果次第)。**(v1.0.1 追加)選択値は `UpdateConfigRequest.Defaults.CharacterID` として送信、スキップ時はデフォルト 1(リュウ)**。**(v1.0.2 追加)スキップボタンを画面下部に明示配置**(「次へ」「戻る」「スキップ」の 3 ボタン構成、スキップ時は `UpdateConfigRequest.Defaults.CharacterID = 1` を内部状態にセットしてステップ 4 に遷移、軽微-3 連絡事項 4 由来の実装漏れ補正)
4. **プリセット選択**: 5 つの組み込みから 1 つ選択、デフォルトは `official_ja_move`(`usePresets` 既存フック再利用、§3.4.5 確認結果次第)。**(v1.0.1 追加)選択値は `UpdateConfigRequest.Defaults.PresetID` として送信、未選択時はデフォルト 1(official_ja_move)**
5. **LAN 共有モード設定**: 有効 / 無効、初期値は無効
6. **パスワード設定**: 任意、LAN 共有有効時のみ表示(UI 表示のみ、認証フローへの組み込みなし、本指示書 §1.3 既定)
7. **完了**: 「完了」ボタンで `PUT /api/config` 呼出 → 成功時にコンボ一覧(`/`)へ遷移。**(v1.0.1 追加)送信ボディには `defaults: { characterId, presetId }` を含めて永続化する**

#### 4.4.2 ウィザード状態管理

- ローカル状態(`useState`)でステップ番号 + 各ステップの入力値を管理
- 「次へ」「戻る」「スキップ」ボタンで遷移
- 各ステップで入力した値を最終的に `UpdateConfigRequest` として組み立て、ステップ 7「完了」で `useUpdateConfig().mutate()` 呼出
- mutation 成功時に `navigate('/')` でコンボ一覧へ
- mutation 失敗時(バリデーションエラー等)はステップ 7 でエラー表示、ユーザーが「戻る」で各ステップに戻れる
- ウィザード中の入力値の **ブラウザストレージ保存はしない**(本指示書スコープ外、下書き自動保存は M6-04)

#### 4.4.3 進捗バー(`WizardProgress` コンポーネント、§3.4.8 必須項目 4)

- 7 ステップの現在地表示(例: 「ステップ 3 / 7」+ プログレスバー視覚化)
- 表示専用コンポーネント(Props: `currentStep: number`, `totalSteps: number`)、ロジックは `WizardPage` から渡す(architecture-patterns §1)
- ステップ 6「パスワード設定」は LAN 有効時のみ表示のため、進捗計算で動的に `totalSteps` を 6 or 7 で切り替え

#### 4.4.4 LAN 共有モード設定(ステップ 5)の挙動

- 「LAN 共有を有効にする」チェックボックス(初期値 OFF)
- ON にすると **ステップ 6「パスワード設定」が表示** される(`totalSteps = 7`)
- OFF のままなら **ステップ 6 をスキップ**(`totalSteps = 6`、次は完了)
- 注釈: 「LAN 共有を有効にするとアプリ再起動後に設定が反映されます」をステップ 5 に表示(`restartRequired: true` の挙動を事前告知)

#### 4.4.5 完了時の `config.toml` 自動生成

- ステップ 7「完了」ボタン押下で `useUpdateConfig().mutate()` 呼出
- リクエストボディはウィザード各ステップで入力した値を `UpdateConfigRequest` 形式で組み立て(**v1.0.1 追加: `defaults` フィールドも含む**)
- バックエンド側で初回 `PUT` 時に `config.toml` 自動生成(M6-01 で実装済み、SUPP-001 §5.8 既定、v1.14.0 で `[defaults]` セクション追記済み)
- レスポンスの `isInitialized: true`(自動生成成功)+ `restartRequired: true`(LAN モード設定時)を確認
- 成功時にコンボ一覧(`/`)へ `navigate('/', { replace: true })`(履歴に `/wizard` を残さない)

### 4.5 設定画面(`/settings`)

#### 4.5.1 6 セクション構成(DES-005 §5.16 規定、v1.0.1 で disabled 化方針を明示)

1. **基本セクション**: 言語選択 / デフォルト表示キャラ / デフォルトプリセット(**v1.0.1**: デフォルトキャラ / プリセットは `Config.Defaults.CharacterID` / `PresetID` フィールドの読み書き、§4.5.2 参照)
2. **ユーザーセクション**: ユーザー追加・編集(disabled + ツールチップ「フェーズ 2 で実装」)/ パスワード変更(disabled + ツールチップ)
3. **ネットワークセクション**: LAN 共有モード表示(現在の `mode` を `local` / `lan` で表示)/ 接続可能 IP / ポート表示(`network.primaryLanIp` + `server.port`)/ 接続用 QR コード表示ボタン(LAN モード時のみ有効、FR407)
4. **データセクション**: DB ファイルパス表示(`database.path`)/ 手動バックアップボタン(disabled + ツールチップ)/ リストアボタン(disabled)/ レシピキャッシュ再構築ボタン(disabled)
5. **プリセット管理リンク**(v1.0.1 改訂): `/presets` ルートへの遷移ボタンを **disabled + ツールチップ「今後実装予定」** で表示。`/presets` ルートは実装漏れ(retrospective-log v1.0.19 §6.1 M6-5)、P-1 として §10 完了後の次ステップで M6 終了間近の再協議対象。§4.5.6 で詳細仕様
6. **詳細セクション**: ログファイルパス表示(`logging.file`)/ バージョン情報(ハードコード or 別 API、§3.4.2 / §3.4.5 で確認 + Plan Mode で確定)

#### 4.5.2 基本セクションの詳細(v1.0.1 で defaults 表示・編集仕様を新設)

- **言語選択**:
  - react-i18next ベースの言語切替プルダウン(日本語 / English)、§3.4.3 実装状況次第
  - 変更後の永続化先は `Config.Server` 等ではなく **言語設定専用フィールド or localStorage**(SUPP-001 / DES-002 §5.4 に明示なし、Plan Mode で確定 = 設計担当の暫定推奨は **言語選択もブラウザストレージ保存**、設定値ではなくクライアント表示設定として扱う)
  - **本項目は M6-02 v1.0.1 では別途検討が必要**: 言語選択を `Config.Defaults` の一部として扱うか、別の永続化手段(localStorage)とするかは Plan Mode で確定
- **デフォルト表示キャラ**(v1.0.1 追加、M6-4 由来):
  - `useCharacters()` フックでキャラクター一覧取得、現在の `config.defaults.characterId` を初期選択
  - キャラクター選択プルダウン(DES-005 §4.3 共通要素「キャラクター選択プルダウン」既存パターン踏襲、§3.4.5 確認結果次第)
  - 変更後「保存」ボタン押下で `useUpdateConfig().mutate({ defaults: { characterId: <選択値> } })` 呼出
- **デフォルトプリセット**(v1.0.1 追加、M6-4 由来):
  - `usePresets()` フックでプリセット一覧取得、現在の `config.defaults.presetId` を初期選択
  - プリセット選択プルダウン(M3-03 で実装済みのヘッダプルダウンと同種の UI、§3.4.5 確認結果次第)
  - 変更後「保存」ボタン押下で `useUpdateConfig().mutate({ defaults: { presetId: <選択値> } })` 呼出
- 「保存」ボタンは基本セクション全体で 1 個(変更があったフィールドのみ部分送信、SUPP-001 §5.9 ポリシー)

#### 4.5.3 レスポンシブ実装(§3.4.8 必須項目 5、DES-005 §5.16 規定)

- **PC**(`md:` 以上): セクション横並び 2 列(または上下並び、Tailwind grid)
- **スマホ**(`sm` 未満): アコーディオン折りたたみ、各セクション独立に開閉可能

#### 4.5.4 ネットワークセクションの詳細

- **LAN 共有モード表示**:
  - 現在の `config.server.mode` を表示
  - `local` 時: 「ローカルモード(このマシンからのみアクセス可能)」
  - `lan` 時: 「LAN 共有モード(同一 LAN からアクセス可能)」
  - **モード切替トグルは表示しない**(本指示書 §1.3、フェーズ 2 送り)
- **接続可能 IP / ポート表示**:
  - `local` 時: `127.0.0.1:<port>` を表示
  - `lan` 時: `<network.primaryLanIp>:<port>` を表示(network.primaryLanIp が空文字なら「LAN IP が取得できません」エラー表示)
- **接続用 QR コード表示ボタン**(FR407):
  - LAN モード時のみ有効(`mode == "lan"` かつ `network.lanUrl !== ""`)
  - ローカルモード時は disabled + ツールチップ「LAN 共有モード時のみ利用可能」
  - 押下で QR コード表示モーダル(`QRCodeModal`、`network.lanUrl` を含む)を表示
  - QR コードには **接続 URL のみ** を含めパスワードは含めない(SUPP-001 §5.16 規定)

#### 4.5.5 設定変更の保存挙動

- 各セクションのフィールド変更時 → ローカル状態に反映 → 「保存」ボタン押下で `useUpdateConfig().mutate()` 呼出
- 部分更新リクエスト送信(変更されたフィールドのみ、SUPP-001 §5.9 ポリシー)、**v1.0.1: `defaults` フィールドの部分更新も対応**
- 成功時に Toast 通知「設定を保存しました」+ レスポンスの `restartRequired: true` 時は「再起動が必要です」追加表示
- バリデーション失敗時(422)は `details.validations.issues` を Toast / インラインエラーで表示
- mutation 成功で `['config']` クエリが invalidate され、最新値が再取得される

#### 4.5.6 プリセット管理リンクセクション(v1.0.1 で新設、M6-5 由来)

セクション 5「プリセット管理へのリンク」の詳細仕様:

- **表示**: 「プリセット管理」ボタン + 説明テキスト「プリセット(技名表記)の管理画面に移動します」(または相当)
- **挙動(v1.0.1)**: ボタンを **disabled** で表示、ホバー時のツールチップに「今後実装予定」を表示
- **クリック不可**: `/presets` ルート未実装のため `navigate('/presets')` 等は呼ばない、リンク要素ではなく `<button disabled>` 等で実装(`<a href>` でもクリックされない実装、Plan Mode で確定)
- **将来対応**: P-1 持ち越し課題として M6 終了間近の再協議で実装マイルストーン確定(M7 / M6 末尾 / 新規 M6.5 の 3 択)、本 v1.0.1 では設定画面側の表示構造だけ整備しておくことで、将来 `disabled` を外せば即動作する状態を確保

#### 4.5.7 ヘッダのナビゲーションリンク修正(v1.0.1 新設 + v1.0.2 拡張、M6-5 / M6-6 由来)

DES-005 §4.1 共通ヘッダの主要ナビゲーション「コンボ一覧、マイコンボ、プリセット、設定」規定との整合確保のため、ヘッダの **2 点の修正** を行う。

**対象ファイル**(両修正で共通): `web/src/components/Header.tsx`(または相当ファイル、§3.4.7 着手前確認で実態確認)

##### 4.5.7.1 「プリセット」ナビゲーションリンクの disabled 化(v1.0.1 由来、M6-5)

- **修正内容**: 「プリセット」リンクを **disabled** で表示、ホバー時のツールチップに「今後実装予定」を表示
- **設定画面セクション 5 と統一**: ツールチップ文言は §4.5.6 と統一(「今後実装予定」)
- **着手前確認**: 開発者ご回答 Q-2「ヘッダのプリセットリンクは未実装」を踏まえ、§3.4.7 着手前確認で現状の挙動(クリック時の catch-all 等)を確認してから修正範囲確定

##### 4.5.7.2 「設定」ナビゲーションリンクの新規追加(v1.0.2 追加、M6-6)

- **修正内容**: DES-005 §4.1 主要ナビゲーション規定の「設定へのリンク」を新規追加(M6-02 v1.0.1 で `/settings` ルートを新設したが、ヘッダからの遷移手段を追加し忘れていた = URL 直入力以外で `/settings` に到達できない UX 劣化状態の解消)
- **リンク先**: `/settings`(M6-02 v1.0.1 で新設)
- **配置**: DES-005 §4.1 主要ナビゲーション「コンボ一覧、マイコンボ、プリセット、設定」の順序を踏襲、既存「プリセット」リンクの **後ろ** に「設定」リンクを配置(Plan Mode で開発者確認、既存ヘッダの実装構造との整合性で確定)
- **disabled 化との混同回避**: 「プリセット」リンクは disabled、「設定」リンクは **通常リンク**(クリックで `/settings` へ遷移)。実装時に状態を取り違えないよう注意
- **着手前確認**: §3.4.7 着手前確認で `view web/src/components/Header.tsx` 時に「設定」リンク追加位置 + 既存リンクの実装パターン(`<Link to>` / `<a href>` / `<NavLink>` 等)を確認

##### 4.5.7.3 既存実装の温存(両修正で共通)

- ヘッダの他のナビゲーション(コンボ一覧 / マイコンボ 等)+ プリセット **切替プルダウン**(M3-03 で実装、現在表示中コンボのプリセット切替、`/presets` ルートとは別物の UI)+ 言語切替 + ユーザー表示 + モード表示 は変更しない
- スマホフッター(DES-005 §4.2)の「設定」ボタンは **本指示書スコープ外**、M6-03(スマホ専用ホーム)で集約対応する(§1.3 既定)

#### 4.5.8 QR コードモーダル(`QRCodeModal`、§3.4.8 必須項目 2)

- ライブラリ: `qrcode.react` 推奨(Plan Mode で確定)
- 表示内容: `network.lanUrl`(例: `http://192.168.1.10:47318`)
- QR コードサイズ: モーダル内に大きめ表示(スマホで読み取り可能)
- 接続 URL のテキスト表示(QR コード読取できない環境用)
- 閉じるボタン

### 4.6 設計判断事項(本指示書で確定済み)

| 項目 | 確定内容 | 根拠・備考 |
|------|---------|----------|
| `ConfigResponse.network` 追加 | サービス層拡張 + DTO 拡張で対応 | 本指示書 §4.1、retrospective-log v1.0.19 §6 M6-3 由来 |
| **(v1.0.1 追加)`Config.Defaults` 構造体追加** | `config.go` 拡張 + SUPP-001 §5.8 追記(v1.14.0) + DTO 拡張 | 本指示書 §4.1bis、retrospective-log v1.0.19 §6 M6-4 由来、確認事項 1 案 2-c |
| LAN 切替 UI | 表示のみ、切替トグルはフェーズ 2 送り | SUPP-001 §4.2、M6-overview §1.3 |
| パスワード認証 | UI のみ、認証フロー組み込みなし | SUPP-001 §4.2 / CLAUDE.md §10 |
| ユーザー管理 | UI 構造 + disabled + ツールチップ | 本指示書 §1.3、フェーズ 2 送り |
| バックアップ / リストア / キャッシュ再構築 | UI 構造 + disabled + ツールチップ(Q-ii 案 i 採用)| 本指示書 §1.3、フェーズ 2 送り |
| **(v1.0.1 追加)プリセット管理リンク** | 設定画面セクション 5 + ヘッダのプリセットリンク両方 disabled + ツールチップ「今後実装予定」| 本指示書 §4.5.6 / §4.5.7.1、retrospective-log v1.0.19 §6 M6-5 由来、確認事項 2 案 1。`/presets` ルート未実装、P-1 として §10 持ち越し、M6 終了間近で再協議 |
| **(v1.0.2 追加)ヘッダの「設定」リンク追加** | `web/src/components/Header.tsx`(または相当)に `/settings` への通常リンクを新規追加、配置は DES-005 §4.1 主要ナビゲーション順序踏襲(「プリセット」リンクの後ろ推奨、Plan Mode で開発者確認) | 本指示書 §4.5.7.2、retrospective-log v1.0.20 §6 M6-6 由来、Q-C 案 a。DES-005 §4.1 主要ナビゲーション規定との整合確保(URL 直入力以外で `/settings` にアクセス可能に)|
| **(v1.0.2 追加)ウィザード Step 3 スキップボタン** | 「次へ」「戻る」「スキップ」の 3 ボタン構成、スキップ時は `UpdateConfigRequest.Defaults.CharacterID = 1` 送信 | 本指示書 §4.4.1、軽微-3 連絡事項 4 由来(v1.0.1 で「スキップ可能」と明示したが実装漏れだった補正)|
| 設定画面と初回ウィザードの API 共通化 | `web/src/lib/configApi.ts` を 1 ファイル設計で共有 | M6-overview §2.3、M6-01 完了報告で確定 |
| ウィザード完了時の遷移先 | コンボ一覧(`/`)固定 | 本指示書 §4.4.5、M6-overview §2.5 |
| 初回判定リダイレクト | `App.tsx` でグローバル判定 + `<Navigate>` 利用 | 本指示書 §4.3、§3.4.8 必須項目 3 推奨 |
| QR コード生成 | `qrcode.react` 推奨、Plan Mode で確定 | 本指示書 §3.4.8 必須項目 2、CLAUDE.md §6 |
| 言語選択 | react-i18next 採用、§3.4.3 確認後判断 | DES-002 §5.4、CLAUDE.md §2 |
| サービス層インターフェース拡張 | 既存 `Service` インターフェースの戻り値拡張 + 同時にハンドラ層対応修正 | architecture-patterns §2.1、retrospective-log v1.0.19 §6 M6-1 反省踏襲 |
| エラーコード命名 | 小文字スネークケース統一(`network_unavailable` 等)| M4-01 setup 系統一済み、handover §4.1 L-02 |

---

## 5. テスト要件

### 5.1 必須テスト

#### 5.1.1 バックエンドテスト(`internal/service/config/` + `internal/api/config/` + `internal/config/`、v1.0.1 で defaults 系追加)

- [ ] §4.1.4 サービス層テスト 3 件追加すべて通過(NetworkLocalMode / NetworkLanMode / NetworkLanModeFailure)
- [ ] §4.1.5 ハンドラ層テスト 2 件追加すべて通過(NetworkLocalMode / NetworkLanMode)
- [ ] **(v1.0.1 追加)§4.1bis.6 既存 `config_test.go` 追加テスト 4 件すべて通過**(DefaultsFromFile / DefaultsFromDefault / DefaultsCharacterIDZero / DefaultsPresetIDZero)
- [ ] **(v1.0.1 追加)§4.1bis.7 サービス層 defaults 系テスト 3 件すべて通過**(Update_DefaultsPartial / Update_DefaultsValidationFailure / Get_DefaultsValues)
- [ ] **(v1.0.1 追加)§4.1bis.8 ハンドラ層 defaults 系テスト 2 件すべて通過**(Get_DefaultsValues / Update_DefaultsPartial)
- [ ] M6-01 既存サービス層テスト 7 件 + ハンドラ層テスト 6 件すべて通過(回帰なし)
- [ ] `internal/config/config_test.go` 既存 7 ケース通過(変更なし、既存挙動温存、追加テスト 4 件と独立)

#### 5.1.2 フロントエンドテスト(`web/src/features/config/` + `web/src/pages/` + `web/src/components/`、vitest、v1.0.1 で defaults / プリセット管理リンク系追加)

- [ ] **useConfig**: `GET /api/config` を呼び、`ConfigResponse` を返すテスト(MSW モック)
- [ ] **useUpdateConfig**: `PUT /api/config` を呼び、成功時に `['config']` invalidate されるテスト
- [ ] **SettingsPage**: 6 セクションすべてレンダリングされるテスト
- [ ] **SettingsPage**: ネットワークセクションで LAN モード時のみ QR ボタン有効、ローカルモード時 disabled テスト
- [ ] **SettingsPage**: バックアップ / リストア / キャッシュ再構築ボタンが disabled + ツールチップ表示テスト
- [ ] **SettingsPage**: ユーザー追加・編集ボタンが disabled テスト
- [ ] **(v1.0.1 追加)SettingsPage**: 基本セクションでデフォルト表示キャラ変更 → `PUT /api/config` に `{ defaults: { characterId: <選択値> } }` 送信されるテスト(MSW モック)
- [ ] **(v1.0.1 追加)SettingsPage**: 基本セクションでデフォルトプリセット変更 → `PUT /api/config` に `{ defaults: { presetId: <選択値> } }` 送信されるテスト
- [ ] **(v1.0.1 追加)SettingsPage**: セクション 5「プリセット管理リンク」ボタンが disabled + ツールチップ「今後実装予定」表示テスト
- [ ] **(v1.0.1 追加)Header**: 「プリセット」ナビゲーションリンクが disabled + ツールチップ「今後実装予定」表示テスト(M6-5 由来)
- [ ] **WizardPage**: 7 ステップ全件レンダリングテスト(ステップ番号別)
- [ ] **WizardPage**: LAN 無効時はステップ 6 をスキップしてステップ 7 完了に遷移するテスト
- [ ] **WizardPage**: LAN 有効時はステップ 6 表示、パスワード入力後にステップ 7 完了に遷移するテスト
- [ ] **WizardPage**: 完了ボタン押下で `PUT /api/config` 呼出 + コンボ一覧へ遷移するテスト(MSW モック)
- [ ] **(v1.0.1 追加)WizardPage**: ステップ 3 でデフォルトキャラを選択、ステップ 7 完了時に `defaults.characterId` がリクエストに含まれるテスト
- [ ] **(v1.0.1 追加)WizardPage**: ステップ 4 でデフォルトプリセットを選択、ステップ 7 完了時に `defaults.presetId` がリクエストに含まれるテスト
- [ ] **(v1.0.1 追加)WizardPage**: ステップ 3 でスキップした場合、`defaults.characterId` がデフォルト値 1 で送信されるテスト
- [ ] **QRCodeModal**: QR コード生成 + URL テキスト表示テスト
- [ ] **WizardProgress**: 現在ステップ番号 + プログレスバー表示テスト
- [ ] **App.tsx 初回判定リダイレクト**: `isInitialized: false` で `/wizard` リダイレクトされるテスト(MSW モック)
- [ ] **App.tsx 初回判定リダイレクト**: `isInitialized: true` でコンボ一覧表示されるテスト

#### 5.1.3 既存テストの回帰確認(必須)

- [ ] M5-01 比較画面 + M4-05 セットプレイ + M3-05 マイコンボ + M2 編集系 + M1 コア API の vitest 全件通過(回帰なし)
- [ ] `cd web && pnpm test` 全件通過
- [ ] `cd web && pnpm build` 成功

#### 5.1.4 ビルド・型チェック

- [ ] `cd web && pnpm test` 通過
- [ ] `cd web && pnpm build` 成功
- [ ] `cd web && pnpm typecheck`(設定ありなら)成功、なし → tsc --noEmit 相当通過
- [ ] `go test ./...` 全件通過
- [ ] `go build ./...` 成功
- [ ] `go vet ./...` でエラーなし

### 5.2 E2E シナリオ(開発者の責任範囲、製造担当は手順書記載まで、v1.0.1 で H / I 追加)

#### A. 初回起動ウィザード正常系

1. `config.toml` を削除(初回起動状態に戻す)
2. サーバー起動 → ブラウザで `http://localhost:47318/` にアクセス
3. 期待: `/wizard` にリダイレクトされる
4. ステップ 1〜7 を通過(言語=日本語、デフォルトキャラ=リュウ、プリセット=official_ja_move、LAN=無効)
5. ステップ 7「完了」押下
6. 期待: コンボ一覧(`/`)へ遷移、`config.toml` がリポジトリルートに自動生成されている、**(v1.0.1 追加)`[defaults]` セクション(character_id = 1, preset_id = 1)が `config.toml` に含まれている**

#### B. LAN モード設定時の挙動

1. `config.toml` を削除
2. ウィザード ステップ 5 で「LAN 共有を有効にする」チェック
3. 期待: ステップ 6「パスワード設定」が表示される
4. ステップ 6 でパスワード入力(任意)、ステップ 7 完了
5. 期待: コンボ一覧へ遷移、`config.toml` の `[server].mode` が `"lan"` になっている
6. **アプリ再起動なしでは LAN モードのバインドアドレスは適用されない**(SUPP-001 §4.2 既定)、開発者がアプリ再起動してから LAN 端末からアクセスして動作確認

#### C. 設定画面の表示と編集

1. `/settings` にアクセス
2. 期待: 6 セクションすべて表示される
3. 基本セクションで言語を「English」に変更 → 「保存」押下
4. 期待: Toast 通知「設定を保存しました」、画面表示が英語に切り替わる(react-i18next 機能、§3.4.3 確認結果次第)
5. ネットワークセクションで LAN モード時 → QR ボタン押下
6. 期待: QR コードモーダルが表示、`network.lanUrl` が QR + テキストで表示される

#### D. データセクションの disabled 確認

1. `/settings` のデータセクションを表示
2. 期待: DB ファイルパス表示は値が見える、手動バックアップ・リストア・キャッシュ再構築ボタンは disabled + ツールチップ表示

#### E. ユーザーセクションの disabled 確認

1. `/settings` のユーザーセクションを表示
2. 期待: ユーザー追加・編集・パスワード変更すべて disabled + ツールチップ「フェーズ 2 で実装」

#### F. アプリ起動時のリダイレクト確認

1. `config.toml` が存在する状態でブラウザリロード(`isInitialized: true`)
2. 期待: `/wizard` にリダイレクトされない、通常のコンボ一覧表示

#### G. 既存機能の回帰確認

1. コンボ一覧 / マイコンボ / コンボ詳細 / コンボ登録 / セットプレイ / タグ管理 / ゴミ箱 / 比較 すべて動作確認
2. 期待: 既存機能が M6-02 で破壊されていない

#### H. ウィザードのデフォルトキャラ / プリセット選択の永続化確認(v1.0.1 追加、M6-4 由来)

1. `config.toml` を削除(初回起動状態)
2. ウィザード ステップ 3 でデフォルト表示キャラを選択(リュウ以外の選択肢が存在する場合は別のキャラ、リュウのみの場合はリュウ)
3. ウィザード ステップ 4 でデフォルトプリセットを選択(`official_ja_move` 以外の選択肢が存在する場合は別のプリセット、`official_ja_move` のみの場合は同プリセット)
4. ステップ 7「完了」押下
5. 期待: コンボ一覧へ遷移、`config.toml` の `[defaults]` セクションに `character_id = <選択値>` / `preset_id = <選択値>` が書き込まれている
6. ブラウザリロード → `/settings` にアクセス
7. 期待: 基本セクションのデフォルト表示キャラ / デフォルトプリセットが、ステップ 3 / 4 で選択した値で初期表示される
8. 基本セクションでデフォルト表示キャラを別の値に変更 → 「保存」押下
9. 期待: Toast 通知「設定を保存しました」、`config.toml` の `[defaults].character_id` が変更後の値に書き換わる
10. ブラウザリロード → 設定画面で変更後の値が反映されていることを確認

#### I. プリセット管理リンク disabled 確認(v1.0.1 追加、M6-5 由来)

1. `/settings` にアクセス
2. 期待: セクション 5「プリセット管理リンク」のボタンが disabled で表示される、ホバー時にツールチップ「今後実装予定」が表示される、クリックしても画面遷移しない
3. ヘッダの「プリセット」ナビゲーションリンクを確認
4. 期待: ヘッダの「プリセット」リンクも disabled + ツールチップ「今後実装予定」表示、クリックしても画面遷移しない
5. ヘッダの「プリセット切替プルダウン」(M3-03 で実装、現在表示中コンボのプリセット切替)は **動作する**(本指示書 v1.0.1 では変更しない、開発者ご回答 Q-3 より別物の UI)

#### J. ヘッダの「設定」リンクとウィザード Step 3 スキップボタンの動作確認(v1.0.2 追加、M6-6 由来 + 連絡事項 4)

**目的**: ヘッダから `/settings` への遷移が可能であること(URL 直入力以外で設定画面アクセス可能)+ ウィザード Step 3 でスキップボタンが動作することを確認する。

**J-1. ヘッダ「設定」リンクの動作確認**:

1. `config.toml` が存在する状態(ウィザード完了後想定)で `http://localhost:47318/` にアクセス
2. 期待: コンボ一覧画面が表示される、ヘッダに「コンボ一覧」「マイコンボ」「プリセット(disabled)」「設定」の 4 つの主要ナビゲーションリンクが表示されている
3. ヘッダの「設定」リンクをクリック
4. 期待: `/settings` へ遷移、設定画面 6 セクションが表示される
5. ブラウザの「戻る」ボタンでコンボ一覧画面に戻れることを確認
6. ヘッダの「設定」リンクが他のページ(マイコンボ / コンボ詳細 等)からも有効でクリックすると `/settings` へ遷移することを確認

**J-2. ウィザード Step 3 スキップボタンの動作確認**:

1. `config.toml` を削除(初回起動状態に戻す)
2. サーバー起動 → ブラウザで `http://localhost:47318/` にアクセス
3. 期待: `/wizard` にリダイレクトされる
4. ステップ 1(ようこそ)→ 2(言語)→ 3(デフォルト表示キャラ選択)まで進む
5. 期待: ステップ 3 画面に「次へ」「戻る」「スキップ」の 3 ボタンが表示されている
6. 「スキップ」ボタンをクリック
7. 期待: ステップ 4(プリセット選択)に遷移する
8. ステップ 4 以降も通過して最後にステップ 7「完了」押下
9. 期待: `config.toml` の `[defaults]` セクションに `character_id = 1`(リュウ、スキップ時のデフォルト値)が書き込まれている

---

## 6. レビュー観点(別ファイル参照)

機械レビュー観点は別ファイル `M6-02-review-checklist.md`(**v1.0.1**、設計担当作成)を参照する。

---

## 7. 完了条件(Definition of Done)

### 7.1 機能要件

- [ ] `ConfigResponse.network` フィールドが追加され、`GET /api/config` レスポンスに含まれる
- [ ] LAN モード時に `network.primaryLanIp` + `lanUrl` が正しく返る、ローカルモード時は空文字
- [ ] `/wizard` ルートが動作し、7 ステップを通過してコンボ一覧へ遷移する
- [ ] `/settings` ルートが動作し、6 セクションが表示される
- [ ] 設定画面の「ネットワーク」セクションで QR コード表示が LAN モード時のみ有効
- [ ] 設定画面の「データ」セクションで DB パス表示のみ実装、他は disabled
- [ ] 設定画面の「ユーザー」セクションが disabled
- [ ] **(v1.0.1 追加)設定画面の「プリセット管理リンク」セクション(セクション 5)が disabled + ツールチップ「今後実装予定」表示**(M6-5 由来、確認事項 2 案 1)
- [ ] **(v1.0.1 追加)ヘッダの「プリセット」ナビゲーションリンクが disabled + ツールチップ「今後実装予定」表示**(M6-5 由来、開発者ご回答 Q-2 踏襲)
- [ ] **(v1.0.2 追加)ヘッダの「設定」ナビゲーションリンクが新規追加されている、クリックで `/settings` に遷移する**(DES-005 §4.1 主要ナビゲーション規定整合、M6-6 由来、Q-C 案 a)
- [ ] **(v1.0.2 追加)ウィザード Step 3「デフォルト表示キャラ選択」に「スキップ」ボタンが実装され、押下時に `UpdateConfigRequest.Defaults.CharacterID = 1` がセットされてステップ 4 に遷移する**(軽微-3 連絡事項 4 由来)
- [ ] **(v1.0.1 追加)`ConfigResponse.defaults` フィールド(`characterId` / `presetId`)が追加され、`GET /api/config` レスポンスに含まれる**
- [ ] **(v1.0.1 追加)ウィザード ステップ 3 / 4 で選択した値が `Config.Defaults` に永続化される、設定画面基本セクションで変更可能、`config.toml` の `[defaults]` セクションに書き込まれる**
- [ ] アプリ起動時に `isInitialized: false` なら `/wizard` リダイレクト、`true` なら通常起動
- [ ] ウィザード完了時に `config.toml` が自動生成される(`[server]` / `[database]` / `[logging]` / `[security]` / **(v1.0.1)`[defaults]`** すべて含む)
- [ ] `web/src/lib/configApi.ts` が設定画面 + ウィザードの両方から共有されている

### 7.2 自己テスト結果(製造担当の責任範囲)

- [ ] §5.1.1 バックエンドテスト追加 **14 件**(v1.0.0 5 件 + **v1.0.1 追加 9 件**: §4.1bis.6 で 4 件 + §4.1bis.7 で 3 件 + §4.1bis.8 で 2 件)+ 既存回帰すべて通過
- [ ] §5.1.2 フロントエンドテスト **20 件以上**(v1.0.0 13 件 + **v1.0.1 追加 7 件以上**)主要 UI 動作確認すべて通過
- [ ] §5.1.3 既存テスト回帰なし
- [ ] §5.1.4 ビルド・型チェック通過

### 7.3 品質チェック

- [ ] **(v1.0.1 改訂)`internal/config/config.go` の既存 4 サブ構造体(Server / Database / Logging / Security)を変更していない**(`Defaults` 構造体の追加 + `Config.Defaults` フィールド追加のみ許容、§2.4 例外条項 (f))
- [ ] **(v1.0.1 改訂)`internal/config/config_test.go` の既存 7 ケースを変更していない**(追加テスト 4 件のみ、§2.4 例外条項 (g))
- [ ] `cmd/combomgr/main.go:determineBindAddr()` / `buildAllowedOrigins()` / `e.Start()` を変更していない(既存挙動温存)
- [ ] `internal/infra/netutil/` の関数本体を変更していない(読出のみ)
- [ ] 設計書本体を変更していない
- [ ] **(v1.0.1 改訂)SUPP-001 を変更していない**(本セッションで v1.13.0 → v1.14.0 改訂済み、製造担当は §5.8 v1.14.0 表記を参照して実装する)
- [ ] 新規 CHANGE 通知書を起票していない(M6-overview §9 既定)
- [ ] **(v1.0.1 追加)プリセット管理画面 `/presets` を実装していない**(P-1 持ち越し、§1.3、M6 終了間近で再協議)
- [ ] architecture-patterns §2.1 サービス層インターフェース定義パターン遵守(M6-01 で確立、M6-02 でも継続、defaults 拡張時も同パターン踏襲)
- [ ] architecture-patterns §3 エラーレスポンス共通型遵守
- [ ] architecture-patterns §1 プレゼンテーション層/ロジック層分離パターン遵守
- [ ] architecture-patterns §1.1 queryKey 規約遵守(`['config']` flat tuple、ID パラメータなしのため number 正規化対象外)
- [ ] CLAUDE.md §4 規約遵守(JSON タグ camelCase、TypeScript 型 1:1 対応、TOML タグ snake_case、Go フィールド PascalCase)
- [ ] CLAUDE.md §6 依存追加ポリシー遵守(QR ライブラリ + react-i18next 追加、Plan Mode で承認後)
- [ ] CLAUDE.md §10 禁止事項に抵触なし(セキュリティ自己判断なし、機微情報のログ出力なし等)
- [ ] **shadcn/ui を使用していない**(playbook §17.2、M7 まで未導入)

### 7.4 ドキュメント

- [ ] `docs/progress/progress-log.md` に M6-02 完了報告が追記されている
- [ ] §3.4 着手前確認結果(§3.4.1〜§3.4.6 全 6 項目 + **(v1.0.1 追加)§3.4.7 設定画面 6 セクション ↔ 既存実装実態の対応表**)が完了報告に含まれている(M6-01 完了報告の伝達事項 3 改善提案踏襲)
- [ ] **(v1.0.1 改訂)§3.4.8 Plan Mode 必須項目 8 件**(v1.0.0 7 件 + v1.0.1 追加 1 件 = `[defaults]` フィールド設計)の開発者承認結果が完了報告に含まれている
- [ ] §4.6 設計判断事項表との整合確認結果が明記されている(逸脱が発生した場合は理由を明記)
- [ ] **(v1.0.2 改訂)§5.2 E2E シナリオ A〜J**(v1.0.1 で H / I 追加、v1.0.2 で J 追加)の手順 + 開発者実機検証結果が明記されている
- [ ] 例外条項適用箇所(§2.4 (a)〜**(h)**、v1.0.1 で (f) / (g) / (h) 追加)の明示

### 7.5 完了報告

開発者と機械レビュー担当へ以下を伝える:

- 実装ファイル一覧(新規 + 修正、特に `ConfigResponse.network` + **`Config.Defaults`**(v1.0.1)追加実装 + プリセット管理リンク disabled 化)
- 自己テスト結果
- §5.2 E2E シナリオ A〜J 実行結果(手順書 + 開発者検証結果、v1.0.2 で J 追加)
- §3.4.8 Plan Mode 必須項目 8 件の開発者承認結果(議事録的に)
- 例外条項適用箇所の明示
- M6-01 完了報告と同様、製造担当からの伝達事項(設計担当への改善提案、playbook / architecture-patterns 改訂提案等)歓迎(handover §6.2)

---

## 8. 参照ドキュメント

| ID | パス | 用途 |
|----|------|------|
| REQ-001 | `docs/design/requirements.md` v2.11.0 | FR101 / FR407 / FR603(参照のみ) |
| DES-002 | `docs/design/02-architecture.md` v1.8.0 | §3.2〜§3.4 / §4.2 / §4.4 / §5.4 i18n |
| DES-005 | `docs/design/05-screen-design.md` v2.8.0 | §4.1 ヘッダ / §4.3 共通要素 / §4.4 ブレークポイント / §5.1 ウィザード / §5.10 / §5.11(プリセット管理画面、P-1 持ち越し)/ §5.16 設定画面 |
| **(v1.0.1 改訂)SUPP-001** | `docs/design/supp-001-detailed-design.md` **v1.14.0** | §2.6.1 / §2.6.2 / §4.1 マイルストーン分割(M7 プリセット管理画面割当は M6 終了間近で再協議、P-1 由来)/ §4.2 / **§5.8 設定ファイル例 + `[defaults]` セクション(v1.14.0 追記)** / §5.9 |
| architecture-patterns | `docs/handover/architecture-patterns.md` **v1.0.4** | §1 / §1.1 / §2 / §2.1(M6-01 で確立、本指示書 defaults 拡張時も踏襲)/ §3 |
| **(v1.0.1 追加)retrospective-log** | `docs/handover/retrospective-log.md` **v1.0.19** | §6.1 M6-3 / M6-4 / M6-5(本指示書 v1.0.1 改訂の根拠)、§6.6 P-1 暫定記録 |
| CLAUDE.md | `CLAUDE.md` | §2 / §4 / §5 / §6 / §10 |
| M6-RESEARCH-01 レポート | `docs/instructions/M6-RESEARCH-01-report.md` | 既存実装状態の確認(2026-05-23 完了) |
| M6-01 完了報告 | M6-01 製造担当伝達事項(2026-05-23 開発者経由) | `ConfigResponse` 確定構造 / CSRF ヘッダー等 |
| M6-overview | `docs/instructions/M6-overview.md` v1.0.0 | §2.3 / §2.5 / §2.7 / §4.3 |
| playbook | `docs/handover/design-instruction-playbook.md` v1.8.0 | §2 / §5 / §17.1 / §17.2 |

---

## 9. 注意事項・判断に迷ったら

### 9.1 推測で進めてはいけない事項

- M6-01 で確定した `ConfigResponse` の JSON キー命名を **推測で書き換えない**(M6-01 完了報告で 1:1 対応必須と確定)
- 既存サービス層インターフェース定義パターンを **推測で逸脱しない**(`*Service` 具象型ポインタを返さない、architecture-patterns §2.1 厳守、retrospective-log §6 M6-1 反省踏襲)
- 既存フォーム部品の Props / 責務を **推測で書かない**(§3.4.5 で実コード確認)
- react-i18next の実装状況を **推測で書かない**(§3.4.3 で実態確認)
- `/wizard` / `/settings` / `/` ルートの予約状況を **推測で書かない**(§3.4.2 で実態確認)
- 既存ヘルパ(`fetchJSON` の X-Requested-With 自動付与等)を **推測で書かない**(§3.4.4 で実態確認)
- `netutil.SelectPrimaryLANIP()` のエラー条件を **推測で書かない**(§3.4.6 で実態確認)

### 9.2 推測で進めてよい事項(その旨を明示)

- 変数名 / 関数名 / コメント文言 / 行内コード構成 / import エイリアス命名は製造担当の実装裁量範囲
- 本指示書 §4 のサンプルコードは **参考実装**、製造担当が既存パターンと整合させて実装する(完了報告で逸脱が発生した場合は理由を明記)
- 進捗バーの視覚デザイン詳細(色 / アニメーション)は製造担当の裁量範囲
- ステップ間のトランジション(フェードイン / スライド等)は YAGNI で省略可

### 9.3 不明事項発見時の対応

- 既存実装と本指示書 §4 規定が矛盾する場合: Plan Mode で開発者に報告 + 協議
- `/wizard` / `/settings` ルートが既に予約されている場合: **Plan Mode で停止 + 開発者協議**
- react-i18next 既存実装が想定と大きく異なる場合(例: i18next-react ではなく独自実装): **Plan Mode で停止 + 開発者協議**
- M6-01 で実装したサービス層が architecture-patterns §2.1 と異なる構造だった場合(本指示書執筆時の認識ミス): **Plan Mode で停止 + 開発者協議**
- 設計書本体への影響が発覚した場合: **Plan Mode で停止 + 開発者協議**(CHANGE 通知書起票判断)
- バックアップ / リストア / キャッシュ再構築の実装範囲を広げる必要が出た場合: **Plan Mode で停止 + 開発者協議**(本指示書 §1.3 違反、Q-ii 案 i 採用方針確認)

### 9.4 Plan Mode で計画提示時に含めるべき項目(必須、v1.0.1 で更新)

- §3.4.1〜§3.4.6 着手前確認結果(view 確認の結果サマリ)
- **(v1.0.1 追加)§3.4.7 設定画面 6 セクション ↔ 既存実装実態の対応表(完全に埋めた状態)**(M6-3 / M6-4 / M6-5 反省踏襲の最重要観点)
- **(v1.0.1 改訂)§3.4.8 必須項目 8 件すべての方針**(M6-2 反省踏襲、本文中の Plan Mode 確定指示を §3.4.8 リストに明示列挙、v1.0.1 で +1 件追加 = `[defaults]` セクションのフィールド設計)
- **(v1.0.2 改訂)§4 詳細仕様の実装順序**(推奨: バックエンド `ConfigResponse.network` + **`Config.Defaults`** 拡張 → フロント `configApi.ts` → `App.tsx` 起動時判定 → `WizardPage`(**v1.0.2 追加: Step 3 スキップボタン含む**)→ `SettingsPage`(プリセット管理リンク disabled 含む)→ ヘッダのプリセットリンク disabled + **(v1.0.2 追加)ヘッダの「設定」リンク新規追加** → テスト)
- §5.1 必須テストの実装範囲(v1.0.1 で BE 9 件 + フロント 7 件以上追加)
- §5.2 E2E シナリオ(A〜J、v1.0.1 で H / I 追加、v1.0.2 で J 追加)の実行計画
- 既存パターンと逸脱する箇所がある場合の理由
- 依存追加(QR コードライブラリ + react-i18next が未導入の場合)の Plan Mode 承認依頼

---

## 10. 完了後の次ステップ(v1.0.1 で更新)

設計担当 Claude が M6-02 完了承認を受け取り、以下に進む:

1. retrospective-log v1.0.19 の M6-3 / M6-4 / M6-5 記録が確定(本セッションで v1.0.18 → v1.0.19 改訂済み、開発者反映済み想定)
2. **(v1.0.1 追加)P-1 持ち越し課題(プリセット管理画面 `/presets` 実装位置づけ確定)を M6 終了間近で開発者と再協議**:
   - 選択肢: (i) M7 で作成(現状 M7 スコープに追加)/ (ii) M6 末尾で作成(余裕がある場合に判断、関心数増加の可否)/ (iii) 新規マイルストーン M6.5 を作成(M6 と M7 の間、別チャットで実施)
   - 選択肢確定後、SUPP-001 §4.1 マイルストーン分割表の改訂を本セッションで実施(または m6-to-m7-handover 作成時に実施)
3. M6-03 指示書(スマホ専用ホーム)+ レビューチェックリストの作成
4. M6-03 着手前に M6-02 完了時点の設定画面 + ウィザード実装結果を view し、スマホホームから各画面への遷移先実装と整合させる

---

*以上、M6-02 v1.0.2 ドラフト*
