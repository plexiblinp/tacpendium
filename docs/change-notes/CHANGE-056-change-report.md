# CHANGE-056 change-report: DES-005 反映結果（M15-02 正典化）

| 項目 | 内容 |
|------|------|
| 対象 CHANGE | CHANGE-056（通知書 `CHANGE-056-notification.md`） |
| 反映日 | 2026-07-03 |
| 反映者 | 設計担当 Claude（M15 期） |
| 対象文書 | DES-005（05-screen-design.md）v2.30.0 → **v2.31.0（第42版）** |
| 三点セット | 通知書＋**改訂 DES-005（本 report で反映確認）**＋本 change-report |

---

## 1. 反映した差分（改訂 DES-005 に適用済み）

| 箇所 | before | after |
|------|--------|-------|
| §5.6 表示項目6（L227） | 選択モードトグル（複数選択→比較画面への導線） | 「比較対象選択」トグル（…可視ラベルは「比較対象選択」＝旧「選択モード」。M15-02/CHANGE-056） |
| §5.6 アクション（L236） | 選択モード + 比較ボタン → コンボ比較画面 | 「比較対象選択」+ 比較ボタン → コンボ比較画面 |
| §5.7 レシピ入力領域「修飾情報」 | （追記なし） | ＋「編集ボタンについて」見出し＋info-mark（RecipeBuilder/SetupRecipeEditor 両方・steps>0 表示）を追記 |
| §6.7 修飾情報の入力 | （ダイアログ info-mark 記載なし） | ＋編集ダイアログ（ステップ編集）タイトル横の info-mark を追記 |
| メタ（バージョン/ステータス） | 2.31.0 / 第42版（CHANGE-056）を反映 |  |

## 2. 反映の性質

- **表示・機能・データ・API 不変**の付加/改称（③＝可視ラベル変更、⑤＝info-mark ヘルプ affordance の追加）。
- REQ-001・他 DES（001〜004/006）変更なし。データモデル・バリデーション・recipe_cache・export に影響なし。

## 3. 実装との整合（M15-02 実装済み）

- 実装は M15-02（指示書 v1.1.0）で完了済み（レビュー重大 0 件）。本 CHANGE は**実装後の DES 正典化**（M13-3 の実装後 CHANGE 型）。
- info-mark test-id（`recipe-modifier`/`setup-recipe-modifier`/`modifier`）・i18n キー（`help.recipeModifier`/`help.modifier`・ja/en 両ロケール）は M15-overview §4.7.2 に記録（DES 規定文言でない実装詳細のため DES 本文には test-id/キー名を書かない＝§5.18 の aria/i18n を CHANGE 対象外とした M12-04 の前例に整合）。

## 4. 採番

- change-number-registry を **056 消化・次番号 057** へ更新（欠番 008/009/014）。

---

*以上、CHANGE-056 change-report。改訂 DES-005 v2.31.0 に §1 の差分を適用済み（三点セット完了）。*
