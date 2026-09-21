# M18-01 完了報告（確定反撃スキーマ基盤）

| 項目 | 内容 |
|------|------|
| 文書ID | M18-01-REPORT |
| 対応指示書 | `docs/instructions/phase3/M18-01-schema-foundation.md` v0.2.0 |
| 実施日 | 2026-07-22 |
| 製造 | 製造担当 Claude Code（claude/senior-engineer-support-pjw43m ブランチ） |
| 状態 | 実装完了・Go/FE テスト green。E2E は環境制約により未実行（下記 §6） |

---

## 1. 実施内容サマリ
指示書 v0.2.0 に従い、確定反撃ドメインのスキーマ基盤を実装した。新テーブル 3・新列 2 を非破壊で追加し、`is_projectile` は **backfill 専用（Option A・is_derived 同型）** で初期値投入。`hit_type` に `just_parry_punish_counter` を追加（マイグレ不要）。

> **設計是正の経緯**: 着手前 Plan Mode 実査で、指示書 v0.1.3 の「seedgen を is_projectile SQL 出力へ変更」要件が (a) golden byte-identical 比較の失敗、(b) 既存マイグレ改変抵触、(c) 000026/000030 が 000039 より前に実行され `no such column` で実行不能、の 3 点で成立しないことを発見しエスカレーション。指示書担当が v0.2.0 で **backfill 専用に確定**（seedgen 出力要件を撤回）。本報告はその確定に沿う。

## 2. 触ったファイル一覧（E-14）
### マイグレ（新規・消費連番 000036–000039）
- `migrations/000036_create_combo_punishes.up/.down.sql`（G-c・CHANGE-078）
- `migrations/000037_create_combo_punish_prunings_and_curations.up/.down.sql`（G-d 2 表版・CHANGE-079）
- `migrations/000038_add_combos_materialized_from.up/.down.sql`（G-e・CHANGE-080）
- `migrations/000039_add_moves_is_projectile.up/.down.sql`（G-b・CHANGE-081・ADD COLUMN + backfill 104）

### BE
- `character_data/kimberly.csv`（is_projectile 是正 6 件）・`character_data/juri.csv`（1 件）
- `internal/seedgen/model.go`（is_projectile コメント `:9`/`:58` 更新のみ・**SQL 出力不変**）
- `internal/model/combo.go`（`HitTypeJustParryPunishCounter` 定数）
- `internal/service/comboio/csvcore/rules.go`（`DefaultHitTypes` に新値）

### FE
- `web/src/constants/combo-list.ts`（`HIT_TYPE_VALUES`・`HIT_TYPE_LABELS`）
- `web/src/features/combo/labels.ts`（`HIT_TYPE_LABEL_JA`・`HIT_TYPE_OPTIONS`）

### テスト
- `internal/infra/migration/migrate_m1801_test.go`（新規）
- `internal/seedgen/generate_test.go`・`internal/repository/combo/repository_test.go`・`internal/service/comboio/csvcore/csvcore_test.go`・`web/src/features/combo/utils.test.ts`（追記）

> dbtest スキーマは `dbtest.Setup` が全マイグレを適用するため新表 3・新列 2 は自動反映（手動反映不要）。

## 3. is_projectile 件数の検算（E-16/E-18）
- **数えた対象**: 是正後 `character_data/*.csv` の is_projectile 列 true 行（単位=技）。
- **是正前**（RESEARCH B-2）: seeded-10 = 97 / 全 CSV = 102。
- **是正後（実測）**: seeded-10 = **104**（97+7）。per-char: kimberly 0→6・juri 4→5。他 8 キャラ不変（terry4/guile24/lily0/ingrid33/ken4/mai20/zangief0/ryu8）。
- **backfill 更新件数**: マイグレ 000039 適用後 `SELECT count(*) FROM moves WHERE is_projectile=1` = **104**（中央確定と一致・テストで assert）。
- **全 CSV の乖離（要中央確認・§7 申し送り-A）**: 是正後の全 CSV 実測 = **122**（指示書想定 109 と +13 乖離）。内訳は seeded-10 104 + luke 5（manon 0）+ **m_bison 1 + rashid 12**。m_bison/rashid は RESEARCH B-2 のスナップショット後に追加された未 seed キャラの CSV で、moves 未投入のため **backfill 対象（104）には影響しない**。

## 4. golden green 確認結果（seedgen 非改変）
- `go test ./internal/seedgen/ -run TestGolden` は CSV 是正後も **green**（000026/000030 と byte-identical）。
- 根拠: is_projectile は生成 SQL のどの列にも現れない（`model.go:9`＝raw_data は notes/notes_tool のみ）。CSV の is_projectile 是正は生成バイト列を変えない。
- 追加テスト `TestGenerate_IsProjectileNotEmitted` で「生成 SQL に is_projectile が出力されない」ことを明示 assert。

## 5. 自己テスト結果（§7.2）
- **Go**: `go test ./...` 全 40 パッケージ green（既存非回帰）。新規 M18-01 テスト:
  - マイグレ up/down 往復（000036–000039）・dbtest 反映
  - is_projectile backfill 件数=104・bool 整合・代表行・is_derived 独立性
  - 3 表 UNIQUE 重複弾き・FK CASCADE（punishes/curations 消滅・prunings 残存）・self-FK 有効/不正
  - DuplicateKey: 同一レシピ×punish_counter/just_parry_punish_counter が別コンボ（FR301/E-19）
  - CSV: 新値 round-trip・既知 4 値受理・未知値 EnumStrict 棄却
- **FE**: `pnpm exec vitest run` 全 783 テスト green（110 ファイル）。`pnpm run build`（tsc + vite）green。

## 6. E2E について（§5.2・未実行・要環境）
- 本リモート環境の **Playwright ブラウザ版数不一致**により E2E を確定実行できなかった。pin された `@playwright/test` 1.60 は `chrome-headless-shell` build **1223** を要求するが、コンテナ同梱は build **1194**。
- 一時的に full chromium（1194）を `executablePath` で指す回避を試みたところブラウザは起動したが、`combo-crud`/`combo-csv-io` の全 4 spec が**相互作用タイムアウト**（`セットプレイ CSV` 欄の未検出・フォーム click timeout）で失敗。全滅かつ M18-01 と無関係な動線（M17-05a 取込 UI・CRUD フォーム）であることから、**pin 版と異なる new-headless 挙動による系統的タイミング差**（環境要因）と判断。M18-01 の差分は該当 UI に触れていない。
- **非回帰の担保**: 上記 Go 統合テスト（実マイグレ + FK CASCADE + 全 seed の dbtest）と FE コンポーネントテスト（ComboListFilters/ComboEditorBasicFields/CompareTable が hit_type を実行）＋本番ビルドで代替。
- **推奨**: pin 版に一致する Playwright ブラウザ（build 1223）環境で `make e2e` を再実行し §5.2-A/B を最終確認。

## 7. DES 反映要点（中央で三点セット反映・製造は DES 本体を編集していない）
- **DES-003**: `combos.materialized_from_combo_id`（self-FK・nullable）、`moves.is_projectile`（INTEGER NOT NULL DEFAULT 0）、新表 3（`combo_punishes`/`combo_punish_prunings`/`combo_punish_curations`）を追加。
- **DES-002 §7**: 紐づけ/materialize の endpoint 候補（本サブ未実装・M18-02/03）。
- **DES-004**: move 正典に is_projectile。
- **DES-006 §2**: hit_type 許容値 whitelist に `just_parry_punish_counter`（VAL-C02）。
- **DES-005**: hit_type ラベル。当初 DES-005 指定「ジャストパリィパニッシュカウンター」→ **2026-07-22 開発者指示で「パニッシュカウンター(ジャストパリィ反撃)」へ変更**(内部値・スキーマ影響なし・純粋な表示文言・半角括弧は既存規約に合致・「ジャストパリィを略さない」§4.5 方針は維持)。DES-005 のラベル表記および CHANGE-082 §2-c・指示書 §4.5・レビューチェックリスト §1.2 を中央で追随更新されたい。

### CHANGE-081 §2-b/§5 の是正要点（要中央改訂）
- CHANGE-081 §2-b の「seedgen の保全のみ→SQL 投入」「manon/luke は M14-03d/e 投入時に**自動反映**」は **v0.2.0 の backfill 専用確定と不整合**。seedgen は is_projectile を出力しないため自動反映されない。§5 の「seedgen（保全→投入）の変更」も撤回された。change-report-081 では backfill 専用・manon/luke は別途 backfill と記述されたい。

## 8. 申し送り・確認事項（中央へ）
- **A. manon/luke の is_projectile（要判断・指示書 §11-5）**: backfill 専用確定により、未 seed の manon/luke（true 5 件＝luke 5・manon 0）は自動反映されない。放置すると M18-02 の走査で projectile 除外が漏れる。**M14-03d/e の seed 投入時に is_projectile backfill を併走**させる作業項目化を要請。
- **B. 全 CSV 件数の乖離（報告）**: §3 の通り m_bison(1)/rashid(12) が RESEARCH B-2 後に追加され全 CSV=122。backfill（104）には影響なし。指示書の「是正後 全 CSV 109」表記の更新可否は中央判断。
- **C. seedgen 版数対応は M18-01 スコープ外**（指示書 §11-6 確定どおり）。将来 seed への is_projectile inline 出力は M14-03d/e 着手時に別途判断。

## 9. 消費した実マイグレ連番
- **000036 / 000037 / 000038 / 000039**（次の空き = **000040**）。搬送順 G-c→G-d→G-e→G-b で連続。既存マイグレ非改変。

*以上、M18-01 完了報告。*
