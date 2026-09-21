# M20-06 完了報告: 命名規則の正典化 ＋ `P-34` 13 件のエイリアス投入

| 項目 | 内容 |
|------|------|
| 作業ID | M20-06 |
| 対象指示書 | `docs/instructions/M20-06-naming-canonicalization.md` **v1.2.0** |
| チェックリスト | `docs/instructions/reviews/M20-06-review-checklist.md` **v1.2.0** |
| 対の CHANGE | `CHANGE-103`（承認済み・未反映） |
| 実施日 | 2026-08-14 |
| 消費マイグレ | **`000076` / `000077` の 2 本**（着手時の disk 末尾実査 ＝ `000075`） |
| 消費 CHANGE 番号 | **なし**（`CHANGE-103` は起票済み・登録済み） |

> **★指示書 v1.2.0 ／ チェックリスト v1.2.0 は開発者から手渡しで受領した。**
> **開発者指示によりリポジトリへコミットしていない**（`docs/instructions/` の diff は 0）。

---

## 1. `§3.3` 着手前の確認（8 項目）

### 1-1. エイリアスの生成・投入・再適用（`§3.3-1`）

| 事項 | 実査結果 |
|---|---|
| 生成規則の実体 | `internal/seedgen/generate_m2002.go`（`numeric` / `srk`）。`official_ja_move` は `internal/seedgen/generate.go` の 2 本立て |
| 投入 | 生成器はランタイムから呼ばれない。出力 SQL をコミットし migration が適用する |
| 単位 | 「1 プリセット × 1 seed 波」＝ マイグレ 1 本。キャラごとに `INSERT` 1 文 ＋ 移動系 9 code 用に 1 文 |
| 再適用責務 | **人が `character_data/seed-progress.md` の手順を走らせる運用**（自動トリガは無い）。`-mode aliases` を 2 プリセット分、`-movement-chars` にその波のキャラだけを渡す |
| 冪等性 | up は `NOT EXISTS` ガードで skip（upsert にしない）。**down は無条件 DELETE** のため、up/down を同じキャラ集合で絞ることが必須（M20-02 レビュー H-2） |
| 形式切替 | `cmd/seedgen/main.go` の `preM2003Stems`（閉じた 6 stem）→ `FormatPreM2003`。新連番は自動的に `FormatCurrent` |
| golden | `generate_m2002_golden_test.go` が実 CSV から再生成して `000072` / `000073` と **byte 一致**を主張 |

### 1-2. 13 件の `move_code` の実在（`§3.3-2`・停止条件 1）

**13 件すべて実在した。「実在しない」は 0 件。** 参考の jp `departure_window_double_warp_od` も実在する（**行は作らない**）。

**14 件すべてが `is_derived=true` かつ `command` 空欄**であり、生成器の `ReasonDerivedNoCommand` に落ちていた。
非 rush の同分類は **27 件**（`D-315` の実測と一致）。

```bash
awk -F, 'FNR>1 && $14=="true" && $18=="" {print $1" "$2}' character_data/*.csv | sort | wc -l   # 299
awk -F, 'FNR>1 && $14=="true" && $18=="" && $3=="rush_variant"' character_data/*.csv | wc -l    # 272
# 299 - 272 = 27（P-34 の母数）
```

### 1-3. 13 件の `name_ja` 実値（`§3.3-3`）

**§2 の全値表を参照。★m_bison の 1 件だけが全角括弧 `（）` である**（他は半角 `()` か `【】`）。
全 1,479 行のうち `name_ja` に全角括弧を含むのは 33 件のみ。**半角へ正規化していない。**

### 1-4. 投入先プリセット（`§3.3-4`・**D-373 で確定**）

| 確認項目 | 結果 |
|---|---|
| (a) `numeric` / `srk` が実在するプリセットとして取れるか | **取れる**。`numeric`(id 3) / `srk`(id 5)。`000069` が 5 種 → 3 種へ整理し、id 2・4 は欠番のまま |
| (b) 13 件が当該 2 プリセットに既存行を持っていないか | **持っていない**（`000072` / `000073` に `move_code` も `name_ja` も 0 件）。**⇒ 停止条件に当たらない** |

**★`official_ja_move` には 13 件すべてに既存行があり、その値は本サブの複製元 `name_ja` そのものであった**
（`generate.go:279` が CSV の `name_ja` を verbatim に投入する。kimberly は `000026`、他 5 キャラは `000055`）。
**⇒ 入れる必要が無く、入れるなら UPDATE になり `§2.2-5` の凍結に触れる。触っていない。**

### 1-5. 一意制約との事前突合（`§3.3-5`・停止条件 2）

**投入前**に `000072` / `000073` の SQL 本文と突合し、**衝突 0 件**を確認したうえで投入した。

```bash
# (1) move_code が既存行を持たないこと
grep -F -c "arc_step\|scutum_counterattack\|buffed_dash_forward\|condor_dive_follow_up\|psycho_mine_auto_detonation\|departure_shadow_od" \
  migrations/000072_m20_seed_aliases_numeric.up.sql migrations/000073_m20_seed_aliases_srk.up.sql   # → 0 / 0
# (2) name_ja が既存の alias_text と重ならないこと（13 件を 1 件ずつ）
for n in 弧空 OD弧空 'コンドルダイブ(派生)' … ; do grep -F -c "'$n'" migrations/00007{2,3}_*.up.sql; done   # → 全て 0
```

| 制約 | 結果 |
|---|---|
| `UNIQUE(preset_id, move_id)` | 衝突 0 |
| `UNIQUE(preset_id, character_id, alias_text)` | 衝突 0 |
| 部分 `UNIQUE(preset_id, character_id, alias_text_en) WHERE NOT NULL` | 衝突 0 |
| `D-317` の交差（`alias_text` ＝ 別技の `alias_text_en`） | 衝突 0 |

**`D-337` が懸念した rashid 第 3 枠の衝突は起きない**——`buffed_*` の基底となる移動技（`dash_forward` 等）は
**CSV に 1 件も存在せず**、`【強化】` 接頭辞もあるため同名行が無い。全 17 CSV でファイル内 `name_ja` 重複は 0 件。

**適用後の実 DB でも 4 本すべて 0 件を再確認した**（`TestRun_M2006_UniqueIndexesIntact`）。

### 1-5b. `§4.5` `alias_text_en` は組み込みプリセット専用（**確認のみ・実装変更なし**）

**`M20-04` の as-built が既にこの形であることを実地で確認した。実装は 1 行も変えていない。**

| 経路 | `alias_text_en` を書くか | 実体 |
|---|---|---|
| **作成（コピー）** | **複製する**（意図どおり） | `copyAliasesSQL`（`internal/repository/preset/queries.go`）が `alias_text_en` と `character_id` を明示列挙 |
| **更新** | **書かない** | `updateAliasTextSQL` は `SET alias_text = ?` のみ。`character_id` も `alias_text_en` も触らない |
| **サービス層** | **フィールドが無い** | `presetsvc.AliasUpdate` は `MoveID` / `AliasText` のみ |
| **API DTO** | **書き込み不可** | `AliasUpdateRequest` は `moveId` / `aliasText` のみ。読み出し `AliasResponse` にのみ存在 |
| **フロント** | **入力欄が無い** | `UpdatePresetInput` は `{ name?, aliases?: { moveId, aliasText }[] }`。`PresetAliasEditor.test.tsx` が「編集欄を作らない」ことをテストで固定済み |

**⇒ 「複製で引き継いだ値をそのまま持つ」は成立し、「利用者が英語側を書き換える導線」は存在しない**（`D-368` の割り切りどおり）。
**理由を `DES-005` §5.11 へ書くのは設計卓の手番。**

### 1-6. `alias_text_en` が非 NULL の既存行（`§3.3-6`）

| 時点 | 件数 |
|---|---|
| 本サブ適用前（v75） | **76 行**（`micro_forward` / `micro_back` × 19 キャラ × 2 プリセット） |
| **本サブ適用後（v77）** | **102 行**（+26） |

プリセット別の内訳（適用後）＝ `official_ja_move` **0** ／ `numeric` **51** ／ `srk` **51**
（51 ＝ 移動系 38 ＋ 層 C-3 の 13）。

### 1-7. レシピ表記の解決が `preset_id` ごとか（`§3.3-7`・停止条件 3）

**引かれている。`§4.3` は既存構造だけで満たされる。**
`internal/service/notation/resolver.go:76-126` が `findAliasSQL`（`WHERE preset_id = ? AND move_id = ?`）で
当該プリセットを引き、`DES-004` §5.3 の 3 段フォールバックも実装済みである。

**技名（`name_ja`）の表示経路は `§1.3-8` によりスコープ外**（`repository/move` / `repository/punish` が
`official_ja_move` をリテラル固定で JOIN している）。**本サブが増やす 13 件はこの経路に出ない**——
投入先は `numeric` / `srk` であり、技名表示が引いているプリセットではない。
**⇒ 停止条件 3 には当たらない**（`D-372` の再確認。開発者裁定 2026-08-14）。

### 1-8. `(ラッシュ)` 接尾辞の実データ実査（`§3.3-8`）

**§3 を参照。**

---

## 2. 投入した全値（`§7.5-2`）

**★`move_code` の数は 13、投入した行数は 26 である**（13 × 2 プリセット）。
`numeric` と `srk` は同じ値を持つ——値の規則が `name_ja` の複製と `move_code` の整形であり、
プリセットの語彙を使わないためである。

| # | character | `move_code` | `alias_text`（＝ CSV の `name_ja`） | `alias_text_en` |
|---|---|---|---|---|
| 1 | jp | `departure_shadow_od` | `ODヴィーハト・チェーニ` | `departure shadow OD` |
| 2 | kimberly | `arc_step` | `弧空` | `arc step` |
| 3 | kimberly | `arc_step_od` | `OD弧空` | `arc step OD` |
| 4 | lily | `condor_dive_follow_up` | `コンドルダイブ(派生)` | `condor dive follow up` |
| 5 | lily | `windclad_od_condor_dive_follow_up` | `ODコンドルダイブ(派生)` | `windclad OD condor dive follow up` |
| 6 | m_bison | `psycho_mine_auto_detonation` | `サイコマイン（自動爆発）` ← **全角括弧** | `psycho mine auto detonation` |
| 7 | marisa | `scutum_counterattack` | `スクトゥム(当身)` | `scutum counterattack` |
| 8 | marisa | `scutum_counterattack_od` | `ODスクトゥム(当身)` | `scutum counterattack OD` |
| 9 | rashid | `buffed_dash_back` | `【強化】後方ステップ` | `buffed dash back` |
| 10 | rashid | `buffed_dash_forward` | `【強化】前方ステップ` | `buffed dash forward` |
| 11 | rashid | `buffed_jump_back` | `【強化】後ろジャンプ` | `buffed jump back` |
| 12 | rashid | `buffed_jump_forward` | `【強化】前ジャンプ` | `buffed jump forward` |
| 13 | rashid | `buffed_jump_neutral` | `【強化】垂直ジャンプ` | `buffed jump neutral` |

**`od` トークンは 4 か所ある**——末尾 3 件（#1 / #3 / #8）＋ **語中 1 件**（#5 の `windclad_od_...`）。
いずれもトークン完全一致で `OD` へ大文字化しており、同じ規則で処理されている。
**`condor_dive_follow_up` の `condor` は大文字化していない**（部分一致にしていないことの確認）。

### 2-1. 値を「表」に持たせていない（実装の要点）

**固定表 `noInputDerivedTargets`（`internal/seedgen/generate_m2002.go`）が持つのは 13 件の
`(character, move_code)` の集合だけであり、値は持たない。**

- `alias_text` … CSV の `NameJA` をそのまま複製
- `alias_text_en` … `humanizeMoveCode(move_code)` で整形

**⇒ 「新しい情報を作らない」がコード上でも成立する。** 値を表へ書くと、CSV の `name_ja` が直ったときに
表だけが古くなる（`E-76` と同型）。**固定表は 1 か所にしかない。**

---

## 3. `§4.4` `(ラッシュ)` 接尾辞の実査結果

**数え方**——`character_data/*.csv` のデータ行（ヘッダ除く）のうち `category == "rush_variant"` の**行数**。
**1 行 ＝ 1 技（＝ 1 `move_code`）。** 基準時点は 2026-08-14 の作業ツリー。

| 主張 | 実測 |
|---|---|
| `rush_variant` の総数 | **272 件** |
| `name_ja` が半角 `(ラッシュ)` で終わる | **272 / 272 件（100%）**。全角 `（ラッシュ）` は 0 件 |
| `original_move_code` の指す元技の `name_ja` ＋ `(ラッシュ)` と厳密一致 | **268 / 272 件** |

```bash
awk -F, 'FNR>1 && $3=="rush_variant"' character_data/*.csv | wc -l                       # 272
awk -F, 'FNR>1 && $2 ~ /^rush_/' character_data/*.csv | wc -l                            # 272（接頭辞とも一致）
awk -F, 'FNR>1 && $2 ~ /^rush_/ && $3!="rush_variant"' character_data/*.csv | wc -l      # 0
awk -F, 'FNR>1 && $3=="rush_variant" && $4 ~ /\(ラッシュ\)$/' character_data/*.csv | wc -l  # 272
awk -F, 'FNR>1 && $3=="rush_variant" && $4 !~ /\(ラッシュ\)$/' character_data/*.csv        # 0 件
```

### 3-1. ★残る 4 件の正体

**命名の揺れではない。** `original_move_code` が**実在しない `move_code` を指す dangling 参照**
（`_1hits` とすべきところが `_1`）であり、**元技を解決できないため突合できないだけ**である。

| # | file | `move_code` | `original_move_code` | 実在する正しい元技 |
|---|---|---|---|---|
| 1 | `ingrid.csv` | `rush_glowing_touch_1hits` | `glowing_touch_1` ← 不存在 | `glowing_touch_1hits` |
| 2 | `ingrid.csv` | `rush_luminous_uppercut_1hits` | `luminous_uppercut_1` ← 不存在 | `luminous_uppercut_1hits` |
| 3 | `lily.csv` | `rush_desert_storm_1hits` | `desert_storm_1` ← 不存在 | `desert_storm_1hits` |
| 4 | `mai.csv` | `rush_hoshi_kujaku_1hits` | `hoshi_kujaku_1` ← 不存在 | `hoshi_kujaku_1hits` |

**この 4 件は生成器のコメント（`generate_m2002.go` の rush 合成部）が既に把握している同じ 4 件である**
（`ReasonRushNoOriginal`。DB 側でも `original_move_id` が NULL）。

**⇒「揺れ 0 件」と「268/272」は両立する。** 前者は**接尾辞の形**の話、後者は**元技参照の解決可否**の話であり、軸が違う。

### 3-2. 副次的に見つかった 1 件（**`D-305` により補正しない・報告のみ**）

`_1` → `_1hits` に読み替えて再突合すると、**残る本物の不一致は lily `rush_desert_storm_1hits` の 1 件**である。

- `name_ja` ＝ `デザートストーム(ラッシュ)`
- 元技 `desert_storm_1hits` の `name_ja` ＝ `デザートストーム(単発)`
- 規則どおりなら `デザートストーム(単発)(ラッシュ)` になる

lily には `desert_storm`（target_combo・`デザートストーム`）と `desert_storm_2hits`（`デザートストーム(2発止め)`）も
実在するため紛らわしい。**★`D-305` は不変であり、本サブでは直していない。**

> **★設計書の文案は作っていない**（`§4.4` 末尾）。上記は実測の報告であり、`DES-004` §3.2 へ何をどう書くかは設計卓の手番である。

---

## 4. `§4.6` 連鎖・ホールドの実態調査（read-only）

**★`character_data/` の diff は 0 である。CSV を触っていない。値も決めていない。記法も足していない。**

### 4-1. 連続入力で成立する技（前例あり）

**`chain` トークンで前段から通しで書く。** `category=target_combo` の 80 行すべてが該当し、
`chain` を含む行は全体で **114 行**（target_combo 80 / special 31 / throw 2 / unique 1）。

```
ken,triple_flash_kicks_2hits,target_combo,閃光連脚(2発止め),…,k_m chain k_m
ken,triple_flash_kicks,target_combo,閃光連脚,…,k_m chain k_m chain k_h
guile,recoil_cannon,target_combo,リコイルキャノン,…,p_m chain l plus p_h
kimberly,bushin_hellchain_throw,target_combo,武神獄鎖投げ,…,p_l chain p_m chain d plus p_h chain d plus k_h
jamie,freeflow_strikes_light,special,弱流酔拳,…,d dr r plus p_l chain r plus p chain r plus p
```

**途中止め行も別 move として存在し、それぞれ通しで書かれる。**

### 4-2. 「前段がヒットしたら次が出る」型（前例あり・同族に実在）

```
marisa,tonitrus_1hit,special,トニトルス(単発),…,p              ← 派生入力だけ
marisa,tonitrus,special,トニトルス,…,p chain p                 ← 前段から通し
marisa,tonitrus_1hit_od,special,ODトニトルス(単発),…,（空欄）
marisa,tonitrus_od,special,ODトニトルス,…,（空欄）             ← ★(b) の対象
```

**★非 OD 側の 2 件は既に埋まっており、OD 側 2 件だけが空欄である。**
**ヒット条件そのものを表すトークンは無い**（`cond{...}` は `moveindex` の語彙外＝`SkipConditionResidual`。
実データに 3 件あるが、いずれも索引非搭載になる）。**非 OD 側も条件を書かずに `p chain p` としている。**

### 4-3. ホールドで別技になるもの（前例あり）

**`hold` トークンを末尾に付す形が 48 行に実在**（special 29 / normal 8 / super_art 7 / unique 4）。

```
marisa,standing_heavy_punch_holding,normal,【ホールド】立ち強P,…,p_h hold
luke,flash_knuckle_holding_light,special,【ホールド】弱フラッシュナックル,…,d dl l plus p_l hold
rashid,whirlwind_shot_holding_light,special,【ホールド】弱ワールウインド・ショット,…,d dr r plus k_l hold
rashid,whirlwind_shot_max_holding_light,special,【最大ホールド】弱ワールウインド・ショット,…,d dr r plus k_l hold
```

**★「ホールド」と「最大ホールド」が同一の `command` 値になっている**（上の rashid 2 行が実例。
marisa の `gladius_holding_*` と `scutum_max_holding`、luke の【ホールド】と【ジャスト】も同型）。
**⇒ 保持量の段階は現在の記法で区別できていない。**

対象の manon `renverse_feint_*` 4 件と、その基底：

```
manon,renverse_light,special,弱ランヴェルセ,…,d dr r plus p_l
manon,renverse_od,special,ODランヴェルセ,…,d dr r plus p p
manon,renverse_feint_light,special,弱ランヴェルセ(フェイント),…,（空欄）
manon,renverse_feint_od,special,ODランヴェルセ(フェイント),…,（空欄）
```

### 4-4. ★3 択の答え

| 形 | 答え | 根拠 |
|---|---|---|
| **連鎖**（前段が当たった場合のみ次が出る） | **表せる** | **同族の非 OD 版が既に `p chain p` で表している**（`marisa/tonitrus`）。`chain` は 114 行で使われている確立した形である。**★ただし「ヒットしたときだけ」という条件そのものは表せない**——非 OD 版も条件を書かずに `p chain p` としており、**同じ流儀で OD 版も書ける**。条件を記録する列は別にある（`condition_ja` / `condition_en`。実データでは 2 行しか使われていない） |
| **ホールド**（押してすぐ離す／少し保持する） | **表せる** | **`hold` トークンが 48 行で使われている。** 基底 `d dr r plus p_l` と フェイント `d dr r plus p_l hold` で書き分けられ、正規化キーも `236LP` と `236LP(hold)` に分かれる。**★ただし表せるのは 2 値までである**——実データが示すとおり「ホールド」と「最大ホールド」は同一 `command` になる。`renverse_feint_*` は 2 段階なのでこの限界には当たらない |

**★どちらも「表せる」であり、`DES-004` の記法拡張は不要という結論には**——**製造は立ち入らない。**
本節は実データの前例と、その形の限界を報告するに留める。**値は決めていない。**

> **★補足（判断材料として）**——`(b)` の 13 件はいずれも `is_derived=true` である。
> `moveindex` は `is_derived=true` を最優先で skip するため（`SkipDerived`）、**`command` を補記しても
> `move_commands` には載らず、層 A のエイリアスも増えない**（生成器も同じ境界を採る＝`U-2`）。
> **⇒ 補記の効果は「CSV に入力情報が記録される」ことであり、表示や逆引きは変わらない。**
> 起票先を決める際の材料として記しておく。

---

## 5. `§4.7` 否定形確認（2 軸・4 項目）

**走査範囲**（`docs/instructions/` と `docs/postmortem/` は対象外）:

```bash
SCOPE="internal cmd migrations web/src docs/handover docs/process CLAUDE.md web/CLAUDE.md character_data"
```

### 項目 1「`P-34` の値は未決である」「投入はしない」→ **失効した。是正済み**

```bash
# (a) 識別子軸
grep -rn "derived-no-command\|ReasonDerivedNoCommand" $SCOPE
# (b) 散文軸
grep -rn "値は設計卓が決める\|投入はしない\|値が未決\|値は未決" $SCOPE
```

**是正した箇所**——`internal/seedgen/generate_m2002.go` の `ReasonDerivedNoCommand` の godoc。
「値は設計卓が決める(P-34)。本サブは全件を列挙して報告するだけである。」を、
**27 件のうち 13 件は投入済み・本理由に残るのは 14 件**へ改めた（旧記述は「以下は前回の記述」として残置）。
**挙動は不変**（コメントのみの変更）。

**是正していない箇所（適用済みマイグレのため触れない）**——
`migrations/000075_m20_preset_aliases_unique.up.sql:57`「★`P-34` の…27 件が将来投入されると
`alias_text_en` が増える」。**13 件は投入済みになったが、適用済みマイグレは改変しない**（M20-03 §2.2）。

### 項目 2「`M20-06` はデータ補正を行わない」→ **★失効していない（正解）**

```bash
grep -rn "データ補正\|揺れの補正\|D-305" $SCOPE
```

`D-305` は不変であり、**命名の揺れの補正は行っていない**。
**「揺れの補正はしない」と「`P-34` の新規行は入れる」の書き分け**は、本サブが新設した
`noInputDerivedTargets` の godoc と本報告 §3-2 が持つ。**是正の必要は無い。**

### 項目 3「`alias_text_en` は移動系の一部だけが持つ」→ **失効した。是正済み**

```bash
grep -rn "alias_text_en\|aliasTextEn\|AliasTextEn" $SCOPE | grep -iE "移動系|micro|76 行|2 code|一部"
grep -rn "値が入るのは\|入っているのは移動系\|移動系 2 code" $SCOPE
```

**是正した箇所（2 件）**——いずれもコメントのみで、**挙動・主張は不変**。

| ファイル | 旧記述 | 是正後 |
|---|---|---|
| `internal/seedgen/generate_m2002_test.go` | 「★`alias_text_en` は移動系のみ（キャラ別 INSERT は 3 列）」 | 「英語表記を持つ行が 1 つも無い塊では列を出さない」＋ 失効の明示 |
| `internal/service/preset/service_test.go` | 「`alias_text_en` を持つ行（`micro_forward` / `micro_back` の 2 code のみ）」 | 「1 件取る」＋ 失効の明示（テストの要求は「1 件でもある」ことだけ） |

**是正していない箇所（適用済みマイグレ）**——`000074` / `000075` のヘッダにある「`alias_text_en` が非 NULL ＝ 76 行」
「値が入るのは移動系 2 code」。**現在は 102 行だが、適用済みマイグレは改変しない。**

### 項目 4「(b) 13 件の補記先が未定である」→ **★失効していない（正解）**

```bash
grep -rn "補記先\|(b) 13 件\|起票先" $SCOPE
```

**本サブは補記していない。** `docs/handover/followup-backlog.md` の
`command-notation-chain-and-hold` が唯一の記載であり、**起票先は未定のままが正しい。**
ただし同行の状態欄は「未着手」のままだったため、**調査部分が完了したことを反映した**（補記そのものは未着手）。

### ★走査の回し直し（レビュー指摘 高-1 を受けて・2026-08-14）

**初回の走査は行単位 `grep` だったため、複数行コメントを取りこぼしていた。**
`internal/repository/preset/write_repository_test.go` は `alias_text_en` が 130 行目、
`micro` / `2 code` が 131 行目にあり、**2 段 grep のどちらの条件も同時に満たさなかった**。
さらに失効値「38 行」は**語ではなく数値**であり、どのパターンにも含まれていなかった。

**★教訓——否定形確認の走査は (1) 行を跨ぐ文脈で回し、(2) 数値で書かれた実測値を数値のパターンでも探すこと。**

回し直したコマンド:

```bash
SCOPE="internal cmd migrations web/src docs/handover docs/process CLAUDE.md web/CLAUDE.md character_data"
# A: 数値パターン（語ではなく数値で書かれた実測値）
grep -rnE "\b(38|76|1245|1260|27) (行|件|code)|2 code" $SCOPE
# B: 行を跨ぐ文脈
grep -rn -A1 -B1 "alias_text_en" $SCOPE | grep -iE "移動系|micro|だけ|のみ|一部"
# C: ファイル単位（行境界の取りこぼし対策）
for f in $(grep -rl "alias_text_en\|AliasTextEn\|aliasTextEn" $SCOPE); do
  if grep -qE "38 行|76 行|2 code のみ|移動系のみ" "$f"; then echo "REVIEW: $f"; fi
done
```

**追加で見つかり、是正したもの（2 件。いずれもスコープの明示。挙動不変）**

| ファイル | 状態 | 対応 |
|---|---|---|
| `internal/infra/migration/migrate_m2002_test.go` | **失効していない**（比較区間が v73 に閉じており、その時点では真） | **スコープ注記を追加**——「HEAD ではもう 2 code だけではない」と明記。**全体の主張と読まれるのを防ぐ** |
| `internal/seedgen/generate_m2002_test.go` | 同上（`res.Movement` の中の話） | 同上 |

**是正しなかったもの（製造の手番ではない）**——`docs/handover/design-reports/20260813-m20-02-design-exceptions.md`
（**過去サブの記録であり、当時の報告として正しい**）／ `docs/process/parallel-board.md`（**設計卓の所管**）。

### ★おまけの是正（`D-361` に基づく。指示書 §2.2 の注記が許す範囲）

**生成 SQL ヘッダの「移動系 9 code は `characters` を CROSS JOIN するため、CSV を持たないキャラにも当たる」は失効していた。**
M20-02 レビュー **H-2** が CROSS JOIN を**キャラの明示列挙**へ是正した時点で本文と矛盾しており、
**`000072` 本体は既にキャラを列挙しているのにヘッダだけが旧のまま、以後のすべての波へ複製される状態**だった
（`D-361` の (b) 前提を述べている散文）。

- `FormatCurrent` … 「移動系 9 code は投入先キャラを明示列挙する（up と down を同じ集合で絞るため ＝ H-2）」へ改めた
- `-noinput-only` … 「本ファイルは層 C-3 だけを投入する。移動系 9 code は含まない」
- **`FormatPreM2003` は旧文面をそのまま再現する**——適用済み `000072` / `000073` との byte 一致を主張する
  golden テストが**手編集ドリフトの唯一の検出経路**であり、そこを崩さないため

**挙動は不変**（`go test ./internal/seedgen/` の golden 2 本が byte 一致で緑）。

---

## 6. `§5` テストと破壊確認

### 6-1. 実装したテスト

| # | 場所 | 内容 |
|---|---|---|
| (a) | `internal/infra/migration/migrate_m2006_test.go` | 26 行の `alias_text` が `name_ja` と完全一致（括弧の種類・全角半角を含む） |
| (b) | 同上 ＋ `internal/seedgen/generate_m2006_test.go` | `alias_text_en` が `move_code` の整形結果と一致（`od` → `OD` の末尾 3 ＋ 語中 1）／ **語を足さない**ことを機械で主張 |
| (c) | `internal/service/preset/custom_preset_priority_test.go` | カスタムプリセットの値で表示が解決する |
| (d) | 同上 | カスタムプリセットの値で逆引きが解決する |
| (e) | `migrate_m2006_test.go` / `generate_m2006_test.go` | jp `departure_window_double_warp_od` ほか未決 14 件に**行が無い**／固定表が 13 件である |
| (f) | `migrate_m2006_test.go` | 一意制約 3 本の定義が不変・違反 0 件・`character_id` が入っている・`D-317` の交差 0 件 |
| (g) | `generate_m2006_test.go` | **通常の `-mode aliases` でも層 C-3 が出る**（1 回きりの backfill になっていない） |
| golden | `generate_m2002_golden_test.go` | `000072` / `000073` が byte 一致のまま（層 C-3 は旧形式で出ない） |

**期待値を更新した既存テスト**——`internal/infra/migration/migrate_test.go` の `TestRun_SeedRowCounts`
（`numeric` 1245 → **1258** ／ `srk` 1260 → **1273**）。**HEAD スコープの主張であり、期待値の更新が正しい対応である**
（`SUPP-001` §5.5.2 (2)）。同じく `TestM2002_GenerationMeasurements` に層 C-noinput ＝ 13 を追加し、
`derived-no-command` を 27 → **14** へ更新した。

### 6-2. ★破壊確認（どのテストが赤くなったか）

| # | 外したガード | 赤くなったテスト |
|---|---|---|
| **1** | **`resolver.go` の表示経路へ `move_code` 固定の分岐を置く**（`§4.3-2` が禁じる形） | `Test_P34_CustomPresetWinsOnDisplay`（`カスタムプリセットの表示 = "弧空", want "カスタム弧空"`）／ `Test_P34_NoPresetIndependentFixedTable`（`全行を消した後の表示 = "弧空", want "arc_step"`） |
| **2** | **逆引き `findMoveCodesByAliasSQL` を `is_builtin = 1` に絞る**（カスタム側を母数から外す） | `Test_P34_CustomPresetWinsOnReverseLookup`（`カスタム表記の逆引き = [], want [arc_step]`） |
| **3** | **固定表へ 14 件目（jp のエッジケース）を足す** | `TestM2002_GenerationMeasurements`（`層 C-noinput = 14, want 13` ／ `非投入 derived-no-command = 13, want 14` ほか numeric・srk 両方で 5 件） |

**★1 回目の破壊確認で `Test_P34_CustomPresetWinsOnDisplay` が赤くならなかった。**
原因は**テスト側**にあった——ステップに `MoveCode` を持たせていなかったため、`move_code` を鍵にした
固定表を置かれても素通りしていた。**実データのステップは `move_code` を持つ**ので、テストを実態へ揃えたうえで
再度確認し、赤くなることを見た。**⇒ 破壊確認が無ければ、空振りするテストを「緑だから良い」と通していた。**

**★「別の機構が代わりに守っている」を先に疑った例**（`SUPP-001` §5.5 (10)）——
当初 `TestM2006_NoInputDerivedJoinsCollisionPool` を「同一キャラ内で同じ `name_ja` を持つ 2 件」で書いたが、
**`csv.go` の `validate` が先に fail させる**ため生成器まで到達しなかった。**テストが弱いのではなく、
CSV 検証が代わりに守っている。** ⇒ 層 C-3 に固有の危険は「`name_ja` が同キャラの別技の**表記**と一致する」形
（`name_ja` の重複ではないので `validate` を素通りする）であると特定し、そちらを固定した。

### 6-3. 自己テスト結果

| 検査 | 結果 |
|---|---|
| `go test ./...` | **FAIL 0** |
| `cd web && pnpm test` | **全緑（137 files / 1197 tests）** |
| `cd web && pnpm lint` | **exit 0** |
| `make e2e` | **83 passed / 0 failed（フルスイート完走・make exit 0）**。`e2e/*.spec.ts` の定義済みテストは 83 件でありスキップは 0 |

> **★`pnpm test` / `pnpm lint` / `make e2e` は当初 `web/node_modules` が無い状態で実行しており、
> `vitest: not found` のまま「終了コード 0」に見えていた。** `pnpm install --frozen-lockfile` を行って
> **実際に走らせ直した結果が上記である。** **⇒ 終了コードだけを見て緑と判断しないこと。**

> **★E2E は環境要因で 1 回目が 34 件失敗した。本サブの変更が原因ではない。**
> 失敗はすべて「初期設定ウィザードが出て先へ進めない」形だった。**原因＝`config.toml` が `.gitignore`
> 対象であり、クリーンな clone には存在しない。** アプリが初回起動時に生成するため、**1 回目の E2E は
> 実行の途中で config.toml が生成されるまでウィザードが出続けた**（生成後に走った後半のファイルは通っている）。
> `config.toml` が揃った状態で回し直して **83/83 緑**。
> **★クラウド実行環境では `make e2e` の前に 1 度アプリを起動して `config.toml` を作る必要がある**（横断課題）。

> **★`playwright install` はネットワークポリシーで 403 になる**（`cdn.playwright.dev` が許可されていない）。
> **プリインストール済みの Chromium を `PW_EXECUTABLE_PATH=/opt/pw-browsers/chromium` で渡して実行した**
> （`Makefile` の `e2e` ターゲットが既に同変数に対応している）。

---

## 7. 品質チェック（`§7.3`）

| 項目 | 結果 |
|---|---|
| `internal/moveindex/` ／ `move_commands` の diff | **0** |
| `character_data/` の diff | **0** |
| `scripts/` の diff | **0** |
| `docs/design/` ／ `docs/change-notes/` の diff | **0** |
| `docs/instructions/` の diff | **0**（改訂版は手渡し・コミットしない） |
| `migrations/` の消費本数 | **2 本**（`000076` / `000077`）。**着手時の disk 末尾実査 ＝ `000075`** |
| `any` / `@ts-ignore` / `eslint-disable` / `console.log` の追加 | **0 件**（フロントの変更そのものが 0） |
| `official_ja_move` の既存 13 行 | **無改変**（`TestRun_M2006_OfficialJaMoveUntouched` が固定） |

---

## 8. ★`§4.9`「投入した」と「表示に効いている」の書き分け

### 8-1. 投入した（事実）

- **`preset_aliases` へ 26 行**（13 `move_code` × 2 プリセット）が入った
- **`alias_text_en` が非 NULL の行は 76 → 102 行**になった
- **カスタムプリセットを新規作成すると、この 26 行もコピーで引き継がれる**（`copyAliasesSQL`）

### 8-2. ★表示には効いていない（同じく事実）

**利用者の画面は 1 文字も変わらない。**

| 経路 | 状態 |
|---|---|
| **表示ロケール分岐**（en かつ `alias_text_en` 非 NULL なら英語＝`DES-004` §5） | **実装 0 件**。Go / web ともに `alias_text_en` を表示へ流す経路が無い |
| **逆引きが `alias_text_en` を引く**（`D-317`） | **未実装**。`findMoveCodesByAliasSQL` は `alias_text` のみを引く |

**★これは本サブが作った状態ではなく `M20-02` から続く状態である**——既存の 76 行も同じく表示されていない。
**★本サブでは直していない**（`§4.9-1`。`§2.2-1` が `DES-004` §5 の解決順序を凍結しており、実装を足すのは変更に当たる）。
**★テストも「行が入っていること」までしか主張していない**（`§4.9-4`）。

**日本語側については「今日と同じ見え方」が保たれている**——13 件は従来 `official_ja_move` へのフォールバックで
`name_ja` が出ており、投入した `alias_text` も同じ `name_ja` である。**⇒ 日本語表示は変わらない（変えないのが目的）。**

---

## 9. 実装の要点（`§9.2` で製造へ委ねられた判断）

| # | 判断 | 採った形と理由 |
|---|---|---|
| 1 | 固定表の置き場（`§9.2-1`） | **`internal/seedgen/generate_m2002.go` の層 C-3**。`DES-004` §3.4.1 の層 C が「何も押さずに派生する技」を既に挙げており、規則の実体をそこへ置けば `character_data/seed-progress.md` の**既存手順がそのまま再適用経路になる**（手順書の改訂が要らない） |
| 2 | 投入の方法（`§9.2-2`） | **生成器の出力＋新規マイグレ 2 本**。手書き `INSERT` は `character_id` の入れ忘れが静かに UNIQUE をすり抜ける（`DES-004` §5.7-1）。生成器なら自動で出る |
| 3 | 既存キャラへの一度きりの投入 | **`-mode aliases` に `-noinput-only` を追加**。既存の `-mode aliases` を 6 キャラへそのまま再実行すると、up は `NOT EXISTS` で skip する一方 **down は無条件 DELETE** であるため、`000072` / `000073` が入れた行まで消す down ができる（**H-2 と同型の事故**）。**★解決は全層で回し、絞るのは出力だけである**——層 C-3 だけを解決すると衝突判定の母数から他層の表記が落ちる |
| 4 | 旧形式での抑止 | **`FormatPreM2003` では層 C-3 を出さない**。出すと golden の byte 一致が崩れ、**恒常的に赤くなって「赤いのが普通」になり、実際のドリフトを見逃す** |
| 5 | `alias_text_en` 列の出し方 | **その塊に値を持つ行が 1 つでもあるときだけ出す**。無条件に出すと、既存の全キャラ分の塊に NULL だけの列が増える |
| 6 | テストの置き場（`§9.2-3`） | 値と制約は実 DB（`internal/infra/migration/`）、規則は純関数（`internal/seedgen/`）、優先順位は実 DB ＋本番配線（`internal/service/preset/`） |

### 再生成コマンド（`-check` で byte 一致を確認できる）

```bash
go run ./cmd/seedgen -mode aliases -preset numeric -noinput-only \
  -chars jp,kimberly,lily,m_bison,marisa,rashid \
  -out 000076_m20_seed_aliases_p34_numeric \
  -note "M20-06: P-34 の 13 件(何も押さずに派生する技)を numeric へ投入する(D-367 / D-373)" \
  -alias-report tmp/p34-numeric.md
go run ./cmd/seedgen -mode aliases -preset srk -noinput-only \
  -chars jp,kimberly,lily,m_bison,marisa,rashid \
  -out 000077_m20_seed_aliases_p34_srk \
  -note "M20-06: P-34 の 13 件(何も押さずに派生する技)を srk へ投入する(D-367 / D-373)" \
  -alias-report tmp/p34-srk.md
```

---

## 10. 併せて更新が要るもの

| # | 対象 | 状態 |
|---|---|---|
| 1 | **CHANGE 番号の登録** | **消費なし。** `CHANGE-103` は本サブ着手前に起票・承認済みで、`change-number-registry.md` §1 へ登録済み |
| 2 | **マイグレ連番** | **`000076` / `000077` を消費した。** ボード §2.2 の「次に払い出す番号」は **`000078`** になる（**設計卓の手番**） |
| 3 | **版を上げた文書の参照元** | **なし**（製造は設計書・指示書を編集していない） |
| 4 | **`followup-backlog.md`** | `command-notation-chain-and-hold` の状態を更新（調査完了・補記は未着手） |
| 5 | **`DES-004` §5 の `alias_text_en` 対象範囲** | **as-built が確定した**（76 → 102 行 ／ 対象は移動系 2 code ＋ 層 C-3 の 13 code）。**`CHANGE-103` の (d) が「増える場合のみ改訂する」としており、増えた。反映は設計卓の手番** |
| 6 | **`DES-003` §3.9 の充足範囲の記述** | 同上（「値が入っているのは移動系 2 code のみ・76 行」が失効した）。**設計卓の手番** |

---

## 11. 残課題・申し送り

| # | 内容 | 宛先 |
|---|---|---|
| 1 | **`alias_text_en` の表示経路・逆引きが未実装**（`D-317` の (2)(3)）。**26 行を入れても画面は変わらない** | `M20-07` 以降 ／ 設計卓 |
| 2 | **技名（`name_ja`）の表示が選択中プリセットを見ていない**（`§1.3-8` でスコープ外） | followup `move-name-display-preset-independent` |
| 3 | **lily `rush_desert_storm_1hits` の `name_ja` が規則から外れている**（§3-2）。**`D-305` により補正しない** | 設計卓（判断待ち） |
| 4 | **rush の `original_move_code` に dangling 参照が 4 件**（§3-1）。**`D-305` により補正しない** | 設計卓（判断待ち） |
| 5 | **`P-34` の (b) 13 件の CSV 補記**。**★連鎖・ホールドとも既存記法で表せる**（§4-4）。**補記しても `move_commands` には載らない**（`is_derived=true` は skip される）ため、効果は入力情報の記録に留まる | 起票先未定（設計卓） |
| 6 | **適用済みマイグレ `000074` / `000075` のヘッダに失効した件数記述**（76 行 ／ 移動系 2 code）。**改変しない**（M20-03 §2.2） | 記録のみ |

---

*以上、M20-06 完了報告。*
