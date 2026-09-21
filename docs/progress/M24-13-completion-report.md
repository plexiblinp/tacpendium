# M24-13 完了報告: 仮登録もレシピのステップ 1 本以上を要する

| 項目 | 内容 |
|------|------|
| 作業ID | **M24-13** |
| 指示書 | `docs/instructions/M24-13-draft-requires-recipe-step.md` **v1.1.0**（着手は v1.0.0。**2026-08-29 に `D-588` で射程が 1 件広がった**＝§4.6 `VAL-S04`） |
| チェックリスト | `docs/instructions/reviews/M24-13-review-checklist.md` **v1.1.0** |
| CHANGE | **`CHANGE-139` v1.1.0**（**設計卓が起票済み。製造は番号を消費していない**） |
| 着手基点 | `11bcb6a`（`M24-12` マージ済み） |
| ブランチ | `claude/m24-13-implementation-dal6rs` |
| 実施日 | 2026-08-29 |

> **★★本サブは 2 本立てである。同じ層だが目的が違う。**
> **`VAL-C09`＝「適用範囲を広げる」** ／ **`VAL-S04`＝「判定の位置を移す」。**

---

## 1. 結果の要約

| 項目 | 着手前（基準値） | 完了後 | 差 |
|---|---|---|---|
| `go test ./... -count=1` | **55 パッケージ ok / FAIL 0** | **55 パッケージ ok / FAIL 0** | ±0 |
| `pnpm exec vitest run` | **198 files / 2156 tests passed** | **198 files / 2166 tests passed** | **+10** |
| `make e2e` | **208 passed / 0 failed（4.3m）** | **215 passed / 0 failed（4.5m）** | **+7** |
| マイグレーション消費 | — | **0 本** | — |
| 新規依存 | — | **0 件** | — |
| ブラウザストレージの新キー | — | **0 件** | — |

**★基準値は変更を入れる前に、同一セッション内で背中合わせに採った**（playbook §4.37）。**採取コマンドにパイプでの切り詰めを入れていない。**

**★本節の統計は「2 回のレビュー取り込みを終えた as-built」で採り直したものである**〔レビュー 2 回目 低-B。**初版は 1 回目のレビュー前の値のままで、取り込みで deletions が 121 → 116 へ**減っていた（`m24-04` の import を復元したため）——**古いのではなく、両方向にずれていた**〕。

```
$ git diff --stat --cached 11bcb6a | tail -1
 57 files changed, 2671 insertions(+), 126 deletions(-)
```

**★新規ファイル 9 件はすべて `+` のみ**（教訓 `E-225`。**deletions のある新規ファイルはそれ自体が矛盾している**）:

```
$ for f in $(git diff --cached --name-only --diff-filter=A 11bcb6a); do git diff --cached --numstat 11bcb6a -- "$f"; done
434	0	docs/progress/M24-13-completion-report.md
100	0	docs/progress/M24-13-mock/m24-13-save-blocked.html
275	0	docs/progress/m24-13-review-2.md
265	0	docs/progress/m24-13-review.md
48	0	internal/service/setup/deps_adapter.go
43	0	internal/service/setup/txscope_internal_test.go
185	0	internal/service/setup/val_s04_race_test.go
214	0	web/e2e/m24-13-draft-requires-recipe.spec.ts
32	0	web/e2e/support/draft-combo.ts
```

---

## 2. §3.3 着手前の実査 11 件（**すべて実施。母数はその場で数え直したコマンドを併記する**）

### 2.1 実査 1: `VAL-C09` の実装位置と呼出元（**母数付き**）

```
$ grep -rn "validateC09RecipeNotEmpty\|CodeC09RecipeNotEmpty" internal/ --include=*.go | grep -v _test.go
internal/service/validation/combo.go:26:	CodeC09RecipeNotEmpty      = "VAL-C09"
internal/service/validation/combo.go:143:	validateC09RecipeNotEmpty(&r, steps)
internal/service/validation/combo.go:327:func validateC09RecipeNotEmpty(r *ValidationResult, steps []model.ComboStep) {
internal/service/validation/combo.go:329:		r.AddError(CodeC09RecipeNotEmpty, "steps",
```

- **判定の実装は `validateC09RecipeNotEmpty`（unexported）1 本。呼出元も 1 か所**（`ValidateComboForCreate` 内）。**⇒ そのガードを外すだけで済んだ。新しい判定は書いていない。**
- **★ただし `VAL-C09` の実装は本体の外にもう 1 本ある**——`internal/service/comboio/csvcore/validate.go:160`（**文字列リテラル `"VAL-C09"`・severity は WARNING・定数を共有していない**）。**⇒ 実装は合計 2 本、ゲートは 1 本である。**

### 2.2 実査 2: 仮登録の緩和の形と適用経路（**全数**）

- **形は「分岐」である**（別関数ではない）。`ValidateComboForCreate` の `if !isDraft` は**着手前 2 か所だけ**＝`VAL-C02` と `VAL-C09`。**他（C03 / C04 / C05）の `isDraft` 引数は不活性**（**★形は 2 種類ある**——`validateC03StarterMatchesStep1` と `validateC05SARange` は `_ = isDraft`、**`validateC04DriveRange` は中身がコメントだけの `if !isDraft { }` 空ブロック**である〔`combo.go:239-242`〕。**★`grep "_ = isDraft"` で数えると 1 件足りない**）であり、`DES-006` §2.2 の `VAL-D03` 注記（「独立した実装関数・定数を持たない」）どおりだった。**⇒ 完了後は `VAL-C02` の 1 か所だけが残る。**

**★以下は `grep` の出力に注釈（`...` と `#`）を足した転記である。逐語の出力ではない**〔レビュー 2 回目 低-C〕。実際の行は `result := validation.ValidateComboForCreate(ctx, combo, steps, input.IsDraft, hash, s.txScopedDeps(tx))` の形をしている。**★母数（3 か所）は打てば同じものが出る。**

```
$ grep -rn "ValidateComboForCreate(" internal/ --include=*.go | grep -v _test.go
internal/service/combo/service.go:342   → 第 4 引数 input.IsDraft   # POST /api/combos
internal/service/combo/service.go:638   → 第 4 引数 false（直値）   # PATCH の仮登録→本登録昇格
internal/service/combo/service.go:758   → 第 4 引数 input.IsDraft   # PUT /api/combos/{id}
```

- **非テスト呼出元は 3 か所。★入口は 4 本である**（CSV 取込の commit が `comboSvc.Create` を通るため）。

### 2.3 実査 3: CSV 取込は適用面に入るか → **入る**

`internal/service/comboio/import.go:224` が `s.comboSvc.Create` を呼び、同 `:378` で `IsDraft` をそのまま渡している。**⇒ 仮登録・0 ステップの CSV 行は commit で「検証エラー」になる**（`import.go:230-233`）。**★落ちる形と対処は §5 に記す。**

### 2.4 ★★実査 4: 既存データにステップ 0 本の仮登録が何件在るか（**母数付き**）

**★本セッションのコンテナに DB ファイルは無く、実データは開発者のローカル DB にしかない。⇒ 開発者に照会 SQL を実行してもらった**（2026-08-29）。

| 項目 | 結果 |
|---|---|
| A. 仮登録の総数 | **0** |
| B. 仮登録かつ `step_count = 0` | **0** |
| C. 仮登録かつ `combo_steps` が 0 行（実体） | **0** |
| D. うち生存行（ゴミ箱を除く） | **0** |
| E. 該当 id 一覧（生存行） | **なし（NULL）** |
| F. コンボ総数（**母数**） | **86** |

**⇒ 0 件だった。既存データへの影響は無く、開発者の手番は発生しない。**
**★`step_count`（キャッシュ列）と `combo_steps`（実体）の両方で数えており、両者のズレも無かった。**

### 2.5 実査 5: 仮登録を作っている E2E の全数（**母数付き**）

**★指示書の見込みではなく、着手時にこのセッションで数え直した**（`M24-12` 教訓 20 / playbook §4.40）。

| 区分 | 件数 |
|---|---:|
| API `isDraft: true` のサイト（コメント行を除く） | **38** |
| — うち **ステップ 0 本**（`steps` キー無し 14 ＋ `steps: []` 5） | **19** |
| — うち ステップ 1 本以上（無傷） | **19** |
| UI（仮登録トグルを click）のサイト | **14** |
| — うち **ステップ 0 本** | **13** |
| — うち ステップ 1 本以上（`m12-06-draft-promotion`＝2 ステップ・無傷） | **1** |
| **★修正が要ったゼロステップ仮登録の作成サイト** | **32** |
| **★その spec ファイル数** | **26** |

**★`combo-editor-draft-checkbox` の grep は 16 件当たるが、うち 2 件は `m24-12` のアサーションであって作成ではない。** **⇒ 「ヒット数」と「作成サイト数」を同一視しないこと。**

### 2.6 実査 6: 保存ボタンの位置と順送りでの扱い

- 位置＝`ComboEditor.tsx` の**両タブパネルの外**、`ValidationDisplay` の直後の flex 行。着手前の `disabled` は `isMutating`（送信中／ゴミ箱ダイアログ中）のみで、**内容による無効化は 0 件**だった。
- **`disabled` なボタンはフォーカスを受けない。⇒ 理由をボタン自身の説明にすると、キーボードだけでは読めない。** 対処は §4.3 に記す。

### 2.7 実査 7: セットプレイ側に仮登録相当が在るか → **無い**

`model.Setup` に `IsDraft` フィールドは無く、`is_draft` 列は全マイグレーションを走査しても `combos` にしか存在しない。`VAL-S02`（レシピが空でないか）は `setup/validate.go` にインラインで 2 本あり、**ERROR・無条件**である。**⇒ 本サブでは何も直していない**（指示書 §1.6-8）。

### 2.8 実査 8: FE 側にレシピ空の検証が在るか → **在る。本登録だけに掛かっていた**

`web/src/features/combo/schema.ts` の `comboFormSchemaPublished` が `steps.min(1)` を持ち、`comboFormSchemaDraft` は持っていなかった。**⇒ §4.4 の「掛かる範囲を広げる」を採れた**（新しい検証を並べて書いていない）。

### 2.9 ★★実査 9: `VAL-S04` の判定はどこに在るか。tx の外に在るのはどの経路か（**母数を数え直した**）

**★followup は「3 経路」と書いている。数え直した結果、答えは「見る単位によって 3 と 4 に分かれる」であった。**

**★以下も注釈を足した転記である**（`#` 以降は製造が付けた説明）。

```
$ grep -rn "ValidateSetupCreate(\|ValidateSetupUpdate(" internal/ --include=*.go | grep -v _test.go | grep -v validate.go
internal/service/setup/service.go:246   # CreateSetup
internal/service/setup/service.go:321   # CreateSetupInTx
internal/service/setup/service.go:494   # UpdateSetup
```

```
$ grep -rn "\.CreateSetup(\|\.CreateSetupInTx(\|\.UpdateSetup(" internal/ --include=*.go | grep -v _test.go | grep -v "s.repo.UpdateSetup"
internal/api/setup/handler.go:46      # POST  /api/combos/{comboId}/setups
internal/api/setup/handler.go:208     # PATCH /api/setups/{id}
internal/service/comboio/import.go:274  # CSV 取込
internal/service/combo/service.go:384   # POST /api/combos（同梱セットプレイ）
```

| 数える単位 | 母数 |
|---|---:|
| **判定関数の呼出元** | **3** |
| **★入口（API ＋ CSV 取込）** | **4** |

**★★着手前の状態は 3 か所とも塞がっていなかった**。ただし、**塞がっていない理由は 2 種類あった**:

| 呼出元 | 着手前の形 |
|---|---|
| `CreateSetup`（`:210`） | **判定が `BeginTx` の前に在った**（tx の外） |
| `UpdateSetup`（`:447`） | 同上 |
| **`CreateSetupInTx`（`:288`）** | **★tx は元から在ったが、判定は `s.validDeps`（`*sql.DB` 直読み）を使っていた**——**形式的には内側だが、同じ tx が今まさに書いた行が見えていなかった**（`D-360`） |

**★★3 番目が実害を出していたことをテストが捉えた**（§5.2）。

### 2.10 ★★実査 10: 判定 SQL が `*sql.DB` を直読みしていないか

**着手前＝していた。** `repository.FindDuplicateInCombo` は `r.db.QueryContext` 固定であり、**候補の steps を引く `FindStepsBySetupID` も `r.db` 固定**だった。**⇒ tx を束ねる口が無く、内側へ移しても意味が無い状態だった。** 対処は §4.6 に記す。

### 2.11 実査 11: `BEGIN IMMEDIATE` はセットプレイの書き込み経路にも効いているか → **効いている**

`internal/infra/db/db.go:78` の `dsnTxLockParam = "_txlock=immediate"` は **DSN に載っており、`*sql.DB` から開くすべての書き込み tx に効く**（`M24-11` が「書き込みヘルパ 1 本ではなく DSN」を選んだのはこのため）。セットプレイ側の `s.db.BeginTx(ctx, nil)` も同じ `*sql.DB` から開くため対象である。**★E2E / Go テストの DB も `db.Open` を通る**（`internal/testutil/dbtest/dbtest.go:36`）**ため、本番と同じ条件で観測できている。** **⇒ 残っていたのは「判定を内側へ移す」側だけであった**（見込みどおり。設計卓への報告事項なし）。

---

## 3. 実装 ①：`VAL-C09` を仮登録でも適用する

### 3.1 バックエンド

`internal/service/validation/combo.go`——**`if !isDraft {` ガードを外し、既存の `validateC09RecipeNotEmpty` を無条件呼び出しにした。**

- **★関数本体・定数・severity・メッセージは 1 文字も触っていない。**（＝**既存の 1 本を呼ぶ**。`DES-006` §2.1 の規約「同じ 1 本を呼ぶ。条件で書くと 2 本目が書き起こされて静かにずれる」）
- **★新しい `VAL-D04` は作っていない**（指示書 §1.6-6）。
- **★`VAL-D02` / `VAL-D01` / `VAL-D03` には触れていない。**
- あわせて**失効したコメント 2 か所を as-built へ直した**（`:115` の「VAL-C09: スキップ(空レシピを許容)」／ `:326` の関数 doc）。**★撤回済みの記述をコード上に残さない**（レビューの優先度較正で「高」に当たる）。

### 3.2 §4.2 適用経路——**見込みとの差（§9.3 の報告事項）**

| # | 経路 | 指示書の見込み | 実測 |
|---|---|---|---|
| 1 | `POST /api/combos`（`is_draft = true`） | 適用する | **適用された**（`input.IsDraft` を渡すため自動） |
| 2 | `PUT /api/combos/{id}` | 適用する見込み | **適用された**（同上） |
| 3 | `PATCH`（仮登録→本登録の昇格） | **既に走っているはず。変化なしの見込み** | **見込みどおり。変化なし**——`service.go:638` が `isDraft` に **`false` を直値で**渡しており、元から掛かっていた |
| 4 | CSV 取込 | 実査で確かめる | **適用面に入る**（commit が `comboSvc.Create` を通る） |

**⇒ 見込みとの差は 0 件。ただし §2.9 の「3 経路 / 4 入口」は followup の記述と食い違うため報告する。**

### 3.3 CSV 取込のプレビュー層（**開発者裁定 2026-08-29＝適用する**）

`internal/service/comboio/csvcore/validate.go:158`——`if !c.IsDraft && len(c.Steps) == 0` から**仮登録の除外を外した**。

- **★severity は WARNING のまま**（プレビューは止めない）。**⇒ 取込可否は変わらない。**
- **★外さなかった場合に残る形＝「プレビューは無警告 → commit で検証エラー」。** 本体側が仮登録でも弾くようになったため、除外を残すとプレビューが嘘をつく。
- **★同層は `VAL-C09` のテストを 1 本も持っていなかった**ので、あわせて追加した。

### 3.4 フロントエンド

**(a) zod の適用範囲を広げた**——`steps.min(1)` を `comboFormBase` へ移し、`comboFormSchemaPublished` / `comboFormSchemaDraft` の `steps` 上書きを**両方削除**した。**★モードごとに 2 本目を書き起こしていない。** モード名を含む旧メッセージ（「公開モードでは…」）も失効するため文面を直し、ファイル冒頭の「recipe 0 件許容」も as-built へ直した。

**★★§4.4 でどちらを採ったか＝「FE で先回りして塞ぐ」側である**（報告事項）。理由＝**既に本登録だけに掛かる検証が在り、指示書 §4.4 が「その掛かる範囲を広げる」を第一の選択肢としていた**ため。

**(b) 保存ボタンを `disabled` ＋ 理由にした**——`ComboEditor.tsx`

```
const saveBlockedReason = steps.length === 0 ? SAVE_BLOCKED_EMPTY_RECIPE : null;
const canSaveNow = !isMutating && saveBlockedReason === null;
```

| 論点 | as-built |
|---|---|
| **ボタン** | **★消していない**（`D-582`）。`disabled={!canSaveNow}` ＋ `aria-describedby` |
| **★タブ依存** | **していない。条件は `steps.length` だけである**（破壊確認 4 が固定） |
| **★仮登録トグル** | **分岐していない。本登録でも仮登録でも 0 本は保存できない** |
| **文言** | **`レシピを 1 つ以上入力してください(仮登録でも必要です)。`**（§9.2 で委任。**★「技を選べ」とは言っていない**——技が未指定のステップ 1 本でも保存できるため、文言がそれ以上を要求しないようにした） |
| **★理由の置き場** | **保存ボタン行の直前**（`ValidationDisplay` の直後）。**`tabIndex={0}` ＋ `aria-live="polite"`** |
| **物理コントローラ** | `RecipeBuilder` の `canSave` も **同じ `canSaveNow`** を見る。**★「押せない条件の定義はここ 1 か所」という既存の規律（`ComboEditor.tsx:804` のコメント）を守った** |

> **★★理由を `tabIndex={0}` にしたのは実装判断である**（§9.2 で「置き場の具体」は委任されている）。
> **根拠＝`disabled` なボタンはフォーカスを受けないため、理由をボタンの説明として持たせるとキーボードだけでは到達できない。** 理由の側を順送りの停止点にすると、**保存へ向かう順送りの途中で必ず理由を通る**。E2E (3) がそれを固定している。

---

## 4. 実装 ②：`VAL-S04` の check-then-act 競合を塞ぐ（§4.6・`D-588`）

**★★`M24-11` が `VAL-C02` に採った形をそのまま踏襲した。2 つ目の形を作っていない。**

| 層 | 変更 |
|---|---|
| **リポジトリ** | `FindDuplicateInComboTx(ctx, tx, ...)` を新設。既存 `FindDuplicateInCombo` は `tx=nil` で委譲する。**★候補の steps も同じ runner で引く**——ここで `*sql.DB` 直読みへ落ちると「候補は見えたがレシピを比較できない」形になり、内側へ移した意味が消える（`ComboDuplicateAdapter.stepsForCandidates` が `M24-11` で採ったのと同じ判断） |
| **サービス** | `SetupDuplicateAdapter`（`Tx` を握る）＋ `txScopedValidDeps` を新設。**束ねが外れたら `slog.Warn` を出す**——外れても `BEGIN IMMEDIATE` が正しさを保つためテストは緑のままであり、**気づく契機が無いから**である（`M24-11` レビュー 中-8 と同じ理由） |
| **サービス** | `CreateSetup` / `UpdateSetup` は `BeginTx` を判定より**前**へ移した。**★検証エラーと `ErrNotFound` は `err` 変数に載らず `defer` の rollback が発火しないため、明示的に閉じている** |
| **サービス** | `CreateSetupInTx` は渡された tx を束ねるようにした |
| **配線** | `cmd/combomgr/main.go` ＋ テスト配線 4 か所へアダプタを挟んだ。**★挟まないと tx を束ねられず、塞いだことを観測できない** |

**★`VAL-S04` が「何を重複とみなすか」は変えていない。位置を移しただけである。**
**★`VAL-S07` には触れていない**（削除済みセットプレイの重複＝WARNING。別の判定）。
**★新たに 500 を返す経路は増えていない**（`SQLITE_BUSY` の翻訳は射程外。**待ちは `BEGIN IMMEDIATE` の直列化で解決し、エラーにはならない**——競合テストが後続の成功を観測している）。

### 4.1 ★★本サブで実際に見つかった実害（**競合とは別物**）

**同一リクエストで同梱したセットプレイの 2 本目が、1 本目を見られていなかった。**

`POST /api/combos` の同梱セットプレイ（`CreateSetupInTx`）は tx を持っていたが、判定は `*sql.DB` 直読みだった。**⇒ 同じレシピのセットプレイを 2 本同梱すると、名前が違えば両方通っていた**（`VAL-S04` は名前を見ない＝`DES-006` §3）。

**★これは競合ではない。goroutine も待ちも要らない決定論的な穴である。**
**★既存テスト 2 件がこの穴に乗っていた**——`TestService_Create_WithMultipleSetups_OK` と `TestService_Create_BundledVerifiedConditions_PerSetup` は「名前だけ違う同一レシピ」を 2 本同梱しており、修正後は `VAL-S04` で落ちた。**⇒ fixture のレシピを分ける形へ直した。★検証は緩めていない——同一レシピの 2 本同梱は本来 `VAL-S04` の重複である。**

---

## 5. テスト

### 5.1 追加・変更したテスト

| 層 | 内容 |
|---|---|
| **Go `validation`** | 仮登録＋0 本 → ERROR（既存の `..._DraftSkipped` を反転） ／ **仮登録＋`move_id` NULL のステップ 1 本 → 通る**（`VAL-D02` 生存の観測） ／ 仮登録＋非技ステップ 1 本 → 通る ／ 本登録 1 本 → C09 が出ない（対照） |
| **Go `combo` service** | `..._AllowsEmptyRecipe` を `..._RejectsEmptyRecipe` へ反転 ／ 技未指定 1 本・非技 1 本がサービス層まで通ること ／ **`M24-13` 以前に作られたステップ 0 本の仮登録は行として残るが、昇格の保存は `VAL-C09` で止まること**（`CHANGE-139` §5 リスク 1 の固定。**★行が消えないことも同時に主張している**） |
| **Go `csvcore`** | 仮登録行でも `VAL-C09` が WARNING で出ること ／ **取込候補のままであること** ／ 1 ステップあれば出ないこと（**同層は `VAL-C09` のテストを 0 本しか持っていなかった**） |
| **Go `setup`** | **`VAL-S04` の競合の決定論テスト**（先行 tx が write lock を握る区間へ後続を構造的に入れる。`M24-11` の形を踏襲） ／ **同一 tx 内の同梱 2 本目が見えること** ／ **配線が実際に tx を束ねていること**（内部テスト） |
| **コンポーネント** | 0 本で `disabled` ＋ 理由（**ボタンを消していない**） ／ 1 本で押せる ／ **タブ依存でない** ／ **仮登録トグルで変わらない** ／ **理由が保存ボタンの直前に在りフォーカスを受けられる** ／ 編集モードでも同じ |
| **zod** | 仮登録でも 0 件を弾く ／ **技未指定 1 本・非技 1 本は通る** |
| **E2E（新規 7 ケース）** | **(1a) UI で押せない ／ (1b) API が 400 `VAL-C09` を返す ／ (2) 技未指定 1 本で保存できる ／ (2b) API で `move_id` も `modifiers` も無いステップ 1 本が通る ／ (3) 理由が順送りで読める ／ 本登録側の対照 ／ ヘルパの対照** |

> **★★(1) を (1a)/(1b) の 2 本に割ったのは意図である。**
> **FE が先に塞ぐため、サーバ側の `VAL-C09` を外しても UI 側の観測は緑のままになる。** 1 本にまとめると「サーバが守っている」ことをどのテストも見なくなる（`M24-12` で破壊確認が 3 件空振りしたのと同じ形）。**破壊確認 1 でそれを実測した**（§6）。

### 5.2 既存テストの扱い

- **E2E のゼロステップ仮登録 32 サイト（26 ファイル）へステップを足した。★検証内容は緩めていない。**
  - 共通の下ごしらえは `web/e2e/support/` へ寄せた（`D-553`）——`support/draft-combo.ts` の `minimalDraftSteps`（API 経路）と `support/editor-input.ts` の `addMinimalRecipeStep`（UI 経路）。
  - **★足すのは「技を指定しない非技ステップ」1 本である。** 理由＝**fixture へ新しい警告を 1 件も増やさないため**。`VAL-C03` は始動技が NULL ならスキップされ、`VAL-C08` / `VAL-C12` は `move_id` を要求する。**⇒ 実在の技を足す形だと `VAL-C03` の WARNING が新たに出て、警告を数えている spec を巻き込む。** E2E の「対照: `minimalDraftSteps` で作った仮登録は警告なしで通る」がこれを固定している。
- **`M24-12` の E2E 7 ケースは 1 件も落としていない**（「保存直後の遷移で編集画面へ戻らない」を含め全数緑）。
- **Go の既存 fixture 2 件のレシピを分けた**（§4.1。緩和ではない）。
- **コンポーネントの編集モード fixture 6 件へ最小レシピを持たせた。** あわせて、**失効した理由づけのコメント 2 か所**（「仮登録なら recipe 必須を回避できる」）を直した。

### 5.3 ★★`M24-04`(4) の「エラーの作り方」を差し替えた（**命題も主張も不変**）

`m24-04-editor-input-safety.spec.ts` の (4)「別タブにエラーがある状態で保存すると、そのタブが分かる」は、**基本情報タブに居たまま、レシピ 0 件で保存する**形だった。**本サブでその仕掛けは作れなくなった**（保存ボタンが押せない）。

**★★あわせて分かったこと＝画面から到達できる検証エラーは 1 件も無くなった。**

| 欄 | UI 側の上限 | zod の上限 | 画面から超えられるか |
|---|---|---|---|
| メモ | `maxLength={2000}` | `max(2000)` | **不可** |
| ステップメモ | `maxLength={200}` | `max(200)` | **不可** |
| 数値欄 | `clampNumericString` でクランプ | 範囲 | **不可** |
| レシピ 0 件 | — | `min(1)` | **★本サブで不可になった** |

**⇒ サーバ応答だけを `page.route` で差し替える形にした**（先例＝`m22-01` / `m22-02`）。**★assert しているものは元と同一である**（レシピ側にバッジ 1 ／ 基本情報側は無し）。**★「エラーの在り処をタブ見出しで示す」（`M24-12`／`M24-04` の成果）は落ちていない。**

**★★これは申し送り事項でもある**（§9-2）。

---

## 6. 破壊確認（**5 件 ＋ 追加 1 件。すべて実施**）

**★書く前に 3 つを確かめた**（playbook §4.32）——**(a) 壊す対象が実在するか ／ (b) その壊し方で本当に観測が変わるか ／ (c) 期待経路は「その観測が何を見ているか」から立てたか。**
**★壊し方はすべてビルドが通る形を選んだ**（`M24-12` 教訓 17＝`vite build` が落ちると E2E の webServer が起動せず、赤の意味が確かめられない）。

| # | 壊したもの | **赤くなった経路（数えた）** | 判定 |
|---|---|---|---|
| **1** | `combo.go:143` の `validateC09RecipeNotEmpty` に `if !isDraft` を戻す | **3**＝`TestC09_EmptyRecipe_DraftError` ／ `TestService_Create_Draft_RejectsEmptyRecipe` ／ **E2E (1b)** | **赤** |
| **★2** | `validateC08MoveExists` の `if step.MoveID == nil { continue }` を ERROR 化（`VAL-D02` を壊す） | **7**＝Go validation 2 本 ／ Go service 2 本 ／ **E2E (2) (2b) 対照ヘルパ の 3 本** | **赤** |
| **3** | `canSaveNow` から `saveBlockedReason === null` を落とす | **7**＝コンポーネント 4 本 ／ **E2E (1a) (3) 対照 の 3 本** | **赤** |
| **4** | `saveBlockedReason` の条件をタブ依存（`activeTab === "recipe" && ...`）にする | **5**＝コンポーネント 5 本 | **赤** |
| **★★5** | `VAL-S04` の判定を書き込み tx の外へ戻す（`CreateSetup` を `BeginTx` の前へ・束ねも外す） | **2**＝`..._ConcurrentDoesNotDoubleLink` ／ `..._SeesUncommittedSiblings` | **赤** |
| **★追加 5b** | **束ねだけを外す**（`txScopedValidDeps` → `s.validDeps`。`BeginTx` の位置は動かさない） | **1**＝`..._SeesUncommittedSiblings` **のみ** | **赤** |

### 6.1 ★★破壊確認 1 で「フロント側が赤くならない」ことについて（**指示書の期待との差・報告事項**）

指示書 §5.3-1 は「**サーバ側とフロント側の両方が赤くなることを確かめること**」としているが、**実測では E2E (1a)（フロント側）は緑のままだった。**

**★これは観測の欠落ではない。** §4.4 で「FE で先回りして塞ぐ」を採ったため、**FE の `disabled` は BE の `VAL-C09` に依存していない**。⇒ BE だけを壊しても FE 側の観測は動かない。**動いたら、それは FE が BE の応答に依存しているという別の設計である。**
**★フロント側は破壊確認 3 が独立に赤くしている**（7 経路）。**⇒ 両側とも守られていることは、1 と 3 の 2 本で確かめられている。**

### 6.2 ★★追加 5b の意味（**`M24-11` の教訓がそのまま当たった**）

**束ねだけを外すと、競合テストは緑のままである。** `BEGIN IMMEDIATE` が後続の `BeginTx` を待たせ、tx1 の commit 後には `*sql.DB` 直読みでも重複が見えるためである。
**⇒ `D-360` の規約（「tx を取るならその tx を読みにも使う」）を守っていることを観測しているのは `..._SeesUncommittedSiblings` の 1 本だけである。** **★この 1 本を消すと、束ねが外れても誰も気づかない。**

---

## 7. §7.4.1 CHANGE 要否の判定（**as-built で 1 件ずつ**）

| # | 条件 | 判定 |
|---|---|---|
| **1** | **`DES-002` §4.2 の経路表に載る応答が変わったか** | **★経路表の行は変わっていない。新しいエラーコードは 1 件も足していない**（`VAL-C09` は元から `400 validation_failed` の `issues[]` に載る形で本登録の経路に存在していた）〔E2E (1b) が実応答を観測している〕。 **★★ただし「同一入力に対する応答が変わる経路」は 2 本ある**〔レビュー 中-2 で追記〕——**(a) 仮登録・0 ステップの `POST` / `PUT` が 201/200 → 400** ／ **(b) `POST /api/combos` の同梱セットプレイで、名前だけ違う同一レシピの 2 本目が 201 → 400**（§4.1）。**★(b) は `VAL-S04` 側の変化であり、CSV 取込へは波及しない**——`import.go:274` は `CreateSetup` を 1 本ずつ呼んで個別にコミットするため、2 本目は以前から見えていた。**⇒ 設計卓へ報告する** |
| 2 | `DES-003` のスキーマに触れたか | **触れていない。** マイグレ消費 0 本 |
| **3** | **`DES-006` の VAL 表の行を増やしたか（`VAL-D04` を作ったか）** | **★作っていない。** 既存の `VAL-C09` を呼んでいる |
| **4** | **`REQ-001` を編集したか** | **★編集していない。**〔`git diff --name-only 11bcb6a -- docs/design/` が 0 件〕 |
| 5 | `SUPP-001` の契約を持つ節に触れたか | **触れていない。★ただし §2.1 に失効箇所がある**（§8） |
| **6** | **★CSV 取込の挙動が変わったか** | **★変わった。2 か所。**(a) commit：仮登録・0 ステップの行が「検証エラー」で落ちるようになった（本体の `Create` を通るため自動）。(b) プレビュー：`VAL-C09` の WARNING が仮登録行にも出るようになった（**取込可否は不変**）。**⇒ `DES-006` §5 / §6 の射程。設計卓へ報告する** |
| 7 | マイグレーションを消費したか | **0 本。**〔`ls migrations/` の最新は `000079`。次に払い出す番号は `000080` のまま〕 |

**⇒ 射程が広がったのは #6 の 1 件である。** 他 6 件は「広がらなかった」。**★判定したこと自体を本節に残す**（§9.4）。

---

## 8. ★設計書の失効箇所（**実物を `grep` して挙げた。製造は編集しない**）

**★記憶からの転記ではなく、設計書を直接開いて走査した**（`M24-12` 教訓 14 / 23。**使った `grep` の出力を添える**）。

```
$ grep -rn "全て適用しない" docs/design/*.md
docs/design/06-validation.md:65:VAL-C01〜C11 のうち、上記D01〜D03以外は **全て適用しない**。仮登録は「うろ覚えや机上アイデア」の記録が目的のため（FR009、FR305）。
```

```
$ grep -rn "仮登録" docs/design/supp-001-detailed-design.md | grep -i "レシピ\|空"
93:- 仮登録コンボ(`is_draft=true`)は `combos.starter_move_id` NULL 許容、レシピ0ステップを許容する(...FR009)
94:- VAL-C09(レシピ空はERROR)は本登録時のみ適用。仮登録時は WARNING にも出さない
```

| # | 場所 | 失効した内容 |
|---|---|---|
| 1 | `DES-006` §2.2（`06-validation.md:65`） | **「VAL-C01〜C11 のうち D01〜D03 以外は全て適用しない」**——**`VAL-C09` は適用する。★`CHANGE-139` §2.1 が例外 1 件を立てると定めている箇所である** |
| 2 | `DES-006` §2.1 の表題「**本登録コンボ**に対する検証」 | `VAL-C09` は仮登録にも掛かるようになった。**★行そのものは不変**（種類 ERROR）。位置づけの調整は設計卓の判断 |
| **3** | **`SUPP-001` §2.1（`:93`）** | **「レシピ0ステップを許容する」**——**★指示書・`CHANGE-139` のどちらも `SUPP-001` を影響先に挙げていなかった** |
| **4** | **`SUPP-001` §2.1（`:94`）** | **「VAL-C09 は本登録時のみ適用。仮登録時は WARNING にも出さない」**——同上 |
| **5** | `DES-006` §2.3 / §3 | **`VAL-S04` も「判定を書き込み tx の内側で `*sql.Tx` を使って行う」形になった。** §2.3 は `VAL-C02` についてのみこれを固定している（4 経路の表）。**★`VAL-S04` 側の同じ記述が無い** |
| **★6** | **`REQ-001` FR305（`requirements.md:162`）** | **「仮登録状態のコンボに対してはバリデーションを適用しない、または警告のみとする」**——**★仮登録に ERROR の `VAL-C09` が掛かるようになったため、後段の 1 文が成立しない。★指示書 §4.5 も `CHANGE-139` §2.4 も名指ししているのは FR009 だけであり、FR305 は誰も挙げていなかった**〔レビュー 1 回目 中-1 が検出。**★本節の初版は走査語を「全て適用しない」「仮登録＋レシピ／空」に限っており当たらなかった**＝`M24-12` 教訓 23 の再来〕 |

### 8.1 ★★実装側の失効記述（**設計書とは別に走査が要る**）

**★★本節の初版は設計書だけを走査対象にしており、実装側の失効記述を挙げる欄が存在しなかった**〔レビュー 2 回目 高-A が検出〕。

```
$ grep -rn "レシピ未入力や重複コンボの登録等を許容" web/src web/e2e
web/src/features/combo/components/ComboDraftToggleField.tsx:36   （DRAFT_TOGGLE_LABEL）
web/src/features/combo/components/ComboDraftToggleField.tsx:41   （DRAFT_TOGGLE_NOTE）
web/src/features/combo/components/ComboEditorBasicFields.test.tsx:1231
web/e2e/m24-12-editor-rebuild.spec.ts:206
```

| 対象 | 失効した内容 | 対応 |
|---|---|---|
| **★★仮登録トグルのラベル**（`ComboDraftToggleField.tsx:35-36 / :41`） | **「仮登録として保存(★レシピ未入力や重複コンボの登録等を許容)」**——**★これはコメントではなく利用者に見える文字列である。★同じ画面の下で保存ボタンが `disabled` になり「レシピを 1 つ以上入力してください(仮登録でも必要です)。」と出るため、画面が上下で正反対のことを言っていた** | **★括弧の中から「レシピ未入力」を落とした**（→ `仮登録として保存(重複コンボの登録等を許容)`）。**★`VAL-C02` が仮登録で走らないことは今も事実なので、「重複コンボの登録等」は残す。★「ラベルは 2 つの版で同一」（`M24-12` §4.10.2 / `D-582`）の規律は崩していない**——正典は `DRAFT_TOGGLE_LABEL` の 1 本のまま |
| **★旧文字列を固定していたテスト 2 本** | `ComboEditorBasicFields.test.tsx:1231` ／ `m24-12-editor-rebuild.spec.ts:206` | **新文字列へ追随させた。★見ている命題（inline 版でも補足が出る／2 つの版で同一）は変えていない** |
| `ComboDraftToggleField.tsx:30-33` の godoc | 「`DES-006` §2.2 が『VAL-C01〜C11 のうち D01〜D03 以外は全て適用しない』と定めており」——**★まさに `CHANGE-139` が例外 1 件を立てた文である** | 根拠の引用を `VAL-C02` のぶんだけに絞り、`VAL-C09` の例外を明記した |

> **★★なぜ 1 回目の取り込みで拾えなかったか。** §12 の 高-2 行に「`grep` で残存 0 を確認した」と書いたが、**走査したのは E2E の spec ヘッダだけであり、`web/src/` 側と「コメント以外の文字列」を見ていなかった。** **⇒ 「残存 0 を確認した」の主張が成立していなかった。** **★モック HTML もトグルのラベルを描いていないため、開発者の目視確認でも見えなかった。**

**★★#3 / #4 は設計卓が影響先として挙げていなかった箇所である。** 見つかった経路は「`grep` で設計書を走査したこと」だけである。

---

## 9. ■ 併せて更新が要るもの

| 項目 | 状態 |
|---|---|
| **消費した CHANGE 番号の登録** | **★なし。** `CHANGE-139` は**設計卓が起票済み**であり、製造は番号を消費していない。`change-number-registry` §1 への登録も設計卓の手番である |
| **「次の番号」の写し先（実査 4 か所）** | **★変更なし**（番号を消費していないため）。registry §1 ／ 契約 §4 ／ ボード §2.1 ／ ボード §2.4 のいずれも触っていない |
| **消費したマイグレ連番** | **★0 本。**`ls migrations/` の最新は `000079_fix_character_display_names`。**次に払い出す番号は `000080` のまま**であり、ボード §2.2 の更新は不要 |
| **版を上げた文書の参照元** | **★なし**（設計書・指示書の版は上げていない。指示書 v1.1.0 は設計卓が上げたものであり、本ブランチにはコミットしていない） |
| **`web/CLAUDE.md` §1 のブラウザストレージ台帳** | **★更新不要。新キー 0 件** |
| **`docs/progress/progress-log.md`** | **★追記した**（`CLAUDE.md` §8）。**★★ただし初版の報告書は Phase D（索引行の追記）より前に「追記した」と書いていた**——**工程順として「まだ無い」ものを過去形で書かない**（指示書 §7.5）に触れる。レビュー 高-1 で是正した |

---

## 10. 品質チェック

| 検査 | 結果 |
|---|---|
| **`bash scripts/check-artifact-integrity.sh`（★1 本目に回した）** | **違反なし**（検査 11 件の自己検査 OK ／ 生成物 4 件 OK） |
| `bash scripts/check-md-emphasis.sh` | **ベースラインどおり（増加なし）**〔★初回は 3 行増で赤。本報告書の閉じない強調 3 か所を直した〕 |
| `bash scripts/check-doc-refs.sh` | **dead reference なし** |
| `bash scripts/check-enum-sync.sh` | **ベースラインどおり（増加なし）** |
| `bash scripts/check-browser-storage-keys.sh` | **違反なし**（新キー 0 件） |
| `bash scripts/check-progress-log-index.sh` | **★★本報告書の初版はこの欄を「違反なし」と書いたが、その時点で本検査は 1 度も回していなかった。実測は `NG 1 件`（索引行が無い）であった**〔レビュー 高-1 が検出〕。**⇒ 索引行を追記したうえで回し直し、`違反なし` を確認した。** **★偽の緑を返しうる**（followup §AH）ため、索引行そのものも目で確かめた |
| `go build ./...` ／ `go vet` ／ `cd web && pnpm build` | いずれも成功 |

> **★`pnpm exec tsc --noEmit -p tsconfig.json` はテストファイルを型検査しない。** 本サブで実際に取りこぼした——テスト fixture の `ComboStep` に `id` が無く、`tsc` は緑のまま `pnpm build` が落ちた。**`make e2e` は `pnpm build` を通るため webServer が起動せず、「赤の意味が確かめられない」状態になっていた**（`M24-12` 教訓 17 の隣接形）。**⇒ フロントの型検査は `pnpm build` で見ること。**

---

## 11. 申し送り（**設計伝達レポート §4 の候補**）

1. **★★`SUPP-001` §2.1 の 2 行が失効している**（§8 の #3 / #4）。**指示書も `CHANGE-139` も影響先に挙げていなかった。** 反映先の判断が要る。
2. **★★画面から到達できる検証エラーが 1 件も無くなった**（§5.3）。**「エラーの在り処をタブ見出しで示す」（`M24-04` SM-148 ／ `M24-12`）は、実装としては生きているが、利用者が実際に見る機会がほぼ無い。** サーバ側のエラー（`VAL-C01` 等）は API 直叩きでしか起きず、`VAL-C02` は `field` が空で振り分け対象外（モーダルで出る）。**⇒ 機能そのものの位置づけを設計卓で判断してほしい。**
3. **★`VAL-S04` の適用面の数え方**（§2.9）。**followup の「3 経路」は判定関数の呼出元としては正しく、入口としては 4 本である。** どちらを正本にするか。
4. **★`DES-006` §2.3 に `VAL-S04` の tx 内判定を書く必要がある**（§8 の #5）。`VAL-C02` の 4 経路の表と同じ形で。
5. **★CSV 取込のプレビューと commit の severity が非対称のままである**——プレビューは WARNING、本体は ERROR。**本サブは「除外の有無」だけを揃え、severity は揃えていない**（プレビューを止めない設計を尊重した）。**⇒ 「プレビューは通るが commit では落ちる」形自体は残る。** 揃えるべきかは設計判断。
6. **★★本番配線（`main.go`）がアダプタを挟んでいることを固定する観測が無い**〔レビュー 中-4〕。`txScopedValidDeps` は `SetupRepo` が `*SetupDuplicateAdapter` でなければ **WARN を出して黙って `*sql.DB` 直読みへ落ちる**。**⇒ `cmd/combomgr/main.go:200` の配線を間違えてもテストは全部緑になる**（テスト側は自前でアダプタを挟むため）。**★`M24-11` の `combo` 側も同じ構造であり、本サブ固有ではない。** 依存組み立ての切り出しは本サブの射程を超えるため、**followup 候補として設計卓へ回す。**
7. **★`FindDuplicateInCombo`（tx なし版）の残る呼出元**——アダプタ経由に一本化したが、リポジトリのインタフェースには両方が残っている。保存前チェック（何も書かない経路）が tx なしを正当に使うため残置した。


---

## 12. レビュー取り込み（Phase C）

`docs/progress/m24-13-review.md`（**重大 0 / 高 3 / 中 4 / 低 5**）を**全 12 件採用**した。**不採用は 0 件**であり、「高」の不採用によるエスカレーションは発生していない。

| 指摘 | 対応 |
|---|---|
| **高-1** | **索引行を `progress-log.md` へ追記し、§10 の検査結果を実測へ是正した。★「回していない検査を『違反なし』と書いた」ことを §10 に明記して残す**（消して直すと、同じ誤りが次に見えなくなる） |
| **高-2** | 失効コメント 4 か所を as-built へ（`combo-crud` ×2 ／ `m12-03` ／ `m17-01`）。**★`grep` で残存 0 を確認した** |
| **高-3** | `expect(body.warnings ?? []).toHaveLength(0)` を `expect(body.validations).toBeUndefined()` へ。**★指摘どおり「直したつもりがまた空振り」を避けるため、`starterMoveId` を足して `VAL-C03` を故意に発火させ、赤くなることを実測してから戻した** |
| **中-1** | `REQ-001` FR305 の失効を §8 の表へ追加（#6）。**★`REQ-001` は編集していない** |
| **中-2** | §7.4.1 #1 の判定へ「応答が変わる経路 2 本」を追記。**★CSV 取込へ波及しないこともレビューの指摘どおり確認して書いた** |
| **中-3** | **案 (a) を採用**——`TestIssueFieldFormat_RecipeSideUsesIndexedPrefix` を `validation` パッケージへ追加し、**BE が返す `field` がフロントの前方一致（`steps[`）に当たる形であること**を固定した |
| **中-4** | **コード変更なし。§11-6 の申し送りへ**（依存組み立ての切り出しは本サブの射程外。`M24-11` の `combo` 側も同じ構造） |
| **低-1** | §2.2 の事実誤りを是正（`validateC04DriveRange` は `_ = isDraft` ではなく空ブロック） |
| **低-2** | `txScopedValidDeps(ctx, tx)` へ。`slog.WarnContext` が呼出側の `ctx` を受け取る |
| **低-3** | `role="status" aria-live="polite"` の器を常設し、中身だけ差し替える形へ。**★器に test-id は付けていない**（中身の有無を `toHaveCount` で見ている spec があるため） |
| **低-4** | `m24-04` の import を複数行へ戻した |
| **低-5** | `FindDuplicateInCombo` の godoc へ「書き込み tx の内側からは `FindDuplicateInComboTx` を使うこと」を明記 |

**★レビューが指摘した「高」3 件はいずれも『動作は正しいまま緑になる』型であった。** **とくに 高-1 は検査結果の誤記であり、報告書を読む後任にとっては「回した証拠」として機能してしまう。⇒ 是正の記録を残す形を採った。**
