# M16-01 レビューチェックリスト

| 項目 | 内容 |
|------|------|
| 対象指示書 | `docs/instructions/phase3/M16-01-drive-available-to-real.md` v1.0.0（ドライブ始動残量の小数化＝`combos.drive_available_at_start` INTEGER→REAL・G-g） |
| 対象指示書ID | M16-01 |
| レビューモデル | Sonnet 4.6（model-allocation v1.29.0。実使用は開発者判断） |
| バージョン | 1.0.0 |
| 作成者・作成日 | 設計担当 Claude（フェーズ3 継続担当・M16 期）/ 2026-07-05 |

> **文書ID ⇄ 実パスの正は `docs/handover/docs-map.md`（自動生成）**。本書は docs-map 準拠の実パスを併記する。

## 更新履歴

| 版 | 更新日 | 更新内容 |
|----|--------|----------|
| 1.0.0 | 2026-07-05 | 初版（指示書 v1.0.0 と対）。 |

---

## 0. レビュー担当への前置き

### 0.1 レビュー前の準備

- 必読: 指示書 v1.0.0、M16-overview v1.0.0 §4.2/§6、DES-003 §3.4、DES-005 §5.7/§5.8、DES-006 VAL-C04/VAL-D03/VAL-C13、code-facts §8（`model.Combo`）/§7-2（combo DTO）/§9（`UpdateMetadataInput`・`DuplicateKey`）/§10（**000016 `change_drive_damage_to_real`**・最新 000018・次 000019）、retrospective-digest §1-A/§5。
- **Plan Mode 着手前確認結果の確認（必須・playbook §8.4.4）**: 指示書 §3.4 の **7 項目すべて**（1 現行宣言＋000016 技法 view / 2 マイグレ 000019 技法・FK 連鎖・down 整合 / 3 型変更の全経路 grep / 4 widget 0.5 刻み / 5 検証 / 6 CSV 後方互換 / 7 dup 非対象確認）に Plan Mode 質問書＋開発者回答が残っているか。未確認のまま実装した項目があればその時点で重大（§9＝推測実装）。

### 0.2 レビューの基本姿勢

- **承認ゲート G-g**: マイグレ実装は**開発者の個別承認後**に着手されたかを確認（着手前承認の証跡）。
- 破壊的マイグレは E2E が重い。**マイグレ up/down・`dbtest.Setup` 波及・down 整合・既存値保全**をコードとテストで確認し、目視は手順書で補う。
- **型変更（`*int`→`*float64`）の消費経路の取りこぼし**を最優先で確認（1 箇所でも漏れると型エラー or 実行時破壊）。

### 0.3 レビュー結果の報告フォーマット

- 各節ごとに「OK / 重大（§9）/ 軽微（§10）/ 質問（§11）」で報告。重大は完了承認を妨げる。

---

## 1. 設計書本体・上位文書との照合（最重要）

### 1.1 型変更（DES-003 §3.4・指示書 §4.1/§4.2）

- [ ] DB `combos.drive_available_at_start` が 000019 で **REAL** になっているか（既存整数値が REAL へ無損失昇格＝2→2.0）。
- [ ] `model.Combo.DriveAvailableAtStart` が **`*float64`**（db:drive_available_at_start）になっているか（`DriveDamage *float64` に整合）。
- [ ] `ComboResponse`/`CreateRequest` の `driveAvailableAtStart` が `*float64`、`UpdateMetadataRequest`/`UpdateMetadataInput` が `Optional[float64]`（`driveDamage` に整合）か。
- [ ] repository の combos SELECT/INSERT/UPDATE スキャン・バインドが `float64` へ追従しているか。

### 1.2 マイグレ技法（000016 踏襲・指示書 §3.4-1/§4.1）

- [ ] 000019 が **000016 `change_drive_damage_to_real` の非破壊テーブル再構築**（FK=OFF・一時名経由・`CREATE new`→`INSERT SELECT`→`DROP`→`RENAME`→index 再作成）を踏襲しているか。ALTER で型を直接変えていないか（SQLite 不可）。
- [ ] combos を参照する **combo_steps/combo_tags/combo_setups の FK・index が再構築後も保全**されているか（000016 と同手順）。

### 1.3 入力 widget・表示（DES-005 §5.7/§5.8・指示書 §4.3）

- [ ] ドライブ始動残量入力欄が **0.5 刻み**（`step=0.5`・`min=0`・`max=6`）で、`drive_damage` 小数入力の方式に倣っているか。**test-id `combo-editor-drive-available` が温存**されているか（M15-01 実値・digest §4）。
- [ ] FE zod が小数（0〜6）を許容し範囲外を弾くか。一覧/詳細/比較（§5.8）で小数が崩れず表示されるか。

### 1.4 検証（DES-006・指示書 §4.4）

- [ ] VAL-C04 が「0〜6 の範囲内か（**小数許容**）」になっているか（範囲のみ・0.5 刻みは UI 担保＝VAL-C13 と同方針）。create/promote 実行・PATCH 非実行（VAL-D03 と一貫）。
- [ ] DES-006 CHANGE 要否判定が完了報告にあり、**製造が DES を直接編集していない**か（要なら設計担当起票）。

### 1.5 DES 直接編集の禁止

- [ ] 型・widget・検証の変更詳細を製造担当が DES/REQ に直接書いていないか（DES 反映は設計担当判断・伝達メモで申し送り）。

---

## 2. マイグレーションの健全性（retro・digest §5）

- [ ] **FK=OFF と明示 DELETE が同一指示書に同居していない**か（digest §5・M12-5）。本サブは**型変更のみで行 DELETE を伴わない**想定＝伴っていれば重大。
- [ ] `dbtest.Setup` が 000019 を含む全マイグレを適用し、**全既存テストが新スキーマで通過**するか（M9-1）。
- [ ] `migrate_test.go` 等の **down 整合**（000019.down で INTEGER へ戻す・**小数値の丸め方針が明記**されているか）。
- [ ] 既存マイグレ（000016 含む・編集禁止）を改変していないか。連番 000019 で新規追加しているか。

---

## 3. データ層・API の整合（指示書 §4.2・code-facts §8/§7-2/§9）

- [ ] `model.Combo` の db/json タグが新型（`*float64`）と一致するか。
- [ ] PATCH（`UpdateMetadataRequest`→`UpdateMetadataInput`）で小数が更新でき、`Optional[float64]` の不変更/クリアが既存トライステートで成立するか。
- [ ] `DuplicateKey` が **drive_available_at_start を含まないまま**（不変）か（dup 非対象）。

---

## 4. テストの妥当性（ケース数で確認。指示書 §5 ↔ §7 DoD）

### 4.1 Go

- [ ] マイグレ up/down（REAL 化・既存整数値保全・down で INTEGER 復元＋丸め）。
- [ ] model/DTO/repository（`float64` read/write・**0.5 値〔例 2.5〕の保存/取得**・PATCH 小数更新）。
- [ ] 検証（VAL-C04 が小数の 0〜6 を許容・範囲外を ERROR・VAL-D03 draft 範囲チェック）。
- [ ] dup 非回帰（CheckDuplicate が drive 始動残量に非依存・型変更前後で同一判定）。

### 4.2 FE（Vitest）

- [ ] 入力 widget が 0.5 刻みで小数入力でき zod が小数許容・test-id 不変。
- [ ] 一覧/詳細/比較で小数表示が崩れない。
- [ ] number 型でビルドが型エラーなく通る（3 型＝ComboSummary/ComboDetail/Combo・CLAUDE.md §4）。

### 4.3 E2E / 手順書

- [ ] コンボ編集で 2.5 を入力→保存→リロード反映（既存導線の非回帰）。
- [ ] 比較画面で小数 drive 始動残量が表示。
- [ ] M13 CSV export/import が整数値・半値ともに往復成立（意味単位の非回帰）。

---

## 5. 設計意図との整合（精神の確認）

- [ ] **「combo↔sequence の粒度統一」**: drive 始動残量が REAL になり 0.5 刻みで扱える。
- [ ] **「blast radius 小＝dup/recipe 非対象」**: 重複判定・recipe_cache・レシピ・他 combos 列を壊していない（型変更を drive 始動残量に閉じている）。
- [ ] **「既存値を壊さない」**: 既存整数値が無損失で REAL 化され、CSV 往復が後方互換。
- [ ] **「軽快さを保つ」**: 自由な小数直打ちでなく widget 0.5 刻みに限定。

---

## 6. コード品質・規約遵守

- [ ] 曖昧語（「適切に」「必要に応じて」）依存でない（playbook §4.1）。`console.log`/`fmt.Println` 残置なし。簡体字なし。
- [ ] db/json タグ・命名が既存パターン（code-facts §8・`drive_damage` の前例）に整合するか。
- [ ] 型変更の全消費経路 grep 結果（波及網羅）が完了報告にあるか（指示書 §3.4-3）。

---

## 7. 既存挙動の温存（非破壊性）

- [ ] `sa_available_at_start`（INTEGER 0〜3）・起き攻め 6 bool・drive_damage・knockdown_advantage 等の他 combos 列が不変か。
- [ ] combo_steps・レシピ・recipe_cache が不変か（drive 始動残量はレシピ非対象）。
- [ ] 重複判定（VAL-C02・DuplicateKey）・M13 CSV 往復が不変か。
- [ ] 既存整数値が再計算・改変されていないか（無損失昇格のみ）。

---

## 8. ドキュメント・進捗ログ

- [ ] 完了報告に Plan Mode 確定方式（7 項目）・テストケース数・既知の制約（down 丸め方針等）が含まれるか（指示書 §7.4）。
- [ ] DES-003 §3.4 / DES-005 §5.7/§5.8 / DES-006 VAL-C04 への CHANGE 見込みの具体化点を**設計担当への伝達メモ**で申し送っているか（DES 反映は設計担当判断）。

---

## 9. 重大な問題の判定基準（完了承認を妨げる）

- Plan Mode 7 項目（§3.4）のいずれかが未確認のまま実装されている（推測実装）。
- **承認ゲート G-g の着手前承認を経ずにマイグレ実装している**。
- マイグレ 000019 が ALTER で型を直接変更しようとしている、or 再構築で **combos の FK/index を壊している**（combo_steps/combo_tags/combo_setups 破壊）。
- **型変更（`*int`→`*float64`）の消費経路を取りこぼしている**（model/DTO/repo/FE/CSV/検証のいずれか＝型エラー or 実行時破壊）。
- **既存整数値が保全されていない**（マイグレで値欠落）。or **down 整合がない**（丸め方針未記載含む）。
- **drive_available_at_start を dup キー（DuplicateKey/VAL-C02）or recipe_cache に入れてしまった**（非対象前提に反する）。
- `dbtest.Setup` 経由で既存テストを壊す。FK=OFF と明示 DELETE が同居している（digest §5）。
- 既存マイグレ（000016 等・編集禁止）を改変している。製造担当が DES/REQ 本体を直接編集している。

## 10. 軽微な問題の判定基準（持ち越し許容）

- CSV の REAL 書式（"2" vs "2.0"）の細部（往復が成立していれば可）。
- 入力欄の配置・ラベル細部（drive_damage 小数入力に倣う範囲）。
- down の丸め方式（切捨て/四捨五入）の選択（方針が明記され整合していれば可）。

## 11. 質問・確認事項のフォーマット

- 「指示書 §X.X / DES-00N（実パス）§Y / code-facts §Z に対し実装が W。意図確認したい」の形で根拠節を併記して設計担当へ。マイグレ技法に疑義があれば 000016 との差分を明記して照会。

## 12. レビュー完了の判定

- §1〜§8 が全て OK、§9 重大ゼロ（**特にマイグレ技法・型変更全経路・dup/recipe 非対象・既存値保全・down 整合**）、§0.1 の Plan Mode 着手前確認（7 項目）が揃っている。§10 軽微は持ち越し可。

---

*以上、M16-01 レビューチェックリスト v1.0.0。配置 `docs/instructions/phase3/reviews/M16-01-review-checklist.md`。指示書 v1.0.0 と対。**型変更の全消費経路の網羅・000016 技法踏襲・dup/recipe 非対象・既存値保全**を最重要ゲートとする。承認ゲート G-g の着手前承認を確認すること。*
