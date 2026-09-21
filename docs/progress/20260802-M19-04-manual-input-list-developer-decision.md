# M19-04 人手判断が必要な行の一覧（開発者判断記入用コピー）

| 項目 | 内容 |
|---|---|
| コピー元 | `docs/progress/M19-04-manual-input-list.md`（原本は変更しない） |
| コピーの目的 | 開発者が判断結果・保留・根拠をこのファイルへ直接記入しやすくする |
| 生成元 | 指示書 `docs/instructions/M19-04-frame-cost-columns.md` §4.7 / CHANGE-091 §2.3 |
| 生成時点 | マイグレ 000001〜000052 適用済みの clean DB（moves 総数 1028） |
| 補助列の出典 | `command` / `original_move_code` / `condition_ja` は DB に列が無いため `character_data/*.csv` から結合（`condition_ja` は 000018 で `raw_data` から除去済み、`original_move_code` は `original_move_id` へ解決されて投入される） |
| 並び順 | `character_code` 昇順 → `move_code` 昇順（差分が取れる安定ソート） |

> **このコピーへの記入は判断記録であり、CSV への転記そのものではない。** 下記「0. 最初に記入する欄」で全体方針を確定してから、各行の末尾セルへ値を記入する。
> **推測で埋めないこと。** このコピーでは未判断を空欄ではなく `保留` と明記してよい。実装へ反映するときは `保留` を空欄（UPDATE 対象外）として扱う。

## 0. 最初に記入する欄

### 0.1 記入者情報

| 項目 | 開発者記入欄 |
|---|---|
| 記入者 | plexiblinp |
| 記入日 | 20260802～ |
| ゲームバージョン | 2026.05.28 |
| 備考 | なし |

### 0.2 `chain_cancel_total` の扱い（先に1つ選択）

現在の文書間には、次の不整合がある。

- 指示書 `docs/instructions/M19-04-frame-cost-columns.md` **v1.1.0** §4.4.5 / §4.8 は、実測が完了済みで、値の正本を `character_data/chain-cancel-measurements.md` とし、`chain_cancel_total` を Phase 2・CSV入力の対象外としている。
- コピー元の本一覧と `docs/progress/M19-04-completion-report.md` は、10行を未実測・未記入として扱っている。

この不整合を推測で解消せず、開発者判断を記録する。

- [x] **A: 指示書 v1.1.0 を正とする。** §3 の10行は今回判断せず、実測資料と投入済みマイグレーションの整合を別途確認する。
- [ ] **B: §3 の10行は追加判断が必要。** 実測した値を本コピーへ記録する。ただし CSV へは転記せず、正本と実装への反映方法を先に整合させる。
- [ ] **C: その他。** 方針: 該当なし

選択: **A**（2026-08-02 確定・ボード D-137。不整合は見かけ上のもので、同じ「未実測」という語が別の母集団を指していた——指示書 v1.1.0 の主語は実測資料 v2.3.0 の確定ロースター、本一覧の主語は `chain_cancel_total IS NULL` の機械抽出。10 行の 10 キャラは全て `Stand LK` がロースター外であり、`Stand LK` を持つリリーだけが正しく 10 行から外れている。開発者の目視による陰性確認も済んでいる）

### 0.3 行ごとの記入規則

| 系統 | 記入できる値 | `保留` の意味 | 実装へ反映するときの扱い |
|---|---|---|---|
| `startup_basis` | `standalone` / `through` / `unknown` / `保留` | **`保留`**＝単独値か通し値かまだ判断していない（後日の消化対象）／**`unknown`**＝判断した結果、単独値とも通し値とも言えないと確定した（消化対象から外してよい） | `保留` も `unknown` も空欄のまま。UPDATEしない（DDL の既定値 `'unknown'` が残る） |
| `fastest_unreachable` | `true` / `false` / `保留` | 最速入力で地上相手へ到達できるか判断できない | `true` のみ backfill 対象。`false` は確認済み・既定値維持、`保留` は未判断 |
| `chain_cancel_total` | 正の整数 / `該当なし` / `保留` | 実測できていない | 0.2で B を選んだ場合のみ記入。反映前に正本・投入方法を整合させる |

- 根拠を残す場合は、末尾セルへ `through（対象技からの派生値）` のように値の後ろへ括弧書きする。
- 判断済みの行は空欄にしない。値が確定しない場合も `保留` または `unknown` と書き、未着手の空欄と区別する。
- **`保留` と `unknown` を書き分ける。** 「まだ見ていない・後で判断する」＝`保留`。「見たうえで、単独値とも通し値とも言えないと確定した」＝`unknown`。**実装上はどちらも UPDATE 対象外だが、`unknown` は再訪しなくてよい。**
- 一括判断をした場合も各行へ値を記入する。グループ単位のメモだけで行の判断を省略しない。

### 0.4 進捗チェック

| 系統 | キャラクター別件数 | 完了チェック |
|---|---|---|
| `startup_basis` | guile 21 / ingrid 4 / juri 9 / ken 18 / kimberly 25 / lily 17 / mai 32 / manon 12 / ryu 11 / terry 9 / zangief 2 | [ ] 160行すべて値または `保留` を記入 |
| `fastest_unreachable` | kimberly 4 / lily 1 / zangief 2 | [ ] 7行すべて値または `保留` を記入 |
| `chain_cancel_total` | guile / ingrid / juri / ken / kimberly / mai / manon / ryu / terry / zangief 各1 | [ ] 0.2の全体方針を確定（Bの場合は10行も記入） |

### 0.5 記入完了時の確認

- [ ] 0.2の `chain_cancel_total` 方針を1つ選んだ。
- [ ] 対象行の末尾セルに、許容値または `保留` が入っている。
- [ ] 推測値を入れていない。
- [ ] 実装反映時に、括弧内メモと `保留` / `unknown` を値として取り込まないことを確認した。
- [ ] `chain_cancel_total` を CSV へ転記しない方針との整合を確認した。

## 件数サマリ

| # | 系統 | 抽出条件 | 件数 |
|---|---|---|---:|
| 1 | `startup_basis` | `is_derived=1` かつ `category<>'rush_variant'` かつ `startup_basis='unknown'` | 160 |
| 2 | `fastest_unreachable` の **B 型** | `is_aerial=1` かつ `code` が `jumping_` を含まない | 7 |
| 3 | `chain_cancel_total` | `category='normal'` かつ 地上弱通常技 4 種 かつ `chain_cancel_total IS NULL` | 10 |

---

## 1. `startup_basis`（160 行）

**判断すること**: その行の `startup` が「単独で出したときの値」か「連携の中で出したときの通し値」か。
このコピーへの記入値は `standalone` / `through` / `unknown` / `保留` のいずれか（`unknown` と `保留` はいずれも実装反映時に空欄＝`unknown` のまま。ただし前者は判断済み・後者は未判断）。

> **★この列が答えるのは「値の由来」だけである。** 「空振りで出せるか」「単独で出せるか」「相手が空中にいるときだけ出せるか」といった**成立条件の話は、この列では表現しない**（`M19-DESIGN-07` §7 の列追加審査規約＝**事実列に第 2・第 3 の用途を載せない**）。**成立条件が特殊な技であっても、その行の `startup` が単独値なら `standalone` が正しい。**
>
> **よく出る 3 パターンと記入の目安**:
>
> | パターン | 例 | 記入 | 補足 |
> |---|---|---|---|
> | **空振りでは出ない target_combo**（ヒット／ガード時限定の派生） | guile `double_shot`・`recoil_cannon` | `standalone` | 格納値が単独値なら `standalone`。**空振りで出せないことは別の軸**で、この列には載せない |
> | **相手が空中にいるときだけ出せる target_combo** | ingrid `satelite_leap` | `standalone`（フレーム未入力なら `保留`） | **`startup` / `total` が空欄の行は判断材料が無いので `保留` でよい。ただし「フレーム未入力のため」と括弧書きで理由を残す**（後で「なぜ保留か」が分からなくなる） |
> | **派生元が複数ある技** | guile `sonic_cross_light` / `_medium` / `_heavy` / `_od` | 由来どおり | **親が複数あること自体は `move_derivations` が受け止める**（列 1 本にしない設計＝`M19-DESIGN-07` §3 の R5）。括弧書きで「派生元が複数」と残しておくと、後の親参照の付与で拾える |
>
> **注釈がなくて本表に出てきた行**（上記の 2 パターン目など）は、**判断できないのではなく、判断の前提が本表に無いだけ**である。**気づいたら括弧書きで理由を残すこと。** 次に同じ技を見る人の作業量が変わる。

| character_code | move_code | name_ja | category | is_derived | is_aerial | command | startup | total | original_move_code | condition_ja | 開発者判断: `standalone` / `through` / `unknown` / `保留` |
|---|---|---|---|---|---|---|---|---|---|---|---|
| guile | `double_shot` | ダブルバレット | target_combo | 1 | 0 | `d plus p_m chain d plus p_m` | 12 | 30 |  |  |　standalone, target_comboだが空振りでは出ない技 |
| guile | `drake_fang` | ドレイクファング | target_combo | 1 | 0 | `d plus k_m chain r plus p_m` | 20 | 43 |  |  | standalone, target_comboだが空振りでは出ない技 |
| guile | `perfect_timing_heavy_somersault_kick` | 【ジャスト】強サマーソルトキック | special | 1 | 0 | `charge_d u plus k_h` | 7 | 55 |  |  | standalone |
| guile | `perfect_timing_heavy_sonic_boom` | 【ジャスト】強ソニックブーム | special | 1 | 0 | `charge_l r plus p_h` | 10 | 40 |  |  | standalone |
| guile | `perfect_timing_heavy_sonic_cross` | 【ジャスト】強ソニッククロス | special | 1 | 0 | `r plus p_h` | 10 | 38 |  |  | standalone |
| guile | `perfect_timing_light_somersault_kick` | 【ジャスト】弱サマーソルトキック | special | 1 | 0 | `charge_d u plus k_l` | 5 | 51 |  |  | standalone |
| guile | `perfect_timing_light_sonic_boom` | 【ジャスト】弱ソニックブーム | special | 1 | 0 | `charge_l r plus p_l` | 10 | 40 |  |  | standalone |
| guile | `perfect_timing_light_sonic_cross` | 【ジャスト】弱ソニッククロス | special | 1 | 0 | `r plus p_l` | 10 | 38 |  |  | standalone |
| guile | `perfect_timing_medium_somersault_kick` | 【ジャスト】中サマーソルトキック | special | 1 | 0 | `charge_d u plus k_m` | 6 | 53 |  |  | standalone |
| guile | `perfect_timing_medium_sonic_boom` | 【ジャスト】中ソニックブーム | special | 1 | 0 | `charge_l r plus p_m` | 10 | 40 |  |  | standalone |
| guile | `perfect_timing_medium_sonic_cross` | 【ジャスト】中ソニッククロス | special | 1 | 0 | `r plus p_m` | 10 | 38 |  |  | standalone |
| guile | `phantom_cutter` | ファントムカッター | target_combo | 1 | 0 | `d plus k_h chain dr plus k_h` | 10 | 37 |  |  | standalone, target_comboだが空振りでは出ない技 |
| guile | `recoil_cannon` | リコイルキャノン | target_combo | 1 | 0 | `p_m chain l plus p_h` | 16 | 44 |  |  | standalone, target_comboだが空振りでは出ない技 |
| guile | `sonic_break_light` | ソニックブレイク | special | 1 | 0 | `` | 11 | 36 |  |  | standalone, スコープ外だが_lightがmove_codeについているのは誤りなので消さないといけない。ここにしか記録がないのでどこかで直す |
| guile | `sonic_break_od` | ODソニックブレイク | special | 1 | 0 | `p` | 11 | 35 |  |  | unknown, 扱いが難しいのでunknownでいい。 |
| guile | `sonic_cross_2_meter_od` | 【ジャスト】ODソニッククロス１ | special | 1 | 0 | `r plus p p or cond{（ODソニックブレイド中に）} r plus p` | 10 | 38 |  |  | standalone, 派生元が複数あるパターン。（弱中強のソニックブレイド） |
| guile | `sonic_cross_3_meter_od` | ODソニッククロス２ | special | 1 | 0 | `r plus p p` | 10 | 38 |  |  | 保留,　こちらは派生元がODソニックブレイドだけなのでthroughのフレームにすべきだが、いまはstandaloneのフレームを入力しており誤っている。それとコマンドがsonic_cross_2_meter_odと入れ替わっているので是正が必要。ODソニッククロス周りはmove_codeもおかしいので、見直しが必要。 |
| guile | `sonic_cross_heavy` | 強ソニッククロス | special | 1 | 0 | `r plus p_h` | 10 | 38 |  |  | standalone, 派生元が複数あるパターン（弱中強のソニックブレイド） |
| guile | `sonic_cross_light` | 弱ソニッククロス | special | 1 | 0 | `r plus p_l` | 10 | 38 |  |  | standalone, 派生元が複数あるパターン（弱中強のソニックブレイド） |
| guile | `sonic_cross_medium` | 中ソニッククロス | special | 1 | 0 | `r plus p_m` | 10 | 38 |  |  | standalone, 派生元が複数あるパターン（弱中強のソニックブレイド） |
| guile | `sonic_cross_od` | ODソニッククロス１ | special | 1 | 0 | `r plus p p or cond{（ODソニックブレイド中に）} r plus p` | 10 | 38 |  |  | standalone, 派生元が複数あるパターン。（弱中強のソニックブレイド） |
| ingrid | `glowing_touch` | グロータッチ | target_combo | 1 | 0 | `l k_m chain p_h` | 20 | 46 |  |  | standalone, target_comboだが空振りでは出ない技 |
| ingrid | `luminous_uppercut` | ルミナスアッパー | target_combo | 1 | 0 | `l p_h chain p_h` | 23 | 46 |  |  | standalone, target_comboだが空振りでは出ない技 |
| ingrid | `pretty_heel_kick` | エアリートス | target_combo | 1 | 0 | `p_m chain k_m` | 12 | 37 |  |  | standalone, target_comboだが空振りでは出ない技 |
| ingrid | `satelite_leap` | サテライトリープ | target_combo | 1 | 0 | `k_h chain k_h` |  |  |  |  | unknown, これは空中target_comboなのでフレームいらない |
| juri | `death_crest` | 死紋蹴 | target_combo | 1 | 0 | `p_m chain l plus p_h chain p_h` | 17 | 46 |  |  | standalone, target_comboだが空振りでは出ない技 |
| juri | `death_crest_2hits` | 死紋蹴(2発止め) | unique | 1 | 0 | `p_m chain l plus p_h` | 12 | 34 |  |  | standalone, target_comboだが空振りでは出ない技 |
| juri | `fuha_ankensatsu` | [風破]暗剣殺 | special | 1 | 0 | `d dr r plus k_m` | 24 | 46 |  |  | standalone |
| juri | `fuha_go_ohsatsu` | [風破]五黄殺 | special | 1 | 0 | `d dr r plus k_h` | 18 | 63 |  |  | standalone |
| juri | `fuha_sa1_sakkai_fuhazan` | [風破]SA1 殺界風破斬 | super_art | 1 | 0 | `d dr r d dr r plus k` | 7 | 201 |  |  | standalone |
| juri | `fuha_saihasho` | [風破]歳破衝 | special | 1 | 0 | `d dr r plus k_l` | 16 | 45 |  |  | standalone |
| juri | `sa2_feng_shui_engine_dash` | SA2 風水エンジン(突進版) | super_art | 1 | 0 | `p hold` | 9 | 45 |  |  | standalone |
| juri | `shiren_sen` | 死連閃 | special | 1 | 0 | `k` | 6 | 75 |  |  | standalone, 派生形の必殺技だが空振りではでない |
| juri | `shiren_sen_od` | OD死連閃 | special | 1 | 0 | `k` | 6 | 73 |  |  | standalone, 派生形の必殺技だが空振りではでない |
| ken | `chin_buster` | 顎撥二連 | target_combo | 1 | 0 | `p_m chain p_h` | 11 | 40 |  |  | standalone, target_comboだが空振りでは出ない技 |
| ken | `emergency_stop` | 急停止 | unique | 1 | 0 | `k_l` | 1 | 27 |  |  | through, ケンのunique技、Quick Dashから最速で |
| ken | `forward_step_kick` | 踏み込み前蹴り | unique | 1 | 0 | `k_h` | 21 | 44 |  |  | through, ケンのunique技、Quick Dashから最速で |
| ken | `gorai_axe_kick` | 轟雷落とし | special | 1 | 0 | `r plus k_m` | 18 | 40 |  |  | standalone, 弱中強の迅雷脚から派生できる技だが、この複雑な分岐入力が難しかったため、いったんstandaloneで入力 |
| ken | `gorai_axe_kick_od` | OD轟雷落とし | special | 1 | 0 | `r plus k_m` | 17 | 43 |  |  | standalone, OD迅雷脚からのみ派生できる技なので、throughで入力してもよかったはずだが、恐らく当時の混乱でstandaloneで入力 |
| ken | `kasai_thrust_kick` | 火砕蹴(OD風鎌蹴り派生) | special | 1 | 0 | `r plus k` | 15 | 46 |  |  | standalone, OD風鎌蹴りからのみ派生できる技なので、throughで入力してもよかったはずだが、恐らく当時の混乱でstandaloneで入力 |
| ken | `kasai_thrust_kick_during_od_gorai_axe_kick` | 火砕蹴(OD轟雷落とし派生) | special | 1 | 0 | `r plus k` | 11 | 42 |  |  | standalone, OD轟雷落としからのみ派生できる技なので、throughで入力してもよかったはずだが、恐らく当時の混乱でstandaloneで入力 |
| ken | `kasai_thrust_kick_during_od_senka_snap_kick` | 火砕蹴(OD閃火脚派生) | special | 1 | 0 | `r plus k` | 15 | 54 |  |  | standalone, OD閃火脚からのみ派生できる技なので、throughで入力してもよかったはずだが、恐らく当時の混乱でstandaloneで入力 |
| ken | `kazekama_shin_kick` | 風鎌蹴り | special | 1 | 0 | `r plus k_l` | 6 | 28 |  |  | standalone, 弱中強の迅雷脚から派生できる技だが、この複雑な分岐入力が難しかったため、いったんstandaloneで入力 |
| ken | `kazekama_shin_kick_od` | OD風鎌蹴り | special | 1 | 0 | `r plus k_l` | 6 | 28 |  |  | standalone, OD迅雷脚からのみ派生できる技なので、throughで入力してもよかったはずだが、恐らく当時の混乱でstandaloneで入力 |
| ken | `quick_dash_dragonlash_kick` | [奮迅脚]龍尾脚 | special | 1 | 0 | `r d dr plus k` | 20 | 58 |  |  | through, ケンのunique技、Quick Dashから最速で |
| ken | `quick_dash_shoryuken` | [奮迅脚]昇龍拳 | special | 1 | 0 | `r d dr plus p` | 19 | 77 |  |  | through, ケンのunique技、Quick Dashから最速で |
| ken | `quick_dash_tatsumaki_senpu_kyaku` | [奮迅脚]竜巻旋風脚 | special | 1 | 0 | `d dl l plus k` | 23 | 88 |  |  | through, ケンのunique技、Quick Dashから最速で |
| ken | `senka_snap_kick` | 閃火脚 | special | 1 | 0 | `r plus k_h` | 10 | 37 |  |  | standalone, 弱中強の迅雷脚から派生できる技だが、この複雑な分岐入力が難しかったため、いったんstandaloneで入力 |
| ken | `senka_snap_kick_od` | OD閃火脚 | special | 1 | 0 | `r plus k_h` | 10 | 33 |  |  | standalone, OD迅雷脚からのみ派生できる技なので、throughで入力してもよかったはずだが、恐らく当時の混乱でstandaloneで入力 |
| ken | `thunder_kick` | 紫電カカト落とし | unique | 1 | 0 | `k_m` | 29 | 51 |  |  | through, ケンのunique技、Quick Dashから最速で |
| ken | `triple_flash_kicks` | 閃光連脚 | target_combo | 1 | 0 | `k_m chain k_m chain k_h` | 13 | 43 |  |  | standalone, target_comboだが空振りでは出ない技 |
| ken | `triple_flash_kicks_2hits` | 閃光連脚(2発止め) | target_combo | 1 | 0 | `k_m chain k_m` | 11 | 39 |  |  | standalone, target_comboだが空振りでは出ない技 |
| kimberly | `arc_step` | 弧空 | special | 1 | 0 | `` | 21 | 46 |  |  | standalone, 自動発動の技なので密着距離からのactive/totalを記録 |
| kimberly | `arc_step_od` | OD弧空 | special | 1 | 0 | `` | 19 | 44 |  |  | standalone, 自動発動の技なので密着距離からのactive/totalを記録 |
| kimberly | `bushin_hellchain` | 武神獄鎖拳 | target_combo | 1 | 0 | `p_l chain p_m chain d plus p_h chain k_h` | 15 | 41 |  |  | standalone, target_comboだが空振りでは出ない技 |
| kimberly | `bushin_hellchain_3hits` | 武神獄鎖拳(3発止め) | target_combo | 1 | 0 | `p_l chain p_m chain d plus p_h` | 10 | 36 |  |  | standalone, target_comboだが空振りでは出ない技 |
| kimberly | `bushin_hellchain_throw` | 武神獄鎖投げ | target_combo | 1 | 0 | `p_l chain p_m chain d plus p_h chain d plus k_h` | 15 | 40 |  |  | standalone, target_comboだが空振りでは出ない技 |
| kimberly | `bushin_hojin_kick` | 武神鉾刃脚 | special | 1 | 0 | `k` | 13 | 44 |  |  | standalone, キンバリーのspecial技、Sprint→Arc Stepから最速で |
| kimberly | `bushin_hojin_kick_od` | OD武神鉾刃脚 | special | 1 | 0 | `k` | 13 | 44 |  |  | standalone, キンバリーのspecial技、OD Sprint→OD Arc Stepから最速で |
| kimberly | `bushin_izuna_otoshi` | 武神イズナ落とし | special | 1 | 0 | `p` | 13 | 58 |  |  | standalone, キンバリーのspecial技、Sprint→Arc Stepから最速で |
| kimberly | `bushin_izuna_otoshi_od` | OD武神イズナ落とし | special | 1 | 0 | `p` | 13 | 58 |  |  | standalone, キンバリーのspecial技、OD Sprint→OD Arc Stepから最速で |
| kimberly | `bushin_prism_strikes` | 武神天架拳 | target_combo | 1 | 0 | `p_l chain p_m chain p_h chain k_h` | 26 | 52 |  |  | standalone, target_comboだが空振りでは出ない技。totalは間違えているstartup 26, active 3, recovery 19なので47が正しい |
| kimberly | `bushin_prism_strikes_2hits` | 武神天架拳(2発止め) | target_combo | 1 | 0 | `p_l chain p_m` | 6 | 26 |  |  | standalone, target_comboだが空振りでは出ない技 |
| kimberly | `bushin_prism_strikes_3hits` | 武神天架拳(3発止め) | target_combo | 1 | 0 | `p_l chain p_m chain p_h` | 12 | 38 |  |  | standalone, target_comboだが空振りでは出ない技 |
| kimberly | `bushin_tiger_fangs` | 武神虎連牙 | target_combo | 1 | 0 | `p_m chain p_h` | 10 | 38 |  |  | standalone, target_comboだが空振りでは出ない技 |
| kimberly | `emergency_stop` | 急停止 | special | 1 | 0 | `p` | 22 | 22 |  |  | through, キンバリーのspecial技、Sprintから最速で |
| kimberly | `emergency_stop_od` | OD急停止 | special | 1 | 0 | `p` | 19 | 19 |  |  | through, キンバリーのspecial技、OD Sprintから最速で |
| kimberly | `neck_hunter` | 首狩り | special | 1 | 0 | `k_h` | 27 | 50 |  |  | through, キンバリーのspecial技、Sprintから最速で |
| kimberly | `neck_hunter_od` | OD首狩り | special | 1 | 0 | `k_h` | 23 | 46 |  |  | through, キンバリーのspecial技、OD Sprintから最速で |
| kimberly | `sa1_bushin_thunderous_beats` | SA1 武神乱拍子・雷譜 | super_art | 1 | 0 | `d dr r d dr r plus k hold` | 10 | 64 |  |  | standalone |
| kimberly | `shadow_slide` | 影すくい | special | 1 | 0 | `k_m` | 18 | 48 |  |  | through, キンバリーのspecial技、Sprintから最速で |
| kimberly | `shadow_slide_od` | OD影すくい | special | 1 | 0 | `k_m` | 16 | 46 |  |  | through, キンバリーのspecial技、OD Sprintから最速で |
| kimberly | `step_up_backward` | 矢来越え(後方) | unique | 1 | 1 | `ul` | 30 | 33 |  |  | standalone, キンバリーのUnique技、Hisen Kickからの派生。Hisen Kick空振りからは出せないのでセットプレイには使われないはず |
| kimberly | `step_up_forward` | 矢来越え(前方) | unique | 1 | 1 | `ur` | 30 | 33 |  |  | standalone, キンバリーのUnique技、Hisen Kickからの派生。Hisen Kick空振りからは出せないのでセットプレイには使われないはず |
| kimberly | `step_up_neutral` | 矢来越え(垂直) | unique | 1 | 1 | `u` | 30 | 33 |  |  | standalone, キンバリーのUnique技、Hisen Kickからの派生。Hisen Kick空振りからは出せないのでセットプレイには使われないはず |
| kimberly | `torso_cleaver` | 胴刎ね | special | 1 | 0 | `k_l` | 29 | 51 |  |  | through, キンバリーのspecial技、Sprintから最速で |
| kimberly | `torso_cleaver_od` | OD胴刎ね | special | 1 | 0 | `k_l` | 25 | 47 |  |  | through, キンバリーのspecial技、OD Sprintから最速で |
| lily | `condor_dive_follow_up` | コンドルダイブ(派生) | special | 1 | 0 | `` | 12 | 48 |  |  | standalone, 風纏版のノーマル、またはODコンドルダイブからの派生。なお後からみて名称見直しが必要かも。follow upや派生はインゲームが元だがわかりにくいので、他の技のように状況を説明する命名にした方が良さそう。複雑な派生を持つ技だが、空振りからはでず、セットプレイでは使わないのであんまり気にする必要はない。なおフレーム登録間違えてそう。startup/active/recovery/total=12/12/24/47が正しい。ダメージはあっていた。 |
| lily | `desert_storm` | デザートストーム | target_combo | 1 | 0 | `r plus p_h chain p_h chain p_h` | 20 | 61 |  |  | standalone, target_comboだが空振りでは出ない技 |
| lily | `desert_storm_2hits` | デザートストーム(2発止め) | target_combo | 1 | 0 | `r plus p_h chain p_h` | 20 | 48 |  |  | standalone, target_comboだが空振りでは出ない技 |
| lily | `double_arrow` | ダブルアロー | target_combo | 1 | 0 | `p_m chain p_m` |  |  |  | （ジャンプ中に） | unknown, これは空中target_comboなのでフレームいらない |
| lily | `windclad_condor_dive` | [風纏い]コンドルダイブ | special | 1 | 0 | `p p` | 26 | 60 |  |  | through, ジャンプから出るspecial、最速で出した場合 |
| lily | `windclad_heavy_condor_spire` | [風纏い]強コンドルスパイア | special | 1 | 0 | `d dr r plus k_h` | 17 | 59 |  |  | standalone |
| lily | `windclad_heavy_tomahawk_buster` | [風纏い]強トマホークバスター | special | 1 | 0 | `r d dr plus p_h` | 8 | 61 |  |  | standalone |
| lily | `windclad_light_condor_spire` | [風纏い]弱コンドルスパイア | special | 1 | 0 | `d dr r plus k_l` | 9 | 51 |  |  | standalone |
| lily | `windclad_light_tomahawk_buster` | [風纏い]弱トマホークバスター | special | 1 | 0 | `r d dr plus p_l` | 4 | 49 |  |  | standalone |
| lily | `windclad_medium_condor_spire` | [風纏い]中コンドルスパイア | special | 1 | 0 | `d dr r plus k_m` | 13 | 55 |  |  | standalone |
| lily | `windclad_medium_tomahawk_buster` | [風纏い]中トマホークバスター | special | 1 | 0 | `r d dr plus p_m` | 6 | 56 |  |  | standalone |
| lily | `windclad_od_condor_dive` | [風纏い]ODコンドルダイブ | special | 1 | 0 | `p p p` | 26 | 59 |  |  | through, ジャンプから出るspecial、最速で出した場合 |
| lily | `windclad_od_condor_dive_follow_up` | ODコンドルダイブ(派生) | special | 1 | 0 | `` | 12 | 48 |  |  | standalone, 風纏版のノーマル、またはODコンドルダイブからの派生。なお後からみて名称見直しが必要かも。follow upや派生はインゲームが元だがわかりにくいので、他の技のように状況を説明する命名にした方が良さそう。複雑な派生を持つ技だが、空振りからはでず、セットプレイでは使わないのであんまり気にする必要はない。なおフレーム登録間違えてそう。startup/active/recovery/total=12/10/24/45が正しい。ダメージはあっていた |
| lily | `windclad_od_condor_spire` | [風纏い]ODコンドルスパイア | special | 1 | 0 | `` | 9 | 46 |  |  | standalone |
| lily | `windclad_od_tomahawk_buster` | [風纏い]ODトマホークバスター | special | 1 | 0 | `r d dr plus p p` | 4 | 60 |  |  | standalone |
| lily | `windclad_sa2_soaring_thunderbird` | SA2 [風纏い]スカイサンダーバード | super_art | 1 | 0 | `d dr r d dr r plus k` | 15 | 104 |  |  | through, ジャンプから出るsuperarts、最速で出した場合 |
| lily | `windclad_sa2_thunderbird` | SA2 [風纏い]サンダーバード | super_art | 1 | 0 | `d dr r d dr r plus k` | 9 | 104 |  |  | standalone |
| mai | `flame_heavy_hishou_ryuuenjin` | [焔版]強飛翔龍炎陣 | special | 1 | 0 | `r d dr plus k_h` | 7 | 53 |  |  | standalone |
| mai | `flame_heavy_hissatsu_shinobi_bachi` | [焔版]強必殺忍蜂 | special | 1 | 0 | `d dr r plus k_h` | 18 | 68 |  |  | standalone |
| mai | `flame_heavy_kachousen` | [焔版]強花蝶扇 | special | 1 | 0 | `d dr r plus p_h` | 12 | 45 |  |  | standalone |
| mai | `flame_heavy_kachousen_holding` | [焔版]強花蝶扇（ホールド） | special | 1 | 0 | `d dr r plus p_h hold` | 32 | 62 |  |  | standalone |
| mai | `flame_heavy_ryuuenbu` | [焔版]強龍炎舞 | special | 1 | 0 | `d dl l plus p_h` | 14 | 48 |  |  | standalone |
| mai | `flame_light_hishou_ryuuenjin` | [焔版]弱飛翔龍炎陣 | special | 1 | 0 | `r d dr plus k_l` | 5 | 52 |  |  | standalone |
| mai | `flame_light_hissatsu_shinobi_bachi` | [焔版]弱必殺忍蜂 | special | 1 | 0 | `d dr r plus k_l` | 10 | 55 |  |  | standalone |
| mai | `flame_light_kachousen` | [焔版]弱花蝶扇 | special | 1 | 0 | `d dr r plus p_l` | 16 | 45 |  |  | standalone |
| mai | `flame_light_kachousen_holding` | [焔版]弱花蝶扇（ホールド） | special | 1 | 0 | `d dr r plus p_l hold` | 32 | 62 |  |  | standalone |
| mai | `flame_light_ryuuenbu` | [焔版]弱龍炎舞 | special | 1 | 0 | `d dl l plus p_l` | 14 | 35 |  |  | standalone |
| mai | `flame_medium_hishou_ryuuenjin` | [焔版]中飛翔龍炎陣 | special | 1 | 0 | `r d dr plus k_m` | 6 | 52 |  |  | standalone |
| mai | `flame_medium_hissatsu_shinobi_bachi` | [焔版]中必殺忍蜂 | special | 1 | 0 | `d dr r plus k_m` | 15 | 64 |  |  | standalone |
| mai | `flame_medium_kachousen` | [焔版]中花蝶扇 | special | 1 | 0 | `d dr r plus p_m` | 14 | 45 |  |  | standalone |
| mai | `flame_medium_kachousen_holding` | [焔版]中花蝶扇（ホールド） | special | 1 | 0 | `d dr r plus p_m hold` | 32 | 62 |  |  | standalone |
| mai | `flame_medium_ryuuenbu` | [焔版]中龍炎舞 | special | 1 | 0 | `d dl l plus p_m` | 14 | 47 |  |  | standalone |
| mai | `flame_midare_kachousen` | [焔版]乱れ花蝶扇 | special | 1 | 0 | `r plus p` | 27 | 95 |  |  | standalone, [焔版]OD花蝶扇からの派生のように見えるが、長押しした時に別の技になると捉えた方がいい特殊パターンである事がわかった。なおstartupを間違えており28が正しい。totalも96になる。 |
| mai | `flame_musasabi_no_mai` | [焔版]ムササビの舞 | special | 1 | 0 | `d dl l plus p` | 32 | 62 |  |  | standalone |
| mai | `flame_od_hishou_ryuuenjin` | [焔版]OD飛翔龍炎陣 | special | 1 | 0 | `r d dr plus k k` | 6 | 57 |  |  | standalone |
| mai | `flame_od_hissatsu_shinobi_bachi` | [焔版]OD必殺忍蜂 | special | 1 | 0 | `d dr r plus k k` | 14 | 77 |  |  | standalone |
| mai | `flame_od_kachousen` | [焔版]OD花蝶扇 | special | 1 | 0 | `d dr r plus p p` | 12 | 42 |  |  | standalone |
| mai | `flame_od_kachousen_holding` | [焔版]OD花蝶扇（ホールド） | special | 1 | 0 | `d dr r plus p p hold` | 28 | 58 |  |  | standalone |
| mai | `flame_od_musasabi_no_mai` | [焔版]ODムササビの舞 | special | 1 | 0 | `d dl l plus p p` | 32 | 62 |  |  | standalone |
| mai | `flame_od_ryuuenbu` | [焔版]OD龍炎舞 | special | 1 | 0 | `d dl l plus p p` | 16 | 62 |  |  | standalone |
| mai | `flame_sa1_kagerou_no_mai` | [焔版]SA1 陽炎の舞 | super_art | 1 | 0 | `d dr r d dr r plus p` | 6 | 141 |  |  | standalone |
| mai | `flame_sa2_air_chou_hissatsu_shinobi_bachi` | [焔版]SA2 空中超必殺忍蜂 | super_art | 1 | 0 | `d dr r d dr r plus k` | 12 | 97 |  |  | through, ジャンプから出るsuperarts、最速で出した場合 |
| mai | `flame_sa2_chou_hissatsu_shinobi_bachi` | [焔版]SA2 超必殺忍蜂 | super_art | 1 | 0 | `d dr r d dr r plus k` | 7 | 73 |  |  | standalone |
| mai | `hien_ren_kyaku` | 飛燕連脚 | target_combo | 1 | 0 | `k_l chain k_l chain k_l` | 10 | 39 |  |  | standalone, target_comboだが空振りでは出ない技 |
| mai | `hien_ren_kyaku_2hits` | 飛燕連脚(2発止め) | target_combo | 1 | 0 | `k_l chain k_l` | 7 | 28 |  |  | standalone, target_comboだが空振りでは出ない技 |
| mai | `hoshi_kujaku` | 星孔雀 | target_combo | 1 | 0 | `l plus k_h chain k_h` | 9 | 58 |  |  | standalone, target_comboだが空振りでは出ない技 |
| mai | `midare_kachousen` | 乱れ花蝶扇 | special | 1 | 0 | `r plus p` | 27 | 95 |  |  | standalone, OD花蝶扇からの派生のように見えるが、長押しした時に別の技になると捉えた方がいい特殊パターンである事がわかった。なおstartupを間違えており28が正しい。totalも96になる。 |
| mai | `musasabi_no_mai` | ムササビの舞 | special | 1 | 0 | `d dl l plus p` | 32 | 62 |  |  | through, ジャンプから出るspecial、最速で出した場合 |
| mai | `musasabi_no_mai_od` | ODムササビの舞 | special | 1 | 0 | `d dl l plus p p` | 32 | 62 |  |  | through, ジャンプから出るspecial、最速で出した場合 |
| manon | `a_terre` | ア・テール | target_combo | 1 | 0 | `p_m chain k_m` | 10 | 28 |  |  | standalone, target_comboだが空振りでは出ない技  |
| manon | `allonge` | アロンジェ | target_combo | 1 | 0 | `d plus p_h chain p_h` | 4 | 33 |  |  | standalone, target_comboだが空振りでは出ない技 |
| manon | `en_haut` | アン・オー | target_combo | 1 | 0 | `l plus k_m chain k_m` | 14 | 39 |  |  | standalone, target_comboだが空振りでは出ない技 |
| manon | `grand_fouette_heavy` | 強グラン・フェッテ | special | 1 | 0 | `` | 29 | 56 |  |  | through, 強ランヴェルセから最速 |
| manon | `grand_fouette_light` | 弱グラン・フェッテ | special | 1 | 0 | `` | 27 | 54 |  |  | through, 弱ランヴェルセから最速 |
| manon | `grand_fouette_medium` | 中グラン・フェッテ | special | 1 | 0 | `` | 28 | 55 |  |  | through,　中ランヴェルセから最速  |
| manon | `grand_fouette_od` | ODグラン・フェッテ | special | 1 | 0 | `k` | 25 | 52 |  |  | through,　ODランヴェルセから最速 |
| manon | `renverse_feint_heavy` | 強ランヴェルセ(フェイント) | special | 1 | 0 | `` | 3 | 33 |  |  | standalone, ランヴェルセとコマンドが被っているからis_derived=trueだが、別技扱い |
| manon | `renverse_feint_light` | 弱ランヴェルセ(フェイント) | special | 1 | 0 | `` | 3 | 31 |  |  | standalone, ランヴェルセとコマンドが被っているからis_derived=trueだが、別技扱い |
| manon | `renverse_feint_medium` | 中ランヴェルセ(フェイント) | special | 1 | 0 | `` | 3 | 32 |  |  | standalone, ランヴェルセとコマンドが被っているからis_derived=trueだが、別技扱い |
| manon | `renverse_feint_od` | ODランヴェルセ(フェイント) | special | 1 | 0 | `` | 4 | 33 |  |  | standalone, ランヴェルセとコマンドが被っているからis_derived=trueだが、別技扱い |
| manon | `temps_lie` | タン・リエ | target_combo | 1 | 0 | `p_h chain p_h` | 5 | 28 |  |  | standalone, target_comboだが空振りでは出ない技。なお入力ミスあり。startup/active/recovery/total=5/5/17/26が正しい |
| ryu | `denjin_charge_hadoken` | [電刃錬気]波動拳 | special | 1 | 0 | `d dr r plus p` | 12 | 40 |  |  | standalone |
| ryu | `denjin_charge_hashogeki` | [電刃錬気]波掌撃 | special | 1 | 0 | `d dl l plus p` | 20 | 44 |  |  | standalone |
| ryu | `denjin_charge_od_hadoken` | [電刃錬気]OD波動拳 | special | 1 | 0 | `d dr r plus p p` | 12 | 38 |  |  | standalone |
| ryu | `denjin_charge_od_hashogeki` | [電刃錬気]OD波掌撃 | special | 1 | 0 | `d dl l plus p p` | 18 | 42 |  |  | standalone |
| ryu | `denjin_charge_sa1_shinku_hadoken` | [電刃錬気]SA1 真空波動拳 | super_art | 1 | 0 | `d dr r d dr r plus p` | 7 | 89 |  |  | standalone |
| ryu | `denjin_charge_sa2_shin_hashogeki_lv1` | [電刃錬気]SA2 真波掌撃(Lv1) | super_art | 1 | 0 | `d dl l d dl l plus p` | 12 | 56 |  |  | standalone |
| ryu | `denjin_charge_sa2_shin_hashogeki_lv2` | [電刃錬気]SA2 真波掌撃(Lv2) | super_art | 1 | 0 | `d dl l d dl l plus p` | 18 | 62 |  |  | standalone |
| ryu | `denjin_charge_sa2_shin_hashogeki_lv3` | [電刃錬気]SA2 真波掌撃(Lv3) | super_art | 1 | 0 | `d dl l d dl l plus p` | 50 | 94 |  |  | standalone |
| ryu | `fuwa_triple_strike` | 不破三連撃 | target_combo | 1 | 0 | `p_m chain k_l chain k_h` | 17 | 40 |  |  | standalone, target_comboだが空振りでは出ない技。 |
| ryu | `fuwa_triple_strike_2hits` | 不破三連撃(2発止め) | target_combo | 1 | 0 | `p_m chain k_l` | 5 | 23 |  |  | standalone, target_comboだが空振りでは出ない技。 |
| ryu | `high_double_strike` | 上段二連撃 | target_combo | 1 | 0 | `p_h chain k_h` | 9 | 32 |  |  | standalone, target_comboだが空振りでは出ない技。 |
| terry | `fire_kick` | ファイヤーキック | target_combo | 1 | 0 | `d plus k_m chain d plus k_h` | 13 | 42 |  |  | standalone, target_comboだが空振りでは出ない技。 |
| terry | `jumping_knee` | ジャンプニーアタック | target_combo | 1 | 0 | `p_m chain k_m chain k_m` | 24 | 45 |  |  | standalone, target_comboだが空振りでは出ない技。 |
| terry | `jumping_lariat` | ジャンプラリアットパンチ | target_combo | 1 | 0 | `p_m chain k_m chain p_m` | 24 | 43 |  |  | standalone, target_comboだが空振りでは出ない技。 |
| terry | `passing_sway` | パッシングスウェー | target_combo | 1 | 0 | `p_m chain k_m` | 13 | 52 |  |  | standalone, target_comboだが空振りでは出ない技。 |
| terry | `power_drive` | パワードライブ | target_combo | 1 | 0 | `p_m chain p_h` | 15 | 39 |  |  | standalone, target_comboだが空振りでは出ない技。 |
| terry | `power_dunk` | パワーダンク | target_combo | 1 | 0 | `p_m chain k_h chain k_h` | 18 | 80 |  |  |  standalone, target_comboだが空振りでは出ない技。|
| terry | `power_shoot` | パワーシュート | target_combo | 1 | 0 | `p_m chain k_h` | 18 | 51 |  |  | standalone, target_comboだが空振りでは出ない技。 |
| terry | `sa2_triple_geyser` | SA2 トリプルゲイザー | super_art | 1 | 0 | `p p` | 14 | 139 |  |  | standalone, 特殊なsuperarts。ただ絶対にセットプレイでは使われないのであんまり気にしなくていい |
| terry | `sa2_twin_geyser` | SA2 ツインゲイザー | super_art | 1 | 0 | `p p` | 22 | 70 |  |  | standalone, 特殊なsuperarts。ただ絶対にセットプレイでは使われないのであんまり気にしなくていい |
| zangief | `sa2_cyclone_lariat_back` | SA2 サイクロンラリアット(後ろ) | super_art | 1 | 0 | `d dr r d dr r plus p` | 18 | 171 |  |  | standalone |
| zangief | `sa2_cyclone_lariat_holding` | SA2 サイクロンラリアット(ホールド) | super_art | 1 | 0 | `d dr r d dr r plus p` | 18 | 171 |  |  | standalone |

## 2. `fastest_unreachable` の B 型（7 行）

**判断すること**: 単独で最速入力して地上の相手に当てられるか。当てられない（＝スカラー S の target にできない）なら `true`、当てられることを確認できたら `false`、判断できなければ `保留`。
C 型（通常ジャンプ攻撃）は 000050 で機械付与済みのため本表には出ない。

| character_code | move_code | name_ja | category | is_derived | is_aerial | command | startup | total | original_move_code | condition_ja | 開発者判断: `true` / `false` / `非攻撃技` / `保留` |
|---|---|---|---|---|---|---|---|---|---|---|---|
| kimberly | `elbow_drop` | 肘落とし | unique | 0 | 1 | `d plus p_m` | 27 | 47 |  |  | true |
| kimberly | `step_up_backward` | 矢来越え(後方) | unique | 1 | 1 | `ul` | 30 | 33 |  |  | 非攻撃技（旧記入: false、非攻撃技。D-207 により振り替え） |
| kimberly | `step_up_forward` | 矢来越え(前方) | unique | 1 | 1 | `ur` | 30 | 33 |  |  | 非攻撃技（旧記入: false、非攻撃技。D-207 により振り替え） |
| kimberly | `step_up_neutral` | 矢来越え(垂直) | unique | 1 | 1 | `u` | 30 | 33 |  |  | 非攻撃技（旧記入: false、非攻撃技。D-207 により振り替え） |
| lily | `great_spin` | グレートスピン | unique | 0 | 1 | `d plus p_h` | 9 | 48 |  |  | true（旧記入: false、ただしこれは通常のジャンプ攻撃的に扱うべき。D-207 により是正）。実質は通常ジャンプ攻撃であり、C 型の機械付与が `jumping_` の部分一致で拾えていない行 |
| zangief | `flying_body_press` | フライングボディプレス | unique | 0 | 1 | `d plus p_h` | 9 | 52 |  |  | true（旧記入: false、ただしこれは通常のジャンプ攻撃的に扱うべき。D-207 により是正）。実質は通常ジャンプ攻撃であり、C 型の機械付与が `jumping_` の部分一致で拾えていない行 |
| zangief | `flying_headbutt` | フライングヘッドバット | unique | 0 | 1 | `u plus p_h` | 8 | 47 |  |  | true（旧記入: false、ただしこれは通常のジャンプ攻撃的に扱うべき。D-207 により是正）。実質は通常ジャンプ攻撃であり、C 型の機械付与が `jumping_` の部分一致で拾えていない行 |

## 3. `chain_cancel_total`（10 行）

**判断すること**: 0.2で B を選んだ場合のみ、連打キャンセルがつながるかを確認する。つながるなら**実測値**、つながらないなら `該当なし`、実測できなければ `保留` を入れる。

> **絞り込み条件について**: 実測資料 `character_data/chain-cancel-measurements.md` v2.3.0 の確定ロースターは
> `Stand LP` / `Stand LK` / `Crouch LP` / `Crouch LK` の地上弱通常技 4 種のみである。seed 済み 11 キャラの
> 該当行は 44 行で、うち 34 行は実測済み（000052 で投入済み）。残る 10 行を本表に出している。
> **開発者確認済み**（2026-08-01）。なお必殺技に一部対象がある可能性は開発者が並行調査中のため本表には含めない。
>
> **★「total − 4」等の規則で埋めてはならない。** 実測資料 §1 が、同一の単発値が最大 3 通りの実消費に
> 割れることを多重検算つきで示している（例: `5/3/8/15` が 11 / 11 / 12 / 13）。**値は実測すること。**
> このコピーでは、つながらないことを確認した技を `該当なし` と記録する。実装へ反映するときは空欄のままにする（`chain_cancel_total` が NULL であること自体が「チェーングループ員でない」の意味）。

| character_code | move_code | name_ja | category | is_derived | is_aerial | command | startup | total | original_move_code | condition_ja | 開発者判断: 正の整数 / `該当なし` / `保留` |
|---|---|---|---|---|---|---|---|---|---|---|---|
| guile | `standing_light_kick` | 立ち弱K | normal | 0 | 0 | `k_l` | 5 | 18 |  |  | 該当なし（D-137・A。実測資料 v2.3.0 の確定ロースター外＝陰性確認済み） |
| ingrid | `standing_light_kick` | 立ち弱K | normal | 0 | 0 | `k_l` | 5 | 18 |  |  | 該当なし（D-137・A） |
| juri | `standing_light_kick` | 立ち弱K | normal | 0 | 0 | `k_l` | 5 | 16 |  |  | 該当なし（D-137・A） |
| ken | `standing_light_kick` | 立ち弱K | normal | 0 | 0 | `k_l` | 5 | 18 |  |  | 該当なし（D-137・A） |
| kimberly | `standing_light_kick` | 立ち弱K | normal | 0 | 0 | `k_l` | 5 | 18 |  |  | 該当なし（D-137・A） |
| mai | `standing_light_kick` | 立ち弱K | normal | 0 | 0 | `k_l` | 4 | 14 |  |  | 該当なし（D-137・A） |
| manon | `standing_light_kick` | 立ち弱K | normal | 0 | 0 | `k_l` | 5 | 18 |  |  | 該当なし（D-137・A） |
| ryu | `standing_light_kick` | 立ち弱K | normal | 0 | 0 | `k_l` | 5 | 18 |  |  | 該当なし（D-137・A） |
| terry | `standing_light_kick` | 立ち弱K | normal | 0 | 0 | `k_l` | 5 | 18 |  |  | 該当なし（D-137・A） |
| zangief | `standing_light_kick` | 立ち弱K | normal | 0 | 0 | `k_l` | 7 | 25 |  |  | 該当なし（D-137・A） |

---

*以上。M19-04（CHANGE-091）§4.7 の成果物 7を基にした、開発者判断記入用コピー。原本は変更していない。*
