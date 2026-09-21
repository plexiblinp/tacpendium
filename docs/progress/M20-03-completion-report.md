# M20-03 完了報告: `preset_aliases` の一意制約（`character_id` の非正規化 ＋ UNIQUE 2 本）

| 項目 | 内容 |
|------|------|
| 文書ID | M20-03-COMPLETION-REPORT |
| 対象指示書 | `docs/instructions/M20-03-alias-uniqueness-constraint.md` v1.0.0 |
| 対の CHANGE | `docs/change-notes/CHANGE-100-notification.md` |
| 実施日 | 2026-08-13 |
| 実施者 | 製造担当（Claude Code） |
| 消費したマイグレ連番 | **`000074` / `000075`** |

---

## 1. §3.3 の 7 項目の実査結果

**★見込みと食い違った項目は #5 の 1 件である。**

| # | 確認事項 | 実査で何が見えたか | 見込みとの一致 |
|---|---|---|---|
| **1** | `ls migrations/` の disk 末尾 | **末尾は `000073`（`000073_m20_seed_aliases_srk`）。次の空きは `000074`** | **一致**（ボードの記録どおり）。自採番・再請求とも不要 |
| **2** | 制約違反が実データで 0 件か | **下記 §1.1 の表のとおり全 0 件** | **一致**（停止条件 1 は不発動） |
| **3** | `preset_aliases` の参照側 | **FK・ビュー・トリガーは 0 件。**`REFERENCES preset_aliases` は全 SQL で 0 件、`CREATE TRIGGER` / `CREATE VIEW` はリポジトリ全体で 0 本。参照は読み取り JOIN のみ（`internal/repository/move/queries.go` `rush.go` ／ `internal/repository/punish/queries.go` ／ `internal/repository/preset/queries.go`） | 見込みなし（材料の収集項目） |
| **4** | `character_id` を `NOT NULL` にできるか | **できない。** SQLite の `ALTER TABLE ADD COLUMN` は既定値なしの `NOT NULL` を許さず、テーブル再構築が要る。⇒ **nullable を採った**（判断と理由は §4） | **一致**（設計卓の見込み「再構築が要るなら nullable」どおり） |
| **5** | 生成器が `preset_aliases` へ INSERT している箇所 | **★2 本あった。**指示書 §4.5 が名指しした `internal/seedgen/generate_m2002.go`（`writeMovementAliasInsert` / `writeCharAliasInsert`）に加え、**`internal/seedgen/generate.go` の `writeAliasInsert`（`official_ja_move` 用）**が存在する。`character_data/seed-progress.md` の手順が新キャラ波で**両方を回す** | **★食い違い。**指示書 §2.1 は「`generate_m2002.go` 等」と書いており「等」に含まれる読みだが、見込みは 1 本だった。**両方に `character_id` を出させた**（§5） |
| **6** | 生成器以外の直接 INSERT 経路 | **本番コードには存在しない。**`internal/repository/preset` に insert メソッドは無く、`preset_aliases` へ書く本番経路は現時点で 1 つも無い。**テストに 2 件**——`internal/api/move/handler_test.go:285`（HEAD スキーマで走る。**本サブで `character_id` を足した**）／ `internal/infra/migration/migrate_m1403c_test.go:266`（v33 相当のスコープで走り `character_id` 列は存在しない。**触っていない**）。詳細は §7 | 見込みなし（材料の収集項目） |
| **7** | 着手前に検査が緑か | `check-enum-sync.sh` = **ベースラインどおり（増加なし）** ／ `check-progress-log-index.sh` = **違反なし** | — |

### 1.1 §3.3-2 の実測（2026-08-13・一時 DB に v73 まで適用して測定）

| 測ったもの | 実測 |
|---|---|
| `preset_aliases` 全行数 | **4,158**（`official_ja_move` 1,653 ／ `numeric` 1,245 ／ `srk` 1,260） |
| `alias_text_en` が非 NULL の行 | **76** |
| **(1) `(preset_id, character_id, alias_text)` で `count(DISTINCT move_id) > 1` の組** | **0 件** |
| **(2) `(preset_id, character_id, alias_text_en)` で同上（非 NULL のみ）** | **0 件** |
| **(3) §4.4 の交差**（同一 `(preset, char)` で、ある行の `alias_text` が別行の `alias_text_en` と一致） | **0 件** |
| 参考: `(character_id, alias_text)` の重複キー | **714 件**（指示書 §1.1 #2 と**完全一致**） |
| 参考: `move_id` が `moves` に存在しない orphan | **0 件**（⇒ backfill 後に NULL は残らないことが事前に確定した） |

**★714 が指示書の実測値と一致したことで、本サブの設計が立っている前提（「714 は無害・守りたい 0 件は別物」）が崩れていないことを確認した。**

---

## 2. §4.7 否定形確認の走査結果

**走査時点: 2026-08-13、コードの最終編集後**（commit `11d0c8b` 時点。以降コードは変更していない）。

| # | 撤回・変更した定義 | 走査キーワード | 実装コード・テストでの件数 | 内訳 |
|---|---|---|---|---|
| 1 | `(character_id, alias_text)` の単純 UNIQUE（**D-343** の当初案・採らない） | `character_id, alias_text` ／ `character_id,alias_text` | **0 件** | `000074` / `000075` のコメントに同文字列が 3 か所現れるが、いずれも**「その形で張ってはならない」と書いた注意書き**であり残骸ではない。`preset_id` を含まない一意制約の実体は 0 件 |
| 2 | 「`alias_text` の一意制約は無い」の記述 | `一意制約は無い` ／ `一意制約なし` ／ `一意制約は無し` | **1 件 → 是正済み（現在 0 件）** | `internal/repository/preset/repository.go` の `FindMoveCodesByAlias` godoc。下記参照 |

### 2.1 走査 2 のヒットと是正内容

**旧記述**（失効した部分）:

> `preset_aliases` に `alias_text` の一意制約は無い（UNIQUE は `(preset_id, move_id)`）ため 1:N が起こり得る。

**★挙動は変えていない。記述だけを書き分けた。** 本メソッドは**全プリセット横断**で引くため、プリセットを跨いだ 1:N は本サブの制約の対象外であり**依然として成立する**（実測 714 件）。`SELECT DISTINCT m.code` の必要性も変わらない。変わったのは「同一プリセット・同一キャラ内では 1:1 になった」という一段だけであり、そこを明示した。

**★この型の指摘を「体裁」として落とさないこと。** 実装が変わったのに記述が旧のまま残ると、通常のテスト・lint・型検査はすべて緑のままで、人が読む以外に見つける経路が無い。かつ後任は本文をコピーして注記を読まない。

`docs/` 配下（`DES-003` §3.9 等）の同記述は **`CHANGE-100` の手番であり、製造は触っていない**（§8 参照）。

---

## 3. `CHANGE-100` の反映に必要な as-built

**採取方法: v75 まで適用した DB の `pragma_table_info` / `pragma_foreign_key_list` / `sqlite_master` を実査（2026-08-13）。**

### 3.1 `character_id` の型と NULL 可否

```
cid  name           type      notnull  default  pk
  5  character_id   INTEGER   0        (なし)   0
```

- **型: `INTEGER`**
- **NULL 可否: nullable（`notnull = 0`）**
- **既定値: なし**
- 列位置は `alias_text_en` の後（`ALTER TABLE ADD COLUMN` のため末尾に付く）

### 3.2 FK の有無

**`character_id` に FK は無い。** `preset_aliases` の FK は既存の 2 本のみで、本サブで増減していない。

```
preset_aliases.move_id   -> moves.id
preset_aliases.preset_id -> presets.id
```

### 3.3 制約の実際の定義文（`sqlite_master` からの逐語）

```sql
CREATE UNIQUE INDEX ux_preset_aliases_preset_char_alias
    ON preset_aliases (preset_id, character_id, alias_text)
```

```sql
CREATE UNIQUE INDEX ux_preset_aliases_preset_char_alias_en
    ON preset_aliases (preset_id, character_id, alias_text_en)
 WHERE alias_text_en IS NOT NULL
```

**★`ALTER TABLE ADD CONSTRAINT` を使っていない**（SQLite が持たないため）。**索引で張ったことにより、テーブル定義側の `UNIQUE (preset_id, move_id)` は無改変のまま残っている**（`sqlite_autoindex_preset_aliases_1` として実在）。

`preset_aliases` の索引の as-built 全数:

| 索引名 | 種別 | 備考 |
|---|---|---|
| `sqlite_autoindex_preset_aliases_1` | UNIQUE | テーブル定義側の `UNIQUE (preset_id, move_id)`。**本サブで無改変** |
| `ux_preset_aliases_preset_char_alias` | UNIQUE | **本サブで新設** |
| `ux_preset_aliases_preset_char_alias_en` | UNIQUE・**部分** | **本サブで新設** |
| `idx_preset_aliases_preset_move` | 非 UNIQUE | 既存の検索用索引。**本サブで無改変** |

### 3.4 部分インデックスの `WHERE` 句

```sql
WHERE alias_text_en IS NOT NULL
```

`pragma_index_list('preset_aliases')` の `partial` が **`1`** であることも実査で確認した（`ux_preset_aliases_preset_char_alias` 側は `0`＝全行に当たる）。

### 3.5 消費したマイグレ連番

| 連番 | ファイル | 内容 |
|---|---|---|
| **`000074`** | `000074_m20_preset_aliases_add_character_id.{up,down}.sql` | 列追加 ＋ backfill |
| **`000075`** | `000075_m20_preset_aliases_unique.{up,down}.sql` | UNIQUE 索引 2 本 |

**⇒ 次に払い出す番号は `000076` である**（ボード §2.2 の更新が要る。設計卓の手番）。

---

## 4. §4.1-3（`NOT NULL` の実現方法）／ §4.1-4（FK）の判断と理由

### 4.1 `NOT NULL` にせず nullable を採った（§4.1-3）

**判断: nullable。設計卓の見込みどおり。**

**理由:**

1. **SQLite の `ALTER TABLE ADD COLUMN` は既定値なしの `NOT NULL` を許さない。** `NOT NULL` にするには 12 段のテーブル再構築（新テーブル作成 → 4,158 行コピー → DROP → RENAME → 索引再作成 → `foreign_key_check`）が要る。
2. **再構築の技術的 risk は実査の結果「低いが 0 ではない」。** `preset_aliases` を参照する FK・ビュー・トリガーは 0 件であり、外部への波及は起きない。しかし**再構築は既存 DDL を書き写す形になる**——`id INTEGER PRIMARY KEY AUTOINCREMENT`・FK 2 本・`UNIQUE (preset_id, move_id)`・`000070` が足した `alias_text_en` を写し落とせば、**気づかないまま制約が消える**。これは `SUPP-001` §5.5 の「忠実復元」がまさに警戒している型であり、**`000070` も同じ理由で再構築を避けている**（同ファイルのコメント）。
3. **費用に対して得られるものが小さい。** `NOT NULL` が防ぐのは「`character_id` を入れ忘れた INSERT」だけであり、**それはテストと生成器で塞げる**——
   - `migrate_m2003_test.go` (b) が **NULL 0 件**を、(c) が **`moves.character_id` との全行一致**を固定する。
   - 生成器 2 本が `character_id` を出力する（§5）。**投入経路そのものから NULL が生まれない。**
   - `generate_m2003_test.go` が出力形を固定するため、生成器の退行も検出できる。

**★残る穴と、それを誰が持つか:** 本サブの時点で `preset_aliases` へ書く**本番経路は 1 つも無い**（§3.3-6）。M20-04 以降が作る INSERT 経路は `character_id` を入れないと制約をすり抜ける。**落ちないため気づけない。** ⇒ 横断課題として `progress-log.md` の索引行（横断課題 1）へ記録した。

### 4.2 FK を張らなかった（§4.1-4）

**判断: 張らない。設計卓の見込みどおり。**

**理由:**

1. `move_id → moves(id)` の FK が既にあり、**`character_id` はその推移的な複製**である。
2. **FK は「`characters` に実在するか」しか見ない。** 本当に守りたいのは「**その `move` のキャラであるか**」であり、それは FK では表現できない。**テスト (c) の全行一致のほうが強い主張である。**
3. 索引が 1 本増える分の書き込み費用を、より弱い保証のために払うことになる。

---

## 5. 生成器の追随（§4.5）と golden の扱い

### 5.1 生成器は 2 本とも `character_id` を出す

| 生成器 | 関数 | 出力先プリセット |
|---|---|---|
| `internal/seedgen/generate.go` | `writeAliasInsert` | `official_ja_move` |
| `internal/seedgen/generate_m2002.go` | `writeCharAliasInsert` | `numeric` / `srk`（キャラ別） |
| `internal/seedgen/generate_m2002.go` | `writeMovementAliasInsert` | `numeric` / `srk`（移動系 9 code・`alias_text_en` を伴う） |

**★`generate.go` を外す選択は採らなかった。** `character_data/seed-progress.md` の手順は新キャラ波で**両方を回す**。片方だけ直すと、次のキャラ波で `character_id` が NULL の行が入り、**nullable であるためマイグレもテストも緑のまま制約をすり抜ける**（指示書 §4.5 の警告そのもの）。

出力形（新形式）:

```sql
INSERT INTO preset_aliases (preset_id, move_id, character_id, alias_text)
SELECT (SELECT id FROM presets WHERE code = 'official_ja_move'), m.id, m.character_id, v.alias_text
FROM moves m
JOIN characters c ON c.id = m.character_id
...
```

`m` は既に `FROM moves m` で束縛済みのため **JOIN の追加は不要**。down 側（`buildCharAliasDown` / `buildMovementAliasDown` / `buildCharDown`）は `move_id` で消しており **変更していない**。

### 5.2 golden との両立（★検討した複数案と選定理由）

**問題:** golden テストは「生成器の出力がコミット済みマイグレと **byte 一致**すること」を主張しており、これが**手編集ドリフトの唯一の検出経路**である。`character_id` を足すと 6 本の golden が落ちるが、対象マイグレは**適用済みで改変禁止**（§2.2）。**正本（CSV）を是正するわけではないため、三点更新は発生しない。**

| 案 | 内容 | 採否と理由 |
|---|---|---|
| **A. 旧形式を named option で残す** | `SQLFormat` / `Option` / `WithFormat` を新設。既定 `FormatCurrent`、golden だけが `FormatPreM2003` を指定 | **★採用。** 分岐の実体は 3 関数 × 2 行（配線込み約 20 行）。**旧形式は閉じた集合**（適用済み 6 ファイル）で今後増えない。可変長オプションのため `cmd/seedgen`（本番経路）は無改変で新形式になる。**byte 一致のドリフト検出が完全に維持される** |
| B. golden を testdata へ凍結 | 旧形式の期待値をコピーして固定 | **不採用。** 対象 6 ファイルは合計 **約 570 KB**。複製した上、**マイグレ実物との突合ではなくなるため golden の存在理由が消える** |
| C. golden を差分無視に作り替え | `character_id` 列を除去してから比較 | **不採用。** 変換ロジックが挟まり、それ自体が壊れても気づけない。旧形式との一致主張が弱まる |
| D. `AFTER INSERT` トリガーで自動補完 | 生成器も golden も触らずに済み、将来の INSERT 経路も構造的に守れる | **不採用。** `CHANGE-100` §2.1 の承認範囲は「列 ＋ 制約 2 本」であり**トリガーは承認外のスキーマ要素**。かつ §4.5 が「生成器が `character_id` を出す」ことを明示的に指示している（`CLAUDE.md` §10「設計書に記載のない機能を勝手に追加しない」） |

**★初版の案比較には抜けていた観点がある（レビュー 高-1 で検出・是正済み）。** 初版は案 A の利点として「`cmd/seedgen`（本番経路）は無改変で新形式になる」と書いたが、**その無改変こそが `go run ./cmd/seedgen -check`（変換規則の無改変ゲート）を恒常的に赤にしていた**——既定経路の出力先は適用済みの `000026` に固定されているためである。**生成器の出力形式を変えるときは、生成器・CLI・golden・doc コメント・失敗メッセージが 1 組である。** 是正として `cmd/seedgen` に `preM2003Stems` / `formatFor` を置き、**出力先 stem から形式を判別する**ようにした（フラグ方式を採らなかったのは、付け忘れた実行が適用済みファイルを壊すため）。⇒ **6 stem すべての再生成コマンドと `-check` が復帰した**（全件を `-check` で実測し byte 一致を確認）。

**旧形式オプションの対象（閉じた集合。今後増えない）:**

`000026_seed_moves_first_wave` ／ `000030_seed_moves_ryu` ／ `000045_seed_moves_manon` ／ `000055_seed_moves_third_wave` ／ `000072_m20_seed_aliases_numeric` ／ `000073_m20_seed_aliases_srk`

**★保守負担について:** 旧形式は「列を 1 本出さない」以上のことをせず、新機能を持たない。保守が要るのは「生成規則そのものが変わったとき」だけで、**それは旧形式の有無に関係なく起きる**（既存 golden は既に「旧波の規則は凍結」という前提の上に立っている）。本オプションはその前提を**名前付きで明示するだけ**であり、新しい義務を作らない。

---

## 6. 破壊テスト (i)〜(k) の実施記録

**`SUPP-001` §5.5.4 (10) に基づく。制約は「張った」だけでは効いているか分からない。**
`internal/infra/migration/migrate_m2003_test.go` の `TestRun_M2003_ConstraintActuallyBites`。

**★対象 move の選び方に注意点があった（初回は誤って失敗した）。** 当初は「同一キャラの別 move を 2 つ」だけを条件に選んだが、**選ばれた move が既に `numeric` エイリアスを持っていたため、既存の `UNIQUE(preset_id, move_id)` が先に発火した**。それでは「本サブが張った制約が効いた」のか「既存制約が効いた」のか区別できない。⇒ **当該プリセットのエイリアスをまだ持たない move を選ぶ**ように是正した（M20-02 が衝突組を非投入にしているため該当する move は実在する）。

| ID | 何を入れたか | どう落ちたか |
|---|---|---|
| **(i)** | 同一 `(preset_id=numeric, character_id, alias_text='M2003_DESTRUCTIVE_A')` で **別 `move_id`** の 2 行目を INSERT | **失敗した。** `constraint failed: UNIQUE constraint failed: preset_aliases.preset_id, preset_aliases.character_id, preset_aliases.alias_text (2067)`。**★狙った索引の構成列がそのままエラーに出ている** |
| **(j)** | `alias_text` は別値（`..._B1` / `..._B2`）にし、`alias_text_en='M2003_DESTRUCTIVE_EN'` だけを同一にして別 `move_id` で INSERT | **失敗した。** `constraint failed: UNIQUE constraint failed: preset_aliases.preset_id, preset_aliases.character_id, preset_aliases.alias_text_en (2067)`。**部分インデックスが非 NULL 行に対して効いている** |
| **(k)** | `alias_text_en = NULL` の行を、別 `move_id` ・別 `alias_text`（`..._C1` / `..._C2`）で 2 行 INSERT | **成功した（＝落ちないことが正しい）。** NULL は「英語表記を持たない」であって同値ではない。`alias_text` を別値にしてあるため (i) の制約にも当たらず、**部分インデックスの主張そのものを見ている** |

いずれも `strings.Contains(err.Error(), "UNIQUE")` を併せて確認し、**別の理由で偶然落ちていないこと**を固定している。各ケースは `defer cleanup()` で投入行を掃除し、後続ケースへ影響させない。

---

## 7. §3.3-6 の実査結果（`preset_aliases` への直接 INSERT 経路）

**設計卓が §4.4-2「投入は生成器を通す」の規約の実効性を判断するための材料。**

| 区分 | 実在するか | 詳細 |
|---|---|---|
| **本番コード** | **★存在しない（0 件）** | `internal/repository/preset` に insert / upsert メソッドは無く、`Repository` interface は読み取り 6 メソッドのみ。`preset_aliases` へ書く本番経路は現時点で 1 つも無い。他パッケージ（`repository/move` `repository/punish`）の参照はすべて読み取り `LEFT JOIN` |
| **生成器** | 2 本（§5.1） | 本サブで両方 `character_id` を出すようにした |
| **マイグレ** | 生成器の出力（`000006` / `000011` / `000026` / `000030` / `000045` / `000055` / `000072` / `000073` 等） | 適用済み・無改変 |
| **テスト** | **2 件** | ① `internal/api/move/handler_test.go:285`——HEAD スキーマ（`dbtest.Setup`）で走るため **`character_id` を足した**（§4.6 の追随）。② `internal/infra/migration/migrate_m1403c_test.go:266`——**v33 相当のスコープで走り `character_id` 列がまだ存在しない。触っていない** |

**⇒ 「投入は生成器を通す」は、本番コードに関しては現時点で 100% 実効的である**（そもそも他の経路が存在しない）。**ただしそれは「規約が守られている」のではなく「まだ書く機能が無い」だけである。** M20-04（カスタムプリセット作成）・M20-05（preset サービス層）が本番の INSERT 経路を作った時点で、規約が初めて試される。

---

## 8. 変更しなかったもの（§2.2 の確認）

| 対象 | 結果 |
|---|---|
| `moves` テーブル | **diff 無し。** テストでも `movesDigest`（行数 ／ id 合計 ／ character_id 合計 ／ code 長合計）が up / down 前後で不変であることを固定した |
| M20-02 が投入した `alias_text` / `alias_text_en` の値 | **1 文字も変えていない。** `aliasValueDigest`（行数 ／ 両列の長さ合計 ／ `alias_text_en` の値連結）が不変であることを固定した |
| 適用済みマイグレ | **改変していない。★本サブは正本（CSV）を是正していないため、`SUPP-001` §5.5.4 (6) の三点更新は発生していない**（指示書 §2.2 の見込みどおり） |
| `internal/service/punishfinder` ／ `setplay` | **diff 0**（`git diff --stat` で確認） |
| `web/` | **diff 0**（停止条件 3 は不発動。本サブはスキーマと生成器で閉じた） |
| `DES-003` ／ `DES-004` | **直接編集していない**（`docs/design/` の diff 0）。改訂は as-built 確定後に設計卓が行う |
| `scripts/*.sh` のベースライン定数 | **diff 0**（`scripts/` 全体の diff が 0） |

**⇒ §2.3 の例外条項の発動は無い。**

---

## 9. 成果物

| ファイル | 種別 | 内容 |
|---|---|---|
| `migrations/000074_m20_preset_aliases_add_character_id.{up,down}.sql` | 新規 | 列追加 ＋ backfill |
| `migrations/000075_m20_preset_aliases_unique.{up,down}.sql` | 新規 | UNIQUE 索引 2 本 |
| `internal/seedgen/format.go` | 新規 | `SQLFormat` / `Option` / `WithFormat`（旧形式は閉じた集合） |
| `internal/seedgen/generate.go` | 修正 | `writeAliasInsert` が `character_id` を出す ／ `Generate` `GenerateWithHeader` に可変長 opts |
| `internal/seedgen/generate_m2002.go` | 修正 | 2 つの writer が `character_id` を出す ／ `GenerateAliases` に可変長 opts |
| `internal/seedgen/generate_m2003_test.go` | 新規 | §5.1 (l)。生成器 2 本の出力形を新旧対で固定 |
| `internal/seedgen/generate_test.go` ／ `generate_m1403d_test.go` ／ `generate_m1403e_test.go` ／ `generate_m2002_golden_test.go` | 修正 | golden 6 本に `WithFormat(FormatPreM2003)` を指定 |
| `internal/infra/migration/migrate_m2003_test.go` | 新規 | §5.1 (a)〜(k) の契約テスト（破壊テストを含む） |
| `internal/repository/preset/repository.go` | 修正 | 失効した godoc の是正（§2.1） |
| `internal/api/move/handler_test.go` | 修正 | 直接 INSERT に `character_id` を追加 |
| `docs/progress/M20-03-completion-report.md` | 新規 | 本書 |

---

## 10. テスト結果

| 対象 | 結果 |
|---|---|
| `go test ./internal/infra/migration/ -run TestRun_M2003` | **全緑**（(a)〜(k)。backfill ログ: `character_id が NULL の行 = 0 件 / 検査した全行数 = 4158 行`） |
| `go test ./internal/seedgen/` | **全緑**（**golden 6 本を含む**。旧形式オプションにより byte 一致が維持されている） |
| `go test ./...` | **全緑** |
| `cd web && pnpm test` | **全緑**（127 ファイル / 1,052 テスト。非回帰の確認） |
| `bash scripts/check-enum-sync.sh` | **ベースラインどおり（増加なし）** |
| `bash scripts/check-progress-log-index.sh` | 索引行の追記後に再実行して**違反なし**（検査した 24 件すべてが progress-log に現れる）。**★ただし本検査の緑は根拠にならない**——スクリプト自身が §限界に「ID が本文のどこかに現れれば緑になる」と明記しており、追記前も M20-02 の横断課題 7（「M20-03 の前提」）の文字列に当たって緑だった（レビュー 高-2 で検出）。**索引行が実在することは目視で確認した** |
| `bash scripts/check-artifact-integrity.sh` | **違反 1 件（★本サブ起因ではない）** — 下記 §10.1 |

### 10.0 レビュー取り込み後の再検証（Phase C 後）

| 対象 | 結果 |
|---|---|
| `go test ./...` | **全緑** |
| `go run ./cmd/seedgen -check` | **緑**（取り込み前は恒常的に赤だった＝レビュー 高-1） |
| 旧形式 6 stem の再生成コマンド | **全件 byte 一致**（`-check` で実測） |

トリアージの採否と理由は `docs/progress/m20-03-review.md` の「取り込み結果（自動トリアージ）」節が正本。**「高」の不採用は 0 件**のため開発者エスカレーションは発生していない。

### 10.1 `check-artifact-integrity.sh` の 1 件について

```
NG  check-md-emphasis.sh の --self-test が「自己検査: 合格」を出力しない
```

**原因は環境要因である。** 実行環境に `markdown-it-py` が導入されておらず、`check-md-emphasis.sh` が `ERROR: markdown-it-py が見つかりません。検査を実行できませんでした(未実行)。` を返している。

- **本サブ起因ではない。** `scripts/` の diff は 0 である（`git diff --stat 82bd206..HEAD -- scripts/` が空）。
- **検査自身は正しく振る舞っている。** 依存欠落時に「未実行」と申告して非ゼロ終了し、**緑を返していない**（`check-artifact-integrity.sh` §4.1 の「成功表示は証拠ではない」が期待する挙動そのもの）。
- **対応: `pip install markdown-it-py` が要る環境側の話であり、コード側の修正対象は無い。**

### 10.2 E2E

**既存 spec の非回帰確認のみ。** 本サブはスキーマと生成器で閉じており、`web/` の diff は 0 である。

---

## 11. 推測で進めた箇所

**★無い。** §9.1 の「推測で進めてはいけない事項」4 件はすべて実査した（マイグレ連番 = §1 #1 ／ 制約の違反件数 = §1.1 ／ `NOT NULL` の実現方法 = §1 #4・§4.1 ／ 直接 INSERT 経路の有無 = §7）。

§9.2 の「推測で進めてよい事項」（`NOT NULL` ／ FK ／ マイグレの分けかた）は**いずれも設計卓の見込みどおりに落ち着いた**ため、覆った項目は無い。マイグレは §2.1 の推奨どおり 2 本に分けた。

---

## 12. 併せて更新が要るもの

| # | 対象 | 状態 |
|---|---|---|
| 1 | **CHANGE 番号の登録** | **本サブは新規に番号を消費していない。** `CHANGE-100` は設計卓が起票・`change-number-registry.md` §1 への登録とも完了済み |
| 2 | **消費したマイグレ連番** | **`000074` / `000075` を消費した。⇒ 次に払い出す番号は `000076`。** ボード §2.2 の「次に払い出す番号」の更新が要る（**設計卓の手番**） |
| 3 | **`DES-003` §3.9 ／ `DES-004` §5 の改訂** | **未実施（正しい）。** as-built 確定後に `change-report-100` と同時に設計卓が行う。本書 §3 が反映に必要な as-built 5 点をすべて提供している |
| 4 | **版を上げた文書の参照元** | **該当なし。** 本サブは指示書・チェックリストの版を上げていない |
| 4b | **索引名の接頭辞 `ux_` の規約化** | **未実施（設計卓の手番）。** `migrations/` に既存の `CREATE UNIQUE INDEX` は 1 本も無く、非 UNIQUE 索引はすべて `idx_` である。`ux_` はリポジトリ初出であり、どこにも規約として書かれていないため次の担当が揺れる。**`CHANGE-100` の三点セットか `SUPP-001` §5.5 に 1 行残すことを提案する**（レビュー 低-2） |
| 5 | **`progress-log.md` への索引行** | **追記済み**（`CLAUDE.md` §8）。**★初版の本報告は追記前に「追記済み」と書いており誤りだった**（レビュー 高-2 で検出・是正）。実際の追記は Phase D で行い、横断課題 6 件（nullable の申し送り ／ 生成器 2 本 ／ 旧形式 6 stem ／ `-check` ゲート ／ 環境要因 ／ `ux_` 命名）を載せた |

---

## 13. 次サブへの申し送り

1. **★M20-04 以降が `preset_aliases` へ INSERT する経路を作るときは `character_id` を必ず入れること。** nullable であるため入れなくても INSERT は通り、`UNIQUE(preset_id, character_id, alias_text)` に当たらない行ができる。**落ちないため気づけない。** カスタムプリセットのコピーでエイリアスを実体化する際が最初の該当箇所になる。
2. **新しい seed 波では旧形式オプションを使わないこと。** `cmd/seedgen` は既定で新形式になるため、通常は何もしなくてよい。`WithFormat(FormatPreM2003)` を指定してよいのは適用済み 6 ファイルの golden だけである。
3. **衝突組（`numeric` 35 キー / `srk` 30 キー）は非投入のままである。** 投入されていない行は制約に当たらない。恒久対応は followup `numeric-aerial-vs-crouching-collision`（開発者見解＝通常技全体に `j` を付ける）。**★投入する際は本サブの制約に当たりうるため、投入前に §1.1 と同じ違反検査を回すこと。**
4. **`P-34` の「何も押さずに派生する技」27 件**を投入すると `alias_text_en` が増え、部分インデックスが初めて実効的になる。同じく投入前に検査を回すこと。

---

*以上、M20-03 完了報告。配置 `docs/progress/M20-03-completion-report.md`。*
