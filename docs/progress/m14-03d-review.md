# M14-03d レビュー報告書

| 項目 | 内容 |
|------|------|
| 対象指示書 | `docs/instructions/M14-03d-second-wave-manon.md` v1.0.2 |
| チェックリスト | `docs/instructions/reviews/M14-03d-review-checklist.md` v1.0.1 |
| 対象完了報告 | `docs/progress/m14-03d-completion-report.md` |
| 実施日 | 2026-07-31 |
| 作業ツリー | `wt/m14-03d`（レビューはコード非改変・読取のみ） |
| 判定 | **条件付き承認**（§9 重大ゼロ。ただし「高」2 件＝**完了報告の記述是正**が必要。コード修正は不要） |

---

## 総評

本サブの核である §4.3 のアクセント検証は、完了報告の実測値を CSV から独立に再計測したところ **(a)〜(e) すべて 0 件・最長 code 27 字・72 行/20 列** が完全に一致し、判定【解あり】は根拠付きで妥当である。変換規則の無改変も `-check` を 4 通り（既定 000026 と生成 3 本）走らせて byte-identical を確認し、`internal/seedgen` の非テストコード・`internal/moveindex`・`cmd/seedgen` に差分ゼロであることを `git status` で裏取りした。`move_code` の是正はゼロ、移動 9 種の他キャラ再投入もゼロ、既存マイグレ 000001〜000042 は 1 本も改変されていない。

指示書 §3.2 の前提崩れ（manon が `characters` に不在）の主張は**事実である**と独立に検証した。`INSERT INTO characters` を持つマイグレは 000003/000009/000014/000024/000043 のみで、000043 以前に manon を投入するものは存在しない。追加した 000043/000044 は 000024/000025 の形を忠実に踏襲し、`WHERE c.code = 'manon'` で manon 限定に閉じている。移動 move の `total` を NULL のままとする裁定も、000041 が c_viper/dhalsim を NULL のまま残している実態と整合しており、`migrate_m1802_test.go:55` の「移動 total 非 NULL = 50（10 キャラ × 5）」を壊さない。

`punishfinder` の canary は「数字だけ合わせた」ものではない。増分の内訳アサート（`juri`/`ken` の `neutral_jumping_heavy_kick` 2 件）と `wantUniqueAerial=7` が据え置かれたまま green である以上、再計測は実際に行われている。テスト改名も「seed 追加のたびに名前が実態とずれる」という構造問題への正しい対処であり、スコープとして妥当と評価する。配布 blocker を解除したという記述も無い。

一方で、**完了報告の実測値に 1 箇所の誤り**（§3.1 の 000035 bare-button 件数）があり、**`moves.is_projectile` の manon 分 backfill 要否の検証記録が欠落**している。いずれもデータ状態は正しく、報告の記述と第三波への申し送りを直せば済む。

---

## 設計準拠性レビュー結果

### §1. 【最重要】§4.3 の実地検証と判定 — ◎

- **実測表（(a)〜(e)）**: 完了報告 §1.1 に件数＋実例あり。`character_data/manon.csv` から独立に再計測し**全項目一致**を確認した。
  - (a) 正準形違反 `^[a-z0-9_]+$`：**0**（非 ASCII も 0 文字）
  - (b) アクセント由来の破損：**0**（`À Terre`→`a_terre`／`Étoile`→`sa2_etoile`／`Révérence`→`reverence` と語頭が保持）
  - (c) 40 字超：**0**（最長 27 字 `rush_crouching_medium_punch`）
  - (d) `move_code` 重複：**0**／(d′) `name_ja` 重複：**0**
  - (e) `CA `・`SA*_` 接頭語：欠落 **0**（`sa1_arabesque`/`sa2_etoile`/`sa3_pas_de_deux`/`ca_pas_de_deux`）
- **判定**: 完了報告 §1.3 で **【解あり】AI 補正で埋まっている** と明示され、根拠（(a)〜(d) が全 0・語頭アクセントの 1 行照合）が添えられている。「概ね問題ない」型の曖昧な結論ではない。**チェックリスト §9 の最重要項目はクリア**。
- **input-tool 非改変**: 別 go module への変更は皆無（`git status` で `character_data/` 以外に該当なし）。報告のみに留めている。
- **第三波申し送り**: 完了報告 §1.4 に表であり。「括弧の過長 code」「luke 公式英語名」を**本サブでは検証できていない別経路**と正直に区分している点は良い。
- 軽微: §1.2 の対応表の「ほか 4」表記が実件数とずれる箇所がある（`manege_dore_*` は計 4 行、`renverse_*` は feint 含め計 8 行）。読解に支障はないが件数表記としては不正確。

### §2. `move_code` を是正していない — ◎

- HEAD 版と作業ツリー版の `move_code` 列を全行 diff したところ、**差分は開発者追加の `temps_lie` 1 行のみ**。再採番・自動リネーム・自動修正はゼロ。
- 正準形違反が 0 件だったため「生成を止めて報告」の発動条件には至っていない（正しい）。
- dup スキャンは 3 軸すべて 0 件で生成 fail せず。自動リネーム・自動 skip の痕跡なし（`migrations/000045_seed_moves_manon.up.sql` に `_2` 等のサフィックス無し）。
- `name_ja` の誤字 2 行（ひらがな「べ」U+3079 → カタカナ「ベ」U+30D9）の修正は `git diff character_data/manon.csv` で確認。**`move_code` には一切触れていない**。開発者の明示承認済み例外として妥当。

### §3. 変換インフラの再利用（「二度作らない」） — ◎

- **既定生成物 000026 の byte-identical**: `go run ./cmd/seedgen -check` を実行し `OK: 生成物は既存ファイルと一致 / 投入 moves 合計 = 752 / 索引キャラ数 = 9 / drop 移動move = 0` を再現。
- **生成 3 本も byte-identical**: 完了報告記載の再生成コマンドをそのまま `-check` 付きで実行し、000045（72 moves）/000046（27 code）/000047（45 keys）すべて一致を確認。
- **非改変の裏取り**: `git status --porcelain internal/seedgen internal/moveindex cmd/seedgen` の出力は `?? internal/seedgen/generate_m1403d_test.go` **のみ**。変換規則コード・索引器・CLI に差分ゼロ。
- **golden 1 本/生成マイグレ 1 本**: `internal/seedgen/generate_m1403d_test.go:38/52/66` に 3 本。`-note` 文字列は `const`（同 :19-21）に実値でピンされ、再生成コマンド全文が doc コメント（:37/:50-51/:64-65）に固定されている。ヘルパは既存 `assertGolden`/`repoRoot`/`ReadFile` の再利用で新規ヘルパを作っていない。
- golden の再現経路が CLI と等価であることも確認した。`cmd/seedgen/main.go:108` の `GenerateWithHeader(charOrder, rowsByChar, CustomHeader(stem, *note))` と、テスト側 `generate_m1403d_test.go:39-40` が同一。単独キャラの `ReadFile(path, 0)` も CLI の `next=0` と一致する。
- FR704 の維持: `internal/seedgen` を import する非テストコードは `cmd/seedgen/main.go:33` のみ。本体ランタイムへの取込経路の復活なし。

### §4. seed の健全性 — ○

- **新規連番 000043〜000047**、既存マイグレ非改変（`git status --porcelain migrations` に tracked の modified なし）。消費連番は完了報告 §4.1/§7.4 に明記され「後続は 000048 から」も記載済み。
- **alias が対**: `migrations/000045_seed_moves_manon.up.sql:109-187` で 72 件、`000044:49-70` で 9 件。`migrate_m1403d_test.go:83-88` が「alias 欠落 0」を機械固定。生 code フォールバックはデータ層で排除されている。
- **FK 依存順**: up は characters(000043) → moves → preset_aliases/move_commands。down は逆順で、`000044.down.sql:9` / `000045.down.sql:8` / `000047.down.sql:9` が**子行を明示 DELETE** している（マイグレ接続は FK=OFF のため CASCADE に頼れない、という retrospective-digest §5 の定型を正しく踏まえている）。
- **移動 9 種の非再投入・`drive_parry` 通過**: `manon.csv` の `category=system` は `drive_parry` 1 行のみ（独立確認）。seedgen の drop は 0 件で、投入元は 000044 のみ。`migrate_m1403d_test.go:185-189` が他キャラ 12×9=108 の不変を固定。
- **clean 構築**: `internal/testutil/dbtest`（`t.TempDir()` + embed FS）および `newMigrator`（`migrate_m1403b_test.go:17-36`、同じく `t.TempDir()`）を使用。**dev DB 残渣が構造的に混入しない**構成であり、証跡として妥当。dev 反映時の退避＋バックエンド再起動の注意も完了報告 §4.3 に記載されている（既知の落とし穴への正しい配慮）。
- **down 整合・冪等性**: `TestRun_M1403d_DownRestoresPreState` が v42 復帰と再 up を検証。`go test ./...` 全 green・`go vet ./...` クリーンを当方でも再現。
- **【中】down テストが HEAD 依存**: `internal/infra/migration/migrate_m1403d_test.go:209` の `m.Steps(-5)` は直前の `m.Up()`（= HEAD=47 前提）に依存する。**次のマイグレ（M14-03e の 000048 以降）が入った瞬間に着地点が 43 へずれて落ちる**。既存の同種テストは絶対版数指定を使っており（`migrate_m1802_test.go:13`→`:29`、`migrate_m1702_test.go:11`→`:34`、`migrate_m1801_test.go:24`→`:46`）、本テストだけが `Up()` 起点。`m.Migrate(47)` → `m.Migrate(42)` に置き換えるのが repo 慣習に沿う。失敗は loud（サイレント pass ではない）ため中位。
- **【中】他キャラ非波及アサートも同じ時限性**: 同ファイル `:187` の `12*9` と `:192` の `530` は `c.code<>'manon'` で絞っているため、**第三波でキャラが増えるたびに機械的に壊れる**。既知 10/12 キャラの code を明示列挙する形にすれば、以後の波で書き換え不要になる。
- **【高】`moves.is_projectile` の manon 分 backfill 要否が完了報告に無い**: `migrations/000039_add_moves_is_projectile.up.sql:10-11` が「**未 seed の manon/luke（true 5 件）は本マイグレ対象外＝M14-03d/e の seed 投入時に別途 backfill する（seedgen が is_projectile を出力しないため自動反映されない）**」と、本サブを名指しで担当に指定している。実際 `000045_seed_moves_manon.up.sql:8` の INSERT 列に `is_projectile` は無い。当方で `manon.csv` を実測した結果 **`is_projectile=true` は 0 行** で、既定値 0 のままが正しく **DB 状態は正常**である。しかし完了報告 §3 の 11 項目にも §5 申し送りにも本件の記載が無く、**「検証して不要と判断した」のか「見落とした」のかが読み手に区別できない**。詳細は「推奨修正（高）」参照。

### §5. 非破壊 — ○

- **スキーマ変更ゼロ**: 000043〜000047 に DDL（CREATE/ALTER/DROP）なし。CHANGE 起票不要の前提を踏まえている。
- **他キャラ非波及**: `TestRun_M1403d_OtherCharsUnaffected` が v42 → HEAD のスナップショット比較で全キャラの (moves, alias) 不変を検証。ryu・第一波 9 キャラへの差分なし。既存 000035 索引 530 件の不変も固定。
- **既存マイグレ非改変**: `git status --porcelain migrations` の tracked modified はゼロ（新規 10 ファイルのみ untracked）。
- **【中】`make e2e` 非回帰の再現性**: 当方で独立実行した結果は **56 passed / 11 flaky / 1 failed（`make e2e` 終了コード 1）** で、完了報告 §4.6 の「63 passed / 5 flaky / 0 failed / 終了コード 0」を再現できなかった。総テスト数は 68 で一致しており、spec 構成の差ではなく安定性の差である。
  - 失敗は `web/e2e/m17-05c-pdf-pagination.spec.ts:80`（「単独コンボの PDF は 1 ページのまま」）。失敗箇所は本体アサートではなく**フィクスチャ API**で、初回は同 spec 29 行目の `expect(res.ok())`（POST `/api/combos`）、retry は 104 行目の DELETE `/api/combos/:id` が非 OK。**manon にも seed にも触れない spec**（自前でドラフトコンボを作る）であり、**本サブの変更に起因するものではない**と判断する。同 spec は完了報告の flaky 一覧にも既に載っている。
  - ただし報告の「0 failed」という断定は環境依存で成立しない。baseline の書き方を「全 green ＋ 既知 flaky（負荷時は `m17-05c` が retry を使い切ることがある）」へ改めるのが正確。

### §6. `is_aerial` の検算 — ◎

- 完了報告 §3 の項目 6 に「該当 0 件」と根拠あり。当方でも `manon.csv` を実測し、`is_aerial=true` は `jumping_light/medium/heavy_punch/kick` の **6 行のみ（すべて `category=normal`）** であることを確認した。manon は空中必殺技を持たず、「`is_aerial=false` かつ command が単方向＋ボタン かつ 空中でしか出ない技」は存在しない。
- CSV 側の是正提案は不要、本体に規則を足していない（`internal/moveindex`・`internal/service/inputresolve` に差分ゼロ）。`lily/great_spin`・`kimberly/elbow_drop` 型の索引衝突リスクは manon には無い。

### §7. E2E・ドキュメント — △

- **【中】画面18 での manon 表示・編集の直接証跡が無い**: 指示書 §5.2／チェックリスト §7 の第 1 項は「manon の moves が画面18 で表示・編集でき、alias が効いて生 code フォールバックが出ない」を求めている。`web/e2e/` 27 spec を grep したところ **`manon`／`マノン` の参照は 0 件**で、manon を通す E2E は存在しない。完了報告は DB 層の「alias 欠落 0」（`migrate_m1403d_test.go:83-88`）で代替しているが、**代替である旨が明示されていない**。alias 対の担保という観点では機械的に十分（生 code フォールバックの発生条件そのものを潰している）ため許容範囲だが、DoD のチェックを付ける前に「E2E 直接証跡なし・DB 層アサートで代替」と書くべき。
- **【高】完了報告 §3.1 の bare-button 実測値が誤り**（詳細は「推奨修正（高）」参照）。
- **【中】`docs/handover/code-facts.md` §10-1 のマイグレ一覧が 000042 止まり**（000043〜000047 未反映）。同節は「**新規マイグレーションの次の連番はここで確認する**」と自称しているため、放置すると次サブが 000043 を選んで衝突する。**本サブが踏んだ「指示書の連番が古い」事故と同型の罠**を、今度は派生資料側に残すことになる。派生資料の更新は製造の責務外ではあるが、M14-03e 着手前に `/regen_code_facts` を回す必要がある。
- **良**: 完了報告に Plan Mode 確定 11 項目（§3）・実測と判定（§1）・dup スキャン結果（§4.2）・残キャラ網羅表（§6）・`is_aerial` 検算（§3 項目 6）がすべて収録されている。**配布 blocker は本サブでは解除しないと §6 末尾に明記**されており、チェックリスト §9 の該当項目に抵触しない。
- **良**: 製造は DES を直接編集していない（`git status` に `docs/design/` の差分なし）。
- **禁則表現の grep**: 新規/変更 13 ファイルに対し「起き攻け」「DR 略記」「簡体字」「`fmt.Println`」「`console.log`」「未処理 TODO」を検索した結果、**ヒットは完了報告 :301 の DoD 項目自身（チェック項目名としての引用）のみ**。実質 0 件で問題なし。
- **軽微**: 指示書 §10 が求める followup-backlog §C-1 への反映は未実施（`docs/handover/followup-backlog.md:108` 以下は 2026-06-30 更新のまま）。完了報告 §8 に持ち越しとして列挙はされている。設計/開発者側の作業とも読めるため低位。

---

## 設計準拠性以外の指摘事項

1. **生成ヘッダの provenance が manon に対して事実誤り**（低）。`migrations/000045_seed_moves_manon.up.sql:4` の「移動 system move 9 種は drop 済(**投入元は 000025**)」は、manon については誤り（実際の投入元は 000044）。この文字列は `internal/seedgen/generate.go:166` にハードコードされており、直すには変換規則側の改変＝指示書 §2.3 の停止条件に触れる。**製造が触らなかった判断は正しい**。ただし完了報告に「生成ヘッダの投入元記載は波ごとにずれる既知の副作用」として 1 行残すべき。第三波以降も同じズレが出る。

2. **`TestManon_ConversionInvariants` の効能説明が実態より広い**（低）。完了報告 :201 は「索引非搭載の理由が `derived` のみ（**未知トークン・command 空・条件残留が 0**）」と書くが、`internal/moveindex/moveindex.go:186-197` の `skipReasonFor` は `isDerived` を**最初に**判定するため、manon の **command 空 22 行（すべて `is_derived=true`）** は構造的に `derived` へ吸収され、`empty-command` は定義上 0 にしかならない。テスト（`generate_m1403d_test.go:87-91`）は「**非派生行**に未知トークンが無い」ことの担保としては有効だが、括弧書きは「manon には空 command が無い」と読み違えられる。
   - なお §3.3-9 の結論自体は堅い。当方が `character_data/*.csv` 全 16 ファイルを直接 grep して `opt_open`/`opt_close` **0 件**を独立確認済み。

3. **SQL・Go のコード品質**（問題なし）。手書きマイグレ 000043/000044 のヘッダコメントは「なぜ本マイグレが要るか」「なぜ `total` を NULL にするか」を根拠付きで記述しており、後続の波が同じ判断を再現できる水準にある。テストも `manonCSVMoves`/`manonMovementMoves` 等の名前付き定数（`migrate_m1403d_test.go:20-27`）でマジックナンバーを排し、`charMoveCounts` によるスナップショット比較で件数の二重管理を避けている。命名・エラーメッセージ・godoc コメントとも CLAUDE.md §4 に準拠。

4. **セキュリティ・依存**（問題なし）。依存追加ゼロ、ブラウザストレージ不使用、機密情報の取扱いなし。マイグレはすべて追加系（INSERT/UPDATE）で、既存 user DB に対する破壊的操作を含まない（retrospective-digest §5「既存 user DB で走ったら何が消えるか」の観点でも、manon は既存 DB に存在しないキャラであり消えるものが無い）。

---

## 推奨修正（優先度別）

### 高（M14 完了前に修正必須） — いずれも**完了報告の記述是正**であり、コード・マイグレの修正は不要

1. **完了報告 §3.1（`docs/progress/m14-03d-completion-report.md:110`）の bare-button 実測値を訂正する。**
   - 現記述: 「**既存 000035（530 キー）を実測**しても bare-button キーは **0 件**（うち解決表形状に合致するのは 220 件）。」
   - 実測: 報告自身が :92 で定義した正規表現 `^[1-9]?(P|K|P+P|K+K)$` で照合すると、000035 には **3 件**該当する。
     - `migrations/000035_seed_move_commands.up.sql:173` — `condor_dive` = `P+P`
     - 同 `:425` — `quick_dash` = `K+K`
     - 同 `:559` — `double_lariat` = `P+P`
   - **結論は変わらない**。当方の独立検証では、M17-02 §1.2 が本当に懸念していた**単独 bare `P`/`K`（`6P` 型、正規表現 `^[1-9]?(P|K)$`）は 000035・000047 とも 0 件**であり、`P+P`/`K+K` は `internal/service/inputresolve/service.go:32` が「**複数ボタン(+)…は本形状に合致せず自動的に対象外（CHANGE-069 §2.2-h）**」と明記する既知・意図的なスコープ外。なお「解決表形状 220 件」は当方の再計測でも **220** で一致している。
   - 是正案: 「単独 bare `P`/`K`（`6P` 型）は 000035・000047 とも **0 件**。複数ボタン形 `P+P`/`K+K` は 000035 に 3 件あるが、CHANGE-069 §2.2-h で明示的にスコープ外のため懸念に該当しない」と書き分ける。
   - **なぜ高か**: 本サブの DoD §7.2 は「判定に**根拠（実測値）**が添えられていること」を要求しており、この実測値は設計担当が第三波の前提を決める入力になる。数値が誤ったまま渡ると、`6P` 型の展開規則の要否判断が歪む。

2. **`moves.is_projectile` の manon 分検証結果を完了報告へ追記し、第三波申し送り（§1.4／§5）へ luke の警告を加える。**
   - `migrations/000039_add_moves_is_projectile.up.sql:10-11` が「未 seed の manon/luke（true 5 件）は本マイグレ対象外＝**M14-03d/e の seed 投入時に別途 backfill する**（seedgen が `is_projectile` を出力しないため自動反映されない）」と本サブを名指ししている。
   - **manon のデータ状態は正しい**（当方の実測で `manon.csv` の `is_projectile=true` は **0 行**。既定値 0 のままが正解で、追加マイグレは不要）。したがってコード修正は要らない。
   - しかし完了報告 §3 の 11 項目にも §5 申し送りにも一言も無く、**検証済みなのか見落としなのかが判別できない**。§7.4 が「Plan Mode 確定・実測結果を収録」と自己申告している以上、明示的に「manon は `is_projectile=true` 0 行 ⇒ backfill 不要」と記録すべき。
   - **第三波への影響が実在する**: `character_data/luke.csv` の `is_projectile=true` は当方の実測で **6 行**（`sand_blast_light`/`medium`/`heavy`/`od`、`fatal_shot`、`sa1_vulcan_blast`）。000039 の「true 5 件」という記載自体が既に古い。M14-03e で luke を投入する際に backfill マイグレを忘れると、DES-004 §2.5 の通り**確定反撃の自動走査除外**（M18-02）と**セットプレイ自動提案の技種別判定**（M19-01／CHANGE-085）が luke で誤動作する。**サイレント（0 のまま入るだけでエラーにならない）**なので、申し送りに明記しないと確実に取りこぼす。

### 中（M15 着手と並行可）

3. **`internal/infra/migration/migrate_m1403d_test.go:209` の `m.Steps(-5)` を絶対版数指定へ。** 直前の `m.Up()` に依存しているため、000048 が入った時点で着地点が 43 へずれ、「down 後の manon characters = 1, want 0」という原因の分かりにくい失敗になる。repo の既存慣習（`migrate_m1802_test.go:13`→`:29` 他）に合わせ `m.Migrate(47)` → `m.Migrate(42)` とする。

4. **同ファイル `:187`（`12*9`）・`:192`（`530`）の「manon 以外」条件を、既知キャラ code の明示列挙に置き換える。** 現状は第三波でキャラが増えるたびに機械的に壊れる。`c.code IN ('terry','guile',…)` の形にすれば以後の波で書き換え不要になる。

5. **完了報告 §4.6 の E2E baseline 記述を実態に合わせる。** 当方の独立実行では **1 failed（`web/e2e/m17-05c-pdf-pagination.spec.ts:80`）／11 flaky／56 passed・終了コード 1**。失敗はフィクスチャ API（POST `/api/combos`／DELETE `/api/combos/:id`）の非 OK で、**manon・seed とは無関係**と判断するが、「0 failed」の断定は環境依存で成立しない。「全 green ＋ 既知 flaky（負荷時は `m17-05c` が retry を使い切ることがある）」という書き方が正確。

6. **指示書 §5.2 の画面18 確認について、E2E 直接証跡が無いことを完了報告に明記する。** `web/e2e/` 27 spec に manon 参照は 0 件。DB 層の「alias 欠落 0」で代替している旨と、その代替が生 code フォールバックの発生条件そのものを潰していることを 1 行添えれば DoD の説明として十分。

7. **M14-03e 着手前に `docs/handover/code-facts.md` を再生成する（`/regen_code_facts`）。** §10-1 のマイグレ一覧が 000042 止まりで、同節が「次の連番はここで確認する」と自称しているため、次サブが 000043 を選ぶ事故を誘発する。本サブが踏んだ前提崩れと同型。

### 低（将来対応）

8. **完了報告 §4.4（:201）の `TestManon_ConversionInvariants` の効能説明を精密化する。** 「command 空が 0」は skip 理由の話であり、データ上は空 command が 22 行（すべて `is_derived=true`）ある。`internal/moveindex/moveindex.go:188` が derived を先に判定するため構造的に吸収される。「**非派生行**に未知トークン・条件残留が無いことを固定する」という表現が正確。

9. **生成ヘッダの provenance ズレを既知事項として完了報告に 1 行残す。** `migrations/000045_seed_moves_manon.up.sql:4` の「投入元は 000025」は manon については誤り（実際は 000044）。文字列は `internal/seedgen/generate.go:166` にハードコードされており、直すと変換規則の改変＝§2.3 の停止条件に触れるため**触らなかった判断は正しい**。第三波以降も同じズレが出るので、恒久対応（波ごとの投入元をパラメータ化）を設計担当の判断事項として起票するのが望ましい。

10. **完了報告 §1.2 の「ほか 4」表記を実件数に合わせる。** `manege_dore_*` は計 4 行、`renverse_*` は feint 含め計 8 行。

11. **followup-backlog §C-1 への残キャラ網羅表の反映**（指示書 §10）。`docs/handover/followup-backlog.md:108` 以下は 2026-06-30 更新のまま。完了報告 §8 に持ち越し記載はある。

---

## 良かった点

- **前提崩れを推測で埋めず、開発者裁定を取ってから最小の加算で解いた。** `characters` に manon が無いまま seedgen 生成 SQL を流すと `WHERE c.code='manon'` が 0 件ヒットして**マイグレ成功のままサイレント no-op**になる、という危険性の言語化（`migrations/000043_seed_characters_manon.up.sql:8-9`）が的確。しかもその危険を `migrate_m1403d_test.go:67-70` の「characters = 1」アサートで機械的に潰しており、「テストを書かなければ誤認したまま完了しうる」という自己分析どおりの手当てになっている。
- **指示書の前提が誤っていた事実を、指示書のせいにせず根拠付きで報告している。** 000025 の `NOT EXISTS` は冪等性のためであって遡及投入ではない、という読み解きは正確で、当方の独立検証（`INSERT INTO characters` は 000003/000009/000014/000024 のみ、000017 で guile 削除）とも完全に一致した。**第三波以降も同じ前提崩れが起きる**という一般化（申し送り 2）まで届いている点が特に良い。
- **「実測値がないものを推測で埋めない」を移動 move の `total` で貫いた。** 000041 が c_viper/dhalsim を NULL のまま残している実態と整合し、影響（ダッシュ経由候補判定が効かない）と回復条件（実測値受領後に 000041 同型の backfill）まで書いてある。
- **canary を「数字合わせ」で済ませなかった。** 増分内訳のアサート（`juri`/`ken` の `neutral_jumping_heavy_kick`）と `wantUniqueAerial=7` を据え置いたまま green である以上、再計測は実際に行われている。加えて**テスト名から件数を外した**改名は、seed 追加のたびに名前が腐るという構造問題への正しい対処であり、コメント（`service_test.go:382-383`）に理由が残っている。スコープ逸脱ではなく、canary の保守性を維持するための最小変更と評価する。
- **測れなかったものを「測れた」と書いていない。** §1.4 で「括弧の過長 code」「luke 公式英語名」を**本サブでは検証できていない別経路**と明示的に区分し、第三波で同じ (c) 軸の実測を必ず行うよう指示している。過大主張の誘惑に乗っていない。
- **配布 blocker を解除していない**（§6 末尾に明記）。段階投入の第二波という位置づけを正しく保っている。
- **dev 反映時の落とし穴（マイグレは起動時にしか適用されないためバックエンド再起動が要る）を先回りして書いている**（§4.3）。既知の再発事故への配慮として質が高い。
- **既存ヘルパを再利用し、新規ヘルパを作っていない。** golden 3 本が `assertGolden`/`repoRoot`/`ReadFile` の再利用で書かれており、M17-02 の運用をそのまま踏襲している。

---

## 制約事項

- 本レビューはコード上で判定可能な範囲のみ対象。実際の動作確認・パフォーマンス・実機テストは別途実施が必要。
- 検証として実行したのは読み取り相当のコマンドのみ（`go test ./...`／`go vet ./...`／`go run ./cmd/seedgen -check`〔既定＋生成 3 本、いずれも `-check` 付きでファイル非書換〕／`make e2e`／`git status`・`git diff`・`git show`）。マイグレの再生成（`-check` なし）は実行していない。ファイル作成は本報告書のみで、コード・マイグレ・CSV は一切変更していない。
- clean DB の集計値（完了報告 §4.3 の `moves_total=1025` / `alias=1025`）は、sqlite3 CLI でのビルドが環境制約で実行できなかったため直接測定していない。ただし `move_commands=575`（000035 の 530 ＋ 000047 の 45）は SQL ファイルから直接カウントして一致を確認し、`characters=13`・索引キャラ数 11 は `migrate_test.go:896` および `movecommand/repository_test.go:113` の green で担保されている。`moves_total` も §6 網羅表の内訳（第一波 833 ＋ ryu 93 ＋ manon 81 ＋ c_viper/dhalsim 18）と算術的に整合する。
- **不明**: 画面18 における manon の実表示（alias の効き・生 code フォールバックの不在）は、E2E spec が存在しないためコード上では判断できない。データ層のアサート（alias 欠落 0）で発生条件は潰されているが、レンダリング結果そのものは未確認。
- `character_data/rashid.csv` / `jp.csv` / `seed-progress.md` / `command-correction-history.md` の変更は開発者による別作業のためレビュー対象外とした。ただし完了報告の引用検証のため `command-correction-history.md` の該当行（教訓18/教訓20、manon rush の `is_derived` 修正 15 件、luke C-2 保留）は参照し、いずれも実在を確認している。

---

*以上、M14-03d レビュー報告書。対の完了報告は `docs/progress/m14-03d-completion-report.md`。*

---

## 取り込み結果（自動トリアージ）

実施日: 2026-07-31 / 実施者: 製造担当（`implement_plan_full_wt` Phase C）

**結果: 指摘 11 件中 10 件を採用、1 件を followup 化（不採用は「中」1 件のみ・「高」の不採用はゼロ）。**

| # | 優先度 | 指摘 | 採否 | 対応・理由 |
|---|---|---|---|---|
| 1 | **高** | 完了報告 §3.1 の bare-button 実測値が誤り（000035 に `P+P`/`K+K` が 3 件） | **採用** | 自分でも再測定して確認（`condor_dive`/`quick_dash`/`double_lariat`）。**判定に使った正規表現が `PP`/`KK` を想定しており実際の正規化キー `P+P`/`K+K` にマッチしていなかった**のが原因。完了報告 §3.1 を**形状別の表**へ書き換え、「単独 bare `P`/`K`（真の `6P` 型）= 000035/000047 とも 0 件」「`P+P`/`K+K` = 000035 に 3 件だが CHANGE-069 §2.2-h で意図的にスコープ外」と書き分けた。訂正の経緯も明記。**結論（`6P` 型 0 件）は不変** |
| 2 | **高** | `is_projectile` の manon 分検証記録が欠落／luke の警告が必要 | **採用** | 実測で **manon = 0 件**（backfill 不要）／**luke = 6 件**を確認。完了報告 §3 に確認項目を追加、§5-8 に第三波向けの警告（**seedgen は当該列を出力せず、忘れても無エラーで全行 false になる**）、§8 に持ち越しを追加。あわせて **000039 ヘッダの「true 5 件」が現 CSV に対して古い**（`fatal_shot` の是正で 5→6）ことも記録 |
| 3 | 中 | `m.Steps(-5)` を絶対版数指定へ | **採用** | `m.Migrate(42)` へ変更（`migrate_m1403d_test.go`）。000048 が入っても着地点がずれない。理由をコメントに明記 |
| 4 | 中 | `12*9` / `530` のハードコードを既知キャラ code の明示列挙へ | **採用（手法は変更）** | 指摘の狙い（後続の波で機械的に壊れないこと）を採用しつつ、**キャラ code 列挙ではなく v42 スナップショットの実測値との比較**へ変更した。列挙だと波ごとに追記が要るが、スナップショット比較なら**以後どの波でも書き換え不要**で、かつ「v42 から不変」という検証意図をそのまま表現できるため |
| 5 | 中 | 完了報告 §4.6 の E2E 記述を実態へ | **採用** | 「0 failed」の断定を撤回。**3 回分の実測を表で併記**（63/5/0・56/11/1・61/6/1）し、**落ちる spec が毎回異なる**こと、**落ちた spec を単独実行すると全 green**（実際に再実行して確認）、**両 spec とも manon 参照 0 件**であることを根拠に「本サブによる回帰ではない／正確には全 green＋既知 flaky」と書き直した。E2E 環境の flakiness 自体は followup 起票を推奨として記載 |
| 6 | 中 | 指示書 §5.2 の画面18 確認に E2E 直接証跡が無い旨を明記 | **採用（上位対応）** | 「明記する」ではなく **E2E spec を新規作成**した（`web/e2e/m14-03d-manon-seed.spec.ts`・単独実行 green）。moves 81 件／`nameJa` 欠落 0／移動 9 種の存在／画面18 での日本語名表示（アクセント語 4 種＋誤字是正後の「レベランス」）／`—` セル 0 件／入力欄の編集可能性を検証。**保存しない read-only 設計**で共有 seed を汚さない |
| 7 | 中 | `code-facts.md` を `regen_code_facts` で再生成 | **不採用（followup 化）** | 指摘の妥当性は認める（§10-1 が 000042 止まりで、本サブが踏んだ罠を再生産する）。ただし**自動生成物の全体再生成は M18/M19 由来の無関係な差分を巻き込み、本サブのスコープ（manon seed ＋実地検証）を超える**ため実施しない。完了報告 §5-9 と §8 に**「M14-03e 着手前に実施」**として持ち越した。レビュアー自身も「M14-03e 着手前に」と条件付けており、時期として整合する |
| 8 | 低 | `TestManon_ConversionInvariants` の効能説明を精密化 | **採用** | 完了報告 §4.4 を修正。「command 空 0」ではなく「**非派生行に未知トークン・条件残留・command 空が無い**ことの固定」とし、データ上は command 空が 22 行（すべて `is_derived=true`）あり `skipReasonFor` が derived を先に判定して構造的に吸収される旨を補足 |
| 9 | 低 | 生成ヘッダの provenance ズレを既知事項として記載 | **採用** | 完了報告 §4.5 に追記。`000045:4` の「投入元は 000025」は manon については誤り（実際は 000044）だが、**文字列は `CustomHeader` にハードコードされており直すと変換規則の改変＝§2.3 の停止条件**のため触らない。恒久対応（波ごとの投入元パラメータ化）を設計担当の判断事項として申し送り |
| 10 | 低 | §1.2 の「ほか 4」表記を実件数へ | **採用** | 実測して `manege_dore` 4 / `degage` 4 / `renverse` **8**（feint 含む）/ `grand_fouette` 4 / `rond_point` 4 と明記 |
| 11 | 低 | 残キャラ網羅表を followup §C-1 へ反映（指示書 §10） | **採用** | `docs/handover/followup-backlog.md` §C-1 へ **(a) M14-03d 完了行**、**(b) 残キャラ網羅表の現在地**、**(c)「未 seed キャラは characters に存在しない」という第三波以降の必須前提**を追加。あわせて既存の ★必須 2 項目（`M14-03-is-projectile-backfill` の「true 5 件」／`M14-03-dash-total-backfill`）について**実測との齟齬を訂正する注記**を追加（manon は is_projectile 対応不要・dash total は未消化のまま残る） |

### 取り込み後の再検証

| ゲート | 結果 |
|---|---|
| `go test ./...` | **exit 0**（全通過） |
| `go vet ./...` | **exit 0** |
| `go run ./cmd/seedgen -check` | **OK: 生成物は既存ファイルと一致**（000026 byte-identical 維持） |
| golden テスト | **7 本すべて PASS**（既存 4＋新規 3） |
| `internal/seedgen`（非テスト）/ `internal/moveindex` / `cmd/seedgen` の差分 | **なし**（追加は `generate_m1403d_test.go` のみ） |
| 新規 E2E spec 単独実行 | **1 passed** |

### 「高」指摘の不採用

**なし**（高 2 件はいずれも採用・対応済み）。したがって開発者へのエスカレーション事項はない。

### 未消化のまま残る事項（開発者判断待ち）

1. **manon の移動 5 code の `total` backfill** — 実測値（開発者提供が一次源）の受領待ち。未実施の間は manon の確定反撃サーチでダッシュ経由候補判定が効かない。
2. **`code-facts.md` §10-1 の再生成** — M14-03e 着手前に `regen_code_facts` を推奨。
3. **E2E スイートの flakiness** — 高負荷時に spec が retry を使い切ることがある（本サブ起因ではない）。followup 起票を推奨。

### 追記（2026-07-31・レビュー後）

**未消化事項 1「manon の移動 `total` backfill」を解消した。** 開発者から実測値（`dash_forward=21` / `dash_back=25` / `jump_*=43`）を受領し、**マイグレ 000048（`000048_backfill_movement_total_manon`）**として起票（000041 と同型・UPDATE のみ・スキーマ変更なし）。

- **000044 を書き換えず新規連番にした理由**: 既存マイグレ非改変の原則に加え、**000044 の INSERT は `NOT EXISTS` ガード付き**のため、既に 000044 まで適用済みの DB では 000044 を直しても行が再投入されず **total がサイレントに欠落する**。UPDATE 方式なら適用済み・未適用のどちらでも同じ最終状態へ収束する。
- 値は既存 10 キャラのレンジ（dash_forward 18〜22 / dash_back 23〜25 / jump 43〜45）内で整合。`forward`/`back`/`micro_*` の 4 code は 000041 でも対象外＝NULL のまま。
- `TestRun_M1403d_UpContract` の「移動 move の total は NULL」アサートを**実測値一致の検証へ差し替え**（4 code の NULL 維持も併せて固定）。down は `Migrate(42)` のままで 000048 も巻き戻る。
- **消費連番は 000043〜000048（6 本）へ更新。後続サブは 000049 から。**
- 再検証: `go test ./...` exit 0 / `go vet ./...` exit 0 / `seedgen -check` OK（000026 byte-identical 維持）。

⇒ **未消化事項は「`code-facts.md` の再生成」と「E2E スイートの flakiness」の 2 件**（いずれも本サブのスコープ外・followup）。
