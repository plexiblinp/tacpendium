# M16-01 レビュー報告書

対象: M16-01（`combos.drive_available_at_start` INTEGER→REAL 化・0.5 刻み・widget 統一・承認ゲート G-g）
対象コミット: `00af7fa`（マイグレ 000019）/ `5c8b6cb`（データ層・検証・CSV）/ `ac4b4bd`（FE 入力小数化）。ベース `8a4134d`。
レビュー方式: read-only。`git diff 8a4134d..HEAD` 全読み＋ grep 網羅検証＋ `go build ./...`・対象 Go テスト・FE Vitest 2 ファイルの実行確認。

## 総評

指示書 §3.4 の 7 項目・チェックリスト §9 重大観点をすべて満たしており、**重大（完了承認を妨げる）指摘はゼロ**。マイグレ 000019 は前例 000016 を逐語踏襲した非破壊テーブル再構築で、FK=OFF・一時名経由・index 再作成・行 DELETE 非同居まで正しく踏襲。型変更（`*int`→`*float64` / `Optional[int]`→`Optional[float64]`）は model/DTO(3)/repository/service/CSV/検証/FE の全消費経路で漏れなく反映され、`go build ./...` と対象テスト（Go・FE 計 21 FE ケース＋新規 Go 3 テスト）が全通過。dup キー・recipe_cache への非混入、test-id 温存、既存整数値の無損失昇格も確認済み。品質は高い。残る指摘は低優先の観察事項と、コード外で確認不能な承認証跡のみ。

## 設計準拠性レビュー結果

### 1. 型変更（DES-003 §3.4 / 指示書 §4.1-4.2）— ◎
- DB: 000019 で `drive_available_at_start REAL`。既存整数値は `INSERT…SELECT` 素通しで REAL 昇格（2→2.0、CAST 無し=無損失）。`migrate_test.go` の新 `TestRun_DriveAvailableAtStartRealRoundTrip` が宣言型=REAL と 0/2/2.5/5.5/6 の round-trip を検証。◎
- `model.Combo.DriveAvailableAtStart *float64`（db タグ据置・`DriveDamage *float64` に整合）。◎
- `ComboResponse`/`CreateRequest` = `*float64`、`UpdateMetadataRequest`/`UpdateMetadataInput` = `Optional[float64]`。◎
- repository: INSERT バインド（:235）・SELECT スキャン（:915）・`addOptFloat`（:624）が `float64` 追従。service `CreateInput`（:57）、merged 反映（:314）、CSV DTO 変換（export.go:125 / import.go:344）まで一気通貫。grep で `*int` 残置ゼロを確認。◎

### 2. マイグレ技法（000016 踏襲 / 指示書 §3.4-1・§4.1）— ◎
- `CREATE new_combos`（drive_available_at_start のみ REAL、他 26 列は 000016 と同一）→`INSERT…SELECT`→`DROP combos`→`RENAME`→ index 5 本再作成。ALTER 型変更は不使用（SQLite 不可を正しく認識）。◎
- FK 連鎖: migrate 接続 FK=OFF（modernc 既定）＋一時名 new_combos 経由で legacy_alter_table の子テーブル参照自動書換を回避。combo_steps/combo_tags/combo_setups は "combos" 参照のまま。コメントにも明記。◎
- 000016〜000019 間の 000017 は combos への DELETE（データのみ・列不変）、000018 は moves のみ。よって 000019 が 000016 の列集合で再構築しても列欠落は起きない。up の「現行スキーマは 000016 の再構築を反映」記述は正確。◎
- index: 000001/000016 と同一の 5 本（idx_combos_character_id/deleted_at/starter_move_id/situation_filter/updated_at）を全数再作成。000016 以降に追加された combos index は無し（grep 確認）。◎

### 3. down 整合・丸め方針（digest §5 / 指示書 §4.1）— ◎
- 000019.down は REAL→INTEGER。丸め=切り捨てを `CAST(drive_available_at_start AS INTEGER)`（SQLite は 0 方向切り捨て、2.5→2）で明示実装し、コメントで開発者確定（2026-07-05）・000016 down（型親和性依存で小数残存）との差異まで記述。`TestRun_DriveAvailableAtStartDownRollback` が up→(2.5 投入)→down で INTEGER・値 2・drive_damage=REAL 不変→再 up で REAL 復元を検証。◎

### 4. FK=OFF × 明示 DELETE 非同居（digest §5・M12-5）— ◎
- up/down とも行 DELETE を含まず（`DROP TABLE` と `INSERT…SELECT` のみ）。型変更のみで regime 遵守。◎

### 5. 入力 widget・zod（DES-005 §5.7 / 指示書 §4.3）— ◎
- 入力欄 `step=0.5`・`min=0`・`max=6`、`onKeyDown={blockNonNumericKeys(false, true)}`（負値不可・小数可）。drive_damage の `(true, true)` に対し始動残量は非負なので `(false, true)` が正しい。test-id `combo-editor-drive-available` 温存。ラベルを「(0〜6本・0.5刻み)」へ自己説明化。◎
- zod: `driveAvailableAtStart` を `optInt(0,6)`→`optFloat(0,6)`（`.int()` 制約除去、範囲は据置）。新規 `schema.test.ts` が 2.5/整数 3 許容・6.5/-0.5 弾きを検証。UI テストが step/min/max/type を検証。◎

### 6. 表示（一覧/詳細/比較 §5.8）— ○
- 詳細（ComboDetailMetadata）・CSV エクスポート（export-model）とも `formatDriveGauge` 経由。同関数は `value.toFixed(1).replace(/\.0$/,"")` で 2.5→"2.5"・2→"2" と小数を崩さず表示（元々 float 想定の実装）。○
- 比較（CompareTable）: **そもそも drive_available_at_start 行が存在しない**（現行の比較行は starter/route/damage/situation/custom_states/knockdown/oki のみ）。従って指示書 §5.2/§5.3 の「比較画面で小数 drive 始動残量が表示される」は現コードベースでは検証対象が無い。型変更による回帰は無い（比較は当該フィールドを参照しないため安全）が、指示書の想定と実コードに差がある点は申し送り対象。→ 詳細は「推奨修正・低」。

### 7. 検証 VAL-C04/D03（DES-006 / 指示書 §4.4）— ◎
- `validateC04DriveRange` は `v < 0 || v > 6` の範囲チェック（小数許容・0.5 刻みは UI 担保）。エラーメッセージの書式指定子を `%d`→`%g` に修正（float 対応）。draft 時 NULL 許容（VAL-D03）は不変。◎
- CSV 側 `DriveAvailableRange` を `IntRange`→`FloatRange{0,6}`、`intField`→`floatField`（VAL-C04/ERROR）。新 `TestDriveAvailableDecimalRange` が 5.5 往復成立・6.5 で 1 ERROR を検証。◎
- DES-006 本体の「小数許容」明記は CHANGE 起票（設計担当）事項＝製造は DES を直接編集していない（`git diff --name-only ... docs/` 空）。◎

### 8. dup / recipe 非対象（指示書 §4.6・§9.3）— ◎
- `DuplicateKey`（repository/combo:35）は CharacterID/StarterMoveID/Position/OpponentStance/HitType/OpponentSize のみ＝drive 始動残量を含まず不変。recipe_cache への drive_available 混入も grep でゼロ。dup/recipe 非対象前提を維持。◎

### 9. 既存挙動温存 — ◎
- sa_available_at_start（INTEGER）・drive_damage（REAL）・起き攻め 6 bool・knockdown_advantage 等は不変（down でも drive_damage=REAL 維持をテストで確認）。既存マイグレ 000001-000018 は未改変（`git diff --name-only` で 000019 のみ）。◎

## 設計準拠性以外の指摘事項

- CSV 書式: `floatPtrToStr` は `strconv.FormatFloat(v,'f',-1,64)`（最短表記、2→"2"・2.5→"2.5"）。既存 drive_damage と同一関数で後方互換（旧整数 CSV が "2" のまま往復）＝規約準拠。良。
- 命名・タグ・コメント: db/json タグ据置、`// M16-01` 由来コメントで意図明示。曖昧語（「適切に」等）・`console.log`/`fmt.Println` 残置・簡体字は無し（grep 確認範囲）。
- テスト実行結果（本レビューで実行）: `go build ./...` 成功、`internal/{infra/migration,service/validation,service/comboio(+csvcore),service/combo,repository/*}` 全 ok、FE `schema.test.ts`(4)＋`ComboEditorBasicFields.test.tsx`(17)=21 pass。

## 推奨修正（優先度別）

- 高（M16 完了前に修正必須）: **なし**。
- 中（M17 着手と並行可）: **なし**。
- 低（将来対応）:
  1. 比較画面（CompareTable）に drive_available_at_start 行が無い件。指示書 §5.2/§5.3 が想定する「比較で小数表示」の検証対象が現状存在しないため、(a) 比較行として追加するか、(b) 指示書/設計側で「比較非表示」を確定するかを設計担当へ申し送り（本 M16-01 の型変更起因の回帰ではなく既存の表示スコープ差）。
  2. 完了報告書（`docs/progress/` 配下・Plan Mode 7 項目確定内容／テストケース数／down 丸め方針の申し送り）が本レビュー時点で未配置（RESEARCH-01 報告のみ）。指示書 §7.4/§8 ドキュメント要件として別途作成・配置を確認されたい。

## 良かった点

- 000016 を「逐語踏襲」しつつ差分を drive_available_at_start 1 列に閉じており、レビュー可能性が非常に高い。up/down コメントで FK=OFF 前提・一時名経由の理由・丸め方針・000016 との差異まで自己文書化されている。
- down の丸め方針を「宣言だけ」で済ませず `CAST` で実装し、rollback テストで 2.5→2 まで実証している点が堅実（digest §5 の down 整合要求を実挙動で担保）。
- 型変更の波及を model/DTO/repo/service/CSV/検証/FE zod/FE widget まで一貫追従し、エラーメッセージ書式指定子（`%d`→`%g`）まで漏らさず対応。grep でも `*int` 残置ゼロ。
- 新規テストが「境界値・0.5 刻み・範囲外・round-trip・rollback」を過不足なくカバー。

## 制約事項

- 本レビューはコード上で判定可能な範囲のみ対象。実際の動作確認・パフォーマンス・実機テストは別途実施が必要。
- 不明（コードから判定不能）:
  - 承認ゲート G-g の「マイグレ着手前の開発者個別承認」証跡、および Plan Mode 7 項目の質問書＋回答は、リポジトリ上のコード/差分からは確認できない。完了報告・チャットログ側で確認を要する（チェックリスト §0.1/§9 該当）。

---

## 取り込み結果（自動トリアージ・製造担当 2026-07-05）

`implement_plan_full` Phase C。**高/中の指摘ゼロ**のためエスカレーション不要。低 2 件の採否と理由:

| # | 指摘（優先度） | 採否 | 理由 |
|---|----------------|------|------|
| 低-1 | 比較画面に drive_available_at_start 行が無い（指示書 §5.2/§5.3 想定との差） | **不採用（コード変更せず・設計担当申し送り）** | 比較行の新設は型変更を超える新機能追加でありスコープ外。指示書 §2.4 例外条項（実コードを正）とスコープ厳守方針に従い、完了報告 §5-1 と伝達メモ（§6・DES-005 §5.8）で申し送る。型変更による回帰は無い（比較は当該フィールド非参照）。 |
| 低-2 | 完了報告書が docs/progress/ に未配置 | **採用** | 指示書 §7.4/§8 のドキュメント要件。`docs/progress/phase3/M16-01-report.md` を作成（Plan Mode 7 項目確定方式・テストケース数・down 丸め方針・実コード相違・CHANGE 060〜 伝達メモ・G-g 承認証跡を収録）。 |

**不明（コード外）への手当て**: G-g 着手前承認＝Plan Mode 計画提示への開発者承認（ExitPlanMode）で取得済み。Plan Mode 7 項目の確定内容は完了報告 §2 に収録。いずれも完了報告書側で証跡化した。
