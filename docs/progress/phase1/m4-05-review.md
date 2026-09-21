# M4-05 機械レビュー報告書

## 1. レビュー実施日
2026-05-21

## 2. レビュー結果サマリ

| 項目 | 結果 |
|------|------|
| ファイル一覧(§2.1) | ✅ 全 7 件確認、スコープ逸脱なし |
| §2 L-01 オプショナル型解消 | ✅ |
| §3 C-1 持ち越し確認課題の解消(最重要) | ✅ |
| §4 統合 E2E シナリオの完備 | ✅ |
| §5 着手前確認結果 | ✅ |
| §6 ビルド・型チェック | ✅ |
| §7 コード品質・規約遵守 | ✅ |
| §8 ドキュメント・進捗ログ | ✅ |
| §9 M4 完了宣言 | ✅ |

---

## 3. C-1 検証結果(最重要)

### 3.1 静的検証

`ComboEditor.tsx` の `runPatch` 関数:

**修正前(推定):**
```typescript
const runPatch = (setupCarryOptions?: SetupCarryOptionsInput) => {
  const implicitCarry = !setupCarryOptions && (initial?.setups?.length ?? 0) > 0; // ← バグ
  patchMut.mutate({ ...buildPatchPayload(), setupCarryOptions }, {
    onSuccess: (data) => handleSaveSuccess(data, implicitCarry),
  });
};
```

**修正後:**
```typescript
const runPatch = (setupCarryOptions?: SetupCarryOptionsInput) => {
  patchMut.mutate({ ...buildPatchPayload(), setupCarryOptions }, {
    onSuccess: (data) => handleSaveSuccess(data, false), // ← 常に false 固定
  });
};
```

| 確認項目 | DES-005 §5.7 (b) 規定 | 実装での動作 | 整合性 |
|------|---------------------|------------|-------|
| メタデータのみ変更時の保存方式 | PATCH API で直接更新 | `hasKeyChanges()` = false → `runPatch()` | ○ |
| `combo_setups` 状態変化 | なし | バックエンド: `SetupCarryOptions == nil` → combo_setups 不変 | ○ |
| トースト通知 | 表示しない | `handleSaveSuccess(data, false)` → `implicitCarry = false` → トースト非表示 | ○ (修正済) |
| implicitCarry 判定の (b) パスでの動作 | (b) パスでは引き継ぎ不要 | PATCH パスは常に `false`、PUT パス(`runPut`)のみ条件付き判定 | ○ (修正済) |

- 静的検証: **○** (修正により DES-005 §5.7 (b) 規定と整合)
- 動的検証: **未実施**(開発者の実機確認待ち、E2E シナリオ E / U-3 として手順書記載済み)
- DES-005 §5.7 (b) 規定との整合性: **○**

### 3.2 C-1 修正の補足検証

- `runPut`(PUT パス)は `implicitCarry = !pendingCarryOptions && (initial?.setups?.length ?? 0) > 0` を維持 ✅
- PUT パスのみ `implicitCarry` 判定あり、PATCH パスは常に `false` → 責務分離が明確 ✅
- 回帰テスト(`C-1: PATCH 保存で暗黙引き継ぎトーストが表示されない`)が `ComboEditor.test.tsx` に追加されている ✅
- テストは `setup 紐付き済みコンボのメタデータのみ変更` のシナリオを正確に再現し、`navigate` が `topMessage` なしで呼ばれることを検証 ✅

---

## 4. 検出した問題

### 4.1 重大な問題(完了承認保留)

**該当なし。**

### 4.2 軽微な問題(完了承認可、改善推奨)

#### [LOW-1] `ComboTableRow.tsx` の `defaultRecipe || "-"` パターン

**ファイル**: `web/src/features/combo/components/ComboTableRow.tsx:44`

```typescript
const recipePreview = combo.defaultRecipe || "-";
```

`defaultRecipe` が必須型 `string` になったため、`||` ガードは空文字列(`""`)への対応。機能的には正しいが、必須型化後の意図(「undefined でなく空文字列をガード」)が一見わかりにくい。コメント追加か `|| "-"` を `|| "-"` のまま維持する理由を明示してもよい。

**影響**: なし(機能的に正常動作、テスト通過)

#### [LOW-2] `CLAUDE.md §4 TypeScript` のコメントテンプレートとのずれ

`CLAUDE.md §4` のコメントテンプレートは `// 注: ComboSummary と Combo は別 interface だが` だが、`types.ts` のヘッダコメントは `// 注: ComboSummary と ComboDetail / Combo は別 interface だが` と `ComboDetail` を含む形に更新済み。

これは M4-05 以前の状態(`ComboDetail` 型の追加)から生じた乖離であり、本指示書スコープ外。次回 handover ドキュメント整理時に CLAUDE.md 側を合わせることを推奨。

**影響**: なし(CLAUDE.md はテンプレートの参考例であり、types.ts の現実を正しく反映した types.ts コメントの方が正確)

### 4.3 改善提案(次回マイルストーン以降)

#### [SUGGEST-1] `SetupCandidateList.tsx` の `setup.defaultRecipe &&` パターン

`web/src/features/setup/components/SetupCandidateList.tsx:51` で `{setup.defaultRecipe && (...)}` が使われているが、`SetupSummary.defaultRecipe` は `string` 必須型。空文字列ガードとして機能しており問題はないが、M5 以降でのリファクタ時に統一を検討してもよい。

---

## 5. 各チェック項目の詳細

### §1 ファイル一覧チェック

| チェック | 結果 |
|---------|------|
| `types.ts` の `ComboSummary.defaultRecipe?`/`starterMoveCode?` が必須型に変更 | ✅ |
| `types.ts` の `Combo.defaultRecipe?`/`starterMoveCode?` が必須型に変更 | ✅ |
| 影響箇所の `?.`/`??` チェーン削除(不要箇所なし、`\|\|`/`&&` は空文字列ガードで適切) | ✅ |
| L-01 関連テスト修正(4 ファイル: utils.test.ts, TrashList/Row.test.tsx, PromoteToFinalButton.test.tsx) | ✅ |
| スコープ外への変更なし(新機能・新コンポーネント・L-02/L-03/下書き保存・C-2/C-3・DB マイグレなし) | ✅ |
| 設計書本体(REQ-001/DES-001〜DES-006)への変更なし | ✅ |
| バックエンド DTO 変更なし | ✅ |

### §2 L-01 オプショナル型解消チェック

| チェック | 結果 |
|---------|------|
| `ComboSummary.defaultRecipe` が `string`(必須型) | ✅ (line 64) |
| `ComboSummary.starterMoveCode` が `string`(必須型) | ✅ (line 65) |
| `Combo.defaultRecipe` が `string`(必須型) | ✅ (line 132) |
| `Combo.starterMoveCode` が `string`(必須型) | ✅ (line 133) |
| `ComboDetail extends ComboSummary` により継承分も自動修正 | ✅ |
| テストモックに `defaultRecipe: ""` / `starterMoveCode: ""` が追加 | ✅ (4 ファイル) |

### §3 C-1 検証チェック

| チェック | 結果 |
|---------|------|
| `runPatch` が `handleSaveSuccess(data, false)` で常に `implicitCarry = false` | ✅ |
| `runPut` が `implicitCarry = !pendingCarryOptions && ...` を維持 | ✅ |
| §4.3.1 確認項目表(4 項目)が progress-log に記入 | ✅ |
| C-1 回帰テストが `ComboEditor.test.tsx` に追加 | ✅ |
| シナリオ E / U-3 の手順書記載(リロード後確認 + curl 確認含む) | ✅ |

### §4 統合 E2E シナリオチェック

| シナリオ | 状態 |
|---------|------|
| A: コンボ + セットプレイの新規同時登録(M4-04) | ✅ 手順書記載 |
| B: FR011 転用支援(M4-03) | ✅ 手順書記載 |
| C: knockdown_advantage 変更時の確認モーダル(M4-03) | ✅ 手順書記載 |
| D: セットプレイ単体 UI + 編集(M4-02) | ✅ 手順書記載 |
| E: PATCH 保存方式((b) 保存方式、C-1 検証含む) | ✅ 手順書記載 |
| U-1: コンボとセットプレイをまとめて登録 | ✅ 手順書記載 |
| U-2: FR011 で既存セットプレイを別コンボに転用 | ✅ 手順書記載 |
| U-3: KA 変更時のセットプレイ引き継ぎフロー(C-1 含む) | ✅ 手順書記載 |
| U-4: 既存機能(M3-05 まで)の回帰確認 | ✅ 手順書記載 |
| レビュー完了承認 ≠ M4-05 完了承認の運用明示 | ✅ |

### §5 着手前確認結果チェック

| チェック | 結果 |
|---------|------|
| §3.3.1 L-01 既存型定義の実態確認 | ✅ progress-log に記載 |
| §3.3.2 L-01 影響範囲洗い出し(4 ファイル、ドメイン横断確認) | ✅ progress-log に記載 |
| §3.3.3 C-1 implicitCarry 判定の実装確認 | ✅ progress-log に確認項目表(4 項目) |
| §3.3.4 設計書本体への影響なし確認 | ✅ CHANGE 通知書不要と明記 |
| §3.3.5 queryKey 規約の踏襲確認 | ✅ combo 系 flat tuple / setup 系 object を確認 |

### §6 ビルド・型チェック

| チェック | 結果 |
|---------|------|
| `pnpm vitest run` — 55 ファイル 301 テスト | ✅ 全通過 |
| `pnpm tsc --noEmit` | ✅ エラーなし |
| `go test ./...` | ✅ 全通過 |
| `go build ./...` | ✅ 成功 |
| `go vet ./...` | ✅ エラーなし |

### §7 コード品質・規約遵守

| チェック | 結果 |
|---------|------|
| CLAUDE.md §4 TypeScript 規約 | ✅ |
| CLAUDE.md §5 テスト規約 | ✅ |
| CLAUDE.md §10 禁止事項 | ✅ |
| architecture-patterns.md v1.0.3 §1.1 queryKey 規約 | ✅ 変更なし、既存フック規約維持 |
| shadcn/ui 不使用 | ✅ |
| L-01 型変更による回帰なし | ✅ |
| C-1 整合性確認 | ✅ DES-005 §5.7 (b) 規定と整合 |
| 設計書本体への影響なし | ✅ CHANGE 通知書起票不要 |

---

## 6. M4 完了宣言の確認

- ✅ M4 全体(M4-00 / M4-00b / M4-01〜M4-05)の完了宣言が progress-log に含まれている
- ✅ 開発者の E2E 実機確認・承認をもって M4 完了状態とする旨が明記されている

---

## 5. 制約事項

- 本レビューは静的コードレビューおよびビルド/テスト実行の範囲。**実機テスト(ブラウザでの動作確認、統合 E2E シナリオ A〜E + U-1〜U-4 の実行、C-1 動的検証)は別途実施が必要**(playbook §14、M4-02 E2E 由来運用知見)
- C-1 動的検証(シナリオ E: PATCH 時の combo_setups 不変確認 / トースト非表示確認)は開発者の実機確認待ち

---

## 7. 完了承認判定

**✅ 完了承認可**

重大な問題は検出されなかった。L-01 型解消・C-1 修正・E2E 手順書・ビルド/テストすべて完了。軽微な指摘(LOW-1, LOW-2)はいずれも機能への影響がなく、次回マイルストーン以降で対応可。開発者の E2E 実機確認(特にシナリオ E の C-1 動的検証)をもって M4-05 完了となる。
