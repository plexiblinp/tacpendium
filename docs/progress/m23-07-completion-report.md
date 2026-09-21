# M23-07 完了報告: ゴミ箱の未達の導線（入口と出口をつなぐ）

| 項目 | 内容 |
|---|---|
| 対象指示書 | `docs/instructions/M23-07-trash-missing-paths.md` v1.0.0 |
| チェックリスト | `docs/instructions/reviews/M23-07-review-checklist.md` v1.0.0 |
| 実施日 | 2026-08-23 |
| ブランチ | `claude/m23-07-implementation-plan-1ms24w` |
| マイグレーション消費 | **0 本**（§4.6。スキーマ変更なし） |

> **本サブの成果**——**ゴミ箱は「入れる・見る・戻す・消す」がすべて画面から辿れるようになった。**
> **★とくに「画面操作だけでセットプレイをゴミ箱へ入れて戻す」は、`M23-02` 以来 1 度も通せなかった経路である。**

---

## 1. §3.3 着手前の実査 10 件（走査コマンドと件数付き）

### #1 ★★既存のコンボ詳細画面を「読み取り専用モード」で再利用できるか

**結論: ページ全体の再利用は不可。表示層 2 部品は再利用できる。★「全部作り直す」には当たらない**（§9.1-3 の停止条件に非該当）。

```bash
wc -l web/src/pages/ComboDetailPage.tsx                      # → 210 行
grep -rn "readOnly\|isReadOnly\|mode=" web/src/pages/ComboDetailPage.tsx \
  web/src/features/combo/components/ComboDetail*.tsx         # → 0 件
```

| 観点 | 実測 |
|---|---|
| 書き込み導線の散在 | **7 か所の JSX**（`:66-98` 操作バー ／ `:133-138` セットプレイ追加 ／ `:139-145` 既存から紐付け ／ `:152-160` アコーディオン ／ `:171-178` 候補 ／ `:181-186` 提案 ／ `:188-197` 紐付けモーダル） |
| 無条件に生成される mutation フック | **3 本**（`:27 useDeleteCombo` ／ `:34 useSetupAccordionActions` ／ `:38 useLinkExistingSetupForm`） |
| `readOnly` / `mode` prop | **0 件** |
| 純表示の子部品 | **2 件**（`ComboDetailHeader.tsx` 122 行 ／ `ComboDetailMetadata.tsx` 201 行。ともに書き込み結合ゼロ） |
| 再利用できない子部品 | **1 件**（`ComboDetailRecipe.tsx`。`GET /api/combos/:id/recipe` を自分で引くが、`repository.go:1523` の `GetRecipeCache` が `deleted_at IS NULL` で削除済みを締め出す） |

**採った形**——**新規ページ `TrashComboDetailPage.tsx` を作り、純表示の 2 部品を再利用した。** レシピだけは応答の `defaultRecipe` をテキストで描画する。

**★`readOnly` prop を後付けする案を採らなかった理由**——7 か所の JSX を条件付きにし、3 本のフックを無効化することになり、**生きたコンボの画面の全編集経路が条件分岐の下に入る。** 退行の面が本サブの射程を大きく超える。

### #2 `FindByIDAllowDeleted` の現物

**結論: 実在する。★述語は足されていない**（`M23-03` の裁定は崩れていない）。

```bash
grep -rn "\.FindByIDAllowDeleted(\|\.FindByIDAllowDeletedTx(" --include=*.go .   # → 5 件
```

- SQL: `internal/repository/combo/repository.go` の `selectComboByIDAllowDeletedSQL`。述語は **`WHERE id = ?` のみ**。
- 実装: `FindByIDAllowDeleted` / `FindByIDAllowDeletedTx`。**どちらも `scanCombo` のみ**で steps / tags / okiOptions / starterMoveCode をロードしない。
- **本番呼出は combo 側 2 件**（`service/combo/service.go:1005` = Tx 版・`validateRestoredCombo`、`:1048` = `PermanentDelete`）。残り 3 件はテスト 1 ＋ setup 側の同名別シンボル 2。

**★設計卓の見立て「完全削除の前チェックにのみ・1 か所」との差は、`M23-04` が足した Tx 版である。** **述語の追加ではないため `M23-03` の裁定は無傷**（`m23_03_reference_exclusion_test.go:51` が「削除済み行を返し続けること」を固定している）。

### #3 `M23-06` が作った読み取り専用の経路の現物

**結論: `notation.ResolveDeletedSetupRecipes`。★コンボ側の同型は既に在り、新設不要だった。**

```bash
grep -n "func (s \*service) ResolveDeletedSetupRecipes" internal/service/notation/setup_resolver.go  # → :83
grep -n "func (s \*service) ComputeSingleCache" internal/service/notation/cache.go                   # → :247
```

| 面 | 経路 | 書き込み |
|---|---|---|
| セットプレイ | `ResolveDeletedSetupRecipes(ctx, setupIDs []int64, presetID int64) (map[int64]string, error)` | **なし** |
| **コンボ（本サブ）** | **`ComputeSingleCache(ctx, comboID, presetID int64) (string, error)`**（`FindStepsForCombos` → `resolveRecipe`） | **なし**（書き戻しは呼び出し元 `ResolveComboRecipe` 側） |

**★`m23-06-completion-report` §9-3 の申し送りどおりだった。** **新しい解決処理を 1 行も書いていない。**

### #4 削除済みコンボの `combo_steps` が残っているか

**結論: 残っている。**

```bash
grep -n "func (r \*repository) SoftDelete" -A 6 internal/repository/combo/repository.go
grep -n "deleted_at" internal/repository/combo/repository.go | grep -i "combo_steps"   # → 0 件
```

- `SoftDelete` は `UPDATE combos SET deleted_at = ..., updated_at = ... WHERE id = ?` の **1 文のみ**。
- `service.Delete` のトランザクションは **2 操作だけ**（`SoftDelete` ＋ `DeleteComboCache` = `recipe_cache` を NULL）。
- `combo_steps` に `deleted_at` 列は無い（`migrations/000001_init_schema.up.sql`）。物理削除は `ON DELETE CASCADE` のみ。
- `FindStepsForCombos` の SQL に `deleted_at` 述語 **0 件**。

**⇒ §4.2-4 は成立する。** セットプレイ側と構造的に同じ状況である。

### #5 セットプレイの論理削除のフックと、それを呼ぶ画面

**結論: フックは実在し、★呼ぶ画面は 0 件だった**（設計卓の見立てどおり）。

```bash
rg -nw "useDeleteSetup" web/src web/e2e     # → 5 件（定義 1 ＋ 自テスト 4）
rg -n "setupApi.remove" web/src web/e2e     # → 5 件（定義 1 ＋ テスト 3 ＋ フック 1）
```

**★`-w`（単語境界）が要る。** 境界なしだと `useDeleteSetupLink`（別物＝紐付け解除）まで拾って 62 件に膨れる。**この 2 つを取り違えると「消したつもりが外れただけ」になる。**

### #6 完全削除が拒まれたときの応答

**結論: 見立てどおり。`409` ＋ `setup_in_use` ＋ `details.combos` の `{id, memo}`。**

```bash
rg -n "setup_in_use" internal web/src web/e2e   # → 13 件
```

- 定数: `internal/model/api_error.go` の `ErrorCodeSetupInUse = "setup_in_use"`。
- 型: `internal/model/setup.go` の `ComboRef{ ID int64 \`json:"id"\`; Memo *string \`json:"memo,omitempty"\` }`。
- 発生: `internal/service/setup/restore.go:243-248`（**Tx 内**）。直列化: `internal/api/setup/restore_handler.go:71-81`。

### #7 既存の紐付け解除の API 経路

**結論: 在る。★新しい API を 1 本も作っていない。**

| 層 | 実体 |
|---|---|
| ルート | **`DELETE /api/combos/:comboId/setup-links/:setupId`**（`internal/api/setup/routes.go`） |
| ハンドラ | `internal/api/setup/handler.go:114-133`（成功 **204**） |
| サービス | `internal/service/setup/service.go:357-377`（`DeleteSetupLink`・Tx） |
| リポジトリ | `internal/repository/setup/repository.go:300-321`（`combo_setup_results` と `combo_setups` の 2 DELETE） |
| フロント | `setupApi.deleteLink` ／ **`useDeleteSetupLink({comboId, setupId})`**（`useSetupLinks.ts:23-39`） |

### #8 ゴミ箱の遷移リンクの全数

**結論: 2 件（見立てどおり）。どちらもコンボ行。セットプレイ行は 0 件。**

| # | 場所 | 種類 |
|---|---|---|
| 1 | `TrashListRow.tsx` 行全体 | `onClick={() => navigate(...)}` |
| 2 | `TrashListRow.tsx` 始動状況セル内 | `<Link to={...}>` |

**セットプレイ行**（`TrashSetupListRow.tsx`）は `react-router-dom` の import 自体が無く、`<TableRow>` に `onClick` も `cursor-pointer` も無い。**⇒ §4.2-5「遷移しない」は変更なしで満たしている**（テストで固定した）。

**★ただし波及は 2 件では終わらなかった。** 遷移先を `/trash/combos/:id` へ変えたことで、**E2E の行ロケータ 12 か所**（`tr:has(a[href="/combos/${id}"])` の形）が `M23-01` / `02` / `03` / `04` / `05` / `06` の **6 spec** に跨って壊れる。全数を更新した（§5.5 既存テストの温存）。

```bash
grep -rn 'a\[href="/combos/' web/e2e/   # 更新前 12 件 → 更新後 0 件
```

### #9 ゴミ箱画面の日本語直書きの全数

**結論: 22 リテラル / 18 行 / 5 ファイル。★見立て（バー ＋ `TrashPage`）より広かった。**

| ファイル | 件数 | 内容 |
|---|---|---|
| `web/src/pages/TrashPage.tsx` | 4 | 見出し「ゴミ箱」／「読み込み中...」×2 ／「読み込みに失敗しました」 |
| `web/src/features/combo/components/TrashList.tsx` | 1 | 「ゴミ箱は空です」 |
| `web/src/features/combo/components/TrashListRow.tsx` | 6 | エラー接頭辞 2 ＋「不明なエラー」×2 ／「復元」／「完全削除」 |
| `web/src/features/combo/components/TrashBulkActions.tsx` | 6 | 「件選択中」「選択を復元」「選択を完全削除」「処理中...」「件失敗:」「不明なエラー」 |
| **`web/src/features/combo/components/PermanentDeleteConfirm.tsx`** | **5** | **★同ファイルの `t()` 使用は 0 件だった**（丸ごと未 i18n） |
| セットプレイ側 3 ファイル | **0** | `M23-02` / `M23-06` で i18n 済 |

**★見立てから漏れていたのは `PermanentDeleteConfirm`（5 件）と `TrashListRow` のボタン文言（2 件）である。**

**★範囲外として直さなかったもの**——`web/src/components/Header.tsx` の `label: "ゴミ箱"`。**全画面共通ヘッダであり、ゴミ箱画面の射程ではない**（§1.5-8）。**報告に留める**（§2.3）。

### #10 ★★実装コード内の `M23-07` への言及の全数

**結論: 11 件。★設計卓の見立て 7 件と相違した。実測を採った。**

```bash
rg -n "M23-07" internal web/src web/e2e migrations scripts   # → 11 件
```

内訳: `internal/` **8** ／ `web/src/` **1** ／ `web/e2e/` **2** ／ `migrations/` **0** ／ `scripts/` **0**。

**★見立てが挙げていなかった 4 件**——`internal/repository/combo/repository.go` の 2 か所目（`:461` の SQL 直上コメント）／ `internal/service/setup/restore_validation_test.go:274` ／ `web/src/features/trash/saveWarnings.unit.test.ts:153` ／ `web/e2e/m23-06-trash-columns.spec.ts` の 2 件。

処遇は §6 に 1 件ずつ記載。

---

## 2. ★読み取り専用取得の経路名と応答の逐語形（`CHANGE-128` の反映はこれ待ち）

### 2.1 経路

```
GET /api/combos/{id}/deleted
```

| 項目 | 内容 |
|---|---|
| ハンドラ | `internal/api/combo/handler.go` の `Handler.GetDeleted` |
| サービス | `internal/service/combo/service.go` の `service.GetDeleted(ctx, id, userID int64) (*model.Combo, error)` |
| リポジトリ | `internal/repository/combo/repository.go` の `FindByIDAllowDeletedWithChildren(ctx, id int64) (*model.Combo, error)` |
| レシピ解決 | `notation.ComputeSingleCache(ctx, comboID, presetID)`（**既存**。書き込みなし） |
| 応答型 | **既存の `ComboResponse` を流用**（新 DTO を作っていない） |
| ステータス | `200` ／ `400 invalid_id` ／ `404 not_found`（`{"error":{"code":"not_found","message":"コンボが見つかりません"}}`） |

### 2.2 ★応答の形（`GET /api/combos/{id}` との差）

**フィールドは 1 つも増えていない。** 差は **値域**と**載らないもの**である。

| フィールド | `GET /api/combos/{id}` | **`GET /api/combos/{id}/deleted`** |
|---|---|---|
| `deletedAt` | **常に nil**（生存行しか返さないため） | **非 nil になりうる**（ゴミ箱の行では非 nil） |
| `defaultRecipe` | `recipe_cache` から抽出 | **★`combo_steps` から組み立てる**（削除済み行の `recipe_cache` は NULL）。**解決失敗時は空文字** |
| `steps` / `tags` / `okiOptions` / `starterMoveCode` | ロードする | **同じくロードする**（`attachComboChildren` を共用） |
| `setups` | **載る**（`ListSetupsByComboID` で埋める） | **★載らない**（§4.2-5。空配列） |
| `validations` / `warnings` | 経路により載る | **載らない** |

**★母集団**——**削除済み行も、削除済みでない行も返す**（§5.1-7 の決定。§11-2 の暫定案どおり「返す」を採り、テストで固定した）。

**★`GET /api/combos/{id}` は一切変更していない。** フラグを足していない（§4.2-2）。**退行防止のテストを置いた**（§5.1-2）。

---

## 3. ★セットプレイの削除の導線の置き場と、その理由（§4.1-1）

### 3.1 置き場

**コンボ詳細画面（`/combos/:id`）の、各セットプレイのカード内のボタン列**
（`web/src/features/setup/components/SetupAccordionItem.tsx`。現在「紐付け解除」「成立条件編集」が並ぶ行）。

- **ラベル**: 「ゴミ箱へ移動」（`setup.delete.action`）。`data-testid="setup-soft-delete"`。
- **配置**: ボタン列の**右端**（`ml-auto`）。**紐付け解除の隣に並べない。**
- **見た目**: 塗りつぶしの赤（`bg-red-600`）。紐付け解除は**枠線だけの赤**であり、区別できる。

### 3.2 理由（検討した案と選定）

| 案 | 採否 | 理由 |
|---|---|---|
| **A. コンボ詳細のセットプレイカード内**（採用） | **採用** | `VAL-S05` によりセットプレイは親コンボ経由でしか画面に出ず、`DES-005` §5.9 も「紐付けはコンボ登録・編集画面またはコンボ詳細画面から」と定めている。**当のセットプレイの隣が最も近い。** |
| B. セットプレイ編集画面（`/setups/:id`）の下部 | 不採用 | 同画面は保存・キャンセルしか持たず、**破壊的操作の置き場としての作法が無い。** さらに `DES-005` §5.9 が「セットプレイ編集画面からの紐付け操作は誤操作リスクが高いため除外」と明記しており、同じ理由が削除にも当たる。 |
| C. ゴミ箱画面 | 不採用 | **ゴミ箱は「入った後」の画面である。** 入っていないものを入れる導線が置けない。 |
| D. コンボ一覧のセットプレイ子行（`SetupTreeRow`） | 不採用 | 同行は読み取り専用の表示であり、**一覧に破壊的操作を足すと行の当たり判定が過密になる。** |

### 3.3 ★「コンボの削除と混ざらないこと」をどう守ったか（§4.1-1 の守り）

1. **面が物理的に離れている。** コンボの削除はページ**最上部の操作バー**（`ComboDetailPage.tsx` の編集・コピーと並ぶ行）に在り、セットプレイの削除は**ページ中ほどのセットプレイセクションの、当該カードの中**に在る。
2. **文言で区別する。** コンボ側は `common.delete`（「削除」）、セットプレイ側は「**ゴミ箱へ移動**」。
3. **確認ダイアログが対象を名指しする。** 「**「{name}」をゴミ箱へ移動します。紐付いている {count} 件のコンボすべてから見えなくなります。ゴミ箱から戻せます**」。
4. **★prop を opt-in にした。** `SetupAccordionItem` の `onDelete` は省略可であり、**渡さない面では削除ボタンが出ない。** 同コンポーネントが将来別の面へ相乗りしても、破壊的操作が勝手に付いてこない。
5. **★テストで固定した。** `ComboDetailPage.setupDelete.test.tsx` が **fetch を実際に観測**し、`DELETE /api/combos/*` を 1 本も叩いていないことを主張する。**fixture の id は combo=10 / setup=7 と別の値**にしてある。

### 3.4 §4.1-2 / §4.1-3 の実装

- **確認を挟む**: `AlertDialog`。**参照コンボ件数は既存の `setup.parentComboIds.length` から出す**（新しい取得をしない）。
- **消した後にゴミ箱へ行ける**: `sonner` の `action: { label: "ゴミ箱を開く", onClick: () => navigate("/trash") }`。先例は `PunishTree.tsx` の同型。

---

## 4. ★一括操作バーの置き場と、その理由（§4.4-2）

### 4.1 置き場

**画面下部への sticky 固定**（暫定案どおり）。`TrashPage.tsx` の `<main>` の**末尾**へ移し、`TrashBulkActions` 自身が `sticky bottom-0 z-20` ＋ 不透明背景 ＋ 影を持つ。

### 4.2 理由

1. **バーはコンボ表とセットプレイ表の両方を受け持つ**（§4.4）のに、**コンボ表の上に固定されていた。** ⇒ セットプレイだけを選んだ利用者は操作するために画面上部まで戻る必要があった（レビュー低-6）。
2. **★`M23-06` で判断材料が 1 つ増えた**（`CHANGE-127`）——**結果が残る間はバーが表示され続ける**ようになったため、上に居座る時間も長くなっていた。
3. **表ごとに 2 本置く案は採らなかった。** 混在した選択を 1 回の操作で処理できなくなり、利用者は表を往復することになる（`M23-06` §4.4 が 1 本に決めた理由をそのまま維持）。

### 4.3 ★sticky をどこに持たせたか（実装上の落とし穴）

**当初はページ側で `<div className="sticky ...">` を被せたが、これは誤りだった**——`TrashBulkActions` は**選択も結果も無いとき `null` を返す**ため、**ラッパだけが残って空の枠線が画面下部に貼り付く。**

**⇒ sticky の指定はコンポーネント自身が持つ形に直した。** コードにその理由をコメントで残してある。

### 4.4 ★`M23-06` が確定した規律は維持している

- **操作ボタンは選択が残っている間だけ出す**（`totalCount > 0` のときだけ描画）。
- **結果の表示は選択が空になっても残る**（`if (totalCount === 0 && !hasResult) return null;` の `hasResult` ゲートに触れていない）。
- **破壊確認 3 でこの規律の退行防止を確認済み**（§7-3）。

---

## 5. §4.7 否定形確認（3 件・理由付き）

| # | 作らなかったもの | 理由 |
|---|---|---|
| **1** | **削除済みコンボの編集** | **★読み取り専用である**（§1.5-1 / §4.2-3）。編集したければ復元してから行う。**押せないボタンを並べず、出していない**——編集・コピー・削除・セットプレイ操作・タグ編集のいずれも読み取り専用詳細に存在しない（テストで `disabled` なボタンが 0 個であることも固定した）。**代わりに「編集できない理由」を `role="note"` で 1 行出している**——URL だけに頼ると、リンクを踏んだ利用者には編集できない理由が分からない。 |
| **2** | **セットプレイの詳細画面** | **★セットプレイは親コンボ経由でしか画面に出ない**（`VAL-S05`＝親に紐付かない単独作成は禁止）。**⇒ 単独の詳細という概念が無い**（§4.2-5）。ゴミ箱のセットプレイ行は**クリックで遷移しない**まま据え置いた。**現状すでに `<a>` も `onClick` も `cursor-pointer` も無く、変更なしで要件を満たしている**。**★「変更していない」ことをテストで固定した**——後続担当が「行が押せないのは欠陥だ」と読んで遷移を足すのを防ぐため。 |
| **3** | **`GET /api/combos/{id}` へのフラグ追加** | **★求めている集合が違えば入口も別に要る**（§4.2-2。`M23-06` の教訓）。既存経路にフラグを足すと、**通常の詳細表示で削除済みが返る事故の余地が残る。** ⇒ 別経路 `GET /api/combos/{id}/deleted` を新設した。**★退行防止のテスト（§5.1-2）を置き、破壊確認 2 で赤くなることも確かめた。** |

**★あわせて「作らなかった」もの 1 件**（§4.7 の 3 件には含まれないが記録する）——**読み取り専用詳細に `setups` を載せていない。** 理由は否定形 2 と同じで、セットプレイの操作導線を読み取り専用詳細に出さないため（§4.2-3）。**サーバ側でも `Get` と違い setups の埋め込みを行っていない。**

---

## 6. §4.5 実装コード内の `M23-07` 言及の処理（11 件・1 件ずつの判断）

**★実測 11 件を採った**（設計卓の見立ては 7 件）。**本サブが実際に配線したものは as-built へ書き換え、配線しなかったものは送り先を書いた。**

| # | 場所 | 判断 | 内容 |
|---|---|---|---|
| 1 | `internal/repository/combo/repository.go`（interface 宣言） | **書き換え** | 「ゴミ箱の読み取り専用詳細（M23-07 担当）が使う」→ **`FindByIDAllowDeleted` は完全削除の前チェック用と明記し、詳細用は新設の `FindByIDAllowDeletedWithChildren` を指す形へ** |
| 2 | 同（SQL 直上のコメント） | **書き換え** | 「DES-005 §5.15 の『行クリック → 詳細表示』は**現状未達**で、その実装時にここを引く」→ **「`FindByIDAllowDeletedWithChildren` 経由でここを引く（M23-07 §4.2-2 で配線済み）」** |
| 3 | `internal/model/api_error.go` | **書き換え** | 「画面はこれを列挙しない（D-485）が、M23-07 の導線づくりの材料」→ **「★画面はこれを列挙し、そこから紐付けを解除できる。D-485 は M23-07 が上書きした」** |
| 4 | `internal/model/setup.go`（`ComboRef` の godoc） | **書き換え** | 同上 |
| 5 | 同（`ComboRef` 直上の注記） | **書き換え** | 「画面はこの一覧を列挙しない（D-485）。用途は M23-07 の導線づくり」→ **「memo は画面が参照元コンボを識別するための唯一の手がかりである。空のときは『コンボ {id}』へ落とす」** |
| 6 | `internal/api/setup/restore_handler.go` | **書き換え** | 「M23-07 が導線を作るときの材料と不具合の切り分けのために残す」→ **as-built（画面はこの `details` だけを使い、追加取得を行わない）** |
| 7 | `internal/service/setup/restore.go` | **書き換え** | 同上（「この `Combos` がその導線の唯一の入力である」） |
| 8 | `internal/service/setup/restore_validation_test.go` | **書き換え** | 「id だけでは M23-06 / M23-07 が画面に出すときに何も書けない」（予定形）→ **「実際に M23-06 と M23-07 がこの memo を画面へ出している。落とすとどちらも『コンボ 12』としか書けなくなる」** |
| 9 | `web/e2e/m23-06-trash-columns.spec.ts`（ファイル冒頭） | **書き換え** | 「★M23-07 前はセットプレイをゴミ箱へ入れる UI 導線が無い」→ **「UI 導線は M23-07 §4.1 で配線済みだが、本 spec の関心は列構成であり前提づくりを短くする」＋ 画面操作の経路は m23-07 の spec が通す旨** |
| 10 | 同（`page.request.delete` の直前） | **書き換え** | 同上 |
| **11** | **`web/src/features/trash/saveWarnings.unit.test.ts`** | **★送り先を書いた** | **本サブでは配線しなかった。** 「登録前に選ばせる導線」は登録画面 × サーバ API の面であり、ゴミ箱の面ではない。**送り先＝`M23-09`（登録前の重複ダイアログ。followup `save-time-duplicate-choice-missing`）** |

**★残った `M23-07` の文字列はすべて as-built の記述である**（「§4.2-2 で配線済み」「M23-07 が上書きした」等）。**予定形の言及は 0 件。**

---

## 7. §5.3 破壊確認（3 件・コマンドと出力）

### 7-1 §4.1 の削除 API をコンボ側へ差し替える → **§5.2-1 が赤くなる**

**★fixture のコンボ id（10）とセットプレイ id（7）は別の値である**（`M23-06` は同型の破壊確認が id 衝突で空振りした）。

```bash
sed -i 's|setupApi.remove(id)|fetch(`/api/combos/${id}`, { method: "DELETE" }).then(() => undefined)|' \
  web/src/features/setup/hooks/useDeleteSetup.ts
cd web && pnpm vitest run src/pages/ComboDetailPage.setupDelete.test.tsx
```

```
× ComboDetailPage — セットプレイをゴミ箱へ入れる導線(M23-07 §4.1) > セットプレイの削除 API を叩く。コンボの削除 API を叩かない 264ms
  → ★コンボの削除 API を叩いている: expected [ { url: '/api/combos/7', …(1) } ] to deeply equal []
      Tests  1 failed | 2 passed (3)
```

**★赤くなった。しかも失敗メッセージが危険そのものを名指ししている。**
**★この確認の途中で 1 つ直した**——当初は「正しい宛先へ飛んだか」を先に検査していたため、失敗が「`/api/setups/7` が無い」としか出ず、**「コンボを消しに行った」という危険が表に出なかった。** 危険側の検査を先へ移した。

**★`/api/combos/7`（= セットプレイの id でコンボを消しに行く形）も検出できている。** これは id を取り違えた実装が作る最悪の形である。

### 7-2 読み取り専用取得の母集団から「削除済みも含む」を外す → **§5.1-1 が赤くなる**

```bash
sed -i 's|combo, err := s.repo.FindByIDAllowDeletedWithChildren(ctx, id)|combo, err := s.repo.FindByID(ctx, id)|' \
  internal/service/combo/service.go
go test ./internal/service/combo/ -run 'TestService_GetDeleted'
```

```
--- FAIL: TestService_GetDeleted_ReturnsSoftDeletedCombo (0.59s)
    m23_07_deleted_detail_test.go:55: GetDeleted が削除済み行を返していない: combo: not found(ゴミ箱の行クリックが 404 のままになる)
--- FAIL: TestService_GetDeleted_FillsRecipeFromComboSteps (0.55s)
--- FAIL: TestService_GetDeleted_EmptyStepsStillReturnsDetail (0.53s)
--- FAIL: TestService_GetDeleted_KeepsDetailWhenRecipeResolutionFails (0.52s)
--- FAIL: TestService_GetDeleted_DoesNotWriteBackRecipeCache (0.53s)
FAIL
```

**★5 件が赤くなった。** 削除済み行を扱うテストすべてが検出する。

### 7-3 §4.4-2 の「結果は選択が空でも残る」を選択に連動させる → **§5.2-11 が赤くなる**

```bash
sed -i 's|  if (totalCount === 0 \&\& !hasResult) return null;|  if (totalCount === 0) return null;|' \
  web/src/features/combo/components/TrashBulkActions.tsx
cd web && pnpm vitest run src/features/combo/components/TrashBulkActions.test.tsx
```

```
× TrashBulkActions > 一部失敗: role=alert にエラーメッセージが表示される → Unable to find role="alert"
× TrashBulkActions > §5.1-10 どの件に警告が付いたかが出る → Unable to find role="status"
× TrashBulkActions > §5.1-11 未知の VAL コードの警告が返っても表示が壊れない → Unable to find role="status"
× TrashBulkActions > ★選択が空になっても、警告の内訳が消えない(実アプリの親と同じ条件)
```

**★赤くなった。`M23-06` が実装した挙動の退行を検出する。**

**3 件とも復元後に緑へ戻ることを確認済み。**

---

## 8. テスト結果（件数付き）

| 対象 | 結果 |
|---|---|
| `go test ./...` | **1287 件 PASS / 0 件 FAIL / 53 パッケージ** |
| `cd web && pnpm test` | **1773 件 PASS / 178 ファイル**（着手前 1752 件 → **+21 件**。★レビュー取り込みで 1771 → 1773） |
| `cd web && pnpm exec tsc --noEmit` | **エラーなし** |
| `gofmt -l ./cmd ./internal` | **差分なし** |
| `make e2e` | **170 passed**（新規 3 本を含む） |

### 8.1 本サブが足したテスト

| 層 | ファイル | 件数 |
|---|---|---|
| Go サービス | `internal/service/combo/m23_07_deleted_detail_test.go` | **7**（§5.1-1〜7 に 1 対 1） |
| Go ハンドラ | `internal/api/combo/m23_07_deleted_detail_handler_test.go` | **4** |
| フロント | `src/pages/ComboDetailPage.setupDelete.test.tsx`（**最重要ゲート**） | 3 |
| フロント | `src/pages/TrashComboDetailPage.test.tsx` | 5 |
| フロント | `src/pages/TrashPage.i18n.test.tsx` | 3 |
| フロント | `SetupAccordionItem.test.tsx`（追記） | 5 |
| フロント | `TrashSetupListRow.test.tsx`（追記・書き換え） | 2 追加 ＋ 1 書き換え |
| フロント | `TrashListRow.test.tsx`（追記） | 1 |
| E2E | `web/e2e/m23-07-trash-missing-paths.spec.ts` | **3** |

### 8.2 §5.2 のフロント 11 件の所在

| # | 何を守るか | どこ |
|---|---|---|
| 1 | **★★セットプレイの削除が正しい API を叩く** | `ComboDetailPage.setupDelete.test.tsx` |
| 2 | 論理削除の前に確認が出る。参照コンボ件数が出る | `SetupAccordionItem.test.tsx` ＋ `ComboDetailPage.setupDelete.test.tsx` |
| 3 | 削除後のトーストからゴミ箱へ行ける | `ComboDetailPage.setupDelete.test.tsx` |
| 4 | ゴミ箱のコンボ行 → 読み取り専用詳細（404 にならない） | `TrashComboDetailPage.test.tsx` ＋ E2E |
| 5 | **★遷移リンクの全数が同じ行き先を向いている** | `TrashListRow.test.tsx` |
| 6 | 読み取り専用詳細に編集・削除が出ない | `TrashComboDetailPage.test.tsx` |
| 7 | **★セットプレイ行はクリックで遷移しない** | `TrashSetupListRow.test.tsx` |
| 8 | 拒否時に参照コンボが見え、紐付けを解除できる | `TrashSetupListRow.test.tsx` ＋ E2E |
| 9 | **★解除しても完全削除が自動再実行されない** | `TrashSetupListRow.test.tsx` ＋ E2E |
| 10 | ゴミ箱画面に日本語直書きが残っていない | `TrashPage.i18n.test.tsx` |
| 11 | 選択中だけ操作ボタン／結果は選択が空でも残る | `TrashBulkActions.test.tsx`（`M23-06` 由来・破壊確認 3 で退行防止を確認） |

**★§5.2-10 の書き方について**——**`TrashPage.i18n.test.tsx` だけは「キーを目印に置き換える `t`」を使っている。** 他のテストが実 `ja.json` を引くのとは逆であり、**意図的である**：ここで主張したいのは「文面が正しいこと」ではなく「**表示される文字列がすべて `t()` を通っていること**」だからである。文面そのものは `TrashListRow` / `TrashSetupListRow` / `PermanentDeleteConfirm` / `SetupAccordionItem` の各テストが**実 `ja.json` を引いて**主張しており、2 つを合わせて「キーが通っている ＋ 文面がある」になる（`M23-04` 教訓 2 の要求を満たす）。

### 8.3 ★`make e2e` の flaky について（本サブ由来ではない）

`make e2e` を 2 回実行し、**どちらも 170 passed** だが、毎回 **1 件が flaky**（リトライで成功）になった。

| 実行 | flaky になったテスト |
|---|---|
| 1 回目 | `m19-03-setup-results.spec.ts` D: 紐付け解除で成立条件の行が消える（`DELETE /api/combos/:id/setup-links/:setupId` が 500） |
| 2 回目 | `m17-05b-export-flow.spec.ts` マイコンボ: 選択ゼロから CSV エクスポート（URL 遷移待ち） |

**★毎回別のテストが当たっており、本サブの変更とは無関係である。** 1 回目は本サブが画面から呼ぶようになった紐付け解除の経路だったため個別に追ったが、2 回目は同経路が緑で別領域が当たった。**⇒ 特定経路の欠陥ではなく、E2E スタック全体の実行タイミングに起因する。**

**★直していない**（§2.3＝ゴミ箱の外に在る欠けは直さず報告）。**§9 で設計卓へ回す。**

---

## 9. 契約違反の独自判断（**1 件**）

### 9-1 ★★`D-485`（参照元コンボを列挙する専用の表示は作らない）を上書きした

| 項目 | 内容 |
|---|---|
| **何を** | ゴミ箱のセットプレイ行で完全削除を拒まれたとき、`details.combos` の `{id, memo}` を**画面に列挙する**ようにした。 |
| **既存の決定** | **`D-485`（`M23-02`）** = 「参照元コンボを列挙する専用の表示は作らない。画面が要るのは『拒否されたことが伝わること』だけである」。**否定テスト `TrashSetupListRow.test.tsx` の「拒否のとき、参照元コンボを列挙しない」が実在していた。** |
| **なぜ上書きしたか** | **指示書 §4.3-1 が「★どのコンボが参照しているのかを見せる」を要求し、チェックリスト §1 と §9 が「拒否されたとき参照しているコンボが見え、紐付けを解除できる」を完了承認の条件に挙げている。** ⇒ 指示書を正とした。**設計上の理由は「拒否されたあとに紐付けを解除する導線が画面に無く、拒否された利用者が詰む」ことであり、`D-485` が想定していなかった状況である。** |
| **何を変えたか** | (a) 否定テストを**列挙することを主張するテストへ書き換えた** ／ (b) `web/src/constants/api-error.ts` の `D-485` 注記を是正 ／ (c) `internal/model/api_error.go` ・ `internal/model/setup.go` ・ `internal/api/setup/restore_handler.go` ・ `internal/service/setup/restore.go` の同趣旨のコメント 5 か所を as-built へ書き換え。 |
| **守ったこと** | **★新しくデータを取りに行っていない**（§4.3-1）。**★新しい API を作っていない**（既存の `DELETE /api/combos/:comboId/setup-links/:setupId`）。**★解除後に完全削除を自動再実行しない**（§4.3-3）。**★文言で「コンボそのものは削除されません」と明記**（§4.3-2）。 |
| **設計卓への依頼** | **`DES-005` §5.15 の「★紐付けを解除する導線は、現時点でゴミ箱から辿れない」の記述が失効した。** `CHANGE-128` で as-built 化を依頼する。**あわせて `D-485` の扱い（撤回か、条件付き維持か）の裁定を仰ぐ。** |

**★これ以外の契約違反の独自判断は 0 件である。**

---

## 10. `docs/handover/followup-backlog.md` §J へ書いた項目

**★1 件も無い。** 再レビュー往復の上限に達しておらず、未解消のまま停止した項目が存在しないため。

**★ただし §9 の `D-485` 上書きは設計卓の裁定が要る**（§J ではなく設計伝達レポート §4 経由。§J は停止時記録の節であり、本件は停止に伴うものではない）。

---

## 11. 設計卓へ回すもの（`CHANGE-128` の反映対象）

**★製造は設計書本体を編集していない**（`CLAUDE.md` §8）。

| # | 反映先 | 内容 | 逐語の所在 |
|---|---|---|---|
| 1 | **`DES-002` §4.2** | **`GET /api/combos/{id}/deleted` の新設**と応答の値域 | 本報告 §2 |
| 2 | **`DES-005` §5.15** | **行クリック → 読み取り専用詳細（`/trash/combos/:id`）が機能するようになった**（既知の制約 (c) `trash-row-click-404` の解消） | 本報告 §2 / §5 |
| 3 | **`DES-005` §5.15** | **★既知の制約 3「ゴミ箱へセットプレイを入れる導線が画面上に存在しない」の解消** | 本報告 §3 |
| 4 | **`DES-005` §5.15** | **★「紐付けを解除する導線は、現時点でゴミ箱から辿れない」の解消**（＋ `D-485` の扱いの裁定） | 本報告 §3 / §9 |
| 5 | **`DES-005` §5.15** | **一括操作バーの置き場が画面下部の sticky になった** | 本報告 §4 |
| 6 | **`DES-005` §5.6** | **セットプレイカードに「ゴミ箱へ移動」が加わった**（項目 10 の記述） | 本報告 §3 |

### 11.1 ★報告のみ（直していない・§2.3）

| # | 見つけたもの | なぜ直さなかったか ／ 送り先 |
|---|---|---|
| 1 | **`web/src/components/Header.tsx` の `label: "ゴミ箱"` が直書き** | **全画面共通ヘッダであり、ゴミ箱画面の射程ではない**（§1.5-8）。**ゴミ箱以外の画面の i18n はスコープ外。** **送り先＝未割付**（画面横断の i18n 総ざらいを起こすなら、そこで拾う）。 |
| 2 | **★一括操作バーが失敗の理由を握り潰している（＝バルク経路では依然「詰む」）** | `TrashBulkActions` の `FailedItem.error` は捕捉されるが**画面に描画されない**（表示は件数とラベルのみ）。⇒ **一括で参照中のセットプレイを完全削除すると「N 件失敗: 名前」としか出ず、理由も逃げ道も無い。** §4.3 は**行単位の拒否表示**を対象としており、バルクへの逃げ道追加は射程外と判断した。**★ただし指示書 §1.1 の「拒否されたら詰む」を解消するという目的から見ると、バルク経路では未解消のまま残っている**（レビュー中-1）。 **★送り先＝`M23-CLOSE`**（ゴミ箱の面の残件。設計伝達レポート §4 経由で設計卓へ渡す）。 |
| 3 | **`make e2e` の flaky（毎回 1 件・毎回別のテスト）** | 本サブの変更と無関係（§8.3）。**E2E スタック全体の実行タイミングに起因すると見ている。** **★送り先＝未割付**（E2E 基盤の課題であり、ゴミ箱の面ではない）。 |

### 11.2 ★本サブの完了で失効する `followup-backlog` の行（**閉塞候補・設計卓の手番**）

**★製造は §J しか触れない**（**D-382**）ため、以下は**閉塞候補として名指しで渡すだけ**である。**設計伝達レポート §4 経由で設計卓が畳むこと。**

| 行 | 現在の状態欄 | 本サブ後の実態 |
|---|---|---|
| **`trash-row-click-404`** | ★起票済・投入待ち | **解消**——`/trash/combos/:id` で読み取り専用詳細が開く（**遷移リンク 2 件を両方向け替え済み**） |
| **`setup-soft-delete-ui-missing`** | ★起票済・投入待ち | **解消**——コンボ詳細のセットプレイカードに「ゴミ箱へ移動」を配線（**E2E で画面操作だけの往復を通した**） |
| **`trash-setup-bulk-and-linkage-ui`** | ★起票済・投入待ち（一括選択は解消済み） | **★残り半分も解消**——完全削除の拒否から紐付けを解除できる（**`D-485` の扱いは §9 の裁定待ち**） |
| **ゴミ箱画面の日本語直書き ／ 一括操作バーの置き場**（`M23-06` 設計伝達レポート §4-5 由来） | — | **解消**——直書き 22 件を i18n 化 ／ バーを画面下部 sticky へ |

**★名指しが無いと、次の担当は「起票済・投入待ち」を生きた課題として読む**（レビュー中-2）。

---

## 12. 推測で進めた事項（§9.2・すべて明示）

| # | 事項 | 採った案 |
|---|---|---|
| 1 | **推測: 一括操作バーの置き場**は §11-1 の暫定案どおり画面下部 sticky が最善と仮定した | §4 |
| 2 | **推測: 削除済みでないコンボを読み取り専用取得で引いたときは「返す」** が良いと仮定した（§11-2 の暫定案）。**テストで固定済み** | §2.2 |
| 3 | **推測: 読み取り専用詳細の URL は `/trash/combos/:id`**、サーバ経路は `GET /api/combos/{id}/deleted` と仮定した。**画面 URL は読み取り専用であることが分かる形（§4.2-3）／ API はコンボのサブリソース群（`/restore`・`/permanent`・`/recipe`）と揃える** | §2.1 |
| 4 | **推測: セットプレイの削除の導線はカードのボタン列の右端**が最善と仮定した | §3 |
| 5 | **推測: 文言**（「ゴミ箱へ移動」「紐付けを外す」等）は既存の作法に揃えた | — |

---

## 13. ■ 併せて更新が要るもの（常設項目・`E-114` ／ **D-277** / **D-297**）

| 項目 | 実査 | 結果 |
|---|---|---|
| **消費した CHANGE 番号の登録** | `grep -n "CHANGE-128" docs/handover/change-number-registry.md` | **本サブは CHANGE 番号を 1 件も払い出していない。** `CHANGE-128` は設計卓が 2026-08-23 に起票済み（**D-523**）であり、**registry §1 に登録済み**。⇒ **追加の登録は不要。** |
| **「次の番号」の写し先の全数** | `change-number-registry` §1 ／ 契約 §4 ／ ボード §2.1 ／ ボード §2.4（実査 4 か所） | **本サブは番号を消費していないため、写し先の更新は不要。** registry v1.185.0 が「次に採番する CHANGE ＝ M23 追加ブロックは `142` ／ M24 は `130`」と記録済みで、**本サブはこれを動かしていない。** |
| **消費したマイグレ連番** | `ls migrations/*.up.sql \| sed 's/.*\/\([0-9]*\)_.*/\1/' \| sort -n \| tail -1` → **`000078`** | **消費 0 本。** ボード §2.2 の「次に払い出す番号」（`000079`）とのズレなし。 |
| **版を上げた文書の参照元** | — | **本サブは設計書本体を 1 つも編集していない**（`CLAUDE.md` §8。反映は設計卓が `CHANGE-128` で行う）。⇒ **版を上げた文書は無く、参照元の追随も不要。** |

**★該当が無い項目も「なし」と明記した**（節の欠落と、対象が無いことは違う）。

---

## 14. レビュー結果と取り込み（**レビュー後に記入**・`M23-04` 教訓 3）

**レビュー報告書: [`m23-07-review.md`](m23-07-review.md)**

| 判定 | 内容 |
|---|---|
| **重大（チェックリスト §9）** | **0 件**（完了承認を妨げる問題なし） |
| 高 | **1 件**（`routes.go` のルート件数コメントが実装と食い違い） |
| 中 | 4 件 |
| 低 | 7 件 |
| **採否** | **高 1/1 採用 ／ 中 4/4 採用 ／ 低 5/7 採用。★「高」指摘の不採用は 0 件**（開発者エスカレーションの発火なし） |
| 往復 | **1 回で完了**（上限 2 回に未達） |

**★取り込みの詳細（各指摘の採否と理由）はレビュー報告書末尾の「## 取り込み結果（自動トリアージ）」に在る。**

**★高-1 は本サブが作り込んだ失効記述である**——`routes.go` の「登録される N ルート」を **`10 → 11` と機械的に +1 した**が、実数は 12 だった（元から在ったずれを温存した）。**指示書 §3.3 が繰り返し求めている「数を鵜呑みにせず実測する」を、自分が書いた行で守れていなかった。**

---

*以上、M23-07 完了報告。ゴミ箱の入口と出口をつないだ。*
