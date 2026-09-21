# 指示書 M13-01: FR401/405 コンボ CSV エクスポート/インポート(案A・セットプレイ別ファイル含む)

| 項目 | 内容 |
|------|------|
| 指示書ID | M13-01 |
| バージョン | 1.0.1 |
| 推奨モデル | Opus 4.8(関心数大・新ドメイン + API + フロント + 型整合 + 検証。§7・model-allocation 参照) |
| Plan Mode | **必須**(§3.4 / §9.4) |
| 機械レビュー | 必須(別チェックリスト: `M13-01-review-checklist.md`) |
| 並列性 | 単独(直列)。M13-RESEARCH-02(read-only)とは並行可 |
| 依存 | M13-RESEARCH-01(統合可否調査・完了)。CHANGE-050(設計担当が起票・本サブの DES 反映。後述 §文書影響) |
| 想定所要時間 | 300〜420 分(export + import preview/commit + setplay 別ファイル + 検証/無害化 + 型整合 + テスト) |
| 作成者・作成日 | 設計担当 Claude(フェーズ3 キックオフ担当)/ 2026-06-28 |

## 更新履歴

| 版 | 更新日 | 更新内容 |
|----|--------|----------|
| 1.0.0 | 2026-06-28 | 初版。M13-RESEARCH-01-report を受けた FR401/405 統合実装(案A = DES-005 §5.13/§5.14 準拠・local_id + セットプレイ別ファイル)。 |
| 1.0.1 | 2026-06-28 | Plan Mode 決定を反映。(1) **重複動作 = skip(既定) + 新規追加の 2 択**に確定、**上書きは M13 後続へ繰り延べ**(§1.3・§3.4-2・§4.4。DES-005 §5.14 の 3 択は端状態として維持、繰り延べは段階化で CHANGE 不要)。(2) **export 配送 = ZIP 1 ファイル(`archive/zip`・in-memory)**に確定、import も zip 受理(§4.1・§4.2)。(3) M13-RESEARCH-02 含意を反映＝サーバ FS 書込を作らない(in-memory 生成)・万一書く場合は appData 封じ込め + ユーザ入力パス非流入(§4.2・§9.1)。 |

---

## 1. 背景と目的

### 1.1 背景

- フェーズ3 M13(データ共有・データ保護)の先頭(C-1)。先行リリース中の友人のコンボ/セットプレイデータを **export で保護(バックアップ・移行)**し、**import で復元**できるようにする。
- **本体にコンボ export/import は未実装**。DES-002 §4.2 が `GET /api/export/csv`(FR401)・`POST /api/import/csv`(FR405、**moves 取込 `/api/import/moves` とは別系統**)を予約済み。DES-005 §5.13(画面13 エクスポート)/§5.14(画面14 インポート)は spec のみで未実装(code-facts §3/§4 に画面13/14・両エンドポイントなし)。
- 開発者が先行作成させた成果物を統合する(M13-RESEARCH-01 で調査済み)。**製造担当(Claude Code)は統合元を `autopilot-combomgr/projects/combo-csv-import`・`combo-export-csv`(+ 各 `INTAKE.md`/`CODE-FACTS.md`)で閲覧できる**(別リポジトリ・git 追跡外・開発環境では combomgr 配下に展開)。実装の裏取りに参照すること。
- **方針 = 案A(開発者確定 2026-06-28)**: DES-005 §5.13/§5.14 契約に完全準拠。コンボ CSV に `local_id`、セットプレイ CSV(別ファイル)に `parent_combo_local_id`、行チェックボックス選択。

### 1.2 目的

完了時に達成される状態:

- `GET /api/export/csv` で、選択範囲のコンボを **コンボ CSV + セットプレイ CSV の 2 ファイルを 1 つの ZIP** にまとめて出力できる(別ファイル・`local_id`/`parent_combo_local_id` 紐付け)。export は **意味単位(code ベース・DB 管理列除外)**で行い物理列直書きをしない(M13-RESEARCH-01 §C-4。M14 の moves 列変更に頑健)。
- `POST /api/import/csv/preview` で行ごとの検証結果(要確認/エラー)を **DB 書込なし**で返し、`POST /api/import/csv`(commit)で選択行のみを取り込める。取込時に **code→id 解決・starter 導出・重複動作・タグ解決・local_id 紐付け・セットプレイ反映**を行う。
- import に **NFR103 検証(DES-006 VAL-I01〜09)+ CSV 無害化(式注入ガード・描画エスケープ・URL 非リンク化)**を備える。
- 統合元の往復ロジック(`combo-export-csv` の `ExportCSV`/`ImportCSV` DeepEqual 往復・`combo-csv-import` の検証層)を再利用し、契約差(`local_id`/setplay/`drive_damage` float/oki nullable/starter/code→id)を本体側で埋める。

### 1.3 このマイルストーンで作らないもの(スコープ外)

- **PDF / PNG / クリップボード**(FR402/403/404)= **M13-02**(`combo-export-image` 統合 + 比較表 + setups 同梱 + FR404 HTML クリップボード新規)。
- **import 重複動作の「上書き」**(VAL-C02 該当時の既存コンボ置換)= **M13 後続/別サブへ繰り延べ**(Plan Mode 決定)。本サブは **skip(既定) + 新規追加の 2 択**を実装。上書きは既存 recipe+メタデータの破壊的置換で、楽観ロック・紐づくセットプレイの扱い・ゴミ箱整合を専用に詰めるべきため分離(M9-02 が seed クリアを M12-02 へ繰り延べた前例と同型=設計意図不変・実行時期のみ移動)。DES-005 §5.14 の 3 択は端状態として維持(CHANGE 不要)。
- moves 取込(FR704)= 別系統(`movesimport`)。本サブは触らない(降格は M14)。
- 英語ロケール(name_en・英語 UI)。
- DES 本体の改訂 = **設計担当が CHANGE-050 で対応**(製造担当は DES を直接編集しない。§文書影響)。

---

## 2. 成果物

### 2.1 作成するファイル(想定パス。実配置は既存構成 code-facts §4 に合わせる)

| ファイル | 内容 |
|---|---|
| `internal/api/comboio/handler.go` + `routes.go` | `GET /api/export/csv`(FR401)・`POST /api/import/csv/preview`(dry-run)・`POST /api/import/csv`(commit)。§4.1 |
| `internal/service/comboio/*.go` | export 直列化 + import 解析/検証/無害化/オーケストレーション。統合元 `combo-export-csv`/`combo-csv-import` のコア流用。§4.2〜§4.8 |
| `internal/repository/combo/*.go`(追加) | export 用の全件/範囲取得(steps/tags/setups 同梱)・import 用 code→id 解決・行 upsert・重複検出再利用。§4.3/§4.4 |
| `web/src/features/combo-io/`(export ダイアログ=画面13・import プレビュー=画面14)+ `api.ts` | §4.7。hooks は code-facts §2 の queryKey/mutation 規約に合わせる |

### 2.2 修正するファイル

| ファイル | 修正内容 |
|---|---|
| `cmd/combomgr/main.go` / routes 集約点 | comboio ルート配線 |
| `web/src/router.tsx` | 画面13(export)・画面14(import)ルート追加(既存ルート規約 code-facts §3) |
| `web/src/components/Header.tsx` ほかナビ | export/import 導線(DES-005 §5.13  §228 のエクスポートボタン導線。既存ナビ構造 code-facts §6 を確認) |

### 2.3 変更しないもの(原則)

- 既存コンボ/セットプレイ/タグ/技の API 契約(code-facts §7。`ComboResponse` 等公開フィールド不変)。
- moves 取込(`movesimport`)= 別系統・別画面。本サブは触らない。
- **DES 本体**(REQ/DES)。コンボ CSV 契約の正典化は **CHANGE-050(設計担当)**。製造担当は反映後の DES を正として実装する。

### 2.4 例外条項

- 統合元の `contract`/`combo` パッケージ(21 列契約・DTO。`combo-csv-import` が `combo-export-csv` を `replace` 参照=一体)を **ソースコピーで取り込む**(MIT 確定・LICENSE/著作権ヘッダなし=本体 MIT 吸収)。取り込み単位・共有パッケージ化・**Go json タグ snake_case ↔ 本体 camelCase 規約(CLAUDE.md §4)の整合(DTO 変換層 or タグ調整)**は §3.4-8 / §4.9 で確定。

---

## 3. 前提条件

### 3.1 必読ドキュメント

> **文書ID ⇄ 実パスの正は `docs/handover/docs-map.md`(自動生成)**。本節は docs-map 準拠の実パスを併記する。疑わしい場合は docs-map を引く(記憶で書かない・retrospective-digest §0)。

- **DES-002**(`docs/design/02-architecture.md`)§4.2(`/api/export/csv`・`/api/import/csv`)・**§7.x コンボ CSV 契約(CHANGE-050 で新設)**・§7.4(CSV 無害化)。**※ §7.5 は moves(FR704)契約で別物。混同しない**。
- **DES-005**(`docs/design/05-screen-design.md`)§5.13/§5.14(画面13/14 = 対象選択・形式・CSV 別ファイル `local_id`/`parent_combo_local_id`・行チェックボックス選択)。
- **DES-006**(`docs/design/06-validation.md`)§6 VAL-I01〜I09(import 検証)・§7.4(無害化)・VAL-C02(重複判定 DuplicateKey)・VAL-C03(starter≠レシピ先頭 WARNING)。
- **REQ-001**(`docs/design/requirements.md`)§7 FR401/FR405。
- **M13-RESEARCH-01-report**(`docs/progress/phase3/M13-RESEARCH-01-report.md`)= 統合可否・10 要決定事項。
- **code-facts**(`docs/handover/code-facts.md`)§3(ルート)/§4(combo・movesimport ハンドラ)/§7(`ComboResponse`/`CreateRequest`/`CheckDuplicateRequest`/`DuplicateInfoResponse`)/§8(`model.Combo`)/§9(`DuplicateKey`/repository)。
- **CHANGE-050**(設計担当起票・反映後は `docs/change-notes/CHANGE-050-*.md`)= コンボ CSV 契約の DES 反映。

### 3.2 任意参照(統合元・実コード)

- **`autopilot-combomgr/projects/combo-export-csv`**(`csvexport.ExportCSV`/`ImportCSV` 往復・`tsvexport`)・**`combo-csv-import`**(`csvimport.ParseAndValidate` 検証層・`DefaultMaxRows=1000`/`DefaultMaxBytes=10MiB`)。各 `INTAKE.md`/`CODE-FACTS.md` を起点に実コードで裏取り。**ビルド/実行はしない**(コア流用は本体へコピー後)。
- 参照アーキ: `movesimport`(preview→commit・共通サービス層・`selected[]` JSON・行単位レポート)。**ただし別ドメイン・別エンドポイント・別画面**。

### 3.3 参照不要

- PDF/PNG/クリップボード(M13-02)、moves 取込(FR704)、英語ロケール、`combo-export-image`。

### 3.4 着手前の確認(Plan Mode 必須。§9.4 と対応)

実装着手前に Plan Mode で開発者へ提示し確定すること(推測で進めない)。M13-RESEARCH-01 §6 の要決定事項に対応:

1. **starter_move_id の import 導出**(報告 #3): export は starter 列を持たず、import 時に **レシピ先頭ステップから `starter_move_id` を再導出**する。この導出が編集器の `autoStarterMoveId` / `extractKeyFields`(レシピ先頭導出)と**一致**し、VAL-C03(starter≠先頭 WARNING)・DuplicateKey(VAL-C02)と整合するかを実コードで確認(`repository/combo`・`features/combo` の starter 決定経路)。レガシー「保存 starter≠先頭」は再 import 時に先頭へ正規化される旨を明記(PUT 時自動補正と同型・データ破壊でない)。
2. **重複動作**(報告 #5・DES-005 §5.14)＝**決定済み**: import 行が既存コンボと VAL-C02(DuplicateKey = character/starter/position/opponent_stance/hit_type/opponent_size)で重複した場合、**skip(既定) + 新規追加の 2 択**を実装する(**上書きは繰り延べ。§1.3**)。Plan Mode では (a) 既存 `POST /api/combos/check-duplicate`(`CheckDuplicateRequest`/`DuplicateInfoResponse`)の再利用、(b) 「新規追加」が重複を許容して別コンボとして登録する経路(VAL-C02 を当該行で通す)、の実装詳細を確定する。
3. **タグ解決/作成**(報告 #5): CSV の `tags`(`[{name,category?,color?}]`)を既存 tags へ **name(+user スコープ)で解決、無ければ新規作成**。既存 tag API(`GET/POST /api/tags`)・user スコープ・新規作成時の color 既定を確認。
4. **セットプレイ別ファイル**(報告 #1・案A): セットプレイ CSV(`parent_combo_local_id` で親コンボ紐付け)の export/import 構造。既存 setup の CRUD(`setup.Handler`・`SetupStep`・combo↔setup の `combo_setups`/setup-links)と、import 時の親コンボ(同一バッチの local_id or 既存 ID)解決を確定。
5. **code→id 解決**(報告 #5): `character_code`→`character_id`・`move_code`→`move_id` の解決経路。**存在しない code の扱い(ERROR で行除外 / WARNING)**を VAL-I06/I07 と整合させ確定(CodeLookup の実装/注入)。
6. **行数/サイズ上限**: コンボ CSV は **1000 行(DES-001・VAL-I03)**。`combo-csv-import` の `DefaultMaxRows=1000` と一致。movesimport の 5000 と**混同しない**。
7. **無害化/検証の担保層**(報告 #8): 式注入ガード(`= + - @` 接頭辞のセル)・再 export 時の `'` 接頭辞付与・描画時エスケープ・VAL-I06/I07(CodeLookup)・VAL-I08(URL 非リンク化)を、service / handler / frontend 表示のどの層で担保するか。統合元は verbatim 保持(import=復元目的)のため**本体側で追加が必要**。
8. **取り込み単位**(報告 #10): `contract`/`combo` パッケージのソースコピー方式(両 Go 一体 or 本体共有パッケージへ集約)+ Go json タグ snake_case ↔ 本体 camelCase の整合(DTO 変換層を挟むか)。

---

## 4. 詳細仕様

### 4.1 エンドポイント(DES-002 §4.2)

- **export**: `GET /api/export/csv`(FR401)。クエリで対象範囲(全/フィルタ/選択/マイコンボ)を受け、**コンボ CSV + セットプレイ CSV を 1 つの ZIP** にまとめて返す(**決定: ZIP 1 ファイル**。`archive/zip` 標準ライブラリ・新規依存なし)。**ZIP は `bytes.Buffer` 等で in-memory 組み立て or レスポンスへストリームし、サーバ側のディスク一時ファイルを作らない**(§4.2・FS 非書込)。
- **import**: 別経路方式(movesimport の範)。`POST /api/import/csv/preview`(dry-run。コンボ CSV(+ 任意セットプレイ CSV)を解析・検証・無害化し、行ごとの確定値 + 要確認 + エラーを返す。**DB 書込なし**)+ `POST /api/import/csv`(commit。選択行のみ取込)。**入力は 2 CSV 個別アップロードに加え、export した ZIP も受理して自動展開**(往復対称)。**解析/検証は共通サービス層**に置き両経路が呼ぶ(計算の単一情報源)。

### 4.2 export(コンボ CSV + セットプレイ CSV・意味単位)

- 統合元 `combo-export-csv` の `ExportCSV` を本体へ取り込み、**契約差を埋める**: (a) コンボ CSV に **`local_id`** 列追加(export バッチ内の一時 ID。import の `parent_combo_local_id` と対称)、(b) **セットプレイ CSV を別ファイルで新設**(`parent_combo_local_id` + setup レシピ/名称等)、(c) `drive_damage` を **float(本体 REAL)**で出力(§4.9)、(d) oki 6 列を **nullable(空=NULL を表現)**で出力(§4.9)、(e) **starter 列は出力しない**(import で再導出・§3.4-1)。
- DB 管理列(id/version/created_at/updated_at/deleted_at/step_count/recipe_cache)は**除外**(本体再生成前提)。code 値(`character_code`/`move_code`)+ recipe/tags の JSON 埋込で**意味単位**を維持(M13-RESEARCH-01 §C-4)。
- CSV 列契約の**正典は CHANGE-050 で DES-002 §7.x に新設**。製造担当は反映後の DES を正とする(本指示書 §4.2 は実装の道標で、正典化は設計担当)。
- **配送・FS 安全(決定・M13-RESEARCH-02 含意)**: 2 CSV は **ZIP 1 ファイル**(`archive/zip`)にまとめ、**in-memory(`bytes.Buffer`)で組み立てて HTTP レスポンスへ返す**。**サーバ側にディスク一時ファイルを作らない**(export が破壊的 FS 書込を一切増やさない)。万一サーバ FS 書込が必要になる場合は、書込先を `appDataRoots()` 等アプリ管轄に封じ込め、**ユーザ指定ファイル名・CSV セル値を書込パスへ流入させない**(パストラバーサル防止・CHANGE-049 と同思想)。

### 4.3 import preview(検証・無害化・DB 書込なし)

- 統合元 `combo-csv-import` の `ParseAndValidate`(行ごと `RowResult{Status,Combo,Issues}`・`Summary`)をコア流用し、本体で **code→id 解決(§3.4-5)・starter 導出(§3.4-1)・重複検出(§3.4-2)・タグ解決(§3.4-3)・セットプレイ紐付け(§3.4-4)** を付加。
- 検証 = NFR103(DES-006 VAL-I01〜I09): サイズ上限(10MiB)・UTF-8・**行数 1000**・カラム構成・行単位型チェック・code 存在(VAL-I06/I07)・URL 非リンク化(VAL-I08・表示層)・結果サマリ(VAL-I09)。
- 無害化(§3.4-7): セル値を式/コマンドとして解釈せず**描画時エスケープ**。式注入ガード(`= + - @`)。

### 4.4 import commit(行単位 upsert・重複動作・部分成功)

- 選択行のみ取込。**依存順**: タグ解決/作成 → コンボ upsert(code→id・starter 導出)→ セットプレイ upsert(`parent_combo_local_id` で親解決)。
- **重複動作**(§3.4-2): VAL-C02(DuplicateKey)該当時に **skip(既定) / 新規追加** の 2 択(**上書きは繰り延べ・§1.3**)。「新規追加」は重複を許容し別コンボとして登録。
- 全体ロールバックしない: 失敗行スルー + **行単位レポート**(成功/スキップ/失敗 + 理由)。
- **冪等性**: 同一 CSV 再 import で重複が無秩序に増えない(重複動作の規約に従う)。

### 4.5 タグ解決(§3.4-3)

- `tags` の各 `{name,category?,color?}` を user スコープで既存 tag に name 解決、無ければ作成(color 既定は既存 tag 作成の規約に合わせる)。空 name は VAL-T02 WARNING(統合元踏襲)。

### 4.6 セットプレイ別ファイル(案A・§3.4-4)

- export: 各コンボに紐づくセットプレイを**セットプレイ CSV**へ。`parent_combo_local_id` = コンボ CSV の `local_id`。
- import: セットプレイ行の `parent_combo_local_id` を、同一バッチで取り込んだコンボの local_id(または既存コンボ ID)へ解決して紐付け。親コンボが取込対象外/失敗なら当該セットプレイはスキップ + レポート。

### 4.7 UI(DES-005 §5.13/§5.14)

- **画面13 エクスポート**: 対象選択(全/フィルタ中/選択中/マイコンボ)・形式(本サブは CSV のみ。PDF/PNG/クリップボードは M13-02 で同画面に追加)・実行 → **ZIP 1 ファイルダウンロード** + 完了トースト。
- **画面14 インポート**: ファイル選択(コンボ CSV 必須・セットプレイ CSV 任意)・プレビュー(行ごと確定値 + チェックボックス〔既定全チェック・個別解除〕・要確認/エラー強調)・実行 → 行単位レポート。**無害化描画エスケープ**。
- 既存 shadcn/ui パターン踏襲(playbook §4.6)。新設ルート(画面13/14)+ Header 導線(DES-005 §228 エクスポートボタン)。

### 4.8 検証・無害化(§3.4-7・DES-006)

- VAL-I06/I07(code 存在): CodeLookup を本体で実装・注入(統合元はデフォルト未注入)。存在しない character_code/move_code 行の扱い(ERROR で除外 or WARNING)を §3.4-5 で確定。
- VAL-I08(URL 非リンク化)・式注入ガード・描画エスケープ・再 export 時 `'` 接頭辞を、確定した担保層(§3.4-7)に実装。

### 4.9 型整合(報告 #2/#4・統合元の旧形是正)

- **`drive_damage`**: 統合元 CSV/DTO は `*int`、本体 model は **`*float64`(REAL・小数 -6〜6)**。本体取込/出力を **float に整合**(CHANGE-046 後の正)。小数値の往復欠落を起こさない。
- **oki 6 列**: 統合元は bool(非 NULL)、本体は **`*bool`(nullable)**。**nil/false を区別**して往復(空セル=NULL、`false`=明示 false)。
- contract/combo のソースコピー + camelCase 整合(§3.4-8)。

---

## 5. テスト要件

### 5.1 必須テスト(Go test / Vitest)— ケース数で語る

Go test(comboio サービス・リポジトリ):

- **export 往復**: export → import で `reflect.DeepEqual` 往復(統合元のゴールデン行を本体契約へ拡張)。**ZIP 1 ファイルを生成し、その ZIP を import して**往復が成立する。`local_id`/`parent_combo_local_id` でセットプレイが正しく紐付く。`drive_damage` 小数・oki nil/false が往復で保たれる。starter が import で recipe 先頭から再導出され DuplicateKey が一致。
- **import preview 検証**: VAL-I01〜I09(サイズ/UTF-8/行数 1000/カラム/型/code 存在/URL/サマリ)各ケース。式注入セル(`=`/`+`/`-`/`@`)が無害化される。
- **import commit**: 重複動作(skip(既定)/新規追加 各。**上書きは本サブ対象外**)、タグ解決(既存解決/新規作成/空 name WARNING)、code→id 解決(存在しない code の扱い)、セットプレイ親解決(同一バッチ local_id / 親失敗時スキップ)、部分成功(不正行スルー + 後続継続 + レポート)、冪等。

Vitest(フロント): import プレビューの行チェックボックス選択・要確認/エラー強調・行単位レポート表示。

### 5.2 E2E シナリオ(seed 非依存 self-contained)

- シナリオ: コンボ(+セットプレイ)を作成 → export(ZIP 1 ファイル DL)→ 別状態へ import(ZIP 受理 → プレビュー → 一部除外 → 実行 → レポート)→ 一覧反映。`make e2e` 既存 spec 非回帰(combo-crud 等)。

---

## 6. レビュー観点(別ファイル参照)

機械レビューは `M13-01-review-checklist.md`(本指示書と対で設計担当が作成)に従う。

---

## 7. 完了条件(Definition of Done)

### 7.1 機能要件
- `GET /api/export/csv` がコンボ CSV + セットプレイ CSV(別ファイル・local_id 紐付け・意味単位)を返す。
- `POST /api/import/csv/preview` が検証/無害化結果を DB 書込なしで返し、`POST /api/import/csv` が選択行を取込(code→id・starter 導出・重複動作・タグ解決・setplay)し行単位レポートを返す。
- 画面13/14 が動作(対象選択・行選択・要確認/エラー強調・レポート・無害化描画)。
- `drive_damage` float・oki nullable・starter 再導出が往復で正しい。

### 7.2 自己テスト結果(製造担当の責任範囲)
- §5.1 の Go test / Vitest ケースが全通過(ケース数で報告)。

### 7.3 品質チェック
- `make e2e`(§5.2 追加後)通過。既存 combo-crud spec 非回帰。既存コンボ/タグ/技 API 契約に差分なし。

### 7.4 ドキュメント
- コンボ CSV 契約・画面13/14・import VAL の DES 反映は **設計担当が CHANGE-050 で対応**(製造担当は DES を直接編集しない)。

### 7.5 完了報告
- Plan Mode で確定した方式(重複動作・starter 導出・code→id・無害化担保層・取り込み単位)、テストケース数、既知の制約(PDF/PNG/クリップボード=M13-02、英語ロケール除外)を報告。

---

## 8. 参照ドキュメント

| 文書(実パス) | 節 | 用途 |
|------|-----|------|
| DES-002 `docs/design/02-architecture.md` | §4.2 / §7.x(CHANGE-050)/ §7.4 | エンドポイント・コンボ CSV 契約・無害化 |
| DES-005 `docs/design/05-screen-design.md` | §5.13 / §5.14 | 画面13/14・CSV 別ファイル・行選択 |
| DES-006 `docs/design/06-validation.md` | §6 VAL-I01〜09 / §7.4 / VAL-C02 / VAL-C03 | import 検証・無害化・重複判定・starter |
| REQ-001 `docs/design/requirements.md` | §7 FR401/FR405 | 要件 |
| M13-RESEARCH-01-report `docs/progress/phase3/M13-RESEARCH-01-report.md` | §0/§6 | 統合可否・10 要決定事項 |
| code-facts `docs/handover/code-facts.md` | §3/§4/§7/§8/§9 | ルート・combo/movesimport DTO・model.Combo・DuplicateKey |
| docs-map `docs/handover/docs-map.md` | §1 | 文書ID ⇄ 実パスの正(疑義時に引く) |
| CHANGE-050 `docs/change-notes/CHANGE-050-*.md`(反映後) | — | コンボ CSV 契約の DES 反映(設計担当) |
| `autopilot-combomgr/projects/{combo-csv-import,combo-export-csv}` | INTAKE.md/CODE-FACTS.md + 実コード | 統合元(閲覧可) |

---

## 9. 注意事項・判断に迷ったら

### 9.1 推測で進めてはいけない事項
- 重複動作(§3.4-2)・starter 導出(§3.4-1)・code→id の存在しない code 扱い(§3.4-5)・無害化担保層(§3.4-7)・取り込み単位/json タグ整合(§3.4-8): Plan Mode 確定前にコード化しない。
- 既存コンボ/タグ/技 API 契約の変更: 不可。

### 9.2 推測で進めてよい事項(その旨を明示)
- comboio サービス/ハンドラ/フックの内部構成・ファイル分割は既存パターン(code-facts §2/§4)に合わせ製造担当裁量。export 配送は **ZIP 1 ファイル(in-memory)に確定**(§4.1/§4.2)。プレビュー UI のレイアウト詳細(要確認/エラーの視覚表現)は shadcn/ui 既存パターンに合わせ裁量。

### 9.3 不明事項発見時の対応
- §3.4 / §9.4 以外の不明点は Plan Mode 質問書(playbook §8.4)で開発者へ。

### 9.4 Plan Mode で計画提示時に含めるべき項目
- §3.4 の 1〜8 全て(starter 導出 / 重複動作 / タグ解決 / setplay 別ファイル / code→id / サイズ上限 / 無害化担保層 / 取り込み単位・json タグ)。

---

## 10. 完了後の次ステップ
- **M13-02**(FR402/403/404): `combo-export-image` 統合 + 比較表 + setups 同梱 + FR404 HTML クリップボード新規。画面13 に形式追加。
- **CHANGE-050**(設計担当): コンボ CSV 契約(DES-002 §7.x)・画面13/14 詳細(DES-005 §5.13/§5.14)・import VAL(DES-006)を起票・反映(本指示書と対)。
- model-allocation に M13-01 行を追記(着手時)。

---

*以上、M13-01 製造指示書 v1.0.0。配置 `docs/instructions/phase3/M13-01-combo-csv-export-import.md`。本指示書は CHANGE-050(コンボ CSV 契約の DES 反映)と対。*
