# M15-05 ラウンド2 レビュー報告書

対象コミット: `98b1007`（feat(M15-05/combo): 登録画面R2 - 全節折りたたみ・Switch化・その他情報統合・レシピサマリ）
レビュー種別: 静的コードレビュー（Read のみ・コード変更なし）
レビュー日: 2026-07-04

## 総評

登録/編集画面（ComboEditor）の縦圧縮・入力体験改善を目的とした FE 表示層のみの変更で、**DTO/API/スキーマは完全に不変**、既存部品（RecipeBuilder / VirtualController / TagSelector / SetupRecipeEditor）の機能内部にも手を入れておらず、外枠 `fieldset`→`CollapsibleFieldset` への差し替えとサマリ/Switch 追加に留まっている。ラウンド1で確立した `CollapsibleFieldset`（`defaultOpen=true`）パターンを一貫して踏襲しており、初期全展開の要件も満たす。新規関数 `formatRecipeLine` は純粋関数として切り出され、combo `Step` と setup `SetupStepInput` の双方に適用可能な最小シグネチャで、単体テストも妥当。DES 本体・CHANGE 通知書は未編集で、progress-log にラウンド2の §5.7 差分と ⑩ 残課題が明記されており、製造プロセスの規約（DES 本体を製造が編集しない）も遵守されている。

**優先度「高」の指摘はなし**。以下はいずれも中〜低の改善余地・注意喚起である。

## 設計準拠性レビュー結果（◎/○/△/× で項目別）

| 観点 | 判定 | 根拠 |
|------|------|------|
| 非スキーマ・非破壊（DTO/API/スキーマ不変） | ◎ | 変更ファイルは web/src の FE 表示層と progress-log のみ。型（`Step`/`SetupStepInput`/`ComboResponse`）・API 呼び出し・payload 組立に一切変更なし。`formatRecipeLine` は読取専用。 |
| 既存部品の機能内部が不変か | ◎ | RecipeBuilder は `<fieldset>`→`CollapsibleFieldset` の外枠差し替えとサマリ追加のみ。step 編集・`onChange` 契約・VirtualController・全技プルダウン（`recipe-pulldown-toggle`）は不変。TagSelector/MyComboStatusSelect/SetupRecipeEditor も props 変更なし。`showDraftToggle`/`onCreateTag` 等の配線も維持。 |
| 折りたたみ（defaultOpen=true）で既存挙動が保たれるか | ○ | 初期全展開のため既存の可視性は保たれる。`<button type="button">` で form submit 誤発火なし。ただし `<fieldset>`→`<section aria-labelledby>` により form control のネイティブ・グルーピング意味論は失われる（下記【設計外1】）。 |
| Switch 化の妥当性（off で undefined 維持・testid 据置・click 応答） | ◎ | custom-state flag は `checked === true ? true : undefined` で off=undefined の消去意味論を維持。draft/flag とも testid（`combo-editor-draft-checkbox` / `combo-editor-custom-state-*`）据置。Radix Switch は `role="switch"`＋`data-state`＋click 応答を提供し E2E 互換。`aria-label` 追加は a11y 改善。 |
| formatRecipeLine の正しさ | ○ | フォールバック順 `nameJa → code → moveCode → #id` を実装どおり（`m?.nameJa ?? m?.code ?? s.moveCode ?? \`#${moveId}\``）。非技ステップは `MODIFIER_NON_MOVE_TYPES` の区分ラベルへ解決。空/undefined は空文字。Step/SetupStepInput 双方に適用可。**軽微**: 未知の非技 type（`modifiers.type` が候補外／`moveId==null`かつ`modifiers`なし）は `"?"` を表示する（下記【設計外2】）。 |
| アクセシビリティ/UX（コンパクト化・折りたたみで到達性悪化なし） | ○ | 初期全展開で到達性は確保。`section aria-labelledby` + `button aria-expanded/aria-controls` は概ね良好。サマリは `truncate`＋`title` でツールチップ補完。軽微な a11y 論点（label-in-name、Field ラベル未 htmlFor）はいずれも既存パターン踏襲で新規悪化なし。 |
| テスト妥当性（実装非依存・カバレッジ） | ○ | `formatRecipeLine` 5 ケース（nameJa/code/moveCode/#id/非技/空）と RecipeBuilder サマリ・折りたたみ 3 ケースは実装非依存で妥当。flag アサーションを `role="switch"` へ更新。**穴**: SetupInputRow のサマリ（`setup-input-recipe-summary-{index}`）・inline draft の ComboEditor レンダリングに直接テストなし（下記【設計外3】）。 |
| DES-005 §5.7 CHANGE 要否の妥当性 | ◎ | 表示項目1/2 コンパクト化・項目3 配置+Switch・項目6 Switch 表記・メモ/マイコンボ/タグの「その他情報」統合・各節折りたたみ+レシピサマリ新設は §5.7 の表示項目/レイアウト仕様の改訂に該当し CHANGE 要は妥当。製造は DES 本体・change-notes を未編集（`git show --stat` で確認）。progress-log に §5.7 差分（起票用箇条書き）と ⑩ 残課題を明記。 |
| コーディング規約 | ○ | `console.log`/`fmt.Println` の残置なし。`eslint-disable`/`nolint` 濫用なし。マジックストリングはラベル定数（`MODIFIER_NON_MOVE_TYPES`）を再利用。JP ハードコード（legend/ラベル/`aria-label`）は `ComboEditorBasicFields` 全体が i18n 未適用という既存課題の範囲内で、progress-log にも既記載。許容範囲。 |

## 設計準拠性以外の指摘事項

- **【設計外1】fieldset→section の意味論ダウングレード（低）**: `CollapsibleFieldset` は `<section aria-labelledby>` で、従来 `<fieldset>` が提供していた form control のネイティブ・グルーピングは失われる。特に「基本情報」は多数の入力欄を束ねる節であり、`<fieldset>`/`<legend>` の関連付けが消える。ただしラウンド1で確立済みのパターンを一貫踏襲しており、`aria-labelledby` で見出し関連付けは維持されるため実害は小さい。設計としての既定路線であり、指摘は記録に留める。

- **【設計外2】formatRecipeLine の "?" フォールバック（低）**: `moveId==null` かつ `modifiers.type` が `MODIFIER_NON_MOVE_TYPES` に無い（または `modifiers` 自体が無い）ステップは `"?"` を表示する。M15-03 で dash は system move（`moveId` あり）へ寄せたため通常発生しにくいが、レガシー modifier や不完全ステップで `"?"` がサマリに出得る。サマリは近似表記（⑩ 残課題として明記済み）のため許容だが、`"?"` より無害な扱い（当該ステップを空スキップ等）も検討余地。

- **【設計外3】テストカバレッジの穴（低〜中）**: (a) SetupInputRow のサマリ（`setup-input-recipe-summary-{index}`）表示は `formatRecipeLine` 単体テストで間接カバーされるが、コンポーネント結線（`moves` prop の伝播: ComboEditor→SetupRegistrationSection→SetupInputRow）の回帰テストがない。(b) 新規/コピー時に ComboEditor が inline draft を最上部へ描画する配置替えのユニットテストがない（commit は E2E で非回帰確認と記載＝静的には未確認）。いずれも既存 E2E での担保に依存。

- **【設計外4】draft Switch の label-in-name 軽微差（低）**: inline draft は可視テキスト「仮登録」に対し `aria-label="仮登録として保存"`。アクセシブル名が可視文字列を部分包含するため WCAG 2.5.3 は満たすが、可視ラベルとアクセシブル名の不一致は残る。custom-state flag 側は `aria-label=name_ja` で可視と一致しており良好。

## 推奨修正（優先度別）

### 高
- なし。

### 中
- **テスト補完**: SetupRegistrationSection→SetupInputRow への `moves` 伝播とサマリ表示、および ComboEditor の inline draft 配置（`mode!=="edit"` で最上部に単一描画・testid 重複なし）を、少なくとも 1 ケースずつユニットで固定することを推奨（現状 E2E 依存）。

### 低
- `formatRecipeLine` の未知非技ステップ `"?"` を、より無害な表示（例: 空スキップ、または「?」の意味が伝わる記号）へ変更する余地。近似表記のため必須ではない。
- inline draft の `aria-label` を可視テキスト「仮登録」と揃えるか、可視テキストを冗長化して一致させる（label-in-name の完全一致化）。
- 中長期の i18n 化時に `CollapsibleFieldset` legend・各 `aria-label`・「(編集モードでは変更不可)」等の JP ハードコードを一括対象化（既存課題として progress-log に既記載）。

## 良かった点

- **一貫したパターン適用**: ラウンド1で導入した `CollapsibleFieldset`（`defaultOpen=true`）を全節へ横展開し、`summary` スロットを追加設計する形で「畳んでも一目で分かる」を実現。枠を再利用可能に作っており拡張性が高い。
- **純粋関数の切り出しとテスト**: `formatRecipeLine` を `utils.ts` の純粋関数として切り出し、フォールバック順・非技ラベル・空入力を網羅した単体テストを付与。combo/setup 双方に効く最小シグネチャ設計。
- **off=undefined の消去意味論を Switch 化後も厳密維持**: custom-state flag の `undefined` 維持を明示コメント付きで担保し、既存の付与値削除ロジックを壊していない。
- **testid 据置による E2E 互換の配慮**: Checkbox→Switch 変更時も `data-testid` を据え置き、`aria-label` を追加。
- **プロセス遵守**: DES 本体・change-notes を製造が編集せず、CHANGE 要否と §5.7 差分・⑩ 残課題（正規 notation 解決の BE/設計連携）を progress-log に明記。残課題は「呼び出し箇所差し替えで移行可能」と設計意図まで記録。

## 制約事項
- 本レビューはコード上で判定可能な範囲のみ。動作確認・実機テストは別途。

---

## 取り込み結果(自動トリアージ / implement_plan_full Phase C・2026-07-04)

**優先度「高」ゼロ**(安全弁非該当・エスカレーション不要)。製造側で以下のとおりトリアージ・取り込み。

| 指摘 | 優先度 | 採否 | 対応/理由 |
|------|--------|------|-----------|
| テスト補完(SetupInputRow への moves 伝播+サマリ表示 / inline draft 配置) | 中 | **一部採用** | `SetupInputRow.test.tsx` に `moves` 伝播→サマリ表示・空プレースホルダの 2 ケースを追加。**inline draft 配置は既存 `ComboEditor.test.tsx`(new モードで `combo-editor-draft-checkbox` を解決・edit モードで非表示)で既カバー**のため追加不要。 |
| 【設計外1】fieldset→section の意味論ダウングレード | 低 | **不採用(記録)** | ラウンド1で確立した `CollapsibleFieldset` パターンの一貫踏襲。`aria-labelledby` で見出し関連付けは維持され実害小。既定路線。 |
| 【設計外2】formatRecipeLine の "?" フォールバック | 低 | **不採用(仕様)** | サマリは近似表記(⑩ 残課題として明記済み)。解決不能ステップに "?" を出すのは正直な挙動。M15-03 で dash は system move(moveId あり)へ寄せたため発生は稀。 |
| 【設計外4】draft Switch の label-in-name | 低 | **不採用(規格充足)** | 可視「仮登録」⊂ アクセシブル名「仮登録として保存」で WCAG 2.5.3 を満たす。 |
| i18n(JP ハードコード) | 低 | **不採用(既存課題)** | `ComboEditorBasicFields` 全体の i18n 未適用という横断的既存課題。将来の i18n パスで一括対象化(progress-log 既記載)。 |

取り込み後: Vitest `SetupInputRow` 8 緑・FE 全体 617 緑・`tsc --noEmit` 緑。取り込み分は別コミットでチェックポイント。
