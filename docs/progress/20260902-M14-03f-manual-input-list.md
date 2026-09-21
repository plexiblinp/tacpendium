# M14-03f 第四波 seed — 開発者への記入依頼（第二段の投入材料）

| 項目 | 内容 |
|------|------|
| 文書ID | 20260902-M14-03f-manual-input-list |
| 作成日 | 2026-09-02 |
| 作成者 | 製造担当 Claude Code（`/implement_plan_full` M14-03f） |
| 位置づけ | **第四波 seed の「第二段」で投入する値の記入用紙。** 第一段（マイグレ `000082`〜`000091`）は本ファイルの回答を待たずに投入済み |
| 先例 | `docs/progress/20260802-M19-04-manual-input-list-developer-decision.md`（M19-04 の同型） |

---

## 0. この用紙の使い方

- **記入欄は「記入」列だけ**です。他の列は製造が実測して埋めた材料です。
- **★分からないものは空欄のままにしてください。** 推測で埋めた値は、後から「実測値」と見分けが付かなくなります。
- **★1 群だけ埋まっても投入できます。** 群ごとに独立したマイグレになるので、揃った群から順に渡してください。
- 優先度の希望（製造側）: **群1（移動 `total`）→ 群3（`custom_states`）→ 群4（`move_derivations`）→ 群2（`chain_cancel_total`）**。
  群1 が最も穴が大きく（70 行 NULL）、測り方が全キャラ一律で軽いためです。群2 はロースター判定を含むため最も重く、最後で構いません。

---

## 群1: 移動 5 code の `total` — **★受領済み（2026-09-02）・`000092` で投入済み**

> **受領値**: `aki` 19/23/45 ／ `akuma` 19/23/45 ／ `alex` 22/23/43 ／ `blanka` 19/23/43 ／ `cammy` 18/23/43 ／ `chun_li` 19/25/47 ／ `dee_jay` 19/23/43 ／ `e_honda` 19/23/43 ／ `ed` 19/23/43 ／ `elena` 20/23/43 ／ `sagat` 23/23/43 ／ `yasmine` 19/23/43 ／ `c_viper` 21/23/43 ／ `dhalsim` 25/23/73（`dash_forward` / `dash_back` / `jump_*`）。
>
> **★CSV の `notes_tool` が 3 件を裏づけた**（`aki` 45 ／ `chun_li` 47 ／ `dhalsim` 73）。詳細は完了報告 §17。
>
> **以下は記入依頼時の本文（経緯として残す）。**

### 記入依頼（受領済み）

**何を測るか**: 各キャラの **前方ステップ / 後方ステップ / 垂直ジャンプ / 前ジャンプ / 後ろジャンプ の全体フレーム**。

> **★表示語について**: 地上ダッシュのインゲーム表記は「**ステップ**」であり、`preset_aliases` も 2026-08-30 の裁定（`D-615` / `000080`）で「前方ステップ / 後方ステップ」へ是正済みです。`move_code` は `dash_forward` / `dash_back` のままです。

- **`startup` / `active` / `recovery` は不要**です。`total` だけ埋めてください。
- **`forward` / `back` / `micro_forward` / `micro_back` の 4 code は対象外**です（`total` は NULL のままが正。`000059` 本文）。
- **ジャンプ 3 種は既存 17 キャラでは全て同値**でした（例: `m_bison` は 3 種とも 43）。**同値なら 1 つ書いて「3 種同じ」で構いません。違うキャラだけ書き分けてください。**
- 出所の記録: 受領日と「開発者提供・実測値」をマイグレのヘッダへ書きます（`000059` と同じ形）。

| キャラ | code | `dash_forward` | `dash_back` | `jump_neutral` | `jump_forward` | `jump_back` |
|---|---|---|---|---|---|---|
| AKI | `aki` |  |  |  |  |  |
| 豪鬼 | `akuma` |  |  |  |  |  |
| アレックス | `alex` |  |  |  |  |  |
| ブランカ | `blanka` |  |  |  |  |  |
| キャミィ | `cammy` |  |  |  |  |  |
| 春麗 | `chun_li` |  |  |  |  |  |
| ディージェイ | `dee_jay` |  |  |  |  |  |
| E.本田 | `e_honda` |  |  |  |  |  |
| エド | `ed` |  |  |  |  |  |
| エレナ | `elena` |  |  |  |  |  |
| サガット | `sagat` |  |  |  |  |  |
| ヤスミン | `yasmine` |  |  |  |  |  |
| C.ヴァイパー | `c_viper` |  |  |  |  |  |
| ダルシム | `dhalsim` |  |  |  |  |  |

**現況**: 14 キャラ × 5 code = **70 行が `total` NULL** です（既 seed 17 キャラは 85 行すべて充足済み）。

---

## 群2: `chain_cancel_total` — **★受領済み（2026-09-04）・`000097`〜`000099` で投入済み**

**一次源は `character_data/chain-cancel-measurements.md`** です（CSV ではありません）。同ファイルの「確定値」表と同じ形で記入してください。

### ★ロースター（どの技が連打キャンセル可能か）自体が実測項目です

既存 18 キャラのロースターは**非対称**でした。「3 技あるはず」で埋めないでください。

| 型 | 例 |
|---|---|
| 3 技（Stand LP / Crouch LP / Crouch LK） | リュウ・ケン・ガイル・テリー・ベガ・ラシード・JP ほか |
| **Stand LP ではなく Stand LK** | **ジェイミー** |
| **4 技**（Stand LK も入る） | **リリー** |
| **2 技のみ**（立ち技は圏外） | **ルーク・マリーザ・エレナ** |
| **通常版と連打版の 2 系統** | **ザンギエフ** |

### ★単発値からは導出できません（確証済み）

同じ単発値 `5/3/8/15` が **11 / 11 / 12 / 13** に割れます（舞・ラシード・エレナ・ジュリ）。同一キャラ内でも割れます（舞 `4/3/7/13` が 10 と 9）。**「total − 4」等の規則で埋めないでください。**

| キャラ | 技（Stand LP / Stand LK / Crouch LP / Crouch LK） | 単発 su/act/rec/total | `chain_cancel_total` | 圏外なら「圏外」 |
|---|---|---|---|---|
| AKI |  |  |  |  |
| 豪鬼 |  |  |  |  |
| アレックス |  |  |  |  |
| ブランカ |  |  |  |  |
| キャミィ |  |  |  |  |
| 春麗 |  |  |  |  |
| ディージェイ |  |  |  |  |
| E.本田 |  |  |  |  |
| エド |  |  |  |  |
| サガット |  |  |  |  |
| ヤスミン |  |  |  |  |
| C.ヴァイパー |  |  |  |  |
| ダルシム |  |  |  |  |

**投入済み**: `elena` の Crouch LP = 10 / Crouch LK = 12（`000088`）。資料の確定値 55 件・18 キャラのうち未 seed だった 2 件で、**これで資料の未 seed 分は全て消化されました**。

---

### 受領結果（2026-09-04・成果表 v2.6.1 として受領）

**成果表が 55 件/18 キャラ → 93 件/31 キャラへ更新され、保留・未実測とも 0 になりました。** 第四波 13 キャラの 38 行を `000099` で投入済みです。

| キャラ | Stand LP | Stand LK | Crouch LP | Crouch LK | その他 |
|---|---:|---:|---:|---:|---|
| A.K.I. | 9 | — | 9 | 11 | |
| 豪鬼 | 9 | — | 10 | 11 | |
| アレックス | 11 | — | 11 | 13 | |
| ブランカ | **圏外** | **9** | 11 | 11 | |
| C.ヴァイパー | 9 | — | 10 | 11 | |
| キャミィ | 9 | — | 9 | 10 | |
| 春麗 | 9 | — | 10 | 11 | |
| ディージェイ | 9 | — | 11 | 11 | |
| E.本田 | **圏外** | — | 10 | 9 | **2 技のみ** |
| エド | 9 | — | 10 | **圏外** | **2 技のみ** |
| サガット | 13 | — | 11 | 14 | |
| ヤスミン | 10 | — | 10 | 13 | |
| ダルシム | 12 | — | 11 | **圏外** | **`agile_kick`（1LK・特殊技）11** ／ **屈弱P 連打版 10** |

**★ロースターはやはり非対称でした。** 「3 技あるはず」で埋めなくて正解でした。

**★ダルシムで 2 つの新事実**（別紙 `character_data/dhalsim-joint-remeasurement-2026-09-04.md`）:

1. **特殊技がグループ員になり得る** — `agile_kick`（1LK・`category='unique'`）。資格は技単位の列で `category` に非依存なので、値を入れるだけで対応でき設計変更なし。
2. **クロス限定の連打版がある** — 屈弱P に連打版（`4/3/9/15`・p=10）があるが、**直前技が Stand LP または 1LK のときだけ**出る（直前が屈弱P なら素が出る＝ボタンでなく技の同一性で決まる）。
   ザンギエフ（2 打目以降なら常に連打版）とは条件が違うため、`move_derivations` の親は **2 技だけ**にしてあります（直積にしていません）。

### 受領時に照合した内容（★上書き前に全数）

- **既存 55 行が黙って書き換わっていないか → 55/55 一致**
- **新規 38 行の単発値が CSV と一致するか → 89/93 一致・不一致 0**（残り 4 は CSV に行を持たない連打版）
- **ダルシム連打版の総和検算 `4+3-1+9=15` → 合格**


---

## 群3: `custom_states` — **★受領済み（2026-09-02）・`000093`〜`000095` で投入済み**

> **9 状態を投入した**（第四波 4 キャラ 6 状態 ＋ 既 seed キャラの投入漏れ 3 状態）。**不要 9 キャラ ＋ 既存 `c_viper`** で 14 キャラすべての要否が確定。詳細は完了報告 §17。
>
> **★★下記の `show_delta` の説明は誤りだった（2026-09-02 是正）。** 「int 系なら自動で `true`」ではなく、正しくは **`web/src/features/combo/customStates.ts` の規約＝「方向可変（増える/減る両方あり）= true。一方向のみ（単調増加/減少）は false / 省略」**。⇒ `jamie/drink_level` は「減少はしない」ため `show_delta` を付けていない。`blanka/blanka_chan_bomb` は消費型なので `true`。
>
> **以下は記入依頼時の本文（経緯として残す）。**

### 記入依頼（受領済み）

**`yasmine` のバヤニモードは「定義対象」と確定済み**です（`character_data/seed-progress.md` L138・開発者判断 2026-08-25。`lily` / `juri` / `mai` / `kimberly` と同じ状態機構として扱う）。**種別・値域・増減の定義が未作成**のため投入できていません。

**他 11 キャラの要否はリポジトリ内に判定材料がありません**（CSV に列なし・migrations に記載なし・`docs/seed-data/` に記載なし）。**要否からご判断ください。**

### 記入項目（既存 JSON と同形）

| 項目 | 値 | 備考 |
|---|---|---|
| `code` | 例 `windclad` | 英小文字・アンダースコア |
| `name_ja` / `name_en` | 例 `風纏い` / `Windclad` | |
| `subject` | `self` | 既存 9 定義すべて `self` |
| `scope` | `persistent` または `conditional` | `conditional` なら `activation.trigger`（既存例 `sa2_active`）も |
| `type` | `stock` / `level` / `flag` | |
| `value_definition` | `{"kind":"integer","min":0,"max":3}` または `{"kind":"boolean"}` | |
| `show_delta` | **int 系（stock / level）のみ `true`**。flag には付けない | |

### 記入表

| キャラ | 要否（要/不要/不明） | `code` | `name_ja` | `name_en` | `type` | 値域 | 増減の条件 |
|---|---|---|---|---|---|---|---|
| AKI |  |  |  |  |  |  |  |
| 豪鬼 |  |  |  |  |  |  |  |
| アレックス |  |  |  |  |  |  |  |
| ブランカ |  |  |  |  |  |  |  |
| キャミィ |  |  |  |  |  |  |  |
| 春麗 |  |  |  |  |  |  |  |
| ディージェイ |  |  |  |  |  |  |  |
| E.本田 |  |  |  |  |  |  |  |
| エド |  |  |  |  |  |  |  |
| エレナ |  |  |  |  |  |  |  |
| サガット |  |  |  |  |  |  |  |
| ヤスミン **★定義対象と確定済み** |  |  |  |  |  |  |  |
| C.ヴァイパー | **既に在る**（`limit_decoupler`・flag/boolean） | — | — | — | — | — | — |
| ダルシム |  |  |  |  |  |  |  |

**参考（既存 9 定義）**: `ryu/denjin_charge`(flag) / `c_viper/limit_decoupler`(flag) / `guile/solid_puncher`(flag・SA2 発動中) / `juri/feng_shui_engine`(flag・SA2 発動中) / `ingrid/sun_crest`(level 0-4) / `juri/fuha_stock`(stock 0-3) / `kimberly/shuriken_bomb_stock`(stock 0-2) / `lily/windclad`(stock 0-3) / `mai/flame_stock`(stock 0-5)。

---
## 群4: `move_derivations`（親子関係） — **★受領済み（2026-09-04）・`000101` で投入済み**

> **受領結果**: 候補表 277 件のうち **投入 169 件（ペア 313 行）／ 行を作らない 108 件（39%）**。
> **★機械提案をそのまま入れなくてよかったことが数字で確認できた**——ターゲットコンボ・強化版の別技・ホールド版の独立技が候補に紛れており、`notes_tool` と `move_code` 接頭辞だけでは弁別できていなかった。
> **★`jump_*`（移動 system move）を親にする行が初めて入った**（21 子 / 52 行＝豪鬼・ブランカ・C.ヴァイパー・ダルシム）。**既存 17 キャラ分は下記 群5 で目視確認中。**
> **★製造が自己参照 3 件を外した**（`elena/lynx_whirl_{light,medium,heavy}` の親リストに各子自身が入っていた）。裁定「`lynx_whirl_od` は自己参照なので行を作らない」と同じ原理で 1 組だけ外し、残る 8 親は投入した。
> 詳細は完了報告 §19。

**★以下は受領前の候補表（原型）です。** ◯×を付けて返してもらう形で出しました。

### なぜ機械で確定できないか

| 事実 | 実測 |
|---|---|
| 対象（非 rush の派生技） | **277 件**（rush_variant 242 件は `original_move_id` で解決済み＝対象外） |
| `notes_tool` に親らしき記述がある | **106 件** |
| **手がかりが無い** | **113 件** |
| **抽出結果が自分自身になった**（`notes_tool` の技名が誤っている可能性） | **4 件** |

**親は「Sinister Slideから派生」のように日本語の技名で書かれており、`move_code` への写像は機械では確定できません。** 誤っても SQL はエラーにならず、別の技に親が付くだけです（`SUPP-001` §5.5 (4)）。

**★もう 1 つ、機械では決められないことがあります**——`move_derivations` は**許可される親をすべて**登録する表です（`moves-input-background.md` §3.3）。「Xから派生」という記述は「X が親の 1 つである」ことは示しますが、**「X だけが親である」かどうかは示しません。** 既存 88 行は開発者の「〜からのみ派生」という断定から作られています（`000064` の D ブロック）。

### 記入方法

- **`判定` 列に ◯（この親で正しい）/ ×（違う）/ 追加（他にも親がある：親の `move_code` を書く）を書いてください。**
- **`親候補` が空欄の行は、親の `move_code` を書いてください。** 分からなければ空欄のままで構いません。
- **`確信度` は製造の見立てです。** 「高」でも誤っていることがあります（自己参照 4 件がその例）。

### 確信度: 高(notes 完全一致)（31 件）

| キャラ | 子 `move_code` | 技名 | 親候補 `move_code` | 根拠 | 判定 |
|---|---|---|---|---|---|
| AKI | `nightshade_chaser_od` | OD紫煙追 | `nightshade_pulse_od` | notes_tool「OD紫煙砲から…」= name_ja 完全一致 |  |
| 豪鬼 | `demon_low_slash_od` | OD百鬼豪斬 | `demon_raid_od` | notes_tool「OD百鬼襲から…」= name_ja 完全一致 |  |
| 豪鬼 | `demon_guillotine_od` | OD百鬼豪衝 | `demon_raid_od` | notes_tool「OD百鬼襲から…」= name_ja 完全一致 |  |
| 豪鬼 | `demon_blade_kick_od` | OD百鬼豪刃 | `demon_raid_od` | notes_tool「OD百鬼襲から…」= name_ja 完全一致 |  |
| アレックス | `hyper_bomb` | ハイバーボム | `power_drop_od` | notes_tool「ODパワードロップから…」= name_ja 完全一致 |  |
| アレックス | `sa2_omega_wing_buster` | SA2 オメガウィングバスター | `power_drop_od` | notes_tool「ODパワードロップから…」= name_ja 完全一致 |  |
| 春麗 | `orchid_palm` | 蘭華 | `serenity_stream` | notes_tool「行雲流水から…」= name_ja 完全一致 |  |
| 春麗 | `snake_strike` | 這蛇突 | `serenity_stream` | notes_tool「行雲流水から…」= name_ja 完全一致 |  |
| 春麗 | `lotus_fist` | 蓮掌 | `serenity_stream` | notes_tool「行雲流水から…」= name_ja 完全一致 |  |
| 春麗 | `forward_strike` | 前突 | `serenity_stream` | notes_tool「行雲流水から…」= name_ja 完全一致 |  |
| 春麗 | `senpu_kick` | 仙風 | `serenity_stream` | notes_tool「行雲流水から…」= name_ja 完全一致 |  |
| 春麗 | `tenku_kick` | 天空脚 | `serenity_stream` | notes_tool「行雲流水から…」= name_ja 完全一致 |  |
| E.本田 | `teppo_triple_slap_1hit_od` | OD鉄砲(単発) | `sumo_dash_od` | notes_tool「OD相撲ステップから…」= name_ja 完全一致 |  |
| E.本田 | `teppo_triple_slap_1hit` | 鉄砲(単発) | `sumo_dash` | notes_tool「相撲ステップから…」= name_ja 完全一致 |  |
| E.本田 | `teppo_triple_slap_od` | OD鉄砲 | `sumo_dash_od` | notes_tool「OD相撲ステップから…」= name_ja 完全一致 |  |
| E.本田 | `teppo_triple_slap` | 鉄砲 | `sumo_dash` | notes_tool「相撲ステップから…」= name_ja 完全一致 |  |
| E.本田 | `taiho_cannon_lift_od` | OD大砲 | `sumo_dash_od` | notes_tool「OD相撲ステップから…」= name_ja 完全一致 |  |
| E.本田 | `taiho_cannon_lift` | 大砲 | `sumo_dash` | notes_tool「相撲ステップから…」= name_ja 完全一致 |  |
| エレナ | `leopard_snap_od` | ODレオパードスナップ | `lynx_whirl_od` | notes_tool「ODリンクスワールから…」= name_ja 完全一致 |  |
| エレナ | `harvest_circle_od` | ODハーベストサークル | `lynx_whirl_od` | notes_tool「ODリンクスワールから…」= name_ja 完全一致 |  |
| エレナ | `mallet_smash_od` | ODマレットスマッシュ | `lynx_whirl_od` | notes_tool「ODリンクスワールから…」= name_ja 完全一致 |  |
| エレナ | `lynx_whirl_od_spinning_scythe_light` | 弱リンクスワール(ODスピンサイズ派生) | `spinning_scythe_od` | notes_tool「ODスピンサイズから…」= name_ja 完全一致 |  |
| エレナ | `lynx_whirl_od_spinning_scythe_medium` | 中リンクスワール(ODスピンサイズ派生) | `spinning_scythe_od` | notes_tool「ODスピンサイズから…」= name_ja 完全一致 |  |
| エレナ | `lynx_whirl_od_spinning_scythe_heavy` | 強リンクスワール(ODスピンサイズ派生) | `spinning_scythe_od` | notes_tool「ODスピンサイズから…」= name_ja 完全一致 |  |
| サガット | `mighty_tiger_od` | ODタイガーマイト | `tiger_nexus_od` | notes_tool「ODタイガーネクサスから…」= name_ja 完全一致 |  |
| サガット | `greedy_tiger_od` | ODタイガーグリード | `tiger_nexus_od` | notes_tool「ODタイガーネクサスから…」= name_ja 完全一致 |  |
| サガット | `nova_tiger_od` | ODタイガーノヴァ | `tiger_nexus_od` | notes_tool「ODタイガーネクサスから…」= name_ja 完全一致 |  |
| C.ヴァイパー | `high_jump_light_aerial_burning_kick` | 【ハイジャンプ】弱空中バーニングキック | `high_jump` | notes_tool「ハイジャンプから…」= name_ja 完全一致 |  |
| C.ヴァイパー | `high_jump_medium_aerial_burning_kick` | 【ハイジャンプ】中空中バーニングキック | `high_jump` | notes_tool「ハイジャンプから…」= name_ja 完全一致 |  |
| C.ヴァイパー | `high_jump_heavy_aerial_burning_kick` | 【ハイジャンプ】強空中バーニングキック | `high_jump` | notes_tool「ハイジャンプから…」= name_ja 完全一致 |  |
| C.ヴァイパー | `high_jump_od_aerial_burning_kick` | 【ハイジャンプ】OD空中バーニングキック | `high_jump` | notes_tool「ハイジャンプから…」= name_ja 完全一致 |  |

### 確信度: 要確認(自己参照)（4 件）

| キャラ | 子 `move_code` | 技名 | 親候補 `move_code` | 根拠 | 判定 |
|---|---|---|---|---|---|
| AKI | `nightshade_chaser` | 紫煙追 |  | notes_tool「紫煙追から…」= name_ja 完全一致 ★抽出結果が自分自身になった。notes_tool の技名が誤っている可能 |  |
| アレックス | `low_rush` | ステップイン |  | notes_tool「ステップインから…」= name_ja 完全一致 ★抽出結果が自分自身になった。notes_tool の技名が誤ってい |  |
| アレックス | `low_retreat` | ステップアウト |  | notes_tool「ステップアウトから…」= name_ja 完全一致 ★抽出結果が自分自身になった。notes_tool の技名が誤って |  |
| エレナ | `lynx_whirl_od` | ODリンクスワール |  | notes_tool「ODリンクスワールから…」= name_ja 完全一致 ★抽出結果が自分自身になった。notes_tool の技名が誤 |  |

### 確信度: 低(notes 複数一致)（23 件）

| キャラ | 子 `move_code` | 技名 | 親候補 `move_code` | 根拠 | 判定 |
|---|---|---|---|---|---|
| 豪鬼 | `demon_low_slash` | 百鬼豪斬 | `demon_raid_light/demon_raid_medium/demon_raid_heavy/demon_raid_od` | notes_tool「弱中強百鬼襲」が 4 件に一致 |  |
| 豪鬼 | `demon_guillotine` | 百鬼豪衝 | `demon_raid_light/demon_raid_medium/demon_raid_heavy/demon_raid_od` | notes_tool「弱中強百鬼襲」が 4 件に一致 |  |
| 豪鬼 | `demon_blade_kick` | 百鬼豪刃 | `demon_raid_light/demon_raid_medium/demon_raid_heavy/demon_raid_od` | notes_tool「弱中強百鬼襲」が 4 件に一致 |  |
| エレナ | `leopard_snap` | レオパードスナップ | `lynx_song_light/lynx_song_medium/lynx_song_heavy/lynx_song_od` | notes_tool「リンクシング」が 4 件に一致 |  |
| エレナ | `harvest_circle` | ハーベストサークル | `lynx_song_light/lynx_song_medium/lynx_song_heavy/lynx_song_od` | notes_tool「リンクシング」が 4 件に一致 |  |
| エレナ | `mallet_smash` | マレットスマッシュ | `lynx_song_light/lynx_song_medium/lynx_song_heavy/lynx_song_od` | notes_tool「リンクシング」が 4 件に一致 |  |
| エレナ | `lynx_whirl_spinning_scythe_light` | 弱リンクスワール(スピンサイズ派生) | `spinning_scythe_light/spinning_scythe_medium/spinning_scythe_heavy/spinning_scythe_od` | notes_tool「弱中強スピンサイズ」が 4 件に一致 |  |
| エレナ | `lynx_whirl_spinning_scythe_medium` | 中リンクスワール(スピンサイズ派生) | `spinning_scythe_light/spinning_scythe_medium/spinning_scythe_heavy/spinning_scythe_od` | notes_tool「弱中強スピンサイズ」が 4 件に一致 |  |
| エレナ | `lynx_whirl_spinning_scythe_heavy` | 強リンクスワール(スピンサイズ派生) | `spinning_scythe_light/spinning_scythe_medium/spinning_scythe_heavy/spinning_scythe_od` | notes_tool「弱中強スピンサイズ」が 4 件に一致 |  |
| サガット | `mighty_tiger` | タイガーマイト | `tiger_nexus_light/tiger_nexus_medium/tiger_nexus_heavy/tiger_nexus_od` | notes_tool「弱中強タイガーネクサス」が 4 件に一致 |  |
| サガット | `greedy_tiger` | タイガーグリード | `tiger_nexus_light/tiger_nexus_medium/tiger_nexus_heavy/tiger_nexus_od` | notes_tool「弱中強タイガーネクサス」が 4 件に一致 |  |
| サガット | `nova_tiger` | タイガーノヴァ | `tiger_nexus_light/tiger_nexus_medium/tiger_nexus_heavy/tiger_nexus_od` | notes_tool「弱中強タイガーネクサス」が 4 件に一致 |  |
| ヤスミン | `ulan_light` | 弱ウラン | `mukha_ng_langit_light/mukha_ng_langit_medium/mukha_ng_langit_heavy/mukha_ng_langit_od` | notes_tool「弱中強ムカ・ン・ランギット」が 4 件に一致 |  |
| ヤスミン | `ulan_medium` | 中ウラン | `mukha_ng_langit_light/mukha_ng_langit_medium/mukha_ng_langit_heavy/mukha_ng_langit_od` | notes_tool「弱中強ムカ・ン・ランギット」が 4 件に一致 |  |
| ヤスミン | `ulan_heavy` | 強ウラン | `mukha_ng_langit_light/mukha_ng_langit_medium/mukha_ng_langit_heavy/mukha_ng_langit_od` | notes_tool「弱中強ムカ・ン・ランギット」が 4 件に一致 |  |
| ヤスミン | `ulan_od` | ODウラン | `mukha_ng_langit_light/mukha_ng_langit_medium/mukha_ng_langit_heavy/mukha_ng_langit_od` | notes_tool「弱中強ODムカ・ン・ランギット」が 4 件に一致 |  |
| ヤスミン | `kulog_light` | 弱クロッグ | `mukha_ng_langit_light/mukha_ng_langit_medium/mukha_ng_langit_heavy/mukha_ng_langit_od` | notes_tool「弱中強ムカ・ン・ランギット」が 4 件に一致 |  |
| ヤスミン | `kulog_medium` | 中クロッグ | `mukha_ng_langit_light/mukha_ng_langit_medium/mukha_ng_langit_heavy/mukha_ng_langit_od` | notes_tool「弱中強ムカ・ン・ランギット」が 4 件に一致 |  |
| ヤスミン | `kulog_heavy` | 強クロッグ | `mukha_ng_langit_light/mukha_ng_langit_medium/mukha_ng_langit_heavy/mukha_ng_langit_od` | notes_tool「弱中強ムカ・ン・ランギット」が 4 件に一致 |  |
| ヤスミン | `kulog_od` | ODクロッグ | `mukha_ng_langit_light/mukha_ng_langit_medium/mukha_ng_langit_heavy/mukha_ng_langit_od` | notes_tool「弱中強ODムカ・ン・ランギット」が 4 件に一致 |  |
| C.ヴァイパー | `knuckled_pursuit` | チェイスナックル | `burning_kick_light/burning_kick_medium/burning_kick_heavy/burning_kick_od` | notes_tool「弱中強バーニングキック」が 4 件に一致 |  |
| C.ヴァイパー | `double_burn` | ダブルバーン | `burning_kick_light/burning_kick_medium/burning_kick_heavy/burning_kick_od` | notes_tool「弱中強バーニングキック」が 4 件に一致 |  |
| C.ヴァイパー | `seismic_hammer_feint` | 【セイスモハンマー】フェイント | `seismic_hammer_light/seismic_hammer_medium/seismic_hammer_heavy/seismic_hammer_od` | notes_tool「弱中強セイスモハンマー」が 4 件に一致 |  |

### 確信度: 低(notes に親名ありだが未解決)（52 件）

| キャラ | 子 `move_code` | 技名 | 親候補 `move_code` | 根拠 | 判定 |
|---|---|---|---|---|---|
| AKI | `venomous_fang` | 猛毒牙 |  | notes_tool「Slide」= CSV の name_ja に無い |  |
| AKI | `heel_strike` | 蛇連咬 |  | notes_tool「Slide」= CSV の name_ja に無い |  |
| AKI | `entrapment` | 雁字搦 |  | notes_tool「Slide」= CSV の name_ja に無い |  |
| 豪鬼 | `tenmaku_blade_kick` | 天魔空刃脚 |  | notes_tool「前ジャンプ」= CSV の name_ja に無い |  |
| 豪鬼 | `aerial_tatsumaki_zanku_kyaku_od` | OD空中竜巻斬空脚 | `aerial_tatsumaki_zanku_kyaku` | notes_tool「前ジャンプ」= CSV の name_ja に無い / move_code の接頭辞 aerial_tatsumaki |  |
| 豪鬼 | `aerial_tatsumaki_zanku_kyaku` | 空中竜巻斬空脚 |  | notes_tool「前ジャンプ」= CSV の name_ja に無い |  |
| 豪鬼 | `adamant_flame_light` | 弱金剛灼火 |  | notes_tool「同じ強度の単発版」= CSV の name_ja に無い |  |
| 豪鬼 | `adamant_flame_medium` | 中金剛灼火 |  | notes_tool「同じ強度の単発版」= CSV の name_ja に無い |  |
| 豪鬼 | `adamant_flame_heavy` | 強金剛灼火 |  | notes_tool「同じ強度の単発版」= CSV の name_ja に無い |  |
| 豪鬼 | `adamant_flame_od` | OD金剛灼火 |  | notes_tool「同じ強度の単発版」= CSV の name_ja に無い |  |
| 豪鬼 | `oboro_throw` | 朧 |  | notes_tool「前方)」= CSV の name_ja に無い |  |
| 豪鬼 | `sa1_tenma_gozanku` | SA1 天魔豪斬空 |  | notes_tool「垂直ジャンプ」= CSV の name_ja に無い |  |
| アレックス | `sweep_combination` | スイープコンビネーション |  | notes_tool「1hit」= CSV の name_ja に無い |  |
| アレックス | `palm_strikes` | パームストライク |  | notes_tool「空振り」= CSV の name_ja に無い |  |
| アレックス | `twisted_drop` | ツイストドロップ |  | notes_tool「空振り」= CSV の name_ja に無い |  |
| ブランカ | `lightning_beast_light_aerial_rolling_attack` | 【ライトニングビースト】弱エリアルローリング |  | notes_tool「前方ジャンプ」= CSV の name_ja に無い |  |
| ブランカ | `lightning_beast_medium_aerial_rolling_attack` | 【ライトニングビースト】中エリアルローリング |  | notes_tool「前方ジャンプ」= CSV の name_ja に無い |  |
| ブランカ | `lightning_beast_heavy_aerial_rolling_attack` | 【ライトニングビースト】強エリアルローリング |  | notes_tool「前方ジャンプ」= CSV の name_ja に無い |  |
| ブランカ | `lightning_beast_od_aerial_rolling_attack` | 【ライトニングビースト】ODエリアルローリング |  | notes_tool「前方ジャンプ」= CSV の name_ja に無い |  |
| キャミィ | `razors_edge_slicer_od` | ODレイザーエッジスライサー(ODフーリガンコンビネーション派生) | `razors_edge_slicer` | notes_tool「フーリガン」= CSV の name_ja に無い / move_code の接頭辞 razors_edge_slic |  |
| キャミィ | `razors_edge_slicer` | レイザーエッジスライサー(フーリガンコンビネーション派生) |  | notes_tool「フーリガン」= CSV の name_ja に無い |  |
| キャミィ | `razors_edge_slicer_holding` | レイザーエッジスライサー(【ホールド】強フーリガンコンビネーション派生) | `razors_edge_slicer` | notes_tool「フーリガン」= CSV の name_ja に無い / move_code の接頭辞 razors_edge_slic |  |
| キャミィ | `cannon_strike_light_od_hooligan_combination_od` | ODキャノンストライク(弱ODフーリガン派生) | `cannon_strike_light` | notes_tool「弱中同時押しフーリガン」= CSV の name_ja に無い / move_code の接頭辞 cannon_str |  |
| キャミィ | `cannon_strike_medium_od_hooligan_combination_od` | ODキャノンストライク(中ODフーリガン派生) | `cannon_strike_medium` | notes_tool「弱強同時押しフーリガン」= CSV の name_ja に無い / move_code の接頭辞 cannon_str |  |
| キャミィ | `cannon_strike_heavy_od_hooligan_combination_od` | ODキャノンストライク(強ODフーリガン派生) | `cannon_strike_heavy` | notes_tool「中強同時押しフーリガン」= CSV の name_ja に無い / move_code の接頭辞 cannon_str |  |
| ディージェイ | `sa2_climactic_strike` | SA2 クライマックスブロー |  | notes_tool「Festival」= CSV の name_ja に無い |  |
| ディージェイ | `sa2_encore_beat` | SA2 アンコールビート |  | notes_tool「Festival」= CSV の name_ja に無い |  |
| エド | `kill_switch_break` | キルスイッチ・ブレイク |  | notes_tool「Forward」= CSV の name_ja に無い |  |
| エド | `kill_switch_chaser` | キルスイッチ・チェイス |  | notes_tool「Forward」= CSV の name_ja に無い |  |
| エレナ | `buffed_leopard_snap` | 【強化】レオパードスナップ |  | notes_tool「スピンサイズ派生版含む）」= CSV の name_ja に無い |  |
| エレナ | `buffed_harvest_circle` | 【強化】ハーベストサークル |  | notes_tool「スピンサイズ派生版含む）」= CSV の name_ja に無い |  |
| エレナ | `buffed_mallet_smash` | 【強化】マレットスマッシュ |  | notes_tool「スピンサイズ派生版含む）」= CSV の name_ja に無い |  |
| エレナ | `lynx_whirl_light` | 弱リンクスワール |  | notes_tool「スピンサイズ派生版含む）」= CSV の name_ja に無い |  |
| エレナ | `lynx_whirl_medium` | 中リンクスワール |  | notes_tool「スピンサイズ派生版含む）」= CSV の name_ja に無い |  |
| エレナ | `lynx_whirl_heavy` | 強リンクスワール |  | notes_tool「スピンサイズ派生版含む）」= CSV の name_ja に無い |  |
| ヤスミン | `bayani_light_alon` | 【バヤニ】弱アロン |  | notes_tool「バヤニモードで弱ダロイ・ン・トゥビグ」= CSV の name_ja に無い |  |
| ヤスミン | `bayani_medium_alon` | 【バヤニ】中アロン |  | notes_tool「バヤニモードで中ダロイ・ン・トゥビグ派生」= CSV の name_ja に無い |  |
| ヤスミン | `bayani_heavy_alon` | 【バヤニ】強アロン |  | notes_tool「バヤニモードで強ダロイ・ン・トゥビグ派生」= CSV の name_ja に無い |  |
| ヤスミン | `bayani_od_alon` | 【バヤニ】ODアロン |  | notes_tool「バヤニモードでODダロイ・ン・トゥビグ派生」= CSV の name_ja に無い |  |
| C.ヴァイパー | `aerial_burning_kick_light` | 弱空中バーニングキック |  | notes_tool「前方ジャンプ」= CSV の name_ja に無い |  |
| C.ヴァイパー | `aerial_burning_kick_medium` | 中空中バーニングキック |  | notes_tool「前方ジャンプ」= CSV の name_ja に無い |  |
| C.ヴァイパー | `aerial_burning_kick_heavy` | 強空中バーニングキック |  | notes_tool「前方ジャンプ」= CSV の name_ja に無い |  |
| C.ヴァイパー | `aerial_burning_kick_od` | OD空中バーニングキック |  | notes_tool「前方ジャンプ」= CSV の name_ja に無い |  |
| ダルシム | `yoga_mummy` | ドリル頭突き |  | notes_tool「前方ジャンプ」= CSV の name_ja に無い |  |
| ダルシム | `drill_kick` | 弱ドリルキック |  | notes_tool「前方ジャンプ」= CSV の name_ja に無い |  |
| ダルシム | `medium_drill_kick` | 中ドリルキック |  | notes_tool「前方ジャンプ」= CSV の name_ja に無い |  |
| ダルシム | `heavy_drill_kick` | 強ドリルキック |  | notes_tool「前方ジャンプ」= CSV の name_ja に無い |  |
| ダルシム | `aerial_yoga_float` | 空中ヨガフロート |  | notes_tool「前方ジャンプ」= CSV の name_ja に無い |  |
| ダルシム | `aerial_yoga_teleport` | P空中ヨガテレポート（前方） |  | notes_tool「前方ジャンプ」= CSV の name_ja に無い |  |
| ダルシム | `p_aerial_yoga_teleport_backward` | P空中ヨガテレポート（後方） |  | notes_tool「前方ジャンプ」= CSV の name_ja に無い |  |
| ダルシム | `k_aerial_yoga_teleport_forward` | K空中ヨガテレポート（前方） |  | notes_tool「前方ジャンプ」= CSV の name_ja に無い |  |
| ダルシム | `k_aerial_yoga_teleport_backward` | K空中ヨガテレポート（後方） |  | notes_tool「前方ジャンプ」= CSV の name_ja に無い |  |

### 確信度: 低(code 接頭辞)（54 件）

| キャラ | 子 `move_code` | 技名 | 親候補 `move_code` | 根拠 | 判定 |
|---|---|---|---|---|---|
| AKI | `sinister_slide_cancel` | 悪鬼蛇行(解除) | `sinister_slide` | move_code の接頭辞 sinister_slide が同キャラに実在 |  |
| 豪鬼 | `kikoku_combination_2hits` | 鬼哭連撃(2発止め) | `kikoku_combination` | move_code の接頭辞 kikoku_combination が同キャラに実在 |  |
| 豪鬼 | `demon_guillotine_side_switch` | 百鬼豪衝(強百鬼襲・裏回り) | `demon_guillotine` | move_code の接頭辞 demon_guillotine が同キャラに実在 |  |
| 豪鬼 | `demon_blade_kick_side_switch` | 百鬼豪刃(強百鬼襲・裏回り) | `demon_blade_kick` | move_code の接頭辞 demon_blade_kick が同キャラに実在 |  |
| 豪鬼 | `demon_swoop_od` | OD百鬼潜影 | `demon_swoop` | move_code の接頭辞 demon_swoop が同キャラに実在 |  |
| 豪鬼 | `demon_swoop_side_switch_od` | OD百鬼潜影(裏回り) | `demon_swoop_side_switch` | move_code の接頭辞 demon_swoop_side_switch が同キャラに実在 |  |
| 豪鬼 | `demon_swoop_side_switch` | 百鬼潜影(中強百鬼襲・裏回り) | `demon_swoop` | move_code の接頭辞 demon_swoop が同キャラに実在 |  |
| アレックス | `prowler_stance_cancel` | ブレイカー・スタンス(解除) | `prowler_stance` | move_code の接頭辞 prowler_stance が同キャラに実在 |  |
| アレックス | `heavy_lariat_holding` | 【ホールド】ヘビーラリアット | `heavy_lariat` | move_code の接頭辞 heavy_lariat が同キャラに実在 |  |
| アレックス | `sweep_combination_1hit` | スイープコンビネーション(単発) | `sweep_combination` | move_code の接頭辞 sweep_combination が同キャラに実在 |  |
| アレックス | `power_drop_od` | ODパワードロップ | `power_drop` | move_code の接頭辞 power_drop が同キャラに実在 |  |
| ブランカ | `coward_crouch_cancel` | フィアーダウン(解除) | `coward_crouch` | move_code の接頭辞 coward_crouch が同キャラに実在 |  |
| ブランカ | `lightning_beast_electric_thunder_holding` | 【ライトニングビースト】エレクトリックサンダー（ホールド） | `lightning_beast_electric_thunder` | move_code の接頭辞 lightning_beast_electric_thunder が同キャラに実在 |  |
| ブランカ | `lightning_beast_od_electric_thunder_holding` | 【ライトニングビースト】ODエレクトリックサンダー（ホールド） | `lightning_beast_od_electric_thunder` | move_code の接頭辞 lightning_beast_od_electric_thunder が同キャラに実在 |  |
| ブランカ | `rolling_cannon_down` | ローリングキャノン（下） | `rolling_cannon` | move_code の接頭辞 rolling_cannon が同キャラに実在 |  |
| ブランカ | `rolling_cannon_down_forward` | ローリングキャノン（前方斜め下） | `rolling_cannon_down` | move_code の接頭辞 rolling_cannon_down が同キャラに実在 |  |
| ブランカ | `rolling_cannon_back` | ローリングキャノン（後方） | `rolling_cannon` | move_code の接頭辞 rolling_cannon が同キャラに実在 |  |
| ブランカ | `rolling_cannon_forward` | ローリングキャノン（前方） | `rolling_cannon` | move_code の接頭辞 rolling_cannon が同キャラに実在 |  |
| ブランカ | `rolling_cannon_up_back` | ローリングキャノン（後方斜め上） | `rolling_cannon_up` | move_code の接頭辞 rolling_cannon_up が同キャラに実在 |  |
| ブランカ | `rolling_cannon_up` | ローリングキャノン（上） | `rolling_cannon` | move_code の接頭辞 rolling_cannon が同キャラに実在 |  |
| ブランカ | `rolling_cannon_up_forward` | ローリングキャノン（前方斜め上） | `rolling_cannon_up` | move_code の接頭辞 rolling_cannon_up が同キャラに実在 |  |
| キャミィ | `cannon_strike_light_hooligan_combination` | キャノンストライク(弱フーリガンコンビネーション派生) | `cannon_strike_light` | move_code の接頭辞 cannon_strike_light が同キャラに実在 |  |
| キャミィ | `cannon_strike_medium_hooligan_combination` | キャノンストライク(中フーリガンコンビネーション派生) | `cannon_strike_medium` | move_code の接頭辞 cannon_strike_medium が同キャラに実在 |  |
| キャミィ | `cannon_strike_heavy_hooligan_combination` | キャノンストライク(強フーリガンコンビネーション派生) | `cannon_strike_heavy` | move_code の接頭辞 cannon_strike_heavy が同キャラに実在 |  |
| キャミィ | `cannon_strike_heavy_hooligan_combination_holding` | キャノンストライク(【ホールド】強フーリガンコンビネーション派生) | `cannon_strike_heavy_hooligan_combination` | move_code の接頭辞 cannon_strike_heavy_hooligan_combination が同キャラに実在 |  |
| キャミィ | `reverse_edge_heavy_hooligan_combination_holding` | リバースエッジ(【ホールド】強フーリガンコンビネーション派生) | `reverse_edge_heavy_hooligan_combination` | move_code の接頭辞 reverse_edge_heavy_hooligan_combination が同キャラに実在 |  |
| キャミィ | `fatal_leg_twister_heavy_hooligan_combination_holding` | フェイタルレッグツイスター(【ホールド】強フーリガンコンビネーション派生) | `fatal_leg_twister_heavy` | move_code の接頭辞 fatal_leg_twister_heavy が同キャラに実在 |  |
| キャミィ | `fatal_leg_twister_light_od_hooligan_combination` | フェイタルレッグツイスター(弱ODフーリガンコンビネーション派生) | `fatal_leg_twister_light` | move_code の接頭辞 fatal_leg_twister_light が同キャラに実在 |  |
| キャミィ | `fatal_leg_twister_medium_od_hooligan_combination` | フェイタルレッグツイスター(中ODフーリガンコンビネーション派生) | `fatal_leg_twister_medium` | move_code の接頭辞 fatal_leg_twister_medium が同キャラに実在 |  |
| キャミィ | `fatal_leg_twister_heavy_od_hooligan_combination` | フェイタルレッグツイスター(強ODフーリガンコンビネーション派生) | `fatal_leg_twister_heavy` | move_code の接頭辞 fatal_leg_twister_heavy が同キャラに実在 |  |
| キャミィ | `silent_step_light_od_hooligan_combination_od` | ODサイレントステップ(弱ODフーリガン派生) | `silent_step_light` | move_code の接頭辞 silent_step_light が同キャラに実在 |  |
| キャミィ | `silent_step_medium_od_hooligan_combination_od` | ODサイレントステップ(中ODフーリガン派生) | `silent_step_medium` | move_code の接頭辞 silent_step_medium が同キャラに実在 |  |
| キャミィ | `silent_step_heavy_od_hooligan_combination_od` | ODサイレントステップ(強ODフーリガン派生) | `silent_step_heavy` | move_code の接頭辞 silent_step_heavy が同キャラに実在 |  |
| 春麗 | `serenity_stream_cancel` | 行雲流水(解除) | `serenity_stream` | move_code の接頭辞 serenity_stream が同キャラに実在 |  |
| ディージェイ | `threebeat_combo_2hits` | 3ビートコンボ(2発止め) | `threebeat_combo` | move_code の接頭辞 threebeat_combo が同キャラに実在 |  |
| ディージェイ | `dee_jay_special_2hits` | ディージェイスペシャル(2発止め) | `dee_jay_special` | move_code の接頭辞 dee_jay_special が同キャラに実在 |  |
| ディージェイ | `funky_dance_2hits` | ファンキーダンス(2発止め) | `funky_dance` | move_code の接頭辞 funky_dance が同キャラに実在 |  |
| ディージェイ | `funky_dance_feint` | ファンキーダンス・フェイク | `funky_dance` | move_code の接頭辞 funky_dance が同キャラに実在 |  |
| ディージェイ | `funky_slicer_od` | ODファンキースライサー | `funky_slicer` | move_code の接頭辞 funky_slicer が同キャラに実在 |  |
| ディージェイ | `waning_moon_od` | ODワニングムーン | `waning_moon` | move_code の接頭辞 waning_moon が同キャラに実在 |  |
| ディージェイ | `maximum_strike_od` | ODマキシマムストライク | `maximum_strike` | move_code の接頭辞 maximum_strike が同キャラに実在 |  |
| ディージェイ | `juggling_dash_od` | ODジャグリングステップ | `juggling_dash` | move_code の接頭辞 juggling_dash が同キャラに実在 |  |
| ディージェイ | `juggling_sway_od` | ODジャグリングスウェイ | `juggling_sway` | move_code の接頭辞 juggling_sway が同キャラに実在 |  |
| E.本田 | `sumo_spirit_light_hundred_hand_slap` | [肩屋入り版]弱百裂張り手 | `sumo_spirit` | move_code の接頭辞 sumo_spirit が同キャラに実在 |  |
| E.本田 | `sumo_spirit_medium_hundred_hand_slap` | [肩屋入り版]中百裂張り手 | `sumo_spirit` | move_code の接頭辞 sumo_spirit が同キャラに実在 |  |
| E.本田 | `sumo_spirit_heavy_hundred_hand_slap` | [肩屋入り版]強百裂張り手 | `sumo_spirit` | move_code の接頭辞 sumo_spirit が同キャラに実在 |  |
| E.本田 | `sumo_spirit_od_hundred_hand_slap` | [肩屋入り版]OD百裂張り手 | `sumo_spirit` | move_code の接頭辞 sumo_spirit が同キャラに実在 |  |
| E.本田 | `toko_shizume_sumo_spirit` | 地鎮(肩屋入り) | `toko_shizume` | move_code の接頭辞 toko_shizume が同キャラに実在 |  |
| エド | `flicker_combination_2hits` | フリッカーコンビネーション(2発止め) | `flicker_combination` | move_code の接頭辞 flicker_combination が同キャラに実在 |  |
| エド | `hitman_combination_2hits` | ヒットマンコンビネーション(2発止め) | `hitman_combination` | move_code の接頭辞 hitman_combination が同キャラに実在 |  |
| エレナ | `trunk_slap_2hits` | トランクスラップ(2発止め) | `trunk_slap` | move_code の接頭辞 trunk_slap が同キャラに実在 |  |
| ヤスミン | `sunod_sunod_na_sipa_2hits` | スノスノッド・ナ・シパ(2発止め) | `sunod_sunod_na_sipa` | move_code の接頭辞 sunod_sunod_na_sipa が同キャラに実在 |  |
| C.ヴァイパー | `focus_force_forward_step` | 【セービングフォース】前方ステップ | `focus_force` | move_code の接頭辞 focus_force が同キャラに実在 |  |
| C.ヴァイパー | `focus_force_forward_step_od` | 【ODセービングフォース】前方ステップ | `focus_force_forward_step` | move_code の接頭辞 focus_force_forward_step が同キャラに実在 |  |

### 確信度: 不明（113 件）

| キャラ | 子 `move_code` | 技名 | 親候補 `move_code` | 根拠 | 判定 |
|---|---|---|---|---|---|
| AKI | `snake_step_side_switch_heavy` | 強蛇軽功(裏回り) |  | notes_tool 空 |  |
| AKI | `snake_step_side_switch_od` | OD蛇軽功(裏回り) |  | notes_tool 空 |  |
| 豪鬼 | `viscera_piercer` | 六腑穿ち |  | notes_tool 空 |  |
| 豪鬼 | `bone_crusher_axe_kick` | 骸斬り |  | notes_tool 空 |  |
| 豪鬼 | `kikoku_combination` | 鬼哭連撃 |  | notes_tool 空 |  |
| 豪鬼 | `gou_hadoken_holding_light` | 【ホールド】弱豪波動拳 |  | notes_tool に親の記述なし |  |
| 豪鬼 | `gou_hadoken_holding_medium` | 【ホールド】中豪波動拳 |  | notes_tool に親の記述なし |  |
| 豪鬼 | `gou_hadoken_holding_heavy` | 【ホールド】強豪波動拳 |  | notes_tool に親の記述なし |  |
| 豪鬼 | `gou_hadoken_holding_od` | 【ホールド】OD豪波動拳 |  | notes_tool に親の記述なし |  |
| 豪鬼 | `gou_hadoken_max_holding_light` | 【最大ホールド】弱豪波動拳 |  | notes_tool に親の記述なし |  |
| 豪鬼 | `gou_hadoken_max_holding_medium` | 【最大ホールド】中豪波動拳 |  | notes_tool に親の記述なし |  |
| 豪鬼 | `gou_hadoken_max_holding_heavy` | 【最大ホールド】強豪波動拳 |  | notes_tool に親の記述なし |  |
| 豪鬼 | `demon_swoop` | 百鬼潜影 |  | notes_tool 空 |  |
| 豪鬼 | `demon_gou_zanku` | 百鬼豪斬空 |  | notes_tool に親の記述なし |  |
| 豪鬼 | `demon_gou_rasen` | 百鬼豪螺旋 |  | notes_tool に親の記述なし |  |
| アレックス | `light_slashing_elbow` | 弱スラッシュエルボー |  | notes_tool 空 |  |
| アレックス | `medium_slashing_elbow` | 中スラッシュエルボー |  | notes_tool 空 |  |
| アレックス | `heavy_slashing_elbow` | 強スラッシュエルボー |  | notes_tool 空 |  |
| アレックス | `palm_jab` | パームコンタクト |  | notes_tool に親の記述なし |  |
| アレックス | `shoulder_launcher` | ショルダーランチャー |  | notes_tool 空 |  |
| アレックス | `heavy_lariat` | ヘビーラリアット |  | notes_tool 空 |  |
| アレックス | `tactical_hop` | タクティカルリープ |  | notes_tool 空 |  |
| アレックス | `air_stampede` | エアスタンピート |  | notes_tool 空 |  |
| アレックス | `hyper_takedown` | ハイパーリフト |  | notes_tool 空 |  |
| アレックス | `dangerous_armbar` | デンジャラスアプローチ |  | notes_tool 空 |  |
| アレックス | `power_drop` | パワードロップ |  | notes_tool に親の記述なし |  |
| ブランカ | `wild_lift` | ワイルドリフト |  | notes_tool に親の記述なし |  |
| ブランカ | `raid_jump` | レイドジャンプ |  | notes_tool に親の記述なし |  |
| ブランカ | `lightning_beast_electric_thunder` | 【ライトニングビースト】エレクトリックサンダー |  | notes_tool 空 |  |
| ブランカ | `lightning_beast_od_electric_thunder` | 【ライトニングビースト】ODエレクトリックサンダー |  | notes_tool 空 |  |
| ブランカ | `lightning_beast_light_rolling_attack` | 【ライトニングビースト】弱ローリングアタック |  | notes_tool 空 |  |
| ブランカ | `lightning_beast_medium_rolling_attack` | 【ライトニングビースト】中ローリングアタック |  | notes_tool 空 |  |
| ブランカ | `lightning_beast_heavy_rolling_attack` | 【ライトニングビースト】強ローリングアタック |  | notes_tool 空 |  |
| ブランカ | `lightning_beast_od_rolling_attack` | 【ライトニングビースト】ODローリングアタック |  | notes_tool 空 |  |
| ブランカ | `lightning_beast_light_vertical_rolling_attack` | 【ライトニングビースト】弱バーチカルローリングアタック |  | notes_tool 空 |  |
| ブランカ | `lightning_beast_medium_vertical_rolling_attack` | 【ライトニングビースト】中バーチカルローリングアタック |  | notes_tool 空 |  |
| ブランカ | `lightning_beast_heavy_vertical_rolling_attack` | 【ライトニングビースト】強バーチカルローリングアタック |  | notes_tool 空 |  |
| ブランカ | `lightning_beast_od_vertical_rolling_attack` | 【ライトニングビースト】ODバーチカルローリングアタック |  | notes_tool 空 |  |
| ブランカ | `lightning_beast_light_backstep_rolling_attack` | 【ライトニングビースト】弱バックステップローリング |  | notes_tool 空 |  |
| ブランカ | `lightning_beast_medium_backstep_rolling_attack` | 【ライトニングビースト】中バックステップローリング |  | notes_tool 空 |  |
| ブランカ | `lightning_beast_heavy_backstep_rolling_attack` | 【ライトニングビースト】強バックステップローリング |  | notes_tool 空 |  |
| ブランカ | `lightning_beast_od_backstep_rolling_attack` | 【ライトニングビースト】ODバックステップローリング |  | notes_tool 空 |  |
| ブランカ | `rolling_cannon` | ローリングキャノン（後方斜め下） |  | notes_tool に親の記述なし |  |
| ブランカ | `lightning_beast_sa1_shout_of_earth` | 【ライトニングビースト】SA1 シャウトオブアース |  | notes_tool 空 |  |
| キャミィ | `spiral_arrow_holding_heavy` | 【ホールド】強スパイラルアロー |  | notes_tool に親の記述なし |  |
| キャミィ | `cannon_spike_holding_heavy` | 【ホールド】強キャノンスパイク |  | notes_tool に親の記述なし |  |
| キャミィ | `hooligan_combination_holding` | 【ホールド】フーリガンコンビネーション |  | notes_tool に親の記述なし |  |
| キャミィ | `reverse_edge_light_hooligan_combination` | リバースエッジ(弱フーリガンコンビネーション派生) |  | notes_tool 空 |  |
| キャミィ | `reverse_edge_medium_hooligan_combination` | リバースエッジ(中フーリガンコンビネーション派生) |  | notes_tool 空 |  |
| キャミィ | `reverse_edge_heavy_hooligan_combination` | リバースエッジ(強フーリガンコンビネーション派生) |  | notes_tool 空 |  |
| キャミィ | `reverse_edge_od` | ODリバースエッジ(ODフーリガンコンビネーション派生) |  | notes_tool に親の記述なし |  |
| キャミィ | `fatal_leg_twister_light` | フェイタルレッグツイスター(弱フーリガンコンビネーション派生) |  | notes_tool 空 |  |
| キャミィ | `fatal_leg_twister_medium` | フェイタルレッグツイスター(中フーリガンコンビネーション派生) |  | notes_tool 空 |  |
| キャミィ | `fatal_leg_twister_heavy` | フェイタルレッグツイスター(強フーリガンコンビネーション派生) |  | notes_tool 空 |  |
| キャミィ | `silent_step_light` | サイレントステップ(弱フーリガン派生) |  | notes_tool 空 |  |
| キャミィ | `silent_step_medium` | サイレントステップ(中フーリガン派生) |  | notes_tool 空 |  |
| キャミィ | `silent_step_heavy` | サイレントステップ(強フーリガン派生) |  | notes_tool 空 |  |
| キャミィ | `lift_combination` | リフトコンビネーション |  | notes_tool 空 |  |
| キャミィ | `swing_combination` | スイングコンビネーション |  | notes_tool 空 |  |
| ディージェイ | `threebeat_combo` | 3ビートコンボ |  | notes_tool 空 |  |
| ディージェイ | `dee_jay_special` | ディージェイスペシャル |  | notes_tool 空 |  |
| ディージェイ | `funky_dance` | ファンキーダンス |  | notes_tool に親の記述なし |  |
| ディージェイ | `party_in_the_air` | フライングパーティー |  | notes_tool に親の記述なし |  |
| ディージェイ | `funky_slicer` | ファンキースライサー |  | notes_tool 空 |  |
| ディージェイ | `waning_moon` | ワニングムーン |  | notes_tool 空 |  |
| ディージェイ | `maximum_strike` | マキシマムストライク |  | notes_tool 空 |  |
| ディージェイ | `juggling_dash` | ジャグリングステップ |  | notes_tool 空 |  |
| ディージェイ | `juggling_sway` | ジャグリングスウェイ |  | notes_tool 空 |  |
| エド | `flicker_combination` | フリッカーコンビネーション |  | notes_tool 空 |  |
| エド | `body_blow_combination` | ボディブローコンビネーション |  | notes_tool 空 |  |
| エド | `hitman_combination` | ヒットマンコンビネーション |  | notes_tool 空 |  |
| エド | `low_smash_combination` | ロースマッシュコンビネーション |  | notes_tool 空 |  |
| エレナ | `starling_beak` | スターリングビーク |  | notes_tool に親の記述なし |  |
| エレナ | `handstand_whip` | ハンドスタンドウィップ |  | notes_tool に親の記述なし |  |
| エレナ | `hind_kick` | ハインドキック |  | notes_tool に親の記述なし |  |
| エレナ | `fluttering_lark` | ラークフラッター |  | notes_tool に親の記述なし |  |
| エレナ | `turning_tail` | ターニングテイル |  | notes_tool に親の記述なし |  |
| エレナ | `trunk_slap` | トランクスラップ |  | notes_tool に親の記述なし |  |
| エレナ | `soaring_raid` | ソアーレイド |  | notes_tool に親の記述なし |  |
| エレナ | `raptor_range` | ラプターレンジ |  | notes_tool に親の記述なし |  |
| エレナ | `moon_glider_light` | 弱ムーングライド |  | notes_tool に親の記述なし |  |
| エレナ | `moon_glider_medium` | 中ムーングライド |  | notes_tool に親の記述なし |  |
| エレナ | `moon_glider_heavy` | 強ムーングライド |  | notes_tool に親の記述なし |  |
| エレナ | `moon_glider_od` | ODムーングライド |  | notes_tool に親の記述なし |  |
| サガット | `middle_step_kick` | ステップミドルキック |  | notes_tool に親の記述なし |  |
| サガット | `tiger_sting` | タイガースティング |  | notes_tool に親の記述なし |  |
| サガット | `tiger_slash` | タイガースラッシュ |  | notes_tool に親の記述なし |  |
| サガット | `tiger_rise` | タイガーライズ |  | notes_tool に親の記述なし |  |
| ヤスミン | `kidlat_na_hiwa` | キドラット・ナ・ヒワ |  | notes_tool 空 |  |
| ヤスミン | `tatlong_hiwa` | タッロング・ヒワ |  | notes_tool 空 |  |
| ヤスミン | `sunod_sunod_na_sipa` | スノスノッド・ナ・シパ |  | notes_tool 空 |  |
| ヤスミン | `kumbinasyong_pampabagsak` | コンビナション・パムパバッグサ |  | notes_tool 空 |  |
| ヤスミン | `alon_light` | 弱アロン |  | notes_tool に親の記述なし |  |
| ヤスミン | `alon_medium` | 中アロン |  | notes_tool に親の記述なし |  |
| ヤスミン | `alon_heavy` | 強アロン |  | notes_tool に親の記述なし |  |
| ヤスミン | `alon_od` | ODアロン |  | notes_tool に親の記述なし |  |
| C.ヴァイパー | `high_jumping_light_punch` | ハイジャンプ弱P |  | notes_tool に親の記述なし |  |
| C.ヴァイパー | `high_jumping_light_kick` | ハイジャンプ弱K |  | notes_tool に親の記述なし |  |
| C.ヴァイパー | `high_jumping_medium_punch` | ハイジャンプ中P |  | notes_tool に親の記述なし |  |
| C.ヴァイパー | `high_jumping_medium_kick` | ハイジャンプ中K |  | notes_tool に親の記述なし |  |
| C.ヴァイパー | `high_jumping_heavy_punch` | ハイジャンプ強P |  | notes_tool に親の記述なし |  |
| C.ヴァイパー | `high_jumping_heavy_kick` | ハイジャンプ強K |  | notes_tool に親の記述なし |  |
| C.ヴァイパー | `high_jumping_neutral_heavy_kick` | ハイジャンプ垂直ジャンプ強K |  | notes_tool 空 |  |
| C.ヴァイパー | `tracer_combination_light` | 弱トレースコンビネーション |  | notes_tool に親の記述なし |  |
| C.ヴァイパー | `tracer_combination_medium` | 中トレースコンビネーション |  | notes_tool に親の記述なし |  |
| C.ヴァイパー | `tracer_combination_heavy` | 強トレースコンビネーション |  | notes_tool に親の記述なし |  |
| C.ヴァイパー | `thunder_dash_feint_light` | 【サンダースラップ】弱フェイント |  | notes_tool に親の記述なし |  |
| C.ヴァイパー | `thunder_dash_feint_medium` | 【サンダースラップ】中フェイント |  | notes_tool に親の記述なし |  |
| C.ヴァイパー | `thunder_dash_feint_heavy` | 【サンダースラップ】強フェイント |  | notes_tool に親の記述なし |  |
| ダルシム | `yoga_teleport` | Pヨガテレポート（前方） |  | notes_tool 空 |  |
| ダルシム | `p_yoga_teleport_backward` | Pヨガテレポート（後方） |  | notes_tool 空 |  |
| ダルシム | `k_yoga_teleport_forward` | Kヨガテレポート（前方） |  | notes_tool 空 |  |
| ダルシム | `k_yoga_teleport_backward` | Kヨガテレポート（後方） |  | notes_tool 空 |  |

---

## 群5: 既存 17 キャラのジャンプ系 — **★受領済み（2026-09-04）・①は裁定／②は `000102` で投入済み**

**★開発者の依頼**＝「既存キャラへのジャンプ系の裁定については、機械提案ではなく、全部目視確認したい。怪しいものだけ伝える」。**⇒ 本節は候補表ではなく、目視用の棚卸しである。**

### ★★論点は 2 つに割れている（2026-09-04・開発者の問い返しで分離できた）

初版の本節は「区分A / 区分B」と呼んで並べたが、**性質の違う 2 種類が混ざっていた**。開発者から「これは何の判断ですか？ 派生元がジャンプの特殊技。必殺技の話とは別？」と問い返されて判明した。

| | 中身 | 件数 | 状態 |
|---|---|---:|---|
| **①ジャンプ攻撃そのもの**（＝旧「区分A」） | `jumping_{light,medium,heavy}_{punch,kick}` ＋ `neutral_jumping_heavy_kick` | 17 キャラで **104**（全 31 キャラでは 186） | **★裁定済み＝付けない**（2026-09-04） |
| **②ジャンプ前提の必殺技・特殊技ほか**（＝旧「区分B」） | 空中竜巻旋風脚・エアフラッシュナックル・矢来越え・三角飛び 等 | 17 キャラで **36** | **★これが目視確認の対象（未受領）** |

**★②が第四波で裁定した型である**（ダルシムのドリルキック・C.ヴァイパーの空中バーニングキック等に `jump_*` 親を付けた）。**①は裁定表に一度も載っていない**——`is_derived=false` のため候補抽出の対象外だった。

**対象＝`M14-03f` 以前に moves を入れた 17 キャラ**（31 − 第四波 12 − 仮登録 2。仮登録の `c_viper` / `dhalsim` は第四波で実技が入ったので群4 側）。

### 現状

**`move_derivations` は空ではない。** `000064` 63 行 ／ `000067` 16 行（8 キャラ）／ `000061` 9 行（zangief 連打版）／ `000098` 2 行（dhalsim 連打版）＝ **90 行**。
**ただし `jump_*`（移動 system move）を親にしている行は 0 件**で、第四波の `000101` が初めて 52 行を入れた。**既存 17 キャラには 1 行も無い。**

### ①通常ジャンプ攻撃 = **104 件** — **★裁定済み（2026-09-04）＝ `jump_*` 親を付けない**

`jumping_{light,medium,heavy}_{punch,kick}`（17 キャラ × 6）＋ `neutral_jumping_heavy_kick`（ken / juri）。
**全件が `is_aerial=1` ／ `startup_basis='standalone'` ／ 親なし ／ `fastest_unreachable=1`**（`000050` の C 型規則）で、キャラ間の差は無い。

**★「付いていたら消してほしい」との指示を受けて実査した結果、削除対象は 0 行だった。**
`jumping_*P/K` と `neutral_jumping_*` を子に持つ `move_derivations` は、**マイグレ全 101 本を通して 1 行も無い**（全 31 キャラ）。`000101` の `jump_*` 親 52 行はすべて②である。

**★線引き 1 件**: `c_viper/high_jumping_*`（7 件）には `high_jump` を親として投入済みだが、**これは①ではない**。親の `high_jump` は `category=unique`・`command='d u'` を持つ**入力技**であり、移動 system move の `jump_*` とは別物である。⇒ 残す。

**★裁定は `TestRun_M1403f_JumpNormalsHaveNoParent` で機械的に守っている**（①が 0 行／②の 52 行が残る／`high_jumping_*` の親が `high_jump` であること、を対で固定）。**①は候補表に載らないため、記録だけでは次の波で静かに破れる。**

### ②ジャンプ前提の必殺技・特殊技ほか = **36 件** — **★受領済み（2026-09-04）・`000102` で投入**

> **受領結果**: **棚卸し 36 件のうち採用 15 件・「対象外」21 件。加えて棚卸しに載っていなかった技が 28 件（6 キャラ分）追加された。** ⇒ 投入は **子 43 件 / ペア 56 行**。
>
> **★「機械で候補を挙げる」だけでは取り落とすことが実証された。** 追加された 28 件は
> `lily/condor_dive` 系 4 ／ `juri/shiku_sen` 2 ／ `zangief/borscht_dynamite` 2 ／ `rashid/arabian_skyhigh_*` 4 ／ `jamie/luminous_dive_kick_*` 4 ／ **`ingrid/solar_burst_*` 14**。
> **製造の抽出条件（`is_aerial` ／ code に `aerial|jump|air` ／ 名前や `notes_tool` に「ジャンプ・空中・エリアル」）は、コンドルダイブ・疾空閃・ボルシチダイナマイト・アラビアンスカイハイ・無影蹴・ソーラーフレアのどれにも当たらない。**
> **技名からジャンプ前提と分かるのはドメイン知識であって文字列ではない。**
>
> **「対象外」の代表**: `terry/jumping_lariat`・`jumping_knee`・`lily/great_spin`（**名前がジャンプで始まるが別技**）／ `kimberly/step_up_*`（**jump 無関係。既存の `hisen_kick` 親はそのまま**）／ `rashid/front_flip`（**`side_flip` 親はそのまま**）・`wall_jump`。
>
> **`ingrid/solar_burst` の自然言語指示の展開**: 「14 種類が `jump_forward` と `jump_neutral`。ただし垂直や前方と名前に含まれるものは対応した方向のジャンプのみ」→ **14 種すべてが（垂直）か（前方）を持っていた**ため、例外規定が全件にかかり **1 親ずつ 14 行**（開発者に確認済み）。
>
> 詳細は完了報告 §20。

| キャラ | `move_code` | 技名 | is_aerial | basis(DB) | is_derived | 既存の親 | `notes_tool` |
|---|---|---|:--:|:--:|:--:|:--:|---|
| リュウ | `aerial_tatsumaki_senpu_kyaku_od` | OD空中竜巻旋風脚 |  | standalone |  | — |  |
| リュウ | `aerial_tatsumaki_senpu_kyaku` | 空中竜巻旋風脚 |  | standalone |  | — |  |
| ケン | `aerial_tatsumaki_senpu_kyaku` | 空中竜巻旋風脚 |  | standalone |  | — |  |
| ケン | `aerial_tatsumaki_senpu_kyaku_od` | OD空中竜巻旋風脚 |  | standalone |  | — |  |
| テリー | `jumping_lariat` | ジャンプラリアットパンチ |  | standalone | ✓ | — |  |
| テリー | `jumping_knee` | ジャンプニーアタック |  | standalone | ✓ | — |  |
| リリー | `great_spin` | グレートスピン | ✓ | standalone |  | — |  |
| キンバリー | `step_up_backward` | 矢来越え(後方)  | ✓ | standalone | ✓ | **あり** |  |
| キンバリー | `step_up_neutral` | 矢来越え(垂直)  | ✓ | standalone | ✓ | **あり** |  |
| キンバリー | `step_up_forward` | 矢来越え(前方) | ✓ | standalone | ✓ | **あり** |  |
| キンバリー | `elbow_drop` | 肘落とし | ✓ | through |  | — |  |
| キンバリー | `aerial_bushin_senpukyaku_od` | OD空中武神旋風脚 |  | standalone |  | — |  |
| キンバリー | `aerial_bushin_senpukyaku` | 空中武神旋風脚 |  | standalone |  | — |  |
| キンバリー | `sa2_soaring_bushin_scramble` | SA2 空中武神天翔亢竜 |  | standalone |  | — | ジャンプ9F 10F目からキャンセル可能 なぜかインゲームで出てくるフレームもおかしい（硬直39なのに、全体は70） |
| ジュリ | `air_throw` | 空投げ |  | standalone |  | — |  |
| 舞 | `air_throw` | 空投げ |  | standalone |  | — |  |
| 舞 | `sa2_air_chou_hissatsu_shinobi_bachi` | SA2 空中超必殺忍蜂 |  | standalone |  | — |  |
| 舞 | `flame_sa2_air_chou_hissatsu_shinobi_bachi` | [焔版]SA2 空中超必殺忍蜂 |  | through | ✓ | — |  |
| ザンギエフ | `jumping_heavy_kick_holding` | ジャンプ強K(ホールド) | ✓ | standalone |  | — |  |
| ザンギエフ | `flying_body_press` | フライングボディプレス | ✓ | standalone |  | — |  |
| ザンギエフ | `flying_headbutt` | フライングヘッドバット | ✓ | standalone |  | — |  |
| ザンギエフ | `sa1_aerial_russian_slam` | SA1 エアリアルロシアンスラム |  | standalone |  | — |  |
| ラシード | `buffed_jump_forward` | 【強化】前ジャンプ | ✓ | standalone | ✓ | — |  |
| ラシード | `buffed_jump_neutral` | 【強化】垂直ジャンプ | ✓ | standalone | ✓ | — |  |
| ラシード | `buffed_jump_back` | 【強化】後ろジャンプ | ✓ | standalone | ✓ | — |  |
| ラシード | `blitz_strike` | ブリッツストライク | ✓ | standalone |  | — |  |
| ラシード | `aerial_shot` | エリアルシュート | ✓ | standalone |  | — |  |
| ラシード | `front_flip` | フロント・フリップ | ✓ | through | ✓ | **あり** |  |
| ラシード | `wall_jump` | 三角飛び | ✓ | through | ✓ | — |  |
| ルーク | `aerial_flash_knuckle_od` | ODエアフラッシュナックル |  | standalone |  | — |  |
| ルーク | `aerial_flash_knuckle_holding` | 【ホールド】エアフラッシュナックル |  | standalone |  | — |  |
| ルーク | `aerial_flash_knuckle` | エアフラッシュナックル |  | standalone |  | — |  |
| マリーザ | `jumping_heavy_punch_holding` | 【ホールド】ジャンプ強P | ✓ | standalone |  | — | ホールドの発生は固定。発生早くなるタイミングはない |
| マリーザ | `jumping_heavy_kick_holding` | 【ホールド】ジャンプ強K | ✓ | standalone |  | — | ホールドの発生は固定。発生早くなるタイミングはない |
| マリーザ | `caelum_arc` | カエルムアーク | ✓ | standalone |  | — |  |
| マリーザ | `caelum_arc_holding` | 【ホールド】カエルムアーク | ✓ | standalone |  | — |  |

### ★判断のときに効く副作用

導出 **`startup_basis IN ('standalone','unknown') ∧ 親参照あり → 単独入力不可`** が成立するため、**`standalone` の行に親を付けると、その技はセットプレイ提案の filler / target から静かに落ちる。**
`through` の 4 行（キンバリー `elbow_drop` ／ 舞 `flame_sa2_air_chou_hissatsu_shinobi_bachi` ／ ラシード `front_flip`・`wall_jump`）は付けても落ちない。

**実測の目安**: 第四波では親を付けた子 169 件のうち **69 件**（41%）が候補から外れた（単独入力不可 17 → 86）。

---

## 受け取ったあとの流れ

1. 群ごとに 1 本のマイグレを起こす（連番は受領時に `ls migrations/` を実査して払い出す。**★並列タスクと衝突しないよう、開発者に空きを確認してから使う**）。
2. 投入件数を固定するテストを同じ手番で書く（`SUPP-001` §5.5 (3)。**投入しなかった行も対で固定する**）。
3. 完了報告 `docs/progress/M14-03f-completion-report.md` へ追記し、`progress-log.md` の索引行を更新する。

*以上*
