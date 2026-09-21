# M23-02 完了報告: セットプレイの復元と完全削除（＋ 案 P1 の撤回と、その後始末）

| 項目 | 内容 |
|------|------|
| 作業 ID | M23-02 |
| 指示書 | `docs/instructions/M23-02-setup-restore-and-permanent-delete.md` **v1.3.0** |
| チェックリスト | `docs/instructions/reviews/M23-02-review-checklist.md` **v1.3.0** |
| 実施日 | 2026-08-20 |
| ブランチ | `claude/m23-02-implementation-plan-n26vrh` |
| 消費 CHANGE | **`CHANGE-122`**（起票済み。反映は設計卓） |
| 消費マイグレ | **0 本**（`000078` が末尾のまま。スキーマ変更なし） |
| 裁定 | **D-483** / **D-484** / **D-485** / **D-486** / **D-490** / **D-491** |
| 並列相手 | **`M24-09a` のみ**（`M23-01` は並列相手ではなく前提。完了済みで、本サブはその上に積んだ） |

> **★指示書 v1.3.0 はリポジトリに入っていない状態で作業した。** 反映 commit `f9d3f7b` は本作業ツリーから到達できず（`git cat-file -t` → `Not a valid object name`）、`docs/instructions/` 配下は **v1.2.0 のまま**である。`git fetch` / `git merge` は `CLAUDE.md` §10 で deny 機械強制のため製造は実行できない。**開発者判断（2026-08-20）＝コード変更を伴わないため、添付された v1.3.0 の全文で進めてよい。** レビュー担当サブエージェントにも v1.3.0 の実体を正本として読ませた。**⇒ 取り込みは開発者の手番として残っている。**

---

## 1. §3.3 着手前の実査（9 件）の結果

### 1-1. ★★`combo_setups` を読む SQL の全数と、`setups` へ結合していないもの

**読み取り 10 サイト。`setups` へ結合し `deleted_at IS NULL` を持つのは 5、持たないのは 5。**

| # | 場所 | 関数 | 結合 | 処遇 |
|---|---|---|---|---|
| 1 | `internal/repository/combo/repository.go:581-584` | `setupResultWhere`（`hasSetup`） | ○ | 安全 |
| 2 | `internal/repository/combo/repository.go:1229-1237` | **`CountComboSetupsByComboID`** | ✕ | **★本サブで是正**（§4.1-6 (a)） |
| 3 | `internal/repository/setup/repository.go:271-280` | **`comboSetupExists`** | ✕ | **★本サブで是正**（§4.1-6 (b)） |
| 4 | `internal/repository/setup/repository.go:342-346` | `FindComboIDsBySetupID` | ✕ | **報告のみ**（`M23-03`） |
| 5 | `internal/repository/setup/repository.go:553-559` | `FindComboIDsBySetupIDs` | ✕ | **報告のみ**（`M23-03`） |
| 6 | `internal/repository/setup/repository.go:586-593` | `ListSetupsByComboID` | ○ | 安全 |
| 7 | `internal/repository/setup/repository.go:628-636` | `ListSetupsByComboIDs` | ○ | 安全 |
| 8 | `internal/repository/setup/repository.go:662-670` | `FindDuplicateInCombo` | ○ | 安全 |
| 9 | `internal/repository/setup/repository.go:734-748` | `FindCandidateSetups`（本体） | ○（＋ `c.deleted_at IS NULL`） | 安全 |
| 10 | `internal/repository/setup/repository.go:744-746` | `FindCandidateSetups` の除外副問い合わせ | ✕ | **報告のみ**（除外方向のため安全側） |

**★「報告のみ」と「本サブで是正」の区別は §9.1-2（D-491）の基準に拠る**——**本サブの変更が無くても同じ挙動なら「他所の穴」＝報告のみ。本サブの変更によって初めて挙動が変わるなら「自分が壊した」＝直す。**

- **#4 / #5**（`parentComboIds`）は、**本サブが無くても削除済みコンボの id が混ざる**。`M23-overview` §4.9 の穴 6 と同一であり `M23-03` の担当。
- **#10** は**除外方向**の副問い合わせであり、結合が無いと「ゴミ箱のセットプレイも候補から除外される」側に倒れる。**利用者に害が出る向きではない。**

### 1-2. `DeleteComboSetupsBySetupID` が `combo_setup_results` を明示削除しているか → **していた**

`internal/repository/setup/repository.go:246-259`。**`DELETE FROM combo_setup_results WHERE setup_id = ?`（combo_id で絞っていない）を先に実行してから `combo_setups` を消す。**

**⇒ §4.1-3 の分岐は「同様に外す」側で確定した。** 撤回により検証結果も保たれる。

> **★これは報告 §C-3 が「本軸の範囲外のため未実査」と明記していた唯一の穴である。** 実査の結果、**明示削除していた**ため、案 P1 の撤回は紐付けと検証結果の両方を保つ形になった。仮に CASCADE 頼みだった場合、撤回しても `combo_setups` が残る一方 `combo_setup_results` は消えるという片肺状態になっていた。

### 1-3. コンボ側の完全削除の明示削除と順序

`comborepo.HardDelete`（`internal/repository/combo/repository.go:973-991`）＝ **`combo_setup_results` → `combo_setups` → `combos`** の 3 文。
前チェックは **Tx 外**（`FindByIDAllowDeleted` → `DeletedAt == nil` なら `ErrComboNotInTrash`）。成功 204 ／ 拒否 409 `combo_not_in_trash` ／ 不在 404。

### 1-4. 状態理由の拒否の既存の流儀 → **409 ＋ `{error:{code,message,details?}}`。指示書と食い違わない**

- 正準ビルダは `model.NewAPIError` / `NewAPIErrorWithDetails`（`internal/model/api_error.go`）の 2 本のみ。
- 状態拒否の先例＝`combo_not_in_trash`（`internal/api/combo/permanent_delete_handler.go:27`）。
- **`details` 付き拒否の先例＝`tag_in_use`**（`internal/api/tag/handler.go:157-165`。サービス側は `ErrTagInUse` センチネル ＋ `TagInUseError` 型 ＋ `errors.As`）。

**⇒ §4.4-3 の 409 指定は既存の流儀に一致する。実装を合わせた（報告して止める必要はなかった）。**

### 1-5. `combo_setups` の行が消える経路の全数 → **5 文 / 4 関数。撤回が触るのは 1 本だけ**

| 関数 | 到達元 | 撤回の影響 |
|---|---|---|
| `comborepo.HardDelete` | `DELETE /api/combos/:id/permanent` | 無し |
| `comborepo.DeleteComboSetupsByComboID` | `PATCH` / `PUT` の `unlink_all` | 無し |
| `comborepo.DeleteComboSetupsByComboIDExcluding` | `PATCH` / `PUT` の `individual` | 無し |
| `setuprepo.DeleteComboSetup` | `DELETE /api/combos/:comboId/setup-links/:setupId` | 無し |
| **`setuprepo.DeleteComboSetupsBySetupID`** | **`DELETE /api/setups/:id`** | **★これ 1 本だけ** |

**⇒ 指示書の見立て（影響は `DeleteSetup` の 1 本だけ）は正しかった。**

> **★副次的に、`DeleteComboSetupsBySetupID` は本サブで本番の呼び元を失った。** 削除せず、**新設した `setuprepo.HardDelete` の 1・2 段目として再利用**した（同関数が既に `combo_setup_results` → `combo_setups` の順序を持つため）。

### 1-6. `setups.deleted_at NOT NULL` を既存フロントが踏む経路

`setups` 読み取り 14 本のうち述語を持たないのは **`GetRecipeCache`（`internal/repository/setup/repository.go:435-438`）の 1 本のみ**。**本サブでは塞いでいない**（§1.5-1・`M23-03` の担当）。

**交差の有無**: **無い。** 本サブは復元時に `RecomputeSetupCache` で `recipe_cache` を作り直すため、**`recipe_cache` が NULL のまま参照される状態を新たに作っていない**。

### 1-7. ゴミ箱一覧がセットプレイを返しているか → **返していなかった（コンボのみ）**

- ゴミ箱は専用 API を持たず、**既存 `GET /api/combos?character_id=N&only_deleted=true` の絞り込み**である。
- `GET /api/setups` は `WHERE deleted_at IS NULL` 固定で、削除済みを返すフラグを持たなかった。

**⇒ §3.3-7 の授権（「返していない場合、本サブは『返す』ところまでを作る」）が発動した。** §4.2-8（**D-491**）で経路を足した。

### 1-8. 応答 DTO を変える必要があったか → **`deletedAt` の 1 フィールドを足した**

`internal/api/setup/dto.go` の `SetupResponse` に `DeletedAt` が無かった（`model.Setup` は持っている）。

**★これは §3.3-8「変えずに済むなら変えない」の例外である**（**D-491**）——**`DES-005` §5.15 がゴミ箱一覧の表示項目として「削除日時」を明記しており、仕様が要求している。** 形は `ComboResponse.DeletedAt` に揃えた（`*time.Time` / `json:"deletedAt,omitempty"`）。

フロントは `web/src/features/setup/types.ts` の `Setup` に 1 行足しただけで `SetupResponse` / `SetupSummary` へ伝播する。**`web/CLAUDE.md` §2 のコンボ型 3 分岐には影響しない**（コンボ側の型を触っていない）。

### 1-9. ★★起点に `M23-01` が入っているか → **入っていた**

| 確認方法 | 結果 |
|---|---|
| `combos` に `superseded_by_combo_id` 列があること | ✅ `migrations/000078_add_combos_superseded_by.up.sql` が存在 |
| ゴミ箱の一覧が 7 列であること | ✅ `web/src/features/combo/components/TrashList.tsx:45-58` が 7 列 |
| （追加確認）Git 履歴 | ✅ `234d8b5 Merge pull request #84 ... claude/m23-01-implementation-plan-6yasg6` |

**★あわせて「巻き戻してはいけない不動点」を特定した**（これが §4.5-5 の形を決めた）:

- `web/e2e/m23-01-trash-superseded.spec.ts:154` が `td` を**ちょうど 7 個**と検査
- `web/src/features/combo/components/TrashList.test.tsx` が同じく 7 個 ＋ 「残日数」「あと N 日」「期限切れ」「90 日」の**不在**を検査
- `TrashListRow.tsx:105` の行内エラー行が `colSpan={7}`

**⇒ コンボの表に列も行も足せない。** セットプレイは独立したテーブルとして置いた（§4.5-5）。

---

## 2. ★案 P1 の撤回と、その安全根拠（§1.2 / §4.1-5）

### 2-1. 撤回したこと

`internal/service/setup/service.go` の `DeleteSetup` から **`DeleteComboSetupsBySetupID` の呼び出しを外した**。残るのは `SoftDelete`（`deleted_at` の設定）と `DeleteSetupCache`（`recipe_cache` の物理削除）の 2 つである。

**コメントは消さず、撤回の経緯を残す形へ書き換えた**（§4.1-4。消すと、なぜこの形なのかが再び分からなくなる）。

### 2-2. ★撤回して安全である根拠

1. **`setups` を参照する SQL 14 本のうち 13 本が `deleted_at IS NULL` を持つ**（`M23-RESEARCH-01` §E-2 の実測）。
2. **逆方向（コンボ → セットプレイ）も塞がれている**——`ListSetupsByComboID` / `ListSetupsByComboIDs` はいずれも `s.deleted_at IS NULL` を持つ。
3. **⇒ 紐付けを残しても、生きたコンボの詳細・一覧・候補にゴミ箱のセットプレイは出ない。**

**★この根拠は実 DB テストで裏を取った**——`internal/repository/setup/restore_test.go` の `TestRestore_SoftDeletedSetupIsHiddenFromLiveCombos` が「紐付けは 2 本残っているのに、A・B のどちらの詳細にも出ない」ことを確認している。**「残っている」と「出ない」を同じテストで並べてあるのは、片方だけでは撤回の安全性を主張できないためである。**

### 2-3. ★★撤回は前任の誤りではない

案 P1 は `M4-01`（フェーズ1）で開発者と Plan Mode で確認して採られた**意図的な判断**であり、当時の根拠は「復元の経路が無いので紐付けを保つ意味が無い」だった。**当時の前提の上では正しい。** 本 MS が復元を足したことで前提が変わったため撤回する（**D-483**）。

---

## 3. ★★§4.1-6 ＝ 壊した不変条件の後始末（**D-491**）

**案 P1 の撤回は「`combo_setups` の行は必ず生きたセットプレイを指す」という不変条件を消す。** その不変条件に寄りかかって `setups` へ結合せずに書かれていた判定は、**こちらが何もしなくても意味が変わる。**

### 3-1. (a) `CountComboSetupsByComboID`（`internal/repository/combo/repository.go:1229-1237`）

```sql
-- 変更前
SELECT COUNT(*) FROM combo_setups WHERE combo_id = ?
-- 変更後
SELECT COUNT(*) FROM combo_setups cs
  JOIN setups s ON s.id = cs.setup_id AND s.deleted_at IS NULL
 WHERE cs.combo_id = ?
```

**直さない場合に出る劣化（実査で確定した連鎖の全段）**:

1. 画面の引き継ぎモーダルの発火条件は、コンボ詳細が返す `setups[]` の**長さ**である（`web/src/features/combo/components/ComboEditor.tsx:295`）。
2. その `setups[]` は `ListSetupsByComboID`（`s.deleted_at IS NULL` を持つ）由来のため、**紐付いたセットプレイが全部ゴミ箱に居ると 0 件**になる。
3. **⇒ モーダルが出ない。** よって `setupCarryOptions` が `undefined` のまま送られる。
4. サーバ側の `count > 0` が成立し `ErrMissingSetupCarryOptions` → **400 `missing_setup_carry_options`**（`internal/api/combo/handler.go:338` / `:385`）。
5. **⇒ 利用者は `knockdown_advantage` を変更できず、ダイアログも出ないので選びようがない。撤回前は通っていた操作である。**

### 3-2. (b) `comboSetupExists`（`internal/repository/setup/repository.go:271-280`）

```sql
-- 変更前
SELECT COUNT(*) FROM combo_setups WHERE combo_id = ? AND setup_id = ?
-- 変更後
SELECT COUNT(*) FROM combo_setups cs
  JOIN setups s ON s.id = cs.setup_id AND s.deleted_at IS NULL
 WHERE cs.combo_id = ? AND cs.setup_id = ?
```

**★共有ヘルパを直した。呼び元は 2 つあり、どちらも同じ不変条件に依存している。**

| 呼び元 | 経路 | 是正しない場合 |
|---|---|---|
| `ComboSetupExistsTx` → `requireComboSetupLinkTx`（`internal/service/setup/setup_results.go:143`） | `PUT` / `DELETE .../results` | **ゴミ箱のセットプレイへ検証結果を書けてしまう**（設計卓が挙げた (b)） |
| `ComboSetupExists` → `CreateSetupLink`（`internal/service/setup/service.go:275`） | `POST /api/combos/:comboId/setup-links` | **★設計卓が挙げていない 3 つ目の症状**（下記） |

### 3-3. ★★設計卓へ戻す 1 点——「2 か所限定」の数え方は **3 症状 / 2 ヘルパ**である

**`CreateSetupLink` の冪等判定も同じ不変条件に依存していた。**

- 現行の形＝`ComboSetupExists` が true なら「既に紐付いている」として `nil`（冪等成功）を返し、**その先の `SetupExistsActive`（生きているかの確認）へ到達しない**。
- 撤回後、結合が無いままだと**ゴミ箱のセットプレイでも `combo_setups` の行が残っているため `exists=true`** になり、**黙って成功を返す**（本来は `ErrNotFound`）。
- 撤回前は行ごと消えていたので `exists=false` → `SetupExistsActive` → `ErrNotFound` に落ちていた。

**⇒ 共有ヘルパ `comboSetupExists` を直したことで、この 3 つ目も同時に閉じた。**

**★これはスコープ拡大ではないと判断した**——同一ヘルパ・同一不変条件であり、§9.1-2 の区別（本サブの変更によって初めて挙動が変わる）に合致する。**むしろ `ComboSetupExistsTx` だけを直すと、同じヘルパの片方だけが直った状態になる。**

**★ただし裁定の文面（「対象は 2 か所に限定します」）との数え方の差として報告する。** 設計卓が「2 か所」と数えたのは**症状**であり、実装上は**ヘルパ 2 本 / 症状 3 つ**である。

### 3-4. ★これ以外へは広げていない

§3.3-1 の **#4 / #5 / #10** は不変条件の変化に影響されないため**報告のみ**とした（`M23-03` の担当）。**「壊した分は直す」を「見つけた分は直す」へ広げていない。**

### 3-5. 必須テスト 2 本（チェックリスト §4）

| 要求 | テスト | 是正を戻すと |
|---|---|---|
| (a) 紐付いたセットプレイを全部ゴミ箱へ入れたコンボの `knockdown_advantage` を変更できること | `TestUpdateMetadata_AllowsKAChangeWhenLinkedSetupsAreTrashed`（PATCH）／ `TestUpdateWithKeyChange_AllowsKAChangeWhenLinkedSetupsAreTrashed`（PUT） | **赤（実測済み）** |
| (b) ゴミ箱のセットプレイへ検証結果を書けないこと | `TestUpsertResult_RejectsSoftDeletedSetup` | **赤（実測済み）** |

**★どちらも「是正を一時的に戻すと実際に赤くなる」ことを確認してある。** 通るだけのテストは歯止めにならないため、破壊確認まで行った。

**あわせて対照を 1 本置いた**——`TestUpdateMetadata_StillRequiresCarryOptionsWhenSetupIsAlive`。**生きたセットプレイが紐付いている場合は従来どおり引き継ぎ指定を要求する。** 是正が拒否そのものを無効化していないことを示す。

---

## 4. §4.6 as-built ——**`DES-002` §4.2 へ写す材料（★4 経路）**

> **★指示書 v1.2.0 は 3 経路と書いていたが、§4.2-8（D-491）で一覧の経路が加わったため 4 経路である。** 設計卓が `CHANGE-122` §2.1-a2 で件数を合わせ済み。

### 4-1. `POST /api/setups/:id/restore`（**新設**）

| 項目 | 内容 |
|---|---|
| 要求 | ボディ無し。パスパラメータ `id` のみ |
| 成功 | **200** ＋ `SetupResponse`（成功後に再取得して返す。コンボ側の `Restore` と同型） |
| 不在／既に生きている | **404** `{"error":{"code":"not_found","message":"セットプレイが見つかりません"}}` |
| 副作用 | `setups.deleted_at` を NULL に戻す ／ `recipe_cache` を同一 Tx で作り直す |
| **`version`** | **触れない**（コンボ側と揃える） |
| 楽観排他 | **持たない**（コンボ側の `DELETE /api/combos/:id` も持たない。§1.5-6） |

### 4-2. `DELETE /api/setups/:id/permanent`（**新設**）

| 項目 | 内容 |
|---|---|
| 要求 | ボディ無し |
| 成功 | **204**（ボディ無し。コンボ側と揃える） |
| 不在 | **404** `not_found` |
| ゴミ箱に無い | **409** `{"error":{"code":"setup_not_in_trash","message":"完全削除の前にセットプレイをゴミ箱へ入れてください"}}` |
| 生きたコンボから参照中 | **409** `setup_in_use`（§4-4 に逐語） |
| 副作用 | `combo_setup_results` → `combo_setups` → `setup_steps` → `setups` を**明示削除**（1 Tx） |

### 4-3. `DELETE /api/setups/:id`（**挙動が変わる**）

| 項目 | 変更前 | 変更後 |
|---|---|---|
| 成功 | 204 | 204（**変更なし**） |
| 副作用 | `deleted_at` 設定 ＋ **`combo_setups` の物理削除** ＋ **`combo_setup_results` の物理削除** ＋ `recipe_cache` の物理削除 | `deleted_at` 設定 ＋ `recipe_cache` の物理削除 の **2 つのみ** |

**⇒ 利用者から見た差＝共有していた他のコンボの紐付けが壊れなくなり、復元すると一斉に戻る。**

### 4-4. `GET /api/setups?characterId=N&onlyDeleted=true`（**新設・4 本目**）

| 項目 | 内容 |
|---|---|
| 要求 | `characterId`（必須・正の整数） ／ `onlyDeleted`（任意。`"true"` のときのみゴミ箱） |
| 成功 | **200** ＋ `{"items":[SetupResponse...]}`。各要素に **`deletedAt`** が入る |
| 並び | `deleted_at DESC, id DESC`（直近に消したものから） |
| 省略時 | **従来どおり生きた一覧**（既存の挙動を変えていない） |

**★★引数の綴りは `camelCase` である**（**D-491**）。

| 経路 | 綴り |
|---|---|
| `GET /api/setups`（**同経路＝揃える先**） | **camelCase**: `characterId`（`internal/api/setup/handler.go:129, 267`） ／ `knockdownAdvantage`（`:274`） |
| `GET /api/combos`（持ち込み元・**採らなかった**） | snake_case: `character_id` / `only_deleted` / `is_draft` … |

**⇒ Plan 段階の暫定案（`character_id` / `only_deleted`）は誤りであり、同一経路内で綴りが割れるところだった。設計卓の指摘で是正した。**

---

## 5. §4.4-5 拒否の応答の形（**逐語**。`M23-04` が VAL コード化する）

**HTTP 409 Conflict。** `Content-Type: application/json`。

```json
{
  "error": {
    "code": "setup_in_use",
    "message": "このセットプレイは使用中のコンボに紐づいているため、完全に削除できません",
    "details": {
      "combos": [
        { "id": 12, "memo": "対空から拾うルート" },
        { "id": 34 }
      ]
    }
  }
}
```

- **`details.combos` は参照元の「生きたコンボ」の配列。** 判定に使う述語は **`combos.deleted_at IS NULL` だけ**である（**D-486**）。
- **`memo` は省略されうる**（`json:"memo,omitempty"`）。**`combos` に `name` 列は存在せず、利用者が付けた自由記述は `memo` だけであるため、これを「名前」に充てた**（開発者確認済み・2026-08-20）。`model.ComboRef` に同趣旨のコメントを置いてある。
- **画面はこの一覧を列挙しない**（**D-485**）。行内の `role="alert"` に短い文言 1 つを出すだけである。
- **応答の形は `internal/api/setup/restore_handler_test.go` が固定している**（`TestHandler_PermanentDelete_409_SetupInUse`）。**コード文字列はあえてリテラルで書いた**——定数を参照すると値を変えたときにテストも一緒に動き、「線を流れる契約が変わった」ことを検出できないため（既存 `wantVersionConflictCode` と同じ理由）。

**`setup_not_in_trash` の逐語**:

```json
{"error":{"code":"setup_not_in_trash","message":"完全削除の前にセットプレイをゴミ箱へ入れてください"}}
```

---

## 6. §4.2-6 既知の制約——**本サブ適用前に論理削除されたものは紐付けが戻らない**

**本サブの適用前に論理削除されたセットプレイは、`combo_setups` の行が既に物理削除されている。** どのコンボに紐付いていたかの情報が残っていないため、**遡って復旧することはできない。**

**⇒ 復元すると「戻ってきたが、どのコンボにも紐付いていない」状態になる。** これは仕様であり、欠陥ではない。**復元側に復旧処理を持たせても情報が無いので何もできない。**

**★影響範囲**: 開発者の dev DB に既存の論理削除済みセットプレイがある場合のみ。**配布時点では対象 0 件である。**

---

## 7. §4.4-6 既知の非対称——**参照元がすべてゴミ箱に居る場合**（`M23-05` の入力）

判定の述語が `combos.deleted_at IS NULL` だけであるため、**参照元のコンボがすべてゴミ箱に居る状態ならセットプレイを完全削除できる。** その後でコンボを復元しても、**紐付けは戻らない。**

**★ただしこれは「壊れた」ではない**——セットプレイそのものが完全に削除されている以上、紐付けが無いのは正しい状態である。**失われるのは「戻したときに欠けることを事前に警告される機会」だけ**であり、**保持は無期限**（**D-458**）なので利用者が完全削除を急ぐ必要も無い。

**本サブでは埋めていない**（**D-486**・開発者承認）。**設計卓が `M23-05` の入力にする。**

**★対で検査してある**——`TestService_PermanentDelete_RejectsWhenReferencedByLiveCombo`（拒否）と `TestService_PermanentDelete_AllowsWhenAllReferrersAreTrashed`（通る）。**片方だけでは「常に拒否される」状態と区別できない。**

---

## 7-B. ★その他の既知の制約（レビュー 中-2 / 中-3 / 中-5 で顕在化）

**いずれも本サブでは塞がない**（後続サブの担当面である）。**★設計卓は実装ソースを読めないため、書かれなければ存在しないのと同じである。**

### 7-B-1. 引き継ぎオプションが、ゴミ箱のセットプレイの紐付けを黙って落とす（→ `M23-06` / `M23-05`）

`knockdown_advantage` 変更時の引き継ぎ処理（`internal/service/combo/service.go:526` の PATCH ／ `:664, :669` の PUT）は、`DeleteComboSetupsByComboID`（全解除）と `DeleteComboSetupsByComboIDExcluding`（`CarrySetupIDs` に無いもの）を呼ぶ。**どちらも `setups.deleted_at` を見ない。**

**⇒ コンボ A に生きた T とゴミ箱の S が紐付いている状態で「全解除」または「個別（T だけ残す）」を選ぶと、画面に出ていない S の紐付けも同時に消える。** その後 S を復元しても A には戻らない。

**★退行ではない**——撤回前は S の紐付けが既に消えていたため最終状態は同じである。**が、本サブの看板である「復元すると紐付いていた全コンボへ一斉に戻る」が、利用者に見えない条件で成立しなくなるケースである。**

### 7-B-2. 復元が VAL-S04（同一コンボ内のレシピ重複）を再導入しうる（→ `M23-04` / `M23-05`）

`FindDuplicateInCombo`（`internal/repository/setup/repository.go:662-670`）は `s.deleted_at IS NULL` で絞る。したがって **「S をゴミ箱へ入れる → 同じレシピの S' をコンボ A に作る（重複判定は S を無視するので通る） → S を復元」で、A に同一レシピの生きたセットプレイが 2 本並ぶ。** DB 制約が無いためエラーにならず、静かに不変条件が破れる。

**★この状態は本サブ以前には作れなかった**（復元の経路が無かったため）。**復元の経路を作ったのは本サブであるから、入力として明示する。** 塞ぐのは `M23-04`（復元時のバリデーション）／ `M23-05`（削除済み行と再登録の衝突）の担当であり、指示書 §10 が名指ししている。

### 7-B-3. ゴミ箱の名無しセットプレイが「(名称未設定)」でしか識別できない（→ `M23-06`）

`web/src/features/setup/components/TrashSetupListRow.tsx` は `name → defaultRecipe → t("trash.setup.unnamed")` の順で表示名を決めるが、**論理削除時に `recipe_cache` を物理削除している**（§2.2-7）ため、**ゴミ箱の行では `defaultRecipe` が常に空であり、このフォールバックは到達しない。**

**⇒ 名前の無いセットプレイは全部「(名称未設定)」で並ぶ。完全削除は不可逆なので、複数並ぶと取り違えの余地がある。** **見せ方の作り込みは `M23-06`** のため本サブでは直さず、**到達しない分岐であることをコードのコメントに明記した**（分岐そのものは復元後の再利用に備えて残してある）。

---

## 8. §4.2-5 「確認したうえで何もしない」——`setup_steps`

**復元側で `setup_steps` に対して行うことは無い。**

- `setup_steps` は**論理削除の対象になっていない**（`setups.deleted_at` だけが論理削除を表す）。
- `setup_steps.setup_id` の FK は `ON DELETE CASCADE` であり、**論理削除では発火しない** ⇒ 物理的に残っている。
- **⇒ 親の `deleted_at` を NULL に戻せば、ステップは繋がったまま復帰する。**

**★「確認したうえで何もしない」と「見落とした」は報告の上で区別がつかないため明記する**（指示書 §4.2-5 の要求）。実装にも同趣旨のコメントを置いた（`internal/service/setup/restore.go`）。

---

## 9. ★コンボ側に揃えなかった 1 点——完全削除の前チェックを Tx 内へ置いた

**指示書 §4.3-1 は「経路の形はコンボ側に揃える。揃えられない事情が出た場合は、揃えずに完了報告へ理由を書くこと」と定めている。1 点だけ揃えていない。**

| | コンボ側（既存） | セットプレイ側（本サブ） |
|---|---|---|
| 前チェックの位置 | **`BeginTx` の前**（`FindByIDAllowDeleted` と `DeletedAt == nil` の判定） | **`BeginTx` の後**（同一 Tx 内） |

**理由**: `M23-RESEARCH-01` §D-6 が **「`PermanentDelete` の前チェックが Tx 外である事実は、TOCTOU の窓を作る形である（判定してから `BeginTx` するまでの間に他の利用者が復元しうる）」** と実測して記録している。**本サブは新しい経路を書くので、その窓を最初から作らない側を採った。**

**★コンボ側は触っていない**（§2.2-2）。**既存の窓の是正は本サブの範囲外であり、`followup` 候補として設計伝達レポート §4 に置いた。**

---

## 10. 推測で進めた箇所（全 2 件・§9.2）

| # | 箇所 | 推測の内容 | コード内の明示 |
|---|---|---|---|
| 1 | `model.ComboRef.Memo` | **`combos` に `name` 列が無いため、利用者の付けた唯一の自由記述である `memo` を「名前」として扱う** | `internal/model/setup.go` の `ComboRef` に注記（開発者確認済みのため `// 推測:` ではなく確定として記載） |
| 2 | `TrashSetupDeleteConfirm` の新設 | **コンボ側の `PermanentDeleteConfirm` を流用しない**（同コンポーネントの文言が「このコンボを完全削除します」と対象を名指ししており、セットプレイに使うと種類の違う対象を「コンボ」と呼ぶことになる） | 同ファイル冒頭に理由を明記 |

**★§9.2-1（関数名・ファイル名の細部）・§9.2-3（配線の見た目）・§9.2-4（既に生きているセットプレイへの復元の扱い）は、いずれも既存の流儀へ揃えたため推測にあたらない。**
§9.2-4 は**コンボ側に揃えて 404**とした（リポジトリの `WHERE ... AND deleted_at IS NOT NULL` が 0 行 → `ErrNotFound`）。

---

## 11. 自己テスト結果（§7.2。★コマンド自身の出力＝**E-125**）

### 11-1. `go test ./...`

```
Go パッケージ数: 53 / FAIL: 0
```

**（レビュー取り込み後の再検証でも同数・`gofmt -l internal/` と `go vet ./...` は出力なし。）**

**新規テストの内訳（`-v` の `--- PASS` 行を数えた実測）**:

| パッケージ | 本数 | 内容 |
|---|---:|---|
| `internal/service/setup` | **10** | 共有の論理削除／復元／拒否／通る側／4 表／ゴミ箱経由の強制／不在／生存中の復元／一覧 ＋ 検証結果の拒否 |
| `internal/repository/setup` | **4** | 実 DB での不可視／`version` 据え置き／生存行への復元／ゴミ箱コンボを数えない |
| `internal/api/setup` | **7** | 204／409 `setup_in_use`（details 込み）／409 `setup_not_in_trash`／404／復元 200／復元 404／`onlyDeleted` 分岐 |
| `internal/service/combo` | **3** | KA 変更が通る（PATCH / PUT）＋ 生きたセットプレイでは従来どおり要求する（対照） |
| **合計** | **24** | |

**★破壊確認**（テストが歯止めとして機能することの実測）:

```
# (a) の是正を戻した状態
--- FAIL: TestUpdateMetadata_AllowsKAChangeWhenLinkedSetupsAreTrashed (0.55s)
--- FAIL: TestUpdateWithKeyChange_AllowsKAChangeWhenLinkedSetupsAreTrashed (0.58s)
FAIL	github.com/plexiblinp/combomgr/internal/service/combo	1.138s

# (b) の是正を戻した状態
--- FAIL: TestUpsertResult_RejectsSoftDeletedSetup (0.59s)
FAIL	github.com/plexiblinp/combomgr/internal/service/setup	0.598s
```

### 11-2. `cd web && pnpm test`

```
 Test Files  171 passed (171)
      Tests  1682 passed (1682)
   Duration  75.14s
```

**（レビュー取り込み後の再検証でも同数・全緑。）**

**新規は `TrashSetupListRow.test.tsx` の 6 本。** うち 4 本が「押しても無反応にならないこと」（§4.4-3c）を守る。
**`locales.test.ts`（ja↔en 双方向 parity）と `TrashList.test.tsx`（コンボ表 7 列の維持）を含めて全緑である。**

### 11-3. `make e2e`

**初回（Phase A 完了時）**:

```
  158 passed (3.0m)
```

**レビュー取り込み後の再検証（Phase C）——全 2 走**:

```
# 1 走目
  1 flaky
    [chromium] › e2e/m18-03c-drainage.spec.ts:345:3 › M18-03c drainage › B: 手動確認レーンから保存すると当該相手技の登録済みに現れる
  157 passed (3.0m)

# 2 走目
  158 passed (3.1m)
```

**★1 走目の flaky は `m18-03c-drainage`（確定反撃の手動確認レーン）であり、本サブが触った面を 1 つも通らない。** 再試行で通り、2 走目では発生していない。**★ただし「flake」と断定はしない**（`E-84` の型を避ける）。**`M23-01` が観測した「並列走行で `POST /api/combos` が 500 を返す事象」（同サブ横断課題 5）と同じ面である可能性がある。** 本サブも E2E の書き込み量を増やしている（新規 spec 3 本＋その後片付け）ため、**競合を悪化させた可能性は否定しない。**

**★本サブの新規 spec 3 本は、初回・再検証 2 走のいずれでも green である。**

**新規 3 本を含む**:

```
✓ 155 [chromium] › e2e/m23-02-setup-restore.spec.ts:107:3 › 2 コンボで共有 → 論理削除 → 復元 → 両方から見える (2.0s)
✓ 157 [chromium] › e2e/m23-02-setup-restore.spec.ts:168:3 › 完全削除: 生きたコンボから参照中は拒否され、参照元をゴミ箱へ入れると通る (239ms)
✓ 158 [chromium] › e2e/m23-02-setup-restore.spec.ts:203:3 › コンボ表は 7 列のまま(M23-01 の撤去を巻き戻していない) (1.4s)
```

**既存 spec との衝突は無い**（§5 の注記）。実査の結果、**セットプレイやコンボの件数を絶対値で数える spec は 0 件**であり、本 spec も `afterEach` で作成行を全部落とす（既存 `m22-03` / `m22-04` / `m23-01` の慣行に揃えた）。
**★後片付けの順序**: セットプレイの完全削除は生きたコンボから参照されている間は拒否されるため、**コンボを先に論理削除してからセットプレイを完全削除する。**

### 11-4. マイグレ

```
$ ls migrations/ | tail -2
000078_add_combos_superseded_by.down.sql
000078_add_combos_superseded_by.up.sql
```

**★1 本も足していない。`000078` が末尾のままである。**

---

## 12. 品質チェック（§7.3）

| 検査 | 結果 |
|---|---|
| `bash scripts/check-enum-sync.sh` | **ベースラインどおり（増加なし）** |
| `bash scripts/check-browser-storage-keys.sh` | **違反なし**（台帳 9 件 / 本番コード 8 件。**本サブはブラウザストレージへ何も足していない**） |
| `cd web && pnpm lint`（`tsc --noEmit`） | **exit 0・出力なし** |
| `gofmt -l internal/` | **出力なし** |
| `go vet ./...` | **出力なし** |
| JSON タグ camelCase | ✅ `deletedAt` / `ComboRef` の `id` / `memo` |
| `console.log` / `fmt.Println` | **残していない** |
| i18n ja / en 両方 | ✅ `trash.setup.*` を **+17 / +17** で追加。`locales.test.ts` の双方向 parity 緑 |
| エラーの wrap | ✅ 新規コードは全て `fmt.Errorf("...: %w", err)` |

---

## 13. §4.9 否定形確認——撤回した挙動の残骸の全文走査（**3 系統**）

### 13-1. 走査①: `案 P1` ／ `DeleteComboSetupsBySetupID` ／ 「紐付けが消える」旨のコメント

| 系統 | 結果 |
|---|---|
| **本番コード** | **`案 P1` は `internal/service/setup/service.go:467` の 1 件のみ**（＝撤回の経緯を残す新しいコメント）。**旧文言は残っていない。** `DeleteComboSetupsBySetupID` は定義とインタフェース宣言に残るが、**本番の呼び元は新設した `HardDelete` の 1 段目のみ**であり、インタフェースのコメントへ「案 P1 撤回により論理削除の経路からは呼ばれなくなった」と明記した |
| **テスト資産** | 2 件を追随させた——`internal/service/setup/service_test.go:452` の節見出し（`// DeleteSetup — 論理削除 + combo_setups 削除 + cache 削除` → 撤回後の内容）／ `internal/repository/setup/setup_results_test.go` の `TestSetupResults_DeleteSetupRemovesResults` を **`TestSetupResults_DeleteComboSetupsBySetupIDRemovesResults`** へ改名（実体は「全紐付け解除」の検査であり「セットプレイ削除」ではない） |
| **設計文書・指示書** | ヒットは `CHANGE-122-notification.md` ／ `parallel-board.md` ／ `change-number-registry.md` ／ `followup-backlog.md` ／ `progress-log.md`（フェーズ1 期の履歴） ／ `docs/progress/phase1/m4-01-review.md`（アーカイブ）。**いずれも設計卓の管理下または履歴であり、製造は編集していない**（`CLAUDE.md` §8） |

### 13-2. 走査②: 論理削除の後に紐付けが 0 件であることを前提にしたテスト

**★期待値が反転する箇所は 0 件だった。**

- `internal/service/setup/service_test.go` の `TestService_DeleteSetup_SoftDelete` は `GetSetup` が 404 になることだけを見ており、`combo_setups` の件数を数えていない。
- 同 `TestService_GetSetupCandidates_*` は候補一覧から消えることを見ており、これは `deleted_at IS NULL` 側の担保なので**撤回後も期待値は同じ**。
- `internal/repository/setup/setup_results_test.go` の該当テストは**リポジトリ関数を直接呼んでいる**ため、論理削除の経路とは無関係で**アサーションは反転しない**（名前とコメントのみ追随）。

**⇒ 撤回によって赤くなったテストも、誤った期待値のまま緑になったテストも無い。** 代わりに「紐付けが残ること」を**肯定的に主張するテスト**を新設した（`TestService_DeleteSetup_KeepsComboSetupsWhenShared`）。

### 13-3. 走査③: 「セットプレイは復元できない」旨の記述

**本番コード・テスト資産ともに 0 件。**

走査でヒットした 2 件（`internal/repository/combo/repository.go:559` の「後からどちらだったのか復元できない」／ `web/src/features/config/QRCodeModal.contract.test.tsx:7` の「テストから読み戻せない」）は**意味の異なる用法**であり、セットプレイの復元とは無関係。

**★1 件だけ実態に合わなくなった記述があり、更新した**——`web/e2e/m22-03-optimistic-locking.spec.ts:20-25` の「現行 API でセットプレイ行を物理削除する手段が無い」旨のコメント（本サブが `DELETE /api/setups/:id/permanent` を足したため失効した）。

> **★訂正（レビュー 高-1・2026-08-20）**: 本節と §17 は当初「更新した」と書いていたが、**初回の commit 群（`c4daf19`〜`f1ffda3`）には当該ファイルの差分が含まれていなかった**。走査で検出しながら手当てが落ちていた。**レビューの指摘を受けて実際に更新し、本記述を実態へ合わせた。** **★報告と実物の食い違いは、設計卓が実装ソースを読めない以上そのまま前提として複製される。**

---

## 14. ■ 併せて更新が要るもの（**E-114** ／ **D-277**）

| # | 項目 | 状態 |
|---|---|---|
| 1 | **消費した CHANGE 番号の registry 登録** | **不要。`CHANGE-122` は起票時（D-483 / D-484）に `change-number-registry.md` §1 へ登録済み**。本サブは新規に払い出していない |
| 2 | **「次の番号」の写し先** | **不要**（新規採番なし）。**★ただし件数の写し先にズレがある**。`registry` の `122` 行と `parallel-board` §2.1 は「内容 3 件 / 機能の新設 2 本」と書いているが、**§4.2-8 で一覧の経路が加わったため実際は 3 本である**。設計卓が `CHANGE-122` §2.1-a2 で直したと連絡を受けているものの、**`registry` §1 の `122` 行と改訂履歴 `1.170.0` は本作業ツリーの版では「新設 2 本」のままである**。**⇒ 設計伝達レポート §4-2 に申し送った** |
| 3 | **消費したマイグレ連番** | **0 本。`ls migrations/` の実査末尾は `000078`** で、ボード §2.2 の「次に払い出す番号」を動かしていない |
| 4 | **版を上げた文書の参照元** | **製造は文書の版を上げていない**（指示書・チェックリストの v1.3.0 化は設計卓の手番） |
| 5 | **`web/CLAUDE.md` §1 の台帳** | **追記不要。本サブはブラウザストレージへ何も足していない**（`check-browser-storage-keys.sh` で確認） |
| 6 | **`.claude/rules/enum-sync.md` の同期** | **実施済み**。`model.ErrorCodeSetupNotInTrash` / `ErrorCodeSetupInUse` に対し `web/src/constants/api-error.ts` へ同値の定数を追加した |

---

## 15. §2.1 に無いファイルへ手を入れた箇所（§2.3 例外条項）

| ファイル | 理由 |
|---|---|
| `internal/repository/combo/repository.go` | **§4.1-6 (a) の是正**（`CountComboSetupsByComboID`）。**指示書 v1.3.0 §4.1-6 が明示的に求めている**ため例外ではないが、成果物表（v1.2.0 準拠）には無いので挙げる |
| `internal/model/setup.go` | `ComboRef` の新設（拒否応答の `details` 用） |
| `internal/model/api_error.go` | エラーコード定数 2 件 |
| `web/src/constants/api-error.ts` | 上記の同期（`.claude/rules/enum-sync.md`） |
| `internal/api/combo/handler_test.go` | **モックの追随**（`setupsvc.Service` にメソッドを足したため。静的アサーションが検出した） |
| `web/src/pages/TrashPage.tsx` | セットプレイ節の追加。**★`TrashList` / `TrashListRow` / `TrashBulkActions` には手を入れていない** |

---

## 16. `M23-03` / `M23-06` の担当範囲へ踏み込みたくなった箇所（§2.3）

| # | 箇所 | 踏み込まなかった理由 |
|---|---|---|
| 1 | **`GetRecipeCache`（setups）に `deleted_at IS NULL` を足すこと** | §1.5-1。**`M23-03` の担当。** 2 サブが同じ関数を触るのを避けた |
| 2 | **`FindComboIDsBySetupID` / `FindComboIDsBySetupIDs`（`parentComboIds`）** | `M23-overview` §4.9 の穴 6。**本サブの変更が無くても同じ挙動**であり §9.1-2 の「他所の穴」 |
| 3 | **ゴミ箱画面の一括選択・タブ・並び** | §1.5-2 / §4.5-5。**`M23-06` の担当。** 既存の選択状態がコンボ id の配列であり、混ぜると id が衝突する |
| 4 | **紐付け解除への導線**（拒否されたときに利用者がそのコンボへ飛べる） | §4.4-4。**`M23-06` の担当。** 本サブは `DELETE .../setup-links/:setupId` を呼ぶ側に回っていない |
| 5 | **コンボ側 `PermanentDelete` の前チェックを Tx 内へ移すこと** | §2.2-2（コンボ側の挙動を変えない）。**`followup` 候補として設計伝達レポート §4 へ** |
| 6 | **`DES-006` への VAL コード** | §1.5-5。**`M23-04` の担当** |

---

## 17. 変更ファイル一覧

### バックエンド（新規 3・変更 8）

| ファイル | 種別 |
|---|---|
| `internal/repository/setup/restore.go` | **新規**（`FindByIDAllowDeleted` / `Restore` / `FindLiveReferencingCombos` / `HardDelete` / `ListDeletedByCharacterID`） |
| `internal/service/setup/restore.go` | **新規**（`Restore` / `PermanentDelete` / `ListDeletedSetups` ＋ `ErrSetupNotInTrash` / `SetupInUseError`） |
| `internal/api/setup/restore_handler.go` | **新規**（`Restore` / `PermanentDelete`） |
| `internal/service/setup/service.go` | 案 P1 の撤回 ＋ インタフェース拡張 |
| `internal/repository/setup/repository.go` | **§4.1-6 (b) の是正** ＋ インタフェース拡張 |
| `internal/repository/combo/repository.go` | **§4.1-6 (a) の是正** |
| `internal/api/setup/routes.go` | 2 経路の追加 |
| `internal/api/setup/handler.go` | `onlyDeleted` 分岐 |
| `internal/api/setup/dto.go` | `deletedAt` |
| `internal/model/setup.go` | `ComboRef` |
| `internal/model/api_error.go` | エラーコード 2 件 |

### フロントエンド（新規 6・変更 4）

`useTrashSetups.ts` / `useRestoreSetup.ts` / `usePermanentDeleteSetup.ts` / `TrashSetupList.tsx` / `TrashSetupListRow.tsx` / `TrashSetupDeleteConfirm.tsx`（新規）
`setupApi.ts` / `types.ts` / `TrashPage.tsx` / `constants/api-error.ts` / `locales/{ja,en}.json`（変更）

### テスト（新規 4・変更 3）

`internal/service/setup/restore_test.go` / `internal/repository/setup/restore_test.go` / `internal/api/setup/restore_handler_test.go` / `internal/service/combo/setup_carry_trashed_test.go` / `web/src/features/setup/components/TrashSetupListRow.test.tsx` / `web/e2e/m23-02-setup-restore.spec.ts`（新規）
`internal/service/setup/setup_results_test.go` / `internal/service/setup/service_test.go` / `internal/repository/setup/setup_results_test.go` / `internal/api/setup/handler_test.go` / `internal/api/combo/handler_test.go` / `web/e2e/m22-03-optimistic-locking.spec.ts`（変更）

---

## 18. 並列相手との as-built 突合（`E-121` ／ **D-284**・**D-297**）

**本サブの並列相手は `M24-09a` のみである**（**D-490**）。同サブは **CI 設定と依存の棚卸し**であり、本番コードの diff も 0 の見込みで、**本サブと触る面が 1 つも交わらない。**

**★`DES-002` を両サブの CHANGE が改訂する**（本サブは §4.2、`M24-09a` は §11.3）が、**版の取り合いは設計卓が反映時に処理する**ため製造は関与しない（指示書 §3.3-9）。

**`M23-01` は並列相手ではなく前提である**（完了済み。本サブはその上に積んだ）。巻き戻していないことは E2E で機械的に検査している（§11-3 の 3 本目）。

---

*以上、M23-02 完了報告。配置 `docs/progress/m23-02-completion-report.md`。*
