# M23-03 レビュー報告書

| 項目 | 内容 |
|------|------|
| 対象作業 | **M23-03**（参照側の `deleted_at` 除外の穴を 1 件ずつ塞ぐ ＋ 削除・復元の契約を as-built で固定する） |
| 対象指示書 | `docs/instructions/M23-03-reference-side-exclusion-and-delete-contract.md` v1.0.0 |
| 対象チェックリスト | `docs/instructions/reviews/M23-03-review-checklist.md` v1.0.0 |
| 対象コミット | `2fc0faa` / `65505fb` / `0967b02` / `d184ff2`（ベース＝`7b1899a`） |
| 差分規模 | 17 ファイル / +1744 −33 |
| レビュー実施日 | 2026-08-22 |
| 判定 | **条件付き合格**（§9 重大 **0 件**。高 1 件は文書側の 1 行追記で解消する） |

---

## 総評

**最重要ゲート（6 か所を一律に扱っていないこと）は完全に満たされている。** `#1` は述語を足さず理由を 2 つともコメントに残し、`#2`/`#3`/`#4`/`#5` は塞ぎ、`#6` は表示用 `FindLiveComboIDsBySetupID(s)` と検証用 `FindComboIDsBySetupIDAllowDeleted` へ分割して呼び出し側 7 か所を全数割り当てている。旧名は 1 つも残っていない（実査で確認）。とくに **6 件すべてについて是正を戻して赤を確認した破壊確認**は、この種の「述語を足す」作業でいちばん抜けやすい部分を潰しており、`#1` を塞ぐと `TestService_PermanentDelete_OK` だけが赤くなるという実測は指示書 §4.1-2 の主張をそのまま裏付けている。

**設計伝達の質も高い。** `#3` の裁定理由が指示書 §4.3-2 の前提と食い違っていたことを、裁定は変えずに理由だけ差し替えたうえで設計伝達レポート §2-1・progress-log §横断課題 1 の両方へ出している。`#6` の呼び元が調査時点の 5 から着手時点の 7 へ増えていたことの検出も、`architecture-patterns` §11 の注記どおりの動きである。

**指摘は 1 件だけ「高」に置いた。** `#3` の失効した帰結（「ゴミ箱のコンボが採用済みを主張し続ける」）が `docs/instructions/M23-overview.md` §4.9 の表にそのまま残っており、**設計伝達レポートは `CHANGE-123`／`DES-002` しか訂正先に挙げていない。** M23-04〜06 が読む正本は overview の表のほうであり、このままだと失効した帰結が次のサブの前提として複製される。**製造が overview を直すことはできないが、訂正先として名指しすることはできる**（設計伝達レポート §4 は製造の管理下にある）。

コードそのものに機能的な欠陥は見つからなかった。**レビュー側で `TestM2303` 12 本・`TestService_PermanentDelete_*` 3 本・`internal/service/notation` 全体・`go vet ./internal/...` を再実行し、いずれも緑であることを確認済み。**

---

## 設計準拠性レビュー結果

### §1 設計・パターンとの照合（最重要）— **◎**

**チェックリスト §1 の 10 項目を 1 件ずつ突き合わせた。**

| # | 項目 | 判定 | 実査した内容 |
|---|---|---|---|
| 1 | 6 か所が §1.2 の裁定どおり | **◎** | 下表で 1 件ずつ確認（一括判定していない） |
| 2 | `#1` に述語が足されていない | **◎** | `internal/repository/combo/repository.go` `selectComboByIDAllowDeletedSQL` は `WHERE id = ?` のまま。`git diff` でも SQL 本体に差分なし |
| 3 | `#1` のコメントに残す理由が 2 つとも | **◎** | 同 `:415-430`。(1) 完全削除の前チェック ／ (2) followup `trash-row-click-404` の道具、の両方を明記。**「塞いだ瞬間に壊れるのは完全削除であり通常操作のテストには出ない」まで書いてある**（§4.1-2 の要求を超えている） |
| 4 | `#2` と `#5` の**両方**に述語 | **◎** | `combo/repository.go:1372`（`AND deleted_at IS NULL`）／ `setup/repository.go:519`（同）。**片方だけではない**。互いを名指しして「片方だけ塞がないこと」と書いてある |
| 5 | `#3` に述語 | **◎** | `punish/queries.go:58-63`（`AND c.deleted_at IS NULL`） |
| 6 | `#4` の**親側**にも述語 | **◎** | 同 `:74-80`（`AND base.deleted_at IS NULL` ＋ 既存の `child.deleted_at IS NULL`） |
| 7 | `#4` のインタフェースコメントを**書き直し**（消しただけでない） | **◎** | `punish/repository.go:138-141`。「論理削除済みの生成物だけを除外する」→「論理削除済みは基底・生成物の両側を除外する（以前は生成物だけを除外していた）」。**旧の姿を 1 行残しているのが良い** |
| 8 | `#6` が 2 つに分かれ、表示用は除外・検証用は母集団維持 | **◎** | 検証用 `FindComboIDsBySetupIDAllowDeleted` の SQL は逐語で従前どおり（`SELECT combo_id FROM combo_setups WHERE setup_id = ? ORDER BY combo_id`）。**1 文字も緩めていない** |
| 9 | 呼び出し側が全数割り当て | **◎** | 実査 7 か所（検証 1 ／ 表示 6）。**旧名 `FindComboIDsBySetupID(s)` の残存は 0 件**（`grep` 実行済み。ヒットは `repository.go:387` の経緯コメントのみ）。判別不能な呼び元 0 |
| 10 | 分割後の名前から役割が読める | **○** | `Live` / `AllowDeleted` はいずれも既存の流儀（`FindLiveReferencingCombos` / `FindByIDAllowDeleted`）に乗っており読める。**接頭辞が揃わないため並び順で対にならない**点だけ後述（低-3） |

**6 か所の裁定突き合わせ（1 件ずつ）**

| # | 裁定（指示書 §1.2） | 実装 | 判定 |
|---|---|---|---|
| 1 | **塞がない** | SQL 無変更 ＋ 理由コメント 2 か所 | **◎** |
| 2 | 塞ぐ | `combos.GetRecipeCache` に `AND deleted_at IS NULL` | ◎ |
| 3 | 塞ぐ | `listAdoptedComboPunishesSQL` に `AND c.deleted_at IS NULL` | ◎ |
| 4 | 塞ぐ | `listMaterializedBaseComboIDsSQL` の `base` 側に述語 ＋ コメント書き直し | ◎ |
| 5 | 塞ぐ | `setups.GetRecipeCache` に `AND deleted_at IS NULL` | ◎ |
| 6 | **関数を 2 つに分ける** | 表示 2 本（単数・複数）＋ 検証 1 本。呼び元 7 か所を割り当て | **◎** |

### §2 データ・API 契約・スキーマの不変 — **◎**

- **スキーマ変更なし・マイグレ 0 本。** `git diff HEAD~4 --name-only` に `migrations/` の行が 1 つも無い。`ls migrations/` 末尾は `000078` のままでボード §2.2 と整合。
- **`DELETE /api/combos/:id` の実装に差分なし。** `internal/service/combo/service.go` / `internal/api/combo/` はいずれも差分ゼロ。
- **完全削除の前チェックの位置を動かしていない**（`PermanentDelete` は `FindByIDAllowDeleted` → `BeginTx` の順のまま）。
- **`M23-01` / `M23-02` の成果に触れていない。** `CountComboSetupsByComboID` / `comboSetupExists` は差分なし（M23-02 が是正した 2 か所。**二重に触っていない**＝チェックリスト §7 最終項目）。`FindCandidateSetups` の除外副問い合わせ（M23-02 が「報告のみ」と裁定）も無変更。
- **`DES-002` 本体を製造が編集していない**（`docs/design/` に差分なし）。
- **`parentComboIds` が `null` に化けないことを実査した。** 表示用へ切り替えた 6 か所すべてで `comboIDsMap[setup.ID]` の直後に `if pComboIDs == nil { pComboIDs = []int64{} }` の既存ガードが効いており、**「親コンボが全部ゴミ箱にある生きたセットプレイ」でも空配列で返る**（`service.go:554/593/628/672`・`restore.go:166`・`api/setup/dto.go:186`）。設計伝達レポート §1-3 の「件数の下限（空配列で返す）は不変」は**実装で裏が取れている**。

### §3 フロントエンドの動作仕様 — **◎**

- **`web/src/` の差分は 0 バイト**（チェックリスト §0.3 N-8 のとおり、これは仕様）。
- `parentComboIds` を消費する本番コードを独立に走査し、**完了報告 §1-8 の 5 か所と一致**することを確認した（`useRestoreSetup` / `useDeleteSetup` / `useUpdateSetup` / `useLinkExistingSetupForm` / `SetupEditorPage`）。いずれも「無効化対象が生存コンボだけに狭まる」「編集中の生存コンボの id は不変」「不在は `?? null` で既に扱われている」であり、**壊れる経路は無い。**
- **`web/src` は API レスポンスを zod で検証していない**（zod の利用は `features/combo/schema.ts` のフォーム入力と `useTagFormDialog.ts` のみ）ため、集合が狭まったことでパースが落ちる経路も無い。
- §5-9 の E2E が「ゴミ箱へ入れると消える／復元で戻る」を対で確認しており、あわせて `/trash` 画面が壊れていないことも見ている。

### §4 テストの妥当性 — **○**

| §5 | 要求 | 実装 | 判定 |
|---|---|---|---|
| 1 | `#1` が削除済み行を返し続ける（否定形・実 DB） | `TestM2303_FindByIDAllowDeleted_StillReturnsSoftDeletedRow`。**対照として `FindByID` が `ErrNotFound` になることまで見ている** | ◎ |
| 2 | 完全削除がこれまでどおり動く | **既存 `TestService_PermanentDelete_OK` / `_NotFound` / `_NotInTrash` の流用**（新規追加なし） | **△**（中-1） |
| 3 | `#2` / `#5` が削除済み行を返さない（**2 本**） | `TestM2303_GetRecipeCache_ExcludesSoftDeletedCombo` ／ `TestM2303_SetupGetRecipeCache_ExcludesSoftDeletedSetup`。**片方だけではない** | ◎ |
| 4 | 数えない ／ 復元で数える（**対**） | `TestM2303_ListAdoptedComboPunishes_ExcludesTrashedComboAndReturnsOnRestore`（述語）＋ `TestM2303_Scan_TrashedComboIsNotCountedAsAdopted_AndReturnsOnRestore`（応答）。**削除後に `combo_punishes` の行が残っている前提までアサートしている** | ◎ |
| 5 | `#4` を塞いでも結果が変わらない | `TestM2303_Scan_MaterializedFlagUnchangedByBasePredicate`。**破壊確認で「述語を外しても緑のまま」を実測**しており、「変わらない」の主張が成立している（N-4 のとおり赤ではない＝期待どおり） | ◎ |
| 6 | **表示用**が削除済みコンボを返さない | `TestM2303_FindComboIDs_LiveExcludes_AllowDeletedKeeps` 前半 ＋ `TestM2303_GetSetup_ParentComboIDsExcludesTrashedCombo` ＋ `TestM2303_FindLiveComboIDsBySetupIDs_ExcludesSoftDeletedCombo` | ◎ |
| 7 | **検証用**が削除済みコンボを返し続ける | 同テスト後半（**1 本の中で対にしてある**） | ◎ |
| 8 | 検証を緩めていない | `TestM2303_UpdateSetup_StillRejectsDuplicateInsideTrashedCombo`（VAL-S04 のコードまで確認）＋ 対照 `_AllowsNonDuplicateInsideTrashedCombo`（**「常に拒否」に化けていないこと**） | ◎ |
| 9 | E2E | `web/e2e/m23-03-reference-exclusion.spec.ts`（2 本） | ◎ |

- **★チェックリスト §9 の重大条件「§5-6 と §5-7 が両方在ること」は満たされている。** しかも同一テスト関数の中で対にしてあり、片方だけが将来消えることが構造的に起きにくい。**§5-8（緩めていないこと）も独立に在る。**
- **テスト結果の書き方は E-125 に適合。** 完了報告 §5-1 はスイート名と `ok` 行、§5-2 は `--- PASS` 行を貼っている。**キャッシュが効いていないことの証拠**（`-count=1` の 2m44s と cached の 0.39s の対比・「終了コードはどちらも 0」の明示）も在る。`make e2e` は「160 passed」で実行済みと書かれており、「実行しなかった」ケースではない。
- **レビュー側で再実行して裏を取った**——`TestM2303` 12 本（5 パッケージ）／ `TestService_PermanentDelete_*` 3 本 ／ `internal/service/notation` 全体 ／ `go vet ./internal/...` すべて緑。

### §5 設計意図との整合 — **◎**

- **「参照側の穴は全部塞いだ」の記述は本番コード・テスト・完了報告・設計伝達レポートのいずれにも無い**（`全部塞|すべて塞|全て塞|穴は無くなった|穴を全部` で再走査。0 件）。逆に完了報告 §12-5 が「**6 か所のうち 1 か所を意図的に残した**」と明示している。**チェックリスト §9 の該当なし。**
- **検証側の母集団を緩めていない。** `M23-05` へ渡す衝突を増やしていない（§4.5-5）。
- **`M23-04` / `M23-05` / `M23-06` へ踏み込んでいない。** 踏み込みたくなった 4 件を完了報告 §9 に列挙して留めている（前チェックの Tx 移動・`deleted_at` 上書き・論理削除 `WHERE` の統一・未使用経路の撤去）。**いずれも正しく手を出していない。**
- `FR013` に触れていない。

### §6 コード品質・規約遵守 — **○**

- 新設 3 関数のエラーはすべて `fmt.Errorf("…: %w", err)` で wrap（`CLAUDE.md` §4）。
- `console.log` / `fmt.Println` の混入なし（差分走査で 0 件）。
- `gofmt -l internal/` 0 件・`go vet ./internal/...` 0 件（レビュー側で再実行）。
- `bash scripts/check-enum-sync.sh`（ベースラインどおり）／ `bash scripts/check-browser-storage-keys.sh`（違反なし）をレビュー側でも実行して一致を確認。
- `// 推測:` コメントは無いが、**§9.2 が「推測で進めてよい」と列挙した 4 件しか該当が無く、採否は完了報告 §10 に記録されている**ため規約違反ではない。
- 曖昧語依存なし。マジックストリングの新設なし。
- 減点は後述の低-1〜低-4（テストコードの体裁）。

### §7 既存挙動の温存 — **◎**

- **完全削除が動く**——`TestService_PermanentDelete_OK` をレビュー側で再実行して緑を確認。
- **確定反撃サーチが壊れていない**——`materialize` の副作用との衝突は起きない。実査で `ListAdoptedComboPunishes` / `ListMaterializedBaseComboIDs` の**本番呼び元がそれぞれ `internal/service/punishfinder/service.go:306` / `:314` の 1 か所のみ**であること、いずれも `s.combos.List`（既定で `deleted_at IS NULL`）で並べた生存コンボにしか引かれないことを独立に確認した（`service.go:295-333`）。**⇒ 完了報告 §1-4 / §1-5 の主張は正しい。**
- **レシピ文字列の表示が壊れていない**——`#2` の唯一の到達路 `GET /api/combos/:id/recipe` は、`handler.go:471-477` の `h.service.Get` が削除済みを 404 で先に弾くため `ErrNotFound` に到達しない。`#5` は `ResolveSetupRecipe` に本番呼び元が 0 件（レビュー側で再走査して確認）。**⇒ §3.3-6 の実査は正しい。**
- **セットプレイの編集・重複チェックが従前どおり**（`UpdateSetup` の VAL-S04 母集団は `AllowDeleted`）。
- **`M23-02` が是正した 2 か所を二重に触っていない。**

### §8 ドキュメント・進捗ログ — **◎**

- 完了報告に **Plan Mode 確定方式・変更点・テストケース数・既知の制約**が揃っている。§3.3 の実査 8 件も 1 件ずつ結果付き。
- **指示書 §7.5 が求める 4 件がすべて独立した節に在る**——(1) 契約 4 件＝§7-1〜§7-4（逐語 SQL 付き）／ (2) 分割後の 2 関数と割り当て表＝§3-1・§3-2 ／ (3) `#1` を塞がなかったこととコメント箇所＝§4 ／ (4) §4.9-3 の走査結果＝§6-3。**チェックリスト §9 の「1 件でも欠けていたら重大」に該当しない。**
- **API 契約の as-built が独立した節に在る**（設計伝達レポート §1-3。D-496）。経路追加が無いことと、`parentComboIds` の意味だけが変わったことを分けて書いている。
- **「■ 併せて更新が要るもの」の節が在り、該当なしの項目も「不要」と明記**（E-114 / D-277）。`CHANGE-123` 消費・マイグレ 0 本も書かれている。
- **「並列相手は無い」が §15 に明記**（E-121）。
- **`followup-backlog.md` を製造が編集していない**（差分なし）。更新候補 6 件は設計伝達レポート §4 に置かれている（D-382）。
- `progress-log.md` の索引行が追記済み。`bash scripts/check-progress-log-index.sh` 違反なし（レビュー側で実行）。`bash scripts/check-doc-refs.sh` / `check-md-emphasis.sh` もベースラインどおり。

---

## 設計準拠性以外の指摘事項

### 1. 【高】`#3` の失効した帰結が `M23-overview` §4.9 に残ったままで、訂正先として名指しされていない

**実装後の事実**（完了報告 §1-5 ／ 設計伝達レポート §2-1）:

> `listAdoptedComboPunishesSQL` の本番呼び元は 1 か所で、そこで作る `adoptedSet` を引くのは生存コンボだけ。**⇒ ゴミ箱のコンボが「採用済み」を主張する場所はそもそも無かった。**

**ところが `docs/instructions/M23-overview.md` §4.9 の表（`#3` 行）は今も次のように書いてある。**

> **⇒ ゴミ箱のコンボが採用済みを主張し続ける**

**指示書 §4.3-2 も同じ文面である。** 設計伝達レポート §2-1 は「`CHANGE-123` へ写すとき、`#3` の理由を『利用者に誤った状態が見える』と書くと as-built と食い違う」とだけ書いており、**訂正先として `DES-002` しか挙げていない。§4（followup / ボードの更新候補）にも overview の訂正は入っていない。**

**なぜ「高」か。**

- **`M23-overview` §4.9 は M23-04 / M23-05 / M23-06 が読む正本である。** `CHANGE-123` が `DES-002` を直しても、overview の表は残る。
- **動作は正しいままなので、テストも lint も型検査も緑になる。** 人が読む以外に見つける経路が無い。
- **後任は本文をコピーし、注記を読まない。** 「ゴミ箱のコンボが採用済みを主張し続ける」を前提に次のサブが判断を組み立てると、`#3` は「段 2（利用者に誤った状態が見える）」の事例として引用され続ける（実際には「段 4」だった）。**M19-DESIGN-08 §3.1 の D-250 と同型。**

**修正案（製造の手番で閉じる）**——**overview 本体は設計卓の管理下なので触らないこと。** 設計伝達レポート `docs/handover/design-reports/20260822-m23-03-design-exceptions.md` §4 に 1 行足すだけでよい。

> | 7 | **`docs/instructions/M23-overview.md` §4.9 の `#3` 行** | **「⇒ ゴミ箱のコンボが採用済みを主張し続ける」は as-built では成立しない**（完了報告 §1-5）。**`DES-002` だけでなく overview の表も訂正しないと、M23-04〜06 が失効した帰結を前提に読む。** 訂正は設計卓の手番 |

**あわせて §2-1 の末尾に「訂正が要るのは `CHANGE-123` / `DES-002` だけではない」と 1 行足すこと**を推奨する。

### 2. 【中】§5-2（完全削除がこれまでどおり動く）が既存テストの流用で、コード側に対の記録が無い

- §5-1 の否定形テスト（`internal/repository/combo/m23_03_reference_exclusion_test.go`）と、§5-2 を担う `internal/service/combo/service_test.go:1152` `TestService_PermanentDelete_OK` は**別ファイル・別パッケージにあり、両者が対であることはコードのどこにも書かれていない。**
- 対であるという知識は**完了報告 §5-2 の表と §5-3 の破壊確認にしか無い。** 完了報告は次のサブが必ず読むものではない。
- **リスクは具体的**——`TestService_PermanentDelete_OK` が将来リファクタで別の観測（モック等）に置き換えられると、**「`#1` を塞ぐと完全削除が壊れる」ことを検出する唯一の実 DB テストが静かに消える。** そのとき §5-1 は緑のまま通り続けるため、失われたことに気づけない。
- **修正案**: `internal/repository/combo/m23_03_reference_exclusion_test.go` の `TestM2303_FindByIDAllowDeleted_StillReturnsSoftDeletedRow` の直上に 1 行足す。

  ```go
  // ★対になるのは internal/service/combo/service_test.go の TestService_PermanentDelete_OK
  //   (M23-03 §5-2)。#1 に述語を足すと本テストと併せてその 2 本だけが赤くなる。
  //   向こうを差し替えるときは、この対が失われないことを確認すること。
  ```

  逆側（`TestService_PermanentDelete_OK` の直上）にも同趣旨を置ければなお良いが、**そちらは `M23-01` 期からある既存テストであり、本サブの「既存に触れない」方針とどちらを優先するかは開発者判断**。片側だけでも対の存在は追える。

### 3. 【中】`parentComboIds` の値域が変わったのに、露出点（DTO・サービス応答型）に注記が無い

- 本サブで **`parentComboIds` の意味が「紐付く全コンボ」から「紐付く生存コンボ」へ変わった**（設計伝達レポート §1-3 が API 契約の as-built として明記している）。
- **ところがコード側でその事実が読めるのはリポジトリ層だけである。** 露出点には注記が無い:
  - `internal/api/setup/dto.go:89`（`SetupResponse.ParentComboIDs`）
  - 同 `:111`（`SetupCandidateSummary.ParentComboIDs`）
  - `internal/api/combo/dto.go:185`（`SetupSummary.ParentComboIds`）
  - `internal/service/setup/service.go:54`（`SetupResponse.ParentComboIDs`）
- **同じ構造体のすぐ隣にある `DeletedAt`（`dto.go:83-86`）は、M23-02 が 3 行の注記を付けている。** 本プロジェクトの流儀としては注記が付く場所である。
- **これは「旧の記述が残っている」型ではなく「記述が無い」型**なので高には置かないが、実害の向きは同じ——**次に `parentComboIds` を使う担当が「紐付き全部が返る」と読んで判定に使う**と、`#6` の分割で守ったはずの「判定は復元されうるものも含む」が DTO 経由で破れる。
- **修正案**: 4 か所（少なくとも `api/setup/dto.go:89` と `service/setup/service.go:54`）に 1〜2 行。

  ```go
  // ParentComboIDs は「このセットプレイが使われている**生存**コンボ」の id。
  // ★論理削除済みのコンボは載らない(M23-03 §4.5)。判定の母集団には使えない——
  //   検証は repository/setup.FindComboIDsBySetupIDAllowDeleted 側を使うこと。
  ```

### 4. 【中】`#3` / `#4` のコメントが「呼び元は 1 か所」という現在の事実に依存した断定になっている

- `internal/repository/punish/queries.go:52-57`（`#3`）と `:69-73`（`#4`）は、**「唯一の呼び元（`service/punishfinder.Scan`）が生存コンボにしか引かないため実挙動は変わらない」** と断定形で書いてある。
- **今日は正しい。** レビュー側でも呼び元が 1 か所ずつであることを確認した。**しかし呼び元が 2 つめになった瞬間、この一文は誰にも気づかれずに偽になる。**
- 皮肉なことに、**設計伝達レポート §4-1 が「将来 `ListAdoptedComboPunishes` の呼び元が増えたとき、この述語が初めて効く」と自分で書いている。** つまり陳腐化することが分かっている記述である。
- **修正案**: 断定を条件付きに変える（1 語ずつの修正で足りる）。

  ```
  - ★実挙動は変わらない——本 SQL の唯一の呼び元(service/punishfinder.Scan)は…
  + ★2026-08-22 時点では実挙動は変わらない——このときの唯一の呼び元
  +   (service/punishfinder.Scan)は…。★呼び元を足すときは、この前提が
  +   まだ成り立つかを数え直すこと(成り立たなくなったら、この述語が初めて効く)。
  ```

### 5. 【低】分割後の 2 関数の接頭辞が揃わず、並びで対にならない

- `FindLiveComboIDsBySetupID` と `FindComboIDsBySetupIDAllowDeleted` は、**godoc・エディタの補完・インタフェース宣言のいずれでも隣り合わない**（`FindC…` と `FindL…`）。実際にインタフェース宣言では隣接しているが、これは手で並べた結果であり、実装側（`repository.go:391` と `:423`）も手で隣接させている。
- **チェックリスト §10 が「名前の語の選び方は軽微。役割が読み取れていれば足りる」と明記しているため指摘は低に置く。** 役割は読み取れており、既存の流儀（`FindLiveReferencingCombos` / `FindByIDAllowDeleted`）にも乗っている。
- 参考案としては `FindComboIDsBySetupIDLive` / `FindComboIDsBySetupIDAllowDeleted` なら接頭辞が揃う。**ただし既に呼び元 7 か所とテストが確定しているので、今から変える価値は低い。**

### 6. 【低】表示用と検証用で行スキャンのループが逐語で重複している

- `internal/repository/setup/repository.go:391-412` と `:423-444` は、SQL 文字列とエラーメッセージ以外が同一である。
- **統合してはならない**（§4.5-4 ／ N-3）が、**SQL を引数に取る非公開ヘルパ（例 `scanComboIDs(ctx, query, setupID)`）へ寄せれば、公開関数は 2 本のまま重複だけ消せる。**
- 現状のままでも害は無く、**むしろ「2 つは別物」が目に見えるという利点もある**ため、低に置く。

### 7. 【低】テストコードの体裁 2 件

- `internal/service/setup/m23_03_reference_exclusion_test.go:140` の `_ = respA` — `respA` を使わないなら `_, resA, err := …` で受ければ足りる。**破棄変数はレビュー時に「使い忘れでは」と疑わせる。**
- `web/e2e/m23-03-reference-exclusion.spec.ts:104` — 1 本目のテストは `/trash` 画面を一切開かないのに `expect(characterId, "ゴミ箱画面は character_id=1 固定").toBe(TRASH_CHARACTER_ID)` を置いている。**アサーションのメッセージがテストの内容と噛み合っていない。** 前提を固定したいなら「ryu が 1 であること」等、このテストが実際に依存している事実を書くか、2 本目へ移す。

### 8. 【低】`FindByIDAllowDeleted` の**公開**インタフェースコメントから用途の記述が消えた

- 変更前: `// 完全削除(PermanentDelete)の前チェック用。`
- 変更後: `// ★deleted_at の述語を持たないのは意図である(M23-03 §4.1)。理由は selectComboByIDAllowDeletedSQL の直上に書いてある。塞がないこと。`
- **理由 2 つは非公開定数 `selectComboByIDAllowDeletedSQL` の直上にあり、`go doc` からは見えない。** 指示書 §4.1-3 の要求（両方をコメントに書くこと）はコードベース上は満たしているが、**公開ドキュメントとしては「何のための関数か」が読めなくなった。**
- **修正案**: 1 行戻す。`// FindByIDAllowDeleted は論理削除済みコンボも含めて指定 ID を返す。完全削除の前チェックと、ゴミ箱の行からの読み取り専用詳細(followup trash-row-click-404)が使う。` を足したうえで「塞がないこと」を残す。

---

## 推奨修正（優先度別）

### 高（M23 完了前に修正必須）

1. **設計伝達レポート §4 に「`docs/instructions/M23-overview.md` §4.9 の `#3` 行の帰結列も as-built と食い違う」を 1 行追加する**（指摘 1）。**overview 本体は設計卓の手番なので触らないこと。** あわせて §2-1 の末尾に「訂正が要るのは `CHANGE-123` / `DES-002` だけではない」と補う。**失効した帰結が M23-04〜06 の前提として複製されるのを止めるのが目的である。**

### 中（M24 着手と並行可）

2. **§5-1 のテストに、対になる `TestService_PermanentDelete_OK` を名指しするコメントを 1 行足す**（指摘 2）。対の存在がコードから追えるようにする。
3. **`parentComboIds` の値域注記を露出点へ足す**（指摘 3）。最低でも `internal/api/setup/dto.go:89` と `internal/service/setup/service.go:54` の 2 か所。**「判定には使えない」まで書くこと。**
4. **`#3` / `#4` のコメントの断定を条件付きへ直す**（指摘 4）。「唯一の呼び元」は時点付きの事実として書き、呼び元を足す担当への指示を 1 行添える。

### 低（将来対応）

5. 行スキャンの重複を非公開ヘルパへ寄せる（指摘 6）。**公開関数は 2 本のまま。**
6. `_ = respA` の除去と、E2E 1 本目のアサーションメッセージの是正（指摘 7）。
7. `FindByIDAllowDeleted` の公開コメントへ用途の 1 行を戻す（指摘 8）。
8. 分割後 2 関数の接頭辞（指摘 5）。**今から変える価値は低いため、次に同型の分割をするときの参考に留める。**

---

## 良かった点

1. **★破壊確認を 6 件すべてで行った**（完了報告 §5-3）。「通るだけのテスト」は歯止めにならないという原則を、is-a ではなく実測で示している。**とくに「`#1` に述語を足すと `TestService_PermanentDelete_OK` だけが赤くなり、他は全部緑のまま通る」は、指示書 §4.1-2 が言葉で書いていた危険を数字で確定させた。** この 1 行があるだけで、次の担当が `#1` を塞ぐ確率は大きく下がる。
2. **★`#3` の前提が指示書と食い違ったときの扱いが正しい。** 裁定（塞ぐ）は変えず、理由だけを差し替え、**食い違いを設計伝達レポート §2-1・progress-log §横断課題 1 の両方へ出した。** 停止条件が `#4` にしか置かれていないことまで確認したうえで「進めて報告する」を選んでおり、`CLAUDE.md` §9 の適用として教科書どおりである。
3. **★`#6` の対のテストを 1 本の関数の中に置いた**（`TestM2303_FindComboIDs_LiveExcludes_AllowDeletedKeeps`）。§5-6 と §5-7 が物理的に分離できないため、**将来片方だけが消える事故が構造的に起きない。** 「対で書け」という要求への応え方として最も強い形である。
4. **★`#6` の呼び元が 5 → 7 に増えていたことを検出し、増分の出どころ（`M23-02` の `ListDeletedSetups` 新設）まで特定した。** `architecture-patterns` §11 の「呼び元の数も先に数えること」がそのまま当たった 2 例目であり、**同節への追記候補として設計卓へ返している**のも正しい経路。
5. **★検証用関数の godoc が「なぜ緩いのか」を破れ方まで含めて書いている**（`repository.go:414-422`）。「ゴミ箱へ入れる → 同じレシピを作る → 復元する」「DB 制約が無いため誰も気づかない」まで書いてあるので、**後任が「述語の書き漏らし」と読んで塞ぐ余地がほぼ無い。** `#1` のコメントも同様で、**本サブの成果のうち最も寿命が長いのはこの 2 つのコメントだと思われる。**
6. **★既存テストが壊れた理由の扱いが丁寧。** `TestDeleteComboCache_NullifiesCache` は「主張は変えず観測手段だけ変える」という最小の直し方をしたうえで、**対で M23-03 の新挙動（削除済みは `ErrNotFound`）も固定している。** さらに「述語を足す変更は、その関数を観測器として使っているテストを壊しうる」という一般化を progress-log §横断課題 5 へ残しており、**次に同型の作業をする担当が同じ驚き方をしなくて済む。**
7. **フロント差分 0 を「調べずに 0」ではなく「消費箇所 5 か所を全部当たって 0」で出している**（完了報告 §1-8）。レビュー側で独立に走査しても 5 か所で一致した。

---

## 制約事項

- 本レビューはコード上で判定可能な範囲のみ対象。実際の動作確認・パフォーマンス・実機テストは別途実施が必要。
- レビュー側で再実行したのは `go test ./internal/{repository/combo,repository/setup,repository/punish,service/punishfinder,service/setup} -run TestM2303 -count=1`（5 パッケージ緑）／ `go test ./internal/service/combo/ -run PermanentDelete -count=1 -v`（4 本 PASS）／ `go test ./internal/service/notation/ -count=1`（緑）／ `go vet ./internal/...`（0 件）／ `scripts/check-{enum-sync,browser-storage-keys,progress-log-index,doc-refs,md-emphasis,doc-inventory}.sh`。**`go test ./...` 全体・`pnpm test`・`make e2e` はレビューでは再実行していない**（完了報告 §5 の貼付出力を根拠として受け入れた）。
- `make e2e` の 2 本が実際に緑であることはレビューでは未検証。**ただし spec の内容（id の在・不在だけを見る／`afterEach` で作成行を落とす／`fullyParallel: false`）を読み、件数を絶対値で数える既存 spec と衝突する形になっていないことは確認した。**
- **不明: `docs/instructions/M23-overview.md` §4.9 の `#3` 行を誰がいつ訂正するかについては判断できない**（設計卓の手番であり、`CHANGE-123` の適用範囲に含まれるか否かは本レビューからは読み取れない）。指摘 1 は「訂正先として名指しすること」までを製造の手番として求めるものであり、訂正そのものを求めていない。

---

## 取り込み結果（自動トリアージ）

`/implement_plan_full` Phase C。**採用 6 件 / 不採用 2 件（いずれも「低」）。** 「高」の不採用は 0 件のため、エスカレーションは発生していない。

### 採用（6 件）

| 指摘 | 優先度 | 対応 | 反映先 |
|---|---|---|---|
| **1** `#3` の失効した帰結が `M23-overview` §4.9 に残る／訂正先として名指しされていない | **高** | **採用。** 設計伝達レポート §4 へ **7 件目**として追加し、§2-1 の末尾にも「訂正が要るのは `CHANGE-123` / `DES-002` だけではない」を明記した。**overview 本体・指示書には触っていない**（設計卓の手番） | `docs/handover/design-reports/20260822-m23-03-design-exceptions.md` §2-1 / §4 |
| **2** §5-2 の対がコードから追えない | 中 | **採用。** `TestM2303_FindByIDAllowDeleted_StillReturnsSoftDeletedRow` の直上へ、対になる `TestService_PermanentDelete_OK` を名指しするコメントを追加。**逆側（既存テスト）には置いていない**——`§2.2-7` の「既存に触れない」を優先し、片側で対を追える形にした | `internal/repository/combo/m23_03_reference_exclusion_test.go` |
| **3** `parentComboIds` の値域変更が露出点に無い | 中 | **採用。** 指摘の 4 か所すべてに注記を追加（「生存コンボの id である／**判定の母集団には使えない**／検証は `FindComboIDsBySetupIDAllowDeleted` を使う」）。**`#6` の分割で守った不変条件が DTO 経由で破れるのを止めるのが目的** | `internal/api/setup/dto.go`（2 か所）／ `internal/api/combo/dto.go` ／ `internal/service/setup/service.go` |
| **4** `#3` / `#4` のコメントが「唯一の呼び元」に断定形で依存 | 中 | **採用。** 「2026-08-22 時点では」と時点を付し、**呼び元を足すときは前提が成り立つかを数え直すこと**を両方へ追記した | `internal/repository/punish/queries.go` |
| **7a** `_ = respA` | 低 | **採用。** `_, resA, err := …` で受ける形へ変更 | `internal/service/setup/m23_03_reference_exclusion_test.go` |
| **7b** E2E 1 本目のアサーションメッセージが内容と噛み合わない | 低 | **採用。** 1 本目からは削除し（`/trash` を開かないため）、**実際に画面を開く 2 本目へ移した**（理由コメント付き） | `web/e2e/m23-03-reference-exclusion.spec.ts` |
| **8** `FindByIDAllowDeleted` の公開 godoc から用途が消えた | 低 | **採用。** 用途 1 行（完全削除の前チェック ＋ followup `trash-row-click-404`）を戻したうえで「塞がないこと」を残した | `internal/repository/combo/repository.go` |

> 表は 7 行だが、指摘 7 を a / b の 2 件に分けて書いているため**採用は指摘単位で 6 件**である。

### 不採用（2 件・いずれも「低」）

| 指摘 | 優先度 | 不採用の理由 |
|---|---|---|
| **5** 分割後 2 関数の接頭辞が揃わない（`FindComboIDsBySetupIDLive` 案） | 低 | **レビュー自身が「今から変える価値は低い」と結論している。** 呼び元 7 か所とテスト 12 本が確定済みで、改名は差分を広げるだけで得るものが無い。現行名は**プロジェクトの既存の流儀 2 つに乗っている**（`Live` ＝ `M23-02` の `FindLiveReferencingCombos` ／ `AllowDeleted` ＝ `FindByIDAllowDeleted`）。チェックリスト §10 も「役割が読み取れていれば足りる」と定めており、役割は読み取れている。**⇒ 次に同型の分割をするときの参考として、本節に記録するに留める。** |
| **6** 表示用と検証用で行スキャンのループが重複 | 低 | **意図的に残す。** SQL を引数に取る非公開ヘルパへ寄せれば重複は消えるが、**「2 つは別物である」という見た目の手がかりが弱まる。** 本サブは「同じに見える 2 関数を統合させないこと」を最重要の不変条件としており（§4.5-4 ／ チェックリスト N-3）、**共通ヘルパは「片方に寄せられるのでは」という次の誘因を作る。** レビュー自身も「現状のままでも害は無く、むしろ利点もある」と併記している。**⇒ 重複 20 行のコストより、統合を誘発しない形を優先した。** |

### 再レビュー往復

**0 回**（初回レビューで重大 0 件。上限 2 回に達していない）。**未解消のまま停止した項目は無いため、`followup-backlog.md` §J への登録は発生していない。**

### 取り込み後の再検証

```
$ go test ./... -count=1     → ok 53 パッケージ / FAIL 0 / (cached) 0 / real 2m48.530s
$ make e2e                   → 160 passed (3.3m) / exit 0
$ gofmt -l internal/         → 0 件
$ go build ./...             → OK
$ pnpm exec tsc --noEmit -p e2e/tsconfig.json → OK
```
