# 設計伝達レポート: M35-01（タグまわりの是正 3 件・公開前）

| 項目 | 内容 |
|------|------|
| 作業ID | M35-01 |
| 対象指示書 | `docs/instructions/M35-01-tag-fixes.md` **v1.0.0** ／ チェックリスト `docs/instructions/reviews/M35-01-review-checklist.md` v1.0.0 |
| CHANGE | **未起票。★製造は番号を消費していない**（`D-293`）。**指示書の「1 本の見込み」は段 3 のぶんであり、たたき台は §6。★段 2 に CHANGE は要らない**（実査で `docs/design/` に当該 DTO の記載が 0 件） |
| マイグレ | **1 本も消費していない。** `migrations/` に触れていない |
| 作成日 | 2026-09-09 |
| 実装コミット | `claude/m35-01-implementation-plan-3gxxfb`。着手基点 `4c0dcb2`。`6408514`（段 1）／ `d4a1fb2`（段 2）／ `2e0dece`（完了報告）／ `520f88b`（レビュー取り込み）／ `d7643fa`（Phase C・D）／ `444397a`（本レポート）／ **`f4f9e5d`（E2E 追加＝§5）**。実装差分（`docs/` 除く）＝**9 ファイル / +507 / −15**。**★新規 2 本**（`web/src/features/tag/api/tagApi.test.ts` `77 / 0` ／ `web/e2e/m35-01-tag-management-crud.spec.ts` `226 / 0`）**はいずれも `+` のみ。既存テスト 3 本への追記も deletions 0** |
| 源泉 | 完了報告 `docs/progress/M35-01-completion-report.md` ／ レビュー `docs/progress/m35-01-review.md`（高 4 / 中 4 / 低 6・**高の不採用 0 件**・往復 0 回）／ **開発者判断 5 件**（2026-09-09。§3-1）／ **開発者による実機確認（手順 1〜4 ＋ API 直叩き）** ／ 実装直後の同一セッションで生成 |
| 宛先 | 設計卓（親チャット） |

**本レポートは ①独自確定仕様 ②契約違反の独自判断 ③製造判断 ④残課題 に絞る。指示書どおりの部分は割愛する。**

**★★最重要は §1-1 と §4-1 である。**

| # | 内容 |
|---|---|
| **§1-1** | **`409 tag_in_use` の応答 DTO が変わった**（`usage_count` → `usageCount` ／ `force_delete_query` → `forceDeleteQuery`）**。⇒ `DES-002` の API 契約に as-built が無い。逐語を本文へ埋めてある** |
| **§4-1** | **段 3 の CHANGE 請求**——**「カテゴリ・色は一度設定すると未設定へ戻せない」を仕様として明文化する。★実装は 1 行も変えていないので、書かないと消える** |

> **★★設計卓は `docs/progress/` を読まない**（2026-08-11 開発者裁定①）。**したがって本レポートは参照だけを書かず、判断に要る中身をここへ埋めてある。**

---

## 1. 製造が独自に確定した実装仕様（DES 反映が要るもの）

### 1-1 ★★`DELETE /api/tags/{id}` のエラー契約（**as-built を逐語で埋める**）

**経路**: `DELETE /api/tags/{id}[?force=true]` — 実体は `internal/api/tag/handler.go:145-173`。

**★変えたのは詳細 DTO のキー名だけである**（ステータス・コード・母集団は不変）。**⇒ 本節は `DES-002` §4.2 へ as-built として反映してほしい。**

#### (a) エラー契約の全行

| 状況 | ステータス | コード | `details` |
|---|---|---|---|
| ID が正の整数でない | `400` | `invalid_id` | 無し |
| **他人のタグ ／ 存在しないタグ** | `404` | `not_found` | 無し |
| 使用中のタグを `force` 無しで削除 | `409` | `tag_in_use` | **有り**（下記 (b)） |
| それ以外の失敗 | `500` | `internal_error` | 無し |
| 成功 | `204` | ——| 本体無し |

#### (b) `409 tag_in_use` の応答 DTO（**★実測。`internal/api/tag/handler_test.go` の golden と逐語同一**）

```json
{"error":{"code":"tag_in_use","message":"このタグは使用中です。確認の上削除してください","details":{"forceDeleteQuery":"?force=true","usageCount":3}}}
```

| キー | 型 | 意味 | 旧 |
|---|---|---|---|
| `usageCount` | number | そのタグを付けたコンボの件数 | **旧 `usage_count`** |
| `forceDeleteQuery` | string | 強制削除に付けるクエリ。値は常に `"?force=true"` | **旧 `force_delete_query`** |

**★改名の根拠は `CLAUDE.md` §4**（JSON タグは camelCase で統一 ／ DB カラム名のスネークケースをフロントに持ち込まない）**。本経路だけが両側とも snake_case で通っていた。**

**★実査で分かったこと**——**タグ以外のハンドラの `details` は元から camelCase であった**（レビューが全数確認: `aliasText` / `existingId` / `combos` / `validations` / `limit` / `field`）**。⇒ tag が唯一の逸脱であり、本修正で API 全体が揃った。**

#### (c) ★持たせなかった分岐（**読む側が誤読しないために要る**）

| 分岐 | 実装 |
|---|---|
| **他人のタグに対する `403`** | **無い。`404` を返す**（存在そのものを明かさない） |
| **他人のタグに対する `409`** | **無い。★これは試験で固定してある**（§1-2） |
| `details.existing_tag_id` | **廃止した。★元から 1 か所も返していない死んだ項目であった** |

#### (d) ★`web/src/types/tag.ts` の `TagErrorDetail` は 2 キーになった

```ts
export interface TagErrorDetail {
  usageCount?: number;
  forceDeleteQuery?: string;
}
```

**★`existing_tag_id` を削除した。** バックエンドに producer が 0 件、フロントも型定義の 1 行以外に参照が 0 件であった。

**⇒ `DES-002` §4.2 のタグ削除の行へ、上記 (a)(b)(c) を明文化してほしい。**

---

### 1-2 ★★タグの利用者スコープは **2 段のガード**で成り立っている（**片方だけでは守れない**）

**指示書 §2.1 は「タグの Update / Delete は既に `WHERE id = ? AND user_id = ?` で絞っている」を前提としていたが、Delete はそれだけではない。**

| 段 | 所在 | 役割 |
|---|---|---|
| **1** | `internal/service/tag/service.go:106` の `s.repo.Get(ctx, userID, tagID)` | **他人の `tagID` が `CountUsage` へ届くのを止める** |
| **2** | `internal/repository/tag/repository.go:207` の `DELETE ... AND user_id = ?` | 他人の行を消させない |

**★★段 1 が要る理由が実装上にある**——**`repository.CountUsage`**（`repository.go:222`）**は tag リポジトリで唯一 `userID` を取らない**（`SELECT COUNT(*) FROM combo_tags WHERE tag_id = ?`）**。⇒ 段 1 を外すと、他人の「使用中」タグへの `DELETE` が `409` ＋ `usageCount` を返し、他人のタグの存在と使用件数が漏れる**（実測。レビュー 高-1）。

**★Update は同じ形ではない**——`UpdateTag`（`service.go:82-102`）は `Get` を通さず `repo.Update` を直接撃つ。**⇒ 「Update と Delete は同じ形」と読むと外れる。**

**固定した試験（実装は 1 行も変えていない）:**

| 試験 | 何を固定するか |
|---|---|
| `internal/repository/tag/repository_test.go` `TestDelete_IsScopedToUser` | 段 2 |
| `internal/api/tag/scope_test.go` `TestDelete_DoesNotLeakAnotherUsersTagUsage` | **段 1**（他人の使用中タグで `404`・応答に `usageCount` を含まない） |
| `internal/api/tag/scope_test.go` `TestDelete_CannotTouchAnotherUsersTag` | 経路全体 |

**⇒ `DES-002` または `DES-006`（`VAL-T03`）へ、「削除の利用者スコープは 2 段で成り立ち、`CountUsage` は利用者で絞らない」ことを注記してほしい。★`CountUsage` を単独で呼ぶ新しい経路を作ると、同じ漏れが再発する。**

---

## 2. 契約・設計に反する独自判断

**なし。**

指示書 §3 の「やらないこと」5 件はいずれも守っている（画面・文言の不変 ／ 未設定へ戻す処理を作らない ／ `CLAUDE.md` 不変 ／ `docs/design/` 不変 ／ `existing_tag_id` の代替を新設しない）。**§2.4 の同乗候補は必須ではなく、触らない判断は §3-1 の開発者判断による。**

---

## 3. 製造の判断

### 3-1 開発者へ確認して確定した点（2026-09-09）

| # | 論点 | 判断 | 反映 |
|---|---|---|---|
| **1** | **§2.4 の同乗候補**（`tag-val-t01-check-then-act-race`）**を当てるか** | **★触らない** | §4-4 |
| **2** | `internal/api/tag/handler.go:159` の `errors.As` 戻り値破棄 | **★報告のみ**（直さない） | §4-5 |
| **3** | `useTagManagement.ts` の `onError` 欠落 | **★報告のみ**（直さない） | §4-6 |
| **★★4** | **削除の `409 tag_in_use` を画面へ出すか**（§4-2 の申し送り） | **★★現状維持。⇒ 逐語＝「画面で 409 が起きないなら、API の仕様はあまり気にしません」** | §4-2 |
| **5** | **タグ管理画面の E2E を足すか** | **★足す**（`web/e2e/m35-01-tag-management-crud.spec.ts`。4 本） | §5 |

**★#1 の判断材料として実測コストを提示した**（§4-4）。**★#2 / #3 は「射程を広げない」判断である。⇒ 宛先が無いと完了報告の中で滞留するため、本レポート §4 へ候補として出す**（レビュー 中-2）。

### 3-2 推測で進めた点

| # | 箇所 | 推測と根拠 |
|---|---|---|
| **1** | **`web/src/features/tag/components/TagManagementPage.tsx:53-54` `:61-62` の `?? undefined` を「消す」か「コメントを付ける」か** | **指示書 §2.3 が裁量を与えている。⇒ 消したうえでコメント 4 行を残した。** 引数型が既に `string \| undefined` であり `??` は完全な no-op、かつ `??` は空文字を透過するのでガードにもなっていない（正規化の実体は `useTagFormDialog.ts:57-58` の `\|\| undefined`）。**⇒ 「正規化を足すならフック側であり、ここではない」をコメントに残した** |
| **2** | **段 2 の「`usageCount` が画面まで届く」試験の形** | **★文字どおりには達成できない**（§4-2）**。⇒ BE の生 JSON と FE の逐語同一 fixture で両端を留める形にした。** 片側だけの退行はそれぞれの側が赤で検出する（実測） |
| **3** | **`internal/model/api_error_test.go` の `existing_tag_id` を触るか** | **触らない。** 汎用 `APIError` の JSON marshal を見るサンプルキーであり（コードも架空の `"DUPLICATE_TAG"`）、タグ機能とは無関係である |

---

## 4. 設計担当が未把握の残課題・申し送り

### 4-1 ★★【CHANGE 請求】カテゴリ・色は未設定へ戻せない（**仕様として明文化する**）

**開発者判断（2026-09-08）＝「未設定へ戻す処理はいらない」。⇒ 実装は現状のままでよい。★差分がゼロなので、書かないと消える。**

**機序 3 段**（いずれも実測）:

| 段 | 所在 | 何が起きるか |
|---|---|---|
| 1 | `web/src/features/tag/hooks/useTagFormDialog.ts:57-58` の `values.category \|\| undefined` | 入力欄を空にすると**空文字が `undefined` になる** |
| 2 | `web/src/features/tag/api/tagApi.ts:80` の `JSON.stringify` | **`undefined` のキーが JSON から落ちる** |
| 3 | `internal/model/tag.go:67-71` の `*string` ＋ `internal/repository/tag/repository.go:165-179` の動的 SET | **nil を「変更なし」としてスキップする**（`SET` 句が組み立てられない） |

**★★`null` を送っても救えない**——**Go の `encoding/json` は `null` をポインタの nil へ落とすため、「キーの省略」と「明示的な `null`」を区別できない。⇒ フロント側の小修正では直らず、契約の決めごとが要る。**

**⇒ 反映依頼**:

| 反映先 | 書いてほしいこと |
|---|---|
| `DES-002` の `PATCH /api/tags/{id}` | **`category` / `color` は省略＝変更なしであり、未設定へ戻す表現を持たない。★`null` を送っても同じである**（理由＝上記） |
| `DES-006` §5（`VAL-T01`〜`VAL-T03` の表の周辺） | **一度設定したカテゴリ・色は UI から未設定へ戻せない。★これは欠陥ではなく仕様である**（2026-09-08 開発者判断） |

**★番号は起票時に registry で採番してほしい**（`D-293`。製造は自採番しない）。

### 4-2 ★★`TagApiError.usageCount` は画面まで届いていない（**着手前からの状態**）

**★指示書 §5-2 の「`usageCount` が画面まで届くこと」は、画面を変えずには文字どおり達成できない。**

| 所在 | 実態 |
|---|---|
| `web/src/features/tag/api/tagApi.ts:22-24` | getter が在るが**呼び出し元が 0 件** |
| `web/src/features/tag/hooks/useTagFormDialog.ts:62` | 唯一の `TagApiError` 消費者。読むのは `code` だけ |
| `web/src/features/tag/components/TagManagementPage.tsx:68-75` | 削除前に**一覧の `Tag.usageCount`** から `force` を決める。**⇒ 通常経路で `409` が発生しない** |
| `web/src/features/tag/hooks/useTagManagement.ts:26-30` | `deleteMutation` に **`onError` が無い**。⇒ 409 が来ても握り潰される |

**★指示書 §3-1**（タグの画面・文言を変えない）**が、これを直すことを禁じている。⇒ 代替として BE の生 JSON と FE の逐語同一 fixture で両端を留めた。**

**⇒ ★★決着した。⇒ 現状維持である**（開発者・2026-09-09）。逐語は「**画面で 409 が起きないなら、API の仕様はあまり気にしません**」であった。

**⇒ 反映依頼**——**`DES-005` のタグ管理画面へ 1 行**: **削除は一覧の使用件数を見て `force` を先に付けるため、`409 tag_in_use` は UI から通らない。⇒ 同エラーは API の契約としてのみ存在する。**

**★これは「直さない」の記録であって「気づかなかった」ではない。** `TagApiError.usageCount` の getter に読み手が無いことも、この判断の帰結として説明が付く。

### 4-3 ★指示書・followup の根拠記述の誤り（**訂正してほしい**）

| 対象 | 誤り | 実測 |
|---|---|---|
| **指示書 `M35-01-tag-fixes.md` §2.2-4** ／ **`followup-backlog.md` の `tag-error-detail-dto-snake-case` 行** | 「`grep -rn "existing_tag_id" --include='*.go'` が **0 件**」 | **3 件**——`internal/model/api_error_test.go:57` `:74` `:75` |

**★削除の判断は変わらない**（3 件はいずれも汎用 `APIError` テストのサンプルキーであり、タグ DTO の producer ではない）**。⇒ ただし根拠として引き継がれると外れる。**

**★同型は指示書 §2.1-2 の破壊確認の指定にもある**——「`repo.Delete` から `AND user_id = ?` を外すと赤くなる」は、二重ガードのため**成立しない**（§1-2）。

### 4-4 ★`tag-val-t01-check-then-act-race` は未着手（**フェーズ5 へ返す**）

**★followup 登録の更新依頼（既存行の更新）:**

| 項目 | 内容 |
|---|---|
| **スラッグ** | `tag-val-t01-check-then-act-race`（**既存行の更新**） |
| **何が起きるか** | `internal/service/tag/service.go:69-78`（`CreateTag`）と `:87-96`（`UpdateTag`）が `repo.List` で全件取って Go 側で同名を探し、その後 `repo.Create` / `repo.Update` を撃つ。競合に負けた側は `UNIQUE (user_id, name)` の生エラーを返し、ハンドラ（`handler.go:92-100`）が `ErrTagNameDuplicate` として拾えず **`409 tag_name_duplicate` ではなく `500 internal_error`** になる |
| **根拠** | `internal/service/tag/service.go:34-36` の `service` 構造体は **`repo` しか持たない**（`*sql.DB` を持たない）。先例の `internal/service/combo/service.go:354` / `internal/service/setup/` は `*sql.DB` を持つ |
| **★割付の候補と理由** | **フェーズ5 のまま据え置き。★「タグ周りを触る手番があれば同乗できる」という前提は成立しなかった**——同じ形を当てるには (a) `tagsvc.New()` のシグネチャへ `*sql.DB` を足す (b) リポジトリに Tx 版の `List` / `Create` / `Update` を新設 (c) 呼び出し 3 か所の追随（`internal/api/tag/scope_test.go:38` ／ `internal/api/tag/handler_test.go` の `newEcho` ／ `cmd` の配線）が要る |
| **更新後の状態** | **未着手・フェーズ5**（`M35-01` で同乗を検討し、開発者判断 2026-09-09 で見送り） |
| **★あわせて記録してほしい安い代替案** | **`UNIQUE (user_id, name)` 違反を `ErrTagNameDuplicate` へ翻訳する**（約 10 行・公開シグネチャ変更なし）**。⇒ 競合そのものは残るが、`500` → `409` の契約違反だけは消える。★`M24-11` / `M24-13` と「同じ形」ではないため、採るなら逸脱として扱う必要がある。開発者へ提示したが不採用**（2026-09-09） |

### 4-5 ★【followup 新規登録の依頼】`handler.go:159` の `errors.As` 戻り値破棄

| 項目 | 内容 |
|---|---|
| **スラッグ（案）** | `tag-delete-errors-as-result-discarded`（**新規登録**） |
| **何が起きるか** | `internal/api/tag/handler.go:159` が `errors.As(err, &inUse)` の戻り値を捨てており、`inUse` が nil のまま `:163` の `inUse.UsageCount` を読むと **nil 参照で panic する** |
| **再現条件** | `tagsvc.TagInUseError.Is(target)` が `target == ErrTagInUse` を返すため、**センチネル `ErrTagInUse` を裸で返す実装が 1 つ増えるだけで到達する**（`errors.Is` は true・`errors.As` は false）。**★現状は `service.DeleteTag` が必ず `*TagInUseError` を返すため起きない**（`return ErrTagInUse` の裸は grep で 0 件） |
| **割付の候補と理由** | **フェーズ5。★実害は現時点で 0 だが、塞ぐのは 3 行である**（`if !errors.As(...) { default 分岐と同じ 500 へ落とす }`）。同じ形が他ハンドラに無いかも併せて見ると安い |
| **状態** | **未着手**（`M35-01` で発見・開発者判断 2026-09-09 で「報告のみ」） |

### 4-6 ★【followup 新規登録の依頼】タグ削除の 409 が握り潰される

| 項目 | 内容 |
|---|---|
| **スラッグ（案）** | `tag-delete-conflict-silently-swallowed`（**新規登録**） |
| **何が起きるか** | `web/src/features/tag/hooks/useTagManagement.ts:26-30` の `deleteMutation` に `onError` が無く、`409 tag_in_use` が来ても画面に何も出ない |
| **再現条件・根拠** | `TagManagementPage.tsx:70-72` が**一覧の `Tag.usageCount`** から `force` を決めるため、一覧が陳腐化していると 409 が返る。**★これが §4-2（getter に読み手が無い）の原因そのものである** |
| **割付の候補と理由** | **★★優先度は低い。** §4-2 が 2026-09-09 に「現状維持」で決着したため、**画面へ出す前提が消えた。⇒ 直す動機は「UI から通らない経路のエラー処理を揃える」だけになる** |
| **状態** | **未着手・優先度 低**（`M35-01` で発見。開発者判断 2026-09-09＝現状維持） |

### 4-7 ★レビュー低指摘の繰越（2 件）

| # | 内容 | 割付 |
|---|---|---|
| 1 | **`scripts/check-import-order.sh` のベースラインが実測とずれている**（ベースライン 101 / 実測 **99**。**★本サブは `TagManagementPage.tsx` を是正して 1 件減らした側であり、ドリフトの原因ではない**） | スクリプト編集の手番で `BASELINE` を下げる |
| 2 | **`web/e2e/m31-02-tag-field-drag.spec.ts` の 2 件が flaky**（レビューの独立実行で「右へ／下へ枠外までドラッグ」が 1 回目に `selectionLength` 0 になりリトライで通る）**。★`M35-01` とは無関係**（対象コードを触っていない） | 記録のみ。`M31-02` の面 |

---

## 5. 参考（触れていない＝不変の証跡）

- `docs/design/` は無改変（`git diff --stat 4c0dcb2 -- docs/design` が空）。
- `migrations/` は無改変。最新は `000106_data_correct_terry_quick_burn_code`。
- `CLAUDE.md` ／ `web/CLAUDE.md` は無改変。
- `go.mod` ／ `web/package.json` ／ `web/pnpm-lock.yaml` は無改変（新規依存 0 件）。
- タグの画面・文言（DOM・i18n）は無改変。`TagManagementPage.tsx` の変更は no-op 除去とコメントと import 順のみ。
- 破壊確認は実測後にすべて復元済み（`git diff internal/repository/tag/repository.go internal/service/tag/service.go` が空）。
- `TestUpdate_CannotTouchAnotherUsersTag` ／ `TestList_IsScopedToRequestingUser` ／ `TestCreate_BelongsToRequestingUser` は無改変。
- `go test ./...` 全緑 ／ `pnpm test` 223 ファイル 2623 件緑 ／ `tsc --noEmit` 成功。
- `make e2e-only P="m24-02 m31-02-tag-field-drag m27-02a"` 13 件緑。
- 常設検査 11 本すべて exit 0（1 本目は `check-artifact-integrity.sh`）。
- **★実機確認を実施した**（2026-09-09。使い捨てスタック）——段 3 の「未設定へ戻せない」は**実装を読んだ推定ではなく実測**である。`409` の生 JSON も §1-1 の逐語と一致した。**開発者も手元で `409` を再現済み。**
- **★E2E を 4 本足した**（`web/e2e/m35-01-tag-management-crud.spec.ts`。開発者判断 2026-09-09）。`make e2e-only P="tag m24-02 m27-02a"` で **20 件緑**、既存 spec への干渉なし。

---

## 6. CHANGE 起票のたたき台（設計担当向けチェックリスト）

**★1 本で足りる見込みである。**

| # | 対象 | 内容 |
|---|---|---|
| **1** | **`DES-002`**（API 契約） | **(a) §1-1 の as-built**——`409 tag_in_use` の `details` が `usageCount` / `forceDeleteQuery` になったこと ＋ エラー契約の全行 ＋ 持たせなかった分岐（403 なし・他人には 409 を返さない）／ **(b) §4-1**——`PATCH /api/tags/{id}` の `category` / `color` は省略＝変更なしであり、`null` でも未設定へ戻せないこと |
| **2** | **`DES-006`** §5 | **§4-1**——カテゴリ・色を未設定へ戻せないことを仕様として明記（`VAL-T01`〜`VAL-T03` の表の周辺） |
| **3** | **`DES-002` または `DES-006`** | **§1-2**——タグ削除の利用者スコープが 2 段で成り立つこと。**`CountUsage` は利用者で絞らないため、単独で呼ぶ経路を作ると漏れる** |

- **マイグレは 0 本**（新規作成なし。連番の払い出しも行っていない）。
- **番号は起票時に registry で採番してほしい**（`D-293`。製造は自採番しない）。
- **★段 2 の DTO 改名だけなら CHANGE は不要だった**——実査で `docs/design/` に `usage_count` / `force_delete_query` / `TagErrorDetail` の記載が **0 件**であった。**⇒ 上表 1-(a) は「載っていなかったものを載せる」依頼である。**

---

## 7. 教訓（retrospective 行き）

> **★親は本節を読まなくてよい。** 宛先は `retrospective-log` へのバッチ反映であり、実施者は設計担当。

| # | 教訓 |
|---|---|
| **1** | **★★破壊確認で「緑のまま」が出たら、それが冗長ガードなのか未固定のガードなのかを、もう一段掘ること。** 本サブは Delete のガードが二重であることを実測し、行列の「両方緑」を冗長の証明として読んで止めた。**⇒ 実際にはそこに未固定のガードが 1 段あり、外すと他人のタグの存在と使用件数が漏れた。★一般形＝「両方緑」は冗長の証明であると同時に、試験が届いていない領域の宣言でもある。** |
| **2** | **★指示書が指定する破壊確認の手順は、実装の形と合わないことがある。** 「同じドメインの隣のメソッドと同じ形だろう」という読みが外れる（本件では `UpdateTag` が `Get` を通さず、`DeleteTag` だけが通していた）。**⇒ 破壊確認は「指定された 1 行を外す」ではなく「守っている段を全部数える」から始めること。** |
| **3** | **★「grep が 0 件」という根拠は、書いた時点の走査条件ごと引き継がれる。** 本件では `--include='*.go'` の 0 件が 3 件であり、指示書・followup・設計伝達レポートの 3 資料へ複製されていた。**⇒ 根拠として grep の件数を書くときは、走査式そのものを併記すること**（`E-118` と同型）。 |
| **4** | **★「両側とも同じ規約違反で揃っている」状態は、直す手番でこそ壊れやすい。** 本件は BE / FE / 型 / 消費の 4 か所を 1 コミットで直したうえで、**両側にそれぞれ「相手側の退行を検出する試験」を置いた。⇒ 型検査は歯止めにならない**（両方を同時に変えれば通る）**ので、キー文字列そのものを見る試験が要る。** |
| **5** | **★同じ文が 2 ファイルへ複製されているとき、片方だけ直すと「失効した記述」を新しく作ることになる。** 本件は `handler.go` の godoc を直しながら、逐語で対になる `tagApi.ts` のコメントを「DB 側の集計を指す」と読んで残した（レビューが指摘）。**⇒ 失効記述を直すときは、同じ文を `grep` で全数拾うこと。** |
