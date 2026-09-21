# M33-02 完了報告 — 9 群の生成と同一性の検証

| 項目 | 内容 |
|------|------|
| 作業 ID | **M33-02** |
| 指示書 | `docs/instructions/M33-02-generate-and-verify-groups.md` **v1.1.0** |
| チェックリスト | `docs/instructions/reviews/M33-02-review-checklist.md` **v1.0.0** |
| 実施日 | 2026-09-19 |
| 着手基点 | **`b90df21`**（`git log --oneline -1`・§1.1） |
| CHANGE 消費 | **0 本**（自採番なし＝`D-293`） |
| マイグレ消費 | **0 本**。新系列は `000001` から始まる既存の連番体系の外である（指示書 §0.2） |
| 成果物 | `migrations/` の新系列 **18 ファイル**（up 9 ／ down 9） ＋ `REUSE.toml` ／ `scripts/check-migration-license.sh` の凍結表差し替え ＋ 本報告 |

> **★★★判定を最初に書く。⇒ 比較 4 面はすべて一致した。**
>
> | 面 | 結果 |
> |---|---|
> | **正規化スキーマ** | **一致**（`92e924e8…`。21 表 / 252 行） |
> | **全行** | **一致**（21 表すべて。★`users.created_at` の 1 セルのみ除外。理由は §4.3） |
> | **`sqlite_sequence`** | **一致**（`59448da1…`。9 行） |
> | **件数** | **一致**（21 表すべて） |
> | 補助: CHECK 節 | **一致**（5 節。★正規化ハッシュには現れないため独立に取った＝§4.4） |
>
> **★★合わせ込みは 1 度も行っていない。⇒ 最初の比較実行で 4 面とも一致した**（§4.6 に経緯を残した）。
>
> **★★★ただし「一致した」を額面どおりに読まないこと。** 本サブの生成方式は最終状態の書き出しであり、
> **全行比較は半ばトートロジーである。** 何がトートロジーで何がそうでないかを §3.2 に分けて書いた。
> **⇒ 比較が生きていることは §5 の破壊確認でしか担保されない。**

---

## 0. 数値の読み方（`M-157` ／ チェックリスト F-3）

| 印 | 意味 |
|---|---|
| **実測** | この手番でコマンドを回して得た値。式を併記してある |
| **算出** | 実測値から計算した値 |
| **引用** | 他資料に書いてある値。この手番では確かめていない |

**★断りの無い数値はすべて実測である。**

---

## 1. 段 1 — 前提の再確認（指示書 §2.1 ／ チェックリスト E-1 E-2 E-8）

### 1.1 着手前の版ゲート 6 点（指示書 §0.5）— **6 点とも通過**

| # | 確かめたこと | 結果 |
|---|---|---|
| **1** | `docs/instructions/reviews/M33-02-review-checklist.md` の存在 | **通過**。8839 バイト・v1.0.0・2026-09-13 発行 |
| **2** | `M33-overview` が **v2.6.0 以上**（9 群になっているか） | **通過**。**v2.7.0**。§0.5.3 が 9 群 / 層 A 4 本・層 B 5 本を持つことを実物で確認 |
| **3** | `docs/progress/M33-01-completion-report.md` が在ること | **通過**。84781 バイト |
| **4** | `SUPP-001` が **1.68.0 以上** | **通過**。**v1.74.0** |
| **5** | `ls migrations/` の最新と凍結点 `5576126` からの増分 | **通過**。§1.3 に実測を置いた |
| **6** | `git log --oneline -5` で枝元を報告へ | **通過**。下記 |

```
$ git log --oneline -5
b90df21 Merge pull request #233 from plexiblinp/claude/adoring-thompson-hl2142
c53afe7 Merge pull request #231 from plexiblinp/claude/clever-darwin-87l5gp
305f871 Merge remote-tracking branch 'origin/main' into claude/clever-darwin-87l5gp
0ad4302 docs: 開発者裁定 4 件を受け CHANGE-219 を起票＋反映する（D-897）
d44d047 Merge pull request #232 from plexiblinp/claude/jolly-dijkstra-7uiysu
```

### 1.2 並列 0 本（指示書 §0.3 ／ チェックリスト E-1）

**★★これは製造の側から実測できない事実である**——他セッション・他ブランチの走行有無はリポジトリに現れない。
**⇒ 着手前に開発者へ照会し、回答を得た。**

| 項目 | 内容 |
|---|---|
| 照会 | 2026-09-19・計画提示前 |
| **開発者回答** | **「並列 0 本・着手してよい」**（`M31` 族 / `M32` / `M37` は全着地） |
| 製造側の傍証（実測） | `main` への最終マージは `b90df21`。`migrations/` の増分は §1.3 の 4 本のみ |

### 1.3 凍結点 `5576126` からの増分（指示書 §0.3 ／ チェックリスト E-2）— **★増分は 0 ではない**

```bash
# 式1: 本数・範囲・欠番
ls migrations/*.up.sql | wc -l                                          # -> 115
ls migrations/*.up.sql | sed 's|.*/||' | cut -d_ -f1 | sort -n | sed -n '1p;$p'
#   -> 000001 / 000117
ls migrations/*.up.sql | sed 's|.*/||' | cut -d_ -f1 | sort -n \
  | awk '{n=$1+0; if(prev && n!=prev+1){for(i=prev+1;i<n;i++) printf "%06d\n", i} prev=n}'
#   -> 000012 / 000113   (欠番 2 件)

# 式2: 凍結点からの差分
git diff --numstat 5576126..HEAD -- migrations/
```

| 項目 | 凍結点 `5576126`（**引用**＝`M33-01`） | 着手時 `b90df21`（**実測**） |
|---|---|---|
| `*.up.sql` | 111 本 | **115 本** |
| 連番の範囲 | `000001`〜`000112` | **`000001`〜`000117`** |
| 欠番 | `000012` の 1 件 | **`000012` / `000113` の 2 件** |

**★★増分は「新規 4 本」だけではない。⇒ 既存 6 本が書き換わっている。**

| 区分 | 番号 | 由来 |
|---|---|---|
| **新規 4 本** | `000114` / `000115` / `000116` | **`M37-04`**（`first_hit_startup` 列の追加・chun_li 鷹嘴連拳の是正・backfill） |
| | `000117` | **`M37-07`**（`combos.starter_meaty` の追加） |
| **欠番 1 件** | `000113` | 払い出されたが使われなかった |
| **★既存の書き換え 6 本** | `000033` / `000084` / `000085` / `000086` / `000090` / `000091` | **golden の再生成**（`SUPP-001` §5.5.4 規約 (19)/(20)）。`000033` はコメント 1 行、他 5 本は chun_li `soaring_eagle_punches` の扱いの変更に伴う行の増減 |

**★★★「増えた 4 本を足す」だけでは足りない。⇒ 既存 6 本の*中身*が動いているため、対応表の群は不変でも最終状態が動く。**
**★設計卓の起票時の把握**（指示書 §0.5-5 の「増分は 5 本」）**は本数としては合っている**〔`000113` が欠番のため実ファイルは 4 本〕**が、既存 6 本の書き換えには触れていない。⇒ 本報告で補う。**

### 1.4 `M33-01` の対応表への追記（指示書 §0.3 ／ §2.1-2）

**★`M33-01` 完了報告そのものは書き換えない**（歴史記録）**。⇒ 差分として本節に置く。**

| 旧番号 | 名称 | 吸収先 | 実測層 | 根拠 |
|---|---|---|---|---|
| **`000114`** | add_moves_first_hit_startup | **S01** | A | `ALTER TABLE moves ADD COLUMN first_hit_startup INTEGER` のみ。データ 0 行 |
| **`000115`** | data_correct_chun_li_soaring_eagle_air_only | **S03** | B | `UPDATE moves`（chun_li 鷹嘴連拳を空中限定ターゲットコンボへ） |
| **`000116`** | data_backfill_moves_first_hit_startup | **S03** | B | `UPDATE moves SET first_hit_startup = ...` |
| **`000117`** | add_combos_starter_meaty | **S01** | A | `ALTER TABLE combos ADD COLUMN starter_meaty INTEGER NOT NULL DEFAULT 0` のみ |

| 書き換わった旧番号 | 吸収先（**不変**） | 何が動いたか |
|---|---|---|
| `000033` | S01 | コメント 1 行のみ。最終状態に影響しない |
| `000084` / `000085` / `000090` / `000091` | S03 / S06 | chun_li 分の行の増減（golden 再生成） |
| `000086` | S04 | `chun_li` の `soaring_eagle_punches` → `HP>HP` の 1 行が消えた（61 → 60 commands） |

**⇒ 対応表の母集団は 111 行 → 115 行（算出）。★群の割当が変わった行は 0 行である。**

### 1.5 基準 DB（旧最終状態）の構築（指示書 §2.1-3 ／ チェックリスト A-6）

**`M33-01` §5.1 の手順をそのまま使った。**

```bash
TACPENDIUM_DB_PATH=scratch-m33-02-old.db \
TACPENDIUM_CONFIG_PATH=<作業ツリー外>/m33-02-config.toml \
TACPENDIUM_PORT=47391 \
  go run ./cmd/tacpendium
#   internal/infra/migration.Run() が embed.FS の 115 本を Up() で適用する
```

| 確認項目 | 結果 |
|---|---|
| `schema_migrations` | **`version=117` / `dirty=0`** |
| 表（`sqlite_%` 除く） | **22** ＝ アプリ 21 ＋ `schema_migrations` |
| `pragma foreign_key_check` | **0 件** |
| `pragma integrity_check` | **`ok`** |
| 実体の置き場 | `.gitignore:30` の `*.db`。`docs/` の下に置いていない。`config.toml` は作業ツリー外へ逃がした |

### 1.6 ★★★正規化ハッシュ — **`M33-01` の値とは一致しない。⇒ それが正しい**

**`M33-01` §5.2.1 のスクリプト*本体*を使った**（規約 (18)。**値だけを引き継がない**）**。DB パスだけを引数化し、連結の書式は 1 バイトも変えていない。**

| 対象 | 正規化スキーマ sha256 | `sqlite_sequence` sha256 | 行数 |
|---|---|---|---|
| **凍結点 `5576126`**（`M33-01` の**引用**） | `9b87a96e6704…ad77e` | `694011b0fe4e…8fb69` | 250 |
| **着手時 `b90df21`**（本サブの**実測**） | **`92e924e8bf1e58aab59bb8f0e63412b58777730f29515159f4858c6a3333d760`** | **`59448da12ba91732f3008151750777e962629bd7ac510a8e259b77384126ba26`** | **252** |

**★★食い違いは「土台が違う」ではなく「土台が動いた」である。機序を実測で示す。**

```bash
# 式3: 凍結点の正規化投影と着手時の正規化投影を行単位で突き合わせる
diff norm-frozen.txt norm-old.txt
#   132a133
#   >   COL starter_meaty|INTEGER|notnull=1|default=0|pk=0        <- combos。000117
#   185a187
#   >   COL first_hit_startup|INTEGER|notnull=0|default=None|pk=0 <- moves。 000114
```

**⇒ 差は 2 行ちょうどであり、`000114` / `000117` が足した 2 列と 1 対 1 に対応する。★他の 250 行は 1 文字も動いていない。**

### 1.7 ★★★レシピの引き継ぎを裏取りした（チェックリスト A-3）

**★「`M33-01` のハッシュと一致しない」と報告する前に、*スクリプトの引き継ぎが正しいこと*を独立に確かめた。**

**手順**＝凍結点 `5576126` の `migrations/` 222 ファイルを `git show` でスクラッチへ取り出し、連番順に適用してハッシュを取る。

```bash
# 式4
git ls-tree -r --name-only 5576126 migrations/ > frozen-list.txt   # -> 222 行
while read -r f; do git show "5576126:$f" > frozen-migrations/$(basename "$f"); done < frozen-list.txt
python3 apply_series.py frozen-migrations frozen-py.db             # -> applied 111 files, version = 112
python3 norm_hash.py frozen-py.db
```

| 出力 | 値 | `M33-01` の記載 | 判定 |
|---|---|---|---|
| 正規化スキーマ sha256 | `9b87a96e67042850603e692fc3a3599e9002bdec3ac8a3f71ba6b3a2809ad77e` | 同一 | **再現** |
| `sqlite_sequence` sha256 | `694011b0fe4e87f8098b220eb3a9b1a414ea5df0cc1136208738d2aefe48fb69` | 同一 | **再現** |
| 行数 | 250 | 250 | **再現** |

**⇒ 3 つとも `M33-01` の値をそのまま再現した。★したがって §1.6 の食い違いは、レシピの取り違えでも書式の違いでもなく、増分そのものである。**

**★★あわせて「適用器の等価性」も取れた。** 同じ適用器で着手時の 115 本を流すと、**アプリ経由**（`modernc.org/sqlite` ＋ `golang-migrate`）**で作った基準 DB と 2 つのハッシュが完全に一致する**（`92e924e8…` / `59448da1…`）**。⇒ 適用器はスキーマ面でアプリ経路と等価である。**

### 1.8 表ごとの行数・`max(id)`・`seq`（**どの表が明示補正を要するか**）

```bash
# 式5: 各表の行数 / max(id) / sqlite_sequence.seq を並べる(実行本体は §10 に貼った)
```

| 表 | 行 | `max(id)` | `seq` | 判定 |
|---|---|---|---|---|
| `characters` | 31 | **34** | **34** | `seq == max(id)`。**⇒ id を明示投入すれば自動で 34 になる** |
| `moves` | 3057 | 3236 | 3236 | 同上 |
| `preset_aliases` | 7635 | 7814 | 7814 | 同上 |
| `presets` | 3 | 5 | 5 | 同上 |
| `games` / `users` | 1 | 1 | 1 | 同上 |
| `tags` | 3 | 3 | 3 | 同上 |
| **`combos`** | **0** | — | **0** | **★★★行 0 なのに `sqlite_sequence` に行が在る。⇒ 明示投入が要る** |
| **`combo_oki_options`** | **0** | — | **0** | **★★★同上** |
| 他 12 表 | 0 | — | 無し | `sqlite_sequence` に現れない。**⇒ 行を作らない** |

**★★★これが本サブの実装を決めた実測である。**

- **`characters` の `seq` 34 は「明示補正」ではなく「id の明示投入」で再現される。** `M33-01` §2.6 が言う `000009` の差 3 は、**削除された 3 行の id が今も欠番として `characters.id` に残っている**ためであり、id をそのまま書き出せば最大 id が 34 になる。
- **★逆に `combos` / `combo_oki_options` は行が 1 つも無いため、書き出しでは絶対に再現されない。⇒ `S01` が明示的に `INSERT INTO sqlite_sequence` する**（§3.3）。

---

## 2. 生成した 9 群

| 連番 | 群 | 内容 | 層 | 名に `_data_` | up のサイズ |
|---|---|---|---|---|---|
| `000001` | **S01** | 最終スキーマ（21 表 / 21 索引 / CHECK 5 節） ＋ `sqlite_sequence` の初期化 | **A** | **無** | 16159 B |
| `000002` | **S02a** | `games`（1 行） | **A** | **無** | 556 B |
| `000003` | **S02b** | `characters`（31 行・`custom_states` 列を含む） | **B** | 有 | 11995 B |
| `000004` | **S03** | `moves`（3057 行・自己参照 514 行は 2 パス） | **B** | 有 | 497629 B |
| `000005` | **S04** | `move_commands`（1634 行） | **B** | 有 | 36954 B |
| `000006` | **S05** | `move_derivations`（459 行） | **B** | 有 | 7621 B |
| `000007` | **S06a** | `presets`（3 行） | **A** | **無** | 979 B |
| `000008` | **S06b** | `preset_aliases`（7635 行） | **B** | 有 | 354703 B |
| `000009` | **S07** | 初期 `users`（1 行） ＋ 予約 `tags`（3 行） | **A** | **無** | 1407 B |

**★`down` も 9 本ある**（群の逆順。`S01` は `DROP TABLE`、他は `DELETE FROM` ＋ `sqlite_sequence` の掃除）。

| 項目 | 旧 | 新 | 種別 |
|---|---|---|---|
| ファイル数 | 230 | **18** | 実測 |
| 総容量 | 2.9 MB | **980 KB** | 実測 |

### 2.1 完了条件の逐条確認

| # | 条件 | 結果 |
|---|---|---|
| **5** | 新系列が `000001` から始まる | **満たす**。`000001`〜`000009`。**★`000118` も `000114` も取っていない** |
| **6** | 廃止 8 本が書かれていない | **満たす**。`000009` / `000010` / `000011` / `000022` / `000028` / `000029` / `000081` / `000103` の内容は 1 行も書いていない |
| **6b** | `000009` の `seq` 差 3 が再現されている | **満たす**。`characters` は行 31 / `seq` 34（§4.2）。**★機序は §1.8**——id を明示投入することで再現される |
| **7** | `000018` / `000074` が層で分割されている | **満たす**。§2.2 |
| **8** | `migrations/legacy/` を作っていない ／ 歴史テストを移していない | **満たす**。§9.2 |

### 2.2 `000018` / `000074` の層分割（指示書 §2.2-4 ／ チェックリスト B-5）

**★この 2 本は「凍結表の据置きだけで緑になっていた 2 本」である**（`M33-01` §2.8）**。⇒ 潰した瞬間に据置きが消えるため、分割が要る。**

| 旧番号 | DDL 部（層 A） | 値の部（層 B） | 新系列での置き場 |
|---|---|---|---|
| **`000018`** | `ALTER TABLE moves DROP/ADD COLUMN` | `UPDATE moves SET raw_data = json_remove(...)` | **DDL は `000001`（S01・層 A）／ `raw_data` の最終値は `000004`（S03・層 B）** |
| **`000074`** | `ALTER TABLE preset_aliases ADD COLUMN character_id` | `UPDATE preset_aliases SET character_id = ...` | **DDL は `000001`（S01・層 A）／ `character_id` の値は `000008`（S06b・層 B）** |

**⇒ 生成方式が最終状態の書き出しであるため、分割は構造上自動的に満たされる。★それでも目で確かめた**——`000001` は `moves.raw_data` にも `preset_aliases.character_id` にも値を 1 つも入れていない（`INSERT`/`UPDATE` を持たない＝§6.2 の表）。**★`preset_aliases.character_id` が NULL の行は 0 件である**（実測）**。⇒ `000074` の `UPDATE` を通した後の値が `000008` に入っている。**

---

## 3. 生成方式（**★方式と弱点を先に宣言する**）

### 3.1 何をしたか

**旧系列を最後まで適用した DB の「最終状態」を、`M33-01` §2.4 の対応表が定める表 → 群の割当に従って群ごとに書き出した。**
**`S01` だけは手書きの DDL である**（書き出しではない）。

**★理由＝3057 行の `moves` と 7635 行の `preset_aliases` を 115 本の SQL から人手で再構成することはできない。⇒ 最終状態の書き出しが唯一の現実解である。**

### 3.2 ★★★この方式の弱点 — **何がトートロジーで、何がそうでないか**

**★★「全行が一致した」は、それ自体では*ほとんど何も言っていない*。** 旧 DB から書き出したものを旧 DB と比べているからである。**⇒ 隠さずに書く。**

| 面 | トートロジーか | 理由 |
|---|---|---|
| **全行（面2）・行を持つ 9 表** | **★ほぼトートロジー** | 旧 DB から書き出した値を旧 DB と比べている。⇒ `games` / `characters` / `moves` / `move_commands` / `move_derivations` / `presets` / `preset_aliases` / `users` / `tags` |
| **全行（面2）・行 0 の 12 表** | **★★トートロジーですらない**（**弱い**） | **書き出す行が 1 つも無い。⇒ 「新も 0 行」は `S01` が表を作っただけで成立する。★この 12 表について面 2 が主張しているのは「余計な行が入っていない」だけである** |
| **件数（面4）** | **★上と同じく 2 分される** | 同上 |
| **正規化スキーマ（面1）** | **★★トートロジーではない** | **`S01` は手書きである。** 旧系列が 115 本の `ALTER` で積み上げた構造と、手書きの `CREATE TABLE` 群を突き合わせている |
| **`sqlite_sequence`（面3）** | **★★トートロジーではない** | **行の書き出しでは再現されない面が在る**（`combos` / `combo_oki_options` の `seq=0`）。**⇒ 明示的に作らなければ落ちる** |
| 補助: CHECK 節 | **★★トートロジーではない** | `S01` が手書きであり、かつ `pragma` に現れないため正規化ハッシュでも見えない |

**★★加えて、書き出した行が*手書きの `S01`* を通ること自体が検査である**——`NOT NULL` / `CHECK` / FK / UNIQUE / 型 / 自己参照の 2 パス / JSON `TEXT` の往復。**⇒ `S01` の 1 列でも取り違えていれば、8 群のどれかが適用時に落ちる。**

**★★★そして最終的な担保は §5 の破壊確認 4 件である。⇒ 「一致した」だけでは、比較が何も見ていない可能性を排除できない。**

### 3.3 `sqlite_sequence` の扱い（指示書 §2.4 ／ チェックリスト C-1〜C-4）

| 罠 | 対処 | 置き場 |
|---|---|---|
| **`combos` / `combo_oki_options` は行 0 でも `seq=0` の行を持つ** | **`INSERT INTO sqlite_sequence (name, seq) VALUES (...)` を明示** | **`000001`（S01）** |
| **`000009` を廃止すると `characters` の `seq` 差 3 が失われる** | **id を明示投入する。⇒ 最大 id が 34 なので `seq` も 34 になる** | `000003`（S02b） |
| `moves` / `preset_aliases` / `presets` の差 | 同上（id の明示投入） | `000004` / `000008` / `000007` |

**★`preset_aliases` の差 179 について**（指示書 §2.4 の注記）**＝`M33-01` の機序は推定であると明示されていた。⇒ 本サブは機序を前提にしていない。値**（`seq` 7814・行 7635・最大 id 7814）**をそのまま再現している。**

> **★★★`sqlite_sequence` への直接書き込みは、本リポジトリで初めてである**（`grep -ln sqlite_sequence migrations/*.sql` が旧 115 本で 0 件＝実測）**。⇒ 新しい手である。**
>
> **★なぜ要るか**＝`combos` / `combo_oki_options` は行が 1 つも無いため、行の書き出しでは `sqlite_sequence` に行が生まれない。
> **★旧系列で行が生まれた機序**＝SQLite は AUTOINCREMENT 表への `INSERT` 文の終端で、**0 行しか入らなくても** `sqlite_sequence` へ `seq=0` を書き戻す。`combos` は `000016`/`000019` の表再構築、`combo_oki_options` は `000021` の 0 行 `INSERT` がそれに当たる。
> **⇒ 「空の表は飛ばす」と実装すると、ここで静かにずれる。**

### 3.4 `users.created_at` — **★値を写さなかった唯一の場所**

**旧 `000007` は `INSERT OR IGNORE INTO users (id, name) VALUES (1, 'default')` であり、`created_at` を与えていない。⇒ `DEFAULT (datetime('now'))` が効く。**

**★★したがって `users.created_at` は構築時刻であり、独立に構築した 2 つの DB では原理的に一致しない。**

```bash
# 式6: 旧系列を 3 回独立に構築したときの users.created_at
#   scratch-m33-02-old.db  -> 2026-09-19 02:40:32   (アプリ経由・着手時の 115 本)
#   head-py.db             -> 2026-09-19 02:41:11   (適用器・着手時の 115 本)
#   frozen-py.db           -> 2026-09-19 02:41:27   (適用器・凍結点の 111 本)
```

**⇒ 3 回とも違う。★これは新旧の差ではない。旧系列同士でも一致しない。**

**⇒ 本サブは「値を写さず、同じ既定に任せる」を選んだ。⇒ 旧の意味論をそのまま再現している。**
**★ここで値を固定すると、旧の意味論を*変えて*しまう**（以後どの DB も同じ `created_at` を持つ）**。⇒ それは合わせ込みである。**

**★比較では当該 1 セルだけを値の比較から外し、「両者とも NOT NULL の日時が入っていること」を見た**（§4.3）**。外したことは比較の出力に必ず印字される。**

---

## 4. 段 3 — 同一性の検証（**本サブの本体**・指示書 §5 ／ チェックリスト 束 A）

### 4.1 独立構築（チェックリスト A-6）

| | 旧最終状態 | 新 baseline |
|---|---|---|
| DB | `scratch-m33-02-old.db` | `scratch-m33-02-new.db` |
| 経路 | **本番の `modernc.org/sqlite` ＋ `golang-migrate`**（`go run ./cmd/tacpendium`） | **同じ** |
| 適用本数 | 115 | **9** |
| `schema_migrations` | `version=117` / `dirty=0` | **`version=9` / `dirty=0`** |

```
# 新 baseline の適用ログ(logs/tacpendium.log。★logs/ は .gitignore:36 済み)
"3/u data_seed_characters (11.815228ms)"
"4/u data_seed_moves (47.802443ms)"
"5/u data_seed_move_commands (54.331845ms)"
"6/u data_seed_move_derivations (57.649133ms)"
"7/u seed_presets (60.505839ms)"
"8/u data_seed_preset_aliases (101.583095ms)"
"9/u seed_initial_users_tags (104.162917ms)"
"migration completed" version=9 dirty=false
```

**⇒ 完了条件 §5-7（空の DB へ最初から適用して通ること）を満たす。★9 本で 104 ms である。**

### 4.2 比較 4 面の結果（**1 面の一致で「全一致」と書かない**）

#### 面 1 — 正規化スキーマ（規約 (18) の取り方）

| | 表 | 行 | sha256 |
|---|---|---|---|
| 旧 | 21 | 252 | `92e924e8bf1e58aab59bb8f0e63412b58777730f29515159f4858c6a3333d760` |
| 新 | 21 | 252 | `92e924e8bf1e58aab59bb8f0e63412b58777730f29515159f4858c6a3333d760` |

**一致。★取り方は `pragma table_info` / `foreign_key_list` / `index_list` である。`sqlite_master.sql` のテキストでは比較していない。**

#### 面 4 ＋ 面 2 — 件数と全行（**表ごとに 1 行**・チェックリスト A-7）

| 表 | 旧行 | 新行 | 行ハッシュ（旧/新・先頭 12 桁） |
|---|---|---|---|
| `characters` | 31 | 31 | `13e3adfbc8aa` / `13e3adfbc8aa` |
| `combo_oki_options` | 0 | 0 | `01ba4719c80b` / `01ba4719c80b` |
| `combo_punish_curations` | 0 | 0 | `01ba4719c80b` / `01ba4719c80b` |
| `combo_punish_prunings` | 0 | 0 | `01ba4719c80b` / `01ba4719c80b` |
| `combo_punish_starters` | 0 | 0 | `01ba4719c80b` / `01ba4719c80b` |
| `combo_punishes` | 0 | 0 | `01ba4719c80b` / `01ba4719c80b` |
| `combo_setup_results` | 0 | 0 | `01ba4719c80b` / `01ba4719c80b` |
| `combo_setups` | 0 | 0 | `01ba4719c80b` / `01ba4719c80b` |
| `combo_steps` | 0 | 0 | `01ba4719c80b` / `01ba4719c80b` |
| `combo_tags` | 0 | 0 | `01ba4719c80b` / `01ba4719c80b` |
| `combos` | 0 | 0 | `01ba4719c80b` / `01ba4719c80b` |
| `games` | 1 | 1 | `774117e3f262` / `774117e3f262` |
| `move_commands` | 1634 | 1634 | `493715f3a7ac` / `493715f3a7ac` |
| `move_derivations` | 459 | 459 | `5f2284235669` / `5f2284235669` |
| `moves` | 3057 | 3057 | `d3e04ecdac99` / `d3e04ecdac99` |
| `preset_aliases` | 7635 | 7635 | `d48fc7fa9395` / `d48fc7fa9395` |
| `presets` | 3 | 3 | `8af25dac49bf` / `8af25dac49bf` |
| `setup_steps` | 0 | 0 | `01ba4719c80b` / `01ba4719c80b` |
| `setups` | 0 | 0 | `01ba4719c80b` / `01ba4719c80b` |
| `tags` | 3 | 3 | `91983b4fb5ad` / `91983b4fb5ad` |
| **`users`** | 1 | 1 | `17d777685bf9` / `17d777685bf9` **※volatile 除外: `created_at`** |

**件数 一致 ／ 全行 一致。★21 表すべてを出した。**

#### 面 3 — `sqlite_sequence`（**独立に実測**・チェックリスト C-4）

| | 内容 |
|---|---|
| 旧 | `characters=34` / `combo_oki_options=0` / `combos=0` / `games=1` / `moves=3236` / `preset_aliases=7814` / `presets=5` / `tags=3` / `users=1` |
| 新 | **同一**（9 行） |
| sha256 | 旧 `59448da12ba91732f3008151750777e962629bd7ac510a8e259b77384126ba26` ／ 新 **同一** |

**★★チェックリスト C-1 / C-2 の対照:**

| 観点 | 結果 |
|---|---|
| **`characters` の `seq` が 34（行 31 に対して）** | **再現**（`000009` を廃止した分の 3 が失われていない） |
| **`combos` / `combo_oki_options` の `seq=0` の行が在る** | **在る**。「空の表は飛ばす」と実装していない |
| **`preset_aliases` の差** | **値で合わせた**（`seq` 7814 / 行 7635）。機序は前提にしていない |

### 4.3 volatile セルの扱い（**★除外したことを隠さない**）

| セル | 旧 | 新 | 扱い |
|---|---|---|---|
| `users.created_at` | `2026-09-19 02:40:32` | `2026-09-19 02:47:53` | **値の比較から除外。⇒ 理由は §3.4**。除外の代わりに「両者とも NOT NULL の日時が入っていること」を確認（**True**） |

**★除外はこの 1 セルだけである。⇒ 比較スクリプトは除外対象を定数 `VOLATILE` に持ち、実行のたびに印字する。**

### 4.4 補助面 — **面 1 が見ない属性の全数**（**★CHECK だけではない**）

> **★★【レビュー 中-3 の是正】初版は「正規化ハッシュが見ないのは CHECK 節である」と書いた。⇒ 不十分である。★死角は 8 種類あり、全数を実測で突き合わせた。**

**`pragma table_info` / `foreign_key_list` / `index_list` が返さない属性を列挙し、旧新で突き合わせた結果:**

| # | 面 1 が見ない属性 | 旧 | 新 | 判定 |
|---|---|---|---|---|
| **1** | **`AUTOINCREMENT`**（★`table_info` は `pk=1` としか言わない） | **16 表** | **16 表** | **一致** |
| 2 | `WITHOUT ROWID` | 0 | 0 | 一致 |
| **3** | **partial index の `WHERE` 述語**（★`index_list` は `partial=1` としか言わない） | 1 件 | 1 件 | **一致**（`ux_preset_aliases_preset_char_alias_en` = `WHERE alias_text_en IS NOT NULL`） |
| 4 | 列の `COLLATE` | 0 | 0 | 一致 |
| 5 | 生成列（`GENERATED ALWAYS AS`） | 0 | 0 | 一致 |
| 6 | トリガ | 0 | 0 | 一致 |
| 7 | ビュー | 0 | 0 | 一致 |
| 8 | 索引の照合順（`index_xinfo`） | 21 | 21 | 一致 |
| **9** | **`CHECK` 節** | **5** | **5** | **一致**（下記） |

**⇒ 9 種類とも一致した。★「見えないから確かめない」ではなく、「見えないから別に取って確かめた」。**

#### ★★★死角が実在することを破壊確認で示した（§5.3）

**`S01` の `setups.id` から `AUTOINCREMENT` を 1 語だけ外した DB を作ると、比較 4 面も補助 CHECK 面も*すべて緑のまま通る*。⇒ 面 1 は `AUTOINCREMENT` の欠落を検出できない。**

**★これは本サブの成果物の欠陥ではない**（上表のとおり実物は 16/16 で一致している）**。⇒ 検査手法の限界であり、記録しておかないと次の担当が「面 1 が緑なら構造は同じ」と読む。★`SUPP-001` §5.5.4 規約 (18) への注記を原稿 6 として起こした。**

#### CHECK 節の内訳

**★★`pragma table_info` は CHECK 制約を返さない。⇒ `sqlite_master.sql` から `CHECK(...)` 節だけを括弧の対応で切り出し、コメントと空白を潰して比較した。**

**⇒ `sqlite_master.sql` から `CHECK(...)` 節だけを括弧の対応で切り出し、コメントと空白を潰して比較した。**

| # | 表 | 対象列 |
|---|---|---|
| 1 | `combos` | `baseline_version`（`GLOB` ＋ 月 1〜12 ／ 日 1〜31） |
| 2 | `combos` | `start_position_mass`（`BETWEEN 0 AND 160`） |
| 3 | `combos` | `carry_distance_mass`（`BETWEEN 0 AND 160`） |
| 4 | `games` | `current_data_version` |
| 5 | `moves` | `last_changed_game_version` |

**★★これらは本サブが足した面である。⇒ 指示書の 4 面には入っていないが、`S01` を手書きにした以上、見ないと穴になる。**

### 4.5 整合性

| 項目 | 旧 | 新 |
|---|---|---|
| `pragma foreign_key_check` | 0 件 | **0 件** |
| `pragma integrity_check` | `ok` | **`ok`** |

### 4.6 ★★★合わせ込みをしていないことの記録（チェックリスト A-5）

**★★比較は 1 度目の実行で 4 面とも一致した。⇒ 「一致するまで直した」経緯が存在しない。**

| 手順 | 何をしたか | 結果 |
|---|---|---|
| 1 | `S01` を手書きし、**S01 だけを空 DB へ適用**して正規化スキーマを比較 | **1 度目で `92e924e8…` に一致**（差分 0 行） |
| 2 | 生成器で `000002`〜`000009` を書き出し、9 本を適用して 4 面比較（適用器経由） | **1 度目で 4 面とも一致** |
| 3 | `migrations/` を置き換え、**本番経路**で新 baseline を構築して 4 面比較 | **1 度目で 4 面とも一致** |

**★手順 1 の「S01 だけで一致した」が最も意味のある 1 行である。⇒ 手書きの DDL が、115 本の `ALTER` が積み上げた構造と構造的に同一であった。**

---

## 5. 段 4 — 破壊確認 4 件（**比較が生きている証拠**・指示書 §5-4 / §5-5 ＋ レビュー 中-4 / 中-3）

### 5.1 §5-4 — 9 群の 1 本から 1 行を落とすと比較が落ちる

| 項目 | 内容 |
|---|---|
| 落とした場所 | `migrations/000005_data_seed_move_commands.up.sql` の先頭データ行 **`(288, 9, 'LP'),`** |
| **なぜ `move_commands` を選んだか** | **★他の表から参照されず AUTOINCREMENT も持たない。⇒ 面 2 と面 4 だけが落ち、面 1 / 面 3 は緑のままになる。⇒ 「どの面が生きているか」を分離して示せる** |
| 構築 | **本番経路**（`go run ./cmd/tacpendium` → `scratch-m33-02-broken.db`。`version=9` / `dirty=0`） |

```
$ python3 compare.py scratch-m33-02-old.db scratch-m33-02-broken.db ; echo EXIT=$?
面1 正規化スキーマ  => 一致
  move_commands   1634   1633   493715f3a7ac/87e374c9aee0  ★不一致
     ★行数が違う: 旧 1634 / 新 1633
  => 件数 ★不一致 / 全行 ★不一致
面3 sqlite_sequence => 一致
★★判定: 不一致あり -> 面2 全行(move_commands)
EXIT=1
```

**⇒ 比較は落ちた。★しかも落ちたのは面 2 / 面 4 だけであり、面 1 / 面 3 は緑のままである。⇒ 面が独立に効いている。**

**復元**＝生成器の出力から当該ファイルを戻し、`git status --porcelain -- migrations/` が **0 行**、再比較が **4 面一致 / EXIT=0** に戻ることを確認した。

### 5.2 §5-5 — 層 A の 1 本に `_data_` を付けると層 B へ解決する

| 項目 | 内容 |
|---|---|
| 改名 | `000009_seed_initial_users_tags.up.sql` → **`000009_data_seed_initial_users_tags.up.sql`** |

```
$ bash scripts/check-migration-license.sh --list | grep 000009
  B      凍結       CC-BY-SA-4.0         000009_data_seed_initial_users_tags.up.sql
  A      凍結       AGPL-3.0-or-later    000009_seed_initial_users_tags.down.sql

$ bash scripts/check-migration-license.sh > out.txt 2>&1 ; echo EXIT=$?
EXIT=1
NG  凍結表と食い違う: migrations/000009_data_seed_initial_users_tags.up.sql は層 A のはずだが層 B(CC-BY-SA-4.0)に解決した
```

**⇒ `_data_` を付けた瞬間に `CC-BY-SA-4.0`（層 B）へ解決した。★指示書 §4.2 が言う向きそのものである。**

**★★★ただし「検査が赤になった」を過大に読まないこと。** 赤になったのは**規則 (3)**（凍結表と食い違う）であり、**規則 (4) ではない。⇒ `000009` が凍結表に在るからである。**

#### 5.2.1 ★★★残る死角を実測した（**指示書 §4.2 の警告は今も生きている**）

**凍結表に無い*新しい*連番なら、規則 (3) は当たらず、規則 (4) は「`_data_` を持つなら層 B」しか見ない。**

```
# 一時ファイル 000010_data_seed_probe_users.up.sql を置いた(内容は INSERT INTO users のみ)
$ bash scripts/check-migration-license.sh > probe.txt 2>&1 ; echo EXIT=$?
EXIT=0
結果: 違反なし
$ bash scripts/check-migration-license.sh --list | grep 000010
  B      新規       CC-BY-SA-4.0         000010_data_seed_probe_users.up.sql
```

**⇒ `users`（層 A の表）へ書くファイルが `CC-BY-SA-4.0` へ解決し、検査は*緑*であった。**
**★★★機械検査は「どの表へ書くか」を、`_data_` を持つ側では見ない。⇒ 指示書 §4.2 の警告は是正後も有効である。**
**⇒ 一時ファイルは削除し、検査が緑（EXIT=0）へ戻ることを確認した。**

**★この死角は `M33-03`（ガード）へ回す。⇒ §11 の §J 行 原稿 1。**

### 5.3 ★★【レビュー 中-4 の是正】面 1 を狙った破壊確認（**★唯一トートロジーでない面の生存確認**）

> **★初版の破壊確認 2 件は、面 2 / 面 4**（ほぼトートロジー）**と命名規約しか狙っていなかった。⇒ 面 1 が生きていることを 1 度も確かめていなかった。**

**`S01` の構造を 1 か所ずつ壊して、面 1 が赤くなるか / 緑のままかを実測した**（適用器経由。**★面 1 はスキーマだけを見るため、適用器がアプリ経路と等価であることは §1.7 で裏取り済み**）**。**

| # | 壊し方 | 期待 | **実測** |
|---|---|---|---|
| **(a)** | **索引 `idx_combos_deleted_at` を 1 本落とす** | 面 1 が赤 | **EXIT=1。「面1 正規化スキーマ => ★不一致」。★他の面は緑のまま。⇒ 面 1 は生きている** |
| **(b)** | **`setups.id` から `AUTOINCREMENT` を 1 語外す** | **★緑のまま**（死角） | **EXIT=0。「判定: 4 面すべて一致（＋補助 CHECK 節も一致）」。⇒ §4.4 の死角を実証した** |

**⇒ 破壊確認は合計 4 件になった**〔§5.1 行落とし ／ §5.2 `_data_` 付与 ／ §5.3 (a) 索引落とし ／ §5.3 (b) `AUTOINCREMENT` 外し〕**。**

**★いずれもスクラッチへ複製した `migrations/` の写しで行った。⇒ リポジトリの `migrations/` は壊していない**（§5.1 の行落としのみリポジトリ上で行い、復元と再検証を済ませてある）**。**

---

## 6. ライセンスの層（指示書 §4.2 ／ チェックリスト 束 B）

### 6.1 ★★★是正前に起きていたこと（**開発者裁定の根拠・実測**）

**置き換え直後の `check-migration-license.sh` は違反 97 件で赤であった。⇒ 内訳は 2 種類である。**

| 種別 | 件数 | 内容 |
|---|---|---|
| **凍結表に在るがファイルが無い** | **93** | 旧 102 番号のうち現存するのは 9 本ぶんだけになったため |
| **凍結表と食い違う** | **4** | `000005`（S04・層 B 意図）と `000008`（S06b・層 B 意図）が凍結表では層 A |

**★★★そして、違反として*出なかった*ものが 1 件ある。⇒ こちらが重い。**

```
$ bash scripts/check-migration-license.sh --list | grep 000009     # 是正前
  B      凍結       CC-BY-SA-4.0         000009_seed_initial_users_tags.down.sql
  B      凍結       CC-BY-SA-4.0         000009_seed_initial_users_tags.up.sql
```

**⇒ `users` / `tags`**（層 A であるべき。`GAME_TABLES` に無い）**が `CC-BY-SA-4.0` へ解決していた。しかも違反 0 件で通っていた。**

**機序は 2 つの重なりである。**

| # | 機序 |
|---|---|
| **1** | **`REUSE.toml` の連番グロブ `migrations/000009_*.sql` が、命名規約 `migrations/*_data_*.sql` より*後ろ*に在る。⇒ REUSE 3.3 は「同一ファイル内では最後に一致した表だけを使う」。⇒ 命名規約を上書きする** |
| **2** | **`check-migration-license.sh` の旧凍結表も `000009` を層 B としていた。⇒ 規則 (3) が黙る** |

**★★9 連番のどの並べ替えでも解消しない。** 旧凍結表の `000001`〜`000009` の層は `A,A,B,B,A,B,A,A,B`（A 枠 5 / B 枠 4）であるのに対し、必要なのは **A 群 4 / B 群 5** である。**⇒ 枠が合わない。**

**★★一度 `CC-BY-SA` で配ったものを `AGPL` へ戻すのは、第三者が利用した後は取り消せない。**

### 6.2 是正（**★開発者裁定 2026-09-19。本サブの射程へ含めた**）

**★製造の独断ではない。** `REUSE.toml` は outbound ライセンスの正本であり、`roles-and-routing` のハード列（公開に関わる）に当たるため、**着手前に照会して裁定を得た**。

| ファイル | 変更 |
|---|---|
| `REUSE.toml` | **72 連番グロブの表 (4) を撤去**。⇒ (3) の命名規約だけが `migrations/` を支配する形へ戻す。**★同ファイル自身のコメント「次の seed 波が何本足しても、この宣言は触らなくてよい」が本来想定していた姿である。★層の割当そのものは 1 つも変えていない。★既定の層 A と `*_data_*` → 層 B の 2 表は 1 文字も変えていない** |
| `scripts/check-migration-license.sh` | **`FROZEN_A` / `FROZEN_B` を新系列 9 番号へ差し替え**〔`FROZEN_A` = `000001 000002 000007 000009` ／ `FROZEN_B` = `000003 000004 000005 000006 000008`〕**。★規則 (1)〜(4) のロジックは 1 行も変えていない** |

**★`CLAUDE.md` §6 の禁止ライセンス列には一切触れていない。** 本変更は既存マイグレの層の据置きを新系列へ移すだけであり、どの依存の許容範囲も変えない。

### 6.3 是正後の実測

```bash
$ bash scripts/check-migration-license.sh --self-test        # 11 対照
OK  陰性対照(素の状態) → 緑
OK  陽性対照(`_data_` 無し・INSERT INTO) → 赤
OK  陽性対照(`_data_` 無し・INSERT OR IGNORE INTO) → 赤
OK  陽性対照(`_data_` 無し・INSERT OR REPLACE INTO) → 赤
OK  陽性対照(`_data_` 無し・REPLACE INTO) → 赤
OK  陽性対照(`_data_` 無し・スキーマ修飾つき) → 赤
OK  陽性対照(`_data_` 無し・UPDATE) → 赤
OK  陽性対照(migrations/ の下位ディレクトリに .sql) → 赤
OK  陽性対照(凍結表と宣言のずれ) → 赤
OK  陽性対照(凍結表に在るがファイルが無い) → 赤
OK  陰性対照(命名規約どおりの新規層 B) → 緑
自己検査: 合格(陽性は赤・陰性は緑)                            # EXIT=0

$ bash scripts/check-migration-license.sh > lic-after.txt 2>&1 ; echo EXIT=$?
EXIT=0
凍結表: 層 A 4 本 / 層 B 5 本
結果: 違反なし
```

**`--list` の 18 行（全数）:**

| 層 | ライセンス | ファイル |
|---|---|---|
| **A** | `AGPL-3.0-or-later` | `000001_init_schema.down.sql` / `000001_init_schema.up.sql` |
| **A** | `AGPL-3.0-or-later` | `000002_seed_games.down.sql` / `000002_seed_games.up.sql` |
| **B** | `CC-BY-SA-4.0` | `000003_data_seed_characters.down.sql` / `000003_data_seed_characters.up.sql` |
| **B** | `CC-BY-SA-4.0` | `000004_data_seed_moves.down.sql` / `000004_data_seed_moves.up.sql` |
| **B** | `CC-BY-SA-4.0` | `000005_data_seed_move_commands.down.sql` / `000005_data_seed_move_commands.up.sql` |
| **B** | `CC-BY-SA-4.0` | `000006_data_seed_move_derivations.down.sql` / `000006_data_seed_move_derivations.up.sql` |
| **A** | `AGPL-3.0-or-later` | `000007_seed_presets.down.sql` / `000007_seed_presets.up.sql` |
| **B** | `CC-BY-SA-4.0` | `000008_data_seed_preset_aliases.down.sql` / `000008_data_seed_preset_aliases.up.sql` |
| **A** | `AGPL-3.0-or-later` | `000009_seed_initial_users_tags.down.sql` / `000009_seed_initial_users_tags.up.sql` |

### 6.4 ★★緑を根拠にしていない — **表ごとの割当を目で確かめた**（チェックリスト B-4）

**`GAME_TABLES` は 6 表だけである**（`characters` / `moves` / `move_commands` / `move_derivations` / `preset_aliases` / `custom_states`）**。⇒ `games` / `presets` / `users` / `tags` は入らない。⇒ 層 A である。**

| ファイル | 名に `_data_` | 書く表（`INSERT`/`UPDATE`/`DELETE`） | `GAME_TABLES` との積 | 意図する層 | 判定 |
|---|---|---|---|---|---|
| `000001_init_schema.up.sql` | 無 | `sqlite_sequence`（＋正規表現の偽陽性 `cascade`） | **空** | A | 整合 |
| `000001_init_schema.down.sql` | 無 | 無し（DDL のみ） | **空** | A | 整合 |
| `000002_seed_games.{up,down}.sql` | 無 | `games` | **空** | A | 整合 |
| `000003_data_seed_characters.{up,down}.sql` | 有 | `characters`（＋down は `sqlite_sequence`） | `characters` | B | 整合 |
| `000004_data_seed_moves.{up,down}.sql` | 有 | `moves`（＋down は `sqlite_sequence`） | `moves` | B | 整合 |
| `000005_data_seed_move_commands.{up,down}.sql` | 有 | `move_commands` | `move_commands` | B | 整合 |
| `000006_data_seed_move_derivations.{up,down}.sql` | 有 | `move_derivations` | `move_derivations` | B | 整合 |
| `000007_seed_presets.{up,down}.sql` | 無 | `presets`（＋down は `sqlite_sequence`） | **空** | A | 整合 |
| `000008_data_seed_preset_aliases.{up,down}.sql` | 有 | `preset_aliases`（＋down は `sqlite_sequence`） | `preset_aliases` | B | 整合 |
| `000009_seed_initial_users_tags.{up,down}.sql` | 無 | `users` / `tags`（＋down は `sqlite_sequence`） | **空** | A | 整合 |

**⇒ 層 A の 8 ファイルはすべて `GAME_TABLES` との積が空である。層 B の 10 ファイルはすべて自分の表だけへ書いている。**

> **★副産物: 検査の正規表現に偽陽性が 1 つ在る。** `UPDATE(?:\s+OR\s+\w+)?\s+(表名)` が **`ON UPDATE CASCADE` の `CASCADE` を表名として拾う**（`000001` で実測）。**⇒ 害は無い**（`cascade` は `GAME_TABLES` に無く、偽陽性は余分な違反しか生まない＝見落としは生まない）**が、`M33-03` へ申し送る**（§11 原稿 2）。

---

## 7. 段 5 — テストと検査

### 7.1 ★★★`go test ./...`（**★パイプ越しに合否を判定していない**）

```bash
$ go test ./... > gotest.txt 2>&1 ; echo "EXIT=$?"
EXIT=1
$ grep -cE "^--- FAIL" gotest.txt      # -> 158
$ grep -cE "^ok "      gotest.txt      # ->  58
$ grep -cE "^FAIL"     gotest.txt      # ->   5   (パッケージ行 2 ＋ 出力中の裸 FAIL 3)
$ grep -cE "^\?"       gotest.txt      # ->   9
$ go list ./... | wc -l                # ->  69
$ wc -l < gotest.txt                   # -> 605   (★全量。head / tail を通していない)
```

| 項目 | 値 | 種別 |
|---|---|---|
| 総パッケージ | **69** | 実測 |
| `ok` | **58** | 実測 |
| `no test files` | **9** | 実測 |
| **`FAIL` したパッケージ** | **2** | 実測 |
| 検算 | `58 + 9 + 2 = 69` | 算出・**一致** |
| 個別テストの失敗 | **158** | 実測 |

**★★「緑」とは書けない。⇒ 赤である。落ちたものを全数列挙する（指示書 §5-8 ／ チェックリスト F-2）。**

#### 落ちた 2 パッケージ（全数）

```
FAIL	github.com/plexiblinp/tacpendium/internal/infra/migration	6.898s
FAIL	github.com/plexiblinp/tacpendium/internal/seedgen	0.702s
```

| パッケージ | 個別失敗 | 原因 |
|---|---|---|
| **`internal/infra/migration`** | **141** | **`no migration found for version N`**（142 箇所）。★版数を直書きして歴史時点へ移動する契約テスト群 |
| **`internal/seedgen`** | **17** | **`file does not exist` / `がコミット済みと不一致`**（17 箇所）。★`os.ReadFile(migrations/NNNNNN_*.sql)` で旧 SQL を byte 比較する golden 群 |

**★個別に取り直した件数**（`go test ./internal/infra/migration/` ＝ 141 ／ `go test ./internal/seedgen/` ＝ 17）**。⇒ 合計 158 で全数に一致する。**

#### `internal/seedgen` の失敗 17 本（**全数**）

`TestGolden_CommittedMigrationMatchesRegeneration` ／ `TestGolden_DerivedBackfillMatchesRegeneration` ／ `TestGolden_FourthWaveDerivedBackfillMatchesRegeneration` ／ `TestGolden_FourthWaveMoveCommandsMatchesRegeneration` ／ `TestGolden_FourthWaveMovesMatchesRegeneration` ／ `TestGolden_FourthWaveNumericAliasesMatchesRegeneration` ／ `TestGolden_FourthWaveSRKAliasesMatchesRegeneration` ／ `TestGolden_M2002NumericAliasesMatchesRegeneration` ／ `TestGolden_M2002SRKAliasesMatchesRegeneration` ／ `TestGolden_ManonDerivedBackfillMatchesRegeneration` ／ `TestGolden_ManonMoveCommandsMatchesRegeneration` ／ `TestGolden_ManonMovesMatchesRegeneration` ／ `TestGolden_MoveCommandsMatchesRegeneration` ／ `TestGolden_RyuMigrationMatchesRegeneration` ／ `TestGolden_ThirdWaveDerivedBackfillMatchesRegeneration` ／ `TestGolden_ThirdWaveMoveCommandsMatchesRegeneration` ／ `TestGolden_ThirdWaveMovesMatchesRegeneration`

**⇒ 17 本ちょうどであり、`M33-01` §3.2 が実測した「byte 比較される 17 stem」と 1 対 1 で対応する。**

#### `internal/infra/migration` の失敗 141 本

**★全数は `docs/progress/` には置かない**（1 ファイルに 141 行の列挙は横断インデックスにならない）**が、機械的に再現できる形を残す。**

```bash
go test ./internal/infra/migration/ 2>&1 | grep -E "^--- FAIL" | sed -E 's/^--- FAIL: ([^ ]+).*/\1/' | sort
#   -> 141 行
```

**接頭辞での内訳**＝`TestRun_M1403b/c/d/e/f_*` ／ `TestRun_M17xx`〜`TestRun_M27xx` ／ `TestM1905_*` ／ `TestRun_*DownRollback` ／ `TestRun_Migration0000NN_*` ／ `TestRun_M3007_OldGoldenCohortReachesHead` ほか。**★いずれも `m.Migrate(<裸の整数>)` / `Steps(<負の整数>)` / 名前付き定数で歴史時点へ移動するものである**（`M33-01` §3.1＝135 箇所 / 18 ファイル）。

#### ★★★緑のまま残ったもの（**これが実質的な同一性の傍証である**）

| テスト | 何を見るか | 結果 |
|---|---|---|
| **`TestRun_SeedRowCounts`** | **seed 行数**（`characters == 31` 等） | **PASS** |
| **`TestRun_AllTablesExist`** | 21 表の存在 | **PASS** |
| **`TestRun_FirstAndIdempotent`** | 初回適用と再適用 | **PASS** |
| **`TestRun_HEAD_NoDanglingForeignKeys`** | HEAD で宙ぶらりん FK が無いこと | **PASS** |
| **`TestCSVAndDBAgreeOnFrameCostColumns`** | `character_data/*.csv` と DB の同期 | **PASS** |
| `TestRun_CreatesMissingParentDir` / `TestTemplate_DisabledInThisPackage` | — | **PASS** |
| **`internal/repository/*` / `internal/service/*` / `internal/api/*` の全パッケージ** | **`dbtest` 経由で新系列を適用した DB に対して走る** | **58 パッケージすべて PASS** |

**★★★ここが重要である。** `dbtest` は `migration.Run()` で新系列を適用したテンプレート DB を作り、リポジトリ層・サービス層・ハンドラ層の全テストがその上で走る。**⇒ 58 パッケージが緑であることは、seed の中身**（行数・ID・値）**が旧と同じであることの、比較スクリプトとは*独立した*傍証である。⇒ ここはトートロジーではない。**

**★これらの移設・修復は `M33-03` の射程である**（指示書 §3-2 / §3-3）**。本サブでは 1 行も直していない。**

### 7.1b ★★E2E 全数（**★指示書 §5 の要求外。開発者の指示で追加実行した**）

> **★出所＝2026-09-19 の開発者指示。** 指示書 §5 は E2E を求めていないが、**`SUPP-001` §5.5.7 (i) の先例**（`M31-04` の `000109` が E2E 3 本を赤にしたまま `main` へ着地し、3 サブあとに初めて見えた）**があるため回した。**

```bash
$ make e2e > e2e.txt 2>&1 ; echo "EXIT=$?" >> e2e.txt
$ tail -1 e2e.txt                  # -> EXIT=0
$ wc -l < e2e.txt                  # -> 472   (★全量。head / tail を通していない)
```

| 項目 | 値 | 種別 |
|---|---|---|
| spec ファイル | **81** | 実測 |
| 実行したテスト | **364**（`Running 364 tests using 1 worker`） | 実測 |
| **`passed`** | **362** | 実測 |
| **`flaky`** | **2**（★retry #1 で通った） | 実測 |
| **`failed`** | **0** | 実測 |
| 所要 | 5.9 分 | 実測 |
| **EXIT** | **0** | 実測 |

**⇒ 新系列の上で E2E は緑である。★`make e2e` を使った**（`pnpm exec playwright test` を直接叩いていない＝`CLAUDE.md` §11 / `D-599`）**。**

#### ★flaky 2 件は本サブに起因しない（**根拠を置く**）

```
[chromium] › e2e/m31-02-tag-field-drag.spec.ts:49:5 › M31-02 追補: タグ欄で始めたドラッグの文字選択
  › 右へ枠外までドラッグしても文字選択が消えない
  › 下へ枠外までドラッグしても文字選択が消えない
```

| # | 根拠（実測） |
|---|---|
| 1 | **当該 spec は seed データへ 1 度も触れない**——`grep -nE "migration\|seed\|character\|moves\|preset\|000[0-9]{3}" web/e2e/m31-02-tag-field-drag.spec.ts` が **0 件**。**⇒ 自分で `createTags` したタグだけを使う** |
| 2 | **落ちた場所は `expectSelectionSurvivesDragOut`**（`web/e2e/support/drag-selection.ts:119`）**＝ポインタのドラッグと文字選択の維持を見るヘルパである。⇒ マイグレーションへ至る経路が無い** |
| 3 | **2 件とも retry #1 で通った。⇒ Playwright の再実行 1 回ぶんが既に済んでおり、`CLAUDE.md` の「再実行は 1 回まで」を追加で消費していない** |

**★「flake」を根本原因として扱っていない。⇒ 上の 3 点は「この変更に起因しない」ことの根拠であって、「たまたま落ちた」という説明ではない。**
**★旧系列との突き合わせ**（`b90df21` で同じ spec を回す）**は行っていない。⇒ EXIT=0 であり、判別を要する赤が 1 件も無かったためである。**

### 7.2 常設の機械検査

| # | 検査 | EXIT | 結果 |
|---|---|---|---|
| **1** | **`bash scripts/check-artifact-integrity.sh`**（**★1 本目に回した**） | **0** | **違反なし** |
| 2 | `bash scripts/check-migration-license.sh` | **0** | **違反なし**（§6.3） |
| 2b | `bash scripts/check-migration-license.sh --self-test` | **0** | **合格**（11 対照） |
| 3 | `bash scripts/check-stop-discipline.sh` | **0** | **違反なし** |
| **4** | **`bash scripts/check-doc-refs.sh`** | **1** | **★赤。dead reference 1 件**（下記） |
| **4b** | **`make e2e`**（★指示書の要求外・開発者指示） | **0** | **緑**（364 実行 / 362 passed / 2 flaky / **failed 0**）。詳細は §7.1b |
| 5 | `bash scripts/check-derived-docs.sh` | 0 | **⚠ 情報提供**。`code-facts.md` が **390 / 1058 件（37%）** 陳腐化疑い ／ `docs-map.md` が 91 / 1666 件（5%） |
| 6 | `bash scripts/check-doc-inventory.sh` | §7.3 | 完了報告を書いた後に回す |
| 7 | `bash scripts/check-progress-log-index.sh` | §7.3 | **★完了報告は本検査の*入力*である。⇒ 書いた後にもう一度回す**（`D-890`） |
| 8 | `bash scripts/check-md-emphasis.sh <本報告>` | §7.3 | 同上 |

```
$ bash scripts/check-doc-refs.sh ; echo EXIT=$?
NG  .claude/commands/precheck_seed_data.md → migrations/000072_m20_seed_aliases_numeric.up.sql (存在しない)
結果: dead reference 1 件
EXIT=1
```

**★この 1 件は本サブでは直さない。⇒ `M33-03`（ガードと資料の作り直し）の射程である**（`M33-overview` §5）**。⇒ §11 原稿 3 に残した。**

**★`code-facts.md` の 37% は「丸ごと無効」という意味ではない**（`CLAUDE.md` §8 の注記）**。⇒ 変わったのは `migrations/` の面である。★再生成は `M33-03` の射程**（同 §5 の逐語＝「`code-facts` の再生成まで」）**。**

### 7.3 ★★完了報告を書いた後に回す検査（`D-890`）

**⇒ 実測は §12.3 に置いた**（`check-md-emphasis` ／ `check-completion-report-md-emphasis` ／ `check-progress-log-index` ／ `check-doc-inventory` ／ `check-artifact-integrity` ／ `check-stop-discipline` の **6 種 7 本すべて EXIT=0**）**。**

---

## 8. 段 5 — `M33-03` へ渡す材料（指示書 §2.5 ／ チェックリスト F-4）

### 8.1 21 表の投入順（**9 群で実際に通した結果で更新**）

**`M33-01` §4.3 が算出したトポロジカル順は、9 群では次の形で実現された。**

| 群 | 投入する表 | 依存先（既に在ること） |
|---|---|---|
| `000001` S01 | （DDL のみ） | — |
| `000002` S02a | `games` | 無し |
| `000003` S02b | `characters` | `games` |
| `000004` S03 | `moves` | `characters` ／ `moves`（自己・2 パス） |
| `000005` S04 | `move_commands` | `moves` / `characters` |
| `000006` S05 | `move_derivations` | `moves` ×2 |
| `000007` S06a | `presets` | `users`（**★組込 3 件は `user_id IS NULL` のため不要**＝実測） |
| `000008` S06b | `preset_aliases` | `presets` / `moves` |
| `000009` S07 | `users` → `tags` | `characters`（`main_character_id`・NULL） ／ `tags` は同一ファイル内で `users` の後 |

**★★★群の順序は `S06a`（presets）が `S07`（users）より*前*である**（指示書 §7-1 の暫定案どおり）**。これはトポロジカル順と逆に見えるが、組込 3 プリセットが `user_id IS NULL` であるため FK は破れない。⇒ `foreign_key_check` 0 件で実証した。**
**★ただし `M33-03` が「利用者が足した presets」を運ぶときは `users` が先に要る。⇒ 移行手順では順序が変わる。**

**★複合 FK `combo_setup_results` → `combo_setups` は、どちらも 0 行のため 9 群では出番が無い。⇒ `S01` の `CREATE TABLE` の順序でだけ担保している**（`combo_setups` を先に作る）。

**★自己参照 3 本のうち、9 群で実際に解いたのは `moves.original_move_id` の 514 行だけである**（`combos` の 2 本は 0 行）**。⇒ 「NULL で入れてから UPDATE」の 2 パス。遅延制約は使っていない。**

### 8.2 `sqlite_sequence` の扱い（**9 群での as-built**）

| 表 | 再現の仕方 | 置き場 |
|---|---|---|
| `characters` / `moves` / `presets` / `preset_aliases` / `games` / `users` / `tags` | **id の明示投入**（`seq == max(id)` が全表で成立＝§1.8） | 各群 |
| **`combos` / `combo_oki_options`** | **`INSERT INTO sqlite_sequence (name, seq) VALUES (..., 0)` を明示** | **`000001`（S01）** |
| 他 12 表 | 行を作らない | — |

### 8.3 数えるための式

**★`M33-01` §4.5 の式（開発者が手元 DB で回すもの）はそのまま有効である。⇒ 本サブは開発者の DB に触れていない**（チェックリスト E-9）**。**

**★本サブが足した式は §10 に置いた**（正規化ハッシュ ／ 適用器 ／ 生成器 ／ 比較器 ／ CHECK 節抽出）**。**

### 8.4 決めなかったこと

**`users` / `tags` の「seed 由来と利用者由来を分ける述語」は決めていない**（指示書 §3-5 ／ チェックリスト E-5）**。⇒ `followup` の `m33-users-tags-seed-vs-user-predicate-undefined` のまま、`M33-03` の入力である。**

**★本サブで 1 つ材料が増えた**＝`users.created_at` は `DEFAULT (datetime('now'))` 由来であり、**seed 行と利用者行を時刻で見分けることはできない**（seed 行の `created_at` は DB 構築時刻であって「古い」とは限らない）。**⇒ 述語の候補から時刻は外れる。**

---

## 9. 越境していないことの確認（チェックリスト 束 E）

| # | 観点 | 結果 |
|---|---|---|
| **E-1** | **並列 0 本で走ったか** | **開発者回答を得た**（§1.2）。**★製造の側から実測できない事実であることも書いた** |
| **E-2** | **凍結点からの増分を数え、対応表へ追記したか** | **した**（§1.3 / §1.4）。**★増分は 0 ではない。新規 4 本 ＋ 既存 6 本の書き換え** |
| **E-3** | **`migrations/legacy/` を作っていないか ／ 歴史テストを移していないか** | **どちらもしていない**。`migrations/` は直下 18 ファイルのみ（`find migrations -mindepth 2` が空）。`internal/` の差分 **0 行** |
| **E-4** | **golden / seedgen / CSV 同期テストに手を出していないか** | **出していない**。`internal/seedgen/` と `cmd/seedgen/` の差分 **0 行** |
| **E-5** | **`users` / `tags` の分け方を決めていないか** | **決めていない**（§8.4） |
| **E-6** | **設計書本体を書き換えていないか** | **書き換えていない**。`docs/design/` の差分 **0 行** |
| **E-7** | **`docs/handover/followup-backlog.md` を 1 文字も編集していないか** | **1 文字も触っていない**（`D-838`）。⇒ §11 に §J 行の原稿を置いた |
| **E-8** | **着手前の版ゲート 6 点を通したか** | **6 点とも通過**（§1.1） |
| **E-9** | **開発者の手元 DB に触れていないか** | **触れていない**。使ったのはリポジトリ直下の `scratch-m33-02-*.db`（`.gitignore` 済み） |

### 9.1 変更統計（`git diff --numstat b90df21`・**Phase A 完了時点**）

```
246 files changed, 13874 insertions(+), 31453 deletions(-)
```

| 区分 | ファイル | insertions | deletions |
|---|---|---|---|
| **`migrations/` 計** | **244** | **13829** | **31409** |
| ├ 削除（`D`・旧のみ） | 226 | 0 | （内数） |
| ├ 追加（`A`・新のみ） | 14 | （内数） | 0 |
| └ **改変（`M`・旧と同名の 4 本）** | **4** | （内数） | （内数） |
| `REUSE.toml` | 1 | **16** | **29** |
| `scripts/check-migration-license.sh` | 1 | **29** | **15** |
| **合計** | **246** | **13874** | **31453** |

**★検算**＝`244 + 1 + 1 = 246` ／ `13829 + 16 + 29 = 13874` ／ `31409 + 29 + 15 = 31453`。**総計と一致する。**

> **★★【レビュー 中-1 の是正】初版は `REUSE.toml` を 17/76、スクリプトを 28/16 と書いていた。⇒ 実測は 16/29 と 29/15 であり、内訳の合計が総計に合っていなかった。**
>
> **★★【レビュー 低-1 の補足】旧 230 ファイルと削除 226 の差 4 は、新系列が同じ stem を再利用した 4 ファイル**（`000001_init_schema.{up,down}.sql` / `000002_seed_games.{up,down}.sql`）**である。⇒ git はこれを `D`＋`A` ではなく `M` として数える。⇒ `226 + 14 + 4 = 244`。**

| 観点（教訓 `E-225`） | 判定 |
|---|---|
| **新規のつもりのファイルが `+` だけか** | **★本サブは該当しない。⇒ 意図的な*置き換え*である** |
| **同名の既存ファイルが無かったか** | **★★在った。4 ファイル**（`000001_init_schema.{up,down}.sql` / `000002_seed_games.{up,down}.sql`）**。⇒ 作る前に確認し、意図どおりであることを確かめた**（下記） |
| 上書きではないことの担保 | **★旧 230 ファイルを `rm` で一括削除してから新 18 ファイルを置いた。⇒ 個別の上書きは起きていない。★旧内容は git 履歴（`b90df21`）とスクラッチの退避コピー 230 ファイルの両方に在る** |
| `internal/` / `docs/design/` / `web/` の差分 | **0 行** |

> **★★★`E-225` の同名確認が実際に火を噴いた。** 新系列は `000001_init_schema` と `000002_seed_games` という**旧系列と同じ stem を意図的に再利用する**。
> **⇒ 「新規のつもり」で `Write` していたら、旧 4 ファイルを黙って上書きしていた**（そして `git diff --numstat` にしか痕跡が残らなかった）。
> **★本サブは削除 → 配置の順にしたため上書きは起きていない。⇒ 確認しなければ区別が付かなかった。**

---

## 10. 使った式（**★使い捨てスクリプトの本体**・`M33-01` の 式6 と同じ扱い）

**★いずれもスクラッチ領域に置いた使い捨てであり、リポジトリには 1 本も置いていない。⇒ 本節が本体である。**

### 10.1 正規化ハッシュ（`M33-01` §5.2.1 の本体。**DB パスだけを引数化**）

```python
import sqlite3,hashlib,sys
c=sqlite3.connect('file:%s?mode=ro' % sys.argv[1],uri=True)
tables=[r[0] for r in c.execute(
  "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' "
  "AND name<>'schema_migrations' ORDER BY name")]
out=[]
for t in tables:
    out.append(f"TABLE {t}")
    for cid,name,typ,notnull,dflt,pk in c.execute(f'pragma table_info("{t}")'):
        out.append(f"  COL {name}|{typ}|notnull={notnull}|default={dflt}|pk={pk}")
    for row in sorted(c.execute(f'pragma foreign_key_list("{t}")'),
                      key=lambda r:(r[2],r[3] or '',r[4] or '')):
        _,_,tbl,fr,to,upd,dele,match=row
        out.append(f"  FK {fr}->{tbl}.{to}|on_update={upd}|on_delete={dele}")
    for _,iname,uniq,origin,partial in sorted(c.execute(f'pragma index_list("{t}")'),
                                              key=lambda r:r[1]):
        cols=",".join(r[2] for r in c.execute(f'pragma index_info("{iname}")'))
        out.append(f"  IDX {iname}|unique={uniq}|origin={origin}|partial={partial}|cols={cols}")
print("正規化スキーマ sha256 =",hashlib.sha256(("\n".join(out)+"\n").encode()).hexdigest())
print("行数 =",len(out),"表数 =",len(tables))
seq=[f"{n}|{s}" for n,s in sorted(c.execute('select name,seq from sqlite_sequence'))]
print("sqlite_sequence sha256 =",hashlib.sha256(("\n".join(seq)+"\n").encode()).hexdigest())
```

### 10.2 適用器（`golang-migrate` と同じ「ファイル全文を 1 回 Exec」）

```python
import sqlite3,sys,os
src,dst=sys.argv[1],sys.argv[2]
if os.path.exists(dst): os.remove(dst)
files=sorted(f for f in os.listdir(src) if f.endswith('.up.sql'))
c=sqlite3.connect(dst)
c.execute('PRAGMA foreign_keys=OFF')
last=0
for f in files:
    c.executescript(open(os.path.join(src,f),encoding='utf-8').read())
    last=int(f[:6])
c.execute('CREATE TABLE IF NOT EXISTS schema_migrations (version uint64,dirty bool)')
c.execute('DELETE FROM schema_migrations')
c.execute('INSERT INTO schema_migrations(version,dirty) VALUES(?,0)',(last,))
c.commit(); c.close()
```

**★この適用器は「アプリ経路と等価であること」を実測で裏取りしてある**（§1.7）**。⇒ 等価性を示さずに使っていない。**

### 10.3 生成器（`000002`〜`000009`）

**★本体は長いため要点のみを逐語で置く。全体はスクラッチの `gen_groups.py` に在り、本報告の §3 が方式を記述している。**

```python
BATCH = 200                      # 1 文あたりの VALUES 行数(上限回避)

def lit(v):                      # SQL リテラル化
    if v is None: return "NULL"
    if isinstance(v, bool): return "1" if v else "0"
    if isinstance(v, int): return str(v)
    if isinstance(v, float): return repr(v)
    if isinstance(v, bytes): return "X'" + v.hex() + "'"
    return "'" + v.replace("'", "''") + "'"

# 自己参照の 2 パス(moves.original_move_id)
i_orig = cols.index("original_move_id")
d_pass1 = [tuple(None if j == i_orig else v for j, v in enumerate(r)) for r in d]
selfref = [(r[i_id], r[i_orig]) for r in d if r[i_orig] is not None]     # -> 514 行
upd = "\n".join("UPDATE moves SET original_move_id = %d WHERE id = %d;" % (o, i)
                for i, o in selfref)

# users.created_at だけは値を写さない(§3.4)
uc_novol = [x for x in uc if x != "created_at"]
```

### 10.4 比較器（4 面 ＋ 補助）

**★面の取り方は §4.2 の各節に書いたとおり。要点は 3 つ。**

```python
VOLATILE = {("users", "created_at")}          # ★除外はこの 1 セルだけ。実行のたびに印字する

# 面2: PK 順に整列した行タプルを表ごとにハッシュ(不一致なら最初の差分行を出す)
pk = [r[1] for r in co.execute(f'pragma table_info("{t}")') if r[5]] or use
ro = list(co.execute(f'SELECT {sel} FROM "{t}" ORDER BY {order}'))

# 補助: CHECK 節は括弧の対応で切り出す(pragma に現れないため)
m = re.compile(r'\bCHECK\s*\(', re.I).search(body, i)
```

### 10.5 表ごとの行数・`max(id)`・`seq`

```python
seq=dict(c.execute('select name,seq from sqlite_sequence'))
for t in tables:
    n  = c.execute(f'select count(*) from "{t}"').fetchone()[0]
    pk = [r[1] for r in c.execute(f'pragma table_info("{t}")') if r[5]]
    mx = c.execute(f'select max(id) from "{t}"').fetchone()[0] if pk == ['id'] else None
    print(t, n, mx, seq.get(t))
```

---

## 11. 停止規律 — §J 行の原稿（`CLAUDE.md` §9 ／ `D-838`）

> **★★`docs/handover/followup-backlog.md` は 1 文字も編集していない**（E-7）**。⇒ 下記は「§J 行の原稿」であり、設計伝達レポート §4 へ移したうえで、設計卓が受理の手番で §J へ転記する。**

### 原稿 1

| フィールド | 内容 |
|---|---|
| **ID（スラッグ）** | `migration-license-check-blind-to-write-target-when-data-named` |
| **発生元** | `M33-02`（本報告 §5.2.1 / §6.4） ／ レビュー報告書 `docs/progress/m33-02-review.md` |
| **未解消の理由** | **`check-migration-license.sh` の規則 (4) は `_data_` を持つファイルについて「どの表へ書くか」を見ない。⇒ 凍結表に無い新しい連番で `users` へ書くファイルに `_data_` を付けると、`CC-BY-SA-4.0` へ解決したうえで検査が*緑*になる**（本サブが一時ファイル `000010_data_seed_probe_users.up.sql` で実測。EXIT=0）**。★凍結表の差し替えでは塞がらない。規則 (4) 側の変更が要る** |
| **★併記（レビュー 中-5）** | **本サブは新系列 9 本を*全数*凍結表へ入れた。⇒ 規則 (4) は凍結表に在る番号には当たらないため、現ツリーでは規則 (4) が 1 本も評価されない**（空回り）**。★これは意図した選択である**——規則 (3) のほうが強い（層の*値*を固定する）ためだが、**代償として「規則 (4) が壊れていても現ツリーでは気づけない」。⇒ `--self-test` の陽性対照 6 形が規則 (4) を守っている唯一の経路になった**（実測で 6 形とも赤を返すことは確認済み＝§6.3）**。★次のマイグレ `000010` 以降は凍結表に無いため規則 (4) が復活する** |
| **再開に必要な条件** | **`M33-03`（ガードの作り直し）で、規則 (4) の `has_data` 側にも「層 A の表**〔`games` / `presets` / `users` / `tags`〕**へ書いていないか」を足すかを判断すること。★あわせて「新系列 9 本を凍結表へ入れたままにするか、外して規則 (4) の判定へ委ねるか」も決めること。★副産物として `UPDATE ... CASCADE` の `CASCADE` を表名として拾う偽陽性も在る（害は無いが同時に見ると安い）** |
| **記録日・状態** | 2026-09-19 ／ **未着手** |

### 原稿 2

| フィールド | 内容 |
|---|---|
| **ID（スラッグ）** | `m33-02-history-and-golden-tests-red-until-m33-03` |
| **発生元** | `M33-02`（本報告 §7.1） |
| **未解消の理由** | **新系列へ置き換えた結果、`go test ./...` が 2 パッケージ・158 テストで赤である**〔`internal/infra/migration` 141 本＝版数直書きの歴史テスト ／ `internal/seedgen` 17 本＝旧 SQL を byte 比較する golden〕**。★指示書 §3-2 / §3-3 により本サブの射程外であり、移設は `M33-03` が行う。⇒ 現状のブランチは「9 群は正しいが、旧系列を前提にしたテストが残っている」状態である** |
| **再開に必要な条件** | **`M33-02` の比較が全一致したことを設計卓が受理し、`M33-03` を起票すること**（`M33-overview` §6.2 段 3）**。★`M33-03` の作業量の実測値＝歴史テスト 141 本 / golden 17 stem / dead reference 1 件 / `code-facts` 37% 陳腐化** |
| **記録日・状態** | 2026-09-19 ／ **未着手**（`M33-03` の入力） |

### 原稿 3

| フィールド | 内容 |
|---|---|
| **ID（スラッグ）** | `precheck-seed-data-command-dead-migration-reference` |
| **発生元** | `M33-02`（本報告 §7.2） |
| **未解消の理由** | **★`check-doc-refs.sh` の「dead reference 1 件」は氷山の一角である。** 同検査の走査対象は `CLAUDE.md` / `.claude/rules` / `.claude/commands`（ルール面のみ）であり、**本番ソースを見ない。⇒ 検出された 1 件**（`.claude/commands/precheck_seed_data.md:138` → `migrations/000072_m20_seed_aliases_numeric.up.sql`）**の外側に、`internal/` / `cmd/` の非テストコードだけで失効した連番参照が 65 箇所ある**（実測。式は下記）**。** **★★★このうち最も危険なのは「死んだ参照」ではなく「別のファイルを指す*生きた*参照」である**——**`migrations/000007` は旧系列では `seed_initial_tags_user1`、新系列では `seed_presets` である。⇒ 4 箇所が `users` / `tags` の出所として `000007` を挙げているが、新系列の `000007` は presets を入れる。★読んだ人は誤りに気づけない**〔`internal/model/tag.go:32` ／ `internal/api/middleware/user.go:30` ／ `internal/service/user/service.go:61` ／ 同 `:91`。**正しくは `000009_seed_initial_users_tags.up.sql`**〕**。** **★残る 61 箇所の多くは `internal/seedgen/` の約 35 箇所**（`M33-03` の射程そのもの）**と、旧系列の経緯を述べる歴史記述**（「マイグレ `000081` で既存データを移行」等。**★これは今も歴史として正しい**）**である。★`migrations/000001` を指す 2 箇所**（`internal/repository/tag/repository.go:196` ／ `internal/seedgen/model.go:63`）**は、新 `000001` も最終スキーマであるため偶然そのまま正しい。** |
| **★本サブで直さなかった理由** | **(1) 資料とテストの作り直しは `M33-03` の射程である**（`M33-overview` §5 ／ 指示書 §3-2 / §3-3）**。(2) 65 箇所のうち 4 箇所だけを直すと、ツリーが「一部だけ新系列を指す」状態になり、かえって読み手を惑わせる。(3) 本サブは採用が条件付きである**（比較が全一致しなければ旧系列のまま＝`M33-overview` §6.2 段 3）**——不採用なら 65 箇所とも今のままが正しい。⇒ まとめて `M33-03` で直すのが安い。★`internal/` の差分を 0 行に保つことで「本サブが変えたのは `migrations/` とライセンス・ガードだけ」を差分で示せるという利点もある** |
| **再開に必要な条件** | **`M33-03` で次を行うこと。(a) `.claude/commands/precheck_seed_data.md:138` を新系列（`000008_data_seed_preset_aliases.up.sql`）へ差し替えるか ALLOW へ入れる。(b) ★★`000007` を指す 4 箇所を `000009` へ是正する（最優先。生きた誤参照である）。(c) `internal/seedgen/` の約 35 箇所を golden の作り直しと同時に処理する。(d) 歴史記述はそのままでよいか判断する。★`check-doc-refs.sh` が本番ソースを見ないことそのものを広げるかも、あわせて判断する** |
| **数え方（実測）** | `grep -rnE "migrations/0000[0-9]{2}\|\b0000[0-9]{2}\b" --include='*.go' internal cmd \| grep -v "_test.go" \| wc -l` → **65**。★`head` / `tail` を通していない |
| **記録日・状態** | 2026-09-19 ／ **未着手** |

### 原稿 6

| フィールド | 内容 |
|---|---|
| **ID（スラッグ）** | `supp001-rule18-normalized-schema-blind-spots` |
| **発生元** | `M33-02`（本報告 §4.4 / §5.3） ／ レビュー報告書 `docs/progress/m33-02-review.md` 中-3 |
| **未解消の理由** | **`SUPP-001` §5.5.4 規約 (18) は「`pragma table_info` / `foreign_key_list` / `index_list` から構造だけを取って比較する」と定めるが、この取り方が*見ない*属性を挙げていない。⇒ 本サブが実測した死角は 9 種類**〔`AUTOINCREMENT` ／ `WITHOUT ROWID` ／ partial index の `WHERE` 述語 ／ 列の `COLLATE` ／ 生成列 ／ トリガ ／ ビュー ／ 索引の照合順 ／ `CHECK` 節〕**。** **★★とくに `AUTOINCREMENT` は実害が大きい**——**`setups.id` から 1 語外した DB は比較 4 面すべてが緑で通る**（実測）**。⇒ 「面 1 が緑なら構造は同じ」と読むと外れる。★製造は設計書を直接編集しない**（`CLAUDE.md` §8） |
| **再開に必要な条件** | **設計卓が規約 (18) へ「この取り方が見ない属性」の一覧と、別に取るべき旨を足すこと。★本サブは 9 種類とも実測して一致を確認しており**（§4.4）**、そのまま注記の素材になる** |
| **記録日・状態** | 2026-09-19 ／ **未着手** |

### 原稿 5

| フィールド | 内容 |
|---|---|
| **ID（スラッグ）** | `reuse-frozen-table-removal-invalidates-three-design-doc-lines` |
| **発生元** | `M33-02`（本報告 §6.2 / §13 項 4b / 4c） ／ レビュー報告書 `docs/progress/m33-02-review.md` 高-2 |
| **未解消の理由** | **本サブが `REUSE.toml` の連番グロブ表を撤去したことで、設計書の 3 か所が失効した。★製造は設計書を直接編集しない**（`CLAUDE.md` §8）**。⇒ 原稿として残すところまでが本サブの手番である。** **(1) `DES-001` §5.1 三層表・層 B の行**（`:241`）**＝「`migrations/*_data_*.sql` ／ 既存マイグレ 72 本（凍結・一度だけ列挙）」の後半が消えた。⇒ 層 B は命名規約だけで決まるようになった。** **(2) `SUPP-001` §2.7 ライセンス項 2**（`:371`）**＝「既存 102 本（層 A 30 / 層 B 72）は凍結・一度だけ列挙してある。★適用済みマイグレは書き換えないので、この列挙は以後変わらない」が丸ごと失効。** **(3) `SUPP-001` §2.7 の「`M33-02` が 111 本を*7 群前後*へ潰す」**（`:342`）**＝実際は 9 群であり、しかも既に潰した** |
| **再開に必要な条件** | **設計卓が 3 か所を as-built 化すること。★`M33-02` が採用された場合のみ**（不採用なら旧系列のままであり、3 か所とも今の記述が正しい）**。★あわせて `check-migration-license.sh:71` の「この表は以後変わらない」に本サブが足した例外の 1 行**（`M33` が唯一の例外である旨）**と整合を取ること** |
| **記録日・状態** | 2026-09-19 ／ **未着手** |

### 原稿 4

| フィールド | 内容 |
|---|---|
| **ID（スラッグ）** | `supp001-s27-migration-count-as-built-after-m33` |
| **発生元** | `M33-02`（本報告 §2） ／ `M33-01` の原稿 3 の継続 |
| **未解消の理由** | **`SUPP-001` §2.7 の現行記述は「`migrations/*.up.sql` は 111 本、`000001`〜`000112` のうち欠けるのは `000012` のみ」である**（`:336`。**★`CHANGE-194` / `M33-01` で 2026-09-13 に更新済み**）**。⇒ 本サブで「9 本 / `000001`〜`000009` / 欠番 0 件」へ変わる。★あわせて同節の「`M33-02` が 111 本を*7 群前後*へ潰す」**（`:342`）**も失効する——実際は 9 群であり、しかも既に潰した。★製造は設計書を直接編集しない**（`CLAUDE.md` §8）**。★命名規約とライセンスのブロック「層 B は `NNNNNN_data_*.sql`」はそのまま有効である** |
| **再開に必要な条件** | **設計卓が as-built 化すること。★`M33-02` が採用された場合のみ**（比較が全一致しなければ旧系列のままであり、書き換えてはいけない） |
| **記録日・状態** | 2026-09-19 ／ **未着手** |

---

## 12. レビューと取り込み（Phase B / Phase C）

| 項目 | 内容 |
|---|---|
| レビュー報告書 | **`docs/progress/m33-02-review.md`**（367 行・レビュー時 HEAD `1960328`） |
| 実施形態 | **fresh subagent**（メイン会話文脈を継承しない独立エージェント。**`fork` は使っていない**） |
| **指摘の件数** | **13 件（高 3 / 中 8 / 低 2）** |
| **「高」指摘の不採用** | **★★0 件。⇒ 13 件すべてを採用した**（不採用そのものが 0 件） |
| 再レビュー往復 | **0 回**（初回のみ。停止規律の上限 2 回に達していない） |
| チェックリスト §0 の不合格 4 条件 | **4 条件とも該当しない**（レビュー判定） |

> **★★レビュー担当は報告を読むだけで済ませず、自分で検査を回している**（`D-890`）**。⇒ `go test ./...` の全量計数・`check-migration-license.sh` 3 種・旧 DB の独立再構築・破壊確認 §5-4 の独立再現・層の割当の機械的再構成まで行い、完了報告の数値と 1 つも食い違わなかったことを確認している。**

### 12.1 トリアージ結果（**全 13 件・採否と理由**）

| # | 優先度 | 指摘 | 採否 | 対応 |
|---|---|---|---|---|
| **高-1** | 高 | **§11 原稿 4 / §13 項 4 が `SUPP-001` §2.7 を「102 本 / 〜`000103`」と引用しているが、それは `CHANGE-194` で既に是正された旧記述** | **採用** | **★製造の誤りである。** 実物（`:336`）を読み直し、現行が **「111 本 / `000001`〜`000112` / 欠番 `000012` の 1 件」** であることを確認。原稿 4 と §13 項 4 の起点を実物へ差し替え、**「102 本を起点にしないこと」を明記**した。**★あわせて同節 `:342` の「7 群前後へ潰す」も失効対象に加えた**（実際は 9 群であり、しかも既に潰した） |
| **高-2** | 高 | **`REUSE.toml` 表 (4) 撤去が失効させた設計書 3 か所が棚卸しに 1 件も無い** | **採用** | **★指摘のとおり、本サブ自身が壊した記述を自分で数えていなかった。** 3 か所を実物で確認（`DES-001:241` ／ `SUPP-001:371` ／ `SUPP-001:342`）し、**§11 原稿 5 を新設**、**§13 へ項 4b / 4c を追加**した |
| **高-3** | 高 | **「dead reference 1 件」は `check-doc-refs.sh` の対象 37 ファイル（ルール面のみ）の値。本番ソースには失効した連番参照が別勘定で在る。とくに `000007` を指す 4 か所は「死んだ参照」ではなく「別のファイルを指す*生きた*参照」** | **採用** | **★これが最も重い指摘である。** 自分で数え直し、**非テストの `internal/` / `cmd/` だけで 65 箇所**（実測。`head`/`tail` を通さず `wc -l`）**であることを確認。★`000007` の 4 箇所**〔`internal/model/tag.go:32` ／ `internal/api/middleware/user.go:30` ／ `internal/service/user/service.go:61` / `:91`〕**は新系列では `seed_presets` を指してしまう。★逆に `migrations/000001` を指す 2 箇所は偶然そのまま正しい**（新 `000001` も最終スキーマ）**ことも確認した。⇒ 原稿 3 を全面的に書き直した** |
| **★高-3 の直し方について** | — | — | **記録に留めた（指摘は全面採用）** | **★レビューの求めは「原稿へ書き足すこと」であり、コードの是正は求めていない。⇒ 求められたことは全部やった。** **★そのうえで「4 箇所だけ今すぐ直すか」を自分で検討し、直さない判断をした。理由 3 つを原稿 3 の専用欄へ書いた**〔(1) 資料とテストの作り直しは `M33-03` の射程 ／ (2) 65 箇所のうち 4 箇所だけ直すとツリーが中途半端になる ／ (3) 本サブは採用が条件付きであり、不採用なら 65 箇所とも今のままが正しい〕**。★`M33-03` での最優先項目として (b) に置いた** |
| **中-1** | 中 | §9.1 の numstat が実測と食い違い、内訳の合計が総計と合わない | **採用** | **★製造の誤りである。** 実測し直して **`REUSE.toml` 16/29 ／ スクリプト 29/15** へ是正。**表を「`migrations/` 計 → 内訳」の形へ組み替え、検算 3 本**（`244+1+1=246` ／ `13829+16+29=13874` ／ `31409+29+15=31453`）**を載せた** |
| **中-2** | 中 | `000002_seed_games.down.sql` だけ `sqlite_sequence` を掃除せず、down 往復で `games|1` が残る | **採用** | **★自分で再現してから直した**（down 後に `games|1` が残ることを実測）。`DELETE FROM sqlite_sequence WHERE name = 'games';` を追加。**★9 本の down を逆順に全部流すと残存表が 0 になることも実測**。**★up 側は触っていないため比較 4 面は緑のまま**（再確認済み） |
| **中-3** | 中 | **正規化ハッシュの死角は CHECK だけではない**（`AUTOINCREMENT` を外しても 4 面が緑） | **採用** | **★指摘の実験を自分で再現した**（`setups.id` から `AUTOINCREMENT` を外す → EXIT=0・全面緑）。**§4.4 を「面 1 が見ない属性の全数」へ書き換え、9 種類を旧新で突き合わせて全項目一致を実測**（`AUTOINCREMENT` 16/16 ／ partial index の述語 ／ 照合順 ほか）。**§11 原稿 6 を新設**（規約 (18) への注記） |
| **中-4** | 中 | 破壊確認が面 1 を狙っておらず、唯一トートロジーでない面の生存が未実証 | **採用** | **§5.3 を新設。** 索引を 1 本落とすと **面 1 だけが赤**（EXIT=1）になることを実測。**⇒ 破壊確認は 4 件になった** |
| **中-5** | 中 | 9 本全数を凍結表へ入れたため規則 (4) が現ツリーで空回りする | **採用** | **原稿 1 へ「★併記」欄を追加。** 空回りが意図した選択であること、代償として `--self-test` の陽性対照 6 形が規則 (4) を守る唯一の経路になったこと、`000010` 以降で復活することを書いた |
| **中-6** | 中 | `check-migration-license.sh:71` の「この表は以後変わらない」へ例外の 1 行を足す | **採用** | **コメント 3 行を追加**（`M33` が唯一の例外である旨・通常の改番では動かさないこと・`D-535` は生きていること）。**★本検査と `--self-test` が緑のままであることを再確認**（EXIT=0 / 0） |
| **中-7** | 中 | Phase D で `progress-log.md` の索引行を追記し `check-progress-log-index.sh` を緑へ戻す | **採用** | **Phase D で実施**。結果は §12.3 |
| **中-8** | 中 | §3.2 のトートロジー判定を「行を持つ 9 表 / 行 0 の 12 表」で分けて書く | **採用** | **★指摘のとおり、行 0 の 12 表については面 2 は「トートロジーですらない」**（書き出す行が無いため、`S01` が表を作っただけで成立する）**。⇒ 表を 2 行に分け、12 表について面 2 が主張しているのは「余計な行が入っていない」だけであることを明記** |
| **低-1** | 低 | §9.1 の 230 と 226 の関係を 1 語で補う | **採用** | **差 4 は新系列が同じ stem を再利用した 4 ファイルであり、git が `M` として数えるためであることを明記**（`226 + 14 + 4 = 244`） |
| **低-2** | 低 | `writes_game_table()` の `CASCADE` 偽陽性 | **採用**（追加対応不要） | **レビュー自身が「既に原稿 1 へ申し送り済み。追加対応は不要」と判定している。⇒ 原稿 1 に在ることを再確認した** |

### 12.2 ★★不採用は 0 件である

**★「高」の不採用が 0 件であるだけでなく、13 件すべてを採用した。⇒ 開発者へのエスカレーションは発生していない**（Phase C 安全弁は作動せず）**。**

**★★このうち 高-1 / 中-1 は、製造が「実測」と書いた数が再現しなかったものである**（`SUPP-001` の引用 ／ numstat の内訳）**。⇒ 本サブの評価軸そのもの**（成果は数である）**に触れる誤りであり、機序を本文へ残した。**

**★★★高-2 は性質が違う**——**本サブ自身が `REUSE.toml` を変えて失効させた記述を、自分で数えていなかった。⇒ 「自分が壊したものを棚卸しに載せる」が落ちていた。★`CLAUDE.md` §8 の「併せて更新が要るもの」は、他人の記述だけでなく自分が壊した記述も対象である。**

### 12.3 完了報告を書いた後に回した検査（`D-890`）

**★★完了報告と索引行は、これらの検査の*入力*である。⇒ 書き終えた後にもう一度回した。**

| 検査 | EXIT | 結果 |
|---|---|---|
| `bash scripts/check-md-emphasis.sh docs/progress/M33-02-completion-report.md` | **0** | **検出 0 行** |
| `bash scripts/check-md-emphasis.sh docs/progress/m33-02-review.md` | **0** | **検出 0 行**（★この手番で新規に作られた 2 ファイルとも自分で見た） |
| `bash scripts/check-completion-report-md-emphasis.sh` | **0** | **違反なし**（手順が消えていないことの検査） |
| **`bash scripts/check-progress-log-index.sh`** | **0** | **違反なし**（**117 件すべてが `progress-log` に現れる**。★Phase D の索引行追記*後*の値である。★追記前は違反 1 件であった） |
| `bash scripts/check-doc-inventory.sh` | **0** | **型に無いファイルなし**（型 18 件 / 既知の例外 30 件） |
| `bash scripts/check-artifact-integrity.sh`（再） | **0** | **違反なし** |
| `bash scripts/check-stop-discipline.sh`（再） | **0** | **違反なし** |

**★フェンス内のコード引用による偽陽性は 0 件であった。⇒ 直せない行の申し送りは無い。**

## 13. ■ 併せて更新が要るもの

| # | 対象 | 要否 |
|---|---|---|
| 1 | **CHANGE 番号の登録**（`change-number-registry.md` §1） | **不要**。**CHANGE 消費 0 本・自採番なし**（`D-293`） |
| 2 | **マイグレ連番** | **★★要注意だが、製造の手番ではない**。**新系列は既存の連番体系の外**（指示書 §0.2）**であり、ボード §2.2 の「次に払い出す番号」は旧系列の体系を指している。⇒ `M33-02` が採用された場合、次に払い出す番号は `000010` になる。★採用の判断は設計卓であり、ボードの更新も設計卓の手番** |
| 3 | **版を上げた文書の参照元** | **不要**。設計書を 1 つも改版していない |
| 4 | **`SUPP-001` §2.7 の as-built 化** | **要**（§11 原稿 4）。**本数 111 → 9・範囲 `000112` → `000009`・欠番 1 件 → 0 件・「7 群前後へ潰す」→ 9 群で実施済み。★起点は現行の 111 本である**（`CHANGE-194` 反映済み。**★「102 本」は既に失効した旧記述であり、そこを起点にしないこと**）**。★製造は設計書を直接編集しない**（`CLAUDE.md` §8）**。⇒ 設計卓の手番。★採用された場合のみ** |
| **4b** | **★`DES-001` §5.1 三層表・層 B の行**（`:241`） | **要**（§11 原稿 5）。**「既存マイグレ 72 本（凍結・一度だけ列挙）」が失効した。⇒ 本サブが `REUSE.toml` の当該表を撤去したため** |
| **4c** | **★`SUPP-001` §2.7 ライセンス項 2**（`:371`） | **要**（§11 原稿 5）。**「既存 102 本（層 A 30 / 層 B 72）は凍結・一度だけ列挙してある。★…この列挙は以後変わらない」が失効した** |
| 5 | **`REUSE.toml` の凍結表** | **★本サブで実施済み**（§6.2。開発者裁定 2026-09-19） |
| 6 | **`check-migration-license.sh` の凍結表** | **★本サブで実施済み**（§6.2） |
| 7 | **`docs/handover/code-facts.md` §10** | **要**。`migrations/` の 115 行の表と DDL ダンプが失効。**⇒ `M33-03` の射程**（`M33-overview` §5 の逐語＝「`code-facts` の再生成まで」） |
| 8 | **`.claude/commands/precheck_seed_data.md:138`** | **要**（§11 原稿 3）。**⇒ `M33-03` の射程** |
| 9 | **`scripts/release-targets.sh` のコメント** | **要**。「ゲームデータのマイグレ 20 本（`*_data_*.sql`）」が **10 本**（up 5 ／ down 5）になった。**★コードは `migrations/` を読まないためテストは落ちない。⇒ `M33-03` の射程** |
| 10 | **`cmd/seedgen/main.go:142` の既定 stem ／ `format.go` の `FormatPreM2003` 6 stem 表** | **要**。**⇒ `M33-03` の射程**（指示書 §3-3） |
| 11 | **スクラッチ DB の後片付け** | **不要**（2026-09-19 開発者確認）**。⇒ 実体は Claude Code on the web の実行コンテナ内にしか無く、コンテナ回収で消える。★`.gitignore` 済みで `git status` にも現れない**（実測）**。★同じ手順をローカルで再現した場合のみ開発者が消す。§14** |
| 12 | `docs/progress/progress-log.md` への索引行 | **★Phase D で追記し、`check-progress-log-index.sh` の緑を §12.3 に記録した**（追記前は違反 1 件であった） |

---

## 14. 後片付け（**★不要。実体はクラウド実行コンテナの中にしか無い**）

**作業ツリー直下に使い捨て DB が 3 つ残っている**（`scratch-m33-02-old.db` / `-new.db` / `-broken.db` ＋ 各 `-wal` / `-shm`。計 9 ファイル・約 4.5 MB）**。あわせて `logs/` も生成された。**

| 確認 | 実測 |
|---|---|
| `.gitignore` に当たるか | **当たる**。`.gitignore:30` の `*.db` ／ `.gitignore:36` の `logs/` |
| `git status --porcelain --untracked-files=all` に現れるか | **現れない**（該当 0 件） |
| 置き場 | **`/home/user/combomgr/`＝Claude Code on the web の実行コンテナ内** |

**★★★開発者の手番は無い**（2026-09-19 開発者確認）**。⇒ 本サブはクラウド実行セッションで行われており、実体はコンテナの中にしか無い。★コンテナは一定時間の非活動またはセッション終了で回収され、コミットして push したもの以外は残らない。⇒ 消す対象が開発者の手元に生まれていない。**

> **★★【`M33-01` からの変更点】`M33-01` 完了報告 §5.3 は同じ状況を「開発者の手番」として `rm` コマンドを書き残していた。⇒ 本サブで開発者に確認したところ「このセッション内のものなら片付け不要」という認識であり、そのとおりである。**
>
> **★★★一般形＝「作業ツリーに残った」と「開発者の手元に残った」は別である。** クラウド実行では作業ツリー自体が使い捨てであり、**`CLAUDE.md` §10 が `*.db` の削除を禁じているのは「利用者が登録したデータの不可逆な破壊を防ぐ」ためである**（同 §10「本ルールの目的」）**。⇒ 使い捨てコンテナ内のスクラッチ DB はその保護対象ではない。**
>
> **★ただし本セッションでは実際に消していない**（`.claude/settings.json` の deny が `rm *.db` をパターンで止めるため）**。⇒ 消せなかったのであって、消すべきだったのに残したのではない。**
>
> **★★★同じ手順をローカル（devContainer・開発者の端末）で再現した場合は話が別である。⇒ そのときは上の 9 ファイルと `logs/` が手元に残るため、開発者が消すこと。**

---

*以上、`M33-02` 完了報告。* **★★★比較 4 面はすべて一致した。⇒ `M33-overview` §6.2 段 3 の条件は満たされている。** **★★ただし「一致した」の意味は §3.2 で分けて書いた**——**全行と件数はほぼトートロジーであり、意味を持つのは手書きの `S01` が通した正規化スキーマ、書き出しでは再現されない `sqlite_sequence`、そして破壊確認 4 件と、新系列の上で緑のまま残った 58 パッケージである。** **★`go test ./...` は赤である**（2 パッケージ / 158 テスト）**。⇒ 歴史テストと golden の移設は `M33-03` の射程であり、隠していない。**
