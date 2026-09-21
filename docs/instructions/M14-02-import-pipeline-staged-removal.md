# 指示書 M14-02: 取込パイプライン段階削除（共有シンボル移設 → `movesimport` 削除 → 画面17 除去・FR704 降格）

| 項目 | 内容 |
|------|------|
| 指示書ID | M14-02 |
| マイルストーン | M14（公式データ配布是正・スキーマ整理・取込画面廃止・配布 DB 同梱） |
| バージョン | 1.0.1 |
| 作成者・作成日 | 設計担当 Claude（M14 担当）/ 2026-06-30 |
| 実装モデル | **Opus 4.8 ＋ Plan Mode 必須** / レビュー Sonnet 4.6（model-allocation v1.24.0） |
| 上位文書 | M14-overview v1.0.0 §2.1/§4.2/§4.3 |
| 関連 | M14-RESEARCH-01-report §B（共有経路）/ M14-01 設計担当伝達メモ §2/§3（F1/F2/F3・ガードレール）/ m13-to-m14-handover §4-1 / CHANGE-054（M14-01 反映） |

> **文書ID ⇄ 実パスの正は `docs/handover/docs-map.md`（自動生成）**。本書は docs-map 準拠の実パスを併記する。

## 更新履歴

| 版 | 更新日 | 更新内容 |
|----|--------|----------|
| 1.0.0 | 2026-06-30 | 初版。 |
| 1.0.1 | 2026-06-30 | Plan Mode 回答を反映。(1) §1.3 の誤記訂正＝move-warning.ts の死蔵ラベルは「M14-01 で整理済み」ではなく M14-01 で繰延されており、本サブで整理する（死蔵3ラベル recovery_word/unknown_properties/unknown_combo_scaling_key を除去し total_null/extra_throw のみへ縮小・ファイルは温存）。§2.2 に明記。(2) §2.3 削除リストに取込専用 repository メソッド UpsertMove/UpsertOfficialJaAlias（upsert.go・interface 宣言・fakeRepo モック）を追加（§3.4-1 判定＝取込専用の帰結）。 |

---

## 1. 背景と目的

### 1.1 背景

M14 は公式フレームデータ HTML 配布禁止への是正クラスタ。配布 DB は手入力データで構成し、**公式データ取込（FR704）は本体機能から降格・削除**する。技編集（FR703・画面18）は配布 DB の手入力是正手段として温存する。

取込（`service/movesimport`）と技編集（`service/move`）は**ディレクトリ分離済みだがコード境界は相互依存**。とくに**逆依存**: 技編集（温存）が取込パッケージの共有シンボルを参照する（M14-RESEARCH-01-report §B）。`movesimport` をパッケージごと削除すると技編集がコンパイル不能になるため、**段階削除**（共有シンボルを中立側へ移設 → 参照差し替え → 取込削除）が必須。

M14-01 で `properties` 列を削除済みのため、`properties` PATCH 値域検証の `movesimport.IsKnownProperty` 呼び出しは**既に除去済み**（M14-01 伝達メモ §2-D）。これにより `IsKnownProperty` の消費者が消え、移設対象から外れて削除可能＝**共有シンボル移設が当初想定より縮小**している（M14-overview §4.2）。

### 1.2 目的

- 取込が技編集と共有するシンボル（`WarningCode` / `StoredMove` / `DeriveStoredWarnings`）を**中立パッケージへ移設**し、技編集の参照を差し替える。
- 消費者を失った `IsKnownProperty` を削除する。
- `service/movesimport` パッケージ・取込エンドポイント・取込テストを削除する。
- 画面17（取込プレビュー）・FE 取込機能（`features/import/`）・router・Header 導線を除去する。
- **REQ-001 FR704 を降格**（取込はユーザー機能から外す。検証用 CSV は dev/test 限定）。

### 1.3 このマイルストーンで作らないもの（スコープ外）

- **moves スキーマ変更**（列削除/追加・raw_data）＝**M14-01（完了）**。本サブはスキーマを触らない。
- **配布 seed の投入**＝**M14-03**。
- **技編集（画面18・FR703・`service/move`・`GET/PATCH /api/moves`・rush 生成）の機能変更**＝温存（参照差し替えのみ）。
- **FE 警告 SSOT `web/src/constants/move-warning.ts`**＝**ファイルは温存**（画面18 が `total_null`/`extra_throw` 警告表示に使用）。ただし**死蔵 3 ラベル（`recovery_word`/`unknown_properties`/`unknown_combo_scaling_key`）は本サブで整理する**（M14-01 で整理予定だったが繰延された分を、死蔵が確定する取込削除後の本サブで消化＝Plan Mode 回答 2026-06-30）。詳細は §2.2。
- **FR701（HTML→CSV 別ツール `combomgr-importer`）**＝本体外・不変。

### 1.4 前提（M14-01 完了状態・ガードレール）

- M14-01 完了済み（CHANGE-054 反映案）。moves から6列削除・recovery 追加・raw_data 退避5キー除去済み。
- **ガードレール（伝達メモ §2-D/§3-F3）**: M14-01 時点で取込は退避キー（command/condition_*/properties_extra/import_notes）を raw_data に再生成し続ける一時状態にある。**本サブで取込を削除するまで公式データ取込（画面17）を実行しない**。本サブ完了で恒久解消。

---

## 2. 成果物

### 2.1 作成するファイル

- 中立パッケージ（移設先。例 `internal/service/movewarning/`。実名は Plan Mode で確定）: `WarningCode` 型・値（`total_null`/`extra_throw`）・`StoredMove` 型・`DeriveStoredWarnings` 関数を移設。

### 2.2 修正するファイル（参照差し替え・実態は Plan Mode で全数確認）

- **技編集の参照差し替え**: `internal/api/move/dto.go`（`MoveResponse.warnings []movesimport.WarningCode` → 中立パッケージ型）・`internal/api/move/handler.go`（`StoredMove`/`DeriveStoredWarnings` 参照経路）・`internal/service/move/service.go`（残存する取込パッケージ参照があれば中立へ）。
- **ルート登録**: 取込エンドポイント（`POST /api/import/moves`・`POST /api/import/moves/preview`）の登録除去（router）。
- **FE**: `web/src/App` 等の router から取込ルート除去・`Header`/ナビから取込導線除去。
- **FE 警告 SSOT**: `web/src/constants/move-warning.ts` の `WARNING_CODE_VALUES` / `WARNING_LABEL_JA` を **`total_null` / `extra_throw` のみへ縮小**（死蔵3ラベル `recovery_word`/`unknown_properties`/`unknown_combo_scaling_key` を除去）。**ファイルは温存**（画面18 の live 2 種表示に使用）。これを参照する画面18 の表示が live 2 種で不変であることを確認。

### 2.3 削除するファイル

- **Go 取込パッケージ**: `internal/service/movesimport/`（`parse.go`〔F1 の `validateComboScaling`/`comboScalingKeys` dead code 含む〕・`commit.go`・関連テスト `commit_test.go`/`parse_test.go` 等）・`internal/api/movesimport/`（`handler.go`・`dto.go`〔F2 の `previewRowDTO`〕・取込ハンドラ）。**移設対象シンボルを中立へ退避した後に削除**。
- **FE 取込**: `web/src/features/import/`（`ImportMovesPage`・`api.ts`・`types.ts`〔F2 の `comboScaling`〕・画面17 関連コンポーネント一式）。
- **取込専用 repository メソッド**: `repository/move` の **`UpsertMove` / `UpsertOfficialJaAlias`**（`upsert.go`・interface 宣言・`service_test.go` の fakeRepo モック2メソッド）。実コードで取込専用と確認済み（技編集は `ListByCharacter`/`GetByID`/`UpdateFields`/`InsertRushVariant` のみ使用＝§3.4-1 判定）。**未使用メソッドのみ除去で技編集の挙動は不変**。取込削除に伴う死蔵解消（Plan Mode 回答 2026-06-30）。

### 2.4 変更しないもの（原則）

- 技編集（画面18・`service/move`・`GET/PATCH /api/moves`・rush 生成・notes_tool 編集）の機能。参照先パッケージのみ差し替え。
- FE 警告 SSOT `web/src/constants/move-warning.ts`：**ファイルは温存**（死蔵ラベル整理＝§2.2。削除はしない）。
- moves スキーマ（M14-01 で確定）。export/import（comboio・FR401/405）。

### 2.5 例外条項

- code-facts と実コードに差があれば実コードを正とし、相違を完了報告に記録（playbook §4.1）。

---

## 3. 前提条件

### 3.1 必読ドキュメント

- M14-overview v1.0.0 §2.1/§4.2/§4.3。
- M14-RESEARCH-01-report §B（共有シンボル・逆依存の経路）。
- M14-01 設計担当伝達メモ §2-D/§2-E/§3-F1/§3-F2/§3-F3（一時不整合・dead code・契約ずれ・ガードレール）。
- REQ-001 §3.8 FR701〜704（`docs/design/requirements.md`）。DES-002 §4.2（取込エンドポイント）・§7.5（FR704 CSV 契約）。DES-005 §5.17（画面17）・§4.1（ナビ）。
- code-facts §3（フロントルート）/§4（Go ルート↔ハンドラ）/§6（共通ナビ Header）/ DTO。
- retrospective-digest §1（症状≠真因・実コード確認）/§7（自己整合）。

### 3.2 前提事実（実ファイルで確認済み・Plan Mode で再確認）

- 逆依存: 技編集（温存）が取込の `WarningCode`/`StoredMove`/`DeriveStoredWarnings` を参照（report B-2）。`IsKnownProperty` の消費者（properties PATCH 検証）は **M14-01 で除去済み**＝移設不要・削除対象。
- 取込ルート: `POST /api/import/moves`・`/preview`（code-facts §4）。FE 取込 invalidate `["moves"]`（`web/src/features/import/api.ts`）。
- 移設後に残す警告は `total_null`/`extra_throw`（M14-01 で `unknown_properties`/`unknown_combo_scaling_key` は撤去済み）。
- FE 警告 SSOT `web/src/constants/move-warning.ts` は画面18 で使用（温存）。

### 3.3 参照不要

- M14-03（seed）の詳細。本サブは取込削除・参照差し替えに限定。

### 3.4 着手前の確認（Plan Mode 必須。§9.4 と対応）

以下 **7 項目**を Plan Mode で実コード確認のうえ計画提示すること（記憶・report のみで進めない。最終的な正は実コード）。

1. **共有シンボル参照経路の実コード再 grep（最重要・削除安全性の核心）**: `WarningCode` / `StoredMove` / `DeriveStoredWarnings` / `IsKnownProperty` の**全消費箇所**を grep 全列挙（report B-2 の service/move/service.go・api/move/dto.go・api/move/handler.go ＋ それ以外）。`IsKnownProperty` の消費者が M14-01 で確かに 0 になっているか確認（残っていれば M14-01 漏れとして差し戻し）。repository interface（`UpsertMove`/`UpsertOfficialJaAlias` 等）が取込専用か技編集と共有かを確認。
2. **移設先・移設対象の確定**: 中立パッケージ名（例 `internal/service/movewarning`）と移設対象（`WarningCode`＋値・`StoredMove`・`DeriveStoredWarnings`）。`IsKnownProperty` は消費者消失で**移設せず削除**。依存方向が一方向（技編集→中立・取込→中立）になることを確認。
3. **`movesimport` 削除範囲の全列挙**: Go `internal/service/movesimport/`・`internal/api/movesimport/` 配下の全ファイル（parse.go〔F1 dead code 含む〕・commit.go・handler.go・dto.go〔F2 previewRowDTO〕・service・テスト）。移設対象を退避後に削除して**コンパイル可能**か。
4. **画面17・FE 取込削除範囲**: `web/src/features/import/`（ImportMovesPage・api.ts・types.ts〔F2 comboScaling〕・画面17 コンポーネント）・router の取込ルート・`Header`/ナビ導線（code-facts §3/§6）。削除後に他画面（画面18 等）の導線・型が壊れないか。
5. **取込エンドポイント・テスト除去**: `POST /api/import/moves`・`/preview` の登録除去＋取込テスト（commit_test/parse_test）除去。`dbtest.Setup` 経由で残テストが通過するか（取込テスト除去で参照切れが無いか）。
6. **FR704 降格の CHANGE スコープ**: REQ-001 §3.8 FR704 の降格文言（ユーザー機能から外す・検証用 CSV は dev/test 限定）・FR702（FR701→FR704 反映）の参照整合・DES-002 §4.2（import エンドポイント削除）/§7.5（取込 CSV 契約の降格扱い）・DES-005 §5.17（画面17 削除）/§4.1（ナビ）。**REQ-001 CHANGE は設計担当が起票**（製造は DES 直接編集しない・伝達メモで申し送り）。
7. **段階削除の順序と各段階のコンパイル可能性**: ①中立パッケージ作成＋シンボル移設 → ②技編集（dto/handler/service）の参照差し替え → ③取込の参照を中立へ（or 取込ごと削除）→ ④`movesimport` 削除 → ⑤画面17・FE 取込削除 → ⑥ルート/ナビ除去。各段階で `go build`/`tsc` が通る順序を提示。

---

## 4. 詳細仕様

### 4.1 共有シンボル移設（削除安全性の核心）

- 中立パッケージ（例 `internal/service/movewarning`）へ `WarningCode`（値 `total_null`/`extra_throw`）・`StoredMove`・`DeriveStoredWarnings` を移設。
- 技編集側（`api/move/dto.go` の `MoveResponse.warnings`・`api/move/handler.go` の再導出呼び出し）の参照を中立パッケージへ差し替え。
- `IsKnownProperty` は消費者消失（M14-01）のため**移設せず、`movesimport` と共に削除**。
- 依存方向を一方向化（技編集→中立・取込→中立。逆依存を解消）。

### 4.2 `movesimport` 削除（段階削除）

- 移設・参照差し替え完了後に `internal/service/movesimport/`・`internal/api/movesimport/` を削除（F1 dead code 含む）。
- 取込エンドポイント（`POST /api/import/moves`・`/preview`）のルート登録・ハンドラを除去。
- 取込テスト（commit_test/parse_test 等）を除去。`dbtest.Setup` 経由の残テスト通過を確認。

### 4.3 画面17・FE 取込削除（FR704 降格）

- `web/src/features/import/`（ImportMovesPage・api.ts・types.ts〔F2〕・画面17 一式）削除。
- router から取込ルート除去・`Header`/ナビから取込導線除去（DES-005 §4.1）。
- 技編集（画面18）の導線・表示・型が不変であることを確認（warnings 表示は SSOT `move-warning.ts` 経由で温存）。

### 4.4 FR704 降格（REQ-001・DES CHANGE は設計担当起票）

- REQ-001 §3.8 FR704 を「取込はユーザー機能から降格・配布 DB は手入力同梱・検証用 CSV は dev/test 限定」へ。FR703（技編集）は温存。FR702（アップデート追従）の FR704 参照文言を整合（フェーズ4 据え置き）。
- DES-002 §4.2（import エンドポイント削除）・§7.5（取込 CSV 契約の降格扱い・dev/test 限定明記）・DES-005 §5.17（画面17 削除）・§4.1（ナビ）。
- 製造担当は DES/REQ を直接編集しない。実装で確定した削除範囲を**伝達メモ**で申し送り、設計担当が CHANGE 起票（055〜）。

---

## 5. テスト要件（ケース数で語る。§7 DoD と対応）

### 5.1 Go テスト

- 技編集（`GET/PATCH /api/moves`・rush 生成・notes_tool）が中立パッケージ参照で**不変動作**（warnings が `total_null`/`extra_throw` で再導出される）。
- 取込エンドポイント（`/api/import/moves`・`/preview`）が**404/未登録**（削除確認）。
- `movesimport` 削除後に `go build`/`go vet` が通り、`dbtest.Setup` 経由の全残テストが通過。
- 中立パッケージ `DeriveStoredWarnings` の単体テスト（移設先で `total_null`/`extra_throw` 導出）。

### 5.2 FE テスト（Vitest / tsc）

- 画面17・`features/import/` 削除後に `tsc`/ビルドが通る（F2 の契約ずれ解消）。
- 画面18（技編集）の warnings 表示が `move-warning.ts` 経由で不変。
- router に取込ルートが無く、Header/ナビに取込導線が無い。

### 5.3 E2E / 手順書

- 取込画面（画面17）へ到達できない（導線・ルート除去）。
- 画面18 で move 編集（recovery 含む）・warnings 表示が不変（非回帰）。
- M13 CSV export/import・コンボ編集が非回帰。

---

## 6. レビュー観点（別ファイル参照）

`docs/instructions/reviews/M14-02-review-checklist.md` を参照。重大判定は §9。

---

## 7. 完了条件（Definition of Done）

### 7.1 機能要件

- 共有シンボルが中立パッケージへ移設され、技編集が中立参照で不変動作。
- `IsKnownProperty` 削除・`movesimport`（Go 取込パッケージ）削除・取込エンドポイント除去。
- 画面17・FE 取込（`features/import/`）・取込導線除去。
- 逆依存が解消され `go build`/`tsc` が通る。
- 取込が退避キーを再生成しない（F3 恒久解消・ガードレール不要化）。

### 7.2 自己テスト結果

- §5 をケース数で報告。`dbtest.Setup` 経由の全残テスト通過・取込テスト除去後の参照切れ無しを明記。

### 7.3 品質チェック

- 共有シンボル参照経路の再 grep 結果（移設前後の全消費箇所）を報告。禁則表現の grep 除去。

### 7.4 ドキュメント

- Plan Mode 確定方式（7 項目）・段階削除順・テストケース数・F1/F2/F3 の解消を完了報告に含める。
- FR704 降格・画面17/取込削除範囲を**設計担当への伝達メモ**で申し送り（REQ-001/DES 反映は設計担当が CHANGE 起票）。

### 7.5 完了報告

- 上記＋ REQ-001 FR704 降格・DES-002 §4.2/§7.5・DES-005 §5.17/§4.1 の CHANGE 見込みの具体化点を伝達メモで申し送り。

---

## 8. 参照ドキュメント

- M14-overview v1.0.0 §2.1/§4.2/§4.3 / M14-RESEARCH-01-report §B / M14-01 伝達メモ §2/§3 / REQ-001 §3.8 / DES-002 §4.2/§7.5 / DES-005 §5.17/§4.1 / code-facts §3/§4/§6 / retrospective-digest §1/§7。

---

## 9. 注意事項・判断に迷ったら

### 9.1 推測で進めてはいけない事項

- 共有シンボルの全消費箇所（§3.4-1 の再 grep。漏れはコンパイル不能 or 実行時破壊）。
- 移設対象と削除対象の別（IsKnownProperty=削除・他3=移設。§3.4-2）。
- 段階削除の順序（§3.4-7。各段階で build/tsc が通る順）。
- repository interface が取込専用か技編集共有か（§3.4-1）。

### 9.2 推測で進めてよい事項（その旨を明示）

- 中立パッケージ名（`movewarning` 等・命名は既存規約に倣う）。
- 削除ファイルのうち取込専用が自明なもの（テスト・取込 DTO）。

### 9.3 不明事項発見時の対応

- `IsKnownProperty` 消費者が残存していた場合は M14-01 漏れとして設計担当へ差し戻す。
- 共有と思しきシンボルが他にも見つかった場合（report B-2 以外）は移設要否を設計担当へ確認。

### 9.4 Plan Mode で計画提示時に含めるべき項目

- §3.4 の 7 項目すべて（共有シンボル再 grep / 移設先・対象 / movesimport 削除範囲 / 画面17・FE 削除範囲 / エンドポイント・テスト除去 / FR704 降格 CHANGE スコープ / 段階削除順）。

---

## 10. 完了後の次ステップ

- 完了報告（伝達メモ）を受けて、設計担当が **REQ-001 FR704 降格**・DES-002 §4.2/§7.5・DES-005 §5.17/§4.1 の CHANGE を起票（055〜）。
- M14-03（配布 DB 同梱・全 30 キャラ seed 投入インフラ）に着手。

---

*以上、指示書 M14-02 v1.0.0。配置 `docs/instructions/M14-02-import-pipeline-staged-removal.md`。対のレビューチェックリストは `docs/instructions/reviews/M14-02-review-checklist.md`。*
