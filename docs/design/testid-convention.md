# test-id 規約

## 概要

Playwright E2E テストで使用する `data-testid` 属性の命名・付与方針。M8-02 で導入(CHANGE-024)。

## 命名規則

```
data-testid="{feature}-{element}"
```

- **小文字ケバブケース**
- **feature プレフィックス**で同名衝突を回避
- element は「何のための要素か」を示す語尾にする

例:
```
combo-editor-draft-checkbox   ← combo 登録/編集フォームの仮登録チェックボックス
combo-list-new-button         ← combo 一覧の新規登録ボタン(将来追加時の例)
tag-filter-input              ← タグフィルタ入力欄(将来追加時の例)
```

## 付与方針

**付与する**: `getByRole` / `getByLabel` / `getByText` / `getByPlaceholder` で一意に取得できない操作要素。

**付与しない**: 上記ロケータで一意に取得できる要素。Radix/shadcn の暗黙 role(button / dialog / textbox 等)+アクセシブル名で取得できる場合も付与不要。

### 例: 付与が必要なケース

Radix Checkbox は `<button role="checkbox">` としてレンダリングされる。`<label>` で囲んでもラベルブルな要素でないため accessible name が自動設定されない。→ `data-testid` が必要。

### 例: 付与が不要なケース

「保存」ボタン: `<button type="button">保存</button>` → `getByRole('button', { name: '保存' })` で取得可。

「編集」リンク: `<a>編集</a>` → `getByRole('link', { name: '編集' })` で取得可。

メモ textarea: `<textarea placeholder="このコンボに関するメモ(任意)">` → `getByPlaceholder(...)` で取得可。

## セレクタ優先順位

spec 内のセレクタ選択は以下の優先順位に従う:

1. `getByRole` + accessible name
2. `getByLabel`
3. `getByPlaceholder` / `getByText`
4. `getByTestId` (上記で取得できない場合のみ)

## spec 実行前の環境前提

`make e2e` / `pnpm e2e` を実行する前に以下を確認すること:

> **★★【2026-09-08・CHANGE-171 ／ 2026-09-09 追補＝`D-789`】ポートと起動方式を現行へ直した。** **★★2026-09-08 の反映は打消しバナーを置いただけで、下の原文を書き換えていなかった。⇒ バナーと原文が同居し、原文だけを読んだ人は旧前提を信じる状態だった**（改善レーン D1/D2 の製造が実測）**。★2026-09-09 に原文も直した。** **⇒ 旧記述「ポート 47318(backend)と 5173(vite)」「`reuseExistingServer: true` のため、起動済みなら再利用」は失効した。**
>
> **★★現行は使い捨てスタックである**（`CLAUDE.md` §5）**＝バックエンド `47390` / Vite `5273`**（`web/playwright.config.ts:13-14` / `:29`）**。⇒ dev DB・dev サーバに影響しない。**
>
> **★★絞り込みは `make e2e-only P=<パターン>` を使うこと。⇒ `pnpm exec playwright test` を直接叩かない**（`PW_EXECUTABLE_PATH` が渡らず UI を使う spec が全滅する＝`D-599`）**。**

1. **ウィザード完了済みであること**: アプリ初回起動時のウィザードが完了し、ユーザーが DB に登録済みであること。未完了の場合、`/combos/new` へのアクセスが `/wizard` にリダイレクトされ spec が失敗する。
2. **★★ポート `47390`(backend)と `5273`(vite)が利用可能であること**（**2026-09-09 是正＝`D-789`**）**。⇒ 使い捨てスタックであり、dev DB・dev サーバに影響しない**（`CLAUDE.md` §5）**。** **★★`reuseExistingServer` は `false` である**（`web/playwright.config.ts:152` / `:179`）**。⇒ 再利用は起こらない。★毎回この専用ポートで起動する。** **★以下は失効した記述：** ポート 47318(backend)と 5173(vite)が利用可能であること: `reuseExistingServer: true` のため、起動済みなら再利用し、未起動なら Playwright が自動起動する。

## 付与の実例（**★★2026-09-08・CHANGE-171 で「付与済み一覧」から改めた**）

> **★★本表は全数ではない。⇒ 一元管理は行わない。★新規付与時に本表を更新する義務は無い。**
>
> **★★実測＝`web/src` の `data-testid` は 430 件、本表は 21 行である**（2026-09-08）**。⇒ 一覧としては既に機能していなかった。★「一覧に無い＝未付与」と読むと誤る。**
>
> **★★全数が要るときは実装を引くこと＝`grep -rn "data-testid" web/src --include='*.tsx'`。⇒ 実装が正本である。**
>
> **★★本表に残すのは「判断が要った付与」だけである。⇒ 後から足すのは任意であり、義務ではない。★足す価値があるのは、なぜその名にしたかの根拠が在るものである**（実例＝下の `M29-01` の注記）**。**
>
> **★★一般形＝「一元管理する」と宣言した一覧は、機械検査を伴わないと必ず腐る。⇒ 乗せられないなら、一覧をやめて規約だけ残すほうが正直である。★規約**（命名規則・付与方針・セレクタ優先順位）**は 1 文字も変えていない。**

| data-testid | ファイル | 目的 |
|-------------|---------|------|
| `auth-set-password-rule` ／ `auth-set-password-rule-error` | `web/src/features/auth/PasswordSetForm.tsx` | パスワードを決めるときの規則の案内と、その違反表示(M22-08) |
| `auth-change-password-rule` ／ `auth-change-password-rule-error` | `web/src/features/auth/PasswordChangeForm.tsx` | パスワード変更時の同上(M22-08) |
| `settings-user-logout` | `web/src/features/config/SettingsSectionUser.tsx` | ログアウトの導線(M22-08)。**表示条件は `passwordRequired`(実効値)** |
| `settings-user-rename` ／ `-form` ／ `-name` ／ `-submit` ／ `-error` | `web/src/features/config/UserManagement.tsx` | 利用者の改名(M22-08) |
| `conflict-dialog` ／ `-input-kept` ／ `-view-theirs` ／ `-reload` ／ `-close` ／ `-reload-confirm` ／ `-reload-execute` ／ `-reload-cancel` | `web/src/components/ConflictDialog.tsx` | 競合モーダル(M22-04)。版不一致と 404 の導線 |
| `setup-editor-duplicate-setup` | `web/src/pages/SetupEditorPage.tsx` | 同一レシピ重複(`duplicate_setup`)のインライン表示(M22-04)。**版不一致とは別物** |
| `color-input` | `web/src/features/tag/components/TagFormDialog.tsx` | タグ色入力フィールド(M7-02 以前から存在) |
| `combo-detail-image-path` | `web/src/features/combo/components/ComboDetailMetadata.tsx` | 詳細のメディア画像パス表示(M17-01)。テキスト表示のみの検証用 |
| `combo-detail-link` | `web/src/features/combo/components/ComboDetailMetadata.tsx` | 詳細のメディアリンク表示(M17-01)。非リンク時(危険スキーム)のテキスト検証用 |
| `combo-detail-video-path` | `web/src/features/combo/components/ComboDetailMetadata.tsx` | 詳細のメディア動画パス表示(M17-01)。テキスト表示のみの検証用 |
| `combo-editor-custom-state-{code}` | `web/src/features/combo/components/ComboEditorBasicFields.tsx` | キャラ固有状態(custom_states)の flag トグル。`{code}` は状態コード(例 `denjin_charge`)。Radix Checkbox で accessible name が無いため付与 |
| `combo-editor-draft-checkbox` | `web/src/features/combo/components/ComboEditorBasicFields.tsx` | 仮登録モード切替チェックボックス(M8-02 で付与) |
| `combo-editor-image-path` | `web/src/features/combo/components/ComboEditorBasicFields.tsx` | メディア画像パス入力欄(M17-01) |
| `combo-editor-link` | `web/src/features/combo/components/ComboEditorBasicFields.tsx` | メディアリンク入力欄(M17-01) |
| `combo-editor-video-path` | `web/src/features/combo/components/ComboEditorBasicFields.tsx` | メディア動画パス入力欄(M17-01) |
| **`combo-recipe-steps-empty`** | `web/src/features/combo/components/RecipeBuilder.tsx` | **空ステップの案内**（**★2026-09-06・`CHANGE-161`・`M29-01`**）**。★文言ではなく構造で掴むために付けた** |
| **`setup-recipe-steps-empty`** | `web/src/features/setup/components/SetupRecipeEditor.tsx` | **同上**（セットプレイ側）**。★★前者と分けてある**——**`SetupInputRow` が `SetupRecipeEditor` を描くため、コンボエディタでは両方が同時に存在する。⇒ 共通名 1 本にすると Playwright の strict モードで落ちる** |
| **`import-issue`** | `web/src/pages/ComboImportPage.tsx` | **CSV 取込の課題バッジ**（**★2026-09-06・`CHANGE-161`・`M29-01`**） |
| **`export-truncation-confirm`** | `web/src/features/combo-io/components/ExportDialog.tsx` | **書出が上限で切り捨てるときの確認**（**★2026-09-07・`M29-02`**）**。★文言ではなく構造で掴むために付けた**（件数は可変であり、文面での照合は語を直すたびに壊れる） |

> **★★【2026-09-06 新設＝`CHANGE-161`・`M29-01`】同じ testid を面ごとに分けるかは「同時に画面へ出うるか」で決まる。**
>
> **★実例＝`combo-recipe-steps-empty` と `setup-recipe-steps-empty`。⇒ `SetupInputRow` が `SetupRecipeEditor` を描くため、コンボエディタでは 2 つが同時に存在する。★共通名 1 本にすると Playwright の strict モードで落ちる。**
>
> **★★共通名を付ける前に、包含関係を 1 度たどること。⇒ 「別の画面だから衝突しない」は、部品の入れ子で崩れる。**

## 既知のセレクタ・ギャップ

spec から操作したいが現状では安定セレクタが無い要素を記録する。新規 spec 作成時の参照用。

| 要素 | ファイル | 状況 | 解消方法 |
|------|---------|------|---------|
> **★★【2026-09-08・CHANGE-171】本ギャップは解消済みである。⇒ 以下の行は失効した。**
（旧行）| 数値メタデータ入力(ダメージ / ドライブゲージ / SAゲージ / ドライブダメージ / ダウン後有利 等) | `web/src/features/combo/components/ComboEditorBasicFields.tsx` | `Field` が `<Label>` を `htmlFor` 未関連でレンダリングするため `getByLabel("ダメージ")` 等で取得不可。`<Input type="number">` にも testid 無し → 数値項目を spec で直接操作できない | 数値項目を spec 化する際に `combo-editor-{field}`(例 `combo-editor-damage`)を最小付与してこの一覧へ登録するか、`Field` を `htmlFor`+`id` 関連付けへ改修して `getByLabel` 可能にする(後者はコンポーネント構造変更のため Plan Mode 推奨) |
>
> **★実測＝`web/src/features/combo/components/ComboEditorBasicFields.tsx:372` / `:535` / `:603` に `combo-editor-damage` / `combo-editor-drive-damage` / `combo-editor-knockdown-advantage` が実装され、E2E の `fillRequiredComboFields`**（`web/e2e/support/editor-input.ts:51-57`）**が実際に使っている。**
>
> **★★解消済みのギャップが未解消として残り、一覧への登録だけが漏れていた。⇒ 一覧運用を畳んだ理由の 1 つである。**

> 経緯: M11-02 の E-1 非回帰 E2E(`combo-crud.spec.ts`「メモのみ編集しても custom_states が温存される」)追加時に発見。当該 spec は production コード非変更の方針のため、数値項目の代替として安定 testid を持つ custom_states(電刃錬気)で「未編集項目の温存」を検証している。数値項目の温存検証は Go 側 `TestRepository_UpdateMetadata_Tristate` 等で単体カバー済み。

## 追加ガイドライン

- 新規 spec を追加する際、付与が必要な要素を発見したら最小限付与する。**★★一覧への登録は義務ではない**（2026-09-08・`CHANGE-171` で一元管理を畳んだ）**。⇒ 判断が要った付与だけを「付与の実例」へ足す。**
- 付与は spec が触る操作要素に限定し、表示専用要素には付与しない
- コンポーネントのロジック・構造変更を伴う場合は Plan Mode で確認する
