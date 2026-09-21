# M28-01 レビュー報告書

| 項目 | 内容 |
|------|------|
| 対象指示書 | `docs/instructions/M28-01-official-name-rename.md` v1.0.1 |
| チェックリスト | `docs/instructions/reviews/M28-01-review-checklist.md` v1.0.0 |
| 対象完了報告 | `docs/progress/M28-01-completion-report.md` |
| 着手基点 | `fae8118e6d840e1174acc7be782463fadd8b483a` |
| レビュー実施日 | 2026-09-05 |
| レビュー時 HEAD | `dafa33f` |

## 総評

チェックリスト §8 の重大 8 項目はいずれも該当なし。歴史記録の 0 差分・検査スクリプトの非改変・移行の順序(複製 → 検証 → 退避)・旧ディレクトリの非削除は、報告を信じずに `git diff` と実行で独立に確かめて、すべて成立していた。`go build` / `go vet` / `go test ./...` / `pnpm test`(2373 件) / `make e2e`(239 passed)も自分で回して緑を確認した。
データ移行の設計は、素朴な実装が静かに壊れる箇所(WAL の取り残し・「空でなければ skip」・退避と config 書き換えの順序)を先回りして潰しており、退けた案を理由つきで残している点を含めて水準が高い。破壊確認(検証を無力化して赤くなることを見る)も実際に行われている。
一方で、高が 6 件ある。5 件は「現役の文書・コメントに、実装と食い違う記述が残った/新たに書かれた」型であり、1 件は移行の orchestration に残る実データ喪失の経路である。後者は `prepareDataDir` と `config.RewriteRelocatedPaths` にテストが 1 本も無いことと同根で、本サブで最も順序が効く関数が唯一の未テスト領域になっている。

## 設計準拠性レビュー結果

### 束 A — 置換の過不足: ○

| # | 観点 | 評価 | 内容 |
|---|---|---|---|
| A-1 | 母数の区分別・前後 | ○ | 6 区分 + 追加区分で前後が出ている。ただし §2 の歴史記録内訳が合計と合わない(中-6) |
| A-2 | 綴りの揺れ | ◎ | 初回の数え落とし(`combmgr`)を含めて経緯ごと開示し、以後は 1 本のパターン + 排他分割 + 未分類 0 の形へ是正している |
| A-3 | module path と全 import | ◎ | `go.mod` / ルート embed ホルダ 3 本の `package` 名 / `_test.go` を含む import まで追随。`//go:embed` は相対のため不変で正しい。`go build -tags=embed_web ./...` と `-tags=debug ./...` も自分で通した |
| A-4 | `check-*.sh` を 1 本ずつ | ◎ | `git diff fae8118 -- scripts/check-*.sh` は 1 行も出ない。`check-browser-storage-keys.sh` の 2 件を「規約外キー名の実例だから据え置く」と判断したのは正しい |
| A-5 | ベースラインの非改変 | ◎ | 5 本のベースライン値(`101` / `436` / `78` / `14` / `28`)はいずれも未変更。**さらに壊して赤くなることまで見た**(下記) |
| A-6 | Makefile / CI / 成果物名 / config.toml.example | ◎ | 成果物名 3 点・artifact 名・E2E の DB/config パス・env 4 本まで一貫している |
| A-7 | 定数化されていない直書きの報告 | ◎ | 報告のみで勝手に定数化していない。射程の守り方として正しい |

A-5 の確認方法(チェックリスト §7-2): スクリプト本体は変更せず、`scratchpad` へコピーしてベースライン値だけを差し替えて実行した。

- `check-md-emphasis.sh` の `BASELINE_BROKEN` を 436 → 400 にしたコピーは `NG ベースラインから 31 行増加` を返した。
- `check-import-order.sh` の `BASELINE` を 101 → 102 にしたコピーは `OK` を返した(現在値 102 に一致)。

いずれも値に反応しており、リネームで無力化されてはいない。

### 束 B — 歴史記録の非改変: ◎

`git diff --stat fae8118 -- <対象>` を区分ごとに自分で回し、次はすべて出力 0 行だった。

`docs/change-notes/` / `docs/handover/session-prompts/` / `docs/handover/design-reports/` / `docs/handover/archive/` / `docs/instructions/phase1/` / `phase2/` / `phase3/` / `docs/process/parallel-board.md` / `docs/design/` / `.claude/` / `.agents/` / `docs/human-notes/` / `docs/handover/followup-backlog.md` / `migrations/`。

`docs/progress/` の差分は新規の完了報告と `progress-log.md` への 14 行追記のみで、既存の完了報告・レビュー報告は 1 本も動いていない。削除ファイルは 0 件、新規 15 本はすべて `deletions = 0`(`git diff --numstat --diff-filter=A` で実測。教訓 `E-225` の型は踏んでいない)。`cmd/combomgr/` → `cmd/tacpendium/` は Git が rename として認識している。

ただし 1 件だけ線引きの確認が要る(中-8)。`docs/audits/20260804-resource-exhaustion-audit.md` という日付つきの監査記録が書き換わっており、完了報告はこれを開示していない。

### 束 C — データ移行: ○

| # | 規則 | 評価 | 内容 |
|---|---|---|---|
| C-1 | 4 経路のテスト | ◎ | a / a2 / a3 / b / b2 / c / d1 / d2 に加えて二重起動・中断 2 種・退避衝突・検証層の単体まである。すべて `t.TempDir()` の実ファイルで、モックにしていない |
| C-2 | (d) で何も動かさずに止まる | ○ | `assertNothingMoved` が退避なし・sha256 一致・旧 DB が開けること・移行先の不在・作業領域とロックの不在まで見る。**ただし WAL にコミットが残っている状態の (d) が無い**(高-5) |
| C-3 | 順序 | ○ | `Migrate`(複製 → 検証 → 確定)→ config 書き換え → `RetireOld` の順で、退避が先に来ることはない。**ただし config 書き換えが no-op でも退避する**(高-6) |
| C-4 | WAL / SHM | ◎ | `wal_checkpoint(TRUNCATE)` の 3 列を読んで `busy` と未畳み込みを検出、DB 本体は `VACUUM INTO`、移行元・移行先の双方で `-wal` / `-shm` の不在を確認。取りこぼしの経路を塞いでいる |
| C-5 | config.toml | ○ | 「移す対象が無い」ことを実査して開示し、絶対パスの書き換えのみを実装した判断は妥当。実装は `config.RewriteRelocatedPaths`。**テストが 1 本も無い**(高-6) |
| C-6 | 起動ログと画面に 1 度だけ | △ | 経路 a は 1 度だけで正しい。**経路 b / d は毎起動で告知ファイルを上書きするため、閉じても復活する**(中-1) |
| C-7 | 二重起動・中断 | ○ | 寿命つきロック + 毎回ユニークな作業領域 + 掃除。「中断したら旧が正本のまま残る」は成立。**ただし確定の途中で失敗すると自力で復帰できない**(中-3) |
| C-8 | 旧を消していないか | ◎ | 削除は無い。退避先の衝突時も既存を上書きしない(`-HHMMSS` → `-2`…) |

### 束 D — 既存の破壊(非破壊性): ◎

自分で回した結果。

| 検証 | 結果 |
|---|---|
| `go build ./...` / `go vet ./...` | 通過 |
| `go build -tags=debug ./...` / `-tags=embed_web ./...` | 通過 |
| `go test ./...` | green |
| `cd web && pnpm test` | green(210 ファイル / 2373 件) |
| `make e2e` | green(239 passed / 4.0m) |
| `check-artifact-integrity` / `check-instruction-format` / `check-doc-refs` / `check-stop-discipline` / `check-progress-log-index` / `check-doc-inventory` / `check-browser-storage-keys` / `check-enum-sync` / `check-md-emphasis` | 違反なし |
| `check-import-order` | NG(102 / 101)。**着手基点から NG であることを独立に確認**——違反 102 ファイル全件に `git diff fae8118 -- <file>` を回し、import 行の増減が 1 件も無いことを実測した |

### 束 E — テストの妥当性: ○

- 移行テストは実ファイル。`Params.CopyDB` の差し込み口は「壊れたコピー」「1 行足りないコピー」を作るために使われており、モックで検証を素通りさせてはいない。
- パス・版数を名指しするテストの失効(`D-714` と同型)は起きていない。`internal/infra/db/db_test.go` の期待値変更は既定パスが実際に変わったための正当な更新であり、加えて `TestLegacyResolveDBPath_IsTheOldDefault` / `TestDataDirNames_AreDistinct` で「旧名が新名に引きずられたら赤くなる」網を新設している。移行の要である旧既定名を固定した判断は良い。
- 既存テストの期待値を通すために書き換えた形跡は無い(変更はいずれも表示名・パス・env 名の実変更に対応)。
- 欠けているのは 3 つ。`prepareDataDir` / `config.RewriteRelocatedPaths` / フロントの `DataMigrationBanner`・`useDataMigrationNotice`。

### 束 F — ドキュメント・進捗ログ: ○

- 完了報告は §3 の 7 項をすべて形として満たしている。とくに §7「確かめられなかったこと」が実機移行・Windows/macOS・nightly の 3 点を断定に化けさせずに書いてあるのは良い。
- `progress-log.md` への索引追記あり(`check-progress-log-index.sh` 緑)。
- 減点は 2 つ。歴史記録の内訳が合計と合わない(中-6)ことと、「現役ドキュメントに 46 件残っている」の内訳が無いこと(中-7)。後者に高-1〜高-3 が埋もれている。

## 設計準拠性以外の指摘事項

- `web/CLAUDE.md` §1.5 違反が 1 件(中-4)。`queryKey` の配列リテラルを feature 側に書いており、既存の機械ガードは形の違いで素通りする。
- `CLAUDE.md` §4 の定数化については、直書きを勝手に定数化せず報告に留めたのは正しい。ただし `internal/api/comboio/handler.go:62` の `tacpendium-export.zip` と `web/src/components/Header.tsx:68` の表示名直書きは、次に名前を触るときに同じ捜索を繰り返すことになるため、`followup` 候補として設計卓へ渡すのが望ましい。
- セキュリティ: 新設した `GET /api/notices/data-migration` は絶対パスを返す。既定 `password_enabled = false` では素通しであり、lan モードでは LAN 内の任意端末から読める。既に `GET /api/config` が `database.path` を同条件で返しているため露出の種類は増えていないが、コードのコメントが「認証で保護されているから絶対パスを載せてよい」と述べている点は誤りである(高-4)。
- 新規依存の追加は無い(`go.mod` の require は module 行以外に差分なし)。ライセンス面の新規論点なし。
- `console.log` / `fmt.Println` の本番残置なし。`fmt.Fprintln(os.Stderr, ...)` はロガー初期化前の経路で意図的なものであり、理由がコメントにある。

## 推奨修正(優先度別)

### 高(M28 完了前に修正必須)

- **高-1 現役テンプレートに旧名が残っている。** `docs/instructions/templates/M{N}-{NN}-{slug}.template.md:435` が `go run ./cmd/combomgr`、同 `:441` が `logs/combomgr.log` を指す。これは完了済みサブの記録ではなく、**次の指示書がコピーする元**である。完了報告 §2 は `docs/instructions/` 直下 124 件を一律「完了済みサブの記録」と判断しているが、`templates/` はその判断の対象外である。指示書 §2.2-5 の「現役のドキュメント」に当たるため本サブで直す。
- **高-2 現役の運用文書が、本サブで変えたスクリプトと食い違っている。** `docs/process/remote-ops.md:90` が「`scripts/wt-new.sh` が `[database].path`(`./combomgr-dev.db`)を書き換えた `config.toml` を生成する」と書くが、本サブで同スクリプトは `./tacpendium-dev.db` を書くようになった(`scripts/wt-new.sh:69`)。同書は `CLAUDE.md` §7 から参照される現役の手順書である。
- **高-3 現役の playbook に旧 env 名が残っている。** `docs/handover/design-instruction-playbook.md:1818` の表が、E2E のポートの決まり方を「`COMBOMGR_PORT` が env で明示的に渡され、env がファイルに勝つ」と現在形で説明している。実体は `TACPENDIUM_PORT`(`internal/config/config.go:34`)。同ファイルの `:1756` / `:1844` は「実例(`M24-09c`)」の叙述であり当時の記録として残してよいが、`:1818` は仕組みの説明であり失効している。
- **高-4 コメントが述べる保護が既定構成では成立しない。** `internal/api/notice/handler.go` の `Response` 注記と `internal/api/notice/routes.go` の `RegisterRoutes` 注記が「本ルートは `/api` グループ配下であり認証ミドルウェアの保護対象である」「lan モードで未認証の相手へファイルシステムの構造を渡さないためにこの置き場所を選んでいる」と述べる。しかし `internal/api/middleware/auth.go` の `Auth` は `validator.Enabled()` が false のとき素通しであり、`password_enabled` の既定は false である。**⇒ 既定では未認証で読める。** 実害は `GET /api/config` の既存露出と同程度で新種ではないが、この注記は「絶対パスを載せてよい根拠」として書かれており、後任がそのまま信じる。注記を実態に合わせる(既定では素通しであること、それでも載せる/載せない理由)か、`From` / `To` / `RetiredTo` を既定構成では返さない形にすること。
- **高-5 不変条件の記述が literal には成立していない。** `internal/infra/datadir/doc.go` が「旧ディレクトリは、検証が通るまで 1 バイトも動かさない」と宣言しているが、実際には検証より前に 2 つの書き込みが起きる。(1) `acquireLock`(`lock.go`)が旧ディレクトリ直下に `.migrating.lock` を作る。(2) `checkpointWAL`(`copy.go`)の `PRAGMA wal_checkpoint(TRUNCATE)` は WAL の内容を**移行元 DB 本体へ書き戻す**。どちらも移行のために必要な処理であり実装を変える必要は無いが、**記述が実装より強い**。加えてテスト側にも同じ穴がある——`assertNothingMoved` は sha256 の一致で「1 バイトも変わっていない」と主張するが、(d1) / (d2) の元 DB は `seedDB` が正常終了した後の状態で WAL フレームを持たないため、checkpoint が書き込む経路を一度も通っていない。⇒ (a2) と同じ作り方で「WAL にコミットが残ったまま検証に失敗する」1 本を足し、そこで実際に何が保証されるのか(旧が使える状態で残ること)を書き直すこと。
- **高-6 config 書き換えが空振りしても旧を退避する。** `cmd/tacpendium/main.go` の `prepareDataDir` は、`config.RewriteRelocatedPaths` が `changed = false` を返しても `datadir.RetireOld` を呼ぶ。ところが移行の判定 `datadir.UsesLegacyDefault`(`decide.go` の `samePath`)は `EvalSymlinks` と Windows/macOS での大小無視で正規化するのに対し、書き換え側の `relocatePath` / `withinRoot`(`internal/config/config.go`)は**純粋な字句一致**である。両者が食い違う綴り(シンボリックリンク経由のホーム、Windows のドライブ文字の大小など)で `database.path` が書かれていると、「**移行はする / config は書き換わらない / 旧は退避される**」が成立する。その次の起動で `cfg.Database.Path` は消えた旧パスを指し、`migration.Run` が親ごと作り直して SQLite が空の DB を新規作成する——`RetireOld` の注記自身が「利用者から見るとコンボが全部消えたように見える」と警告している、まさにその経路である。`TACPENDIUM_DB_PATH` に旧既定を渡した場合(ディスクの `config.toml` には書き換える対象が無い)も同じ形になる。
  - 直し方の案: `cfg.Database.Path != "" && !changed` のときは退避しない(次回起動は経路 b で旧を使い続ける)、または退避の直前に「これから開く `dbPath` が実在すること」を確かめる。
  - **あわせて `prepareDataDir` と `config.RewriteRelocatedPaths` にテストを足すこと。** 本サブで最も順序が効く 2 本が、唯一テストの無い領域になっている(`grep` 実査で参照は 0 件)。`datadir` 側の 683 行のテストは、この 2 本を 1 度も通らない。

### 中(M29 着手と並行可)

- **中-1 告知が「1 度だけ」になっていない経路がある。** `prepareDataDir` は `datadir.NoticeFor` が真を返すたびに `WriteNotice` で告知ファイルを無条件に上書きする。`Notice.Acknowledged` は初期値 false なので、経路 b(新旧の両方が在る)と経路 d(検証失敗)では**起動のたびに ack が消え、閉じたバナーが復活する**。経路 a は移行後に旧が退避されて以後 `no_legacy_dir` になるため、実際に 1 度だけで済んでいるのは経路 a だけである。既存の告知が同じ `status` と `at` を持つなら上書きしない、といった手当てが要る。
- **中-2 経路 b のバナーの題が事実と食い違う。** `NoticeFor` は `skipped` + `new_db_exists` でも告知を作る(黙らせない判断自体は正しい)。しかし `web/src/features/data-migration/DataMigrationBanner.tsx` は `failed` 以外をすべて `dataMigration.title`「データの保存場所が変わりました」として出すため、**何も移していない状態で「移した」と読める題**が本文「移行先に既存のデータがあるため移行しません」と並ぶ。`skipped` 用の題を `ja.json` / `en.json` へ足すこと。
- **中-3 確定の途中で失敗すると自力で復帰できない。** `commitStaging` の「移行先が既に在る」枝は、非 DB ファイルを 1 つずつ rename してから最後に DB を置く。途中で失敗すると移行先に非 DB ファイルだけが残り、`committed` が false のまま作業領域は消える。次の起動は `Decide` が再び `Proceed` を返した後、`pathExists(dst)` に当たって `移行先に "…" が既に在ります` で必ず失敗する。旧は無傷なので実害はデータ喪失ではないが、**以後ずっと赤いバナーが出続け、利用者向けメッセージに手当ての案内が無い**。移行先の同名ファイルは上書きしてよい(検証済みの複製である)か、メッセージに「移行先の残骸を消してから起動し直す」旨を入れること。
- **中-4 `queryKey` の正本規約に反している。** `web/src/features/data-migration/useDataMigrationNotice.ts:7` が `export const dataMigrationNoticeKey = ["notices", "data-migration"] as const;` を feature 側に定義している。`web/CLAUDE.md` §1.5 は「画面・フックの側で配列リテラルを書かないこと」を無条件で求めており、正本は `web/src/lib/query-keys.ts` である。既存ガード `web/src/lib/query-keys.convention.test.ts` が緑なのは、同ガードが `queryKey:\s*\[` と `(setQueryData|removeQueries)\s*\(\s*\[` しか見ず、**定数へ逃がした形を検出できない**ためである。⇒ キーを `queryKeys` へ移し、`query-keys.invalidation.test.ts` の表にも載せること。ガードの穴は followup 候補として設計卓へ。
- **中-5 フロントに 1 本もテストが無い。** `DataMigrationBanner.tsx` は失敗/成功の色分け・`retiredTo` / `retireFailed` の 2 分岐・ack の副作用を持つ。`CLAUDE.md` §5 の「主要ロジック持ちのコンポーネント」に当たる。`useDataMigrationNotice` の 204 → `undefined` の扱いも押さえておきたい。E2E も 1 本も無いため、バナーは現在どの層でも実行されていない。
- **中-6 完了報告 §2 の歴史記録の内訳が合計と合わない**。 表の各行を合計すると 1061 出現 / 207 ファイルだが、同表と §1.3 は 1150 出現 / 229 ファイルと書いている。ボードの行も、実測は `docs/process/parallel-board.md` に 26 出現(着手基点)だが 17 と書かれている。0 差分そのものはレビュー側で独立に確認できたので結論は動かないが、**指示書 §3-2 が求めるのは、数えて示すことである**。現状の表は再現できない。
- **中-7 「現役ドキュメントに 46 件残っている」の内訳が無い。** §1.3 の区分表は現役ドキュメントを 90 → 46(10 ファイル)としているが、どのファイルに何が残ったかの一覧が無い。高-1〜高-3 はこの 46 件の中に埋もれていた。§3-2 の「書き換えなかった範囲を明示する」を満たすには、残した 46 件を「他プロジェクト参照」「歴史的叙述」「未着手」に仕分けて出す必要がある。
- **中-8 日付つきの監査記録を書き換えているが開示が無い。** `docs/audits/20260804-resource-exhaustion-audit.md` の 3 箇所(`cmd/combomgr/main.go:109-117` などの根拠行)が `cmd/tacpendium/…` へ書き換わっている。完了報告 §3.4 が開示しているのは runbook 側 1 件のみである。日付つきの監査レポートは「その日に観測した事実」の記録であり、指示書 §0.2 の歴史記録の列挙には入っていないものの、`E-111` 分類 (2) の性格を持つ。**設計卓に `docs/audits/<日付>-*.md` の線引きを確認すること。** 現役の runbook 側を直した判断は正しい。
- **中-9 devContainer のリビルド前起動の実害を、手順として残すこと。** 完了報告 §8 が「リビルド前に起動すると移行先が volume の外になる」と警告している。実際にはもう 1 段悪く、volume のマウント点(`/home/node/.local/share/combomgr`)は rename できないため `RetireOld` も失敗する(非致命なので起動は続く)。結果として「コンテナローカルの新 DB が正本になり、volume の中の実データは取り残される」状態になりうる。開発者の手番であることは変わらないが、`README.md` か devContainer の注記に 1 行残しておくのが望ましい。

### 低(将来対応)

- 低-1 `datadir.Params.CopyDB` は本番の公開 API にテスト差し込み口を開けている。注記で本番は nil と明示してあるので実害は低いが、`internal` の外へ出す型ではない。
- 低-2 `sweepStaleStaging` は `~/.local/share`(移行先の親)直下の `tacpendium.migrating-*` を 1 時間経過で無条件に削除する。接頭辞が固有なので衝突はまず無いが、アプリのデータディレクトリの外を掃除している。
- 低-3 移行先が新規作成される経路では、`os.MkdirTemp` が作った 0700 のディレクトリをそのまま rename するため、データディレクトリの権限が従来の `MkdirAll`(0755)と変わる。安全側だが、経路によって権限が変わる点は把握しておきたい。
- 低-4 完了報告 §3.3 の「違反 102 ファイルの全件について `git diff` を回し、1 件も本サブで変更されていない」は不正確。実測では `useConfig.test.ts` / `useUpdateConfig.test.ts` / `MyComboPage.test.tsx` / `ComparePage.test.tsx` / `SettingsPage.test.tsx` の 5 本が本サブで変更されている。ただし**変更はいずれも文字列の期待値のみで、import 行は 1 行も動いていない**ことをレビュー側で確認したので、結論(本サブ由来ではない)は正しい。
- 低-5 `CLAUDE.md` §3 のディレクトリ概略がリポジトリルートを `tacpendium/` と書くが、開発リポジトリのチェックアウト名は `combomgr` のままである(完了報告 §4.1)。`.claude/commands/*_wt.md` の worktree ガードが `/workspaces/combomgr` を前提にしている以上、当面は食い違いが残る。公開ミラー側の姿を先取りした記述であることを 1 行添えるか、開発リポジトリ名に合わせるか、設計卓の判断が要る。
- 低-6 `useDataMigrationNotice` に `retry: false` が無いため、告知の取得に失敗すると既定の 3 回リトライが走る。生涯 1 度の告知としては過剰。
- 低-7 既存利用者の `logging.file` が相対パス(`logs/combomgr.log`)のままなら書き換わらないため、ログの綴りだけ旧名で残る。データには無関係で無害だが、次に誰かが `logs/tacpendium.log` を探して見つからない。

## 良かった点

- **「素朴に書くと静かに壊れる」箇所を、壊れる理由ごと残している。** `migrate.go` / `copy.go` / `decide.go` の注記にある「採らなかった実装」の表は、レビュー側が経路を追うコストを大きく下げた。とくに `PRAGMA wal_checkpoint(TRUNCATE)` の戻り値 3 列を読む判断、`VACUUM INTO` を選ぶ判断、「移行先が空でなければ skip」を落とすためのテスト (b2) は、いずれも実際に落ちうる経路を先回りして塞いでいる。
- **破壊確認を本当にやっている。** 検証の行数比較を無力化して (d1) と検証層の単体が赤くなることを確かめた記録があり、レビュー側でも同じ手でベースライン検査 2 本の感度を確認できた。「緑であること」ではなく「壊したときに赤くなること」を見る、というチェックリストの要求に正面から応えている。
- **一括置換をせず、`check-*.sh` を 1 本ずつ読んだ。** `check-browser-storage-keys.sh` の `combomgr.foo.v1` を「規約外キー名の実例だから書き換えると例が例でなくなる」として据え置いた判断は、followup `bulk-rename-must-exclude-check-scripts` の趣旨をそのまま満たしている。
- **ベースラインを本サブの手番で下げなかった。** `check-md-emphasis` が「下げてよい」と出すのに従わず、「減らしたのは本サブではない」ことを 8 ファイル個別に実測して据え置いた判断は正しい。
- **旧既定名を固定するテストを新設した。** `TestLegacyResolveDBPath_IsTheOldDefault` / `TestDataDirNames_AreDistinct` は、「移行元の名前が新名に引きずられると、移行は何も見つけないまま静かに成功する」という最悪の経路に網を張っている。リネームのサブでこの網を思いつくのは容易ではない。
- **E2E だけが捕まえた取りこぼしを、教訓として残した。** `playwright.config.ts` の文字列リテラル内のパスが型検査を素通りした件は、次にディレクトリを動かす担当が直接使える形になっている。
- **指示書との食い違いを断定に化けさせずに開示した。** §2.3-4(移す対象が無い)と §2.3-2(止めるのは移行であってアプリではない)を、解釈であると明示して設計卓へ返している。§7 の「確かめられなかったもの」4 件も同様。

## 制約事項

- 本レビューはコード上で判定可能な範囲のみ対象。実際の動作確認・パフォーマンス・実機テストは別途実施が必要。
- とくに次の 3 点はコード上で判定できていない。(1) 開発者の実 dev データディレクトリでの移行、(2) Windows / macOS での `os.Rename` とパス正規化の挙動(高-6 の発火条件そのもの)、(3) nightly-crossbuild が新しい成果物名で通ること。いずれも完了報告 §7-3 が「確かめられなかった」と正しく申告している範囲と一致する。
- 高-6 の発火条件(綴りの食い違い)は、本レビューでも実機再現はしていない。コード上の非対称(`samePath` は正規化する / `withinRoot` は正規化しない)と、`changed = false` でも退避する制御フローから導いた指摘である。

---

## 取り込み結果（自動トリアージ）

`implement_plan_full` Phase C。**「高」の不採用は 0 件**（安全弁の発火なし）。
取り込みは HEAD `dafa33f` の上に積んだ。

### 高（6 件）——**全件採用**

| # | 指摘 | 採否 | 対応 |
|---|---|---|---|
| 高-1 | 現役テンプレートに旧名 | **採用** | `docs/instructions/templates/M{N}-{NN}-{slug}.template.md` の `go run ./cmd/combomgr` と `logs/combomgr.log` を新名へ。**指摘のとおり `templates/` は「完了済みサブの記録」ではなく次の指示書がコピーする元であり、完了報告 §2 の一括判断の対象外だった** |
| 高-2 | `docs/process/remote-ops.md:90` が `./combomgr-dev.db` | **採用** | 新名へ。本サブが `scripts/wt-new.sh` を変えたことで生じた食い違いであり、現役の手順書である |
| 高-3 | playbook `:1818` の `COMBOMGR_PORT` | **採用** | 該当行のみ `TACPENDIUM_PORT` へ。**`:1756` / `:1844` は当時の実例の叙述なので据え置いた**（指摘の切り分けに従った） |
| 高-4 | 認証の注記が既定構成で成立しない | **採用** | `handler.go` / `routes.go` の注記を実態へ書き直した。「保護されている」から **「`password_enabled = false` の既定では素通しであり未認証で読める」** へ改め、それでも絶対パスを載せる理由 2 つ（`GET /api/config` と同条件で露出の種類が増えない ／ 退避先を知らないと開発者が消してよいか判断できない）と、減らす場合の形を併記した。**露出そのものは変えていない** |
| 高-5 | 「1 バイトも動かさない」が literal には不成立 | **採用** | `doc.go` の不変条件を **「検証が通るまで、旧ディレクトリの中身は失われない」** へ書き直し、検証前に起きる 2 つの書き込み（ロックファイル ／ `wal_checkpoint(TRUNCATE)` の書き戻し）を理由つきで明記した。**あわせてテストの穴を塞いだ**——`TestMigrate_D3_VerifyFailsWithPendingWAL_OldDataStillReadable` を新設。WAL にコミットが残った状態で検証を失敗させ、**バイト列ではなく行数で「旧が使える状態で残る」ことを見る**（`combos` 4 行・`tags` 2 行）。`assertNothingMoved` にも sha256 が使える条件を注記した |
| 高-6 | config 書き換えが空振りしても退避する | **採用** | `datadir.ReadyToRetire(resolvedDBPath, oldDir)` を新設し、`prepareDataDir` の退避を **「これから開く DB が、旧ディレクトリの外に、実体として在る」ときだけ** に絞った。**★綴りを網羅しにいく形は採らなかった**——`samePath` と `withinRoot` の非対称は今後も増えうるので、開く先の実在という 1 つの判定で受ける。**テストも新設**（`cmd/tacpendium/datadir_wiring_test.go`。`prepareDataDir` 4 経路 ＋ `ReadyToRetire` 単体） |

**★高-6 の破壊確認**: ガードを `false &&` で無力化して該当テストを回すと
`config が書き換わっていないのに旧を退避した: …combomgr.migrated-20260905 —— 次の起動で空の DB が作られる`
で **FAIL**。復元して green。⇒ 指摘された経路は実在し、ガードは効いている。

### 中（9 件）——**8 件採用 / 1 件は一部採用**

| # | 指摘 | 採否 | 対応・理由 |
|---|---|---|---|
| 中-1 | 告知が経路 b/d で毎起動復活 | **採用** | `datadir.UpsertNotice` を新設し、**同じ状況（`At` を除く全フィールドが一致）なら書き換えない**形に。テスト 2 本（閉じたまま保たれる ／ 状況が変われば復活する）を追加 |
| 中-2 | 経路 b のバナー題が事実と不一致 | **採用** | `dataMigration.skippedTitle` を ja/en へ追加し、題を 3 分岐に |
| 中-3 | 確定の途中で失敗すると復帰できない | **一部採用** | **メッセージに手当ての案内を入れた**（旧データの在処と、消すべきパス）。**上書き許可は採らなかった**——「移行先の同名ファイルは検証済みの複製だから上書きしてよい」は、`commitStaging` に入る時点では成り立つが、**次の起動では別の作業ディレクトリの複製である**。上書きを許すと「移行先に既に在るものを黙って潰す」経路が常設になり、本サブが避けている型そのものになる |
| 中-4 | `queryKey` を feature 側に定義（`web/CLAUDE.md` §1.5 違反） | **採用** | `queryKeys.notices.dataMigration()` を `web/src/lib/query-keys.ts` へ移し、`query-keys.invalidation.test.ts` の `QUERIES` へも登録。**★登録漏れは既存ガードが赤で捕まえた**（`expected [ 'notices.dataMigration' ] to deeply equal []`） |
| 中-5 | フロントに 1 本もテストが無い | **採用** | `DataMigrationBanner.test.tsx` を 7 件追加。**★このテストが実バグを 1 件捕まえた**——`useAckDataMigrationNotice` の `setQueryData(key, undefined)` は TanStack Query では **no-op**（`undefined` は「更新しない」の合図）であり、**閉じてもバナーが消えなかった**。`onMutate` で `acknowledged: true` を書く形へ是正した |
| 中-6 | 完了報告 §2 の内訳が合計と合わない | **採用** | 全行を再実測して合計と一致させた（1150 / 229）。**載せ漏らしていた行が 6 つあり**（`docs/handover/phase1|2|3/` ／ `human-notes` の archive 2 種 ／ `docs/process/archive/` ／ `retrospective-log.md`）、**ボードも 26 を 17 と書いていた** |
| 中-7 | 現役ドキュメント残 46 件の内訳が無い | **採用** | §1.4.1 を新設。他プロジェクト参照 26 ／「(SF6 Combo Manager)」の説明 4 ／ 開発リポジトリのパス接頭辞 13 ／ 当時の記録 2 ／ 意図した識別子 1 = 46。**未着手 0 件** |
| 中-8 | 日付つき監査記録の改変が未開示 | **採用** | §3.4 へ開示（差分 3 行・追随させた理由）。**`docs/audits/<日付>-*.md` を歴史記録として扱うかは設計卓へ確認したい**と明記した |
| 中-9 | devContainer リビルド前起動の実害 | **採用** | `.devcontainer/devcontainer.json` の mount 行へ注記。**指摘のとおり「退避も失敗する」（マウント点は rename できない）まで含めて書いた** |

### 低（7 件）——**2 件採用 / 5 件は理由を付けて不採用**

| # | 指摘 | 採否 | 理由 |
|---|---|---|---|
| 低-4 | 完了報告 §3.3 の「1 件も変更されていない」が不正確 | **採用** | 事実誤りなので訂正。5 本は変更しているが import 行は動いていない旨を明記（結論は不変） |
| 低-6 | `useDataMigrationNotice` に `retry: false` が無い | **採用** | 追加。生涯 1 度の告知に 3 回の再試行は過剰 |
| 低-1 | `Params.CopyDB` が本番の型にテスト差し込み口を開けている | **不採用** | `internal/` の外へ出ない型であり、外部 API ではない。**この口を閉じると (d1)「妥当だが 1 行足りないコピー」が作れなくなる**——本サブで最も重要な検証テストが成立しなくなる。注記で本番 nil を明示済み |
| 低-2 | `sweepStaleStaging` がデータディレクトリの親を掃除する | **不採用** | 掃除対象は自分が作った `tacpendium.migrating-*` 接頭辞のみで、1 時間の寿命つき。**作業領域を移行先と同じ親に置くのは `os.Rename` を同一ファイルシステムに収めるための要件**であり、置き場を変えると `EXDEV` の危険が入る |
| 低-3 | 経路によってデータディレクトリの権限が 0700 / 0755 で変わる | **不採用** | **安全側への差であり、直すと緩める方向になる**。個人利用のローカルアプリのデータディレクトリとして 0700 は妥当。ただし把握しておく価値はあるので本表に残す |
| 低-5 | `CLAUDE.md` §3 のルートが `tacpendium/` だが実チェックアウトは `combomgr` | **不採用（設計卓・開発者の手番）** | 開発リポジトリ名の扱いは開発者の運用判断であり、`.claude/commands/*_wt.md` の worktree ガード 5 本と併せて決める必要がある（§8 開発者手番 6）。**製造が片側だけ動かすと食い違いが増える** |
| 低-7 | 相対パスの `logs/combomgr.log` は書き換わらずログの綴りだけ旧名で残る | **不採用** | **意図した挙動である**。相対パスはカレントディレクトリ基準でありデータディレクトリとは無関係なので、`relocatePath` は絶対パスだけを対象にしている。利用者が明示した設定値を勝手に書き換えない方が安全。**完了報告 §7 へ既知の見え方として残す** |

### 再レビュー往復

**0 回**（初回レビューで重大 0 件・高 6 件がすべて採用のため、往復上限 2 回には達していない）。
`docs/handover/followup-backlog.md` §J への停止時記録は**不要**（未解消の指摘が無い）。

### ★設計卓・開発者へ回した事項（本サブでは実施しない）

1. `docs/audits/<日付>-*.md` を歴史記録として扱うかの線引き（中-8）
2. `query-keys.convention.test.ts` が「定数へ逃がした形」を検出できない穴（中-4 の指摘。followup 候補）
3. `internal/api/comboio/handler.go:62` と `web/src/components/Header.tsx:68` の直書き（followup 候補）
4. `CLAUDE.md` §3 のリポジトリルート表記（低-5）
