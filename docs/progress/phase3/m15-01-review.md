# M15-01 レビュー報告書

対象指示書: `docs/instructions/phase3/M15-01-metadata-testid.md` v1.0.1
チェックリスト: `docs/instructions/phase3/reviews/M15-01-review-checklist.md` v1.0.1
レビュー対象コミット: `5275f5c test(M15-01): メタデータ入力に安定 test-id 付与 + 前提スモーク spec`
レビュー日: 2026-07-02 / レビュー担当: 品質レビュー担当 Claude

## 総評

本サブは純 FE・test-id 付与のみ・DES 非対象という指示書スコープを忠実に守った、非常にクリーンな変更である。`git diff HEAD~1` を確認したところ、`ComboEditorBasicFields.tsx` の変更は `data-testid` 属性の純加算 9 箇所のみで、value/onChange/ラベル/バリデーション/レイアウト・API 型定義に一切差分がない（非破壊性は機械的に確認できた）。命名は既存規約 `combo-editor-*`（`driveDamage` の既存 test-id `combo-editor-drive-damage` を実査で温存）に統一され、二重規約・二重付与は発生していない。対象スコープ（F12-4 の 11＋native select 4）は全数付与済み、`situation`・custom-state は据え置き（新規付与なし）でスコープ厳守。スモーク spec も seed 非依存 self-contained で既存 spec 併設方針に沿う。重大指摘（チェックリスト §9）はゼロ。完了承認可能と判断する。

## 設計準拠性レビュー結果

### §1.1 対象フィールドの網羅（v1.0.1 確定＝全メタデータ拡張）— ◎
必須 11＋native select 4 を全数確認した。
- damage: `combo-editor-damage`（L120）◎
- driveAvailableAtStart: `combo-editor-drive-available`（L211）◎
- saAvailableAtStart: `combo-editor-sa-available`（L223）◎
- knockdownAdvantage: `combo-editor-knockdown-advantage`（L248）◎
- memo: `combo-editor-memo`（Textarea, L342）◎
- 起き攻め6: `combo-editor-${f.key}`（L327, OKI_FIELDS 6 件を機械展開）◎
- native select 4: `combo-editor-position` / `-opponent-stance` / `-hit-type` / `-opponent-size`（L131/146/162/178）◎
- `driveDamage`: 既存 `combo-editor-drive-damage`（L237）を温存。diff に含まれず＝新規付与・二重付与なし ◎
- `situation`・custom-state: `situation` 入力は当コンポーネントに存在せず、custom-state の `combo-editor-custom-state-${code}`（L271）は diff 外の既存 test-id で今回は不変。据え置き遵守 ◎

### §1.1 付与先が操作可能なコントロール要素か — ◎
すべて操作可能な要素に付与されている。数値入力は `Input`（内部 `<input>`）、select は native `<select>`、memo は `Textarea`、oki は Radix `Checkbox`。`web/src/components/ui/checkbox.tsx` は `CheckboxPrimitive.Root` に `{...props}` を展開しており、`data-testid` が実 DOM（`button[role=checkbox]`）へ forward される。ラッパー div への付与はない。

### §1.2 命名規約の一貫性 — ○
- 現行 test-id 被覆を実査し、既存規約 `combo-editor-*`（driveDamage で確立）を採用。指示書 §4.1 の提案 `combo-meta-*` は §2.3 に従い不採用。既存規約優先・二重規約回避は適切 ◎
- new/edit/copy モード分岐で id を変えていない（`mode` に依存しない静的属性）◎
- 軽微な観察: 一般フィールドは kebab-case（`drive-available`）だが、起き攻め6 は `combo-editor-${f.key}` で camelCase 混在（例 `combo-editor-okiMeatyNeutralTechThrow`）。本タスク確定事項で「起き攻め6 は `combo-editor-${f.key}`」と明示承認済みのため準拠違反ではないが、命名の大小文字が 1 箇所だけ非対称である点は将来の統一余地として記録する（下記「低」）。

### §1.3 非破壊性（表示・挙動不変）— ◎
diff は data-testid 追加のみ。value/onChange/label/バリデーション/className/レイアウトに差分なし。oki トグルは既存の shadcn/ui `Checkbox` パターンを踏襲し自作再発明していない。

### §1.4 DES 直接編集の禁止 — ◎
DES-005 等の編集はない（変更は当該 tsx と新規 spec のみ、git status で確認）。

### §2 API・データ契約の不変 — ◎
`web/src/features/combo/types.ts` の `ComboSummary`/`ComboDetail`/`Combo`/`CreateComboRequest`/`UpdateMetadataRequest`/`CheckDuplicateRequest` に差分なし（コミットに含まれず）。DTO・送受信挙動は不変。

### §3 フロントエンド動作仕様（併設）— ◎
- test-id 付与後もフォーム動作は従来どおり（属性追加のみ）。
- 併設遵守: `combo-crud.spec.ts` は L22/37 で `getByPlaceholder("このコンボに関するメモ(任意)")` を使用し、当該 placeholder は diff で不変。既存 spec を getByTestId へ移行しておらず、新規 spec は純加算。既存 spec への干渉なし ◎

### §4.1 既存 E2E 非回帰 — ○（コード判定）
併設方式のため既存セレクタは不変で、機械的に非回帰が保証される。ただし `make e2e` の実走はレビュー範囲外（コード上は非回帰と判定）。

### §4.2 前提スモーク（seed 非依存）— ◎
`web/e2e/m15-01-metadata-testid.spec.ts` は `/combos/new` のフォーム DOM のみを対象とし、既存コンボ seed・保存/送信に依存しない self-contained。damage/drive/sa/knockdown の fill＋toHaveValue、memo の fill、native select 4 件の `selectOption({ index: 1 })`＋`not.toHaveValue("")`（表記変更に不変）、oki 6 件の click＋toBeChecked を検証しており、対象フィールド数分のセレクタ解決を網羅（計 15 操作）。永続 dev DB 残渣（ken 依存等）を新設していない。

### §5 設計意図との整合 — ◎
index/testid ベースで表記・レイアウト変更に強いセレクタとなっており、後続 M15 サブの回帰安全網として機能する。fe-e2e-throwaway-db 等の残渣根治をスコープに混入させていない。

### §6 コード品質・規約遵守 — ◎
曖昧語依存なし。oki は OKI_FIELDS の `f.key` 由来で規約準拠命名。ファイル配置（`web/e2e/` 直下・`m15-01-*.spec.ts`）は既存パターンに整合。

### §7 既存挙動の温存 — ◎（コード判定）
既存 combo 作成/編集フローの挙動不変。視覚/機能差分なし。

### §8 ドキュメント・進捗ログ — △（コードから判定不可）
完了報告（Plan Mode 実査結果・命名規約・付与一覧・テストケース数・fe-e2e 残渣スコープ外の明記）の有無は本レビューのコード判定範囲外。spec 冒頭コメントには方針・前提が明記されており良好だが、`docs/progress/` 側の完了報告への命名規約記載（後続サブが参照、code-facts 再生成で捕捉されないため §7.4/§8）を製造担当が別途行っているか確認されたい。

## 設計準拠性以外の指摘事項

- コーディング規約: `console.log`/デバッグ残骸なし、`eslint-disable` 濫用なし、マジックストリング散在なし（test-id はコンポーネント内一貫命名、oki は定数由来）。CLAUDE.md §4 TypeScript 規約に整合。
- セキュリティ: ブラウザストレージ・機密情報の取扱いなし。該当なし。
- ライブラリ: 新規依存追加なし。
- スモーク spec の前提（環境依存の観察）: 冒頭コメントどおり「ウィザード完了済み環境」を前提とする。ウィザード完了状態は既存 e2e スイート全体が共有する前提であり、指示書が問題視する「コンボ seed 残渣依存」とは別種（コンボ seed には非依存）。クリーン DB で単独実行すると `/wizard` へリダイレクトし得るが、これは既存スイートと同一の前提であり本サブ固有の退行ではない。将来の fe-e2e-throwaway-db 対応時に併せて整理される想定（スコープ外）。

## 推奨修正（優先度別）

- 高（M15完了前に修正必須）: なし。
- 中（M16着手と並行可）: なし。
- 低（将来対応）:
  1. 命名の大小文字統一余地: 起き攻め6 の `combo-editor-${f.key}`（camelCase）のみ他フィールド（kebab-case）と非対称。本タスクでは確定事項で明示承認済みのため現状維持で問題ないが、将来 test-id 命名を機械変換規則で完全統一する場合の候補として記録（後続サブでの opportunistic 置換余地）。
  2. 完了報告への命名規約明記の確認（§8・§7.4）: code-facts 再生成では捕捉されないため、`combo-editor-*` 規約と付与一覧・テストケース数を完了報告に残しているか製造担当に確認（コード判定外）。

## 良かった点

- 指示書の確定事項（既存規約優先・combo-meta- 不採用・11＋select4・据え置き）を正確に反映し、driveDamage の既存 test-id を実査で温存して二重規約/二重付与を完全に回避した点が秀逸。§2.3・digest §4「占有調査」の精神を体現している。
- 変更を data-testid 純加算に徹し、非破壊性が diff だけで機械的に検証可能なクリーンな粒度。
- スモーク spec が seed 非依存・非保存で、native select を index 指定＋`not.toHaveValue("")` として表記変更に不変にした設計は、後続 M15 サブの回帰安全網という設計意図に合致。
- spec 冒頭コメントに目的・前提・DB 前提を明記しており、意図の伝達が丁寧。

## 制約事項

- 本レビューはコード上で判定可能な範囲のみ対象。`make e2e` の実走・実ブラウザでの Radix Checkbox forward 挙動・パフォーマンス・実機テストは別途実施が必要。
- 完了報告書（`docs/progress/` 等）の内容充足（§8）はコードからは判定できないため、製造担当側での確認を要する。

---

## 取り込み結果（自動トリアージ）

`/implement_plan_full` Phase C（自動トリアージ）。レビュー報告に**重大（高）指摘は 0 件**のため、
「高指摘の不採用によるエスカレーション」は発生せず。各指摘の採否と理由は以下。

| # | 優先度 | 指摘 | 採否 | 理由 |
|---|--------|------|------|------|
| 1 | 低 | 起き攻め6 の `combo-editor-${f.key}`（camelCase）が他フィールド（kebab-case）と大小文字非対称 | **不採用** | 本タスク確定事項で「起き攻め6 は `combo-editor-${f.key}`」と明示承認済み。`f.key` を無変換で使うことで custom-state の `combo-editor-custom-state-${code}` と同じデータ駆動 interpolation 方式に揃い、kebab 変換を挟まない分セレクタの一意性・堅牢性が高い。機能・安定性に影響なく、変更はスコープ外の再命名リスクを生むため現状維持。将来の機械変換規則統一時の候補として報告書に記録済み。 |
| 2 | 低 | 完了報告への命名規約明記の確認（§7.4/§8。code-facts 再生成で捕捉されないため） | **採用** | コード変更不要。命名規約 `combo-editor-<field>`・付与フィールド一覧・テストケース数・既知の制約（fe-e2e 残渣根治はスコープ外）を製造担当の完了報告に明記して対応（本レビュー報告書＋チャット完了報告に記載済み）。 |

**取り込みによるコード修正: なし**（低#1 は仕様上の意図的選択、低#2 は文書対応）。重大・中の指摘ゼロのため追加コミットなし。

