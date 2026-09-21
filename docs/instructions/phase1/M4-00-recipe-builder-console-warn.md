# 指示書 M4-00: RecipeBuilder の console.warn 実装 + テスト 3 ケース追加(P-01 解消)

| 項目 | 内容 |
|------|------|
| 指示書ID | M4-00 |
| バージョン | 1.0.0 |
| 対象マイルストーン | M4(セットプレイ系) |
| 推奨モデル | **Sonnet 4.6** |
| Plan Mode | **任意** |
| 機械レビュー | **必須**(別チェックリスト: `docs/instructions/reviews/M4-00-review-checklist.md`) |
| 並列性 | **独立**(M4-01 と並行投入可、M4 完全直列の例外) |
| 依存指示書 | M2-04(`RecipeBuilder.tsx` 本体実装)、M3-05(`RecipeBuilder.test.tsx` の 4 ケース実装) |
| 想定所要時間 | 30〜60 分 |
| 作成者 | 詳細設計・製造準備担当 Claude(M4 期間担当) |
| 作成日 | 2026-05-16 |

## 更新履歴

| バージョン | 更新日 | 更新内容 |
|-----------|--------|----------|
| 1.0.0 | 2026-05-16 | 初版作成。m3-to-m4-handover §4.1 持ち越し課題 P-01 を独立指示書として起票 |

---

## 1. 背景と目的

### 1.1 背景

M3-05 指示書 §4.4「RecipeBuilder console.warn テスト追加」では、「M2-04 §4.2 で `RecipeBuilder.tsx` に `draftNotes` 50 文字超で `console.warn` を発火する警告ロジックを実装した」を前提として、テスト 3 ケースの追加を製造担当に要求した。

しかし M3-05 実装中に **M2-04 の実際の実装は視覚的 UI 警告(赤ボーダー + 文字数メッセージ)のみで、`console.warn` は実装されていなかった** ことが判明した(progress-log M3-05 完了報告)。製造担当が指示書の前提誤りを発見し、M3-05 では取り込まずに持ち越し課題 P-01 として記録した。

m3-to-m4-handover.md §4.1 で M4 期間中(または M5 着手前)に別指示書として起票することが決まった。本指示書はその独立清算。

なお、本件は **設計担当 Claude(M3 期間担当)の指示書執筆ミス** の典型例として retrospective-log.md §1 パターン A(既存実装の確認漏れ)に分類される。M4 期間の設計担当も同パターンを踏まないよう、本指示書では `console.warn` をゼロから追加する前提で書き、製造担当の §3.4 着手前確認で実態を再検証させる。

### 1.2 目的

- `web/src/features/combo/components/RecipeBuilder.tsx` に `draftNotes` 50 文字超時の `console.warn` 発火ロジックを **ゼロから追加** する(既存実装の修正ではない)
- `web/src/features/combo/components/RecipeBuilder.test.tsx` に `console.warn` 発火/未発火のテスト 3 ケースを追加する
- ModifiersEditor が既に持つ console.warn 警告パターン(M2-04 §4.1 で実装)と同等の警告ロジックを RecipeBuilder にも整備する

### 1.3 このマイルストーンで作らないもの

- ModifiersEditor との警告ヘルパフック統一(`useFieldOverflowWarning` 等の共通化) — m3-to-m4-handover §8.3 で記録済みの将来課題、M5 以降または M7 で対応
- 視覚的 UI 警告(赤ボーダー・文字数メッセージ)の改修 — M2-04 で実装済みで動作中、本指示書では追加・修正しない
- RecipeBuilder の他のロジック修正(レシピステップ管理、modifiers 編集等)
- 持ち越し課題 L-01(オプショナル型整理) — M4-04 で対応

---

## 2. 成果物

### 2.1 作成するファイル

| ファイル | 内容 |
|---------|------|
| (新規作成なし) | 本指示書は既存ファイルの修正のみ |

### 2.2 修正するファイル

#### フロントエンド

| ファイル | 修正内容 |
|---------|---------|
| `web/src/features/combo/components/RecipeBuilder.tsx` | `useEffect` で `draftNotes.length > 50` 時に `console.warn` を発火する処理を追加 |
| `web/src/features/combo/components/RecipeBuilder.test.tsx` | テスト 3 ケースを追加(50 文字以下未発火 / 51 文字以上発火 + 文言確認 / 超過→減少時の過剰発火なし) |

### 2.3 変更しないもの(原則)

- `RecipeBuilder.tsx` の既存ロジック(レシピステップ管理、modifiers 編集、視覚的 UI 警告)
- `ModifiersEditor.tsx` 側の console.warn 実装(M2-04 §4.1 で実装済み、参考実装)
- `RecipeBuilder.test.tsx` の既存 4 ケース(M3-05 §4.4 の前段で実装済み、回帰しない)
- バックエンドコード全般

### 2.4 例外: バックエンドへの追加実装が許容される箇所

該当なし。本指示書はフロントエンド単一ファイルおよびそのテストファイルのみの修正で完結する。

---

## 3. 前提条件

### 3.1 必読ドキュメント

製造担当 Claude Code は実装着手前に以下を読む:

| ID / ファイル | 関連節 |
|--------------|--------|
| 本指示書 | 全体 |
| CLAUDE.md | §4 TypeScript 規約(関数コンポーネント + Hooks)、§10 禁止事項(`console.log` を本番コードに残さない原則。`console.warn` は本指示書で意図的に残すため除外) |
| m3-to-m4-handover.md v1.1.0 | §4.1 P-01 詳細 |

### 3.2 任意参照(必要時のみ)

| ID / ファイル | 参照タイミング |
|--------------|--------------|
| M2-04 指示書 §4.1 / §4.2 | ModifiersEditor の console.warn 実装パターン参照時 |
| M3-05 指示書 §4.4 | 当初の (誤った) 指示書記述を参考にする際 |
| `web/src/features/combo/components/ModifiersEditor.tsx` | ModifiersEditor の現行 console.warn 実装パターン参照時(視覚的 UI 警告 + console.warn の両立構造) |

### 3.3 参照不要

- セットプレイ系設計書節(DES-003 §3.11〜§3.13、DES-005 §5.9、DES-006 §3 等) — M4-01 以降で参照
- DES-002 §4.3 エラーレスポンス共通型 — 本指示書のスコープ外
- SUPP-001 §7 サービス層責務一覧 — 本指示書のスコープ外

### 3.4 着手前の確認

製造担当 Claude Code は §4 詳細仕様の実装に着手する前に、以下を確認する。結果を Plan Mode で開発者に報告すること(Plan Mode 任意だが、本指示書は事前確認の意義が大きいため Plan Mode 使用を推奨)。

#### 3.4.1 RecipeBuilder の console.warn 実装の現状確認(P-01 起源の検証)

```bash
grep -n 'console\.warn' web/src/features/combo/components/RecipeBuilder.tsx
```

期待される結果: **検出件数ゼロ**(console.warn は M2-04 でも M3 でも実装されていない)。

万一既に検出された場合は Plan Mode で停止し、本指示書の前提が崩れているため開発者に報告すること。

#### 3.4.2 ModifiersEditor の console.warn 実装の現状確認(参考実装)

```bash
grep -n 'console\.warn' web/src/features/combo/components/ModifiersEditor.tsx
```

期待される結果: M2-04 §4.1 で実装された console.warn の発火箇所(`useEffect` 経由)が 1〜2 件検出される。RecipeBuilder で追加する console.warn の **実装パターン参照源** とする(全コードコピーではなく、構造パターンの参考)。

#### 3.4.3 RecipeBuilder.test.tsx の既存テストケースの確認

```bash
grep -n '^  it\(\|^  test\(\|describe' web/src/features/combo/components/RecipeBuilder.test.tsx
wc -l web/src/features/combo/components/RecipeBuilder.test.tsx
```

期待される結果: 既存 4 ケース(M3-05 §4.4 前段で実装済み)が存在し、本指示書で追加する 3 ケースとの命名衝突がないこと。既存ケース名は変更しない。

#### 3.4.4 既存テストでの console.warn のモック方式の確認

```bash
grep -rn 'spyOn(console\|vi\.spyOn\|console\.warn' web/src/features/combo/components/*.test.tsx web/src/features/combo/components/*.test.ts
```

期待される結果: ModifiersEditor.test.tsx などで `vi.spyOn(console, 'warn')` 等のパターンが使われていれば、本指示書で追加するテストでも **同方式を踏襲** する。既存パターンを発見できない場合は §4.2 の実装方針通り `vi.spyOn` で新規導入する。

#### 3.4.5 draftNotes の型・取り扱いの確認

```bash
grep -n 'draftNotes' web/src/features/combo/components/RecipeBuilder.tsx
```

期待される結果: `draftNotes` が `string` 型として `useState` または props で管理されている。M2-04 §4.2 で導入された変数で、視覚的 UI 警告(50 文字超時の赤ボーダー + 文字数メッセージ)に既に使われている。本指示書ではこの既存変数を再利用する。

#### 3.4.6 確認結果の報告

製造担当 Claude Code は §3.4.1〜§3.4.5 の確認コマンド出力を実装完了報告に含める。特に §3.4.1 の「検出件数ゼロ」は本指示書の前提中の前提のため、明示的に確認結果を記録すること。

#### 3.4.7 §4 着手の前提条件

§3.4.1〜§3.4.5 のすべての確認結果が期待通りであることを確認してから、§4 詳細仕様の実装に着手する。万一現状が想定と乖離する場合は Plan Mode で停止して開発者に報告する。

---

## 4. 詳細仕様

### 4.1 RecipeBuilder への console.warn 発火ロジックの追加

#### 4.1.1 機能要件

- `draftNotes` の長さが 50 文字を超えた瞬間に `console.warn` を 1 回発火する
- 50 文字以下に戻った後、再度 50 文字を超えた場合は再発火する
- 視覚的 UI 警告(M2-04 §4.2 で実装済み)は維持する(削除・変更しない)

#### 4.1.2 実装パターン(ModifiersEditor のパターンを踏襲)

ModifiersEditor の console.warn パターンを参考にして、以下の構造で `RecipeBuilder.tsx` に追加する:

```tsx
// 既存の RecipeBuilder コンポーネント内に追加
useEffect(() => {
  if (draftNotes.length > 50) {
    console.warn(`draftNotes が 50 文字を超えています: ${draftNotes.length} 文字`);
  }
}, [draftNotes]);
```

- `useEffect` の依存配列は `[draftNotes]`(50 文字超の判定は draftNotes の変化に応じて発火)
- 発火文言は「draftNotes が 50 文字を超えています: N 文字」(N は実際の文字数)。ModifiersEditor のパターンが異なる場合は §3.4.2 で確認した文言形式に合わせる
- 50 文字以下の場合は何もしない(if 文の else 不要)

#### 4.1.3 配置位置

`RecipeBuilder.tsx` の既存 `useEffect` 群の末尾に追加する。既存のレシピステップ管理 / modifiers 編集系の `useEffect` の動作に影響を与えないよう、独立した `useEffect` ブロックとして追加する。

#### 4.1.4 視覚的 UI 警告との両立

M2-04 §4.2 で実装済みの視覚的 UI 警告(赤ボーダー + 文字数メッセージ)は **維持する**。本指示書は console.warn を **追加** するもので、視覚的 UI 警告は触らない。両者が同じ閾値(50 文字)で発火することで、ユーザーは UI で気づき、開発者はコンソールで気づける構造になる(ModifiersEditor と同等の二重化)。

### 4.2 RecipeBuilder.test.tsx へのテスト 3 ケース追加

#### 4.2.1 追加するテストケース

`web/src/features/combo/components/RecipeBuilder.test.tsx` に以下 3 ケースを追加する。既存 4 ケースは変更しない(回帰しないこと)。

| ケース | 入力条件 | 期待動作 |
|--------|---------|---------|
| ケース 1 | `draftNotes` に 50 文字以下を入力 | `console.warn` が **発火しない**(spy の呼出回数 0) |
| ケース 2 | `draftNotes` に 51 文字以上を入力 | `console.warn` が **1 回発火**、警告文言に「50 文字を超えています」が含まれる、N 文字数の数値が一致 |
| ケース 3 | 50 文字超を入力 → 50 文字以下に減らす | 50 文字超時点で 1 回発火、減らした後の追加発火がないこと(spy の呼出回数 1 が維持) |

#### 4.2.2 実装方針

- `vi.spyOn(console, 'warn')` を `beforeEach` で設定、`afterEach` でリセット(または `vi.restoreAllMocks()`)
- 既存テストで `console.warn` のスパイ方式が確立されている場合は、その方式を踏襲(§3.4.4 で確認)
- ケース 2 の文言確認は部分一致(`expect.stringContaining`)で行う(完全一致だと将来の文言修正に弱い)
- ケース 3 は React Testing Library の `rerender` または useState を経由した状態変化で実現

#### 4.2.3 テスト構造の例

```tsx
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render } from '@testing-library/react';

describe('RecipeBuilder draftNotes 50 文字超警告', () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it('50 文字以下では console.warn が発火しない', () => {
    // ケース 1 の実装
  });

  it('51 文字以上で console.warn が 1 回発火し、文言に「50 文字を超えています」を含む', () => {
    // ケース 2 の実装
  });

  it('50 文字超 → 50 文字以下に減らした際、追加発火がない', () => {
    // ケース 3 の実装(rerender 経由)
  });
});
```

完全実装は製造担当が決定する。既存テストとの命名衝突や `describe` ブロックの統合可否は実装時に判断する。

### 4.3 設計判断事項(本指示書で確定済み)

| 項目 | 確定内容 |
|------|---------|
| console.warn の発火タイミング | 50 文字超に **達した瞬間** に 1 回(useEffect の依存配列 `[draftNotes]` で実現) |
| 発火文言 | 「draftNotes が 50 文字を超えています: N 文字」(N は実数値) |
| 視覚的 UI 警告との関係 | 両立(視覚的 UI 警告は M2-04 で実装済み、本指示書では console.warn を追加するのみ) |
| ModifiersEditor との共通ヘルパ化 | **行わない**(将来課題、handover §8.3 で記録、M5 以降または M7 で対応) |
| テスト 3 ケースの構成 | 50 文字以下未発火 / 51 文字以上発火 + 文言 / 超過 → 減少時の過剰発火なし |
| スパイ方式 | `vi.spyOn(console, 'warn')` + `beforeEach` / `afterEach` リセット |

---

## 5. テスト要件

### 5.1 必須テスト

#### 5.1.1 追加するテストケース(§4.2 通り)

- [ ] ケース 1: 50 文字以下で console.warn 未発火
- [ ] ケース 2: 51 文字以上で console.warn 1 回発火 + 文言「50 文字を超えています」含む
- [ ] ケース 3: 超過 → 減少時の過剰発火なし

#### 5.1.2 既存テストの回帰確認

- [ ] `RecipeBuilder.test.tsx` の既存 4 ケースがすべて通過する
- [ ] `cd web && pnpm test` 全体が全通過する(他コンポーネントのテストにも影響を与えていないこと)

#### 5.1.3 ビルド・型チェック

- [ ] `cd web && pnpm build` が成功する
- [ ] TypeScript の型エラーが残っていない

### 5.2 E2E シナリオ

#### A. console.warn の手動動作確認

1. `pnpm dev` で開発サーバーを起動
2. ブラウザでコンボ登録画面(`/combos/new`)を開く
3. ブラウザの開発者ツール(F12)→ Console タブを開く
4. レシピステップに 50 文字超の `draftNotes` を入力する(M2-04 で実装済みの draftNotes 入力 UI 経由)
5. **期待**: Console に「draftNotes が 50 文字を超えています: 51 文字」のような警告が表示される
6. draftNotes を 50 文字以下に減らす → 追加の警告が表示されない(超過 → 減少時の過剰発火なし)
7. 視覚的 UI 警告(M2-04 §4.2 で実装済みの赤ボーダー + 文字数メッセージ)が引き続き正しく表示される

#### B. 既存機能の回帰

1. M2-04 で実装した視覚的 UI 警告が動作する(赤ボーダー、文字数メッセージ表示)
2. M3-05 で確立した RecipeBuilder のレシピ表示・modifiers 編集機能が動作する
3. コンボ登録・編集の保存フローが影響を受けない

---

## 6. レビュー観点(別ファイル参照)

機械レビューは別ファイル `docs/instructions/reviews/M4-00-review-checklist.md` に従う。製造担当 Claude Code は本ファイルを読む必要はない(自分の指示書本体に集中する)。

---

## 7. 完了条件(Definition of Done)

### 7.1 機能要件

- [ ] §2.2 のファイル修正が実施されている(`RecipeBuilder.tsx` への console.warn 追加、`RecipeBuilder.test.tsx` への 3 ケース追加)
- [ ] §3.4 着手前確認の結果(特に §3.4.1 「検出件数ゼロ」)が実装完了報告に含まれている
- [ ] §4.1 console.warn 発火ロジックが動作する(§5.2 E2E シナリオ A 実機確認)
- [ ] §4.2 テスト 3 ケースが追加され全通過する(§5.1.1)
- [ ] 既存 4 ケースが回帰しない(§5.1.2)
- [ ] §5.2 E2E シナリオ A / B が全通過する

### 7.2 自己テスト結果(製造担当の責任範囲)

**フロントエンド側**:

- [ ] `cd web && pnpm test` が全通過する(既存 + 新規テスト両方)
- [ ] `cd web && pnpm build` が成功する
- [ ] TypeScript の型エラーが残っていない
- [ ] 開発サーバー起動時にコンソール警告(React の key 警告等)が新規発生していない
- [ ] §3.4.1 / §3.4.2 / §3.4.3 / §3.4.4 / §3.4.5 着手前確認の出力を含める
- [ ] 開発者向けの「動作確認手順書」(§5.2 E2E シナリオ A の手順を含む)を実装完了報告に含める

**バックエンド側**:

- 該当なし(本指示書はバックエンド変更を含まない)

ブラウザでの実機動作確認・スクリーンショット取得は **開発者の責任範囲**(playbook §14)。製造担当 Claude Code はターミナル環境のため実行不可。

### 7.3 品質チェック

- [ ] CLAUDE.md の禁止事項に抵触していない(§10、`console.log` を本番コードに残さない。`console.warn` は本指示書で意図的に追加するため除外)
- [ ] **`console.warn` 以外の console 出力を本番コードに追加していない**(意図しない console.log が混入していないこと)
- [ ] **playbook §4.5 / §4.6 / §4.7 の 3 ルールに抵触していない**
- [ ] **shadcn/ui を使用していない**(本指示書はそもそも UI ライブラリの追加・修正を含まないが念のため、playbook §4.6)
- [ ] 設計書本体(該当節なし、本指示書は持ち越し課題清算のみ)との整合 — 該当なし
- [ ] 列挙定数の散在チェック(本指示書は新規列挙定数を導入しないため適用対象外)

### 7.4 ドキュメント

- [ ] `docs/progress/progress-log.md` に M4-00 完了報告を追記する
- [ ] **m3-to-m4-handover §4.1 持ち越し課題 P-01 の解消事実** を明記
- [ ] §3.4 着手前確認結果を含める(§3.4.1〜§3.4.5 の出力)
- [ ] M2-04 §4.2 の console.warn 実装に関する **設計担当の指示書執筆ミス**(M3-05 §4.4.1 で「実装済み」と誤記した経緯)が本マイルストーンで清算されたことを明記(retrospective-log §1 パターン A の事例として記録継続)

### 7.5 完了報告

- [ ] 開発者に「M4-00 が完了しました」と報告
- [ ] §7.1〜§7.4 の自己テスト結果を報告書に含める

---

## 8. 参照ドキュメント

| ID / ファイル | 関連節 |
|--------------|--------|
| CLAUDE.md | §4 TypeScript 規約、§10 禁止事項 |
| m3-to-m4-handover.md v1.1.0 | §4.1 持ち越し課題 P-01 詳細 |
| M4-overview.md v1.1.0 | §3.1 M4-00 の概要、§5.4 持ち越し課題で M4 内で扱うもの |
| M2-04 指示書 §4.1 / §4.2 | ModifiersEditor / RecipeBuilder の元実装 |
| M3-05 指示書 §4.4 | M3-05 での当初記述(誤前提を含む、参考のみ) |
| retrospective-log.md v1.0.0 | §1 パターン A(既存実装の確認漏れ)、§4.1 #12(M3-05 で発生した本ミス) |
| playbook v1.6.0 | §4.5 フローの素直さ、§4.6 UI ライブラリ実態確認、§5 設計書節への行レベル参照 |

---

## 9. 注意事項・判断に迷ったら

### 9.1 推測で進めてはいけない事項

以下は推測で進めず、Plan Mode で開発者に確認する:

- §3.4.1 で `console.warn` が既に検出された場合(本指示書の前提が崩れている、状況確認のため停止)
- §3.4.2 で ModifiersEditor の console.warn 実装パターンが想定と大きく異なる場合(useEffect 経由ではなくイベントハンドラ内発火等)
- §3.4.5 で `draftNotes` 変数が想定と異なる場所(別コンポーネント、props 経由等)で管理されている場合
- 既存テストファイルでスパイ方式が `vi.spyOn(console, 'warn')` 以外の方法(global mock 等)で確立されている場合の踏襲可否
- 3 ケースのうちどれかが既存ケースと内容重複している場合の取扱

### 9.2 推測で進めてよい事項(その旨を明示)

以下は推測で進めてよいが、実装時に「推測:〜と仮定した」とコード内コメントまたは完了報告に明示する:

- 警告文言の細部(「draftNotes が 50 文字を超えています: N 文字」の N を半角・全角どちらにするか等)
- テストケース名(`it('〜')` の文言の細部)
- スパイのリセット方式(`mockRestore` か `restoreAllMocks` かの選択)

### 9.3 不明事項発見時の対応

- 設計書本体(本指示書は設計書本体への影響なし)と本指示書の記述が乖離する事態は想定されないが、万一発生した場合は実装を止めて開発者に報告
- 本指示書の §4 詳細仕様で具体化されていない実装判断が必要になった場合 → §9.2 の範囲なら推測で進めて明示、それ以外は Plan Mode で開発者確認

### 9.4 Plan Mode で計画提示時に含めるべき項目

Plan Mode を使う場合(任意だが本指示書は事前確認の意義が大きいため Plan Mode 推奨)、以下を計画に含める:

- §3.4 着手前確認の結果(特に §3.4.1 の console.warn 検出ゼロの確認)
- §4.1 console.warn の `useEffect` を追加する具体位置(`RecipeBuilder.tsx` の既存コード構造との関係)
- §4.2 テスト 3 ケースの `describe` ブロック構成(既存ブロック内に追加するか、新規 `describe` ブロックを作るか)
- 既存テストの回帰リスク評価(スパイ設定が他テストに副作用を与えないか)

---

## 10. 完了後の次ステップ

M4-00 完了後、開発者が動作確認・承認したら **M4-01(セットプレイ ドメイン バックエンド基盤)** に進む。M4-00 と M4-01 は並行投入可能(playbook §15.2 ターミナル 3 本制約内、M4-overview §2.3 参照)。

P-01 の解消により、handover §4 持ち越し課題のうち 1 件が消化される。残る L-01 は M4-04 で、L-02 / L-03 は M5 以降または M7 で対応予定。

---

*以上*
