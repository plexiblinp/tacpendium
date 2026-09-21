# M23-06 完了報告: ゴミ箱の列と見せ方

| 項目 | 内容 |
|------|------|
| 対象指示書 | `docs/instructions/M23-06-trash-columns-and-presentation.md` v1.0.0 |
| 作業日 | 2026-08-23 |
| ブランチ | `claude/m23-06-implementation-plan-52807w` |
| コミット | `ea32168`(実装) / `3ad1c1d`(テスト) / `e1ef07b`(ドキュメント) / 取り込み 1 本 |
| 消費マイグレーション | **0 本**(§4.8 のとおりスキーマは触っていない) |
| 消費 CHANGE 番号 | **0 本**(反映は設計卓が `CHANGE-127` で行う。製造は設計書本体を編集していない) |

---

## 1. §3.3 着手前の実査 9 件(走査コマンドと件数付き)

### #1 ★★削除済みセットプレイのレシピ文字列を `setup_steps` から組み立てられるか

**結論: 組み立てられる。ただし `ResolveSetupRecipe` 経由では組み立てられない。**(**設計卓の見立てとの食い違い。§9-1 に再掲**)

```bash
sed -n '388,393p' internal/repository/setup/repository.go   # setup_steps の SQL
sed -n '574,600p' internal/repository/setup/repository.go   # GetRecipeCache の SQL
grep -n "func (s \*service) ResolveSetupRecipe" -A 20 internal/service/notation/setup_resolver.go
```

- `setup_steps` は論理削除で消えない。`selectStepsBySetupIDSQL`(`repository.go:388`)に `deleted_at` 述語は **0 件**。
  ⇒ **削除済みセットプレイのステップは取得できる。**
- しかし `ResolveSetupRecipe`(`setup_resolver.go:31`)は最初に `setupRepo.GetRecipeCache` を引く。その SQL は
  `SELECT recipe_cache FROM setups WHERE id = ? AND deleted_at IS NULL`(`repository.go:581`)であり、
  **削除済み行では `ErrNotFound` を返す。** godoc に「**M23-03 §4.2: combos 側とまったく同型であり、2 つで 1 組として塞いである**」と明記されている。
- **⇒ 中心は崩れない**(§4.3 は成立する)。**崩れるのは経路の想定だけである**——指示書 §4.3-2 は
  「`resolve-setup-recipe` の本番呼び出し元をここで作る」と書いているが、**そのまま呼ぶと `ErrNotFound` で落ちる。**
- **採った形**: **M23-03 の塞ぎに触らず**、計算本体(`setupStepsToComboSteps` + `resolveRecipe`)を呼ぶ
  読み取り専用の経路 `ResolveDeletedSetupRecipes` を新設した(**開発者裁定 B・2026-08-23**)。**撤去はしていない**(§4.9-2)。

### #2 削除済みコンボの `combo_steps` から組み立てる読み取り専用の経路が在るか

**結論: 在る。`notation.ComputeSingleCache`(`internal/service/notation/cache.go:247`)。**

```bash
grep -n "func (s \*service) ComputeSingleCache" -A 12 internal/service/notation/cache.go
```

`FindStepsForCombos` → `resolveRecipe` の 2 段で、**DB への書き込みを伴わない**。
書き込みを伴うのは `ResolveComboRecipe`(キャッシュ書き戻し)と `RecomputeComboCache` の側である。

**★在っても使っていない**(§4.1＝ルート列は消す判断であり、「出せるか」ではなく「無いと困るか」で決めた)。
**⇒ `M23-07` 以降で「コンボ側にもレシピを出す」判断が出た場合の材料として、ここに記録する。**

### #3 ゴミ箱一覧の応答にタグが実際に非 nil で載っているか

**結論: 載っている。型は `[]model.Tag`、0 件は空配列。**

```bash
grep -n "Tags" internal/repository/combo/repository.go   # 829-844 行に一括取得
grep -n "Tags" internal/api/combo/dto.go                  # 242 / 496-500 行
```

- `repository.go:829-844` が一覧結果に対し `findTagsByComboIDs` で **IN 句の 2 クエリ方式**でタグを一括取得する(M3-02 §4.4.2)。
- `dto.go:496-500` が **常に非 nil**(タグなしは空配列)で `json:"tags"` に載せる。
- **`OnlyDeleted` の分岐は同じ経路を通る**(述語が違うだけ)。**⇒ 削除済み行にもタグが載っている。**
- 利用者による絞り込みも同経路(`service/combo/service.go:361-370`)。
- **⇒ 新しくデータを取りに行く必要はゼロ。実装でも取りに行っていない。**

### #4 現在の選択状態の型と、一括操作がそれをどう使っているか

**結論: コンボ id の配列(`useState<number[]>`)。影響範囲は実測 5 ファイル。**

```bash
grep -rln "selectedIds" web/src            # 11 ファイル(うちゴミ箱系 5 本)
grep -rn "selectedIds" web/src | wc -l     # 82 ヒット
```

ゴミ箱系: `pages/TrashPage.tsx`(state) / `features/combo/components/TrashList.tsx`(全選択・行選択) /
`TrashBulkActions.tsx`(`selectedIds.map(...)`) ＋ それぞれのテスト 2 本。
**残る 6 ファイル**(`ComboTable` / `MyComboPage` / `useSelectMode` 等)は**別系統であり、本サブは触っていない**。

### #5 選択状態をブラウザストレージへ保存しているか

**結論: 保存していない。**

```bash
grep -rn "localStorage\|sessionStorage\|browser-storage" \
  web/src/pages/TrashPage.tsx web/src/features/*/components/Trash*.tsx   # → 0 件
```

`web/CLAUDE.md` §1 の台帳にもゴミ箱のキーは無い(台帳 9 件のいずれも該当しない)。
**本サブでも保存していない**(§4.4-3)。`bash scripts/check-browser-storage-keys.sh` は緑(§3 に出力)。

### #6 `M23-04` / `M23-05` が足した警告表示の経路

**結論: 見立てどおり。ただし M23-05 は「登録側」を別ファイルへ広げている。**

```bash
grep -rn "formatRestoreWarning" web/src
```

- `features/trash/restoreWarnings.ts`(M23-04)が単件(`formatRestoreWarnings`)と一括(`formatBulkRestoreSummary`)の両方を持つ。
- `TrashListRow` / `TrashSetupListRow` / `TrashBulkActions` の 3 本が引く。
- **M23-05 は復元側へ足したのではなく、登録側を `features/trash/saveWarnings.ts` として別ファイルに作った**
  (「利用者にできることが違うため文面を分ける」という意図がファイル冒頭に書かれている)。**本サブは触っていない。**

### #7 ★復元経路で返りうる VAL コードの現在の一覧

**結論: 6 件。見立てと一致。**(Go 全体で定義済みの VAL コードは **31 件**)

```bash
grep -rn '"VAL-' --include=*.go internal/ | grep -v _test | grep -oE '"VAL-[A-Z]?[0-9]+"' | sort -u   # 31 件
grep -rn "ValidateR0[1-4]" --include=*.go internal/ | grep -v _test
```

| コード | 出どころ |
|---|---|
| `VAL-C08` | コンボ復元・技存在(`validateRestoredCombo` → `ValidateMoveExistence`) |
| `VAL-S03` | セットプレイ復元・技存在(`ValidateSetupMoveExistence`) |
| `VAL-R01` | `internal/service/combo/service.go:1038` |
| `VAL-R02` | `internal/service/setup/restore.go:138` |
| `VAL-R03` | `internal/service/combo/service.go:974`(M23-05) |
| `VAL-R04` | `internal/service/setup/restore.go:193`(M23-05) |

**⇒ 31 件のうち 6 件が復元経路に現れる。増える余地が大きい。** 実装ではコードを列挙していない(§4.6-3。§5 に検証)。

### #8 不活性なアサーションの現物

**結論: 見立てどおり「括弧を足すだけでは直らない」。**

```bash
sed -n '60,71p' web/src/features/combo/components/TrashListRow.test.tsx   # 作業前
```

現物は `expect(link.closest("td")?.onclick).toBeDefined;`(旧 70 行)。**二重に壊れていた**——
(a) 関数として呼ばれていない (b) **React は onClick を委譲で付けるため DOM の `td.onclick` は `null`** であり、
括弧を足しても `null !== undefined` で**緑のまま通る**。
**⇒ 作り替えた**(§4.7。破壊確認 2 で赤くなることを確認済み＝§4 の 2)。

### #9 ゴミ箱一覧の現在の列の全数

**結論: コンボ表 7 列 / セットプレイ表 3 列。`M23-RESEARCH-01` A-1 の 8 項目は M23-01 の残日数撤去で 7 へ減っている(実測を採った)。**

```bash
sed -n '44,60p' web/src/features/combo/components/TrashList.tsx
grep -rn "toHaveLength(7)\|toHaveCount(7)" web/src web/e2e
```

- コンボ表(作業前): 選択 / 始動状況 / ダメージ / **ルート** / **タグ** / 削除日時 / 操作 = **7 列**。
  **★見出しは i18n を経由せず日本語リテラルで直書き**(`TrashList.tsx:53-58`)。
- セットプレイ表(作業前): 名前 / 削除日時 / 操作 = **3 列**。**こちらは i18n 経由。**
- **列数 7 を守る主張が 3 か所**: `TrashList.test.tsx:94` / `e2e/m23-01-trash-superseded.spec.ts:154` / `e2e/m23-02-setup-restore.spec.ts:212`。
  **本サブで 3 か所とも 6 へ更新した**(守っている意図＝「列を足して撤去を巻き戻さない」は変わらない)。

---

## 2. ★最終的な列構成(逐語・`CHANGE-127` の反映はこれ待ち)

### 2.1 コンボ側のテーブル(**6 列**)

| # | 見出し | 中身 | 空になりうる条件 |
|---|---|---|---|
| 1 | (見出しなし・チェックボックス) | 選択(`aria-label` = 「全選択」／行は「コンボ {id} を選択」) | 空にならない |
| 2 | 始動状況 | `formatStarterStatus(combo)`(始動技コード / ヒット種別 / 位置を ` / ` 連結)。詳細画面へのリンク | 空にならない(始動技が無ければ「始動技?」を出す) |
| 3 | ダメージ | `formatDamage(combo.damage)` | `damage` 未設定のとき(`formatDamage` の表現に従う) |
| 4 | タグ | `TagBadgeList`(`excludeCategories=[mycombo_status]` / `maxVisible=3`。超過分は `+N` バッジ) | **タグ 0 件、またはマイコンボ状態タグしか無いとき空**(一覧画面と同じ挙動＝`TagBadgeList` が `null` を返す) |
| 5 | 削除日時 | `YYYY-MM-DD HH:mm`(ローカル時刻) | `deletedAt` が無いとき `-`(ゴミ箱の行では通常起きない) |
| 6 | 操作 | 「復元」「完全削除」ボタン | 空にならない |

**★消した列と理由**

| 消した列 | 理由 |
|---|---|
| **ルート** | **論理削除の時点で `combos.recipe_cache` が NULL になるため、削除済み行に出せるレシピは構造的に存在しない。** 列を残す限り常に定数(`(レシピ表示なし)`)になる。**「存在しない概念の列を残さない」**——`D-458`(残日数)に適用したのと同じ論理。**開発者の逐語もある**(「常に表示なしなら一覧から消したい」2026-08-20)。**★コンボは `memo` と始動状況で行を識別できるため、無くても困らない。** |
| ~~残日数~~ | 本サブの前に `M23-01` / `CHANGE-121` で撤去済み(`D-458`)。**再掲のみ。** |

**★i18n**: 見出しは `trash.combo.column*`(ja / en)へ移した。**作業前は日本語リテラル直書きで i18n キーが存在しなかった**
ため、**「消すべき i18n キー」は 0 件**である(§4.1 は「i18n のキーも消すこと」と書くが、対象が存在しなかった)。
`(レシピ表示なし)` も同様にリテラルであり、実装から消えている。

### 2.2 セットプレイ側のテーブル(**4 列**)

| # | 見出し | 中身 | 空になりうる条件 |
|---|---|---|---|
| 1 | (見出しなし・チェックボックス) | 選択(`trash.setup.columnSelectAll` / `trash.setup.columnSelect`) | 空にならない |
| 2 | 名前(`trash.setup.columnName`) | `name` → **`defaultRecipe`(レシピ文字列)** → `(名称未設定)` の順で落とす | **空にならない**(最終フォールバックが `(名称未設定)`)。**レシピ文字列は `setup_steps` が 0 件のとき空**になり、そのときだけ `(名称未設定)` に落ちる |
| 3 | 削除日時(`trash.setup.columnDeletedAt`) | コンボ側と同じ書式 | `deletedAt` が無いとき `-` |
| 4 | 操作(`trash.setup.columnActions`) | 「復元」「完全削除」ボタン ＋ 拒否時の `role=alert` | 空にならない |

**★増やした列**: 選択(#1)。**一括操作をセットプレイにも効かせるため**(§4.4)。

### 2.3 ★コンボ側とセットプレイ側で答えが違うこと(§1.3 の非対称)

**★同じ根(論理削除時の `recipe_cache` 物理削除)から出た 2 つの症状に、逆の答えを出している。**
**軸は「その情報が無いと利用者が困るか」であって「技術的に出せるか」ではない。** どちらも技術的には出せる(実査 #1 / #2)。

- **コンボ**: `memo` と始動状況(キャラ・始動技・position)で行を識別できる。**⇒ レシピ列は「あると親切」であって「無いと困る」ではない。消した。**
- **セットプレイ**: 名前が空だと `(名称未設定)` しか無く、**識別手段がゼロになる**。**完全削除は不可逆であり、取り違えは取り返しがつかない。⇒ 出した。**

この理由は実装のコメントにも置いてある(`TrashList.tsx` 冒頭 / `TrashSetupListRow.tsx` の `label` 付近)。

---

## 3. §4.9 否定形確認(3 件・理由付き)

### 3-1 ★ルート列を「空にする」ではなく「消した」

**列そのものを撤去した**(見出し・セル・列数の主張の 3 か所すべて)。空文字を出す形にしていない。
**理由**——論理削除で `recipe_cache` が NULL になる以上、**列を残す限り常に定数**である。
**コンボは `memo` と始動状況で識別できる**ため、列が無くても行を取り違えない。
`D-458`(残日数)で「存在しない概念の列を残さない」を適用した先例と同型である。

### 3-2 ★`resolve-setup-recipe` を撤去せず、使う側で決着させた(`D-513` の差し戻しの決着)

**`ResolveSetupRecipe` は残っている。撤去していない。**
**ただし、そのままでは削除済み行に使えない**——`GetRecipeCache` が `deleted_at IS NULL` で塞がれており
`ErrNotFound` になる(実査 #1)。**M23-03 §4.2 が意図して塞いだものであり、本サブは触らない。**

**⇒ 決着の形**: セットプレイのレシピ解決の**計算本体**(`setupStepsToComboSteps` + `resolveRecipe`)を、
**ゴミ箱一覧という本番の呼び出し元から使う**経路 `ResolveDeletedSetupRecipes` を作った。
**「撤去するか」ではなく「使う」で閉じている。** インタフェースの godoc に、
`ResolveSetupRecipe` が削除済み行に使えないことと、その場合の行き先を明記してある。

### 3-3 ★論理削除で `recipe_cache` を消すのをやめる案を採らなかった(理由 3 つ)

1. **削除の副作用を変える判断であり、`DES-002` §4.2 の契約に触る。`M23-03` が as-built で固定したばかりである**(`D-504`)。
2. **コンボ側の `recipe_cache` の NULL 化は `PUT` の旧行の扱いと絡んでいる。片方だけ変えると非対称が増える。**
3. **本サブは画面のサブである。** サーバ側の削除の副作用を変えるのは射程が違う(`M23-08` でも扱っていない)。

**⇒ 読み取り側で解いた。** **★さらに、読み取りが書き戻す形も採っていない**——
`ResolveDeletedSetupRecipes` は **DB へ 1 バイトも書かない**。GET が削除済み行の `recipe_cache` を埋めると、
「削除済み行の `recipe_cache` は NULL」という as-built を静かに動かすことになるためである。
**この不変は Go テストで固定した**(`TestService_ListDeletedSetups_DoesNotWriteBackRecipeCache`。一覧を 2 回読んでも NULL のまま)。

---

## 4. §5.2 破壊確認(3 件・コマンドと出力)

### 4-1 一括操作の API の振り分けを逆にする → **§5.1-4 が赤くなる**

`TrashBulkActions.tsx` の 4 か所(`restoreCombo`↔`restoreSetup`、`permanentDeleteCombo`↔`permanentDeleteSetup`)を入れ替えた。

```
$ pnpm --dir web test -- --run src/features/combo/components/TrashBulkActions.test.tsx
   × §5.1-4 種別ごとの API 振り分け > 一括復元: コンボ id は combos の経路へ、セットプレイ id は setups の経路へ渡る
   × §5.1-4 種別ごとの API 振り分け > 一括完全削除: コンボ id は combos の経路へ、セットプレイ id は setups の経路へ渡る
   × §5.1-4 種別ごとの API 振り分け > コンボだけを選んだとき、セットプレイの API を 1 度も叩かない
   × §5.1-4 種別ごとの API 振り分け > セットプレイだけを選んだとき、コンボの API を 1 度も叩かない
   ⎯⎯ Failed Tests 9 ⎯⎯
```

**★★1 回目の破壊確認で、§5.1-4 の主要 2 件が緑のまま通った。**
原因は fixture である——**コンボ id とセットプレイ id をわざと 7 に衝突させていた**ため、
振り分けを逆にしても **URL の集合が同じ**(`/api/combos/7/...` と `/api/setups/7/...`)になり、取り違えを検出できなかった。
**⇒ id を別の値(コンボ 7 / セットプレイ 8)にし、集合ではなく対応で主張する形へ作り替えた**(`expect(urls).toEqual([...])`)。**上の出力は作り替えた後のものである。**
**★これは破壊確認が実際に仕事をした事例であり、破壊確認をしなければ最重要ゲートが空振りのまま通っていた。**

### 4-2 §4.7 で作り替えたテストの検証対象を壊す → **そのテストが赤くなる**

`TrashListRow.tsx` の始動状況セルから `onClick={(e) => e.stopPropagation()}` を外した(伝播が復活し、遷移が二重になる)。

```
$ pnpm --dir web test -- --run src/features/combo/components/TrashListRow.test.tsx
   × TrashListRow > 始動状況セルクリックで navigate が1回のみ呼ばれる 132ms
     → expected "spy" to not be called at all, but actually been called 1 times
      Tests  1 failed | 6 passed (7)
```

**★作業前の形(`expect(...).toBeDefined;`)では、この破壊で緑のまま通る。** 括弧を足しても
`td.onclick` は React では常に `null` であり `null !== undefined` で通るため、やはり緑のままである。
**⇒ 作り替えが効いていることの証拠である。**

### 4-3 警告の VAL コードを 1 つ増やす → **§5.1-11 は緑のまま通る**(ここだけ「赤くならないこと」を確認)

`TrashBulkActions.test.tsx` の一括復元 fixture へ、**実装が一切知らないコード `VAL-R05`** の警告を 1 件足した
(`details.combos` 付き)。

```
$ pnpm --dir web test -- --run src/features/combo/components/TrashBulkActions.test.tsx
 ✓ src/features/combo/components/TrashBulkActions.test.tsx (11 tests) 392ms
      Tests  11 passed (11)
```

**⇒ VAL コードをハードコードしていない。** 内訳の抽出は `warningRefEntries` が `details` のキー
(`setups` / `combos`)で分岐し、文面は `formatRestoreWarning` の `trash.warning.unknown` フォールバックが受ける。

**★3 件とも、破壊した変更は確認後にすべて戻してある**(`git diff --stat` が空であることを確認済み)。

### 4-4 (取り込み時に追加)高-1 の早期 return を元へ戻す → **結果表示のテストが赤くなる**

```
$ pnpm --dir web test -- --run src/features/combo/components/TrashBulkActions.test.tsx
   × §5.1-10 どの件に警告が付いたかが出る
   × §5.1-11 未知の VAL コードの警告が返っても表示が壊れない
   × ★選択が空になっても、警告の内訳が消えない(実アプリの親と同じ条件)
   × ★選択が空になっても、失敗の一覧が消えない
   × 結果は「結果を閉じる」で消せる(消し方が判らない状態にしない)
   × 一部失敗: role=alert にエラーメッセージが表示される
      Tests  6 failed | 8 passed (14)
```

**★`renderWithRealParent` へ移す前は、同じ壊し方で `一部失敗` の 1 件しか赤くならなかった。**
**⇒ 「テストの親が実アプリの親と違う」ことが、この不具合を隠していた。**

### 4-5 (取り込み時に追加)中-1 の縮退をやめる → **`KeepsListWhenRecipeResolutionFails` が赤くなる**

```
$ go test ./internal/service/setup/... -run 'KeepsListWhenRecipeResolutionFails'
--- FAIL: TestService_ListDeletedSetups_KeepsListWhenRecipeResolutionFails (0.51s)
    ListDeletedSetups がレシピ解決の失敗で落ちている: resolve deleted setup recipes:
    resolve deleted setup recipe setup=1: resolve step 1: find preset: preset: not found
```

**★2 件とも、破壊した変更は確認後に戻してある。**

---

## 5. ★レシピ解決の方式と問い合わせ回数(§4.3-3 の N+1)

**方式**: **サーバ側で解決する。クライアントで組み立て直さない**(表記はプリセット・エイリアスに依存し、
規則を 2 か所に持つと必ずドリフトする＝`E-76`)。

```
GET /api/setups?characterId=X&onlyDeleted=true
  └ service/setup.ListDeletedSetups
      ├ repo.ListDeletedByCharacterID          … 1 クエリ(一覧)
      ├ repo.FindLiveComboIDsBySetupIDs        … 1 クエリ(紐付きコンボ・既存)
      └ notation.ResolveDeletedSetupRecipes    … ★本サブで新設
          ├ repo.FindStepsBySetupIDs           … 1 クエリ(IN 句で全件ぶんの steps・★本サブで新設)
          └ resolveRecipe × 件数               … エイリアス解決(既存 resolver の作法)
```

**問い合わせ回数(削除済み N 件・平均ステップ数 S)**

| 段 | 回数 | 備考 |
|---|---|---|
| 一覧 | 1 | 既存 |
| 紐付きコンボ | 1 | 既存(IN 句) |
| **steps 取得** | **1** | **★件数によらず 1。ここが N+1 回避の本体**(`FindStepsBySetupIDs`) |
| エイリアス解決 | 概ね `N × S × 2〜3` | `FindAlias` / `FindPresetByID` / official プリセットの `FindAlias`。**既存 resolver がすべての経路で行っている作法と同じ**であり、本サブはここを変えていない(射程外) |
| **書き込み** | **0** | **★キャッシュへ書き戻さない**(§3-3) |

**★解決に失敗した行の扱い**(取り込みで是正・レビュー中-1)——**1 件の失敗で一覧全体を落とさない。**
当該行だけ空文字にし、`slog.WarnContext` を残す。
**理由——ゴミ箱が開けないと復元も完全削除もできず、本サブの動機に照らして最悪の縮退になる。**

**★`ResolveSetupRecipe`(単件・キャッシュ経由・書き戻しあり)を件数ぶん呼ぶ形は採らなかった。**
理由は 2 つ——(a) **削除済み行では `ErrNotFound` になり動かない**(実査 #1)、(b) 仮に動いても
**steps 取得が件数ぶんに散り、GET が削除済み行へ書き戻す**ことになる。

---

## 6. 契約違反の独自判断

**0 件。**

以下は「契約違反」ではないが、**指示書の記述と実装の形が違う点**として明示する(いずれも着手前に開発者裁定を得ている)。

| # | 指示書の記述 | 実装 | 経緯 |
|---|---|---|---|
| 1 | §4.3-3「**応答にフィールドが増える**ため `DES-002` §4.2 の改訂対象」 | **フィールドを増やさず、既存の `defaultRecipe` を埋めた** | **開発者裁定 A**(2026-08-23)。応答の形が増えず、フロントの既存フォールバック(`name → defaultRecipe → (名称未設定)`)がそのまま効く。**契約の差分は「削除済みセットプレイの `defaultRecipe` が非空になる」の 1 点**であり、`CHANGE-127` はこれを反映すれば足りる |
| 2 | §4.3-2「**`resolve-setup-recipe` の本番呼び出し元をここで作る**」 | **`ResolveSetupRecipe` は温存し、その計算本体を呼ぶ読み取り専用の経路を新設した** | **開発者裁定 B**(2026-08-23)。実査 #1 のとおり `ResolveSetupRecipe` は削除済み行に使えない。**M23-03 の塞ぎには触っていない** |
| 3 | §4.1「**i18n のキーも消すこと**(見出しと `(レシピ表示なし)` の文言)」 | **消す対象が 0 件だった**(作業前は日本語リテラル直書き)。代わりに**残る見出しを i18n 化した** | 実査 #9。チェックリスト §3「列見出しの i18n が ja / en の両方に在る」を満たすため |

**★推測で進めた事項(§9.2 の範囲・その旨を明示)**

- **推測: 一括選択の型は案 (b)(コンボ用とセットプレイ用の 2 本の配列)を採った。**
  理由——**取り違えが構造的に起きえない**。コンボ id の配列は combo 系の mutation にしか渡らず、
  セットプレイ id の配列は setup 系にしか渡らない。案 (a)(`{kind, id}` の 1 本)は分岐が実行時に残る。
  **副次的に「全選択の対象が表示中のテーブルの中だけ」が自然に成立する**(各表が自分の配列しか受け取らないため)。
- **推測: セットプレイのレシピは専用の列を作らず、名前列のフォールバックとして出す**と仮定した。
  理由——**識別手段がゼロになるのを防ぐのが目的**であり、名前がある行にレシピを併記する必要は無い。
  既存コード(`TrashSetupListRow`)が既にこのフォールバックを持っており、`M23-02` のコメントが
  「M23-06 の担当」と名指ししていた形をそのまま満たす。
- **推測: レシピ文字列の省略はしない**と仮定した(§9.2「省略するなら全文を見る手段を残すこと」)。
  **省略していないので全文が常に見える。** 長いレシピは `break-all` で折り返す(横スクロールで行が壊れない)。
- **推測: 一括操作バーはコンボ表とセットプレイ表で 1 つを共有する**と仮定した。
  理由——表ごとに置くと、混在した選択を 1 回の操作で処理できず利用者が表を往復する。

---

## 7. §J へ書いた項目

**3 件。** `docs/handover/followup-backlog.md` §J へ記録した。**★§J 以外の節は編集していない**(`D-382`)。

| ID | 要旨 |
|---|---|
| `m23-06-unnamed-setup-unreachable-by-api` | 下記のとおり |
| `progress-log-index-check-false-green-recurrence` | **`check-progress-log-index.sh` が索引行の欠落を検出できない**(作業 ID が他サブの本文から既に言及されているため緑になる)。**★`M23-05` 横断課題 1 と同型の再発であり、2 サブ連続で当たった** |
| `recipe-resolver-preset-lookup-per-step` | **`resolveMoveStep` の `FindPresetByID` がステップごとに走る**(`N × S`)。**射程外として見送った**——全レシピ解決経路が通る共有処理であり、本サブのテストでは他経路を守れない。**★一覧経路で resolver を使ったのは本サブが最初である** |

**内容の要旨**——**名前が空のセットプレイは、現在の API では作れない。**
`VAL-S06` が登録(`ValidateSetupCreate`)と更新(`ValidateSetupUpdate`)の**両方**で空名を弾く
(`internal/service/setup/validate.go:121` / `:149`)。**⇒ 名無しの行は `VAL-S06` 導入前の既存データだけである。**
本サブの §4.3 はその既存データに対して効く(そして将来 `VAL-S06` が緩んだ場合にも効く)が、
**E2E から名無しの行を作ることはできない。** そのため E2E は「削除済み一覧の応答にレシピ文字列が載ること」
(識別手段の供給元)までを見て、画面のフォールバックはコンポーネントテストで名無しの行を作って確かめている。

---

## 8. テスト結果(件数付き)

| 対象 | コマンド | 結果 |
|---|---|---|
| Go | `go test ./...` | **53 パッケージ ok / 失敗 0**(exit 0) |
| Go(本サブ分) | `go test ./internal/service/setup/... -run 'ListDeletedSetups\|FindStepsBySetupIDs' -v` | **5 件 PASS**(新規 4 ＋ 既存 1) |
| フロント | `pnpm --dir web test -- --run` | **174 ファイル / 1741 テスト passed**(作業前 1729 → **+12**) |
| E2E | `make e2e` | **168 passed**(作業前 165 → **+3**)。失敗 0 |
| 型 / lint | `pnpm --dir web lint`(= `tsc --noEmit`) | **エラー 0** |
| 整形 | `gofmt -l .` | **出力なし** |

**フロントの内訳(§5.1 の 12 件)**

| § | 何を守るか | 置き場 |
|---|---|---|
| 5.1-1 | ルート列の見出しとセルが存在しない | `TrashList.test.tsx`(2 件)＋ 列数 6 |
| 5.1-2 | タグ列が応答のタグを描画する / マイコンボ状態タグは除外 | `TrashList.test.tsx`(2 件) |
| 5.1-3 | タグ 0 件の表示が一覧画面と揃っている | `TrashList.test.tsx` |
| **5.1-4** | **★一括操作が種別に応じて正しい API を叩く** | `TrashBulkActions.test.tsx`(4 件) |
| 5.1-5 | 「全選択」の対象が表示中のテーブルの中だけ | `TrashList.test.tsx` |
| 5.1-6 | 名無しセットプレイの行にレシピ文字列が出る | `TrashSetupListRow.test.tsx`(2 件) |
| 5.1-7 | レシピ文字列が空でも行が壊れない | `TrashSetupListRow.test.tsx` |
| 5.1-8 | 単件復元で警告が無くても完了トーストが出る | `TrashSetupListRow.test.tsx` / `restoreWarnings.test.tsx` |
| 5.1-9 | 単件復元で警告があるとき 1 枚に畳まれる | `TrashSetupListRow.test.tsx` / `restoreWarnings.test.tsx` |
| 5.1-10 | 一括復元で「どの件に警告が付いたか」が出る | `TrashBulkActions.test.tsx` |
| **5.1-11** | **★未知の VAL コードで表示が壊れない** | `TrashBulkActions.test.tsx` ＋ `restoreWarnings.unit.test.ts`(4 件) |
| 5.1-12 | 作り替えた行コンポーネントのテスト | `TrashListRow.test.tsx`(3 件) |

**★フロントテストはすべて実 `ja.json` を引く `t` で書いた**(`M23-04` 教訓 2)。
`TrashSetupListRow.test.tsx` は作業前がキー返しモックだったため、本サブで実 `ja.json` へ切り替えた。

**品質チェック**

```
$ bash scripts/check-artifact-integrity.sh   → 違反なし(検査 11 件の自己検査・生成物 4 件すべて OK)
$ bash scripts/check-browser-storage-keys.sh → 違反なし(台帳 9 件 / 本番コード 8 件・一致)
$ bash scripts/check-enum-sync.sh            → ベースラインどおり(増加なし)
```

---

## 9. 設計卓へ回すもの

### 9-1 ★実査 #1 の食い違い(`CHANGE-127` の記述に影響する)

**指示書 §4.3-2 / §1.2 の「`resolve-setup-recipe` の本番呼び出し元が 0 件」という記述は正しい。**
**しかし「本サブがその呼び出し元になる」は、そのままでは成立しない。**
`ResolveSetupRecipe` は `GetRecipeCache` の `deleted_at IS NULL`(**M23-03 §4.2 が 2 つで 1 組として意図的に塞いだ**)により、
**削除済み行では `ErrNotFound` を返す**。
**⇒ `D-513` の決着は「撤去しない／計算本体を本番から使う」という形になった**(開発者裁定 B)。
**★`ResolveSetupRecipe` 自体は、依然として本番の直接呼び出し元を持たない。**
**撤去の可否を将来また問うなら、この事実を出発点にすること。**

### 9-2 `CHANGE-127` の反映対象(製造は設計書本体を編集していない)

- **`DES-005` §5.15**: §2 の列構成(コンボ 6 列 / セットプレイ 4 列)。**「本節は列構成を定義していない」の記述を消せる状態にした。**
  あわせて、同節末尾に記録されている**未達 3 件のうち (a)(b) は解消**(ルート列は撤去、タグ列は描画)。
  **(c) 行クリックの 404 は未解消**(`M23-07`・`trash-row-click-404`)。
  M23-04 が残した**未達 2 件も解消**(単件復元の完了トースト / 一括復元の警告内訳)。
- **`DES-002` §4.2**: **`GET /api/setups?onlyDeleted=true` の `defaultRecipe` が、削除済み行でも非空になる**
  (`setup_steps` から解決。**フィールドは増えていない**)。**削除の副作用は変わっていない。**

### 9-3 `M23-07` への申し送り

- 実査 #2 のとおり、**削除済みコンボのレシピを読み取り専用で組み立てる経路は在る**(`notation.ComputeSingleCache`)。
  **本サブは使わない判断をしたが、`M23-07` 以降で必要になったら材料になる。**
- **セットプレイ表に選択列が増えた(3 → 4 列)。** 行の当たり判定と導線を置くときの前提が変わっている。
- **★一括操作バーは「選択が空でも結果が残る間は表示し続ける」形になった**(取り込み・レビュー高-1)。
  **⇒ バーの置き場を決めるときの材料が 1 つ増えている**——結果表示が残る間、バーはコンボ表の上に居続ける。
  レビュー低-6(「セットプレイだけを選んだ利用者は画面上部まで戻る必要がある」)と併せて判断すること。

---

*以上、M23-06 完了報告。同じ根から出た 2 つの症状に、逆の答えを出した。*
