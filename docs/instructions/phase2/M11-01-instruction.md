# M11-01 製造指示書 v1.0.0 — custom_states 開始時状態の機能化(付与・表示・参照)

| 項目 | 内容 |
|------|------|
| 指示書ID | M11-01 |
| バージョン | 1.1.0 |
| 作成日 | 2026-06-20 |
| 作成者 | 設計担当 Claude(フェーズ2 本流スパイン・M11 担当) |
| 対象マイルストーン | M11(custom_states 開始時状態)/ M11-01 |
| 実装モデル | **Opus 4.8**(付与の3モード round-trip + データ駆動描画 + seed 既存値置換 + 命名整理で複数関心が絡む、playbook §7.1 Opus 信号) |
| レビューモデル | Sonnet 4.6 |
| Plan Mode | **必須**(§3.4。状態保持方式・組立経路・既存ゲージ弾き・seed 方式の着手前確認) |
| 機械レビュー | 必須(別チェックリスト: `M11-01-review-checklist.md`) |
| スコープ種別 | **フロント + seed マイグレーション + 軽微バックエンド**（PATCH への situation 加算＝CHANGE-041／§2.4。custom_states 編集の往復保持のため。サービス層の業務ロジックは不変） |
| 関連 CHANGE | CHANGE-040（DES-005 v2.22.0 §5.6/§5.7 + DES-006 v1.12.0。**反映済みを前提**）／ CHANGE-041（DES-002 v1.21.0 §4.2 PATCH に situation 追加。**反映済みを前提**） |

## 更新履歴

| 版 | 更新日 | 更新内容 |
|----|--------|----------|
| 1.0.0 | 2026-06-20 | 初版。M11-overview v1.0.0・M11-RESEARCH-01(+FU)・m11-custom-states-definitions v0.2.0・CHANGE-040 に基づく |
| 1.1.0 | 2026-06-20 | M11-01 Plan Mode の質問（PATCH 経路で custom_states の往復保持を永続化できない）に対する**案1採用**を反映。§2.4 例外条項を「該当＝PATCH への situation 加算（CHANGE-041）」へ更新、§2.2 にバックエンド3点（UpdateMetadataRequest／UpdateMetadataInput／repo UPDATE SET）を追加、§4.2 の PATCH 経路をバックエンド受け口込みに明確化、§5 に PATCH 永続化テストを追加。スコープ種別に軽微 BE を追記。custom_states はメタデータ（重複判定 VAL-C02 対象外＝DES-006 §2.4）のため PATCH のままで正しい |

---

## §1 背景と目的

### §1.1 背景

- M10 完了で他キャラのコンボ登録が可能になったが、custom_states(キャラ固有の開始時状態)は phase-1 で保存/API のみ実装され、付与・表示・参照は未実装。
- M11-RESEARCH-01(+FU)で現状確定: situation/custom_states は物理 TEXT(スキーマ変更不要)/ situation は全層 `*string` 素通しで `custom_states` キーをパースする箇所 0 / ComboEditor に situation 入力は実在せず(useState ベース、`buildCreatePayload()`:144 が唯一の組立箇所、situation は未送信)/ 選択キャラの定義は既存 `useCharacters` の戻り `Character[].customStates` に含まれる(未使用)。
- 状態保有3体は未投入(ryu=`'{}'`、ingrid/c_viper=NULL)。**ryu の `'{}'` は phase-1「固有状態なし」前提**で、電刃定義への置換が要る(前向き注意 M10-2/M10-5)。

### §1.2 目的(完了時に達成される状態)

- コンボ登録/編集で、選択キャラの開始時状態を付与できる:
  - リュウ = 電刃錬気(トグル)/ イングリッド = サンシンボル(数値 0–4)/ C.ヴァイパー = バウンサーステップ(トグル)。
- 付与した状態がコンボ詳細・比較で「キャラ固有状態」として表示される。
- 状態を持たないキャラ(ケン/ダルシム等)では付与・表示セクションが現れない(データ駆動)。
- 編集/コピーで既存の付与値が往復保持される(round-trip)。
- 状態の消費は扱わない(利用者が notes 管理)。

### §1.3 このサブユニットで作らないもの(スコープ外)

- custom_states の**消費・検証**(コンボ中の減少・レベルで技変化・バリデーション連動)。アプリでは構築しない=現時点では実装しない(CHANGE-040 §3.3、DES-006)。
- **非先行リリースキャラへの seed 投入**(ryu/ingrid/c_viper のみ。マノン等は行が存在しない)。**aki/jamie/guile への変更**(jamie の `drunk_level`/composite は据え置き、M12-02 整理対象)。
- 登録系 API の**業務ロジック・スキーマ**の変更（スキーマは `combos.situation` TEXT 既存で不変。PATCH への situation 加算＝CHANGE-041 は契約の加算的拡張で、業務ロジック・重複判定・検証は不変）。
- 独立カラム「状況」(position 等)の挙動変更。

---

## §2 成果物

### §2.1 作成するファイル

| 区分 | ファイル | 内容 |
|------|---------|------|
| 作成 | seed マイグレーション(`migrations/0000NN_*.up.sql` / `.down.sql`。**番号は §3.4 で確定**) | characters.custom_states へ3体の定義投入(ryu の `'{}'`→`denjin_charge` 置換、ingrid=`sun_crest`、c_viper=`limit_decoupler`)。投入 JSON は m11-custom-states-definitions §3.1。down は ryu=`'{}'`・ingrid/c_viper=NULL へ戻す |

### §2.2 修正するファイル(実パスは §3.4 view で最終確認)

| ファイル | 修正内容 |
|---------|---------|
| `web/src/features/combo/components/ComboEditorBasicFields.tsx` | 「キャラ固有状態」`<fieldset>` を新設(既存 fieldset パターンに倣う)。`BasicFieldsValue` に付与値フィールドを追加。選択キャラ定義から動的描画(flag→トグル / int→数値入力) |
| `web/src/features/combo/components/ComboEditor.tsx` | `BasicFieldsValue` 拡張に追従。`buildCreatePayload`(:144)/ `buildPatchPayload`(:173)/ `runPut`(:305)に situation 組立を追加。`initialBasic`(:523)で edit/copy 時の既存 situation を復元(round-trip) |
| `web/src/features/combo/components/ComboDetailHeader.tsx` | 「キャラ固有状態」表示セクションを追加(独立カラム「状況」とは別)。custom_states を持つコンボのみ表示 |
| `web/src/features/combo/components/CompareTable.tsx` | `rows` に「キャラ固有状態」行(新 `RowDef`)を追加 |
| `web/src/features/combo/types.ts` | `BasicFieldsValue` 等の型に付与値を追加(situation の扱いは §4.4) |
| `web/src/locales/{ja,en}.json` | 「キャラ固有状態」用の**新系統 i18n キー**(既存 `comboDetail.situation.*` / `compare.row.situation` とは別。命名衝突回避) |
| `internal/api/combo/dto.go`（実パス §3.4 で確認） | **`UpdateMetadataRequest` に `situation *string` を加算**（nil=不変更、他フィールドと同方式）。`UpdateMetadataInput` への受け渡しに situation を追加（CHANGE-041） |
| `internal/service/combo/service.go`（同上） | **`UpdateMetadataInput` に situation を加算** → `model.Combo.Situation` へ詰める（メタデータ更新経路）。業務ロジック・検証は追加しない（素通し、DES-006 §2.4） |
| `internal/repository/combo/repository.go`（同上） | **メタデータ UPDATE 文の SET 句に `situation` を加算**（nil 時は不変更となる既存パターンに揃える） |

### §2.3 変更しないもの(保護対象)

- 独立カラム「状況」(position / opponent_stance / hit_type / opponent_size / drive/sa available)の入力・表示挙動。
- 登録系 API のうち **`POST`／`PUT`／check-duplicate の契約・スキーマは不変**。**`PATCH` は situation（custom_states）を加算するのみ（CHANGE-041／§2.4）で、他の契約項目・重複判定キー（VAL-C02）は不変**。スキーマ（`combos.situation` TEXT）は不変。
- M10-01/02 の ComboEditor キャラ選択・既定キャラ文脈追従挙動。CHANGE-036 切替時リセット。
- aki/jamie/guile の custom_states seed。

### §2.4 例外条項(バックエンドへの追加変更)

**該当あり＝`PATCH /api/combos/:id` への situation 加算（CHANGE-041）**。M11-01 Plan Mode で、custom_states 単独編集（識別キーを変えないメタデータ編集）は PATCH 経路を通るが `UpdateMetadataRequest` が situation を持たず往復保持が永続化できないと判明したため、§2.2 のバックエンド3点（DTO／Input／repo UPDATE SET）に situation を**加算的**に追加する。これは §2.4 の正規エスカレーションの結果であり、開発者が案1を確定（2026-06-20）、CHANGE-041 で DES-002 §4.2 契約に反映済み。

- 追加は situation（`*string` 素通し）のみ。custom_states に対する検証・業務ロジックは追加しない（DES-006 §2.4）。
- 重複判定（VAL-C02）の対象は不変（custom_states は識別キーではない）。識別キー項目を変える編集が POST（PUT 経路）へ誘導される既存挙動も不変。
- 上記以外でバックエンドのロジック変更が必要と判断した場合は、Plan Mode で停止して開発者に相談すること。

---

## §3 前提条件

### §3.1 必読

- **DES-005**(`docs/design/05-screen-design.md` **v2.22.0**、CHANGE-040 反映済み)§5.6 表示項目4 / §5.7 表示項目5「キャラ固有状態」。
- **DES-006**(`docs/design/06-validation.md` **v1.12.0**)custom_states 入力は検証しない旨。
- **DES-002**(`docs/design/02-architecture.md` **v1.21.0**、CHANGE-041 反映済み)§4.2 `PATCH /api/combos/{id}` のメタデータ編集に situation（custom_states）を追加。
- **DES-003**(`docs/design/03-data-model.md`)§3.2 custom_states 構造 / §3.x situation の `custom_states` キー。
- **m11-custom-states-definitions.md** v0.2.0(`docs/handover/`)§2 確定定義 / §3.1 投入 JSON / §4 付与・値の扱い / §5 データ駆動方針。
- **M11-RESEARCH-01 報告**(`docs/progress/M11-RESEARCH-01-report.md`)§0〜§3 + §6 FU-1〜4(設置先・フォーム機構・取得経路)。
- **code-facts.md**(`docs/handover/code-facts.md` commit `3e0f4bf`)§1 Props / §2 hooks・queryKey / §8 model。
- **architecture-patterns.md** §1.1 queryKey / §9.1 custom_states 現状。

### §3.2 任意

- M10-01/02 指示書(ComboEditor の既存挙動)。DES-002 §4.2(situation は既存 DTO の確認)。

### §3.3 参照不要

- custom_states の消費セマンティクス(本サブで作らない)。moves 取込・仮想コントローラ。

### §3.4 着手前の確認(Plan Mode。**結果を開発者に報告**)

> §9.1 推測 NG 項目を実 view で確認する。複数項目のため §8.4.2 質問書ファイル方式を推奨。

1. **situation 組立4経路 + 付与値の state 保持方式 + PATCH の BE 受け口**: `buildCreatePayload`(:144)/ `buildPatchPayload`(:173)/ `runPut`(:305)/ `initialBasic`(:523)を view し、situation 組立の追加位置を確認。付与値を `BasicFieldsValue` 拡張で保持するか別 useState かを判断(FU-1/FU-2 の controlled パターンに揃える)。**PATCH 経路はバックエンド側の `UpdateMetadataRequest`／`UpdateMetadataInput`／repo の UPDATE 文を view し、situation の加算位置（nil=不変更パターン）を確認する（CHANGE-041／§2.2／§2.4）。CREATE/PUT の BE 受け口（既存 `CreateRequest.Situation`）と対称化する。**
2. **選択キャラ定義の取得配線**: `useCharacters()`(queryKey `["characters",{gameId}]`、FU-3)の戻り `Character[]` から `find(c=>c.id===basic.characterId)?.customStates`(raw JSON 文字列)を取得し `JSON.parse`→`states[]` する経路を確認(parse 失敗時は空=防御)。
3. **Int 入力の既存ゲージ弾き方の踏襲**: `drive_available_at_start` / `sa_available_at_start` 入力(ComboEditorBasicFields の「基本情報」fieldset 内、FU-2)が `-` / `e` / `.` を弾く実装(onKeyDown / inputMode / sanitize 等)を view し、custom_states の int 入力で**同方式**を採る。min/max は value_definition 由来。
4. **「キャラ固有状態」fieldset の設置位置と i18n 新系統**: ComboEditorBasicFields のどの fieldset 間に置くか、i18n キーを既存「状況」系(`comboDetail.situation.*` / `compare.row.situation`)と衝突しない新系統(例 `*.customStates.*`)で定義する。
5. **seed マイグレーション**: `migrations/` の次番号、UPDATE 方式(`UPDATE characters SET custom_states='…' WHERE code IN ('ryu','ingrid','c_viper')`、ただし値は3体で異なるため個別 UPDATE)、`.down.sql`、`dbtest.Setup` が全マイグレーション適用する事実への波及(**加算的 UPDATE=破壊的クリアなし=安全**、digest §5)。
6. **詳細・比較の表示追加位置**: `ComboDetailHeader.tsx` の `<dl>` 群への新セクション、`CompareTable.tsx` の `rows` 配列への新 `RowDef`。表示時の code→name_ja 解決(選択/対象キャラの custom_states 定義を引く)。
7. **未対応 type・状態なしキャラの描画**: `type` が flag/level/stock 以外(composite 等)はスキップ、`states` 空 or custom_states なしのキャラはセクション非表示。
8. **situation 既存値の保全マージ**: situation に custom_states 以外のキーが存在する場合に備え、組立は「既存 situation を parse → custom_states キーを set → serialize」で他キーを保全する(現状他キーは無いが防御)。

---

## §4 詳細仕様

### §4.1 seed 定義投入(3体・加算的マイグレーション)

- characters.custom_states を3体へ投入。投入 JSON は m11-custom-states-definitions §3.1(逐語):
  - **ryu**: `'{}'` → `denjin_charge`(flag/boolean)へ**置換**(UPDATE)。
  - **ingrid**: NULL → `sun_crest`(level/integer, min:0, max:4)。
  - **c_viper**: NULL → `limit_decoupler`(flag/boolean)。
- `.down.sql`: ryu=`'{}'`、ingrid/c_viper=NULL へ戻す。
- aki/jamie/guile は対象外(触らない)。破壊的 seed クリアは行わない(M12-02)。

### §4.2 付与 UI(ComboEditor、データ駆動)

- **付与値の保持**: `BasicFieldsValue` に custom_states 付与値(`Record<code, boolean|number>` 相当)を追加。書き込みは既存 `set(key, v)`→`onChange({...value,[key]:v})` の controlled パターンに揃える(FU-2)。キャラ変更時の全体リセット(CHANGE-036)対象に含める。
- **定義の取得と描画**: 選択キャラ(`basic.characterId`)の `customStates`(raw 文字列、useCharacters 由来)を `JSON.parse`→`states[]`。各 state を type で描画:
  - `type=flag` → トグル(既存トグル/チェックボックスの実装パターンに揃える)。
  - `type=level` / `type=stock`(int) → 数値入力。`value_definition.min`/`max` を下限/上限に。**`-` / `e` / `.` 入力不可(§3.4-3 で確認した既存ゲージ方式を踏襲)**。
  - 上記以外の type(composite 等) → **スキップ**(描画しない)。
  - `states` が空 / customStates が NULL・空オブジェクトのキャラ → **fieldset 非表示**。
- **セクション配置**: 独立カラム「状況」とは別の「キャラ固有状態」`<fieldset>`(D-A)。i18n は新系統キー。
- **situation 組立**: `buildCreatePayload` / `buildPatchPayload` / `runPut` で、付与値から situation 文字列を生成して `situation:` キーを追加(現状キー不在)。生成は §4.4。**PATCH 経路（`buildPatchPayload`→`UpdateMetadataRequest`）はバックエンドの受け口が現状なく、CHANGE-041 で `UpdateMetadataRequest`／`UpdateMetadataInput`／repo UPDATE SET に situation を加算する（§2.2／§2.4）。CREATE／PUT のバックエンドは既に situation を受領するため、3経路がバックエンドでも対称になる。**
- **round-trip**: `initialBasic`(edit/copy)で `initial.situation` を parse→custom_states→付与値 state へ復元(現状 initialBasic は situation を読まない=FU-1。読込を追加)。

### §4.3 表示(詳細・比較)

- **コンボ詳細**(`ComboDetailHeader`): 独立カラム「状況」<dl> とは別に「キャラ固有状態」セクションを追加。`combo.situation` を parse→`custom_states` を取り出し、対象コンボのキャラ定義(custom_states の `states[]`)で code→`name_ja` を解決して `名称: 値`(boolean は ON/付与表示、int は数値)を表示。custom_states が空のコンボは非表示。
- **コンボ比較**(`CompareTable`): `rows` に新 `RowDef`(labelKey=新系統、render=custom_states を parse して表示)。各コンボのキャラ定義で名称解決。
- 表示の名称解決に要するキャラ定義は `useCharacters` の戻りから引く(詳細/比較の対象コンボの characterId で find)。

### §4.4 situation の格納・マージ方式

- 付与値 → situation 文字列の生成規則:
  - boolean: **true のみ**格納(false=非アクティブは省略)。
  - int: **既定値(= value_definition.min)以外**を格納(min と同値は省略)。
  - 格納形: `{"custom_states": {"<code>": <true|number>, ...}}`。
  - **既存 situation の保全**: 既存 situation を parse し、`custom_states` キーのみ差し替えて serialize(他キーが存在する場合は保持)。
  - custom_states が空になる場合: custom_states キーを除去。結果が空オブジェクトなら situation は `undefined`(送信しない=NULL 保存)。
- 読込(round-trip)は上記の逆(situation parse→custom_states→付与値 state)。

### §4.10 表示項目 ↔ 既存実装実態 対応表

| 項目 | 既存実装(RESEARCH/FU) | M11-01 での扱い |
|------|----------------------|----------------|
| situation 入力 | ComboEditor に不在(FU-1) | 「キャラ固有状態」fieldset を新設(§4.2) |
| 付与値の state | BasicFieldsValue に situation/custom_states なし(FU-1) | BasicFieldsValue 拡張(controlled)|
| 定義取得 | useCharacters 戻りに customStates 含む・未使用(FU-3) | find→JSON.parse→states[](§4.2) |
| situation 組立 | buildCreatePayload 等に situation キーなし=未送信(FU-1)。PATCH の `UpdateMetadataRequest` は BE 受け口なし | 4経路に situation 組立 + round-trip。**PATCH は BE 受け口を CHANGE-041 で加算**(§2.2/§4.2) |
| Int 入力弾き | drive/sa available 入力が既存(FU-2) | 同方式で -/e/. 拒否(§3.4-3) |
| 詳細「状況」 | 独立カラムのみ描画(FU-4) | 別「キャラ固有状態」セクション追加(§4.3) |
| 比較「状況」 | renderSituationTags=独立カラム(FU-4) | 別 RowDef 追加(§4.3) |
| i18n | situation 系は独立カラム用に占有(FU-4) | 新系統キー(§2.2) |

### §4.11 既知制約

- 開始時状態は**付与のみ**。コンボ進行に伴う消費(減少・解除)はアプリが追跡しない。利用者が notes で補足する(アプリでは追跡せず、現時点では実装しない)。付与 UI で消費の穴埋めをしない。
- 非先行リリースキャラの状態定義は未投入(seed は3体)。当該キャラのコンボ登録時は custom_states セクションが空表示になる(状態定義が無いため)=仕様どおり。

---

## §5 テスト要件

### §5.1 必須テスト(ケース数で確認)

- **seed**: (1) ryu の custom_states が `denjin_charge` 定義、(2) ingrid が `sun_crest`(min0/max4)、(3) c_viper が `limit_decoupler`、(4) down で ryu=`'{}'`/ingrid・c_viper=NULL に戻る、の4ケース。
- **付与 state/描画**: (5) flag キャラでトグル描画、(6) int キャラで数値入力描画(min/max 反映)、(7) int 入力が `-`/`e`/`.` を弾く、(8) 状態なしキャラで非表示、(9) 未対応 type(composite)をスキップ、の5ケース。
- **situation 組立**: (10) boolean true 格納/false 省略、(11) int 非min格納/min省略、(12) 全既定で situation 未送信(undefined)、(13) 既存 situation 他キーの保全、の4ケース。
- **round-trip**: (14) 保存→取得→edit で付与値が復元、(15) copy で復元、の2ケース。
- **PATCH 永続化（CHANGE-041）**: (16) 既存コンボの custom_states **のみ**を変更し保存→再取得で保持（PATCH 経路。`UpdateMetadataRequest`／`UpdateMetadataInput`／UPDATE SET に situation が通る）、(17) situation 未指定の PATCH（メモのみ編集等）で既存 situation が消えない（nil=不変更）、の2ケース。
- **後方互換**: (18) situation=NULL の既存コンボが詳細/比較/編集で壊れない、の1ケース。

### §5.2 E2E シナリオ(実装方式非依存)

- **A(Boolean 付与・往復・PATCH 永続化)**: リュウ選択 → 「キャラ固有状態」で電刃錬気トグル ON → 保存 → 詳細で電刃錬気が表示 → 編集で ON が復元。さらに **既存コンボの custom_states のみを変更（例: OFF に）して保存（キー変更なし＝PATCH 経路。再生成ダイアログ／セットプレイ引き継ぎ確認は出ない）→ 再取得で変更が保持**されることを確認。
- **B(Int 付与・入力制約)**: イングリッド選択 → サンシンボルに 3 を入力(`-`/`e`/`.` が入力できないこと・上限 4 を超えられないことを確認)→ 保存 → 比較画面で 3 が表示。
- **C(Boolean 別キャラ)**: C.ヴァイパー選択 → バウンサーステップ ON → 保存 → 詳細表示。
- **D(状態なし)**: ケン選択 → 「キャラ固有状態」セクションが現れない。
- **E(非回帰)**: 既存コンボ(situation=NULL)・独立カラム「状況」・M10 キャラ選択・combo-crud が回帰しない。

---

## §6 レビュー観点

別ファイル `docs/instructions/reviews/M11-01-review-checklist.md`(v1.0.0)を参照。

---

## §7 完了条件(DoD)

- **機能要件**: §1.2 の状態。§5.2 シナリオ A〜E が手動 E2E で通る。
- **自己テスト**: §5.1 全16ケース通過。
- **品質チェック**: 型・lint 通過。独立カラム「状況」・登録系 API・M10 挙動に非回帰。i18n は新系統キーで既存と衝突しない。
- **ドキュメント**: 完了報告に Plan Mode §3.4 結果・推測内容・テストケース数。DES 変更は設計担当が CHANGE-040 で反映済み(製造は DES を直接編集しない)。
- **完了報告**: 実装裁量・乖離・要確認を報告。**実機 E2E が完了の必須ゲート**。

> §5 ↔ §7 リンク: §5.1(16ケース)→ DoD 自己テスト、§5.2 A〜E → DoD 機能要件・実機ゲート。

---

## §9 注意事項

### §9.1 推測 NG(必ず view で確認)

- situation 組立4経路(buildCreatePayload/buildPatchPayload/runPut/initialBasic)の位置 / **PATCH の BE 受け口(`UpdateMetadataRequest`／`UpdateMetadataInput`／repo UPDATE SET への situation 加算、CHANGE-041)** / 付与値の state 保持方式 / 選択キャラ定義の取得配線(useCharacters→find→parse) / Int 入力の既存ゲージ弾き方 / 「キャラ固有状態」fieldset の設置位置と i18n 新系統 / seed マイグレーション番号・UPDATE 方式 / 詳細・比較の表示追加位置 / 未対応 type・状態なしキャラの描画 / situation 既存値の保全マージ。**実装済み/未実装を想定で決めない**(retrospective-digest §1 パターンA)。

### §9.2 推測 OK(裏取り済みの事実)

- スキーマ変更不要(situation/custom_states は TEXT 既存、RESEARCH §0.1)。situation は現状未送信(FU-1)。選択キャラの customStates は useCharacters の戻りに含まれる(FU-3)。code 確定 = `denjin_charge`/`sun_crest`/`limit_decoupler`(D-C-3)。Int 範囲は m11-custom-states-definitions §2。登録系 API は situation 既存 DTO。

### §9.4 Plan Mode 必須項目(§3.4 と同一)

§3.4 の 1〜8 を実 view で確認し、§8.4.2 質問書ファイル方式で報告。

---

*M11-01 製造指示書 v1.0.0。配置 `docs/instructions/M11-01-instruction.md`、対のレビューチェックリストは `docs/instructions/reviews/M11-01-review-checklist.md`(v1.0.0)。CHANGE-040 反映済みを前提に投入する。*
