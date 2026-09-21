# M18-RESEARCH-01 調査報告: 確定反撃 seed 充足の確認 ＋ G-b ジャストパリィ有利算出（飛び道具）の実装前詰め

| 項目 | 内容 |
|------|------|
| 対応指示書 | `docs/instructions/phase3/M18-RESEARCH-01-seed-coverage-and-gb-projectile-survey.md` v1.0.0 |
| 種別 | 実装調査報告(read-only。事実列挙のみ。seed 充足の可否判断・算出式の最終確定・列追加は含めない) |
| 調査モード | auto(自由入力指示なし) |
| 作成日 | 2026-07-19 |
| 調査範囲 | §4 A〜C(実 SQL・実コード・実 CSV の view/grep/SELECT) |
| dev DB 実測範囲 | `~/.local/share/combomgr/combomgr.db`(SELECT のみ・python3 標準 `sqlite3` モジュール経由。書込ゼロ。**環境に `sqlite3` CLI が無いため python3 の sqlite3 モジュールで代替**) |
| 補足調査 | code-facts §8/§10 に加え、`internal/seedgen/*`(CSV→SQL 変換器・code-facts 非対象)・`character_data/*.csv`(12 キャラ分の手入力ソース)・`docs/handover/phase3/m17-to-m18-handover.md`・`docs/change-notes/CHANGE-077-notification.md`・`docs/handover/change-number-registry.md` を追加で参照(指示書 §3.1 に明記はないが、M18 直前の最新状態把握に必須と判断) |

---

## 0. 結論サマリ(冒頭)

- **A(seed 充足)**: 現行 DB は 12 キャラ(`characters` 12 行)だが、実攻撃技データを持つのは **10 キャラ(第一波9＋ryu)のみ**。`c_viper`/`dhalsim` は移動 system move 9 件のみで攻撃技 0 件(想定外の発見 #1)。10 キャラの攻撃系 7 category(critical_art/normal/rush_variant/special/super_art/throw/unique。**target_combo は別枠**)合計 777 技のうち、**recovery は 777/777(100%)充足**(NULL 0 件)。**on_block は 598/777(77%)充足・179 件(23%)が NULL**。NULL の内訳は throw 全 28 件(ゲームメカニクス上ガード不可のため構造的 NULL)＋special/normal/super_art/unique/critical_art の 151 件。**target_combo(39件・別枠)は on_block NULL 3 件・recovery NULL 2 件**(recovery NULL 2 件は startup 以下の全フレーム列が NULL の行=後述)。
- **A-2**: `on_block ≤ -4`(ガード確反母集団)は全体で **330 技**(キャラ別 17〜49 技)。
- **A-3**: `character_data/*.csv` の `is_projectile` 列(現 DB 未投入・後述)で `true` の技は 12 ファイル合計 **102 件**(現行 10 seeded キャラ分は 97 件・全件が現 DB の `moves` に実在=100%一致)。**special/super_art/critical_art の 3 category にのみ出現**(normal/unique/throw/rush_variant/target_combo/system は 0 件)。距離が code に明記される実例(`sonic_cross_2_meter_od`/`sonic_cross_3_meter_od`)を確認。
- **B(G-b 算出)**: 実データに符号矛盾は **0 件**(`recovery` は全域 0〜125 で負値なし・`on_block` は -99〜46 の符号付き)。**`is_projectile` は現行スキーマに列が無い**が、`internal/seedgen`(CSV→SQL 変換器)は既に CSV 20 列目の `is_projectile` を bool として全行パース済み(想定外の発見 #4。ただし SQL には投入せず破棄=コメント明記)。**projectile 候補 102 件中 recovery は 100%充足だが値 0 が 57 件(56%)**(sonic_boom/sonic_cross/hadoken 系等の多くの派生技が recovery=0)。**on_block が NULL の割合は projectile 候補(27%)と非 projectile(22%)でほぼ同水準**であり、on_block 欠損だけでは projectile/距離依存の判別材料にならない。
- **C(既存事実)**: FR301 dup キー(`DuplicateKey` 構造体・`CalcRecipeHash`)は M16-RESEARCH-01(2026-07-05)報告と**実コード上の差分なし**(`hit_type` を含む 6 項目 + recipe_hash)。`combo_punishes`/`moves.is_projectile` は migrations 全 35 本・Go 全体で **0 件**(DDL・model・repository のいずれにも存在しない)。**ただし dev DB の `combos` 実データは M16-RESEARCH-01 時点(published 30・最大 id 116)と現在(published 27・最大 id 32)で一致しない**(想定外の発見 #3。dup キーの判定ロジック自体は不変)。
- **想定外の発見(§0.3 許可の事実指摘)**: 5 件(後掲 §想定外の発見)。

---

## A. seed 充足(相手技データの網羅)

### 実態

**A-1(母数の明示)**: `characters` テーブルは 12 行(`ryu`/`ken`/`ingrid`/`c_viper`/`dhalsim`/`terry`/`guile`/`lily`/`kimberly`/`juri`/`mai`/`zangief`)。うち **`c_viper`(id=7)・`dhalsim`(id=8)は `moves.category='system'` の移動技 9 件ずつのみ**(`forward`/`back`/`micro_forward`/`micro_back`/`dash_forward`/`dash_back`/`jump_neutral`/`jump_forward`/`jump_back`。`migrations/000025_seed_movement_system_moves_all.up.sql` が全キャラへ投入)で、攻撃技(normal/special/super_art 等)は **0 件**(想定外の発見 #1)。攻撃技データを持つのは `migrations/000026_seed_moves_first_wave.up.sql`(terry/guile/lily/ingrid/kimberly/juri/ken/mai/zangief の 9 キャラ)＋ `migrations/000030_seed_moves_ryu.up.sql`(ryu)の **合計 10 キャラ**。

`moves` 総数(全 12 キャラ・全 category)= **944 件**。category 別内訳(全12キャラ): `critical_art` 10・`drive_impact` 10・`normal` 184・`rush_variant` 156・`special` 296・`super_art` 56・`system` 118(c_viper/dhalsim の 18 件含む)・`target_combo` 39・`throw` 28・`unique` 47。**攻撃系 7 category(critical_art/normal/rush_variant/special/super_art/throw/unique)の合計 = 777 件**(10 seeded キャラのみ・c_viper/dhalsim は該当 0 件のため差分なし)。`target_combo`(39件)は多段特殊技の分類であり本節では別枠集計する(A-1 末尾)。

on_block/recovery の充足・NULL 件数(**母数=攻撃系 7 category・777 件・10 seeded キャラ・target_combo 除く**):

| 母数 | 件数 | on_block 充足 | on_block NULL | recovery 充足 | recovery NULL |
|---|---:|---:|---:|---:|---:|
| 攻撃系 7 category 合計(777・target_combo除く) | 777 | 598 | **179** | **777** | **0** |
| target_combo(別枠・39) | 39 | 36 | 3 | 37 | 2 |
| 7category+target_combo 合計(816) | 816 | 634 | 182 | 814 | 2 |

キャラ別 on_block NULL 件数(攻撃系 7 category=`critical_art`/`normal`/`rush_variant`/`special`/`super_art`/`throw`/`unique`。target_combo は含まない=上表で別枠 3 件〔ingrid/lily/terry 各 1〕):

| キャラ | on_block NULL 件数 | 内訳(category:件数) |
|---|---:|---|
| ryu | 11 | normal6, special3, throw2 |
| ken | 13 | normal7, special2, throw2, unique2 |
| ingrid | 29 | normal6, special18, super_art3, throw2 |
| terry | 10 | normal6, super_art2, throw2 |
| guile | 20 | normal6, special9, super_art1, throw4 |
| lily | 16 | critical_art1, normal6, special5, super_art1, throw2, unique1 |
| kimberly | 26 | normal6, special18, throw2 |
| juri | 13 | normal7, special2, super_art1, throw3 |
| mai | 9 | normal6, throw3 |
| zangief | 32 | critical_art1, normal7, special11, super_art5, throw6, unique2 |

(7 category 合計 = 179。target_combo(別枠)の on_block NULL 3 件〔ingrid/lily/terry 各1〕を加えると 8 category 込みの合計は 182。全数は本節冒頭表のとおり。)

**throw category は 10 キャラ全員・全 28 件で on_block が 100% NULL**(guile4/ingrid2/juri3/ken2/kimberly2/lily2/mai3/ryu2/terry2/zangief6)。これは投げ技がガード不可というゲームメカニクス上の構造的欠損であり、special/normal 系の「距離等で値が定まらない」欠損とは性質が異なる。

recovery が NULL の行は **上記 816 件(7category+target_combo)中 2 件のみ、いずれも target_combo**: `ingrid.satelite_leap`・`lily.double_arrow`。この 2 行は `startup`/`active`/`total`/`on_hit`/`on_block`/`recovery` の**フレーム列が全て NULL**(damage のみ 1400 で充足)で、`character_data/ingrid.csv`・`character_data/lily.csv` の元 CSV も同じ 2 行が recovery 列空欄(他の全行は recovery 充填済み)。**攻撃系 7 category(777件・target_combo除く)の内部には recovery NULL は 0 件**。

**A-2**: `on_block ≤ -4`(ガード確反候補の母集団)は全体で **330 技**。キャラ別: guile 32・ingrid 23・juri 32・ken 41・kimberly 35・lily 35・mai 49・ryu 38・terry 28・zangief 17。category 別: critical_art 8・normal 43・rush_variant 19・special 162・super_art 42・target_combo 34・unique 22(throw は 0=on_block が全 NULL のため該当なし)。

**A-3(距離依存/飛び道具 候補列挙)**: 現行 DB の `moves` には距離依存クラスを示す列が無いため、`code`/`category` からの手掛かりで候補を列挙する(判定はしない)。

- コード名に "sonic"/"hadoken"/"sun_shot"/"shuriken_bomb"/"flame_*"等の飛び道具系文字列を含む技は 10 キャラ中 6 キャラ(guile/ingrid/ken/kimberly/mai/ryu)に実在。例: `ryu.hadoken_light`(on_block=-5, recovery=0)/`ryu.hadoken_medium`(on_block=-7, recovery=0)/`ryu.hadoken_heavy`(on_block=-9, recovery=0)/`guile.sonic_boom_light`(on_block=-3, recovery=0)/`kimberly.shuriken_bomb_light`(on_block=NULL, recovery=NULL)。
- **距離が code に明記される実例**: `guile.sonic_cross_2_meter_od`・`guile.sonic_cross_3_meter_od`(いずれも on_block=NULL, recovery=0)。
- `character_data/*.csv`(12 キャラ分の手入力ソース。DB 未投入含む)には 20 列目に **`is_projectile` 列が既に存在**し、`true` 行は 12 ファイル合計 **102 件**(詳細は B-2)。うち**現行 10 seeded キャラ分は 97 件・全件が現 DB `moves` に実在(100%一致・0 件の欠落)**。category 別は special 87・super_art 14・critical_art 1(normal/unique/throw/rush_variant/target_combo/system は 0 件)。
- `notes`/`notes_tool`/`condition_ja`/`condition_en`(`raw_data` JSON、`character_data/*.csv` 経由)を "距離"/"間合" で grep した結果は **0 件**(現 DB `raw_data` 非 NULL 12 件・`character_data/*.csv` 全 12 ファイルとも一致)。距離依存を明示するテキスト注記は現状存在しない。

### 契約・正典との差

- spec draft §8-1 は「ほぼ揃っているが、波動拳など着弾までの時間が距離で変わる技は値が書かれていない例が多い」とするが、実測では **recovery の欠損は 816 件(7category+target_combo)中 2 件(いずれも target_combo の frame データ全欠損行)のみ**で、攻撃系 7 category(777件)の内部には recovery 欠損は無い。"distance-dependent なので recovery が書かれていない" という記述と直接対応する実例は確認できなかった(is_projectile 候補 102 件中 recovery 欠損は 0 件=B-2 参照)。**距離で値が変わりやすいのは on_block(179件 NULL)であり recovery ではない**という実測結果は、spec の想定(recovery が空になりやすい)と一致しない可能性がある(判断はしない・事実指摘のみ)。
- phase3-overview §M14-03b は手入力 CSV を「`moves-input-tool` 22 列」と記す。実物の `character_data/*.csv` ヘッダおよび `internal/seedgen/model.go:19-26`(`csvColumns`)はいずれも **20 列**(想定外の発見 #6)。

### 後続スコープへの含意

- 攻撃系母数(777件・10キャラ)を基準にすると recovery は事実上 100% 充足しており、**ジャストパリィ経路の走査母数はガード経路(on_block 598件充足)より広い**(recovery 充足777件 vs on_block 充足598件。差分179件は「ガードでは拾えないがジャストパリィでは拾える」候補)。
- throw(投げ)は on_block が構造的に NULL のため、ガード確反の走査対象からそもそも除外する設計であれば、母数の考え方(777 vs 749=777-28)に影響する。

### 推奨(決定しない)

- 案 A: ガード確反の走査母数は throw を除いた 749 件、ジャストパリィ確反の走査母数は 777 件(target_combo を含めるなら 816 件のうち recovery 充足 814 件)とする。
- 案 B: c_viper/dhalsim(攻撃技 0 件)・manon/luke(`character_data/*.csv` に存在するが未 seed、B-2 参照)を M18 走査対象キャラの範囲確定にどう含めるかは開発者判断。

---

## B. G-b ジャストパリィ有利算出(飛び道具)の実装前詰め材料

### 実態

**B-1(判定式の実データ突合)**: spec §8-2/phase3-overview §2.4 の確定式(有利フレーム=ガード時 `-(on_block)`／ジャストパリィ時 `recovery`(反転不要)、反撃成立⟺反撃技 startup ≤ 有利フレーム)を実データで符号突合した。

- `recovery` の実値域は **0〜125(負値 0 件)**。`on_block` の実値域は **-99〜46**(符号付き)。負の recovery が無いため「反転不要」の前提と矛盾する実例は無い。
- サンプル(on_block ≤ -4 の実在行、ランダム抽出): `kimberly.bushin_prism_strikes`(on_block=-12, recovery=24, startup=26)/`ryu.hashogeki_medium`(on_block=-6, recovery=17, startup=19)/`mai.flame_heavy_hissatsu_shinobi_bachi`(on_block=-13, recovery=21, startup=18)等。いずれも `-(on_block)`(正の有利フレーム)・`recovery`(正の値)がそのまま得られ、符号の矛盾は確認できなかった。
- **`recovery` が充足していて `on_block` が NULL の行(=ガードでは拾えずジャストパリィでのみ拾える候補)は攻撃系 7 category(777件・target_combo除く)で 179 件**(recovery NULL が同母数中 0 件のため、on_block NULL の 179 件はそのまま該当)。**target_combo を含めた 816 件母数では 180 件**(target_combo の on_block NULL 3 件中、recovery も充足しているのは 1 件のみ)。

**B-2(`is_projectile` 対象の判定材料)**:

- **`moves.is_projectile` は現行 DB スキーマに存在しない**(§C-3 で裏取り)。一方、**`internal/seedgen`(CSV→migration SQL 変換ツール、code-facts 非対象)は既に `is_projectile` を CSV 20 列目としてフル実装済み**:
  - `internal/seedgen/model.go:19-26` の `csvColumns` に `"is_projectile"` を含む(20列中13番目)。
  - `internal/seedgen/csv.go:108-110` で `parseBool(g(12))` により **bool として厳格パース**(空文字は不可・`true`/`false` の明示値必須)。
  - `internal/seedgen/model.go:58`: `IsProjectile bool // 保全のみ・SQL 非投入(M18 G-b で列追加予定)` — **既に「M18 で列追加予定」と明記されたコメントが存在**。
  - `internal/seedgen/model.go:9`: `raw_data は notes/notes_tool のみ(空→NULL)。command/condition_*/is_projectile は列が無く投入しない`。
  - `internal/seedgen/generate_test.go:10` の `testHeader` も同じ 20 列(is_projectile を含む)を定数として保持。
- **`character_data/*.csv`(12 ファイル: guile/ingrid/juri/ken/kimberly/lily/luke/mai/manon/ryu/terry/zangief)の `is_projectile` 列を集計した結果**(全 990 行、bool 必須のため空欄 0 件):
  - `true`: **102 件**、`false`: **888 件**。
  - キャラ別 true 件数: guile 24・ingrid 33・juri 4・ken 4・kimberly 0・lily 0・luke 5・mai 20・manon 0・ryu 8・terry 4・zangief 0。
  - category 別 true 件数: **special 87・super_art 14・critical_art 1**(normal/unique/throw/rush_variant/target_combo/system は 0 件)。
  - **現行 10 seeded キャラ分は true 97 件・現 DB `moves` との突合で 97/97(100%)が実在**(A-3 既掲)。**manon/luke(未 seed)分は true 5 件**(まだ DB に反映されていない候補)。
- `is_projectile=true` の recovery 値分布(102件): `0`=57件、非0=45件(1〜68 の範囲、内訳は `22`×7・`1`×5・`14`×4・`24`×4 等)。**recovery が空欄の行は 0 件**(is_projectile=true でも recovery は必ず埋まっている)。
- `is_projectile=true` で `on_block` が空欄の行は **28/102(27%)**。一方 `is_projectile=false`(888件)で on_block 空欄は **199/888(22%)**。両者はほぼ同水準。
- `properties`(旧・技の属性を表す列。`high/mid/low/throw/projectile/air_projectile` の値を持ち得た)は **M14-01(CHANGE-054)で削除済み**(`migrations/000018_cleanup_moves_unobservable_columns.up.sql:23`: `ALTER TABLE moves DROP COLUMN properties;`)。現行スキーマ・現行 CSV のいずれにも `properties` 相当列は存在せず、projectile 判定材料として使えるのは `is_projectile`(seedgen 側で既に破棄・DB 非投入)のみ。
- `raw_data`(notes/notes_tool)は現 DB 非 NULL 12 件のみで、いずれも projectile/距離を明示する内容ではない(例: `guile.phantom_cutter` の「ガードフレームはこれが正しい」、`mai.musasabi_no_mai` の「画面端、最低空で計測」等、測定条件の注記であり距離依存の判定材料ではない)。

**B-3(走査除外方式の材料・NULL 分布)**:

- **recovery の NULL は 816 件(7category+target_combo)中 2 件のみ、いずれも target_combo**(A-1 既掲。全フレーム欠損行。攻撃系 7 category・777 件の内部には recovery NULL は 0 件)。projectile 候補(is_projectile=true 102件)でも recovery NULL は **0 件**。→ recovery 単体の NULL 分布は projectile/距離依存の判別材料として機能しない(そもそも欠損がほぼ無いため)。
- **on_block の NULL は projectile 候補で 27%・非 projectile 候補で 22%**(既掲)。→ on_block の NULL 単体も projectile/距離依存の判別材料として弱い(両者で大差が無い)。
- **code に距離が明記される実例**(`sonic_cross_2_meter_od`/`sonic_cross_3_meter_od`)は on_block=NULL・recovery=0 という組み合わせを持つ。同系統の `sonic_cross_light`/`sonic_cross_medium`/`sonic_cross_heavy`/`sonic_cross_od` も同じ組み合わせ(on_block=NULL, recovery=0)。
- G-d(距離除外の pruning/curation 2 層フラグ)は combo_steps/setup_steps 側(ユーザーの反撃候補選定)に対する永続化であり、本調査で確認した moves 側の is_projectile/on_block-NULL は「走査時にどの技を候補として拾うか」の材料である。両者は別レイヤ(moves 側の走査母集団 vs combo_punishes 側の永続選定)である旨は spec §6-3 の記述と整合する。

### 契約・正典との差

- spec §8-1「距離依存クラスは値が書かれていない例が多い」は、実測では recovery でなく on_block 側に強く現れる(B-3)。
- phase3-overview §2.4 G-b は「既存列からほぼ算出可能」とするが、**is_projectile の判定材料そのものは `internal/seedgen` に既存**(セクション B-2 既掲)であり、この事実は phase3-overview／spec draft のいずれにも明記されていない(想定外の発見 #4)。

### 後続スコープへの含意

- `is_projectile` 列追加(G-b)の初期値投入は、**現行 10 seeded キャラについては `internal/seedgen` が既に持つ 97 件の true フラグをそのまま使える**(seedgen 側のロジック変更のみで済み、再入力は不要と見える。ただし最終的な列追加・投入方式の設計判断は本調査の対象外)。
- manon/luke(未 seed)分の is_projectile=true 5 件は、M14-03d/e(`docs/handover/phase3/m17-to-m18-handover.md:131-132`)の投入待ち。

### 推奨(決定しない)

- 案 A: `is_projectile` 列追加時に `internal/seedgen` の破棄ロジック(`model.go:9`, `model.go:58`)を「保全のみ」から「SQL 投入する」へ変更する形で、既存 97 件のフラグをそのまま反映する。
- 案 B: on_block NULL を projectile 判定の代理指標として使わない(B-3 の実測により判別力が弱いため)。

---

## C. 後続指示書の前提となる既存事実(read-only 裏取り)

### 実態

**C-1(FR301 dup キーの実体・M16-RESEARCH-01 との差)**:

- `internal/repository/combo/repository.go:35-42` の `DuplicateKey` 構造体: `CharacterID`/`StarterMoveID`/`Position`/`OpponentStance`/`HitType`/`OpponentSize` の 6 フィールド。M16-RESEARCH-01-report(2026-07-05)の記載と**完全一致**(差分なし)。
- `internal/service/combo/duplicate_keys.go:24-32` の `DuplicateCheckFields`(`character_id`/`recipe_hash`/`starter_move_id`/`position`/`opponent_stance`/`hit_type`/`opponent_size`)も同一。`CalcRecipeHash`(同ファイル 45-72行)・`canonicalModifiersJSON`(81-101行)のアルゴリズムも M16-RESEARCH-01 の記載(ソート→`<move_id>:<canonicalModifiersJSON>`→`\n`連結→SHA-256)と一致。
- `internal/repository/combo/repository.go:807-826`(`FindActiveByDuplicateKey`)の SQL 条件(`character_id = ?` + `hit_type`/`opponent_size` 等の nullable 対応)も同一。
- `internal/model/combo.go:8-10` に `HitTypeNormal`/`HitTypeCounter`/`HitTypePunishCounter = "punish_counter"` が定数として既に定義済み(M18 が使う値は既存)。
- **`hit_type='punish_counter'` の実データ**: `migrations/000012_seed_combos_durability.up.sql`(aki/jamie/guile 向け durability seed)に 6 件存在するが、これらのキャラは `migrations/000017_cleanup_ajg_seed_and_unify_ryu_move_code.up.sql:47`(`DELETE FROM combos ...`)で明示的に削除済み。**現行 dev DB に `hit_type='punish_counter'` の実データは 0 件**(`combos` の hit_type 分布: NULL 29・counter 1・normal 2)。
- コードは M16-RESEARCH-01 時点から**変更なし**と確認できた(指示書 §3.1「まず M16-RESEARCH-01-report を参照」の要求どおり、実コード突合済み)。

**C-2(on_block NULL 母数)**:

- 攻撃系 7 category(777件・target_combo除く・10 seeded キャラ)中 on_block NULL = **179 件**(A-1 既掲)。category 別内訳: critical_art 2・normal 63・special 68・super_art 13・throw 28・unique 5(rush_variant は 0)。**target_combo(別枠・39件)は on_block NULL 3 件**。
- recovery NULL は 7 category(777件)中 **0 件**。**target_combo(別枠)のみ 2 件**(A-1 既掲)。
- 「on_block も recovery も両方 NULL」の行(=ガード・ジャストパリィどちらの走査からも脱落する行)は攻撃系 7 category(777件)中 **0 件**。**target_combo の recovery NULL 2 件(`ingrid.satelite_leap`/`lily.double_arrow`)は on_block も NULL**=完全にフレームデータ自体が存在しない行であることを意味する。target_combo の on_block NULL 3 件のうち残り 1 件(recovery は充足)は「ジャストパリィでは拾えるがガードでは拾えない」候補。

**C-3(`combo_punishes`/`moves.is_projectile` の DDL 非存在確認)**:

- `grep -rn "combo_punishes" migrations/ internal/ web/src/` は **0 件**(SQL・Go・TypeScript のいずれにも無い)。`combo_punishes` の文字列自体は `docs/` 配下の設計メモ・引き継ぎ書・CHANGE 通知書(いずれも計画段階の記述)にのみ出現。
- `grep -rn "is_projectile" migrations/*.sql` は **0 件**(全 35 マイグレーションの DDL に列定義なし)。`internal/model/move.go`(`Move` 構造体、49-53行付近)にも `IsProjectile` フィールドは無い(`OnBlock`/`Recovery`/`IsAerial`/`SetupOnly` のみ)。`is_projectile` という文字列がヒットするのは `internal/seedgen/*`(CSV パーサ、B-2 既掲)のみで、いずれも「DB へは投入しない」ことを明記したコメント付き。
- `moves` テーブルの現行 DDL(`migrations/000001_init_schema.up.sql:39` 起点の `CREATE TABLE moves` ＋ `migrations/000013`/`000018`/`000032` 等の ALTER 群を通算した現行列)には `combo_punishes` に相当するテーブルも `is_projectile` 列も存在しない。

### 契約・正典との差

- 差分なし(C-1)。ただし dev DB の `combos` 実データ自体は M16-RESEARCH-01 時点と現在で一致しない(想定外の発見 #3、後掲)。

### 後続スコープへの含意

- FR301 dup キーの判定ロジックは M18 の重複防止(「同一レシピ＋hit_type=punish_counter」)設計の前提としてそのまま使える(コード変更なしで再確認済み)。
- `combo_punishes`/`moves.is_projectile` はいずれも新規追加が必要(現行スキーマに痕跡なし)。

### 推奨(決定しない)

なし(本節は事実確認のみで方式選択の余地がない)。

---

## 想定外の発見(§0.3 許可の事実指摘)

1. **`c_viper`/`dhalsim` は攻撃技データが 0 件**: `characters` に 12 行存在するが、`c_viper`(id=7)・`dhalsim`(id=8)は移動 system move 9 件ずつのみで、normal/special/super_art 等の攻撃技を一切持たない。「seed 済みは 10 キャラ」(指示書 §3.2 前提事実)は攻撃技データを持つキャラ数として正確だが、`characters` テーブルの行数(12)とは一致しない。
2. **`manon`/`luke` は `character_data/*.csv` に既に存在するが未 seed**: `character_data/manon.csv`・`character_data/luke.csv` が存在し(is_projectile=true をそれぞれ 0 件・5 件含む)、`grep` で全 35 マイグレーションを検索した結果いずれのキャラも `migrations/*.sql` に投入記録が無い。`docs/handover/change-number-registry.md:109` の記載(M14-03d=manon・M14-03e=luke、いずれも投入待ち)と整合する。
3. **dev DB の `combos` 実データが M16-RESEARCH-01(2026-07-05)時点と現在で一致しない**: M16-RESEARCH-01-report は「published(is_draft=0 AND deleted_at IS NULL) 30 件・combo 最大 id 116」と記録するが、現在の dev DB は **combos 総数 32 件(id 1〜32)・published 27 件**であり、M16-RESEARCH-01 が言及した combo id(78/79/80/91 等)は現存しない。`migrations/000012` の durability seed(`hit_type='punish_counter'` 6件含む)は `migrations/000017` の明示 DELETE で消える設計どおりだが、それ以外の**開発者による蓄積データも大幅に縮小**しており、devcontainer 再構築等でユーザー生成データが失われた可能性がある(記憶: `~/.local/share/combomgr` は volume 未マウント時に再ビルドで消える罠)。**FR301 dup キーの判定ロジック自体(C-1)はコード上変化していない**ため、M16-RESEARCH-01 の衝突実測の結論は当時のデータに基づくものとして参照する必要がある。
4. **`internal/seedgen` が `is_projectile` を既にフルパース済みだが DB には投入していない**: `internal/seedgen/model.go:58` に `IsProjectile bool // 保全のみ・SQL 非投入(M18 G-b で列追加予定)` という、M18 を名指しした準備済みコメントが存在する。phase3-overview・spec draft のいずれにもこの実装済みインフラの存在は明記されていない。
5. **`recovery` は projectile 候補で「空欄」でなく「0」になる傾向がある**: spec §8-1 は「距離依存技は値が書かれていない(空欄)例が多い」とするが、実データでは is_projectile=true の 102 件中 recovery が**空欄の行は 0 件**、代わりに**値が `0` の行が 57 件(56%)**を占める(sonic_boom/sonic_cross/hadoken 系等)。「距離依存だから記録されていない」という想定と、「距離依存だが 0 という具体値が記録されている」という実データの間に差がある(0 が実測値か便宜上のプレースホルダかは本調査では判断しない)。
6. **`moves-input-tool` の列数記載(22列)と実物(20列)の不一致**: phase3-overview(`docs/instructions/phase3-overview.md`, M14-03b 節)は「手入力 CSV(`moves-input-tool` 22 列)」と記すが、`character_data/*.csv` の実ヘッダおよび `internal/seedgen/model.go:19-26`(`csvColumns`)はいずれも **20 列**で完全一致する。

---

## 要決定事項(番号付き・決定はしない)

1. **seed 充足の可否判断**: 攻撃系 7 category・777 件(10 seeded キャラ)中 on_block 充足 598 件(77%)・recovery 充足 777 件(100%)という実測値をもって「seed 充足」と判断するか、補充が必要かは開発者判断(指示書 §開発者への確認事項 #2 のとおり本調査は件数列挙のみ)。母数の取り方(throw 28件を含める/除くか、target_combo〔39件・on_block NULL3/recovery NULL2〕を母数に含めるか)も要確認。
2. **`c_viper`/`dhalsim`(攻撃技0件)・`manon`/`luke`(未seed)の M18 走査対象範囲**: 現行 10 seeded キャラのみを対象にするか、これら 4 キャラの seed 状況(M14-03d/e 完了待ち・c_viper/dhalsim は「必ず最終波」= `m17-to-m18-handover.md:133`)を踏まえてスコープをどう区切るか。
3. **`is_projectile` 列追加時の初期値投入方式**: `internal/seedgen` が既に保持する 97 件(10 seeded キャラ分)の true フラグを列追加時にそのまま SQL 投入する経路(seedgen 側の「保全のみ」ロジック変更)を使うか、別の投入方式を取るか。
4. **G-b の projectile 判定に on_block-NULL を代理指標として使わない**という実測結果(projectile 27% vs 非projectile 22%でほぼ同水準)を踏まえ、`is_projectile` 列(またはそれに準ずる判定源)を必須の一次情報として扱うか。
5. **recovery=0(projectile 候補 102 件中 57 件)の意味**: 実測値として記録されたものか、距離依存につき便宜上の値かは本調査では判別できない。G-b の算出式が recovery=0 のケースをどう扱うか(有利フレーム0として採用/走査除外)は開発者判断。
6. **phase3-overview の「22列」表記と実物「20列」の不一致**: 表記修正(CHANGE 対象外・自由改訂)の要否。
7. **M16-RESEARCH-01 の dup 衝突実測(published 30件時点)が現行 dev DB(published 27件・別id体系)と対応しないこと**: 本調査時点の再実測が必要かどうかは、C-1 のとおり判定ロジック自体は不変であるため、M18 の重複防止設計上は実コード確認で足りると考えられるが、最終判断は開発者。

---

*以上、M18-RESEARCH-01 調査報告。read-only 厳守(コード・マイグレーション・seed・DES/REQ 本体・テストへの変更ゼロ。dev DB は SELECT のみ、python3 標準 sqlite3 モジュール経由)。本報告は G-b(ジャストパリィ有利算出・飛び道具)の算出式設計、および M18 物理設計 CHANGE(G-b/c/d/e)起票前の Plan Mode 入力として作成した。*
