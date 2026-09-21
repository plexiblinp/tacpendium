# M23-02 レビュー報告書

| 項目 | 内容 |
|------|------|
| 対象作業 | **M23-02**（セットプレイの復元と完全削除 ＋ 案 P1 の撤回） |
| 対象指示書 | `docs/instructions/M23-02-setup-restore-and-permanent-delete.md` **v1.3.0**（★リポジトリ内は v1.2.0。正本は開発者添付の v1.3.0 実体を使用） |
| チェックリスト | `docs/instructions/reviews/M23-02-review-checklist.md` **v1.3.0**（同上） |
| 対象コミット | `c4daf19`..`f1ffda3`（6 コミット。`git diff f3b6e6c..HEAD` = 37 ファイル / +2979 −21） |
| レビュー日 | 2026-08-20 |
| 判定 | **条件付き合格**（§9 重大 **1 件**＝失効記述の残存と、それを「更新した」とする完了報告の記載。**最重要ゲートは全て充足**） |

---

## 総評

**最重要ゲート（共有されたセットプレイを論理削除しても他の生きたコンボの紐付けが壊れないこと）は、実装・テストの両方で満たされている。** テストは 1 対 1 ではなくコンボ A・B の共有状態で書かれ、復元後に両方から見えることを service / repository / E2E の 3 層で主張している。§4.1-6（本サブが壊した不変条件の後始末）も 2 か所とも是正され、**「是正を戻すと実際に赤くなる」ところまで確認**されている点は本レビューで最も評価できる。

完全削除は 4 表の明示削除・1 トランザクション・`combos.deleted_at IS NULL` との結合を伴う前チェック・ゴミ箱経由の強制、いずれも指示書どおりである。復元は `version` を動かさず、`recipe_cache` を同一 Tx で作り直す。`M23-01` の 7 列撤去は巻き戻っておらず、E2E で機械的に固定されている。スコープ外 8 件への踏み込みも無い。

一方で、**完了報告が「更新した」と 2 か所に書いている `web/e2e/m22-03-optimistic-locking.spec.ts` の失効コメントが、実際には 1 文字も変更されていない**（作業ツリー clean・当該ファイルは差分に含まれない）。動作は正しく、テストも lint も緑のまま通るため、人が読む以外に検出経路が無い型の欠落である。本プロジェクトの優先度較正に従い「高」とする。ほかに中 4 件・低 3 件。

---

## 設計準拠性レビュー結果

### ◎ §4.1 案 P1 の撤回（論理削除で `combo_setups` を消すのをやめる）

- `internal/service/setup/service.go:474-491`：`DeleteComboSetupsBySetupID` の呼び出しが外れ、残るのは `SoftDelete` と `DeleteSetupCache` の 2 つ。**§4.1-1 のとおり。**
- **コメントが「消しただけ」になっていない**（§4.1-4）。撤回の主体（M23-02・D-483）・当時の前提が変わった理由・除外を参照側へ委ねる旨・**不変条件がここで失われることと是正先 2 か所の名指し**まで残してある。チェックリスト §1 の要求を上回る質。
- `combo_setup_results`（§4.1-3）：`DeleteComboSetupsBySetupID` が `combo_setup_results` を先に明示削除していた（実査 §1-2 のとおり）ため、呼び出しごと外したことで検証結果も保たれる。**実装として一貫している。**（ただしテストが無い。後述「中-1」）

### ◎ §4.1-6 壊した不変条件の後始末（**D-491**・重大判定の 1 つ目）

- **(a)** `internal/repository/combo/repository.go:1229-1245` `CountComboSetupsByComboID` に `JOIN setups s ON s.id = cs.setup_id AND s.deleted_at IS NULL` を追加。**利用者可視の劣化（紐付いたセットプレイが全部ゴミ箱に居るコンボの `knockdown_advantage` が変更できない）を出荷していない。**
- **(b)** `internal/repository/setup/repository.go:291-307` `comboSetupExists` に同じ結合を追加。
- **必須テスト 2 本が在る**（チェックリスト §4 の「(a) が無いまま合格にしないこと」を充足）。
  - (a) `TestUpdateMetadata_AllowsKAChangeWhenLinkedSetupsAreTrashed` ＋ **PUT 経路** `TestUpdateWithKeyChange_AllowsKAChangeWhenLinkedSetupsAreTrashed`（PATCH だけでなく PUT も押さえたのは加点）
  - (b) `TestUpsertResult_RejectsSoftDeletedSetup`（`UpsertResult` / `DeleteResult` の両方を検査）
  - **対照** `TestUpdateMetadata_StillRequiresCarryOptionsWhenSetupIsAlive`（是正が拒否そのものを無効化していないことを示す）
- **§4.1-6 の 2 か所以外へ広げていない**（§9.1-2）。`FindComboIDsBySetupID(s)` と `FindCandidateSetups` の除外副問い合わせは報告のみで `M23-03` へ渡してある。**「壊した分は直す」を「見つけた分は直す」へ広げていない。**
- ★1 点、**共有ヘルパ `comboSetupExists` の 3 つ目の呼び元（`CreateSetupLink` の冪等判定）も同時に閉じた**ことが完了報告 §3-3 と設計伝達レポート §2-1 で「ヘルパ 2 本 / 症状 3 つ」として明示的に設計卓へ戻されている。**同一ヘルパ・同一不変条件であり、片方だけ直すほうが不整合である。判断・報告ともに妥当。** レビューとしても踏み込み過ぎとは見ない（挙動確認：ゴミ箱のセットプレイへの `CreateSetupLink` は `exists=false` → `SetupExistsActive` → `ErrNotFound`。撤回前と同じ結果に戻っている＝退行ではない）。

### ◎ §4.2 復元 `POST /api/setups/:id/restore`

- ルート追加位置・ハンドラの形（成功後に再取得して 200）・404 の返し方は、いずれもコンボ側と同型（`internal/api/setup/routes.go:15-17` / `restore_handler.go:23-45`）。
- **`version` に触れていない**（`repository/setup/restore.go:36-51`。`UPDATE setups SET deleted_at = NULL, updated_at = datetime('now')`）。コンボ側 `comborepo.Restore`（`repository/combo/repository.go:956-971`）と 1 対 1。**リポジトリ層テスト `TestRestore_DoesNotBumpVersion` が固定している（§5-8 充足）。**
- **`recipe_cache` を同一トランザクションで作り直している**（`service/setup/restore.go:73`。`RecomputeSetupCache` は `FindStepsBySetupIDTx` / `UpdateRecipeCacheTx` を使う Tx 版であり、未コミットの復元を正しく見る）。
- **`setup_steps` に対して何もしない**ことが、実装コメント（`service/setup/restore.go:44-49`）と完了報告 §8 の両方に明記されている。**「確認したうえで何もしない」と「見落とした」の区別が付く形になっている**（§4.2-5 の要求どおり）。
- 既に生きている行への復元は 404（`WHERE ... AND deleted_at IS NOT NULL` の 0 行 → `ErrNotFound`）。**コンボ側に揃えるという既定どおり**（§4.2-7 / §9.2-4）。

### ◎ §4.2-8 削除済みセットプレイ一覧（as-built 4 経路目）

- `GET /api/setups?characterId=N&onlyDeleted=true`。**既存の一覧の SQL も署名も変えず、`ListDeletedByCharacterID` を別メソッドとして足している**（指示書の明示要求）。
- **引数の綴りが `onlyDeleted`（camelCase）である点は妥当。** 実査どおり `GET /api/setups` は `characterId` / `knockdownAdvantage` の camelCase であり（`internal/api/setup/handler.go:129,279,286`）、コンボ側の `only_deleted` を持ち込むと同一経路内で綴りが割れる。**指示書 §4.2-8 の趣旨（同じ経路の中で割れるほうが害が大きい）に一致。** `true` 完全一致で判定する点もコンボ側 `handler.go:241` と同型。
- 完了報告 §4 と progress-log が **4 経路**で書かれている（§4.2-8 の要求）。`CHANGE-122` 側の件数ズレも設計伝達レポート §4-2 で申し送り済み。

### ◎ §4.3 完全削除 `DELETE /api/setups/:id/permanent`

- **CASCADE に依存していない。** `repository/setup/restore.go:98-113` が `combo_setup_results` → `combo_setups`（`DeleteComboSetupsBySetupID` の再利用）→ `setup_steps` → `setups` の順で明示削除。**`REFERENCES setups` を持つ表は `setup_steps` / `combo_setups` の 2 つのみ、`combo_setup_results` は複合 FK で `combo_setups` を指す（migrations/000001）。4 表で漏れなし。**
- **1 トランザクション**（`service/setup/restore.go:97-133`。前チェックも Tx 内）。`defer` の rollback 条件が名前付き `err` を正しく捕まえており、`ErrSetupNotInTrash` / `SetupInUseError` の早期 return でも巻き戻る。
- **論理削除されていないセットプレイの完全削除は拒否**（`setup.DeletedAt == nil` → `ErrSetupNotInTrash` → 409 `setup_not_in_trash`）。テスト `TestService_PermanentDelete_RejectsSetupNotInTrash` 在り（§5-7）。
- 成功は 204（コンボ側と同じ）。
- **§5-6（4 表すべてが空になる）を `TestService_PermanentDelete_RemovesRowsFromAllFourTables` が実 DB で検査している。** `M23-overview` §4.10 が記録した「CASCADE を守るテストが 0 件」の穴を繰り返していない。

### ◎ §4.4 完全削除の前チェック（重大判定の 3 つ目）

- **結合を挟んでいる。** `FindLiveReferencingCombos`（`repository/setup/restore.go:63-90`）は `JOIN combos c ON c.id = cs.combo_id WHERE cs.setup_id = ? AND c.deleted_at IS NULL`。**件数だけを数えていない。**
- **述語は `combos.deleted_at IS NULL` の 1 つだけ**（D-486）。余計な述語を足していない。`TestFindLiveReferencingCombos_ExcludesTrashedCombos` がゴミ箱のコンボを数えないことを固定。
- **拒否（§5-4）と通る側（§5-5）が対で在る**（`TestService_PermanentDelete_RejectsWhenReferencedByLiveCombo` / `..._AllowsWhenAllReferrersAreTrashed`）。前者は **A・B の両方が応答に載ること**まで検査しており、指示書 §5-4 の「応答に参照元コンボが含まれることまで確認する」を満たす。
- 応答は 409 ＋ `details.combos`。既存の流儀（`tag_in_use` の `NewAPIErrorWithDetails` ＋ `errors.As`）に完全に揃っている。**「確認つき強行」に作り替えていない。**
- **専用の表示を新設していない**（D-485）。行内 `role="alert"` に短い文言 1 つ。**かつ「無反応」でもない**（§4.4-3c）。Vitest が 4 本でこれを守っている。

### ◎ §4.5-5 ゴミ箱画面の置き方 ／ `M23-01` の撤去の非巻き戻し

- **コンボの表に列も行も足していない。** `TrashList.tsx` / `TrashListRow.tsx` / `TrashBulkActions.tsx` は差分に含まれない（実測）。`TrashList.tsx` は 7 列のまま、`TrashListRow.tsx:105` は `colSpan={7}` のまま。
- セットプレイは**独立テーブル 3 列**（名前 / 削除日時 / 操作）。**一括選択なし**（コンボ id 配列との衝突回避）。**削除日時は `DES-005` §5.15 の要求**であり、`SetupResponse.DeletedAt`（`*time.Time` / `deletedAt,omitempty`）を `ComboResponse` と同型で追加したのは正当な §3.3-8 の例外。
- 「残日数」「あと N 日」「期限切れ」「90 日」の復活は全文走査で 0 件（実測）。新規 E2E が同じ場所で 7 列を再検査しており、**`m23-01` spec の行スコープ検査とも衝突しない**（`tr:has(...)` で行に閉じているため、新テーブルの `columnheader` 追加は影響しない）。

### ◎ §4.7 マイグレーション／§2.2 スキーマ不変

- `migrations/` の末尾は `000078` のまま。`setups` 系のスキーマ変更なし。`PATCH /api/setups/:id`・`DELETE .../setup-links/:setupId`・コンボ側の復元/完全削除はいずれも未変更（差分で確認）。
- `FR013` に触れていない（所有者・監査ログを持ち込んでいない）。`DES-002` / `DES-005` / `DES-006` は 1 文字も編集されていない。

### ○ §5 テスト要件（10 件は全て在るが、1 つ主張が欠けている）

| 要求 | 状態 |
|---|---|
| §5-1 共有状態での論理削除 | ◎ `TestService_DeleteSetup_KeepsComboSetupsWhenShared`（**2 コンボ共有。1 対 1 ではない**） |
| §5-2 復元後 A・B の両方 | ◎ `TestService_Restore_RevivesLinksForAllSharingCombos`（両方をループで確認） |
| §5-3 実 DB での不可視 | ◎ `TestRestore_SoftDeletedSetupIsHiddenFromLiveCombos`（`dbtest.Setup`。単体・バルクの両取得を検査） |
| §5-4 / §5-5 拒否と通る側 | ◎ 対で在る |
| §5-6 4 表 | ◎ |
| §5-7 ゴミ箱を経由しない完全削除 | ◎ |
| §5-8 `version` 据え置き | ◎ |
| §5-9 拒否が伝わる | ◎ Vitest 6 本 |
| §5-10 E2E 1 本通し | ◎ 紐付け 2 本 → 論理削除 → 復元 → 両方から見える、を 1 本で通している |
| **§4.1-3 の帰結（`combo_setup_results` が論理削除後も残る）** | **△ 主張するテストが無い**（後述「中-1」） |

- 完了報告のテスト結果は **スイート名・件数の実出力**で書かれている（`53 packages / FAIL 0`・`171 files 1682 tests`・`158 passed`）。**E-125 の要求を満たす。** `make e2e` を「実行しなかった」と書くべき状況でもない（実行して 158 passed）。
- **破壊確認（是正を戻すと赤くなる）の実出力まで貼ってある**のは、本プロジェクトのテスト報告として模範的。

### △ §4.9 否定形確認（**重大 1 件を含む**）

- 走査①②③の 3 系統すべてを走査した結果が完了報告 §13 に在る。走査②（期待値が反転するテスト）の分析は正確で、`TestSetupResults_DeleteSetupRemovesResults` → `TestSetupResults_DeleteComboSetupsBySetupIDRemovesResults` の改名も適切（実体が「全紐付け解除」の検査であるという読みは正しい）。
- **★しかし `web/e2e/m22-03-optimistic-locking.spec.ts:20-25` の失効コメントが残っている**（詳細は「高-1」）。完了報告はこれを「更新した」と 2 か所（`:471` / `:540`）に書いているが、**当該ファイルは本サブの差分に含まれず、`git log` 上も `298fafb`（M22-03 期）が最終更新である。**

### ○ §7.5 完了報告・設計伝達レポート

- **指示書 §7.5 が求める 6 件が、すべて独立した節として在る**（§1-1 / §1-2 / §4 / §5 / §6 / §7）。設計卓が `CHANGE-122` へ写せる粒度。
- 「■ 併せて更新が要るもの」在り（§14。該当なしの項も明記）。§2.1 に無いファイルの列挙（§15）、`M23-03` / `M23-06` へ踏み込みたくなった箇所（§16）、並列相手（`M24-09a` のみ）との突合（§18）も在る。
- **案 P1 の撤回であることと、撤回して安全である根拠（§4.1-5）が §2 に明記**されている。「前任の誤りではない」と書いた §2-3 は、指示書 §1.2 の意図を正しく汲んでいる。
- `followup-backlog.md` は編集されていない（D-382 遵守）。更新候補は設計伝達レポート §4-6 に置かれている。
- **△ 減点は 1 点のみ**——上記の「m22-03 を更新した」という事実と異なる記載（高-1）。**設計卓は実装ソースを読まないため、報告の誤りはそのまま正史になる。**

---

## 設計準拠性以外の指摘事項

### 1. `model.ComboRef` の「開発者確認済み」表記と `// 推測:` の欠落（中）

`internal/model/setup.go:110-117`：

```go
// ★Memo を「名前」として載せている。combos に name 列は存在せず、利用者が付けた
// 自由記述は memo だけであるため(開発者確認済み・2026-08-20)。空でもよい。
```

- **事実関係は正しい**（`migrations/000001_init_schema.up.sql:58-80` に `name` 列は無く `memo` のみ。実測で確認した）。
- しかし **「拒否の応答の本体に載せる項目の細部」は指示書 §9.2-2 が明示的に「推測で進めてよい事項」に挙げている**。`CLAUDE.md` §9-3 とチェックリスト §6 は、その場合 `// 推測: 〜と仮定した` を求める。完了報告 §10 は **「開発者確認済みのため `// 推測:` ではなく確定として記載」** と、規約の適用除外の根拠に開発者確認を置いている。
- **その確認は追跡できない。** `parallel-board.md` / `progress-log.md` / `CHANGE-122-notification.md` / `M23-overview.md` を検索したが、`memo` を「名前」に充てる件の裁定・記録は 1 件も無い（D 番号なし）。
- ★問題は文言ではなく**来歴**である。裁定 ID の無い「開発者確認済み」は、後任には検証できない確定として複製される。**実確認が在るなら D 番号（または `progress-log` の該当行）を併記し、無いなら `// 推測:` へ戻すこと。**

### 2. `err2` という変数名（低）

`internal/api/setup/handler.go:141-152`。同一スコープに `err`（`strconv.ParseInt` 由来）が既に在るため `svcResps, err = ...` で足りる。`err2` は本リポジトリの他所に前例が無い。命名の一貫性（`CLAUDE.md` §4）の観点で `err` へ寄せるのが自然。

### 3. 新規コンポーネントのハードコード日本語（低）

- `TrashSetupDeleteConfirm.tsx`：タイトル・本文・ボタン 4 文字列が直書き。**コンボ側 `PermanentDeleteConfirm.tsx` も同型であり、既存の流儀に揃えたという説明は成立する。**
- `TrashPage.tsx:74`：セットプレイ節の「読み込み中...」だけ直書き。**同じ節の `heading` / `loadError` は `t()` を通しているため、節内で流儀が割れている。**
- 本サブで `trash.setup.*` を ja/en 13 キーずつ新設している以上、**新規追加分は i18n へ寄せるのが一貫**する（parity テストは緑なので契約違反ではない。持ち越し可）。

### 4. `ListDeletedByCharacterID` の `characterID == nil` 分岐が本番から到達不能（低）

`repository/setup/restore.go:118-140`。ハンドラは `characterId` 必須（`handler.go:130-135`）のため常に非 nil。到達するのはサービス層テストのみ。**既存 `ListByCharacterID` と署名を揃えた結果であり誤りではない**が、将来「全キャラのゴミ箱」を作るときまで検査されない分岐である旨は認識しておきたい。

---

## 推奨修正（優先度別）

### 高（M23 完了前に修正必須）

**高-1. 失効した記述が残っており、かつ完了報告が「更新した」と書いている**

- **残骸**：`web/e2e/m22-03-optimistic-locking.spec.ts:20-25`
  ```
  // ★後始末は完全ではない。コンボは物理削除できるが、セットプレイ行は残る——
  // DELETE /api/combos/:id/permanent は ... setups は消さず(repository.go の HardDelete)、
  // DELETE /api/setups/:id は論理削除であるため、現行 API でセットプレイ行を物理削除する手段が無い。
  // ⇒ 使い捨て DB の中に論理削除済みの setups 行が残る。GET /api/setups を
  // 数える spec を将来足すときは、この残留を前提にすること。
  ```
  **本サブが `DELETE /api/setups/:id/permanent` を足したため、この前提は失効した。**
- **報告との食い違い**：完了報告 `:471`（§13 末尾）が「★1 件だけ実態に合わなくなった記述を更新した」と書き、`:540`（§17 変更ファイル一覧）にも同ファイルが「変更」として挙がっている。**実際には差分に含まれず（`git diff f3b6e6c..HEAD --stat` に無し）、作業ツリーも clean、当該ファイルの最終更新は `298fafb`（M22-03 期）である。**
- **なぜ高か**：動作は正しいままで、`go test` も `pnpm test` も `make e2e` も `tsc` も緑。**人が読む以外に検出経路が無い。** かつ本文は「将来 spec を足すときの前提」として書かれているため、**後任がこの注記を前提に spec を設計すると誤った前提が複製される**（本プロジェクトの優先度較正どおり「高」）。
- **やること**：(1) 当該コメントを現状（`DELETE /api/setups/:id/permanent` で物理削除できる）に合わせて書き換える。(2) **完了報告 §13 / §17 の記載を実態へ合わせる**——実施したなら差分として残し、実施しないなら報告から落とす。**報告と実物の食い違いを残さないこと（設計卓は実装ソースを読めない）。**

### 中（M24 着手と並行可）

**中-1. `combo_setup_results` が論理削除後も残ることを主張するテストが無い**

§4.1-3 は「紐付けを保つ以上、その紐付けに対する検証結果も保たれていなければ一貫しない」と定めており、実装はそうなっている（`DeleteComboSetupsBySetupID` の呼び出しごと外したため）。しかし **`combo_setup_results` の残存を肯定的に主張するテストは 1 本も無い**（`--include=*_test.go` で全数確認。既存の検査はいずれもリポジトリ関数を直接呼ぶか、別文脈のもの）。

- 現状：`TestUpsertResult_RejectsSoftDeletedSetup` は「書けないこと」を見るだけで、**既に書かれた行が残ることは見ていない。**
- リスク：将来 `DeleteSetup` に検証結果の削除が戻っても、**全テストが緑のまま通る。** 本サブが `combo_setups` については `TestService_DeleteSetup_KeepsComboSetupsWhenShared` で肯定的に固定したのと同じ扱いが、`combo_setup_results` には無い。
- 提案：`TestService_DeleteSetup_KeepsComboSetupsWhenShared` に 1 アサーション追加（論理削除後も `SELECT count(*) FROM combo_setup_results WHERE setup_id = ?` が減らないこと）＋ 復元後にコンボ詳細から検証結果が戻ることを 1 本。

**中-2. 引き継ぎオプション `unlink_all` / `individual` が、ゴミ箱のセットプレイの紐付けを黙って落とす（既知の制約として未報告）**

- 経路：`internal/service/combo/service.go:526`（PATCH）／ `:664,669`（PUT）。`DeleteComboSetupsByComboID` はコンボの**全**紐付けを、`DeleteComboSetupsByComboIDExcluding` は `CarrySetupIDs` に無い**全**紐付けを落とす。**どちらも `setups.deleted_at` を見ない。**
- 症状：コンボ A に生きた T とゴミ箱の S が紐付いている状態で、利用者が KA 変更時に「全解除」または「個別（T だけ残す）」を選ぶと、**画面に出ていない S の紐付けが同時に消える。** その後 S を復元しても A には戻らない。
- **退行ではない**（撤回前は S の紐付けは既に消えていたため最終状態は同じ）。**が、本サブの看板である「復元すると紐付いていた全コンボへ一斉に戻る」が、利用者に見えない条件で成立しなくなるケースである。**
- 提案：**塞ぐことは求めない**（`M23-06` / `M23-05` の面）。**完了報告の「既知の制約」（§6 の隣）へ 1 段落として足し、設計伝達レポート §4 の followup 候補にも挙げること。** 設計卓はコードを読めないため、書かれなければ存在しない。

**中-3. 復元が VAL-S04（同一コンボ内のレシピ重複）を再導入しうることが未報告**

`FindDuplicateInCombo`（`repository/setup/repository.go:690-698`）は `s.deleted_at IS NULL` で絞る。したがって「S をゴミ箱へ入れる → 同じレシピの S' をコンボ A に作る（重複判定は S を無視するので通る） → S を復元」で、**A に同一レシピの生きたセットプレイが 2 本並ぶ**。DB 制約は無いのでエラーにはならず、静かに不変条件が破れる。

- **本サブで塞ぐべきではない**——`M23-04`（復元時のバリデーション）／`M23-05`（削除済み行と再登録の衝突）の担当であり、指示書 §10 が名指ししている。
- **ただし復元の経路を作ったのは本サブであり、この状態は本サブ以前には作れなかった。** 完了報告・設計伝達レポートのどちらにも記載が無い。**`M23-04` への入力として 1 行書くこと。**

**中-4. `ComboRef.Memo` の「開発者確認済み」表記**（前掲「指摘事項 1」）。裁定 ID を併記するか、`// 推測:` へ戻す。

**中-5. ゴミ箱のセットプレイが「(名称未設定)」でしか識別できない場合がある**

`TrashSetupListRow.tsx:37-39` は `name → defaultRecipe → t("trash.setup.unnamed")` の順で表示名を決める。**しかし論理削除時に `recipe_cache` を物理削除している（§2.2-7）ため、ゴミ箱の行は必ず `defaultRecipe === ""` になる。** ⇒ **`defaultRecipe` へのフォールバックは到達しない死んだ分岐であり、名前の無いセットプレイは全部「(名称未設定)」で並ぶ。** 完全削除は不可逆なので、複数並ぶと取り違えの余地がある。

- **見せ方の作り込みは `M23-06`** であり本サブで直すべきではない。**「フォールバックが到達しないこと」と「名無しが識別できないこと」を完了報告の既知の制約へ書き、`M23-06` の入力にすること**を推奨する（フォールバック行そのものは、意図が誤解されるので削るか「復元後にしか埋まらない」旨のコメントを添えるのが望ましい）。

### 低（将来対応）

- **低-1**：`internal/api/setup/handler.go:141-152` の `err2` を `err` へ（前掲「指摘事項 2」）。
- **低-2**：`TrashPage.tsx:74` の「読み込み中...」を `t()` 経由へ。`TrashSetupDeleteConfirm.tsx` の 4 文字列も、コンボ側と足並みを揃えて i18n 化する時に一緒に（既存の流儀に合わせた判断自体は妥当なので急がない）。
- **低-3**：`ListDeletedByCharacterID` の `characterID == nil` 分岐が本番から到達不能である旨のコメント（前掲「指摘事項 4」）。

---

## 良かった点

1. **★テストを「通ること」ではなく「壊すと赤くなること」で検証している。** §4.1-6 の是正 2 か所について、**是正を一時的に戻した状態の `--- FAIL:` 実出力を完了報告 §11-1 に貼ってある。** 指示書は破壊確認まで求めていない。**これは本サブが「利用者可視の劣化を出荷しない」ための唯一の歯止めであり、その歯止め自体が効くことを実測した**のは、レビューで最も評価すべき点である。
2. **共有状態を全層で貫いている。** service（A・B 2 コンボ）／ repository（実 DB で単体・バルク両取得）／ E2E（API + UI）のいずれも 1 対 1 に逃げていない。`TestService_Restore_RevivesLinksForAllSharingCombos` が A と B をループで確認しているのも、チェックリスト §4 の「片方だけで合格にしない」を正面から満たしている。
3. **撤回の痕跡の残し方が正しい。** `service.go:477-489` のコメントは、(i) 何を撤回したか (ii) 当時の前提が何で、なぜ変わったか (iii) 除外を誰に委ねたか (iv) **どの不変条件が失われ、その是正がどこに在るか** を全部書いている。§4.1-4 の「消すだけにしないこと」を最良の形で満たしており、**次に `DeleteSetup` を読む人が同じ判断をやり直さずに済む。**
4. **設計卓へ「数え方の差」を戻した判断。** 裁定 D-491 が「2 か所」と数えた対象が、実装上は「ヘルパ 2 本 / 症状 3 つ」だったことを、勝手に丸めず §3-3・設計伝達レポート §2-1・progress-log 横断課題 2 の 3 か所へ書いている。**黙って 3 つ直すことも、`ComboSetupExistsTx` だけ直して整合を崩すこともせず、直したうえで差分を申告する**という扱いが正しい。
5. **`M23-01` の撤去を守る仕掛けを、自分の spec の中に置いた。** 「コンボ表は 7 列のまま」という否定形テストを `m23-02` の spec に足したのは、**次に同じ画面へ配線する担当が最初に踏む場所**であり、巻き戻りの検出点として適切。
6. **前チェックを Tx 内へ置き、コンボ側に揃えなかったことを揃えなかったと報告した**（完了報告 §9）。`M23-RESEARCH-01` §D-6 の実測を根拠にしており、**「新しい経路に既存の欠陥を写さない」判断として妥当。** 揃えなかった点を隠さず、コンボ側の是正は followup 候補へ回した線引きも正しい。
7. **指示書 v1.3.0 がリポジトリに入っていない事実を、完了報告・設計伝達レポート・progress-log の 3 か所へ書いた。** 取り込みが開発者・設計卓の手番として残ることと、**未取り込みのまま次の担当が `docs/instructions/` を開くと §4.1-6 / §4.2-8 / §4.5-5 が存在しない v1.2.0 を読むことになる**という影響まで書いてある。この種の申し送りは落ちやすい。

---

## 制約事項

- 本レビューはコード上で判定可能な範囲のみ対象。実際の動作確認・パフォーマンス・実機テストは別途実施が必要。
- 本レビューで実行したのは読み取り系のみ（`git diff` / `git log` / `go build` / `go vet` / `go test`（該当 4 パッケージ・キャッシュ済み ok）／ `check-browser-storage-keys.sh` / `check-enum-sync.sh` / `check-md-emphasis.sh` / `check-doc-refs.sh` / `check-progress-log-index.sh` — **いずれも緑**）。`pnpm test` / `make e2e` は再実行していないため、完了報告の件数（171 files・1682 tests ／ 158 passed）は**報告の記載を採った**。
- 対象指示書・チェックリストは**リポジトリ内に存在しない v1.3.0 の実体**を正本として読んだ（リポジトリ内は v1.2.0）。**したがって本レビューの判定は v1.3.0 基準である**——とくに §4.1-6（2 か所の是正）を「報告せずに塞いだ」とは判定していない（v1.2.0 基準ならその逆になる）。
- **不明: `model.ComboRef` の `memo` を「名前」に充てる件の「開発者確認済み・2026-08-20」の実在について判断できない。** 追跡可能な記録（裁定 ID・`progress-log` の行）を検索範囲内に見つけられなかったため、「無い」ではなく「確認できない」と報告する。

---

*以上、M23-02 レビュー報告書。配置 `docs/progress/m23-02-review.md`。*

---

## 取り込み結果（自動トリアージ）

**2026-08-20 ／ `implement_plan_full` Phase C。** **★「高」の不採用はゼロ**のため開発者エスカレーションは発生していない。

| 指摘 | 採否 | 理由・対応 |
|---|---|---|
| **高-1** 失効コメントの残存 ＋ 完了報告の食い違い | **採用** | **2 段とも直した。** (1) `web/e2e/m22-03-optimistic-locking.spec.ts:20-30` を現状へ書き換え（`DELETE /api/setups/:id/permanent` が入り前提が失効したこと、本 spec は後始末を足していないこと、物理削除まで行う実例が `m23-02-setup-restore.spec.ts` の `afterEach` にあることを明記）。同 `:77` の派生注記も追随。(2) **完了報告 §13-3 に訂正を明記した**——初回 commit 群に当該ファイルの差分が無く、走査で検出しながら手当てが落ちていた。**★指摘のとおり、報告と実物の食い違いは設計卓が実装ソースを読めない以上そのまま前提として複製される。** |
| **中-1** `combo_setup_results` の残存を主張するテストが無い | **採用** | `TestService_DeleteSetup_KeepsComboSetupsWhenShared` へ 2 アサーション追加（論理削除前に 1 セル書き、論理削除後も 1 行残ること）＋ ヘルパ `countResultsBySetup`。**★破壊確認済み**——`DeleteComboSetupsBySetupID` の呼び出しを戻すと `--- FAIL ... 論理削除後の紐付け数 = 0, want 2` で赤くなる。**指摘のとおり `combo_setups` と非対称だった。** |
| **中-2** 引き継ぎオプションがゴミ箱の紐付けを黙って落とす | **採用（報告のみ）** | 指摘自身が「塞ぐことは求めない（`M23-06` / `M23-05` の面）」としており同意。**完了報告 §7-B-1 として新設**し、設計伝達レポート §4-6 の followup 候補へも挙げた。**退行ではないが、本サブの看板が利用者に見えない条件で成立しなくなるケースである**という指摘の整理をそのまま採った。 |
| **中-3** 復元が VAL-S04 重複を再導入しうる | **採用（報告のみ）** | 塞ぐのは `M23-04` / `M23-05`（指示書 §10 が名指し）。**ただし「この状態は本サブ以前には作れなかった」という指摘が正しい**——復元の経路を作ったのは本サブである。**完了報告 §7-B-2 として新設**し、followup 候補へ。 |
| **中-4** `ComboRef.Memo` の「開発者確認済み」表記 | **採用** | **裁定 ID が無いのに確定であるかのように書いていた。** 実際は「`{id, memo}` の形を開発者が承認した」ことと「`memo` を名前に充てる読み替えは製造の判断」が混ざっていた。**`// ★推測:` へ改め、両者を分けて書いた**（`internal/model/setup.go`）。 |
| **中-5** `defaultRecipe` フォールバックが到達不能 | **採用（コメント ＋ 報告）** | **見せ方の作り込みは `M23-06`** のため分岐は残し、**到達しない理由をコメントに明記**（`recipe_cache` を論理削除時に物理削除しているため常に空）。**完了報告 §7-B-3 として既知の制約に追加。** |
| **低-1** `err2` という変数名 | **採用** | 既存の `err` を再利用する形へ整理（`internal/api/setup/handler.go`）。 |
| **低-2** 新規コンポーネントのハードコード日本語 | **一部採用** | **自分が新設した `TrashSetupDeleteConfirm.tsx` の 4 文字列は i18n 化した**（`trash.setup.confirm*` を ja / en 両方へ追加）。**同じ diff の中で i18n 名前空間を作りながら別の新規ファイルはベタ書き、という不整合を自分で持ち込んでいたため。** **`TrashPage.tsx:74` の「読み込み中...」は据え置き**——同ファイルの既存コード（コンボ側の同じ文言）が全てベタ書きであり、片方だけ変えると足並みが崩れる。**ゴミ箱画面全体の i18n 化は `M23-06` の面である**（指摘自身も「急がない」としている）。 |
| **低-3** `characterID == nil` 分岐が到達不能 | **採用** | 到達しない理由（ハンドラが `characterId` を必須にしている）と、署名を揃えるため残していること・テストからは全件取得として使うことをコメントに明記。 |

### 取り込み後の再検証

```
go test ./...                → 53 packages ok / FAIL 0
cd web && pnpm test          → 171 files / 1682 tests passed
make e2e                     → 158 passed
cd web && pnpm lint (tsc)    → exit 0・出力なし
gofmt -l internal/ / go vet  → 出力なし
```

**★往復は 1 回で収束した**（再レビュー上限 2 回に対して 1 回）。**未解消のまま停止した項目は無いため、`followup-backlog.md` §J への転記は発生していない。**
**★後続サブへ送る 3 件（中-2 / 中-3 / 中-5）は「未解消」ではなく「担当面が違うため送る」ものであり、完了報告 §7-B と設計伝達レポート §4-6 に行き先を明記してある。**
