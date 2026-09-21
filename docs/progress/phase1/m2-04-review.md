# M2-04 レビュー報告書

## 総評

M2-04 の実装は全体的に堅実で、指示書の意図を正確に理解した実装がなされている。重大な問題は発見されず、M2 全体の完了判定に際して重大な障壁はない。

6件の持ち越し課題はすべて機能として実装されており、progress-log.md の更新も指示書通りの形式で完成している。主な懸念はテストカバレッジに 3 件の欠落があることで、これらは M3 着手前に補完することを推奨する。

設計書 (SUPP-001 §3.3.4) に沿った実装がなされており、後方互換性も適切に確保されている。M2 完了を承認できる品質と判断する。

---

## 設計準拠性レビュー結果

### 1.1 modifiers.notes 表示の設計書整合性 (SUPP-001 §3.3.4 との照合)

`internal/service/notation/resolver.go` — `applyFlags` 関数:

- ◎ **括弧付きインライン形式**: `(notes内容)` で出力に組み込まれている
- ◎ **notes が `( )` で囲まれている**: `result += " (" + mods.Notes + ")"` で実装
- ◎ **flags の `{ }` 処理と区別**: flags は `flagText` マップ経由で `{text}` 形式、notes は `(text)` 形式
- ◎ **flags が先・notes が後の順序**: flags 処理ブロック → notes 処理ブロックの順で実装
- ◎ **notes が空文字列または欠落時は出力に含まれない**: 早期リターン条件 `len(mods.Flags) == 0 && mods.Notes == ""` で後方互換を確保
- ◎ **エスケープ処理なし**: そのまま出力 (指示書 §4.1.3 通り)

注記: 実装は notes の前にスペースを挿入する (`" (" + notes + ")"`)。指示書 §4.1.3 のテーブル例では `立ち弱P(目押し1F)` (スペースなし) だが、SUPP-001 §3.3.4 の例は `立ち中P (目押し1F)` (スペースあり) であり一次情報源に準拠している。チェックリスト §9 に「軽微な問題」として明示済みのためブロッカーではない。

### 1.2 resolver.go 修正範囲の整合性

- ◎ **resolveRecipe / RecomputeComboCache 等の上位関数は変更なし**
- ◎ **flags 処理 (M1-04 §4.2.1 実装済み) が変更されていない**: `flagText` マップ・処理ロジックともに維持
- ◎ **フォールバック処理が変更されていない**: `resolveMoveStep` の 4 段階フォールバック維持
- ◎ **連結子 `" > "` が変更されていない**: `connector` 定数維持
- △ **修正箇所が `resolveStep` ではなく `applyFlags` である**: 指示書 §4.1.2 は `resolveStep` の修正として記述しているが、実際の修正は `resolveStep` が呼ぶヘルパー `applyFlags` に行われている。意図(上位関数を変更しない)は達成されており機能的に問題はないが、指示書の記述とは異なる実装箇所。また `applyFlags` という関数名が notes も処理するようになった実態を反映していない(後述)。

### 1.3 ComboDetailRecipe.tsx の責務範囲

- ◎ **変更されていない**: 指示書 §2.2 の「原則変更不要」方針通り
- ◎ **テキスト経由取得パターンが維持されている**: §3.4.2 確認結果でテキスト取得が確認済み
- ◎ **resolver.go 修正で自動的に notes が表示される構造**: 設計意図に完全合致

### 1.4 recipe_cache への影響整合性

- ◎ **resolveStep (applyFlags) 修正で RecomputeComboCache 出力にも notes が反映**: 指示書 §4.1.4 通り
- ◎ **既存 recipe_cache の一括再計算は行われていない**
- ◎ **notes が空の既存コンボの recipe_cache は変更されない**: 後方互換確保済み

### 1.5 RecipeBuilder の draftNotes 50文字超警告整合性

`web/src/features/combo/components/RecipeBuilder.tsx`:

- ◎ **draftNotes 入力欄に 50文字超警告クラスが付与されている**: `NOTES_MAX_LENGTH = 50` → `notesOver = draftNotes.length > NOTES_MAX_LENGTH`
- ◎ **クラス名が ModifiersEditor と一致**: `border-red-400 bg-red-50 text-red-900` で両ファイルが同一 (ModifiersEditor.tsx:131 と一致)
- ◎ **50文字以下は通常クラス、50文字超は警告クラス**: 条件分岐が正確
- ◎ **ModifiersEditor 本体ロジックが変更されていない**

### 1.6 createPortal 化整合性

`PermanentDeleteConfirm.tsx` / `PutConfirmDialog.tsx`:

- ◎ **両モーダルが `createPortal` で `document.body` 直下にレンダリングされている**
- ◎ **表示・キャンセル・確認の挙動は変更なし**
- △ **PutConfirmDialog に ESC キーハンドラがない**: PermanentDeleteConfirm は `useEffect` で ESC ハンドリングを実装しているが、PutConfirmDialog にはない。指示書 §4.3.1 の「挙動は変更されていない」という観点では M2-02 での実装がそのままのため M2-04 の責任ではないが、E2E シナリオ C 手順 4「ESC キーでキャンセル動作」が PutConfirmDialog では動作しない可能性がある。
- △ **PutConfirmDialog の `role="dialog"` がオーバーレイ div に付与されている**: `PermanentDeleteConfirm` では内側のモーダルコンテナに `role="dialog"` があるが、`PutConfirmDialog` では外側のオーバーレイ div (`.fixed.inset-0`) に付いている。セマンティクス的に不適切だが M2-02 からの継続問題のため M2-04 の範囲外。

### 1.7 TrashListRow の修正整合性

#### 二重発火対策 (案A採用)

- ◎ **始動状況セルの `<td>` に `onClick={(e) => e.stopPropagation()}` が追加されている**: `:83` 行
- ◎ **`<Link>` を維持して右クリック→新規タブのアクセシビリティを確保**
- ◎ **チェックボックスセル・アクションセルで同パターンが既に使用されており統一性あり**
- ◎ **製造担当の判断根拠が progress-log.md に明示されている**

#### 個別行のエラー表示

- ◎ **`useState` で `rowError` を管理し `mutateAsync` の throw を捕捉**
- ◎ **`role="alert"` 付きで行内表示されている**
- ◎ **トーストライブラリは導入されていない**
- △ **エラーメッセージ形式が指示書 §4.4.2 の例と異なる**: 指示書は `復元に失敗しました: {error.message}` 形式だが実装は `err.message` のみ (例: `"network error"`)。テストはこの形式で通過しており機能的な問題はないが、ユーザーへのメッセージがエラー内容のみで「復元に失敗しました」の文脈が失われる。

### 1.8 progress-log.md 更新整合性

- ◎ **notes 未実装項目に「※M2-04 で解消済み (2026-05-09)」が見出しレベルで明示されている**
- ◎ **M2-04 完了報告セクションが追加されている (M2-02 / M2-03 と同形式)**
- ◎ **「M2-04 完了時点の既知の制限事項」空セクションは作成されていない**
- ◎ **`m2-04-known-limitations.md` 等の独立ファイルが新規作成されていない**

### 1.9 持ち越し課題の継承記録

- ◎ **M2-04 で解消された4件** (M2-01 連絡事項1、M2-03 連絡事項1〜3) が解消済みで記録
- ◎ **M3 で対応するもの** (M2-02 連絡事項1 = useCharacters フック) の記載が維持されている
- ◎ **M7 で対応するもの** (M2-02 連絡事項2・3 の計2件) の記載が維持されている
- ◎ **M3 以降に持ち越すもの** (M2-01 連絡事項2 = console.warn テスト) の記載が維持されている

---

## 設計準拠性以外の指摘事項

### コード品質

- △ **`applyFlags` 関数名が実態を反映していない**: notes も処理するようになった後も関数名が `applyFlags` のままであり、将来の読者に誤解を与える可能性がある。`applyModifierSuffixes` や `applyModifiers` 等への改名が望ましい (軽微、将来対応可)。
- ○ **`NOTES_MAX_LENGTH` 定数化**: RecipeBuilder と ModifiersEditor の両ファイルで同名の定数として管理されており規約に準拠。ただし将来変更時に両ファイルの更新が必要という課題は残る (M3 以降の共通化で対応可)。

### TypeScript 型安全性

- ○ `any` 型の新規追加なし (エラーキャッチは `err: unknown` + `instanceof Error` で型安全)
- ○ `pnpm tsc --noEmit` エラーなし (progress-log.md の自己テスト結果より)

### React の品質

- ○ `key` prop 警告なし
- ○ hooks のルール違反なし
- ◎ createPortal 化により M2-03 で発生していた `<tbody>` 不正ネスト警告が解消済み (指示書 §7.2)

### CLAUDE.md 禁止事項

- ◎ `localStorage` 使用なし
- ◎ git 操作なし
- ◎ 外部ライブラリ追加なし
- ◎ `console.log` を本番コードに残していない
- ◎ 指示書 §2.2 の修正対象ファイル以外の変更なし

---

## 推奨修正 (優先度別)

- **高 (M2 完了前に修正必須)**: なし

- **中 (M3 着手と並行可)**:
  1. `web/src/features/combo/components/TrashListRow.test.tsx` に始動状況セルクリックの二重発火テストを追加 (指示書 §5.1.2 必須要件、`navigate` モックで呼出回数を検証)
  2. `web/src/features/combo/components/TrashListRow.test.tsx` に完全削除成功時のエラー非表示テストを追加
  3. `internal/service/notation/resolver_test.go` に明示的な notes 空文字列テストケースを追加 (`Modifiers{Notes: ""}` → 出力に括弧が含まれないことを検証)

- **低 (将来対応)**:
  4. `applyFlags` 関数名の見直し (`applyModifiers` 等へのリネーム)
  5. `PutConfirmDialog` への ESC キーハンドラ追加 (M3 以降の UI 改善時に `PermanentDeleteConfirm` と動作を揃える)
  6. `PutConfirmDialog` の `role="dialog"` 位置をオーバーレイ div から内部モーダルコンテナに移動

---

## 良かった点

1. **修正範囲が最小限に限定されている**: 上位関数 (`resolveRecipe`/`RecomputeComboCache`) を変更せず、ヘルパー `applyFlags` のみを拡張することで後方互換性と設計意図を両立。
2. **後方互換性の確保**: `mods == nil || (len(mods.Flags) == 0 && mods.Notes == "")` の早期リターンにより、既存コンボの recipe_cache が意図せず変化しない構造になっている。
3. **案A選択の明示的な記録**: TrashListRow の二重発火対策で stopPropagation を選択した理由 (既存のチェックボックスセル・アクションセルとパターン統一、アクセシビリティ維持) が progress-log.md に記録されており将来の変更時の参考になる。
4. **createPortal の両モーダルへの統一適用**: 将来 M3 以降で新規モーダルを実装する際の参考パターンとして整備されており、設計意図通りの「共通モーダルパターン整備」が達成されている。
5. **progress-log.md の充実度**: 持ち越し課題の消化状況表、設計判断の根拠、§3.4 Plan Mode 確認結果が体系的に記録されており、M3 着手時の引き継ぎ情報として高い価値を持つ。
6. **ModifiersEditor と RecipeBuilder の警告クラスが完全一致**: `border-red-400 bg-red-50 text-red-900` が両ファイルで揃っており、視覚的一貫性を確保。

---

## 制約事項

- 本レビューはコード上で判定可能な範囲のみを対象とする。実際の動作確認 (E2E シナリオ A〜F のブラウザ実行、DOM 検証ツールによる createPortal 確認) は開発者による手動実施が必要。
- `go test ./...` および `pnpm test` の通過は progress-log.md 自己テスト結果から確認したが、レビュー環境での直接実行は行っていない。

---

## M2 全体の完了判定への所感

**M2-04 を含む M2 全体の完了を承認する品質にある。**

M2-01〜M2-04 を通じて、実装の一貫性・設計意図への整合が高い水準で維持されている。特に M2-04 は「統合・仕上げ」という性質上、6 件の持ち越し課題を漏れなく消化しつつ過去マイルストーンの既存挙動を破壊しないという難易度の高いタスクであったが、問題なく達成されている。

M3 への持ち越し課題は progress-log.md に整理されており、M3 着手時に「何が残っているか」が明確に読み取れる構造になっている。M2 期間で確立された以下のパターンが M3 以降の参考として有効:

- createPortal によるモーダル実装パターン
- useState による行内エラー表示パターン
- `stopPropagation` によるテーブル行クリックの制御パターン

改善余地として、テストカバレッジの一部欠落 (始動状況セル二重発火テスト) が M3 着手と並行して補完されることを期待する。設計担当へ引き継ぐ CHANGE 起票が必要な設計変更は本 M2 期間中に発生していない。
