# M18-01 レビューチェックリスト

| 項目 | 内容 |
|------|------|
| 文書ID | M18-01-REVIEW |
| バージョン | **v0.2.3**（指示書 v0.2.3 と 1:1・E2E 残ゲート解消） |
| 作成日 | 2026-07-19 |
| 作成者 | M18 指示書担当 Claude |
| 対応指示書 | `docs/instructions/phase3/M18-01-schema-foundation.md` |
| 推奨レビューモデル | Sonnet 4.6 |
| 配置（完成品） | `docs/instructions/phase3/reviews/M18-01-review-checklist.md` |

---

## 更新履歴
- v0.1.0（2026-07-19）: 初版。指示書 v0.1.0 に対応。
- v0.1.1（2026-07-19）: 指示書 v0.1.1 追従＝recovery=NULL 検証項目を除去（shuriken_bomb 系は recovery=0・on_block=NULL で確定・解決済）。
- v0.1.2（2026-07-19）: 指示書 v0.1.2 追従（①確定＝is_projectile 是正+backfill は CHANGE-081 同梱・検算は change-report-081）。§4 の件数検算が change-report-081 に集約されることをレビューで確認。
- v0.1.3（2026-07-19）: 指示書 v0.1.3 追従（中央合格・連番払い出し 000036–000039）。連番・件数(104)チェックを確定値へ。
- v0.2.3（2026-07-22）: 指示書 v0.2.3 追従＝E2E 残ゲートを解消（開発者環境で `make e2e` green ＋手動 E2E 確認済）。§12 の残ゲート項を削除。
- v0.2.2（2026-07-22）: 指示書 v0.2.2 追従＝hit_type ラベルを「パニッシュカウンター(ジャストパリィ反撃)」へ、件数の一次源を seeded-10=104 に限定（全 CSV は母数変動のため参考値）、E2E 再実行ゲートを §12 に追加、`HIT_TYPE_OPTIONS` 是認を §5 に追加。
- v0.2.1（2026-07-19）: 指示書 v0.2.1 追従（中央承認 (A)(B)＝決定 #3-rev・CHANGE-081 改訂済・manon/luke は backlog C-1 へ）。検証項目に変更なし。
- v0.2.0（2026-07-19）: 指示書 v0.2.0 追従＝seedgen の SQL 出力要件を撤回し **backfill 専用**へ。§4 の seedgen 項を「非改変＋golden green」検証へ差し替え、§9 に「seedgen の SQL 出力を変更していない／既存 seed マイグレ再生成をしていない」を重大問題として追加。

---

## 0. レビュー担当への前置き

### 0.1 レビュー前の準備
- 必読：指示書 §4／CHANGE-078〜082／物理設計プラン v0.5.0-plan §3／DES-003 §3.3/§3.4／DES-006 §2／retrospective-digest §5。
- Plan Mode 実査結果（指示書 §3.3：連番・seedgen 非改変・dbtest・DROP COLUMN 方式・whitelist 位置・is_projectile true 群）が**確定してから**実装されているか。

### 0.2 レビューの基本姿勢
- 最重要ゲート＝**非破壊（既存行・既存挙動不変）／既存マイグレ非改変／連番の中央払い出し／FK=OFF×明示 DELETE 非同居**。これらの逸脱は完了承認を妨げる（§9）。

### 0.3 報告フォーマット
- 各項目 `- [ ]` を ✓/✗/N-A で。✗ は指示書節番号＋実ファイル行を添える。

---

## 1. 設計・パターンとの照合（最重要）

### 1.1 DDL（指示書 §4.1〜§4.4）
- [ ] `combo_punishes`：列・`UNIQUE(combo_id,opponent_move_id)`・`idx_combo_punishes_opponent_move`・**guard_type を持たない**（§4.1）。
- [ ] G-d **2 表**（`combo_punish_prunings`＝(self_character_id,opponent_move_id) UNIQUE／`combo_punish_curations`＝(combo_id,opponent_move_id) UNIQUE・CASCADE）を**1 マイグレ**で作成（§4.2）。単一表 `combo_punish_exclusions` に**なっていない**（旧設計の混入がない）。
- [ ] `combos.materialized_from_combo_id`＝self-FK・nullable・**相手技列なし**（§4.3）。
- [ ] `moves.is_projectile`＝`INTEGER NOT NULL DEFAULT 0`（§4.4）。

### 1.2 hit_type 拡張（指示書 §4.5）
- [ ] `HitTypeJustParryPunishCounter = "just_parry_punish_counter"`（"jp" を含めない）。
- [ ] FE ラベル「**パニッシュカウンター(ジャストパリィ反撃)**」（半角括弧・開発者変更 2026-07-22）・既存 punish_counter ラベル据置。内部値 `just_parry_punish_counter` は不変。
- [ ] VAL whitelist・CSV 写像・比較/絞り込みに新値。**マイグレを消費していない**（`hit_type TEXT`・CHECK 新設なし）。

### 1.3 搬送順・連番
- [ ] 搬送順 G-c→G-d→G-e→G-b で連番が連続（§4 冒頭）。
- [ ] 連番は中央払い出し値 **000036/000037/000038/000039** を使用（指示書 §2.1）。Plan Mode で `ls migrations/` 末尾＝**000035** を実査確認（不一致時は自採番せず中央へ請求し直し）。消費連番が完了報告に明記。

## 2. データ・API 契約・スキーマの不変（非破壊性）
- [ ] 既存マイグレ（現行末尾まで）を**一切改変していない**（新規連番のみ）。
- [ ] `DuplicateKey`（6 項）・`CalcRecipeHash` のロジック改変なし（hit_type 新値は whitelist 追加のみ）。
- [ ] 既存 `combos`/`moves` の他列・既存 API レスポンス（新列/新値以外）不変。

## 3. フロントエンドの動作仕様
- [ ] hit_type ラベル・CSV 写像・比較/絞り込みに新値が出るのみで、既存 3 値の表示・挙動が不変。
- [ ] `note` 列は本サブで UI 露出しない（列のみ）。

## 4. テストの妥当性（ケース数で確認・指示書 §5 ↔ §7）
- [ ] マイグレ up/down（4 本）の存在・往復整合テスト。`dbtest.Setup` に新表 3・新列 2 が反映。
- [ ] FK CASCADE（punishes/curations 削除・prunings 残存）・UNIQUE 重複弾き・is_projectile backfill 件数 assert。
- [ ] **is_projectile 更新件数＝seeded-10 true 件数（104・一次源）を件数で検算**（E-16/E-18）。数えた対象＝moves.is_projectile=1 行数。全 CSV 総数（実測 122）は未 seed CSV を含む参考値で、backfill 対象ではないことを取り違えていない。
- [ ] **seedgen の SQL 出力が変更されていない**（`writeMovesInsert` 12 列のまま・`testHeader` 不変）。**CSV 是正 7 件を入れた状態で golden テスト（000026/000030 byte-identical）が green**＝生成 SQL 不変。`model.go` は is_projectile コメント更新のみ。
- [ ] hit_type：新値受理・未知値棄却・既存不変・round-trip。**同一レシピ×punish_counter/just_parry_punish_counter が別コンボ**（E-19）。

## 5. 設計意図との整合（精神の確認）
- [ ] pruning=マッチアップ単位／curation=個別コンボ単位の**粒度差が保たれている**（curation を安易にマッチアップ単位へ戻していない＝spec §8-3）。
- [ ] combo_punishes は「キュレート分のみ保存」の器（「刺さり得る」全集合を保存しようとしていない）。
- [ ] materialized_from は出自記録のみ（生成規則・ダメージ・hit_type 分岐を本サブに前倒し実装していない＝M18-03）。
- [ ] `HIT_TYPE_OPTIONS` への新値追加は**是認済**（手入力が正典・編集時の選択肢欠落防止）。追加により既存 3 値の選択・保存が壊れていない。

## 6. コード品質・規約遵守
- [ ] 命名：コード/DES で「ジャストパリィ」を略さない。
- [ ] マイグレ：可逆前進＋事前バックアップ、down 忠実復元、既存非改変（§4 冒頭・digest §5）。

## 7. 既存挙動の温存（非破壊性）
- [ ] E2E：既存コンボ CRUD/一覧/比較/エクスポートが新列・新値追加後も回帰しない。

## 8. ドキュメント・進捗ログ
- [ ] 完了報告に DES 反映要点・消費連番・is_projectile 件数検算・golden green 確認・触ったファイル一覧（E-14）。
- [ ] 製造が DES 本体を直接編集していない。

## 9. 重大な問題の判定基準（完了承認を妨げる）
- 既存マイグレの改変／既存データ・既存挙動の破壊（**000026/000030 の再生成を含む**）。
- **seedgen の moves INSERT に is_projectile を出力している**（backfill 専用の確定に反する・golden 破壊／実行順序上 `no such column` になる）。
- 連番の自採番（中央払い出し不使用）。
- FK=OFF と明示 DELETE の同一マイグレ同居（digest §5）。
- G-d が単一表になっている／curation がマッチアップ単位になっている（設計逸脱）。
- is_projectile 件数を検算せず断定（E-16/E-18 違反）。
- 同一レシピの hit_type 別値が別コンボにならない（FR301・E-19 違反）。
- materialize 生成規則・G-b 算出式を本サブに前倒し実装（スコープ逸脱）。

## 10. 軽微な問題の判定基準（持ち越し許容）
- テストファイル名・配置の規約差（機能に影響しない範囲）。
- `note` 列の将来 UI 文言（M18-02/03 で確定）。

## 11. 質問・確認事項のフォーマット
- 「何を/なぜ/暫定案」の 3 点で、指示書 §11 の未確定（is_projectile パッケージング・配布物版表記）に紐づけて記述。

## 12. レビュー完了の判定
- §1〜§8 が全て ✓ または N-A、§9 の重大問題ゼロ、§5.1 テスト green、is_projectile 件数検算済み。
- **E2E**：開発者環境で `make e2e` green ＋手動 E2E 確認済（2026-07-22）。**残ゲートなし＝M18-01 クローズ可**。

*以上、M18-01 レビューチェックリスト v0.1.0。配置 `docs/instructions/phase3/reviews/M18-01-review-checklist.md`。指示書 v0.1.0 と 1:1。*
