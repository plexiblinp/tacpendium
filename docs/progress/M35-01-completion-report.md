# M35-01 完了報告: タグまわりの是正 3 件（公開前）

| 項目 | 内容 |
|------|------|
| 作業ID | M35-01 |
| 指示書 | `docs/instructions/M35-01-tag-fixes.md` v1.0.0 |
| チェックリスト | `docs/instructions/reviews/M35-01-review-checklist.md` v1.0.0 |
| 実施日 | 2026-09-09 |
| 着手基点 | `4c0dcb2` |
| コミット | `6408514`（段 1）／ `d4a1fb2`（段 2。段 3 の裁量部分を同梱）／ `2e0dece`（本報告）／ `520f88b`（レビュー取り込み） |
| CHANGE 消費 | **0 本**（段 3 の請求を設計伝達レポート §4 へ出す。★自採番しない＝`D-293`） |
| マイグレ消費 | **0 本** |
| 新規依存 | **0 件** |

---

## 0. 結論

3 段すべて完了した。段 1 と段 2 はコミットを持ち、段 3 は実装を 1 行も変えていない（本報告 §4 が成果物である）。

**★着手前の実査で、指示書の前提と違う事実が 4 件見つかった。** いずれも作業の形を変えたので §1 に先に置く。

§2.4 の同乗候補（`tag-val-t01-check-then-act-race`）は**開発者判断により触っていない**（2026-09-09）。実測したコストを §6 に記す。

---

## 1. ★★指示書の前提と違った事実 4 件

### F-1 ★★段 1 の破壊確認は、指示書のとおりに実施すると「緑」になる

指示書 §2.1-2 / §4.2 は「実装から `AND user_id = ?` を外すと赤くなることを実測する」と求めるが、**Delete のガードは二重である。**

| 段 | 所在 | 内容 |
|---|---|---|
| 1 | `internal/service/tag/service.go:106` | `s.repo.Get(ctx, userID, tagID)` ——`repository.go:115` が `WHERE id = ? AND user_id = ?` |
| 2 | `internal/repository/tag/repository.go:207` | `DELETE FROM tags WHERE id = ? AND user_id = ?` |

⇒ **`repo.Delete` の絞りだけを外しても、サービスが前段で `ErrNotFound` を返すため API 層の試験は緑のままになる。** チェックリスト §6-2 が言う「その試験は何も見ていない」形にそのまま該当する。

**★Update は同じ形ではない。** `UpdateTag`（`service.go:82-102`）は `Get` を先に通さず `repo.Update` を直接撃つ。⇒ 既存の `TestUpdate_CannotTouchAnotherUsersTag` は 1 本で `repo.Update` の絞りを実際に見ている。**Update と Delete を同じ形と読んだのが、指示書の前提が外れた原因である。**

**対処** ——試験を 2 層・3 本に置いた（§2）。破壊確認は行列で実測した（§5.1）。

### F-2 ★`existing_tag_id` の「grep 0 件」という前提は誤り

指示書 §2.2-4 と followup §CC が根拠に挙げる `grep -rn "existing_tag_id" --include='*.go'` は、**0 件ではなく 3 件**当たる。

```
internal/model/api_error_test.go:57
internal/model/api_error_test.go:74
internal/model/api_error_test.go:75
```

中身は `APIErrorResponse` の JSON marshal を見る**汎用テストのサンプルキー**であり（エラーコードも架空の `"DUPLICATE_TAG"`）、タグ機能とは無関係である。**⇒ 削除の判断は変わらない**（本番コードに producer は 0 件）。射程外のため同ファイルは触っていない。

**★ただし「0 件」という記述は事実と違うため、次の担当が同じ根拠を引くと外れる。** 設計伝達レポート §4 へ訂正を出す。

### F-3 ★★`TagApiError.usageCount` を読む本番コードが 1 か所も無い

| 所在 | 実態 |
|---|---|
| `web/src/features/tag/api/tagApi.ts:22-24` | getter が在るが、呼び出し元が 0 件 |
| `web/src/features/tag/hooks/useTagFormDialog.ts:62` | 唯一の `TagApiError` 消費者。読むのは `code` だけ |
| `web/src/features/tag/components/TagManagementPage.tsx:68-75` | 削除前に一覧の `Tag.usageCount` を見て `force` を決める。⇒ 通常経路で `409 tag_in_use` が発生しない |
| `web/src/features/tag/hooks/useTagManagement.ts:26-30` | `deleteMutation` に `onError` が無い。⇒ 409 が来ても握り潰される |

⇒ **「`usageCount` が画面まで届く」は、画面を変えずには文字どおり達成できない。** 達成するには削除経路の `onError` を足して表示させる必要があり、それは指示書 §3-1（タグの画面・文言を変えない）が禁じている。

**★代替として、両端をそれぞれの側から留めた**（§2 の #4 と #5）。BE は「実際にこの JSON を出すこと」を、FE は「その JSON から値を読めること」を主張し、**両者は逐語同一の JSON literal を共有する。** 片側だけの退行はそれぞれの側で赤くなる（§5.2 で実測）。

**★これがチェックリスト B-3 / §6-1 に対する回答である。** 画面まで届かないことは本サブが作った状態ではなく、着手前から在る状態である。**⇒ 直すには射程を越える。**

### F-4 ★段 2 に CHANGE は要らない

`docs/design/` 配下を実査したところ、`usage_count` / `force_delete_query` / `existing_tag_id` / `TagErrorDetail` はいずれも **0 件**であった。エラー詳細の payload キーは設計書に載っていない。

⇒ **CHANGE の請求は段 3 の 1 本だけである**（指示書ヘッダの「1 本の見込み」と一致する）。

---

## 2. 変更したファイル

### 段 1 — コミット `6408514`（テストのみ。実装は 1 行も変えていない）

| # | ファイル | 変更 |
|---|---|---|
| 1 | `internal/api/tag/scope_test.go` | `TestDelete_CannotTouchAnotherUsersTag` を追加。既存 `TestUpdate_CannotTouchAnotherUsersTag` と同じ形（`newScopedRouter` / `addUser` / `request` を再利用）。B として `DELETE /api/tags/{user1 のタグ}` を撃ち、204 でないこと・404 であること・行が残っていることを主張 |
| 2 | `internal/repository/tag/repository_test.go` | `TestDelete_IsScopedToUser` を追加。`repo.Delete(ctx, otherUserID, tagID)` が `ErrNotFound` を返し行が残ること、および対照として所有者からは消せることを主張 |

| 3 | `internal/api/tag/scope_test.go` | **`TestDelete_DoesNotLeakAnotherUsersTagUsage`** ——★レビュー 高-1 で追加（コミット `520f88b`）。対象タグを `combo_tags` で「使用中」にした上で、他人から `DELETE` を撃つと 404 であり、応答に `usageCount` が含まれないことを主張 |

**★3 本で 1 組である。** ガードは 2 段あり、それぞれ別の層でしか固定できない。

| 固定する対象 | どの試験が見るか |
|---|---|
| `repository.go:207` の `AND user_id = ?` | `TestDelete_IsScopedToUser`（repo 層） |
| `service.go:106` の `repo.Get` ガード | **`TestDelete_DoesNotLeakAnotherUsersTagUsage`**（API 層） |
| 経路全体が通っていること | `TestDelete_CannotTouchAnotherUsersTag`（API 層） |

**★★3 本目が要る理由**（レビュー 高-1）——`repository.CountUsage` は tag リポジトリで**唯一 `userID` を取らないメソッド**である（`SELECT COUNT(*) FROM combo_tags WHERE tag_id = ?`）。**前段の `repo.Get` だけが、他人の `tagID` がそこへ届くのを止めている。⇒ ガードを外すと 409 と `usageCount` が返り、他人のタグの存在と使用件数が漏れる。** 最初の 2 本は seed タグ（未使用）を拾うため 409 経路へ入らず、これを見ていなかった。

`scope_test.go:126` のコメント（「タグの Update / Delete は既に `WHERE id = ? AND user_id = ?` で絞っている」）は、これで両方とも試験に裏づけられた状態になった。**★文面は正しいままなので書き換えていない。**

### 段 2 — コミット `d4a1fb2`（4 か所 ＋ 試験を 1 コミットで）

| # | ファイル | 変更 |
|---|---|---|
| 1 | `internal/api/tag/handler.go:163-164` | `"usage_count"` → `"usageCount"` ／ `"force_delete_query"` → `"forceDeleteQuery"` |
| 2 | `web/src/types/tag.ts` | `TagErrorDetail` を `usageCount?` / `forceDeleteQuery?` へ。**`existing_tag_id` の行を削除。** 対応関係を示すコメントを 4 行付けた |
| 3 | `web/src/features/tag/api/tagApi.ts:23` | `details?.usage_count` → `details?.usageCount` |
| 4 | `internal/api/tag/handler_test.go` | `TestDeleteTag_409_InUse_DetailKeysAreCamelCase` を追加。**生 `map[string]any` へ decode** して `usageCount` / `forceDeleteQuery` を見る。旧 snake_case 3 種が残っていないことも見る。さらに body 全体を golden JSON と `reflect.DeepEqual` で突き合わせる |
| 5 | `web/src/features/tag/api/tagApi.test.ts` | **新規。** #4 の golden JSON と**逐語同一の literal**を fixture にして `TagApiError.usageCount === 3` を主張。旧 snake_case の body では `undefined` になることも主張 |

**★構造体へ decode するとキー違いが零値で通ってしまうため、生 map で見る形にした。** 型検査は歯止めにならない（両側を同時に変えれば型は通る）ので、両側ともキー文字列そのものを見る。

**★あわせて 2 件**（同じ性質のため同コミット）:

| ファイル | 変更 |
|---|---|
| `internal/api/tag/handler.go:34-35` | godoc が応答フィールドを `usage_count` と書いていた。実体は `internal/model/tag.go:56` の `json:"usageCount,omitempty"`。**⇒ 失効した記述の是正である**（本サブの主題そのもの） |
| `web/src/features/tag/components/TagManagementPage.tsx:53-54` `:61-62` | `?? undefined` を外し、コメント 4 行を置いた（詳細は §4.3） |

### 段 3 — コミット無し

**★実装を 1 行も変えていない。** 成果物は本報告 §4 と設計伝達レポート §4 である。

---

## 3. `git diff --stat 4c0dcb2`（★新規ファイルに deletions が無いことの確認＝`E-225`）

★レビュー取り込み `520f88b` まで含めた最終値。`docs/` を除く。

```
 internal/api/tag/handler.go                        |  8 +-
 internal/api/tag/handler_test.go                   | 59 +++++++++++++++
 internal/api/tag/scope_test.go                     | 87 ++++++++++++++++++++++
 internal/repository/tag/repository_test.go         | 36 +++++++++
 web/src/features/tag/api/tagApi.test.ts            | 77 +++++++++++++++++++
 web/src/features/tag/api/tagApi.ts                 |  4 +-
 .../features/tag/components/TagManagementPage.tsx  | 16 ++--
 web/src/types/tag.ts                               |  9 ++-
 8 files changed, 281 insertions(+), 15 deletions(-)
```

`--numstat`（追加／削除の内訳）:

```
4	4	internal/api/tag/handler.go
59	0	internal/api/tag/handler_test.go
87	0	internal/api/tag/scope_test.go
36	0	internal/repository/tag/repository_test.go
77	0	web/src/features/tag/api/tagApi.test.ts
2	2	web/src/features/tag/api/tagApi.ts
10	6	web/src/features/tag/components/TagManagementPage.tsx
6	3	web/src/types/tag.ts
```

**★新規のつもりのファイルは `web/src/features/tag/api/tagApi.test.ts` の 1 本だけであり、`77 / 0` である。** 既存テストファイルへの追加分（`handler_test.go` `scope_test.go` `repository_test.go`）も deletions が 0 であり、**上書きで消したテストは無い。** 作成前に `ls` で同名不在も確認した。

deletions を持つ 4 ファイルの内訳（いずれも書き換えであり、削除ではない）:

| ファイル | 内訳 |
|---|---|
| `handler.go` `4 / 4` | 詳細キー 2 行 ＋ godoc 2 行の書き換え |
| `tagApi.ts` `2 / 2` | getter 1 行 ＋ コメント 1 行の書き換え |
| `TagManagementPage.tsx` `10 / 6` | `?? undefined` の除去 ＋ コメント 4 行 ＋ import 順の是正 |
| `types/tag.ts` `6 / 3` | `TagErrorDetail` 3 行の書き換え ＋ コメント 4 行 |

---


## 4. ★★段 3 — 「カテゴリ・色を未設定へ戻せない」機序（★実装を変えない）

**開発者の判断（2026-09-08）＝「未設定へ戻す処理はいらない」。⇒ 実装は現状のままでよい。**
**★以下は「バグではなく仕様である」ことを残すための記録である。** 書かないと消え、次の担当が「バグだ」と読んで直しに行く。

### 4.1 機序 3 段

| 段 | 所在 | 何が起きるか |
|---|---|---|
| 1 | `web/src/features/tag/hooks/useTagFormDialog.ts:57-58` の `values.category \|\| undefined` | 利用者が入力欄を空にすると、**空文字が `undefined` になる** |
| 2 | `JSON.stringify`（`web/src/features/tag/api/tagApi.ts:80`） | **`undefined` のキーは JSON から落ちる。** ⇒ リクエスト body に `category` が乗らない |
| 3 | `internal/model/tag.go:67-71` の `*string` ＋ `internal/repository/tag/repository.go:165-172` の動的 SET | **nil を「変更なし」としてスキップする。** ⇒ `SET` 句が組み立てられず、既存値がそのまま残る |

**⇒ 3 段が噛み合って「空にして保存しても、元の値が戻ってくる」形になる。**

### 4.2 ★★`null` を送っても救えない

**Go の `encoding/json` は、`null` をポインタの nil へ落とす。** ⇒ **「キーが省略された」と「明示的に `null` が送られた」を区別できない。**

**⇒ フロント側だけで `null` を送るようにしても、段 3 の判定は変わらない。** 未設定へ戻せるようにするには**契約の決めごと**が要る（設計卓の案＝空文字に「消す」の意味を割り当てる。他に三値表現・仕様として明文化の 2 案）。

**★本サブでは開発者判断により「消せない仕様として明文化する」を採った。** ⇒ CHANGE の請求を設計伝達レポート §4 へ出す（対象＝`DES-002` の API 契約 ／ `DES-006` §5 のタグ検証）。

### 4.3 ★`TagManagementPage.tsx` の `?? undefined` は no-op であった

`handleFormSubmit` の引数 `values.category` の型は既に `string | undefined` であり、`?? undefined` は**何も変えない**（`??` が変換するのは `null` と `undefined` だけである）。実測で確認した。

**⇒ 外した上で、コメント 4 行を置いた**（指示書 §2.3 が「消すかコメントを付けるかは判断してよい」と裁量を与えている）。コメントには次を残した。

- 空文字 → `undefined` の正規化の実体は `useTagFormDialog.ts:57-58` の `|| undefined` であること
- **`??` は空文字を透過するため、フック側の正規化が将来外れてもガードにはならないこと**
- **⇒ 正規化を足すならフック側であり、ここではないこと**

**★followup の `cosmetic-minor-cleanups-20260908` (2) はこれで解消する。** 同行の (1)（`alert-dialog.tsx:22` の二重スペース）は面が違うため触っていない。

---

## 5. テスト・破壊確認の実測

### 5.1 ★★段 1 の破壊確認（行列）

実装を一時的に壊し、どのテストが赤くなるかを実測した。**実測後は復元し、`git diff` が空であることを確認してからコミットした。**

**★行列は 2 回採った。** 1 回目（試験 2 本）で **B-2 が「両方緑」になり、そこが空白として残った。** レビュー 高-1 がその空白の実害（他人のタグの存在と使用件数が漏れる）を突いたため、**3 本目を足して 2 回目を採った。**

| # | 壊した箇所 | `TestDelete_IsScopedToUser`<br>（repo 層） | `TestDelete_CannotTouchAnotherUsersTag`<br>（API 層） | **`TestDelete_DoesNotLeakAnotherUsersTagUsage`**<br>（API 層・後から追加） |
|---|---|---|---|---|
| **B-1** | `repository.go:207` の `AND user_id = ?` を外す | **赤**（3 assertion とも発火） | 緑のまま | 緑のまま |
| **B-2** | `service.go:106` の `repo.Get` ガードを外す | 緑のまま | 緑のまま | **赤**（3 assertion とも発火） |
| **B-3** | B-1 と B-2 を同時に外す | ——| **赤**（3 assertion とも発火） | ——|

**★B-2 の列が「全部緑」でなくなったことが、レビュー 高-1 の取り込み結果である。**

**B-1 の repo 層の実出力:**

```
repository_test.go:213: ★他人のタグを削除できてしまった: err = <nil>, want ErrNotFound
repository_test.go:221: ★所有者のタグが消えている(残存 = 0, want 1)
repository_test.go:226: 所有者からの削除が失敗した(対照): tag: not found
--- FAIL: TestDelete_IsScopedToUser (0.74s)
```

**B-2 の実出力（★3 本目を足した後）:**

```
--- PASS: TestDelete_CannotTouchAnotherUsersTag (0.73s)
scope_test.go:228: ★他人のタグが「使用中」として 409 を返した(存在が漏れている): {"error":{"code":"tag_in_use","message":"このタグは使用中です。確認の上削除してください","details":{"forceDeleteQuery":"?force=true","usageCount":1}}}
scope_test.go:231: status = 409, want 404
scope_test.go:234: ★応答に usageCount が含まれる(使用件数が漏れている): {...}
--- FAIL: TestDelete_DoesNotLeakAnotherUsersTagUsage (0.01s)
```

**B-3 の API 層の実出力:**

```
scope_test.go:171: ★B が user 1 のタグを削除できてしまった
scope_test.go:174: status = 204, want 404(他人のタグは存在しないものとして扱う)
scope_test.go:182: ★user 1 のタグが消えている(残存 = 0, want 1)
--- FAIL: TestDelete_CannotTouchAnotherUsersTag (0.70s)
```

**★★ここから得た一般形** ——**「両方緑」は冗長ガードの証明であると同時に、試験が届いていない領域の宣言でもある。** 1 回目の行列は B-2 を「冗長だから緑」と読んで止まったが、実際にはそこに**未固定のガードが 1 段**あった。**⇒ 破壊確認で「緑のまま」が出たら、それが冗長なのか未固定なのかを、もう一段掘ること。**

### 5.2 ★★段 2 の破壊確認（片側だけ直した形の検出）

| # | 壊した箇所 | Go 側 | FE 側 |
|---|---|---|---|
| **C-1** | `tagApi.ts:23` の getter だけ旧キーへ戻す | 緑のまま | **赤**（2 件。`err.usageCount` が `3` にならず、旧キー body でも `undefined` にならない） |
| **C-2** | `handler.go:163-164` だけ旧キーへ戻す | **赤** | 緑のまま |

**⇒ 片側だけの退行を、それぞれの側が検出する。** これが「両方を `usageCount` に揃えれば型は通ってしまう」形（チェックリスト §6-1）への対処である。

**★C-1 / C-2 が対称であることに意味がある。** どちらか一方の側にしか試験が無ければ、もう一方の退行は緑で通る。

### 5.3 走査（★4 か所以外に参照が無いこと。指示書 §2.2 / チェックリスト B-2）

```bash
grep -rn "usage_count\|force_delete_query\|existing_tag_id" \
  --include='*.go' --include='*.ts' --include='*.tsx' --include='*.sql' . | grep -v node_modules
```

**是正後の残存（非 docs）:**

| キー | 残存 | 判定 |
|---|---|---|
| `force_delete_query` | `tagApi.test.ts:15`（旧キー body の fixture）／ `handler_test.go:343`（旧キーが残っていないことを見る列挙） | **★どちらも「旧キーを検出するための逐語」である。** DTO としての参照は 0 件 |
| `existing_tag_id` | 同上 2 件 ＋ `internal/model/api_error_test.go:57,74,75` | **F-2 の 3 件は汎用 APIError テストのサンプル。射程外** |
| `usage_count` | 上記 2 件 ＋ **DB 列別名**（`repository.go:84` の `COUNT(c.id) AS usage_count`）＋ リポジトリのコメント 4 件 ＋ Go テストのメッセージ 12 件 ＋ `TagDeleteConfirmDialog.test.tsx:22,37` のテスト名 ＋ `tagApi.ts:58` のコメント | **★いずれも DB カラム名側またはテストの文言であり、`CLAUDE.md` §4 の改名対象ではない** |

**⇒ DTO のキーとしての snake_case は、本番コードから 0 件になった。**

**★`tagApi.ts:58` のコメントは是正した**（レビュー 高-2）。当初は「DB 側の集計を指すので触らない」と判断したが、**同行は本サブが直した `handler.go:34-35` の godoc と逐語で対になる同じ文**であり、片方だけ直した状態になっていた。**⇒ 応答フィールドは `usageCount`**（`model/tag.go:56`）**であるため揃えた。**

**★1 点だけ申し送る** ——`TagDeleteConfirmDialog.test.tsx:22,37` のテスト名は `usage_count=0` / `usage_count > 0` と書くが、実際に見ているのは `Tag.usageCount` である（同フィールドは本サブより前から camelCase）。**⇒ 概念の略称であって失効した記述ではないと判断し、触っていない。** レビューも同判断である（低-4）。

### 5.4 検査の実行結果

| # | 何を | 結果 |
|---|---|---|
| 1 | `go build ./...` | **成功** |
| 2 | `go test ./...` | **全緑**（FAIL 0 件） |
| 3 | `cd web && pnpm test` | **223 ファイル / 2623 件 緑**（★本サブで足したのは `tagApi.test.ts` の 3 件。**着手前の件数は測っていないため、差分としてのみ記す**） |
| 4 | `cd web && pnpm exec tsc --noEmit -p tsconfig.json` | **成功** |
| 5 | `make e2e-only P="m24-02 m31-02-tag-field-drag m27-02a"` | **13 件 緑**（41.1s） |

**★レビューが独立に `make e2e-only P="tag"` を回したところ 11 passed / 2 flaky であった。** flaky は `m31-02-tag-field-drag.spec.ts` の「右へ／下へ枠外までドラッグしても文字選択が消えない」の 2 件で、1 回目に `selectionLength` が 0 になりリトライで通る。**★M35-01 とは無関係の既存 spec の不安定さである**（本サブは同 spec の対象コードを触っていない）。

**★E2E について** ——タグ削除の 409 経路を通る spec は**存在しない**（実査）。`web/e2e/support/tags.ts:45-52` の後片付けは常に `?force=true` を送るため 409 に当たらない。**⇒ 上記 3 spec は退行確認として回した。**

**★常設検査は §7 に置く**（**★すべてのファイルを足し終えた後に回すため**＝指示書 §5-7・`M30-01` の教訓）。

---

## 6. ★§2.4 の同乗候補を触らなかった理由（開発者判断・2026-09-09）

**`tag-val-t01-check-then-act-race`** は**触っていない。** 指示書 §2.4 は「同じ形を当てられるなら当ててよい」とするが、**実査の結果、前提の「同じファイルを触るので安い」が成立しなかった。**

| 観点 | 実測 |
|---|---|
| 先例の直し方 | `BEGIN IMMEDIATE` ＋ 判定を Tx の内側へ。**DSN の `_txlock=immediate`** ——定数は `internal/infra/db/db.go:78`、解説コメントは同 `:43-70`。**`BeginTx` が既に `BEGIN IMMEDIATE` になる** |
| 先例の前提 | コンボ／セットプレイのサービスは `*sql.DB` を持つ（`internal/service/combo/service.go:354` 等） |
| **★タグの実態** | **`internal/service/tag/service.go:34-36` の `service` 構造体は `repo` しか持たない** |
| 要る変更 | (a) `tagsvc.New()` のシグネチャへ `*sql.DB` を足す ／ (b) リポジトリに Tx 版の `List` / `Create` / `Update` を新設 ／ (c) 呼び出し側 3 か所の追随（`internal/api/tag/scope_test.go:38` ／ `handler_test.go` の `newEcho` ／ `cmd` の配線） |

**⇒ 「識別子を直すついで」の規模ではない。** 割付は元々フェーズ5 であり、指示書 §4.4 も「時間が足りなければ触らないこと」としている。**開発者へ選択肢を提示し、「触らない」の判断を得た**（2026-09-09）。

**★安い代替案も提示した上で不採用になった** ——`UNIQUE (user_id, name)` 違反を `ErrTagNameDuplicate` へ翻訳すれば、競合に負けた側が `500 internal_error` ではなく `409 tag_name_duplicate` を返すようになり、**契約違反だけは消える**（約 10 行・公開シグネチャ変更なし）。**★ただし先例と「同じ形」ではないため、逸脱として扱われる。** 判断は開発者へ返した。

**⇒ followup `tag-val-t01-check-then-act-race` は未着手のままである。** 上記の実測コストを設計伝達レポート §4 へ出す。

---

## 7. 常設検査（★Phase C の後に、すべてのファイルを足し終えてから回す）

**★実測は、レビュー取り込み・完了報告 §8 の記入・`progress-log.md` への索引行の追記まで終えた後に採った**（指示書 §5-7・`M30-01` の教訓＝途中で回して「違反なし」と書き、その後にファイルを足すと嘘になる）。

| 順 | 検査 | exit | 結果 |
|---|---|---|---|
| **1** | `check-artifact-integrity.sh`（★1 本目） | 0 | **違反なし**（各 `check-*.sh` の対照が実際に走った証拠 ＋ 派生資料 4 本の生成物健全性） |
| 2 | `check-progress-log-index.sh` | 0 | **違反なし**（85 件すべてが progress-log に現れる。★`m35-01` の索引行を追記した後の実測） |
| 3 | `check-completion-report-md-emphasis.sh` | 0 | **違反なし**（製造 CLI 4 本のマーカー ＋ 指示書テンプレート §7.4 の本文が健在） |
| 4 | `check-doc-refs.sh` | 0 | **dead reference なし** |
| 5 | `check-stop-discipline.sh` | 0 | **違反なし** |
| 6 | `check-browser-storage-keys.sh` | 0 | **違反なし**（本サブはストレージ API を使っていない） |
| 7 | `check-enum-sync.sh` | 0 | **ベースラインどおり**（増加なし） |
| 8 | `check-import-order.sh` | 0 | **違反なし。★実測が 99 へ減った**（`TagManagementPage.tsx` を是正したため）。同スクリプトは「BASELINE を 99 へ下げること」と出すが、**スクリプト編集は射程外**のため触っていない（§10-6） |
| 9 | `check-doc-inventory.sh` | 0 | **型に無いファイルなし**（本サブが `docs/` へ新設したのは完了報告とレビュー報告の 2 本であり、いずれも既存の型に合致） |
| 10 | `check-md-emphasis.sh docs/progress/M35-01-completion-report.md` | 0 | **検出 0 行**（`D-775`。★`docs/progress/` は常時走査の対象外のため、この手番で作ったファイルを自分で見た） |
| 11 | `check-derived-docs.sh` | 0 | **情報提供**。`progress-log.md` の未コミット変更があるため「陳腐化疑い」と出る。**★本サブは実装ソースの構造を変えていない**（追加はテストと DTO キーの改名）**。⇒ `code-facts` の再生成が要るかは、コミット後の再実行で判断されたい** |

**★`check-md-emphasis.sh` はレビュー報告書 `docs/progress/m35-01-review.md` にも通っている**（レビュー担当が自分で回して 0 行）。**★継続更新ファイル**（`progress-log.md`）**には渡していない**（歴史記録としての既存の検出行を持つため＝`D-274` (3)）。

**★逐語引用が理由で直せなかった行は無い。**

---

## 8. レビュー結果（★Phase C で埋める）

<!-- ★★本節はレビュー報告書 docs/progress/m35-01-review.md が出来てからでなければ書けない。
     指摘件数・優先度別内訳・各指摘の採否と理由・「高」指摘の不採用が 0 件かどうか・
     再レビュー往復の回数は、すべて Phase C の後に実測値で埋める（D-510）。
     ★現時点で断定を書かないこと。 -->

**レビュー報告書**: `docs/progress/m35-01-review.md`（Phase B・fresh subagent。`fork` 不使用）

### 8.1 指摘の件数と優先度別内訳

| 優先度 | 件数 | 採用 | 不採用 |
|---|---|---|---|
| **高** | **4 件** | **4 件** | **0 件** |
| 中 | 4 件 | 4 件（うち 1 件は部分採用） | 0 件 |
| 低 | 6 件 | 3 件 | 3 件（うち 2 件は射程外・1 件はレビューも同意） |
| **計** | **14 件** | **11 件** | **3 件** |

**★★「高」指摘の不採用は 0 件である。** ⇒ 安全弁（高の不採用時のみ開発者へエスカレーション）は発動していない。

**再レビューの往復回数: 0 回**（初回レビューのみ。上限 2 回に達していない）。

### 8.2 各指摘の採否と理由

| # | 優先度 | 指摘 | 採否 | 理由・対応 |
|---|---|---|---|---|
| 高-1 | 高 | 段 1 の試験対に service 層ガードを固定するものが無い。`repo.Get` を外すと他人の「使用中」タグへの `DELETE` が 409 と `usageCount` を返し、存在と使用件数が漏れる | **採用** | **本サブの登録理由そのものに当たる穴であった。** `TestDelete_DoesNotLeakAnotherUsersTagUsage` を追加し、破壊確認 B-2 が赤になることを再実測した（§5.1）。**実装は 1 行も変えていない** |
| 高-2 | 高 | `tagApi.ts:58` のコメントの `usage_count` が、直した godoc と逐語で対になる同じ文なのに片方だけ残っている | **採用** | **指摘のとおり。** 失効した記述の是正という本サブの主題に照らして、片側だけ直した状態は最も避けるべき形である |
| 高-3 | 高 | 完了報告 §7 の見出しが「常設検査（★最後に回した）」と過去形で断定しつつ本文が空（`D-510` と同型） | **採用** | 見出しを「Phase C の後に、すべてのファイルを足し終えてから回す」へ改め、実測後に本節を埋めた |
| 高-4 | 高 | 設計伝達レポートが未発行。段 3 の CHANGE 請求（チェックリスト C-3）が未達 | **採用** | Phase D の後に `/design_handover_report` を実行する（§11-9）。§4 へ載せるもの 4 件はレビューの指摘どおり |
| 中-1 | 中 | 両端 fixture の同一性がコメントでしか結ばれていない | **部分採用** | (a) 双方のコメントへ「文言を変えるときは 2 ファイル」を明記した。**(b) の `testdata/*.json` 共有は本サブの射程を越えるため見送り**、§10-8 へ申し送った（レビュー自身も「次の手番で判断すればよい」としている） |
| 中-2 | 中 | 申し送り #1 / #2 に恒久の置き場が無い | **採用** | §10 の #1 / #2 へ**宛先＝設計伝達レポート §4 の候補行**を明記した。**★`followup-backlog.md` §J ではなく §4 を選んだ理由**——§J は停止時記録であり、本件は停止に伴う未解消項目ではない。`CLAUDE.md` §10.Y は「本表への登録は設計伝達レポート §4 へ候補を書き、設計卓が畳む」としている |
| 中-3 | 中 | `progress-log.md` へ索引行が未追記 | **採用** | Phase D で追記した（予定どおり） |
| 中-4 | 中 | `tagApi.test.ts` の 2 本目のコメントが、実際に検出する対象とずれている | **採用** | **指摘のとおり。** 2 本目が固有に捉えるのは「getter が旧キーも読む形」であり、「BE だけ直して FE を直し忘れた状態」を捉えるのは 1 本目である。コメントを実態へ合わせた |
| 低-1 | 低 | `TagManagementPage.tsx` の import 順を、触った手番のうちに直す | **採用** | `react-i18next` が `react` より前に来ていた。副作用 import ではないため安全に動かせる |
| 低-2 | 低 | `check-import-order.sh` のベースラインドリフト | **不採用** | **スクリプトの `BASELINE` 編集は本サブの射程外である**（レビューも同判断）。§10-6 へ申し送った |
| 低-3 | 低 | golden JSON が日本語メッセージ全文を固定している旨をコメントへ | **採用** | 中-1 (a) と同じ変更で満たした |
| 低-4 | 低 | `TagDeleteConfirmDialog.test.tsx` のテスト名は触らないという判断に同意 | **不採用（対応不要）** | **レビュー自身が「完了報告の判断に同意する」としている。** 将来まとめて直すときの候補に留める |
| 低-5 | 低 | 完了報告 §6 の `db.go:43-70` は、実体の定数が `:78` にあるため範囲がわずかにずれている | **採用** | 「定数は `:78`、解説コメントは `:43-70`」へ改めた |
| 低-6 | 低 | `m31-02-tag-field-drag.spec.ts` の 2 件が flaky | **不採用（記録のみ）** | **M35-01 とは無関係の既存 spec である**（本サブは対象コードを触っていない）。§10-7 と progress-log の横断課題へ記録した |

### 8.3 ★レビューが独立に確かめたこと

**★F-1〜F-4 は 4 件とも実物で裏が取れた。** 特に F-1 は、レビューがスクラッチ領域へ Go 一式を複写して破壊確認を**独立に再現**し、B-1 / B-3 の失敗出力が §5.1 の逐語と一致することを確認している。

**★そのうえで、本報告が「B-2＝両方緑」と書いた行の意味を掘り直したのがレビューの最大の貢献である**（高-1）。**⇒ 冗長ガードの証明として読んで止まった箇所に、未固定のガードが 1 段あった。**

---

## 9. ■ 併せて更新が要るもの

| # | 項目 | 状態 |
|---|---|---|
| 1 | **消費した CHANGE 番号の登録** | **なし。** 本サブは CHANGE を起票していない（自採番しない＝`D-293`）。段 3 の請求は設計伝達レポート §4 へ出し、**採番と `docs/handover/change-number-registry.md` §1 への登録は設計卓の手番である** |
| 2 | **「次の番号」の写し先（実査で 4 か所）** | **該当なし**（番号を消費していないため） |
| 3 | **消費したマイグレ連番** | **なし**（0 本）。`ls migrations/` の最新は `000106_data_correct_terry_quick_burn_code` であり、ボード §2.2 との突合は不要 |
| 4 | **版を上げた文書の参照元** | **なし**（本サブは設計書・指示書の版を上げていない） |
| 5 | **`web/CLAUDE.md` §1 のブラウザストレージ台帳** | **該当なし**（ストレージ API を使っていない） |
| 6 | **`docs/progress/progress-log.md` への索引行** | **追記した**（M35-01 の節。横断課題 7 件を含む。`check-progress-log-index.sh` 緑） |
| 7 | **followup `cosmetic-minor-cleanups-20260908` の (2)** | **解消した**（§4.3）。(1) は面が違うため未着手。**★台帳の更新は設計卓の手番である**（`D-382` により製造が書けるのは §J だけ） |

---

## 10. 申し送り（★射程外のため直していないもの）

| # | 内容 | 判断 |
|---|---|---|
| **1** | **`internal/api/tag/handler.go:159` が `errors.As(err, &inUse)` の戻り値を捨てている。** ⇒ 将来 `ErrTagInUse` をラップしただけのエラー（`*TagInUseError` でないもの）が来ると、`inUse` が nil のまま `:163` の `inUse.UsageCount` で panic する。**★`TagInUseError.Is(target)` が `target == ErrTagInUse` を返すため、センチネルを裸で返す実装が 1 つ増えるだけで到達する**（レビューが確認。現状 `return ErrTagInUse` の裸は 0 件）| **開発者判断で報告のみ**（2026-09-09）。**★宛先＝設計伝達レポート §4 の候補行**（レビュー 中-2 を受けて明記。完了報告の中で滞留させない）|
| **2** | **`useTagManagement.ts:26-30` の `deleteMutation` に `onError` が無い。** ⇒ `409 tag_in_use` が来ても握り潰される。**★これが F-3（`TagApiError.usageCount` の getter に読み手が無い）の原因である。** 直すと画面の挙動が変わるため、指示書 §3-1 に抵触する | **開発者判断で報告のみ**（2026-09-09）。**★宛先＝設計伝達レポート §4 の候補行**（レビュー 中-2）。`usageCount` を画面へ出すか否かの判断と一体で扱う |
| **3** | **F-2 の記述の誤り** ——指示書 §2.2-4 と followup §CC の「`grep` が 0 件」は事実と違う（3 件）。**⇒ 判断は変わらないが、根拠として引き継がれると外れる** | **設計伝達レポート §4 へ訂正を出す** |
| **4** | **F-3 の状態** ——`usageCount` は画面まで届いていない。**★本サブが作った状態ではなく、着手前から在る状態である** | **設計伝達レポート §4 へ事実として出す** |
| **5** | **`tag-val-t01-check-then-act-race` は未着手**（§6） | **フェーズ5 へ返す。実測コストを設計伝達レポート §4 へ** |
| **6** | **`scripts/check-import-order.sh` のベースラインが実測とずれている**（レビュー 低-2 の時点で ベースライン 101 / 実測 100。**★本サブ起因ではない**）**。⇒ 本サブが `TagManagementPage.tsx` を是正したのでさらに 1 件減る** | **スクリプト編集は射程外。次に触る手番へ申し送る** |
| **7** | **`m31-02-tag-field-drag.spec.ts` の 2 件が flaky**（レビューの独立実行で観測）**。★M35-01 とは無関係** | **記録のみ。progress-log の横断課題へ 1 行残す** |
| **8** | **両端 fixture の同一性を担保しているのはコメントだけである**（レビュー 中-1）**。⇒ 機械的な歯止め**（Go 側が `testdata/*.json` を書き FE が読む形）**は本サブの射程を越える** | **次の手番へ。今回はコメントへ「文言を変えるときは 2 ファイル」を明記するに留めた** |

---

## 11. 完了条件の照合

| # | 条件 | 状態 |
|---|---|---|
| 1 | 段 1 の試験が在り、破壊確認が実測で示されている | **満たす**（§2 段 1 の 3 本 ／ §5.1 の行列。★レビュー 高-1 を受けて 3 本目を足し、行列を採り直した） |
| 2 | 段 2 の 3 ファイルが 1 コミットで直っている。4 か所以外に参照が無いことが走査で示されている | **満たす**（`d4a1fb2` の 1 コミット ／ §5.3） |
| 3 | `existing_tag_id` が消えている | **満たす**（`web/src/types/tag.ts` から削除。代わりは新設していない） |
| 4 | 段 3 の機序が報告に書かれている（3 段 ＋ `null` でも救えない理由） | **満たす**（§4.1 ／ §4.2） |
| 5 | コミットが 3 つ以下に分かれている | **満たす**（段 1 ／ 段 2 ／ 本報告。段 3 はコミットを持たない） |
| 6 | §5 の検査がすべて緑（出力で判定。最後に回す） | **満たす**（§5.4 ＝テスト・型検査・E2E ／ §7 ＝常設検査 11 本すべて exit 0） |
| 7 | 完了報告を書き、`progress-log.md` へ索引行を 1 行足す | **満たす**（本ファイル ／ `progress-log.md` へ M35-01 の節を追記。`check-progress-log-index.sh` 緑で確認） |
| 8 | 完了報告を `check-md-emphasis.sh` に通す | **満たす**（検出 0 行。§7 の 10 行目） |
| 9 | 設計伝達レポートを出す（`/design_handover_report`）。§4 に段 3 の CHANGE 請求 | **満たす**——`docs/handover/design-reports/20260909-m35-01-design-exceptions.md`。§4-1 が段 3 の CHANGE 請求、§4-3 が F-2 の訂正、§4-2 が F-3 の事実、§4-4 が §2.4 の実測コスト、§4-5 / §4-6 が申し送り #1 / #2 |
