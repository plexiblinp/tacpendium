# M11-RESEARCH-01 調査結果レポート

| 項目 | 内容 |
|------|------|
| 対応指示書 | M11-RESEARCH-01 v1.0.0 |
| バージョン | 1.0.0 |
| 実施日 | 2026-06-20 |
| 実施モデル | Opus 4.8（開発者判断で昇格、調査担当パターン）|
| 調査担当 | Claude Code セッション |
| 対象コミット | `03213c0`（HEAD）。code-facts は `3e0f4bf` だが `3e0f4bf..03213c0` の差分は docs のみ（コード差分なし）のため code-facts は本調査時点のコードに対し有効 |

> **データ値に関する重要な前提（全数性・正確性のための明示）**: 本リポジトリには稼働中のアプリ DB ファイル（`*.db` / `*.sqlite`）が **存在しない**（`config.toml` の `[database] path = ""`、リポジトリ内 `find` で 0 件。検出された `.db` は `man` キャッシュと Go モジュール `modernc.org/sqlite` のテスト用フィクスチャのみ）。`sqlite3` CLI も未インストール。したがって §1.3 の「現在値」は **稼働中 DB への live SELECT ではなく、マイグレーション seed SQL（golang-migrate が起動時に自動適用する確定ソース）から導出した値**である。id は INSERT 順からの推定（`service_test.go:145` が「AKI = character_id=2」と明記している点と整合）。

---

## 0. 結論サマリ（設計担当が最初に読む、事実集約）

### 0.1 custom_states / situation の物理スキーマ
- `characters.custom_states`: `migrations/000001_init_schema.up.sql:31` で **`custom_states TEXT`（NULL 可、DEFAULT なし）**。CHECK 制約・専用インデックスなし。
- `combos.situation`: `migrations/000001_init_schema.up.sql:71` で **`situation TEXT`（NULL 可、DEFAULT なし）**。CHECK 制約なし。`situation` カラム単体へのインデックスは **なし**（`idx_combos_situation_filter` は `(position, opponent_stance, hit_type)` に張られており、名前に反し situation カラムを含まない。§3 参照）。
- **論理型 vs 物理型**: DES-003 の論理型「JSON」に対し物理は両者とも **TEXT**。code-facts の `*string` 記録と整合（物理が TEXT である事実の追認）。詳細は §0.8 / §1.2。

### 0.2 現存 characters 行と custom_states 現在値（seed 導出、live SELECT 不可）
- 現存キャラ行は **計 8 行**（ryu / aki / jamie / guile / ken / ingrid / c_viper / dhalsim）。
- 先行リリース5体すべて存在: **ryu / ken / ingrid / c_viper / dhalsim**（code はこの通り。`ingrid`・`c_viper`・`dhalsim` の表記注意）。
- 各 custom_states 現在値（seed 導出）:

| code | id（推定） | custom_states 値 | NULL か |
|------|-----------|------------------|---------|
| ryu | 1 | `'{}'`（空オブジェクト、000003） | **非 NULL（空オブジェクト）** |
| aki | 2 | `{"states":[{"code":"poison",...boolean}]}`（000009） | 非 NULL |
| jamie | 3 | `{"states":[{"code":"drunk_level",...composite}]}`（000009） | 非 NULL |
| guile | 4 | `NULL`（000009 で明示 NULL） | NULL |
| ken | 5 | （000014 で custom_states 列を指定せず）→ `NULL` | NULL |
| ingrid | 6 | 同上 → `NULL` | NULL |
| c_viper | 7 | 同上 → `NULL` | NULL |
| dhalsim | 8 | 同上 → `NULL` | NULL |

- **先行リリース5体の NULL 有無（明示）**: ryu = 非 NULL（`'{}'` 空オブジェクト）／ ken = NULL ／ ingrid = NULL ／ c_viper = NULL ／ dhalsim = NULL。
- 背景前提（§0.5）の「状態保有3体」= リュウ / イングリッド / C.ヴァイパーの **3体とも custom_states に状態定義は未投入**（ryu は `'{}'`、ingrid / c_viper は NULL）。状態定義が投入済みなのは先行リリース対象外の **aki / jamie の2体のみ**。

### 0.3 situation API 実態 + custom_states 参照箇所
- `combos.situation` は **生 JSON 文字列のまま素通し（pass-through）**。リクエスト `CreateRequest.Situation *string`（dto.go:35）→ `CreateInput.Situation`（service.go:62, 706）→ `model.Combo.Situation`（combo.go:96）→ INSERT バインド（repository.go:231）→ Scan（repository.go:900）→ `ComboResponse.Situation`（dto.go:143, 327）。途中で JSON パース／構造化／検証は **一切なし**。
- `custom_states` キーをパース／参照／読み出すコードは **バックエンド・フロント横断で 0 件**（`json.Unmarshal`/`Marshal` で situation/custom_states を扱う箇所 0、`"states"` キーをパースする箇所 0、`value_definition` 参照 0）。arch-patterns §9.1「参照されない」を実コードで追認。
- situation / custom_states の **バリデーション規定・実装は 0 件**（service・validation 層に検証なし）。

### 0.4 situation 付与・表示 UI の現状
- **ComboEditor の situation 入力: 実在しない**。`ComboEditor.tsx` / `ComboEditorBasicFields.tsx` / `ComboEditorPage.tsx` に `situation` 参照は 0 件。
- **コンボ詳細の situation（JSON 中身）表示: なし**。`ComboDetailHeader.tsx` の「状況」見出し（i18n `comboDetail.situation.heading`）配下は `position / opponentStance / hitType / opponentSize`（**独立カラム**）を描画し、`combo.situation` JSON は描画しない。
- **コンボ比較の situation（JSON 中身）表示: なし**。`CompareTable.tsx` の `compare.row.situation` 行は `renderSituationTags`（CompareTable.tsx:69）が `position / opponentStance / hitType`（**独立カラム**）を描画し、`combo.situation` JSON は描画しない。
- **code-facts §1 に situation/customStates Props が無い事実の実体**: combo の situation JSON 入力については **(a) 専用コンポーネント不在 かつ (c) 入力自体が未描画**。`situation` フィールドはフロント型（ComboSummary / Combo / CreateComboRequest）に存在するが、読み書き UI は皆無。`customStates?` はキャラ型（characterApi.ts:9）にのみ存在し、読み・描画は 0 件。

### 0.5 phase-1 固定/未消費前提の残存
- situation / custom_states 周辺に `TODO` / `未実装` / `phase2` / `stub` / `固定` / `hardcode` 等のマーカーは **0 件**。
- 特定キャラ固定（リュウ固定等）のハードコード分岐は situation / custom_states 周辺に **なし**（ryu に関する記述は seed コメント `000003:3`「リュウは固有状態を持たない」と `'{}'` 投入のみ）。
- round-trip（保存→取得→再保存）への影響: situation は全層 `*string` 素通しのため、保存値はそのまま返却され、上書き・欠落・無視のロジックは見当たらない（§2.4）。
- コメント vs 現状の差異（事実のみ）: `service_test.go:140` に「ComboEditor のキャラ選択 UI を作らない（閲覧のみ）方針」という M7-04-2 期コメントがあるが、M10-02 で既定キャラ文脈追従（`ComboEditorCharacterField.tsx`）が追加済み。§0.8 に転記。

### 0.6 既存 seed の custom_states 投入実態
- `characters.custom_states` に値を投入する seed は **000003（ryu=`'{}'`）/ 000009（aki=毒 boolean、jamie=酔いレベル composite、guile=NULL）** の2マイグレーション。
- 先行リリース5体の seed への custom_states **状態定義投入は 0**（ryu は空オブジェクト、ken/ingrid/c_viper/dhalsim は列指定なし=NULL）。
- `combos.situation` に値を投入する seed は **0 件**（000012 耐久 seed 含め situation 投入なし）。
- arch-patterns §9.1 の「AKI/ジェイミーの耐久 seed」は 000009 の custom_states（characters 側）を指し、現存・有効（M7-05 でクリアされていない。000014 コメントが「破壊的クリアは M12-02 へ延期、加算のみ」と明記）。

### 0.7 想定外の発見
- **`idx_combos_situation_filter` の対象列が名前と乖離**: インデックス名は "situation_filter" だが、実際の対象列は `(position, opponent_stance, hit_type)` であり `situation` カラムを含まない（000001:207）。situation JSON カラムには一切のインデックスがない。
- **UI 上の "situation/状況" ラベルは独立カラム用**: i18n キー `comboDetail.situation.heading` / `compare.row.situation` / 一覧列 `starterSituation`、および `renderSituationTags` はすべて独立カラム（position 等）を指し、`combos.situation` JSON フィールドとは別物。grep で `situation` を追うと UI 側ヒットの大半がこの独立カラム系である（§3 で分離記録）。

### 0.8 明らかな矛盾の事実指摘
- **論理型 vs 物理型**: DES-003 が `custom_states` / `situation` を論理「JSON」と規定する一方、物理 SQL 宣言は両者とも `TEXT`（000001:31, 000001:71）。アプリ層でも JSON としてのパース・検証はなく `*string` で素通し（解釈は加えない）。
- **コメント vs 現状**: `service_test.go:140`「ComboEditor のキャラ選択 UI を作らない（閲覧のみ）方針」というコメントに対し、M10-02 で `ComboEditorCharacterField.tsx`（キャラ選択フィールド）が実装済み。コメントが現状より古い（事実のみ。解消方針は含めない）。
- 上記以外で situation / custom_states に関するコメント vs ロジックの矛盾は検出されず。

---

## 1. custom_states / situation の保存・API・データ現状

### 1.1 横断 grep の全ヒット一覧（領域別、対象/対象外の区別）

snake_case（`custom_states` / `situation`）+ camelCase（`CustomStates` / `customStates` / `Situation` / `situation`）+ 部分一致（`custom_state` / `customState`）の全系統で実行。**対象 = custom_states 本体 / situation JSON 本体**。**対象外 = §4.3 の別シンボル**。

#### バックエンド Go（custom_states 系、全件 = 対象）
| ファイル:行 | 内容 |
|------------|------|
| `internal/model/character.go:5,15` | `CustomStates *string \`db:"custom_states" json:"customStates,omitempty"\`` + godoc |
| `internal/model/doc.go:14` | JSON カラム列挙コメント（situation, recipe_cache, custom_states, combo_scaling, raw_data） |
| `internal/repository/character/repository.go:12,55,63,67,68` | `listByGameSQL` の SELECT 列 + `sql.NullString` スキャン + `if customStates.Valid` で `*string` 詰め |
| `internal/infra/migration/migrate_test.go:313-317` | M7-04-2 マイグレーションテスト（aki/jamie 非 NULL、guile NULL、json_valid） |
| `internal/service/combo/service_test.go:140,143` | 非リュウ（AKI=2）作成パスのテスト + コメント |

#### バックエンド Go（situation 系、全件 = 対象）
| ファイル:行 | 内容 |
|------------|------|
| `internal/model/combo.go:81,96` | `Situation *string \`db:"situation" json:"situation,omitempty"\`` + JSON カラムコメント |
| `internal/api/combo/dto.go:35` | `CreateRequest.Situation *string`（// JSON 文字列） |
| `internal/api/combo/dto.go:143` | `ComboResponse.Situation *string` |
| `internal/api/combo/dto.go:245` | `Situation: req.Situation`（CreateInput へ） |
| `internal/api/combo/dto.go:327` | `Situation: combo.Situation`（ComboResponse へ） |
| `internal/service/combo/service.go:62,706` | `CreateInput.Situation *string` + `model.Combo` へ詰め |
| `internal/repository/combo/repository.go:203,231,283,323,465,782,900,1016` | INSERT/UPDATE 列名（203 等）、INSERT バインド（231）、Scan（900） |
| `internal/model/setup.go:19` | 「setup は situation を持たない」コメント（**対象外参考**、setup には situation なし） |

#### フロント TS/TSX
| ファイル:行 | 内容 | 区分 |
|------------|------|------|
| `web/src/features/combo/types.ts:54` | `ComboSummary.situation?: string` | 対象（situation 型） |
| `web/src/features/combo/types.ts:127` | `Combo.situation?: string \| null` | 対象 |
| `web/src/features/combo/types.ts:159` | `CreateComboRequest.situation?: string \| null` | 対象 |
| `web/src/features/character/api/characterApi.ts:9` | `Character.customStates?: string` | 対象（customStates 型、唯一の宣言。読み・描画 0） |
| `web/src/features/combo/components/CompareTable.tsx:69,213,214` | `renderSituationTags` / `compare.row.situation` 行 | **対象外**（独立カラム描画。situation JSON 不参照） |
| `web/src/features/combo/components/ComboDetailHeader.tsx:54,59,65,71,77` | `comboDetail.situation.*` 見出し・項目 | **対象外**（独立カラム描画） |
| `web/src/constants/combo-list.ts:46,55,67` | `starterSituation` 列定義 | **対象外**（一覧列、独立カラム由来） |
| `web/src/features/combo/components/ComboTable.tsx:102` / `ComboTableRow.tsx:85` | `visibility.starterSituation` | **対象外** |
| `web/src/locales/{ja,en}.json` | `situation` 各 i18n キー | **対象外**（独立カラム/列見出しラベル） |
| `*.test.tsx`（ColumnVisibilityMenu / ComboListFilters / useColumnVisibility） | `starterSituation` テスト | **対象外** |

#### マイグレーション SQL（対象）
| ファイル:行 | 内容 |
|------------|------|
| `migrations/000001_init_schema.up.sql:31` | `custom_states TEXT,  -- JSON、NULL 可` |
| `migrations/000001_init_schema.up.sql:71` | `situation TEXT,  -- JSON、その他柔軟前提条件` |
| `migrations/000001_init_schema.up.sql:207` | `idx_combos_situation_filter ON combos(position, opponent_stance, hit_type)`（**situation 列を含まない**） |
| `migrations/000003_seed_characters.up.sql:3,5` | ryu custom_states=`'{}'` 投入 |
| `migrations/000009_seed_characters_aki_jamie_guile.up.sql:7,11,13,14,18,(20)` | aki/jamie custom_states 投入、guile NULL |
| `migrations/000012_seed_combos_durability.up.sql:3` | コメントで custom_states 言及（実 INSERT には situation/custom_states 値投入なし） |

#### seed / テスト / i18n / ドキュメント
- seed: 上記 000003 / 000009（characters.custom_states）。combos.situation 投入 0。
- テスト: migrate_test.go / service_test.go（上記）。フロントは `starterSituation`（対象外）のみ。
- i18n: `situation` キーは独立カラム用ラベル（対象外）。
- ドキュメント（docs/ 配下）: 多数ヒットするが本調査の §2.3「変更しないもの」かつ設計書本体規定として扱い、コード事実の対象外。

### 1.2 物理スキーマ（マイグレーション SQL）
- `characters.custom_states`: `TEXT`、NULL 可、DEFAULT なし（000001:31）。CHECK 制約・インデックスなし。
- `combos.situation`: `TEXT`、NULL 可、DEFAULT なし（000001:71）。CHECK 制約なし。
- インデックス: `combos` には `idx_combos_situation_filter`（000001:207）が存在するが対象列は `(position, opponent_stance, hit_type)`。**`situation` カラム・`custom_states` カラムに対するインデックスは 0 件**。
- **論理型 vs 物理型の一致/乖離**: DES-003 の論理型「JSON」に対し物理は両者 `TEXT`（SQLite は JSON 型を持たず TEXT で保持、000001:10 コメント「JSON は TEXT で保持する」が明示）。code-facts の `*string` と整合。

### 1.3 現存 characters 行と custom_states 現在値（seed 導出。live SELECT は DB 不在のため実行不可）

`SELECT id, code, name_ja, custom_states FROM characters ORDER BY id` 相当を seed から再構成（id は INSERT 順推定、`service_test.go:145` の「AKI=2」と整合）:

| id（推定） | code | name_ja | custom_states | seed 出所 |
|-----------|------|---------|---------------|-----------|
| 1 | ryu | リュウ | `'{}'` | 000003 |
| 2 | aki | AKI | `{"states":[{"code":"poison","name_ja":"毒","name_en":"Poison","subject":"opponent","scope":"persistent","type":"flag","value_definition":{"kind":"boolean"}}]}` | 000009 |
| 3 | jamie | ジェイミー | `{"states":[{"code":"drunk_level","name_ja":"酔いレベル","name_en":"Drunk Level","subject":"self","scope":"persistent","type":"composite","value_definition":{"kind":"object","fields":[{"code":"level","kind":"integer","min":0,"max":4},{"code":"unlocked_moves","kind":"string_list"}]}}]}` | 000009 |
| 4 | guile | ガイル | `NULL` | 000009（明示 NULL） |
| 5 | ken | ケン | `NULL` | 000014（列指定なし） |
| 6 | ingrid | イングリッド | `NULL` | 000014 |
| 7 | c_viper | C.ヴァイパー | `NULL` | 000014 |
| 8 | dhalsim | ダルシム | `NULL` | 000014 |

- 件数: **8 行**。先行リリース5体すべて存在（ryu/ken/ingrid/c_viper/dhalsim）+ 対象外 aki/jamie/guile。
- 先行リリース5体の custom_states NULL 有無: ryu=非 NULL（`'{}'`）／ ken/ingrid/c_viper/dhalsim=NULL。
- 非 NULL の JSON 構造の DES-003 §3.2 構造（`states[].code/name_ja/name_en/subject/scope/type/value_definition`）への適合（事実のみ）:
  - aki: `states[0]` に `code/name_ja/name_en/subject/scope/type/value_definition` の全キーを含む（type=flag, value_definition.kind=boolean）。
  - jamie: 同様に全キーを含む（type=composite, value_definition.kind=object + fields 配列）。
  - ryu: `'{}'` は `states` キーを持たない空オブジェクト。

### 1.4 situation の API serialize/deserialize + custom_states 参照箇所
- **リクエスト経路**: `CreateRequest.Situation *string`（dto.go:35, `omitempty`）。`c.Bind` 後、`req.Situation` をそのまま `CreateInput.Situation`（dto.go:245）へ代入。service（service.go:706）で `model.Combo.Situation` へ代入。repository（repository.go:231）で INSERT プレースホルダにそのままバインド。**raw 文字列のまま保存（JSON パースなし）**。
- **レスポンス経路**: repository.go:900 で `&c.Situation` に Scan → dto.go:327 で `ComboResponse.Situation = combo.Situation`。**raw 文字列のまま返却（構造化なし）**。
- **custom_states キーをパース/参照/読み出す箇所**: バックエンド・フロント横断で **0 件**。`json.Unmarshal`/`Marshal` で situation/custom_states を扱う箇所 0、`"states"` パース 0、`value_definition`/`valueDefinition` 参照 0。
- **DES-006 バリデーション**: situation / custom_states を検証する規定・実装は **0 件**（service / validation 層で検出なし）。

### 1.5 フロント型・hooks・API クライアント
- 型定義（`web/src/features/combo/types.ts`）: `ComboSummary.situation?: string`（54）／ `ComboDetail`（72 で ComboSummary 継承、situation 継承）／ `Combo.situation?: string | null`（127）／ `CreateComboRequest.situation?: string | null`（159）。
- `customStates?`: `web/src/features/character/api/characterApi.ts:9` の `Character` 型にのみ存在（`customStates?: string`）。combo 型群には `customStates` フィールドなし。
- `customStates?` を **読む/描画する箇所: 0 件**（型宣言のみ。キャラ API 取得後に参照する UI はなし）。arch-patterns §9.1「未使用」を追認。
- `situation` をフロントで扱う箇所: 型宣言以外では **読み書き UI 0 件**。CompareTable / ComboDetailHeader のヒットは独立カラム（§3）であり `situation` JSON 文字列を parse/描画しない（string のまま扱う箇所すらない）。

### 1.6 既存 seed の custom_states 投入実態
- characters.custom_states 投入: 000003（ryu=`'{}'`）/ 000009（aki=毒 flag/boolean、jamie=酔いレベル composite/object、guile=NULL）。
- 先行リリース5体への状態定義投入: **0**（ryu=空オブジェクト、ken/ingrid/c_viper/dhalsim=NULL、いずれも states 未投入）。
- combos.situation 投入 seed: **0 件**（000012 耐久 seed のコメントは custom_states 言及のみで situation 値投入はなし）。
- 000009 の aki/jamie custom_states は現存・有効（000014 コメントが「旧 seed の破壊的クリアは行わず加算のみ、破壊的再生成は M12-02 へ延期」と明記、M7-05 でのクリアなし）。

---

## 2. situation 付与・表示 UI の現状

### 2.1 ComboEditor の situation 入力（DES-005 §5.7 表示項目5）
- **実在: なし**。`ComboEditor.tsx` / `ComboEditorBasicFields.tsx` / `ComboEditorCharacterField.tsx` / `ComboEditorPage.tsx` に `situation` 参照は 0 件。
- 実装方式: 該当なし（汎用テキスト入力も構造化入力も存在しない）。state 機構（react-hook-form defaultValues / 局所 state）にも situation は含まれない。
- **code-facts §1 に Props がない事実の実体**: combo の situation 入力については **(a) situation 専用コンポーネント不在 かつ (c) 入力自体が未描画**。型（types.ts）には `situation?` が存在するが、ComboEditor 系の JSX に入力要素はない。
- 位置関係: DES-005 §5.7 表示項目5 のうち、`position / opponentStance / hitType / opponentSize`（独立カラム）は ComboEditorBasicFields 等で描画される一方、`situation`（JSON 固有状態）のみ未描画。`drive_available_at_start` / `sa_available_at_start` も独立カラムとして別途扱い（§3）。→ **表示項目5 のうち situation だけが未描画**。

### 2.2 コンボ詳細の situation 表示（DES-005 §5.6 表示項目4）
- **situation（JSON の中身）表示: なし**。`ComboDetailHeader.tsx` に「状況」見出し（`comboDetail.situation.heading`、:54）はあるが、配下の `<dl>` は `position`（:61）/ `opponentStance`（:67）/ `hitType`（:73）/ `opponentSize`（:79）= 独立カラムを描画。`combo.situation` JSON フィールドを読む箇所はない。
- 実装: 該当なし（raw 文字列表示も構造化表示も存在しない）。

### 2.3 コンボ比較画面の situation
- **situation（JSON）表示行: なし**。`CompareTable.tsx:213` に `compare.row.situation` 行はあるが、`render: renderSituationTags`（:214）→ `renderSituationTags`（:69-93）は `position`（:71）/ `opponentStance`（:74）/ `hitType`（:77）= 独立カラムをタグ描画。`combo.situation` JSON は参照しない。

### 2.4 phase-1 固定/未消費前提の残存（前向き注意 M10-2/M10-5）
- 特定キャラ固定（リュウ固定等）のハードコード・分岐: situation/custom_states 周辺に **なし**（ryu 関連は 000003 seed コメント「リュウは固有状態を持たない」+ `'{}'` 投入のみ）。
- 未消費/未描画前提の条件分岐・スタブ・「未実装/TODO/phase2」コメント: situation/custom_states 周辺に **0 件**。
- round-trip（保存→取得→再保存）への影響: situation は全層 `*string` 素通しで、保存値がそのまま返却される。situation を上書き・欠落・無視する処理は検出されず（dto.go/service.go/repository.go の経路上、欠落時は `omitempty`/NULL 許容で透過）。
- コメント vs 現状（事実のみ）: `service_test.go:140` の「ComboEditor のキャラ選択 UI を作らない（閲覧のみ）方針」コメントは M7-04-2 期のもので、M10-02 で `ComboEditorCharacterField.tsx`（キャラ選択）が実装済み（§0.8 と重複記載、解釈は加えない）。

---

## 3. 調査対象外シンボルとの区別

§4.1.1 の grep で同時ヒットしたが custom_states / situation JSON と **別物**のシンボル:

| シンボル | 出所 | 区分 |
|---------|------|------|
| `combos.oki_meaty_*` / `oki_shimmy_*`（6 BOOLEAN） | 000001:73-78、model/combo.go、dto.go、types.ts OkiBooleans、CompareTable renderOkiCell | **別物**（起き攻め BOOLEAN群、CHANGE-001。custom_states ではない） |
| `combos.position` / `opponent_stance` / `hit_type` / `opponent_size` | 000001:67-70、独立カラム | **別物**（独立カラム化済み状況。UI の "situation/状況" ラベルはこれらを描画。situation JSON の外） |
| `combo_steps.modifiers` | model/combo step、types.ts Modifiers | **別物**（ステップ修飾） |
| `combos.drive_available_at_start` / `sa_available_at_start` | 000001:63-64、dto.go、types.ts | **別物**（開始残量の独立カラム。situation ではない） |
| `idx_combos_situation_filter` | 000001:207 | 名称に "situation" を含むが対象列は `(position, opponent_stance, hit_type)`。**situation カラムを含まない**（§0.7 想定外の発見） |
| `starterSituation` / `compare.row.situation` / `comboDetail.situation.*` | フロント i18n・列・render 名 | **別物**（独立カラム由来の UI ラベル。`combos.situation` JSON フィールドではない） |
| `model.Setup`（setup.go:19） | 「situation を持たない」コメント | setup は situation を保持しない（**対象外**） |

---

## 4. 関連ドキュメント

| ID / パス | 参照箇所 | 本調査での用途 |
|-----------|---------|----------------|
| 指示書 M11-RESEARCH-01 | §4 調査内容 / §5 フォーマット | 本レポートの根拠 |
| `migrations/000001_init_schema.up.sql` | :31, :71, :207 | custom_states/situation 物理スキーマ・インデックス |
| `migrations/000003_seed_characters.up.sql` | 全体 | ryu custom_states=`'{}'` |
| `migrations/000009_seed_characters_aki_jamie_guile.up.sql` | 全体 | aki/jamie custom_states 値、guile NULL |
| `migrations/000014_seed_characters_classic5.up.sql` | 全体 | ken/ingrid/c_viper/dhalsim（custom_states 未投入=NULL） |
| `internal/model/character.go` / `combo.go` | character:15 / combo:96 | Go フィールド・JSON タグ・物理 `*string` |
| `internal/api/combo/dto.go` | :35,143,245,327 | situation の DTO 素通し |
| `internal/service/combo/service.go` | :62,706 | CreateInput.Situation 素通し |
| `internal/repository/combo/repository.go` | :231,900 | situation INSERT/Scan |
| `internal/repository/character/repository.go` | :12,55-68 | custom_states SELECT/Scan |
| `internal/api/character/handler.go` | :16,45 | `CharacterListResponse{Items []model.Character}`（customStates を JSON タグ経由で raw 返却） |
| `web/src/features/combo/types.ts` | :54,127,159 | situation フロント型 |
| `web/src/features/character/api/characterApi.ts` | :9 | customStates? 唯一の宣言 |
| `web/src/features/combo/components/ComboDetailHeader.tsx` | :54-79 | 「状況」見出しは独立カラム描画 |
| `web/src/features/combo/components/CompareTable.tsx` | :69-93,213-214 | situation 行は独立カラム描画 |
| DES-003 §3.2 / §3.x | 設計書本体 | custom_states/situation 論理型「JSON」規定（物理 TEXT と比較） |
| DES-005 §5.6 / §5.7 | 設計書本体 | 表示項目4/5（situation 表示・入力の規定 vs 実装不在） |
| `docs/handover/architecture-patterns.md` §9.1 / §6 | 現状記述・調査運用 | 「保存/API のみ・参照なし・customStates 未使用」の追認 |
| `docs/handover/code-facts.md` §1/§7-2/§8 | 現状記述 | `*string` 物理型・Props 不在の追認 |

---

## 6. 補足調査 FU-1〜FU-4（追加依頼、2026-06-20）

> 本章は M11-RESEARCH-01 完了後の追加調査依頼（FU-1〜FU-4）への回答。read-only / judgement-free を継続。ComboEditor のフォーム機構・状況入力群の描画構造・選択キャラの custom_states 取得経路・詳細/比較の状況セクション構造を事実列挙する（custom_states 付与/表示 UI の「設置先候補」は構造事実として位置を示すのみで、設計判断・推奨は含めない）。

### FU-1. ComboEditor のフォーム状態機構・onSubmit での CreateComboRequest 組立

- **状態機構 = 局所 `useState`（react-hook-form は不使用）**。`ComboEditor.tsx:68` `const [basic, setBasic] = useState<BasicFieldsValue>(() => initialBasic(initial, initialCharacterId))`。レシピは別 state `const [steps, setSteps] = useState<Step[]>`（:71）、セットプレイ等も個別 useState。フォームライブラリのインポートはなし（react-hook-form / Controller の参照 0）。
- **フォーム値型 = `BasicFieldsValue`**（`ComboEditorBasicFields.tsx:22-37`、`extends OkiBooleans`）。保持フィールド: `characterId / isDraft / damage / starterMoveId / position / opponentStance / hitType / opponentSize / driveAvailableAtStart / saAvailableAtStart / driveDamage / knockdownAdvantage / memo / tagIds` + 起き攻め6 BOOLEAN。**`situation` フィールドは BasicFieldsValue に存在しない**（`custom_states` 相当も無し）。
- **defaultValues 構築箇所 = `initialBasic()`**（`ComboEditor.tsx:523-583`）。`new` モード（initial なし）はハードコード初期値を返す（:528-549、situation キーなし）。`edit`/`copy`（initial: ComboDetail）は initial の各フィールドをマップ（:551-582）するが、**`initial.situation` はマップされない**（ComboDetail には `situation?` が存在するが initialBasic で読み出していない）。
- **onSubmit 経路**: 保存ボタン `onClick={onSave}`（:437）→ `onSave()`（:190）→ `buildCreatePayload()`（:144-171）が `CreateComboRequest` を組立。**`buildCreatePayload` の object literal に `situation:` キーは存在しない**（:145-171 を全行確認）。したがって `CreateComboRequest.situation` は **undefined（キー不在）** で送信され、バックエンド `omitempty` により NULL 保存となる（現状 situation は一度も送られない）。
  - PATCH 経路 `buildPatchPayload()`（:173-188、`UpdateMetadataRequest`）にも `situation` キーなし。
  - PUT 経路 `runPut()`（:305-318）は `{...buildCreatePayload(), version, setupCarryOptions}` のため、同じく situation キーなし。
- **custom_states 値を situation に載せる組立位置の特定（構造事実）**: `CreateComboRequest` が組み立てられる唯一の箇所は `buildCreatePayload()`（`ComboEditor.tsx:144`）。ここに `situation:` キーを追加する形になる。値の供給元となる state は現状存在しない（BasicFieldsValue にフィールドなし、専用 useState なし）。

### FU-2. 状況入力フィールド群（独立カラム）の描画コンポーネント

- **該当ファイル**: `web/src/features/combo/components/ComboEditorBasicFields.tsx`（単一の関数コンポーネント `ComboEditorBasicFields`）。
- **構造**: コンポーネント内に複数 `<fieldset>`（legend + grid のパターン）— 「基本情報」(:82-225) / 「起き攻め」(:227-243) / 「メモ」(:245-254) / 「マイコンボ」(:256-265) / 「タグ」(:267-276) / 「仮登録モード」(:278-288)。
- **独立カラム4項目の描画**: いずれも「基本情報」fieldset 内の `grid grid-cols-2` 中の `<select>`:
  - `position`（:98-111「ポジション」、`POSITION_OPTIONS`）
  - `opponentStance`（:113-126「相手の状態」、`OPPONENT_STANCE_OPTIONS`）
  - `hitType`（:128-141「ヒット種別」、`HIT_TYPE_OPTIONS`）
  - `opponentSize`（:143-156「相手の大きさ」、`OPPONENT_SIZE_OPTIONS`）
  - 各 `<select>` は `value={value.position}` 等 + `onChange={(e)=>set("position", e.target.value)}`。
- **Props**: `value: BasicFieldsValue` / `moves: Move[]` / `movesLoading: boolean` / `autoStarterMoveId: number|null` / `onChange: (next: BasicFieldsValue)=>void` / `onCreateTag?` / `tagCreating?`（:39-47）。
- **責務 = 値の読み書きは親委譲（controlled component）**。本コンポーネントは独立カラム4項目に関する **自前 state を持たない**。読みは `value` prop、書きは `set(key, v)`（:58-59）→ `onChange({ ...value, [key]: v })` を通じ親へ委譲。state の実体は親 `ComboEditor` の `basic`/`setBasic`（useState）。コンポーネント内の局所 state は `useMyComboStatusTags` 由来のマイコンボ用 `useMemo` のみで、基本情報フィールドには関与しない。
- **custom_states 付与 UI を隣接配置する場所（構造事実）**: 独立カラム4項目は「基本情報」fieldset の grid 内に並ぶ。同 fieldset 内の隣接配置、または「基本情報」と「起き攻め」の間への新規 `<fieldset>`（legend + grid のパターンに倣う）追加が構造上の選択肢。配置に伴い BasicFieldsValue への新フィールド追加 + `set()` 経由の親委譲が必要となる（CLAUDE.md §4「ComboSummary/ComboDetail/Combo の3 interface への追加」運用とも関連）。判断・推奨は加えない。

### FU-3. 選択キャラの custom_states 定義の取得経路

- **API レスポンスでの raw 返却**: `characterApi.list(gameId)`（`characterApi.ts:16-21`）→ `GET /api/games/{gameId}/characters` → `CharacterListResponse.items: Character[]`。`Character` 型は `customStates?: string`（:9）を含む。バックエンドは `CharacterListResponse{Items []model.Character}`（handler.go:16,45）で `model.Character` を直返しするため、**`customStates` は raw JSON 文字列として API レスポンスに含まれる**（主報告 §1.4 と整合）。
- **運ぶフック = `useCharacters`**（`useCharacters.ts:9-14`）: TanStack Query `useQuery`、**queryKey = `["characters", { gameId }]`**、queryFn = `characterApi.list(gameId)`、`gameId` 既定 = `DEFAULT_GAME_ID = 1`（:7）。戻り値 `data: Character[]` には **customStates が含まれる**（型・queryFn で stripping なし）。
- **`useCharacterName`**（`useCharacters.ts:16-22`）: `useCharacters()` から `characters.find(c=>c.id===characterId)?.nameJa` のみを返す。**customStates は捨てられる**（name のみ surface）。
- **単体取得フックの不在**: `useCharacter(id)` のような単一キャラ取得フックは存在しない（grep 0 件、`useCharacters` のみ）。per-character の queryKey もなし。
- **ComboEditor から選択中 characterId の custom_states を取得できるか**: ComboEditor は選択中キャラを `basic.characterId` で保持し、`ComboEditorCharacterField` 経由で `useCharacterName`（名前のみ）を使う。**現状、選択キャラの customStates を読み出す消費者は ComboEditor 内に存在しない**。ただしデータ自体は既存クエリ `useCharacters()`（queryKey `["characters",{gameId}]`）の戻り `Character[]` に含まれており、`characters.find(c=>c.id===basic.characterId)?.customStates` で到達可能（現状そのコードは無い）。
- **動的トグル/数値入力の描画データソース**: 現状そのデータソースは未配線。customStates（`states[].type` = flag/composite、`value_definition`）をパースする箇所は 0 件（主報告 §1.4）。動的描画の入力となる構造化データを生成するコードは存在しない。

### FU-4. 詳細・比較の「状況」セクション構造

- **ComboDetailHeader（詳細）**: `<h3>` 見出し `t("comboDetail.situation.heading")`（"状況"、:53-55）→ `<dl className="grid grid-cols-2 md:grid-cols-4 ...">`（:56）内に 4 つの `<div><dt><dd>`: position(:57-62) / opponentStance(:63-68) / hitType(:69-74) / opponentSize(:75-80)。各 `<dd>` = `labelFor(XXX_LABELS, combo.xxx)`。`combo.situation`（JSON）は不参照。
  - i18n（ja.json:74-80）: `comboDetail.situation.{ heading:"状況", position:"ポジション", opponentStance:"相手スタンス", hitType:"ヒット種別", opponentSize:"相手サイズ" }`。en.json も同構造（heading="Situation" 他）。
- **CompareTable（比較）**: `rows: RowDef[]`（型 `{labelKey:string; render:(combo:ComboDetail)=>ReactNode}`、:188-191）の配列要素として状況行を定義。
  - `{ labelKey:"compare.row.starterSituation", render: formatStarterStatus }`（:194-197）
  - `{ labelKey:"compare.row.situation", render: renderSituationTags }`（:212-215）→ `renderSituationTags`（:69-93）は position/opponentStance/hitType を独立カラムからタグ描画。`combo.situation` JSON は不参照。
  - i18n（ja.json:149-160）: `compare.row.{ starterSituation:"始動状況", route, damage, situation:"状況", knockdownAdvantage, okiNeutralTech, okiBackTech, setups, tags, memo }`。
- **custom_states 表示行を追加する場所（構造事実）**: 詳細は `ComboDetailHeader.tsx` の `<dl>` への項目追加、または新規 `<h3>` + セクション。比較は `CompareTable.tsx` の `rows` 配列への新 `RowDef`（labelKey + render）追加。
- **独立カラム用ラベルとの命名衝突回避の材料（事実）**: 文字列 "situation"/"状況" の i18n キーは **既に独立カラム用に占有済み** — `comboDetail.situation.heading`（詳細見出し "状況"）/ `compare.row.situation`（比較行 "状況"、中身は position 等）/ `compare.row.starterSituation`（"始動状況"）/ `comboList.column.starterStatus`（一覧列、主報告 §3）。`combos.situation` JSON フィールド（= custom_states 値の格納先、主報告 §0.1）を表示する新ラベルを追加する場合、これら既存「状況」系キーと表記・キー名が衝突しうる（事実の指摘のみ。命名解決方針は含めない）。

---

## 7. 調査担当からの完了宣言

本調査（初回 §1〜§4 + 追加 FU-1〜FU-4 §6）は **read-only 厳守**（コード・設計書・既存テスト・DB に一切変更を加えず、書き込みは本レポート `docs/progress/M11-RESEARCH-01-report.md` の作成・追記のみ。稼働 DB が不在のため SELECT は実行できず、データ現在値は seed マイグレーションから導出した旨を §1.3・冒頭注記に明示）で実施した。

調査結果は **judgement-free（事実列挙のみ）** で記録し、設計判断・実装方針・推奨は含めていない。§0.7 想定外の発見・§0.8 明らかな矛盾は事実として記録した。FU 章の「設置先候補」も構造事実として位置を示すのみで、配置・命名の決定は設計担当に委ねる。grep は snake_case / camelCase / 部分一致の全系統で実行し、ヒット 0 件の領域（custom_states 参照箇所、situation/custom_states バリデーション、combos.situation seed、ComboEditor の situation 入力・react-hook-form 等）は「0 件であった」と明示した。

設計担当は本レポートを M11 付与 UI 設計・定義投入スコープ確定・CHANGE-040 判断の材料として利用されたい。本調査セッションをここで閉じる。

*以上、M11-RESEARCH-01 調査結果レポート v1.0.0（FU-1〜FU-4 追記済み）*
