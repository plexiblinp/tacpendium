# M27-02a レビュー報告書

| 項目 | 内容 |
|------|------|
| 対象指示書 | `docs/instructions/M27-02a-reachability-save-path-and-selectors.md` **v1.2.0** |
| チェックリスト | `docs/instructions/reviews/M27-02a-review-checklist.md` **v1.0.0**（本レビューの正本） |
| 対象完了報告 | `docs/progress/M27-02a-completion-report.md` |
| 着手基点 / HEAD | `0853c74` → `289ffe6`（4 実装コミット ＋ 1 報告コミット） |
| レビュー実施日 | 2026-09-02 |
| レビュー担当 | 品質レビュー Claude Code（read-only。コード変更なし） |

---

## 総評

**重大 0 件。完了承認を妨げる欠陥は無い。** チェックリスト §7 の重大判定 11 項目はすべて満たしている——並列レーン（`migrations/` / `character_data/` / `internal/seedgen/`）への差分は実際の変更ファイル一覧で 0、`docs/design/` と `followup-backlog.md` は 1 バイトも触っていない、応答の形は `message` 以外変わっていない、`Enter` はフォームを送信しない（そもそも `<form>` が無い）、外側クリックで閉じる挙動は E2E で固定されている。

調査の質は本プロジェクトの中でも上位である。`PATCH` の新発見、`SD-016` の「再現しない」の機構特定、既存失敗 2 件の帰属を `git show <基点>:<path>` で実測して確定させた手順、波及 15 コントロールを数えてから共通化の中間解を選んだ判断——いずれも「症状ではなく原因」を取りに行っている。**新規 3 ファイルの deletions はすべて 0**（`E-225` の上書き事故なし）。E2E 新規 3 件は本レビューでも再実行して緑を確認した。

一方で **「高」が 3 件残る。3 件とも動作は正しく、テストも lint も型検査も緑のまま通る種類の欠陥である**——(1) `internal/model/api_error.go` の godoc が「唯一の組み立て先」「HTTP は 400」と断言しているが、同じ定数を使う 422 の経路と、第 3 の形を作る経路が現に在る。(2) `progress-log.md` が「次の払い出しは引き続き `000082`」と書いたが、ボード `D-689` の正本は `000092` である。(3) `followup-backlog.md:950` は `PUT` しか名乗っていないまま（指示書 §2.1.3.2 は「設計卓が済ませた」と書いているが、実物は未反映）。**3 件とも後任がそのまま複製する形をしている。**

---

## 設計準拠性レビュー結果

### §0.4 並列レーンの侵食（最優先・実際の変更ファイル一覧で判定）

| # | 検査 | 判定 | 根拠 |
|---|---|---|---|
| ★★1 | `migrations/` に差分が無いか | **◎** | `git diff --numstat 0853c74 289ffe6` の 18 行に `migrations/` は 1 件も無い。`ls migrations/` の最大は `000081` のまま |
| ★★2 | `character_data/` に差分が無いか | **◎** | 同上・0 件 |
| ★★3 | `internal/seedgen/` に差分が無いか | **◎** | 同上・0 件。`internal/` で触れたのは `internal/api`（4 ファイル）と `internal/model`（1 ファイル）のみで、いずれも射程内 |
| — | マイグレの自採番 | **◎** | 消費 0 本。自採番していない（**ただし progress-log の記述に失効あり＝高-2**） |

### §0.3 「重大でないもの」の誤判定防止（確認済み）

| # | 内容 | 確認 |
|---|---|---|
| ★★1 | 検証エラーが到達不能のままか（(a) 採用） | (b)/(c) はやっていない。**むしろ「到達不能」という前提自体が失効していることを実測で示した**（`setups[*]` は FE zod が検証せず BE だけが持つ）。(a) の結論は変えていない ⇒ **正しい扱い** |
| ★★2 | `GET /api/moves` の 500 | **(a) 非対称の是正と判定して直した。** 53 サイト中 52 が非空という実測が根拠として示されている ⇒ チェックリストの「(a) 判定なのに直していなければ高」に照らして正しい |
| ★★3 | 3 件を 1 部品へ寄せていない件 | **別実装であることを実測で示し**（`TagSelector` は `SearchableSelect` を import していない）、**寄せない判断と波及の数（15 コントロール / 13 ファイル）を書いている** ⇒ 条件を満たす |
| ★5 / ★6 / ★7 | `M28-01` 未適用 ／ `docs/design/` 未編集 ／ `followup-backlog` §J 以外未編集 | いずれも該当（モジュールパスは `github.com/plexiblinp/combomgr` のまま。`docs/design/` `followup-backlog.md` の numstat は 0） |

### §1 束 A — 保存が通らないときに理由へ届くか

| # | 重み | 判定 | 所見 |
|---|---|---|---|
| 1-1 | 重大 | **◎** | `PUT`（`internal/api/combo/handler.go:427-431`）／`PATCH`（同 `:382-386`）とも `model.NewValidationFailedError(result)` へ差し替わり、`message` が非空。`TestHandler_ValidationFailed_MessageIsUniformAcrossVerbs` が 3 動詞を同じ表で回して**値の一致まで**見ている |
| 1-2 | 高 | **○** | 寄せ先は `internal/model/api_error.go:70` の `NewValidationFailedError` 1 本。リテラル `"validation_failed"` は非テストコードから完全に消えた（`grep` で定数宣言 1 件のみ）。`"バリデーションエラーがあります"` も同様。**ただし godoc の「唯一の組み立て先」は事実と違う**（高-1） |
| 1-3 | 高 | **◎** | `POST` の文言は `MessageValidationFailed` = 「バリデーションエラーがあります」で不変。上記テストが `POST` も含めて値一致を検査するため、後退すれば落ちる |
| 1-4 | 中 | **◎** | 完了報告 §4b.1 が全数 3 件（検証 2 ＋ 非検証 1）と**母数**（非対称が無かった 9 ドメイン）を出している。`presets` / `users` が `writeServiceError` を共有していて構造的に割れない点も実物と一致（`internal/api/preset/handler.go:245` / `user/handler.go:75`） |
| 1-5 | 高 | **◎** | `RECIPE_TAB_FIELD_PREFIXES` に `"setups["` / `"setups."` を追加（`web/src/features/combo/editorTabs.ts:56-61`）。`D-593` の裁定どおり |
| 1-6 | 高 | **◎** | **先に確かめた記録が在る**（完了報告 §3）。実物でも裏が取れた——同梱セットプレイの入力欄は `ComboEditor.tsx:1046` の `mode === "new" \|\| "copy"` 配下のみ、`buildCreatePayload()`（同 `:341`）は `setupsToCreate.length > 0` でしか `setups` を積まない（同 `:369`）、`runPut`（同 `:720-725`）はそれを土台にする。⇒ 「欄の無いタブを指す」形は起きない。前方一致の追加だけで足りる |
| 1-7 | 中 | **◎** | 計上規則は `editorTabs.ts` の `tabOfIssueField` 1 か所に集約されており実装に散っていない。定数化不要という判断は妥当 |
| 1-8 | 高 | **◎** | 完了報告 §3 が 4 段（保存が通らない → 理由が分かる → 直す欄を指す → 欄が在る）を実測で埋め、`web/e2e/m27-02a-reachability.spec.ts:109` が同じ 4 段を固定。**本レビューで再実行して緑を確認** |
| 1-9 | 高 | **◎** | (a) の前提を `curl` で発火させて確かめた記録が §4.2 に在る。**さらに「着手前は `PUT` で `VAL-C02` が出ると `message` 空 ＋ `field` 欠落の二重欠落だった」という、備えになり切っていなかった事実まで書いている** |

### §2 束 B — 候補選択に操作が届くか

| # | 重み | 判定 | 所見 |
|---|---|---|---|
| ★★2-1 | 高 | **◎** | 部品同定は本サブの成果物として §2 に在る。**独立に検証した**——`SearchableSelect` の実 import は `ComboListFilters.tsx` / `CharacterSelector.tsx` の 2 本、`CharacterSelector` の本番 import は 12 ファイル。報告の「15 コントロール / 13 ファイル」と整合する |
| 2-2 | 高 | **◎** | 原因が特定されている（`Enter` は正しく効いており、折りたたみ combobox で ARIA 標準どおりトリガが開き直すだけ。真の非対称はキャラ欄が順送りの停止点に入っていないこと）。**症状への対処ではなく原因の記述である。★開発者裁定で対応不要＝欠陥ではない** |
| ★2-3 | **重大** | **◎** | `ComboEditor.tsx` / `ComboEditorBasicFields.tsx` に `<form>` 要素は 1 つも無く、候補は全て `type="button"`。実装上 implicit submission が起きえない。E2E も `toHaveURL(/\/combos\/new/)` で固定している |
| 2-4 | 高 | **◎** | 再現しなかったこと＋その機構（Radix `DismissableLayer` の `pointerdown` ＋ 内側起点ガード）を特定したうえで、E2E で閉じない条件を固定（spec `:73`）。**「再現しなかった」で閉じずにテストを置いたのは正しい** |
| ★2-5 | **重大** | **◎** | 同 spec の後段が外側クリックで `listbox` が `toHaveCount(0)` になることを固定。本レビューで再実行して緑 |
| 2-6 | 高 | **◎** | `TagSelector.tsx:112-119` に `role="listbox"` / `onKeyDown` / `ref`、候補に `role="option"`。ユニット 6 件が矢印移動・端の巡回・絞り込み後の移動・`Enter` 選択を固定（17 件緑を再実行確認） |
| ★★2-7 | **重大** | **◎** | 矛盾なし。単一選択（`SearchableSelect` の `handlePick` → `setOpen(false)`）は選んで閉じ、複数選択（`TagSelector.toggle`）は開いたまま。**`useListboxKeyNav` が `Enter` を一切扱わず、閉じる/閉じないの決定を利用側に残した設計がこの非矛盾を構造的に保証している** |
| 2-8 | 中 | **◎** | 「選んで開いたまま」を開発者確定として §2.4 に明記。E2E とユニットの両方で固定 |

### §3 既存の破壊（非破壊性）

| # | 重み | 判定 | 所見 |
|---|---|---|---|
| ★★3-1 | **重大** | **◎** | `ComboEditorBasicFields.tsx` の差分 0。単一選択 5 欄・起き攻め 12 個・`type=flag` の数字キーはいずれも当該ファイル内にあり無傷 |
| ★★3-2 | **重大** | **◎** | `useFieldSequence` / `focusableIn` / `[data-seq-stop]` を持つファイル群は差分 0。info-mark の DOM 位置も動いていない。`ComboEditorBasicFields.test.tsx:412-445` の既存テスト（群 → ⓘ の順を固定）が引き続き網になっている。**★ただしチェックリスト §6-2 の破壊確認そのものは実施記録が無い（中-7）** |
| 3-3 | **重大** | **◎** | `SearchableSelect` の Props・DOM 構造・`handlePick` は 1 行も変わっていない。変わったのはキーボード処理の**置き場所**だけ。既存 19 テスト ＋ `CharacterSelector` 12 テストを再実行して緑を確認。波及の全数も報告に在る |
| 3-4 | 高 | **◎** | `hit_type` / `opponent_size` に触れていない（`internal/model/combo.go` 差分 0） |
| 3-5 | **重大** | **◎** | `APIError` / `APIErrorResponse` の型定義は不変。`NewValidationFailedError` は `NewAPIErrorWithDetails` を経由して `{code, message, details:{validations}}` を出す——**着手前の直書きと同一構造**。ステータス・エラーコード・`issues[]` は不変 |
| 3-6 | **重大** | **◎** | `recipe_hash` / `VAL-C02` に触れていない。`internal/service/validation/combo.go:192,198` は差分 0 |

### §4 テストの妥当性

| # | 重み | 判定 | 所見 |
|---|---|---|---|
| 4-1 | 高 | **◎** | `PUT` / `PATCH` / `POST` の 3 動詞を 1 つの表で回して**値の一致まで**検査。片方だけではない |
| 4-2 | 高 | **◎** | `Enter`／矢印／端の巡回／ドラッグ中に閉じない／外側クリックで閉じる——ユニット 6 件 ＋ E2E 3 件で全部が固定されている |
| ★4-3 | 中 | **◎** | 位置インデックス参照は増やしていない。テスト内の `mockTags[0]` / `options()[1]` はローカルに閉じた配列であり、`M27-01` が踏んだ「正典配列の途中への挿入」型ではない |
| 4-4 | 中 | **○** | 4 件中 3 件で破壊確認を実施（§7-3 に落ちた箇所の局在まで記録）。**1 件（§6-2）が別の破壊へ差し替わっており、その差し替えが報告に書かれていない**（中-7） |

### §5 ドキュメント・進捗ログ

| # | 重み | 判定 | 所見 |
|---|---|---|---|
| 5-1 | **重大** | **◎** | `docs/progress/M27-02a-completion-report.md`。`bash scripts/check-progress-log-index.sh` = 違反なし（66 件すべて追跡できる） |
| 5-2 | 高 | **◎** | §0〜§10。指示書 §5 が求めた §1〜§7 ＋ §4b がすべて在る |
| 5-3 | 高 | **△** | 索引行は在る（`progress-log.md:5303-5315`）。**ただし内容に失効が 2 つ混ざっている**（高-2・中-1） |
| 5-4 | 高 | **◎** | 6 件それぞれの再現判定が §1 の表に在り、解消済み・裁定済みの経緯まで書かれている |
| 5-5 | 高 | **○** | CHANGE たたき台は §5 に在り、自採番していない。**`DES-002` 宛のたたき台に `move.Update` の第 3 形が抜けている**（中-6） |

### §6 破壊確認

| # | 期待 | 判定 |
|---|---|---|
| 6-1 | `PATCH` の `message` を空へ戻すと 4-1 が落ちる | **◎** 実施記録あり（§7-3。落ちるのが `PATCH` のサブテストだけであることまで確認） |
| 6-2 | info-mark を前へ移すと順送りテストが落ちる | **△** 実施記録なし。代わりに `onInteractOutside` の破壊を実施している。差し替えの事実が報告に無い（中-7） |
| 6-3 | タグ欄の矢印キー処理を外すと 4-2 が落ちる | **◎** 実施記録あり（5 件が落ちる） |
| 6-4 | 外側クリック処理を外すと 2-5 が落ちる | **◎** 実施記録あり |

---

## 設計準拠性以外の指摘事項

### 1. `role="option"` を付けた判断（設問への回答）

**「新規登録」行に `role="option"` を付けた判断そのものは妥当と評価する。** 根拠は 2 つ。

- **代替が無い。** 検索が 0 件に絞られた先で `[role="option"]` が消えると、`useListboxKeyNav` の `optionButtons()` が空配列を返し、`moveFocus` が即 return する。⇒ **その状態でだけキーボードが届かなくなり、本サブが直そうとした欠陥（`tag-field-keyboard-unreachable`）が「タグを新規作成するとき」に限って残る。**
- **利用側で `role` を付けるかどうかが候補列の定義になる、という契約が `useListboxKeyNav.ts:19-22` に明記されている。** フック側は行の意味を知らないので、この決めは利用側に置くのが正しい。

ただし**厳密な ARIA では `option` は「選べる値」であって「実行するアクション」ではない**（`aria-selected` が常に `false` である点が、その居心地の悪さを示している）。**採用は支持するが、代償を 2 つ抱えている**——中-4 と中-5 に分けて書いた。

### 2. 既存セレクタとの衝突（設問への回答）

**衝突していない。** 全数を確認した。

- Radix `Popover` は閉じている間 `PopoverContent` を portal ごと unmount する。⇒ タグ欄の `listbox` / `option` は**タグ欄を開いている間しか DOM に存在しない**。
- 無スコープで `getByRole("listbox")` / `getByRole("option")` を使っている既存 spec は `web/e2e/support/characters.ts:38,59` ／ `m14-03d` ／ `m14-03e` ／ `m17-05b` ／ `m20-04` ／ `moves-edit` の 6 系統だが、**いずれもキャラ選択・ステータス選択を開いている最中の呼び出し**であり、同時にタグ欄が開くことはない。
- ユニット側で `ComboEditor` を丸ごと描画して `getAllByRole("option")` を数えているテストは存在しない（`ComboListFilters.test.tsx:149` は `within(getByRole("listbox"))` でスコープ済み）。
- 実測: `pnpm vitest run` を `TagSelector` / `SearchableSelect` / `CharacterSelector` / `editorTabs` の 4 本に絞って再実行 → **75 件緑**。`make e2e-only P=m27-02a-reachability` → **3 件緑**。

### 3. `SearchableSelect` の外形（設問への回答）

**Props・DOM・端での巡回のいずれも変わっていない。** 差分は import 1 行の入れ替えとローカル関数 3 本の削除のみで、`<ul ref={listRef} role="listbox" onKeyDown={handleListKeyDown}>` の形も `optionButtons` の `[role="option"]` セレクタも巡回式 `(current + delta + len) % len` もそのまま移っている。既存 19 テストが緑であることが網。**1 点だけ微差がある**（低-1）。

### 4. コーディング規約

- **`CLAUDE.md` §4 マジックストリングの定数化**: `validation_failed` の 7 か所（基点で実測）→ 定数 1 か所へ。文言も同様。**規約の趣旨どおりの是正である。**
- **import 順（§4）**: 新規 import 2 本（`@/hooks/useListboxKeyNav`）はどちらも `@/` 群の中に正しく置かれている。`bash scripts/check-import-order.sh` は NG（102 / ベースライン 101）だが、**offender 一覧に本サブの新規・改変ファイルは 1 件も新規登場していない**（`ComboEditor.tsx` と `TagSelector.test.tsx` は在るが、どちらも本サブで import 行を触っていない）。⇒ **完了報告の「基点で既に +1」という主張と整合する。本サブの増分ではない。**
- **その他の常設検査**: `check-progress-log-index.sh` / `check-stop-discipline.sh` / `check-doc-refs.sh` / `check-doc-inventory.sh` / `check-md-emphasis.sh` を本レビューで実行 → **すべて違反なし**。
- **`console.log` / `fmt.Println` の残置**: 0 件。
- **セキュリティ**: 応答に新しい情報を足していない（`message` は固定文言）。内部エラーの `message` も「サーバーエラーが発生しました」の定型で、内部詳細を漏らしていない。
- **依存追加**: 0 件。

---

## 推奨修正（優先度別）

### 重大（完了承認を妨げる）

**なし。** チェックリスト §7 の 11 項目すべてに該当なし。

### 高（M27 完了前に修正必須）

#### 高-1 `internal/model/api_error.go` の godoc 3 か所が実装と食い違っている

根拠のファイル・行:

- `internal/model/api_error.go:44` — 「**HTTP は 400 を返す**」
- `internal/model/api_error.go:57` — 「**★★本関数が message の唯一の組み立て先である**」
- `internal/model/api_error.go:52` — 「**★呼び出し側で個別に書かないこと**」

実装:

| 経路 | ステータス | message | details |
|---|---|---|---|
| `NewValidationFailedError`（combo POST/PUT/PATCH ／ setup POST/PATCH の 5 か所） | 400 | `MessageValidationFailed` | `{"validations": …}` |
| **`internal/api/config/handler.go:68-71`** | **422** | **`"configuration validation failed"`（英語・直書き）** | `{"validations": …}`（手組み） |
| **`internal/api/move/handler.go:110-111`** | 400 | **`ve.Message`（動的）** | **`{"field": …}`** |

**本サブ自身がこの矛盾を作った**——`config/handler.go:70` と `move/handler.go:111` のリテラルを `model.ErrorCodeValidationFailed` へ差し替えたことで、**「HTTP は 400」と書いた定数が 422 の応答にも使われる状態になった**。

**なぜ「高」か**: 完了報告 §5 の `DES-002` たたき台自身が「**統一の例外であることを書いておかないと、次の担当が『漏れ』と読んで揃えに行く**」と書いている。**ところがその警告が書かれていない場所こそが、次の担当が最初に開く `api_error.go` である。** 動作は正しく、テストも型検査も緑のまま通る。人が読む以外に見つける経路が無い。

**推奨**: godoc を実装に合わせる。(a) `ErrorCodeValidationFailed` から「HTTP は 400 を返す」を外すか「★例外＝`PUT /api/config` は 422 で返す」を併記する。(b) `NewValidationFailedError` の「唯一の組み立て先」を「**`{"validations"}` 形の 400 応答の唯一の組み立て先**」へ絞り、`config`（422・英語）と `move.Update`（`details.field` 形）が別系統として在ることを 2 行で書く。

#### 高-2 `progress-log.md` の索引行が、マイグレ連番の正本と食い違っている

根拠:

- `docs/progress/progress-log.md:5304` — 「**マイグレ消費 0**（`ls migrations/` の最大は `000081` のまま。⇒ **次の払い出しは引き続き `000082`**）」
- 正本 = `docs/process/parallel-board.md:108,390` — 「**次に払い出すマイグレ連番 ＝ `000092`**」（`D-689`。`M14-03f` が走行中に `000082`〜`000091` の 10 本を消費済み）

**「マイグレ消費 0」と「作業ツリーの最大が `000081`」は正しい。誤っているのは、そこから導いた「次の払い出しは `000082`」だけである。**——`M14-03f` は別レーンで走っており、その 10 本は本ツリーに現れない。**⇒ 本行を読んだ次のサブが `000082` を自採番すると、`D-120` が禁じる衝突が起きる。**

**なぜ「高」か**: `parallel-board` §2.2 のセルは**同じ理由で 2 度失効した前科がある**（`E-114` / `E-191`）。その教訓は「連番を書いている場所を `grep` で全数拾え」だった。本行は**その全数の外に新しく生えた 3 か所目**である。

**推奨**: 当該括弧内を「**⇒ 次の払い出しはボード `D-689` を見ること（本ツリーの `ls migrations/` で決めない）**」へ改める。数字を書かないのが最も安全（書けばまた失効する）。**★`progress-log.md` は製造が直接書ける面であり、この是正は製造の手番である。**

#### 高-3 `followup-backlog.md` の `combo-put-error-message-empty` が `PUT` のみのまま

根拠:

- `docs/handover/followup-backlog.md:950` — 「★`PUT /api/combos/{id}` の検証エラー応答の `message` が空文字である」（`PATCH` への言及なし）
- 指示書 `M27-02a-reachability-save-path-and-selectors.md` §2.1.3.2 末尾 — 「**★★`PATCH` の発見を追跡行へ写す手番は設計卓が持つ**（`D-382`）。**⇒ 本追補の時点で設計卓が済ませた**」

**「済ませた」と書かれているが、追跡行は写されていない。**

**なぜ「高」か**: 追跡行は次の担当の一次情報である。`PUT` だけを名乗る行が残ると、**この欠陥が `PATCH` にも在ったという最も重要な発見が、追跡表からは読めない**。指示書側に「済ませた」と書いてあるぶん、誰も再確認しない。`M19-DESIGN-08` §3.1 の `D-250` と同型。

**★これは設計卓の手番であり、製造には直せない**（`D-382`＝製造が書けるのは §J だけ）。完了報告 §5 は「設計卓が持つ（指示書 §2.1.3.2 で済ませたとの記載あり）」と伝聞で書いており、**実物を照合していない**。**推奨**: 設計伝達レポート §4 へ「**指示書は済んだと書いているが `followup-backlog.md:950` は未反映**」を候補として明示的に出す。

### 中（M28 着手と並行可）

#### 中-1 完了報告 §4b.2 と progress-log の「影響の大きさ」が、別の経路を根拠にしている

根拠:

- 完了報告 §4b.2 — 「フロントの `api.ts:163` は `body?.error?.message ?? "HTTP ${status}"` の **nullish 合体なので空文字をフォールバックしない**。⇒ **中身が空のエラー表示になり**…」
- `progress-log.md:5309` にも同じ記述

**実物**: `GET /api/moves` を引くのは `web/src/features/moves/api.ts:28` の `fetchJSON`（`useMovesByCharacter`）であり、その実体は `web/src/lib/api-client.ts:12-14`——

```ts
const body = await res.text();
throw new Error(`HTTP ${res.status}: ${body}`);
```

**`error.message` を取り出す処理が存在しない。** 引用された `body?.error?.message ?? …` は `web/src/features/combo/api.ts:163`（コンボ保存経路）であり、**moves はこの行を通らない。**

⇒ 着手前に実際に起きていたのは「中身が空の表示」ではなく「`HTTP 500: {"error":{"code":"internal_error","message":""}}` という生テキストの露出」である。**修正の妥当性は変わらない**（`message` は非空になった。ただし `fetchJSON` が JSON を読まない以上、**この修正だけでは画面の表示は改善しない**）。チェックリスト 4b が「低優先と書かず影響を書け」と求めた項目なので、根拠の取り違えは記録として残すべき。

**推奨**: 完了報告 §4b.2 と progress-log の当該記述を実経路（`web/src/lib/api-client.ts`）へ訂正し、**「`message` を非空にしただけでは `fetchJSON` 経路の表示は変わらない」という残る事実**を残課題候補へ足す。

#### 中-2 `fieldLabel` の「添字を出さない」根拠が `setups` には当てはまらない

根拠: `web/src/features/combo/components/ComboEditor.tsx:1442-1444`

> ★添字の直後で切るのは steps と同じ理由——何件目かは出さない。

`steps` の理由は「**BE は 1 始まり、FE zod は 0 始まりで基点が違う**」である（同 `:1437-1439`）。ところが `setups` は——

- **FE zod は `setups` を検証しない**（完了報告 §4.1 の実測）。⇒ 基点が 2 つ存在しない。
- BE の添字は `internal/service/combo/service.go:381-395` の `for i, setupInput := range input.Setups` の `i` であり、**フロントの `setupsToCreate` の添字とそのまま一致する**（0 始まり同士）。

⇒ **`setups` については何件目かを正確に出せる。** 出さない選択自体は許容できる（同ループは最初のエラー setup で `return` するため、同時に複数は出ない）が、**書かれた理由は成立していない。**

**なぜ「中」か**: 高-1 と同型（実装と食い違う注記）だが、こちらは**実害が「情報を出せるのに出していない」に留まり、誤りを誘発しない**ため 1 段下げた。ただし後任が `setups` を FE zod で検証し始めた瞬間、この注記は「読んだのに理由が違う」状態になる。

**推奨**: 注記を「**★同時に 2 件以上出ないため添字を出す必要が無い**（BE は最初のエラー setup で打ち切る＝`service.go:403`）」へ書き換える。理由を正しい根拠へ差し替えるだけで、実装は触らなくてよい。

#### 中-3 `RECIPE_TAB_FIELD_PREFIXES` は許可リストであり、既定が `basic` に落ちる構造が残っている

根拠: `web/src/features/combo/editorTabs.ts:69-77`

```ts
if (RECIPE_TAB_FIELDS.has(field)) return "recipe";
if (RECIPE_TAB_FIELD_PREFIXES.some((prefix) => field.startsWith(prefix))) return "recipe";
return "basic";
```

**`DES-006` §2.7 が名指しした型そのものである**——「許可リストか対象外リストかを読むこと」。本関数は**許可リストであり、集合に入っていない新しい前縁は黙って `basic` へ落ちる**。今回の `setups[*]` の misroute はまさにこれで起きた。**同じ形が残っている以上、次に BE が新しい入れ子 field（例 `links[0].url`）を組み立てた瞬間、また同じ報告が来る。**

**推奨**（実装変更ではなく検査で塞ぐ案）: `editorTabs.test.ts` に「**`[` または `.` を含む field（＝入れ子の書式）で、既知の前縁のどれにも当たらないものが来たら落ちる**」テストを 1 本足す。実装を触らずに「新しい入れ子 field を足したら気づく床」を作れる。★本サブの射程外なので、**残課題候補として起票するのが妥当**。

#### 中-4 「新規登録」行が `creating` 中に候補列から抜けず、フォーカスも受け取れない

根拠: `web/src/features/tag/components/TagSelector.tsx:153-160`

```tsx
role="option"
aria-selected={false}
disabled={creating}
```

`disabled` な `<button>` は**フォーカスを受け取れない**。`useListboxKeyNav.moveFocus` は `querySelectorAll('[role="option"]')` で拾った要素に無条件で `.focus()` を呼ぶ（`useListboxKeyNav.ts:33`）ため、**その要素が「候補列に居るのに、そこへ進むと何も起きない」状態になる。** 検索が 0 件に絞られていてこの行が唯一の候補である場合、**タグ作成中は ↓ が完全に無反応になる。**

また `aria-disabled` を出していないため、**支援技術には「選べる option」として読まれる。**

**推奨**: `disabled` のときは `role` を外す（`role={creating ? undefined : "option"}`）か、`aria-disabled={creating}` を併記したうえで `useListboxKeyNav` 側で `[role="option"]:not([disabled])` を拾う。**後者は共通フックの契約に触るため、前者（利用側で閉じる）が本サブの方針（フックは行の意味を知らない）と整合する。**

#### 中-5 キーボードでタグを新規作成した直後、フォーカスが body へ落ちる

根拠: `web/src/features/tag/components/TagSelector.tsx:72-80`

```ts
async function handleCreate() {
  const newTagId = await onCreateTag(name);
  if (newTagId != null) { onChange([...selectedTagIds, newTagId]); setSearch(""); }
}
```

`setSearch("")` で `showCreateOption` が `false` になり、**フォーカスが載っていた「新規登録」ボタンが unmount される。** React はフォーカスを親へ戻さないので `document.body` へ落ちる。⇒ **以後 ↓ を押しても `ul` にも `Input` にも keydown が届かず、`Tab` で戻すまでキーボードでは何もできない。**

**なぜ「中」か**: 本サブの主題は「**タグ欄にキーボードで到達できるようにする**」であり、**その主題の中でいちばん新しく作った導線（新規登録行）が、押した直後にキーボードから外れる。** 既存の E2E（spec `:38-68`）は既存タグの選択しか通っておらず、ユニット（`TagSelector.test.tsx:240-252`）は `onCreateTag` の呼び出しまでしか見ていないため、**どちらも検出していない。**

**推奨**: `handleCreate` の成功後に検索欄（または先頭候補）へフォーカスを戻す。合わせてユニットに「作成後もキーボードで続けられる」1 件を足す。

#### 中-6 `DES-002` の CHANGE たたき台に `move.Update` の第 3 形が入っていない

根拠: 完了報告 §5 の `DES-002` 行は例外として `PUT /api/config` だけを挙げている。しかし `internal/api/move/handler.go:110-111` は同じ `validation_failed` コードで **`message` が動的（`ve.Message`）・`details` が `{"field": …}`（`{"validations"}` ではない）** という第 3 の形を返す。

**⇒ たたき台がそのまま `DES-002` へ入ると、「`validation_failed` は `message` 固定・`details.validations` を持つ」という誤った契約が設計書に載る。**

**推奨**: たたき台 (1) に「**例外は 2 つ**——`PUT /api/config`（422・英語）と `PATCH /api/moves/:id`（`details.field` 形・`message` は個別）」と書き足す。

#### 中-7 チェックリスト §6-2 の破壊確認が別のものへ差し替わっており、その事実が書かれていない

根拠: チェックリスト §6 は 4 件を指定している（6-1 `PATCH` message ／ **6-2 info-mark を選択肢群より前へ移す** ／ 6-3 タグ欄の矢印キー ／ 6-4 外側クリック）。完了報告 §7-3 が挙げる 4 件は「`PATCH` message ／ `setups[` 前方一致 ／ タグ欄の矢印キー ／ `onInteractOutside`」であり、**6-2 が `setups[` 前方一致に置き換わっている。**

`ComboEditorBasicFields.tsx` は差分 0 なので、**6-2 を実施しない判断自体は合理的**（触っていない領域であり、既存テスト `ComboEditorBasicFields.test.tsx:412-445` が網を張っている）。**問題は「触れなかった」と「やらないと決めた」の区別が付いていないこと**（`D-675`）。

**推奨**: 完了報告 §7-3 へ「**6-2 は実施していない。理由＝当該 DOM に差分が無く、既存テストが同じ条件を固定しているため。代わりに `setups[` 前方一致の破壊を当てた**」を 1 行足す。

### 低（将来対応）

- **低-1 `useListboxKeyNav` 抽出時に判定が 1 段広がっている。** 旧: `active instanceof HTMLButtonElement && role === "option"`（`SearchableSelect` 旧 `:126`）／ 新: `active instanceof HTMLElement && …`（`useListboxKeyNav.ts:49`）。現状すべての候補が `<button>` なので挙動差は出ないが、`SearchableSelect.tsx:105` のコメントは「**挙動は 1 つも変えていない**」と断言している。**厳密には「現時点の DOM では差が出ない」である。** 1 語だけ弱める価値がある。
- **低-2 `aria-multiselectable` の非対称。** `TagSelector.tsx:114` には在るが、同じく複数選択である `SearchableSelect` の `mode="multi"`（`SearchableSelect.tsx:200-204`）には無い。本サブが「同一画面内の非対称を作らない」を掲げた以上、逆向きの非対称が 1 つ増えたことになる。
- **低-3 `<ul role="listbox">` の直下に `<li>`（generic）が挟まる形。** ARIA では `listbox` の owned element は `option` であることが期待される。`SearchableSelect.tsx:210-211` に既存の説明コメントがあり `TagSelector` はそれを踏襲しただけなので、**本サブの後退ではない**。直すなら両方同時。
- **低-4 完了報告のファイルパス表記が相対で曖昧。** §4b.2 の「`api.ts:163`」は `web/src/features/combo/api.ts:163`。同名ファイルが `web/src/features/` 配下に 5 本ある（`moves/api.ts` / `combo/api.ts` / `preset/api.ts` / `combo-io/api.ts` / `tag/api.ts`）。中-1 の取り違えは、この曖昧さから生まれた可能性が高い。
- **低-5 `TagSelector` の絞り込みが `text-filter.ts` を通らない。** 完了報告 §6-5 が既知の意図的残置として挙げているとおりで、**触らなかった判断は支持する**。ただしキーボード操作を揃えた結果、「キャラ欄は NFKC 正規化して絞り込むのにタグ欄はしない」という**別の非対称が相対的に目立つ**ようになった。残課題として残すのが妥当。

---

## 良かった点

1. **「追跡行に書いてある件数」を射程の定義として扱わなかった。** `combo-put-error-message-empty` は `PUT` 1 件として起票されていたが、全数調査で `PATCH` を発見し、`D-690` で射程へ入れた。**この 1 件を落としていたら、次に同じ報告が来ていた。** 完了報告 §7-1 が一般形として言語化しているのも良い。

2. **「再現しない」を成果として扱い、しかも機構まで特定した。** `SD-016` を 6 ジェスチャで検証したうえ、閉じない理由を Radix `DismissableLayer` の `pointerdown` ＋ 内側起点ガードまで下ろした。**さらに「ライブラリ実装依存だから E2E で固定してから閉じる」まで行った**のが重要——`onInteractOutside` を将来誰かが足した瞬間に落ちる網が残った。

3. **既存の失敗の帰属を推測ではなく実測で確定させた。** `m24-12` spec (3) と `check-import-order.sh` の +1 について、**変更した全ファイルを `git show 0853c74:<path>` で基点へ戻し、新規ファイルを退避して回した。** 本レビューでも import-order の offender 一覧を独立に照合し、**本サブの新規・改変ファイルが 1 件も新規登場していない**ことを確認できた。「flake だろう」で流さない手順が残ったのは資産である。

4. **共通化の判断を「波及の数を出してから」行った。** 直接 import 2 → 間接込みで 15 コントロール / 13 ファイル。**この数を先に出したから「`TagSelector` を丸ごと統合しない・約 30 行のフックだけ共有する」という中間解を選べた。** `onCreateTag` / `excludeCategories` / チップ列を 15 コントロールが載る部品へ持ち込まなかったのは正しい判断。

5. **`useListboxKeyNav` が `Enter` を扱わない設計。** 「選んで閉じるか／開いたままか」を利用側の `onClick` に残したことで、**チェックリスト 2-7 が重大として警戒していた「`SD-015` と `tag-field` で `Enter` の扱いが矛盾する」が構造的に起きえなくなっている。** コメント（`useListboxKeyNav.ts:24-27`）がその理由まで書いているのが良い。

6. **`message` の欠落が誰にも気づかれなかった理由を特定し、そこを直した。** 「検証エラーのテストが `Error.Code` しか見ておらず、`Error.Message` を検査するテストがリポジトリ全体で 1 件も無かった」。**1 経路ずつ足すのではなく 3 動詞を同じ表で回して値の一致まで見る形にした**のは、同種の再発を止める作り方である。

7. **`docs/design/` と `followup-backlog` 本表に手を出さず、CHANGE たたき台と残課題候補として出した。** 境界（`D-382` / 指示書 §3-6）を正確に守っている。`check-doc-inventory.sh` も型に無いファイルなしで緑。

---

## 制約事項

- 本レビューはコード上で判定可能な範囲のみ対象。実際の動作確認・パフォーマンス・実機テストは別途実施が必要。
- **本レビューで実行した検査**: `go build ./...` ／ `go test ./internal/api/... ./internal/model/...`（全緑）／ `pnpm vitest run`（`TagSelector` / `SearchableSelect` / `CharacterSelector` / `editorTabs` の 75 件緑）／ `make e2e-only P=m27-02a-reachability`（3 件緑）／ `check-progress-log-index.sh` `check-import-order.sh` `check-md-emphasis.sh` `check-doc-inventory.sh` `check-stop-discipline.sh` `check-doc-refs.sh`。
- **本レビューで再現していないもの**: (a) `m24-12-editor-rebuild.spec.ts` (3) の既存失敗の帰属（完了報告 §6-2 の手順は妥当だが、時間の都合で追試していない）。(b) 完了報告 §1.1 / §1.2 の Playwright 実測（`SD-015` の 20 停止点・`SD-016` の 6 ジェスチャ）。(c) `curl` による実サーバ応答の実測（§4.2 の表）。**いずれも報告の記述が実物のコードと矛盾しないことは静的に確認した。**
- **不明: `check-artifact-integrity.sh` は実行していない。** 同スクリプトはファイル書き込みを行う可能性があり、read-only 厳守のため回避した。完了報告 §10 は「違反なし」と記録している。
- **不明: 中-5（作成直後のフォーカス喪失）は実機ブラウザでの追試をしていない。** React の unmount 時フォーカス挙動からの推論であり、jsdom / Chromium で実際にどこへ落ちるかは確かめていない。

---

## 取り込み結果（自動トリアージ・2026-09-02）

**重大 0 件 / 高 3 件 / 中 7 件 / 低 5 件。★「高」の不採用は 0 件。** 再レビュー往復 0 回。

| # | 指摘 | 採否 | 理由・対応 |
|---|---|---|---|
| **高-1** | `api_error.go` の godoc 3 か所が実装と食い違う | **採用** | **本サブ自身が作った矛盾である**（422 と `details.field` 形のリテラルを同じ定数へ差し替えた）。godoc へ「本コードを返す形は 3 系統ある」を表で明記し、`(2)` `PUT /api/config`（422・英語）と `(3)` `PATCH /api/moves/:id`（`details.field` 形）が**別系統であって統一漏れではない**ことを書いた。`NewValidationFailedError` の「唯一の組み立て先」も「**`{"validations"}` 形の 400 応答の**唯一の組み立て先」へ絞った |
| **高-2** | `progress-log.md` の「次の払い出しは引き続き `000082`」が失効 | **採用** | **★実物を照合して確認した**——ボード `parallel-board.md:108` の正本は **`000092`**（`D-689`。`M14-03f` が `000082`〜`000091` を消費済み）。**指摘のとおり危険であり、読んだ次のサブが自採番すると衝突する。** 数字を書くとまた失効するため、**「ボード §2.2 を見ること」へ改め、作業ツリーの `ls migrations/` から次番を導かない理由を併記**した |
| **高-3** | `followup-backlog.md:950` が `PUT` のみのまま | **採用（製造には直せないため候補として出す）** | **★実ファイルを開いて未反映であることを確認した**（初版は「済ませたとの記載あり」と伝聞で書いており照合していなかった。**指摘のとおり**）。`D-382` により製造は §J 以外を編集できないため、**完了報告 §6 へ「設計卓の手番として明示的に出すもの」の節を新設**し、指示書 §2.1.3.2 の「済ませた」と実物が食い違う事実を書いた |
| **中-1** | §4b.2 の影響記述が別の経路を根拠にしている | **採用** | **★自分で経路を確かめて指摘が正しいことを確認した**——`moves/api.ts:28` は `lib/api-client.ts` の `fetchJSON` を使い、同関数は `error.message` を読まず生ボディを投げる。引用していた `body?.error?.message ?? …` は `features/combo/api.ts:163` であり `moves` は通らない。完了報告と progress-log の両方を訂正し、**「`message` を非空にしただけでは `fetchJSON` 経路の見せ方は変わらない」を残課題 §6-6 へ追加** |
| **中-2** | `fieldLabel` の「添字を出さない」根拠が `setups` に当てはまらない | **採用** | `steps` の理由（BE 1 始まり / FE zod 0 始まり）は `setups` には成立しない（**FE zod は `setups` を検証しないので基点が 2 つ無い**）。注記を正しい根拠——**「同時に 2 件以上出ないため要らない（BE は最初のエラー setup で打ち切る）」**——へ書き換えた。実装は触っていない |
| **中-3** | `tabOfIssueField` は許可リストで、既定が `basic` に落ちる構造が残る | **採用（残課題として起票）** | 指摘のとおり `DES-006` §2.7 の型そのもの。**★ただし提案された「入れ子 field が未知なら落ちるテスト」はそのままでは書けない**——`okiOptions[0].x` のように**基本情報タブが正しい入れ子も在り得る**ため、床を作るには基本情報側の既知の入れ子も列挙する必要があり 6 件の射程を超える。**⇒ レビュアー自身の推奨どおり残課題候補（完了報告 §6-7）として起票した** |
| **中-4** | `creating` 中の「新規登録」行が候補列から抜けず、フォーカスも受け取れない | **採用** | `disabled` な `<button>` はフォーカスを受け取れないのに `role="option"` のままだった。**この行が唯一の候補のとき ↓ が完全に無反応になる。** `role={creating ? undefined : "option"}` へ改めた（**共通フックの契約に触れず利用側で閉じる**——レビュアーの推奨どおり）。回帰テスト 1 件を追加し、破壊確認で落ちることを確認 |
| **中-5** | キーボードで新規作成した直後、フォーカスが body へ落ちる | **採用** | **本サブの主題（タグ欄にキーボードで到達できること）の中で、いちばん新しく作った導線が押した直後にキーボードから外れていた。** `handleCreate` の成功後に検索欄へフォーカスを戻すようにし、**「作成後もキーボードで続けられる」テストを追加**。既存の E2E もユニットもこれを検出していなかったという指摘は正しい。破壊確認で落ちることを確認 |
| **中-6** | `DES-002` たたき台に `move.Update` の第 3 形が入っていない | **採用** | たたき台のまま設計書へ入ると「`validation_failed` は `message` 固定・`details.validations` を持つ」という**誤った契約**が載る。**(1-a)/(1-b)/(1-c) の 3 系統**を書き分ける形へ改めた |
| **中-7** | 破壊確認 §6-2 が差し替わっており、その事実が書かれていない | **採用** | `D-675`（「触れなかった」と「やらないと決めた」を区別する）。完了報告 §7-3 へ「**6-2 は実施していない。理由＝当該 DOM に差分が 0 で、既存テストが同じ条件を固定しているため。代わりに `setups[` 前方一致の破壊を当てた**」を明記した |
| **低-1** | 抽出時に判定が `HTMLButtonElement` → `HTMLElement` へ 1 段広がっている | **採用** | 「挙動は 1 つも変えていない」は厳密には誤り。**本プロジェクトは「撤回済み・失効した記述」を「高」に置く方針**であり、断定を弱めるのは安い。「現時点の DOM では挙動差は出ない」＋「候補が `<button>` 以外になった日に差が出る」へ改めた |
| **低-2** | `aria-multiselectable` の非対称 | **採用** | 本サブが「同一画面内の非対称を作らない」を掲げた以上、逆向きの非対称を 1 つ増やしたのは筋が通らない。`SearchableSelect` の `mode="multi"` にも付けた（**純粋な ARIA 注記であり振る舞いは変わらない**） |
| **低-3** | `<ul role="listbox">` の直下に `<li>` が挟まる | **不採用（理由付き）** | **本サブの後退ではない**——`SearchableSelect` の既存の形を `TagSelector` が踏襲しただけであり、レビュアー自身も「直すなら両方同時」としている。**両方を直すのは本サブの 6 件と無関係な共通部品改修**であり指示書 §3-5 に触れる。**⇒ 完了報告 §6-9 へ残課題候補として記録**（`D-675`＝やらないと決めたことを書く） |
| **低-4** | 完了報告のファイルパス表記が相対で曖昧 | **採用** | **中-1 の取り違えはこの曖昧さから生まれた**というレビュアーの読みは正しい。`api.ts` は `web/src/features/` 配下に 5 本ある。**本報告のパスはリポジトリルートからの相対で書く**旨を §4b.2 へ明記し、当該箇所を修正した |
| **低-5** | `TagSelector` の絞り込みが `text-filter.ts` を通らない | **採用（残課題として記録）** | 触らなかった判断は支持されている。**ただしキーボード操作を揃えた結果「キャラ欄は正規化するのにタグ欄はしない」という非対称が相対的に目立つようになった**という指摘を、完了報告 §6-8 の記述へ足した |

### 再検証（取り込み後）

| 検査 | 結果 |
|---|---|
| `go build ./...` / `go test ./...` | **55 パッケージ green** |
| `cd web && pnpm lint`（`tsc --noEmit`） | green |
| `cd web && pnpm test` | **2358 件 green**（TagSelector に 2 件追加） |
| `make e2e-only P=m27-02a-reachability` | **3 件 green** |
| 破壊確認（中-4 / 中-5） | それぞれ 1 件だけが落ちることを確認 |
| 常設検査 | `check-artifact-integrity` / `check-progress-log-index` / `check-doc-refs` / `check-doc-inventory` / `check-md-emphasis` / `check-browser-storage-keys` すべて違反なし |

*以上、Phase C 自動トリアージ。*
