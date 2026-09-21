# M17-05a レビュー報告書

## 総評

M17-05a（import 体験再設計 B-1〜B-6）は、指示書・別紙・チェックリストの要求をほぼ全項目満たしている。核である B-6（「新規追加」廃止・「セットプレイのみ取込」＝親解決）はデータ整合の観点で健全に設計されており、`recipe_hash`/`RecomputeComboCache`/`DuplicateKey` への波及が Go テストで固定されている。CSV 契約・BE エラー体系は不変で、B-2 は完全に FE 写像に閉じている（register 分離順守）。M17-04 連携口も外形を温存し `web/src/features/intake/` 差分ゼロを確認した。**重大級（優先度「高」）の指摘はゼロ**。特筆点は setups 重複判定を「VAL-S04 の graceful skip 翻訳」へ変更した設計判断で、これはデータ整合を壊すどころか既存不変条件を保全する妥当な解であり、根拠も文書化されている。ただし指示書 §5.1 の明文（別名・同レシピ＝取込む）との乖離は開発者承認の claim に依存しており、コード上では検証できない点を制約として明記する。

## 設計準拠性レビュー結果

### §1【核】B-6: 重複挙動の改訂 — ◎

- **「新規追加」廃止 — ◎**: `DupAction` 定数から `DupAdd` を削除し `DupSetupsOnly` へ置換（`types.go`）。`parseDupAction`（`handler.go`）は廃止した `"add"` を含む未知値を既定 skip へ倒す。FE `types.ts` の union も `"skip" | "setups_only"` へ更新。E2E で「新規追加」が `toHaveCount(0)`、radio が 2 個であることを検証。廃止は徹底されている。
- **「セットプレイのみ取込」＝親解決 — ◎**: `commitOneCombo` が `setups_only` 時のみ `createdByLocal[localID] = *dupID`（`checkDuplicate` の返す重複相手 id）を登録し、既存の `resolveSetupParent` がこれを引いて setups を既存コンボへ紐づける（`import.go:208-216`）。コンボ本体は Create せず skip のまま。経路は Plan Mode 確定（§3.3-2）どおり。`TestImportSetupsOnlyParentResolution` が「コンボ skip＋setup created・再 export でコンボ 1 件・setups.csv に載る」を検証。
- **setups 重複判定 — ○（判断は妥当・明文乖離は下記制約）**: 承認基準（同名＋同レシピ＝skip／同名別レシピ＝取込む）を満たす。3 ケーステスト `TestImportSetupsOnlyDuplicateSetupJudgement` あり。`internal/service/setup/validate.go:90` の VAL-S04 が `recipeHash`（名前非依存）判定であることを実コードで確認し、完了報告 §4 の「別名・同レシピ＝取込む は VAL-S04 と衝突して実現不能」という主張は**正しい**。graceful skip 翻訳（`hasSetupDuplicateError`）は既存不変条件を保全する妥当解。
- **レシピ判定方法／`recipe_hash` 非流用 — ◎**: combos の `recipe_hash` は流用せず、setup ドメインの正規重複判定（`FindDuplicateInCombo`）を尊重。判断根拠が完了報告 §4・§9.3 に記載（意味の混線回避）。指示書 §9.3 の「迷ったら流用せず別実装＋根拠を報告」に厳密に従っている。
- **2 択構成 — ◎**: `DUP_OPTIONS` 配列 2 要素で map 描画。
- **「上書き」枠の予約 — ◎**: 実装せず、`DupAction` 型に `"overwrite"` を足し配列へ 1 要素 push するだけで 3 択化できる構造をコメントで明記（`types.ts`・`ComboImportPage.tsx:34-40`・`types.go`）。UI 非表示。M13-i 繰越を守り、3 度目の改修を避ける予約形になっている。

### §2【核】非波及（データ整合） — ◎

- `DuplicateKey`（VAL-C02）不変。`checkDuplicate` は既存の `comboSvc.CheckDuplicate` をそのまま呼ぶのみで判定キーに手を入れていない。
- 親解決は combo cache を再計算しない。setups_only でも重複 combo は Create せず skip のため `RecomputeComboCache`/`recipe_hash` は不発火。setups 追加は `CreateSetup`（setup cache のみ）。`TestImportSetupsOnlyDoesNotTouchCombo` が既存コンボの `version`/`step_count`/`recipe_cache` 不変をテストで固定。
- CSV 契約不変（2 CSV・ZIP 往復・列構成維持）。既存往復テスト群は `DupAdd`→`DupSkip` へ置換されたのみで論理は不変、全 green。
- スキーマ変更ゼロ。

### §3 B-2: エラーの日本語化（register 分離） — ◎

- BE 不変。BE は従来どおり `[VAL-CODE] column: message` の単一文字列を返し、FE `formatIssue.ts` が parse→`comboImport.val.*`/`col.*` 写像。BE 側に写像ロジックは無い。
- VAL コード折りたたみ保持。`IssueBadge` が `<details>` で原文（`raw`）を保持。E2E で `[VAL-ENUM]` が `toBeAttached()`（折りたたみ内）を検証。
- 未写像フォールバック。`formatIssue` は code 無し／写像無し（`defaultValue: ""`）で原文を返す。単体テストで英語原文フォールバックを固定。
- i18n 両ロケール parity。`ja.json`/`en.json` 同一キー、`locales.test.ts` 2 件 green を実行確認。

### §4 B-1 / B-3 / B-4 / B-5 — ◎

- **B-1 — ◎**: setups 単独導線を除去し従属欄化（コンボ CSV 未選択時 `disabled`＋注記）。`handlePreview`/`handleCommit` に `comboFile` 必須の送信前ガード。CSV 契約不変。E2E で欄の disabled→enabled 遷移を検証。
- **B-3 — ◎**: `usePreviewNames` が `useCharacters`（code→nameJa）＋ per-character `GET /api/moves`（`useQueries`・queryKey は `useMovesByCharacter` と共有）を流用。新規解決機構を作っていない。未投入キャラ・未知 code は生 code フォールバック（`|| characterCode` / `|| moveCode`）で隠していない。E2E で nameJa 表示を検証。
- **B-4 — ◎**: combo テーブルから local_id 列を削除、行特定は行番号（`aria-label` も「N行目を取込対象にする」へ）。CSV 列は維持（`localIDOf` は残存）。E2E で local_id columnheader が `toHaveCount(0)`。
- **B-5 — ◎**: 完了トースト（成功/スキップ/エラー件数）・`reportRef` への `scrollIntoView`・実行中の `disabled`＋「取込中…」進行表示。E2E で「取込完了」トーストを検証。

### §5 既存確定の遵守 — ◎

- チェックボックスはコンボ行単位のまま。独立 setup チェックボックスは作っていない（setups プレビューは参照表示のみ・チェックボックス無し）。
- 親解決可否の ○/× 参照表示は維持（`parentResolvable`）。
- M13-i（上書き）は未実装（枠の予約のみ）。

### §7【v1.0.1】M17-04 連携口の非回帰 — ◎

- 自動プレビュー effect（router state→`setTimeout(0)`＋cleanup＋`previewMRef`＋`previewM.data` 購読）を温存。依存は安定な `intakeCsvText` のみ。外形挙動は不変。
- `web/src/features/intake/`・`internal/*/intake`・`IntakeHelperPage.tsx` の差分ゼロを `git diff --stat` で確認（完了報告 §5 の claim を実測で裏付け）。
- §5.19 側に写像を作っていない（`comboImport.*` は import 画面側のみ）。
- router 層リファクタ（followup §G-15）は未実施。

### §6 テスト・ドキュメント — ◎

- Go: comboio/csvcore/api 全 green を実行確認。B-6 の 3 テスト群（親解決・重複判定 3 ケース・非波及）あり。
- Vitest: `formatIssue.test.ts` 8 件・`locales.test.ts` parity 2 件を実行し green 確認。
- E2E: B-1〜B-6＋B-2 新規を spec に反映（`make e2e` の実行はサンドボックス制約で本レビューでは未実施＝完了報告の 37 件 green claim に依拠）。
- 完了報告に Plan Mode 9 項目・setups 重複判定の方式と根拠・上書き枠予約形・DES 反映要点あり。製造は DES を直接編集していない。
- 禁則表現（簡体字・「起き攻け」誤字・「DR」略記）・console/fmt.Print 残置を grep で確認、いずれも無し。

## 設計準拠性以外の指摘事項

1. **[低] graceful skip が同一行の併発エラーを覆い隠す**: `commitOneSetup` は `hasSetupDuplicateError(vr)` が true なら他のエラーの有無に関わらず「skipped」を報告する（`import.go:285-288`）。VAL-S04 と別の検証エラー（例 VAL-S06 空名）が同一 setup 行で併発した場合、失敗理由が skip に丸められる。実害は小さい（重複行の破棄は妥当）が、`vr.HasError()` かつ VAL-S04 以外のエラーも含む場合は failed 優先とする方が診断性は高い。

2. **[低] preview の親解決 ○ と default-skip 時の commit 結果の不一致**: `ParsePreview` の `parentResolvable` は batch 内メンバーシップ（`batchLocals`）で ○ を出すが、既定 `skip` を選ぶと重複コンボが未作成となり、その配下 setup は commit で「親未作成」skip になる。preview は選択 dupAction を知らないため生じる既存構造の延長で、setups_only 追加により顕在化しうる。データ整合の問題ではないが UX の期待差。

3. **[低] B-5 トースト文言が i18n 化されていない**: `handleCommit` のトーストはハードコード日本語（`ComboImportPage.tsx:135-137`）。ただしページ全体が元来ハードコード日本語（写像対象は val/col のみ）で、指示書 §9.2 で文言は仮でよいとされているため許容範囲。将来 i18n 化する場合の申し送り。

4. **[観察] `usePreviewNames` の `moveNameByKey`/resolver が毎レンダー新規参照**: `moveQueries` が毎レンダー新規配列のため memo が再計算され `names` も新規オブジェクトになる。本ページでは `names` に依存する `useEffect` が無いため無限ループ・OOM の懸念は無い（MEMORY の Vitest 無限ループ罠には抵触しない）。コメントで許容を明記済み。指摘ではなく確認事項。

## 推奨修正（優先度別）

- **高（M17-05a 完了前に修正必須）**: なし。
- **中（後続と並行可）**:
  - 指摘 1（併発エラーの skip 丸め）を、VAL-S04 以外のエラーが併存する場合は failed を優先する形へ整える。診断性の改善。設計判断ではなく実装細部のため後続で可。
- **低（将来対応）**:
  - 指摘 2（preview ○ と default-skip 時の不一致）。dupAction を preview へ渡す設計は本サブのスコープ外だが、DES-005 §5.14 の CHANGE 起票時に注記候補。
  - 指摘 3（トースト i18n）。文言確定時にまとめて対応。

## 良かった点

- setups 重複判定で `recipe_hash` 流用の誘惑を退け、setup ドメインの正規重複判定を尊重した点（指示書 §9.3 に厳密準拠）。判断根拠も完了報告に明記。
- VAL-S04 との設計衝突を実装中に検知し、勝手に BE 不変条件を曲げず開発者へエスカレーションしたうえで graceful skip 翻訳へ着地させた判断プロセス。データ整合を最優先する姿勢が良い。
- 非波及を「主張」でなく `TestImportSetupsOnlyDoesNotTouchCombo` の version/step_count/recipe_cache 不変アサーションで**テストで固定**した点。
- 「上書き」枠の予約が配列＋型 union の 1 要素追加で済む最小構造になっており、3 度目の改修を避ける指示意図を的確に汲んでいる。
- M17-04 連携口の脆い StrictMode 対策 effect を理解したうえで温存し、`git diff` 差分ゼロで非侵襲を実証している。

## 制約事項

- 本レビューはコード上で判定可能な範囲のみ対象。実際の動作確認・パフォーマンス・実機テストは別途実施が必要。
- **setups 重複判定の「別名・同レシピ＝skip」は指示書 §5.1 の明文（＝取込む）と乖離**する。完了報告 §4 は 2026-07-18 の開発者エスカレーション・確定を根拠とするが、**この開発者承認の事実はコード・リポジトリ上では検証できない**。設計判断としてはデータ整合上妥当（VAL-S04 保全）であり文書化も適切だが、承認 claim の真正性と、指示書 §5.1／DES-006 §6 の明文補正（完了報告 §8 で起票要と自認済み）は開発者・設計担当側での確認を要する。
- `make e2e`（37 件 green）はサンドボックス制約により本レビューで再実行しておらず、完了報告の記載に依拠している。

---

## 取り込み結果（自動トリアージ）

implement_plan_full Phase C による自動トリアージ結果（2026-07-18・製造 Claude Code）。**優先度「高」の指摘はゼロ**のためエスカレーション不要。

| 指摘 | 優先度 | 採否 | 理由・対応 |
|------|--------|------|-----------|
| 1. graceful skip が同一行の併発エラーを覆い隠す | 中 | **採用** | `hasSetupDuplicateError` を `isOnlySetupDuplicateError` へ変更し、**VAL-S04 のみで構成される検証エラーのときだけ skip**、他エラー併発時は failed を優先する形へ修正（`import.go`）。診断性の改善。既存 3 ケーステストは純 VAL-S04 のため引き続き green。 |
| 2. preview の親解決○ と default-skip 時の commit 結果の不一致 | 低 | **不採用（繰越）** | preview が選択 dupAction を知らない既存構造の延長で、データ整合の問題ではない。dupAction を preview へ渡す設計は本サブのスコープ外。**DES-005 §5.14 の CHANGE 起票時の注記候補**として完了報告 §8 に追記。 |
| 3. B-5 トースト文言が i18n 未対応 | 低 | **不採用（繰越）** | インポート/エクスポート画面は元来ハードコード日本語の固定 ja 境界（M17-04 の判断に整合）で、写像対象は VAL の val/col のみ。指示書 §9.2 で文言は仮でよいとされる。文言確定時にまとめて対応。 |
| 4. `usePreviewNames` の毎レンダー新規参照 | 観察 | **対応不要** | レビュー自身が「`names` に依存する useEffect が無く無限ループ・OOM の懸念なし」と確認済み。コメントで許容明記済み。 |

**エスカレーション**: 優先度「高」の不採用は無し（該当ゼロ）＝開発者確認不要。中 1 件採用、低 2 件は理由を付して繰越。
