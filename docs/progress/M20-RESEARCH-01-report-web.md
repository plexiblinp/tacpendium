# M20-RESEARCH-01 調査結果レポート（web セッション：軸 A / B / C / E）

| 項目 | 内容 |
|------|------|
| 文書ID | M20-RESEARCH-01-report-web |
| 対応指示書 | `docs/instructions/M20-RESEARCH-01-preset-data-reality.md` v1.1.0 |
| 収める軸 | **A / B / C / E**（指示書 §0.5 の環境割当。**D / F は本レポートに含まない**） |
| 実行環境 | **Claude Code on the web**（リモート実行コンテナ） |
| 作成日 | 2026-08-12 |
| 種別 | read-only 調査（事実列挙。判断・設計結論を含まない＝§0.3） |

> **本レポートは `docs/progress/M20-RESEARCH-01-report-local.md`（軸 D / F）を読んでいない。** 実行前に `ls docs/progress/M20*` で同ファイルが**存在しないこと**を確認済み。突合は設計卓が行う（§0.5）。

---

## 0. 基準時点と計測条件（★全数字の共通前提。§0.3 の E-16 / E-93）

**すべての件数は下表の条件で数えた値である。**「何を・どの単位で・どの基準時点で」は各項目にも再掲する。

| 項目 | 値 |
|---|---|
| 基準日 | **2026-08-12** |
| ブランチ | `claude/preset-data-reality-research-td9u9r` |
| HEAD commit | **`1972d82`**（`Merge pull request #29 ...`） |
| 実行環境 | Claude Code on the web（リモートコンテナ・`/home/user/combomgr`） |
| **DB** | **マイグレをクリーン適用した使い捨て DB**。作成先 = **リポジトリ外のスクラッチパッド**（`<scratchpad>/research.db`）。**リポジトリ内に `*.db` を作成・上書き・削除していない** |
| DB 作成手順 | `go build -o <scratchpad>/combomgr-research ./cmd/combomgr` → **スクラッチパッドを cwd にして** `COMBOMGR_DB_PATH=research.db COMBOMGR_PORT=47999` で起動（`internal/infra/migration.Run` が embed.FS のマイグレを適用）→ 40 秒で `timeout` 終了 |
| DB のマイグレ状態 | `schema_migrations` = **version 68 / dirty 0**（`migrations/` の最終連番 `000068` と一致。up/down 計 136 ファイル） |
| **DB の汚染状況** | **`combos` 0 行・`setups` 0 行**＝**利用者が作ったデータは 1 件も無い**（クリーン適用の裏取り） |
| DB 読取方法 | `python3` 標準 `sqlite3`（**`file:research.db?mode=ro` の read-only URI**）。`INSERT`/`UPDATE`/`DELETE`/`CREATE`/`ALTER`/`DROP` は 1 度も発行していない |
| **CSV** | `character_data/*.csv` = **17 ファイル**（**全キャラ分＝A-3 の開発者回答どおり全数を読んだ**）。**データ行 1,479 行**（ヘッダ除く）。**17 ファイルのヘッダ行は全て同一**（md5 先頭 8 桁 `1cedecb4` で一致確認） |
| CSV 読取方法 | `python3` 標準 `csv.DictReader`（引用符付きセル・セル内カンマを正しく扱うため。`cut -d,` を使っていない） |
| リポジトリの差分 | **`git status --short` の出力が空**＝マイグレ・seed・ソース・テストいずれも diff 0（§6 DoD） |

### 0.1 主要テーブルの実行数（母数の一覧・すべて上記クリーン DB）

| テーブル | 行数 |
|---|---|
| `characters` | **19** |
| `moves` | **1,653** |
| `move_commands` | **894**（`distinct move_id` も **894** ＝ 1 move あたり token_key 1 本） |
| `presets` | **5** |
| `preset_aliases` | **1,653** |
| `combos` | **0** |
| `setups` | **0** |

### 0.2 実施できなかった軸（§0.5 の E-77 判定）

**なし。** 割り当てられた A / B / C / E はすべて実行できた。**使い捨て DB は作成できた**（`config.ValidateDataPath` が「実行時カレントディレクトリ配下」を許可するため、スクラッチパッドを cwd にすれば絶対パス制約とリポジトリ外要件の双方を満たせる）。

---

## 1. 結論サマリ（設計卓が最初に読む 5 行）

1. **軸 B の答えは「0 件」である。** `(moves.character_id, alias_text)` の重複は **0 グループ / 走査 1,653 行**。ただし**エイリアスが入っているプリセットは `official_ja_move` の 1 種だけ**（他 4 種は 0 行）であり、**「プリセット横断」の衝突が起きうる状況自体がまだ生じていない**。→ §B-2 の限界注記を必ず併読のこと。
2. **軸 A の「コマンドを持たない技」は 759 件 / 1,653 件**。うち **`is_derived=1` が 584 件（設計どおり索引対象外）**、**`is_derived=0` は 175 件**で、その内訳は **移動系 `system` 171 件 + `special` 4 件（OD 技）だけ**である。**P-30 が実際に扱う「素の未割当」は 4 件**。
3. **フォールバック 3 段目（`moves.code` 素出し）に落ちる技は 0 件 / 1,653 件。** 全 move に `official_ja_move` エイリアスが付いている。
4. **前提事実 12 は現状と一致しない。** `BUILTIN_PRESET_CODES` は **`numpad_ja` / `numpad_en` ではなく** `official_ja_move` / `official_ja_command` / `numeric_ja` / `numeric_en` / `srk` であり、**DB seed と完全一致している**。`numpad_` はコード側に **0 件**（docs のみ）。
5. **軸 E は「一定」である。** `rush_variant` 272 件は全件エイリアス付きで、**268 件が「元技エイリアス + `(ラッシュ)`」の 1 形だけ**。通常投げは **`前投げ` / `後ろ投げ` に 17 キャラ全てで正規化済み・`背負い投げ` は DB / CSV とも 0 件**。

---

# A. コマンドを持たない技の全数（保留 P-30 の材料）

## A-1: `moves` 全行数と `move_commands` に対応の無い行数

### 1. 実態

**数えた単位＝`moves` の 1 行。基準時点＝クリーン DB（migrations head 000068、2026-08-12）。**

| 指標 | 実値 |
|---|---|
| `moves` 全行数 | **1,653** |
| `move_commands` 全行数 | **894** |
| `move_commands` の `distinct move_id` | **894** |
| **`move_commands` に 1 行も対応が無い `moves` の行数** | **759** |

`759 = 1,653 − 894`（`move_commands` は `move_id` 重複ゼロのため、差がそのまま未対応数になる）。

**`is_derived` 別の内訳（★指示書に無い補足観点。P-30 の判断に直結するため追加した）**

| `is_derived` | 件数 |
|---|---|
| `0`（非派生） | **175** |
| `1`（派生） | **584** |
| 計 | **759** |

**キャラ別内訳**（分母＝そのキャラの `moves` 行数）

| `character_code` | moves | 対応無し | うち `is_derived=0` |
|---|---:|---:|---:|
| c_viper | 9 | 9 | 9 |
| dhalsim | 9 | 9 | 9 |
| guile | 97 | 50 | 10 |
| ingrid | 100 | 29 | 9 |
| jamie | 136 | 87 | 9 |
| jp | 84 | 35 | 11 |
| juri | 82 | 34 | 9 |
| ken | 89 | 39 | 9 |
| kimberly | 104 | 49 | 9 |
| lily | 90 | 42 | 10 |
| luke | 92 | 42 | 9 |
| m_bison | 88 | 43 | 9 |
| mai | 105 | 55 | 9 |
| manon | 81 | 36 | 9 |
| marisa | 117 | 51 | 9 |
| rashid | 108 | 48 | 9 |
| ryu | 93 | 37 | 9 |
| terry | 79 | 31 | 9 |
| zangief | 90 | 33 | 9 |
| **計** | **1,653** | **759** | **175** |

`category` 別内訳は A-2 に記す。

### 2. 契約・正典との差

- 前提事実 2（`moves` は `character_id` を持ち `UNIQUE(character_id, code)`、表示名カラムを持たない）は **DDL で裏取りできた**（`UNIQUE (character_id, code)`・表示名カラム無し）。
- 前提事実 6（`command` は本体 DB に列として存在せず `move_commands` の index-only、PK`(move_id, token_key)`）は **DDL で裏取りできた**。
- **`c_viper` / `dhalsim` の 2 キャラは `moves` が 9 行しか無く、その 9 行すべてが移動系 `system`** である（`character_data/` に CSV が無い＝未 seed キャラ）。**「キャラは 19 だが技データがあるのは 17」** という状態が、キャラ別内訳の分母を歪める。

### 3. 後続スコープへの含意

- 「コマンドを持たない技」の 759 件のうち **77%（584 件）は `is_derived=1`** であり、`internal/moveindex` が**設計どおり索引対象外にしている**行である。**P-30 が「表記の決め方」を決める必要がある対象と、設計どおり除外されている対象を混ぜると母数が 4 倍以上に膨らむ。**
- 移動系 `system` 171 件（19 キャラ × 9 種）は CSV に由来しない seed（`000025` / `000044` / `000054`）である。

### 4. 推奨（決定はしない・複数案の併記）

- 案 1: P-30 の母数を **`is_derived=0` の 175 件**に取る。
- 案 2: P-30 の母数を **`is_derived=0` かつ移動系 `system` を除いた 4 件**に取る（移動系は DES-004 §2.1/§2.3 の system move として別扱いする前提が既にあるため）。
- 案 3: 759 件全体を母数に取る（派生技の表記も P-30 で同時に決める）。

---

## A-2: 対象の `category` 分布

### 1. 実態

**数えた単位＝`moves` の 1 行。`category` は実値をそのまま列挙した（指示書の例示リストを写していない＝E-118）。**

**(a) `moves` 全 1,653 行の分布**

| `category` | 件数 |
|---|---:|
| `special` | 541 |
| `normal` | 320 |
| `rush_variant` | 272 |
| `system` | 188 |
| `unique` | 93 |
| `target_combo` | 80 |
| `super_art` | 79 |
| `throw` | 46 |
| `drive_impact` | 17 |
| `critical_art` | 17 |
| **計** | **1,653** |

**(b) A-1 の対象（`move_commands` 対応無し・759 行）の分布**

| `category` | 件数 |
|---|---:|
| `rush_variant` | 272 |
| `special` | 197 |
| `system` | 171 |
| `target_combo` | 76 |
| `unique` | 20 |
| `super_art` | 17 |
| `normal` | 4 |
| `throw` | 2 |
| **計** | **759** |

（`drive_impact` と `critical_art` は本集合に **0 件**。分母 759 行を全件走査した結果である。）

**(c) A-1 の対象のうち `is_derived=0`（175 行）の分布**

| `category` | 件数 |
|---|---:|
| `system` | 171 |
| `special` | 4 |
| **計** | **175** |

**(c) の 175 行の全リスト**（★件数が少ないため全件挙げる）

- `system` **171 件** = **19 キャラ × 9 種**。9 種は `back` / `forward` / `micro_back` / `micro_forward` / `dash_back` / `dash_forward` / `jump_back` / `jump_forward` / `jump_neutral`。
- `special` **4 件**:
  - `guile` / `sonic_blade_od`
  - `jp` / `triglav_od`
  - `jp` / `departure_od`
  - `lily` / `condor_spire_od`

（`moves.category='system'` は全 188 件で、内訳は上記 9 種 × 19 = 171 と `drive_parry` を含む CSV 由来の 17 件。`drive_parry` は CSV に `command` を持つため `move_commands` に載っている。）

### 2. 契約・正典との差

- **指示書 §4 A-2 の例示リストは実値と一致しない。** 指示書は「`normal` / `unique` / `special` / `super_art` / `critical_art` / `system` / `target_combo` 等」と挙げるが、**実際にはこれに加えて `rush_variant`・`throw`・`drive_impact` の 3 値が存在する**。とくに **`rush_variant`（272 件）は A-1 対象の最大区分**であり、例示リストに無い。
- `moves` テーブルの DDL コメントは 9 値（`normal/special/unique/super_art/throw/system/target_combo/rush_variant/drive_impact`）を列挙しているが、**実データには `critical_art`（17 件）も存在する**。**DDL コメントに `critical_art` が無い**（コメントであり制約ではないため、データ上の不整合ではない）。

### 3. 後続スコープへの含意

`rush_variant` が A-1 対象の 36%（272/759）を占めるため、**軸 E（`rush_variant` の日本語別名）と軸 A（P-30）は同じ行集合を見ている**。片方の結論がもう片方の母数を動かす。

### 4. 推奨（決定はしない）

- 案 1: A-2 の分布は「`is_derived` で層別した (b)/(c) の 2 枚」を正として扱う。
- 案 2: 指示書の例示リストを実値 10 値へ差し替える CHANGE を起票する（本レポートは起票しない＝§0.3）。

---

## A-3: `character_data/*.csv` の `command` 空欄行数（全キャラ分）

### 1. 実態

**数えた単位＝CSV のデータ行 1 行（ヘッダ除く）。「空欄」の判定＝`command` セルを `strip()` して空文字。基準時点＝commit `1972d82` 時点の `character_data/`。**

**★対象は 17 ファイル全数（開発者回答 2026-08-12 のとおり全キャラ分を読んだ）。**

| ファイル | 行数 | `command` 空欄 | うち `is_derived=false` |
|---|---:|---:|---:|
| guile.csv | 88 | 21 | 1 |
| ingrid.csv | 91 | 16 | 0 |
| jamie.csv | 127 | 19 | 0 |
| jp.csv | 75 | 20 | 2 |
| juri.csv | 73 | 16 | 0 |
| ken.csv | 80 | 12 | 0 |
| kimberly.csv | 95 | 17 | 0 |
| lily.csv | 81 | 19 | 1 |
| luke.csv | 83 | 16 | 0 |
| m_bison.csv | 79 | 16 | 0 |
| mai.csv | 96 | 14 | 0 |
| manon.csv | 72 | 22 | 0 |
| marisa.csv | 108 | 25 | 0 |
| rashid.csv | 99 | 22 | 0 |
| ryu.csv | 84 | 17 | 0 |
| terry.csv | 70 | 13 | 0 |
| zangief.csv | 78 | 19 | 0 |
| **計** | **1,479** | **304** | **4** |

**`command` 空欄 304 行の `is_derived` 別内訳**

| | 件数 |
|---|---:|
| `is_derived=true` | **300** |
| `is_derived=false` | **4** |

**`command` 空欄 304 行の `category` 別内訳**

| `category` | 件数 |
|---|---:|
| `rush_variant` | 272 |
| `special` | 26 |
| `unique` | 6 |

**`is_derived=false` かつ `command` 空欄の 4 行（全件）**

| ファイル | 行 | `character_code` | `move_code` | `category` | `name_ja` |
|---|---:|---|---|---|---|
| guile.csv | 54 | guile | `sonic_blade_od` | special | ODソニックブレイド |
| jp.csv | 33 | jp | `triglav_od` | special | ODトリグラフ |
| jp.csv | 41 | jp | `departure_od` | special | ODヴィーハト |
| lily.csv | 38 | lily | `condor_spire_od` | special | ODコンドルスパイア |

（いずれも `notes` は空。**4 件とも OD 技**であることが共通点。）

### 1-b. DB 側（A-1）との突合 ★指示書が求める中核

**まず「行集合」の突合**（`(character_code, move_code)` を鍵に照合）

| 指標 | 実値 |
|---|---:|
| DB `moves` 行数 | 1,653 |
| CSV データ行数 | 1,479 |
| **CSV にあって DB に無い** | **0**（走査 1,479 行） |
| **DB にあって CSV に無い** | **174** |

**DB-only 174 行の内訳**

| `category` | 件数 | 出所 |
|---|---:|---|
| `system` | 171 | 移動系 9 種 × 19 キャラ（`000025` / `000044` / `000054` の seed。CSV には元々無い） |
| `normal` | 3 | zangief の `standing_light_punch_rapid` / `crouching_light_punch_rapid` / `crouching_light_kick_rapid`（`000051_seed_moves_zangief_rapid`。3 件とも `is_derived=1`） |

**次に「A-1 の 759 と A-3 の 304 が一致しない」ことの内訳** ★これが本項の答え

**一致しない。差は 455 件。** 内訳は次の 3 つで**過不足なく説明できる**。

| # | 差の要因 | 件数 |
|---|---|---:|
| ① | **`move_commands` は CSV 由来の行しか作らない**ため、CSV に存在しない DB-only 174 行は必ず「対応無し」になる | **+174** |
| ② | **skip 判定は `is_derived` が最初に効く**（A-4）。よって **`command` が埋まっている派生行 281 件も索引に載らない** | **+281** |
| ③ | `command` 空欄でも `is_derived=true` の 300 件は ② に含まれるため二重計上しない | — |

**検算**

```
CSV 1,479 行  =  索引搭載 894  +  索引非搭載 585
索引非搭載 585 =  is_derived で落ちた 581  +  command 空欄で落ちた 4
DB 対応無し 759 = 索引非搭載 585  +  DB-only 174        ✓
DB 対応無し(is_derived=1) 584 = CSV 派生 581 + zangief rapid 3   ✓
DB 対応無し(is_derived=0) 175 = CSV 空欄非派生 4 + 移動系 system 171 ✓
```

**CSV の `is_derived=true` 行は 581 件**で、うち **`command` が埋まっているのは 281 件・空欄は 300 件**。

### 2. 契約・正典との差

- `DES-002` §7.5 が定める「`name_ja` → `preset_aliases` の写像」「`command` は index-only」は、実データ上も成立している（CSV 全 1,479 行が DB に入り、`command` は `moves` の列にならず `move_commands` にだけ現れる）。
- **「`command` 空欄」と「索引に載らない」は同義ではない。** 指示書 A-3 は両者を突合させる設計だが、**実際には `is_derived` が上位の門になっているため、空欄数（304）から索引非搭載数（585）は導けない。**

### 3. 後続スコープへの含意

P-30 が「コマンド由来プリセットで何を表示するか」を決めるとき、**対象集合を `command` 空欄で定義するか、索引非搭載で定義するかで母数が 304 / 585 / 759 の 3 通りに割れる。**

### 4. 推奨（決定はしない）

- 案 1: 母数を「CSV の `command` 空欄 304 件」に取る（CSV が入力の正である、という立場）。
- 案 2: 母数を「索引非搭載 585 件」に取る（索引に載らない＝コマンドから引けない、という立場）。
- 案 3: 母数を「DB の `move_commands` 対応無し 759 件」に取る（実行時に実際にコマンドを持たない行、という立場）。

---

## A-4: `DES-002` §7.5 skip 判定順序の各段で落ちる行数 ＋ 実コードとの一致

### 1. 実態

**(a) 判定を実装しているコード（★指示書の想定と場所が違う）**

指示書は「seedgen または索引生成の実コード」と書くが、**判定規則を持っているのは `internal/moveindex` であり、`internal/seedgen` は委譲しているだけ**である（`internal/seedgen/generate.go` L110 のコメントが「索引の構築主体は `internal/moveindex`＝skip 規則（派生/空/raw{/cond{/語彙外）」と明記）。

判定の実体は 2 か所に分かれている（**二段構え**。`moveindex.go` L184-185 のコメントが理由を明記）。

```go
// internal/moveindex/moveindex.go  skipReasonFor()
if isDerived                              -> SkipDerived           // 段1
if strings.TrimSpace(command) == ""       -> SkipEmptyCommand      // 段2
if strings.Contains(command, "raw{")      -> SkipUnknownToken      // 段3
if strings.Contains(command, "cond{")     -> SkipConditionResidual // 段4

// internal/moveindex/moveindex.go  Add()  ※正規化の後
token, unknown := normalizeCommand(command)
if len(unknown) > 0                       -> SkipUnknownToken      // 段5（語彙外）
```

**(b) 実際の判定順序は `DES-002` §7.5 の記述と一致する。**
§7.5 の順序「`is_derived` → `command` 空 → `raw{` を含む → `cond{` を含む → 語彙外トークン」と、実装の段 1〜5 は**同順**である。

**(c) 各段で落ちた行数（実測）**

**数えた単位＝CSV のデータ行 1 行。分母＝17 ファイル・1,479 行。計測方法＝`skipReasonFor` と同一の述語を CSV に順番に適用（段ごとに `continue`）。**

| 段 | 判定 | **その段に到達した行数（＝検査した件数）** | **その段で落ちた件数** |
|---|---|---:|---:|
| 段1 | `is_derived` | **1,479** | **581** |
| 段2 | `command` 空 | **898** | **4** |
| 段3 | `raw{` を含む | **894** | **0** |
| 段4 | `cond{` を含む | **894** | **0** |
| 段5 | 語彙外トークン | **894** | **0** |
| — | 索引搭載 | — | **894** |

**★「0 件」の 3 段はいずれも検査が動いている**（段 3〜5 には 894 行が到達しており、`raw{` / `cond{` の文字列判定と正規化がその 894 行すべてに適用されている）。E-84 の (b)「検査が対象を見ていない」ではない。

**(d) 実行ツールによる裏取り**

`go run ./cmd/seedgen -mode move-commands -chars <17 キャラ全て> -out research_probe -migrations <scratchpad>/gen -index-report <scratchpad>/index-report.md`
（**`-migrations` をスクラッチパッドへ向けたため、リポジトリの `migrations/` には 1 バイトも書いていない**。`git status --short` が空であることで確認済み。）

出力:

```
索引投入 合計 = 894 / 索引キャラ数 = 17 / 索引非搭載(記録)= 585 / drop 移動move = 0

## 索引非搭載 585 件
- derived: 581
- empty-command: 4
```

**`索引投入 894` は DB の `move_commands` の `distinct move_id` 894 と完全一致する。** 生成側と適用済み seed（`000035` / `000047` / `000057`）が同じ数に着地している。

### 2. 契約・正典との差

**★想定外の発見①: 段 4（`cond{`）の「0 件」は、`cond{` が存在しないからではない。**
`character_data/guile.csv` の **3 行が `command` 列に `cond{` を実際に含む**。

| 行 | `move_code` | `command` | `is_derived` |
|---:|---|---|---|
| 61 | `sonic_cross_od` | `r plus p or cond{（ソニックブレイド中に）} r plus p p` | **true** |
| 62 | `perfect_timing_sonic_cross_od` | `r plus p or cond{（ソニックブレイド中に）} r plus p p` | **true** |
| 63 | `sonic_cross_2_meter_od` | `r plus p p or cond{（ODソニックブレイド中に）} r plus p p` | **true** |

**3 行とも `is_derived=true` のため段 1 で落ち、段 4 には到達しない。** つまり **段 4 の実測値 0 は「段 1 に隠されている」** のであって、「`cond{` を含む行が無い」ではない。`raw{` は別で、**17 ファイル全文検索で 0 ヒット**（`command` 列に限らずどの列にも存在しない）。

**★想定外の発見②: `-index-report` の理由別内訳では段 3 と段 5 を区別できない。**
`SkipUnknownToken`（`"unknown-token"`）が **`raw{`（段 3）と語彙外トークン（段 5）の両方に使われている**（`moveindex.go` L32 のコメントが「`raw{...}` または §9.9 語彙外トークン」と明記）。今回はどちらも 0 件のため実害は出ていないが、**非 0 になったときに理由別内訳だけでは段を切り分けられない。**

### 3. 後続スコープへの含意

- 段 1 が最上位にあるため、**派生技の `command` に何が書かれていても索引判定に影響しない。** 派生技の表記方針を変える場合、`command` 列の内容は現状 index への入力になっていない。
- 段 3〜5 が全キャラで 0 件である＝**現行 17 キャラの CSV は、非派生行に限れば全て正準トークンだけで書けている。**

### 4. 推奨（決定はしない）

- 案 1: A-4 の報告値を「段別の到達／落下の 2 列」で扱う（0 件の解釈違いを防ぐ）。
- 案 2: `SkipUnknownToken` を段 3 用と段 5 用に分割する変更を後続サブで検討する。
- 案 3: 現状維持（両者とも 0 件のため）。

---

## A-5: A-1 の技に `official_ja_move` エイリアスがあるか

### 1. 実態

**数えた単位＝`moves` の 1 行。`official_ja_move` は `presets.id = 1`。**

| 集合 | 分母（検査した件数） | エイリアス**あり** | エイリアス**なし**（`moves.code` が素で出る） |
|---|---:|---:|---:|
| **A-1 の対象（`move_commands` 対応無し）** | **759** | **759** | **0** |
| `moves` 全体 | **1,653** | **1,653** | **0** |

**`preset_aliases` の `distinct move_id` は 1,653** ＝ **全 move に 1 本ずつ**付いている。

### 2. 契約・正典との差

- `DES-004` §5.3 のフォールバック（`base_preset_code` → `official_ja_move` → `moves.code`）のうち、**3 段目（`moves.code` 素出し）に落ちる行は現状 0 件**である。
- 前提事実 3（技の表示名は `preset_aliases`（`official_ja_move`）が保持する）は**実データで裏取りできた**。

### 3. 後続スコープへの含意

**現時点では「`moves.code` が UI に露出する」経路は実データ上存在しない。** 逆に言えば、`official_ja_move` の 1,653 行が**表示名の唯一の供給源**であり、ここを削除・リネームする変更は全表示面に直撃する。

### 4. 推奨（決定はしない）

- 案 1: A-5 の 0 件をもって「フォールバック 3 段目は現行 seed では死んでいる」と記録し、後続サブでは 2 段目までを検証対象にする。
- 案 2: 新規キャラ seed で 3 段目に落ちる可能性が残るため、検証は 3 段とも維持する。

---

# B. `alias_text` の衝突（スキーマ承認の材料）

## B-1: `(preset_id, alias_text)` の重複件数

### 1. 実態

**数えた単位＝`preset_aliases` の 1 行。分母＝1,653 行（全行）。**

| 指標 | 実値 |
|---|---:|
| `preset_aliases` 総行数（検査した件数） | **1,653** |
| `distinct (preset_id, alias_text)` | **930** |
| **重複グループ数**（同一組が 2 行以上） | **60** |
| **重複グループに属する行数** | **783** |

**60 グループはすべて `preset_id = 1`（`official_ja_move`）に属する**（他 4 プリセットは 0 行のため）。

**重複件数の多い順・上位 20 グループ**

| `preset_id` | `alias_text` | 重複数 |
|---:|---|---:|
| 1 | `前ジャンプ` | 19 |
| 1 | `前ダッシュ` | 19 |
| 1 | `前入力` | 19 |
| 1 | `垂直ジャンプ` | 19 |
| 1 | `後ろジャンプ` | 19 |
| 1 | `後ろダッシュ` | 19 |
| 1 | `後ろ入力` | 19 |
| 1 | `微歩き(前)` | 19 |
| 1 | `微歩き(後)` | 19 |
| 1 | `しゃがみ中K` | 17 |
| 1 | `しゃがみ中K(ラッシュ)` | 17 |
| 1 | `しゃがみ中P` | 17 |
| 1 | `しゃがみ中P(ラッシュ)` | 17 |
| 1 | `しゃがみ弱K` | 17 |
| 1 | `しゃがみ弱K(ラッシュ)` | 17 |
| 1 | `しゃがみ弱P` | 17 |
| 1 | `しゃがみ弱P(ラッシュ)` | 17 |
| 1 | `しゃがみ強K` | 17 |
| 1 | `しゃがみ強K(ラッシュ)` | 17 |
| 1 | `しゃがみ強P` | 17 |

**重複数 19 = 19 キャラ全て、17 = CSV のある 17 キャラ全て**に対応している。**すなわち B-1 の重複はすべて「キャラ違いの同名技」である。**

### 2. 契約・正典との差

`preset_aliases` の既存 UNIQUE は **`(preset_id, move_id)`** のみ（前提事実 1・DDL で裏取り済み）。`alias_text` に一意性は課されていないため、上記 783 行は**契約違反ではない**。

### 3. 後続スコープへの含意

**`UNIQUE(preset_id, alias_text)` を足すと、既存 783 行のうち 723 行（783 − 60 グループの代表 60 行）が入らなくなる。** キャラ軸を含まない一意制約は現行データと両立しない。

### 4. 推奨（決定はしない）

- 案 1: 一意制約にキャラ軸を含める（B-2 の結果と合わせて検討）。
- 案 2: 一意制約を課さず、逆引き側（`DES-004` §5 の「1 件のときだけ確定」）で吸収し続ける。

---

## B-2: `(moves.character_id, alias_text)` の重複件数（プリセット横断）

### 1. 実態

**数えた単位＝`preset_aliases` を `moves` に join した 1 行。`preset_aliases` は `character_id` を持たないため `moves.character_id` を join して数えた（指示書 B-2 の指定どおり）。プリセットで絞らず横断で数えた。**

| 指標 | 実値 |
|---|---:|
| 走査した行数（検査した件数） | **1,653** |
| `distinct (moves.character_id, alias_text)` | **1,653** |
| **重複グループ数** | **0** |
| **重複グループに属する行数** | **0** |

**★「0 件」の裏取り**: 分母 1,653 行が join を通っており（`preset_aliases` 1,653 行 = join 後 1,653 行＝欠損なし）、`distinct` が 1,653 と**総行数に一致する**ため、検査は対象を見た上で 0 と出ている。B-1 の同一クエリ形が 60 グループを検出していることも、検出器が動いていることの裏付けになる。

### 2. 契約・正典との差 ★重要な限界（この 0 件の解釈に必須）

**0 件は「衝突が起きない構造だから」ではなく、「衝突が起きうる状況がまだ存在しないから」である可能性がある。** 根拠は次の 2 点。

1. **エイリアスが投入されているプリセットは `official_ja_move`（`preset_id=1`）の 1 種だけ**である（B-5）。他 4 種は 0 行。**したがって「プリセット横断」の横断が実質的に 1 プリセット分しかない。**
2. その 1 プリセット内では **既存の `UNIQUE(preset_id, move_id)` により、同一 move が 2 行を持てない**。同一キャラ内で `alias_text` が衝突するには「同一キャラの異なる 2 つの move が同じ表記を持つ」必要があるが、現行 seed の `official_ja_move` は `name_ja` を 1:1 で写しているためそれが起きていない。

**`DES-004` §5 冒頭注記が定める逆引き（全プリセット横断・`alias_text` 完全一致・キャラスコープ・1 件のときだけ確定）は、現行データでは常に 1 件に確定する。**

### 3. 後続スコープへの含意

**`preset_aliases` に `UNIQUE(character_id, alias_text)` 相当の制約を足しても、現行の 1,653 行は 1 行も壊れない。** ただし上記の限界により、**`official_ja_command` / `numeric_ja` / `numeric_en` / `srk` にエイリアスを投入した瞬間に前提が変わる**（M20 が扱う「既定プリセット生成」はまさにこれを行う）。

### 4. 推奨（決定はしない）

- 案 1: 制約は既存データを壊さないため、先に制約を入れてから生成する。
- 案 2: 生成側の衝突数が未知なので、生成規則を決めた後に再計測してから制約を決める。
- 案 3: 制約のスコープを `(preset_id, character_id, alias_text)` にする（プリセット内キャラ内一意）／`(character_id, alias_text)` にする（プリセット横断キャラ内一意）の 2 案を、逆引きが実際に引く単位（横断）に合わせるかで選ぶ。

---

## B-3: B-2 の衝突の実例（最大 20 組）

### 1. 実態

**B-2 の重複グループが 0 件のため、挙げられる実例は 0 組である。**

- 検査した件数: **1,653 行**（`preset_aliases` 全行を `moves` に join した集合）
- 重複グループ: **0**
- 実例: **0 組**

参考として、**もし一意制約からキャラ軸を外した場合（B-1 の単位）** の実例は B-1 の表に 20 グループ挙げてある。B-1 の重複はすべて `character_id` が異なる行同士であるため、キャラ軸を入れた B-2 では消える。

### 2. 契約・正典との差

なし（B-2 の結果に従属する項目）。

### 3. 後続スコープへの含意

**衝突の実例が 1 件も無いため、「衝突時にどちらを採るか」の規則を実データから帰納できない。**

### 4. 推奨（決定はしない）

- 案 1: 実例が無い以上、衝突解決規則は M20 の生成後に再計測してから決める。
- 案 2: `DES-004` §5 の「1 件のときだけ確定」を据え置き、複数件は未確定として扱い続ける。

---

## B-4: `alias_text` の不可視文字

### 1. 実態

**数えた単位＝`preset_aliases` の 1 行。分母＝1,653 行（全行）。判定は Python の文字列関数で実施。**

| 検査 | 該当件数 / 検査した件数 |
|---|---:|
| 前後に ASCII 半角空白 | **0 / 1,653** |
| U+3000（全角空白）を含む | **0 / 1,653** |
| 前後に U+3000 | **0 / 1,653** |
| `\n` または `\r` を含む | **0 / 1,653** |
| TAB (`\t`) を含む | **0 / 1,653** |
| NBSP (U+00A0) を含む | **0 / 1,653** |
| ゼロ幅文字（U+200B/200C/200D/FEFF）を含む | **0 / 1,653** |
| 任意の Unicode 空白が前後にある（`str.strip()` 基準） | **0 / 1,653** |

**★指示書が挙げた 3 種（前後空白・全角空白・改行）に加え、TAB / NBSP / ゼロ幅 / Unicode 空白全般を検査した（補足観点）。いずれも 0 件。**

**★補足検査で 0 でなかった項目（決定論に関わるため記録する）**

| 検査 | 該当件数 / 検査した件数 |
|---|---:|
| **NFKC 正規化形と一致しない** | **36 / 1,653** |
| 半角 `(` を含む | 433 / 1,653 |
| **全角 `（` を含む** | **33 / 1,653** |
| **半角 `(` と全角 `（` の両方を同一文字列に含む** | **12 / 1,653** |

NFKC 差分の内訳（文字単位の出現数）:

| 文字 | コードポイント | NFKC 後 | 出現数 |
|---|---|---|---:|
| `（` | U+FF08 | `(` | 33 |
| `）` | U+FF09 | `)` | 33 |
| `１` | U+FF11 | `1` | 2 |
| `２` | U+FF12 | `2` | 1 |

影響キャラ: ingrid 17 行 / mai 8 行 / guile 5 行 / jamie 5 行 / m_bison 1 行（計 36）。

実例:

```
'SA1 ソニックハリケーン （横）'
'弱ソーラーフレア（前方）'
'ソーラーフレア(Lv1)（前方）'     ← 半角と全角が同一文字列に混在
'【ジャスト】ODソニッククロス１'
```

### 2. 契約・正典との差

- **不可視文字（空白・改行・ゼロ幅）による決定論の破壊は、現行データでは 0 件**である。
- **ただし括弧の全角／半角が混在している。** `DES-004` §5 冒頭注記の逆引きは **`alias_text` 完全一致**で引くため、利用者が `ソーラーフレア(Lv1)(前方)`（全て半角）と入力しても `ソーラーフレア(Lv1)（前方）` には**一致しない**。**指示書 B-4 が意図した「完全一致で引く契約を壊す要因」は、不可視文字ではなく全角／半角の混在として実在している。**
- **同一文字列内に両方が混在する 12 行**は、`rush_variant` の `(ラッシュ)`（半角・268 件）と、技名側の `（…）`（全角）が結合した結果と読める。

### 3. 後続スコープへの含意

M20 が「コマンド由来プリセット」を生成して逆引き対象を増やす場合、**入力側の正規化（NFKC 等）を挟むか、`alias_text` 側の表記を揃えるかを決めないと、完全一致の逆引きが利用者入力とすれ違う。**

### 4. 推奨（決定はしない）

- 案 1: 逆引きの前段に NFKC 正規化を入れる（既存 36 行のデータは変えない）。
- 案 2: `alias_text` 側を半角へ寄せるデータ修正マイグレを起票する。
- 案 3: 現状維持（現行 UI が逆引き入力を提供していない範囲では実害が出ない）。

---

## B-5: `preset_id` 別の `preset_aliases` 行数

### 1. 実態

**数えた単位＝`preset_aliases` の 1 行。分母＝1,653 行。**

| `presets.id` | `code` | `name` | エイリアス行数 |
|---:|---|---|---:|
| 1 | `official_ja_move` | 公式表記(日本語・技名表示)改善版 | **1,653** |
| 2 | `official_ja_command` | 公式表記(日本語・コマンド表示)改善版 | **0** |
| 3 | `numeric_ja` | ナンバリング記法(日本語版) | **0** |
| 4 | `numeric_en` | ナンバリング記法(英語版) | **0** |
| 5 | `srk` | SRK 記法 | **0** |
| | | **計** | **1,653** |

**「0 件」の裏取り**: 5 プリセット全行を `LEFT JOIN` で走査しており（`presets` 5 行が全て結果に現れている）、集計対象から漏れていない。合計 1,653 が `preset_aliases` の総行数と一致する。

### 2. 契約・正典との差

**前提事実 5（組み込み 5 種が `000005_seed_presets` で投入され、実データのエイリアスは `official_ja_move` のみ・他 4 種は空）は実 DB で裏取りできた。** `SUPP-001` §3.4 の記述どおり。

### 3. 後続スコープへの含意

**`official_ja_move` の 1,653 行が、`preset_aliases` テーブルの全内容である。** M20 が他プリセットへエイリアスを生成すると、テーブル行数は最大で 5 倍（8,265 行）規模になりうる。

### 4. 推奨（決定はしない）

- 案 1: 生成対象プリセットを段階投入し、各段で B-2 を再計測する。
- 案 2: 全プリセット同時生成し、生成前に衝突をドライランで数える。

---

# C. プリセット行と参照元の実態（D-288 / D-299 / D-300 の材料）

## C-1: `presets` の全行

### 1. 実態

**数えた単位＝`presets` の 1 行。分母＝5 行（全行）。**

| `id` | `user_id` | `code` | `name` | `base_preset_code` | `is_builtin` |
|---:|---|---|---|---|---:|
| 1 | NULL | `official_ja_move` | 公式表記(日本語・技名表示)改善版 | NULL | 1 |
| 2 | NULL | `official_ja_command` | 公式表記(日本語・コマンド表示)改善版 | NULL | 1 |
| 3 | NULL | `numeric_ja` | ナンバリング記法(日本語版) | NULL | 1 |
| 4 | NULL | `numeric_en` | ナンバリング記法(英語版) | NULL | 1 |
| 5 | NULL | `srk` | SRK 記法 | NULL | 1 |

**カスタムプリセット（`user_id` 非 NULL / `is_builtin=0`）は 0 行 / 検査 5 行。**

### 2. 契約・正典との差

**前提事実 4（`presets` は 6 列・キャラ軸の列を持たない）は DDL で裏取りできた。** 5 行の `code` は `internal/model/preset.go` の 5 定数と完全一致する。

### 3. 後続スコープへの含意

クリーン DB にはカスタムプリセットが存在しないため、**D-288/299/300 の「削除・リネームの波及」はビルトイン 5 行に対してのみ実測できている。**

### 4. 推奨（決定はしない）

- 案 1: カスタムプリセットの実態は軸 D/F 側（ローカルの開発用 DB）で確認する。
- 案 2: 本レポートの範囲では「配布物にカスタムは 0 行」を前提とする。

---

## C-2: `base_preset_code` が非 NULL の行

### 1. 実態

| 指標 | 実値 |
|---|---:|
| 検査した件数（`presets` 全行） | **5** |
| `base_preset_code` が非 NULL | **0** |

**`numeric_ja` や `official_ja_command` を指す行は存在しない（0 件 / 5 行）。**

### 2. 契約・正典との差

`DES-004` §6（カスタムプリセット）が定める `base_preset_code` の運用は、**配布 seed の時点では未使用**である。

### 3. 後続スコープへの含意

**`base_preset_code` を参照するフォールバック（`DES-004` §5.3 の 1 段目）は、現行の配布データでは 1 度も発動しない。**

### 4. 推奨（決定はしない）

- 案 1: 1 段目フォールバックの動作確認は軸 D/F の開発用 DB か、テストで担保する。
- 案 2: 本レポートの範囲では「配布物では 1 段目は死んでいる」と記録する。

---

## C-3: `[defaults] preset_id` が指す `presets.id` と `code`

### 1. 実態

**(a) 設定ファイルの存在**

| 確認先 | 結果 |
|---|---|
| リポジトリ直下 `config.toml` | **存在しない**（`ls config.toml` → No such file or directory） |
| アプリ既定データディレクトリ `~/.local/share/combomgr/` | **存在しない**（ディレクトリごと無い） |

**したがって本環境では `config.Load` がファイル非在パスを通り、`config.Default()` が使われる**（`internal/config/config.go` の godoc:「ファイルが存在しない場合は `Default()` を返し、エラーにはしない(初回起動の挙動)」）。

**(b) コード上の既定値**

```go
// internal/config/config.go  Default()
Defaults: DefaultsConfig{
    CharacterID: 1,
    PresetID:    1,
},
```

```go
// internal/config/config.go  DefaultsConfig
PresetID int64 `toml:"preset_id"`
```

**(c) それが指す `presets` の行**

| `id` | `code` | `name` | `is_builtin` |
|---:|---|---|---:|
| 1 | **`official_ja_move`** | 公式表記(日本語・技名表示)改善版 | 1 |

**(d) 検証ロジック**

`internal/config/config.go` L225-226:

```go
if c.Defaults.PresetID < 1 {
    return fmt.Errorf("config: invalid defaults.preset_id %d (want >= 1)", c.Defaults.PresetID)
}
```

**`>= 1` の範囲検査のみで、`presets` テーブルに当該 id が実在するかは検証していない。** 同型の検査が `internal/service/config/service.go` L227 にもある（`PUT /api/config` 経路）。

**(e) ★指示書に無い補足観点: `preset_id = 1` はもう 1 か所に別途ハードコードされている**

```go
// internal/model/recipe.go
// DefaultPresetID は recipe_cache のキーとして使う既定プリセットの id(文字列表現)。
const DefaultPresetID = "1"
```

`model.ExtractDefaultRecipe` はこの `"1"` を `recipe_cache` JSON のキーとして引く。**`config.Defaults.PresetID` とは連動していない**（型も `int64` と `string` で別、参照経路も別）。**利用者が `PUT /api/config` で `defaults.preset_id` を 2 に変えても、`recipe_cache` から取り出すキーは `"1"` のまま**である。

### 2. 契約・正典との差

- `SUPP-001` §5.8 の設定ファイル例に沿った既定値（`preset_id = 1`）がコード上の `Default()` と一致している。
- **`config.Defaults.PresetID` と `model.DefaultPresetID` が同じ「既定プリセット」という概念を 2 か所で別々に持っている。** 両者を一致させる仕組み（定数の共有・起動時の突合）は見当たらない。

### 3. 後続スコープへの含意

**`presets.id = 1` の削除・リネームは、`config.toml` 経路と `recipe_cache` キー経路の 2 系統に同時に効く。** D-288/299/300 が `presets` 行の削除を含む場合、この 2 経路の両方を波及範囲に数える必要がある。

### 4. 推奨（決定はしない）

- 案 1: 2 つの既定値を 1 つの定数に寄せる。
- 案 2: `recipe_cache` のキーを `config.Defaults.PresetID` から取るよう変える。
- 案 3: 現状維持（`preset_id` を変更する UI 導線の実態を確認してから決める）。

---

## C-4: フロント定数 `BUILTIN_PRESET_CODES` の現在値

### 1. 実態

**定義場所は `web/src/constants/` ではなく `web/src/features/preset/types.ts` L13**（★指示書の想定と場所が異なる。`web/src/constants/` 配下には preset 関連ファイルが無い）。

```ts
// web/src/features/preset/types.ts:12-19
// 組み込みプリセットコード(DES-004 §3.1、SUPP-001 §3.4)。
export const BUILTIN_PRESET_CODES = {
  officialJaMove: "official_ja_move",
  officialJaCommand: "official_ja_command",
  numericJa: "numeric_ja",
  numericEn: "numeric_en",
  srk: "srk",
} as const;
```

**参照箇所の全数**（検査対象＝`node_modules` を除くリポジトリ全体。`docs/` は別掲）

| # | 箇所 | 種別 |
|---:|---|---|
| 1 | `web/src/features/preset/types.ts:13` | 定義 |
| 2 | `web/src/features/combo/components/ComboDetailRecipe.tsx:10` | import |
| 3 | `web/src/features/combo/components/ComboDetailRecipe.tsx:30` | 使用（`p.code === BUILTIN_PRESET_CODES.officialJaMove`） |

**コード上の参照は 定義 1 + 実使用 2 の計 3 箇所。**

- **`web/e2e/` 配下: 0 件**（検査した件数＝`web/e2e/` 配下の全 spec ファイルを対象に `grep -rn`。ディレクトリには 10 本以上の spec が存在し、`grep` 自体は同ディレクトリで `official_ja_move` に 3 ヒットしているため、検査は対象を見ている）。
- **Go 側: 0 件**（TypeScript の定数のため当然）。
- `docs/` 配下: **4 ファイル**が言及（`docs/handover/phase1/m1-05-handover.md` / `docs/process/parallel-board.md` / `docs/instructions/M20-RESEARCH-01-preset-data-reality.md` / `docs/progress/phase1/m1-05-review.md`）。

### 2. 契約・正典との差 ★明らかな矛盾（§0.3(2)）

**前提事実 12 は現状と一致しない。**

| 前提事実 12 の記述 | 実測 |
|---|---|
| フロント定数 `BUILTIN_PRESET_CODES` は `numpad_ja` / `numpad_en` | **該当なし。** 実値は `official_ja_move` / `official_ja_command` / `numeric_ja` / `numeric_en` / `srk` |
| DB seed は `numeric_ja` / `numeric_en` | **一致**（C-1 のとおり） |
| **コード値不一致** | **不一致は解消している。** フロント定数 5 値と `presets.code` 5 値・`internal/model/preset.go` の 5 定数は**三者完全一致** |
| 現時点は未参照のため実害なし | **未参照でもない。** `ComboDetailRecipe.tsx:30` が `officialJaMove` を実際に参照している |

**`numpad_ja` / `numpad_en` はコード側に 0 件**（検査対象＝`node_modules` と `docs/` を除くリポジトリ全体。`docs/` にのみ記述が残る）。

**いつ是正されたかは未確認。** 本セッションのクローンは **shallow（`git rev-parse --is-shallow-repository` = true・履歴 56 コミット）** であり、`git log -S"numpad"` は `docs/` のコミットしか返さない。**フロント定数の是正コミットは取得済み履歴の範囲外にある。**

### 3. 後続スコープへの含意

`docs/progress/phase1/m1-05-review.md` の記録（および前提事実 12）は**失効した記録**である。D-299/D-300 が「コード値不一致の是正」を含んでいる場合、**その作業は既に済んでいる**。

### 4. 推奨（決定はしない）

- 案 1: 前提事実 12 を「解消済み」として設計卓側の記録を更新する。
- 案 2: 是正コミットの特定が要るなら、full clone を持つ環境（ローカル）で `git log -S` を回す。

---

## C-5: `official_ja_command` / `numeric_ja` / `numeric_en` の参照箇所（全系統）

### 1. 実態

**数えた単位＝`grep -rn` のヒット行 1 行（同一行に複数出現しても 1）。基準時点＝commit `1972d82`。検査対象は `node_modules` を除く。**

**系統別の件数**

| 系統 | `official_ja_command` | `numeric_ja` | `numeric_en` | （参考）`official_ja_move` | （参考）`srk` |
|---|---:|---:|---:|---:|---:|
| Go 本番（`internal/` `cmd/`・`_test.go` 除く） | **1** | **1** | **1** | 28 | 1 |
| Go テスト（`*_test.go`） | **0** | **4** | **2** | 67 | 3 |
| TypeScript 本番（`web/src/`・`.test.` 除く） | **1** | **1** | **1** | 6 | 1 |
| TypeScript テスト（`web/src/**/*.test.*`） | **0** | **0** | **0** | 1 | 0 |
| **E2E spec（`web/e2e/`）** | **0** | **0** | **0** | 3 | 0 |
| SQL / マイグレ（`migrations/`） | **4** | **4** | **4** | 81 | 4 |
| i18n ロケール JSON（`web/src/**/*.json`）★補足系統 | **0** | **0** | **0** | 0 | 0 |
| （参考）`docs/` 配下 ※ファイル数 | 21 | 21 | 15 | 112 | 17 |

**★「0 件」の裏取り**: E2E spec 系統は `official_ja_move` が同一検査で **3 件ヒット**しているため、検査器は `web/e2e/` を見ている。i18n JSON 系統は 5 コードすべてで 0 件であり、**`web/src/**/*.json` に preset code 文字列は 1 つも無い**（ロケールファイルは表示名を持つが `code` は持たない）。

**ヒット行の全数（`docs/` を除く 3 コード分）**

**`official_ja_command`（6 行）**

| ファイル:行 | 内容 |
|---|---|
| `internal/model/preset.go:7` | `PresetCodeOfficialJaCommand = "official_ja_command"` |
| `web/src/features/preset/types.ts:15` | `officialJaCommand: "official_ja_command",` |
| `migrations/000005_seed_presets.up.sql:10` | INSERT 行 |
| `migrations/000005_seed_presets.down.sql:4` | DELETE 対象 |
| `migrations/000006_seed_aliases_official_ja_move.up.sql:9` | コメント（「残り 4 プリセット…」） |
| `migrations/000011_seed_aliases_official_ja_move_aki_jamie_guile.up.sql:4` | コメント（同上） |

**`numeric_ja`（10 行）**

| ファイル:行 | 内容 |
|---|---|
| `internal/model/preset.go:8` | `PresetCodeNumericJa = "numeric_ja"` |
| `internal/repository/preset/repository_test.go:127` | テスト（`lookupPresetIDByCode`） |
| `internal/service/notation/cache_test.go:259` | テスト |
| `internal/service/notation/resolver_test.go:72` | テスト |
| `internal/infra/migration/migrate_test.go:928` | テスト（`numeric_ja alias count = 0 (empty as designed)`） |
| `web/src/features/preset/types.ts:16` | 定数 |
| `migrations/000005_seed_presets.up.sql:11` | INSERT 行 |
| `migrations/000005_seed_presets.down.sql:5` | DELETE 対象 |
| `migrations/000006_seed_aliases_official_ja_move.up.sql:9` | コメント |
| `migrations/000011_seed_aliases_official_ja_move_aki_jamie_guile.up.sql:4` | コメント |

**`numeric_en`（8 行）**

| ファイル:行 | 内容 |
|---|---|
| `internal/model/preset.go:9` | `PresetCodeNumericEn = "numeric_en"` |
| `internal/repository/preset/repository_test.go:157` | テスト |
| `internal/repository/preset/repository_test.go:163` | テスト（`expected 0 aliases for numeric_en`） |
| `web/src/features/preset/types.ts:17` | 定数 |
| `migrations/000005_seed_presets.up.sql:12` | INSERT 行 |
| `migrations/000005_seed_presets.down.sql:6` | DELETE 対象 |
| `migrations/000006_seed_aliases_official_ja_move.up.sql:9` | コメント |
| `migrations/000011_seed_aliases_official_ja_move_aki_jamie_guile.up.sql:4` | コメント |

### 2. 契約・正典との差

- **3 コードとも、本番コードでの参照は「定数定義 1 行（Go）＋ 定数定義 1 行（TS）」だけ**である。**振る舞いを分岐させている本番コードは 0 件。**
- マイグレ 4 件の内訳は「`000005` の up/down（実データ）」＋「`000006` / `000011` のコメント（実データではない）」であり、**実データを触っているのは `000005` の 2 行だけ**である。
- テストでの言及は `numeric_ja` 4 件・`numeric_en` 2 件で、いずれも**「エイリアスが 0 件であること」を固定するテスト**である（`migrate_test.go:928` の `"numeric_ja alias count = 0 (empty as designed)"`、`repository_test.go:163` の `"expected 0 aliases for numeric_en"`）。

### 3. 後続スコープへの含意

**M20 が `numeric_ja` / `numeric_en` にエイリアスを投入すると、上記の「0 件であること」を固定した既存テスト 2 本以上が落ちる。** 削除・リネームの波及範囲としては、本番コードは定数 2 行のみで小さいが、**テストとマイグレのコメントが追随を要する。**

### 4. 推奨（決定はしない）

- 案 1: 生成サブの着手前に「0 件固定テスト」の扱い（更新するか削除するか）を決めておく。
- 案 2: `000006` / `000011` のコメントは実データでないため据え置く。

---

# E. `rush_variant` の日本語別名（followup §G-14b の「要確認」）

## E-1: `rush_variant` の行数と `official_ja_move` エイリアスの有無

### 1. 実態

**数えた単位＝`moves` の 1 行。分母＝`moves` 1,653 行。**

| 指標 | 実値 |
|---|---:|
| `moves.category = 'rush_variant'` の行数 | **272** |
| うち `official_ja_move`（`preset_id=1`）のエイリアスあり | **272** |
| うち エイリアスなし | **0** |

**★補足の突合（指示書に無い観点）**

| 指標 | 実値 |
|---|---:|
| `moves.code LIKE 'rush\_%'` の行数 | **272** |
| `category='rush_variant'` かつ `original_move_id` が非 NULL | **268** |
| `category='rush_variant'` かつ `original_move_id` が **NULL** | **4** |

**`category` 基準の 272 と `move_code` 接頭辞基準の 272 は完全一致する**（両基準の食い違いは 0 件）。

CSV 側でも `category=rush_variant` は **272 行**で、**272 行すべてが `command` 空欄・`is_derived=true`**（A-3 の内訳と一致）。

### 2. 契約・正典との差

`rush_variant` は `web/src/features/moves/types.ts` L20/117 で「ラッシュ版」として定義されており、DB の `category` 値と一致している。

### 3. 後続スコープへの含意

**`rush_variant` 272 件は「エイリアスは付いているがコマンド索引には載らない」集合**であり、A-1 の 759 件の 36% を占める。P-30 が扱う対象に含めるかどうかで母数が大きく変わる。

### 4. 推奨（決定はしない）

- 案 1: `rush_variant` は既にエイリアスが一定形で付いているため、P-30 の対象外とする。
- 案 2: コマンド由来プリセットでは元技のコマンド + ラッシュ表記を合成する余地があるため対象に含める。

---

## E-2: エイリアスの実例と命名の形の分布

### 1. 実態

**数えた単位＝`rush_variant` かつ `official_ja_move` エイリアスを持つ `moves` の 1 行。分母＝272 行（全件）。**

**実例（`character_code` / `move_code` / `alias_text`。最大 20 件の指定に従い 20 件）**

| `character_code` | `move_code` | `alias_text` | 元技 `move_code` | 元技 `alias_text` |
|---|---|---|---|---|
| guile | `rush_burning_straight` | バーンストレート(ラッシュ) | `burning_straight` | バーンストレート |
| guile | `rush_crouching_heavy_kick` | しゃがみ強K(ラッシュ) | `crouching_heavy_kick` | しゃがみ強K |
| guile | `rush_crouching_heavy_punch` | しゃがみ強P(ラッシュ) | `crouching_heavy_punch` | しゃがみ強P |
| guile | `rush_crouching_light_kick` | しゃがみ弱K(ラッシュ) | `crouching_light_kick` | しゃがみ弱K |
| guile | `rush_crouching_light_punch` | しゃがみ弱P(ラッシュ) | `crouching_light_punch` | しゃがみ弱P |
| guile | `rush_crouching_medium_kick` | しゃがみ中K(ラッシュ) | `crouching_medium_kick` | しゃがみ中K |
| guile | `rush_crouching_medium_punch` | しゃがみ中P(ラッシュ) | `crouching_medium_punch` | しゃがみ中P |
| guile | `rush_full_bullet_magnum` | フルブレットマグナム(ラッシュ) | `full_bullet_magnum` | フルブレットマグナム |
| guile | `rush_guile_high_kick` | ガイルハイキック(ラッシュ) | `guile_high_kick` | ガイルハイキック |
| guile | `rush_knee_bazooka` | ニーバズーカ(ラッシュ) | `knee_bazooka` | ニーバズーカ |
| guile | `rush_reverse_spin_kick` | リバースピンキック(ラッシュ) | `reverse_spin_kick` | リバースピンキック |
| guile | `rush_rolling_sobat` | ローリングソバット(ラッシュ) | `rolling_sobat` | ローリングソバット |
| guile | `rush_spinning_back_knuckle` | スピニングバックナックル(ラッシュ) | `spinning_back_knuckle` | スピニングバックナックル |
| guile | `rush_standing_heavy_kick` | 立ち強K(ラッシュ) | `standing_heavy_kick` | 立ち強K |
| guile | `rush_standing_heavy_punch` | 立ち強P(ラッシュ) | `standing_heavy_punch` | 立ち強P |
| guile | `rush_standing_light_kick` | 立ち弱K(ラッシュ) | `standing_light_kick` | 立ち弱K |
| guile | `rush_standing_light_punch` | 立ち弱P(ラッシュ) | `standing_light_punch` | 立ち弱P |
| guile | `rush_standing_medium_kick` | 立ち中K(ラッシュ) | `standing_medium_kick` | 立ち中K |
| guile | `rush_standing_medium_punch` | 立ち中P(ラッシュ) | `standing_medium_punch` | 立ち中P |
| ingrid | `rush_crouching_heavy_kick` | しゃがみ強K(ラッシュ) | `crouching_heavy_kick` | しゃがみ強K |

**命名の形の分布（分母＝272 行・全件を機械判定）**

| 形 | 件数 |
|---|---:|
| **元技エイリアス + 接尾辞**（`<元技名>(ラッシュ)`） | **268** |
| 元技エイリアスが引けない（`original_move_id` が NULL） | **4** |
| 接頭辞形（`PREFIX + 元技エイリアス`） | **0** |
| 括弧で囲む形（元技名が中間に埋め込まれる） | **0** |
| 元技エイリアスと無関係 | **0** |

**接尾辞の実値の分布**

| 接尾辞 | 件数 |
|---|---:|
| `(ラッシュ)`（**半角括弧**） | **268 / 268**（100%） |

**★命名の形は完全に一定である。** 接尾辞は 1 種類しかなく、揺れ（全角括弧・スペース有無・語順違い）は 0 件。

**`original_move_id` が NULL の 4 件（全件）**

| `character_code` | `move_code` | `alias_text` |
|---|---|---|
| ingrid | `rush_glowing_touch_1hits` | グロータッチ(単発)(ラッシュ) |
| ingrid | `rush_luminous_uppercut_1hits` | ルミナスアッパー(単発)(ラッシュ) |
| lily | `rush_desert_storm_1hits` | デザートストーム(ラッシュ) |
| mai | `rush_hoshi_kujaku_1hits` | 星孔雀(単発)(ラッシュ) |

**この 4 件も `alias_text` の形自体は `…(ラッシュ)` で一定である。** 一定でないのは `original_move_id` のリンク（4 件だけ NULL）であり、命名ではない。**4 件とも `move_code` が `_1hits` で終わる**という共通点がある。

### 2. 契約・正典との差

- **`followup §G-14b`「`rush_variant` の日本語別名の有無」は「有り・272/272 件・命名は 1 形に統一」で答えが出た。**
- **`original_move_id` の欠落 4 件は、`E-1` の 272 と `E-2` の 268 の差の全量**である。`moves` DDL のコメントは `original_move_id` を「ラッシュ版のみ参照」と説明しており、`rush_variant` でありながら NULL の 4 件は**その説明から外れている**（NOT NULL 制約は無いためデータ違反ではない）。

### 3. 後続スコープへの含意

- 命名が 1 形に統一されているため、**`rush_variant` の表記を機械生成・機械検証する規則を書ける。**
- ただし **4 件は元技を辿れない**ため、「元技エイリアス + `(ラッシュ)`」を機械生成する実装は 4 件で元技を引けず、フォールバックを要する。

### 4. 推奨（決定はしない）

- 案 1: `(ラッシュ)` 接尾辞を正典化し、コマンド由来プリセットでも同じ接尾辞を使う。
- 案 2: `original_move_id` NULL の 4 件を先に埋める（別サブ）。
- 案 3: 生成は `alias_text` 側だけを見る実装にして `original_move_id` に依存しない。

---

## E-3: 通常投げ（前投げ / 後ろ投げ）の `official_ja_move` エイリアス実値

### 1. 実態

**数えた単位＝`moves` の 1 行。分母＝`moves.category='throw'` の 46 行（全件）。**

| 指標 | 実値 |
|---|---:|
| `category='throw'` の行数 | **46** |
| `move_code='throw_forward'` を持つキャラ数 | **17** |
| `move_code='throw_back'` を持つキャラ数 | **17** |
| `characters` 総数 | **19** |

（**`c_viper` と `dhalsim` は `throw` が 0 行**。この 2 キャラは `moves` が移動系 `system` 9 行のみで、CSV が存在しない未 seed キャラである。**したがって「17/19」は欠損ではなく、技データがあるキャラでは 17/17 = 100% である。**）

**`alias_text` の値分布（分母＝46 行）**

| `alias_text` | 件数 |
|---|---:|
| `後ろ投げ` | **17** |
| `前投げ` | **17** |
| `空投げ` | 2（juri / mai） |
| `フライングバスタードロップ` | 1（guile） |
| `フライングメイヤー` | 1（guile） |
| `前投げ(飲酒)` | 1（jamie） |
| `前投げ(飲酒 / 酔いLv4到達)` | 1（jamie） |
| `タルナード` | 1（jp） |
| `デザート・スライダー` | 1（rashid） |
| `ブレーンバスター` | 1（zangief） |
| `ジャーマンスープレックス` | 1（zangief） |
| `ロシアンドロップ` | 1（zangief） |
| `スパインバスター` | 1（zangief） |
| **計** | **46** |

**キャラ別の `throw_forward` / `throw_back` は 17 キャラすべてで `前投げ` / `後ろ投げ`**（例外 0 件）。

**`DES-004` §3.2 の正規化（`背負い投げ` → `前投げ` 等）の反映状況**

| 検査 | 該当件数 / 検査した件数 |
|---|---:|
| `preset_aliases.alias_text` に `背負い投げ` を含む | **0 / 1,653** |
| `character_data/*.csv` に `背負い投げ` を含む行 | **0 / 17 ファイル（1,479 行）** |
| `alias_text` に `前投げ` を含む | 19 / 1,653 |
| `alias_text` に `後ろ投げ` を含む | 17 / 1,653 |
| `alias_text` に `投げ` を含む | 39 / 1,653 |

**★「0 件」の裏取り**: 同一の `LIKE '%…%'` 検査が `投げ` で 39 件、`前投げ` で 19 件を返しているため、検査器は 1,653 行を見た上で `背負い投げ` を 0 と出している。CSV 側も `grep -c` が 17 ファイルを開いた上で 0 ヒットである（ファイル数を `ls | wc -l` で 17 と確認した上で実行）。

**`前投げ` 19 件の内訳**: `throw_forward` 17 件 + jamie の `前投げ(飲酒)` / `前投げ(飲酒 / 酔いLv4到達)` の 2 件。

### 2. 契約・正典との差

**`DES-004` §3.2 の正規化は実データに完全に反映されている。** 技データを持つ 17 キャラすべてで `前投げ` / `後ろ投げ` に揃っており、正規化前の表記（`背負い投げ` 等）は DB にも CSV にも 1 件も残っていない。

**★ただし jamie の 2 件は「`前投げ` + 括弧付き条件」という派生形**（`前投げ(飲酒)` / `前投げ(飲酒 / 酔いLv4到達)`）である。これらは `throw_forward` ではなく `forward_throw_drink` / `forward_throw_reach_drink_lv4` という別 `move_code` を持つ。**同一キャラ内で `前投げ` を接頭辞に持つ `alias_text` が 3 種類存在する**が、完全一致では衝突しないため B-2 は 0 件のままである。

### 3. 後続スコープへの含意

**通常投げは既に正規化済みのため、M20 の生成規則で通常投げを特別扱いする必要が実データ上は生じていない。** ただし jamie の条件付き前投げのように、**同一表記の接頭辞を共有する行が存在する**ため、前方一致で引く実装を作ると衝突する。

### 4. 推奨（決定はしない）

- 案 1: `throw_forward` / `throw_back` を機械判定の鍵にする（17/17 で一定）。
- 案 2: `alias_text` の前方一致は使わず完全一致に限る（jamie の 3 種の取り違えを避ける）。

---

# 想定外の発見・明らかな矛盾（§0.3(2) の記録）

判断・提案は含めない。**事実のみ**を挙げる。

| # | 種別 | 内容 |
|---:|---|---|
| **1** | **矛盾（指示書内）** | **§5 の見出しが `docs/progress/M20-RESEARCH-01-report.md` のまま**で、§2.1 が定める 2 本立て（`-report-web.md` / `-report-local.md`）と一致しない。v1.1.0 で §2.1 を分割した際の未追従と読める。**本レポートは §2.1 を正として `-report-web.md` に置いた。** |
| **2** | **矛盾（指示書内）** | **§6 DoD の「A-1 〜 F-4 の計 22 項目」が実数と合わない。** 実数は **A 5 + B 5 + C 5 + D 5 + E 3 + F 4 = 27 項目**。うち web セッションの担当は **18 項目**（A 5 + B 5 + C 5 + E 3）。本レポートは **18 項目すべて**を実値で報告している。 |
| **3** | **矛盾（指示書内）** | **§6 DoD の「`docs/progress/progress-log.md` へ索引行を追記した」と、§2.1/§2.2 の「変更してよいのは §2.1 の 1 本のみ／`docs/` 配下の他ファイルは変更しない」が直接衝突する。** 本セッションは**開発者判断（2026-08-12）により追記した**。**併せて、この衝突自体を本体（設計卓）へ連絡するよう指示を受けている。** |
| **4** | **矛盾（前提事実）** | **前提事実 12 が現状と一致しない**（C-4 参照）。`BUILTIN_PRESET_CODES` は `numpad_*` ではなく DB seed と完全一致しており、「コード値不一致」は解消済み。「未参照のため実害なし」も不正確で、`ComboDetailRecipe.tsx:30` が実参照している。 |
| **5** | **想定外の発見** | **A-4 段 4（`cond{`）の 0 件は、段 1 に隠されているだけである。** `guile.csv` の 3 行が `command` 列に `cond{` を実際に含むが、`is_derived=true` のため段 1 で落ちる。`raw{` は 17 ファイル全文で 0 ヒットであり、こちらは真に存在しない。 |
| **6** | **想定外の発見** | **`SkipUnknownToken` が段 3（`raw{`）と段 5（語彙外）の両方に使われている**ため、`seedgen -index-report` の理由別内訳では 2 段を切り分けられない（今回はどちらも 0 件のため実害なし）。 |
| **7** | **想定外の発見** | **既定プリセット id が 2 か所に独立してハードコードされている。** `config.Default().Defaults.PresetID = 1`（int64）と `model.DefaultPresetID = "1"`（string・`recipe_cache` のキー）。**両者は連動していない**（C-3(e)）。 |
| **8** | **想定外の発見** | **`config` の検証は `preset_id >= 1` の範囲検査のみで、`presets` テーブルへの実在確認をしていない**（`internal/config/config.go:225` と `internal/service/config/service.go:227` の 2 経路とも）。 |
| **9** | **想定外の発見** | **B-4 の主リスク（不可視文字）は 0 件だが、括弧の全角／半角混在が 33 行あり、うち 12 行は同一文字列内に両方を含む。** 完全一致の逆引き契約に対しては不可視文字と同型の影響を持つ。 |
| **10** | **想定外の発見** | **`rush_variant` 272 件のうち 4 件は `original_move_id` が NULL** で、`moves` DDL のコメント（「ラッシュ版のみ参照」）の想定から外れる。4 件とも `move_code` が `_1hits` で終わる。 |
| **11** | **想定外の発見** | **`moves` DDL の `category` コメントは 9 値を挙げているが、実データには `critical_art`（17 件）を含む 10 値が存在する**（コメントであり制約ではない）。 |
| **12** | **想定外の発見** | **`characters` 19 件のうち `c_viper` / `dhalsim` の 2 件は技データを持たない**（移動系 `system` 9 行のみ・CSV 無し）。キャラ別の分母を取るとき、この 2 件が「0 除算的」に効く。 |
| **13** | **調査上の限界** | **本セッションのクローンは shallow（56 コミット）** であり、`git log -S` による履歴追跡は取得済み範囲に限られる。C-4 の「いつ是正されたか」は**未確認**。 |
| **14** | **調査上の限界** | **`raw{` / 語彙外トークンの skip が 0 件であるため、段 3・段 5 の実挙動は実データで観測できていない**（実装の存在はコードで確認済み）。 |

---

# M20 サブ分割・スキーマ承認のための要決定事項

**判断はしない。決定に必要な実測値と選択肢のみを並べる。**

### 1. P-30 の判断材料（A-1 〜 A-5 の全数と内訳）

**「コマンドを持たない技」の母数は、定義により 4 通りに割れる。**

| 定義 | 件数 | 内訳 |
|---|---:|---|
| (a) DB で `move_commands` に対応が無い | **759** | `is_derived=1` 584 / `is_derived=0` 175 |
| (b) (a) のうち `is_derived=0` | **175** | 移動系 `system` 171 / `special` 4 |
| (c) 索引に載らなかった CSV 行（seedgen 実測） | **585** | derived 581 / empty-command 4 |
| (d) CSV の `command` 空欄 | **304** | `is_derived=true` 300 / `false` 4 |
| **(e) 「素の未割当」＝ `is_derived=0` かつ移動系を除く** | **4** | guile `sonic_blade_od` / jp `triglav_od` / jp `departure_od` / lily `condor_spire_od`（全て OD 技） |

**補足事実**: **(a) の 759 件すべてに `official_ja_move` エイリアスが付いており、`moves.code` が素で出る行は 0 件**（A-5）。したがって「表記が決まらないと何も出せない」行は現状存在しない。

**未確定**: P-30 が上記 (a)〜(e) のどれを母数に取るか。

### 2. `alias_text` 一意制約の実装可否（B-2 の衝突件数）

**`(moves.character_id, alias_text)` の重複は 0 グループ / 走査 1,653 行。**

**→ 指示書 §5 の判定基準に照らすと「0 件なら制約は既存データを壊さない」に該当する。**

**ただし次の 3 点を併せて読む必要がある。**

1. **エイリアスが入っているプリセットは `official_ja_move` の 1 種のみ**（他 4 種は 0 行）。**「プリセット横断」の横断が実質 1 プリセット分しかない**（B-2 §2）。
2. **キャラ軸を外した `(preset_id, alias_text)` では 60 グループ・783 行が重複する**（B-1）。**一意制約にキャラ軸を含めるか否かで結果が正反対になる。**
3. M20 が他 4 プリセットへエイリアスを生成すると、この 0 件は**生成規則次第で変わる**。

**未確定**: 制約のスコープ（`(character_id, alias_text)` / `(preset_id, character_id, alias_text)` / 制約を課さない）と、制約を生成の前に入れるか後に入れるか。

### 3. D-292 の条件（D-1 〜 D-3 の実件数）

**★本セッションでは測定していない。** 軸 D は §0.5 により**ローカル（devContainer）セッションの担当**であり、**本 web セッションのクリーン DB は `combos` 0 行・`setups` 0 行**であるため、**eager バッチの実コストは原理的に測れない**（指示書 §0.5 が同じ理由で軸 D をローカルへ割り当てている）。

**参考事実（クリーン DB での分母）**: `combos` 0 / `setups` 0 / `preset_aliases` 1,653 / `presets` 5。

**→ `docs/progress/M20-RESEARCH-01-report-local.md` を参照のこと。**

### 4. `presets.id = 1` の波及範囲（D-288 / D-299 / D-300 の材料）

**`preset_id = 1`（`official_ja_move`）は次の 4 系統から参照されている。**

| 系統 | 参照 |
|---|---|
| 設定既定値 | `config.Default().Defaults.PresetID = 1`（`presets` への実在検証なし） |
| `recipe_cache` キー | `model.DefaultPresetID = "1"`（**上記と非連動**） |
| エイリアス実データ | `preset_aliases` 1,653 行すべてが `preset_id=1` |
| コード文字列参照 | Go 本番 28 / Go テスト 67 / TS 本番 6 / TS テスト 1 / E2E 3 / マイグレ 81 |

**未確定**: 2 つの既定値ハードコードを統合するか（C-3(e)）。

### 5. `numeric_ja` / `numeric_en` へのエイリアス投入がテストを壊す件

**「エイリアス 0 件であること」を固定している既存テストが少なくとも 3 箇所ある。**

- `internal/infra/migration/migrate_test.go:928`（`numeric_ja alias count = 0 (empty as designed)`）
- `internal/repository/preset/repository_test.go:157`, `:163`（`expected 0 aliases for numeric_en`）

**未確定**: 生成サブでこれらをどう扱うか（更新 / 削除 / 生成対象から外す）。

### 6. 逆引きの完全一致と全角／半角混在

**`alias_text` 1,653 行のうち 33 行が全角括弧を含み、12 行は同一文字列に全角と半角の両方を含む。** 不可視文字（空白・改行・ゼロ幅・NBSP・TAB）は 0 件。

**未確定**: 逆引き前に正規化（NFKC 等）を挟むか、データ側を揃えるか、現状維持か。

### 7. 前提事実 12 の失効

**`BUILTIN_PRESET_CODES` の `numpad_*` 不一致は既に解消済み**であり、D-299 / D-300 のスコープに「コード値不一致の是正」が含まれている場合、**その作業は不要**である（C-4）。**是正コミットの特定は shallow clone のため本セッションでは未確認。**

---

# ■ 併せて更新が要るもの（教訓 E-114）

| 対象 | 要否 | 理由 |
|---|---|---|
| CHANGE 通知書 | **なし** | 本調査は read-only であり、設計書の記述変更を伴う実装をしていない。**指示書内の矛盾（§5 見出し・§6 の 22 項目）と前提事実 12 の失効は、指示書・ボード側の記録であって設計書本体ではない**ため、CHANGE ではなく本レポートの「想定外の発見・明らかな矛盾」節と要決定事項 7 で設計卓へ渡す |
| マイグレーション | **なし** | 1 本も作成・編集していない。`seedgen` の生成物は `-migrations` をスクラッチパッドへ向けたため `migrations/` に diff 0 |
| seed / `character_data/*.csv` | **なし** | 読取のみ |
| ソース / テスト | **なし** | 読取のみ。`git status --short` が空 |
| `docs/progress/progress-log.md` | **あり（実施済み）** | `CLAUDE.md` §8 および本指示書 §6 DoD により索引行を追記した。**§2.2 との衝突は開発者判断（2026-08-12）で「追記する」に倒し、衝突自体を本体へ連絡する** |
| `docs/handover/code-facts.md` | **なし** | 本調査は実コードを変更していないため再生成不要。なお §10-2 の DDL 記述（前提事実 1・2・4・6）は実 DB で裏取りでき、**齟齬は無かった** |
| `docs/handover/followup-backlog.md` §G-14b | **設計卓判断** | 軸 E の「要確認」に答えが出た（E-1 〜 E-3）。**本レポートは followup を編集していない**（§2.2） |

---

# 完了条件（§6 DoD）の自己点検

| # | 条件 | 状態 |
|---:|---|---|
| 1 | §4 の全項目を実値で報告 | **担当 18 項目（A-1〜A-5 / B-1〜B-5 / C-1〜C-5 / E-1〜E-3）を実値で報告した。** D-1〜D-5 / F-1〜F-4 の 9 項目は §0.5 によりローカルセッションの担当で、**本レポートの対象外**（§6 の「計 22 項目」は実数 27 と不一致＝矛盾 #2） |
| 2 | read-only を逸脱していない | **`git status --short` が空**。作成したのは本レポートと progress-log 索引行（開発者判断）のみ。使い捨て DB・ビルド成果物・seedgen 生成物はすべて**リポジトリ外のスクラッチパッド** |
| 3 | すべての「0 件」に「検査した件数」を併記 | **併記した**（A-4 段 3〜5 / A-5 / B-2 / B-3 / B-4 / B-5 / C-2 / C-4 の E2E / C-5 の i18n・E2E / E-1 / E-3 の `背負い投げ`）。**検査器が動いていることの裏付け**も各所に記した |
| 4 | すべての数字に「何を・どの単位で・どの基準時点で」を併記 | **§0 に共通条件を置き、各項目の「1. 実態」冒頭に単位と分母を再掲した** |
| 5 | 判断・設計結論を含めない | **含めていない。** 「4. 推奨」は指示書 §5 が求める複数案の併記であり、いずれも決定していない |
| 6 | 要決定事項が Plan Mode 相当の粒度でそろっている | **7 件を番号付きで集約した**（うち #3 は軸 D のため未測定である旨を明示） |
| 7 | `progress-log.md` へ索引行を追記 | **追記した**（開発者判断 2026-08-12） |
| 8 | 「■ 併せて更新が要るもの」を置いた | **置いた**（該当ありは progress-log の 1 件のみ） |

---

*以上、M20-RESEARCH-01 web セッション（軸 A / B / C / E）。基準時点 commit `1972d82` / migrations head `000068` / 2026-08-12。*
