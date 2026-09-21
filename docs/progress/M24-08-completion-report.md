# M24-08 完了報告: `queryKey` の統一 ＋ M24 の繰越 4 件

| 項目 | 内容 |
|------|------|
| 対象指示書 | `docs/instructions/M24-08-querykey-and-carryover.md` **v1.0.0** |
| CHANGE | **`CHANGE-148` v1.0.0**（起票済み。**★製造は番号を消費していない**） |
| 消費マイグレ | **`000080` の 1 本**（`preset_aliases.alias_text` の UPDATE） |
| 着手基点 | `6c9d8c6` |
| 実施日 | 2026-08-30 |

---

## 1. ★★第 1 部の完了時点の E2E 結果（**全体とは別に載せる**）

第 1 部（`CO-009` = `queryKey` の統一）の完了コミットは **`0eaabf3`**。

```
$ make e2e          # 第 1 部 完了時点（コミット 0eaabf3）
  226 passed (4.1m)
```

| 指標 | 第 1 部 完了時点 |
|---|---|
| `make e2e`（**確定実行・絞っていない**） | **226 passed (4.1m)** |
| `pnpm test` | **209 files / 2320 tests 緑**（着手前 207 / 2291。増加分は本サブが足した観測 2 本 / 29 tests） |
| `pnpm build` | 緑 |
| 既存テストの期待値の変更 | **0 件** |
| 第 1 部の numstat | **47 files / +684 / -124** |

**★E2E の着手前基準値は採っていない**（`D-600` 規約 1）。直前にマージされた `M24-07` の完了報告が
**226 passed / exit 0** を明記しており、その確認だけを行った。**⇒ 全数緑（226 件）。**

**★第 1 部で挙動は 1 つも変えていない。** 既存テストの期待値を 1 件も変えず、E2E も件数・内容とも同一である。

### 全体（第 2 部まで）の結果

```
$ make e2e          # 全体 完了時点
  226 passed (3.7m)
```

| 指標 | 全体 完了時点 |
|---|---|
| `make e2e`（**確定実行・絞っていない**） | **226 passed (3.7m)** |
| `go test ./... -count=1` | **exit 0** |
| `gofmt -l .` | **0 件** |
| `pnpm test` | **210 files / 2328 tests 緑** |
| `pnpm build` | 緑 |
| 全体の numstat | **82 files / +1871 / -246** |

---

## 2. ★★§3.3 の実査 16 件の答え（**母数付き**）

| # | 確かめたこと | 実測 |
|---|---|---|
| **1** | `queryKey` の全数とファイル数 | **`queryKey:` 92 箇所 / 43 ファイル**（配列リテラル 77・変数参照 15）。**＋`setQueryData` の位置引数 4 箇所 / 4 ファイル ＝ キーを持つ本番サイト 96 / 44 ファイル**。＋キー定数の定義 **6 件**（配列 const 4・**文字列 const 2**）。テスト側は `queryKey:` 5 箇所 / 3 ファイル、`setQueryData` 16 箇所 / 8 ファイル。**`web/e2e/` は 0 箇所**。 **★指示書の「84 箇所 / 39 ファイル」は過少だった**（＋8 箇所 / ＋4 ファイル） |
| **2** | **契約 F-2 の「形を変えない」の意味** | **★モデル説で確定。止まる理由は無かった。** `D-291` の主文は表記法に一切触れず「`presets` にキャラ軸の列を足さない」というデータモデルの決定である。3 面（Go の JSON フィールド／TS の配列／TOML キー）は表記が三者三様であり「同じ表記の凍結」は成立しない。**F-2 を引用した実運用文書 3 本**（`M20-05` 指示書 §83 ／ 同チェックリスト §54 ／ `CHANGE-102` §100）**がいずれも「形」を「値」と対比**させている。**⇒ リテラル説を支持する記述は実査 21 箇所中 0 件。§4.1.1 の裁定（`D-619`）と食い違わない。** ★3 面の現在の形＝`internal/api/combo/dto.go:278-286` の `RecipeResponse.PresetID int64` ／ `internal/config/config.go:107-111` の `DefaultsConfig.PresetID`（**★`config.toml.example` に `[defaults]` 節は存在しない**。Go の構造体・既定値・検証にのみ実在）／ `web/src/features/combo/api.ts` の `["combo", comboId, "recipe", presetId]` |
| **3** | 現在の作法（母数 92） | **A: flat 配列 60 ／ B: object を含む配列 16 ／ C: object 変数まるごと 1 ／ D: 定数参照 15 ／ ネスト 0 ／ テンプレート 0**。ルート文字列 18 種で命名が 3 通りに割れる（kebab 5・camel 2・素の小文字 11）。`as const` は 5/92 |
| **4** | invalidate 側の全数 | `invalidateQueries` **58**（58/58 が新形式 `{queryKey}`）／ `removeQueries` **3** ／ `setQueryData` **4**（位置引数）。`cancelQueries` / `getQueryData` 等は **0** |
| **5** | **「静かに壊れる」経路** | **★★実在した。しかも観測がほぼ無かった。** `exact` / `predicate` は **0 件** ＝ **61 件すべてが既定の前方一致**で動く。**58 件中 39 件が前方一致に依存**。それが「実在の query に当たること」を観測していたのは **2 / 58 ≒ 3.4%** で、**前方一致依存 39 件を守る E2E は 0 件**。既存 vitest 3 本は spy の引数リテラルを見るだけで、両側を同時に書き換えれば常に緑にできる。**⇒ §5.1-2 を「実物の QueryClient で当たりを表に固定する」形にした（§5 参照）** |
| **6** | ゴミ箱がキャラを渡す箇所 | **本番 2 行 / 1 ファイル**（`TrashPage.tsx:12,16`）。**コンボ側 `:27` とセットプレイ側 `:35` が同じ 1 変数を受けている。** hook・下位部品にキャラ固定は **0 件**（`TrashList` / `TrashBulkActions` / `TrashSetupList` / `TrashComboDetailPage` に `characterId` の出現 0）。`TODO(M3+)` はコード側 **1 箇所**。**★前任設計卓の「FE 側の 1 か所で足りる見込み」は正しかった** |
| **7** | ゴミ箱の queryKey と invalidate | 両方すでに `characterId` を含む（`["combos","trash",characterId]` ／ `["setups","trash",characterId]`）。`["combos"]` の invalidate は**本番 9 件 / 8 ファイル**、`["setups"]` は **3 件 / 3 ファイル**（いずれも前方一致で届く） |
| **8** | `CharacterSelector` を使えるか | 使える。`features/mycombo/components/CharacterSelector.tsx`・使用 **13 箇所 / 11 ファイル**。**新しい部品は作っていない** |
| **9** | **`alias_text` の対象行の全数** | **★★「2 行」ではない。実測 38 行**（19 キャラ × 2 code）。マイグレ側の投入は **10 行 / 5 マイグレ**（`000006` `000011` `000025` `000044` `000054`）。**★`000075` が `UNIQUE(preset_id, character_id, alias_text)` を張っており衝突確認が要る**（新表記と同値の alias は `official_ja_move` に無い。既存の類似値はすべて「【強化】…ステップ」で別文字列）。マイグレ連番は欠番なし・最大 `000079` ⇒ **`000080` で正しい** |
| **10** | **`recipe_cache` は自動で再構築されるか** | **★★★「ボタン待ち」ですらなかった。** (1) **起動時の自動再構築は無い**（`main.go:287` は `RecomputePresetCache` を config サービスへ**注入するだけ**で、起動時には呼ばれない） (2) **設定画面の「キャッシュ再構築」は `disabled` の未実装で、対応 API も存在しなかった** (3) `official_ja_move` は組み込みのため `PUT /api/presets/:id` が **403**（`authorizeMutation` の VAL-P01）で、エイリアス更新経由の再計算にも乗せられない (4) 一覧経路 `extractDefaultRecipe` は**フォールバックを持たない**（キーが無ければ空文字）。 **★先例が裏付ける**——`000022` は「移行前後で表示文字列がバイト一致するのでキャッシュは有効なまま」と明記して regen を回避していた。**本サブは文字列を変えるためその根拠が成立しない。** **⇒ §9.1-3 の分岐が成立。開発者へ報告し裁定を得た（§3 参照）** |
| **11** | `en` は Dash のままか | **★`official_en_move` というプリセットは存在しない**（リポジトリ全体で 0 件）。ja/en は preset ではなく**列**で分ける（`alias_text` / `alias_text_en`）。**`official_ja_move` は `alias_text_en` を 1 行も持たない**（`D-289`＝同プリセットは日本語の公式技名そのものであり英語版を「持たない」と確定。`000070` の注記）。ダッシュの英語表記は別プリセット **`srk` の `alias_text = 'dash' / 'backdash'`**。**⇒ preset_id で絞れば構造的に巻き込まない** |
| **12** | `useCheckDuplicate` と `CO-010` の進捗 | **★`CO-010` は 0%。1 行も着手されていなかった。** 生 `fetch` ＋ `useEffect` ＋ `AbortController` ＋ 手書き 3 state ＋ 手書き debounce。`@tanstack/react-query` の import 0 件。同じ `hooks/` の 20 ファイル中 TanStack を使うのは 4 ファイルで、本フックはその外に居た。本番呼出は **1 箇所**（`ComboEditor.tsx:336`） |
| **13** | 重複エラーの文言と、差分が読めない理由 | 文言は **FE 製 100%**（`ja.json:298`）。BE は文字列を返さない。 **★★理由は「情報が足りない」だけではなかった**——重複判定は**判定キー 6 項の完全一致 ＋ `recipe_hash` の完全一致**で成立する。**⇒ 一致した時点でキー項目もレシピも差分は原理的にゼロ**であり、着手前の文面はその「必ず一致する項目」だけを並べていた。**しかも表示していた 6 項は要求値のエコーバック**であって一致した行から読んだ値ではない（`dto.go:317-318` が明記）。**⇒ 差が出うるのは判定に使わない項目だけ。** そのうち **`memo` は BE が既に返しているのに、`useCheckDuplicate.ts` の型で落ちていて画面へ届いていなかった** |
| **14** | `pr-checks.yml` の job 構成 | 3 job（`go-vet-build` / `go-test` / `web-test`）。`go vet ./...` は `:82-83`。**`gofmt` は 0 件**。E2E は `nightly-crossbuild.yml` の `e2e` job |
| **15** | **`gofmt -l` の現在の検出数** | **1 件のみ**＝`internal/infra/migration/migrate_m2402_test.go`（報告どおり `M24-02` 由来）。差分は **1 ハンク・godoc コメントの整形のみでコード本体 0 バイト**（Go 1.19 の doc comment 再整形規則）。**⇒ 母数 1 なので (a) 先に是正を選んだ。ベースライン固定型は採らない**（§4 参照） |
| **16** | `ComboEditorBasicFields` を第 1 部で触るか | **触らない**（`queryKey` は 0 件。データ層への接続は `useMyComboStatusTags` の間接 import 1 本のみ）。**★ただし条件付き E の前提そのものが失効していた**（§6 参照） |

---

## 3. ★★★止めて報告した事項と、その裁定（**§9.1-3**）

**§3.3-10 の実査で `§9.1-3` の分岐が成立したため、手を止めて開発者へ報告した。**

> `alias_text` を直しても、利用者がボタンを押すまで `recipe_cache` が古いままである
> → **止めて設計卓へ報告する。★それは「配布後に直らない」ことを意味する**

**★実態は指示書の想定より悪かった**——「ボタン待ち」ではなく**ボタンが未実装**であり、
組み込みプリセットは `PUT` が 403 のため回復経路が実質存在しなかった。

**★ただし影響範囲は限定される**——**新規 DB は無害**である（`000006` → `000080` の順で適用され、
その時点でコンボは 0 件）。**影響は既存 DB のみ。**

### 開発者裁定（2026-08-30）

| 事項 | 裁定 |
|---|---|
| **`recipe_cache` の扱い** | **★再構築ボタンを実装する。** 設置場所は **設定＝全プリセット ／ プリセット編集画面＝その 1 枚** |
| **条件付き E（`normal`/`counter`）** | **「通常／カウンター」へ寄せる** |
| **`pr-checks.yml:221` の契約 2 違反** | **同時に是正する。ただし「意味があるものではないか」を確かめてから直すこと** |

**★契約 F-2 については食い違いが出なかったため止めていない**（§2 の実査 2）。

---

## 4. 製造が決めた事項と、その理由（**§9.2**）

### 4.1 `queryKey` の統一先

**`web/src/lib/query-keys.ts` に `queryKeys` ファクトリを新設し、本番のキー 96 サイト / 44 ファイルをすべてそこ経由にした。**

作法（ファクトリが機械的に強制する）:

1. 配列。第 1 要素はドメインのルート文字列。
2. **階層はリテラル文字列 ＋ スカラーの位置引数（flat）を正典とする。**
3. **末尾 object は「多フィールドのフィルタ束」のときだけ許す。**

**★★値は原則として動かしていない。動かしたのは「定義の置き場」である。**

**理由＝「object を flat へ完全に平坦化する」ことは、第 1 部の成果物（挙動を 1 つも変えない）と両立しない。**
実測で以下 3 件は、値を正規化すると matching の意味が変わる:

| 平坦化できない箇所 | 平坦化すると何が起きるか |
|---|---|
| **`tags`** — invalidate 側 `byCategory(true, cat)` が query 側 `statusCounts(cat, id)` の**真部分集合** | **`partialDeepEqual` にのみ依存している唯一の経路。** flat 展開すると前方一致で代替できず、マイコンボの件数が静かに更新されなくなる |
| **`setupCandidates`** — `byCombo(comboId)` と `byKnockdown({...})` が同じルートを共有 | 両方を flat にすると **`byCombo(5)` が `byKnockdown({characterId:5,...})` を巻き込むようになる**（現在は巻き込まない）＝挙動変更 |
| **`combo.recipe`** | `combo.detail(id)` の invalidate **10 箇所**が前方一致でレシピも同時に落としている。**これが契約 F-2 の FE 側の実体である。** object 化すると切れる |

**⇒ これは §9.1-4「第 1 部で挙動を変えないと統一できない箇所が在る」に当たるため、Plan Mode で報告して承認を得た。**
3 件は現行の値のままファクトリへ写し、**なぜ平坦化しないかをファクトリ内へ逐語で残した**（残さないと次の担当が「統一漏れ」と見て平坦化し、静かに壊す）。

値を実際に揃えたのは、揃えても matching 関係が変わらないと示せる箇所だけ:

- `["setup", { id }]` と `["setup", { id: setupId }]` の表記ゆれ → `queryKeys.setup.detail(id)` に一本化（**値は同一**）
- `as const` の有無（5/92）→ ファクトリで統一（型のみ・実行時同一）
- **`moves/api.ts:106` の `["punish-finder"]` リテラル直書き**（`PUNISH_FINDER_KEY` を import していなかった二重定義）→ ファクトリ経由（**値は同一**）
- 変数参照 15 箇所と const 定義 6 件（**文字列 const 2 件を含む**）→ ファクトリへ吸収

**★契約 F-2 の 3 条件はすべて満たしている**——`presetId` は `combo.recipe` の構成要素として残り、
他の 2 面（`RecipeResponse.presetId` ／ config `[defaults] preset_id`）は **1 行も触っていない**。

> **★推測で進めた箇所（`CLAUDE.md` §9）**: 「統一先の形」は §4.1 / §9.2 で製造の裁量とされている。
> **推測: 「値を動かさないこと」を「表記を揃えること」より優先すると仮定した。** 第 1 部の成果物が
> E2E 非回帰であるためである。ファクトリ冒頭にその旨を書いてある。

### 4.2 ゴミ箱のキャラ選択の既定値

**`useResolvedCharacterId()`（URL → session → config → `INITIAL_CHARACTER_ID`）へ合流させた。本画面が 6 番目の呼び手になる。**

**理由＝`web/src/lib/constants.ts:19-21` が、画面から `INITIAL_CHARACTER_ID` を直接参照することを明示的に禁じている**——
「参照すると『いま対象にしているキャラ』を決める規則がその画面の分だけ増える」。
**`DEFAULT_CHARACTER_ID = 1` はまさにその残骸だった。** 既存 5 面と規則が揃う。

選択後は選択値が勝つ（`pickedCharacterId ?? resolvedCharacterId`）。`null` を「まだ選んでいない」の意味で保持しているのは、
config の取得完了で解決値が動きうるためである。

**★キャラを切り替えたら行の選択を捨てる。** 残すと、画面に出ていない行を一括操作バーが掴んだままになる。

### 4.3 `gofmt` の赤の扱い

**(a) 先に是正 を選んだ。**（(b) ベースライン固定型は採らない）

**理由＝母数が 1 件しかなく、しかもコード本体は 0 バイトの godoc コメント整形だったため。**
ベースライン型は「今は直せないが増やしたくない」ときの手段であり、1 件を直せる状況で採ると検査が緩む。

**★是正は `gofmt -w` ではなく、継続行の字下げを外す形にした。**
Go 1.19 の gofmt は doc コメント内の字下げ行を**コードブロック**と見なしてタブ ＋ 前置の空行へ変えるため、
`-w` だと散文のつもりの折り返しが godoc でコードブロックに化ける。字下げを外せば散文のまま通る。

### 4.4 重複エラーの差分表示の形

**既存コンボを `GET /api/combos/:id`（既存の `useCombo`）で引き、判定に使わない 7 項目を突き合わせて「既存 → 今の入力」の形で出す。**

**★BE の応答は 1 バイトも増やしていない。** 重複判定の応答へ項目を足すと契約が広がるためである。

対象＝メモ・ダメージ・ドライブダメージ・消費 SA・消費ドライブ・ダウン有利・タグ数。

文面は **`DES-005` §5.7:536 が定める行動を促す形**（「…と同一です。何かを変更してから保存してください」）へ寄せた。
**着手前の文面が状況の羅列で止まっていたことが `SM-068`「ちょっと不自然」の正体である。**

---

## 5. 追加した観測（テスト）

| # | ファイル | 何を守るか |
|---|---|---|
| 1 | `web/src/lib/query-keys.convention.test.ts` | `queryKey` の配列リテラルを正本の外に書かせない（先例＝`locales/retired-words.test.ts`）。`setQueryData` / `removeQueries` への直接渡しも見る |
| **2** | `web/src/lib/query-keys.invalidation.test.ts` | **★★実物の `QueryClient` に canonical な query を全数投入し、各 invalidate が「当てるべき集合にちょうど当たる」ことを表で固定する。** 前方一致依存 39 件と `partialDeepEqual` 依存 1 件を明示的に載せた。**★`queryKeys` の leaf の載せ忘れも検出する**（実際に `setplaySuggestions.all` の載せ忘れを検出した） |
| 3 | 同上（末尾の describe） | 契約 F-2 の 3 面——`presetId` が構成要素として残ること／`presetId` ごとに別実体になること／`combo.detail(id)` が `combo.recipe(id,*)` の前方部分列であること |
| 4 | `web/src/pages/TrashPage.character.test.tsx` | **コンボ表とセットプレイ表の「両方」がキャラに追従すること** |
| 5 | `internal/infra/migration/migrate_m2408_test.go` | 往復整合／**en・他プリセットの非巻き込み**／母数の記録／**マイグレが `recipe_cache` を書き換えないこと**。**★初版のガードは空振りだった（レビュー 中-2 で是正）**——「新規 DB でキャッシュを持つ行が 0 件」を見ていたが、新規 DB にはコンボが 1 件も無く、**何を壊しても緑で通る**形だった。**⇒ 000079 の時点で「古い表記のキャッシュを持つコンボ」を自分で作り、000080 を当てた後もその値が 1 バイトも変わっていないことを見る形へ直した。** 破壊確認済み（000080 が `recipe_cache` も書くようにすると赤くなる） |
| 6 | `internal/api/preset/recipe_cache_handler_test.go` | **組み込みプリセットで 200 になること**（本ルートの存在理由）／404 / 400 / 500 / 501 ／ルート登録 |
| 7 | `web/src/features/combo/components/DuplicateRealtimeWarning.test.tsx`（追記） | 遷移せずに差分が読めること／一致時はその旨を出すこと |

### 5.1 既存テストの扱い（**1 件ずつの判定**＝§5.2）

| 対象 | 判定 | 扱い |
|---|---|---|
| **第 1 部の全既存テスト** | — | **1 件も変えていない。1 本も消していない・skip していない** |
| E2E 7 spec の `TRASH_CHARACTER_ID` のコメント | **「たまたま現状を写しただけ」** | **コメントのみ是正。アサーションは残した**——値は変わらず（解決値が E2E 環境では 1）、かつ「既定の解決が静かに変わらないこと」を守る観測として意味を持つ。**★ただし旧コメントは削除済みの定数を名指ししており失効した記述だったため直した** |
| `SettingsPage.test.tsx`「3 ボタンすべて disabled」 | **たまたま現状を写しただけ**（未実装のプレースホルダの記録） | **分割した**。バックアップ／リストアは未実装のまま主張を残し、キャッシュ再構築は「押せる」へ反転。**先例＝`M22-02` が同じファイルで「パスワード変更」について同型の反転を行っている** |
| `useCheckDuplicate.test.ts` | **主張は変えていない** | `QueryClientProvider` と `waitFor` を足しただけ（TanStack は応答の解決が 1 tick 遅れる） |
| `DuplicateRealtimeWarning.test.tsx:68` | **緩い主張だった** | **締めた。** `"comboEditor.duplicateRealtime"` は `"…Heading"` の**部分文字列**であり、鍵を差し替えても緑のまま通っていた（`M24-07` の「ステップ」／「コンボステップ」と同型の罠） |

**★テストは 1 本も減っていない**（着手前 207 files / 2291 tests → 210 files / 2328 tests）。

---

## 6. ★落とした項目と、その理由

| 項目 | 扱い |
|---|---|
| **条件付き E（`normal` / `counter`）** | **★落としていない。実施した。** **ただし followup の前提が失効していた**——「`ComboEditorBasicFields` 236 行の直書きを触らずには畳めない」とあるが、**同ファイルは実測 910 行で直書きは無く、`labels.ts:107` の `HIT_TYPE_OPTIONS` を import している。** 実際の割れは `ja.json:801-802`「通常／カウンター」と `labels.ts:101-102`「通常ヒット／カウンターヒット」の 2 系統 **＋ `PunishList.tsx:339` の JSX 直書き（混在文）で計 3 系統**だった（`labels.ts:5-13` の注記は「2 本」と書いており JSX 直書きを数えていなかった）。**⇒ 開発者裁定で「通常／カウンター」へ寄せ、3 系統とも畳んだ** |
| `SM-016`（コンボの単位語） | **扱っていない**（`D-618` で `M25` 以降へ送られている＝§1.6-9） |
| 英語ロケールの残り | **扱っていない**（§1.6-10。開発者判断で据え置き） |

---

## 7. ★★破壊確認（5 件・実施コマンドと出力）

### 破壊確認 1 — 統一後の `queryKey` を 1 か所だけ旧の形へ戻す

```
$ sed -i 's|queryKey: queryKeys.combos.trash(characterId),|queryKey: ["combos", "trash", characterId],|' \
    src/features/combo/hooks/useTrashCombos.ts
$ pnpm exec vitest run src/lib/query-keys.convention.test.ts
   × queryKey の作法(M24-08 / CO-009) > queryKey の配列リテラルを lib/query-keys.ts の外に書かない
AssertionError: queryKey の配列リテラルは web/src/lib/query-keys.ts の queryKeys ファクトリへ置くこと。
  直書きすると invalidateQueries 側とドリフトし、静かにキャッシュが効かなくなる。: expected [ Array(1) ] to deeply equal []
      Tests  1 failed | 2 passed (3)
```
**⇒ 赤。** 復旧後 3 passed。

### ★★★破壊確認 2 — `invalidateQueries` のキーを 1 か所だけずらす（**本サブで最も重要**）

**(a) invalidate 側をずらす**（`include_usage` → `includeUsage`）

```
$ pnpm exec vitest run src/lib/query-keys.invalidation.test.ts
   × 'tags.byCategory(true)' は expects の query にちょうど当たる
AssertionError: ★★前方一致ではなく object の部分一致(partialDeepEqual)にのみ依存している唯一の経路。
  flat へ展開すると代替できず、マイコンボの件数が静かに更新されなくなる(注記 a):
  expected [] to deeply equal [ 'tags.statusCounts' ]
      Tests  1 failed | 25 passed (26)
```

**(b) ★より鋭い変種——query 側だけをずらす（invalidate 側は無傷）**

```
$ # queryKeys.tags.statusCounts の include_usage → include_usage_flag
$ pnpm exec vitest run src/lib/query-keys.invalidation.test.ts
      Tests  1 failed | 25 passed (26)            ← ★新設テストは赤

$ pnpm exec vitest run   # 新設の invalidation テストだけを除いた全数
      Tests  2294 passed (2294)                    ← ★★既存テストは全数緑のまま
$ pnpm exec tsc --noEmit -p tsconfig.json
TSC_EXIT=0                                          ← ★型検査も緑
```

**⇒ これが「静かにキャッシュが効かなくなる」の実物である。** invalidate が当たらなくなっても、
**既存 2294 テストも型検査も何も言わない。** 本サブが足した観測だけが検出する。

> **★(a) では既存の `useUpdateMyComboStatus.test.ts` 6 件も赤くなった。** ただしあれは
> **spy に渡った引数のリテラル**を見ているだけであり、「invalidate が実在の query に当たるか」は見ていない。
> **⇒ (b) のように query 側だけをずらすと、あちらは緑のまま通る。** 両者は別の観測である。

### 破壊確認 3 — ゴミ箱のキャラ選択を定数へ戻す

**(a) 両表を定数へ**

```
$ sed -i 's|const characterId = pickedCharacterId ?? resolvedCharacterId;|const characterId = 1;|' src/pages/TrashPage.tsx
$ pnpm exec vitest run src/pages/TrashPage.character.test.tsx
   × 既定は共通機構が解決したキャラであり、固定値 1 ではない
   × ★キャラを切り替えると、コンボ表とセットプレイ表の両方が新しいキャラで引き直される
      Tests  2 failed | 1 passed (3)
```

**(b) ★セットプレイ表だけ固定値へ戻す（「片方だけ直す」事故の再現）**

```
$ sed -i 's|} = useTrashSetups(characterId);|} = useTrashSetups(1);|' src/pages/TrashPage.tsx
$ pnpm exec vitest run src/pages/TrashPage.character.test.tsx
   × 既定は共通機構が解決したキャラであり、固定値 1 ではない
   × ★キャラを切り替えると、コンボ表とセットプレイ表の両方が新しいキャラで引き直される
AssertionError: expected "spy" to be called with arguments: [ 3 ]
AssertionError: expected "spy" to be called with arguments: [ 9 ]
      Tests  2 failed | 1 passed (3)
```
**⇒ コンボ表とセットプレイ表の両方で赤くなる。** 復旧後 7 passed。

### 破壊確認 4 — Go のファイルを 1 つ整形崩れにする

```
$ # internal/api/combo/dto.go の RecipeResponse へ字下げを崩した行を差し込む
$ bash -e -c 'UNFORMATTED="$(gofmt -l .)"; if [ -n "$UNFORMATTED" ]; then \
    echo "::error::gofmt に非適合のファイルがあります。gofmt -w 相当の整形が要ります:"; \
    echo "$UNFORMATTED"; exit 1; fi; echo "gofmt: 非適合 0 件"'
::error::gofmt に非適合のファイルがあります。gofmt -w 相当の整形が要ります:
internal/api/combo/dto.go
  exit=1

--- 対照 ---
  go vet   exit=0
  go build exit=0
```
**⇒ PR チェックの `gofmt` step が赤くなる。`go vet` / `go build` はいずれも素通りする**
（＝「守るべきものはあるが PR で観測されていない」型そのもの）。

### 破壊確認 5 — `alias_text` を「前ダッシュ」へ戻す

```
$ # 000080 の CASE を no-op にする
$ go test ./internal/infra/migration/ -run "M2408" -count=1
--- FAIL: TestRun_M2408_GroundDashLabelUpDown (0.49s)
    migrate_m2408_test.go:39: ★是正対象の母数(実測): official_ja_move の「前ダッシュ/後ろダッシュ」= 38 行
    migrate_m2408_test.go:49: up 後も「前ダッシュ/後ろダッシュ」が残っている (19 行)
    migrate_m2408_test.go:55: up 後の「前方ステップ/後方ステップ」が母数と一致しない: 19(期待 38)
FAIL
```
**⇒ 赤。** 復旧後 ok。

**★破壊確認後の確定実行は絞っていない**（`make e2e` を全数で回した＝§1）。

### 番外 — 契約 2 の是正が「意味のあるもの」であることの実測

開発者の指示（「意味があるものではないかは注意して直す事」）に対する確認。

```
$ # 実際に赤い vitest を tee へ流す
$ bash -e -c 'pnpm exec vitest run <赤いテスト> 2>&1 | tee /tmp/x.log'          ; echo $?
0        ← ★pipefail なし（= 着手前の :221 と同じ形）。job は緑のまま通る
$ bash -e -c 'set -o pipefail; pnpm exec vitest run <赤いテスト> 2>&1 | tee /tmp/x.log'; echo $?
1        ← pipefail あり
```
**⇒ 体裁ではない。Vitest の失敗が PR を止めていなかった。**

### 番外 2 — 実サーバでの疎通確認（**ルート登録は単体テストだけでは足りない**）

ハンドラの単体テストは `RegisterRoutes` までしか見ていない。**`main.go` の配線（関数注入）が実際に通るかは別の主張である**ため、バイナリを建てて確かめた（使い捨て DB・専用ポート 47391）。

```
$ curl -X POST /api/presets/1/recipe-cache/rebuild      -> HTTP 200  {"presetId":1}
$ curl -X PUT  /api/presets/1                           -> HTTP 403  builtin_protected
$ curl -X POST /api/presets/999999/recipe-cache/rebuild -> HTTP 404
$ curl -X POST /api/presets/abc/recipe-cache/rebuild    -> HTTP 400
```

**★組み込みプリセットで再構築は 200、同じ組み込みへの `PUT` は 403 のまま。** ⇒ 本ルートは通り、かつ `VAL-P01`（組み込みは編集も削除もできない＝`D-290`）を緩めていない。

**★マイグレ `000080` の適用結果も実サーバの API で確かめた**（新規 DB）:

```
official_ja_move / character_id=1:
  dash_forward -> '前方ステップ'   alias_text_en: None
  dash_back    -> '後方ステップ'   alias_text_en: None
srk / character_id=1:
  dash_forward -> 'dash'          <- 英語表記は無傷
  dash_back    -> 'backdash'
```

---

## 7.1 ★★実機確認の結果（2026-08-30・開発者）

**M24-07 の記録**（「英語 UI は実装もレビューも実物を見ておらず、本サブの目的の半分が未検証のまま手交されるところだった」）を受け、手交前に開発者が実機で 6 件を確認した。

| # | 確認したこと | 結果 |
|---|---|---|
| **1** | **既存 DB の古い表記が、再構築で直ること** | **★★問題なし。** **本サブで唯一「自動テストが原理的に届かない」主張が、実機で確認できた**——E2E は使い捨て DB を毎回作り直すため stale cache が発生しえず、Go テストは「stale のまま残ること」までしか見ない |
| **2** | ゴミ箱のキャラ選択 | **想定どおり。ただし手順対象外の事象を 1 件発見**（下記） |
| **3** | 重複エラーの差分表示 | **表示に不満**。⇒ 是正した（下記） |
| **4** | `normal` / `counter` の表示語 | **想定どおり** |
| **5** | 英語 UI の周回 | **想定どおり**。ゴミ箱は英語 ／ プリセット編集画面は日本語のまま ／ 確定反撃・マイリストも日本語のまま（**全面直書きの面であるため。`CO-026` の手番**） ／ 重複警告は英語 |
| **6** | `gofmt` の PR チェック | **PR を開いたときに見る**（`on: pull_request`）。本ブランチではまだ未実施 |

### 確認 2 で見つかった事象 — **★本サブ由来ではない**

**症状**: ゴミ箱の一括操作バーで参照中のセットプレイを完全削除すると **「2 件失敗: ds2 / delse1」** としか出ず、理由が分からない。開発者には「セットプレイの削除が一切できない」と読まれた。

**★切り分けの根拠 3 つ**:

1. **既知・既起票である。** followup **`trash-bulk-permanent-delete-reason-hidden`**（割付 `M23-CLOSE` ／ 状態「未着手（**開発者判断 2026-08-23「申し送りで構わない」**）」）の逐語と症状が一致する——「一括操作バーから参照中のセットプレイを完全削除すると『1 件失敗: 〈名前〉』としか出ない」。
2. **コードの根拠が一致する。** `TrashBulkActions.tsx` の `errorMessage()` に **「画面へは出ない。診断用の値である」** とコメントがあり、`FailedItem.error` は捕捉されるが描画されていなかった。
3. **本サブは当該部品を 1 行も触っていない。** `git diff --name-only 6c9d8c6..HEAD` に `TrashSetupList.tsx` / `TrashBulkActions.tsx` は現れない（触ったのは `TrashPage.tsx` のキャラ選択と、`queryKey` のファクトリ化のみ。しかも後者は `onSuccess` の中身であり、mutation が成功した後にしか走らない）。
4. **復元は動く**（開発者の実機確認）。⇒ セットプレイの行操作全般が壊れているのではなく、完全削除の拒否表示に限った話である。

**⇒ 開発者が実機で踏んだため、判断を更新して前倒し是正した**（§7.2 参照）。

---

## 7.2 実機確認を受けた是正（2 件）

### (a) 重複バナーの一致項目に項目名を付けた（確認 3）

**要求の逐語**: 「各項目の前に何なのか項目名があった方が良い」「レシピは完全一致した場合のみのエラーなのだから（6手）部分は余計なので消して欲しい」

- 旧: `一致している判定項目: JP・立ち弱P / 画面中央 / 立ち / 通常 / 中 / レシピ（6手）`
- 新: `一致している判定項目: キャラクター：JP / 始動技：立ち弱P / ポジション：画面中央 / 相手の状態：立ち / ヒット種別：通常 / 相手の大きさ：中 / レシピ`

**★ラベルはエディタ自身のフィールド見出しに揃えた。** バナーはエディタの中に出るため、すぐ上の欄と同じ語になる。**★新規 i18n キーは増やしていない**（ラベルをテンプレート内に持たせた）。**★`（6手）` を落としたことで `DuplicateLabelParts.stepCount` の参照が 0 になったため、型からも削除した。**

### (b) 一括バーが失敗の理由を捨てていた件を是正した（確認 2 ／ **`M23-CLOSE` の前倒し**）

**★開発者裁定で「段 2 まで」と定めた。** 3 つの欠落のうち 2 つを埋める。

| 段 | 内容 | 本サブ |
|---|---|---|
| 1 | 失敗の**理由**を出す | **やった** |
| 2 | **どのコンボが掴んでいるか**を出す | **やった** |
| 3 | **紐付け解除ボタン**を一括バーにも置く | **やらない**（行部品と重複し共通化のリファクタを伴う。`M23-CLOSE` に残す） |

**★既存部品の再利用だけで足りた。API 変更ゼロ・新しい文言概念ゼロ**——エラーコード定数（`API_ERROR_CODE_SETUP_IN_USE` 等）も `WarningDetails["combos"]` 型も `trash.setup.inUse` の文言も、**すべて行部品（`TrashSetupListRow`）が既に使っているもの**である。同じ拒否が画面の場所によって違う言葉で出ると、利用者は別の事象だと読むため、文言は行単位と揃えた。

**★復元側の失敗にも同じ解決を通した**——`FailedItem` は復元と完全削除で共有されており、片方だけ直すと型が割れる。既定の文言は操作ごとに変える（`trash.setup.restoreError` ／ `trash.setup.permanentDeleteError`。**既存キーの再利用で、汎用の新キーは作っていない**）。

**破壊確認**: `setup_in_use` の分岐を無効化すると、追加したテストが赤くなる。

```
$ # resolveFailure の setup_in_use 分岐を無効化して実行
AssertionError: expected '1 件失敗ds2：完全削除に失敗しました'
  to contain 'このセットプレイは使用中のコンボに紐づいているため、完全に削除できません'
      Tests  1 failed | 14 passed (15)
```

**★★コミットの粒度について（記録）**: 本節 (b) は **`M24-08` の射程外であり別コミットにする計画だった**が、`git add -A` により **(a) と同じコミット `9b02464` に相乗りしてしまった**。同コミットのメッセージは (a)（確認 3）しか説明していない。**⇒ `git reset` は `.claude/settings.json` で deny されており、`--amend` は履歴改変にあたるため使わなかった。事実を本節と followup へ記録して辿れる形にしてある。** 履歴を整えたい場合は開発者の手番である。

---

## 8. 契約との照合

| 契約 | 結果 |
|---|---|
| **F-2**（`preset_id` 単一値） | **守った。** `presetId` は `combo.recipe` の構成要素として残る。他の 2 面は 1 行も触っていない。§3.3-2 の実査は §4.1.1 の裁定と食い違わなかった |
| **F-1**（`recipe_cache` の組み立て ／ `service/notation/` ／ `service/preset/`） | **守った。両ディレクトリは 1 行も変えていない**（再構築 API は既存の `RecomputePresetCache` を呼ぶだけで、変更は `internal/api/preset/` とルート登録のみ）。**`recipe_cache` をマイグレで書き換えていない** |
| **`DES-002` §11.3 の契約 5 件** | **1 つも落としていない。** ★むしろ**契約 2 の既存の違反 1 件を是正した**（`tee` を使う 3 step すべてが pipefail を持つ状態になった。着手前は 2/3） |
| **`DES-002` §4.2 の経路表** | **変わっていない。** BE は着手前から `character_id` / `characterId` をクエリから読む変数であり、**BE の変更は 0 行** |
| **`DES-002` §7.5**（`preset_aliases` の構造） | **構造は変えていない。値だけ直した** |
| `DES-002` §7.6（CSV 列名 / ZIP エントリ名） | **触っていない** |
| `web/playwright.config.ts` の `workers` | **`1` のまま** |
| `pr-checks.yml` への E2E | **足していない**（言及はコメント行のみ） |

---

## 9. ★併せて更新が要るもの

| 項目 | 状態 |
|---|---|
| **CHANGE 番号の消費** | **なし。`CHANGE-148` は設計卓が起票済みであり、製造は番号を消費していない**（§7.4.1） |
| **`change-number-registry.md` §1 への登録** | **不要**（番号を払い出していないため） |
| **消費したマイグレ連番** | **`000080` を 1 本消費した。** 実査＝`ls migrations/` の最大が `000079` で欠番なし ⇒ **次に払い出す番号は `000081`**。ボード §2.2 の「次に払い出す番号」の更新が要る（**設計卓の手番**） |
| **版を上げた文書の参照元** | **なし**（本サブは設計書本体を編集していない） |
| **`web/CLAUDE.md` §1 のストレージ台帳** | **更新不要。** 新しいブラウザストレージキーは足していない（ゴミ箱のキャラ選択は画面内の一時状態であり `useState` に置いた）。`check-browser-storage-keys.sh` 緑 |
| **`DES-002` §4.2 / §11.3 ／ `DES-005` §5.7 / §5.15 / §5.16 への as-built 反映** | **設計卓の手番**（§10 の as-built 一覧を参照） |
| **★削除した識別子を名指ししている資料**（レビュー 高-4） | **本サブで `AUTH_STATUS_KEY` / `CONFIG_KEY` / `USERS_KEY` / `PRESETS_KEY` / `PUNISH_FINDER_KEY` / `PUNISH_LIST_KEY` の 6 件を削除した**（`queryKeys.*` へ畳んだ）。**⇒ 次の 2 か所が失効している**——(1) **`DES-005` §5.16**（`docs/design/05-screen-design.md:1207` の「`USERS_KEY` の invalidate から導出し直す形」。**設計卓の手番**） ／ (2) **`docs/handover/code-facts.md` §2-2**（6 件の const 定義行を掲載している。**`/regen_code_facts` で再生成できる**。`check-derived-docs.sh` は変化量 173 / 1072 件（16%）で陳腐化疑いを出している） |

---

## 10. as-built（設計書へ反映が要る差分）

| 対象 | as-built |
|---|---|
| **`DES-002` §11.3** | PR 検査へ **`gofmt`** が載った（`go-vet-build` job）。**★`gofmt -l` は非適合でも exit 0 のため、出力の非空で判定している。** あわせて**契約 2 の既存の違反 1 件を是正**（`web-test` の `tee` に `set -o pipefail` が無かった） |
| **`DES-002` §4.2** | **経路は変わっていない。** ただし**新ルート 1 本を足した**——`POST /api/presets/:id/recipe-cache/rebuild`。成功 `200` ＋ `{presetId}`／異常 `400 invalid_id` ／ `404 not_found` ／ `500 internal_error` ／ `501 not_implemented`。**★組み込みでも 403 にしない**（`authorizeMutation` を通さない） |
| **`DES-005` §5.15** | ゴミ箱にキャラ選択が付いた。**コンボ表とセットプレイ表の両方を 1 つのセレクタが支配する。** 既定は `useResolvedCharacterId` の解決値 |
| **`DES-005` §5.16** | **「レシピキャッシュ再構築」が実装された**（着手前は `disabled` の未実装）。射程＝**全プリセット**。プリセット編集画面には 1 枚分のボタンを置いた。 **★★ただし同節が求める 2 つの性質は満たしていない**（`docs/design/05-screen-design.md:1224` の逐語＝**「レシピキャッシュ再構築ボタン（進捗表示付き、中断耐性あり）」**）。**実装は `rebuilding` の真偽値と枚数のトースト（「N / M 件」「『名前』で失敗しました」）だけであり、進捗表示（何枚目を処理中か）も中断耐性（途中で閉じても再開できる）も持たない。** **⇒ このまま閉じると、設計書は「進捗表示付き、中断耐性あり」と書いたまま残り、次の担当は実装済みと読む。動作は正しいためテストも lint も何も言わない。設計卓が as-built で節を直すか followup を立てること**（レビュー 高-2） |
| **`DES-005` §5.7** | 重複警告の文面を**行動を促す形**へ改め、**判定に使わない 7 項目の差分**を出すようにした。**★`DES-005` §5.7:536 の設計文言と着手前の実装文言が一致していなかった**（設計＝「…と同一です。何かを変更して保存してください」／実装＝状況の羅列）。**実装を設計側へ寄せた** |
| **`DES-002` §7.5** | **構造は不変。値のみ是正**（`official_ja_move` の地上ダッシュ 38 行）。**⇒ as-built の追記は要らない可能性が高い**（`CHANGE-148` §4 の判定どおり） |

### ★設計卓の判断を仰ぐ 1 件

**`D-415`「★差分の自動提示は作らない」（2026-08-16 開発者確定）は編集競合（FR501）の文脈の決定である。ただし文面は「コンボの差分提示」一般を否定する形で書かれている**（`DES-005` §5.7 の近接、645 行目）。

本サブは `SM-068`（重複＝`VAL-C02`）を別物として扱い、差分表示を実装した。**根拠 2 つ**——
(1) `D-415` が挙げる理由は「ステップの配列の対応付けに専用の比較 UI が要る」であり、**本サブはステップを比較していない**
（判定キーとレシピは一致が確定しているため、比較対象は非キーのスカラー 7 項目だけである） ／
(2) `SM-068` の逐語要求が「遷移しなくてもどこが差分だったかわかるようにしたい」である。

**⇒ この読み方でよいか、設計卓の判定を仰ぐ。**

---

## 11. 検査表（**1 行ずつ実際の出力から埋めた**）

| 検査 | exit | 出力 |
|---|---|---|
| `bash scripts/check-artifact-integrity.sh`（**1 本目**） | **0** | `検査 11 件 / ALLOW 除外 1 件` ／ 生成物 4 件 OK ／ `結果: 違反なし` |
| `bash scripts/check-md-emphasis.sh` | **0** | `OK  ベースラインどおり(増加なし)` ／ `結果: 違反なし` |
| `bash scripts/check-doc-refs.sh` | **0** | `結果: dead reference なし(例示 8 件は ALLOW 表で除外)` |
| `bash scripts/check-enum-sync.sh` | **0** | `結果: ベースラインどおり(増加なし)` |
| `bash scripts/check-browser-storage-keys.sh` | **0** | `OK  台帳と実装が一致(未記載キーの使用なし・状態のズレなし)` ／ `結果: 違反なし` |
| `bash scripts/check-doc-inventory.sh` | **0** | 情報提供型（常に exit 0）。**`結果: 型に無いファイル 5 件`**——`improve-01-completion-report.md` ／ `improve-01-review.md` ／ `m24-12-review-2.md` ／ `m24-13-review-2.md` ／ `IMPROVE-01-clean-clone-toolchain.md`。**★5 件はいずれも着手基点 `6c9d8c6` に既に存在しており、本サブが作ったものではない**（`git ls-tree 6c9d8c6` で確認）。**⇒ 仕分けは設計卓・開発者の手番**（`CLAUDE.md` §10.Y。「消す」変更は開発者の手番＝`D-196` 境界条件 3）。**★初版は「新種の検出なし」と書いていた（レビュー 高-1 で是正）**——5 件が本サブ由来でないことは正しいが、**出力を要約で握り潰すと、この検査は存在しないのと同じになる** |
| `bash scripts/check-progress-log-index.sh` | **0** | 本報告書に対応する索引行を追記した後に実行（§12） |

---

## 11.1 レビュー取り込み後の再検証（2 巡目）

レビュー指摘（高 5 件・中 6 件・低 6 件）の取り込み後、全数を採り直した。

| 指標 | 値 |
|---|---|
| `go test ./... -count=1` | **exit 0** |
| `gofmt -l .` | **0 件** |
| `cd web && pnpm test` | **210 files / 2329 tests 緑**（取り込みで +1＝高-5 の回帰テスト） |
| `cd web && pnpm build` | 緑 |
| `make e2e`（**確定実行・絞っていない**） | **226 passed (3.8m)** |
| 常設検査 7 本 | **全数 exit 0**（`check-doc-inventory` は情報提供型で、型に無いファイル 5 件はいずれも着手前から在るもの） |
| import 順（`CLAUDE.md` §4） | 着手前と同数の **21 ファイル**（取り込み前は本サブが 27 件増やして 48 だった＝中-1） |

**★契約は取り込み後も全数維持**——`internal/service/notation/` と `internal/service/preset/` は差分ゼロ、本番コードに `queryKey` の配列リテラル直書きは 0 件。

---

## 12. 変更統計（`git diff --numstat`）

**採取範囲: `6c9d8c6` → `6893e7f`（最後のコード変更コミット）＝ `git diff --numstat 6c9d8c6 6893e7f`**

**84 files changed, 2342 insertions(+), 247 deletions(-)**

**★★「報告執筆後に採り直す」だけでは同じ問題が再発する**——採り直した瞬間に、その編集分がまた範囲から外れるためである（無限後退。`M24-07` が同じ形に当たっている）。**⇒ 範囲の両端を書いて、読み手が `git diff --numstat 6c9d8c6 6893e7f` でそのまま再現できる形にした。**

**★`6893e7f` より後にあるのは、本節そのものの訂正だけである**（本ファイル §12 の 1 か所。**コード・テスト・他の節は 1 行も動かない**）。**⇒ 後退はここで止まる。** 教訓 `E-225` が読みたいもの——**新規追加のはずのファイルに deletions が付いていないか**——は、下の一覧で全数が確認できる。

**★新規ファイル 8 本は deletions が 0 である**（教訓 `E-225`＝「新規のつもりのファイルを上書きで消していない」）:

```
124	0	internal/api/preset/recipe_cache_handler_test.go
129	0	internal/infra/migration/migrate_m2408_test.go
 15	0	migrations/000080_fix_ground_dash_label.down.sql
 51	0	migrations/000080_fix_ground_dash_label.up.sql
 85	0	web/src/lib/query-keys.convention.test.ts
282	0	web/src/lib/query-keys.invalidation.test.ts
192	0	web/src/lib/query-keys.ts
110	0	web/src/pages/TrashPage.character.test.tsx
```

コミット:

| コミット | 内容 |
|---|---|
| `0eaabf3` | **第 1 部**（`queryKey` の統一）。★ここで E2E 226 passed を採った |
| `63beca0` | 第 2 部 A（ゴミ箱の複数キャラ対応） |
| `ee13f66` | 第 2 部 D（`gofmt` ＋ 契約 2 の是正） |
| `827385e` | 第 2 部 B（地上ダッシュ ＋ レシピキャッシュ再構築） |
| `a1c4a4b` | 第 2 部 C・E（重複エラーの差分 ＋ `normal`/`counter`） |

---

## 13. 指示書・先行資料の記述で、実測と食い違ったもの

| 出所 | 記述 | 実測 |
|---|---|---|
| 指示書 §1.4 / §2.1 ／ `CHANGE-148` §1 | `queryKey` は **84 箇所 / 39 ファイル** | **92 箇所 / 43 ファイル**（キーを持つ本番サイトは 96 / 44） |
| 指示書 §1.4 ／ followup `code-facts-querykey-undercount` | **`code-facts.md` §2-2 は 64 行**と書いている | **★現物は 72 行である。** 「64」は現在のファイルと一致しない |
| 同上 | 差の内訳は **20 箇所**（変数参照 15 ＋ 文字列 const 2） | **★内訳の合計は 17 であり 20 と合わない。** 実際の 92→72 の差 20 の機構は **変数参照 15 ＋ 重複排除 12 ＋ 文字列 const 2** の重なりである（§2-2 は (ファイル, 用途, キー) が同一の行を重複排除する＝同資料 `:19-20` の凡例） |
| 指示書 §4.3 ／ followup `ground-dash-label-split-two-ways` | 対象は **「2 行」と決めつけないこと** | **38 行**（19 キャラ × 2 code）。投入元は 5 マイグレ |
| 指示書 §4.3 ／ `CHANGE-148` §4 | **既存の再構築機構に任せる**（`DES-005` §5.16 の「レシピキャッシュ再構築ボタン」） | **★その機構は存在しなかった。** ボタンは `disabled` の未実装で対応 API も無かった ⇒ 本サブで実装した |
| followup `combo-labels-normal-counter-split` | **`ComboEditorBasicFields` 236 行の直書き**を触らずには畳めない | **★失効。** 同ファイルは **910 行**で直書きは無く、`labels.ts` の `HIT_TYPE_OPTIONS` を import している |
| `labels.ts:5-13` の注記 | 割れているマップは **2 本** | **★3 系統**（`PunishList.tsx:339` の JSX 直書きが数えられていなかった） |
| followup `trash-scoped-to-single-character` | 修正は **FE 側の 1 か所で足りる見込み** | **★正しかった。** 本番 2 行 / 1 ファイル |

---

*以上、M24-08 完了報告。* **★★最大の発見は「`alias_text` を直しても直せる経路が存在しなかった」ことである**——
起動時の自動再構築は無く、再構築ボタンは未実装で、組み込みプリセットは `PUT` が 403 だった。
**⇒ 手を止めて開発者へ報告し、再構築ボタンを実装する裁定を得た。**
**★★次に大きいのは「invalidate が当たることを守る観測が 3.4% しか無かった」ことである**——
query 側だけをずらすと、既存 2294 テストも型検査も何も言わない。**本サブが足した観測だけが検出する。**
**★契約 F-2 は「モデルの契約であって表記法の凍結ではない」で確定した**（実査 21 箇所中リテラル説 0 件）。
**★あわせて `DES-002` §11.3 契約 2 の既存の違反 1 件を是正した**——Vitest の失敗が PR を止めていなかった。
