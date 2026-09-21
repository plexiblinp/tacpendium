# M7 期間 設計セッション継承資料(m7-design-session-handover)

| 項目 | 内容 |
|------|------|
| 文書ID | M7-DESIGN-SESSION-HANDOVER |
| バージョン | 1.0.0 |
| 作成日 | 2026-05-27 |
| 作成者 | 設計担当 Claude(M7 期間担当・前セッション) |
| 対象読者 | 設計担当 Claude(M7 期間担当・新セッション)|
| 用途 | M7 期間設計セッションを途中で分割継承するための引き継ぎ資料。前セッションでコンテキスト圧迫が予見されたため、**M7-01 指示書本体作成の直前** で分割した |
| 性質 | **m6 期間継承(実装マイルストーン途中での分割)とは性質が異なる**。本継承は **実装マイルストーンへ入る前(M7-01 指示書作成着手前)で分割**、新セッションは「M7-01 指示書 + レビューチェックリスト作成」から着手する |

---

## 0. 新セッション開始時の最優先作業(時系列順)

### 0.1 即時対応(最初の 1〜2 ターン)

1. **本資料 + プロジェクト最初の会話 + 添付資料一式を受領後の確認**:
   - 添付資料は前セッションで受領したものと **概ね同一**(M7 期間中の改訂分が反映されている):
     - DES-005 は **v2.10.0**(CHANGE-017 反映済み、§4.4 ブレークポイント値整合化)
     - change-number-registry は **v1.6.0**(CHANGE-017 反映済み)
     - retrospective-log は **v1.0.22**(M7 期間反省 3 件前倒し記録済み)
     - architecture-patterns は **v1.0.7**(§6 調査担当運用パターン新設済み)
     - CLAUDE.md / SUPP-001 v1.17.0 は前セッション同様(2026-05-26 改訂後の状態)
   - 開発者から **M7-overview v1.0.1** + **M7-RESEARCH-01 report** + **M7-RESEARCH-02 report** + **CHANGE-017 通知書** が併せて提示される(これらが前セッションの主要成果物)
2. **設計担当としての現状認識を 1 メッセージで開発者に共有**:
   - M7-overview v1.0.1 開発者承認状態(2026-05-26 + 2026-05-27 ご確認済み、本 handover 作成直前の状態 = 開発者承認済みと扱う)
   - M7-RESEARCH-01 / M7-RESEARCH-02 報告書受領済み + 結果評価完了済み
   - 次の工程は **M7-01 指示書作成**(Opus 4.6 推奨、Header 共通化 + Dialog + Popover + ハンバーガー + 残課題 3 統合 + Props 命名是正 + モーダルパターン統一 + `window.confirm` 除去)
3. **開発者からの追加指示・修正がなければ M7-01 指示書作成に直接着手**(0.2 へ)

### 0.2 M7-01 指示書作成(新セッション最重要タスク)

- 想定指示書サイズ: **1000〜1200 行クラス**(M7-overview v1.0.1 §3.1 / §4.3 参照、本プロジェクト最大規模の指示書になる見込み)
- 推奨モデル: **Opus 4.6**(M7-overview §7 / §2.3 / §2.9 参照、関心数 3 + 大規模 UI ライブラリ移行 + 判断分岐多数)
- Plan Mode: 必須
- レビュー: 機械レビュー Sonnet 4.6
- **本資料 §3「M7-01 指示書作成方針」に詳細あり** — 新セッションで指示書執筆に直接着手できる粒度で記述

### 0.3 M7-01 指示書完成後

1. 開発者承認(指示書 + レビューチェックリスト)
2. 製造担当 Claude Code 起動 + 製造工程 + 機械レビュー + 開発者 E2E
3. **M7-01 完了承認時の作業**(本資料 §4 参照):
   - 製造担当連絡事項由来の設計担当ミス記録(retrospective-log v1.0.23+ に追記)
   - architecture-patterns 改訂(shadcn/ui 統一導入で確立された新パターン化、想定: §1.2 shadcn/ui 統一導入パターン新設等)
   - M7-02 指示書作成方針の確定(本資料 §5 参照)

### 0.4 M7 全体完了時の作業方針(M7-05 完了承認時、本資料 §7 参照)

- フェーズ 1 完了判定(M7-overview v1.0.1 §13 DoD すべて確認)
- `m7-to-phase2-handover.md` 作成(M7-overview §2.7 暫定構造案 + §0.3 / §0.4 / §2.9 / §2.10 等の判断経緯を凍結保存的に記録)
- retrospective-log v1.0.23+ 統合改訂(M7 期間反省 + M-1〜M-4 統合 + M7-3 候補のパターン化判断)
- progress-summary v1.4.0 改訂(M7 セクション追記)

---

## 1. 本セッションで完了した成果物一覧

### 1.1 リポジトリ反映済み(開発者反映済み、新セッションでは参照のみ)

| 種類 | ファイル | 反映日 | 用途 |
|------|---------|--------|------|
| 自由改訂 | CLAUDE.md §10.X(`virtual-controller-layout-v1` フェーズ 3 送り)| 2026-05-26 | M7 着手前自由改訂 |
| 自由改訂 | SUPP-001 v1.17.0 §4.1 M7 行(i18n / VC ストレージ フェーズ 3 送り注記)| 2026-05-26 | 同上 |
| 自由改訂 | architecture-patterns v1.0.6 §5(VC ストレージフェーズ 3 送り注記化)| 2026-05-26 | 同上 |
| モデル配分 | model-allocation v1.7.0(M7 セクション 7 件追記)| 2026-05-26 | M7 期間のモデル選定リファレンス |
| 調査指示書 | M7-RESEARCH-01-shadcn-ui-implementation-check.md v1.0.0 | 2026-05-26 | 自作ラッパー UI コンポーネント網羅調査(完了承認済み) |
| 調査結果 | M7-RESEARCH-01-report.md(製造担当 Claude Code 作成、Opus 4.6 実施)| 2026-05-26 | 自作ラッパー 26 件特定 + 特記事項 7 件 |
| 調査指示書 | M7-RESEARCH-02-responsive-variability-check.md v1.0.0 | 2026-05-27 | M1〜M4 レスポンシブばらつき調査(完了承認済み) |
| 調査結果 | M7-RESEARCH-02-report.md(製造担当 Claude Code 作成、Opus 4.6 実施)| 2026-05-27 | ブレークポイント 7 箇所 + DES-005 規定との乖離 9 件発見 |
| CHANGE 通知書 | CHANGE-017-des005-breakpoint-tailwind-alignment.md | 2026-05-27 | DES-005 §4.4 ブレークポイント Tailwind 標準整合化(反映完了) |
| 設計書本体 | DES-005 v2.10.0(CHANGE-017 反映)| 2026-05-27 | §4.4 規定値更新 |
| 採番管理 | change-number-registry v1.6.0(CHANGE-017 反映)| 2026-05-27 | 次回採番 018 |

### 1.2 本セッション最終ターンで提示済み(本 handover 作成時に開発者反映待ちの場合あり)

| 種類 | ファイル | 状態 | 用途 |
|------|---------|------|------|
| マイルストーン全体像 | **M7-overview v1.0.1** | 提示済み、開発者反映待ち or 反映済み | M7 期間の正本。M7-RESEARCH-01 / M7-RESEARCH-02 結果反映 + 案 Y 採用 + CHANGE-017 反映 + Header 共通化 M7-01 統合 + R-1 新解消基準等の全判断記録 |
| 反省記録 | **retrospective-log v1.0.22**(M7 期間反省 3 件前倒し記録)| 提示済み、開発者反映待ち or 反映済み | §6.6 M7 着手後課題 + §7.2 M7-3 候補(マイルストーン間実装パターン分裂)の正式記録 |
| 恒久資料 | **architecture-patterns v1.0.7**(§6 調査担当運用パターン新設)| 提示済み、開発者反映待ち or 反映済み | 本プロジェクト 4 例の調査担当運用を統合参照経路として記録、後続担当が呼び出し可能 |

新セッションでは、開発者から「**全て反映完了**」のメッセージ確認後、これらを正本として扱う。

### 1.3 本セッションでは未完成、新セッションで完成させる

- **M7-01 指示書 + レビューチェックリスト**(本 handover §3 参照、新セッション最優先タスク)
- **M7-02 指示書 + レビューチェックリスト**(本 handover §5 参照、M7-01 完了承認後)
- **M7-03 / M7-04 / M7-05 指示書 + レビューチェックリスト**(各サブマイルストーン完了承認後に順次作成、本 handover §6 で各々の方針を提示)

---

## 2. 本セッションで確定した重要判断(M7 期間全体に影響)

新セッションは以下の判断を **既に確定済みのもの** として扱う。判断の再協議は不要(開発者ご指示がある場合は別)。

### 2.1 主要設計判断(M7-overview v1.0.1 §2 で確定)

| # | 判断 | 採用案 | 主要根拠 |
|---|------|--------|--------|
| 1 | i18n 英語ロケール整備 | フェーズ 3 以降送り | 2026-05-26 開発者方針、画面 / 項目変更可能性 |
| 2 | `virtual-controller-layout-v1` ブラウザストレージ | フェーズ 3 以降送り | 同上、M7 マイルストーン数削減 |
| 3 | shadcn/ui 統一導入の進め方 | 案 β(標準 API に呼び出し側全画面を合わせる) | M7-RESEARCH-01 結果 + 長期保守性 |
| 4 | スキーマ耐久テスト用のキャラ追加 | AKI + 案 1 = 残り 3 キャラ計 4 体 / 案 2 = AKI + 1 体のみ(M7-04 着手前 Plan Mode で確定) | フェーズ 3 取り込みツール後で計 5 キャラ完成も可 |
| 5 | サブマイルストーン分割 | 案 X(M7-RESEARCH × 2 + 製造 5 件 = 計 7 件) | RESEARCH 分割初運用、Header 共通化 + ハンバーガー M7-01 統合 |
| 6 | handover 性質 | フェーズ 2 向け凍結保存的文書 | 2026-05-26 開発者方針、フェーズ 3 は別プロジェクトフォルダで本体 handover 引き継ぎなし |
| 7 | `web/prototypes/` 削除 | M7 完了承認後に開発者が実施 | SUPP-001 §4.1 / CLAUDE.md §3 既定 |
| 8 | **本格スマホ UI 整備**(DES-005 §5.6 / §5.8 / §5.9 / §5.10 / §7) | **フェーズ 3 以降送り(案 Y 採用)** | 2026-05-27 開発者方針、PC 体験重視 + フェーズ 3 取り込みツール先行意向 + M7-RESEARCH-02 で「ばらつきではなくほぼ未実装」判明 |
| 9 | DES-005 §4.4 ブレークポイント値 | 案 P-α(設計書本体を Tailwind 標準に合わせる、`tailwind.config.js` カスタマイズなし) | CHANGE-017 起票・反映完了 |

### 2.2 R-1 持ち越し課題の解消基準再定義(最重要)

**M7-overview v1.0.1 §0.3.3 で確定**:

- **旧解消基準(M5 期間担当起票時の想定)**: 全画面の Tailwind ブレークポイント整備、3 段階レスポンシブで正常表示
- **新解消基準(本セッションで確定)**: **Header 共通化 + ハンバーガーメニュー化(shadcn/ui Sheet)+ 既存横スクロール対応の温存 + R-2 / R-3 解消 = フェーズ 1 完了レベル**。本格スマホ UI(DES-005 §5.6 / §5.8 / §5.9 / §5.10 / §7 規定のカード形式 / アコーディオン / ボトムシート / スワイプ操作)は **フェーズ 3 以降へ送り**

新セッションは新解消基準に基づき M7-01 / M7-03 指示書を作成する。

### 2.3 サブマイルストーン構成と推奨モデル(model-allocation v1.7.0 反映済み)

| ID | スコープ | モデル | Plan Mode | 想定指示書サイズ | 想定時間 |
|----|--------|--------|-----------|--------------|----------|
| M7-RESEARCH-01 | shadcn/ui 統一導入の前提調査 | Sonnet 4.6 | 任意 | 619 行 | **完了** |
| M7-RESEARCH-02 | M1〜M4 レスポンシブばらつき調査 | Sonnet 4.6 | 任意 | 534 行 | **完了** |
| **M7-01** | **Dialog + Popover の shadcn/ui 移行 + Header 共通化 + ハンバーガー + 残課題 3 解消 + Props 命名是正 + モーダルパターン統一 + `window.confirm` 除去** | **Opus 4.6** | **必須** | **1000〜1200 行** | **150〜180 分(指示書作成)+ 200〜280 分(製造工程)** |
| M7-02 | Form + Toast + その他 shadcn/ui 移行 + C-2/C-3/C-4 解消 + architecture-patterns §1 分離パターン逸脱 4 件整理 | Opus 4.6 | 必須 | 800〜1000 行 | 120〜180 分(指示書作成)+ 200〜280 分(製造工程) |
| M7-03 | レスポンシブ実用化(案 Y 縮小スコープ)+ R-2 / R-3 解消 | Sonnet 4.6 | 必須 | 600〜800 行 | 90〜120 分 + 150〜200 分 |
| M7-04 | 残り 4 プリセット + AKI + 残り 3 キャラ追加 + スキーマ耐久 | Sonnet 4.6 | 必須 | 500〜700 行 | 60〜90 分 + 150〜200 分 |
| M7-05 | リファクタ + 統合 E2E + スマホ LAN 検証 + フェーズ 1 完了判定 + `m7-to-phase2-handover` 作成 | Sonnet 4.6 | 必須 | 600〜800 行 | 90〜120 分 + 200〜280 分 |

### 2.4 CHANGE 起票予定

- **CHANGE-017**(DES-005 §4.4 整合化)起票・反映完了済み(2026-05-27)
- M7 期間中の追加 CHANGE 起票は最小限想定(M7-overview v1.0.1 §9.2)
- 次回採番は **CHANGE-018** から(change-number-registry v1.6.0 §1)
- 起票可能性: M7-01 / M7-02 で React Hook Form 導入判断時の DES-002 §5.2 改訂 / M7-04 で `moves` テーブル構造変更時の DES-003 改訂 / M7-05 L-02 エラーコード解消で DES-006 改訂 等

---

## 3. M7-01 指示書作成方針(新セッション最優先タスク)

### 3.1 スコープ(M7-overview v1.0.1 §4.3 から具体化)

#### 主要スコープ 8 系統

1. **shadcn/ui 初期化**: `pnpm dlx shadcn-ui@latest init` 実行 + `web/components.json` 新設 + `tailwind.config.js` 更新(`darkMode` / `theme.extend.colors` の CSS 変数参照等)+ `web/src/lib/utils.ts` 新設(`cn()` 関数導入)+ 依存追加(`@radix-ui/*` + `class-variance-authority` + `tailwind-merge`、`clsx` は既導入の dead dependency を活用)
2. **shadcn/ui コンポーネント追加**: `pnpm dlx shadcn-ui@latest add dialog alert-dialog sheet popover dropdown-menu select tabs accordion command`(他に必要なものは M7-RESEARCH-01 報告書 §4.2 (d) 対応表を参照)
3. **Modal/Dialog 系 10 件移行**: M7-RESEARCH-01 §4.2 (b) で網羅された 10 件(PutConfirmDialog / PermanentDeleteConfirm / AddComboToCompareModal / KnockdownAdvantageChangeModal / SetupSelectorModal / DuplicateWarning / TagFormDialog / TagDeleteConfirmDialog / LinkExistingSetupModal / ModifiersEditor)を shadcn/ui の `dialog` / `alert-dialog` ベースに移行
4. **Popover / Dropdown / Select / Tabs / Accordion 系 7 件移行**: M7-RESEARCH-01 §4.2 (b) で網羅された Dropdown/Select 系 5 件(ColumnVisibilityMenu / TagSelector / PresetSwitcher / CharacterSelector / MyComboStatusSelect) + Tabs/Accordion 系 2 件(MyComboStatusTabs / SetupAccordionItem)を shadcn/ui 対応コンポーネントに移行
5. **Header 共通化**: `web/src/components/Header.tsx` 新設、各ページのインライン `<header>`(M7-RESEARCH-02 §4.3 (c) で 7 ページが個別実装と判明)を共通コンポーネント参照に置き換え。ナビゲーションリンク構成・順序・スタイルを統一(各画面で表示するリンクの定義は Plan Mode で開発者協議)
6. **ハンバーガーメニュー化**: shadcn/ui Sheet を採用、スマホサイズ(`sm:hidden`)でハンバーガーアイコン → Sheet スライド表示、PC サイズ(`hidden sm:flex`)で従来のリンク横並び表示。**残課題 3 解消**(全ページに「設定」リンク + プリセット disabled 化が自動反映される)
7. **Props 命名揺れ是正**: `open` / `isOpen` 混在 → `open` 統一、`onClose` / `onCancel` 混在 → shadcn/ui 慣例(`onOpenChange`)に統一(M7-RESEARCH-01 特記事項 4 由来)
8. **モーダル実装パターン分裂解消 + `window.confirm` 残存除去**: shadcn/ui Dialog の `@radix-ui/react-portal` で `createPortal` 4 件 / fixed overlay div 6 件混在を自動解消(M7-RESEARCH-01 特記事項 2 由来)+ SetupAccordionItem の `window.confirm` を shadcn/ui AlertDialog に置き換え(M7-RESEARCH-01 特記事項 5 由来)

#### スコープに含めない(M7-02 / M7-03 / 後フェーズ送り)

- Form / Input / Select(ネイティブ select 置換)/ Toast → **M7-02**
- C-2 / C-3 / C-4 解消 → **M7-02**
- architecture-patterns §1 分離パターン逸脱 4 件 → **M7-02**
- ボタン Component の全件差し替え → M7-02 で対応(規模次第)
- レスポンシブ仕上げ(R-1 / R-2 / R-3)→ **M7-03**
- 本格スマホ UI(DES-005 §5.6 / §5.8 / §5.9 / §5.10 / §7)→ **フェーズ 3 以降**
- Header 内のプリセット切替 / 言語切替 / ユーザー表示 / モード表示 → フェーズ 2 以降(M7-01 では Header 共通化 + ハンバーガーのみ)

### 3.2 §3.4 着手前確認の必須項目(M3-02 + M6-3〜M6-6 + M7-RESEARCH-01 / 02 反省踏襲)

- **対応表のスコープを UI 全範囲に拡張**(M6-6 教訓踏襲、playbook §4.6 + handover §5.2):
  - 既存自作ラッパー 26 件 × shadcn/ui 対応コンポーネント の対応表(M7-RESEARCH-01 報告書 §4.2 (d) を §3.4 で再確認)
  - 各 ページの Header インライン実装 7 ページ + Header 非表示 4 ページ × 共通 Header コンポーネントへの統合方針(M7-RESEARCH-02 §4.3 (c) を §3.4 で再確認)
- **既存 UI コンポーネントの 3 点セット確認**(playbook §4.9、M4-11 / M4-12 反省踏襲):
  - shadcn/ui 移行対象 17 件(Dialog 系 10 + Dropdown/Select 系 5 + Tabs/Accordion 系 2)の **構造 + 責務 + Props** を §3.4 で網羅確認(M7-RESEARCH-01 §4.2 (b) 表を参照)
- **shadcn/ui 初期化作業の事前確認**:
  - `pnpm dlx shadcn-ui@latest init` 対話入力値の Plan Mode 確定(`style` = `default` / `new-york`、`baseColor` = `zinc` / `slate` / 他、`cssVariables` = yes、`tailwind.config.js` パス、`importAlias` の `@/` 設定有無等)
  - `web/components.json` の初期設定値(M7-RESEARCH-01 §4.1 (b) で「ファイル存在しない」と確認済み)
- **既存 dependencies の確認**:
  - `clsx` は M7-RESEARCH-01 §4.1 (a) で「dead dependency」と判明、`cn()` 関数構成で活用
  - `@radix-ui/*` / `class-variance-authority` / `tailwind-merge` は未導入、追加が必要(CLAUDE.md §6 依存追加ポリシー遵守、Plan Mode で開発者承認)

### 3.3 §3.4.X Plan Mode 必須項目(M6-2 反省踏襲、本文中の Plan Mode 確定指示を §3.4.X リストに明示列挙)

- shadcn/ui 初期化の対話入力値(§3.2 参照)
- `pnpm dlx shadcn-ui@latest add` の対象コンポーネント列挙
- `web/components.json` の初期設定値
- `tailwind.config.js` の `darkMode` / `theme.extend.colors` 等の拡張内容
- Header 共通化時のナビゲーションリンク構成(各ページで表示するリンクの順序 + 現在ページのリンク除外判断、M7-RESEARCH-02 §4.3 (c) のページ別 Header 表を参照)
- ハンバーガーメニュー化時の表示閾値(`sm:hidden` でスマホのみ、shadcn/ui Sheet の挙動確認)
- Props 命名揺れ是正の対象コンポーネントと呼び出し元修正範囲
- 既存 Props 契約の維持判断(基本は案 β = shadcn/ui 標準 API、例外的に既存 API 維持するコンポーネントの個別判断)

### 3.4 §5.2 E2E シナリオで網羅すべき項目

- shadcn/ui 初期化後のビルド + 起動確認
- 移行コンポーネント 17 件すべての動作確認(各 Modal / Dialog / Popover / Dropdown / Select / Tabs / Accordion の開閉 + 操作 + 閉じる)
- Header 共通化後の全ページナビゲーション動作(PC + スマホ両方)
- ハンバーガーメニュー(スマホ)の動作確認
- 既存機能の回帰なし(M3-05 / M4-05 / M5-01 / M6-04 統合 E2E パターン踏襲)
- **PC + スマホサイズ両方で確認**(M7-03 まで本格スマホ UI は実装しないが、M7-01 完了時点でも実用可能なレベルが必要)

### 3.5 推奨テンプレ参照

- **M6-02**(設定画面 + 初回起動ウィザード、Opus 4.6、大規模 + 関心数 2、新規 UI 画面複数導入)= **最近接の Opus 4.6 大型指示書、M7-01 のテンプレ参照に最適**
- M6-03(スマホ専用ホーム + 共通 Footer 追加)= 共通 UI コンポーネント新設パターン
- M4-04(コンボ + セットプレイ同時登録、Opus 4.6、複数関心統合)

### 3.6 想定指示書サイズ + 完成見込み

- **1000〜1200 行クラス**(本プロジェクト最大規模、M6-02 = 約 800 行を上回る)
- 指示書作成想定時間: **150〜180 分**(新セッションで完遂可能と見込むが、コンテキスト圧迫に注意、必要な場合はさらに分割継承も検討)
- レビューチェックリスト想定: **400〜500 行**(M6-04 レビューチェックリスト 321 行を上回る、項目数多数のため)

---

## 4. M7-01 完了承認時の作業(M7-02 着手前)

### 4.1 retrospective-log v1.0.23 改訂(M7-01 期間反省統合記録)

- M7-01 製造担当連絡事項由来の設計担当ミス記録(発生時)
- **M7-1 候補(設計担当の前提資料確認時の想定漠然さ)を正式記録**: 本 handover §2 で言及した「M7-overview 起票時に自作ラッパー数を漠然と『10-15 件程度』と想定、実態は 26 件」を M7-RESEARCH-01 結果との対比で記録(2026-05-26 開発者方針「M7-02 完了時に統合記録」遵守、M7-01 完了時に統合可)
- **M7-3 候補の追加観察**(マイルストーン間実装パターン分裂、retrospective-log v1.0.22 §7.2 で記録済み):M7-01 で shadcn/ui 統一導入時に同種事例が発生していないか観察 + 記録
- M-1〜M-4 持ち越し(retrospective-log §6.6 既記録)の M7-02 統合記録準備

### 4.2 architecture-patterns 改訂候補

- **§1.2(新設候補)shadcn/ui 統一導入パターン**: M7-01 で確立された shadcn/ui 初期化 + コンポーネント追加 + Props 命名規約 + `cn()` 関数使用パターンを正式記録
- **§6.5 関連教訓**(調査担当運用パターン): M7-RESEARCH-01 / 02 の活用結果を §6.2 過去 4 例の蓄積表に追記

### 4.3 M7-02 指示書作成方針確定(本 handover §5 を起点)

---

## 5. M7-02 指示書作成方針(M7-01 完了承認後)

### 5.1 スコープ(M7-overview v1.0.1 §4.4)

#### 主要スコープ

1. **Form 系 3 件移行**: M7-RESEARCH-01 §4.2 (b) の Form/Field 系 3 件(ComboEditorBasicFields / SetupBasicInfoForm / ComboListFilters)を shadcn/ui の `form` + `input` + `select` + `label` 等に移行。**React Hook Form 導入判断は要 Plan Mode 協議**(playbook §17.2 vs DES-002 §5.2 の整合、CHANGE 起票候補)
2. **Toast 系移行**: 既存 M4-03 由来 `topMessage` パターンを shadcn/ui Toast または `sonner` に移行(Plan Mode で開発者協議)
3. **Badge / Display 系 2 件移行**: TagBadgeList / ValidationDisplay
4. **Table / List 系 4 件移行**: ComboTable / CompareTable / TrashList / TagListTable を shadcn/ui の `table` ベースに移行
5. **Button / Tooltip 等の汎用要素**: M7-RESEARCH-01 で網羅された残りすべて + ボタン Component の全件差し替え
6. **C-2 解消**: 個別 VC(VirtualController + SetupRecipeEditor)の UX 違和感評価(handover §3.9)
7. **C-3 解消**: LinkExistingSetupModal vs SetupSelectorModal 統合判断(M7-RESEARCH-01 §4.3 (b) で責務差異が事実列挙済み: LinkExistingSetupModal = mutation 内部完結 / SetupSelectorModal = callback 委譲)
8. **C-4 解消**: `setup.defaultRecipe` 条件描画パターン統一(M7-RESEARCH-01 §4.3 (b) で 15 箇所 + 3 パターン分裂が事実列挙済み)
9. **architecture-patterns §1 分離パターン逸脱 4 件整理**: LinkExistingSetupModal / SetupAccordionItem / TagSelector / TagFormDialog の useMutation / 内部バリデーション / 状態管理をコンポーネント内に直接保持している状態を解消、ロジックフック分離パターンへの移行(M7-RESEARCH-01 特記事項 7 由来、M-1〜M-4 持ち越し課題と一部連動)

### 5.2 推奨モデル: **Opus 4.6**(M7-overview §7 / §4.4 参照)

### 5.3 想定指示書サイズ: **800〜1000 行**、想定時間: 120〜180 分(指示書)+ 200〜280 分(製造工程)

---

## 6. M7-03 / M7-04 / M7-05 指示書作成方針(本 handover §6 で要約、各々完了承認後に詳細化)

### 6.1 M7-03(レスポンシブ実用化 + R-2 / R-3 解消、Sonnet 4.6)

- スコープ縮小済み(案 Y 採用、本 handover §2.1 #8 参照)
- 主要作業: 固定幅 3 件の見直し + テーブル系 `overflow-x-auto` 温存確認 + R-2(ComboTable シミー DR 列追加)+ R-3(AddComboToCompareModal キャラフィルタ追加)
- スコープに含めない: 本格スマホ UI 整備(DES-005 §5.6 / §5.8 / §5.9 / §5.10 / §7)
- 想定指示書: 600〜800 行 / 90〜120 分 / Sonnet 4.6 / Plan Mode 必須

### 6.2 M7-04(残り 4 プリセット + AKI + 残り 3 キャラ追加 + スキーマ耐久、Sonnet 4.6)

- 追加キャラ数の判断: 案 1(AKI + 残り 3 キャラ計 4 体)/ 案 2(AKI + 1 体のみ計 2 キャラ、残り 3 キャラはフェーズ 3 取り込みツール後)を Plan Mode で開発者協議(M7-overview §2.4)
- 想定指示書: 500〜700 行 / 60〜90 分 / Sonnet 4.6 / Plan Mode 必須

### 6.3 M7-05(リファクタ + 統合 E2E + スマホ LAN 検証 + フェーズ 1 完了判定、Sonnet 4.6)

- L-02 / L-03 / L-04 / M-1〜M-4 残り解消(M-1〜M-4 のうち M7-02 で整理されなかった残り)
- M3-05 / M4-05 / M5-01 / M6-04 統合 E2E パターン踏襲、本 M7-05 では shadcn/ui + Header 共通化 + キャラ複数化の交差点動作確認重視
- スマホ LAN 実機検証(M6-04 シナリオ U-1 未検証、ホスト OS 直接実行 + LAN スマホ実機アクセス)
- フェーズ 1 完了判定(M7-overview §13 DoD すべて確認)
- **`m7-to-phase2-handover.md` 作成**(M7-overview §2.7 暫定構造案ベース、§0.3 / §0.4 / §2.9 / §2.10 等の判断経緯を凍結保存的に記録)
- 想定指示書: 600〜800 行 / 90〜120 分 / Sonnet 4.6 / Plan Mode 必須

---

## 7. M7 全体完了時の作業方針(M7-05 完了承認時)

### 7.1 `m7-to-phase2-handover.md` 作成方針

- 性質: **フェーズ 1 完了凍結文書**(いつでもフェーズ 2 を再開できる状態の宣言)
- M7-overview v1.0.1 §2.7 暫定構造案踏襲:
  - §0 本書の位置づけ(フェーズ 1 完了凍結文書、いつでもフェーズ 2 を再開できる状態の宣言)
  - §1 フェーズ 1 完了状態(M0〜M7 達成内容のサマリ)
  - §2 フェーズ 2 送り持ち越し課題(P-1 / 残課題 1 / 残課題 4 関連 / REQ-001 フェーズ 2 機能列挙 / i18n 英語ロケール整備 / `virtual-controller-layout-v1` / **本格スマホ UI 整備**(DES-005 §5.6 / §5.8 / §5.9 / §5.10 / §7) / Header 内の追加要素 / 日英切替不適応 等)
  - §3 フェーズ 2 着手時に開発者が新セッション Claude に提示すべき資料リスト
  - §4 凍結時点の各設計書本体・補足資料・恒久資料のバージョンリスト
  - §5 フェーズ 3 先行が予定されている事情の記録(2026-05-26 開発者意向 + 案 Y 採用根拠)
- フェーズ 3 への引き継ぎは行わない(2026-05-26 開発者方針、フェーズ 3 は本体プロジェクト外、DES-003 + REQ-001 §6.2-6.5 + DES-004 を開発者が直接提示)

### 7.2 retrospective-log v1.0.23+ 統合改訂

- M7 期間反省全体記録(M7-1 候補 = 設計担当の前提資料確認時の想定漠然さ + M7-02 / M7-03 / M7-04 / M7-05 期間で発生した反省 + M7-3 候補のパターン化判断)
- M-1〜M-4 持ち越し統合
- §7.2 M7-3 候補の独立パターン化判断(retrospective-log v1.0.22 §7.2 で記録済み、M7-01 / M7-02 完了結果から類似事例観察を統合してパターン化判断)

### 7.3 その他の最終改訂

- progress-summary v1.4.0(M7 セクション追記)
- architecture-patterns v1.0.8+(M7 期間で確立された新パターンを統合)
- playbook 改訂(M4-M7 期間累積の改訂候補から総合判断、要否は開発者協議)

### 7.4 M7 完了承認後の作業(開発者責任)

- `web/prototypes/` 削除(SUPP-001 §4.1 / CLAUDE.md §3 既定)
- フェーズ 3 着手判断(知人配布計画の最終決定、フェーズ 3 担当 Claude のセッション起動準備)

---

## 8. 本セッションで適用した運用ルール(新セッション継続用)

### 8.1 コンテキスト評価運用(2026-05-26 受領)

- 限界が近い時 or 重たい作業の後だけで良い
- 毎回の評価は省略
- 新セッションで自己観察として継続

### 8.2 差分節のみ提示方式(2026-05-26 受領)

- 修正行が約 10 行以下 + 改訂理由がチャット内で説明済み の場合に適用
- 該当節の「修正前」「修正後」を並記、説明・経緯・バージョン履歴行は省略
- 開発者が直接編集、修正版を設計担当に渡す(目視確認は最小限)
- 適用しない場合: 複数ファイル横断 / 10 行超 / バージョン履歴整合性必要 / CHANGE 対象ファイルで正本性が問われる場合

### 8.3 retrospective-log 更新の前倒し範囲(2026-05-27 受領)

- handover 作成時に失われる可能性がある情報のみ前倒し記録
- M7-02 完了時に統合記録する候補は引き続き M7-02 完了承認時に実施
- 本セッションでは v1.0.22 で M7-2 + M7-3 候補 + M7-4 の 3 件のみ前倒し記録

### 8.4 調査担当運用(architecture-patterns v1.0.7 §6 で明文化済み)

- 過去 4 例(M5-RESEARCH-01 / M6-RESEARCH-01 / M7-RESEARCH-01 / M7-RESEARCH-02)の蓄積
- 起票要否判断 + 分割推奨判断は §6.4 参照
- 設計担当による活用パターン(指示書作成時の参照経路 4 件)は §6.3 参照

---

## 9. 関連ドキュメント

| 種類 | ファイル | 役割 |
|------|---------|------|
| 本資料 | 本ファイル(`m7-design-session-handover.md`)| M7 期間設計セッション継承資料 |
| マイルストーン全体像 | `docs/instructions/M7-overview.md` v1.0.1 | M7 期間の正本(必読)|
| 調査結果 | `docs/instructions/M7-RESEARCH-01-report.md` | shadcn/ui 統一導入の前提調査(必読)|
| 調査結果 | `docs/instructions/M7-RESEARCH-02-report.md` | M1〜M4 レスポンシブばらつき調査(必読)|
| CHANGE 通知書 | `docs/change-notes/CHANGE-017-des005-breakpoint-tailwind-alignment.md` | DES-005 §4.4 整合化(参照)|
| 設計書本体 | `docs/design/05-screen-design.md` v2.10.0 | DES-005、§4.4 ブレークポイント規定(CHANGE-017 反映済み)|
| 設計書本体 | `docs/design/requirements.md` v2.12.0 | REQ-001 |
| 設計書本体 | `docs/design/01-tech-stack.md` v1.3.0 | DES-001 |
| 設計書本体 | `docs/design/02-architecture.md` v1.8.0 | DES-002(§5.2 状態管理 / §5.3 スタイリング)|
| 設計書本体 | `docs/design/03-data-model.md` | DES-003 |
| 設計書本体 | `docs/design/04-notation-spec.md` | DES-004 |
| 設計書本体 | `docs/design/06-validation.md` v1.9.0 | DES-006 |
| 設計補足 | `docs/design/supp-001-detailed-design.md` v1.17.0 | SUPP-001(§4.1 M7 行 / §4.6 レスポンシブ対応タイミング)|
| 設計担当恒久資料 | `docs/handover/design-instruction-playbook.md` v1.8.0 | playbook |
| 設計担当恒久資料 | `docs/handover/architecture-patterns.md` v1.0.7 | §6 調査担当運用パターン新設済み |
| 設計担当恒久資料 | `docs/handover/change-number-registry.md` v1.6.0 | 次回採番 018 |
| 反省記録 | `docs/handover/retrospective-log.md` v1.0.22 | M7 期間反省 3 件前倒し記録済み |
| マイルストーン引き継ぎ | `docs/handover/m6-to-m7-handover.md` v1.0.0 | M6 完了状態 + 持ち越し |
| 過去調査指示書 | `docs/instructions/M7-RESEARCH-01-shadcn-ui-implementation-check.md` v1.0.0 | (参照)|
| 過去調査指示書 | `docs/instructions/M7-RESEARCH-02-responsive-variability-check.md` v1.0.0 | (参照)|
| プロジェクト指針 | `CLAUDE.md`(2026-05-26 改訂、`virtual-controller-layout-v1` フェーズ 3 送り反映済み)| 製造担当 / レビュー担当向け |
| 進捗ログ | `docs/progress/progress-log.md` | 製造工程の全量記録(必要時のみ参照)|
| 進捗サマリ | `docs/progress/progress-summary.md` v1.3.0 | M7 完了時に v1.4.0 へ追記 |
| モデル配分 | `docs/human-notes/model-allocation.md` v1.7.0 | M7 セクション 7 件追記済み |

---

## 10. 開発者への申し送り(継承時の確認事項)

新セッション開始時、設計担当 Claude が以下を確認する想定。開発者が事前に確認・準備していると初動がスムーズ:

- [ ] 1.2 提示物(M7-overview v1.0.1 / retrospective-log v1.0.22 / architecture-patterns v1.0.7)の開発者反映が完了している
- [ ] M7-overview v1.0.1 で記録された判断 9 件(本 handover §2.1)を改めて再協議する意向がない(意向が存在する場合は新セッション開始時に開発者から伝達)
- [ ] M7-01 着手のタイミング(即時着手 / 何らかの確認後)についての意向

---

*以上、M7 期間 設計セッション継承資料 v1.0.0*
