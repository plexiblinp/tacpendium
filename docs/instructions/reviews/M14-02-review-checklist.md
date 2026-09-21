# M14-02 レビューチェックリスト

| 項目 | 内容 |
|------|------|
| 対象指示書 | `docs/instructions/M14-02-import-pipeline-staged-removal.md` v1.0.0（取込パイプライン段階削除＝共有シンボル移設→movesimport 削除→画面17 除去・FR704 降格） |
| 対象指示書ID | M14-02 |
| レビューモデル | Sonnet 4.6（model-allocation v1.24.0 参照。実使用は開発者判断） |
| バージョン | 1.0.1 |
| 作成者・作成日 | 設計担当 Claude（M14 担当）/ 2026-06-30 |

> **文書ID ⇄ 実パスの正は `docs/handover/docs-map.md`（自動生成）**。本書は docs-map 準拠の実パスを併記する。

## 更新履歴

| 版 | 更新日 | 更新内容 |
|----|--------|----------|
| 1.0.0 | 2026-06-30 | 初版（指示書 v1.0.0 と対）。 |
| 1.0.1 | 2026-06-30 | 指示書 v1.0.1 追従。(1) move-warning.ts の死蔵3ラベル整理（total_null/extra_throw のみへ縮小・ファイル温存）のチェックを §1.1/§3 に明確化。(2) 取込専用 repository メソッド UpsertMove/UpsertOfficialJaAlias 削除のチェックを §1.2 に追加。(3) §9 重大に死蔵コード残置を追加。 |

---

## 0. レビュー担当への前置き

### 0.1 レビュー前の準備

- 必読: `docs/instructions/M14-02-import-pipeline-staged-removal.md` v1.0.0、`docs/instructions/M14-overview.md` v1.0.0 §2.1/§4.2/§4.3、M14-RESEARCH-01-report（`docs/progress/M14-RESEARCH-01-report.md`）§B、M14-01 設計担当伝達メモ §2/§3、REQ-001（`docs/design/requirements.md`）§3.8 FR701〜704、DES-002（`docs/design/02-architecture.md`）§4.2/§7.5、DES-005（`docs/design/05-screen-design.md`）§5.17/§4.1、code-facts §3/§4/§6。
- **Plan Mode 着手前確認結果の確認（必須・playbook §8.4.4）**: 指示書 §3.4 の **7 項目すべて**（1 共有シンボル再 grep / 2 移設先・対象 / 3 movesimport 削除範囲 / 4 画面17・FE 削除範囲 / 5 エンドポイント・テスト除去 / 6 FR704 降格 CHANGE スコープ / 7 段階削除順）に Plan Mode 質問書 + 開発者回答が残っているか。未確認のまま実装した項目があればその時点で重大（§9 = 推測実装）。

### 0.2 レビューの基本姿勢

- **本サブの肝は「逆依存の解消」**。技編集（温存）が取込パッケージを参照する逆依存を、共有シンボル移設で断つ。**段階削除の各段階で build/tsc が通る順序**になっているかをコードで確認する。
- 削除が広範のため、**温存すべきもの（技編集・move-warning.ts SSOT・moves スキーマ・export/import）が壊れていない**ことを重点確認する。

### 0.3 レビュー結果の報告フォーマット

- 各節ごとに「OK / 重大（§9）/ 軽微（§10）/ 質問（§11）」で報告。重大は完了承認を妨げる。

---

## 1. 設計書本体・上位文書との照合（最重要）

### 1.1 共有シンボル移設（指示書 §4.1・report §B）

- [ ] `WarningCode`（値 `total_null`/`extra_throw`）・`StoredMove`・`DeriveStoredWarnings` が中立パッケージ（例 `internal/service/movewarning`）へ移設されているか。
- [ ] 技編集側（`api/move/dto.go` の `MoveResponse.warnings`・`api/move/handler.go` の再導出）の参照が中立パッケージへ差し替わっているか。
- [ ] `IsKnownProperty` が**移設されず削除**されているか（M14-01 で消費者消失＝properties PATCH 検証除去済み）。残存消費者があれば重大。
- [ ] 依存方向が一方向（技編集→中立・取込→中立）になり、**逆依存が解消**されているか。
- [ ] **FE `web/src/constants/move-warning.ts` の死蔵3ラベル整理**：`WARNING_CODE_VALUES`/`WARNING_LABEL_JA` が `total_null`/`extra_throw` のみへ縮小され、`recovery_word`/`unknown_properties`/`unknown_combo_scaling_key` が除去されているか（**ファイルは温存・削除しない**）。Plan Mode 回答（選択肢1・2026-06-30）。

### 1.2 `movesimport` 削除（指示書 §4.2）

- [ ] `internal/service/movesimport/`・`internal/api/movesimport/` が削除されているか（F1 の `validateComboScaling`/`comboScalingKeys` dead code 含む）。
- [ ] 取込エンドポイント（`POST /api/import/moves`・`/preview`）のルート登録・ハンドラが除去されているか。
- [ ] 取込テスト（commit_test/parse_test 等）が除去され、`dbtest.Setup` 経由の残テストが通過するか。
- [ ] **取込専用 repository メソッド `UpsertMove`/`UpsertOfficialJaAlias`**（`upsert.go`・interface 宣言・`service_test.go` fakeRepo モック2メソッド）が除去されているか。技編集は `ListByCharacter`/`GetByID`/`UpdateFields`/`InsertRushVariant` のみ使用＝**未使用メソッドのみ除去で挙動不変**。Plan Mode 回答（選択肢1・2026-06-30）。

### 1.3 画面17・FE 取込削除（指示書 §4.3・FR704 降格）

- [ ] `web/src/features/import/`（ImportMovesPage・api.ts・types.ts〔F2 comboScaling〕・画面17 一式）が削除されているか。
- [ ] router の取込ルート・`Header`/ナビの取込導線が除去されているか（DES-005 §4.1）。
- [ ] 画面18（技編集）の導線・表示・型が不変か。

### 1.4 FR704 降格の DES 直接編集禁止

- [ ] REQ-001 FR704 降格・DES-002/005 の反映を製造担当が REQ/DES に直接書いていないか（CHANGE 起票は設計担当。実装具体化は伝達メモで申し送り）。

---

## 2. 段階削除の健全性（本サブの肝）

- [ ] 段階削除が「中立移設→参照差し替え→取込参照中立化→movesimport 削除→画面17/FE 削除→ルート/ナビ除去」の順で、**各段階で `go build`/`tsc` が通る**構成か（コミット単位 or 説明で確認）。
- [ ] 移設前に取込を削除して技編集がコンパイル不能になる、といった順序破綻が無いか。
- [ ] repository interface（`UpsertMove`/`UpsertOfficialJaAlias` 等）が取込専用か技編集共有かを確認し、共有を誤削除していないか。

---

## 3. 温存対象の非破壊（重点）

- [ ] **技編集（画面18・`service/move`・`GET/PATCH /api/moves`・rush 生成・notes_tool 編集）が不変動作**するか（参照先パッケージのみ差し替え）。
- [ ] **FE 警告 SSOT `web/src/constants/move-warning.ts` はファイル温存**（削除しない）で、死蔵3ラベル整理後に画面18 の warnings 表示（`total_null`/`extra_throw`）が機能するか。
- [ ] **moves スキーマ（M14-01 確定）・export/import（comboio・FR401/405）が不変**か。
- [ ] **FR701（HTML→CSV 別ツール）**に触れていないか（本体外）。

---

## 4. テストの妥当性（ケース数で確認。指示書 §5 ↔ §7 DoD）

### 4.1 Go

- [ ] 技編集（GET/PATCH /api/moves・rush・notes_tool）が中立参照で不変動作（warnings 再導出が total_null/extra_throw）。
- [ ] 取込エンドポイントが 404/未登録。
- [ ] movesimport 削除後に `go build`/`go vet` 通過・`dbtest.Setup` 経由の残テスト通過。
- [ ] 中立パッケージ `DeriveStoredWarnings` 単体テスト。

### 4.2 FE（Vitest / tsc）

- [ ] 画面17・features/import 削除後に tsc/ビルド通過（F2 契約ずれ解消）。
- [ ] 画面18 warnings 表示が move-warning.ts 経由で不変。
- [ ] router に取込ルート無し・Header/ナビに取込導線無し。

### 4.3 E2E / 手順書

- [ ] 取込画面（画面17）へ到達不能。
- [ ] 画面18 の move 編集（recovery 含む）・warnings 表示の非回帰。
- [ ] M13 CSV export/import・コンボ編集の非回帰。

---

## 5. 設計意図との整合（精神の確認）

- [ ] **「逆依存を断つための段階削除」**: 一括物理削除でなく移設→削除の順を踏み、技編集を一度もコンパイル不能にしていないか。
- [ ] **「技編集は温存」**: FR703・画面18・move-warning.ts を残し、取込（FR704）のみ削除したか。
- [ ] **「移設縮小の活用」**: IsKnownProperty を消費者消失（M14-01）に基づき移設せず削除したか（不要に移設して残していないか）。

---

## 6. コード品質・規約遵守

- [ ] 共有シンボル参照経路の再 grep 結果（移設前後の全消費箇所）が完了報告にあるか（指示書 §3.4-1）。
- [ ] 中立パッケージ名・配置が既存規約（code-facts）に整合するか。
- [ ] dead code（F1）を残置していないか（movesimport ごと削除で解消）。

---

## 7. 既存挙動の温存（非破壊性）

- [ ] 画面18 の編集・warnings 表示・rush 生成・notes_tool が不変か。
- [ ] moves スキーマ・export/import・コンボ系が不変か。
- [ ] **取込が退避キーを再生成しない**（F3 解消）。

---

## 8. ドキュメント・進捗ログ

- [ ] 完了報告に Plan Mode 確定方式（7 項目）・段階削除順・テストケース数・F1/F2/F3 解消が含まれるか。
- [ ] FR704 降格・画面17/取込削除範囲を**設計担当への伝達メモ**で申し送っているか（REQ-001/DES 反映は設計担当が CHANGE 起票）。

---

## 9. 重大な問題の判定基準（完了承認を妨げる）

- Plan Mode 7 項目（§3.4）のいずれかが未確認のまま実装されている（推測実装）。
- 共有シンボルの消費箇所を取りこぼし、技編集がコンパイル不能 or warnings が壊れている。
- 段階削除の順序破綻（移設前削除等で build/tsc が途中段階で通らない）。
- 技編集（画面18・service/move・GET/PATCH・rush・notes_tool）を破壊している。
- `move-warning.ts` SSOT を誤削除している。
- moves スキーマ・export/import を改変している。
- repository 共有シンボルを誤削除している。
- 死蔵コードを残置している（move-warning.ts の死蔵3ラベル `recovery_word`/`unknown_properties`/`unknown_combo_scaling_key`、取込専用 repository メソッド `UpsertMove`/`UpsertOfficialJaAlias`、F1 の `validateComboScaling`/`comboScalingKeys` のいずれか）。
- 取込エンドポイントが残存している、or 画面17 導線が残っている。
- 製造担当が REQ/DES 本体を直接編集している。

## 10. 軽微な問題の判定基準（持ち越し許容）

- 中立パッケージ名・ファイル配置の細部（既存規約に沿う範囲）。
- 削除後の import 文整理・コメント残骸。

## 11. 質問・確認事項のフォーマット

- 「指示書 §X.X / report §B / 設計書 DES-00N（実パス）§Y に対し、実装が Z。意図確認したい」の形で根拠節を併記して設計担当へ。

## 12. レビュー完了の判定

- §1〜§8 が全て OK、§9 重大ゼロ、§0.1 の Plan Mode 着手前確認結果（7 項目）が揃っている。§10 軽微は持ち越し可。

---

*以上、M14-02 レビューチェックリスト v1.0.0。配置 `docs/instructions/reviews/M14-02-review-checklist.md`。*
