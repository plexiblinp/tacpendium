# M18-02 レビュー報告書

| 項目 | 内容 |
|------|------|
| 対象 | M18-02（確定反撃サーチ・探す画面・走査サービス・3 階層ツリー） |
| 指示書 | `docs/instructions/phase3/M18-02-punish-search.md` v1.0.1 |
| チェックリスト | `docs/instructions/phase3/reviews/M18-02-review-checklist.md` v1.0.1 |
| レビュー日 | 2026-07-24 |
| レビュアー | 品質レビュー担当 Claude（独立レビュー・実装文脈なし） |
| 判定 | **合格（重大問題ゼロ）**。§9 重大問題は全項目クリア。指摘は低優先の観察のみ。 |

## 総評
仕様への忠実度が非常に高い実装。§9 の重大問題（seedgen 改変・自採番・新テーブル追加・ジャンプ全体フレームの取り違え・damage 0/NULL 同一視・除外技の画面消去・FE 二重実装・404/500・NULL total クラッシュ）はすべて回避されている。走査規則は BE（`service/punishfinder`）に一元化され FE は描画のみ、除外規則 a〜h と 3 レーンの境界がテストで精密に固定されている。マイグレは中央払い出しの 000040/000041 を使用し、backfill 50 行を件数・代表値・NULL 残置まで検算済み。`go build ./...` 成功、新規 4 パッケージのテストも green を確認した。指摘は仕様の範囲内の設計判断に対する低優先の観察に留まる。

## 設計準拠性レビュー結果

### §1.1 スキーマ（指示書 §4.1）: ◎
- `combo_punish_starters` の列・`UNIQUE(self_character_id, opponent_move_id, starter_move_id)`・`idx_cps_opponent_move`・timestamps `TEXT` すべて一致（`migrations/000040_create_combo_punish_starters.up.sql:10-23`）。
- `verdict` は自由 TEXT、DB CHECK 非新設。Go 側 whitelist（`internal/service/punishfinder/constants.go:29-32`、`model.PunishVerdict*`）で担保。✓
- 相手キャラ明示列を持たず `opponent_move_id → moves.character_id` 導出。✓
- 本表以外の新テーブル/新列なし（diff は `combo/repository.go` の `ListFilter.StarterMoveIDs` 追加のみ＝既存構造体へのフィールド追加であり新スキーマではない）。✓

### §1.1-b マイグレ連番（§2.1・§3.3-1）: ◎
- 000040（CHANGE-083）/000041（CHANGE-084 v2）を搬送順で使用、自採番なし。`ls migrations/` 末尾 000039 を Plan Mode で実査した旨を完了報告 §1 に記載。消費連番も明記。✓

### §1.2 backfill（§4.2・CHANGE-084 v2）: ◎
- 10 キャラ × 5 code = 50 行、ジャンプ 3 code 同値（`migrations/000041_backfill_movement_total.up.sql`）。✓
- c_viper/dhalsim 対象外、`total` のみ更新（startup/active/recovery は NULL 維持）。テスト `migrate_m1802_test.go:96-104` で NULL 残置を明示 assert。✓
- 値の出所コメント（開発者提供・実測値・2026-07-23 受領・CHANGE-084 v2 §3.1 一次源）を冒頭に記載（up.sql:8-10）。✓
- キャラ/code 特定は `characters.code`+`moves.code`、id 直書きなし。✓ down で 50 行 NULL 復元、10 キャラ限定で誤爆防止（down.sql）。✓

### §1.3 判定ロジック（§4.3）: ◎
- 有利フレーム: block=`-(on_block)`／just_parry=`recovery`（`service.go:180-197`）。✓
- 除外規則 a〜h 実装（`service.go:159-201`）。**`damage=0` は完全除外（continue・画面非表示）／`damage IS NULL` は `unknown_damage` で手動確認レーン**と明確に区別。テスト `service_test.go:176-186` で両者を別々に検証。✓
- 始動技共通条件 `damage > 0`（`service.go:266`）。✓
- ダッシュ経由 `残り猶予 = adv − dash_forward.total`・`≥ DashMinSlack`・`startup ≤ 残り猶予`（`service.go:277-283`）。✓
- ジャンプ経由 `adv ≥ jump_forward.total − JumpSlack`・`is_aerial=1`・`jumping_heavy_` 接頭辞（`service.go:286-290`）。✓
- **【重大観点】ジャンプ判定にキャラのジャンプ全体（`totals.JumpForward`）を使用、空中技自身の `total` は不使用**。`GetMovementTotals` は `jump_forward`/`dash_forward` のみ投影（`queries.go:27-31`）。取り違えなし。✓
- `total` NULL のキャラはレーンごとスキップ（`service.go:277,286` の nil ガード）。テスト `service_test.go:271-283,327-339` で例外にならないことを確認。✓
- 定数 `DashMinSlack`/`JumpSlack` は `constants.go` に 1 箇所定義＋根拠コメント、FE には持たせず（`web/src/constants/punish.ts:2-3` に非搭載を明記）。✓
- キャラ別分岐・ハードコードなし（E-15）。テスト `service_test.go:342-361` で 2 マッチアップ一致を検証。✓

### §1.4 レーンの可視化: ◎
- 3 レーンは `Lane` フィールドで別ノード化、FE でレーンバッジ表示（`PunishTree.tsx:95-97`、`PUNISH_LANE_LABELS`）。同一始動技が複数レーンに載る場合も別ノードで silent に混ざらない。✓
- 除外相手技は消えず理由バッジ（距離依存/データ不足/ダメージ不明/硬直データ不定）付きで手動確認レーン表示（`PunishTree.tsx:277-304`）。✓

### §2 データ・API 契約・スキーマ不変: ◎
- 既存マイグレ 000001〜000039 非改変（新規 2 本のみ追加）。✓
- **seedgen 非改変**（`git diff --stat HEAD~7 HEAD -- internal/seedgen/` が空＝untouched を確認）。golden 破壊なし。✓
- `DuplicateKey`/`CalcRecipeHash`/`RecomputeComboCache` に変更なし（combo repo 変更は List の WHERE 句追加のみ）。✓
- 既存 3 表定義不変。✓
- API は BE 一元化・FE は引くだけ（`dto.go` はレスポンス型を持たず `punishfinder.Tree` をそのまま返却）。走査規則の FE 二重実装なし。✓
- **未 seed・不存在 ID は 200+空**（`service.go:118` 空ツリー・handler は正の整数のみ 400、存在チェックはせず 200）。テスト `service_test.go:430-443`／`handler_test.go:78-96`。✓
- `PATCH /api/moves/{id}` 成功時に `["punish-finder"]` を前方一致 invalidate（`web/src/features/moves/api.ts`）。✓

### §3 フロントエンド動作仕様（§4.5）: ◎
- 3 階層ツリー（相手技→始動技→コンボ）を ▶/▼ で描画（`PunishTree.tsx`）。✓
- 孫末尾の新規登録リンクは孫 0 件でも常時表示（`PunishTree.tsx:196-206`）。テスト `PunishTree.test.tsx:80-83`。✓
- 遷移先は既存 `/combos/new?character=${self}`（新 route 未作成）、`mode="new"`+`initialCharacterId` は既存 ComboEditorPage の `?character=` 経由（CHANGE-039 の流儀）。✓
- **始動技プリフィルなし**。ComboEditor の Props（`mode`/`initial`/`initialCharacterId`）契約は不変。追加は `location.state.punishReturn` の読み取りのみで Props 契約に触れていない（`ComboEditor.tsx` diff）。✓
- 登録後・キャンセル時ともに `punishReturn` へ復帰（`ComboEditor.tsx` `handleSaveSuccess`/`handleCancel`）。戻り先 URL に self/opp/guard を含み再走査で孫に反映。✓
- 戻り先 state 無し時は従来どおり（保存後 `/combos/{id}`・キャンセル `navigate(-1)`）にフォールバック。✓
- 選択状態は URL クエリ保持でブラウザストレージ不使用（`PunishSearchPage.tsx:21` に §10.X 遵守を明記）。✓

### §4 テストの妥当性（§5）: ◎
- マイグレ up/down 往復・UNIQUE・INDEX・`dbtest.Setup` 反映（`migrate_m1802_test.go`／`repository_test.go` は `dbtest.Setup` 使用）。✓
- backfill 50 行を件数（10/10/30）・代表値（ryu 19/23/43・lily 21/24/45・zangief 22/25/44）・c_viper/dhalsim NULL 維持で検算。✓
- 算出式境界 `startup==adv` 成立／`+1` 不成立を block・just_parry 両方（`service_test.go:114-149`）。✓
- 除外規則 a〜f を各 1 件以上（`service_test.go:151-222`）。✓
- ダッシュ境界 `slack==4` 成立／`3` 不成立・NULL スキップ（`service_test.go:244-284`）。✓
- ジャンプ境界 `adv==total−4` 成立／`−5` 不成立・強攻撃のみ・is_aerial=false 除外・空中技が地上レーンに出ない（`service_test.go:286-340`）。✓
- verdict whitelist・UNIQUE 重複弾き・pruning 往復（`service_test.go:452-463`／`repository_test.go`／`migrate_m1802_test.go:117-136`）。✓
- E2E はジャストパリィタブ主軸（`m18-02-punish-search.spec.ts` テスト A）、B で hit_type 4 値非回帰（E-14）。✓

### §5 設計意図との整合: ◎
- 除外技を silent に消していない（手動確認レーン。damage=0 の完全除外は §4.3.2-a の明示仕様であり §9 が禁ずる「damage NULL の黙殺」ではない）。✓
- `combo_punish_starters` は探す画面の検証状態に限定、採用の正 `combo_punishes` と役割分離（コメント・SQL とも別表）。✓
- ジャンプ攻撃版の全体（+3）を保存していない（`total` は素のジャンプのみ）。✓
- materialize/ダメージ規則/FR301/採用画面（2 階層）を前倒し実装していない。✓

### §6 コード品質・規約: ◎
- 「ジャストパリィ」を略さず（`constants.go:21`／`punish.ts:27`）。空中技抽出は `is_aerial=1` 主条件＋`jumping_heavy_` 補助の二重担保で `jump_`（移動）と取り違えなし。✓
- マイグレは FK=OFF × 明示 DELETE の同居なし（000040 は DDL のみ、000041 は UPDATE のみ）。✓

### §7 既存挙動の温存: ◎（コード判定範囲）
- コンボ CRUD/一覧/比較/エクスポートに影響する変更は combo repo の加算的 WHERE 句のみ。既存 3 表・M18-01 挙動は不変。E2E B で hit_type 非回帰をカバー。✓

### §8 ドキュメント: ◎
- 完了報告に DES 反映要点（DES-003 付帯条件 1／DES-002 §4.2／DES-005 画面 19／DES-006 verdict VAL）・backfill 検算 50 行・消費連番を明記。DES 本体は非編集。✓

## 設計準拠性以外の指摘事項
- **SQL インジェクション**: `StarterMoveIDs` の IN 句はプレースホルダ生成で安全（`combo/repository.go`）。走査系 SQL もすべてパラメータ化。問題なし。
- **エラーハンドリング**: サービス層は全 error を `%w` で wrap。handler は `internalError` で slog 出力（`console.log`/`fmt.Println` の残置なし＝grep 確認済み）。規約遵守。
- **JSON タグ**: レスポンス/DTO とも camelCase 統一（`selfCharacterId` 等）、FE 型と整合。✓
- **定数同期**: `model.PunishVerdict*`/`PunishLane*`/`PunishReason*`/`PunishGuardType*` と `web/src/constants/punish.ts` が 1:1、両側にコメントで同期義務を明記。CLAUDE.md §4 の機械的チェック観点に合致。
- **DELETE にボディを載せる設計**（starter/pruning）は一般的 REST では非慣例だが、指示書 §4.4 が `POST/DELETE` の body 契約を明示しており、単一バイナリ内部 API のため実害なし。DTO コメントで「DELETE はキー項目のみ使用」と明示済み。

## 推奨修正（優先度別）
- **高（M18 完了前に修正必須）**: なし。
- **中（M19 着手と並行可）**:
  1. **E2E の正規実行**。完了報告 §6 のとおり本環境は playwright pin 不一致（browser 1194 / expected 1223）のため `executablePath` 一時上書きで検証され、pin 一致環境での `make e2e` は未実施。DoD §7 は「pin 一致環境で green」を要求するため、正規環境での再実行を M18-03 着手前に完了させることを推奨（コード側の問題ではなく実行環境の課題）。
- **低（将来対応）**:
  2. **始動技候補で `startup IS NULL` の自技が地上/ダッシュ両レーンから静かに脱落する**（`service.go:273,279` の `sm.Startup != nil` ガード）。仕様 §4.3.3 の条件 `startup ≤ 有利` を NULL が満たせない以上は妥当な挙動で、手動確認レーンは相手技側のみが対象のため §9 違反ではない。将来 self 側 startup 欠損が増えた場合に「データ不足の始動技」を可視化するか否かは運用判断（現時点は据え置きで可）。
  3. **相手側の移動 system move（`dash_*`/`jump_*`）が `damage IS NULL` により手動確認レーンに露出**する点（完了報告 §5-4 で製造が自己申告済み）。「黙って落とさない」を優先した妥当な判断だが、運用上ノイズになる場合は相手技カテゴリ絞りを CHANGE 経由で検討。現状は据え置き可。

## 良かった点
- 除外規則の適用順（a→g→b→c→d/e/f→h）と各レーンの境界値が、fakeRepo によるインメモリテストで 1 フレーム単位に固定されており、仕様のエッジ（`slack==4`/`==3`、`adv==total−4`/`−5`）を漏れなく押さえている。回帰耐性が高い。
- 「ジャンプ判定はキャラのジャンプ全体、空中技自身の total ではない」という最重要の取り違えポイントを、`MovementTotals` のコメント・`GetMovementTotals` の投影列限定・テストの三重で防御している。
- `damage=0`（完全除外）と `damage IS NULL`（手動確認）の区別を、実装・テスト・FE ラベルの全層で一貫して表現。
- 走査専用投影 `ScanMove` を新設して `model.Move` 非改変（divergence_test の同期負担回避）とした判断が適切で、完了報告 §5-3 に根拠を明記している。
- ComboEditor への変更を `location.state` 読み取りに限定し Props 契約を保ったことで、既存呼び出し側への波及をゼロに抑えている。フォールバック（state 無し→従来動線）も両系統（保存後/キャンセル）で担保。
- CHANGE-083/084 通知書が未配置だった点を製造側が検知しリポジトリへ配置（完了報告 §5-5）。トレーサビリティへの配慮が良い。

## 制約事項
- 本レビューはコード上で判定可能な範囲のみ対象。実機での UI 操作・パフォーマンス・pin 一致環境での E2E 実行は別途実施が必要。
- レビュアーはコードを一切変更していない（Read のみ）。確認のため `go build ./...`・新規 4 パッケージの `go test`・`git diff/log` の読み取り系のみ実行し、いずれも green を確認した。

---

## 取り込み結果（自動トリアージ・2026-07-24）

製造担当（implement_plan_full Phase C）による事後監査用の採否記録。**高優先の指摘は 0 件**のため安全弁（高指摘の棄却時エスカレーション）は発動せず、自動で確定した。

| # | 指摘 | 優先度 | 採否 | 理由 |
|---|------|--------|------|------|
| 中-1 | E2E の pin 一致環境での正規 `make e2e` 未実施 | 中 | **取り込み不可（環境制約）** | コードの問題ではなく実行環境の制約（本環境は playwright pin 不一致＝browser 1194 / expected 1223）。spec 自体は決定論・自己完結で、`executablePath` 一時上書きにより 2 spec green を実測済み（設定変更は revert 済み）。**pin 一致環境での再実行は開発者環境への申し送り**（完了報告 §6 に記載済み）。製造側でこれ以上コードで対処できる事項なし。 |
| 低-2 | `startup IS NULL` の自技が地上/ダッシュレーンから静かに脱落 | 低 | **不採用（据え置き）** | レビュアー自身が「仕様 §4.3.3 の `startup ≤ 有利` を NULL が満たせない以上は妥当・§9 違反ではない・現時点は据え置きで可」と判定。self 側 startup 欠損の可視化は運用判断であり、投機的実装はスコープ外（指示書 §10・勝手に足さない）。 |
| 低-3 | 相手側移動 system move が `damage IS NULL` で手動確認レーンに露出 | 低 | **不採用（据え置き）** | 完了報告 §5-4 で製造が自己申告済み。「黙って落とさない」を優先した妥当な判断（§9 が禁ずる NULL 黙殺の逆の姿勢）。相手技カテゴリ絞りは指示書に無い追加ルールのため、必要なら CHANGE 経由で中央判断（据え置き可）。 |

**コード修正の適用: なし**（採用すべき指摘＝コードで直すべき指摘は 0 件）。中-1 は環境制約、低-2/低-3 はレビュアー・製造とも「据え置き可」で一致。§9 重大問題ゼロ・§1〜§8 全項目 ◎ のため M18-02 完了要件を満たす。

