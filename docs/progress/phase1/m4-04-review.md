# M4-04 レビュー報告書

## 1. レビュー実施日

2026-05-20

## 2. レビュー結果サマリ

| 項目 | 結果 |
|------|------|
| ファイル一覧(バックエンド): DTO/service/handler 修正 | ✅ 充足(ただしテスト不足) |
| ファイル一覧(フロントエンド新設): SetupRegistrationSection / SetupInputRow | ✅ 充足 |
| ファイル一覧(フロントエンド修正): useCreateCombo / types / ComboEditor | ✅ 充足 |
| §3.1 トランザクション原子性 | ✅ 充足 |
| §3.2 VAL-S05 サービス層引数レベル適用 | ✅ 充足 |
| §9.1 copy モードで setups 引き継がない | ✅ 充足 |
| §9.2 編集モードで同時登録セクション非表示 | ✅ 充足 |
| §7.3 RecipeBuilder 変更なし | ✅ 充足 |
| §3.3 境界値ケース網羅テスト | ❌ **欠落(重大)** |
| §8 LinkExistingSetupModal 再利用 | ❌ **新規 SetupSelectorModal を実装(重大)** |
| §1.1 handler_test.go に M4-04 テスト追加 | ❌ **欠落** |
| §10.4 ComboEditorPage.test.tsx に M4-04 テスト追加 | ❌ **欠落** |
| §5.2 onSuccess での invalidate 対象(characterId スコープ) | ⚠️ 不完全 |
| §6.1 SetupRegistrationSection Props 最小化 | ⚠️ 仕様超過 |
| §7.1 SetupInputRow Props 最小化 | ⚠️ 仕様超過 |

---

## 3. 設計準拠性レビュー結果

### §1.4 スコープ外への変更 ◎

- DB マイグレーション追加なし ✅
- RecipeBuilder の変更なし ✅
- M4-01/M4-02/M4-03 の既存ファイルへの不要変更なし ✅
- M4 統合 E2E / L-01 解消 / 下書き保存 / 編集モード同時登録 / セットプレイ並び替えは未実装 ✅

### §2.1 バックエンド DTO 拡張 ○

`internal/api/combo/dto.go` の `CreateRequest` に `Setups []BundledSetupRequest` が追加され、`json:"setups,omitempty"` タグで前方互換が確保されている。  

ただし、**指示書 §4.2.1 では `Setups []CreateSetupInput`（setup 側の既存型を直接利用）を指定**していたのに対し、実装は `BundledSetupRequest` / `BundledSetupStepRequest` という新規 DTO を combo パッケージ内に定義した。進捗ログには「parentComboId を含まない、stepOrder を含まない」という理由が記載されており、機能的には `setupsvc.CreateSetupInput` と等価。型二重定義の技術的負債が残る点は低優先の改善候補。

`CreateSetupInput.parent_combo_id` が DTO に含まれていない点は仕様通り ✅（VAL-S05 / CHANGE-012 §6.2 R-2 対策）。

### §3.1 トランザクション原子性 ◎

`service.go` の `Create()` を確認。コンボ作成 → `InsertCombo` → `InsertSteps` → `RecomputeComboCache` → `ReplaceTagAssociations` → **setups ループ** → `Commit` の順序で同一 `tx` 内に実装されている。  

```go
if len(input.Setups) > 0 && s.setupSvc != nil {
    for i, setupInput := range input.Setups {
        _, setupResult, setupErr := s.setupSvc.CreateSetupInTx(ctx, tx, newID, setupInput)
        if setupErr != nil {
            err = fmt.Errorf("create setup setups[%d]: %w", i, setupErr)
            return nil, result, err  // defer の tx.Rollback() で全体ロールバック
        }
```

setup バリデーションエラー時も `tx.Rollback()` を明示的に呼び出した上で `(nil, result, nil)` を返す実装。  
原子性確保 ✅、エラーメッセージに `setups[i].field` プレフィックス ✅

### §3.2 VAL-S05 サービス層引数レベル適用 ◎

```go
s.setupSvc.CreateSetupInTx(ctx, tx, newID, setupInput)
```

`parentComboID int64` が引数として明示的に渡されており、`CreateSetupInput` には `ParentComboID` フィールドが存在しない。CHANGE-012 §6.2 R-2 対策は正しく実装 ✅

### §3.3 境界値ケース網羅テスト × (重大)

`internal/service/combo/service_test.go` を精査した結果、**M4-04 で追加すべき setups 束受領のテストが 1 件も存在しない**。

`newSvc()` ヘルパが `setupSvc: nil` を渡すため、既存テストでは `s.setupSvc != nil` の分岐が発動せず、setups パスは実質テスト不可能。

指示書 §4.3.4 + チェックリスト §3.3 が要求する境界値ケース 8 件は以下のとおり全て未実装:

| ケース | テスト存否 |
|-------|-----------|
| setups = nil で既存挙動 | ❌ |
| setups = [] で既存挙動 | ❌ |
| setups = [valid setup 1 件] | ❌ |
| setups = [valid setup 複数件] | ❌ |
| setups[i] バリデーションエラー → 全体ロールバック | ❌ |
| setups[i] VAL-S05 防御 | ❌ |
| コンボ本体作成失敗 → setups 未処理 | ❌ |
| DB 整合性違反 → 全体ロールバック | ❌ |

**チェックリスト §13 重大判定基準「§3.3 境界値ケースの網羅が不足している」に該当 → 完了承認保留**

### §4.4 フロント CreateComboInput 型拡張 ◎

`web/src/features/combo/types.ts` の `CreateComboRequest` に `setups?: CreateSetupInput[]` が追加されている。`CreateSetupInput` は `@/features/setup/types` から import して再利用 ✅

### §5.2 useCreateCombo の onSuccess invalidate △

実装:
```typescript
onSuccess: (_, variables) => {
  qc.invalidateQueries({ queryKey: ["combos"] });
  if (variables.setups && variables.setups.length > 0) {
    qc.invalidateQueries({ queryKey: ["setups"] });
    qc.invalidateQueries({ queryKey: ["setupCandidates"] });
  }
},
```

指示書 §4.5 との差異:

| 項目 | 指示書 | 実装 | 影響 |
|------|-------|------|------|
| combos のキャラ別 invalidate | `['combos', data.characterId]` | なし | 低(上位 `['combos']` が代替) |
| setups の characterId スコープ | `['setups', data.characterId]` | `['setups']`(全件) | 低〜中(スコープが広い分、不要な再取得増) |
| 判定対象 | `data.setups`(レスポンス) | `variables.setups`(リクエスト) | 低(リクエスト送信時の確認のため、失敗時でも invalidate 発火) |

チェックリスト §5.2 の完全充足には至っていない。ただしチェックリスト §13 の重大判定基準「`['setups']`/`['setupCandidates']` が invalidate されていない」には該当しない。

### §6.1 SetupRegistrationSection Props △

指示書・チェックリスト §6.1 は 3 props のみを規定:

```typescript
interface SetupRegistrationSectionProps {
  value: CreateSetupInput[];
  onChange: (setups: CreateSetupInput[]) => void;
  characterId: number;
}
```

実装は 5 props:

```typescript
interface Props {
  value: CreateSetupInput[];
  onChange: (setups: CreateSetupInput[]) => void;
  characterId: number;
  linkedSetups: SetupSummary[];          // 追加
  onLinkedSetupsChange: (setups: SetupSummary[]) => void;  // 追加
}
```

指示書 §4.6.4 では `linkedSetupIds: number[]` を **親コンポーネント(ComboEditorPage)** で管理し、SetupRegistrationSection に渡さない設計を想定していた。実装では `SetupSummary[]`（表示に必要な情報を含む）として SetupRegistrationSection 経由で管理している。

機能上は問題ないが、指示書の Props 最小化方針(M4-5 反省踏襲)からの逸脱。また型も `number[]` から `SetupSummary[]` に変わっており、責務境界の変更を伴う。

### §7.1 SetupInputRow Props △

指示書・チェックリスト §7.1 は 4 props のみを規定。実装は `index: number` を追加して計 5 props。  
「セットプレイ N」という表示ラベルに使用しており機能上正当だが、指示書設計からの逸脱。

### §8 LinkExistingSetupModal 再利用 × (重大)

指示書 §4.8「M4-02 §4.7 で実装済みの `LinkExistingSetupModal` をそのまま再利用する」に対して、**新規 `SetupSelectorModal` を実装**している。

`LinkExistingSetupModal` は `parentComboId: number` を必須 props として内部で `useCreateSetupLink` を呼ぶ設計のため、コンボ未作成の新規登録モードではそのまま使えない。  
指示書 §4.8 は「Props を拡張する必要がある場合は本指示書 §4.6 で対応」と記しており、Props 拡張による対応を想定していたが、新規コンポーネント作成で回避した。

**チェックリスト §13 重大判定基準「`LinkExistingSetupModal` が再利用されていない(新規モーダルを実装している、M4-5 反省踏襲違反)」に該当 → 完了承認保留**

なお、`SetupSelectorModal` の動作は技術的に正しく、`excludeSetupIds` によるフィルタリングや onSelect コールバック設計も適切。ただし指示書の意図(既存実装再利用の徹底)に反する。

### §9.1 / §9.2 ComboEditorPage / ComboEditor ◎

`ComboEditor.tsx` (実装上の等価物):

```tsx
{(mode === "new" || mode === "copy") && (
  <SetupRegistrationSection ... />
)}
```

- 新規登録モード(new + copy 両方)で同時登録セクションが表示される ✅
- 編集モードでは表示されない ✅
- copy モードでは `setupsToCreate` / `linkedSetups` ともに空の初期値 ✅
- `runCreate()` で setupsToCreate を API に渡し、linkedSetups を順次 `useCreateSetupLink` で紐付け ✅
- 保存成功後にコンボ詳細画面へ遷移 ✅

実装は `ComboEditorPage.tsx` ではなく `ComboEditor.tsx` に行われているが、機能的には等価。

---

## 4. 設計準拠性以外の指摘事項

### ハンドラ層テスト欠落 (§1.1 / §10.1)

`internal/api/combo/handler_test.go` に POST /api/combos の `setups` フィールドを含むテストが存在しない。  
指示書 §5.1.1 の「setups 1 件/複数件で 201」「バリデーションエラーで 400」等のハンドラ層テストが不足。

### ComboEditorPage.test.tsx テスト欠落 (§1.3 / §10.4)

`web/src/pages/ComboEditorPage.test.tsx` の現内容は M4-03 向け `KnockdownAdvantageChangeModal` のテストのまま。  
指示書 §5.1.4 の 4 ケース(新規登録/編集モードでのセクション表示制御、保存時の setups 引数確認等)が未実装。

### 動作確認シナリオ A〜H の記録完全性

進捗ログの curl テスト結果はシナリオ A(setups なし)/B(setups 1件)/F(バリデーションエラー)の概要のみ。  
D(既存 setup 紐付け)、E(新規 + 既存併用)、G(編集モード非表示)、H(M3-05 統合 E2E 回帰)の明示的な確認記述が不足。

### ファイル一覧の未充足カウント

チェックリスト §13「ファイル一覧チェックで 3 件以上の未充足」について:  
- §1.1 `internal/api/combo/handler_test.go` → M4-04 固有テスト追加なし ❌  
- §1.3 `web/src/pages/ComboEditorPage.test.tsx` → M4-04 固有テスト追加なし ❌  
- §1.2 フロントエンド新設ファイル → `SetupSelectorModal.tsx` / `SetupSelectorModal.test.tsx`(指示書外の新規実装) △  

実質 2 件の明確な未充足 + 1 件の規格外ファイル追加で、「3 件以上」に接近または該当。サービス層テスト欠落を含めると明確に超過。

---

## 5. 推奨修正(優先度別)

### 高（M4 完了前に修正必須）

1. **サービス層 M4-04 テストの追加**: `setupSvc` に `setupsvc.Service` モックを渡す `newSvcWithSetups()` ヘルパを作成し、§4.3.4 の境界値ケース 8 件をカバーするテストを追加。特に「setups バリデーションエラー時の全体ロールバック確認」は必須。

2. **ハンドラ層テストの追加**: `handler_test.go` に POST /api/combos + `setups` フィールドのテストを追加（正常系 1 件 + バリデーションエラー 1 件で最低限の網羅）。

3. **`LinkExistingSetupModal` の再利用 または 判断記録**: 指示書の意図通りに `LinkExistingSetupModal` を Props 拡張して再利用するか、または `SetupSelectorModal` 新設を採用する場合は開発者の明示的な承認を得た上で `docs/change-notes/` に設計変更通知を起票すること。
   - Props 拡張案: `parentComboId?: number | null` に変更、null 時は `useCreateSetupLink` を呼ばず `onSelect(setup)` コールバックのみ

### 中（M5 着手と並行可）

4. **ComboEditorPage.test.tsx の M4-04 テスト追加**: 新規登録/編集モードでのセクション表示制御テストを追加。

5. **`useCreateCombo` onSuccess の精度向上**: `['combos', data.characterId]` と `['setups', data.characterId]` の characterId スコープ指定を追加。`variables.setups` → `data.setups` で判定。

### 低（将来対応）

6. **`BundledSetupRequest` 型二重定義の解消**: `setupsvc.CreateSetupInput` を再利用するか、または両者の差異をコメントで明記して管理負担を軽減。

7. **SetupRegistrationSection / SetupInputRow の Props 仕様との整合**: `linkedSetups`/`onLinkedSetupsChange` を ComboEditor 内部で管理し、SetupRegistrationSection への Props を指示書仕様の 3 props に絞る。`index` prop の削除(セクション見出しを変更するか、親側から渡さず内部で管理)。

---

## 6. 良かった点

1. **トランザクション原子性の実装**: `defer tx.Rollback()` + コミット前の全処理の同一 tx 内集約が正しく実装されており、setup 作成失敗時の全体ロールバックが保証されている。

2. **VAL-S05 の正確な適用**: `CreateSetupInTx(ctx, tx, parentComboID, input)` で `parentComboID` を引数として明示的に渡し、DTO には含めない設計が CHANGE-012 §6.2 R-2 対策を正しく実装している。

3. **個別 VC レンダリングの適切な採用**: v1.0.1 改訂方針に従い、各 `SetupInputRow` が `SetupRecipeEditor` を個別にレンダリングし、RecipeBuilder 変更を回避している。

4. **エラーメッセージの位置明示**: setup バリデーションエラー時に `setups[i].field` プレフィックスを付与する処理が正しく実装されており、UX 上の位置特定が可能。

5. **copy モードの空状態表示**: `setupsToCreate` / `linkedSetups` の初期値が空配列のまま（コピー元 setups を引き継がない）、指示書 §1.4 の規定通り。

6. **ビルド・型チェック・既存テスト全通過**: `go build`、`go vet`、`go test ./...`、TypeScript 型チェック、`pnpm exec vitest run` がすべて通過。

---

## 7. 制約事項

- 本レビューは静的コードレビュー。**実機テスト(ブラウザでの動作確認、動作確認シナリオ A〜H の実行)は別途実施が必要**(playbook §14、M4-02 E2E 由来運用知見)
- **M4 統合 E2E は M4-05 で実施**(本指示書では本機能の動作確認のみ)
- 動作確認シナリオ A〜H の手動確認は開発者の責任範囲

---

## 8. 完了承認判定

**❌ 完了承認保留（重大な問題あり）**

以下の 2 件が チェックリスト §13 の重大判定基準に該当:

1. **§3.3 境界値ケース網羅テスト欠落**: `service_test.go` に setups 束受領テストがゼロ。特に「setups バリデーションエラー時の全体ロールバック確認」が欠落している。
2. **§8 `LinkExistingSetupModal` 未再利用**: 新規 `SetupSelectorModal` を実装。M4-5 反省踏襲違反。

また、`handler_test.go` および `ComboEditorPage.test.tsx` の M4-04 固有テスト欠落を含めると、ファイル一覧チェックの「3 件以上の未充足」基準にも接近・到達している。

**「推奨修正 高優先度」3 件の対応完了後、再レビューにて承認判定を行うことを推奨**。
