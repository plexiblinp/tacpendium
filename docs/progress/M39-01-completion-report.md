# M39-01 完了報告 — `startup_basis` の不変条件の是正（新系列への折り込み）

| 項目 | 内容 |
|------|------|
| 作業 ID | **M39-01** |
| 指示書 | `docs/instructions/M39-01-startup-basis-invariant-fix.md` **v1.1.0** |
| チェックリスト | `docs/instructions/reviews/M39-01-review-checklist.md` **v1.1.0** |
| 実施日 | 2026-09-19 |
| 着手基点 | `02aca1e` |
| マイグレ消費 | **0 本**（★案 A。`migrations/*.up.sql` は 9 本のまま。`000010` は未使用のまま予約） |
| CHANGE 消費 | **0 本**（原稿は設計伝達レポート §1 / §6 へ。★自採番しない＝`D-293`） |

---

## 0. 要約

`D-187` の不変条件「`moves.startup` が `NULL` なら `startup_basis` は `'unknown'`」に違反していた **132 行**を、
**適用済みの新系列 `000004_data_seed_moves.up.sql` の値を直して**是正した（案 A＝`D-910` の `D-336` カーブアウト）。
⇒ **誤った値が最初から入らない**形であり、`migrations/` に是正の記録は 1 行も残らない。

**★そのため恒久的な歯止めはガードだけである。** `D-187` の不変条件を `TestRun_HEAD_*` の常設ガードへ引き上げ、
**破壊確認（陰性対照）を対で置いた**。

**★★本サブの判定は「132 行が 0 になったか」では足りない。** 問うたのは 2 つ＝
(1) 動いたのが `startup_basis` 列の 132 セル*だけ*か ／ (2) 次の seed 波でまた崩れないか。
**どちらも機械で立証した**（§4 ／ §6）。

---

## 1. 着手前の版ゲート（指示書 §0.5・8 点）

| # | 確かめること | 結果 |
|---|---|---|
| 1 | チェックリストが存在し v1.1.0 | ✅ **開発者から v1.1.0 の指示書本体とチェックリスト本体を受け取り**（本文は設計卓が書いたもの。製造は 1 文字も書いていない）、`docs/instructions/` へ**そのまま配置**した（commit `0c6af3b`）。★レビュー 低-2 で「出どころが辿れない」と指摘されたため明記する |
| 2 | `ls migrations/*.up.sql` が 9 本・`000001`〜`000009` | ✅ **9 本・欠番なし** |
| 3 | `go test ./...` が EXIT=0 | ✅ **`EXIT=0` ／ `^--- FAIL` 0 件**（§8.1） |
| 4 | 違反件数が **132** | ✅ **132**（§2） |
| 5 | 内訳 `system` 126 ／ `target_combo` 4 ／ `special` 2 | ✅ **完全一致** |
| 6 | 案 A の成立を実査し Plan Mode で提示・承認 | ✅ **実査のうえ提示し、承認を得た**（§3） |
| 7 | `M36-02` がマイグレ一覧・件数を成果物へ焼き込んでいないか | ✅ **焼き込んでいない**。`M36-02` の完了報告は未作成。コミット済みの `.json`/`.txt`/`.yml` にマイグレ件数の埋め込みなし。CI（`.github/workflows/`）も `go test -count=1 ./...` と `pnpm test` のみで件数検査を持たない。⇒ **追随する対象は無い** |
| 8 | 枝元のコミット | `02aca1e` |

### ★版ゲート 4・5 の実測（**2 通りで独立に数えた**）

**(a) 静的解析** — `startup_basis` を書くマイグレは `000001`（DDL の `DEFAULT 'unknown'`）と `000004`（seed INSERT）の
**2 本だけ**である（`grep -ln "startup_basis" migrations/*.sql`）。⇒ `000004` の INSERT タプルを全数パース（**3057 行を欠落 0**）して数えた。

**(b) 実 DB** — 旧 115 本から組んだ DB に対して指示書の式をそのまま流した。

```
【旧 DB 実測】是正前の違反件数 = 132
  内訳(category): {'special': 2, 'system': 126, 'target_combo': 4}
  内訳(元値):     {'standalone': 132}
【UPDATE】当たった行 = 132
【旧 DB 実測】是正後の違反件数 = 0
```

**⇒ (a) と (b) は一致した。★`M33-03` の 2026-09-19 の値を引き写していない。**

---

## 2. 132 行の構造（実測）

- **元値は `'standalone'` の 1 種類**（`through` は 0 件）。
- **`system` 126 行は 14 キャラ × 9 コードの正確なグリッド**で、**過剰一致 0 件**（同グリッドに当たる非違反行は存在しない）。
  - キャラ: `aki akuma alex blanka c_viper cammy chun_li dee_jay dhalsim e_honda ed elena sagat yasmine`
  - コード: `back dash_back dash_forward forward jump_back jump_forward jump_neutral micro_back micro_forward`
  - ★`id` では 2 ブロックに分かれる＝`187–204`（`c_viper` / `dhalsim` の 2 キャラ × 9）と `1833–1940`（第四波 12 キャラ × 9）。
- **非 `system` 6 行**（＝`character_data/` 側の違反 6 行と完全一致）:
  `blanka/blanka_chan_bomb_activated`(2298) ／ 同 `_od`(2299) ／ `chun_li/soaring_eagle_punches`(2466) ／
  `dee_jay/party_in_the_air`(2554) ／ `elena/soaring_raid`(2792) ／ `elena/raptor_range`(2793)

---

## 3. 段 1 — `startup_basis` を触る経路の全数

### 3.1 ★総数 = **150 箇所 / 30 ファイル**

数えたコマンド（**★着手基点に対して数えた。⇒ 自分の変更を母集団に混ぜない**）:

```bash
git grep -nE "startup_basis|StartupBasis|startupBasis" 02aca1e -- . \
  ':!docs/' ':!migrations/' ':!character_data/' ':!internal/seedgen/testdata/' ':!web/dist/' \
  > paths-at-base.txt
wc -l < paths-at-base.txt        # -> 150
```

| 区分 | 箇所 |
|---|---|
| Go（非テスト） | **39** |
| Go（テスト） | 105 |
| **フロント `web/`** | **2** |
| その他（`.claude/commands/`） | 4 |

**★出力はファイルへ全量落として `wc -l` で数えた。`head` / `tail` で切っていない。**
**★除外した 5 つはすべて生成物か走査対象外である**〔`docs/`＝文書 ／ `migrations/` と `character_data/` と `internal/seedgen/testdata/`＝データ本体 ／ `web/dist/`＝ビルド成果物〕。
**★`web/dist/` を除外した理由を書いておく** — 同ディレクトリは `web/src/locales/*.json` の文面がバンドルされたものであり、
**同じ 1 箇所を二重に数えることになる**（実測で 2 箇所ヒットする）。

### 3.2 ★フロント側は分岐を 1 つも持たない（実測）

ヒットした 2 箇所は `web/src/locales/{ja,en}.json` の **`_marker` 文字列**のみである
（`M19-LIMITATION-NOTICE`＝「この制約文面を変えたら BE の target 列挙規則も確認せよ」という申し送り）。
**⇒ 値で分岐するコードは 0。API DTO への露出も 0**（`rush.go` のコメントが明記する「`startup_basis` は引き続き API 非露出」と整合）。

### 3.3 ★★値で分岐する経路は 4 本 — **出力が変わる経路は 0 本**

| # | 経路 | 述語 | `startup` の NULL を先に見るか | 132 行が `unknown` へ動くと |
|---|---|---|---|---|
| 1 | `internal/service/setplay/service.go:220` `isSoloUnavailable` | `standalone \|\| unknown` | 見ない | **変わらない**（どちらも述語の集合内） |
| 2 | `internal/service/setplay/service.go:664` target ゲート | `IsDerived && basis != through` | 見ない | **変わらない**（どちらも `!= through`） |
| 3 | `internal/service/setplay/service.go:739` `newParentResolver` | `basis != through` → `nil` | 見ない | **変わらない**（どちらも `nil`） |
| 4 | `internal/service/punishfinder/service.go:366` `usesFirstHitStartup` | `target_combo && is_derived && standalone` | 見ない | **真 → 偽へ反転（4 行）。★しかし出力は変わらない**（下記） |

**経路 4 の判定（★`M33-03` の結論を引き写さず独立に実測した）**

`usesFirstHitStartup` の消費者は `candidateStartup` **1 本のみ**である（実測）。同関数は真なら `FirstHitStartup` を、偽なら `Startup` を返す。
**当該 4 行は `startup` も `first_hit_startup` も両方 NULL である**（実測）。
⇒ 是正前は `FirstHitStartup`(nil)、是正後は `Startup`(nil) を返し、**戻り値は同一**である。

**⇒ 4 経路のいずれも出力が変わらない。指示書 §2.1-4 の「止まって報告」条件には当たらない。**

### 3.4 ★★★論証ではなく実測で裏づけた（カナリア）

`internal/infra/migration/` の 2 つのカナリア（射影の測定装置）を**編集前と編集後**に走らせ、出力を突き合わせた。

| カナリア | before / after の sha256 | diff |
|---|---|---|
| `TestCanary_PunishScanProjection` | `55c2a2fe199b0977…` ／ **同一** | **0 行** |
| `TestCanary_SetplayProjection` | `b575f61a58d9d798…` ／ **同一** | **0 行** |

**⇒ 「出力は変わらない」は論証ではなく実測である。**

> **★ここで 1 つ踏みかけた。** `TestCanary_SetplayProjection` の環境変数は `CANARY_OUT` ではなく **`CANARY_SETPLAY_OUT`** である。
> 最初 `CANARY_OUT` で走らせたところ、**テストは `EXIT=0`（緑）のまま黙って skip し、出力ファイルが 1 つも作られなかった**。
> 終了コードだけを見ていたら「before を取った」と誤認していた。**⇒ 出力ファイルの実在を確かめて気づいた。**
> **★「緑である」ことは「走った」ことの証明ではない**（`CLAUDE.md` の `TACPENDIUM_AUDIT_DB` の先例と同型）。

### 3.5 ★★指示書の射程外だが数えた — **書く経路は 3 本ある**

指示書は*読む*経路しか求めていないが、§0.4 の「歯止め」の議論に直結するため書く経路も数えた。

| # | 書き手 | 何を書くか |
|---|---|---|
| 1 | `migrations/000001_init_schema.up.sql` | DDL の `DEFAULT 'unknown'` |
| 2 | `migrations/000004_data_seed_moves.up.sql` | seed INSERT（132 行の出どころ） |
| **3** | **`internal/repository/move/rush.go:31` `insertRushVariantSQL`** | **実行時に `'through'` のリテラルを INSERT する** |

**★3 本目は実行時に不変条件を破れる。** 詳細と割付は §9-2。

---

## 4. 段 2 — 新系列への折り込み（案 A）

### 4.1 ★132 セルの所在（ファイルごとの内訳）

| ファイル | 132 セルのうち |
|---|---|
| **`migrations/000004_data_seed_moves.up.sql`** | **132**（全数） |
| 他 8 本（`000001`〜`000003` / `000005`〜`000009`） | **0** |

根拠＝`startup_basis` の語を含むマイグレは `000001` と `000004` の 2 本だけであり、`000001` は DDL（値を 1 つも入れない）。

### 4.2 ★★直し方＝**再生成の経路で直した**（`D-707` の判別述語）

**判定: `000004` は生成物である。** 生成方式は「旧 DB の最終状態の書き出し」であり、**生成器の入力は DB そのもの**である
（`M33-02` 完了報告 §3 ／ §10.3）。⇒ 指示書 §2.2.1-3 が名指しする「循環」の形に当たる。

**★循環は断てた。** 旧 DB を組み、**是正の `UPDATE` を旧 DB へ当ててから再生成**すれば入力が正しくなる。
**⇒ 実際にその経路で直した。**

**★★ただし前提が 1 つ要る** — 生成器 `gen_groups.py` は使い捨てでリポジトリに無く（同報告 §10 冒頭）、§10.3 は**要点のみの逐語**である。
そこで**忠実性を先に実測で立証した**:

```
是正なしで再生成した 3057 行 : sha256 fd344c9b03c7505c25cf52b79066341a4b72439b3efd299fa06b59edef3237d1
コミット済み 000004 の行     : sha256 fd344c9b03c7505c25cf52b79066341a4b72439b3efd299fa06b59edef3237d1
diff = 0 行
```

**⇒ §10.3 の `lit()` ＋ 列順 ＋ `ORDER BY id` ＋ 自己参照 2 パスの pass-1 で、行の直列化を byte 一致で再構成できた。**
**★これが立たなければ外科的編集へ倒す計画だった**（承認済みの計画 §3.3）。**立ったので再生成を採った。**

手順:
1. 旧 115 本を凍結点 `b5cd716^` から `git show` で全数取り出す（up 115 本 / 計 230 ファイル）。
2. `M33-02` §10.2 の適用器で旧 DB を組む（`last = 117`。記録の `version=117 / dirty=0` と一致）。
3. **手順の再現性を先に立証** — `M33-02` §10.1 の正規化ハッシュを流し、記録値と突き合わせた。

| | 実測 | `M33-02` の記録値 | |
|---|---|---|---|
| 正規化スキーマ sha256 | `92e924e8bf1e58aab59bb8f0e63412b58777730f29515159f4858c6a3333d760` | 同一 | **一致** |
| 行数 / 表数 | 252 / 21 | 252 / 21 | **一致** |
| `sqlite_sequence` sha256 | `59448da12ba91732f3008151750777e962629bd7ac510a8e259b77384126ba26` | 同一 | **一致** |

4. 旧 DB の複製へ是正 `UPDATE` を当てる（**132 行に当たる**）。
5. 再生成した行を `000004` へ差し込む。**行の前後（インデント・末尾の `,` / `;`）は原文を保った。**

### 4.3 ★★★差分の形を機械で示した（指示書 §2.2.2）

**VALUES タプルを列ごとに分解して突き合わせた**（引用符とエスケープ `''` を尊重して `,` で分割）。

```
行タプル数: 旧 3057 / 新 3057 -> 一致
行タプル*以外*の行: 旧 561 / 新 561 -> 完全一致
構造差（インデント・末尾記号・列数）= 0 件
セル差分 総数 = 132
  列 startup_basis: 132 件  値の遷移 = [("'standalone'", "'unknown'")]
```

**⇒ 変わったのは `startup_basis` 列のちょうど 132 セルだけであり、値の遷移は 1 種類だけである。**
**★行順・空白・引用符・ヘッダコメント・パス 2 の `UPDATE` ブロックは 1 文字も動いていない**（「タプル以外の 561 行が完全一致」がそれを示す）。
**★目視では追えない** — 危険 §4.6 が言うとおり、巨大な INSERT 群の中の 132 セルは目で追えない。**機械の内訳がレビューの唯一の足場である。**

`git diff --stat` 側の裏取り: `migrations/000004_data_seed_moves.up.sql | 264 +++---  1 file changed, 132 insertions(+), 132 deletions(-)`

### 4.4 ★★★同一性の再検証（指示書 §2.2.3・**案 A の代償その 1**）

**`M33-02` が立てた「旧 111/115 本と新 9 本が全一致する」という到達点は、本サブで意図的に手放した。**

`M33-02` と**同じ手順**（§10.4 の比較器・4 面）で **旧（素のまま）vs 新（是正済み）** を再走させた。

| 面 | 結果 |
|---|---|
| 面 1 正規化スキーマ | **不変**（`92e924e8…`。記録値と一致） |
| 面 3 `sqlite_sequence` | **不変**（`59448da1…`。記録値と一致） |
| 面 4 表集合・件数 | **21 表・全表の行数が一致**（行数不一致の表 = なし） |
| 面 2 全行 | **21 表中 `moves` のみ DIFF**。他 20 表は一致 |
| **セル差分** | **総数 132 ／ 内訳 `{'moves.startup_basis': 132}`** |

**⇒ 差分はちょうど `startup_basis` の 132 セルである。§0.6.2 の条件 3（132 セルを超える）には当たらなかった。**

**★★`M33-02` の除外セルは 1 つだけ**（`users.created_at`）**であり、本サブでも同じものだけを除外した。実行のたびに印字している。**

> **★正直に書いておく。** 表ごとのハッシュ*値*は `M33-02` の記録値（例 `moves` = `d3e04ecdac99`）と一致しない。
> **⇒ §10.4 は行タプルの直列化の書式まで逐語で書いていないため、同じ値は再現できない。**
> **本サブが再現したのは「判定」である**〔是正前は 4 面すべて一致 ／ 是正後は `moves` の 132 セルだけが差分〕。
> **★面 1 と面 3 のハッシュは書式が §10.1 に逐語で在るため、値まで一致した。** ⇒ 手順の再現性はそちらで立証されている。

### 4.5 ★★ライセンスガードの追随（指示書 §2.2.4）

| # | 見たこと | 結果 |
|---|---|---|
| 1 | 凍結表は**番号**を持つのか内容ハッシュを持つのか | **番号**である（`FROZEN_A="000001 000002 000007 000009"` / `FROZEN_B="000003 000004 000005 000006 000008"`）。**⇒ 内容を書き換えても表は動かない**（見込みどおり・実測で確認） |
| 2 | 規則 (4) が凍結行にも走ること（`D-906` (2)） | **走った**。`000004` は `_data_` を持ち層 B へ解決し、`moves` は `GAME_TABLES` 側なので**通る** |
| 3 | 本体 | **`EXIT=0` / 「結果: 違反なし」**（凍結表: 層 A 4 本 / 層 B 5 本） |
| 4 | `--self-test` | **`EXIT=0` / 陽性 2・陰性 2 の全対照 OK** |

**⇒ `REUSE.toml` も `scripts/check-migration-license.sh` も 1 行も触っていない。**

---

## 5. 段 3 — `character_data/` の 6 行 ＋ 検証 DB

### 5.1 6 行（**★段 2 と同じコミット `1e7900b`**）

着手時に実査した（指示書の列挙を引き写していない）。**6 行とも `startup` 列が空・`startup_basis` が `standalone`** であることを
アサーションで確かめてから書き換えた。

| ファイル | 技 |
|---|---|
| `character_data/blanka.csv` | `blanka_chan_bomb_activated` ／ `blanka_chan_bomb_activated_od` |
| `character_data/chun_li.csv` | `soaring_eagle_punches` |
| `character_data/dee_jay.csv` | `party_in_the_air` |
| `character_data/elena.csv` | `soaring_raid` ／ `raptor_range` |

**変えた列と値（逐語・規約 (19) の歯止め）**: `startup_basis` 列のみ `standalone` → `unknown`。**行ごと差し替えていない。**
`git diff --stat` = `4 files changed, 6 insertions(+), 6 deletions(-)`。

**★同じコミットに載せた理由**＝`TestCSVAndDBAgreeOnFrameCostColumns` が CSV と DB の `startup_basis` 突合を固定しているため、
**CSV だけ先に直すとその間の状態が赤い**（指示書 §0.2）。

### 5.2 ★★golden は動かなかった（指示書 §0.3・**実測**）

```
go test ./internal/seedgen/... -count=1  ->  EXIT=0（全緑・golden 34 ファイルは 1 つも再生成していない）
```

**⇒ `SUPP-001` §5.5 規約 (19) の 3 点セットのうち 2 点目〔golden の追随〕は「不要だった」。**
**★「やらなかった」のではない。「要らなかった」のである。**

理由（実測で裏取りした）:
- `internal/seedgen/generate.go:129` は `r.StartupBasis` を**値域検証にしか使わない**。`'unknown'` は既に有効値であり、CSV に 61 セル実在する。
- `TestGenerate_FrameCostColumnsNotEmitted` が**生成 SQL に同列も値も出ないことを積極的に固定**している。
- `internal/seedgen/testdata/` 内の `startup_basis` の唯一の出現は `000084` の **`notes_tool` の JSON 本文中の語**であり、列ではない。

### 5.3 段 3-4 の 2 本

| テスト | 結果 |
|---|---|
| `TestCSVAndDBAgreeOnFrameCostColumns` | **緑** |
| `TestRun_HEAD_SeedValuesMatchCSV` | **緑** |

### 5.4 ★★★検証 DB の作り直し手順（**案 A の代償その 2**・指示書 §2.3-5/-6）

**手順は `scripts/migrate-userdata-prompt.md` へ節として追記した**（commit `23d8b21`）。
**★新規ファイルは作っていない**（`CLAUDE.md` §10.Y＝継続更新ファイルへ行として足せないかを先に検討する）。

**既存プロンプトがそのまま使えるか** — 使える。ただし**本件では使う必要がない**。差分が `moves` の 1 列に閉じており、
`moves` は元々「運ばない表」だからである。⇒ **`UPDATE` 1 本で足りる**ことを乾式で確かめた。

**乾式検証（★製造は自分で作った DB まで。走らせるのは開発者）**

| 確かめたこと | 結果 |
|---|---|
| 新系列（**是正前**）を適用し利用者データ（combos 1 / tags 4）を入れた DB を用意 | `schema_migrations = (9, 0)` |
| 是正前の違反 | **132** |
| 手順の `UPDATE` が当たった行 | **132** |
| 是正後の違反 | **0** |
| `PRAGMA foreign_key_check` | **違反なし** |
| 利用者データ | **無傷**（combos 1 / tags 4 のまま） |
| **手順適用後の `moves` 全行ハッシュ** | **`2b2b6a7e4664de89…` / 3057 行** |
| **是正済み系列で新規構築した DB の `moves`** | **`2b2b6a7e4664de89…` / 3057 行 → 完全一致** |

**⇒ 手順を当てた DB は、作り直した DB と `moves` において区別がつかない。**

**★開発者の検証 DB には触っていない**（指示書 §3-7）。

---

## 6. 段 4 — ガードの常設化（**★案 A では唯一の歯止め**）

### 6.1 置き場と、その理由

**`internal/infra/migration/head_seed_invariants_test.go`** に置いた（`migrate_head_test.go` ではない）。

両ファイルは冒頭で自ら基準を書いており、分かれ目は 1 つである:

- `migrate_head_test.go` … **スキーマ / 構造**の主張（FK・表集合・値域）。住人は `NoDanglingForeignKeys` / `DownUpRoundTrip` / `StartupBasisPartitionsAllMoves`。
- `head_seed_invariants_test.go` … **seed の中身 = 行**を見る（同ファイル冒頭の逐語）。

`D-187` は `startup` × `startup_basis` の**列を跨ぐ行の述語**であり、**UNIQUE でも CHECK でも表現できない**。
⇒ 同ファイルの既住人 `TestRun_HEAD_NoCrossingAliasTextEn`（「列を跨ぐ条件であり UNIQUE では表現できない。⇒ 検査で守るしかない」）と**同型**である。

**★`migrate_head_test.go` 自身の規則が同居に反対する** — 「主張が 2 つあるならテストも 2 つに分ける」。
`StartupBasisPartitionsAllMoves` は「値が 3 値のどれかか」、本件は「その値が `startup` と整合するか」。**主張が 2 つある。**
⇒ 同ファイルには**相互参照コメント 1 行**だけ置き、対であることを辿れるようにした。

**★版数は名指ししていない**（`D-714`）。**★件数も書いていない**（新しいキャラが増えても、不変条件を守っていれば緑のまま）。

### 6.2 ★★★破壊確認（指示書 §2.4-3 ／ チェックリスト E-2）

**(a) 常設の陰性対照** — `TestRun_HEAD_StartupBasisInvariantDetectorBites`

検出式を定数 `startupBasisInvariantSQL` で共有し、**ガードと対照が同じ式を通る**ようにした。

```
=== RUN   TestRun_HEAD_StartupBasisUnknownWhenStartupNull
--- PASS: TestRun_HEAD_StartupBasisUnknownWhenStartupNull (0.11s)
=== RUN   TestRun_HEAD_StartupBasisInvariantDetectorBites
    head_seed_invariants_test.go:323: 破壊確認: 違反件数 0 -> 1(1 行を 'standalone' へ戻した)
--- PASS: TestRun_HEAD_StartupBasisInvariantDetectorBites (0.11s)
```

歯止めを 2 つ入れた:
- **環境変数でゲートしない。** skip するテストは緑のまま素通りし、対照の役を果たさない（§3.4 で実際に踏みかけた型である）。
- **`UPDATE` の `RowsAffected()==1` を確かめる。** 0 行に当たったまま「検出 0」を見ても、それは対照ではない。

**(b) ★ガードが実際に赤くなることの実演**（一回限り・データを故意に戻した）

```
故意に戻した行 = id 2466 (chun_li/soaring_eagle_punches) の startup_basis -> 'standalone'
★ガードの EXIT=1
--- FAIL: TestRun_HEAD_StartupBasisUnknownWhenStartupNull (0.14s)
    head_seed_invariants_test.go:282: startup が NULL なのに startup_basis が 'unknown' でない行 = 1, want 0(母数 startup IS NULL = 362 行。D-187 / DES-003 §3.3 (i))
FAIL
```

**復元後**＝`ok`（緑）に戻り、§4.3 のセル差分も **132 件・`startup_basis` のみ**に戻ることを再測して確認した。

**⇒ 「1 行戻すと赤くなる」を出力で示した。戻して緑のままなら、そのガードは何も見ていない。**

### 6.3 ★母数の生存確認を入れた

ガードは違反 0 を見る前に **`startup IS NULL` の行が 0 でないこと**を確かめる（実測 **362 行**）。
⇒ 母数が消えたときに「違反 0」が空振りするのを防ぐ。

### 6.4 ★★旧テスト（v64 固定）の処遇 = **対象 0 本**

旧ガードは `internal/infra/migration/migrate_m19p2_test.go` の **`TestRun_M19P2_BeforeState`** であり、
本サブと**同じ検出式** `SELECT count(*) FROM moves WHERE startup IS NULL AND startup_basis <> 'unknown'` を
**版固定で**持っていた（`git show 815bd67^:internal/infra/migration/migrate_m19p2_test.go` の 316 行目）。

**同ファイルは `M33-03` の commit `815bd67`（「歴史テスト 141 本を分類して処遇する（消す 102 ／ 書き直す 34 ／ 諮る 5）」）が既に削除している。**

**⇒ 本サブに消す／残すの判断対象は存在しない。「緑にするため」に消したものは 1 本も無い。**

**★これが §0.4 の直因そのものである** — 不変条件を見ていた唯一のテストが版 v64 に固定されており、
v64 では成立していたため、その後の seed 波（第四波）で 132 行が崩れたことを**誰も見ていなかった**。
本サブのガードは版数を名指ししないので、同じ見逃し方はできない。

### 6.5 ★逆向きの不変条件は巻き込んでいない（チェックリスト E-4）

| 見たこと | 旧 | 新 |
|---|---|---|
| 値が変わった行 | — | **132** |
| うち `startup IS NULL` | — | **132** |
| うち `startup IS NOT NULL` | — | **0** ← ★射程外へ踏み込んでいない |
| `startup` 列が変わった行 | — | **0** ← ★`startup` は 1 セルも触っていない |
| **逆向き（`startup` 在り ∧ `unknown`）** | **15** | **15** ← ★同数＝巻き込んでいない |
| followup の母集団（`is_derived` ∧ `unknown`） | 51 | **55** |

**★followup `startup-basis-unknown-51-rows-mixed-provenance` の母集団が 51 → 55 へ動く。**
**⇒ これは `unknown` を*減らす*方向ではなく*寄せる*方向である**（増えた 4 行は発生フレームを持たない技であり、`unknown` が正しい）。
指示書 §3-1 の「`unknown` を『埋める』方向へ動かすこと」には**当たらない**。**⇒ 同 followup の記述が失効するため原稿を設計伝達レポート §4 へ出す。**

---

## 7. 失効記述の追随

**★1 件目だけは性格が違う。⇒ テストの*主張*が動いたのであり、文言の追随ではない。**

| # | 区分 | 場所 | 直した内容 |
|---|---|---|---|
| 1 | **期待値の変更**（テストの主張） | `internal/infra/migration/migrate_m3704_test.go:47` | 期待値 `110` → **`106`** |
| 2 | 文言の追随 | 同 24〜37 行の本文 | 「★110 は…」→ 106 ／ **M39-01 での 110→106 の経緯と、外れた 4 行の名指しを追記** |
| 3 | 文言の追随 | 同 54 行 | `"basis=through(★109 の外…)"` → `"…(★埋める対象の外…)"`（数字を名指ししない形へ） |
| 4 | 文言の追随 | `internal/repository/punish/queries.go:14` | `109 行` → **`106 行`** ＋ 経緯 1 行 |
| 5 | 文言の追随 | `internal/infra/migration/csv_db_sync_test.go:46` | `109 行` → **`106 行`**。★あわせて「着地時点では CSV・DB とも全行が空/NULL」という**既に失効していた記述**を実測（106 行投入済み）へ是正 |
| 6 | 文言の追随 | `internal/service/punishfinder/service.go:351/358/377` | `109`→`106` ／ `117`→**`118`** ／ `through 4 / unknown 4`→**`through 4 / unknown 8`** ／ `8 行`→**`12 行`** ＋ 経緯 |
| **7** | 文言の追随（**★レビュー 高-2**） | `internal/repository/punish/repository.go:43` | `§0.4 の 109 行` → **`実測 106 行`** ＋ 経緯 1 行。★同パッケージの `queries.go` だけ直して**片方を落としていた** |
| **8** | 文言の追随（**★レビュー 高-3**） | `internal/infra/migration/migrate_m3704_test.go:239` | `埋める対象 110 行のうち` → **「埋める対象のうち」＋ 関係が変わったことの説明**。★**本サブが同ファイル冒頭へ足した新コメントがこの (3) ブロックを名指しで参照していながら、ブロック内の旧値を落としていた** |
| **9** | 失効参照（**★レビュー 低-1**） | `csv_db_sync_test.go:45` ／ `migrate_m3704_test.go:44` | 本サブの新規コメントが名指しした `000116` へ **「（旧系列の）」を付けた**。★`M33-02` の squash 以後その番号のファイルは存在しない |

**実測値（是正後の DB）**: `target_combo` 126 ／ `∧ is_derived` **118** ／ `∧ standalone` **106** ／ `∧ through` 4 ／ `∧ unknown` **8** ／ `first_hit_startup IS NOT NULL` **106**。
**⇒ 118 = 106 + 4 + 8 で検算が合う。★「埋める対象 106」と「実際に入っている 106」が本サブで一致した。**

**★これらは `go test` も lint も型検査も緑のまま通る型の失効である**（レビュー較正で「高」扱い）。

---

## 8. テスト・検査（指示書 §5）

### 8.1 ★全数テスト（**パイプを挟まずファイルへ全量落として判定**）

```bash
go test ./... -count=1 > gotest-after.txt 2>&1; echo "EXIT=$?"
grep -cE "^--- FAIL" gotest-after.txt
```

| | 結果 |
|---|---|
| **`go test ./...`** | **`EXIT=0`** ／ **`^--- FAIL` = 0 件** ／ `ok` = **60 パッケージ** |
| **`cd web && pnpm test -- --run`** | **`EXIT=0`** ／ **Test Files 234 passed (234)** ／ **Tests 2974 passed (2974)** |
| **`make e2e`** | **`EXIT=0`** ／ **364 passed (7.2m)** ／ 失敗 **0 件** |

> **★`pnpm test` は `--run` を pnpm に直接渡すと `Unknown option: 'run'` で `EXIT=1` になる。** ⇒ `pnpm test -- --run` が正しい。
> **最初の実行はこれで赤かった。テストが落ちたのではない。**

### 8.2 新規 DB で違反件数 0（指示書 §5-2）

**★案 A では「適用前 132」という状態が最初から存在しない。** ⇒ 是正済みの 9 本で新規構築した DB で 0 件であることを示す。

```
是正済み系列で新規構築 -> startup IS NULL AND startup_basis <> 'unknown' = 0 件
                          （母数 startup IS NULL = 362 行）
```

### 8.3 常設検査

| 検査 | 結果 |
|---|---|
| `check-artifact-integrity.sh`（**★1 本目**） | **EXIT=0**「結果: 違反なし」 |
| `check-migration-license.sh` ／ `--self-test` | **EXIT=0** ／ **EXIT=0**（陽性 2・陰性 2 の全対照 OK） |
| `check-doc-refs.sh` | EXIT=0 |
| `check-progress-log-index.sh` | **★2 度回した。1 度目 EXIT=0 → 完了報告を書いた時点で EXIT=1 へ変わった → §11 の索引行を追記して EXIT=0**（詳細は §12-1） |
| `check-instruction-format.sh` | EXIT=0（14 件 / ベースライン 14 件・増加なし） |
| `check-derived-docs.sh` | EXIT=0（情報提供型）。**⚠ は 3 件出た＝`code-facts`（§8.5 で再生成・本文差分 0）／ `docs-map` ／ `retrospective-digest`。★後ろ 2 件は見たうえで本サブでは再生成しない**（§8.6） |
| `check-doc-inventory.sh` | EXIT=0 |
| `check-stop-discipline.sh` | EXIT=0 |
| `check-browser-storage-keys.sh` | EXIT=0 |
| `check-enum-sync.sh` | EXIT=0 |
| `check-import-order.sh` | EXIT=0 |
| `check-md-emphasis.sh <この手番の新規 .md>` | §10 |
| `gofmt -l internal/` ／ `go vet` | 差分なし ／ 指摘なし |

### 8.4 `make e2e`（全数）

```bash
make e2e > e2e.txt 2>&1; echo "E2E_EXIT=$?"   # -> E2E_EXIT=0
```

| | 結果 |
|---|---|
| 終了コード | **`E2E_EXIT=0`** |
| 通過 | **364 passed (7.2m)** |
| 失敗 | **0 件**（`✘` / `✗` / `N failed` の行が 1 つも無い） |
| 出力 | **全量をファイルへ落とした**（420 行）。`head` / `tail` で切っていない |

**★個別 spec の行が全数残っている**ので、「どの spec が走ったのか」を後から示せる（`D-881` の一般形）。
本サブは DB の 1 列の値しか触っていないため影響は無い見込みであったが、**見込みで済ませず全数を回した**。

**★とくに `e2e/moves-edit.spec.ts:30`「既存 seed 技を編集 → 保存 → GET 反映 → ラッシュ版生成」が緑である。**
⇒ §9-2 で報告するラッシュ生成経路そのものを通る spec であり、**本サブの変更で壊れていない**ことの裏取りになる
（★ただし同 spec は `startup` が NULL の元技を使っていないため、§9-2 の穴を検出するものではない）。

### 8.5 ★派生資料（`code-facts`）の扱い — **再生成し、内容差分 0 を示した**

`check-derived-docs.sh` が `docs/handover/code-facts.md` を「⚠ 陳腐化疑い（源泉が新しい）**7 / 1081 件(1%)**」と出した。

**⇒ 再生成した（commit `a86c1a8`）。差分は生成スタンプ 1 行だけであり、本文は 1 行も動かなかった。**

```
-生成: 2026-09-19 / commit `863a526` / `scripts/generate-code-facts.sh`
+生成: 2026-09-19 / commit `23d8b21` / `scripts/generate-code-facts.sh`
```

**★実質の失効は無かった。** 同書は `migrations` の**形**（`INSERT INTO moves` / `UPDATE moves`）と
DDL の列宣言（`startup_basis TEXT NOT NULL DEFAULT 'unknown'`＝`000001` 由来）を記録しており、**INSERT の値は持たない**。
⇒ 132 セルの書き換えでは陳腐化しない。**「疑い」を差分で否定するために回した。**

### 8.6 ★残る ⚠ 2 件を見たうえで、本サブでは再生成しない（レビュー 中-3）

| 派生資料 | 変化量 | 本サブの判断 |
|---|---|---|
| `docs/handover/docs-map.md` | 30 / 1699 件(2%) | **再生成しない。** 同書は `docs/` を索引するものであり、本サブが足したのは完了報告とレビュー報告の 2 件である。⇒ 次に `docs/` をまとめて触る手番で回すのが筋 |
| `docs/handover/retrospective-digest.md` | 1 / 1 件(100%) | **再生成しない。** 源泉は `retrospective-log.md` であり、本サブは同書を 1 行も触っていない |

**★ただし記録に残すべき事実が 1 つある** — **`docs/handover/docs-map.md` に `M39` の文字列が 1 件も無い**（実測 0 件）。
⇒ `M39` の三点セット（overview / 指示書 / チェックリスト）は 2026-09-19 に発行されたが、索引へ載っていない。
**★設計卓が `M39` の資料を探すとき、docs-map からは辿れない。** 原稿を設計伝達レポート §4 へ出す。

---

## 9. ★開発者への確認事項・残課題

### 9-1. 【報告のみ】`M39-overview.md` の版が指示書の宣言と合っていない

指示書 v1.1.0 のヘッダは「上位＝`docs/instructions/M39-overview.md` **v1.1.0**」と書くが、
リポジトリの同書は **v1.0.0**（`D-909` 起票時のまま）である。**⇒ 設計卓の手番。製造は触っていない。**

### 9-2. ★★★【要裁定】ラッシュ生成経路が実行時に `D-187` を破れる

**`internal/repository/move/rush.go:31` の `insertRushVariantSQL` は、`startup_basis` を `'through'` のリテラルで INSERT しつつ `startup` を元技からコピーする。**
**`internal/service/move/service.go:96` の `rushEligible` は `category ∈ {normal, unique} ∧ !is_aerial` しか見ておらず、`startup NOT NULL` を要求していない。**

**⇒ `startup` が NULL の元技からラッシュ版を生成すると、`startup NULL` ＋ `basis 'through'` の行ができる。これは新たな `D-187` 違反である。**

**該当する元技は現に 3 件ある**（実測。いずれも `category='unique'`・非空中）:

| id | キャラ / 技 |
|---|---|
| 1364 | `rashid` / `run` |
| 2145 | `alex` / `prowler_stance` |
| 2555 | `dee_jay` / `speedy_maracas` |

**★なぜ本サブで重いか** — 案 A は `migrations/` に是正の記録を 1 行も残さないため、**歯止めはガードだけである**（§0.4 / §4.3）。
そのガードは**新規 DB に対して走る**ので、**この経路で壊れたユーザー DB は緑のまま素通りする。**

**★もう 1 つの帰結** — マイグレに件数ハードガード（132 でなければ中断）を置けない。
ラッシュ版を 1 つ生成したユーザーの DB では 133 になり、**起動時の `migration.Run` が中断してアプリが起動しなくなる**からである。
（本サブは件数ガードを SQL に置かず、ヘッダコメントと常設テストで担保した。現行系列に `RAISE(ABORT)` の前例が無いことも実測で確認済み。）

**★なお `PATCH /api/moves/:id` からは破れない**（`UpdateMoveFields.Startup` は `*int` で nil は「更新しない」の意）。**実行時の穴はラッシュ生成経路だけである。**

**製造の推奨**: `'through'` をリテラルで書く設計判断は `M19-04` §4.5 の明示的な決定であり、覆すなら裁定が要る。
⇒ **本サブでは触っていない。** 割付（本サブへ同乗 / 別サブ / followup）をご判断いただきたい。

### 9-3. 【原稿】設計伝達レポートへ回すもの

**レポート本体**: `docs/handover/design-reports/20260919-m39-01-design-exceptions.md`（作成済み）

| 行き先 | 内容 |
|---|---|
| §1 / §6（CHANGE 原稿） | **★レビュー 中-1 で書き直した。** 初版は「`SUPP-001` §2.7 の『全一致』の記述が失効する」と書いたが、**`docs/design/` にその記述は無い**（実測。`SUPP-001` の「全一致」3 件はすべて §2.2 の「**完全**一致」＝重複判定の話で無関係）。⇒ 実在する失効は次の 2 つである。**(1) §5.5 規約 (20) の付記「『適用済みマイグレは書き換えない』は引き続き生きている」**（1497 行）**／ (2) §2.7 のライセンス表 2 の「★適用済みマイグレは書き換えないので、この列挙は以後変わらない」**（391 行）。★どちらも `D-910` のカーブアウト〔**公開前かつ適用済み DB が開発者の検証環境 1 つだけ**という窓に限る〕を条件つきで as-built 化する形になる。**★窓は公開で閉じる。**／ (3) `SUPP-001` §5.5 系へ「不変条件のガードは版ではなく HEAD に対して置く」 |
| §4（followup 原稿） | (a) `startup-basis-unknown-51-rows-mixed-provenance` の母集団 51→55 の訂正 ／ **(b) §9-2 のラッシュ経路。★★レビュー 中-2 の要求で追記＝「本サブのガードは*新規 DB* に対して走る。⇒ この経路で壊れた利用者 DB は緑のまま素通りする」。⇒ followup `d187-startup-basis-invariant-violated-at-head` を「ガードが上がったから」だけで閉じさせないこと** ／ (c) **`down` を単体で見るテストがリポジトリに 1 本も無い**（`TestRun_HEAD_DownUpRoundTrip` は 0 まで全戻しして表集合しか見ない） ／ **(d) `docs/handover/docs-map.md` に `M39` の資料が 1 件も載っていない**（実測 0 件・レビュー 中-3） |

**★`docs/handover/followup-backlog.md` は 1 文字も編集していない**（`D-838`）。**★`docs/design/` 本体も編集していない**（`CLAUDE.md` §8）。実測: `git diff --stat 02aca1e -- docs/design/ docs/handover/followup-backlog.md` = **空**。

---

## 10. 完了条件の対照（指示書 §6）

| # | 条件 | 本報告の該当 | 判定 |
|---|---|---|---|
| 1 | 新規 DB で違反 0・実測出力 | §8.2 | ✅ |
| 2 | 読む経路の全数（総数と経路ごとの判定） | §3.1 / §3.3 | ✅ **150 箇所 / 30 ファイル** |
| 3 | 出力が変わる経路が在れば止まって報告 | §3.3 / §3.4 | ✅ **0 本**（カナリアで実測） |
| 4 | 差分が `startup_basis` のちょうど 132 セルであることを機械で | §4.3 | ✅ |
| 5 | 同一性の再検証・差分ちょうど 132 セル | §4.4 | ✅ |
| 6 | `character_data/` 6 行を段 2 と同じコミットで | §5.1（commit `1e7900b`） | ✅ |
| 7 | ガードが `TestRun_HEAD_*` に在り破壊確認の出力が在る | §6.1 / §6.2 | ✅ |
| 8 | 旧テストの処遇と理由 | §6.4 | ✅ **対象 0 本** |
| 9 | 検証 DB の作り直し手順（走らせるのは開発者） | §5.4 | ✅ |
| 10 | golden が動いたかを実測で判定 | §5.2 | ✅ **動かなかった＝不要だった** |
| 11 | マイグレを 1 本も作っていない（9 本のまま） | §4.1 / 下記 | ✅ |
| 12 | §5 の検査がすべて緑 | §8 | ✅（★高-1 の是正後。§12-5） |
| 13 | 完了報告 ＋ `progress-log` 索引行 | 本書 ／ §11 | ✅（**★初版は索引行が無く未充足だった。レビュー 高-1 で是正**＝§12-1） |
| 14 | 設計伝達レポート（CHANGE 原稿は §1 と §6） | §9-3 | ✅ `docs/handover/design-reports/20260919-m39-01-design-exceptions.md`（★CHANGE 原稿は §1 と §6・followup 原稿は §4） |
| 15 | 着手前の版ゲート 8 点 | §1 | ✅ |
| 16 | 完了報告を書いた**後に**、報告を入力に取る検査を回し直す | §12-1 | ✅（**★初版は未実施であり、そのために 13 が偽になっていた**） |

**射程の機械確認（チェックリスト F 群）**

```
F-1  migrations/*.up.sql = 9 本（000001 〜 000009）           -> マイグレ消費 0 本
F-2  git diff --stat 02aca1e -- migrations/
       000004_data_seed_moves.up.sql | 132 insertions(+), 132 deletions(-)   （他 8 本は無変更）
F-3  unknown 245 -> 377（+132）／ standalone 2090 -> 1958（-132）／ through 722 -> 722（不変）
       -> unknown を *減らす* 変更は 0 件
F-4  git diff --stat 02aca1e -- docs/design/ docs/handover/followup-backlog.md  -> 空（差分 0 行）
```

---

## 11. コミット

| コミット | 内容 |
|---|---|
| `0c6af3b` | 指示書・チェックリストを v1.1.0 へ |
| **`1e7900b`** | **是正本体**（`000004` の 132 セル ＋ `character_data/` 6 行 ＋ 失効記述の追随）★同一コミット |
| `1cdc90a` | ガードの常設化（`head_seed_invariants_test.go` ＋ 相互参照） |
| `23d8b21` | 検証 DB の直し方（`scripts/migrate-userdata-prompt.md`） |
| `a86c1a8` | `code-facts` の再生成（★本文の差分 0・§8.5） |

### ★`git diff --stat 02aca1e`（着手基点からの変更統計）

```
 character_data/blanka.csv                          |   4 +-
 character_data/chun_li.csv                         |   2 +-
 character_data/dee_jay.csv                         |   2 +-
 character_data/elena.csv                           |   4 +-
 docs/instructions/M39-01-startup-basis-invariant-fix.md  | 231 +++++++++-------
 docs/instructions/reviews/M39-01-review-checklist.md     |  50 ++--
 internal/infra/migration/csv_db_sync_test.go       |   7 +-
 internal/infra/migration/head_seed_invariants_test.go |  93 ++++++++
 internal/infra/migration/migrate_head_test.go      |   7 +
 internal/infra/migration/migrate_m3704_test.go     |  18 +-
 internal/repository/punish/queries.go              |   3 +-
 internal/service/punishfinder/service.go           |  12 +-
 migrations/000004_data_seed_moves.up.sql           | 264 +++++++-----------
 scripts/migrate-userdata-prompt.md                 |  62 +++++
```

**★新規ファイルは `head_seed_invariants_test.go` への追記のみで、新規作成したファイルは 0 件である**
（`docs/progress/M39-01-completion-report.md`＝本書を除く）。**⇒ `+` だけのファイルに `-` は付いていない**（教訓 `E-225`）。

---

## 12. レビュー（Phase B / C）

**レビュー報告書**: `docs/progress/m39-01-review.md`（fresh subagent による独立レビュー。メイン会話の文脈を継承していない）
**判定**: **条件付き合格**（高 3 件の是正が要る）
**指摘件数**: **9 件 = 高 3 / 中 4 / 低 2**
**採否**: **全 9 件を採用。不採用 0 件。⇒ 「高」の不採用が 0 件であるため Phase C の安全弁は発動していない。**
**再レビュー往復**: **0 回**（上限 2 回・`CLAUDE.md` §9）

### 12-1. ★★★高-1 が最も重い — **`D-890` をその節を読んだうえで踏んだ**

**指摘**: `docs/progress/progress-log.md` に `M39-01` の索引行が無く、`check-progress-log-index.sh` が **EXIT=1**。
にもかかわらず完了報告 §8.3 は同検査を「EXIT=0」、§10 の行 13 を「✅」と書いていた。
⇒ **報告が「緑」と主張する検査が、実は赤かった。**

**採否**: **採用。**

**原因**: 同検査を回したのは**完了報告を書く前**である。**完了報告の存在そのものが同検査の入力**であるため、
報告を書いた瞬間に「対応する索引行が無い」が成立して**赤へ変わった**。
**★これは製造 CLI の `<!-- FULL-TEST-RUN-EXIT-CODE -->` 節が `D-890`（`M36-01` §7-1）として名指しで警告している型である。**
**⇒ その節を読んだうえで、同じ穴に落ちた。**

**是正**: §11 の索引行を追記し、**回し直して EXIT=0 を確認した**（「検査した 120 件すべてが progress-log に現れる」）。
§8.3 の当該行と §10 の行 13 / 16 を実態へ書き換えた。

**★一般形**: **検査を回した時点と報告を書いた時点がずれると、「緑」が偽になる。**
⇒ 報告を入力に取る検査は、**報告を書き終えた後にもう一度回す**。

### 12-2. 高-2 / 高-3 — 失効記述の取りこぼし 2 件

| # | 指摘 | 採否 | 是正 |
|---|---|---|---|
| 高-2 | `internal/repository/punish/repository.go:43` の「§0.4 の 109 行」が旧値のまま。**同パッケージの `queries.go:14` は直しているのに片方だけ落ちている** | **採用** | `実測 106 行` ＋ 経緯 1 行（§7 の行 7） |
| 高-3 | `internal/infra/migration/migrate_m3704_test.go:239` の「埋める対象 110 行のうち」が旧値のまま。**本サブが同ファイル冒頭へ足した新コメントがこの (3) ブロックを名指しで参照している** | **採用** | 「埋める対象のうち」＋ 関係が変わったことの説明（§7 の行 8） |

**★両方とも「読んだうえで落とした」型である。** 高-3 はとくに重い —— **自分が書いた新コメントが指している先の旧値を直していない。**
⇒ `M33-03` の教訓 12（「段をまたぐ参照は最後にもう一度走査する」）と同型であり、**走査を 1 度で終えたことが原因**である。

**★較正どおり「高」である**: 動作は正しいままなので `go test` も lint も型検査も緑になり、人が読む以外に見つける経路が無い。
`109` / `110` はいずれも「`first_hit_startup` を埋める実務の母数」であり、次に埋める担当が旧値を信じると 4 行ぶんズレた計画を立てる。

### 12-3. 中・低の採否

| # | 指摘 | 採否 | 対応 |
|---|---|---|---|
| 中-1 | §9-3 の CHANGE 原稿が**実在しない記述**（`SUPP-001` §2.7 の「全一致」）を名指ししている | **採用** | **★指摘を鵜呑みにせず自分で数え直した。** `grep -c "全一致" docs/design/supp-001-detailed-design.md` は **3 件**を返すが、**3 件とも §2.2 の「完全一致」**（重複判定キーの話）であり同一性検証とは無関係だった。⇒ **レビューの結論（実在しない）は正しい。** 実在する失効 2 箇所〔§5.5 規約 (20) の付記・1497 行 ／ §2.7 のライセンス表 2・391 行〕へ書き換えた（§9-3） |
| 中-2 | followup `d187-...` を「ガードが上がったから」だけで閉じさせないよう §4 原稿へ明記 | **採用** | §9-3 の (b) へ「ガードは*新規 DB* に対して走る ⇒ この経路で壊れた利用者 DB は緑のまま素通りする」を明記 |
| 中-3 | `check-derived-docs.sh` の ⚠ 2 件が報告で扱われていない／`docs-map` に `M39` が 0 件 | **採用** | §8.6 を新設。判断と理由、および `M39` が索引に無い事実を記録し、原稿を §4 へ回す |
| 中-4 | §7 の表で「期待値の変更」と「文言の追随」が同じ区分に並んでいる | **採用** | 区分列を足して分けた |
| 低-1 | 新規コメントが存在しない旧連番 `000116` を名指し | **採用** | 2 箇所へ「（旧系列の）」を付けた（§7 の行 9） |
| 低-2 | 版ゲート 1 の記述から v1.1.0 本文の出どころが辿れない（レビュー側は「不明」と記載） | **採用** | §1 の行 1 へ「開発者から受領。本文は設計卓が書いたもので製造は 1 文字も書いていない」を明記 |

### 12-4. ★レビューが独立に再現したもの（製造の立証の裏取り）

レビューは製造の立証を鵜呑みにせず、**自分で回して再現**している:
132 セルの列分解突合（列 index 17 のみ・遷移 1 種類）／ `git diff --numstat` で他 8 本が無変更 ／ `down` 不変 ／
**pass 2 の `UPDATE` 515 本が `original_move_id` のみを書き、新系列 18 ファイルに `UPDATE moves SET startup*` が 1 本も無いこと**（★製造が「INSERT タプルだけ見れば十分」とした前提の裏取り）／
ガードと破壊確認の実行（`違反件数 0 -> 1`）／ 経路 150 箇所 / 30 ファイルの再現 ／ §7 の数値の全数再計算 ／
`go test ./...` `check-artifact-integrity.sh` `check-migration-license.sh` `gofmt` `go vet` ／ `E-225`（新規ファイルに deletions 無し）。

**★製造が自己申告したラッシュ生成経路の穴（§9-2）は、レビューが独立に追認して「実在する」と判定した**（優先度は「中」＝本サブの射程外・裁定が要る）。

### 12-5. 是正後の再測

| | 結果 |
|---|---|
| `go test ./internal/... -count=1` | **EXIT=0 ／ `^--- FAIL` 0 件** |
| `gofmt -l internal/` | 差分なし |
| `bash scripts/check-progress-log-index.sh` | **EXIT=0**（違反なし） |
| 残存する `109 行` / `110 行` の名指し | **0 件**（再走査で確認） |

### 12-6. ★★★報告を書き終えた**後に**回し直した証拠（§12-1 の是正・完了条件 16）

**★この表そのものが §12-1 の一般形への回答である。** 「回し直した」と書くだけでは、回さなかったことが報告から見えない。

回した時点＝**完了報告・レビュー報告・設計伝達レポートの 3 本すべてを書き終えた後**（commit `2c5223f` の後）。

| 検査 | EXIT |
|---|---|
| `check-artifact-integrity.sh`（★1 本目） | **0** |
| **`check-progress-log-index.sh`**（★報告の存在が入力） | **0** |
| **`check-completion-report-md-emphasis.sh`**（★完了報告そのものを見る） | **0** |
| **`check-doc-inventory.sh`**（★新しい文書が増えたことを見る） | **0** |
| `check-doc-refs.sh` | **0** |
| `check-derived-docs.sh` | **0** |
| `check-instruction-format.sh` | **0** |
| `check-stop-discipline.sh` | **0** |

**この手番で新規に作った `.md` 3 本の閉じない強調**（ファイル引数モード・`D-775`）:

| ファイル | EXIT |
|---|---|
| `docs/progress/M39-01-completion-report.md` | **0** |
| `docs/progress/m39-01-review.md` | **0** |
| `docs/handover/design-reports/20260919-m39-01-design-exceptions.md` | **0** |

**★`docs/progress/progress-log.md` は渡していない**（継続更新ファイルであり、歴史記録としての既存の検出行を持つ＝`D-274` (3)）。

**最終の全数テスト**（取り込み後・パイプを挟まず）:

```bash
go test ./... -count=1 > gotest-final.txt 2>&1; echo "EXIT=$?"   # -> EXIT=0
grep -cE "^--- FAIL" gotest-final.txt                            # -> 0
```

⇒ **`EXIT=0` ／ `^--- FAIL` 0 件 ／ `ok` 60 パッケージ。**


---

*以上、M39-01 完了報告。*
