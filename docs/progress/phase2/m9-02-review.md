# M9-02 レビュー報告書

## 総評

FR704（moves CSV 取込）の実装は、指示書 §4.1〜§4.7 の要件（別経路 preview/commit・共通サービス層・total 算出分岐・properties/combo_scaling 検証・notes 2 分割・行単位 upsert・3 テーブル依存順・部分成功）をほぼ忠実に満たしており、実 CSV（classic 5 体）のデータパターンとも整合する。Plan Mode 7 項目の確定結果・seed 破壊的クリアの M12-02 延期・critical_art 定数補完が progress-log に明記されており、トレーサビリティも良好。テストもサービス層・統合・フロント純関数・E2E まで網羅されている。

ただし **1 件の明確な実装欠陥**（`web/src/features/import/types.ts` 内の NUL バイト混入により git がバイナリ判定 → 差分レビュー不能）があり、これは完了前修正を要する。加えて §4.8 の `MoveListItem` 集約（埋め込み）は推奨どおりには実施されておらず（GET 契約は不変・model.Move 活性化は達成）、設計意図の確認が望ましい。重大な設計違反（GET 契約破壊・誤 total 自動算術・name_ja の moves 投入・全体ロールバック・未知キー黙殺）は **いずれも無し**。

## 設計準拠性レビュー結果

### §1.1 取込エンドポイント — ◎
- `POST /api/import/moves/preview`（dry-run・DB 書込なし）+ `POST /api/import/moves`（commit）の別経路方式（`routes.go`）。`dryRun` フラグ単一経路ではない。
- 解析・算出・正規化はパッケージ関数 `ParsePreview`（`parse.go`）に単一化され、preview ハンドラ・commit の双方が呼ぶ（`service.go` の `Commit` が冒頭で再 `ParsePreview`）。重複なし。✓
- DES-002 は製造担当が直接編集していない（CHANGE-029 で設計担当対応）。✓

### §1.2 CSV 列マッピング — ◎
- 22 列が `csvColumns` で実 CSV ヘッダと完全一致（`combomgr-importer/dist/*.csv` 実測一致を確認）。
- `name_ja` は moves ではなく preset_aliases（official_ja_move）へ（`UpsertOfficialJaAlias`、キー `(preset_id, move_id)`）。✓
- `command` / `condition_ja` / `condition_en` は moves.raw_data 同名キーへ退避（`buildRawData`）。専用列の追加なし。✓

### §1.3 total 算出 — ◎
- 整数 recovery → 式 `startup + active − 1 + recovery`（`computeTotal`、テスト `4/3/7 → 13`）。
- `全体 N`（正規表現 `^全体\s+(\d+)$`）→ total=N 直接。実 CSV の `全体 N` は全件スペース区切りで regex に合致することを確認。✓
- `着地後N` / `N+着地後M` / `※N` / 未知 / 空 → total=NULL + 要確認（自動算術せず）。実 CSV の `10+着地後13`・`※23` 等が NULL 化されることをロジック・テストで確認。✓
- NULL 伝播（startup/active 空欄 → NULL、active NULL = 弾系）も実装・テスト済み。✓

### §1.4 正規化・写像 — ○
- properties: 単一→コード値、複数→主+raw_data（properties_extra）、未知→raw_data+要確認（`normalizeProperties`）。実 CSV は全件単一値（high/mid/low/throw）で、複数値・未知はテストの合成データで担保。✓
- critical_art: 実 CSV では category 列が既に enum コード値（`critical_art` 5 件・`drive_impact` 等）を保持しており、ツール側で enum 写像済み。アプリ側は `knownCategories` で検証し `ca_` 接頭辞の code をそのまま取り込む（テスト `TestCriticalArtMapping`）。指示書 §4.4 の「公式カテゴリ→enum 写像」はツール責務で完結しており、アプリは検証のみで妥当。✓
- combo_scaling: JSON 文字列のまま格納し、正準4キー（multiplier_scaling 含む）と照合・未知キー→要確認、parse 失敗も要確認（`validateComboScaling`）。実データのキー（initial/combo/immediate）が全て受理されることを確認。✓

### §1.5 notes — ◎
- `【ツール付記】`（`toolNoteMarker`）で `strings.Cut` による 2 分割、原文ブロックは再分割せず保持（テストで原文中の `; ` 非破壊を担保）。✓
- on_hit/on_block: `D`→NULL+付記、`※N`→数値+付記、符号付き整数→値、範囲・`ー`→原文退避（`parseFrameAdvantage`）。✓

### §1.6 行単位 upsert・依存順 — ○
- 依存順 characters → moves → preset_aliases（`commitRow` の順序）。✓
- upsert キー: characters `(game_id, code)`（`ON CONFLICT DO NOTHING` + 再 SELECT）、moves `(character_id, code)`（`ON CONFLICT DO UPDATE ... RETURNING id`）。✓
- 全体ロールバックせず行単位 tx・失敗行スルー・行単位レポート + summary（success/skipped/failed）。冪等・部分成功・未選択スキップを統合テストで担保。✓
- 軽微: 「親 characters 失敗 → 子 moves スキップ」は行単位 tx 内で character upsert 失敗→当該行 Failed となる形で満たすが、**character upsert 失敗そのものの異常系テストは無い**（`UpsertByCode` が失敗しにくいため）。持ち越し可。

### §1.7 seed 再生成 — ○（開発者確定の延期）
- 指示書 §4.9 / チェックリスト §1.7 は旧 seed クリア + 再投入マイグレを期待するが、`dbtest.Setup` が全マイグレ適用するため旧 seed 削除で既存テスト 13 ファイル/185 箇所が破壊される問題を発見し、**開発者確定で M12-02 へ延期**（progress-log に明記、000014 は加算のみ）。チェックリスト §9「既存 seed クリアで参照不整合」を回避する妥当な判断。設計意図（配布クリーン初期状態）は M12-02 へ TODO 化済み。✓
- 純粋入力ジャンプの seed 管理も後続延期（実 CSV に system カテゴリ 0 件のため取込対象外、開発者確定）。✓

### §2 / §7 API 整合性・非破壊性 — ◎
- GET 読取路（`queries.go` の `listByCharacterSQL`・`MoveListItem`・api/move DTO）は git diff 上 **一切未変更**。MoveResponse 契約不変を確認。✓
- commit `onSuccess` で `queryClient.invalidateQueries({ queryKey: ["moves"] })`（`api.ts`）。✓
- コンボ CSV インポート（FR405）・moves スキーマに影響なし。✓

### §3 フロントエンド — ○
- `ImportMovesPage.tsx` 新設・`router.tsx`（`/import/moves`）・`Header.tsx`（「技取込」導線）登録。✓
- 行チェックボックス（既定で importable 行を全チェック・個別/一括解除）、確定値（total/properties/category 日本語化）表示。✓
- 要確認強調 (i)〜(vi)：`rowNeedsConfirmation` が warnings または errors を持つ行をハイライト（`data-needs-confirmation` + `bg-amber-50`）。(vi) エラー行も対象。✓
- 無害化：値はテキストノードとして描画（React 既定エスケープ）、`dangerouslySetInnerHTML` 不使用。✓
- shadcn/ui（Table/Checkbox/Badge/Button/Input）を踏襲、自作再発明なし。✓

### §4 テスト — ◎
- Go: total 7 ケース・properties 3・combo_scaling 6・critical_art・notes 3・検出エラー 2・ヘッダ検証、commit 統合 5（happy/冪等/部分成功/未選択スキップ/未 seed キャラ作成）。実 CSV 由来の代表 code（hadoken_light・yoga_splash 等）も使用。✓
- Vitest: `rowNeedsConfirmation` (i)〜(vi)・`rowKey`、コンポーネントテスト（progress-log 記載）。✓
- E2E: `import-moves.spec.ts` を seed 非依存・self-contained で追加、既存 combo-crud 継続通過（progress-log 記載）。✓

### §5 設計意図 — ◎
- 「推測で算術しない」「検証 2 段階（preview 寛容 / commit 厳格）」「3 テーブル依存順・部分成功」「combo_scaling 追従漏れ検出ゲート」いずれも満たす。

## 設計準拠性以外の指摘事項

1. **【欠陥】`web/src/features/import/types.ts` に NUL バイト（0x00）混入** — `rowKey()`（78 行目）の区切り文字がスペースではなく **NUL バイト**（`` return `${row.characterCode}\x00${row.moveCode}`; ``）。このため git が当該ファイルを **バイナリ判定**（`git diff` で `Bin 0 -> 2407 bytes` 表示）し、差分レビュー・ultrareview 等のツールが本ファイルを読めない。機能上は動作する（code に NUL は出現しない）が、CLAUDE.md §10「トレーサビリティの確保」に反する。なお `ImportMovesPage.tsx` のレポート行 key（244 行目）は **スペース区切り**（`` `${res.characterCode} ${res.moveCode}` ``）で、区切り文字の不整合もある。→ NUL を通常文字（スペース等、`ImportMovesPage` と統一）へ修正すべき。

2. **§4.8 `MoveListItem` 集約（埋め込み）が未実施** — 指示書 §2.2 は「`MoveListItem` を `model.Move` から導出/埋め込みへ」、§4.8 は埋め込みを「推奨」とする。実装は `model.Move` を取込 upsert の構築箇所として活性化（デッドコード解消）し GET 契約も不変だが、`MoveListItem` は従来どおり `model.Move` と重複した約 14 フィールドを独立保持したまま。Plan Mode-1 で「GET 読取路は一切変更しない」と開発者確定済み（progress-log）であり違反ではないが、「二重定義の集約」という §4.8 の主眼は構造的には未達。設計担当へ「重複保持を許容する確定か」確認が望ましい。

3. **camelCase 統一・定数同期 — 良好** — DTO（`previewRowDTO`/`rowResultDTO`）は camelCase、フロント型は対応する camelCase ミラー。`critical_art` enum を BE（`model.MoveCategoryCriticalArt`）+ フロント（`MoveCategory`/`MOVE_CATEGORY_LABEL_JA`/`MOVE_CATEGORY_ORDER`）両側で同期（CLAUDE.md §4 準拠）。✓ `WarningCode` も BE 定数 ↔ フロント `ImportWarningCode` union が同期。

4. **`api.ts` の生 fetch 使用 — 妥当だがコメントで明示済み** — multipart 送信のため共通 `fetchJSON`（Content-Type 固定）を回避し生 fetch を使用。理由がコメントに明記されており許容。

## 推奨修正（優先度別）

- **高（M9 完了前に修正必須）:**
  - 指摘 1：`types.ts` の NUL バイトを通常文字へ修正（git バイナリ判定解消・`ImportMovesPage` と区切り統一）。

- **中（M9-03 着手と並行可）:**
  - 指摘 2：`MoveListItem` の `model.Move` 埋め込み可否を設計担当と確認（重複保持を確定とするか、後続で集約するか）。

- **低（将来対応）:**
  - §1.6 軽微：character upsert 失敗（親失敗→子スキップ）の異常系テスト追加。
  - M12-02 TODO（旧 seed 破壊的クリア + 再投入・配布クリーン初期状態）の確実な引継ぎ（progress-log に記録済み）。

## 良かった点

- 共通サービス層（`ParsePreview`）への解析・算出・正規化の単一化が徹底され、preview/commit の計算が単一情報源。経路分離の採用根拠も実装に反映されている。
- 実 CSV（classic 5 体）のデータパターン（`全体 N` のスペース、`着地後N`、`※N`、combo_scaling JSON キー、category enum 分布）を裏取りした上での分岐実装で、合成データと実データ代表 code を併用したテストが堅実。
- Plan Mode 7 項目の確定結果・seed 延期判断・critical_art 定数補完・既知制約を progress-log に明快に記録しており、レビュー・後続引継ぎが容易。
- seed 破壊的クリアが既存テスト 185 箇所を破壊する問題を実装前に発見し、独断せず開発者確定で M12-02 延期とした判断（CLAUDE.md §9 準拠）。
- `total` の曖昧 recovery を NULL + 要確認に留め、誤値を黙って入れない設計思想の厳守。

## 制約事項

- 本レビューはコード上で判定可能な範囲のみ対象。実際の動作確認・`make e2e` の実走・パフォーマンス・実機テストは別途実施が必要。
- フロント component テスト（`ImportMovesPage.test.tsx`）・E2E（`import-moves.spec.ts`）の通過は progress-log の自己申告に基づき内容確認は限定的（テスト存在は diff stat で確認済み）。
- 指摘 1 の NUL バイトにより、当該ファイルは git 差分でなく Read ツールでの直接読取により確認した。
</content>
</invoke>
