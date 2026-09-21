# M18-01 レビュー報告書

| 項目 | 内容 |
|------|------|
| 対象 | M18-01（確定反撃スキーマ基盤）実装。`4df5f28`〜`HEAD`（ブランチ `claude/senior-engineer-support-pjw43m`） |
| 判定基準 | `docs/instructions/phase3/reviews/M18-01-review-checklist.md` **v0.2.0**（指示書 §4/§5/§9） |
| レビュー実施 | 2026-07-22。Read 主体＋read-only な `go test`（migration/seedgen）実行のみ。コード・データ変更なし |
| 結論 | **重大問題なし。完了承認可**（下記の中/低指摘は M18 完了を妨げない） |

## 総評
指示書 v0.2.0（backfill 専用へ是正済み）の要点をすべて満たす、精度の高い実装。新表 3・新列 2 は完全に非破壊（CREATE/ADD のみ）で追加され、down は DROP COLUMN/DROP TABLE で忠実復元、連番は中央払い出し 000036–000039 を末尾 000035 実査の上で消費している。最重要ゲートである「seedgen が is_projectile を SQL 出力しない（12 列のまま）」「既存 seed マイグレ 000026/000030 非改変（golden byte-identical green）」「is_projectile backfill=104 の件数検算」を、いずれも専用テストで明示検証しており、チェックリスト §9 の重大問題は 1 件も検出されなかった。着手前 Plan Mode 実査で v0.1.3 の seedgen SQL 出力要件の破綻（golden 失敗・`no such column`）を発見しエスカレーションした判断も的確。指摘は設計逸脱ではなく、いずれもドキュメント整合・中央への申し送りに属する軽微事項のみ。

## 設計準拠性レビュー結果

### §1 設計・パターンとの照合
- §1.1 DDL — **✓**
  - `combo_punishes`：列・`UNIQUE(combo_id,opponent_move_id)`・`idx_combo_punishes_opponent_move`・guard_type 非保持を確認（`migrations/000036_...up.sql`）。指示書 §4.1 準拠。
  - G-d **2 表**を 1 マイグレで作成。`combo_punish_prunings(self_character_id,opponent_move_id)`／`combo_punish_curations(combo_id,opponent_move_id)`・curation は CASCADE。`combo_punish_exclusions`（旧単一表）は全コード・SQL に不在を grep で確認（`migrations/000037_...up.sql`）。指示書 §4.2 準拠。
  - `combos.materialized_from_combo_id`：self-FK・nullable・相手技列なし（`000038_...up.sql`）。§4.3 準拠。
  - `moves.is_projectile INTEGER NOT NULL DEFAULT 0`（`000039_...up.sql`）。§4.4 準拠。
- §1.2 hit_type 拡張 — **✓**
  - `HitTypeJustParryPunishCounter = "just_parry_punish_counter"`（"jp" 略なし・`internal/model/combo.go:13`）。
  - FE ラベル「ジャストパリィパニッシュカウンター」、既存 punish_counter ラベル据置（`web/src/features/combo/labels.ts:44-62`・`web/src/constants/combo-list.ts:96-101`）。
  - VAL whitelist（`internal/service/comboio/csvcore/rules.go:50-52` `DefaultHitTypes`）・CSV 写像・比較/絞り込みに新値。DB CHECK 新設なし＝マイグレ非消費。§4.5 準拠。
- §1.3 搬送順・連番 — **✓**
  - 搬送順 G-c(000036)→G-d(000037)→G-e(000038)→G-b(000039) で連続。`ls migrations/` 末尾は 000035（実査確認）→ 中央払い出し値をそのまま使用。消費連番は完了報告 §9 に明記（次 000040）。

### §2 データ・API 契約・スキーマの不変（非破壊性） — **✓**
- 既存マイグレ（000001–000035）は diff 対象外＝一切改変なし（`git diff --stat` は 000036–000039 のみ）。
- `DuplicateKey`（6 項）・`CalcRecipeHash` のロジック改変なし。hit_type 新値は whitelist 追加のみで自動的に別コンボ扱い（`repository_test.go:644` で実証）。
- 既存 `combos`/`moves` 他列・既存 API レスポンス不変（ADD COLUMN のみ）。

### §3 フロントエンドの動作仕様 — **✓**
- 新値は集約定数 2 本（`HIT_TYPE_VALUES`／`HIT_TYPE_LABELS`／`HIT_TYPE_OPTIONS`／`HIT_TYPE_LABEL_JA`）に一元追加され、消費側（`ComboEditorBasicFields.tsx:238` 編集・`ComboListFilters.tsx:145` 絞り込み・`CompareTable.tsx:95` 比較・`ComboDetailHeader.tsx:91` 詳細・`export-model.ts:82` エクスポート・`DuplicateRealtimeWarning.tsx:33`）が全て `labelFor`/map 経由で拾う。散在リテラルなし（grep 確認）。既存 3 値の表示・挙動不変。
- zod（`schema.ts:46` `hitType: z.string().min(1)`）は enum 非採用のため新値追加で修正不要＝取りこぼしなし。
- `note` 列の UI 露出なし（本サブは列のみ）。

### §4 テストの妥当性 — **✓**
- マイグレ up/down 4 本の往復整合・再 up・dbtest 反映（`migrate_m1801_test.go:20` `TestRun_M1801_SchemaUpDown`）。実行 green（当方で `go test ./internal/infra/migration/ -run TestRun_M1801` 実行・ok）。
- FK CASCADE（punishes/curations 消滅・prunings 残存）＋ self-FK 有効/不正（`:134` `TestRun_M1801_FKCascade`）。3 表 UNIQUE 重複弾き（`:107`）。
- **is_projectile 件数検算 = 104 を assert**（`:76` `SELECT count(*) ... is_projectile=1 → want 104`）＋ 0/1 整合・代表行 kimberly/shuriken_bomb_light・is_derived 独立性・throw に立たない。E-16/E-18 準拠。
- **seedgen 非改変**：`writeMovesInsert`（`internal/seedgen/generate.go:192`）は 12 列（`character_id,code,category,damage,startup,active,total,on_hit,on_block,recovery,is_aerial,raw_data`）で is_projectile を含まない。`TestGenerate_IsProjectileNotEmitted`（`generate_test.go:52`）が up/down SQL 双方に is_projectile が現れないことを明示 assert。`testHeader`（`:10`）は 20 列不変。`model.go` は is_projectile コメント更新のみ（`:9`/`:59`）。CSV 是正 7 件投入後も `TestGolden_*`（000026/000030 byte-identical）green（当方で実行・ok）。
- hit_type：新値 round-trip（`csvcore_test.go:107`）・既知 4 値受理＋未知値 EnumStrict 棄却（`:132`）・同一レシピ×punish_counter/just_parry_punish_counter 別コンボ（`repository_test.go:644`・E-19）・FE ラベル（`utils.test.ts:69`）。

### §5 設計意図との整合 — **✓**
- pruning=マッチアップ単位／curation=個別コンボ単位の粒度差を保持（DDL のキー・CASCADE の非対称、up.sql コメントで明記）。curation をマッチアップ単位へ戻していない。
- combo_punishes は「キュレート分のみ保存」の器（全集合非保存をコメント明記）。
- materialized_from は出自記録のみ。生成規則・ダメージ・hit_type 分岐・G-b 算出式の前倒し実装なし（M18-03/02 スコープ厳守）。

### §6 コード品質・規約遵守 — **✓**
- 「ジャストパリィ」を略さず定数・ラベル・コメントで一貫。
- マイグレは可逆前進・down 忠実復元・既存非改変。**FK=OFF × 明示 DELETE 非同居**：本サブ up は CREATE/ADD のみ（`PRAGMA foreign_keys`/`DELETE FROM` を grep で 0 件確認）、down は DROP COLUMN/DROP TABLE。digest §5 準拠。

### §7 既存挙動の温存（E2E） — **△**（環境要因・製造の瑕疵ではない）
- E2E は本リモート環境の Playwright ブラウザ版数不一致（pin 1.60=build1223 に対しコンテナ 1194）により未実行（完了報告 §6）。製造は Go 統合テスト（実マイグレ＋FK CASCADE＋全 seed dbtest）＋FE コンポーネントテスト＋本番ビルド green で非回帰を代替担保。E2E §5.2-A/B の最終確認は pin 一致環境での再実行が必要（制約事項に記載）。

### §8 ドキュメント・進捗ログ — **✓**
- 完了報告（`docs/progress/phase3/M18-01-report.md`）に DES 反映要点・CHANGE-081 §2-b/§5 是正要点・消費連番・件数検算・golden green・触ったファイル一覧（E-14）を網羅。DES 本体の直接編集なし（中央反映に委譲）。

## 設計準拠性以外の指摘事項
1. **指示書ファイル本体が v0.1.3 のまま（版ドリフト・トレーサビリティ）**：`docs/instructions/phase3/M18-01-schema-foundation.md` はヘッダ・§4.4（`:32`「seedgen が…is_projectile を SQL 出力する」／`:189`「moves の INSERT に is_projectile を出力」）が**旧 v0.1.3 の撤回済み要件のまま**残存。v0.2.0 へ是正されたのは**チェックリストのみ**（commit `76d34cc`）。実装は正しく v0.2.0（backfill 専用）に従っており、完了報告 §1 もその経緯を明記しているため**実装上の欠陥ではない**が、ディスク上の指示書を将来読む者に誤った（撤回済みの）指針を与える。中央での指示書ファイル v0.2.0 反映を要請。
2. **CHANGE-081 §2-b/§5 の記述矛盾（製造が正しく検出・申し送り済み）**：CHANGE-081 の「seedgen 保全→SQL 投入」「manon/luke 自動反映」は backfill 専用確定と不整合。完了報告 §7 で change-report-081 の是正を要請済み。製造の対応は妥当、追加作業不要。指摘は中央の反映待ちという状態の確認のみ。
3. **manon/luke の is_projectile 未反映（設計上の残課題・製造申し送り済み）**：backfill 専用のため未 seed の luke（true 5 件）は M18-02 走査時に projectile 除外漏れの恐れ。完了報告 §8-A で M14-03d/e 投入時の backfill 併走を要請済み。本サブのスコープ外であり、指摘の妥当性を確認。

## 推奨修正（優先度別）
- **高（M18 完了前に修正必須）**：なし。**チェックリスト §9 の重大問題ゼロ**、§1〜§6・§8 は全 ✓、§7 は環境要因の △。
- **中（M18-02 着手と並行可）**：
  - 指摘 1：中央で指示書 `M18-01-schema-foundation.md` を v0.2.0（seedgen SQL 出力要件の撤回）へ反映（製造作業ではなく中央タスク）。
  - 指摘 3：manon/luke の is_projectile backfill を M14-03d/e の作業項目として登録（M18-02 走査前に解消されていること）。
- **低（将来対応）**：
  - E2E §5.2-A/B を pin 一致（build 1223）環境で `make e2e` 再実行し非回帰を最終確認。
  - CHANGE-081 の change-report 反映（中央）。

## 良かった点
- 着手前 Plan Mode 実査で v0.1.3 の seedgen SQL 出力要件が (a) golden byte-identical 失敗、(b) 既存マイグレ改変抵触、(c) 000026/000030 が 000039 前に実行され `no such column` で実行不能、の 3 点で破綻することを発見しエスカレーションした判断が的確。指示書の字面に盲従せず設計の整合を守った。
- backfill 件数 104 を「移送マイグレの UPDATE 分解（terry4+guile24+ingrid33+kimberly6+juri5+ken4+mai20+ryu8=104）」と「テストの `count(*)` assert」の両面で検算し、完了報告 §3 で全 CSV 122 との乖離（m_bison1+rashid12＝RESEARCH スナップショット後の未 seed キャラ・backfill 非影響）まで内訳提示。E-16/E-18 の「数えた対象・母数併記」を厳密に満たす。
- CSV 是正が is_projectile 列（13 列目）のみをピンポイントで反転し（is_aerial/is_derived を巻き込まない・diff で確認）、生成 SQL のバイト列に影響しないことを golden green で保証。
- テストが「新値受理／未知値棄却／既存不変／round-trip／dup 別コンボ／FK 粒度非対称／self-FK 正負」を過不足なく網羅し、各テストに設計根拠（FR301/E-19 等）をコメントで紐づけている。

## 制約事項
- 本レビューはコード上で判定可能な範囲のみ対象。実際の動作確認・パフォーマンス・実機テストは別途実施が必要。
- E2E（§5.2-A/B）は本環境の Playwright ブラウザ版数不一致により未確認。pin 一致環境での再実行を要する。
- レビュー実行の read-only テストは migration（`TestRun_M1801`）・seedgen（`TestGolden`・全体）に限定。FE vitest・全 Go スイートの green は完了報告の記載（Go 全 40 パッケージ・FE 783 テスト）に依拠し、当方では未再実行。

---

## 取り込み結果（自動トリアージ・製造担当 2026-07-22）

レビュー結論は「重大問題なし・完了承認可」。§9 重大問題ゼロ、§1〜§6/§8 全 ✓、§7 は環境要因の △。優先度「高」の指摘はゼロのためエスカレーション対象なし。各指摘の採否と理由は以下（同内容をチャットにも提示済み）。

| # | 指摘（優先度） | 採否 | 理由 |
|---|----------------|------|------|
| 1 | 指示書ファイル本体が v0.1.3 のまま（中） | **不採用（中央タスクへ）** | レビュアー自身が「製造作業ではなく中央タスク」と明記。CLAUDE.md §8 により指示書/設計書の canonical 反映は中央（三点セット＝改訂＋change-report＋registry）の責務で、製造は直接編集しない。実装は正しく v0.2.0（backfill 専用）に従っており実装欠陥ではない。開発者リレーで中央へ v0.2.0 反映を要請する（完了報告 §7 の DES 反映要点と併せて申し送り）。**なお本サブ内で `docs/instructions/phase3/reviews/M18-01-review-checklist.md` は Phase B レビューの判定基準として v0.2.0 を要したため開発者提供内容を persist 済み。指示書本体との版整合（registry 反映含む）は中央で一括反映されたい。** |
| 2 | CHANGE-081 §2-b/§5 の記述矛盾（中） | **不採用（対応済み・中央反映待ち）** | 完了報告 §7 で change-report-081 の是正（「保全→SQL 投入」「manon/luke 自動反映」の撤回）を既に要請済み。レビュアーも「製造の対応は妥当・追加作業不要」と評価。change-note の canonical 反映は中央。 |
| 3 | manon/luke の is_projectile 未反映（中） | **不採用（意図的スコープ境界・申し送り済み）** | backfill 専用確定に伴う正当な設計判断で、指示書 §1.3/§4.4-3/§11-5 でスコープ外と確定。完了報告 §8-A で M14-03d/e 投入時の backfill 併走を要請済み。M18-02 走査前に解消されるべき follow-up として登録済み。本サブでのコード変更は不要。 |
| 4 | E2E 未実行（低・環境） | **不採用（環境制約・修正不能）** | 本リモート環境の Playwright ブラウザ版数不一致（pin build1223 / 同梱1194）による。コード側の修正対象ではなく、pin 一致環境での `make e2e` 再実行が必要（完了報告 §6・制約事項に記載済み）。 |

**結論**: レビューで指摘された事項にコード修正を要するものはゼロ（全て中央反映・意図的スコープ・環境要因）。M18-01 実装は完了承認可の状態を維持。優先度「高」の不採用はないため開発者エスカレーションは不要。
