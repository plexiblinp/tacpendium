# 改善レーン報告書（Fable 5・2026-07-02）

> **位置づけ**: 改善レーン（テスト網羅監査＋補強／ドキュメント整合監査／リファクタ／放置バグ探し／プロセス改善提案）のフェーズD引き継ぎ。
> ブランチ `wt/fable_integration`。要判断は `combmgr-pending-decisions.md` に合流済み（本書は詳細の置き場）。
> バグ・不整合はすべて**疑い・仮説**として記載（断定しない）。

---

## §1 やったこと（意味の塊ごと・コミット対応）

各修正は「失敗する再現テストを先に追加 → 修正 → 全テスト通過」の順で実施。
最終確認: `go test ./...` 全パス（31パッケージ）／FE `pnpm test -- --run` 560件全パス／E2E 14件全パス（クリーンDB・7.9s）。

| # | コミット | 内容 | 添えたテスト |
|---|---|---|---|
| 1 | `01946f1` | **B1** PATCH /combos の範囲バリデーション欠落（VAL-C04/C05/C13 が素通り）＋昇格時フルバリデーションが DB 旧値に対して実行されていた疑いを修正。範囲チェックの一次情報を `validation.ValidateMetadataRanges` に集約 | 範囲3種ブロック・C10警告は保存継続・昇格時新値検証の計5ケース |
| 2 | `93b5ec7` | **B2** タグ usage_count が論理削除（ゴミ箱内）コンボを数えていた疑いを修正（`listWithUsage` に `deleted_at IS NULL`）。**削除ガード CountUsage は意図的に未変更**（§3-11 参照） | ゴミ箱境界の再現テスト |
| 3 | `f50620a` | **F3/F4/F5** FE mutation フックの invalidate 漏れ（mycombo→combo詳細・setup→紐付け候補）＋ステータスタグ未ロード中の二重付与レース修正 | vitest 4件（invalidate 2・ガード1・候補キャッシュ1） |
| 4 | `5b3d4cd` | **F2** en.json 欠落4キー補完＋en 側デッドキー7個削除＋**ja↔en キー同値性テスト新設**（今後のキー追加漏れを機械防止） | `web/src/locales/locales.test.ts`（双方向パリティ） |
| 5 | `4948102` | **S2/S3** 未カバー領域のテスト新設: api/middleware 12件（CORS/RequestID/Logger・SUPP-001 §2.6.1/§5.6 の挙動固定）＋ repository/character 6件 | 18件（characterization・実装無変更） |
| 6 | `b48c15e` | **E1/E2** E2E を使い捨てDB＋専用ポート（BE 47390/Vite 5273）の独立スタック化。`TACPENDIUM_DB_PATH`/`TACPENDIUM_PORT` env 上書きを追加（既存 `TACPENDIUM_LOG_LEVEL` と同パターン・validate 適用・テスト付き）。L-04 フォールバック永続化は env 上書き中スキップ。combo-csv-io の ken 残渣依存（既知・配布前修正必須）を ryu に是正 | config 上書き3ケース＋E2E全14件クリーンDB通過 |
| 7 | `7329786`〜`bcf66a6` | **Stage3** future-notes 実整理: Zone.Identifier 9個削除／役目を終えた8ファイルを archive/ 退避（陳腐化プロンプト3本に破棄記録付与）／INDEX.md 新設（棚卸し・正本指針） | —（文書。各コミット独立に巻き戻し可能） |
| 8 | `a15e2b2` | **D1** CLAUDE.md 陳腐化是正（フェーズ表記・E2E導入済み）。再発防止として「現在地は progress-summary 参照・本ファイルにハードコードしない」を明文化 | — |
| 9 | `a9725b2` | **P1/P2** .claude/commands 16個に description frontmatter 補完（本文無変更）＋ generate-docs-map.sh に実行ビット | — |
| 10 | （本コミット） | **Stage5** 本報告書・pending-decisions 合流・offdesk-lane 3テーマ追記（pending-decisions「取りこぼし」①②⑤の解消） | — |

**承認済み計画からの軌道修正（2点・重要）**:
- **B2 の削除ガード（CountUsage）は変更しなかった**。計画では JOIN 化予定だったが、実装調査で VAL-T03 が「WARNING・確認して続行」であり、ゴミ箱内コンボが参照するタグの削除を許すと**復元時にタグが静かに失われる**（force 削除は CASCADE）ことが判明。表示（listWithUsage）のみ修正し、ガードのセマンティクスは §3-11 として要判断化。
- **S1/S4（service/preset・user ドメインのテスト新設）は対象が存在しなかった**。`internal/service/preset`・`internal/service/user`・`internal/repository/user`・`internal/api/user` はいずれも doc.go のみのプレースホルダ（§4 資料不整合参照）。

---

## §2 E2E 基盤の新仕様（開発者向け・運用変更あり）

- `make e2e` は **web/e2e/.tmp/ の使い捨て DB**（毎回起動時に破棄→マイグレ＋seed 自動適用）と**専用ポート**（バックエンド 47390・Vite 5273）で実行される。**dev DB・dev サーバ（47330/5173）・並行 worktree レーンに影響しない**。
- `reuseExistingServer: false` のため、47390/5273 を何かが掴んでいると明示エラーになる（従来のような「起動中の dev サーバを暗黙再利用して dev DB に残渣を書く」ことはなくなった）。
- 環境変数 `TACPENDIUM_DB_PATH` / `TACPENDIUM_PORT` は開発・テスト用の一時上書き。PUT /api/config を上書き有効中に呼ぶと値が config.toml に焼き付く既知制約あり（config.go のコメント参照。現行 E2E は /api/config を呼ばない）。
- ハマりどころ（実際に踏んだ）: **playwright.config.ts のモジュールスコープで DB を削除してはならない**。ワーカープロセスが config を再ロードするたびに稼働中バックエンドの DB を消し、全 API が `no such table` で 500 になる。破棄はバックエンド起動コマンド内で行う（config 内コメントに明記済み）。

---

## §3 発見（未実行分）— 詳細

> 番号は pending-decisions からの参照先。書式: 症状／該当箇所／なぜ問題か／推奨対応／**やってはいけない対応**／重要度。

### §3-1 hit_type / opponent_stance の表示ラベル2系統分裂【高・要判断】
- 症状: 編集画面で「カウンターヒット」「どちらでも可」を選んで保存すると、一覧・詳細・比較・export では「カウンター」「不問」と表示される（同一コード値に対し実際に文言が異なる）。
- 該当: `web/src/features/combo/labels.ts:31,45-46` vs `web/src/constants/combo-list.ts:92,96-97`（消費側: ComboDetailHeader/ComboTableRow/CompareTable/ComboListFilters/export-model）。
- なぜ問題か: ユーザーが「保存した値と違う」と誤認する。POSITION/OPPONENT_SIZE は両系統で一致しており、hit_type/stance だけ取り残された疑い。
- 推奨: ラベルマップを単一ソースに統合（どちらかの文言に寄せる判断が要る）。**M15（表記整理・並行実施中）と同じ領域のため衝突回避で未実行**。
- やってはいけない: 片側の文言だけ直して2系統構造を残すこと（再発する）。M15 レーンと同時に触ること。
- 重要度: 高（全ユーザー常時遭遇・ただし実害は誤認のみ）。

### §3-2 recipe_cache の非トランザクション read-modify-write【中・M20】
- 症状: 同一コンボへ別 preset の GET /recipe が並行到来すると、cache JSON の読取→追記→書戻しが last-writer-wins になり片方の preset エントリが一時消失しうる。
- 該当: `internal/service/notation/cache.go:14-48,82-137`、`setup_resolver.go:31-65`。
- 推奨: M20（recipe_cache 無効化トリガ配線）の設計に競合対策（tx 化 or 楽観再試行）を含める。
- やってはいけない: M20 前の単独 tx 化（M20 の eager/lazy 判断と密結合）。
- 重要度: 中（キャッシュは再生成可能・実害限定）。

### §3-3 SQLite 接続プール上限未設定＋入れ子クエリの潜在デッドロック【中・要判断】
- 症状: `SetMaxOpenConns` 未設定（接続数無制限）で WAL の writer 競合が busy_timeout(5s) 頼み。負荷集中時に SQLITE_BUSY→500 の可能性。
- 該当: `internal/infra/db/db.go:23-58`。**加えて** `internal/repository/setup/repository.go:635-654`（`FindDuplicateInCombo`）が rows 反復中に同一 `*sql.DB` へ入れ子クエリを発行しており、対策として `SetMaxOpenConns(1)` を入れると**この箇所が即デッドロックする**。
- 推奨: 上限設定と入れ子解消（先に ID を収集してからループ）を**セットで**行う。データ層の根のため開発者判断。
- やってはいけない: `SetMaxOpenConns(1)` の単独追加（上記により即死）。
- 重要度: 中（単一ユーザー中心の現状では顕在化しにくいが、M22 LAN 同時編集で顕在化リスク）。

### §3-4 RecomputePresetCache の Unmarshal エラー握りつぶし【中・M20】
- 症状: recipe_cache に破損 JSON があると、再計算時に空 map 起点で当該 preset キーのみ書き戻し、他 preset のキャッシュを無警告で消す。
- 該当: `internal/service/notation/cache.go:92,118`（同ファイル `DeletePresetCache` は判定して continue しており非対称＝見落とし痕跡）。
- 推奨: M20 で `DeletePresetCache` と同じエラー判定に揃える（修正自体は小）。
- 重要度: 中（無警告欠落だが再生成で回復）。

### §3-5 CSV 一括インポート Commit の非アトミック性【中・M17】
- 症状: 選択行ごとに個別 tx のため、途中失敗で部分適用が残る（親コンボ成功→セットプレイ失敗など）。
- 該当: `internal/service/comboio/import.go:123-176`（service 構造体は `db *sql.DB` を保持するのに未使用＝全体 tx を意図した名残の疑い）。
- 推奨: M17（import/export 強化）で「行単位レポート＝仕様」か「全体アトミック」かを要件確認。
- 重要度: 中（仕様意図の可能性あり）。

### §3-6 followup-backlog の M 番号未同期【高(混乱リスク)・要判断】
- 症状: phase3-overview v0.4.0 の番号振り直し（M17〜M19 挿入・旧 M17〜M20→M20〜M23）が followup-backlog に未反映。「FB⑦→M18」（旧=物理コントローラ、新=確定反撃）等、**番号が別マイルストーンを指す**。offdesk-lane-backlog にも旧番号が残る（当方の追記分は新番号を明記済み）。
- 推奨: 同期パッチの作成は機械的に可能。実施主体（設計担当が正だが）を開発者が指定。
- やってはいけない: 部分的な番号だけ直すこと（新旧混在が悪化する）。
- 重要度: 高（生きた計画資料の参照事故につながる）。

### §3-7 確定反撃 materialize の文書追従未了【高(M18前提)・取りこぼしへ記載済み】
- pending-decisions ✅ で「別コンボ登録（materialize）・表示のみは撤回」と確定済みだが、spec-draft §8/付録と phase3-overview M18 は旧「表示のみ」のまま。M18 着手前に設計担当の追従が必要。

### §3-8 future-notes → handover への昇格3件【低・要判断】
- `autonomous-acceptance-criteria.md` / `dev-methodology.html` / `performance-strategy.html` は「将来メモ」でなく確立済み運用知。handover へ昇格提案（フォルダ跨ぎのため未実行）。

### §3-9 SetupEditorPage 等の i18n 未対応【低・M23 D群】
- `SetupEditorPage.tsx` が `useTranslation` 未 import で全文字列ハードコード。`ComboDetailPage.tsx:136,143`・`CompareTable.tsx:192` にも直書き残存。M23 D群（i18n 細部）と同時が適切。

### §3-10 features.txt のモダン過大表示【低・開発者判断】
- 「クラシック/モダン両対応」が ISSUE-007・phase3-overview（モダン本フェーズ排除）と矛盾。対外文書のため未修正。

### §3-11 タグ削除ガード（CountUsage）のセマンティクス【中・要判断・B2 の残課題】
- 現状: ゴミ箱内コンボの参照も「使用中」と数える（今回意図的に温存）。
- 論点: (a) 現状維持＝「全コンボをゴミ箱に入れてもタグ削除に確認が出る」が、**復元時のタグ消失を防ぐ**／(b) ゴミ箱除外＝表示と数字が揃うが、force 不要で削除→復元でタグが静かに消える。
- 推奨: (a) 維持のうえ、確認ダイアログの文言に「ゴミ箱内の使用を含む」と補足する案が最小。UI 文言は M15 领域のため要調整。

### 低重度の発見（対応不要・記録のみ）
- **B7** PUT の VAL-C02 が旧コンボ自身に重複ヒットしうる（キー不変 PUT 時。コード内コメントで自認済み）— `service/combo/service.go` PUT 経路
- **B8** 存在しない preset_id の GET /recipe が 500（404/400 が妥当）— `notation/resolver.go:88` → `combo/handler.go:420`
- **B9** 一覧ページングに安定タイブレーカ（id 副次キー）無し — `repository/combo/repository.go:382-403`
- **B10** `?is_draft=yes` 等のパース失敗が黙殺されフィルタ未適用で全件返し（character_id は 400 で不統一）— `combo/handler.go:156-161`
- **B11** タグ名重複チェックの TOCTOU（DB UNIQUE(user_id,name) が最終防衛線として存在）
- **F7** useUpdateConfig が setQueryData のみで invalidate しない（ConfigResponse 全項目返却のため実害薄）
- **F8** マイコンボのキャラ選択が URL 非永続（status は URL 永続で非対称）
- **F9** /compare?ids=5,5 の重複列表示（URL 直指定時のみ）
- **F10** 一覧フィルタ復元/保存 effect の初回競合（自己修復あり・軽微）
- **F11** `useCharacterSetups` は消費者ゼロのデッドフック（整理は M23 のフック整理と同時可）
- **Logger ヘッダ注意**: アクセスログは body 非出力（テストで固定済み）だが、将来認証ヘッダを足す際は出力項目の再点検を推奨

---

## §4 資料不整合レポート（実装調査資料は未修正・指摘のみ）

1. **テスト網羅調査（本レーン内の事前調査）の過大列挙**: 「service/preset・service/user・repository/user・api/user にテスト無し」は誤解を招く表現だった。実体は **doc.go のみのプレースホルダパッケージ**（実装コードが無い）。テストの穴として扱うべきは api/middleware・repository/character（今回補強済み）のみだった。
2. **code-facts.md §2-2（queryKey 表）**: 本レーンの F3/F5 修正で invalidate キーが増えたため生成時点より古い。→ `/regen_code_facts` の実行を推奨（自動生成資料のため直接編集はしていない）。
3. **phase3-overview §0/§8「CHANGE 採番 053 から」**: REQ-001 は既に CHANGE-055 まで消費済み（requirements.md ヘッダ）。次採番は 056。overview の記述が陳腐化。
4. **phase3-overview M18 の「表示のみ・spec §2 ロック済」**: §3-7 のとおり最新決定（materialize）と食い違う。
5. **followup-backlog / offdesk-lane-backlog の旧 M 番号**: §3-6 のとおり。
6. **architecture-patterns §9.1（custom_states 未実装記述）**: 資料自身が「M11-RESEARCH-01 で再検証予定・据え置き」と自認済みのため対応不要（参考）。

---

## §5 プロセス改善提案（P3・提案のみ）

1. **GitHub Actions CI**: `.github/` 自体が無く、品質ゲートは非ブロックのローカルフックのみ。**M23 H群に登録済み**のため前倒しは要判断。前倒しする場合の最小構成案: push 時に `make test`（Go+FE）のみ・E2E は手動維持（使い捨てDB化済みなので将来 CI 化しやすい土台はできた)。
2. **locales パリティテスト方式の横展開**: 「機械検証できる整合はテストに固定する」パターン(今回の locales.test.ts)は、バックエンド列挙定数↔`web/src/constants/` の同期(CLAUDE.md §4 の grep 手順)にも適用可能。grep 手順のテスト化を M23 か次の改善レーンで検討。
3. **CLAUDE.md の「現在地」运用**: 今回の是正で「現在地は progress-summary 参照」と明文化した。update_progress_summary 実行時に CLAUDE.md を触らなくて済む構造になったので、以後この方針の維持を推奨。
4. **/sync_command_catalog の実行推奨**: commands に description を付与したため、custom-commands.md(端末 `cmds` の元データ)との同期監査を一度回すと整合が取れる。
5. **stop-test フックの E2E 非対象は現状維持を推奨**: E2E は 1.5〜2分かかるため Stop フックに入れると応答毎に重い。使い捨てDB化で「回そうと思えばいつでも安全に回せる」状態になったので、マイルストーン完了時の手動 `make e2e` 運用で十分。

---

## §5-2 プロセス改善提案・追補（開発者からの追加質問を受けて 2026-07-02 追記）

> §5 の5件に加え、レーン実施中の実体験から。優先度順。すべて提案のみ（実装していない）。

1. **【高】バリデーション網羅の機械監査コマンド（`/audit_validation_coverage` 新設案）**
   今回の最重要バグ（B1: PATCH で VAL-C04/C05/C13 が素通り）は「DES-006 の VAL コード × API 経路(Create/PATCH/PUT) × テスト有無」のマトリクスを機械的に引けていれば設計段階で見つかった種類のもの。`grep -o 'VAL-[A-Z][0-9]*' docs/design/06-validation.md` と `internal/**/​*_test.go` の突合はシェルだけで書ける（AI 不要・generate-code-facts.sh と同系統）。retrospective パターンD「テストはケース数で語る」の機構化に相当。
2. **【高】`_wt` コマンド6本の二重管理解消**
   `implement_plan`/`incorporate_plan`/`research_plan`/`review_plan` に worktree ガードを前置しただけの `_wt` 版が並存し、本体改訂のたびに乖離リスクがある（実際、今回付与した description も6本ぶん重複した）。ガード部分は「`git rev-parse --show-toplevel` が `.worktrees/` 配下か」で機械判定できるため、**本体コマンド冒頭に条件付きガードを統合して `_wt` を廃止**すれば保守が半減する。
3. **【中】stop-test フックの差分ゲートに migrations を追加**
   現在 `.go` / `web/**.ts(x)` 変更で test-go/test-web が走るが、**`migrations/*.sql` の変更ではテストが走らない**。dbtest.Setup が全マイグレを適用するため go テストがマイグレの実質的な回帰テストであり、migrations 差分 → `make test-go` のトリガ追加は数行で済む（M9-1/M12-02 教訓の機構化）。
4. **【中】worktree 封じ込めの機械化（PreToolUse フック案）**
   現在の worktree 封じ込めは指示文のみ。PreToolUse フック（exit 2 でブロック可能）で「編集対象パスが `git rev-parse --show-toplevel` の外なら拒否」を入れれば、並列レーンの越境事故を機械的に防げる。今回のレーンでも 5173 の親レーン dev サーバを誤って再利用しかけた（E2E ポート分離で対処済みだが、フック層の防御は別途価値がある）。
5. **【中】派生資料の鮮度チェックを `/sync_command_catalog` 型で統一**
   code-facts / docs-map / retrospective-digest / custom-commands.md はすべて「源泉から生成される派生物」だが、再生成は人の記憶頼み。「源泉の最終コミット > 派生物の生成コミット なら警告を出す」薄い監査スクリプト1本（例 `/check_derived_docs`）で陳腐化検知を一元化できる。今回 CLAUDE.md の1年近い陳腐化・followup-backlog の番号未同期が起きたのは、この層の欠如が根因。
6. **【低】`/pending_decision` クイック追記コマンド**
   受け皿（pending-decisions.md）への合流は書式（🔴🟡⚪…・表形式）合わせが地味に手間。書式準拠の1行を対話で生成・追記するだけの軽量コマンドがあると、レーン横断で「迷ったら要判断へ」の摩擦が下がる。
7. **【低】post-edit-check.sh に eslint を追加**
   現在 .ts/.tsx は tsc --noEmit のみで、lint 違反（未使用 import 等）は Stop まで検出されない。`pnpm eslint <file>` の追加は timeout 内に収まる見込み。

## §6 検証サマリ

| 対象 | コマンド | 結果 |
|---|---|---|
| Go 全体 | `go test ./...` | 全パス(31パッケージ・約25s) |
| FE 全体 | `cd web && pnpm test -- --run` | 560件全パス |
| E2E | `cd web && pnpm exec playwright test` | 14件全パス(クリーンDB・2回目 7.9s。初回のみ go run ビルド待ちで flaky 2件→リトライ成功) |
| 文書整理 | 各コミット独立 | git log `7329786`〜 で塊ごとに巻き戻し可能 |
