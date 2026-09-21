# M38-01 完了報告 — 新規登録・編集の必須と値域の是正

| 項目 | 内容 |
|------|------|
| 作業 ID | **M38-01** |
| 指示書 | `docs/instructions/M38-01-combo-editor-required-and-domain.md` **v1.0.0** |
| チェックリスト | `docs/instructions/reviews/M38-01-review-checklist.md` **v1.0.0** |
| 実施日 | 2026-09-17（本体・追補1） ／ **2026-09-18（追補2）** |
| 着手基点 | **`7ce1393`**（Merge PR #230） |
| 成果コミット | `dc2848f` ／ `ef176b7` ／ `adfffe8` ／ `919beb7` ／ `13e9246` ／ 追補1 `badc7f0` ／ **追補2（§10）** |
| マイグレ | **0 本。`000118` を未消費で返す**（§7） |
| スキーマ変更 | **0**（列を 1 つも足していない） |
| 新規依存 | **0** |

---

## 1. 着手前の版ゲート（§0.4・**実測**）

| # | 確かめること | 実測値 | 判定 |
|---|---|---|---|
| 1 | チェックリストの存在 | `docs/instructions/reviews/M38-01-review-checklist.md` v1.0.0（5894 B） | ✅ |
| 2 | `DES-006` が 1.49.0 以上 | **1.49.0**（`VAL-C15` は `06-validation.md:52`） | ✅ |
| 3 | `SUPP-001` §3.2 の `hit_type` が 8 値 | `supp-001-detailed-design.md:399` に 8 値。食い違いなし | ✅ |
| 4 | `ls migrations/` の最新 | **`000117_add_combos_starter_meaty`**（`*.up.sql` **実測 115 本**。`000113` は欠番） ⇒ 次は `000118` | ✅ 払い出しと一致 |
| 5 | 枝元 | `7ce1393 Merge pull request #230 from plexiblinp/claude/adoring-thompson-hl2142` | ✅ |

---

## 2. ★★★段 1 の実査（**コードを書く前に済ませた**）

### 2-1. ヒット種別の「不問」の正体 ⇒ **§2.5 の分岐 (A)**（**実測**）

| 問い | 実測 |
|---|---|
| 選択肢の実体はどこか | `ComboEditorBasicFields.tsx:703`（着手前）が `options={withUnspecifiedFirst(HIT_TYPE_OPTIONS)}`。`withUnspecifiedFirst`（同 `:1446-1458`）が `{value:"", label:UNSPECIFIED_LABEL}` を**先頭へ動的に足していた**。`UNSPECIFIED_LABEL = "不問"` は `labels.ts:32` のハードコードであり i18n 経由ではない |
| 選ぶと DB へ何が入るか | **NULL**。`ComboEditor.tsx` の `nullIfEmpty` が `"" → null` にし、`service.go` の `buildComboFromInput` は変換も既定値代入もせず、`repository.go:536` が `*string` の nil を SQL NULL としてバインドする |
| `hit_type` の既定値は何か | **`""`＝不問**（`ComboEditor.tsx:1345` 新規 ／ `:1381` 編集） |
| 「1」の正体 | ラベルではない。`optionButtons.ts:42-46` の `shortcutKeyForIndex(0)` が返す**数字キーの表示**（`OptionButtonGroup.tsx:182-203` がラベルの前に描く） |

**⇒ (A)「UI だけの選択肢で、選ぶと NULL が入る」。**

- **★(B) ではない** —— `any` 等の独自値は DB に入らない。`HIT_TYPE_OPTIONS`（`labels.ts`）・`HIT_TYPE_VALUES`（`constants/combo-list.ts:72-87`）・`model.HitType*`（`internal/model/combo.go:25-35`）はいずれも設計書どおりの **8 値**であり、**値域側に「不問」は無い**。
- **★(C) でもない** —— `opponent_stance` の `any` は隣の欄であり、保存値は文字列 `"any"`。同欄は `stanceOptionsFor()` を通し `withUnspecifiedFirst` を通さない。
- **★バグではなく、M24-12（2026-08-28 開発者指示）で 4 欄へ一律に足したものであった。** 開発者の見立て「過去の実装担当が仕込み、発見できなかったバグの可能性」（逐語）は、実測では**当時の開発者指示の副作用**である。

### 2-2. 既存 NULL 行の件数 ⇒ **★開発者が実 DB で実測（91 件）**

**着手時点では測れなかった。** 実測 ＝ `find . -name '*.db'` が **0 件**（`.gitignore:30` が `*.db` を除外）。`combos.hit_type` は `TEXT`（`migrations/000001_init_schema.up.sql:69`）で **NOT NULL も CHECK も持たない**ため、構造から「0 行」と言い切ることもできなかった。⇒ 指示書 §2.1 の指示どおり開発者へ諮った。

**★2026-09-17、開発者が実 DB で実行した結果 ＝ 91 件。**

```sql
SELECT COUNT(*) FROM combos
WHERE hit_type IS NULL AND deleted_at IS NULL AND is_draft = 0;
-- → 91
```

- **★これは検証用 DB での実測である**（開発者の逐語＝「あくまで検証用DBであり、検証用途でも残っていてもエラーは起こさないのでこのままでいいかと思っています」）。
- **★着手時の算出とも合う** —— `hit_type` の既定が `""`＝NULL であったため、明示的に選ばない限り NULL で保存されていた。⇒ 「NULL 行は多いと見るのが自然」という算出は当たっていた。
- **★マイグレを作らない判断は不変である**（§7）。件数が分かっても、根拠 3 点のうち (a)「寄せる先が正しいと言える根拠が無い」と (b)「衝突を数える手段が無い」は動かない。

### 2-3. 重複判定キーの衝突組数 ⇒ **★依然として測っていない**

**⇒ `recipe_hash` は列として保存されておらず Go 側で計算している**（`internal/service/combo/duplicate_keys.go`。`CalcRecipeHash` が `internal/recipehash` へ委ねる）。**⇒ 純粋な SQL では衝突を数えられない。**

**★寄せるマイグレを作らないと決めた以上、この数は判断に要らない。**（★ただし §8-3 の横断課題＝「NULL の既存行と新規の `normal` 行が別キーになる」の母数としては **91 件**が効く）

### 2-4〜2-6（残りの実査・**実測**）

| # | 実測 |
|---|---|
| **4** | `VAL-C15` の足し先は **4 か所**（§3 の表）。走る経路は **7 本** ＝ POST(`service.go:374`) / PUT(`:879`) / PATCH 昇格(`:713`) / PATCH 非昇格(`:752`) / materialize(`:1688`) / CSV プレビュー(`csvcore/validate.go:218`) / CSV 確定 |
| **5** | 矢印の増減は `<input type="number">` の**ブラウザ既定**であった。`useFieldSequence.ts:35-58` の `keyIsClaimedByField` が number の ↑↓ を**意図的に順送りから除外**して既定を残していた（M24-12 の実装判断） |
| **6** | 開始残量 2 欄はどちらも `<Input type="number">`（drive＝min0/max6/`step="any"` ／ sa＝min0/max3）。state は `string` で `""` が未入力。送信時に `parseOptFloat`/`parseOptInt` が `"" → null`。**null を「不問」として明示する手段は着手前ゼロ** |

### 2-7. ★スピナーは着手前から全撤去済みであった（**段 2-3 は満たされていた**）

`numericInput.ts:14-31` の `NO_SPINNER` がコンボエディタの `type="number"` **12 箇所すべて**に当たっている（M24-12・`CHANGE-138`）。`ComboEditorBasicFields.test.tsx` が「スピナー付きの number 欄は 0 個」を母数 10 で固定している。**⇒ 本サブでスピナーを消す作業は無かった。**「押せるのに効かないボタン」も生じていない。

> **★唯一の例外は `SetplaySuggestionSection.tsx` の 4 欄**（素の `<input type="number">`・`NO_SPINNER` なし）。**コンボエディタ外であり射程外**。⇒ 横断課題へ回した。

---

## 3. やったこと

### 3-1. 射程 1 — 矢印キー（`dc2848f`）

`useFieldSequence.ts` の `keyIsClaimedByField` から **number 分岐を落とした**。`textarea` の分岐は残した（メモ欄では ↓ がカーソル移動であってほしい＝`D-578(5)`）。呼び出し元（`onKeyDown`）は既に `preventDefault()` してから `move()` するため、**既定の増減の抑止とフォーカス移動が 1 手で揃う**。

### 3-2. 射程 5 — ヒット種別（`ef176b7`）

| # | やったこと |
|---|---|
| 1 | `labels.ts` に **`hitTypeOptionsFor`** を新設（`stanceOptionsFor` と同型）。**読み込んだ値が空のときだけ末尾へ「(未指定)」を足す** |
| 2 | `constants/combo-list.ts` に **`HIT_TYPE_NORMAL`**（BE の `model.HitTypeNormal` と対。`OPPONENT_STANCE_ANY` の先例に倣った） |
| 3 | **新規の既定を `normal` に**（`ComboEditor.tsx`） |
| 4 | **編集の初期値は読込値のまま**（`?? ""`）。★ここを `?? HIT_TYPE_NORMAL` にすると、NULL の既存行を開いて保存しただけで値が化け、**重複判定キーが変わる**（指示書 §4.2） |

- **★値域〔8 値〕は 1 つも動かしていない。** 消したのは**選択肢**からであって値域からではない。
- **★ラベルは「不問」ではなく「(未指定)」にした**（`LEGACY_UNSPECIFIED_LABEL`）。⇒ 消したはずの語が残ると消し残しに見えるため。`stanceOptionsFor` と同じ判断である。
- **★末尾に足した**（先頭ではない）。⇒ 先頭へ足すと 8 値の数字キー割当が 1 つずつずれ、「通常」が 1 でなくなる。
- **★`withUnspecifiedFirst` 自体は残した** —— `POSITION_OPTIONS` と `OPPONENT_SIZE_OPTIONS` が引き続き使う（**射程外**＝2026-09-17 開発者裁定）。

### 3-3. 射程 3 — `VAL-C15` の 4 欄の入れ替え（`adfffe8`）

**着手前** `damage` / `knockdownAdvantage` / **`driveGaugeConsumed`** / **`saGaugeConsumed`**
**着手後** `damage` / `knockdownAdvantage` / **`driveAvailableAtStart`** / **`saAvailableAtStart`**

**4 か所を同じ手番で直した**（3 本が互いを「正典」と名指しでコメント結合している）。

| # | ファイル | 直したもの |
|---|---|---|
| 1 | `internal/service/validation/combo.go` | `requiredPublishedFields` |
| 2 | `internal/service/comboio/csvcore/validate.go` | `requiredPublishedCSVFields` |
| 3 | `web/src/constants/field-requirement.ts` | `REQUIRED_PUBLISHED_COMBO_FIELDS` |
| 4 | `web/src/features/combo/schema.ts` | `comboFormSchemaPublished` |

- **★欄数は 4 のままである。** 中身が入れ替わっただけ。
- **★外した 2 欄の値域担保は 1 つも外していない。** 同 2 欄は `DES-006` §2.5 が「範囲 VAL 非連動」と定めており、**BE にも zod にも範囲 ERROR が元から無い**。担保は UI クランプ（`clampNumericString` 0〜6 / 0〜20）だけであり、そこは 1 文字も触っていない。⇒ E2E で「25→20 / 9→6」を固定した。

### 3-4. ★★★射程 4 — 「不問」を選べるようにする（`adfffe8`）

**開発者の逐語** ＝「画面上、null の場合はテキストボックス上に薄く不問と見えると良いです」。

#### 採った案と理由（**実装判断**）

**数値欄 ＋ 右隣の「不問」スイッチ**（`GaugeAtStartInput`）。不問のとき値を空にし、`placeholder` に薄く「不問」を出す。**★切り替えは数値欄の中の `Space`**（下記 3-4-2 の作り直し後）。

検討した案は 3 つ。

| 案 | 採否 | 理由 |
|---|---|---|
| **(a) 数値欄 ＋ 右隣の「不問」スイッチ** | **★採用** | 1 行に収まり縦に伸びない ／ 既存 testid と `fill()` がそのまま生きる ／ 逐語「テキストボックス上に薄く不問」を字義どおり満たす ／ **「不問」は値であって入力方式ではない**という意味が正しい |
| (b) 入力方式ピル（`M37-01` の始動位置と同じ形） | 不採用 | **「不問」は入力方式ではない。** 始動位置のピルは「同じ 1 本の値をマスで入れるか % で入れるか」＝真に方式だが、こちらは**値そのものが変わる**。用途を混ぜるとピルの役割が読めなくなる。★2 段になり、必須 4 欄を上へ固めた効果（射程 2）が縦に間延びして薄れる |
| (c) 事後解決型（空のまま保存を押したら課題欄に「不問として保存する」導線を出す） | 不採用 | **保存を一度失敗させることが前提の操作**になる。★`ValidationDisplay` は表示専用の部品であり、操作を持ち込むと役割が割れる |

#### 落とせない設計判断

- **★★★入力欄を `disabled` にも `readOnly` にもしない。** `useFieldSequence` の `focusableIn` は `input:not([disabled])` で**その停止点の最初の focusable**を拾う。入力欄を disabled にすると、外側の停止点も入れ子の停止点も**同じトグル**を指すことになり、**順送りがそこで詰まる**。★型検査もテストも E2E も緑のまま、キーボード経路だけが落ちる型である。⇒ 破壊確認を 1 本置いた。
- **★トグルは入力欄より DOM 上で後ろに置く。** 前に置くと `focusableIn` がトグルを拾い、数値欄へフォーカスが載らなくなる（相手の大きさの ⓘ と同じ理由）。
- **★★★トグルを独立した `data-seq-stop` で包まない。かわりに数値欄の中の `Space` で切り替える**（**2026-09-17 の作り直し**。理由は下記 3-4-2）。
- **★新規は不問を既定にしない。** 既定 ON にすると必須が自動で満たされ、必須化の意味が消える（§2.4.2-3 は利用者に決めさせることを要求している）。★消費 2 欄が `GAUGE_CONSUMED_DEFAULT = "0"` を先入れするのとは**意図的に非対称**である —— 「消費 0」は実在の多数派だが、開始残量に多数派の値は無い（キャラ・状況依存）。既定を入れると嘘の値が全コンボへ入る。
- **★既存行の NULL は「不問」として表示する**（`initial.x == null` なら不問 ON）。**書き換えない**（§0.2-4 / §3-4）。

#### ★★★門をどこへ置いたか（**本サブで最も重い判断**）

**「不問」と「空のまま」は payload ではどちらも `null` であり、サーバでも zod でも区別できない**（Go の `encoding/json` はキーの省略と明示的な null すら区別しない＝`DES-006` §5 が既に明記）。

⇒ **区別が残っている唯一の場所はフォーム state** である。門は新設した純粋関数に置いた。

- 実体 ＝ `web/src/features/combo/requiredPublished.ts` の `requiredPublishedIssues`（**payload ではなく `BasicFieldsValue` を見る**）
- 保存経路（`ComboEditor.tsx`）で zod の issue と **1 つの配列へ畳んでから 1 回だけ出す**。⇒ 片方で早期 return すると、直せる欄が 2 回に分けて出て「直したのにまた怒られる」になる
- `code` は `"CLIENT"` ではなく **`"VAL-C15"`**。⇒ 画面のバッジが BE と同じコードになる
- `field` は camelCase の DTO 名。⇒ `editorTabs.ts` の `tabOfIssueField` が既定の「基本情報」タブへ落とす（**4 欄とも基本情報タブの欄なので正しい**）。`FIELD_LABELS` は既に 4 欄とも日本語の呼び名を持っており、**足すものは無かった**
- `message` は BE（`validateC15RequiredFields`）と**同文**。⇒ 経路によって文面が割れない

**⇒ BE / CSV 側の新 2 欄の `present()` は「常に真」とし、理由を逐語コメントで残した**（2026-09-17 開発者裁定）。**★`!= nil` へ「直す」と不問の保存そのものが 400 で落ちる。** その破壊確認が `TestC15_StartGauges_NilIsNotError` である。

#### ★★★3-4-2. 開発者の実機確認を受けた作り直し（`badc7f0`・2026-09-17）

**開発者の逐語** ＝「テキストボックス上に不問とつく事自体は期待通りでした。**ただしキーボードからマウスに持ち変えずに入力できる、という良さが、トグルボタンで切り替える作りだと消えてしまう。**」

##### 何が問題だったか

**★事実としては、旧案でもキーボードだけで操作はできた**（トグルは `data-seq-stop` で包んであり `Enter`/`↓` で到達し `Space` で切り替わる）。**⇒ しかし指摘の本質は正しい。**

**トグルを独立した順送りの停止点にしたことで、数値を打つだけの利用者も毎回そこを通過させられていた**（開始ドライブ・開始SA で **+2 停止**）。

**★★★しかも旧案はキーボードの担保としても弱かった**（実装を読み直して判明）。

> `web/src/features/keyboard/excludedKeys.ts` の逐語 ——「**Space を登録した利用者は、入力面が表示されている間、Space でフォーカス中のボタン・スイッチを実行できなくなる**」

**⇒ 「Switch へ Tab して Space」は、Space を技に割り当てた利用者では成立しない。**

##### どう直したか

| # | 変更 |
|---|---|
| **1** | **トグルを包む入れ子の `data-seq-stop` を外した**。`Field` 自体が停止点（「1 欄 = 1 停止」）であり、`focusableIn` は `querySelector`（**単数**）で DOM 順の最初の focusable を拾う。トグルは入力欄より後ろに在るので、**順送りは数値欄だけを踏む**。⇒ **停止点は 18 → 16** |
| **2** | **数値欄の `onKeyDown` で `Space` を拾って不問を切り替える**。`blockNonNumericKeys` を包む形にし、Space 以外は従来どおり委譲する |
| **3** | **トグルは残す**（マウスで押せる・Tab で届く）。ラベルへ薄く `(Space)` を出し、入力欄へ `aria-keyshortcuts="Space"` |

##### ★★Space が安全であることの根拠（**実測**）

| # | 根拠 |
|---|---|
| 1 | `useKeyboardInput.ts` の**最初のガード**が `isEditableElementFocused()` であり、`<input type="number">` は `:read-write` に当たる（`editableFocus.test.ts` が固定）。⇒ **数値欄の中では利用者が登録した物理入力の割当が一切発火しない。★旧案より堅い** |
| 2 | `blockNonNumericKeys`（`numericInput.ts`）が抑止するのは `e` / `E` / `+` / `-` / `.` だけ。**Space は素通り**で、`type="number"` の既定では何も入力されない。⇒ **奪っても失うものが無い** |
| 3 | `OptionButtonGroup` は `Space` を使っていない（`indexForShortcutKey` は 1 文字の数字以外を `null` にする） |
| 4 | `Enter` / `↑` / `↓` は `useFieldSequence` が順送りに使っている。⇒ **数値欄で余っているのは実質 `Space` だけ**である |

##### ★足した破壊確認

- **★★★E2E: `page.keyboard` だけで、1 度もクリックせずに不問を設定して保存できる**（`m38-01-required-and-unspecified.spec.ts`）。⇒ 「マウスに持ち替えない」は**実ブラウザでしか示せない**
- **★★E2E 対照: 数値を打つだけなら順送りが不問トグルを踏まない**。⇒ **+2 停止が消えたことの直接の証跡**
- 単体: Space で入る ／ もう一度で外れる ／ **トグルが数値欄と同じ停止点に居る**（旧契約の反転） ／ 順送りの着地点が数値欄であること ／ Space 以外の抑止は 1 つも緩めていないこと

##### ★失効させた契約

- 「**★★トグルを独立した `data-seq-stop` で包む。⇒ 包まないと順送りが数値欄だけを踏んでトグルを飛ばし、キーボードだけでは不問を選べなくなる**」 ⇒ **停止点の並び表**（`ComboEditorBasicFields.test.tsx`）と index 直書き 3 箇所も同時に是正した。

### 3-5. 射程 2 — 必須項目を上へまとめる（`919beb7`）

**採った並びと理由**（**実装判断**）。

| 順 | 欄 | |
|---|---|---|
| 1 | ダメージ | ★必須 |
| 2 | 有利フレーム | ★必須 |
| 3 | コンボ開始時のドライブゲージ残量 | ★必須 |
| 4 | コンボ開始時のSAゲージ残量 | ★必須 |
| 5〜14 | 始動位置 / 相手の状態 / ヒット種別 / 持続当て（始動技） / 相手の大きさ / 始動技(読取専用) / ドライブダメージ / SAゲージ消費 / ドライブゲージ消費 / 運び量 | 任意 |

**理由**

1. **必須 4 欄が先頭に連続し、任意が 1 つも混ざらない**（§2.3-3 の落とせない条件）。
2. **結果 2 欄**（ダメージ・有利フレーム）**を先、コンボ開始時の前提 2 欄を後ろ**に置き、種類ごとに固めた。★`drive → sa` の順は消費 2 欄と揃えてある。
3. **先頭＝ダメージを維持した。** `M24-12` / `D-577` の確定であり、`ComboEditorBasicFields.test.tsx` と `web/e2e/m24-12-editor-rebuild.spec.ts` が固定している。**理由の弱い並びのために既存の契約を壊さない。**
4. **★任意 10 欄の相対順は 1 つも変えていない。** ⇒ 状況 4 軸と持続当ての塊（重複判定キーの並び・`M37-07` が `:713-717` で隣接を明示的に選んだ）も、数字キーの割当も不変である。

**代償**（正直に書く）—— 「開始残量 2」と「消費 2」が離れた。⇒ 語の正典 `gaugeFieldLabelJa("start"|"consumed", …)` が両者を**語で**区別しており（`M16-06`）、位置に頼っていないため読み違いは起きない。

**★始動位置と運び量は `<Field>` の中に入れ子の `data-seq-stop` を持つ。入れ子ごと運んだ。**

### 3-6. ★失効した記述の是正（**射程ではないが同じ手番で直した**）

「撤回済み・失効した記述がコード上に残っている」はレビューの較正基準で **「高」** に置かれる型であり、**テストも lint も型検査も緑のまま通す**。⇒ 入れ替えで根拠が消えた記述を同じ手番で直した。

| 箇所 | 何が失効したか | 対応 |
|---|---|---|
| `ComboEditor.tsx`（新規の `GAUGE_CONSUMED_DEFAULT`） | 「この 2 欄は必須化の対象であり」 | **挙動は変えず根拠だけ是正。** 開発者の逐語「初期値として0をあらかじめ入れて置いて欲しい」は必須化と独立しており、そちらは生きている |
| `ComboEditor.tsx`（既存行の `GAUGE_CONSUMED_DEFAULT`） | 「必須化した 2 欄を空のまま開くと保存が止まるため」 | **挙動は射程外なので変えず、根拠を実態へ。** ⇒ 挙動の再検討は横断課題へ（§8） |
| `service.go` の materialize 注記 | 必須 4 欄の**列挙**（旧 4 欄の名前） | 列挙をやめ正典への参照に（写しを増やさない） |
| `optionButtons.test.ts` | 「ヒット種別 8 + 1 = 9 で余白 1」 | **8 へ。★8 でも 9 でも `shouldButtonizeOptions` は true を返すため、直さなくても緑のまま失効する型であった** |
| `m15-01-metadata-testid.spec.ts` | 「1 番目は中立の『不問』」 | ヒット種別をループ外へ出し、既定が `normal` であることを明示して見る形に。**2 番目を押すテストなので緑のまま嘘だけが残る型であった** |
| `editor-input.ts`（E2E ヘルパ） | 「ここで埋めるのは 2 欄だけでよい —— 消費ゲージは既定 0 が入るため」 | 4 欄すべてを埋める形へ |
| `ComboEditor.preSaveDuplicate.test.tsx` | 同上 | 同上 |

---

## 4. 変更したファイルと変更統計

`git diff --stat 7ce1393` ＝ **24 files changed, 1509 insertions(+), 179 deletions(-)**

```
 .../combo/materialize_required_fields_test.go      |  36 ++-
 internal/service/combo/service.go                  |   6 +-
 internal/service/combo/service_test.go             |  12 +-
 internal/service/comboio/csvcore/csvcore_test.go   |  24 +-
 internal/service/comboio/csvcore/validate.go       |  11 +-
 internal/service/validation/combo.go               |  37 ++-
 internal/service/validation/combo_test.go          |  68 +++-
 web/e2e/m15-01-metadata-testid.spec.ts             |  24 +-
 web/e2e/m38-01-required-and-unspecified.spec.ts    | 218 +++++++++++++
 web/e2e/support/editor-input.ts                    |  16 +-
 web/src/constants/combo-list.ts                    |  11 +
 web/src/constants/field-requirement.ts             |  17 +-
 .../ComboEditor.preSaveDuplicate.test.tsx          |  27 +-
 .../features/combo/components/ComboEditor.test.tsx |  22 +-
 web/src/features/combo/components/ComboEditor.tsx  |  89 +++++-
 .../components/ComboEditorBasicFields.test.tsx     | 351 +++++++++++++++++++--
 .../combo/components/ComboEditorBasicFields.tsx    | 278 ++++++++++++----
 web/src/features/combo/labels.ts                   |  32 ++
 web/src/features/combo/optionButtons.test.ts       |   8 +-
 web/src/features/combo/requiredPublished.test.ts   | 159 ++++++++++
 web/src/features/combo/requiredPublished.ts        | 104 ++++++
 web/src/features/combo/schema.test.ts              |  92 ++++--
 web/src/features/combo/schema.ts                   |  19 +-
 web/src/features/combo/useFieldSequence.ts         |  27 +-
 24 files changed, 1509 insertions(+), 179 deletions(-)
```

### ★新規ファイルが `+` だけか（教訓 `E-225` の観点で 1 度読んだ）

`git diff --numstat 7ce1393` の**実測**:

```
218	0	web/e2e/m38-01-required-and-unspecified.spec.ts
159	0	web/src/features/combo/requiredPublished.test.ts
104	0	web/src/features/combo/requiredPublished.ts
```

**⇒ 新規 3 本とも deletions が 0 である。上書きで消したファイルは無い。**
★作る前に `ls` / `find` で同名の有無を確かめてある（`web/e2e/` に `m38` は 0 件、`docs/progress/` に `M38-01` は 0 件）。

### ★列を 1 つも足していないこと（完了条件 6）

- `git diff 7ce1393 -- migrations/` ＝ **0 行**
- `git diff 7ce1393 | grep -cE "^\+.*ALTER TABLE|^\+.*ADD COLUMN"` ＝ **0 件**
- `git diff --stat 7ce1393 -- docs/` ＝ **0 行**（`docs/design/` 本体・`followup-backlog.md` とも差分 0＝チェックリスト E-3）

---

## 5. 検査（**出力はファイルへ全量落とし、`head` / `tail` で切っていない**）

| 検査 | 実測 |
|---|---|
| `go test ./...` | **`GO_EXIT=0`** ／ `grep -cE '^--- FAIL'` ＝ **0 件** |
| `cd web && pnpm test` | **`VITEST_EXIT=0`** ／ **235 files / 2987 tests passed** |
| `pnpm exec tsc --noEmit -p tsconfig.json` | **`TSC_EXIT=0`** |
| `make e2e`（全数） | **`E2E_EXIT=0`** ／ **362 passed（6.5m）**。★本サブの新規 spec は **11 本**（作り直しで 2 本増）。**★`m31-02-tag-field-drag.spec.ts:49` が 1 件 flaky**（retry で通過）——**本サブとは無関係である**: `git diff --stat 7ce1393 -- web/e2e/m31-02-tag-field-drag.spec.ts web/src/features/tag/` が **0 行**であり、同 spec は本セッションの全数 **4 回すべてで flaky 無し**で通っていた。マウスドラッグの文字選択という時間依存の形である |

**機械検査**

| 検査 | EXIT | 結果 |
|---|---|---|
| `check-artifact-integrity.sh`（★1 本目） | 0 | 違反なし |
| `check-stop-discipline.sh` | 0 | 違反なし |
| `check-doc-refs.sh` | 0 | dead reference なし |
| `check-enum-sync.sh` | 0 | ベースラインどおり（増加なし） |
| `check-import-order.sh` | 0 | **99 / ベースライン 99**（★一度 100 へ増えたので是正した。下記） |
| `check-browser-storage-keys.sh` | 0 | 違反なし |

> **★`check-import-order.sh` は一度赤になった。** 新規の `requiredPublished.test.ts` が `./requiredPublished → @/constants/field-requirement` の順で書かれており、`CLAUDE.md` §4 の「React → サードパーティ → `@/` → 相対」に反していた。⇒ 並べ替えてベースラインへ戻した。**★`tsc` もテストも E2E も何も言わない型である**（`M24-08` の `import-order-unchecked` と同型）。

### §5 の指示書テスト項目との対応

| # | 見るもの | 受け皿 |
|---|---|---|
| 1 | `VAL-C15` の 4 欄が入れ替わったこと（**外した 2 欄で空のまま保存できる ／ 入れ替えた 2 欄で空のまま保存できない**） | `schema.test.ts` ／ `requiredPublished.test.ts` ／ E2E `★★消費ゲージ 2 欄は空のままでも本登録できる` ＋ `★★★空のままでは保存できず、VAL-C15 が出る` |
| 2 | 「不問」を選んで保存すると NULL が入り、読み直すと placeholder に「不問」が出る | **E2E `★★★不問を選んで保存すると DB は NULL になり、再編集で不問が復元される`**（API で実値を確認） |
| 3 | 矢印キーで数値が変わらず、フォーカスが動く | **E2E `★★★数値欄で ↑↓ しても値が変わらず、フォーカスが動く`**（★jsdom は number の増減を実装しないため実ブラウザでしか確かめられない） |
| 4 | ヒット種別の選択肢に「不問」が無い ／ 既定が `normal` | `ComboEditorBasicFields.test.tsx` の `M38-01 ヒット種別の選択肢と既定` ／ E2E |
| 5 | 外した 2 欄の値域検査が生きている | **E2E `★★★外した 2 欄の UI クランプが生きている`**（25→20 / 9→6） |
| 6 | 全数 | 上表 |

---

## 6. ★★併せて更新が要るもの

| # | 項目 | 実測・対応 |
|---|---|---|
| **1** | **消費した CHANGE 番号を registry へ登録したか** | **★該当なし。⇒ 本サブは CHANGE を自採番していない**（`D-293`）。原稿は設計伝達レポートの §1 と §6 へ置く（計測点 `M-183`）。**採番は設計卓の手番**である |
| **2** | **その番号の写し先（実査で 4 か所）を直したか** | **★該当なし**（上と同じ理由。番号を消費していない） |
| **3** | **消費したマイグレ連番** | **★0 本。`000118` は未消費で返す。** `ls migrations/` の実測は `000117` が最新（`*.up.sql` 115 本）であり、ボード §2.1 の「次に払い出す番号 ＝ `000119`」ともずれていない |
| **4** | **版を上げた文書の参照元** | **★該当なし。** `docs/design/` 本体を 1 行も編集していない（`git diff --stat 7ce1393 -- docs/` ＝ 0 行）。版を上げた文書が無いため写し先も無い |

---

## 7. ★マイグレ `000118` を**未消費で返す**

**開発者裁定（2026-09-17）＝既存の `hit_type` が NULL の行を `normal` へ寄せるマイグレは作らない。**

製造からも同案に賛成した。根拠は 3 つある。

1. **寄せる先が正しいと言える根拠が無い。** `hit_type` の既定は `""`＝NULL であり、NULL 行は「通常ヒットだと判断された行」ではなく「**既定のまま保存された行**」である。`normal` へ寄せることは、誰も確かめていない内容上の主張をデータへ書き込むことになる。
2. **`hit_type` は重複判定キーの 1 つである**（`SUPP-001` §2.2）。NULL → `normal` は既存の `normal` 行と同じキーを作りうる（指示書 §4.2）。**その衝突を数える手段が無い**（実 DB が作業ツリーに無い）。⇒ 目隠しでマイグレを流すことになる。
3. **寄せない側の代償は小さく、先例がある。** 既存 NULL 行はそのまま残り §0.2 のとおり「不問」として見える。編集時に選択が消えて見える問題は `opponent_stance` が `stanceOptionsFor` で既に解いている —— **読み込んだ値が空のときだけ**中立の選択肢を出す形。本サブの `hitTypeOptionsFor` はその写しである。

**⇒ `000118` は未消費で返す。次に払い出す番号は `000118` のままである。**

### ★マイグレを作らないことの代償は **2 件**ある（**レビュー 中-2 で 1 件追加**）

#### 代償 1: `hit_type` が NULL の既存行を開いたときだけ「(未指定)」が残る

チェックリスト `D-1`「選択肢から『不問』が消えているか」は、**新規登録では満たすが、`hit_type` が NULL の既存行を開いたときだけ末尾に「(未指定)」が残る**。

- これは `opponent_stance` と**まったく同じ形**であり（`M24-04` 以前の NULL 行のための後方互換の選択肢）、意図的な例外である。
- **呼び名は「不問」ではなく「(未指定)」にしてある。** ⇒ 消したはずの語が戻ったように見えないため。

#### ★★★代償 2: 既存の NULL 行と新規の `normal` 行が重複判定で別物になる

**`DES-006` §2.3 は重複判定で「NULL 同士は一致」と定めている。** ⇒ `hit_type` が NULL の既存行と、本サブ以後に登録される `normal` の行は、**他の判定項目がすべて同じでも別キーになる**。

- **⇒ 見た目が同じコンボを重複登録できる状態が新たに生じた。**
- **★これは新規の既定を `""` から `normal` へ変えたことの直接の帰結である。** 寄せるマイグレを作れば消えるが、§7 の 3 点（とくに衝突を数える手段が無いこと）により作らない判断をした。
- **★着手前も同じ穴は在った** —— 既定が NULL だったため「NULL 同士は一致」で畳まれており、**表に出ていなかっただけ**である。⇒ 本サブは穴を作ったのではなく、**既定を変えたことで境界の位置を動かした**。
- 実 DB での件数は測っていない（測る手段が無い）。**⇒ 開発者が実 DB を見られる手番で確かめる価値がある。**

---

## 8. ★横断課題（他サブ・設計卓へ波及するもの）

**★いずれも本サブの射程外であり、手を出していない。** 設計伝達レポート §4 へ回す。

| # | 事項 | 実測 |
|---|---|---|
| **1** | **相手の大きさにも未文書の「不問」がある** | `withUnspecifiedFirst` は **3 軸**に掛かっていた ＝ 始動位置（**正規**＝`CHANGE-200` が NULL を「不問」と読む先例を確立）／ ヒット種別（本サブで外した）／ **相手の大きさ**。★後者は `SUPP-001` §3.2 の値域 4 値に「不問」が無く、**ヒット種別とまったく同じ形**である。★`opponent_size` も重複判定キーの 1 つである。**⇒ 2026-09-17 開発者裁定＝「報告のみ。触らない」**（理由の逐語＝「ヒット種別は必ずいずれかの状態を持つが、他は不問でも成立する、むしろ不問がないと不便」） |
| **2** | **`DES-005` §5.7 のボタン数が実装より 1 少なかった** | 同節は「ヒット種別（8）」と書くが、着手前の実装は `withUnspecifiedFirst` により **9 個**であった（`optionButtons.test.ts` は正しく `8 + 1` と書いていた）。**⇒ 本サブで実装が 8 になり、記述と一致した。** ★ただし始動位置（「不問込みで 8」）と相手の大きさ（「4」だが実装は 5）の非対称は残る |
| **3** | **`DES-006` §2.1 の `VAL-C15` 行が実態とずれる** | 本サブで 4 欄の中身が入れ替わり、**新 2 欄はサーバでは強制できない**（不問と空を payload で区別できないため）。⇒ CHANGE 原稿で明記する |
| **4** | **`DES-006` §2.1 の `VAL-C13` 注記が実装と食い違う**（**本サブ以前からの乖離**） | 同行は「`PATCH` の単純更新では非実行」と書くが、`ValidateMetadataRanges` が PATCH で `validateC13DriveDamageRange` を呼んでいる。**★本サブで作り込んだものではない。** 射程外だが実査で見つけたので申し送る |
| **5** | **既存行の消費ゲージ NULL を `"0"` へ寄せる挙動の根拠が失効した** | `ComboEditor.tsx` は NULL の既存行を開くと消費 2 欄へ `"0"` を入れ、**開いて保存すると「消費 0」が書き込まれる**。その理由は「必須化した 2 欄を空のまま開くと保存が止まるため」であり、**必須から外れた本サブで根拠が消えた**。★挙動は変えていない（射程 5 件に無く、戻すと既存の運用が変わる）。**⇒ 残すか戻すかは開発者の判断である** |
| **6** | **`SetplaySuggestionSection.tsx` の数値 4 欄だけスピナーが残っている** | `NO_SPINNER` が当たっていない唯一の箇所（素の `<input type="number">`）。**コンボエディタ外なので射程外**だが、M24-12 の「同じ画面でスピナーの有無がまだらにならないように揃える」という判断の外側に居る |
| **7** | **詳細・比較画面は同じ NULL を「-」と表示する** | エディタだけ「不問」になり、**同じ NULL が画面で 2 つの呼び名を持つ**。`opponent-stance-vocabulary-split` と同型の芽である。★指示書の射程は登録・編集画面のみなので直していない |
| **8** | **`DES-005` §5.7 の入力項目の列挙が失効した**（**レビュー 中-3**） | 射程 2 の並び替えで**欄の並びが変わった**ため、同節の「表示項目（上から順）」の 8.〜13. あたりの列挙が実態とずれる。★同節の「正典は `REQUIRED_PUBLISHED_COMBO_FIELDS`。サーバ側の `requiredPublishedFields` と対であり、片側だけ足すと画面は通るのに保存で落ちる」も、**新 2 欄については成り立たない**（サーバ側が咎めないため）。⇒ CHANGE 原稿の対象に加えた |
| **9** | **矢印キーの抑止は `useFieldSequence` を張った面の中だけである**（**レビュー 中-4**） | ★スピナー（`NO_SPINNER`）はコンボエディタの `type="number"` 全欄へ配ってあるが、**矢印の抑止は基本情報タブの中だけ**である。⇒ レシピタブ・セットプレイ・プリセット等の数値欄は従来どおり矢印で増減する。**射程の線引きとしては妥当だが、書いておかないと「全欄で止めた」と誤読される。** ⇒ `numericInput.ts` の docstring へ明記済み |

---

## 9. レビュー結果と取り込み（**Phase C 実施後の実測**）

| 項目 | 実測 |
|---|---|
| レビュー報告書 | `docs/progress/m38-01-review.md`（Phase B の fresh subagent が作成） |
| 指摘の件数 | **15 件** ＝ **高 4 ／ 中 7 ／ 低 4** |
| 採否 | **採用 15 件 ／ 不採用 0 件** |
| **★「高」指摘の不採用** | **0 件。⇒ 開発者へのエスカレーションは発生していない** |
| 再レビューの往復 | **0 回**（`CLAUDE.md` §9 の上限 2 回に対して）。⇒ **停止規律の記録が要る未解消項目は無い** |

**各指摘の採否と理由は、レビュー報告書末尾の「## 取り込み結果（自動トリアージ）」に全件ある**（事後監査のため同じ内容を報告書側へも残してある）。

### 取り込みで直した主なもの

| 優先度 | 何を直したか |
|---|---|
| **高-1** | `numericInput.ts` の `NO_SPINNER` docstring が「**矢印キーでの増減は残る**(実測で確認)」のままだった。★射程 1 で反転した挙動を**本番コードが正反対に記述している**状態であり、次に数値欄をいじる人が必ず読む場所に在った |
| **高-2** | 「必須 4 欄 ＝ 消費ゲージを含む」と読める注記が **19 か所 ＋ 診断メッセージ 1 件**残っていた（完了報告 §3-6 は 7 件しか直していなかった）。**★全数を直した** —— 「先に 3 件だけ」という逃げ道は採らなかった。後任は fixture をコピーするため、1 つでも残ると前提が複製される |
| **高-3** | `LEGACY_UNSPECIFIED_LABEL` と `withUnspecifiedFirst` の docstring が「相手の状態」限定のままだった。**★後者に通す欄／通さない欄の表を置いた** —— 無いと「状況 4 軸へ一律に足す」判断が復活しうる |
| **高-4** | `progress-log.md` の索引行（Phase D で追記し、`check-progress-log-index.sh` を緑へ） |
| 中 7 件 | 契約上の帰結の明記（中-1）／ `VAL-C02` の代償の記録（中-2・§7 へ）／ `DES-005` §5.7 の失効（中-3・§8 へ）／ 矢印の適用範囲（中-4）／ `aria-label` から testid を外す（中-5）／ `D-724` 実測注記の射程（中-6）／ E2E 共有ヘルパの冪等化（中-7） |
| 低 4 件 | 計算プロパティ名を型で守る対応表へ（低-1）／ 不要な再エクスポート削除（低-2・**レビュー着地前に独立に対応済み**）／ 未使用引数の意図を明記（低-3）／ `OptionButtonGroup` の testid 変換を明記（低-4） |

### ★取り込み後に全数を回し直した（**出力はファイルへ全量**）

| 検査 | 実測 |
|---|---|
| `go test ./...` | **`GO_EXIT=0`** ／ `grep -cE '^--- FAIL'` ＝ **0 件** |
| `cd web && pnpm test` | **`VITEST_EXIT=0`** ／ **235 files / 2987 tests passed** |
| `pnpm exec tsc --noEmit` | **`TSC_EXIT=0`** |
| `make e2e`（全数） | **`E2E_EXIT=0`** ／ **361 passed** |
| 機械検査 6 本 | すべて EXIT=0（`check-artifact-integrity` を 1 本目に回した） |

> **★レビュー側は `make e2e` を実行できなかった**（ポート 47390 を使う E2E スタックが別プロセスで稼働中だった）。⇒ **製造側で取り込み後に回し直して緑を得ている。**

---

## 10. ★★★追補2 — 開始残量の必須を外し「空欄＝不問」にした（2026-09-18・**開発者裁定**）

### 10-1. なぜ変えたか

**開発者の逐語** ＝「不問は設定できました。この使い勝手でもいいですが、**空欄とNULLの状態がわかりにくく感じます**。以下の実現可否は検討してください。**コンボ開始時のドライブ・SAゲージの必須を外す。NULLだった場合はBEの方で不問扱いにする。**」

**★違和感の正体は状態数の不一致である**（製造の分析）。

| | 追補1 まで | 追補2 後 |
|---|---|---|
| UI の状態 | **3 つ**（数値 / 不問トグル ON / 空のまま） | **2 つ**（数値 / 空） |
| DB の状態 | 2 つ（値 / NULL） | 2 つ（値 / NULL） |
| 空のまま | **保存できない**（門が止める） | **NULL ＝ 不問として保存される** |

**⇒ 余った 1 状態（空のまま）が「不問」と見た目でほぼ区別できなかった**（placeholder の有無だけ）。⇒ 数を揃えれば違和感は消える。

**★製造から踏み込んで提案した点**（提案に書かれていないが必然的に出るもの）—— **空欄＝不問にすると「不問」トグルの仕事が無くなる**。⇒ トグルを消して初めて問題が完全に解け、かわりに **placeholder「不問」を空のとき常に**出す。

### 10-2. ★★★製造が指摘した問題 4 件と、開発者の裁定

| # | 指摘 | 裁定（2026-09-18） |
|---|---|---|
| **1** | **「意識的に不問 / 面倒で未入力」の区別が永久に消える。** 2026-09-17 の逐語＝「意識的に入れなかったのか、単に面倒で入れなかったのかを**明らかにしたい**」に対し、**本変更はその目的を達成しない**。★残すには列が要る（`oki_verified` / `migrations/000096` と同じ形） | **★諦める。提案どおり進める**（列は足さない） |
| **2** | **「上にあるものが必須」の手掛かりが壊れる。** 先頭 4 欄のうち 3・4 番目が任意になり、指示書 §2.3-3 の**落とせない条件**「必須でないものを上へ混ぜない」が破れる | **★位置は維持する。** ⇒ 手掛かりは節の凡例だけが担う |
| **3** | **`VAL-C15` が 4 欄 → 2 欄になる。指示書・設計書に反する**（§10-3） | **★開発者裁定で上書き** |
| **4** | **誰も確かめていないコンボが「不問」を主張する。** ★ただし `position` の `start_position_mass IS NULL ⇔ 不問`（`CHANGE-200` / `M37-05`）と同じ形であり、本プロジェクトは既にこれを受け入れている | 承知のうえで通す |

### 10-3. ★★★指示書との衝突（**設計卓の裁定が要る**）

指示書は `VAL-C15` の欄数変更を**明示的に禁じている**（逐語・実測）。

| 箇所 | 逐語 |
|---|---|
| §2.4.1 | 「**★★4 欄のままである。⇒ 中身が入れ替わるだけである。★「4 欄」という数を動かさない。**」 |
| §3-2（やらないこと） | 「`VAL-C15` の欄数を変えること」 |
| §6-3（完了条件） | 「`VAL-C15` が 4 欄のままで、中身が入れ替わっている」 |
| チェックリスト §0-3（不合格） | 「`VAL-C15` の欄数が 4 でなくなっている」 |
| チェックリスト B-1 | 「`VAL-C15` が 4 欄のままか」 |

**⇒ 本変更は `VAL-C15` を 4 欄 → 2 欄にする。指示書に正面から反する。**

**★これは「契約違反の独自判断」ではなく「開発者裁定による指示書の上書き」である**（`CLAUDE.md` §9 ハード列＝ユーザー体験に影響する判断は開発者）。**⇒ 設計伝達レポート §2 に新規エントリとして明記した。設計卓は `DES-006` §2.1 の `VAL-C15` を 2 欄へ改める CHANGE を要する。**

### 10-4. やったこと

| # | 対象 | 変更 |
|---|---|---|
| 1 | `web/src/constants/field-requirement.ts` | `REQUIRED_PUBLISHED_COMBO_FIELDS` → `["damage", "knockdownAdvantage"]` |
| 2 | `internal/service/validation/combo.go` | `requiredPublishedFields` → 2 エントリ。★「present は常に真」という**器を保つための 2 行が役目を終えた**ので畳んだ |
| 3 | `internal/service/comboio/csvcore/validate.go` | `requiredPublishedCSVFields` → 2 エントリ。同上 |
| 4 | `web/src/features/combo/requiredPublished.ts` ＋ `.test.ts` | **削除**（門そのものが不要） |
| 5 | `ComboEditor.tsx` | 門の合流を外し、**zod だけの早期 return へ戻した**。`*Any` の初期化 2 か所も削除 |
| 6 | `ComboEditorBasicFields.tsx` | `GaugeAtStartInput` を**素の `<Input>` へ**。`*Any` / `GaugeAtStartField` / `GAUGE_ANY_KEY` / `setGaugeValue` / `setGaugeAny` / Space ハンドラ / `Switch` を削除 |
| 7 | `labels.ts` | `UNSPECIFIED_SHORTCUT_KEY` を削除 |
| 8 | placeholder | **`value === "" ? UNSPECIFIED_LABEL : undefined`** ＝ **空なら常に「不問」** |
| 9 | 必須の印 | 開始残量 2 欄の `<Field>` から `requirement` / `topic` を落とした |

**★`web/src/features/combo/schema.ts` は `required()` の変更が 1 行も要らなかった**（開始残量に元から掛けていない）。**★値域 `optFloat(0,6)` / `optInt(0,3)` は残した。★BE の `VAL-C04` / `VAL-C05` も不変**（NULL はスキップする）。

### 10-5. ★画面項目の整理（同じ手番の追加指示）

**開発者の逐語** ＝「ついでに画面項目を見ていて違和感があったので修正して欲しい。**運び量は相手の大きさの下へ移動。始動技は削除**（レシピの方で見れるのでわざわざ基本情報タブで見る必要がない）。」

| # | やったこと | 波及 |
|---|---|---|
| 1 | **運び量を「相手の大きさ」の直下へ移動**（入れ子の `data-seq-stop` ごと） | ⇒ 始動位置・相手の状態・ヒット種別・持続当て・相手の大きさ・**運び量**と、状況の塊が連続する |
| 2 | **始動技の読み取り専用表示を削除** | ⇒ `ComboEditorBasicFields` の `moves` / `autoStarterMoveId` の **2 prop** と `labelOfMove` が**未使用になったので削除**（テストの呼び出し **23 か所**から prop を落とした） |

**★★★保存される値は 1 バイトも変わらない** —— `autoStarterMoveId` の算出そのもの（`effectiveStarterMoveId`）は `ComboEditor.tsx` に残っており、**重複判定キーの `starter_move_id` を作り続ける**。消えたのは表示だけである。

**★失効させた記述**: 運び量の「**置き場も状況（＝重複判定キー）から離してある。⇒ 運び量はキーではなく計測値である**」。⇒ **理屈は今も正しいが、離して置く手掛かりとしては働いていなかった**（開発者が画面を見て違和感を申告した）。**★運び量が重複判定キーでないことは 1 ビットも変わっていない**（キーの正典は `SUPP-001` §3.2）。

#### 着手後の停止点の並び（**16 → 15**）

```
0 ダメージ / 1 有利フレーム / 2 開始ドライブ / 3 開始SA
4 始動位置(入力方式) / 5 始動位置(値) / 6 相手の状態 / 7 ヒット種別
8 持続当て / 9 相手の大きさ / 10 運び量(入力方式) / 11 運び量(値)
12 ドライブダメージ / 13 SA消費 / 14 ドライブ消費
```

**★index を直書きしている既存テストは、いずれも指すものが変わらなかった**（`stops[3]/[4]`・`stops[4]/[5]`・`stops[6]→[5]` はすべて 9 番以前に在り、上の 2 つはどちらも 10 番以降でしか動かない）。**⇒ 直したのは並び表のコメントだけである。**

**★副産物**: 始動技は **focusable を持たない停止点**だった（`stopsOf` が filter で落としていた）。⇒ 消えたことで raw の `data-seq-stop` 列と実際の停止点の列が一致し、読みやすくなった。

### 10-6. ★失効させた契約（テストの反転・**元に戻さないこと**）

| 対象 | 何を反転したか |
|---|---|
| `ComboEditorBasicFields.test.tsx` の `M38-01 開始残量の「不問」` | トグル／Space／停止点の主張を**すべて削除**し、「**空なら placeholder『不問』／値があれば出ない**」「**トグルは存在しない**」へ |
| 同 `必須項目が基本情報の上にまとまっている` | 必須の印は**先頭 2 欄**。★「4 つ連続」→「**2 つ連続**」 |
| 同 `必須の印の入れ替え` → `必須の印は 2 欄だけ` | 開始残量 2 欄にも**印が出ない**ことへ反転 |
| 同 `全項目温存` | `getByText("始動技")` → **`queryByText("始動技")` が null** へ |
| `schema.test.ts` | 主張は不変・**理由が変わった**（「門が別に在るから」→「そもそも必須ではないから」） |
| `internal/service/validation/combo_test.go` の `TestC15_StartGauges_NilIsNotError` | 主張は不変・理由が変わった。★`present()` を `!= nil` へ戻す破壊確認は**役目を終えた**（そもそも項目が無い） |
| E2E `m38-01-required-and-unspecified.spec.ts` | 「空のままでは保存できず VAL-C15 が出る」→「**必須 2 欄が空だと止まり、開始残量は咎められない**」。キーボード経路から Space の段を落とし、**「不問トグルは存在しない」** を足した |
| E2E `m27-02b-required-and-oki-states.spec.ts` | `field-requirement-driveAvailableAtStart` の可視アサートを**反転**（4 欄すべて → **2 欄**） |
| `web/e2e/support/editor-input.ts` | `fillRequiredComboFields` を **damage / knockdown-advantage の 2 欄だけ**へ戻し、`setUnspecified` ヘルパを削除。**★開始残量を空のまま残すこと自体が、必須から外れたことの実証になっている** |

### 10-7. ★射程外（触らない・報告する）

**詳細・比較・一覧の `"-"` 表示は変えていない。**

- `formatDriveGauge` / `formatSAGauge`（`web/src/features/combo/utils.ts:169-177`）は NULL を `"-"` と返すが、**同じ関数を消費ゲージとも共用している**（`driveGaugeConsumed` / `saGaugeConsumed`）。⇒ **そちらの NULL は「不問」ではなく未入力である。**
- **★formatter を変えると意味が混ざる。** 分けるなら開始残量専用のフォーマッタが要り、本変更の射程を超える。
- **⇒ レビューが挙げた横断課題 7（同じ NULL が画面で 2 つの呼び名を持つ）として残し、設計伝達レポートへ再掲した。**

### 10-8. 検査（**出力はファイルへ全量落とし、`head` / `tail` で切っていない**）

| 検査 | 実測 |
|---|---|
| `go test ./...` | **`EXIT=0`** ／ `grep -cE '^--- FAIL'` ＝ **0 件** |
| `cd web && pnpm test` | **`EXIT=0`** ／ **234 files / 2971 tests passed**（★門のテスト 1 本が消えたぶん減っている） |
| `pnpm exec tsc --noEmit -p tsconfig.json` | **`EXIT=0`** |
| `make e2e`（全数） | **`EXIT=0`** ／ **364 passed（7.8m）・失敗 0・flaky 0**。★本サブの spec は **12 本**（追補2 で 1 本増）。★前回の全数で 1 件出ていた `m31-02-tag-field-drag.spec.ts` の flaky も今回は出ていない |

**機械検査**（`check-artifact-integrity.sh` を 1 本目に回した）

| 検査 | EXIT | 結果 |
|---|---|---|
| `check-artifact-integrity.sh`（★1 本目） | 0 | 違反なし |
| `check-stop-discipline.sh` | 0 | 違反なし |
| `check-doc-refs.sh` | 0 | dead reference なし |
| `check-enum-sync.sh` | 0 | ベースラインどおり（増加なし） |
| `check-import-order.sh` | 0 | **99 / ベースライン 99** |
| `check-browser-storage-keys.sh` | 0 | 違反なし |
| `check-md-emphasis.sh <この手番の報告 2 本>` | 0 | **★一度 1 行検出したので是正した**（`**「…」**を` の形） |
| `check-progress-log-index.sh`（★報告を書いた後に回し直し・`D-890`） | 0 | 違反なし |
| `check-completion-report-md-emphasis.sh`（同上） | 0 | 違反なし |
| `check-doc-inventory.sh`（同上） | 0 | 型に無いファイルなし |

### ★列を 1 つも足していないこと（追補2 でも不変）

- `git diff --cached 7ce1393 -- migrations/` ＝ **0 行**
- `git diff --cached 7ce1393 | grep -cE "^\+.*ALTER TABLE|^\+.*ADD COLUMN"` ＝ **3 件。★すべて本報告の文面そのもの**であり、SQL ではない（実測で 1 件ずつ確認した）
- `git diff --cached --stat 7ce1393 -- docs/design/ docs/handover/followup-backlog.md` ＝ **0 行**（`CLAUDE.md` §8 ／ `D-838`）

### ★消したファイル（**意図した削除である**）

```
0	159	web/src/features/combo/requiredPublished.test.ts
0	106	web/src/features/combo/requiredPublished.ts
```

**⇒ 門そのものが不要になったため。★`labels.ts` も差分が `0 15`（純削除）＝ `UNSPECIFIED_SHORTCUT_KEY` の 1 定数ぶんである。**

### 追補2 の変更統計

`git diff --stat`（追補1 の着地 `2531ca1` から）＝ **40 files changed, 815 insertions(+), 1180 deletions(-)**

**★★削除が挿入を上回っている。** ⇒ 本変更は**ほぼ削除**である（状態を 1 つ畳んだ結果として、それを支えていた部品・門・テストがまとめて不要になった）。

---

*以上、M38-01 完了報告（追補2 まで）。*
