# 指示書 M16-01: ドライブゲージ始動残量の小数化（`combos.drive_available_at_start` INTEGER→REAL・G-g）

| 項目 | 内容 |
|------|------|
| 指示書ID | M16-01 |
| マイルストーン | M16（データモデル拡充・スキーマの継ぎ目・§6 承認ゲート） |
| バージョン | 1.0.0 |
| 作成者・作成日 | 設計担当 Claude（フェーズ3 継続担当・M16 期）/ 2026-07-05 |
| 実装モデル | **Opus 4.8 ＋ Plan Mode 必須** / レビュー Sonnet 4.6（model-allocation v1.29.0） |
| 承認ゲート | **G-g**（phase3-overview v1.1.2 §2.4）＝**着手前に開発者の個別承認を得てからマイグレ実装に入る** |
| 上位文書 | M16-overview v1.0.0（`docs/instructions/phase3/M16-overview.md`）§2.1/§4.2/§6 |
| 関連 | phase3-overview v1.1.2 §2.4 G-g / §M16 ② / combmgr-friend-feedback-datamodel-issues 論点② / DES-003 §3.4 / 前例=マイグレ 000016 `change_drive_damage_to_real`（CHANGE-046・M12-03） |

> **文書ID ⇄ 実パスの正は `docs/handover/docs-map.md`（自動生成）**。本書は docs-map 準拠の実パスを併記する。

## 更新履歴

| 版 | 更新日 | 更新内容 |
|----|--------|----------|
| 1.0.0 | 2026-07-05 | 初版。G-g＝`combos.drive_available_at_start` を INTEGER→REAL 化（widget 0.5 刻み・combo↔sequence 粒度統一）。 |

---

## 1. 背景と目的

### 1.1 背景

M16 は datamodel-issues ①〜④の「放置すれば破壊的移行になるスキーマの穴」を承認ゲート付きで埋めるクラスタ。本サブ **M16-01（ゲート G-g）** は論点②に対応する。

- `combos.drive_available_at_start`（コンボ開始時点のドライブゲージ残量）は現状 **INTEGER（0〜6 の整数管理）**。一方、連携技（pressure-sequence）側のドライブ増減は小数で設計されており、**combo=整数／sequence=小数の内部不整合**がある（datamodel-issues 論点②）。SF6 のドライブゲージは本来連続値（用語定義「残り 0.1 本」）で、上位プレイヤーの資源管理は 0.5 本単位で効く。
- 本サブは `drive_available_at_start` を **REAL** へ寄せ、combo↔sequence の粒度を揃える。入力は**ゲージ widget の 0.5 刻み**に限定する（自由な小数直打ちはしない＝軽快さを保つ・開発者確定 2026-07-05）。
- **始動残量は FR301 重複判定キーの対象外**（datamodel-issues 論点②・DES-006 §2.3 主要項目に非該当）のため、**重複判定への波及は無い**（blast radius 小）。
- 型変更の前例＝**マイグレ 000016 `change_drive_damage_to_real`**（`combos.drive_damage` を INTEGER→REAL・CHANGE-046/M12-03）。同一テーブル・同一手法（テーブル再構築）で実績があり、本サブはこれを踏襲する。

### 1.2 目的

- `combos.drive_available_at_start` を **INTEGER→REAL** 化する破壊的マイグレ（**000019**）を、000016 の非破壊テーブル再構築技法で作成する。既存整数値は REAL へ無損失昇格。
- データ層（`model.Combo` / combo DTO / repository）・入力 UI（ゲージ widget 0.5 刻み）・検証（DES-006）・CSV 往復（意味単位・後方互換）を追従する。
- `*int`→`*float64`（TS は `number`）の型変更を、全消費経路で漏れなく反映する。

### 1.3 このマイルストーンで作らないもの（スコープ外）

- **① ゲージ消費列（SA/drive 消費）の追加**＝**M16-02（G-f）**。本サブは始動残量の型変更のみ。消費列は足さない。
- **③ 起き攻め正規化**＝**M16-03（G-h）**。
- **④ taxonomy・移動 move 化・dash 一本化**＝**M16-04（G-i）**。
- **全キャラ seed 投入**＝M14-03b（M16 後）。
- `sa_available_at_start` の型変更は**しない**（SA 始動は 0〜3 の整数管理のまま。消費列は M16-02）。
- 入力 UI の 0.5 刻み以外の刻み（0.1 等）の自由入力は**設けない**（widget 刻み固定）。

---

## 2. 成果物

### 2.1 作成するファイル

- `migrations/000019_change_drive_available_at_start_to_real.up.sql` / `.down.sql`（命名は既存連番規約に合わせる。実配置は code-facts §10 に従う。**000016 のファイルを技法の手本として view**）。

### 2.2 修正するファイル（code-facts 由来の想定接地点・**Plan Mode で全数確認**）

- **Go model**: `internal/model/combo.go` の `Combo.DriveAvailableAtStart` を **`*int`→`*float64`**（db:drive_available_at_start, json:driveAvailableAtStart,omitempty）。**前例＝同構造体の `DriveDamage *float64`**（既に REAL）。
- **Go DTO**（`internal/api/combo/dto.go`）:
  - `ComboResponse.driveAvailableAtStart` を `*int`→`*float64`。
  - `CreateRequest.driveAvailableAtStart` を `*int`→`*float64`。
  - `UpdateMetadataRequest.driveAvailableAtStart` を `comborepo.Optional[int]`→`comborepo.Optional[float64]`（**前例＝同 DTO の `driveDamage comborepo.Optional[float64]`**）。
- **Go repository**（`internal/repository/combo/repository.go`）: `UpdateMetadataInput.DriveAvailableAtStart` を `Optional[int]`→`Optional[float64]`。`DuplicateKey` は **drive_available_at_start を含まない**ため不変（dup 非対象の裏付け）。combos の SELECT/INSERT/UPDATE のスキャン先・列を `float64` へ追従。
- **FE 型**: TypeScript の combo 型定義（`web/src/features/combo/types.ts` 等・Plan Mode で所在特定）の `driveAvailableAtStart` は既に `number`（TS は int/float 区別なし）だが、**入力・表示で小数を許容**するよう追従（`ComboSummary`/`ComboDetail`/`Combo` 3 型＝CLAUDE.md §4 の型分岐運用に注意）。
- **FE 入力 widget**: ドライブ始動残量の入力欄（test-id `combo-editor-drive-available`＝M15-01・Input number）を **0.5 刻み**（`step=0.5`・`min=0`・`max=6`）へ。**前例＝`drive_damage` の小数入力 UI**（DES-005 §5.7・ラベル「(-6.0〜6.0)」・CHANGE-046/M12-03）。zod スキーマ（第一防衛線）を整数→小数（0〜6）へ。
- **FE 表示**: 一覧/詳細/比較で drive 始動残量を小数表示（整数値は従来通り・0.5 は「2.5」等）。比較画面（DES-005 §5.8）の該当行が小数を崩さず表示。
- **CSV export/import**（`comboio`・意味単位）: `drive_available_at_start` の往復を小数対応（後方互換＝§4.5）。

### 2.3 変更しないもの（原則）

- `sa_available_at_start`（INTEGER 0〜3・M16-02 でも型は変えない）。
- `DuplicateKey`・VAL-C02（重複判定）＝drive 始動残量は非対象（回帰確認のみ）。
- 起き攻め 6 bool・drive_damage・knockdown_advantage 等の他 combos 列。
- combo_steps・レシピ・recipe_cache（drive 始動残量はレシピに含まれない＝recipe_cache 非対象）。

### 2.4 例外条項

- code-facts と実コードに差があれば**実コードを正**とし、相違を完了報告に記録（記憶で進めない・playbook §4.1）。

---

## 3. 前提条件

### 3.1 必読ドキュメント

- M16-overview v1.0.0（`docs/instructions/phase3/M16-overview.md`）§2.1/§4.2/§6。
- DES-003（`docs/design/03-data-model.md`）§3.4 combos（`drive_available_at_start` INTEGER 0〜6・「範囲は BE 検証＋UI で担保・CHECK 不使用」・`drive_damage` REAL の前例記述）。
- DES-005（`docs/design/05-screen-design.md`）§5.7（登録/編集の入力欄・drive_damage 小数入力の前例）・§5.8（比較表示）。
- DES-006（`docs/design/06-validation.md`）**VAL-C04**（`drive_available_at_start` 0〜6 範囲・ERROR）・**VAL-D03**（draft 時は範囲チェックのみ・NULL 許容）・**VAL-C13**（`drive_damage` -6〜6 小数許容＝小数ゲージ検証の範型・create/promote 実行・PATCH 非実行・FE zod 第一防衛線）。
- code-facts（`docs/handover/code-facts.md`）§8 model（`Combo`）/ §7-2 DTO（`ComboResponse`/`CreateRequest`/`UpdateMetadataRequest`）/ §9 repository（`UpdateMetadataInput`・`DuplicateKey`）/ §10 マイグレ一覧・DDL（**000016 = `change_drive_damage_to_real`**・最新 000018・次連番 000019）。
- retrospective-digest（`docs/handover/retrospective-digest.md`）§1-A（設計書の論理型≠物理 SQL 宣言・新規/変更列は既存同種列の物理宣言を view）・§5（破壊的マイグレ × `dbtest.Setup`・FK=OFF×明示 DELETE 非同居・down 整合）。

### 3.2 前提事実（実ファイルで確認済み・Plan Mode で再確認）

- **現行型**（code-facts §8/§7-2/§9・DES-003 §3.4）: `combos.drive_available_at_start` は **DB INTEGER**・`model.Combo.DriveAvailableAtStart *int`・`ComboResponse`/`CreateRequest` は `*int`・`UpdateMetadataRequest`/`UpdateMetadataInput` は `Optional[int]`。
- **前例（同一テーブルの REAL 化実績）**: `combos.drive_damage` は **000016 `change_drive_damage_to_real`** で INTEGER→REAL 化済み（CHANGE-046）。`model.Combo.DriveDamage *float64`・DTO は `*float64`/`Optional[float64]`。**M16-01 は drive_damage と同じ型・同じ再構築技法をたどる**。
- **マイグレ連番**: 最新 = **000018**（`cleanup_moves_unobservable_columns`＝M14-01）。次 = **000019**（code-facts §10）。
- **SQLite の列型変更**: `ALTER TABLE` で列の型（affinity）を直接変更できないため、**テーブル再構築が要る**（000016 の技法）。**combos は combo_steps/combo_tags/combo_setups から FK 参照される**ため、再構築時の FK 連鎖に注意（000016 がどう回避したかを view）。
- **dup 非対象**: `DuplicateKey`（character/starter/position/stance/hitType/size）・VAL-C02（DES-006 §2.3 主要項目＝position/opponent_stance/hit_type/opponent_size）に **drive_available_at_start は含まれない**。型変更は重複判定に波及しない。
- **検証**（DES-006）: VAL-C04＝`drive_available_at_start` 0〜6 範囲（ERROR）。VAL-D03＝draft 時は範囲チェックのみ・NULL 許容。VAL-C13（drive_damage）は「小数許容・create/promote 実行・PATCH 非実行・FE zod 第一防衛線」＝小数ゲージ検証の範型。
- **CSV**（意味単位・digest M13-6）: export/import は code ベース・DB 管理列除外で頑健。`drive_available_at_start` は**値**カラム＝INTEGER→REAL は値互換（"2"→"2" or "2.0"、半値 "2.5"）。

### 3.3 参照不要

- M16-02（消費列）・M16-03（起き攻め）・M16-04（taxonomy/dash）・M14-03b（seed）の詳細。本サブは drive 始動残量の型変更に限定。

### 3.4 着手前の確認（Plan Mode 必須。§9.4 と対応）

以下 **7 項目**を Plan Mode で実コード確認のうえ計画提示すること（推測で実装しない）。

1. **現行物理宣言と 000016 技法の view（最重要）**: `combos.drive_available_at_start` の現行 SQL 宣言（INTEGER）と、**000016 `change_drive_damage_to_real` の up/down 実 SQL** を view し、テーブル再構築の手順（`CREATE TABLE new_combos`（drive_available_at_start を REAL に）→ `INSERT ... SELECT`（既存値を REAL へ）→ 旧 `DROP` → `RENAME` → index 再作成）と、**FK 連鎖の回避方法**（migrate 接続 FK=OFF〔modernc 既定〕＋一時名経由で legacy_alter_table の FK 自動書換を回避）を確定。000019 はこれを踏襲。
2. **マイグレ 000019 の技法確定**: 再構築後に **combo_steps/combo_tags/combo_setups の FK・index が保全**されるか（000016 の手順で担保されているか）。**FK=OFF と明示 DELETE を同一指示書に同居させない**（digest §5・M12-5）＝本サブは行 DELETE を伴わない（型変更のみ）ことを確認。`dbtest.Setup` が 000019 を含む全マイグレを適用し**全既存テスト通過**（M9-1）。`migrate_test.go` の down 整合（000019.down で INTEGER へ戻す・値の丸め方針も明記）。
3. **型変更の全消費経路 grep 全数**: `drive_available_at_start`（DB 列名）/ `DriveAvailableAtStart`（Go）/ `driveAvailableAtStart`（TS）を grep し、`model.Combo`・`ComboResponse`・`CreateRequest`・`UpdateMetadataRequest`・`UpdateMetadataInput`・repository の SELECT/INSERT/UPDATE スキャン・FE 型（3 型）・入力 widget・表示（一覧/詳細/比較）・CSV export/import・検証（VAL-C04/D03・FE zod）を**漏れなく列挙**。`*int`→`*float64`（`Optional[int]`→`Optional[float64]`・TS `number`）の波及箇所を確定。
4. **入力 widget の 0.5 刻み**: `drive_damage` の小数入力 UI（DES-005 §5.7・`step` 属性の実装）を view し、drive 始動残量の入力欄（test-id `combo-editor-drive-available`＝M15-01・**test-id は温存**）を `step=0.5`・`min=0`・`max=6` に。zod スキーマを整数→小数（0〜6）へ。**test-id 命名は既存 grep 実値を正**（digest §4・M15-1）。
5. **検証（DES-006）**: VAL-C04 を「0〜6 の範囲内か（**小数許容**）」へ（範囲のみ・0.5 刻みは UI 担保＝VAL-C13 と同方針）。VAL-D03（範囲チェックのみ・NULL 許容）が小数で成立するか。FE zod（第一防衛線）を小数許容へ。**DES-006 の CHANGE 要否を判定**（VAL-C04 の「小数許容」明記が要れば設計担当が起票）。
6. **CSV 後方互換**: `drive_available_at_start` の export（REAL 値の書式＝"2" か "2.0" か・半値 "2.5"）と import（既存の整数値 CSV を REAL 列へ読む・小数値を parse）の**往復が成立**するか。意味単位（値カラム）で旧 CSV を壊さない（digest M13-6）。export 書式・import parse の実装を確認。
7. **dup 非対象の確認（回帰ゲート）**: `DuplicateKey`・VAL-C02 に drive_available_at_start が**含まれないこと**を grep で再確認（型変更で重複判定が変わらない）。CheckDuplicate 経路が drive 始動残量を参照しないことを確認。

---

## 4. 詳細仕様

### 4.1 マイグレ 000019（型変更・000016 技法踏襲）

- `combos.drive_available_at_start` を **INTEGER→REAL** 化。SQLite の列型変更は再構築が要るため、**000016 `change_drive_damage_to_real` の非破壊テーブル再構築**（migrate 接続 FK=OFF・一時名経由・`CREATE new` → `INSERT SELECT` → `DROP` → `RENAME` → index 再作成）を手本にする。
- 既存整数値は REAL へ無損失昇格（2 → 2.0）。**行の DELETE を伴わない**（型変更のみ＝FK=OFF×明示 DELETE 非同居の regime を守る）。
- **down（000019.down）**: REAL→INTEGER へ戻す。小数値（2.5 等）が存在した場合の丸め方針を明記（down は開発時のロールバック用途＝実運用データに 0.5 が入る前提での down は稀だが、整合のため丸め〔切捨て/四捨五入〕を Plan Mode で確定し down SQL に明記）。
- `dbtest.Setup` 適用後に全既存テスト通過・`migrate_test.go` の round-trip 成立。

### 4.2 データ層（model / DTO / repository）

- `model.Combo.DriveAvailableAtStart`: `*int`→`*float64`（`DriveDamage *float64` に倣う）。
- `ComboResponse` / `CreateRequest`: `driveAvailableAtStart` を `*float64`。
- `UpdateMetadataRequest` / `UpdateMetadataInput`: `Optional[int]`→`Optional[float64]`（`driveDamage` に倣う）。
- repository の combos SELECT/INSERT/UPDATE のスキャン・バインドを `float64` へ。`DuplicateKey` は不変。

### 4.3 入力 UI（ゲージ widget 0.5 刻み）

- ドライブ始動残量の入力欄（test-id `combo-editor-drive-available`・温存）を `step=0.5`・`min=0`・`max=6` の数値入力へ。`drive_damage` 小数入力（DES-005 §5.7）の実装方式を踏襲。
- FE zod を小数許容（0〜6）へ。一覧/詳細/比較（DES-005 §5.8）表示で小数を崩さない。

### 4.4 検証（DES-006）

- **VAL-C04**: `drive_available_at_start` 0〜6 の範囲内か（**小数許容**へ明確化）。範囲のみ・0.5 刻みは UI 担保（VAL-C13 drive_damage と同方針）。create/promote 実行・PATCH 単純更新は非実行（VAL-D03・既存 VAL-C04/C05 と一貫）。FE zod が第一防衛線。
- **DES-006 CHANGE 見込み**: VAL-C04 の「小数許容」明記（要否を着手時 view で確定・要れば設計担当が起票）。

### 4.5 CSV 後方互換（意味単位・digest M13-6）

- export: `drive_available_at_start` を REAL 値で出力（整数は "2"・半値 "2.5"）。書式は既存 CSV 契約（DES-002 §7.6）を壊さない値表現。
- import: 既存の整数値 CSV を REAL 列へ読み込み成立（後方互換）。小数値の parse を追加。
- 意味単位（値カラム）のため列構造は不変＝旧 CSV 往復に頑健。

### 4.6 dup 非対象（回帰確認）

- `DuplicateKey`・VAL-C02 に drive 始動残量は非該当（type 変更で重複判定不変）。CheckDuplicate 経路の回帰のみ確認。

---

## 5. テスト要件（ケース数で語る。§7 DoD と対応）

### 5.1 Go テスト

- **マイグレ 000019**: up で `drive_available_at_start` が REAL になり既存整数値が保全（2→2.0）。down で INTEGER へ戻る（down 整合・丸め方針どおり）。`dbtest.Setup` 適用後に全既存テスト通過。
- **model/DTO/repository**: `float64` で read/write 成立。**0.5 刻みの値（例 2.5）が保存・取得できる**。PATCH（UpdateMetadataRequest）で小数が更新でき、`Optional[float64]` の不変更/クリアが既存トライステートで成立。
- **検証**: VAL-C04 が小数の範囲内（0〜6）を許容し範囲外（-0.5 / 6.5）を ERROR。VAL-D03（draft 範囲チェックのみ）。
- **dup 非回帰**: CheckDuplicate が drive 始動残量に非依存（型変更前後で同一判定）。

### 5.2 FE テスト（Vitest）

- 入力 widget が 0.5 刻み（`step=0.5`・0〜6）で小数入力でき、zod が小数を許容し範囲外を弾く。test-id `combo-editor-drive-available` 不変。
- 一覧/詳細/比較で小数（2.5）が崩れず表示。
- 型変更（number）でビルドが型エラーなく通る（3 型＝ComboSummary/ComboDetail/Combo）。

### 5.3 E2E / 手順書

- コンボ編集でドライブ始動残量に 2.5 を入力→保存→リロードで反映（既存編集導線の非回帰）。
- 比較画面で小数の drive 始動残量が表示される。
- M13 CSV export/import が型変更後も往復成立（整数値・半値ともに・意味単位の非回帰）。

---

## 6. レビュー観点（別ファイル参照）

`docs/instructions/phase3/reviews/M16-01-review-checklist.md` を参照。重大判定は §9。

---

## 7. 完了条件（Definition of Done）

### 7.1 機能要件

- `combos.drive_available_at_start` が REAL になり、0.5 刻みで入力・保存・表示でき、combo↔sequence の粒度が揃う。
- 既存整数値が保全され、重複判定・他 combos 列・レシピ/recipe_cache が不変。
- CSV export/import が整数値・半値ともに往復成立。

### 7.2 自己テスト結果

- §5 の Go/FE/E2E をケース数で報告。`dbtest.Setup` 経由の全テスト通過・down 整合（丸め方針）を明記。

### 7.3 品質チェック

- `drive_available_at_start` 型変更の全消費経路 grep 結果（波及箇所の網羅）を報告。**dup 非対象の確認結果**を明記。禁則表現（「適切に」「必要に応じて」等）の grep 除去。簡体字なし。

### 7.4 ドキュメント

- Plan Mode 確定方式（7 項目）・テストケース数・既知の制約（down の丸め方針等）を完了報告に含める。
- DES-003 §3.4（型 INTEGER→REAL）/ DES-005 §5.7・§5.8（0.5 刻み widget・小数表示）/ DES-006 VAL-C04（小数許容）への CHANGE 見込みの具体化点を**設計担当への伝達メモ**で申し送り（DES 反映は設計担当が CHANGE 起票）。

### 7.5 完了報告

- 上記＋ CHANGE 見込み（採番 060〜・DES-003/005/006）の具体化点を伝達メモで申し送り。

---

## 8. 参照ドキュメント

- M16-overview v1.0.0 §2.1/§4.2/§6 / phase3-overview v1.1.2 §2.4 G-g / DES-003 §3.4 / DES-005 §5.7/§5.8 / DES-006 VAL-C04/D03/C13 / code-facts §8/§7-2/§9/§10（000016 前例）/ retrospective-digest §1-A/§5 / datamodel-issues 論点②。

---

## 9. 注意事項・判断に迷ったら

### 9.1 推測で進めてはいけない事項

- マイグレ技法（型変更＝再構築要否・FK 連鎖回避・000016 の手順）。推測で ALTER し FK/index を壊さない。
- 型変更の全消費経路（§3.4-3 の grep 全列挙。漏れは型エラー or 実行時破壊）。
- down の丸め方針（小数→整数の情報欠落を無断で決めない）。

### 9.2 推測で進めてよい事項（その旨を明示）

- 入力欄の配置（既存 drive_damage 小数入力に倣う）。
- CSV の REAL 書式（"2" vs "2.0"）は往復が成立する範囲で製造裁量（完了報告に明記）。

### 9.3 不明事項発見時の対応

- `drive_available_at_start` を **重複判定 or recipe_cache で読む箇所**を発見した場合は実装を止め、設計担当へ差し戻す（dup 非対象・recipe 非対象の前提が崩れるため再設計判断）。

### 9.4 Plan Mode で計画提示時に含めるべき項目

- §3.4 の 7 項目すべて（000016 技法 view / マイグレ 000019 技法 / 型変更全経路 grep / widget 0.5 刻み / 検証 / CSV 後方互換 / dup 非対象確認）。

---

## 10. 完了後の次ステップ

- 完了報告（伝達メモ）を受けて、設計担当が **CHANGE（060〜）** を起票（DES-003 §3.4 型・DES-005 §5.7/§5.8 widget/表示・DES-006 VAL-C04 小数許容）。三点セット（通知書＋改訂 DES＋change-report）で反映。
- **M16-02（G-f＝SA/drive 消費列追加）** に着手（本サブで確定した drive の REAL/0.5 型方針を共有）。

---

*以上、指示書 M16-01 v1.0.0。配置 `docs/instructions/phase3/M16-01-drive-available-to-real.md`。対のレビューチェックリストは `docs/instructions/phase3/reviews/M16-01-review-checklist.md`。承認ゲート G-g＝マイグレ実装着手前に開発者の個別承認を得る。型変更は 000016 `change_drive_damage_to_real` を技法の手本とし、始動残量は dup/recipe 非対象のため blast radius は小。*
