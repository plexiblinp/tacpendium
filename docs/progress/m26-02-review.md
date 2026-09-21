# M26-02 レビュー報告書

| 項目 | 内容 |
|------|------|
| 対象指示書 | `docs/instructions/M26-02-public-snapshot-and-license-placement.md` **v1.0.2** |
| チェックリスト | `docs/instructions/reviews/M26-02-review-checklist.md` v1.0.0 |
| 対象完了報告 | `docs/progress/M26-02-completion-report.md` |
| 着手基点 / レビュー時 HEAD | `231c07cc` / `83a94176` |
| 実施日 | 2026-09-06 |
| 重大 | **0 件**（差し戻しには当たらない） |
| 高 | 6 件 ／ 中 6 件 ／ 低 6 件 |

---

## 総評

本サブの核心は「除外規則が空振りしても緑になる」ことの防止であり、そこは実際に効いている。許可リスト方式は集合が閉じており（未判定＝赤）、生成と検査が同じ判定器 1 本を通り、私自身が壊した 3 パターンすべてで赤くなることを確認した。REUSE 仕様の一次情報も、私が独立に `fsfe/reuse-website` から取得して 11 項目の逐語を全部照合したが、引用は正確であり、到達できた範囲と到達できなかった範囲が分けて書かれている。指示書・チェックリスト側の失効 3 件（欠番 3→1 / 層 A 28→27 / `character_data/` の列挙漏れ）を黙って合わせずに報告した点は特筆に値する。ライセンス割当もレビュー表と 1 対 1 で一致していることを、私が数ではなくファイル単位で機械照合して確認した。

一方で、**「壁は 2 枚ある」という本サブ自身の主張が、実際には片方の壁しか深さを持っていない**。DENY グロブ（`.env` / `secrets/**` / `work_html/**` / `tmp/**`）はすべてリポジトリ直下にしか当たらず、`web/.env`（Vite の既定位置）や `docs/tmp/**` は `web/**` / `docs/**` の ALLOW を素通りする。同様に、`check-migration-license.sh` の「静かな漏れ」検出は `INSERT OR IGNORE INTO`（**既存 `migrations/000007` が実際に使っている形**）を見逃す。どちらも検査が緑のまま抜ける型であり、本サブが止めようとした事故そのものである。

加えて、完了報告の自己申告 2 件が実測と食い違う（`progress-log` 追記＝未実施 ／ `check-md-emphasis` の +43 行は本サブの完了報告自身が寄与）。いずれも「動作は正しいまま記述だけが失効する」型であり、本プロジェクトの較正では「高」に置く。

---

## 設計準拠性レビュー結果

### 束 A — 許可リストと陽性対照（チェックリスト §1）

| # | 見ること | 評価 | 所見 |
|---|---|---|---|
| A-1 | 許可リスト方式か（denylist でないか） | **◎** | `scripts/public-snapshot-manifest.txt` は ALLOW/DENY の 2 種で書かれ、`scripts/check-public-snapshot.sh:130-133` が「ALLOW にも DENY にも当たらない」を **未判定＝違反**として計上する。私の独立確認でも `brand-new/x.md` は未判定に落ちた（破壊確認 3）。集合は閉じている |
| A-2 | 陽性対照が self-test に在り、実走結果が報告に在るか | **◎** | `check-public-snapshot.sh:172-258` に陰性 2・陽性 5。報告 §4.5(a)(b) に実走出力。私も独立に再現した（破壊確認 1・3） |
| A-3 | 除外の 3 群 | **△** | 3 群とも**在る**が、`.env` / `secrets/**` と `work_html/**` / `tmp/**` が**リポジトリ直下にしか当たらない**。→ 指摘 **高-1** |
| A-4 | `combmgr-features.txt` が「存在しても出さない」形か | **◎** | `manifest:27` の DENY はグロブが 0 件に当たっても赤にならない設計（`check-public-snapshot.sh:120-128`＝DENY は集合から抜くだけ）。陰性対照 2（`never-exists/**`）で守ってある。対象ファイルは実在を確認（`docs/human-notes/future-notes/combmgr-features.txt`） |
| A-5 | 許可リスト全文と除外パスの全数が報告に在るか | **◎** | 報告 §4.2（全文）／ §4.4（14 件をパスで全数）。私の実測でも `2721 - 2707 = 14` 件で一致 |
| A-6 | `.gitignore` の既存除外との重なりの整理 | **△** | 報告 §2-2 で整理されているが、**`.gitignore` は深さ無制限・manifest の DENY は直下のみ**という非対称に触れていない。→ **高-1** |

### 束 B — ライセンスの配置（チェックリスト §2）

| # | 見ること | 評価 | 所見 |
|---|---|---|---|
| B-1 | レビュー表 §1 / §2 と 1 対 1 か（**ファイル単位**） | **◎** | 機械照合した。`FROZEN_A`（`check-migration-license.sh:70-72`）はレビュー表 §1 の 28 行から削除済み `000012` を除いた **27 本と完全一致**、差分は `000081` / `000096` / `000103` の新規 3 本のみ。`FROZEN_B`（同:74-81）はレビュー表 §2 の **52 本を完全に含み**、差分は新規 20 本のみ。重複・取り違え 0 件 |
| B-2 | 層が割れる 3 本（`000039` / `000017` / `000029`） | **◎** | 3 本とも `FROZEN_B` に在り、`--list` の実走でも `CC-BY-SA-4.0` に解決した（表の推奨どおり） |
| B-3 | 表に無いものを製造が自分で割り当てていないか | **○** | `000081`〜`000103` の 23 本は表の射程外であり、**止まって開発者へ請うたことが報告 §1.1-2 に記録されている**（Plan Mode・2026-09-06 承認）。判定表は §3.2 に全数。層 A の 3 本が `combos` しか触らないことは私も実物で確認した（`000081` = `UPDATE combos`、`000096` = `ALTER TABLE combos` + 自表 backfill、`000103` = `UPDATE combos`）。判定は `D-672` と整合する。**★ただし承認そのものの一次記録（開発者の発言）はリポジトリ上に無く、レビューからは「報告にそう書いてある」以上のことは検証できない**（→ 制約事項） |
| B-4 | 三層の `LICENSE` | **◎** | `LICENSE`（AGPL 全文・`LICENSES/AGPL-3.0-or-later.txt` と byte 一致）／ `LICENSES/{AGPL-3.0-or-later,CC-BY-SA-4.0,MIT}.txt`。MIT は著作権行が埋まっている。REUSE 仕様「`LICENSES/` 直下・SPDX ID ＋拡張子・plain text」に適合 |
| B-5 | パス単位の宣言に集約されているか | **◎** | `REUSE.toml` のみ。追跡ファイル中に SPDX コメントヘッダを持つものは 0 件（`git grep` で確認。ヒット 4 件はすべて宣言・報告・スクリプト本文）。→ ただし **中-1** |
| B-6 | 新規マイグレの命名規約 | **○** | `REUSE.toml:63` の `migrations/*_data_*.sql` グロブ 1 行。検査も持つ。→ ただし検出の穴が在る（**高-2**） |
| B-7 | `check-migration-license.sh` が在り self-test を持ち緑か | **○** | 在る・self-test 6 対照・実走緑。`check-artifact-integrity.sh` が登録簿なしで自動発見していることも実測（検査 14 件に両方が入っている）。→ 検出範囲に穴（**高-2**） |
| B-8 | `character_data/` が丸ごと層 B ／ `seed-progress.md` のみ層 A | **◎** | `REUSE.toml:61` + `:103-106`。解決の実測で `character_data/ryu.csv → CC-BY-SA-4.0` / `character_data/seed-progress.md → AGPL-3.0-or-later`。ディレクトリは実測 35 ファイル（CSV 31 ＋ md 4）で、報告 §1.2-3 の指摘（指示書の列挙に `dhalsim-joint-remeasurement-2026-09-04.md` が漏れていた）は正しい |
| B-9 | `DATA-LICENSE.md` の「正本は `character_data/`」 | **◎** | `DATA-LICENSE.md` §4（`:56-66`） |
| B-10 | `NOTICE` / `CONTRIBUTING` / `SECURITY` / `SUPPORT` が骨子 §9 に沿うか。`SECURITY.md` の LAN 明記 | **○** | 4 本とも在り、`SECURITY.md:3-6` に「LAN 内での利用を前提／インターネットへ直接公開しないこと」を明記。→ ただし `CONTRIBUTING.md:56` が公開物に存在しないディレクトリを指す（**高-6**）／ `NOTICE:41` の URL が未確認（**中-5**） |
| B-11 | **★宣言の順序（設計卓からの追加依頼）** | **◎** | **仕様解釈は正しい。** 私が一次情報を独立取得して照合した（下記「破壊確認の実施結果」§3）。実際の解決結果も意図どおりで、`--list` の実測は 層 A 60 ファイル / 層 B 144 ファイル＝ 30 本 / 72 本 と凍結表に一致 |

### 束 C — マイグレの欠番の記録（チェックリスト §3）

| # | 見ること | 評価 | 所見 |
|---|---|---|---|
| C-1 | `SUPP-001` §2.7 の素案が報告に在るか | **◎** | 報告 §7（`<!-- ここから素案 -->` で括った貼り付け可能な形）。`docs/design/` は未編集＝正しい |
| C-2 | 欠番 3 つが理由つきで表になっているか | **◎（実測に基づく是正あり）** | **実測では欠番は `000012` の 1 件のみ**。私も独立に確認した（`migrations/*.up.sql` = 102 本、`000001`〜`000103` のうち欠けるのは `12` のみ、`.up`/`.down` の対も欠落 0）。指示書 §2.3-2 の「3 つ」は `D-708` の**予測**が統合で実現しなかったもの。製造は表を黙って合わせず、§1.2-1 で食い違いとして報告している。**これが正しい振る舞いである** |
| C-3 | 「欠番は無害」の併記 | **◎** | 素案に根拠 2 点（`schema_migrations` は現在版数 1 行 ／ `Up` は昇順に穴を素通り） |
| C-4 | 危険なのは別のこと（(a) 若い連番の後付け ／ (b) 版数リテラルのテスト） | **◎** | 素案に (a)(b) とも明記。(b) は `D-714` の実測エラー文つき、加えて版数直書きの 18 テストファイルを列挙し、恒久の規約として書き起こしている。`followup` の `migration-version-literals-in-tests`（「恒久の規約は未着手」）に応答している |

### 束 D — リポジトリの整理（チェックリスト §4）

| # | 見ること | 評価 | 所見 |
|---|---|---|---|
| D-1 | `README.md` / `README.txt` の二重解消・`M28-01` 案に従ったか | **○** | `M28-01` 案1（両方残して相互参照）を採用し、`README.md:7-9` と `README.txt:132-136` に相互参照。案2 を採らない理由（`dist/` は `.gitignore:92` 済みで移すと untracked 化）も明記されており、判断は妥当。→ ただし `README.txt` の新規記述が配布実態と食い違う（**高-5**） |
| D-2 | 消す変更をしていないか | **◎** | `git diff --name-status 231c07cc` に削除 0 件。`docs/` からのファイル消失も 0 件。挿入 2980 / 削除 1 で、その 1 行は `README.md` の「ライセンス: 未定」の差し替え（`E-225` の観点でも健全） |
| D-3 | 仕分け済みの置き場へ移したものの一覧 | **○** | 報告 §8.2「なし」。→ 記述が薄い（**中-4**） |
| D-4 | 開発者の手番として残したものが報告に在るか | **◎** | 報告 §9.1 に消す候補 6 件（対象・根拠・大きさ）、§9.2 に `docs/design/` 反映箇所 4 件、§9.3 に開発者手番 6 件 |

### §5 既存の破壊（非破壊性）

| # | 見ること | 評価 | 所見 |
|---|---|---|---|
| E-1 | 既存マイグレが 1 バイトも変わっていないか | **◎** | `git diff --stat 231c07cc` に `migrations/` が 1 行も現れない |
| E-2 | `M28-01` のリネームが巻き戻っていないか | **◎** | 追加行に現れる `combomgr` は `.gitignore` の 4 行のみで、いずれも**旧名のビルド成果物を ignore する**もの（`.gitignore:19-24`）。リネームの巻き戻しではない。実際にルート直下に 21MB の旧名 ELF が untracked かつ un-ignored で在ったのを見つけたのは良い実査である |
| E-3 | 既存検査のベースラインが動いていないか | **◎** | `git diff --name-status` に既存 `scripts/check-*.sh` が 1 本も現れない。ベースライン値は不変 |
| E-4 | `docs/` からファイルが消えていないか | **◎** | 削除 0 件 |

### §6 ドキュメント・進捗ログ

| # | 見ること | 評価 | 所見 |
|---|---|---|---|
| F-1 | 「確かめられなかったもの」が分けて書かれているか | **◎** | 報告 §6.3 と §11 に 8 件。とくに「`reuse lint` を走らせていない＝床であって証明ではない」と明記しており、断定していない。**チェックリスト §0.3-4 の「断定していたら欠陥」には当たらない**——一次情報へ到達できた範囲だけを根拠つきで断定しており、到達経路（不達＝`reuse.software` / 到達＝`raw.githubusercontent.com` 経由の `fsfe/reuse-website`）も示されている |
| F-2 | `docs/design/` の反映箇所が一覧になっているか | **◎** | 報告 §9.2。`DES-001` §5（MIT 確定という失効した記述）と `SUPP-001` §5.7（AGPL / CC BY-SA が禁止列に載っている）の 2 つを行番号つきで挙げ、CHANGE は起票していない（`D-293` 遵守） |
| F-3 | `progress-log.md` の `### M26-02` へ追記されているか | **×** | **未追記**。`check-progress-log-index.sh` が `m26-02` を赤にしている。→ **高-3** |

---

## 設計準拠性以外の指摘事項

### 【高-1】DENY グロブが直下限定で、`.gitignore` との深さが非対称（**本サブの主目的に直結**）

**根拠**: `scripts/public-snapshot-manifest.txt:28-32`（`DENY .env` / `DENY .env.*` / `DENY secrets/**` / `DENY work_html/**` / `DENY tmp/**`）、対して `.gitignore:70-75`（`.env` / `.env.*` / `secrets/`）。

グロブ規則は「`*` は `/` を跨がない」（`check-public-snapshot.sh:68-80`）であるため、上記 5 本はいずれも**リポジトリ直下にしか当たらない**。一方 `.gitignore` のこれらは**深さ無制限**である。私が実際の manifest を同じ判定器で引いた結果：

```
.env                       DENY  <- .env (line 28)
web/.env                   ALLOW <- web/** (line 55)      ★Vite の既定位置
web/.env.local             ALLOW <- web/** (line 55)
cmd/.env                   ALLOW <- cmd/** (line 53)
internal/secrets/token.txt ALLOW <- internal/** (line 54)
web/secrets/api.key        ALLOW <- web/** (line 55)
web/work_html/x.html       ALLOW <- web/** (line 55)      ★配布禁止 HTML(A3)
web/tmp/x.csv              ALLOW <- web/** (line 55)      ★検証用 CSV(A3)
docs/tmp/x.csv             ALLOW <- docs/** (line 96)
internal/private.key       ALLOW <- internal/** (line 54)
```

manifest の見出し（`:16-17`）は「母数は `git ls-files`。★これは『二重の防壁のうち外側』でしかない。**内側は本ファイルの DENY である**」と書いており、報告 §4.4 も「内側の防壁として二重に置いた」と述べている。**この主張は直下でしか成り立たない。** `git add -f web/.env` 1 回、あるいは `.gitignore` の 1 行が消えた時点で、内側の壁は無い。

なお `**/*.pem` / `**/*.pfx` / `**/id_rsa` は `**/` で書かれているため深さ無制限であり（私の実測で `server.pem` も `web/server.pem` も DENY）、**同じ manifest の中で書き方が割れている**。

**直し方**: `.env` → `**/.env`、`.env.*` → `**/.env.*`、`secrets/**` → `**/secrets/**`、`work_html/**` → `**/work_html/**`、`tmp/**` → `**/tmp/**`。あわせて `**/*.key` の追加を検討（`internal/private.key` が現状 ALLOW）。

### 【高-2】`check-migration-license.sh` の「静かな漏れ」検出が、既存コードで実際に使われている SQL 形を見逃す

**根拠**: `scripts/check-migration-license.sh:145`
```python
for m in re.finditer(r"\b(?:INSERT\s+INTO|UPDATE|DELETE\s+FROM)\s+([A-Za-z_][A-Za-z0-9_]*)", ...)
```

`INSERT ... INTO` の間に競合解決句が入る形を拾えない。私が実際に `migrations/` へ 1 本置いて確かめた結果（詳細は破壊確認 §2）：

| 書き方 | 結果 |
|---|---|
| `INSERT INTO moves (...)` | **検出（赤）** |
| `INSERT OR IGNORE INTO moves (...)` | **★見逃し（緑）** |
| `INSERT OR REPLACE INTO moves (...)` | **★見逃し（緑）** |
| `REPLACE INTO moves (...)` | **★見逃し（緑）** |
| `INSERT INTO main.moves (...)` | **★見逃し（緑）** |

**`INSERT OR IGNORE INTO` は仮定の形ではない**——`migrations/000007_seed_initial_tags_user1.up.sql` が実際にこの形を使っている。⇒ 次の seed 波が `INSERT OR IGNORE INTO moves` で書き、`_data_` を付け忘れたとき、**この検査は緑を返して層 A（AGPL）へ落とす**。これは指示書 §2.2-5・チェックリスト §2-7 が求めた検査の**本体**（同スクリプト:28 の逐語「これが本検査の本体である」）であり、開発者が「戻すのが難しい」と言った向きの事故そのものである。

スクリプト冒頭 `:44-45` の限界表記は「動的 SQL や `INSERT INTO` を伴わない経路は見ない」であり、`INSERT OR IGNORE INTO` がその「見ない」側だとは読めない。

**直し方**: `INSERT(?:\s+OR\s+\w+)?\s+INTO|REPLACE\s+INTO|UPDATE|DELETE\s+FROM` と、テーブル名側の `(?:[A-Za-z_]\w*\.)?` 修飾を許すこと。あわせて上記 4 形を self-test の陽性対照へ足すこと（**現在の self-test は `INSERT INTO` の 1 形しか試していない**＝`:286`／`:332`）。

### 【高-3】完了報告 §0 の完了条件 9「`progress-log.md` へ追記＝達成」が事実と食い違う（報告内でも自己矛盾）

**根拠**: `docs/progress/M26-02-completion-report.md` §0 の 9 行目（「**達成**」）。実測：

```
$ bash scripts/check-progress-log-index.sh
NG  作業 ID `m19-04` が docs/progress/progress-log.md に現れない(完了報告: docs/progress/M19-04-completion-report.md)
NG  作業 ID `m26-02` が docs/progress/progress-log.md に現れない(完了報告: docs/progress/M26-02-completion-report.md)
結果: 違反 2 件
```

`docs/progress/progress-log.md` の見出し一覧の末尾は `### M28-01`（`:5419`）で、`### M26-02` は存在しない。

同じ報告の §10.2 は「`check-progress-log-index.sh` **★違反 1 件（本サブ由来ではない）**」と書き、その注記で「**★`M26-02` 分の追記は Phase D で行う**」と述べている。⇒ **§0 の「達成」と §10.2 の「Phase D で行う」が矛盾している。** 追記を Phase D へ回すこと自体は `D-510` に沿っており妥当だが、そのとき完了条件 9 は「達成」ではなく「Phase D で実施」と書くべきである。件数も 1 ではなく 2 である。

（本プロジェクトの較正どおり「高」に置く。動作は正しく、テストも lint も型検査も緑であり、人が読む以外に見つける経路が無い型である。）

### 【高-4】`check-md-エンファシス` を「本サブ由来ではない」とした論証が失効している

**根拠**: 完了報告 §10.2 の 2 行目——「同検査の走査範囲は `docs/{process,handover,instructions,design,change-notes,progress}` の `.md` である。**本サブが変更した 17 ファイルのうち、この範囲に入るものは 0 件である**」「⇒ 検出器への入力は着手基点と byte-identical であり、件数も同一である」。

実測：

```
$ bash scripts/check-md-emphasis.sh
現在 1015 行 / ベースライン 436 行
NG  ベースラインから 579 行増加。

$ bash scripts/check-md-emphasis.sh --list | 寄与ファイル別
    104 docs/process/parallel-board.md
     46 docs/handover/retrospective-digest.md
     43 docs/progress/M26-02-completion-report.md   ← ★本サブの成果物
     ...
```

報告が書かれた時点（`98d410d6`）では「変更 17 ファイルに範囲内は 0 件」は真だったが、その直後の `83a94176` で**完了報告そのものがコミットされ、`docs/progress/` は走査範囲に入る**。現在は本サブの完了報告が単独で 43 行を寄与しており（全体の 3 番目に多い）、報告時の 981 行から 1015 行へ +34 行動いている。

⇒ 「ベースラインを動かさない」という判断自体は妥当（レーンごとに床を下げないという規約に沿う）だが、**その根拠として掲げた「本サブ由来ではない／入力が byte-identical」は成立していない**。少なくとも自分の完了報告 43 行分は本サブ由来であり、`**A（B）**は` 型の閉じない強調は書き手側で直せる。

### 【高-5】`README.txt` がリリース zip に同梱されないファイルを「同梱の」と書いている

**根拠**: `README.txt:126-128`
```
- ライセンスは三層構成です(...)。詳細は同梱の LICENSE と
  DATA-LICENSE.md、割当の正本は REUSE.toml を参照してください。
```

`README.txt` は**リリース zip に同梱される配布版 README** である（`manifest:65` の理由列／`README.md:200` の逐語）。ところが zip の中身は `.github/workflows/nightly-crossbuild.yml:105` の逐語で

```
#     tacpendium-windows-amd64.zip   (中身 = tacpendium.exe + README.txt)
```

であり、`LICENSE` / `DATA-LICENSE.md` / `REUSE.toml` は入らない。⇒ **利用者の手元に無いファイルを「同梱の」と指している。**

さらに、本サブでアプリ本体を `AGPL-3.0-or-later` にした以上、**バイナリ配布物にライセンス本文を添えること自体が要件側の話になる**（AGPL §4 の「give all recipients a copy of this License along with the Program」）。本サブは法務を断定しない方針で正しいが、**「zip の同梱物を増やす手順が必要である」ことは報告 §9.3 の開発者手番に挙がっていない**。

**直し方（どちらか）**: (a) 同梱物に `LICENSE` / `DATA-LICENSE.md` / `NOTICE` / `REUSE.toml` を足す手順を §9.3 と `nightly-crossbuild.yml:105-112` の注記へ足す、(b) それまでは `README.txt` の文面を「公開リポジトリの LICENSE / DATA-LICENSE.md を参照」に直す。

### 【高-6】`CONTRIBUTING.md` が、公開スナップショットに存在しないディレクトリを参照している

**根拠**: `CONTRIBUTING.md:56-57`
```
測定の手順書は `docs/seed-data/` と `character_data/chain-cancel-measurements.md`
にある。
```

`docs/seed-data/**` は `manifest:26` で **DENY**（開発者確定 2026-09-06）であり、私の生成実測でも 8 件すべてが落ちている。⇒ 公開スナップショットの `CONTRIBUTING.md` は、その生成物に存在しないディレクトリを「手順書の在り処」として案内する。

`CONTRIBUTING.md` は「将来この方針を開いたときのための規約」（`:13`）であり、外部の貢献者が最初に読む文書である。**生成物側の検査は本文の参照先を見ない**（`check-public-snapshot.sh:34-35` の逐語＝「中身は見ない」）ので、これは緑のまま出る型である。

**直し方**: `docs/seed-data/` への参照を落とすか、DENY を外すか、`character_data/` 側の測定記録だけを案内する。**★決めるのは `M26-03`（`A3`）の再判定と連動するため、本サブでの是正か持ち越しかは設計卓の判断でよい。**

### 【中-1】`REUSE.toml` が `precedence` を明示しておらず、既定 `closest` の意味を自前実装がモデル化していない

**根拠**: `REUSE.toml`（`precedence` の記述なし）／ `check-migration-license.sh:130-136` の `resolve()`。

仕様の逐語（私が一次情報から確認）：

> `closest`, the default value when `precedence` is not defined. This is an instruction to associate the Licensing Information **inside of the Covered Files** (or its adjacent `.license` file), if available. If no such Licensing Information is found, then the Licensing Information inside the table of the closest `REUSE.toml` that covers the File is associated.

⇒ 既定では **ファイル内の SPDX ヘッダが `REUSE.toml` の宣言に勝つ**。ところが `resolve()` はファイルの中身を一切見ず、常に `REUSE.toml` の最後に一致した表を採る。現在の `migrations/` には in-file タグが無いため**結果は一致している**が、これは偶然成立している一致であり、前提がどこにも書かれていない（`REUSE.toml` のコメント・報告 §6.2 とも `precedence` の値は列挙しているが、この帰結には触れていない）。

あわせて実測で 1 件見つけた——`docs/progress/M26-01-report.md:800` に、追跡ファイル中で唯一のコロン形 `` `SPDX-License-Identifier:` `` が地の文として在る。公式 `reuse lint` はこれを当該ファイルのタグとして拾いうる（後続が「` の形式を使い…」なので不正な SPDX 式になる）。報告 §11-1 が「公式ツールとの一致は確かめていない」と書いているのは誠実だが、**具体的な不一致候補が既に 1 件在る**ことは記録に値する。

**直し方（どちらか）**: (a) 各 `[[annotations]]` に `precedence = "override"` を付けて宣言を権威にする（自前実装のモデルと一致する）、(b) 「追跡ファイルに in-file SPDX タグが 0 件であること」を前提として明記し、`check-migration-license.sh` に対照として足す。

### 【中-2】層 C（MIT）の一括指定が、判定規則 `D-672` と衝突する実例を含む

**根拠**: `REUSE.toml:47`（`"docs/handover/**"` → MIT）。

`docs/handover/SF6セットプレイ-ドメイン知識集成.md`（165 行）は、`knockdown_advantage` の定義・窓方式の数式・チェーンキャンセルの実消費フレーム・キャラ別の技構成など、**`D-672` が「層 B ＝ SF6 の事実そのもの」と定義したものそのもの**である。同様に `docs/handover/M19-DESIGN-0{1,2,3,4,5,7,9}*.md` もフレームモデルを扱う。これらが一括で MIT（層 C）に落ちている。

`DATA-LICENSE.md` §4 は「データとしての正本は `character_data/`」と書いているが、上記は CSV 由来ではない独立の SF6 事実集成であり、**層 B の ShareAlike が及ばない**。

指示書 §7-1 の暫定案が `docs/handover/` を層 C としており、報告 §1.1-3 で「§7 暫定案どおり採用」の承認を得ているため**指示違反ではない**。また向きは MIT → CC BY-SA へ後から締め直せる側なので「中」とする。ただし**報告はこの衝突に一言も触れていない**（§3.5 では `human-notes/` の同名 2 ディレクトリの解釈だけを挙げている）。設計卓へ回すべき論点である。

### 【中-3】`make-public-snapshot.sh` が、判定器の実行エラーを握り潰す入口になっている

**根拠**: `scripts/make-public-snapshot.sh:92`（`bash scripts/check-public-snapshot.sh --list "$OUT" | ... > "$KEEP"`）と `scripts/check-public-snapshot.sh:295-298`：

```bash
if [ "$MODE" = "list" ] || [ "$MODE" = "list-excluded" ]; then
  run_check "$MODE" "$MANIFEST" "$LIST_TMP" | grep -v '^__STATS__'
  exit 0            # ★ run_check が exit 2 でも 0 を返す
fi
```

`--list` は判定器が実行エラー（manifest に ALLOW が 0 件、対象 0 件など）で `exit 2` を返しても **常に 0 を返す**。生成側の `|| { ... }` は発火せず、`KEEP` が空のまま `comm -23` が全ファイルを削除対象にする。**現状は後段の `--verify-output` が空ディレクトリで `exit 2` を返すため沈黙はしない**（生成物が空になるので気づける）が、生成の入口が検査の失敗を握り潰す構造は残っている。

**直し方**: `--list` / `--list-excluded` を `run_check ...; rc=${PIPESTATUS[0]}` で受けて `exit "$rc"`（違反時 1 は許容しつつ 2 は伝播）にするか、少なくとも `set -o pipefail` 下で `rc` を伝播させること。

### 【中-4】`archive-backlog-not-processed` / `repo-folder-structure-cleanup` への応答が薄い

**根拠**: 完了報告 §8.2（全文 2 行）「**なし。** 移動の必要が生じる対象を見つけなかった」。

`followup-backlog.md:1136-1137` は具体名を挙げている——(1) `docs/human-notes/codex/` という不自然な階層（かつ「`check-doc-inventory.sh` の射程外である」と明記）、(2) `scripts/archive-resolved.sh` は既に在り「道具が無いのではなく回す手番が無い」、(3) `docs/progress/` の滞留資料の仕分けが `m24-close-report` §3-3 の開発者手番として残っている。報告 §8.2 はこの 3 点のいずれにも触れていない。§9.1 の消す候補 6 件はすべてビルド成果物・使い捨て DB・ログであり、**フォルダ構成そのものの整理には応答していない**。

チェックリスト §9-3 が「アーカイブ送りの候補の網羅性」を軽微としているため「中」とする。ただし「見て何も無かった」のか「見ていない」のかが読み取れない書き方であり、**次の担当が「済んだ」と読む**（本プロジェクトで繰り返し起きている型）。

### 【中-5】`NOTICE` が未確認の URL を「対応ソースの入手先」として断定している

**根拠**: `NOTICE:39-42`
```
配布バイナリに対応するソースコードは、公開リポジトリの同じタグにある。
    リポジトリ: https://github.com/plexiblinp/tacpendium
```

公開リポジトリはまだ存在しない（指示書 §0.1・報告 §0 の「1 バイトも落としていない」）。到達確認もできない。報告 §11 の「確かめられなかったもの」8 件にこの URL は入っていない（入っているのは GitHub のライセンス**検出**が働くかどうか＝§11-3 であり、URL の実在は別件）。

**直し方**: §11 へ 1 行足すか、`NOTICE` 側を「公開リポジトリ（フェーズ5 で開設予定）」と条件付きにする。フェーズ5 の公開時に必ず突き合わせること。

### 【中-6】`docs/seed-data/**` へ自分の著作権表示を付けている

**根拠**: `REUSE.toml:62`（`"docs/seed-data/**"`）＋ `:65`（`SPDX-FileCopyrightText = "2026 plexiblinp and the Tacpendium contributors"`）。一方 `manifest:26` の理由列は同ディレクトリを「**公式の生フレーム値・元データ抜粋を含む**」としている。

⇒ 第三者素材を含みうると自分で判定した範囲に、自分の著作権表示と CC BY-SA を宣言している。**公開スナップショットには出ない**（DENY）ため実害は小さいが、宣言としては整合しない。`M26-03`（`A3`＝データ来歴の切り分け）で再判定する対象として記録しておくのが妥当。

### 【低-1】到達不能な死んだ分岐が残っている

**根拠**: `scripts/check-migration-license.sh:222`
```python
% (rel, ", ".join(game), fn.replace("_", "_data_", 1) if False else
   re.sub(r"^(\d{6})_", r"\1_data_", fn)))
```
`if False else` により前半は決して評価されない。`CLAUDE.md` §4「不要なコメントアウトコードは削除する」の趣旨に反する残骸。

### 【低-2】シンボリックリンクが選別も検査も素通りする

**根拠**: `scripts/check-public-snapshot.sh:164`（`find . -type f ...`）と `scripts/make-public-snapshot.sh:94`（同）。`git archive` はシンボリックリンクをそのまま出すが、`-type f` は拾わない。⇒ HAVE に入らないので**削除されず**、`--verify-output` の母数にも入らないので**検査もされない**。

現状の追跡シンボリックリンクは **0 件**（`git ls-files -s` の mode 120000 が 0）、`.gitattributes` に `export-ignore` も無いため実害は無い。将来 1 本入ったときに静かに抜ける形。`find \( -type f -o -type l \)` で足りる。

### 【低-3】報告の実測値 2 件が現状と食い違う

- 報告 §10.2「`check-artifact-integrity.sh` … 検査 **13 件**」→ 実測 **14 件**（新設 2 本を含む一覧を確認）。
- 報告 §10.2「`check-md-emphasis.sh` … 現在 981 行」→ 実測 **1015 行**（→ 高-4）。

### 【低-4】`000104` を「次に使える番号」と読まれうる例示が 4 か所に散っている

**根拠**: `REUSE.toml:56` ／ `CONTRIBUTING.md:68` ／ `check-migration-license.sh:389` ／ 完了報告 §7 の `SUPP-001` 素案。指示書 v1.0.2 ヘッダは「**次に払い出す番号は `000106`**」（`M28-02a` が `000104`＋`000105` を別ブランチで消費済み）。報告 §5.4・§12-3 では正しく注記しているが、**素案は `SUPP-001` §2.7 の本文になる**ため、例示番号は `000106` 以降か `NNNNNN` 形にするほうが安全。

### 【低-5】`.env.example` は DENY に当たる

**根拠**: `.gitignore:72` の `!.env.example`（追跡を意図した除外解除）に対し、`manifest:29` の `DENY .env.*` が `.env.example` にも当たる。現在 0 件のため実害なし。将来 `.env.example` を置いたら公開されない。

### 【低-6・参考／本サブ由来ではない】`README.md:13` の Go 版数が `go.mod` と食い違う

`README.md:13`「Go 1.22 以上(devContainer は 1.26.2)」に対し `go.mod:3` は `go 1.26.4`。**着手基点から在る記述であり、本サブは当該行を触っていない**（スコープ厳守の観点で本サブの欠陥として数えない）。README.md を触った機会に開発者へ挙げておく。

---

## 破壊確認の実施結果

**★チェックリスト §10-2 が必須とする 2 つを含め、4 つ実施した。すべて実行後に元へ戻し、`git status` が空であることを確認した（Git の書き込み操作は一切していない）。**

### 1. 破壊確認 1 — 生成物へ除外対象を紛れ込ませる（チェックリスト §7-1・最重要）

まず生成する。

```
$ bash scripts/make-public-snapshot.sh --out tmp/review-snapshot
# 公開スナップショットの生成

ref:  HEAD (83a94176)
out:  tmp/review-snapshot

1. 展開: 2721 件
2. 許可リスト適用: 残 2707 件 / 落とした 14 件

# 公開スナップショット 許可リストの検査
対象範囲: 生成物 `tmp/review-snapshot` の中身
母数 2707 件 / 公開 2707 件 / 除外 0 件
結果: 違反なし
結果: 生成と検査を通過した。
exit=0
```

**(a) 実在する DENY（`.devcontainer/**`）を 1 件だけ戻す:**

```
$ mkdir -p tmp/review-snapshot/.devcontainer
$ cp .devcontainer/devcontainer.json tmp/review-snapshot/.devcontainer/devcontainer.json
$ bash scripts/check-public-snapshot.sh --verify-output tmp/review-snapshot
NG  ★★生成物に除外対象が残っている: .devcontainer/devcontainer.json (DENY `.devcontainer/**` に当たる — anthropics/claude-code 由来が全権利留保のため公開保留(checklist A8 / P-47)。★当面は除外)
母数 2708 件 / 公開 2707 件 / 除外 1 件

結果: 違反 1 件
exit=1

$ rm -rf tmp/review-snapshot/.devcontainer
$ bash scripts/check-public-snapshot.sh --verify-output tmp/review-snapshot
母数 2707 件 / 公開 2707 件 / 除外 0 件
結果: 違反なし
```

**(b) ★現在 0 件にしか当たっていない「予防」の DENY が実際に効くか**（報告は 0 件の DENY を実走していない）:

```
$ echo dummy > tmp/review-snapshot/web/server.pem
$ bash scripts/check-public-snapshot.sh --verify-output tmp/review-snapshot
NG  ★★生成物に除外対象が残っている: web/server.pem (DENY `**/*.pem` に当たる — 鍵・証明書。★予防)
母数 2708 件 / 公開 2707 件 / 除外 1 件

結果: 違反 1 件
exit=1
```

**⇒ 陽性対照は実際に効いている。1 件混ざれば赤く、取り除けば緑に戻る。`**/` で書かれた予防 DENY も深さを問わず効く。**

**★ただし `**/` で書かれていない DENY は直下でしか効かない**（→ 高-1）。実際の manifest を同じグロブ実装で引いた結果:

```
.env                       DENY  <- .env (line 28)
web/.env                   ALLOW <- web/** (line 55)
web/.env.local             ALLOW <- web/** (line 55)
internal/secrets/token.txt ALLOW <- internal/** (line 54)
web/work_html/x.html       ALLOW <- web/** (line 55)
docs/tmp/x.csv             ALLOW <- docs/** (line 96)
server.pem                 DENY  <- **/*.pem (line 33)
web/server.pem             DENY  <- **/*.pem (line 33)
brand-new/x.md             未判定(赤)
```

### 2. 破壊確認 2 — `migrations/` へ命名規約にも宣言にも当てはまらないファイルを 1 本置く（チェックリスト §7-2）

```
$ cat > migrations/000199_seed_moves_review_probe.up.sql <<'SQL'
-- レビュー破壊確認用（review probe）。`_data_` を付け忘れたゲームデータ seed を模す。
INSERT INTO moves (character_id, move_code) VALUES (1, 'review_probe');
SQL
$ bash scripts/check-migration-license.sh
# migrations/ ライセンス宣言の検査
凍結表: 層 A 30 本 / 層 B 72 本

NG  ★静かな漏れ: migrations/000199_seed_moves_review_probe.up.sql はゲームデータ表(moves)へ書くのに `_data_` を持たず層 A(AGPL)へ落ちている。⇒ 層 B なら `000199_data_seed_moves_review_probe.up.sql` へ改名すること

結果: 違反 1 件
exit=1
```

**★同じ内容を、既存 `migrations/000007` が実際に使っている書き方に変えると素通りする:**

```
$ cat > migrations/000199_seed_moves_review_probe.up.sql <<'SQL'
-- レビュー破壊確認用（review probe）。000007 と同じ INSERT OR IGNORE 形を使う。
INSERT OR IGNORE INTO moves (character_id, move_code) VALUES (1, 'review_probe');
SQL
$ bash scripts/check-migration-license.sh
凍結表: 層 A 30 本 / 層 B 72 本

結果: 違反なし
exit=0
```

書き方の網羅（同じ 1 本を書き換えて計測）:

```
INSERT OR REPLACE INTO moves (a) VALUES (1);  -> exit=0 (★見逃し)
REPLACE INTO moves (a) VALUES (1);            -> exit=0 (★見逃し)
INSERT INTO main.moves (a) VALUES (1);        -> exit=0 (★見逃し)
INSERT INTO\n    moves (a) VALUES (1);        -> exit=1 (検出)
```

**⇒ 検査は「壊したら赤くなる」が、赤くなる壊し方が 1 種類しかない。** → 高-2。

**後始末**: `rm -f migrations/000199_seed_moves_review_probe.up.sql` を実行し、`ls migrations/*.sql | wc -l` = **204**（元どおり）、`git status --short` = **空**を確認した。

### 3. 破壊確認 3 — 許可リストに無い新しいファイル（チェックリスト §7-3）

```
$ mkdir -p tmp/review-snapshot/brand-new-dir && echo x > tmp/review-snapshot/brand-new-dir/leak.md
$ bash scripts/check-public-snapshot.sh --verify-output tmp/review-snapshot
NG  ★生成物に許可されていないファイルが在る: brand-new-dir/leak.md (ALLOW のどれにも当たらない)
母数 2708 件 / 公開 2707 件 / 除外 0 件

結果: 違反 1 件
exit=1
```

**⇒ denylist 的に動いていない。集合は閉じている。**

### 4. 追加確認 — REUSE 仕様の一次情報の独立照合と、宣言の順序の実効性（★設計卓からの依頼）

**(a) 一次情報へレビュー担当としても独立に到達した:**

```
$ curl -sS -o /tmp/spec33.md -w "%{http_code}\n" \
    https://raw.githubusercontent.com/fsfe/reuse-website/main/site/content/en/spec-3.3.md
200
```

該当箇所の逐語（`/tmp/spec33.md:299-302`）:

> If a Covered File is covered by multiple `[[annotations]]` tables in the same `REUSE.toml` file, then exclusively the last matching table in the file is used for that Covered File.

グロブ規則（`:253-255`）:

> - `*` matches everything except forward slashes (i.e. path separators).
> - `**` and `**/` match everything including forward slashes (i.e. path separators).

**⇒ 製造が報告 §6.2 に挙げた 11 項目を全数照合したが、逐語はすべて一致していた。「既定 → 層 C → 層 B → 層 A への差し戻し」という並べ方の解釈は正しい。** レビュー表 §5 のイメージ（既定を末尾）が誤りであるという指摘も正しい。

**(b) 解決結果が意図どおりかを実測:**

```
$ bash scripts/check-migration-license.sh --list | awk '{print $1}' | sort | uniq -c
     60 A        ← 30 本 × (up/down)
    144 B        ← 72 本 × (up/down)
```

主要パスの解決（同じ解決規則を独立に実装して照合）:

```
character_data/seed-progress.md   -> AGPL-3.0-or-later   （(3) を (5) が差し戻し。意図どおり）
character_data/ryu.csv            -> CC-BY-SA-4.0
CLAUDE.md                         -> MIT
scripts/check-public-snapshot.sh  -> MIT
docs/handover/docs-map.md         -> MIT
docs/instructions/templates/x.md  -> MIT
docs/design/requirements.md       -> AGPL-3.0-or-later
docs/instructions/M26-02-x.md     -> AGPL-3.0-or-later
web/src/App.tsx                   -> AGPL-3.0-or-later
docs/seed-data/README.md          -> CC-BY-SA-4.0
```

指示書 §7 の暫定案（層 A＝`docs/design` `docs/instructions`(テンプレ以外) `docs/progress` 等／層 C＝`CLAUDE.md` `scripts/` `docs/handover` `docs/process` テンプレ／層 B＝`docs/seed-data`）と一致する。

**(c) 「並べ替えると割当が変わる」ことの実証**（`REUSE.toml` は改変せず、メモリ上で表順を入れ替えて解決）:

```
現行順       : Counter({'CC-BY-SA-4.0': 144, 'AGPL-3.0-or-later': 60})
既定(**)を末尾へ : Counter({'AGPL-3.0-or-later': 204})
```

**⇒ 既定を末尾へ置くと 204 ファイル全部が AGPL へ倒れる。危険は実在する。** そして `check-migration-license.sh` の凍結表照合（同 `:201-206`）と self-test の陽性対照 3（「凍結表と宣言のずれ」）がこれを赤にする。**この設計は妥当である。**

### 後始末の確認

```
$ rm -rf tmp/review-snapshot
$ git status --short
（出力なし）
$ ls migrations/*.sql | wc -l
204
```

`tmp/` は `.gitignore` 済み。Git の書き込み操作（`add` / `commit` / `rm` / `reset`）は 1 回も実行していない。

---

## 推奨修正（優先度別）

### 重大（完了承認を妨げる）

**なし。** チェックリスト §8 の 9 項目をすべて当たったが、いずれにも該当しない——陽性対照は在り実走結果も在る（§8-1）／許可リスト方式である（§8-2）／割当はレビュー表と 1 対 1 で、表外の 23 本は止まって承認を取ったことが §1.1 に記録されている（§8-3）／`check-migration-license.sh` は self-test を持つ（§8-4）／公開していない（§8-5）／消していない（§8-6）／既存マイグレを改変していない（§8-7）／REUSE 構文は一次情報つきで、私も独立照合した（§8-8）／除外 3 群は在る（§8-9。深さの穴は高-1 として別に挙げた）。

### 高（M26 完了前に修正必須）

1. **高-1**: `manifest:28-32` の DENY 5 本を `**/` 付きへ直す（`.env` / `.env.*` / `secrets/**` / `work_html/**` / `tmp/**`）。あわせて `**/*.key` の追加を検討。**内側の壁が直下でしか立っていない。**
2. **高-2**: `check-migration-license.sh:145` の正規表現を `INSERT(?:\s+OR\s+\w+)?\s+INTO|REPLACE\s+INTO|UPDATE|DELETE\s+FROM` ＋ スキーマ修飾許容へ拡張し、**4 形すべてを self-test の陽性対照に足す**。`INSERT OR IGNORE INTO` は既存 `migrations/000007` が使う実在の形である。
3. **高-3**: 完了報告 §0 の完了条件 9 を「Phase D で実施」に直し、§10.2 の `check-progress-log-index.sh` を「違反 2 件（うち 1 件は本サブ）」に直す。Phase D で `progress-log.md` へ `### M26-02` を追記する。
4. **高-4**: 完了報告 §10.2 の `check-md-emphasis` の論証を実態に合わせて書き直す（本サブの完了報告が 43 行寄与している）。**ベースラインを動かさない判断自体は維持してよいが、根拠を差し替えること。** 併せて自分の完了報告の閉じない強調は直せる。
5. **高-5**: `README.txt:126-128` の「同梱の LICENSE / DATA-LICENSE.md / REUSE.toml」を実態に合わせる。同梱物を増やすなら `nightly-crossbuild.yml:105-112` の注記と報告 §9.3 に手番として明記する。
6. **高-6**: `CONTRIBUTING.md:56` の `docs/seed-data/` 参照を、DENY と整合する形に直す（または `M26-03` の再判定へ明示的に紐づける）。

### 中（M27 着手と並行可）

7. **中-1**: `REUSE.toml` の各 `[[annotations]]` に `precedence = "override"` を付ける（推奨）か、「in-file SPDX タグ 0 件」の前提を明記して検査に足す。`docs/progress/M26-01-report.md:800` の地の文タグを記録に残す。
8. **中-2**: `docs/handover/**` → MIT が SF6 事実文書（`SF6セットプレイ-ドメイン知識集成.md` / `M19-DESIGN-0*`）を層 C に落としている件を、設計卓の論点として報告へ足す。
9. **中-3**: `check-public-snapshot.sh:295-298` の `--list` / `--list-excluded` が `exit 2` を握り潰す点を直す。
10. **中-4**: 完了報告 §8.2 を、`followup-backlog.md:1136-1137` の具体名（`docs/human-notes/codex/` の階層 ／ `scripts/archive-resolved.sh` を回す手番 ／ `docs/progress/` の滞留資料）に個別に応答する形へ書き直す。「見て何も無かった」のか「見ていない」のかを判別できるようにする。
11. **中-5**: `NOTICE:41` の公開リポジトリ URL を報告 §11 の「確かめられなかったもの」へ足す。
12. **中-6**: `REUSE.toml:62` の `docs/seed-data/**` の著作権表示を `M26-03`（`A3`）の再判定対象として記録する。

### 低（将来対応）

13. **低-1**: `check-migration-license.sh:222` の `if False else` 死んだ分岐を削除。
14. **低-2**: `check-public-snapshot.sh:164` / `make-public-snapshot.sh:94` の `find -type f` を `\( -type f -o -type l \)` へ。
15. **低-3**: 完了報告 §10.2 の実測値 2 件（検査 13 件 → 14 件、md-emphasis 981 行 → 1015 行）を更新。
16. **低-4**: 例示連番 `000104` を `000106` 以降または `NNNNNN` へ（とくに `SUPP-001` §2.7 素案）。
17. **低-5**: `.env.example` が `DENY .env.*` に当たる件（現在 0 件）を、置くときに思い出せるよう manifest の理由列へ 1 語。
18. **低-6（参考・本サブ由来ではない）**: `README.md:13` の Go 版数が `go.mod:3`（`go 1.26.4`）と食い違う。

---

## 良かった点

1. **陽性対照が「置いた」で終わっていない。** `check-public-snapshot.sh` は陰性 2・陽性 5、`check-migration-license.sh` は陰性 2・陽性 4 を持ち、しかも**自己検査と本番が同じ検出器（`PY_CHECK`）を呼ぶ**形にしてある（片方だけの経路を作っていない）。私が独立に壊した 3 パターンすべてで赤くなった。`E-84` の要求に正面から応えている。
2. **生成と検査で判定器が 1 本しかない。** `make-public-snapshot.sh:92` が `check-public-snapshot.sh --list` を呼んで選別する形なので、「生成では通るが検査では落ちる／その逆」が構造的に起きない。
3. **`git -c core.quotePath=false ls-files -z` を選んだ理由が実測に基づく。** 実際に非 ASCII を含む追跡パスが在り（`git ls-files` の生出力に `"docs...` の C 引用が現れることを私も確認した）、`-z` なしなら素朴なパス突合が静かに壊る。「なぜそう書いたか」がコメントに残っている。
4. **REUSE 仕様の扱いが正確。** 到達経路（不達＝`reuse.software` ／ 到達＝`fsfe/reuse-website` の `spec-3.3.md`。旧 `fsfe/reuse-docs` は 2024-05-21 アーカイブ）を示し、11 項目を逐語で引いている。**私が独立に取得して全数照合したが、引用は一言一句一致していた。** かつ `reuse lint` を走らせていないことを「床であって証明ではない」と明示している。断定と未確認の線引きが正しい。
5. **並び順の危険を、コメントではなく機械で固定した。** 「最後に一致した表が勝つ」への依存は静かに壊れうるが、凍結表 102 本との 1 対 1 照合（`check-migration-license.sh:201-206`）がそれを赤にする。私の模擬でも「既定を末尾へ」で 204 ファイルが AGPL へ倒れることを確認しており、この危険は実在する。**コメントで注意を書くのではなく検査を置いたのが正しい。**
6. **指示書・チェックリストの失効 3 件を、黙って合わせずに報告した。** 欠番 3→1 ／ 層 A 28→27 ／ `character_data/` の列挙漏れ。私も独立実測して 3 件とも製造の実測が正しいことを確認した（欠番は `12` のみ、`.up`/`.down` の対も欠落 0、`character_data/` は 35 ファイル）。**「数が合っているか」を見ないと気づけない型を、実際に数えて見つけている。**
7. **表に無いものが出たときに止まった。** `000081`〜`000103` の 23 本と `docs/seed-data/` の公開可否で Plan Mode へ持ち込み、確定を §1.1 に記録している。指示書 §4-5 の停止条件どおり。
8. **`.gitignore` の穴を実査で見つけた。** ルート直下に 21MB・未 strip の旧名 ELF が untracked かつ un-ignored で残っており、`git add -A` 1 回でコミットされうる状態だった。許可リストの母数を `git ls-files` にした副産物として発見しており、**「母数を決める」作業が実査を伴っていた**ことの証拠になっている。
9. **`D-196` の境界を正確に守っている。** 削除 0 件、`docs/design/` 未編集、`.claude/` 未編集、`followup-backlog.md` 未編集、CHANGE・マイグレ連番の自採番なし。破壊確認に使った `000104` も「連番は消費していない」と明記している。
10. **報告に「反映は設計卓」「起票は設計卓」を毎回書いている。** 素案（§7）を `<!-- ここから素案 -->` で括って**そのまま貼れる形**にしてあるのも、受け手の手番を減らす良い作法である。

---

## 制約事項

- 本レビューはコード上で判定可能な範囲のみ対象。実際の動作確認・パフォーマンス・実機テストは別途実施が必要。
- **不明: `000081`〜`000103` の 23 本の層割当について「開発者が Plan Mode で承認した」ことは、完了報告 §1.1-2 の記述以外に検証手段が無い。** レビューからは「割当の内容が `D-672` の判定規則と整合し、実物の書き込み対象表とも一致していること」までしか確かめられない（その範囲では整合していた）。承認の事実そのものは開発者に確認いただきたい。
- **不明: `docs/seed-data/` を DENY にした確定（報告 §1.1-1）も同様に、リポジトリ上に一次記録が無い。** 指示書 §2.1-2 の「`docs` はアーカイブ含め全部公開する」（`D-637`）から外れる判断であるため、開発者の確認を推奨する。なお `M26-03`（`A3`）で再判定する前提が明記されており、安全側へ倒す判断自体は妥当と考える。
- `go test ./...` / `pnpm test` / `make e2e` は再実行していない（報告 §10.3 の実測を採った）。本サブは実行コードを 1 行も変えていないため（`git diff --name-status` で `internal/` `cmd/` `web/src/` `migrations/` が 0 件）、テスト結果は成果の証拠にならないという報告の整理に同意する。
- `check-enum-sync.sh` / `check-import-order.sh` / `check-browser-storage-keys.sh` / `check-stop-discipline.sh` は個別に再実行していない。ただし `check-artifact-integrity.sh` を 1 本目に回して 14 件すべての self-test が通ることと、既存 `scripts/check-*.sh` が 1 本も変更されていない（ベースライン不変）ことは確認した。
- 秘匿情報そのものの走査（gitleaks 等）は本レビューの射程外（`A9` / `M26-04`）。高-1 は「manifest の DENY が届く深さ」の指摘であって、実際に秘匿情報が混入しているという指摘ではない。

---

*以上、M26-02 レビュー報告書。*

---

## 取り込み結果（自動トリアージ・2026-09-06）

**製造担当（`/implement_plan_full` Phase C）による取り込みの記録。事後監査用。**

| 優先度 | 件数 | 採用 | 不採用 |
|---|---:|---:|---:|
| 重大 | 0 | — | — |
| **高** | **6** | **6** | **★0**（⇒ エスカレーション不要） |
| 中 | 6 | 6 | 0 |
| 低 | 6 | 5 | **1**（低-6） |
| **計** | **18** | **17** | **1** |

**再レビュー往復: 0 回**（重大 0 件のため差し戻しなし。停止規律の上限には達していない）。
**`followup-backlog.md` §J 停止時記録: 不要**（未解消の指摘が無いため）。

### 高（全件採用）

| # | 採否 | 対応 |
|---|---|---|
| 高-1 | **採用** | 予防 DENY 5 本を `**/` 付きへ。`**/*.key` を追加。**指摘の 10 パスを同じ判定器で引き直し 10/10 が DENY になることを実測** |
| 高-2 | **採用** | 正規表現を `INSERT OR <句> INTO` / `REPLACE INTO` / `UPDATE OR <句>` / スキーマ修飾 / 引用符つき表名へ拡張。**self-test の陽性対照を 1 形 → 6 形へ。指摘の 4 形を実物で置き直し 4/4 赤を実測** |
| 高-3 | **採用** | 完了報告 §0 の完了条件 9 を「Phase D で実施（未追記）」へ是正。§10.2 を「違反 2 件。うち 1 件は本サブ由来」へ是正。**Phase D で `progress-log.md` へ追記** |
| 高-4 | **採用** | §10.2 の論証を書き直し。内訳を実測（本サブ 58 行 ／ それ以外 972 行）。**58 行のうち 56 行が「フェンス内のグロブ」への偽陽性であることを機械判定で示し、真の閉じない強調 2 行は修正** |
| 高-5 | **採用** | `README.txt` を「公開リポジトリのタグにあります」＋「本 zip の中身は実行ファイルと README.txt だけ」へ。**同梱物を増やすかは完了報告 §9.3-7 の開発者手番として立てた** |
| 高-6 | **採用** | `CONTRIBUTING.md` の `docs/seed-data/` 参照を `character_data/` へ差し替え、公開物に含まれない理由と問い合わせ経路を明記 |

### 中（全件採用）

| # | 採否 | 対応 |
|---|---|---|
| 中-1 | **採用（案 a）** | 全 5 表へ `precedence = "override"`。**実測で「追跡ファイル中のコロン形 SPDX タグは 1 件のみ、それも本文中の説明」を確認**し、同 1 件を §11-1 の具体的な不一致候補として記録 |
| 中-2 | **採用（記録として）** | 完了報告 §3.6 を新設し設計卓の論点に立てた。**★割当は変えていない**——§7 暫定案は `docs/handover/` を層 C と明示して承認されており、外すのは承認の範囲を超える（指示書 §4-5） |
| 中-3 | **採用** | `rc=${PIPESTATUS[0]}` で実行エラー(2)だけを伝播。**壊れた manifest で `exit=2` を実測** |
| 中-4 | **採用** | 完了報告 §8.2 を書き直し、`followup-backlog.md:1136-1137` の具体名 3 件へ個別に応答 |
| 中-5 | **採用** | `NOTICE` §4 へ「★開設予定 ／ 到達確認はできていない」を明記。§11 へも 1 行 |
| 中-6 | **採用（記録として）** | `REUSE.toml` へ「著作権表示は暫定。`M26-03`（`A3`）で再判定」を注記。**割当自体は §7 暫定案の承認範囲なので変えていない** |

### 低（5 採用 / 1 不採用）

| # | 採否 | 対応・理由 |
|---|---|---|
| 低-1 | **採用** | `if False else` を削除 |
| 低-2 | **採用** | 検査・生成の両方を `\( -type f -o -type l \)` へ |
| 低-3 | **採用** | 検査 13→14 件を是正。**★あわせて「981」という数字自体が誤っていた**（`--list` のヘッダ 9 行を差し引いていなかった）ことが判明し、正しい値 **972** へ是正 |
| 低-4 | **採用** | 例示連番を `NNNNNN` 形へ（4 か所）。**破壊確認の実走ログは実際に打ったコマンドなので `000104` のまま残し、直後に「連番は消費していない／次は `000106`」を明記** |
| 低-5 | **採用** | manifest の理由列へ「`.env.example` にも当たる」を追記 |
| **低-6** | **★不採用（報告のみ）** | **理由: 本サブの射程外。** 当該行は着手基点から在り、本サブは触っていない（レビュー自身も「本サブの欠陥として数えない」としている）。**`README.md` を触った機会に便乗して直すと、本サブの差分に無関係な変更が混ざる。⇒ 完了報告 §9.3-8 に開発者の手番として記録した** |

### ★レビューの指摘のうち、一部を採らなかったもの（高-4 の補足）

高-4 は「**併せて自分の完了報告の閉じない強調は直せる**」と述べていた。**41 行のうち 39 行は直していない。**

- **実測（機械判定）: 41 行のうち 39 行はフェンス（\`\`\`）で囲まれたコードブロックの中に在るグロブ（`path = "**"` ／ `.claude/**` ／ `DENY .devcontainer/**` 等）であり、閉じない強調ではない。** 同検査は「CommonMark 実装で **1 行ずつ**描画」するため、**フェンスを認識できない。**
- **これらは指示書 §3-1 が要求した「許可リストの全文」と §3-3 が要求した「パス単位の宣言の全文」そのものである。⇒ 直すと逐語引用でなくなる。**
- **真の閉じない強調は 2 行だけであり、それは修正した**（`**「A」を…**` の形）。
- **★この偽陽性はベースライン `436` 自体にも含まれている可能性が高い。** 検査の所有者へ回す論点として完了報告 §10.2 に記録した。

*以上、取り込み結果。*
