# 改善レーン報告書 第二弾（Fable 5・2026-07-03）

> **位置づけ**: 改善レーン第一弾（`combmgr-improvement-lane-fable-report.md`・2026-07-02）の残課題対応。
> ブランチ `wt/fable-integration-2`。残課題の入力 = 開発者メモ（tmp/memo_fable_remain.txt）＋第一弾報告書 §3/§5-2 ＋ pending-decisions。
> バグ・不整合はすべて**疑い・仮説**として記載（断定しない）。
> **§2 は未実行分を下位モデル（Opus/Sonnet）が単独で実装できる粒度の手順書**にしてある（開発者依頼）。

---

## §1 やったこと（意味の塊ごと・コミット対応）

コード修正は「失敗する再現テスト → 修正 → テスト通過」の順で実施。
最終確認: `go test ./...` 全パス／FE `pnpm test -- --run` 560件全パス／E2E 15件全パス（使い捨てDB・8.6s・リトライなし）。

| # | コミット | 内容 | 添えたテスト |
|---|---|---|---|
| 1 | `5c504d1` | **B8** 存在しない preset_id の GET /recipe が 500 → 404 に是正。`notation.ErrPresetNotFound` センチネル新設＋`ResolveComboRecipe` 冒頭でプリセット存在検証（不在エントリの recipe_cache 書込も防止） | service 層1件（ErrPresetNotFound・cache 非汚染）＋ handler 層1件（404） |
| 2 | `0f4cd71` | **B10** 一覧 `?is_draft=` のパース失敗黙殺 → 400 に統一（character_id/tag_ids と対称化）。FE は常に `"true"/"false"` を送るため既存動作への影響なし | `?is_draft=yes` → 400 かつ service 未呼出 |
| 3 | `f1ac815` | **B9** コンボ一覧ページングの ORDER BY 全経路（named/default/未知）に `id` 副次キーを追加し全順序を確定 | 全行同値キーでページ跨ぎの重複・欠落なし |
| 4 | `f413d2c` | **§3-6** followup-backlog の M 番号を新体系へ同期（旧 M17→M20／M18→M21／M19→M22／M20→M23、「新番号（旧MXX）」併記方式・overview §3/§5/§7 と逐条突合）。offdesk-lane-backlog は既存流儀に合わせ注記3箇所のみ | —（doc。コミット単独で巻き戻し可） |
| 5 | `9deb25a` | **§5-2-3** stop-test フックに `migrations/*.sql` → `make test-go` の差分ゲート追加（非ブロック性は不変） | ダミー差分でトリガ判定を手動確認 |
| 6 | `372b0d2` | **§5-2-1** `/audit_validation_coverage` 新設（VAL コード50種 × Go実装/Goテスト/FE/E2E 言及マトリクス＋service 経路別 validation.* 呼出一覧。read-only・AI不要） | 実行して現状マトリクス出力を確認（→ §3 の新発見） |
| 7 | `90d86e2` | **§5-2-5** `/check_derived_docs` 新設（派生4資料の「源泉最終コミット > 生成コミット」警告＋再生成手段の案内。read-only） | 実行して当レーン起因の陳腐化を正しく検出 |
| 8 | `0f0a19a` | 派生資料の再生成・同期（code-facts=日付のみ・docs-map=M15 資料反映・custom-commands に新コマンド2本＋Stop フック説明更新） | — |
| 9 | （本コミット） | 本報告書＋pending-decisions 更新＋INDEX 追記 | — |

**開発者との合意事項（セッション中）**: メモ#1/#3/#5（監査コマンド・migrations ゲート・鮮度チェック）は実装まで実施。メモ#2（_wt 統合）・#4（PreToolUse フック）は**運用変更のため設計提案書止まり**（§2-2/§2-3）。

---

## §2 未実行分の実装手順書（下位モデル向け・Opus/Sonnet で実装可能な粒度）

> 各項目とも「前提 → 手順 → テスト → やってはいけない」の順。着手前に対象ファイルの現物を必ず読むこと（本書の行番号は 2026-07-03 時点）。

### §2-1 SQLite 接続プール上限＋入れ子クエリ解消（第一弾 §3-3・🔴開発者承認必須）

- **前提**: データ層の根のため**開発者の承認を得てから着手**。2つの変更は**必ずセットで・入れ子解消を先に**。
- **手順A（入れ子解消・先行）**: `internal/repository/setup/repository.go` の `FindDuplicateInCombo`（:620 付近）は `rows.Next()` ループ内で `r.FindStepsBySetupID`（:646）を同一 `*sql.DB` に発行する N+1 構造。これを2パスに直す:
  1. 第1パス: rows から候補 `setupID` を全部 `[]int64` に収集して `rows.Close()`（`defer` 済みでも明示 Close が安全）。
  2. 第2パス: 収集済み ID をループして `FindStepsBySetupID` を呼び比較する（既存の比較ロジックはそのまま移す）。
- **手順B（プール上限・後続）**: `internal/infra/db/db.go` の PRAGMA 適用（:41-44）の後に `db.SetMaxOpenConns(4)` / `db.SetMaxIdleConns(4)` を追加。値は開発者と相談（WAL は多読者・単一書込者。1 にする場合は手順A完了が絶対条件）。
- **テスト**: 既存 `internal/repository/setup/repository_test.go`（515行・FindDuplicateInCombo のテストあり）が回帰網。手順B後に `go test ./...` 全体（並行アクセスするテストが接続枯渇しないこと）。
- **やってはいけない**: 手順Aなしで `SetMaxOpenConns(1)`（FindDuplicateInCombo が即デッドロック）。busy_timeout(5000) の削除。

### §2-2 _wt コマンド6本の統合廃止（メモ#2・設計提案・開発者承認必須）

- **対象**: `.claude/commands/` の4ペア（implement_plan / incorporate_plan / research_plan / review_plan と各 `_wt`）。`_wt` 版は「worktree ガード前置＋本体を Read して従う」だけの薄いラッパー（implement_plan_wt.md 1866B で確認済み）。
- **手順**:
  1. 本体4コマンドの冒頭に条件付きガード節を追加: 「`pwd` を確認し、パスに `/wt-` セグメントを含む場合は worktree モードとする＝相対パスのみ使用・worktree 外の読み書き禁止・git 操作は全面禁止（チェックポイントコミット許可も無効化）」。判定は `git rev-parse --show-toplevel` の結果が `/wt-` を含むかでも可。
  2. `_wt` 4ファイルを削除（もしくは1行の「本体へ統合済み」スタブに置換して1マイルストーン残す）。
  3. `docs/human-notes/custom-commands.md` の「git worktree 並列作業用（`*_wt`）」節と `docs/human-notes/worktree-scripts-guide.md` を改訂。端末エイリアス `cmds` の表示も確認。
- **テスト**: worktree 内・外それぞれで本体コマンドを1回起動し、ガードの発火/非発火を目視確認。
- **やってはいけない**: ガード統合前に `_wt` を消すこと（保護の空白期間ができる）。`implement_plan_full` への波及変更（_wt 版が元々ない）。

### §2-3 worktree 封じ込め PreToolUse フック（メモ#4・設計提案・開発者承認必須）

- **設計案**: `.claude/settings.json` に PreToolUse フック（matcher `Edit|Write|MultiEdit`）を追加し、`.claude/hooks/pre-edit-containment.sh` を新設。stdin JSON から `tool_input.file_path` を取り、`git rev-parse --show-toplevel`（=セッションの作業リポジトリ）の外なら **exit 2**（ブロック）＋理由を stderr へ。
- **必須の許可リスト（誤ブロック防止）**: `~/.claude/plans/`（プランファイル）、`~/.claude/projects/*/memory/`（メモリ）、`$CLAUDE_JOB_DIR/tmp`（ジョブ一時領域）。これらはリポジトリ外だが正当な書込先。**この allowlist の漏れが全レーンの編集を止める事故になるため、開発者レビュー必須**。
- **テスト**: worktree 内ファイル（通過）・親リポジトリのファイル（ブロック）・プランファイル（通過）の3ケースを手動確認。
- **やってはいけない**: allowlist なしでの導入。exit 2 以外（exit 1 は警告扱いでブロックされない）。

### §2-4 F7: useUpdateConfig の invalidate 追加（低・任意）

- `web/src/features/config/useUpdateConfig.ts` の `onSuccess` は `qc.setQueryData(CONFIG_KEY, data)` のみ（:12）。`qc.invalidateQueries({ queryKey: CONFIG_KEY })` を追加すると他コンポーネントの再フェッチが確実になる。ConfigResponse は全項目返却のため実害は薄い＝**優先度低**。既存の config 系 vitest に onSuccess の invalidate 検証1件を追加。

### §2-5 post-edit-check.sh への eslint 追加（メモ#7・低）

- `.claude/hooks/post-edit-check.sh` の `.ts|.tsx` 分岐（現状 `pnpm exec tsc --noEmit` のみ）に `pnpm exec eslint <対象ファイル>` を追加。フックの timeout は 90s（settings.json）なので、初回 eslint 起動込みで収まるかを1度計測してから入れること。非ブロック（exit 0）の性質は維持。

### §2-6 /pending_decision クイック追記コマンド（メモ#6・低）

- pending-decisions.md の書式（🔴🟡⚪🔵⏳✅➡️・表形式）に準拠した1エントリを対話で組み立てて追記するだけの軽量コマンド。`/create_command` に本説明を渡して設計させるのが早い（重複スキャン・ルーブリック判定込み）。

---

## §3 新規発見（本レーンで検出・未修正）

### §3-1 VAL-C01 の DES-006↔実装 不整合疑い【中・設計担当確認】
- 症状（疑い）: DES-006 は「VAL-C01（当初=ダメージ履歴比較警告）は削除した」と明記しコンボ表（§2）に C01 行が無いが、実装は `CodeC01CharacterExists = "VAL-C01"`（`internal/service/validation/combo.go:19`）として**キャラ存在検証（ERROR）**に使用している。本登録時のキャラ存在検証は DES-006 の表に対応行が無い（D01=仮登録・S01=セットプレイのみ）。
- なぜ問題か: 設計書とコードで同一 VAL-ID が別意味。監査・レビューで「C01 は削除済みのはず」と誤読するリスク。
- 推奨: 設計担当が DES-006 §2 に「VAL-C01（キャラ存在・ERROR）」行を追加するか、実装側の ID を改番するかを判断（改番は FE/テストへの波及があるため CHANGE 起票が妥当）。**実装調査資料・設計書とも本レーンでは未修正**。
- 検出手段: 新設 `/audit_validation_coverage` の初回実行（機構が初日に1件拾った実例）。

### §3-2 テスト言及ゼロの VAL コード5種【低〜中・テストの穴の候補】
- `/audit_validation_coverage` §2 警告より: **VAL-D01**（仮登録キャラ存在）・**VAL-I05**（CSV 型検証）・**VAL-I09**（インポートサマリ表示）・**VAL-T01**（タグ名一意）・**VAL-T03**（使用中タグ削除）は Go 実装言及ありだが Go テストファイルに文字列言及ゼロ。
- 注意: 「言及ゼロ=未テスト」とは限らない（定数間接参照・挙動テストのみで ID 非記載の可能性）。各コードの実挙動テストの有無を確認してから補強を判断すること。I09 は表示要件のため FE/E2E 側が適所の可能性。T01/T03 は第一弾 B11・§3-11 と同域（タグ削除ガードのセマンティクス要判断が先）。
- 推奨: 次の改善レーン or 該当ドメインを触るマイルストーンで、ID 明記の characterization テストを追加。

### §3-3 継続事項（第一弾からの持ち越し・状態変化なし）
- **hit_type/stance ラベル2系統分裂（第一弾 §3-1・高）**: M15-02 マージ後も現存を確認（labels.ts:31,46 vs combo-list.ts:92,97。M15-02 は両ファイルに非接触）。M15 が入力・表記領域で進行中（M15-03 待機）のため引き続き回避。**M15 レーンでの一元化を推奨**。
- SQLite プール（→ §2-1）・タグ削除ガード文言（第一弾 §3-11）・future-notes 昇格3件（§3-8）・features.txt（§3-10）は pending-decisions の 🔴 のまま変化なし。

---

## §4 資料不整合レポート（指摘のみ・未修正）

1. **VAL-C01**: §3-1 のとおり（DES-006 は設計書のため本レーン非編集）。
2. **phase3-overview.md 行135「次採番 053」**: M13 節内の記述が残存（正: 056。ヘッダ・§5 は整合済み）。docs/instructions は本レーン修正不要指定のため指摘のみ。
3. **progress-log.md に M15 の記録が無い**（当ブランチ基点時点。main 側は M15-02 マージで更新済みの可能性が高い＝マージで解消見込み。docs/progress は修正不要指定）。
4. followup-backlog の M 番号未同期（第一弾 §3-6）は**本レーンで解消**（`f413d2c`）。

---

## §5 main へのマージ可否チェック（開発者依頼・2026-07-03 時点）

- main は `2e7271b`（feature/m15-02 マージ済み）。当ブランチの基点 `962848e` はその直系祖先で履歴の食い違いなし。
- マージベース以降の変更ファイルは**両側で交差ゼロ**（main 側=M15-02 の FE help/info-mark・locales・progress-log、当方=Go 3ファイル＋テスト・handover/human-notes 文書・.claude/scripts）。
- `git merge-tree --write-tree`（read-only シミュレーション）で**競合ゼロ**を確認（本報告書時点の再確認は最終コミット後に実施・結果は末尾に追記）。
- 意味レベルの衝突も考えにくい（M15-02=FE ヘルプ表示、当方=BE エラー処理/ソート・プロセス整備）が、**マージ後に `make test` を1回**推奨。FE テスト件数は main 側 571 件（M15-02 完了報告）になる見込み。

## §6 検証サマリ

| 対象 | コマンド | 結果 |
|---|---|---|
| Go 全体 | `go test ./...` | 全パス（失敗0） |
| FE 全体 | `cd web && pnpm test -- --run` | 560件全パス（当ブランチ。main は 571 件見込み） |
| E2E | `make e2e` | 15件全パス（使い捨てDB・8.6s・リトライなし） |
| 新設スクリプト | `bash scripts/audit-validation-coverage.sh` / `check-derived-docs.sh` | 正常出力・既知事実と整合（前者は §3-1/§3-2 を検出） |
| マージ可否 | `git merge-tree` | 競合ゼロ（§5） |
