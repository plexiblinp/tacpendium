# M10-01 レビュー報告書

| 項目 | 内容 |
|------|------|
| 対象 | M10-01（ComboEditor キャラクター選択化＝A-1。フロント完結） |
| レビュー日 | 2026-06-18 |
| レビュー担当 | 品質レビュー担当 Claude |
| 対象コミット | `1dcfad0`（feat）/ `900561d`（test）/ `73e7bea`（docs v1.0.0）|
| 検証 | `tsc --noEmit` 通過（exit 0）/ Vitest 13 件通過（ComboEditor.test 10 + ComboEditorCharacterField.test 3）|

## 総評

指示書 v1.0.0（§3.5 Plan Mode 確定結果）の設計判断どおりに実装されており、設計準拠性は高い。`RYU_CHARACTER_ID` ハードコードの撤廃と `basic.characterId` への一本化、`ComboEditorCharacterField`（item1+item2）／`CharacterChangeConfirmDialog`（CHANGE-036）の新設、`CharacterSelector` の現位置 import（移設回避）まで確定事項に忠実。CHANGE-036 の3挙動（dirty 発火／破棄＝全体リセット／キャンセル＝revert）は制御コンポーネント方式で正しく成立しており、テストでも裏取りされている。バックエンドは無改変（diff はフロント + docs のみ）でフロント完結も満たす。重大な問題はなし。指摘は軽微・低優先のみ。

## 設計準拠性レビュー結果

### 1. 設計書本体との照合（チェックリスト §1）

| 項目 | 評価 | 所見 |
|------|------|------|
| 1.1 キャラ選択 UI（新規プルダウン5体 / 編集固定 / 情報バー / 流用） | ◎ | `ComboEditorCharacterField` が `mode==="edit"` で固定表示（「編集モードではキャラクターは変更できません」）、new/copy で `CharacterSelector` を表示。5体は `useCharacters`（queryKey `["characters",{gameId}]`）由来で独自再実装なし。情報バーは `useCharacterName` の icon+name 自作（`CharacterInfoBar` 非流用＝§3.5-3 確定どおり）。|
| 1.2 characterId 状態化 | ◎ | `RYU_CHARACTER_ID` 撤廃を確認（残存 grep ヒットは無関係なフィルタ test の `character_id=1` のみ）。`ComboEditorBasicFields` の固定 select 撤去。新規既定は `INITIAL_CHARACTER_ID`（=1, `@/lib/constants`）。編集/コピーは `initialBasic(initial)` 経由で `initial.characterId`。`buildCreatePayload` は `characterId: basic.characterId`。|
| 1.3 下流連動（moves / setup / 重複検知） | ◎ | `useMovesByCharacter(basic.characterId)` の結果を `RecipeBuilder` / `ComboEditorBasicFields` へ伝播。`autoStarterMoveId` は steps から再導出。`SetupRegistrationSection characterId={basic.characterId}`、`useCheckDuplicate` も `basic.characterId` 基準。|
| 1.4 切替の確認・リセット（CHANGE-036） | ◎ | dirty 時のみ `pendingCharacterId` セットでダイアログ発火、未入力は `applyCharacterChange` 即時切替。破棄＝`initialBasic(undefined)`＋新 characterId・steps/setups/linked/validation 全リセット。キャンセル＝`basic.characterId` 不変のため制御で revert。編集は selector 非表示でダイアログ到達不能、コピーは初期 dirty で必ず発火。CHANGE-036 §2/§3 と一致。|

### 2. API 整合性（§2）

◎ `git diff e55a548 HEAD` の変更はフロント（`web/src/...`）と指示書のみ。`internal/`・`migrations/` への変更ゼロ。`CreateRequest.characterId` 既存契約に乗せるだけで固定値上書きなし（§3.5-2 で service→repository 経路裏取り済みと記載、実 diff でも BE 無改変を確認）。

### 3. フロント動作仕様（§3）

◎ プルダウン選択 → 各子コンポーネント追従。確認ダイアログ3挙動を明示ラベル（「変更して入力を破棄」「キャンセル」）で実装。`situation` は未着手のまま（汎用入力維持）で custom_states 消費・キャラ別動的 UI の穴埋めなし（§4.11 既知制約遵守）。

### 4. テストの妥当性（§4）

○ §5.1 の4カテゴリ（表示分岐 / 切替4ケース / 送信 characterId / moves 再取得）をすべてケース化し 13 件通過。下記「指摘事項」の軽微点を除き妥当。

### 5. 設計意図との整合（§5）

◎ フロント完結・全体リセット採用・制御コンポーネント・situation M11 送り・スコープ ComboEditor 内部、すべて遵守。`ComboEditorPage.tsx` は `<ComboEditor mode initial />` のみで characterId を渡さず（§3.5「変更不要」どおり）、エントリポイント既定（M10-02 範囲）に未着手。

### 6. コード品質・規約（§6）／ 7. 非破壊性（§7）

◎ queryKey 規約整合、camelCase 統一、`tsc` 通過。`CharacterSelector` は mycombo から import のみで既存呼び出し元（mycombo）不変。編集固定の既存挙動維持。

## 設計準拠性以外の指摘事項

- `ComboEditorCharacterField` の情報バーとプルダウンは `justify-between` の**同一行（横並び）**配置。指示書 §4.1「情報バー … は item2 の**上**に表示」/ DES-005 §5.7（item1→item2 の順）に対し、上下ではなく左右配置になっている。視認上の機能差はなく §10「表示細部・スタイル差異」相当。
- CHANGE-036 通知書（`docs/change-notes/change-036-...md`）のステータスは「**ドラフト・承認待ち**」のままだが、DES-005 は既に「第31版（CHANGE-036反映）」で §5.7 に挙動追記済み。設計書本体は反映済みのため前提ゲートは満たすが、通知書のステータス行が陳腐化している（**設計担当側のドキュメント整合課題**。製造担当の責務外）。
- アバターの頭文字は `characterName.charAt(0)`（日本語名先頭1字、例「リュウ」→「リ」、名前未取得時「?」）。意図どおりだが英字イニシャルではない点は留意（cosmetic）。

## 推奨修正（優先度別）

- **高（M10 完了前に修正必須）**: なし。
- **中（M11 着手と並行可）**:
  - 「変更して入力を破棄」テスト（ComboEditor.test.tsx）は `recipe-steps-count` の 0 化のみ assert しており、§5.1 が要求する **setups / メタデータの初期化**まで検証していない。実装は `applyCharacterChange` で全リセットしているため挙動は正しいが、回帰防止の網が steps だけに偏る。setupsToCreate / linkedSetups / メタデータ（例: damage）初期化の assert 追加を推奨。
- **低（将来対応）**:
  - 情報バーとプルダウンの上下/左右配置を DES-005 の表示順に合わせるか検討（任意）。
  - CHANGE-036 通知書ステータスを「反映済み」へ更新（設計担当タスク）。

## 良かった点

- §3.5 Plan Mode 確定結果（characterId 供給源・Create 消費経路・state 機構・reset 配線・preset 連動）を実 view で裏取りした上で、想定（`config.defaults.character_id`）ではなく実体（`RYU_CHARACTER_ID` 定数）を正しく特定し撤廃。retrospective-digest §1 パターンA（症状レイヤ≠真因レイヤ）の回避を実践できている。
- 制御コンポーネントによる revert を「state を変えない＝自動で表示が戻る」という単純で堅牢な形で実装し、CHANGE-036 §6 が懸念した「表示と state の乖離」を構造的に排除している。
- `CharacterSelector` を移設せず現位置 import とする判断で、8 ファイル波及（mycombo 既存呼び出し元）を回避しスコープを厳守。
- 切替時に `validationResult` / `duplicateIssue` まで含めて全リセットしており、陳腐な検証結果が残る穴を塞いでいる。
- dirty 判定を「新規初期状態との JSON 差分（characterId 除外）+ steps/setups/linked の有無」で決定的に実装し、コピー＝初期 dirty も自然に成立。

## 制約事項

- 本レビューはコード上で判定可能な範囲のみ対象。§5.2 の手動 E2E（シナリオ A〜E）・実機での moves 連動・パフォーマンスは別途実施が必要（DoD では実機 E2E が完了の必須ゲート）。
- `tsc --noEmit` は通過したが、本プロジェクトの `pnpm run lint` は実体が `tsc --noEmit`（ESLint 実行スクリプト未設定）。ESLint ルール準拠は静的に未検証。
