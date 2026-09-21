# M16-04 レビュー報告書

対象: 直近 3 コミット（8946590 / 5a44b59 / 9860d7b）＝ `git diff 13875a5..HEAD`
レビュー担当: 品質レビュー Claude（独立レビュアー・メイン文脈非継承）/ 2026-07-06

## 総評

M16-04（taxonomy 明文化＋dash 二重表現一本化・G-i 破壊的移行）の実装は、指示書・チェックリスト・確定方針（開発者 2026-07-07）に高い精度で準拠している。`modifiers.type` 方向別 dash の撤去は Go/FE の全接地点で取りこぼしなく完了し、残参照ゼロ・`go build`/`go vet` クリーン、`DASH_MOVE_CODES` 等の dead code も同時撤去されている。マイグレ 000022 は UPDATE-in-place のみ（子 DELETE 非同居）・`WHERE EXISTS` による skip（削除でなく据え置き）・`modifiers` の NULL 化による recipe_hash 整合を専用 fixtures で検証しており、破壊的移行の勘所を押さえている。system move dash（`move.code`）・内部識別子 `uses_dr`・VirtualController・parry/cancel は不変で、巻き込みは検出されなかった。**重大（§9）該当ゼロ**。指摘は軽微・質問のみ。

## 設計準拠性レビュー結果

### §1.1 taxonomy 原則（DES 反映は CHANGE-064） ◎
- (a) moves 行〔system 含む〕/ (b) 非技 `modifiers.type` / (c) flag の振り分けが伝達メモ §1.1 に 1 枚化。移動＝system move・ジャンプ→空中技＋flag（ジャンプ move 省略）が原則化されている（`docs/handover/phase3/M16-04-to-design-memo.md:16-23`）。
- `parry_drive_rush`/`cancel_drive_rush` が (b) 残置、dash が (b) から除外（`internal/model/combo.go:35-38`・`internal/service/notation/resolver.go:15-18`）。
- DES 本体は未編集（`git diff -- docs/design/` は空）。CHANGE-064 見込みを伝達メモで申し送り済み。◎

### §1.2 dash 撤去（再混入経路遮断） ◎
- Go `ModifierType` から `dash_forward`/`dash_back` 除去・parry/cancel 残置（`internal/model/combo.go:35-38`）。
- FE `MODIFIER_NON_MOVE_TYPES` から dash 2 値除去（`web/src/features/combo/labels.ts:99-103`）。
- `ModifiersEditor` は配列駆動のため自動的に dash 消滅（テストで radio 数=2・「前方ステップ/後方ステップ」不在を検証：`ModifiersEditor.test.tsx:83-92`）。
- `RecipeBuilder`/`SetupRecipeEditor` の dash ブリッジ分岐を削除し「システム」optgroup（moveId）へ一本化（`RecipeBuilder.tsx:66-73`・`SetupRecipeEditor.tsx:92-96`）。2 optgroup 重複解消をテストで検証。
- **巻き込み無し**: `move.code=dash_forward/dash_back`（SystemRow.tsx:51-59）と `uses_dr`（combo.go:96 `UsesDR db:"uses_dr"`）は不変。VirtualController は dash 参照を保全。◎

### §1.3 既存データ移行（マイグレ 000022） ◎
- `combo_steps`/`setup_steps` の `modifiers.type` dash を同キャラ system move dash（`move_id`）参照へ transform、`step_order` は保存（`000022...up.sql:31-76`）。
- 移行先不在は `WHERE EXISTS` で自然 skip＝据え置き・無損失（削除でもエラーでもない）。dev 固有 combo id（#91）の直書き無し。◎
- **dup 衝突検出・RecomputeComboCache をマイグレに積まない**のは開発者確定方針（progress-log §M16-04-4/5・伝達メモ §1 up.sql コメント）。タスク注記どおり確定方針前提で評価＝準拠。指示書 §4.2 原文（マイグレ内で dup 検出＋targeted cache）との差分は確定方針で上書き済みであり、実装は確定方針に忠実。◎（指示書原文との差異は下記「質問」に記載）
- `modifiers` を `{}` でなく NULL 化し native system move dash step と recipe_hash 一致（`up.sql:33-37` の CASE＋json_each COUNT=0→NULL）。テストで hash parity を明示 assert（`migrate_test.go` の `CalcRecipeHash` 比較）。◎

### §1.4 alias 実査 ◎
- ryu の dash system move は `official_ja_move` に alias「前ダッシュ/後ろダッシュ」実在（`migrations/000006`）。移行後の生 code フォールバック無しを確認。他キャラは未 seed＝M14-03b 契約へ申し送り（伝達メモ §2）。◎

### §1.5 DES 直接編集禁止 ◎
- `git diff 13875a5..HEAD --stat -- docs/design/` は空。製造は DES 未編集。◎

### §2 マイグレーション健全性 ◎
- UPDATE-in-place のみ・子 DELETE 無し＝FK=OFF×明示 DELETE 同居に非抵触（up.sql コメントで明示）。◎
- down は system move dash step → `modifiers.type` dash への逆写像・skip 分据え置き（`000022...down.sql`）。◎（lossy/非対称は下記軽微に記載）
- `dbtest.Setup` 含む `go test ./...` 全パッケージ通過（progress-log）。既存マイグレ非改変・連番 000022（000021 の後）。◎
- 専用 fixtures（char=1 ryu／char=999 skip）で dev DB 非依存。◎

### §3 データ層・API 整合 ◎
- dash 除去後 `go build`/`go vet` クリーン・残参照ゼロ（`grep ModifierTypeDash` 0 件）。
- `CalcRecipeHash` は type/flags/notes 対象・都度計算。移行が hash を変えることをテストで裏取り。
- 新規 dash 入力 3 経路は system move へ解決（M15-03 非回帰）をテストで維持。◎

### §4 テスト妥当性 ◎
- Go: `TestRun_Migration000022_UnifyDashToSystemMove`（transform / flags-notes 温存 / parry 不変 / skip 据え置き / setup 移行 / hash parity / down 逆写像）。専用 fixtures。◎
- FE: `labels`/`ModifiersEditor`/`RecipeBuilder`/`SetupRecipeEditor`/`utils` のテストを新 taxonomy へ更新。dash が non-move optgroup に不在・system move optgroup 経由で載ることを検証。Vitest 664 件通過（報告値）。◎

### §5 設計意図整合 ◎
1入力=1move 一本化・再混入遮断・transform（user DB 保護）・recipe_hash 保全のいずれも精神に合致。

### §6 コード品質・規約 ◎
- `console.warn`（旧 dash not-found 分岐）が撤去され、残置なし。曖昧語依存なし・簡体字なし。
- dash 全接地経路 grep 結果が progress-log §M16-04-1 に記録。system move dash と内部識別子の非巻き込みを対象限定で確証。

### §7 既存挙動温存 ◎
parry/cancel・system move dash・ゲージ/起き攻め列・M13 CSV・VAL-C02・新規 3 経路すべて不変。

### §8 ドキュメント ◎
Plan Mode 8 項目・移行結果（transform/skip/dup 0 件）・alias 実査・既知制約（down lossy・skip 据え置き）を progress-log に記載。CHANGE-064 見込みを伝達メモで申し送り。

## 設計準拠性以外の指摘事項

- **命名・コメント**: 撤去理由のコメントが Go/FE/SQL 各所に丁寧に付され、後続担当への追跡性が高い。指摘なし。
- **SQL 健全性**: up の SET 句は SQLite が右辺を更新前行値で評価する仕様に依存する（move_id NULL 化前に旧 modifiers から type を解決）。down.sql コメントで同仕様に言及済み。`moves` の UNIQUE(character_id, code) により移行先 move が一意で、subquery の非決定性リスクなし。健全。
- **skip 行の live 表示**: 移行先不在で skip された行（dev の #91 のみ）は `modifiers.type=dash_forward` を保持するが、resolver から dash が撤去されたため、仮に再解決されると `resolveNonMoveStep` の fallback（`return step.Modifiers.Type`：resolver.go:71）で生 code「dash_forward」を返す。ただし (1) recipe_cache は migration で regen されない＝既存キャッシュ「前ダッシュ」が維持される、(2) skip は dev-disposable の #91 に限られ clean/user DB では発生しない、ため実害なし。低優先で記載（下記）。

## 推奨修正（優先度別）

- **高（M16 完了前に修正必須）**: なし。

- **中（M17 着手と並行可）**: なし。

- **低（将来対応）**:
  1. skip 行（dev #91）の resolver fallback が生 code を返す点（上記）。実害は dev-disposable のみで cache 非 regen のため無し。#91 の dev クリーンアップ（開発者作業）完了時に自然消滅。恒久対応は M14-03b の全キャラ system move seed で skip 自体が消える。記録のみで可。
  2. down マイグレの lossy/非対称性（native system move dash も `modifiers.type` dash へ戻る）は指示書 §4.2 の逆写像仕様どおりであり、marker 不在下の最善。progress-log「既知の制約」に明記済み。将来 seed 由来 combo（116 等）を含む DB で down を実行する運用が生じる場合のみ、marker 導入を検討。

## 質問（確認事項）

- **指示書 §4.2 原文 vs 確定方針**: 指示書 §4.2/§3.4-4/-5 は「マイグレ内で published dup 衝突検出（skip＋提示）」「移行コンボのみ targeted `RecomputeComboCache`」を要求するが、実装は開発者確定方針（progress-log §M16-04-4/5・伝達メモ §3）に従い、両者をマイグレに積まず（dup は M14-03b の Go remap＋既存 CRUD 時強制へ委譲、cache は表示文字列バイト一致のため regen 不要）としている。タスク注記どおり本差異は確定方針前提で「準拠」と評価したが、指示書本文と実装の乖離が残るため、**指示書 v1.0.1 での §4.2 追補（確定方針の反映）を設計担当へ推奨**する（CHANGE-064 or overview §4.8 と同トランザクション）。実装是正は不要。

## 良かった点

- dash 撤去の接地点網羅が完璧（Go 定数／resolver map／labels 配列／2 optgroup／dead `DASH_MOVE_CODES`）。残参照ゼロを grep で裏取り可能。
- `modifiers` の NULL 化（`{}` 回避）で native 入力との recipe_hash 一致を担保し、それを専用テストで明示 assert している点は破壊的移行の要諦を突いている。
- skip を `WHERE EXISTS` で表現し、移行不能行を「エラー／削除」でなく「無損失据え置き」にした設計が data 安全に忠実。dev 固有 id の焼き込みも回避。
- system move dash・`uses_dr`・VirtualController の非巻き込みを対象限定で保全（接頭辞/部分一致の巻き込み回避）。
- 完了報告・伝達メモが Plan Mode 8 項目・移行結果・alias 実査・既知制約まで網羅し追跡性が高い。

## 制約事項

- 本レビューはコード上で判定可能な範囲のみ対象。実際の動作確認・パフォーマンス・実機テスト（マイグレの実 DB 適用、E2E での移行後表示、M13 CSV 往復）は別途実施が必要。
- Vitest 664 件通過・`go test ./...` 全通過は完了報告の記載値に基づく（本レビューでは静的確認＋`go build`/`go vet` のみ実行し、いずれもクリーン）。

---

## 取り込み結果（自動トリアージ・2026-07-06）

`implement_plan_full` Phase C により、製造担当が本報告書の各指摘を自動トリアージした結果（採否と理由）。**高指摘 0 件のためエスカレーション対象なし**。

| 指摘 | 優先度 | 採否 | 理由 |
|------|--------|------|------|
| 質問: 指示書 §4.2 原文 vs 確定方針の乖離（v1.0.1 追補推奨） | 質問 | **採用** | 実装是正は不要（確定方針に忠実）。指摘の本旨（指示書本文と確定方針の乖離を設計担当へ明示）を受け、伝達メモ `docs/handover/phase3/M16-04-to-design-memo.md` §3 に「指示書 §4.2 の追補（v1.0.1）」推奨を追記。DES/指示書本体は設計担当の管掌のため製造は編集しない。 |
| 低-1: skip 行(#91)の resolver fallback が生 code を返す | 低 | 不採用 | レビュアー自身「記録のみで可」。dev-disposable の #91 限定・recipe_cache は非 regen で既存「前ダッシュ」維持・clean/user DB では発生せず、実害なし。恒久解消は M14-03b の全キャラ seed（skip 自体が消滅）＝本サブのスコープ外。 |
| 低-2: down の lossy/非対称性 | 低 | 不採用 | 指示書 §4.2 の逆写像仕様どおり・marker 不在下の最善。progress-log §M16-04「既知の制約」に明記済み。将来 seed 由来 combo を含む DB で down 運用が生じる場合のみ marker 導入を検討（後続）。 |

※ 低 2 件はいずれも実害なし・記録済みのため理由を付して自動で不採用（`implement_plan_full` 規定どおり高指摘の不採用のみ開発者エスカレーション対象）。
