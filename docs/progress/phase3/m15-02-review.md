# M15-02 レビュー報告書

対象: M15-02（info-mark ヘルプ機構⑤⑩ ＋「比較対象選択」ボタン改称③）v1.1.0
レビュー担当: 品質レビュー Claude（read-only）/ 2026-07-03
対象コミット: `825d76f`（InfoMark 機構⑩ 新設 ＋ i18n）/ `fa71a16`（⑤ ModifiersEditor 適用）/ `93d8712`（③改称 E2E）

## 総評

指示書 v1.1.0 の狙い（③＝改称で根治・⑤＝再利用可能な info-mark 機構⑩で説明）に対し、忠実かつ非破壊的に実装されている。既存 shadcn `Popover`（M7-01 導入・`web/src/components/ui/popover.tsx`）を流用しており自作再発明はない。i18n キー `help` は本ブランチ以前に未占有で命名衝突なし、test-id は `info-mark-<topic>` 系統で M15-01 `combo-editor-*` と非衝突。選択モードは実査上「比較対象選択」専用（count/compare/exit のみ・一括削除やタグ付けを兼ねない）で改称ラベルは正確。Vitest 19 件（InfoMark 4・ModifiersEditor 13・locales parity 2）をローカルで再実行し全通過を確認。重大な設計逸脱は検出されず。残る指摘は完了報告（DES-005 CHANGE 判定・test-id 規約）の在処と、⑤テストのアサーション強度に関する軽微な範囲。

## 設計準拠性レビュー結果

### §1 設計・パターンとの照合

- §1.1 info-mark 機構（⑩） ◎
  - `InfoMark`（`web/src/components/InfoMark.tsx`）が ⓘ（lucide `Info`）＋クリック/タップで説明表示。既存 shadcn `Popover` を流用（自作再発明なし・playbook §4.6 適合）。
  - Props は `topic`/`text`/`ariaLabel?`/`className?` の最小構成（YAGNI・digest §3）。説明文は呼び出し側で i18n 解決済み文字列を渡す設計で、機構と文言を分離しており再利用性が高い。
  - `type="button"` ＋ `onClick={(e)=>e.stopPropagation()}` で押下副作用なし。Vitest で form 内 submit 非発火を検証済み。
  - ホバー限定でなく **クリック/タップで開く Popover** を採用しモバイル/LAN（arch §10）に適合。
- §1.2 test-id・命名 ◎
  - ⑤ は `info-mark-modifier`（＋content `info-mark-modifier-content`）。`combo-editor-*` と別系統で衝突なし（grep で確認）。③ は改称のみで info-mark test-id を持たず、既存ボタン導線を温存。
  - i18n キー `help.modifier` は追加前の main に `help` キーが存在しないことを確認済み（占有調査済み・digest §4 の M11-4 再発防止に適合）。
- §1.3 適用（③改称・⑤info-mark） ◎
  - ③: `selectMode.enter` を ja「選択モード」→「比較対象選択」/ en「Select Mode」→「Select to Compare」へ改称。ComboListPage・MyComboPage 両画面が同一 i18n キー参照のため両箇所同時改称。既存動作（enter/exit/count/compare）不変。
  - ③前提（比較専用性）: 実査で選択モード ON 時の UI は count バッジ・compare・exit のみ（`handleCompare` は `MAX_COMPARE_COMBOS` 制限）。一括削除/タグ等の汎用マルチセレクトを兼ねず、DES-005 §5.6 の「選択モードトグル（複数選択→比較画面への導線）」とも一致。改称は正確。
  - ⑤: `ModifiersEditor` の DialogTitle 隣に `InfoMark(topic=modifier, text=t("help.modifier"))` を付加。既存 flags/type/notes/保存/キャンセル導線は不変（付加のみ）。
  - 適用範囲は ③⑤ のみ。`InfoMark` の利用箇所は ModifiersEditor 1 箇所のみで、他項目へ勝手に拡張していない（grep 確認）。
- §1.4 説明文の内容 ◎
  - ja「各ステップに付けられる補足設定です。フラグやメモなどを編集できます。」/ en「Per-step supplementary settings...」。M16 依存概念（始動 vs 消費・技/非技 taxonomy）に一切踏み込まず、誤説明防止（§4.2）に適合。
- §1.5 DES 直接編集の禁止 ◎（△ 補足あり）
  - `git diff main...HEAD` に `docs/design/` の変更なし。製造は DES を直接編集していない。ただし DES-005 CHANGE 要否の**判定結果**が in-repo の完了報告として見当たらない（§8 参照）。

### §2 データ・API 契約の不変 ◎
- 変更ファイルは FE（InfoMark/ModifiersEditor/locales/e2e）のみ。`ComboResponse`/`CreateRequest` 等の DTO・API に差分なし。

### §3 フロントエンドの動作仕様 ◎
- info-mark は DialogTitle と横並び（`flex items-center gap-2` の div 内）。DialogTitle は Radix が context 経由で aria-labelledby を張るため div 内包でも a11y 影響なし。既存レイアウトを押し出さない付加。
- 選択モード・modifier 編集の従来挙動は不変。shadcn パターン踏襲。

### §4 テストの妥当性 ○
- ③改称（E2E `web/e2e/m15-02-info-mark.spec.ts`）: コンボ一覧＋マイコンボの 2 画面で「比較対象選択」表示・旧「選択モード」不在（count 0）・押下で件数バッジ＋選択解除出現・解除で復帰を検証。seed 非依存（ヘッダ UI のみ・保存なし）で self-contained。
- ⑤ modifier info-mark（Vitest）: `ModifiersEditor` を props 直接描画し、トリガ描画・クリックで content 表示・保存副作用なしを検証。脆いレシピ E2E を採らず（意図的逸脱・§5.1 決定に適合）。
  - △ 軽微: i18n 未初期化（`NO_I18NEXT_INSTANCE`）のため `t("help.modifier")` はキー文字列を返し、アサーションは `content.textContent).toContain("modifier")`（キー "help.modifier" が "modifier" を含むため通過）。**解決後の日本語文言そのものは検証していない**。文言・機構の描画自体は InfoMark 単体テスト（リテラル text を渡す）で担保されるため機能上は問題ないが、ModifiersEditor 側テストは配線確認に留まる旨を認識されたい（§10 低）。
- InfoMark 単体（Vitest 4 件）: 初期非表示・クリックで表示・aria-label 既定/上書き・form 内 submit 非発火。適切。
- 既存 E2E 非回帰: 本レビューでは `make e2e` を実行していない（制約）。新 spec は m15-01/combo-crud と同一の「ウィザード完了前提」慣行に従い、既存構成と整合。

### §5 設計意図との整合 ◎
- ③はラベル改称で根治（info-mark を付けない）、⑤は再利用可能機構で説明、機構は後続項目に載せられる汎用設計。モデル未確定概念に踏み込まず。既存操作・レイアウト・M15-01 test-id を壊していない。

### §6 コード品質・規約遵守 ○
- 曖昧語依存の判断なし。test-id・i18n キーは一貫（散在ハードコードなし）。ファイル配置は共通 `web/src/components/` で code-facts §1 の既存構成に整合。
- 軽微: `InfoMark` 既定 aria-label「説明を表示」および ModifiersEditor 側 `ariaLabel="modifier の説明"` が日本語リテラル直書き（i18n 非経由）。日本語のみスコープのため許容だが i18n 一貫性の観点では将来 i18n 化余地あり（§10 低）。

### §7 既存挙動の温存 ◎
- 既存コンボ作成/編集・選択モード・modifier 編集の挙動不変。`combo-editor-*` test-id に影響なし。

### §8 ドキュメント・進捗ログ △
- `docs/progress/` に M15-02 の完了報告/進捗エントリが見当たらない（`m15-01-review.md` のみ）。DoD §7.4/§7.5・チェックリスト §8 が求める「DES-005 CHANGE 要否の判定結果」「test-id 命名規約（`info-mark-<topic>`）・適用範囲（③⑤）」「Plan Mode 確定方式」「テストケース数」「既知の制約」の in-repo 記録が確認できない。開発者へ別経路（完了報告メッセージ）で提出済みであれば問題ないが、後続 M15 サブが参照する規約（code-facts 再生成では捕捉されない）であるため、進捗ログ等への明文化を推奨。

### §3.3 5項目の充足状況

1. 既存ヘルプ/shadcn プリミティブ・i18n キー占有 ── ◎ 既存 `Popover`（M7-01）流用・`help` キー未占有を確認。
2. 選択モード実在箇所・比較専用性 ── ◎ ComboListPage/MyComboPage の 2 箇所・compare 専用を実査確認、改称正確。
3. modifier 付与先 ── ◎ `ModifiersEditor` DialogTitle 隣に配置（ダイアログ本体を採用）。RecipeBuilder 側トリガへの追加は行っていないが、modifier 編集の主動線はダイアログであり妥当。
4. 適用範囲 ③⑤ のみ ── ◎ 逸脱なし。
5. DES-005 CHANGE 要否 ── △ 判定結果の in-repo 記録が未確認（§8）。改称は DES-005 の記述的文言と整合するため CHANGE 不要（自由改訂）と推定されるが、判定の明文化を推奨。

## 設計準拠性以外の指摘事項

- 命名/構成: `InfoMark` は PascalCase コンポーネント・`web/src/components/` 配置で規約適合。JSON タグ・DTO 変更なしのため camelCase 規約の対象外。
- ライブラリ選択: 新規依存追加なし（lucide-react・shadcn Popover は既存）。§6 依存ポリシー適合。
- セキュリティ/ストレージ: localStorage 等の使用なし。機密情報・永続化対象データの取り扱いなし。§10 適合。
- console 出力: 本変更に `console.log`/`fmt.Println` の新規混入なし（既存 ModifiersEditor の localNotes 警告は本サブ範囲外の既存挙動）。

## 推奨修正（優先度別）

- 高（M15完了前に修正必須）: なし。重大逸脱は検出されず、③⑤とも設計意図どおり・非破壊・テスト緑。
- 中（M16着手と並行可）:
  - 完了報告の in-repo 明文化（DoD §7.4/§7.5・チェックリスト §8）。少なくとも「DES-005 CHANGE 要否＝不要（自由改訂）の判定根拠」「test-id 規約 `info-mark-<topic>` と適用範囲③⑤」「テストケース数（Vitest 19・E2E 2 パラメタライズ）」を進捗ログ or 完了報告に残す。後続 M15 サブ（M15-03/M15-07）が info-mark を再利用する際の参照点となる。
- 低（将来対応）:
  - ModifiersEditor 側 ⑤ テストのアサーションが i18n キー文字列の部分一致に依存している点（i18n 未初期化前提）。将来 i18n を test setup で初期化する、またはトリガ配線の検証に限定する等でアサーション意図を明確化。機構本体は InfoMark 単体テストで担保済みのため優先度は低い。
  - `InfoMark` 既定 aria-label 等の日本語リテラルを将来的に i18n 化（現状は日本語のみスコープで許容）。

## 良かった点

- 既存 shadcn `Popover` を正しく流用し、自作再発明を回避（playbook §4.6）。ⓘ アイコンも既存 lucide-react を使用。
- 機構（`InfoMark`）と文言（i18n）を分離し、`text` に解決済み文字列を受ける設計。単体テストが i18n 非依存で堅牢、かつ後続項目への再利用が容易。
- i18n キー占有調査を実施（`help` 未占有を確認）し命名衝突を回避。ja↔en 双方向 parity テスト（`locales.test.ts`）を満たすため en も同時追加── 指示書は「英語ロケール除外」だが、除外すると既存 parity テストが落ちるため **en 追加は非回帰上の正しい判断**。
- test-id を `info-mark-<topic>` ＋ `-content` の一貫規約で設計し `combo-editor-*` と非衝突。
- ③改称 E2E が旧ラベル不在（count 0）まで検証し、改称漏れ・二重表示を機械的に排除。seed 非依存で self-contained。
- 選択モードの比較専用性を実装事実（count/compare/exit のみ）から裏取りでき、改称ラベルの正確性が担保されている。

## 制約事項

- 本レビューはコード上で判定可能な範囲のみ対象。実際の動作確認・パフォーマンス・実機テストは別途実施が必要。
- Vitest（InfoMark/ModifiersEditor/locales）はローカル再実行で全通過を確認したが、E2E（`make e2e`）は本レビューでは実行しておらず、既存スイート非回帰は製造担当の自己申告・慣行整合の範囲で判断している。

---

## 取り込み結果（自動トリアージ・2026-07-03）

> `/implement_plan_full` Phase C により製造担当（実装 Claude）が自動トリアージ。人間トリアージ承認を外す代償として採否と理由を本節に残し事後監査可能にする。**優先度「高」の指摘はゼロのためエスカレーションなし**。

| 指摘 | 優先度 | 採否 | 理由 |
|------|--------|------|------|
| 完了報告の in-repo 明文化（DoD §7.4/§7.5・チェックリスト §8。DES-005 CHANGE 要否・test-id 規約・適用範囲③⑤・テストケース数を `docs/progress/` に残す） | 中 | **採用** | 正当な DoD 要件かつ後続 M15 サブが参照する情報（code-facts 再生成では捕捉されない）。`docs/progress/progress-log.md` に「M15-02 完了報告」節を追記して対応。 |
| ⑤ ModifiersEditor テストが i18n 未初期化前提でキー文字列部分一致に依存 | 低 | **不採用** | 実害小。i18n 非初期化下でキー文字列を assert するのは本プロジェクトの既存単体テスト慣行（例 `DuplicateRealtimeWarning.test` も同様）で、機構本体は `InfoMark.test.tsx` が i18n 非依存に堅牢担保済み。整合を崩してまで変える利得が無いため将来対応。 |
| `InfoMark` 既定 aria-label 等の日本語リテラル直書き | 低 | **不採用** | 指示書 §4.2 が日本語のみスコープ（英語ロケール除外）。日本語 aria-label 直書きは既存コード（`Header.tsx` 等）の確立パターンで、本サブでの i18n 化は非スコープ。 |

### 反映コミット

- `docs(M15-02): progress-log に完了報告を追記`（本トリアージの「採用」分）。
