# M6-03 機械レビュー報告書

## 1. レビュー実施日
2026-05-24

## 2. レビュー結果サマリ

- ✅ §1 ファイル一覧チェック（HomePage / Footer / useRecentCombos / useIsMobile / App.tsx 修正）
- ❌ §2 着手前確認結果（**progress-log に完了報告が存在しない**ため検証不可）
- ❌ §3 Plan Mode 必須項目 5 件（**progress-log に承認結果が存在しない**ため検証不可）
- ⚠️ §4 スマホ専用ホーム画面（ボタン 6 件・ロゴ・ローディング・エラー・0 件実装は適切。表示専用サブコンポーネント未分離の軽微違反）
- ✅ §5 スマホフッター（4 ボタン・中央「新規登録」大きめ・fixed 配置・sm:hidden による mobile-only）
- ✅ §6 アプリ起動時のリダイレクト分岐拡張（M6-02 既存挙動温存 + スマホ判定追加）
- ❌ §7 設計判断事項表との整合（progress-log 欠如のため整合確認結果が確認不可）
- ✅ §8 テスト要件（新規 21 件追加、全 377 件パス）
- ❌ §9 E2E シナリオ A〜F（progress-log 欠如のため実行結果が確認不可）
- ✅ §10 コード品質・規約遵守（camelCase・ハードコード禁止・shadcn/ui 未使用・型安全）
- ❌ §11 ドキュメント（**docs/progress/progress-log.md に M6-03 完了報告が存在しない**）

---

## 3. Plan Mode 必須項目 5 件の開発者承認結果確認（最重要）

`docs/progress/progress-log.md` に M6-03 完了報告が存在しないため、以下すべてが **コード実装から逆算した推定値** となる。承認結果の正式記録が確認できない。

| 必須項目 | 承認方針（推定）| 実装 | 一致判定 |
|---------|--------------|------|---------|
| 1 スマホ判定方式 | JS `useSyncExternalStore` + `window.matchMedia("(max-width: 639px)")` | `useIsMobile.ts` で同上 | 推定一致（承認記録なし） |
| 2 リダイレクト実装位置 | `App.tsx` グローバル判定 | `App.tsx` で実装 | 推定一致（承認記録なし） |
| 3 ホームのルート設計 | `/` 出し分け（スマホ: HomePage 表示、PC: `/combos` リダイレクト） | `App.tsx` + `router.tsx` で実装 | 推定一致（承認記録なし） |
| **4 スマホフッター配置方式（案 C 採用、最重要）** | **App.tsx 全画面共通配置（案 B）を承認** | `App.tsx` の `showFooter` で全画面（wizard 除く）に配置 | **要確認：Header は per-page 実装なのに Footer は App.tsx グローバル（案 B）を選択した根拠が progress-log に記載なし** |
| 5 「最近更新したコンボ」取得方式 | 既存 `GET /api/combos?sort=updated_at&order=desc&limit=3` を流用 | `useRecentCombos.ts` で同上 | 推定一致（承認記録なし） |

---

## 4. architecture-patterns.md v1.0.4 準拠確認（M6-1 反省再発防止の最重要観点）

### 4.1 §1 プレゼンテーション層/ロジック層分離パターン

- `HomePage` ロジック（`useRecentCombos` フック）の分離: ○
- `HomePage` 表示専用コンポーネントへの分離（主要機能ボタン 6 件リスト、最近コンボリスト）: **×（`HomePage.tsx` に JSX として直接記述、分離なし）**
  - 指示書 §4.1.2「主要機能ボタン 6 件 + 『最近更新したコンボ』リスト は表示専用コンポーネント、ロジックは `HomePage` から渡す」に未準拠
- `Footer` 表示専用・ロジック（active 状態判定）はコンポーネント内インライン関数: △（軽微、フックに切り出し不要な規模）

### 4.2 §1.1 queryKey 規約

- `useRecentCombos` の queryKey: `["combos", "recent"]`（combo 系 flat tuple 形式、`useTrashCombos` の `["combos", "trash", characterId]` と同形式）: ○
- URL パラメータを queryKey に使わないため number 正規化: N/A ○

---

## 5. ホーム + フッター + リダイレクト ↔ 既存実装実態の対応表確認（M6-3〜M6-6 反省踏襲、最重要）

- 製造担当の Plan Mode 計画提示に対応表 17 項目が完全に埋められているか: **× (progress-log が存在しない)**
- 未確認項目の有無: **不明（progress-log 欠如のため確認不可）**
- 「プリセット管理」ボタンの P-1 持ち越し状態 + disabled 化の対応が明記されているか: **× (progress-log が存在しない)**

ただし実装コードでは:
- ボタン 6 件すべて実装済み（コンボ一覧 / マイコンボ / 新規コンボ登録 / コンボ比較 / プリセット管理 / 設定）
- 「プリセット管理」は `enabled: false` + `tooltip: t("settings.presetLink.notImplemented")` = 「今後実装予定」で disabled 実装済み ○

---

## 6. 検出した問題

### 6.1 重大な問題（完了承認保留）

**[Critical-1] `docs/progress/progress-log.md` に M6-03 完了報告が存在しない**

- 判定根拠: §12「§11 progress-log.md 完了報告に必須項目が含まれていない」
- 影響範囲:
  - §7.4 ドキュメント要件（完了報告 + §3.4 着手前確認サマリ + Plan Mode 承認 5 件 + §4.4 設計判断表整合 + §5.2 E2E A〜F 手順書）がすべて未達
  - Plan Mode 必須項目 5 件の開発者承認記録が確認不可
  - §3.4.6 ホーム + フッター + リダイレクト ↔ 既存実装実態の対応表の Plan Mode 提示が確認不可
- 推奨対応: progress-log.md に M6-03 完了報告（§7.5 項目）を追記する

**[Critical-2] 案 C → 案 B 採用の根拠が記録なし（必須項目 4）**

- 判定根拠: §12「§3 必須項目 4（スマホフッター配置方式、案 C 採用）の Plan Mode 確定結果と実装が一致していない可能性」
- 詳細:
  - 指示書 §3.4.8 必須項目 4 の案 C は「既存 Header の配置方式に揃える」
  - 既存 Header: **各ページが独自に `<header>` 要素を実装（per-page 実装）** = Header が `App.tsx` に存在しない
  - 実際の実装: **Footer は `App.tsx` にグローバル配置（案 B）**
  - 案 C の論理: Header が per-page → 案 A（Footer も per-page）が理論上の整合
  - 実装が案 B を選択した理由・開発者の承認: progress-log に記録なし
  - ただし、実装上は `Footer.tsx` 自体の `sm:hidden` + `showFooter !== "/wizard"` で機能要件は満たされており、視覚的・機能的な問題は生じていない
- 推奨対応: progress-log に「Header が per-page 実装であることを確認、案 C の適用として案 B を開発者が承認した」旨を明記する

### 6.2 軽微な問題（完了承認可、改善推奨）

**[Minor-1] `HomePage.tsx` の表示専用サブコンポーネント未分離**

- 判定根拠: §13「§4 ホーム画面の UI 細部が DES-005 §5.2 と微妙に異なる（機能には影響なし）」に準じた軽微違反
- 詳細: 指示書 §4.1.2「主要機能ボタン 6 件 + 『最近更新したコンボ』リスト は表示専用コンポーネント、ロジックは `HomePage` から渡す」を満たさず、`HomePage.tsx` 内に JSX として直接記述
- ロジック分離（`useRecentCombos` フック）は正しく実施されているため機能上の問題なし
- 将来ファイルが大きくなった際のメンテナンス性の観点から M7 以降で分離を推奨

**[Minor-2] `Footer.tsx` の `isActive` が `/` を `/combos` のアクティブ状態として扱う**

- 詳細:
  ```typescript
  if (to === "/combos") {
    return location.pathname === "/combos" || location.pathname === "/";
  }
  ```
  ホーム画面（`/`）でコンボ一覧ボタンがハイライトされる
- 設計書に明示的な規定なし。ホーム画面では「どのフッターボタンもアクティブでない」方が自然な可能性がある
- 機能に影響なし、UX 上の設計判断

**[Minor-3] `Footer.tsx` が `sm:hidden` を使用（指示書例示は `md:hidden`）**

- 詳細: 指示書 §4.2.1 の例示は `md:hidden` だが、実装は `sm:hidden`
- ただし `sm:hidden`（640px 以上で非表示）の方が DES-005 §4.4「スマホ：～640px（sm未満）」定義に正確に合致しており、`sm:hidden` が設計意図に忠実
- `md:hidden` だとタブレット（641-767px）でも Footer が表示されてしまうため、`sm:hidden` の選択は合理的

**[Minor-4] `useRecentCombos` のパラメータが `sort=updated_at` (snake_case) を使用**

- 詳細: `GET /api/combos?sort=updated_at&order=desc&limit=3`
- API のクエリパラメータが `updated_at`（snake_case）であることは既存 `comboList.sort.updated_at` の i18n キーから確認できる（既存 API に倣った実装）
- 動作上の問題なし

### 6.3 改善提案（次回マイルストーン以降）

1. **テストヘルパ関数の共通化**: `HomePage.test.tsx` と `useRecentCombos.test.ts` の `mockFetchResponse` が重複定義。M7 または以降で `web/src/test-utils/` 等に切り出しを検討
2. **`App.tsx` の `showFooter` 条件の明示**: `location.pathname !== "/wizard"` のロジックが増えた場合（例: 他の full-screen ページ追加時）のメンテナンス性確保のため、将来的に配列管理を検討

---

## 7. 確認済み良好事項

- **`useIsMobile.ts` の `useSyncExternalStore` 実装**: SSR/ハイドレーション対応の安全な実装パターン（`getServerSnapshot` で false を返す）
- **App.test.tsx の包括的カバレッジ**: wizard リダイレクト優先、PC リダイレクト、モバイル非リダイレクト、footer 表示/非表示の全シナリオをテスト済み
- **Footer.test.tsx の詳細テスト**: `sm:hidden`・`aria-label`・active 状態・highlighted ボタンなどを包括的に検証
- **翻訳キーの ja/en 両ロケール追加**: `home.*` / `footer.*` キーが両ファイルに適切に追加済み
- **バックエンド変更なし**: handler / service / repository / model / migration / config すべて変更なしを確認
- **shadcn/ui 未使用**: playbook §17.2 遵守確認
- **下書き自動保存・プリセット管理画面・CHANGE 通知書・複数ユーザー認証 UI の未実装**: §1.3 スコープ外の管理が適切
- **全 377 テストパス**: 回帰なし確認

---

## 8. 制約事項

- 本レビューは静的コードレビュー。**実機テスト（ブラウザでの動作確認、スマホサイズでの表示確認、E2E シナリオ A〜F の実行、案 B 採用時の全画面共通フッター視覚確認、既存画面の回帰確認）は別途実施が必要**（playbook §14）
- 動作確認シナリオの手動確認は開発者の責任範囲

---

## 9. 完了承認判定

**❌ 完了承認保留（重大な問題あり）**

### 保留理由

1. **[Critical-1]** `docs/progress/progress-log.md` に M6-03 完了報告が存在しない（§7.4 / §7.5 / §11 要件未達、チェックリスト §12 判定基準該当）
2. **[Critical-2]** 案 C → 案 B 採用の根拠（Header が per-page 実装であることの確認 + 開発者承認）が progress-log に記録されていない（チェックリスト §12「Plan Mode 必須項目 4 の確定結果と実装の一致確認不可」）

### 承認条件

以下が完了すれば承認可:
1. `docs/progress/progress-log.md` に M6-03 完了報告を追記（§7.5 の全必須項目含む: 着手前確認サマリ + 対応表 + Plan Mode 5 件承認結果 + 設計判断整合 + E2E A〜F 実行結果 + 例外条項適用箇所）
2. 必須項目 4（Footer 配置方式）について「Header が per-page 実装であることを §3.4.2 着手前確認で確認し、案 B 採用を開発者が Plan Mode で承認した」旨を完了報告に明記

### 実装品質について

コード実装自体の品質は高く、機能要件・テスト要件はほぼ満たされている。progress-log の補完後、速やかに承認可能な状態。
