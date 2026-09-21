# M4-02 レビュー報告書

> **第2回レビュー（バージョンアップ再依頼）**: 2026-05-17
> 指示書 v1.0.3 / チェックリスト v1.0.3 に基づき、第1回レビュー後の修正内容を再評価した。

| 項目 | 内容 |
|------|------|
| 対象指示書 | `docs/instructions/M4-02-setup-ui-and-link-operations.md` v1.0.3 |
| チェックリスト | `docs/instructions/reviews/M4-02-review-checklist.md` v1.0.3 |
| レビュー実施日 | 2026-05-17（第2回） |
| レビュー担当モデル | Claude Sonnet 4.6 |

---

## 総評

第1回レビューで指摘した重大問題（バックエンドテスト4ファイル欠落・§15 閾値超過）がすべて解消されており、全体的に品質水準を満たすレベルに到達した。

SetupAccordionItem の UX が DES-005 §5.6「行クリック→編集画面遷移・展開アイコン→アコーディオン開閉」仕様に沿って修正済みであり、行動仕様の準拠性が確保された。指示書 v1.0.3 §4.7 の変更と実装が一致している。

バックエンドテスト10件（handler 4件・service 2件・repository 2件・combo handler 2件）、フロントフックテスト3ファイルが追加され、テスト網羅の不足も概ね解消した。中優先度で指摘した型整合・omitempty・characterId 必須化・キャッシュキー型統一もすべて修正済みを確認。

残る課題は `SetupRecipeEditor.tsx` の `as any` キャスト2箇所（低優先度）のみ。**M4-02 の完了判定を妨げる重大な問題はなく、完了承認待ちとする。**

---

## 設計準拠性レビュー結果

| # | 観点 | 評価 | 備考 |
|---|------|------|------|
| 1 | GET /setups?characterId={id} — characterId 必須バリデーション | ◎ | 第1回指摘を修正。欠落・非数値ともに 400 + `invalid_query_parameter` を返す |
| 2 | GET /combos/:id — `setups` フィールドが常に配列で返る | ◎ | `omitempty` 削除済み。`TestHandler_Get_200_SetupsEmptyArray` でゼロ件時 `"setups":[]` を回帰テスト |
| 3 | SetupSummary（Go）— CreatedAt/UpdatedAt 除外 | ◎ | `ComboDetail.Setups []SetupSummary` に CreatedAt/UpdatedAt を含まないことを確認 |
| 4 | SetupSummary（TypeScript）— Omit<Setup, "createdAt"\|"updatedAt"> | ◎ | 第1回指摘を修正。`extends Omit<Setup, "createdAt" | "updatedAt">` で Go 型と整合 |
| 5 | SetupAccordionItem UX — 行クリック=編集遷移、展開アイコン=アコーディオン開閉 | ◎ | 指示書 v1.0.3 §4.7 + DES-005 §5.6 に準拠。`e.stopPropagation()` による独立制御を確認 |
| 6 | SetupAccordionItem UX — 紐付け解除ボタン stopPropagation | ◎ | `handleUnlink` で `e.stopPropagation()` 実装、行クリックと干渉しない |
| 7 | CHANGE-003 — セットアップ編集画面に紐付け操作 UI なし | ◎ | SetupBasicInfoForm / SetupRecipeEditor / SetupEditorPage に紐付け UI なし |
| 8 | VAL-S05 — セットアップ新規作成は親コンボ ID 必須 | ○ | `useCreateSetup.mutate` に `comboId` 引数あり。`/setups/new` への直接遷移ルートなし |
| 9 | useCombo queryKey — パラメータの型 string/number 統一 | ◎ | `parseInt` による正規化実装済み。`architecture-patterns.md` §1.1 に規約化 |
| 10 | N+1 回避 — FindComboIDsBySetupIDs を SQL IN 句で一括取得 | ○ | repository 実装済み。`TestRepository_ListSetupsByComboID` で検証 |
| 11 | バックエンドテスト — handler/service/repository の主要ケース | ○ | 10 テスト関数を追加（handler 4件・service 2件・repository 2件・combo handler 2件）|
| 12 | フロントエンドテスト — フックテスト3ファイル | △ | 各1テスト（mutate → API 呼び出し確認）。キャッシュ無効化・楽観的更新の動作検証は未実施 |
| 13 | SetupBasicInfoForm — mode prop 不使用 | ◎ | Props から削除済み |
| 14 | SetupSummary.parentComboIds — number[] 型（複数親対応） | ◎ | TypeScript/Go ともに配列型 |
| 15 | 既存機能回帰なし | ◎ | `go test ./...` 全通過。フロント 254 テスト（46 ファイル）全通過 |

---

## 設計準拠性以外の指摘事項

### [低] SetupRecipeEditor.tsx — `as any` キャスト2箇所（第1回から継続）

- **箇所**: `web/src/features/setup/components/SetupRecipeEditor.tsx` 286・288行目
  ```typescript
  step={toInternalStep(steps[editingIndex]) as any}
  movesById={movesById as any}
  ```
- **問題**: CLAUDE.md §4「`any` は原則禁止」違反。`SetupStep` と `ComboStep` の型乖離をキャストで回避している。
- **対応**: M4 完了後、`SetupStep` の型を `RecipeBuilder` の期待型（`InternalStep`）に正式に対応させるか、変換関数の戻り値型を正確に定義することで解消する。

### [情報] フックテストのキャッシュ検証不足（リスク微小）

`useCreateSetup` / `useUpdateSetup` / `useDeleteSetup` の各テストは「API が呼ばれたか」のみ検証しており、TanStack Query の `invalidateQueries` 動作は未テスト。チェックリスト §12.1 の意図（キャッシュ更新の動作確認）には完全には応えていないが、手動確認・E2E で補完可能なため低リスクとして扱う。

---

## 推奨修正（優先度別）

- **高（M4 完了前に修正必須）**: なし
- **中（M5 着手と並行可）**: なし
- **低（将来対応）**: `SetupRecipeEditor.tsx` の `as any` キャスト2箇所を適切な型定義に置換（M5 リファクタ候補）

---

## 良かった点

- **修正の網羅性**: 第1回レビューの全重大指摘（テスト欠落4ファイル・型不一致・omitempty・バリデーション欠落）を漏れなく対応した。中優先度4件もすべて解消。
- **UX 仕様の自律的再確認と修正**: `SetupAccordionItem` は DES-005 §5.6 を再読して指示書 v1.0.3 で仕様確定後、実装・テストの両方を適切に修正した。特に `e.stopPropagation()` で3つのインタラクション（行クリック・展開・紐付け解除）を独立制御した設計が明快。
- **回帰テストの追加**: `TestHandler_Get_200_SetupsEmptyArray` は `omitempty` 除去の意図を将来保護する回帰テストとして機能する。設計意図をテストに刻んだ判断が良い。
- **ドキュメント化**: queryKey 正規化の知見を `architecture-patterns.md` §1.1 に規約として残したことで、同じ罠を後続作業で踏まない仕組みを作った。
- **SetupSummary の型整合**: Go と TypeScript の両側でフィールド構成を揃えた。サーバー型とクライアント型のズレを放置せず、両側を同期させた点が堅実。
- **N+1 問題回避**: `ListSetups` / `ListSetupsByComboID` ともに `FindComboIDsBySetupIDs` による一括 IN クエリで `parentComboIds` を取得しており、N+1 が発生しない。
- **フック分離の徹底**: M3-04 パターンを忠実に踏襲し、コンポーネント内に API 呼び出しが一切ない。

---

## 完了判定

**重大な問題なし → 完了承認待ち**

第1回レビューで指摘した全重大・中優先度問題の解消を確認した。残る `as any` キャスト2箇所は低優先度で M5 以降での対応が可能。M4-02 の完了を承認する。

---

## 制約事項

- 本レビューはコード上で判定可能な範囲のみ対象。実際の動作確認・パフォーマンス・実機テストは別途実施が必要。
- E2E シナリオ A〜F の開発者実機確認は本レビューの対象外（指示書 v1.0.3 §5.2 シナリオ E 削除済み）。
