# M19 Phase 2 実装指示書 — フレーム費用 3 列の人手値投入とデータ是正

| 項目 | 内容 |
|------|------|
| 文書ID | **M19-PHASE2** |
| バージョン | **1.0.0**（2026-08-07 新設） |
| 発行 | 親チャット（設計卓） |
| 対象 | 製造担当 Claude Code |
| モデル | **Opus ＋ Plan Mode 必須** |
| 参照してよい先行資料 | **`SUPP-001` §5.5** ／ **`m18-m19-contract.md` §2** ／ **`M19-DESIGN-07`** ／ **`M19-DESIGN-08`** ／ **`DES-003` §3.3**。**★これ以外の指示書・レビューチェックリストを参照しないこと**（D-217） |
| 消費マイグレ連番 | **2 本**（着手時に `ls migrations/` で実査して払い出す。**2026-08-07 時点の末尾は `000063`**） |
| CHANGE | **★起票する**（D-227＝`DES-003` §3.3 の述語の改訂）。番号は着手時に `change-number-registry` で実査 |

---

## §0. 前提と凍結の解除

### 0.1 前提（すべて充足済み）

| # | 前提 | 状態 |
|---|---|---|
| 1 | **M19-04b 完了**（`move_derivations` に 9 行） | ✅ |
| 2 | **M19-04c 完了・受理**（マイグレ `000063`） | ✅ **D-198** |
| 3 | **M19-04d 完了** | ✅ |
| 4 | **人手判断の記入完了**（11 キャラ 160 行 ／ 第三波 158 行） | ✅ |
| 5 | **B-1（CSV 往復検証）完了** | ✅ **D-218**（結果＝差分あり。§2.4 参照） |

### 0.2 ★凍結インターフェースの解除（**この範囲を超えないこと**）

**契約 `m18-m19-contract.md` §2 の F-2 を、以下に限り解除する。**

| 解除する対象 | 行数 | 変更する列 |
|---|---:|---|
| **(a) ken の OD 迅雷脚系** | **6** | `startup` / `active` / `recovery` / `total` |
| **(b) 第三波の記入欄に埋め込まれたフレーム是正** | **15** | `startup` / `active` / `recovery` / `total` / `on_hit` / `on_block` |

**★(b) には契約 F-1 の名指し列 `recovery` と `on_block` が含まれる。** これも解除の対象である。**M19-04c で「F-2 の解除が必然的に F-1 を含んでいた」という記述漏れをしたため、本書では先に書き切る**（D-198／D-199／D-223）。

**★解除は F-1 の新文言（D-199）の 3 条件下で行う**——(a) 是正の一次源が明示され (b) canary の全数差分が説明でき (c) 変更した列と行を設計伝達レポートに明示する。

**★上記 21 行以外の `startup` / `active` / `recovery` / `total` / `on_hit` / `on_block` は 1 行も変更しないこと。**

### 0.3 解除しないもの

- **`is_projectile` / `is_aerial`**（F-1）——**★`is_aerial` の意味が「ラッシュ版を作るか否か」であることが判明しているが、M19 では触らない**（D-222）。
- **`internal/service/punishfinder/` ／ `internal/service/setplay/`**（F-1／F-3）——**本サブはサービス層に触らない。**
- **`internal/seedgen` の SQL 出力**（F-6）——**新列 3 本の「SQL 非投入」は変えない**（D-219）。

---

## §1. スコープ

### 1.1 ★マイグレを 2 本に分ける（D-223）

| 段 | マイグレ | 内容 | 契約 |
|---|---|---|---|
| **①** | `NNNNNN_backfill_frame_cost_manual.up.sql` | `startup_basis` ／ `fastest_unreachable` の人手値投入 ＋ `move_derivations` の親参照追加 ＋ D-187 の 153 行是正 | **値を変えない。F-2 の解除不要** |
| **②** | `NNNNNN+1_correct_frame_values_phase2.up.sql` | **ken 6 行の通し値化 ＋ 第三波の 15 行是正** | **F-2 の条件付き解除** |

**★①の適用直後と②の適用直後で、それぞれ canary（`37 / 39 / 16`）を測ること。** どちらが候補集合を動かしたかを**行単位で切り分けるため**である。**期待値を書き換えて通してはならない**——動いたら増分を全数列挙して報告する。

### 1.2 ①の内容

| # | 対象 | 母数 | 一次源 |
|---|---|---:|---|
| **A** | **`startup_basis` の人手値投入** | **308 行**（11 キャラ 159 ＋ 第三波 149） | `docs/progress/20260802-M19-04-manual-input-list-developer-decision.md` §1 ／ `docs/progress/M19-04b-manual-input-list-thirdwave.md` §1 |
| **B** | **`fastest_unreachable` の人手値投入（B 型）** | **★実査で確定**（11 キャラ 4 行 ＋ 第三波 4 行 ＋ **§1.4 の漏れ分**） | 同 §2 ／ 第三波 §3 |
| **C** | **`startup` が NULL の行の `startup_basis` を `unknown` へ戻す** | **153 行**（既 seed 11 キャラの移動 move 99 ＋ 第三波 54） | ボード **D-187** |
| **D** | **`move_derivations` への親参照追加** | **★実査で確定** | §1.5 |

### 1.3 ★記入値と DB 値の対応

| 記入値 | DB への投入 |
|---|---|
| `standalone` | `startup_basis = 'standalone'` |
| `through` | `startup_basis = 'through'` |
| **`unknown`** | **投入しない**（既定値 `'unknown'` のまま） |
| **`保留`** | **投入しない**（同上） |
| 空欄 | **投入しない** |
| `true` | `fastest_unreachable = 1` |
| `false` | **投入しない**（既定値 `0` のまま） |
| **`非攻撃技`** | **投入しない**（同上。**★`false` と DB 状態は同じだが意味が違う**＝D-207） |

**★`unknown` / `保留` / `非攻撃技` / 空欄はいずれも「投入しない」だが、4 つを同じものとして扱わないこと。** 完了報告では**4 つを別々に数えて報告する**（D-138／D-207）。

### 1.4 ★B 型の対象は機械判別できない（D-225）

**B 型の従来の抽出条件（`is_aerial=1` かつ `code` が `jumping_` を含まない）は不完全である。** 空中から出す必殺技が `is_aerial=0` で入っており、B 型にも C 型にも入らない（根本原因＝D-222）。

**開発者が名指しした 13 系統を一次源とする**（第三波 §3 の 3 番目のブロック）。

| キャラ | 技 | 判定 |
|---|---|---|
| jamie | 無影蹴 | **`true`** |
| rashid | アラビアン・スカイハイ 全強度 | `false` |
| luke | Aerial Flash Knuckle 一律 | `false` |
| ingrid | Solar Burst 弱以外（レベル付も一律） | **`true`** |
| juri | Shiku-sen 一律 | **`true`** |
| ken | Aerial Tatsumaki Senpu-kyaku 一律 | `false` |
| kimberly | **Elbow Drop** | **★`through` として登録されていない疑い。実査すること** |
| kimberly | Nue Twister 一律 | `false` |
| kimberly | Aerial Bushin Senpukyaku 一律 | **`true`** |
| ryu | Aerial Tatsumaki Senpu-kyaku | 弱中強 `false` ／ **OD だけ `true`** |
| lily | condor_dive | **`true`** |
| lily | SA2 Soaring Thunderbird ／ Windclad 版 | **`true`** |

**★「一律」＝強度なし版・弱・中・強・OD のすべて**（開発者の定義）。

**★Plan Mode で、この 13 系統に対応する `move_code` と行数を全数実査し、報告してから着手すること。** **`true` の行だけを投入する。**

**★網羅の保証は無い**（D-225）。**既知の限界として完了報告に明記すること。**

### 1.5 ★`move_derivations` への親参照追加

| 子 | 親 | 行数 |
|---|---|---:|
| m_bison `devil_reverse_od` | シャドウライズ **弱 / 中 / 強 / OD** | **4** |
| m_bison `head_press_od` | シャドウライズ **弱 / 中 / 強 / OD** | **4** |
| **その他** | **★記入欄に「〜から派生」と書かれている行を全数抽出して報告すること**（例＝luke `impaler_od` / `no_chaser_od` は「OD avenger からだけ派生」） | **実査** |

**★親参照は `startup_basis` の人手付与と同一パスで付与される設計である**（`migrate_m1904b_test.go:212`）。**保留の行には付けないこと。**

**★シャドウライズの `move_code` を実査すること。** 弱/中/強/OD の 4 行が存在することは確認済み（開発者実測 2026-08-07）。

### 1.6 ②の内容 — **21 行**

#### (a) ken の OD 迅雷脚系 **6 行**（D-223）

**これはゲームアップデートによる値の変化ではなく、単独値 → 通し値への表現の付け替えである。**

| move_code | 現行（startup/total/basis） | **是正後** |
|---|---|---|
| `kazekama_shin_kick_od` | 6 / 28 / `unknown` | **26 / 3 / 20 / 48 / `through`** |
| `gorai_axe_kick_od` | 17 / 43 / `unknown` | **37 / 3 / 24 / 63 / `through`** |
| `senka_snap_kick_od` | 10 / 33 / `unknown` | **28 / 6 / 18 / 51 / `through`** |
| `kasai_thrust_kick` | 15 / 46 / `unknown` | **45 / 3 / 29 / 76 / `through`** |
| `kasai_thrust_kick_during_od_gorai_axe_kick` | 11 / 42 / `unknown` | **54 / 3 / 29 / 85 / `through`** |
| `kasai_thrust_kick_during_od_senka_snap_kick` | 15 / 54 / `unknown` | **54 / 3 / 37 / 93 / `through`** |

（新値の並びは `startup / active / recovery / total`。一次源＝第三波 §3 の 1 番目のブロック）

**★`jinrai_kick_od`（13/3/25/40/`standalone`）は現行と一致するため変更しない。** 一致することを実査で確認して報告すること。

**★`on_hit` / `on_block` / `damage` も一次源の CSV 行に含まれている。** 現行と突合し、**差がある場合は報告してから判断を仰ぐこと**（本書は `startup` / `active` / `recovery` / `total` のみ解除している）。

**★ノーマル版**（`kazekama_shin_kick` / `gorai_axe_kick` / `senka_snap_kick` / `kasai_thrust_kick`）**は触らない。** 弱中強の迅雷脚から派生するため通し値が一意に決まらず、`unknown` のまま残す（D-206）。

#### (b) 第三波の記入欄に埋め込まれたフレーム是正 **15 行**

**一次源＝`docs/progress/M19-04b-manual-input-list-thirdwave.md` の §1 記入欄と §3。**

| # | character | move_code | 是正内容 |
|---|---|---|---|
| 1 | jamie | `full_moon_kick_drink_and_reach_drink_lv4` | recovery 58 / total 81 |
| 2 | jamie | `phantom_sway_drink_and_reach_drink_lv4` | recovery 61 / total 75 |
| 3 | jp | `departure_window_double_warp_od` | startup 49 / total 87 |
| 4 | luke | `impaler_od` | startup 24 / total 50 |
| 5 | luke | `no_chaser_od` | startup 23 / total 48 |
| 6 | luke | `snapback_combo` | recovery 24 / total 36 |
| 7 | m_bison | `somersault_skull_diver` | startup 12 / **active 10** / **recovery 12** / total 33 ／ **on_hit 8** / **on_block 5** |
| 8 | marisa | `tonitrus` | startup 19 / total 57 |
| 9 | marisa | `tonitrus_od` | startup 19 / total 57 |
| 10 | rashid | `buffed_dash_forward` | total 18 / active 18 |
| 11 | rashid | `wall_jump` | startup 34 / active 42 |
| 12〜15 | jamie | 乱酔旋 4 行 | **§3 の 2 番目のブロックの CSV 行が一次源**（`_2_retreat` / `_3_immediate` / `_3_delay` / `_3_drink_while_retreating`） |

**★Plan Mode で、15 行すべての現行値を実査し、是正前後を対で報告してから着手すること。**

**★`total = startup + active − 1 + recovery` の内部整合を、是正後の全行で検算すること。** 素材が揃わない行（`active` が指定されていない行）は、**現行の `active` を保ったまま検算が成立するかを確認し、成立しなければ報告して止まること。**

### 1.7 ★スコープ外（本サブでは扱わない）

| # | 内容 | 理由 |
|---|---|---|
| 1 | **`m_bison/somersault_skull_diver` の備考** | 「立ち状態の相手にヘッドプレスを当てた後のフレーム」と記載が要るが、**`condition_ja` は SQL 非投入で書き込む場所が無い**（D-152）。**書き込み先の判断は設計卓が別途行う** |
| 2 | **`is_aerial` の意味の是正** | D-222。M19 の外 |
| 3 | **アップデートによる値の更新（A/B/C 層）** | D-208。update 波 |
| 4 | **新規 move 行の追加**（lily 5 行・zangief 1 行・marisa 1 行） | D-212。**Phase 2 の母数が動くため完了後** |
| 5 | **`chain_cancel_total` の追加投入** | D-206。M19-05 の実査後 |
| 6 | **サービス層（`setplay` / `punishfinder`）の変更** | F-1／F-3。M19-05 |

---

## §2. 実装

### 2.1 ★転記は専用スクリプトで行う（CSV へ触る場合）

**手入力ツールで CSV を往復させてはならない**（D-218）。B-1 の実測（2026-08-07）で次が判明している。

- **`fastest_unreachable` が全 1479 行で 空欄 → `false`** に一律書き込みされる（**「未判断」が「確認して届く」に化ける**）
- **列順が入れ替わる**（正は `startup_basis, chain_cancel_total, fastest_unreachable` ＝ `internal/seedgen/model.go:29`）
- 既存 20 列は byte-identical（**この点は問題ない**）

**スクリプトの要件 5 つ**:

1. **RFC4180 準拠のパーサで読む**（`marisa.csv` の `notes` にダブルクォート内カンマがあり、`awk -F,` は誤検知する）
2. **列順を保存する**（ヘッダを書き換えない）
3. **空欄を空欄のまま保つ**（boolean 列でも埋めない）
4. **対象行・対象列以外に 1 バイトも触らない**
5. **実行後に「変更した行数」と「変更した列」を報告し、既存 20 列の差分がゼロであることを機械検証する**

### 2.2 ★DB への投入経路は CSV ではない（D-219）

**`internal/seedgen/csv.go:146` が「新列 3 つ（000049）。保全のみ・SQL 非投入」と明記し、`generate_test.go:82,92` が生成 up SQL に 3 列の値が出ないことを積極的に固定している。**

**⇒ CSV へ書いても DB には届かない。**

| 対象 | 経路 |
|---|---|
| **DB** | **①②の UPDATE マイグレ**（本サブの主作業） |
| **CSV** | **同じ値を保全として書く**（正本としての記録。**seedgen の挙動は変えない**） |

**★`generate_test.go` の「SQL に出さない」を固定するテストは変えないこと。** 変えると golden が動き、M19 の全サブが積み上げた「golden 10 stem green」の証跡が崩れる。

**★CSV への保全書き込みは、①の対象（`startup_basis` / `fastest_unreachable`）に限る。** ②の値是正は既存 20 列なので、**CSV も同時に更新すること**（三点更新）。

### 2.3 ★UPDATE の書き方（契約 F-4 (2')）

**一次源が DB / CSV に無い転記マイグレ**（＝人手判断）は、**1 行 1 UPDATE でキャラクターコードと `move_code` を明示すること**（`SUPP-001` §5.5 (4)）。条件式で束ねると写像の誤りが目視レビューで見えず、**誤ってもエラーにならない。**

**(c) 既存値の保護を必ず入れること**:

```sql
UPDATE moves SET startup_basis = 'standalone'
WHERE character_id IN (SELECT c.id FROM characters c
        WHERE c.code = '<char>' AND c.game_id IN (SELECT id FROM games WHERE code = 'sf6'))
  AND code = '<move_code>'
  AND startup_basis = 'unknown';   -- ★(c) 既存値の保護
```

**★`fastest_unreachable` も同様に `AND fastest_unreachable = 0` を付けること。**

**★C（153 行の `unknown` 戻し）は逆向きである**——`AND startup_basis <> 'unknown' AND startup IS NULL` で限定する。

### 2.4 ★down は up の反転にできない（`SUPP-001` §5.5 (5)）

**up の `AND startup_basis = 'unknown'` を down に持ち込むと 0 行にしか当たらない。** **down は「up が付与した値そのもの」を条件にすること。**

### 2.5 ★改名 3 件の対応表（転記キー）

**記入用コピー上の `move_code` と HEAD の実体が食い違う行がある。** `move_code` 単独で突き合わせると、**記入値が別の技を上書きし、しかもエラーにならない。**

| 記入用コピー上の `move_code` | 記入値 | **HEAD の実体** | `name_ja` | 扱い |
|---|---|---|---|---|
| `sonic_break_light` | standalone | **`sonic_break`** | ソニックブレイク | 読み替えて転記 |
| `sonic_cross_2_meter_od` | standalone | **`perfect_timing_sonic_cross_od`** | 【ジャスト】ODソニッククロス１ | 読み替えて転記 |
| **`sonic_cross_3_meter_od`** | **保留** | **`sonic_cross_2_meter_od`** | **ODソニッククロス２** | **★Phase 2 の対象から外す**（M19-04c が `through` を確定済み） |

**★転記は `move_code` と `name_ja` の対で確認すること。** 3 行目が最も危険——**改名後の `sonic_cross_2_meter_od` は、記入用コピーでは別の技を指す。**

**★`sonic_cross_od`（ODソニッククロス１）は改名していない。** 「改名 3 件」と「`name_ja` 4 行」の差に注意。

---

## §3. Plan Mode 着手前確認（**★全 10 項目を報告してから着手する**）

| # | 確認項目 |
|---|---|
| **1** | **マイグレ連番の実査**（`ls migrations/`）。**2 本を払い出す。予約帯は作らない** |
| **2** | **`startup_basis` の投入対象 308 行の内訳**（キャラ別・`standalone` / `through` / 投入しない〔`unknown` / `保留` / 空欄〕の 4 分類で報告） |
| **3** | **`fastest_unreachable = true` の投入対象の全数**（11 キャラ 4 行 ＋ 第三波 4 行 ＋ **§1.4 の 13 系統に対応する `move_code` と行数**）。**★`kimberly/elbow_drop` の `startup_basis` の現状を併せて報告** |
| **4** | **D-187 の 153 行の実査**（`startup IS NULL AND startup_basis <> 'unknown'` の全数と内訳） |
| **5** | **`move_derivations` の現行 9 行と、追加する親参照の全数**（§1.5。**シャドウライズ 4 行の `move_code` を含む**） |
| **6** | **②の 21 行の現行値**（`startup` / `active` / `recovery` / `total` / `on_hit` / `on_block`）。**是正前後を対で報告する** |
| **7** | **canary の現行値**（`punishfinder` の `37 / 39 / 16`。①②の前後で測るための基準） |
| **8** | **CSV の現状ハッシュ**（17 本。転記スクリプトの前後で突合するため） |
| **9** | **`generate_test.go` の「SQL 非投入」テストが green であること**（変えないことの確認） |
| **10** | **改名 3 件が HEAD で §2.5 のとおりであること**（`move_code` と `name_ja` の対で確認） |

**★1 つでも想定と食い違ったら、実装に入らず報告すること**（`PARENT-E21`＝実行できても目的を達成できないなら、実行せずに報告する）。

---

## §4. テスト要件

**★比較区間は自サブに閉じること**（`SUPP-001` §5.5 (1)）。始端＝①の直前、終端＝②の連番。**`m.Up()`（HEAD 終端）を使わないこと。**

| # | テスト |
|---|---|
| **1** | **①の直前**：`startup_basis <> 'unknown'` の行数が既知の値（M19-04d までの機械付与ぶん）であること |
| **2** | **①の直後**：`startup_basis` が `standalone` / `through` / `unknown` の**3 値に全行が分割**され、合計が `moves` 総数に一致すること。**キャラ別の内訳を固定する** |
| **3** | **①の直後**：**投入した行と投入しなかった行を対で固定する**（`SUPP-001` §5.5 (3)）。**★「投入した件数」だけでは、規則を広く当てすぎても検出できない** |
| **4** | **①の直後**：`fastest_unreachable = 1` の行数と、**`move_code` つきの全数リスト**が固定されること |
| **5** | **①の直後**：`startup IS NULL` の行の `startup_basis` が**全行 `unknown`** であること（D-187） |
| **6** | **①の直後**：`move_derivations` の行数と、**子 `move_code` × 親 `move_code` の対**が固定されること |
| **7** | **②の直後**：21 行の `startup` / `active` / `recovery` / `total` が指定値であること。**1 行 1 アサーションで `move_code` を明示する** |
| **8** | **②の直後**：**21 行以外の `startup` / `total` / `recovery` / `on_block` が 1 行も変わっていないこと**（①の直後のスナップショットと突合） |
| **9** | **down**：①②とも**元の値へ戻ること**。**re-up で復帰すること**。**down のスコープ条件は up の反転にしない**（§2.4） |
| **10** | **★canary の 3 値を、①の直後と②の直後の両方で測る**。**期待値を書き換えて通してはならない。** 動いたら**増分を `move_code` つきで全数列挙して報告する** |
| **11** | **`is_projectile` のガードが不変**（v39 = 104 ／ HEAD 側 = 135。**★両方を書き分けること**——M19-04c で 104 を HEAD 用に転用して一度落ちている） |
| **12** | **`m1904PrefixMissed = 2`（`migrate_m1904_test.go:33`）が期待値そのままで green**（ボード D-189 のガード） |
| **13** | **golden 10 stem green**（`000026` / `000030` / `000034` / `000035` / `000045` / `000046` / `000047` / `000055` / `000056` / `000057`。**M14-03e で 3 本増えている**。★着手時に実査すること） ／ `go run ./cmd/seedgen -check` が `OK`（**新列の SQL 非投入が変わっていないこと**） |

---

## §5. 完了条件

- [ ] マイグレ **2 本**が投入され、`go test ./...` が **全パッケージ green**
- [ ] §4 の **13 テスト**がすべて green
- [ ] **CSV 17 本の既存 20 列の差分**が、**②の 21 行ぶんちょうど**であること（機械検証）
- [ ] **CSV の列順が変わっていないこと**
- [ ] `go vet` clean ／ `gofmt -l internal/ cmd/` 出力なし
- [ ] **`internal/service/` に diff 0**（F-1／F-3）
- [ ] **`docs/progress/progress-log.md` へ追記**（★M19-04b・04c・04d が同じ落ち方をしている）
- [ ] **設計伝達レポートの提出**（§6）

---

## §6. 報告

### 6.1 設計伝達レポート（**必須**）

**`docs/handover/design-reports/YYYYMMDD-m19-phase2-design-exceptions.md`**。

**★§2（契約・設計に反する独自判断）には、§0.2 で解除した 21 行以外の凍結列に触れた場合を必ず書くこと。** 無ければ「なし」と明記する。

**★F-1 の新文言（D-199）の 3 条件を満たす形で書くこと**——(a) 一次源 (b) canary の全数差分の説明 (c) 変更した列と行の明示。

### 6.2 完了報告に必ず載せるもの

| # | 内容 |
|---|---|
| 1 | **`startup_basis` の投入内訳**（キャラ別。**`standalone` / `through` / `unknown` / `保留` / `非攻撃技` / 空欄 を別々に数える**＝D-138／D-207） |
| 2 | **`fastest_unreachable = 1` の全数リスト**（`move_code` つき） |
| 3 | **①の直後と②の直後の canary 3 値**、および**動いた場合の増分の全数**（`move_code` つき） |
| 4 | **`move_derivations` の追加分の全数**（子 × 親） |
| 5 | **②の 21 行の是正前後の対**（全列） |
| 6 | **★既知の限界**——B 型の対象は機械判別できず、開発者の名指しリストが一次源である（D-225）。**網羅の保証は無い** |
| 7 | **★ガードの所在**（ボード D-189）——本サブで守ったガードのファイル名とテスト名 |
| 8 | **★Phase 2 の後に残る `unknown` の行数と内訳**（M19-05 の入力になる） |

### 6.3 ★設計卓へ上げてほしいもの

- **`m_bison/somersault_skull_diver` の備考の書き込み先**（§1.7-1）。
- **§1.6 (a) で `on_hit` / `on_block` / `damage` に差があった場合。**
- **§1.4 の 13 系統で、名指しに対応する `move_code` が見つからなかったもの。**
- **`total` の内部整合が是正後に成立しなかった行。**

---

## §7. 改訂履歴

| 版 | 日付 | 内容 |
|---|---|---|
| 1.0.0 | 2026-08-08 | **配置時の是正**——「golden 7 stem」を **10 stem** へ（2 か所。設計卓が古い数字を写していた）。**配置名は `M19-PHASE2-frame-cost-manual-input.md`。★完了報告と設計伝達レポートは配置前の仮名 `M19-PHASE2-instruction-v1.0.0.md` を参照している**（歴史記録のため変更しない） |
| 1.0.0 | 2026-08-07 | 新設。**マイグレ 2 本構成**（①値を変えない／②F-2 条件付き解除の 21 行）。**新列の投入経路は UPDATE マイグレ**（D-219＝seedgen は SQL 非投入）。**CSV へは手入力ツールの往復を使わず専用スクリプト**（D-218）。**B 型の対象は開発者の名指しリストが一次源**（D-225） |

---

*以上。**参照してよい先行資料はメタ表に限定した**（D-217）。**他サブの指示書・チェックリストを参照しないこと。***
