# M20-02 完了報告: エイリアス生成規則と実データ投入（`numeric` / `srk`）

| 項目 | 内容 |
|------|------|
| 作業 ID | M20-02 |
| 指示書 | `docs/instructions/M20-02-alias-generation-rules.md` |
| 実施日 | 2026-08-13 |
| 消費マイグレ連番 | **`000070` / `000071` / `000072` / `000073`**（disk 末尾は `000073` へ。次に払い出す番号は `000074`） |
| 結果 | `go test ./...` **全緑（FAIL 0）** ／ `pnpm test` **949 テスト pass（120 ファイル）** ／ `tsc --noEmit` **exit 0** |

---

## ★0. 版の出所（レビュアーへ・最初に読むこと）

**本サブは、指示書 v1.2.0 ／ レビューチェックリスト v1.1.0 相当の差分を会話経由で受領して実装した。ブランチ上の `docs/instructions/M20-02-alias-generation-rules.md` は v1.0.0 のままである。**

- リポジトリ側（設計卓が更新した v1.2.0）を読めば本実装と整合する。
- **ブランチ側の v1.0.0 を読むと、層順・SA 注記・サンプル表の件数について本実装を「指示書違反」と誤判定する。**
- 受領した差分は本報告 §1.2 に全文を転記してある。

---

## 1. 確定した設計判断

### 1.1 開発者裁定（Plan Mode 内・2026-08-13）

| ID | 論点 | 裁定 |
|---|---|---|
| **U-1** | 層 A と層 B の適用順序（指示書 §4.3 と §4.4 の内部矛盾） | **層 B を先行させる**（→ D-1 で原理化） |
| **U-2** | 層 A を `is_derived=true` へ広げるか | **字義どおり非派生のみ。** 派生 281 行は投入せず申し送る |
| **U-3** | SA3 vs CA の同コマンド衝突 | **`numeric` にも注記を入れる**（→ D-5 で書式確定） |
| **U-4** | `DES-004` §3.4 サンプル表の 3 行が生成不能 | **一致検証は 4 行に限定**（→ D-4 で件数確定） |
| **U-5** | `or`(`/`) / `alt_sep`(`\|`) の処遇 | **両方そのまま出す**。層 B へ落とした件数 = **0** |

**U-2 の判断材料（実測）**——派生を層 A へ広げると投入は 809 → 849 行（正味 +40）になるが、**衝突で落ちる非派生行が 84 → 152 行へ増える**。派生技は元技と同じ command を持つため、`guile [[4]6MP]: sonic_boom_medium, perfect_timing_medium_sonic_boom` のように**元技が派生技に巻き添えされて両方落ちる**。**正味 +40 行のために中ソニックブーム・弱ソニッククロス等の元技 68 行が表記を失う**ため、割に合わないと判断した。

### 1.2 設計卓裁定（会話経由で受領・2026-08-13）

| # | 裁定 | 実装状況 |
|---|---|---|
| **D-1** | 層順は 3 接頭辞の例外ではなく**原理**である——「**`command` が表記を決める行は層 A、`move_code` の構造が決める行は層 B**」。迷う行はこの 1 文で判断し根拠を報告する | ✅ §2.1 |
| **D-2** | 境界 3 件を実測する——(a) `rush_` 合成 code ／ (b) **捨てた層 A の値と件数（黙って捨てない）** ／ (c) 3 接頭辞を持たないが地上/空中を区別できない行（**0 件なら「0 件」と書く**） | ✅ §2.3 |
| **D-3** | 残存衝突キーは全件列挙。**注記の適用後に測り直す** | ✅ §5.3 |
| **D-4** | サンプル表の固定点は **4 行・両プリセットで 8 件**（7 行 14 件ではない）。不可 3 行は理由付きで報告 | ✅ §2.4 |
| **D-5** | `numeric` にも `(SA1)`〜`(CA)` を入れる。書式は **`236236P (SA1)`**（半角スペース ＋ 半角丸括弧）。**`move_code` から機械抽出のみ・技名から推測しない。** 適用範囲は実測で決めて理由を報告 | ✅ §2.2 |
| **D-6** | 逆引きへの波及は**記録のみ。実装しない**——正規化は M20-07（D-307）の管轄 | ✅ §7 |

---

## 2. 生成規則

### 2.1 層順の原理（D-1）と、それで判断した迷い行

**「`command` が表記を決める行は層 A、`move_code` の構造が決める行は層 B」。** 3 接頭辞（`standing_` / `crouching_` / `jumping_`）を層 B が先に取るのは例外規定ではなく、この原理の帰結である。

**根拠（CSV 全数実測）**——立ち技と J 攻撃の `command` は同一である。

```
standing_light_punch : command = "p_l"  → token_key = "LP"
jumping_light_punch  : command = "p_l"  → token_key = "LP"
```

**`command` 列は地上/空中を表現していない。その情報は `move_code` 側が持つ。** 層 A を先に当てると (1) `DES-004` §3.4 の `5LP` に一致しない (2) 同 `j.HP` に一致しない (3) 立ち技と J 攻撃が同表記になり同一キャラ内の衝突が **6 キー × 17 キャラ = 102 キー**増える、の 3 つが同時に起きる。

#### 原理で判断した迷い行（★根拠を明記する）

| 行 | 判断 | 根拠 |
|---|---|---|
| `terry/jumping_knee`・`jumping_lariat`（`target_combo`） | **層 B 不成立 → 層 A** | 接頭辞は持つが `knee` / `lariat` は強度・ボタン語彙に無い。**層 B は「接頭辞 ＋ 強度 ＋ ボタン」の完全形にのみ当てる**。接頭辞だけで判定すると誤った表記が付く |
| `zangief/standing_light_punch_rapid` ほか `_rapid` 3 行 | **どの層にも当たらない → 埋めない** | 4 パーツ code で層 B 不成立。`is_derived=true` かつ `command` 空欄で層 A も不成立。**仮に層 B で埋めると元技 `standing_light_punch` と同表記になり衝突する**ため、埋めないのが正しい。★**CSV に存在せず `000051` 由来**のため生成器の入力にも入らない |
| `marisa` / `zangief` の `*_holding` 系 | **層 B 不成立 → 層 A（`(hold)` を保持）** | `standing_heavy_punch_holding` は 4 パーツ code。**計画段階では層 B が取って `(hold)` が落ちると見込んでいたが、実測では落ちない** |
| `c_viper` / `dhalsim`（CSV 無し） | **移動系 9 code のみ投入される** | 移動系は CSV に無く `charOrder` では表せないため、**専用の集合 `movementChars` を渡す**。`000072` / `000073` は適用時点の 19 キャラ全部を渡している（★レビュー H-2 で当初の CROSS JOIN 形から是正。§17） |

### 2.2 SA 注記（D-5）

**書式 `236236P (SA1)`**——半角スペース 1 個 ＋ 半角丸括弧。値は `move_code` から正規表現 `(^|_)(sa[123]|ca)(_|$)` で機械抽出する。**技名（`name_ja`）からは推測しない。**

`super_art` ＋ `critical_art` の **96 行全数**で正規表現の適合を実査確認した（接頭辞を持つ `fuha_sa1_…` / `windclad_sa2_…` / `flame_sa1_…` / `denjin_charge_sa2_…` の 10 行も拾える）。

#### 適用範囲を「`super_art` / `critical_art` 一律」にした理由（★D-5 が実測で決めよと指示した点）

| 案 | 残存衝突キー | 判断 |
|---|---|---|
| **一律（採用）** | numeric 35 / srk 30 | ✅ |
| 衝突組だけに付ける | **同じ**（注記は衝突組にしか効かないため） | ✗ |

**キー数が同じなので、差分は表記の一貫性だけである。** 一律を採った理由 3 点:

1. 衝突組だけに付けると、**同じ SA でもキャラによって注記の有無が変わり表記が不揃いになる**。
2. 衝突の有無を見てから注記するのは「**衝突判定 → 注記 → 再判定**」のフィードバックループになり、**生成器の決定論が崩れる**。
3. 注記があると `236236P` 単体では分からない SA 番号が読み取れ、**表示として自己記述的になる**。

### 2.3 境界 3 件の実測（D-2）

#### (a) `rush_` 合成 code の層判定

**層 C-2 が持ち、層 A / 層 B は当てない。** `rush_*` は `move_code` の構造（元技 code からの合成）が表記を決める行である。`rush_standing_light_punch` は `standing_` で始まらないため層 B に誤って吸われることはないが、**`rush_` 判定を層 B より前に置いて明示した**。全 272 行が `command` 空欄であり層 A にも落ちない（DB 実測）。

#### (b) 層 B が勝ったことで捨てた層 A の値（★黙って捨てない）

| プリセット | 捨てた値の件数 | うち**情報が減る**行 |
|---|---|---|
| `numeric` | **204** | **0** |
| `srk` | **306** | **0** |

- **numeric が 204 なのは、`crouching_*` が層 A も層 B も同じ値（`2LP` 等）になり「捨てる値」が生じないため**（`standing_*` / `jumping_*` の 204 件のみ記録）。**srk は `cr.` 接頭辞で 3 群すべてが層 A と別値になるため 306 件すべてが記録される。**
- **捨てた値の型**: `standing_light_punch` は層 A なら `LP` → 層 B で `5LP`（**情報が増える**）。`jumping_light_punch` は `LP` → `j.LP`（**同**）。
- **★情報が減る行は 0 件である。** 計画段階では `marisa` / `zangief` の `*_holding` 系 8 件で `(hold)` が落ちると見込んでいたが、**実測は 0 件**——`*_holding` は 4 パーツ code（`standing_heavy_punch_holding`）で層 B の完全形に当たらず、**層 A のまま `(hold)` を保持する**。この事実はテストで固定した（`lost != 0` で FAIL）。

#### (c) 3 接頭辞を持たないが地上/空中を区別できない行

**★0 件ではない。18 行ある**（`is_aerial=true` かつ `jumping_` 接頭辞なし）。うち層 A で値が付く非派生は **10 行**:

| キャラ | `move_code` | 層 A の値 | 状態 |
|---|---|---|---|
| `juri` / `ken` | `neutral_jumping_heavy_kick` | `HK` | 衝突せず投入（**空中であることが表記に出ない**） |
| `kimberly` | `elbow_drop` | `2MP` | **numeric で衝突** |
| `lily` | `great_spin` | `2HP` | **numeric で衝突** |
| `marisa` | `caelum_arc` / `caelum_arc_holding` | `2HP` / `2HP(hold)` | **衝突** |
| `rashid` | `blitz_strike` | `2HP` | **numeric で衝突** |
| `rashid` | `aerial_shot` | `8HK` | 衝突せず |
| `zangief` | `flying_body_press` | `2HP` | **numeric で衝突** |
| `zangief` | `flying_headbutt` | `8HP` | 衝突せず |

> **★重要な観察（報告のみ・実装していない）**
>
> **`numeric` の残存衝突のうち `2HP` / `2MP` 系 5 キーはすべて「空中版 vs しゃがみ版」である。** 入力が曖昧なのではなく、**`numeric` 記法が「空中で押した」ことを表現できない**だけである。
>
> **`srk` では同じ組が衝突しない**——`crouching_heavy_punch` = `cr.HP` ／ `flying_body_press` = `2HP` と別値になるため。**`cr.` 接頭辞が偶然この曖昧を解消している。**
>
> **⇒ 該当行を投入せず、観察を添えて報告した**（§9.3-5「規則を調整して衝突を解くか、その行だけ外すかは設計卓が決める。製造は独断で片方を捨てない」）。
>
> **★開発者見解を受領した（2026-08-13）。本報告が当初書いた案とは方向が違うので、そちらを正とする。**
>
> > **「この技だけ `j.` を付けるのはおかしい。通常の技全体に `j` をつけるのが正しそうだ。だがここでやるのはスコープ外なので報告にとどめる。」**
>
> **⇒ 本報告が当初書いた「`is_aerial=true` の行に `j.` を冠する」は、衝突している技にだけ例外的に付ける形に読める。開発者案はそうではなく、空中技全体へ一貫した規則として `j.` を導入するものである。** `followup-backlog` §K `numeric-aerial-vs-crouching-collision` へ登録した。

### 2.4 `DES-004` §3.4 サンプル表（D-4）

**固定点は 4 行 × 2 プリセット ＝ 8 件。** 全件テストで固定済み（`migrate_m2002_test.go` / `generate_m2002_test.go`）。

| `move_code` | `numeric` | `srk` |
|---|---|---|
| `standing_light_punch` | `5LP` | `st.LP` |
| `crouching_light_kick` | `2LK` | `cr.LK` |
| `hadoken_light` | `236LP` | `236LP` |
| `shoryuken_heavy` | `623HP` | `623HP` |

#### ★残る 3 行は原理的に生成できない（理由）

| 行 | 生成できない理由 |
|---|---|
| **`sa1`** | (1) **実在する `move_code` ではない**（ryu の実体は `sa1_shinku_hadoken`）。(2) numeric の期待値 `236236HP` に対し、CSV の `command` は**強度指定のない `p`**（`d dr r d dr r plus p`）であり `236236P` にしかならない。**`HP` はデータから作れない** |
| **`parry_drive_rush`** | `modifiers.type` の**非技ステップ**であり `moves` 行ではない。`preset_aliases` は `move_id` を鍵に持つため入らない（指示書 §4.4 が自認） |
| **`cancel_drive_rush`** | 同上 |

**なお `DES-004` §3.4 自身が「※上記は方針を示すためのサンプルであり、実装時の確定表記ではない」と明記している。**

---

## 3. §3.3 着手前実査 9 項目の結果

一時 DB（全マイグレ適用）＋ `seedgen.ReadFile`（正式パーサ）で実測。

| # | 項目 | 実測 | 判定 |
|---|---|---|---|
| 1 | マイグレ連番 disk 末尾 | **`000069`**（M20-01 が 1 本消費） | ✅ ボード想定と一致。**自採番していない** |
| 2 | M20-01 as-built | `1=official_ja_move` /「公式表記(日本語・技名表示)改善版」／ **`3=numeric`** /「ナンバリング記法」／ **`5=srk`** /「SRK 記法」。`2`・`4` は欠番 | ✅ **§9.3-2 不発動** |
| 3 | `move_commands` 実態 | **894 行**。**空白を含む `token_key` = 0 件 / 検査 894 行**。記号別は下表 | ✅ |
| 4 | OD 技 4 件 | 4 件とも `is_derived=0`・`command` 空欄・`move_commands` 0 件 | ✅ **§9.3-3 不発動** |
| 5 | 28 件の所在 | **ちょうど 28 件**（`special` 22 ／ `unique` 6）。全件 DB に実在 | ✅ 見込みと一致 |
| 6 | `move_code` の構造引き範囲 | DB `normal` = **320**（`standing` 106 / `crouching` 106 / `jumping` 105 / 接頭辞外 3）。CSV は 317 | ⚠ **+3 は zangief の `_rapid` 3 行**（CSV に無い・`000051` 由来） |
| 7 | 「エイリアスは空」を固定した既存テスト | **2 件と見込んでいたが実測 6 箇所**（§6） | ⚠ 差分あり |
| 8 | `preset_aliases` DDL | `id / preset_id / move_id / alias_text NOT NULL`。**UNIQUE は `(preset_id, move_id)` のみ**。`000001` 以降 `ALTER TABLE` は 0 本。行数 official=**1653** / numeric=**0** / srk=**0** | ✅ `DES-003` §3.9 と一致 |
| 9 | seed 波の手順書 | **`character_data/seed-progress.md`**（`precheck_seed_data` が読む進捗表）＋ `docs/seed-data/README.md` | ⚠ `seed_imported` が失効（§8-3） |

### §3.3-3 (b) 記号写像を含む `token_key` の件数（DB 実測）

| 記号 | 由来 | 件数 | **処遇（実測で決めた）** |
|---|---|---|---|
| `[2]` / `[4]` / `[6]` | `charge_*` | 8 / 12 / 0 | **そのまま使う**（テンキー記法で溜めを角括弧で書くのは一般的） |
| `360` | `circle` | 12 | **そのまま使う** |
| `>` | `chain` | 4 | **そのまま使う**（★連結子と同じ記号になる論点は §7） |
| `(hold)` | `hold` | 39 | **そのまま使う**（テンキー記法に溜め押しの記号は無い） |
| `/` | `or` | 18 | **そのまま使う**（U-5） |
| `\|` | `alt_sep` | 3 | **そのまま使う**（U-5） |

**★`or` / `alt_sep` を層 B へ落とした件数 = 0。** 理由——**層 B は通常技の 3 接頭辞しか扱えず、該当行は特殊技・投げなので落としても層 B で埋まらず未充足になるだけ**である。表示としては「1 技に 2 通りの入力がある」ことが読み取れる形で、情報が減らない。

**★見込みからの差**: `(hold)` は指示書の見込み 38 に対し実測 **39**。1 件の差は**静的分析（awk）の列ずれ**によるもので、DB 実測が正しい（§4 参照）。

### その他の実測

- **characters = 19**（`aki` は `000017` で削除済み。`c_viper` / `dhalsim` は CSV を持たないが characters に実在し、移動系 9 code だけを持つ）
- **moves = 1,653** ／ `official_ja_move` = 1,653 ⇒ **フォールバック 3 段目に落ちる行は投入前後とも 0 件**
- **CSV ⇄ DB の moves 差分**: **CSV only = 0 件** ／ **DB only = 174 件**（移動系 9 × 19 = 171 ＋ zangief `_rapid` 3）
- **`is_derived` の CSV ⇄ DB 不一致 = 0 件**
- **★`move_commands.token_key` ⇄ CSV 正規化値の drift = 0 件**（894 行すべて一致）
- `cond{` による索引非搭載 = **3 件**（`guile/sonic_cross_od` / `perfect_timing_sonic_cross_od` / `sonic_cross_2_meter_od`）。**語彙外トークン = 0 件**
- **移動系 9 code の `official_ja_move` alias**: `micro_forward` = **「微歩き(前)」** / `micro_back` = **「微歩き(後)」**（指示書 §4.6 が `numeric`/`srk` に求める `微歩き` / `微下がり` とは別文字列。**意図した重複であり `official_ja_move` は触っていない**）
- **`rush_variant` = 272 行 / `original_move_id` NULL = 4 行**
- **`ALTER TABLE preset_aliases DROP COLUMN` = 動作する**（modernc.org/sqlite v1.50.0 で実測）⇒ `000070` の down はテーブル再作成を要しない
- **`PRAGMA foreign_keys` = 0**（ボード P-04 は生きている）
- **`move_derivations` = 88 行**

---

## 4. ★静的分析（awk）の誤りの訂正

**着手直後の見込み値は `awk -F,` による CSV 静的分析に由来しており、一部が誤っていた。** 原因は **`character_data/marisa.csv` に引用符付きフィールドが 1 つあり、その行以降で awk の列位置がずれていた**こと。**`seedgen.ReadFile`（正式パーサ）が正である。**

| 項目 | awk の見込み | 正式パーサでの実測 |
|---|---|---|
| 非派生の未充足（穴） | 5 行 | **4 行**——すべて OD 技であり §4.2 の補記で **0 件**になった |
| `marisa/sa1_javelin_of_marisa_holding` | `command` 空欄 | **`236236P(hold)` を持つ** |
| `(hold)` を含む `token_key` | 38 | **39** |
| 層 B / 層 A | 306 / 587 | **301・306 / 513・518**（プリセットで違う） |
| 衝突 | 35 キー・84 行（共通） | **35 キー・84 行（numeric）／ 30 キー・74 行（srk）** |
| 捨てた層 A の値 | 314 行・うち 8 行で情報損失 | **204 / 306 行・情報損失 0 件** |

**⇒ 教訓**: **CSV を独自パーサで読まない。** 引用符付きフィールドがあると列がずれ、しかも**ずれた結果がもっともらしい値になる**ため気づけない。正式パーサ（`seedgen.ReadFile`）を通すこと。

---

## 5. 生成カバレッジと一意性の実測

### 5.1 生成カバレッジ（プリセット別・§7.5-2）

| 層 | `numeric` | `srk` |
|---|---|---|
| **層 C-1 移動系**（9 code × 19 キャラ） | **171** | **171** |
| **層 B**（`move_code` 構造引き） | **301** | **306** |
| **層 A**（`command` 正規化 ＋ SA 注記） | **513** | **518** |
| **層 C-2 `rush_variant`** | **260** | **265** |
| **合計（DB 実測）** | **1,245** | **1,260** |
| `alias_text_en` | **38** | **38**（計 76） |

**未充足（穴）＝ 0 件。** OD 技 4 件の補記で解消した（テストで固定済み: `TestM2002_NoUnfilledNonDerivedNonRush`）。

### 5.2 投入しない行（全件の内訳）

| 理由 | `numeric` | `srk` | 説明 |
|---|---|---|---|
| `derived` | 281 | 281 | `command` は持つが `is_derived=true`（U-2 で対象外）。**`cond{` の 3 行もここに含まれる** |
| **`derived-no-command`** | **28** | **28** | ★**D-315 の 28 件**（§6.1 に全件） |
| `no-command`（非派生の穴） | **0** | **0** | |
| `index-skip` | **0** | **0** | |
| `rush-no-original` | 4 | 4 | D-305 の 4 行（§5.4） |
| `rush-original-unfilled` | 8 | 3 | 元技が衝突で落ちた分 |
| **`collision`** | **84** | **74** | §9.3-5 により投入しない（§5.3） |
| **合計** | **405** | **390** | |

### 5.3 §4.11 一意性の実測（4 項目）

| # | 測るもの | 実測 |
|---|---|---|
| **1** | `(preset_id, alias_text)` の重複キー数 | `official_ja_move` **60** ／ `numeric` **124** ／ `srk` **125**。★**想定内**——`5MP` は全キャラで同値になり、移動系 9 code は 19 行ずつ同値になる |
| **2** | `(character_id, alias_text)` の重複 | **714 件**（★測定単位＝**キー単位**。`GROUP BY character_id, alias_text HAVING count(*) > 1` で数えた「重複しているキーの数」であり、行数ではない）。**ただし逆引きが実際に壊れる条件は 0 件**（下記） |
| **3** | 同一キャラ内で 2 技が同表記 | **全プリセットとも 0 件**（★測定単位＝**キー単位**。`HAVING count(DISTINCT moves.code) > 1`）。衝突行を投入していないため |
| **4** | `alias_text_en` の重複 と `alias_text` との交差 | **どちらも 0 件**（★測定単位＝**キー単位**・`count(DISTINCT moves.code) > 1`）。実値は `microwalk` **38 行** / `back microwalk` **38 行** の 2 種のみ |

> **★測定単位の明記（M20-03 への申し送り）。** #2 / #3 / #4 はすべて **`GROUP BY` したキーの数**であり、**行数ではない**。
> **#4 が 0 件なのは `count(DISTINCT moves.code) > 1` で数えているためである**——`micro_forward` は 1 キャラあたり `numeric` / `srk` の **2 行**が `microwalk` を持つので、**行単位で数えれば 0 にはならない**（19 キャラ × 2 プリセット × 2 code = 76 行が 2 種の値を共有する）。
> **同一 move が複数プリセットで同じ値を持つのは設計どおり**であり、逆引き `findMoveCodesByAliasSQL` は `SELECT DISTINCT m.code` でそれを畳む。**壊れるのは「別 move が同表記になった」ときだけ**で、それが #3 = 0 件である。

> **★#2 の 714 件は問題ではない。** 逆引き `findMoveCodesByAliasSQL` は **`SELECT DISTINCT m.code`** であり、`numeric` と `srk` が同値になる特殊技（`236LP` 等）は **1 件に畳まれる**。壊れるのは**別 move が同表記になったとき**だけで、それが #3 = **0 件**である。**M20-03 が一意制約を設計する際は、単純な `(character_id, alias_text)` UNIQUE では 714 件に当たって張れない点に注意されたい。**

#### ★注記適用の前後で測り直した（D-3）

| | 衝突キー | 衝突行 |
|---|---|---|
| **注記なし（推定）** | numeric 52 / srk 47 | numeric 118 / srk 108 |
| **注記あり（実測・採用）** | **numeric 35 / srk 30** | **numeric 84 / srk 74** |

**直接実測**——同一キャラ内で `super_art` / `critical_art` の 2 技が同じ `token_key` を共有する組は **23 組**あった。**うち 17 組が SA3 vs CA（全 17 キャラに 1 組ずつ）で、注記により全数解消した。** 残る 6 組は**同じ SA クラス内**のため注記では解けない（`ingrid` ×2 ／ `kimberly` ×1 ／ `lily` ×1 ／ `mai` ×1 ／ `ryu` ×1）。

#### 残存衝突の全件列挙（`numeric` 35 キー / 84 行）

| キャラ | 表記 | 衝突した技 | 型 |
|---|---|---|---|
| guile | `4LP+LK` | `flying_buster_drop`, `throw_back` | 投げ 2 種が同コマンド |
| guile | `5/6LP+LK` | `flying_mare`, `throw_forward` | 同上 |
| ingrid | `214214P(hold) (SA2)` | `sa2_order_of_the_sun_lv2`, `_lv3` | 同一 SA のレベル違い |
| ingrid | `214HP` | `solar_burst_lv2/lv3_forward/neutral`, `sun_flare_lv2/lv3`（6 技） | 別系統技が同コマンド |
| ingrid | `214LP` | `solar_burst_light_forward/neutral`, `sun_flare_light` | 同上 |
| ingrid | `214MP\|214HP` | `solar_burst_lv1_forward/neutral`, `sun_flare_lv1` | 同上 |
| ingrid | `214P+P` | `solar_burst_*_od` 6 技, `sun_flare_lv1/lv2/lv3_od`（**9 技**） | 同上 |
| ingrid | `236236K(hold) (SA1)` | `sa1_shining_sun_lv2`, `_lv3` | 同一 SA のレベル違い |
| juri | `214K+K` | `fuhajin_od`, `shiku_sen_od` | 別系統技が同コマンド |
| ken | `214K+K` | `aerial_tatsumaki_senpu_kyaku_od`, `tatsumaki_senpu_kyaku_od` | 地上版 vs 空中版 |
| kimberly | `214214P (SA2)` | `sa2_bushin_scramble`, `sa2_soaring_bushin_scramble` | 同一 SA の地上/空中 |
| kimberly | `214K+K` | `aerial_bushin_senpukyaku_od`, `bushin_senpukyaku_od` | 地上版 vs 空中版 |
| kimberly | `236P+P` | `nue_twister_od`, `vagabond_edge_od` | 別系統技が同コマンド |
| **kimberly** | **`2MP`** | `crouching_medium_punch`, `elbow_drop` | **★空中版 vs しゃがみ版（srk では衝突しない）** |
| lily | `236236K (SA2)` | `sa2_soaring_thunderbird`, `sa2_thunderbird` | 同一 SA の地上/空中 |
| **lily** | **`2HP`** | `crouching_heavy_punch`, `great_spin` | **★空中版 vs しゃがみ版** |
| luke | `214P+P` | `aerial_flash_knuckle_od`, `flash_knuckle_od` | 地上版 vs 空中版 |
| mai | `236236K (SA2)` | `sa2_air_chou_hissatsu_shinobi_bachi`, `sa2_chou_hissatsu_shinobi_bachi` | 同一 SA の地上/空中 |
| **marisa** | **`2HP`** | `caelum_arc`, `crouching_heavy_punch` | **★空中版 vs しゃがみ版** |
| marisa | `2HP(hold)` | `caelum_arc_holding`, `crouching_heavy_punch_holding` | 同上（`(hold)` 付き・両プリセットで衝突） |
| marisa | `HK(hold)` | `jumping_heavy_kick_holding`, `standing_heavy_kick_holding` | 立ち vs J（**4 パーツ code のため層 B が当たらない**） |
| marisa | `HP(hold)` | `jumping_heavy_punch_holding`, `standing_heavy_punch_holding` | 同上 |
| rashid | `214HK` / `214LK` / `214MK` / `214K+K` | `arabian_skyhigh_*`, `eagle_spike_*` | 別系統技が同コマンド（4 キー） |
| rashid | `236HK(hold)` / `236LK(hold)` / `236MK(hold)` | `whirlwind_shot_holding_*`, `whirlwind_shot_max_holding_*` | 溜め版 vs 最大溜め版（3 キー） |
| **rashid** | **`2HP`** | `blitz_strike`, `crouching_heavy_punch` | **★空中版 vs しゃがみ版** |
| ryu | `214214P (SA2)` | `sa2_shin_hashogeki_lv1/lv2/lv3`（**3 技**） | 同一 SA のレベル違い |
| ryu | `214K+K` | `aerial_tatsumaki_senpu_kyaku_od`, `tatsumaki_senpu_kyaku_od` | 地上版 vs 空中版 |
| **zangief** | **`2HP`** | `crouching_heavy_punch`, `flying_body_press` | **★空中版 vs しゃがみ版** |
| zangief | `63214K` / `63214K+K` | `russian_suplex`, `siberian_express`（＋ OD） | 別系統技が同コマンド（2 キー） |

**`srk` は上記から ★印の 5 キー（`2HP` ×4・`2MP` ×1）が消えて 30 キー / 74 行になる。**

### 5.4 `rush_variant` の合成（D-311）

- 形は **`DR > <元技の同プリセット表記>`**（例 `DR > 4HP` / `DR > 2HK` / `DR > 2HP`）。全行が `DR > ` で始まることをテストで固定した。
- **`original_move_id` が NULL の 4 行は投入していない**（★推測で元技を当てない）。

| キャラ | `move_code` | CSV の `original_move_code` | **実体** |
|---|---|---|---|
| ingrid | `rush_glowing_touch_1hits` | `glowing_touch_1` | `glowing_touch_1hits` |
| ingrid | `rush_luminous_uppercut_1hits` | `luminous_uppercut_1` | `luminous_uppercut_1hits` |
| lily | `rush_desert_storm_1hits` | `desert_storm_1` | `desert_storm_1hits` |
| mai | `rush_hoshi_kujaku_1hits` | `hoshi_kujaku_1` | `hoshi_kujaku_1hits` |

> **★原因を特定した。** 4 件とも **`original_move_code` の末尾が `hits` を欠いた入力ミス**である（`zangief/rush_power_stomps_1hits` だけは `power_stomps_1hits` で正しく解決している）。**これは規則ではなくデータで直る類**（`D-312` と同型）。**本サブでは CSV を修正していない**——`original_move_code` の是正は `moves.original_move_id` の再解決を伴い、`rush_variant` の親子関係に触れるため本サブのスコープ外と判断した。**設計卓／開発者の判断を仰ぎたい。**

---

## 6. 28 件の全件列挙（§4.8・D-315 / P-34）

**「`is_derived=true` かつ CSV の `command` 空欄 かつ `category != 'rush_variant'`」＝ 調査時点で 28 件。本サブでは投入していない。値は設計卓が決める（P-34）。**

> **★2026-08-13 追記: P-34 の対象は 27 件になった。** 下表 **#8 `lily/windclad_od_condor_spire`** は分類で「**(B) 入力漏れの疑いが濃い**」としていたところ、**開発者確認のうえ `d dr r plus k k` を CSV へ補記した**（§17.2）。**⇒ 28 件のうち 1 件は「値を決める対象」ではなく「データの不備」だった。** 下表は調査時点の記録として 28 行のまま残し、#8 に補記済みの印を付ける。

**分類の凡例**——**(A)** 入力が無いから空欄（前段の技から自動/条件で派生し、プレイヤーが何も押さない） ／ **(B)** 入力があるのに空欄（＝入力漏れ・データ不備） ／ **(不明)** 判断が付かない。

| # | character | `move_code` | category | `name_ja`（official_ja_move） | 派生元（`move_derivations`） | **★分類** |
|---|---|---|---|---|---|---|
| 1 | guile | `sonic_break` | special | ソニックブレイク | — | **(不明)** 名称からは「ソニックブレイド系の派生」に見えるが、`move_derivations` に親が無く、入力の有無を repo 内から判定できない |
| 2 | jp | `departure_shadow_od` | special | ODヴィーハト・チェーニ | — | **(A)** 非 OD 版 `departure_shadow` が `d dl l plus p_h` を持つのに対し本行は空。**ワープ先の分岐であり追加入力を伴わない**と読めるが、`departure_od` が入力を持つため **(不明)** の余地がある |
| 3 | jp | `departure_window_double_warp_od` | special | ODヴィーハト・アクノ(二連続ワープ) | — | **(A)** 「二連続ワープ」は同一入力からの分岐結果と読める |
| 4 | kimberly | `arc_step` | special | 弧空 | — | **(不明)** |
| 5 | kimberly | `arc_step_od` | special | OD弧空 | — | **(不明)** |
| 6 | lily | `condor_dive_follow_up` | special | コンドルダイブ(派生) | — | **(A)** 名称に「(派生)」があり、`condor_spire` 中の派生と読める |
| 7 | lily | `windclad_od_condor_dive_follow_up` | special | ODコンドルダイブ(派生) | — | **(A)** 同上（風纏い版） |
| 8 | lily | `windclad_od_condor_spire` | special | [風纏い]ODコンドルスパイア | — | **✅ (B) 入力漏れと確定 → 2026-08-13 に `d dr r plus k k` を補記済み（P-34 の対象外）。** 同系統の `windclad_{light,medium,heavy}_condor_spire` が `d dr r plus k_*` を持ち OD 版だけ空欄だった。**★同行の `notes_tool` 列の「追加入力（弱中or弱強か中強）で性能変わるがフレーム影響なし」＝任意の 2 キック**が値を裏付けた |
| 9 | m_bison | `psycho_mine_auto_detonation` | special | サイコマイン（自動爆発） | — | **(A)** 「自動爆発」は入力を伴わない |
| 10-12 | manon | `grand_fouette_{light,medium,heavy}` | special | 弱/中/強グラン・フェッテ | — | **(不明)** 強度別に 3 行あるため入力がありそうに見えるが、ランヴェルセからの派生の可能性がある |
| 13-16 | manon | `renverse_feint_{light,medium,heavy,od}` | special | 弱/中/強/ODランヴェルセ(フェイント) | — | **(A)** 「フェイント」は**入力しなかった**結果の分岐と読める |
| 17 | marisa | `enfold_od` | special | ODエンフォルド | **`scutum_od`** | **(A)** スクトゥム（当身）成立後の自動派生 |
| 18 | marisa | `procella_od` | special | ODプロケッラ | **`scutum_od`** | **(A)** 同上 |
| 19 | marisa | `scutum_counterattack` | special | スクトゥム(当身) | — | **(A)** 当身の成立自体が入力を伴わない |
| 20 | marisa | `scutum_counterattack_od` | special | ODスクトゥム(当身) | — | **(A)** 同上 |
| 21 | marisa | `tonitrus_1hit_od` | special | ODトニトルス(単発) | **`scutum_od`** | **(A)** 同上 |
| 22 | marisa | `tonitrus_od` | special | ODトニトルス | — | **(不明)** 親が記録されていない。`tonitrus_1hit_od` には親があるため**記録漏れの疑い** |
| 23-24 | rashid | `buffed_dash_{forward,back}` | unique | 【強化】前方/後方ステップ | — | **(A)** 強化状態での移動であり、入力は移動系 `dash_*` と同じ（別 move にしているのは性能差のため） |
| 25-27 | rashid | `buffed_jump_{forward,neutral,back}` | unique | 【強化】前/垂直/後ろジャンプ | — | **(A)** 同上 |
| 28 | rashid | `wall_jump` | unique | 三角飛び | — | **(不明)** 壁際でのジャンプ入力を伴うはずだが、方向が状況依存で表現しづらい |

> **★分類の要点（開発者の観察 2026-08-12「中には何らかの理由でコマンドを入れていないだけのものもあるかもしれない」への回答）**
>
> - **(B) の疑いが濃いのは #8 `lily/windclad_od_condor_spire` の 1 件のみだった。** 同系統の強度版 3 行が入力を持つのに OD 版だけ空欄であり、**本サブで補記した OD 技 4 件（D-318）と完全に同型**である。**⇒ 規則ではなくデータで直る**——**2026-08-13 に開発者確認のうえ補記し、実際にそのとおりだった**（§17.2）。**分類が当たったことで、残る (不明) 10 件も同種の精査に値することが分かる。**
> - **(A) が 17 件、(不明) が 10 件。** 判断が付かない行は**推測で分類していない**（§9.1）。**⇒ P-34 の対象は (A) 17 ＋ (不明) 10 ＝ 27 件。**
> - **rashid の `buffed_*` 5 件は「移動系 9 code と同じ入力を持つが別 move」**という特殊な型である。**移動系 9 code には §4.6 で固定表記を与えたので、同じ値を与えると衝突する。** P-34 で値を決める際はこの点に留意されたい。

---

## 7. 逆引きへの波及（D-6・★記録のみ・実装していない）

**★M20-07 に正規化が 1 件増える。**

- 取込ヘルパー `FindMoveCodesByAlias`（`internal/repository/preset/queries.go`）は **`alias_text` の完全一致・キャラスコープ・全プリセット横断**で引く。
- 本サブが `super_art` / `critical_art` に付けた注記 **` (SA1)` 〜 ` (CA)`** は `alias_text` の一部である。**⇒ ユーザーが `236236P` と書いても `236236P (SA1)` には完全一致しない。**
- **本サブでは直していない。** 注記除去の正規化は **M20-07（D-307）の管轄**である（指示書 §1.3）。

**もう 1 件、既知の論点を再掲する（§4.7）**——**`rush_variant` の表記 `DR > 2LP` は 1 ステップの表示文字列の中に連結子と同じ `>` を含む。** `DES-004` §4.2 は `numeric` / `srk` とも連結子を `>` と定めており、**逆引きはステップ境界で切ってから完全一致で引くため、切り方を決めないと `DR` と `2LP` に割れる。** **逆引き側の対応は M20-07 が持つ。本サブでは直していない。**

---

## 8. 成果物と判断

### 8.1 消費したマイグレ連番

| 連番 | 内容 | 備考 |
|---|---|---|
| `000070_m20_preset_aliases_add_alias_text_en` | `alias_text_en TEXT` 追加（NULL 可・既定値なし） | down は `DROP COLUMN`（動作を実測） |
| `000071_m20_seed_move_commands_od4` | OD 技 4 件の `move_commands` 追随 | **down は意図的に no-op**（§8.2） |
| `000072_m20_seed_aliases_numeric` | `numeric`（preset_id=3）1,245 行 | 生成器の出力 |
| `000073_m20_seed_aliases_srk` | `srk`（preset_id=5）1,260 行 | 生成器の出力 |

**★4 本に分けた理由**（指示書 §2.1）——列追加・索引データ・`numeric`・`srk` は失敗したときに戻す単位が違う。1 本にまとめると `srk` の生成規則の誤りで列追加まで巻き戻すことになる。**本数を減らす提案はしない。**

### 8.2 ★三点更新を採った判断（適用済みマイグレの再生成）

**OD 技 4 件の `command` を CSV へ補記した結果、golden テスト（`000035` / `000057`）が落ちた。** 対応として **`SUPP-001` §5.5.4 (6) が名前を付けている「三点更新」**——**CSV 正本の是正 → golden 再生成 → 追随マイグレ**——を採った。

**指示書 §2.2 の「適用済みマイグレ——改変しない」と緊張関係にある判断であるため、理由を明記する。**

| 案 | 評価 |
|---|---|
| **(A) 三点更新（採用）** | ✅ golden が緑に戻り、CSV と golden が一致する。`SUPP-001` §5.5.4 (6)(7) が明示的に想定するパターン。**再生成の diff はちょうど 4 行分**（INSERT 4 行 ＋ down の DELETE 列挙 4 code）で、他の行は 1 バイトも変わらない |
| (B) golden を再生成せず放置 | ✗ **golden テストがレッドのまま残る**。「既知の失敗」を作ることは D-308 が禁じている |
| (C) golden テストの期待値を緩める | ✗ **`SUPP-001` が明示的に禁じている**（「期待値を緩めて通してはならない」） |
| (D) CSV を補記しない | ✗ **指示書 §4.2 (i) が CSV への挿入を明示的に要求**している。かつ CSV は正本であり、補記しないと次の再生成で 4 件の command が静かに消える |

**⇒ (B)(C)(D) はいずれも採れないため (A) を採った。** 既存 DB（`v57`〜`v70` で止まっているもの）には golden 再生成が届かないため、**追随マイグレ `000071` を対で入れている。**

**`000071` の down を no-op にした理由**——新規 DB では再生成済みの `000035` / `000057` が同じ 4 行を入れており、**down で DELETE を書くとそれを巻き添えにする**。「up が入れた行だけを消す」ことは down の実行時点では判別できない（どちらの経路で入ったかの記録が DB に無い）。**4 行の掃除は `000035` / `000057` の down が行う**（再生成でどちらの DELETE 列挙にも当該 `move_code` が載っている）。

### 8.3 生成器の配置と実装（§9.2 の「推測で進めてよい事項」）

| 判断 | 採用 | 理由 |
|---|---|---|
| 生成器の配置 | **`internal/seedgen/generate_m2002.go`** | 既存 seedgen が実在するのでそこへ寄せた（指示書 §9.2） |
| CLI 口 | **`cmd/seedgen -mode aliases -preset numeric\|srk`** | 既存の `-mode` 体系に合わせた。`-alias-report` で内訳 Markdown も出せる |
| マイグレ slug | `000072_m20_seed_aliases_numeric` / `000073_m20_seed_aliases_srk` | 指示書 §2.1 の表記に合わせた |
| **§2.3 の例外条項** | **使用した（1 件）** | `token_key` → 表示文字列の変換（SA 注記の付与）を**生成器側**に置いた。**`internal/moveindex` は 1 バイトも改造していない**。正規化自体は `moveindex.Index.Add()` → `Entries()` を通しており再実装していない（「二度作らない」） |
| 再適用時の挙動 | **skip（`NOT EXISTS` ガード）** | upsert にしない＝**既存の表記を書き換えない**。`000025` の先例に倣った |
| 移動系の投入形 | **`movementChars` で明示的に絞る**（up / down とも同じ集合） | ★**当初は `characters` を CROSS JOIN する形にしていたが、レビュー H-2 で是正した**（§17）。移動系は CSV に無く `charOrder` では表せないため、専用の集合を受け取る。`000072` / `000073` は適用時点の 19 キャラ全部を渡している |

### 8.4 §4.9 seed 波ごとの再適用

**`character_data/seed-progress.md` へ「規則の再適用」の節を追記した**（手順・冪等性・`-alias-report` の確認・`-movement-chars` の渡し方・**★移動系 9 code も波ごとの再適用対象である旨**）。

> **★当初は「移動系 9 code は再適用不要」と書いていたが、それは誤りになった。** レビュー **H-2** の修正で `000072` / `000073` を**適用時点の 19 キャラを明示列挙する形**へ変えたため、**新キャラには当たらない**。⇒ **層 A / 層 B / rush 版と移動系のすべてが波ごとの再適用対象である**（§18.4）。**`-movement-chars` には「その波で増えたキャラ」だけを渡すこと**——前の波を混ぜると down が前の波の投入分まで消す。生成器テスト `TestAliases_MovementDownIsScopedToItsOwnChars` が機械的に守っている。

**★あわせて同ファイルの `seed_imported` 列が失効していることを実査で確認した**——`jamie` / `luke` / `m_bison` / `rashid` / `jp` / `marisa` の 6 キャラが「未」と記録されているが、**第三波（`000053` / `000055` / `000057`）で配布 seed へ投入済み**である。同列は「seed 投入工程/開発者が手動更新」と明記されており製造の一存では書き換えないため、**いったん開発者へ回し、裁定を得てから「済」へ是正した**（§18.4）。

---

## 9. §4.12 否定形確認（撤回した仕様の残骸の全文走査）

| # | 走査キーワード | ヒット | **処置** |
|---|---|---|---|
| 1 | `エイリアス空` ／ `空で出荷` ／ `empty as designed` ／ `0 aliases` ／ `alias count = 0` | **4 件**（`migrations/000005` / `000006` / `000011` / `000069`） | **★見つけたが直さない**——すべて**適用済みマイグレ**（§4.12 (a)） |
| 2 | `official_ja_move のみ` ／ `only official_ja_move` ／ `残り 2 プリセット` | 設計文書・ボードのみ | **★見つけたが直さない**——`docs/` 配下の歴史記録と `DES` 本体（同 (b)(c)） |
| 3 | `micro6` ／ `micro4` ／ `micro.f` ／ `micro.b` | **本番コード・テスト資産に 0 件**。ヒットは `docs/process/parallel-board.md`（D-314 / D-321 の裁定本文）と指示書 §4.12 の走査キーワード自身のみ | **★見つけたが直さない**（同 (b)）。**D-321 の造語不採用は実装に反映済み**（`NumericRule` / `SRKRule` に `micro6` 等は存在しない） |

> **★偽陽性の注記**: 本サブが生成した `000072` / `000073` に `-- ===== ingrid (60 aliases) =====` のような行があり、キーワード `0 aliases` に部分一致する。**これは「60 件のエイリアス」の意であり、撤回した仕様の残骸ではない。**

---

## 10. テスト

### 10.1 新設したテスト

| ファイル | 内容 | 本数 |
|---|---|---|
| `internal/infra/migration/migrate_m2002_test.go` | **`TestRun_M2002_*`**（§5.1 (a)〜(g)）。★**比較区間は `v69` → `v73` に閉じる**（`m.Up()` を使わない＝`SUPP-001` §5.5.2 (1)(2)） | **4** |
| `internal/seedgen/generate_m2002_test.go` | 規則の単体（層順・層 B の完全形判定・埋めずに返す・SA 注記・衝突除外・rush 合成・移動系・冪等性・全層通過・SQL 形状） | **10** |
| `internal/seedgen/generate_m2002_golden_test.go` | golden（byte-identical）2 本 ＋ 実測値の固定 1 本 ＋ 穴 0 件の固定 1 本 | **4** |
| `internal/service/notation/resolver_test.go` | `TestRenderSteps_NumericPresetUsesRealData`（**対で新設**。§6 参照） | **1** |

**★`TestRun_M2002_AliasSeed` が固定している主な契約**: 実件数 ／ サンプル表 8 件 ／ 移動系 9 code × 19 キャラ ／ `alias_text_en` 76 行 ／ 上 7 code に en を入れない ／ 派生技のエイリアス 0 件 ／ `rush_variant` が全行 `DR > ` 形 ／ NULL 4 行が未投入 ／ **同一キャラ内の表記衝突 0 件** ／ `official_ja_move` 1,653 行の無改変 ／ フォールバック 3 段目 0 件 ／ down → re-up の往復。

**`TestRun_M2002_NumericOnlyScope`** は `000072` が `srk` を、`000073` が `numeric` を**触らない**ことを片側適用で固定する（両方適用してから数えると検出できない）。

### 10.2 ★破壊テスト 5 件（`SUPP-001` §5.5.2 (10)）

**テストが green であることと、テストが効くことは別である。** 守るはずの違反を実際に入れて FAIL を確認し、撤去後に `git diff` で差分 0 を確認した。

| # | 入れた違反 | 結果 |
|---|---|---|
| 1 | `000070` を `NOT NULL DEFAULT ''` にする | **FAIL**（`notnull = 1, want 0` ＋ `既定値 = "''", want NULL` の 2 件） |
| 2 | `000070` の down を no-op にする | **FAIL**（`down 後も alias_text_en 列が残っている`） |
| 3 | `000070` に一意制約を足す | **FAIL**（`UNIQUE 索引 = [[preset_id alias_text_en] [preset_id move_id]], want [[preset_id move_id]]`） |
| 4 | `000071` の down を DELETE にする | **FAIL**（`down 後に索引が消えた` が 4 件） |
| 5 | `000071` の `NOT EXISTS` ガードを外す | **FAIL**（新規 DB で `UNIQUE constraint failed: move_commands.move_id, move_commands.token_key`） |

### 10.3 自己テスト結果（§7.2）

| 項目 | 結果 |
|---|---|
| `go test ./...` | ✅ **全緑（FAIL 0）** |
| `cd web && pnpm test` | ✅ **949 テスト pass / 120 ファイル** |
| `pnpm exec tsc --noEmit` | ✅ **exit 0** |
| `make e2e` | ✅ **開発者ローカルで全通過**（2026-08-13 開発者報告）。クラウド実行環境では完走できない（§10.4） |
| §5.1 のテスト | ✅ 実在し全て通る（**新設 19 本**） |

### 10.4 ★E2E の扱い（正直な報告）

**`make e2e` はクラウド実行環境（Claude Code on the web）で完走できなかった。** これは **M20-01 の横断課題 4 が既に記録している環境固有の制約**であり、本サブ固有の問題ではない。

- `pnpm exec playwright install chromium` が**ネットワークポリシーで拒否**される（`Failed to download Chrome for Testing 148.0.7778.96 (playwright chromium v1223)`）。
- プリインストール版は **build 1194** で、プロジェクト要求の **1223** と不一致。
- `PW_EXECUTABLE_PATH=/opt/pw-browsers/chromium-1194/chrome-linux/chrome` でブラウザは起動するが、**`combo-crud.spec.ts` / `m12-06-presence-detection.spec.ts` とも 2 件ずつ失敗**した。失敗の形は「エディタ画面の locator 待ちタイムアウト」と「`/wizard` へリダイレクトされた」であり、**エイリアス表記を検証する assertion は 1 つも含まれていない。**

**⇒ 本サブが原因かの切り分けとして、代わりに実アプリで検証した**（§10.5）。

**★2026-08-13: 開発者ローカルで `make e2e` が全通過した**（開発者報告）。**⇒ 本サブによる E2E 回帰は無い。解消済み。** クラウド実行環境の制約そのものは `followup-backlog` §K `cloud-e2e-browser-mismatch` に既登録であり、本サブ固有ではない。

**★表示文字列を固定している spec は実査で 0 件だった**（`numeric` / `srk` を鍵に `web/src` と `web/e2e` を走査。ヒットは型定義・エクスポート画面・presence spec のみで期待値固定なし）。**⇒ 更新した spec の件数 = 0。**

### 10.5 実アプリでの手動確認（E2E の代替）

**`go run ./cmd/combomgr` を使い捨て DB に対して起動**（＝マイグレーションはアプリ起動経路で適用）し、実 DB を直接確認した。

```
-- presets API
[{"id":1,"code":"official_ja_move",...},{"id":3,"code":"numeric",...},{"id":5,"code":"srk",...}]

-- エイリアス件数        official_ja_move = 1653 / numeric = 1245 / srk = 1260
-- サンプル表(numeric)   5LP / 2LK / 236LP / 623HP
-- サンプル表(srk)       st.LP / cr.LK / 236LP / 623HP
-- rush(numeric/guile)   rush_burning_straight -> DR > 4HP ／ rush_crouching_heavy_kick -> DR > 2HK
-- SA 注記(numeric/ryu)  sa1_shinku_hadoken -> 236236P (SA1) ／ sa3_shin_shoryuken -> 236236K (SA3)
                         ca_shin_shoryuken -> 236236K (CA)
-- micro の en(ryu)      micro_forward -> 微歩き / microwalk ／ micro_back -> 微下がり / back microwalk
-- OD 技 4 件の索引      guile/sonic_blade_od -> 214P+P ／ jp/triglav_od -> 22P+P
                         jp/departure_od -> 214P+P ／ lily/condor_spire_od -> 236K+K
```

**★`ryu` の SA 一覧に `sa2_shin_hashogeki_lv1/lv2/lv3` が出ていないのは正しい**——3 技が `214214P (SA2)` で衝突するため投入していない（§5.3）。

---

## 11. 落ちた既存テストとその追随（§4.10・★黙って直さない）

**指示書 §3.3-7 の見込みは 2 件だったが、実測は 6 箇所だった。**

| # | 場所 | 旧主張 | 処置と理由 |
|---|---|---|---|
| 1 | `seedgen/generate_m1702_test.go` golden（`000035`） | 第一波 golden | **再生成**（三点更新・§8.2） |
| 2 | `seedgen/generate_m1403e_test.go` golden（`000057`） | 第三波 golden | **再生成**（同上） |
| 3 | `seedgen/generate_m1403e_test.go` `TestThirdWave_ConversionInvariants` | `empty-command = {jp/triglav_od, jp/departure_od}` | **`{}` へ更新**。補記により索引に載るようになった。**期待値の更新が正しい対応である** |
| 4 | `migration/migrate_m1403e_test.go` | jp `indexRows` **49** ／ 第三波合計 **319** | **51 ／ 321 へ**。索引の母数が正しく増えた形 |
| 5 | `migration/migrate_m1702_test.go` | `move_commands` **530** | **532 へ**。同上 |
| 6a | `repository/preset/repository_test.go` `TestRepository_FindAlias_NotFound` | `numeric` × `standing_light_punch` で nil | **対象 move を `ryu/denjin_charge_hadoken` へ付け替え**。同 move は `is_derived=true` で **U-2 により恒久的に層 A の対象外**であり、「実在プリセット × エイリアス未定義の move」＝フォールバックの入口として安定している |
| 6b | 同 `TestRepository_ListAliasesByPreset_Empty` | `srk` が 0 件 | **`_UnknownPreset` へ作り替え**（関数名も変更）。エイリアス空のプリセットが 1 つも無くなり旧主張は成立しない。**関数を削除せず作り替えた**のは「該当 0 件で空スライスを返す」戻り値の契約自体をテストする価値があるため（★プリセット削除＝M20-04 を実装すると「消えたプリセットの id で引く」経路が実際に生まれる） |
| 6c | `service/notation/resolver_test.go` `TestRenderSteps_FallbackToOfficialJaMove` | `numeric` × `standing_light_punch` → 「立ち弱P」 | **同じく `denjin_charge_hadoken` へ付け替え**。**あわせて `TestRenderSteps_NumericPresetUsesRealData` を対で新設**——付け替えただけだと「numeric に実データが入った」を守る資産が 1 つも無くなるため |

**★#1・#2・#3・#4・#5・#6 のいずれも「テストが壊れた」のではなく「本サブが効いた」形である。期待値を緩めた箇所は 1 つも無い。**

---

## 12. 品質チェック（§7.3）

| 項目 | 結果 |
|---|---|
| §4.12 の否定形確認 3 項目の走査 | ✅ 全項目走査済み（§9） |
| 「見つけたが直さない」場所の明示 | ✅ §9 の 3 系統すべて明示 |
| `console.log` / `fmt.Println` を本番コードに残していない | ✅ **`internal/` に 0 件**。`cmd/seedgen` の `fmt.Println` は CLI の出力であり正当 |
| フロントの変更 | ✅ **1 バイトも変更していない**（`git status web/` が空） |

### 常設検査

| 検査 | 結果 |
|---|---|
| `check-artifact-integrity.sh` | ✅ **違反なし**（2026-08-13 時点）。**当初は `markdown-it-py` 未導入で `check-md-emphasis.sh --self-test` が不合格だったため違反 1 件だったが、開発者承認を得て導入したことで自己検査が通り解消した**（§18.5） |
| `check-md-emphasis.sh`（実データ） | ✅ **現在 375 行 / ベースライン 375 行**（増加なし）。**一時 +1 になっていたが、所在を特定して是正した**（§18.5） |
| `check-doc-refs.sh` | ✅ dead reference なし |
| `check-stop-discipline.sh` | ✅ 違反なし |
| `check-browser-storage-keys.sh` | ✅ 台帳と実装が一致 |
| `check-enum-sync.sh` | ✅ **現在 24 件 / ベースライン 24 件**（増加なし） |
| `check-instruction-format.sh` | ✅ 版数一致（ALLOW 除外 9 件）。禁則表現 **現在 74 件 / ベースライン 74 件**（増加なし） |
| `check-progress-log-index.sh` | ✅ 違反なし |

> **★ベースライン定数は 1 つも書き換えていない**（**D-335**・会話経由で受領・2026-08-13）。**`git diff -- scripts/` は本サブ全体で空**であり、`BASELINE_BROKEN=375` ／ `BASELINE_FORBIDDEN=74` ／ `BASELINE_SCATTER=24` はいずれも原値のままである。
>
> **★なぜ触ってはいけないか**——**M21-01 と並走しており、同じ 1 行を両ブランチが書き換えると、後からマージした側の古い値が勝ってラチェットが黙って緩む。** 定数の更新は**設計卓が両レーンのマージ後に一括で行う**。⇒ 製造は**実測値を報告するだけ**にする（上表がそれである）。
>
> **★本サブは定数の更新自体が不要になった**——`check-md-emphasis.sh` は違反そのものを直して **375（＝ベースライン）へ戻した**ため、設計卓の一括更新で本レーン分の作業は発生しない。

---

## 13. ★併せて更新が要るもの（§7.4.1）

| 対象 | 結果 |
|---|---|
| **消費した CHANGE 番号の registry 登録** | **不要だった**（実査）。**本サブは CHANGE 番号を 1 つも起票していない。** `DES` 本体の改訂を要する事項（§14）は設計卓が起票・登録する |
| **「次の番号」の写し先 4 か所** | **製造の更新対象なし**（設計卓が扱う: registry §1 ／ `m20-contract` §3・§4 ／ board §2.1 ／ board §2.4） |
| **消費したマイグレ連番** | **`000070` / `000071` / `000072` / `000073` の 4 本。** disk 末尾は `000073`、**次に払い出す番号は `000074`**。⇒ **board §2.2 と `change-number-registry.md` の「次マイグレ連番」が更新対象** |
| **版を上げた文書の参照元** | **版を上げた文書は無い。** `character_data/seed-progress.md` は版番号を持たない運用文書であり、追記のみ行った（`grep` で参照元を確認したが版参照は 0 件） |

---

## 14. DES CHANGE の要否判定（§7.4）

**★製造は `DES` 本体・`SUPP-001` を 1 文字も編集していない。**

| 文書・節 | 要否 | 内容 |
|---|---|---|
| **`DES-003` §3.9**（`preset_aliases`） | **要** | **`alias_text_en TEXT NULL` 列の追加**（D-321）。一意制約は本サブでは足していない（M20-03） |
| **`DES-004` §3.4**（サンプル表） | **要** | **3 行が原理的に生成できない**ことの反映（§2.4）。`sa1` は実在 code でなく `236236HP` はデータから作れない ／ `parry_drive_rush` / `cancel_drive_rush` は `preset_aliases` に入らない |
| **`DES-004` §3.4 / §5**（生成規則と解決順序） | **要** | **層順の原理（D-1）** ／ **SA 注記の書式と適用範囲（D-5）** ／ **移動系 9 code の確定値（D-314 改め D-321）** ／ **`rush_variant` の合成形 `DR > <元技>`（D-311）** |
| **`DES-004` §5**（逆引き注記） | **要** | **注記付き `alias_text` は完全一致で引けない**（§7）。対応は M20-07 |
| **`SUPP-001` §3.4**（初期エイリアス戦略） | **要** | 「実データ投入済みは `official_ja_move` のみ」が失効した |

---

## 15. 次のサブへの申し送り

| 宛先 | 内容 |
|---|---|
| **設計卓（P-34）** | **27 件の値を決める**（§6 の全件列挙が入力。★**28 件のうち 1 件は入力漏れだったので補記済み**）。★`rashid` の `buffed_*` 5 件は移動系 9 code と同じ入力を持つため、同じ値を与えると衝突する |
| **設計卓** | **`numeric` の「空中版 vs しゃがみ版」5 キー**をどう解くか（§2.3 (c)）。★**開発者見解＝「通常の技全体に `j` をつけるのが正しそう」**（個別の例外付与ではなく一貫した規則として）。`followup-backlog` §K `numeric-aerial-vs-crouching-collision` に登録済み |
| **設計卓／開発者** | **`original_move_code` の入力ミス 4 件**（§5.4）。**開発者裁定 2026-08-13 で「別サブへ回す」**。`followup-backlog` §K `rush-original-move-code-typo` に登録済み |
| **設計卓** | **★`check-md-emphasis.sh` のベースライン差分は「`git archive <ベースライン commit> docs/` で展開し、判定ロジックだけを直接回して現在の `--list` と突き合わせる」で特定できる**（§18.5 で実証。スクリプトごと回すと `cd` するため失敗する）。**⇒ 一覧の保存は不要。この手順を検査のコメントへ 3 行で書いておくと、次に増えた人が同じ迷路に入らない** |
| **設計卓** | **★ベースライン定数の一括更新（D-335）で、本レーンからの持ち込みは無い。** `check-md-emphasis.sh` は違反そのものを直して **375（＝ベースライン）** へ戻してあり、`check-instruction-format.sh` **74 / 74**・`check-enum-sync.sh` **24 / 24** も増減なし。**`git diff -- scripts/` は本サブ全体で空である** |
| **M20-03（一意制約）** | **§5.3 の実測が設計の入力である。** ★`(character_id, alias_text)` の単純 UNIQUE は **714 件に当たるため張れない**（`numeric` と `srk` が同値になる特殊技があるため）。**`alias_text` と `alias_text_en` の合併集合が一意の単位になる**（D-317） |
| **M20-05** | **`recipe_cache` は 1 バイトも触っていない。** 表示側でロケールに応じて `alias_text_en` を選ぶ実装は M20-05 の領分 |
| **設計卓（★開発者提起 2026-08-13）** | **★プリセットを効かせたい面が M20 の計画に含まれるかの確認**（設計伝達レポート §4-6 が詳細）。**実装を実査したところ、プリセットを選べる面は 2 つだけ**（コンボ詳細のレシピ欄 ／ ウィザード Step04）で、**それ以外の全面は preset id = 1 にハードコード**されている——`model/recipe.go:7`（確定反撃 2 面）／`service/combo/service.go:324`（一覧・比較・エクスポート・ホーム）／`service/setup/service.go:665`（セットプレイ 5 箇所）。**`config.defaults.preset_id` は設定画面で選べるのに表示側で読んでいる箇所が 1 つも無い。** ★**契約 F-3 が `punishfinder` / `setplay` の diff 0 を完了条件にしているため、確定反撃 2 面は M20 の中では原理的に扱えない。** `followup-backlog` §K へ `preset-display-surface-rollout` の登録を依頼 |
| **編集・新規登録（M20-05 or 別サブ）** | **★`web/src/features/combo/utils.ts:63-70` `formatRecipeLine` の前提が本サブで崩れた。** 編集中の steps は**クライアント側で `move.nameJa`（公式日本語）から**組み立てており、その正当化は同関数のコメントにある「**プリセット未実装の現状ではサーバも公式日本語へフォールバックするため実質的に一致する**」である。**`numeric` / `srk` に実データが入ったため一致しなくなった**——編集画面のプレビューと保存後の詳細表示が別物になりうる。**コメント自身が「残課題（設計担当連携）」と自認している** |
| **M20-07** | **正規化が 1 件増える**（§7）。注記 ` (SA1)` の除去 ／ `DR > ` 内の `>` とステップ境界の切り分け |
| **seed 投入工程** | **新キャラ投入時は `-mode aliases` を 2 プリセット分必ず走らせる**（手順は `character_data/seed-progress.md`）。**★移動系 9 code も再適用が要る**（`000072` / `000073` は 19 キャラを明示列挙しており新キャラには当たらない＝レビュー H-2 の是正後）。**`-movement-chars` には「その波で増えたキャラ」だけを渡す**——前の波を混ぜると down が前の波の投入分まで消す |

---

## 16. 未解消のまま停止した項目

**なし。** 本サブの範囲は全て完了した。§15 は「次のサブが持つ」ものであり、未解消の残件ではない。

---

## 17. レビュー指摘の取り込み（Phase C・2026-08-13）

レビュー報告書 `docs/progress/m20-02-review.md`（fresh subagent）の指摘を自動トリアージした。
**「高」2 件はいずれも採用したため、開発者へのエスカレーションは発生していない。**

### 17.1 高（2 件・全件採用）

**H-1. `migrate_test.go` の「numeric = 0 件」テストが未追随＋アサーションが空振り**

**採用。** レビューの指摘は全面的に正しく、**本報告 §11 の 6 件から漏れていた**。3 重の問題だった。

1. **アサーションが構造上空振りだった。** `cases` の構造体は `{query, min, exact, message}` で、ループは `if c.exact != 0 { 厳密一致 } else { n >= c.min }`。当該行は `{..., 0, 0, ...}` すなわち **`n >= 0`** で、**どんな値でも PASS する**。⇒ **落ちなかったので私は気づけなかった。** 指示書 §4.10 #1 が「落ちるべくして落ちる」と想定した仕掛けは、**そもそも落ちる能力を持っていなかった。**
2. **失効したコメントがコード上に残っていた**（「エイリアスを投入するのは M20-02 であり、そのとき落ちることで…『まだ空である』という事実を守る資産として機能する。削除しないこと。」）。
3. **§4.12 の走査から「テスト資産」を取りこぼしていた**（本報告 §9 の項目 1 を「4 件・すべて適用済みマイグレ」としていた）。

**対応**: 当該ケースを `{1245, 1245, "numeric alias count = 1245 (M20-02 で投入)"}` の**厳密一致**へ作り替え、`srk` 側（1260）を対で追加。失効コメントを事実へ書き換え。L927 の `(official_ja_move only)` も除去。**★「`exact == 0` を signal に使う構造上、この表では 0 を期待値にできない」という罠をコメントに残した**（同じ表に 0 期待の行を足すと再発する）。

**★破壊テスト #6 で検査力を裏取り**——期待値を 1244 に変えると `got 1245, want exact 1244` で FAIL する（旧実装ではどんな値でも PASS していた）。

**H-2. 生成器の移動系 `down` がキャラを絞らず、次の seed 波で既存分を巻き添えにする**

**採用。** レビューの指摘どおり、**本サブの成果物である「規則」そのものに埋まった罠**だった。旧実装は移動系を `characters` の CROSS JOIN で全キャラへ投入し、down は `preset_id` と 9 code だけで DELETE していた。up は `NOT EXISTS` で既存キャラを skip する一方 **down は無条件に消す**ため、次の波のマイグレを down すると **`000072` / `000073` が入れた 19 キャラ分（171 行 × 2 プリセット）まで消えた**。`SUPP-001` §5.5.2 (5) に真正面から当たる形である。

**対応（レビュー案 (a) ＋ (b) の合成）**: `GenerateAliases` に **`movementChars []string` を追加**し、**移動系の up と down を同じ集合で絞る**。

- `charOrder` と別にした理由——移動系 9 code は **CSV に存在せず**（`000025` 系マイグレが投入）、**CSV を持たない `c_viper` / `dhalsim` にも投入先がある**ため `charOrder` では表せない。
- `000072` / `000073` は適用時点の **19 キャラ全部**を渡す。**次の波は「その波で増えたキャラ」を渡す**（手順は `character_data/seed-progress.md`）。
- CLI に **`-movement-chars`** を追加（省略時は `-chars` と同じ）。空の場合は**エラーで止める**（静かに 0 キャラ相手の SQL を出さない）。
- **先例 `000025` の down も明示的に絞っている**（`AND (c.code <> 'ryu' OR m.code IN ('forward','back'))`）。私の実装だけが逸脱していた。
- **あわせて L-1（`games.code='sf6'` フィルタの up/down 非対称）も解消**した。

**★回帰テストを新設し、破壊テスト #7 / #8 で裏取り**——`TestAliases_MovementDownIsScopedToItsOwnChars` は波 1（ryu）／波 2（guile）の 2 本を生成し、**移動系ブロックを切り出して**スコープ句の存在と他波キャラの不在を主張する。

> **★最初に書いた回帰テストは弱かった。** 「波 2 の down に波 1 のキャラが現れない」を `strings.Contains` で書いたところ、**スコープ句ごと外す破壊テストがすり抜けた**（句を外すと他波のキャラは「現れない」ため）。⇒ **スコープ句そのものの存在を先に主張する形へ作り替えた。** 破壊テストが無ければ、効かないテストを「回帰テストを入れた」と報告するところだった。

### 17.2 中（5 件・全件採用）

| ID | 指摘 | 対応 |
|---|---|---|
| **M-1** | SA 注記の書式が DB レベルの契約テストで未固定 | **採用**。`m2002SampleTable` に `{"sa1_shinku_hadoken", "236236P (SA1)", "236236P (SA1)"}` を追加。`DES-004` §3.4 の `srk` 欄と一致するため固定点としても正当 |
| **M-2** | `dropCollisions` の非対称（`reserved` 側は落ちない）が暗黙 | **採用**。godoc に明記した。`reserved` に入るのは (1) 移動系 9 code の固定表記 (2) rush 合成時に生き残った基底表記 の 2 つで、**「先に確定しているものが勝つ」という順序規則**であり §9.3-5 が禁じる「衝突した 2 技のどちらを残すかを製造が選ぶ」ではない、と位置づけを書いた |
| **M-3** | 衝突判定の母数に `official_ja_move` が入っていない | **採用**。`seed-progress.md` へ「**`-alias-report` に出ない衝突が 1 種類ある**。マイグレ適用後の `go test ./internal/infra/migration/` まで回すこと」を追記 |
| **M-4** | §4.11 #2 / #4 の測定定義（move 単位か行単位か）が未記載 | **採用**。§5.3 に測定単位（**すべてキー単位**・`count(DISTINCT moves.code)`）を明記。**#4 が 0 件なのは DISTINCT で数えているためで、行単位なら 76 行が 2 種の値を共有する**ことも書いた |
| **M-5** | `saPattern` が当たらない SA 行を数える経路が無い | **採用**。`AliasResult.SAWithoutAnnotation` を新設し、`-alias-report` に専用節を出す。**0 件をテストで固定**（`TestM2002_GenerationMeasurements`）。**★破壊テスト #9 で裏取り**——`saPattern` を `sa[12]` に狭めると `SA 注記が付かなかった … = 17 件, want 0` で FAIL する |

### 17.3 低（6 件）

| ID | 指摘 | 対応 |
|---|---|---|
| **L-1** | 移動系 down に `games.code='sf6'` が無い | **採用**（H-2 と同時に解消） |
| **L-2** | `official_ja_move` 無改変の検査が行数のみ | **採用**。`aliasDigest`（`(move_id, alias_text)` を決定論順序で連結）で内容比較を追加 |
| **L-3** | 付け替え先 `ryu/denjin_charge_hadoken` が U-2 に依存する | **対応不要（現状維持）**。レビュー自身が「主張は弱まっていない・コメントの位置づけを維持すること」としており、依存関係は既に godoc に書いてある |
| **L-4** | `make e2e` の開発者機での完走 | **製造では対応不可**。環境要因（§10.4）。開発者へ申し送り |
| **L-5** | `check-artifact-integrity.sh` の 1 件（`markdown-it-py` 未導入） | **開発者判断へ**。`CLAUDE.md` §6 により新規依存の追加は独断でできない（§12） |
| **L-6** | ブランチ上の指示書を v1.2.0 へ | **設計卓宛**。製造は指示書を編集しない（§0） |

### 17.4 取り込み後の状態

- **破壊テストは計 9 件**になった（当初 5 件 ＋ 取り込みで #6〜#9）。いずれも入れた違反と FAIL メッセージを確認し、撤去後に `diff` で差分 0 を確認済み。
- **`000072` / `000073` を再生成した**（移動系ブロックのスコープが変わったため）。**キャラ別ブロックは 1 バイトも変わっていない**——投入件数は `numeric` 1,245 / `srk` 1,260 のまま。
- `go test ./...` **全緑（FAIL 0）** を再確認。

---

## 18. 開発者裁定の反映（2026-08-13・追補）

**完了報告 §15 で開発者へ回した 5 点のうち、1 点は解消・4 点に裁定を受領した。** 本節はその反映である。

| # | 論点 | 裁定 | 反映 |
|---|---|---|---|
| 1 | `make e2e` 未完走 | **解消**——開発者ローカルで**全通過** | §10.3 / §10.4 |
| 2(b) | `lily/windclad_od_condor_spire` の `command` 空欄 | **`d dr r plus k k` で補記してよい** | §18.1 |
| 2(a) | `original_move_code` の入力ミス 4 件 | **別サブへ回す** | §18.2 |
| 3 | 「空中版 vs しゃがみ版」5 キー | **現状維持 ＋ ★開発者見解あり** | §2.3 (c) / §18.3 |
| 4 | `seed_imported` の失効 | **6 キャラを「済」へ更新してよい** | §18.4 |
| 5 | `markdown-it-py` 未導入 | **devcontainer へ導入してよい** | §18.5 |

### 18.1 `lily/windclad_od_condor_spire` の `command` 補記

`character_data/lily.csv` の `command` を空欄 → **`d dr r plus k k`**。

**値の根拠（3 点・推測ではない）**: (1) 同系統の強度版 3 行が `d dr r plus k_{l,m,h}` ／ (2) 非風纏いの `condor_spire_od` が `d dr r plus k k`（D-318 で補記した 4 件の 1 つ） ／ (3) **★同行の `notes_tool` 列に「追加入力（弱中or弱強か中強）で性能変わるがフレーム影響なし」とある**——**任意の 2 キック**の意であり `k k` と正確に一致する。**CSV 自身が値を裏付けている。**

**★生成物は 1 つも変わらなかった**（実測で確認）。本行は `is_derived=true` であるため:

| 生成物 | 結果 | 理由 |
|---|---|---|
| moves seed | **無変更** | `raw_data` は `notes` / `notes_tool` のみで `command` を含まない |
| `000035` / `000057`（move_commands） | **無変更** | `moveindex` は `is_derived=true` を索引に載せない |
| `000072` / `000073`（preset_aliases） | **無変更** | 層 A は非派生のみ（U-2） |

**⇒ 三点更新も追随マイグレも不要で、CSV 1 行の変更で閉じた。** 変わったのは生成器の分類のみ（`derived-no-command` **28 → 27** ／ `derived` 281 → 282）。テストの期待値を追随させた。

**★D-315 が定めた「28 件」は 27 件になった。** §6 と `progress-log` の索引行を更新済み。

### 18.2 `original_move_code` の入力ミス 4 件 → 別サブへ

`docs/handover/followup-backlog.md` **§K** へ **`rush-original-move-code-typo`** として登録した（§J 停止時記録ではない——未解消のまま停止したのではなく、スコープ外として次サブへ渡すため）。

**★実害を本追補で特定した**: `internal/service/setplay/service.go:144` が `OriginalMoveID == nil` のとき `TargetType` を空にするため、**4 技がセットプレイ自動提案の候補から静かに脱落している**（M19-01 の機能。エラーにならないので気づけない）。

### 18.3 「空中版 vs しゃがみ版」——★開発者見解で方向が変わった

**現状維持**（10 行は `numeric` で日本語技名のまま）。**ただし解き方の方向性が本報告の当初案と違う。**

- **本報告の当初案**: 「`is_aerial=true` の行に `j.` を冠すれば解ける」
- **★開発者見解（正）**: **「この技だけ `j.` を付けるのはおかしい。通常の技全体に `j` をつけるのが正しそうだ」**

**⇒ 衝突している技にだけ例外的に付けるのではなく、空中技全体へ一貫した規則として導入する。** §2.3 (c) を書き換え、`followup-backlog` §K **`numeric-aerial-vs-crouching-collision`** へ登録した。

### 18.4 `seed_imported` の是正

`character_data/seed-progress.md` の `jamie` / `luke` / `m_bison` / `rashid` / `jp` / `marisa` を **未 → 済**。

**★何が困っていたか**: 同ファイル冒頭の**「既配布の保護」**は `seed_imported=済` のキャラを修正対象に含めたとき**警告して停止**する仕組みだが、**「未」のままだと発動しない**。実際には配布済みなので CSV を編集すれば追随マイグレが要る——**本サブで OD 技 4 件を補記して golden が落ち、三点更新が必要になったのがまさにその事象である**。保護は「編集する前に警告する」ためのものなのに、失効していたため**編集後に golden が赤くなって初めて気づく**状態だった。

**あわせて手順書の失効記述 2 件も是正した**（レビュー H-2 の修正で移動系の扱いが変わったのに、手順の一部が旧のままだった）:

- **「移動系 9 code は再適用が要らない」→ 誤り。** `000072` / `000073` は 19 キャラを明示列挙しており新キャラには当たらない。**移動系も波ごとの再適用対象である。**
- 手順のコード例へ **`-movement-chars`** を追加。

### 18.5 ★`markdown-it-py`——常設検査が一度も動いていなかった

**`.devcontainer/Dockerfile` の apt ブロックへ `python3-markdown-it` を追加した**（`CLAUDE.md` §6 の新規依存追加として開発者承認済み）。**pip ではなく apt を採ったのは、Debian/Ubuntu が PEP 668 で `pip install` を既定拒否すること、および本 devContainer の他の依存がすべて apt 経由であるため。**

#### ★判明したこと（本追補で最も報告価値が高い）

**`markdown-it-py` はローカル環境にも入っていなかった**（開発者報告。同じ `ModuleNotFoundError`）。**⇒ クラウド環境固有の穴ではない。**

`check-md-emphasis.sh` は D-319（2026-08-12）で新設され `CLAUDE.md` §8 の常設検査表にも載っているが、**導入手順が `.devcontainer/` にも `postCreateCommand` にも無く、実質どの環境でも一度も実行できていなかった。** スクリプト自身は未導入時に `exit 2` で「未実行」を返す正しい設計（`E-84`）だったため、**`check-artifact-integrity.sh`（★1 本目に回す検査）が恒常的に赤だった。**

#### 導入後に初めて実行した結果

| 検査 | 結果 |
|---|---|
| `check-md-emphasis.sh --self-test` | ✅ **合格**（陽性対照 → 赤 ／ 陰性対照 2 件 → 緑）。**スクリプト自体は正しく動く。依存が無かっただけである** |
| `check-md-emphasis.sh`（実データ） | 導入直後は **376 行 / ベースライン 375 行 ＝ +1**。**★その後に所在を特定して是正し、375（＝ベースライン）へ戻した**（下記） |

**★+1 は本サブ起因ではなかった。** `git diff --name-only 440607d..HEAD -- docs/process docs/handover docs/instructions docs/design docs/change-notes` が**空**であり、**本サブは検査対象ディレクトリを 1 バイトも触っていない**（本サブの文書はすべて `docs/progress/` 配下で、同ディレクトリは検査対象外＝歴史記録）。

#### ★所在を特定して是正した（2026-08-13 追補②・D-335 の受領を機に再挑戦）

当初は「ベースラインが件数だけなので特定できない」と報告したが、**特定できた。手法が悪かっただけである。**

| 試した手 | 結果 |
|---|---|
| ベースライン時点のツリーを materialize し、**スクリプトごと**回す | ✗ 失敗。スクリプトは `git rev-parse --show-toplevel` して `cd` するため、**repo 外のツリーでは走らない** |
| **判定ロジック（`PY_CHECK` の中身）だけを取り出して直接回す** | ✅ **成功**。`git archive <ベースライン commit> docs/ \| tar -x` で展開し、同じ収集条件（5 ディレクトリ・`archive` / `phase1` / `phase2` 除外）で回すと **ちょうど 375 を再現**した ⇒ 手法が忠実であることの証拠 |

**特定結果 ＝ `docs/handover/design-reports/20260812-m20-01-design-exceptions.md:161`。** ベースライン commit（`4cab307`）時点には**存在しなかったファイル**で、**M20-01 の設計伝達レポート**（`43c2c39` で追加）である。**同一行に `**` が 3 個**あり、`… の実在検査（D-313）が` の直後の 1 個が余分だった。**⇒ 余分な 1 個を除去して 375 へ戻した。**

**★「ベースラインに一覧を保存する」までもなく解ける。** 必要なのは **`git archive` でベースライン時点のツリーを出し、判定ロジックだけを直接回す**ことである。⇒ §15 の申し送りを**この手順**へ差し替えた。

**★`docs/handover/followup-backlog.md`（検査対象）へ 2 件登録したが、件数は増えていないことを確認済み。**

---

*以上、M20-02 完了報告。*
