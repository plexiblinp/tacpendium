# M19-PHASE2 完了報告

| 項目 | 内容 |
|------|------|
| 対象 | **M19-PHASE2**（`docs/instructions/M19-PHASE2-instruction-v1.0.0.md` v1.0.0） |
| 日付 | 2026-08-07 |
| 消費した連番 | **`000064`（①）／ `000065`（②）**（着手時に `ls migrations/` を実査し末尾 `000063` を確認して払い出した。予約帯は作っていない） |
| CHANGE | **新規起票なし**（D-227 に対応する CHANGE-093 が registry v1.100.0 で同日払い出し済み。§9-6） |
| 関連 | レビュー `docs/progress/m19-phase2-review.md` ／ 設計伝達レポート `docs/handover/design-reports/20260807-m19-phase2-design-exceptions.md` |

---

## 0. 結論

**マイグレを 2 本に分けた**（D-223）。**①（`000064`）は既存のフレーム列を 1 バイトも変えず**、`startup_basis` 293 行・`fastest_unreachable` 35 行・`move_derivations` 63 対を投入し、D-187 の 153 行を `unknown` へ戻した。**②（`000065`）は契約 F-2 を条件付き解除して 21 行を突合し、実際に値が動く 20 行を是正した**（三点更新＝CSV 正本 → golden 再生成 → 追随マイグレ）。

**canary は①の直後で 1 行も動かず（全数射影が v63 と byte 一致）、②の直後で 3532 節点が動いた。説明できない差分は 0 件。**

`go test ./...` 全パッケージ green ／ `go run ./cmd/seedgen -check` OK（golden 10 stem）／ `go vet`・`gofmt -l internal/ cmd/` 出力なし ／ `internal/service/` と `internal/seedgen/` の diff は **0**。

---

## 1. 着手前確認（指示書 §3 の 10 項目）— 実クエリ・実ファイルで実測

| # | 項目 | 実測 |
|---|---|---|
| 1 | マイグレ連番 | 末尾 `000063_correct_moves_data_m1904c` → **`000064` / `000065`** を払い出し |
| 2 | `startup_basis` 投入対象 308 行の内訳 | §2 のとおり（**6 分類を別々に計数**） |
| 3 | `fastest_unreachable = true` の全数 | **35 行**（B 型一覧 8 ＋ §1.4 名指し 27）。§3 |
| 4 | D-187 の 153 行 | `startup IS NULL AND startup_basis <> 'unknown'` ＝ **153**（全行 `is_derived = 0`。移動 system move 11 キャラ 99 ＋ 第三波 54）。**指示書の 153 と一致** |
| 5 | `move_derivations` の現行と追加 | 現行 **9 行**（zangief・`000061`）／追加 **63 対（子 37 行）**。シャドウライズは `shadow_rise_light` / `_medium` / `_heavy` / `_od` の 4 行（`total` 53/58/63/55 ＝ D-226 の記述と一致） |
| 6 | ②の 21 行の現行値 | §5 に是正前後を対で掲載。**実際に動くのは 20 行** |
| 7 | canary の現行値 | `wantLegacyJumpHeavy=37` / `wantOptionC=39` / `wantUniqueAerial=16`（`internal/service/punishfinder/service_test.go:387-391`）。着手前に実行して green を確認 |
| 8 | CSV の現状 | 17 本・データ行 **1479**・ヘッダ 23 列で全ファイル一致。**3 新列は 1479 行すべて空欄**。SHA256 を採取して前後突合 |
| 9 | `generate_test.go` の「SQL 非投入」テスト | green（`TestGenerate_FrameCostColumnsNotEmitted`）。**変えていない** |
| 10 | 改名 3 件 | HEAD で指示書 §2.5 のとおり。`move_code` と `name_ja` の対で照合 |

**★想定と食い違った 4 点は着手前に報告し、開発者裁定を得てから実装に入った**（§9-1〜§9-4）。

---

## 2. 【§6.2-1】`startup_basis` の投入内訳（キャラ別）

| character | standalone | through | 投入計 | 投入しない | 内訳 |
|---|---:|---:|---:|---:|---|
| guile | 19 | 0 | 19 | 2 | Phase2 対象外×1, 記入値=unknown×1 |
| ingrid | 3 | 0 | 3 | 1 | D-187×1 |
| jamie | 38 | 20 | 58 | 1 | 記入値=空欄×1 |
| jp | 8 | 0 | 8 | 0 | — |
| juri | 9 | 0 | 9 | 0 | — |
| ken | 3 | 12 | 15 | 3 | D-223/§1.6×3 |
| kimberly | 17 | 8 | 25 | 0 | — |
| lily | 13 | 3 | 16 | 1 | D-187×1 |
| luke | 12 | 5 | 17 | 0 | — |
| m_bison | 13 | 2 | 15 | 4 | D-187×1, D-226×2, 記入値=unknown×1 |
| mai | 29 | 3 | 32 | 0 | — |
| manon | 8 | 4 | 12 | 0 | — |
| marisa | 14 | 6 | 20 | 3 | D-187×3 |
| rashid | 17 | 5 | 22 | 1 | D-187×1 |
| ryu | 11 | 0 | 11 | 0 | — |
| terry | 9 | 0 | 9 | 0 | — |
| zangief | 2 | 0 | 2 | 0 | — |
| **計** | **225** | **68** | **293** | **16** | |

**記入値の 6 分類（★`unknown` / `保留` / `非攻撃技` / 空欄 を同一視しない＝D-138 / D-207）**

| 記入値 | 件数 | 投入 |
|---|---:|---|
| `standalone` | 238 | する（裁定除外分を引いて 225） |
| `through` | 62（うち一次源の綴りが `throgh` の 2 行を含む） | する（68 ＝ ken 6 行の格上げを含む） |
| `unknown` | 5 | **しない**（既定値のまま） |
| `保留` | 1 | **しない**（guile。M19-04c が `000063` で確定済みのため Phase 2 の母数外） |
| 空欄 | 1 | **しない**（jamie `drink_level_4_senei_kick`） |
| `非攻撃技` | **0**（`startup_basis` の記入欄には出現しない。B 型の記入欄にのみ 8 件） | — |
| 「要相談」 | 2 | **しない**（m_bison。相談結果が D-226） |

投入 **293** ＝ `standalone` 238 ＋ `through` 62 − 裁定による除外 7（ken ノーマル版 3 ＋ `startup IS NULL` の 4）。

---

## 3. 【§6.2-2】`fastest_unreachable = 1` の全数リスト（35 行）

| # | character | move_code | name_ja | 出所 |
|---:|---|---|---|---|
| 1 | ingrid | `solar_burst_lv1_forward` | ソーラーフレア(Lv1)（前方） | §1.4 名指し |
| 2 | ingrid | `solar_burst_lv1_forward_od` | ODソーラーフレア(Lv1)（前方） | §1.4 名指し |
| 3 | ingrid | `solar_burst_lv1_neutral` | ソーラーフレア(Lv1)（垂直） | §1.4 名指し |
| 4 | ingrid | `solar_burst_lv1_neutral_od` | ODソーラーフレア(Lv1)（垂直） | §1.4 名指し |
| 5 | ingrid | `solar_burst_lv2_forward` | ソーラーフレア(Lv2)（前方） | §1.4 名指し |
| 6 | ingrid | `solar_burst_lv2_forward_od` | ODソーラーフレア(Lv2)（前方） | §1.4 名指し |
| 7 | ingrid | `solar_burst_lv2_neutral` | ソーラーフレア(Lv2)（垂直） | §1.4 名指し |
| 8 | ingrid | `solar_burst_lv2_neutral_od` | ODソーラーフレア(Lv2)（垂直） | §1.4 名指し |
| 9 | ingrid | `solar_burst_lv3_forward` | ソーラーフレア(Lv3)（前方） | §1.4 名指し |
| 10 | ingrid | `solar_burst_lv3_forward_od` | ODソーラーフレア(Lv3)（前方） | §1.4 名指し |
| 11 | ingrid | `solar_burst_lv3_neutral` | ソーラーフレア(Lv3)（垂直） | §1.4 名指し |
| 12 | ingrid | `solar_burst_lv3_neutral_od` | ODソーラーフレア(Lv3)（垂直） | §1.4 名指し |
| 13 | jamie | `luminous_dive_kick_heavy` | 強無影蹴 | §1.4 名指し |
| 14 | jamie | `luminous_dive_kick_light` | 弱無影蹴 | §1.4 名指し |
| 15 | jamie | `luminous_dive_kick_medium` | 中無影蹴 | §1.4 名指し |
| 16 | jamie | `luminous_dive_kick_od` | OD無影蹴 | §1.4 名指し |
| 17 | juri | `shiku_sen` | 疾空閃 | §1.4 名指し |
| 18 | juri | `shiku_sen_od` | OD疾空閃 | §1.4 名指し |
| 19 | kimberly | `aerial_bushin_senpukyaku` | 空中武神旋風脚 | §1.4 名指し |
| 20 | kimberly | `aerial_bushin_senpukyaku_od` | OD空中武神旋風脚 | §1.4 名指し |
| 21 | kimberly | `elbow_drop` | 肘落とし | B型一覧 |
| 22 | lily | `condor_dive` | コンドルダイブ | §1.4 名指し |
| 23 | lily | `condor_dive_od` | ODコンドルダイブ | §1.4 名指し |
| 24 | lily | `great_spin` | グレートスピン | B型一覧 |
| 25 | lily | `sa2_soaring_thunderbird` | SA2 スカイサンダーバード | §1.4 名指し |
| 26 | lily | `windclad_condor_dive` | [風纏い]コンドルダイブ | §1.4 名指し |
| 27 | lily | `windclad_od_condor_dive` | [風纏い]ODコンドルダイブ | §1.4 名指し |
| 28 | lily | `windclad_sa2_soaring_thunderbird` | SA2 [風纏い]スカイサンダーバード | §1.4 名指し |
| 29 | marisa | `caelum_arc` | カエルムアーク | B型一覧 |
| 30 | marisa | `caelum_arc_holding` | 【ホールド】カエルムアーク | B型一覧 |
| 31 | rashid | `aerial_shot` | エリアルシュート | B型一覧 |
| 32 | rashid | `blitz_strike` | ブリッツストライク | B型一覧 |
| 33 | ryu | `aerial_tatsumaki_senpu_kyaku_od` | OD空中竜巻旋風脚 | §1.4 名指し |
| 34 | zangief | `flying_body_press` | フライングボディプレス | B型一覧 |
| 35 | zangief | `flying_headbutt` | フライングヘッドバット | B型一覧 |

**投入しなかった `非攻撃技` 8 行**（★`false` と DB 状態は同じだが意味が違う＝D-207）: kimberly `step_up_backward` / `step_up_forward` / `step_up_neutral` ／ rashid `buffed_jump_back` / `buffed_jump_forward` / `buffed_jump_neutral` / `front_flip` / `wall_jump`。

**§1.4 の 13 系統で `false` 判定だった 14 行**: rashid `arabian_skyhigh_{light,medium,heavy,od}` ／ luke `aerial_flash_knuckle` / `_od` / `_holding` ／ ingrid `solar_burst_light_neutral` / `_forward` ／ ken `aerial_tatsumaki_senpu_kyaku` / `_od` ／ kimberly `nue_twister` / `_od` ／ ryu `aerial_tatsumaki_senpu_kyaku`。

---

## 4. 【§6.2-4】`move_derivations` の追加分の全数（63 対 / 子 37 行）

| # | character | 子 `move_code` | 親 `move_code` | 一次源の文言 |
|---:|---|---|---|---|
| 1 | guile | `perfect_timing_sonic_cross_od` | `sonic_blade_light` | 同上（記入用コピー上は sonic_cross_2_meter_od） |
| 2 | guile | `perfect_timing_sonic_cross_od` | `sonic_blade_medium` | 同上（記入用コピー上は sonic_cross_2_meter_od） |
| 3 | guile | `perfect_timing_sonic_cross_od` | `sonic_blade_heavy` | 同上（記入用コピー上は sonic_cross_2_meter_od） |
| 4 | guile | `sonic_cross_heavy` | `sonic_blade_light` | 同上 |
| 5 | guile | `sonic_cross_heavy` | `sonic_blade_medium` | 同上 |
| 6 | guile | `sonic_cross_heavy` | `sonic_blade_heavy` | 同上 |
| 7 | guile | `sonic_cross_light` | `sonic_blade_light` | 派生元が複数あるパターン（弱中強のソニックブレイド） |
| 8 | guile | `sonic_cross_light` | `sonic_blade_medium` | 派生元が複数あるパターン（弱中強のソニックブレイド） |
| 9 | guile | `sonic_cross_light` | `sonic_blade_heavy` | 派生元が複数あるパターン（弱中強のソニックブレイド） |
| 10 | guile | `sonic_cross_medium` | `sonic_blade_light` | 同上 |
| 11 | guile | `sonic_cross_medium` | `sonic_blade_medium` | 同上 |
| 12 | guile | `sonic_cross_medium` | `sonic_blade_heavy` | 同上 |
| 13 | guile | `sonic_cross_od` | `sonic_blade_light` | 同上 |
| 14 | guile | `sonic_cross_od` | `sonic_blade_medium` | 同上 |
| 15 | guile | `sonic_cross_od` | `sonic_blade_heavy` | 同上 |
| 16 | jamie | `drink_level_4_ransui_haze_2_retreat` | `drink_level_4_senei_kick` | senei kickから。 |
| 17 | jamie | `drink_level_4_ransui_haze_3_delay` | `drink_level_4_ransui_haze_2_retreat` | 乱酔旋(2段目/後退)から派生 |
| 18 | jamie | `drink_level_4_ransui_haze_3_drink_while_retreating` | `drink_level_4_ransui_haze_2_retreat` | 乱酔旋(2段目/後退)から派生 |
| 19 | jamie | `drink_level_4_ransui_haze_3_immediate` | `drink_level_4_ransui_haze_2_retreat` | 乱酔旋(2段目/後退)から派生 |
| 20 | ken | `gorai_axe_kick` | `jinrai_kick_light` | 同上 |
| 21 | ken | `gorai_axe_kick` | `jinrai_kick_medium` | 同上 |
| 22 | ken | `gorai_axe_kick` | `jinrai_kick_heavy` | 同上 |
| 23 | ken | `gorai_axe_kick_od` | `jinrai_kick_od` | OD迅雷脚からのみ派生できる技 |
| 24 | ken | `kasai_thrust_kick` | `kazekama_shin_kick_od` | OD風鎌蹴りからのみ派生できる技 |
| 25 | ken | `kasai_thrust_kick_during_od_gorai_axe_kick` | `gorai_axe_kick_od` | OD轟雷落としからのみ派生できる技 |
| 26 | ken | `kasai_thrust_kick_during_od_senka_snap_kick` | `senka_snap_kick_od` | OD閃火脚からのみ派生できる技 |
| 27 | ken | `kazekama_shin_kick` | `jinrai_kick_light` | 弱中強の迅雷脚から派生できる技 |
| 28 | ken | `kazekama_shin_kick` | `jinrai_kick_medium` | 弱中強の迅雷脚から派生できる技 |
| 29 | ken | `kazekama_shin_kick` | `jinrai_kick_heavy` | 弱中強の迅雷脚から派生できる技 |
| 30 | ken | `kazekama_shin_kick_od` | `jinrai_kick_od` | OD迅雷脚からのみ派生できる技 |
| 31 | ken | `senka_snap_kick` | `jinrai_kick_light` | 同上 |
| 32 | ken | `senka_snap_kick` | `jinrai_kick_medium` | 同上 |
| 33 | ken | `senka_snap_kick` | `jinrai_kick_heavy` | 同上 |
| 34 | ken | `senka_snap_kick_od` | `jinrai_kick_od` | OD迅雷脚からのみ派生できる技 |
| 35 | kimberly | `step_up_backward` | `hisen_kick` | Hisen Kickからの派生 |
| 36 | kimberly | `step_up_forward` | `hisen_kick` | Hisen Kickからの派生 |
| 37 | kimberly | `step_up_neutral` | `hisen_kick` | Hisen Kickからの派生 |
| 38 | luke | `fatal_shot` | `sand_blast_od` | ODサンドブラスト空のみ派生 |
| 39 | luke | `impaler` | `avenger` | avengerからだけ派生 |
| 40 | luke | `impaler_od` | `avenger_od` | OD avengerからだけ派生 |
| 41 | luke | `no_chaser` | `avenger` | avengerからだけ派生 |
| 42 | luke | `no_chaser_od` | `avenger_od` | OD avengerからだけ派生 |
| 43 | m_bison | `devil_reverse` | `shadow_rise_light` | ノーマルシャドウライズからのみ派生 |
| 44 | m_bison | `devil_reverse` | `shadow_rise_medium` | ノーマルシャドウライズからのみ派生 |
| 45 | m_bison | `devil_reverse` | `shadow_rise_heavy` | ノーマルシャドウライズからのみ派生 |
| 46 | m_bison | `devil_reverse_od` | `shadow_rise_light` | ODシャドウライズだけでなく弱中強からも派生可能（指示書 §1.5） |
| 47 | m_bison | `devil_reverse_od` | `shadow_rise_medium` | ODシャドウライズだけでなく弱中強からも派生可能（指示書 §1.5） |
| 48 | m_bison | `devil_reverse_od` | `shadow_rise_heavy` | ODシャドウライズだけでなく弱中強からも派生可能（指示書 §1.5） |
| 49 | m_bison | `devil_reverse_od` | `shadow_rise_od` | ODシャドウライズだけでなく弱中強からも派生可能（指示書 §1.5） |
| 50 | m_bison | `head_press` | `shadow_rise_light` | ノーマルシャドウライズからのみ派生 |
| 51 | m_bison | `head_press` | `shadow_rise_medium` | ノーマルシャドウライズからのみ派生 |
| 52 | m_bison | `head_press` | `shadow_rise_heavy` | ノーマルシャドウライズからのみ派生 |
| 53 | m_bison | `head_press_od` | `shadow_rise_light` | 同上 |
| 54 | m_bison | `head_press_od` | `shadow_rise_medium` | 同上 |
| 55 | m_bison | `head_press_od` | `shadow_rise_heavy` | 同上 |
| 56 | m_bison | `head_press_od` | `shadow_rise_od` | 同上 |
| 57 | marisa | `enfold` | `scutum` | スクトゥムから |
| 58 | marisa | `enfold_od` | `scutum_od` | ODスクトゥムから |
| 59 | marisa | `procella` | `scutum` | スクトゥムから |
| 60 | marisa | `procella_od` | `scutum_od` | ODスクトゥムから |
| 61 | marisa | `tonitrus_1hit` | `scutum` | スクトゥムから |
| 62 | marisa | `tonitrus_1hit_od` | `scutum_od` | ODスクトゥムから |
| 63 | rashid | `front_flip` | `side_flip` | side_flipから派生 |

**既存 9 行**（zangief 連打版・`000061`）は巻き込んでいない。**保留行**（guile `sonic_cross_2_meter_od`）には付けていない——D-227 の除外述語は「保留の行に親参照は付かない」ことを誤爆しない根拠にしているため。


---

## 5. 【§6.2-5】②の 21 行の是正前後の対（全列）

**★対象 21 行のうち、実際に値が動くのは 20 行。** `drink_level_4_ransui_haze_2_retreat` は一次源と現行が完全一致だった。

| # | character | move_code | 是正前 su/act/rec/tot | 是正後 | 変更列 |
|---|---|---|---|---|---|
| 1 | ken | `kazekama_shin_kick_od` | 6/3/20/28 | 26/3/20/48 | startup, total |
| 2 | ken | `gorai_axe_kick_od` | 17/3/24/43 | 37/3/24/63 | startup, total |
| 3 | ken | `senka_snap_kick_od` | 10/6/18/33 | 28/6/18/51 | startup, total |
| 4 | ken | `kasai_thrust_kick` | 15/3/29/46 | 45/3/29/76 | startup, total |
| 5 | ken | `kasai_thrust_kick_during_od_gorai_axe_kick` | 11/3/29/42 | 54/3/29/85 | startup, total |
| 6 | ken | `kasai_thrust_kick_during_od_senka_snap_kick` | 15/3/37/54 | 54/3/37/93 | startup, total |
| 7 | jamie | `full_moon_kick_drink_and_reach_drink_lv4` | 15/9/53/76 | 15/9/58/81 | recovery, total |
| 8 | jamie | `phantom_sway_drink_and_reach_drink_lv4` | 12/3/56/70 | 12/3/61/75 | recovery, total |
| 9 | jamie | `drink_level_4_ransui_haze_3_immediate` | 14/5/28/46 | 38/5/28/70 | startup, total |
| 10 | jamie | `drink_level_4_ransui_haze_3_delay` | 4/25/27/55 | 53/25/27/104 | startup, total |
| 11 | jamie | `drink_level_4_ransui_haze_3_drink_while_retreating` | 16/2/115/132 | 15/3/115/132 | startup, active |
| 12 | jp | `departure_window_double_warp_od` | 48/20/19/86 | 49/20/19/87 | startup, total |
| 13 | luke | `impaler_od` | 25/8/19/51 | 24/8/19/50 | startup, total |
| 14 | luke | `no_chaser_od` | 24/10/16/49 | 23/10/16/48 | startup, total |
| 15 | luke | `snapback_combo` | 11/2/27/39 | 11/2/24/36 | recovery, total |
| 16 | m_bison | `somersault_skull_diver` | 12/10/11/32（on_hit NULL / on_block 7） | 12/10/12/33（on_hit 8 / on_block 5） | recovery, total, **on_hit**, **on_block** |
| 17 | marisa | `tonitrus` | 20/3/36/58 | 19/3/36/57 | startup, total |
| 18 | marisa | `tonitrus_od` | 20/3/36/58 | 19/3/36/57 | startup, total |
| 19 | rashid | `buffed_dash_forward` | 1/20/0/20 | 1/18/0/18 | active, total |
| 20 | rashid | `wall_jump` | 39/43/0/81 | 35/42/0/76 | startup, active, total |
| — | jamie | `drink_level_4_ransui_haze_2_retreat` | 16/3/75/93 | 同左 | **なし**（一致を実査で確認） |

**内部整合 `total = startup + active − 1 + recovery` は是正後の全 21 行で成立。**

**触っていないことを実査で確認した近縁 4 行**: ken `jinrai_kick_od` 13/3/25/40（一次源と完全一致・`standalone`）／ノーマル版 `kazekama_shin_kick` 6/4/19/28・`gorai_axe_kick` 18/3/20/40・`senka_snap_kick` 10/3/25/37（いずれも `unknown` のまま＝D-223）。

**`on_hit` / `on_block` / `damage` の差**: ken 6 行 ＋ `jinrai_kick_od` は一次源 CSV と完全一致で**差は無い**（`command` / `notes` / `is_projectile` / `is_derived` も一致）。

---

## 6. 【§6.2-3】①②の canary と、動いた場合の増分の全数

測定は `TestCanary_PunishScanProjection` と同形の全数射影（31 キャラ総当たり × ガード 2 種）を**版を固定して 3 点**で採取した。

| 測定点 | SHA256 | 判定 |
|---|---|---|
| v63（着手前 HEAD） | `c26f250f…4c07` | 基準 |
| **v64（①の直後）** | `c26f250f…4c07` | **★v63 と byte 一致。①は候補集合を 1 行も動かしていない** |
| v65（②の直後） | `815d09ee…b21f7` | 差分あり（下記で全数説明） |

| 区分 | 件数 |
|---|---:|
| 相手技ノードの**出現** | **0** |
| 相手技ノードの**消失** | **0** |
| 手動確認レーン（MR）の変化 | **0** |
| 有利フレームが変化した節点 | 68（＝ 4 種 × 17） |
| 始動技リストが変化した節点 | 3464 |
| **★説明できない差分** | **0** |

**★締める方向**（`startup` が遅くなり候補から外れた）: jamie `drink_level_4_ransui_haze_3_delay` 1626 節点（4→53）／ken `kazekama_shin_kick_od` 1418（6→26）／ken `kasai_thrust_kick_during_od_gorai_axe_kick` 1310（11→54）／ken `senka_snap_kick_od` 1214（10→28）／ken `kasai_thrust_kick_during_od_senka_snap_kick` 1141（15→54）／jamie `drink_level_4_ransui_haze_3_immediate` 1127（14→38）／ken `kasai_thrust_kick` 1126（15→45）／ken `gorai_axe_kick_od` 985（17→37）。

**★緩める方向**（`startup` が 1F 速くなり候補に入った）: luke `no_chaser_od` 109（24→23）／luke `impaler_od` 94（25→24）／marisa `tonitrus` 88／`tonitrus_od` 88（20→19）／jamie `drink_level_4_ransui_haze_3_drink_while_retreating` 58（16→15）。**いずれも開発者の再計測値であり、実機で 1F 速く出せる以上、候補に入るのが正しい。近似値・捏造値は 1 つも入れていない。**

**期待値は書き換えていない。** `internal/service/` の diff は 0 で `37 / 39 / 16` は無改変のまま green。

---

## 7. 【§6.2-6】★既知の限界

**B 型の対象は機械判別できない。** `is_aerial` の実セマンティクスが「ラッシュ版を作るか否か」であるため（D-222）、空中から出す必殺技が `is_aerial = 0` で入っており、B 型（`is_aerial=1` かつ `code` に `jumping_` を含まない）にも C 型（`jumping_` を含む）にも入らない。**したがって開発者が名指しした 13 系統が一次源であり、網羅の保証は無い**（D-225）。今後キャラを追加する波では、同じ抜けが静かに発生しうる。

---

## 8. 【§6.2-7】★守ったガードの所在（D-189）

| ガード | ファイル:行 | テスト名 |
|---|---|---|
| `m1904PrefixMissed = 2`（部分一致 vs 前方一致。juri / ken の `neutral_jumping_heavy_kick`） | `internal/infra/migration/migrate_m1904_test.go:33` | `TestRun_M1904_MechanicalBackfill` |
| `is_projectile = 1` が **104**（**v39 時点**の値） | `internal/infra/migration/migrate_m1801_test.go:76` | `TestRun_M1801_IsProjectileBackfill` |
| `is_projectile = 1` が **135**（v63） | `internal/infra/migration/migrate_m1904c_test.go:37` | `TestRun_M1904c_V63State` |
| `is_projectile = 1` が **135**（v63〜v65・**本サブが新設**） | `internal/infra/migration/migrate_m19p2_test.go` の `m19p2ProjectileTotal` | `assertCanaryM19P2`（3 テストから呼ぶ） |

**★104 を HEAD 用に転用していない**（M19-04c で一度落ちた形を繰り返さない）。

---

## 9. 【§6.2-8】Phase 2 の後に残る `unknown`（M19-05 の入力）

**186 行**。

| 区分 | 行数 | 内訳 |
|---|---:|---|
| c_viper / dhalsim | 18 | 000050 が明示除外（移動 system move のみでフレーム列が全 NULL） |
| 移動 system move | 153 | D-187 により本サブが `unknown` へ戻した |
| 人手で投入しなかった行 | 15 | 下記 |

**人手 15 行の全数**: guile `sonic_break_od`（記入値 unknown）／ingrid `satelite_leap`（D-187・startup NULL）／jamie `drink_level_4_senei_kick`（記入欄が空欄）／ken `gorai_axe_kick`・`kazekama_shin_kick`・`senka_snap_kick`（D-223）／lily `double_arrow`（D-187）／m_bison `devil_reverse_od`・`head_press_od`（D-226）／m_bison `hell_attack`（記入値 unknown）／m_bison `psycho_mine_auto_detonation`（D-187）／marisa `scutum_counterattack`・`scutum_counterattack_od`（D-187）／marisa `volare_combo`（D-187）／rashid `run`（D-187）。

---

## 10. 指示書の想定と食い違った点（着手前に報告し、開発者裁定を得た）

| # | 内容 | 裁定 |
|---|---|---|
| 1 | **指示書 §1.6 (a) の「ノーマル版 4 行」は 3 行が正**。HEAD の `kasai_thrust_kick` は `name_ja` が「火砕蹴(OD風鎌蹴り派生)」＝②の是正対象そのもので、ノーマル版の行は存在しない | 3 行を `unknown` のまま残す |
| 2 | **rashid `wall_jump` は指示書の値（startup 34 / active 42）で内部整合が破れる**（34+42−1+0 = 75 ≠ 現行 total 81） | **開発者裁定 2026-08-07: 35/42/0/76**（35+42−1+0 = 76） |
| 3 | **§1.5「その他」の親参照の範囲が未指定**（「〜から派生」に言及する行が 11 キャラ 56 件・第三波 43 件） | **開発者裁定: 親が `move_code` に一意解決できる断定形のみ**（63 対） |
| 4 | **§1.4 の lily `condor_dive` に「一律」表記が無く対応行が 6 つ** | **開発者裁定: ダイブ本体 4 行**（follow_up 2 行は対象外） |
| 5 | **②は 21 行対象で実変更 20 行**（`drink_level_4_ransui_haze_2_retreat` が一次源と一致） | 報告のみ |
| 6 | **指示書 §4-13 の「golden 7 stem」は古い**（実測 10 stem） | 報告のみ |
| 7 | **CHANGE は新規起票しない**（D-227 に対応する CHANGE-093 が registry v1.100.0 で同日払い出し済み） | 二重起票を避けた。**ただし通知書の実体が未作成**（092・093 とも） |
| 8 | **`docs/process/m18-m19-contract.md` §2 F-1 が D-199 の新文言に未追随**（同 §4 の CHANGE 次番号「092」も失効） | 裁定 D-199 を正として扱った |

---

## 11. テスト（指示書 §4 の 13 項目）

`internal/infra/migration/migrate_m19p2_test.go` を新設。**比較区間は始端 v63・終端 v65 に閉じ、`m.Up()` は使っていない**（`SUPP-001` §5.5 規約 (1)(2)）。

| §4 | 対応 |
|---|---|
| 1〜6（①） | `TestRun_M19P2_BeforeState` / `TestRun_M19P2_ManualBackfill`。3 値の分割・キャラ別内訳・**投入した行と投入しなかった行の対固定**・`fastest_unreachable` 35 行の全数・`startup IS NULL` の全行 `unknown`・`move_derivations` 72 行の子 × 親全数 |
| 7・8（②） | `TestRun_M19P2_FrameCorrection` / `TestRun_M19P2_UntouchedRowsUnchanged`。1 行 1 アサーション＋内部整合検算。**②は新規 DB では 0 行に当たるため、v65 → down → re-up の往復で波及を見る** |
| 9（down） | `TestRun_M19P2_DownUpRoundTrip`。①の down が v63 へ厳密に復帰し、`move_derivations` の既存 9 行を巻き込まないことも固定 |
| 10（canary） | SQL で測れる 2 値（37 / 16）を v63 / v64 / v65 の 3 点で固定。**案 C の 39 は `buildStarters` が非公開で本パッケージから呼べない**ため全数射影で代替（§6） |
| 11 | `is_projectile` の 104（v39）と 135（v63〜v65）を**別定数で書き分け** |
| 12 | `m1904PrefixMissed = 2` が期待値そのままで green |
| 13 | golden 10 stem green ／ `go run ./cmd/seedgen -check` OK |

---

## 12. 「触らない」ことの担保・実機確認

```
git diff --stat f16fb3e~1..HEAD -- internal/service/ internal/seedgen/   → 空
go test ./...                          → 全パッケージ green
go run ./cmd/seedgen -check            → OK: 生成物は既存ファイルと一致
go vet ./... / gofmt -l internal/ cmd/ → 出力なし
```

CSV 17 本は RFC4180 パーサで HEAD 前後を突合し、**既存 20 列の差分が②の 20 行 43 セルちょうど**（変更列は `startup` / `active` / `recovery` / `total` / `on_hit` / `on_block` の 6 列のみ）、**ヘッダ・列順・行数・行順が不変**、**空欄が `false` で埋まっていない**ことを機械検証した。新列は `startup_basis` 293 行・`fastest_unreachable` 35 行のみに書き、`chain_cancel_total` は設計どおり 1479 行すべて空欄（`DES-003` §3.3「CSV には転記しない」）。

### ★実機（開発者の dev DB）での追随確認 — 2026-08-07

**②は「既に適用済みの DB を追随させる」ためだけに存在し、その経路は新規 DB では再現できない**（golden 側に値が入るため 0 行に当たる）。開発者が `go run ./cmd/combomgr` を実行し、v63 の実 DB（`~/.local/share/combomgr/combomgr.db`）に対して**この経路を実データで通した**。

```
migration starting   from_version: 63
64/u backfill_frame_cost_manual    (28ms)
65/u correct_frame_values_phase2   (33ms)
migration completed  version: 65  dirty: false
```

適用後の実測（読み取り専用クエリ）——`standalone` 1126 / `through` 341 / `unknown` 186 ／ `fastest_unreachable=1` 144 ／ `move_derivations` 72 ／ `startup IS NULL` かつ basis ≠ unknown が 0 ／ 値域外 0 ／ `is_projectile=1` が 135。**②の 21 行は全行が是正後の値で、内部整合も全行成立。不一致 0 行。** 触っていない近縁 4 行も無傷。**ユーザーデータも無事**（combos 41 / combo_steps 171 / tags 4 / combo_setups 7 / combo_punishes 6）。

---

*以上*

---

## 13. 追補（`000066` / `000067`）— 2026-08-07 の開発者裁定を受けて

設計伝達レポート §3-2 で「投入せず報告」としていた項目のうち 3 件が、開発者裁定により解消した。**§2〜§9 の数値は①②（v65）時点のもの**で、追補後は下表のとおり動く。

| マイグレ | 内容 |
|---|---|
| **`000066`** | jamie 流酔拳の `move_code` の反転を是正（三点更新。CSV 8 行入替 → golden `000055`/`000056` 再生成 → 追随マイグレ）。**あわせて `startup_basis` を新 code に対して書き直す**——`000064` は旧 code で投入しており、golden が新 code になった結果、新規 DB では入れ替わった相手の行に値が入る（単発に `through` / フルに `standalone`）。**エラーにならない型**なので必須 |
| **`000067`** | (A) m_bison 4 行に `fastest_unreachable = 1` ／ (B) kimberly `elbow_drop` の `startup_basis` を `through` へ ／ (C) jamie 流酔拳の親参照 16 対 |

| 指標 | v65 | **v67** |
|---|---:|---:|
| `startup_basis` = standalone | 1126 | **1125** |
| 〃 through | 341 | **342** |
| 〃 unknown | 186 | **186**（不変） |
| `fastest_unreachable` = 1 | 144 | **148** |
| `move_derivations` | 72 | **88** |
| D-227 の除外述語を満たす行 | 16 | **16**（不変） |
| canary（SQL 2 値 / `is_projectile`） | 37 / 16 / 135 | **同左**（不変） |

**canary（全数射影）は v65 = v66 = v67 で完全一致。** 改名は golden 段で入るため、改名前のツリーと比べると射影は変わるが、**旧 code を新 code へ機械変換して突合すると 29655 行が完全一致**する＝物理的な候補集合は不変（設計伝達レポート §2-4）。

**両経路で検証済み**——新規 DB（`newMigrator` で v65 → v67）と既存 DB（dev DB のコピーに `000066`/`000067` を実適用）の双方が同一の最終状態へ着地し、一時 code の残骸 0、ユーザーデータ（combos 41 / steps 171 / setups 7 / punishes 6）不変。

**テスト**: `internal/infra/migration/migrate_m19p2b_test.go`（比較区間 v65 → v67・`m.Up()` 不使用）。★**v65 で `startup_basis` が反転していることをあえて固定した**——`000064` が旧 code で投入した結果でありエラーにならないため、この中間状態を明示しないと `000066` が何を直したのかが後から読めなくなる。

### 13.1 追補③（`000068`）— `fastest_unreachable` の 5 行を既定値へ戻す

開発者裁定（2026-08-07）「devil_reverse / head_press、および念のため kimberly の elbow drop は**最速入力で当たる**ので `false` が必要」。**★`true` は「当てられない」であり「当たる」ではない**（`000049` の DDL）。

| 撤回 | 投入元 |
|---|---|
| m_bison `devil_reverse` / `devil_reverse_od` / `head_press` / `head_press_od` | `000067` A |
| kimberly `elbow_drop` | `000064` B |

`fastest_unreachable = 1` は **148 → 143**。**`startup_basis` は戻さない**（`elbow_drop` の `through` は維持。2 つは別の軸）。

**据え置いた 7 行**（開発者裁定「`elbow_drop` のみが例外。他は通常のジャンプ攻撃と同じ性質」）: lily `great_spin` ／ marisa `caelum_arc`・`caelum_arc_holding` ／ rashid `aerial_shot`・`blitz_strike` ／ zangief `flying_body_press`・`flying_headbutt` は `standalone` / `1` のまま。

**★一次源の記入値が 5 行とも誤っていた。** 値域は 0/1 でどちらも妥当なため、**コードからは検出できない**種類の誤り。`DES-003` §3.3 と記入用一覧のテンプレートに「`true` は『当てられない』」の注意書きを入れることを設計卓へ依頼（設計伝達レポート §1-6）。

### 13.2 E2E とログのクロスチェック（2026-08-08）

`make e2e` は **4 flaky・全て retry で green**。4 件の失敗はすべて `POST /api/combos` の 500 で、アプリログの実エラーは **`insert combo: database is locked (5) (SQLITE_BUSY)`**。**同じ signature は 2026-08-03（本サブ着手前）にも出ており、本サブの変更が原因ではない**（seed データとマイグレしか触っておらず、`internal/service/` の diff は 0）。

**★ログの `path` を実査したところ、2026-08-08 04:01 / 04:03 の 2 回の起動はいずれも E2E スタック**（`web/e2e/.tmp/combomgr-e2e.db` ／ port 47390）**であり、dev DB ではなかった。** dev DB は 2026-08-07 18:38 に v63 → v65 を適用したまま **v65** で、`000066`〜`000068` は未適用。
**ただし 04:01 の実行は `from_version: 65` → `version: 67` / `dirty: false` で完了しており、これは「既存 DB へ `000066`/`000067` を適用する経路」が実環境で一度通ったことを意味する**（E2E 用の使い捨て DB が前回実行時の v65 で残っていたため）。
