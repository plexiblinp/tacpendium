# 引き継ぎ: M3 → M4(設計担当 Claude セッション間)

| 項目 | 内容 |
|------|------|
| 文書ID | M3-TO-M4-HANDOVER |
| バージョン | 1.1.0 |
| 作成日 | 2026-05-15 |
| 作成者 | 詳細設計・製造準備担当Claude(M3 期間担当) |
| 対象 | 詳細設計・製造準備担当Claude(M4 期間担当、**別チャットで開始**) |
| 用途 | M3 完了時点での進行状態、M4 着手のチェックリスト、M3 → M4 固有の差分情報 |
| 対象読者 | **設計・指示書作成担当 Claude 専用**。製造担当・レビュー担当 Claude Code は読まない |

---

## 0. 本書の使い方

本書は **マイルストーン固有** の引き継ぎ資料(M3 → M4 の差分情報のみ)。プロジェクト恒久の運用ルール・
反省記録・アーキテクチャパターン・CHANGE 番号運用は、それぞれ専用の継続更新ファイルに分離されている
(下記の読む順序を参照)。

### 新セッションで読む順序(必読)

M4 担当 Claude は新セッション開始時に以下の順で読むこと:

1. **`CLAUDE.md`**(プロジェクト恒久) — 全体方針、特に §4 コーディング規約(camelCase / 列挙定数同期 /
   コンボ一覧用・詳細用の型分岐運用)、§10 禁止事項、§10.X ブラウザストレージ運用
2. **`docs/handover/design-instruction-playbook.md`** v1.5.0(プロジェクト恒久) — 開発スタイル全般、
   特に §4.5〜§4.8 の確立済みルール
3. **継続更新ファイル群**(全期間通算) — `retrospective-log.md`(設計担当ミス累積記録)、
   `architecture-patterns.md`(確立アーキテクチャパターン)、`change-number-registry.md`(CHANGE 番号運用)
4. **本書(m3-to-m4-handover.md)** — M3 完了状態と M4 着手の現在地
5. **`docs/design/supp-001-detailed-design.md`** v1.11.0 — 特に §7.4 defaultRecipe 抽出ルール、
   §2〜§3 の初期データ戦略・設計上の追加決定事項などの技術詳細
6. **設計書本体**(REQ-001、DES-001〜006) — M4 着手時に必要な節を view ツールで確認

### M3 期間中に CHANGE 通知書で改訂された設計書本体

DES-002 が v1.5.0 → v1.7.0(§4.3 エラーレスポンス共通 Go 型・`details.validations` 構造)に改訂された。
詳細は `change-number-registry.md §3` を参照。それ以外の設計書本体は M3 期間で改訂されていない。

---

## 1. 役割の引き継ぎ

新セッションの担当役割は **設計担当 Claude(チャット形式)**。役割定義は playbook §1 を参照。

開発者の指示によって以下のタスクを担う:

- M4 期間の指示書・レビューチェックリスト作成(M4-overview.md → M4-{NN}-{name}.md)
- 製造担当 Claude Code・レビュー担当 Claude Code からの Q&A 対応
- CHANGE 通知書起票(必要が発生した場合。次番号は change-number-registry.md で確認)
- M3 期間からの持ち越し課題への対応(§4 参照)
- M4 → M5 引き継ぎ時の handover 作成、playbook 改訂提案(運用変更が確定した場合)

---

## 2. M3 完了状態

### 2.1 M3 全体の完了承認

開発者により M3 全体完了が承認済み(2026-05-15)。CHANGE 通知書 2 件起票(CHANGE-010 / CHANGE-011)、
DES-002 v1.5.0 → v1.7.0。

### 2.2 M3 サブマイルストーン完了状態

| ID | 名称 | 実装モデル | レビューモデル | 状態 |
|----|------|----------|--------------|------|
| M3-01 | タグ機能・タグ管理画面 | Sonnet 4.6 | Sonnet 4.6 | 完了 |
| M3-02 | コンボへのタグ付与 UI | Sonnet 4.6 | Sonnet 4.6 | 完了 |
| M3-03 | フィルタ・ソート・表示列カスタマイズ | Opus 4.6 | Sonnet 4.6 | 完了 |
| M3-04 | useCharacters + マイコンボ画面 + 3 経路ステータス変更 UI | Sonnet 4.6 | Sonnet 4.6 | 完了 |
| M3-05 | コンボ一覧仕上げ + エラー共通化 + M3 統合 E2E | Opus 4.6 | Opus 4.6 | 完了 |

各指示書の最終バージョン:

- M3-overview.md: v1.0.2
- M3-01-tag-feature-and-management.md: v1.0.1(retrospective 記録のみ)
- M3-01-review-checklist.md: v1.0.0
- M3-02-tag-assignment-ui.md: v1.0.2(retrospective 記録のみ)
- M3-02-review-checklist.md: v1.0.0
- M3-03-filter-sort-column-customize.md: v1.0.2
- M3-03-review-checklist.md: v1.0.1
- M3-04-mycombo-page-and-use-characters.md: v1.0.5(本文修正を伴う retrospective)
- M3-04-review-checklist.md: v1.0.4
- M3-05-combo-list-polish-and-error-unification.md: v1.0.0
- M3-05-review-checklist.md: v1.0.0
- CHANGE-010-api-error-common-type.md: v1.0.0
- CHANGE-011-api-error-validations-structure.md: v1.0.0
- model-allocation.md: M3 セクション記入済み

### 2.3 動作確認済み機能(M3 統合 E2E シナリオ A〜I)

M3-05 完了時に M3 統合 E2E シナリオ A〜I が動作確認済み。M3 全体としての主要機能:

- **タグ機能(M3-01)**: タグ CRUD API、タグ管理画面、初期 3 タグ seed(使用中/練習中/頻度低下、
  `mycombo_status` カテゴリ)
- **コンボへのタグ付与(M3-02)**: TagSelector UI、TagBadgeList 表示、`mycombo_status` カテゴリは
  TagSelector / TagBadgeList から除外する責務分離(専用 UI 経由のみ)
- **フィルタ・ソート・表示列カスタマイズ(M3-03)**: useComboListFilters / useColumnVisibility フック、
  `combo-list-columns-v1` localStorage キー、browser-storage.ts 共通ヘルパ
- **マイコンボ画面 + 3 経路ステータス変更(M3-04)**: 別画面方式(`/mycombo` 独立ルート)、キャラクター
  情報バー + 件数ダッシュボード、ステータス切替タブ + カウントバッジ、character API 新規実装、
  useCharacters フック、`MyComboStatusSelect`(表示専用)+ `useUpdateMyComboStatus`(ロジック層)の
  分離アーキテクチャ、3 経路(マイコンボ画面 / コンボ編集画面 / コンボ一覧画面)でのステータス変更
- **コンボ一覧仕上げ + エラー共通化(M3-05)**: `model.APIError` / `APIErrorResponse` 共通型、
  5 ハンドラ統一(tag / character / combo / preset / move)、combo ハンドラの後方非互換変更
  (フラット → ネスト)、`defaultRecipe` / `starterMoveCode` DTO 拡張(recipe_cache 活用方式)、
  フィルタ適用時の空状態メッセージ改善

### 2.4 M3 期間で確立・整備された運用ルール

playbook §4.5〜§4.8 に統合済み(§4.5 フローの素直さ原則、§4.6 UI ライブラリ実態確認原則、
§4.7 全ハンドラ列挙原則、§4.8 列挙定数の即時同期原則)。M3-05 反省を受けた以下も整備済み:

- **CLAUDE.md §4 TypeScript 規約**: コンボ一覧用(ComboSummary)/詳細用(Combo)の型分岐運用ルール
- **SUPP-001 §7.4**: コンボ一覧 API レスポンス DTO の defaultRecipe 抽出ルール(`defaultPresetID = "1"`
  暗黙前提、recipe_cache 活用方式)

---

## 3. M4 期間の概要

### 3.1 M4 スコープ(設計書本体・M3-overview から把握済み)

M4 はセットプレイ系・プリセット系の機能実装期間。M3-overview などから読み取れる範囲:

- **セットプレイ機能**: コンボの組み合わせ・流れを管理する上位概念。REQ-001 / DES-005 を確認すること
- **プリセット系機能**: コンボのプリセット管理(`presets` テーブル、組み込みプリセットの保護等)。
  DES-004 内部表現仕様書 / SUPP-001 §7 サービス層責務一覧を参照
- **新規ハンドラの追加**: 上記機能に対応する API ハンドラが新設される(M4 着手時に DES-002 §4.2
  主要エンドポイントを確認)

M4 のサブマイルストーン分割は M4 起票フェーズで開発者と協議して確定する。本書では概要のみ。

### 3.2 M4 着手時の必須前提条件

1. **CHANGE-010 / CHANGE-011 取り込み済み**: 新規ハンドラは最初から `model.APIErrorResponse` 共通型を
   使用する(独自エラー型を作らない)。バリデーションエラーは `Details: map[string]any{"validations": result}`
   形式。詳細は architecture-patterns.md §3
2. **frontend のフック分離パターン踏襲**: 表示専用コンポーネント + ロジックフックの分離
   (architecture-patterns.md §1)。`mode` 切替 props のような単一コンポーネント設計を強制しない
3. **shadcn/ui 不使用**: M7 まで標準 HTML + Tailwind 自作で継続(playbook §4.6)
4. **列挙定数の即時同期**: 新規 `model.<Category|Status|Type|Code>` 定数を導入する際は、フロント側
   `web/src/constants/` への対応定数追加を指示書に必ず明記(playbook §4.8、CLAUDE.md §4)

### 3.3 M4 推奨モデル配分(M3 実績ベース)

- 既存パターン踏襲が多いサブマイルストーン: Sonnet 4.6
- 設計判断・後方互換変更・複数ハンドラ跨ぎリファクタを含むサブマイルストーン: Opus 4.6
- 統合 E2E + 仕上げサブマイルストーン: Opus 4.6 推奨(M3-05 の経験から、複数スコープ束ねるケースは
  Opus が安全)

確定は model-allocation.md の M4 セクションで開発者と協議する。判断軸は playbook §7。

---

## 4. M3 期間からの持ち越し課題(M4 で対処すべき項目)

### 4.1 P-01: RecipeBuilder console.warn 未実装(重要度: 中)

**内容**: M3-05 §4.4 で要求した `RecipeBuilder.tsx` の `console.warn` 追加 + テスト 3 ケース追加が未実装。

**原因**: M3-05 指示書 §4.4.1 で「M2-04 §4.2 で console.warn を発火する警告ロジックを実装した」と
記述したが、これは設計担当の記述ミス。M2-04 の実際の実装は視覚的 UI 警告(赤ボーダー + 文字数
メッセージ)のみで、`console.warn` は実装されていなかった。製造担当が指示書の前提誤りに気づき、
M3-05 では取り込まないと判断。

**対応**: M4 期間中(または M5 着手前)に別指示書として起票する。作業内容:
- `web/src/features/combo/components/RecipeBuilder.tsx` に `useEffect` で
  `console.warn("draftNotes が 50文字を超えています: N文字")` を追加
- `web/src/features/combo/components/RecipeBuilder.test.tsx` に 3 ケース追加:
  - 50 文字以下で console.warn 未発火
  - 51 文字以上で console.warn 発火 + 文言確認
  - 超過 → 減少時の過剰発火なし

**M4 担当 Claude への指示**: M4 起票時に開発者と「P-01 を M4 のどこかに組み込むか / 別の小マイルストーン
化するか」を協議する。指示書には「`console.warn` をゼロから追加する」前提で書くこと(M2-04 実装の確認を
省略しない、playbook §4.6 派生原則)。

### 4.2 L-01: ComboSummary / Combo の defaultRecipe / starterMoveCode オプショナル型(軽微)

**内容**: M3-05 で追加した `ComboSummary` / `Combo` の `defaultRecipe?: string` / `starterMoveCode?: string`
が **オプショナル型** になっているが、バックエンド `ComboResponse` は常に文字列を返すため、必須型
`string` に揃えるのが正しい。

**対応**: M4 期間中の任意のタイミングで `?` を外して `string` 型に修正。動作リスクなし(バックエンドが
常に値を返すため)、修正範囲は型定義 1 ファイル + 関連参照箇所のみ。M4 サブマイルストーンのいずれかに
紛れ込ませる、または別の軽微修正と束ねて単独で対処する。単独で別マイルストーン化する必要はない。

### 4.3 L-02: エラーコード文字列の大文字/小文字混在(軽微)

**内容**: tag / combo ハンドラで、インフラ系エラーは小文字スネークケース(`not_found`, `internal_error`)、
ドメイン固有エラーは大文字スクリーミングスネーク(`TAG_IN_USE`, `INVALID_TAG_ID`)が混在している。
CHANGE-010 §3.4「既存コードを変更しない」制約下での既存不一致。

**対応**: M4 以降で統一する場合は **CHANGE 通知書を伴う独立スコープ** として処理(フロント側の
`error.code` 比較箇所の修正も必要、後方非互換変更のため)。推奨統一は小文字スネークケース。
**M4 起票時には組み込まない**(M4 の主要スコープと無関係)。M5 以降または M7 仕上げで協議。

### 4.4 L-03: ハンドラごとのエラーヘルパ命名不統一(優先度低)

**内容**: M3-05 でエラー共通化後も、ハンドラごとに独自命名のエラーヘルパが残存(tag: `errResp()` /
`errRespDetail()`、character: `charErrResp()`、combo: `comboErrResp()` / `comboErrCode()` 等)。
CHANGE-010 §5.3「ヘルパ関数は強制しない」の範囲内。

**対応**: 優先度低。M4 で新規ハンドラを追加する際は `model.APIErrorResponse` を直接書くパターンを推奨
(ヘルパを増やさない、architecture-patterns.md §3)。L-02 と合わせて整理する選択肢もある。

### 4.5 持ち越し課題サマリ表

| ID | 重要度 | 対応マイルストーン | CHANGE 通知書 |
|----|-------|------------------|--------------|
| P-01 RecipeBuilder console.warn | 中 | M4 or M5 着手前(別指示書) | 不要 |
| L-01 オプショナル型整理 | 軽微 | M4 中の任意タイミング | 不要 |
| L-02 エラーコード大小混在 | 軽微 | M5 以降または M7 | **必要**(後方非互換) |
| L-03 ハンドラヘルパ統一 | 低 | M4 以降の判断 | 不要 |

---

## 5. 設計担当ミス累積記録 → retrospective-log.md へ移管

M3 期間の設計担当ミス累積記録(計 15 件)および構造的アンチパターン A〜D は、全期間通算の継続更新
ファイル **`retrospective-log.md`** に移管した。M4 担当 Claude は同書 §1(構造的アンチパターン)と
§4(M3 期間の詳細)を必ず読み、同種ミスを繰り返さないこと。

---

## 6. 確立アーキテクチャパターン → architecture-patterns.md へ移管

M3 期間で確立した分離アーキテクチャパターン(フロント表示/ロジック分離、バックエンド 3 層、エラー
共通型、列挙定数同期、ブラウザストレージ運用)は、全期間通算の継続更新ファイル
**`architecture-patterns.md`** に移管した。M4 の新規 UI コンポーネント・新規ハンドラを設計する指示書は
同書のパターンに整合させること。

---

## 7. CHANGE 番号運用 → change-number-registry.md へ移管

CHANGE 番号の採番状態(使用済み / 欠番 / 空き)は継続更新ファイル **`change-number-registry.md`** に
移管した。**新規 CHANGE 通知書は 012 から採番** する(008 / 009 は欠番、再利用しない)。

---

## 8. M3 期間で発生した将来課題(M4 で取り組まない、後続マイルストーン候補)

本書 §4 持ち越し課題とは別に、M3 期間で発見された **設計改善候補** を記録する。M4 のスコープに含めず、
M5 以降または機会のあるタイミングで開発者と協議する。

### 8.1 Validations の APIError 直接フィールド化検討

現状: `APIError.Details` に `map[string]any{"validations": result}` で格納(型安全でない)。
将来案: `APIError` に `Validations *validation.ValidationResult` を直接フィールドとして追加し型安全に
表現。トレードオフ: 共通型の汎用性が低下、Details の柔軟性を保ちたい場合は現状維持。

### 8.2 recipe_cache の defaultPresetID ハードコード

現状: `internal/service/combo/service.go` の `extractDefaultRecipe()` 内で `defaultPresetID = "1"` を
ハードコード(SUPP-001 §7.4.1 に記録済み)。将来案: DES-004 に「デフォルトプリセット ID の定義」節を
新設し暗黙前提を設計書本体で明文化。トリガー: プリセット ID 体系の変更、または DES-004 改訂の機会。

### 8.3 RecipeBuilder と ModifiersEditor の警告ロジック統一

現状: ModifiersEditor は `console.warn` + 視覚的 UI 警告、RecipeBuilder は視覚的 UI 警告のみ
(P-01 で console.warn 追加予定)。将来案: P-01 解消後、両コンポーネントで共通の警告ヘルパフックを抽出
(`useFieldOverflowWarning(value, limit, label)` 等)。トリガー: M5 以降または M7 仕上げ。

---

## 9. M4 着手チェックリスト

新セッションの M4 担当 Claude が着手前に確認すべき項目:

- [ ] `CLAUDE.md` を読了(特に §4 コーディング規約)
- [ ] `docs/handover/design-instruction-playbook.md` v1.5.0 を読了(特に §4.5〜§4.8)
- [ ] `retrospective-log.md` / `architecture-patterns.md` / `change-number-registry.md` を読了
- [ ] 本書(m3-to-m4-handover.md)を読了
- [ ] `docs/design/supp-001-detailed-design.md` v1.11.0 を読了(特に §7.4)
- [ ] `docs/design/02-architecture.md` DES-002 v1.7.0 §4.3 エラーハンドリングを確認
- [ ] M3-overview.md の M4 関連記述を確認
- [ ] M3-04 指示書 v1.0.5 / M3-05 指示書 v1.0.0 の構造を参考に M4 指示書のテンプレートを準備
- [ ] M3-05 レビューチェックリスト v1.0.0 の §0〜§12 標準構成を踏襲
- [ ] 持ち越し課題 P-01 / L-01 / L-02 / L-03 を頭に入れる
- [ ] 開発者から M4 起票指示を受領、M4-overview.md から着手

---

## 10. 本書の改訂方針

本書は M3 → M4 引き継ぎ専用。M4 着手後に本書を改訂する必要は基本的にない(後続マイルストーン開始時の
handover は M4 → M5 として別ファイル新設)。

ただし以下の場合のみ本書を改訂する:

- 本書記載の M3 完了状態に **重大な誤り** が発覚した場合
- 持ち越し課題 P-01 / L-01 / L-02 / L-03 の認識が大きく変わる事実が判明した場合

軽微な追記・整理は本書改訂とせず、新セッションで開発者と協議のうえ判断する。

---

## 11. 改訂履歴

| バージョン | 改訂日 | 改訂内容 |
|-----------|--------|----------|
| 1.0.0 | 2026-05-15 | 初版作成。M3 期間完了を受けて M4 期間担当 Claude への引き継ぎ資料として作成。M3 期間で確立した分離アーキテクチャパターン・playbook §4.5〜§4.8 ルール・持ち越し課題 4 件・設計担当ミス累積記録 15 件・CHANGE 番号運用最新状態を集中記録 |
| 1.1.0 | 2026-05-16 | M3→M4 期間のドキュメント整理に伴う圧縮。恒久情報を継続更新ファイルへ分離: §5 設計担当ミス累積記録 → retrospective-log.md、§6 アーキテクチャパターン → architecture-patterns.md、§7 CHANGE 番号運用 → change-number-registry.md。本書は M3→M4 固有の差分情報のみに圧縮。冒頭に役割明示を追加、§0 読む順序と §9 チェックリストの参照先を更新 |

---

*以上*
