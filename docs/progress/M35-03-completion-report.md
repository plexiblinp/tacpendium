# M35-03 完了報告: ラッシュ版 4 件の `original_move_code` の誤りを直す

| 項目 | 内容 |
|------|------|
| 指示書 | `docs/instructions/M35-03-rush-original-move-code-typo.md` **v1.0.0** |
| チェックリスト | `docs/instructions/reviews/M35-03-review-checklist.md` **v1.0.0**（`D-816` 発行） |
| 実施日 | 2026-09-11 |
| 着手基点 | `23b8a08` |
| 製造 CLI | `/implement_plan_full` |
| CHANGE 消費 | **0 本**（見込みどおり） |
| マイグレ消費 | **`000111` の 1 本**。`D-812` の払い出しどおりであり自採番していない |
| 新規依存 | **0 件** |

---

## 0. 一行で

`ingrid` 2 件 ／ `lily` 1 件 ／ `mai` 1 件のラッシュ版が、`original_move_code` に
存在しない `move_code` を持っていた。CSV 正本 ／ golden 3 本の再生成 ／ 追随マイグレ
`000111` の三点に、`preset_aliases` への `INSERT` と `moves.original_move_id` の
backfill を加えて是正した。

---

## 1. 機序（**なぜ誰も気づかなかったか**）

seed 時の解決は相関副問い合わせである（`internal/seedgen/generate.go:246-267`）。
参照先が実在しないとき、この副問い合わせは **エラーではなく NULL を返す**。
`moves.original_move_id` は NULL 許容の自己参照 FK なので、制約にも触れない。

その NULL が 2 か所で静かに効いていた。

| # | 実害 | 機序 |
|---|---|---|
| 1 | セットプレイ自動提案の候補から脱落 | `internal/service/setplay/service.go:144` が `OriginalMoveID == nil` のとき `TargetType` を空にし、`collectTargets`（`:641`）が `continue` で落とす。**空文字は system ／ SA ／ 元 special のラッシュと同じバケツ**であり、データ欠陥と意図的除外が区別できない |
| 2 | 表記プリセット `numeric` ／ `srk` の別名が 0 行 | `internal/seedgen/generate_m2002.go:633-643` が「元技が CSV に実在しない」行を `ReasonRushNoOriginal` として合成から外す。**`D-305` の「推測で元技を当てない」に従った意図的な挙動**であり、生成器の欠陥ではない |
| 3 | **4 技をレシピに入れると保存が 400 になっていた** | `internal/service/validation/combo.go:483-499` の `validateC12RushVariantOriginal` が、`FindOriginalMoveID` の nil で `VAL-C12` の ERROR を立てる。`internal/service/combo/deps_adapter.go:60-74` は `original_move_id` が NULL のとき `(nil, nil)` を返し、`internal/service/combo/service.go:368` の `HasError()` がトランザクションを巻き戻して 400 になる |

**⇒ 1 と 2 はエラーにならず、警告も出ず、テストも lint も型検査も緑だった。**

**★★3 だけは利用者にエラーとして見えていた。** 4 技は入力面に出ていた（§2.3 の実測。
`isOnUniqueTab=true`）ので、`ingrid` ／ `lily` ／ `mai` の利用者は編集画面から選べたのに
保存すると `ラッシュ版 move id=N に対応する元技が見つかりません` で弾かれていた。

**★★★3 は本報告の初版に無かった**（2026-09-11・レビュー 中-3 の採用で追記）。
**指示書 §0.4 ／ followup 行 ／ `M35-02` の実測のいずれも「実害は 2 つ」と書いており、その記述を写していた。⇒ 3 件目はレビューが独立に辿って見つけた。**
**★同分岐は着手時点でテストが 1 本も通っていなかった**（既存の `TestC12_*` 2 本は
`ExistsForCharacter` 側の分岐を見ている）。**⇒ 対の床を新設した**（§8.3）。

---

## 2. 段 1 実査（指示書 §2.1・**6 項目すべてに結果がある**）

### 2.1 軸 A ＝ dangling（`original_move_code` が実在しない `move_code` を指す行）

母集団は 2 つで測った。**CSV 側**（正本）と **`moves` テーブル側**（`SUPP-001` §5.5.3.2 の
母集団。HEAD まで migrate した使い捨て DB。`newMigrator` と同じ経路で `t.TempDir()`）。

| 母集団 | 母数 | 軸 A |
|---|---|---|
| CSV（31 ファイル・2743 行） | `rush_variant` **514 行**（全行が `original_move_code` を持つ） | **4 件** |
| `moves`（HEAD＝`v109`・3057 行） | `rush_variant` **514 行** | **4 件**（`original_move_id IS NULL`） |

```
character_data/ingrid.csv:91  rush_glowing_touch_1hits      original_move_code=glowing_touch_1
character_data/ingrid.csv:92  rush_luminous_uppercut_1hits  original_move_code=luminous_uppercut_1
character_data/lily.csv:82    rush_desert_storm_1hits       original_move_code=desert_storm_1
character_data/mai.csv:97     rush_hoshi_kujaku_1hits       original_move_code=hoshi_kujaku_1
```

指示書 §0.2 の写しと一致した。**⇒ 「止めて設計卓へ返す」条件（§7）には当たらない。**

### 2.2 走査に使った式

**`M35-02` の `awk` は使っていない。** 同式（`"rush_" $17 != $2`）は 2 種類の欠陥を
区別せずに拾い、それが `M35-02` 初版の誤りの本体であった（設計伝達レポート §7-6）。
本サブは **参照先の実在** を直接問う式で測った。

```python
# csv モジュールで読む。awk -F, は notes 列の引用符内カンマで壊れる。
codes = {r["move_code"] for r in rows}              # キャラごとの move_code 集合
dangling = [r for r in rows
            if r["category"] == "rush_variant"
            and r["original_move_code"].strip()
            and r["original_move_code"].strip() not in codes]
```

DB 側は `SELECT ... FROM moves m WHERE m.category='rush_variant' AND m.original_move_id IS NULL`。

### 2.3 軸 B ＝ 入力面に出ない `rush_variant`

**実装の関数そのもので数えた**（`SUPP-001` §5.5.4 (11″)。自作の近似を使わない）。
`surfaceBuckets` ／ `isOnUniqueTab`（`web/src/features/combo/moveSurfacing.ts:184-190`）を
使い捨てプローブから呼んだ。

```
★軸 B(未分類に残る rush_variant) = 4 件
    alex/rush_standing_heavy_kick_holding
    alex/rush_standing_heavy_punch_holding
    jamie/rush_drink_level_1_standing_light_punch
    zangief/rush_standing_heavy_punch_holding
```

あわせて軸 A の 4 件を同じ関数へ通した。

```
   [軸A対象] ingrid/rush_glowing_touch_1hits      isOnUniqueTab=true  未分類=false
   [軸A対象] ingrid/rush_luminous_uppercut_1hits  isOnUniqueTab=true  未分類=false
   [軸A対象] lily/rush_desert_storm_1hits         isOnUniqueTab=true  未分類=false
   [軸A対象] mai/rush_hoshi_kujaku_1hits          isOnUniqueTab=true  未分類=false
   [軸A対象] zangief/rush_power_stomps_1hits      isOnUniqueTab=true  未分類=false   ← 対照
```

### 2.4 段 1-3 の突き合わせ（**集合として**。完了条件 1）

| 集合 | 件数 | 内訳 |
|---|---|---|
| A ∖ B | **4** | `ingrid` 2 ／ `lily` 1 ／ `mai` 1 |
| **A ∩ B** | **0** | **空集合** |
| B ∖ A | **4** | `alex` 2 ／ `jamie` 1 ／ `zangief` 1 |

**★件数はどちらも 4 だが、別の集合である。** `M35-02` が 1 度混ぜたのはこの形であり、
件数の一致は同一性の証拠にならない。

**★交わらないのは偶然ではなく構造である。** `moveSurfacing.roster.test.ts` の
`loadCharacter`（`:88-100`）が読むのは `move_code` ／ `category` ／ `is_aerial` ／
`name_ja` の 4 列だけであり、17 列目の `original_move_code` を読まない。
`isOnUniqueTab` も `move.code` の接頭辞を外して基底 code を探すだけで
`original_move_id` を見ない。**⇒ 軸 A の是正が軸 B へ影響する経路が無い。**

**この主張は機械で裏づけた**（§9 破壊確認 7）。4 件のうち 1 件の `move_code` を
一時的に変えると軸 B は 4 → 5 へ動き、軸 A の走査は 0 件のまま変わらなかった。

**★射程は軸 A のみである。** 軸 B の 4 件（`HitBoxLayout` の方向×強度×ボタンから
到達できない別の族）には 1 文字も触っていない。

### 2.5 是正前の `preset_aliases`（陽性対照の「前」。完了条件 5）

HEAD まで migrate した使い捨て DB で実測した。

```
  [別名] numeric          ingrid   rush_glowing_touch_1hits         => (0 行)
  [別名] numeric          ingrid   rush_luminous_uppercut_1hits     => (0 行)
  [別名] numeric          lily     rush_desert_storm_1hits          => (0 行)
  [別名] numeric          mai      rush_hoshi_kujaku_1hits          => (0 行)
  [別名] numeric          zangief  rush_power_stomps_1hits          => DR > 22MK      ← 対照
  [別名] srk              ingrid   rush_glowing_touch_1hits         => (0 行)
  [別名] srk              ingrid   rush_luminous_uppercut_1hits     => (0 行)
  [別名] srk              lily     rush_desert_storm_1hits          => (0 行)
  [別名] srk              mai      rush_hoshi_kujaku_1hits          => (0 行)
  [別名] srk              zangief  rush_power_stomps_1hits          => DR > 22MK      ← 対照
  [別名] official_ja_move ingrid   rush_glowing_touch_1hits         => グロータッチ(単発)(ラッシュ)
  [別名] official_ja_move ingrid   rush_luminous_uppercut_1hits     => ルミナスアッパー(単発)(ラッシュ)
  [別名] official_ja_move lily     rush_desert_storm_1hits          => デザートストーム(ラッシュ)
  [別名] official_ja_move mai      rush_hoshi_kujaku_1hits          => 星孔雀(単発)(ラッシュ)
  [総数] numeric = 2272 行 / srk = 2300 行
```

**★`official_ja_move` は 4 件とも在る。** これは `000026` が投入した行であり本サブの
射程外である。**⇒ `000111` の `down` はここを巻き添えにしてはならない**（§5 で対処）。

**★元技側の別名**（合成の材料）**も測った。**

```
  [元技] numeric/srk  ingrid   glowing_touch_1hits      => 4MK
  [元技] numeric/srk  ingrid   luminous_uppercut_1hits  => 4HP
  [元技] numeric/srk  lily     desert_storm_1hits       => 6HP
  [元技] numeric/srk  mai      hoshi_kujaku_1hits       => 4HK
  [元技] numeric/srk  zangief  power_stomps_1hits       => 22MK
```

### 2.6 セットプレイ候補の是正前スナップショット

`canary_setplay_projection_test.go`（本番の `setplay.ProjectCandidates` を呼ぶ）で
全数を射影した。

```
FILLER ingrid rush_glowing_touch_1hits
FILLER ingrid rush_luminous_uppercut_1hits
FILLER lily   rush_desert_storm_1hits
FILLER mai    rush_hoshi_kujaku_1hits
FILLER zangief rush_power_stomps_1hits
TARGET zangief rush_power_stomps_1hits          ← 対照だけが TARGET に居る
```

**★4 件は `FILLER` には出るが `TARGET` に居ない。** 対照の `zangief` は両方に居る。
**⇒ 実害 1 が観測で確認できた。**

### 2.7 段 1-6 ＝ 規約 (16) の `grep`（完了条件 4）

`golden` を再生成する前に、その版に固定された契約テストを探した。

```bash
grep -rn "000026" --include=*_test.go internal cmd
grep -rln "original_move_id" --include=*_test.go internal
# ＋ 各ファイルの終端(Migrate(N) / *Terminus / *Version 定数)を突き合わせる
```

**★★★連番の `grep` では足りなかった。** `internal/infra/migration/rules_m1905_test.go` は
`000026` という文字列を 1 度も持たないが、終端 `v68`（`m1905Version = 68`）であり
`m1905TargetBaseSQL`（`:364-370`）が `rush_variant` を
`EXISTS(... o.id = m.original_move_id AND o.category IN ('normal','unique'))` で絞る。
**⇒ `000026` の再生成で必ず動く。**

**弁別に効いた道具は `grep original_move_id --include=*_test.go` ＋「終端がその golden の版以上か」の突き合わせであった。**（設計卓への申し送り＝§12）

---

## 3. 三点 1 — CSV 正本

`character_data/ingrid.csv:91,92` ／ `lily.csv:82` ／ `mai.csv:97` の
**17 列目（`original_move_code`）の 4 セルだけ**を `_1` → `_1hits` にした。

**★部分文字列の罠を避けた。** `glowing_touch_1` は正しい code `glowing_touch_1hits` の
**接頭辞**であり、同じファイル内に両方が在る。無アンカーの置換は基底行を
`glowing_touch_1hitshits` にする。**⇒ 前後のカンマでアンカーし、セル単位で置換した。**

機械照合を 2 本回した。

```
★move_code の差分 = 0                                    ← 差分の 2 列目が左右で同一
★逆置換で完全一致 = 4 セル以外は 1 文字も動いていない      ← + 側に逆置換をかけて − 側と diff
```

- 差分統計 … `3 files changed, 4 insertions(+), 4 deletions(-)`
- 是正後の軸 A 再走査 … **0 件**（母数 514 行）
- `lily.csv:82` の `name_ja` … **`デザートストーム(ラッシュ)` のまま**。
  `rush-desert-storm-1hits-naming` は `D-305` ／ `D-809` により射程外

---

## 4. 三点 2 — golden 3 本の再生成

**手編集していない。`cmd/seedgen` で生成し直した。**

```bash
go run ./cmd/seedgen                          # 000026_seed_moves_first_wave.{up,down}.sql
go run ./cmd/seedgen -mode aliases -preset numeric \
  -chars guile,ingrid,jamie,jp,juri,ken,kimberly,lily,luke,m_bison,mai,manon,marisa,rashid,ryu,terry,zangief \
  -movement-chars c_viper,dhalsim,guile,ingrid,jamie,jp,juri,ken,kimberly,lily,luke,m_bison,mai,manon,marisa,rashid,ryu,terry,zangief \
  -out 000072_m20_seed_aliases_numeric \
  -note "M20-02: 表記プリセット numeric のエイリアス投入(D-311 / D-314 / D-315 / D-321)"
# srk は -preset srk / -out 000073_m20_seed_aliases_srk / -note の numeric→srk 置換のみ
```

3 stem とも `cmd/seedgen/main.go` の `preM2003Stems` に含まれ、`formatFor(stem)` が
`FormatPreM2003` を自動選択する。**⇒ 追加フラグは不要。**

**★`-mode move-commands` は回していない。** `000035` は `original_move_code` を読まない。

### 4.1 動いた golden と差分の形

```
migrations/000026_seed_moves_first_wave.up.sql      |  8 ++++----
migrations/000072_m20_seed_aliases_numeric.down.sql |  6 +++---
migrations/000072_m20_seed_aliases_numeric.up.sql   | 10 +++++++---
migrations/000073_m20_seed_aliases_srk.down.sql     |  6 +++---
migrations/000073_m20_seed_aliases_srk.up.sql       | 10 +++++++---
```

`000026` の差分は `original_move_id` 解決の `CASE` 4 行のみ（1 対 1 置換・行の増減なし）。

```
-        WHEN 'rush_desert_storm_1hits' THEN 'desert_storm_1'
+        WHEN 'rush_desert_storm_1hits' THEN 'desert_storm_1hits'
-        WHEN 'rush_glowing_touch_1hits' THEN 'glowing_touch_1'
+        WHEN 'rush_glowing_touch_1hits' THEN 'glowing_touch_1hits'
-        WHEN 'rush_luminous_uppercut_1hits' THEN 'luminous_uppercut_1'
+        WHEN 'rush_luminous_uppercut_1hits' THEN 'luminous_uppercut_1hits'
-        WHEN 'rush_hoshi_kujaku_1hits' THEN 'hoshi_kujaku_1'
+        WHEN 'rush_hoshi_kujaku_1hits' THEN 'hoshi_kujaku_1hits'
```

`000072` ／ `000073` は別名が 4 行ずつ増え、ブロック見出しの件数が追随した。

```
--- ===== ingrid (60 aliases) =====
+-- ===== ingrid (62 aliases) =====
+  UNION ALL SELECT 'rush_glowing_touch_1hits', 'DR > 4MK'
+  UNION ALL SELECT 'rush_luminous_uppercut_1hits', 'DR > 4HP'
--- ===== lily (58 aliases) =====          ← srk 側は 61 → 62
+-- ===== lily (59 aliases) =====
+  UNION ALL SELECT 'rush_desert_storm_1hits', 'DR > 6HP'
--- ===== mai (61 aliases) =====
+-- ===== mai (62 aliases) =====
+  UNION ALL SELECT 'rush_hoshi_kujaku_1hits', 'DR > 4HK'
```

**★`DR > …` の値は再生成物からの読み出しである。** 着手前の見積りと一致したが、
**マイグレへ書いたのは実測値のほうである。**`down` の `m.code IN (...)` 列挙にも
4 code が加わった。

**★衝突は 0 件。** 各ファイルの新規 alias 行はちょうど 4 本であり、
`dropCollisions` に落とされた行は無い（`collision` の実測値が不変であることでも裏づけた）。

### 4.2 他 28 キャラの差分 0 バイト（完了条件 3）

CSV を持つキャラは **31**（実測）。「他 28 キャラ」は `ingrid` ／ `lily` ／ `mai` を
除く全数であり、`000026` の第一波 9 体のうち他 6 体だけではない。**2 段で示す。**

1. `000026` の中で変更が当たったキャラは **`ingrid` ／ `lily` ／ `mai` の 3 体だけ**。
   変更行の直前の `-- ===== <char>` 見出しを機械で拾って判定した。
2. 他の seed golden は **ファイル全体が無差分**。

```
  000030_seed_moves_ryu                差分ファイル数 = 0
  000034_backfill_moves_is_derived     差分ファイル数 = 0
  000035_seed_move_commands            差分ファイル数 = 0
  000045_seed_moves_manon              差分ファイル数 = 0
  000055_seed_moves_third_wave         差分ファイル数 = 0
  000076 / 000077                      差分ファイル数 = 0
  000084_seed_moves_fourth_wave        差分ファイル数 = 0
  000090 / 000091                      差分ファイル数 = 0
```

### 4.3 検査

- `go run ./cmd/seedgen -check` … `OK: 生成物は既存ファイルと一致` ／ exit 0
- `go test ./internal/seedgen/` … ok

---

## 5. 三点 3 — 追随マイグレ `000111`

`migrations/000111_data_correct_rush_original_move_refs.{up,down}.sql`（**新規**）

| 観点 | 採ったこと |
|---|---|
| 層 | ファイル名に `_data_` を入れた。`REUSE.toml:82` の `migrations/*_data_*.sql` が `CC-BY-SA-4.0` へ解決する。**`REUSE.toml` の編集は不要** |
| 番号 | **`000111`**。`D-812` の払い出しどおりであり自採番していない |
| DDL | 書いていない（DML のみ） |
| 絞り | `character_id` と対で絞る。`moves.code` はテーブル全体では一意でない（UNIQUE は `(character_id, code)`） |
| `down` | 書いた。`preset_aliases` の `DELETE` を含む |

### 5.1 up は 2 文（増えた 2 つ）

**(1) `moves.original_move_id` の backfill（4 行）。**
形は生成器の相関副問い合わせ（`internal/seedgen/generate.go:246-267`）に合わせ、
ガードを行ごとに読めるよう **1 行 1 文**で書いた（`SUPP-001` §5.5.4 (4)）。

**(2) `preset_aliases` へ 8 行**（4 技 × `numeric` ／ `srk`）**。**
8 行を明示列挙した。畳まないのは、`numeric` と `srk` で値が割れても同じ形のまま
表せるようにするためである（今回はたまたま同値）。

### 5.2 ガードの意味が 2 つで違う

| 文 | ガード | 意味 |
|---|---|---|
| (1) | `original_move_id IS NULL` ＋ `EXISTS(元技)` | **まだ当たっていない DB にだけ当てる。** 誰かが別の値を入れていた場合に上書きしない。元技が居ないときに NULL を書き戻さない |
| (2) | `NOT EXISTS (preset_id, move_id)` | **必須である。** 無いと `000001:148` 由来の `UNIQUE (preset_id, move_id)` に触れ、**新規 DB でマイグレが落ちる**。0 行で済むのではなく中断する（CI を含む） |

### 5.3 `character_id` を必ず入れた

`000074` が足した非正規化列であり、`000075` の UNIQUE 索引 2 本の構成列でもある。
**NULL でも `INSERT` は通り、alias は画面にも出る。⇒ 動作では気づけない**（`M31-04` 教訓 §7-1）。

**★`000072` ／ `000073` 自身は `character_id` を書いていない。** それは両者が `000074` より
前のマイグレであり `000074` が後から backfill するためである。**⇒ その形をここへ写さない。**

**★この判断が空振りしかけた。** §9 の破壊確認 6 を参照。

### 5.4 このマイグレは新規 DB では 1 行も変えない

同じ是正を CSV と golden 3 本にも入れてあるため、新規 DB は `v26` の時点で
`original_move_id` が埋まり、`v72` ／ `v73` の時点で別名を持つ。
**⇒ (1) の `UPDATE` は 0 行に当たり、(2) の `INSERT` は `NOT EXISTS` で弾かれる。**
どちらもエラーにならない（`SUPP-001` §5.5.4 (6)）。

**⇒ テストは件数ではなく `v111` 時点の最終状態と `down` → `re-up` の往復で固定した。**

### 5.5 `down` の非対称と、`000108` の欠陥が当たらないこと

`down` は鏡像である。**`official_ja_move` を巻き添えにしない**（`preset_id` で
`numeric` ／ `srk` に絞る）。巻き添えにすると表示が生 code へフォールバックし、
しかもエラーにならない。

三点更新に固有の非対称は残る。新規 DB を `v111` → `v110` へ降ろすと、`down` は
「その DB が `v110` 時点で本来持っていた状態」ではなく「是正前の状態」へ引き戻す。
**保証するのは往復で復帰することだけである**（`000063` ／ `000106` ／ `000107` ／
`000108` と共有する既存クラス）。

**★★ただし `000108` が持っていた「全降下で孤児行が残る」欠陥は本サブには当たらない。**
`000108` は `move_code` を改名したため、`000030.down` の code 列挙（golden 再生成で
新 code になっている）と down 後の行の code（旧 code へ戻っている）が食い違い、
`DELETE` が当たらなかった。**本サブは `move_code` を 1 文字も変えていない。⇒ `000026.down` ／ `000072.down` ／ `000073.down` の `m.code` 列挙は down の前後で当たり続ける。** この「当たらないこと」を down のヘッダに明記した（沈黙させない）。

### 5.6 検査

```
$ bash scripts/check-migration-license.sh --list | grep 000111
  B      新規       CC-BY-SA-4.0         000111_data_correct_rush_original_move_refs.down.sql
  B      新規       CC-BY-SA-4.0         000111_data_correct_rush_original_move_refs.up.sql

$ bash scripts/check-migration-license.sh
結果: 違反なし                                            (exit 0)
```

---

## 6. 段 3 — 測った結果（完了条件 5 / 6 / 7 / 8）

### 6.1 陽性対照（`preset_aliases` が 0 行 → 1 行ずつ）

是正前は §2.5 のとおり 4 件とも 0 行。**是正後は両プリセットに 1 行ずつ**入り、値は
`DR > 4MK` ／ `DR > 4HP` ／ `DR > 6HP` ／ `DR > 4HK` である。
`migrate_m3503_test.go` が **件数だけでなく値まで**固定している。

対照の `zangief/rush_power_stomps_1hits` は **`DR > 22MK` の 1 行のまま**変わっていない
（完了条件 8）。

総数は `numeric` 2272 → 2276 ／ `srk` 2300 → 2304（+4 ずつ）。

### 6.2 `original_move_id` が 4 行とも非 NULL（**両方の経路で**。完了条件 6）

| 経路 | どのテストが主張するか |
|---|---|
| **新規 DB** | `TestRun_M3503_FreshDBIsAlreadyCorrectBeforeTerminus`。`versionBefore(t, 111)` の時点で既に是正後であること＝golden 由来 |
| **既存 DB** | `TestRun_M3503_DownUpRoundTrip`。`down` で是正前の状態を作り、`re-up` で復帰することを見る |

**★新規 DB の状態テストだけでは足りない。** 新規 DB では `000111` の全文が 0 行に
当たるため、**何もしないマイグレでも状態テストは緑になる**（`M35-02` 教訓 §7-4 と同じ族）。
§9 の破壊確認 4 ／ 5 でこれを実測した。

往復では **`moves.id` の同一性**（参照が切れる形を取り落とさない。`SUPP-001` §5.5.4 (8)(iii)）
と **`alias_text` の byte 一致**も見ている。後者は、手書きの `000111` と生成器（`D-311` の
合成形）が同じ値に合意していることを示す唯一の手段である。

あわせて `TestRun_M3503_NoDanglingRushRemains` が「元技を解決できない `rush_variant` が
0 行」を **母数付き**で固定する（`v111` 時点の `rush_variant` は 514 行）。
4 行を名指しで見るテストだけだと 5 件目の dangling に気づけないためである。

### 6.3 セットプレイ自動提案の候補に 4 技が入る（完了条件 7）

`canary_setplay_projection_test.go` で是正前後の全数を射影し `diff` した。

```
2015a2016
> TARGET ingrid rush_glowing_touch_1hits
2016a2018
> TARGET ingrid rush_luminous_uppercut_1hits
2051c2053
< COUNT  ingrid filler=78 target=53
> COUNT  ingrid filler=78 target=55
2870a2873
> TARGET lily rush_desert_storm_1hits
2891c2894
< COUNT  lily filler=81 target=46
> COUNT  lily filler=81 target=47
3278a3282
> TARGET mai rush_hoshi_kujaku_1hits
3299c3303
< COUNT  mai filler=97 target=52
> COUNT  mai filler=97 target=53
（＋ sha256 行）
```

**動いたのは `TARGET` 4 行の追加と `COUNT` 3 行の更新だけである。**
`FILLER` は 1 行も動かず、他 28 キャラは byte 一致であった。
**⇒ 完了条件 7 と、完了条件 3 の「他 28 キャラ」に同時に答える実測になっている。**

契約としては `TestRun_M3503_SetplayTargetsGainTheFour` が、本番の
`setplay.ProjectCandidates` 経由で **是正前は入らず `v111` で入る**ことを対で固定している。

---

## 7. 版固定契約テストの追随（`SUPP-001` §5.5.4 規約 (16)）

**歯止め 4 つを守った。**

| 歯止め | どう守ったか |
|---|---|
| **(a)** その golden を再生成した手番でのみ触る | 触ったのは `000026` ／ `000072` ／ `000073` の版に依存するものだけ。**`migrate_m1403c_test.go`**（`000030` の版・`M35-02` が (16) を初適用した現物）**には 1 文字も触っていない** |
| **(b)** 要素数を減らさず対のまま入れ替える | `m2002RushNoOriginal` を削除せず `m2002RushLateResolved` へ改め、要素数 4 のまま「別名 0 行」→「別名 1 行ちょうど ＋ 値まで」へ反転した。**主張は強くなっている** |
| **(c)** 先に赤を実測する | 下記のとおり全部の赤を先に採った |
| **(d)** 見出しを役割で書き直す | 「元技を解決できず合成しなかった 4 行」→「元技を解決できるようになり合成した別名を持つ 4 行」 |

### 7.1 実測した赤（golden 再生成前）

```
--- FAIL: TestGolden_M2002NumericAliasesMatchesRegeneration
--- FAIL: TestGolden_M2002SRKAliasesMatchesRegeneration
--- FAIL: TestM2002_GenerationMeasurements/numeric
        層 C-rush = 264, want 260
        非投入 rush-no-original = 0, want 4
--- FAIL: TestM2002_GenerationMeasurements/srk
        層 C-rush = 269, want 265
        非投入 rush-no-original = 0, want 4
--- FAIL: TestGolden_CommittedMigrationMatchesRegeneration     (000026)
$ go run ./cmd/seedgen -check   →  DIFF: migrations/000026_... / exit 1
```

### 7.2 実測した赤（golden 再生成後）

```
migrate_m2002_test.go:433: numeric のエイリアス = 1249 行, want 1245
migrate_m2002_test.go:433: srk のエイリアス = 1264 行, want 1260
migrate_m2002_test.go:540: preset 3 に ingrid/rush_glowing_touch_1hits が投入されている（× 8 行）
migrate_test.go:966:  numeric alias count: got 2276, want exact 2272
migrate_test.go:966:  srk alias count:     got 2304, want exact 2300
rules_m1905_test.go:296: 旧ゲートの target 候補 = 907, want 903
rules_m1905_test.go:301: 新ゲートの target 候補 = 941, want 937
m2207b_third_stage_test.go:186: preset_aliases の行数 = 7637, want 7629
```

### 7.3 追随させた 5 ファイル

| ファイル | 終端 | 追随 |
|---|---|---|
| `internal/seedgen/generate_m2002_golden_test.go` | 生成器の実測 | `layerRush` 260 → 264 ／ 265 → 269、`rushNoOriginal` 4 → 0。**`layerB` ／ `layerA` ／ `collision` ／ `discarded` ／ `rushOrigUnfilled` は不変**（＝衝突が起きていないことの裏づけ） |
| `internal/infra/migration/migrate_m2002_test.go` | `v72` ／ `v73` | 表の反転（上記 (b)）／ 件数 `171+1074` → `171+1078`、`171+1089` → `171+1093` |
| `internal/infra/migration/rules_m1905_test.go` | `v68` | 903 / 937 → 907 / 941 |
| `internal/infra/migration/migrate_test.go` | HEAD | `numeric` 2272 → 2276 ／ `srk` 2300 → 2304 |
| `internal/aliasindex/m2207b_third_stage_test.go` | HEAD | 7629 → 7637（4 技 × 2 プリセット） |

**★`rushNoOriginal: 0` の主張は残した。** 削除すると dangling の再発を検出する床が
無くなる。`D-305` の「推測で元技を当てない」は 1 文字も変わっておらず、変わったのは
**推測しなくても解決できるようになったこと**である。

**★あわせて床を 1 本足した。** `migrate_m2002_test.go` に「`v73` 時点で
`original_move_id` が NULL の `rush_variant` が 0 行」を**母数付き**で入れた。
4 行を名指しで見るループだけだと 5 件目に気づけないためである。

**★HEAD スコープ 2 本は「期待値の更新が正しい対応」に当たる**（`SUPP-001` §5.5.2 (2)）。
`m2207b_third_stage_test.go` は同テスト自身が「seed 波のたびに更新する」と明記している。

### 7.4 ★訂正を 1 件記録する

`migrate_test.go` の件数更新を機械置換で行った際、**同ファイル内の履歴の算術**
（`numeric 1258 + 1014 = 2272` ／ `srk 1273 + 1027 = 2300`。`M14-03f` の記録）**も一緒に書き換えてしまった。** 気づいて同じ手番で元へ戻し、`M35-03` の `+4` は別行に
分けて書いた。**★機械置換は「値」と「歴史の記述」を区別しない。**

---

## 8. 新規に足したテスト

### 8.1 `internal/infra/migration/migrate_m3503_test.go`（新規・407 行）

`migrate_m3502_test.go` を型にした。**版数はテスト名にも定数にも直書きしない。**

**★★`m3503Before` は `versionBefore(t, 111)` で実測する。**
`000110` は並列レーン（`M31-05`）の払い出しで本ツリーに無く、`Migrate(110)` は
`no migration found` で落ちる。かといって `109` を直書きすると、`M31-05` が
マージされた瞬間に本テストは黙って **`M31-05` の `down` まで走らせる**ことになる。

| テスト | 何を固定するか |
|---|---|
| `V111State` | `original_move_id` が指す move の `code` まで（id の同一性＝(8)(iii)）／ 両プリセットの別名を値まで ／ `character_id` が `moves.character_id` と一致 |
| `FreshDBIsAlreadyCorrectBeforeTerminus` | **新規 DB の経路**。`versionBefore` の時点で既に是正後 |
| `DownUpRoundTrip` | **既存 DB の経路**。`moves.id` の同一性と `alias_text` の byte 一致。`official_ja_move` を巻き添えにしていないこと |
| `NoDanglingRushRemains` | 母数付きで 0 件 |
| `AliasCharacterIDIsWrittenByThisMigration` | `000111` の `INSERT` 自身が `character_id` を書いていること（§9-6 参照） |
| `SetplayTargetsGainTheFour` | 是正前は target に入らず `v111` で入る（本番の `ProjectCandidates` 経由・規則を二重に持たない） |

### 8.2 `internal/service/setplay/service_test.go`

`TestService_RushTargetRequiresResolvedOriginal` を足した。
**`OriginalMoveID` 以外のフィールドが 1 つも違わない 2 本**を並べ、解決側は出る ／
未解決側は出ないを対で固定する。`unique_rush` を名指しで選ぶ場合と、全種別を選ぶ場合の
両方を見ている（後者が無いと「種別に当たらなかっただけ」という説明が残る）。

**★実装は正しい。本テストが守るのはデータ側の前提である**——
「`original_move_id` が解けていないと候補にならない」。**⇒ ここが緑のままラッシュ版が提案に出ないときに疑うべきは規則ではなく seed である**、という道しるべを残した。

---

## 9. 破壊確認（**緑が本物であることを示す**）

**全 8 件を実測した。復元後は毎回 `git status --short` が空であることを確認している。**

| # | 壊したもの | 結果 |
|---|---|---|
| 1 | マイグレ名から `_data_` を外す | `check-migration-license.sh` が **`★静かな漏れ`** ／ **違反 2 件** ／ **exit 1**。改名候補まで提示される。復元して exit 0 |
| 2 | CSV の 1 セルを旧値へ戻す | **区分ごとに 1 件ずつ**（規約 (10)）。(a) `000026` 区分 … `-check` が **exit 1** ＋ `TestGolden_CommittedMigrationMatchesRegeneration` FAIL ／ (b) 別名 golden 区分 … `TestGolden_M2002{Numeric,SRK}AliasesMatchesRegeneration` FAIL |
| 3 | golden の 1 行を手編集（`DR > 6HP` → `DR > 6MP`） | `TestGolden_M2002NumericAliasesMatchesRegeneration` FAIL |
| 4 | `000111.up` の backfill を無効化 | **`DownUpRoundTrip` だけが赤。** `V111State` ／ `FreshDBIsAlreadyCorrect` ／ `NoDangling` ／ `SetplayTargets` は緑のまま |
| 5 | `000111.up` の `INSERT` を無効化 | 同上（`DownUpRoundTrip` だけが赤） |
| 6 | `INSERT` から `character_id` を落とす | **初回は赤にならなかった。**§9.1 を参照 |
| 7 | 4 件のうち 1 件の `move_code` を変える | 軸 B（`moveSurfacing.roster.test.ts`）が **4 → 5 で赤**。軸 A の走査は **0 件のまま**。⇒ 2 軸が別の機構で測られていることの機械照合 |
| 8 | `service.go:144` の分岐を外す | `TestService_RushTargetRequiresResolvedOriginal` と `TestRun_M3503_SetplayTargetsGainTheFour/是正前` が赤 |

**★4 と 5 が示すこと。** 新規 DB では `000111` の全文が 0 行に当たるため、
**何もしないマイグレでも状態テストは緑になる。** 往復テストだけがこの形を捕まえる。

### 9.1 ★★破壊確認 6 が最初は空振りした（**是正して再実測**）

`000111.up` の `INSERT` 列から `character_id` を落としても、**テストは緑のままだった。**

**守っていたのは `000111` ではなく `000074` の backfill であった。** 新規 DB を `v111` まで
上げただけでは、8 行は golden `000072` ／ `000073` が入れたものであり `000074` が後から
`character_id` を埋める。**⇒ `000111` の `INSERT` が列を落としていても `v111` 時点の `character_id` は正しいままになる。**

**`SUPP-001` §5.5.4 (10′) の一例である**——「テストが弱い」より先に「別の機構が代わりに
守っている」を疑う。守っていたものを特定したうえで、**ガードと同じ層へ主張を置き直した。**

- `TestRun_M3503_AliasCharacterIDIsWrittenByThisMigration` を `down` → `re-up` の後に
  `character_id` を直接読む形へ改めた（`000111` の `INSERT` が実際に走る唯一の経路）
- あわせて `assertCorrectedM3503` にも `character_id == moves.character_id` を入れ、
  `DownUpRoundTrip` の「`re-up` 後」でも見るようにした

**再実測: 列を落とすと 2 本が赤になる。**

```
--- FAIL: TestRun_M3503_DownUpRoundTrip
    re-up 後: numeric の ingrid/rush_glowing_touch_1hits で character_id が move と一致する行 = 0, want 1
    （8 行分）
--- FAIL: TestRun_M3503_AliasCharacterIDIsWrittenByThisMigration
    re-up 後の numeric の ingrid/rush_glowing_touch_1hits の character_id が NULL(000111 の INSERT が列を落としている)
```

**★これが破壊確認の存在理由そのものである。** 主張は書かれており、緑であり、
レビューでも読める形をしていた。**回して初めて空振りが見えた。**

---

## 10. 検査（**すべて出力で判定。常設検査は最後**）

| # | コマンド | 結果 |
|---|---|---|
| ★1 | `bash scripts/check-artifact-integrity.sh` | **違反なし**（検査 15 件の自己検査 ＋ 生成物 4 件が健全）／ exit 0。**1 本目に回した** |
| 2 | `go test ./...` | **FAIL 0 件** |
| 3 | `cd web && pnpm test` | **225 files / 2686 tests すべて緑** |
| 4 | `cd web && pnpm exec tsc --noEmit` | exit 0 |
| 5 | `bash scripts/check-migration-license.sh --list` | `000111` が **層 B ／ `CC-BY-SA-4.0`**。破壊確認も実測（§9-1） |
| 6 | `make e2e-only P=combo-crud` | **2 passed**（33.2s） |
| 7 | `bash scripts/check-import-order.sh` | **違反なし**。★下記 |
| 8 | `bash scripts/check-enum-sync.sh` | ベースラインどおり（増加なし） |
| 9 | `bash scripts/check-browser-storage-keys.sh` | 違反なし |
| 10 | `bash scripts/check-doc-refs.sh` | dead reference なし |
| 11 | `bash scripts/check-doc-inventory.sh` | 型に無いファイルなし |
| 12 | `bash scripts/check-md-emphasis.sh docs/progress/M35-03-completion-report.md` | **Phase C で実測して貼る** |
| 13 | `bash scripts/check-progress-log-index.sh` | **Phase D の後に回す** |

**★7 について。**`check-import-order.sh` は「現在 99 ファイル / ベースライン 101」と出し、
`BASELINE` を 99 へ下げるよう促す。**本サブ由来ではない**（着手前から在るずれ。本サブは
import 行を 1 行も足していない）。`M35-02` ／ `M31-04` も同じ申し送りをしている。
**共有スクリプトであり並列サブとの衝突面を増やさないため触っていない。⇒ 別の手番。**

---

## 11. 変更したファイル一覧と変更統計

```
$ git diff --stat 23b8a08
 character_data/ingrid.csv                          |   4 +-
 character_data/lily.csv                            |   2 +-
 character_data/mai.csv                             |   2 +-
 docs/instructions/reviews/M35-03-review-checklist.md |  75 ++++
 internal/aliasindex/m2207b_third_stage_test.go     |   8 +-
 internal/infra/migration/migrate_m2002_test.go     |  86 +++--
 internal/infra/migration/migrate_m3503_test.go     | 407 +++++++++++++++++++++
 internal/infra/migration/migrate_test.go           |  11 +-
 internal/infra/migration/rules_m1905_test.go       |  24 +-
 internal/seedgen/generate_m2002_golden_test.go     |  17 +-
 internal/service/setplay/service_test.go           |  71 ++++
 migrations/000026_seed_moves_first_wave.up.sql     |   8 +-
 migrations/000072_m20_seed_aliases_numeric.down.sql|   6 +-
 migrations/000072_m20_seed_aliases_numeric.up.sql  |  10 +-
 migrations/000073_m20_seed_aliases_srk.down.sql    |   6 +-
 migrations/000073_m20_seed_aliases_srk.up.sql      |  10 +-
 migrations/000111_..._rush_original_move_refs.down.sql |  91 +++++
 migrations/000111_..._rush_original_move_refs.up.sql   | 158 ++++++++
 web/src/features/combo/moveSurfacing.roster.test.ts|   8 +
 19 files changed, 950 insertions(+), 54 deletions(-)
```

**★生成器の実装は無差分である。** `internal/seedgen/generate_m2002.go` ／ `generate.go` ／
`csv.go` ／ `format.go` ／ `model.go` ／ `generate_m1702.go` ／ `generate_m2802a.go` は
**1 行も動いていない。**

**★★ただし `internal/seedgen/` というディレクトリの差分は 0 ではない**（2026-09-11・
レビュー 中-4 の採用で訂正）。`generate_m2002_golden_test.go` に `+17 / -4` がある。
**`SUPP-001` §5.5.4 規約 (16) に従って版固定の実測値を追随させたためである**（§7.3）。

**⇒ 完了条件 11「`internal/seedgen/` の差分が 0 である」は、字義どおりには満たせない。**
規約 (16) は「golden を再生成する手番では、その版に固定された契約テストの主張も
追随させてよい」と定めており、その対象テストが同ディレクトリに在るためである。
**★本報告の初版は「差分は 0 である」と書いており、§7.3 の表と矛盾していた**
（2026-09-11・レビュー 中-4 の採用で訂正）。

**★★【2026-09-11 裁定】同条件は「生成器の*振る舞い*」を指すと確定した。**
開発者が `internal/seedgen/generate_m2002.go` の失効コメントの是正を指示した
（レビュー 高-1）ため、**同条件がパッケージ全体の byte 差分を意味しないことが決まった。**
**⇒ 設計卓への確認事項ではなくなった**（§12-8 を解決済みへ）。

**★裁定を受けて `internal/seedgen/` へコメントのみの変更を 2 か所入れた**（§11.2）。
**生成物は 1 バイトも動いていない**——`go run ./cmd/seedgen -check` が
`OK: 生成物は既存ファイルと一致` / exit 0 を返し、`git diff --stat -- migrations/` は空である。

### 11.2 ★失効コメントの是正（2026-09-11・レビュー 高-1 の裁定取り込み）

| 箇所 | 何を直したか |
|---|---|
| `internal/seedgen/generate_m2002.go:635` 付近 | 「実データには…入力ミスが 4 件あり、DB 側では `original_move_id` が NULL になっている」は**現在形の事実記述であり、いま読むと誤り**だった（実測 0 件）。**過去形へ改め、いつ・誰が 0 件にしたかを対で書いた**（`D-775`）。**★ガードは残した**——`D-305` の「推測で元技を当てない」は 1 文字も変わっておらず、変わったのは *推測しなくても解決できるようになったこと* だけである。**★あわせて再発を検出する床 2 本を名指しした**（`generate_m2002_golden_test.go` の `rushNoOriginal: 0` ／ `migrate_m2002_test.go` の `v73` 母数付き 0 行）。⇒ ガードを外すと、その 2 本は緑のまま「推測で当てた別名」が投入される |
| `internal/seedgen/generate_m2002_test.go:308` | 「`D-305` の 4 行と同型」が**現存を含意していた**。**参照だけを過去形へ。** ★合成フィクスチャ（`rush_ghost` / `no_such_move`）自体は残す——**規則そのものを固定するものであり、実データの有無に依らない** |

**★この 2 か所以外は触っていない。** 走査で確認した——失効した現在形の記述はここだけである
（`ReasonRushNoOriginal` の godoc `:88` は「元技を解決できなかった行」であり、件数も現存も
含意していない）。

### 11.1 ★新規ファイルの上書き確認（教訓 `E-225`）

作る前に `ls` で同名の有無を確かめ、作った後に `git diff --numstat` の deletions を読んだ。

```
  +75     -0      docs/instructions/reviews/M35-03-review-checklist.md
  +407    -0      internal/infra/migration/migrate_m3503_test.go
  +91     -0      migrations/000111_data_correct_rush_original_move_refs.down.sql
  +158    -0      migrations/000111_data_correct_rush_original_move_refs.up.sql
```

**4 本とも `+` のみであり deletions は 0。⇒ 既存ファイルを上書きしていない。**

---

## 12. ■ 併せて更新が要るもの

| # | 対象 | 状態 |
|---|---|---|
| 1 | **CHANGE 番号の登録** | **該当なし。** 本サブの CHANGE 消費は 0 本であり、番号を払い出していない |
| 2 | **消費したマイグレ連番** | **`000111` を消費した。⇒ ボード §2.2 の「次に払い出す番号」の更新が要る。** ★ただし `000110` は並列レーン（`M31-05`）が消費予定であり本ツリーに存在しない。実査値はマージ後でないと確定しない。**製造はボードを直接編集しない**（`D-382`）。請求は設計伝達レポート §4 |
| 3 | **版を上げた文書の参照元** | **該当なし。** 設計書の版は上げていない |
| 4 | **`DES-004` §3.2.1 の注記が失効する** | **★本サブの着地で失効する。**「dangling 参照であり…4 件」は、これで 0 件になる。指示書 §3-5 が「直さない」と定めており CHANGE 予算も 0 本。**⇒ 設計卓へ CHANGE 候補として返す** |
| 5 | **`followup-backlog.md:328`（`rush-original-move-code-typo`）の状態** | **★「未着手」のまま。** 同ファイルは設計卓の手番である（`D-382`）。**⇒ 設計伝達レポート §4 で請求する** |
| 6 | **`internal/seedgen/generate_m2002.go:635` 付近のコメントが失効する** | **★★2026-09-11・開発者裁定で解決済み**（「修正してください」）。**過去形へ改め、ガードを残す理由と再発検出の床 2 本を明示した**（§11.2）。**★本報告の初版は「完了条件 11 なので触らない ⇒ 設計卓へ返す」と書いていた。⇒ 裁定で覆った** |
| 7 | **設計伝達レポート（完了条件 §6-15）** | **★未達である。** 開発者の判断（2026-09-10）で本手番では `/design_handover_report` を回さないことにした。**⇒ 別の手番で回す** |
| 8 | **★完了条件 11 の文言そのものに緊張がある** | **★★2026-09-11・開発者裁定で解決済み。⇒ 同条件は「生成器の*振る舞い*」を指す**（§12-6 の是正を指示したことで確定した）。**★パッケージ全体の byte 差分を意味しない。** ⇒ 設計卓への確認事項ではなくなった |
| 9 | **★規約 (16) の `grep` 手順が連番では取りこぼす** | §2.7 の実地の反証。`rules_m1905_test.go` は `000026` を 1 度も持たないのに必ず動いた。**⇒ `SUPP-001` §5.5.4 (16) へ手順として畳むかを設計卓が決める** |
| 10 | **★`followup-backlog.md:344` の重複行** | **`rush-variant-dangling-original-move-code`** が `:328` と同じ 4 件を指す重複行として在り、`未割付` ／ `未着手` のまま。**★本報告の初版はこの行を挙げていなかった**（2026-09-11・レビュー 高-2 の採用で追記）。**⇒ `:328` と同時に畳むこと。片方だけ畳むと、残った方を読んだ後任が同じ調査をやり直す** |

**★★★上記 4 / 5 / 6 / 8 / 9 / 10 の回収先を、この手番のうちに確保した**（うち **6 と 8 は同日の開発者裁定で解決済み**。2026-09-11・
レビュー 高-2 の採用）。設計伝達レポートを回さない以上、完了報告の表にだけ書いても
後任が本報告を開かない限り誰にも届かない。**⇒ `docs/handover/followup-backlog.md` §J 停止時記録へ必須 5 フィールドつきで 3 行を登録した**（`CLAUDE.md` §10.Y は §J が製造の書ける唯一の面と定めている）。

| §J のスラッグ | 何を回収するか |
|---|---|
| `m35-03-stale-records-after-dangling-fix` | 失効記述 4 件（§12-4 / -5 / -10 / -6）＋ 完了条件 11 の裁定（§12-8）。**★2026-09-11 の裁定で -6 と -8 は解決済み。⇒ 残るのは設計卓の手番である -4 / -5 / -10 の 3 件である** |
| `regulation-16-grep-by-sequence-misses-column-pinned-tests` | §12-9 |
| `import-order-baseline-101-vs-99` | §10 の申し送り（3 サブ連続で誰も引き取っていない） |

---

## 13. レビュー結果

**★本節は Phase C で埋める。** レビューは Phase B の fresh subagent がこれから実施する。

- レビュー報告書: `docs/progress/m35-03-review.md`（**Phase B で作成される。この時点では未作成**）
- 指摘の件数と優先度別内訳: **Phase C で埋める**
- 各指摘の採否と理由: **Phase C で埋める**
- 「高」指摘の不採用が 0 件かどうか: **Phase C で埋める**
- 再レビュー往復の回数: **Phase C で埋める**

---

*以上、M35-03 完了報告。* **★本サブの落とし穴は 2 つだった。**
**1 つは「`M35-02` と同じ」と読むことである。壊れている列が違い、`original_move_id` が NULL であり、入力面には出ていた。⇒ 同じなのは「三点更新」という形だけである。**
**もう 1 つは §9.1 である——`character_id` の主張は書かれていて緑だったが、守っていたのは `000074` の backfill であり、本サブのマイグレではなかった。**
