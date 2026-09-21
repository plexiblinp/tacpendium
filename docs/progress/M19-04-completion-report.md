# M19-04 完了報告書（フレーム費用モデルの列追加）

| 項目 | 内容 |
|------|------|
| 文書ID | M19-04-report |
| バージョン | 1.0.0 |
| 対象指示書 | `docs/instructions/M19-04-frame-cost-columns.md` v1.1.0 |
| CHANGE | CHANGE-091 v1.1.0 |
| 設計正本 | `docs/handover/M19-DESIGN-07-frame-cost-model.md`（**実体は v1.0.6**。指示書は v1.0.4 を指す） |
| 実施日 | 2026-08-01 |
| 実施範囲 | **Phase 1 完了**。Phase 2（§4.8 人手 backfill）は**未実施**（開発者の CSV 記入待ち） |

---

## 1. 消費したマイグレ連番

**000049〜000052 の 4 本**（着手時の末尾は 000048＝§2.3-1 の停止条件クリア）。

| 連番 | ファイル | 内容 |
|---|---|---|
| 000049 | `000049_add_moves_frame_cost_columns` | DDL：`moves` 新列 3 ＋ 新表 `move_derivations` ＋ 索引 1 |
| 000050 | `000050_backfill_moves_frame_cost` | 機械 backfill（条件式 3 文） |
| 000051 | `000051_seed_moves_zangief_rapid` | ザンギエフ連打版 3 行 INSERT ＋ `preset_aliases` 対投入 |
| 000052 | `000052_backfill_moves_chain_cancel_total` | `chain_cancel_total` の手書き UPDATE（37 行） |

**★並行レーン（M14-03e）は 000053 から払い出すこと。** Phase 2 を実施する場合は M14-03e のブロックより後の番号を実査で取り直す（連番を予約していないため穴は空かない）。

**★000052 は 000051 より後でなければならない。** 37 行のうち 3 行は 000051 で新規登録する連打版であり、順序を逆にすると 3 行が 0 件更新になる（**エラーにならない**）。

### 付随: ボード D-104 の未決に対する回答

**`golang-migrate` は連番の穴を許容する。** v4.19.1 の `source/migration.go:93` `Next()` は**ソート済み index の次要素**（`i.index[pos+1]`）を返す実装で、`version+1` を要求しない。

**真の危険は逆である**——**より大きい番号が適用済みの後から小さい番号を差し込むと、`Next()` は前方にしか進まないためその 1 本が永久にスキップされる**。並行レーン運用で守るべき不変条件は「穴を作らないこと」ではなく **「払い出した番号より小さい番号を後から作らないこと」**。

---

## 2. Plan Mode 着手前確認（11 項目）

| # | 項目 | 結果 |
|---|---|---|
| 1 | `ls migrations/` の実査 | 末尾 **000048**（`000048_backfill_movement_total_manon`）。up/down が全 48 本対で存在・欠番なし |
| 2 | 母数の再実査 | 下記 §3 |
| 3 | `characters` の全行実査 | **13 行**。seed 済み 11 キャラ（ryu / juri / zangief / terry / guile / lily / ingrid / kimberly / ken / mai / manon）＋ c_viper / dhalsim（仮登録） |
| 4 | `moves` の識別キー変更経路 | **アプリ実行時には存在しない。** `UPDATE moves SET code` は Go に 0 件、`UpdateFields` の allowlist は 9 列（`total`/`startup`/`active`/`on_hit`/`on_block`/`damage`/`recovery`/`is_aerial`/`raw_data`）で `code`/`id` を含まない。`DELETE FROM moves` も Go に 0 件。**ただしマイグレ層には物理削除→再 INSERT で id が再発番される前例がある**（000029→000030）。これが `move_derivations` に明示削除を要する理由 |
| 5 | `insertRushVariantSQL` の明示列挙 | **15 列**（14 バインド ＋ `is_derived` をリテラル `1`）。本サブで `startup_basis` をリテラル `'through'` として追加し **16 列**に |
| 6 | `csvColumns` の列数とヘッダ一致 | **20 列**。`character_data/*.csv` は **17 ファイル**（指示書の「15 ファイル」は 2 本古い）で**ヘッダは全ファイル完全同一**（`head -qn1 \| sort -u` = 1 種） |
| 7 | 20 フィールド行リテラルを持つ単体テストの全数 | **12 関数 / 25 行リテラル**（`generate_test.go` 10 関数 16 行・`generate_m1702_test.go` 2 関数 9 行）＋ `testHeader` 1 本 = **修正 26 箇所**。全体実行で確定 |
| 8 | `punishfinder` canary の現行判定値 | `wantLegacyJumpHeavy=23` / `wantOptionC=25` / `wantUniqueAerial=7`（`service_test.go:385-387`）。**本サブ完了後も 3 値とも不変** |
| 9 | ザンギエフ連打版の `move_code` 衝突 | `_rapid` サフィックスは全 CSV・全マイグレで **grep 0 件**。既存 87 code と衝突なし |
| 9b | 実測資料の技名 → `move_code` 写像 | **34/34 行が一意に確定**（下記 §5） |
| 10 | `move_derivations` の表名衝突 | 既存 21 表・索引 18 本と**衝突なし** |

---

## 3. 母数の実測値（設計文書との差分）

clean マイグレ由来 DB（`COMBOMGR_DB_PATH` をスクラッチパッドへ向けた使い捨て DB。dev DB は不使用）で実測。

| 母数 | 指示書 §3.2（2026-07-31・manon 投入前） | 実測（000048 適用形） | 差 |
|---|---:|---:|---:|
| `moves` 総行数 | 944 | **1025** | +81（+8.6%） |
| `is_derived = 0` | 640 | **694** | +54（+8.4%） |
| `category = 'rush_variant'` | 156 | **171** | +15（+9.6%） |
| それ以外（`is_derived=1` かつ非 rush） | 148 | **160** | +12（+8.1%） |
| `code LIKE '%jumping_%'`（部分一致） | 65 | **71** | +6（+9.2%） |
| うち前方一致 `jumping_%` | 63 | **69** | +6 |
| **差の 2 行** | 2 | **2** | 一致（juri / ken の `neutral_jumping_heavy_kick`） |
| `characters` 行数 | 12 | **13** | 予告どおり |
| 攻撃技 seed 済みキャラ | 10 | **11** | 予告どおり |
| c_viper / dhalsim の `moves` | 各 9 行・全 NULL | **各 9 行・startup 全 NULL・全て `category='system'`** | 一致 |

**§2.3-2 の停止条件（±10% 超）はクリア。** 全項目が +8〜9% であり、差分は M14-03d の manon 投入（+81 = CSV 72 行 ＋ 移動 system move 9 行）で**完全に説明できる**。指示書 §3.2 は「+72 の見込み」としていたが、実際は移動 system move 9 行を含めて +81 だった。

---

## 4. 機械 backfill の投入件数（000050）

| 対象 | 条件 | 件数 |
|---|---|---:|
| `startup_basis = 'standalone'` | `is_derived = 0` かつ c_viper / dhalsim 除外 | **676** |
| `startup_basis = 'through'` | `category = 'rush_variant'` | **171** |
| `startup_basis = 'unknown'`（残置） | c_viper / dhalsim | **18** |
| `startup_basis = 'unknown'`（残置） | 人手判断待ち（`is_derived=1` かつ非 rush） | **160** |
| **合計** | | **1025**（＝ moves 総数。`startup_basis` は全行を分割する） |
| `fastest_unreachable = 1` | `code LIKE '%jumping\_%' ESCAPE '\'` | **71** |

**★`fastest_unreachable` は部分一致で実装した。** 前方一致にすると juri / ken の `neutral_jumping_heavy_kick` の 2 行を取り落とす（M18-03c で同じ 2 行の取り落としを是正した経緯・ボード D-41/D-78）。**この 2 行が実際に付与されていることを件数固定テストで固定した**（`m1904PrefixMissed = 2`）。

000051 で連打版 3 行が `'standalone'` を明示投入するため、HEAD 時点では **standalone 679 / through 171 / unknown 178（計 1028）**。

---

## 5. `chain_cancel_total` の投入件数と写像表（000052）

**投入 37 行**（実測資料 `character_data/chain-cancel-measurements.md` **v2.3.0**・確定 55 件 / 18 キャラ）。

### 写像表の全数（34 行は既存行・3 行は 000051 の新規行）

**写像の一意性は「実測資料の単発値 `su/act/rec/total` と DB の 4 値一致」で機械照合し、34/34 行が確定した**（§2.3-8 の停止条件クリア）。表記変換は `Stand`/`Crouch` + `LP`/`LK` → `standing_`/`crouching_` + `light_punch`/`light_kick`。

| キャラ | 資料の技名 | `move_code` | 単発 su/act/rec/total | `chain_cancel_total` |
|---|---|---|---|---:|
| リュウ (`ryu`) | Stand LP / Crouch LP / Crouch LK | `standing_light_punch` / `crouching_light_punch` / `crouching_light_kick` | 4/3/7/13・4/2/9/14・5/2/10/16 | 9 / 10 / 12 |
| ジュリ (`juri`) | 同上 | 同上 | 4/4/7/14・4/3/8/14・5/3/8/15 | 10 / 10 / 13 |
| ザンギエフ (`zangief`) | Stand LP / Crouch LP / Crouch LK（**通常**） | 同上 | 7/3/9/18・6/2/8/15・4/3/12/18 | 15 / 13 / 12 |
| ザンギエフ (`zangief`) | 同（**連打版**） | `standing_light_punch_rapid` / `crouching_light_punch_rapid` / `crouching_light_kick_rapid` | 4/3/9/15・3/2/8/12・3/3/12/17 | 12 / 10 / 11 |
| テリー (`terry`) | Stand LP / Crouch LP / Crouch LK | 同上 | 4/3/7/13・4/3/8/14・5/2/11/17 | 9 / 10 / 13 |
| ガイル (`guile`) | 同上 | 同上 | 5/3/7/14・4/3/8/14・5/2/12/18 | 10 / 9 / 12 |
| リリー (`lily`) | **Stand LP / Stand LK / Crouch LP / Crouch LK（4 技）** | ＋ `standing_light_kick` | 5/3/8/15・4/3/8/14・6/3/8/16・5/2/12/18 | 11 / 10 / 12 / 12 |
| イングリッド (`ingrid`) | Stand LP / Crouch LP / Crouch LK | 同上 | 4/3/7/13・4/2/9/14・5/2/10/16 | 9 / 10 / 12 |
| キンバリー (`kimberly`) | 同上 | 同上 | 5/2/8/14・4/3/7/13・5/3/7/14 | 10 / 9 / 9 |
| ケン (`ken`) | 同上 | 同上 | 4/3/7/13・4/2/9/14・5/3/10/17 | 9 / 10 / 13 |
| 舞 (`mai`) | 同上 | 同上 | 4/3/7/13・4/3/7/13・5/3/8/15 | 9 / 10 / 11 |
| マノン (`manon`) | 同上 | 同上 | 4/3/10/16・4/2/11/16・5/2/13/19 | 12 / 10 / 13 |

**キャラ名の写像**: `舞 → mai`（DB の `characters.name_ja` は **`不知火舞`** で資料表記と不一致。`character_code` で解決した）／`ベガ → m_bison`（未 seed のため対象外）／`エレナ` は CSV 未作成のため対象外。

### 投入しない範囲（未 seed 18 行）

エレナ 2・JP 3・ジェイミー 3・ルーク 2・**マリーザ 2**・ベガ 3・ラシード 3。

> **★指示書 §4.4.5 の「投入しない範囲」はマリーザを列挙していない。** これは実測資料が v2.1.0（53 件 / 17 キャラ）から **v2.3.0（55 件 / 18 キャラ）へ更新されマリーザ 2 件が追加された**ため（ボード D-106）。本マイグレは seed 済み 11 キャラに限定しているので除外は自動的に成立しており、件数 37 行も変わらない（55 − 18 = 37）。

---

## 6. ザンギエフ連打版 3 行の投入と確定反撃サーチの増分

### 投入内容（000051）

| `move_code` | alias（`official_ja_move`） | su/act/rec/total | `chain_cancel_total` | `startup_basis` | `is_derived` |
|---|---|---|---:|---|---:|
| `standing_light_punch_rapid` | 立ち弱P(連打版) | 4/3/9/15 | 12 | `standalone` | 1 |
| `crouching_light_punch_rapid` | しゃがみ弱P(連打版) | 3/2/8/12 | 10 | `standalone` | 1 |
| `crouching_light_kick_rapid` | しゃがみ弱K(連打版) | 3/3/12/17 | 11 | `standalone` | 1 |

3 行とも `total = startup + active − 1 + recovery` の検算式を満たす（15 / 12 / 17）。**`damage` / `on_hit` / `on_block` は実測資料に無いため NULL のまま**とした（推測で埋めない）。

### 確定反撃サーチの増分内訳（§5-2・§2.3-3）

**成立レーンの候補件数は完全に不変（増分 0）。手動確認レーンのみ zangief を相手に選んだとき +3。**

| 経路 | 判定 | 根拠 |
|---|---|---|
| **自技（始動技）として** | **候補に入らない（増分 0）** | `buildStarters`（`service.go:330`）が `sm.Damage == nil` の行を**最初にスキップ**する。連打版は damage NULL のため 3 レーンいずれにも載らない |
| **相手技として** | **手動確認レーンに +3**（`unknown_damage`） | `isNonPunishableTarget` は通過（移動 system move でも `is_aerial=1` でもない）→ `om.Damage == nil` により `ManualReviewNodes` へ（`service.go:224-227`）。**成立レーンには到達しない** |
| canary（`wantLegacyJumpHeavy` / `wantOptionC` / `wantUniqueAerial`） | **23 / 25 / 7 のまま不変** | 連打版は `is_aerial=0` のため jump レーンの母数に影響しない。テストは green |
| `registeredCombos` / レシピ行 / 3 レーン境界 / `JumpSlack` / ガードタブ | **不変** | いずれも `fakeRepo` ベースまたは canary で担保。全テスト green |

**`internal/service/punishfinder/` と `internal/service/setplay/` の diff は 0**（`git diff --stat` で確認）。

> **なお、この +3 は「damage を NULL のままにした」ことの直接の帰結である。** damage=0 にすれば完全除外されるが、それは実測されていない値を捏造することになる。**「わからない」を手動確認レーンに出すのは設計どおりの挙動**であり、実測が入れば自然に解消する。

---

## 7. 人手判断が必要な行の一覧（3 系統別の件数）

成果物: **`docs/progress/M19-04-manual-input-list.md`**

| # | 系統 | 抽出条件 | 件数 |
|---|---|---|---:|
| 1 | `startup_basis` | `is_derived=1` かつ `category<>'rush_variant'` かつ `startup_basis='unknown'` | **160** |
| 2 | `fastest_unreachable` の **B 型** | `is_aerial=1` かつ `code` が `jumping_` を含まない | **7** |
| 3 | `chain_cancel_total` | `category='normal'` かつ地上弱通常技 4 種 かつ `chain_cancel_total IS NULL` | **10** |

各行に `character_code` / `move_code` / `name_ja` / `category` / `is_derived` / `is_aerial` / `command` / `startup` / `total` / `original_move_code` / `condition_ja` を添え、`character_code` 順 → `move_code` 順で安定ソートした。

> **★`original_move_code` と `condition_ja` は `moves` の列として存在しない**（前者は seedgen が `original_move_id`(INTEGER) へ解決して投入、後者は 000018 で `raw_data` から除去済み）。一覧では `character_data/*.csv` を結合して補った。

**`chain_cancel_total` の絞り込み条件は開発者確認済み**（2026-08-01）。実測資料の確定ロースターが地上弱通常技 4 種のみであることに合わせた。seed 済み 11 キャラの該当行は 44 行で、うち 34 行は実測済み（000052 で投入）、残る 10 行（全て `standing_light_kick`）を一覧に出している。**必殺技に一部対象がある可能性は開発者が並行調査中のため本一覧には含めていない。**

---

## 8. 否定形確認の結果（§4.9・5 項目）

走査対象は 3 系統すべて（本番コード／テスト資産／設計文書・指示書）。

| # | 撤回した定義 | 本番コード・マイグレ | 残存 |
|---|---|---|---|
| 1 | 旧 gap 定義 `G = 1 − N` | **ヒット 0** | **`docs/handover/M19-DESIGN-07-frame-cost-model.md:67` に生ヒットが残存**（設計正本自身）。製造は DES/handover を編集しないため設計伝達レポート④へ。ボード M-13 に登録済み |
| 2 | 新列名が生成 SQL に出力される | **golden 7 stem にヒット 0** | なし。`TestGenerate_FrameCostColumnsNotEmitted` で機械的に固定した |
| 3 | 「新列は DB backfill 専用」 | ヒットは全て**投入方式の説明**（`is_derived`/`is_projectile` と同型という記述）で撤回対象ではない | `M19-DESIGN-07` §8-3 の「CSV/seedgen 触らない（DB backfill 専用の推奨）」は撤回済み記述として残存 → ④ |
| 4 | `fastest_unreachable` の前方一致案 | **ヒット 0**（000050 のヒットは「前方一致にしてはならない」という禁止の明記） | `internal/service/punishfinder/service_test.go:429` に `strings.HasPrefix(move.Code, "jumping_heavy_")` が存在。**別目的（確定反撃の空中技除外）だが同じ取り落としパターン**。**契約 F-1 により不可触** → ④ |
| 5 | `chain_cancel_total = total − 4` | **ヒット 0**（残る 1 件は「規則では導けない」という禁止の明記） | なし |

> `setplay.go:94,101` の `1 − Gmax` / `1 − Gmin` は**旧 gap 定義の残骸ではない**（`Lo`/`Hi` の受け渡し表現であり、現行の正しい定義 `G = N − active`・帯 `[active+Gmin, active+Gmax]` と整合する）。

---

## 9. テスト結果

| # | 要件 | 結果 |
|---|---|---|
| 1 | **投入件数を数で固定** | **新規 `internal/infra/migration/migrate_m1904_test.go`（5 テスト・全 green）**。判定値は `const` に置きテスト名に数字を埋め込まない |
| 2 | **確定反撃サーチの非干渉（F-1）** | `punishfinder` **全テスト green・diff 0**。canary 3 値不変。増分内訳は §6 |
| 3 | **golden** | **7 stem 全て green**（4 stem ではなく 7。`generate_m1403d_test.go` に manon の 000045/46/47 が追加済み）。§4.3 のゲート時・完了時の 2 回で確認 |
| 4 | **`go run ./cmd/seedgen -check`** | **OK: 生成物は既存ファイルと一致** |
| 5 | 新 stem の golden | Phase 2 未実施のため該当なし |
| 6 | **down 整合** | 4 本すべて up → down → up を件数固定テストで検証（`SchemaUpDown` は再 up まで確認） |
| 7 | **`go test ./...` / `go vet ./...`** | **ともに exit 0**。`gofmt -l` も未整形なし |
| 8 | **件数前提テストの追従** | 全体実行で 2 本の失敗を検出し是正（下記） |
| 9 | **`make e2e` 非回帰** | §10 |

### レビュー取り込みで追加したテスト（Phase C）

| テスト | 目的 |
|---|---|
| `internal/repository/move/rush_test.go` の `TestInsertRushVariant_FrameCostColumnDefaults` | **rush 生成経路の新列値を固定**（チェックリスト §6 第 3 項）。`insertRushVariantSQL` から `'through'` を消すと `startup_basis="unknown"` で FAIL することを実証済み＝指示書 §4.5 が警戒した「静かに壊れる」型のガード |
| `TestRun_M1904_ZangiefRapid` への追加 assert | **確定反撃サーチの増分内訳の前提条件を固定**。連打版 3 行が `damage IS NULL` かつ `is_aerial=0` であること（＝自技側は `buildStarters` がスキップ／相手技側は `unknown_damage` へ）と、移動 system move 9 種と衝突しないこと |

### §5-8 で追従した既存テスト（2 本）

`TestRun_M1403c_OtherCharsUnaffected` と `TestRun_M1403d_OtherCharsUnaffected` が、連打版 3 行により zangief の `(moves, alias)` が 87 → 90 に増えたことを検出した。

**数字を緩めるのではなく、増分の内訳を明示する形で是正した**——`migrate_m1403c_test.go` に `expectedMovesDelta`（キャラ → 意図的な増分）を新設し、`zangief: 3` を M19-04 の増分として理由つきで登録した。**他キャラは従来どおり 1 行も増減してはならない。**

---

## 10. E2E の判定と根拠

`make e2e`（使い捨て DB ＋ 専用ポート BE 47390 / Vite 5273 の独立スタック）を実行した。

| 区分 | 件数 | 内訳 |
|---|---:|---|
| passed | **62** | — |
| flaky（retry で green） | **6** | `combo-crud` (E-1) / `m17-05c-fix-output` / `m17-05c-pdf-pagination` / `m18-03a-punish-mylist` (C) / `m18-03b-materialize` (C) / `m19-01-setplay-suggestion` (B) |
| failed | **1** | `m14-03b-custom-states-realdata.spec.ts:16`（ingrid `sun_crest` の custom_states ①②③） |

### 判定: **本サブの回帰ではない（既知の flakiness）**

**根拠**:

1. **失敗した spec を単独実行すると green**（`pnpm e2e e2e/m14-03b-custom-states-realdata.spec.ts` → `1 passed (6.0s)`）。指示書 §5-9 が定める判定条件（「落ちた spec を単独実行して green なら本サブの回帰ではない」）を満たす。
2. **失敗領域が本サブの変更範囲と交わらない。** 当該 spec は `custom_states`（000015 / 000023 で導入された ingrid 固有の状態値）の editor 表示と保存を検証するもので、本サブが触った `moves` の新列 3 本・`move_derivations`・`character_data/*.csv` の末尾 3 列・`insertRushVariantSQL` のいずれとも接点がない。
3. **本サブは新列をエンジン・API・フロントエンドへ一切露出させていない**（契約 F-3。`web/src/` への grep ヒット 0）ため、E2E が観測する API レスポンス・画面表示は定義上変化しない。
4. flaky 6 件も**毎回異なる spec が落ちる**という既知の症状に合致し、いずれも retry で green になっている。

---

## 11. Phase 2 の実施可否

**未実施。** 開発者の `character_data/*.csv` 記入待ちのため。指示書 §4.8 の「記入が間に合わない場合は Phase 2 を実施せず、既定値のまま Phase 1 で完了とする」に従った。

**未記入の件数と対象**（後続サブへの申し送り）:

| 系統 | 未記入件数 | 対象 |
|---|---:|---|
| `startup_basis` | **160** | `is_derived=1` かつ非 rush の行（`unknown` のまま） |
| `fastest_unreachable` の B 型 | **7** | `is_aerial=1` かつ非 `jumping_` の行（`0` のまま） |
| `chain_cancel_total` | **10** | 地上弱通常技 4 種の未実測分（NULL のまま） |

一覧は `docs/progress/M19-04-manual-input-list.md`。**推測で埋めていない。**

### その他の申し送り

1. **`move_derivations` は表を作成したのみでデータ投入は行っていない**（§12 参照）。
2. **未 seed 6 キャラの `chain_cancel_total` 16 行**は M14-03e §4.5 が本サブの 000049 着地後に投入する。
3. **M14-03e は 000053 から連番を払い出す。**

---

## 12. 完了条件（DoD）の充足状況

- [x] §2.1 の成果物 1〜7 がそろっている（8 は Phase 2・条件付きのため未実施）
- [x] §5-1（投入件数の固定）と §5-2（確定反撃サーチの非干渉）が両方 green
- [x] golden（**7** stem）が green・`-check` が OK
- [x] 既存マイグレ 000001〜000048 を 1 本も改変していない（`git status` で新規 8 ファイルのみ）
- [x] `internal/service/punishfinder/` と `internal/service/setplay/` の diff が 0
- [x] `moves.startup` / `moves.total` の既存値が 1 行も変わっていない（`TestRun_M1904_StartupTotalUnchanged` がスナップショット比較で担保）
- [x] 新列がエンジン・既存 API に露出していない（契約 F-3。`web/src/` ・`internal/api/` ・`internal/model/` ・`internal/service/` にヒット 0）
- [x] §4.9 の否定形確認を実施し、結果を報告している
- [x] 消費したマイグレ連番を明記している（000049〜000052）
- [x] 完了報告（本書）と設計伝達レポートを作成している

---

*以上、M19-04 完了報告書 v1.0.0。*
