# 指示書 M2-04: 統合・仕上げ(notes 表示、持ち越し課題消化、M2 全体 E2E)

| 項目 | 内容 |
|------|------|
| 指示書ID | M2-04 |
| バージョン | 1.0.0 |
| 対象マイルストーン | M2(編集系の本格化) |
| 推奨モデル | **Opus 4.6** |
| Plan Mode | **必須**(複数の関心が絡む統合タスクのため、計画提示で開発者と認識合わせ) |
| 機械レビュー | **必須**(別チェックリスト: `docs/instructions/reviews/M2-04-review-checklist.md`、レビューモデル: Sonnet 4.6) |
| 並列性 | **単独**(M2 は完全直列、M2-03 完了が前提、M2 最後の指示書) |
| 依存指示書 | M2-01 / M2-02 / M2-03(本指示書はこれらの統合と仕上げ)、M1-04(`resolver.go` の `resolveStep` を修正)、M1-05(`ComboDetailRecipe.tsx` の現状確認)、M1-06(`RecipeBuilder.tsx` の draftNotes 修正) |
| 想定所要時間 | 90〜120 分(スコープ拡大により当初見込み 60〜90 分から増加) |
| 作成者 | 詳細設計・製造準備担当Claude(M2 期間担当) |
| 作成日 | 2026-05-07 |

## 更新履歴

| バージョン | 更新日 | 更新内容 |
|-----------|--------|----------|
| 1.0.0 | 2026-05-07 | 初版作成 |

---

## 1. 背景と目的

### 1.1 背景

M2-01〜M2-03 で M2 の編集系機能の主要部分が完成した:

- M2-01: レバーレス仮想コントローラ・modifiers 編集 UI
- M2-02: コピー機能・リアルタイム重複検知・本登録昇格・PUT 確認ダイアログ
- M2-03: ゴミ箱画面・完全削除・only_deleted フィルタ

しかし以下が M2 全体の仕上げとして残っている:

- **modifiers.notes の表示処理未実装**(m1-known-limitations.md): 入力・保存は動作するが、レシピ表示で notes が見えない
- **M2-01 の draftNotes 50文字超警告未実装**(M2-01 連絡事項1): RecipeBuilder の技セレクタ経由ステップ追加で notes 入力欄に警告がない
- **M2-03 の DOM 不正ネスト問題**(M2-03 連絡事項1): PermanentDeleteConfirm が `<tbody>` の子になり警告発生
- **M2-03 の Link/onClick 二重発火問題**(M2-03 連絡事項2): TrashListRow の始動状況セルでブラウザ履歴二重登録の可能性
- **M2-03 の個別行操作のサイレント失敗**(M2-03 連絡事項3): 復元・完全削除失敗時にユーザーフィードバックなし
- **M2 全体の統合 E2E 動作確認**: 各サブマイルストーンを跨ぐシナリオ(登録→コピー→編集→ゴミ箱→復元→詳細表示)の動作確認

### 1.2 目的

- modifiers.notes の表示処理を実装し、コンボ詳細画面・コンボ一覧画面の両方で notes が表示される状態にする(SUPP-001 §3.3.4 括弧付きインライン表示)
- M2-01 / M2-03 で持ち越された5件の課題を統合的に消化する
- M2 全体の統合 E2E 動作確認を実施し、M2 完了の判定根拠を整える
- progress-log.md の既知制限事項リストを更新し、M2 で解消したものを記録する

### 1.3 このマイルストーンで作らないもの

- 新規機能の追加(本指示書は仕上げに専念、新規スコープは追加しない)
- セットプレイ関連(M4 で実装)
- マイコンボ機能(M3 で実装)
- パフォーマンス最適化(性能問題が顕在化していないため、フェーズ2以降)
- トーストライブラリ導入(useState による行内エラー表示で対応、外部依存追加なし、開発者判断確定済み)
- 一括操作(復元・完全削除)の専用 API(M2-03 と同方針で単体 API 並列呼出のまま)
- knockdown_advantage 変更時のセットプレイ引き継ぎ確認モーダル(M4 で実装、M2-02 §4.4.4 の TODO コメントは保持)
- m1-known-limitations.md のような独立ファイルの新規作成(progress-log.md 統合継続、開発者方針確定済み)

---

## 2. 成果物

### 2.1 作成するファイル

本指示書では新規ファイル作成は最小限。主に既存ファイルへの修正で対応する。

### 2.2 修正するファイル

#### バックエンド

| ファイル | 修正内容 | 関連課題 |
|---------|---------|---------|
| `internal/service/notation/resolver.go`(または同等) | `resolveStep` 関数に `modifiers.notes` を出力テキストに括弧付きで挿入する処理を追加(SUPP-001 §3.3.4 括弧付きインライン形式) | notes 表示 |
| `internal/service/notation/resolver_test.go` | notes 含むステップの変換テストを追加 | notes 表示 |

#### フロントエンド

| ファイル | 修正内容 | 関連課題 |
|---------|---------|---------|
| `web/src/features/combo/components/RecipeBuilder.tsx` | 技セレクタ経由ステップ追加の draftNotes 入力欄に50文字超警告クラス付与処理を追加(ModifiersEditor と同パターン) | M2-01 連絡事項1 |
| `web/src/features/combo/components/PermanentDeleteConfirm.tsx` | `createPortal` で `document.body` 直下にレンダリングする実装に変更 | M2-03 連絡事項1 |
| `web/src/features/combo/components/PutConfirmDialog.tsx`(M2-02 で作成済み) | 同様に `createPortal` 化(統一パターン適用) | 共通モーダルパターンの整備 |
| `web/src/features/combo/components/TrashListRow.tsx` | 始動状況セルの `<td>` に `stopPropagation` を追加(または `<Link>` を取り除いて `<tr onClick>` に一本化、製造担当判断) | M2-03 連絡事項2 |
| `web/src/features/combo/components/TrashListRow.tsx` | 個別行の復元・完全削除失敗時のエラー表示を `useState` で行内表示(`role="alert"`、TrashBulkActions と同パターン) | M2-03 連絡事項3 |
| `web/src/features/combo/components/ComboDetailRecipe.tsx` | **原則変更不要**(後述 §4.1.3 参照)。レシピテキスト取得は `GET /api/combos/:id/recipe?preset_id=X` 経由で resolver.go の出力をそのまま表示、resolver.go 側で notes が組み込まれれば自動的に表示される。万一 ComboDetailRecipe.tsx で notes を別途レンダリングしている場合は重複表示になるため確認・調整 | notes 表示 |

#### ドキュメント

| ファイル | 修正内容 |
|---------|---------|
| `docs/progress/progress-log.md` | 「M1 完了時点の既知の制限事項」セクションの notes 表示未実装項目に **「M2-04 で解消済み」を追記**。M2-04 完了報告セクションを追加(M2-02 / M2-03 と同形式) |

### 2.3 変更しないもの(原則)

- M1-03 の既存 API(POST/GET/PATCH/PUT/DELETE/restore、M2-02 で追加された check-duplicate、M2-03 で追加された permanent)の振る舞い
- M1-04 の `RecomputeComboCache` / `DeleteComboCache` / `ResolveComboRecipe` のメソッド実装(`resolveStep` への notes 追加は §2.4 例外で許容、それ以外は変更しない)
- M1-05 のコンボ一覧・詳細画面のレイアウト(ComboDetailRecipe.tsx は §2.2 のとおり原則変更不要)
- M1-06 の ComboEditorBasicFields / ValidationDisplay / DuplicateWarning / hasKeyChanges / ModifiersEditor 関連
- M2-01 の VirtualController 配下、ModifiersEditor.tsx の本体ロジック
- M2-02 の重複検知 API、コピー機能、本登録昇格、PutConfirmDialog の本体ロジック(createPortal 化は §2.4 例外で許容)
- M2-03 のゴミ箱画面の主要ロジック、完全削除 API、only_deleted フィルタ、PermanentDeleteConfirm の本体ロジック(createPortal 化と TrashListRow の修正は §2.4 例外で許容)
- 既存マイグレーション(本指示書では DB スキーマ変更なし)

### 2.4 例外: 既存実装への最小限の変更が許容される箇所

本指示書のスコープに以下の修正を含む。これら以外の既存実装変更は禁止する。

#### 2.4.1 resolver.go の resolveStep 拡張(notes 表示)

`resolveStep` 関数に modifiers.notes を出力に含める処理を追加する。これは **未実装機能の追加** であり、既存の振る舞いを破壊しない(notes が空文字列の場合は従来挙動と同一)。詳細は §4.1 参照。

#### 2.4.2 PermanentDeleteConfirm / PutConfirmDialog の createPortal 化

DOM 不正ネスト解消(M2-03 連絡事項1)のため、両モーダルを `createPortal` で `document.body` 直下にレンダリングする実装に変更する。表示・キャンセル・確認の挙動・スタイルは変更しない(レンダリング先のみ変更)。

#### 2.4.3 TrashListRow の修正

- 始動状況セルの二重発火対策(M2-03 連絡事項2): `<td>` への `stopPropagation` 追加、または `<Link>` 削除のいずれか
- 個別行の復元・完全削除失敗時のエラー表示(M2-03 連絡事項3): useState による行内エラー表示

#### 2.4.4 RecipeBuilder の draftNotes 警告

技セレクタ経由ステップ追加の draftNotes 入力欄に50文字超警告クラス付与処理を追加(M2-01 連絡事項1)。ModifiersEditor の notes 警告と同パターン。

#### 2.4.5 それ以外の変更禁止

新規 API の追加、既存 API の振る舞い変更、サービス層メソッドの新規追加、リポジトリ層の構造体フィールド追加、マイグレーションの追加・変更は本指示書のスコープ外。万一実装中にこれらが必要と判断した場合、Plan Mode で停止して開発者に相談すること。

---

## 3. 前提条件

### 3.1 必読ドキュメント

- `CLAUDE.md`(全体方針、§8 矛盾検出時の停止ルール)
- `docs/instructions/M2-overview.md`(M2 全体像、§6 運用ルール)
- `docs/design/supp-001-detailed-design.md`(設計補足):
  - **§3.3.4** modifiers.notes の用途・表示方針(本指示書の中核、括弧付きインライン形式採用、M2-overview §3.4 で確定済み)
- `docs/design/04-notation-spec.md`:
  - **§5** エイリアス変換(resolver.go の責務範囲)
- `docs/instructions/M1-04-presets-and-recipe-cache.md`:
  - **§4.2** エイリアス変換アルゴリズム(`resolver.go`、本指示書の修正対象)
  - **§4.2.1** 単一ステップの変換(`resolveStep`、本指示書はこれに notes 処理を追加)
  - **§4.3.1** ResolveComboRecipe(変更しないが、resolver.go 修正の影響範囲確認用)
- `docs/instructions/M1-05-combo-list-detail-pages.md`:
  - **§4.2 / §4.2.2** ComboDetailRecipe.tsx の実装方針(本指示書では原則変更不要、recipe_cache 経由でテキスト取得)
- `docs/instructions/M1-06-combo-editor-page.md`:
  - **§4.3** RecipeBuilder の現状実装(本指示書はこれに draftNotes 警告追加)
- `docs/instructions/M2-01-virtual-controller-and-modifiers.md`:
  - **§4.6** ModifiersEditor の notes 警告実装(本指示書の draftNotes 警告で同パターンを再利用)
- `docs/instructions/M2-02-edit-ux-improvements.md`:
  - **§4.4** PutConfirmDialog の現状実装(本指示書で createPortal 化)
- `docs/instructions/M2-03-trash-page.md`:
  - **§4.5** TrashListRow の現状実装(本指示書で二重発火対策・行内エラー表示追加)
  - **§4.8** PermanentDeleteConfirm の現状実装(本指示書で createPortal 化)
- `docs/progress/progress-log.md`:
  - 「M1 完了時点の既知の制限事項」セクション(notes 表示未実装の項目を解消済みに更新)

### 3.2 任意参照

- `docs/design/05-screen-design.md` §5.6(コンボ詳細画面のレシピ表示エリア仕様)
- `docs/design/03-data-model.md` §3.5(combo_steps テーブル、modifiers JSON カラム)

### 3.3 参照不要

- DES-002 アーキテクチャ設計書、DES-006 バリデーション設計書
- M1-01 / M1-02 / M1-03 / M1-07 指示書(本指示書のスコープと直接関わらない)

### 3.4 着手前の確認

製造担当 Claude Code は本指示書 §4 の実装に着手する前に、以下を確認する。**結果を Plan Mode で開発者に報告すること**。

#### 3.4.1 resolver.go の現状確認

`internal/service/notation/resolver.go`(または同等)を確認:

- [ ] `resolveStep` 関数の実装内容を読む
- [ ] modifiers.flags の処理が `{ }` 付きで実装されていることを確認(M1-04 §4.2.1)
- [ ] modifiers.notes の処理が **未実装** であることを確認(m1-known-limitations.md と整合)
- [ ] notes 追加後の出力フォーマット案(§4.1)が現状の flags 処理と整合可能であることを確認

#### 3.4.2 ComboDetailRecipe.tsx の現状確認

`web/src/features/combo/components/ComboDetailRecipe.tsx` を確認:

- [ ] レシピ取得が `GET /api/combos/:id/recipe?preset_id=X` 経由のテキストかどうか確認(M1-05 §4.2.2 の方針通り実装されていることが確認できた場合、本指示書では ComboDetailRecipe.tsx の変更は不要)
- [ ] テキストではなく `combo.steps` から動的レンダリングしている場合は、notes 表示の責任が ComboDetailRecipe.tsx 側にもある可能性。Plan Mode で報告し、対応方針を確定する

#### 3.4.3 各持ち越し課題の対象ファイル現状確認

- [ ] `RecipeBuilder.tsx` line 209-216 付近の draftNotes 入力欄を確認(M2-01 連絡事項1 で指摘された箇所)
- [ ] `TrashListRow.tsx` の `<tr onClick>` と始動状況セルの `<Link>` の現状確認(M2-03 連絡事項2)
- [ ] `TrashListRow.tsx` の `handleRestore` / `handlePermanentDelete` のエラーハンドリング現状確認(M2-03 連絡事項3)
- [ ] `PermanentDeleteConfirm.tsx` / `PutConfirmDialog.tsx` の現状実装(モーダル本体のレンダリング箇所、createPortal 化の影響範囲)

#### 3.4.4 progress-log.md の現状確認

- [ ] `docs/progress/progress-log.md` の「M1 完了時点の既知の制限事項」セクションの notes 表示未実装項目の現状を確認(M2-04 完了時に「解消済み」を追記する箇所の特定)

これらの確認結果を Plan Mode で開発者に報告すること。

---

## 4. 詳細仕様

### 4.1 modifiers.notes 表示処理(resolver.go 拡張)

#### 4.1.1 設計方針

SUPP-001 §3.3.4 の例 `立ち弱P > 立ち中P (目押し1F) > 中波動拳` のとおり、**括弧付きインライン形式** で notes を出力テキストに組み込む。M2-overview §3.4 で確定済みの方針。

責任分界点:

- **resolver.go(notation サービス)が notes を出力テキストに組み込む** ← 本指示書の中核
- **ComboDetailRecipe.tsx は変更不要**(レシピテキストは `GET /api/combos/:id/recipe?preset_id=X` 経由で取得しており、resolver.go の出力をそのまま表示するため)
- 副次効果として、recipe_cache にも notes が含まれる(コンボ一覧画面でルート列を表示する場合も notes が見える、§4.1.4 参照)

#### 4.1.2 resolveStep の修正方針

M1-04 §4.2.1 の `resolveStep` 関数に notes 処理を追加する。

修正前(現状、想定):

```go
// 1. 通常step or 非技step の base text を組み立て
// 2. modifiers.flags が空でない場合は各flagを { } で囲んで付加
//    例: stand_light_punch + flags=["link"] → "立ち弱P{目押し}"
// 3. 最終テキストを返す
```

修正後:

```go
// 1. 通常step or 非技step の base text を組み立て
// 2. modifiers.flags が空でない場合は各flagを { } で囲んで付加
// 3. modifiers.notes が空でない場合は ( ) で囲んで付加  ← 追加
//    例: stand_light_punch + flags=["link"] + notes="目押し1F" → "立ち弱P{目押し}(目押し1F)"
// 4. 最終テキストを返す
```

#### 4.1.3 notes 出力フォーマットの詳細

- **書式**: `(notes 内容)` の半角丸括弧でステップテキストの末尾に付加
- **flags との順序**: flags が先(`{ }`)、notes が後(`( )`)。理由: flags は技の変種(変調)、notes は補助情報という性質の違いを括弧種類で表現
- **空の場合**: `notes == ""` または欠落時は何も追加しない(従来挙動と完全一致、後方互換)
- **notes 内に括弧文字が含まれる場合**: そのまま出力する(エスケープ処理は行わない、運用上の注意で十分。文字数50字以内で括弧多用は想定外)

例:

| ステップ内容 | flags | notes | 出力 |
|------------|-------|-------|------|
| stand_light_punch | (なし) | (なし) | `立ち弱P` |
| stand_light_punch | `["link"]` | (なし) | `立ち弱P{目押し}` |
| stand_light_punch | (なし) | `"目押し1F"` | `立ち弱P(目押し1F)` |
| stand_light_punch | `["link"]` | `"目押し1F"` | `立ち弱P{目押し}(目押し1F)` |
| (非技) parry_drive_rush | (なし) | `"ヒット確認"` | `パリィDR(ヒット確認)` |

連結子(` > `)はステップ間で従来通り使用。フルレシピ例:

```
立ち弱P{目押し}(目押し1F) > 立ち中P > 中波動拳(ヒット確認推奨)
```

#### 4.1.4 recipe_cache への影響

resolver.go の `resolveStep` を修正することで、`resolveRecipe`(レシピ全体の組み立て、M1-04 §4.2.3)の出力にも notes が含まれる。これにより:

- `RecomputeComboCache`(M1-04 §4.3.2、コンボ作成・編集時に呼ばれる)の出力に notes が反映
- `ResolveComboRecipe`(M1-04 §4.3.1、UI表示時の遅延計算)の出力にも notes が反映
- 既存の recipe_cache(notes なしで生成されたキャッシュ)は次回の編集時または明示的な再計算時に更新される
- **既存の recipe_cache を一括再計算する処理は本指示書では実装しない**(運用上、既存コンボに notes が無いため影響なし。将来 notes 入りコンボが増えたら設定画面の「レシピキャッシュ再構築ボタン」DES-005 §5.16 で対応、これは M7 以降)

#### 4.1.5 既存テストへの影響

- resolver_test.go の既存テスト(notes なし)は引き続きパスする(notes が空の場合は従来挙動と同一)
- 新規追加: notes 含むステップの変換テスト(§5.1.1 参照)

### 4.2 RecipeBuilder の draftNotes 50文字超警告(M2-01 連絡事項1)

#### 4.2.1 修正対象

`web/src/features/combo/components/RecipeBuilder.tsx` の技セレクタ経由ステップ追加エリア内、draftNotes 入力欄(`<input type="text" maxLength={200} />`、line 209-216 付近、§3.4.3 で確認済み)。

#### 4.2.2 修正内容

ModifiersEditor の notes 警告実装(M2-01 §4.6.2、50文字超で `border-red` クラス付与)と同パターンを RecipeBuilder にも適用する。

```tsx
// 修正前(想定)
<input
  type="text"
  maxLength={200}
  value={draftNotes}
  onChange={(e) => setDraftNotes(e.target.value)}
/>

// 修正後
<input
  type="text"
  maxLength={200}
  value={draftNotes}
  onChange={(e) => setDraftNotes(e.target.value)}
  className={draftNotes.length > 50 ? "border-red-500" : "border-gray-300"}
/>
```

クラス名は ModifiersEditor の既存実装に揃える(製造担当が ModifiersEditor の実装を確認して同じクラスを使用)。

### 4.3 PermanentDeleteConfirm / PutConfirmDialog の createPortal 化(M2-03 連絡事項1)

#### 4.3.1 修正方針

両モーダルを `createPortal` で `document.body` 直下にレンダリングする。Reactの`createPortal` API 標準の使い方。

```tsx
// 修正前(想定、PermanentDeleteConfirm の場合)
export function PermanentDeleteConfirm({ isOpen, count, onConfirm, onCancel }: Props) {
  if (!isOpen) return null;
  return (
    <div role="dialog" aria-labelledby="...">
      {/* モーダル内容 */}
    </div>
  );
}

// 修正後
import { createPortal } from "react-dom";

export function PermanentDeleteConfirm({ isOpen, count, onConfirm, onCancel }: Props) {
  if (!isOpen) return null;
  return createPortal(
    <div role="dialog" aria-labelledby="...">
      {/* モーダル内容 */}
    </div>,
    document.body
  );
}
```

#### 4.3.2 PutConfirmDialog にも適用する理由

M2-02 で実装された `PutConfirmDialog` も同じく `<tbody>` の子になる可能性がある(コンボ編集画面のフォーム内に配置されている場合)。M2-03 で発覚した DOM 不正ネストは PutConfirmDialog でも潜在的に発生し得る。共通モーダルパターンを揃える意味で、本指示書のスコープで両方に適用する。

製造担当が現状確認(§3.4.3)で PutConfirmDialog の配置場所を確認し、`<tbody>` 等の問題のある親要素の子になっていない場合でも、createPortal 化は予防的措置として推奨する(将来的な配置変更時のリスク低減)。

#### 4.3.3 既存テストへの影響

createPortal でレンダリング先が変わるため、testing-library のクエリは引き続き動作する(`screen.getByRole("dialog")` 等は document 全体を探索する)。ただし、特定の親要素を期待するテストがある場合は修正が必要(製造担当が既存テストを確認)。

### 4.4 TrashListRow の修正(M2-03 連絡事項2 / 3)

#### 4.4.1 始動状況セルの二重発火対策

`web/src/features/combo/components/TrashListRow.tsx` の始動状況セル `<td>` で、`<Link>` の遷移と `<tr onClick>` の `useNavigate` が二重発火する問題への対応。

選択肢2つ:

**案A**: `<td>` に `stopPropagation` を追加(`<Link>` を残す)

```tsx
<td onClick={(e) => e.stopPropagation()}>
  <Link to={`/combos/${combo.id}`}>...</Link>
</td>
```

メリット: アクセシビリティ(右クリックで「新規タブで開く」可能)を維持

**案B**: `<Link>` を取り除いて `<tr onClick>` に一本化

```tsx
<td>
  {/* Link 削除、テキストのみ */}
  {starterText}
</td>
```

メリット: シンプル、二重発火の根本解消

**製造担当判断**: いずれかを選択し、判断根拠を実装完了報告で明示する。同様の処理を必要とするセル(タグ列など、「クリックで遷移したくない要素を含むセル」)が存在する場合は、同じパターンで統一すること。

#### 4.4.2 個別行の復元・完全削除失敗時のエラー表示(useState 行内表示)

`handleRestore` / `handlePermanentDelete` で `mutateAsync` が throw した場合のエラーフィードバックを実装。

```tsx
const [rowError, setRowError] = useState<string | null>(null);

const handleRestore = async () => {
  setRowError(null);
  try {
    await restoreApi.mutateAsync(combo.id);
    onComboChanged();
  } catch (error) {
    setRowError(`復元に失敗しました: ${error instanceof Error ? error.message : String(error)}`);
  }
};

const handlePermanentDelete = async () => {
  setRowError(null);
  try {
    await permanentDeleteApi.mutateAsync(combo.id);
    onComboChanged();
  } catch (error) {
    setRowError(`完全削除に失敗しました: ${error instanceof Error ? error.message : String(error)}`);
  }
};

// レンダリング側に追加
{rowError && (
  <tr>
    <td colSpan={/* 適切な列数 */}>
      <div role="alert" className="text-red-600 text-sm">{rowError}</div>
    </td>
  </tr>
)}
```

実装の詳細は製造担当が決定。重要なのは:
- `role="alert"` を付けてアクセシビリティ確保
- TrashBulkActions の既存エラー表示パターン(`role="alert"`、M2-03 §4.7.1)と整合
- エラーメッセージは行内またはトースト風(画面外部出さない)で表示

#### 4.4.3 トーストライブラリは導入しない

開発者判断確定: 外部依存を増やさない方針。useState による行内表示で十分。トースト導入は将来 M3 以降の UI 共通基盤整備時に検討する。

### 4.5 progress-log.md の更新

#### 4.5.1 既知制限事項のクローズ

`docs/progress/progress-log.md` の「M1 完了時点の既知の制限事項」セクションの **modifiers.notes の表示処理が未実装** の項目に、解消した旨を追記する。

例:

```markdown
### modifiers.notes の表示処理が未実装

**~~未実装~~ → M2-04 で解消済み(2026-XX-XX)**

(以下、既存の記述は維持)

...

**M2-04 での対応:**

- resolver.go の resolveStep に notes 出力処理を追加(SUPP-001 §3.3.4 括弧付きインライン形式)
- ComboDetailRecipe.tsx は変更不要(GET /api/combos/:id/recipe 経由でテキスト取得しているため、resolver.go 修正で自動的に notes が表示される)
- 副次効果として、コンボ一覧画面のルート列でも notes が見える
```

「~~取り消し線~~」または「※M2-04 で解消済み」等、見出しレベルで解消が明示される表記を選択する(製造担当判断)。

#### 4.5.2 M2-04 完了報告セクションの追加

M2-02 / M2-03 と同形式で M2-04 完了報告を progress-log.md に追記。最低限以下を含める:

- 実装内容のサマリ(notes 表示、5件の持ち越し課題消化、M2 全体 E2E)
- §5.2 の E2E シナリオ実行結果
- §3.4 の Plan Mode 確認結果(resolver.go・ComboDetailRecipe.tsx の現状、各持ち越し課題対象ファイルの現状)
- M2 全体の完了宣言

#### 4.5.3 M2-04 完了時点の既知の制限事項

新規発生した既知制限事項が **存在する場合のみ** 「## M2-04 完了時点の既知の制限事項」セクションを追加。存在しない場合は空セクションを作らない(M2-02 / M2-03 と同方針、開発者運用ルール)。独立ファイル(`m2-04-known-limitations.md` 等)は新規作成しない。

#### 4.5.4 持ち越し課題の継承確認

M2-01 / M2-02 で記録された持ち越し課題のうち、**M2-04 で解消されたもの**は progress-log.md で解消済み記録、**M3 以降に持ち越すもの**は記載を維持する:

| 出処 | 課題 | M2-04 での扱い |
|------|------|--------------|
| M2-01 連絡事項1 | RecipeBuilder の draftNotes 50文字超警告 | **§4.2 で解消** |
| M2-01 連絡事項2 | console.warn テストの追加 | M2-04 では扱わない、M3 以降に持ち越し記録維持 |
| M2-02 連絡事項1 | useCharacters フック実装時の差し替え(TODO 残置) | **M3 で対応**、TODO コメントを progress-log で記録維持 |
| M2-02 連絡事項2 | 重複警告リンクの新規タブ開き | **M7 で対応**、記録維持 |
| M2-02 連絡事項3 | useCheckDuplicate の setIsLoading タイミング | **M7 で対応**、記録維持 |
| M2-03 連絡事項1 | PermanentDeleteConfirm の createPortal 化 | **§4.3 で解消** |
| M2-03 連絡事項2 | TrashListRow の二重発火対策 | **§4.4.1 で解消** |
| M2-03 連絡事項3 | 個別行の復元・完全削除失敗時のエラー表示 | **§4.4.2 で解消** |

---

## 5. テスト要件

### 5.1 必須テスト

#### 5.1.1 バックエンド(Go test)

`internal/service/notation/resolver_test.go` への追加:

- 正常系(notes のみ): notes が `( )` で出力に含まれる
- 正常系(flags + notes): flags が先 `{ }`、notes が後 `( )` の順序で出力
- 正常系(notes 空文字列): 従来挙動と同一(notes が出力に含まれない)
- 正常系(非技ステップ + notes): `parry_drive_rush` 等でも notes が出力に含まれる
- 既存テストが全通過(リグレッションなし)

#### 5.1.2 フロントエンド(Vitest + React Testing Library)

`RecipeBuilder.test.tsx` への追加(または新規):

- draftNotes 50文字以下でクラスが `border-gray-300`(または同等)
- draftNotes 50文字超でクラスが `border-red-500`(または同等)

`PermanentDeleteConfirm.test.tsx` の修正(createPortal 化):

- createPortal 化後も `screen.getByRole("dialog")` で取得できる
- 既存テストが引き続き全通過

`PutConfirmDialog.test.tsx` の修正(createPortal 化):

- 同上

`TrashListRow.test.tsx` の修正(二重発火対策・エラー表示):

- 始動状況セルクリックで遷移が1回のみ発火する(navigate モックで呼出回数検証)
- 復元失敗時にエラーメッセージが行内表示される(`role="alert"`)
- 完全削除失敗時にエラーメッセージが行内表示される(`role="alert"`)
- 成功時はエラー表示が出ない

### 5.2 E2E シナリオ(開発者がブラウザで手動実行)

製造担当 Claude Code は **動作確認手順書** として以下を実装完了報告に含める。開発者がブラウザで以下を実行して動作確認する。

```
## E2E シナリオ A: notes 表示(SUPP-001 §3.3.4)

1. /combos/new で新規コンボ作成、ステップに notes("目押し1F")を入力して保存
2. コンボ詳細画面でレシピ表示を確認 → "立ち中P(目押し1F)" のように表示される
3. プリセット切替で他のプリセットでも notes が表示されることを確認
4. ターミナルで以下を実行:
   curl 'http://localhost:47318/api/combos/<id>/recipe?preset_id=1' | jq
   → "text" に notes 入りのテキストが含まれる
5. コンボ一覧画面に戻り、ルート列で notes 入りテキストが表示されることを確認

## E2E シナリオ B: draftNotes 50文字超警告

1. コンボ編集画面で技セレクタ経由でステップを追加
2. notes 入力欄に 50文字以下を入力 → 通常の枠色
3. 51文字以上を入力 → 赤い枠色(警告)
4. 保存して、保存ラウンドトリップが正常動作することを確認(警告は UI のみ、保存は許可される)

## E2E シナリオ C: モーダルの DOM 整合性

1. ゴミ箱画面で完全削除ボタンクリック → PermanentDeleteConfirm 表示
2. ブラウザの開発者ツールで DOM を確認 → モーダルが document.body 直下に配置されている
3. 同じくコンボ編集画面で PUT 編集を試行 → PutConfirmDialog が body 直下に配置されている
4. ESC キー・背景クリックでキャンセル動作することを確認(挙動は M2-02 / M2-03 と同じ)

## E2E シナリオ D: TrashListRow の二重発火対策

1. ゴミ箱画面で行の始動状況セルをクリック
2. ブラウザの戻るボタンでゴミ箱画面に戻る → 1回の戻る操作でゴミ箱画面に戻る(履歴が二重登録されていない)
3. 始動状況セル以外(タグ列など)をクリックでも同様に動作

## E2E シナリオ E: 個別行のエラー表示

1. バックエンドサーバーを停止する(または存在しない ID にアクセスする状況を意図的に作る)
2. ゴミ箱画面で復元ボタンクリック → 行内にエラーメッセージが表示される(role="alert")
3. 同じく完全削除ボタンクリック → 行内にエラーメッセージが表示される
4. バックエンドを復活させて再操作 → 成功し、エラー表示が消える

## E2E シナリオ F: M2 全体の統合 E2E(中核確認)

1. 新規コンボ作成(レバーレス UI でレシピ入力、modifiers 編集 UI で notes 入力、本登録)
2. コンボ一覧で当該コンボのルート列に notes 入りテキストが表示される
3. コンボ詳細を表示、notes が括弧付きで表示
4. コピー機能で当該コンボをコピー → 入力中にリアルタイム重複検知バナー表示
5. メモを変更してコピー保存(POST 経由)
6. 元コンボを編集モードで開き、レシピを変更 → PUT 確認ダイアログ → 続行
7. 旧コンボがゴミ箱に移動、新コンボが本登録
8. ゴミ箱画面で旧コンボを確認、復元ボタンクリック
9. 復元後、コンボ一覧でレシピ・notes が正常表示(recipe_cache 再計算済み)
10. ゴミ箱画面で残ったコンボを完全削除
11. すべての E2E が一貫してエラーなく動作する
```

開発者は上記6シナリオを実行して動作確認する。製造担当が実装完了報告に「動作確認手順書」として上記シナリオを再掲する。

---

## 6. レビュー観点(別ファイル参照)

製造担当 Claude は本節を読む必要はない。

レビュー観点は以下の別ファイルに分離されている:

- **`docs/instructions/reviews/M2-04-review-checklist.md`**(レビューモデル: Sonnet 4.6)

---

## 7. 完了条件(Definition of Done)

### 7.1 機能要件

- [ ] §3.4 の Plan Mode 確認結果(resolver.go・ComboDetailRecipe.tsx・各持ち越し課題対象ファイル・progress-log.md の現状)が報告されている
- [ ] §2.2 の修正ファイルが全て修正されている
- [ ] §5.1 の必須テスト(Go test、Vitest)が全通過する
- [ ] §5.2 の E2E シナリオ A〜F が動作する(動作確認手順書として実装完了報告に再掲)
- [ ] progress-log.md の M1 既知制限事項の notes 項目が「解消済み」に更新されている
- [ ] progress-log.md に M2-04 完了報告セクションが追加されている

### 7.2 自己テスト結果(製造担当の責任範囲)

#### バックエンド側

- [ ] `make test` または `go test ./...` が全通過する
- [ ] `curl 'http://localhost:47318/api/combos/<id>/recipe?preset_id=1' | jq` で notes 入りレシピテキストを実装完了報告に貼付
- [ ] notes 空文字列のコンボでも従来挙動と同一(notes が出力に出ない)ことを curl で確認

#### フロントエンド側

- [ ] `pnpm test`(Vitest)が全通過する
- [ ] `pnpm build` が成功する
- [ ] TypeScript の型エラーが残っていない(`pnpm tsc --noEmit` で確認)
- [ ] 開発サーバー起動時にコンソール警告が新規発生していない(特に M2-03 で発生していた `<tbody>` 不正ネスト警告が消えていることを確認)
- [ ] §5.2 の動作確認手順書を実装完了報告に再掲

ブラウザでの実機動作確認・スクリーンショット取得は **開発者の責任範囲** であり、製造担当は実行しない(M2-overview §6.5.2)。

### 7.3 品質チェック

- [ ] CLAUDE.md の禁止事項に抵触していない(localStorage 使用なし、git 操作なし、外部ライブラリ追加なし 等)
- [ ] `console.log` を本番コードに残していない(`console.warn` は notes 関連で必要なら許容)
- [ ] 設計書本体(SUPP-001 §3.3.4、DES-004 §5)と実装が一致している。差異がある場合は CHANGE 起票を提案する
- [ ] M1-04 の resolver.go の既存挙動(flags 処理など)が変更されていない、または変更があっても挙動を変えていない
- [ ] M1-05 / M1-06 / M2-01 / M2-02 / M2-03 の既存挙動が破壊されていない
- [ ] notes が空文字列の既存コンボの recipe_cache が、本指示書の修正によって変化していない(後方互換)

### 7.4 ドキュメント

- [ ] `docs/progress/progress-log.md` の更新(§7.1 / §4.5 参照)

### 7.5 完了報告

- [ ] 開発者に「M2-04 が完了しました」「M2 全体が完了しました」と報告する
- [ ] §7.2 の自己テスト結果と §5.2 の動作確認手順書を報告に含める
- [ ] レビュー担当(別 Claude Code セッション)へ §6 のチェックリストファイルを案内する

---

## 8. 参照ドキュメント

| ID | パス | 参照箇所 |
|----|------|----------|
| CLAUDE.md | `CLAUDE.md` | 全体方針、§8 矛盾検出時の停止ルール |
| M2-overview | `docs/instructions/M2-overview.md` | M2 全体像、§6 運用ルール、§3.4 で確定した notes 表示形式 |
| SUPP-001 | `docs/design/supp-001-detailed-design.md` | §3.3.4(中核、括弧付きインライン形式の方針) |
| DES-004 | `docs/design/04-notation-spec.md` | §5(エイリアス変換、resolver.go の責務範囲) |
| M1-04 | `docs/instructions/M1-04-presets-and-recipe-cache.md` | §4.2 / §4.2.1 / §4.3.1(resolver.go の現状実装) |
| M1-05 | `docs/instructions/M1-05-combo-list-detail-pages.md` | §4.2 / §4.2.2(ComboDetailRecipe.tsx の実装方針、本指示書では原則変更不要の根拠) |
| M1-06 | `docs/instructions/M1-06-combo-editor-page.md` | §4.3(RecipeBuilder の現状) |
| M2-01 | `docs/instructions/M2-01-virtual-controller-and-modifiers.md` | §4.6(ModifiersEditor の notes 警告、draftNotes 警告で同パターン再利用) |
| M2-02 | `docs/instructions/M2-02-edit-ux-improvements.md` | §4.4(PutConfirmDialog の現状、createPortal 化対象) |
| M2-03 | `docs/instructions/M2-03-trash-page.md` | §4.5 / §4.7 / §4.8(TrashListRow / TrashBulkActions / PermanentDeleteConfirm の現状) |
| progress-log | `docs/progress/progress-log.md` | M1 既知制限事項のクローズ、M2-04 完了報告追記 |
| m1-known-limitations | `m1-known-limitations.md`(独立ファイル化されていれば、または progress-log 統合済み) | notes 表示未実装の経緯確認 |

---

## 9. 注意事項・判断に迷ったら

### 9.1 推測で進めてはいけない事項

- SUPP-001 §3.3.4 の括弧付きインライン形式から逸脱しない(別行表示・アイコン付き等の代替案は M2-overview §3.4 で却下済み、M2-04 では採用しない)
- resolver.go の flags 処理(`{ }`)を変更しない、notes 処理(`( )`)を追加するのみ
- ComboDetailRecipe.tsx の表示ロジックを大幅変更しない(原則変更不要、§3.4.2 の確認結果次第で微調整)
- 新規 API の追加、既存 API の振る舞い変更は禁止
- 外部ライブラリ(トースト等)の追加は禁止

### 9.2 推測で進めてよい事項(その旨を明示)

以下は本指示書で詳細を確定していない領域。製造担当が実装し、判断の根拠を実装完了報告で明示すること。

- TrashListRow の二重発火対策で案A(stopPropagation)/ 案B(Link 削除)の選択(§4.4.1)
- 行内エラー表示のスタイル詳細(色・配置、`role="alert"` 必須)
- progress-log.md の解消済み記載の表記(取り消し線 / 注記 / 追記方式、いずれでも可)
- createPortal 化のテスト修正範囲(既存テストへの影響を最小化)
- notes 内に括弧文字が含まれる場合の表示(エスケープなし、そのまま出力で良い)

### 9.3 不明事項発見時の対応

1. **設計書本体との矛盾を発見した場合**: CLAUDE.md §8 に従い、Plan Mode で停止して開発者に確認する
2. **M1-04 / M1-05 / M2-01 / M2-02 / M2-03 既存実装と本指示書の矛盾を発見した場合**: 同上、Plan Mode で停止して開発者に確認する
3. **§3.4.2 で ComboDetailRecipe.tsx がテキスト経由ではなく `combo.steps` から動的レンダリングしていた場合**: Plan Mode で停止し、ComboDetailRecipe.tsx 側にも notes 表示の追加実装が必要かを開発者と確定
4. **resolver.go の現状実装が想定と大きく異なる場合**(例: flags 処理が `{ }` ではなく別形式): Plan Mode で停止して開発者に状況報告

### 9.4 Plan Mode で計画提示時に含めるべき項目(必須)

本指示書は Plan Mode 必須(複数の関心が絡む統合タスクのため)。以下を Plan Mode で開発者に提示すること:

- §3.4.1 resolver.go の現状確認結果(flags 処理の実装、notes 処理の未実装確認)
- §3.4.2 ComboDetailRecipe.tsx の現状確認結果(テキスト経由かどうか、本指示書での修正要否)
- §3.4.3 各持ち越し課題対象ファイルの現状確認結果
- §3.4.4 progress-log.md の現状確認結果(notes 項目の所在)
- TrashListRow 二重発火対策の選択(案A or 案B)の判断
- createPortal 化が PutConfirmDialog にも適用されることの確認(§4.3.2)
- E2E シナリオ A〜F の実行可能性(M2-01〜M2-03 までの実装で前提条件が満たされているか)

---

## 10. 完了後の次ステップ

M2-04 完了で **M2 全体の完了** となる。

完了後の流れ:

1. 開発者が M2-04 完了の最終承認
2. M2 全体の振り返り(retro-3-M3 相当の文書作成、M3 着手前)— これは設計担当 Claude(本担当の次セッション)の作業
3. M2 → M3 引き継ぎメモ作成(`m2-to-m3-handover.md`)— 同上
4. M3(マイコンボ系)着手準備

M2-04 で発見されたバグや改善点が発生した場合、M2 完了承認の前に開発者と協議して対応方針を決める(その場で修正、CHANGE 起票、M3 以降への持ち越しのいずれか)。

---

*以上*
