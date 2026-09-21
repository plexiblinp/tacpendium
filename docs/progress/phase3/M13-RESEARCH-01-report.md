# M13-RESEARCH-01 調査報告: 先行 export/import 成果物の統合可否

| 項目 | 内容 |
|------|------|
| 文書ID | M13-RESEARCH-01-report |
| 対応指示書 | `docs/instructions/phase3/M13-RESEARCH-01-export-import-artifact-survey.md` v1.1.0 |
| 種別 | 調査報告(read-only。実装・変更・依存追加・ファイル移動を一切行っていない) |
| 調査日 | 2026-06-28 |
| 調査範囲 | 外部 3 プロジェクト(`combo-csv-import` / `combo-export-csv` / `combo-export-image`)+ combomgr 本体の契約(code-facts / DES / 実コード) |
| 調査方式 | 各プロジェクトの `INTAKE.md`/`CODE-FACTS.md` を起点に、実 `.go`/`.ts` ファイルと `go.mod`/`package.json` を view・grep で全数確認。combomgr 側は実 DTO/model/DDL/ルートと突合 |

> **judgement-free 厳守**: 本報告は「統合して安全」「この順で消すべき」等の決定を含まない。指示書 §5.4 が許可する範囲で、複数案がある箇所のみ「推奨(併記・決定なし)」を付す。read-only 逸脱ゼロ(実装・ビルド・テスト実行・ファイル移動なし。書き込みは本報告ファイルのみ)。

---

## 0. 結論サマリ(冒頭集約)

### 0.1 FR401〜405 カバレッジ写像(実コード根拠)

| FR | 内容 | 担当成果物 | 判定 | 主な穴 |
|----|------|-----------|------|--------|
| **FR401** CSV export | コンボ CSV(import と対称・別ファイル) | `combo-export-csv` `csvexport.ExportCSV` | **部分** | `local_id` 列なし・**セットプレイ CSV なし**(DES-005 §5.13 の別ファイル契約未充足) |
| **FR402** PDF | 単独コンボ＋**比較表**・紐づくセットプレイ同一ファイル | `combo-export-image` `toPdf` | **部分** | **比較表(複数コンボ並置)未対応**・セットプレイ非対応・ラスタ PDF(テキスト非選択) |
| **FR403** PNG | 単独コンボ＋**比較表**・紐づくセットプレイ同一ファイル | `combo-export-image` `toPng` | **部分** | **比較表未対応**・セットプレイ非対応・一覧はページ分割なし(縦長 1 枚) |
| **FR404** クリップボード(リッチテキスト/**HTML**) | Excel/スプレッドシート貼付 | (該当なし。`combo-export-csv` `tsvexport.ToClipboardTSV` が**プレーン TSV**を生成) | **未カバー(HTML)** | **リッチテキスト/HTML がどこにも無い**。TSV は生成するが文字列のみ・クリップボード書込自体も呼び出し側責務 |
| **FR405** CSV import | コンボ CSV(行選択・`local_id` 紐付け) | `combo-csv-import` `ParseAndValidate` | **部分** | プレビュー(検証)まで。**DB commit/行選択状態/重複動作(skip/上書き/新規)/セットプレイ import なし**・`local_id` 列なし |

### 0.2 横断的な重大事実(詳細は各節)

1. **CSV 契約は DES-005 §5.13/§5.14 と不一致**: 外部 CSV(21 列)に `local_id`・`parent_combo_local_id` が**無く**、セットプレイ用の別ファイルも**無い**。両 Go 成果物とも「コンボ本体のみ・1 コンボ 1 行・setups 対象外」と INTAKE に明記。
2. **`drive_damage` 型不一致(往復破壊リスク)**: 外部 CSV/DTO は `DriveDamage *int`、combomgr 本体 model は `DriveDamage *float64`(db REAL・小数許容 -6〜6)。小数のドライブ削り値が往復で欠落/失敗しうる。
3. **`starter_move_id` 列が外部 CSV に無い**: combomgr の `combos.starter_move_id` / `starterMoveCode` に相当する列が 21 列契約に存在しない。
4. **コード参照(code)ベース**: 外部は `character_code` / `move_code` で保持し、`character_id` / `move_id` 等の整数 ID を持たない。本体取込時に code→id 解決が必須(両 INTAKE が明記)。**スキーマ非依存(意味単位)であり followup-backlog F12-7 の方針に適合**(M14 の moves 列削除に対して頑健)。
5. **FR404(HTML クリップボード)はゼロ実装**: 3 プロジェクトのどこにも `clipboard`/`ClipboardItem`/`text/html`/`execCommand` が無い(grep 0 件)。新規実装が要る範囲。
6. **CSV インジェクション無害化は本体・外部とも未実装**: `combo-csv-import` は値を verbatim 保持(import=復元目的)、combomgr 本体(movesimport)にも式注入ガード(`= + - @` 接頭辞)無し。FR405 では描画/再 export 層での追加が要る。
7. **ライセンス前提に齟齬(事実指摘)**: 指示書 §3.2 は「本体は MIT(DES-001 §5)」とするが、**実 README は「ライセンス: 未定(リリース前に決定予定)」**。かつ DES-001 §5 のライセンス表は **Tauri/Rust/SQLx 等の旧スタック**を記載しており現行 Go/Echo スタックと一致しない。外部 3 成果物は**いずれも LICENSE ファイル・著作権ヘッダ無し**(標準ライブラリ/MIT・Apache-2.0 依存のみ)。
8. **取り込み単位の依存**: `combo-csv-import` は `combo-export-csv` の `contract`(21 列定義)・`combo`(DTO)パッケージを `replace` で参照。ソースコピー時は**両 Go プロジェクトを一体で**、または `contract`/`combo` を共有パッケージとして扱う必要がある。

### 0.3 統合方式の当たり(D-5・決定はしない)

| 成果物 | 言語/層 | 当たり(材料) |
|--------|---------|--------------|
| `combo-export-csv` | Go ライブラリ → `internal/service` | **契約準拠へ改修して統合**寄り(コアの往復ロジックは流用価値高。`local_id`/setups/`drive_damage` float/`starter` 列の契約差を埋める改修が要る) |
| `combo-csv-import` | Go ライブラリ → `internal/service` + `internal/api`(handler 新設) | **契約準拠へ改修して統合**寄り(検証層は厚い。commit/行選択/重複動作/code→id 解決/setups を本体側で付加。movesimport の preview→commit に乗せる) |
| `combo-export-image` | TS ブラウザライブラリ → `web/src/features` | **改修 or 参考**(PNG/PDF コアは流用可。比較表・セットプレイ同梱・本体デザイン適用が要る) |
| FR404 HTML クリップボード | (なし) | **新規実装**(成果物なし) |

詳細は §6「要決定事項」に番号付きで集約。

---

## A. 外部成果物のインベントリ

### A-0 / A-1: 各プロジェクト構成(実値)

| 項目 | combo-csv-import | combo-export-csv | combo-export-image |
|------|------------------|------------------|--------------------|
| 言語/スタック | Go(`go 1.24`) | Go(`go 1.24`) | TypeScript(ES2020 / DOM) |
| 形態 | ライブラリ + CLI デモ | ライブラリ + CLI デモ | **ブラウザ単独**ライブラリ + Vite デモ |
| 担当 FR | FR405(import) | FR401(CSV export)+ FR404 候補(TSV) | FR402(PDF)+ FR403(PNG) |
| 外部依存 | **なし**(stdlib のみ。`combo-export-csv` を `replace` 参照) | **なし**(stdlib のみ) | `html-to-image@1.11.13`(MIT)・`pdf-lib@1.17.1`(MIT) |
| dev 依存 | (なし) | (なし) | typescript5.6.3 / vite5.4.11 / vitest2.1.8 / happy-dom15.11.7 / @playwright/test1.56.1 |
| エントリ | `csvimport.ParseAndValidate(csvText, opts) (*Result, error)` / CLI `cmd/comboimport` | `csvexport.ExportCSV([]combo.Combo)(string,error)` / `ImportCSV(string)([]combo.Combo,error)` / `tsvexport.ToClipboardTSV([]combo.Combo)(string,error)` / CLI `cmd/comboexport` | `toPng(input,opts)Promise<Uint8Array>` / `toPdf(...)` / `renderCombo` / `renderComboList` / `capture` |
| LICENSE ファイル | **なし** | **なし** | **なし**(`package.json` license フィールドも明記なし) |
| 著作権ヘッダ | なし(doc コメントのみ) | なし | なし |
| 同梱資料 | `INTAKE.md`(93 行)。`CODE-FACTS.md` **なし** | `INTAKE.md`(約 9KB)。`CODE-FACTS.md` **なし** | `INTAKE.md` + `CODE-FACTS.md` **両方あり** |
| テスト | `csvimport_test.go` 30+ 関数 | `csvexport_test.go` 14 / `tsvexport_test.go` 3 | vitest 17(layout/list)+ Playwright 5(byte 検証) |

### A-2: 入出力(実コード確認)

- **combo-csv-import**: 入力 = UTF-8 CSV(ヘッダ行・RFC4180・BOM 許容)。出力 = `*Result{Combos[], RowResults[], Summary{Total/OK/Warning/Error}, FileError, FileWarnings}`。**DB 書込なし**(プレビュー相当まで)。
- **combo-export-csv**: 入力 = `[]combo.Combo` DTO。出力 = (a) 21 列 RFC4180 CSV 文字列(往復用)、(b) 12 列 TSV 文字列(表示専用・読み戻し不可)。**1 コンボ 1 行・単一文字列(別ファイル分割なし)**。
- **combo-export-image**: 入力 = `HTMLElement | ComboDTO | ComboDTO[]`。出力 = `Uint8Array`(PNG または PDF バイト列)。ブラウザ内生成・HTTP バックエンド不要。

> **想定外の発見(事実)**: `autopilot-combomgr/projects/` には対象 3 件以外に `moves-input-tool` / `pressure-sequence` / `punish-calculator` / `setplay-suggestion` / `solo-sns-knowledge-proto` が同居(指示書どおり**対象外**として未調査)。

---

## B. FR401〜405 カバレッジ写像

### B-1 / B-2: 写像と穴(§0.1 の根拠詳細)

- **FR401(CSV export)= `combo-export-csv` `ExportCSV`**: 21 列・1 コンボ 1 行・recipe/tags/situation はセル内 JSON 埋込・`*int` の有無で NULL 表現。**`ImportCSV` と reflect.DeepEqual 往復テスト済**。**穴**: `local_id` 列なし / セットプレイ CSV なし(別ファイル契約未充足)。
- **FR402(PDF)= `combo-export-image` `toPdf`**: `resolve → capture(html-to-image)→ pngToPdf(pdf-lib raster embed)`。**実装あり**。**穴**: ① 比較表(複数コンボ並置)未対応(INTAKE 明記「比較は対象外」)② 紐づくセットプレイ同梱なし ③ ラスタ PDF(テキスト非選択。ベクター化は TODO)④ 一覧は縦積み 1 枚・ページ分割なし(16384px で error throw)。
- **FR403(PNG)= `combo-export-image` `toPng`**: `resolve → capture → png(Uint8Array)`。**実装あり**。**穴**: FR402 と同じ(比較表/セットプレイ/ページ分割)。
- **FR404(クリップボード・リッチテキスト/HTML)**: **3 プロジェクトに HTML クリップボード実装なし**。`grep "clipboard|Clipboard|navigator.clipboard|execCommand|text/html|ClipboardItem"` = **0 件**。`combo-export-csv` の `tsvexport.ToClipboardTSV` は**タブ区切りプレーン文字列**を返すのみ(`ClipboardItem`/`text/html` ではない)で、クリップボード書込自体も「呼び出し側責務」と INTAKE 明記。
- **FR405(CSV import)= `combo-csv-import` `ParseAndValidate`**: 21 列ヘッダ名ベース(列順非依存)・行ごと `RowResult{Status, Combo, Issues}` 判定・`Summary` 集計。**穴**: ① DB commit なし ② モジュール内に「行選択(selected[])」状態なし(呼び出し側が `RowResults` から選別)③ 重複動作(skip/上書き/新規・DES-005 §5.14)なし ④ セットプレイ import なし ⑤ `local_id` 列なし。

### B-3: 出力対象要件との適合

| 要件 | 成果物実態 | 適合 |
|------|-----------|------|
| FR401 = import と対称な別ファイル | export は単一 CSV(setups 別ファイルなし)。import も単一ファイル前提 | 対称ではあるが**両者とも別ファイル契約(setups)未充足** |
| FR402/403 = 単独コンボ**＋比較表**両対応 | 単独コンボ + 縦積み一覧のみ。**比較表(並置)なし** | 単独=○ / 比較表=✗ |
| FR402/403 = 紐づくセットプレイ同一ファイル内 | セットプレイ非対応 | ✗ |
| FR404 = リッチテキスト/HTML | プレーン TSV のみ | ✗(HTML 未カバー) |

---

## C. CSV データ契約の適合(旧形式リスクの実査)

### C-1: 21 列スキーマ全列挙(実値・`contract/contract.go` `CSVColumns`)

両 Go プロジェクトが共有する**単一の 21 列契約**(import は export の `contract` を `replace` 参照):

| # | 列名 | 型(実装) | 備考 |
|---|------|----------|------|
| 1 | `character_code` | string(必須) | 空=VAL-I05 ERROR。`character_id` の代わり |
| 2 | `is_draft` | bool(`true`/`false`/空=false) | 厳格パース |
| 3 | `damage` | *int | 空=nil / "0"=0(厳格形のみ) |
| 4 | `drive_available_at_start` | *int | range[0,6] VAL-C04 ERROR |
| 5 | `sa_available_at_start` | *int | range[0,3] VAL-C05 ERROR |
| 6 | `drive_damage` | ***int** | **本体 model は *float64(後述 C-3)** |
| 7 | `position` | string enum | corner_self/corner_opponent/corner_opponent_near/mid_screen |
| 8 | `opponent_stance` | string enum | standing/crouching/airborne/any |
| 9 | `hit_type` | string enum | normal/counter/punish_counter |
| 10 | `opponent_size` | string enum | small/medium/large(**INTAKE で「推測」= OPEN-001**) |
| 11 | `situation` | json.RawMessage / nil | 空=nil・"null"=RawMessage・verbatim 往復 |
| 12〜17 | `oki_meaty_neutral_tech_throw` / `_dr` / `oki_meaty_back_tech_throw` / `_dr` / `oki_shimmy_neutral_tech` / `oki_shimmy_back_tech` | ***bool**(非 NULL) | **本体 model は *bool(nullable)**。nil/false 区別が往復で消失 |
| 18 | `knockdown_advantage` | *int | range[-600,600] VAL-C10 WARNING(draft 時スキップ) |
| 19 | `memo` | string | 自由文・特殊文字 verbatim 保持 |
| 20 | `tags` | JSON 配列 `[{name,category?,color?}]` | 空 name=VAL-T02 WARNING |
| 21 | `recipe` | JSON 配列 `[{move_code,modifiers}]` | 空=VAL-C09 WARNING(draft スキップ)。非技ステップは move_code 空 + `modifiers.type` |

**ゴールデン行(`csvexport_test.go` / `csvimport_test.go` 共通)**:
```
character_code,is_draft,damage,...,memo,tags,recipe
ryu,false,100,,,,,,,,,false,false,false,false,false,false,,,,"[{""move_code"":""5lp"",""modifiers"":{}}]"
```

### C-2: DES-005 §5.13/§5.14 契約との突合(全数)

| 契約事項(DES-005) | 21 列契約の実態 | 一致/乖離 |
|---------------------|----------------|----------|
| コンボ CSV に `local_id` | **列なし** | **乖離**(INTAKE が「setplay 連携スコープ外のため整合」と注記。DES-006 §6 の `local_id` 列とも差) |
| セットプレイ CSV に `parent_combo_local_id` | **セットプレイ CSV 自体なし** | **乖離** |
| コンボ/セットプレイを別ファイル | 単一コンボ CSV のみ | **乖離** |
| 行ごとチェックボックス選択(FR405) | モジュールは `RowResults` 返却まで・選択状態なし | 部分(選択は呼び出し側) |

> **旧形式リスク(開発者注記)の所見**: 列名は現行 DB カラム(snake_case)と概ね対応し、致命的な「旧形式」の証跡は見当たらない。ただし上記 `drive_damage` 型(C-3)・`starter_move_id` 欠落(C-3)・`oki_*` nullability の 3 点が現行データモデルとの実差。

### C-3: 現行コンボデータモデルとの往復(無損失性)机上評価

combomgr 本体(`internal/model` / migrations 000001+000016)との対応:

| 本体カラム/フィールド | 型(本体) | 外部 CSV | 往復評価 |
|----------------------|----------|----------|---------|
| `character_id` | int64 | `character_code`(string) | code→id 解決が必須(本体取込責務) |
| `drive_damage` | ***float64**(REAL・小数 -6〜6) | `drive_damage`(***int**) | **乖離: 小数欠落/パース失敗リスク**(C-11 で小数許容) |
| `starter_move_id` / `starterMoveCode` | *int64 / 派生 string | **列なし** | **乖離: 外部 CSV に starter 列が無い**(recipe 先頭からの導出要否は未確認) |
| `oki_*` 6 フラグ | *bool(nullable) | bool(非 NULL) | nil/false 区別が消失(INTAKE が推測として記録) |
| recipe(`combo_steps`: move_id/modifiers) | move_id(int64) | `move_code`(string)+ modifiers JSON | code→id 解決要。意味単位で頑健 |
| tags(`tags`+`combo_tags` join) | id/user_id/name/category/color | JSON `{name,category,color}` | name+user での解決/作成が本体責務 |
| id/version/created_at/updated_at/deleted_at/step_count/recipe_cache | DB 管理 | **意図的に除外** | 本体再生成前提(往復対象外・適合) |
| setups / setup_steps / combo_setups | — | **対象外** | セットプレイ往復なし(FR401 別ファイル契約と乖離) |

> 乖離列の集約: **外部 CSV にあるが型不一致** = `drive_damage`(int vs float)・`oki_*`(bool vs *bool)。**本体にあるが外部 CSV に無い** = `starter_move_id`・セットプレイ一式・`local_id`。

### C-4: スキーマ非依存性(followup-backlog F12-7)

- **判定: 意味単位(スキーマ非依存)**。export は code 値(`character_code`/`move_code`)+ recipe/tags の JSON 埋込で出力し、**物理 DB 列の直書きをしていない**(INTAKE §1/§4b 明記)。DB 管理列も除外。
- **含意**: M14 の moves 列削除に対し**頑健**(F12-7 の推奨方針=意味単位書き出しに適合)。物理列直書き由来の M14 順序依存リスクは**検出されず**。

---

## D. アーキテクチャ統合適合(combomgr 側)

### D-1: 連携方式(実コード判定)

- **combo-export-csv / combo-csv-import**: Go ライブラリ。INTAKE は `internal/service` への組込を想定。HTTP を持たない(CLI はデモのみ)。→ **本体 service 層に組み込み + api 層に handler 新設**が要る。
- **combo-export-image**: **フロント単独**(ブラウザ内生成)。INTAKE §5 が「載せ先は本体フロント(React/TS)。`internal/service`/`internal/model`(Go)ではない」と明記。HTTP バックエンド不要。

### D-2: API/エンドポイント形と DES-002 §4.2 予約の突合

- DES-002 §4.2 予約: `GET /api/export/csv`(FR401)・`POST /api/import/csv`(FR405)。**moves 取込 `/api/import/moves`(preview/commit)とは別系統**。
- 外部成果物は**いずれも HTTP を持たない**(Go=ライブラリ、image=FE)。→ CSV 系は予約エンドポイントの handler を本体新設して内部でライブラリ呼出。PDF/PNG は FE 生成のためエンドポイント不要(DES-002 が PDF/PNG エンドポイントを予約していないことと整合)。
- 本体現状: `grep` でコンボ export/import ルート **0 件**(存在は `/api/import/moves/preview`・`/api/import/moves` のみ)。フロントルートにも画面13/14 **なし**(既存は `/import/moves`=画面17・`/moves/edit`=画面18)。

### D-3: preview→行選択→commit 構造

- **movesimport 参照アーキ(実値)**: backend `Preview`(multipart `file`)→ `previewResponse{rows: previewRowDTO[]}`、`Commit`(multipart `file` + `selected` JSON)→ `commitResponse{results: rowResultDTO[], summary: {success,skipped,failed}}`。Service IF `ParsePreview(ctx,r)` / `Commit(ctx,r,selected)`。frontend `useImportMovesPreview`/`useImportMovesCommit`(`web/src/features/import/api.ts`、`postMultipart`、`onSuccess` で `queryKey:["moves"]` invalidate)。
- **combo-csv-import の適合**: 単発 `ParseAndValidate`(プレビュー相当)。**commit/selected[] を持たない**ため、movesimport の preview→commit パターンに**乗せられる**(プレビュー = ParseAndValidate、commit/選択/重複判定/code→id 解決/setups は本体側で付加)。
- **行数上限差**: movesimport は `MaxImportRows=5000`、combo-csv-import は `DefaultMaxRows=1000`(DES-006 VAL-I03 と一致)。コンボ import は 1000 が正(混同しない)。

### D-4: フロント組込点

- 画面13/14 は spec のみ(未実装)。新設ルート(`web/src/router.tsx`)+ queryKey 規約 + 共通ナビが要る。
- 再利用可能なフロント資産は `combo-export-image`(PNG/PDF)のみ。CSV import/export 用の React UI(ファイル選択・プレビュー・行選択)は**外部成果物に存在せず**、movesimport の `web/src/features/import` を範に本体で新規作成が要る。

### D-5: 仕分けの当たり(§0.3 と同じ・決定はしない)

材料は §0.3 表のとおり。決定は §6 要決定事項 + Plan Mode。

---

## E. セキュリティ・検証適合(FR405 import)

### E-1: CSV 無害化(DES-002 §7.4)

- **combo-csv-import**: 入力値を **verbatim 保持**(import=復元目的)。`=`/`+`/`-`/`@` 接頭辞セルのフィルタ/エスケープ**なし**。INTAKE §4d が「緩和は表示/再 export 側の責務」と明記。
- **combomgr 本体(movesimport)**: 式注入ガード **0 件**(`grep` 確認)。
- **含意**: FR405 では**描画時エスケープ/再 export 時の `'` 接頭辞付与等を本体側で追加実装が要る**(DES-002 §7.4 の「描画時エスケープ」充足のため)。

### E-2: NFR103 検証(DES-006 §6 VAL-I01〜I09)

| VAL | 内容 | combo-csv-import 実態 |
|-----|------|----------------------|
| I01 | ファイルサイズ上限(例 10MB) | **あり** `DefaultMaxBytes=10MiB` + 追加で per-cell `DefaultMaxCellBytes=1MiB`(TODO 暫定) |
| I02 | UTF-8 | **あり**(`TestInvalidUTF8`) |
| I03 | 行数上限 1000 | **あり** `DefaultMaxRows=1000` |
| I04 | 期待カラム構成 | **あり**(欠落列/重複ヘッダ ERROR) |
| I05 | 行単位型チェック | **あり**(int/bool 厳格パース・JSON unmarshal) |
| I06 | キャラコード存在 | **条件付き**(`CodeLookup` を注入した場合のみ ERROR。デフォルト未注入) |
| I07 | 技コード存在 | **条件付き**(Lookup 注入時のみ WARNING) |
| I08 | URL 自動フェッチ無効・非リンク化 | **部分**(モジュールは net アクセス 0 = SSRF 自然回避。ただし非描画モジュールのため「非リンク化」は表示層責務) |
| I09 | 結果サマリ表示 | **あり** `Result.Summary` |

> **欠落/要追加**: VAL-I06/I07 は本体が `CodeLookup` を実装・注入しないと発火しない。VAL-I08 の「非リンク化」は表示層(本体フロント)で担保が要る。

### E-3: 冪等性・ID 衝突・タグ解決

- **combo-csv-import に重複判定/冪等性/dedup なし**。INTAKE §4d が「VAL-C02 重複本判定・code→id 解決は本体 commit 時の責務」と明記。
- DES-005 §5.14 の重複動作(スキップ/上書き/新規追加)は**未実装**(本体 commit 層で要実装)。
- `local_id` 紐付け(コンボ↔セットプレイ)は列自体が無く**未対応**。

---

## F. ライセンス・由来・品質

### F-1: ライセンス(NFR403・ソースコピー前提)

- **外部 3 プロジェクト**: いずれも **LICENSE ファイル・著作権ヘッダ無し**。
  - Go 2 件: **stdlib のみ**(外部依存ゼロ)+ 相互 `replace` 参照。持ち込む第三者依存なし。
  - image: 実行時依存 `html-to-image@1.11.13`(MIT)・`pdf-lib@1.17.1`(MIT)。dev 依存も MIT/Apache-2.0。**combomgr 依存ポリシー(§6 許可ライセンス)に適合**。
- **持ち込み材料(決定はしない)**: ソースコピー時、(a) image の 2 ランタイム依存(html-to-image / pdf-lib)を `web/package.json` に追加(MIT・帰属表示は各ライブラリの NOTICE/LICENSE 準拠)、(b) Go 側は新規依存ゼロ、(c) コピー元コードに著作権ヘッダが無いため本体ライセンス下に吸収される想定。
- **事実指摘(齟齬)**: 指示書 §3.2 の「本体は MIT(DES-001 §5)」に対し、**実 README は「ライセンス: 未定(リリース前に決定予定)」**。さらに DES-001 §5 のライセンス表は **Tauri/Rust/SQLx 等の旧スタック**を列挙しており現行 Go/Echo スタックを反映していない。**本体ライセンスが MIT で未確定**だと「MIT へソースコピーで取り込み可能か」(F-1 の問い)は前提が確定していない。→ 要決定事項 #7。

### F-2: コード品質の当たり

- **テスト**: 3 件とも厚い。csv-import 30+・export 14+3・image 22(全 PASS と各 INTAKE/CODE-FACTS が主張。**本調査では実行していない**=未実行)。往復は reflect.DeepEqual / byte 一致 / Playwright byte 検証で担保。
- **TODO/未実装マーカー(grep 実値)**:
  - csv-import `rules.go`: `TODO(取込時確認)` 暫定 cell 1MB / `opponent_size` の具体値(DES-003「代表的な数段階」)未確定。`parse.go`: export/import で parser ヘルパ二重定義(共有パッケージ昇格が望ましい)。
  - export-csv: TODO/FIXME/panic **0 件**(INTAKE §6「完了済み」)。
  - image: `list.ts` ページ分割未対応 / `capture.ts` 16384px 上限 / `pdf.ts` ベクター PDF は差し替え前提 / `demo.ts` 配色フォントは簡易版。
- **規約乖離の当たり**: Go 側 JSON タグは snake_case(`json:"character_code"`)で、本体規約「JSON タグは camelCase」(CLAUDE.md §4)と**不一致**。ただし外部 CSV 列名(snake_case)を DTO json タグに流用したもので、本体 API DTO とは別レイヤ(CSV シリアライズ専用)。本体組込時に DTO 変換層を挟むか json タグ調整が要る(材料)。

---

## 6. M13-01/02 スコープ確定のための要決定事項

> いずれも本調査では**決定しない**。Plan Mode の入力材料。複数案は併記。

1. **CSV 別ファイル/`local_id` 契約の是正方針(FR401/405)**: 外部 21 列契約は `local_id`/`parent_combo_local_id`/セットプレイ CSV を持たない。
   - 案A: DES-005 §5.13/§5.14 契約に合わせ、`local_id` 列追加 + セットプレイ CSV(別ファイル)を新設して改修統合。
   - 案B: 当面コンボ単体 CSV のみ採用し、セットプレイ別ファイルは後続サブへ分離(DES 反映要否を別途判断)。

2. **`drive_damage` 型不一致の解消**: 外部 `*int` vs 本体 `*float64`(小数許容)。21 列契約の型を float へ改修するか、本体取込時の変換規則を定義するか。

3. **`starter_move_id` 列の扱い**: 外部 CSV に starter 列が無い。recipe 先頭からの導出で足りるか、専用列を追加するか(未確認: 本体 starter の決定ロジック)。

4. **`oki_*` nullability**: 外部 bool(非 NULL)vs 本体 *bool。NULL を表現する必要があるか(DES-003 の BOOLEAN NULL 可)を確定。

5. **FR405 commit 層の新規実装範囲**: 行選択(selected[])・重複動作(skip/上書き/新規・DES-005 §5.14)・code→id 解決・タグ name 解決/作成・冪等性/ID 衝突回避は外部成果物に無く本体で新規。movesimport の preview→commit に乗せるか独立構築するか。

6. **FR404(HTML クリップボード)の埋め方**: 成果物ゼロ。
   - 案A: `combo-export-image` の DOM レンダリングを再利用し `ClipboardItem({"text/html": ...})` で HTML 化を新規実装。
   - 案B: `tsvexport` のプレーン TSV をクリップボード文字列として暫定採用(リッチテキスト/HTML 要件は段階対応)。

7. **本体ライセンス確定(F-1 前提)**: README が「未定」、DES-001 §5 は旧スタック記載。ソースコピー取り込みの前に本体ライセンス(MIT 等)を確定する必要があるか。image の依存(html-to-image / pdf-lib・MIT)追加の可否も併せて確認。

8. **CSV 無害化/検証の追加範囲(FR405)**: 式注入ガード(`= + - @`)・描画時エスケープ・再 export 時の `'` 接頭辞・VAL-I06/I07 の `CodeLookup` 実装/注入・VAL-I08 非リンク化を、本体のどの層(service/handler/frontend 表示)で担保するか。

9. **FR402/403 の比較表・セットプレイ同梱**: image は単独コンボのみ(比較表・セットプレイ・ページ分割なし)。比較表(複数コンボ並置)とセットプレイ同梱、PDF のベクター化要否を確定。

10. **取り込み単位**: `combo-csv-import` は `combo-export-csv` の `contract`/`combo` を `replace` 参照。ソースコピー時に両 Go プロジェクトを一体で取り込むか、`contract`/`combo` を本体の共有パッケージへ集約するか。Go 側 json タグ snake_case と本体 camelCase 規約の整合(DTO 変換層 or タグ調整)も併せて確定。

---

## 付記: read-only 遵守の確認

- 使用ツールは view / grep / find / ls / cat(参照系)のみ。**実装・コード変更・依存追加(`go get`/`npm install`)・ファイル移動/コピー/改名・外部成果物のビルド/実行/テスト実行はゼロ**。
- 書き込みは本報告 `docs/progress/phase3/M13-RESEARCH-01-report.md` の新規作成のみ。
- 確認できなかった点は本文に「未確認」と明記(例: starter 導出ロジック、各成果物テストの実行結果=未実行)。

*以上、M13-RESEARCH-01 調査報告。本報告が M13-01(CSV import/export)・M13-02(PDF/PNG/クリップボード)実装指示書のスコープ確定入力となる。*
