# command 補完履歴(M14-03b 投入前チェック・2026-07-13)

手入力 CSV の command 未割り当て技に対し、公式データ(FR701 / `combomgr-importer/dist/`)との突合で command を補完した全件記録。
依頼元: `docs/seed-data/check-criteria.md`(旧 `tmp/pre-seed-data-check-prompt.md`) §1-1 / §6。残り 20 キャラの補完時の教訓資料を兼ねる。

- **確信度 高** = CSV へ書込済み。**中/低** = 書込まず「要開発者判断」(末尾の保留一覧)。
- 突合根拠の「対応 dist code」は公式データ抜粋(dist CSV)の move_code(importer 独自識別子)。
- 本ファイルには公式データのフレーム値・ダメージ値は転記しない(転載禁止ガードレール)。

## terry(2 件補完)

| move_code | name_ja | 補完 command | 対応 dist code | 突合根拠 | 確信度 |
|---|---|---|---|---|---|
| `round_wave`（旧 `round_wave_heavy`） | ラウンドウェイブ | `d dr r plus p_h` | `round_wave` | 日本語名一致(英名改名で code 突合が外れたもの) | 高 |
| `quick_burn` | クイックバーン | `d dl l plus p_l` | `quick_burn` | 日本語名一致(英名改名で code 突合が外れたもの) | 高 |

> ★`round_wave` は 2026-09-09 の `M30-02` 追補で `round_wave_heavy` から改名した（本表の作成時点=2026-07-13 の登録は `round_wave_heavy` であった）。
> 誤りであることの一次源は開発者のインゲーム確認（2026-09-09。逐語＝「ラウンドウェイブの強度はなしです」）。★本表の「対応 dist code」欄が当時から `round_wave` だったことは、
> 本アプリ側だけが `_heavy` を持っていたことの傍証である。★裏付けはデータ側にもある——`power_wave` は弱・中・OD しか持たない（236HP が別技であるため）。
>
> ★`quick_burn` は 2026-09-07 の `M28-05` で `quick_burn_light` から改名した(本表の作成時点=2026-07-13 の登録は `quick_burn_light` であった)。
> 誤りであることの一次源は開発者のインゲーム確認(2026-09-06)。★本表の「対応 dist code」欄が当時から `quick_burn` だったことは、
> 本アプリ側だけが `_light` を持っていたことの傍証である。

## guile(67 件補完)

| move_code | name_ja | 補完 command | 対応 dist code | 突合根拠 | 確信度 |
|---|---|---|---|---|---|
| `standing_light_punch` | 立ち弱P | `p_l` | `standing_light_punch` | move_code 完全一致 | 高 |
| `standing_light_kick` | 立ち弱K | `k_l` | `standing_light_kick` | move_code 完全一致 | 高 |
| `standing_medium_punch` | 立ち中P | `p_m` | `standing_medium_punch` | move_code 完全一致 | 高 |
| `standing_medium_kick` | 立ち中K | `k_m` | `standing_medium_kick` | move_code 完全一致 | 高 |
| `standing_heavy_punch` | 立ち強P | `p_h` | `standing_heavy_punch` | move_code 完全一致 | 高 |
| `standing_heavy_kick` | 立ち強K | `k_h` | `standing_heavy_kick` | move_code 完全一致 | 高 |
| `crouching_light_punch` | しゃがみ弱P | `d plus p_l` | `crouching_light_punch` | move_code 完全一致 | 高 |
| `crouching_light_kick` | しゃがみ弱K | `d plus k_l` | `crouching_light_kick` | move_code 完全一致 | 高 |
| `crouching_medium_punch` | しゃがみ中P | `d plus p_m` | `crouching_medium_punch` | move_code 完全一致 | 高 |
| `crouching_medium_kick` | しゃがみ中K | `d plus k_m` | `crouching_medium_kick` | move_code 完全一致 | 高 |
| `crouching_heavy_punch` | しゃがみ強P | `d plus p_h` | `crouching_heavy_punch` | move_code 完全一致 | 高 |
| `crouching_heavy_kick` | しゃがみ強K | `d plus k_h` | `crouching_heavy_kick` | move_code 完全一致 | 高 |
| `jumping_light_punch` | ジャンプ弱P | `p_l` | `jumping_light_punch` | move_code 完全一致 | 高 |
| `jumping_light_kick` | ジャンプ弱K | `k_l` | `jumping_light_kick` | move_code 完全一致 | 高 |
| `jumping_medium_punch` | ジャンプ中P | `p_m` | `jumping_medium_punch` | move_code 完全一致 | 高 |
| `jumping_medium_kick` | ジャンプ中K | `k_m` | `jumping_medium_kick` | move_code 完全一致 | 高 |
| `jumping_heavy_punch` | ジャンプ強P | `p_h` | `jumping_heavy_punch` | move_code 完全一致 | 高 |
| `jumping_heavy_kick` | ジャンプ強K | `k_h` | `jumping_heavy_kick` | move_code 完全一致 | 高 |
| `drive_impact` | ドライブインパクト | `p_h k_h` | `drive_impact` | move_code 完全一致 | 高 |
| `recoil_cannon` | リコイルキャノン | `p_m chain l plus p_h` | `recoil_cannon` | move_code 完全一致 | 高 |
| `double_shot` | ダブルバレット | `d plus p_m chain d plus p_m` | `double_shot` | move_code 完全一致 | 高 |
| `drake_fang` | ドレイクファング | `d plus k_m chain r plus p_m` | `drake_fang` | move_code 完全一致 | 高 |
| `phantom_cutter` | ファントムカッター | `d plus k_h chain dr plus k_h` | `phantom_cutter` | move_code 完全一致 | 高 |
| `throw_forward` | 前投げ | `n or r plus p_l k_l` | `throw_forward` | move_code 完全一致 | 高 |
| `throw_back` | 後ろ投げ | `l plus p_l k_l` | `throw_back` | move_code 完全一致 | 高 |
| `flying_mare` | フライングメイヤー | `n or r plus p_l k_l` | `flying_mare` | move_code 完全一致 | 高 |
| `flying_buster_drop` | フライングバスタードロップ | `l plus p_l k_l` | `flying_buster_drop` | move_code 完全一致 | 高 |
| `drive_parry` | ドライブパリィ | `p_m k_m` | `drive_parry` | move_code 完全一致 | 高 |
| `full_bullet_magnum` | フルブレットマグナム | `r plus p_m` | `full_bullet_magnum` | move_code 完全一致 | 高 |
| `burning_straight` | バーンストレート | `l plus p_h` | `burning_straight` | move_code 完全一致 | 高 |
| `spinning_back_knuckle` | スピニングバックナックル | `r plus p_h` | `spinning_back_knuckle` | move_code 完全一致 | 高 |
| `knee_bazooka` | ニーバズーカ | `l plus k_l` | `knee_bazooka` | move_code 完全一致 | 高 |
| `rolling_sobat` | ローリングソバット | `l plus k_m` | `rolling_sobat` | move_code 完全一致 | 高 |
| `reverse_spin_kick` | リバースピンキック | `r plus k_h` | `reverse_spin_kick` | move_code 完全一致 | 高 |
| `guile_high_kick` | ガイルハイキック | `dr plus k_h` | `guile_high_kick` | move_code 完全一致 | 高 |
| `sonic_boom_light` | 弱ソニックブーム | `charge_l r plus p_l` | `sonic_boom_light` | move_code 完全一致 | 高 |
| `perfect_timing_light_sonic_boom` | 【ジャスト】弱ソニックブーム | `charge_l r plus p_l` | `perfect_timing_l_sonic_boom` | move_code 変換一致(手入力 code から公式 code `perfect_timing_l_sonic_boom` へ既知の改名パターンを逆適用) | 高 |
| `sonic_boom_medium` | 中ソニックブーム | `charge_l r plus p_m` | `sonic_boom_medium` | move_code 完全一致 | 高 |
| `perfect_timing_medium_sonic_boom` | 【ジャスト】中ソニックブーム | `charge_l r plus p_m` | `perfect_timing_m_sonic_boom` | move_code 変換一致(手入力 code から公式 code `perfect_timing_m_sonic_boom` へ既知の改名パターンを逆適用) | 高 |
| `sonic_boom_heavy` | 強ソニックブーム | `charge_l r plus p_h` | `sonic_boom_heavy` | move_code 完全一致 | 高 |
| `perfect_timing_heavy_sonic_boom` | 【ジャスト】強ソニックブーム | `charge_l r plus p_h` | `perfect_timing_h_sonic_boom` | move_code 変換一致(手入力 code から公式 code `perfect_timing_h_sonic_boom` へ既知の改名パターンを逆適用) | 高 |
| `sonic_boom_od` | ODソニックブーム | `charge_l r plus p p` | `sonic_boom_od` | move_code 完全一致 | 高 |
| `somersault_kick_light` | 弱サマーソルトキック | `charge_d u plus k_l` | `somersault_kick_light` | move_code 完全一致 | 高 |
| `perfect_timing_light_somersault_kick` | 【ジャスト】弱サマーソルトキック | `charge_d u plus k_l` | `perfect_timing_l_somersault_kick` | move_code 変換一致(手入力 code から公式 code `perfect_timing_l_somersault_kick` へ既知の改名パターンを逆適用) | 高 |
| `somersault_kick_medium` | 中サマーソルトキック | `charge_d u plus k_m` | `somersault_kick_medium` | move_code 完全一致 | 高 |
| `perfect_timing_medium_somersault_kick` | 【ジャスト】中サマーソルトキック | `charge_d u plus k_m` | `perfect_timing_m_somersault_kick` | move_code 変換一致(手入力 code から公式 code `perfect_timing_m_somersault_kick` へ既知の改名パターンを逆適用) | 高 |
| `somersault_kick_heavy` | 強サマーソルトキック | `charge_d u plus k_h` | `somersault_kick_heavy` | move_code 完全一致 | 高 |
| `perfect_timing_heavy_somersault_kick` | 【ジャスト】強サマーソルトキック | `charge_d u plus k_h` | `perfect_timing_h_somersault_kick` | move_code 変換一致(手入力 code から公式 code `perfect_timing_h_somersault_kick` へ既知の改名パターンを逆適用) | 高 |
| `somersault_kick_od` | ODサマーソルトキック | `charge_d u plus k k` | `somersault_kick_od` | move_code 完全一致 | 高 |
| `sonic_blade_light` | 弱ソニックブレイド | `d dl l plus p_l` | `sonic_blade_light` | move_code 完全一致 | 高 |
| `sonic_blade_medium` | 中ソニックブレイド | `d dl l plus p_m` | `sonic_blade_medium` | move_code 完全一致 | 高 |
| `sonic_blade_heavy` | 強ソニックブレイド | `d dl l plus p_h` | `sonic_blade_heavy` | move_code 完全一致 | 高 |
| `sonic_cross_light` | 弱ソニッククロス | `r plus p_l` | `sonic_cross_light` | move_code 完全一致 | 高 |
| `perfect_timing_light_sonic_cross` | 【ジャスト】弱ソニッククロス | `r plus p_l` | `perfect_timing_l_sonic_cross` | move_code 変換一致(手入力 code から公式 code `perfect_timing_l_sonic_cross` へ既知の改名パターンを逆適用) | 高 |
| `sonic_cross_medium` | 中ソニッククロス | `r plus p_m` | `sonic_cross_medium` | move_code 完全一致 | 高 |
| `perfect_timing_medium_sonic_cross` | 【ジャスト】中ソニッククロス | `r plus p_m` | `perfect_timing_m_sonic_cross` | move_code 変換一致(手入力 code から公式 code `perfect_timing_m_sonic_cross` へ既知の改名パターンを逆適用) | 高 |
| `sonic_cross_heavy` | 強ソニッククロス | `r plus p_h` | `sonic_cross_heavy` | move_code 完全一致 | 高 |
| `perfect_timing_heavy_sonic_cross` | 【ジャスト】強ソニッククロス | `r plus p_h` | `perfect_timing_h_sonic_cross` | move_code 変換一致(手入力 code から公式 code `perfect_timing_h_sonic_cross` へ既知の改名パターンを逆適用) | 高 |
| `sonic_cross_od` | ODソニッククロス１ | `r plus p p or cond{（ODソニックブレイド中に）} r plus p` | `sonic_cross1_od` | 日本語名一致(英名改名で code 突合が外れたもの) | 高 |
| `perfect_timing_od_sonic_cross1_od` | 【ジャスト】ODソニッククロス１ | `r plus p p or cond{（ODソニックブレイド中に）} r plus p` | `sonic_cross1_od` | 条件プレフィックスを除いた日本語名一致 | 高 |
| `sonic_cross2_od_od` | ODソニッククロス２ | `r plus p p` | `sonic_cross2_od` | 日本語名一致(英名改名で code 突合が外れたもの) | 高 |
| `sonic_break_od` | ODソニックブレイク | `p` | `sonic_break_od` | move_code 完全一致 | 高 |
| `sa1_sonic_hurricane_up` | SA1 ソニックハリケーン （上） | `charge_l r l r plus p_h` | `sa1_sonic_hurricane_up` | move_code 完全一致 | 高 |
| `sa1_sonic_hurricane_side` | SA1 ソニックハリケーン （横） | `charge_l r l r plus p_l or p_m` | `sa1_sonic_hurricane_side` | move_code 完全一致 | 高 |
| `sa2_solid_puncher` | SA2 ソリッドパンチャー | `d dl l d dl l plus p` | `sa2_solid_puncher` | move_code 完全一致 | 高 |
| `sa3_crossfire_somersault` | SA3 クロスファイアサマーソルト | `charge_l r l r plus k` | `sa3_crossfire_somersault` | move_code 完全一致 | 高 |
| `ca_crossfire_somersault` | CA クロスファイアサマーソルト | `charge_l r l r plus k` | `ca_crossfire_somersault` | move_code 完全一致 | 高 |

## zangief(59 件補完)

| move_code | name_ja | 補完 command | 対応 dist code | 突合根拠 | 確信度 |
|---|---|---|---|---|---|
| `standing_light_punch` | 立ち弱P | `p_l` | `standing_light_punch` | move_code 完全一致 | 高 |
| `standing_light_kick` | 立ち弱K | `k_l` | `standing_light_kick` | move_code 完全一致 | 高 |
| `standing_medium_punch` | 立ち中P | `p_m` | `standing_medium_punch` | move_code 完全一致 | 高 |
| `standing_medium_kick` | 立ち中K | `k_m` | `standing_medium_kick` | move_code 完全一致 | 高 |
| `standing_heavy_punch` | 立ち強P | `p_h` | `standing_heavy_punch` | move_code 完全一致 | 高 |
| `standing_heavy_punch_holding` | 立ち強P(ホールド) | `p_h hold` | `standing_heavy_punch_charged` | move_code 変換一致(手入力 code から公式 code `standing_heavy_punch_charged` へ既知の改名パターンを逆適用) | 高 |
| `standing_heavy_kick` | 立ち強K | `k_h` | `standing_heavy_kick` | move_code 完全一致 | 高 |
| `crouching_light_punch` | しゃがみ弱P | `d plus p_l` | `crouching_light_punch` | move_code 完全一致 | 高 |
| `crouching_light_kick` | しゃがみ弱K | `d plus k_l` | `crouching_light_kick` | move_code 完全一致 | 高 |
| `crouching_medium_punch` | しゃがみ中P | `d plus p_m` | `crouching_medium_punch` | move_code 完全一致 | 高 |
| `crouching_medium_kick` | しゃがみ中K | `d plus k_m` | `crouching_medium_kick` | move_code 完全一致 | 高 |
| `crouching_heavy_punch` | しゃがみ強P | `d plus p_h` | `crouching_heavy_punch` | move_code 完全一致 | 高 |
| `crouching_heavy_kick` | しゃがみ強K | `d plus k_h` | `crouching_heavy_kick` | move_code 完全一致 | 高 |
| `jumping_light_punch` | ジャンプ弱P | `p_l` | `jumping_light_punch` | move_code 完全一致 | 高 |
| `jumping_light_kick` | ジャンプ弱K | `k_l` | `jumping_light_kick` | move_code 完全一致 | 高 |
| `jumping_medium_punch` | ジャンプ中P | `p_m` | `jumping_medium_punch` | move_code 完全一致 | 高 |
| `jumping_medium_kick` | ジャンプ中K | `k_m` | `jumping_medium_kick` | move_code 完全一致 | 高 |
| `jumping_heavy_punch` | ジャンプ強P | `p_h` | `jumping_heavy_punch` | move_code 完全一致 | 高 |
| `jumping_heavy_kick` | ジャンプ強K | `k_h` | `jumping_heavy_kick` | move_code 完全一致 | 高 |
| `jumping_heavy_kick_holding` | ジャンプ強K(ホールド) | `k_h hold` | `jumping_heavy_kick_charged` | move_code 変換一致(手入力 code から公式 code `jumping_heavy_kick_charged` へ既知の改名パターンを逆適用) | 高 |
| `drive_impact` | ドライブインパクト | `p_h k_h` | `drive_impact` | move_code 完全一致 | 高 |
| `throw_forward` | 前投げ | `n plus p_l k_l` | `throw_forward` | move_code 完全一致 | 高 |
| `throw_back` | 後ろ投げ | `l plus p_l k_l` | `throw_back` | move_code 完全一致 | 高 |
| `german_suplex` | ジャーマンスープレックス | `r plus p_l k_l` | `german_suplex` | move_code 完全一致 | 高 |
| `spinebuster` | スパインバスター | `dr plus p_l k_l` | `spinebuster` | move_code 完全一致 | 高 |
| `russian_drop` | ロシアンドロップ | `dl plus p_l k_l` | `russian_drop` | move_code 完全一致 | 高 |
| `brain_buster` | ブレーンバスター | `d plus p_l k_l` | `brain_buster` | move_code 完全一致 | 高 |
| `drive_parry` | ドライブパリィ | `p_m k_m` | `drive_parry` | move_code 完全一致 | 高 |
| `hellstab` | ヘルスタブ | `dr plus p_m` | `hellstab` | move_code 完全一致 | 高 |
| `knee_hammer` | ニーバット | `r plus k_m` | `knee_hammer` | move_code 完全一致 | 高 |
| `headbutt` | ヘッドバット | `r plus p_h` | `headbutt` | move_code 完全一致 | 高 |
| `cyclone_wheel_kick` | サイクロンニールキック | `r plus k_h` | `cyclone_wheel_kick` | move_code 完全一致 | 高 |
| `smetana_dropkick` | スメタナドロップキック | `dr plus k_h` | `smetana_dropkick` | move_code 完全一致 | 高 |
| `flying_body_press` | フライングボディプレス | `d plus p_h` | `flying_body_press` | move_code 完全一致 | 高 |
| `flying_headbutt` | フライングヘッドバット | `u plus p_h` | `flying_headbutt` | move_code 完全一致 | 高 |
| `double_lariat_od` | ODダブルラリアット | `p_l p_m p_h` | `double_lariat_od` | move_code 完全一致 | 高 |
| `double_lariat` | ダブルラリアット | `p p` | `double_lariat` | move_code 完全一致 | 高 |
| `screw_piledriver_light` | 弱スクリューパイルドライバー | `circle plus p_l` | `screw_piledriver_light` | move_code 完全一致 | 高 |
| `screw_piledriver_medium` | 中スクリューパイルドライバー | `circle plus p_m` | `screw_piledriver_medium` | move_code 完全一致 | 高 |
| `screw_piledriver_heavy` | 強スクリューパイルドライバー | `circle plus p_h` | `screw_piledriver_heavy` | move_code 完全一致 | 高 |
| `screw_piledriver_od` | ODスクリューパイルドライバー | `circle plus p p` | `screw_piledriver_od` | move_code 完全一致 | 高 |
| `borscht_dynamite` | ボルシチダイナマイト | `circle plus k` | `borscht_dynamite` | move_code 完全一致 | 高 |
| `borscht_dynamite_od` | ODボルシチダイナマイト | `circle plus k k` | `borscht_dynamite_od` | move_code 完全一致 | 高 |
| `russian_suplex` | ロシアンスープレックス | `r dr d dl l plus k` | `russian_suplex` | move_code 完全一致 | 高 |
| `russian_suplex_od` | ODロシアンスープレックス | `r dr d dl l plus k k` | `russian_suplex_od` | move_code 完全一致 | 高 |
| `siberian_express` | シベリアンエクスプレス | `r dr d dl l plus k` | `siberian_express_close_range/siberian_express_far_range` | 公式の近距離版/遠距離版2行を1行に統合入力。公式commandは両行同一 | 高 |
| `siberian_express_od` | ODシベリアンエクスプレス | `r dr d dl l plus k k` | `siberian_express_close_range_od/siberian_express_far_range_od` | 同上(OD)。公式commandは両行同一 | 高 |
| `tundra_storm` | ツンドラストーム | `d d plus k_h` | `tundra_storm` | move_code 完全一致 | 高 |
| `sa1_aerial_russian_slam` | SA1 エアリアルロシアンスラム | `d dr r d dr r plus k` | `sa1_aerial_russian_slam` | move_code 完全一致 | 高 |
| `sa2_cyclone_lariat_forward` | SA2 サイクロンラリアット(前) | `d dr r d dr r plus p` | `sa2_cyclone_lariat_immediately/sa2_cyclone_lariat_movement` | 公式は(その場)/(移動)、手入力は(前)/(後ろ)で行対応は曖昧だが、公式commandは全バリエーション(ホールド含む)同一 | 高 |
| `sa2_cyclone_lariat_back` | SA2 サイクロンラリアット(後ろ) | `d dr r d dr r plus p` | `sa2_cyclone_lariat_immediately/sa2_cyclone_lariat_movement` | 同上 | 高 |
| `sa2_cyclone_lariat_holding` | SA2 サイクロンラリアット(ホールド) | `d dr r d dr r plus p` | `sa2_cyclone_lariat_charged` | move_code 変換一致(手入力 code から公式 code `sa2_cyclone_lariat_charged` へ既知の改名パターンを逆適用) | 高 |
| `sa3_bolshoi_storm_buster` | SA3 ボリショイストームバスター | `circle circle plus p` | `sa3_bolshoi_storm_buster` | move_code 完全一致 | 高 |
| `ca_bolshoi_storm_buster` | CA ボリショイストームバスター | `circle circle plus p` | `ca_bolshoi_storm_buster` | move_code 完全一致 | 高 |
| `machine_gun_chops_2hits` | マシンガンチョップ(2段止め) | `p_m chain p_m` | `machine_gun_chops_2` | TC累積方式のn段止め改名(2段止め↔公式2段目)。日本語名+段数一致 | 高 |
| `machine_gun_chops` | マシンガンチョップ | `p_m chain p_m chain p_m` | `machine_gun_chops_3` | TC累積方式(フル=公式最終段3段目)。日本語名一致 | 高 |
| `power_stomps_1hits` | ストンピング(単発) | `d d plus k_m` | `power_stomps_1` | n段止め改名(単発↔公式1段目)。日本語名+段数一致 | 高 |
| `power_stomps_2hits` | ストンピング(2段止め) | `d d plus k_m chain k_m` | `power_stomps_2` | 同上(2段止め↔2段目) | 高 |
| `power_stomps` | ストンピング | `d d plus k_m chain k_m chain k_m` | `power_stomps_3` | 同上(フル↔3段目) | 高 |

## lily(7 件補完)

| move_code | name_ja | 補完 command | 対応 dist code | 突合根拠 | 確信度 |
|---|---|---|---|---|---|
| `windclad_light_condor_spire` | [風纏い]弱コンドルスパイア | `d dr r plus k_l` | `windclad_l_condor_spire` | move_code 変換一致(手入力 code から公式 code `windclad_l_condor_spire` へ既知の改名パターンを逆適用) | 高 |
| `windclad_medium_condor_spire` | [風纏い]中コンドルスパイア | `d dr r plus k_m` | `windclad_m_condor_spire` | move_code 変換一致(手入力 code から公式 code `windclad_m_condor_spire` へ既知の改名パターンを逆適用) | 高 |
| `windclad_heavy_condor_spire` | [風纏い]強コンドルスパイア | `d dr r plus k_h` | `windclad_h_condor_spire` | move_code 変換一致(手入力 code から公式 code `windclad_h_condor_spire` へ既知の改名パターンを逆適用) | 高 |
| `windclad_light_tomahawk_buster` | [風纏い]弱トマホークバスター | `r d dr plus p_l` | `windclad_l_tomahawk_buster` | move_code 変換一致(手入力 code から公式 code `windclad_l_tomahawk_buster` へ既知の改名パターンを逆適用) | 高 |
| `windclad_medium_tomahawk_buster` | [風纏い]中トマホークバスター | `r d dr plus p_m` | `windclad_m_tomahawk_buster` | move_code 変換一致(手入力 code から公式 code `windclad_m_tomahawk_buster` へ既知の改名パターンを逆適用) | 高 |
| `windclad_heavy_tomahawk_buster` | [風纏い]強トマホークバスター | `r d dr plus p_h` | `windclad_h_tomahawk_buster` | move_code 変換一致(手入力 code から公式 code `windclad_h_tomahawk_buster` へ既知の改名パターンを逆適用) | 高 |
| `windclad_od_condor_dive` | [風纏い]ODコンドルダイブ | `p p p` | `windclad_od_condor_dive` | move_code 完全一致 | 高 |

## juri(57 件補完)

| move_code | name_ja | 補完 command | 対応 dist code | 突合根拠 | 確信度 |
|---|---|---|---|---|---|
| `standing_light_punch` | 立ち弱P | `p_l` | `standing_light_punch` | move_code 完全一致 | 高 |
| `standing_light_kick` | 立ち弱K | `k_l` | `standing_light_kick` | move_code 完全一致 | 高 |
| `standing_medium_punch` | 立ち中P | `p_m` | `standing_medium_punch` | move_code 完全一致 | 高 |
| `standing_medium_kick` | 立ち中K | `k_m` | `standing_medium_kick` | move_code 完全一致 | 高 |
| `standing_heavy_punch` | 立ち強P | `p_h` | `standing_heavy_punch` | move_code 完全一致 | 高 |
| `standing_heavy_kick` | 立ち強K | `k_h` | `standing_heavy_kick` | move_code 完全一致 | 高 |
| `crouching_light_punch` | しゃがみ弱P | `d plus p_l` | `crouching_light_punch` | move_code 完全一致 | 高 |
| `crouching_light_kick` | しゃがみ弱K | `d plus k_l` | `crouching_light_kick` | move_code 完全一致 | 高 |
| `crouching_medium_punch` | しゃがみ中P | `d plus p_m` | `crouching_medium_punch` | move_code 完全一致 | 高 |
| `crouching_medium_kick` | しゃがみ中K | `d plus k_m` | `crouching_medium_kick` | move_code 完全一致 | 高 |
| `crouching_heavy_punch` | しゃがみ強P | `d plus p_h` | `crouching_heavy_punch` | move_code 完全一致 | 高 |
| `crouching_heavy_kick` | しゃがみ強K | `d plus k_h` | `crouching_heavy_kick` | move_code 完全一致 | 高 |
| `jumping_light_punch` | ジャンプ弱P | `p_l` | `jumping_light_punch` | move_code 完全一致 | 高 |
| `jumping_light_kick` | ジャンプ弱K | `k_l` | `jumping_light_kick` | move_code 完全一致 | 高 |
| `jumping_medium_punch` | ジャンプ中P | `p_m` | `jumping_medium_punch` | move_code 完全一致 | 高 |
| `jumping_medium_kick` | ジャンプ中K | `k_m` | `jumping_medium_kick` | move_code 完全一致 | 高 |
| `jumping_heavy_punch` | ジャンプ強P | `p_h` | `jumping_heavy_punch` | move_code 完全一致 | 高 |
| `jumping_heavy_kick` | ジャンプ強K | `k_h` | `jumping_heavy_kick` | move_code 完全一致 | 高 |
| `neutral_jumping_heavy_kick` | 垂直ジャンプ強K | `k_h` | `neutral_jumping_heavy_kick` | move_code 完全一致 | 高 |
| `drive_impact` | ドライブインパクト | `p_h k_h` | `drive_impact` | move_code 完全一致 | 高 |
| `throw_forward` | 前投げ | `n or r plus p_l k_l` | `throw_forward` | move_code 完全一致 | 高 |
| `throw_back` | 後ろ投げ | `l plus p_l k_l` | `throw_back` | move_code 完全一致 | 高 |
| `air_throw` | 空投げ | `p_l k_l` | `zanka_sen` | 技名を「斬架閃」→汎用名「空投げ」へ変更。categoryとcond(ジャンプ中)からdist唯一の空中投げに一意対応 | 高 |
| `drive_parry` | ドライブパリィ | `p_m k_m` | `drive_parry` | move_code 完全一致 | 高 |
| `kyosesho` | 狂背掌 | `r plus p_m` | `kyosesho` | move_code 完全一致 | 高 |
| `senkai_kick` | 殲廻脚 | `r plus k_m` | `senkai_kick` | move_code 完全一致 | 高 |
| `renko_kicks` | 連剋脚 | `r plus p_h` | `renko_kicks` | move_code 完全一致 | 高 |
| `korenzan` | 鉤鎌斬 | `l plus k_h` | `korenzan` | move_code 完全一致 | 高 |
| `death_crest_2hits` | 死紋蹴(2発止め) | `p_m chain l plus p_h` | `death_crest_2` | TC累積方式のn段止め改名(2発止め↔公式2段目) | 高 |
| `fuhajin_light` | 弱風破刃 | `d dl l plus k_l` | `fuhajin_light` | move_code 完全一致 | 高 |
| `fuhajin_medium` | 中風破刃 | `d dl l plus k_m` | `fuhajin_medium` | move_code 完全一致 | 高 |
| `fuhajin_heavy` | 強風破刃 | `d dl l plus k_h` | `fuhajin_heavy` | move_code 完全一致 | 高 |
| `fuhajin_od` | OD風破刃 | `d dl l plus k k` | `fuhajin_od` | move_code 完全一致 | 高 |
| `saihasho_od` | OD歳破衝 | `d dr r plus k_l k_m` | `saihasho_od` | move_code 完全一致 | 高 |
| `saihasho` | 歳破衝 | `d dr r plus k_l` | `saihasho` | move_code 完全一致 | 高 |
| `fuha_saihasho` | [風破]歳破衝 | `d dr r plus k_l` | `boosted_saihasho` | [風破]=公式[強化版]の改名(舞の[焔版]と同型のインゲーム表記統一)。技名一致 | 高 |
| `ankensatsu_od` | OD暗剣殺 | `d dr r plus k_l k_h` | `ankensatsu_od` | move_code 完全一致 | 高 |
| `ankensatsu` | 暗剣殺 | `d dr r plus k_m` | `ankensatsu` | move_code 完全一致 | 高 |
| `fuha_ankensatsu` | [風破]暗剣殺 | `d dr r plus k_m` | `boosted_ankensatsu` | 同上 | 高 |
| `go_ohsatsu_od` | OD五黄殺 | `d dr r plus k_m k_h` | `go_ohsatsu_od` | move_code 完全一致 | 高 |
| `go_ohsatsu` | 五黄殺 | `d dr r plus k_h` | `go_ohsatsu` | move_code 完全一致 | 高 |
| `fuha_go_ohsatsu` | [風破]五黄殺 | `d dr r plus k_h` | `boosted_go_ohsatsu` | 同上 | 高 |
| `tensenrin_light` | 弱天穿輪 | `r d dr plus p_l` | `tensenrin_light` | move_code 完全一致 | 高 |
| `tensenrin_medium` | 中天穿輪 | `r d dr plus p_m` | `tensenrin_medium` | move_code 完全一致 | 高 |
| `tensenrin_heavy` | 強天穿輪 | `r d dr plus p_h` | `tensenrin_heavy` | move_code 完全一致 | 高 |
| `tensenrin_od` | OD天穿輪 | `r d dr plus p p` | `tensenrin_od` | move_code 完全一致 | 高 |
| `shiku_sen_od` | OD疾空閃 | `d dl l plus k k` | `shiku_sen_od` | move_code 完全一致 | 高 |
| `shiku_sen` | 疾空閃 | `d dl l plus k` | `shiku_sen` | move_code 完全一致 | 高 |
| `shiren_sen_od` | OD死連閃 | `k` | `shiren_sen_od` | move_code 完全一致 | 高 |
| `shiren_sen` | 死連閃 | `k` | `shiren_sen` | move_code 完全一致 | 高 |
| `sa1_sakkai_fuhazan` | 殺界風破斬 | `d dr r d dr r plus k` | `sa1_sakkai_fuhazan` | move_code 完全一致 | 高 |
| `fuha_sa1_sakkai_fuhazan` | [風破]殺界風破斬 | `d dr r d dr r plus k` | `sa1_sakkai_fuhazan` | 公式に[強化版]SA1行なし(手入力側の補完行)。風破ストックは自動消費で入力は基底SA1と同一(強化版specialsが基底とcommand同一である公式パターンと整合) | 高 |
| `sa2_feng_shui_engine` | 風水エンジン | `d dl l d dl l plus p` | `sa2_feng_shui_engine` | move_code 完全一致 | 高 |
| `sa2_feng_shui_engine_dash` | 風水エンジン(突進版) | `p hold` | `sa2_feng_shui_engine_rush` | 「(突進)」↔「(突進版)」の表記差のみ。日本語名実質一致 | 高 |
| `sa3_kaisen_dankai_raku` | SA3 回旋断界落 | `d dl l d dl l plus k` | `sa3_kaisen_dankai_raku` | move_code 完全一致 | 高 |
| `ca_kaisen_dankai_raku` | CA 回旋断界落 | `d dl l d dl l plus k` | `ca_kaisen_dankai_raku` | move_code 完全一致 | 高 |
| `death_crest` | 死紋蹴 | `p_m chain l plus p_h chain p_h` | `death_crest_3` | TC累積方式(フル↔公式3段目) | 高 |

## mai(31 件補完)

| move_code | name_ja | 補完 command | 対応 dist code | 突合根拠 | 確信度 |
|---|---|---|---|---|---|
| `air_throw` | 空投げ | `p_l k_l` | `yume_zakura` | 技名を「夢桜」→汎用名「空投げ」へ変更。categoryとcond(ジャンプ中)からdist唯一の空中投げに一意対応 | 高 |
| `kachousen_holding_light` | 弱花蝶扇（ホールド） | `d dr r plus p_l hold` | `kachousen_charged_light` | move_code 変換一致(手入力 code から公式 code `kachousen_charged_light` へ既知の改名パターンを逆適用) | 高 |
| `flame_light_kachousen` | [焔版]弱花蝶扇 | `d dr r plus p_l` | `boosted_l_kachousen` | move_code 変換一致(手入力 code から公式 code `boosted_l_kachousen` へ既知の改名パターンを逆適用) | 高 |
| `flame_light_kachousen_holding` | [焔版]弱花蝶扇（ホールド） | `d dr r plus p_l hold` | `boosted_l_kachousen_charged` | move_code 変換一致(手入力 code から公式 code `boosted_l_kachousen_charged` へ既知の改名パターンを逆適用) | 高 |
| `kachousen_holding_medium` | 中花蝶扇（ホールド） | `d dr r plus p_m hold` | `kachousen_charged_medium` | move_code 変換一致(手入力 code から公式 code `kachousen_charged_medium` へ既知の改名パターンを逆適用) | 高 |
| `flame_medium_kachousen` | [焔版]中花蝶扇 | `d dr r plus p_m` | `boosted_m_kachousen` | move_code 変換一致(手入力 code から公式 code `boosted_m_kachousen` へ既知の改名パターンを逆適用) | 高 |
| `flame_medium_kachousen_holding` | [焔版]中花蝶扇（ホールド） | `d dr r plus p_m hold` | `boosted_m_kachousen_charged` | move_code 変換一致(手入力 code から公式 code `boosted_m_kachousen_charged` へ既知の改名パターンを逆適用) | 高 |
| `kachousen_holding_heavy` | 強花蝶扇（ホールド） | `d dr r plus p_h hold` | `kachousen_charged_heavy` | move_code 変換一致(手入力 code から公式 code `kachousen_charged_heavy` へ既知の改名パターンを逆適用) | 高 |
| `flame_heavy_kachousen` | [焔版]強花蝶扇 | `d dr r plus p_h` | `boosted_h_kachousen` | move_code 変換一致(手入力 code から公式 code `boosted_h_kachousen` へ既知の改名パターンを逆適用) | 高 |
| `flame_heavy_kachousen_holding` | [焔版]強花蝶扇（ホールド） | `d dr r plus p_h hold` | `boosted_h_kachousen_charged` | move_code 変換一致(手入力 code から公式 code `boosted_h_kachousen_charged` へ既知の改名パターンを逆適用) | 高 |
| `kachousen_holding_od` | OD花蝶扇（ホールド） | `d dr r plus p p hold` | `kachousen_charged_od` | move_code 変換一致(手入力 code から公式 code `kachousen_charged_od` へ既知の改名パターンを逆適用) | 高 |
| `flame_od_kachousen` | [焔版]OD花蝶扇 | `d dr r plus p p` | `boosted_od_kachousen` | move_code 変換一致(手入力 code から公式 code `boosted_od_kachousen` へ既知の改名パターンを逆適用) | 高 |
| `flame_od_kachousen_holding` | [焔版]OD花蝶扇（ホールド） | `d dr r plus p p hold` | `boosted_od_kachousen_charged` | move_code 変換一致(手入力 code から公式 code `boosted_od_kachousen_charged` へ既知の改名パターンを逆適用) | 高 |
| `flame_midare_kachousen` | [焔版]乱れ花蝶扇 | `r plus p` | `boosted_midare_kachousen` | move_code 変換一致(手入力 code から公式 code `boosted_midare_kachousen` へ既知の改名パターンを逆適用) | 高 |
| `flame_light_ryuuenbu` | [焔版]弱龍炎舞 | `d dl l plus p_l` | `boosted_l_ryuuenbu` | move_code 変換一致(手入力 code から公式 code `boosted_l_ryuuenbu` へ既知の改名パターンを逆適用) | 高 |
| `flame_medium_ryuuenbu` | [焔版]中龍炎舞 | `d dl l plus p_m` | `boosted_m_ryuuenbu` | move_code 変換一致(手入力 code から公式 code `boosted_m_ryuuenbu` へ既知の改名パターンを逆適用) | 高 |
| `flame_heavy_ryuuenbu` | [焔版]強龍炎舞 | `d dl l plus p_h` | `boosted_h_ryuuenbu` | move_code 変換一致(手入力 code から公式 code `boosted_h_ryuuenbu` へ既知の改名パターンを逆適用) | 高 |
| `flame_od_ryuuenbu` | [焔版]OD龍炎舞 | `d dl l plus p p` | `boosted_od_ryuuenbu` | move_code 変換一致(手入力 code から公式 code `boosted_od_ryuuenbu` へ既知の改名パターンを逆適用) | 高 |
| `flame_light_hissatsu_shinobi_bachi` | [焔版]弱必殺忍蜂 | `d dr r plus k_l` | `boosted_l_hissatsu_shinobi_bachi` | move_code 変換一致(手入力 code から公式 code `boosted_l_hissatsu_shinobi_bachi` へ既知の改名パターンを逆適用) | 高 |
| `flame_medium_hissatsu_shinobi_bachi` | [焔版]中必殺忍蜂 | `d dr r plus k_m` | `boosted_m_hissatsu_shinobi_bachi` | move_code 変換一致(手入力 code から公式 code `boosted_m_hissatsu_shinobi_bachi` へ既知の改名パターンを逆適用) | 高 |
| `flame_heavy_hissatsu_shinobi_bachi` | [焔版]強必殺忍蜂 | `d dr r plus k_h` | `boosted_h_hissatsu_shinobi_bachi` | move_code 変換一致(手入力 code から公式 code `boosted_h_hissatsu_shinobi_bachi` へ既知の改名パターンを逆適用) | 高 |
| `flame_od_hissatsu_shinobi_bachi` | [焔版]OD必殺忍蜂 | `d dr r plus k k` | `boosted_od_hissatsu_shinobi_bachi` | move_code 変換一致(手入力 code から公式 code `boosted_od_hissatsu_shinobi_bachi` へ既知の改名パターンを逆適用) | 高 |
| `flame_light_hishou_ryuuenjin` | [焔版]弱飛翔龍炎陣 | `r d dr plus k_l` | `boosted_l_hishou_ryuuenjin` | move_code 変換一致(手入力 code から公式 code `boosted_l_hishou_ryuuenjin` へ既知の改名パターンを逆適用) | 高 |
| `flame_medium_hishou_ryuuenjin` | [焔版]中飛翔龍炎陣 | `r d dr plus k_m` | `boosted_m_hishou_ryuuenjin` | move_code 変換一致(手入力 code から公式 code `boosted_m_hishou_ryuuenjin` へ既知の改名パターンを逆適用) | 高 |
| `flame_heavy_hishou_ryuuenjin` | [焔版]強飛翔龍炎陣 | `r d dr plus k_h` | `boosted_h_hishou_ryuuenjin` | move_code 変換一致(手入力 code から公式 code `boosted_h_hishou_ryuuenjin` へ既知の改名パターンを逆適用) | 高 |
| `flame_od_hishou_ryuuenjin` | [焔版]OD飛翔龍炎陣 | `r d dr plus k k` | `boosted_od_hishou_ryuuenjin` | move_code 変換一致(手入力 code から公式 code `boosted_od_hishou_ryuuenjin` へ既知の改名パターンを逆適用) | 高 |
| `flame_od_musasabi_no_mai` | [焔版]ODムササビの舞 | `d dl l plus p p` | `boosted_od_musasabi_no_mai` | move_code 変換一致(手入力 code から公式 code `boosted_od_musasabi_no_mai` へ既知の改名パターンを逆適用) | 高 |
| `flame_musasabi_no_mai` | [焔版]ムササビの舞 | `d dl l plus p` | `boosted_musasabi_no_mai` | move_code 変換一致(手入力 code から公式 code `boosted_musasabi_no_mai` へ既知の改名パターンを逆適用) | 高 |
| `flame_sa1_kagerou_no_mai` | [焔版]陽炎の舞 | `d dr r d dr r plus p` | `boosted_sa1_kagerou_no_mai` | move_code 変換一致(手入力 code から公式 code `boosted_sa1_kagerou_no_mai` へ既知の改名パターンを逆適用) | 高 |
| `flame_sa2_chou_hissatsu_shinobi_bachi` | [焔版]超必殺忍蜂 | `d dr r d dr r plus k` | `boosted_sa2_chou_hissatsu_shinobi_bachi` | move_code 変換一致(手入力 code から公式 code `boosted_sa2_chou_hissatsu_shinobi_bachi` へ既知の改名パターンを逆適用) | 高 |
| `flame_sa2_air_chou_hissatsu_shinobi_bachi` | [焔版]空中超必殺忍蜂 | `d dr r d dr r plus k` | `boosted_sa2_air_chou_hissatsu_shinobi_bachi` | move_code 変換一致(手入力 code から公式 code `boosted_sa2_air_chou_hissatsu_shinobi_bachi` へ既知の改名パターンを逆適用) | 高 |

## ingrid(21 件補完)

| move_code | name_ja | 補完 command | 対応 dist code | 突合根拠 | 確信度 |
|---|---|---|---|---|---|
| `satelite_leap` | サテライトリープ | `k_h chain k_h` | `satellite_leap` | 日本語名一致(英名改名で code 突合が外れたもの) | 高 |
| `sun_shot_holding_heavy` | 強サンシュート(ホールド) | `d dr r plus p_h hold` | `sun_shot_heavy` | 公式に行なし(手入力側の補完行)。公式のホールド版commandは基底command+holdトークンで全キャラ統一(舞kachousen/ザンギ等)のパターンを適用した合成 | 高 |
| `od_sun_shot_light` | 弱ODサンシュート | `d dr r plus p_l p_m` | `l_sun_shot_od` | OD強度分割の語順違い(od_X_light↔l_X_od)。日本語名一致 | 高 |
| `od_sun_shot_medium` | 中ODサンシュート | `d dr r plus p_l p_h` | `m_sun_shot_od` | 同上 | 高 |
| `od_sun_shot_heavy` | 強ODサンシュート | `d dr r plus p_m p_h` | `h_sun_shot_od` | 同上 | 高 |
| `sun_flare_lv1` | サンフレア(Lv1) | `d dl l plus p_m alt_sep d dl l plus p_h` | `sun_flare_lv1` | move_code 完全一致 | 高 |
| `sun_flare_lv2` | サンフレア(Lv2) | `d dl l plus p_h` | `sun_flare_lv2` | move_code 完全一致 | 高 |
| `solar_burst_lv1_neutral_od` | ODソーラーフレア(Lv1)（垂直） | `d dl l plus p p` | `solar_burst_lv1_od` | 同上(OD) | 高 |
| `solar_burst_lv1_forward_od` | ODソーラーフレア(Lv1)（前方） | `d dl l plus p p` | `solar_burst_lv1_od` | 同上(OD) | 高 |
| `solar_burst_lv2_neutral_od` | ODソーラーフレア(Lv2)（垂直） | `d dl l plus p p` | `solar_burst_lv2_od` | 同上(OD) | 高 |
| `solar_burst_lv2_forward_od` | ODソーラーフレア(Lv2)（前方） | `d dl l plus p p` | `solar_burst_lv2_od` | 同上(OD) | 高 |
| `solar_burst_lv3_neutral_od` | ODソーラーフレア(Lv3)（垂直） | `d dl l plus p p` | `solar_burst_lv3_od` | 同上(OD) | 高 |
| `solar_burst_lv3_forward_od` | ODソーラーフレア(Lv3)（前方） | `d dl l plus p p` | `solar_burst_lv3_od` | 同上(OD) | 高 |
| `solar_burst_lv1_neutral` | ソーラーフレア(Lv1)（垂直） | `d dl l plus p_m alt_sep d dl l plus p_h` | `solar_burst_lv1` | 手入力は垂直/前方の方向分割(公式データの表現不足補完・乖離一覧g)。commandは方向で不変 | 高 |
| `solar_burst_lv1_forward` | ソーラーフレア(Lv1)（前方） | `d dl l plus p_m alt_sep d dl l plus p_h` | `solar_burst_lv1` | 同上 | 高 |
| `solar_burst_lv2_neutral` | ソーラーフレア(Lv2)（垂直） | `d dl l plus p_h` | `solar_burst_lv2` | 同上 | 高 |
| `solar_burst_lv2_forward` | ソーラーフレア(Lv2)（前方） | `d dl l plus p_h` | `solar_burst_lv2` | 同上 | 高 |
| `solar_burst_lv3_neutral` | ソーラーフレア(Lv3)（垂直） | `d dl l plus p_h` | `solar_burst_lv3` | 同上 | 高 |
| `solar_burst_lv3_forward` | ソーラーフレア(Lv3)（前方） | `d dl l plus p_h` | `solar_burst_lv3` | 同上 | 高 |
| `vanishing_sun_backward` | サンバニッシュ（後方） | `l plus k k k` | `vanishing_sun_backward` | move_code 完全一致 | 高 |
| `vanishing_sun_foward` | サンバニッシュ（前方） | `r plus k k k` | `vanishing_sun_forward` | 日本語名一致(英名改名で code 突合が外れたもの) | 高 |

## kimberly(78 件補完)

| move_code | name_ja | 補完 command | 対応 dist code | 突合根拠 | 確信度 |
|---|---|---|---|---|---|
| `standing_light_punch` | 立ち弱P | `p_l` | `standing_light_punch` | move_code 完全一致 | 高 |
| `standing_light_kick` | 立ち弱K | `k_l` | `standing_light_kick` | move_code 完全一致 | 高 |
| `standing_medium_punch` | 立ち中P | `p_m` | `standing_medium_punch` | move_code 完全一致 | 高 |
| `standing_medium_kick` | 立ち中K | `k_m` | `standing_medium_kick` | move_code 完全一致 | 高 |
| `standing_heavy_punch` | 立ち強P | `p_h` | `standing_heavy_punch` | move_code 完全一致 | 高 |
| `standing_heavy_kick` | 立ち強K | `k_h` | `standing_heavy_kick` | move_code 完全一致 | 高 |
| `crouching_light_punch` | しゃがみ弱P | `d plus p_l` | `crouching_light_punch` | move_code 完全一致 | 高 |
| `crouching_light_kick` | しゃがみ弱K | `d plus k_l` | `crouching_light_kick` | move_code 完全一致 | 高 |
| `crouching_medium_punch` | しゃがみ中P | `d plus p_m` | `crouching_medium_punch` | move_code 完全一致 | 高 |
| `crouching_medium_kick` | しゃがみ中K | `d plus k_m` | `crouching_medium_kick` | move_code 完全一致 | 高 |
| `crouching_heavy_punch` | しゃがみ強P | `d plus p_h` | `crouching_heavy_punch` | move_code 完全一致 | 高 |
| `crouching_heavy_kick` | しゃがみ強K | `d plus k_h` | `crouching_heavy_kick` | move_code 完全一致 | 高 |
| `jumping_light_punch` | ジャンプ弱P | `p_l` | `jumping_light_punch` | move_code 完全一致 | 高 |
| `jumping_light_kick` | ジャンプ弱K | `k_l` | `jumping_light_kick` | move_code 完全一致 | 高 |
| `jumping_medium_punch` | ジャンプ中P | `p_m` | `jumping_medium_punch` | move_code 完全一致 | 高 |
| `jumping_medium_kick` | ジャンプ中K | `k_m` | `jumping_medium_kick` | move_code 完全一致 | 高 |
| `jumping_heavy_punch` | ジャンプ強P | `p_h` | `jumping_heavy_punch` | move_code 完全一致 | 高 |
| `jumping_heavy_kick` | ジャンプ強K | `k_h` | `jumping_heavy_kick` | move_code 完全一致 | 高 |
| `drive_impact` | ドライブインパクト | `p_h k_h` | `drive_impact` | move_code 完全一致 | 高 |
| `throw_forward` | 前投げ | `n or r plus p_l k_l` | `throw_forward` | move_code 完全一致 | 高 |
| `throw_back` | 後ろ投げ | `l plus p_l k_l` | `throw_back` | move_code 完全一致 | 高 |
| `drive_parry` | ドライブパリィ | `p_m k_m` | `drive_parry` | move_code 完全一致 | 高 |
| `water_slicer_slide` | 水切り蹴り | `dr plus k_m` | `water_slicer_slide` | move_code 完全一致 | 高 |
| `windmill_kick` | 風車 | `l plus k_h` | `windmill_kick` | move_code 完全一致 | 高 |
| `hisen_kick` | 飛箭蹴 | `r plus k_h` | `hisen_kick` | move_code 完全一致 | 高 |
| `step_up_backward` | 矢来越え(後方)  | `ul` | `step_up` | 公式1行(cmd: ul or u or ur)を方向3分割した手入力行。後方=ul を割当(公式or列挙の分解) | 高 |
| `step_up_neutral` | 矢来越え(垂直)  | `u` | `step_up` | 同上(垂直=u) | 高 |
| `step_up_forward` | 矢来越え(前方) | `ur` | `step_up` | 同上(前方=ur) | 高 |
| `elbow_drop` | 肘落とし | `d plus p_m` | `elbow_drop` | move_code 完全一致 | 高 |
| `bushin_senpukyaku_light` | 弱武神旋風脚 | `d dl l plus k_l` | `bushin_senpukyaku_light` | move_code 完全一致 | 高 |
| `bushin_senpukyaku_medium` | 中武神旋風脚 | `d dl l plus k_m` | `bushin_senpukyaku_medium` | move_code 完全一致 | 高 |
| `bushin_senpukyaku_heavy` | 強武神旋風脚 | `d dl l plus k_h` | `bushin_senpukyaku_heavy` | move_code 完全一致 | 高 |
| `bushin_senpukyaku_od` | OD武神旋風脚 | `d dl l plus k k` | `bushin_senpukyaku_od` | move_code 完全一致 | 高 |
| `aerial_bushin_senpukyaku_od` | OD空中武神旋風脚 | `d dl l plus k k` | `aerial_bushin_senpukyaku_od` | move_code 完全一致 | 高 |
| `aerial_bushin_senpukyaku` | 空中武神旋風脚 | `d dl l plus k` | `aerial_bushin_senpukyaku` | move_code 完全一致 | 高 |
| `sprint_od` | OD疾駆け | `d dr r plus k k` | `sprint_od` | move_code 完全一致 | 高 |
| `sprint` | 疾駆け | `d dr r plus k` | `sprint` | move_code 完全一致 | 高 |
| `emergency_stop_od` | OD急停止 | `p` | `emergency_stop_od` | move_code 完全一致 | 高 |
| `emergency_stop` | 急停止 | `p` | `emergency_stop` | move_code 完全一致 | 高 |
| `torso_cleaver_od` | OD胴刎ね | `k_l` | `torso_cleaver_od` | move_code 完全一致 | 高 |
| `torso_cleaver` | 胴刎ね | `k_l` | `torso_cleaver` | move_code 完全一致 | 高 |
| `shadow_slide_od` | OD影すくい | `k_m` | `shadow_slide_od` | move_code 完全一致 | 高 |
| `shadow_slide` | 影すくい | `k_m` | `shadow_slide` | move_code 完全一致 | 高 |
| `neck_hunter_od` | OD首狩り | `k_h` | `neck_hunter_od` | move_code 完全一致 | 高 |
| `neck_hunter` | 首狩り | `k_h` | `neck_hunter` | move_code 完全一致 | 高 |
| `bushin_izuna_otoshi_od` | OD武神イズナ落とし | `p` | `bushin_izuna_otoshi_od` | move_code 完全一致 | 高 |
| `bushin_izuna_otoshi` | 武神イズナ落とし | `p` | `bushin_izuna_otoshi` | move_code 完全一致 | 高 |
| `bushin_hojin_kick_od` | OD武神鉾刃脚 | `k` | `bushin_hojin_kick_od` | move_code 完全一致 | 高 |
| `bushin_hojin_kick` | 武神鉾刃脚 | `k` | `bushin_hojin_kick` | move_code 完全一致 | 高 |
| `vagabond_edge_light` | 弱流転一文字 | `d dr r plus p_l` | `vagabond_edge_light` | move_code 完全一致 | 高 |
| `vagabond_edge_medium` | 中流転一文字 | `d dr r plus p_m` | `vagabond_edge_medium` | move_code 完全一致 | 高 |
| `vagabond_edge_heavy` | 強流転一文字 | `d dr r plus p_h` | `vagabond_edge_heavy` | move_code 完全一致 | 高 |
| `vagabond_edge_od` | OD流転一文字 | `d dr r plus p p` | `vagabond_edge_od` | move_code 完全一致 | 高 |
| `hidden_variable_od` | OD彩隠形 | `d dl l plus p p` | `hidden_variable_od` | move_code 完全一致 | 高 |
| `hidden_variable` | 彩隠形 | `d dl l plus p` | `hidden_variable` | move_code 完全一致 | 高 |
| `genius_at_play_od` | OD召雷細工 | `d d plus p p` | `genius_at_play_od` | move_code 完全一致 | 高 |
| `genius_at_play` | 召雷細工 | `d d plus p` | `genius_at_play` | move_code 完全一致 | 高 |
| `shuriken_bomb_light` | 弱細工手裏剣 | `d d plus p_l` | `shuriken_bomb_light` | move_code 完全一致 | 高 |
| `shuriken_bomb_medium` | 中細工手裏剣 | `d d plus p_m` | `shuriken_bomb_medium` | move_code 完全一致 | 高 |
| `shuriken_bomb_heavy` | 強細工手裏剣 | `d d plus p_h` | `shuriken_bomb_heavy` | move_code 完全一致 | 高 |
| `shuriken_bomb_spread_light` | 弱乱れ細工手裏剣 | `d d plus p_l p_m` | `shuriken_bomb_spread_light` | move_code 完全一致 | 高 |
| `shuriken_bomb_spread_medium` | 中乱れ細工手裏剣 | `d d plus p_l p_h` | `shuriken_bomb_spread_medium` | move_code 完全一致 | 高 |
| `shuriken_bomb_spread_heavy` | 強乱れ細工手裏剣 | `d d plus p_m p_h` | `shuriken_bomb_spread_heavy` | move_code 完全一致 | 高 |
| `nue_twister_od` | OD荒鵺捻り | `d dr r plus p p` | `nue_twister_od` | move_code 完全一致 | 高 |
| `nue_twister` | 荒鵺捻り | `d dr r plus p` | `nue_twister` | move_code 完全一致 | 高 |
| `sa1_bushin_beats` | SA1 武神乱拍子 | `d dr r d dr r plus k` | `sa1_bushin_beats` | move_code 完全一致 | 高 |
| `sa1_bushin_thunderous_beats` | SA1 武神乱拍子・雷譜 | `d dr r d dr r plus k hold` | `sa1_bushin_thunderous_beats` | move_code 完全一致 | 高 |
| `sa2_bushin_scramble` | SA2 武神天翔亢竜 | `d dl l d dl l plus p` | `sa2_bushin_scramble` | move_code 完全一致 | 高 |
| `sa2_soaring_bushin_scramble` | SA2 空中武神天翔亢竜 | `d dl l d dl l plus p` | `sa2_soaring_bushin_scramble` | move_code 完全一致 | 高 |
| `sa3_bushin_ninjastar_cypher` | SA3 武神顕現神楽 | `d dr r d dr r plus p` | `sa3_bushin_ninjastar_cypher` | move_code 完全一致 | 高 |
| `ca_bushin_ninjastar_cypher` | CA 武神顕現神楽 | `d dr r d dr r plus p` | `ca_bushin_ninjastar_cypher` | move_code 完全一致 | 高 |
| `bushin_tiger_fangs` | 武神虎連牙 | `p_m chain p_h` | `bushin_tiger_fangs` | move_code 完全一致 | 高 |
| `bushin_prism_strikes_2hits` | 武神天架拳(2発止め) | `p_l chain p_m` | `bushin_prism_strikes_2` | TC累積方式のn段止め改名(2発止め↔公式2段目) | 高 |
| `bushin_prism_strikes_3hits` | 武神天架拳(3発止め) | `p_l chain p_m chain p_h` | `bushin_prism_strikes_3` | 同上(3発止め↔3段目) | 高 |
| `bushin_prism_strikes` | 武神天架拳 | `p_l chain p_m chain p_h chain k_h` | `bushin_prism_strikes_4` | TC累積方式(フル↔公式最終段4段目) | 高 |
| `bushin_hellchain_3hits` | 武神獄鎖拳(3発止め) | `p_l chain p_m chain d plus p_h` | `bushin_hellchain_3` | n段止め改名(3発止め↔公式3段目) | 高 |
| `bushin_hellchain` | 武神獄鎖拳 | `p_l chain p_m chain d plus p_h chain k_h` | `bushin_hellchain_4` | TC累積方式(フル↔公式最終段4段目) | 高 |
| `bushin_hellchain_throw` | 武神獄鎖投げ | `p_l chain p_m chain d plus p_h chain d plus k_h` | `bushin_hellchain_throw` | move_code 完全一致 | 高 |

## ken(4 件補完)

| move_code | name_ja | 補完 command | 対応 dist code | 突合根拠 | 確信度 |
|---|---|---|---|---|---|
| `kasai_thrust_kick` | 火砕蹴(OD風鎌蹴り派生) | `r plus k` | `kasai_thrust_kick_kazekama_shin_kick` | 同名3派生技。手入力cond「OD風鎌蹴り派生」↔公式cond「OD風鎌蹴り後に」で一意対応 | 高 |
| `kasai_thrust_kick_during_od_gorai_axe_kick` | 火砕蹴(OD轟雷落とし派生) | `r plus k` | `kasai_thrust_kick_gorai_axe_kick` | 同上(OD轟雷落とし)。code接尾辞一致 | 高 |
| `kasai_thrust_kick_during_od_senka_snap_kick` | 火砕蹴(OD閃火脚派生) | `r plus k` | `kasai_thrust_kick_senka_snap_kick` | 同上(OD閃火脚)。code接尾辞一致 | 高 |
| `triple_flash_kicks_2hits` | 閃光連脚(2発止め) | `k_m chain k_m` | `triple_flash_kicks_2` | TC累積方式のn段止め改名(2発止め↔公式2段目) | 高 |

## ryu(1 件補完)

| move_code | name_ja | 補完 command | 対応 dist code | 突合根拠 | 確信度 |
|---|---|---|---|---|---|
| `axe_kick_2` | かかと落とし | `l plus k_h` | `axe_kick` | 日本語名一致(英名改名で code 突合が外れたもの) | 高 |

## 保留(書込まず・要開発者判断)

| キャラ | move_code | name_ja | 候補 | 理由 | 確信度 |
|---|---|---|---|---|---|
| guile | `sonic_blade_od` | ODソニックブレイド | `l_sonic_blade_od:d dl l plus p_l p_m / m_sonic_blade_od:d dl l plus p_l p_h / h_sonic_blade_od:d dl l plus p_m p_h` | 手入力はOD強度3分割(公式3行: p_l p_m / p_l p_h / p_m p_h)を1行に統合。一意なcommandを特定できない(汎用形 d dl l plus p p は合成になる) | 中 |
| guile | `sonic_break_light` | ソニックブレイク | `sonic_break_single_shot:p p / sonic_break_variation:p` | 公式はソニックブレイク(単発)=p p / (派生)=p の2行(ダメージも同一で判別不能)。手入力1行がどちらか一意に特定できない | 中 |
| lily | `condor_spire_od` | ODコンドルスパイア | `l_condor_spire_od:d dr r plus k_l k_m or k_l k_h / h_condor_spire_od:d dr r plus k_m k_h` | 手入力はOD強度分割(公式2行: k_l k_m or k_l k_h / k_m k_h)を1行に統合。一意なcommandを特定できない | 中 |
| lily | `windclad_od_condor_spire` | [風纏い]ODコンドルスパイア | `windclad_od_l_condor_spire:d dr r plus k_l k_m or k_l k_h / windclad_od_h_condor_spire:d dr r plus k_m k_h` | 同上([風纏い]OD) | 中 |
| lily | `windclad_od_condor_dive_follow_up` | ODコンドルダイブ(派生) | `condor_dive_od:p p p` | 同上([風纏い]) | 中 |
| lily | `condor_dive_follow_up` | コンドルダイブ(派生) | `condor_dive_od:p p p` | ODトマホークバスター中派生の分離行(手入力側の表現補完)。公式は condor_dive_od 1行(p p p)に統合されており、派生時の実入力を公式データから一意に特定できない | 中 |
| kimberly | `arc_step_od` | OD弧空 | (候補なし) | 公式側もcommand空(入力表現なし) | 低 |
| kimberly | `arc_step` | 弧空 | (候補なし) | 公式側もcommand空(入力表現なし) | 低 |
| ken | `aerial_tatsumaki_senpu_kyaku_light` | 空中竜巻旋風脚 | `aerial_tatsumaki_senpu_kyaku:d dl l plus k` | 公式は空中竜巻1行(全強度統合・cmd: d dl l plus k)だが手入力codeは_light接尾辞。公式準拠(d dl l plus k)か強度指定合成(d dl l plus k_l)か一意に決められない | 中 |

**集計**: 補完(書込) 327 件 / 保留 9 件

### 保留 9 件の判断結果(2026-07-14 開発者レビュー)

| 対象 | 判断 |
|---|---|
| guile `sonic_blade_od` / `sonic_break_light`、lily `condor_spire_od` / `windclad_od_condor_spire` | 弱OD/中OD/強ODで性能が大きく変わらない技は意図的に1行へ統合。アプリ側に同時押しボタンを判別する仕組みがあるため問題なし(command 空のまま確定) |
| lily `condor_dive_follow_up` / `windclad_od_condor_dive_follow_up` | 公式データに存在しないがインゲームにはある技。command は割り当てない(確定) |
| kimberly `arc_step` / `arc_step_od` | command がない技。割り当てない(確定) |
| ken `aerial_tatsumaki_senpu_kyaku_light` | `_light` 接尾辞は入力ミス(開発者が code から除去済み)。公式統合行の command を補完(下記追記1) |

### 追記補完・修正(2026-07-14 開発者レビュー反映)

| # | キャラ | move_code | 内容 | 根拠 | 確信度 |
|---|---|---|---|---|---|
| 1 | ken | `aerial_tatsumaki_senpu_kyaku` | command 補完: `d dl l plus k` | 公式 `aerial_tatsumaki_senpu_kyaku`(強度統合1行)と一致(上記保留の解消) | 高 |
| 2 | ken | `triple_flash_kicks` | command 修正: `k_m chain k_m` → `k_m chain k_m chain k_h` | フル行に2発止めの command が入っていた(レポート B-8)。公式最終段(3段目は強K)の command を採用 | 高 |
| 3 | ingrid | `solar_burst_light_neutral` / `solar_burst_light_forward` | 行追加(入力漏れ・フレーム値は開発者提供)+ command 補完: `d dl l plus p_l` | 公式 `solar_burst_light`(方向で command 不変の1行)。方向分割は手入力側の表現補完(教訓9と同型) | 高 |

### move_code 改名(2026-07-14 開発者指示・レポート B-5)

- guile `perfect_timing_od_sonic_cross1_od` → `sonic_cross_2_meter_od`(ODソニッククロス・2ゲージ消費版。番号では分かりにくいためゲージ消費量を例外的に命名へ使用)
- guile `sonic_cross2_od_od` → `sonic_cross_3_meter_od`(同・3ゲージ消費版)
- ingrid `vanishing_sun_foward` → `vanishing_sun_forward`(typo 修正)

※上部の補完履歴・下記の整形対象一覧はチェック時点の記録のため**改名前の code** のまま。

### is_derived ルール追加(2026-07-14 開発者指示)

**強化版(状態強化バリエーション)は is_derived=true とする**: [焔版](mai)・[風破](juri)・[風纏い](lily)・[奮迅脚](ken)・[電刃錬気](ryu)等。派生技ではないが、**基底版と同一 command で被る場合の対処フラグ**として true が必要。今回 46 行を false→true へ変更(lily 12・juri 3・mai 23・ryu 8。ken [奮迅脚]系は既に true)。ホールド版(`hold` トークン付き)でも強化版側の行は true(例: mai `flame_*_kachousen_holding`)。状態付与技そのもの(ryu `denjin_charge` 等)は対象外。

## 整形対象 — 公式備考欄由来の条件残留(取込ツールのバグ疑い・開発者が手作業で整形)

手入力 CSV の `condition_ja` / `condition_en` 列に、公式フレーム表の備考欄由来の条件(「（ジャンプ中に）」「（近距離で）」「（体力25%以下で）」等)が転記されたまま残っている行がある。取込ツール(`reconcile.EnrichCommand` 系)が command 補完と同時に条件列も転記する挙動とみられる(**根拠**: 突合が全く走っていなかった guile / juri / kimberly / zangief の 4 キャラは条件残留 0 行、走っていた 6 キャラのみに残留)。**修正は開発者が手作業で行う**(本チェックでは一覧化のみ)。

チェック時点(HEAD)の残留行(計は表末尾):

| キャラ | condition_ja | 件数 | 対象 move_code |
|---|---|---|---|
| terry | （ジャンプ中に） | 6 | `jumping_light_punch`、`jumping_light_kick`、`jumping_medium_punch`、`jumping_medium_kick`、`jumping_heavy_punch`、`jumping_heavy_kick` |
| terry | （近距離で） | 2 | `throw_forward`、`throw_back` |
| terry | （体力25%以下で） | 1 | `ca_rising_fang` |
| lily | （ジャンプ中に） | 10 | `jumping_light_punch`、`jumping_light_kick`、`jumping_medium_punch`、`jumping_medium_kick`、`jumping_heavy_punch`、`jumping_heavy_kick`、`great_spin`、`sa2_soaring_thunderbird`、`windclad_sa2_soaring_thunderbird`、`double_arrow` |
| lily | （近距離で） | 7 | `throw_forward`、`throw_back`、`mexican_typhoon_light`、`mexican_typhoon_medium`、`mexican_typhoon_heavy`、`mexican_typhoon_od`、`sa3_raging_typhoon` |
| lily | （垂直 or 前ジャンプ中に） / （ODトマホークバスター中に） | 1 | `condor_dive_od` |
| lily | （垂直 or 前ジャンプ中に） | 2 | `condor_dive`、`windclad_condor_dive` |
| lily | （近距離で） / （体力25%以下で） | 1 | `ca_raging_typhoon` |
| mai | （ジャンプ中に） | 6 | `jumping_light_punch`、`jumping_light_kick`、`jumping_medium_punch`、`jumping_medium_kick`、`jumping_heavy_punch`、`jumping_heavy_kick` |
| mai | （近距離で） | 2 | `throw_forward`、`throw_back` |
| mai | （OD 花蝶扇ホールド後に） | 1 | `midare_kachousen` |
| mai | （体力25%以下で） | 1 | `ca_shiranui_ryuu_enbu_ada_zakura` |
| ingrid | （ジャンプ中に） | 6 | `jumping_light_punch`、`jumping_light_kick`、`jumping_medium_punch`、`jumping_medium_kick`、`jumping_heavy_punch`、`jumping_heavy_kick` |
| ingrid | （近距離で） | 2 | `throw_forward`、`throw_back` |
| ingrid | （サンシンボルストック2つ以上） | 2 | `sun_flare_lv3`、`sun_flare_lv3_od` |
| ingrid | （サンシンボルストック無し） | 1 | `sun_flare_lv1_od` |
| ingrid | （サンシンボルストック1つ） | 1 | `sun_flare_lv2_od` |
| ingrid | （体力25%以下で） | 1 | `ca_cosmic_ray` |
| ken | （ジャンプ中に） | 6 | `jumping_light_punch`、`jumping_light_kick`、`jumping_medium_punch`、`jumping_medium_kick`、`jumping_heavy_punch`、`jumping_heavy_kick` |
| ken | （近距離で） | 2 | `throw_forward`、`throw_back` |
| ken | （奮迅脚中に） | 6 | `emergency_stop`、`thunder_kick`、`forward_step_kick`、`quick_dash_shoryuken`、`quick_dash_tatsumaki_senpu_kyaku`、`quick_dash_dragonlash_kick` |
| ken | （前ジャンプ中に） | 1 | `aerial_tatsumaki_senpu_kyaku_od` |
| ken | （OD迅雷脚中に） | 3 | `kazekama_shin_kick_od`、`gorai_axe_kick_od`、`senka_snap_kick_od` |
| ken | （迅雷脚中に） | 3 | `kazekama_shin_kick`、`gorai_axe_kick`、`senka_snap_kick` |
| ken | （体力25%以下で） | 1 | `ca_shinryu_reppa` |
| ryu | （ジャンプ中に） | 6 | `jumping_light_punch`、`jumping_light_kick`、`jumping_medium_punch`、`jumping_medium_kick`、`jumping_heavy_punch`、`jumping_heavy_kick` |
| ryu | （近距離で） | 2 | `throw_forward`、`throw_back` |
| ryu | （前ジャンプ中に） | 2 | `aerial_tatsumaki_senpu_kyaku_od`、`aerial_tatsumaki_senpu_kyaku` |
| ryu | （体力25%以下で） | 1 | `ca_shin_shoryuken` |

**計 86 行**(guile / juri / kimberly / zangief は 0 行)。

**command 列への条件残留(cond{…} トークン)**: 以下 2 行は公式データの command 表現をそのまま補完したため、条件トークンが command 内に残っている。整形対象(条件部の除去 or 開発者方針での再表現):

- guile `sonic_cross_od`: `r plus p p or cond{（ODソニックブレイド中に）} r plus p`
- guile `perfect_timing_od_sonic_cross1_od`(2026-07-14 に `sonic_cross_2_meter_od` へ改名): 同上

**参考(条件ではないが複合表現・整形要否は開発者判断)**: 前投げ系の `n or r plus p_l k_l`(zangief を除く 9 キャラ)、guile `flying_mare`(同形)・`sa1_sonic_hurricane_side`(`… plus p_l or p_m`)、ingrid `sun_flare_lv1` / `solar_burst_lv1_neutral` / `solar_burst_lv1_forward`(`… alt_sep …` の 2 入力併記)。M14-03b §4.8 では cond{…} 残留行と未知トークン行は索引非搭載(fail しない)の扱い。

## 教訓 — 残り 20 キャラで再発しそうな突合外れパターン

今回 10 キャラで command が空になっていた原因と、突合を復旧した手がかりの類型。次回の補完担当はこの順で突合すると速い。

1. **突合が全く走っていないキャラがある**: guile / juri / kimberly / zangief は通常技(立ち弱P 等)含め **全行 command 空**だった(`EnrichCommand` 未実行相当)。残り 20 キャラもまず「そのキャラの空件数」を数え、全行空なら機械突合(move_code 完全一致)だけで大半が埋まる。
2. **ホールド版の改名(全滅パターン)**: 公式 `_charged` → 手入力 `_holding`、かつ語順も変更(公式 `kachousen_charged_light` → 手入力 `kachousen_holding_light`)。ホールド版は**一律 command 空**になる。公式 command は「基底 command + `hold` トークン」で全キャラ統一なので、基底技から合成できる(イングリッド強サンシュートのように公式に行が無い場合も同パターンで合成可)。
3. **強化版プレフィックスの改名(キャラごとに別語)**: 公式 `boosted_` → 舞 `flame_`([焔版])・ジュリ `fuha_`([風破])。次のキャラでも「公式 [強化版] 系 → インゲーム固有名」への置換が起きうる。日本語名から對応付けるのが確実(強化版⇔焔版などの表記置換を吸収して比較)。
4. **OD 強度分割の語順・綴り違い**: 公式 `l_/m_/h_<技>_od`(3分割) → 手入力 `od_<技>_light/medium/heavy` 等、強度をスペルアウトし語順を入替。日本語名は一致するので日本語名フォールバックで解決。
5. **手入力が OD 分割を 1 行へ統合した技は一意 command なし**: guile ソニックブレイド OD・lily コンドルスパイア OD。公式はボタン組合せ別に別 command なので、統合行には自動で埋めない(要開発者判断)。
6. **ターゲットコンボの「n 段止め」改名**: 公式 `X_2 / X_3`(段番目) → 手入力 `X_2hits`(2発止め)・`X`(フル=最終段)・`X_1hits`(単発)。フル版は**公式の最終段**の command(全段 chain 連結)を持つ。`target-combo-and-derived-flag-rules.md` §2 の累積方式と対応。
7. **同名派生技は condition で対応付け**: ケン火砕蹴 3 種(公式 code 接尾辞 `_kazekama_shin_kick` 等 ↔ 手入力 `_during_od_*`)。condition_ja の「〜後に」が一致の決め手。
8. **汎用名への改名**: 空中投げの固有名(夢桜・斬架閃)→「空投げ」。category=throw + condition(ジャンプ中)で一意対応。
9. **方向分割行(手入力側の表現補完)**: 公式 1 行 → 手入力で方向別分割(キンバリー矢来越え 3 方向・イングリッド ソーラーフレア 垂直/前方)。公式 command が方向で不変ならそのまま流用、`ul or u or ur` のような or 列挙は方向へ分解して割当。
10. **ジャスト版は基底と同一 command**: ガイル【ジャスト】系は補完後の command が基底技と完全同一 → `is_derived=true` の付与判断が必要(別紙ルール §0.2。補完とは別のレポート項目)。
11. **公式側も command 空の技がある**: キンバリー弧空(arc_step / arc_step_od)は公式データに command が無い(疾駆け派生)。候補なしとして開発者判断へ。
12. **move_code の typo は日本語名フォールバックで救済**: イングリッド `vanishing_sun_foward`(forward の typo)は code 突合が外れるが日本語名で対応可(typo 自体は別途報告)。
13. **取込ツールは条件(公式備考欄)も一緒に転記する**: command 補完が走ったキャラでは `condition_ja`/`condition_en` に「（ジャンプ中に）」「（近距離で）」「（体力25%以下で）」等が残留し、まれに command 内にも `cond{…}` トークンが残る(上記「整形対象」参照)。残り 20 キャラでも補完後に条件列・`cond{…}` の掃き取り(整形)を必ず行うこと。
14. **強化版(状態強化バリエーション)は is_derived=true**: [焔版]・[風破]・[風纏い]・[奮迅脚]・[電刃錬気]等の状態強化行は、派生技でなくても基底版と同一 command で被るため is_derived=true にする(2026-07-14 開発者判断。上記「is_derived ルール追加」参照)。残り 20 キャラでも状態強化(インストール)系のバリエーション行には同様に付与する。
15. **SA/CA の日本語名 `SA1 `/`SA2 `/`SA3 `/`CA ` 接頭辞の抜け(手入力時の記入漏れ)**: `super_art`/`critical_art` 行の `name_ja` は他キャラと揃えて `SA1 `/`SA2 `/`SA3 `/`CA ` の接頭辞を付ける規約だが、手入力時に**一部行だけ接頭辞が抜ける**ことがある(英語名側には付いているのに日本語名側だけ抜ける・**同一キャラ内で sa3/ca には付いているのに sa1/sa2 だけ抜ける**等、キャラ内で不整合になる形で出やすい)。強化版タグ付きは**タグの後ろ**に接頭辞を置く(例 `[焔版]SA1 …`・`[風破]SA1 …`)。検出は「そのキャラの super_art/critical_art 行の name_ja が全行 `SA1 `/`SA2 `/`SA3 `/`CA ` で始まるか」を突合し、始まらない行を洗い出す(接尾辞形式 `…(CA)` も接頭辞へ揃える)。command 突合とは独立した name_ja の整形項目。
15. **is_aerial=false かつ command が単方向+ボタン かつ 空中でしか出ない技**: 存在しないこと。あった場合は手動 true 化漏れの可能性があるので開発者判断を求める
16. **rush技 は is_derived=true**: rush技は派生技でなくても基底版と同一 command で被るため is_derived=true にする

---

# 第2バッチ(2026-07-22・jamie / luke / manon / m_bison / rashid)

M14-03b 投入前チェックの残 5 キャラ分。突合基準は `combomgr-importer/dist/` が本環境に無いため、**git 追跡の `combomgr-importer/testdata/golden/<code>.csv` を dist 代用**として使用(開発者承認済み。同一 22 列公式フォーマットの importer 出力)。「対応 golden code」は golden CSV の move_code。公式生値は本ファイルに転記しない。
自動適用範囲(開発者承認): **command 補完(確信度「高」のみ)・move_code typo 修正・is_derived(manon rush)・is_aerial は normal/unique カテゴリのみ**。中/低・判断割れは Phase 4 へ保留。

## jamie(command 35 件補完・すべて確信度「高」)

| move_code | name_ja | 補完 command | 対応 golden code | 突合根拠 | 確信度 |
|---|---|---|---|---|---|
| `phantom_sway_2hits` | 幻酔舞 | `d plus k_h chain k_h` | `phantom_sway_2` | フレーム一致(TC 2段目) | 高 |
| `bitter_strikes_2hits` | 鋭鍾打(2発止め) | `p_l chain k_l` | `bitter_strikes_2` | フレーム完全一致・TC累積n段止め | 高 |
| `bitter_strikes` | 鋭鍾打 | `p_l chain k_l chain p_m` | `bitter_strikes_3` | TC累積フル(公式最終段) | 高 |
| `full_moon_kick_2hits` | 円月脚 | `r plus k_m chain k_m` | `full_moon_kick_2` | フレーム一致(TC 2段目) | 高 |
| `intoxicated_assault_1hit` | [酔いLv3]酩酊襲(2発止め) | `l plus p_h chain p_h` | `intoxicated_assault_2` | フレーム一致・TC累積 | 高 |
| `drink_level_3_intoxicated_assault` | [酔いLv3]酩酊襲 | `l plus p_h chain p_h chain k_h` | `intoxicated_assault_3` | TC累積フル(公式最終段) | 高 |
| `drink_level_4_ransui_haze_3_immediate` | [酔いLv4]乱酔旋(3段目/即時) | `r plus k_h chain l plus k_h chain p` | `ransui_haze_3rd_hit_immediate` | フレーム完全一致 | 高 |
| `drink_level_4_ransui_haze_3_delay` | [酔いLv4]乱酔旋(3段目/ディレイ) | `r plus k_h chain l plus k_h chain p` | `ransui_haze_3rd_hit_delayed` | on_block 一致 | 高 |
| `drink_level_4_senei_kick` | [酔いLv4]旋影脚 | `r plus k_h` | `ransui_haze_1` | フレーム完全一致(強化版 unique・is_derived=false のまま) | 高 |
| `freeflow_strikes_{light,medium,heavy}` | {弱,中,強}流酔拳(単発) | `d dr r plus {p_l,p_m,p_h}` | `freeflow_strikes_1_{light,medium,heavy}` | on_hit/on_block・damage 一致 | 高 |
| `freeflow_strikes_od` | OD流酔拳(単発) | `d dr r plus p p` | `freeflow_strikes_1_od` | 同上 | 高 |
| `freeflow_strikes_2hits_{light,medium,heavy}` | {弱,中,強}流酔拳(2発止め) | `d dr r plus {p_l,p_m,p_h} chain r plus p` | `freeflow_strikes_2_{light,medium,heavy}` | on_block 一致 | 高 |
| `freeflow_strikes_2hits_od` | OD流酔拳(2発止め) | `d dr r plus p p chain r plus p` | `freeflow_strikes_2_od` | on_block 一致 | 高 |
| `freeflow_strikes_1hit_{light,medium,heavy}` | {弱,中,強}流酔拳(フル) | `d dr r plus {p_l,p_m,p_h} chain r plus p chain r plus p` | `freeflow_strikes_3_{light,medium,heavy}` | on_block 一致 | 高 |
| `freeflow_strikes_1hit_od` | OD流酔拳(フル) | `d dr r plus p p chain r plus p chain r plus p` | `freeflow_strikes_3_od` | on_block 一致 | 高 |
| `freeflow_kicks_2hit_{light,medium,heavy}` | {弱,中,強}流酔脚(2発止め) | `d dr r plus {p_l,p_m,p_h} chain r plus k` | `freeflow_kicks_2_{light,medium,heavy}` | フレーム・on_block 一致 | 高 |
| `freeflow_kicks_2hit_od` | OD流酔脚(2発止め) | `d dr r plus p p chain r plus k` | `freeflow_kicks_2_od` | 同上 | 高 |
| `freeflow_kicks_{light,medium,heavy}` | {弱,中,強}流酔脚(フル) | `d dr r plus {p_l,p_m,p_h} chain r plus k chain r plus k` | `freeflow_kicks_3_{light,medium,heavy}` | on_block 一致 | 高 |
| `freeflow_kicks_od` | OD流酔脚(フル) | `d dr r plus p p chain r plus k chain r plus k` | `freeflow_kicks_3_od` | on_block 一致 | 高 |
| `drink_level_4_freeflow_strikes_1hit_{light,medium,heavy}` | [酔いLv4]{弱,中,強}流酔拳(単発) | `d dr r plus {p_l,p_m,p_h}` | `drink_level_4_{l,m,h}_freeflow_strikes_1` | on_hit/on_block 一致(golden が button 分離) | 高 |
| `drink_level_4_freeflow_strikes_1hit_od` | [酔いLv4]OD流酔拳(単発) | `d dr r plus p p` | `drink_level_4_od_freeflow_strikes_1` | on_block 一致 | 高 |
| `drink_level_4_freeflow_strikes_2hits_od` | [酔いLv4]OD流酔拳(2発止め) | `d dr r plus p p chain r plus p` | `drink_level_4_od_freeflow_strikes_2` | on_block 一致 | 高 |
| `drink_level_4_freeflow_strikes_od` | [酔いLv4]OD流酔拳(フル) | `d dr r plus p p chain r plus p chain r plus p` | `drink_level_4_od_freeflow_strikes_3` | on_block 一致 | 高 |

## luke(command 11 件補完・確信度「高」)

| move_code | name_ja | 補完 command | 対応 golden code | 突合根拠 | 確信度 |
|---|---|---|---|---|---|
| `double_impact_1hit` | ダブルインパクト(単発) | `r plus p_h` | `double_impact_1` | フレーム・damage 一致 | 高 |
| `double_impact` | ダブルインパクト | `r plus p_h chain p_h` | `double_impact_2` | TC累積フル・on_block 一致 | 高 |
| `flash_knuckle_holding_{light,medium,heavy}` | 【ホールド】{弱,中,強}フラッシュナックル | `d dl l plus {p_l,p_m,p_h} hold` | `flash_knuckle_charged_{light,medium,heavy}` | ホールド版改名(基底+hold)・damage 一致 | 高 |
| `no_chaser_od` | ODノーチェイサー | `p` | `chaser_od` | 名称一致・active/recovery/damage 一致 | 高 |
| `triple_impact_2hits` | トリプルインパクト(2発止め) | `p_l chain p_m` | `triple_impact_2` | フレーム一致・TC累積 | 高 |
| `triple_impact` | トリプルインパクト | `p_l chain p_m chain p_h` | `triple_impact_3` | TC累積フル | 高 |
| `snapback_combo_2hits` | スナップバックコンボ(2発止め) | `p_m chain p_m` | `snapback_combo_2` | フレーム一致 | 高 |
| `snapback_combo_3hits` | スナップバックコンボ(3発止め) | `p_m chain p_m chain p_m` | `snapback_combo_3` | フレーム一致 | 高 |
| `snapback_combo` | スナップバックコンボ | `p_m chain p_m chain p_m chain p_m` | `snapback_combo_4` | TC累積フル | 高 |

## manon(command 2 件補完 + is_derived rush 15 件)

command 補完:
| move_code | name_ja | 補完 command | 対応 golden code | 突合根拠 | 確信度 |
|---|---|---|---|---|---|
| `en_haut` | アン・オー | `l plus k_m chain k_m` | `en_haut_2` | フレーム完全一致(TC 2段目) | 高 |
| `en_haut_1hit` | アン・オー(単発) | `l plus k_m` | `en_haut_1` | フレーム一致(TC 1段目) | 高 |

is_derived 修正: `rush_*` 15 行(rush_standing_* 6・rush_crouching_* 6・rush_reverence・rush_tomoe_derriere・rush_en_haut_1hit)を **is_derived=false → true**(教訓16「rush=true」ルール)。

## m_bison(move_code typo 8 件 + command 14 件補完)

move_code typo(`psyco`→`psycho`)を修正しつつ command 補完(8 行)、および mine_set 派生 6 行の command 補完:
| move_code(修正後) | name_ja | 補完 command | 対応 golden code | 突合根拠 | 確信度 |
|---|---|---|---|---|---|
| `psycho_crusher_attack_{light,medium,heavy}` ※typo修正 | {弱,中,強}サイコクラッシャーアタック | `charge_l r plus {p_l,p_m,p_h}` | `psycho_crusher_attack_{light,medium,heavy}` | 日本語名+並び順一致(typo で code 突合外れ→修正) | 高 |
| `psycho_crusher_attack_od` ※typo修正 | ODサイコクラッシャーアタック | `charge_l r plus p p` | `psycho_crusher_attack_od` | 同上 | 高 |
| `mine_set_{light,medium,heavy}_psycho_crusher_attack` ※typo修正 | [サイコマイン付着中]{弱,中,強}サイコクラッシャー | `charge_l r plus {p_l,p_m,p_h}` | `when_psycho_mine_is_embedded_{l,m,h}_psycho_crusher_attack` | 状態変化派生・基底と同一入力 | 高 |
| `mine_set_od_psycho_crusher_attack` ※typo修正 | [サイコマイン付着中]ODサイコクラッシャー | `charge_l r plus p p` | `when_psycho_mine_is_embedded_od_psycho_crusher_attack` | 同上 | 高 |
| `mine_set_{light,medium,heavy}_backfist_combo` | [サイコマイン付着中]{弱,中,強}バックフィストコンボ | `d dl l plus {p_l,p_m,p_h}` | `when_psycho_mine_is_embedded_{l,m,h}_backfist_combo` | 状態変化派生・基底 backfist_combo と同一入力 | 高 |
| `mine_set_od_backfist_combo` | [サイコマイン付着中]ODバックフィストコンボ | `d dl l plus p p` | `when_psycho_mine_is_embedded_od_backfist_combo` | 同上 | 高 |
| `mine_set_od_devil_reverse` | [サイコマイン付着中]ODデビルリバース | `p p alt_sep p` | `when_psycho_mine_is_embedded_od_devil_reverse` | 状態変化派生・基底 devil_reverse_od と同一入力 | 高 |
| `mine_set_devil_reverse` | [サイコマイン付着中]デビルリバース | `p` | `when_psycho_mine_is_embedded_devil_reverse` | 同上 | 高 |

## rashid(move_code typo 1 件 + command 17 件補完)

| move_code | name_ja | 補完 command | 対応 golden code | 突合根拠 | 確信度 |
|---|---|---|---|---|---|
| `buffed_tempest_moon` | 【強化】テンペスト・ムーン | `r plus k` | `air_current_boosted_tempest_moon` | 気流強化=基底と同一入力・damage 一致 | 高 |
| `buffed_{light,medium,heavy}_spinning_mixer` | 【強化】{弱,中,強}スピニング・ミキサー | `d dr r plus {p_l,p_m,p_h}` | `air_current_boosted_{l,m,h}_spinning_mixer` | 名称・damage 一致 | 高 |
| `buffed_od_spinning_mixer` | 【強化】ODスピニング・ミキサー | `d dr r plus p p` | `air_current_boosted_od_spinning_mixer` | 同上 | 高 |
| `buffed_{light,medium,heavy}_eagle_spike` | 【強化】{弱,中,強}イーグル・スパイク | `d dl l plus {k_l,k_m,k_h}` | `air_current_boosted_{l,m,h}_eagle_spike` | 名称・フレーム一致 | 高 |
| `buffed_od_eagle_spike` | 【強化】ODイーグル・スパイク | `d dl l plus k k` | `air_current_boosted_od_eagle_spike` | 同上 | 高 |
| `whirlwind_shot_holding_{light,medium,heavy}` | 【ホールド】{弱,中,強}ワールウインド | `d dr r plus {k_l,k_m,k_h} hold` | `whirlwind_shot_charged_{light,medium,heavy}` | ホールド版改名(基底+hold)・damage 一致 | 高 |
| `whirlwind_shot_max_holding_{light,medium,heavy}` | 【最大ホールド】{弱,中,強}ワールウインド | `d dr r plus {k_l,k_m,k_h} hold` | `whirlwind_shot_longest_possible_button_hold_{light,medium,heavy}` | 公式 charged/longest は同一 command | 高 |
| `whirlwind_shot_holding_od` | 【ホールド】ODワールウインド | `d dr r plus k k hold` | `whirlwind_shot_charged_od` | 基底+hold・damage 一致 | 高 |
| `sa1_super_rashid_kick` ※typo修正 | SA1 スーパー・ラシード・キック | `d dr r d dr r plus k` | `sa1_super_rashid_kick` | 名称・フレーム一致(move_code typo `rahshid`→`rashid` 修正) | 高 |

## 保留(Phase 4 で個別確認・今回書き込まず)

| キャラ | 対象 | 内容 | 理由 |
|---|---|---|---|
| jamie | `drink_level_4_ransui_haze_2_retreat` | command 候補 `r plus k_h chain l plus k_h`(中〜高) | golden 一致根拠が recovery のみ・厳密には高に満たず |
| jamie | 酔い状態強化版(drink_level_* 推定)・dl4_freeflow_strikes 非OD 2hits/full・dl4_freeflow_kicks 全て・the_devil_inside_up 系 | command 候補(中) | golden 専用行なし/button 一意化不能 |
| jamie | `luminous_dive_kick_*`(is_aerial false→true 疑い) | category=**special** のため今回未適用 | is_aerial は normal/unique のみ適用の方針(開発者) |
| jamie | `drink_level_4_freeflow_strikes_2hits_heavy` damage=115 | 桁落ち疑い | 正値は実測/開発者提供(推測補完しない) |
| luke | `flash_knuckle_holding_*` is_derived=true | hold 版は原則 false | is_derived 修正は未承認範囲 |
| luke | `aerial_flash_knuckle`(row46/47) データ入替・is_aerial・`fatal_shot` is_projectile | 要精査/値判断 | データ入替の解消は開発者確認要 |
| m_bison | `hell_attack` is_aerial false→true 疑い | category=**target_combo** のため今回未適用 | is_aerial は normal/unique のみ適用の方針 |
| rashid | `arabian_skyhigh_*` is_aerial false→true 疑い | category=**special** のため今回未適用 | 同上。`front_flip` は逆方向(seed true/golden false)で要確認 |
| manon | メダルLv custom_states 未定義 | 今回スコープ外(別途対応・開発者方針) | seed に状態定義なし |
| 全キャラ | rush_* の command 空・ジャンプ通常技の A-2 補正 | command 空維持・補正未適用 | rush は original_move_code で段階1解決(空維持)・A-2 は可変のため提案しない |

**第2バッチ集計**: command 補完(書込) 79 件(jamie 35・luke 11・manon 2・m_bison 14・rashid 17)/ move_code typo 修正 9 件(m_bison 8・rashid 1)/ is_derived 修正 15 件(manon rush)。保留は Phase 4 へ。

## 教訓追記(第2バッチで判明・残キャラへ)

17. **状態変化派生(mine_set / air_current 等)は基底と同一 command**: ベガ [サイコマイン付着中]・ラシード [気流強化] は、状態が乗った同技バリエーションで、公式 command は基底技と完全同一。基底行の command をそのまま流用してよい(舞 [焔版]・ジュリ [風破] と同型だが、あちらは強化版=is_derived=true、こちらの mine_set/buffed 行は既に is_derived=true 付与済み)。golden code は `when_..._is_embedded_*` / `air_current_boosted_*` と長いが、日本語名(【強化】/[付着中])で対応が取れる。
18. **move_code typo は日本語名+並び順で救済し、typo 自体も修正対象**: ベガ `psyco`(h欠落)・ラシード `rahshid`(綴り誤り)。command 突合を外す原因になるため、typo 修正と command 補完をセットで行う(seed 未投入なら move_code 変更は参照崩れなし)。同キャラ内で一部行だけ綴りが違う形で出やすい(ベガは他行が正しく psycho)。
19. **is_aerial の修正は category を確認してから(normal/unique のみ)**: 空中技でも category=special/target_combo の行(dive kick・空中 TC 等)は今回 is_aerial を触らない方針(開発者)。normal/unique 行に限って明確な誤りを直す。
20. **メダル/酔い等の状態機構が custom_states 未定義のキャラがある**: manon(メダルLv)・jamie(酔いLv=move 内蔵) は lily/juri/mai/kimberly と別に状態機構を持つが seed に custom_states 定義がない。投入前に別テーブル/別工程での扱いを方針確認する(manon は今回スコープ外と決定)。

## 第2バッチ Phase 4 追記(2026-07-22・開発者フィードバック反映)

保留項目への開発者ディレクティブを反映(明示指示分のみ)。

| キャラ | move_code | 修正 | 根拠 | 確信度 |
|---|---|---|---|---|
| jamie | `drink_level_4_ransui_haze_2_retreat` | command 空 → `r plus k_h chain l plus k_h` | 乱酔旋2段目相当と開発者確認(保留の高化) | 高(開発者確認) |
| jamie | `drink_level_4_freeflow_strikes_2hits_heavy` | damage `115` → `1155` | 桁落ち是正(正値は開発者提供) | 高(開発者提供) |
| luke | `flash_knuckle_holding_light`/`_medium`/`_heavy` | is_derived `true` → `false` | ホールド版(`hold`トークン付)は原則 false(別紙§0.2)。command は補完済維持 | 高(開発者指示) |
| luke | `fatal_shot` | is_projectile `false` → `true` | 弾属性(同キャラ sand_blast/sa1_vulcan_blast と整合) | 高(開発者指示) |

**変更不要と確認**: jamie `luminous_dive_kick_*`(is_aerial=false 維持)・m_bison `hell_attack`(既に category=target_combo)・rashid `arabian_skyhigh_*`/`front_flip`・luke `aerial_flash_knuckle`系の is_aerial は現状維持。

**なお保留(未対応・開発者確認待ち/将来)**: (C-1) jamie dl4_freeflow_strikes 非OD 2hits/full・dl4_freeflow_kicks の command 類推補完、(C-2) luke `aerial_flash_knuckle` 46/47 の name_ja/damage 入替是正、(2a) jamie 酔い状態変種の command+is_derived強化版、manon custom_states・入力漏れ行追加(temps_lie/desert_slider)。

## 第2バッチ Phase 4 追加適用(2026-07-22・2a/2b/2c・luke code入替)

開発者指示により保留分を適用。

### 2a: jamie 酔い状態変種の command 補完＋is_derived
基底と同一 command を補完し、is_derived=false のものは true 化(状態変種は基底と索引衝突するため)。
| move_code | 補完 command | is_derived | 備考 |
|---|---|---|---|
| `drink_level_1_standing_light_punch` | `p_l` | false→true | 通常技だが例外的に true(開発者指示) |
| `forward_throw_drink` / `forward_throw_reach_drink_lv4` | `n or r plus p_l k_l chain d plus p_l` | false→true | 前投げ後に「下＋弱パンチ」(開発者指示・p→p_l 訂正) |
| `phantom_sway` / `phantom_sway_drink_and_reach_drink_lv4` | `d plus k_h chain k_h chain p` | true(既) | 幻酔舞3段目相当(末尾 chain p・開発者訂正) |
| `full_moon_kick` / `full_moon_kick_drink_and_reach_drink_lv4` | `r plus k_m chain k_m chain p` | true(既) | 円月脚3段目相当(末尾 chain p・開発者訂正) |
| `drink_level_3_hermits_elbow` | `l plus p_h` | false→true | 基底=仙姑肘 |
| `hermits_elbow`(基底・**command空だった**) | `l plus p_h` | false(維持) | 追加補完。基底 unique が空だったため補完 |
| `drink_level_4_senei_kick` | (既`r plus k_h`) | false→true | 追加。基底 senei_kick と同一 command で衝突→true |
| `the_devil_inside_up2`/`up3`/`up4` + `_reach_drink_lv4`3種 | `d d plus p` | true(既) | 基底=the_devil_inside |

### 2b: jamie dl4 流酔拳(非OD)類推補完(6行)
非DL4系と同一モーションで補完(いずれも is_derived=true 済):
- `drink_level_4_freeflow_strikes_2hits_{light,medium,heavy}` → `d dr r plus {p_l,p_m,p_h} chain r plus p`
- `drink_level_4_freeflow_strikes_{light,medium,heavy}`(フル) → `d dr r plus {p_l,p_m,p_h} chain r plus p chain r plus p`

### 2c: jamie dl4 流酔脚 削除(8行)
`drink_level_4_freeflow_kicks_*`(2hits/フル×弱中強OD)を削除。通常版 `freeflow_kicks_*` と **startup/active/recovery/total・on_hit/on_block・is_aerial/is_projectile/is_derived が完全一致**、差は名称の`[酔いLv4]`と damage のみ(通常版のみ `notes_tool="空振り無理、ガード発動可能"` が付く=注記差)と確認済。ゲームデータ重複のため削除。

### luke `aerial_flash_knuckle` code 入替是正
行46/47 の move_code がデータと逆(高damage/遅発生=ホールド、低damage/速発生=ノーマル)だったため是正:
- (旧46) code `aerial_flash_knuckle`→`aerial_flash_knuckle_holding`、command `d dl l plus p`→`d dl l plus p hold`、is_derived true→false
- (旧47) code `aerial_flash_knuckle_holding`→`aerial_flash_knuckle`、command 空→`d dl l plus p`、is_derived false(維持)
- is_aerial は false 維持(開発者確認)。OD(`aerial_flash_knuckle_od`)影響なし。

### 開発者フィードバック3(2026-07-22)反映
- jamie `drink_level_4_ransui_haze_3_drink_while_retreating`: 乱酔旋(3段目/大幅ディレイ派生)相当と判明 → command `r plus k_h chain l plus k_h chain p` を補完(保留解消)。
- 上記 2a の 前投げ飲酒(p→p_l)・幻酔舞飲酒/円月脚飲酒(末尾 chain p 追加=3段目相当)を訂正済。

### 教訓追記
21. **酔い/状態変種は基底と同一 command＋is_derived=true**(基底と索引衝突回避)。通常技ベースの状態変種(例 [酔いLv1]立ち弱P)も例外的に true。状態変種で基底 command が未補完なら基底も併せて補完する(jamie 仙姑肘の例)。
22. **状態Lvバリエーションが通常版とダメージ以外差分なしなら重複行は削除しうる**(削除前にフレーム/属性/notes の差分点検を必須とし、差があれば報告)。

---

# 第3バッチ(2026-07-31・jp)

M14-03b 投入前チェックの jp 分(seed-progress.md 未登録＝未処理として自動選定)。突合基準は `combomgr-importer/dist/jp.csv`(ローカル既定の `<DIST_DIR>`)。公式生値は本ファイルに転記しない(非 git レポート `tmp/20260731-pre-seed-data-check-report.md` を参照)。
自動適用範囲(開発者承認 2026-07-31): **command 補完(確信度「高」のみ)**。それ以外の是正は開発者が手作業で実施済み(下記「開発者側で実施された是正」)。

## jp(command 2 件補完)

| move_code | name_ja | 補完 command | 対応 dist code | 突合根拠 | 確信度 |
|---|---|---|---|---|---|
| `grom_strelka_1hit` | グロームストレルカ(単発) | `l plus p_m` | `grom_strelka_1`(グロームストレルカ（1段目）) | 教訓6 の n 段止め改名(公式 `_1`＝1段目 ↔ 手入力 `_1hit`＝単発)。フレーム・on_hit/on_block・damage が全一致 | 高 |
| `grom_strelka` | グロームストレルカ | `l plus p_m chain p_m` | `grom_strelka_2`(グロームストレルカ（2段目）) | 教訓6 のフル＝公式最終段。フレーム全一致・damage が累積方式(1段目+2段目)と整合 | 高 |

## command 空のまま確定(開発者判断 2026-07-31)

| move_code | name_ja | 判断 |
|---|---|---|
| `triglav_od` | ODトリグラフ | 手入力が OD 強度 3 分割を 1 行へ統合。一意 command なし。教訓5 と 2026-07-14 裁定(guile `sonic_blade_od` 等)を踏襲 |
| `departure_od` | ODヴィーハト | 同上 |
| `departure_shadow_od` | ODヴィーハト・チェーニ | **派生技のため command なしで確定**(開発者回答)。基底 `departure_shadow` からの合成案は採らない |
| `departure_window_double_warp_od` | ODヴィーハト・アクノ(二連続ワープ) | 同上(派生技・command なしで確定) |
| `rush_*` 16 行 | (ラッシュ版) | 方針どおり空維持(`original_move_code` で段階1 解決) |

## 開発者側で実施された是正(2026-07-31・レポート指摘への対応)

チェック結果を受けて開発者が手入力 CSV を直接修正した分(本コマンドは書込に関与していない)。

| move_code | 是正内容 | 対応レポート項目 |
|---|---|---|
| `tornado`(タルナード) | **行を新規追加**(空中投げの入力漏れ) | B-3 |
| `triglav_od` | on_block の符号を是正 | B-2 |
| `torbalan_heavy` / `torbalan_od` / `embrace` / `embrace_od` | on_hit・on_block の行ズレ転記を是正(`embrace` 系はコマンド投げのため on_block を空へ戻し) | B-1 |
| `ca_interdiction` | name_ja `CAザプリェット` → `CA ザプリェット`(教訓15 の接頭辞スペース抜け) | B-5 |
| `departure_window_double_warp_od` | is_derived false → true(設置状態依存＝単独で出せない) | B-6 |
| `sa2_lovushka` | is_projectile true → false | B-8 |

## 訂正版の選択マージ(2026-07-31・jp / manon / rashid)

開発者が非 git の一時領域へ訂正版 3 ファイル(`jp.csv` / `manon.csv` / `rashid.csv`)を配置し、取込を依頼。取込前の突合で、**訂正版が第2バッチ(2026-07-22)および本バッチ Phase 3 より前のファイルをベースに手直しされており、適用済み補正が計 36 件巻き戻る**ことが判明したため、そのままのマージは行わなかった。

**開発者ディレクティブ(2026-07-31)**: 「現行版(`character_data`)にあるものが王様。**数値系の情報だけ**取り込む。『直前の行のコピー』になっておかしい部分は取込時に直す」。

### 取り込んだ内容

| キャラ | 取込内容 | 種別 |
|---|---|---|
| jp | `tornado` の recovery/total を空中投げ換算値へ | 数値 |
| jp | `torbalan_light` に on_block を補い、`torbalan_medium` の on_block を是正(行ズレ残存分の解消) | 数値 |
| jp | `zilant_low` の notes_tool に「コンボにならないので単発ダメージ」 | 注記 |
| jp | `zilant_mid` の notes_tool に同一注記(開発者指示で取込後に追記・別紙 §2.4 の例外注記運用へ統一) | 注記 |
| manon | `temps_lie`(タン・リエ)行を新規追加 | 行追加 |
| rashid | `desert_slider`(デザート・スライダー)行を新規追加 | 行追加 |

### 取込時に是正した「直前行のコピー」(開発者指示・全件 dist 一致)

| move_code | 訂正版の command(誤) | 取込後 | コピー元 |
|---|---|---|---|
| jp `tornado` | `l plus p_l k_l` | `p_l k_l` | `throw_back` |
| rashid `desert_slider` | `l plus p_l k_l` | `p_l k_l` | `throw_back` |
| manon `temps_lie` | `d plus p_h chain p_h` | `p_h chain p_h` | `allonge`(しゃがみ強P始動) |

### 不採用(現行を維持＝巻き戻り防止)

| キャラ | 維持した内容 | 件数 |
|---|---|---|
| jp | `grom_strelka_1hit` / `grom_strelka` の command(本バッチ Phase 3 で適用) | 2 |
| manon | `en_haut` / `en_haut_1hit` の command(第2バッチ) | 2 |
| manon | rush_variant の `is_derived=true`(第2バッチ・教訓16) | 15 |
| rashid | `buffed_*` 9 件・`whirlwind_shot_*holding*` 7 件の command(第2バッチ) | 16 |
| rashid | move_code `sa1_super_rashid_kick`(綴り誤り修正・教訓18)と その command | 1 |

※ `sa1_super_rashid_kick` は訂正版では旧綴り `sa1_super_rahshid_kick` へ戻っていたが、数値列は現行と完全一致のため数値の取りこぼしはない。

### マージ後の機械確認

- 数値系 7 列(startup/active/recovery/total/on_hit/on_block/damage)が訂正版と全行一致
- 現行にあって訂正版で空だった command の維持: jp 2・manon 2・rashid 16 件
- `is_derived` の巻き戻り不採用: manon 15 件
- 訂正版のみに存在した行の取込漏れ: なし
- フレーム検算(`total = startup + active − 1 + recovery`): 3 ファイルとも NG 0 件

## 未解決(2026-07-31 時点)

**なし**(第3バッチの指摘は全件解消)。

解消の内訳:

| 旧 # | 対象 | 解消方法 |
|---|---|---|
| 1 | jp `torbalan_light` / `torbalan_medium` の on_block 行ズレ残存 | 訂正版の選択マージで数値取込 |
| 2 | jp `tornado` の recovery/total | 同上 |
| 3 | jp `tornado` の command(直前行のコピー) | 取込時に是正 |
| 4 | jp `zilant_mid` / `zilant_low` の例外注記 | `zilant_low` は訂正版に含まれ、`zilant_mid` は開発者指示で同一注記を追記 |
| — | rashid `desert_slider` の入力漏れ(教訓25) | 訂正版の選択マージで行追加 |
| — | manon `temps_lie` の入力漏れ | 同上 |

## 教訓追記(第3バッチで判明・残キャラへ)

23. **空中投げ行の追加は「地上投げ行のコピー」で作られやすい**: jp `tornado` は追加時に `throw_back` の recovery/total(地上投げ値)と command(方向トークン付き)を引きずっていた。空中投げは**ジャンプ全体フレーム基準の換算値**・**方向トークンなしの同時押し**が先例(guile `flying_mare`/`flying_buster_drop`・mai/juri `air_throw`)。入力漏れの指摘後は、追加された行の全列を先例と突合して再確認すること。
24. **行ズレ転記は「投げ技に on_block が入っている」ことで検出できる**: jp の torbalan→embrace で on_hit/on_block が複数行ズレていた。**コマンド投げ(公式 properties=throw)はガード不能＝on_block は空が正**なので、投げ行に値が入っていたら上流の行ズレを疑い、同カテゴリの連続行をまとめて突合する。是正後も**ズレ幅が縮んだだけで先頭行に残る**ことがあるため、再チェック時は全行を再突合する。
25. **空中投げが丸ごと未入力のキャラがある**: jp `tornado`・rashid `desert_slider`(いずれも 2026-07-31 に追加して解消)。突合は「dist 側で category=throw かつ is_aerial=true の行が seed に存在するか」で機械検出できる。なお seed 側の空中投げ行は **is_aerial=false** で登録するのが全先例の運用(dist は true)。
26. **手入力の空中投げの命名は 2 系統ある**: 固有名維持(guile フライングメイヤー・jp タルナード・rashid デザート・スライダー)と汎用名「空投げ」への改名(mai 旧夢桜・juri 旧斬架閃)。教訓8 は後者だが前者も現存するため、**新規キャラでどちらに寄せるかは開発者確認**が要る。
27. **訂正版ファイルの受領時は必ず「巻き戻り」を機械検査する**: 2026-07-31 に受領した訂正版 3 ファイルは、適用済み補正より前のファイルをベースに手直しされており、そのまま上書きすると command 20 件・is_derived 15 件・move_code typo 修正 1 件が失われる状態だった。**現行を base に「数値系の列だけ」を訂正版から取り込む選択マージ**で解決した。受領時の定型チェック＝(a)現行で非空の command が訂正版で空になっていないか、(b)`is_derived` の真偽が反転していないか、(c)move_code の追加/削除ペア(＝改名の巻き戻り)がないか、(d)訂正版のみに存在する行(＝取り込むべき追加行)。
28. **開発者が追加した新規行も「直前行のコピー」由来の誤りを持つ**: 2026-07-31 の追加 3 行(jp `tornado`・rashid `desert_slider`・manon `temps_lie`)は全て command が直前行のコピーで、方向トークンが余分に付いていた(教訓23 の一般化)。**新規追加行は数値だけでなく command も dist と全列突合**すること。

---

# 第4バッチ(2026-08-01・marisa)

M14-03b 投入前チェックの marisa 分(`seed-progress.md` 未登録＝未処理として自動選定、引数でも明示指定)。突合基準は `combomgr-importer/dist/marisa.csv`(ローカル既定の `<DIST_DIR>`)。公式生値は本ファイルに転記しない(非 git レポート `tmp/20260801-pre-seed-data-check-report.md` を参照)。
自動適用範囲(開発者承認 2026-08-01): **command 補完(確信度「高」)・move_code typo 修正・is_aerial 是正・is_derived 是正**の 4 区分すべて。

## marisa(command 33 件補完)

| move_code | name_ja | 補完 command | 対応 dist code | 突合根拠 | 確信度 |
|---|---|---|---|---|---|
| `standing_heavy_punch_holding` ※typo修正 | 【ホールド】立ち強P | `p_h hold` | `standing_heavy_punch_charged` | 教訓2(公式 `_charged` ↔ 手入力 `_holding`)。フレーム・damage 全一致 | 高 |
| `standing_heavy_kick_holding` | 【ホールド】立ち強K | `k_h hold` | `standing_heavy_kick_charged` | 同上 | 高 |
| `crouching_heavy_punch_holding` | 【ホールド】しゃがみ強P | `d plus p_h hold` | `crouching_heavy_punch_charged` | 同上 | 高 |
| `crouching_heavy_kick_holding` | 【ホールド】しゃがみ強K | `d plus k_h hold` | `crouching_heavy_kick_charged` | 同上 | 高 |
| `jumping_heavy_punch_holding` | 【ホールド】ジャンプ強P | `p_h hold` | `jumping_heavy_punch_charged` | 同上 | 高 |
| `jumping_heavy_kick_holding` | 【ホールド】ジャンプ強K | `k_h hold` | `jumping_heavy_kick_charged` | 同上 | 高 |
| `caelum_arc_holding` | 【ホールド】カエルムアーク | `d plus p_h hold` | `caelum_arc_charged` | 同上 | 高 |
| `magna_bunker_holding` | 【ホールド】マグナバンカー | `l plus p_h hold` | `magna_bunker_charged` | 同上 | 高 |
| `novacula` | ノバキュラ(単発) | `r plus p_m` | `novacula_swipe_novacula_thrust_1`(ノバキュラスワイプ/ノバキュラシュート（1段目）) | 公式が2つの TC で「1段目」を共用する行 ↔ 手入力「(単発)」への改名。フレーム・on_hit/on_block・damage 全一致 | 高 |
| `malleus_breaker_1hit` | マレウスビート(単発) | `dr plus p_h` | `malleus_breaker_1` | 教訓6(n段止め改名)。フレーム・damage 全一致 | 高 |
| `malleus_breaker_1hit_holding` | 【ホールド】マレウスビート(単発) | `dr plus p_h hold` | `malleus_breaker_1_charged` | 教訓2+6 | 高 |
| `malleus_breaker` | マレウスビート | `dr plus p_h chain dr plus p_h` | `malleus_breaker_2` | 教訓6(フル＝公式最終段)。フレーム一致・damage は累積方式と整合 | 高 |
| `falx_crusher_1hit` | ファルクスクラッシュ(単発) | `r plus k_h` | `falx_crusher_1` | 同上(1段目) | 高 |
| `falx_crusher_1hit_holding` | 【ホールド】ファルクスクラッシュ(単発) | `r plus k_h hold` | `falx_crusher_1_charged` | 教訓2+6 | 高 |
| `falx_crusher` | ファルクスクラッシュ | `r plus k_h chain r plus k_h` | `falx_crusher_2` | 同上(フル) | 高 |
| `gladius_holding_light` | 【ホールド】弱グラディウス | `d dr r plus p_l hold` | `gladius_charged_light` | 教訓2。フレーム・damage 全一致 | 高 |
| `gladius_holding_medium` | 【ホールド】中グラディウス | `d dr r plus p_m hold` | `gladius_charged_medium` | 同上 | 高 |
| `gladius_holding_heavy` | 【ホールド】強グラディウス | `d dr r plus p_h hold` | `gladius_charged_heavy` | 同上 | 高 |
| `gladius_holding_od` | 【ホールド】ODグラディウス | `d dr r plus p p hold` | `gladius_charged_od` | 同上 | 高 |
| `dimachaerus_1hit_light` | 弱ディマカイルス(単発) | `d dl l plus p_l` | `dimachaerus_1_light` | 教訓6(公式 `_1`＝1段目 ↔ 手入力 `_1hit_`＝単発)。フレーム・damage 一致 | 高 |
| `dimachaerus_light` | 弱ディマカイルス | `d dl l plus p_l chain r plus p` | `dimachaerus_2_light` | 教訓6(フル)。フレーム一致・damage 累積整合 | 高 |
| `dimachaerus_1hit_medium` | 中ディマカイルス(単発) | `d dl l plus p_m` | `dimachaerus_1_medium` | 同上(持続差は未解決 #3) | 高 |
| `dimachaerus_medium` | 中ディマカイルス | `d dl l plus p_m chain r plus p` | `dimachaerus_2_medium` | 同上 | 高 |
| `dimachaerus_1hit_heavy` | 強ディマカイルス(単発) | `d dl l plus p_h` | `dimachaerus_1_heavy` | 同上 | 高 |
| `dimachaerus_heavy` | 強ディマカイルス | `d dl l plus p_h chain r plus p` | `dimachaerus_2_heavy` | 同上 | 高 |
| `dimachaerus_1hit_od` | ODディマカイルス(単発) | `d dl l plus p p` | `dimachaerus_1_od` | 同上 | 高 |
| `dimachaerus_od` | ODディマカイルス | `d dl l plus p p chain r plus p` | `dimachaerus_2_od` | 同上 | 高 |
| `tonitrus_1hit` | トニトルス(単発) | `p` | `tonitrus_1` | 公式は cond（スクトゥム中に）付きの1段目行。damage・on_hit/on_block 一致(発生/硬直差は意図的差分＝構え派生の最速キャンセル基準・空振り値) | 高 |
| `tonitrus` | トニトルス | `p chain p` | `tonitrus_2` | 教訓6(フル)。フレーム一致・damage 累積整合 | 高 |
| `sa1_javelin_of_marisa_holding` | 【ホールド】SA1 マリーザジャベリン | `d dr r d dr r plus p hold` | `sa1_javelin_of_marisa_charged` | 教訓2。フレーム・damage 全一致 | 高 |
| `sa1_javelin_of_marisa_counterattack` | SA1 マリーザジャベリン(当身) | `d dr r d dr r plus p` | `sa1_javelin_of_marisa_physical_counter_version` | 公式の当身派生版行。damage 一致。**基底 SA1 と command 完全同一のため `is_derived=true` を同時付与**(教訓31) | 高 |
| `scutum_max_holding` | 【最大ホールド】スクトゥム | `d dl l plus k hold` | (公式に行なし) | 基底 `scutum` + `hold` の合成(教訓2)。公式 notes に「ボタンホールドで動作延長可」の明記あり。先例＝ingrid 強サンシュート・rashid 【最大ホールド】ワールウインド | 高 |
| `scutum_max_holding_od` | 【最大ホールド】ODスクトゥム | `d dl l plus k k hold` | (公式に行なし) | 同上(基底 `scutum_od`) | 高 |

## 機械的整形(同時適用)

| 区分 | 件数 | 内容 |
|---|---|---|
| move_code typo | 1 | `standing_heavy_punch_holind` → `standing_heavy_punch_holding`(`holding` の g 欠落。同キャラ他5行は正しい綴り。教訓18)。`original_move_code` からの参照なしを機械確認済み |
| `is_aerial` 是正 | 4 | `standing_heavy_punch_holding` / `standing_heavy_kick_holding` / `crouching_heavy_punch_holding` / `crouching_heavy_kick_holding` を **true → false**(地上技。いずれも category=normal で教訓19 の適用範囲内) |
| `is_derived` 是正(ホールド版) | 10 | `jumping_heavy_punch_holding` / `jumping_heavy_kick_holding` / `caelum_arc_holding` / `magna_bunker_holding` / `malleus_breaker_1hit_holding` / `falx_crusher_1hit_holding` / `gladius_holding_{light,medium,heavy,od}` を **true → false**(別紙 §0.2。先例＝zangief・mai・rashid・ingrid、および luke 2026-07-22 の同種是正) |
| `is_derived` 是正(当身派生) | 1 | `sa1_javelin_of_marisa_counterattack` を **false → true**(当身成立時のみ発生＝単独で出せない。かつ補完 command が基底 SA1 と同一で索引衝突。同キャラの `scutum_counterattack` は既に true でキャラ内不整合だった) |

## command 空のまま確定(開発者判断 2026-08-01)

| move_code | name_ja | 判断 |
|---|---|---|
| `tonitrus_1hit_od` / `tonitrus_od` / `procella_od` / `enfold_od` | ODトニトルス(単発)/ODトニトルス/ODプロケッラ/ODエンフォルド | ODスクトゥム派生。公式に OD 行がなく非OD からの合成になるため、**jp `departure_shadow_od` の裁定(2026-07-31)「派生技は command なしで確定」を踏襲**して空維持 |
| `scutum_counterattack` / `scutum_counterattack_od` | スクトゥム(当身)/ODスクトゥム(当身) | 公式側も command 空(条件欄に「※スクトゥム中に打撃を受ける」のみ)＝教訓11。割り当てない |
| `rush_*` 19 行 | (ラッシュ版) | 方針どおり空維持(`original_move_code` で段階1解決)。全行 `is_derived=true` 済み(教訓16) |

## Phase 4 の判断結果(2026-08-01・開発者回答)＋訂正版の取込

Phase 1 で挙げた 7 件はすべて解消。**うち 3 件(#1・#2・#3)は本コマンド側の誤検出**で、手入力が正しかった。

| # | 対象 | 開発者回答 | 措置 |
|---|---|---|---|
| 1 | `magna_bunker_holding` の recovery/total | **現行値が実測どおりで正しい**(公式注記の空振り増加は本技には効いていない)。ラッシュ版も連動不要 | 変更なし(**誤検出**) |
| 2 | `light_two_hitter` の damage | **単発値が正しい**。TC だが通常はコンボにならない技のため累積にしない(別紙 §2.4 の例外・jp `zilant_low` と同型) | 値は変更なし。`notes_tool` に「コンボにならないので単発ダメージ。」を追記(**誤検出**・注記のみ追加) |
| 3 | `dimachaerus_1hit_medium` の active | **4F が正しい**。ディマカイルス 1 段目は強度によらず 4F、5F は 2 ヒット目側 | 変更なし(**誤検出**。現行データは 1段目=4・2段目=5 で規則どおり) |
| 4 | `scutum_counterattack` / `_od` のフレーム全空 | **意図的**。相手の攻撃を待機する技と、受けた後に出る技が別行として扱われるキャラであり(JP アムネジア・ingrid Sun veil は同一技扱い)、コンボにもセットプレイにも使わないため発生系は書かない | 変更なし(意図的差分＝C へ移動) |
| 5 | `volare_combo` の発生/持続 | **ingrid `satelite_leap` と同じ空中ターゲットコンボ扱い**。発生も持続も書かないのが正 | `startup`・`recovery`・`total` に加えて `active` も空へ(ingrid 準拠) |
| 6 | `scutum_max_holding` / `_od` の damage | **0 が正しい** | 訂正版から `0` を取込 |
| 7 | SA1 のフレーム(`input-notes.md` の「おかしいかもしれない」) | 当身版ではなく**基底 SA1 の発生**と**ホールド版の成立**の話。実測 18F に見えるがフレームメーター・公式表記はすべて 19F、ホールド版は 42/43F 溜めても通常版が出る場合がある。いずれも軽微と判断し現行値で登録 | 訂正版から `sa1_javelin_of_marisa` / `_holding` の `notes_tool` を取込 |

### 訂正版 `marisa_merge.csv` の取込(2026-08-01)

- **巻き戻り検査(教訓27)は全項目クリア**: 訂正版は Phase 3 適用後の現行をベースに手直しされており、command が空へ戻った行 0・`is_derived` 反転 0・move_code の追加/削除 0・訂正版のみの行 0。
- **取り込んだ差分は 4 箇所のみ**: `scutum_max_holding` / `_od` の damage、`sa1_javelin_of_marisa` / `_holding` の notes_tool。
- **訂正版に反映されていなかった回答 2 件**(#2 の備考追記・#5 の volare_combo)は、回答本文の指示に沿って本コマンドが適用した。**「修正した」と申告された内容がファイルに入っていないことがある**ため、受領時は回答項目とファイル差分の突合が要る(教訓36)。
- 取込後の機械確認: 108 行 20 列・フレーム検算 NG 0・move_code 重複 0・command 空 25(当身2/OD派生4/rush 19)・`is_derived` true 42・`is_aerial` true 10。

## 教訓追記(第4バッチで判明・残キャラへ)

29. **ホールド版が多いキャラでは `is_derived` がキャラ内で割れる**: marisa は地上ホールド(立ち強P/強K・しゃがみ強P/強K)=false、空中/unique/special のホールド=true と割れていた。別紙 §0.2 は「`hold` トークン付き＝一律 false」(true でよいのは強化版タグ付きホールドとジャスト版のみ)。ホールド版を洗い出したら **キャラ内で `is_derived` が揃っているかを必ず突合**する。
30. **「地上技に `is_aerial=true`」という逆方向の誤りもある**: これまでの指摘は「空中技なのに false」が中心だったが、marisa は地上ホールド 4 行が true だった。ホールド版行はジャンプ強P 等をコピーして作られやすく、**属性列(is_aerial/is_derived)がコピー元のまま残る**(教訓23/28「直前行のコピー」の属性版)。ホールド版の追加行は数値・command に加えて属性列も突合する。
31. **当身派生版(公式 `*_physical_counter_version`)は 2 系統ある**: (a) SA の当身派生版＝公式 command が**基底 SA と完全同一** → 補完すると索引衝突するのでジャスト版(教訓10)と同じく `is_derived=true` が要る。(b) 構え技(スクトゥム等)の当身派生版＝**公式側も command 空** → 補完しない(教訓11)。どちらかを公式 command 列の有無で判定する。
32. **公式が「全体 NN」しか持たない構え技は、手入力側で発生/持続/硬直へ分解されている**: marisa スクトゥム(通常/OD)は公式に発生・持続がなく全体のみ。手入力は全体が公式と一致するように 3 列へ分解済み。**「公式が空なのに手入力に値がある」は欠落補完**であってミスではない(教訓の (g) 系)。
33. **構え派生の発生ズレは「全技で同一オフセット」なら意図的**: marisa のスクトゥム派生 3 技(トニトルス/プロケッラ/エンフォルド)は公式比が全て同じ量だけ大きく、派生元からの最速キャンセル基準(キンバリー型)と一致した。**1 技だけズレていれば疑う・同じ構えの全技が同量ズレていれば意図的**、という切り分けが使える。
34. **「同系の中で 1 行だけ違う」は取りこぼしとは限らない(第4バッチの誤検出 3 件の教訓)**: marisa では (a) 空振り硬直の置換が 4 行中 3 行だけ適用、(b) TC 累積ダメージが 3 兄弟のうち 2 行だけ適用、(c) 持続が同系 4 行中 1 行だけ公式と不一致、の 3 つを「1 行だけの漏れ」として B に挙げたが、**開発者回答では 3 件とも手入力が正しかった**(公式注記の空振り増加が効かない技・通常はコンボにならない TC は単発値が正・1段目と2段目で持続が異なるのが規則どおり)。検出手法(公式 notes の「空振り時硬直+NF」行の全抽出、TC の「1段目+当該段 ≒ 記録値」検算)自体は有効なので続けるが、**「規則から外れて見える 1 行」は断定せず、確信度を落として開発者判断へ回す**こと。とくに公式注記の条件付き増加(空振り・アーマーヒット等)は技によって効かない場合がある。
35. **TC でも「通常はコンボにならない段」は累積でなく単発ダメージが正**: marisa `light_two_hitter`(ライトワンツー)。別紙 §2.4 の「地上不成立 TC の例外」と同型で、jp `zilant_low`/`zilant_mid` と同じく **`notes_tool` に「コンボにならないので単発ダメージ」と注記して残す**のが確立運用。累積検算に合わない TC を見つけたら、まずこの例外に該当しないかを確認する。
36. **「相手の攻撃を受けて初めて発動する技」は待機技と発動技の分割方式がキャラで異なる**: JP アムネジア・ingrid Sun veil は待機と発動が同一技扱いだが、marisa スクトゥムは**待機(構え)と当身発動が別行**。別行のキャラでは発動側の発生/持続/硬直は空が正(コンボにもセットプレイにも使わないため)。公式に値があっても手入力が空なのはミスではない。
37. **空中ターゲットコンボの 2 段目以降は `startup`・`active` も書かない**: 先例 ingrid `satelite_leap`(発生/持続/硬直/全体すべて空・damage と command のみ)。marisa `volare_combo` も同扱いへ揃えた。別紙 §2.5 の「TC 2 段目以降は startup/total NULL」より一段強い運用が**空中 TC には適用される**(着地基準の値が意味を持たないため)。
38. **開発者から訂正版ファイルを受領したら、回答本文の項目とファイル差分を突合する**: 2026-08-01 の `marisa_merge.csv` は回答 4 件のうち 2 件(TC の備考追記・空中 TC の発生/持続クリア)が反映されていなかった。教訓27 の巻き戻り検査(a)〜(d) に加えて、**(e) 回答で「修正した」と申告された項目が実際にファイル差分へ現れているか**を確認し、欠けていれば回答本文の指示に沿って適用する。

---

## 第5バッチ(2026-08-19・aki / akuma / cammy / chun_li / e_honda / ed / elena)

**★本バッチは公式 dist 未接続のまま実施した部分適用である。** `combomgr-importer` がセッションにマウントされておらず、**公式突合を要する command 補完(check-criteria §1-1 の本体)は未実施**。以下は **CSV 内部の情報だけで確信度「高」に達した分**であり、残りは importer 接続後の再実行へ引き継ぐ。

### command 補完(6 件・CSV 内部からの復元)

| char | move_code | name_ja | 補完 command | 突合根拠 | 確信度 | 備考 |
|---|---|---|---|---|---|---|
| cammy | `cannon_spike_light` | 弱キャノンスパイク | `r d dr plus k_l` | **同一ファイルの `cannon_spike_heavy`(`r d dr plus k_h`)から強度接尾辞のみ差替え**。公式は参照していない | 高 | move_code 是正(下記)と同時 |
| cammy | `cannon_spike_medium` | 中キャノンスパイク | `r d dr plus k_m` | 同上 | 高 | 同上 |
| cammy | `cannon_spike_od` | ODキャノンスパイク | `r d dr plus k k` | 同上(OD は `k k`＝同キャラ他技と同形) | 高 | 同上 |
| ed | `psycho_flicker_holding_light` | 【ホールド】弱サイコフリッカー | `d dr r plus k_l hold` | **通常版 `psycho_flicker_light` ＋ `hold` トークン**(慣習は下記) | 高 | `is_derived=false` 維持 |
| ed | `psycho_flicker_holding_medium` | 【ホールド】中サイコフリッカー | `d dr r plus k_m hold` | 同上 | 高 | 同上 |
| ed | `psycho_flicker_holding_heavy` | 【ホールド】強サイコフリッカー | `d dr r plus k_h hold` | 同上 | 高 | 同上 |

**★ホールド版の扱いは既 seed 済みキャラの慣習に合わせた**(開発者指示 2026-08-19・`rashid` を参照)。実査結果:

| char | ホールド系 | `is_derived=false` ＋ `hold` トークン | 例外(`is_derived=true`)とその理由 |
|---|---:|---:|---|
| rashid | 7 | **7** | なし |
| luke | 4 | **4** | なし |
| ingrid | 1 | **1** | なし |
| marisa | 20 | **17** | 3 件は rush 版(`command` 空) |
| zangief | 4 | 2 | `sa2_cyclone_lariat_holding`(トークン無し＝通常版と同一 command のため衝突回避)・rush 版 1 |
| mai | 8 | 4 | 4 件は**焔版の派生**(`flame_*_kachousen_holding`)。**`hold` トークンは付いており、`true` の理由はホールドではなく強化版タグ** |
| ryu | 9 | 0 | 8 件は電刃錬気の派生(別技) |

**⇒ 慣習は「`is_derived=false` を維持し `command` に `hold` トークンを付ける」で確立している**(別紙 `target-combo-and-derived-flag-rules.md` §0.2 の「`hold` トークン付き＝一律 false」と一致・教訓29 と整合)。ed の 4 行のうち 3 行をこの形で処理した。

**`ed/psycho_knuckle_max_holding` は補完しなかった**(確信度 低)。通常版 `psycho_knuckle` の `command` 自体が空で**基底が無い**ため、`hold` を付ける対象が存在しない。importd 接続後の再実行で通常版とセットで埋める。

### move_code 是正(8 行)

| char | 変更前 | 変更後 | 根拠 | 確信度 |
|---|---|---|---|---|
| cammy | `cannon_spike_holding_light` | `cannon_spike_light` | `name_ja`=「弱キャノンスパイク」で**【ホールド】が付かない**・`is_derived=false`。同系統 `spiral_arrow` は light/medium/heavy/od ＋ holding_heavy と正しく並ぶ。**`_holding` が付くべきは `cannon_spike_holding_heavy`(【ホールド】強・`is_derived=true`)のみ** | 高 |
| cammy | `cannon_spike_holding_medium` | `cannon_spike_medium` | 同上 | 高 |
| cammy | `cannon_spike_holding_od` | `cannon_spike_od` | 同上 | 高 |
| ed | `psyco_knuckle` | `psycho_knuckle` | **同一ファイルの他 20 行はすべて `psycho_`**(`psycho_spark`/`_shoot`/`_uppercut`/`_blitz`/`_flicker`/`sa1_psycho_storm`/`sa2_psycho_cannon`/`sa3_psycho_chamber`/`ca_psycho_chamber`)。`h` 落ちの typo | 高 |
| ed | `psyco_knuckle_max_holding` | `psycho_knuckle_max_holding` | 同上 | 高 |
| ed | `rush_psyco_knuckle` | `rush_psycho_knuckle` | 同上。**`original_move_code` も追随**(`psyco_knuckle` → `psycho_knuckle`) | 高 |
| ed | `rush_psyco_knuckle_max_holding` | `rush_psycho_knuckle_max_holding` | 同上。`original_move_code` 追随 | 高 |
| elena | `lynx_whirl` | `lynx_whirl_light` | `name_ja`=「弱リンクスワール」。同系統に `lynx_whirl_medium` / `_heavy` / `_od` が存在し、派生側も `lynx_whirl_spinning_scythe_light` と `_light` を持つ。**弱だけ接尾辞が欠落** | 高 |

**★いずれも seed 投入前なので、code 改名マイグレ(UNIQUE 制約のため一時 code 経由の 3 段階 swap)は不要である。** 投入後だと教訓の `jamie/freeflow`(`000066`)と同じコストがかかる。

### 表記の整形(10 行)

| char | 対象列 | 内容 | 件数 |
|---|---|---|---|
| aki | `name_ja` | 「裏**周**り」→「裏**回**り」(`snake_step_side_switch_heavy` / `_od`)。正典 `input-notes.md` §2026-08-13 および akuma の同種行が「裏回り」 | 2 |
| akuma | `notes_tool` | 「裏回**し**して」「裏**周**りして/すると/した時」→「裏回りして/すると/した時」。**1 ファイル内に 3 表記が混在**していた | 6 |
| ed | `name_ja` | 全角括弧（前方）（後方）→ 半角(前方)(後方)(`kill_rush_forward` / `kill_rush_backward`)。同ファイル他 17 行は半角 | 2 |

### 機械検証

- `git diff` で**意図した列以外が変わっていないことを全行確認**(変更 21 行・すべて `move_code` / `command` / `name_ja` / `notes_tool` / `original_move_code` のみ)
- `go build ./...` 通過。`go test ./internal/seedgen/ ./internal/infra/migration/` **通過**(golden 4 stem 無影響＝既 seed 済みキャラの CSV を触っていない)
- **エイリアス生成 dry-run で効果を実測**: `no-command` **44 → 38 件**(numeric / srk とも)、投入行 **414 → 420**(numeric)。**新規衝突は発生していない**(`psycho_flicker_holding_*` は `236LK(hold)` 等として通常版 `236LK` と別表記になる)

### ★引き継ぎ(importer 接続後の再実行で処理する分)

| # | 内容 | 件数 |
|---|---|---|
| 1 | **command 補完の本体**(公式突合が必要) | 入力系 category で **110 件**(116 − 今回 6) |
| 2 | `ed/psycho_knuckle` ＋ `_max_holding` の command(基底が無く今回埋められなかった) | 2 |
| 3 | 空中技の発生フレーム補正漏れ(A-2) | 未着手 |
| 4 | `cammy` の `fastest_unreachable` **51 行空欄**(★投入すると既定値 `false` で確定。`jumping_*` 6 行は機械規則で `true` が確定) | 51 |
| 5 | `cammy` `_high` → `_heavy` 3 行 / `hooligan_combination_holding_od` → `_od`(確信度 中) | 4 |
| 6 | `aki` の `snake_step_*` vs 正典 `input-notes.md` の `jakeiko_*` の正本確定(**開発者判断**) | 6 |
| 7 | `elena/trunc_slap`(→ `trunk_slap`?)・`elena/fluttering_lark`(name_ja「ラークフラッター」と語順逆)・`ed/kill_rush_*`(name_ja「キルステップ」と英名不一致)の綴り・語順(**公式英語名の確認が必要**) | 9 |
| 8 | `ed/psycho_flicker_heavy` / `_holding_heavy` の `fastest_unreachable`(**開発者が `notes_tool` に「trueかfalseか迷っている」と明記**) | 2 |
| 9 | 非 rush の `startup_basis=through` **87 行**の親参照(`move_derivations`)。CSV に親を書く列が無く、根拠は `notes_tool` の日本語文のみ | 87 |
| 10 | 表記プリセットの `collision` **20 件**(numeric)。18 行は地上×空中ペアで**生成器側に空中接頭辞の規則が要る**(CSV を直しても解消しない)。残り 2 行は `ed/cobra_punch` × `psycho_shoot_heavy` でデータ側の判断 | 20 |

---

## 教訓追記(第5バッチで判明・残キャラへ)

39. **★`command` 空の実害が 1 つ増えた(表記プリセット機能の完成後)**: 従来は「段階2 のコマンド入力解決で永久に解決されない」だけだったが、現在は **`preset_aliases` のエイリアスが生成されず、その技だけ日本語技名で表示される**。第5バッチでは `no-command` 44 件 ＋ `derived-no-command` 88 件 = **132 行**が両プリセットで欠落する見込みだった。**画面は壊れずテストも緑のまま**なので人が見る以外の発見経路が無い(`DES-004` §5.3 のフォールバック)。**⇒ command 補完の優先度は上がっている。**

40. **★エイリアス生成の dry-run は公式 dist を必要とせず、投入前に回せる**: `go run ./cmd/seedgen -mode aliases -preset {numeric,srk} -chars <対象> -movement-chars <対象> -migrations <一時領域>/mig -alias-report <一時領域>/x.md`。**`-check` では駄目**(差分確認だけで exit し `-alias-report` を書かない)。**`-migrations` を一時領域へ向ける**こと。**dist 未接続でも実施できる最も収穫の大きい検査**であり、command 空の件数と直接突き合わせられる。

41. **★「表記が同一で衝突する」ペアには 2 種類あり、CSV では直せない方が多い**: 第5バッチの collision 20 件のうち **18 行は地上技×空中技のペア**(chun_li 百裂脚×空中百裂脚 8 行、SA の地上×空中 4 行 等)で、**実機の入力が同一であり区別するのは空中にいるかどうか**である。生成器に「空中版へ `j.` 等を付ける規則」が無いことが原因で、**CSV を直しても解消しない**。残り 2 行(`ed/cobra_punch` × `psycho_shoot_heavy`)だけがデータ側の判断。**collision を報告するときは必ずこの 2 種に分けること**(全部を CSV のミスとして扱うと直せない指摘が並ぶ)。

42. **★同じ衝突が既配布キャラで 84 件(numeric)発生しており、出荷済みである**: `migrations/000072_m20_seed_aliases_numeric.up.sql` に `ken/tatsumaki_senpu_kyaku_od` と `ken/aerial_tatsumaki_senpu_kyaku_od` は**どちらも存在しない**(非 OD 版は存在する)。`ingrid` ソーラーフレア/サンフレア系 24 行、`rashid` ワールウインド・ショットのホールド系 6 行(**ホールド版と最大ホールド版が同一 command になるため**)、`marisa` ホールド系 6 行も同様。**慣習どおり `hold` トークンを付けると、最大ホールド版とは表記が同じになって両方落ちる**——ホールド版が 2 段階あるキャラでは慣習だけでは足りない。

43. **`is_derived` / `name_ja` / `move_code` の 3 つが揃って矛盾を指す場合、誤っているのは `move_code` である**: `cammy/cannon_spike_holding_{light,medium,od}` は `name_ja` に【ホールド】が無く `is_derived=false` なのに code に `_holding` があり、**隣の `spiral_arrow` 系統と並べると欠落パターンが見える**(通常版 light/medium/od が存在しないことになる)。M19-PHASE2 の `jamie/freeflow_strikes` と同型で、**系統内の「接尾辞 → `name_ja`」対応表を作って初めて見える**(重複でも欠損でも異常長でもなく `total` の内部整合も通る)。**⇒ 系統表の突合はキャラごとに必ず 1 回やる。**

44. **★新列 3 本(`startup_basis` / `chain_cancel_total` / `fastest_unreachable`)は CSV から DB へ届かない**: `internal/seedgen/model.go` が「保全のみ・SQL 非投入」と明記し、`generate_test.go` は**出力されることを失敗として固定**している。`cmd/seedgen` の `-mode` は `moves` / `derived-backfill` / `move-commands` / `aliases` の 4 つだけで、**人手 backfill の生成モードは存在しない**(CHANGE-091 §2.3 成果物 o は計画されたが実体は手書きマイグレ `000064` / `000067` / `000068`)。**⇒ CSV を埋めても投入波で手書きマイグレを起こさなければ既定値(`unknown` / `false`)のまま残る**。M19 で 625 行が取り残された **D-181** と同型。

45. **★未投入キャラの `fastest_unreachable` は「空欄」が最も危険な状態である**: DB 既定が `NOT NULL DEFAULT false` なので、**空欄で投入すると「地上の相手に最速で当てられる」として確定**する。第5バッチでは `cammy` だけ 51/99 行が空欄で、**`jumping_*` 6 行が空**だった(他 6 キャラは機械規則どおり全件 `true`)。`is_aerial` は正しく `true` なので画面もテストも緑。**⇒ キャラ内で記入率が 100% でない列を見つけたら A 級として報告する**(「途中から入れ始めた」跡である)。

46. **意図的差分の根拠は `notes_tool` 列へ移っている**: 第5バッチの 7 キャラのうち **6 キャラは `input-notes.md` に節が無く**、根拠は CSV の `notes_tool` にしかなかった(記入率 9〜38%)。`cammy/spiral_arrow_heavy` の「**公式差分OK。飛びフレームをこっちでは足してるから**」のように、**公式との差を許容する宣言が行単位で書かれている**。**⇒ 対象キャラの `notes_tool` 非空セルは全件読む。読まずに公式突合すると意図的差分をミスとして上げる。**

47. **`notes_tool` には開発者の未決が書かれていることがある**: `ed/psycho_flicker_heavy`「fastest_unreachable についてはtrueかfalseか迷っている」。**値は入っているので機械検査では未決と分からない**。**⇒ `notes_tool` を「迷/不明/かも/申し送り/整理する必要」等で grep して、未決宣言を Phase 4 の個別確認へ回す**。第5バッチでは他に `akuma` 豪波動拳 11 件「公式はLv1/Lv2/Lv3記載かも」・`chun_li` 行雲流水派生 6 件「構え継続した場合のフレームは複雑なので申し送り」・`elena` リンクスワール系 10 件「セットプレイの自動提案などには使えない状態。別途じっくり整理する必要がある」が該当した。

48. **フレーム整合検査(`total` = `startup`+`active`−1+`recovery`)は恒真の可能性が高い**: 第5バッチでは 4 値がそろう **596 行すべてで成立し不一致 0 件**。24 CSV 全件でも例外を確認できなかったため、**手入力ツールが `total` を算出している公算が大きい**。その場合本検査は `recovery` の誤りを一切検出しない。**⇒ 「0 件」をレポートに書くときは「品質の証拠ではない」と併記する**(検証していないことを緑と読ませない)。

49. **`original_move_code` は rush 版の元技専用に使われており、派生技の親を書く欄が無い**: 第5バッチの非 rush `through` 87 行は**全件 `original_move_code` が空**で、親関係は `notes_tool` の日本語文にしかない。CHANGE-094 の表記展開は「`through` かつ**親参照あり**の直前に親ステップを前置」するため、**親参照が無いと単独で出せない技が単独で出せるように表示される**。**⇒ `through` 行を列挙し、`notes_tool` から親候補を抽出して `move_derivations` の起票素材として渡す**(日本語文からの親抽出は機械では書けないので AI が担う価値が高い)。

50. **未 seed キャラの code 改名は「今なら無料」である**: 第5バッチの 8 行の move_code 是正は、投入前なので**マイグレ不要・golden 無影響**で済んだ。投入後だと UNIQUE 制約のため一時 code 経由の 3 段階 swap マイグレ ＋ golden 再生成が要る(`jamie/freeflow` = `000066` の前例)。**⇒ code の系統一貫性チェックは投入前チェックの中で最も費用対効果が高い項目である。**

---

## 第5バッチ 追補(2026-08-19・開発者回答を受けた確定分)

**前バッチの「引き継ぎ」表のうち、公式 dist で覆らないと確認できた項目を開発者回答に基づいて処理した。** dist は依然未接続であり、**command 補完の本体(110 件)・空中技のフレーム補正・入力漏れ・公式値差分は引き続き未実施**である。

### move_code 是正 6 行(すべて開発者確認済み)

| char | 変更前 | 変更後 | 開発者回答 |
|---|---|---|---|
| cammy | `cannon_strike_high_od_hooligan_combination_od` | `cannon_strike_heavy_od_hooligan_combination_od` | 「**High はミスなので heavy 修正必要**」 |
| cammy | `fatal_leg_twister_high_od_hooligan_combination` | `fatal_leg_twister_heavy_od_hooligan_combination` | 同上 |
| cammy | `silent_step_high_od_hooligan_combination_od` | `silent_step_heavy_od_hooligan_combination_od` | 同上 |
| cammy | `hooligan_combination_holding_od` | `hooligan_combination_od` | 「**OD 版に holding はないので code の方が誤っている**」 |
| cammy | `silent_step_od` | `silent_step_light_od_hooligan_combination_od` | 「**意図はないので入力時のミス。他に合わせてほしい**」(兄弟＝`silent_step_medium_od_hooligan_combination_od` / `_heavy_od_...`) |
| elena | `trunc_slap_2hit` | `trunc_slap_2hits` | 「**2 以上は hits と複数形にするのが正しい**」 |

> **`akuma/rago_high_kick`(羅豪脚)は対応不要**——**公式英語名 Rago High Kick の固有名詞**であり強度語の `high` ではない(開発者確認)。24 CSV 横断で `_high` を含むのはこの 1 行だけになった。

### 設計文書の是正 2 箇所(★正典側が誤っていた)

| ファイル | 内容 |
|---|---|
| `docs/seed-data/input-notes.md` §2026-08-13 | `jakeiko_heavy` / `jakeiko_od` / `jakeiko_side_switch_*` → **`snake_step_*`** へ。訂正の経緯と教訓を注記として追記 |
| `docs/seed-data/check-criteria.md` §3 の命名例 | `jakeiko_side_switch_heavy` → **`snake_step_side_switch_heavy`** |

**開発者回答**: 「**aki の技の件は Snake step が正しい。恐らく md 側へ AI 転記させた時に正しい英語名ではなくローマ字が挿入されたもの**」。**CSV は当初から正しく、誤っていたのは設計文書の側**である。

### 開発者裁定(引き継ぎ先へ渡す確定事項)

| # | 事項 | 裁定 |
|---|---|---|
| 1 | **`total` は手入力ツールが算出している** | 「**している。機械的な算出なので人為的ミスもない**」⇒ **フレーム整合検査 `total = startup+active-1+recovery` は恒真であることが確定した**。`recovery` を検証する手段は公式突合しかない |
| 2 | **最大ホールドの表記** | **画面表示は出したい / コマンド入力解決は不要 / `command` にホールドの概念を入れたくない**(ガイル等のため簡略化している)。⇒ **`is_derived=true` 案は棄却**(表記も出なくなるため)。**層 B(`move_code` の構造から表記を決める経路)へ `_holding` / `_max_holding` の接尾辞規則を足す**のが 3 要件を同時に満たす唯一の形 |
| 3 | **エイリアス衝突の是正** | **CHANGE 1 本にまとめる**。採番は **112 以降**(098〜105＝M20 / 106〜111＝M21 で全消費済み)。起票は引き継ぎ先のブランチで、`change-number-registry.md` §1 への登録を同じ手番で行う(D-277 / E-114) |
| 4 | **`move_code` 規約の機械検査** | **`scripts/` の常設フックではなく `precheck_seed_data` コマンドの手順として組み込む**。ただし **全 24 CSV を走査**し、対象キャラ分は「要処置」、既配布分は「参考・件数のみ」として出す(precheck は未処理キャラしか対象にしないため、既配布 14 行が追跡されなくなるのを防ぐ) |
| 5 | **親参照(`move_derivations`)** | **Q1＝親が複数ある技は全部登録する** / **Q2＝ジャンプを親にする。垂直ジャンプからも出せる技があるため前ジャンプだけに絞らない** |
| 6 | **`custom_states`** | **`aki` に毒**(相手付与 bool・`m_bison` のサイコマインと同型) / **`e_honda` の肩屋入り**(`ryu` の電刃錬気と同型の自己 bool) / **`elena` は不要** / **`ed` も不要**(前バッチの「サイコゲージ」は誤りで撤回) |
| 7 | **`elena` リンクスワール系・`chun_li` 行雲流水派生** | **後回し**。エッジケースとして扱うのが面倒なため。**ただし親参照は先に入れる**(CHANGE-093 の述語で自動提案から外すため) |
| 8 | **未実測 6 キャラの `chain_cancel_total`** | **後日実測を入れる**。投入のブロッカーにはしない |

### 親参照の候補表(87 行 / 118 ペア)

**非 rush の `startup_basis='through'` 全 87 行について、`notes_tool` と `name_ja` から親を起こした表を作成した。** 親 code が同一キャラの CSV に実在することは機械検証済み。

| 種別 | 件数 | 内容 |
|---|---:|---|
| 技親 | 60 | 例 `e_honda/teppo_triple_slap` → `sumo_dash`(notes_tool「相撲ステップから派生」) |
| **ジャンプ親** | 19 | `jump_forward` / `jump_neutral` / `jump_back`。**移動系 9 code として全キャラの `moves` に投入済み**(`000072` で実在確認) |
| 複数親 | 8 | 例 `akuma/demon_low_slash` → `demon_raid_light` / `_medium` / `_heavy`(「弱中強百鬼襲から派生」) |
| **要確認** | 22 | 下記 |

**要確認 22 件の内訳**:

- **前/垂直ジャンプの別が `notes_tool` に無い 15 行**(`cammy` cannon_strike 4 + SA2 1 / `chun_li` 空中百裂脚 4 + 鷹爪脚 1 + 三角飛び 1 / `akuma` 2 行は「前か垂直」と明記があるため 2 親で確定)
- **`akuma/demon_gou_zanku` / `demon_gou_rasen` の派生元強度が未特定**(2 行)
- **`aki/nightshade_chaser` の `notes_tool` が「紫煙追から派生」＝自己参照**(1 行)。**紫煙砲(`nightshade_pulse`)の誤記と判断**したが要確認
- `akuma/demon_swoop*` 4 行は `notes_tool` が空で、`name_ja`(「百鬼潜影(中強百鬼襲・裏回り)」)と同系統の派生群から推定

**★表そのものは非 git の成果物**(HTML)であり、投入時は**手書き INSERT マイグレの素材**として使う。**CSV には親を書く欄が無い**(`original_move_code` は rush 版の元技専用で、87 行すべて空)。

### 機械検証

- `git diff` で意図した列以外が変わっていないことを全行確認
- `go build ./...` / `go test ./internal/seedgen/` 通過
- **エイリアス生成 dry-run: 内訳に変化なし**(numeric / srk とも `collision` 20/16・`no-command` 38・`derived-no-command` 88 のまま)。**是正した 6 行はいずれも `derived` または `no-command` 側にあり、エイリアス生成へ影響しない**ことを確認

### 残る未処理(引き継ぎ先へ)

| # | 内容 | 件数 |
|---|---|---|
| 1 | **command 補完の本体**(公式突合が必要) | 110 |
| 2 | `ed/psycho_knuckle` ＋ `_max_holding` の command(基底が空でセット必須) | 2 |
| 3 | 空中技の発生フレーム補正漏れ | 未着手 |
| 4 | 公式にあって手入力に無い技(入力漏れ疑い) | 未着手 |
| 5 | 公式値との数値差の弁別 | 未着手 |
| 6 | **`cammy` の `fastest_unreachable` 51 行**(★A 級。**B 型候補は 0 行なので機械的に決まる**——`jumping_*` 6 行 → `true`、残り 45 行 → `false`。**開発者の確認待ち**) | 51 |
| 7 | 綴り・語順の公式確認(`elena/trunc_slap` → `trunk_slap`? / `elena/fluttering_lark` の語順 / `ed/kill_rush_*` と name_ja「キルステップ」の不一致) | 9 |
| 8 | 複数形規則違反の**既配布 14 行**(`ingrid` 4 / `jamie` 4 / `lily` 2 / `mai` 2 / `zangief` 2)。**改名マイグレ ＋ golden 再生成が必要** | 14 |
| 9 | `custom_states` の投入(`aki` 毒 / `e_honda` 肩屋入り ＋ **既存の穴 8 キャラ分**) | 10 |

---

## 教訓追記(第5バッチ 追補で判明)

51. **★設計文書側の `move_code` が誤っていることがある**: `aki` の蛇軽功で、`input-notes.md` と `check-criteria.md` の 2 文書が `jakeiko_*`(日本語読みのローマ字)と書いていたが、**正しいのは公式英語名由来の `snake_step_*` で、CSV の側が当初から正しかった**。原因は**手入力メモを AI に転記させた際に、公式英語名がローマ字読みへ置き換わった**こと(開発者証言)。**⇒ 正典と CSV が食い違ったとき、無条件に正典を採ってはならない。`move_code` については公式英語名に一致する側を採る**。転記工程を経た記述は特に疑う。

52. **★「表記が出ない」と「索引に載らない」は別の要件であり、`is_derived` は両方を同時に落とす**: 開発者の要件は「最大ホールドは**画面表示は出したい**が、**コマンド入力解決は不要**」だった。`is_derived=true` はこの 2 つを分離できず両方落とす(`ReasonDerived`＝層 A も層 B も当たらない)。**表記の出どころが `command` しかないことが根本原因**で、`command` に `hold` を入れない限りホールド版と通常版が同表記になり衝突する。**⇒ 表記を `move_code` の構造から決める経路(層 B)へ寄せれば、`command` を素のままにしたまま表記だけ分けられる。** 要件が「表示」と「解決」に分かれている場合は、どちらの経路が担っているかを先に特定すること。

53. **`total` が機械算出である以上、フレーム整合検査は恒真である**(開発者確認 2026-08-19)。**「不一致 0 件」は品質の証拠にならない**。`recovery` の誤りを検出できるのは公式突合だけであり、**dist 未接続のセッションでは `recovery` は一切検証されていない**と明記すること。

54. **★親参照は `notes_tool` と `name_ja` からほぼ機械的に起こせる**: 87 行のうち**開発者判断が要ったのは 22 行だけ**で、残り 65 行は「〜から派生」「(弱フーリガンコンビネーション派生)」といった記述から一意に決まった。**`cammy` の 33 行は `notes_tool` が空でも `name_ja` の括弧内に親が明記されている**。**⇒ 親参照の作業は「開発者に聞く」より先に「読んで抽出する」が正しい順序**。聞くべきは (a) 複数親を全部登録するか (b) ジャンプを親にするか の 2 点に集約できる。

55. **ジャンプは `moves` に存在するので親として指せる**: `jump_forward` / `jump_neutral` / `jump_back` は移動系 9 code として全キャラへ CROSS JOIN で投入済み(`000072`)。**ただし CSV には無い**ため、CSV を見ているだけだと「親が存在しない」と誤判断する。**★垂直ジャンプからも出せる技がある**(開発者指摘)ので、`notes_tool` が「前ジャンプから」としか書いていない行でも前ジャンプだけに絞らず、**別が明記されていない行は要確認へ回す**こと。

56. **`custom_states` は「一度定義して消えた」ことがある**: `aki` の毒は `000009` で `{"code":"poison","subject":"opponent","type":"flag"}` として定義されていたが、`000017` が先行リリース対象外として **characters 行ごと削除**した。**⇒ 「未登録」を「未設計」と読まないこと。過去マイグレに定義文字列が残っていれば雛形として再利用できる。** あわせて**第三波 6 キャラ(`m_bison` / `rashid` / `jamie` / `luke` / `marisa` / `jp`)は `custom_states` が丸ごとスコープ外で NULL のまま**である(`000053` のコメントに明記)。新キャラの投入時に既存の穴も一緒に埋めるのが効率的。

---

## 第5バッチ 追補2(2026-08-19・親参照の確定と A 級の解消)

### `cammy` の `fastest_unreachable` 51 行を記入(★A 級を解消)

**開発者確認**: 「**キャミィ『地上技だが空中の相手にのみヒット』型はない**」。

機械規則どおり **`jumping_*` 6 行 → `true` / 残り 45 行 → `false`** で記入した。**B 型候補(`is_aerial=true` かつ `code` に `jumping_` を含まない)は 0 行**だったため人手判断は不要。

| 検証 | 結果 |
|---|---|
| 空欄 | **0 行**(99/99 記入済み) |
| 分布 | `false` 93 / `true` 6 |
| `jumping_` 行が全て `true` | ✅ |
| `is_aerial=true` かつ `false` の行 | **なし** |

> **★これで「投入すると既定値 `false` で確定し、CHANGE-094 が是正した B 型の誤提案が再発する」という A 級の欠陥は解消した。**

### 親参照の候補表を確定(87 行 / **131 ペア**)

**開発者確認により 7 行の推定が確定値へ変わり、6 行が新たに要確認へ移った。** 要確認は 22 → **21 件**。

| char | 対象 | 変更前(推定) | 変更後(確定) |
|---|---|---|---|
| akuma | `demon_gou_zanku` / `demon_gou_rasen` | 百鬼襲 4 強度すべて(強度未特定) | **`demon_raid_od` のみ**(「OD百鬼襲からのみ派生」) |
| cammy | `cannon_strike_light` / `_medium` / `_heavy` / `_od` | `jump_forward` ＋ `jump_neutral` | **`jump_forward` のみ**(「全て前ジャンプ派生のみ」) |
| cammy | `sa2_aerial_killer_bee_spin` | 同上 | **`jump_forward` のみ**(「前ジャンプ派生のみ」) |

**種別の内訳**: 技親 56 / ジャンプ親 19 / 複数親 12 / 要確認 21。**親 code が同一キャラの CSV に実在することは機械検証済み。**

### ★春麗 行雲流水の派生グラフ(開発者提供 2026-08-19)

**構え技の派生が想定より複雑であることが判明した。**

```
行雲流水 ──→ 解除 ／ 蘭華 ／ 這蛇突 ／ 蓮掌 ／ 前突 ／ 仙風 ／ 天空脚
蘭華・這蛇突・前突・仙風 ──→ 蘭華 ／ 這蛇突 ／ 蓮掌 ／ 前突 ／ 仙風 ／ 天空脚(★自己再帰を含む)
蓮掌・天空脚 ──→ 派生なく終了
```

**⇒ 6 技はいずれも親を 5 つ持つ**(行雲流水 ＋ さらに分岐できる 4 技)。解除は行雲流水のみが親。**ペア数は 31**(6×5 ＋ 1)。

**開発者申告: 「フレーム等の仕組みが特殊なので現行の作りだと上記は解決できない」。**

> **★ここで 1 点、未決が残る(引き継ぎ先へ)。**
>
> 前バッチの裁定 7 は「**後回しにする。ただし親参照は先に入れる**(CHANGE-093 の述語で自動提案から外すため)」だった。**しかしこの 7 行は現在 `startup_basis='through'` であり、CHANGE-093 の除外述語 `startup_basis IN ('standalone','unknown')` に当たらない。** `through` は CHANGE-094 で**解禁側**である。
>
> **⇒ 親参照を入れただけでは提案から外れない。** 外すには **`startup_basis` を `unknown` へ変える**必要がある。これは **D-226 の先例と同型**——「**この行の値は、消費側が安全に使える形になっていない**」「**どう使えばよいかがレシピによって変わる**」という記録として `unknown` を選んだ事例であり、構え継続の有無でフレームが変わる本件はまさにこれに当たる。
>
> **本セッションでは適用していない**(`startup_basis` は意味を変える列であり、開発者の明示承認を得ていないため)。**エレナのリンクスワール系 10 行は既に `unknown` なので、そのまま述語が効く。**

### ★`ed` キルスイッチの扱い(開発者質問への回答)

**質問**: 「キルスイッチ・ブレイクとキルスイッチ・チェイスは派生元もコマンドも同じキルステップ(前方)。ボタンを押すタイミングで派生が変わる技だが、特に特別な記載はいらない?」

**回答: 追加の記載は不要。現行が規約どおりである。**

| move_code | name_ja | `is_derived` | `command` |
|---|---|---|---|
| `kill_rush_forward` | キルステップ(前方) | false | `k k` |
| `kill_switch_break` | キルスイッチ・ブレイク | **true** | `r plus p` |
| `kill_switch_chaser` | キルスイッチ・チェイス | **true** | `r plus p` |

**`check-criteria.md` §3 の「ジャスト版」規則がそのまま当たる**——「command が通常版と**同一文字列**なら `is_derived=true`(索引衝突するため索引から除外)」。**入力タイミングだけが違って command が同一という構造が同型**であり、両行とも既に `is_derived=true` なので**索引衝突は起きない**。

> **★ただし代償がある。** `is_derived=true` は表記エイリアスの生成対象外(`ReasonDerived`)なので、**この 2 行は画面で「キルスイッチ・ブレイク」という日本語技名のまま表示される**。最大ホールドと同じ構図である。
>
> **層 B(`move_code` 由来の表記経路)でも解決できない**——ホールドは `_holding` という**共通の接尾辞**で機械的に分けられるが、`kill_switch_break` と `kill_switch_chaser` は**別の技名**であり接尾辞規則の対象にならない。**表記を出したいなら「同一 command でタイミングが違う技をどう表記するか」という別の規則が要る**(CHANGE-112 の範囲を広げる話)。**現状のまま日本語技名で許容するのが既定運用と整合する。**

### 機械検証

- `git diff` で意図した列以外が変わっていないことを全行確認(変更は `cammy` の `fastest_unreachable` 列のみ)
- `go build ./...` / `go test ./internal/seedgen/ ./internal/infra/migration/` 通過
- エイリアス生成 dry-run の内訳に変化なし(`fastest_unreachable` は表記生成に関与しない)

---

## 教訓追記(第5バッチ 追補2 で判明)

57. **★`startup_basis='through'` は「自動提案から外す」手段にならない**: CHANGE-093 の除外述語は `standalone` / `unknown` の 2 値だけを見ており、**`through` は CHANGE-094 で解禁側に回っている**。「未整理なので提案に出したくない」という意図で親参照を入れても、**`through` のままでは効かない**。**⇒ 「後回しにする」を機械的に成立させたいなら `startup_basis` を `unknown` にする**(D-226 の先例＝「消費側が安全に使える形になっていない」の記録)。**エレナ(`unknown`)と春麗(`through`)で挙動が割れる**のはこのためである。

58. **同一 command でタイミングだけが違う技は「ジャスト版」規則に吸収できる**: `ed` のキルスイッチ・ブレイク/チェイスは、押すタイミングで派生が変わり **command は完全同一**。`check-criteria.md` §3 の「ジャスト版＝command が通常版と同一文字列なら `is_derived=true`」がそのまま当たり、**追加の記載は要らない**。**⇒ 「同一 command の別技」を見つけたら、まず既存のジャスト版規則で説明できないかを確認する。** ただし `is_derived=true` の代償として**表記エイリアスが出ない**ことは明示すること(教訓52 と同じ構図)。

59. **構え技の派生グラフは自己再帰を含みうる**: 春麗の行雲流水は、6 技のうち 4 技が**自分自身を含む 6 技へ再び派生できる**。`move_derivations` は PK(child, parent) なので (蘭華, 蘭華) の自己ループも表現できるが、**CHANGE-094 の表記展開「親ステップを 1 つ前置する」は自己ループで無限になりうる**。**⇒ 自己再帰を含むキャラを投入する波では、表記展開側の停止条件を確認すること。** エレナのリンクスワール系(「何度でも派生可能」)も同型。

60. **開発者への確認は「推定を一覧で見せる」形が最も速い**: 87 行の親候補を HTML の表で提示したところ、**7 行の推定が確定値に変わり、6 行が新たに要確認として返ってきた**(開発者しか知らないゲーム内挙動)。**⇒ 「どれが分からないか」を列挙して聞くより、「こう推定した」を全件見せて誤りを指摘してもらう方が、往復が 1 回で済む。**

---

# 第6バッチ(2026-08-20・aki / akuma / cammy / chun_li / e_honda / ed / elena)

**★第5バッチ(公式 dist 未接続の部分適用)の残作業を、`combomgr-importer/dist` 接続下で完了させたもの。**
`seed-progress.md` の `precheck` を「部分」→「済」へ更新した。**公式の生値は本ファイルへ転記していない。**

## command 補完(109 件・すべて確信度「高」・開発者承認済み)

突合の内訳。**`name_ja` 完全一致で引けたのは 126 件中 5 件のみ**で、残りは下記パターンで解決した。

| 突合パターン(教訓番号) | 件数 |
|---|---:|
| n 段止め改名 `X_1hit`/`X_2hits`/`X`(フル) ↔ 公式 `X_1`/`X_2`/`X_3`(教訓6) | 31 |
| 状態強化・派生バリエーションは基底と同一入力(教訓17) | 30 |
| 汎用ボタン `p`/`k` を強度へ展開(教訓9) | 14 |
| ホールド版＝基底＋`hold` トークン(教訓2) | 7 |
| 強化版プレフィックス改名 公式 `boosted_` → 手入力 `buffed_`(教訓3) | 3 |
| `move_code` typo により突合が外れていた分(教訓12/18) | 4 |
| その他(code/name_ja 直接一致・OD 分割) | 20 |

### キャラ別の内訳

| char | 補完 | 主な系統 |
|---|---:|---|
| aki | 6 | 紫泡撒 / 睚眦 / 蛇軽功(裏回り) / 渾沌・窮奇(TC) |
| akuma | 28 | 豪波動拳 Lv1・Lv2(7) / 金剛灼火(8) / 百鬼襲派生(7) / 鬼哭連撃(3) / SA・CA(3) |
| cammy | 37 | フーリガンコンビネーション派生(21) / キャノンストライク(4) / 各種ホールド(2) ほか |
| e_honda | 7 | 肩屋入り版百裂張り手(3) / 鉄砲(4) |
| ed | 4 | フリッカー / ヒットマンコンビネーション(TC) |
| elena | 27 | ムーングライド(8) / リンクスワール派生(7) / TC 各種(9) / 強化版(3) |
| chun_li | 0 | 空 3 件はいずれも確信度 中/低(下記) |

### ★公式で裏付けられた開発者の予測

`akuma` 豪波動拳 11 件の `notes_tool`「**公式はLv1/Lv2/Lv3記載かも**」は **dist で裏付けられた**。
公式は `gou_hadoken_lv1/lv2/lv3_<強度>` の 3 段構成で、**手入力の 通常 / 【ホールド】 / 【最大ホールド】 と 1:1 対応**する。
**ただし Lv2 と Lv3 は公式でも command が同一**(`… hold`)であり、ホールド 2 段階の衝突(教訓42 / 裁定2)がここでも起きる。
⇒ **`_max_holding` 3 件は確信度「中」に留め、補完しなかった。**

## move_code 是正(8 行・すべて確信度「高」)

| char | 変更前 | 変更後 | 根拠 |
|---|---|---|---|
| aki | `toxcic_wreath` | `toxic_wreath` | 公式 code と `name_ja`(紫泡撒)が一致。`toxic` の綴り誤り |
| aki | `ca_laws_of_ya_zi` | `ca_claws_of_ya_zi` | **同キャラの `sa3_claws_of_ya_zi`(同一技の SA3)は `claws` で正しく、キャラ内で綴りが割れていた** |
| akuma | `sa1_messatu_gohado` | `sa1_messatsu_gohado` | 公式 code と `name_ja`(SA1 滅殺豪波動)が一致。`tsu` の `s` 欠落 |
| akuma | `shun_goku_satsu` | `ca_shun_goku_satsu` | `critical_art` の `ca_` 接頭辞欠落(下記 ★) |
| elena | `trunc_slap` / `_1hit` / `_2hits` / `rush_trunc_slap_1hit` | `trunk_slap*` | **公式綴りは `trunk`**。`rush_` 版は `original_move_code` も追随 |

> **★`ca_` 接頭辞の欠落は実害が機械的に確認できた。** 生成器の `saAnnotation()`(`internal/seedgen/generate_m2002.go`)は
> `sanumber.Extract(moveCode)` で **`move_code` から** SA/CA 番号を取るため、`ca_` が無いと「(CA)」注記が付かない。
> dry-run の「SA 注記が付かなかった super_art / critical_art」が **command 補完後に 0 件 → 1 件**へ変化して `shun_goku_satsu` だけが挙がり、
> **改名後は再び 0 件へ戻った**。⇒ 規約違反が表記の欠落として現れることを実測で示せた。

## その他の適用(開発者承認済み)

| 対象 | 変更 | 根拠 |
|---|---|---|
| `chun_li` 行雲流水派生 7 行 | `startup_basis` `through` → `unknown` | 裁定7 を機械的に成立させる(教訓57)。対象＝`serenity_stream_cancel` / `orchid_palm` / `snake_strike` / `lotus_fist` / `forward_strike` / `senpu_kick` / `tenku_kick`。**他の 6 through 行は据え置き**(ジャンプ由来＝CHANGE-094 の想定どおり) |
| `aki` `snake_step_side_switch_{heavy,od}` | `is_derived` `false` → `true` | 基底と同一 command で衝突し、**生成器は衝突した組を両方落とす**ため、`false` のままだと通常版まで表記を失う。`akuma` の同型 `demon_*_side_switch` も `true` |

## エイリアス生成 dry-run の前後比較(numeric)

| 区分 | 補完前 | 補完後 |
|---|---:|---:|
| 投入 | 420 | **446** |
| 投入しない | 197 | **171** |
| ├ `derived` | 42 | 122 |
| ├ `derived-no-command` | **88** | **10** |
| ├ `no-command` | **38** | **7** |
| ├ `rush-original-unfilled` | 9 | 6 |
| └ `collision` | 20 | 26 |
| SA 注記が付かなかった行 | 0 | **0**(改名前は 1) |

**新規 collision 6 行はすべて `akuma` の 豪波動拳 × 斬空波動拳**(地上×空中ペア)であり、
**実機の入力が同一で区別は空中にいるかどうか**。生成器に空中接頭辞規則が無いのが原因で **CSV では直せない**(教訓41)。既存 20 行は据え置き。

## 機械検証

- `git diff` を**列単位で機械照合**: 変更列は `command` 109 / `move_code` 8 / `startup_basis` 7 / `is_derived` 2 / `original_move_code` 1 のみ。**意図しない列の変更 0 件**・行数不変(117 insertions / 117 deletions)
- `go build ./...` / `go test ./internal/seedgen/ ./internal/infra/migration/` 通過
- `check-artifact-integrity` / `check-doc-refs` / `check-instruction-format` / `check-progress-log-index` 通過
- **`check-md-emphasis` は exit 1 だが本作業と無関係**——同検査の走査対象は `docs/{process,handover,instructions,design,change-notes,progress}` のみで `character_data/` を含まない。**`9fc2c916` 時点で既にベースライン 436 に対し 658 行**(+222)であり、**先行コミットが持ち込んだ未処理の増加**。§J へ記録した
## ★第5バッチ「引き継ぎ 10 項目」の処理結果(1 行ずつ)

| # | 内容 | 結果 |
|---|---|---|
| 1 | `cammy` の `fastest_unreachable` 記入 | **前任が完了済み**。今回 7 キャラ 617 行で空欄 0 を再確認 |
| 2 | **command 補完の本体**(引継書 110 件) | **★実数は 126 件だった**(下記 ★)。うち **109 件を適用**、中 5 / 低 12 は Phase 4 へ |
| 3 | `ed/psycho_knuckle` ＋ `_max_holding` の command | **適用せず**。公式は `psycho_knuckle_lv1` / `lv2` とも **command が同一**(`p_h hold`)で、埋めると必ず衝突する。裁定2 の層 B 待ち → Phase 4 |
| 4 | 空中技の発生フレーム補正漏れ(A-2) | **該当なし**。空中特殊技は全件補正済み(+9〜+17)。同値の 3 行(`aki/gong_fu`・`e_honda/flying_sumo_press`・`chun_li/soaring_eagle_punches`)は `notes_tool` に理由あり。**ジャンプ通常技の同値は既配布 17 キャラでも 103/104=99.0% で確立運用**のため指摘にしない |
| 5 | 入力漏れ疑い | **実質 0 件**。dist の未対応 3 系統はいずれも手入力側が分割/統合したもの(教訓5/9) |
| 6 | 公式値との数値差の弁別 | **178 件中 143 件は正典・`notes_tool` で説明済み**。残り 35 件を Phase 4 へ(内訳は §数値差) |
| 7 | 非 rush `through` の親参照抽出 | **87 行 / 134 ペアを抽出**し、親 code の実在を機械検証(不在 0)。`move_derivations` 起票素材としてレポート E-4 に格納 |
| 8 | `cammy` の code 是正 | **前任が完了済み**。公式突合で妥当性を再確認(入力漏れに誤計上していない) |
| 9 | `aki` の命名の正本確定 | **前任が完了済み**(`snake_step_*`)。公式 dist も `snake_step_*` で一致 |
| 10 | 綴り・語順の確認(9 件) | **dist で全件決着**。`trunc_slap*` → `trunk_slap*` は**改名した**。`fluttering_lark` / `kill_rush_*` / `empyreans_end` / `razors_edge_slicer` は**公式自身がその形**なので改名不要 |

> **★項目 2 が 110 でなく 126 だった理由**: 引継書は `target_combo` を「入力系」から除外して数えていた。
> しかし**既配布 17 キャラの `target_combo` は command 空率 0.0%**(80/80 が記入済み)であり、**TC は command を持つのが規約**である。
> 除外は誤りで、対象 7 キャラの TC 16 行も補完対象。⇒ **母数の定義は「既配布キャラでの実績」で裏を取ること。**

## 未適用のまま残したもの(Phase 4 / §J)

| 対象 | 件数 | 理由 |
|---|---:|---|
| command 確信度 中 | 5 | `akuma/gou_hadoken_max_holding_*` 3(公式 Lv2 と同一 command＝衝突) / `chun_li/yoso_kick`(3 段を 1 行へ統合＝教訓5) / `ed/psycho_knuckle` |
| command 確信度 低 | 12 | 公式側も command 空(教訓11)が 7 / 統合行(教訓5)が 2 / 解除行 2 / `e_honda/toko_shizume_sumo_spirit` 1 |
| 数値差の要確認 | 35 | 下記 §数値差 |
| `notes_tool` の未決宣言 | 38 | とくに `elena` リンクスワール系 19 件「別途じっくり整理する必要がある」の投入可否 |
| エイリアス衝突の CHANGE 起票 | — | 裁定3。**★採番は 112 ではなく 124**(112〜123 は M22 レーンへブロック予約済み)。§J へ記録 |

## 数値差 35 件の要確認(公式生値は書かない)

| 群 | 件数 | 内容 |
|---|---:|---|
| (9a) `aki` のダメージ | 11 | **手入力が公式より系統的に 4〜14% 大きい**。倍率は一定でなく、手入力値が非丸数・公式が丸数。`notes_tool` は「**毒なし状態**でのフレームとダメージを記載」と宣言しており、**宣言と実データが食い違う** |
| (9b) `e_honda` スーパー頭突きのダメージ | 3 | (9a) と**逆方向**(手入力が小さい)。公式は弱/中が同値だが手入力は強度ごとに差がある。`notes_tool` に宣言なし |
| (9c) 単発の実測差(±1〜8F) | 13 | 他キャラでは `input-notes.md` に個別記載がある型(例 ケン「立ち中Kは-5が正しい」)。**7 キャラ分の記載がまだ無い**ので正典への追記候補 |
| (9d) 大きな差 | 3 | `aki/orchid_spring` の発生が **25F 差** ほか |
| (9e) 説明済み(要確認から除外) | 5 | `notes_tool` に理由あり |

## 教訓追記(第6バッチで判明・残キャラと次工程へ)

61. **★「補完対象の母数」は引継ぎの数値を信じず、既配布キャラでの実績で裏を取る**: 引継書は command 空を 110 件としていたが、実数は **126 件**だった(`target_combo` を除外していた)。**既配布 17 キャラの category 別 command 空率を数えると、`target_combo` は 0.0%(80/80)・`rush_variant` は 100.0%(272/272)** と一義に出る。⇒ **「この category は空でよいのか」は既配布の空率で決まる。** 引継ぎの数値は母数の定義ごと疑うこと。

62. **★同じ `notes_tool` 注記でもキャラによって埋め方が違う。片方を根拠に他方を判断しない**: `akuma/demon_raid_*` と `cammy/hooligan_combination_*` は**注記が完全に同一**(「単独でダメージがなく、特殊な技なので技名以外の入力なし」)で、フレーム空・`damage=0` も同じだが、**`akuma` は command が入っており `cammy` は空**だった。⇒ 注記の意味は「**フレームを入れていない**」であって「command を入れない」ではない。**同一注記の他キャラ実例を突合すると、注記の射程が確定する。**

63. **★`move_code` の規約違反は「表記の欠落」として実測できる**: 生成器の `saAnnotation()` は `sanumber.Extract(moveCode)` で **`move_code` から** SA/CA 番号を取る。`akuma/shun_goku_satsu` は `ca_` 接頭辞が無いため「(CA)」注記が落ちており、**dry-run の「SA 注記が付かなかった」件数が 0→1→(改名後)0 と動く**ことで確認できた。⇒ **規約検査で見つけた違反は、dry-run のどの数字が動くかまで確かめると、机上の指摘でなくなる。**

64. **★`is_derived` を「衝突するから true」と決める前に、衝突が自分の補完提案の産物でないか疑う**: `e_honda/toko_shizume_sumo_spirit` を「肩屋入り版の地鎮」＝状態強化(教訓14)と読み、基底と同一 command を提案した結果、衝突が発生し `is_derived` 付与漏れに見えた。**実際は「地鎮の後に肩屋入りへ移行する技」**であり(開発者訂正)、`recovery=52` が `sumo_spirit` の `active=52` と一致し `total 78 = 22+5-1+52` で裏付けられる。⇒ **フレームの内訳が親子関係を語る。`name_ja` の括弧書きだけで状態強化か派生かを決めない。**

65. **★`move_code` の接尾辞には 3 系統あり、意味が違う**: (A) **状態強化＝接頭辞** `<状態>_<技>`(`sumo_spirit_light_hundred_hand_slap` = [肩屋入り版]弱百裂張り手。8 キャラで使用) / (B) **親＝接尾辞** `<技>_<親>`(`cannon_strike_light_hooligan_combination` = キャノンストライク(フーリガン派生)。cammy) / (C) **続けて出す技＝接尾辞** `<技>_<続けて出す技>`(`jamie/forward_throw_drink` = 前投げ(飲酒)。`toko_shizume_sumo_spirit` も同型)。**(B) と (C) は形が同じで向きが逆**なので、`move_code` だけでは判別できない。⇒ **フレームの内訳と `notes_tool` で向きを決める。** なお (C) の通称使用(`devil_inside` → `drink`)により、**機械的な grep では先例に辿り着けないことがある。**

66. **★「先例 0 件」を結論にする前に、通称・略称で書かれていないかを疑う**: 「TC の後に必殺技コマンドを連結した先例は 24 CSV 全体で 0 件」と報告したが、実際には `jamie/forward_throw_drink` が `n or r plus p_l k_l chain d plus p_l` を持っていた。**方向入力を含む正規表現で探したため `d plus p_l` が漏れた**うえ、技名が通称(`drink`)だったため名前でも辿れなかった。⇒ **「先例なし」は探索式の限界の報告であって、事実の報告ではない。** 開発者へ出すときはその区別を明示する。

67. **★衝突は「片方を落とす」ではなく「組を全部落とす」ので、`is_derived` の効果は救済である**: `dropCollisions`(`generate_m2002.go`)は **衝突した組を両方(3 件以上なら全部)落とす**(「製造は独断で片方を捨てない」§9.3-5)。⇒ `aki/snake_step_side_switch_*` を `false` のまま残すと**通常版まで表記を失う**が、`true` にすると**通常版が表記を保ち、失うのは裏回り版だけ**になる。**失う行数が 2→1 に減る。** ⇒ **`is_derived` の是非を「エイリアスが出なくなる代償」だけで論じない。据え置いた場合に何行落ちるかを数える。**

68. **★投入波では `characters` 行の有無を先に確認する**: 第6バッチの 7 キャラのうち **`aki` 以外の 6 キャラは `characters` 行がどのマイグレにも存在しない**(`aki` のみ `000009` で投入済み)。**`moves` seed より前に入れないと FK で落ちる。** あわせて `e_honda` の `custom_states`(肩屋入り)も同じ手番で入れる。**逆に裁定6 の「`aki` 毒」は `000009` で既に投入済みであり追加作業は不要**だった。⇒ **裁定に書かれた作業でも、既に済んでいないかを実物で確認する。**

## Phase 4 の判断結果(2026-08-20・開発者回答)

| 対象 | 回答 | 適用 |
|---|---|---|
| **`e_honda/toko_shizume_sumo_spirit`** | **command と `is_derived` の両方を適用。ただし command は `p_m chain dr plus k_h chain d plus k_h`** | **適用済み**。`is_derived`=`true`。**★AI の当初案 `… chain d d plus k` は誤り**——単体の肩屋入りの入力(`d d plus k`)ではなく、**地鎮からの派生入力(`d plus k_h`)**である。`jamie/forward_throw_drink` と同型 |
| **`aki` のダメージ 13 行** | **現行値が正しい。** 「A.K.I. の技は相手が毒状態だとダメージが増える。相手が毒でない状態だと毒を付けるので、当てた技の単発ダメージ＋毒の継続ダメージとなる。インゲーム計測ではこの継続ダメージ付きのものしか取れないが、お陰で公式より正しい」 | **書き換えず。** **`docs/seed-data/input-notes.md` へ A.K.I. の節を新設**して根拠を残した(次回の precheck が同じ 13 行を再検出しないため) |
| **`elena` リンクスワール系 19 行** | **このまま投入してよい** | **変更なし。** `startup_basis` が既に `unknown` のため CHANGE-093 の除外述語が効き、自動提案には出ない。`input-notes.md` へ記録 |

**⇒ command 補完の最終数は 110 件**(確信度「高」109 ＋ Phase 4 の 1)。

## 教訓追記(Phase 4 で判明)

69. **★「公式と系統的にズレるキャラ」は一致率をキャラ横断で測ると一発で浮く**: `aki` の `damage` は公式との一致率が **75.0%(39/52)** で、**既配布 17 キャラの合計 94.7%(875/924)・他の対象 6 キャラの 91.5〜97.0% に対する明確な外れ値**だった。**1 行ずつ見ていては「多いな」で終わる**が、**同じ指標を 24 キャラで測ると外れ値が座標を持つ**。⇒ **数値差を報告するときは、そのキャラの一致率と全体の基準値を併記する。** なお本件の結論は「**手入力が正しく公式が不完全**」であり(毒の継続ダメージ込みで計測されるため)、**外れ値＝ミスではない**。

70. **★`notes_tool` の宣言は列ごとに射程が違う**: `aki/serpent_lash_light` の「毒なし状態でのフレームとダメージを記載」は**フレームについての宣言**であり、**ダメージは毒の継続ダメージを含む**(開発者確認)。注記の文面だけを読むと矛盾に見え、実際 AI は「宣言と実データが食い違う」と報告した。⇒ **注記が複数の列に言及しているとき、全列に同じ射程が及ぶと仮定しない。** 確認の結果は `input-notes.md`(正典)へ落として、次回が同じ往復をしないようにする。

71. **★派生技の command は「派生元の入力 ＋ 派生の入力」であって「派生元 ＋ その技の単体入力」ではない**: `toko_shizume_sumo_spirit` に AI は `p_m chain dr plus k_h chain d d plus k`(地鎮 ＋ **単体の肩屋入り** `d d plus k`)を提案したが、正しくは `… chain d plus k_h`(**地鎮からの派生入力**)だった。**派生として出すときの入力は単体で出すときより簡略化されることがある。** ⇒ **基底技の command をそのまま連結しない。** 先例(`jamie/forward_throw_drink` は `… chain d plus p_l` であり、単体の魔身の入力ではない)も同じ形をしている。

72. **★`startup_basis` を `unknown` へ倒すと「値の由来」の根拠が消え、次の突合が誤検出する**: 裁定7 を機械的に成立させるため `chun_li` 行雲流水派生 7 行を `through`→`unknown` にしたところ、**同じセッション内の数値差検査が同 5 行を「公式と startup が違う」として拾い直した**(値は通し値のままで `notes_tool` も「通し値」と明記しているのに、**列がそれを語らなくなった**ため)。**`unknown` は「由来が不明」と「由来は通し値だが提案から外したい」の 2 つを兼ねており、消費側が区別できない**(D-226 の形)。**⇒ `through`→`unknown` へ倒す行は、倒した事実と理由を必ず記録に残すこと。** エレナのリンクスワール系 10 行も同じ状態にある(元から `unknown`)。**次回の precheck は、`unknown` かつ `notes_tool` に「通し値」「派生」を含む行を数値差の対象から外すとよい。**

## Phase 4 の判断結果 ②(2026-08-20・数値差 18 件の弁別)

**開発者が 1 件ずつ判定。★公式の生値は本ファイルに書かない**(値の比較は `docs/seed-data/input-notes.md` §2026-08-20 追記② が持つ)。

| 判定 | 件数 | 対象 | 対応 |
|---|---:|---|---|
| **公式値が正しい** | **6** | `aki/chi_wen`(`recovery`) ／ `cammy/reverse_edge_od`(`damage`) ／ `e_honda/sumo_headbutt_{light,medium,heavy}`(`damage`) ／ `e_honda/sumo_headbutt_od`(`recovery`) | **手入力を是正した。`recovery` を変えた 2 行は `total` も再計算**(`startup+active-1+recovery`)。**再計算後もフレーム整合は 596/596 成立** |
| **手入力が正しい** | **12** | 開発者「言及していないものは手入力が正しい」 | **変更なし。** `input-notes.md` へ 12 行を明記し、次回の precheck が再検出しないようにした |

**⇒ 数値差 18 件はこれで全件決着した(未解決 0)。**

## 教訓追記(Phase 4 ② で判明)

73. **★公式/手入力のどちらが正しいかは「行単位」ではなく「列単位」で割れる**: `aki/chi_wen` は **`recovery` は公式が正しく、`on_block` は手入力が正しい**という判定になった(開発者回答 2026-08-20)。**同じ技の同じ行でも、列によって計測の当たり外れが違う。** ⇒ **開発者へ聞くときは「この行はどちらが正しいか」ではなく「この行のこの列は」と列を明示して並べる。** 行単位でまとめて聞くと、片方の列の判定がもう片方に巻き添えで適用される。

74. **★`recovery` を是正したら `total` を必ず再計算する**: 手入力ツールが `total` を算出しているため(教訓48)、**`recovery` だけ直すとフレーム整合の不変条件が壊れる**。第6バッチでは 2 行が該当し、`startup+active-1+recovery` で再計算して 596/596 の成立を維持した。**★`active` は再計算に手入力値を使う**——公式との `active` 差は「判定の無い時間も持続扱い」という宣言済みの意図的差分(正典 ベガ項)であり、公式値へ寄せてはならない。⇒ **1 列だけ公式へ寄せる是正は、算出列への波及を必ず確認する。**

---

# 第7バッチ(2026-08-25・alex / dee_jay / sagat / yasmine)

**★公式 dist 未接続のセッションで degrade 実施した**(開発者判断 2026-08-25)。`combomgr-importer/` は `.gitignore` で追跡外、GitHub スコープは `plexiblinp/combomgr` のみ、`add_repo` 相当のツールも未提供でセッション内から接続できなかった。
`seed-progress.md` の `precheck` は **「部分」**(「済」ではない)。**公式の生値は本ファイルへ転記していない。**

**対象決定**: `character_data/*.csv` は 28、進捗表は 24 行。`aki`〜`elena` は第6バッチで「済」へ更新済みのため、**未処理は表に未登録の 4 キャラ**(343 行)。いずれも未配布。

## 未実施(importer 接続後の再実行で処理する)

| 項目 | 残件 |
|---|---:|
| **command 補完の本体** | **33 件**(下記 §保留) |
| 空中技の発生フレーム補正漏れ(A-2) | 未実施(公式値との並記が要る) |
| 入力漏れ疑い(公式にあって手入力に無い技) | 未実施 |
| 公式値との数値差(フレーム・ダメージ) | 未実施 |

## command 補完(4 件・すべて確信度「高」・開発者承認済み)

**★本バッチの突合根拠は公式 dist ではなく「既配布キャラの先例」である。** degrade 下でも、同じ `name_ja` / 同じ系統の行が既配布 24 キャラに実在すれば一意に決まる。

| char | move_code | name_ja | 補完前 → 補完後 | 突合根拠(先例) | 確信度 |
|---|---|---|---|---|---|
| alex | `standing_heavy_punch_holding` | 立ち強P(ホールド) | 空 → `p_h hold` | **`zangief/standing_heavy_punch_holding` が `name_ja` まで完全同一**。`marisa` も同型。基底 `standing_heavy_punch`=`p_h` ＋ `hold`(教訓2) | 高 |
| alex | `standing_heavy_kick_holding` | 立ち強K(ホールド) | 空 → `k_h hold` | `marisa/standing_heavy_kick_holding`=`k_h hold`。基底 `standing_heavy_kick`=`k_h` | 高 |
| sagat | `tiger_uppercut_holding_heavy` | 【ホールド】強タイガーアッパーカット | 空 → `r d dr plus p_h hold` | 基底 `tiger_uppercut_heavy` ＋ `hold`。**`cammy/cannon_spike_holding_heavy`=`r d dr plus k_h hold` と語順まで同型** | 高 |
| yasmine | `pangil_sa_likuran_od` | ODパンギル・サ・リクラン | 空 → `d d plus p p` | 同系統の弱/中/強＝`d d plus p_{l,m,h}`。OD の `p p` 展開は同 CSV 内に `air_slasher_od`・`tiger_nexus_od` 等の先例多数 | 高 |

> **母数の確認(教訓61)**: `command` 空は全 112 件だが、**`rush_variant` 75 件は規約どおり空**(既配布 24 キャラで空率 100%)。実質の補完対象は **37 件**で、うち 4 件を補完、33 件を保留した。

## `is_derived` 是正(10 行・確信度「高」・★本バッチの主眼)

**`dee_jay` のジョスクール(構え)派生 5 技 × 通常/OD が `is_derived=false` のまま、基底と同一 command を持っていた。**

`funky_slicer` / `waning_moon` / `maximum_strike` / `juggling_dash` / `juggling_sway` の各 通常版・OD版(command はそれぞれ `k_l` / `k_m` / `k_h` / `r plus p` / `l plus p`)。

**根拠 4 本(すべて実測)**

1. **同一バッチ内の別キャラが同型構造の正解を持っていた** —— `sagat` のタイガーネクサス派生(`mighty_tiger` / `greedy_tiger` / `nova_tiger` × 通常/OD)は**構造が完全同型**(構え → 単ボタン派生・OD 版は OD 構えから・command は通常/OD で同一)で、**6 行すべて `is_derived=true`**。
2. **単独入力が成立しない** —— command が裸のボタンで、単独で押せば立ち弱K 等が出る(教訓14/16/17)。
3. **エイリアス dry-run** —— `collision` が numeric 14 件 / srk 10 件で、**この 10 行が srk の全件**。`dropCollisions` は組を全部落とす(教訓67)。
4. **`move_commands` 索引** —— 同一 `(character, token_key)` に複数 move がぶら下がる組が 32、うち ★要確認 7 組。**その 5 組がこの 10 行**(`4P`/`6P`/`LK`/`MK`/`HK`)。索引は `is_derived=false` の行だけを載せるため `true` で消える。

> **教訓64 の確認**: この command は**もともと CSV に入っていた値**であり、本チェックの補完提案の産物ではない。
> **既配布 24 キャラに「OD 版と非 OD 版が同一 `token_key`」の先例は無い**(★要確認 38 組を全件確認)。

## `move_code` 是正(3 行・確信度「高」)

| char | 補正前 → 補正後 | 根拠 |
|---|---|---|
| alex | `standing_heavy_punch_holing` → `standing_heavy_punch_holding` | **綴り誤り**。`marisa`/`zangief` はいずれも `holding` |
| alex | `rush_standing_heavy_punch_holing` → `rush_standing_heavy_punch_holding` | 同上。**★同行の `original_move_code` セルも同時に是正**(見落とすと rush 版が元技を解決できなくなる) |
| yasmine | `od_kulog_light` → `kulog_od` | **系統内の不一致**。yasmine の全 8 系統で OD は `_od` 接尾辞なのにこの 1 行だけ接頭辞、かつ `name_ja`「ODクロッグ」に無い `_light` が残っていた(教訓43) |

**未投入キャラなのでマイグレ不要・golden 無影響**(教訓50)。

## 表記の整形(4 行・確信度「高」)

`sagat` の `name_ja` に**半角スペースが 2 つ**入っていた行 —— `sa2_savage_tiger_zenith` / `sa2_savage_tiger_pendulum` / `sa2_savage_tiger_stomp` / `sa3_tiger_vanquisher`。同キャラの `sa1_tiger_cannon` / `sa2_savage_tiger_raid` / `ca_tiger_vanquisher` は 1 スペース。**`name_ja` は `official_ja_move` プリセットの表記そのものになるため、そのまま画面へ出る。**

> **既配布に同型 1 行**: `ken/sa2_shippu_jinrai_kyaku` = `SA2␣␣疾風迅雷脚`。**既配布なので本コマンドの手番ではない** ⇒ `followup-backlog` §J。

## 機械検証(適用前 → 適用後)

**★サンドボックス(CSV を複製し `-data` で差し替え)で先に実測し、承認後に本番 CSV で同値を再現した。**

| 指標 | 前 numeric / srk | 後 numeric / srk |
|---|---|---|
| 投入(キャラ別) | 242 / 248 | **248 / 254** |
| `collision` | 14 / 10 | **4 / 0** |
| `no-command` | 5 / 5 | **1 / 1** |
| `rush-original-unfilled` | 19 / 17 | **17 / 15** |
| `derived`(意図した除外へ移動) | 31 / 31 | 41 / 41 |
| SA 注記が付かなかった SA/CA | 0 / 0 | 0 / 0 |
| `move_commands` の ★要確認 1:N | 7 組 | **2 組** |

残った 2 組は `alex/2HP`(しゃがみ強P × フライングクロスチョップ)と `dee_jay/2LK`(しゃがみ弱K × ニーショット)＝**地上技×空中技**で、**既配布 24 キャラに 38 組の同型が出荷済み**(`aki`/`lily`/`marisa`/`rashid`/`zangief` の `2HP`、`ken`/`ryu`/`chun_li` の空中必殺技)。**CSV では直せない型**(教訓41)。

残った `no-command` 1 件は `sagat/sa2_savage_tiger_raid`。**`official-data-edge-cases.md` が「（サベージタイガー中に）/（入力なし）」と記録**しており、**公式側も command 空**(教訓11)＝空のままが正。

- `go build ./...` / `go test ./internal/seedgen/ ./internal/infra/migration/` 通過
- `git diff` を列単位で機械確認 —— **変更は 20 行 / 22 セル、`move_code`・`command`・`original_move_code`・`is_derived`・`name_ja` の 5 列のみ**。行数・列数は不変
- dry-run は `-migrations` を一時領域へ向けて実行。`migrations/` は無変更

## 保留(Phase 4 / §J 行き)

| 対象 | 件数 | 理由 |
|---|---:|---|
| `yasmine` アロン/バヤニアロン/ウラン/クロッグ の command | 15 | 派生の追加入力が CSV 内に無い |
| `alex` ブレイカー・スタンス派生の command | 7 | 同系統の他 8 行は記入済み(`p_l`/`p_m`/`p_h`/`k_l`/`k_m`)なので**記入漏れの公算が高い**が、どのボタンかは公式が要る |
| `dee_jay` TC 6 行 / `yasmine` TC 2 行 の command | 8 | **既配布の TC 空率は 0.0%** なので本来は要補完。`dee_jay/funky_dance_feint`=`p_m chain p_m chain l plus p_h` から前 2 段は推測できるが、フル版の 3 段目が決まらない ⇒ **迷ったら埋めない** |
| `dee_jay` SA2 派生 2 行 / `sagat/sa2_savage_tiger_raid` | 3 | 固定アニメーション派生。公式側も空の可能性(教訓11) |
| ~~`yasmine/alon_1hit_*` の `_1hit` 系統不一致~~ | ~~4~~ | **Phase 4 で解決**(下記) |
| `sagat` OD タイガーショットの command 粒度 | 2 | `low_tiger_shot_od`=`p p`(汎用)に対し `high_tiger_shot_od`=`p_m p_h`(ボタン組を特定) |
| ~~`yasmine/talim_ng_hangin_light` の `damage=0`~~ | ~~1~~ | **Phase 4 で解決**(下記) |
| `yasmine/ulan_*` の未決宣言 | 4 | `notes_tool`「将来的には Kulog と同じ不定系にする必要があるかも」。投入可否 |
| ~~`alex` rush 版 12 行の未処理自認~~ | ~~12~~ | **Phase 4 で解決**(下記) |
| **親参照(`move_derivations`)の起票素材** | **56 行 / 80 ペア** | 親 code の実在を機械検証済み(不在 0)。レポート E-4 に格納 |
| `yasmine` バヤニモードの `custom_states` | — | **Phase 4 で「定義が要る」と確定**。定義内容(種別・値域・増減)は seed 投入工程の手番 |
| 既配布の `move_code` R5 複数形 | 14 | `ingrid`(4)/`jamie`(4)/`lily`(2)/`mai`(2)/`zangief`(2)。改名マイグレが要る ⇒ §J |

## 教訓追記(第7バッチで判明・残キャラと次工程へ)

75. **★公式 dist が無くても「既配布キャラの先例」で command は一意に決まることがある**: 第7バッチの補完 4 件は、**すべて既配布 CSV の同名・同系統の行から復元した**(`zangief`/`marisa`/`cammy` ＋ 同 CSV 内の OD 展開)。とくに `zangief/standing_heavy_punch_holding` は `name_ja`「立ち強P(ホールド)」まで完全一致していた。⇒ **degrade セッションで「公式が無いから何も埋められない」と結論する前に、`name_ja` 完全一致を 24 CSV 横断で引くこと。** 逆に、**派生技の追加入力(構えからの単ボタン等)は先例が効かない**——キャラ固有だからである。埋まる型と埋まらない型は最初から分かれている。

76. **★同一バッチ内の別キャラが「同型構造の正解」を持っていることがある**: `dee_jay` のジョスクール派生 10 行の `is_derived` 付与漏れは、**同じバッチの `sagat` タイガーネクサス派生 6 行が同型で `true`** だったことで一意に決まった(構え → 単ボタン派生・OD 版は OD 構えから・command は通常/OD で同一)。**既配布 24 キャラを探しても同型は無く、答えは隣のキャラにあった。** ⇒ **突合の探索範囲は「既配布」ではなく「今回の対象を含む全 CSV」にすること。**

77. **★`move_code` の規約検査(R1〜R7)は綴り誤りを検出しない**: `alex/standing_heavy_punch_holing` は `^[a-z0-9_]+$` を満たし、重複でも異常長でも区切り異常でもないため **R1〜R7 を全部素通りする**。見つかったのは `marisa`/`zangief` の同名行との突合による。⇒ **規約検査が 0 件でも「綴りが正しい」ことの証明にはならない。** 第6バッチの `trunc_slap`→`trunk_slap` も同型(あちらは dist との `name_ja` 突合で発見)。

78. **★`move_code` を改名したら `original_move_code` の参照セルも直す**: `rush_standing_heavy_punch_holing` の改名時、**同じ行の `original_move_code` が旧 code(`standing_heavy_punch_holing`)を指したまま**になりかけた。放置すると rush 版が元技を解決できず、エイリアスの `rush-original-unfilled` が増える(＝当該技だけ日本語技名のままになる)。**`move_code` は他行から参照される唯一の列である。** ⇒ **改名は「その行を直す」ではなく「その code を参照している全セルを直す」作業。** grep で CSV 外の参照(マイグレ・設計文書)も確認すること。

79. **★`is_derived=true` は collision を消すが、表記を取り戻しはしない**: `dee_jay` の 10 行は `collision`(投入しない)から `derived`(投入しない)へ移っただけで、**エイリアス表記は依然として出ない**。`sagat` の同型 6 行も同じ状態にある。得られたのは **`move_commands` 索引の曖昧さの解消**(★要確認 1:N が 7 組→2 組)であって表記ではない。教訓52 のとおり **`is_derived=true` は表記と索引の両方を落とす**。⇒ **「衝突が消えた」を「表記が出るようになった」と報告しないこと。** 表記も出したい場合は別の設計判断が要る(裁定2 の層 B 待ちと同型)。

80. **★degrade でも「実測で裏を取る」経路がある —— `-data` フラグでサンドボックス適用できる**: `cmd/seedgen` は `-data`(手入力 CSV ディレクトリ)を取る。**対象 CSV を一時領域へ複製して修正案を当て、`-data` で差し替えて dry-run を回せば、承認前に効果を実測できる**(リポジトリは無変更・`git status` クリーン)。第7バッチは承認前に collision 14→4 / srk 10→0 を確定させ、承認後に本番 CSV で同値を再現した。⇒ **「直したらこうなるはず」で承認を求めない。数字を出してから求める。**

## Phase 4 の判断結果(2026-08-25・開発者回答)

| 対象 | 回答 | 適用 |
|---|---|---|
| **`alex` rush 版 12 行の `on_hit` / `on_block`** | **通常版の値へ揃える(機械適用)** | **9 行を是正**(3 行は元技と既に同値)。`rush_{light,medium,heavy}_slashing_elbow` / `rush_palm_jab` / `rush_shoulder_launcher` / `rush_heavy_lariat` / `rush_heavy_lariat_holding` / `rush_air_stampede` / `rush_sweep_combination_1hit` |
| **`yasmine/alon_1hit_*` の `_1hit`** | **落とす** | `alon_1hit_{light,medium,heavy,od}` → **`alon_{light,medium,heavy,od}`**(4 行)。未投入なのでマイグレ不要 |
| **`yasmine/talim_ng_hangin_light` の `damage=0`** | **0 が正しい**(ダメージのない技) | **書き換えず**。**`docs/seed-data/input-notes.md` へヤスミンの節を新設**して根拠を残した(次回の precheck が同じ行を再検出しないため) |
| **`yasmine` バヤニモードの `custom_states`** | **定義が要る** | **定義内容は seed 投入工程の手番**。投入波の手順へ「`moves` seed との前後関係を含めて設計する」として記録 |

**⇒ 第7バッチの適用は合計 33 行**(Phase 3 の 20 行 ＋ Phase 4 の 13 行)。**変更セルは 41、`move_code` / `command` / `original_move_code` / `is_derived` / `name_ja` / `on_hit` / `on_block` の 7 列のみ**(`git diff` を列単位で機械確認)。フレーム整合は **330/330 成立**を維持(`on_hit`/`on_block` は `total` の算出に入らない)。

## 教訓追記(Phase 4 で判明)

81. **★手入力ツールが列へ一律のオフセットを乗せていることがあり、「例外を直していない」という自認とセットで現れる**: `alex` のラッシュ版は **31 行すべてが元技比 `on_hit`/`on_block` ＋4F** で、例外は 1 件も無かった。開発者の `notes_tool`「これは特殊な技なので増えない。…機械的にやりたかったので直していない」は、**ツールが一律加算した結果を後から個別に打ち消せなかった**という意味である。⇒ **「同系の全行が同じ差を持つ」を見つけたら、それは実測ではなく算出の可能性が高い**(教訓48 の `total` と同型)。**そのとき `notes_tool` の自認宣言が例外を教えてくれる。**

82. **★是正すると `notes_tool` の記述が古くなる。書き換えずに正典へ落とす**: `alex` ラッシュ 12 行の `notes_tool` は「直していない」と書いているが、Phase 4 で直したため**記述が事実と食い違う状態になった**。`notes_tool` は**開発者が手入力ツール上で書く列**なので本チェックでは書き換えず、`input-notes.md` の 2026-08-25 節へ「揃えた」ことと「注記が古くなった」ことの両方を記録した。⇒ **AI が直した結果、開発者の一次記録が古くなる型がある。** 消さず・書き換えず、**正典側に「この注記はもう当てはまらない」と書く**のが安全。

83. **★`damage=0` は「未入力」と「ダメージのない技」の 2 種があり、機械では区別できない**: `yasmine/talim_ng_hangin_light` は同系統が 1100/1200/800 のなかで 1 行だけ 0 だったが、**開発者判定は「0 が正しい」**だった。`chain_cancel_total` の NULL 2 種(D-137/D-143)と同型である。⇒ **「同系で 1 行だけ違う」を欠損と決めない**(教訓34 の一般形)。**判定結果は `input-notes.md` へ落として、次回が同じ往復をしないようにする。**

---

# 第7バッチ 追補(2026-08-25・公式 dist 接続後・alex / dee_jay / sagat / yasmine)

**第7バッチは公式 dist 未接続の degrade だった**(同バッチ冒頭を参照)。本追補は **`combomgr-importer/dist` を解決できるセッション**で、そこに残した **未実施 4 群**を処理したもの。**公式の生値は本ファイルへ転記していない**(数値の並記は非 git のレポートにある)。

**`seed-progress.md` の `precheck` は「部分」→「済」へ更新した。**

## 未実施 4 群の処理結果

| 項目 | 第7バッチ | 本追補 |
|---|---|---|
| command 補完の本体(33 件) | 未実施 | **21 件を適用**(確信度「高」)・**4 件は「中」で保留**・**8 件は理由付きで据え置き** |
| 空中技の発生フレーム補正漏れ(A-2) | 未実施 | **完了 —— 指摘 0 件** |
| 入力漏れ疑い | 未実施 | **完了 —— 真の欠落 1 件**(`sagat/sa2_savage_tiger`) |
| 公式値との数値差 | 未実施 | **完了 —— 全件が累積方式で説明された** |

## command 補完(21 件・すべて確信度「高」・開発者承認済み)

**★本追補の突合根拠は公式 dist 本体である**(第7バッチは「既配布キャラの先例」だった＝教訓75)。

| char | move_code | name_ja | 補完後 command | 対応 dist code | 突合根拠 |
|---|---|---|---|---|---|
| alex | `light_slashing_elbow` | 弱スラッシュエルボー | `r plus p_l` | `slashing_elbow_light` | `name_ja` 正規化一致(全角空白差のみ)。**強度接尾辞の前後が入れ替わる改名** |
| alex | `medium_slashing_elbow` | 中スラッシュエルボー | `r plus p_m` | `slashing_elbow_medium` | 同上 |
| alex | `heavy_slashing_elbow` | 強スラッシュエルボー | `r plus p_h` | `slashing_elbow_heavy` | 同上 |
| alex | `heavy_lariat_holding` | 【ホールド】ヘビーラリアット | `p_h hold` | `heavy_lariat_charged` | **`Charged`→`Holding` 改名**(教訓 (d))。`active`/`recovery`/`damage` 一致・`startup` は基底と同じ構え経由の補正差 |
| alex | `sweep_combination_1hit` | スイープコンビネーション(単発) | `k_h` | `sweep_combination_1` | **`(1段目)`→`(単発)` の n 段止め改名**(教訓43 型) |
| alex | `sweep_combination` | スイープコンビネーション | `k_h chain k_h` | `sweep_combination_2` | **`(2段目)`→無印(フル)**。手入力側は累積ダメージなので dist 単段と一致しない |
| dee_jay | `threebeat_combo_2hits` | 3ビートコンボ(2発止め) | `p_l chain k_m` | `threebeat_combo_2` | **`startup` 完全一致** |
| dee_jay | `threebeat_combo` | 3ビートコンボ | `p_l chain k_m chain k_m` | `threebeat_combo_3` | **`startup` 完全一致** |
| dee_jay | `dee_jay_special_2hits` | ディージェイスペシャル(2発止め) | `p_m chain p_h` | `dee_jay_special_2` | **`startup` 完全一致** |
| dee_jay | `dee_jay_special` | ディージェイスペシャル | `p_m chain p_h chain k_h` | `dee_jay_special_3` | **`startup` 完全一致** |
| dee_jay | `funky_dance_2hits` | ファンキーダンス(2発止め) | `p_m chain p_m` | `funky_dance_2` | **`startup` 完全一致** |
| dee_jay | `funky_dance` | ファンキーダンス | `p_m chain p_m chain p_h` | `funky_dance_3` | **`startup` 完全一致**。第7バッチが「3 段目が決まらない」とした箇所 |
| dee_jay | `sa2_climactic_strike` | SA2 クライマックスブロー | `p_h` | `sa2_climactic_strike_{marvelous,headliner}` | **親が 2 種あるが command は両者同一**なので一意 |
| dee_jay | `sa2_encore_beat` | SA2 アンコールビート | `k_h` | `sa2_encore_beat_{marvelous,headliner}` | 同上 |
| yasmine | `sunod_sunod_na_sipa_2hits` | スノスノッド・ナ・シパ(2発止め) | `k_m chain k_m` | `sunod_sunod_na_sipa_1` | **`startup`/`active`/`recovery` 完全一致** |
| yasmine | `sunod_sunod_na_sipa` | スノスノッド・ナ・シパ | `k_m chain k_m chain k_h` | `sunod_sunod_na_sipa_2` | **`startup`/`active` 一致** |
| yasmine | `kulog_od` | ODクロッグ | `k k alt_sep k` | `kulog_od` | **`move_code`・`name_ja` とも一致**(第7バッチの改名が効いた) |
| yasmine | `alon_light` | 弱アロン | `d dr r plus p_l chain r plus p` | `alon_1_light` | **下記の累積検算 8/8 成立** |
| yasmine | `alon_medium` | 中アロン | `d dr r plus p_m chain r plus p` | `alon_1_medium` | 同上 |
| yasmine | `alon_heavy` | 強アロン | `d dr r plus p_h chain r plus p` | `alon_1_heavy` | 同上 |
| yasmine | `alon_od` | ODアロン | `d dr r plus p p chain r plus p` | `alon_1_od` | 同上 |

> **★アロン系の累積検算(8/8 成立)**: 手入力の 1 行が **dist の 3 行(親の必殺技 ＋ 1段目 ＋ 2段目)の合計**に一致することを、通常版 4 種・バヤニ版 4 種の**全 8 通りで確認**した。**⇒ 手入力の `alon_*` は「ダロイ・ン・トゥビグ入力から始まる一連の流れ全体」を 1 行で表している**ので、command も親の必殺技コマンドから始まる全長になる。**`bayani_*_alon` が dist の「[強化版]」に対応することも同じ検算で確定した。**

## 保留(確信度「中」・Phase 4 へ)

| 対象 | 件数 | 理由 |
|---|---:|---|
| `yasmine/bayani_{light,medium,heavy,od}_alon` の command | 4 | 値は累積検算で確定しているが、**通常版アロンと完全に同一の command になる**。同一 command の行を 2 つ並べる設計でよいかが開発者判断(両方 `is_derived=true` なので索引・表記への実害はない) |

## 補完しない 8 件(すべて理由あり)

| char | move_code | 理由 |
|---|---|---|
| sagat | `sa2_savage_tiger_raid` | **dist 側も command 空**(`condition` に「入力なし」と明記)。**教訓11 のとおり空が正**。第7バッチの判断を公式で追認した |
| alex | `prowler_stance_cancel` | **dist に対応行が存在しない**(公式は構え本体と前後移動の 3 行のみ)。**迷ったら埋めない** |
| yasmine | `ulan_{light,medium,heavy}` | **行構成の判断が先**(下記)。3 行へ同一 command を入れると 3 重衝突で全行の表記が落ちる |
| yasmine | `kulog_{light,medium,heavy}` | 同上 |

## 機械検証(第7バッチ適用後 → 本追補適用後)

| 指標 | 前 numeric / srk | 後 numeric / srk |
|---|---|---|
| 投入(キャラ別) | 248 / 254 | 248 / 254(**不変**) |
| **`derived-no-command`** | **32 / 32** | **11 / 11** |
| `derived` | 41 / 41 | 62 / 62 |
| `no-command` | 1 / 1 | 1 / 1 |
| `collision` | 4 / 0 | 4 / 0(**増えない**) |
| `rush-original-unfilled` | 17 / 15 | 17 / 15 |

- **★表記は増えていない。** 21 行はすべて `is_derived=true` なので、**`derived-no-command`(データ欠損)から `derived`(意図した除外)へ移っただけ**である(教訓79)。**得られたのは段階2 のコマンド入力解決であって表記ではない。**
- 残った `derived-no-command` 11 件 = **保留 4(バヤニ) ＋ 補完しない 7**(`prowler_stance_cancel` ＋ `ulan`/`kulog` 各 3)。**未説明の残余ゼロ。**
- `collision` 4 件は `alex/2HP`・`dee_jay/2LK` の**地上技×空中技**で、**既配布 24 キャラに 38 組の同型が出荷済み**(教訓41)。**CSV では直せない型。**
- `git diff` を列単位で機械確認 —— **変更は 21 セル、`command` 列のみ。行数・列構成は不変。**
- dry-run は `-migrations` を一時領域へ向けて実行。`migrations/` は無変更。

## 未適用のまま残したもの(Phase 4 / §J 行き)

| 対象 | 内容 |
|---|---|
| **`sagat` サベージタイガー派生 3 行の `is_derived`** | **`sa2_savage_tiger_{zenith,pendulum,stomp}` が `is_derived=false` のまま、command が裸の方向(`r`/`l`/`d`)**。dry-run の生成 SQL に **`6 (SA2)` / `4 (SA2)` / `2 (SA2)` という表記が実際に出る**＝**単独入力で SA2 が出るように表示される**(CHANGE-094 が是正した害) |
| **`sagat/sa2_savage_tiger`(親行)の追加** | **dist にあって手入力に無い唯一の真の欠落**。派生 4 行の damage が**一律に親の分だけ大きい**ことが裏付け。行追加は公式値の採否を伴うため開発者判断 |
| `yasmine/ulan`・`kulog` の行構成 | ours は各 3 行が**全列バイト同一**、dist は 1 行で command も強度非依存。統合(規約に合う)と 3 行維持(`notes_tool` の可変フレーム構想に合う)の両論。**提案しない** |
| `yasmine/pangil_sa_likuran_od` の damage | 非 OD と同値のまま。**公式は OD 3 種すべてで別値**。非 OD からの複製ミスの疑い |
| `dee_jay/air_slasher_projectile_od` | dist は「（射出）」を別行に持つが手入力に無い。設計差か欠落か要確認 |
| `dee_jay` 失敗版 SA2 6 行 / `yasmine` 二重状態変種 1 行 | 意図的省略の公算が高い(確認のみ) |

## 教訓追記(本追補で判明)

84. **★degrade の「未実施」は、接続後に必ず結論が変わるとは限らない —— 変わらなかったことも記録する**: 第7バッチが未実施とした 4 群のうち、**A-2(空中技の発生フレーム補正漏れ)は接続後も指摘 0 件**だった。基本ジャンプ通常技 24 行が公式と同値だが、**既チェック 24 キャラの同種行は 143/144 が同値**であり、**「公式値のまま」が確立した運用**だったからである(ジャンプ 1F 目から出せるので補正が要らない)。**補正が要る空中技には実際に補正が入っていた**(`alex/flying_cross_chop`・`dee_jay/knee_shot`)。⇒ **「公式と同値」を機械的に補正漏れとして数えない。キャラ横断の同種行の同値率を先に測る**(教訓69 の手法を A-2 へ適用した形)。

85. **★`is_derived=false` の見落としは「裸のボタン」だけでなく「裸の方向」でも起きる —— 後者は `collision` に出ない**: 第7バッチは `dee_jay` のジョスクール派生 10 行を **`collision` 件数を手がかりに**発見した(command が `k_l`/`p` 等の裸ボタンで、基底と衝突したため)。**しかし `sagat` のサベージタイガー派生 3 行は command が `r`/`l`/`d` の裸の方向で、方向単独では他技と衝突しないため `collision` に一切現れなかった**。生成 SQL を直接見て初めて `6 (SA2)` / `4 (SA2)` / `2 (SA2)` が出ていると分かった。⇒ **dry-run の件数表だけを見て「衝突ゼロ＝健全」と読まない。生成物の中身を引くこと。** **`is_derived` の検査は `collision` ではなく「command が単独入力として成立するか」で回す。**

86. **★親行が CSV に無いまま派生行だけが入っていることがある。ダメージの一律オフセットが唯一の痕跡になる**: `sagat/sa2_savage_tiger` は dist にあり手入力に無かったが、**派生 4 行はすべて存在していた**ため、行数比較でも `move_code` 規約検査でも引っかからない。見つかったのは、**派生 4 行の damage が公式に対して一律に同じ幅だけ大きく、その幅が親行の damage と一致した**からである。⇒ **「同系の全行が同じ差を持つ」は、教訓81 では算出の兆候だったが、ここでは欠落した親の兆候だった。** **一律オフセットを見たら、まず「その幅の正体は何か」を dist 側で探す。**

87. **★`notes_tool` は「指摘を取り下げる根拠」として機能する。全件読まないと開発者へ差し戻してしまう**: 本追補では **2 件を B(疑わしい差分)に挙げかけて取り下げた** —— `yasmine/kulog_*` のフレーム 4 列全空(「**ウランと異なり、派生元によりフレーム可変**。…セットプレイ自動走査にはでないようにする」)と、`dee_jay/sa2_climactic_strike`・`sa2_encore_beat` の damage が公式と異なる件(「**Headliner 派生なら別値になる**。…ややこしくなるので**1 行だけ作成**」)。**どちらもデータだけを見れば「系統内の非対称」「公式との不一致」で、機械的手がかりは B を指していた。** ⇒ **`notes_tool` の全件読了は「意図的差分を見逃さないため」だけでなく、「開発者が既に出した結論を質問し返さないため」でもある。** 対象キャラの非空セルは 62 件と少ない。**必ず全部読む。**

88. **★`notes_tool` の一文だけを切り出すと逆の意味に読める。隣接文と対で読む**: `yasmine/ulan_*` の「**将来的には Kulog と同じ不定系にする必要があるかも**」を、当初「3 行を 1 行へ減らす宣言」と読みかけた。しかし**直前の文が「こちらは派生元との組み合わせに関わらずフレームは一定」**であり、**`kulog_*` 側は「ウランと異なり、派生元によりフレーム可変」**と書いている。⇒ **「不定系」はフレームを一定値で持つか可変扱いにするかの話であって、行数の話ではなかった。** これに気づかず統合を提案していたら、**開発者の構想と反対向きの変更を「規約どおり」として推してしまうところだった。** **教訓70(注記の射程は列ごとに違う)の一般形**——**射程は「文ごと」にも違う。**

89. **★公式の `condition_ja` は `move_derivations` の親を直接与える。日本語文からの推定より強い**: 引き継ぎ資料の親参照表は `notes_tool` の日本語文から起こしたため **10 行が確信度「中」**だったが、**dist の `condition_ja`(「（ジョスクール中に）」等)を引くと全件が「高」になり、同時に 3 行の親が誤っていたことが判明した** —— `juggling_dash_od` の親は `jus_cool`(OD 版ではない)、`juggling_sway`/`juggling_sway_od` の親は `jus_cool` 系ではなく **`juggling_dash`/`juggling_dash_od`**(派生の派生)。さらに `alex` のスラッシュエルボーは **「ブレイカー・スタンス or ステップイン中に」で親が 2 つ**だった。⇒ **親参照の起票素材は `notes_tool` ではなく `condition_ja` を一次情報にする。** **`notes_tool` は「〜から派生」としか書かないが、公式は「どの状態から」を書いている。**

## Phase 4 の判断結果(2026-08-25・開発者回答)

| 対象 | 回答 | 適用 |
|---|---|---|
| **`sagat` サベージタイガー(#3/#4)** | **親行は追加しない。派生 4 行に「SA の全入力 ＋ 各派生ボタン」を書く** | **4 行の command を是正**(下記) |
| **`yasmine/bayani_*_alon`(#2)** | **OK** | **4 行を補完**(通常版アロンと同一 command) |
| **`yasmine/ulan`・`kulog`(#5)** | **3 行維持** | 行構成は変更なし。**command は未決**(下記) |
| **`yasmine/pangil_sa_likuran_od`(#6)** | **公式値へ是正してよい(実測でも一致)** | **damage を是正** |

### ★`sagat` サベージタイガー —— 「親行を足す」より良い解だった

**開発者案**: 親行 `sa2_savage_tiger` を追加せず、**派生 4 行の command を `<SA の全入力> chain <派生ボタン>` の形にする**。

| move_code | 補正前 → 補正後 |
|---|---|
| `sa2_savage_tiger_raid` | 空 → `d dl l d dl l plus k`(**派生ボタンなし＝SA の全入力そのもの**) |
| `sa2_savage_tiger_zenith` | `r` → `d dl l d dl l plus k chain r` |
| `sa2_savage_tiger_pendulum` | `l` → `d dl l d dl l plus k chain l` |
| `sa2_savage_tiger_stomp` | `d` → `d dl l d dl l plus k chain d` |

**先例(開発者の指示で調査)**: **`<親技の全入力> chain <派生入力>` は既配布 5 キャラ 40 行で確立した書式**である —— `akuma/adamant_flame_*` ／ `elena/moon_glider_*` ／ `jamie/freeflow_{strikes,kicks}_*`(2 段派生は `chain` を 2 回)／ `marisa/dimachaerus_*` ／ 本バッチの `yasmine/alon_*`。**SA/CA 階層にも先例がある**(`akuma/ca_shun_goku_satsu` = `p_l chain p_l chain r chain k_l chain p_h`・`is_derived=false`)。

**効果(実測)**:

| 表記 | 補正前 | 補正後 |
|---|---|---|
| zenith | **`6 (SA2)`** | **`214214K>6 (SA2)`** |
| pendulum | **`4 (SA2)`** | **`214214K>4 (SA2)`** |
| stomp | **`2 (SA2)`** | **`214214K>2 (SA2)`** |
| raid | (command 空・未投入) | **`214214K (SA2)`** |

**★あわせて穴が 1 つ塞がった**: 補正前は **`sagat` の SA2 モーション `d dl l d dl l plus k` がどの行の command にも存在しなかった**(SA1・SA3・CA は自分のを持っていた)。**SA2 の入力で引ける行が 1 つも無い状態**だったのが、`raid` の補完で解消した。

## 機械検証(#1 適用後 → Phase 4 適用後)

| 指標 | 第7バッチ後 | #1 適用後 | **Phase 4 完了後** |
|---|---|---|---|
| 投入(キャラ別) | 248 / 254 | 248 / 254 | **249 / 255**(＋1 ＝ `raid`) |
| `derived` | 41 / 41 | 62 / 62 | **72 / 72** |
| **`derived-no-command`** | **32 / 32** | 11 / 11 | **1 / 1** |
| **`no-command`** | 1 / 1 | 1 / 1 | **0 / 0** |
| `collision` | 4 / 0 | 4 / 0 | **4 / 0**(**一度も増えていない**) |
| `rush-original-unfilled` | 17 / 15 | 17 / 15 | 17 / 15 |

**⇒ 実質の command 空は 33 件 → 1 件**(`alex/prowler_stance_cancel` のみ)。

- `git diff` を列単位で機械確認 —— **変更は 36 セル、`command` 35 ＋ `damage` 1 の 2 列のみ。行数・列構成は不変。**
- `go build ./...` / `go test ./internal/seedgen/ ./internal/infra/migration/` 通過。`migrations/` は無変更。
- **残る `derived-no-command` は 1 件** = `alex/prowler_stance_cancel`(dist に対応行なし)。**未説明の残余ゼロ。**

### `yasmine/ulan`・`kulog` の command(#5 の続き・決着)

**3 行維持のうえで、6 行とも公式値をそのまま入れた** —— `ulan_{light,medium,heavy}` = `p` ／ `kulog_{light,medium,heavy}` = `k`(いずれも 3 行で同一値)。

**採用理由**: **この系統の既定の書き方が「公式値そのまま・部分形」**であるため。`ulan_od` = `p p alt_sep p` は**開発者が入れた行**、`kulog_od` = `k k alt_sep k` は本追補 #1 で承認された行で、**どちらも公式値の逐語**である。`alon_*` で使った全入力形(`d dr r plus … chain …`)を採らなかったのは、**`kulog` は派生元によってフレームが変わり親を 1 つに特定できない**ため(`notes_tool`)。**ウランだけ全入力形にすると系統内で書式が割れる。**

> **★却下された案 —— 親の強度と 1:1 対応**: AI は当初 `ulan_light` ← 弱ムカ、`ulan_medium` ← 中ムカ …の 1:1 を提案したが、**開発者判定は「`kulog` の 1:1 対応は誤り」**。`notes_tool` の「ウランと異なり、派生元によりフレーム可変」と整合する(**1 行が複数の親を持つので 1:1 にならない**)。

## 未決(次の手番へ)

| 対象 | 内容 |
|---|---|
| `alex/prowler_stance_cancel` | dist に対応行が無く、候補を作れない。**埋めない**(本追補で唯一残った command 空) |

## 教訓追記(Phase 4 で判明)

90. **★「親行を足す」より「子に全入力を書く」ほうが良いことがある —— 表記が消えるか出るかで結果が反対になる**: `sagat` のサベージタイガー派生 3 行が `6 (SA2)` と表示される件に対し、**AI 側は `is_derived=true`(＝索引から外す)を提案した**が、**開発者案は「command に SA の全入力を書く」だった**。前者は教訓79 のとおり**表記ごと消える**のに対し、後者は **`214214K>6 (SA2)` という正しい表記が出る**。さらに **`raid` の補完で SA2 モーションの穴も塞がり、投入行が 1 増えた**。⇒ **`is_derived=true` は「誤った表記を消す」手段であって「正しい表記を作る」手段ではない。** **まず「正しい command を書けないか」を検討し、それが無理なときに初めて索引から外す。**

91. **★書式の先例は「同じ階層」ではなく「同じ構造」で探す**: サベージタイガーは SA2 だが、書式の先例が最も多かったのは **special の必殺技派生**(`akuma`/`elena`/`jamie`/`marisa` の 40 行)だった。**SA/CA 階層の先例は 1 件しかない**(`akuma/ca_shun_goku_satsu`)。⇒ **category で絞ると先例が見つからず「前例なし」と結論してしまう。** 探すべきは「**親の入力があり、そこから追加入力で分岐する**」という構造であって、技の種別ではない。

92. **★`command` 空でない行も補完の対象になりうる —— 「空を埋める」だけを見ていると取り落とす**: 本バッチの `zenith`/`pendulum`/`stomp` は **command が入っていた**(`r`/`l`/`d`)ため、**「command 空の抽出」(check-criteria §1-1 の手順 1)には一度も現れなかった**。実際、第7バッチの母数計算(空 112 件 → 実質 37 件)にも含まれていない。見つかったのは**生成 SQL の表記を直接読んだから**である。⇒ **A-1 の抽出条件を「空の行」に限定しない。「単独で成立しない入力が入っている行」も同じ欠陥である。**

93. **★`is_derived=true` の行は衝突判定に載らない。「同じ command を複数行へ入れると衝突する」は成り立たない**: `yasmine/ulan`・`kulog` の 3 行へ同一値を入れる案に対し、AI は「3 重衝突で全行の表記が落ちる(教訓67)」を制約として提示し、**それを避けるための 1:1 案を組み立てた**。**サンドボックスで実測すると `collision` は 4 / 0 のまま変わらず**、6 行は `derived-no-command` から `derived` へ移っただけだった —— **`dropCollisions` は索引へ載る行だけを見るので、`is_derived=true` の行は最初から対象外**である。⇒ **教訓67 は `is_derived=false` の行についての教訓であり、無条件の制約ではない。** **制約を根拠に案を組む前に、その制約が当の行に効くかを実測する**(教訓80 の一般形＝「効果」だけでなく「制約」も数字で確かめる)。

94. **★同じ系統で二度読み違えた —— 系統内の既存行が最も強い先例である**: `yasmine` の `ulan`/`kulog` では、AI が **(1)「不定系」を行数の話と誤読**(教訓88)、**(2) 親との 1:1 対応を提案して却下**、と続けて外した。最終的に正解だったのは **`ulan_od` = `p p alt_sep p`(開発者が入れた行)と同じ「公式値そのまま・部分形」**であり、**答えは最初から同じ CSV の隣の行にあった**。⇒ **系統の書式を決めるときは、公式・規約・他キャラより先に「その系統に既に入っている行」を見る。** **教訓76 は「答えは隣のキャラにあった」だったが、ここでは「隣の行」だった。**

# 第8バッチ(2026-09-01・blanka / c_viper / dhalsim)

`combomgr-importer/dist` 接続下で未precheck 3キャラを処理。Phase 1のread-onlyレポート後、開発者承認に基づきcommand補完・機械的整形を適用した。公式の生フレーム値・damage値は本履歴へ転記しない。

## command補完・是正(68行)

| キャラ | move_code | name_ja | command 前→後 | 対応dist code | 突合根拠 | 確信度 |
|---|---|---|---|---|---|---|
| blanka | `coward_crouch_cancel` | フィアーダウン(解除) | `空` → `u` | `—` | notes_toolの上入力＋開発者確認 | 高 |
| blanka | `electric_thunder_holding` | エレクトリックサンダー（ホールド） | `空` → `d dl l plus p hold` | `electric_thunder` | 基底/公式hold版＋開発者確認 | 高 |
| blanka | `electric_thunder_holding_od` | ODエレクトリックサンダー（ホールド） | `空` → `d dl l plus p p hold` | `electric_thunder_od` | 基底/公式hold版＋開発者確認 | 高 |
| blanka | `lightning_beast_electric_thunder_holding` | 【ライトニングビースト】エレクトリックサンダー（ホールド） | `空` → `d dl l plus p hold` | `lightning_beast_electric_thunder` | 基底/公式hold版＋開発者確認 | 高 |
| blanka | `lightning_beast_od_electric_thunder_holding` | 【ライトニングビースト】ODエレクトリックサンダー（ホールド） | `空` → `d dl l plus p p hold` | `lightning_beast_od_electric_thunder` | 基底/公式hold版＋開発者確認 | 高 |
| blanka | `lightning_beast_light_rolling_attack` | 【ライトニングビースト】弱ローリングアタック | `空` → `charge_l r plus p_l` | `lightning_beast_l_rolling_attack` | 公式distのname_ja/系統/フレーム一致 | 高 |
| blanka | `lightning_beast_medium_rolling_attack` | 【ライトニングビースト】中ローリングアタック | `空` → `charge_l r plus p_m` | `lightning_beast_m_rolling_attack` | 公式distのname_ja/系統/フレーム一致 | 高 |
| blanka | `lightning_beast_heavy_rolling_attack` | 【ライトニングビースト】強ローリングアタック | `空` → `charge_l r plus p_h` | `lightning_beast_h_rolling_attack` | 公式distのname_ja/系統/フレーム一致 | 高 |
| blanka | `lightning_beast_light_vertical_rolling_attack` | 【ライトニングビースト】弱バーチカルローリングアタック | `空` → `charge_d u plus k_l` | `lightning_beast_l_vertical_rolling_attack` | 公式distのname_ja/系統/フレーム一致 | 高 |
| blanka | `lightning_beast_medium_vertical_rolling_attack` | 【ライトニングビースト】中バーチカルローリングアタック | `空` → `charge_d u plus k_m` | `lightning_beast_m_vertical_rolling_attack` | 公式distのname_ja/系統/フレーム一致 | 高 |
| blanka | `lightning_beast_heavy_vertical_rolling_attack` | 【ライトニングビースト】強バーチカルローリングアタック | `空` → `charge_d u plus k_h` | `lightning_beast_h_vertical_rolling_attack` | 公式distのname_ja/系統/フレーム一致 | 高 |
| blanka | `lightning_beast_light_backstep_rolling_attack` | 【ライトニングビースト】弱バックステップローリング | `空` → `r dr d dl l plus k_l` | `lightning_beast_l_backstep_rolling_attack` | 公式distのname_ja/系統/フレーム一致 | 高 |
| blanka | `lightning_beast_medium_backstep_rolling_attack` | 【ライトニングビースト】中バックステップローリング | `空` → `r dr d dl l plus k_m` | `lightning_beast_m_backstep_rolling_attack` | 公式distのname_ja/系統/フレーム一致 | 高 |
| blanka | `lightning_beast_heavy_backstep_rolling_attack` | 【ライトニングビースト】強バックステップローリング | `空` → `r dr d dl l plus k_h` | `lightning_beast_h_backstep_rolling_attack` | 公式distのname_ja/系統/フレーム一致 | 高 |
| blanka | `lightning_beast_light_aerial_rolling_attack` | 【ライトニングビースト】弱エリアルローリング | `空` → `charge_l r plus p_l` | `lightning_beast_l_aerial_rolling_attack` | 公式distのname_ja/系統/フレーム一致 | 高 |
| blanka | `lightning_beast_medium_aerial_rolling_attack` | 【ライトニングビースト】中エリアルローリング | `空` → `charge_l r plus p_m` | `lightning_beast_m_aerial_rolling_attack` | 公式distのname_ja/系統/フレーム一致 | 高 |
| blanka | `lightning_beast_heavy_aerial_rolling_attack` | 【ライトニングビースト】強エリアルローリング | `空` → `charge_l r plus p_h` | `lightning_beast_h_aerial_rolling_attack` | 公式distのname_ja/系統/フレーム一致 | 高 |
| blanka | `rolling_cannon` | ローリングキャノン（後方斜め下） | `plus p` → `dl plus p` | `rolling_cannon` | 方向別name_ja＋開発者確認 | 高 |
| blanka | `rolling_cannon_down` | ローリングキャノン（下） | `空` → `d plus p` | `rolling_cannon` | 方向別name_ja＋開発者確認 | 高 |
| blanka | `rolling_cannon_down_forward` | ローリングキャノン（前方斜め下） | `空` → `dr plus p` | `rolling_cannon` | 方向別name_ja＋開発者確認 | 高 |
| blanka | `rolling_cannon_back` | ローリングキャノン（後方） | `空` → `l plus p` | `rolling_cannon` | 方向別name_ja＋開発者確認 | 高 |
| blanka | `rolling_cannon_forward` | ローリングキャノン（前方） | `空` → `r plus p` | `rolling_cannon` | 方向別name_ja＋開発者確認 | 高 |
| blanka | `rolling_cannon_up_back` | ローリングキャノン（後方斜め上） | `空` → `ul plus p` | `rolling_cannon` | 方向別name_ja＋開発者確認 | 高 |
| blanka | `rolling_cannon_up` | ローリングキャノン（上） | `空` → `u plus p` | `rolling_cannon` | 方向別name_ja＋開発者確認 | 高 |
| blanka | `rolling_cannon_up_forward` | ローリングキャノン（前方斜め上） | `空` → `ur plus p` | `rolling_cannon` | 方向別name_ja＋開発者確認 | 高 |
| c_viper | `high_jumping_light_punch` | ハイジャンプ弱P | `空` → `p_l` | `jumping_light_punch` | 同CSVの基底ジャンプ攻撃＋開発者確認 | 高 |
| c_viper | `high_jumping_light_kick` | ハイジャンプ弱K | `空` → `k_l` | `jumping_light_kick` | 同CSVの基底ジャンプ攻撃＋開発者確認 | 高 |
| c_viper | `high_jumping_medium_punch` | ハイジャンプ中P | `空` → `p_m` | `jumping_medium_punch` | 同CSVの基底ジャンプ攻撃＋開発者確認 | 高 |
| c_viper | `high_jumping_medium_kick` | ハイジャンプ中K | `空` → `k_m` | `jumping_medium_kick` | 同CSVの基底ジャンプ攻撃＋開発者確認 | 高 |
| c_viper | `high_jumping_heavy_punch` | ハイジャンプ強P | `空` → `p_h` | `jumping_heavy_punch` | 同CSVの基底ジャンプ攻撃＋開発者確認 | 高 |
| c_viper | `high_jumping_heavy_kick` | ハイジャンプ強K | `空` → `k_h` | `jumping_heavy_kick` | 同CSVの基底ジャンプ攻撃＋開発者確認 | 高 |
| c_viper | `high_jumping_neutral_heavy_kick` | ハイジャンプ垂直ジャンプ強K | `空` → `k_h` | `neutral_jumping_heavy_kick` | 同CSVの基底ジャンプ攻撃＋開発者確認 | 高 |
| c_viper | `high_jump` | ハイジャンプ | `空` → `d u` | `high_jump_neutral` | 公式垂直版＋開発者確認 | 高 |
| c_viper | `thunder_dash_feint_light` | 【サンダースラップ】弱フェイント | `空` → `k` | `thunder_dash_feint` | 公式distのname_ja/系統/フレーム一致 | 高 |
| c_viper | `thunder_dash_feint_medium` | 【サンダースラップ】中フェイント | `空` → `k` | `thunder_dash_feint` | 公式distのname_ja/系統/フレーム一致 | 高 |
| c_viper | `thunder_dash_feint_heavy` | 【サンダースラップ】強フェイント | `空` → `k` | `thunder_dash_feint` | 公式distのname_ja/系統/フレーム一致 | 高 |
| c_viper | `knuckled_pursuit` | チェイスナックル | `空` → `p p` | `knuckled_pursuit` | name_ja・フレーム一致＋typo是正 | 高 |
| c_viper | `high_jump_light_aerial_burning_kick` | 【ハイジャンプ】弱空中バーニングキック | `空` → `d dr r plus k_l` | `aerial_burning_kick_light` | 公式distのname_ja/系統/フレーム一致 | 高 |
| c_viper | `high_jump_medium_aerial_burning_kick` | 【ハイジャンプ】中空中バーニングキック | `空` → `d dr r plus k_m` | `aerial_burning_kick_medium` | 公式distのname_ja/系統/フレーム一致 | 高 |
| c_viper | `high_jump_heavy_aerial_burning_kick` | 【ハイジャンプ】強空中バーニングキック | `空` → `d dr r plus k_h` | `aerial_burning_kick_heavy` | 公式distのname_ja/系統/フレーム一致 | 高 |
| c_viper | `high_jump_od_aerial_burning_kick` | 【ハイジャンプ】OD空中バーニングキック | `空` → `d dr r plus k k` | `aerial_burning_kick_od` | 公式distのname_ja/系統/フレーム一致 | 高 |
| c_viper | `focus_force` | セービングフォース | `空` → `d dl l plus k` | `focus_force_lv1` | 公式distのname_ja/系統/フレーム一致 | 高 |
| c_viper | `focus_force_od` | ODセービングフォース | `空` → `d dl l plus k k` | `focus_force_lv1_od` | 公式distのname_ja/系統/フレーム一致 | 高 |
| c_viper | `focus_force_holding` | セービングフォース（ホールド） | `空` → `d dl l plus k hold` | `focus_force_lv2` | 基底/公式hold版＋開発者確認 | 高 |
| c_viper | `focus_force_holding_od` | ODセービングフォース（ホールド） | `空` → `d dl l plus k k hold` | `focus_force_lv2_od` | 基底/公式hold版＋開発者確認 | 高 |
| c_viper | `focus_force_max_holding` | セービングフォース（最大ホールド） | `空` → `d dl l plus k hold` | `focus_force_lv3` | 基底/公式hold版＋開発者確認 | 高 |
| c_viper | `focus_force_max_holding_od` | ODセービングフォース（最大ホールド） | `空` → `d dl l plus k k hold` | `focus_force_lv3_od` | 基底/公式hold版＋開発者確認 | 高 |
| c_viper | `focus_force_forward_step` | 【セービングフォース】前方ステップ | `空` → `r r` | `focus_force_forward_dash` | 公式distのname_ja/系統/フレーム一致 | 高 |
| c_viper | `focus_force_forward_step_od` | 【ODセービングフォース】前方ステップ | `空` → `r r` | `focus_force_forward_dash` | 公式distのname_ja/系統/フレーム一致 | 高 |
| dhalsim | `drill_kick` | 弱ドリルキック | `空` → `d plus k_l` | `drill_kick_light` | 公式distのname_ja/系統/フレーム一致 | 高 |
| dhalsim | `medium_drill_kick` | 中ドリルキック | `空` → `d plus k_m` | `drill_kick_medium` | 公式distのname_ja/系統/フレーム一致 | 高 |
| dhalsim | `heavy_drill_kick` | 強ドリルキック | `空` → `d plus k_h` | `drill_kick_heavy` | 公式distのname_ja/系統/フレーム一致 | 高 |
| dhalsim | `yoga_fire_od` | ODヨガファイア | `空` → `d dr r plus p p` | `l/m/h_yoga_fire_od（統合）` | 公式強度分割を汎用OD記法へ統合（開発者指定） | 高 |
| dhalsim | `yoga_fire_holding_light` | 弱ヨガファイア（ホールド） | `空` → `d dr r plus p_l hold` | `yoga_fire_charged_light` | 基底/公式hold版＋開発者確認 | 高 |
| dhalsim | `yoga_fire_holding_medium` | 中ヨガファイア（ホールド） | `空` → `d dr r plus p_m hold` | `yoga_fire_charged_medium` | 基底/公式hold版＋開発者確認 | 高 |
| dhalsim | `yoga_fire_holding_heavy` | 強ヨガファイア（ホールド） | `空` → `d dr r plus p_h hold` | `yoga_fire_charged_heavy` | 基底/公式hold版＋開発者確認 | 高 |
| dhalsim | `yoga_arch_od` | ODヨガアーチ | `空` → `d dr r plus k k` | `l/m/h_yoga_arch_od（統合）` | 公式強度分割を汎用OD記法へ統合（開発者指定） | 高 |
| dhalsim | `yoga_float` | ヨガフロート | `空` → `d plus k k` | `yoga_float_immediately` | 公式distのname_ja/系統/フレーム一致 | 高 |
| dhalsim | `yoga_teleport` | Pヨガテレポート（前方） | `空` → `r plus p p p` | `p_yoga_teleport_forward` | 公式distのname_ja/系統/フレーム一致 | 高 |
| dhalsim | `p_yoga_teleport_backward` | Pヨガテレポート（後方） | `空` → `l plus p p p` | `yoga_teleport_backward（P分解）` | 公式distのname_ja/系統/フレーム一致 | 高 |
| dhalsim | `k_yoga_teleport_backward` | Kヨガテレポート（後方） | `空` → `l plus k k k` | `yoga_teleport_backward（K分解）` | 公式distのname_ja/系統/フレーム一致 | 高 |
| dhalsim | `aerial_yoga_teleport` | P空中ヨガテレポート（前方） | `空` → `r plus p p p` | `p_aerial_yoga_teleport_forward` | 公式distのname_ja/系統/フレーム一致 | 高 |
| dhalsim | `sa1_yoga_inferno_light` | SA1 ヨガインフェルノ（弱） | `空` → `d dr r d dr r plus p_l` | `sa1_l_yoga_inferno` | 公式distのname_ja/系統/フレーム一致 | 高 |
| dhalsim | `sa1_yoga_inferno_medium` | SA1 ヨガインフェルノ（中） | `空` → `d dr r d dr r plus p_m` | `sa1_m_yoga_inferno` | 公式distのname_ja/系統/フレーム一致 | 高 |
| dhalsim | `sa1_yoga_inferno_heavy` | SA1 ヨガインフェルノ（強） | `空` → `d dr r d dr r plus p_h` | `sa1_h_yoga_inferno` | 公式distのname_ja/系統/フレーム一致 | 高 |
| dhalsim | `sa2_yoga_sunburst` | SA2 ヨガサンバースト | `空` → `d dl l d dl l plus k` | `sa2_yoga_sunburst_lv1` | 公式distのname_ja/系統/フレーム一致 | 高 |
| dhalsim | `sa2_yoga_sunburst_holding` | 【ホールド】SA2 ヨガサンバースト | `空` → `d dl l d dl l plus k hold` | `sa2_yoga_sunburst_lv2` | 基底/公式hold版＋開発者確認 | 高 |
| dhalsim | `sa2_yoga_sunburst_max_holding` | 【最大ホールド】SA2 ヨガサンバースト | `空` → `d dl l d dl l plus k hold` | `sa2_yoga_sunburst_lv3` | 基底/公式hold版＋開発者確認 | 高 |

> 68行の内訳は、空欄補完67行＋`blanka/rolling_cannon` の部分形 `plus p` を方向対応 `dl plus p` へ是正した1行。rush_variantのcommand空欄は既定運用どおり触らない。

## 同時適用した機械的整形

- `c_viper/knuckled_prusuit` → `knuckled_pursuit`（move_code typo。旧codeへの他ファイル参照なし）。
- `c_viper/high_jumping_neutral_jumping_heavy_kick` → `high_jumping_neutral_heavy_kick`（`jumping` の重複を解消。name_jaは維持）。
- `blanka/lightning_beast_sa1_shout_of_earth` の `SA1` 後の二重空白を単一化。
- `is_derived` 17行を系統規則へ整合: blanka 3行 / c_viper 11行 / dhalsim 3行。
  - 派生元からのみ出る `coward_crouch_cancel` とハイジャンプ攻撃7行は `true`。
  - `hold` を含む別commandで基底と区別できる通常ホールド版9行は `false`。状態変種は `true` 維持。

## エイリアス生成dry-run（適用前 → 適用後）

| 指標 | numeric 前→後 | srk 前→後 |
|---|---:|---:|
| 投入（キャラ別） | 189 → 206 | 189 → 206 |
| derived-no-command | 47 → 0 | 47 → 0 |
| no-command | 20 → 0 | 20 → 0 |
| derived | 25 → 71 | 25 → 71 |
| collision | 16 → 22 | 16 → 22 |
| rush-original-unfilled | 4 → 3 | 4 → 3 |
| SA注記欠落 | 0 → 0 | 0 → 0 |

- collision増加6行は、c_viper セービングフォースのホールド/最大ホールド2組（4行）＋dhalsim SA2ヨガサンバーストのホールド/最大ホールド1組（2行）。公式でも同一commandになる既知の二段階ホールド型で、CSV typoではない。
- 残るcollision 16行はすべて地上技×空中技型。
- `go test ./internal/seedgen/` 通過。`migrations/` は無変更。

## Phase 4 判断完了

### Phase 4 開発者確定（2026-09-01）

- blankaのジャンプ強Pは通常版と垂直版を別行で保持する。既存行を通常版の測定値へ是正し、欠けていた `neutral_jumping_heavy_punch` を追加した。
- dhalsimの公式distにある `long_sliding_kick` は公式側の重複ミスであり、手入力CSVでは `crouching_heavy_kick` 1行への統合を維持する。
- dhalsim `yoga_flame_medium` のactiveと `yoga_blast_heavy` のon_blockは手入力側の実測値が正しいため、公式distとの差を意図的に維持する。
- c_viperの二重`jumping` codeは `high_jumping_neutral_heavy_kick` へ改名し、日本語名は維持する。
- c_viperのセービングフォースLv1は、通常/OD間で交差していたdamageを正しい対応へ入れ替えた。
- c_viperのハイジャンプ攻撃7行は `category=unique` を維持する。
- blanka `standing_medium_punch` のstartupは手入力側の実測値を維持する。
- Phase 1レポート B-3 の未説明数値差は開発者が全件確認し、blanka強バーチカルローリングアタックのフレーム4値とc_viper垂直ジャンプ強Kのdamageのみを是正した。その他は手入力側の実測値を維持する。
- blankaの `lightning_beast_*` はcustom stateとして扱い、moves投入より前にcharacters行とライトニングビーストのcustom state定義を投入する。

## 教訓追記(第8バッチで判明)

95. **方向別に分割した派生は、公式の部分形を全行へ複製せずname_jaと対応する方向トークンを持たせる**: blanka ローリングキャノンは公式1行の `plus p` から手入力8方向へ分割されていた。開発者確認により `dl/d/dr/l/r/ul/u/ur plus p` とし、方向別のコマンド入力解決を可能にした。
96. **公式が強度別ODを持っていても、手入力が性能同一として1行統合した場合は汎用OD記法を採れる**: dhalsim `yoga_fire_od` / `yoga_arch_od` は公式3ボタン組を手入力1行へ統合している。開発者指定によりそれぞれ `... plus p p` / `... plus k k` とした。教訓5の「一意commandなし」に対する明示的な統合表現の先例。
97. **通常/ODの値が互いに完全に入れ替わる形はコピー/転記ミスの強い兆候**: c_viper セービングフォースLv1は後続Lv2/Lv3が公式の通常/OD対応と一致する一方、Lv1のdamageだけが交差している。単なる公式差ではなく列単位の入替候補としてPhase 4へ上げる。
