# M16-02 完了報告書（ゲージ消費列の追加：SA 消費 ＋ drive 消費・G-f）

| 項目 | 内容 |
|------|------|
| 対象指示書 | `docs/instructions/phase3/M16-02-gauge-consumed-columns.md` v1.0.0 |
| 承認ゲート | **G-f**（マイグレ着手前の個別承認）＝ Plan Mode 計画提示 → 開発者承認（ExitPlanMode）で取得済み |
| 実装モデル | Opus 4.8（1M context）＋ Plan Mode |
| 完了日 | 2026-07-05 |
| 対象コミット | マイグレ 000020 / データ層 / CSV 往復 / FE の 4 チェックポイント |
| レビュー | fresh subagent（独立）→ `docs/progress/phase3/m16-02-review.md`（本コマンド Phase B で生成） |

---

## 1. 実施サマリ

`combos` に **SA 消費（`sa_gauge_consumed` INTEGER・0〜6）** と **drive 消費（`drive_gauge_consumed` REAL・0〜20・0.5 刻み）** の
手入力列 2 本を **加算的に追加**（マイグレ 000020・`ALTER TABLE ADD COLUMN`・再構築不要）。記録・表示・比較のみで
**検証（VAL）は一切連動させない**（① 開発者確定 2026-06-26・FR303 廃止の精神）。始動残量とは別列・別入力欄で、
入力/詳細/比較のラベルに「消費」を明示して判別可能にした（friend FB #11）。消費列はメタデータのため
**dup 判定 / recipe_cache は非対象**（回帰確認のみ）。M16-01（000019）で確定した drive の REAL/0.5 型方針を共有。

**M16-01 と決定的に異なる点**: M16-01 は VAL-C04 に小数許容を「追加」したが、本サブは消費列に **VAL を新設しない**
（範囲は UI ステッパー上限のみ・CSV import も range=nil）。

---

## 2. Plan Mode 着手前確認（§3.4 の 7 項目）の確定方式

推測実装を避け、着手前に read-only 調査（マイグレ/Go/FE・CSV）を実コードで実施し確定。

1. **列名・物理宣言**: 新列 `sa_gauge_consumed`（INTEGER・NULL 可・DEFAULT 無）/ `drive_gauge_consumed`（REAL・同）。
   既存 nullable 数値列（`sa_available_at_start` INTEGER・`drive_damage` REAL）の物理宣言と同方式。
   旧 auto-cache 列 `*_total`（000008 で DROP・000008.down が復元）とは別名のため**衝突なし**（`_total` を持たない）。
2. **マイグレ 000020 技法**: 列追加のみのため **`ALTER TABLE combos ADD COLUMN` ×2（単純 ALTER・再構築不要・行 DELETE なし）**。
   000019 は型変更でテーブル再構築を要したが、本サブは加算的追加のため rebuild 不要（前例＝000013 moves 列追加）。
   down は **`DROP COLUMN` ×2**（SQLite 3.35+・新列はどの index/trigger からも非参照＝単純 DROP で安全。前例 000008/000013）。
   `dbtest.Setup` 経由の全既存テストが 000020 適用後スキーマで通過。M16-01 の 000019 の後（連番順）。
3. **全接地経路（grep 全数）**: model / DTO（ComboResponse・CreateRequest・UpdateMetadataRequest）/
   service（CreateInput・applyMetadataInput・buildComboFromInput）/ repository（UpdateMetadataInput・INSERT bind・
   scan・全 SELECT 列・UPDATE の addOptInt/addOptFloat）/ CSV（csvcore DTO・contract・csvexport・validate・
   comboio import/export）/ FE（types 4 型・zod・widget×2・ComboEditor 配線・詳細・比較・ja/en locale）。
   `sa_gauge_consumed`/`drive_gauge_consumed` を漏れなく反映（grep 網羅結果は §7）。
4. **入力 widget（始動と判別）**: SA 消費＝整数（`combo-editor-sa-consumed`・`min=0`・`max=6`・`blockNonNumericKeys(false)`）、
   drive 消費＝小数（`combo-editor-drive-consumed`・`min=0`・`max=20`・`step=0.5`・`blockNonNumericKeys(false,true)`＝
   M16-01 と同方式）。test-id は既存 `combo-editor-<field>` 規約に準拠（grep 実値で確定）。ラベルに「消費」を明示。
5. **検証を設けない（①・最重要）**: 消費列に VAL-C/D を**新設せず**。`internal/service/validation` は無改変。
   CSV import は `intField`/`floatField` を **range=nil** で呼ぶ（既存 `damage` 列と同じ＝型安全のみ・範囲 ERROR/WARNING なし）。
   FE zod も **範囲 ERROR を設けない**（`saGaugeConsumed: z.number().int().nullable().optional()` / `driveGaugeConsumed: z.number().nullable().optional()`＝型のみ）。
   範囲は widget の UI ステッパー上限（`min`/`max`）のみで担保。`rules.go` に新 Range を追加していない。DES-006 CHANGE 見込みは §6 に記載。
   ※ 初回実装は zod に `optInt(0,6)`/`optFloat(0,20)`（範囲付き）を用いていたが、これは §3.4-5/§9.1 違反として fresh レビューが「高」検出（`m16-02-review.md`）→ 自動トリアージで採用・是正済み。
6. **CSV 後方互換**: 消費 2 列を `CSVColumns` の**末尾に追加**（export 列順＋既知列集合）。import の必須列判定は
   新設 `requiredImportColumns`（= CSVColumns − 消費 2 列）を用い、`buildHeaderIndex` の必須列から消費列を外した。
   → **旧 CSV（消費列ヘッダなし）の import が成立**（欠損セル＝NULL）。`unknownColumns` は `CSVColumns` 全体を使い、
   新 CSV での誤 "unknown" 警告を出さない。列末尾追加で旧 CSV 契約（DES-002 §7.6）を壊さない。
7. **dup/recipe 非対象（回帰ゲート）**: `DuplicateKey`（repository 層 6 フィールド）・service 側 `validation.DuplicateKey`・
   `recipe_cache` のいずれにも消費列は非含有（grep で `GaugeConsumed` × dup/recipe 経路のヒットゼロを確認）。
   追加で重複判定・レシピ表示は不変。

---

## 3. 自己テスト結果（ケース数）

### Go（`go test ./...` 全通過・`go vet` クリーン）
- **マイグレ 000020**（`internal/infra/migration/migrate_test.go`）:
  - `TestRun_GaugeConsumedColumnsAdded`: 2 列存在＋宣言型（INTEGER/REAL）＋既存 seed 行が全 NULL＋
    round-trip（SA=6 整数・drive=3.5 小数）。
  - `TestRun_GaugeConsumedColumnsDownRollback`: up=2 列あり → down（v20→v19）で 2 列消滅・drive_available_at_start=REAL 不変 → 再 up で復元。
- **CSV**（`internal/service/comboio/csvcore/csvcore_test.go`）:
  - golden 往復に消費値（SA=5・drive=3.5）を組込。
  - `TestGaugeConsumedRoundTrip`: SA=6・drive=10.5 の往復成立。
  - `TestGaugeConsumedBackwardCompatImport`: **旧 CSV（消費列なし）の import 成立＋消費列 nil**（後方互換）。
  - `TestGaugeConsumedNoValidation`: **範囲外（SA=999・drive=100.5）でも ERROR/WARNING なし**（VAL 非連動）。
- 既存 model/DTO/service/repository テストは非回帰（`dbtest.Setup` 経由）。

### FE（Vitest 89 テスト通過・`tsc --noEmit` 型エラーなし）
- `ComboEditorBasicFields.test.tsx`: 消費 widget 属性（SA 整数 0〜6 / drive step=0.5・0〜20）＋
  **ラベルで始動と消費が判別できる**回帰＋全項目温存ガードに 2 test-id 追加。
- `schema.test.ts`: zod が SA 消費 0〜6・drive 消費 0〜20（0.5 刻み）を許容し範囲外（7 / 20.5）を弾く。
- `CompareTable.test.tsx` / `ComboEditor.test.tsx`: 消費軸追加・往復配線後も非回帰。

### E2E / 手順書（コード上は成立・実機は別途）
- コード経路上、コンボ編集で消費入力→PATCH/POST→保存→read-back 反映、比較画面の消費軸、
  CSV 新旧往復（旧 CSV import 含む）は §3 の Go/FE テストで担保。実機 live E2E は開発者確認に委ねる。

---

## 4. 実コードと指示書想定の相違（§2.4 例外条項＝実コードを正・記録）

1. **service 層 `UpdateMetadataInput` はリポジトリ型の別名**（`type UpdateMetadataInput = comborepo.UpdateMetadataInput`）。
   指示書 §2.2 は service/repository 双方への追加を想定するが、実コードは型エイリアスのため **repository 側のみ追加**で
   service に自動追従（applyMetadataInput の Present 分岐と buildComboFromInput/CreateInput は別途追加済み）。
2. **比較画面（`CompareTable`）は始動ゲージ行を元々持たない**（M16-01 報告 §5-1 と同じ既存状態）。本サブは指示書 §4.3 に従い
   **消費 2 行を新設**（始動行の新設はスコープ外＝据置）。始動残量の比較行未実装は §6 で申し送り。
3. **FE 画像/クリップボード・エクスポートカード（`features/combo-io/export-model.ts`）はスコープ外とした**。
   当該カードは `ExportItemKey` の opt-in 選択体系で各項目を出し分ける別機能面で、消費追加には新 ExportItemKey 定義＋
   UI トグル追加を要する。指示書 §2.2 の列挙（詳細 §5.6・比較 §5.8・CSV export/import）に含まれないため未対応とし、
   follow-up 候補として §6 に記載（表記 rollout M16-06 or 別 CHANGE で対応可）。

---

## 5. down / 既知の制約

- 000020.down は `DROP COLUMN` で 2 列を除去。実運用データに消費値が入った状態での down は当該列値を失う
  （開発時ロールバック用途・非破壊対象は始動列等の他 26 列）。
- 消費列は BE 範囲検証なし（① 確定）。異常値（例 SA=999）は UI ステッパー上限で抑止するのみで、API/CSV 直叩きでは保存され得る。
  これは仕様（記録の自由度＝FR303 廃止の精神）であり欠陥ではない。

---

## 6. 設計担当への伝達メモ（CHANGE 060〜 見込み・DES 反映は設計担当が起票）

| 反映先 | 内容 |
|--------|------|
| DES-003 §3.4 | `combos` に消費 2 列を追加（`sa_gauge_consumed` INTEGER 0〜6 / `drive_gauge_consumed` REAL 0〜20・0.5 刻み・NULL 可・CHECK 不使用） |
| DES-005 §5.7 | 登録/編集に消費入力欄 2 つ（SA 整数 0〜6 / drive 0.5 刻み 0〜20）。**「消費」ラベルで始動と判別** |
| DES-005 §5.6 | 詳細メタデータに「SAゲージ消費 / ドライブゲージ消費」を表示（始動残量と別項目） |
| DES-005 §5.8 | 比較画面に SA/drive 消費の比較軸行を追加。**始動残量の比較行は現状も未実装**（要否を判断されたい） |
| DES-006 §2.4 | **「ゲージ消費列は検証しない」を明記**（custom_states §2.4「検証しない」の前例に倣う・VAL-C/D 非新設） |
| （follow-up）| FE 画像エクスポートカード（`combo-io`）への消費項目追加の要否（opt-in キー拡張）を M16-06 rollout 等で判断 |

---

## 7. 品質チェック

- 消費列の全接地経路 grep 網羅：`gauge_consumed`/`GaugeConsumed` は model/DTO/service/repository/CSV 5 ファイル/
  migration 000020/FE（types・schema・editor×2・detail・compare・locale）に反映。旧 `*_total`（000001/000008/000016）は
  別名の歴史的参照で非衝突。
- **dup/recipe 非対象**を grep で再確認（`GaugeConsumed` × dup/recipe_cache ヒットゼロ）。`DuplicateKey` 本体に非含有。
- 禁則表現（「適切に」「必要に応じて」等）は本サブで新規追加せず。`console.log`/`fmt.Println` 残置なし。簡体字なし。
- `go test ./...` 全通過・`go vet` クリーン・`gofmt` 済み。FE `tsc --noEmit` エラーなし・Vitest 89 通過。
- 既存マイグレ 000001-000019・DES/REQ 本体は未改変（新規は 000020 のみ・docs/design 差分なし）。

---

## 8. 次ステップ

- 設計担当が CHANGE（060〜）を三点セット（通知書＋改訂 DES＋change-report）で起票（§6 の反映先）。
- **M16-03（G-h＝起き攻め正規化）** に着手（friend 語彙棚卸しを実装前に挟む）。
- **表記 rollout（M16-06）** の FB⑨⑪⑬「始動」明示ラベルは本サブ（① 消費列）確定後に実施（順序依存）。

---

## 9. 追補 v1.0.1（比較画面にゲージ始動・消費を同時掲載・A-1 / CHANGE-060 §7-1）

### 9.1 背景・実施
M16-02 本体で「消費」を比較軸に追加した結果、比較画面（`CompareTable`）に **drive/SA の始動残量が元々無い**まま消費だけが載る非対称が判明（M16-01 伝達メモ A-1）。開発者確定（CHANGE-060 §7-1 A-1）により、比較に**始動残量も同時掲載**して非対称を一括解消した。

- **比較データは無改変で 4 フィールド既載**: `ComparePage` → `useCompareCombos(ids)` が `GET /api/combos/:id` を `ComboDetail` で取得。`ComboDetail`（`ComboSummary` 継承）は `driveAvailableAtStart`/`saAvailableAtStart`（既存）＋ `saGaugeConsumed`/`driveGaugeConsumed`（本サブ）を含む。→ **DTO / API 契約 / fetch 経路は一切変更なし**。
- **CompareTable.tsx**: `rows` に**ゲージ 4 行を連続ブロック**で配置（`damage` 直後）。順序＝drive 始動 / SA 始動 / drive 消費 / SA 消費。既存 `damage`/`knockdownAdvantage` 行と同じ `tabular-nums` パターン、NULL は formatter が `-` を返す既存挙動。消費 2 行は旧位置（knockdown 直後）から本ブロックへ移設（重複なし）。
- **i18n**: `compare.row.driveAvailableAtStart`/`saAvailableAtStart` を ja/en に追加（消費 2 キーは本体で追加済み）。「DR」略記を使わず正式名称。
- **一覧列は現状維持**（A-1＝過密回避）。スキーマ/API/VAL 不変・消費の VAL 非連動維持。

### 9.2 テスト（Vitest）
- `CompareTable.test.tsx`: ゲージ 4 ラベル表示・始動/消費の判別・値並び（始動 2.5/3・消費 3.5/5）・NULL=`-` を追加。既存比較行の非回帰維持。
- 全 656 FE テスト通過・`tsc --noEmit` エラーなし。

### 9.3 表記デルタ（要・設計担当調整）
- 比較行ラベルは開発者指定どおり **「始動残量」**（例「ドライブゲージ始動残量」）を採用。一方、**詳細メタデータ（`comboDetail.metadata.*`）は既存「開始残量」表記のまま**（本追補は比較のみ）。
- この「始動残量 / 開始残量」の**表記デルタは意図的な暫定状態**であり、**「始動」明示の正典ラベル最終形は M16-06 表記 rollout（FB⑨⑬）で統一**されたい（詳細・比較・入力欄の横断統一）。

### 9.4 設計担当への伝達メモ（追補分・CHANGE-061 見込み）

| 反映先 | 内容 |
|--------|------|
| DES-005 §5.8 | 比較画面にゲージ 4 行（drive/SA の始動残量・消費）を比較軸として掲載。始動/消費はラベルで判別。一覧列には**追加しない**（A-1・過密回避） |
| （M16-06 連携） | (a) 比較「始動残量」/ 詳細「開始残量」の表記デルタを rollout で正典ラベルへ統一。(b) en ラベルの語法非対称（始動 `(start)` / 消費 `consumed`）も同時に統一（追補レビュー低指摘の回収先） |

---

## 10. 追補 v1.0.2（消費入力欄の UI 上限クランプ・F-1(a)・① VAL 非連動は維持）

### 10.1 背景・実施
納品後、開発者から「消費の上限が画面で強制されず超過値が保存できる（SA=7 等）」との差戻し（伝達メモ F-1）。開発者確定（2026-07-05）により **(a) UI 上限クランプのみ**の暫定対応を採用（(b) フル検証＝① 撤回ではない）。

- **`ComboEditorBasicFields.tsx`**: `clampNumericString(raw, min, max)` を新設。消費入力欄の `onChange` を **SA 消費＝[0,6] / drive 消費＝[0,20]** にクランプ。`<input type="number" max>` はタイプ入力を弾かない（F-2）ため**値レベル**で丸める。範囲内はタイプ途中の表記（`""`/`"1."`/`"1.5"`）を保持し、範囲外のときだけ min/max へ収める。
- **① VAL 非連動は維持**: 保存をブロックする範囲 ERROR は付けない（zod/BE **無改変**）。クランプは「入力欄が範囲外値を保持しない」挙動のみ。**BE/CSV/直接 API は依然 >max を受理**（記録の自由度＝① の本旨）。`TestGaugeConsumedNoValidation` は不変（Go 変更ゼロ）。
- **始動残量欄は不触**（drive/SA の始動は現状の保存時 zod のまま）。→ 消費だけクランプするため**始動/消費で入力挙動が非対称**になるが、F-1(a) の暫定範囲として容認（始動側も揃えるかは M16-06 か別途判断）。
- スキーマ・DTO・dup（`DuplicateKey`/VAL-C02）・`recipe_cache`・CSV 契約は**一切変更なし**。

### 10.2 テスト（Vitest）
- `clampNumericString` 単体: 上限超（7→6 / 25→20 / 20.5→20）・下限未満（-3→0）・範囲内の表記保持（`3`/`1.5`/`1.`/`.5`）・空文字保持。
- widget 統合: sa-consumed に `7`→`6`、drive-consumed に `25`→`20` でクランプして onChange。
- schema.test.ts は不変（消費 zod は範囲外でも success:true＝① 維持を継続確認）。全 662 FE 通過・`tsc --noEmit` クリーン。

### 10.3 設計担当への伝達メモ（追補 v1.0.2 分・CHANGE 見込み）

| 反映先 | 内容 |
|--------|------|
| DES-005 §5.7 | 消費入力欄は上限を **UI クランプ**で担保（`<input max>` はタイプ入力を弾かないため値レベルでクランプ）。始動欄は現状クランプなし＝入力挙動が非対称（暫定・M16-06 で揃えるか判断） |
| DES-006 §2.4 | 消費は **範囲 VAL 非連動（BE/CSV）** を維持・範囲は **UI クランプ**で担保。構文検証 VAL-I05 は残る。zod 範囲 ERROR は依然設けない |
