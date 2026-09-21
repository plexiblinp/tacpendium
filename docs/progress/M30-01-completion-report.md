# M30-01 完了報告: 仮想コントローラの技の出し分け（何を出すか）

| 項目 | 内容 |
|------|------|
| 文書ID | M30-01-completion-report |
| バージョン | **1.3.0**（2026-09-08・**★★§2.0 の訂正＝実測の母集団を取り違えていた**。共通技タブ新設 ／ 未分類への改称 ／ 案 C ／ 案 A′ ／ 文言案 A）／ 1.2.0（2026-09-08・§2.5.1 の追補＝区分 A が A1/A2 に割れることの実測）／ 1.1.0（2026-09-08・Phase C のレビュー取り込みを反映）／ 1.0.0 |
| 対象指示書 | `docs/instructions/M30-01-controller-move-surfacing.md` **v1.1.0** |
| チェックリスト | `docs/instructions/reviews/M30-01-review-checklist.md` v1.0.0 |
| 着手基点 | `50235ce` |
| 作成日 | 2026-09-08 |
| CHANGE 消費 | **0 本**（自採番していない。要る箇所は §6 に一覧） |
| マイグレ消費 | **0 本** |

---

## 1. 何をしたか（先に結論）

**★最初の成果物は実装ではなく実測である**（指示書 §0.1）。**§2 が本サブで最も価値のある成果物であり、§3 以降の実装はすべて §2 の上に立っている。**

| 射程 identity | 着地 |
|---|---|
| **`P4M-017`**（技の表示基準） | **実測 → 述語 1 本へ集約**（§2・§3.1）。**★ファミリー UI の規則そのものは 1 行も変えていない**——変更案は §6 で設計卓へ請求する（開発者判断 2026-09-08） |
| **`P4M-007`**（ターゲットコンボタブ） | **実装**（§3.3） |
| **`P4M-008`**（非表示技・キャラ別技タブ） | **実装。(a) と (b) を 2 タブに分けた**（開発者判断 2026-09-08＝読み2、§3.4） |
| **`SM-100`**（全技一覧から入力できる技を省く） | **実装。切替トグル・既定 OFF**（開発者判断 2026-09-08、§3.5） |
| **`SM-135`**（ターゲットコンボも入力に欲しい） | **`P4M-007` に畳んだ。別のものを作っていない** |

---

## 2.0 ★★★【2026-09-08 訂正】§2 の実測は母集団を取り違えていた

**★本節は §2 全体に優先する。以下の数字が正である。**

| | 私が数えたもの | 実際 |
|---|---|---|
| 母集団 | `character_data/*.csv` ＝ **2743 行** | **`moves` テーブル ＝ 3026 行** |
| 未分類（着手時点） | **330 行**と報告した | **551 行**だった |

**★差の 283 行は、CSV ではなくマイグレーションが直接投入している行である。** 大半は**移動系の system 技 217 行**（`forward` / `back` / `micro_forward` / `micro_back` / `jump_neutral` / `jump_forward` / `jump_back` の 7 code × 31 キャラ。`000025_seed_movement_system_moves_all` 等）。

**★★この 217 行は「どの面にも出ていない」状態だった。⇒ 開発者が実機で「システムの move が未分類に居る」と気づくまで、私の実測もテストも 1 度も検出していない。**

| # | 何を間違えたか |
|---|---|
| **★★1** | **指示書 §2.1 は「`moves` に在って仮想コントローラに出ない行」を数えよと書いていた。⇒ `moves` はテーブルであって CSV ではない。私は CSV を「seed の正本」と見なした** |
| **★★2** | **その誤りを回帰テストで固定してしまった**（`moveSurfacing.roster.test.ts`）。**⇒ 間違った母集団を「実測の固定」と称して緑にしていた。テストが在ることが、確からしさの証明にならない実例である** |
| **★★3** | **「`dash_forward` / `dash_back` は seed に無いので押しても何も起きない」と報告したが誤りである。** 実 DB には 31 キャラぶん在り、開発者の実機確認どおり押せる。**⇒ 存在しないと報告した 10 code は、すべて実在する** |
| **★4** | **是正**: roster test の冒頭へ母集団の限界を明記し、**「共通技 13 code のうち CSV に在るのは 4 code だけ」** を新たな主張として固定した（同型の取り違えを次に押さえる）。**実 DB での件数は E2E が実サーバ越しに主張する** |

### 2.0.1 実 DB での実測（正）

| 時点 | 未分類 | 内訳 |
|---|---:|---|
| 着手時点 | **551** | special 291 ／ **system 217** ／ normal 21 ／ throw 17 ／ rush_variant 5 |
| 本サブ完了時点 | **251** | special 210 ／ normal 20 ／ throw 17 ／ rush_variant 4 |

**キャラ別（完了時点）**: blanka 12 ／ zangief 15 ／ cammy 15 ／ akuma 13 ／ m_bison 13 ／ marisa 13 ／ dhalsim 13 ／ c_viper 12 ／ guile 12 ／ kimberly 12 ／ rashid 12 ／ jamie 11 ／ ken 11 ／ aki 9 ／ dee_jay 9 ／ alex 8 ／ ingrid 8 ／ luke 8 ／ juri 7 ／ elena 6 ／ e_honda 6 ／ ed 5 ／ jp 5 ／ sagat 4 ／ chun_li 3 ／ **mai 3** ／ **lily 2** ／ **ryu 2** ／ terry 1 ／ yasmine 1 ／ **manon 0**。

> **★以下 §2.1〜§2.9 は CSV 母集団での記述であり、上の訂正を読んでから参照すること。** 述語の逐語（§2.2）と区分の分類（§2.3 の A〜E）は母集団に依らず有効だが、**件数はすべて CSV 基準である。**

---

## 2. ★★§2.1 実測 — いま何が出て、何が出ていないか

**★本節はコードを読んだだけの記述ではない。** タブ側の述語は現物のコードから逐語で写し（§2.2）、出ない技の全数は `character_data/*.csv` 全 31 キャラ・2743 行に同じ述語を当てて算出した（§2.3）。**算出は回帰テストとして固定してある**（`moveSurfacing.roster.test.ts`。§5.2）。

### 2.1 現行のタブ構成は 4 枚 ＋ タブ外の常設システム行

| # | タブ | `data-testid` | 描画部品 |
|---|---|---|---|
| 1 | 通常技 | `recipe-tab-normal` | `HitBoxLayout` |
| 2 | 特殊技 | `recipe-tab-unique` | `DirectSpecPanel` |
| 3 | 必殺技 | `recipe-tab-special` | `SpecialMovePanel` |
| 4 | SA | `recipe-tab-super-art` | `DirectSpecPanel` |
| — | 共通技（タブ外・常設） | `recipe-system-*` | `SystemRow` |

### 2.2 ★★タブごとの述語（現物の条件式を逐語で写す）

| タブ | 述語 | 出所 |
|---|---|---|
| **通常技** | `entries[buildTokenKey(dir, 強度, ボタン)]` を引き、ヒットした `move_code` を `moves` から完全一致で解決。**ミスなら**方向を 3 ゾーンへ縮約して `` `${standing\|crouching\|jumping}_${light\|medium\|heavy}_${punch\|kick}` `` を完全一致で解決 | `inputResolutionStage2.ts:70-89`（`resolveDirectionalInput`）／`inputResolution.ts:38-47`（`resolveStage1MoveId`） |
| **通常技（ラッシュ ON）** | 上記で確定した `code` に対し `` `rush_${code}` `` を完全一致で解決。**方向 7/8/9 は問答無用で `null`** | `inputResolutionStage2.ts:94-102` |
| **特殊技** | `moves.filter((m) => categories.includes(m.category))`、`categories = ["unique"]` | `DirectSpecPanel.tsx:27` ／ 呼出は `VirtualController.tsx:246` |
| **特殊技（ラッシュ ON）** | `resolveRushByCode(moves, m.code)`＝`` `rush_${m.code}` `` の完全一致。**トグル自体の表示可否は** `hasUniqueRushVariant`＝`category==="unique"` の技に 1 件でもラッシュ版が在るか | `DirectSpecPanel.tsx:47` ／ `inputResolution.ts:62-64, 79-83` |
| **必殺技** | `m.category === "special"` **かつ** `parseSpecialCode(m.code) !== null`。`parseSpecialCode` は `_od` / `_light` / `_medium` / `_heavy` の**いずれかで終わるときだけ**ファミリーと強度に分解し、**終わらなければ `null` を返して `continue` する** | `inputResolution.ts:106-116`（`parseSpecialCode`）／`131-135`（`deriveSpecialFamilies`） |
| **SA** | `categories = ["super_art", "critical_art"]` | `VirtualController.tsx:262` |
| **共通技（タブ外）** | `SYSTEM_BUTTON_TO_MOVE_CODE` の**固定 6 code**＝`drive_impact` / `drive_parry` / `throw_forward` / `throw_back` / `dash_forward` / `dash_back`（`throw` は `throw_forward` への後方互換エイリアス） | `useControllerInput.ts:22-30` |

**★段階2 の解決表そのものにも 3 段の絞り込みが在る**（BE 側・`internal/service/inputresolve/service.go:88-133`）。**⇒ 「出ない」の一部はフロントではなくここで落ちている。**

1. `moves.is_aerial = true` を除外
2. `category` が `normal` / `unique` / `special` 以外を除外
3. `token_key` が `^[1-9]?(LP|MP|HP|LK|MK|HK)$` に合致しないものを除外（**⇒ `236LP` 等の多方向コマンドは 1 件も載らない**）
4. 同一 `token_key` に複数残ったら `unique`/`special` を優先し、なお複数なら `moves.id` 最小
5. 索引の構築時点で `is_derived = true` の行は載っていない（`internal/moveindex/moveindex.go`）


### 2.3 ★★出ない技の全数と分類 — 全 31 キャラ 2743 行中 **456 行**が出ない

**分類は 4 種**（指示書 §2.1-4）。**★「意図的に除いている」と「述語で落ちている」を混ぜていない。**

| 区分 | 件数 | 理由の種別 | 内訳 |
|---|---:|---|---|
| **A 強度接尾辞を持たない必殺技** | **291** | **意図的に除いている**（`CHANGE-166`＝既知の設計） | 非派生 **72** / 派生 **219** |
| **B ターゲットコンボ** | **126** | **述語が無い**（`category='target_combo'` を並べるタブが 1 枚も無い） | 非派生 9 / 派生 117 |
| **C `rush_variant` の孤児** | **5** | **データ**（基底 `code` と `rush_` 名が一致しない、または基底が面に出ていない） | 全数を §2.5 に列挙 |
| **D 段階1/2 のどちらでも解決しない `normal`** | **17** | **述語で落ちている** | 全数を §2.5 に列挙 |
| **E 共通技 6 code 以外の投げ** | **17** | **述語で落ちている** | 全数を §2.5 に列挙 |

**★「理由が読めない」区分は 0 件である。** 456 行すべてに上記いずれかの説明が付いた。**⇒ `P4M-017` の逐語「表示基準がよくわからない」の答えは、「基準が壊れている」のではなく「基準が 5 か所に分かれていて、どれも画面から見えない」であった。**

### 2.4 ★★開発者が名指ししたジェイミー（`P4M-017` の逐語）

**127 行中 27 行が出ない**（A=9 / B=14 / C=1 / D=1 / E=2）。

| 区分 | `move_code` | `category` | `is_derived` |
|---|---|---|---|
| A | `the_devil_inside`（魔身・酔い+1） | special | false |
| A | `the_devil_inside_up2` / `_up3` / `_up4` | special | true |
| A | `the_devil_inside_reach_drink_lv4` / `_up2_reach_drink_lv4` / `_up3_reach_drink_lv4` | special | true |
| A | `tenshin`（点辰） | special | **false** |
| A | `swagger_hermit_punch`（疾歩仙掌） | special | true |
| B | `phantom_sway` / `_2hits` / `_drink_and_reach_drink_lv4`（幻酔舞） | target_combo | true |
| B | `bitter_strikes` / `_2hits`（鋭鍾打） | target_combo | true |
| B | `full_moon_kick` / `_2hits` / `_drink_and_reach_drink_lv4`（円月脚） | target_combo | true |
| B | `intoxicated_assault_1hit` / `drink_level_3_intoxicated_assault`（酩酊襲） | target_combo | true |
| B | `drink_level_4_ransui_haze_2_retreat` / `_3_immediate` / `_3_delay` / `_3_drink_while_retreating`（乱酔旋） | target_combo | true |
| C | `rush_drink_level_1_standing_light_punch` | rush_variant | true |
| D | `drink_level_1_standing_light_punch` | normal | true |
| E | `forward_throw_drink` / `forward_throw_reach_drink_lv4` | throw | true |

**★`tenshin`（点辰）は非派生の必殺技でありながら出ていない。⇒ 開発者の逐語がジェイミーを名指しした理由の中核はここである。**

### 2.5 ★★区分 A で最も見落とされやすい形 — **`_od` だけが押せる 95 件**

**区分 A 291 件のうち 95 件は、`<code>_od` が同じキャラに別行で在る。**

**⇒ 画面上はファミリー名のボタンが出るが、そのファミリーで押せるのは OD だけになる**（`SpecialMovePanel` は `byStrength` に入った強度だけを活性にするため、弱・中・強は非活性で、素の版に至ってはボタンが存在しない）。**★これが「必殺技が一部しか仮想コントローラには出ていない」の実体である。**

**★★24 キャラ・95 件に及ぶ。** 設計書が名指ししていた 2 件（`guile/sonic_break`・`terry/quick_burn`）は**このうちの 2 件にすぎない**（指示書 §0.4-3 の実査項目への回答）。件数の多い順に：

| キャラ | 件数 | 例 |
|---|---:|---|
| kimberly | 10 | `sprint` / `hidden_variable` / `genius_at_play` / `nue_twister` / `bushin_izuna_otoshi` … |
| ingrid | 10 | `sun_flare_lv1`〜`lv3` / `solar_burst_lv1_neutral` … |
| akuma | 6 | `demon_low_slash` / `demon_guillotine` / `demon_swoop` … |
| dee_jay | 6 | `double_rolling_sobat` / `jus_cool` / `funky_slicer` … |
| marisa | 6 | `scutum` / `tonitrus` / `procella` / `enfold` … |
| zangief | 4 | `double_lariat` / `borscht_dynamite` / `russian_suplex` / `siberian_express` |
| juri | 4 | `saihasho` / `ankensatsu` / `go_ohsatsu` / `shiku_sen` |
| ken | 4 | `kazekama_shin_kick` / `gorai_axe_kick` / `senka_snap_kick` … |
| e_honda | 4 | `sumo_dash` / `teppo_triple_slap` … |
| sagat | 4 | `mighty_tiger` / `greedy_tiger` / `nova_tiger` / `low_tiger_shot` |
| c_viper | 4 | `focus_force` / `_holding` / `_max_holding` / `_forward_step` |
| （他 13 キャラ） | 33 | `guile/sonic_break` ／ `terry/quick_burn` ／ `jamie/tenshin` 等 |

**★★この規則そのものを変えるかどうかは本サブの判断ではない**（指示書 §0.4-2）。**⇒ 開発者は 2026-09-08 に「ファミリー UI を拡張する。ただし方法は改めて検討し、設計卓へ請求する」と判断した。⇒ 本サブでは `DES-004` §2.1 / `DES-005` §5.7 の規則を 1 行も変えていない。請求内容は §6 に置いた。**

### 2.5.1 ★★【2026-09-08 追補】区分 A は 2 つの別問題に割れる

**レビュー取り込み後、未掲載タブの実物（blanka 34 件 / mai 26 件）を読んで分かった。⇒ 291 件は同じ理由で落ちているのではない。**

| 枝 | 件数 | 形 | 非派生 |
|---|---:|---|---:|
| **A1** | **186** | **`move_code` のどこにも強度語が無い**（`tenshin` / `sonic_break` / `double_lariat` / `flash_chop`） | 70 |
| **A2** | **105** | **★強度語は在るが `code` の途中に在る**（`lightning_beast_light_rolling_attack` / `flame_od_kachousen`）。**⇒ `parseSpecialCode` は末尾しか見ないため `null` になる** | **2** |

**★★A2 はすべて「キャラ固有状態の強化版必殺技」である。** 接頭辞は 13 キャラ・12 種——`flame`（mai 21）／ `lightning_beast`（blanka 18）／ `perfect_timing`・`cannon_strike`・`reverse_edge`・`fatal_leg_twister`（cammy 12）／ `windclad`（lily 10）／ `mine_set`（m_bison 9）／ `buffed`（rashid 8）／ `high_jump`（c_viper）／ `sumo_spirit`（e_honda）／ `bayani`（yasmine）。

**★★これは開発者の逐語（`P4M-008` (a)）「SA の隣に何らかの理由で表示していない技〔強化版必殺技等〕だけを出すタブ」の「強化版必殺技」そのものである。⇒ 逐語の指していた対象が実測で特定できた。**

| # | 帰結 |
|---|---|
| **★★1** | **A2 は「単一強度だから載らない」のではない。弱・中・強・OD が揃っている**（例＝`lightning_beast_{light,medium,heavy,od}_rolling_attack` の 4 行）**。⇒ ファミリー UI が「状態接頭辞を剥がしてからファミリーを導く」形なら、そのまま 1 ファミリーとして載る。** |
| **★★2** | **⇒ §6-1 の請求は 2 本に割れる。A1 は `CHANGE-166` が明文化した設計そのものだが、A2 はファミリーの導き方の話であり、別の判断になる。** |
| **★3** | **A2 の 105 件中 103 件が `is_derived=true` である。⇒ 「状態を経ないと出せない」という `is_derived` の第 1 義と一致しており、データ側は正しい。** |
| **★★4** | **★キャラ固有状態タブ（§3.4 (b)）の軸が、この接頭辞と一致していない。** 現行の軸は `custom_states[].code` の部分一致だが、**`mai` は状態 code が `flame_stock` で技の接頭辞が `flame_` のため 1 件も当たらない**（同型＝`m_bison` の `psycho_mine_is_set` ↔ `mine_set_`）。**逆に `cammy` は `custom_states` を 1 つも持たないのに A2 を 12 件持つ。⇒ 2 つの軸は重なるが一致しない。★どちらを採るかは開発者判断である**（§8.1 に置いた）。 |

### 2.6 区分 C / D / E の全数

**C（`rush_variant` の孤児・5 件）**

| キャラ | `move_code` | なぜ出ないか |
|---|---|---|
| ryu | `rush_axe_kick` | **基底が `axe_kick_2`（unique）であり、`resolveRushByCode` が探すのは `rush_axe_kick_2` である。⇒ 名前が 1 文字ずれているだけで到達不能になる** |
| alex | `rush_standing_heavy_punch_holding` / `rush_standing_heavy_kick_holding` | 基底（区分 D）が出ていないため連鎖して出ない |
| zangief | `rush_standing_heavy_punch_holding` | 同上 |
| jamie | `rush_drink_level_1_standing_light_punch` | 同上 |

**D（段階1/2 のどちらでも解決しない `normal`・17 件）**

| 形 | 件数 | 例 |
|---|---:|---|
| `_holding`（ボタンホールド版） | 10 | marisa 6 / alex 2 / zangief 2。**`command` が `p_h hold` であり、段階2 の形状フィルタ `^[1-9]?(LP\|MP\|HP\|LK\|MK\|HK)$` に合致しない** |
| `neutral_jumping_*`（垂直ジャンプ攻撃） | 6 | blanka / c_viper / chun_li / e_honda / juri / ken 各 1。**段階1 の合成形は `jumping_*` であり、`neutral_jumping_*` とは別 code である** |
| キャラ固有状態版 | 1 | `jamie/drink_level_1_standing_light_punch`。**`command` は `p_l` で形状は合致するが、同一 `token_key` に素の `standing_light_punch` が居て `moves.id` 最小のタイブレークで負ける** |

**E（共通技 6 code 以外の投げ・17 件）**

| 形 | 件数 | 例 |
|---|---:|---|
| 方向つきのコマンド投げ | 8 | `zangief/german_suplex`・`spinebuster`・`russian_drop`・`brain_buster` ／ `guile/flying_mare`・`flying_buster_drop` ／ `dhalsim/yoga_splash` ／ `alex/illegal_knees` |
| 方向なし（`p_l k_l`）の追加投げ | 7 | `blanka/wild_bites` ／ `cammy/leg_scissors_choke` ／ `chun_li/ryuseiraku` ／ `jp/tornado` ／ `juri/air_throw` ／ `mai/air_throw` ／ `rashid/desert_slider` |
| 派生投げ | 2 | `jamie/forward_throw_drink` ／ `forward_throw_reach_drink_lv4` |


### 2.7 キャラ横断の実測表（全 31 キャラ）

| キャラ | 総行 | 面に出る | 出ない | A | B | C | D | E |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| aki | 72 | 61 | 11 | 9 | 2 | 0 | 0 | 0 |
| akuma | 107 | 90 | 17 | 13 | 4 | 0 | 0 | 0 |
| alex | 98 | 88 | 10 | 3 | 2 | 2 | 2 | 1 |
| blanka | 118 | 84 | 34 | 32 | 0 | 0 | 1 | 1 |
| c_viper | 89 | 77 | 12 | 11 | 0 | 0 | 1 | 0 |
| cammy | 99 | 82 | 17 | 14 | 2 | 0 | 0 | 1 |
| chun_li | 87 | 83 | 4 | 1 | 1 | 0 | 1 | 1 |
| dee_jay | 84 | 67 | 17 | 9 | 8 | 0 | 0 | 0 |
| dhalsim | 97 | 85 | 12 | 11 | 0 | 0 | 0 | 1 |
| e_honda | 78 | 64 | 14 | 10 | 3 | 0 | 1 | 0 |
| ed | 75 | 64 | 11 | 5 | 6 | 0 | 0 | 0 |
| elena | 99 | 84 | 15 | 6 | 9 | 0 | 0 | 0 |
| guile | 88 | 72 | 16 | 10 | 4 | 0 | 0 | 2 |
| ingrid | 91 | 72 | 19 | 15 | 4 | 0 | 0 | 0 |
| jamie | 127 | 100 | 27 | 9 | 14 | 1 | 1 | 2 |
| jp | 75 | 66 | 9 | 4 | 4 | 0 | 0 | 1 |
| juri | 73 | 62 | 11 | 8 | 1 | 0 | 1 | 1 |
| ken | 80 | 66 | 14 | 10 | 3 | 0 | 1 | 0 |
| kimberly | 95 | 76 | 19 | 12 | 7 | 0 | 0 | 0 |
| lily | 81 | 65 | 16 | 13 | 3 | 0 | 0 | 0 |
| luke | 83 | 68 | 15 | 8 | 7 | 0 | 0 | 0 |
| m_bison | 79 | 62 | 17 | 14 | 3 | 0 | 0 | 0 |
| mai | 96 | 67 | 29 | 25 | 3 | 0 | 0 | 1 |
| manon | 72 | 68 | 4 | 0 | 4 | 0 | 0 | 0 |
| marisa | 108 | 87 | 21 | 7 | 8 | 0 | 6 | 0 |
| rashid | 99 | 86 | 13 | 11 | 1 | 0 | 0 | 1 |
| ryu | 84 | 74 | 10 | 6 | 3 | 1 | 0 | 0 |
| sagat | 77 | 69 | 8 | 4 | 4 | 0 | 0 | 0 |
| terry | 70 | 62 | 8 | 1 | 7 | 0 | 0 | 0 |
| yasmine | 84 | 74 | 10 | 5 | 5 | 0 | 0 | 0 |
| zangief | 78 | 62 | 16 | 5 | 4 | 1 | 2 | 4 |
| **計 31 キャラ** | **2743** | **2287** | **456** | **291** | **126** | **5** | **17** | **17** |

> **★「面に出る」の数え方**: 4 タブ・共通技行・ラッシュトグルのいずれか 1 経路でも到達できる `move` を 1 と数える。**⇒ 同じ技が 2 経路で出る場合も 1 と数える。**

### 2.8 ★`SM-100` の現状（指示書 §2.1-5・§6-3 の実査項目）

**「仮想コントローラで入力できる技」を判定する経路は、実装に 1 か所も無い。**

全技一覧のプルダウンは `groupMovesByCategory(moves)`（`RecipeBuilder.tsx:370-378`）で **`category` ごとに束ねて全行を出しているだけ**であり、コントローラ側の述語（§2.2）を一切参照していない。**同じ形のプルダウンが `SetupRecipeEditor.tsx` にもう 1 つ在る**（`category` フィルタ付き）。

### 2.9 ★`is_derived` はコントローラ側で使われていない（指示書 §6-5 の実査項目）

**使われていないどころか、フロントエンドに届いていない。** `GET /api/moves` の DTO（`internal/api/move/dto.go:11-33` の `MoveResponse`）は `is_derived` を返さず、`web/src/features/moves/types.ts` の `Move` にも `isDerived` は無い（`grep -rn "isDerived" web/src` は 0 件）。**⇒ `is_derived` を出し分けに使うには DTO の拡張が要る。**

**★本サブでは `is_derived` を使わなかった。** 理由は 2 つ。

1. **`M19-DESIGN-08` §0 が決着させたのは「filler 候補から何を除くか」であり、述語は `NOT (category='target_combo' AND is_derived = 1)` である。⇒ 入力面は「出す」側なので、同じ軸をそのまま裏返すと `target_combo` 126 行のうち 117 行（派生）が入力できないことになる。★開発者の逐語は「ターゲットコンボも入力に欲しい」（`SM-135`）であり、真逆になる。**
2. **同書 §1.1 が明記するとおり `is_derived` は 3 義を兼ねる**（前段/状態を経ないと出せない／コマンド衝突で単独解決不能／必殺技の分岐が一意解決できない）**。⇒ 入力面の可否という第 4 の用途を載せるのは、同書 §7 の列追加審査規約が禁じている「事実列に第 2・第 3 の用途を載せる」にあたる。**

**⇒ 出し分けは `category` と `move_code` の形（＝既に画面が使っている軸）だけで組み、`is_derived` にも新しい列にも依存しない。**


---

## 3. 実装

### 3.1 `P4M-017` — 出し分けの規則

**規則の正本は `web/src/features/combo/moveSurfacing.ts` の 1 本である。**

| 関数 | 何を決めるか |
|---|---|
| `normalTabMoveIds(moves, entries)` | 通常技タブの到達集合。**★推測しない**——現物の解決関数（`resolveDirectionalInput` / `resolveDirectionalRushInput`）を、入力面が持つ全組み合わせ（方向 9 × 強度 3 × ボタン 2 × ラッシュ 2）について実際に引いて集める |
| `isOnUniqueTab` / `isOnSpecialTab` / `isOnSuperArtTab` / `isOnTargetComboTab` / `isOnSystemRow` | 各面の述語。**必殺技は `deriveSpecialFamilies` と同じ 2 条件**（一致することをテストが検査する） |
| `isControllerSurfaced` | 上の論理和。**`SM-100` はこれの裏返しを使う**（§3.5） |
| `surfaceBuckets` | タブ描画用のバケットを 1 走査で作る |
| `characterStateMoves` | キャラ固有状態タブの母集団（§3.4 (b)） |

**★呼び出し側から規則を取り上げた。** `DirectSpecPanel` は `categories: string[]` を受け取って自分で `moves.filter` していたが、これだと「何を出すか」がタブごとの呼び出し引数へ散る。**⇒ `list: Move[]` を受け取るだけにし、決めるのは述語だけにした。**

**★★ファミリー UI の規則（`CHANGE-166`）は 1 行も変えていない。** 開発者判断（2026-09-08）は「ファミリー UI を拡張する。ただし方法は改めて検討し、設計卓へ請求する」であり、**本サブの成果物には含めない**。請求内容は §6 に置いた。**⇒ 接尾辞なしの必殺技 291 件は、§3.4 (a) の未掲載タブから入力できる。**

### 3.2 規則で全キャラが説明できるか（指示書 §2.2-4・完了条件 2）

**説明できる。** seed 全 31 キャラ 2743 行について、`surfaceBuckets` の判定と §2.3 の分類が完全に一致することを回帰テストで固定した（`moveSurfacing.roster.test.ts`）。**★説明できない行は 0 件である。**

**★ただし「説明が付く」は「望ましい」ではない。** 区分 C（`ryu/rush_axe_kick`）は**データ側の命名のずれ**が原因であり、規則が正しく働いた結果として落ちている。§6 に記録した。

### 3.3 `P4M-007` — ターゲットコンボタブ

- **特殊技タブの隣**（通常技 → 特殊技 → **ターゲットコンボ** → 必殺技 → SA）。開発者の逐語どおり。
- **母集団は `category='target_combo'` の全 126 行。`is_derived` で絞っていない。** 理由は §2.9 に書いた——`M19-DESIGN-08` §0 の述語は filler 候補から**除く**側のものであり、そのまま裏返すと 117 行が入力できなくなって `SM-135`「ターゲットコンボも入力に欲しい」と真逆になる。
- **`SM-135` は本項へ畳んだ。** 別のものを作っていない（指示書 §2.3-3）。

### 3.4 `P4M-008` — 非表示技・キャラ別技タブ（**2 タブ**）

**(a) 未掲載タブ**（`SA` の隣）

- 母集団は **`isControllerSurfaced` が false を返す行そのもの**。**★「非表示」を別途定義していない。** 定義が 2 つになると必ずずれる。
- seed 実測 **330 行**（キャラ最大 34＝blanka、最小 0＝manon）。最大の族は区分 A（291 行）。

**(b) キャラ固有状態タブ**（最後）

**開発者判断（2026-09-08）＝読み2「キャラ固有の状態で分岐する技を集めたタブ。(a) とは別の 1 枚」。**

- **判定軸は `characters.custom_states[].code` を `move_code` が含むか。★新しい列も新しい API も足していない**（指示書 §2.2-3 / §4-5）。`Character.customStates` は既に配られている生 JSON である。
- **★軸の限界を実測した**（定義を持つ 14 キャラ）。**限界はコードの逐語注記にも書いてある。**

| 当たるキャラ | 件数 |
|---|---:|
| blanka（`blanka_chan_bomb` / `lightning_beast`） | 25 |
| jamie（`drink_level` / `the_devils_song`） | 23 |
| lily（`windclad`） | 13 |
| ryu（`denjin_charge`） | 9 |
| e_honda（`sumo_spirit`） | 6 |
| juri / yasmine / c_viper / guile | 各 1〜2（**すべて SA の行＝偽陽性寄り**） |
| **aki / ingrid / kimberly / m_bison / mai** | **0**（状態名と `move_code` の語が一致していない） |

- **★偽陽性 4 件（`sa1_limit_decoupler` / `sa2_feng_shui_engine` / `sa2_feng_shui_engine_dash` / `sa2_nakatagong_lakas`）は落としていない。** 状態を発生させる技そのものであり、無関係ではないためである。
- **★本タブは経路であって区分ではない。** ここに並ぶことは `isControllerSurfaced` の判定を変えず、未掲載タブの母集団も動かない（テストで固定）。

### 3.5 `SM-100` — 全技一覧から入力できる技を省く

**開発者判断（2026-09-08）＝「切替トグル・既定 OFF」。**

- **述語は `isControllerSurfaced` の裏返し 1 本**（指示書 §2.5-2）。全技一覧側に第 2 の判定を書いていない。
- **★★ON にしても入力手段が消える技は 1 件も無い。** 省かれるのはコントローラのどれかの面から押せる技だけで、**残る集合は未掲載タブの母集団と完全に一致する**（チェックリスト §6-3 が禁じる「ファミリー UI に載らない技を省く」に当たらない）。E2E で「点辰」が残ることを名指しで固定した。
- **★保持は component-local の `useState` だけ**。ブラウザストレージへ置いていないため `web/CLAUDE.md` §1 の台帳へ新しいキーを足していない（`check-browser-storage-keys.sh` 緑）。**面を離れると既定（OFF＝全件表示）へ戻る**ため、「消えたまま戻せない」状態にならない。
- 対象は 2 面（コンボのレシピ入力・セットプレイのレシピ入力）。同じ部品・同じフックを使う。


---

## 4. テスト

### 4.1 変更統計（着手基点 `50235ce`）

**★数える範囲を `web/` に限る。** 完了報告そのものを含めると、報告を書き足すたびに数字が古くなるためである（レビュー 低-10）。`git diff --numstat 50235ce HEAD -- web/`:

| 追加 | 削除 | ファイル |
|---:|---:|---|
| 116 | **0** | `web/e2e/m30-01-controller-surfacing.spec.ts`（新規） |
| 43 | **0** | `web/src/features/combo/components/ControllerInputOmissionToggle.tsx`（新規） |
| 95 | **0** | `web/src/features/combo/hooks/useControllerInputOmission.ts`（新規） |
| 254 | **0** | `web/src/features/combo/moveSurfacing.ts`（新規） |
| 251 | **0** | `web/src/features/combo/moveSurfacing.test.ts`（新規） |
| 192 | **0** | `web/src/features/combo/moveSurfacing.roster.test.ts`（新規） |
| 216 | 0 | `web/src/features/combo/components/VirtualController/VirtualController.test.tsx` |
| 123 | 0 | `web/src/features/combo/components/RecipeBuilder.test.tsx` |
| 101 | 6 | `web/src/features/combo/components/VirtualController/VirtualController.tsx` |
| 82 | 0 | `web/src/features/setup/components/SetupRecipeEditor.test.tsx` |
| 23 | 1 | `web/src/features/combo/components/RecipeBuilder.tsx` |
| 23 | 1 | `web/src/features/setup/components/SetupRecipeEditor.tsx` |
| 21 | 6 | `web/src/features/combo/components/VirtualController/DirectSpecPanel.tsx` |
| 7 | 2 | `web/src/features/combo/components/VirtualController/HitBoxLayout.tsx` |
| 9 | 1 | `web/src/locales/ja.json` |
| 9 | 1 | `web/src/locales/en.json` |
| **1565** | **18** | **16 ファイル** |

**★新規のつもりのファイルが `+` だけであることを確認した**（教訓 `E-225` ／ CLI Phase A 補足 (b)）。**新規 6 ファイルはいずれも deletions が 0 である**（上表で太字にした行）。18 件の deletions はすべて既存 10 ファイルの書き換えによるものである。**作る前に `ls` で同名の不在も確認済み。**

### 4.2 実行結果

| 対象 | 結果 |
|---|---|
| `go test ./...` | **緑**（exit 0・失敗パッケージなし） |
| `cd web && pnpm test` | **緑**（219 files / **2568 passed**。★取り込み後の値） |
| `make e2e`（全数） | **257 passed / 1 failed**。**★失敗 1 件は本サブと無関係である**（§4.4） |
| `make e2e-only P=m30-01` | **5 passed** |
| `bash scripts/check-artifact-integrity.sh` | **緑**（1 本目に実行。検査 14 件の自己検査 ＋ 生成物 4 件） |
| `bash scripts/check-progress-log-index.sh` | **緑**（★Phase D の追記後。**追記前は赤であり、レビュー 高-1 が検出した**。§7-6 参照） |
| `check-stop-discipline` / `check-doc-refs` / `check-browser-storage-keys` / `check-enum-sync` / `check-import-order` / `check-doc-inventory` | **すべて緑**（ベースライン超過なし） |

**新規テストの内訳**

| ファイル | 件数 | 何を主張するか |
|---|---:|---|
| `moveSurfacing.test.ts` | 26 | 出る側 12 経路 ／ **出ない側を理由の区分ごとに 1 件ずつ**（指示書 §2.6-2）／ 必殺技タブの述語が `deriveSpecialFamilies` と一致すること |
| `moveSurfacing.roster.test.ts` | 7 | **seed 全 31 キャラ 2743 行**で §2.1 の実測を固定（キャラ横断＝チェックリスト §5-4） |
| `VirtualController.test.tsx`（追加分） | 15 | 3 枚の新タブ ／ **`M24-12` の骨格に触れていないこと**（§5） |
| `RecipeBuilder.test.tsx`（追加分） | 3 | `SM-100` のトグル。**★区分 A の `sonic_break` が省かれないことを名指しで主張** |
| `m30-01-controller-surfacing.spec.ts` | 5 | 実 seed（ジェイミー）での E2E |

### 4.3 ★★破壊確認（チェックリスト §4）

**2 件とも、対象区分に §0.2 の族（強度接尾辞を持たない必殺技）を含めた**（計測点 `M-139`）。

**破壊 A — `isOnSpecialTab` から `parseSpecialCode` の条件を外す**（＝区分 A を「面に出る」側へ倒す）

| 層 | 結果 |
|---|---|
| Vitest | **13 failed / 77 passed**。落ちたのは実測固定 5 本・区分 A の 2 本・`deriveSpecialFamilies` との一致 1 本・未掲載バケット 1 本・`surfaceOf` 1 本・未掲載タブ 2 本・`SM-100` 1 本 |
| `tsc` | **赤**（`parseSpecialCode` が未使用になり `TS6133`）。**★この経路だけで気づける形にはなっていない**——条件を残したまま無効化すると型検査は緑になるため、改めてその形でも確認した |
| E2E | **2 failed / 3 passed**（未掲載タブから `tenshin` が消える ／ `SM-100` で「点辰」が省かれてしまう） |

**破壊 B — `isOnTargetComboTab` を常に false にする**

| 層 | 結果 |
|---|---|
| Vitest | **13 failed / 55 passed**。ターゲットコンボタブ 2 本・未掲載タブ 2 本・実測固定 5 本・述語 4 本 |

**★どちらの破壊でも「要素が存在すること」だけを見ているテストは落ちなかった。** 落ちたのは**並びと母集団を見ているテスト**である（チェックリスト §4-1 の趣旨）。**復元後は全数緑に戻ることを確認済み。**

### 4.4 ★`make e2e` の失敗 1 件は本サブと無関係である

**失敗したテスト**: `web/e2e/m24-12-editor-rebuild.spec.ts:31` 「(3) 保存直後の遷移では確認が出ず、かつ編集画面へ戻らない」

**初回の失敗の逐語**（`--retries=0` で採取）:

```
Error: ★★戻るを 2 回押しても起点(ホーム)へ戻れない＝履歴に編集画面の複製が残っている
       (保存後の遷移が離脱ガードの補正を通っていない)
```

**★再試行時に出る「重複コンボの警告」は二次被害である**——初回でコンボが作られた後に落ちているため、再試行の保存が `VAL-C02` に当たる。**⇒ 根因は履歴・離脱ガード側であり、重複ではない。**

**★★本サブ由来でないことを実測で切り分けた。** `git show 50235ce:<path>` で `web/src` の変更 14 ファイルを**着手基点の内容へ戻し**、新規 6 ファイルを削除した状態で同じ 1 本を回したところ、**同一のエラーで落ちた**。**⇒ 着手基点で既に赤である。** 確認後、作業ツリーは元へ戻してある（`git status` クリーン）。

**★本サブの差分は履歴・離脱ガードに 1 行も触れていない**（変更したのは仮想コントローラのタブ構成、出し分けの述語、全技一覧のトグルのみ）。

**⇒ 行き先は §7 の横断課題へ 1 行残す。本サブでは直さない**（指示書 §4「やらないこと」の射程外を広げないため）。


---

## 5. ★`M24-12` の骨格に触れていないこと（指示書 §0.2・§3-5）

| 骨格 | 状態 |
|---|---|
| **ボタン群**（`OptionButtonGroup`） | **1 行も触っていない**（`git diff --stat` に現れない） |
| **数字キーの割当** | **1 つも消費していない。** 仮想コントローラのタブは shadcn/Radix の `Tabs` であり、数字キーの購読を持たない。`OptionButtonGroup` の数字キーは**その群にフォーカスがある間だけ**効く。**⇒ タブを 4 → 7 枚にしても割当は動かない。** 回帰テストで固定した（`★M24-12 の入力の骨格に触れていないこと` — タブへフォーカスを置いて `1`〜`5` を押しても既定タブのまま）。**★このテストの射程は「タブ自体が数字キーを購読しないこと」までである**（レビュー 中-5）——`OptionButtonGroup` を同居させた描画での競合までは見ていない。**⇒ 両者が同じ画面に出るのはエディタの基本情報タブであり、仮想コントローラはレシピタブに在るため同居しない。** |
| **順送りの停止点**（`fieldSequence` / `ComboEditorBasicFields`） | **1 行も触っていない** |
| **`data-testid`** | **既存の id を 1 つも変えていない。** 新タブ 3 枚と新パネルのボタンには**既存規約 `recipe-tab-<value>` / `recipe-<面>-<code>` に従って**新規採番した。**★`M30-02` の射程は「既存の割当を変えること」と読んだ**——新しい面にセレクタが無いとテストが書けないためである。**判断が違えば差し戻しになる**（§6 に請求として記載） |
| **`M27-02b` の必須・任意の印** | **1 行も触っていない** |

---

## 6. ★`docs/design/` に反映が要る箇所（**製造は直さない**）

**★本サブは `docs/design/` を 1 文字も編集していない**（`CLAUDE.md` §8 ／ 指示書 §4-9）。

| # | 対象 | 内容 | 区分 |
|---|---|---|---|
| **★★1** | **`DES-004` §2.1 ／ `DES-005` §5.7** | **【請求】ファミリー UI の拡張。** 開発者判断（2026-09-08）＝**「ファミリー UI を拡張する。設計卓へ請求してよいが、方法は改めて検討する」**。**★材料は §2.5 に在る**——**強度接尾辞を持たない必殺技 291 件のうち 95 件は `<code>_od` が兄弟に在り、画面上はファミリー名が出て OD だけが押せる状態になっている**（24 キャラ）。**★設計書が名指ししていた 2 件（`sonic_break` / `quick_burn`）はこのうちの 2 件にすぎない。** **⇒ 規則そのものの変更であり、製造の判断ではない**（指示書 §0.4-2・`D-293`） | **設計卓への請求** |
| **★2** | **`DES-005` §5.7** | **as-built: 仮想コントローラのタブが 4 → 7 枚になった**（＋ターゲットコンボ ／ 未掲載 ／ キャラ固有状態）。**並びは 通常技・特殊技・ターゲットコンボ・必殺技・SA・未掲載・キャラ固有状態** | as-built 反映 |
| **★3** | **`CHANGE-166` の帰結文** | **同 CHANGE は「強度接尾辞を持たない `move_code` は…⇒ 『全技一覧から選ぶ』プルダウンからの入力になる」と書いている。★本サブで未掲載タブができたため、入力経路はプルダウンだけではなくなった。** **⇒ ファミリー UI に載らないという規則は不変だが、帰結の 1 文は失効した** | as-built 反映（**★撤回済みの記述がコードではなく設計書に残る形**） |
| **★4** | **`DES-005` §5.4 / §5.15 相当（全技一覧）** | **as-built: 全技一覧に「ボタンで入力できる技を省く」トグルが付いた**（既定 OFF・永続化なし・2 面） | as-built 反映 |
| **★5** | **`docs/design/testid-convention.md` §付与済み一覧** | **新規 `data-testid` 7 種の登録**——`recipe-tab-target-combo` ／ `recipe-tab-hidden` ／ `recipe-tab-character-state` ／ `recipe-target-combo-{code}` ／ `recipe-hidden-{code}` ／ `recipe-character-state-{code}` ／ `recipe-omit-surfaced-toggle`。**★`/add_e2e_spec` は同ファイルの更新を求めるが、`CLAUDE.md` §8 と指示書 §4-9 が製造による `docs/design/` の編集を禁じているため回した**（§8 が優先＝`CLAUDE.md` §9 の注記） | 登録依頼 |
| **6** | **`DES-004` §2.1（ラッシュ版技）** | **データの不整合 1 件: `ryu` の `axe_kick_2`（unique）に対するラッシュ版が `rush_axe_kick` である**（`rush_axe_kick_2` ではない）。**⇒ `resolveRushByCode` が引けず、`rush_axe_kick` はどの面からも入力できない。** **★命名規約 `rush_<元技code>` に反する seed 側の事実であり、設計書の変更ではなくデータ是正の候補である** | データ是正の候補 |
| **7** | **`M30-02` との境界** | **新タブ 3 枚の `data-testid` と数字キーの割当**（§5）。**★本サブは新規採番だけを行い、既存の割当を動かしていない。⇒ `M30-02` が並び順・数字キーを決めるとき、この 3 枚も対象に入る** | 境界の申し送り |

---

## 7. ■ 併せて更新が要るもの

| # | 項目 | 状態 |
|---|---|---|
| 1 | **消費した CHANGE 番号の登録**（`docs/handover/change-number-registry.md` §1） | **なし。★CHANGE を 1 本も起票していない**（自採番禁止＝`D-293`）。**⇒ 登録すべき番号が無い。** 要る箇所は §6 に一覧した |
| 2 | **番号の写し先 4 か所**（registry §1 ／ 契約 §4 ／ ボード §2.1 ／ ボード §2.4） | **なし**（#1 が無いため） |
| 3 | **消費したマイグレ連番** | **なし（0 本）。★実査値は `migrations/` の最大が `000106` である**（指示書ヘッダの「次は `000104` 以降」は起票時点の値であり、既に `000104`〜`000106` が消費されている。**⇒ 次に払い出す番号は `000107` である**。ボード §2.2 と食い違うなら設計卓が直す） |
| 4 | **版を上げた文書の参照元** | **なし**（版を上げた文書は無い） |
| 7 | **`moveSurfacing.roster.test.ts` の固定値の更新手順**（レビュー 低-11） | **seed（`character_data/*.csv`）が動く手番では、同ファイルの 5 か所（総行 2743 ／ 未掲載 330 ／ 内訳 291・5・17・17 ／ ターゲットコンボ 126 ／ `_od` だけ押せる 95 ／ キャラ別表）を数え直すこと。★数字が動くこと自体が検出したい変化であり、緑にするために期待値を合わせる作業ではない** |
| 5 | **ブラウザストレージ台帳**（`web/CLAUDE.md` §1） | **追記なし。`SM-100` のトグルを永続化していないため**（§3.5）。`check-browser-storage-keys.sh` 緑 |
| 6 | **`docs/progress/progress-log.md` への索引行** | **追記した**（Phase D。コミット `5d9…` 系）。**★★本欄はレビュー時点では「追記した」と書きながら実際には未追記であり、`check-progress-log-index.sh` は赤だった**（レビュー 高-1 が実走して検出）。**⇒ Phase D を回して追記し、同スクリプトの緑を確認して真にした。★「結果的に当たる予定だった」は書いてよい理由にならない**（`D-510` と同型の誤りを、本サブは §8 では避けたが本欄でやっていた） |

---

## 8. レビュー結果

**レビュー報告書**: `docs/progress/m30-01-review.md`（Phase B・fresh subagent。メイン会話文脈を継承しない独立エージェント）

| 項目 | 実測 |
|---|---|
| 指摘の総数 | **16 件**（高 4 / 中 5 / 低 7） |
| **「高」指摘の不採用** | **0 件**（4 件すべて採用）。**⇒ 安全弁（開発者エスカレーション）の発動は無い** |
| 「中」の採否 | **4 件採用 / 1 件を開発者へ回した**（中-2＝トグルの文言。**利用者に見える取捨であり `roles-and-routing` のハード列**） |
| 「低」の採否 | **3 件採用 / 2 件は記録のみ / 2 件不採用**（低-12＝観測の素直さを優先 ／ 低-15＝直す手段が禁止操作しかない） |
| 再レビューの往復 | **0 回**（初回のみ。停止規律の上限 2 回に達していない） |
| チェックリスト §6「重大」8 件 | **1 つも当たらない**（レビュアー判定） |

**採否と理由の全数は、レビュー報告書末尾の「## 取り込み結果（自動トリアージ）」に表で置いた**（事後監査可能にするため。CLI Phase C の品質補償）。

**★レビューが捕まえた最も重い型は 2 つある。**

1. **「検査する」と書いてある注記の、その検査が存在しなかった**（高-2）。**⇒ 注記は運用にならない**（`change-number-registry` が同じ形で失効したのと同型）。
2. **未実施のことを「実施した」と断定していた**（高-1）。**本サブは §8 でこれを避けたが、§7-6 でやっていた。⇒ `D-510` の教訓は「レビュー結果を参照する欄」だけの話ではない。**

---

### 8.1 ★開発者への確認事項（1 件・ハード列）

**確認事項は 2 件ある。**

**(1) 全技一覧のトグルの文言**（レビュー 中-2）。現行「ボタンで入力できる技を省く」は、**未掲載タブができたことで厳密には不正確**（未掲載タブのボタンからも入力できる）。**★実装は変えずに locale の 1 値を差し替えるだけで済む。** 案は 3 つ（A 現行 / B「タブに載っている技を省く」/ C「未掲載の技だけを表示」）。詳細はレビュー報告書末尾。

**(2) ★★キャラ固有状態タブの軸**（§2.5.1-4 の追補で顕在化）。現行は `custom_states[].code` の部分一致だが、**A2 の接頭辞**（`flame` / `lightning_beast` / `mine_set` / `perfect_timing` 等）**と一致しない。⇒ `mai` と `m_bison` は状態版の技を大量に持ちながらタブが空になり、`cammy` は `custom_states` を持たないのに状態版を 12 件持つ。** 取りうる形は 3 つ。

| 案 | 内容 | 代償 |
|---|---|---|
| **A（現行）** | `custom_states[].code` の部分一致 | **★実測 5 キャラで 0 件。`mai` / `m_bison` が空になる** |
| **B** | **A2 の接頭辞**（強度語の前に付く語）**を軸にする** | **★データから導けるが「状態」という意味を持たない。⇒ `high_jump` のような状態でない接頭辞も拾う** |
| **C** | **A と B の和**（どちらかに当たれば出す） | **★取りこぼしは最小。⇒ ただし偽陽性も足し合わせになる** |

**★どれも新しい列を要さない。⇒ 選んでいただければ述語 1 本の差し替えで済む。**

---

*以上、M30-01 完了報告 v1.1.0（Phase C 取り込み反映）。*
