指示書サイズが大きいので余分な内容をエスケープ


### 5.2 E2E シナリオ(製造担当 + 開発者で実機確認)

製造担当は以下のシナリオを **PC + スマホサイズの両方** で確認し、完了報告に結果を記録する。スマホサイズ確認はブラウザの DevTools(Chrome / Firefox / Safari)のレスポンシブモードで `iPhone 12 Pro`(390×844)等を選択して実施。

#### シナリオ A: shadcn/ui 初期化 + ビルド + 起動

1. `pnpm install` 実行 → エラーなく完了
2. `pnpm build` 実行 → エラーなく完了
3. `pnpm dev` 実行 → エラーなく起動
4. ブラウザで http://localhost:3000(またはプロジェクトデフォルトポート)アクセス → ホーム / コンボ一覧が正常表示

#### シナリオ B: shadcn/ui Dialog / AlertDialog の動作確認(Modal/Dialog 系 10 件)

各 Modal/Dialog を起動 → 開閉 + 操作 + 結果反映を確認:

- B-1: コンボ編集画面で「保存」ボタンクリック → PutConfirmDialog が開く → 「はい」で保存完了、「いいえ」でキャンセル
- B-2: ゴミ箱画面で完全削除ボタン → PermanentDeleteConfirm が開く → ESC キーで閉じる、「キャンセル」で閉じる、「完全に削除」で削除実行
- B-3: コンボ比較画面で「コンボを追加」ボタン → AddComboToCompareModal が開く → コンボ選択 → 追加される
- B-4: コンボ編集画面で knockdown_advantage 変更 + 既存 setup あり → KnockdownAdvantageChangeModal が開く → 3 選択肢(carry_all / unlink_all / individual)動作確認
- B-5: コンボ新規作成画面で「セットプレイ選択」ボタン → SetupSelectorModal が開く → セットプレイ選択 → 反映
- B-6: コンボ編集画面で重複候補ありの状態で「最終登録」ボタン → DuplicateWarning が開く → 閉じる動作確認
- B-7: タグ管理画面で「新規タグ」ボタン → TagFormDialog が開く → 入力 + 送信 → タグ追加成功、空入力で送信 → Zod バリデーションエラー表示
- B-8: タグ管理画面でタグ削除ボタン → TagDeleteConfirmDialog が開く → 「削除」で削除実行、「キャンセル」で閉じる
- B-9: コンボ詳細画面で「既存セットプレイを紐付け」ボタン → LinkExistingSetupModal が開く → セットプレイ選択 → 紐付け成功
- B-10: コンボ編集画面で技ステップの修飾ボタン → ModifiersEditor が開く → checkbox / radio / textarea 操作 → 保存

各シナリオで以下を確認:
- ESC キーで閉じる(Dialog のみ、AlertDialog は閉じない = `@radix-ui/react-alert-dialog` 標準動作)
- 背景クリックで閉じる(Dialog のみ、AlertDialog は閉じない)
- 「閉じる」ボタン(X アイコン)で閉じる(shadcn/ui Dialog / AlertDialog 標準で表示)
- `createPortal` でなくとも z-index が正しく管理される

#### シナリオ C: shadcn/ui Dropdown / Select / Tabs / Accordion の動作確認(7 件)

- C-1: マイコンボ画面で ColumnVisibilityMenu(列表示設定)→ DropdownMenu 開閉 + チェックボックス操作で列表示切替
- C-2: コンボ編集画面でタグ選択フィールド → TagSelector(Popover + Command)開閉 + 検索 + 選択 + インライン新規作成
- C-3: 設定画面 + ウィザード Step4 + コンボ詳細画面でプリセット切替 → PresetSwitcher(Select)動作
- C-4: マイコンボ画面 + 設定画面 + ウィザード Step3 でキャラ選択 → CharacterSelector(Select)動作
- C-5: コンボ編集画面 + コンボ一覧行でステータス選択 → MyComboStatusSelect(Select)動作
- C-6: マイコンボ画面でステータスタブ切替 → MyComboStatusTabs(Tabs)動作
- C-7: コンボ詳細画面でセットプレイのアコーディオン → SetupAccordionItem(Accordion)開閉 + 削除ボタン → AlertDialog(`window.confirm` 置換)で確認 → 削除実行

#### シナリオ D: Header 共通化 + ハンバーガー動作確認

- D-1: PC サイズ(`>= 640px`)でコンボ一覧 / マイコンボ / コンボ詳細 / コンボ比較 / 設定 / タグ管理 / ゴミ箱の 7 ページを順次訪問 → 各ページで Header のナビリンク横並びが表示 + 構成が統一(8 項目: ロゴ + コンボ一覧 + マイコンボ + コンボ比較 + タグ管理 + プリセット管理 disabled + ゴミ箱 + 設定)
- D-2: 各ページで現在ページのリンクが disabled スタイル(`pointer-events-none + text-gray-400`)で表示される
- D-3: プリセット管理リンクが disabled + ツールチップ「今後実装予定」で表示される
- D-4: 設定リンクが全 7 ページで表示される(残課題 3 解消、M6-02 v1.0.2 で SettingsPage のみだった状態が全ページに自動反映)
- D-5: スマホサイズ(`< 640px`)で各ページの Header → PC ナビが非表示 + ハンバーガーアイコンが表示される
- D-6: ハンバーガーアイコンクリック → shadcn/ui Sheet が右からスライドイン + ナビリンク縦並び表示
- D-7: Sheet 内のリンククリック → 該当ページに遷移 + Sheet が自動で閉じる
- D-8: Sheet の閉じるボタン(X アイコン)or 背景クリック or ESC キーで Sheet が閉じる
- D-9: TrashPage で Header が `sticky top-0 z-10` で固定表示される(他ページは sticky なし、UX 差異温存)
- D-10: **Header 非表示 4 ページ(ComboEditorPage / SetupEditorPage / WizardPage / HomePage)で Header が表示されない**(案 A 採用、現状維持)
- D-11: ComboEditorPage / SetupEditorPage の戻るリンク / Save 等の既存 UI 要素は変更なし(回帰なし)
- D-12: WizardPage 7 ステップ動作 → Header なしで M6-02 確立フローが変わらない
- D-13: HomePage のスマホ表示 → タイトルバー + 主要機能ボタン + 最近更新したコンボがフッターと連動して正常表示(M6-03 確立)

#### シナリオ E: Props 命名揺れ是正の動作確認

- E-1: TrashListRow / TrashBulkActions から PermanentDeleteConfirm を開く → `isOpen` → `open` リネーム後も動作変化なし
- E-2: 全 17 件のラッパーで `onClose` / `onCancel` callback の動作変化なし(`onOpenChange` ラップ経由)
- E-3: 既存の意味付き callback(`onConfirm` / `onSubmit` / `onSelect` 等)はすべて維持されている

#### シナリオ F: モーダル実装パターン分裂解消の動作確認

- F-1: `createPortal` ベース 4 件(PutConfirmDialog / PermanentDeleteConfirm / TagFormDialog / TagDeleteConfirmDialog)が shadcn/ui Dialog/AlertDialog の portal 経由で正常動作
- F-2: fixed overlay div ベース 6 件(AddComboToCompareModal / KnockdownAdvantageChangeModal / SetupSelectorModal / DuplicateWarning / LinkExistingSetupModal / ModifiersEditor)が shadcn/ui Dialog の portal 経由で正常動作
- F-3: 複数モーダルが重なる状況(例: コンボ編集中に knockdown_advantage 変更 → KnockdownAdvantageChangeModal → Save → PutConfirmDialog)で z-index が正しく管理される

#### シナリオ G: `window.confirm` 除去の動作確認

- G-1: コンボ詳細画面で SetupAccordionItem の削除ボタンクリック → ネイティブの `window.confirm` ではなく shadcn/ui AlertDialog が開く
- G-2: AlertDialog の「削除」で削除実行、「キャンセル」で閉じる動作確認

#### シナリオ H: 既存機能の回帰なし(M1〜M6)

- H-1: M1 機能(コンボ CRUD + プリセット解決 + 仮想コントローラ)が変わらず動作
- H-2: M2 機能(リアルタイム重複検知 + ゴミ箱)が変わらず動作
- H-3: M3 機能(タグ機能 + マイコンボ画面)が変わらず動作
- H-4: M4 機能(セットプレイ CRUD + 紐付け + knockdown_advantage モーダル + コンボ + セットプレイ同時登録)が変わらず動作
- H-5: M5 機能(コンボ比較画面 + 選択モード)が変わらず動作
- H-6: M6 機能(設定 API + 設定画面 + 初回起動ウィザード + スマホ専用ホーム + スマホフッター)が変わらず動作



### 5.3 開発者実機テスト依頼

製造担当のシナリオ A〜H 確認完了後、開発者に PC + スマホサイズ両方での E2E 抜粋 + UX 評価(画面ショット提示、playbook §14)+ ハンバーガー UX 確認(モバイル実機 or DevTools)+ Header ナビ構成 UX 確認を依頼。開発者承認後に M7-01 完了承認 → M7-02 着手。

### 7.3 E2E 動作確認完了

- [ ] §5.2 シナリオ A〜H すべてを PC + スマホサイズ両方で確認
- [ ] 開発者実機テストで承認受領


## 8. 参照ドキュメント

| 種類 | ファイル | 役割 |
|------|---------|------|
| 本指示書 | 本ファイル(M7-01) | 指示書本体 |
| マイルストーン全体像 | `docs/instructions/M7-overview.md` v1.0.1 | M7 期間の正本(必読) |
| 調査結果 | `docs/instructions/M7-RESEARCH-01-report.md` | shadcn/ui 統一導入の前提調査(必読) |
| 調査結果 | `docs/instructions/M7-RESEARCH-02-report.md` | レスポンシブ + Header 調査(必読) |
| CHANGE 通知書 | `docs/change-notes/CHANGE-017-des005-breakpoint-tailwind-alignment.md` | DES-005 §4.4 整合化(反映完了済) |
| 設計書本体 | `docs/design/05-screen-design.md` v2.10.0 | §4.1(ヘッダ) + §4.2(フッター参考) + §4.4(BP、CHANGE-017 反映済) |
| 設計書本体 | `docs/design/02-architecture.md` v1.8.0 | §5.3 スタイリング |
| 設計書本体 | `docs/design/01-tech-stack.md` v1.3.0 | §2 技術スタック |
| 設計担当恒久 | `docs/handover/design-instruction-playbook.md` v1.8.0 | §4.6 / §4.9 / §17.2 |
| 設計担当恒久 | `docs/handover/architecture-patterns.md` v1.0.7 | §1 / §1.1 / §6 |
| 反省記録 | `docs/handover/retrospective-log.md` v1.0.22 | §1 + §6.6 |
| 引き継ぎ | `docs/handover/m6-to-m7-handover.md` | §3 + §5 |
| 設計セッション引継 | `docs/handover/m7-design-session-handover.md` v1.0.0 | §3 |
| 採番管理 | `docs/handover/change-number-registry.md` v1.6.0 | 次回 018 |
| 設計補足 | `docs/design/supp-001-detailed-design.md` v1.17.0 | §4.1 M7 行 + §4.6 |
| プロジェクト指針 | `CLAUDE.md` | §2 + §6 |
| 過去指示書(参照) | `docs/instructions/M6-02-*.md` | SettingsPage 設定リンク + プリセット disabled パターン |
| 過去指示書(参照) | `docs/instructions/M6-03-mobile-home-and-footer.md` | 共通 UI 新設パターン(Footer.tsx) |
| 過去指示書(参照) | `docs/instructions/M6-04-integration-e2e-and-residual-fix.md` | 統合 E2E パターン |
| 公式ドキュメント | https://ui.shadcn.com/docs/components | shadcn/ui 各コンポーネント API |
| 公式ドキュメント | https://www.radix-ui.com/primitives | Radix UI(shadcn/ui 内部基盤) |



## 10. 完了後の次ステップ

M7-01 完了承認後の作業順序:

1. 製造担当連絡事項由来の設計担当ミス記録: retrospective-log v1.0.23+ 追記(あれば、handover §4.1)
2. architecture-patterns 改訂候補: shadcn/ui 統一導入で確立された新パターン(handover §4.2)
3. **M7-02 指示書作成方針確定**(handover §5): スコープ = Form + Toast + Badge/Display + Table/List + その他 + C-2/C-3/C-4 解消 + 分離パターン逸脱 4 件整理 / 推奨 Opus 4.6 / 想定 800〜1000 行
4. M7-03 / M7-04 / M7-05 着手(M7-02 完了承認後)
5. M7-05 完了承認時: フェーズ 1 完了判定(M7-overview §13 DoD)+ `m7-to-phase2-handover.md` 作成 + retrospective-log v1.0.23+ 統合 + progress-summary v1.4.0 改訂 + architecture-patterns v1.0.8+ 統合
6. M7 完了承認後の開発者責任作業: `web/prototypes/` 削除 + フェーズ 3 着手判断(フェーズ 2 飛ばしフェーズ 3 = 公式データ取り込み FR701 = 知人配布計画と整合)

### 9.3 CHANGE 通知書起票判断

本指示書スコープ内では追加起票の見込みなし(M7-overview §9.2、change-number-registry v1.6.0 次回 018)。理由:

- DES-001 §2 / DES-002 §5.3 / CLAUDE.md §2 の shadcn/ui 記述との乖離は本指示書完了で自動的に整合
- DES-005 §4.1 ヘッダ規定との乖離: ハンバーガー → 本 M7-01 で解消 / 追加要素 4 件 → フェーズ 2 以降送りで運用解釈対応
- DES-005 §4.4 BP → CHANGE-017 で反映済

万一起票が必要と判明した場合は Plan Mode 停止 → 開発者協議(playbook §16、change-number-registry §0)。

### 9.4 プロジェクト起動方式

`web/` 配下で `pnpm dev` 起動 → http://localhost:3000(または `vite.config.ts` 既定ポート)。バックエンドは本指示書スコープ外(変更なしのため既存挙動温存)。
