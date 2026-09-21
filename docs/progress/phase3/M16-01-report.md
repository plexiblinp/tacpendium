# M16-01 完了報告書（`combos.drive_available_at_start` INTEGER→REAL・G-g）

| 項目 | 内容 |
|------|------|
| 対象指示書 | `docs/instructions/phase3/M16-01-drive-available-to-real.md` v1.0.0 |
| 承認ゲート | **G-g**（マイグレ着手前の個別承認）＝ Plan Mode 計画提示 → 開発者承認（ExitPlanMode）で取得済み |
| 実装モデル | Opus 4.8（1M context）＋ Plan Mode |
| 完了日 | 2026-07-05 |
| 対象コミット | `00af7fa`（マイグレ 000019）/ `5c8b6cb`（データ層・検証・CSV）/ `ac4b4bd`（FE 入力小数化） |
| レビュー | fresh subagent（独立）→ `docs/progress/phase3/m16-01-review.md`。重大ゼロ・高/中ゼロ・低 2 件 |

---

## 1. 実施サマリ

`combos.drive_available_at_start` を **INTEGER→REAL** 化し、コンボ開始時のドライブゲージ残量を
**0.5 刻み**で入力・保存・表示できるようにした（combo↔sequence の粒度統一）。型変更は同一テーブルの
`drive_damage`（000016 で REAL 化済み）を範型として全消費経路に反映。始動残量は dup キー・recipe 非対象の
ため blast radius は小さく、重複判定・recipe_cache・他 combos 列は不変。

---

## 2. Plan Mode 着手前確認（§3.4 の 7 項目）の確定方式

推測実装を避けるため、着手前に 3 系統の read-only 調査（マイグレ/Go/FE・CSV）を実コードで実施し確定。

1. **現行宣言 + 000016 技法**: 現行 `drive_available_at_start INTEGER`（000016 up が最新の combos 再構築・27 列）。
   000016 は非破壊テーブル再構築（`CREATE new_combos`→`INSERT…SELECT` 全 27 列→`DROP combos`→`RENAME`→index 5 本再作成）。
   FK 連鎖回避＝migrate 接続の FK=OFF 既定（`migrate.go` は PRAGMA 無し接続、app のみ `db.go` で FK=ON）＋
   一時名 `new_combos` 経由で legacy_alter_table の子 FK 自動書換を回避。000019 はこれを逐語踏襲。
2. **000019 技法**: 000016 をコピーし `drive_available_at_start` の宣言型のみ INTEGER→REAL（up）/REAL→INTEGER（down）。
   行 DELETE を伴わない（FK=OFF × 明示 DELETE 非同居を遵守）。子テーブル combo_steps/combo_tags/combo_setups の
   FK・index は再構築で不変。`dbtest.Setup` 経由の全既存テストが新スキーマで通過。
3. **型変更の全消費経路（grep 全数）**: model / DTO（ComboResponse・CreateRequest・UpdateMetadataRequest）/
   service（CreateInput・merge・build）/ repository（UpdateMetadataInput・INSERT bind・scan・UPDATE の addOptFloat）/
   検証（VAL-C04）/ CSV（csvcore DTO・rules・validate・csvexport・comboio import/export）/ FE（parse・zod・widget）。
   `*int`→`*float64`・`Optional[int]`→`Optional[float64]` を漏れなく反映（grep で `*int` 残置ゼロ）。
4. **入力 widget の 0.5 刻み**: `combo-editor-drive-available`（test-id 温存）に `step=0.5`・`min=0`・`max=6`、
   `blockNonNumericKeys(false, true)`（負値不可・小数可）。parse を `parseOptInt`→`parseOptFloat`（`Math.trunc` 切り捨て回避）。
   zod `optInt(0,6)`→`optFloat(0,6)`。drive_damage 小数入力（DES-005 §5.7）を範型とした。
5. **検証**: VAL-C04 を小数許容（`v float64`・`%d`→`%g`・範囲 0〜6 のみ・0.5 刻みは UI 担保＝VAL-C13 と同方針）。
   VAL-D03 は**コード実体なし**（doc コメントのみ）＝変更不要。CSV 側は `DriveAvailableRange` を `FloatRange` 化・`floatField` へ。
6. **CSV 後方互換**: DTO `*float64`、export `floatPtrToStr`（2→"2"・2.5→"2.5"）、import `parseFloatPtr`（旧整数 CSV も読める）。
   列名・列構造は不変＝旧 CSV 往復に頑健。
7. **dup 非対象**: `DuplicateKey`（character/starter/position/stance/hitType/size の 6 フィールド）・
   `FindActiveByDuplicateKey` WHERE 句・service 側 `validation.DuplicateKey` に drive_available_at_start は非含有。
   型変更で重複判定は変わらない（回帰確認のみ）。

---

## 3. down の丸め方針（既知の制約）

- **切り捨て（開発者確定 2026-07-05）**。000019.down の `INSERT…SELECT` で `CAST(drive_available_at_start AS INTEGER)`
  （SQLite は 0 方向切り捨て・2.5→2）を使い、列型を確実に整数値へ収束させる。
- 前例 000016.down（型親和性依存で小数を残す）とは手順が異なる点を down SQL コメントに明記。
- down は開発時ロールバック用途。実運用データに 0.5 が入った状態での down は稀。

---

## 4. 自己テスト結果（ケース数）

### Go
- **マイグレ 000019**（`internal/infra/migration/migrate_test.go`）:
  - `TestRun_DriveAvailableAtStartRealRoundTrip`: 宣言型=REAL 確認＋ round-trip 5 値（0 / 2 / 2.5 / 5.5 / 6）。
  - `TestRun_DriveAvailableAtStartDownRollback`: up=REAL → 2.5 投入 → down=INTEGER・値 2（切り捨て）・drive_damage=REAL 不変 → 再 up=REAL。
- **検証 VAL-C04**（`internal/service/validation/combo_test.go`）: OK 5 値（0/2.5/3/5.5/6）・範囲外 5 値（-0.5/-1/6.5/7/100）。
- **service PATCH**（`internal/service/combo/service_test.go`）: `Optional[float64]` の範囲外 999.0 で VAL-C04 エラー。
- **CSV**（`internal/service/comboio/csvcore/csvcore_test.go`）: golden 往復に 2.5 を組込＋`TestDriveAvailableDecimalRange`（5.5 往復成立・6.5 で 1 ERROR）。
- `go test ./...` 全通過（`dbtest.Setup` 経由の全既存テスト非回帰）。

### FE（Vitest）
- `ComboEditorBasicFields.test.tsx`: widget 属性（step=0.5・min=0・max=6）＋非負+小数キーガード（`.` 許可・`-` 抑止）＋test-id 温存回帰。
- `schema.test.ts`（新規）: zod が 2.5/整数 3 を許容・6.5/-0.5 を弾く。
- 全 647 FE テスト通過・`tsc -b` 型エラーなし・`vite build` 成功。

---

## 5. 実コードと指示書想定の相違（§2.4 例外条項＝実コードを正・記録）

1. **一覧・比較画面に drive_available_at_start の表示が元々存在しない**。指示書 §2.2/§5.2/§5.3 は
   「一覧/比較で小数表示」を想定するが、実コードでは **詳細（`ComboDetailMetadata`）のみ**が当該フィールドを描画し、
   `formatDriveGauge`（`toFixed(1).replace(/\.0$/,"")`）が既に小数対応（2.5→"2.5"）。比較（`CompareTable`）は
   drive 始動残量行を持たない。型変更による回帰は無い（比較は当該フィールドを参照しない）。
   → **比較行の新設はスコープ外**（新機能化を避ける）とし、下記「設計担当への伝達メモ」で申し送る。
2. **VAL-D03 はコード実体なし**（doc コメントのみ）。draft 時 NULL 許容は VAL-C04 の nil スキップで成立しており変更不要。

---

## 6. 設計担当への伝達メモ（CHANGE 060〜 見込み・DES 反映は設計担当が起票）

| 反映先 | 内容 |
|--------|------|
| DES-003 §3.4 | `drive_available_at_start` の型を INTEGER→REAL（0〜6・0.5 刻み・CHECK 不使用＝BE 検証＋UI 担保は据置） |
| DES-005 §5.7 | 登録/編集の入力欄を 0.5 刻み widget（`step=0.5`・0〜6・非負）に |
| DES-005 §5.8 | 比較画面に drive 始動残量行は**現状未実装**。小数表示の要否（比較軸へ追加 or 非表示確定）を判断されたい |
| DES-006 VAL-C04 | 「0〜6 の範囲内（**小数許容**）」を明記（0.5 刻みは UI 担保＝VAL-C13 と同方針） |

---

## 7. 品質チェック

- 型変更の全消費経路 grep 網羅（§2-3）。`*int` 残置ゼロ。dup 非対象を grep で再確認（§2-7）。
- 禁則表現（「適切に」「必要に応じて」等）は本サブで新規追加せず。`console.log`/`fmt.Println` 残置なし。簡体字なし。
- 既存マイグレ 000001-000018・DES/REQ 本体は未改変（`git diff --name-only` で 000019 のみ・docs/design 差分なし）。

---

## 7.5 実機検証（live E2E・2026-07-05 追試）

- フレッシュビルドのバイナリを test port/temp DB で起動し、`POST /api/combos` に
  `{"characterId":1,"isDraft":true,"driveAvailableAtStart":0.5,"driveDamage":2.5,"steps":[]}` を送信 →
  **HTTP 201**、レスポンス・read-back とも `driveAvailableAtStart:0.5` / `driveDamage:2.5` を保持。
  マイグレ→DTO→service→repository→SQLite→レスポンスの一気通貫を実機で確認。
- **運用上の注意（重要）**: 型変更（DTO `*int`→`*float64`）は **バックエンド再起動が必要**。
  再起動前の stale binary は 0.5 送信に対し `400 Unmarshal type error: expected=int, got=number 0.5,
  field=driveAvailableAtStart`（旧 `int` DTO）を返す。Vite フロントは HMR で即時反映されるため、
  **「フロントは 0.5 を送るのにバックエンドが 400」＝バックエンド未再起動**のサイン。コード欠陥ではない。
  （開発者テスト 2026-07-05 でこの 400 を観測 → 原因は dev サーバ未再起動と特定・現行ソースでは再現せず。）

## 8. 次ステップ

- 設計担当が CHANGE（060〜）を三点セット（通知書＋改訂 DES＋change-report）で起票（§6 の 4 点）。
- **M16-02（G-f＝SA/drive 消費列追加）** に着手（本サブで確定した drive の REAL/0.5 型方針を共有）。
