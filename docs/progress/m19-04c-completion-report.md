# M19-04c 完了報告 — 既存データの是正（`move_code` / `command` / フレーム値）

| 項目 | 内容 |
|------|------|
| 対象指示書 | `docs/instructions/M19-04c-data-corrections.md` **v1.2.0** |
| 実施日 | 2026-08-03 |
| **消費したマイグレ連番** | **`000063`（`000063_correct_moves_data_m1904c` up/down）** |
| 改変した既存マイグレ | `000026` / `000034` / `000045`（golden 再生成）＋ `000039`（§2.5 案 1） |
| CHANGE 起票 | **なし**（指示書 §0.3 の確定どおり。新たに事実でなくなる DES 記述は見つからなかった） |
| 結果 | **`go test ./...` 全パッケージ green** / `go vet ./...` clean / `gofmt -l internal/ cmd/` clean |

---

## 1. 実施内容（三点更新）

| 経路 | 成果物 |
|---|---|
| **(1) CSV（正本）** | `character_data/guile.csv` / `kimberly.csv` / `lily.csv` / `mai.csv` / `manon.csv` の **10 行** |
| **(2) golden** | `000026_seed_moves_first_wave`（up/down）/ `000034_backfill_moves_is_derived`（up/down）/ `000045_seed_moves_manon`（up） |
| **(3) マイグレ** | **`000063`**（既存 DB 追随）＋ `000039`（`is_projectile` の code 列挙追随） |

コミットは 4 本（チェックポイント運用）:

| コミット | 内容 |
|---|---|
| `de7f34a` | CSV 正本 10 行 |
| `e6ee67c` | golden 3 stem の再生成 |
| `3064164` | `000039` の同時写像 |
| `05be9aa` | `000063` ＋ `migrate_m1904c_test.go` |

---

## 2. ★指示書との読み替え（5 件）

**開発者指示（2026-08-03）「項番などのズレは後で訂正させるので、いったん読み替えで進む」に従った。設計卓での訂正をお願いしたい。**

### 2.1 ★§1.1 C の「現行」列は `startup` と書いてあるが、実データは `total` である

| # | 行 | 指示書「現行」 | **CSV 実測（su/act/rec/total）** | 是正後（指示書どおり） |
|---|---|---|---|---|
| 1 | kimberly `bushin_prism_strikes` | startup **52** | 26 / 3 / 24 / **52** | 26 / 3 / **19** / **47** |
| 2 | lily `condor_dive_follow_up` | startup **48** | 12 / 5 / 32 / **48** | 12 / **12** / **24** / **47** |
| 3 | lily `windclad_od_condor_dive_follow_up` | startup **48** | 12 / 5 / 32 / **48** | 12 / **10** / **24** / **45** |
| 4/5 | mai `flame_midare_kachousen` / `midare_kachousen` | 27/30/39/95 | 27 / 30 / 39 / 95 ✓ | **28** / 30 / 39 / **96** |
| 6 | manon `temps_lie` | startup **28** | 5 / 1 / 23 / **28** | 5 / **5** / **17** / **26** |

**52 / 48 / 48 / 28 はいずれも `total` の値**であり、`startup` は 26 / 12 / 12 / 5 で**是正後と同値**である。すなわち **C は「startup の誤り」ではなく「`active` / `recovery` / `total` の誤り」**であった。

**停止条件 2（申告の前提が崩れている）には当たらないと判断した**——是正後の 4 つ組が完全に指定されており、どの列をどの値にするかに曖昧さが無いため。**是正後の 4 つ組を正として適用した。**

### 2.2 §2.5 条件 3 / 停止条件 5b — 旧 3 code の grep は `000039` 以外にもヒットする

**着手前の全数 grep（`migrations/` 全体）:**

| ファイル | 種別 | 扱い |
|---|---|---|
| `000026_seed_moves_first_wave.up.sql` / `.down.sql` | **seedgen golden** | 再生成で自動追随（§2.1 の許容 4 本） |
| `000034_backfill_moves_is_derived.up.sql` / `.down.sql` | **seedgen golden** | 同上 |
| `000039_add_moves_is_projectile.up.sql` | **手書き** | §2.5 の案 1 で書き換え |

**⇒ 手書きで code を列挙しているのは `000039` だけ**であり、条件の趣旨は満たされる。**停止せず、全数を報告して進んだ。**

**是正後の再 grep**（`migrations/` 全体）:
- `sonic_cross_3_meter_od` … **0 件**（`000063` の改名文・逆改名文を除く）
- `sonic_break_light` … **0 件**（同上）
- `sonic_cross_2_meter_od` … **7 件 / 5 ファイル**（すべて**新 code として**。`000026.up` ×2〔moves INSERT / alias INSERT〕・**`000026.down` ×2**・`000034.up`・`000034.down`・`000039.up`）

> **2026-08-03 訂正**: 当初「5 件」と記載したが `000026.down` の 2 行が集計から漏れていた（レビュー指摘 低-6）。実測は **7 行 / 5 ファイル**。

### 2.3 節番号の参照ズレ

| 箇所 | 記載 | 実際 |
|---|---|---|
| §3 停止条件 8 | 「（§2.3）」 | **§2.4**（`move_commands` / 段階 2） |
| §6.3 | 「§2.4 の `move_code` 対応表」 | **§2.7** |
| §4 テスト 3 | 「down で**全 9 行**」 | **10 行**（§5・チェックリスト §9 は 10 行） |
| §2 の節順 | §2.7 が §2.5 / §2.6 より前 | — |

### 2.4 `migrate_m1904_test.go:394` のコメント文言

「後続サブ（… **M19-04c の guile 6 行のフレーム是正**）」とあるが、実際のフレーム是正 6 行は **kimberly / lily / mai / manon** であり **guile は含まない**（guile のフレーム是正は B-3 の 1 行のみ）。**実害なし**——同テストの比較区間は v48→v52 で閉じており、本サブ（`000063`）の影響を受けない。**コメントの文言ズレのみ。**

### 2.5 §2.4 の見出し「実査済み・波及なし」

見出しは断定だが本文は「Plan Mode で実査して報告すること」を求めている。**実査を行い、結論は「波及なし」で正しかった**（§4 に詳細）。

---

## 3. ★§2.5 — `000039` の diff 全文

```diff
--- a/migrations/000039_add_moves_is_projectile.up.sql
+++ b/migrations/000039_add_moves_is_projectile.up.sql
@@ -20,7 +20,7 @@
 -- ===== guile (24 moves) =====
 UPDATE moves SET is_projectile = 1
 WHERE character_id IN (SELECT c.id FROM characters c WHERE c.code = 'guile' AND c.game_id IN (SELECT id FROM games WHERE code = 'sf6'))
-  AND code IN ('sonic_boom_light', ..., 'sonic_cross_od', 'sonic_cross_2_meter_od', 'sonic_cross_3_meter_od', 'sonic_break_light', 'sonic_break_od', 'sa1_sonic_hurricane_up', 'sa1_sonic_hurricane_side');
+  AND code IN ('sonic_boom_light', ..., 'sonic_cross_od', 'perfect_timing_sonic_cross_od', 'sonic_cross_2_meter_od', 'sonic_break', 'sonic_break_od', 'sa1_sonic_hurricane_up', 'sa1_sonic_hurricane_side');
```

**変更は 1 行のみ**（guile ブロックの `code IN (...)`）。`...` の部分は無変更のため省略した。差し替わったのは以下 3 トークンだけであり、**位置・件数・順序は保存されている**。

| 位置 | 旧 | 新 |
|---|---|---|
| 19 番目 | `sonic_cross_2_meter_od` | `perfect_timing_sonic_cross_od` |
| 20 番目 | `sonic_cross_3_meter_od` | `sonic_cross_2_meter_od` |
| 21 番目 | `sonic_break_light` | `sonic_break` |

### 5 条件の充足

| # | 条件 | 結果 |
|---|---|---|
| 1 | `code` 文字列リテラルの置換のみ | **OK**（ロジック・列・順序は不変。guile の列挙は **24 件のまま**） |
| 2 | v39 の `is_projectile=1` が **104 件で不変** | **OK**。`TestRun_M1801_IsProjectileBackfill` が**期待値 104 を書き換えずにそのまま green** |
| 3 | `migrations/` 全体の旧 3 code の全数 grep | **OK**（§2.2） |
| 4 | diff 全文の掲載 | **本節** |
| 5 | `git status --porcelain migrations/` が 4 本＋新規のみ | **OK** |

### ★同時写像で置換した

`sonic_cross_2_meter_od` は「消える旧 code」であると同時に「生まれる新 code」でもあるため、**クォート済みトークン単位の 1 パス写像**で置換した。順次置換だと `sonic_cross_3_meter_od → sonic_cross_2_meter_od → perfect_timing_sonic_cross_od` と二重置換され行が消える。**置換後、3 つの新 code がそれぞれちょうど 1 件**であることを機械で確認した。

### 案 1 を採った理由（実証込み）

golden 再生成後・`000039` 未修正の状態で `TestRun_M1801_IsProjectileBackfill` を走らせ、**`is_projectile=1 = 102, want 104`** で落ちることを確認した（＝指示書の予測どおり guile の 2 行を取り落とす）。案 2（据え置き＋新マイグレで補完）は v39 時点で新規 DB（102）と既存 DB（104）が乖離するため採らなかった。

---

## 4. §2.4 の実査結果 — `command` 変更の波及は**なし**

| # | 実査項目 | 結果 |
|---|---|---|
| 1 | `move_commands` の行数・内容 | **不変**。`000035` / `000047` / `000057`（move_commands 系 golden）は **1 バイトも変わっていない**（`git status` で確認・再生成も不要だった） |
| 2 | 段階 2 の解決表 | **不変**。よって **FE キャッシュ無効化契約（DES-002 §4.2・CHANGE-069/070）には触れない** |
| 3 | B-1 と B-2 のコマンド衝突の構造 | **保存**。是正後も両者は同一 `command`（`r plus p or cond{（ソニックブレイド中に）} r plus p p`）を持つ。`is_derived=true` の理由が変わっていない |
| 4 | `moveindex` の索引非搭載件数 | **件数不変**（非搭載行の code 名が変わるだけ）。`internal/moveindex` の **diff は 0** |

### なぜ波及しないのか（根拠）

- **`moves` に `command` 列は存在しない**（`000001_init_schema.up.sql` の `CREATE TABLE moves` ＋以降の `ALTER TABLE moves ADD COLUMN` を全数確認。DES-004 §2.4 の index-only 方針どおり）。
- **`move_commands` は非派生技のみ搭載**（`internal/seedgen/generate_m1702.go`）。
- **是正した guile 3 行はすべて `is_derived=true`** ＝**索引に元から非搭載**。

**⇒ `command` の是正は `character_data/guile.csv` の正本修正だけで完結し、DB 側に着地先が無い。** `000063` は `command` に触れていない。

---

## 5. §0.2 — 契約 F-2 の 3 条件

| # | 条件 | 結果 |
|---|---|---|
| **1** | 変更行を全数列挙し、値を固定するテストを書く | **充足**。`migrate_m1904c_test.go` が 10 行を**行ごとに**固定。条件式で束ねた UPDATE は書いていない（`000063` は全文が `code = '<単一値>'` 指定） |
| **2** | 確定反撃サーチの canary を前後で測定し差分の内訳を報告 | **充足**（§6） |
| **3** | `internal/service/punishfinder/` と `internal/service/setplay/` の diff が 0 | **充足**（`git diff HEAD~4 -- <両ディレクトリ>` が空） |

**`internal/seedgen` の生成関数（`writeMovesInsert` / `writeAliasInsert` / `rawDataSQL` / `CustomHeader`）の diff も 0。**

---

## 6. ★F-1 canary の測定結果 — **差分あり。全件が本サブの変更で説明できる**

### 測定方法

一時テストで全 17 キャラ **総当たり（17 × 17 × 2 ガード種 = 578 スキャン）**の `punishfinder.Scan` を実行し、成立ツリーのノード（相手技 code・有利フレーム・始動技とレーン）と手動確認レーンを行に落として、**是正の前後で突合**した。測定用ファイルは報告作成後に削除した（コミットしていない）。

### 結果

| 指標 | 値 |
|---|---|
| 出力行 | 29,655 行（前後で同数） |
| **相手技ノードの出現・消失** | **0 件**（before のみ 0 / after のみ 0） |
| 値が変化したエントリ | **1,523 件** |
| **説明できない差分** | **0 件** |

### 差分の内訳（行単位の説明）

| 内訳 | 件数 | 原因 |
|---|---|---|
| **有利フレームの変化** | **68** | **`recovery` を是正した 4 行**（ジャストパリィレーンは `adv = recovery`）。**17 self キャラ × 4 行 = 68**<br>・kimberly `bushin_prism_strikes` **adv 24 → 19**<br>・lily `condor_dive_follow_up` **adv 32 → 24**<br>・lily `windclad_od_condor_dive_follow_up` **adv 32 → 24**<br>・manon `temps_lie` **adv 23 → 17** |
| **code 改名のみ** | **1,116** | 始動技リスト・手動確認レーンに載る guile の 3 code が改名後の名前になった。**集合としては同一**（同時写像で突合して一致を確認） |
| **始動技の脱落** | **339** | **`startup` が上がった 3 行**が、有利フレームに収まらなくなった<br>・guile B-3（改名後 `sonic_cross_2_meter_od`）**startup 10 → 15**<br>・mai `midare_kachousen` / `flame_midare_kachousen` **startup 27 → 28**（`adv=27` の地上レーン 29 件・`adv=45` のダッシュレーン 3 件で脱落） |

**★新たに現れた始動技・相手技ノードは 1 件も無い**（`gained` が全件で空）。**是正はいずれも「判定を緩める」方向ではなく、正しい値に締める方向に働いている。**

### F-1 との関係

契約 F-1 は走査列（`is_projectile` / `is_aerial` / `on_block` / `recovery`）の**意味・値・使われ方を変えない**ことを求める。**本サブは `recovery` の値を 4 行で是正しており、F-1 の字面には触れる。** ただし:

- **意味・使われ方は不変**（列の解釈も走査ロジックも 1 行も変えていない）。
- **値の変化は「誤っていた値を正す」ものであり、変化は上表の 4 行に閉じている。**
- **`is_projectile` は `000039` の追随で HEAD の 135 件が保たれている**（追随が無ければ 133 に落ちた）。
- `on_block` / `is_aerial` は**一切触っていない**（ガードレーンの `adv = -on_block` は全件不変）。

**⇒ F-1 の趣旨（確定反撃の候補集合が「静かに」変わらないこと）は守られている。変化は全件が申告済みの是正に対応し、行単位で説明できる。**

---

## 7. ★§2.7 — Phase 2 への `move_code` 対応表（**必須成果物**）

**人手判断の記入用コピー `docs/progress/20260802-M19-04-manual-input-list-developer-decision.md` は `move_code` で行を特定している。本サブで 3 件の `move_code` が変わったため、そのまま突き合わせると誤った行へ転記される。**

| 記入用コピー上の `move_code` | 記入された値 | **本サブ後の実体（HEAD）** | Phase 2 での扱い |
|---|---|---|---|
| `sonic_break_light` | standalone | **`sonic_break`** | 読み替えて転記 |
| `sonic_cross_2_meter_od` | standalone（派生元が複数） | **`perfect_timing_sonic_cross_od`** | 読み替えて転記 |
| `sonic_cross_3_meter_od` | **保留** | **`sonic_cross_2_meter_od`**（`startup_basis='through'` を**本サブで確定済み**） | **Phase 2 の対象から外す** |

### ★★とくに危険なのは 3 行目である

**改名後の `sonic_cross_2_meter_od` は、記入用コピーでは別の技（改名前の 2_meter_od＝【ジャスト】ODソニッククロス１）を指している。**
**`move_code` だけで突き合わせると、記入値 `standalone` が、本サブで `through` を確定させた行に上書きされる。しかもエラーにならない。**

**⇒ Phase 2 の指示書では、転記のキーを `move_code` 単独にせず、`name_ja` との対で確認すること。**
本サブのテストも同じ理由で `name_ja`（「ODソニッククロス２」）を突合している。

| HEAD の `move_code` | `name_ja` |
|---|---|
| `sonic_cross_od` | ODソニッククロス１ |
| `perfect_timing_sonic_cross_od` | 【ジャスト】ODソニッククロス１ |
| `sonic_cross_2_meter_od` | **ODソニッククロス２** |
| `sonic_break` | ソニックブレイク |

---

## 8. ガードの所在（ボード D-189）

| ガード | 所在 | 状態 |
|---|---|---|
| **`m1904PrefixMissed = 2`**（`juri` / `ken` の `neutral_jumping_heavy_kick`） | **`internal/infra/migration/migrate_m1904_test.go:33`**（判定は同ファイル `:149` / `:152`） | **生存**。期待値を書き換えずに green |
| **`is_projectile` の v39 件数 104** | **`internal/infra/migration/migrate_m1801_test.go:76`**（`TestRun_M1801_IsProjectileBackfill`） | **生存**。期待値を書き換えずに green |
| **`is_projectile` の HEAD 件数 135**（新設） | **`internal/infra/migration/migrate_m1904c_test.go`（`m1904cProjectileTotal`）** | 新設。`000039` の追随が切れると 133 に落ちて検出する |
| 契約 F-2 のスナップショット（v48→v52） | `migrate_m1904_test.go:388-` | **生存**。区間が自サブに閉じているため本サブの影響を受けない |

**本サブは `000039` を改変したが、上記ガードを巻き添えにしていない。**

---

## 9. golden 再生成の diff（全数）

`git status --porcelain migrations/` の変更は **5 ファイル**（`000045.down` は変化なし）。**行数・トークン数はいずれも不変**で、変化したのは以下だけである（トークン単位で機械突合）。

| ファイル:行 | 変化 |
|---|---|
| `000026.up:248` | code `sonic_cross_2_meter_od` → `perfect_timing_sonic_cross_od` |
| `000026.up:249` | code `sonic_cross_3_meter_od` → `sonic_cross_2_meter_od` ＋ フレーム `10, 29, 38, …, 0` → `15, 46, 71, …, 11` |
| `000026.up:250` | code `sonic_break_light` → `sonic_break` |
| `000026.up:370-372` | alias INSERT の同 3 code |
| `000026.up:456-457` | lily 2 行のフレーム |
| `000026.up:903` | kimberly 1 行のフレーム |
| `000026.up:1479-1480` | mai 2 行のフレーム |
| `000026.down:51,53` | code 列挙の同 3 code |
| `000034.up:16` / `000034.down:51` | code 列挙の同 3 code |
| `000045.up:40` | manon `temps_lie` のフレーム |

**10 行以外は 1 行も変わっていない。** `go test ./internal/seedgen/` green・`go run ./cmd/seedgen -check` OK。

### 再生成コマンド（各 golden テストのコメントに記載のもの）

```
go run ./cmd/seedgen
go run ./cmd/seedgen -mode derived-backfill \
  -chars terry,guile,lily,ingrid,kimberly,juri,ken,mai,zangief,ryu \
  -out 000034_backfill_moves_is_derived -note "<backfillMigrationNote の文字列>"
go run ./cmd/seedgen -chars manon -out 000045_seed_moves_manon \
  -note "<manonMovesMigrationNote の文字列>"
```

---

## 10. CSV 変更の機械検証（RFC4180）

`git show HEAD:<csv>` と現物を **`csv` パーサ（RFC4180）で突合**した（カンマ数ベースでは `marisa.csv:80` のクォート付きフィールドを誤検知するため）。

- **ヘッダ不変・行数不変**（全 17 CSV）
- **変更行 = 10**（他 12 キャラの CSV は無変更）
- 変更列は `move_code` / `startup` / `active` / `recovery` / `total` / `command` のみ

`total = startup + active − 1 + recovery` は **是正前・是正後とも全 10 行で成立**（`seedgen` の `validate()` を通ることの前提）。

---

## 11. `sonic_break_light` の残存

**実装経路（`internal/` `cmd/` `migrations/` `character_data/*.csv` `web/`）で 4 件**。内訳:

| 箇所 | 理由 |
|---|---|
| `migrations/000063_..._m1904c.up.sql:80` | **改名 UPDATE の `WHERE code = 'sonic_break_light'`**。改名元を名指ししないと行を特定できない |
| `migrations/000063_..._m1904c.down.sql:70,77` | 同上（ロールバック側） |
| `internal/infra/migration/migrate_m1904c_test.go:27` | **「旧 code が 0 件」を固定するための期待値定数** |

**⇒ seed 経路・golden・CSV・サービス実装・web には 0 件。** 残る 4 件は「改名を実行する文」と「改名されたことを検証する文」自身であり、原理的に除去できない。歴史記録（`character_data/command-correction-history.md`・ボード・followup・`docs/progress/`・指示書とチェックリスト）に残るのは正常。

---

## 12. ★`csv-edit-vs-golden-divergence` の実例としての所感

**本サブは followup `csv-edit-vs-golden-divergence` の最初の実例である。** 三点更新を実際にやってみて、**手順として抜けやすかった点**を次に同型の是正をするときの指示書へ反映してほしい。

### 12.1 ★「新規 DB では UPDATE が 0 行」は改名には当てはまらない（指示書 §2.6 の穴）

指示書 §2.6 は「golden を再生成すると新規 DB は最初から是正後の値で seed されるので、UPDATE マイグレは新規 DB では 1 行も更新しない。**マイグレは成功する。エラーにならない**」と述べる。**フレーム是正についてはそのとおりだったが、改名だけは違った。**

新規 DB は golden 由来で**既に新 code を持つ**ため、B-2 の `WHERE code = 'sonic_cross_2_meter_od'` は**「改名後の B-3」に当たってしまう**。改名先の `perfect_timing_sonic_cross_od` も既に存在するので、**UNIQUE 制約違反でマイグレ全体が落ちる**（`TestRun_FirstAndIdempotent` が実際に落ちた）。

**⇒ 改名を伴う是正では「改名先が空いているときだけ当てる」ガード（`NOT EXISTS`）が要る。**
**⇒ 次の指示書には「改名は 0 行にならず、衝突する」を明記すべきである。** §2.6 の「エラーにならない」は**フレーム是正に限った話**だった。

### 12.2 ★golden に載らない列は、改名の「後」に新 code で当てる必要がある

`startup_basis` は **seedgen が SQL へ出力しない**列である（`generate_test.go` が「出力されていないこと」を固定）。したがって **golden を再生成しても新規 DB の `startup_basis` は `'unknown'` のまま残る**。

フレームと同じ流儀で「改名前に旧 code で当てる」と、**新規 DB では 0 行になり `'unknown'` で取り残される**（**これはエラーにならない**——まさに指示書が警戒していた失敗モードそのもの）。実際、最初の実装でこれを踏み、テストが `startup_basis = "unknown", want "through"` で落ちて発覚した。

**⇒ 是正対象の列を「golden に載る列」と「載らない列」に分けて考える必要がある。**

| 列の種別 | 例 | UPDATE を当てる位置 |
|---|---|---|
| **golden に載る**（新規 DB は是正済み） | `code` / `startup` / `active` / `recovery` / `total` | 改名**前**・旧 code。新規 DB では 0 行 |
| **golden に載らない**（新規 DB も未是正） | **`startup_basis`** / `is_derived` / `is_projectile` / `chain_cancel_total` / `fastest_unreachable` | 改名**後**・新 code。**新規 DB でも 1 行に当たる** |

### 12.3 ★「他の手書きマイグレが旧 code を持っていないか」は grep だけでは足りない

`000039` は grep で見つかったが、**見つかった 3 ファイルのうち 2 つ（`000026` / `000034`）は golden で自動追随する**ため、grep 結果をそのまま「手書きの追随対象」と読むと過剰になる。**「grep でヒットした × seedgen が生成していない」の 2 条件で絞る**のが正しい手順である。

### 12.4 ★件数ガードは「どの版の件数か」を取り違えやすい

`is_projectile` の **104** は **v39 時点（seeded-10）の件数**であって **HEAD の件数（135）ではない**。HEAD 用のガードを新設したとき、指示書に頻出する 104 をそのまま持ち込んで一度落とした。**次の指示書では件数ガードに必ず「どの版で測った値か」を併記してほしい。**

### 12.5 down の非対称性（既知の限界として記録）

`000063` の down は新規 DB を**旧 code / 旧フレームの状態へ引き戻す**。これは down の定義どおりだが、**「新しく作った v62」と「HEAD から down した v62」は一致しない**（前者は新 code、後者は旧 code）。re-up で復帰することは往復テストで固定した。**これは三点更新に内在する非対称であり、`csv-edit-vs-golden-divergence` の本質そのものである。**

### 12.6 down → re-up の往復が「追随経路」の唯一の実証になる

`000063` の存在価値は「既に適用済みの DB を追随させること」だけで、**その経路は CI では再現できない**（新規 DB は常に新 golden から再生される）。ただし **down 後の状態は既存 DB の状態そのもの**であるため、**down → re-up の往復が追随経路を実際に動かす唯一の検証**になっている。これは意図して設計した（`TestRun_M1904c_DownUpRoundTrip`）。

---

## 13. mai の 2 行の `active` / `recovery`（実査値）

| 行 | 現行 | 是正後 | 検算 |
|---|---|---|---|
| `midare_kachousen` | 27 / **30** / **39** / 95 | 28 / **30** / **39** / 96 | 現行 `27+30−1+39=95` ✓ ／ 是正後 `28+30−1+39=96` ✓ |
| `flame_midare_kachousen` | 27 / **30** / **39** / 95 | 28 / **30** / **39** / 96 | 同上 ✓ |

**`active` = 30・`recovery` = 39 は変更なし**（指示書の記載どおり）。停止条件 4 に該当せず。

---

## 14. 完了条件の充足

- [x] §1.1 の **10 行**が **CSV・golden・DB の 3 か所すべてで是正**されている
- [x] **`000039` が §2.5 の 5 条件を満たして書き換えられている**
- [x] **`go test ./...` が全パッケージ green**
- [x] §4 の 9 項目がすべて green（テスト 3 の「9 行」は **10 行**と読み替え）
- [x] **消費したマイグレ連番 `000063` を明記**
- [x] `go test ./...` / `go vet ./...` / `gofmt -l internal/ cmd/` が clean
- [x] **`internal/service/punishfinder/` と `internal/service/setplay/` の diff が 0**
- [x] **`internal/seedgen` の生成関数の diff が 0**
- [x] **§0.2 の 3 条件を満たしたことを記載**（§5・§6）
- [x] **既存マイグレの diff が §2.1 の 4 本に限られている**
- [x] **DES 本体・CHANGE 通知書を編集していない**

---

## 14.5 ★レビュー指摘の取り込み（2026-08-03・`m19-04c-review.md`）

**重大（チェックリスト §10 該当）= 0 件。** 「高」1 件・「中」4 件・「低」5 件の指摘を受け、**高 1 件と中 4 件、低 3 件を採用**した。

### 高-1（採用）— ★`000039` の案 1 書き換えが中間版 DB に取り残しを作る

**レビューが再現した欠陥**: `v26〜v38` で止まっていた DB（**旧 code で seed 済み・`000039` 未適用**）を HEAD へ上げると、`000039` が新 code で照合するため **`sonic_break_light` と `sonic_cross_3_meter_od` の 2 行を取り落とす**。その後 `000063` が改名しても `is_projectile` は誰も直さないため、HEAD で **`sonic_break` と `sonic_cross_2_meter_od` が `is_projectile = 0`**（合計 **133**）。**エラーにならない。**

**指示書 §2.5 が案 2 を却下した理由（「飛び道具なのに `is_projectile=0` の行が 2 行ある DB を中間状態として作る」）と同型の欠陥が、案 1 側の別コホートに残っていた。** 指示書が案 1 を命じているため製造の違反ではないが、**当初の完了報告・設計伝達レポートのいずれにも記載が無かった**。

**製造側で独立に再現・修正・再検証した**（旧マイグレを `53c38be` から取り出して逐次適用するシミュレーション）:

| 経路 | 修正前 | 修正後 |
|---|---|---|
| 既存 DB 経路（旧 v62 → 新 `000063`） | 135 ✓ | **135** ✓ |
| **中間版 DB 経路（旧 v38 → 新 `000039` 以降）** | **133**（`sonic_break` / `sonic_cross_2_meter_od` が 0） | **135** ✓ |

**採った対処＝レビュー提案 (a)。** `000063` に **「健全な DB では 0 行に当たる」再確定 UPDATE** を追加した:

```sql
UPDATE moves SET is_projectile = 1
WHERE character_id IN (guile)
  AND code IN ('perfect_timing_sonic_cross_od', 'sonic_cross_2_meter_od', 'sonic_break')
  AND is_projectile = 0;
```

**★down では戻さない（意図的な非対称）。** これは 10 行の是正ではなく「中間版 DB が取り落とした `000039` の backfill を埋め直すもの」であり、down で 0 に戻すと**健全な DB（新規 DB・v62 由来 DB）に欠陥を新たに作ってしまう**。`is_projectile` 自体のロールバックは `000039` の down（列ごと DROP）が担保している。マイグレ本文にこの理由を明記した。

> **一般則として followup（q）に登録した**: `code` 列挙型の手書き backfill マイグレを書き換えるときは、**その連番より前で止まったコホートを救う後段 UPDATE を必ず対で入れる。**

### 中（4 件・すべて採用）

| # | 指摘 | 対処 |
|---|---|---|
| 2 | B-3'（`startup_basis`）に行同定のガードが無い。上流の改名が `NOT EXISTS` で空振りした DB では、旧 2_meter_od へ `'through'` を静かに書き込む | **`AND total = 71` を追加**。「ガードは落ちる失敗を黙って 0 行に変換する装置であり、その直後に無条件 UPDATE を続けない」旨をコメントに明記 |
| 3 | スナップショットテストの比較列に **`recovery`（F-1 の名指し列・実際に書き換えている）**が無い | 比較列を **`startup` / `active` / `recovery` / `total` / `on_block` / `is_aerial` / `is_projectile`** へ拡張。F-1 の走査列を全数カバーした |
| 4 | canary 測定ハーネスが未コミットで再現不能 | **`internal/infra/migration/canary_punish_scan_test.go` としてコミット**。`CANARY_OUT` 未指定なら **skip**（CI を重くしない）。**`punishfinder/` 配下には置かない**——F-2 解除条件 3「`punishfinder` / `setplay` の diff が 0」は同型サブでも課され得るため、測定側をマイグレ側に置く |
| 5 | 残課題と知見が `followup-backlog.md` に未登録。スラッグ `csv-edit-vs-golden-divergence` が複数文書から参照されているのに実体が無い | §H に **(p) `csv-edit-vs-golden-divergence`**（実体を新規登録・§12 の知見 5 点を要約）と **(q) `is-projectile-middle-version-cohort`** を追加。**(o) `guile-move-code-and-command-corrections` をクローズ**（起票時の記述は保全） |

### 低（3 件採用・2 件不採用）

| # | 指摘 | 判断 |
|---|---|---|
| 6 | §2.2 の再 grep 集計から `000026.down` の 2 行が漏れ（実測 5 ファイル 7 行） | **採用**（§2.2 に訂正注記） |
| 7 | 構造体フィールド `tota` → `total` | **採用** |
| 8 | `touched` から `{"guile","sonic_cross_od"}` を外し「動かないこと」を積極的に固定 | **採用**。B-1 は `command` のみの是正で DB 値が動かないため、除外せず**不変を固定**する形に変えた（`touched` は 9 行に） |
| 9 | `migrate_m1904_test.go:394` のコメント文言（「guile 6 行のフレーム是正」） | **不採用**。同ファイルは **ボード D-189 が名指しで保護しているガードの所在**であり、実害の無い文言のために本サブが触るのは巻き添えリスクが上回る。**§15-2 として設計卓へ回す**（レビューも「実害なし」と評価） |
| 10 | 指示書側の訂正 5 件 | **不採用（製造の範囲外）**。CLAUDE.md §8 により製造は設計書・指示書を直接編集しない。**§15-1 / 設計伝達レポート ④ で報告済み** |

### レビューが独立に再現した検証（製造の主張の裏取り）

- CSV を**レビュー側で独自実装した RFC4180 パーサ**で突合 → **変更行ちょうど 10 行**
- 全 17 CSV・**1470 行**でフレーム内部整合 `total == su + act − 1 + rec` の**不整合 0**
- **旧マイグレ群から既存 DB を実際に再構築し `000063` を適用**するシミュレーション → 10 行すべて正しく着地・`is_projectile` 135 不変・`name_ja` の実体入れ替わりなし・**再適用も冪等**
- `NOT EXISTS` ガードが**「本来当てるべき行を取り落とす」ケースは現行マイグレ列から到達不能**であることを確認

---

## 14.6 ★反映パッチ 2 本との突き合わせ（2026-08-03・実装時は未適用だった）

開発者から `M19-overview-add-m19-04d-patch` と **`bundled-nonblocker-patch-2-20260803`** を受領し、本サブの成果物と突き合わせた。**どちらも現物には未適用**である。

### 製造側で是正した 2 件（コミット `a9ed9f5`）

**(1) 比較区間を v63 へ閉じた**（パッチ 2 §6＝SUPP-001 §5.5 の規約 (1)(2)）

`migrate_m1904c_test.go` の 3 テストが **`m.Up()`（HEAD 終端）**を使っていた。**★この規約はパッチ待ちではなく既に実在した**——`internal/infra/migration/migrate_head_test.go:7-20` に M19-04d が同じ文言で明記しており、「HEAD 終端を `TestRun_M14xx_*` のような名前空間へ相乗りさせると、後続サブの正当な変更で『そのサブのテスト』が落ち、原因が名前から辿れなくなる」と警告していた。

| テスト | 具体的な壊れ方 |
|---|---|
| `TestRun_M1904c_UntouchedRowsUnchanged` | **契約テストなのに HEAD 終端**。将来サブが正当にフレームを是正した瞬間に落ち、**規約 (1) が防ごうとしている「期待値を緩める誘惑」がそのまま発生する** |
| `TestRun_M1904c_HeadState` | **`m1904cProjectileTotal = 135` という HEAD スコープの主張をサブ名前空間に同居**させていた。新キャラの seed 波で必ず動き、落ちたとき名前が `M1904c` なので原因を誤認させる |
| `TestRun_M1904c_DownUpRoundTrip` | 後続連番を巻き込んで往復する |

**是正**: 終端を **`m1904cTerminus = 63`** へ統一（`m.Up()` は実コードから 0 件）。`TestRun_M1904c_HeadState` → **`TestRun_M1904c_V63State`** へ改名。これで本ファイルから HEAD スコープの主張が消えるため `migrate_head_test.go` への移設は不要になり、**135 は「v63 時点の値」として恒久的に安定する**。

**(2) `startup_basis` の UPDATE に既存値保護を足した**（パッチ 2 §2＝契約 F-4 (2')）

PA-01 が新設する **(2')「CSV 以外を一次源とする転記マイグレ」**は **(a) provenance (b) 常に非 NULL (c) `WHERE <当該列> IS NULL` で既存値を保護**を課す。`000063` の `startup_basis='through'` は一次源が人手判断の記入用コピー＝**CSV ではない**ため (2') の対象である。(a)(b) は充足していたが **(c) が欠落**していた（先例の `000062` は `AND startup_basis = 'unknown'` を持つ）。**`AND startup_basis = 'unknown'` を 1 行追加。** 実害は現状ゼロ（どの実経路でも当該行は v63 時点で `'unknown'`）。

**再検証**: 既存 DB 経路（旧 v62 → 新 `000063`）と中間版 DB 経路（旧 v38 → 新 `000039` 以降）の両方で、**`is_projectile = 135`** と **B-3 の `(15, 46, 11, 71, 'through')`** が是正後も成立することを確認した。

### 設計卓へ差し戻した 2 件（製造は設計書を編集しない）

- **★パッチ 2 §5 PA-06 の母数は適用と同時に陳腐化する。** PA-06 は人手母数を **309 行**へ更新するが、**M19-04c がこの 160 行のうち 1 行を Phase 2 の対象から外している**。`docs/handover/M19-DESIGN-07-frame-cost-model.md:96` の「記入は 2026-08-02 に完了（… **`保留` 1**）」の**その 1 件が `sonic_cross_3_meter_od`** であり、本サブが `through` を確定させた。**⇒ 当てる前に 309 → 308・`guile 21` → `20`・`保留 1` → `0`。**
- **パッチ 1 → パッチ 2 の順で当てる。** パッチ 2 §10 はパッチ 1 の PA-04 が追加する行をアンカーにしており、**現物に当該行は無い**。

### 併せて報告した残存陳腐化

- **どちらのパッチも `M19-overview.md` §3 の M19-04c 行を「完了」にしない**（現物は `編成済・承認済（2026-08-02）・指示書未作成`）。
- **M19-04c も `progress-log.md` に未追記**（パッチ 2 §8 が指示書テンプレへ追記しようとしている項目そのもの）。

### 衝突が無いことを確認した箇所

| パッチ箇所 | 判定 |
|---|---|
| §3 PA-03（D-189 のガードを弱めるな） | **整合**（期待値そのままで green・所在も §8 に明記済み） |
| §7（M19-04c 指示書のパッチは撤回） | **一致**。格納した v1.2.0・チェックリスト v1.1.0 が正 |
| §9（followup 2 スラッグ登録） | §14.5 で私が触った 3 スラッグと**衝突しない** |
| §6 規約 (3)(4)(5) | **充足済み**（対で固定／1 行 1 UPDATE／down は up の反転にしない） |

---

## 15. 残課題（followup へ）

| # | 内容 |
|---|---|
| 1 | **指示書 §1.1 C の「現行」列の列名**（`startup` → `total`）と**節番号 3 件・「9 行」→「10 行」**の訂正（§2.1・§2.3） |
| 2 | **`migrate_m1904_test.go:394` のコメント**「M19-04c の guile 6 行のフレーム是正」の文言是正（実際は kimberly/lily/mai/manon の 6 行・guile は 1 行）（§2.4） |
| 3 | **Phase 2 の指示書**に §7 の対応表を反映し、**転記キーを `move_code` 単独にしない**こと |
| 4 | `lily/condor_dive_follow_up` 系の**命名見直し**（指示書 §1.2 でスコープ外。開発者の提案段階） |
| 5 | **§12 の知見を「改名を伴うデータ是正」の指示書テンプレへ反映**（とくに §12.1・§12.2） |

---

*以上、M19-04c 完了報告。消費連番 **`000063`**。*
