# M31-06 完了報告: `setup_only` の技をコンボの入力面から外す経路を作る

| 項目 | 内容 |
|------|------|
| 作業 ID | **M31-06**（`P4M-005` のフェーズ4 分） |
| 指示書 | `docs/instructions/M31-06-setup-only-input-exclusion.md` **v1.2.0** |
| チェックリスト | `docs/instructions/reviews/M31-06-review-checklist.md` **v1.0.0** |
| 実施日 | 2026-09-12 |
| 着手基点 | `aa0be70` |
| ブランチ | `claude/keen-dirac-8hckcz` |
| 消費マイグレ | **0 本**（指示書 §2.3-3・完了条件 7） |
| 消費 CHANGE | **0 本**。★起票は設計卓（`D-293`＝製造は自採番しない）。請求は §6 |

---

## 1. 変更したファイル

`git diff --stat aa0be70 HEAD`:

**★最終値**（Phase C 追補まで含む。実装差分は `docs/` を除いて **11 ファイル / +844 / −66**）:

```
 internal/model/move.go                                          |  17 +-
 web/src/features/combo/components/RecipeBuilder.test.tsx        |  68 +++
 web/src/features/combo/components/RecipeBuilder.tsx             |   4 +-
 .../VirtualController/VirtualController.test.tsx                | 134 ++++++
 .../VirtualController/VirtualController.tsx                     |  43 +-
 web/src/features/combo/hooks/useControllerInputOmission.test.ts | 168 ++++++-
 web/src/features/combo/hooks/useControllerInputOmission.ts      |  63 ++-
 web/src/features/combo/moveSurfacing.test.ts                    | 212 ++++++++-
 web/src/features/combo/moveSurfacing.ts                         | 111 ++++-
 .../setup/components/SetupRecipeEditor.test.tsx                 |  85 +++-
 .../setup/components/SetupRecipeEditor.tsx                      |   5 +-
```

**★新規ファイルは 1 つも作っていない**（教訓 `E-225` / `NEW-FILE-OVERWRITE-GUARD`）。**実装側に新規ファイルは 0 件**で、テストはすべて既存ファイルへの **describe 追記**である。**⇒ 上表の deletions 66 行はすべて「既存の行を書き換えた」ものであり、新規のつもりのファイルに deletions が付いた箇所は無い。** 内訳は失効コメントの差し替えと、`surfaceBuckets` / `useControllerInputOmission` の本体の組み替えである。

---

## 2. 段 1 の設計判断（指示書 §2.1・完了条件 1）

### 2.1 問題

セットプレイのレシピ入力は、コンボ登録と **同じ `VirtualController`・同じ `useControllerInputOmission`** を共有している。部品の中で `setup_only` を落とすと **セットプレイからも消え、本サブの意味そのものが消える**。

### 2.2 検討した案

| 案 | 中身 | 採否 |
|---|---|---|
| **(i) 判定へ「面」を渡す** | `isInputExcluded(move, context)` の中で、静的 code 列挙は両面・`setup_only` はコンボ側だけ、と理由ごとに面の効き方を分ける | **★採用** |
| (ii) セットプレイ側の呼び出しでだけ除外を外す | 呼び元で `isInputExcluded` を適用しない | **不採用。★`drive_reversal` がセットプレイ側へ漏れる** —— 静的除外まで面で分かれてしまうためである（チェックリスト C-3）。**この 1 点だけで落ちる** |
| (iii) `setup_only` 用に別の述語を新設 | `isSetupOnlyHidden()` 等を足す | **不採用。★2 本目の機構になる**（`D-810` が投入前に潰した形そのもの） |

### 2.3 採用案の実装

```ts
export type RecipeInputContext = "combo" | "setup";

export function isInputExcluded(move: Move, context: RecipeInputContext): boolean {
  if (INPUT_EXCLUDED_MOVE_CODES.has(move.code)) return true;   // 理由1: 両面で外す
  return context === "combo" && move.setupOnly;                // 理由2: コンボ側だけ外す
}
```

- **適用点は 1 つのままである**（§0.4 の要求）。**新しい関数も新しい定数も作っていない。** `INPUT_EXCLUDED_MOVE_CODES` は 1 文字も変えていない。
- **理由は判定の中で分かれている**（チェックリスト B-2）。由来が違う 2 軸 —— 静的なフロント定数とデータ駆動のフラグ —— を、**入口 1 本の中で 2 つの early return として**持つ。
- **既定値の扱いは 2 通りに分かれている。** `isInputExcluded` ／ `useControllerInputOmission` ／ `VirtualController` の `context` は **必須**で、面を宣言しない呼び出しを型検査が止める。**★`surfaceBuckets` の第 4 引数だけ既定 `"combo"` を持つ**——共有テスト `moveSurfacing.roster.test.ts` の 6 か所を `M30-05` と奪い合わないための**暫定**である（§10-3 ／ 解除の請求は §6.3-1）。**★本番の呼び元は `VirtualController` 1 つだけで、そこは必ず明示して渡す。⇒ 既定に頼る経路は本番に存在しない。**
  - **★★この行はレビュー 高-1 で是正した**（初版は「**既定値を置いていない**」と断定しており、**同じ手番で自分が置いた既定と矛盾していた**）。**⇒ コード側の型 doc も同時に直してある。**

### 2.4 セットプレイ側が 1 件も減らないことの保証（§2.1 成果物 2・チェックリスト C-2）

| # | 床 |
|---|---|
| 1 | **型**。`isInputExcluded` ／ `useControllerInputOmission` ／ `VirtualController` の `context` を必須にした。**⇒ 面を渡し忘れるとコンパイルが通らない** |
| 2 | **対になったテスト**。同じでっち上げ 1 件について「コンボ側で消える」と「セットプレイ側に残る」を **同じ describe の中で** 測る（§4） |
| 3 | **★画面配線の床**（**レビュー 高-2 派生で足した**）。**★★床 1 と 2 だけでは足りなかった** —— 型は「渡し忘れ」しか止めず、フック単体テストは配線を見ない。**⇒ `SetupRecipeEditor.tsx` の `"setup"` を `"combo"` へ*倒して*も、着手時点では全検査が緑のまま通った**（`setup_only` の実データが 0 件で、同画面のテストに fixture が無かったため）。**⇒ `SetupRecipeEditor.test.tsx` へ `setup_only` の技 1 件を混ぜ、プルダウンに並ぶことを測る 1 本を足した。★実際に倒して赤になることを確認済み**（§4.4 の (5)） |

### 2.5 `omittedCount` の数え方（§2.1 成果物 4・チェックリスト B-4）

**`M31-04` が定めた性質は「常時除外はトグルの効き目ではないので数えない」である**（`CHANGE-176` §2.5）。この性質を保つために、`surfacedIds` の **走査対象を `moves` から `selectableMoves` へ移した**。

- **★数え方の方針は変えていない。** `drive_reversal` はどのタブにも載らない code だったため、旧実装（`moves` を走査）でも **偶然** 0 件しか差が出ていなかった。
- **★`setup_only` は掲載される形に立ちうる**（例: `category='special'`）。**⇒ 旧実装のままだと数え過ぎる。** 破壊確認で実測した（§4.4 の (3)＝`expected 3 to be 2`）。
- 既存テストの期待値 `omittedCount === 2` は **変わっていない**（対照として残してある）。
- 母集団（`isControllerSurfaced` の第 2 引数）には `moves` をそのまま渡している —— `isOnUniqueTab` のラッシュ元引きや `normalTabMoveIds` の解決は **掲載可否の判定材料**であって、省く対象ではないためである。

---

## 3. ★★★指示書の前提が 2 つ変わった（実測）

### 3.1 §2.2-5 の条件分岐は成立しない ⇒ **バックエンドの差分は 0 本**

指示書 §0.6 の見込みどおりで、**実物でも確かめた**。

| 何が | どこに | 状態 |
|---|---|---|
| `MoveResponse.SetupOnly` | `internal/api/move/dto.go:25` | **在る**（`omitempty` 無し＝常時出力。`handler_test.go:114,204` が固定） |
| `MoveDetailResponse.SetupOnly` | `internal/api/move/dto.go:91` | 在る |
| `model.Move.SetupOnly` | `internal/model/move.go` | 在る |
| `MoveListItem.SetupOnly` | `internal/repository/move/repository.go:50` | 在る |
| SELECT 列 | `internal/repository/move/queries.go:21,43` | 両方に在る |
| TS `Move.setupOnly` / `MoveDetail.setupOnly` | `web/src/features/moves/types.ts:40,98` | **在る** |

**⇒ DTO の同期追加は要らなかった。`internal/repository/move/divergence_test.go` も触っていない**（同テストは `MoveListItem` のフィールドが `model.Move` に同名・同型で在ることだけを見る構造検査であり、**値を読む・読まないでは動かない**）。

**⇒ TS 型の追加も 0 件である。⇒ `ComboSummary` / `ComboDetail` / `Combo` の 3 分岐**（`web/CLAUDE.md` §2）**へ足すものは無い** —— 本サブが見るのは `Move` であってコンボ型ではない。

### 3.2 ★★★§2.2-1「これだけで 8 タブに効くはず」は**効かなかった**

指示書は「`isInputExcluded()` の判定に `setup_only` を足す。⇒ これだけで仮想コントローラ 8 タブと全技一覧プルダウンの両方に効くはずである。★実物で確かめること」と書いている。**確かめた。効かない。**

**着手時点の実測**:

| 面 | `isInputExcluded` を通るか |
|---|---|
| 全技一覧プルダウン | **通る**（`useControllerInputOmission` の `selectableMoves`） |
| 未分類タブ | **通る**（`surfaceBuckets` の `unclassified` 分岐） |
| 特殊技 ／ SA ／ ターゲットコンボ ／ 共通技 ／ キャラ固有状態の 5 タブ | **★通らない**（各バケットは `isInputExcluded` を呼んでいない） |
| 通常技タブ | **★通らない。★そもそもバケットを持たない** —— `HitBoxLayout` が押下のたびに `resolveDirectionalInput` で解決する |
| 必殺技タブ | **★通らない。★同じくバケットを持たない** —— `SpecialMovePanel` が `deriveSpecialFamilies(moves)` を呼ぶ |

**★これは `moveSurfacing.ts:111-114` の逐語注記が予告していた状態そのものである** —— 「載る形の code を足すと、未分類とプルダウンからは消えるのにタブには出続ける。型検査もテストも緑のままである」。

**★★`M31-04` で表面化しなかった理由**: `drive_reversal` は `category='system'` で、**どのタブにも載らない code だった**。**⇒ `setup_only` は任意の category に立ちうる。確実に踏む。**

### 3.3 採った解き方 ——「押し下げ」ではなく「引き上げ」

旧注記は「効かせるなら各バケットの push 直前へ足す」と書いていた。**⇒ 採らなかった。** 押し下げると判定が 7 か所へ散り、**通常技タブと必殺技タブには依然として効かない**（バケットを持たないため）。

代わりに **`surfaceBuckets` の先頭で 1 回だけ母集団を絞り**、その `inputMoves` を返り値へ足して、バケットを持たない 2 タブへも配った。

```
const inputMoves = moves.filter((m) => !isInputExcluded(m, context));
```

- **★判定は依然 `isInputExcluded` の 1 本しかない。⇒ 2 本目を作っていない**（`D-810`）。
- **★`isControllerSurfaced` の中へは入れていない。** 同関数の本体は **1 行も動いていない** —— 旧注記が禁じた「除外＝掲載済みと読み替わる」退行は起きない。
- **★`CHANGE-176` §2.5 の等式「未分類 ＝ 裏返し ∧ 非除外」は変わっていない。** `∧ 非除外` の **位置が**、`unclassified` 分岐から母集団の側へ **移っただけ**である。

**★★副次的に `drive_reversal` の適用範囲も広がった**（未分類だけ → 全タブ）。**観測上の振る舞いは変わらない** —— どのタブにも載らない code だからである（§4.3 の対照テストで固定した）。**★これは旧注記が「2 件目を足すときに見ること」と警告していた穴を、先に塞いだ形である。**

---

## 4. 段 3: 陽性対照（完了条件 4 / 5・チェックリスト D-3）

### 4.1 なぜ要るか

**実 DB の `moves.setup_only = 1` は 0 件である**（`M31-RESEARCH-01` 実測）。**⇒ 経路が 1 行も効いていなくても、`go test` も `pnpm test` も `make e2e` も全部緑になる**（指示書 §4.4）。**「入れた」は「効く」の証拠にならない。**

**⇒ テストの中だけで `setup_only = 1` を 1 群でっち上げた。`migrations/` へは 1 行も入れていない**（指示書 §2.3-3）。

### 4.2 でっち上げた形（★タブに載る形を一通り）

| 形 | code | 出る先 |
|---|---|---|
| `normal` | `crouching_light_kick` | 通常技タブ（押下時解決） |
| `unique` | `su_shoulder` | 特殊技タブ |
| `special` | `su_trap_light` | 必殺技タブ（ファミリー UI） |
| `super_art` | `su_sa3` | SA タブ |
| `target_combo` | `su_tc` | ターゲットコンボタブ |
| 共通技 code | `dash_forward` | 共通技タブ |
| どこにも載らない | `su_orphan_throw` | 未分類タブ |
| 状態語を含む | `flame_su_kachousen` | キャラ固有状態タブ |

**★「未分類に落ちる形」だけを試してはいけない。** それだけだと、タブ側に効いていない実装でも緑になる。

### 4.3 測ったこと

| # | 何を | どこ |
|---|---|---|
| 1 | コンボ側: **全バケット ＋ 母集団 `inputMoves` のどこにも出ない** | `moveSurfacing.test.ts` |
| 2 | **★陽性対照**: 同じ入力で `context="setup"` を渡すと **該当タブに出る** | 同上 |
| 3 | 通常技タブ（バケット無し）: `normalTabMoveIds` に **コンボ側では入らず、セットプレイ側では入る** | 同上 |
| 4 | 必殺技タブ（バケット無し）: `deriveSpecialFamilies` の family に **コンボ側では立たず、セットプレイ側では立つ** | 同上 |
| 5 | キャラ固有状態タブでも同じ対 | 同上 |
| 6 | **`drive_reversal` は両面で外れたまま**（完了条件 7・チェックリスト C-3） | 同上 |
| 7 | **`setup_only` が 0 件なら、面ごとの中身は両面で完全に同じ** ＝ 実 DB の状態の実測 | 同上 |
| 8 | プルダウン: トグル **ON でも OFF でも**落ちる（チェックリスト D-2） | `useControllerInputOmission.test.ts` |
| 9 | **掲載される形でも `omittedCount` が増えない**（B-4） | 同上 |
| 10 | **既存ステップが技名で表示され、1 行プレビューにも出る**（完了条件 5・C-4） | `RecipeBuilder.test.tsx` |
| 11 | **その同じ技が全技プルダウンからは外れている**（10 と対にした対照） | 同上 |
| **★12** | **【Phase C 追補】仮想コントローラの実描画で、通常技タブのボタンが `disabled` になる ／ 必殺技タブからファミリーごと消える ／ 特殊技タブ・未分類タブにも出ない**（コンボ側）。**同じ入力で `context="setup"` なら 3 つとも出る** | `VirtualController.test.tsx` |
| **★13** | **【Phase C 追補】`drive_reversal` は `combo` / `setup` どちらの面でも未分類タブに出ない** | 同上 |
| **★14** | **【Phase C 追補】`SetupRecipeEditor` が `VirtualController` へ `context="setup"` を渡している** | `SetupRecipeEditor.test.tsx` |

### 4.4 ★★★破壊確認（3 通り。いずれも赤になることを実測）

**★「テストを書いた」は「テストが効く」の証拠にならない**（`M35-01` の教訓と同じ族）。**⇒ 実装を 3 通りに壊して、当該テストが赤になることを確かめた。**

| # | 壊し方 | 結果 |
|---|---|---|
| **(1)** | `isInputExcluded` の理由2 を `return false` に殺す | **6 本赤**（判定 ／ 全バケット ／ 通常技タブ ／ 必殺技タブ ／ 固有状態タブ ／ 既存技の不動） |
| **(2)** | `surfaceBuckets` を**旧構造**（母集団を絞らず `unclassified` 分岐の中だけで落とす＝**指示書 §2.2-1 の想定そのもの**）へ戻す | **6 本赤。★これが §3.2 の実測の裏取りである** —— 拡張だけでは 8 タブに効かないことを、テストが独立に示している |
| **(3)** | `omittedCount` の走査を `selectableMoves` から `moves` へ戻す | **1 本赤**（`AssertionError: expected 3 to be 2`） |
| **(4)** | **【Phase C 追加】**`useControllerInputOmission` の**母集団**を `selectableMoves` から生の `moves` へ戻す | **1 本赤**（`combo 面: expected [ 'standing_light_punch' ] to deeply equal []`）。**⇒ レビュー 高-2 が予測した崩れ方そのものである** |
| **(5)** | **【Phase C 追加】**`SetupRecipeEditor` の面を `"setup"` から `"combo"` へ**倒す** | **1 本赤**（プルダウンに「弱トラップ」が出ない）。**★着手時点ではこれが緑で通っていた**＝チェックリスト C-2 の床が欠けていた |
| **(6)** | **【Phase C 追補】**`VirtualController.tsx` の `<HitBoxLayout moves={inputMoves}>` を生の `moves` へ戻す | **1 本赤**（通常技タブのボタンが `disabled` にならない） |
| **(7)** | **【Phase C 追補】**`<SpecialMovePanel moves={inputMoves}>` を生の `moves` へ戻す | **1 本赤**（必殺技タブにファミリーが出る） |
| **(8)** | **【Phase C 追補】**`SetupRecipeEditor.tsx` の `context="setup"` を `"combo"` へ倒す | **1 本赤**（`expected 'combo' to be 'setup'`） |

**★いずれも確認後にただちに復元し、`git diff --stat` が空であることを確かめてから次へ進んだ。**

**★(1) と (2) で `drive_reversal` の 2 本と「セットプレイ側に出る」系が緑のまま残ったのは正しい** —— それらは理由2 に依存しない主張だからである。**⇒ 対照が対照として効いていることの確認でもある。**

### 4.5 ★★【Phase C 追補】「配線」を塞いだ（開発者の問い合わせを受けて・2026-09-12）

**★開発者の問い＝「手動確認は飛ばしてよいか。`go test` 等で担保されていると認識してよいか」。⇒ 切り分けたところ、1 か所だけ穴が在った。**

**★★ロジックは測ってあったが、「どの配列をどのタブへ渡しているか」を測っていなかった。** 実データの `setup_only` が 0 件のあいだは `inputMoves === moves` なので、**配線を生の `moves` へ戻しても全テストが緑のまま通る状態だった。**

| # | 箇所 | 戻すと何が起きるか | 着手前に捕まえるテスト |
|---|---|---|---|
| **(a)** | `VirtualController.tsx` の `<HitBoxLayout moves={inputMoves}>` | **通常技タブから `setup_only` の技が再び押せる** | **無かった** |
| **(b)** | 同 `<SpecialMovePanel moves={inputMoves}>` | **必殺技タブにファミリーが再び出る** | **無かった** |
| **(c)** | `SetupRecipeEditor.tsx` の `context="setup"` | **セットプレイ側のタブから消える**（本サブ最大の事故の形） | **無かった**——同ファイルのテストは `VirtualController` を**モックしている**ため、`context` が何で渡っているかを見ていなかった |

**★★★これは完了条件そのものである。** 完了条件 2「コンボの仮想コントローラ（未分類を含む）と全技一覧の 2 面から外れる」／ 完了条件 3「セットプレイのレシピ入力では出る」は**タブの面を名指ししている**が、着手時点では `surfaceBuckets` の**出力**までしか測っていなかった。

**⇒ 塞いだ。** `VirtualController.test.tsx` は**実コンポーネントを描画し `context` を prop で渡せる**ため、(a)(b)(c) のうち (a)(b) と「面が効くこと」を 1 本の describe でまとめて測れる。(c) は `SetupRecipeEditor.test.tsx` のモックが受け取った props を記録して主張した（**★モックは外していない**——外すと同ファイルの既存 14 本の前提が変わる）。

**★破壊確認 3 通り（§4.4 の (6)(7)(8)）で、いずれも当該テストが赤になることを実測した。**

> **★★教訓として残す価値がある形である**——**「述語のテスト」と「配線のテスト」は別物であり、データが 0 件だと後者だけが静かに抜ける。** 横断課題 (3)〔型の床は「渡し忘れ」しか止めず「倒す」は止めない〕と同じ族だが、**あちらは値の取り違え、こちらは*どの配列を渡すか*である。**

---

## 5. 検査結果

| # | 検査 | 結果 |
|---|---|---|
| 1 | `go test ./...` | **緑**（FAIL 0） |
| 2 | `cd web && pnpm test` | **緑。2764 passed / 225 files**（着手時 2733 → **＋31 本**が本サブの追加。**★Phase C でレビュー指摘に応えて 4 本、★さらに配線の床として 9 本足した**＝§4.5） |
| 3 | `cd web && pnpm exec tsc --noEmit -p tsconfig.json` | **exit 0** |
| 4 | `cd web && pnpm lint` | **exit 0** |
| 5 | **`make e2e`（全数）** | **緑。★最終走行＝299 passed / flaky 0 / failed 0**（5.3 分・exit 0。Phase C 追補後）。**★Phase C 時点の記録＝298 passed / 1 flaky / 0 failed**（5.2 分。flaky は既知の `m31-02-tag-field-drag`＝§5.1。**★追補後の走行では再現しなかった**）。★チェックリスト E-4 の要求どおり絞り込みではなく全数で回した |
| 6 | `bash scripts/check-artifact-integrity.sh`（**1 本目**） | **違反なし**（検査 15 件 ／ 生成物 4 件） |
| 7 | `bash scripts/check-import-order.sh` | **違反なし**（現在 99 ／ ベースライン 101。**★下げていない**＝`D-388`。§6-4 参照） |
| 8 | `bash scripts/check-enum-sync.sh` | **ベースラインどおり（増加なし）** |
| 9 | `bash scripts/check-browser-storage-keys.sh` | **違反なし**（新しいキーを使っていない） |
| 10 | `bash scripts/check-doc-refs.sh` | **dead reference なし** |
| 11 | `bash scripts/check-md-emphasis.sh docs/progress/M31-06-completion-report.md` | **§7 に実測を記す** |
| 12 | `bash scripts/check-progress-log-index.sh` | **§7 に実測を記す**（Phase D の追記後に回す） |

### 5.1 `make e2e` の flaky 1 件について

**`m31-02-tag-field-drag.spec.ts:49`「下へ枠外までドラッグしても文字選択が消えない」**。リトライで緑。

- **★「flake」で片付けていない。** 単独実行で **6 passed** を確認した（`make e2e-only P=m31-02-tag-field-drag`）。
- **★本サブ由来ではない。** 本サブの差分に `TagSelector` / `web/src/lib/text-drag-capture.ts` / `SearchableSelect` は **1 ファイルも含まれない**。
- **★既知の不安定さである。** `M30-02` 完了報告 §6-10 が「全数実行のときだけ起こる」ことを実測付きで記録しており、`M31-05` と `M35-01` も独立に同じ spec の flaky を報告している。**⇒ 本サブが新しく作ったものではない。**

### 5.2 実 DB の面ごとの件数は 1 つも動いていない（完了条件 6）

| 根拠 | 中身 |
|---|---|
| **`moveSurfacing.roster.test.ts` を 1 行も触らずに緑** | 実 seed CSV 31 本・2743 行を母集団に、未分類 **38 件** ／ 特殊技 **1024 件** ／ ターゲットコンボ **126 件** ／ 共通技 **13** ／ キャラ別未分類の表を固定している。**★CSV に `setup_only` 列は無く `loadCharacter` が `setupOnly: false` を入れる。⇒ 全件が非除外である** |
| **`make e2e` 全数が緑**（実 DB） | `m30-01-controller-surfacing.spec.ts` がタブ **8 枚** ／ 共通技 **13** ／ キャラ固有状態 **35** ／ キャラ別の未分類件数〔jamie 2 ／ mai 1 ／ blanka 2 ／ manon 0 ／ cammy 1 ／ m_bison 0〕 ／ プルダウンの技名を固定している |
| **単体の対照** | 「`setup_only` が 0 件なら両面の中身が完全に一致する」を `moveSurfacing.test.ts` で固定した（§4.3 の 7） |

**★上記はいずれも「実測」である**（算出ではない）。**⇒ 実行して出力で判定した**（計測点 `M-157`）。

---

## 6. ■ 併せて更新が要るもの

| # | 何を | 状態 |
|---|---|---|
| **1** | **CHANGE 番号の消費** | **★本サブでは 0 本。起票は設計卓である**（`D-293`＝製造は自採番しない）。**⇒ 下記 §6.1 に請求を書いた。★したがって `docs/handover/change-number-registry.md` §1 ／ 契約 §4 ／ ボード §2.1 ／ §2.4 の 4 か所は本サブでは 1 つも動かない** |
| **2** | **マイグレ連番の消費** | **なし**（0 本）。`ls migrations/` の実査値とボード §2.2 の「次に払い出す番号」は動いていない |
| **3** | **版を上げた文書の参照元** | **なし**（設計書・指示書の版を上げていない） |
| **4** | **`check-import-order.sh` のベースライン** | **★本サブ由来ではない。** 現在 99 ／ ベースライン 101 で、スクリプト自身が「99 へ下げること」と出す。**★下げていない**（`D-388`＝レーンごとに下げない）。**★`M35-02` / `M31-04` / `M35-03` が既に 3 回申し送っており、本サブで 4 回目である。⇒ §J へ既存行が在る**（`import-order-baseline-101-vs-99`） |
| **5** | **`web/CLAUDE.md` §1 のブラウザストレージ台帳** | **なし**（新しいキーを使っていない） |

### 6.1 設計卓へ請求する CHANGE（★製造は起票しない）

| # | 何を | なぜ |
|---|---|---|
| **1** | **`DES-003` §3.3 の `moves.setup_only`** | **★「予約列」ではなくなった。** 本サブで実際に読まれ始めた。**⇒ as-built へ寄せる**（外す面は 2 面 ／ 表示面では出す ／ 付与口はフェーズ5） |
| **2** | **`DES-005` の入力面の規則**（§5.7 コンボ登録 ／ §5.9 セットプレイ登録・編集） | **★「同じ仮想コントローラを使う」という記述が、初めて面で分岐した。** §5.9 の「レシピ入力領域（コンボ登録と同じ仮想コントローラ使用）」は **`setup_only` について偽になった** |
| **3** | **`CHANGE-176` §2.5 の等式の as-built 追補** | **★等式「未分類 ＝ 裏返し ∧ 非除外」は変わっていない。★変わったのは `∧ 非除外` の位置**（`unclassified` 分岐 → 母集団）**と、その `非除外` が面を持つようになったこと**である |
| **★4** | **`DES-005` §6 の実体表**（`:2009-2014`。**レビュー 高-3 で追加**） | **★★同表の 1 行目「仮想コントローラのタブ ＝ `surfaceBuckets` の `unclassified` 分岐」が偽になった。⇒ 適用点は `unclassified` 分岐ではなく母集団である。★2 行目**（プルダウン ＝ `selectableMoves`）**は真のままである。** **★★★§5.7 / §5.9 だけを直すと、この表の旧記述が残る** —— **旧注記「効かせるなら各バケットの push 直前へ足す」を次のサブが前提として複製する形が、まさにこの表の下に在る** |

### 6.2 設計卓が畳む followup（★製造は §J 以外を編集できない＝`D-382`）

| 行 | 状態 |
|---|---|
| **`input-excluded-codes-vs-setup-only-overlap`** | **★本サブで解けた。** 「対処済み・着地待ち」で担当欄が `M31-06` になっている。**⇒ 畳んでよい。** 適用点は 1 つ（`isInputExcluded`）で、理由が 2 つに分かれた形で着地した |
| **`setup-only-flag-has-no-data`** | **★半分だけ解けた。** 「`internal/model/move.go` の『予約列』コメントの是正が要る」は **本サブで済ませた**。**★残るのは (1) どの `move_code` に立てるか (2) 誰がどの経路で立てるか の 2 つで、いずれもフェーズ5 である**（指示書 §3-1 / §3-2） |

### 6.3 設計卓へ請求する新規 followup（★製造は本書を編集しない）

**★★置き場について**: レビューは「§J へ 1 行」を提案したが、**§J は停止時記録の面であり改善候補の置き場ではない**（`M30-04` で同じ提案が出て、製造がレポート §4 経由へ回した先例が在る）。**★本サブに停止時記録は 1 件も無い**（未解消 0 件 ／ 再レビュー往復 0 回）。**★★さらに `D-828`**（2026-09-12）**が、設計卓が同ファイルを大きく編集中のときに製造がブランチ内で §J を編集し、開発者に差し戻された事例を記録している。⇒ 本サブは `followup-backlog.md` を 1 文字も編集していない。**

| # | スラッグ案 | 内容 | 割付 |
|---|---|---|---|
| **1** | **`surface-buckets-context-default-is-provisional`** | **★`surfaceBuckets` の第 4 引数 `context` の既定値 `"combo"` は暫定である**（共有テスト `moveSurfacing.roster.test.ts` の 6 か所を `M30-05` と奪い合わないための措置＝§10-3）**。⇒ `M30-05` のマージ後に既定を外し、必須にする手番が要る。★放置すると「既定へ落ちた面で `setup_only` が静かに消える」入口が残る** | **改善レーン**（`M30-05` マージ後） |
| **2** | **`setup-only-exclusion-repoints-stage2-resolution`** | **★★母集団を絞ったことの副作用①。⇒ 除外はボタンを無効化せず、同じボタンの解決先を差し替える** —— 段階2 の解決表 `entries` が `setup_only` の技を指していると、コンボ側は母集団に居ないため段階1 へフォールバックし、**別の通常技**が解決される。**★フェーズ5 でフラグを立てた瞬間に入力の意味が変わる面である。⇒ 付与口の設計者が知っていなければならない** | **フェーズ5**（付与口の設計） |
| **3** | **`setup-only-flag-granularity-splits-special-families`** | **★★母集団を絞ったことの副作用②。⇒ 除外の単位は「行」であって「ファミリー」ではない。** `deriveSpecialFamilies` の段 2 は `hasFamily`（絞った母集団に基底ファミリーが在るか）で変種を畳むため、**親の行だけに `setup_only` が立ち変種の行に立っていない組では、変種が独立ファミリーとして立つ**。**★`M30-02` が解消した「素は押せるが OD が押せない」7 組と同型の非対称が、フェーズ5 のフラグ付与で作られうる。⇒ 「どの粒度でフラグを立てるか」の設計制約である** | **フェーズ5**（付与口の設計） |

**★2 と 3 は本サブの射程内では直せない**（データが 0 件のため観測もできない）。**⇒ 設計伝達レポート §4 で設計卓へ回す。**

---

## 7. 完了時の自己検査（★Phase D 後に実行した実測）

| 検査 | 実測 |
|------|------|
| `bash scripts/check-md-emphasis.sh docs/progress/M31-06-completion-report.md` | **検出 0 行** |
| `bash scripts/check-md-emphasis.sh docs/progress/m31-06-review.md` | **検出 0 行**（レビュー担当も自分で回して 0 行を確認済み） |
| `bash scripts/check-progress-log-index.sh` | **`m31-06` は解消。★残る NG 1 件（`m26-04`）は本サブ由来ではない既存欠落である** |
| `bash scripts/check-stop-discipline.sh` | **違反なし** |

**★`docs/progress/progress-log.md` は渡していない**（継続更新ファイルであり、歴史記録としての既存の検出行を持つ＝`D-274` (3)）。**⇒ 渡したのはこの手番で作った 2 本だけである。**

**★★この手番で `docs/progress/` へ新規に作ったファイルは 2 本のみ**（完了報告 ／ レビュー報告書）。**どちらも作成前に同名の不在を確認している**（`E-225`）。

---

## 7.1 Phase D: `progress-log.md` への索引行

**★追記済み**（`CLAUDE.md` §8）。**追記のみで既存の過去節は 1 文字も編集していない。** 横断課題として 8 件を残した —— とくに (1)〔指示書 §2.2-1 の前提が崩れたこと〕・(3)〔型の床は「倒す」を止めないこと〕・(5)〔フェーズ5 の付与粒度の設計制約 2 件〕は、**本サブの中で閉じず下流へ波及する。**

---

## 7.2 ★★実機確認の手順（**未了。★フェーズ5 では必須になる**）

**★前提＝`setup_only` には付与口が 1 つも無い**（`UpdateMoveRequest` に項目なし ／ `character_data/*.csv` に列なし）**。⇒ 手で DB に立てるしかない。★実 dev DB**（`~/.local/share/tacpendium/tacpendium.db`）**は触らないこと。**

**★既存の道具をそのまま使う** —— `scripts/dev-throwaway-db.sh`（ガイド＝`scripts/dev-throwaway-db-guide.md`）が**まさにこの用途のために在る**。リポジトリ直下の使い捨て DB を `TACPENDIUM_DB_PATH` で指し、**実 dev DB には一切触れない**。`*.db` は `.gitignore` 済み。**★seed はマイグレの中に在る**ので、新規ファイルでも 31 キャラ・約 3026 技が入る。

```bash
# 1) 使い捨て DB でバックエンドを起動（マイグレ + seed が適用される）
scripts/dev-throwaway-db.sh scratch-m31-06.db --fresh
#    起動を確認したら Ctrl-C でいったん止める
#    ★ポートは既定のまま（同スクリプトは TACPENDIUM_PORT を設定しない）。
#      バックエンドが採用ポートを config.toml へ書き、Vite dev proxy が自動追従する。

# 2) ★サーバを止めた状態でフラグを立てる（WAL の巻き添えを避けるため必ず停止中に）
#    ★sqlite3 CLI は devContainer に無い。python3 の stdlib を使う。
python3 - <<'PY'
import sqlite3
SQL = (
    "UPDATE moves SET setup_only = 1 "
    " WHERE character_id = (SELECT id FROM characters WHERE code='ryu') "
    "   AND code IN ('whirlwind_kick', "
    "                'high_blade_kick_light','high_blade_kick_medium', "
    "                'high_blade_kick_heavy','high_blade_kick_od')"
)
db = sqlite3.connect("scratch-m31-06.db")
db.execute(SQL)
db.commit()
print(db.execute("SELECT code FROM moves WHERE setup_only=1").fetchall())
PY

# 3) 再起動してフロントを立てる
scripts/dev-throwaway-db.sh scratch-m31-06.db     # 別ターミナル
cd web && pnpm run dev                            # → http://localhost:5173/

# 4) 後片付け
rm -f scratch-m31-06.db scratch-m31-06.db-wal scratch-m31-06.db-shm
```

### 対象に ryu の 5 件を選んだ理由

| code | category | なぜ |
|---|---|---|
| `whirlwind_kick` | `unique` | **特殊技タブに直接ボタンとして並ぶ。★ryu の `unique` はちょうど 5 件**〔`collarbone_breaker` / `solar_plexus_strike` / `short_uppercut` / `axe_kick` / `whirlwind_kick`〕**なので、5 → 4 個への減り方が目で数えられる** |
| `high_blade_kick_{light,medium,heavy,od}` | `special` | **4 行で 1 ファミリーである。★4 行すべてに立てるとファミリーのボタンごと消える**（1 行だけだと強度ボタン 1 つが不活性になるだけで分かりにくい） |

**★`normal` / `system` の code は選ばないこと** —— 通常技タブは解決表経由であり、`drive_reversal` 系は静的除外（`INPUT_EXCLUDED_MOVE_CODES`）に既に入っているため、結果が交絡する。

### 見るところ（★4 点。すべて同じ使い捨て DB で続けて見る）

| # | 画面 | 期待 |
|---|---|---|
| **1** | **`/combos/new`**（コンボ登録） | 特殊技タブ `recipe-tab-unique` が **5 → 4 個**（`recipe-direct-whirlwind_kick` が消える）／ 必殺技タブ `recipe-tab-special` から `recipe-special-family-high_blade_kick` が消える ／ **未分類タブ `recipe-tab-unclassified` にも出ない** ／ `recipe-pulldown-toggle` を開いた `recipe-move-select` に「旋風脚」「高空刃脚」系が無い（**`recipe-omit-surfaced-toggle` は ON / OFF どちらでも**） |
| **2** | **`/combos/:id/setups/new`**（セットプレイのレシピ入力） | **★同じ技がすべて出る。⇒ ここが本サブの核心である** |
| **3** | **`/combos` と `/combos/:id`**（一覧・詳細） | **★その技を使った既存コンボが、これまでどおり技名で読める**（`recipe_cache` 由来のサーバ文字列なので変わらないはず） |
| **4** | **`/combos/:id/edit`**（既存レシピの再編集） | **★ステップが技名で出て編集できる**（`#<id>` へ退行していない） |

**★★1 と 2 を同じキャラ・同じ技で続けて見ること。** 片方だけ見ると「元から居なかった」と区別できない（テスト側の陽性対照と同じ理由＝チェックリスト D-3）。

**★★この手順は「効き目の確認」であって投入の可否判定ではない。** 本サブが足したテスト **31 本**（うち大半が「コンボ側で消える」と「セットプレイ側に残る」を対にした陽性対照）と**破壊確認 8 通り**で機械的に固めてあり、**★Phase C 追補で「どの配列をどのタブへ渡しているか」という配線まで塞いだ**（§4.5）**。⇒ 本サブの投入判断としては不要である。**

**★★★ただしフェーズ5**（どの `move_code` に立てるかを決める手番）**では必須になる。** 理由は 2 つ——**(1) 本サブの検査はすべて合成 fixture であり、実 DB の実データで見た者がまだ 1 人も居ない。(2) フラグを立てる手番では「入力の解決先が別の技へ付け替わる」「ファミリーの畳み方が変わる」という副作用**（§6.3-2 / §6.3-3）**が実際に起きうるが、それは*どの技に立てるか*が決まって初めて観測できる。**

---

## 8. レビュー結果と取り込み（自動トリアージ）

| 項目 | 内容 |
|------|------|
| レビュー報告書 | `docs/progress/m31-06-review.md`（fresh subagent＝メイン会話文脈を継承しない独立レビュー） |
| 指摘件数 | **11 件**（高 4 ／ 中 3 ／ 低 4） |
| **「高」指摘の不採用** | **★0 件**（4 件すべて採用・修正済み） |
| 不採用 | **1 件のみ**（低-11＝`import-order` ベースライン。理由は下表） |
| 再レビュー往復の回数 | **0 回**（初回レビューのみ。停止規律の上限 2 回に達していない） |
| 未解消のまま停止した項目 | **★なし。⇒ `followup-backlog.md` §J への停止時記録は発生していない** |

### 8.1 各指摘の採否と理由

| # | 優先度 | 指摘 | 採否 | 対応 ／ 理由 |
|---|---|---|---|---|
| 高-1 | 高 | `RecipeInputContext` の doc が「既定値を置いていない」と断定しているのに、同ファイルの `surfaceBuckets` が既定 `"combo"` を持つ（失効記述） | **採用** | 指摘のとおりで、**自分が書いた注記が自分の実装と矛盾していた**。doc を実物に合わせ、既定を持つのは `surfaceBuckets` だけであること・それが `M30-05` との衝突回避の暫定であること・本番の呼び元は必ず明示することを書いた。**解除の手番は §6.3-1 で設計卓へ請求** |
| 高-2 | 高 | `isControllerSurfaced` の母集団が `surfaceBuckets`（`inputMoves`）と `useControllerInputOmission`（生の `moves`）で食い違い、フェーズ5 で「未分類タブ ＝ トグル ON で残る集合」が静かに崩れる | **採用** | **★指摘が正しい。** フックの母集団と `normalTabMoveIds` の入力を `selectableMoves` へ揃えた。**★あわせて等式を固定するテストを 1 本足した** —— 段階2 の解決表が `setup_only` の技を指す fixture で、**両面の未分類が実際に食い違う**ことを前提確認として測ってから等式を主張する形にした。**★破壊確認 (4) で赤になることを確認済み** |
| 高-2 派生 | 高 | セットプレイ側の配線に床が無く、`"setup"` を `"combo"` へ倒しても全検査が緑 | **採用** | `SetupRecipeEditor.test.tsx` へ床を 1 本足した。**★実際に倒して赤になることを確認済み**（破壊確認 (5)）。**あわせて §2.4 の床の記述を「フック層に限る」旨へ改めた** —— 元の書き方は**画面配線層にも当てはまるかのように読めた** |
| 高-3 | 高 | `DES-005` §6 の実体表が as-built と食い違うのに CHANGE 請求が届いていない | **採用** | §6.1 の請求表へ 4 件目として足した。**★実物を確認した**（`docs/design/05-screen-design.md:2009-2014`） |
| 中-1 | 中 | 「一覧・詳細・比較は `moves` を 1 度も引かない」は不正確（`ComboListFilters.tsx:155`） | **採用** | 実測で確認し、§9.1 の根拠を「構造上届かない」から「絞り込みの適用点が 2 か所しかなく、一覧側はそのどちらも呼んでいない」へ改めた。**★挙動は無傷のままである。直したのは根拠の書き方である** |
| 中-2 | 中 | 母集団を絞ったことの副作用 2 件（入力の付け替え ／ ファミリーの畳み方）が未記録 | **採用** | §6.3-2 / §6.3-3 として設計卓へ請求した。**★どちらも本サブの射程内では直せない**（データが 0 件で観測もできない）**が、フェーズ5 の付与粒度の設計制約になる** |
| 中-3 | 中 | 完了条件 9（progress-log 索引行）と 11（設計伝達レポート）が未了 | **採用** | 索引行は Phase D で追記した（§7）。**★設計伝達レポートは別の手番である** —— §12 に状態を明記した。**A-3 逸脱の記載を同レポートへ出すことの指摘も受け入れ、§12 に申し送りとして残した** |
| 低-1 | 低 | §10-3 の「7 か所」が実測 6 か所と合わない | **採用** | 実測して 6 か所へ是正し、行番号も添えた |
| 低-2 | 低 | `internal/model/move.go` の 1 文が単独では「一覧にも出ない」と誤読される | **採用** | 「**入力面としては**」を補い、直後に「『一覧にも出ない』ではない」の 1 行を足した |
| 低-3 | 低 | 「両面で完全に同じ」のテストが 2 バケットしか比べていない | **採用** | 7 つ（`inputMoves` ＋ 6 バケット）すべてを比べる形へ広げた |
| 低-11 | 低 | `import-order` のベースライン 101 → 99 を可視化 | **★不採用** | **★本サブ由来ではない**（`M35-02` / `M31-04` / `M35-03` が既に 3 回申し送っている共有スクリプトの話である）。**★`D-388` がレーンごとに下げることを禁じており、本サブで下げるのは規律違反にあたる。** **★§J に既存行 `import-order-baseline-101-vs-99` が在り、改善レーンの手番として登録済みである。⇒ 本サブから足すものが無い**（レビュー自身も「既存の §J 行のままでよい」と書いている） |

### 8.2 ★製造が指摘の置き場だけ変えた 1 件（★内容は採用している）

**レビューは 高-1 と 中-2 について「`followup-backlog.md` §J へ 1 行残すこと」を推奨した。⇒ 内容は採用したが、置き場は §6.3（設計卓への請求）にした。**

理由は 3 つで、いずれも本プロジェクトの既存ルールである。

1. **§J は停止時記録の面であり、改善候補の置き場ではない。** `M30-04` で**同じ提案が出て、製造がレポート §4 経由へ回した先例**が在る（同レポート §4-5 の欄外に経緯が書かれている）。
2. **本サブに停止時記録は 1 件も無い**（未解消 0 件 ／ 往復 0 回）。**⇒ §J へ書くべきものが無い。**
3. **★`D-828`（2026-09-12）**——**設計卓が `followup-backlog.md` を大きく編集中に製造がブランチ内で §J を編集し、開発者が差し戻して設計卓へ回した事例である。⇒ 同じ日に同じことをしない。**

**★★したがって本サブは `docs/handover/followup-backlog.md` を 1 文字も編集していない**（`D-382`）。

---

## 9. やらなかったこと（指示書 §3 の確認）

| # | 何を | 状態 |
|---|---|---|
| 1 | `setup_only` を立てる | **★どの `move_code` にも立てていない。** `migrations/` は 0 本。**実 DB は 0 件のまま** |
| 2 | 付与の口を作る（`PATCH` の項目 ／ CSV 列） | **★作っていない。** `UpdateMoveRequest` は触っていない |
| 3 | キャミィ 9 件の親の分けかた | **触っていない** |
| 4 | filler / target の提案候補を絞る | **★触っていない。** `internal/service/setplay/` に差分 0。**表示制御と提案候補制御は独立である** |
| 5 | `custom_states` との対応づけ | **触っていない**（キャラ固有状態タブは既存の判定軸をそのまま使った） |
| 6 | `M19-DESIGN-02` の残存案の整理 | **設計卓の手番。触っていない** |

### 9.1 ★意図的に外した面（★塞ぎ忘れではない）

| 面 | 扱い | 根拠 |
|---|---|---|
| **物理入力**（パッド ／ キーボード） | **★通す。** `usePhysicalRecipeInput` / `GamepadRecipeReadout` には生の `moves` を渡したまま | 指示書 §2.2-6「保存は禁止しない。⇒ 物理入力・取込・既存レシピは通す」／ チェックリスト C-5 |
| **引っ越し取込**（`IntakeHelperPage` ／ 逆引き） | **★通す。触っていない** | `M31-04` が「入力面」を 2 面と数えた際の開発者逐語＝「ユーザーがあり得ないコンボを入れたりとかは考えなくていい」 |
| **一覧 ／ 詳細 ／ 比較** | **★1 か所も触っていない** | `D-805`。**★レシピ本文は `moves` を引かない** —— `RecipeText` 経由でサーバ組み立て済みの `recipe_cache` 由来文字列を割るだけである。**★★ただし「一覧が `moves` を 1 度も引かない」は偽である**（レビュー 中-1 で是正）——**`ComboListFilters.tsx:155` が `useMovesByCharacter` を引いている**（始動技の絞り込みの選択肢）。**⇒ 正しい理由は「構造上届かない」ではなく「絞り込みの適用点は `surfaceBuckets` と `useControllerInputOmission` の 2 か所しかなく、一覧側はそのどちらも呼んでいない」である。★実測で確かめた** |
| **既存レシピの表示・再編集** | **★1 行も変えていない** | `movesById` / `formatRecipeLine` には生の `moves` が渡ったままである。§4.3 の 10 / 11 で固定した |

**★★次に触る人へ**: 上の 2 行は **「塞ぎ忘れ」ではなく対象外と決めた結果である**。**⇒ 「穴だ」と読んで勝手に塞がないこと。塞ぐなら判断のやり直しである。**

---

## 10. ★並列上の申し送り（指示書 §0.7・チェックリスト A-1 / A-2）

| # | 事項 | 実測 |
|---|---|---|
| **1** | **`web/src/features/combo/inputResolution.ts`（`M30-05` の持ち物）の差分** | **★0 行。** `git diff --stat aa0be70 HEAD -- <同ファイル>` が空である。**★`deriveSpecialFamilies` / `hasUniqueRushVariant` は引数を変えただけで、関数の中身は触っていない** |
| **2** | **共有テスト `web/src/features/combo/moveSurfacing.roster.test.ts`** | **★1 行も触っていない**（`git diff --name-only` にヒット 0）。**⇒ マージで片方の変更が黙って消える事故は起こらない** |
| **3** | **なぜ触らずに済んだか** | **★`surfaceBuckets` の第 4 引数 `context` にだけ既定値 `"combo"` を残したためである。** 同テストは `surfaceBuckets` を **6 か所**で呼ぶ（`:146` `:154` `:219` `:393` `:399` `:440`。**★レビュー 低-1 で「7 か所」から実測値へ是正**）。必須にするとその 6 か所を書き換える必要があり、`M30-05` と衝突する。**★本番の呼び元（`VirtualController`）は必ず明示して渡すので、既定に頼る経路は本番に存在しない** |
| **4** | **未分類の件数は動いていない** | **★指示書 §0.7 は「本サブは未分類の件数を動かすので、ほぼ確実に触る」と見込んでいた。⇒ 動かなかった。** 理由は §5.2 のとおり **CSV に `setup_only` 列が無く全件 `false` だから**である |
| **5** | **本サブが触って `M30-05` が触らないファイル** | `moveSurfacing.ts` ／ `VirtualController.tsx` ／ `useControllerInputOmission.ts` ／ `RecipeBuilder.tsx` ／ `SetupRecipeEditor.tsx` ／ `internal/model/move.go`。**★`VirtualController.tsx` は指示書 §0.7 の表に無かったが、`M30-05` の射程外である** |

---

## 11. 開発者へ確認し、決着した事項

| # | 事項 | 回答（2026-09-12） |
|---|---|---|
| **1** | **指示書 §7-1**。逐語の「おとび」を「および」と読み、外す面は 2 つ〔コンボ登録の仮想コントローラ ／ コンボ登録の全技一覧プルダウン〕でよいか | **★2 面でよい**（`D-807` / 計測点 `M-153` の是正どおり。3 つ目の面は無い） |
| **2** | **`internal/model/move.go` の「予約列」コメント**（本サブで失効する）を直すか、チェックリスト A-3「`divergence_test.go` 以外の Go 差分なし」を守るか | **★本サブで直す。⇒ A-3 からの意図的な逸脱である。Go の差分はこのコメント 1 か所（+15 / -1 行）に限った** |

**★推測で進めた箇所は無い。**

---

---

## 12. 未達の完了条件（★申し送り）

| # | 完了条件 | 状態 |
|---|---|---|
| **11** | **設計伝達レポートを出す**（`/design_handover_report`） | **★達成した**（2026-09-12）**＝`docs/handover/design-reports/20260912-m31-06-design-exceptions.md`。** 載せた 3 件＝(a) **`internal/model/move.go` の Go 差分がチェックリスト A-3 からの意図的逸脱であること**（同レポート **§2-2**。レビュー 中-3 への対応）／ (b) **CHANGE 請求 4 件**（同 §6）／ (c) **新規 followup 請求 3 件 ＋ 既存行の更新 3 件**（同 §4） |

**★完了条件 1〜11 はすべて達している。**

### 12.1 ★設計伝達レポートで、本報告より踏み込んだ点

**★★`DES-005` §6 の失効箇所は 1 つではなく 3 つだった**（同レポート §1-1 で実測）。本報告 §6.1 は「§6 の実体表」1 件として請求していたが、実物を当たると次の 3 か所である。

| 箇所 | 何が偽になったか |
|---|---|
| `:2009` / `:2013` | 「**2 面へ効く**」／ 表 1 行目の実体「`surfaceBuckets` の **`unclassified` 分岐**」 |
| **`:2155-2163`** | **8 タブの「母集団（述語の逐語）」表。** タブ 1 / 2 / 4 / 5 の **「（不変）」** と、タブ 6 の **「`isControllerSurfaced()` が false を返す行そのもの」**。⇒ **どのタブも「その述語 ∧ 非除外（面）」になった** |
| `:2020` | 「**現在の除外は 1 件だけである**（`drive_reversal`）。⇒ `setup_only` を同じ機構へ足すのは `M31-06` の射程である」 |

**★§7.2 の SQL は実行して確かめてある**（in-memory SQLite に同じ形のテーブルを作り、同じ文を流した）**＝5 行が立ち、別キャラの同名 `code`**（`cammy` の `whirlwind_kick`）**は立たず、`ryu` の非対象 2 件も立たない。⇒ キャラ絞りが効いている。**

---

*以上、M31-06 完了報告。*
