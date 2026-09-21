# M15-01 レビューチェックリスト

| 項目 | 内容 |
|------|------|
| 対象指示書 | `docs/instructions/phase3/M15-01-metadata-testid.md` v1.0.1（メタデータ入力の安定 test-id 整備・F12-4） |
| 対象指示書ID | M15-01 |
| レビューモデル | Sonnet 4.6（model-allocation v1.26.0 参照。実使用は開発者判断） |
| バージョン | 1.0.1 |
| 作成者・作成日 | 設計担当 Claude（フェーズ3 継続担当・M15 期）/ 2026-07-02 |

> **文書ID ⇄ 実パスの正は `docs/handover/docs-map.md`（自動生成）**。本書は docs-map 準拠の実パスを併記する。

## 更新履歴

| 版 | 更新日 | 更新内容 |
|----|--------|----------|
| 1.0.0 | 2026-07-02 | 初版（指示書 v1.0.0 と対）。 |
| 1.0.1 | 2026-07-02 | 指示書 v1.0.1 に追従。**対象＝全メタデータ拡張（11＋native select 4）**、**既存 E2E＝併設**の決定を反映。§0.1・§1.1・§3・§4.2・§9 を更新。 |

---

## 0. レビュー担当への前置き

### 0.1 レビュー前の準備

- 必読: `docs/instructions/phase3/M15-01-metadata-testid.md` v1.0.1、code-facts（`docs/handover/code-facts.md`）§1（`ComboEditorBasicFields` Props）/§3（ルート `/combos/new`・`/combos/:id/edit`）/§7（`ComboResponse`/`CreateRequest`/`UpdateMetadataRequest`）、M15-overview（`docs/instructions/phase3/M15-overview.md`）§3 M15-01/§4.7、followup-backlog §B F12-4。
- **Plan Mode 着手前確認結果の確認（必須・playbook §8.4.4）**: 指示書 §3.3 のうち **#2 対象スコープ（全メタデータ拡張）・#4 既存 E2E 方針（併設）は v1.0.1 で決定済み**。Plan Mode 確認は残る **#1 現行 test-id 被覆（driveDamage の既存 test-id 名を含む）・#3 起き攻め6 DOM 構造**の実査結果＋付与先要素の確定に限る。未実査のまま既存規約を無視して二重規約を作っていれば重大（§9）。

### 0.2 レビューの基本姿勢
- 本サブは **純 FE・test-id 付与のみ・DES 非対象・API/データ契約不変**。「表示・挙動を変えていないか（非破壊性）」を最優先で確認する。
- 症状のレイヤ ≠ 真因のレイヤ（E2E 不通過をセレクタ問題と決めつけない）。

### 0.3 レビュー結果の報告フォーマット
- 各節ごとに「OK / 重大（§9）/ 軽微（§10）/ 質問（§11）」で報告。重大は完了承認を妨げる。

---

## 1. 対象・規約との照合（最重要）

### 1.1 対象フィールドの網羅（指示書 §1.1/§3.3-2/§4.1・**v1.0.1 確定＝全メタデータ拡張**）
- [ ] F12-4 明示の **damage / driveAvailableAtStart / saAvailableAtStart / knockdownAdvantage / memo / 起き攻め6**（`okiMeatyNeutralTechThrow`/`…Dr`/`okiMeatyBackTechThrow`/`…Dr`/`okiShimmyNeutralTech`/`okiShimmyBackTech`＝計 11）すべてに `data-testid` が付与されているか。
- [ ] **native select 4 件（`position`/`opponentStance`/`hitType`/`opponentSize`）**にも付与されているか（DuplicateKey 構成要素）。
- [ ] **`driveDamage` は既存 test-id を温存**（二重付与・規約齟齬がないか。齟齬があれば §11 で設計担当へ質問）。**`situation`・custom-state には付与していない**（据え置き・スコープ厳守）か。
- [ ] 付与先が **input／操作可能なコントロール要素・native select 要素**（ラッパー div でない）で、E2E が値入力・トグル・選択できるか。

### 1.2 命名規約の一貫性（指示書 §3.3-1/§4.1・§2.3）
- [ ] **現行 test-id 被覆を全数実査**し、既存の命名規約があればそれを採用（提案規約を上書き）しているか。既存規約を無視して二重規約を作っていないか（§2.3・digest §4）。
- [ ] 命名が単一規約（接頭辞＋kebab-case フィールド名など）で統一され、同一概念に異なる命名が混在していないか（digest §7）。
- [ ] new/edit/copy モード（`ComboEditor` Props `mode`）で **同一 test-id** が使えるか（モード分岐で id を変えていない＝安定性の要）。

### 1.3 非破壊性（表示・挙動不変）（指示書 §1.3/§2.2/§4.2）
- [ ] `data-testid` の**追加のみ**で、value/onChange/ラベル/バリデーション/レイアウトが変わっていないか（視覚・機能の差分なし）。
- [ ] 起き攻め6 トグルが shadcn/ui 既存パターン踏襲（自作再発明していない・playbook §4.6）で、on/off 操作が可能か。

### 1.4 DES 直接編集の禁止（指示書 §7.4）
- [ ] 本サブは DES 非対象。製造担当が DES-005 等を直接編集していないか（test-id は実装詳細で画面仕様を変えない）。

---

## 2. API・データ契約の不変（非破壊性）
- [ ] `ComboResponse`/`CreateRequest`/`UpdateMetadataRequest`（code-facts §7）の公開フィールドに差分がないか。
- [ ] メタデータの送信/取得挙動が不変か（test-id 付与が DTO・API を触っていない）。

---

## 3. フロントエンドの動作仕様（指示書 §4.2/§4.3・**v1.0.1 確定＝併設**）
- [ ] `ComboEditorBasicFields`（＋起き攻め6 サブコンポーネント・native select）で test-id 付与後もフォームが従来どおり動作するか。
- [ ] **併設**方針どおり、既存 spec（`combo-crud.spec.ts` 等）の placeholder/getByText 等セレクタが**不変**で、test-id 追加が純加算にとどまるか（既存 spec を getByTestId へ移行していないか＝本サブは移行しない）。

---

## 4. テストの妥当性（ケース数で確認。指示書 §5 ↔ §7 DoD）

### 4.1 既存 E2E 非回帰
- [ ] `make e2e` で既存スイート（`combo-crud.spec.ts` 等）が全通過するか（test-id 移行/併設後も同一挙動）。

### 4.2 前提スモーク（seed 非依存）
- [ ] `/combos/new` で §4.1 の各 test-id が **DOM に存在し値入力/トグル/選択できる**ことを確認する最小 spec があるか（damage/memo/oki トグル各1・drive/sa/knockdown 入力・**native select 4 件の選択**＝対象フィールド数分のセレクタ解決）。
- [ ] スモークが **seed 非依存 self-contained**（新規作成画面のフォーム DOM 対象・既存コンボ seed に非依存）で、**永続 dev DB 残渣に依存しない**か（M14-6・combo-csv-io ken 依存等を新たに作っていないか）。

---

## 5. 設計意図との整合（精神の確認）
- [ ] **「安定 test-id ＝後続 M15 サブの回帰安全網」**: 表記・レイアウト変更（M15-02/03/05）で壊れないセレクタになっているか（テキスト/ロール依存を残していないか）。
- [ ] **「本サブは前提整備であり残渣根治ではない」**: fe-e2e-throwaway-db（使い捨て DB 化）・配布前クリーン DB 全 E2E をスコープに混入させていないか（指示書 §1.3・§5.1 注意）。

---

## 6. コード品質・規約遵守
- [ ] 曖昧語（「適切に」「必要に応じて」）に依存した実装判断になっていないか（playbook §4.1）。
- [ ] test-id 文字列がハードコード散在でなく一貫（定数化 or 規約準拠命名）か。
- [ ] ファイル分割・命名が既存パターン（code-facts §1・既存 e2e 構成）に整合するか。

---

## 7. 既存挙動の温存（非破壊性）
- [ ] 既存コンボ作成/編集（`combo-crud.spec.ts` 等）の挙動が不変か。
- [ ] メタデータ入力の表示（ラベル・レイアウト・バリデーション）に視覚/機能差分がないか。

---

## 8. ドキュメント・進捗ログ
- [ ] 完了報告に、Plan Mode 確定方式（現行 test-id 被覆・命名規約〔既存採用 or 提案採用〕・対象フィールド集合・既存 E2E 移行/併設方針）、付与フィールド一覧、テストケース数、既知の制約（fe-e2e 残渣根治はスコープ外）が含まれるか（指示書 §7.5）。
- [ ] test-id 命名規約が完了報告に明記されているか（後続 M15 サブが参照・code-facts 再生成では捕捉されないため）。

---

## 9. 重大な問題の判定基準（完了承認を妨げる）
- Plan Mode 実査（§3.3 #1 現行 test-id 被覆・#3 起き攻め6 DOM）を行わず、**既存命名規約を無視して二重規約を作っている**／**`driveDamage` に既存と別名の test-id を二重付与している**。
- **確定スコープ違反**: F12-4 の 11＋native select 4 の**いずれかが未付与**、または **`situation`・custom-state に付与している**（据え置き違反）。
- メタデータ入力の**表示・onChange 挙動・レイアウトが変わっている**（本サブは test-id 付与のみ）。
- 既存 API/データ契約（`ComboResponse` 等公開フィールド）が変わっている。
- **併設違反**: 既存 spec を getByTestId へ移行して既存の通過を壊した（本サブは併設＝既存 spec 不変が原則）。または既存 E2E（`combo-crud.spec.ts` 等）が非回帰でない。
- スモーク/spec が**永続 dev DB 残渣に依存**して通っている（seed 非依存でない）。
- 製造担当が DES 本体を直接編集している。

## 10. 軽微な問題の判定基準（持ち越し許容）
- test-id 文字列の細かな綴り（規約に沿っていれば可）。
- スモーク spec のアサーション粒度（存在＋操作可能で足り、全フィールド網羅の厳密さは不要）。
- spec ファイルの配置・命名の微細な体裁。

## 11. 質問・確認事項のフォーマット
- 「指示書 §X.X / code-facts §Y に対し、実装が Z。意図確認したい」の形で、根拠節を併記して設計担当へ。

## 12. レビュー完了の判定
- §1〜§8 が全て OK、§9 重大ゼロ、§0.1 の Plan Mode 実査（#1 現行 test-id 被覆・#3 起き攻め6 DOM）が揃っている。§10 軽微は持ち越し可。

---

*以上、M15-01 レビューチェックリスト v1.0.1。配置 `docs/instructions/phase3/reviews/M15-01-review-checklist.md`。指示書 v1.0.1（全メタデータ拡張・併設）と対。*
