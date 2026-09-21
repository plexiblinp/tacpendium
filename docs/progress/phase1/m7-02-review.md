# M7-02 レビュー報告書

## 総評

本プロジェクト最大規模の指示書（M7-02 v1.0.0）に対する実装は、バックエンド List API 拡張（N+1 回避設計）、ロジックフック分離 D-1〜D-4、Toast の sonner 一括移行、ComboDetailMetadata Q10 変更、shadcn/ui 追加コンポーネント導入、自作ラッパー 9 件移行、SetupTreeRow 本実装、ブラウザセッション保持など広範なスコープを概ね達成している。スコープ外への変更（設計書本体・補足資料・M7-01 確立物）は一切なく、温存方針（Q15 確定）も正確に遵守されている。しかし、指示書 §5.1.1 で明示的に要求された新設ロジックフック 4 件 + useSessionStorage + SetupTreeRow の単体テストが未作成であり、テスト数が M7-01 時点の 390 件から増加していない点が最大の課題。また `sonner.tsx` の `next-themes` 依存混入、C-4 フォールバック統一の不完全さ、SetupTreeRow の native HTML 使用も改善が必要。

## 設計準拠性レビュー結果

| # | 観点 | 評価 | 詳細 |
|---|------|------|------|
| 1 | ファイル一覧（§2.1/§2.2/§2.3/§2.4） | ○ | shadcn/ui 追加 9 件 + ロジックフック 4 件 + useSessionStorage 新設完了。C-2 は (β) 現状維持で useStepConverter 不要。button.tsx は M7-01 既導入のためスキップ（妥当） |
| 2 | 着手前確認結果（§3.4） | ○ | 対応表 6 表 + Plan Mode 必須項目 10 件の確定が進捗ログに記録済み。質問書ファイル方式の実施は確認 |
| 3 | shadcn/ui 追加コンポーネント導入（§4.1） | △ | 9 件導入完了・ビルド PASS だが、`sonner.tsx` が `next-themes` に依存。本プロジェクト（Vite + React）には不要な依存 |
| 4 | 自作ラッパー 9 件移行（§4.2） | ○ | Form/Field 3 + Badge/Display 2 + Table/List 4 の移行完了。native `<select>` の Radix Select 非置換は合理的判断（Radix Select の空文字列制約） |
| 5 | Modal 内要素の shadcn/ui 化（§4.3） | ◎ | TagFormDialog の react-hook-form + zod + shadcn/ui Form 統合が高品質 |
| 6 | Toast 移行（§4.4） | ◎ | M4-03/M5-01 由来全件の sonner 一括移行完了。topMessage 残存なし（テスト内参照のみ） |
| 7 | 分離パターン逸脱 4 件解消（§4.5） | ◎ | D-1〜D-4 すべて architecture-patterns §1 準拠で分離完了。呼出元修正も適切 |
| 8 | C-2/C-3/C-4 解消（§4.6） | △ | C-2: (β) 現状維持（妥当）。C-3: (γ) callback 委譲統一完了。C-4: 対象 9 ファイルのうちセットプレイ関連は統一されたが、combo レベルの defaultRecipe フォールバック（ComboTableRow / CompareTable / AddComboToCompareModal）が `"-"` のまま残存 |
| 9 | 指摘 6 軸 SetupTreeRow + List API（§4.7） | ○ | バックエンド 2 クエリ方式の N+1 回避が適切。SetupTreeRow 本実装・展開アイコン条件表示・sessionStorage 保持が完了。ただし SetupTreeRow が native `<tr>`/`<td>` を使用（shadcn/ui Table 非使用） |
| 10 | ComboDetailMetadata 表示項目変更（§4.8） | ◎ | 表示フィールド・i18n キー値の変更が正確。温存対象（消費量フィールド/カラム/型定義）すべて保持 |
| 11 | 伝達 1/伝達 2 対応（§4.9/§4.10） | ○ | 伝達 1: (θ) 不採用継続。伝達 2: (c) + (a) 二段構え適用。ただし AddComboToCompareModal / KnockdownAdvantageChangeModal への (c) 個別適用は未実施（(a) fallback でカバー） |
| 12 | テスト要件（§5） | × | 指示書 §5.1.1 で明示的に要求された新規テスト（ロジックフック 4 件 + useSessionStorage + SetupTreeRow）が未作成。テスト数 390 件は M7-01 時点と同数で変化なし。指示書想定 420〜450 件に対して 30〜50 件分の不足 |
| 13 | スコープ外への変更なし（§2.3） | ◎ | 設計書本体・補足資料・M7-01 確立物への変更一切なし。新規 CHANGE 通知書起票なし |
| 14 | 構造的アンチパターン再発なし | ◎ | retrospective-log §1 の 6 パターンすべて非該当。対応表 6 表完全埋め + Plan Mode 10 件確定を遵守 |

## 設計準拠性以外の指摘事項

### [Major] §4.1: `next-themes` 依存の不要な混入

該当ファイル: `web/src/components/ui/sonner.tsx:8`, `web/package.json:34`
事実: `sonner.tsx` が `import { useTheme } from "next-themes"` を使用。`next-themes` が `package.json` に追加されている。
判定根拠: CLAUDE.md §6「新規依存追加は必ず開発者に提案してから進める」、指示書 §3.4.10 必須項目 1 の承認対象に `next-themes` は含まれていない。本プロジェクトは Vite + React であり `next-themes` は Next.js 向けテーマ管理。`ThemeProvider` 未配置のため `useTheme()` は常にデフォルト値を返す。
修正案: `sonner.tsx` から `next-themes` の import を除去し、`theme` 固定値または CSS variables ベースに変更。`pnpm remove next-themes` で依存削除。

### [Major] §5.1.1: 新設ロジックフック等の単体テスト未作成

該当ファイル: 以下のテストファイルが存在しない
- `web/src/features/setup/hooks/useLinkExistingSetupForm.test.ts`
- `web/src/features/setup/hooks/useSetupAccordionActions.test.ts`
- `web/src/features/tag/hooks/useTagSelectorForm.test.ts`
- `web/src/features/tag/hooks/useTagFormDialog.test.ts`
- `web/src/hooks/useSessionStorage.test.ts`
- `web/src/features/combo/components/SetupTreeRow.test.tsx`

事実: 指示書 §2.1「新規テスト」+ §5.1.1「新規追加」で 6 カテゴリのテスト新設を要求。git diff 上テストファイルの新規作成なし。テスト総数 390 件は M7-01 完了時点と同数。
判定根拠: 指示書 §5.1.1「新設ロジックフック 4 件のテスト」「ブラウザセッション保持フックのテスト」「SetupTreeRow 本実装テスト」を明示的に要求。チェックリスト §1.1「上記 4 ロジックフック + C-2 共通フック + useSessionStorage 各の単体テストが新設されている」
修正案: 6 件のテストファイルを新設し、少なくとも正常系 + 主要異常系をカバーする。

### [Minor] §4.7.2: SetupTreeRow が native HTML 要素を使用

該当ファイル: `web/src/features/combo/components/SetupTreeRow.tsx:24,25`
事実: `<tr className="bg-slate-50">` / `<td colSpan={colSpan}>` を使用。指示書 §4.7.2 サンプルコードは `<TableRow>` / `<TableCell>` を使用。
判定根拠: 指示書 §4.2.3 共通方針「shadcn/ui `Table` コンポーネントで再構築」。他の Table 系コンポーネント（ComboTable, ComboTableRow, CompareTable, TrashList, TagListTable）はすべて shadcn/ui Table に移行済み。
修正案: `<tr>` → `<TableRow>`、`<td>` → `<TableCell>` に置換し、`@/components/ui/table` から import。

### [Minor] §4.6.3: C-4 フォールバック文字列の不完全な統一

該当ファイル:
- `web/src/features/combo/components/ComboTableRow.tsx:53` — `combo.defaultRecipe || "-"`
- `web/src/features/combo/components/CompareTable.tsx:204` — `c.defaultRecipe || "-"`
- `web/src/features/combo/components/AddComboToCompareModal.tsx:92` — `combo.defaultRecipe || "-"`

事実: 指示書 §4.6.3 で「パターン 2 → 既存維持: ...ComboTableRow / CompareTable / ...HomePage(5 箇所、フォールバック文字列を「(レシピなし)」に統一)」と明記。これらのファイルのフォールバックが `"-"` のまま残存。
判定根拠: 指示書 §4.6.3 の明示的な統一指定。ただし進捗ログには「HomePage は除外」と記載されており、Plan Mode で開発者と協議の上での判断の可能性がある。ComboTableRow / CompareTable / AddComboToCompareModal の `"-"` 残存は記載なし。
修正案: これらのファイルのフォールバック文字列を `"（レシピなし）"` に変更するか、combo.defaultRecipe は setup.defaultRecipe と文脈が異なるため `"-"` 維持が妥当であるという判断根拠を明記する。

### [Minor] §4.10.1: Dialog scroll (c) の個別適用漏れ

該当ファイル:
- `web/src/features/combo/components/AddComboToCompareModal.tsx` — 独自方式 `max-h-[70vh] flex flex-col` で代替
- `web/src/features/combo/components/KnockdownAdvantageChangeModal.tsx` — `max-h-[60vh]` 未適用

事実: 指示書 §4.10.1 で「対象 Dialog: ...AddComboToCompareModal / ...KnockdownAdvantageChangeModal(individual モード)」と明記。
判定根拠: 候補 (a) fallback（`dialog.tsx` の `max-h-[85vh] overflow-y-auto`）が全 Dialog に適用済みのため、実質的なビューポートはみ出しは発生しない。二段構えの主目的は達成。
修正案: 厳密な準拠のため `max-h-[60vh] overflow-y-auto` をリスト要素に追加。ただし (a) fallback でカバーされているため低優先度。

## 推奨修正（優先度別）

- 高（M7 完了前に修正必須）:
  1. **新設ロジックフック 4 件 + useSessionStorage + SetupTreeRow の単体テスト作成**（指示書 §5.1.1 明示要求、テスト不足は重大欠陥に該当）
  2. **`sonner.tsx` から `next-themes` 依存を除去**（不要な依存の混入、CLAUDE.md §6 ポリシー違反）

- 中（M8 着手と並行可）:
  3. **SetupTreeRow の native HTML を shadcn/ui Table コンポーネントに置換**（統一性の問題、M7-03 レスポンシブ仕上げ時に合わせて対応可）
  4. **C-4 フォールバック文字列の統一判断の明確化**（combo.defaultRecipe vs setup.defaultRecipe の文脈差異を進捗ログに明記するか、統一を実施）

- 低（将来対応）:
  5. **AddComboToCompareModal / KnockdownAdvantageChangeModal への Dialog scroll (c) 個別適用**（(a) fallback でカバー済み、次回 Dialog 変更時に合わせて対応）
  6. **native `<select>` の shadcn/ui Select 置換の再検討**（Radix Select の空文字列制約の回避策が確立された時点で検討、M7-03 以降）

## 良かった点

1. **バックエンド List API 拡張の品質**: repository → service → handler の 3 層で適切に分離された 2 クエリ方式の N+1 回避設計。`ListSetupsByComboIDs` の IN 句バッチ取得 + アプリ側結合は SQLite に適した実装。
2. **ロジックフック分離 D-1〜D-4 の質**: 各フックが明確な責務を持ち、コンポーネントを presentation-only に変換。特に `useTagFormDialog.ts` の react-hook-form + zodResolver 統合は本プロジェクトの新パターンとして完成度が高い。
3. **スコープ管理の厳格さ**: 広範なスコープ（系統 A 後半 + C-2/C-3/C-4 + 分離パターン + List API + Q10 + Toast + 伝達 1/2）にもかかわらず、設計書本体・補足資料・M7-01 確立物への変更が一切ない。温存対象の正確な保持。
4. **Toast 移行の完全性**: `topMessage` / `setMessage` の完全除去、sonner API への一括移行が 4 ファイルで漏れなく完了。
5. **ComboDetailMetadata Q10 対応の正確さ**: 表示フィールド変更と温存対象の区別が明確。`driveGaugeConsumedTotal` / `saGaugeConsumedTotal` のフロント型定義・バックエンドカラム・API フィールドが正しく温存。
6. **Plan Mode 10 項目の適切な判断**: C-2 で (β) 現状維持を選択したことは、ステップ変換ロジックの共通化よりも実装安定性を優先した合理的判断。
7. **`useSessionStorage` フックの堅実な実装**: try-catch による error handling、`useState` + `useCallback` の適切な構成、sessionStorage（localStorage ではない）の正しい選択。

## 制約事項
- 本レビューはコード上で判定可能な範囲のみ対象。実際の動作確認・パフォーマンス・実機テストは別途実施が必要。
- Plan Mode 質問書ファイルの内容自体は本レビューでは未確認（進捗ログの記録から確定事項を推定）。
