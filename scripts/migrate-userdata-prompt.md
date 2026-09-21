# 検証環境のユーザーデータ移行プロンプト（旧系列 DB → 新 baseline）

> **これは何か**: ローカルの AI へそのまま渡すためのプロンプト 1 枚。
> **開発者の手元の検証用 DB** のユーザーデータを、`M33-02` が作った新 baseline
> （`migrations/000001`〜`000009`）で構築した空の DB へ移すための指示である。
>
> **★配布物ではない**（`scripts/release-targets.sh` の対象外）。devContainer にも関係しない。
> 出所は `M33-overview` §4.3（`D-790`）＝開発者の逐語「保全しない。コンボもタグも
> メチャクチャなテストデータなのでユーザーが困る。
> **ただし今後もテスト用にデータは使うので検証環境内でのデータ移行はしたい。**」
>
> **★★乾式検証は行っていない**（`M33-03`・開発者裁定 2026-09-19）。
> ⇒ 下の手順は `migrations/000001_init_schema.up.sql` の `REFERENCES` 実測と
> 新 baseline の実測（行数・`sqlite_sequence`）に基づくが、**実際に流したのは誰でもない。**
> 最初に流すときは新 baseline のコピーに対して行い、`foreign_key_check` を必ず確認すること。

---

## ローカル AI へ渡すプロンプト（ここから下をそのまま貼る）

SQLite の DB を 2 つ受け取る。**旧 DB**（旧マイグレーション系列で育った検証用データが入っている）と、
**新 DB**（新しい baseline マイグレーション 9 本を適用しただけの、ユーザーデータが 0 行の DB）。

旧 DB のユーザーデータだけを新 DB へ移すスクリプト（Python の `sqlite3` を使う）を書いて実行してほしい。
配布シードは新 DB が既に持っているので**運ばない**。

### 運ぶ表 / 運ばない表

**運ばない（配布シード。新 DB が既に持っている）**
`games` / `characters` / `moves` / `move_commands` / `move_derivations`

**運ぶ（新 DB では 0 行。12 表）**
`setups` / `setup_steps` / `combos` / `combo_steps` / `combo_tags` / `combo_setups` /
`combo_setup_results` / `combo_oki_options` / `combo_punishes` / `combo_punish_curations` /
`combo_punish_prunings` / `combo_punish_starters`

**運ぶ（seed 行と利用者行が混ざる。4 表）**
`users` / `tags` / `presets` / `preset_aliases`
→ **新 DB に既にある行が「seed 行」である。** 旧 DB の行のうち、新 DB に同じ主キーで
存在するものは飛ばし、存在しないものだけを入れる（`INSERT OR IGNORE` ではなく、
飛ばした件数を数えて報告してほしい。黙って消えると気づけない）。

**★★飛ばす前に「中身が違うか」を見てほしい。** 主キーが同じでも、利用者が seed 行を
**編集している**ことがある（例: 組込プリセットの別名を書き換えた）。⇒ 主キーだけで
飛ばすと、その編集が黙って失われる。
- 主キーが一致し、**かつ全列が新 DB と同一**の行 … seed 行なので飛ばす（件数だけ報告）
- 主キーが一致するが**列の値が違う**行 … **1 行ずつ列挙して報告**し、どうするかは
  こちらで決める（自動で上書きも自動で破棄もしないこと）
★`preset_aliases` は 7635 行あるので、件数だけの報告では紛れて見えない。

### ★外してはいけない 4 点

これが欠けると必ず失敗する。「表ごとに `INSERT` する」だけの手順にしないこと。

**1. 投入順（外部キーの依存順）**

```
users
  → tags, presets, setups
    → combos, preset_aliases
      → combo_steps, setup_steps, combo_tags, combo_setups,
        combo_oki_options, combo_punishes, combo_punish_curations,
        combo_punish_prunings, combo_punish_starters
        → combo_setup_results
```

- `combo_setup_results` は `(combo_id, setup_id)` の**複合外部キー**で `combo_setups` を参照する。
  ⇒ `combo_setups` より必ず後。
- `presets` は `users` より**後**。（新 baseline の投入順は `presets`→`users` だが、
  組込プリセットが `user_id IS NULL` なので成立していただけである。
  利用者が足した presets は `user_id` を持つので順序が逆になる。）

**2. `combos` の自己参照は 2 パスで入れる**

`combos` には自分自身を指す列が 2 本ある（`materialized_from_combo_id` と
`superseded_by_combo_id`）。参照先が後から入る行を指すことがあるので、
**1 回目はその 2 列を `NULL` で入れ、全行入れ終わってから `UPDATE` で埋める。**
（新 baseline はこの形を `moves.original_move_id` の 514 行で既に使っている。）

**3. `sqlite_sequence` を運ぶ**

行を入れるだけでは `sqlite_sequence` は再現されない。
**削除された行の id が欠番として残っている表では、id を明示投入しても追随しない。**
（旧 DB で `seq > max(id)` になっている表がそれである。）

⇒ 手順:
1. 旧 DB で `SELECT name, seq FROM sqlite_sequence` を取る。
2. 全部入れ終わったあと、新 DB 側で各表の `seq` が旧 DB の値以上になっているか見る。
3. 足りない表は `UPDATE sqlite_sequence SET seq = ? WHERE name = ?` で明示的に合わせる
   （無い表は `INSERT INTO sqlite_sequence (name, seq) VALUES (?, ?)`）。

参考（新 baseline を適用しただけの DB の実測値）:
`characters` 34 / `games` 1 / `moves` 3236 / `preset_aliases` 7814 / `presets` 5 /
`tags` 3 / `users` 1 / **`combos` 0** / **`combo_oki_options` 0**
★`combos` と `combo_oki_options` は 0 行なのに `sqlite_sequence` に行を持つ。これは意図である。

**4. システム表のうち運ぶのは `sqlite_sequence` だけ。`schema_migrations` は運ばない**

**★★`schema_migrations` を運ぶと新 DB は起動できなくなる。**
新 DB は新系列 9 本を適用済みなので `version = 9` が入っている。そこへ旧 DB の値
（旧系列の終端）を書くと、次の起動で `no migration found for version <旧の終端>` で
abort し、`dirty` フラグが立つ。⇒ 手で直すまで起動できない。

**⇒ 運ぶシステム表は `sqlite_sequence` だけである。** ほかのシステム表
（`sqlite_master` / `sqlite_schema` / `schema_migrations`）には触らないこと。

**5. 最後に `PRAGMA foreign_key_check` が 0 件であることを確認する**

0 件でなければ移行は失敗している。**件数だけでなく、返ってきた行をそのまま出力してほしい。**
あわせて、運んだ 16 表それぞれの行数を旧 DB と新 DB で並べて出してほしい
（「移した」ではなく「何行移したか」で報告する）。

**★`PRAGMA foreign_keys` を明示的に設定してほしい。** Python の `sqlite3` は既定で
**外部キーを強制しない**（`foreign_keys = OFF`）。⇒ 既定のままだと投入順を間違えても
その場ではエラーにならず、最後の `foreign_key_check` まで気づけない。
- 投入中は `PRAGMA foreign_keys = ON` にして、**順序の誤りをその行で止める**のが望ましい。
- `combos` の自己参照 2 パスはこの設定でも通る（1 回目は NULL を入れるため）。
- どちらの設定で流したかを報告に書いてほしい。

### 置き場と後片付け

- dump や作業用 DB は**リポジトリの `tmp/` の下に置く**（`.gitignore` の `/tmp/` で無視される）。
  **★`docs/` の下へは置かないこと** — `docs` はアーカイブごと公開される。
  **★`tmp/` に `.go` ファイルを作らないこと** — `go build ./...` / `go vet ./...` が拾って壊れる。
- 旧 DB は**読むだけ**。書き換えないこと。
- 失敗したら新 DB を捨てて、新 baseline から作り直せばよい（`go run ./cmd/tacpendium` を
  新しい DB パスに向けると 9 本が適用される）。

---

## 開発者向けの補足（プロンプトの外）

- **新 DB の作り方**: `scripts/dev-throwaway-db.sh <名前>.db --fresh` で使い捨て DB を作ると
  新 baseline 9 本が適用される（`*.db` は `.gitignore` 済み）。
- **旧系列の DB を作りたいとき**: 旧 111 本は `git show b5cd716^:migrations/<名>` から取れる
  （`b5cd716` が新系列へ置き換えたコミット）。
- **実データでの実行は開発者の手番**（指示書 `M33-03` §7-3）。製造は手元 DB に触っていない。
- **同一性検証とは別物**: `M33-02` の比較 4 面はスキーマとシードの一致を見るものであり、
  **ユーザーデータの往復は 1 度も見ていない**（`M33-overview` §4.3 の警告）。

---

## 【2026-09-19・M39-01 追記】新系列を*書き換えた*ときの検証 DB の直し方

> **★これは上の「旧系列 → 新 baseline」とは別の場面である。** 上は *DB を作り直して*
> ユーザーデータを運ぶ手順。こちらは **既に新系列を適用済みの DB** を、
> **書き換えられた新系列の内容へ追いつかせる**手順である。

### なぜ要るか

`M39-01`（`D-910` のカーブアウト）は `migrations/000004_data_seed_moves.up.sql` の
`startup_basis` を 132 セル書き換えた。
**`golang-migrate` はファイルのチェックサムを取らず、`schema_migrations` に版数を記録するだけである。**
⇒ 既に `version=9` を持つ DB では、書き換えた `000001`〜`000009` は**二度と走らない**。
**★開発者の検証 DB だけが是正前の 132 行を持ったまま取り残される。エラーは出ない。**

### 手順（**★走らせるのは開発者である**）

**1. バックアップを取る。**

**2. 是正前の件数を確かめる**（132 でなければ止めて報告すること）。

```sql
SELECT count(*) FROM moves WHERE startup IS NULL AND startup_basis <> 'unknown';
-- 期待: 132（内訳: category='system' 126 / 'target_combo' 4 / 'special' 2、元値はすべて 'standalone'）
```

**3. 当てる。**

```sql
UPDATE moves SET startup_basis = 'unknown'
 WHERE startup IS NULL AND startup_basis <> 'unknown';
-- 期待: 132 行に当たる
```

**4. 確かめる。**

```sql
SELECT count(*) FROM moves WHERE startup IS NULL AND startup_basis <> 'unknown';  -- 期待: 0
PRAGMA foreign_key_check;                                                          -- 期待: 0 行
```

### ★これで「作り直した DB」と同じになることの乾式検証（`M39-01` で実施済み）

**新系列(是正前)を適用した DB へ利用者データを入れ、上の `UPDATE` を当てたもの**と、
**是正済みの新系列で新規構築した DB** の `moves` 全行ハッシュが**一致**した
（どちらも `2b2b6a7e4664de89…` / 3057 行）。利用者データは無傷、`foreign_key_check` は 0 行。

**⇒ この場面では DB の作り直しもユーザーデータの運搬も要らない。** 上の「旧系列 → 新 baseline」
プロンプトを使う必要はない（`moves` は元々「運ばない表」であり、差分は `moves` の中だけに閉じている）。

**★作り直したい場合は上のプロンプトがそのまま使える** — 運ぶ表・運ばない表の分類は
本件で 1 つも変わらない。「旧 DB」の役を、いま持っている新系列の DB が務めるだけである。

### ★次に新系列を書き換えたときも同じ形になるとは限らない

**本件の差分が `UPDATE` 1 本で閉じたのは、差分が `moves` の 1 列だけだったからである。**
行の増減・`id` の変化・スキーマの変更を含む書き換えなら、この近道は成立しない。
⇒ **そのときは作り直し（上のプロンプト）へ倒すこと。**
**★`D-910` のカーブアウトの窓は公開で閉じる。**
⇒ 公開後は新系列を書き換えられないため、是正は新しい連番のマイグレで行う（`000010` は未使用のまま予約されている）。

---

## 【2026-09-19・M39-02 追記】ラッシュ版生成で*実行時に*増えた違反行の数え方と直し方

> **★これは上の「M39-01 追記」とは別の場面である。** 上は **マイグレの中身を書き換えた**ことで
> 検証 DB が取り残される話。こちらは **アプリを操作して作った行**が不変条件を破っている話である。
> ⇒ **上の手順を当てた *後* でも、こちらは残りうる。**

### なぜ要るか

`M39-02` 以前のバイナリは、ラッシュ版の `startup_basis` に `'through'` を**リテラルで**
INSERT しつつ `startup` を元技からコピーしていた。
⇒ **`startup` を持たない元技からラッシュ版を作ると `startup NULL` ＋ `startup_basis='through'` の行ができる。**
これは `D-187` の不変条件（`startup` が NULL なら `startup_basis` は `'unknown'`）
の違反である。

**★HEAD に該当する元技が 3 件実在する**（実測 2026-09-19。`category='unique'` ∧ `is_aerial=0`
∧ `startup IS NULL`）**＝`rashid/run` ／ `alex/prowler_stance` ／ `dee_jay/speedy_maracas`。**
⇒ 仮説ではない。画面の「ラッシュ版を作る」を押せば到達する。

**★マイグレでは捕まらない。** 違反は**実行時に増える**ため、適用済みのマイグレを
何度見ても現れない。**★件数のハードガードも置けない**——ラッシュ版を 1 つ作った DB では
違反が 1 以上になり、起動時の `migration.Run` が中断して**アプリが起動しなくなる**
（`SUPP-001` §5.5 規約 (24)-4）。

**★是正済みのバイナリでは新たに増えない。** 以下は**過去に作ってしまった行**の後始末である。

### 手順（**★走らせるのは開発者である**）

**1. バックアップを取る。**

**2. 数える。**

```sql
SELECT count(*) FROM moves WHERE startup IS NULL AND startup_basis <> 'unknown';
-- 期待: 0（M39-01 の手順を当てた後、かつラッシュ版を 1 つも作っていなければ 0）

SELECT category, startup_basis, count(*) FROM moves
 WHERE startup IS NULL AND startup_basis <> 'unknown'
 GROUP BY 1, 2;
-- ★ここに category='rush_variant' が出たら、それが本経路で増えた分である。
--   それ以外の category が出た場合は M39-01 の手順が未適用である可能性が高い（上の節へ戻る）。
```

**3. 当てる**（`M39-01` と同じ式である。由来を問わず不変条件へ揃える）。

```sql
UPDATE moves SET startup_basis = 'unknown'
 WHERE startup IS NULL AND startup_basis <> 'unknown';
-- 期待: 2 で数えた件数に当たる
```

**4. 確かめる。**

```sql
SELECT count(*) FROM moves WHERE startup IS NULL AND startup_basis <> 'unknown';  -- 期待: 0
PRAGMA foreign_key_check;                                                          -- 期待: 0 行
```

> **★`startup` 側は直さない。** 直すのは `startup_basis` だけである。
> ⇒ 元技が発生フレームを持たない以上、ラッシュ版も持たない。**`unknown` が正しい状態**であり、
> 「埋めるべき穴」ではない（`M39-overview` §4.1）。

### ★乾式検証（`M39-02` で実施済み）

**製造は開発者の検証 DB を触っていない。** 使い捨て DB（`tmp/m39-02/repro.db`）を
**是正前のバイナリ**で作り、実 API（`POST /api/moves/1364/rush-variant`）で違反行を 1 件作ったうえで、
上の 2 → 3 → 4 をそのまま流した。結果は完了報告 `docs/progress/M39-02-completion-report.md` の
段 4 に出力ごと貼ってある。

### ★この手順が要らなくなる条件

**是正済みのバイナリ（`M39-02` 以降）でしかラッシュ版を作っていない DB には、本経路由来の違反は 1 行も無い。**
⇒ 一度 0 にしたら、以後は数え直さなくてよい。
**★ただし「0 であること」を起動時に強制してはならない**（規約 (24)-4。上記）。
歯止めは常設テスト側に在る——`internal/repository/move/rush_runtime_invariant_test.go`。
