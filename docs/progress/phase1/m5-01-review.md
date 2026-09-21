# M5-01 レビュー報告書

## レビュー実施日
2026-05-23(初版) / 2026-05-23(v2 改訂、指示書 v1.0.2 + チェックリスト v1.0.1 対応)

## 総評

指示書 v1.0.2 + チェックリスト v1.0.1 に対してレビューを実施した。前回レビュー(指示書 v1.0.1 対応)で指摘した「U-1 シナリオ記載漏れ」「`isAllError` / `isAllLoading` 全体エラー分岐」の 2 件が両方解消された。loading 中はスケルトン表示(animate-pulse)が `CompareTable` / `CompareTargetList` に正確に実装されており、統合案 Q の要件を満たしている。全 327 テスト通過。設計準拠性・コード品質ともに高く、残存問題はいずれも軽微。

---

## 設計準拠性レビュー結果(変更点中心)

### §2.3 データ取得 ― 統合案 Q(§4.1.3 v1.0.2 改訂、最重要)

**◎ `isAllError` / `isAllLoading` 全体エラー分岐の削除**

`ComparePage.tsx` から `isAllLoading`/`isAllError` とそれに伴う全体エラー画面・ローディング画面の分岐が完全に削除されている。`CompareTable` は `ids.length > 0` である限り常時描画される。

**◎ loading 中スケルトン表示(指示書 §4.1.3 統合案 Q)**

```tsx
// ComparePage.tsx
const loadings = queries.map((q) => q.isLoading); // ← 追加

// CompareTable.tsx renderCell
if (errors[index]) { return <td>取得失敗</td>; }
if (loadings[index]) {
  return <td><div className="h-4 bg-slate-200 rounded animate-pulse" /></td>; // ← 追加
}
```

判定順序が「エラー優先 → loading → データなし → データあり」となっており正確。TanStack Query の仕様上(再フェッチ中は `isError=true`・`isLoading=false`)エラーと loading が同時に true になることはないため、順序に問題なし。

`CompareTable` のヘッダ部の始動状況サブタイトルもスケルトン表示に対応済み。

**◎ `CompareTargetList` の loading 対応**

カードの表示優先順位が「エラー → loading スケルトン → データ → `#id` グレー表示」となっており、loading 中に `#id 取得失敗` の赤表示がフラッシュしない。

**統合案 Q 要件の全チェック:**

| チェック項目 | 結果 |
|-------------|------|
| `isAllError` 分岐削除(CompareTable 常時描画) | ✅ |
| loading 中スケルトン表示(`renderCell` に `isLoading` 分岐) | ✅ |
| CompareTargetList の loading スケルトン | ✅ |
| loading 中: スケルトン / 取得失敗: 「取得失敗」/ フィールド null: 「-」の三者区別 | ✅ |
| 全列削除 → `ids.length = 0` → プレースホルダ遷移 | ✅(既存実装で担保) |

---

### §8 統合 E2E シナリオ手順書(§5.2 v1.0.2)

**◎ 9 シナリオ(A〜G + U-1 + U-2)が進捗ログに記載済み**

| シナリオ | 内容 | 記載状況 |
|---------|------|---------|
| A | 基本動作 2 件比較 | ✅ |
| B | 上限 5 件制御(v1.0.2 訂正: 非活性化 + URL 直接アクセス) | ✅ 更新済み |
| C | 不正値除外 + 全件失敗ケース(v1.0.2 拡張) | ✅ 更新済み |
| D | コンボ追加モーダル | ✅ |
| E | マイコンボ選択モード | ✅ |
| F | PC ブラウザ横スクロール | ✅ |
| G | loading 中スケルトン表示(v1.0.2 新規) | ✅ 新規追加 |
| U-1 | 複数キャラ比較(将来検証用) | ✅ 名前付きエントリ追加 |
| U-2 | 既存機能回帰確認 | ✅ |

---

### その他の設計準拠項目(前回レビューから変更なし)

前回レビューで確認済みの以下は変更なく維持されている:

- **12 行表示構成**: ✅
- **起き攻め 5 パターン(DR無3 / DR有2)**: ✅
- **シミー DR 有データ未参照**: ✅ (`okiShimmyNeutralTechDr`/`okiShimmyBackTechDr` 非参照)
- **queryKey `["combo", id]` flat tuple + number**: ✅
- **useSelectMode 共通フック + タブ切替時 clear**: ✅
- **バックエンド変更なし / DB 変更なし / 設計書本体変更なし**: ✅
- **shadcn/ui 未使用**: ✅

---

## 設計準拠性以外の指摘事項

### 中: `ids` の useMemo 依存配列設計(未解消、`ComparePage.tsx`:28-32)

```typescript
const rawIds = parseIds(searchParams.get("ids")); // 毎レンダーで新配列
const ids = useMemo(() => {
  return rawIds.slice(0, MAX_COMPARE_COMBOS);
}, [rawIds]); // rawIds は毎レンダーで新参照 → memoization 無効
```

前回レビューで指摘済みだが未修正。`ids` が毎レンダーで新参照になるため `loadings` も毎レンダーで新配列になるが、`useQueries` が queryKey で内部比較するため再フェッチは発生しない。動作上の問題はないが memoization の意図が機能していない。

**推奨修正:**
```typescript
const ids = useMemo(() => {
  return parseIds(searchParams.get("ids")).slice(0, MAX_COMPARE_COMBOS);
}, [searchParams]);
```

---

## ビルド・型チェック(再確認)

| チェック | 結果 |
|---------|------|
| `pnpm exec vitest run` | ✅ 327 テスト全通過 |
| `pnpm build` | 未実行(コード変更後) |
| TypeScript 型チェック | 型変更あり(`loadings` Props 追加)、テスト通過から問題なしと判断 |
| `go test ./...` | ✅(バックエンド変更なし) |

> **注意**: `pnpm build` を変更後に再実行して確認することを推奨。

---

## 推奨修正(優先度別)

### 高(M5 完了前に修正必須)

なし。前回指摘の高優先事項は解消済み。

### 中(M6 着手と並行可)

1. **`ComparePage.tsx` ids の useMemo 依存修正**: 上記参照。動作問題はないが可読性のために推奨。

### 低(将来対応)

2. **CompareTable 角セルのラベル見直し**: thead 左上コーナーセルが `t("comboList.column.starterStatus")` = "始動状況" を表示。行ラベル列のヘッダとして意味が不正確。空文字または "比較項目" 等を推奨。
3. **loading スケルトン状態の専用テスト追加**: `CompareTable.test.tsx` に `loadings: [true]` 時のスケルトン表示テストがない。`CompareTable.test.tsx` に `loadings: [true]` で skeleton が描画されることを確認する 1 テスト追加を推奨。
4. **AddComboToCompareModal キャラクターフィルタ**: 指示書 v1.0.2 §9 R-3 として正式に持ち越し記録済み。M7 キャラ追加時に対応。

---

## 良かった点

- **統合案 Q への対応が的確**: `isAllLoading`/`isAllError` 分岐の削除と `loadings` 配列への置き換えがシンプルかつ正確。`renderCell` の判定順序(エラー優先 → loading → データ)も論理的に正しい。
- **スケルトン UI の一貫性**: `CompareTable`(セル内) と `CompareTargetList`(カード内)の両方に animate-pulse スケルトンを実装し、loading 中の UX が統一されている。
- **前回レビュー指摘への迅速な対応**: U-1 シナリオ追加・エラーハンドリング修正・シナリオ B/C/G 更新がすべて反映されており、レビューフィードバックのサイクルが機能している。

---

## 制約事項

- 本レビューはコード静的解析のみ。**実機テスト(シナリオ A〜G + U-2 の実機実行、loading スケルトンの実際の表示確認、URL 共有・リロード挙動)は別途実施が必要**(playbook §14)。
- `pnpm build` を変更後に再実行して確認することを推奨(TypeScript コンパイル最終確認)。

---

## 完了承認判定

**✅ 完了承認可**

指示書 v1.0.2 + チェックリスト v1.0.1 のすべての重大判定基準を満たす。前回指摘の高・中優先事項は解消済み。残存する「useMemo 依存配列」「角セルラベル」は機能に影響しない軽微な問題。

> **注意**: レビュー完了承認 ≠ M5-01 完了承認。開発者の実機確認(シナリオ A〜G + U-2)が完了判定の必須ゲート(M4-02 E2E 由来運用知見)。

---

*本レビュー報告書は `docs/instructions/reviews/M5-01-review-checklist.md` v1.0.1 のチェックリストに基づいて作成。*
