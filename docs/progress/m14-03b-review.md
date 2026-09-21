# M14-03b レビュー報告書

| 項目 | 内容 |
|------|------|
| 対象指示書 | `docs/instructions/M14-03b-distribution-seed.md` v2.3.0 |
| チェックリスト | `docs/instructions/reviews/M14-03b-review-checklist.md` v2.1.0 |
| 完了報告 | `docs/progress/m14-03b-completion-report.md` |
| レビュー実施日 | 2026-07-15 |
| レビュー種別 | 静的レビュー（read-only）＋ read-only ビルド/テスト/seedgen -check |

## 総評

seed 契約 6 件〔(a)〜(f)〕はいずれも実装・検証まで到達しており、重大（チェックリスト §9）判定はゼロ。既存マイグレ 000001〜000023 は非改変、スキーマ不変、取込経路（FR704）非復活、ryu の moves/combos 非改変（forward/back の additive 追加と denjin_charge scope 是正のみ）を実コードで確認した。`go build ./...`・`go test ./internal/...` は全 PASS、`go run ./cmd/seedgen -check` は「生成物は既存ファイルと一致」を返し、golden ドリフト防止も機能している。掃き取りの残行ゼロ検証（NOT NULL abort 技）・dup 再測定 0 件・clean DB 構築（t.TempDir）・alias 表記の 000006 踏襲まで丁寧。指摘はいずれも軽微〜中で、M14 完了を妨げるものはない。

## 設計準拠性レビュー結果

### seed 契約 6 件（チェックリスト §1）

- **(a) 移動 9 種×全キャラ＋alias 対**: ◎
  `migrations/000025_seed_movement_system_moves_all.up.sql` が全 12 characters へ 9 種を `NOT EXISTS` ガードで冪等投入し、official_ja_move alias を対で投入。ryu には既存 7 種と衝突せず forward/back のみ additive 追加（`000025:33-35` の存在チェック）。`TestRun_M1403b_SeedIntegrity`（`migrate_m1403b_test.go:61-77`）が「全 12 キャラ 9 種所持」「alias 欠落 0（生 code フォールバック無し）」を検証。alias 表記は `000006` の既存 ryu 表記（前ダッシュ/垂直ジャンプ/微歩き(前) 等）と完全一致でクロスキャラ整合（実 grep 確認）。ryu frame/recovery/combos 非改変も `TestRun_M1403b_DownRollback:202`（ryu 56→58→56）で担保。

- **(b) 掃き取りマイグレ**: ◎
  `000028_sweep_modifier_dash` は 000025 より後の連番。UPDATE-in-place のみで子 DELETE 非同居＝FK=OFF×明示 DELETE 非抵触（instruction §4.5・digest §5 準拠）。残行ゼロ検証は TEMP TABLE の `ok INTEGER NOT NULL` に `CASE WHEN …=0 THEN 1 ELSE NULL` を INSERT する巧妙な abort（`000028.up:64-73`）。`TestRun_M1403b_SweepMigratesSkippedDash` が skip 相当行を投入→移行→残行ゼロを実検証。down no-op の限界（marker 不在の非対称）は完了報告 §5 に明記。

- **(c) dup スキャン＋再測定**: ○
  生成時スキャン（`generate.go:110-121` の `seenCode`/`seenAlias`）で同一キャラ内 move_code 衝突・alias_text 衝突を検出し `validate` 全体 fail・一覧報告（自動リネームなし）。`mai` CA/SA3 name_ja 衝突を実際に検出→開発者承認のうえ CSV 是正した実例あり（完了報告 §3）。clean DB 全域再測定は `TestRun_M1403b_DupRemeasurement` が 3 軸とも 0 件を確認。
  △ 軽微: 生成時スキャンは **code・alias_text の 2 軸**のみで、`(preset_id, move_id)` の明示的事前チェックは実装されていない（完了報告 §2(c) は 3 軸と記載）。ただし 1 move につき official_ja_move alias は 1 件かつ move_code は一意のため同軸衝突は構造的に発生し得ず、再測定でも 0 が確認されている。機能影響なし・報告文言の精度のみ。

- **(d) target_combo passthrough**: ◎
  `Generate` は category を写像テーブルで enum 検証するのみで再分類せず、`TestGenerate_RemapAndRawData`（`generate_test.go:39`）が `'jumping_lariat', 'target_combo'` の無改変通過を担保。自動再分類・警告付与なし（CHANGE-065 準拠）。

- **(e) custom_states 新規 INSERT＋show_delta**: ◎（E2E 範囲に軽微留保）
  `000027` は lily/juri/kimberly/mai/guile を **UPDATE で state 定義を新規投入**（000024 で NULL の新規キャラ＝実質 INSERT）、ryu は既存 denjin_charge へ `scope:persistent` を `json_set` で是正（他フィールド温存）。JSON 構造は DES-003 §3.2（subject/scope/type/value_definition/activation/show_delta）と一致、guile solid_puncher は DES-003 記載例そのまま。show_delta=true は int(stock) の 5 state のみ（flag 非付与）で `TestRun_M1403b_SeedIntegrity:82-85` が検証。確定値は設計担当回答書（完了報告 §1・§4）に承認記録あり。
  △ 留保: 実データ E2E（`m14-03b-custom-states-realdata.spec.ts`）は **ingrid sun_crest のみ**を UI で行使。新規投入した lily/kimberly 等の def は SQL 整合テストで担保されるが UI E2E では未行使（チェックリスト §1(e) は「Ingrid＋対象キャラの実データ E2E」を要求）。完了報告 §4 が「本サブは moves のみ seed＝situation 写像は実データで未行使・E2E は Ingrid で実施」と根拠を明示しており、意図的・文書化済み。→ 中の推奨に留める。

- **(f) 索引モジュール IF**: ◎
  `internal/moveindex` は独立パッケージで、消費者は seedgen のみ（本体ランタイム・エンドポイント非露出＝instruction §2.3.1 準拠）。`skipReasonFor`（`moveindex.go:94-108`）が is_derived→空→`raw{`→`cond{` の順で非搭載判定し記録のみ（fail しない）。`Lookup` は id 昇順ソート済みリストの先頭返却＝id 最小タイブレーク、`LookupAll`/`Skipped`/`CharKeys` も具備。`moveindex_test.go` 6 ケース＋`TestGenerate_IndexExcludesDerivedAndEmpty` が非派生のみ索引化・タイブレーク・スキップ 4 種を検証。IF 仕様は完了報告 §2 に明記され M17 G-k の消費を塞がない。

- **移動 9 種 drop**: ◎
  `isMovementSystem`（`model.go:70-72`）が category=system かつ 9 種 code を drop、drive_parry は通過。`TestGenerate_DropsMovementSystemMove` が担保。実 CSV には移動 9 種が非混入のため `drop=0`（seedgen -check 出力・防御的 no-op）。※RESEARCH-02 の H-2「手入力 CSV に混入」前提と実 CSV は相違したが、drop ロジックは実在・テスト済で契約は充足。

- **ryu 非改変**: ◎
  000026 は FirstWaveOrder に ryu を含まず（`generate.go:15-17`）、ryu への変更は 000025 forward/back additive と 000027 scope 是正のみ。M14-03c 領域（moves 差し替え・combos クリア）に非侵入。

### マイグレ／seed の健全性（チェックリスト §2）

- 新規 000024〜000028 で追加、既存 000001〜000023 は差分ゼロ（`git diff --stat docs/design/` および migrations 差分で確認）: ◎
- FK 依存順 characters(000024)→moves(000025/000026)→preset_aliases、down は逆順（alias→moves、キャラ逆順）: ◎ `TestRun_M1403b_DownRollback` 往復 PASS。
- 冪等性: 000024 `ON CONFLICT DO NOTHING`、000025 `NOT EXISTS`、000027 UPDATE、000028 `WHERE move_id IS NULL` はいずれも冪等。000026 は素 INSERT（seed 生成物として通常運用）: ○
- ロスター非依存（行追加のみ・31 化で機構不変）: ◎
- clean DB 構築（`t.TempDir` 全マイグレ適用・dev DB 非流用）: ◎ 完了報告 §7。

### 温存対象の非破壊（チェックリスト §3・§7）

- 全スキーマ不変（INSERT/UPDATE と索引 IF のみ・moves 列追加なし）: ◎
- 技編集・comboio・recipe_hash・DuplicateKey 本体不変、situation opaque 素通し: ◎（差分に該当変更なし）
- 本体ランタイムへ取込経路非復活（seedgen は dev/build 専用・moveindex は runtime 非消費）: ◎
- 既存 ryu moves の total/frame/recovery 非改変・既存 seed(presets/classic3/Ingrid)非破壊: ◎ 既存テスト（SeedRowCounts 等）が追従のうえ PASS。

### 設計意図との整合（チェックリスト §5）

- SQL マイグレ経路（`.db` embed 非採用）: ◎
- 段階投入（10/30 キャラ投入・未投入 20 キャラ網羅表・blocker 未解除の明記）: ◎ 完了報告 §7。
- 「二度作らない」索引 IF（M17 再利用可・先行実装なし）: ◎
- dash 正典 DES-004 §2.1/§2.3 に一貫、§7.5/SUPP-001 §3.3.3 の失効記述に従った実装なし: ◎

## 設計準拠性以外の指摘事項

1. **[低] stale コメント**: `web/e2e/combo-csv-io.spec.ts:57-58` の「ken 等はキャラ行のみで moves が無く…クリーン DB では moves 0 件で落ちる」は、ken が 000026 で seed 済みになった現状では事実と乖離。spec 本体は ryu 使用・件数非依存（`>0`）で機能上は問題なし（instruction §4.9 の「ken 断定」は既に ryu 実装へ移行済み）。コメント更新のみ。

2. **[低] 無関係ファイルのコミット混入**: `docs/human-notes/Memo_Someday.txt`（+8 行・開発者の手入力メモ）が checkpoint コミットに `git add -A` で巻き込まれている（完了報告 §8-7 が自己申告済み）。CLAUDE.md スコープ厳守の観点では非本質差分。履歴整理時に分離推奨。

3. **[低] move_code 正準形検証の弱さ**: instruction §3.3-3 は「move_code のツール採番値の正準形検証」を求めるが、`validate` は空文字チェックのみで DES-004 §2.1 の書式（`^[a-z0-9_]+$` 等）は検証しない。CSV は開発者担保＋golden テストで固定のため実リスクは低いが、検証意図としては未達。

4. **[低] 承認記録の日付整合**: 完了報告の「設計担当回答書 2026-07-16」は実施日 2026-07-15 より後日付。承認記録自体は存在するが日付の前後関係に軽微な不整合（レビュー側では回答書実体を確認不可＝「不明: 回答書 2026-07-16 の実体は本レビュー範囲で未確認」）。

5. **[低] ブランチ差分にスコープ外資料が同梱**: 本ブランチ diff には M17-01/02 指示書・CHANGE-068・M14-RESEARCH-02 レポート等 M14-03b スコープ外のドキュメントが含まれる。いずれも docs のみで実コードに影響せず、設計カデンス上の同梱と判断。DES 設計書本体（docs/design/）は差分ゼロで「製造が DES 非編集」を満たす。

## 推奨修正（優先度別）

- **高（M14 完了前に修正必須）**: なし（チェックリスト §9 重大判定ゼロ）。

- **中（M15 着手と並行可）**:
  - 契約(e) の実データ E2E を新規投入キャラ（lily または kimberly の stock state）へも 1 本拡張するか、ingrid で代表担保する旨を E2E コメントに明記して意図を固定する（現状は完了報告 §4 のみに根拠が存在）。
  - 完了報告 §2(c) の「dup スキャン（…(preset_id,move_id)）」は生成時 2 軸＋再測定 3 軸である旨に文言を精緻化（実装との齟齬解消）。

- **低（将来対応）**:
  - `combo-csv-io.spec.ts:57-58` の stale コメント更新。
  - `Memo_Someday.txt` の履歴分離。
  - seedgen に move_code 正準形の軽量書式チェック追加（防御的・任意）。

## 良かった点

- **golden ドリフト検出**（`TestGolden_CommittedMigrationMatchesRegeneration`＋`cmd/seedgen -check`）で生成物と CSV の乖離を機械担保。手編集の温床を封じる良設計。
- **掃き取り残行ゼロの abort 機構**（`NOT NULL` 列＋`CASE … ELSE NULL`）はマイグレ内で宣言的に不変条件を強制する堅実な手法。
- **000025 down の精密逆写像**（ryu の既存 7 種を温存し forward/back のみ除去）と alias 表記の 000006 踏襲まで、既存資産への配慮が徹底。
- **dup スキャンが実運用で機能**（mai の CA/SA3 name_ja 衝突を検出→開発者承認のうえ是正）。設計どおりの守りが実際に働いた好例。
- SQL 文字列エスケープ（`sqlStr` の単一引用符二重化）・raw_data の `json.Marshal`＋空→NULL・recovery 非整数 fail・total 検算 fail など境界処理が網羅的でテスト済み。

## 制約事項

- 本レビューはコード上で判定可能な範囲のみ対象。E2E（Playwright）は本環境で独立実行しておらず、完了報告 §6 の「13 passed／既存 4 失敗は baseline 再現」は未検証。実機動作・パフォーマンス・配布 DB の実表示は別途確認が必要。
- 開発者承認記録（設計担当回答書 2026-07-16・§3.3-7/§3.3-9）の実体は本レビュー範囲で参照しておらず、完了報告の記載に依拠している。

---

## 取り込み結果（自動トリアージ・製造担当 2026-07-15）

重大（§9）指摘ゼロ。中/低の各指摘を以下のとおりトリアージした。**高の不採用は無し**（エスカレーション不要）。

| # | 指摘 | 優先度 | 採否 | 対応/理由 |
|---|------|--------|------|-----------|
| (e)E2E | 実データ E2E を新規キャラへ拡張 or ingrid 代表担保を明記 | 中 | **採用**（代表担保明記） | `m14-03b-custom-states-realdata.spec.ts` 冒頭に「int×show_delta の ①②③ UI は全キャラ共通機構＝ingrid を代表・新規 def は migrate 整合テストで担保」を明記。UI E2E の追加保存フローは flaky 増を招くため代表担保を採用（レビュー提示の代替案）。 |
| §2(c)文言 | dup 軸表記を生成時2軸＋再測定3軸に精緻化 | 中 | **採用** | 完了報告 §2(c) を「生成時 2 軸（code/alias_text）＋(preset_id,move_id) は構造的に衝突不能＝再測定 3 軸目で担保」へ修正。 |
| csv-io コメント | `combo-csv-io.spec.ts:57-58` stale コメント | 低 | **採用** | ken が 000026 で seed 済みの現状へコメント更新（本 spec は ryu 使用・件数非依存）。指示書 §4.9 スコープ内。 |
| move_code 書式 | 正準形の軽量書式チェック追加 | 低 | **採用** | `seedgen.validate` に `^[a-z0-9_]+$` 検証を追加（§3.3-3「正準形検証」を充足）＋テスト `TestGenerate_NonCanonicalMoveCodeFails`。実 CSV は全て正準のため golden 不変。 |
| Memo 混入 | `Memo_Someday.txt` の履歴分離 | 低 | **不採用（対応不可）** | git 履歴改変（reset/rebase）は CLAUDE.md §7 で開発者領域＝製造は実行不可。完了報告 §8-7 で申し送り済み。 |
| 承認日付 | 回答書 2026-07-16 が実施日 2026-07-15 より後日付 | 低 | **不採用（実害なし）** | 設計担当回答書の日付付与の産物で、承認内容自体は本セッションで受領済み・有効。記載は事実の反映。 |
| スコープ外 docs | ブランチ diff に M17 指示書等が同梱 | 低 | **不採用（非該当）** | 製造のコミットでなくブランチ既存物（設計カデンス同梱）。DES 本体（docs/design/）差分ゼロは確認済み。 |
