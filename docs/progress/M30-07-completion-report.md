# M30-07 完了報告 — 【ジャスト】版の `move_code` を接尾形へ揃える（ガイル 3 ファミリー）

| 項目 | 内容 |
|------|------|
| 作業 ID | **M30-07** |
| 指示書 | `docs/instructions/M30-07-perfect-variant-code-suffix.md` **v1.0.1** |
| チェックリスト | `docs/instructions/reviews/M30-07-review-checklist.md` v1.0.1 |
| 実施日 | 2026-09-12 |
| 着手基点 | `5ec1534` |
| CHANGE 消費 | **0 本**（`D-293`。`DES-004` §2.1 の as-built 書き換えは受理の手番で設計卓が行う） |
| マイグレ消費 | **1 本＝`000112`**（設計卓払い出し済み＝`D-836`。着手時に `ls migrations/` の最新が **`000111`** であることを実査した） |
| レビュー | `docs/progress/m30-07-review.md`（**Phase B で作成。Phase C で結果を §9 へ記入する**） |

---

## 1. 何をしたか（3 行）

**同じ「【ジャスト】版」という UI 概念が、キャラによって別の見え方をしていた。** ガイルの `move_code` 10 件を接頭形 `perfect_timing_<強度>_<技>` からルークと同じ接尾形 `<技>_perfect_<強度>` へ揃え、**CSV 正本 ／ golden 再生成 ／ 追随マイグレの三点**を揃えた。

**★本サブは先行 3 サブの床を動かす側である** —— ファミリー総数が **372 → 369** になり、`M30-04` / `M30-05` / `M30-06` が「不変」として持っていた値が動いた。**床は 1 か所も緩めていない。**

---

## 2. 段 1 — 実測（**すべて着手時に数え直した。`M30-05` の写しは使っていない**）

| # | 項目 | 値 | 種別 |
|---|---|---|---|
| 1 | 【ジャスト】を持つ `move_code`（CSV 31 キャラ全数） | **13**（guile 10 ／ luke 3） | **実測** |
| 2 | うち **接頭形**（`perfect_timing_*`） | **10**（全て guile） | **実測** |
| 3 | うち **接尾形**（`*_perfect_<強度>`） | **3**（全て luke） | **実測** |
| 4 | 2 ＋ 3 の合計 | 13 ＝ 1 と一致 | **算出** |
| 5 | 【ホールド】/【最大ホールド】の全数 | **83** | **実測** |
| 6 | うち接尾形（`_holding` / `_max_holding`） | **83**（＝**接頭形は 0 件**） | **実測** |
| 7 | `original_move_code` が `perfect_timing_*` を参照する行 | **0 行** | **実測** |
| 8 | 改名先 `*_perfect_*` の既存衝突 | **0 件**（`_perfect` を持つのは luke の 3 件だけで guile 側は空き） | **実測** |
| 9 | 畳まれる raw ファミリー | **3 件** | **実測** |
| 10 | ファミリー総数 | **372 → 369** | **実測**（§6） |

**⇒ `M30-05` の「guile 10 / luke 3」「【ホールド】系の揺れ 0 件」は、数え直した結果と一致した。**

**★判別できなかった行は 0 件である。**

### 2.1 改名表（10 件）

```
perfect_timing_light_sonic_boom       → sonic_boom_perfect_light
perfect_timing_medium_sonic_boom      → sonic_boom_perfect_medium
perfect_timing_heavy_sonic_boom       → sonic_boom_perfect_heavy
perfect_timing_light_somersault_kick  → somersault_kick_perfect_light
perfect_timing_medium_somersault_kick → somersault_kick_perfect_medium
perfect_timing_heavy_somersault_kick  → somersault_kick_perfect_heavy
perfect_timing_light_sonic_cross      → sonic_cross_perfect_light
perfect_timing_medium_sonic_cross     → sonic_cross_perfect_medium
perfect_timing_heavy_sonic_cross      → sonic_cross_perfect_heavy
perfect_timing_sonic_cross_od         → sonic_cross_perfect_od
```

**★命名は `DES-004` §2.1（v1.32.0・版ゲート充足を実査）と `splitSpecialVariant` の接尾辞 `_perfect` に従う。** ルークが正であり、ルーク側は 1 文字も触っていない。

---

## 3. ★★★射程の変化（指示書 §7 の停止条件 (2) に該当・開発者裁定を得た）

**`preset_aliases` 以外に `move_code` を参照している面が 3 つ見つかった。** いずれも `000112` より**前の版**で `code` 文字列により行を解決している**適用済みマイグレ**である。

### 3.1 破壊確認 —— 追随させないと何が起きるか（**実測**）

golden `000026` を再生成し、`000039` / `000063` / `000064` を**旧 code のまま**にした状態で新規 DB を作り、新設した契約テストを回した実測が次である。

```
--- FAIL: TestRun_M3007_EarlierMigrationsFollowed
    sonic_boom_perfect_light の is_projectile = 0, want 1 (000039 の code 列挙が追随していない)
    …（飛び道具 7 行すべて）
    sonic_boom_perfect_light の startup_basis = "unknown", want "standalone" (000064 …)
    …（10 行すべて）
    sonic_cross_perfect_od の move_derivations = 0 対, want 3 (000064 の D ブロック …)
--- FAIL: TestRun_M3007_NoResurrectedOldCode
    旧 code perfect_timing_sonic_cross_od が 1 件 復活している(000063 B-2 のガードが反転した疑い)
    sonic_cross_2_meter_od = 0 件, want 1 (000063 B-2 が誤改名した疑い)
```

| マイグレ | 何が落ちるか |
|---|---|
| `000039`（v39） | ジャスト版 **7 行**の `is_projectile` が 0 のまま。⇒ 有利フレーム自動走査が相手技候補として誤って拾う |
| `000063`（v63） | **最も重い。** B-2 の `NOT EXISTS` ガードが**反転して通り**、`sonic_cross_2_meter_od`（ODソニッククロス２）が旧 code へ**誤改名**される。UNIQUE 違反も起きずマイグレは成功する |
| `000064`（v64） | ジャスト版 **10 行**の `startup_basis` が `unknown` のまま ／ `move_derivations` **3 対**が入らない。**★誤改名後は別の技へ書き込まれる** |

**★★どれもエラーにならない。`go test` も lint も型検査も緑のままである。**

### 3.2 先例はこの面を踏んでいなかった（**実測**）

| 先例 | 改名 code が `000039` / `000064` に在るか |
|---|---|
| `M35-02`（ryu `axe_kick_2`） | **0 件** |
| `M28-05`（terry `quick_burn_light`） | **0 件** |
| `M30-02` 追補（terry `round_wave_heavy`） | **0 件** |

**⇒ `M30-07` が、後続の手書きマイグレから参照されている `move_code` を改名する初の手番である。**

### 3.3 採った形＝案 1（開発者裁定 2026-09-12）

**適用済みマイグレの `code` 列挙を書き換える。** 先例は `000063` のヘッダ自身が持つ —— 逐語「`is_projectile の追随は 000039 の code 列挙の書き換えで行った(指示書 §2.5 の案 1)`」（`M19-04c`）。

- **列挙の要素数・文の本数・ガードの形は 1 つも変えていない**（`+32 / -32` の対称な置換）。
- `000063` B-2 の見出しコメントは**由来ではなく役割で書き直した**（規約 (16) 歯止め (d)）。旧コメントは sed 置換によって「`perfect_timing_` 接頭辞は既存」という**失効した記述**になっていた。
- 3 本のヘッダへ「なぜ適用済みマイグレを触ったか」「追随を落とすと何が静かに壊れるか」「床はどのテストか」を記録した。

### 3.4 却下した案

| 案 | 却下理由 |
|---|---|
| `000112` で補償 `UPDATE` を打つ（適用済みマイグレは触らない） | **v39〜v111 の中間状態が壊れたままになる。** とくに `000063` の誤改名は「別の技へフレーム値と派生が書き込まれた」という事実を残す。⇒ 補償では消えない |
| CSV を触らずマイグレだけで改名する | **CSV が正本である**（`go test ./internal/seedgen/` が golden との byte 一致を固定している）。⇒ CSV を外すと次の seed 波で旧 code が復活する |

> **★★★【2026-09-12 是正・レビュー 高-1】上の案比較は片手落ちであった。**
>
> `SUPP-001` §5.5.4 **規約 (9)** が名指ししているとおり、**採った案 1 の側にも中間版コホートの欠陥が残る。** 当初の本節は案 2 の欠点だけを書いており、規約 (9) の後段「片方だけの欠点として書くと案比較が片手落ちになる」に正面から当たっていた。**⇒ 案 1 にも救済が要る。詳細は §3.5。**

### 3.5 ★★★前コホート救済 UPDATE（`SUPP-001` §5.5.4 規約 (9)・レビュー 高-1 の是正）

**案 1 は「旧 golden で seed され、途中の版で止まった DB」（中間版コホート）に欠陥を残す。** 書き換えた `000034` / `000039` / `000064` が旧 code の行を 1 行も拾えないためである。**エラーにならず、`go test` も lint も型検査も緑のままである。**

| 止まっていた版 | 取り落とすマイグレ | 何が残るか | 件数 |
|---|---|---|---|
| v26 〜 v33 | `000034`（is_derived backfill） | 【ジャスト】行が `is_derived = 0` | **10 行** |
| v26 〜 v38 | `000039`（is_projectile backfill） | 飛び道具行が `is_projectile = 0` | **7 行** |
| v26 〜 v63 | `000064`（startup_basis 人手値） | `startup_basis = 'unknown'` のまま | **10 行** |
| v26 〜 v63 | `000064`（D ブロック） | `move_derivations` が入らない | **3 対** |

**⇒ `000112.up` の末尾へ救済 4 文を置いた。** いずれも `AND <列> = <未設定値>`（`move_derivations` は `NOT EXISTS`）で守られており、**健全な DB では 0 行に当たる**。`down` では戻さない（`000063` の A'/B' と同じ理由 —— 戻すと健全な DB を壊す）。

**先例＝`000063` の A'/B' ブロック**（v26〜v38 の is_projectile 救済）。同じ形をなぞった。

### 3.6 ★★★もう 1 つの欠陥 —— `000063` B-2 のガードが**旧 golden コホートで**反転する

**案 1 の書き換えそのものが新しい欠陥を作っていた。** `000063` B-2 の `NOT EXISTS` を新 code だけに書き換えると、**旧 code を持つ中間版 DB では「改名先が不在」に見えてガードが通り**、`sonic_cross_2_meter_od`（ODソニッククロス２）が旧 code へ**誤改名**される。

**⇒ ガードを `code IN ('<新>', '<旧>')` の両対応にした。** 3 つの経路すべてで正しく閉じる：

| 経路 | 在る code | B-2 の結果 |
|---|---|---|
| (a) 新 golden の新規 DB | `sonic_cross_perfect_od` | **0 行**（改名済み） |
| (b) 旧 golden の中間版 DB | `perfect_timing_sonic_cross_od` | **0 行**（改名済み） |
| (c) 本来の未適用 DB | どちらも不在（`sonic_cross_3_meter_od` を持つ） | **1 行**（本来の改名） |

### 3.7 ★★★「救済は要らない」は推論では決めない —— 実測が 1 件反証した

**`move_derivations` の 3 対について、当初は「取り落としの経路が無い」とヘッダへ書いた。** 新設した `TestRun_M3007_OldGoldenCohortReachesHead` が**実測で反証した** —— 旧 golden の中間版 DB では v64 の時点で子がまだ旧 code であり（B-2 のガードが**正しく閉じる**ため改名されない）、`000064` の D ブロックが 1 対も入れられない。

**⇒ 救済 4 を足した。★コホートを再現するテストを書くまで、この 1 件は見えなかった。**

### 3.8 破壊確認（救済と ガードが実際に効いていること）

| # | 壊した箇所 | 結果 |
|---|---|---|
| 1 | `000112.up` の救済 4 文を**撤去** | `TestRun_M3007_CohortRescue` / `TestRun_M3007_OldGoldenCohortReachesHead` が **FAIL**（`is_derived = 0, want 1` ／ `startup_basis = "unknown", want "standalone"` ／ `is_projectile = 0, want 1` を 10 行ぶん） |
| 2 | `000063` B-2 のガードを**新 code だけ**へ戻す | `TestRun_M3007_OldGoldenCohortReachesHead` が **FAIL**（`perfect_timing_sonic_cross_od = 1 件, want 0` ／ `sonic_cross_2_meter_od = 0 件, want 1 (000063 B-2 のガードが反転して誤改名した)`） |

**⇒ どちらも撤去後に `git diff` で差分 0 を確認し、元へ戻してある。**

### 3.9 規約 (8)(ii) の事前実測（レビュー 中-5 の是正）

**v111 の DB（＝開発者の手元が居る版）へ、`000112` の `WHERE` 句そのものを流した実測：**

```
改名 10 文 …… すべて 0 行（改名先はいずれも「占有 1 件(＝改名済み)」）
救済 1 is_derived(対象 10 件) ……… 0 行
救済 2 is_projectile(対象 7 件) …… 0 行
救済 3 startup_basis(対象 10 件) … 0 行
救済 4 move_derivations ………… 0 行
```

**⇒ 健全な DB では 14 文すべてが 0 行に当たる。** 規約 (8)(ii) が求める事前担保である。

---

## 4. 三点更新 1・2 — CSV 正本と golden

### 4.1 CSV（`character_data/guile.csv`）

`move_code` 列**のみ** 10 件を変更した。**`name_ja` / `command` / フレーム列は 1 バイトも触っていない**ことを機械的に確かめた：

```
$ git diff -U0 character_data/guile.csv | grep -E '^[+-]guile' \
    | sed -E 's/^[+-]guile,[^,]*,//' | sort | uniq -c | awk '$1!=2{...}'
OK: 10 組すべてが +/- で対。⇒ move_code 列以外は 1 バイトも変わっていない
```

### 4.2 先に赤を実測してから再生成した（規約 (16) 歯止め (c)）

```
$ go test ./internal/seedgen/
--- FAIL: TestGolden_DerivedBackfillMatchesRegeneration
--- FAIL: TestGolden_CommittedMigrationMatchesRegeneration
$ go run ./cmd/seedgen -check
DIFF: migrations/000026_seed_moves_first_wave.up.sql は生成物と一致しません
DIFF: migrations/000026_seed_moves_first_wave.down.sql は生成物と一致しません
```

### 4.3 再生成に使ったコマンド（**手編集していない**）

```bash
go run ./cmd/seedgen
go run ./cmd/seedgen -mode derived-backfill \
  -chars terry,guile,lily,ingrid,kimberly,juri,ken,mai,zangief,ryu \
  -out 000034_backfill_moves_is_derived \
  -note "M17-02: 投入済み 10 キャラの is_derived backfill(CHANGE-069 §2.1-d。CSV に載る code のみ UPDATE)"
```

### 4.4 動いた golden は 2 本（**先例 4 本と内訳が違う**）

| golden | 差分 |
|---|---|
| `000026_seed_moves_first_wave` | up 40 行 ／ down 4 行 |
| `000034_backfill_moves_is_derived` | up 1 行 ／ down 1 行 |
| `000035_seed_move_commands` | **差分 0** |
| `000072` / `000073`（numeric / srk） | **差分 0** |

**★`000035` / `000072` / `000073` が動かなかった理由**（推測ではなく機序）：ジャスト版は全数 `is_derived=true` であり、`000035` は**非派生のみ搭載**する。別名生成の層 A / 層 B も `is_derived=true` の行には当たらず、層 C-3（`noInputDerivedTargets`）に guile は 1 件も無い。**⇒ 実測でも `-check` は緑であった。**

### 4.5 ★`preset_aliases` の追随（チェックリスト B-1）

**`preset_aliases` の行は `move_code` 列を持たない。** 持つのは `move_id` である（`DES-003` §3.14）。`move_code` は **seed SQL の中で INSERT 先を解決するために使われる**（`DES-004` §2.1 の「解決キー」はこの意味）。

**⇒ 追随したのは golden `000026` の `official_ja_move` 別名 10 行である**（実測。`000026.up.sql` の新 code 出現 20 行の内訳＝moves INSERT 10 ＋ preset_aliases 10）。**`000112` 側に `preset_aliases` の追随 `UPDATE` は要らない** —— `moves.id` は改名で変わらないためである。**★これを実測で裏づけたのが `TestRun_M3007_LinksSurvive`**（改名の前後で `move_id` が同一であり、別名が付いたままであることを 10 行すべてで固定する）。

**`down` も対になっている** —— `000026.down` の削除対象 code 列挙が新 code へ追随している（再生成の成果物）。

### 4.6 `moves.original_move_code` の参照（チェックリスト B-2）

**0 件**（実測。§2 の項目 7）。`M35-03` が直した列だが、本サブの 10 件を参照している行は 1 行も無い。

---

## 5. 三点更新 3 — マイグレ `000112`

| 項目 | 内容 |
|---|---|
| ファイル | `migrations/000112_data_correct_guile_perfect_variant_codes.{up,down}.sql` |
| 番号 | **`000112`**（設計卓払い出し＝`D-836`。**自採番していない**） |
| 層 | **B**（SF6 の事実 ＝ `moves` へ書く）⇒ 名前に `_data_` を含む |
| 文数 | up 10 文 ／ down 10 文（**down は up の逆順**） |
| ガード | `character_id` 絞り込み ＋ 旧 code ＋ **`NOT EXISTS`**（`SUPP-001` §5.5.4 (8)） |
| 新規 DB での挙動 | **0 行に当たって成功する**（golden が既に是正済みのため） |
| DDL | **無し**（DML のみ） |

**★改名の順序制約は無い** —— 改名先 10 件は着手時点ですべて空きであった（§2 の項目 8）。`000063` の B-2 → B-3 のような順序依存は要らない。

### 5.1 契約テスト（**新設**・`internal/infra/migration/migrate_m3007_test.go`）

**★作る前に `ls` で同名の不在を確認した**（`E-225`）。**変更統計上も新規 3 ファイルは `+` だけである**（§8）。

| テスト | 何を固定するか |
|---|---|
| `TestRun_M3007_V112State` | v112 の最終状態（旧 0 件・新 1 件を**対で**）＋ **v111 の時点で既に新 code であること**（`000112` の UPDATE が新規 DB では 0 行に当たることの根拠） |
| `TestRun_M3007_VariantFoldsIntoBase` | **本サブの目的そのもの** —— 新 code が `<基底>_perfect_<強度>` であり、**その基底が実在すること**（`splitSpecialVariant` が畳む必要十分条件）。★ルーク側が不変であることも対照で見る |
| `TestRun_M3007_EarlierMigrationsFollowed` | §3 の 3 面（`is_projectile` 7 行 ＋ 非飛び道具 3 行の**対** ／ `startup_basis` 10 行 ／ `move_derivations` 3 対） |
| `TestRun_M3007_NoResurrectedOldCode` | `000063` B-2 のガード反転（旧 code の復活 ／ `sonic_cross_2_meter_od` が別行として在ること ／ そこへ【ジャスト】側の派生が付いていないこと） |
| `TestRun_M3007_DownUpRoundTrip` | down → re-up の往復。**`move.id` が同一であること**（改名が DELETE+INSERT になっていないこと。`SUPP-001` §5.5.4 (8)(iii)） |
| `TestRun_M3007_LinksSurvive` | `preset_aliases` の紐付きが改名で切れないこと（10 行すべて・up / down 双方） |

**★終端は `v112` であり HEAD ではない**（規約 (1)）。

---

## 6. 段 4 — 先行 3 サブの床（**372 → 369**）

### 6.1 ★★★減った 3 件が意図した 3 件そのものであることの証明

**「赤かったので直した」ではない。** 新しい 369 行の一覧へ、**消えた 3 行だけ**を足し戻して digest を取り直した：

```
- 新 識別子 digest: 525b584c866af7cdcfa8c0f956d0d003168ee62efc72f806c87257c64532fdb5
- 新 表示名 digest: 6835bedfb8a09d842b985b82b37170af740da686052d96834bee9a4b97724036

再構成（新しい 369 行 ＋ 消えた 3 行）:
- 識別子 372 行 digest: b54d118393a8f9812de25fbf495f605073de188c410dfa1f6db70c2d6f242417
  着手前の digest:      b54d118393a8f9812de25fbf495f605073de188c410dfa1f6db70c2d6f242417  → 一致: True
- 表示名 372 行 digest: a7ee6db54b6a94c5548d9839804cb0fe42aa72363b3b17f1fe3d2b343e79465f
  着手前の digest:      a7ee6db54b6a94c5548d9839804cb0fe42aa72363b3b17f1fe3d2b343e79465f  → 一致: True
```

消えた 3 行（**名指し**）：

```
guile/perfect_timing_sonic_boom      = 【ジャスト】ソニックブーム
guile/perfect_timing_somersault_kick = 【ジャスト】サマーソルトキック
guile/perfect_timing_sonic_cross     = 【ジャスト】ソニッククロス
```

**⇒ 残る 369 行は 1 文字も動いていない。`372 − 369 = 3` はガイルの `perfect_timing_*` 3 ファミリーそのものである。**

### 6.2 更新した箇所の**全数**（チェックリスト A-1 / A-6）

| # | ファイル | 何を | 旧 → 新 |
|---|---|---|---|
| 1 | `moveSurfacing.roster.test.ts` | 規則 1/3 で判定が付く special 総数 | **919 → 928**（A2 105 → 96） |
| 2 | 〃 | ファミリー総数 | **372 → 369**（guile 9 → 6） |
| 3 | 〃 | 末尾群（`isDerived`） | **178 → 175**（guile 6 → 3）。**先頭群 194 は不変** |
| 4 | 〃 | 陽性対照「末尾に居なかった件数」 | **47 → 46**（guile 1 → 0） |
| 5 | 〃 | `isDerived` 全数独立主張の件数 | **372 → 369** |
| 6 | 〃 | **混在ファミリーの一覧** | **5 → 7 件**（`guile/sonic_boom` / `guile/somersault_kick` が**増えた**） |
| 7 | `specialFamilyLabel.roster.test.ts` | (A) 群の件数 | **23 → 20**（★下記 6.3） |
| 8 | 〃 | ファミリー総数 | **372 → 369** |
| 9 | 〃 | **識別子 digest** | `b54d1183…` → `525b584c…` |
| 10 | 〃 | **表示名 digest** | `a7ee6db5…` → `6835bedf…` |
| 11 | 〃 | `is_derived` の並び | 194 / **178 → 175** |
| 12 | `specialFamilyRepresentativeName.roster.test.ts` | `DIVERGENT_FAMILIES` の識別子 | `perfect_timing_sonic_cross` → `sonic_cross_perfect`（**10 件のまま**） |
| 13 | 〃 | `foldedAway`（変種として畳まれ行にならない raw ファミリー） | **1 → 2 件**（**増えた**） |
| 14 | `inputResolution.test.ts` | `parseSpecialCode` の規則 2 の例 | seed から消えた code → 実在する A2 行へ差し替え |
| 15 | `web/e2e/m30-05-family-label-strength-word.spec.ts` | 消えたファミリー行の主張 | 1 本 → **2 本**へ差し替え ＋ **新 test 1 本を追加** |

### 6.3 ★★★床を緩めていないこと（チェックリスト A-2）

**件数のアサートを消した／digest の比較を外した／`toBe` を `toBeGreaterThan` に変えた箇所は 1 つも無い。**

**件数が減った 2 か所は、いずれも同じ強さの主張へ差し替えてある：**

| 減った箇所 | 差し替え先 |
|---|---|
| (A) 群 23 → 20（`specialFamilyLabel`） | **`EXPECTED_FOLDED_PERFECT` を新設**（3 件）。「同じ 3 概念が基底の `perfect` 変種として在り、代表名が正しく、**変種側の move の `name_ja` に【ジャスト】が残っている**」ことを主張する。⇒ **20 ＋ 3 = 23。着手前と同数である** |
| E2E の guile 1 本 | **2 本へ差し替え**（基底行の表示名 ＋ 【ジャスト】変種が在ること）＋ **新 test「ルークとガイルの【ジャスト】版が同じ形で選べる」**（4 ファミリー × 陽性 ＋ 旧 3 行の**陰性対照**） |

**逆に増えた 2 か所（6.2 の #6 / #13）は、いずれも本サブの成果が現れたものである**（畳んだ結果、混在ファミリーと「畳まれて行にならない raw ファミリー」がそれぞれ増えた）。

### 6.4 なぜ 194 が動かず 175 だけが動くのか（機序）

畳まれた 3 ファミリーはいずれも `isDerived=true` であった。合流先の分類は 1 件も変わらない —— `sonic_boom` / `somersault_kick` は素が `is_derived=false` なので `false` のまま、`sonic_cross` は全メンバー `true` なので `true` のまま。**⇒ 減るのは末尾群だけである。**

### 6.5 なぜ 919 → 928 なのか（機序）

改名により、**9 件**が「強度語が code の途中に在る形（A2・規則 2）」から「末尾に強度語がある形（A1・規則 1）」へ移った。**⇒ A2 は 105 → 96**（実測）、規則 1/3 で判定が付く側は `1024 − 96 = 928`。**10 件目の `sonic_cross_perfect_od` は改名前から末尾が `_od` であり、もともと規則 1 側に居た。**

---

## 7. 段 3 — 規約 (16) の手順（チェックリスト C-1 / C-2）

**連番（`000026` 等）の `grep` は使っていない。** 値が変わる 10 件の code で `*_test.go` を引いた。

| ファイル | 終端 | 動いたか | 扱い |
|---|---|---|---|
| `internal/infra/migration/migrate_m1904c_test.go` | **v63** | 動いた | 追随（1 対 1 置換） |
| `internal/infra/migration/migrate_m19p2_test.go` | **v65** | 動いた | 追随（3 行を 1 対 1 置換） |
| `internal/infra/migration/rules_m1905_test.go` | **v68** | 動いた | 追随 ＋ **並び順の是正**（`sonic_cross_perfect_od` は `sonic_cross_od` の後ろへ来る。**11 件のまま**） |
| `internal/seedgen/generate_m2002_test.go` | — | **動かない** | **触っていない**（golden 由来ではない合成 fixture。実在しない code を入力に使うことが主張の趣旨を損なわない型） |

**先に赤を実測した**（歯止め (c)）：

```
--- FAIL: TestRun_M1904c_V63State      guile の perfect_timing_sonic_cross_od = 0 件, want 1
--- FAIL: TestRun_M1904c_DownUpRoundTrip
--- FAIL: TestRun_M19P2_ManualBackfill move_derivations に guile/perfect_timing_sonic_cross_od <- sonic_blade_light が 0 件, want 1
--- FAIL: TestM1905_Gate2_SoloUnavailable ゲート 2 の除外行(standalone 由来): [0] = "guile/sonic_cross_heavy", want "guile/perfect_timing_sonic_cross_od"
```

**歯止め (a)**（golden を再生成した手番でのみ触る）を満たす。**(b)** 要素数は 1 件も減っていない（3 本とも 1 対 1 の置換であることを diff で確認）。**(d)** 3 本のヘッダへ、由来ではなく役割で追随の理由を書いた。

### 7.1 `web/e2e` の洗い出し（`SUPP-001` §5.5.7 (i)・チェックリスト C-5）

```
$ grep -rn "items.length).toBe(" web/e2e
  m14-03e-third-wave-seed.spec.ts:45   （第三波。guile は第一波であり無関係）
  m19-02-suggestion-refinement.spec.ts:93  （toBe(0)。技の件数ではない）
  m14-03d-manon-seed.spec.ts:49        （manon 82 件）
$ grep -rn "moves\[moves.length - 1\]" web/e2e
  support/editor-input.ts:93           （コメント内の説明。実コードではない）
```

**⇒ 本サブは行を 1 行も増減させない（改名のみ）ため、件数固定の spec には 1 件も当たらない。** 動いたのは `m30-05` の 1 本だけである（§6.2 #15）。

---

## 8. 変更統計（`git diff --stat 5ec1534`）

```
 character_data/guile.csv                           |  20 +-
 internal/infra/migration/migrate_m1904c_test.go    |   9 +-
 internal/infra/migration/migrate_m19p2_test.go     |  13 +-
 internal/infra/migration/migrate_m3007_test.go     | 387 +++++++++++++++++++++
 internal/infra/migration/rules_m1905_test.go       |   9 +-
 migrations/000026_seed_moves_first_wave.down.sql   |   4 +-
 migrations/000026_seed_moves_first_wave.up.sql     |  40 +--
 .../000034_backfill_moves_is_derived.down.sql      |   2 +-
 migrations/000034_backfill_moves_is_derived.up.sql |   2 +-
 migrations/000039_add_moves_is_projectile.up.sql   |  13 +-
 .../000063_correct_moves_data_m1904c.down.sql      |   2 +-
 migrations/000063_correct_moves_data_m1904c.up.sql |  20 +-
 .../000064_backfill_frame_cost_manual.down.sql     |  33 +-
 .../000064_backfill_frame_cost_manual.up.sql       |  37 +-
 ...ta_correct_guile_perfect_variant_codes.down.sql | 118 +++++++
 ...data_correct_guile_perfect_variant_codes.up.sql | 155 +++++++++
 web/e2e/m30-05-family-label-strength-word.spec.ts  |  51 ++-
 web/src/features/combo/inputResolution.test.ts     |  10 +-
 .../features/combo/moveSurfacing.roster.test.ts    |  66 +++-
 .../combo/specialFamilyLabel.roster.test.ts        | 103 +++++-
 .../specialFamilyRepresentativeName.roster.test.ts |  23 +-
 21 files changed, 1001 insertions(+), 116 deletions(-)
```

**★新規 3 ファイルの `--numstat` は `+` だけである**（`E-225` の観点）：

```
387  0  internal/infra/migration/migrate_m3007_test.go
118  0  migrations/000112_data_correct_guile_perfect_variant_codes.down.sql
155  0  migrations/000112_data_correct_guile_perfect_variant_codes.up.sql
```

**⇒ 「新規のつもりのファイル」に deletions は 1 行も無い。**

---

## 9. レビューと取り込み（Phase C・自動トリアージ）

- レビュー報告書: **`docs/progress/m30-07-review.md`**（Phase B・fresh subagent。`fork` は使っていない）
- 指摘の件数: **7 件**（高 **2** ／ 中 **5** ／ 低 0）
- **★「高」指摘の不採用は 0 件である**（2 件とも採用）
- 再レビュー往復: **0 回**（上限 2 回に未達。停止規律に抵触しない）

| # | 優先度 | 指摘 | 採否 | 理由・対応 |
|---|---|---|---|---|
| 高-1 | 高 | `SUPP-001` §5.5.4 規約 (9)「前コホート救済 UPDATE」が無い。あわせて否定する断定が 4 か所に失効記述として残る | **採用** | **指摘が正しい。** 規約 (9) を実物で確認し、`000063` の A'/B' が同型の先例であることも確認した。⇒ `000112.up` へ救済 4 文を追加（§3.5）。**★さらにレビューが挙げていない欠陥を 2 件、自力で見つけた** —— (a) `000063` B-2 のガードが旧 golden コホートで反転する（§3.6）／ (b) `move_derivations` の 3 対も取り落とす（§3.7。**レビューは「救済不要」としていたが実測で反証した**）。失効した断定は `000112.up` ヘッダ ／ `migrate_m3007_test.go` ヘッダ ／ 完了報告 §3.4 の 3 か所で撤回・射程明示した |
| 高-2 | 高 | `make e2e` 全数が未実施 | **採用（対応済み）** | **レビュー実施時点では未実施だったが、その後 Phase A の締めとして全数実行した。⇒ 308 passed (6.6m) / exit 0**（§10.1）。新設 test も緑である |
| 中-1 | 中 | `000063.down` / `000064.down` の追随で v112→v62 の down が空振りする | **採用** | 指摘のとおり `000112.down` が先に旧 code へ戻すため空振りする。⇒ 該当 `WHERE` を `code IN ('<新>', '<旧>')` の両対応にした（`000063.down` 1 か所 ／ `000064.down` 11 か所）。両ファイルのヘッダへ「up と down で要求が食い違う構造である」ことを明記 |
| 中-2 | 中 | `progress-log.md` の索引行が未追記 | **採用** | **Phase D で追記する**（本 CLI は Phase C と Phase D を独立の工程として分けている）。`check-progress-log-index.sh` の緑を確認する |
| 中-3 | 中 | `generate_m2002_test.go` に消えた code が注記なしで残る | **採用** | 触らない判断は維持したうえで、当該行の直上へ 4 行の注記を置いた（「本ファイルは合成 fixture であり、実在しない code を入力に使うこと自体が主張の趣旨である」） |
| 中-4 | 中 | `DES-004` §2.1 の as-built 化が §13（設計伝達レポート原稿）に立っていない | **採用** | §13-4 として項を新設した（`P-56` の解消 ／ 表の 2 行目の失効） |
| 中-5 | 中 | 規約 (8)(ii) の事前 `WHERE` 実測が無い | **採用** | v111 の DB へ `WHERE` 句そのものを流した実測を §3.9 に貼った（改名 10 文 ＋ 救済 4 文とも 0 行） |

**★不採用は 0 件である。⇒ Phase C 安全弁（「高」指摘の自動棄却）は発動していない。**

**★レビューの功績を明記する** —— 高-1 は**規約の存在ごと見落としていた**穴であり、指摘が無ければ中間版コホートの欠陥 4 種がそのまま HEAD へ着地していた。**しかも是正の過程で、レビューも挙げていなかった欠陥がさらに 2 件出た**（§3.6 / §3.7）。

---

## 10. 検査（**Phase C 取り込み後に再走。下記は Phase A 時点の実測**）

| # | コマンド | 結果 |
|---|---|---|
| 1 | `bash scripts/check-artifact-integrity.sh` | **違反なし**（検査 15 件の自己検査 ＋ 生成物 4 件すべて OK） |
| 2 | `go test ./...` | **全数 green** |
| 3 | `cd web && pnpm test` | **229 files / 2811 tests すべて green** |
| 4 | `cd web && pnpm tsc --noEmit` ／ `pnpm lint` | **exit 0**（`eslint-disable` / `nolint` は 1 つも足していない） |
| 5 | `make e2e`（全数） | **308 passed**。Phase A 時点 6.6m ／ **Phase C 取り込み後に再走して 6.4m・同数**。下記 10.1 |
| 6 | `bash scripts/check-migration-license.sh` | **違反なし**（破壊確認あり・下記 10.2） |
| 7 | `bash scripts/check-import-order.sh` | **違反なし**（下記 10.3） |
| 8 | `bash scripts/check-md-emphasis.sh <本報告>` | 完了時に自分の新規 md へ実行（`D-775`） |
| 9 | `go run ./cmd/seedgen -check` | `OK: 生成物は既存ファイルと一致` / exit 0 |

### 10.1 `make e2e`（全数）

```
  308 passed (6.6m)
[exited with code 0]
```

**本サブが触った spec の実測（新設 test を含む）：**

```
✓ 276 m30-05-family-label-strength-word.spec.ts:20 › ★★★(A) 群: 先頭装飾の直後の強度語が落ちている(装飾は残る) (1.5s)
✓ 277 m30-05-family-label-strength-word.spec.ts:55 › ★★★M30-07: ルークとガイルの【ジャスト】版が同じ形で選べる (2.2s)
✓ 278 m30-05-family-label-strength-word.spec.ts:89 › ★★★陽性対照: 技そのものの名前には強度語が在る(消えたのは行の表示名だけ) (795ms)
✓ 279 m30-05-family-label-strength-word.spec.ts:107 › ★★★(B) 群 対照: 丸括弧の中の派生元の強度は残り、兄弟 3 行が区別できる (665ms)
```

**★新設 test（#277）は実サーバ・実 DB 越しに次を主張して緑である**：luke `flash_knuckle` ／ guile `sonic_boom` / `somersault_kick` / `sonic_cross` の **4 ファミリーすべてが「ジャスト」変種を持つ**こと、および **旧の接頭形ファミリー行 3 件が 1 つも残っていない**こと（陰性対照）。

**⇒ Vitest 側（seed CSV 母集団）と E2E 側（実 DB 母集団）の両方で、本サブの成果が確認されている。**

**★★Phase C 取り込み後に再走した**（`000063` / `000064` / `000112` を触ったため。E2E スタックは毎回マイグレーションから使い捨て DB を作り直すので、**マイグレを触った以上は再走が要る**）：

```
  308 passed (6.4m)
[exited with code 0]
```

**⇒ 件数は取り込み前と同数（308）であり、救済 4 文と `000063` のガード変更は新規 DB の最終状態を 1 バイトも変えていない**（＝設計どおり 0 行に当たっている）。

### 10.2 `check-migration-license.sh` の破壊確認

`000112` の**ファイル名から `_data_` を外して**再実行した実測：

```
NG  ★静かな漏れ: migrations/000112_correct_guile_perfect_variant_codes.down.sql は
    ゲームデータ表(moves)へ書くのに `_data_` を持たず層 A(AGPL)へ落ちている
NG  ★静かな漏れ: …up.sql も同様
結果: 違反 2 件
```

**⇒ 検査は本サブの新規マイグレに対して実際に効いている。** 名前を戻して再実行し「違反なし」を確認した。

### 10.3 `check-import-order.sh`

```
現在 99 ファイル / ベースライン 101 ファイル(本番 14 ／ テスト 85)
OK  ベースラインより 2 ファイル少ない
    → 本スクリプトの BASELINE を 99 へ下げること
```

**★ベースラインは下げていない**（`D-388`＝レーン内で下げない）。**★本サブ起因ではない** —— `git diff 5ec1534 -- web/src | grep -E "^[+-]import "` が **0 行**であり、import 行は 1 行も触っていない。**⇒ 先行レーンのマージで下がった分である。§12 へ申し送る。**

---

## 11. ★実機で見る手順（指示書 §2.5・開発者の手番）

**確かめること＝「ルークとガイルの【ジャスト】版が、同じ形で選べる」。**

| # | 手順 |
|---|---|
| 1 | アプリを起動し、**コンボ新規登録**を開く |
| 2 | キャラクターに **ルーク** を選び、レシピ欄の**仮想コントローラ → 必殺技タブ**を開く |
| 3 | **「フラッシュナックル」の行を押す**。⇒ **変種の行**（通常 / ホールド / ジャスト）が出る。「ジャスト」を選ぶと弱/中/強が選べる |
| 4 | キャラクターを **ガイル** へ変え、同じく**必殺技タブ**を開く |
| 5 | **「ソニックブーム」**の行を押す。⇒ **変種の行（通常 / ジャスト）** が出る。**★ここが本サブで直った面である**（着手前は「【ジャスト】ソニックブーム」が**別の行**として並んでいた） |
| 6 | 同じく **「サマーソルトキック」** と **「ソニッククロス」** でも【ジャスト】が変種として選べることを見る |
| 7 | **★陰性対照**: 必殺技タブの一覧に **「【ジャスト】ソニックブーム」「【ジャスト】サマーソルトキック」「【ジャスト】ソニッククロス」の 3 行が無い**ことを見る（二重に出ていないこと） |
| 8 | ソニッククロスの【ジャスト】で **OD** が選べること（`sonic_cross_perfect_od`）。表示名は「【ジャスト】ODソニッククロス１」 |

**★既存 DB を持つ手元では `000112` が改名を当てる。** 新規 DB では golden 由来で最初から新 code である。**どちらでも見え方は同じになる。**

### 11.1 ★★【2026-09-12 追記】実機確認の結果（**返った・穴なし**）

**開発者が実機で確認し、2 件を逐語で返した。**

| 手順 | 逐語 | 日付 |
|---|---|---|
| 手順 5（ガイルのソニックブームで【ジャスト】が選べること） | **「動作確認はOKでした」** | 2026-09-12 |
| **手順 8**（ソニッククロスの【ジャスト】で OD が選べること＝`sonic_cross_perfect_od`） | **「ソニッククロスの【ジャスト】で ODを入れる事はできました」** | 2026-09-12（同日） |

**⇒ 8 手順は「人 2 件 ＋ E2E 6 件」で全数が押さえられた。** 残る 6 手順は新設 E2E test `★★★M30-07: ルークとガイルの【ジャスト】版が同じ形で選べる` が実サーバ・実 DB 越しに固定している（luke `flash_knuckle` ＋ guile 3 ファミリーの陽性 ＋ 旧 3 行が存在しない陰性対照）。

**★手順 8 は、初版の設計伝達レポート §4-5 が「誰も確認していない唯一の穴」として申告していた項目である。⇒ 穴は 0 になった。**

**★本追記はドキュメントのみであり、コード・テスト・マイグレの差分は 0 である。⇒ `go test` / `pnpm test` / `make e2e` は回していない**（回す対象が変わっていないため）。

---

## 12. ■ 併せて更新が要るもの

| # | 項目 | 状態 |
|---|---|---|
| 1 | **CHANGE 番号の消費** | **0 本。⇒ `change-number-registry.md` §1 への登録は無い**（`D-293`。`DES-004` §2.1 の as-built 書き換えは受理の手番で設計卓が行う） |
| 2 | **消費したマイグレ連番** | **`000112`**。`ls migrations/` の実査値は着手時 `000111` → 着手後 `000112`。**⇒ ボード §2.2 の「次に払い出す番号」は `000113` になる**（設計卓の手番） |
| 3 | **版を上げた文書** | **無し**（設計書は 1 本も触っていない） |
| 4 | **派生資料 `code-facts.md`** | **再生成した**（`bash scripts/generate-code-facts.sh`）。**★`code-facts.md` はマイグレーション連番の表と DDL 操作の一覧を持つ**（§10-1 / §10-2）。⇒ `000112` を消費した本サブは**必ず**この 2 か所に効く。差分は **4 行のみ**（生成 commit 行 ／ 連番表 1 行 ／ DDL 一覧 2 行）。**★「Go / TS の公開シンボルを足していないから不要」は誤りである** —— 同資料の射程はシンボルだけではない |
| 4-b | **派生資料 `docs-map.md` / `custom-commands.md`** | **再生成は不要。** `docs-map` は本サブが `docs/` へ足した 2 本（完了報告・レビュー報告）を拾うが、**それは受理の手番でまとめて再生成される類である**。`custom-commands` は `.claude/commands/` を源泉としており本サブは 1 つも触っていない（実測の陳腐化 21% は先行レーン起因）。**★鮮度判定は `check-derived-docs.sh` の担当であり、`check-artifact-integrity.sh` は生成物の*健全性*しか見ない**（`M35-02` レビュー 低-10 の是正と同じ根拠） |
| 5 | **`check-import-order.sh` のベースライン** | **下げていない**（`D-388`）。**★本サブ起因ではない**（§10.3）。⇒ **改善レーンへ申し送る** |
| 6 | **`DES-004` §2.1 の保留 `P-56`** | **解消した**（【ジャスト】の命名が接頭形と接尾形に割れている件）。**⇒ as-built への反映は設計卓の手番である** |

---

## 13. 申し送り（設計伝達レポート §4 の原稿）

> **★★★`docs/handover/followup-backlog.md` は 1 文字も編集していない**（`D-838`）。**⇒ 以下は §J 行の原稿である。設計卓が受理の手番で転記する。**

### 13-1. `move_code` の改名は「後続の手書きマイグレ」を壊しうる（**型に属する申し送り**）

| フィールド | 内容 |
|---|---|
| **ID** | `move-code-rename-breaks-later-handwritten-migrations` |
| **発生元** | `M30-07`（本報告 §3） ／ レビュー報告書 `docs/progress/m30-07-review.md` |
| **未解消の理由** | **本サブでは案 1（適用済みマイグレの `code` 列挙の書き換え）で解いたが、それは「毎回、旧 code を後続マイグレへ `grep` する」ことを人に要求する形である。** `000039` / `000063` / `000064` を取りこぼしても**テストも lint も型検査も緑**であり、気づく経路は実機か本サブが新設した契約テストしか無い。**⇒ 機械検査が無い。** |
| **再開に必要な条件** | 検査の形の決定（例＝「`character_data/*.csv` の `move_code` 集合に無い code を `WHERE code =` / `code IN` で参照している `migrations/*.sql` を洗う」検査）。**★誤検出の母集団を先に測ること** —— 改名前の code を意図的に持つ down 側や、履歴として旧 code を書くコメントが在る |
| **記録日・状態** | 2026-09-12・**未着手（設計卓の判断待ち）** |

### 13-2. `check-import-order.sh` のベースラインが実測より 2 大きい

| フィールド | 内容 |
|---|---|
| **ID** | `import-order-baseline-drift-101-to-99` |
| **発生元** | `M30-07`（本報告 §10.3） |
| **未解消の理由** | **本サブ起因ではない**（import 行を 1 行も触っていないことを diff で確認済み）。**`D-388`＝レーン内でベースラインを下げない**に従い、本サブでは下げなかった |
| **再開に必要な条件** | 改善レーンでの一括更新（`BASELINE` を 99 へ）。**★下げる前に、下がった原因が「直った」のか「ファイルが消えた」のかを弁別すること** |
| **記録日・状態** | 2026-09-12・**未着手（改善レーン）** |

### 13-4. `DES-004` §2.1 の as-built 化（**保留 `P-56` の解消**）

| フィールド | 内容 |
|---|---|
| **ID** | `des004-s21-perfect-variant-naming-as-built` |
| **発生元** | `M30-07`（本報告 §12-6） ／ レビュー報告書 `docs/progress/m30-07-review.md` 中-4 |
| **未解消の理由** | **製造は設計書を直接編集しない**（`D-293`）。`DES-004` §2.1 には次が**現在形のまま**残っている —— 「同じ UI 概念に命名形が 2 通りある例が 1 件ある。⇒ 保留 `P-56` で裁定待ちである」／ 表の 2 行目「guile ｜ `perfect_timing_light_sonic_boom` ｜ 接頭形 ｜ 別ファミリー 3 行として並ぶ」。**★どちらも本サブで失効した** |
| **再開に必要な条件** | 設計卓が受理の手番で as-built 化する。**★`P-56` は「裁定待ち」ではなく「`D-836` で (a) seed 側に確定し、`M30-07` で実装済み」である。★表の 2 行目は guile も接尾形になったことへ書き換える**（削除ではなく、揺れが在った事実と解消を残す形が望ましい） |
| **記録日・状態** | 2026-09-12・**未着手（設計卓の手番）** |

### 13-5. `code` 列挙の書き換えには前コホート救済が要る（**規約 (9) の適用が漏れた**）

| フィールド | 内容 |
|---|---|
| **ID** | `rule9-cohort-rescue-not-surfaced-in-instructions` |
| **発生元** | `M30-07`（本報告 §3.5〜3.7） ／ レビュー報告書 高-1 |
| **未解消の理由** | **製造は規約 (9) の存在に気づかないまま案 1 を採り、救済を落とした。** 指示書・チェックリストのいずれにも「コホート」の語が無く、**`SUPP-001` §5.5.4 を (8) / (10) / (16) しか引かなかった**ため到達しなかった。**⇒ 規約 (9) は「`code` 列挙を書き換える手番」でしか効かないが、その手番であることに気づくのは書き換えた後である** |
| **再開に必要な条件** | **(a)** 指示書テンプレート側で「適用済みマイグレの `code` 列挙を触る可能性がある」サブに規約 (9) を必読へ入れる、**または (b)** 機械検査（`13-1` の検査と統合できる）。**★どちらも設計卓の判断である** |
| **記録日・状態** | 2026-09-12・**未着手（設計卓の判断待ち）** |

### 13-3. 三点更新に固有の既存クラス（**本サブ固有ではない・再掲**）

| フィールド | 内容 |
|---|---|
| **ID** | `three-point-update-down-below-golden-version`（既出） |
| **発生元** | `M30-07`（`000112.down` のヘッダ注記） ／ 先行＝`M35-02` `000108.down` |
| **未解消の理由** | `v112` より下へ降ろすと `000026.down` の code 列挙（新 code）と、down 後の行の code（旧 code）が食い違い、孤児行が残る。**`000063` / `000106` / `000107` / `000108` も同じ形を持つ。★かつ `m.Down()` / `Migrate(0)` を呼ぶテストは 1 本も無く、現状どのテストも通らない経路である** |
| **再開に必要な条件** | 「往復以外の down をどこまで保証するか」の方針決定。**★本サブでは直さない**（型に属し、単独サブで解ける範囲を超える） |
| **記録日・状態** | 2026-09-12・**未着手（先行サブから継続）** |

---

*以上、M30-07 完了報告（**§9 / §10.1 は Phase C で埋める**）。*
