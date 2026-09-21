# 指示書 M7-02: shadcn/ui 統一導入 系統 A 後半(Form + Toast + その他) + C-2/C-3/C-4 解消 + 分離パターン逸脱 4 件整理 + List API 拡張 + ComboDetailMetadata 表示項目整合

| 項目 | 内容 |
|------|------|
| 指示書ID | M7-02 |
| バージョン | 1.0.1 |
| 推奨モデル | Opus 4.6(M7-overview v1.0.1 §7 / handover §6 + Q9 ζ-1 確定。関心数 6 = 系統 A 後半 9 件移行 + B(shadcn/ui 追加) + C-2/C-3/C-4 解消 + 分離パターン 4 件解消 + 伝達 1/2 + M7-RESEARCH-03 (Q10 + Q12/Q13) = 本プロジェクト最大規模指示書、M7-01 圧縮版 844 行を上回る想定)|
| Plan Mode | **必須**(下記 §3.4.10 に必須 10 項目あり)|
| 機械レビュー | 必須(レビューモデル: Sonnet 4.6、別ファイル M7-02-review-checklist.md v1.0.0)|
| 並列性 | 単独(M7-03 以降は本指示書完了承認後に順次着手)|
| 依存指示書 | M7-01 完了承認済み(2026-05-27)+ M7-RESEARCH-03 完了承認済み(2026-05-30)+ CHANGE-018 v1.0.1 反映済み(2026-05-27)|
| 想定所要時間 | 280〜360 分(M7-01 を上回る本プロジェクト最大規模)|
| 作成者・作成日 | 設計担当 Claude(M7 期間担当)、2026-05-30 |

## 更新履歴

| バージョン | 更新日 | 更新内容 |
|-----------|--------|----------|
| 1.0.0 | 2026-05-30 | 初版作成。M7-01 完了承認 + M7-RESEARCH-03 完了承認後の Q10〜Q15 確定(2026-05-30)に基づき、系統 A 後半 + C-2/C-3/C-4 解消 + 分離パターン逸脱 4 件整理 + 伝達 1/2 + M7-RESEARCH-03 結果反映(Q10 (X) ComboDetailMetadata 表示項目変更 + Q11 (γ-2) 問題 a/d は M7-04 配分 + Q12 (P) List API 拡張 + Q13 (η-1) SetupTreeRow を M7-02 編入 + Q15 消費量表示の将来要望温存)を統合 |
| 1.0.1 | 2026-05-31 | M7-02 完了承認(2026-05-31)に伴う事後履歴整合修正。Plan Mode 反問 3 件確定(C-2 β 現状維持 / 必須項目 5 b 2 クエリ方式 / C-4 HomePage 除外)+ Q16〜Q22 確定事項(Q16 P native `<select>` 維持 / Q17 M 「(レシピなし)」統一維持 / Q18 S CompareTable "-" 維持 / Q22 案 A `api.ts:195-196` onSuccess の旧 ID invalidation 削除 + 新 ID setQueryData prefetch)を §1.3 / §2.1 / §2.2 / §3.4.10 / §4.6 / §4.7 / §7 DoD / §8.2 注意事項 に反映。本指示書本体への修正であり、製造担当の参照用途としてバージョン更新(製造完了後の後追い修正)|

---

## 1. 背景と目的

### 1.1 背景

#### 1.1.1 M7-02 の位置づけ(系統 A 後半)

M7-01(2026-05-27 完了承認)で **Dialog + Popover 系 17 件 + Header 共通化 + ハンバーガー化 + 残課題 3 解消** を実施した。M7-overview v1.0.1 §4.4 で系統 A 後半として残る範囲が本 M7-02 のスコープ:

- **自作ラッパー 9 件移行**(M7-RESEARCH-01 §4.2 (b) で特定): Form/Field 3 + Badge/Display 2 + Table/List 4
- **shadcn/ui 追加コンポーネント**: Form / Input / Select 汎用 / Checkbox / Radio / Switch / Textarea / Toast / Button / Tooltip / Badge / Card(M7-01 で導入回避した部分、本 M7-02 で一括導入)
- **C-2 / C-3 / C-4 解消**(M7-RESEARCH-01 §4.3、M7-overview §4.4)
- **architecture-patterns §1 分離パターン逸脱 4 件解消**(M7-RESEARCH-01 特記事項 7、M7-overview §4.4)
- **伝達 1 / 伝達 2 対応**(M7-01 製造工程完了報告由来、retrospective-log v1.0.24 §6.6 持ち越し課題)
- **M7-RESEARCH-03 結果反映**(Q10 (X) ComboDetailMetadata + Q12/Q13 SetupTreeRow + List API レスポンス拡張)

#### 1.1.2 M7-RESEARCH-03 結果と本指示書の関係

M7-RESEARCH-03 完了承認(2026-05-30)で以下が判明:

| 軸 | 主要発見 | M7-02 への影響 |
|----|---------|---------------|
| **指摘 1 軸 問題 b** | ComboDetailMetadata.tsx が DES-005 §5.6 item 2 規定(「**開始残量**」)と異なるフィールド(「消費量合計」)を表示している | Q10 (X) 確定 = 実装側を DES-005 規定に合わせる(CHANGE 起票不要)|
| **指摘 1 軸 問題 a / d** | バックエンドキャッシュ計算(`drive_gauge_consumed_total` 等の自動集計関数)が未実装、VAL-C06/C07 が nil 早期 return で無効化 | Q11 (γ-2) 確定 = **M7-04 編入**(本 M7-02 スコープ外)|
| **指摘 6 軸** | SetupTreeRow が完全仮実装(プレースホルダーのみ)、List API がセットプレイ情報を返さない | Q12 (P) + Q13 (η-1) 確定 = **本 M7-02 編入**(List API レスポンス拡張 + SetupTreeRow 本実装 + 展開アイコン条件表示 + ブラウザセッション保持)|
| **想定外の発見**: DES-005 §5.6 / §5.7 (b) / §5.4 の用語不統一(「開始残量」vs「ゲージ消費」)| Q10 (X) で §5.6 規定通り表示に整合、§5.4 ソート対象 + §5.7 (b) メタデータ編集対象の「ゲージ消費」は別文脈で温存 | 用語不統一は M7-02 で実装側を §5.6 に揃えるのみ、§5.4 / §5.7 (b) の規定は変更なし |
| **派生記録**: 消費量表示の将来復活余地 | Q15 (c) + (d) = §1.3 注記 + M7-05 完了承認時の m7-to-phase2-handover に正式記録 | バックエンドの `drive_gauge_consumed_total` / `sa_gauge_consumed_total` カラム + API レスポンスフィールド = **温存**(削除しない)|

#### 1.1.3 受領済み確認文書

| 確認 | 日付 | 確定内容 |
|------|------|---------|
| Q9 | 2026-05-27 | ζ-1 = 推奨モデル Opus 4.6 / Plan Mode 必須 / 想定 800〜1000 行(本指示書では指摘 6 軸編入で 1000〜1200 行に上振れ)|
| Q10 | 2026-05-30 | (X) ComboDetailMetadata を DES-005 §5.6 規定に合わせる + 消費量表示の将来要望記録 |
| Q11 | 2026-05-30 | (γ-2) バックエンドキャッシュ計算 + VAL-C06/C07 復活は M7-04 編入 |
| Q12 | 2026-05-30 | (P) List API レスポンス拡張で SetupTreeRow 本実装 |
| Q13 | 2026-05-30 | (η-1) 指摘 6 軸を M7-02 編入 |
| Q15 | 2026-05-30 | OK = (c) + (d) 併用 = §1.3 注記 + m7-to-phase2-handover 記録 |

### 1.2 目的

本指示書完了時に以下を達成する:

- **自作ラッパー 9 件が shadcn/ui ベースに移行完了**(Form/Field 3 + Badge/Display 2 + Table/List 4、案 β = shadcn/ui 標準 API 準拠、architecture-patterns v1.0.8 §1.2 と整合)
- **shadcn/ui 追加コンポーネント導入完了**(Form / Input / Select 汎用 / Checkbox / Radio / Switch / Textarea / Toast / Button / Tooltip / Badge / Card)
- **Modal 内の input / label / textarea の shadcn/ui 化完了**(M7-01 で温存した TagFormDialog 内の `<input>` / `<label>` + ModifiersEditor 内の `<textarea>` 等を Form コンポーネント体系で整理)
- **Toast 系の shadcn/ui 移行完了**(M4-03 topMessage / M5-01 活用パターンの置換)
- **C-2 解消**: VirtualController + SetupRecipeEditor の整合(ステップ変換ロジック分散の解消方針確定 + 実装)
- **C-3 解消**: LinkExistingSetupModal + SetupSelectorModal の統合判断 + 実装(両モーダルの責務統一)
- **C-4 解消**: `setup.defaultRecipe` 条件描画 3 パターン → 1 パターン統一
- **分離パターン逸脱 4 件解消**: LinkExistingSetupModal / SetupAccordionItem / TagSelector / TagFormDialog の `useMutation` / 内部バリデーション / 内部 useState を呼び出し側ロジックフックに分離(architecture-patterns v1.0.7 §1)
- **伝達 1 解消**: TagSelector の cmdk 再採用判断(テスト戦略込み)
- **伝達 2 解消**: Dialog scroll 制約パターンの正式化(architecture-patterns v1.0.8 §7 候補 → v1.0.9 で正式 §7 化、全 Dialog 一括適用)
- **指摘 6 軸解消**: List API レスポンス拡張(セットプレイ情報を含むネスト構造、N+1 回避設計込み)+ SetupTreeRow 本実装 + 展開アイコン条件表示 + ブラウザセッション保持
- **指摘 1 軸 問題 b 解消**: ComboDetailMetadata.tsx の表示項目を `drive_available_at_start` / `sa_available_at_start`(開始残量)に変更 + i18n キーラベル変更
- 既存機能(M1〜M6 + M7-01)に回帰なし

### 1.3 このマイルストーンで作らないもの

| 項目 | 送り先 / 理由 |
|------|------------|
| **バックエンドキャッシュ計算(`drive_gauge_consumed_total` / `sa_gauge_consumed_total` 自動集計関数)+ VAL-C06/C07 復活** | M7-04(Q11 γ-2 確定、M7-RESEARCH-03 §1.5 特記事項 2 = `moves` テーブルの `drive_gauge_increase` 等の存在確認も M7-04 着手前に必要)|
| **ComboDetailMetadata.tsx の「消費量」表示復活** | フェーズ 2 以降の将来候補要望(Q15 (c) + (d) 確定、本 M7-02 では DES-005 §5.6 規定通り「開始残量」表示に変更、ただし **バックエンドの `drive_gauge_consumed_total` / `sa_gauge_consumed_total` カラム + API レスポンスフィールド = 温存**、削除しない。`m7-to-phase2-handover.md`(M7-05 完了承認時作成)に正式記録予定)|
| **指摘 1 軸関連の `moves` テーブル `drive_gauge_increase` / `sa_gauge_increase` カラム追加** | M7-04(本指示書スコープ外、M7-04 着手前に M7-RESEARCH-04 で確認するか M7-04 内で対応するかは別判断)|
| **本格スマホ UI 整備**(DES-005 §5.6 / §5.8 / §5.9 / §5.10 / §7 のカード形式 / アコーディオン / ボトムシート / スワイプ)| フェーズ 3 以降(M7-overview §2.9 案 Y 採用)|
| **R-1 / R-2 / R-3 解消(レスポンシブ仕上げ)** | M7-03 |
| **残り 4 プリセット + AKI + 残り 3 キャラ + スキーマ耐久テスト** | M7-04 |
| **リファクタ + 統合 E2E + スマホ LAN 検証 + フェーズ 1 完了判定** | M7-05 |
| **設計書本体(REQ-001 / DES-001〜006)改訂** | 本指示書スコープ内では起票見込みなし(Q10 (X) で DES-005 §5.6 規定通りに整合、CHANGE-019 起票回避 = playbook §17.2 過剰な手順化の警戒)|
| **P-1(プリセット管理画面)/ 残課題 1(Step 6 パスワード)/ 残課題 4(LAN CORS/CSRF)** | フェーズ 2 |
| **L-02 / L-03 / L-04 / M-1〜M-4 / スマホ LAN 実機検証(U-1)/ 日英切替不適応(U-4)** | M7-05 / 温存 |
| **ModifiersEditor の `console.warn` 残存(P-01)** | 別観点で温存(M7-01 と同じ判断、本指示書では触らない)|
| **PromoteToFinalButton の独立コンポーネント化** | フェーズ 2 以降の検討(M7-01 で AlertDialog 置換のみ実施済み、本 M7-02 でも独立コンポーネント化までは扱わない)|
| **Header 非表示 4 ページの現状維持(案 A)継続** | M7-01 確定方針継続(本 M7-02 でも Header に追加要素 = プリセット切替/言語切替/ユーザー表示/モード表示は実装しない、フェーズ 2 以降送り)|
| **Header 内の追加要素(プリセット切替 / 言語切替 / ユーザー表示 / モード表示)** | フェーズ 2 以降(M7-overview §2.9)|
| **i18n 英語ロケール整備** | フェーズ 3 送り(M7-overview §2.1)、本指示書のラベル変更(Q10 (X) 由来「ドライブゲージ消費」→「ドライブゲージ開始残量」)は日本語のみ |
| **virtual-controller-layout-v1 ブラウザストレージ** | フェーズ 3 送り |
| **C-2 共通フック(useStepConverter.ts)新設** | M7-02 確定で (β) 現状維持採用 = 共通フック新設しない(2026-05-30 Plan Mode 反問 C-2、`Step` と `SetupStepInput` の型構造差異が深く共通化コスト > 利得、retrospective-log v1.0.25 §6.6 M7-9 由来) |

---

## 2. 成果物

### 2.1 作成するファイル

#### shadcn/ui 追加コンポーネント(`pnpm dlx shadcn-ui@latest add` で生成)

- `web/src/components/ui/form.tsx`(shadcn/ui Form + react-hook-form ベース)
- `web/src/components/ui/input.tsx`
- `web/src/components/ui/label.tsx`(M7-01 では追加回避、本 M7-02 で Form 全体と一括追加)
- `web/src/components/ui/switch.tsx`(必要時のみ、Plan Mode 必須項目 1 で確定)
- `web/src/components/ui/button.tsx`
- `web/src/components/ui/tooltip.tsx`(必要時のみ、§3.4.10 必須項目 1)
- `web/src/components/ui/badge.tsx`
- `web/src/components/ui/card.tsx`
- `web/src/components/ui/sonner.tsx` または `toast.tsx`(shadcn/ui の Toast = `sonner` ライブラリ採用が標準、Plan Mode 必須項目 6 で確定)
- 最終確定リストは §3.4.10 必須項目 1 で Plan Mode 確定

#### 分離パターン逸脱解消のためのロジックフック新設

architecture-patterns v1.0.7 §1 + v1.0.8 §1.2 準拠で、コンポーネント内に直接保持されている `useMutation` / Zod / `useState` を以下のロジックフックに分離:

- `web/src/features/setup/hooks/useLinkExistingSetupForm.ts`(新設、LinkExistingSetupModal の `useCharacterSetups` + `useCreateSetupLink` の分離)
- `web/src/features/setup/hooks/useSetupAccordionActions.ts`(新設、SetupAccordionItem の `useDeleteSetupLink` の分離)
- `web/src/features/tag/hooks/useTagSelectorForm.ts`(新設、TagSelector の `useTagManagement().createMutation` + creating 状態の分離)
- `web/src/features/tag/hooks/useTagFormDialog.ts`(新設、TagFormDialog の `useState`×5 + Zod バリデーションロジックの分離)
- 命名・配置は §3.4.10 必須項目 7 で Plan Mode 確定(各 features ディレクトリの `hooks/` 配下を推奨、既存ロジックフックの配置慣例に整合)

#### 新規テスト

- 上記 4 ロジックフックそれぞれの単体テスト(`*.test.ts`)
- shadcn/ui Form 関連の単体テスト(必要時)
- 既存テストの修正は §2.2 D

### 2.2 修正するファイル

#### A. 系統 A 後半 自作ラッパー 9 件 → shadcn/ui ベースへの差し替え

**共通方針**(全 9 件に適用、architecture-patterns v1.0.8 §1.2 shadcn/ui 統一導入パターン準拠):

- shadcn/ui の Form / Input / Select / Checkbox / Switch / Button / Tooltip / Badge / Card / Table 体系で再構築
- Props 命名: 既存契約を可能な範囲で維持しつつ、shadcn/ui 慣例(`open` / `onOpenChange` / `value` / `onValueChange` 等)に整合
- 内部状態 / `useState` / `useMutation` は **基本的に維持**(分離パターン逸脱解消対象 4 件のみ別途分離、§2.2 D 系統)

| # | 系統 | ファイル | shadcn/ui 対応 | 個別差分 |
|---|------|---------|--------------|---------|
| 1 | Form/Field | `combo/ComboEditorBasicFields.tsx` | `form` + `input` + `label` ベースに再構築、**native `<select>` 6 件は維持**(Radix Select の `value=""` 制約により、「(未指定)」プレースホルダー UX を保つため、CSS クラスのみ `border-input bg-background` に統一、Q16 (P) 確定 2026-05-31) | 内部 `useMemo` 維持、フィールド計算ロジック温存 |
| 2 | Form/Field | `setup/SetupBasicInfoForm.tsx` | 同上 | `useQuery`(キャラ名取得)維持 |
| 3 | Form/Field | `combo/ComboListFilters.tsx` | 同上 + **native `<select>` 7 件は維持**(同上の Radix Select 制約理由)| ステートレス維持 |
| 4 | Badge/Display | `tag/TagBadgeList.tsx` | `badge` ベースに置換 | ステートレス維持 |
| 5 | Badge/Display | `combo/ValidationDisplay.tsx` | shadcn/ui 公式コンポーネント提供なし、`card` + `badge` で構築 | ステートレス維持 |
| 6 | Table/List | `combo/ComboTable.tsx` | shadcn/ui `table` + `checkbox`(チェックボックス列)+ **指摘 6 軸 SetupTreeRow 本実装連動**(§2.2 F)+ **native `<select>` 維持**(Radix Select の `value=""` 制約により、列表示設定 + filter select 等の native `<select>` は CSS クラスのみ統一、Q16 (P) 確定 2026-05-31)| `useState`(expandedId)→ ブラウザセッション保持仕様に変更(Q12 (P) 由来、§3.4.10 必須項目 10) |
| 7 | Table/List | `combo/CompareTable.tsx` | `table` ベースに置換 | ステートレス維持 |
| 8 | Table/List | `combo/TrashList.tsx` | `table` + `checkbox` ベースに置換 | `useState`(indeterminate 制御)維持 |
| 9 | Table/List | `tag/TagListTable.tsx` | `table` + `button` ベースに置換 + **M7-01 追加タスクで実装したシステムタグ表示制御 = 温存**(`category === "mycombo_status"` 行で編集・削除ボタン非表示)| シニア状態管理影響なし |

#### B. Modal 内の input / label / textarea の shadcn/ui 化(M7-01 で温存した部分)

M7-01 で「Form 全体は M7-02」と温存した Modal 内のネイティブ要素を shadcn/ui Form / Input / Label / Textarea に置換:

- `combo/KnockdownAdvantageChangeModal.tsx`: M7-01 で内部 radio / checkbox は shadcn/ui 化済み、本 M7-02 では Modal 内に input / textarea があれば追加で shadcn/ui 化(基本的に追加対象なし、view で確認)
- `combo/ModifiersEditor.tsx`: M7-01 で内部 checkbox / radio / textarea は shadcn/ui 化済み、本 M7-02 では input / label の残存があれば置換、`useState`×3 / `useEffect`(notes 文字数警告)は維持(`console.warn` 残存は P-01 別観点で継続温存)
- `tag/TagFormDialog.tsx`: M7-01 で温存した内部 `<input>` / `<label>` を shadcn/ui Form / Input / Label に置換、内部 `useState`×5 + Zod バリデーションは §2.2 D 分離パターン逸脱解消で別フックに分離(下記 D-4)

#### C. Toast 系の shadcn/ui 移行

M4-03 由来 topMessage パターン + M5-01 活用パターンを shadcn/ui Toast(sonner ベースが標準)に置換。具体的な対象ファイルは §3.4.10 必須項目 6 で Plan Mode 確定。基本方針:

- 既存の topMessage 表示箇所を `useToast()` / `toast.success(...)` / `toast.error(...)` 等の shadcn/ui Toast API に置換
- M5-01 で確立された「保存完了トースト」「セットプレイ引き継ぎ通知トースト」等の UX を維持

#### D. 分離パターン逸脱 4 件解消

architecture-patterns v1.0.7 §1 + v1.0.8 §1.2 準拠、各コンポーネントから `useMutation` / `useState` / Zod を **新設ロジックフック**(§2.1)に分離:

| # | 対象コンポーネント | 分離対象 | 新設ロジックフック | 呼び出し元修正 |
|---|----------------|---------|-----------------|--------------|
| D-1 | `setup/LinkExistingSetupModal.tsx` | `useCharacterSetups`(useQuery)+ `useCreateSetupLink`(useMutation)| `useLinkExistingSetupForm.ts` 新設 | ComboDetailPage / コンボ新規登録画面の呼び出し側で hook 呼出 |
| D-2 | `setup/SetupAccordionItem.tsx` | `useDeleteSetupLink`(useMutation)| `useSetupAccordionActions.ts` 新設 | ComboDetailPage の呼び出し側で hook 呼出 |
| D-3 | `tag/TagSelector.tsx` | `useTagManagement().createMutation`(useMutation)+ `useState`(creating)| `useTagSelectorForm.ts` 新設 | ComboEditorBasicFields の呼び出し側で hook 呼出 |
| D-4 | `tag/TagFormDialog.tsx` | `useState`×5 + `useEffect` + Zod バリデーション + onSubmit ロジック | `useTagFormDialog.ts` 新設 | TagManagementPage の呼び出し側で hook 呼出 |

#### E. C-2 / C-3 / C-4 解消

##### C-2: VirtualController + SetupRecipeEditor の整合

VirtualController は presentation-only、ステップ変換ロジック(`StepInput` → `Step` / `SetupStepInput`)は RecipeBuilder.tsx + SetupRecipeEditor.tsx の各ハンドラに分散している現状(M7-RESEARCH-01 §4.3 (b))。解消方針は §3.4.10 必須項目 8 で Plan Mode 確定:

- **候補 (α)**: ステップ変換ロジックを共通フック(`useStepConverter.ts` 等)に集約、各呼び出し元から再利用
- **候補 (β)**: 現状維持(分散ロジックを正常状態として承認、本 M7-02 で C-2 解消対象から除外)
- **設計担当の暫定推奨**: **候補 (α)**(architecture-patterns §1 分離パターンとの整合、再利用性向上)

##### C-3: LinkExistingSetupModal + SetupSelectorModal の統合判断

両モーダルの差異(M7-RESEARCH-01 §4.3 (b)):
- LinkExistingSetupModal: 紐付け mutation を内部完結(クリック → mutate → onSuccess → close)
- SetupSelectorModal: 選択を callback 委譲(クリック → onSelect(setup) → 呼び出し元が後続処理)

統合判断は §3.4.10 必須項目 9 で Plan Mode 確定:

- **候補 (γ)**: 両者を分離パターン D-1 解消後の方式に統一 = 選択 callback 委譲方式に統一(SetupSelectorModal の責務を採用)、呼び出し元(ComboDetailPage / コンボ新規登録画面)で hook 呼出 + 後続処理
- **候補 (δ)**: 統合せず別コンポーネントとして残す(責務が異なるため統合不要、本 M7-02 で C-3 解消対象から除外)
- **設計担当の暫定推奨**: **候補 (γ)**(D-1 分離パターン解消と整合、responsibility 統一)

##### C-4: `setup.defaultRecipe` 条件描画パターン統一

3 パターン → 1 パターン統一(M7-RESEARCH-01 §4.3 (c)):
- パターン 1: `{value && (<element>)}` = 空文字列で非表示(2 箇所)
- パターン 2: `{value || "フォールバック"}` = 空文字列にフォールバック表示(5 箇所)
- パターン 3: `{value}` = 条件なし直接表示(2 箇所)

統一方針は §3.4.10 必須項目 10 で Plan Mode 確定:

- **候補 (ε)**: パターン 2 に統一(`{value || "—"}` または `{value || "(レシピなし)"}`、フォールバック文字列は実装統一)
- **候補 (ζ)**: パターン 1 に統一(`{value && (<element>)}`、空文字列で要素自体非表示)
- **設計担当の暫定推奨**: **候補 (ε)**(現状最多パターン = 5 箇所、フォールバック文字列で「レシピなし」を明示する方が UX 上わかりやすい、SetupAccordionItem の既存実装と整合)

#### F. 指摘 6 軸: SetupTreeRow 本実装 + List API レスポンス拡張(Q12 + Q13 確定)

##### F-1: List API レスポンス拡張(バックエンド)

- `repository.go` の List クエリで `combo_setups` テーブルを LEFT JOIN(N+1 回避設計、Plan Mode 必須項目 5 で具体方式確定)
- `handler.go` の `toComboResponse(combo, setups)` 呼び出し側で setups を渡す
- `ComboResponse.Setups` フィールドの JSON タグを `json:"setups"` のまま温存(現状 `null` 返却から実値返却に変更)
- セットプレイ情報の構造は ComboDetailPage で使用される `SetupResponse` と同型(レシピ含む、フロント側 SetupTreeRow が必要とする情報を含む)

##### F-2: SetupTreeRow 本実装(フロント)

- `combo/SetupTreeRow.tsx` を本実装に改修:
  - Props 拡張: `{ setups: SetupResponse[]; colSpan: number; onSetupClick?: (setupId: number) => void; }`
  - DES-005 §5.4 表示例に従う描画(`└ セットプレイ名 [レシピ]` のインデント付き表示)
  - セットプレイがない場合は本コンポーネント自体を呼出元で非表示にする(展開アイコン条件表示と連動、§F-3)
  - クリック時の onSetupClick callback でセットプレイ編集画面遷移

##### F-3: 展開アイコン条件表示 + ブラウザセッション保持

- `combo/ComboTable.tsx` または `ComboTableRow.tsx`:
  - 展開アイコン(`ChevronDown` / `ChevronRight`)を `combo.setups.length > 0` で条件表示(DES-005 §5.4 規定整合)
  - 展開状態を React `useState`(現状)から **ブラウザセッション保持**(`sessionStorage` または `useSessionStorage` hook、Plan Mode 必須項目 10 で確定)に変更
  - キー設計: `combo-list-expanded-ids-v1` 等(architecture-patterns v1.0.8 §5 ブラウザストレージ運用と整合、Plan Mode 必須項目 10)

#### G. ComboDetailMetadata 表示項目変更(Q10 (X) 確定)

- `combo/components/ComboDetailMetadata.tsx`(または相当パス、§3.4.2 で view 確認):
  - 表示フィールドを `driveGaugeConsumedTotal` / `saGaugeConsumedTotal`(消費量合計) → `driveAvailableAtStart` / `saAvailableAtStart`(開始残量)に変更
  - i18n キーラベル変更: `comboDetail.metadata.driveGauge` の値 "ドライブゲージ消費" → "ドライブゲージ開始残量"、`comboDetail.metadata.saGauge` の値 "SAゲージ消費" → "SAゲージ開始残量"
  - 表示ロジック自体は維持(値があれば表示、nil/undefined なら "-" 表示)
- **バックエンドの `drive_gauge_consumed_total` / `sa_gauge_consumed_total` カラム + API レスポンスフィールドは温存**(削除しない、Q15 確定 = 将来要望復活余地温存)
- フロント型定義の `driveGaugeConsumedTotal` / `saGaugeConsumedTotal` フィールドも **温存**(削除しない、API レスポンスとの整合維持)

#### H. 伝達 1 対応: TagSelector の cmdk 再採用判断

- M7-01 で cmdk(Command コンポーネント)を不採用にした(jsdom で ResizeObserver / scrollIntoView 未実装でテスト不能、Popover + ネイティブ input + カスタムリストで代替実装)
- M7-02 で TagSelector の分離パターン逸脱解消(§2.2 D-3)と統合し、cmdk 再採用の可否を判断
- 判断は §3.4.10 必須項目 4 で Plan Mode 確定:
  - **候補 (η)**: cmdk 再採用(jsdom モック追加 or テスト戦略変更)
  - **候補 (θ)**: cmdk 不採用継続(M7-01 と同じ代替実装、シンプル維持)
  - **設計担当の暫定推奨**: **候補 (θ)**(M7-01 実装受け入れ済み、テスト戦略変更コストが利得を上回らない見込み。ただし shadcn/ui エコシステム準拠の観点では (η) も一考の余地あり、Plan Mode で開発者協議)

#### I. 伝達 2 対応: Dialog scroll 制約パターンの正式化

- architecture-patterns v1.0.8 §7 で「リストを含む Dialog の scroll 制約パターン候補」として記録、M7-02 で正式パターン化判断
- 全 Dialog 一括適用検討:
  - LinkExistingSetupModal(M7-01 修正済み)
  - AddComboToCompareModal
  - SetupSelectorModal
  - KnockdownAdvantageChangeModal(individual モード)
  - その他リストを含む Dialog があれば §3.4.2 で view 確認時に特定
- 適用方針は §3.4.10 必須項目 3 で Plan Mode 確定:
  - **候補 (a)**: 全 Dialog 統一適用(`components/ui/dialog.tsx` の DialogContent デフォルトスタイルに `max-h-[85vh] overflow-y-auto` 統一)
  - **候補 (b)**: リスト含む Dialog のみ個別適用(呼び出し側 className 指定)
  - **候補 (c)**: 内部リスト要素に `max-h-[60vh] overflow-y-auto`(Dialog 全体ではなく)
  - **設計担当の暫定推奨**: **候補 (c) を基本 + 候補 (a) を fallback** の二段構え(architecture-patterns v1.0.8 §7.5 既明示)
- M7-02 完了承認時に architecture-patterns v1.0.9 で §7 を正式パターン化(タイトルから「候補」を取る)+ retrospective-log v1.0.25 §7.2 M7-3 候補の追加観察に統合判断

### 2.3 変更しないもの(原則)

- バックエンドキャッシュ計算(`drive_gauge_consumed_total` / `sa_gauge_consumed_total` 自動集計関数)+ VAL-C06/C07 復活(M7-04 Q11 γ-2)
- ComboDetailMetadata.tsx の「消費量」フィールド型定義 + バックエンドカラム + API レスポンスフィールド(温存、Q15 確定)
- 本格スマホ UI 整備(フェーズ 3 以降)
- R-1 / R-2 / R-3(M7-03)
- 残り 4 プリセット + AKI + 残り 3 キャラ + スキーマ耐久テスト(M7-04)
- リファクタ + 統合 E2E + スマホ LAN 検証 + フェーズ 1 完了判定(M7-05)
- 設計書本体(REQ-001 / DES-001〜DES-006)= **改訂見込みなし**(Q10 (X) で DES-005 §5.6 規定通りに整合)
- 補足資料(SUPP-001 / playbook / handover / CLAUDE.md / change-number-registry)= **改訂見込みなし**(M7-02 完了承認時に retrospective-log v1.0.25 + architecture-patterns v1.0.9 を別タイミングで自由改訂)
- ModifiersEditor の `console.warn` 残存(P-01)
- PromoteToFinalButton の独立コンポーネント化(M7-01 で AlertDialog 置換のみ実施済み、本指示書では触らない)
- Header 共通コンポーネント(M7-01 で確立済み、本指示書では触らない)
- Header 非表示 4 ページの現状維持(M7-01 案 A 確定方針継続)
- 既存 routes 定義
- `web/src/components/Footer.tsx`(M6-03 確立、本指示書では触らない)
- `App.tsx` の `useIsMobile()` + リダイレクト分岐(M6-03 確立)
- M7-01 で確立した `components/ui/` 配下の既存 12 コンポーネント(`dialog.tsx` / `alert-dialog.tsx` / `sheet.tsx` / `popover.tsx` / `dropdown-menu.tsx` / `select.tsx` / `tabs.tsx` / `accordion.tsx` / `command.tsx` / `checkbox.tsx` / `radio-group.tsx` / `textarea.tsx`)= **変更しない**(本 M7-02 では追加コンポーネント 9 件程度を `add` するのみ、既存コンポーネント本体への独自カスタマイズなし、案 β 準拠)

### 2.4 例外条項

本指示書スコープ内で実施を **許容** する例外:

| 項目 | 内容 |
|------|------|
| (a) 依存追加 | shadcn/ui 追加コンポーネント `add` 時の依存(`@radix-ui/react-tooltip` / `@radix-ui/react-switch` / `react-hook-form` / `@hookform/resolvers` / `zod`(既導入)/ `sonner` 等)、CLAUDE.md §6 ポリシー準拠、Plan Mode 必須項目 1 で承認 |
| (b) shadcn/ui 追加コンポーネント新設 | `components/ui/` 配下に 9 件程度を追加(§2.1 既明示) |
| (c) ロジックフック新設 | `features/*/hooks/` 配下に 4 件新設(§2.1 既明示、分離パターン逸脱解消) |
| (d) 自作ラッパー 9 件の shadcn/ui ベース差し替え + 呼び出し元修正 | §2.2 A 既明示 |
| (e) Modal 内の input / label / textarea の shadcn/ui 化 | §2.2 B(M7-01 で温存した部分) |
| (f) Toast 系の shadcn/ui 移行 | §2.2 C |
| (g) C-2 / C-3 / C-4 解消 | §2.2 E(Plan Mode 必須項目 8 / 9 / 10 で方針確定) |
| (h) List API レスポンス拡張 + SetupTreeRow 本実装 + 展開アイコン条件表示 + ブラウザセッション保持 | §2.2 F(指摘 6 軸、Q12 + Q13 確定) |
| (i) ComboDetailMetadata 表示項目変更 + i18n ラベル変更 | §2.2 G(Q10 (X) 確定、CHANGE 起票なし) |
| (j) Dialog scroll 制約パターン適用 | §2.2 I(伝達 2 対応) |
| (k) `web/src/components/ui/dialog.tsx` の DialogContent デフォルトスタイル拡張(Plan Mode 必須項目 3 で候補 (a) 採用時のみ) | shadcn/ui CLI 生成コードへの独自カスタマイズが発生する例外、Plan Mode で承認 |

**許容しないもの**: §2.3 既明示の全項目 + 新規 CHANGE 通知書起票(本指示書スコープ内で見込みなし、必要発生時は Plan Mode 停止 → 開発者協議)+ DES-005 / その他設計書本体の改訂

---

## 3. 前提条件

### 3.1 必読ドキュメント

製造担当は実装着手前に以下を読了する:

- `docs/instructions/M7-overview.md` v1.0.1(本マイルストーン全体像)
- `docs/instructions/M7-RESEARCH-01-report.md`(本指示書の主要事実根拠 = 自作ラッパー 9 件 + C-2/C-3/C-4 + 特記事項 7)
- `docs/instructions/M7-RESEARCH-03-report.md`(指摘 1 軸 + 指摘 6 軸の事実根拠)
- `docs/instructions/M7-01-shadcn-ui-dialog-popover-and-header.md` v1.0.0(M7-01 本体、shadcn/ui 統一導入の前半、本指示書はこれを継承)
- `docs/instructions/M7-01-additional-tasks.md` v1.0.1(M7-01 追加タスク、システムタグ表示制御 + ComboEditorPage 修正)
- `docs/design/05-screen-design.md` v2.11.0 §5.4 / §5.6 / §5.7 / §5.9 / §5.12(CHANGE-018 v1.0.1 反映済み)
- `docs/design/02-architecture.md` v1.8.0 §5.3(スタイリング)
- `docs/design/03-data-model.md` §341-342 / §376-380(ゲージ消費キャッシュ規定、本 M7-02 では集計実装しないが温存対象として理解)
- `docs/design/06-validation.md` VAL-C06 / VAL-C07(現状無効化、M7-04 で復活予定)
- `docs/handover/design-instruction-playbook.md` v1.9.0 §4.6 / §4.9 / §8.4 / §17.2
- `docs/handover/architecture-patterns.md` v1.0.8 §1(プレ層/ロジック層分離) + §1.1(queryKey 規約)+ **§1.2 shadcn/ui 統一導入パターン**(M7-01 確立)+ §6 調査担当運用パターン + **§7 Dialog scroll 制約パターン候補**(本 M7-02 で正式化判断)
- `docs/handover/retrospective-log.md` v1.0.24 §1 構造的アンチパターン + §6.6 M7 着手後課題 + §6.7 / §6.8 / §6.9 運用知見 + §7.2 M7-3 候補
- `docs/handover/m6-to-m7-handover.md`(M6 完了状態 + 持ち越し)
- `docs/handover/change-number-registry.md` v1.7.0(次回採番 019、本指示書スコープ内では起票見込みなし)
- `CLAUDE.md`(§2 技術スタック + §6 依存追加ポリシー + §10 開発時の注意事項)

### 3.2 任意参照(必要時のみ)

- `docs/design/requirements.md` v2.12.0(NFR301-302 / NFR306)
- `docs/instructions/M4-01-*.md`(SetupTreeRow の経緯把握 = M7-RESEARCH-03 §2.5 関連、本 M7-02 で SetupTreeRow 本実装する根拠補強)
- `docs/instructions/M4-02-*.md`(コンボ詳細でのセットプレイ展開実装、M7-02 で List API レスポンス拡張時の参考)
- `docs/instructions/M5-01-*.md`(Toast 活用パターン)
- `docs/instructions/M4-03-*.md`(topMessage パターン)
- shadcn/ui 公式 https://ui.shadcn.com/docs/components
- react-hook-form 公式 https://react-hook-form.com/
- sonner 公式 https://sonner.emilkowal.ski/
- shadcn/ui Toast → sonner 統合 https://ui.shadcn.com/docs/components/sonner

### 3.3 参照不要

- フェーズ 2 / 3 機能の REQ-001 §7 / §6.2-6.5
- M5-RESEARCH-01 / M6-RESEARCH-01 報告書(M7-RESEARCH-01 / M7-RESEARCH-03 で十分)
- 過去 handover アーカイブ(`handover_1.md` / `m1-to-m2` / ...)
- M4-00 / M4-00b 指示書(P-01 関連、本指示書では ModifiersEditor の `console.warn` 残存は触らない)

---
### 3.4 着手前の確認

§4 詳細仕様の実装に着手する前に以下を **すべて** 完了し、結果を Plan Mode 計画提示時に開発者報告する。**§3.4.9 対応表 + §3.4.10 Plan Mode 必須項目 10 件** が本節の中核(M6-3〜M6-6 + M7-5 連続発生の再発防止策、handover §5.2 + retrospective-log v1.0.24 §6.6 + playbook v1.9.0 §4.9)。

#### 3.4.1 既存ファイル構造の確認

- [ ] `web/package.json` の現状依存を確認(M7-01 完了後の状態 = `@radix-ui/react-*` 12 件 + `class-variance-authority` / `tailwind-merge` / `clsx` / `lucide-react` 等が導入済み、本 M7-02 で追加するのは Form 関連 + Toast 関連 + Tooltip / Switch / Button / Badge / Card 関連)
- [ ] `web/tailwind.config.js` の現状確認(M7-01 で `darkMode` / `theme.extend.colors` / `borderRadius` + `tailwindcss-animate` plugin が反映済み)
- [ ] `web/src/components/ui/` 配下の現状確認(M7-01 で生成された 12 コンポーネント = `dialog.tsx` / `alert-dialog.tsx` / `sheet.tsx` / `popover.tsx` / `dropdown-menu.tsx` / `select.tsx` / `tabs.tsx` / `accordion.tsx` / `command.tsx` / `checkbox.tsx` / `radio-group.tsx` / `textarea.tsx`)
- [ ] `web/src/lib/utils.ts` の `cn()` 関数の現状確認(M7-01 で確立済み、変更不要)
- [ ] `web/src/components/Header.tsx`(M7-01 確立)の現状確認(変更不要、本 M7-02 では触らない)
- [ ] `web/src/components/Footer.tsx`(M6-03 確立)の現状確認(変更不要)

#### 3.4.2 既存自作ラッパー 9 件 + Modal 内残存要素の view 確認(playbook v1.9.0 §4.9、最重要)

§2.2 A の 9 件 + §2.2 B の Modal 内残存要素を view で **構造 + 責務 + Props の 3 点セット** 再確認。M7-RESEARCH-01 §4.2 (b) + M7-01 完了状態との一致 / 差分を Plan Mode 計画提示時に明示(M7-01 完了から M7-02 着手間の追加修正があれば検出):

**Form/Field 系 3 件**:
- `combo/ComboEditorBasicFields.tsx`
- `setup/SetupBasicInfoForm.tsx`
- `combo/ComboListFilters.tsx`

**Badge/Display 系 2 件**:
- `tag/TagBadgeList.tsx`
- `combo/ValidationDisplay.tsx`

**Table/List 系 4 件**:
- `combo/ComboTable.tsx`(指摘 6 軸 F-3 で展開アイコン条件表示 + ブラウザセッション保持変更も含む)
- `combo/CompareTable.tsx`
- `combo/TrashList.tsx`
- `tag/TagListTable.tsx`(M7-01 追加タスクのシステムタグ表示制御を維持確認)

**Modal 内残存要素**(M7-01 で温存した部分):
- `tag/TagFormDialog.tsx` 内の `<input>` / `<label>` の view 確認(§2.2 B 対象)
- `combo/ModifiersEditor.tsx` 内に input / label の残存があるか view 確認(基本なしの想定だが念のため)
- `combo/KnockdownAdvantageChangeModal.tsx` 内に input / label / textarea の残存があるか view 確認

#### 3.4.3 既存呼び出し元 + 分離パターン逸脱 4 件の view 確認

§2.2 D の分離対象 4 件 + 呼び出し元の view 確認:

- `setup/LinkExistingSetupModal.tsx`(D-1)+ 呼び出し元 ComboDetailPage / コンボ新規登録画面ページ(コンボ新規登録画面ページの正確なファイル名は §3.4.5 で特定済み = `grep -rn "LinkExistingSetupModal" web/src/`)
- `setup/SetupAccordionItem.tsx`(D-2)+ 呼び出し元 ComboDetailPage
- `tag/TagSelector.tsx`(D-3)+ 呼び出し元 ComboEditorBasicFields(M7-01 移行済み)
- `tag/TagFormDialog.tsx`(D-4)+ 呼び出し元 TagManagementPage

各コンポーネントの内部 `useMutation` / `useQuery` / `useState` / Zod の **完全列挙** + 分離方針(§2.1 ロジックフック新設)の影響範囲確定。

#### 3.4.4 C-2 / C-3 / C-4 関連の view 確認

##### C-2:
- `combo/components/VirtualController/VirtualController.tsx`
- `combo/components/RecipeBuilder.tsx`(VirtualController 呼出 + ステップ変換ロジック)
- `setup/components/SetupRecipeEditor.tsx`(VirtualController 呼出 + ステップ変換ロジック)

##### C-3:
- `setup/components/LinkExistingSetupModal.tsx`(内部完結方式)
- `combo/components/SetupSelectorModal.tsx`(callback 委譲方式)
- 両者の責務差異 + 統合候補 (γ) / (δ) の検討材料

##### C-4(15 箇所):
- M7-RESEARCH-01 §4.3 (c) で網羅された 9 ファイル × パターン 1/2/3 の混在状態を view 確認
- 統合候補 (ε) / (ζ) の検討材料

#### 3.4.5 指摘 6 軸 SetupTreeRow + List API の現状確認

- `combo/components/SetupTreeRow.tsx`(M7-RESEARCH-03 §2.1 で現状仮実装と判明、プレースホルダーテキスト「紐付くセットプレイはありません」のみ表示)
- `combo/components/ComboTable.tsx` / `ComboTableRow.tsx`(展開アイコン表示制御 + 展開状態管理)
- バックエンド `repository.go` の List クエリ(M7-RESEARCH-03 §2.3 で `combo_setups` テーブル JOIN なしと判明)
- バックエンド `handler.go` の `toComboResponse(combo, nil)` 呼び出し箇所
- `ComboResponse.Setups` フィールドの JSON タグ + 型定義

#### 3.4.6 ComboDetailMetadata 現状 + Q10 (X) 変更対象の view 確認

- `combo/components/ComboDetailMetadata.tsx`(M7-RESEARCH-03 §1.1 で現状確認済み、表示フィールド = `driveGaugeConsumedTotal` / `saGaugeConsumedTotal`、i18n キー = `comboDetail.metadata.driveGauge` / `comboDetail.metadata.saGauge`)
- フロント型定義の `ComboDetail` / `Combo` 型(`driveGaugeConsumedTotal` / `saGaugeConsumedTotal` + `driveAvailableAtStart` / `saAvailableAtStart` 両方のフィールド有無確認)
- i18n キーファイル(`web/src/locales/ja.json` または相当)で `comboDetail.metadata.driveGauge` / `comboDetail.metadata.saGauge` の現状値確認
- バックエンド `model/combo.go` の `Combo` 構造体(`DriveGaugeConsumedTotal` / `SAGaugeConsumedTotal` + `DriveAvailableAtStart` / `SAAvailableAtStart` の JSON タグ確認)
- バックエンド `handler` レスポンス DTO(`drive_available_at_start` / `sa_available_at_start` フィールドが含まれているか確認)

#### 3.4.7 Toast 系現状 + shadcn/ui Toast 移行対象の特定

- `grep -rn "topMessage\|showToast\|setMessage" web/src/`(M4-03 topMessage パターン + M5-01 活用パターンの使用箇所網羅)
- 既存 Toast 表示コンポーネント / フック / 状態管理の view 確認
- shadcn/ui Toast(sonner ベース)への移行対象を Plan Mode 計画提示時に列挙

#### 3.4.8 shadcn/ui 追加コンポーネント + 依存追加の事前確認

- [ ] shadcn/ui Vite プロジェクト向け追加コンポーネントの仕様確認(https://ui.shadcn.com/docs/components)
- [ ] `pnpm dlx shadcn-ui@latest add form input label button switch tooltip badge card sonner` 等の対話入力項目 + 自動追加依存の事前列挙(§3.4.10 必須項目 1 で確定)
- [ ] react-hook-form + zod 統合パターンの確認(shadcn/ui Form コンポーネントが要求する形)

#### 3.4.9 対応表の作成(M6-6 + M7-5 反省踏襲、最重要、UI 全範囲スコープ拡張)

製造担当は §4 着手前に **対応表 6 表(A〜F)** を完全に埋めた状態を Plan Mode 計画提示する。これは M6-3〜M6-6 + M7-5(CHANGE-018 v1.0.0 起票時の §5.7 多モード性見落とし)の再発防止策。

##### 表 A: shadcn/ui 追加コンポーネント対応表(§3.4.10 必須項目 1 で確定)

| 項目 | M7-01 完了時点 | M7-02 アクション | 確認結果(製造担当が埋める)|
|------|--------------|----------------|---------------------|
| `form.tsx` | 未存在 | `add` で追加 | |
| `input.tsx` | 未存在 | 同上 | |
| `label.tsx` | 未存在 | 同上 | |
| `button.tsx` | 未存在 | 同上 | |
| `switch.tsx` | 未存在 | 必要時のみ | |
| `tooltip.tsx` | 未存在 | 必要時のみ | |
| `badge.tsx` | 未存在 | `add` で追加 | |
| `card.tsx` | 未存在 | `add` で追加 | |
| `table.tsx` | 未存在 | `add` で追加(Table/List 系 4 件で使用) | |
| `sonner.tsx`(Toast) | 未存在 | `add` で追加(または shadcn/ui Toast = sonner ライブラリ採用) | |
| `react-hook-form` 依存 | 未導入 | 追加 | |
| `@hookform/resolvers` 依存 | 未導入 | 追加 | |
| `zod` 依存 | 既導入(TagFormDialog で使用)| 既存活用 | |
| `sonner` 依存 | 未導入 | 追加 | |
| その他 shadcn/ui CLI 要求依存 | — | CLI 要求時のみ追加 | |

##### 表 B: 自作ラッパー 9 件 → shadcn/ui 対応表(§2.2 A 既明示の確認結果列を埋める)

§2.2 A の 9 件すべてについて、製造担当が view 確認で「個別差分」列の実態を埋めて Plan Mode 提示。

##### 表 C: 分離パターン逸脱 4 件 → ロジックフック分離対応表(§2.2 D 既明示の確認結果列を埋める)

§2.2 D の 4 件すべてについて、製造担当が view 確認で「分離対象 useMutation / useState / Zod の具体内容」+「呼び出し元修正の具体方針」を埋めて Plan Mode 提示。

##### 表 D: C-2 / C-3 / C-4 解消対応表

| 項目 | 現状(M7-RESEARCH-01 §4.3 由来)| 採用候補 | 確定方針 |
|------|-----------------------------|---------|---------|
| C-2 | ステップ変換ロジックが RecipeBuilder + SetupRecipeEditor に分散 | (α) 共通フック集約 / (β) 現状維持 | §3.4.10 必須項目 8 |
| C-3 | 内部完結方式 vs callback 委譲方式の混在 | (γ) callback 委譲統一 / (δ) 統合せず | §3.4.10 必須項目 9 |
| C-4 | 条件描画 3 パターン混在(2/5/2 箇所) | (ε) パターン 2 統一 / (ζ) パターン 1 統一 | §3.4.10 必須項目 10 |

##### 表 E: 指摘 6 軸 List API 拡張対応表

| 項目 | 現状 | M7-02 アクション |
|------|------|----------------|
| List クエリ(repository.go) | `combo_setups` JOIN なし | LEFT JOIN 追加(N+1 回避設計、必須項目 5)|
| `toComboResponse(combo, nil)` 呼出 | nil 渡し | setups を渡す |
| `ComboResponse.Setups` JSON タグ | `json:"setups"`(omitempty なし、現状 null 返却) | 温存(現状形式維持、実値返却に変更)|
| `SetupTreeRow.tsx` | プレースホルダーのみ | 本実装(`└ セットプレイ名 [レシピ]` インデント付き表示)|
| 展開アイコン表示 | 全コンボ行に無条件表示 | `combo.setups.length > 0` で条件表示 |
| 展開状態保持 | React useState(マウント中のみ) | ブラウザセッション保持(`sessionStorage`)|

##### 表 F: ComboDetailMetadata 表示項目変更対応表(Q10 (X) 由来)

| 項目 | 現状 | M7-02 アクション |
|------|------|----------------|
| 表示フィールド | `driveGaugeConsumedTotal` / `saGaugeConsumedTotal` | `driveAvailableAtStart` / `saAvailableAtStart` |
| i18n キー値 | "ドライブゲージ消費" / "SAゲージ消費" | "ドライブゲージ開始残量" / "SAゲージ開始残量" |
| バックエンドカラム | `drive_gauge_consumed_total` / `sa_gauge_consumed_total` 存在 | 温存(削除しない、Q15 確定)|
| API レスポンスフィールド | `driveGaugeConsumedTotal` / `saGaugeConsumedTotal` 存在(omitempty で null 除外) | 温存(削除しない、Q15 確定)|
| フロント型定義 | `driveGaugeConsumedTotal` / `saGaugeConsumedTotal` フィールド存在 | 温存(削除しない、Q15 確定)|

製造担当は対応表 A〜F を **完全に埋めた状態** で Plan Mode 計画提示。未確認のまま §4 着手しないこと(M6-3〜M6-6 + M7-5 連続発生の再発防止、最重要)。

#### 3.4.10 Plan Mode で開発者協議が必要な必須項目(10 項目、複数項目 = 質問書ファイル方式必須、playbook v1.9.0 §8.4.2)

確認項目が 10 件と多いため、**製造担当は質問書ファイル方式**(playbook v1.9.0 §8.4.2)で計画提示する。任意名の `.md` ファイル(命名は製造担当判断、推奨 `m7-02-plan-mode-questions.md`)を作成し、開発者の一括ご回答を待機する。フォーマットは固定しない(製造担当判断、playbook v1.9.0 §8.4.3)。

1. **shadcn/ui 追加コンポーネント `add` 対象の最終確定 + 依存追加**
   - 候補(表 A): `form` / `input` / `label` / `button` / `badge` / `card` / `table` / `sonner`(or `toast`)+ 必要時 `switch` / `tooltip` = 8〜10 件
   - 依存: `react-hook-form` / `@hookform/resolvers` / `sonner` + CLI 要求依存
   - **設計担当の推奨**: 表 A 全件 `add`(部分導入回避、playbook §4.6 段階移行禁止)

2. **shadcn/ui Toast 採用方式の確定**
   - 候補 (a): `sonner` ライブラリ(shadcn/ui 公式推奨、Vite 環境で標準)
   - 候補 (b): shadcn/ui 旧 Toast(`toast.tsx` + `use-toast.ts`、React Server Components 非対応環境向け)
   - **設計担当の推奨**: 候補 (a) sonner(shadcn/ui 公式が 2024 年以降 sonner を推奨、Vite + SPA 構成と整合)

3. **Dialog scroll 制約パターン適用方針(伝達 2 対応)**
   - 候補 (a): 全 Dialog 統一(`dialog.tsx` の DialogContent デフォルトスタイル拡張)
   - 候補 (b): リスト含む Dialog のみ個別(呼び出し側 className)
   - 候補 (c): 内部リスト要素に max-h(Dialog 全体ではなく)
   - **設計担当の推奨**: 候補 (c) を基本 + 候補 (a) を fallback 二段構え(architecture-patterns v1.0.8 §7.5 既明示)

4. **TagSelector の cmdk 再採用判断(伝達 1 対応)**
   - 候補 (η): cmdk 再採用(jsdom モック追加 or テスト戦略変更)
   - 候補 (θ): cmdk 不採用継続(M7-01 と同じ代替実装、Popover + ネイティブ input + カスタムリスト)
   - **設計担当の推奨**: 候補 (θ)(M7-01 実装受け入れ済み、テスト戦略変更コストが利得を上回らない見込み)

5. **List API レスポンス拡張の N+1 回避設計**(指摘 6 軸 F-1)
   - 候補 (a): LEFT JOIN + GROUP BY で 1 クエリで全コンボ + セットプレイを取得、アプリ側で集約
   - 候補 (b): 2 クエリ(コンボ一覧 + 紐付くセットプレイ一括取得)+ アプリ側で結合
   - 候補 (c): コンボごとに setups を別 fetch(現状の Get API パターン応用、ただし N+1 発生)= 不採用前提
- **設計担当の推奨**: **候補 (b) 2 クエリ方式**(既存 Tags バッチロードパターン `combo_id IN(...)` と整合、retrospective-log v1.0.25 §6.6 M7-10 由来。M7-02 完了承認時に確定 2026-05-30)

6. **Toast 移行対象の最終特定**(§3.4.7 で view 確認した topMessage / 活用箇所の全件)
   - 製造担当が §3.4.7 view 結果を提示、shadcn/ui Toast(sonner)に置換する範囲を開発者と確定
   - **設計担当の推奨**: M4-03 / M5-01 由来全件を一括移行(部分導入回避)

7. **分離パターン逸脱 4 件解消の新設ロジックフック命名 + 配置**(§2.2 D + §2.1)
   - 候補命名: `useLinkExistingSetupForm.ts` / `useSetupAccordionActions.ts` / `useTagSelectorForm.ts` / `useTagFormDialog.ts`
   - 配置: 各 features `hooks/` 配下を推奨
   - **設計担当の推奨**: 上記命名(各コンポーネント名 + Form / Actions / Dialog のサフィックス)+ 各 features `hooks/` 配置(既存ロジックフック慣例整合)。Plan Mode で既存慣例を再確認

8. **C-2 解消方針確定(VirtualController + SetupRecipeEditor)**
   - 候補 (α): ステップ変換ロジックを共通フック(例: `useStepConverter.ts`)に集約
   - 候補 (β): 現状維持(分散ロジックを正常状態として承認、本 M7-02 で C-2 解消対象から除外)
- **設計担当の推奨**: **候補 (β) 現状維持**(`Step` / `SetupStepInput` の型構造差異が深く共通化コスト > 利得、重複は handleVCStepAdd / handleAdd / reorder / groupMovesByCategory の 4 関数で局所的、retrospective-log v1.0.25 §6.6 M7-9 由来。M7-02 完了承認時に確定 2026-05-30)

9. **C-3 解消方針確定(LinkExistingSetupModal + SetupSelectorModal の統合判断)**
   - 候補 (γ): 両者を callback 委譲方式に統一(SetupSelectorModal の責務採用)+ D-1 分離パターン解消と整合
   - 候補 (δ): 統合せず別コンポーネントとして残す(責務が異なるため統合不要)
   - **設計担当の推奨**: 候補 (γ)(D-1 と整合、responsibility 統一)

10. **C-4 + 指摘 6 軸 F-3 ブラウザセッション保持の統合確定**

    **C-4**(`setup.defaultRecipe` / `combo.defaultRecipe` 条件描画パターン統一):
    - 候補 (ε): パターン 2 統一(`{value || "(レシピなし)"}`)、**HomePage は除外**(`{combo.defaultRecipe || combo.starterMoveCode}` の starterMoveCode フォールバックは別 UX 意図、Q19 Plan Mode 反問 2026-05-30 確定、retrospective-log v1.0.25 §6.6 M7-10 由来)
    - 候補 (ζ): パターン 1 統一(`{value && (<element>)}`)
    - **設計担当の推奨 + M7-02 確定**: 候補 (ε)、ただし HomePage 除外で 8 箇所修正(9 ファイル 15 箇所のうち HomePage 1 箇所除外)

    **指摘 6 軸 F-3 ブラウザセッション保持のキー設計**:
    - 候補命名: `combo-list-expanded-ids-v1` 等(architecture-patterns v1.0.8 §5 ブラウザストレージ運用整合)
    - 値構造: `number[]`(展開中のコンボ ID 配列)
    - **設計担当の推奨**: 上記命名 + `sessionStorage` 採用(`localStorage` ではない、DES-005 §5.4「ブラウザセッション内で保持」規定整合)

#### 3.4.11 §4 着手の前提条件

§3.4.1〜§3.4.10 すべての確認結果を Plan Mode 計画提示に含めること。未確認のまま §4 着手しないこと(retrospective-log v1.0.24 §1 構造的アンチパターン + §6.6 + §7.2 各反省防止)。

**特に §3.4.9 対応表 6 表(A〜F)+ §3.4.10 Plan Mode 必須項目 10 件は本指示書の中核**: 対応表を完全に埋めた状態 + 必須項目 10 件の方針を質問書ファイル方式(playbook v1.9.0 §8.4.2)で提示した状態で開発者の一括ご回答を受領することが §4 着手の絶対条件。

---
## 4. 詳細仕様

本節は §3.4 着手前確認 + Plan Mode 質問書ファイル方式(必須項目 10 件)+ 開発者承認後に着手。**§3.4.10 必須項目 10 件すべての方針が確定していない状態で本節の実装に着手しない**。

### 4.1 shadcn/ui 追加コンポーネント導入

#### 4.1.1 依存追加 + `add` 実行

§3.4.10 必須項目 1 で確定した追加コンポーネントを `pnpm dlx shadcn-ui@latest add <list>` で一括追加。例:

```bash
pnpm dlx shadcn-ui@latest add form input label button badge card table sonner
# 必要時のみ追加: switch tooltip
```

依存追加(`pnpm add`):
- `react-hook-form`
- `@hookform/resolvers`(zod 連携用)
- `sonner`(Toast、必須項目 2 で確定)
- CLI 要求依存(`add` 実行時に自動追加されない依存があれば手動追加)

`web/src/components/ui/` 配下に生成されたコンポーネントは shadcn/ui CLI 生成内容のまま採用(独自カスタマイズしない、architecture-patterns v1.0.8 §1.2.1 案 β 準拠)。例外: §3.4.10 必須項目 3 で候補 (a) 採用時のみ `dialog.tsx` の DialogContent デフォルトスタイルに `max-h-[85vh] overflow-y-auto` 拡張(§4.10 で詳細)。

#### 4.1.2 Toast 初期化(sonner ベース)

shadcn/ui Toast = sonner ライブラリを採用(必須項目 2 候補 (a) 確定前提)。`App.tsx` または相当のルートコンポーネントに `<Toaster />` を配置:

```tsx
import { Toaster } from "@/components/ui/sonner";

function App() {
  return (
    <>
      {/* 既存 App.tsx の中身 */}
      <Toaster position="top-center" />  // 位置は M4-03 topMessage パターンと整合
    </>
  );
}
```

配置位置(`top-center` / `top-right` / `bottom-right` 等)は §3.4.10 必須項目 6 の Toast 移行対象特定時に開発者と確認(M4-03 / M5-01 既存実装の位置と整合させる方針)。

### 4.2 自作ラッパー 9 件の shadcn/ui 移行(系統 A 後半)

§2.2 A 表 + §3.4.9 表 B の対応マッピングに従って各コンポーネントを移行。

#### 4.2.1 Form/Field 系 3 件

**共通方針**: shadcn/ui Form + react-hook-form 連携で再構築。ネイティブ `<input>` / `<select>` / `<label>` を shadcn/ui Input / Select / Label に置換。`<FormField>` / `<FormItem>` / `<FormLabel>` / `<FormControl>` / `<FormMessage>` 構造で組み立て。

- **ComboEditorBasicFields**: `useMemo`(フィールド計算)維持、Props 契約 `value` / `moves` / `movesLoading` / `autoStarterMoveId` / `onChange` 維持。react-hook-form の `Controller` 経由で各フィールドを制御 or `useForm` ベースの完全リファクタかは §3.4.10 必須項目 1 確定後に Plan Mode 判断
- **SetupBasicInfoForm**: `useQuery`(キャラ名取得)維持、Props 契約 `characterId` / `name` / `description` / `onChange` 維持
- **ComboListFilters**: 複数の filter select を shadcn/ui Select に置換、Props 契約 `filters` / `onFilterChange` / `availableTags` / `visibility` / `onVisibilityChange` / `onVisibilityReset` 維持

#### 4.2.2 Badge/Display 系 2 件

- **TagBadgeList**: shadcn/ui `Badge` コンポーネントに置換。Props 契約 `tags` / `excludeCategories?` / `maxVisible?` / `size?` 維持。`size?: "sm" | "md"` は shadcn/ui Badge の `variant` または `className` でマッピング
- **ValidationDisplay**: shadcn/ui 公式 Validation コンポーネント提供なし、`Card` + `Badge` + アイコン(`AlertCircle` / `CheckCircle` 等 `lucide-react`)で構築。Props 契約 `result?` 維持

#### 4.2.3 Table/List 系 4 件

**共通方針**: shadcn/ui `Table` コンポーネント(`<Table>` / `<TableHeader>` / `<TableBody>` / `<TableRow>` / `<TableHead>` / `<TableCell>` 構造)で再構築。`<Checkbox>` 列は shadcn/ui Checkbox に置換(M7-01 で `checkbox.tsx` 導入済み)。

- **ComboTable**: 上記 + **指摘 6 軸 F-3 連携**(展開アイコン条件表示 + ブラウザセッション保持、§4.7)。`useState`(expandedId)→ `useSessionStorage`(`combo-list-expanded-ids-v1`、必須項目 10 確定後)に変更。Props 契約は §2.2 A 表 #6 既明示の任意 Props 群を維持
- **CompareTable**: shadcn/ui Table 置換、Props 契約維持
- **TrashList**: shadcn/ui Table + Checkbox(全選択 + indeterminate)置換、`useState`(indeterminate 制御)維持
- **TagListTable**: shadcn/ui Table + Button(編集 / 削除)置換、**M7-01 追加タスクで実装したシステムタグ表示制御(`tag.category === "mycombo_status"` 行で編集・削除ボタン非表示)= 温存**(本 M7-02 でも継続)

### 4.3 Modal 内 input / label / textarea の shadcn/ui 化(M7-01 で温存した部分)

#### 4.3.1 TagFormDialog

M7-01 で温存した内部 `<input>` / `<label>` を shadcn/ui Form + Input + Label に置換。**内部の `useState`×5 + Zod バリデーションは §4.5 D-4 で `useTagFormDialog.ts` 新設ロジックフックに分離**(分離パターン逸脱解消と本 4.3.1 を統合実施)。

#### 4.3.2 ModifiersEditor / KnockdownAdvantageChangeModal

§3.4.2 view 確認時に input / label の残存があれば置換(基本なしの想定だが、念のため確認)。`useState`×3(ModifiersEditor の localFlags / localType / localNotes)+ `useEffect`(notes 文字数警告)は維持。**P-01(`console.warn` 残存)は引き続き温存**(別観点)。

### 4.4 Toast 系の shadcn/ui 移行

#### 4.4.1 既存パターン置換

§3.4.7 view 結果 + §3.4.10 必須項目 6 確定対象に従って既存 topMessage / showToast 等を shadcn/ui Toast(sonner)に置換:

```tsx
// Before(M4-03 topMessage パターン例)
setTopMessage({ type: "success", text: "保存しました" });

// After(shadcn/ui Toast = sonner)
import { toast } from "sonner";
toast.success("保存しました");
```

#### 4.4.2 M5-01 活用パターンの維持

M5-01 で確立された UX(保存完了トースト + セットプレイ引き継ぎ通知トースト等)は API を sonner ベースに置換しつつ、UX(表示位置 / 表示時間 / アクションリンク等)を維持。具体的な移行対象は §3.4.10 必須項目 6 で開発者と確定。

#### 4.4.3 既存 topMessage コンポーネント + 関連ファイルの削除

shadcn/ui Toast 移行完了後、既存 topMessage コンポーネント + 関連ファイル(具体は §3.4.7 view 結果)を削除。

### 4.5 分離パターン逸脱 4 件解消

各コンポーネントから `useMutation` / `useState` / Zod を新設ロジックフックに分離。architecture-patterns v1.0.7 §1 + v1.0.8 §1.2 + queryKey 規約 §1.1 準拠。

#### 4.5.1 D-1: LinkExistingSetupModal + `useLinkExistingSetupForm.ts`

```ts
// web/src/features/setup/hooks/useLinkExistingSetupForm.ts
export function useLinkExistingSetupForm(parentComboId: number, characterId: number, onLinked?: () => void) {
  const { data: setups, isLoading } = useCharacterSetups(characterId);
  const createMutation = useCreateSetupLink();

  const handleSelect = (setupId: number) => {
    createMutation.mutate(
      { parentComboId, setupId },
      {
        onSuccess: () => {
          onLinked?.();
        },
      },
    );
  };

  return {
    setups,
    isLoading,
    handleSelect,
    isCreating: createMutation.isPending,
  };
}
```

LinkExistingSetupModal は presentation-only に変更、Props で `setups` / `isLoading` / `handleSelect` / `isCreating` を受け取る。呼び出し元(ComboDetailPage / コンボ新規登録画面)で hook を呼び出して props 渡し。

**C-3 統合と整合**: 必須項目 9 で候補 (γ) 確定なら、本フックを共通化して SetupSelectorModal 側でも使用(callback 委譲方式統一)。

#### 4.5.2 D-2: SetupAccordionItem + `useSetupAccordionActions.ts`

```ts
// web/src/features/setup/hooks/useSetupAccordionActions.ts
export function useSetupAccordionActions(comboId: number) {
  const deleteMutation = useDeleteSetupLink();

  const handleUnlink = (setupId: number) => {
    deleteMutation.mutate({ comboId, setupId });
  };

  return {
    handleUnlink,
    isDeleting: deleteMutation.isPending,
  };
}
```

SetupAccordionItem は presentation-only に変更、Props 拡張で `handleUnlink` / `isDeleting` を受け取る。呼び出し元 ComboDetailPage で hook 呼出。

#### 4.5.3 D-3: TagSelector + `useTagSelectorForm.ts`

```ts
// web/src/features/tag/hooks/useTagSelectorForm.ts
export function useTagSelectorForm() {
  const { createMutation } = useTagManagement();
  const [creating, setCreating] = useState(false);

  const handleCreateTag = async (name: string, category: string) => {
    setCreating(true);
    try {
      const newTag = await createMutation.mutateAsync({ name, category });
      return newTag;
    } finally {
      setCreating(false);
    }
  };

  return {
    handleCreateTag,
    creating,
  };
}
```

TagSelector は presentation-only に近づける。**伝達 1 cmdk 再採用判断(必須項目 4)** と連動: 候補 (θ) 不採用継続なら M7-01 代替実装を temporally 維持、候補 (η) 再採用なら cmdk + Popover 構造に変更。

#### 4.5.4 D-4: TagFormDialog + `useTagFormDialog.ts`

```ts
// web/src/features/tag/hooks/useTagFormDialog.ts
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";

const tagFormSchema = z.object({
  name: z.string().min(1, "タグ名を入力してください").max(50, "50文字以内で入力してください"),
  category: z.string().min(1, "カテゴリを選択してください"),
  color: z.string().regex(/^#[0-9A-F]{6}$/i, "正しいカラーコードを入力してください"),
});

export function useTagFormDialog(tag: Tag | null, onSubmit: (values: FormValues) => Promise<void>) {
  const form = useForm({
    resolver: zodResolver(tagFormSchema),
    defaultValues: tag ?? { name: "", category: "general", color: "#000000" },
  });

  const handleSubmit = form.handleSubmit(async (values) => {
    await onSubmit(values);
  });

  return {
    form,
    handleSubmit,
  };
}
```

TagFormDialog は presentation-only に変更、Props 拡張で `form` / `handleSubmit` を受け取る。shadcn/ui Form + react-hook-form 統合パターン採用(§4.3.1 と統合実施)。呼び出し元 TagManagementPage で hook 呼出。

### 4.6 C-2 / C-3 / C-4 解消

#### 4.6.1 C-2: VirtualController + SetupRecipeEditor 整合(候補 (β) 確定 = 現状維持)

§3.4.10 必須項目 8 で **候補 (β) 現状維持** 確定(M7-02 製造担当の Plan Mode 反問 2026-05-30):

- ステップ変換ロジック(`StepInput` → `Step` / `SetupStepInput`)は RecipeBuilder + SetupRecipeEditor の各ハンドラに分散する現状実装を **承認**(変更なし)
- 共通フック新設(`useStepConverter.ts` 等)は **実施しない**
- 理由: `Step` と `SetupStepInput` の型構造差異が深く、ジェネリクス `<T extends StepBase>` 抽象化が薄く保守コスト増。重複は handleVCStepAdd / handleAdd / reorder / groupMovesByCategory の 4 関数で局所的、共通化コスト > 利得
- VirtualController の Props 契約は変更なし

retrospective-log v1.0.25 §6.6 M7-9 + §6.10 Plan Mode 反問運用知見(本プロジェクト 4 件目の運用知見、設計担当 + 製造担当 + 開発者の三者協議モデルの理想形)と連動。

#### 4.6.2 C-3: LinkExistingSetupModal + SetupSelectorModal 統合

§3.4.10 必須項目 9 で候補 (γ) 確定前提: 両者を callback 委譲方式に統一。

- LinkExistingSetupModal: D-1 分離パターン解消(§4.5.1)後、内部 mutation 完結を廃止、`onSelect: (setupId: number) => void` callback で呼び出し元に委譲(SetupSelectorModal と同形式)
- 呼び出し元 ComboDetailPage / コンボ新規登録画面ページで `useLinkExistingSetupForm` の `handleSelect` を `onSelect` callback として渡す

両モーダルが同じ責務(候補リスト表示 + 選択 callback)に統一される。コンポーネント本体の統合(1 コンポーネント化)は本 M7-02 では実施しない(命名 + Props の差異は責務の文脈で残す、過剰統合回避)。

#### 4.6.3 C-4: `setup.defaultRecipe` 条件描画統一

§3.4.10 必須項目 10 で候補 (ε) 確定前提: パターン 2(`{value || "—"}` または `{value || "(レシピなし)"}`)に統一。フォールバック文字列の具体は Plan Mode で確定(推奨: SetupAccordionItem 既存「(レシピなし)」と整合)。

対象 9 ファイル × **8 箇所修正 + HomePage 1 箇所除外**(M7-RESEARCH-01 §4.3 (c) の 15 箇所のうち、HomePage 除外確定 2026-05-30 Plan Mode 反問 by 製造担当):
- パターン 1 → パターン 2: SetupRegistrationSection.tsx:96-98 / SetupCandidateList.tsx:51-53(2 箇所)
- パターン 2 → 既存維持: SetupAccordionItem / AddComboToCompareModal / ComboTableRow / CompareTable(4 箇所、フォールバック文字列を「(レシピなし)」に統一)
- パターン 3 → パターン 2: LinkExistingSetupModal:86 / SetupSelectorModal:78(2 箇所)
- **HomePage 除外(1 箇所)**: `{combo.defaultRecipe || combo.starterMoveCode}` は「レシピがなければ技名表示」という別 UX 意図(スマホ専用ホーム画面の識別性向上)、C-4 統一対象外。M7-02 で現状維持
- フォールバック文字列「(レシピなし)」は **コンボ / セットプレイ両方に共通適用**(Q17 (M) 確定 2026-05-31、setup の場合は VAL-S02 により通常発生しないが仮登録モード等で発生、コンボの場合は VAL-C09 違反状態の可視化として機能)

### 4.7 指摘 6 軸: SetupTreeRow 本実装 + List API レスポンス拡張

#### 4.7.1 List API レスポンス拡張(バックエンド)

§3.4.10 必須項目 5 で **候補 (b) 2 クエリ方式** 確定(M7-02 製造担当の Plan Mode 反問 2026-05-30、既存 Tags バッチロードパターン `combo_id IN(...)` と整合):

##### 候補 (b) 2 クエリ + アプリ側結合(確定方式)

```go
// 1 クエリ目: コンボ一覧
combos := repo.ListCombos(...)
// 2 クエリ目: 全 combo_id に対するセットプレイ一括取得
comboIDs := extractIDs(combos)
setupsByComboID := repo.ListSetupsByComboIDs(comboIDs)
// Go 側で結合
for i, c := range combos {
  responses[i] = toComboResponse(c, setupsByComboID[c.ID])
}
```

- N+1 クエリ回避達成(コンボ数 N に対して **2 クエリ固定**)
- 既存 Tags バッチロードパターン(`tag_id IN(...)` で `combo_tags` テーブルから一括取得)と同じ実装慣例 = 本プロジェクトの責務統一
- `ListSetupsByComboIDs(comboIDs)` は独立した repository 関数として単体テスト可能

##### 候補 (a) LEFT JOIN 方式は不採用(参考)

LEFT JOIN は 1 クエリで取得可能だが、combo 行が N 倍に重複展開され Go 側 mapping ロジックが複雑化(`combo_id` でグルーピング + 1 件目を combo 採用 + setups[] 集約)。SQLite + Go の memory allocation 効率も若干劣る。候補 (b) と比べて利得なしのため不採用。

retrospective-log v1.0.25 §6.6 M7-10 + §6.10 Plan Mode 反問運用知見と連動。

#### 4.7.2 SetupTreeRow 本実装(フロント)

```tsx
// web/src/features/combo/components/SetupTreeRow.tsx(本実装)
interface SetupTreeRowProps {
  setups: SetupResponse[];
  colSpan: number;
  onSetupClick?: (setupId: number) => void;
}

export function SetupTreeRow({ setups, colSpan, onSetupClick }: SetupTreeRowProps) {
  if (setups.length === 0) return null;  // 親側で表示制御するが念のため

  return (
    <TableRow>
      <TableCell colSpan={colSpan} className="pl-12 bg-muted/50">
        {setups.map((setup) => (
          <div
            key={setup.id}
            className="flex items-center gap-2 py-1 cursor-pointer hover:underline"
            onClick={() => onSetupClick?.(setup.id)}
          >
            <span>└</span>
            <span className="font-medium">{setup.name ?? "(名前なし)"}</span>
            <span className="text-muted-foreground">[{setup.defaultRecipe || "(レシピなし)"}]</span>
          </div>
        ))}
      </TableCell>
    </TableRow>
  );
}
```

DES-005 §5.4 表示例の `└ セットプレイ1 [レシピ]` インデント表示を再現。空文字列フォールバックは §4.6.3 C-4 候補 (ε) 統一と整合(「(レシピなし)」)。

#### 4.7.3 ComboTable / ComboTableRow の展開アイコン条件表示 + ブラウザセッション保持

```tsx
// web/src/features/combo/components/ComboTable.tsx(概形)
const [expandedIds, setExpandedIds] = useSessionStorage<number[]>(
  "combo-list-expanded-ids-v1",
  [],
);

return (
  <Table>
    {combos.map((combo) => (
      <Fragment key={combo.id}>
        <ComboTableRow
          combo={combo}
          isExpanded={expandedIds.includes(combo.id)}
          canExpand={combo.setups.length > 0}  // ← 条件表示
          onToggleExpand={() => toggleExpand(combo.id)}
        />
        {expandedIds.includes(combo.id) && combo.setups.length > 0 && (
          <SetupTreeRow
            setups={combo.setups}
            colSpan={visibleColumnsCount}
            onSetupClick={(setupId) => navigate(`/setups/${setupId}/edit`)}
          />
        )}
      </Fragment>
    ))}
  </Table>
);
```

ComboTableRow 内で `canExpand` Props で展開アイコン(`ChevronDown` / `ChevronRight`)を条件表示。`canExpand === false` ならアイコン非表示。

`useSessionStorage` フックは新設 or 既存ライブラリ(`usehooks-ts` 等)採用、§3.4.10 必須項目 10 確定後に Plan Mode で具体実装方式判断。**設計担当の推奨**: 軽量な自作フック(`web/src/hooks/useSessionStorage.ts` 新設)= 既存依存追加最小化。

### 4.8 ComboDetailMetadata 表示項目変更(Q10 (X) 確定)

#### 4.8.1 表示フィールド変更

```tsx
// Before
<div>{t("comboDetail.metadata.driveGauge")}: {combo.driveGaugeConsumedTotal ?? "-"}</div>
<div>{t("comboDetail.metadata.saGauge")}: {combo.saGaugeConsumedTotal ?? "-"}</div>

// After
<div>{t("comboDetail.metadata.driveGauge")}: {combo.driveAvailableAtStart ?? "-"}</div>
<div>{t("comboDetail.metadata.saGauge")}: {combo.saAvailableAtStart ?? "-"}</div>
```

#### 4.8.2 i18n キー値変更

`web/src/locales/ja.json`(または相当パス):

```json
{
  "comboDetail": {
    "metadata": {
      "driveGauge": "ドライブゲージ開始残量",  // 変更前: "ドライブゲージ消費"
      "saGauge": "SAゲージ開始残量"            // 変更前: "SAゲージ消費"
    }
  }
}
```

i18n キー名(`driveGauge` / `saGauge`)自体は変更しない(キー名変更は影響範囲広、値のみ変更)。

#### 4.8.3 温存対象(Q15 確定)

- バックエンドの `drive_gauge_consumed_total` / `sa_gauge_consumed_total` カラム = **温存**
- API レスポンスフィールド(`drive_gauge_consumed_total` / `sa_gauge_consumed_total`)= **温存**(omitempty で null 返却継続)
- フロント型定義(`driveGaugeConsumedTotal` / `saGaugeConsumedTotal`)= **温存**
- バックエンドキャッシュ計算実装 + VAL-C06/C07 復活 = **本 M7-02 では実施しない**(M7-04 Q11 γ-2 確定)

### 4.9 伝達 1 対応: TagSelector cmdk 再採用判断

§3.4.10 必須項目 4 で候補 (θ) 不採用継続 = 推奨確定前提:

- M7-01 代替実装(Popover + ネイティブ input + カスタムリスト)を維持
- §4.5.3 D-3 分離パターン逸脱解消と統合実施(`useTagSelectorForm.ts` 新設)
- M7-02 完了時に retrospective-log v1.0.25 §6.6 で「伝達 1 はテスト戦略変更コスト判断により cmdk 不採用継続」を記録(本指示書では設計担当の暫定推奨を反映、Plan Mode で開発者最終確定)

候補 (η) cmdk 再採用なら jsdom モック追加(ResizeObserver / scrollIntoView)+ TagSelector の Popover + Command 構造への再変更が必要。Plan Mode 必須項目 4 確定後に詳細仕様確定。

### 4.10 伝達 2 対応: Dialog scroll 制約パターン適用

§3.4.10 必須項目 3 で候補 (c) 基本 + 候補 (a) fallback の二段構え採用前提:

#### 4.10.1 候補 (c): リスト含む Dialog の内部リスト要素に max-h

対象 Dialog(M7-RESEARCH-03 §1.5 + architecture-patterns v1.0.8 §7.3 同種潜在事象):
- LinkExistingSetupModal(M7-01 修正済み、本実装で同方針継続)
- AddComboToCompareModal
- SetupSelectorModal
- KnockdownAdvantageChangeModal(individual モードのチェックボックスリスト)
- その他 §3.4.2 view 確認で発見されたリスト含む Dialog

```tsx
<DialogContent>
  <DialogHeader>...</DialogHeader>
  <div className="max-h-[60vh] overflow-y-auto">
    {/* リスト */}
  </div>
  <DialogFooter>...</DialogFooter>
</DialogContent>
```

#### 4.10.2 候補 (a) fallback: 全 Dialog 統一適用

`web/src/components/ui/dialog.tsx` の DialogContent デフォルトスタイルに `max-h-[85vh] overflow-y-auto` を追加(shadcn/ui CLI 生成コードへの独自カスタマイズ = 例外条項 §2.4 (k)):

```tsx
// dialog.tsx(編集後)
const DialogContent = React.forwardRef<...>((props, ref) => (
  <DialogPrimitive.Content
    ref={ref}
    className={cn(
      "...既存クラス...",
      "max-h-[85vh] overflow-y-auto",  // ← 追加
      props.className,
    )}
    {...props}
  />
));
```

これにより、候補 (c) の対応漏れ Dialog が発生してもビューポートはみ出しが起きない二重防御を確保。

#### 4.10.3 M7-02 完了承認時の architecture-patterns 改訂連動

M7-02 完了承認時に設計担当が architecture-patterns v1.0.8 §7 を v1.0.9 で正式 §7 化(タイトルから「候補」を取る + 適用結果反映)。本指示書では設計書本体改訂を伴わない、自由改訂対象(本 M7-02 製造担当が対応する作業ではなく、設計担当の後段作業)。

### 4.11 既知の制限事項の温存

以下は本指示書では触らず、後続マイルストーンで対応:

- バックエンドキャッシュ計算(`drive_gauge_consumed_total` / `sa_gauge_consumed_total` 自動集計関数)+ VAL-C06/C07 復活 → M7-04(Q11 γ-2)
- `moves` テーブルの `drive_gauge_increase` / `sa_gauge_increase` カラム存在確認 + 追加 → M7-04(M7-RESEARCH-03 §1.5 特記事項 2 由来)
- ModifiersEditor の `console.warn` 残存(P-01)→ 別観点で温存
- PromoteToFinalButton の独立コンポーネント化 → フェーズ 2 以降検討
- Header 内追加要素(プリセット切替 / 言語切替 / ユーザー表示 / モード表示)→ フェーズ 2 以降
- 本格スマホ UI(カード形式 / アコーディオン / ボトムシート / スワイプ)→ フェーズ 3 以降(M7-overview §2.9 案 Y 採用)
- 既存固定幅 3 件 / overflow-x-auto 横スクロール → M7-03 レスポンシブ仕上げ
- i18n キー追加(英語ロケール)→ フェーズ 3
- virtual-controller-layout-v1 ブラウザストレージ → フェーズ 3

### 4.12 Q22 案 A 修正: `useUpdateComboWithKeyChange` の onSuccess 修正(本セッションで M7-02 完了承認スコープに編入、2026-05-31)

#### 4.12.1 修正対象

`web/src/features/combo/api.ts:195-196` 周辺の `useUpdateComboWithKeyChange` の onSuccess コールバック。

#### 4.12.2 修正内容

```ts
// 修正前(M7-02 完了報告時点)
onSuccess: () => {
  qc.invalidateQueries({ queryKey: ["combos"] });
  qc.invalidateQueries({ queryKey: ["combo", id] });  // ← 旧 ID(論理削除済み)を再フェッチ → 404
}

// 修正後(Q22 案 A 採用)
onSuccess: (data) => {
  qc.invalidateQueries({ queryKey: ["combos"] });
  // qc.invalidateQueries({ queryKey: ["combo", id] }); ← 削除(旧 ID = 論理削除済み)
  qc.setQueryData(["combo", data.id], data);  // ← 新 ID のキャッシュをレスポンスデータで設定
}
```

#### 4.12.3 修正根拠

- M7-02 起因ではない既存潜在問題が M7-02 のトースト移行で顕在化(retrospective-log v1.0.25 §6.6 M7-13)
- `useUpdateComboWithKeyChange` の onSuccess クロージャが捕捉する `id` は **旧 ID**(フックの引数)= PUT(キー変更)後は論理削除済み = invalidate で 404 発生
- TanStack Query がエラー状態に遷移 → ComboEditorPage が `activeQ?.isError` true でエラー表示に切り替わる
- VAL-C03 警告ダイアログ表示中(`pendingNavigateTo` 設定状態)に発生 = 警告ダイアログが消えてエラー画面に遷移する UX 不具合

#### 4.12.4 採用しなかった案

- **案 B**: hasWarning 時もダイアログ非表示で即座に navigate = 警告ダイアログという UX 設計の根本変更で M2 期間担当の意図設計を覆す副作用、不採用
- **案 C**: エラー状態を握りつぶしてダイアログ維持 = 症状対応で TanStack Query のエラー処理の不透明化(retrospective-log §1 系アンチパターン)、不採用

#### 4.12.5 テスト要件

- `useUpdateComboWithKeyChange.test.ts`(または相当)で onSuccess の挙動テスト追加:
  - 旧 ID の `invalidateQueries` が **呼ばれていない** ことを確認
  - 新 ID の `setQueryData` が呼ばれていることを確認
- 既存テストで `combos` リスト全体の `invalidateQueries` は維持されていることを確認
- バックエンドテストは変更不要(本修正はフロントのみ)

---
## 5. テスト要件

### 5.1 単体テスト

#### 5.1.1 新規追加

- 新設ロジックフック 4 件のテスト(§2.1 / §4.5):
  - `setup/hooks/useLinkExistingSetupForm.test.ts`
  - `setup/hooks/useSetupAccordionActions.test.ts`
  - `tag/hooks/useTagSelectorForm.test.ts`
  - `tag/hooks/useTagFormDialog.test.ts`
- C-2 共通フックのテスト(候補 (α) 確定時、§4.6.1):
  - `combo/hooks/useStepConverter.test.ts`
- ブラウザセッション保持フックのテスト(自作採用時、§4.7.3):
  - `hooks/useSessionStorage.test.ts`
- SetupTreeRow 本実装テスト(§4.7.2):
  - `combo/components/SetupTreeRow.test.tsx`(新規 or 既存仮実装テストの更新)

#### 5.1.2 既存テストの修正

shadcn/ui ベースへの差し替えに伴い、既存テストで DOM 構造に依存する assert があれば修正。M7-01 と同じく `screen.getByRole(...)` ベースの assert は影響を受けにくい。

修正必須:
- 自作ラッパー 9 件の対応テスト(`ComboEditorBasicFields.test.tsx` / `SetupBasicInfoForm.test.tsx` / `ComboListFilters.test.tsx` / `TagBadgeList.test.tsx` / `ValidationDisplay.test.tsx` / `ComboTable.test.tsx` / `CompareTable.test.tsx` / `TrashList.test.tsx` / `TagListTable.test.tsx`、存在する場合)
- 分離パターン逸脱 4 件のコンポーネントテスト(`LinkExistingSetupModal.test.tsx` / `SetupAccordionItem.test.tsx` / `TagSelector.test.tsx` / `TagFormDialog.test.tsx`)= mutation 部分はロジックフックテストに移動、コンポーネントテストは presentation のみに簡素化
- Toast 移行に伴う既存テストの sonner 対応(`vi.mock("sonner", ...)` 等のモック追加)
- ComboTable / ComboTableRow / SetupTreeRow の展開アイコン条件表示 + ブラウザセッション保持テスト
- ComboDetailMetadata の表示フィールド変更に伴う assert 修正(`driveAvailableAtStart` / `saAvailableAtStart` ベース)
- バックエンドの List API テスト(`combo_setups` JOIN + setups フィールド返却の検証)
- C-3 統合(候補 (γ) 確定時)に伴う ComboDetailPage / コンボ新規登録画面ページのテスト修正

#### 5.1.3 件数見込み

M7-01 完了時点 391〜394 件(M7-01 本体 390 件前後 + 追加タスク +1〜+4 件)+ 本 M7-02 追加 30〜50 件想定 = **420〜450 件前後**。

#### 5.1.4 バックエンドテスト

- List API の `combo_setups` JOIN + setups 返却テスト(repository / handler / service 各レイヤー)
- バックエンドテスト件数: M7-01 時点から +5〜10 件想定

#### 5.1.5 実行コマンド

```bash
cd web && pnpm test --run     # フロント
go test ./...                 # バックエンド
```

製造担当は完了報告で両方の結果(成功 / 失敗 / スキップ件数)を記録。

### 5.2 E2E シナリオ(別ファイル)

M7-01 と同じく、E2E シナリオは **別ファイル**(`m7-02-e2e-scenarios.md` 相当)で開発者が実機検証する。本指示書では機械レビュー対象外。製造担当はビルド + 起動 + 単体テスト PASS を完了報告の対象とする。

### 5.3 開発者実機テストの依頼

製造担当の単体テスト + ビルド + 起動完了後、開発者に以下を依頼:

1. PC + スマホサイズ両方での動作確認
2. UX 評価(shadcn/ui Form / Toast / Table への移行で見た目変化、playbook §14 スクリーンショット運用)
3. 指摘 6 軸の動作確認(コンボ一覧画面でセットプレイ展開、アイコン条件表示、セッション保持)
4. Q10 表示項目変更の動作確認(ComboDetailPage で「開始残量」表示への変更)
5. Toast 動作確認(保存完了 / エラー / セットプレイ引き継ぎ通知等)

---

## 6. レビュー観点(別ファイル参照)

機械レビューチェックリストは別ファイル `M7-02-review-checklist.md` を参照。レビュー観点は以下を網羅(14 章想定、M7-01 機械レビューチェックリスト 12 章を拡張):

1. ファイル一覧(§2.1 / §2.2 / §2.3 / §2.4)
2. 着手前確認結果(§3.4 全体、特に §3.4.9 対応表 6 表 + §3.4.10 Plan Mode 必須項目 10 件)
3. shadcn/ui 追加コンポーネント導入の妥当性(§4.1)
4. 自作ラッパー 9 件移行の妥当性(§4.2)
5. Modal 内 input / label / textarea の shadcn/ui 化の妥当性(§4.3)
6. Toast 移行の妥当性(§4.4)
7. 分離パターン逸脱 4 件解消の妥当性(§4.5)
8. C-2 / C-3 / C-4 解消の妥当性(§4.6)
9. 指摘 6 軸 SetupTreeRow + List API レスポンス拡張の妥当性(§4.7)
10. ComboDetailMetadata 表示項目変更の妥当性(§4.8)
11. 伝達 1 / 伝達 2 対応の妥当性(§4.9 / §4.10)
12. テスト要件の充足(§5)
13. スコープ外への変更がないこと(§2.3、最重要)
14. retrospective-log v1.0.24 §1 構造的アンチパターン + §7.2 M7-3 候補の再発なし

---

## 7. 完了条件(Definition of Done)

### 7.1 機能完了

- [ ] shadcn/ui 追加コンポーネント導入完了(`form` / `input` / `label` / `button` / `badge` / `card` / `table` / `sonner` 等、§3.4.10 必須項目 1 確定対象)
- [ ] 自作ラッパー 9 件が shadcn/ui ベースに移行完了(Form/Field 3 + Badge/Display 2 + Table/List 4)
- [ ] Modal 内 input / label / textarea の shadcn/ui 化完了(TagFormDialog 内 + 他温存対象)
- [ ] Toast 系の shadcn/ui 移行完了(M4-03 / M5-01 由来全件)
- [ ] 分離パターン逸脱 4 件解消完了(D-1 / D-2 / D-3 / D-4、ロジックフック 4 件新設)
- [ ] **C-2: 現状維持で承認**(候補 (β) 確定、共通フック新設なし)- [ ] C-3 解消完了(候補 (γ) 確定時 = callback 委譲統一)
- [ ] C-4 解消完了(候補 (ε) 確定時 = パターン 2 統一、**HomePage 除外 = 8 箇所修正**)
- [ ] 指摘 6 軸 解消完了:
  - [ ] List API レスポンス拡張(N+1 回避設計、setups フィールド実値返却)
  - [ ] SetupTreeRow 本実装(DES-005 §5.4 表示例整合)
  - [ ] 展開アイコン条件表示(`combo.setups.length > 0`)
  - [ ] ブラウザセッション保持(`combo-list-expanded-ids-v1`)
- [ ] 指摘 1 軸 問題 b 解消完了(ComboDetailMetadata.tsx の表示フィールド = 開始残量 + i18n キー値変更)
- [ ] 伝達 1 解消完了(cmdk 不採用継続 = 候補 (θ)、または再採用 = 候補 (η))
- [ ] 伝達 2 解消完了(Dialog scroll 制約パターン適用、候補 (c) + (a) 二段構え)
- [ ] M7-01 確立物の温存(Header / Footer / shadcn/ui 既存 12 コンポーネント / 案 A Header 非表示 4 ページ / システムタグ表示制御等)
- [ ] バックエンドキャッシュ計算 / VAL-C06/C07 / ComboDetailMetadata の「消費量」フィールドが **温存**(Q11 γ-2 + Q15 確定)
- [ ] **Q22 案 A 修正完了**(`useUpdateComboWithKeyChange` の onSuccess 旧 ID invalidation 削除 + 新 ID setQueryData prefetch、本セッション編入 2026-05-31)

### 7.2 テスト完了

- [ ] 新規追加テスト全件 PASS(ロジックフック 4 件 + C-2 共通フック + SetupTreeRow 本実装 + ブラウザセッション保持)
- [ ] 既存テスト修正後 + 全件 PASS
- [ ] `pnpm test --run` 全 PASS(420〜450 件前後)
- [ ] `go test ./...` 全 PASS(List API 拡張テスト含む)
- [ ] `pnpm build` + `pnpm dev` エラーなし

### 7.3 Plan Mode 確定事項の遵守

- [ ] §3.4.10 必須項目 10 件すべてが Plan Mode で開発者承認済み + 実装反映済み
- [ ] §3.4.9 対応表 6 表(A/B/C/D/E/F)を製造担当が完全に埋めた状態で計画提示済み
- [ ] Plan Mode 質問書ファイル(`m7-02-plan-mode-questions.md` 等)が作成され、開発者の一括ご回答受領済み(playbook v1.9.0 §8.4.2)

### 7.4 スコープ外への変更がないこと

- [ ] 設計書本体(REQ-001 / DES-001〜DES-006)変更なし
- [ ] 補足資料(SUPP-001 / playbook / architecture-patterns / handover / CLAUDE.md / change-number-registry)変更なし(本 M7-02 製造担当の対象外、設計担当が完了承認後に retrospective-log v1.0.25 + architecture-patterns v1.0.9 を別タイミングで自由改訂)
- [ ] 新規 CHANGE 通知書起票なし
- [ ] M7-03 / M7-04 / M7-05 スコープに該当する変更が含まれていない:
  - [ ] バックエンドキャッシュ計算(`drive_gauge_consumed_total` 自動集計関数)+ VAL-C06/C07 復活が **含まれていない**(M7-04)
  - [ ] `moves` テーブル `drive_gauge_increase` 追加が **含まれていない**(M7-04)
  - [ ] ComboDetailMetadata の「消費量」表示復活が **含まれていない**(フェーズ 2 候補要望)
  - [ ] R-1 / R-2 / R-3 関連が **含まれていない**(M7-03)
  - [ ] 残り 4 プリセット + AKI + 残り 3 キャラ + スキーマ耐久が **含まれていない**(M7-04)
  - [ ] リファクタ + 統合 E2E + LAN 検証 + フェーズ 1 完了判定が **含まれていない**(M7-05)
- [ ] M7-01 確立物への変更なし(Header / Footer / shadcn/ui 既存 12 コンポーネント本体 / Header 非表示 4 ページ / システムタグ表示制御)
- [ ] バックエンドの `drive_gauge_consumed_total` / `sa_gauge_consumed_total` カラム + API レスポンスフィールド + フロント型定義 = **温存**(Q15 確定)
- [ ] ModifiersEditor の `console.warn` 残存(P-01)が継続温存
- [ ] PromoteToFinalButton の独立コンポーネント化なし
- [ ] Header 内追加要素(プリセット切替 / 言語切替 / ユーザー表示 / モード表示)が **含まれていない**
- [ ] 本格スマホ UI(カード形式 / アコーディオン / ボトムシート / スワイプ)が **含まれていない**
- [ ] i18n 英語ロケール追加が **含まれていない**(日本語ラベル変更のみ許容、§4.8.2)

### 7.5 進捗ドキュメント更新

- [ ] `docs/progress/progress-log.md` に M7-02 完了報告が追記されている

---

## 8. 注意事項・判断に迷ったら

### 8.1 Plan Mode 停止して開発者協議が必須のケース

以下に該当した場合は §4 詳細仕様の実装を一時停止して開発者協議:

- §3.4.1〜§3.4.10 のいずれかで M7-01 完了状態 + M7-RESEARCH-01 / M7-RESEARCH-03 報告書記述と実態に **大きな差分** が発見された
- shadcn/ui 追加コンポーネントの `add` で予期せぬエラー / 想定外の依存追加が発生
- 自作ラッパー 9 件移行の途中で「設計書本体への影響あり = CHANGE 通知書起票が必要」と判明(本指示書スコープ内では起票見込みなしと想定)
- C-2 / C-3 / C-4 解消の途中で複数解釈が可能 + Plan Mode 必須項目 8 / 9 / 10 の確定方針と異なる選択肢が現れた
- 分離パターン逸脱 4 件解消の途中で「ロジックフック分離が想定以上に複雑」「呼び出し元の影響範囲が想定より広い」と判明
- List API レスポンス拡張の N+1 回避設計で SQLite クエリパフォーマンス問題が発生
- SetupTreeRow 本実装 / 展開アイコン条件表示 / ブラウザセッション保持で DES-005 §5.4 規定との解釈に複数選択肢
- ComboDetailMetadata 表示項目変更で「消費量」表示の温存方針(Q15)との齟齬発生
- 既存機能の回帰が発見された
- Toast 移行で M4-03 / M5-01 既存 UX に影響する変更が必要と判明
- shadcn/ui のメジャーバージョン更新等で公式ドキュメントと本指示書 §4 の手順が乖離

### 8.2 設計担当の判断意図(製造担当が誤解しやすい点の補足)

- **案 β 採用継続**(M7-overview §2.3、architecture-patterns v1.0.8 §1.2.1)= shadcn/ui 標準 API に呼び出し側を合わせる、本 M7-02 でも例外コンポーネントなし
- **本 M7-02 で触る範囲 vs 触らない範囲**: §1.3 / §2.3 既明示。特にバックエンドキャッシュ計算 / VAL-C06/C07 復活 / `moves` テーブル列追加 / ComboDetailMetadata の「消費量」表示復活は **本 M7-02 では実施しない**(M7-04 + フェーズ 2 候補要望)
- **温存対象の慎重な扱い**: バックエンドの `drive_gauge_consumed_total` / `sa_gauge_consumed_total` カラム + API レスポンスフィールド + フロント型定義は **削除しない**(Q15 = 将来要望復活余地)、ただし ComboDetailMetadata の **表示** は「開始残量」に変更(Q10 (X))。フィールド削除と表示変更を混同しないこと
- **指摘 6 軸の責任**: List API レスポンス拡張 + SetupTreeRow 本実装は本 M7-02 で完結する。一覧画面のセットプレイ展開機能は **フェーズ 1 完了基準**(retrospective-log v1.0.24 §6.6 持ち越し課題で M7-02 配分確定)
- **分離パターン逸脱解消の範囲**: D-1〜D-4 の 4 件のみ。他のコンポーネントの useMutation / useQuery / useState は維持(個別判断は §3.4.2〜§3.4.4 で view 確認)
- **C-3 統合の解釈**: 候補 (γ) 確定 = callback 委譲方式統一だが、**コンポーネント本体の 1 つ化(統合)は実施しない**(命名 + Props の差異は責務文脈で残す、過剰統合回避)
- **Toast 採用方式**: sonner 採用(候補 (a))= shadcn/ui 公式推奨の最新方式
- **Dialog scroll 制約**: 候補 (c) 基本 + 候補 (a) fallback の二段構え採用、候補 (a) は `dialog.tsx` 独自カスタマイズ例外条項 §2.4 (k) で許容
- **ブラウザセッション保持**: `sessionStorage`(`localStorage` ではない)= DES-005 §5.4「ブラウザセッション内で保持」規定整合
- **TagFormDialog の Form 化**: §4.3.1 + §4.5.4 で統合実施、react-hook-form + zod + shadcn/ui Form 連携が中核(M7-02 で本プロジェクトに導入される新パターン、architecture-patterns v1.0.9 で新規節として記録する候補)
- **native `<select>` の温存**(Q16 (P) 確定 2026-05-31): Radix Select の `value=""` 制約により、「(未指定)」プレースホルダー UX を保つため、ComboEditorBasicFields の 6 つ + ComboListFilters の 7 つ + その他 13 select 要素は **native `<select>` を維持**、CSS クラスのみ `border-input bg-background` で shadcn/ui 統一見た目に整合。Radix Select 置換は機能を壊すため不採用(architecture-patterns v1.0.9 §1.2.6 例外条項)
- **「(レシピなし)」コンボへの適用**(Q17 (M) 確定 2026-05-31): C-4 統一でコンボ / セットプレイ両方に「(レシピなし)」フォールバックを適用。コンボの場合は VAL-C09 違反状態(仮登録モード等)の可視化として機能、UX 上妥当と判断
- **CompareTable のドライブ/SA 消費表示**(Q18 (S) 確定 2026-05-31): バックエンドキャッシュ計算が M7-04 スコープ(Q11 γ-2)のため常に null、CompareTable は "-" 表示で現状維持(M7-04 完了後に値が入れば自然に表示)= 行非表示や別ラベル変更は実施しない
- **C-2 (β) 現状維持の判断意図**: `Step` と `SetupStepInput` の型構造差異が深く、共通化のジェネリクス抽象化が薄く保守コスト増。重複は 4 関数で局所的(retrospective-log v1.0.25 §6.6 M7-9)
- **必須項目 5 (b) 2 クエリ方式の判断意図**: 既存 Tags バッチロードパターン `combo_id IN(...)` と整合、本プロジェクトの責務統一(retrospective-log v1.0.25 §6.6 M7-10)
- **C-4 HomePage 除外の判断意図**: HomePage の `{combo.defaultRecipe || combo.starterMoveCode}` は「レシピなければ技名表示」という別 UX 意図、C-4 統一(固定文字列フォールバック)とは性質が異なる(retrospective-log v1.0.25 §6.6 M7-10 / §6.10 M7-02 製造担当の Plan Mode 反問運用知見)

### 8.3 プロジェクト起動方式

`web/` 配下で `pnpm dev` 起動 → http://localhost:3000(または `vite.config.ts` 既定ポート)。バックエンドは `go run ./cmd/server`(リポジトリ構成による、CLAUDE.md §10 参照)。本 M7-02 はバックエンド変更を含む(List API 拡張、§4.7.1)= バックエンド起動 + フロント起動の両方で動作確認必須。

### 8.4 設計担当への質問チャネル

製造担当は **Plan Mode 質問書ファイル方式**(playbook v1.9.0 §8.4.2、必須項目 10 件)で開発者を介して設計担当に確認する。直接の Q&A セッションは設けない(playbook §1 役割分離)。

---

*以上、M7-02 指示書 v1.0.0*
