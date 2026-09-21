# M19-04b 人手判断が必要な行の一覧（第三波 6 キャラ）

| 項目 | 内容 |
|---|---|
| 生成元 | 指示書 `docs/instructions/M19-04b-chain-cancel-and-derivations.md` §4.3 |
| 生成時点 | マイグレ 000001〜000061 適用済みの clean DB（moves 総数 1653） |
| 対象キャラ | `m_bison` / `rashid` / `jamie` / `luke` / `marisa` / `jp` の **6 体のみ** |
| 補助列の出典 | `command` / `original_move_code` / `condition_ja` は DB に列が無いため `character_data/*.csv` から結合（`condition_ja` は 000018 で `raw_data` から除去済み、`original_move_code` は `original_move_id` へ解決されて投入される）。`name_ja` は `preset_aliases`（`official_ja_move`） から |
| 並び順 | `character_code` 昇順 → `move_code` 昇順（差分が取れる安定ソート） |
| 書式 | `docs/progress/20260802-M19-04-manual-input-list-developer-decision.md` に揃えた（同じ手順で記入できるようにするため） |

> **既に記入済みの 11 キャラ（terry / guile / lily / ingrid / kimberly / juri / ken / mai / zangief / ryu / manon）は本一覧に出していない。** 二重記入を避けるためである。11 キャラ分は上記の記入用コピーが正である。
> **推測で埋めないこと。** 判断がつかない行は `保留` と明記する（空欄と区別する）。

## 件数サマリ

| # | 系統 | 抽出条件 | 件数 |
|---|---|---|---:|
| 1 | `startup_basis` | `is_derived=1` かつ `category<>'rush_variant'` かつ `startup_basis='unknown'` | **149** |
| 2 | `fastest_unreachable` の **B 型** | `is_aerial=1` かつ `code` が `jumping_` を含まない | **9** |

| 系統 | キャラクター別件数 | 完了チェック |
|---|---|---|
| `startup_basis` | jamie 59 / jp 8 / luke 17 / m_bison 19 / marisa 23 / rashid 23 | [ ] 149 行すべてに値または `保留` を記入 |
| `fastest_unreachable` | marisa 2 / rashid 7 | [ ] 9 行すべてに値または `保留` を記入 |

## 0. 記入の前に

### 0.1 記入者情報

| 項目 | 開発者記入欄 |
|---|---|
| 記入者 | 開発者 |
| 記入日 | 20260807 |
| ゲームバージョン | 2026.08.03 |
| 備考 | アップデートによるフレーム変更が混ざっている可能性あり。なおジェイミーの流酔拳は再計測が面倒だったのでこの資料では調べ直してない |

### 0.2 ★`chain_cancel_total` の系統は本一覧に含めていない

第三波 6 キャラ分の `chain_cancel_total` は **マイグレ 000060 で 16 行すべて投入済み**である。**残る候補は「確定ロースター外＝圏外」として決着している**（ボード D-137 / D-143）。

**したがって `IS NULL` による機械抽出をしてはならない。** `NULL` には **「圏外だから NULL」** と **「未実測だから NULL」** の 2 種類があり、**機械条件では区別できない**。区別できるのは `character_data/chain-cancel-measurements.md` の**確定ロースターだけ**である。機械抽出すると圏外の行まで「未実測」として並び、埋めるべきでない行を埋めることになる。

### 0.3 ★`unknown` と `保留` の書き分け（本一覧の要点）

| 記入値 | 意味 | 後日の扱い |
|---|---|---|
| `保留` | **まだ判断していない** | **後日の消化対象**（再度この行を見る） |
| `unknown` | **判断した結果、単独値とも通し値とも言えないと確定した** | **消化対象から外してよい**（もう見なくてよい） |

**実装上はどちらも UPDATE 対象外**（`startup_basis` の既定値が `unknown` であるため、結果の DB 状態も同じ）**だが、後日の再判断の対象になるのは `保留` だけである**（ボード D-138）。**「わからない」で止めるときは、どちらの意味かを必ず書き分けること。**

### 0.4 行ごとの記入規則

| 系統 | 記入できる値 |
|---|---|
| `startup_basis` | `standalone` / `through` / `unknown` / `保留` |
| `fastest_unreachable` | `true` / `false` / `非攻撃技` / `保留` |

- 根拠を残す場合は、値の後ろへ `through（対象技からの派生値）` のように括弧書きする。
- **判断済みの行は空欄にしない。** 値が確定しない場合も `保留` または `unknown` と書き、未着手の空欄と区別する。
- 一括判断をした場合も**各行へ値を記入する**。グループ単位のメモだけで行の判断を省略しない。

### 0.5 ★第三波 6 キャラは機械 backfill（000050）を受けていない

**`000050`（機械 backfill）は `000055`（第三波 seed）より前に適用される。** `000053`〜`000059` のいずれも `startup_basis` / `fastest_unreachable` に触れていない。したがって第三波 6 キャラは:

- `startup_basis` が **全 625 行とも `unknown`**（`is_derived=0` の行＝本来 `standalone` になるはずの行も、`rush_variant` の行＝本来 `through` になるはずの行も含む）
- `fastest_unreachable` が **全行 `0`**（通常ジャンプ攻撃＝C 型の機械付与も未実施）

**本一覧への影響は無い。** 系統 1 の抽出条件の 3 つ目（`startup_basis='unknown'`）は第三波では全行が該当するため実質的に効いていないが、機械 backfill が走っていても `is_derived=1` かつ非 `rush_variant` の行は `unknown` のまま残る設計なので、**出力される行集合は同一**である。系統 2 は両列を参照しないため無関係。

**ただしこれは別途の是正が要る事項である**（本サブのスコープ外＝マイグレ 2 本の成果物に 3 本目を足さない）。詳細は完了報告 ＋ 設計伝達レポートを参照。

---

## 1. `startup_basis`（149 行）

**判断すること**: その行の `startup` が「単独で出したときの値」か「連携の中で出したときの通し値」か。
記入値は `standalone` / `through` / `unknown` / `保留` のいずれか（**`unknown` と `保留` の違いは §0.3 を参照**）。

> **★この列が答えるのは「値の由来」だけである。** 「空振りで出せるか」「単独で出せるか」「相手が空中にいるときだけ出せるか」といった**成立条件の話は、この列では表現しない**（`M19-DESIGN-07` §7 の列追加審査規約＝**事実列に第 2・第 3 の用途を載せない**）。**成立条件が特殊な技であっても、その行の `startup` が単独値なら `standalone` が正しい。**
>
> **よく出る 5 パターンと記入の目安**:
>
> | パターン | 例 | 記入 | 補足 |
> |---|---|---|---|
> | **空振りでは出ない target_combo**（ヒット／ガード時限定の派生） | jamie `bitter_strikes` | `standalone` | 格納値が単独値なら `standalone`。**空振りで出せないことは別の軸**で、この列には載せない |
> | **相手が空中にいるときだけ出せる target_combo** | ingrid `satelite_leap`（11 キャラ期の例） | `standalone`（フレーム未入力なら `保留`） | **判断材料が無い行は `保留` でよい。ただし「フレーム未入力のため」と括弧書きで理由を残す** |
> | **派生元が複数ある技** | guile `sonic_cross_*`（11 キャラ期の例） | 由来どおり | **親が複数あること自体は `move_derivations` が受け止める**（`M19-DESIGN-07` §3 の R5）。**★ただし親ごとに値が変わる場合は `unknown`**（ボード D-138 の定義＝判断した結果、単独値とも通し値とも言えないと確定した） |
> | **★`startup` が空欄の行** | 移動 move 系 | **空欄のままにする**（記入しない） | **`startup_basis` は「格納されている `startup` の由来」を表す列であり、値が無い行に由来は無い**（ボード D-187）。**判断しようとしないこと。** Phase 2 で機械的に `unknown` へ戻す対象であり、人手判断の対象ではない |
> | **★ラッシュ版**（`category = 'rush_variant'`） | 各キャラの `*_rush` 系 | **空欄のままにする**（機械付与が `through` を与える） | **`through` と `standalone` が重なったら `through` が勝つ**（ボード D-188）。本表の抽出条件は `category <> 'rush_variant'` で除外しているので出てこないはずである。**出てきたら抽出条件の誤りなので設計卓へ報告してほしい** |
>
> **注釈がなくて本表に出てきた行**は、**判断できないのではなく、判断の前提が本表に無いだけ**である。**気づいたら括弧書きで理由を残すこと。**
>
> **★迷ったら `保留` でよい。** 推測で `standalone` と書くほうが高くつく——**`standalone` は「単独値である」という積極的な主張**であり、誤ると M19-05 の費用計算（`S = Σ(filler.total) + target.startup`）が静かに狂う。**`保留` は UPDATE されないので何も壊さない。**

| character_code | move_code | name_ja | category | is_derived | is_aerial | command | startup | total | original_move_code | condition_ja | 記入: startup_basis（`standalone` / `through` / `unknown` / `保留`） |
|---|---|---|---|---|---|---|---|---|---|---|---|
| jamie | `bitter_strikes` | 鋭鍾打 | target_combo | 1 | 0 | `p_l chain k_l chain p_m` | 8 | 31 |   |   | standalone, target_comboだが空振りでは出ない技 |
| jamie | `bitter_strikes_2hits` | 鋭鍾打(2発止め) | target_combo | 1 | 0 | `p_l chain k_l` | 6 | 23 |   |   | standalone, target_comboだが空振りでは出ない技 |
| jamie | `drink_level_1_standing_light_punch` | [酔いレベル1]立ち弱P | normal | 1 | 0 | `p_l` | 5 | 13 |   |   | standalone, 特定のcustom_state（酔いレベル1）の時だけ出る通常技というエッジケース |
| jamie | `drink_level_3_hermits_elbow` | [酔いレベル3]仙姑肘 | unique | 1 | 0 | `l plus p_h` | 18 | 42 |   |   | standalone |
| jamie | `drink_level_3_intoxicated_assault` | [酔いレベル3]酩酊襲 | target_combo | 1 | 0 | `l plus p_h chain p_h chain k_h` | 21 | 60 |   |   | standalone, target_comboだが空振りでは出ない技 |
| jamie | `drink_level_4_freeflow_strikes_1hit_heavy` | [酔いレベル4]強流酔拳(単発) | special | 1 | 0 | `d dr r plus p_h` | 19 | 51 |   |   | standalone |
| jamie | `drink_level_4_freeflow_strikes_1hit_light` | [酔いレベル4]弱流酔拳(単発) | special | 1 | 0 | `d dr r plus p_l` | 13 | 45 |   |   | standalone |
| jamie | `drink_level_4_freeflow_strikes_1hit_medium` | [酔いレベル4]中流酔拳(単発) | special | 1 | 0 | `d dr r plus p_m` | 16 | 48 |   |   | standalone |
| jamie | `drink_level_4_freeflow_strikes_1hit_od` | [酔いレベル4]OD流酔拳(単発) | special | 1 | 0 | `d dr r plus p p` | 13 | 45 |   |   | standalone |
| jamie | `drink_level_4_freeflow_strikes_2hits_heavy` | [酔いレベル4]強流酔拳(2発止め) | special | 1 | 0 | `d dr r plus p_h chain r plus p` | 54 | 89 |   |   | through, 空振りでも派生版を出せる必殺技。同じ強度、酔いレベルの流酔拳からのみ派生。 |
| jamie | `drink_level_4_freeflow_strikes_2hits_light` | 弱[酔いレベル4]流酔拳(2発止め) | special | 1 | 0 | `d dr r plus p_l chain r plus p` | 48 | 83 |   |   | through, 空振りでも派生版を出せる必殺技。同じ強度、酔いレベルの流酔拳からのみ派生。 |
| jamie | `drink_level_4_freeflow_strikes_2hits_medium` | [酔いレベル4]中流酔拳(2発止め) | special | 1 | 0 | `d dr r plus p_m chain r plus p` | 51 | 86 |   |   | through, 空振りでも派生版を出せる必殺技。同じ強度、酔いレベルの流酔拳からのみ派生。 |
| jamie | `drink_level_4_freeflow_strikes_2hits_od` | [酔いレベル4]OD流酔拳(2発止め) | special | 1 | 0 | `d dr r plus p p chain r plus p` | 48 | 83 |   |   | through, 空振りでも派生版を出せる必殺技。同じ強度、酔いレベルの流酔拳からのみ派生。 |
| jamie | `drink_level_4_freeflow_strikes_heavy` | [酔いレベル4]強流酔拳 | special | 1 | 0 | `d dr r plus p_h chain r plus p chain r plus p` | 84 | 136 |   |   | through, 空振りでも派生版を出せる必殺技。同じ強度、酔いレベルの流酔拳からのみ派生。 |
| jamie | `drink_level_4_freeflow_strikes_light` | [酔いレベル4]弱流酔拳 | special | 1 | 0 | `d dr r plus p_l chain r plus p chain r plus p` | 78 | 130 |   |   | through, 空振りでも派生版を出せる必殺技。同じ強度、酔いレベルの流酔拳からのみ派生。 |
| jamie | `drink_level_4_freeflow_strikes_medium` | [酔いレベル4]中流酔拳 | special | 1 | 0 | `d dr r plus p_m chain r plus p chain r plus p` | 81 | 133 |   |   | through, 空振りでも派生版を出せる必殺技。同じ強度、酔いレベルの流酔拳からのみ派生。 |
| jamie | `drink_level_4_freeflow_strikes_od` | [酔いレベル4]OD流酔拳 | special | 1 | 0 | `d dr r plus p p chain r plus p chain r plus p` | 78 | 130 |   |   | through, 空振りでも派生版を出せる必殺技。同じ強度、酔いレベルの流酔拳からのみ派生。 |
| jamie | `drink_level_4_ransui_haze_2_retreat` | [酔いレベル4]乱酔旋(2段目/後退) | target_combo | 1 | 0 | `r plus k_h chain l plus k_h` | 16 | 93 |   |   | through, 攻撃技ではなく単発版を当ててから下がる技。空振りでも出せる。senei kickから。 |
| jamie | `drink_level_4_ransui_haze_3_delay` | [酔いレベル4]乱酔旋(3段目/ディレイ) | target_combo | 1 | 0 | `r plus k_h chain l plus k_h chain p` | 4 | 55 |   |   | through, 空振りでも出せる技だが、誤ってstandaloneになっている。いまstandaloneになっているので再計測結果を記載する。## 3. `その他開発者伝達`のJamieの乱酔旋のフレーム訂正に記載。乱酔旋(2段目/後退)からボタンを押すタイミングにより派生するエッジケース |
| jamie | `drink_level_4_ransui_haze_3_drink_while_retreating` | [酔いレベル4]乱酔旋（3段目/後退飲酒） | target_combo | 1 | 0 | `r plus k_h chain l plus k_h chain p` | 16 | 132 |   |   | through, 空振りでも出せる。乱酔旋(2段目/後退)からボタンを押すタイミングにより派生するエッジケース |
| jamie | `drink_level_4_ransui_haze_3_immediate` | [酔いレベル4]乱酔旋(3段目/即時) | target_combo | 1 | 0 | `r plus k_h chain l plus k_h chain p` | 14 | 46 |   |   | through, 空振りでも出せる技だが、誤ってstandaloneになっている。いまstandaloneになっているので再計測結果を記載する。## 3. `その他開発者伝達`のJamieの乱酔旋のフレーム訂正に記載。乱酔旋(2段目/後退)からボタンを押すタイミングにより派生するエッジケース |
| jamie | `drink_level_4_senei_kick` | [酔いレベル4]旋影脚 | unique | 1 | 0 | `r plus k_h` | 16 | 38 |   |   |  |
| jamie | `forward_throw_drink` | 前投げ(飲酒) | throw | 1 | 0 | `n or r plus p_l k_l chain d plus p_l` | 5 | 30 |   |   | standalone |
| jamie | `forward_throw_reach_drink_lv4` | 前投げ(飲酒 / 酔いLv4到達) | throw | 1 | 0 | `n or r plus p_l k_l chain d plus p_l` | 5 | 30 |   |   | standalone |
| jamie | `freeflow_kicks_2hit_heavy` | 強流酔脚(2発止め) | special | 1 | 0 | `d dr r plus p_h chain r plus k` | 20 | 53 |   |   | standalone, ターゲットコンボみたいな必殺技だがヒットじゃないと出ない |
| jamie | `freeflow_kicks_2hit_light` | 弱流酔脚(2発止め) | special | 1 | 0 | `d dr r plus p_l chain r plus k` | 14 | 47 |   |   | standalone, ターゲットコンボみたいな必殺技だがヒットじゃないと出ない |
| jamie | `freeflow_kicks_2hit_medium` | 中流酔脚(2発止め) | special | 1 | 0 | `d dr r plus p_m chain r plus k` | 17 | 50 |   |   | standalone, ターゲットコンボみたいな必殺技だがヒットじゃないと出ない |
| jamie | `freeflow_kicks_2hit_od` | OD流酔脚(2発止め) | special | 1 | 0 | `d dr r plus p p chain r plus k` | 14 | 47 |   |   | standalone, ターゲットコンボみたいな必殺技だがヒットじゃないと出ない |
| jamie | `freeflow_kicks_heavy` | 強流酔脚 | special | 1 | 0 | `d dr r plus p_h chain r plus k chain r plus k` | 24 | 89 |   |   | standalone, ターゲットコンボみたいな必殺技だがヒットじゃないと出ない |
| jamie | `freeflow_kicks_light` | 弱流酔脚 | special | 1 | 0 | `d dr r plus p_l chain r plus k chain r plus k` | 18 | 83 |   |   | standalone, ターゲットコンボみたいな必殺技だがヒットじゃないと出ない |
| jamie | `freeflow_kicks_medium` | 中流酔脚 | special | 1 | 0 | `d dr r plus p_m chain r plus k chain r plus k` | 21 | 86 |   |   | standalone, ターゲットコンボみたいな必殺技だがヒットじゃないと出ない |
| jamie | `freeflow_kicks_od` | OD流酔脚 | special | 1 | 0 | `d dr r plus p p chain r plus k chain r plus k` | 18 | 83 |   |   | standalone, ターゲットコンボみたいな必殺技だがヒットじゃないと出ない |
| jamie | `freeflow_strikes_1hit_heavy` | 強流酔拳 | special | 1 | 0 | `d dr r plus p_h chain r plus p chain r plus p` | 71 | 102 |   |   | through, 空振りでも派生版を出せる必殺技。同じ強度、酔いレベルの流酔拳からのみ派生。 |
| jamie | `freeflow_strikes_1hit_light` | 弱流酔拳 | special | 1 | 0 | `d dr r plus p_l chain r plus p chain r plus p` | 53 | 84 |   |   | through, 空振りでも派生版を出せる必殺技。同じ強度、酔いレベルの流酔拳からのみ派生。 |
| jamie | `freeflow_strikes_1hit_medium` | 中流酔拳 | special | 1 | 0 | `d dr r plus p_m chain r plus p chain r plus p` | 62 | 93 |   |   | through, 空振りでも派生版を出せる必殺技。同じ強度、酔いレベルの流酔拳からのみ派生。 |
| jamie | `freeflow_strikes_1hit_od` | OD流酔拳 | special | 1 | 0 | `d dr r plus p p chain r plus p chain r plus p` | 54 | 85 |   |   | through, 空振りでも派生版を出せる必殺技。同じ強度、酔いレベルの流酔拳からのみ派生。 |
| jamie | `freeflow_strikes_2hits_heavy` | 強流酔拳(2発止め) | special | 1 | 0 | `d dr r plus p_h chain r plus p` | 45 | 74 |   |   | through, 空振りでも派生版を出せる必殺技。同じ強度、酔いレベルの流酔拳からのみ派生。 |
| jamie | `freeflow_strikes_2hits_light` | 弱流酔拳(2発止め) | special | 1 | 0 | `d dr r plus p_l chain r plus p` | 33 | 62 |   |   | through, 空振りでも派生版を出せる必殺技。同じ強度、酔いレベルの流酔拳からのみ派生。 |
| jamie | `freeflow_strikes_2hits_medium` | 中流酔拳(2発止め) | special | 1 | 0 | `d dr r plus p_m chain r plus p` | 39 | 68 |   |   | through, 空振りでも派生版を出せる必殺技。同じ強度、酔いレベルの流酔拳からのみ派生。 |
| jamie | `freeflow_strikes_2hits_od` | OD流酔拳(2発止め) | special | 1 | 0 | `d dr r plus p p chain r plus p` | 35 | 64 |   |   | through, 空振りでも派生版を出せる必殺技。同じ強度、酔いレベルの流酔拳からのみ派生。 |
| jamie | `freeflow_strikes_heavy` | 強流酔拳(単発) | special | 1 | 0 | `d dr r plus p_h` | 19 | 44 |   |   | standalone |
| jamie | `freeflow_strikes_light` | 弱流酔拳(単発) | special | 1 | 0 | `d dr r plus p_l` | 13 | 38 |   |   | standalone |
| jamie | `freeflow_strikes_medium` | 中流酔拳(単発) | special | 1 | 0 | `d dr r plus p_m` | 16 | 41 |   |   | standalone |
| jamie | `freeflow_strikes_od` | OD流酔拳(単発) | special | 1 | 0 | `d dr r plus p p` | 13 | 38 |   |   | standalone |
| jamie | `full_moon_kick` | 円月脚(飲酒) | target_combo | 1 | 0 | `r plus k_m chain k_m chain p` | 15 | 84 |   |   | standalone, target_comboだが空振りでは出ない技 |
| jamie | `full_moon_kick_2hits` | 円月脚 | target_combo | 1 | 0 | `r plus k_m chain k_m` | 15 | 52 |   |   | standalone, target_comboだが空振りでは出ない技 |
| jamie | `full_moon_kick_drink_and_reach_drink_lv4` | 円月脚(飲酒 / 酔いLv4到達) | target_combo | 1 | 0 | `r plus k_m chain k_m chain p` | 15 | 76 |   |   | standalone, target_comboだが空振りでは出ない技。なおフレームに誤りがあり、recovery 58, total 81が正しかったので修正必要 |
| jamie | `intoxicated_assault_1hit` | [酔いレベル3]酩酊襲(2発止め) | target_combo | 1 | 0 | `l plus p_h chain p_h` | 21 | 44 |   |   | standalone, target_comboだが空振りでは出ない技 |
| jamie | `phantom_sway` | 幻酔舞(飲酒) | target_combo | 1 | 0 | `d plus k_h chain k_h chain p` | 12 | 75 |   |   | standalone, target_comboだが空振りでは出ない技 |
| jamie | `phantom_sway_2hits` | 幻酔舞 | target_combo | 1 | 0 | `d plus k_h chain k_h` | 12 | 57 |   |   | standalone, target_comboだが空振りでは出ない技 |
| jamie | `phantom_sway_drink_and_reach_drink_lv4` | 幻酔舞(飲酒 / 酔いLv4到達) | target_combo | 1 | 0 | `d plus k_h chain k_h chain p` | 12 | 70 |   |   | standalone, target_comboだが空振りでは出ない技。なおフレームに誤りがあり、recovery 61, total 75が正しかったので修正必要 |
| jamie | `swagger_hermit_punch` | 疾歩仙掌 | special | 1 | 0 | `d dl l plus p chain r plus p` | 19 | 60 |   |   |  standalone, ターゲットコンボみたいな必殺技だがヒットじゃないと出ない |
| jamie | `swagger_hermit_punch_od` | OD疾歩仙掌 | special | 1 | 0 | `d dl l plus p p chain r plus p` | 19 | 60 |   |   |  standalone, ターゲットコンボみたいな必殺技だがヒットじゃないと出ない |
| jamie | `the_devil_inside_reach_drink_lv4` | 魔身(酔い+1 / 酔いLv4到達) | special | 1 | 0 | `d d plus p` | 1 | 49 |   |   | standalone, 攻撃技ではないがセットプレイの最後で使う事はある（重ねないが強化に価値がある） |
| jamie | `the_devil_inside_up2` | 魔身（酔い+2） | special | 1 | 0 | `d d plus p` | 1 | 97 |   |   | standalone, 攻撃技ではないがセットプレイの最後で使う事はある（重ねないが強化に価値がある） |
| jamie | `the_devil_inside_up2_reach_drink_lv4` | 魔身(酔い+2 / 酔いLv4到達) | special | 1 | 0 | `d d plus p` | 1 | 95 |   |   | standalone, 攻撃技ではないがセットプレイの最後で使う事はある（重ねないが強化に価値がある） |
| jamie | `the_devil_inside_up3` | 魔身（酔い+3） | special | 1 | 0 | `d d plus p` | 1 | 146 |   |   | standalone, 攻撃技ではないがセットプレイの最後で使う事はある（重ねないが強化に価値がある） |
| jamie | `the_devil_inside_up3_reach_drink_lv4` | 魔身(酔い+3 / 酔いLv4到達) | special | 1 | 0 | `d d plus p` | 1 | 144 |   |   | standalone, 攻撃技ではないがセットプレイの最後で使う事はある（重ねないが強化に価値がある） |
| jamie | `the_devil_inside_up4` | 魔身（酔い+4） | special | 1 | 0 | `d d plus p` | 1 | 193 |   |   | standalone, 攻撃技ではないがセットプレイの最後で使う事はある（重ねないが強化に価値がある） |
| jp | `departure_shadow` | ヴィーハト・チェーニ | special | 1 | 0 | `d dl l plus p_h` | 20 | 40 |   |   | standalone |
| jp | `departure_shadow_od` | ODヴィーハト・チェーニ | special | 1 | 0 |   | 20 | 40 |   |   | standalone |
| jp | `departure_window` | ヴィーハト・アクノ | special | 1 | 0 | `d dl l plus p_l or p_m` | 6 | 44 |   |   | standalone |
| jp | `departure_window_double_warp_od` | ODヴィーハト・アクノ(二連続ワープ) | special | 1 | 0 |   | 48 | 86 |   |   | standalone, throghに近いが1つの技扱いで記載。特殊事情。なおstartup 49でtotalが87になるのが正しかったので修正が必要。 |
| jp | `grom_strelka` | グロームストレルカ | target_combo | 1 | 0 | `l plus p_m chain p_m` | 10 | 32 |   |   | standalone, target_comboだが空振りでは出ない技 |
| jp | `zilant` | ジラント | target_combo | 1 | 0 | `k_h chain p_h` | 20 | 42 |   |   | standalone, target_comboだが空振りでは出ない技 |
| jp | `zilant_low` | ジラントナガー | target_combo | 1 | 0 | `k_h chain p_h chain k_h` | 21 | 45 |   |   | standalone, target_comboだが空振りでは出ない技 |
| jp | `zilant_mid` | ジラントルカー | target_combo | 1 | 0 | `k_h chain p_h chain p_h` | 21 | 45 |   |   | standalone, target_comboだが空振りでは出ない技 |
| luke | `ddt` | DDT | special | 1 | 0 | `p p` | 1 | 161 |   |   | standalone, エッジケース的な技なので発生1Fでトータルが長い |
| luke | `double_impact` | ダブルインパクト | target_combo | 1 | 0 | `r plus p_h chain p_h` | 11 | 46 |   |   | standalone, target_comboだが空振りでは出ない技 |
| luke | `fatal_shot` | フェイタルショット | special | 1 | 0 | `p p` | 8 | 50 |   |   | through, 現時点ではstandaloneが入っているが空振りでも出る技だったので、直したい。直した版のフレームはstartup 33, active 16 recovery 27 total 75。ODサンドブラスト空のみ派生 |
| luke | `flash_knuckle_perfect_heavy` | 【ジャスト】強フラッシュナックル | special | 1 | 0 | `d dl l plus p_h hold` | 33 | 60 |   |   | standalone |
| luke | `flash_knuckle_perfect_light` | 【ジャスト】弱フラッシュナックル | special | 1 | 0 | `d dl l plus p_l hold` | 26 | 51 |   |   | standalone |
| luke | `flash_knuckle_perfect_medium` | 【ジャスト】中フラッシュナックル | special | 1 | 0 | `d dl l plus p_m hold` | 29 | 58 |   |   | standalone |
| luke | `impaler` | インパラー | special | 1 | 0 | `k` | 25 | 59 |   |   | through, avengerからだけ派生 |
| luke | `impaler_od` | ODインパラー | special | 1 | 0 | `k` | 25 | 51 |   |   | through, ただし誤りがあり、startup 24, total 50が正しい, OD avengerからだけ派生 |
| luke | `no_chaser` | ノーチェイサー | special | 1 | 0 | `p` | 24 | 49 |   |   | through , avengerからだけ派生|
| luke | `no_chaser_od` | ODノーチェイサー | special | 1 | 0 | `p` | 24 | 49 |   |   | through, ただし誤りがあり、startup 23, total 48が正しい , OD avengerからだけ派生|
| luke | `nose_breaker` | ノーズブレイカー | target_combo | 1 | 0 | `d plus k_m chain d plus p_h` | 9 | 36 |   |   | standalone, target_comboだが空振りでは出ない技 |
| luke | `slam_dunk` | スラムダンク | special | 1 | 0 | `p p` | 16 | 48 |   |   | standalone, ターゲットコンボみたいな必殺技だがヒットじゃないと出ない |
| luke | `snapback_combo` | スナップバックコンボ | target_combo | 1 | 0 | `p_m chain p_m chain p_m chain p_m` | 11 | 39 |   |   | standalone, target_comboだが空振りでは出ない技。なおrecovery 24, total 36が正しい |
| luke | `snapback_combo_2hits` | スナップバックコンボ(2発止め) | target_combo | 1 | 0 | `p_m chain p_m` | 12 | 36 |   |   | standalone, target_comboだが空振りでは出ない技 |
| luke | `snapback_combo_3hits` | スナップバックコンボ(3発止め) | target_combo | 1 | 0 | `p_m chain p_m chain p_m` | 11 | 41 |   |   | standalone, target_comboだが空振りでは出ない技 |
| luke | `triple_impact` | トリプルインパクト | target_combo | 1 | 0 | `p_l chain p_m chain p_h` | 10 | 39 |   |   | standalone, target_comboだが空振りでは出ない技 |
| luke | `triple_impact_2hits` | トリプルインパクト(2発止め) | target_combo | 1 | 0 | `p_l chain p_m` | 8 | 31 |   |   | standalone, target_comboだが空振りでは出ない技 |
| m_bison | `devil_reverse` | デビルリバース | special | 1 | 0 | `p` | 34 | 64 |   |   | through, ノーマルシャドウライズからのみ派生。派生できるシャドウライズは弱中強あるが、どの技からでもフレームが同じなので、他の技とは性質が異なる。fastest_unreachable=true |
| m_bison | `devil_reverse_od` | ODデビルリバース | special | 1 | 0 | `p p alt_sep p` | 37 | 59 |   |   | throughが入っているが誤りなので、standaloneに変更したい。ODシャドウライズだけでなく、弱中強シャドウライズからも派生可能だったので。空中で出す技なので派生の仕方により発生、持続、Totalの全てが変わってしまうのでどう扱うか相談したい。地上の相手に当たるfastest_unreachable=trueではある |
| m_bison | `head_press` | ヘッドプレス | special | 1 | 0 | `k` | 33 | 64 |   |   | through, ノーマルシャドウライズからのみ派生。派生できるシャドウライズは弱中強あるが、どの技からでもフレームが同じなので、他の技とは性質が異なる。fastest_unreachable=true |
| m_bison | `head_press_od` | ODヘッドプレス | special | 1 | 0 | `k k alt_sep k` | 31 | 46 |   |   | throughが入っているが誤りなので、standaloneに変更したい。ODシャドウライズだけでなく、弱中強シャドウライズからも派生可能だったので。空中で出す技なので派生の仕方により発生、持続、Totalの全てが変わってしまうのでどう扱うか相談したい。地上の相手に当たるfastest_unreachable=trueではある |
| m_bison | `hell_attack` | ヘルアタック | target_combo | 1 | 0 | `p_m chain p_m` | 7 |   |   |   | unknown, これは空中target_comboなのでフレームいらない |
| m_bison | `mine_set_devil_reverse` | [サイコマイン付着中]デビルリバース | special | 1 | 0 | `p` | 34 | 64 |   |   | standalone |
| m_bison | `mine_set_heavy_backfist_combo` | [サイコマイン付着中]強バックフィストコンボ | special | 1 | 0 | `d dl l plus p_h` | 22 | 65 |   |   | standalone |
| m_bison | `mine_set_heavy_psycho_crusher_attack` | [サイコマイン付着中]強サイコクラッシャーアタック | special | 1 | 0 | `charge_l r plus p_h` | 24 | 73 |   |   | standalone |
| m_bison | `mine_set_light_backfist_combo` | [サイコマイン付着中]弱バックフィストコンボ | special | 1 | 0 | `d dl l plus p_l` | 13 | 54 |   |   | standalone |
| m_bison | `mine_set_light_psycho_crusher_attack` | [サイコマイン付着中]弱サイコクラッシャーアタック | special | 1 | 0 | `charge_l r plus p_l` | 14 | 53 |   |   | standalone |
| m_bison | `mine_set_medium_backfist_combo` | [サイコマイン付着中]中バックフィストコンボ | special | 1 | 0 | `d dl l plus p_m` | 17 | 59 |   |   | standalone |
| m_bison | `mine_set_medium_psycho_crusher_attack` | [サイコマイン付着中]中サイコクラッシャーアタック | special | 1 | 0 | `charge_l r plus p_m` | 20 | 59 |   |   | standalone |
| m_bison | `mine_set_od_backfist_combo` | [サイコマイン付着中]ODバックフィストコンボ | special | 1 | 0 | `d dl l plus p p` | 14 | 107 |   |   | standalone |
| m_bison | `mine_set_od_devil_reverse` | [サイコマイン付着中]ODデビルリバース | special | 1 | 0 | `p p alt_sep p` | 37 | 59 |   |   | standalone |
| m_bison | `mine_set_od_psycho_crusher_attack` | [サイコマイン付着中]ODサイコクラッシャーアタック | special | 1 | 0 | `charge_l r plus p p` | 16 | 51 |   |   | standalone |
| m_bison | `psycho_mine_auto_detonation` | サイコマイン（自動爆発） | special | 1 | 0 |   |   |   |   |   | standalone,特殊なエッジケースなのでフレームを書いていない |
| m_bison | `shadow_hammer` | シャドウハンマー | target_combo | 1 | 0 | `p_m chain r plus p_h` | 22 | 44 |   |   | standalone, target_comboだが空振りでは出ない技 |
| m_bison | `shadow_spear` | シャドウスピア | target_combo | 1 | 0 | `p_m chain d plus k_h` | 16 | 39 |   |   | standalone, target_comboだが空振りでは出ない技 |
| m_bison | `somersault_skull_diver` | サマーソルトスカルダイバー | special | 1 | 0 | `p` | 12 | 32 |   |   | standalone, ただしstartup 12, active 10 recovery 12, total 33が正しい。またon_hitが8でon_guardは5が正しい。備考に立ち状態の相手にヘッドプレスを当てた後のフレームと記載が必要。ターゲットコンボみたいな必殺技だが前段がヒットじゃないと出ない |
| marisa | `dimachaerus_heavy` | 強ディマカイルス | special | 1 | 0 | `d dl l plus p_h chain r plus p` | 18 | 45 |   |   | standalone, ターゲットコンボみたいな必殺技だがヒットじゃないと出ない |
| marisa | `dimachaerus_light` | 弱ディマカイルス | special | 1 | 0 | `d dl l plus p_l chain r plus p` | 13 | 40 |   |   | standalone, ターゲットコンボみたいな必殺技だがヒットじゃないと出ない |
| marisa | `dimachaerus_medium` | 中ディマカイルス | special | 1 | 0 | `d dl l plus p_m chain r plus p` | 13 | 41 |   |   | standalone, ターゲットコンボみたいな必殺技だがヒットじゃないと出ない |
| marisa | `dimachaerus_od` | ODディマカイルス | special | 1 | 0 | `d dl l plus p p chain r plus p` | 13 | 40 |   |   | standalone, ターゲットコンボみたいな必殺技だがヒットじゃないと出ない |
| marisa | `enfold` | エンフォルド | special | 1 | 0 | `p_l k_l` | 13 | 69 |   |   | through, スクトゥムから |
| marisa | `enfold_od` | ODエンフォルド | special | 1 | 0 |   | 13 | 69 |   |   | through, ODスクトゥムから |
| marisa | `falx_crusher` | ファルクスクラッシュ | target_combo | 1 | 0 | `r plus k_h chain r plus k_h` | 16 | 45 |   |   | standalone, target_comboだが空振りでは出ない技 |
| marisa | `heavy_two_hitter` | ヘビィーワンツー | target_combo | 1 | 0 | `p_h chain p_h` | 24 | 45 |   |   | standalone, target_comboだが空振りでは出ない技 |
| marisa | `light_two_hitter` | ライトワンツー | target_combo | 1 | 0 | `p_l chain p_l` | 14 | 38 |   |   | standalone, target_comboだが空振りでは出ない技 |
| marisa | `malleus_breaker` | マレウスビート | target_combo | 1 | 0 | `dr plus p_h chain dr plus p_h` | 18 | 43 |   |   | standalone, target_comboだが空振りでは出ない技 |
| marisa | `medium_two_hitter` | ミドルワンツー | target_combo | 1 | 0 | `p_m chain p_m` | 14 | 38 |   |   | standalone, target_comboだが空振りでは出ない技 |
| marisa | `novacula_swipe` | ノバキュラスワイプ | target_combo | 1 | 0 | `r plus p_m chain p_h` | 11 | 38 |   |   | standalone, target_comboだが空振りでは出ない技 |
| marisa | `novacula_thrust` | ノバキュラシュート | target_combo | 1 | 0 | `r plus p_m chain k_h` | 11 | 37 |   |   | standalone, target_comboだが空振りでは出ない技 |
| marisa | `procella` | プロケッラ | special | 1 | 0 | `k` | 24 | 63 |   |   | through, スクトゥムから |
| marisa | `procella_od` | ODプロケッラ | special | 1 | 0 |   | 24 | 63 |   |   | through, ODスクトゥムから |
| marisa | `sa1_javelin_of_marisa_counterattack` | SA1 マリーザジャベリン(当身) | super_art | 1 | 0 | `d dr r d dr r plus p` | 11 | 68 |   |   | standalone,　相手の攻撃依存のためフレーム記載できず |
| marisa | `scutum_counterattack` | スクトゥム(当身) | special | 1 | 0 |   |   |   |   |   | standalone,　相手の攻撃依存のためフレーム記載できず |
| marisa | `scutum_counterattack_od` | ODスクトゥム(当身) | special | 1 | 0 |   |   |   |   |   | standalone,　相手の攻撃依存のためフレーム記載できず |
| marisa | `tonitrus` | トニトルス | special | 1 | 0 | `p chain p` | 20 | 58 |   |   | standalone,　単発と違い前段ヒットが必要なため。なおstartup 19, total 57が正しい |
| marisa | `tonitrus_1hit` | トニトルス(単発) | special | 1 | 0 | `p` | 23 | 50 |   |   | through, スクトゥムから |
| marisa | `tonitrus_1hit_od` | ODトニトルス(単発) | special | 1 | 0 |   | 23 | 50 |   |   | through, ODスクトゥムから |
| marisa | `tonitrus_od` | ODトニトルス | special | 1 | 0 |   | 20 | 58 |   |   | standalone,　単発と違い前段ヒットが必要なため。なおstartup 19, total 57が正しい |
| marisa | `volare_combo` | ヴォラーレコンボ | target_combo | 1 | 0 | `p_m chain p_m` |   |   |   |   | unknown, これは空中target_comboなのでフレームいらない |
| rashid | `backup` | バックアップ | unique | 1 | 0 | `r plus p` | 26 | 52 |   |   | through,前方ステップから派生。runからも派生できるが、そちらは最速ではないので考えない。 |
| rashid | `buffed_dash_back` | 【強化】後方ステップ | unique | 1 | 0 |   | 1 | 25 |   |   | standalone |
| rashid | `buffed_dash_forward` | 【強化】前方ステップ | unique | 1 | 0 |   | 1 | 20 |   |   | standalone, 誤りがありtotalは18。activeも18 |
| rashid | `buffed_heavy_eagle_spike` | 【強化】強イーグル・スパイク | special | 1 | 0 | `d dl l plus k_h` | 17 | 81 |   |   | standalone |
| rashid | `buffed_heavy_spinning_mixer` | 【強化】強スピニング・ミキサー | special | 1 | 0 | `d dr r plus p_h` | 5 | 104 |   |   | standalone |
| rashid | `buffed_jump_back` | 【強化】後ろジャンプ | unique | 1 | 1 |   | 1 | 44 |   |   | standalone |
| rashid | `buffed_jump_forward` | 【強化】前ジャンプ | unique | 1 | 1 |   | 1 | 44 |   |   | standalone |
| rashid | `buffed_jump_neutral` | 【強化】垂直ジャンプ | unique | 1 | 1 |   | 1 | 41 |   |   | standalone |
| rashid | `buffed_light_eagle_spike` | 【強化】弱イーグル・スパイク | special | 1 | 0 | `d dl l plus k_l` | 14 | 59 |   |   | standalone |
| rashid | `buffed_light_spinning_mixer` | 【強化】弱スピニング・ミキサー | special | 1 | 0 | `d dr r plus p_l` | 6 | 74 |   |   | standalone |
| rashid | `buffed_medium_eagle_spike` | 【強化】中イーグル・スパイク | special | 1 | 0 | `d dl l plus k_m` | 17 | 81 |   |  standalone | standalone |
| rashid | `buffed_medium_spinning_mixer` | 【強化】中スピニング・ミキサー | special | 1 | 0 | `d dr r plus p_m` | 5 | 120 |   |   | standalone |
| rashid | `buffed_od_eagle_spike` | 【強化】ODイーグル・スパイク | special | 1 | 0 | `d dl l plus k k` | 18 | 56 |   |   | standalone |
| rashid | `buffed_od_spinning_mixer` | 【強化】ODスピニング・ミキサー | special | 1 | 0 | `d dr r plus p p` | 4 | 119 |   |   | standalone |
| rashid | `buffed_tempest_moon` | 【強化】テンペスト・ムーン | unique | 1 | 0 | `r plus k` | 27 | 80 |   |   | throgh, 【強化】前方ステップから派生。runからも派生できるが、そちらは最速ではないので考えない。 |
| rashid | `front_flip` | フロント・フリップ | unique | 1 | 1 | `l or n or r plus k k` | 1 | 69 |   |   | through, side_flipから派生 |
| rashid | `nail_assault` | アサルト・ネイル | special | 1 | 0 | `k` | 17 | 45 |   |   | standalone, ケンのノーマル迅雷脚などと似たパターンで、弱中強ODのアラビアン・サイクロンから派生したアサルト・ロールから派生するので単一のthrough出せない |
| rashid | `rising_kick` | ライジング・キック | target_combo | 1 | 0 | `p_m chain k_h` | 13 | 52 |   |   | standalone, target_comboだが空振りでは出ない技 |
| rashid | `rolling_assault` | アサルト・ロール | special | 1 | 0 | `r plus k` | 1 | 33 |   |   | standalone, ケンのノーマル迅雷脚などと似たパターンで、弱中強ODのアラビアン・サイクロンから派生したアサルト・ロールから派生するので単一のthrough出せない |
| rashid | `run` | ラン | unique | 1 | 0 | `r charge_r` |   |   |   |   | standalone, 決まったフレームがないエッジケース。unknownがいいかもしれない。 |
| rashid | `tempest_moon` | テンペスト・ムーン | unique | 1 | 0 | `r plus k` | 34 | 63 |   |   | throgh, 前方ステップから派生。runからも派生できるが、そちらは最速ではないので考えない。 |
| rashid | `wall_jump` | 三角飛び | unique | 1 | 1 |   | 39 | 81 |   |   | through, 前か後ろジャンプからだが、ジャンプは方向関係なくフレームが一定。強化版のジャンプは考えない。なおstartup 34, active 42が正しいので訂正必要  |
| rashid | `wing_stroke` | ウイング・ストローク | special | 1 | 0 | `l plus k` | 1 | 67 |   |   | standalone, ケンのノーマル迅雷脚などと似たパターンで、弱中強ODのアラビアン・サイクロンから派生したアサルト・ロールから派生するので単一のthrough出せない |


---

## 2. `fastest_unreachable`（B 型・9 行）

**判断すること**: その技を単独で最速入力したとき、地上の相手に当てられるか。**当てられない → `true`**。
記入値は `true` / `false` / `非攻撃技` / `保留` のいずれか。

> **★`false` は「確認したうえで、地上の相手に当てられる」という積極的な主張である。** 消費側（M19-05）は `fastest_unreachable = false` の行を**スカラー S の target にできる技**として扱う。**「攻撃技ではないので `false`」と書くと、target になり得ない技が target になる。**
>
> | 記入値 | 意味 | 実装上の扱い |
> |---|---|---|
> | `true` | **確認した。単独最速では地上の相手に届かない** | backfill で `true` を投入する |
> | `false` | **確認した。単独最速で地上の相手に届く** | 既定値のまま（投入しない） |
> | **`非攻撃技`** | **そもそも攻撃判定を持たない**（移動・ジャンプ強化・壁蹴りなど）。当たる／当たらない以前に target になり得ない | 既定値のまま。**`false` と DB 状態は同じだが、意味が違う** |
> | `保留` | **まだ判断していない** | 既定値のまま。**後日の消化対象** |
>
> **★`非攻撃技` を認める理由は `unknown` と同じである**（ボード D-138）。**実装上の結果が同じでも、意味が違うものを同じ値に寄せると、後で開き直すか、誤読される。**
>
> **★当初案の `対象外` は採らない**（ボード D-207）。「何の対象外か」が言えていないため、**性質で書いた `非攻撃技` を採る**（playbook §4.21 (1)）。

> **B 型とは**: `is_aerial = 1` だが `code` に `jumping_` を含まない行。C 型（通常ジャンプ攻撃）は 000050 が機械付与する対象で、B 型は人手判断に回る（M19-04 §4.2）。

| character_code | move_code | name_ja | category | is_derived | is_aerial | command | startup | total | original_move_code | condition_ja | 記入: fastest_unreachable（`true` / `false` / `非攻撃技` / `保留`） |
|---|---|---|---|---|---|---|---|---|---|---|---|
| marisa | `caelum_arc` | カエルムアーク | unique | 0 | 1 | `d plus p_h` | 9 | 46 |   |   | true, 通常のジャンプ攻撃と同じ |
| marisa | `caelum_arc_holding` | 【ホールド】カエルムアーク | unique | 0 | 1 | `d plus p_h hold` | 28 | 46 |   |   | true, 通常のジャンプ攻撃と同じ |
| rashid | `aerial_shot` | エリアルシュート | unique | 0 | 1 | `u plus k_h` | 8 | 46 |   |   | true, 通常のジャンプ攻撃と同じ |
| rashid | `blitz_strike` | ブリッツストライク | unique | 0 | 1 | `d plus p_h` | 10 | 46 |   |   | true, 通常のジャンプ攻撃と同じ |
| rashid | `buffed_jump_back` | 【強化】後ろジャンプ | unique | 1 | 1 |   | 1 | 44 |   |   | 非攻撃技（旧記入: false, 攻撃技ではない。D-207 により振り替え） |
| rashid | `buffed_jump_forward` | 【強化】前ジャンプ | unique | 1 | 1 |   | 1 | 44 |   |   | 非攻撃技（旧記入: false, 攻撃技ではない。D-207 により振り替え） |
| rashid | `buffed_jump_neutral` | 【強化】垂直ジャンプ | unique | 1 | 1 |   | 1 | 41 |   |   | 非攻撃技（旧記入: false, 攻撃技ではない。D-207 により振り替え） |
| rashid | `front_flip` | フロント・フリップ | unique | 1 | 1 | `l or n or r plus k k` | 1 | 69 |   |   | 非攻撃技（旧記入: false, 攻撃技ではない。D-207 により振り替え）。フロントフリップから通常ジャンプ攻撃は出せるのだが、ややこしいので今は対応しない。 |
| rashid | `wall_jump` | 三角飛び | unique | 1 | 1 |   | 39 | 81 |   |   | 非攻撃技（旧記入: false, 攻撃技ではない。D-207 により振り替え）。フロントフリップから通常ジャンプ攻撃は出せるのだが、ややこしいので今は対応しない。 |

---

## 3. `その他開発者伝達`

### ケンの以下の技を更新したい。
ノーマル迅雷脚は派生が複雑だが、OD版は、
OD迅雷脚＞OD風鎌蹴り＞火砕蹴(OD風鎌蹴り派生)
のように前提技が決まっているため。
（対比として、ノーマルの場合は、弱中強の迅雷脚から風鎌蹴りに派生という複雑な形）

ken,jinrai_kick_od,special,OD迅雷脚,13,3,25,40,-4,-7,600,false,false,false,,,,d dr r plus k k,,,standalone,false,
ken,kazekama_shin_kick_od,special,OD風鎌蹴り,26,3,20,48,3,-5,500,false,false,true,,,,r plus k_l,,,through,false,
ken,gorai_axe_kick_od,special,OD轟雷落とし,37,3,24,63,-3,-7,1000,false,false,true,,,,r plus k_m,,,through,false,
ken,senka_snap_kick_od,special,OD閃火脚,28,6,18,51,,-4,800,false,false,true,,,,r plus k_h,,,through,false,
ken,kasai_thrust_kick,special,火砕蹴(OD風鎌蹴り派生),45,3,29,76,,-12,500,false,false,true,,,,r plus k,,,through,false,
ken,kasai_thrust_kick_during_od_gorai_axe_kick,special,火砕蹴(OD轟雷落とし派生),54,3,29,85,,-12,500,false,false,true,,,,r plus k,,,through,false,
ken,kasai_thrust_kick_during_od_senka_snap_kick,special,火砕蹴(OD閃火脚派生),54,3,37,93,,-20,500,false,false,true,,,,r plus k,,,through,false,

### Jamieの乱酔旋のフレーム訂正
jamie,drink_level_4_ransui_haze_2_retreat,target_combo,[酔いレベル4]乱酔旋(2段目/後退),16,3,75,93,,-58,990,false,false,true,,,,r plus k_h chain l plus k_h,,,,false,
jamie,drink_level_4_ransui_haze_3_immediate,target_combo,[酔いレベル4]乱酔旋(3段目/即時),38,5,28,70,,-13,1925,false,false,true,,,,r plus k_h chain l plus k_h chain p,,,,false,
jamie,drink_level_4_ransui_haze_3_delay,target_combo,[酔いレベル4]乱酔旋(3段目/ディレイ),53,25,27,104,,-9,1320,false,false,true,,,,r plus k_h chain l plus k_h chain p,,,,false,
jamie,drink_level_4_ransui_haze_3_drink_while_retreating,target_combo,[酔いレベル4]乱酔旋（3段目/後退飲酒）,15,3,115,132,,-98,990,false,false,true,,最速派生でのガードマイナスを記載,,r plus k_h chain l plus k_h chain p,,,,false,


### fastest_unreachableを考えないといけないが抜けてしまった技。
必殺技なのでis_aireal=trueにしていなかったため抜けていた。
これらは前回投入した分も含めて再チェックした。
なお補足として立ち状態にだけ当たる技としゃがみにも当たる技がある事がわかった。
ここは開発者の判断で、立ち状態に当てる事に価値があるか否かで別途判断する。

・jamieの無影蹴はthroughである。ジャンプから最速で出した場合のフレームを記載しており、最速で出して相手に当たる技なので、fastest_unreachable=true
・Rashidのアラビアン・スカイハイは全強度ジャンプ派生のthroughが入っている。立ち状態に相手に当たり、しゃがみ状態の相手に当たらないもの＝重ねる技ではないので、fastest_unreachable=false
・LukeのAerial Flash Knuckleは一律throughでfastest_unreachable=false

#### ここから前回挿入キャラ
一律と記載したものは強度なし版、弱、中、強、OD全部に当てはまるという意味

・ingridの Solar Burstは弱以外はthrough, fastest_unreachable=true※レベル付のものも一律
・JuriのShiku-senは一律through, fastest_unreachable=true
・KenのAerial Tatsumaki Senpu-kyakuは一律through, fastest_unreachable=false
・KimberlyのElbow Dropがthroughとして登録されていない可能性がある
・KimberlyのNue Twisterは一律through, fastest_unreachable=false
・KimberlyのAerial Bushin Senpukyakuは一律through, fastest_unreachable=true
・RyuのAerial Tatsumaki Senpu-kyakuはthrough, 弱中強はfastest_unreachable=false,ODだけfastest_unreachable=true
・Lilyのcondor_dive。これはfastest_unreachable=trueだが会話をしていなかった。
・LilyのSa2 Soaring ThunderbirdとWindclad Sa2 Soaring Thunderbirdはthrough（ジャンプから）でfastest_unreachable=true

---

## 付録: 本一覧の抽出クエリ（再生成・差分検証用）

**次の seed 波で同じ一覧を出すときは、`WHERE c.code IN (...)` の対象キャラだけを差し替えて再実行する。**
生成は使い捨てプログラムで行い削除したが、**抽出条件そのものは以下が正である**（本文の件数サマリと同一）。

### 系統 1: `startup_basis`

```sql
SELECT c.code, m.code,
       COALESCE((SELECT pa.alias_text FROM preset_aliases pa
                 JOIN presets p ON p.id = pa.preset_id AND p.code = 'official_ja_move'
                 WHERE pa.move_id = m.id), '') AS name_ja,
       m.category, m.is_derived, m.is_aerial, m.startup, m.total
FROM moves m JOIN characters c ON c.id = m.character_id
WHERE c.code IN ('jamie','jp','luke','m_bison','marisa','rashid')
  AND m.is_derived = 1 AND m.category <> 'rush_variant' AND m.startup_basis = 'unknown'
ORDER BY c.code, m.code;
```

### 系統 2: `fastest_unreachable`（B 型）

```sql
SELECT c.code, m.code, /* 同上の列 */
       m.category, m.is_derived, m.is_aerial, m.startup, m.total
FROM moves m JOIN characters c ON c.id = m.character_id
WHERE c.code IN ('jamie','jp','luke','m_bison','marisa','rashid')
  AND m.is_aerial = 1 AND m.code NOT LIKE '%jumping\_%' ESCAPE '\'
ORDER BY c.code, m.code;
```

> **★`%jumping\_%` は部分一致であること。** 前方一致 `jumping\_%` にすると `neutral_jumping_heavy_kick` 型を取り落とす（`000050` のコメントと `migrate_m1904_test.go` の `m1904PrefixMissed` が同じ罠を固定している）。

### 補助列の結合

`command` / `original_move_code` / `condition_ja` は `moves` に列が無いため `character_data/<character_code>.csv` を `move_code` で結合する。
**`marisa.csv` は `notes` 列にカンマを含む行があるため、素朴な文字列分割ではなく CSV パーサを使うこと。**

---

*以上、M19-04b §4.3 の一覧。*
