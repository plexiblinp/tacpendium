# M19-05 完了報告: 消費側（費用規則の実装と filler 規則の変更）

| 項目 | 内容 |
|------|------|
| 文書ID | M19-05-COMPLETION-REPORT |
| バージョン | 1.0.0（2026-08-09） |
| 対象指示書 | `docs/instructions/M19-05-consumption-side.md` v1.0.0 |
| 裁定書 | `M19-05-PLAN-MODE-RULINGS` v1.1.0（**D-260〜D-266**） |
| 実装 | commit `90e1008`（段階 A）／`4dc6205`（段階 B） |
| CHANGE | **094**（採番済。`docs/change-notes/CHANGE-094-notification.md`） |
| マイグレ | **非消費**（`migrations/` に新規ファイルなし） |
| 設計伝達レポート | `docs/handover/design-reports/20260809-m19-05-design-exceptions.md` |

> **★裁定書 v1.1.0 に従い、指示書 v1.0.0 の §2.4 ／ §2.5 ／ §2.6 ／ §4.2 を読み替えて実装した。**
> 段階 C（確定反撃の除外）と R6 警告はスコープ外である（D-260 / D-261 / D-262）。

> **★本報告の件数はすべて 2026-08-09・マイグレ v68 適用後・17 キャラ seed 済みの実測値である。**
> 設計文書の見積り（`target_combo` 67 行・維持 63 行・案 α ~187 行など）は 11 キャラ時点の値であり、
> 期待値として写していない（`M19-DESIGN-07` §4-3 の規約 / **D-259**）。**seed 波が進むと母数は増える。**

---

## 1. filler 候補の件数の変遷と増減の全数（§7.2-1）

| 段 | filler 候補 | 差分 |
|---|---:|---|
| 着手前 | **1482** | — |
| 段階 A 後 | **1470** | **+4 − 16** |
| 段階 B 後 | **1470** | **±0**（段階 B は target 側のみ。射影の `FILLER` 行は完全一致） |

### 1.1 ゲート 1 — 緩和 +4 行（全数）

| character | move_code | total |
|---|---|---:|
| zangief | `machine_gun_chops` | 91 |
| zangief | `machine_gun_chops_2hits` | 32 |
| zangief | `power_stomps` | 72 |
| zangief | `power_stomps_2hits` | 48 |

**`M19-DESIGN-08` §1.3-2 の名指しと完全一致。** いずれも `category='target_combo' AND is_derived=0`
＝**空振りでも出るパターン 3** である。

### 1.2 ゲート 1 — 維持（除外され続ける側）

**`category='target_combo'` 全 80 行のうち `is_derived=1` の 76 行**は引き続き除外される。

> **★指示書 §4.2-2 の「63 行」は 11 キャラ時点の値**であり、第三波 6 キャラの seed（`000053`〜）で
> `target_combo` が 67 → 80 に増えたため失効していた。**実測 76 で固定した**（裁定 §4）。

### 1.3 ゲート 2 — 除外 16 行（全数・basis 由来別）

**`standalone` 由来 11 行**:

| character | move_code | category | total | damage |
|---|---|---|---:|---|
| guile | `perfect_timing_sonic_cross_od` | special | 38 | 1300 |
| guile | `sonic_cross_heavy` | special | 38 | 1000 |
| guile | `sonic_cross_light` | special | 38 | 1000 |
| guile | `sonic_cross_medium` | special | 38 | 1000 |
| guile | `sonic_cross_od` | special | 38 | 1300 |
| kimberly | `step_up_backward` | unique | 33 | 0 |
| kimberly | `step_up_forward` | unique | 33 | 0 |
| kimberly | `step_up_neutral` | unique | 33 | 0 |
| zangief | `crouching_light_kick_rapid` | normal | 17 | NULL |
| zangief | `crouching_light_punch_rapid` | normal | 12 | NULL |
| zangief | `standing_light_punch_rapid` | normal | 15 | NULL |

**`unknown` 由来 5 行**（CHANGE-093／D-227 で述語へ追加された側）:

| character | move_code | category | total | damage |
|---|---|---|---:|---|
| ken | `gorai_axe_kick` | special | 40 | 1000 |
| ken | `kazekama_shin_kick` | special | 28 | 600 |
| ken | `senka_snap_kick` | special | 37 | 800 |
| m_bison | `devil_reverse_od` | special | 59 | 1400 |
| m_bison | `head_press_od` | special | 46 | 2000 |

**16 行とも旧規則では filler 候補だった**（＝母数の外を数えていないことをテストで固定）。
ザンギエフ連打版 3 行は**合成 filler 単位の 2 番目以降**として引き続き登場する（§5 参照）。

---

## 2. 確定反撃の候補集合の変遷（§7.2-2）

**変遷なし。段階 C を実施していないため `internal/service/punishfinder/` は diff 0 である。**

**ただし述語に一致する 16 行の実測は取得済み**であり、followup
`punishfinder-standalone-exclusion-redesign`（D-260）の材料として §1.3 の表がそのまま使える。
**除外していたら何が起きたか**は次のとおり:

| 行 | 現在の所在 | 除外していたら |
|---|---|---|
| zangief 連打版 3 行（damage NULL） | 手動確認レーン（`unknown_damage`） | −3（**指示書の想定どおり**） |
| guile `sonic_cross_*` 5 行（`is_projectile=1`） | 手動確認レーン（`distance_dependent`） | −5（**想定外**。正しく手動確認に居る行） |
| kimberly `step_up_*` 3 行（`is_aerial=1`） | `isNonPunishableTarget` で完全除外済み | ±0 |
| **ken 3 行（on_block −3/−5/−3）** | **成立レーン** | **−3（§2.4「成立レーンは不変」に違反）** |
| **m_bison 2 行（JP recovery 10/12）** | **ジャストパリィ時の成立レーン** | **−2（同上）** |

---

## 3. 段階ごとの golden と canary（§7.2-3）

| 測定点 | golden | canary（`37 / 39 / 16`） | filler 候補 | target 候補 |
|---|---|---|---:|---:|
| 着手前 | 4/4 | 37 / 39 / 16 | 1482 | 903 |
| **段階 A 直後** | 4/4 | **37 / 39 / 16（不変）** | **1470** | 903 |
| **段階 B 直後** | **5/5** | **37 / 39 / 16（不変）** | 1470 | **937** |

- **canary の期待値は 1 文字も書き換えていない。** `punishfinder` に触っていないため 3 値とも不変で green。
- **段階 A で canary が動かなかった**ことは、指示書 §4.1 の「段階 A・B では canary が動かないはず」を満たす。
- 版固定の射影（`CANARY_SETPLAY_VERSION=68`）の SHA256:
  - 段階 A 後 `2f9e55468f013e102f8931d2d18eed19f1345cb43fc792cab14670852f31a0ba`
  - 段階 B 後 `1bb97544a48c85458f09d2be27d310e042a6c99dacee3e672c89cb041ce7a0ff`
  - **`FILLER` 行の差分は 0 行**（段階 B が filler を動かしていないことの機械的証明）

### 3.1 target 候補の増減の全数（段階 B）

**解禁 57 行**（全件 `startup_basis='through'`。内訳＝`special` 51 / `unique` 6）:

`guile/sonic_cross_2_meter_od` ／
`jamie/drink_level_4_freeflow_strikes_2hits_{light,medium,heavy,od}` ／
`jamie/drink_level_4_freeflow_strikes_{light,medium,heavy,od}` ／
`jamie/freeflow_strikes_2hits_{light,medium,heavy,od}` ／
`jamie/freeflow_strikes_{light,medium,heavy,od}` ／
`ken/forward_step_kick` ／ `ken/gorai_axe_kick_od` ／ `ken/kasai_thrust_kick` ／
`ken/kasai_thrust_kick_during_od_gorai_axe_kick` ／ `ken/kasai_thrust_kick_during_od_senka_snap_kick` ／
`ken/kazekama_shin_kick_od` ／ `ken/quick_dash_dragonlash_kick` ／ `ken/quick_dash_shoryuken` ／
`ken/quick_dash_tatsumaki_senpu_kyaku` ／ `ken/senka_snap_kick_od` ／ `ken/thunder_kick` ／
`kimberly/elbow_drop` ／ `kimberly/neck_hunter{,_od}` ／ `kimberly/shadow_slide{,_od}` ／
`kimberly/torso_cleaver{,_od}` ／ `luke/fatal_shot` ／ `luke/impaler{,_od}` ／ `luke/no_chaser{,_od}` ／
`m_bison/devil_reverse` ／ `m_bison/head_press` ／ `mai/musasabi_no_mai{,_od}` ／
`manon/grand_fouette_{light,medium,heavy,od}` ／ `marisa/enfold{,_od}` ／ `marisa/procella{,_od}` ／
`marisa/tonitrus_1hit{,_od}` ／ `rashid/backup` ／ `rashid/buffed_tempest_moon` ／ `rashid/tempest_moon`

> **解禁の内訳は 2 系統ある。** 56 行は `is_derived` ゲート側（through 解禁そのもの）。
> **1 行 `kimberly/elbow_drop` だけが `is_derived=0`** で、`is_aerial` → `fastest_unreachable` の
> 切替側で解禁された（`000067` B の裁定＝ジャンプからの通し値）。

**除外 23 行**（**全件 `fastest_unreachable=1`**。理由は一本＝B 型の誤提案の是正）:

`ingrid/solar_burst_lv{1,2,3}_{forward,neutral}{,_od}`（12）／
`jamie/luminous_dive_kick_{light,medium,heavy,od}`（4）／ `juri/shiku_sen{,_od}`（2）／
`kimberly/aerial_bushin_senpukyaku{,_od}`（2）／ `lily/condor_dive{,_od}`（2）／
`ryu/aerial_tatsumaki_senpu_kyaku_od`（1）

> **★素案は +172 行を解禁していた。** `M19-DESIGN-07` §9-4（状態変種 standalone の target 除外は
> **暫定 `is_derived` ゲート継続**）を落としていたためで、`denjin_charge_*` / `mai/flame_*` /
> `m_bison/mine_set_*` / `jamie/drink_level_*` / `lily/windclad_*` 等の状態前提技が一斉に入っていた。
> **実測で検出し、ゲートを §9-4 に合わせて是正した。**

### 3.2 提案結果の変化（指示書 §4.1 の段階 B の測定点）

**候補集合だけでなく提案そのものを測った。** 測定条件は `M19-02` 完了報告 §1.1 の表と同じ
（**juri・KA=40**）＋ **zangief**（チェーングループ員が最多の 6 行＝合成単位が最も増えるキャラ）。
ハーネスは `internal/infra/migration/canary_setplay_perf_test.go`（`SETPLAY_PERF=1` で起動）。

| キャラ | 条件 | `TotalFound` | `truncated` | 所要時間 |
|---|---|---:|---|---:|
| juri | meaty 既定種別 | **550** | false | 3.7ms |
| juri | **meaty 全種別** | **1215** | false | **6.1ms** |
| juri | gap 既定種別 | 591 | false | 4.0ms |
| juri | gap 全種別 | 955 | false | 4.3ms |
| zangief | meaty 既定種別 | 177 | false | 1.4ms |
| zangief | meaty 全種別 | 422 | false | 4.5ms |
| zangief | gap 既定種別 | 269 | false | 2.3ms |
| zangief | gap 全種別 | 689 | false | 3.9ms |

**`DES-002` §4.2 の 2 記述に対する判定**:

| 記述 | 判定 |
|---|---|
| **`engineSafetyCap` 6000 ＝「実データでは非発火の後段防御」** | **維持でよい。** 8 条件すべてで `truncated=false`＝どの target も 6000 に到達していない |
| **性能実測「juri KA40 gap 全種別＝4884 件 / 25.6ms」** | **更新が要る。** 現行の最大負荷は **juri meaty 全種別＝1215 件 / 6.1ms**。NFR001（100ms）に対する余裕はむしろ広がった |

> **★4884 との差を M19-05 の効果と読んではならない。** `M19-02` 完了報告 §1.1 の v1.1.0 注記が
> 「**gap 列の件数は初期 gap 実装（第 1 active 基準）時点の測定値**」「厳密な whiff 定義下の gap 分布が
> 必要な場合は再測定可能」と述べており、**gap の定義確定（完全空振り）後に再測定されていなかった**。
> 本測定はその再測定を兼ねる。**差の主因の切り分けは行っていない**（段階 A 時点のコードが
> 手元に無いため）。
>
> **★ただし meaty は gap の定義変更の影響を受けないため、こちらは M19-05 の増分として読める**——
> **meaty 既定種別 323 → 550（+70%）／meaty 全種別 677 → 1215（+80%）**。
> 合成 filler 単位の追加と through target の解禁（+57 行）による増加である。

**残件導線（`maxLimit` 超過）についての判定** — `M19-overview` §3 の M19-05 の行にある
「**残件導線の再検討**（gap 全種別で `maxLimit(3000) < totalFound(4884)`。through 解禁で件数が
更に増えるため併せて）」の実査結果:

- **現行の最大 `TotalFound` は 1215 であり、`maxLimit`(3000) を超えない。**
- **⇒ 前提が消えたため、本サブでの再検討は不要と判定した。** 「through 解禁で件数が更に増える」
  という見込みは正しかった（meaty 全種別 677 → 1215）が、**gap 側が定義確定で大きく減ったため、
  全体の最大値は `maxLimit` を下回った。**
- **★ただしこれは 17 キャラ時点の値である。** 残り 14 キャラの seed で再び超えうるため、
  **本ハーネスで再測定する運用を申し送る**（`SETPLAY_PERF=1`）。

---

## 4. 費用規則 4 分類のうち実際に発火した分類と件数（§7.2-4）

| 分類 | 条件 | 発火 | 実装上の現れ方 |
|---|---|---|---|
| **1** | 表記用親 → **0** | **発火する** | `through` かつ親参照を持つ **40 行**が対象。前置ステップは `role=parent` / `counted=false` |
| **2** | チェーン隣接 → `chain_cancel_total` | **発火する** | チェーングループ **53 行**（17 キャラ）。合成単位の Total に内包 |
| **3** | target → `startup` | **常時** | 全提案（`through` は通し値のまま） |
| **4** | その他 → `total` | **常時** | 単発 filler・チェーン末端 |

**分類 1 の対象 40 行**の内訳（`through` かつ親参照あり）: jamie 20 ／ ken 6 ／ luke 5 ／ marisa 6 ／
m_bison 2 ／ rashid 1。**うち親が複数なのは m_bison の 2 行だけ**（設計伝達レポート §5）。

---

## 5. 合成 filler 単位の件数と最長の連鎖長 k（§7.2-5）

- **チェーングループ員は 17 キャラ 53 行**（`chain_cancel_total` 非 NULL）。1 キャラあたり 2〜3 行、
  **zangief のみ 6 行**（通常版 3 ＋ 連打版 3）。
- **単位の生成上限は `budgetCap = KA + 2`** で自然に決まる。`maxChainLen = 8` は後段防御であり、
  実データでは予算側の枝刈りが先に効くため到達しない。
- **実用上の最長 k**: グループ員の `chain_cancel_total` は 9〜15F であるため、
  **KA = 60 でも k ≦ 5**（例: ryu なら 9+9+9+9+13 = 49 ≦ 62）。`M19-DESIGN-07` §2-2 の
  「実用上 KA ≦ 60 程度なら高々 5〜6 連」と一致する。
- **ザンギエフ連打版の差し込み**: `standing_light_punch`(cct 15) > `crouching_light_punch_rapid`(total 12)
  ＝ **27**。通常版の屈弱P total 15 を読むと 30 になり実機と合わない——**差し込んだ行自身の値を
  費用規則が読む**ことをテストで固定した。

### 5.1 2 番目以降の候補集合の 2 分岐（裁定 §8.4 条件 (b)）

| 分岐 | キャラ |
|---|---|
| **単独入力不可の員がある**（＝2 番目以降はその集合） | **zangief のみ**（連打版 3 行） |
| **単独入力不可の員が無い**（＝グループ全員） | **他 16 キャラ全部** |

**両分岐とも実データで発生し、両方をテストで対に固定した。**

---

## 6. §5 否定形確認（撤回した定義の残骸の全文走査）

| # | 走査キーワード | 本番コード | テスト資産 | 判定 |
|---|---|---|---|---|
| 1 | `G = 1 - N` ／ `1 − N` | **0 件** | **0 件** | ✅ 残骸なし。設計文書側の言及は「撤回の記録」のみ（除外対象） |
| 2 | `category != 'target_combo'` ／ `<> 'target_combo'` | **0 件**（新述語へ置換済み） | **3 件** | ✅ 3 件とも `rules_m1905_test.go` の**旧規則を意図的に再現した対照群**。コメントで明記 |
| 3 | `startup_basis = 'standalone'` | **0 件** | **17 件** | ✅ 17 件とも**データ状態の件数検証**（M19-04 backfill の確認）であり、「単独入力不可」の判定用途ではない。§5 の注記どおり用途を確認して残置 |

> **★他サブの資産に旧述語が残っている**（`docs/instructions/M19-02-suggestion-refinement.md:170` と
> `docs/instructions/reviews/M19-02-review-checklist.md:51` の
> 「filler 候補 = (total ≥ 1) かつ (category != 'target_combo')」）。
> **本サブでは触らず報告のみ**（他サブの指示書・チェックリストは D-217 の対象外資産）。

---

## 7. §3.1 の実査 2 件（本サブの実装には使わない・設計卓への材料）

### 7.1 (i) 案 α の材料 — `is_derived = 1 AND category != 'target_combo'`

**実測 508 行**（**基準時点** 2026-08-09 / マイグレ v68 / 17 キャラ seed 済み。**一次源＝実 DB の実測**。
**第三波 seed 後の値**）。

> **★Plan Mode で報告した暫定値 505 は誤りである**（`M19-05-COMPLETION-RULINGS` §1-1 の指摘）。
> 暫定値は `character_data/*.csv` だけを数えたもので、**CSV に存在せずマイグレ `000051` が
> `moves` へ直接 INSERT した zangief の連打版 3 行**（`standing_light_punch_rapid` /
> `crouching_light_punch_rapid` / `crouching_light_kick_rapid`。いずれも `is_derived=1` /
> `category='normal'`）を数え落としていた。**本表の 508 が正。**
> ⇒ **「CSV が正本」は値の正本であって行の全数ではない。件数は必ず適用済み DB で数える**
> （設計伝達レポート §9-1b に教訓として登録）。

| category | 件数 |
|---|---:|
| rush_variant | 272 |
| special | 193 |
| unique | 20 |
| super_art | 17 |
| normal | 4 |
| throw | 2 |
| **計** | **508** |

> **★`M19-DESIGN-08` §1.2 の見積り「~250 行（うち target_combo 63、残り ~187）」は 11 キャラ時点の値**
> であり、**実測は残り 508 行＝見積りの約 2.7 倍**である。**案 α（`is_derived` 全体を除外条件にする）の
> 副作用は見積りより大きい。** `rush_variant` 272 行は `is_derived=1` が正常な行である。
> **残り 14 キャラの seed でさらに増える。**

### 7.2 (ii) TP-02 — `chain_cancel_total` が必要になり得る行

**親が子を 2 つ以上持つ行＝28 行**（`(b) 派生先が複数ある` の機械判定分）。
**`(a) 空振りでも派生できる` の判定には一次源の記入欄が要るため、28 行は上限側の母数である。**

| character | 親 `move_code`（子数 / `total`） |
|---|---|
| guile | `sonic_blade_light`(5/42) `sonic_blade_medium`(5/50) `sonic_blade_heavy`(5/54) |
| jamie | `freeflow_strikes_1hit_{light,medium,heavy,od}`(各2 / 38,41,44,38)、`drink_level_4_freeflow_strikes_1hit_{light,medium,heavy,od}`(各2 / 45,48,51,45)、`drink_level_4_ransui_haze_2_retreat`(3/93・`target_combo`) |
| ken | `jinrai_kick_{light,medium,heavy,od}`(各3 / 42,42,46,40) |
| kimberly | `hisen_kick`(3/50) |
| luke | `avenger`(2/45) `avenger_od`(2/45) |
| **m_bison** | **`shadow_rise_light`(4/53) `shadow_rise_medium`(4/58) `shadow_rise_heavy`(4/63) `shadow_rise_od`(2/55)** |
| marisa | `scutum`(3/54) `scutum_od`(3/57) |
| zangief | `standing_light_punch`(3/18) `crouching_light_punch`(3/15) `crouching_light_kick`(3/18)（**実測済**＝15/13/12） |

**指示書 §3.1 (ii) が名指しした m_bison シャドウライズ 4 行（`total` 53/58/63/55）が
実測の親リストと一致した。** zangief 3 行は既に `chain_cancel_total` を持つため、
**未実測の候補は 25 行**である。**D-206（TP-02）の材料はそろっている。**

> **裁定 D-265 により、本件は M19 で閉じず update 波と同波へ送る**
> （followup `tp02-chain-cancel-total-remaining`）。

---

## 8. §3.2 の実査 1 件 — 移動 system move を親に取れるか（§7.2-7 / D-233 / D-264）

### 8.1 「〜から最速で」系の全数（人手判断の記入欄より）

| # | 対象 | 記入欄の文言 |
|---|---|---|
| 1 | rashid `backup` / `tempest_moon` / `buffed_tempest_moon`（3 行） | 「前方ステップから派生。run からも派生できるが、そちらは最速ではないので考えない」 |
| 2 | kimberly `elbow_drop` | 「前提技はジャンプ」（`000067` B で `through` を投入済・**親参照は未付与**） |
| 3 | ken / kimberly の「Quick Dash から最速で」「Sprint から最速で」「ランヴェルセから最速」系 | Phase 2 設計伝達レポート §a が「`startup_basis='through'` の根拠を述べたもので**親子関係の断定ではない**」として親参照の投入対象から外している。**投入 63 対に 1 対も入っていない** |
| 4 | **`ken/thunder_kick`（GC-2 の target）** | 奮迅脚（`quick_dash`）からの通し値 `startup=29`。**同型** |

### 8.2 親候補が移動 system move に一意解決できるか — **混在している**

- `ken/quick_dash` は **`category='unique'`・`total=45`・`damage=0`** であり **system ではない**。
- rashid の「前方ステップ」は `dash_forward` 系＝**`category='system'`**。

**⇒ 「移動 system move かどうか」は判定軸にならない**（裁定 D-264 (2) と一致）。
軸は **`move_derivations` に親として登録されているか**であって `category` ではない。

### 8.3 移動 system move の `total` の持ち方

`dash_forward` / `jump_forward` は `total` を直接保持し、`punishfinder` の `GetMovementTotals` が
既に消費している。**§2.2 の分類 1（表記用親の cost 0）は親の `total` を読まない**——読むのは
子の通し `startup` のみ。**したがって親が移動 move でも分類 1 は成立する。**
親自身の `total` が効くのは、その親を単独 filler として使う分類 4 の場合だけである。

### 8.4 裁定を受けた申し送り（**投入時の必須確認**・D-264 (4)）

**本サブでは親参照を投入していない**（データ変更 0 行）。**update 波で投入する際は次を守ること**:

> **投入対象の `startup_basis` を全数実査し、`'through'` でない行があれば投入せず報告する。**
> ゲート 2 は `startup_basis IN ('standalone','unknown') AND 親参照あり` である。
> **`standalone` / `unknown` の行に親参照を付けると、その行は filler 候補から静かに落ちる。**
> **rashid の 3 行の `startup_basis` は設計卓も製造も未実査である。**

---

## 9. 既知の限界（§7.2-8）

| # | 内容 |
|---|---|
| 1 | **状態前提技はゲート 1 で取りこぼす。** `ryu/denjin_charge_hadoken`（電刃錬気状態が必要）・`ken/thunder_kick`（`quick_dash` 状態が必要）等は `target_combo` 外にあり、`category='target_combo' AND is_derived=1` では捕捉できない（`M19-DESIGN-07` §9-6）。**本サブで解決しない** |
| 2 | **「相手が空中限定」の軸は持たない**（P-18 / D-220）。`ingrid/satelite_leap` 型は偶然除外されているだけ。**解禁 57 行に該当行は増えていない**ことを確認済み |
| 3 | **別の単位に属するチェーングループ員が隣接する解が残る**（設計伝達レポート §6-1・裁定待ち）。**★2026-08-09 の実機確認で、発生箇所が (a) 単発どうし (b) 単発と合成単位の継ぎ目 (c) 合成単位どうしの継ぎ目 の 3 通りあることが判明した**（初出の記述は (a) だけを想定しており狭かった）。**単位の内部は正しい。** 実機実例＝ザンギエフ `屈弱K > 屈弱K > 屈弱P(連打版) > 屈強P`（S=53。正しい版 `屈弱K > 屈弱K(連打版) > 屈弱P(連打版) > 屈強P` は S=46 で別提案として出る）。**同一 KA・同一 target でも `active ≥ 5` なら合成単位（22F）と単発 2 つ（26F）の両方が受理帯に入りうる**——このとき (a) UI に**まったく同じ表記**の行が `N` 違いで 2 行並び (b) `setup_steps` の move_id 列が同一なので **`recipe_hash` も同一**になり、片方を採用するともう片方も `alreadyAdopted` になる。**設計卓が判定法を裁定する材料**（「除去」以外に「同一表記の集約表示」で足りる可能性もある） |
| 4 | **GC-2 の表記は実データでは親（奮迅脚）が前置されない**（設計伝達レポート §6-2）。**★2026-08-09 の実機確認で、フレーム計算側は実データで裏が取れた**——ケンの実表示「立ち弱P > 紫電カカト落とし（持続 3F 目）」は **S=13+29=42・N=3・KA=43** で golden の GC-2 の期待値そのもの。**限界は表記だけに閉じている** |
| 5 | **表記展開で親が複数のとき「昇順先頭」は意味を持たない選択である**（同 §5） |
| 6 | **M19-05 以前に採用済みの setup は、同じ意味のレシピでも `alreadyAdopted` にマッチしない。** 表記展開で親行が入ると `setup_steps` が変わり `recipe_hash` が別値になるため。実害は「同じ意味の setup を二重に採用できてしまう」に留まる（既存データは壊れない）。**CHANGE-094 §4 に追記済み** |
| 7 | **`through` 行の `total` も通し値である**という前提に実装が乗っている（`M19-DESIGN-02` §3「計上は通し `total` 1 つ」）。**`DES-003` §3.3 の `startup_basis` は `startup` の由来しか定義していない**ため、正典だけを読むと `through` の技を単発 filler に使うときの `cost = total` の根拠が辿れない。**反映時に所在を残すこと** |

---

## 10. 守ったガードの所在（§7.2-9 / D-189）と、§2.5 を是正しなかった逐語証跡（D-261）

### 10.1 守ったガード

| ガード | ファイル | テスト名 | 結果 |
|---|---|---|---|
| `m1904PrefixMissed = 2` | `internal/infra/migration/migrate_m1904_test.go:33` | `TestRun_M1904_*` | **無改変で green** |
| canary `37 / 39 / 16` | `internal/service/punishfinder/service_test.go:388-390` | `TestScan_JumpLane_SeedRegression_ExistingJumpHeavyPlusNeutral` | **無改変で green** |
| 成立レーンの不変（`buildStarters` が `Damage == nil` を先にスキップ） | `internal/service/punishfinder/service.go:330` | 同上 ＋ `punishfinder` の diff 0 | **green** |

### 10.2 §2.5（テストの前方一致是正）を実施しなかった逐語証跡

**① 本番コードが部分一致であること**:

```
internal/service/punishfinder/constants.go:26:  const jumpHeavyCodePart = "jumping_heavy_"
internal/service/punishfinder/service.go:353:   strings.Contains(sm.Code, jumpHeavyCodePart) &&
```

**② `neutral_jumping_heavy_kick` を取り落とさないことを固定している既存アサーション**:

```
internal/service/punishfinder/service_test.go:337:  t.Errorf("neutral_jumping_heavy_kick が jump レーンに出ていない")
internal/service/punishfinder/service_test.go:471:  "juri/neutral_jumping_heavy_kick",
internal/service/punishfinder/service_test.go:472:  "ken/neutral_jumping_heavy_kick",
```

`:471-472` は「案 C の増分がちょうどこの 2 件であること」を名指しで検証している
（`:475` で `additions` から delete し、`:477` で残余 0 を要求）。

**③ `HasPrefix` の走査結果（`E-84`＝「見つかった件数」と「検査した件数」の両方）**:

| 指標 | 値 |
|---|---:|
| **検査したファイル数**（`internal/service/punishfinder/*.go` 全数） | **3**（`constants.go` / `service.go` / `service_test.go`） |
| **`HasPrefix` が見つかった件数** | **1**（`service_test.go:432`） |

**その 1 件は「従来 prefix 方式」を意図的に再現した対照群である**（`oldCandidates`）。
部分一致へ「是正」すると `oldCandidates == newCandidates` となり、
**canary 37 と増分検証がまとめて無効化される。** よって是正しなかった（D-261）。

---

## 11. 版固定 canary 測定手段の所在と使い方（§7.2-10 / D-237）

**所在**: `internal/infra/migration/canary_setplay_projection_test.go`
（`punishfinder` 側の `canary_punish_scan_test.go` と対になる）。

**要件の充足**:

| D-237 の要件 | 充足 |
|---|---|
| 版を指定して射影を採取できる | `CANARY_SETPLAY_VERSION=<n>`（未指定なら最新まで）。`newMigrator` + `m.Migrate(n)` |
| SHA256 で突合できる | 出力末尾に `sha256 <全行のハッシュ>` を書く |
| 規則を二重に持たない | `setplay.ProjectCandidates`（**本番と同じ `collectFillerSingles` / `collectTargets`**）を呼ぶ |

**使い方**:

```bash
# 変更前
CANARY_SETPLAY_OUT=/tmp/setplay-before.txt CANARY_SETPLAY_VERSION=68 \
  go test ./internal/infra/migration/ -run TestCanary_SetplayProjection -v
# 変更後(同じ版で採取して diff / sha256 を突合)
CANARY_SETPLAY_OUT=/tmp/setplay-after.txt  CANARY_SETPLAY_VERSION=68 \
  go test ./internal/infra/migration/ -run TestCanary_SetplayProjection -v
diff /tmp/setplay-before.txt /tmp/setplay-after.txt
```

**出力形式**: `FILLER <キャラ> <move_code>` ／ `TARGET <キャラ> <move_code>` ／
`COUNT <キャラ> filler=<n> target=<n>` ／ 末尾に `sha256 <hash>`。

**★次のサブへ**: filler 側と target 側は別行として出るため、
「どちらの候補集合が動いたか」を diff の 1 行目で切り分けられる。

---

## 12. 完了条件の充足

- [x] 段階 A・B がそれぞれ別コミット（`90e1008` / `4dc6205`）。**段階 C は裁定により不実施**
- [x] `go test ./...` が**全パッケージ green**（46 パッケージ・FAIL 0）
- [x] §4 の全要件が green。**golden 5/5**
- [x] `go vet` clean ／ `gofmt -l internal/ cmd/` 出力なし
- [x] **`moves` のデータに diff 0**（`character_data/*.csv` も diff 0）
- [x] **`internal/seedgen/` に diff 0** ／ golden を再生成していない
- [x] **`migrations/` に新規ファイルなし**（`move_derivations` への行追加もなし）
- [x] **`internal/service/punishfinder/` に diff 0**（裁定 §9.2 の追加条件）
- [x] **canary が段階 A・B の前後で不変であることを測って固定**（同）
- [x] **契約 §3.2 と F-1 の解除を使わなかったことを設計伝達レポートに明記**（同）
- [x] **指示書 §4.2-12（比較区間を自サブに閉じる／テストが HEAD 依存になっていないか）の確認**——
      `rules_m1905_test.go` は `dbtest.Setup`（HEAD 適用）ではなく **`m1905Version = 68` へ版を固定**して走る
      （`newMigrator` + `Migrate(68)`）。**HEAD スコープの不変条件をサブ名の名前空間へ相乗りさせていない**
      （`SUPP-001` §5.5.2 (1)(2)）。マイグレを追加していないため比較区間の始端・終端は同一版である
- [x] `docs/progress/progress-log.md` への追記（D-191）
- [x] 設計伝達レポートの提出（§7）
- [x] CHANGE-094 の起票（**採番済**。DES 本体は未編集）
- [ ] **フロントエンドの `lint` / `tsc --noEmit`** — `web/node_modules` が本環境に無く**実行不可**
      （変更は locale JSON 3 キーのみ・JSON 妥当性は検証済み。設計伝達レポート §6-3）

---

*以上、M19-05 完了報告 v1.0.0。*
