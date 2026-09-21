# M16-03 レビュー報告書

| 項目 | 内容 |
|------|------|
| 対象 | M16-03（起き攻めの正規化＝`combo_oki_options` 新設・シミー 4 区分化・打撃重ね・承認ゲート G-h） |
| 対象指示書 | `docs/instructions/phase3/M16-03-normalize-oki-options.md` v1.0.0 |
| 突合チェックリスト | `docs/instructions/phase3/reviews/M16-03-review-checklist.md` v1.0.0 |
| レビュー範囲 | `git diff main...HEAD`（コミット 33e5beb / 9a29b6d / 7af461f / 37d2a05） |
| レビュー実施 | 品質レビュー担当 Claude（Opus 4.8・read-only）/ 2026-07-05 |
| ビルド/テスト | `go build ./...`＝成功 / `go vet`＝クリーン / `go test`（migration・repository combo・validation・comboio・comboio/csvcore・api combo）＝全 ok / `tsc --noEmit`＝0 エラー / `pnpm test`＝**664 passed（100 files）** |

## 総評

設計意図（非対称の是正・決定論 backfill・dup/recipe 非対象の維持・「ドライブラッシュ」正式名称・CSV 後方互換）をいずれも忠実に満たした、完成度の高い実装である。マイグレ 000021 の backfill 写像は指示書 §4.1 の 6 通りに正確に一致し、`false`/`NULL` は行を作らず、破壊的 down（shimmy-DR / strike_meaty の損失）を SQL コメント・完了報告・マイグレテストの三箇所で明示している。6 bool の全接地経路（model/DTO/service/repository/CSV/VAL/FE 型・editor・詳細・比較・出力）は概ね網羅され、ビルド・型検査・Go/FE の全テストが通過する。承認ゲート G-h（Plan Mode 着手前承認）・Plan Mode 8 項目の確定も完了報告に記録済み。**重大（§9）は 0 件**。ただし FE の zod スキーマ `web/src/features/combo/schema.ts` に旧 6 bool フィールドが撤去されず残存しており（機能影響はないが完了報告 §4 の記述と不一致）、中優先で是正を推奨する。

## 設計準拠性レビュー結果

### §1 設計書本体・上位文書との照合

- **§1.1 正規化テーブルと backfill** ◎
  `migrations/000021_..up.sql` は `combo_oki_options(id, combo_id FK→combos ON DELETE CASCADE, attack_type, tech_type, uses_dr, UNIQUE(combo_id,attack_type,tech_type,uses_dr))` を新設。`available` 列は持たず sparse（Plan Mode 確定どおり）。backfill は §4.1 の 6 通りを `WHERE <bool>=1` の INSERT で表現し、既存シミーは `uses_dr=0`、`false`/`NULL` は行を作らない。6 bool 列を DROP、`knockdown_advantage` は残置。マイグレテスト（`migrate_test.go` L966-1082）が「true 3 件のみ行生成・false/NULL は 0 件・DROP 確認・残置確認」を検証。
- **§1.2 語彙（friend 棚卸し）** ◎
  `attack_type ∈ {throw_meaty, shimmy, strike_meaty}`・`tech_type ∈ {neutral_tech, back_tech}`・`uses_dr` を全 attack_type へ一様適用。打撃重ね（strike_meaty）追加とシミー 4 区分化を実現。下位分類の独断追加なし。完了報告 §2-1 に開発者確定（2026-07-05）を記録。
- **§1.3 editor/表示・ドライブラッシュ正式名称** ◎
  `ComboEditorBasicFields.tsx` L382-415＝attack_type ごとにグルーピングした正規化オプション UI（シミー・打撃重ねにドライブラッシュ切替）。ラベルは `web/src/constants/oki.ts` の `OKI_USES_DR_LABEL = "ドライブラッシュ"` を単一正典として参照し、**「DR」略記は皆無**（`ComboEditorBasicFields.test.tsx` L378 が `not.toContain("DR")` を検証）。詳細（`ComboDetailMetadata.tsx` sparse リスト）・比較（`CompareTable.tsx` の 12 変種個別行）・出力（`export-model.ts` の 12 変種展開）いずれも `okiOptionLabel()` 経由で表示し、比較の非対称（シミーに DR 行なし）が解消。
- **§1.4 CSV 後方互換** ◎
  `csvcore/contract.go`＝既存 6 列は必須列、新 6 列（`oki_shimmy_neutral_tech_dr`・`oki_shimmy_back_tech_dr`・`oki_strike_meaty_*` 4 列）を `CSVColumns` 末尾に追加し `optionalImportColumns` へ登録。`requiredImportColumns` は旧 6 列のみを必須とするため、**旧 CSV（消費列・新オプション列なし）の import が成立**。export（`export.go setOkiFlatFlags`）は行 → `*bool`（present=true / absent=nil）へ、import（`import.go okiOptionsFromFlatFlags`）は `true` のフラグのみ行を作る sparse 往復。往復の情報保存を確認。
- **§1.5 DES 直接編集の禁止** ◎
  DES-003/005/006/002 本体は未編集（`git diff` 対象外）。§3.4 の 6 bool 記述・§417 の「将来正規化スケッチ（`available` 列付き）」は温存され、CHANGE 見込み 062〜として完了報告 §6.2 で申し送り。

### §2 マイグレーションの健全性

◎（△ なし）

- **FK=OFF × 明示 DELETE 同居** なし。up は「新テーブル INSERT + 列 DROP」のみで子行 DELETE を伴わず、down は `DROP TABLE`（明示 DELETE ではない）。両ファイル冒頭コメントが retrospective-digest §5 非該当を明記。
- **破壊的 down の明記** あり。down SQL L3-7 が「shimmy-DR / strike_meaty は 6 bool に受け皿がなく失われる（C-3 型・up→down→up で復元不能）」を明記し、マイグレテスト L1046-1081 が新変種投入→down→行喪失（table DROP）を明示検証。
- **`dbtest.Setup` 全通過** — repository combo・comboio 等の既存テストが 000021 適用後に全 ok。破壊なし。
- **既存マイグレ改変なし** — `git diff --name-only -- migrations/` は 000021 の up/down のみ。連番は 000020（M16-02）の後で正。

### §3 データ層・API の整合

◎

- `model.Combo` は 6 `*bool` を撤去し `OkiOptions []OkiOption`（DB マップ対象外・sparse・nil=未ロード）へ。列挙定数 `OkiAttackType*`/`OkiTechType*` をパッケージ定数化。`KnockdownAdvantage` 残置。
- DTO（`dto.go`）は `ComboResponse.OkiOptions`（常に非 nil＝空配列）・`CreateRequest.OkiOptions`・`UpdateMetadataRequest.OkiOptions *[]OkiOptionDTO`（replace-set：nil=不変更/非nil=全置換）へ置換。JSON タグは camelCase（`attackType`/`techType`/`usesDr`）で規約準拠。3 マッピング関数で model 変換。
- repository は combos の SELECT/INSERT から 6 oki 列を除去し、`ReplaceOkiOptions`（delete-all-then-insert）・`FindOkiOptionsByComboID`・`FindOkiOptionsForCombos`（IN 句バルク）を追加。`FindByID`・`List` に注入。`DuplicateKey`・`FindActiveByDuplicateKey` の WHERE は 6 キー不変（oki 非参照）。
- `RecomputeComboCache` は起き攻め非依存。Create/PUT では steps 起因で従来どおり呼ぶが、**PATCH のオプション置換（`ReplaceOkiOptions`）では呼ばない**（`service.go` L421-426）。完了報告 §4 の grep 0 件確認と整合。recipe_hash 不変。

### §4 テストの妥当性

◎

- **Go**: マイグレ up/down（backfill 6→3 行・false/NULL 除外・DROP・逆写像・新変種損失）／repository（往復・打撃重ね/シミー DR 保存・replace-set 差替・空で全解除）／VAL-C11（uniform：throw/shimmy/strike すべてで DR 単独→WARNING・no-gauge 同席で無警告、`combo_test.go`）／CSV（`csvcore` 検証・旧 CSV import）。dup 非回帰は既存 CheckDuplicate/recipe テスト不変で担保。
- **FE（Vitest 664 passed）**: editor（12 変種 test-id・トグルで `okiOptions` 反映・「ドライブラッシュ」正式名称・「DR」不在・「打撃重ね」見出し）／compare（12 変種 ✓/✗ 個別行）／export（12 変種展開）。
- **型/ビルド**: `go build`/`go vet`/`tsc --noEmit` いずれもクリーン。

### §5 設計意図との整合

◎ 4 点すべて満たす。非対称是正（シミー 4 区分・打撃重ね）／決定論 backfill（既存シミー=uses_dr=0・新変種のみ空）／dup・recipe 非対象維持（recipe_hash 不変）／ドライブラッシュ正式名称（constants/oki.ts 単一正典・略記なし）。

### §6 コード品質・規約遵守

○（下記「設計準拠性以外の指摘」に軽微 2 件）

- 曖昧語依存なし。`console.log`/`fmt.Println` 残置なし（本番コード grep 0 件）。簡体字なし。
- 6 bool 全接地経路 grep 結果・dup/recipe 非対象確認は完了報告 §4 に記載。ただし FE `schema.ts` の残存（下記 中-1）が経路網羅の実態と報告の間に齟齬を生む。
- CLAUDE.md §4 の列挙同期（バックエンド `model.OkiAttackType*` ⇔ フロント `web/src/constants/oki.ts`）を満たす。

### §7 既存挙動の温存（非破壊性）

◎ `knockdown_advantage`・ゲージ列・drive_damage 等の combos 列不変。VAL-C02/DuplicateKey/recipe_cache 不変。M13 CSV 往復（新旧）成立。既存起き攻めデータは決定論 backfill で保全。

### §8 ドキュメント・進捗ログ

○ 完了報告に Plan Mode 8 項目・テストケース数・既知の制約（down 損失＝shimmy-DR/strike_meaty・available sparse 採用）を記載。CHANGE 見込み 062〜の伝達メモは完了報告 §6.2 に表形式で内包（DES-003 §3.4／DES-005 §5.6-5.13／DES-002 §7.6／DES-006 VAL-C11／PATCH 意味変更）。**なお本ブランチには前サブ M16-02 の設計反映 CHANGE-061（notification / report / change-number-registry）も同梱されている**（M16-03 の成果物ではないが、レビュー範囲の diff に含まれる。内容は M16-02 の DES 反映で妥当）。M16-03 分の伝達メモは独立ファイルではなく完了報告内テーブルである点のみ申し添える（内容は充足）。

## 設計準拠性以外の指摘事項

- **（中-1）FE zod スキーマに旧 6 bool フィールドが残存**
  `web/src/features/combo/schema.ts` L58-63 に `okiMeatyNeutralTechThrow` 等の旧 6 bool フィールドが `z.boolean().nullable().optional()` として残り、新 `okiOptions` の宣言がない。実害はない（`ComboEditor.tsx` L214 の `parseComboForm(payload)` は検証専用で `parsed.data` を送信ペイロードに使わず、実ペイロードは `buildCreatePayload()` が `okiOptions: basic.okiOptions` を直接載せる。zod オブジェクトは未知キー `okiOptions` を非エラーで strip する）。ただし (a) 完了報告 §4 は「FE 型…`schema.ts`」を接地経路として更新済みと記すが実体は未更新で**報告と不一致**、(b) `schema.test.ts` も oki を参照しない純デッドコード。**根拠**: チェックリスト §9「6 bool 全接地経路を取りこぼしている（…FE…）」に該当し得るが、保存パスは完全結線済みでデータ喪失を伴わないため機能上は非ブロッキング。旧 6 bool を削除する（必要なら `okiOptions` を任意配列として追加する）ことを M16 完了前に推奨。

- **（低-1）出力モデルの docstring が実装（12 行）と不一致**
  `web/src/features/combo-io/export-model.ts` L123 の関数 docstring「oki…6 つの個別行に展開する（DES-005 §5.8 準拠）」は、実装（L158-168・`OKI_OPTION_SPECS` の 12 変種展開）と数が食い違う陳腐化コメント。`CompareTable.tsx` L47 は「12 変種」で正。docstring を「12 変種」へ更新するのが望ましい。

## 推奨修正（優先度別）

- **高（M16 完了前に修正必須）**: なし（重大 §9 は 0 件）。
- **中（M17 着手と並行可）**:
  - 中-1: `web/src/features/combo/schema.ts` の旧 6 oki bool フィールドを撤去（デッドコード解消・完了報告 §4 との整合回復）。あわせて完了報告 §4 の「`schema.ts` 更新済み」記述を実態に合わせる。
- **低（将来対応）**:
  - 低-1: `export-model.ts` の「6 つの個別行」docstring を「12 変種」へ更新。
  - （参考）PATCH 経路の oki 置換では VAL-C11 が評価されない。ただしこれは従来のメタデータ PATCH 挙動（`ValidateMetadataRanges` は C11 非包含）と一致し、指示書 §4.5「起き攻めに保存ブロックの新規 VAL を足さない」に沿う仕様。回帰ではないため対応不要（記録のみ）。

## 良かった点

- マイグレ 000021 の backfill が指示書 §4.1 の 6 写像に一字一句一致し、`false`/`NULL` の行非生成、既存シミー=`uses_dr=0` を SQL・テストの両面で厳密に担保。
- 破壊的 down の情報損失（shimmy-DR / strike_meaty）を「down SQL コメント・完了報告 §6.1・マイグレテスト（新変種投入→down→喪失検証）」の三重で可視化。retrospective-digest §5（FK=OFF×明示DELETE非同居・down 整合）を明示的に回避。
- CSV を sparse 往復（present→"true"、absent→NULL、import は "true" のみ行生成）で設計し、`requiredImportColumns`/`optionalImportColumns` の 2 分化で旧 CSV 後方互換を機構的に保証。
- 起き攻めラベルを `web/src/constants/oki.ts` へ集約し、editor/詳細/比較/出力/i18n の表記揺れ（特に「DR」略記）を単一正典で封止。テストで略記不在を能動検証。
- dup/recipe 非対象を「`DuplicateKey` WHERE・`CalcRecipeHash`・`RecomputeComboCache` の oki 非参照」を実コードで確認のうえ、PATCH の oki 置換で cache 再計算を呼ばない結線まで徹底。
- PATCH の replace-set 化（per-field `Optional[bool]` → `okiOptions` nil/非nil）を `TagIDs` と同一方式に統一し、意味変更を CHANGE 見込みとして明示申し送り。

## 制約事項

- 本レビューはコード上で判定可能な範囲のみ対象。実際の動作確認・パフォーマンス・実機テスト（editor での保存→リロード反映、比較画面の 12 変種描画、CSV の実ファイル往復、旧 CSV の実 import）は別途実施が必要。
- Plan Mode 着手前確認（8 項目）・承認ゲート G-h の着手前承認そのものの証跡は完了報告の記載（Plan Mode 提示→ExitPlanMode 承認取得済み）に基づき確認しており、対話ログ実体は本レビューの参照範囲外。

---

## 取り込み結果（自動トリアージ）

本コマンド Phase C（implement_plan_full）による自動トリアージ。人間承認を外す代償として採否理由を以下に記録し事後監査可能とする。**優先度「高」の指摘は 0 件のためエスカレーション不要**（安全弁: 高指摘の不採用のみ開発者確認を要する）。

| 指摘 | 優先度 | 採否 | 理由・対応 |
|------|--------|------|-----------|
| 中-1: `schema.ts` に旧 6 oki bool の zod フィールドが残存・`okiOptions` 未宣言 | 中 | **採用（修正済）** | 実害は無い（`buildCreatePayload()` が `okiOptions` を直接載せ、`parsed.data` は送信に使わない）が、デッドコード + 完了報告 §4 との不一致。`okiOptions: z.array(z.object({attackType, techType, usesDr}))` へ置換。tsc クリーン・schema.test.ts 全通過を確認 |
| 低-1: `export-model.ts` の docstring「6 つの個別行」が実装（12 変種）と陳腐化 | 低 | **採用（修正済）** | `ExportFieldRow.key` コメント（L40）と `buildComboFields` docstring（L123）を「12 変種」へ是正 |

**重大（§9）0 件・高優先 0 件。**採用 2 件はいずれも自動適用（軽微・スコープ内・低リスク）。修正後 `go build`/`go test ./...`・`tsc --noEmit`・`pnpm test`（該当分）再通過を確認。
