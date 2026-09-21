# M23-RESEARCH-01 G-4 / H-5 SQL 追補レポート

| 項目 | 内容 |
|------|------|
| 位置づけ | **`docs/progress/M23-RESEARCH-01-report.md` の追補**。同報告が「dev DB がクラウド実行環境に構造的に不在」として**未実査で残した 2 件**（**軸 G-4 ／ 軸 H-5**）を、開発者がローカル環境で実測して埋めたもの |
| 実施 | 開発者（ローカル環境）/ 2026-08-20 |
| 受理 | **設計卓が 2026-08-20 に受理**（**D-488**）。**⇒ `M23-RESEARCH-01` の未実査は 0 件になった** |
| 配置 | **本ファイルは設計卓が `docs/progress/` へ配置した**（原本は作業ツリーの `tmp/` にあり、コミット対象外だった）。**§5「変更範囲」の `tmp/...` の記述は原本作成時点のものである** |
| 最大の含意 | **★H-5 の完全一致 3 組（`6->7` / `5->8` / `33->34`）は、`M23-overview` §4.6 の論点 5〔削除済み行と再登録の衝突〕が机上ではなく実データで成立していることの証拠である。** **⇒ `M23-05` の起動条件を満たした** |

---


## 結論サマリ

| 項目 | 実測結果 |
|---|---:|
| G-4: `combos.deleted_at IS NOT NULL` | **7 行**（ID: `1, 2, 3, 5, 6, 33, 50`） |
| G-4: `superseded_by_combo_id IS NOT NULL` により `PUT` 由来と確定できる削除済み行 | **0 行** |
| G-4: 旧方式の「同一キャラクター・削除時刻と作成時刻が同じ秒」による `PUT` 由来推定 | **0 行** |
| G-4: 削除済みかつ `materialized_from_combo_id IS NOT NULL` | **0 行** |
| H-5: 削除済み行と生存行で、レシピ以外の重複判定キーが一致する組 | **8 組** |
| H-5: `CalcRecipeHash` 相当を含む完全な重複判定キーが一致する組 | **3 組** |

H-5 の完全一致 3 組は、`deleted_id -> alive_id` で **`6 -> 7`、`5 -> 8`、`33 -> 34`** だった。

## 1. 基準点・対象範囲

| 項目 | 値 |
|---|---|
| source baseline | `42a1d29a`（2026-08-20 06:49:14 UTC） |
| dev DB | `/home/node/.local/share/combomgr/combomgr.db` |
| DB 観測時刻 | G-4 / 集約値: **2026-08-20 14:01:17 UTC**、H-5 SHA-256 確認: **2026-08-20 14:02:08 UTC** |
| SQLite | `3.40.1` |
| migration | `schema_migrations.version = 78`、`dirty = 0` |
| 接続方式 | Python 標準 `sqlite3`、URI `mode=ro` |
| 数えた範囲 | dev DB の `combos` / `combo_steps`。G-4 は削除済み `combos`、H-5 は削除済み published 行と生存 published 行の組 |

本追補の source baseline は、元の調査レポート作成後に `M23-01` が実装された状態である。したがって `combos.superseded_by_combo_id` が存在し、DB も migration 78 適用済みである。G-4 では、現在の列による確定件数と、元レポートに記載された時刻近接による推定件数を分けて数えた。

## 2. 実行方法

`sqlite3` CLI は環境に存在しなかったため、次の read-only 接続を使った。DB を変更する SQL は実行していない。

```python
import sqlite3

db_path = "/home/node/.local/share/combomgr/combomgr.db"
conn = sqlite3.connect(f"file:{db_path}?mode=ro", uri=True)
rows = conn.execute(SQL).fetchall()
conn.close()
```

H-5 の SHA-256 確認だけは、アプリの `CalcRecipeHash` と同じ SHA-256 hex を SELECT 内で使うため、接続ローカルの決定論的関数を登録した。DB への書き込みは発生しない。

```python
import hashlib

conn.create_function(
    "sha256_hex",
    1,
    lambda value: hashlib.sha256(value.encode()).hexdigest(),
    deterministic=True,
)
```

## 3. G-4: 削除済み行と `PUT` 由来行

### 3.1 実行 SQL

削除済み行の総数:

```sql
SELECT COUNT(*) AS deleted_rows
FROM combos
WHERE deleted_at IS NOT NULL;
```

migration 78 以後の実装で、`PUT` 由来と列から確定できる行:

```sql
SELECT COUNT(*) AS put_derived_marked
FROM combos
WHERE deleted_at IS NOT NULL
  AND superseded_by_combo_id IS NOT NULL;
```

元レポートで用意されていた、列追加前の行にも適用できる推定 SQL:

```sql
SELECT COUNT(*) AS put_derived_estimate
FROM combos old
WHERE old.deleted_at IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM combos new
    WHERE new.deleted_at IS NULL
      AND new.character_id = old.character_id
      AND strftime('%Y-%m-%d %H:%M:%S', new.created_at)
          = strftime('%Y-%m-%d %H:%M:%S', old.deleted_at)
  );
```

`materialized_from_combo_id` 候補の確認:

```sql
SELECT COUNT(*) AS deleted_materialized
FROM combos
WHERE deleted_at IS NOT NULL
  AND materialized_from_combo_id IS NOT NULL;
```

削除済み行の内訳確認:

```sql
SELECT
  old.id AS old_id,
  old.character_id,
  old.deleted_at,
  old.version,
  old.materialized_from_combo_id,
  old.superseded_by_combo_id,
  (
    SELECT group_concat(new.id)
    FROM combos new
    WHERE new.deleted_at IS NULL
      AND new.character_id = old.character_id
      AND strftime('%Y-%m-%d %H:%M:%S', new.created_at)
          = strftime('%Y-%m-%d %H:%M:%S', old.deleted_at)
  ) AS candidate_new_ids
FROM combos old
WHERE old.deleted_at IS NOT NULL
ORDER BY old.deleted_at DESC, old.id DESC;
```

### 3.2 実測値

| 値 | 件数 |
|---|---:|
| 削除済み行 | **7** |
| `superseded_by_combo_id` で確定できる `PUT` 由来行 | **0** |
| 時刻近接条件で推定された `PUT` 由来行 | **0** |
| 削除済み materialize 行 | **0** |

削除済み ID は `1, 2, 3, 5, 6, 33, 50`。7 行すべてで `superseded_by_combo_id` と `materialized_from_combo_id` は NULL、時刻近接条件に合う生存行も 0 件だった。

### 3.3 推定の範囲

- `superseded_by_combo_id IS NOT NULL` は migration 78 以後の `PUT` 経路が付ける印である。migration 78 より前に作られた旧行には遡及して値が入らない。
- 時刻近接 SQL は「同一キャラクターで、旧行の `deleted_at` と生存行の `created_at` が同じ秒」を推定条件とする。結果は 0 件だった。
- したがって実測から確定できるのは、**現在印が付いた `PUT` 由来行が 0 行であり、旧方式の推定条件に合う行も 0 行だった**という事実である。印の無い過去行すべてが手動削除由来であることまでは、この DB の列から確定できない。

## 4. H-5: 削除済み行と生存行の重複判定キー

### 4.1 レシピ正規化の事前確認

```sql
SELECT modifiers, COUNT(*)
FROM combo_steps
WHERE modifiers IS NOT NULL
GROUP BY modifiers
ORDER BY modifiers;
```

実測結果:

| `modifiers` | 行数 |
|---|---:|
| `{"flags":["od_lm"]}` | 2 |
| `{"type":"parry_drive_rush"}` | 2 |

`combo_steps` は 238 行、`modifiers IS NOT NULL` は 4 行、`json_valid(modifiers) = 0` は 0 行だった。非 NULL の 2 種はどちらも `canonicalModifiersJSON` の出力と同じ形であり、`flags` は 1 要素なのでソート前後で変化しない。この DB では、保存済み `modifiers` を用いて作るレシピ入力が `CalcRecipeHash` の正規化後入力と一致する。

### 4.2 レシピを除くキー一致の SQL

```sql
SELECT COUNT(*) AS colliding_pairs
FROM combos d
JOIN combos a
  ON  a.deleted_at IS NULL
  AND a.is_draft = 0
  AND a.character_id = d.character_id
  AND a.starter_move_id IS d.starter_move_id
  AND a.position IS d.position
  AND a.opponent_stance IS d.opponent_stance
  AND a.hit_type IS d.hit_type
  AND a.opponent_size IS d.opponent_size
WHERE d.deleted_at IS NOT NULL
  AND d.is_draft = 0;
```

結果は **8 組**:

```text
6->7, 5->8, 5->9, 33->34, 5->42, 5->43, 5->47, 5->49
```

### 4.3 `CalcRecipeHash` 相当を含む完全一致の SQL

次の SELECT は、`CalcRecipeHash` と同じ `<move_id_or_null>:<canonical modifiers JSON>` を step order 順に改行連結し、接続ローカルの `sha256_hex` で SHA-256 hex を得る。

```sql
WITH recipe_input AS (
  SELECT
    combo_id,
    group_concat(
      COALESCE(CAST(move_id AS TEXT), 'null') || ':' ||
      COALESCE(modifiers, 'null'),
      char(10)
    ) AS input
  FROM (
    SELECT combo_id, step_order, move_id, modifiers
    FROM combo_steps
    ORDER BY combo_id, step_order
  )
  GROUP BY combo_id
),
recipe AS (
  SELECT
    c.id AS combo_id,
    sha256_hex(COALESCE(r.input, '')) AS recipe_hash
  FROM combos c
  LEFT JOIN recipe_input r ON r.combo_id = c.id
),
pairs AS (
  SELECT d.id AS deleted_id, a.id AS alive_id
  FROM combos d
  JOIN combos a
    ON  a.deleted_at IS NULL
    AND a.is_draft = 0
    AND a.character_id = d.character_id
    AND a.starter_move_id IS d.starter_move_id
    AND a.position IS d.position
    AND a.opponent_stance IS d.opponent_stance
    AND a.hit_type IS d.hit_type
    AND a.opponent_size IS d.opponent_size
  JOIN recipe rd ON rd.combo_id = d.id
  JOIN recipe ra
    ON ra.combo_id = a.id
   AND ra.recipe_hash = rd.recipe_hash
  WHERE d.deleted_at IS NOT NULL
    AND d.is_draft = 0
)
SELECT
  COUNT(*) AS colliding_full_duplicate_key_pairs,
  COUNT(DISTINCT deleted_id) AS deleted_rows_in_collision,
  COUNT(DISTINCT alive_id) AS alive_rows_in_collision,
  group_concat(deleted_id || '->' || alive_id) AS pair_ids
FROM pairs;
```

実測結果:

| 値 | 結果 |
|---|---:|
| 完全な重複判定キーが一致する組 | **3 組** |
| 関係する削除済み行 | **3 行** |
| 関係する生存行 | **3 行** |
| 組 | **`6->7, 5->8, 33->34`** |

`IS` を使った nullable 列の比較は、`FindActiveByDuplicateKey` が nil のとき `col IS NULL` を生成する意味論に合わせた。published 条件 `is_draft = 0` も同メソッドと一致する。

## 5. 変更範囲

- 作成: `tmp/M23-RESEARCH-01-G4-H5-SQL-report.md`
- 既存レポート、ソース、マイグレーション、seed、テスト、設計書、progress-log: **変更なし**
- Git 書き込み操作: **なし**

