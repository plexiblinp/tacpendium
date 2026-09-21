# M37-07 レビュー報告書

| 項目 | 内容 |
|------|------|
| 対象サブ | M37-07 始動技の持続当てを重複判定キーへ加える |
| 指示書 | `docs/instructions/M37-07-starter-meaty-key.md` v1.2.0 |
| チェックリスト | `docs/instructions/reviews/M37-07-review-checklist.md` v1.2.0 |
| 着手基点 | `6db1eb9` ／ ブランチ `claude/tender-newton-csy9b2` |
| 対象コミット | `74c5813` / `faca19a` / `9cab508` / `7cb6717` / `7bb20be` ／ **レビュー中に `8b7037e`（全数テストの実測を完了報告へ記録）が追加された。本報告は同コミットを含めた状態を対象とする** |
| レビュー実施日 | 2026-09-14 |

---

## 総評

本体の作りは堅い。列は `NOT NULL DEFAULT 0` の 2 値で、`recipe_hash` は 1 バイトも動かず、`hit_type` は 8 値のまま、`combo_oki_options` は実コード差分 0、`PATCH` には受け口が無い。チェックリスト §0 の「不合格」6 件はいずれも踏んでいない。破壊確認も、述語を実際に外して 4 本が赤くなることをレポート §5.2 で示しており、形だけのテストではない。

一方で、本プロジェクトが最も重く扱う型の欠陥が残っている。**重複判定キーの項数を書いた古い記述が、本番コード 3 か所・フロント 3 か所・テスト 4 か所に「6 項」「4 欄」のまま残っている**。製造は `service/validation/combo.go` の godoc を「失効記述になるため」更新しているのに、同じパッケージの `duplicate.go` の同じ言い回しを取りこぼした。動作は正しいままなので、テストも lint も型検査も緑である。

加えて、`docs/progress/progress-log.md` への索引行の追記が落ちている。`bash scripts/check-progress-log-index.sh` が実際に赤で、完了条件 12 とチェックリスト F-8 を満たしていない。

数え直しの結果、報告の「30 箇所」は内訳と一致しない（フロントの列挙は 10 件）。また、重複判定キーを再実装している監査ツール `existing_duplicates_audit_test.go` が足し先から漏れている。

---

## 設計準拠性レビュー結果

### 束 A — 重複判定キー

| ID | 評価 | 所見 |
|---|:--:|---|
| **A-1** | △ | 箇所数は報告 §2.1 に「実測 30 箇所（Go 19 ／ フロント 11）」と在る。**数え直すと合わない**。フロントの列挙は `ComboKeyFields` / `hasKeyChanges` / `extractKeyFields` / `CheckDuplicateInput` / `DuplicateInfo` / `CheckDuplicateRequest` / `CheckDuplicateResponse.duplicates[]` / `checkInput` / `buildCheckDuplicateInput` / `currentKey` の **10 件**であり、11 件目として挙がっているのは「据え置き」と書かれた `DuplicateRealtimeWarning` である。⇒ 「30 箇所へ全数足した」は「29 箇所へ足し、1 件は据え置いた」が正。Go 側も #17（DTO 2 つ）・#18（変換 2 か所）が 1 行に 2 サイトを畳んでおり、粒度が揃っていない。**チェックリスト §8 の対照値としては使えない数字である** |
| **A-2** | △ | 本番コードの足し先は**実測で全数入っている**（`grep` による対称箇所の走査で漏れ 0 を確認：`repository.DuplicateKey` / `FindActiveByDuplicateKey` / `duplicateKeyPredicates` / `validation.DuplicateKey` / `validateC02Duplicate` / `CheckDuplicateInput` / `DuplicateInfo` / `CreateInput` / `buildComboFromInput` / `duplicateKeyOf` / `CheckDuplicate` 3 か所 / `Materialize` / `ComboDuplicateAdapter` / API DTO 4 種 / `check_duplicate_handler` 2 か所 / `comboio.checkDuplicate` / フロント 10 か所）。`FindDeletedByDuplicateKey` と `FindActiveByDuplicateKeyExcludingTx` はいずれも `duplicateKeyPredicates` 経由であり自動的に及ぶ。**ただし 1 か所漏れている** → `internal/service/combo/existing_duplicates_audit_test.go`。同ファイルは `auditKey` 構造体と生 SQL で識別キーを**再実装**しており（L49-58、L126 の `SELECT id, character_id, starter_move_id, position, opponent_stance, hit_type, opponent_size`）、`starter_meaty` を含まない。⇒ 利用者が本欄を使い始めた瞬間から、この監査は「持続当て違いの 2 行」を重複として誤報する。既定 skip の開発者用ツールだが、キーを再実装している以上は足し先である |
| **A-3** | ◎ | 破壊確認は**本物である**。完了報告 §5.2 が `FindActiveByDuplicateKey` から `starter_meaty = ?` を実際に外して 4 本が赤くなることを示し、復元後 `git diff` が空であることも確認している。単体テスト側の (a)（`starter_meaty=true` で引くと `false` の行が出ない）も判定への寄与を直接観測している |
| **A-4** | ◎ | `TestStarterMeaty_DifferentValueIsNotDuplicate`。他 7 要素を 1 バイトも動かさずに本欄だけを変える作りで、交絡が無い |
| **A-5** | ◎ | `TestStarterMeaty_SameValueStillDuplicates`（`false` / `true` の両側を回している） |
| **A-6** | ○ | `deleted_at IS NULL` / `is_draft = 0` の固定条件は 1 文字も触っていない。本サブ固有のテストは無いが、既存の VAL-C02 / VAL-C14 / VAL-R03 テストが全数緑 |
| **A-7** | ◎ | `000117` は `ALTER TABLE ... ADD COLUMN` 1 文のみ。索引も UNIQUE も新設していない |

### 束 B — 変えてはいけないもの

| ID | 評価 | 所見 |
|---|:--:|---|
| **B-1** | ◎ | `internal/recipehash/` 差分 0。`TestStarterMeaty_RecipeHashUnchanged` が陽性対照つきで一致を主張 |
| **B-2** | ◎ | `model.HitType*` は 8 値のまま（`normal` / `counter` / `punish_counter` / `just_parry_punish_counter` / DI 3 種 / `stun`） |
| **B-3** | ◎ | `combo_oki_options` に関する差分はコメントの言及のみ。`import.go` の 1 行は `gofmt` の空白再整列で、`git diff -w` では 0 行 |
| **B-4** | ◎ | マイグレに `UPDATE` は 1 文も無い。先例 `000096` が backfill を書いた理由との差も明記されている |
| **B-5** | ◎ | `labels.ts` / `notation/resolver.go` とも差分 0 |
| **B-6** | ◎ | セットプレイ側（`service/setup/duplicate_keys.go`）は別キー体系のまま無変更 |

### 束 C — 列の形

| ID | 評価 | 所見 |
|---|:--:|---|
| **C-1** | ◎ | `INTEGER NOT NULL DEFAULT 0`。`DefaultsToFalseWhenNotSpecified` が `<> 0` と `IS NULL` の両方を 0 件で主張 |
| **C-2** | ◎ | 2 値。UI にも「不問」を置いていない。`withUnspecifiedFirst` を通さない旨をコメントで固定 |
| **C-3** | ◎ | `CHECK` 無しは実物に合っている。`moves.is_derived`（000032）／ `moves.is_projectile`（000039）／ `combos.oki_verified`（000096）を実地に確認し、いずれも `CHECK` 無しであることを検証した |
| **C-4** | ◎ | `starter_meaty` は「始動が持続当てである」という事実の名前。`combos.starter_move_id` の既存語彙と揃う |
| **C-5** | ◎ | `000117` の 1 本。`ls migrations/` の着手前最新は `000116`（実測）。欠番 `000113` も正しく扱われている |
| **C-6** | ◎ | `check-migration-license.sh` EXIT=0（違反なし） |

### 束 D — 経路と画面

| ID | 評価 | 所見 |
|---|:--:|---|
| **D-1** | ◎ | `UpdateMetadataRequest` に受け口なし。`TestStarterMeaty_NotOnPatch` が reflect で不在を主張し、陽性対照（`okiVerified` は在る）も置いている。フロントの `buildPatchPayload` にも無い |
| **D-2** | ◎ | `hasKeyChanges` に入っており、`utils.test.ts` に「変えたら true」「undefined と false は同値」の 2 本。後者は「読み直しただけで PUT へ流れて id を採番し直す」事故の予防として的確 |
| **D-3** | ○ | `CreateRequest` / `PutRequest`（埋め込み）／ `ComboResponse` / `CheckDuplicateRequest` / `DuplicateInfoResponse` すべてに在る。応答側に `omitempty` を付けない判断も正しい。**ただし要求側 2 つ（`CreateRequest` / `CheckDuplicateRequest`）には `omitempty` が付いている**。復号には影響しないが、応答側で「false も情報だからキーを消さない」と決めた方針と同じファイル内で食い違う。指摘事項へ |
| **D-4** | ◎ | `CSVColumns` の**末尾**に追加。`optionalImportColumns` に登録し必須列は 22 で不変（`column_contract_test.go` が凍結）。`TestStarterMeatyBackwardCompatImport` が「列が 1 つ少ない旧 CSV」を組んで `FileError` なし・指摘 0 件を主張しており、後方互換の観測として妥当 |
| **D-5** | ◎ | 編集画面はヒット種別の隣に `OptionButtonGroup mode="single"`。詳細画面は状況の `<dl>` に 5 項目目として追加（`data-testid` つき） |
| **D-6** | ◎ | 一覧フィルタへ足してある（3 状態 `<select>`・`data-testid="combo-list-filter-starter-meaty"`）。URL クエリ・`ACTIVE_FILTER_KEYS`・絞り込み中サマリ・`clearFilters` のすべてに通っている。**表示語は `ja.json` で「持続当て（始動技）」である**。開発者裁定の逐語と 1 文字も違わない |

### 束 E — 設計書の原稿

| ID | 評価 | 所見 |
|---|:--:|---|
| **E-1** | ◎ | 設計伝達レポート §1-1 に `SUPP-001` §2.2 の 7 → 8 要素改訂原稿が現行逐語つきで在る。`SUPP-001` 実物（L119-141）と突合して、引用が正確であることを確認した |
| **E-2** | ◎ | `DES-003` §3.3 ／ `DES-006` §2.3 VAL-C02 ／ `DES-002` §4.2・§7 ／ `DES-005` §5.7・§5.6・§5.4 の原稿が §1-2〜§1-5 に在る |
| **E-3** | ◎ | `docs/design/` 差分 0 行 |
| **E-4** | ◎ | CHANGE 番号を自採番していない。§6 に起票たたき台のみ |
| （追加） | ○ | 指示書 §2.5 は「CHANGE 原稿を設計伝達レポート §4 へ」と書いているが、実際は §1 へ置かれている。製造がレポート §2-1 で食い違いを申告し、§1・§4・§6 の 3 か所から辿れる形にしてある。先例（M37-06 / M37-05 / M34-02）とも整合しており、処理として妥当。**指示書側の節番号の是正は設計卓の手番** |

### 束 F — 実査と検査

| ID | 評価 | 所見 |
|---|:--:|---|
| **F-1** | ◎ | 段 1 の 5 点すべてが §2.1〜§2.6 に在る |
| **F-2** | ○ | 作業ツリーに DB が無く実測不能。開発者実測値 133 行を引いた旨と、行数に依らず `0` が担保される理由を書き分けている。妥当な処理 |
| **F-3** | ◎ | 「実測」「他者実測」「算出」の書き分けが各所に在る |
| **F-4** | ◎ | 版ゲート 5 点通過。指示書 §2.1 段 1-2 とチェックリスト F-4 に残る「最新は `000115`」が v1.1.0 の追随漏れであることも検出し、§0.2 と設計伝達レポート §4-2 へ回している（**この検出自体は良い仕事**） |
| **F-5** | ○ | 現在は完了報告 §5.4 に `EXIT=0` とファイル退避が貼られており、**本レビューでも独立に再現した**（下記「独立検証」）。★ただし**レビュー着手時点（`7bb20be`）では §5 が `<!-- TESTS -->` のプレースホルダで、貼り付けが 1 行も無かった**。レビュー中の `8b7037e` で埋まったものである（指摘 9） |
| **F-6** | ◎ | `check-enum-sync.sh` ベースラインどおり ／ `check-import-order.sh` 99 / 99 |
| **F-7** | ◎ | `docs/handover/followup-backlog.md` 差分 0 行。停止時記録も設計伝達レポート §4-5 に原稿として置いてある |
| **F-8** | **×** | **`docs/progress/progress-log.md` へ 1 行も追記されていない**。`git diff --name-only 6db1eb9` に同ファイルが現れず、`bash scripts/check-progress-log-index.sh` が EXIT=1 で「作業 ID `m37-07` が `progress-log.md` に現れない」と赤になる。完了条件 12 の前半・`CLAUDE.md` §8「サブ完了時の追記は必須」に未達。`docs/usermanual/` の側は該当なしで正しい（`tacpendium-readme.html` の全 22 章が「本文は M32-02 で記述します」のプレースホルダであることを 88 件の実測で確認） |

### 独立検証（本レビューで回したもの）

| 対象 | 結果 |
|---|---|
| `go build ./...` | EXIT=0 |
| `go test ./...`（ファイル退避・パイプなし） | **EXIT=0** ／ `ok` 60 件 ／ `FAIL` 0 件 |
| `pnpm exec tsc --noEmit` | EXIT=0 |
| `pnpm test -- --run` | **EXIT=0** ／ 234 files / 2950 tests passed |
| `make e2e-only P=m12-03`（ロケータ修正の確認） | **EXIT=0** ／ 2 passed |
| 全数 E2E | レビュー中に走行していた `playwright test` が `web/test-results/.last-run.json` に `status: "passed" / failedTests: []` を残して終了した。完了報告 §5.4 の「352 passed」と整合する |
| `check-artifact-integrity` / `check-stop-discipline` / `check-doc-refs` / `check-browser-storage-keys` / `check-completion-report-md-emphasis` / `check-instruction-format` / `check-migration-license` / `check-enum-sync` / `check-import-order` | すべて EXIT=0 |
| `check-md-emphasis.sh`（完了報告・設計伝達レポート） | いずれも検出 0 行 |
| **`check-progress-log-index.sh`** | **EXIT=1（違反 1 件）** |
| `git diff --numstat 6db1eb9` による新規ファイルの deletions 確認（`E-225`） | 新規 7 ファイル（指示書が挙げた 6 本 ＋ 設計伝達レポート）はいずれも **deletions 0**。上書き事故なし |

---

## 設計準拠性以外の指摘事項

### 1. 失効記述が本番コードに残っている（**最重要**）

重複判定キーの項数・欄数を書いた記述が、旧の値のまま残っている。動作は正しいため**テストも lint も型検査も緑**であり、人が読む以外に見つける経路が無い。後任はこの本文をコピーして次のサブの前提にする。

| # | 箇所 | 現在の記述 | 正 |
|---|---|---|---|
| 1 | `internal/service/validation/duplicate.go:53` | 「ゴミ箱に居り、**判定キー 6 項**が一致し」（VAL-C14） | 7 項 |
| 2 | `internal/service/validation/duplicate.go:68` | 「生きており、**判定キー 6 項**が一致し」（VAL-R03） | 7 項 |
| 3 | `internal/service/combo/service.go:2034` | 「候補は**判定キー 6 項**で絞られた集合であり」（`stepsForCandidates`） | 7 項 |
| 4 | `web/src/features/combo/components/DuplicateRealtimeWarning.tsx:52` | 「重複判定は**判定キー 6 項**の完全一致 ＋ `recipe_hash` の完全一致で成立する」 | 7 項 |
| 5 | `web/src/features/combo/components/ComboDetailMetadata.tsx:87` | 状況ブロックは「**重複判定キーの 4 欄**そのもの」 | 本サブが 5 欄目を足した |
| 6 | `web/src/features/combo/components/ComboEditorBasicFields.tsx:920` | 「状況（始動位置・相手の状態・ヒット種別・大きさ＝重複判定キー）」 | 持続当てが抜けている |
| 7 | `web/e2e/m28-02c-game-update.spec.ts:54` | 「重複判定キーは（キャラ / 始動技 / 始動位置 / 相手の状態 / ヒット種別 / 相手の大きさ）の **6 項目**である」 | 7 項目。**この注記は spec が始動技を末尾から取る理由そのもの**であり、読む人が居る |
| 8 | `internal/service/combo/existing_duplicates_audit_test.go:49` | 「`auditKey` は `DES-006` §2.3 の**識別キー 6 項** ＋ `recipe_hash`」 | 7 項。**記述だけでなく実装も乖離している**（A-2） |
| 9 | `internal/service/combo/trash_duplicate_test.go:124` ／ `internal/service/combo/m23_09_check_duplicate_test.go:181` ／ `web/src/features/combo/components/DuplicateRealtimeWarning.test.tsx:119` | いずれも「キー 6 項」 | 7 項 |

`repository.go:1695`（6 項 → 7 項）と `service.go:373` / `service.go:1228` / `service.go:1272` / `service.go:1326` は正しく更新されている。**同じ手番で同じ言い回しを直しているのに、`grep` を `internal/service/validation/duplicate.go` まで回していない**のが取りこぼしの形である。

### 2. `existing_duplicates_audit_test.go` が識別キーを再実装したまま

`auditKey` 構造体（L49-58）と `auditGroups` の生 SQL（L126）が 6 列で識別キーを組む。`TACPENDIUM_AUDIT_DB` 未設定なら skip されるため CI も `go test ./...` も緑のままである。⇒ 開発者が実 DB を監査したとき、持続当て違いの 2 行が「重複」として報告される。**本サブの実害は今は無い（既存行は全て 0）が、本欄が使われた瞬間から誤報になる。**

### 3. 完了報告 §3 の変更統計が現状と食い違う

貼られているのは 42 files / 1132 insertions / 56 deletions。実際は **44 files / 1437 insertions / 57 deletions** であり、`docs/handover/design-reports/20260914-m37-07-design-exceptions.md` が一覧に入っていない。また見出しは「新規に作った **5** ファイル」だが、直下の表は 6 行ある（実際の新規は設計伝達レポートを含め 7 本）。**deletions が全て 0 であるという結論そのものは実測で正しい**が、`E-225` の観点で読む表が古い値のままなのは同じ型の欠陥である。

### 4. 破壊確認テストの (b) 分岐のコメントが実態と違う

`TestStarterMeaty_DestructiveCheck_KeyWithoutColumnWouldCollide` の (b) は「キーから `starter_meaty` を**外した**世界」と書いてあるが、実際に行っているのは `withoutColumn.StarterMeaty = false` の指定であり、述語は外していない。判定への寄与を示しているのは (a) と (b) の差であって、(b) 単体は「同じ値なら一致する」に過ぎない。**§5.2 の実地の破壊確認が本物であるため合否には影響しない**が、テスト名とコメントが主張している内容が実装と違う。後任がこのテストを「述語を外す検査」だと思って壊すと、何も検出しなくなる。

### 5. `CreateRequest` / `CheckDuplicateRequest` の `omitempty`

`dto.go:49`（`CreateRequest`）と `dto.go:365`（`CheckDuplicateRequest`）の `json:"starterMeaty,omitempty"`。復号には影響しないため実害は無いが、同じファイルの `ComboResponse` / `DuplicateInfoResponse` では「false も情報だからキーを消さない」として意図的に外している。**同一概念に 2 つの流儀が並ぶ**のは避けたい。要求 DTO を JSON 化して投げる経路（テストヘルパ・将来の内部クライアント）で false が落ちる。

### 6. 出力（PDF / PNG / クリップボード）に本欄が出ない

`web/src/features/combo-io/export-model.ts` の `situationValue` は position / stance / hitType / opponentSize の 4 つだけを連結する。本欄は重複判定キーであるため、**持続当て違いの 2 本を並べて出力すると見分けが付かない**。ただし `start_position_mass` / `carry_distance_mass`（M28-02a）も同関数に入っていない先例があり、指示書 §2.4 も出力までは求めていない。⇒ 射程外の申し送りとして扱うのが妥当。

### 7. 重複警告のキー表示に本欄が出ない

`DuplicateRealtimeWarning.tsx` の `keyValues` はキャラ / 始動技 / ヒット種別 / 始動位置 / 相手の状態 / 相手の大きさ の 6 つを出す。製造は「表示のみで判定に関与しない」として据え置いたと明記しており、重複が成立した時点でキーは全一致しているため情報量が増えないのも事実。**指摘としては #1 の失効記述（同ファイル L52）のほうが重い。**

### 8. 実行環境の後始末

本レビュー開始時、ポート 47390 / 5273 を占有したままの `playwright test` プロセス（バックエンド・vite preview・chromium を含む）が残っており、最初の `make e2e-only` が `http://localhost:47390 is already used` で落ちた。**完了報告のコミットより後まで全数 E2E が走っていた**ことを示す。成果物の欠陥ではないが、後続のレビュー・取り込みが同じ壁に当たる。

### 9. 完了報告 §5 はレビュー中に埋まった（**是正済み・記録として残す**）

レビュー開始時点の `7bb20be` では §5 が `<!-- TESTS -->` のプレースホルダのままで、チェックリスト F-5 が求める `EXIT=0` と FAIL 件数がどこにも無かった。レビュー中に `8b7037e` が入り、実測・破壊確認の実地検証・E2E の 1 件失敗と是正まで含めて埋まった。**内容は十分である。** 記録として残すのは、**レビュー担当が最初に受け取った成果物が完了条件を満たしていなかった**という事実と、**全数 E2E が完了報告の初回コミットより後まで走っていた**（指摘 8 のプロセス残留がその証跡）という時系列である。

### 良い判断として維持すべきもの

- `DuplicateCheckFields` が参照 0 件の死んだ定数であることを実測で突き止め、godoc に「これは写しであってスイッチではない」と実際の足し先一覧を書き足したうえで、配線し直すのは射程外として設計伝達レポート §4-1 へ 2 案つきで回した処理は正しい。**書き換えても挙動が変わらない定数を「直したから足りた」と扱わなかった**点を評価する。
- `addNullable` を通さず常に `starter_meaty = ?` にした判断、フロントで `nullableEqual` を使わず `?? false` で比較した判断は、いずれも `NOT NULL` 列の性質から導いており、後者は「読み直しただけで PUT へ流れて id を採番し直す」事故を実際に防いでいる。
- E2E が 1 件落ちたことを隠さず §5.5 に書き、原因（表示語が「始動技」を部分文字列に含む）と、同型リスクの全数走査まで報告している。

---

## 推奨修正（優先度別）

### 高（M37 完了前に修正必須）

1. **失効記述の是正**（指摘 1）。少なくとも本番コードの 6 件（`validation/duplicate.go` × 2 ／ `service.go:2034` ／ `DuplicateRealtimeWarning.tsx:52` ／ `ComboDetailMetadata.tsx:87` ／ `ComboEditorBasicFields.tsx:920`）と、`m28-02c-game-update.spec.ts:54` の spec 注記。テスト 3 件も同じ手番で揃えること。
2. **`internal/service/combo/existing_duplicates_audit_test.go` に `starter_meaty` を足す**（指摘 2 ／ A-2）。`auditKey` へ 1 フィールド、`SELECT` へ 1 列、`t.Logf` へ 1 項目。godoc の「6 項」も同時に直す。
3. **`docs/progress/progress-log.md` へ索引行を追記する**（F-8）。`8b7037e` の時点でも未追記であり、`bash scripts/check-progress-log-index.sh` は EXIT=1 のままである。緑になることを確認すること。

### 中（M38 着手と並行可）

4. **足し先の箇所数を数え直して報告を訂正する**（A-1）。「29 箇所へ足し、`DuplicateRealtimeWarning` は据え置いた」の形にするか、Go 側の粒度を 1 行 1 サイトへ揃えて数え直す。**チェックリスト §8 が対照値として読む数字である。**
5. **完了報告 §3 の変更統計を現状で取り直す**（指摘 3）。見出しの「5 ファイル」も表の行数に合わせる。
6. **破壊確認テスト (b) のコメントとテスト名を実態へ合わせる**（指摘 4）。「述語を外す」検査は §5.2 の手動手順が担っていることを明記するか、(b) を本当に述語を外す形にする。
7. **要求 DTO 2 つの `omitempty` を外す**（指摘 5）。同一ファイル内で流儀を 1 つにする。

### 低（将来対応）

8. `export-model.ts` の `situationValue` に本欄を出すか否かの判断（指摘 6）。`start_position_mass` / `carry_distance_mass` と併せて設計卓へ。
9. `DuplicateRealtimeWarning` のキー表示に本欄を出すか否か（指摘 7）。
10. E2E の後始末（指摘 8）。停止しない `playwright test` が残る運用上の穴。

---

## 良かった点

- **破壊確認を「通るテストを 1 本足す」で済ませなかった。** 実際に `FindActiveByDuplicateKey` から述語を外し、4 本が赤くなる出力を報告に貼り、復元後 `git diff` が空であることまで確認している。チェックリスト A-3 が求めていたのはまさにこれである。
- **指示書とチェックリスト自身の失効記述（`000115` → `000116`）を検出して申し送った。** 自分の作業を止めずに、正がどちらかを判断したうえで設計卓へ回している。
- **`DuplicateCheckFields` が死んでいることを実測で突き止めた。** `SUPP-001` が約束する構造が実装に無いという、本サブの外側の問題を 2 案つきで設計卓へ上げた判断は的確。
- **`E-225` の観点で新規ファイルの deletions を自分で確認している。** 実測でも新規 7 本すべて deletions 0 であり、主張は正しい。
- **「数えた上で外した 3 箇所」を明記した。** `isFormReadyForDuplicateCheck` / `sortFieldWhitelist["default"]` / `service/setup/duplicate_keys.go` のいずれも、実物を読んで理由を確認した結果、判断は妥当。とくに `sortFieldWhitelist["default"]` が「偶然 5 列が並ぶだけ」であることの見極めは良い。
- **表示語を 1 文字も違えずに実装した。** 「持続当て（始動技）」であり、案の「持続当て（始動）」ではない。`ja.json` を正典にして編集画面・詳細画面・一覧フィルタの 3 面へ配り、語を 2 か所に書く状態を作っていない。
- **旧 CSV の後方互換テストが「陽性対照」を持っている。** 列を 1 つ抜いた配列の長さを先に検査してから本体を回しており、テスト自身が壊れたときに気づける形になっている。

---

## 制約事項

- 本レビューはコード上で判定可能な範囲のみ対象。実際の動作確認・パフォーマンス・実機テストは別途実施が必要。
- 既存 133 行（有効 109 / 削除済み 24）の実測は、作業ツリーに DB ファイルが無いため本レビューでも取れていない。「既存行がすべて 0 になる」ことはマイグレの形からの論証と、テストによる `<> 0` / `IS NULL` の 0 件主張で確認した。
- 全数 E2E は、レビュー中に走行していた別プロセスの終了記録（`web/test-results/.last-run.json` の `status: "passed"`）と、完了報告 §5.4 の貼り付けを突合して確認した。**本レビューの手で全数を頭から回し直してはいない。** 個別に回したのは `m12-03` の 1 spec のみ。
- 不明: `existing_duplicates_audit_test.go` を「足し先」に数えるか否かは、指示書 §4.1 の列挙に監査ツールが挙がっておらず、製造も「非テスト」で範囲を切っているため、射程の解釈が割れうる。**本レビューは「識別キーを再実装している以上は足し先」と判定した**が、射程外と裁定する余地はある。

---

## 取り込み結果（自動トリアージ）

| 項目 | 内容 |
|------|------|
| 実施 | 2026-09-14 ／ Phase C（`/implement_plan_full` の自動トリアージ） |
| 集計 | **全 10 件＝高 3 / 中 4 / 低 3。採用 7 ／ 不採用 3（すべて「低」）** |
| **★「高」の不採用** | **0 件**（⇒ 開発者エスカレーションは発生していない） |
| 再レビュー往復 | **0 回**（上限 2） |

### 高（3 件・すべて採用）

| # | 指摘 | 採否 | 対処と理由 |
|---|---|---|---|
| **高-1** | 失効記述が本番コードに残っている（11 箇所） | **採用** | **全数を直した。★レビューの一覧に無かった `web/e2e/m23-05-duplicate-collision.spec.ts:21` を取り込み時の再走査で追加検出し、あわせて直した。** ★直接の原因は、足し先を数える `grep` を `\| head -20` へ通したこと（20 行で切られ `validation/duplicate.go` 以降が視界外）と、`--include=*.go` しか掛けずフロントを一度も走査していなかったことである。⇒ 取り込みでは `head` を付けず `*.go` / `*.ts` / `*.tsx` を横断して数え直した |
| **高-2** | `existing_duplicates_audit_test.go` が識別キーを再実装したまま | **採用** | `auditKey` へ `starterMeaty bool` ／ `SELECT` へ 1 列 ／ `Scan` へ 1 変数 ／ `t.Logf` へ `meaty=%t` を足した。godoc の「6 項」も 7 項へ。**★`starter_meaty` は `NOT NULL` のため `auditNull` の置き換えを通さないことを godoc に明記した。★「環境変数で走行が切り替わるテストは緑でも足し先を数え切った証拠にならない」旨も同 godoc へ残した** |
| **高-3** | `progress-log.md` 未追記 | **採用** | 索引行を追記。`bash scripts/check-progress-log-index.sh` が **違反なし**（111 件すべて）になることを確認した |

### 中（4 件・すべて採用）

| # | 指摘 | 採否 | 対処 |
|---|---|---|---|
| **中-4** | 足し先の箇所数が内訳と合わない（30 か 29 か） | **採用** | **「30 箇所を数え、29 箇所へ足し、1 件（`DuplicateRealtimeWarning`）は据え置いた」へ訂正**。据え置きの理由を §2.2 の「足さないと判断した」表へ移した。**★チェックリスト §8 が対照値として読む数字であるため、「足した」と「数えたが据え置いた」を混ぜない形にした** |
| **中-5** | 完了報告 §3 の変更統計が古い | **採用** | 取り直した（**53 files / 1794 insertions / 75 deletions**）。見出しの「5 ファイル」も実際の **8 ファイル**へ。deletions が全て 0 であることは再確認済み |
| **中-6** | 破壊確認テスト (b) のコメントが実態と違う | **採用** | **テスト名を `TestStarterMeaty_DestructiveCheck_KeyWithoutColumnWouldCollide` → `TestStarterMeaty_KeyPredicateDiscriminates` へ改めた。** (b) が述語を外していないことを明記し、**述語を実際に外す破壊確認は完了報告 §5.2 の手順が担う**とファイル冒頭と該当箇所の両方へ書いた。★指摘のとおり、後任が「これは述語を外す検査だ」と思って壊すと何も検出しなくなる形だった |
| **中-7** | 要求 DTO 2 つの `omitempty` | **採用** | `CreateRequest` / `CheckDuplicateRequest` から外し、同一ファイル内の流儀を 1 つにした。理由（応答 DTO と同じく false も情報である／要求 DTO を JSON 化して投げる経路で false が落ちる）をコメントへ残した |

### 低（3 件・すべて不採用）

| # | 指摘 | 採否 | 理由 |
|---|---|---|---|
| **低-8** | `export-model.ts` の出力に本欄が出ない | **不採用（射程外・申し送り）** | **レビュー自身が「射程外の申し送りとして扱うのが妥当」と結論している。** 指示書 §2.4 は出力を求めていない。**★先例＝`start_position_mass` / `carry_distance_mass`（M28-02a）も同関数に入っていない。⇒ 本欄だけ入れると流儀が割れる。** 設計伝達レポート §4 へ申し送る |
| **低-9** | 重複警告のキー表示に本欄が出ない | **不採用（意図的な据え置き）** | **重複が成立した時点でキーは全一致しているため、本欄を出しても情報量が増えない**（レビューも同旨を認めている）。**★同ファイルの失効記述（L52）は高-1 として直した** |
| **低-10** | E2E の後始末（`playwright test` プロセス残留） | **不採用（成果物の欠陥ではない）** | **本サブの成果物ではなく実行環境の運用上の穴である。** ★ただし実害は認めるため、取り込みの手番で残留プロセスとポート占有の有無を確認し、`web/test-results/` の残骸を掃除した。**恒久の対処（停止しない `playwright test` の後始末）は本サブの射程外であり、設計伝達レポート §4 へ申し送る** |

### 指摘 9（完了報告 §5 がレビュー開始時点でプレースホルダだった）について

**★是正済みであり、レビュー自身が「内容は十分である」と結論している。⇒ 追加の対処は行わない。**

**★★ただし記録として受け止める点が 1 つある**——`D-510` は「レビュー結果を参照する欄は Phase C の後に埋める」を求めているが、**`<!-- TESTS -->` は*実装から書ける欄*であり、Phase A の直後に埋められた**（`D-510` の表の左列）。**⇒ プレースホルダにしてよかったのはレビュー欄（§9）だけであり、テスト結果の欄を同じ扱いにしたのは誤りである。** 本取り込みで §5 は実測で埋まっている。
