# M7-03 レビュー報告書

## 総評

R-3 解消（AddComboToCompareModal へのキャラクターフィルタ追加）と既存固定幅 2 件（候補 B）の対応は概ね正しく実装されている。CharacterSelector が内部で `useCharacters` を呼ぶ設計を正しく認識し、親で重複呼び出しせずシンプルに実装したのは適切。テストも 4 ケース追加され 426 件全 PASS を確認している。

一方、M7-02 で正式化された Dialog scroll 制約パターン（architecture-patterns §7）からの逸脱が確認された。また Plan Mode 質問書ファイル方式の実施証跡（`m7-03-plan-mode-questions.md` 相当のファイル）が見当たらず、指示書 §3.4.10 で明示禁止された CLI ウィザード逐次方式が採用されたかもしれない疑義がある。完了報告に `pnpm build` / `go test ./...` の実行記録が欠落している点も軽微だが記録上の不備。

## 設計準拠性レビュー結果

### §1 ファイル一覧 ○

| 観点 | 判定 | 備考 |
|------|------|------|
| 新規ファイル作成なし | ◎ | 指示書 §2.1 通り |
| 修正ファイル 3 件（AddComboToCompareModal.tsx / AddComboToCompareModal.test.tsx / CompareTargetList.tsx） | ◎ | 指示書 §2.2 通り |
| バックエンド変更なし | ◎ | 確認 |
| 設計書本体・補足資料変更なし | ◎ | 確認 |
| 新規 CHANGE 通知書起票なし | ◎ | 確認 |
| 依存追加なし | ◎ | package.json 変更なし |
| INITIAL_CHARACTER_ID 定数温存 | ◎ | `web/src/lib/constants.ts:17` に存在確認 |
| CharacterSelector 本体変更なし | ◎ | `web/src/features/mycombo/components/CharacterSelector.tsx` 未変更 |
| useCharacters フック変更なし | ◎ | 未変更 |
| ColumnVisibilityMenu.tsx の `min-w-[160px]` = 候補 D 現状維持 | ◎ | `ColumnVisibilityMenu.tsx:45` で確認 |

スコープ外への変更（本格スマホ UI / `lg:` / `xl:` / `2xl:` ブレークポイント新規導入 / テーブル系 `overflow-x-auto` 廃止 / M7-01 / M7-02 確立物）なし。

### §2 着手前確認結果 △

完了報告（progress-log.md §M7-03 完了報告）に Plan Mode 確定事項 Q1〜Q5 が記録されている。ただし **指示書 §3.4.10 が必須とした「質問書ファイル方式」の証跡（`m7-03-plan-mode-questions.md` 相当ファイル）が見当たらない**。静的確認の範囲では CLI ウィザード逐次方式との区別ができないため「△」とする（詳細は指摘事項参照）。

対応表 A・B・C に相当する情報は完了報告に含まれている（A: R-3 実装内容、B: R-2 解消済み確認、C: 固定幅 3 件対応表）。

### §3 R-3 解消の妥当性 ○

| 観点 | 判定 | 備考 |
|------|------|------|
| CharacterSelector の import と使用 | ◎ | `AddComboToCompareModal.tsx:12` |
| useState 初期値 INITIAL_CHARACTER_ID | ◎ | `AddComboToCompareModal.tsx:31` |
| useCombos の characterId を state 連動 | ◎ | `AddComboToCompareModal.tsx:32-34` |
| キャラセレクタ UI（モーダル上部 + ラベル付き） | ◎ | `AddComboToCompareModal.tsx:48-54`、必須項目 1 確定通り |
| ローディング表示（isLoading 分岐） | ◎ | `AddComboToCompareModal.tsx:57-59`、既存 TanStack Query UX 踏襲 |
| Props 契約維持（open / currentIds / onAdd / onOpenChange） | ◎ | `AddComboToCompareModal.tsx:17-22` |
| Dialog scroll 制約パターン | △ | 下記「Dialog scroll パターン逸脱」参照 |
| useCharacters の親コンポーネントでの呼び出し省略 | ◎ | CharacterSelector が内部で呼ぶため不要 → シンプル実装 |

**Dialog scroll パターン逸脱の詳細**:
- M7-02 確立パターン（architecture-patterns v1.0.9 §7.5）: 内部リスト要素に `max-h-[60vh] overflow-y-auto`、DialogContent デフォルトに `max-h-[85vh] overflow-y-auto` fallback
- 実装: `DialogContent className="max-w-lg max-h-[70vh] flex flex-col"` + 内部 div `flex-1 overflow-y-auto`
- 逸脱点 ①: 内部リストではなく DialogContent に `max-h` を付与（パターン §7.5 候補 c ではなく候補 b 系）
- 逸脱点 ②: `max-h` の値が 60vh ではなく 70vh（チェックリスト §1.2.A の「`max-h-[60vh] overflow-y-auto` 維持」未遵守）
- 逸脱点 ③: `flex flex-col` が DialogContent 既定の `grid` を上書き（twMerge で解決されるが M7-02 fallback の `overflow-y-auto` が DialogContent レベルに残存するため二重スクロール領域が生じる可能性）
- 機能的には動作するが、プロジェクト内パターン統一の観点で不整合

### §4 既存固定幅 3 件対応の妥当性 ◎

| # | 対象 | 変更前 | 変更後 | 採用候補 | 判定 |
|---|------|--------|--------|---------|------|
| 1 | CompareTargetList.tsx:50 | `max-w-[200px]` | `sm:max-w-[200px]` | (B) | ◎ |
| 2 | AddComboToCompareModal.tsx:101 | `max-w-[200px]` | `sm:max-w-[200px]` | (B) | ◎ |
| 3 | ColumnVisibilityMenu.tsx:45 | `min-w-[160px]` | 変更なし | (D) | ◎ |

ColumnVisibilityMenu は Dropdown/Popover 形式のため横スクロール影響ゼロ、現状維持の判断は適切。
CompareTargetList.tsx と AddComboToCompareModal.tsx ともに `truncate` と組み合わせた `sm:max-w-[200px]` = sm 以上でのみ幅制限 + 省略表示、スマホでは flex 親要素の制約内で折り返し可能。

### §5 R-2 解消済み確認の妥当性 ◎

完了報告に「M4-04 で既に解消済み、本 M7-03 で新規実装なし」が明記されており、コード変更が含まれていないことを確認。ComboDetailMetadata / CompareTable / ComboEditor のシミー + DR 有データ表示・編集が動作中（view 確認）。

### §6 テスト要件の充足 ○

| 観点 | 判定 | 備考 |
|------|------|------|
| 4 ケース追加 | ◎ | CharacterSelector 統合 describe 配下に 4 件 |
| 全件 PASS（426 テスト） | ◎ | 指定範囲内（423〜455 件） |
| `tsc --noEmit` 型エラーなし | ◎ | 完了報告に記録 |
| `pnpm build` 確認 | × | **完了報告に記録なし**（M7-02 では記録あり） |
| `go test ./...` 確認 | × | **完了報告に記録なし** |
| 他キャラのコンボ表示 assert | △ | クエリ params のみ確認、表示変化の assert なし（下記参照） |

### §7 構造的アンチパターン再発なし ◎

- §1.2（実コード確認の省略）: CharacterSelector の Props 実態を view 確認した上で実装、`useCharacters` 不要を正しく判断
- §1.6（整合確認漏れ）: 固定幅 3 件の個別判断がなされている
- M7-01 / M7-02 確立物への変更なし
- バックエンド変更なし

---

## 設計準拠性以外の指摘事項

### [1] Dialog scroll パターン（コーディング規約・アーキテクチャ）

`DialogContent` に `flex flex-col` を追加することで M7-02 で確立した `grid` ベースの DialogContent デフォルトレイアウトを変更している。`tailwind-merge` により `flex` が `grid` を上書きするが、デフォルトの `gap-4` は flex context でも機能するため動作上の問題は小さい。ただし他 Dialog（LinkExistingSetupModal 等）との一貫性が失われる。

### [2] テストの assert 粒度（テスト規約）

「他キャラに切替でそのキャラのコンボが表示される」に対応するテスト `"他キャラに切替で useCombos が新 characterId で呼ばれる"` は、クエリ引数の確認のみで画面表示の検証が含まれていない。`expect(screen.getAllByText(/236K/).length).toBeGreaterThan(0)` 等を追加すれば完全になる。

---

## 推奨修正（優先度別）

- **高（M7 完了前に修正必須）**:
  - なし（動作に影響する致命的問題は確認されず）

- **中（M7-04 着手と並行可）**:
  - **Dialog scroll パターン修正**: `DialogContent` から `max-h-[70vh] flex flex-col` を削除し、内部リスト div を `max-h-[60vh] overflow-y-auto` に変更する。CharacterSelector 追加によりリスト高さが相対的に減少するが、内部リスト `max-h-[60vh]` のままでも CharacterSelector 分（約 36px）だけ Dialog 全体が縮小するため、`max-h-[85vh]` fallback で十分に制御される。
    ```tsx
    // Before（現在）
    <DialogContent className="max-w-lg max-h-[70vh] flex flex-col">
    ...
    <div className="flex-1 overflow-y-auto">
    
    // After（推奨）
    <DialogContent className="max-w-lg">
    ...
    <div className="max-h-[60vh] overflow-y-auto">
    ```
  - **完了報告に `pnpm build` / `go test ./...` の実行結果を追記**: M7-03 完了報告のチェックリストに追記（バックエンド変更なしの念のため確認を含む）。

- **低（将来対応）**:
  - 「他キャラのコンボ表示」テストに `screen.getAllByText(/236K/)` 等のコンボ表示 assert を追加（M7-04 or M7-05 タイミング）。

---

## 良かった点

1. **CharacterSelector の Props 実態を正しく把握した実装**: 指示書 §4.1.1 の概形では `useCharacters()` を親で呼ぶパターンが示されていたが、view 確認で CharacterSelector が内部で `useCharacters` を呼ぶ設計を把握し、親で重複呼び出しせずシンプルに実装した。設計書概形の「または相当パス、§3.4.1 view 確認結果次第」という条件を正しく活用した。

2. **CharacterSelector モック理由の明記**: jsdom での Radix UI Select の pointer capture API 非対応という非自明な制約をコメントで記録（`AddComboToCompareModal.test.tsx:14-15`）。

3. **固定幅 3 件の個別判断**: ColumnVisibilityMenu.tsx の `min-w-[160px]` を「ポップオーバー形式で横スクロール影響ゼロ」と正しく分析し候補 D（現状維持）を選択。機械的に全件同一方針を適用しなかった。

4. **`INITIAL_CHARACTER_ID` 定数の温存**: 削除せず初期値として継続使用、将来の UX 改善（最後に選択したキャラの記憶等）への拡張性を維持。

5. **スコープ厳守**: 本格スマホ UI / `lg:` / `xl:` / `2xl:` ブレークポイント / バックエンド変更等、指示書 §2.3 の変更しないもの一覧を遵守。M7-01 / M7-02 確立物への変更なし。

---

## 制約事項

- 本レビューはコード上で判定可能な範囲のみ対象。実際の動作確認・パフォーマンス・実機テスト（スマホ実機でのスクロール動作確認等）は別途実施が必要。
- Plan Mode 質問書ファイル方式の実施確認については、ファイルが作成されなかったか否かの事実が確認できないため「不明」とする。Progress log に Q1〜Q5 の一括回答が記録されており設計担当の推奨と合致しているため、実害は軽微と判断する。
- E2E シナリオ実行は `m7-03-e2e-scenarios.md` で開発者が実施（本機械レビュー対象外）。

---

## レビュー結果サマリ

| セクション | 判定 | 主な所見 |
|-----------|------|----------|
| §1 ファイル一覧 | ✅ | スコープ外変更なし、指示書通りの修正 |
| §2 着手前確認結果 | ⚠️ | 質問書ファイル方式の証跡なし（静的確認範囲外） |
| §3 R-3 解消 | ⚠️ | 機能的には正常だが Dialog scroll パターン逸脱 |
| §4 既存固定幅 3 件対応 | ✅ | 個別判断が適切 |
| §5 R-2 解消済み確認 | ✅ | 新規実装なし、確認のみ |
| §6 テスト要件 | ⚠️ | 4 ケース追加・426 件 PASS、ただし build/go test 確認記録なし |
| §7 構造的アンチパターン | ✅ | 再発なし |

## 完了承認判定

⚠️ **条件付き承認**（M7-04 着手と並行して Dialog scroll パターン修正を推奨）

Dialog scroll パターンの逸脱は機能的には問題ないため M7-04 着手ブロッカーにはならないが、M7-02 で正式化されたパターンとの不整合を残したまま次マイルストーンへ進むと、他 Dialog との設計不統一が積み重なるリスクがある。M7-04 初期に修正することを強く推奨する。

---

*レビュー実施日: 2026-06-01*
