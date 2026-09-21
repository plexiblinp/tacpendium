# M15-05 レビュー報告書

対象コミット: `85fdd60`(feat FB①=登録画面レイアウト)／`422b950`(fix FB②=比較 生 ID バグ)
レビュー日: 2026-07-04 / レビュー担当: 品質レビュー Claude(read-only)
参照: 指示書 `docs/instructions/phase3/M15-05-display-tidy-compare-id-bug.md` v1.0.1 / チェックリスト `docs/instructions/phase3/reviews/M15-05-review-checklist.md` v1.0.1

## 総評

両変更とも指示書の最重要ゲートを満たしている。②は症状層(比較の描画)ではなく真因層(`repository.FindByID` の `StarterMoveCode` 未補完)で修正されており、List 経路と同じ `findMoveCodesByIDs` を再利用する形で一覧/詳細と経路整合が取れている。API 契約・スキーマ・DTO は不変で、既存 `starterMoveCode` を埋めるだけの加算的・非破壊修正。①は全項目を温存したまま横幅活用の非対称2カラム化+副次節折りたたみで縦スクロールを軽減しており、項目削除・機能変更はない。DES-005 §5.7(PC 横並び)/§5.6(PC 2カラム)の既定に合致するため DES CHANGE も不要。重大な問題は検出されなかった。指摘は軽微・低優先のみ。

## 設計準拠性レビュー結果

### 1.1 ②比較 生 ID バグ=真因層での修正(最重要) — ◎
- **真因層修正を確認**。データ経路は `useCompareCombos`(`web/src/features/combo/hooks/useCompareCombos.ts`)→ `GET /api/combos/{id}` → `service.Get`(`internal/service/combo/service.go:260`)→ `repository.FindByID`。List 経路(`repository.go:538-559`)は `findMoveCodesByIDs` で `StarterMoveCode` を補完していたが、`FindByID` は補完していなかった。`formatStarterStatus`(`web/src/features/combo/utils.ts:47-59`)は `starterMoveCode` が空だと `始動技#${starterMoveId}` の生 ID にフォールバックするため、詳細エンドポイント経由の比較だけが生 ID 表示になっていた。修正は真因の `FindByID`(`repository.go:322-333`)に List と同一の `findMoveCodesByIDs` を適用しており、症状層(CompareTable の描画)を塞いでいない。指示書 §3.3-2 の候補(a)(b)(c)のうち真因は「(b) 詳細クエリの `ComboDetail` に名称が来ていない=BE 補完漏れ」であったと正しく特定されている。
- **共有経路への整合**を確認。一覧(ComboTableRow)・比較(CompareTable/CompareTargetList)・エクスポートはいずれも共有ヘルパ `formatStarterStatus` を使用。名称導出を BE 側の共有関数 `findMoveCodesByIDs` に寄せたため、FE 側の分岐追加なしで整合。
- **正しい側を壊していない**。修正は加算的(空→技コード補完)であり、一覧(List 経路)は元から補完済みで不変。詳細ページ(`ComboDetailHeader`/`ComboDetailMetadata`)は `formatStarterStatus`/`starterMove*` を一切参照しておらず(grep 確認)、生 ID 表示の症状も無かったため影響なし。
- **API 契約・スキーマ不変**を確認。`internal/api/combo/dto.go:159,344` の `StarterMoveCode string json:"starterMoveCode"` は既存フィールド。model `Combo.StarterMoveCode *string db:"-" json:"-"`(`internal/model/combo.go:119-120`)も不変。SQL/マイグレーションの変更なし。

### 1.2 ①表示整理・縦スクロール軽減 — ◎
- **余白/狭幅の理由実査**を確認。現行 `max-w-3xl` 単一縦積みは form 系共通デフォルトでレスポンシブ固有意図ではなく、DES-005 §5.7 レスポンシブ(「PC:仮想コントローラと入力フォームを横並び配置可能／スマホ:縦スクロール」)・§5.6(「PCは2カラム(左:基本情報、右:レシピ・セットプレイ)」)が既に PC 横並びを規定済み・未実装であったことがコミットメッセージで説明され、実コードとも整合。
- **レスポンシブ維持**を確認。`ComboEditor.tsx` の `grid grid-cols-1 gap-4 lg:grid-cols-[5fr_7fr]` により lg 未満では単一カラムへ落ちる。DES-005 §5.7「スマホ:縦スクロール」を破壊していない。
- **項目温存・機能不変**を確認。基本情報/レシピ/セットプレイ/起き攻め/メモ/マイコンボ/タグ/仮登録トグルの全項目が残存。既存部品(RecipeBuilder=全技プルダウン/VirtualController/TagSelector/SetupRegistrationSection)は内部不変でラップのみ。フィールド削除なし。
- **折りたたみを唯一解にしていない**。主軸は横幅活用の2カラム再配置で、折りたたみは使用頻度の低い副次節(起き攻め/マイコンボ/タグ)に限定・**初期展開**のため到達性は非悪化。キャラ固有状態は auto-fit 横並び(折りたたみなし・常時表示)。
- 情報過密の懸念: 左5:右7 の非対称配置で仮想コントローラ(広い)を右に寄せる設計は妥当。過密判定は静的コードのみでは断定不能(下記制約参照)。

### 1.3 test-id・DES 直接編集禁止 — ◎
- 新規 test-id `combo-editor-oki-section`/`-mycombo-section`/`-tag-section` は既存 `combo-editor-<field>` 規約と整合し、`-section` サフィックスで既存(例 `combo-editor-okiMeatyNeutralTechThrow`)と衝突しない(grep で衝突ゼロ確認)。
- DES-005 本体への編集なし。DES CHANGE 要否は「不要」で妥当(実装が §5.7/§5.6 の既定レスポンシブに合致)。

### 2. データ・API 契約・スキーマ不変 — ◎
- `ComboResponse`/`Combo`(DTO/model)・API・マイグレーション・SQL クエリ本体に差分なし。②は既存フィールド補完のみ、①は FE 表示層のみ。

### 3. フロントエンドの動作仕様 — ○
- CollapsibleFieldset は shadcn/lucide-react(`ChevronDown`)を用いた軽量自作。既存に汎用 Collapsible/Accordion 部品があれば流用すべきだが、本件は fieldset 見た目維持の限定用途で薄いラッパのため許容範囲(playbook §4.6 の趣旨は逸脱せず)。

### 4. テストの妥当性 — ○
- ②BE: `TestRepository_FindByID_StarterMoveCode`(有効 ID→補完 / nil→nil の2ケース)。List テストのミラーで妥当。
- ②FE: CompareTable で技名(5LP)表示・生 ID(始動技#)非表示を DOM テキストで検証=実装非依存記述で妥当。
- ①: 折りたたみ節の初期展開/トグル(2ケース)。全項目存在の網羅までは踏み込んでいないが、既存テスト群(コミット記載 606 件)で入力/保存はカバー。

### 5. 設計意図との整合 — ◎
- 真因層修正・削除せず整理・正しい側非破壊・非スキーマの各精神を満たす。

### 6-7. コード品質・既存挙動温存 — ◎
- `console.log`/`fmt.Println` 残置なし、`eslint-disable`/`nolint` 濫用なし(変更ファイル grep 確認)。エラーは `fmt.Errorf(...: %w)` で wrap。既存挙動温存。

## 設計準拠性以外の指摘事項

1. **(低)アクセシビリティ**: `CollapsibleFieldset` は従来の `<fieldset>`+`<legend>`(フォームコントロールのグルーピング意味論)を `<section>`+`<button>` に置換している。`aria-expanded` は付与済みだが、`<section>` に見出しへの `aria-labelledby` が無く、フォーム部品のグループ意味論は失われる。スクリーンリーダー利用時の軽微な後退。既存の非折りたたみ節(メモ/キャラ固有状態)は `<fieldset>` のままで、意味論が節ごとに不統一。

2. **(低)FindByID の追加クエリ**: `FindByID` は `service` 層の create/update 後処理など多数箇所から呼ばれる(`service.go:245,360,389,448,478,602`)。今回 `StarterMoveMoveID != nil` のとき毎回 `findMoveCodesByIDs`(単一 IN クエリ)が1回追加される。単一行取得のため実害は軽微だが、比較・詳細以外の書き込み系フローでも発生する点は認識しておくとよい。JOIN 化での一括取得も将来の選択肢。

3. **(低)i18n**: `CollapsibleFieldset` の legend(「起き攻め」「マイコンボ」「タグ」)はハードコード日本語。ただしこれは変更前の `<legend>` から引き継いだ既存文字列であり、`ComboEditorBasicFields` 全体が元々ハードコード JP(react-i18next 非適用)。本変更が新規に導入した規約違反ではなく、コンポーネント全体の既存課題。ja/en parity の観点で将来 i18n 化する場合は本節も対象。

4. **(低)進捗記録**: `docs/progress/` 配下に M15-05 のエントリを確認できなかった。DoD §7.4/§7.5・チェックリスト §8 は完了報告に「②の真因(特定した層)」「DES CHANGE 要否判定」の明記を求めている。完了報告(開発者への返答)側で満たされている可能性はあるが、progress-log への追記有無を確認されたい。

## 推奨修正(優先度別)

- **高(M15完了前に修正必須)**: なし。
- **中(M16着手と並行可)**: なし(下記はいずれも低)。
- **低(将来対応)**:
  - CollapsibleFieldset に `aria-labelledby`(見出し id 連携)を付与し、可能なら折りたたみ節の意味論を統一(指摘1)。
  - `ComboEditorBasicFields` 全体の i18n 化時に折りたたみ節 legend も対象化(指摘3)。
  - 全項目温存を保証する軽量な回帰テスト(主要フィールドの存在確認)追加を検討(§4)。
  - progress-log に M15-05 の真因・CHANGE 判定を追記(指摘4・process)。

## 良かった点

- **真因の特定が的確**。「症状のレイヤ≠真因のレイヤ」を回避し、List との差分(FindByID の補完漏れ)を突き止めて List と同一ヘルパを再利用した点は指示書 §3.3・digest §1 の狙い通り。コミットメッセージに経路(FindByID→formatStarterStatus フォールバック)まで明記されておりトレーサビリティが高い。
- BE テストを List テストのミラーとして対称に追加し、FE テストを実装非依存(DOM テキスト検証)で書いた点が digest §5 に沿う。
- ①で「横幅活用を主軸・折りたたみは副次節限定・初期展開」と切り分け、削除ゼロ・レスポンシブ維持を守った設計判断が妥当。DES-005 既定と照合して CHANGE 不要と結論した点も正しい。

## 制約事項

- 本レビューはコード上で判定可能な範囲のみ対象。実際の動作確認・パフォーマンス・実機テスト・情報過密の操作性(①の過密判定)・`make e2e` 全通過・実ブラウザでのレイアウト崩れ有無は別途実施が必要。
- テストは実行しておらず、コミット記載の「既存 606 FE テスト非回帰」は未検証。

---

## 取り込み結果(自動トリアージ / implement_plan_full Phase C・2026-07-04)

本レビューは**優先度「高」・「中」の指摘ゼロ**(低のみ)。安全弁(高の不採用)に該当せずエスカレーション不要。製造側で以下のとおり自動トリアージし取り込んだ。

| # | 指摘(低) | 採否 | 対応/理由 |
|---|-----------|------|-----------|
| 1 | CollapsibleFieldset の a11y(意味論後退・`aria-labelledby` 未付与) | **採用** | `useId` で見出し id を発番し `<section aria-labelledby>` + `<span id>`、`<button aria-controls>` + コンテンツ `<div id>` を付与。`aria-expanded` は既存。 |
| §4 | 全項目温存を保証する回帰テスト | **採用** | `ComboEditorBasicFields.test.tsx` に「全項目温存(削除なし)」テストを追加(基本10フィールド+起き攻め6BOOLEAN+各節 test-id の存在確認)。チェックリスト §4「全項目存在」を直接ガード。 |
| 4 | progress-log に M15-05 エントリ未確認 | **採用** | `docs/progress/progress-log.md` に M15-05 節を追記(②真因層・DES CHANGE 不要判定・test-id・テストケース数・既知の制約を明記=DoD §7.4/§7.5・本チェックリスト §8 充足)。 |
| 2 | FindByID の追加クエリ(書き込み系フローでも発生) | **不採用(仕様)** | 意図的。作成/更新後の `FindByID` 経由レスポンスにも `starterMoveCode` が乗り整合が上がる。単一行 IN クエリでコスト軽微。JOIN 一括化は将来の最適化候補として据置。 |
| 3 | legend の JP ハードコード | **不採用(既存課題)** | 本変更が新規導入した違反ではなく `ComboEditorBasicFields` 全体が i18n 未適用の既存課題。横断的 i18n 化は別対応(将来の i18n パスで本節も対象)。 |

取り込み後: Vitest `ComboEditorBasicFields` 15 緑・FE 全体 607 緑・`tsc --noEmit` 緑。取り込み分は別コミットでチェックポイント。
