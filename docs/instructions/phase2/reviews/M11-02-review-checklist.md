# M11-02 レビューチェックリスト v1.0.0

| 項目 | 内容 |
|------|------|
| 対象指示書 | `docs/instructions/M11-02-instruction.md` v1.0.0(nullable メタデータの PATCH クリア一般化=presence-detection。BE 中心 + 軽微 FE) |
| 対象指示書ID | M11-02 |
| レビューモデル | Sonnet 4.6 |
| バージョン | 1.0.0 |
| 作成者・作成日 | 設計担当 Claude(フェーズ2 本流スパイン・M11 担当)/ 2026-06-21 |
| 関連 CHANGE | CHANGE-043(DES-002 v1.23.0 §4.2。CHANGE-042 の situation `""` センチネルを置換。反映済み) |

## 更新履歴

| 版 | 更新日 | 更新内容 |
|----|--------|----------|
| 1.0.0 | 2026-06-21 | 初版(指示書 v1.0.0 と対)|

---

## 0. レビュー担当への前置き

### 0.1 レビュー前の準備
- 必読: `M11-02-instruction.md` v1.0.0、`docs/progress/M11-RESEARCH-02-report.md`、`docs/design/02-architecture.md`(DES-002 **v1.23.0**)§4.2、`docs/change-notes/CHANGE-043-M11-02-patch-clear-tristate.md`、`docs/handover/code-facts.md` commit `3e0f4bf`。
- **前提ゲート**: (1) M11-01 完了済み。(2) **CHANGE-043 反映済み**(DES-002 v1.23.0)。(3) Plan Mode §3.4(7項目、presence 手段・部分 PATCH 安全含む)の実 view 確認結果が完了報告にあるか。

### 0.2 基本姿勢
- 機械チェック(§1〜§4・§6・§7)+ 設計意図(§5)。
- **BE 中心 + 軽微 FE(situation の `?? null` 移行のみ)**。部分 PATCH 経路の誤クリア防止を最重点。
- code-facts は参考。最終根拠は実コード(retrospective-digest §1 パターンA)。

### 0.3 報告フォーマット
- 各節「OK / 重大(§9)/ 軽微(§10)/ 質問(§11)」。

---

## 1. クリア規約の実装(最重要)

### 1.1 presence-detection トライステート(指示書 §4.1/§4.2)
- [ ] DTO `UpdateMetadataRequest` が「**キー不在 / null / 値**」の3状態を判別できるか(`*T`+`omitempty` だけでは不可。`UnmarshalJSON`/`Optional[T]`/`map[string]json.RawMessage` 等で present を検出)。
- [ ] repo `UpdateMetadata` が「**present のみ SET / present+null=`add(col, nil)`(NULL)/ present+値=更新**」になっているか(指示書 §4.1 表)。
- [ ] Input(repo `UpdateMetadataInput`)が3状態を表現し、DTO→Input(`toServiceUpdateMetadataInput`)で正しく伝播しているか。service の素通しが維持されているか。
- [ ] 対象が memo / damage / drive_damage / drive_available_at_start / sa_available_at_start / knockdown_advantage / situation / 起き攻め6 を網羅しているか。

### 1.2 situation の統一(指示書 §4.3、CHANGE-043)
- [ ] repo の situation **`""→nil` センチネル分岐が撤去**され、present+null=NULL クリアに統一されているか。
- [ ] フロント `buildPatchPayload` の situation が `?? ""`→**`?? null`** へ移行しているか。`buildSituation` の定義未ロード時ガード(既存 situation 保持)と両立しているか。
- [ ] `ComboEditor.tsx`(buildPatchPayload 内センチネル説明コメント:200-202 付近)が `null` 移行に整合しているか。

### 1.3 部分 PATCH 経路の安全(指示書 §4.4、最重点)
- [ ] `PromoteToFinalButton`(`{version, isDraft}` 2キー)が **不在=不変更**で他フィールドを温存するか(full-replace になっていない=昇格でメタデータが消えない)。
- [ ] `buildPatchPayload` が `isDraft` を送らない非対称で、is_draft が**不在=不変更**で温存されるか。
- [ ] PATCH の全呼び出し元(grep)が presence-detection 下で意図どおりか。

---

## 2. API・スキーマ整合性
- [ ] POST/PUT 契約・スキーマが不変か(presence-detection は PATCH のみ)。スキーマ(対象列 nullable)不変か。
- [ ] `is_draft`(非 nullable)が null クリア対象になっていない(不在=不変更 / 値=更新)か。
- [ ] tagIds は `ReplaceTagAssociations` 経路のまま(本規約の SET 対象外)か。
- [ ] DES-002 §4.2 v1.23.0 のトライステート(不在=不変更 / null=クリア / 値=更新)と実装が一致するか。

## 3. 既知の挙動変更の確認(指示書 §4.5)
- [ ] 起き攻め6が `null`=NULL クリア可能になっている(従来不変更)。round-trip(値→present+値→同値)は不変か。
- [ ] situation のクリアが `null` 経由(`""` 不使用)に変わったか。成果(NULL)は不変か。

## 4. テストの妥当性
- [ ] BE: present+null→NULL クリア(memo/数値/situation/起き攻め)、不在→不変更、部分 PATCH 温存(昇格相当)を網羅。既存 (16)(17)(18) を新規約へ更新。
- [ ] FE: `buildPatchPayload` の `situation === null`(旧 `=== ""` 更新)、空 memo/数値の `null` 送出。
- [ ] E2E: A(situation クリア)/ B(memo クリア)/ C(数値クリア)/ **D(昇格で温存)** / E(非回帰)。

## 5. 設計意図との整合
- [ ] **full-replace ではなく presence-detection**(部分 PATCH を不在=不変更で安全に許容)になっているか。送られないフィールドが誤クリアされていないか(Q6)。
- [ ] **単一規約**(全 nullable メタデータが同一トライステート)で、situation の特例(`""`)が消えているか。
- [ ] スキーマ非変更・POST/PUT 非変更で、PATCH のクリア規約のみの変更に収まっているか。

## 6. コード品質・規約
- [ ] presence 検出の実装が既存 DTO 構造と整合し、過剰な抽象化を避けているか。
- [ ] Go の typed-nil を `add(col, nil)` で正しく SQL NULL にしているか(typed-nil 混入で NULL にならない罠を回避)。
- [ ] camelCase(JSON)/ 命名規約の踏襲。

## 7. 既存挙動の温存(非破壊性)
- [ ] POST/PUT 登録・識別キー編集の誘導が不変。
- [ ] M11-01(custom_states 付与/表示・round-trip)が非回帰。situation の round-trip(値→保持)が `null` 移行後も成立。
- [ ] 既存 E2E(M10/M11-01/閲覧系/combo-crud)が通過。

## 8. ドキュメント
- [ ] DES-002 §4.2(CHANGE-043)の改訂は**設計担当が対応済み**。製造担当が DES を直接編集していないか。
- [ ] 完了報告に Plan Mode §3.4(7項目)・テストケース数・部分 PATCH 安全確認を含むか。

---

## 9. 重大な問題の判定基準(完了承認を妨げる)
- 前提ゲート(CHANGE-043 反映 / Plan Mode 7項目)未充足のまま実装。
- **部分 PATCH(昇格 `PromoteToFinalButton` 等)で他フィールドが誤クリアされる**(full-replace 化してしまっている)。
- presence-detection が機能せず、編集でフィールドを空に戻しても NULL クリアされない(バグ未修正)。
- situation の `""` センチネルが残存し二規約が混在、または situation のクリアが壊れている。
- POST/PUT 契約・スキーマ・識別キー編集に回帰。`is_draft` を誤って null クリア対象にしている。
- Go typed-nil の混入で `add(col, nil)` が SQL NULL にならない。

## 10. 軽微な問題の判定基準(持ち越し許容)
- presence 検出実装の内部表現の好み(`Optional[T]` vs `RawMessage` 前段 等、機能が正しければ可)。コメント文言。

## 11. 質問・確認事項のフォーマット
- 「指示書 §X.X / DES-002 §4.2 / M11-RESEARCH-02 Q番号 に対し実装が Z。意図確認したい」の形で根拠併記。

## 12. レビュー完了の判定
- §1〜§8 が全て OK、§9 重大ゼロ、§0.1 前提ゲート + Plan Mode 7項目が揃っている。特に **§1.3 部分 PATCH 安全(昇格で温存)** と **§1.1 presence-detection** を確認。§10 軽微は持ち越し可。

---

*以上、M11-02 レビューチェックリスト v1.0.0*
