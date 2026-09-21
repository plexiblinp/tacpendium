# M18-RESEARCH-01-addendum2 調査報告: 全 is_projectile 監査（seed 前是正のための取りこぼし洗い出し）

| 項目 | 内容 |
|------|------|
| 対応指示書 | `docs/instructions/phase3/M18-RESEARCH-01-addendum2-is-projectile-audit.md` v1.0.0 |
| 種別 | read-only データ品質監査報告（addendum #1 のスコープ拡張・事実列挙のみ。**判断・是正は含めない**） |
| 調査モード | auto（自由入力指示なし） |
| 作成日 | 2026-07-20 |
| CSV 実測範囲 | `character_data/*.csv`（全 12 ファイル: guile/ingrid/juri/ken/kimberly/lily/luke/mai/manon/ryu/terry/zangief。`csv.DictReader` でヘッダ名参照によりパース。dev DB は本調査では未使用＝指示書 §2 の調査項目 4 点がいずれも CSV 単体で完結するため） |
| 母数 | 全 12 ファイル合計 **990 行**（`is_projectile` 列の値は全行 `true`/`false` のいずれかで、空欄・欠損・不正値は **0 件**） |

---

## 0. 結論サマリ（冒頭）

- **全体件数**: `is_projectile=true` **102 件** / `false` **888 件**（合計 990 件、キャラ別・category 別内訳は §1）。
- **取りこぼし候補（false×飛び道具っぽい・指示書ヒューリスティックのコア語 14 語で機械的抽出）**: **45 件**。内訳の主なファミリー: kimberly `shuriken_bomb_*` 全 6 件（開発者確定＝要是正）、juri `fuha_*` 系 7 件（うち `fuha_saihasho` は開発者確定＝要是正）、ken/ryu `shoryuken` 系 11 件（`拳` 一致・汎用一致の疑いあり）、ryu `hashogeki` 系 12 件（`波` 一致）、kimberly `bushin_*` 系 5 件（`拳` 一致）、その他単発 6 件（`double_shot`/`double_arrow`/`fatal_shot`/`round_wave_heavy` 等）。全件列挙は §2。
- **取りこぼし候補（拡張語・指示書に無い補足キーワードでの追加抽出）**: **38 件**。大半が mai の `flame_*`/`ryuuenbu`/`hishou_ryuuenjin` 系（`炎`/`焔`/`flame` 一致・26 件）で、家族名からは打撃系必殺技と推測される塊。他に guile `bullet`/`cannon` 系 3 件、ken `flash`/`flame` 系 3 件、kimberly `矢` 系 3 件、ryu `denjin_charge`（`気` 一致）1 件、terry `geyser` 系 2 件。全件列挙は §2.2。
- **逆方向候補（true×非飛び道具っぽい）**: **7 件**。キーワード機械スキャン（斬/舞）で juri `sa1_sakkai_fuhazan`/`fuha_sa1_sakkai_fuhazan`（「斬」＝斬撃を示唆）と mai `sa1_kagerou_no_mai`/`flame_sa1_kagerou_no_mai`（「舞」＝舞踊・移動を示唆）の 4 件を検出。加えて、true 全 102 件の目視全件確認でキーワードスキャンに掛からなかった ingrid `sa2_order_of_the_sun_lv1/lv2/lv3`（「サンオーダー」＝隊形・バフ系を示唆し飛び道具語を含まない）3 件を追加検出。全件列挙は §3。
- **saihasho/shuriken_bomb 全 variant**: juri の `saihasho` ファミリーは 3 variant（`saihasho`=true、`saihasho_od`=true、`fuha_saihasho`=**false**）。kimberly の `shuriken_bomb` ファミリーは 6 variant（`shuriken_bomb_{light,medium,heavy}` と `shuriken_bomb_spread_{light,medium,heavy}` の全 6 件が**全て false**）。開発者確定（全 variant が true が正）と突合すると、**juri は 1/3 variant、kimberly は 0/6 variant が現状 true**。詳細は §4。
- ヒューリスティックの限界（名称に現れない飛び道具の取りこぼし可能性、コア語・拡張語双方の過検出/過少検出の傾向）は §5 に明記。

---

## 1. 全 is_projectile の集計（キャラ別・category 別）

### キャラ別（全 12 ファイル）

| character | true | false | 合計 |
|---|---:|---:|---:|
| guile | 24 | 64 | 88 |
| ingrid | 33 | 58 | 91 |
| juri | 4 | 69 | 73 |
| ken | 4 | 76 | 80 |
| kimberly | 0 | 95 | 95 |
| lily | 0 | 81 | 81 |
| luke | 5 | 78 | 83 |
| mai | 20 | 76 | 96 |
| manon | 0 | 71 | 71 |
| ryu | 8 | 76 | 84 |
| terry | 4 | 66 | 70 |
| zangief | 0 | 78 | 78 |
| **合計** | **102** | **888** | **990** |

kimberly/lily/manon/zangief は `is_projectile=true` の行が **0 件**（＝この 4 キャラでは true と明記された技が現状 1 件も無い。kimberly の `shuriken_bomb_*` 全 6 件は false 側に含まれる＝§2/§4 参照）。

### category 別（全 12 ファイル）

| category | true | false | 合計 |
|---|---:|---:|---:|
| critical_art | 1 | 11 | 12 |
| drive_impact | 0 | 12 | 12 |
| normal | 0 | 220 | 220 |
| rush_variant | 0 | 187 | 187 |
| special | 87 | 263 | 350 |
| super_art | 14 | 48 | 62 |
| system | 0 | 12 | 12 |
| target_combo | 0 | 49 | 49 |
| throw | 0 | 32 | 32 |
| unique | 0 | 54 | 54 |
| **合計** | **102** | **888** | **990** |

`true` は `special`(87)・`super_art`(14)・`critical_art`(1) の 3 category にのみ出現（M18-RESEARCH-01 既報の「projectile 候補は special/super_art/critical_art の 3 category にのみ出現」と一致）。`normal`/`rush_variant`/`system`/`target_combo`/`throw`/`unique`/`drive_impact` の `true` は全て **0 件**。

### 参考: `true` が 1 件以上あるキャラ×category の内訳

| character | category | true | false |
|---|---|---:|---:|
| guile | special | 22 | 7 |
| guile | super_art | 2 | 2 |
| ingrid | critical_art | 1 | 0 |
| ingrid | special | 28 | 9 |
| ingrid | super_art | 4 | 3 |
| juri | special | 2 | 19 |
| juri | super_art | 2 | 3 |
| ken | special | 4 | 30 |
| luke | special | 4 | 26 |
| luke | super_art | 1 | 2 |
| mai | special | 18 | 28 |
| mai | super_art | 2 | 5 |
| ryu | special | 6 | 21 |
| ryu | super_art | 2 | 7 |
| terry | special | 3 | 18 |
| terry | super_art | 1 | 4 |

---

## 2. 取りこぼし候補（`is_projectile=false` かつ名称が飛び道具を示唆）

### 2.1 コア語（指示書 §2.2 記載の例示語そのまま。14 語）による抽出（45 件）

適用語: `hadoken`/`sonic`/`kachousen`/`shuriken`/`bomb`/`saihasho`/`fuha`/`shot`/`wave`/`ball`/`arrow`/`spark`/`fireball`/`projectile`（`move_code` に部分一致）、`弾`/`波`/`衝`/`把`/`拳`（`name_ja` に部分一致）。大文字小文字は無視。`official_ja` 列は現行 CSV スキーマに存在しない（20 列の実列は下記「4」参照）ため、指示書の想定に従い代替として `name_ja` 列を用いた。

| character | code | category | recovery | on_block | name_ja | 一致キーワード |
|---|---|---|---:|---:|---|---|
| guile | double_shot | target_combo | 16 | -6 | ダブルバレット | shot |
| juri | fuha_ankensatsu | special | 19 | -8 | [風破]暗剣殺 | fuha |
| juri | fuha_go_ohsatsu | special | 27 | -12 | [風破]五黄殺 | fuha |
| juri | fuha_saihasho | special | 0 | -3 | [風破]歳破衝 | fuha, saihasho, 衝 |
| juri | fuhajin_heavy | special | 19 | -8 | 強風破刃 | fuha |
| juri | fuhajin_light | special | 21 | -4 | 弱風破刃 | fuha |
| juri | fuhajin_medium | special | 21 | -6 | 中風破刃 | fuha |
| juri | fuhajin_od | special | 21 | -12 | OD風破刃 | fuha |
| ken | quick_dash_shoryuken | special | 48 | -35 | [奮迅脚]昇龍拳 | 拳 |
| ken | shoryuken_heavy | special | 50 | -36 | 強昇龍拳 | 拳 |
| ken | shoryuken_light | special | 33 | -23 | 弱昇龍拳 | 拳 |
| ken | shoryuken_medium | special | 40 | -28 | 中昇龍拳 | 拳 |
| ken | shoryuken_od | special | 50 | -40 | OD昇龍拳 | 拳 |
| kimberly | shuriken_bomb_heavy | special | 0 | NULL | 強細工手裏剣 | bomb, shuriken |
| kimberly | shuriken_bomb_light | special | 0 | NULL | 弱細工手裏剣 | bomb, shuriken |
| kimberly | shuriken_bomb_medium | special | 0 | NULL | 中細工手裏剣 | bomb, shuriken |
| kimberly | shuriken_bomb_spread_heavy | special | 0 | NULL | 強乱れ細工手裏剣 | bomb, shuriken |
| kimberly | shuriken_bomb_spread_light | special | 0 | NULL | 弱乱れ細工手裏剣 | bomb, shuriken |
| kimberly | shuriken_bomb_spread_medium | special | 0 | NULL | 中乱れ細工手裏剣 | bomb, shuriken |
| kimberly | bushin_hellchain | target_combo | 24 | -12 | 武神獄鎖拳 | 拳 |
| kimberly | bushin_hellchain_3hits | target_combo | 25 | -10 | 武神獄鎖拳(3発止め) | 拳 |
| kimberly | bushin_prism_strikes | target_combo | 24 | -12 | 武神天架拳 | 拳 |
| kimberly | bushin_prism_strikes_2hits | target_combo | 18 | -6 | 武神天架拳(2発止め) | 拳 |
| kimberly | bushin_prism_strikes_3hits | target_combo | 25 | -10 | 武神天架拳(3発止め) | 拳 |
| lily | double_arrow | target_combo | NULL | NULL | ダブルアロー | arrow |
| luke | fatal_shot | special | 34 | -21 | フェイタルショット | shot |
| ryu | ca_shin_shoryuken | critical_art | 71 | -52 | CA 真・昇龍拳 | 拳 |
| ryu | denjin_charge_hashogeki | special | 19 | 3 | [電刃錬気]波掌撃 | 波 |
| ryu | denjin_charge_od_hashogeki | special | 19 | 4 | [電刃錬気]OD波掌撃 | 波 |
| ryu | hashogeki_heavy | special | 19 | 2 | 強波掌撃 | 波 |
| ryu | hashogeki_light | special | 18 | -3 | 弱波掌撃 | 波 |
| ryu | hashogeki_medium | special | 17 | -6 | 中波掌撃 | 波 |
| ryu | hashogeki_od | special | 20 | 3 | OD波掌撃 | 波 |
| ryu | shoryuken_heavy | special | 46 | -36 | 強昇龍拳 | 拳 |
| ryu | shoryuken_light | special | 33 | -23 | 弱昇龍拳 | 拳 |
| ryu | shoryuken_medium | special | 42 | -32 | 中昇龍拳 | 拳 |
| ryu | shoryuken_od | special | 52 | -40 | OD昇龍拳 | 拳 |
| ryu | denjin_charge_sa2_shin_hashogeki_lv1 | super_art | 39 | -20 | [電刃錬気]SA2 真波掌撃(Lv1) | 波 |
| ryu | denjin_charge_sa2_shin_hashogeki_lv2 | super_art | 39 | -20 | [電刃錬気]SA2 真波掌撃(Lv2) | 波 |
| ryu | denjin_charge_sa2_shin_hashogeki_lv3 | super_art | 39 | -20 | [電刃錬気]SA2 真波掌撃(Lv3) | 波 |
| ryu | sa2_shin_hashogeki_lv1 | super_art | 39 | -20 | SA2 真波掌撃(Lv1) | 波 |
| ryu | sa2_shin_hashogeki_lv2 | super_art | 39 | -20 | SA2 真波掌撃(Lv2) | 波 |
| ryu | sa2_shin_hashogeki_lv3 | super_art | 39 | -20 | SA2 真波掌撃(Lv3) | 波 |
| ryu | sa3_shin_shoryuken | super_art | 71 | -52 | SA3 真・昇龍拳 | 拳 |
| terry | round_wave_heavy | special | 14 | 5 | ラウンドウェイブ | wave |

（45 件。ken/ryu の `shoryuken`/`sa*_shin_shoryuken` 系 11 件、kimberly の `bushin_*` 系 5 件は「拳」一致による機械的抽出であり、`拳` は「波動拳」等の飛び道具ファミリー名にも「昇龍拳」等の対空技名にも現れる漢字である点に注意。§5 参照。）

### 2.2 拡張語（指示書に無い補足キーワード。本コマンドの補足観点として追加）による抽出（38 件）

指示書 §2.2 は「示唆語の例(heuristic・網羅でなく手掛かり)」と明記しているため、コア語 14 語（上記）に加えて取りこぼしを減らす目的で以下を補足的に追加適用した: `beam`/`ray`/`orb`/`dart`/`missile`/`laser`/`gas`/`flame`/`geyser`/`vulcan`/`cannon`/`bullet`/`disc`/`grenade`/`torpedo`/`burst`/`flare`/`blast`/`needle`/`chakram`/`meteor`/`comet`/`energy`（`move_code`）、`炎`/`焔`/`光`/`気`/`矢`/`針`/`円盤`/`爆`（`name_ja`）。**コア語で既に抽出済みの行は重複計上していない**（2.1 と 2.2 は排他）。

| character | code | category | recovery | on_block | name_ja | 一致キーワード |
|---|---|---|---:|---:|---|---|
| guile | full_bullet_magnum | unique | 19 | -3 | フルブレットマグナム | bullet |
| guile | recoil_cannon | target_combo | 26 | -9 | リコイルキャノン | cannon |
| guile | rush_full_bullet_magnum | rush_variant | 19 | 1 | フルブレットマグナム(ラッシュ) | bullet |
| ken | sa1_dragonlash_flame | super_art | 41 | -24 | SA1 龍尾烈脚 | flame |
| ken | triple_flash_kicks | target_combo | 28 | -11 | 閃光連脚 | 光 |
| ken | triple_flash_kicks_2hits | target_combo | 27 | -12 | 閃光連脚(2発止め) | 光 |
| kimberly | step_up_backward | unique | 3 | -22 | 矢来越え(後方) | 矢 |
| kimberly | step_up_forward | unique | 3 | -22 | 矢来越え(前方) | 矢 |
| kimberly | step_up_neutral | unique | 3 | -22 | 矢来越え(垂直) | 矢 |
| mai | ca_shiranui_ryuu_enbu_ada_zakura | critical_art | 46 | -33 | CA 不知火流・炎舞仇桜 | 炎 |
| mai | flame_heavy_hishou_ryuuenjin | special | 29 | -31 | [焔版]強飛翔龍炎陣 | flame, 炎, 焔 |
| mai | flame_heavy_hissatsu_shinobi_bachi | special | 21 | -13 | [焔版]強必殺忍蜂 | flame, 焔 |
| mai | flame_heavy_ryuuenbu | special | 12 | -6 | [焔版]強龍炎舞 | flame, 炎, 焔 |
| mai | flame_light_hishou_ryuuenjin | special | 30 | -29 | [焔版]弱飛翔龍炎陣 | flame, 炎, 焔 |
| mai | flame_light_hissatsu_shinobi_bachi | special | 16 | -10 | [焔版]弱必殺忍蜂 | flame, 焔 |
| mai | flame_light_ryuuenbu | special | 15 | -2 | [焔版]弱龍炎舞 | flame, 炎, 焔 |
| mai | flame_medium_hishou_ryuuenjin | special | 28 | -28 | [焔版]中飛翔龍炎陣 | flame, 炎, 焔 |
| mai | flame_medium_hissatsu_shinobi_bachi | special | 20 | -12 | [焔版]中必殺忍蜂 | flame, 焔 |
| mai | flame_medium_ryuuenbu | special | 16 | -6 | [焔版]中龍炎舞 | flame, 炎, 焔 |
| mai | flame_musasabi_no_mai | special | 25 | -3 | [焔版]ムササビの舞 | flame, 焔 |
| mai | flame_od_hishou_ryuuenjin | special | 34 | -40 | [焔版]OD飛翔龍炎陣 | flame, 炎, 焔 |
| mai | flame_od_hissatsu_shinobi_bachi | special | 32 | -12 | [焔版]OD必殺忍蜂 | flame, 焔 |
| mai | flame_od_musasabi_no_mai | special | 25 | -3 | [焔版]ODムササビの舞 | flame, 焔 |
| mai | flame_od_ryuuenbu | special | 16 | -12 | [焔版]OD龍炎舞 | flame, 炎, 焔 |
| mai | flame_sa2_air_chou_hissatsu_shinobi_bachi | super_art | 62 | -48 | [焔版]SA2 空中超必殺忍蜂 | flame, 焔 |
| mai | flame_sa2_chou_hissatsu_shinobi_bachi | super_art | 31 | -24 | [焔版]SA2 超必殺忍蜂 | flame, 焔 |
| mai | hishou_ryuuenjin_heavy | special | 29 | -31 | 強飛翔龍炎陣 | 炎 |
| mai | hishou_ryuuenjin_light | special | 30 | -29 | 弱飛翔龍炎陣 | 炎 |
| mai | hishou_ryuuenjin_medium | special | 29 | -28 | 中飛翔龍炎陣 | 炎 |
| mai | hishou_ryuuenjin_od | special | 35 | -40 | OD飛翔龍炎陣 | 炎 |
| mai | ryuuenbu_heavy | special | 12 | -6 | 強龍炎舞 | 炎 |
| mai | ryuuenbu_light | special | 15 | -4 | 弱龍炎舞 | 炎 |
| mai | ryuuenbu_medium | special | 16 | -6 | 中龍炎舞 | 炎 |
| mai | ryuuenbu_od | special | 16 | -12 | OD龍炎舞 | 炎 |
| mai | sa3_shiranui_ryuu_enbu_ada_zakura | super_art | 46 | -33 | SA3 不知火流・炎舞仇桜 | 炎 |
| ryu | denjin_charge | special | 0 | NULL | 電刃錬気 | 気 |
| terry | sa2_triple_geyser | super_art | 125 | NULL | SA2 トリプルゲイザー | geyser |
| terry | sa2_twin_geyser | super_art | 43 | NULL | SA2 ツインゲイザー | geyser |

（38 件。うち mai の `flame_*`/`ryuuenbu`/`hishou_ryuuenjin`/`shiranui_ryuu_enbu` 系 26 件は「炎」「焔」を含む同一ファミリーの塊。この 26 件は「花蝶扇(kachousen)」ファミリーとは別技であり、コア語 `kachousen` には一致しない。）

---

## 3. 逆方向候補（`is_projectile=true` かつ名称が飛び道具らしくない）

### 3.1 検出方法

- **機械的キーワードスキャン**: true 全 102 件の `move_code`/`name_ja` に対し、打撃・移動・設置を示唆する語（英: `kick`/`punch`/`elbow`/`knee`/`slash`/`claw`/`uppercut`/`slam`/`grab`/`chop`/`strike`/`dash`/`rush`/`dive`/`roll`/`step`/`slide`/`sprint`/`install`/`stance`/`trap`/`plant`、日: `斬`/`舞`/`蹴`/`掌`/`脚`/`掴`/`摑`/`突`/`打`/`踏`/`跳`/`走`）を部分一致で走査。
- **目視全件確認**: 上記スキャンでヒットしなかった残り 98 件についても true 全 102 件を一覧で目視確認し、飛び道具を示唆する語（コア語・拡張語いずれも）を一切含まない行を追加候補として拾い上げた。

### 3.2 該当技（全 7 件）

| character | code | category | recovery | on_block | name_ja | 検出方法 / 根拠 |
|---|---|---|---:|---:|---|---|
| juri | sa1_sakkai_fuhazan | super_art | 58 | -32 | SA1 殺界風破斬 | キーワードスキャン（`斬`＝斬撃を示唆） |
| juri | fuha_sa1_sakkai_fuhazan | super_art | 57 | -32 | [風破]SA1 殺界風破斬 | キーワードスキャン（`斬`＝斬撃を示唆） |
| mai | sa1_kagerou_no_mai | super_art | 51 | -31 | SA1 陽炎の舞 | キーワードスキャン（`舞`＝舞踊・移動を示唆） |
| mai | flame_sa1_kagerou_no_mai | super_art | 46 | -26 | [焔版]SA1 陽炎の舞 | キーワードスキャン（`舞`＝舞踊・移動を示唆） |
| ingrid | sa2_order_of_the_sun_lv1 | super_art | 1 | NULL | SA2 サンオーダー(Lv1) | 目視全件確認（「オーダー(Order)」＝隊形・バフ系を示唆し、飛び道具コア語/拡張語のいずれにも該当しない） |
| ingrid | sa2_order_of_the_sun_lv2 | super_art | 1 | NULL | SA2 サンオーダー(Lv2) | 目視全件確認（同上） |
| ingrid | sa2_order_of_the_sun_lv3 | super_art | 1 | NULL | SA2 サンオーダー(Lv3) | 目視全件確認（同上） |

（過検出を許容する指示書 §2.3 の方針どおり、開発者判断用の候補として列挙。`saihasho`/`shuriken_bomb` 以外の true 95 件のうち、上記 7 件を除く 88 件はコア語または拡張語のいずれかを含み、飛び道具を示唆する名称であることを確認済み。）

---

## 4. saihasho / shuriken_bomb 全 variant の現状 is_projectile 値

### juri: `saihasho` ファミリー（`move_code` に `saiha` を含む全行、`name_ja` の `歳破` を含む全行のいずれで検索しても同一の 3 件。取りこぼしなし）

| move_code | category | is_projectile | recovery | on_block | name_ja |
|---|---|---|---:|---:|---|
| saihasho | special | **true** | 20 | -8 | 歳破衝 |
| saihasho_od | special | **true** | 0 | -2 | OD歳破衝 |
| fuha_saihasho | special | **false** | 0 | -3 | [風破]歳破衝 |

→ 3 variant 中 **2 件が true・1 件（`fuha_saihasho`）が false**。

### kimberly: `shuriken_bomb` ファミリー（`move_code` に `shuriken` を含む全行、`name_ja` の `手裏剣` を含む全行のいずれで検索しても同一の 6 件。取りこぼしなし）

| move_code | category | is_projectile | recovery | on_block | name_ja |
|---|---|---|---:|---:|---|
| shuriken_bomb_light | special | **false** | 0 | NULL | 弱細工手裏剣 |
| shuriken_bomb_medium | special | **false** | 0 | NULL | 中細工手裏剣 |
| shuriken_bomb_heavy | special | **false** | 0 | NULL | 強細工手裏剣 |
| shuriken_bomb_spread_light | special | **false** | 0 | NULL | 弱乱れ細工手裏剣 |
| shuriken_bomb_spread_medium | special | **false** | 0 | NULL | 中乱れ細工手裏剣 |
| shuriken_bomb_spread_heavy | special | **false** | 0 | NULL | 強乱れ細工手裏剣 |

→ 6 variant 全件が **false**（`shuriken_bomb_od`／spread 以外の第 3 系統等、上記 6 件を超える variant は CSV 上に存在しない）。

---

## 5. ヒューリスティックの限界（明記）

- **名称に現れない飛び道具は取りこぼす**: 本監査は `move_code`／`name_ja` の文字列一致のみに依拠する。技の実際の見た目・挙動が飛び道具であっても、名称がそれを示唆しない場合（意訳・造語・シリーズ独自名称等）は本監査の対象外であり、false のまま検出されない。
- **コア語の過検出（precision の限界）**: 「拳」は `hadoken`(波動拳) のような飛び道具ファミリーだけでなく、`shoryuken`(昇龍拳、対空打撃技)・`bushin_hellchain`/`bushin_prism_strikes`(武神獄鎖拳/武神天架拳、target_combo の打撃連携)にも現れる。§2.1 の 45 件中、`拳` 一致の 16 件（ken/ryu の shoryuken 系 11 件＋kimberly bushin 系 5 件）はこの汎用漢字による過検出の可能性がある。同様に `fuha`（風破）は juri の強化状態(パワーアップ状態)を示す接頭辞であり、`fuha_ankensatsu`/`fuha_go_ohsatsu`/`fuhajin_*` は必ずしも飛び道具化を意味しない可能性がある（`fuha_saihasho` のみ開発者確定で true が正）。
- **拡張語の過検出（precision の限界、§2.2）**: `炎`/`焔`/`flame` は mai の `ryuuenbu`(龍炎舞)/`hishou_ryuuenjin`(飛翔龍炎陣) 系のように、"炎を纏った打撃・体当たり技"にも現れうる（実際の判定が飛び道具か否かは本監査の対象外）。`気` は `denjin_charge`(電刃錬気、溜め状態への移行技)のように汎用的な「気/エネルギー」語としても現れる。
- **拡張語自体の非網羅性**: §2.2 の拡張語リストは本監査で機械的に追加した補足観点であり、指示書 §2.2 のコア語同様「網羅ではなく手掛かり」に留まる。拡張語にも現れない技名（例: 意訳的なシリーズ固有名称）はなお取りこぼされうる。
- **逆方向候補（§3）の検出手法の限界**: 機械的キーワードスキャンは「打撃/移動/設置」を示唆する限定的な語のみを対象とするため網羅的ではない。目視確認で追加した ingrid `sa2_order_of_the_sun_*` のように、いずれの語にも該当しないが名称から飛び道具性が読み取れない技は、スキャン漏れのリスクが残る（今回は全 102 件を目視確認することで補ったが、件数が増えた場合はこの手法のスケーラビリティに限界がある）。
- **`official_ja` 列の不在**: 指示書 §2.2 が言及する `official_ja`(あれば) 列は現行 CSV スキーマ(20 列、§0 実測範囲参照)に存在しない。本監査では代替として `name_ja` 列を使用した。
- **recovery 値は問わない方針の帰結**: 本監査は addendum #1（recovery=0 限定）と異なり recovery 値を問わないため、§2 の候補には recovery が 0 以外の技（例: `shoryuken` 系は recovery 33〜52、`hashogeki` 系は recovery 17〜39）も含まれる。recovery が大きい技ほど近接打撃技である可能性が高まる傾向はあるが、本監査ではこの傾向を判断材料として用いていない（事実列挙のみ）。

---

*以上、read-only 全数監査。コード・マイグレーション・CSV・設計書への変更ゼロ（作成は本レポートファイルのみ）。judgement-free（is_projectile 是正の要否・各技の妥当性判断は含めない。開発者判断用の名称ヒューリスティック候補の事実提示のみ）。連番・CHANGE 非消費。*
