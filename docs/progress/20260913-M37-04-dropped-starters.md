# M37-04 で確定反撃の候補から外れた行の全数（**開発者の手入力リスト**）

| 項目 | 内容 |
|------|------|
| 作成 | 製造担当 Claude Code ／ 2026-09-13 |
| 由来 | `M37-04`（`B06`）。完了報告＝`docs/progress/M37-04-completion-report.md` |
| 目的 | **開発者が `first_hit_startup` を埋めるときの作業リスト**。あわせて「何をしたか」を GitHub 差分を読まずに確かめられるようにする |

---

## 0. ★★★経緯 — 「紐付けない」から「開発者ルールで解決した」へ

> **★本節は 2 段階ある。初版（2026-09-13）の記述を消さずに残し、追記の形で更新する。**

### 0-1 初版（2026-09-13）＝**始動技は 1 件も紐付けていなかった**

**開発者の問い**（逐語）＝「**私の支援なしで、本当にターゲットコンボの始動技が何なのか、全て紐付けれたのか気になる**」への回答である。

| 指示書の定め | 内容 |
|---|---|
| §0.2 | **「初段を同定しない。値を直接持つ」** |
| §3-3（やらないこと） | **「初段を機械的に同定しようとすること」**——実測で `target_combo` 126 行のうち **59 行が判定不能**であり、そもそも `command` 列は DB の `moves` に無い（`M37-RESEARCH-01` §6-2） |

**⇒ 着地時点では `first_hit_startup` は全行空であり、値は開発者の手番だった**（`D-857`）。

### 0-2 ★★★更新（2026-09-14）＝**開発者がルールを提示し、106 行を機械解決した**

**開発者の指示**（逐語）:

> 「**commands を見れば全て機械的に対応可能だったので、手入力は省略していいですか？ あなたの方でやってもらえますか？**」
> 「`p_l chain p_m chain p_h` の場合、**最初に現れた `chain` の隣の `p_l`**、つまり弱パンチを見つけて、**その発生フレームを使ってください**。`p_l` を `d plus p_l` に置き換えて考えると、しゃがみ弱P。**`d` 以外の方向が指定されていたら `unique` 技から `chain` がついていない技を探す**。」

**⇒ 106 行すべてが解決し、未解決は 0 件だった**（§6 に対応表の全数）。

**★★ただし `§0.2` の設計は維持されている。** ルールは**値を作るために 1 回だけオフラインで使った**ものであり、**実行時のコードは列を読むだけである。⇒ 同定ロジックは実装に 1 行も入っていない。**

**★`§3-3` の根拠は「素朴な先頭 `command` 完全一致では 59 行が判定不能」だった。⇒ 開発者ルール（最初の `chain` の手前を取る ＋ カテゴリの優先順位）では前提が変わり、106/106 が決まった。**

## 1. 読み方

- **「記録 `startup`」は現在 `moves.startup` に入っている値**である。**★これは正しいデータであり、本サブは 1 行も書き換えていない**（開発者の逐語＝「ゲームの第二段目発生が入っている事は間違いない」）。
- **埋めるのは、その技の初段が当たるまでのフレームである。** ⇒ 記録 `startup` とは別の値になることが多い。
  - 例＝ryu `fuwa_triple_strike_2hits` は記録 `startup=5`（2 段目の発生）だが、**初段の立中P は 6F**。⇒ `first_hit_startup` に入れるのは **6**。
- **`command` は CSV の生データをそのまま載せている。★製造は解決していない**——先頭入力がどの技かの機械照合は本プロジェクトでは信頼できない（§0）。**⇒ 参考情報として置くだけである。**
- **記入先**は `character_data/*.csv` の **`first_hit_startup` 列（25 列目・末尾）**。
- **★埋めたあと DB へ入れるには backfill マイグレが要る**（番号を設計卓へ請求中）。**⇒ 先に埋めると `csv_db_sync_test` が赤の期間になる。**

---

## 2. キャラ別の件数（**25 キャラ・計 105 行**）

| キャラ | 件数 | キャラ | 件数 | キャラ | 件数 | キャラ | 件数 |
|---|---:|---|---:|---|---:|---|---:|
| jamie | 10 | terry | 7 | jp | 4 | mai | 3 |
| elena | 7 | dee_jay | 6 | manon | 4 | ryu | 3 |
| kimberly | 7 | ed | 6 | sagat | 4 | alex | 2 |
| luke | 7 | yasmine | 5 | ingrid | 3 | cammy | 2 |
| marisa | 7 | akuma | 4 | ken | 3 | lily | 2 |
| | | guile | 4 | | | m_bison | 2 |
| | | | | | | e_honda / juri / rashid | 各 1 |

---

## 3. 全数（105 行）

| キャラ | `move_code` | 技名 | 記録 `startup` | `command` |
|---|---|---|---:|---|
| akuma | `bone_crusher_axe_kick` | 骸斬り | **20** | `k_m chain k_h` |
| akuma | `kikoku_combination` | 鬼哭連撃 | **9** | `r plus p_h chain r plus p_h chain k_h` |
| akuma | `kikoku_combination_2hits` | 鬼哭連撃(2発止め) | **10** | `r plus p_h chain r plus p_h` |
| akuma | `viscera_piercer` | 六腑穿ち | **7** | `p_m chain p_m` |
| alex | `palm_strikes` | パームストライク | **15** | `p_m chain p_h` |
| alex | `twisted_drop` | ツイストドロップ | **15** | `d plus k_l chain d plus k_h` |
| cammy | `lift_combination` | リフトコンビネーション | **9** | `l plus p_m chain k_h` |
| cammy | `swing_combination` | スイングコンビネーション | **13** | `p_h chain k_h` |
| dee_jay | `dee_jay_special` | ディージェイスペシャル | **13** | `p_m chain p_h chain k_h` |
| dee_jay | `dee_jay_special_2hits` | ディージェイスペシャル(2発止め) | **11** | `p_m chain p_h` |
| dee_jay | `funky_dance` | ファンキーダンス | **20** | `p_m chain p_m chain p_h` |
| dee_jay | `funky_dance_2hits` | ファンキーダンス(2発止め) | **12** | `p_m chain p_m` |
| dee_jay | `threebeat_combo` | 3ビートコンボ | **14** | `p_l chain k_m chain k_m` |
| dee_jay | `threebeat_combo_2hits` | 3ビートコンボ(2発止め) | **9** | `p_l chain k_m` |
| e_honda | `toko_shizume_sumo_spirit` | 地鎮(肩屋入り) | **22** | `p_m chain dr plus k_h chain d plus k_h` |
| ed | `body_blow_combination` | ボディブローコンビネーション | **13** | `p_m chain p_h` |
| ed | `flicker_combination` | フリッカーコンビネーション | **7** | `k_l chain k_l chain k_l` |
| ed | `flicker_combination_2hits` | フリッカーコンビネーション(2発止め) | **7** | `k_l chain k_l` |
| ed | `hitman_combination` | ヒットマンコンビネーション | **11** | `k_m chain k_m chain p_h` |
| ed | `hitman_combination_2hits` | ヒットマンコンビネーション(2発止め) | **7** | `k_m chain k_m` |
| ed | `low_smash_combination` | ロースマッシュコンビネーション | **10** | `d plus k_h chain p_h` |
| elena | `fluttering_lark` | ラークフラッター | **15** | `d plus k_m chain k_h` |
| elena | `handstand_whip` | ハンドスタンドウィップ | **14** | `r plus k_m chain k_m` |
| elena | `hind_kick` | ハインドキック | **12** | `k_m chain k_h` |
| elena | `starling_beak` | スターリングビーク | **17** | `p_m chain p_m` |
| elena | `trunk_slap` | トランクスラップ | **7** | `r plus p_h chain p_h chain p_h` |
| elena | `trunk_slap_2hits` | トランクスラップ(2発止め) | **13** | `r plus p_h chain p_h` |
| elena | `turning_tail` | ターニングテイル | **17** | `p_h chain p_h` |
| guile | `double_shot` | ダブルバレット | **12** | `d plus p_m chain d plus p_m` |
| guile | `drake_fang` | ドレイクファング | **20** | `d plus k_m chain r plus p_m` |
| guile | `phantom_cutter` | ファントムカッター | **10** | `d plus k_h chain dr plus k_h` |
| guile | `recoil_cannon` | リコイルキャノン | **16** | `p_m chain l plus p_h` |
| ingrid | `glowing_touch` | グロータッチ | **20** | `l k_m chain p_h` |
| ingrid | `luminous_uppercut` | ルミナスアッパー | **23** | `l p_h chain p_h` |
| ingrid | `pretty_heel_kick` | エアリートス | **12** | `p_m chain k_m` |
| jamie | `bitter_strikes` | 鋭鍾打 | **8** | `p_l chain k_l chain p_m` |
| jamie | `bitter_strikes_2hits` | 鋭鍾打(2発止め) | **6** | `p_l chain k_l` |
| jamie | `drink_level_3_intoxicated_assault` | [酔いレベル3]酩酊襲 | **21** | `l plus p_h chain p_h chain k_h` |
| jamie | `full_moon_kick` | 円月脚(飲酒) | **15** | `r plus k_m chain k_m chain p` |
| jamie | `full_moon_kick_2hits` | 円月脚 | **15** | `r plus k_m chain k_m` |
| jamie | `full_moon_kick_drink_and_reach_drink_lv4` | 円月脚(飲酒 / 酔いLv4到達) | **15** | `r plus k_m chain k_m chain p` |
| jamie | `intoxicated_assault_1hit` | [酔いレベル3]酩酊襲(2発止め) | **21** | `l plus p_h chain p_h` |
| jamie | `phantom_sway` | 幻酔舞(飲酒) | **12** | `d plus k_h chain k_h chain p` |
| jamie | `phantom_sway_2hits` | 幻酔舞 | **12** | `d plus k_h chain k_h` |
| jamie | `phantom_sway_drink_and_reach_drink_lv4` | 幻酔舞(飲酒 / 酔いLv4到達) | **12** | `d plus k_h chain k_h chain p` |
| jp | `grom_strelka` | グロームストレルカ | **10** | `l plus p_m chain p_m` |
| jp | `zilant` | ジラント | **20** | `k_h chain p_h` |
| jp | `zilant_low` | ジラントナガー | **21** | `k_h chain p_h chain k_h` |
| jp | `zilant_mid` | ジラントルカー | **21** | `k_h chain p_h chain p_h` |
| juri | `death_crest` | 死紋蹴 | **17** | `p_m chain l plus p_h chain p_h` |
| ken | `chin_buster` | 顎撥二連 | **11** | `p_m chain p_h` |
| ken | `triple_flash_kicks` | 閃光連脚 | **13** | `k_m chain k_m chain k_h` |
| ken | `triple_flash_kicks_2hits` | 閃光連脚(2発止め) | **11** | `k_m chain k_m` |
| kimberly | `bushin_hellchain` | 武神獄鎖拳 | **15** | `p_l chain p_m chain d plus p_h chain k_h` |
| kimberly | `bushin_hellchain_3hits` | 武神獄鎖拳(3発止め) | **10** | `p_l chain p_m chain d plus p_h` |
| kimberly | `bushin_hellchain_throw` | 武神獄鎖投げ | **15** | `p_l chain p_m chain d plus p_h chain d plus k_h` |
| kimberly | `bushin_prism_strikes` | 武神天架拳 | **26** | `p_l chain p_m chain p_h chain k_h` |
| kimberly | `bushin_prism_strikes_2hits` | 武神天架拳(2発止め) | **6** | `p_l chain p_m` |
| kimberly | `bushin_prism_strikes_3hits` | 武神天架拳(3発止め) | **12** | `p_l chain p_m chain p_h` |
| kimberly | `bushin_tiger_fangs` | 武神虎連牙 | **10** | `p_m chain p_h` |
| lily | `desert_storm` | デザートストーム | **20** | `r plus p_h chain p_h chain p_h` |
| lily | `desert_storm_2hits` | デザートストーム(2発止め) | **20** | `r plus p_h chain p_h` |
| luke | `double_impact` | ダブルインパクト | **11** | `r plus p_h chain p_h` |
| luke | `nose_breaker` | ノーズブレイカー | **9** | `d plus k_m chain d plus p_h` |
| luke | `snapback_combo` | スナップバックコンボ | **11** | `p_m chain p_m chain p_m chain p_m` |
| luke | `snapback_combo_2hits` | スナップバックコンボ(2発止め) | **12** | `p_m chain p_m` |
| luke | `snapback_combo_3hits` | スナップバックコンボ(3発止め) | **11** | `p_m chain p_m chain p_m` |
| luke | `triple_impact` | トリプルインパクト | **10** | `p_l chain p_m chain p_h` |
| luke | `triple_impact_2hits` | トリプルインパクト(2発止め) | **8** | `p_l chain p_m` |
| m_bison | `shadow_hammer` | シャドウハンマー | **22** | `p_m chain r plus p_h` |
| m_bison | `shadow_spear` | シャドウスピア | **16** | `p_m chain d plus k_h` |
| mai | `hien_ren_kyaku` | 飛燕連脚 | **10** | `k_l chain k_l chain k_l` |
| mai | `hien_ren_kyaku_2hits` | 飛燕連脚(2発止め) | **7** | `k_l chain k_l` |
| mai | `hoshi_kujaku` | 星孔雀 | **9** | `l plus k_h chain k_h` |
| manon | `a_terre` | ア・テール | **10** | `p_m chain k_m` |
| manon | `allonge` | アロンジェ | **4** | `d plus p_h chain p_h` |
| manon | `en_haut` | アン・オー | **14** | `l plus k_m chain k_m` |
| manon | `temps_lie` | タン・リエ | **5** | `p_h chain p_h` |
| marisa | `falx_crusher` | ファルクスクラッシュ | **16** | `r plus k_h chain r plus k_h` |
| marisa | `heavy_two_hitter` | ヘビィーワンツー | **24** | `p_h chain p_h` |
| marisa | `light_two_hitter` | ライトワンツー | **14** | `p_l chain p_l` |
| marisa | `malleus_breaker` | マレウスビート | **18** | `dr plus p_h chain dr plus p_h` |
| marisa | `medium_two_hitter` | ミドルワンツー | **14** | `p_m chain p_m` |
| marisa | `novacula_swipe` | ノバキュラスワイプ | **11** | `r plus p_m chain p_h` |
| marisa | `novacula_thrust` | ノバキュラシュート | **11** | `r plus p_m chain k_h` |
| rashid | `rising_kick` | ライジング・キック | **13** | `p_m chain k_h` |
| ryu | `fuwa_triple_strike` | 不破三連撃 | **17** | `p_m chain k_l chain k_h` |
| ryu | `fuwa_triple_strike_2hits` | 不破三連撃(2発止め) | **5** | `p_m chain k_l` |
| ryu | `high_double_strike` | 上段二連撃 | **9** | `p_h chain k_h` |
| sagat | `middle_step_kick` | ステップミドルキック | **16** | `k_m chain k_h` |
| sagat | `tiger_rise` | タイガーライズ | **18** | `d plus p_m chain k_h` |
| sagat | `tiger_slash` | タイガースラッシュ | **20** | `d plus p_m chain p_h` |
| sagat | `tiger_sting` | タイガースティング | **16** | `p_h chain k_h` |
| terry | `fire_kick` | ファイヤーキック | **13** | `d plus k_m chain d plus k_h` |
| terry | `jumping_knee` | ジャンプニーアタック | **24** | `p_m chain k_m chain k_m` |
| terry | `jumping_lariat` | ジャンプラリアットパンチ | **24** | `p_m chain k_m chain p_m` |
| terry | `passing_sway` | パッシングスウェー | **13** | `p_m chain k_m` |
| terry | `power_drive` | パワードライブ | **15** | `p_m chain p_h` |
| terry | `power_dunk` | パワーダンク | **18** | `p_m chain k_h chain k_h` |
| terry | `power_shoot` | パワーシュート | **18** | `p_m chain k_h` |
| yasmine | `kidlat_na_hiwa` | キドラット・ナ・ヒワ | **8** | `p_l chain p_l` |
| yasmine | `kumbinasyong_pampabagsak` | コンビナション・パムパバッグサ | **8** | `d plus k_m chain k_h` |
| yasmine | `sunod_sunod_na_sipa` | スノスノッド・ナ・シパ | **16** | `k_m chain k_m chain k_h` |
| yasmine | `sunod_sunod_na_sipa_2hits` | スノスノッド・ナ・シパ(2発止め) | **13** | `k_m chain k_m` |
| yasmine | `tatlong_hiwa` | タッロング・ヒワ | **12** | `p_m chain p_m` |

---

## 4. ★この表に**入っていない**もの（意図的な除外）

| 集合 | 件数 | なぜ入っていないか |
|---|---:|---|
| `target_combo` ∧ 非 `is_derived` | 8 | **本サブの判定対象外。⇒ `startup` をそのまま使う**（開発者裁定・2026-09-13） |
| `target_combo` ∧ `is_derived` ∧ `basis='through'` | 4 | **通し値であり既に初段分を含む。⇒ そのまま判定して偽陽性にならない**（jamie 乱酔旋 4 行） |
| `target_combo` ∧ `is_derived` ∧ `basis='unknown'` | 4 | 同上（対象は `standalone` に限る） |
| **フレームが空の行**（対象 110 行のうち 4 行） | 4 | **元から候補ではない。⇒ 埋める必要も無い。** dee_jay `party_in_the_air` ／ elena `soaring_raid` ／ elena `raptor_range` ／ **chun_li `soaring_eagle_punches`**（追補2 で空中限定の形へ揃えた） |

**★対象行の総数は 110、そのうちフレームを持つ 106、さらに非空中・`damage>0` の 105 が本表である。**

---

## 5. ★★空中限定ターゲットコンボの扱い（**埋めなくてよい形**）

**開発者指示**（2026-09-13・逐語）＝「**elena の `soaring_raid` の形式にしたい。これは空中限定のターゲットコンボで確定反撃ではそもそも扱わない対象外になる**」。

| 列 | 空中限定の形 |
|---|---|
| `startup` / `active` / `recovery` / `total` | **すべて空** |
| `is_aerial` | `false` |
| `is_derived` | `true` |
| `category` | `target_combo` |

**⇒ この形の行は `first_hit_startup` を埋めなくてよい。** フレームが空なので判定の材料がなく、始動技候補に載らない。

**★実測**（canary・31 キャラ総当たり）——3 行とも**始動技としての出現 0 件 ／ 相手技として手動確認レーン（`data_missing`）に 62 件**で完全に一致した。

| code | 始動技 | 相手技（手動確認レーン） |
|---|---:|---:|
| elena `soaring_raid` | 0 | 62 |
| ingrid `satelite_leap` | 0 | 62 |
| chun_li `soaring_eagle_punches`（追補2 で揃えた） | 0 | 62 |

**この形は `TestRun_M3704_AirOnlyTargetCombosShareTheShape` が 3 行まとめて固定している。⇒ 次に誰かが片方だけ触ったら赤になる。**

**★同型の行が他にもあると気づいたら、埋めるのではなくこの形へ揃えるほうが正しい。**

---

*以上。* **★本表は「製造が何を落としたか」の記録であると同時に、開発者の手入力リストでもある。** **★★製造は初段を 1 つも同定していない。⇒ 105 行の値はすべて空のままである。**

---

## 6. ★★解決ルールと対応表（**2026-09-14 追記**）

### 6-1 適用したアルゴリズム

```
head = command を最初の " chain " で切った左側
候補 = 同キャラで command が head と完全一致 ∧ command に "chain" を含まない ∧ 自分自身でない
  (0) 地上優先                     … 候補に非空中があれば空中を捨てる
                                     （`p_h` が立強P とジャンプ強P の両方に当たるため）
  (1) head がボタン 1 つだけなら normal 優先 … 開発者ルール 3 の対偶（方向が無ければ通常技）
  (2) unique を special より優先          … 開発者ルール 3 そのもの
  (3) 残った候補の startup が全部同じなら曖昧でない … 状態変種（jamie の飲酒レベル違い等）
```

**★(0)(1)(3) は開発者ルールの補完である。** (2) は逐語そのもの。

### 6-2 結果

| 指標 | 実測 |
|---|---:|
| 対象（集合 B かつ `startup` あり） | **106 行** |
| **解決 / 未解決** | **106 / 0** |
| 解決先が `normal` | 83 行 |
| 解決先が `unique` | 23 行 |
| 解決先が `special` / `system` / `throw` / `target_combo`（入れ子） | **0 行** |

**`head` の形**: ボタンのみ 68 ／ `d plus`（しゃがみ）15 ／ 方向 `plus`（特殊技）21 ／ ingrid の `l k_m`・`l p_h` 2。

**★`*_1hit` / `*_1hits` という明示行に当たったものが複数ある**（elena `trunk_slap_1hit` ／ elena `handstand_whip_1hit` ／ ingrid `glowing_touch_1hits` ／ ingrid `luminous_uppercut_1hits`）**。⇒ ルールの妥当性の裏づけになる。**

### 6-3 ★★埋めたことの帰結（**挙動が変わる**）

| 関係 | 行数 | 意味 |
|---|---:|---|
| **初段のほうが記録より遅い** | **17 行** | **記録値が速すぎて偽陽性を出していた行。⇒ 恒久的に正しく落ちる** |
| 同値 | 1 行 | yasmine `kumbinasyong_pampabagsak`（8 = 8） |
| **初段のほうが記録より速い** | **88 行** | **★記録値が遅すぎた行。⇒ 着手前より緩い有利フレームで候補に出る** |

**★★★88 行は「戻る」だけではなく「より出やすくなる」。** 例＝dee_jay `funky_dance` は記録 20 だが初段は立中P の 7。**⇒ 着手前は有利 20F 以上でしか出なかったものが、有利 7F から出る。★これはゲームの事実として正しい**（その TC を始動に使うなら最初に押すのは立中P である）。

**★canary 実測**（31 キャラ総当たり）——**新たに現れた code は 0 件**、消えた code は `soaring_eagle_punches` の **1 件のみ**（空中限定の形へ揃えたため）。**始動技の延べ出現は +54,462。**

### 6-4 対応表（全 106 行）

| キャラ | `move_code` | 技名 | 記録 `startup` | `head` | 解決した初段 | **入れた値** |
|---|---|---|---:|---|---|---:|
| akuma | `bone_crusher_axe_kick` | 骸斬り | 20 | `k_m` | `standing_medium_kick`（normal） | **7** |
| akuma | `kikoku_combination` | 鬼哭連撃 | 9 | `r plus p_h` | `kikoku_combination_1hit`（unique） | **13** |
| akuma | `kikoku_combination_2hits` | 鬼哭連撃(2発止め) | 10 | `r plus p_h` | `kikoku_combination_1hit`（unique） | **13** |
| akuma | `viscera_piercer` | 六腑穿ち | 7 | `p_m` | `standing_medium_punch`（normal） | **6** |
| alex | `palm_strikes` | パームストライク | 15 | `p_m` | `standing_medium_punch`（normal） | **7** |
| alex | `twisted_drop` | ツイストドロップ | 15 | `d plus k_l` | `crouching_light_kick`（normal） | **5** |
| cammy | `lift_combination` | リフトコンビネーション | 9 | `l plus p_m` | `lift_uppercut`（unique） | **5** |
| cammy | `swing_combination` | スイングコンビネーション | 13 | `p_h` | `standing_heavy_punch`（normal） | **8** |
| dee_jay | `dee_jay_special` | ディージェイスペシャル | 13 | `p_m` | `standing_medium_punch`（normal） | **7** |
| dee_jay | `dee_jay_special_2hits` | ディージェイスペシャル(2発止め) | 11 | `p_m` | `standing_medium_punch`（normal） | **7** |
| dee_jay | `funky_dance` | ファンキーダンス | 20 | `p_m` | `standing_medium_punch`（normal） | **7** |
| dee_jay | `funky_dance_2hits` | ファンキーダンス(2発止め) | 12 | `p_m` | `standing_medium_punch`（normal） | **7** |
| dee_jay | `funky_dance_feint` | ファンキーダンス・フェイク | 1 | `p_m` | `standing_medium_punch`（normal） | **7** |
| dee_jay | `threebeat_combo` | 3ビートコンボ | 14 | `p_l` | `standing_light_punch`（normal） | **4** |
| dee_jay | `threebeat_combo_2hits` | 3ビートコンボ(2発止め) | 9 | `p_l` | `standing_light_punch`（normal） | **4** |
| e_honda | `toko_shizume_sumo_spirit` | 地鎮(肩屋入り) | 22 | `p_m` | `standing_medium_punch`（normal） | **10** |
| ed | `body_blow_combination` | ボディブローコンビネーション | 13 | `p_m` | `standing_medium_punch`（normal） | **7** |
| ed | `flicker_combination` | フリッカーコンビネーション | 7 | `k_l` | `standing_light_kick`（normal） | **6** |
| ed | `flicker_combination_2hits` | フリッカーコンビネーション(2発止め) | 7 | `k_l` | `standing_light_kick`（normal） | **6** |
| ed | `hitman_combination` | ヒットマンコンビネーション | 11 | `k_m` | `standing_medium_kick`（normal） | **10** |
| ed | `hitman_combination_2hits` | ヒットマンコンビネーション(2発止め) | 7 | `k_m` | `standing_medium_kick`（normal） | **10** |
| ed | `low_smash_combination` | ロースマッシュコンビネーション | 10 | `d plus k_h` | `crouching_heavy_kick`（normal） | **12** |
| elena | `fluttering_lark` | ラークフラッター | 15 | `d plus k_m` | `crouching_medium_kick`（normal） | **9** |
| elena | `handstand_whip` | ハンドスタンドウィップ | 14 | `r plus k_m` | `handstand_whip_1hit`（unique） | **20** |
| elena | `hind_kick` | ハインドキック | 12 | `k_m` | `standing_medium_kick`（normal） | **6** |
| elena | `starling_beak` | スターリングビーク | 17 | `p_m` | `standing_medium_punch`（normal） | **8** |
| elena | `trunk_slap` | トランクスラップ | 7 | `r plus p_h` | `trunk_slap_1hit`（unique） | **16** |
| elena | `trunk_slap_2hits` | トランクスラップ(2発止め) | 13 | `r plus p_h` | `trunk_slap_1hit`（unique） | **16** |
| elena | `turning_tail` | ターニングテイル | 17 | `p_h` | `standing_heavy_punch`（normal） | **12** |
| guile | `double_shot` | ダブルバレット | 12 | `d plus p_m` | `crouching_medium_punch`（normal） | **6** |
| guile | `drake_fang` | ドレイクファング | 20 | `d plus k_m` | `crouching_medium_kick`（normal） | **8** |
| guile | `phantom_cutter` | ファントムカッター | 10 | `d plus k_h` | `crouching_heavy_kick`（normal） | **9** |
| guile | `recoil_cannon` | リコイルキャノン | 16 | `p_m` | `standing_medium_punch`（normal） | **7** |
| ingrid | `glowing_touch` | グロータッチ | 20 | `l k_m` | `glowing_touch_1hits`（unique） | **9** |
| ingrid | `luminous_uppercut` | ルミナスアッパー | 23 | `l p_h` | `luminous_uppercut_1hits`（unique） | **14** |
| ingrid | `pretty_heel_kick` | エアリートス | 12 | `p_m` | `standing_medium_punch`（normal） | **6** |
| jamie | `bitter_strikes` | 鋭鍾打 | 8 | `p_l` | `standing_light_punch`（normal） | **5** |
| jamie | `bitter_strikes_2hits` | 鋭鍾打(2発止め) | 6 | `p_l` | `standing_light_punch`（normal） | **5** |
| jamie | `drink_level_3_intoxicated_assault` | [酔いレベル3]酩酊襲 | 21 | `l plus p_h` | `hermits_elbow`（unique） | **18** |
| jamie | `full_moon_kick` | 円月脚(飲酒) | 15 | `r plus k_m` | `falling_star_kick`（unique） | **22** |
| jamie | `full_moon_kick_2hits` | 円月脚 | 15 | `r plus k_m` | `falling_star_kick`（unique） | **22** |
| jamie | `full_moon_kick_drink_and_reach_drink_lv4` | 円月脚(飲酒 / 酔いLv4到達) | 15 | `r plus k_m` | `falling_star_kick`（unique） | **22** |
| jamie | `intoxicated_assault_1hit` | [酔いレベル3]酩酊襲(2発止め) | 21 | `l plus p_h` | `hermits_elbow`（unique） | **18** |
| jamie | `phantom_sway` | 幻酔舞(飲酒) | 12 | `d plus k_h` | `crouching_heavy_kick`（normal） | **9** |
| jamie | `phantom_sway_2hits` | 幻酔舞 | 12 | `d plus k_h` | `crouching_heavy_kick`（normal） | **9** |
| jamie | `phantom_sway_drink_and_reach_drink_lv4` | 幻酔舞(飲酒 / 酔いLv4到達) | 12 | `d plus k_h` | `crouching_heavy_kick`（normal） | **9** |
| jp | `grom_strelka` | グロームストレルカ | 10 | `l plus p_m` | `grom_strelka_1hit`（unique） | **8** |
| jp | `zilant` | ジラント | 20 | `k_h` | `standing_heavy_kick`（normal） | **12** |
| jp | `zilant_low` | ジラントナガー | 21 | `k_h` | `standing_heavy_kick`（normal） | **12** |
| jp | `zilant_mid` | ジラントルカー | 21 | `k_h` | `standing_heavy_kick`（normal） | **12** |
| juri | `death_crest` | 死紋蹴 | 17 | `p_m` | `standing_medium_punch`（normal） | **6** |
| ken | `chin_buster` | 顎撥二連 | 11 | `p_m` | `standing_medium_punch`（normal） | **5** |
| ken | `triple_flash_kicks` | 閃光連脚 | 13 | `k_m` | `standing_medium_kick`（normal） | **8** |
| ken | `triple_flash_kicks_2hits` | 閃光連脚(2発止め) | 11 | `k_m` | `standing_medium_kick`（normal） | **8** |
| kimberly | `bushin_hellchain` | 武神獄鎖拳 | 15 | `p_l` | `standing_light_punch`（normal） | **5** |
| kimberly | `bushin_hellchain_3hits` | 武神獄鎖拳(3発止め) | 10 | `p_l` | `standing_light_punch`（normal） | **5** |
| kimberly | `bushin_hellchain_throw` | 武神獄鎖投げ | 15 | `p_l` | `standing_light_punch`（normal） | **5** |
| kimberly | `bushin_prism_strikes` | 武神天架拳 | 26 | `p_l` | `standing_light_punch`（normal） | **5** |
| kimberly | `bushin_prism_strikes_2hits` | 武神天架拳(2発止め) | 6 | `p_l` | `standing_light_punch`（normal） | **5** |
| kimberly | `bushin_prism_strikes_3hits` | 武神天架拳(3発止め) | 12 | `p_l` | `standing_light_punch`（normal） | **5** |
| kimberly | `bushin_tiger_fangs` | 武神虎連牙 | 10 | `p_m` | `standing_medium_punch`（normal） | **6** |
| lily | `desert_storm` | デザートストーム | 20 | `r plus p_h` | `desert_storm_1hits`（unique） | **16** |
| lily | `desert_storm_2hits` | デザートストーム(2発止め) | 20 | `r plus p_h` | `desert_storm_1hits`（unique） | **16** |
| luke | `double_impact` | ダブルインパクト | 11 | `r plus p_h` | `double_impact_1hit`（unique） | **16** |
| luke | `nose_breaker` | ノーズブレイカー | 9 | `d plus k_m` | `crouching_medium_kick`（normal） | **8** |
| luke | `snapback_combo` | スナップバックコンボ | 11 | `p_m` | `standing_medium_punch`（normal） | **9** |
| luke | `snapback_combo_2hits` | スナップバックコンボ(2発止め) | 12 | `p_m` | `standing_medium_punch`（normal） | **9** |
| luke | `snapback_combo_3hits` | スナップバックコンボ(3発止め) | 11 | `p_m` | `standing_medium_punch`（normal） | **9** |
| luke | `triple_impact` | トリプルインパクト | 10 | `p_l` | `standing_light_punch`（normal） | **7** |
| luke | `triple_impact_2hits` | トリプルインパクト(2発止め) | 8 | `p_l` | `standing_light_punch`（normal） | **7** |
| m_bison | `shadow_hammer` | シャドウハンマー | 22 | `p_m` | `standing_medium_punch`（normal） | **8** |
| m_bison | `shadow_spear` | シャドウスピア | 16 | `p_m` | `standing_medium_punch`（normal） | **8** |
| mai | `hien_ren_kyaku` | 飛燕連脚 | 10 | `k_l` | `standing_light_kick`（normal） | **4** |
| mai | `hien_ren_kyaku_2hits` | 飛燕連脚(2発止め) | 7 | `k_l` | `standing_light_kick`（normal） | **4** |
| mai | `hoshi_kujaku` | 星孔雀 | 9 | `l plus k_h` | `hoshi_kujaku_1hits`（unique） | **8** |
| manon | `a_terre` | ア・テール | 10 | `p_m` | `standing_medium_punch`（normal） | **7** |
| manon | `allonge` | アロンジェ | 4 | `d plus p_h` | `crouching_heavy_punch`（normal） | **10** |
| manon | `en_haut` | アン・オー | 14 | `l plus k_m` | `en_haut_1hit`（unique） | **10** |
| manon | `temps_lie` | タン・リエ | 5 | `p_h` | `standing_heavy_punch`（normal） | **10** |
| marisa | `falx_crusher` | ファルクスクラッシュ | 16 | `r plus k_h` | `falx_crusher_1hit`（unique） | **14** |
| marisa | `heavy_two_hitter` | ヘビィーワンツー | 24 | `p_h` | `standing_heavy_punch`（normal） | **12** |
| marisa | `light_two_hitter` | ライトワンツー | 14 | `p_l` | `standing_light_punch`（normal） | **6** |
| marisa | `malleus_breaker` | マレウスビート | 18 | `dr plus p_h` | `malleus_breaker_1hit`（unique） | **21** |
| marisa | `medium_two_hitter` | ミドルワンツー | 14 | `p_m` | `standing_medium_punch`（normal） | **7** |
| marisa | `novacula_swipe` | ノバキュラスワイプ | 11 | `r plus p_m` | `novacula`（unique） | **9** |
| marisa | `novacula_thrust` | ノバキュラシュート | 11 | `r plus p_m` | `novacula`（unique） | **9** |
| rashid | `rising_kick` | ライジング・キック | 13 | `p_m` | `standing_medium_punch`（normal） | **6** |
| ryu | `fuwa_triple_strike` | 不破三連撃 | 17 | `p_m` | `standing_medium_punch`（normal） | **6** |
| ryu | `fuwa_triple_strike_2hits` | 不破三連撃(2発止め) | 5 | `p_m` | `standing_medium_punch`（normal） | **6** |
| ryu | `high_double_strike` | 上段二連撃 | 9 | `p_h` | `standing_heavy_punch`（normal） | **10** |
| sagat | `middle_step_kick` | ステップミドルキック | 16 | `k_m` | `standing_medium_kick`（normal） | **11** |
| sagat | `tiger_rise` | タイガーライズ | 18 | `d plus p_m` | `crouching_medium_punch`（normal） | **7** |
| sagat | `tiger_slash` | タイガースラッシュ | 20 | `d plus p_m` | `crouching_medium_punch`（normal） | **7** |
| sagat | `tiger_sting` | タイガースティング | 16 | `p_h` | `standing_heavy_punch`（normal） | **15** |
| terry | `fire_kick` | ファイヤーキック | 13 | `d plus k_m` | `crouching_medium_kick`（normal） | **8** |
| terry | `jumping_knee` | ジャンプニーアタック | 24 | `p_m` | `standing_medium_punch`（normal） | **7** |
| terry | `jumping_lariat` | ジャンプラリアットパンチ | 24 | `p_m` | `standing_medium_punch`（normal） | **7** |
| terry | `passing_sway` | パッシングスウェー | 13 | `p_m` | `standing_medium_punch`（normal） | **7** |
| terry | `power_drive` | パワードライブ | 15 | `p_m` | `standing_medium_punch`（normal） | **7** |
| terry | `power_dunk` | パワーダンク | 18 | `p_m` | `standing_medium_punch`（normal） | **7** |
| terry | `power_shoot` | パワーシュート | 18 | `p_m` | `standing_medium_punch`（normal） | **7** |
| yasmine | `kidlat_na_hiwa` | キドラット・ナ・ヒワ | 8 | `p_l` | `standing_light_punch`（normal） | **5** |
| yasmine | `kumbinasyong_pampabagsak` | コンビナション・パムパバッグサ | 8 | `d plus k_m` | `crouching_medium_kick`（normal） | **8** |
| yasmine | `sunod_sunod_na_sipa` | スノスノッド・ナ・シパ | 16 | `k_m` | `standing_medium_kick`（normal） | **10** |
| yasmine | `sunod_sunod_na_sipa_2hits` | スノスノッド・ナ・シパ(2発止め) | 13 | `k_m` | `standing_medium_kick`（normal） | **10** |
| yasmine | `tatlong_hiwa` | タッロング・ヒワ | 12 | `p_m` | `standing_medium_punch`（normal） | **6** |

---

*以上。* **★次にターゲットコンボが増えたときは、§6-1 のアルゴリズムで同じように埋められる。** **★★ただしルールは実装へ組み込んでいない**（`§0.2` の設計を維持）**。⇒ 値の解決は 1 回限りのオフライン処理であり、実行時は列を読むだけである。**
