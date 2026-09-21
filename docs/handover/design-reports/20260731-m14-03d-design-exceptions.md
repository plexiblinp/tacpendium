# M14-03d 設計伝達レポート（第二波 seed = manon ＋ アクセント transliteration の実地検証）

| 項目 | 内容 |
|------|------|
| 対象 | **親チャット（設計卓）** |
| 発信 | 製造担当 Claude Code / 2026-07-31 |
| 指示書 | `docs/instructions/M14-03d-second-wave-manon.md` **v1.0.2** |
| CHANGE / マイグレ | **CHANGE なし**（スキーマ変更ゼロ＝指示書の承認ゲート欄どおり） / **6 本**（000043〜000048） |
| 実装コミット | ブランチ `wt/m14-03d`（worktree）。**未コミット**（`implement_plan_full_wt` の worktree ガードにより製造は git 操作を行わない運用。コミット・マージは開発者） |
| 関連 | 完了報告 `docs/progress/m14-03d-completion-report.md` / レビュー `docs/progress/m14-03d-review.md`（fresh subagent・トリアージ追記あり） |
| 作成条件 | **実装直後の同一セッション内で生成**。セッション中に開発者から得た裁定（§3-1）を反映済み |

本レポートは **①製造が独自に確定した実装仕様 ②契約・設計に反する独自判断 ③製造の判断 ④設計担当が未把握の残課題** に絞る。指示書どおりに実装した部分は割愛した。

**最重要は §2-1 と §1-1。** 両者は同じ事象（**指示書 §3.2 の前提事実が現ツリーに対して誤っていた**）の裏表で、§2-1 が親の裁定を要する項目、§1-1 が第三波以降のテンプレートへ反映すべき恒久仕様である。**本サブの核である §4.3 の判定は【解あり】**で、こちらは指示書どおりの結論のため本レポートでは詳述しない（完了報告 §1 が正）。

---

## §1 製造が独自に確定した実装仕様（DES 反映が要るもの）

### 1-1【最重要】未 seed キャラの seed 波は「前提マイグレ 2 本」を含む 5〜6 段構成になる

指示書 §2.1 の成果物表は「マイグレ（manon の moves＋`preset_aliases`）」の 1 種類しか想定していないが、**未 seed キャラを投入するには実際には次の段が要る**ことが実装で確定した。

| 段 | 内容 | 本サブでの連番 | 生成手段 |
|---|---|---|---|
| 1 | `characters` 行 | 000043 | 手書き（000024 の形） |
| 2 | 移動 system move 9 種＋`official_ja_move` alias | 000044 | 手書き（000025 の形） |
| 3 | moves＋alias＋rush の `original_move_id` 解決 | 000045 | `seedgen -chars <c> -out <stem> -note …` |
| 4 | `is_derived` backfill | 000046 | `seedgen -mode derived-backfill` |
| 5 | `move_commands` 索引 | 000047 | `seedgen -mode move-commands` |
| 6 | 移動 5 code の `total` backfill（実測値がある場合のみ） | 000048 | 手書き（000041 の形） |
| （7） | `is_projectile` backfill（当該キャラに true 行がある場合のみ） | 本サブは**不要** | 手書き（000039 の形） |

段 1・2 が要る理由は §2-1 に記す。段 4 が要るのは **seedgen の moves INSERT 列に `is_derived` が含まれない**ため（`internal/seedgen/generate.go` の `writeMovesInsert`。`MoveRow.IsDerived` は「索引フィルタ用・SQL 非投入」とコメントされている）。段 5 が要るのは **索引 seed が 000035 に焼き付いており新キャラでは自動的に増えない**ため（指示書 §3.3-11 の設計担当見立てどおり）。

根拠テスト: `internal/infra/migration/migrate_m1403d_test.go`（`TestRun_M1403d_UpContract` が 6 段すべての結果を固定）。

⇒ **M14-03e 以降の指示書テンプレート（および M14-overview §3 のサブ表の注記）に、「未 seed キャラの波は前提マイグレ 2 本を含む 5〜6 段」であることを明文化してほしい。** 現行テンプレートのまま第三波を発注すると、製造は再び段 1・2 を「スコープ外の追加作業」として判断することになる。

### 1-2 移動 5 code の `total` は波ごとに実測値の受領フローが要る

000041（M18-02/CHANGE-084 v2）は当時 seed 済みの 10 キャラのみを対象としており、**後から投入されるキャラの `total` は NULL のまま入る**。値の一次源は**開発者提供の実測値**で、DB/CSV/マイグレのどこにも存在しない（`character_data/*.csv` に移動 move の行が無い）。

本サブでは Plan Mode 時点で未受領のため「推測で埋めず NULL 維持」を裁定いただいたが、**実装完了後に実測値を受領**（`dash_forward=21` / `dash_back=25` / `jump_*=43`）し、**000048 で backfill して解消**した。値は既存 10 キャラのレンジ（dash_forward 18〜22 / dash_back 23〜25 / jump 43〜45）内で整合する。

**000044 を書き換えず新規連番にした**のは、000044 の INSERT が `NOT EXISTS` ガード付きのため、既に適用済みの DB では 000044 を直しても行が再投入されず **`total` がサイレントに欠落する**ため。UPDATE 方式なら適用済み・未適用のどちらでも同じ最終状態へ収束する。

⇒ **第三波以降の指示書に「移動 5 code の実測値を開発者から受領する」を着手前の確認事項（指示書 §11 相当）として入れてほしい。** 受領できない場合は NULL 維持で進め、後続マイグレで補う運用が成立することは本サブで実証済み。

### 1-3 `is_projectile` backfill の要否は波ごとに実測で決まる（既存申し送りの件数が古い）

`000039_add_moves_is_projectile.up.sql:10` は「未 seed の manon/luke（**true 5 件**）は本マイグレ対象外＝M14-03d/e の seed 投入時に別途 backfill する」と本サブを名指ししているが、**現 CSV に対してこの件数は古い**。

| キャラ | `is_projectile=true` 実測 | 本サブでの扱い |
|---|---|---|
| manon | **0 件** | **backfill 不要**（既定値 0 が正しい姿）。追加マイグレなし |
| luke | **6 件**（`sand_blast_{light,medium,heavy,od}` / `fatal_shot` / `sa1_vulcan_blast`） | **M14-03e で必須** |

「5 件」→「6 件」のずれは、`fatal_shot` が 2026-07-22 の precheck 第2バッチ Phase 4 で `is_projectile` を false→true へ是正されたことによる（`character_data/command-correction-history.md`）。

⇒ **`followup-backlog` の `M14-03-is-projectile-backfill` スラッグの本文（「manon/luke の true 5 件」）を実測値へ更新してほしい。** 製造側では同節に訂正注記の**登録を依頼した**（自由改訂資料のため実物への反映は親／反映係の作業）。

---

## §2 契約・設計に反する独自判断（★親の裁定が要る）

### 2-1【最重要】指示書 §2.2／§3.2 に反して、manon へ移動 system move 9 種を新規投入した

**何に反したか**

- 指示書 **§3.2 前提事実**: 「**移動 system move（9 種）は M14-03b で全キャラ投入済み＝manon も投入済み＝本サブで再投入しない**」
- 指示書 **§2.2 変更しないもの**: 「移動 system move（M14-03b 投入分）」
- 指示書 **§9.3 不明時**: 「移動 move・`drive_parry` を巻き込みそうなら止める」

**なぜそう判断したか**

実査の結果、**この前提事実は現ツリーに対して誤っていた**。`INSERT INTO characters` を持つマイグレは 000003 / 000009 / 000014 / 000024 の 4 本だけで、**manon はいずれにも含まれない**（HEAD の `characters` は 12 行＝ryu/ken/ingrid/c_viper/dhalsim/terry/guile/lily/kimberly/juri/mai/zangief）。000025 の `NOT EXISTS` ガードは**冪等性のため**であって、後から追加されたキャラを遡って埋めるものではないため、manon には移動 move が 1 行も入っていなかった。

さらに危険なのは、**この状態のまま seedgen 生成 SQL を流すと `FROM characters c … WHERE c.code='manon'` が 0 件ヒットし、マイグレは成功したまま 0 行投入される（サイレント no-op）**点である。テストを書かなければ「投入した」と誤認したまま完了しうる。

**実装がどうなっているか**

- `migrations/000043_seed_characters_manon.up.sql`（000024 の形・`ON CONFLICT DO NOTHING`・`custom_states` は NULL）
- `migrations/000044_seed_movement_system_moves_manon.up.sql`（000025 の形・`NOT EXISTS` ガード・`WHERE c.code = 'manon'` で manon 限定）
- 非波及の担保: `TestRun_M1403d_OtherCharsUnaffected`（v42 → HEAD のスナップショット比較で他キャラの (moves, alias) が全件不変・移動 move 総数も v42 から不変）

**裁定の状態**: 本件は **Plan Mode で開発者へ提示し「前提マイグレも本サブで追加する」と裁定を得ている**（2026-07-31）。ただし**指示書明文には反したまま**であり、**親の仕事は (a) 受理して指示書 §2.2/§3.2 と第三波以降のテンプレートを更新するか、(b) 却下して差し戻すかの二択**である。§1-1 の反映依頼と対で処理してほしい。

**同じ前提崩れは第三波以降でも必ず起きる**: `characters` は本サブ後も 13 行で、**jamie / luke / m_bison / rashid / jp はいずれも未登録**。

---

## §3 製造の判断

### 3-1 開発者へ確認して確定した点

| # | 論点 | 確定内容 | 確定日 |
|---|---|---|---|
| 1 | manon が `characters` に不在（§2-1） | **前提マイグレ（000043/000044）も本サブで追加する**。既存マイグレ非改変・manon 限定の加算のみ | 2026-07-31（Plan Mode） |
| 2 | 移動 move の `total` | 当初「**NULL のまま**」（実測値未受領・c_viper/dhalsim の前例）→ **実測値受領後に 000048 で backfill** | 2026-07-31（Plan Mode → 実装後） |
| 3 | `manon.csv` の `name_ja` 誤字 2 行（`レべランス`＝ひらがな「べ」U+3079） | **製造側で CSV を修正してよい**。`preset_aliases` として UI に出る値のため投入前是正が最も安い | 2026-07-31（Plan Mode） |
| 4 | manon CSV の完成度（`command-correction-history.md` の保留「入力漏れ行追加(temps_lie)」） | **開発者が最新版へ差し替え**（`temps_lie`／タン・リエ が追加され 71→72 行）。差し替え後に全実測をやり直した | 2026-07-31（Plan Mode） |

**#3 の補足**: `move_code` は 1 文字も変更していない（指示書 §4.2 の「CSV が正・再採番しない」は厳守）。修正は `name_ja` 2 行のみで、`git diff character_data/manon.csv` に差分を提示済み。

### 3-2 推測で進めた点（指示書 §9.2「推測で進めてよい」の範囲）

| # | 項目 | 採った判断 |
|---|---|---|
| 1 | マイグレの分割数 | **6 本**（000043〜000048）。§9.2 が裁量と明記。**消費連番は完了報告 §4.1／§7.4 に明記**（後続は 000049 から） |
| 2 | 実測表の書式 | §4.3 の 3 点が読み取れる形（完了報告 §1.1／§1.2 の 2 表構成） |
| 3 | golden テストの配置 | 既存 2 ファイルへ追記せず **`internal/seedgen/generate_m1403d_test.go` を新設**（マイルストーン単位に寄せる。`migrate_m1403b/c_test.go` の命名慣習に合わせた）。既存ヘルパ（`assertGolden`/`repoRoot`/`ReadFile`）は再利用し新規ヘルパを作っていない |

### 3-3 指示書スコープ外の変更（レビュー指摘の取り込みを含む・親への報告事項）

| # | 変更 | 理由 |
|---|---|---|
| 1 | `internal/service/punishfinder/service_test.go` の canary を **`TestScan_JumpLane_SeedRegression_Existing21PlusNeutral2` → `…_ExistingJumpHeavyPlusNeutral` へ改名** | manon 追加で判定値が 21→23 / 23→25 に動き、**テスト名に埋め込まれた件数が実態とずれた**。seed 波のたびに再発する構造問題のため、数字を名前から外した（判定値は `const` が正）。同テストのコメントが「数字だけ合わせず候補差分を再計測せよ」と要求しており、**再計測した結果**「増分は manon の 2 件のみ・案 C の増分内訳（`juri`/`ken` の `neutral_jumping_heavy_kick`）と `wantUniqueAerial=7` は不変」を確認済み |
| 2 | `web/e2e/m14-03d-manon-seed.spec.ts` を**新規追加** | 指示書 §5.2（画面18 で表示・編集でき alias が効く）に**直接証跡が無かった**ため。**保存しない read-only 設計**で共有 seed を汚さない |
| 3 | `docs/handover/followup-backlog.md` §C-1 へ 3 行追加＋既存 ★必須 2 項目への訂正注記 | 指示書 §10「残キャラの網羅表を followup §C-1 へ反映」に基づく。**自由改訂資料のため、実物の確定は親／反映係の判断**（製造は登録を依頼した扱い） |

---

## §4 設計担当が未把握の残課題・申し送り

| # | 項目 | 内容 | 引受先 |
|---|---|---|---|
| 1 | **`code-facts.md` の連番情報が古い** | `docs/handover/code-facts.md` §10-1 のマイグレ一覧が **000042 止まり**。同節は「次の連番を調べる場所」として自己記述しており、**本サブが踏んだ前提ずれと同型の事故を後続へ再生産する**。`regen_code_facts` での再生成を推奨（本サブでは M18/M19 由来の無関係な差分を巻き込むため未実施） | **M14-03e 着手前** |
| 2 | **生成ヘッダの provenance ズレ** | `migrations/000045_seed_moves_manon.up.sql:4` が「移動 system move 9 種は drop 済(**投入元は 000025**)」と出力するが、**manon の投入元は 000044**。文字列は `internal/seedgen/generate.go` の `CustomHeader` にハードコードされており、**直すと変換規則の改変＝指示書 §2.3 の停止条件**（golden の byte-identical も崩れる）ため触っていない。**第三波以降も同じズレが出る**。恒久対応（波ごとの投入元をパラメータ化）は**設計判断事項として申し送る** | **設計卓** |
| 3 | **`grand_fouette_od` の command 非対称** | `grand_fouette_od` だけが `command=k` を持ち、同族の `grand_fouette_{light,medium,heavy}` は command 空。いずれも `is_derived=true` で索引非搭載のため**現時点で実害はない**が、データとして不揃い。是正するならデータ側（本体は取込値を信頼）。指示書 §4.2 の原則どおり**報告のみで触っていない** | **開発者判断** |
| 4 | **`opt_open`/`opt_close` の写像方針は第二波では確定不要** | M17-02 残課題 #2 は「第二波 seed 前に写像方針確定」としていたが、**`character_data/*.csv` 全 16 ファイルで 0 件**。seedgen の索引サマリでも「索引非搭載 27 件」の内訳が `derived: 27` のみ＝`unknown-token` は 1 件も出ていない。**実データが出るまで先送りできる** | 設計卓（先送り可） |
| 5 | **`6P` 型（強度なし `p`/`k` 単独形）も第二波では 0 件** | M17-02 §1.2 の懸念（解決表に載らずサイレントに直接指定へ回る）は manon で **0 件**。ただし他 CSV には bare 単独ボタンが実在する（`m_bison/head_press`=`k`・`rashid/nail_assault`=`k`・`luke/no_chaser`=`p` 等）ため、**第三波の precheck で `is_derived` と併せて再測定**が要る（`is_derived=true` なら索引非搭載で実害なし） | **M14-03e** |
| 6 | **E2E スイートの flakiness** | `make e2e` を 3 回（製造 2・レビュアー 1）走らせ、**毎回異なる spec が 1 件落ちた**（`m17-05c-pdf-pagination` / `m18-03b-materialize`）。落ちた spec を**単独実行すると全 green**、かつ**両 spec とも manon を参照していない**ため**本サブによる回帰ではない**が、「全 green」と断定できる状態ではない。高負荷時に retry を使い切る挙動。followup への**登録を依頼した** | 設計卓／開発者 |
| 7 | **`seed-progress.md` の `seed_imported` 欄が実態と乖離** | 全キャラ「未」のまま（実際は第一波 9＋ryu＋manon が投入済み）。**開発者が手動更新する運用**のため製造は触っていない | 開発者 |
| 8 | **manon の `custom_states`（メダルLv）が未定義** | `command-correction-history.md` 教訓20 のとおり開発者方針でスコープ外。jamie（酔いLv）も同型 | 設計卓（別工程） |
| 9 | **チェックリストの E2E baseline 記述が古い** | `M14-03d-review-checklist.md` §5 は「18 spec 全 green が現行 baseline」だが、現ツリーは **28 spec / 64 test**（本サブの新規 1 spec を含む） | 設計卓（チェックリスト更新） |

---

## §5 参考（触れていない＝不変の証跡）

- **変換規則の無改変**: `go run ./cmd/seedgen -check` → `OK: 生成物は既存ファイルと一致`（作業前・作業後の 2 回）。**000026 は byte-identical**。
- **差分ゼロの裏取り**: `git status --short internal/seedgen/ internal/moveindex/ cmd/seedgen/` の出力は `?? internal/seedgen/generate_m1403d_test.go` **のみ**。変換規則コード・**索引器（`internal/moveindex`）**・CLI に差分なし。
- **golden 7 本すべて PASS**（既存 4＝000026/000030/000034/000035 ＋ 新規 3＝000045/000046/000047）。
- **既存マイグレ 000001〜000042 は 1 本も改変していない**（tracked の modified が `migrations/` に無い）。
- **他キャラ非波及**: `TestRun_M1403d_OtherCharsUnaffected`（v42 → HEAD のスナップショット比較で全キャラの (moves, alias) 不変・移動 move 総数不変・**000035 の索引 530 件不変**）。
- **`move_code` 非改変**: HEAD 版と作業ツリー版の `move_code` 列の差分は**開発者追加の `temps_lie` 1 行のみ**（レビュアーが独立に全行 diff で確認）。
- **input-tool（別 go module・`.gitignore` 配下）には一切触れていない**。
- 全域 dup 測定（clean DB）: 同一キャラ内 `move_code` 重複 / `alias_text` 重複 / `(preset_id, move_id)` 重複 / alias 欠落 の **4 軸すべて 0 件**。
- `go test ./...` exit 0 / `go vet ./...` exit 0。

---

## §6 CHANGE 起票のたたき台（設計担当向けチェックリスト）

**本サブは CHANGE 起票なし**（スキーマ変更ゼロ＝指示書の承認ゲート欄どおり。seedgen はランタイム非経路＝外部契約でない）。以下は **DES／指示書テンプレートへの反映依頼**であり、CHANGE 番号を要するかは親の判断。

- [ ] **§2-1 の裁定**（受理 → 指示書 §2.2/§3.2 の前提事実を訂正 ／ 却下 → 差し戻し）
- [ ] **§1-1**: 「未 seed キャラの波は前提マイグレ 2 本を含む 5〜6 段」を M14-03e 以降の指示書テンプレート・M14-overview §3 の注記へ
- [ ] **§1-2**: 「移動 5 code の実測値を開発者から受領する」を波ごとの着手前確認事項へ
- [ ] **§1-3**: `followup-backlog` の `M14-03-is-projectile-backfill` スラッグの件数を実測値（manon 0 / luke 6）へ更新
- [ ] **§4-2**: 生成ヘッダの投入元パラメータ化（変換規則の改変を伴うため設計判断）
- [ ] **§4-9**: `M14-03d-review-checklist.md` §5 の E2E baseline 記述の更新

**マイグレ連番について**: 本サブは **000043〜000048 の 6 本**を消費した。連番は**着手時に `migrations/` を実査して払い出した**（予約帯は作っていない）。指示書 §1.4／§3.2 が記載していた「000035 まで消費／000036 以降」は 2026-07-18 時点の記録で、**着手時点では 7 番ずれていた**（000036〜000042 を M18/M19 系が消費済み）。§3.3-1 の「実査結果が正」という規定がまさにこのケースを救った。**後続サブは 000049 から**。

---

## §7 教訓（retrospective 行き）

> **本節は親チャットが読む必要はない。** 宛先は反映係（Claude Code）で、`retrospective-log` へバッチ反映される。

1. **「全キャラへ投入」と書かれた seed マイグレは、適用時点に存在した行にしか効かない。** 後から行が増えるテーブル（`characters`）を対象にした一括 seed は、**後続の波で必ず前提崩れになる**。指示書に「前提として投入済み」と書かれていても、**着手時に `SELECT` 相当の実査で再確認する**。とくに `NOT EXISTS` ガードは「冪等性のため」であって「遡って埋める」ものではない。
2. **JOIN で解決する seed SQL は、親行が無いとエラーではなく 0 行投入になる。** `INSERT … FROM characters c WHERE c.code='X'` 型は**サイレント no-op** が既定の失敗モード。**投入件数を固定するテストを必ず先に書く**（本サブは `TestRun_M1403d_UpContract` が救った）。同型の危険は `is_projectile`／`is_derived`／移動 `total` のように「seedgen が出力しない列」にもある＝**忘れてもエラーにならない**。
3. **「無いこと」を正規表現で測るときは、実際に生成される値を先に 1 件見る。** 本サブは bare-button キーを `^[1-9]?(P|K|PP|KK)$` で測ったが、実際の正規化キーは `P+P`/`K+K` で**マッチせず「0 件」と誤報した**（レビューで検出）。結論は変わらなかったが、**存在しないことの証明はパターンの当たり判定を先に検証する**。
4. **件数前提テストの洗い出しは grep だけでは漏れる。** 事前調査で 2 箇所と見積もったが、実行して初めて 3 箇所目（`punishfinder` の jump-lane canary）が出た。**seed 追加時は「grep で当たりを付け、必ず全体実行で確定させる」**。
5. **テスト名に件数を埋め込むと、seed 追加のたびに名前が実態とずれる。** `Existing21PlusNeutral2` 型の命名は避け、**判定値は `const` に置いて名前からは外す**。
6. **自動生成ドキュメントが「次の連番はここで確認する」と自称している場合、それが古いと事故が伝播する。** `code-facts.md` §10-1 が 000042 止まりのまま放置されると、次サブが 000043 を選ぶ。**派生資料の鮮度は源泉更新の直後に機械的に確認する**（`check_derived_docs` / `regen_code_facts`）。
7. **未コミットの新規マイグレでも、`NOT EXISTS` ガード付き INSERT は「後から列を足す」修正に向かない。** 適用済み DB では行が再投入されず値がサイレントに欠落する。**追記は必ず UPDATE の新規連番で行う**（本サブの 000048）。
