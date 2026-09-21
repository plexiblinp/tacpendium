# M8-RESEARCH-01 調査レポート: E2E Playwright 前倒し導入の実現性(事実列挙)

| 項目 | 内容 |
|------|------|
| 対応指示書 | M8-RESEARCH-01 |
| 実施日 | 2026-06-10 |
| 実施モデル | Opus 4.8(指示書推奨 Sonnet 4.6。事実列挙のみ・創発的判断なしで実施) |
| 運用 | read-only 事実列挙(判断・提案・評価語を含めない) |

---

## 0. 結論サマリ(事実集約、最初に読む)

- **手動 E2E シナリオ総数: 177 単位**(指示書 §4.1 が定義する「シナリオ単位」= シナリオ A/B/C… や U-1… 等)。
  - 個別ファイル形式(ファイル名に `e2e` を含む)4 ファイルに **39 単位**。
  - 指示書本文インライン記載 22 ファイルに **138 単位**。
  - 上記とは別に、ファイル名に `e2e` を含む残り 2 ファイル(`M4-03-e2e-fix-request.md` / `M7-05-refactor-e2e-phase1-completion.md`)は **独自のシナリオ単位を列挙していない**(他ファイルのシナリオを参照する形)。
- **data-testid 付与: 製造コードに 1 箇所のみ**(`web/src/features/tag/components/TagFormDialog.tsx:103` = `data-testid="color-input"`)。`grep` 総ヒット 12 件のうち残り 11 件はすべて `*.test.tsx`(テストモック)内。`data-test` / `testId` / `data-cy` 等のバリアントは **0 件**。
- **その他の安定属性概数(web/src 全体)**: `aria-label` 23 件 / `role=` 23 件 / JSX リテラル `id="` 2 件。
- **自動化困難候補語の出現(語別総数、phase1 指示書全体)**: スマホ 400 / LAN 199 / レスポンシブ 161 / 実機 123 / レイアウト 101 / 崩れ 53 / QR 40 / スクリーンショット 19 / 見た目 11 / 目視 6 / 別端末 1。
- **Playwright 導入前提**: `web/package.json` に Playwright / @playwright/test は **未導入**(test = vitest 2.1.5)。CI 設定(`.github/workflows` 等)は **存在しない**。フロント dev サーバは vite(ポート **5173**、`web/vite.config.ts`)、バックエンド既定ポートは **47318**(`cmd/combomgr/main.go`)。

(数値はすべて §1〜§4 の事実から転記。評価語は記載しない)

---

## 1. 軸 A: 現行手動 E2E シナリオの棚卸し

### 1.1 個別ファイル形式(`ls docs/instructions/phase1/ | grep -i e2e` で検出した 6 ファイル)

| ファイル | 独自シナリオ単位数 | 内訳 | 対象機能 |
|---------|------------------|------|---------|
| `M4-03-e2e-fix-request.md` | 0(独自シナリオ列挙なし) | 不具合修正依頼。指摘 ①②④ の 3 件。修正後に M4-03 §5.2 シナリオ A〜I を再実行する旨を記載 | セットプレイ紐付け候補欄・topMessage・プレースホルダ表示 |
| `M4-05-integration-e2e-and-l01.md` | 9 | 個別 A〜E(5)+ ユースケース U-1〜U-4(4) | コンボ+セットプレイ同時登録 / FR011 転用 / knockdown_advantage モーダル / setup 単体編集 / PATCH 保存方式(C-1) |
| `M6-04-integration-e2e-and-residual-fix.md` | 11 | A〜G(7)+ U-1〜U-4(4) | ウィザード / 設定画面 / スマホホーム+フッター / ヘッダ遷移 / 起動リダイレクト / 下書き廃止確認 / M1〜M5 回帰 / LAN / config 再初期化 / DB パス / 言語切替 |
| `m7-02-e2e-scenarios.md` | 13 | A〜L(12)+ N(1)。別に `M` = UX 評価項目(機能シナリオ外) | shadcn/ui Form/Badge/Table/Modal 移行 / 分離パターン / C-2/3/4 / List API 拡張 / Dialog scroll / Q10 表示 / 回帰 |
| `m7-03-e2e-scenarios.md` | 6 | A〜F(6)。別に `G` = UX 評価項目(機能シナリオ外) | AddComboToCompareModal キャラフィルタ(R-3)/ 既存固定幅 3 件 / R-2 確認 / M7-01/02 温存 / 回帰 |
| `M7-05-refactor-e2e-phase1-completion.md` | 0(独自シナリオ列挙なし) | §5.1 で「M6-04 シナリオ G + U-1〜U-N 構造を踏襲」と参照のみ。独自の番号付きシナリオは未列挙 | M7 統合 E2E / スマホ LAN 実機検証 / フェーズ1完了判定 |

個別ファイルの独自シナリオ単位合計 = 9 + 11 + 13 + 6 = **39 単位**。

### 1.2 指示書本文インライン記載(各マイルストーン指示書の §5.2「E2E シナリオ」節等)

| ファイル | シナリオ単位数 | 形式・内訳 |
|---------|--------------|-----------|
| `M2-01-virtual-controller-and-modifiers.md` | 4 | A〜D |
| `M2-02-edit-ux-improvements.md` | 4 | A〜D |
| `M2-03-trash-page.md` | 6 | A〜F |
| `M2-04-notes-display-and-integration.md` | 6 | A〜F(F は M2 統合 E2E) |
| `M3-01-tag-feature-and-management.md` | 1 | 番号なし単一シナリオ(12 ステップ) |
| `M3-02-tag-assignment-ui.md` | 5 | A〜E |
| `M3-03-filter-sort-column-customize.md` | 6 | A〜F |
| `M3-04-mycombo-page-and-use-characters.md` | 12 | A〜L(H/I/J/K/L は v1.0.3/v1.0.4 で追加) |
| `M3-05-combo-list-polish-and-error-unification.md` | 9 | A〜I(M3 統合 E2E) |
| `M4-00-recipe-builder-console-warn.md` | 2 | A〜B |
| `M4-00b-modifiers-editor-console-warn.md` | 3 | A〜C |
| `M4-01-setup-backend-foundation.md` | 6 | A〜F(curl 検証) |
| `M4-02-setup-ui-and-link-operations.md` | 7 | A〜G |
| `M4-03-fr011-and-knockdown-modal.md` | 9 | A〜I |
| `M4-04-combo-setup-bundled-creation.md` | 8 | A〜H |
| `M5-01-compare-screen.md` | 7 | A〜G |
| `M6-01-config-api-foundation.md` | 7 | A〜G(curl 検証) |
| `M6-02-settings-and-wizard.md` | 10 | A〜J(H/I/J は v1.0.1/v1.0.2 で追加) |
| `M6-03-mobile-home-and-footer.md` | 6 | A〜F |
| `M7-01-shadcn-ui-dialog-popover-and-header_for_developer.md` | 8 | A〜H |
| `M7-04-1-change019-cleanup-and-bug5.md` | 6 | 番号付き 1〜6(本文内記載) |
| `M7-04-2-presets-characters-schema-durability.md` | 6 | 番号付き 1〜6(A/B/B-2/B-4/C/C/回帰のラベル付き) |

インライン記載シナリオ単位合計 = 4+4+6+6+1+5+6+12+9+2+3+6+7+9+8+7+7+10+6+8+6+6 = **138 単位**。

### 1.3 合計

- **総シナリオ単位数 = 39(個別ファイル)+ 138(インライン)= 177 単位**。

### 1.4 軸 A 補足: シナリオ列挙ではない `#### A.` 見出しの除外内訳(取りこぼし・誤計上防止)

以下のファイルにも `#### A.` / `#### シナリオ` 形式の見出しが存在するが、**§4(詳細仕様)の実装系統見出しであり E2E シナリオではない**ため、上記 1.1〜1.3 の計上から除外した:

- `M7-01-additional-tasks.md`(A/B = 実装タスク見出し)
- `M7-02-shadcn-ui-...-list-api-expansion.md`(A〜I = §4 実装系統。M7-02 の E2E は `m7-02-e2e-scenarios.md` 側)
- `M7-03-responsive-finalization.md`(A/B = §4 実装系統。E2E は `m7-03-e2e-scenarios.md` 側)

---

## 2. 軸 B: data-testid 付与状況

### 2.1 data-testid の全 12 ヒット(file:line:用途)

| # | 箇所 | 製造/テスト | 内容 |
|---|------|-----------|------|
| 1 | `web/src/features/tag/components/TagFormDialog.tsx:103` | **製造コード** | `data-testid="color-input"` |
| 2 | `web/src/App.test.tsx:15` | テスト | `app-router`(モック) |
| 3 | `web/src/App.test.tsx:23` | テスト | `footer`(モック) |
| 4 | `web/src/App.test.tsx:37` | テスト | `location`(モック) |
| 5 | `web/src/pages/WizardPage.test.tsx:43` | テスト | `char-select`(モック) |
| 6 | `web/src/pages/ComboDetailPage.test.tsx:44` | テスト | `candidate-list`(モック) |
| 7 | `web/src/features/combo/components/AddComboToCompareModal.test.tsx:25` | テスト | `mock-character-selector` |
| 8 | `web/src/features/combo/components/ComboEditor.test.tsx:42` | テスト | `recipe-builder`(モック) |
| 9 | `web/src/features/combo/components/ComboEditor.test.tsx:46` | テスト | `basic-fields`(モック) |
| 10 | `web/src/features/combo/components/ComboEditor.test.tsx:74` | テスト | `setup-recipe-editor`(モック) |
| 11 | `web/src/features/combo/components/SetupInputRow.test.tsx:9` | テスト | `setup-recipe-editor`(モック) |
| 12 | `web/src/features/combo/components/SetupRegistrationSection.test.tsx:8` | テスト | `setup-recipe-editor`(モック) |

- **製造コード(`.tsx` かつ非テスト)の data-testid = 1 件**(TagFormDialog の color-input)。
- **`.test.tsx` 内の data-testid = 11 件**(すべて Vitest/RTL のモック識別子)。

### 2.2 data-testid バリアント

- `data-test`(末尾 testid 以外)/ `data-test-id` / `testId` / `data-cy` の製造・テスト含む総ヒット = **0 件**。

### 2.3 その他の安定属性の概数(web/src 全体)

| 属性 | 総ヒット数 | feature/ディレクトリ別(付与ファイル数) |
|------|----------|--------------------------------------|
| `aria-label` | 23 | combo 9 / config 2 / tag 1 / setup 1 / components(Header 1, Footer 1, Footer.test 1) |
| `role=` | 23 | (ディレクトリ別集計は未分解、総数のみ) |
| JSX リテラル `id="…"` | 2 | (総数のみ) |

### 2.4 軸 A シナリオ操作要素と安定セレクタの突合(事実)

- 軸 A の各シナリオが操作対象として言及する UI 要素(例: m7-02 シナリオ D-1「展開アイコン ▶/▼」「チェックボックス列」、E-1「新規タグボタン」「タグ名入力」、m7-03 B-1「キャラクターセレクタ」、M6-02「保存ボタン」「6 セクション」等)に対し、専用の安定セレクタ(`data-testid`)が付与されているのは §2.1 のとおり製造コード上 **1 箇所(TagFormDialog の color-input)のみ**。
- それ以外のシナリオ操作要素は、`data-testid` を持たず、§2.3 の `aria-label`(23 件)/ `role=`(23 件)/ リテラル `id`(2 件)、または shadcn/ui(Radix)由来の暗黙的 `role` 属性に依存する状態である(要素単位での網羅突合は、対象が 177 シナリオ・操作要素多数に及ぶため、本レポートでは付与総数と製造コード data-testid の所在を事実として提示するに留める)。

---

## 3. 軸 C: シナリオ → spec 変換の素材

> 注: 以下の語別・ファイル別件数は **各ファイル全体の grep ヒット**であり、シナリオ手順行に限定したものではない(背景・設計判断節の出現も含む)。シナリオ手順に限定した精密計数は対象 177 シナリオに及ぶため、ファイル単位の事実として提示する。

### 3.1 自動化困難候補語の出現(指示書 §4.3 指定語)

語別総出現数(phase1 指示書全体):

| 語 | 出現数 | 語 | 出現数 |
|----|-------|----|-------|
| スマホ | 400 | 崩れ | 53 |
| LAN | 199 | QR | 40 |
| レスポンシブ | 161 | スクリーンショット | 19 |
| 実機 | 123 | 見た目 | 11 |
| レイアウト | 101 | 目視 | 6 |
| | | 別端末 | 1 |

シナリオを含む主要ファイル別の該当語ヒット数(上位、`:0` 除外):

| ファイル | ヒット | ファイル | ヒット |
|---------|-------|---------|-------|
| M6-02-settings-and-wizard | 84 | m7-02-e2e-scenarios | 16 |
| M6-03-mobile-home-and-footer | 81 | M5-01-compare-screen | 15 |
| M6-04-integration-e2e-and-residual-fix | 32 | M3-04-mycombo-page | 13 |
| M7-03-responsive-finalization | 27 | M4-05-integration-e2e-and-l01 | 12 |
| m7-03-e2e-scenarios | 20 | M6-01-config-api-foundation | 10 |
| M7-05-refactor-e2e-phase1-completion | 16 | M7-01-…-for_developer | 10 |

(M7-overview=100, M6-overview=65 等の overview / RESEARCH ファイルもヒットするが、これらはシナリオ本体ではない)

### 3.2 各シナリオ実施時に明示される自動化困難手順(読み取り時に確認した具体例)

- `m7-02-e2e-scenarios.md`: ヘッダ「実施対象 = PC + スマホサイズ両方(DevTools レスポンシブモード iPhone 12 Pro/SE)」。シナリオ M(UX 評価項目、画面ショット提示推奨)、シナリオ J(Dialog scroll の視覚確認)、K-1(ハンバーガーメニュー・スマホ)。
- `m7-03-e2e-scenarios.md`: シナリオ B-5(内部スクロール・はみ出しの視覚確認)、シナリオ C(スマホ 390/375px の横スクロール・レイアウト崩れ)、シナリオ G(UX 評価)。レスポンシブ・視覚比較が中心。
- `M6-04-integration-e2e-and-residual-fix.md`: シナリオ C(スマホ実機サイズ)、U-1(LAN モード・別端末スマホ/PC からのアクセス・QR コード表示)、UX 評価。
- `M4-05-integration-e2e-and-l01.md`: 多くが機能・DB 検証(curl で `/api/combos/{id}` 確認、`combo_setups` テーブル確認)。視覚依存手順は比較的少ない。
- `M6-01` / `M4-01`: §5.2 が「curl 検証(開発者の責任範囲)」と明記された API レベルのシナリオ。

### 3.3 シナリオのステップ数(個別ファイルのサブシナリオ/手順数、読み取り時に確認した実数)

| ファイル | トップレベル単位 | サブシナリオ/番号付き手順の構成 |
|---------|----------------|-------------------------------|
| m7-02-e2e-scenarios | 13(+UX 1) | サブシナリオ計 44(A:2 / B:3 / C:2 / D:4 / E:3 / F:4 / G:3 / H:4 / I:3 / J:2 / K:3 / L:7 / N:4)+ M(UX 項目 約9) |
| m7-03-e2e-scenarios | 6(+UX 1) | サブシナリオ計 23(A:3 / B:5 / C:3 / D:3 / E:2 / F:7)+ G(UX 項目 約6) |
| M4-05 | 9 | A〜E 各 6〜7 番号付き手順、U-1〜U-4 各 6〜8 番号付き手順 |
| M6-04 | 11 | A〜G・U-1〜U-4 各 4〜9 番号付き手順 |

(インライン記載各ファイルの手順数は各 §5.2 節に番号付き/チェックボックスで記載されており、ファイル単位で計数可能)

### 3.4 データ前提・seed 依存(指示書 §4.3 指定観点)

- 前提データに言及する語(`seed`/`投入`/`登録済み`/`紐付き済み`/`作成済み`/`件ある状態`/`10〜20 件` 等)のファイル別ヒット上位: `M1-02-migrations-and-seed`(41)/ `M7-04-2-presets-characters-schema-durability`(36)/ `M3-01`(21)/ `M3-04`(16)/ `M4-04`(14)/ `M2-01`(12)。
- 読み取り時に確認した具体的データ前提の例:
  - `m7-02` §0「テストデータの準備」: 既存セットプレイ紐付き済み/なしコンボ複数件、ゲージ開始残量設定済み/未設定コンボ、システムタグ+ユーザータグ両方登録済み、多数候補セットプレイを持つキャラ。
  - `m7-03` §0: 複数キャラ(Ryu/Ken/Luke/Jamie 他)のコンボ登録済み、比較対象が空状態、シミー DR 有/無データ両方。ただし本文注記で「現状リュウのみ登録 = キャラ切替シナリオ B-2/B-4 はテスト不能」。
  - `M4-05` U-2: setup α の `parentComboIds` が `[X.id, Y.id]` である状態。
  - `M6-04` U-1: `config.toml` の `[server].mode = "lan"`、同一 LAN 内の別端末。
  - `M7-04-2`: 各キャラ 10〜20 件投入状態、AKI(毒)/ジェイミー(飲酒レベル)の custom_states データ。

---

## 4. 軸 D: Playwright 導入の前提環境

### 4.1 web/package.json の現状

- `devDependencies`: `@testing-library/react` 16 / `@testing-library/user-event` 14 / `@types/node` / `@types/react`(+dom)/ `@vitejs/plugin-react` 4 / `autoprefixer` / `jsdom` 25 / `postcss` / `tailwindcss` 3 / `typescript` 5.6 / `vite` 5.4 / `vitest` 2.1.5。
- **Playwright / @playwright/test は dependencies・devDependencies いずれにも未記載**。
- `scripts`: `dev: vite` / `build: tsc -b && vite build` / `preview: vite preview` / `test: vitest` / `lint: tsc --noEmit`。
- **`e2e` / `playwright` という名前の script は存在しない**。
- `packageManager: pnpm@9.13.0`。

### 4.2 CI 設定の有無

- `.github/workflows/` ディレクトリは **存在しない**(`.github` ディレクトリ自体なし)。
- `.gitlab-ci.yml` / `Jenkinsfile` も **検出されず**。
- `find` で出た唯一の `*/workflows/ci.yml` は `web/node_modules/.pnpm/reusify@.../` 配下(依存パッケージ同梱物)であり、本リポジトリの CI 設定ではない。
- **本リポジトリに CI 設定ファイルは存在しない**。

### 4.3 フロントエンドのローカル起動手段とポート

- `web/vite.config.ts`: `server.host = true` / `server.port = 5173` / `server.proxy` でバックエンドへ転送。
- proxy 転送先の解決: `VITE_API_PORT` 環境変数 > `config.toml` の `[server].port` > 既定 `47318`(`DEFAULT_API_PORT`)。
- 起動 script = `pnpm dev`(= vite)。Makefile に `run-web` ターゲットあり。

### 4.4 バックエンドのローカル起動手段とポート

- `cmd/combomgr/main.go`: `netutil.ListenAvailable(host, cfg.Server.Port, ...)` でポート確保(L-04 ポート競合フォールバック実装済み)。`determineBindAddr(mode, port)` で bind アドレス決定。
- 既定ポート **47318**(`cmd/combomgr/main_test.go:15` が `http://localhost:47318/` を期待)。
- Makefile に `run-server` / `run-server-debug` ターゲットあり。

### 4.5 既存のテスト実行手段

- フロント: `pnpm test`(= vitest 2.1.5、jsdom + @testing-library)。Makefile `test-web`。
- バックエンド: `go test ./...`。Makefile `test-go`。
- Makefile 統合: `test: test-go test-web`。その他 `build` / `build-windows` / `build-darwin` / `build-linux` / `build-all` / `build-debug` / `test-go-debug` / `tidy`。

---

## 5. 特記事項(想定外の発見・矛盾。判断を加えず事実として記録)

1. **実行済み E2E シナリオの記録は `docs/instructions/phase1` ではなく `docs/progress` 配下に存在する**。指示書 §4.1 はシナリオ所在を `docs/instructions/phase1` と想定しているが、開発者が実機実行した結果記録は以下にある:
   - `docs/progress/phase1/m6-integration-e2e-results.md`(309 行、シナリオ A〜G + U-1〜U-4 を「シナリオ一覧」として保持)。
   - `docs/progress/phase1/m7-integration-e2e-results.md`(221 行、「シナリオ一覧」+ U-1 スマホ LAN 実機検証)。
   - `docs/progress/m7-phase1-completion-judgment.md`(121 行、フェーズ1完了判定)。
   - これらは軸 A の「シナリオを含むファイル」だが、指示書スコープ(`docs/instructions/phase1`)外のため §1 の 177 単位には計上していない。

2. **シナリオの重複・再実行が複数ファイルに存在する**。「既存機能の回帰確認(M1〜M5/M6)」系シナリオは各統合 E2E ファイル(M3-05・M4-05・M6-04・m7-02 L 系・m7-03 F 系)に繰り返し出現する。M4-05 の U-4 は「M3-05 統合 E2E の再実行」を明記。§1 の 177 単位はファイルごとの列挙単位を機械的に数えた値であり、内容重複を排除した一意シナリオ数ではない。

3. **ポート番号の記述揺れ(陳腐化)**。一部の古い E2E シナリオファイルはフロント `http://localhost:3000`(`m7-02` §0、`m7-03` §0)、バックエンド `http://localhost:8080`(`m7-02` §0)と記載しているが、現状の実コードは vite ポート **5173**(`vite.config.ts`)・バックエンド既定 **47318**(`main.go`)。M6 系以降のファイルは `47318` を使用しており、ファイル間でポート表記が一致していない。

4. **`M4-03` が 2 ファイルに分かれている**。`M4-03-e2e-fix-request.md`(不具合修正依頼、独自シナリオ列挙なし、M4-03 §5.2 A〜I 再実行を参照)と `M4-03-fr011-and-knockdown-modal.md`(製造指示書、§5.2 に A〜I の 9 シナリオを保持)。シナリオ実体は後者にある。

5. **`reviews/` サブディレクトリと RESEARCH ファイルの所在**。`docs/instructions/phase1/reviews/` にレビューチェックリスト(`M3-01`/`M4-00`/`M7-03`/`M7-04-2`/`M7-05` 等)が存在するが、これらは機械レビュー用チェックリストであり E2E シナリオ列挙ではないため §1 計上外。`docs/instructions/phase1/` 内に `M6-RESEARCH-01` / `M7-RESEARCH-01〜03` の過去調査レポートも同居している。

6. **`M7-04-2` のシナリオ番号にラベル併記**。`M7-04-2` §5.2 は番号付き 1〜6 だが各項目に「A:」「B:」「B-2/B-4」「C:」のラベルが併記されており、B-2/B-4 は M7-03 のテスト不能項目(キャラ切替)の持ち越し再確認である旨が明記されている。

7. **`data-testid` の用途偏在**。製造コード唯一の `data-testid`(TagFormDialog の `color-input`)は、shadcn/ui Form 内のカラー入力という限定箇所。テストモック側 11 件はコンポーネント差し替え用の識別子であり、実 DOM の安定セレクタとしては機能しない。

8. **scope 外パスの否定確認結果**。`docs/instructions/` 直下のフェーズ2 系ファイル(`phase2-overview.md` / `phase2-tool-delegation-brief-fr701-importer.md`)には E2E シナリオ列挙は **検出されなかった**(`E2E シナリオ` / `統合 E2E` / `シナリオ A:` パターンでヒットなし)。`docs/instructions/` 直下で `e2e` を含むのは本指示書 `M8-RESEARCH-01-*.md` のみ。

---

## 6. 調査担当からの完了宣言

本レポートは M8-RESEARCH-01 §0.2 read-only 厳守 + §0.3 判断・提案を含めない運用に従って事実列挙を完了した。書き込みは本レポートファイル 1 件のみで、コード・設計書・既存テスト・指示書本体・依存・git・マイグレーションには一切変更を加えていない。
