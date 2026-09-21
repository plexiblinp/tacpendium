# 指示書 M13-RESEARCH-01: 先行 export/import 成果物の統合可否調査

| 項目 | 内容 |
|------|------|
| 文書ID | M13-RESEARCH-01 |
| バージョン | 1.1.0 |
| 種別 | 調査指示書(read-only。実装・コード変更・依存追加・ファイル移動を一切行わない) |
| 対象 | 製造担当 Claude Code |
| モデル | Sonnet 4.6(read-only 調査。M12-RESEARCH 系と同方針。実使用は開発者判断) |
| レビュー | 不要(read-only。実装物が無いため機械レビュー対象なし) |
| 作成者・作成日 | 設計担当 Claude(フェーズ3 キックオフ担当)/ 2026-06-28 |
| 前提 | フェーズ3 着手。phase3-overview v0.3.0 §M13。M13 = データ共有・データ保護(C-1 先頭)。本サブは M13-01/02(CSV import/export・PDF/PNG/クリップボード)の実装方針確定の入力 |
| 主参照 | code-facts §3(フロントルート)・§4(Go ルート↔ハンドラ)・§2(フック/queryKey)・§7(Response/入力 DTO)・§9(repository)、DES-002 §4.2(エンドポイント)・§7.4/§7.5(CSV 無害化・検証責務)、DES-005 §5.13/§5.14(画面13/14)、DES-006(NFR103 CSV 検証)、REQ-001 §7 FR401〜405、phase3-overview §M13、followup-backlog §D |

## 更新履歴

| 版 | 更新日 | 更新内容 |
|----|--------|----------|
| 1.0.0 | 2026-06-28 | 初版。フェーズ3 M13 着手前、先行 export/import 成果物の統合可否調査。 |
| 1.1.0 | 2026-06-28 | 開発者回答反映: 対象プロジェクト名を訂正(`combo-export`→`combo-export-csv` / `combo-export-pdf`→`combo-export-image`)・探索範囲を 3 プロジェクトに限定(他は対象外)・各フォルダの `INTAKE.md`/`CODE-FACTS.md` を必読/調査起点に追加・取り込み方式=ソースコピー想定を反映。 |

---

## 1. 背景と目的

### 1.1 背景

フェーズ3 の先頭(C-1)は **データ共有・データ保護(M13)**。REQ-001 §7 FR401〜405(CSV import/export・PDF/PNG・クリップボード)を実装する。これに先立ち、開発者が**別の自律製造 Claude に先行作成させた成果物**が存在し、`autopilot-combomgr`(別リポジトリ。開発環境では combomgr 配下に展開)の 3 プロジェクトに格納されている。

- `combomgr/autopilot-combomgr/projects/combo-csv-import`
- `combomgr/autopilot-combomgr/projects/combo-export-csv`
- `combomgr/autopilot-combomgr/projects/combo-export-image`

> 探索範囲は**この 3 プロジェクトに限定**する。`autopilot-combomgr` には今回と無関係の将来向け機能も同居するため、上記以外は**見ない**(開発者確定 2026-06-28)。各プロジェクトフォルダには **`INTAKE.md`(取込担当者向けドキュメント)** と **`CODE-FACTS.md`(本体側コードマップ相当)** が配置されている。これらは**必読・調査の起点**とし、各成果物の構造把握の最初に読む(§3.1/§4-A)。

本サブは「ゼロから作るか」ではなく、**既存の設計契約に対しこれら成果物がどれだけ適合し、どこに穴があるか**を評価する。設計契約は既に存在する(本体側は未実装):

- **DES-002 §4.2**: `GET /api/export/csv`(FR401・フェーズ3)・`POST /api/import/csv`(FR405・フェーズ3。**moves 取込 `/api/import/moves` とは別系統**)を予約済み。
- **DES-005 §5.13(画面13 エクスポート)/§5.14(画面14 インポート)**: コンボ CSV は `local_id`、セットプレイ CSV は `parent_combo_local_id` で別ファイル紐付け。PDF/PNG/クリップボードはコンボ＋紐づくセットプレイを同一ファイル内。インポートは行ごとチェックボックス選択。
- **参照アーキ**: 既存 `movesimport`(FR704)の preview→行選択→commit と `web/src/features/import/api.ts`(`useImportMovesPreview`/`useImportMovesCommit`)が、コンボ import の構造範(ただし**別系統・別画面・別エンドポイント**)。

開発者注記: 本体側の CSV 形式等は先行製造 Claude に伝達済みだが、**旧形式の元で作成されている可能性**がある(手入力ツール `moves-input-tool` と同様の懸念。なお moves-input-tool の調査は M14-RESEARCH-01 の担当で、本サブ対象外)。

### 1.2 目的

下記 §4 の A〜F を**実コード・実ファイルの view・grep で確認**し、§5 の様式で報告する。報告は M13-01(CSV import/export)・M13-02(PDF/PNG/クリップボード)の実装方針(既存成果物を統合 / 契約準拠で改修 / 新規実装、および統合方式)と、開発者の Plan Mode 判断の入力になる。

### 1.3 この調査でやらないこと(read-only 厳守)

- 実装・コード変更・依存追加(`go get`/`npm install` 等)・ファイルの移動/コピー/改名を**一切行わない**。
- 統合方式の最終決定をしない(材料の提示のみ。決定は Plan Mode で開発者)。
- 設計書本体(DES)を変更しない(本サブは CHANGE 起票対象外。DES 反映は M13-01/02 側で要否判断)。
- 外部成果物のビルド・実行・テスト実行はしない(コードの静的 view・grep のみ。動作確認は M13-01 以降の実装サブで扱う)。

---

## 2. 成果物

### 2.1 作成するファイル
- `docs/progress/phase3/M13-RESEARCH-01-report.md`(調査報告。§5 の様式)。

### 2.2 変更しないもの
- combomgr 全ソース・DES 本体・テスト、および `autopilot-combomgr` 配下の全ファイル(read-only)。

---

## 3. 前提条件

### 3.1 必読ドキュメント
- **各対象プロジェクト同梱の `INTAKE.md`(取込担当者向け)・`CODE-FACTS.md`(本体側コードマップ相当)**: 3 プロジェクト各フォルダ直下。**調査の起点として最初に読む**(自律製造側が用意した取込手順・コードマップ。§4 各項目はこれを踏まえて実コードと突合する)。
- **code-facts §3**(フロントルート)・**§4**(Go ルート↔ハンドラ。コンボ export/import 系の有無)・**§2**(フック/queryKey)・**§7**(Response/入力 DTO)・**§9**(repository)。
- **DES-002 §4.2**(エンドポイント。`/api/export/csv`・`/api/import/csv` 予約)・**§7.4/§7.5**(CSV 無害化・検証責務分担)。
- **DES-005 §5.13/§5.14**(画面13 エクスポート・画面14 インポートの項目・CSV 別ファイル契約・行選択)。
- **DES-006**(NFR103 CSV インポート検証 = スキーマ検証・行単位型チェック・サイズ上限・外部 URL 参照無効化)。
- **REQ-001 §7 FR401〜405**(各形式の出力対象・セットプレイの扱い・対称性)。
- **phase3-overview §M13** / **followup-backlog §D**。

### 3.2 前提事実(設計担当が code-facts / DES から確認済み = 調査の出発点)

調査担当はこれを起点に、外部 3 プロジェクトの**中身**を実査する。

- **combomgr 本体にコンボ export/import は未実装**: code-facts §4 の Go ルートに `/api/export/csv`・`/api/import/csv` は**無い**(存在するのは moves 取込 `POST /api/import/moves/preview`・`POST /api/import/moves` = `movesimport` ドメイン = FR704。これは別系統で M14 降格対象)。code-facts §3 のフロントルートにもコンボ export/import 画面は**無い**(`/import/moves`=画面17・`/moves/edit`=画面18 のみ。DES-005 §5.13/§5.14 の画面13/14 は spec のみで未実装)。
- **契約は予約済み**: DES-002 §4.2 が `GET /api/export/csv`(FR401)・`POST /api/import/csv`(FR405)をフェーズ3 用に明記。DES-005 §5.13/§5.14 が UI 仕様を規定済み。
- **参照パターン**: `movesimport` の preview→commit、`web/src/features/import/api.ts`、DTO `previewResponse{rows}`/`commitResponse{results,summary}`、行選択は `selected[{...}]` JSON。コンボ import もこの構造を範にできるが**別ドメイン・別エンドポイント・別画面**。
- **CSV 契約(コンボ)**: DES-005 §5.13 = コンボ CSV に `local_id`、セットプレイ CSV に `parent_combo_local_id`。FR405 = ローカル一時 ID 紐付け・行チェックボックス選択。FR401 = import と対称な別ファイル形式。**注意: DES-002 §7.5 の CSV 契約は FR704 moves 取込の契約であり、コンボ CSV(FR401/405)とは別物**(混同しない)。
- **検証/無害化**: コンボ CSV インポート(FR405)は NFR103 の文脈(DES-002 §7.4 注記)= スキーマ検証・行単位型チェック・サイズ上限(DES-001 のコンボ CSV 一括 1000 行)・外部 URL 参照無効化・セル値の式/コマンド無害化(描画時エスケープ)。
- 本体プロジェクトライセンスは MIT(DES-001 §5)。外部成果物の取り込みはライセンス整合の確認が要る。

---

## 4. 調査項目

各項目で **外部 3 プロジェクトの実ファイルを view し、grep で全数を取る**。言語・依存・エンドポイント・CSV 列・関数名は**実値**で報告する(要約・推測で埋めない)。確認不能は「未確認」と明記。

### A. 外部成果物のインベントリ(各プロジェクト)

- **A-0**: 各プロジェクト直下の **`INTAKE.md`・`CODE-FACTS.md` を最初に読み**、自律製造側が記した取込手順・コードマップ・前提を要約して報告。以降の A〜F はこの記述を**実コードと突合**して検証する(ドキュメントの主張を鵜呑みにせず実コードで裏取り)。
- **A-1**: 3 プロジェクト各々の **構成を実査**。(a) 言語/スタック(Go か TS/JS か・フロント/バック/CLI のどれか・スタンドアロンか combomgr 組込前提か)、(b) エントリポイント・主要ファイル、(c) 依存(`go.mod`/`package.json` の依存と版)、(d) ライセンス表記(LICENSE/ヘッダ。combomgr MIT との整合)、(e) テストの有無・カバレッジの当たり、(f) `INTAKE.md`/`CODE-FACTS.md`/README 等の同梱資料。
- **A-2**: 各プロジェクトが **何を入出力するか**(入力: コンボ/セットプレイのどのデータ・どの形式 / 出力: CSV/PDF/PNG/クリップボード/HTML のどれか)を実コードで確認。

### B. FR401〜405 カバレッジ写像

- **B-1**: 3 成果物を **FR401(CSV export)/ FR402(PDF)/ FR403(PNG)/ FR404(クリップボード)/ FR405(CSV import)** に写像。各 FR が「カバーされる/部分的/未カバー」を実コード根拠つきで判定。
- **B-2**: **未カバーの穴を明示**。プロジェクトは csv-import / export-csv / export-image の 3 つで、`combo-export-image` は名称から **FR403(PNG)** を担う見込みだが、**FR402(PDF)** を含むか・**FR404(クリップボード リッチテキスト/HTML)** がどこにも無いか、を実査して確定する(PDF 専用プロジェクトは対象外リストに無いため、PDF が image 側に含まれるか・未カバーかは要確認)。穴(特に FR404 クリップボード、場合により FR402 PDF)があれば「新規実装が要る範囲」として明示報告。
- **B-3**: 各 FR の **出力対象要件**との適合(FR402/403 = 単独コンボ＋比較表の両対応・紐づくセットプレイ同一ファイル内 / FR404 = Excel/スプレッドシート貼付向けリッチテキスト/HTML / FR401 = import と対称な別ファイル)を、成果物の実出力仕様と突合。

### C. CSV データ契約の適合(旧形式リスクの実査)

- **C-1**: `combo-csv-import` / `combo-export-csv` の **CSV 列スキーマを全列挙**(ヘッダ・列名・型・並び)。
- **C-2**: DES-005 §5.13/§5.14 契約(**コンボ CSV に `local_id`・セットプレイ CSV に `parent_combo_local_id`・別ファイル**)と突合。一致/乖離を**全数**報告。**旧形式の可能性**(開発者注記)に注意し、現行コンボデータモデル(combos/setups/combo_steps/tags・後述 C-3)と列が対応するかを確認。
- **C-3**: combomgr 側の**現行コンボ関連データ構造**を code-facts §7(Response DTO: combo/setup/recipe)・§8(model)・§9(repository)・§10(combos/setups/combo_steps/tags の DDL)で確認し、外部 CSV 列がこのモデルへ無損失に往復(export→import で再現)できるかを机上評価。乖離列(外部にあるが本体に無い/本体にあるが外部 CSV に無い)を列挙。
- **C-4**: **export がスキーマ非依存(意味単位 = 始動技/レシピ/タグ等)か、物理列直書きか**を判定(followup-backlog §F12-7。M14 で moves 列削除が入るため、物理列直書きだと M14 で壊れる。意味単位なら頑健)。物理列依存があれば M14 との順序・影響を含意に記す。

### D. アーキテクチャ統合適合(combomgr 側)

- **D-1**: 外部成果物が想定する **連携方式**を実コードで判定。(a) combomgr の Go ハンドラ/サービス/リポジトリ層に組み込む前提か、(b) 別プロセス/CLI か、(c) フロント単独(ブラウザ内生成: PDF/PNG/クリップボードは FE 生成があり得る)か。
- **D-2**: 外部が使う **API/エンドポイント形**を、DES-002 §4.2 予約(`GET /api/export/csv`・`POST /api/import/csv`)と突合。一致するか・別パスか・そもそも HTTP を持たないか。
- **D-3**: import の **preview→行選択→commit** 構造(FR405・DES-005 §5.14)を外部 `combo-csv-import` が持つか。既存 `movesimport`(preview/commit・`selected[]`)の範に乗せられるか、別構造かを評価。
- **D-4**: フロント側の組込点(code-facts §3 ルートに画面13/14 を新設・§2 のフック/queryKey 規約・§6 共通ナビ)に対し、外部フロント資産(あれば)がどの程度再利用可能かを評価。
- **D-5**: 以上から、各成果物を **「ほぼそのまま統合」/「契約準拠へ改修して統合」/「参考にとどめ新規実装」** のいずれが妥当か、根拠つきで仕分け(決定はしない・材料提示)。

### E. セキュリティ・検証適合(FR405 import)

- **E-1**: `combo-csv-import` が **CSV 無害化**(セル値を式/コマンドとして解釈・実行しない・描画時エスケープ。DES-002 §7.4)を持つかを実コードで確認。
- **E-2**: **NFR103 検証**(スキーマ検証・行単位型チェック・**サイズ上限 1000 行**・外部 URL 参照無効化。DES-006)の有無を実査。欠落を列挙(統合時に追加が要る範囲)。
- **E-3**: import の **冪等性・ID 衝突回避**(`local_id` 紐付け・既存コンボとの重複・タグ解決)をどう扱うか実コードで確認。

### F. ライセンス・由来・品質

- **F-1**: 3 プロジェクトの **ライセンス**(LICENSE ファイル・依存ライブラリのライセンス)を実査し、**combomgr の MIT へソースコピーで取り込んで配布可能か**を整理(NFR403)。取り込み方式は**ソースコピー想定**(開発者方針 2026-06-28)のため、コピー時に持ち込む依存・ライセンス表記・帰属(NOTICE 等)の要否を材料として報告(決定はしない)。
- **F-2**: 自律製造由来の **コード品質の当たり**(テスト有無・明らかな TODO/未実装・combomgr のコード規約〔arch-patterns〕との大きな乖離)を報告。深い品質監査はしない(統合可否判断に要る粒度の当たりのみ)。

---

## 5. 報告様式(`M13-RESEARCH-01-report.md`)

各調査項目 A〜F について、以下を記す:

1. **実態**(view / grep の結果。言語・依存・エンドポイント・CSV 列・関数名は実値)。
2. **契約との差**(DES-002 §4.2 / DES-005 §5.13/§5.14 / DES-006 / FR401〜405 との乖離)。
3. **M13-01/02 スコープへの含意**(この事実が実装範囲をどう広げる/狭めるか。「統合 / 改修 / 新規」の仕分け)。
4. **推奨**(複数案がある場合は playbook §13.4 の形式で併記。決定はしない)。

末尾に **「M13-01/02 スコープ確定のための要決定事項」**を番号付きで集約する(各成果物の統合方式・FR403/404 の穴の埋め方・外部リポジトリ取り込み方式・CSV 形式の新旧是正の要否・検証/無害化の追加範囲)。

---

## 6. 完了条件(Definition of Done)

- §4 A〜F の全項目を、外部 3 プロジェクトの実ファイル + combomgr 側 code-facts/DES の **view・grep で確認**して報告した。
- 言語・依存・エンドポイント・CSV 列・関数名を**実値**で報告した(要約や記憶で代替していない)。確認できなかった点は「未確認」と明記し、推測は「推測:〜」と明示した。
- FR401〜405 の**カバレッジ写像と穴**(特に PNG/クリップボード)が明示されている。
- read-only を逸脱していない(実装・コード変更・依存追加・ファイル移動・外部成果物のビルド/実行/テスト実行がゼロ)。
- §5 末尾の「要決定事項」が、M13-01/02 実装指示書の Plan Mode 入力として使える粒度でそろっている。

---

## 7. 参照ドキュメント

- code-facts(最新生成版)§2/§3/§4/§7/§9/§10。
- DES-002 v1.24.0 §4.2・§7.4/§7.5、DES-005 v2.26.0 §5.13/§5.14、DES-006 v1.13.0(NFR103)、DES-001 v1.3.0 §5(MIT)。
- REQ-001 v2.15.0 §7 FR401〜405。
- phase3-overview v0.3.0 §M13、followup-backlog(フェーズ3)§D。
- 外部成果物: `autopilot-combomgr/projects/{combo-csv-import, combo-export-csv, combo-export-image}`(別リポジトリ・開発環境では combomgr 配下に展開。各フォルダに `INTAKE.md`/`CODE-FACTS.md` 同梱)。他プロジェクトは対象外。
- 参照アーキ: 既存 `movesimport`(internal/api/movesimport、web/src/features/import)。

---

## 開発者への確認事項

**解決済み(開発者回答 2026-06-28)** — 本指示書 v1.1.0 に反映済み:
1. **サブ命名**: `M13-RESEARCH-01` で確定。
2. **探索範囲**: 対象は `combo-csv-import` / `combo-export-csv` / `combo-export-image` の 3 プロジェクトに限定。`autopilot-combomgr` 配下の他プロジェクトは今回と無関係(将来向け)のため**対象外**。各フォルダの `INTAKE.md`/`CODE-FACTS.md` は必読・調査起点。
3. **取り込み方式**: **ソースコピー想定**。F-1 はこの前提で材料整理(決定は report 後の Plan Mode)。
4. **model-allocation 追記**: 可(Sonnet 4.6・レビュー不要)。確定後に M13-RESEARCH-01 行を追記。

**残る確認事項**: なし(本指示書は確定可能な状態)。

---

*以上、M13-RESEARCH-01 調査指示書 v1.0.0。配置 `docs/instructions/phase3/M13-RESEARCH-01-export-import-artifact-survey.md`。本調査の report が M13-01(CSV import/export)・M13-02(PDF/PNG/クリップボード)実装指示書のスコープ確定入力となる。*
