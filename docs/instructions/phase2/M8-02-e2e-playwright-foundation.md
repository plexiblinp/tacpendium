# 指示書 M8-02: E2E テスト(Playwright)基盤の前倒し導入

| 項目 | 内容 |
|------|------|
| 指示書ID | M8-02 |
| バージョン | 1.0.0 |
| 推奨モデル | Sonnet 4.6(新ツールチェーン導入 + test-id retrofit + 既存シナリオ→spec 変換が中心。創発的設計判断は限定的) |
| Plan Mode | 必須(§3.4 着手前確認 = spec 化対象フロー・testid 付与対象・webServer 起動方式・seed 前提。確認 2 件以上のため §8.4 質問書ファイル方式) |
| 機械レビュー | 必須(別チェックリスト: `M8-02-review-checklist.md`) |
| 並列性 | 横断ワークストリーム(moves ゲート非依存)。M8-01 完了後に着手 |
| 依存指示書 | M8-01(完了)。CHANGE-024 反映済み(DES-002 §12 v1.13.0 / SUPP §4.5 v1.23.0)。前提事実は M8-RESEARCH-01 調査レポート |
| 想定所要時間 | 150〜240 分(基盤導入 + testid retrofit + スモーク spec) |
| 作成者・作成日 | 設計担当 Claude(フェーズ2 継続担当)、2026-06-12 |

## 更新履歴

| バージョン | 更新日 | 更新内容 |
|-----------|--------|----------|
| 1.0.0 | 2026-06-12 | 初版作成。CHANGE-024 で確定した E2E 前倒し・段階導入の基盤サブユニット |

---

## 1. 背景と目的

### 1.1 背景

- CHANGE-024 で E2E(Playwright)をフェーズ2 で**段階導入**と確定(DES-002 §12 v1.13.0 / SUPP §4.5 v1.23.0)。根拠は M8-RESEARCH-01 の実現性調査(手動 E2E のボトルネック化、機能回帰の頻回再実行=償却、配布前の回帰安全)。
- M8-RESEARCH-01 の事実: Playwright 未導入 / 製造コードの `data-testid` は **1 件のみ**(shadcn/ui=Radix の暗黙 role は利用可)/ CI なし / vite=5173・backend=47318 / pnpm 9.13・Makefile あり / 手動 E2E シナリオは `docs/instructions/phase1`(個別 + インライン)と `docs/progress/phase1`(統合 E2E 結果スイート)に存在。

### 1.2 目的

完了時に達成される状態:

- `@playwright/test` が導入され、`playwright.config.ts` でローカル実行できる(vite + backend を起動 → spec 実行)。
- **test-id 規約**が定義され、高価値フローの操作要素に必要最小限の `data-testid` が付与されている(Radix の `role`+`name` で一意な要素には付与しない)。
- **高価値・安定した機能フロー**のスモーク/回帰 spec が最小本数あり、ローカルで `pnpm e2e`(+ Makefile ターゲット)から実行できる。
- 既存のユニットテスト(Go test / Vitest)が非破壊。

### 1.3 このサブユニットで作らないもの(スコープ外)

| 項目 | 理由 |
|------|------|
| 視覚・レスポンシブ・レイアウト崩れ・操作感 UX の自動化 | 自動化対象外。手動 E2E に継続(CHANGE-024)。Playwright は機能回帰の反復を肩代わりするもの |
| LAN 実機・スマホ実機・QR の自動化 | Claude/Playwright は実機・LAN を走らせられない。手動継続 |
| CI(GitHub Actions 等)の構築 | 本フェーズはローカル実行モデル(CHANGE-024)。CI はフェーズ3以降の選択肢 |
| 全 177 シナリオの spec 化 | 段階導入。まず高価値・安定フローのスモーク/回帰から(M9〜M12 で漸進拡充) |
| 全 UI 要素への data-testid 付与 | Radix の暗黙 role を活用し、付与は spec が触る操作要素に限定 |
| 新機能の初回探索の自動化 | 手動 E2E に残す |

---

## 2. 成果物

### 2.1 作成するファイル(概略・実パスは §3.4 で確認)

| ファイル | 内容 |
|---------|------|
| `playwright.config.ts`(リポジトリルート or `web/`) | testDir・baseURL・webServer・projects(§4.2) |
| `e2e/*.spec.ts`(高価値フローのスモーク/回帰、最小本数) | §4.4。spec 化対象は §3.4.1 で合意 |
| test-id 規約のドキュメント(`docs/` 配下の短い規約 note、または README 追記) | §4.3 |

### 2.2 修正するファイル

| ファイル | 修正内容 |
|---------|----------|
| `web/package.json` | `devDependencies` に `@playwright/test`、`scripts` に `e2e` 等(§4.1 / §4.5) |
| `Makefile` | E2E 実行ターゲット追加(§4.5) |
| 高価値フローの対象コンポーネント(§3.4.2 で特定) | spec が参照する操作要素へ `data-testid` を**最小限**付与(§4.3) |

### 2.3 変更しないもの

- 既存のアプリ挙動・UI の見た目・既存ユニットテスト(testid 付与は属性追加のみで挙動不変)。
- バックエンド API・DB スキーマ(E2E は外側からの検証で、実装に手を入れない)。
- CI 設定(本フェーズで新設しない)。

### 2.4 例外条項

testid 付与は §3.4.2 で合意した操作要素に限る。spec を書く過程で「この要素にも testid が要る」と判明した場合は、付与してよい(spec の安定化に必要な最小限の範囲)。ただしコンポーネントのロジック・構造変更を伴う場合は Plan Mode で停止して相談すること。

---

## 3. 前提条件

### 3.1 必読

- **M8-RESEARCH-01 調査レポート**(`docs/instructions/M8-RESEARCH-01-report.md`):現行フロー・testid 状況・自動化困難手順・環境の事実。本指示書の前提事実源。
- DES-002 §12(テスト方針、CHANGE-024 反映済み)、SUPP-001 §4.5(段階導入)。
- 既存の手動 E2E スイート: `docs/progress/phase1` の統合 E2E 結果(実際に再実行されている回帰セット)+ `docs/instructions/phase1` の `m*-e2e-scenarios.md` / インライン記載(spec 変換の素地)。

### 3.2 任意参照

- DES-005(画面設計):対象フローの画面・操作要素の把握。

### 3.3 参照不要

- DES-003 / DES-004 / DES-006(本サブユニットはテスト基盤で、データモデル・記法・バリデーションを変更しない)。

### 3.4 着手前の確認(Plan Mode で開発者へ報告。§8.4 質問書ファイル方式)

#### 3.4.1 spec 化対象フローの合意

- [ ] まず spec 化する**高価値・安定フロー**を合意する。候補(M8-RESEARCH-01 + CHANGE-024 §3.3): コンボ登録 / 編集 / 削除 / 一覧フィルタ / 比較 / タグ / セットプレイ紐付け。素地は `docs/progress/phase1` の統合 E2E 結果スイートの**機能サブセット**(視覚・LAN・UX 評価項目を除く)。初回は欲張らず 1〜3 本のスモークから(残りは M9〜M12 で漸進)。**どのフローを初回 spec にするか**を Plan Mode で提案・合意。

#### 3.4.2 data-testid 付与対象の特定

- [ ] §3.4.1 の対象フローが触る操作要素のうち、Radix の `getByRole('button', { name })` 等で一意に取れないものを列挙し、`data-testid` 付与対象とする(M8-RESEARCH-01 §2 の未付与要素)。**role+name で取れる要素には付与しない**(retrofit を最小化)。

#### 3.4.3 webServer 起動方式

- [ ] `playwright.config.ts` の `webServer` で vite(5173)+ backend(47318)をどう起動するか。既存 Makefile ターゲット(run-server / run-web)を活用するか、config 内 `webServer` で直接起動するか、を実態確認して提案。ポートは現行値(5173 / 47318)を使う(旧シナリオの 3000 / 8080 表記は陳腐化、M8-RESEARCH-01 §5 特記3)。

#### 3.4.4 spec 実行時の seed/DB 前提

- [ ] spec 実行時の DB 状態(クリーン DB か、既知 seed〔リュウ等〕が入った状態か)。データ前提が必要な spec(「コンボが N 件ある状態」等)は、spec 内で前提データを作るか、既知 seed に依存するかを決める。M9 で seed がツール再生成に変わる(CHANGE-025)ため、**spec は特定 seed の件数に過度に依存しない**設計を推奨。

実態が想定と異なる場合は独断で進めず Plan Mode で報告すること。

---

## 4. 詳細仕様

### 4.1 Playwright 導入

- `web/`(フロントエンドの package.json がある場所)で `pnpm add -D @playwright/test`。
- `pnpm exec playwright install chromium`(ローカル実行用。CI なしのため chromium のみで可)。
- `web/package.json` の `scripts` に `"e2e": "playwright test"` を追加。

### 4.2 playwright.config.ts

- `testDir`: `e2e/`(spec 配置場所)。
- `baseURL`: `http://localhost:5173`(vite)。
- `webServer`: §3.4.3 で合意した方式で vite + backend を起動(`reuseExistingServer: true` でローカルの起動済みサーバを再利用可)。
- `projects`: chromium 1 つで開始(複数ブラウザは本フェーズ不要)。
- `use`: `headless: true`(ローカル CI なしのデフォルト)。`trace: 'on-first-retry'` 等は任意。

### 4.3 test-id 規約

- 命名: `data-testid="{feature}-{element}"`(例: `combo-list-row` / `combo-editor-save` / `tag-filter-input`)。小文字ケバブ、feature プレフィックスで衝突回避。
- 付与方針: **spec が触る操作要素に限定**。shadcn/ui=Radix 由来の安定した `role`(button / dialog / textbox 等)+ アクセシブル名で一意に取れる要素には付与しない(`getByRole` を優先)。
- 規約は短いドキュメント(`docs/` 配下 or README)に記し、以降の spec / 機能追加で踏襲する。

### 4.4 スモーク/回帰 spec

- §3.4.1 で合意したフローを spec 化(初回 1〜3 本)。各 spec は `docs/progress/phase1` 統合 E2E 結果スイートの機能サブセットを素地にし、**現行ポート/現行 UI** に合わせて記述する(旧シナリオの陳腐化ポート・古い導線をそのまま写さない)。
- 例(合意後に確定): `combo-crud.spec.ts`(コンボ登録 → 一覧に出る → 詳細表示 → 編集 → 削除)、`combo-list-filter.spec.ts`(一覧フィルタの絞り込み)。
- セレクタは `getByRole` / `getByLabel` を第一とし、足りない箇所のみ `getByTestId`。
- 視覚・レイアウト・レスポンシブのアサートは入れない(機能の成否のみ検証)。

### 4.5 ローカル実行

- `web/package.json` の `e2e` script(§4.1)。
- `Makefile` に E2E ターゲット(例 `make e2e`: 必要なら backend/vite 起動 → `pnpm e2e`)。起動方式は §3.4.3 と整合。
- 開発者がローカルで実行して spec のパスを確認する(Claude は実機/ブラウザ実行を担保できない、§5.2)。

---

## 5. テスト要件

### 5.1 自己確認(製造担当)

- [ ] `pnpm e2e`(または `make e2e`)で spec が起動・実行できる(webServer が立ち上がり、spec がブラウザを操作できる)。
- [ ] 既存ユニットテスト(Go test / Vitest)が非破壊(testid 付与は属性追加のみ)。

### 5.2 開発者のローカル実行確認

- [ ] 開発者がローカルで `make e2e` を実行し、合意したスモーク spec が通過することを確認(Playwright のブラウザ実行・パス判定は開発者環境で行う)。結果を完了報告に記載。

---

## 6. レビュー観点

別チェックリスト `M8-02-review-checklist.md`(設計担当が本指示書とあわせて作成)。

---

## 7. 完了条件(Definition of Done)

- Playwright 基盤(導入・config・test-id 規約・ローカル実行)が成立し、合意したスモーク spec がローカルで通過する。
- testid 付与は最小限(role で取れる要素には付与していない)。
- 既存挙動・既存テストが非破壊。
- `docs/progress/progress-log.md` に M8-02 完了報告(導入内容・spec 一覧・§3.4 Plan Mode 確認結果・開発者ローカル実行結果)を追記。

---

## 8. 参照ドキュメント

| 文書 | 用途 |
|------|------|
| M8-RESEARCH-01 調査レポート | 現行フロー・testid 状況・環境の事実源 |
| DES-002 §12 v1.13.0 / SUPP §4.5 v1.23.0 | E2E 段階導入の方針(CHANGE-024) |
| `docs/progress/phase1` 統合 E2E 結果 / `docs/instructions/phase1` シナリオ | spec 変換の素地 |
| DES-005 | 対象フローの画面・操作要素 |

---

## 9. 注意事項

### 9.1 推測で進めてはいけない事項

- spec 化対象フロー・testid 付与対象・webServer 起動方式・seed 前提 → §3.4 で Plan Mode 確認。
- 視覚/レスポンシブ/LAN/実機/CI を自動化 → **スコープ外**(§1.3)。手を出さない。

### 9.2 推測で進めてよい事項

- spec 安定化に必要な最小限の追加 testid 付与(§2.4)→ 付与した要素を完了報告に列挙。

### 9.3 不明事項

- 既存 Makefile / package.json / ディレクトリ構成が想定と異なる場合、実態を Plan Mode で報告し実在構成に合わせる。

---

## 10. 完了後の次ステップ

- M8-02 完了で E2E ワークストリームの基盤が成立。以降 M9〜M12 の各機能追加・統合 E2E で spec を**漸進拡充**(新機能の機能フローを spec に追加)。視覚・LAN・実機は手動 E2E 継続。

---

*以上、M8-02 指示書 v1.0.0*
