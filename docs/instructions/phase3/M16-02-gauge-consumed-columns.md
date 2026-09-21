# 指示書 M16-02: ゲージ消費列の追加（SA 消費 ＋ drive 消費・G-f）

| 項目 | 内容 |
|------|------|
| 指示書ID | M16-02 |
| マイルストーン | M16（データモデル拡充・スキーマの継ぎ目・§6 承認ゲート） |
| バージョン | 1.0.0 |
| 作成者・作成日 | 設計担当 Claude（フェーズ3 継続担当・M16 期）/ 2026-07-05 |
| 実装モデル | **Opus 4.8 ＋ Plan Mode 必須** / レビュー Sonnet 4.6（model-allocation v1.29.0） |
| 承認ゲート | **G-f**（phase3-overview v1.1.2 §2.4）＝**着手前に開発者の個別承認を得てからマイグレ実装に入る** |
| 上位文書 | M16-overview v1.0.0（`docs/instructions/phase3/M16-overview.md`）§2.1/§4.2/§4.7/§6 |
| 関連 | phase3-overview v1.1.2 §2.4 G-f / §M16 ① / combmgr-friend-feedback-datamodel-issues 論点① / M16-01（drive の REAL/0.5 型方針を共有）/ 旧 auto-cache 列削除=マイグレ 000008 `drop_gauge_consumed_total`（FR303/CHANGE-019） |

> **文書ID ⇄ 実パスの正は `docs/handover/docs-map.md`（自動生成）**。本書は docs-map 準拠の実パスを併記する。

## 更新履歴

| 版 | 更新日 | 更新内容 |
|----|--------|----------|
| 1.0.0 | 2026-07-05 | 初版。G-f＝combos に SA 消費（INTEGER 0〜6）＋drive 消費（REAL 0.5・0〜20）の手入力列 2 本を追加。記録/表示/比較のみ・VAL 非連動。 |

---

## 1. 背景と目的

### 1.1 背景

本サブ **M16-02（ゲート G-f）** は datamodel-issues 論点①に対応する。

- 現状 combos は始動残量（`drive_available_at_start` / `sa_available_at_start`）のみを持ち、**コンボが「何本使うか」＝消費量を保持していない**。かつて自動キャッシュ列（`drive_gauge_consumed_total` / `sa_gauge_consumed_total`）が存在したが、**FR303 廃止（CHANGE-019・マイグレ 000008 `drop_gauge_consumed_total`）で削除済み**。
- **FR303 が否定したのは「消費量を自動算出してキャッシュし機械判定する」仕組み**であり、**ユーザーが消費量を手入力で記録したいニーズは否定されていない**（datamodel-issues 論点①）。上位プレイヤーの資源管理で SA・drive の消費は比較軸として実需がある（friend FB #11＝SA は始動と消費の両方が欲しい・現状表記でどちらか判別できない）。
- 本サブは **SA 消費・drive 消費の手入力列を追加**する。**記録・表示・比較のみ**で、**検証（VAL）は連動させない**（開発者確定 2026-06-26＝FR303 廃止の精神と整合・自動キャッシュは復活させない）。始動値とは別列。
- **消費列はメタデータで FR301 重複判定キーの対象外**（datamodel-issues 論点①）＝重複判定への波及なし。

### 1.2 目的

- combos に **2 列を追加**（マイグレ **000020**・`ALTER TABLE ADD COLUMN`・再構築不要）:
  - **`sa_gauge_consumed`（INTEGER・NULL 可・0〜6）**。始動 SA（0〜3）と範囲が異なる＝**コンボ中に SA が溜まり始動より多く使えるため上限 6**（開発者確定 2026-07-05）。
  - **`drive_gauge_consumed`（REAL・NULL 可・0〜20・0.5 刻み）**。drive は 0.5 本単位で消費・複合で端数が出るため REAL。上限 20 は念のための余裕枠（開発者確定 2026-07-05）。
- データ層（`model.Combo` / combo DTO / repository）・入力 UI（消費入力欄・始動と判別可能に）・**比較画面の比較軸**（DES-005 §5.8）・詳細表示（§5.6）・CSV 往復（意味単位・列末尾追加）を追従する。
- **DES-006 に「消費列は検証しない」を明記**（custom_states §2.4 の前例に倣う・VAL を足さない設計判断の正典化）。

### 1.3 このマイルストーンで作らないもの（スコープ外）

- **② drive 始動残量の REAL 化**＝**M16-01（G-g）**。本サブは消費列の追加のみ（始動列の型は触らない）。ただし drive 消費の REAL/0.5 型方針は M16-01 と共有する。
- **③ 起き攻め正規化**＝M16-03（G-h）。**④ taxonomy/dash**＝M16-04（G-i）。**seed**＝M14-03b。
- **消費量の自動算出・キャッシュ**＝**設けない**（FR303 廃止の尊重・手入力のみ）。
- **消費量の検証（VAL）**＝**設けない**（① 確定・記録/表示/比較のみ）。範囲は UI ステッパーの上限のみ（BE VAL は無し）。
- **バーンアウト独立列・終了時残量列**＝**設けない**（datamodel-issues 論点① 推奨3・将来の導出表示余地のみ）。
- `sa_available_at_start` の型変更は**しない**（0〜3 INTEGER のまま）。

---

## 2. 成果物

### 2.1 作成するファイル

- `migrations/000020_add_gauge_consumed_columns.up.sql` / `.down.sql`（命名は既存連番規約に合わせる。実配置は code-facts §10 に従う。**M16-01 の 000019 の後**）。

### 2.2 修正するファイル（code-facts 由来の想定接地点・**Plan Mode で全数確認**）

- **Go model**（`internal/model/combo.go`）: `Combo` に **`SAGaugeConsumed *int`**（db:sa_gauge_consumed, json:saGaugeConsumed,omitempty）＋ **`DriveGaugeConsumed *float64`**（db:drive_gauge_consumed, json:driveGaugeConsumed,omitempty）を追加。**前例＝始動列 `SAAvailableAtStart *int` / `DriveDamage *float64` の宣言**。
- **Go DTO**（`internal/api/combo/dto.go`）:
  - `ComboResponse`: `saGaugeConsumed *int` ＋ `driveGaugeConsumed *float64` 追加。
  - `CreateRequest`: 同上追加。
  - `UpdateMetadataRequest`: `saGaugeConsumed comborepo.Optional[int]` ＋ `driveGaugeConsumed comborepo.Optional[float64]` 追加（既存メタデータ列と同じトライステート運用）。
- **Go repository**（`internal/repository/combo/repository.go`）: `UpdateMetadataInput` に `SAGaugeConsumed Optional[int]` ＋ `DriveGaugeConsumed Optional[float64]` 追加。combos の SELECT/INSERT/UPDATE 列・スキャンに 2 列追従。**`DuplicateKey` は不変**（消費列は dup 非対象）。
- **FE 型**: TypeScript の combo 型（`web/src/features/combo/types.ts` 等・Plan Mode で所在特定）に `saGaugeConsumed?: number` ＋ `driveGaugeConsumed?: number` を追加。**3 型（ComboSummary/ComboDetail/Combo）すべてに追加**（CLAUDE.md §4 の型分岐運用＝Combo 編集型への追加漏れに注意）。
- **FE 入力 widget**（DES-005 §5.7・editor）: 消費入力欄 2 つを追加。SA 消費＝整数ステッパー（`min=0`・`max=6`・`step=1`）、drive 消費＝小数入力（`min=0`・`max=20`・`step=0.5`・**M16-01 の drive 始動残量入力と同方式**）。**ラベルで「消費」を明示**し始動値と判別可能に（friend FB #11 の主眼）。test-id は既存規約 `combo-editor-<field>`（例 `combo-editor-sa-consumed` / `combo-editor-drive-consumed`・**grep 実値で確定**＝digest §4/M15-1）。
- **FE 表示**: 詳細（§5.6）で消費を表示（始動と区別）。**比較画面（§5.8）に SA/drive 消費を比較軸として追加**（§M16 ①「比較画面で消費を比較軸に」）。
- **CSV export/import**（`comboio`・意味単位）: 消費 2 列を**列末尾追加**で往復同梱（後方互換＝§4.5）。

### 2.3 変更しないもの（原則）

- 始動列（`drive_available_at_start`〔M16-01〕・`sa_available_at_start`）の型・値。
- `DuplicateKey`・VAL-C02（重複判定）＝消費列は非対象（回帰確認のみ）。
- combo_steps・レシピ・recipe_cache（消費はレシピに含まれない＝非対象）。
- 起き攻め・drive_damage・knockdown_advantage 等の他 combos 列。
- **検証（DES-006 の VAL-C/D 群）**＝消費列に VAL を新設しない（① 確定）。

### 2.4 例外条項

- code-facts と実コードに差があれば**実コードを正**とし、相違を完了報告に記録（記憶で進めない・playbook §4.1）。

---

## 3. 前提条件

### 3.1 必読ドキュメント

- M16-overview v1.0.0 §2.1/§4.2/§4.7/§6。
- DES-003 §3.4 combos（始動列・「範囲は BE 検証＋UI で担保・CHECK 不使用」・列の器）。
- DES-005 §5.7（editor 入力欄・消費と始動の判別）・§5.6（詳細表示）・§5.8（比較表＝消費を比較軸に）。
- DES-006 **§2.4**（custom_states 入力は検証しない＝**「検証を設けない」記述の前例**）・VAL-C04/C05（始動列の範囲検証＝**消費列には設けない**ことの対比）・VAL-D03。
- code-facts §8 model（`Combo`・始動列宣言）/ §7-2 DTO / §9 repository（`UpdateMetadataInput`・`DuplicateKey`）/ §10 マイグレ一覧（**000008 `drop_gauge_consumed_total`**＝旧 auto-cache 削除・最新 000018／M16-01 の 000019 の後＝**000020**）。
- architecture-patterns §9.1（custom_states 消費は非モデル化＝**SA/drive 消費は combos 専用列という例外**の位置づけ）。
- retrospective-digest §1-A（論理型≠物理 SQL 宣言＝新規列は既存同種列の物理宣言を view・M8-1）・§4（表示トークン追加は全表示箇所調査）・§5（破壊的マイグレ × `dbtest.Setup`・down 整合）。

### 3.2 前提事実（実ファイルで確認済み・Plan Mode で再確認）

- **旧 auto-cache 列は削除済み**（code-facts §10）: `drive_gauge_consumed_total` / `sa_gauge_consumed_total` は **000008 `drop_gauge_consumed_total`**（FR303/CHANGE-019）で削除。**新列名 `sa_gauge_consumed` / `drive_gauge_consumed`（`_total` なし）は 000008.down が復元する `*_total` と衝突しない**。
- **始動列の宣言**（code-facts §8・DES-003 §3.4）: `sa_available_at_start` INTEGER・`drive_available_at_start` INTEGER（M16-01 で REAL 化予定）・`drive_damage` REAL。いずれも NULL 可。**新規消費列は NULL 可で追加**（既存行は NULL）。
- **DTO/repository 経路**（code-facts §7-2/§9）: `ComboResponse`/`CreateRequest`/`UpdateMetadataRequest`/`UpdateMetadataInput` に始動・drive_damage 等のメタデータ列が並ぶ＝**消費列は同経路に加える**。`UpdateMetadataRequest` は `Optional[...]` トライステート（既存メタデータ列と同運用）。
- **dup 非対象**（code-facts §9・DES-006 §2.3）: `DuplicateKey`・VAL-C02 は消費列を含まない（メタデータ）。追加で重複判定は変わらない。
- **検証なし**（① 開発者確定 2026-06-26）: 消費列は記録/表示/比較のみ・VAL 非連動。DES-006 §2.4（custom_states「検証しない」）が**「検証を設けない」記述の前例**。
- **マイグレ連番**: M16-01 が 000019。本サブは **000020**。ADD COLUMN は**再構築不要**（単純 ALTER）＝行 DELETE を伴わない。
- **CSV**（意味単位・digest M13-6）: 消費列は**列末尾追加**で旧 CSV を壊さない（M13-6 頑健性）。

### 3.3 参照不要

- M16-01（drive REAL 化）の実装詳細（型方針のみ共有）・M16-03/04・M14-03b の詳細。

### 3.4 着手前の確認（Plan Mode 必須。§9.4 と対応）

以下 **7 項目**を Plan Mode で実コード確認のうえ計画提示すること（推測で実装しない）。

1. **列名確定と既存同種列の物理宣言 view（最重要）**: 新列 `sa_gauge_consumed`（INTEGER）/ `drive_gauge_consumed`（REAL）の名称でよいか（`*_total` を避け 000008.down と非衝突）。既存 combos の nullable 数値列（`sa_available_at_start` INTEGER・`drive_damage` REAL）の**物理宣言（NULL 可・DEFAULT 有無）を view し同方式で宣言**（設計書の論理型≠物理 SQL＝digest §1-A/M8-1）。
2. **マイグレ 000020 技法**: `ALTER TABLE combos ADD COLUMN sa_gauge_consumed INTEGER` ＋ `ADD COLUMN drive_gauge_consumed REAL`（NULL 可・**再構築不要**）。既存行は NULL。down で `DROP COLUMN` 2 本。**FK=OFF と明示 DELETE を同一指示書に同居させない**（digest §5・本サブは ADD のみで DELETE を伴わない）。`dbtest.Setup` が 000020 を含む全マイグレ適用後に全テスト通過。`migrate_test.go` の down 整合。**M16-01 の 000019 の後**（連番順序）。
3. **追加の全接地経路 grep**: `model.Combo`・`ComboResponse`・`CreateRequest`・`UpdateMetadataRequest`・`UpdateMetadataInput`・repository の SELECT/INSERT/UPDATE 列・FE 型（3 型）・入力 widget・詳細/比較表示・CSV export/import の**全接地点を列挙**し 2 列を漏れなく追加。既存始動列の経路をなぞる。
4. **入力 widget（始動と判別）**: SA 消費＝整数ステッパー（0〜6・step1）、drive 消費＝小数（0〜20・step0.5＝M16-01 と同方式）。**ラベルで「消費」を明示し始動値と判別可能に**（friend FB #11）。test-id は既存 `combo-editor-<field>` 規約を grep 実値で確定（digest §4/M15-1・手書き決め打ち禁止）。
5. **検証を設けない（①・最重要の性格差）**: 消費列に **VAL-C/D を新設しない**（記録/表示/比較のみ・VAL 非連動）。FE も範囲は UI ステッパー上限のみ（zod で範囲 ERROR にしない＝custom_states §2.4 と同様の「検証しない」扱い）。**DES-006 に「消費列は検証しない」を追記**する CHANGE 見込みを完了報告に記す（設計担当が起票）。※これは M16-01（VAL-C04 小数許容）と決定的に異なる。
6. **CSV 後方互換**: 消費 2 列を export/import に**列末尾追加**（意味単位）。**旧 CSV（消費列なし）の import が成立**（欠損列＝NULL 扱い）。新 CSV は消費列を含む。列末尾追加で旧 CSV 契約を壊さない（DES-002 §7.6・digest M13-6）。
7. **dup/recipe 非対象の確認（回帰ゲート）**: `DuplicateKey`・VAL-C02・recipe_cache に消費列が**入らないこと**を確認（メタデータ＝重複判定・レシピに非関与）。

---

## 4. 詳細仕様

### 4.1 マイグレ 000020（ADD COLUMN 2 本・再構築不要）

- `ALTER TABLE combos ADD COLUMN sa_gauge_consumed INTEGER`（NULL 可）＋ `ALTER TABLE combos ADD COLUMN drive_gauge_consumed REAL`（NULL 可）。既存行は NULL。
- down（000020.down）: `DROP COLUMN drive_gauge_consumed` ＋ `DROP COLUMN sa_gauge_consumed`（SQLite 3.35+・前例 M14-01 の列 DROP と同方式。再構築要否は Plan Mode で確定）。
- 行 DELETE を伴わない（FK=OFF×明示 DELETE 非同居の regime を守る）。`dbtest.Setup` 全テスト通過・down 整合。

### 4.2 データ層（model / DTO / repository）

- `model.Combo`: `SAGaugeConsumed *int`（db:sa_gauge_consumed）＋ `DriveGaugeConsumed *float64`（db:drive_gauge_consumed）。
- `ComboResponse`/`CreateRequest`: `saGaugeConsumed *int` ＋ `driveGaugeConsumed *float64`。
- `UpdateMetadataRequest`/`UpdateMetadataInput`: `Optional[int]` ＋ `Optional[float64]`（既存メタデータ列と同トライステート）。
- repository の combos SELECT/INSERT/UPDATE に 2 列追従。`DuplicateKey` は不変。

### 4.3 入力 UI（消費・始動と判別）

- editor（DES-005 §5.7）に消費入力欄 2 つ。SA 消費＝整数（0〜6・step1）、drive 消費＝小数（0〜20・step0.5）。**「始動」「消費」をラベルで判別可能に**（friend FB #11／⑨⑬ の始動明示ラベルは M16-06 rollout だが、消費欄の新設時点で始動/消費の区別が付く配置にする）。
- 詳細（§5.6）で消費を表示。**比較画面（§5.8）に SA/drive 消費の比較軸行を追加**。

### 4.4 検証（DES-006）＝消費列は検証しない（①）

- 消費列（`sa_gauge_consumed` / `drive_gauge_consumed`）に **VAL-C/D を新設しない**（記録/表示/比較のみ・VAL 非連動・FR303 廃止の精神）。FE zod も範囲 ERROR を設けない（UI ステッパー上限のみ）。
- **DES-006 CHANGE 見込み**: §2.4（custom_states「検証しない」）に倣い、**「ゲージ消費列は検証しない」旨を明記**（設計担当が起票）。

### 4.5 CSV 後方互換（意味単位・列末尾追加・digest M13-6）

- export: 消費 2 列を**列末尾に追加**（意味単位）。値は数値（SA=整数・drive=小数）。
- import: 消費列を含む新 CSV は取り込み、**消費列を含まない旧 CSV も成立**（欠損＝NULL）。列末尾追加で旧 CSV 契約（DES-002 §7.6）を壊さない。

### 4.6 dup / recipe 非対象（回帰確認）

- `DuplicateKey`・VAL-C02・recipe_cache に消費列は非関与（メタデータ）。重複判定・レシピ表示の回帰のみ確認。

---

## 5. テスト要件（ケース数で語る。§7 DoD と対応）

### 5.1 Go テスト

- **マイグレ 000020**: up で `sa_gauge_consumed`（INTEGER）・`drive_gauge_consumed`（REAL）が追加され既存行が NULL。down で 2 列が消える（down 整合）。`dbtest.Setup` 適用後に全既存テスト通過。
- **model/DTO/repository**: 2 列の read/write 成立。SA 消費（整数・例 5）・drive 消費（小数・例 3.5）が保存・取得できる。PATCH（UpdateMetadataRequest）で `Optional` の不変更/クリアが既存トライステートで成立。
- **検証なし**: 消費列に VAL が発火しない（範囲外の値〔例 SA=6・drive=10.5〕でも ERROR/WARNING が出ない＝VAL 非連動を確認）。
- **dup 非回帰**: CheckDuplicate が消費列に非依存（追加前後で同一判定）。

### 5.2 FE テスト（Vitest）

- 消費入力欄 2 つが表示され、SA=整数（0〜6・step1）・drive=小数（0〜20・step0.5）で入力でき PATCH に乗る。**始動と消費がラベルで判別できる**。
- 3 型（ComboSummary/ComboDetail/Combo）に追加され型エラーなくビルド。
- 詳細/比較で消費が表示され、比較画面に消費の比較軸が出る。

### 5.3 E2E / 手順書

- コンボ編集で SA 消費・drive 消費を入力→保存→リロード反映（始動と別項目として保存）。
- 比較画面で 2 コンボの消費が比較軸として並ぶ。
- M13 CSV export/import が消費列追加後も往復成立（**旧 CSV〔消費列なし〕の import も成立**＝列末尾追加の後方互換）。

---

## 6. レビュー観点（別ファイル参照）

`docs/instructions/phase3/reviews/M16-02-review-checklist.md` を参照。重大判定は §9。

---

## 7. 完了条件（Definition of Done）

### 7.1 機能要件

- combos に SA 消費（INTEGER 0〜6）・drive 消費（REAL 0.5・0〜20）が追加され、手入力で記録・表示・比較でき、始動値と判別できる。
- **消費列に検証が連動しない**（範囲外でも ERROR/WARNING なし）。
- 重複判定・recipe_cache・他 combos 列・レシピが不変。
- CSV export/import が新旧 CSV ともに往復成立（列末尾追加の後方互換）。

### 7.2 自己テスト結果

- §5 の Go/FE/E2E をケース数で報告。`dbtest.Setup` 経由の全テスト通過・down 整合を明記。**VAL 非連動の確認結果**を明記。

### 7.3 品質チェック

- 消費列追加の全接地経路 grep 結果（波及網羅）を報告。**dup/recipe 非対象の確認結果**を明記。禁則表現（「適切に」「必要に応じて」等）の grep 除去。簡体字なし。

### 7.4 ドキュメント

- Plan Mode 確定方式（7 項目）・テストケース数・既知の制約を完了報告に含める。
- DES-003 §3.4（消費 2 列）/ DES-005 §5.6/§5.7/§5.8（消費入力/表示/比較軸）/ DES-006 §2.4（消費列は検証しない）への CHANGE 見込みの具体化点を**設計担当への伝達メモ**で申し送り（DES 反映は設計担当が起票）。

### 7.5 完了報告

- 上記＋ CHANGE 見込み（採番 060〜・DES-003/005/006）の具体化点を伝達メモで申し送り。

---

## 8. 参照ドキュメント

- M16-overview v1.0.0 §2.1/§4.2/§4.7/§6 / phase3-overview v1.1.2 §2.4 G-f / DES-003 §3.4 / DES-005 §5.6/§5.7/§5.8 / DES-006 §2.4/VAL-C04/C05/D03 / code-facts §8/§7-2/§9/§10（000008・000020）/ architecture-patterns §9.1 / retrospective-digest §1-A/§4/§5 / datamodel-issues 論点①。

---

## 9. 注意事項・判断に迷ったら

### 9.1 推測で進めてはいけない事項

- 追加の全接地経路（§3.4-3 の grep 全列挙。漏れは表示・往復の欠落）。
- **消費列に検証を付けてはいけない**（① 確定＝VAL 非連動。範囲 ERROR を勝手に足さない）。
- CSV の列末尾追加（旧 CSV 後方互換を壊さない位置）。

### 9.2 推測で進めてよい事項（その旨を明示）

- 消費入力欄の配置（始動列の近傍・始動/消費が判別できる範囲で）。
- CSV の消費列の数値書式（往復が成立する範囲で製造裁量）。

### 9.3 不明事項発見時の対応

- 消費列を **重複判定 / recipe_cache で読む要求**が出た場合、or **検証を足すべきか迷う**場合は実装を止め、設計担当へ差し戻す（① の VAL 非連動・dup/recipe 非対象の前提が崩れるため）。

### 9.4 Plan Mode で計画提示時に含めるべき項目

- §3.4 の 7 項目すべて（列名＋物理宣言 view / マイグレ 000020 ADD COLUMN / 全接地経路 grep / widget 始動判別 / **検証を設けない** / CSV 後方互換 / dup・recipe 非対象確認）。

---

## 10. 完了後の次ステップ

- 完了報告（伝達メモ）を受けて、設計担当が **CHANGE（060〜）** を起票（DES-003 §3.4 消費 2 列・DES-005 §5.6/§5.7/§5.8 消費入力/表示/比較軸・DES-006 §2.4 消費列は検証しない）。三点セットで反映。
- **M16-03（G-h＝起き攻め正規化）** に着手（friend 語彙棚卸しを実装前に挟む）。**表記 rollout（M16-06）の FB⑨⑪⑬「始動」明示ラベルは本サブ〔① 消費列〕確定後に実施**（順序依存）。

---

*以上、指示書 M16-02 v1.0.0。配置 `docs/instructions/phase3/M16-02-gauge-consumed-columns.md`。対のレビューチェックリストは `docs/instructions/phase3/reviews/M16-02-review-checklist.md`。承認ゲート G-f＝マイグレ実装着手前に開発者の個別承認を得る。**M16-01 と決定的に異なるのは「消費列は VAL 非連動＝検証を設けない」点**（① 確定・FR303 廃止の精神）。消費列はメタデータのため dup/recipe 非対象・CSV は列末尾追加の後方互換。*
