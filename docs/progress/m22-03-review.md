# M22-03 レビュー報告書

| 項目 | 内容 |
|------|------|
| 対象指示書 | `docs/instructions/M22-03-optimistic-locking.md` v1.0.0 |
| 対象チェックリスト | `docs/instructions/reviews/M22-03-review-checklist.md` v1.0.0 |
| 対象完了報告 | `docs/progress/m22-03-completion-report.md` |
| 対象差分 | `1083332..HEAD`（5 コミット・12 ファイル） |
| レビュー実施日 | 2026-08-16 |
| 判定 | **条件付き合格** ——高 3 件を是正すれば完了承認可。重大（チェックリスト §9）は 0 件 |

## 総評

最重要ゲート 4 つはいずれも通っている。破壊確認 A / B が実際に回され、B が 1 回目に空振りしたことを隠さず記録し、期待値をリテラルへ変えて是正した点は本サブの最も価値ある成果である。是正の妥当性は独立に検証した——応答本文のコードを `model.*` 定数と突き合わせているテストは HEAD に 1 件も残っておらず、同型の空振りは他に無い。`conflict` の全数更新、`version: 0` の型による除去、線引きの「対象外」を塞いでいないことも、実装を直接読んで確認した。

一方で、完了報告の事実記述に 3 件の誤り・欠落がある。いずれも設計卓が `CHANGE-114` の反映に使う節（§1.5 / §2 / §10）にあり、そのまま `DES-002` へ写ると設計書に誤りが入る。動作は正しいまま・テストも lint も緑のままであるため、人が読む以外に見つける経路が無い型であり、優先度は高に置く。テスト側は §5.1-8 の網が代理でしか張られていない点が残る。

## 設計準拠性レビュー結果

### 1. 最重要ゲート 1 ——テストが「壊すと赤くなる」形か: ◎

| 検証項目 | 結果 |
|---|---|
| 3 経路のコード文字列まで固定 | ◎ `internal/api/combo/handler_test.go:806` `:960` ／ `internal/api/setup/handler_test.go:470` の 3 本が `wantVersionConflictCode` リテラルで固定。`M22-RESEARCH-01` A-5 の非対称（combos はステータスのみ）は解消 |
| 版が一致するときに通る | ◎ `TestHandler_UpdateMetadata_200_VersionMatches` ／ `TestHandler_UpdateWithKeyChange_201` ／ `TestHandler_UpdateSetup_200` の 3 本。加えて全 6 本が「受け取った version がサービス層まで届いている」ことを主張しており、ハンドラが version を落とす壊れ方も捕まる。当初の要求より強い |
| 破壊確認 A | ◎ 実施・赤（repository 2 本 ／ service 4 本 ／ E2E 3 本）。壊し方（プレースホルダ個数を保ったまま `AND ? IS NOT NULL` へ置換）も引数の個数を変えない筋の良い方法である |
| 赤にならなかった項目の扱い | ◎ ハンドラ層が緑のままだった理由を `mockService` の使用に特定し、ガードの位置と同じ層の契約テストを 3 段の表で提示している（`SUPP-001` §5.5 (10′)）。「テストを強くした」で済ませていない |
| 破壊確認 B | ◎ 実施・赤。下記の独立検証あり |
| 一意制約違反 409 との区別 | ◎ `TestErrorCode_AliasConflict_DistinctFromVersionConflict`（定数側）と既存 `TestHandler_Update_AliasConflict_NotInternalError`（`internal/api/preset/write_handler_test.go:303` が線上の `alias_conflict` をリテラルで固定）の 2 本で成立 |

**破壊確認 B の是正が妥当かの独立検証** ——妥当である。期待値に `model.ErrorCodeVersionConflict` を使うと、定数の値を変えたときに期待値も一緒に動くため、固定できるのは Go 内部の一貫性だけになる。リテラルへ変えたことで「線を流れる文字列」が固定された。

**同型の空振りが他に残っていないかの独立検証** ——残っていない。`Error.Code` ／ `errorCode()` の比較先を走査したところ、定数を参照している箇所は 0 件で、すべてリテラル（Go 4 箇所の `wantVersionConflictCode` ／ E2E の `VERSION_CONFLICT` ／ `errors.test.ts` の文字列配列 ／ `write_handler_test.go:303` の `"alias_conflict"`）である。唯一 `model.ErrorCodeVersionConflict` を参照する `TestErrorCode_AliasConflict_DistinctFromVersionConflict` は「定数の値そのもの」を主張するテストであり、破壊確認 B で実際に赤くなっている。意図と一致しており空振りではない。

### 2. 最重要ゲート 2 ——「対象外」を穴として塞いでいないか: ◎

本番コードの差分 4 ファイルに `version` を上げる変更は 1 行も無い。成立条件・セットプレイ紐付け・確定反撃系 4 表・タグ・プリセット・`recipe_cache` のいずれにも楽観排他は足されていない。`version` 列の追加もマイグレーション消費も 0（実測で確認）。`combos.version` / `setups.version` の +1 の仕方（`repository.go:894` の常時 +1）も無改変で、集約単位は維持されている。

### 3. 最重要ゲート 3 —— `conflict` の全数更新: ◎

独立に走査した結果、本番コードで API エラーコードとして `conflict` を返す箇所・見る箇所は 0 件である。フロントは `web/src/features/setup/errors.ts:26` も `ComboEditor.tsx:442` も `err.status === 409` だけを見ており、コード文字列に依存していない（`web/src/` 全体で 409 を扱う 6 箇所すべてが status ベース）。「片方だけ残って競合が不明なエラーになる」型の壊れ方は起こらない。

### 4. 最重要ゲート 4 —— `version: 0` の是正: ◎

既定値の差し替えではなく、`buildPatchPayload(target: ComboDetail)` / `runPatch(target, …)` の引数化で既定値を置く場所そのものを消している。`ComboSummary.version` は `version: number`（必須）であり、`ComboDetail` はこれを継承するため型で保証される。唯一の呼び出し元は `proceedSave` の `if (initial && initialKey)` ブロック内で、TypeScript の narrowing が効いている。`?? 0` 相当のフォールバックは `web/src/features/` 全体でも他に無い。

### 5. 38 経路の判定: ○（1 件の根拠が誤り）

ルート実体を独立に数え直したところ、非 GET は 41 本・`version` を受け取るもの 3 本・残り 38 本で完了報告と一致する。38 行すべてが表に現れており、抜けは無い。判定結論（全件「対象外」）も §1.3 の線引きに照らして妥当である。ただし根拠が 1 件誤っている（後述・高 2）。

「対象なのに版を上げていない経路 0 件」の結論そのものは、`UPDATE combos` / `UPDATE setups` を発行する全箇所を独立に洗って裏取りした。集約表を書くのは `UpdateMetadata` / `UpdateSetup`（+1 する 2 本）・論理削除・復元・`recipe_cache` 3 本 ×2 表だけで、いずれも線引きどおりである。

`#36 DELETE /api/tags/:id` の扱いは妥当である。実装は `DELETE FROM tags WHERE id = ? AND user_id = ?` のみで、`combo_tags` は DDL の `ON DELETE CASCADE` で連鎖する。ルート自身は集約の表に書かないため §9.3-4 の停止条件には当たらず、塞ぐか否かを設計卓へ回した判断は正しい。自分で塞いでいたらチェックリスト §9-2 に触れていた。

### 6. `DES-002` / as-built の差（§10）: △

15 項目の列挙は網羅的で、逐語引用（`02-architecture.md:169` の注記 ／ `:380` の 1 文）も実物と一致する。`PUT` がリポジトリを経由せずサービス層に SQL を直書きしている点（#11）、`version` の増え方が 3 通りある点（#12）、`PATCH /api/moves/:id` の「楽観ロックは設けない」が今も正しい点（#6）はいずれも実装を読んで確認でき、設計卓がそのまま使える精度である。

一方で 409 コードの実測数が誤っており（高 1）、`PUT` 後に旧 id を握っていた側が 409 ではなく 404 を受け取るという as-built が欠落している（高 3）。

### 7. 非破壊性（触ってはいけないもの）: ◎

完了報告 §9 の diff 0 主張を全項目再実行して一致を確認した——`migrations/` ／ `character_data/` ／ `docs/design/` ／ `internal/service/notation/` ／ `internal/service/preset/` ／ `web/src/features/gamepad/` ／ `keyboard/` ／ `internal/api/auth/` ／ `internal/service/auth/` ／ `internal/api/middleware/` ／ `go.mod` ／ `go.sum` ／ `web/package.json` ／ `web/pnpm-lock.yaml` はいずれも 0 行。`recipe_cache` の読み書きも実装側の差分 0（変更されたのは `repository_test.go` のみ）。

### 8. テスト要件 §5.1 の 9 項目: ○

9 項目すべてに対応するテストが存在する。E2E は 4 本で、いずれも「拒否されること」だけを見ており見せ方には踏み込んでいない（`M22-04` の面を侵していない）。対照実験の置き方も良い——先に保存した側が通ること、最新版なら `PUT` が通ること、レシピ解決が空振りしていないこと、409 でないステータスでは `isConflict` にならないこと。

弱いのは §5.1-8（タグだけを送る PATCH でも版が上がる）で、網が repository 層の空 SET 代理でしか張られていない（中 4）。

### 9. コード品質・規約: ○

エラーコードの定数化は `CLAUDE.md` §4 に沿う方向だが、版不一致 1 種類だけが定数で残り 10 種は生リテラルという中途の状態にある。本サブのスコープを守った結果であり、設計卓へ申し送り済み（§12.5-2）であるため妥当な判断と見る。godoc は付いており、`console.log` / `fmt.Println` の混入も無い。`check-enum-sync.sh` ／ `check-browser-storage-keys.sh` を再実行して緑を確認した。

### 10. ドキュメント（§7.5 の 10 項目）: ○

10 項目すべてが揃っている。否定形確認は単語境界での走査に加えて `[A-Za-z_]*conflict[A-Za-z_]*` の網羅トークン走査で裏取りしており、`\b` が `_` を単語構成文字として扱う性質まで踏まえた作法である。陽性対照（`DES-002` §4.2 の注記）も置かれている。走査結果は独立に再現でき、分類も正しい。`progress-log.md` への索引行も追記済みで `check-progress-log-index.sh` は緑。

## 設計準拠性以外の指摘事項

- E2E の後始末が不完全である（中 5）。`DELETE /api/combos/:id/permanent` は `combo_setup_results` / `combo_setups` / `combos` を消すが `setups` 行は残す（`internal/repository/combo/repository.go:970-977`）。spec 冒頭のコメントは「自分で作ったコンボ・セットプレイだけであり、後始末で物理削除する」と書いているが、セットプレイ行は残る。`make e2e` は使い捨て DB とはいえ同一プロセスで全 spec が走るため、`GET /api/setups` を数える spec が将来入ると干渉する。完了報告 §8.3.2 が触れている `e2e-shared-global-resource-parallel` と同じ面である。
- `TestErrorCode_AliasConflict_DistinctFromVersionConflict` の置き場が `internal/api/preset` である（低）。主張の対象は `internal/model` の定数であり、`internal/api/preset` は実 DB を使う 13〜17 秒のパッケージである。`alias_conflict` をテスト内のローカル定数として二重に持っている点も、定数化が進めば解消する。
- `check-md-emphasis.sh` が `markdown-it-py` 未導入で「未実行」判定になっていた件（完了報告 §9.1）は、検査が緑を返さない設計どおりに動いた例であり、対応も適切である。

## 推奨修正（優先度別）

### 高（M22 完了前に修正必須）

1. **409 コードの実測数が誤っている。** 完了報告 §1.5 ／ §10.1 #5 ／ `progress-log.md` 横断課題 6 は「409 を返す他のコードは計 8 種」と書くが、実測は 10 種である。欠落は `rush_variant_exists`（`internal/api/move/handler.go:137`）と `user_name_duplicate`（`internal/api/user/handler.go:81`）。§10.1 #5 は設計卓が `DES-002` §4.2 へ逐語で写す as-built であり、このまま反映されると設計書に誤った件数が入る。「ステータスだけでは版不一致を識別できない」という主張自体はむしろ強まるため、結論は変わらない。3 箇所の数字と列挙を是正すること。
2. **完了報告 §2 #12 の根拠が失効している。** `PUT /api/config` を「DB 書込 ✕ ／ DB を書かない」としているが、`defaults.preset_id` が変わると `internal/service/config/service.go:277` の `onDefaultPresetChanged` が発火し、`cmd/combomgr/main.go:271` の配線で `notationSvc.RecomputePresetCache` が走って `combos.recipe_cache` / `setups.recipe_cache` へ書き込む（`CHANGE-102` / `M20-05` の as-built）。判定「対象外」は `recipe_cache` が §1.3 で対象外であるため変わらないが、根拠は「DB を書かない」ではなく「書くのは `recipe_cache` 列だけ」である。あわせて「DB へ書くもの 30 件」は 31 件になる（完了報告 §1.3・§2・`progress-log.md` の 3 箇所）。指示書 §4.2-4 が根拠を経路ごとに 1 行求めているのは、まさにこの型（結論は当たっているが導出が実装を見ていない）を防ぐためである。
3. **`PUT` の敗者が 404 になる as-built が §10 に無い。** `PUT /api/combos/:id` は旧行を論理削除して新 id で採番し直すため、旧 id と旧 version を握っていた別文脈がその後 `PATCH` を撃つと、`repository.go:909-920` の弁別で「有効な行が 0 件」となり `ErrNotFound` すなわち **404** が返る。**409 は返らない。** これは「版不一致は 409 ＋ `version_conflict`」という契約の実装上の例外であり、`M22-04` が作る「他の人が編集した」体験の前提に直結する（キー変更編集に負けた側には 409 の導線が出ない）。§10.2 へ 1 行足して設計卓へ渡すこと。実装の変更は不要である。

### 中（M23 着手と並行可）

4. **§5.1-8 の網をサービス層にも置くこと。** 現状の `TestRepository_UpdateMetadata_EmptySetStillBumpsVersion` は repository 層で「SET 対象が空でも +1」を主張する代理であり、「タグだけを送る PATCH が実際に `UpdateMetadata` へ到達して版を上げる」ことは主張していない。既存の `TestService_UpdateMetadata_TagIDs_Replace`（`service_test.go:1091`）はタグだけの更新を通しているが `version` を見ていない。同テストに `got.Version == saved.Version + 1` を 1 行足せば集約単位の網が閉じる。なお失敗側は既存の `TestService_UpdateMetadata_VersionConflict_TagIDs_NoChange` が守っているため、穴は成功側だけである。
5. **E2E のセットプレイ行を後始末するか、コメントを実態へ合わせること。** 上記のとおり `setups` 行が残る。`DELETE /api/setups/:id` は論理削除であるため完全な物理削除は現行 API では不可能で、その場合はコメント側を「コンボは物理削除する。セットプレイ行は論理削除のみで残る」と実態へ直すのが正しい。失効した記述を残さないこと。
6. **`recipe_cache` の as-built 6 本のうち、テストで固定されているのは `combos` の非 tx 版 1 本だけである。** 完了報告 §6 は「tx 版（`UpdateRecipeCacheTx`）と無効化（`SetRecipeCacheNullTx`）は `updated_at` も進めない」を `DES-003` へ書く as-built として提示しているが、これを主張するテストは無い。SQL を読めば正しいが、設計書に書いたあとで tx 版に `updated_at` が足されても誰も気づかない。`setups` 側 3 本も同様である。1 本だけでも tx 版の据え置きを固定しておくと、`DES-003` の記述に裏付けが付く。

### 低（将来対応）

7. `TestErrorCode_AliasConflict_DistinctFromVersionConflict` を `internal/model` 配下へ移すこと。主張の対象が `internal/model` の定数であり、実 DB を立てる `internal/api/preset` に置く理由が無い。あわせて `alias_conflict` を定数化すれば、テスト内のローカル定数との二重管理も消える（設計卓へ申し送り済みの全面定数化と同じ手番でよい）。
8. 完了報告 §10.2 #7 の「`migrations/` 全 77 ファイルの実測」は、77 マイグレーション ／ 154 ファイルである。`version` 列が `combos` と `setups` の 2 表だけという結論は再現できた。
9. 完了報告 §2 #11 の根拠「すべて新規 INSERT」は、`setups_only` 動作で既存コンボへ `combo_setups` を足す経路があるため厳密には言い過ぎである（`internal/service/comboio/import.go:198-211`）。紐付けは §1.3 で対象外のため判定は変わらない。

## 良かった点

- **破壊確認 B の空振りを隠さず、原因を言語化して残したこと。** 「本番コードが定数を使うこと」と「テストがリテラルで固定すること」は両立させるべき別の要求である、という整理は本プロジェクトの他のサブでも効く。テストのコメントとして現場にも残しており、後任が読む位置に置けている。
- **赤にならなかった層を「テストが弱い」と誤診せず、何が代わりに守っていたかをガードの位置ごとに表で示したこと。** `SUPP-001` §5.5 (10′) の要求に対する模範的な応答である。E2E を置いたことで「ハンドラ層が緑だから守られている」という読み違えの余地を潰した、という自己分析も的確である。
- **`version: 0` を型の問題として解いたこと。** 既定値を `1` へ差し替える誘惑（悪化）を明示的に退け、さらに props の判別可能ユニオン化までは踏み込まないと決めた線引きも、理由付きで報告されている。踏み込んでいたら編集画面の型設計へスコープが漏れていた。
- **走査の作法。** `\b` が `_` を単語構成文字として扱うことを踏まえ、網羅トークン走査で裏取りし、陽性対照まで置いている。走査コマンドがそのまま残っているため、こちらで再現して検証できた。
- **`DELETE /api/tags/:id` の連鎖削除に気づき、自分で塞がずに設計卓へ回したこと。** 線引きに収まることを確認したうえで「塞ぐ／塞がないは版を上げる経路を増やす判断である」と正しく分類している。
- **指示書の実測値が着手時点で失効していたことを検出し、開発者裁定を取ってから進めたこと**（33 → 38 経路 ／ `recipe_cache` 3 本 → 6 本）。先行サブの as-built が後続サブの「全数」を失効させるという一般則まで `progress-log.md` へ残している。

## 制約事項

- 本レビューはコード上で判定可能な範囲のみ対象。実際の動作確認・パフォーマンス・実機テストは別途実施が必要。
- 破壊確認 A / B は完了報告に転記された実出力を根拠として評価した。こちらでは本番コードを壊す再実行は行っていない（レビュー担当はコードを変更しない）。代わりに、破壊確認が捕まえるはずの対象——期待値が定数参照になっているテストの残存、および `conflict` を見ている箇所の残存——を静的走査で独立に検査し、いずれも 0 件であることを確認した。
- `go test` は変更のあったハンドラ 3 パッケージ、`pnpm test` は変更のあった 2 ファイルのみ再実行して緑を確認した（全量とフル `make e2e` は完了報告の転記を採用）。

### 誤判定しないこととされた事項について

チェックリスト §0.3 の N-1〜N-12 に該当する状態は、いずれも仕様として扱い問題として報告していない。具体的には——成立条件・紐付け・確定反撃系・タグ・プリセットに楽観排他が無いこと、`recipe_cache` で版が上がらないこと、論理削除・復元で版が上がらないこと、タグだけの PATCH でも版が上がること、新しい `version` 列が 1 本も無いこと、409 の見せ方が無いこと、利用者から見た挙動が変わっていないこと、本番コードの差分がテストとエラーコードだけであること、開発者の手動確認が無いこと、`internal/` に diff があること、`conflict` から `version_conflict` へ変えていること。

---

## 取り込み結果（自動トリアージ）

| 実施日 | 2026-08-16 |
|---|---|
| 判定者 | 製造担当（`implement_plan_full` Phase C・自動トリアージ） |
| 結果 | **高 3 件・中 3 件・低 3 件——全 9 件を採用。不採用 0 件** |
| 「高」の不採用 | **なし**（⇒ 開発者へのエスカレーションは発生していない） |
| 往復回数 | **1 回**（上限 2 回・未到達。再レビューは要求していない） |

**★採否の前に、指摘 9 件すべてを実装で独立に検証した**（レビュー報告を額面どおり受け取らない）。検証方法は各行に記す。

### 高（すべて採用）

| # | 指摘 | 検証 | 採否と理由 | 反映先 |
|---|---|---|---|---|
| 高1 | 409 コードの実測数が 8 ではなく 10（`rush_variant_exists` / `user_name_duplicate` の欠落） | **確認した。** `rg -n 'http.StatusConflict' internal/ --glob '!*_test.go'` で当たった 12 候補それぞれについて、直前 3 行の `http.Status*` を突き合わせて実際に 409 で返るものだけを数え直した（`internal_error`＝500 ／ `invalid_tag_id`＝400 は誤検出）。**`version_conflict` を除いて 10 種で確定** | **採用。** 設計卓が `DES-002` §4.2 へ逐語で写す as-built であり、**誤ったまま反映されると設計書に誤った件数が入る** | 完了報告 §1.5 ／ §10.1 #5 ／ `progress-log.md` 横断課題 6 |
| 高2 | `PUT /api/config` の根拠「DB を書かない」が失効（`recipe_cache` へ書く） | **確認した。** `internal/service/config/service.go:277` の `onDefaultPresetChanged` → `cmd/combomgr/main.go:271` の `notationSvc.RecomputePresetCache` を辿った。**あわせて `POST /api/auth/password` は `SetPasswordHash`（`service.go:294-315`）が `config.toml` だけを書き DB へ届かないことも確認**——こちらは「DB 書込 ✕」のままで正しい | **採用。** **結論（対象外）は変わらないが導出が実装を見ていなかった。** 指示書 §4.2-4 が根拠を経路ごとに 1 行求めているのは、まさにこの型を防ぐためである | 完了報告 §2 #12（判定は「対象外」のまま・根拠と DB 書込欄を是正） ／ §1.3 の件数表（DB へ書くもの **33→34** ／ うち `version` 非保持 **30→31**） ／ `progress-log.md` |
| 高3 | `PUT` に負けた側は 409 ではなく 404 を受け取る as-built が §10 に無い | **確認した。** `PUT` は旧行を論理削除する（`service/combo/service.go:597-599`）ため、旧 id への `PATCH` は `repository.go:909-920` の弁別で `SELECT COUNT(*) … WHERE deleted_at IS NULL` が 0 となり `ErrNotFound`＝**404**。`version_conflict` は返らない | **採用。** **`M22-04` が作る「他の人が編集した」体験の前提に直結する**——キー変更編集に負けた側には 409 の導線が出ない。**実装は変更しない**（旧行はもう存在しないため 404 が正しい） | 完了報告 §10.2 に **#12.5** を新設 |

### 中（すべて採用）

| # | 指摘 | 検証 | 採否と理由 | 反映先 |
|---|---|---|---|---|
| 中4 | §5.1-8 の網が repository 層の空 SET 代理でしかない | **確認した。** `TestService_UpdateMetadata_TagIDs_Replace`（`service_test.go:1091`）はタグだけの更新を通すが `version` を見ていなかった | **採用。** 1 行で「タグだけの更新が実際に `UpdateMetadata` へ到達して版を上げる」が閉じる。**集約単位（`D-394`）の網であり、代理のままにしない** | `internal/service/combo/service_test.go`（`got.Version == saved.Version+1` を追加） |
| 中5 | E2E の後始末コメントが失効（`setups` 行は残る） | **確認した。** `HardDelete`（`repository.go:963-981`）は `combo_setup_results` / `combo_setups` / `combos` を消すが **`setups` は消さない**。`DELETE /api/setups/:id` は論理削除であり、現行 API に物理削除の手段が無い | **採用。** **「撤回済み・失効した記述がコード上に残っている」型であり、本プロジェクトでは高相当に扱う。** 後任が本文をコピーして「後始末は完全だ」と読む | `web/e2e/m22-03-optimistic-locking.spec.ts` の冒頭注記と `destroyCombo` の godoc |
| 中6 | `recipe_cache` の as-built 6 本のうち固定されているのは非 tx 版 1 本だけ | **確認した。** インタフェース（`repository.go:215-220`）のコメントは tx 版が `updated_at` を進めないと書くが、主張するテストは無かった | **採用。** **`DES-003` に書いた後で tx 版へ `updated_at` が足されても誰も気づかない。** 対照実験（同じ行へ非 tx 版を撃つと `updated_at` は進む）も添えた | `internal/repository/combo/repository_test.go` に `TestRepository_UpdateRecipeCacheTx_DoesNotBumpVersionOrUpdatedAt` を新設 ／ 完了報告 §6 |

### 低（すべて採用）

| # | 指摘 | 採否と理由 | 反映先 |
|---|---|---|---|
| 低7 | 契約テストの置き場が `internal/api/preset`（実 DB を立てる 12〜17 秒のパッケージ） | **採用。** 主張の対象は `internal/model` の定数であり、実 DB を立てる理由が無い。**移設ついでに主張を強めた**——「`alias_conflict` と違うこと」だけでなく **409 を返す他の 10 コードすべてと重ならないこと**を固定する。`internal/api/preset` 側の重複は削除した（線上の `alias_conflict` は既存 `TestHandler_Update_AliasConflict_NotInternalError` が引き続き固定している） | `internal/model/api_error_test.go` に `TestErrorCodeVersionConflict_DistinctFromOther409Codes` を新設 ／ `internal/api/preset/write_handler_test.go` から削除 |
| 低8 | 「`migrations/` 全 77 ファイル」は 77 マイグレーション ／ 154 ファイル | **採用。** `ls migrations/*.up.sql | wc -l` = 77 ／ `ls migrations/ | wc -l` = 154 で確認 | 完了報告 §10.2 #7 |
| 低9 | §2 #11 の根拠「すべて新規 INSERT」は `setups_only` があるため言い過ぎ | **採用。** 判定（対象外）は変わらないが、**根拠が実装より強く書かれている状態を残さない**（高2 と同型） | 完了報告 §2 #11 |

### 再テスト結果（取り込み後）

```
go test ./internal/...   → 51 パッケージ ok / FAIL 0
pnpm e2e m22-03-optimistic-locking → 4 passed (3.3s)
```

### ★不採用にした指摘

**なし。** ⇒ 指示書 §9.3 の安全弁（「高」の指摘を不採用とする場合のみ開発者へエスカレーション）は発動していない。

### ★未解消のまま停止した項目

**なし。** 往復 1 回で全件解消したため、`docs/handover/followup-backlog.md` §J への停止時記録は発生していない。

**★ただし本サブが「解決しない」と決めて設計卓へ回した事項は 5 件ある**（完了報告 §12.5）。これらは未解消ではなく**手番が設計卓にある**もので、設計伝達レポート §4 で渡す。

---

*以上、M22-03 レビュー報告書。配置 `docs/progress/m22-03-review.md`。重大（チェックリスト §9）0 件 ／ 高 3 件 ／ 中 3 件 ／ 低 3 件。高はいずれも完了報告の事実記述の是正であり、実装の変更を伴わない。*
