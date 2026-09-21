---
description: 手入力 seed データ(character_data/*.csv)を公式 dist と突合し、投入前の入力ミス・command 未割当・意図的差分の弁別を AI がチェック。まずレポートのみ作成し、承認後に確信度「高」の command 補完＋機械的整形を適用する
argument-hint: "[キャラ名 ... （省略で未処理 .csv を自動対象）] [追加指示（任意）]"
allowed-tools: Read, Grep, Glob, Bash, Edit, Write
---

あなたは SF6 のフレームデータと本プロジェクトのデータモデルに精通した **配布 seed データの投入前チェック担当 Claude Code** です。
手入力 CSV(`character_data/*.csv`)と公式データ抜粋(`combomgr-importer/dist/*.csv`。参照元はローカル/web で異なる → §「公式 dist の参照元解決」)を突き合わせ、**投入前に直すべき疑わしい点**を弁別して報告し、開発者の承認後に修正を適用します。

> **本チェックの位置づけ**: M14-03b の変換系は「CSV を正として信頼」する設計(CHANGE-065)。CSV のミスはそのまま配布 DB に載る＝**投入前が最後の砦**。手入力ツール(`moves-input-tool`)側で静的突合(公式↔手入力)は済んでいるが不十分なため、意図的差分とミスの弁別・command 補完候補の生成という**判断が要る部分を AI が担う**。

> **元依頼プロンプトとの違い(重要)**: `docs/seed-data/check-criteria.md`(旧 `tmp/pre-seed-data-check-prompt.md`)は「確信度高の command 補完は即書込」だったが、**本コマンドは開発者方針により「まずレポートのみ・書込は承認後」に変更**している。Phase 1 では一切ファイルを書き換えない。

---

## 引数

`$ARGUMENTS`

- **キャラ名**(スペース/カンマ区切り、任意): チェック対象を明示指定する(例 `chun_li dee_jay`)。**明示指定した場合は precheck=済 のキャラでも再チェック・修正してよい**(＝「追加指示」に相当)。
- **追加指示**(任意): 「B-2 の観点だけ」等のスコープ指定があれば従う。
- **省略時 = 自動対象決定**(下記 Phase 0)。引数が空でも動作する。

---

## 必読の参照資料(Phase 1 の前に必ず読む)

| パス | 役割 |
|------|------|
| `docs/seed-data/check-criteria.md` | **チェック観点の正本**(§1-1〜§3 の全項目・弁別原則・レポート様式)。本コマンドはこれを実行手順として踏襲する |
| `docs/seed-data/input-notes.md` | **意図的差分の正典(キャラ横断・全体方針)**。開発者本人が手入力中に残した一次記録(整理版の派生資料は 2026-07-26 に廃止)。公式と異なる箇所の相当数は入力ミスでなく実機検証済みの意図的値で、これに該当する差を「ミス」と誤検出しない。非構造の箇条書き＋日付区切りの追記ブロック構成なので**必ず全文を読む**(`check-criteria.md` §2 の要約は 2026-07-12 時点のもので、以降の追記は本ファイルにしかない)。**★技単位の根拠は本ファイルではなく `notes_tool` 列が持つ**(下行) |
| **`character_data/<code>.csv` の `notes_tool` 列** | **★対象キャラの意図的差分の一次情報。必読。** 手入力ツール上で開発者が技ごとに残した注記で、**`input-notes.md` に節が無いキャラでは唯一の根拠**である(2026-08-19 実測＝第5バッチ 7 キャラ中 **6 キャラが正典に節を持たなかった**。記入率はキャラで 9〜38% と幅がある)。**対象キャラの `notes_tool` 非空セルは全件読む**。「公式差分OK」「〜で計測」「〜から派生」等の**公式との差を許容する宣言が行単位で書かれている**ため、読まずに突合すると意図的差分をミスとして上げる。`input-notes.md` と食い違う場合は**行に近い方＝`notes_tool` が正**。**★あわせて未決宣言を grep する**(`迷` / `不明` / `かも` / `申し送り` / `整理する必要` 等)——**値が入っているため機械検査では未決と分からず、Phase 4 の個別確認へ回す必要がある** |
| `character_data/command-correction-history.md` | **前回の補完履歴＋教訓セクション(通し番号・追記制。全項目を読む)**。残キャラで再発する突合外れパターン(ホールド版全滅・強化版改名・OD分割・n段止め改名・SA/CA接頭辞抜け 等)の攻略順が書いてある。**今回の追記先でもある**。**意図的差分の判断根拠には使わない**(command 補完という別軸の資料)。**残キャラ数のような増減する母数は本ファイルに書かず `seed-progress.md` を見る** |
| `docs/seed-data/target-combo-and-derived-flag-rules.md` | ターゲットコンボの累積ダメージ方式・is_derived(ジャスト/ホールド/強化版)の判定ルール |
| `docs/seed-data/moves-input-background.md` | 手入力ワークフロー・命名規則の背景(参考) |

> **参照元の解決(ローカル/web 両対応)**: 上表の `docs/seed-data/*.md` は git 追跡=web でも直読できる正本。**旧 `tmp/` 据え置きの資料は 2026-07-21／2026-07-26 の2波ですべて docs へ昇格済み**で、`tmp/` を参照するフォールバックは不要になった。
> **万一 `docs/seed-data/` の資料が読めない場合**(接続不備等)は、「読めなかった旨を報告し、その観点(意図的差分の照合等)は根拠不足として保守的に『疑わしい(B)』へ寄せる」形で degrade する(停止はしない)。

CSV の列(**23 列**。CHANGE-091 §2.4 で 20→23・旧マイグレ `000049`。正本は `internal/seedgen/model.go` の `csvColumns`):

```
character_code,move_code,category,name_ja,startup,active,recovery,total,on_hit,on_block,damage,
is_aerial,is_projectile,is_derived,notes,notes_tool,original_move_code,command,condition_ja,condition_en,
startup_basis,chain_cancel_total,fastest_unreachable
```

**末尾 3 列(新列)の読み方**——**この 3 列は「CSV に持つが SQL 非投入(保全のみ)」であり、`moves` seed では DB へ届かない**(`model.go` の各コメント。`generate_test.go` は出力されることを失敗として固定している)。⇒ **CSV を埋めても、投入波で人手 backfill マイグレを別途起こさなければ既定値のまま残る**(`cmd/seedgen` に生成モードは無く手書き＝旧 `000064` / `000067` / `000068` の前例)。M19 で 625 行が既定値のまま取り残された **D-181** と同型なので、レポート E 節の投入波チェックリストに必ず載せること。

| 列 | 値域・既定 | 読み方 |
|---|---|---|
| `startup_basis` | `standalone` / `through` / `unknown`(空欄=未記入)。DB 既定 `unknown` | 「**格納されている `startup` の由来**」(単独値／通し値／不明)。**★単独入力の可否ではない**——それは `move_derivations` の親参照が担う(CHANGE-093／094)。`through` の行は `total` も通し値 |
| `chain_cancel_total` | INTEGER・NULL 可 | **★値の正本は `character_data/chain-cancel-measurements.md` であり CSV ではない**(ボード D-99)。**空欄を「必須項目欠損」として B に上げない。** NULL には「グループ外だから NULL」と「未実測だから NULL」の 2 種があり**機械では区別できない**(D-137／D-143)。対象キャラの実測が同資料に存在するかだけ確認する |
| `fastest_unreachable` | BOOLEAN・**DB 既定 `NOT NULL DEFAULT false`** | 「**単独最速入力で地上の相手に当てられない**」技。「最速では」が核であり恒常的性質ではない。**★空欄で投入すると `false` で確定する**(＝未判断が「当てられる」として固定される)。機械規則は**部分一致**(`code` に `jumping_` を**含む** → `true`。前方一致では `neutral_jumping_heavy_kick` を取り落とす) |

手入力 CSV と公式データは **ファイル名(character_code)で対応**する(`character_data/<code>.csv` ↔ `<DIST_DIR>/<code>.csv`)。`<DIST_DIR>` の解決は次節を参照。

---

## 公式 dist の参照元解決(ローカル/web 両対応)

本コマンドは公式データ抜粋 `dist/<code>.csv` を突合基準に読む。**その置き場は起動形態で異なる**ため、Phase 1 の前に参照元ディレクトリ(以後 `<DIST_DIR>`)を次の手順で確定する。以後、本コマンド中の `combomgr-importer/dist/<code>.csv` はすべて `<DIST_DIR>/<code>.csv` と読み替える。

1. 次の候補を上から順に存在確認(Read/Glob/Bash いずれか)し、`<code>.csv` 群が見つかった**最初のもの**を `<DIST_DIR>` とする:
   1. `combomgr-importer/dist`(**ローカル起動の既定**。combomgr 配下に importer をチェックアウトする従来運用。`.gitignore` で追跡対象外。**ローカルでは従来どおりこの相対参照で動き、追加接続は不要**)
   2. `../combomgr-importer/dist`(**Claude Code on the web / worktree 等の別マウント運用**。combomgr と combomgr-importer を別リポジトリとして接続した場合、両者は隣接ディレクトリに展開される)
   3. 上記いずれも無ければ、`combomgr-importer` の実体を探索して解決する(例 `Bash(find . .. -maxdepth 3 -type d -name dist -path '*combomgr-importer*')`)。
2. **未接続の判定(web で重要)**: どの候補にも `combomgr-importer/dist` が見つからない場合は、**importer リポジトリが未接続**と判断し、次を報告して**停止**する — 「`combomgr-importer` が参照できません。web 版はリポジトリを別マウントで参照するため、セッションに **combomgr-importer も接続**してください(手順: `docs/process/remote-ops.md`)」。これは「特定キャラの `dist/<code>.csv` だけ欠損」(→当該キャラのみ突合スキップ、Phase 1 で継続)とは**区別**する。

   > **★開発者から「dist 無しで進めてよい」と指示された場合の degrade**(2026-08-19 追記): 停止せず、**公式突合に依存しない検査だけ**を実施する。実施できるのは **手順 7-2(エイリアス dry-run。最も収穫が大きい)**・新列 3 本の整合・フレーム整合・move_code の重複/異常/**系統一貫性**・必須欠損・category・SA/CA 接頭辞・condition 残留・`notes_tool` 全読による C 節の構成・非 rush `through` 行の親候補抽出。**未実施になるのは A①(command 補完候補)・A②(空中技フレーム補正漏れ)・入力漏れ・公式値差分**である。
   > **この場合、レポート冒頭に「実施できなかった検査」の表を必ず置き、`seed-progress.md` の `precheck` 列は「済」ではなく「部分」にする**(§Phase 3 手順 13)。**未実施を緑と読ませない。**
3. 解決した `<DIST_DIR>` を Phase 0 の対象提示(手順 5)で開発者に明示する。

> **web 版の前提**: precheck 実行時は **combomgr と combomgr-importer の 2 リポジトリ接続**が必要。常時接続ではなく seed 工程時のみでよい。運用手順の正本は `docs/process/remote-ops.md`。ローカル起動では候補 1 が当たるため、この接続作業は不要。

---

## ガードレール(厳守)

- **公式の生値(フレーム・ダメージ)を git 管理ファイルへ転記しない**。突合の根拠に公式値を使うのは可だが、`character_data/` 配下(CSV・`command-correction-history.md`・`seed-progress.md`)へは公式値を書かない(転載禁止)。公式値の並記が要る比較表は **非 git の一時領域のレポート**(ローカル= `tmp/`、web=セッション scratchpad)にのみ書く。
- **上記の例外**: `docs/seed-data/` 配下の資料(`input-notes.md`・`check-criteria.md`・`official-data-edge-cases.md`)は、意図的差分の根拠として公式値との比較記述を含んだまま git 管理する既定運用(`docs/seed-data/README.md` §将来課題で OSS 公開時の取り扱いを別途検討中)。本コマンドがこれらへ追記する場合に限り、公式値の並記を禁止しない。**それ以外の git 管理ファイルへの転記は従来どおり禁止**。
- **Phase 1 は完全 read-only**。CSV も履歴も進捗表も書き換えない。書込は Phase 3(承認後)以降のみ。
- **意図的差分をミス扱いしない**。公式との差はまず `input-notes.md`(正典)・履歴の教訓に照合してから疑う。迷ったら「疑わしい(B)」に入れて開発者判断へ回す。**command は迷ったら埋めない**(誤 command は段階2 で誤解決を生むため、空のまま残す方が安全)。
- Git 操作(add/commit 等)は行わない。コミット要否は開発者が判断する。

---

## 作業手順

### Phase 0: 対象決定(自動)

1. `character_data/seed-progress.md` を読む(**進捗の正本**。`precheck` の 3 値の定義も同書が持つ＝Phase 3 手順 13)。**存在しなければ**、初期化を Phase 3 の一環として承認後に作成する旨をレポートに記し、当面は「進捗表なし＝全 CSV 未処理」とみなす。**既チェック済みキャラの名簿を本コマンドに列挙しない**(ハードコードした名簿は必ず陳腐化する。旧版は「10 キャラ」と書いたまま実体が 17 キャラになっていた)。
2. `character_data/*.csv` を Glob して存在する character_code 一覧を得る(`command-correction-history.md` 等の非 CSV は除外)。
3. **対象を決定**:
   - **引数でキャラ名を明示** → そのキャラを対象(precheck=済 でも可)。
   - **引数省略** → **`seed-progress.md` の precheck 列が「済」でない CSV**(進捗表に未登録の CSV も未処理として対象に含める)。
4. **既配布の保護**: 対象に `seed_imported=済` のキャラが含まれる場合、**警告して停止**し開発者の明示承認を待つ(既配布 CSV の変更は後続 UPDATE マイグレ扱いになるため)。
5. §「公式 dist の参照元解決」に従い `<DIST_DIR>` を確定する(importer 未接続なら停止)。決定した対象キャラ(と、確定した `<DIST_DIR>` および対応する `<code>.csv` の有無)を開発者に提示してから Phase 1 へ進む。**対象が空なら「未処理キャラなし」と報告して終了**。

### Phase 1: チェック実行(read-only・レポート作成)

6. 「必読の参照資料」を読む。
7. 対象キャラの手入力 CSV と対応する `<DIST_DIR>/<code>.csv`(= `combomgr-importer/dist/<code>.csv` をローカル/web で解決したもの)を読み、`docs/seed-data/check-criteria.md` の §1〜§3、**対象キャラの `notes_tool` 列(全件)**、`docs/seed-data/input-notes.md` の該当キャラ記述、`command-correction-history.md` の教訓に沿って突合・弁別する。**技単位の記述では `notes_tool` が最優先**、次に `input-notes.md` の該当キャラ節、最後に `check-criteria.md` §2 の要約(2026-07-12 時点)。対応する `<code>.csv` が無いキャラは、その旨を報告して突合をスキップする(欠損チェック等 CSV 単独で可能な項目のみ実施)。主なチェック:
   - **A(投入停止級)**: ① command 未割当の補完**候補**の生成(本来 command を持つべき技が空 → 公式を日本語名/フレーム/並び順/元英語名で突合。ホールド版=基底+`hold`合成、強化版プレフィックス改名、OD分割の語順違い、n段止め改名 等の既知パターンを適用)/ ② 空中技の発生フレーム補正漏れ(公式同値＝未補正の可能性、補正値は提案しない)/ ③ **`fastest_unreachable` の記入漏れ**(キャラ内で記入率が 100% でない列＝「途中から入れ始めた」跡。**空欄で投入すると `false` で確定し、CHANGE-094 が是正した B 型の誤提案が再発する**。`is_aerial` は正しいままなので**画面もテストも緑**であり人が見る以外の発見経路がない)。
   - **B(疑わしい差分)**: フレーム不整合(`total` ≠ `startup+active-1+recovery`。**★下記の注記を読むこと**)・空振り置換漏れ・move_code 重複/異常(アクセント欠落の壊れ code 含む)・category 誤り・custom_states の用意状況・必須項目欠損・公式にあって手入力に無い技(入力漏れ疑い)・TC のフレーム/ダメージ未入力・is_aerial 誤り・is_derived(ジャスト/ホールド/強化版)の付与漏れ・SA/CA の `SA1 `/`CA ` 接頭辞抜け・condition 残留(公式備考欄由来の `condition_ja`/`command` 内 `cond{…}`)・**系統内の「接尾辞 → `name_ja`」対応表の食い違い**(`check-criteria.md` §3 の M19-PHASE2 型。**`is_derived` / `name_ja` / `move_code` の 3 つが揃って矛盾を指す場合、誤っているのは `move_code` である**)。**★新列 3 本の整合**(下記)。

     **★フレーム整合「0 件」を品質の証拠として読ませないこと。** 2026-08-19 実測で 4 値がそろう 596 行すべてが成立し、24 CSV 全件でも例外が無かった。**手入力ツールが `total` を算出している公算が大きく、その場合本検査は恒真で `recovery` の誤りを一切検出しない**。レポートには**成立件数と 4 値が欠ける行数を併記**し、「検証していない」ことを緑と読ませない。

     **★新列 3 本の整合(B に含める。列の意味は §「CSV の列」を参照)**:
     - `fastest_unreachable` が空の行数(キャラ内で混在していれば **A へ格上げ**)/ `code` に `jumping_` を含む行が `true` か(機械規則)/ `is_aerial=true` かつ `false` の一覧(B 型で `false` を選んだ行＝判断の記録)/ `is_aerial=false` かつ `true` の一覧(`notes_tool` に理由があるか)
     - `category='rush_variant'` → `startup_basis='through'` か（★**元技が `startup` を持つ場合**。持たないなら `'unknown'` が正である＝`D-187` / `DES-003` §3.3 (i)。実測では seed 済みの rush 行 514 件は全件 `startup` を持つため、現状は全件 `'through'` でよい＝`M39-02`） / `is_derived=false` かつ `startup_basis != 'standalone'` の一覧(**索引に残るため衝突の温床**)/ `startup_basis` の値域
     - **非 rush の `startup_basis='through'` 行を全件列挙し、`notes_tool` の日本語文から親候補を抽出して併記する**(`move_derivations` の起票素材)。**`original_move_code` は rush 版の元技専用に使われており、派生技の親を書く欄が CSV に無い**。親参照が無いと CHANGE-094 の表記展開が働かず、**単独で出せない技が単独で出せるように表示される**。日本語文からの親抽出は機械では書けないため **AI が担う価値が高い**
   - **C(意図的差分の確認)**: `input-notes.md`(正典)および `check-criteria.md` §2 の (a)〜(h) に該当する差を「確認のみ・ミスでない」として列挙。⚠要確認項目は末尾に分離。**`input-notes.md` にのみ記述があり `check-criteria.md` §2 の要約に無い観点**は、要約の追随候補としてレポート末尾に列挙する(要約は 2026-07-12 時点のため)。
7-2. **★表記プリセットのエイリアス生成 dry-run(公式 dist 不要・必ず実施)**

   プリセット機能の完成により、**`command` 空の実害が 1 つ増えた**。従来は「段階2 のコマンド入力解決で永久に解決されない」だけだったが、現在は **`preset_aliases` のエイリアスが生成されず、その技だけ日本語技名で表示される**(`DES-004` §5.3 のフォールバック)。**画面は壊れずテストも緑のまま**なので、人が見る以外の発見経路がない。

   `seed-progress.md` §「seed 波ごとに再適用する規則」は「`-alias-report` を必ず出して確認すること」と定めているが、**その確認は「投入時」に置かれている**。投入時に見つけても CSV を直す手番がもう一巡増えるため、**投入前に回す**。

   ```bash
   CH=<対象キャラのカンマ区切り>
   for P in numeric srk; do
     go run ./cmd/seedgen -mode aliases -preset $P -chars $CH -movement-chars $CH \
       -out <未使用連番>_dryrun_$P -note "dry-run precheck" \
       -migrations <一時領域>/mig -alias-report <一時領域>/aliases-$P.md
   done
   ```

   - **★`-migrations` を一時領域へ向けること**(リポジトリの `migrations/` へ書かない)。実行後 `git status` がクリーンであることを確認する
   - **★`-check` は使わない**——生成物の差分確認だけで exit し、**`-alias-report` を書かずに終わる**
   - **★2 プリセット両方回す**(「投入しない行」の内訳が preset で異なる)
   - `-movement-chars` には**その波で増えたキャラだけ**を渡す(前の波を混ぜると down が前の波の投入分まで消す)

   レポートへ載せること:
   - **`collision` は必ず 2 種に分ける**。(a) **地上技×空中技のペア**＝実機の入力が同一であり区別するのは空中にいるかどうか。**生成器に空中接頭辞(`j.` 等)の規則が無いことが原因で、CSV を直しても解消しない**。(b) **それ以外**＝データ側の判断が要る。**全部を CSV のミスとして扱うと、直せない指摘が並ぶ**
   - `no-command` / `derived-no-command` の件数を **A① の `command` 空件数と突き合わせる**(直接の帰結なので一致するはず)
   - `rush-original-unfilled` は**元技側の欠落の連鎖**なので、元技の行を併記する
   - **参考値として既配布キャラの同型件数**も出す(同じ dry-run を `seed_imported=済` のキャラへ回す)。2026-08-19 実測で **`collision` 84 件(numeric)/ 74 件(srk)** が既に出荷済みであり、当時の旧 `000072_m20_seed_aliases_numeric.up.sql` に `ken/tatsumaki_senpu_kyaku_od` と `aerial_..._od` が**どちらも存在しない**ことで裏取りした。**★この裏取りは新系列では同じ形で再現できない**(`M33-02` が 9 群へ潰し、`000008_data_seed_preset_aliases` は `move_id` で持ち `move_code` を 1 件も含まない=実測。⇒ code を grep すると*どの技でも 0 件*になり常に通る空の検査になる)。**⇒ 再確認が要るときは DB へ問う**(`preset_aliases` を `moves.code` と join する)。**既配布の是正は本コマンドの手番ではない**(CHANGE 起票 or `followup-backlog` §J 行き)が、**今回の投入で同型が増えるため投入前に方針を決めるのが安い**

7-3. **★`move_code` 規約の機械検査(公式 dist 不要・必ず実施。2026-08-19 裁定4)**

   **常設フックにはしない。本コマンドの手順として回す。** **全 24 CSV を走査し、対象キャラ分＝要処置／既配布分＝参考件数の 2 段で出す**(既配布は改名マイグレが要るため本コマンドの手番ではない)。

   ```bash
   python3 - <<'EOF'
   import csv, glob, os, re
   TARGET = set("<対象キャラをスペース区切りで>".split())
   OK = re.compile(r'^[a-z0-9_]+$')
   f = []
   for p in sorted(glob.glob('character_data/*.csv')):
       ch = os.path.basename(p)[:-4]; seen = set()
       for r in csv.DictReader(open(p, encoding='utf-8')):
           mc, cat, nm = r['move_code'], r['category'], r.get('name_ja') or ''
           if not OK.match(mc):                       f.append((ch, mc, 'R1-文字種', ''))
           if mc in seen:                             f.append((ch, mc, 'R2-重複', ''))
           seen.add(mc)
           if cat == 'super_art'    and not re.search(r'(^|_)sa[123]_', mc): f.append((ch, mc, 'R3-SA接頭辞', nm))
           if cat == 'critical_art' and not re.search(r'(^|_)ca_', mc):      f.append((ch, mc, 'R3-CA接頭辞', nm))
           if cat == 'rush_variant' and not mc.startswith('rush_'):          f.append((ch, mc, 'R4-rush接頭辞', ''))
           if mc.startswith('rush_') and cat != 'rush_variant':              f.append((ch, mc, 'R4-rush接頭辞', cat))
           m = re.search(r'_(\d+)(hit|hits)(_|$)', mc)                       # R5 複数形(裁定10)
           if m and m.group(2) != ('hit' if int(m.group(1)) == 1 else 'hits'):
               f.append((ch, mc, 'R5-複数形', f"_{m.group(1)}{'hit' if int(m.group(1))==1 else 'hits'} が規約"))
           if len(mc) > 60:                           f.append((ch, mc, 'R6-異常長', str(len(mc))))
           if '__' in mc or mc.startswith('_') or mc.endswith('_'): f.append((ch, mc, 'R7-区切り', ''))
   for scope, title in ((True, '★対象(要処置)'), (False, '既配布(参考件数)')):
       sel = [x for x in f if (x[0] in TARGET) == scope]
       print(f"\n===== {title}: {len(sel)} 件 =====")
       for x in sel: print(f"  {x[0]:10} {x[1]:44} {x[2]:14} {x[3]}")
   EOF
   ```

   - **★R3 の違反は「表記の欠落」として実測できる**(2026-08-20)。生成器の `saAnnotation()`(`internal/seedgen/generate_m2002.go`)は `sanumber.Extract(moveCode)` で **`move_code` から** SA/CA 番号を取るため、`ca_`／`sa[123]_` が無いと注記が付かない。**手順 7-2 の dry-run レポート末尾「★SA 注記が付かなかった super_art / critical_art」の件数が動く**ので、そこまで確かめて報告する(机上の指摘で終わらせない)。**★`command` が空の間は層 A へ載らず件数に現れない**——command 補完後にもう一度回すこと。
   - **★本検査は綴り誤りを検出しない**(規約は満たすため)。`toxcic_wreath` / `ca_laws_of_ya_zi` / `sa1_messatu_gohado` / `trunc_slap` はいずれも **dist との `name_ja` 突合**で見つかった。**規約検査と公式突合は別物であり、両方回すこと。**
   - **★未投入キャラの改名は無料**(マイグレ不要・golden 無影響。教訓50)。**既配布は改名マイグレが要る**ので参考件数に留め、`followup-backlog` §J へ回す。

8. レポートを **非 git の一時領域**に `YYYYMMDD-pre-seed-data-check-report.md` として出力する(日付は `date +%Y%m%d`)。出力先はローカル= `tmp/` 配下、web/worktree=セッション scratchpad(`tmp/` が無い/書けない環境)。**このレポートは公式生値を含みうるため git へは載せない**(docs へ昇格しない)。様式は元プロンプト §4 の **A/B/C/D(キャラ別サマリ)/E(投入前に直すべき最小セット)**。各指摘に根拠(どの CSV のどの行か)を添える。**command 補完は候補と確信度(高/中/低)を併記するだけで、この時点では書き込まない**。

### Phase 2: 承認ゲート(問題個所を伝えて承認を得る)

9. レポートの要点を開発者に提示する。とくに:
   - **A の全件＋B の高確度分**(＝投入前に直すべき最小セット)。
   - **Phase 3 で自動適用してよい修正の候補**を明示的に列挙する:
     - command 補完(確信度「高」のみ) … 何件・どのキャラか
     - 機械的整形(SA/CA 接頭辞の付与・move_code typo 修正・condition 残留の掃き取り 等、確信度が高いもの)
   - **確信度 中/低・判断が割れる項目は自動適用に含めず「Phase 4 で一件ずつ確認」に回す**旨を伝える。
10. **開発者の承認を待つ。承認があるまで一切書き込まない。** 「どこまで適用してよいか」の線引き(例: 高のみ / SA接頭辞は保留 等)を開発者に確認してから進む。

### Phase 3: 承認された修正の適用＋記録更新

11. 承認された範囲のみ CSV を修正する(原則 `command` 列など**対象列だけ**を変更)。修正後 `git diff` を表示し、**意図しない列が変わっていないこと**を機械確認する。
12. **`character_data/command-correction-history.md` に今回分を追記する**(継続更新)。1補完1行で「キャラ/move_code/name_ja/補完前→補完後 command/対応 dist code/突合根拠(何を手がかりにしたか)/確信度/英名変更パターン」を残し、末尾の**教訓セクションを更新**(新たに判明した突合外れパターンを追記)。**公式の生値は書かない**。既存の見出し構成(キャラ別テーブル＋「整形対象」＋「教訓」)に合わせる。
13. **`character_data/seed-progress.md` を更新**: 今回処理したキャラの `precheck` 列を更新する(進捗表に未登録なら行追加)。**`seed_imported` 列は触らない**(既定「未」。seed 投入工程/開発者が手動更新する)。Phase 0 で進捗表が無かった場合はここで新規作成する(**キャラ名を本コマンドに列挙しない**。ハードコードした名簿は必ず陳腐化する)。

    **`precheck` 列は 3 値**(2026-08-19 に「部分」を追加。定義の正本は `seed-progress.md` の同名節):

    | 値 | いつ付けるか |
    |---|---|
    | **済** | 公式突合まで含めて完了した |
    | **部分** | **公式 dist 未接続で degrade 実施した**(CSV 内部の検査は完了・公式突合が未実施)。**Phase 0 手順 3 の自動対象になる**(＝未と同じ扱い) |
    | 未 | 未着手 |

    > **★「部分」を済へ繰り上げない。** command 補完の本体が未実施であり、**この状態で seed 投入すると `command` 空の技が配布 DB に載る**(＝表記プリセットのエイリアスも生成されない)。
14. 承認された整形(SA/CA 接頭辞・typo 修正・condition 掃き取り等)も同様に適用し、実施内容を履歴 or レポートに記録する。

### Phase 4: 判断不能な残件の個別確認

15. 確信度 中/低で自動適用しなかった項目・意図/ミスの弁別が付かない項目を、**一件ずつ**開発者に提示する(候補・根拠・確信度・「埋めない理由」を添えて)。開発者の回答(この command でよい/この値が正/省略でよい 等)を受けて、**指示された分だけ**追加修正を適用し、履歴へ追記する。
16. 全件処理し終えたら、残った未解決件数と次アクション(残りキャラの入力・入力ツール改修の検討余地 等)を短く総括する。

---

## レポート様式(非 git の `…-report.md`)

元プロンプト §4 に準拠:

- **A. 投入を止めるレベル**: A-1 command 未割当(候補＋確信度)/ A-2 空中技フレーム補正漏れ
- **B. 疑わしい差分**: 上記チェックの各観点。根拠(CSV 行)必須
- **C. 意図的差分の確認**: 乖離一覧該当分。⚠要確認は末尾分離
- **D. キャラ別サマリ表**: 公式/手入力 move 数・command 空件数・空中技補正状況・custom_states 有無・疑わしい件数
- **E. 総括**: 投入前に直すべき最小セット(A 全件＋B 高確度)

---

## 禁止事項・注意

- Phase 0/1 での書込・承認前の書込を禁止。command は迷ったら埋めない。
- 公式の生値を git 管理ファイル(`character_data/` 配下)へ転記しない。
- 意図的差分の誤検出(乖離一覧・履歴に照合せずミス断定)を避ける。
- `seed_imported=済` のキャラを対象に含む場合は警告停止し、開発者の承認を得る。
- 依頼スコープ(seed データチェックと承認済み修正)以外のファイルを編集しない。
- Git 操作(commit/push 等)は行わない。
