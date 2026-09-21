# 指示書 M7-03: レスポンシブ仕上げ(R-3 AddComboToCompareModal キャラクターフィルタ追加 + 既存固定幅 3 件対応 + R-1 / R-2 解消確認)

| 項目 | 内容 |
|------|------|
| 指示書ID | M7-03 |
| バージョン | 1.0.1 |
| 推奨モデル | Sonnet 4.6(M7-overview v1.0.1 §7 / handover §6 既配分 + Q9 ζ-1 確定継承。関心数 2 = R-3 解消(単一画面の UI 追加) + 既存固定幅 3 件の対応、Plan Mode 必須項目 5 件以内 = M7-01(必須項目 8 件 / Opus 4.6) / M7-02(必須項目 10 件 / Opus 4.6)より明確に小規模。M4 期間以降の Sonnet 4.6 採用先例(M3-03 / M3-05 / M4-02 / M4-03 等の単一機能追加マイルストーン)と整合)|
| Plan Mode | **必須**(下記 §3.4.10 に必須 5 項目あり、複数項目 = playbook v1.9.0 §8.4.2 質問書ファイル方式)|
| 機械レビュー | 必須(レビューモデル: Sonnet 4.6、別ファイル M7-03-review-checklist.md v1.0.0)|
| 並列性 | 単独(M7-04 以降は本指示書完了承認後に順次着手)|
| 依存指示書 | M7-02 完了承認済み(2026-05-31)+ M7-RESEARCH-02 完了承認済み(2026-05-27)+ CHANGE-017 反映済み(DES-005 v2.10.0)|
| 想定所要時間 | 120〜180 分(M7-01 / M7-02 より小規模、R-3 = 単一画面の UI 追加 + 既存固定幅 3 件の解消が主スコープ)|
| 作成者・作成日 | 設計担当 Claude(M7 期間担当)、2026-05-31 |

## 更新履歴

| バージョン | 更新日 | 更新内容 |
|-----------|--------|----------|
| 1.0.0 | 2026-05-31 | 初版作成。M7-02 完了承認(2026-05-31)後、M7-overview v1.0.1 §4.5 + §2.9 R-1 解消基準再定義(Header 共通化 + ハンバーガー化 + R-2/R-3 解消 = フェーズ 1 完了レベル)+ M7-RESEARCH-02 §4.3 (a) 既存固定幅 3 件 + §4.4 R-2 / R-3 持ち越し状態 + 特記事項 1(`lg:` / `xl:` / `2xl:` 未使用)を統合反映。R-2 は M4-04 で既に解消済み(M7-RESEARCH-02 §4.4 (a) 既明示)= M7-03 では確認のみ実施 |
| 1.0.1 | 2026-06-01 | M7-03 完了承認(2026-06-01)に伴う事後履歴整合修正。製造担当伝達 1(§4.1.1 概形コードの Props 誤り = `selectedId` → 正 `selectedCharacterId`、`characters` Props は不要 = CharacterSelector 内部で `useCharacters()` 自前呼出、retrospective-log v1.0.26 §6.6 M7-14 由来の設計担当ミス再発防止)+ Q28 (A) 確定(モーダル再オープン時の前回選択キャラ保持を §4.1.3 で明示追記)を反映。本指示書本体への修正であり、製造担当の参照用途としてバージョン更新(製造完了後の後追い修正) |

---

## 1. 背景と目的

### 1.1 背景

#### 1.1.1 M7-03 の位置づけ(レスポンシブ仕上げ)

M7-01(2026-05-27 完了承認)で Header 共通化 + ハンバーガー化が完了。M7-02(2026-05-31 完了承認)で系統 A 後半 + 指摘 6 軸が完了。M7-03 では M7-overview v1.0.1 §2.9 / §0.3.3 で再定義された **R-1 解消基準** の残対応 = **R-2 / R-3 解消** + 既存固定幅 3 件の対応を実施する。

R-1 解消基準の再定義(M7-overview v1.0.1):
- Header 共通化 + ハンバーガーメニュー化(M7-01 で **解消済み**)
- 既存横スクロール温存(本格スマホ UI = カード形式 / アコーディオン / ボトムシート / スワイプはフェーズ 3 以降送り = 案 Y 採用)
- **R-2 / R-3 解消** = フェーズ 1 完了レベル達成(本 M7-03 のスコープ)

#### 1.1.2 R-2 / R-3 の M7-RESEARCH-02 報告書による事実確認

##### R-2 関連: シミー DR 有データのカラム表示

M7-RESEARCH-02 §4.4 (a) で判明: シミー関連フィールド(`okiShimmyNeutralTech` / `okiShimmyBackTech`)+ DR 有データ(`okiMeatyNeutralTechThrowDr` / `okiMeatyBackTechThrowDr`)は **以下のコンポーネントで既に表示済み**:
- ComboDetailMetadata(コンボ詳細): `YesNo` コンポーネントで表示
- CompareTable(コンボ比較): `formatOkiDrNone` / `formatOkiDrYes` 関数で表示
- ComboEditor(コンボ登録・編集): 編集可能フィールドとして実装済み

= **R-2 は M4-04 で既に解消済み**。M7-03 では view で確認のみ実施(着手前確認 §3.4.5)。表示項目の規定整合(DES-005 §5.6 / §5.8)も M7-RESEARCH-02 + M7-02 でほぼ整合確認済み。

##### R-3 関連: AddComboToCompareModal キャラクターフィルタ UI

M7-RESEARCH-02 §4.4 (b) で判明: AddComboToCompareModal は **キャラクターフィルタ UI が完全に未実装**:
- `CharacterSelector` コンポーネントの import / 使用なし
- キャラクターフィルタ用 `useState` なし
- `useCharacters` フックなし
- コンボ取得クエリは `useCombos(open ? { characterId: INITIAL_CHARACTER_ID } : { characterId: -1 })` = `INITIAL_CHARACTER_ID` 定数で **固定**

= **R-3 が M7-03 メイン実装対象**。AddComboToCompareModal に CharacterSelector を組込み、ユーザーが任意のキャラのコンボから比較対象を追加できるようにする。

#### 1.1.3 既存固定幅 3 件の対応(M7-RESEARCH-02 §4.3 (a))

M7-RESEARCH-02 §4.3 (a) で特定された **横スクロール発生の可能性が高いパターン** のうち、既存固定幅 3 件:
- `max-w-[200px]` × 2 件(具体ファイル + 行番号は §3.4.4 view 確認で特定)
- `min-w-[160px]` × 1 件(同上)

スマホ画面幅(390px 等)で **要素自体が画面幅を超える**(横スクロール発生)+ レイアウト崩れの可能性。M7-03 で対応方針確定 → 実装。

#### 1.1.4 受領済み資料

| 資料 | 受領日 | M7-03 での位置づけ |
|------|--------|------------------|
| M7-RESEARCH-02 報告書 | 2026-05-27 完了承認 | R-2 / R-3 状態 + 既存固定幅 3 件 + 特記事項の主要事実根拠 |
| CHANGE-017 反映 | 2026-05-27 完了 | DES-005 §4.4 ブレークポイント Tailwind 標準整合化済み(v2.10.0)、本指示書の前提 |
| M7-02 完了承認 | 2026-05-31 完了 | Header 共通化 + ハンバーガー化 + shadcn/ui 統一導入完了 = M7-03 の前提環境 |
| retrospective-log v1.0.25 / architecture-patterns v1.0.9 | 2026-05-31 反映 | M7 期間の運用知見 + 確立パターン(§1.2 shadcn/ui 統一導入パターン継承 + §7 Dialog scroll 制約パターン継承) |

### 1.2 目的

本指示書完了時に以下を達成する:

- **R-3 解消**: AddComboToCompareModal に CharacterSelector(shadcn/ui Select ベース、M7-01 で確立)を組込み、ユーザーが任意のキャラから比較対象コンボを選択可能にする
- **既存固定幅 3 件の対応**: `max-w-[200px]` × 2 件 + `min-w-[160px]` × 1 件のスマホ表示崩れ対応(レスポンシブ化 or 除去、Plan Mode 必須項目 3 で確定)
- **R-2 解消確認**: シミー DR 有データのカラム表示が ComboDetailMetadata / CompareTable / ComboEditor で既に動作することを view 確認(M4-04 解消済み事実の追認、新規実装なし)
- **R-1 解消の総合達成**: M7-01 Header 共通化 + ハンバーガー化 + M7-03 R-2 / R-3 解消 + 既存固定幅対応 = M7-overview v1.0.1 §2.9 / §0.3.3 のフェーズ 1 完了レベル達成
- 既存機能(M1〜M6 + M7-01 + M7-02)に回帰なし

### 1.3 このマイルストーンで作らないもの

| 項目 | 送り先 / 理由 |
|------|------------|
| **本格スマホ UI 整備**(DES-005 §5.6 / §5.8 / §5.9 / §5.10 / §7 のカード形式 / アコーディオン / ボトムシート / スワイプ) | フェーズ 3 以降(M7-overview v1.0.1 §2.9 案 Y 採用、M7-RESEARCH-02 §4.5 (a) #5〜#9 由来)|
| **`lg:` / `xl:` / `2xl:` ブレークポイントの新規導入**(PC 向け表示の明示的最適化、M7-RESEARCH-02 特記事項 1) | フェーズ 2 以降(本 M7-03 では `sm:` / `md:` の既存使用範囲内で R-3 + 既存固定幅対応に留める、PC 向けの追加最適化は本 M7-03 スコープ外)|
| **テーブル系 4 件の `overflow-x-auto` 横スクロール廃止 + カード形式変換** | フェーズ 3 以降(M7-RESEARCH-02 §4.3 (b)、M7-overview §2.9 案 Y 採用継続)|
| **Header 内追加要素**(プリセット切替 / 言語切替 / ユーザー表示 / モード表示、M7-RESEARCH-02 §4.5 (a) #2) | フェーズ 2 以降(M7-overview §2.9)|
| **DES-005 §5.10 ゴミ箱 / §5.12 タグ管理画面のレスポンシブ仕様改訂** | 本指示書スコープ外(規定との乖離はフェーズ 3 で本格スマホ UI 整備時に CHANGE 起票)|
| **i18n キー追加(英語ロケール)** | フェーズ 3(M7-overview §2.1)、本 M7-03 のラベル変更は日本語のみ |
| **残り 4 プリセット + AKI + 残り 3 キャラ + スキーマ耐久テスト** | M7-04 |
| **指摘 1 軸問題 a / d 解消**(バックエンドキャッシュ計算 + VAL-C06/C07 復活、`moves` テーブル `drive_gauge_increase` カラム追加)| M7-04(Q11 γ-2 確定、M7-RESEARCH-03 §1.5 特記事項 2 由来)|
| **バグ #5 修正**(仮登録コンボ本登録昇格時エラー表示) | M7-04(Q20 (Y) 確定)|
| **`window.confirm` 全件 grep + AlertDialog 化**(retrospective-log v1.0.25 §6.6 M7-11 由来) | M7-05(Q19 (W) 確定)|
| **バグ #6 修正**(レシピなしセットプレイ登録時エラー表示なし) | M7-05(Q21 (BB) 確定)|
| **リファクタ + 統合 E2E + スマホ LAN 検証 + フェーズ 1 完了判定 + m7-to-phase2-handover.md 作成** | M7-05 |
| **設計書本体(REQ-001 / DES-001〜006)改訂** | 本指示書スコープ内で起票見込みなし(Q10 (X) 以降の確定方針継続、CHANGE 起票回避 = playbook §17.2 過剰な手順化の警戒)|
| **補足資料(SUPP-001 / playbook / architecture-patterns / handover / CLAUDE.md / change-number-registry / retrospective-log)改訂** | 本指示書製造担当の対象外、設計担当が完了承認後に retrospective-log v1.0.26 + architecture-patterns v1.0.10 を別タイミングで自由改訂(必要時) |

---

## 2. 成果物

### 2.1 作成するファイル

なし(本指示書は既存ファイル修正のみ、新規ファイル新設なし)

### 2.2 修正するファイル

#### A. R-3 解消: AddComboToCompareModal キャラクターフィルタ追加

- **`web/src/features/combo/components/AddComboToCompareModal.tsx`**(既存)に CharacterSelector 統合:
  - `useCharacters`(キャラ一覧取得)+ `CharacterSelector`(shadcn/ui Select、M7-01 で shadcn/ui 化済み)を import + 使用
  - キャラクター選択 state を `useState`(初期値 = M7-RESEARCH-02 既存の `INITIAL_CHARACTER_ID` 定数を維持)で管理
  - `useCombos` クエリの `characterId` を選択値に連動
  - UI 配置: モーダル上部にキャラセレクタ配置、その下に既存のコンボ候補リスト(従来通り)
  - キャラ切替時にコンボ候補リストが再フェッチ + 表示更新
  - Props 契約は維持(既存呼び出し元 ComparePage への影響なし)

##### 関連テスト
- **`web/src/features/combo/components/AddComboToCompareModal.test.tsx`**(既存、存在する場合)に以下のテストケース追加:
  - キャラセレクタが表示される
  - キャラ切替で `useCombos` クエリ paramsが更新される
  - 初期キャラ(`INITIAL_CHARACTER_ID`)でモーダルオープン時にコンボ候補が表示される
  - 他キャラに切替でそのキャラのコンボが表示される

#### B. 既存固定幅 3 件の対応(M7-RESEARCH-02 §4.3 (a))

§3.4.4 view 確認で特定された 3 件:
- `max-w-[200px]` × 2 件
- `min-w-[160px]` × 1 件

対応方針は §3.4.10 必須項目 3 で Plan Mode 確定:
- **候補 (A)**: 固定幅を削除 + Tailwind ユーティリティ(`flex-1` / `w-full` 等)で柔軟化
- **候補 (B)**: `sm:max-w-[200px]` 等で sm 以上にのみ適用、スマホでは制限なし
- **候補 (C)**: `min-w-[160px]` を `min-w-0` + `truncate` で長文時に省略表示
- **候補 (D)**: 現状維持(横スクロール温存で対応、本 M7-03 では触らない)

各 3 件の対応方針は個別に Plan Mode 判断(同じ方針が全 3 件に適用される必要はない、各箇所のドメイン文脈次第)。

### 2.3 変更しないもの(原則)

- 本格スマホ UI 整備(カード形式 / アコーディオン / ボトムシート / スワイプ、フェーズ 3 以降)
- `lg:` / `xl:` / `2xl:` ブレークポイントの新規導入(フェーズ 2 以降)
- テーブル系 4 件の `overflow-x-auto` 横スクロール廃止
- Header 内追加要素(フェーズ 2 以降)
- 設計書本体(REQ-001 / DES-001〜DES-006)= **改訂見込みなし**(R-2 / R-3 は既存規定の解消、CHANGE 起票回避)
- 補足資料(SUPP-001 / playbook / handover / CLAUDE.md / change-number-registry / architecture-patterns / retrospective-log)= 本 M7-03 製造担当の対象外
- M7-01 確立物(Header.tsx / Footer.tsx / shadcn/ui 既存コンポーネント / Header 非表示 4 ページ / システムタグ表示制御)
- M7-02 確立物(系統 A 後半 9 件移行 + Modal 内 input/label/textarea + Toast 移行 + 分離パターン逸脱解消 + C-2 (β) 現状維持 + C-3 / C-4 解消 + 指摘 6 軸 + Q10 (X) ComboDetailMetadata 表示項目 + Q22 案 A 修正 + native `<select>` 13 件維持 + ロジックフック 4 件 + Dialog scroll 制約パターン + react-hook-form + zodResolver + shadcn/ui Form 統合パターン)
- バックエンド全般(handler / service / repository / model / migration / config / netutil)= **本 M7-03 はフロント変更のみ、バックエンド変更なし**
- 既存 routes 定義
- ModifiersEditor の `console.warn` 残存(P-01)= 別観点で温存
- バックエンドの `drive_gauge_consumed_total` / `sa_gauge_consumed_total` カラム + API レスポンスフィールド + フロント型定義 = 温存(Q15 確定継承)

### 2.4 例外条項

本指示書スコープ内で実施を **許容** する例外:

| 項目 | 内容 |
|------|------|
| (a) AddComboToCompareModal への CharacterSelector + useCharacters 統合 | §2.2 A 既明示 |
| (b) AddComboToCompareModal の `useState`(キャラ選択 state)追加 | §2.2 A 既明示 |
| (c) 既存固定幅 3 件の Tailwind クラス修正(候補 A/B/C のいずれか、または個別判断) | §2.2 B 既明示、Plan Mode 必須項目 3 で確定 |
| (d) 関連テストの追加 / 修正 | §2.2 A / §2.2 B 既明示 |

**許容しないもの**: §2.3 既明示の全項目 + 新規 CHANGE 通知書起票(本指示書スコープ内で見込みなし、必要発生時は Plan Mode 停止 → 開発者協議)+ 依存追加(本 M7-03 は既存ライブラリのみで実装可能、依存追加見込みなし)

---

## 3. 前提条件

### 3.1 必読ドキュメント

製造担当は実装着手前に以下を読了する:

- `docs/instructions/M7-overview.md` v1.0.1(本マイルストーン全体像、§4.5 M7-03 スコープ + §2.9 R-1 解消基準再定義 + §0.3.3 案 Y 採用)
- `docs/instructions/M7-RESEARCH-02-report.md`(主要事実根拠、§4.3 (a) 既存固定幅 3 件 + §4.4 (a) R-2 状態 + §4.4 (b) R-3 状態 + 特記事項 1)
- `docs/instructions/M7-02-shadcn-ui-form-toast-pattern-cleanup-and-list-api-expansion.md` v1.0.1(M7-02 本体、shadcn/ui 統一導入 + Header 共通化の継承前提)
- `docs/design/05-screen-design.md` v2.11.0 §4.1(ヘッダ)+ §4.4(レスポンシブブレークポイント、CHANGE-017 反映済)+ §5.8(コンボ比較、AddComboToCompareModal 関連)
- `docs/design/02-architecture.md` v1.8.0 §5.3(スタイリング)
- `docs/design/01-tech-stack.md` v1.3.0 §2(技術スタック)
- `docs/handover/design-instruction-playbook.md` v1.9.0 §4.6 / §4.9 / §8.4 / §17.2
- `docs/handover/architecture-patterns.md` v1.0.9 §1(プレ層/ロジック層分離) + §1.1(queryKey 規約)+ **§1.2 shadcn/ui 統一導入パターン**(M7-01 / M7-02 で確立、本 M7-03 で踏襲)+ §7 Dialog scroll 制約パターン(M7-02 で正式化、AddComboToCompareModal もリスト含む Dialog のため適用継続)
- `docs/handover/retrospective-log.md` v1.0.25 §1 構造的アンチパターン + §6.6 M7 期間担当総括 + §6.7 / §6.8 / §6.9 / §6.10 運用知見 + §7.2 M7-3 候補クローズ判断
- `docs/handover/change-number-registry.md` v1.7.0(本指示書スコープ内では起票見込みなし)
- `CLAUDE.md`(§2 技術スタック + §10 開発時の注意事項)

### 3.2 任意参照(必要時のみ)

- `docs/design/requirements.md` v2.12.0(NFR301-302 / NFR306)
- `docs/instructions/M3-04-*.md`(または相当、CharacterSelector + useCharacters の確立期間、参考)
- `docs/instructions/M7-01-shadcn-ui-dialog-popover-and-header.md` v1.0.0(M7-01 本体、CharacterSelector の shadcn/ui Select 化済み箇所の参考)
- shadcn/ui 公式 https://ui.shadcn.com/docs/components(Dialog / Select 関連、本 M7-03 では既導入済みの再活用のみ)

### 3.3 参照不要

- フェーズ 2 / 3 機能の REQ-001 §7 / §6.2-6.5
- M5-RESEARCH-01 / M6-RESEARCH-01 / M7-RESEARCH-01 / M7-RESEARCH-03 報告書(本 M7-03 と関心領域が重ならない)
- 過去 handover アーカイブ(M1〜M5 期間担当のもの)
- M4-00 / M4-00b 指示書(P-01 関連、本 M7-03 では ModifiersEditor を触らない)

### 3.4 着手前の確認

§4 詳細仕様の実装に着手する前に以下を **すべて** 完了し、結果を Plan Mode 計画提示時に開発者報告する。**§3.4.9 対応表 + §3.4.10 Plan Mode 必須項目 5 件** が本節の中核(M6-3〜M6-6 + M7-5 連続発生の再発防止策、retrospective-log v1.0.25 §6.6 + playbook v1.9.0 §4.9)。

#### 3.4.1 既存ファイル構造の確認

- [ ] `web/src/features/combo/components/AddComboToCompareModal.tsx` の現状確認(M7-01 で shadcn/ui Dialog 化済み + M7-02 で Dialog scroll 制約パターン適用済みの前提)
- [ ] `web/src/features/mycombo/components/CharacterSelector.tsx` の現状確認(M7-01 で shadcn/ui Select 化済み)
- [ ] `useCharacters` フックの現状確認(M3-04 等で確立済み、本 M7-03 で再利用)
- [ ] `useCombos(open ? { characterId } : { characterId: -1 })` の `INITIAL_CHARACTER_ID` 定数の場所確認(M7-RESEARCH-02 §4.4 (b) 既明示)
- [ ] `ComparePage.tsx`(AddComboToCompareModal 呼び出し元)の現状確認(Props 渡しの変更不要を確認)

#### 3.4.2 R-3 既存実装の view 確認

§2.2 A の対象ファイル `AddComboToCompareModal.tsx` を view で **構造 + 責務 + Props の 3 点セット** 確認:

- 内部 `useQuery`(`useCombos`)の現状実装(キャラ ID 固定)
- 現在のキャラ未対応 UX(`INITIAL_CHARACTER_ID` でのみコンボ取得)
- モーダル UI 構造(DialogHeader / DialogContent / コンボ候補リスト / DialogFooter)
- 内部 `useState` の有無 + 命名

#### 3.4.3 R-2 既存実装の view 確認(解消済み事実の追認)

§1.1.2 R-2 関連の既存実装が M7-RESEARCH-02 §4.4 (a) の事実列挙どおりであることを view 確認:

- ComboDetailMetadata.tsx 行 110-113 / 118-121 のシミーフィールド表示
- ComboDetailMetadata.tsx 行 86-89 / 102-105 の DR 有データ表示
- CompareTable.tsx 行 29-35 / 97-100 / 38-45 / 93-96 のシミー + DR 有データ表示
- ComboEditor.tsx 行 148-152 / 171-175 / 515-519 / 548-552 の編集可能フィールド設定

**R-2 解消済み確認** = 各ファイルで表示が動作している事実の確認のみ、新規実装は不要。Plan Mode 計画提示時に view 結果を明示。

#### 3.4.4 既存固定幅 3 件の view 特定

M7-RESEARCH-02 §4.3 (a) で「`max-w-[200px]` × 2 件 + `min-w-[160px]` × 1 件」と特定された **具体的なファイル + 行番号** を `grep` で完全特定:

```bash
grep -rn "max-w-\[200px\]" web/src/
grep -rn "min-w-\[160px\]" web/src/
```

各 3 件について以下を view で確認:
- ファイル名 + 行番号
- 対応する UI 要素(コンポーネント内のどの部分か)
- 周辺レイアウトのコンテキスト(flex / grid / 親要素の幅制約)
- スマホ画面幅(390px 等)での表示シミュレーション(DevTools レスポンシブモード)

#### 3.4.5 Tailwind ブレークポイント使用状況の確認(参考、新規導入なし)

M7-RESEARCH-02 特記事項 1 で判明: `lg:` / `xl:` / `2xl:` がプロジェクト全体で使用ゼロ、`sm:` / `md:` のみ使用。

- `grep -rnE "\b(sm|md|lg|xl|2xl):" web/src/` で現状確認
- 本 M7-03 では **新規導入なし**(§1.3 既明示、フェーズ 2 以降送り)
- ただし R-3 + 既存固定幅対応で `sm:` / `md:` を使用する範囲は許容

#### 3.4.6 ComparePage(呼び出し元)の view 確認

- AddComboToCompareModal の呼び出し方確認
- Props 渡しの確認(本 M7-03 では呼び出し元への影響なしの想定、現状確認のみ)

#### 3.4.7 関連テストの現状確認

- `AddComboToCompareModal.test.tsx`(存在する場合)の view 確認
- `CharacterSelector.test.tsx`(存在する場合)の view 確認(M7-01 で shadcn/ui Select 化済み、変更不要前提)

#### 3.4.8 既存固定幅以外の小規模スマホ表示課題の有無確認

M7-RESEARCH-02 §4.3 (a) で特定された 3 件以外に、本 M7-03 着手前 view 確認時に新たに小規模なスマホ表示課題(例: ボタンが画面外にはみ出す / 文字が折り返されない等)が発見された場合、Plan Mode 計画提示時に列挙 + 対応要否を開発者協議。

**スコープクリープ警戒**:本 M7-03 は明確に小規模スコープ。発見した課題が「本格スマホ UI 整備に該当する」(乖離 #5〜#9 系統)場合は **フェーズ 3 以降送りで温存**(M7-03 で対応しない)。

#### 3.4.9 対応表の作成(M6-6 + M7-5 反省踏襲、最重要)

製造担当は §4 着手前に **対応表 3 表(A〜C)** を完全に埋めた状態で Plan Mode 計画提示する。M6-3〜M6-6 + M7-5 連続発生の再発防止策。

##### 表 A: R-3 AddComboToCompareModal キャラクターフィルタ追加対応表

| 項目 | 現状(M7-RESEARCH-02 §4.4 (b))| M7-03 アクション | 確認結果(製造担当が埋める)|
|------|----------------------------|----------------|---------------------|
| CharacterSelector import | なし | 追加 | |
| useCharacters フック使用 | なし | 追加 | |
| キャラ選択 useState | なし | 追加(初期値 = `INITIAL_CHARACTER_ID`)| |
| useCombos の characterId | `INITIAL_CHARACTER_ID` 固定 | 選択 state 連動 | |
| キャラセレクタ UI 配置 | — | モーダル上部に配置 | |
| 既存コンボ候補リスト UI | あり | 維持(キャラ切替で再描画)| |
| Props 契約 | 既存維持 | 変更なし | |
| Dialog scroll 制約パターン | M7-02 で適用済み(architecture-patterns v1.0.9 §7)| 継続(変更なし)| |

##### 表 B: R-2 既存実装解消済み確認表

| 項目 | M7-RESEARCH-02 §4.4 (a) 事実 | M7-03 確認結果 |
|------|----------------------------|--------------|
| ComboDetailMetadata シミー表示(行 110-113 / 118-121) | 表示あり | view 確認: ○ / × |
| ComboDetailMetadata DR 有表示(行 86-89 / 102-105) | 表示あり | view 確認: ○ / × |
| CompareTable シミー表示(行 29-35 / 97-100) | 表示あり | view 確認: ○ / × |
| CompareTable DR 有表示(行 38-45 / 93-96) | 表示あり | view 確認: ○ / × |
| ComboEditor シミー編集(行 151-152 / 174-175 / 518-519 / 551-552) | 編集可能 | view 確認: ○ / × |
| ComboEditor DR 有編集(行 148, 150, 171, 173, 515, 517, 548, 550) | 編集可能 | view 確認: ○ / × |

R-2 解消済み確認 = M7-03 で新規実装なし。

##### 表 C: 既存固定幅 3 件対応表

| # | ファイル + 行番号 | 固定幅 | 対応する UI 要素 | 採用候補 | 確定方針(必須項目 3)|
|---|-----------------|-------|---------------|---------|---------------------|
| 1 | (§3.4.4 view 確認で埋める)| `max-w-[200px]` | — | (A) / (B) / (C) / (D) | — |
| 2 | (§3.4.4 view 確認で埋める)| `max-w-[200px]` | — | 同上 | — |
| 3 | (§3.4.4 view 確認で埋める)| `min-w-[160px]` | — | 同上 | — |

製造担当は対応表 A〜C を **完全に埋めた状態** で Plan Mode 計画提示。未確認のまま §4 着手しないこと(retrospective-log v1.0.25 §1 構造的アンチパターン + §6.6 M6-3〜M6-6 + M7-5 再発防止、最重要)。

#### 3.4.10 Plan Mode で開発者協議が必要な必須項目(5 項目、複数項目 = 質問書ファイル方式必須、playbook v1.9.0 §8.4.2)

確認項目が 5 件のため、**製造担当は質問書ファイル方式**(playbook v1.9.0 §8.4.2)で計画提示する。任意名の `.md` ファイル(命名は製造担当判断、推奨 `m7-03-plan-mode-questions.md`)を作成し、開発者の一括ご回答を待機する。フォーマットは固定しない(製造担当判断、playbook v1.9.0 §8.4.3)。

なお retrospective-log v1.0.25 §6.6 M7-2 由来の運用反省 = M7-02 では CLI ウィザード逐次方式で実施されたが、本 M7-03 では **質問書ファイル方式の強制力ある明示** を本 §3.4.10 冒頭に記載する運用とする(設計担当の M7-03 期間担当としての改善試行)。製造担当が **CLI ウィザード逐次方式を選択することは本指示書スコープでは禁止する**(往復回数最適化 + 開発者の俯瞰的判断確保のため)。

1. **CharacterSelector の AddComboToCompareModal 統合配置 + UI 詳細**
   - キャラセレクタの配置: モーダル上部 / 下部 / 横並び の選択
   - キャラセレクタのラベル有無(「キャラクター:」等)
   - 初期値の維持: `INITIAL_CHARACTER_ID` 定数を初期値として使用(製造担当の view 確認結果を踏まえ判断)
   - **設計担当の推奨**: モーダル上部に「キャラクター:」ラベル付きで配置、初期値は `INITIAL_CHARACTER_ID`(既存 UX を最小変更で拡張)

2. **キャラ切替時のコンボ候補リストの動作**
   - キャラ切替で `useCombos` クエリの `characterId` が更新 → 新たなキャラのコンボ一覧が表示
   - 切替時のローディング表示の有無(useQuery の `isLoading` 状態を表示するか、シームレスに切り替えるか)
   - **設計担当の推奨**: M7-02 で既に確立されている TanStack Query の標準ローディング UX を踏襲(`isLoading` 状態で「読み込み中...」表示、既存実装慣例整合)

3. **既存固定幅 3 件の対応方針確定**(各 3 件個別)
   - 候補 (A): 固定幅削除 + Tailwind ユーティリティで柔軟化
   - 候補 (B): `sm:max-w-[200px]` で sm 以上のみ適用、スマホでは制限なし
   - 候補 (C): `min-w-[160px]` → `min-w-0` + `truncate`(長文時省略)
   - 候補 (D): 現状維持(横スクロール温存)
   - **設計担当の推奨**: 各箇所のドメイン文脈次第。一般的傾向 = (B) sm 以上のみ適用が UX 上自然(スマホでは画面幅最大化 + sm 以上では既存固定幅の意図保持)。ただし `min-w-[160px]` は (C) `min-w-0 + truncate` が UX 上妥当な場合あり(ドロップダウン内文字列長保証等)。view 確認結果次第で個別判断

4. **R-2 解消済み確認の Plan Mode 計画提示**
   - §3.4.3 view 結果を Plan Mode 計画提示時に「R-2 = M4-04 で既に解消済み、本 M7-03 で新規実装なし」として明示
   - 表 B 完全埋め状態で計画提示
   - **設計担当の推奨**: 計画提示時に表 B を含める(M7-RESEARCH-02 報告書の追認、再発防止と整合)

5. **AddComboToCompareModal のテスト追加方針**
   - 新規テストケース追加範囲(§2.2 A 末尾 4 件)
   - 既存テストの修正範囲(キャラ ID 固定前提のテストがあれば修正)
   - **設計担当の推奨**: §2.2 A 末尾の 4 ケースをすべて追加、既存テストは「初期キャラでのコンボ表示」テストとして再活用

#### 3.4.11 §4 着手の前提条件

§3.4.1〜§3.4.10 すべての確認結果を Plan Mode 計画提示に含めること。未確認のまま §4 詳細仕様の実装に着手しないこと(retrospective-log v1.0.25 §1 構造的アンチパターン + §6.6 各反省防止)。

**特に §3.4.9 対応表 3 表(A〜C)+ §3.4.10 Plan Mode 必須項目 5 件は本指示書の中核**: 対応表を完全に埋めた状態 + 必須項目 5 件の方針を質問書ファイル方式(playbook v1.9.0 §8.4.2、CLI ウィザード逐次方式禁止)で提示した状態で開発者の一括ご回答を受領することが §4 着手の絶対条件。

---

## 4. 詳細仕様

本節は §3.4 着手前確認 + Plan Mode 質問書ファイル方式(必須項目 5 件)+ 開発者承認後に着手。**§3.4.10 必須項目 5 件すべての方針が確定していない状態で本節の実装に着手しない**。

### 4.1 R-3 解消: AddComboToCompareModal キャラクターフィルタ追加

#### 4.1.1 概形

```tsx
// web/src/features/combo/components/AddComboToCompareModal.tsx(概形)
import { CharacterSelector } from "@/features/mycombo/components/CharacterSelector";

export function AddComboToCompareModal({ open, onOpenChange, ... }: Props) {
  const [characterId, setCharacterId] = useState<number>(INITIAL_CHARACTER_ID);
  const { data: combos, isLoading } = useCombos(open ? { characterId } : { characterId: -1 });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>コンボを追加</DialogTitle>
        </DialogHeader>

        {/* キャラクターセレクタ(本 M7-03 追加部分)*/}
        <div className="flex items-center gap-2">
          <Label>キャラクター:</Label>
          <CharacterSelector
            selectedCharacterId={characterId}
            onChange={setCharacterId}
          />
        </div>

        {/* 既存のコンボ候補リスト(キャラ切替で再描画)= 内部リストに max-h 適用継続(M7-02 §7 Dialog scroll 制約パターン)*/}
        <div className="max-h-[60vh] overflow-y-auto">
          {isLoading ? (
            <div>読み込み中...</div>
          ) : (
            combos?.map(combo => (
              <ComboCandidateItem key={combo.id} combo={combo} onAdd={onAdd} />
            ))
          )}
        </div>

        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>キャンセル</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

#### 4.1.2 Props 契約の維持

呼び出し元 ComparePage への影響なし。既存 Props(`open` / `onOpenChange` / `onAdd` / その他)はすべて維持。

#### 4.1.3 既存 `INITIAL_CHARACTER_ID` の温存 + モーダル再オープン時の挙動

##### 既存 `INITIAL_CHARACTER_ID` の温存

定数 `INITIAL_CHARACTER_ID` は **温存**(削除しない):
- **初回マウント時の初期値** として使用継続
- 既存 UX(モーダル初回オープン時の初期コンボ表示)を維持
- 将来的に「最後に選択したキャラを記憶する」UX 追加時(永続化、localStorage 等)に再活用可能性

##### モーダル再オープン時の挙動(Q28 (A) 確定方針、2026-06-01 製造担当伝達 2 由来)

`useState` がコンポーネントのマウント中維持されるため、モーダルを閉じて再度開いても **前回選択したキャラクターが保持される**(open=false では state のリセットを行わない):

- **採用方針**: 前回選択キャラ保持(モーダル閉じる → 再オープン時に前回キャラが表示される)
- **採用根拠**:
  - (a) UX 上の自然性: 「キャラ X のコンボを 1 件追加 → モーダル閉じる → 別のキャラ X のコンボを追加したい」というユースケースで毎回リセットは余計な操作
  - (b) 既存パターンとの整合: マイコンボ画面の CharacterSelector も「前回選択キャラ保持」(セッション中の状態維持)= 本プロジェクトの慣例整合
  - (c) `INITIAL_CHARACTER_ID` 定数の役割: 「アプリ起動時の初期値」として機能 = モーダル開閉のたびにリセットする値ではない(本来意図と整合)
  - (d) 将来的なキャラ選択記憶実装との整合: フェーズ 2 のキャラ選択記憶実装(`localStorage` 等への永続化)とも整合 = 本方針を採用すれば自然に拡張可能

- **採用しなかった方針**: 毎回 `INITIAL_CHARACTER_ID` にリセット(`useEffect(() => { setCharacterId(INITIAL_CHARACTER_ID); }, [open])` で対応する案)= UX 上不自然 + 将来拡張時に逆方向の変更が必要

製造担当の実装は本方針 = (A) と整合しているため、本 M7-03 完了承認スコープに編入完了(2026-06-01)。

#### 4.1.4 CharacterSelector の再利用

- M7-01 で shadcn/ui Select 化済み(`mycombo/components/CharacterSelector.tsx`)を **そのまま再利用**(新規作成 or 改造なし)
- Props 契約: `selectedId` / `onChange` / `characters`(または既存 Props、§3.4.1 view 確認結果次第)
- 本 M7-03 で CharacterSelector 自体への変更なし

### 4.2 既存固定幅 3 件の対応

§3.4.10 必須項目 3 で確定した対応方針を各 3 件に適用。例:

```tsx
// 候補 (A) 採用例: 固定幅削除
<div className="max-w-[200px]">  →  <div className="flex-1">

// 候補 (B) 採用例: sm 以上のみ適用
<div className="max-w-[200px]">  →  <div className="sm:max-w-[200px]">

// 候補 (C) 採用例: min-w-0 + truncate
<div className="min-w-[160px]">  →  <div className="min-w-0 truncate">

// 候補 (D) 採用例: 現状維持(本 M7-03 で触らない)
```

製造担当は §3.4.9 表 C で確定した個別方針を適用。

### 4.3 R-2 解消済み確認(新規実装なし)

§3.4.3 で view 確認した内容を **記録のみ**:
- ComboDetailMetadata.tsx のシミー + DR 有データ表示が動作中
- CompareTable.tsx のシミー + DR 有データ表示が動作中
- ComboEditor.tsx のシミー + DR 有データ編集が動作中

= 本 M7-03 では **コード変更なし**。製造担当の完了報告で「R-2 = M4-04 で既に解消済み、本 M7-03 で新規実装なし、view 確認のみ」として記録。

### 4.4 既知の制限事項の温存

- 本格スマホ UI(カード形式 / アコーディオン / ボトムシート / スワイプ)= フェーズ 3 以降送り
- `lg:` / `xl:` / `2xl:` ブレークポイントの新規導入 = フェーズ 2 以降
- テーブル系 4 件の `overflow-x-auto` 横スクロール廃止 = フェーズ 3 以降
- Header 内追加要素(プリセット切替 / 言語切替 / ユーザー表示 / モード表示)= フェーズ 2 以降
- バックエンドキャッシュ計算(`drive_gauge_consumed_total` 等)+ VAL-C06/C07 復活 = M7-04
- `moves` テーブル `drive_gauge_increase` カラム追加 = M7-04
- バグ #5 / バグ #6 = M7-04 / M7-05
- `window.confirm` 全件解消 = M7-05
- ModifiersEditor の `console.warn` 残存(P-01) = 別観点で温存
- PromoteToFinalButton の独立コンポーネント化 = フェーズ 2 以降
- ComboDetailMetadata の「消費量」表示復活 = フェーズ 2 候補要望(Q15 確定継承)

---

## 5. テスト要件

### 5.1 単体テスト

#### 5.1.1 新規追加 / 修正

- `AddComboToCompareModal.test.tsx`: §2.2 A 末尾の 4 件のテストケース追加
- 既存固定幅 3 件のテストは原則不要(Tailwind クラス変更のみ、DOM 構造変化なしの想定)

#### 5.1.2 件数見込み

M7-02 完了時点 420〜450 件前後 + 本 M7-03 追加 3〜5 件 = **423〜455 件前後**。

#### 5.1.3 実行コマンド

```bash
cd web && pnpm test --run
```

製造担当は完了報告で結果(成功 / 失敗 / スキップ件数)を記録。**バックエンドテストは変更なし**(本 M7-03 はフロント変更のみ)= `go test ./...` 実行は念のため動作確認のみ。

### 5.2 E2E シナリオ(別ファイル)

M7-01 / M7-02 と同じく、E2E シナリオは **別ファイル**(`m7-03-e2e-scenarios.md` 相当)で開発者が実機検証する。本指示書では機械レビュー対象外。製造担当はビルド + 起動 + 単体テスト PASS を完了報告の対象とする。

別ファイルは本 M7-03 完了承認後 + M7-04 着手前のタイミングで設計担当が作成 or 機械レビュー完了後に開発者が手動確認(M7-02 と同じ運用)。

### 5.3 開発者実機テストの依頼

製造担当の単体テスト + ビルド + 起動完了後、開発者に以下を依頼:

1. PC + スマホサイズ両方での動作確認
2. AddComboToCompareModal の動作確認:
   - キャラセレクタが表示される
   - キャラ切替でコンボ候補リストが更新される
   - 初期キャラ(`INITIAL_CHARACTER_ID`)で正常表示
   - Dialog scroll 制約パターンが継続動作(M7-02 確立、リストが長くてもビューポート内スクロール)
3. 既存固定幅 3 件の動作確認:
   - スマホサイズで横スクロール / レイアウト崩れが発生しない
   - PC サイズで既存 UX が維持されている(候補 (B) 採用時)
   - 長文時の省略表示が動作する(候補 (C) 採用時)
4. R-2 既存実装の動作確認(回帰なし):
   - ComboDetailPage でシミー + DR 有データ表示が正常
   - ComparePage でシミー + DR 有データ表示が正常
   - ComboEditorPage でシミー + DR 有データ編集が正常

---

## 6. レビュー観点(別ファイル参照)

機械レビューチェックリストは別ファイル `M7-03-review-checklist.md` を参照。観点は以下を網羅(8 章想定、M7-01 12 章 / M7-02 14 章より小規模):

1. ファイル一覧(§2.1 / §2.2 / §2.3 / §2.4)
2. 着手前確認結果(§3.4 全体、特に §3.4.9 対応表 3 表 + §3.4.10 Plan Mode 必須項目 5 件)
3. R-3 解消の妥当性(§4.1)
4. 既存固定幅 3 件対応の妥当性(§4.2)
5. R-2 解消済み確認の妥当性(§4.3、新規実装なし確認)
6. テスト要件の充足(§5)
7. スコープ外への変更がないこと(§2.3、最重要)
8. retrospective-log v1.0.25 §1 構造的アンチパターン + §6 各反省の再発なし

---

## 7. 完了条件(Definition of Done)

### 7.1 機能完了

- [ ] R-3 解消: AddComboToCompareModal に CharacterSelector 統合完了
- [ ] R-3: キャラ切替で `useCombos` クエリ paramsが更新 + コンボ候補リスト再描画
- [ ] R-3: `INITIAL_CHARACTER_ID` 定数の温存(削除されていない)
- [ ] R-3: Props 契約の維持(呼び出し元 ComparePage への影響なし)
- [ ] R-3: Dialog scroll 制約パターン継続動作(M7-02 §7 確立、リストが長くてもビューポート内スクロール)
- [ ] 既存固定幅 3 件の対応完了(候補 A/B/C/D のいずれかを各 3 件に個別適用、必須項目 3 確定方針)
- [ ] R-2 解消済み確認: ComboDetailMetadata / CompareTable / ComboEditor のシミー + DR 有データ表示が動作中(view 確認のみ、新規実装なし)
- [ ] 既存機能(M1〜M6 + M7-01 + M7-02)に回帰なし

### 7.2 テスト完了

- [ ] AddComboToCompareModal 単体テスト追加 + 全件 PASS(4 ケース追加)
- [ ] 既存テスト修正後 + 全件 PASS
- [ ] `pnpm test --run` 全件 PASS(423〜455 件前後)
- [ ] `pnpm build` + `pnpm dev` エラーなし
- [ ] バックエンド変更なし確認(`go test ./...` 念のため実行)

### 7.3 Plan Mode 確定事項の遵守

- [ ] §3.4.10 必須項目 5 件すべてが Plan Mode で開発者承認済み + 実装反映済み
- [ ] §3.4.9 対応表 3 表(A/B/C)を製造担当が完全に埋めた状態で計画提示済み
- [ ] Plan Mode 質問書ファイル(`m7-03-plan-mode-questions.md` 等)が作成され、開発者の一括ご回答受領済み(playbook v1.9.0 §8.4.2、CLI ウィザード逐次方式不採用)

### 7.4 スコープ外への変更がないこと(最重要)

- [ ] 設計書本体(REQ-001 / DES-001〜DES-006)変更なし
- [ ] 補足資料(SUPP-001 / playbook / architecture-patterns / handover / CLAUDE.md / change-number-registry / retrospective-log)変更なし
- [ ] 新規 CHANGE 通知書起票なし
- [ ] **バックエンド変更なし**(本 M7-03 はフロント変更のみ)
- [ ] 本格スマホ UI(カード形式 / アコーディオン / ボトムシート / スワイプ)が **実装されていない**(フェーズ 3 以降)
- [ ] `lg:` / `xl:` / `2xl:` ブレークポイントが **新規導入されていない**(フェーズ 2 以降)
- [ ] テーブル系 4 件の `overflow-x-auto` 横スクロール廃止が **実装されていない**(フェーズ 3 以降)
- [ ] Header 内追加要素(プリセット切替 / 言語切替 / ユーザー表示 / モード表示)が **実装されていない**(フェーズ 2 以降)
- [ ] バックエンドキャッシュ計算 / VAL-C06/C07 復活 / `moves` カラム追加 / バグ #5 修正が **含まれていない**(M7-04)
- [ ] `window.confirm` 全件解消 / バグ #6 修正 / 統合 E2E / LAN 検証 / フェーズ 1 完了判定 / `m7-to-phase2-handover.md` 作成が **含まれていない**(M7-05)
- [ ] M7-01 / M7-02 確立物への変更なし(Header.tsx / Footer.tsx / shadcn/ui 既存コンポーネント / Header 非表示 4 ページ / システムタグ表示制御 / 系統 A 後半 / ロジックフック 4 件 / Dialog scroll 制約パターン / react-hook-form 統合パターン / native `<select>` 13 件維持 / ComboDetailMetadata 表示項目 / Q22 案 A 修正等)
- [ ] バックエンドの `drive_gauge_consumed_total` / `sa_gauge_consumed_total` カラム + API レスポンスフィールド + フロント型定義 = 温存(Q15 確定継承)
- [ ] ModifiersEditor の `console.warn` 残存(P-01)= 継続温存
- [ ] PromoteToFinalButton の独立コンポーネント化が **実施されていない**(フェーズ 2 以降検討)
- [ ] i18n 英語ロケール追加が **含まれていない**(本 M7-03 では i18n キー変更も不要)
- [ ] CharacterSelector コンポーネント本体への変更なし(M7-01 確立物、本 M7-03 では再利用のみ)
- [ ] `useCharacters` フックへの変更なし(M3-04 等で確立済み、本 M7-03 では再利用のみ)

### 7.5 進捗ドキュメント更新

- [ ] `docs/progress/progress-log.md` に M7-03 完了報告が追記されている

---

## 8. 注意事項・判断に迷ったら

### 8.1 Plan Mode 停止して開発者協議が必須のケース

以下に該当した場合は §4 詳細仕様の実装を一時停止して開発者協議:

- §3.4.1〜§3.4.10 のいずれかで M7-02 完了状態 + M7-RESEARCH-02 報告書記述と実態に **大きな差分** が発見された
- R-3 実装中に CharacterSelector / useCharacters の Props 契約が想定と異なる(M7-01 確立物の追加変更が必要と判明)
- 既存固定幅 3 件の view 確認で M7-RESEARCH-02 §4.3 (a) 由来の特定箇所と実態に差分発見
- スコープクリープ警戒(§3.4.8): 本 M7-03 着手前 view 確認時に発見した課題が「本格スマホ UI 整備に該当する」場合、Plan Mode 停止 → 開発者協議でフェーズ 3 以降送りを確認
- R-2 既存実装の view 確認で M7-RESEARCH-02 §4.4 (a) の事実と異なる状態を発見(M4-04 以降の追加変更があれば、再評価必要)
- 既存機能の回帰が発見された
- shadcn/ui のメジャーバージョン更新等で公式ドキュメントと本指示書 §4 の手順が乖離

### 8.2 設計担当の判断意図(製造担当が誤解しやすい点の補足)

- **本 M7-03 は明確に小規模スコープ**: R-3 = 単一画面の UI 追加 + 既存固定幅 3 件の対応 + R-2 解消済み確認 = 3 系統。M7-01 / M7-02 の大規模スコープと比較して、スコープクリープを警戒する
- **R-2 は M4-04 で既に解消済み**: M7-RESEARCH-02 §4.4 (a) で表示動作の事実確認済み = M7-03 で view 確認のみ実施、新規実装は **不要**
- **本格スマホ UI はフェーズ 3 以降送り**: 乖離 #5〜#9(カード形式 / アコーディオン / ボトムシート / スワイプ)は本 M7-03 では触らない、M7-overview §2.9 案 Y 採用継続
- **CharacterSelector / useCharacters の再利用**: M7-01 で shadcn/ui Select 化済み + M3-04 等で確立済みの既存コンポーネント / フックを **そのまま再利用**、本 M7-03 では新規作成 / 改造なし
- **Dialog scroll 制約パターンの継続**: M7-02 で architecture-patterns v1.0.9 §7 として正式化、AddComboToCompareModal は既に適用済み = 本 M7-03 では継続(変更なし)
- **i18n キー変更も不要**: 本 M7-03 のキャラセレクタラベル「キャラクター:」は既存 i18n キーがあれば再利用、なければ日本語ハードコード(英語ロケール追加はフェーズ 3 送り)
- **既存固定幅対応の個別判断**: 各 3 件のドメイン文脈次第で候補 (A)/(B)/(C)/(D) を個別判断、機械的な同一方針適用は妥当ではない
- **Plan Mode 質問書ファイル方式の遵守**(playbook v1.9.0 §8.4.2): 必須項目 5 件 = 質問書ファイル方式必須、CLI ウィザード逐次方式は本指示書スコープでは禁止(retrospective-log v1.0.25 §6.6 M7-2 由来の運用反省 + §6.10 Plan Mode 反問運用知見の確立、設計担当の M7-03 期間担当としての改善試行)

### 8.3 CHANGE 通知書起票判断

本指示書スコープ内では追加起票の見込みなし(M7-overview §9.2、change-number-registry v1.7.0 次回 019)。理由:
- R-3 解消は既存規定(DES-005 §5.8 コンボ比較、AddComboToCompareModal 関連)の実装、規定改訂は不要
- 既存固定幅 3 件対応は Tailwind クラス変更のみ、設計書本体への影響なし
- R-2 解消済み確認は M4-04 解消済み事実の追認、新規実装なし

万一起票が必要と判明した場合は Plan Mode 停止 → 開発者協議(playbook v1.9.0 §16、change-number-registry §0)。

### 8.4 プロジェクト起動方式

`web/` 配下で `pnpm dev` 起動 → http://localhost:3000(または `vite.config.ts` 既定ポート)。バックエンドは本指示書スコープ外(変更なしのため既存挙動温存)。

### 8.5 設計担当への質問チャネル

製造担当は **Plan Mode 質問書ファイル方式**(playbook v1.9.0 §8.4.2、必須項目 5 件)で開発者を介して設計担当に確認する。直接の Q&A セッションは設けない(playbook §1 役割分離)。

---

*以上、M7-03 指示書 v1.0.0*
