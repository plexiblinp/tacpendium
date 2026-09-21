# M37-05 設計伝達レポート(例外レポート)

| 項目 | 内容 |
|------|------|
| 対象 | **親チャット(設計卓)** |
| 発信 | 製造担当 Claude Code ／ 2026-09-13 |
| 指示書 | `docs/instructions/M37-05-position-mass-null-invariant.md` **v1.0.0** |
| 実装コミット | ブランチ `claude/admiring-babbage-8hdc23` ／ **5 コミット**(着手基点 `9a4d391` → `f16b228`)。**push 済み ⇒ 設計卓が HEAD で読める** |
| 関連 | 完了報告 `docs/progress/M37-05-completion-report.md` ／ レビュー `docs/progress/m37-05-review.md` |
| **レビュー集計** | **高 4 / 中 4 / 低 5 ＝ 全 13 件・採用 10 / 不採用 2(＋該当なし 1)・「高」の不採用 0 件・再レビュー往復 0 回(上限 2)** |

**★★§2(契約違反の独自判断)に 1 件ある。** 受理/却下の裁定が要る。**開発者裁定は経ている**(案 A の選択)。

本書は **①独自確定仕様 ②契約違反の独自判断 ③製造判断 ④残課題** に絞る。指示書どおりの部分は割愛する。

**★★★最重要は §1-1 と §4-1 である。** **§4-1 は「設計書へ書いてはいけないこと」の申し送りであり、放置すると過大な契約が DES へ入る。**

---

## §1 製造が独自に確定した実装仕様(DES 反映が要るもの)

### 1-1 ★★★`PATCH /api/combos/{id}` がマス数を正規化するようになった(`DES-002` §4.2)

**★`CHANGE-195` §2.3 の「持たせなかった分岐 1」が変わった。** 着手前の `PATCH` は**マス数を送られたとおりに保存**していた。

#### 要求 DTO(**増分なし**)

`internal/api/combo/dto.go:160-161` は `CHANGE-195` のまま **1 バイトも変わっていない**。

```go
StartPositionMass comborepo.Optional[int] `json:"startPositionMass"`
CarryDistanceMass comborepo.Optional[int] `json:"carryDistanceMass"`
```

#### 応答 DTO(**増分なし**)

`internal/api/combo/dto.go:271-273`。`*int` ／ `omitempty` のまま。

```go
StartPositionMass *int `json:"startPositionMass,omitempty"`
CarryDistanceMass *int `json:"carryDistanceMass,omitempty"`
```

#### ★★★変わったのは「保存される値」である

`internal/service/combo/service.go` の `fillStartPositionMassForPatch`(`service.go:786` で呼ぶ)が、
**更新後のマス数が NULL になるとき、DB 上の `position` が区分なら代表値で埋める。**

| 要求本文 | DB の現在値 | DB の `position` | 保存される `start_position_mass` |
|---|---|---|---|
| `"startPositionMass": 80` | 何でも | 何でも | **80**(★埋めない。利用者の値が勝つ) |
| `"startPositionMass": null` | 何でも | **区分** | **★区分の代表値**(例 `mid_screen` → 80) |
| `"startPositionMass": null` | 何でも | **不問(NULL)** | **NULL のまま**(★代表値が定義されていない) |
| **キーが無い** | **NULL** | **区分** | **★区分の代表値**(★メモだけの `PATCH` でも入る) |
| **キーが無い** | 値あり | 何でも | **DB の値のまま**(★埋めない) |
| **キーが無い** | NULL | **不問(NULL)** | **NULL のまま** |

**★代表値の出所は `model.PositionBands` 1 本である**(`internal/model/position.go:46-54`。12/36/58/80/102/124/148)。

#### エラー契約(**増分なし**)

| 状況 | ステータス | コード |
|---|---|---|
| マス数が 0〜160 の外 | 400 | `VAL-RANGE`(`CHANGE-195` §2.2 のまま) |

**★補完で入る値は必ず 0〜160 であるため、本経路が新しいエラーを返すことはない。**

#### 母集団の述語

**本経路が触るのは*識別キーが変わらない編集*だけである**(`CHANGE-195` §2.4 のまま)。
**★マス数 2 欄はキーではないため本経路に載る。**

#### ★★★持たせなかった分岐(**誤読を防ぐため明記する**)

| # | 持たせなかったもの | 帰結 |
|---|---|---|
| **1** | **`position` を書く分岐** | **★`comborepo.UpdateMetadataInput` に `Position` 欄が無く、SET 句にも `position` が 1 度も現れない。⇒ 構造的に不可能である** |
| **2** | **マス数から `position` を導出する分岐** | **★★★`normalizePositionAndMass` を*そのまま*呼んでいない。⇒ 同関数の*補完の半分*だけを `representativeMassFor` として切り出して使う。★区分をまたぐマス数を `PATCH` へ直接投げても `position` は動かない**(破壊確認 `TestPatch_CrossBandMass_DoesNotMovePosition`) |
| **3** | **`carry_distance_mass` を埋める分岐** | **★運び量は区分を持たず代表値の概念が無い**(`D-731` 不変条件 2)**。⇒ NULL は正常な状態である**(`TestPatch_CarryDistanceMass_NeverFilled`) |
| **4** | **不問の行を埋める分岐** | **★代表値が定義されていない。⇒ NULL のまま**(`TestPatch_Unspecified_StaysNull`) |
| **5** | **CSV / API へ新しい拒否** | **★開発者が「想定しなくていい」と述べている**(`D-864`)**。⇒ `csvcore` の差分はテストのみ** |

**⇒ `DES-002` §4.2 の `PATCH /api/combos/{id}` 行へ、上の表(要求本文 × DB の現在値 × `position`)を明文化してほしい。**

---

### 1-2 ★★画面が「保存より前に」代表値を入れるようになった(`DES-005` §5.7)

**★`CHANGE-196` の as-built に 1 行足る。**

| 画面要素 | as-built |
|---|---|
| 始動位置の **マス目 / パーセンテージ** 欄 | **★欄から離れた時点で**、空欄かつ区分が決まっていれば**代表値が入る**。⇒ 不問なら空のまま |
| 入力中 | **★空のままである**(打ち直せる。`onChange` では埋めない) |
| **運び量** | **★★掛からない**(`D-731` 不変条件 2) |

**★★★これは「保存してから値が生えてくる見え方にしない」ための措置である**(指示書 §0.6)。
**サーバ側も同じ補完を行うため保存結果は同じだが、利用者には「消したのに生えてきた」と映る。**

**★実装の所在**: `web/src/features/combo/components/ComboEditorBasicFields.tsx` の `fillStartPositionMassOnBlur`(`ComboEditorBasicFields.tsx:310`)。
**代表値の出所は `representativeMassOf`** —— **区分ボタンを押したときと同じ 1 本である**(`web/src/constants/position.ts:82-85`)。**⇒ 3 本目の表は作っていない。**

**★E2E がワイヤ上で固定している** —— `PATCH` の**要求本文に `102` が載っている**ことを直接検証する
(`web/e2e/m37-05-position-mass-invariant.spec.ts:140`)。**⇒ 画面が埋めなくなれば本文が `null` になり赤くなる**(positive control で実測)。

**⇒ `DES-005` §5.7 の `CHANGE-196` ブロックへ 1 行足してほしい。**

---

### 1-3 ★`MassPercentInput` に `onBlur` ポートが増えた(`DES-005` §5.7・**props の凍結に関わる**)

**★同部品の props は「区分の口を持たせない」ために*完全一致*で凍結されている**(破壊確認 層 1)。
**⇒ 6 → 7 へ広げた。** 経緯と裁定は §2-1。

```ts
onBlur?: () => void;   // ★離れたという事実だけを運ぶ。代表値も区分表も受け取らない
```

**★★運び量の呼び出しには渡していない。⇒ 「運び量が埋まらない」ことが JSX の上で構造的に保証される。**

---

## §2 契約・設計に反する独自判断(★受理/却下の裁定が要る)

### 2-1 ★★破壊確認テスト(層 1)の凍結を 6 → 7 へ広げた

| 項目 | 内容 |
|---|---|
| **何に反したか** | `web/src/features/combo/components/MassPercentInput.test.tsx` の「**props は 6 個ちょうどで、区分の口が 1 つも無い**」——**`D-731` 不変条件 2 を「付けられない形」で固定する 3 層の 1 層目**。**★同ファイル自身が「『使われていないから』を理由に緩めるな」と明記していた** |
| **指示書の扱い** | **★指示書 M37-05 は本変更を求めていない。⇒ 製造が必要と判断した** |
| **なぜそう判断したか** | **(1) `onChange` では埋められない** —— 毎キーストロークで発火するため、`80` を消して `12` と打ち直そうとした瞬間に `80` が戻り**打ち直せなくなる**。⇒ 確定の合図が要る。 **(2) 代表値の知識は親にしか置けない** —— 層 2(`MassPercentInput.convention.test.ts`)が同部品のソースに `representativeMassOf` / `POSITION_BANDS` / `positionFromMass` が現れることを**禁じている**。**⇒ 親が blur を受け取る口が要る** |
| **却下した代案** | **親の `<div data-seq-stop>` で `focusout` をバブリングで拾う形**(凍結テストを 1 文字も触らずに済む)。**★却下理由＝将来だれかが始動位置と運び量を同じラッパへまとめた瞬間に運び量まで埋まり、型もテストも何も言わない**(指示書 §4.3 が名指しする事故の型) |
| **実装がどうなっているか** | `MassPercentInput.tsx`(props に `onBlur?: () => void`・mass / percent 両モードの `<input>` から呼ぶ) ／ `MassPercentInput.test.tsx`(`ExpectedKeys` に `onBlur` を追加・理由を 12 行のコメントで残した) |
| **★趣旨は壊していないと考える根拠** | **層 2 は 1 文字も触っていない**(禁止識別子は 1 つも増えていない)。**★`onBlur` は区分と無関係な汎用の口であり、本部品は代表値も区分表も受け取らない** |
| **開発者裁定** | **★2026-09-13 に案 A(本形)を選択済み**(逐語＝「案AのonBlurで良い」) |

**⇒ 親の仕事は、この緩和を受理して `DES-005` §5.7 へ as-built として書くか、却下して案 B へ差し戻すかである。**

---

## §3 製造の判断

### 3-1 開発者へ確認して確定した点

| # | 事項 | 確定した内容 |
|---|---|---|
| 1 | **段 1-1 の違反行の実査** | **★本セッションでは測れない**(クラウドのクリーンクローンに dev DB が無く、`migrations` は `combos` を 1 行も seed しない)。**⇒ 照合 SQL を渡し、開発者が手元で実測した**(2026-09-13)。**全 133 行(有効 109 / 削除済み 24)で違反 A・B とも 0 件・食い違い 0 件・運び量 NULL が 109 件。⇒ 埋め戻し 0・マイグレ 0** |
| 2 | **段 3 の確定トリガ** | **案 A(`onBlur` ポート)を選択**(§2-1) |

### 3-2 推測で進めた点

| # | 事項 | 判断と理由 |
|---|---|---|
| 1 | **補完を呼ぶ位置** | **検証より後・`repo.UpdateMetadata` の直前**。★埋める値は必ず 0〜160 で `VAL-RANGE` に当たらず、`start_position_mass` は `requiredPublishedFields` に無いため `VAL-C15` とも無関係 ⇒ 現状は順序が効かない。**★将来必須欄・相関検証の対象になったら検証より前へ移すこと**を godoc に書いた |
| 2 | **`FindByID` のメモ化**(レビュー 中-4) | `UpdateMetadata` 内に `currentBefore()` を置き、**既存 3 か所＋新規 1 か所を 1 回の読み取りへ集約**した。**★各呼び出し元のエラーの扱いは 1 文字も変えていない**(KA 変更分岐の `findErr == nil` 握り潰しもそのまま) |
| 3 | **`representativeMassFor` の切り出し方** | **関数として分ける**形を採った。★引数で導出を切る案は「次の担当が既定で導出付きを呼ぶ」(`CHANGE-195` の穴と同型)ため却下。★`PATCH` 側に代表値表を書く案は**3 本目の表**になるため却下 |

---

## §4 設計担当が未把握の残課題・申し送り

**★★★以下は `followup-backlog.md` への登録候補である。製造は同ファイルを 1 文字も編集していない**(`D-838`)。

### ★★★4-1 不変条件は片方向しか閉じていない(**最重要・設計書の書き方に直結する**)

| 項目 | 内容 |
|---|---|
| **スラッグ** | `position-mass-invariant-closes-one-direction-only` |
| **何が起きるか** | **`PATCH` が守るのは「区分あり ⇒ マス数が入る」だけである。⇒ 「マス数あり ⇒ 区分が決まっている」は守らない。** `position` が不問の行へ `startPositionMass: 80` を送ると、**`position` は NULL のまま値だけが入る** |
| **根拠** | `internal/service/combo/m37_05_representative_mass_fill_internal_test.go` の `TestRepresentativeMassFor_OnlyFillsWhenBandIsKnown` の「★不問 ＋ マス数あり ⇒ 触らない」が、その状態を許すことを自ら明文化している |
| **逆向きを閉じているもの** | **(a) 画面が `positionFromMass` で区分を導出する (b) 区分が変われば `hasKeyChanges` が `PUT` へ振り分ける** —— **この 2 つだけである。⇒ API を直接叩く経路は射程外**(指示書 §0.4 ／ §7-2＝「別の裁定が要る」) |
| **割付の候補と理由** | **★実装の変更は要らない**(レビューも「実装の変更は不要」と判定)。**⇒ 要るのは設計書の書き方の制御である。★`DES-003` §3.3 と `DES-002` §4.2 へ「3 経路で成り立つ」と*無限定に*書かないこと** |
| **新規/更新** | **新規登録** |

### 4-2 `import.go` の事前重複判定が正規化前の `position` を使う

| 項目 | 内容 |
|---|---|
| **スラッグ** | `csv-import-precheck-duplicate-uses-unnormalized-position` |
| **何が起きるか** | `internal/service/comboio/import.go:335-363` の `checkDuplicate` が `CheckDuplicateInput{Position: strToPtr(dto.Position)}`(**CSV の生の値**)で判定する。一方 `normalizePositionAndMass` の godoc(`service.go:1777-1779`)は「**重複判定より前に呼ぶこと**」と定めている。**⇒ `Create` の内側では順序が正しいが、この取り込み層の事前判定はその保証の外に在る** |
| **根拠** | `internal/service/comboio/import.go:350`(生の `dto.Position`) ／ `internal/service/combo/service.go:343`(`Create` 内の正規化) |
| **実害** | **★現時点では小さい。** マス数と `position` が食い違う CSV でしか踏めず、**開発者実測でも食い違い行は 0 件**であった |
| **割付の候補と理由** | **本サブでは直していない**(指示書 §0.4 / §3-4 が CSV 経路への手入れを射程外としているため)。**⇒ CSV 取り込みを触る次のサブか、`VAL-C16` の裁定と同時に扱うのが自然** |
| **新規/更新** | **新規登録** |

### 4-3 画面の先回り補完は「マス数欄を触って離れた」ときだけ働く(**残余**)

| 項目 | 内容 |
|---|---|
| **スラッグ** | `position-mass-prefill-only-on-field-blur` |
| **何が起きるか** | 区分が決まっていてマス数が NULL の行を**メモだけ直して保存**すると、値はサーバ補完で入り、**利用者からは保存後に生えて見える**(指示書 §0.6 の観点では残余) |
| **根拠** | `web/src/features/combo/components/ComboEditorBasicFields.tsx` の `fillStartPositionMassOnBlur` は blur 起点である ／ レビュー報告書 低-4 |
| **なぜ直さなかったか** | **(1) 開発者実測でその形の既存行は 0 件 (2) UI の通常操作では作れない**(区分を選べば代表値が入る) **(3) ★指示書 §2.2-1′ が「メモだけの `PATCH` でも代表値が入る」ことを*意図した形*として明記している** |
| **割付の候補と理由** | **編集画面のマウント時補完を入れるかは別の判断である。⇒ 急がない**(`D-857`＝利用者はまだいない) |
| **新規/更新** | **新規登録** |

### 4-4 ★既存行の状態更新の依頼(**設計卓の手番**)

| 項目 | 内容 |
|---|---|
| **スラッグ** | `position-mass-clear-differs-between-patch-and-put`(`followup` §DD) |
| **更新後の状態** | **★解消した。** `PATCH` も代表値で補完するようになり、`PUT` との食い違いは消えた(`D-864` の裁定どおり) |
| **根拠** | 実装 `internal/service/combo/service.go` の `fillStartPositionMassForPatch` ／ 試験 `TestInvariant_AllThreePaths` |
| **★あわせて** | **保留 `P-60` も決着どおり実装が入った**(ボード §4 の状態更新) |
| **新規/更新** | **★既存行の更新**(製造は編集していない) |

### 4-5 レビュー低指摘の繰越(**不採用 2 件**)

| # | 指摘 | 不採用の理由 |
|---|---|---|
| **低-4** | 画面の先回り補完が blur 起点に限られる | **§4-3 として申し送った**(実装しない判断の根拠は同節) |
| **低-5** | `TestPatch_ClearMass_FillsRepresentative` が代表値 7 個をベタ書き | **★意図した外形固定である**(レビュー自身も「外形固定として妥当」と評価)。表駆動の `TestRepresentativeMassFor_CoversAllBands` と役割が違い、**両方が緑でなければ「表が変わったのか実装が変わったのか」を切り分けられない** |

**★「高」の不採用は 0 件である。⇒ 開発者確認を要する棄却は発生していない。**

### 4-6 ★停止時記録(`§J` 行の原稿)

**なし。** 上限(再レビュー往復 2 回 / タイムボックス / 終了指示)に達しておらず、未解消の指摘は無い。

---

## §5 参考(触れていない=不変の証跡)

- `migrations/` —— `git diff --stat 9a4d391` **空**。最新は `000112` のまま(**マイグレ消費 0 本**)
- `docs/handover/followup-backlog.md` —— `git diff` **空**(`D-838`)
- `docs/design/` —— `git diff` **空**(`CLAUDE.md` §8)
- `internal/service/combo/duplicate_keys.go` —— `git diff` **空**(重複判定キーは不変)
- `web/src/features/combo/utils.ts` —— `git diff` **空**(`extractKeyFields` / `hasKeyChanges` は無傷)
- `normalizePositionAndMass` の呼び出しは **2 か所のまま**(`service.go:343` Create ／ `:848` UpdateWithKeyChange)
- `MassPercentInput.convention.test.ts`(破壊確認 層 2) —— **1 文字も変えていない**
- 不変を固定するテスト: `TestNormalize_DerivationStillWorksOnCreateAndPut`(POST / PUT の導出) ／ `TestEmptyMassCells_RawCSVText_StillParses`(CSV の空セル)
- 検査の実測: `check-import-order.sh` **99 / 99**(着手時と同値) ／ `check-enum-sync.sh` ベースラインどおり ／ `check-artifact-integrity.sh` 違反なし
- 全数: `go test ./...` 緑 ／ `pnpm test` 233 ファイル 2909 テスト緑 ／ `make e2e` **350 passed / 失敗 0**(Phase A 後・Phase C 後の 2 回)

---

## §6 CHANGE 起票のたたき台(設計担当向けチェックリスト)

**★番号は起票時に registry で採番。製造は自採番していない**(`D-293`)。
**★マイグレ消費 0 本** —— `ls migrations/` の最新は着手時と同じ `000112`(全 222 ファイル＝111 組)。**新規作成なし。**

| # | 反映先 | 内容 |
|---|---|---|
| **1** | **`DES-002` §4.2** の `PATCH /api/combos/{id}` 行 | **§1-1 の表をそのまま**。**★`CHANGE-195` §2.3 の「持たせなかった分岐 1」が変わったことを明記**(着手前は素通し)。**★`position` は依然として載らない ／ `carry` は埋めない ／ 導出はしない。★§4-1 の限定(片方向)を必ず添える** |
| **2** | **`DES-005` §5.7** の `CHANGE-196` ブロック | **§1-2**。「マス数の欄を空にしたまま離れると区分の代表値が入る／不問なら空のまま／運び量には掛からない」。**★§1-3 の `onBlur` ポート(props 6 → 7)も as-built として書くかは §2-1 の裁定次第** |
| **3** | **`DES-003` §3.3** の `position` / `start_position_mass` 行 | **不変条件 `start_position_mass IS NULL ⇔ position = 不問` を明記**。**★既存の記述(マス数が勝つ／代表値／両方 NULL)は `POST` / `PUT` の正規化として引き続き正しい。⇒ 足るのは「`PATCH` も同じ不変条件を守る」ことと「NULL に 2 つ目の意味を持たせない」こと。★§4-1 の限定を必ず添える** |

**★1 本の CHANGE で 3 節を扱うか 2〜3 本に割るかは設計卓の裁量である。**

---

## §7 教訓(retrospective 行き)

**★親は本節を読まなくてよい。** 宛先は `retrospective-log` へのバッチ反映であり、実施者は設計担当である。

### 7-1 ★★★全数テストの合否を、パイプ越しに判定してはならない

**製造は `go test ./... 2>&1 | grep -v "^ok\|no test files" | head -20; echo "=== GO ALL DONE ==="` で確認し、「緑(exit 0)」と完了報告へ書いた。実際は赤であった。**

**★破れ方が 2 つ重なっている。** **(1) `head -20` が `FAIL` 行を切り落とした (2) 報告された終了コードは*パイプ末尾の `echo`* のものであった。**

**⇒ 一般形＝全数の合否は「パイプを挟まずファイルへ落とし、直後に終了コードを読む」。**

```bash
go test ./... > /tmp/gotest.txt 2>&1; echo "EXIT=$?"
grep -cE "^--- FAIL" /tmp/gotest.txt
```

**★★同じ型を本サブ内でもう 1 度踏んだ** —— `make e2e` の出力を `| tail -45` で取ったため、既存 spec の個別行が残らず、
**「影響を受けなかった」の根拠が「失敗 0 件」という全体の結果しか無い状態になった**(2 回目でファイルへ全量を落として是正)。
**⇒ 機構化の候補: 製造 CLI の「全数」節へ、上の 2 行をコマンドとして書き込む。**

### 7-2 ★★「外すと赤くなる数」と「入れて既存が赤くなる」は別の確認である

**製造は positive control(補完を外すと 10 件赤)を実施しており、そこは正しかった。⇒ それでも既存 1 本の赤を見落とした。**

**★理由は、positive control が「自分の新しいテストが効いているか」しか見ないためである。**
**⇒ 新しい既定値・補完・正規化を足すサブでは、確認が 2 本要る。**

| # | 確認 | 何が分かるか |
|---|---|---|
| 1 | **外すと赤くなるか** | **新しいテストが効いているか** |
| 2 | **★★入れて既存が赤くならないか** | **★旧挙動を固定した既存テストと衝突していないか** |

**★★本サブの赤は実装の欠陥ではなく、`D-864` が意図的に変えた挙動を旧のまま固定した既存テストであった。**
**⇒ この型は「赤いから直す」ではなく「どちらが正しいかを裁定に照らす」が正しい手順である。**

### 7-3 ★凍結テストを緩めるときは、何を守っている凍結かを先に読む

**`MassPercentInput` の props 完全一致テストは 3 層の 1 層目であり、本体は層 2(ソース走査)である。**
**⇒ 層 1 を緩めても層 2 が無傷なら趣旨は保たれる。★逆に層 2 を緩めると、層 1 が何個であっても意味が無い。**

**★一般形＝多層の破壊確認では「どの層が本体か」をテスト自身に書いておくと、次の担当が緩める層を間違えない。**

---

*以上、M37-05 設計伝達レポート。* **★★★§2-1 は受理/却下の裁定が要る(1 件)。★★§4-1 は「設計書へ無限定に書かないでほしい」という申し送りであり、受理が遅れると過大な契約が DES へ入る。**
