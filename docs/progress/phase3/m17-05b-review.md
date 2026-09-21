# M17-05b レビュー報告書

## 総評

対象コミット `486d2f7`（feat(M17-05b): 選択→エクスポート動線＋複数形式エクスポートダイアログ）をレビューした。A-1（選択→エクスポート動線）・A-2（複数形式チェックボックス＋クリップボード排他）・エクスポートダイアログの実装は、指示書 §4・チェックリスト §1〜§6 の要求をおおむね満たしている。既存の export 生成関数（`resolveExportCombos`/`exportComboImage`/`clipboard.ts`/`useExportCombo`）・既存の選択 UI（`useSelectMode`）を新規実装せず素直に再利用しており、BE・出力項目（28）・出力文書レイアウト・エクスポート画面（§5.13/`ComboExportPage.tsx`）・CSV 契約はいずれも無変更を確認した。Vitest 749 件全通過・`tsc --noEmit` エラーなし・i18n key parity テスト通過も確認済み。

一方で、**比較対象選択（M15-02）の選択上限チェックを、本サブのエクスポート選択上限（1000件）に流用したことで、比較機能側の「上限到達時のフィードバック」が実質的に壊れている**（後述・設計準拠性以外の指摘事項）。これは指示書のスコープ外機能への副作用だが、既存の可視挙動・可視メッセージが変わっており、「既存機構の流用＝非破壊」という本サブの前提から逸脱している。加えて、指示書 §7 DoD が要求する「完了報告への §3.3 確認結果の記載」は本レビュー時点で `docs/progress/progress-log.md` にも `docs/progress/` 配下にも見当たらず、ドキュメント面が未完了である。

## 設計準拠性レビュー結果

### §1 A-1: 選択→エクスポート動線 — ◎

- 一覧（`ComboListPage.tsx`）・マイコンボ（`MyComboPage.tsx`）の両方に動線あり。既存の `useSelectMode` フック（M15-02由来）をそのまま再利用しており、新しい選択機構は作られていない。
- 選択ゼロ時は `combosQuery.data.items`（キャラ/フィルタ条件に対する `useCombos` の全件。`ComboListFilter`/BE `GET /api/combos` にページングパラメータが無いことを確認済み＝ページング打ち切りではなく本当に「現フィルタ結果の全件」）を対象にしており、WYSIWYG が正しく成立している。
- 対象件数はボタンラベル（`export.buttonSelected`/`export.buttonAll`）とダイアログ説明文の両方に明示。
- テスト: E2E（`m17-05b-export-flow.spec.ts`）が「N件選択」と「選択ゼロ＝現フィルタ全件」の両方をカバー。ダイアログの件数表示は Vitest（`ExportDialog.test.tsx`）でも検証。

### §2 A-2: 複数形式・クリップボード排他 — ◎

- 形式はラジオからチェックボックス（複数同時選択可）に変更済み（`ExportDialog.tsx` L160-187）。
- クリップボードは単独選択時のみ活性（`hasNonClipboard`/`hasClipboard` の相互 disable 判定、L57-63・L162-163）。Vitest で両方向（他形式選択中はクリップボード非活性／クリップボード選択中は他形式非活性）をテスト済み。
- 複数形式は `run-export.ts` の `FORMAT_ORDER`（csv→pdf→png→clipboard固定順）で順次生成・ダウンロード。ZIP へは束ねていない（E2E で `.zip`〔CSV〕と `.pdf` が別ファイルとしてダウンロードされることを確認）。
- `resolveExportCombos`/`exportComboImage`/`clipboard.ts`/`useExportCombo` はいずれも M13-01/M13-02 由来の既存関数で、本コミットでは無変更（`git diff` で `export-data.ts`/`export-image/`/`clipboard.ts` に差分なしを確認）。新規の生成ロジックは追加されていない。

### §3 ダイアログ・出力項目 — ◎（一部確認不能）

- `export-items.ts` は本コミットで無変更（diff に含まれない）。`EXPORT_ITEMS` は既存どおり17項目（選択可能項目）＋固定2項目で、既存の `export-model.test.ts`（「全選択時の行数 = 28」テスト）が通過することを確認。メディア3項目（`link`/`videoPath`/`imagePath`）も含まれている。
- 出力文書のレイアウト・内容を生成する `export-image/`・`clipboard.ts` は無変更のため、CHANGE-052/068 の規定（superset・状況行畳み込み・「名称: フルレシピ」・メディアは文字列のみ）は不変。
- ダイアログの容量（28項目＋形式）は `max-w-lg` + `max-h-48 overflow-y-auto`（項目リスト）でスクロール確保する設計になっている。**スマホ幅での実機/ブラウザ確認はコードレビューの範囲外**のため未検証（指示書 §3.3-4・第2段の判断材料として実機確認を推奨、下記「推奨修正」参照）。

### §4 エクスポート画面（§5.13）の温存 — ◎

- `web/src/pages/ComboExportPage.tsx` は本コミットで無変更（`git diff` 差分なしを確認）。A-3 の2改善（プルダウン/インクリメンタル検索・選択画面遷移）は実装されていない。
- `App.tsx` のルート・`Header.tsx` のナビ（`/export/combo` → 「エクスポート」）も無変更。画面除去（第2段）は行われていない。

### §5 BE・契約の非改変 — ◎

- `git diff 966e9ed 486d2f7 -- internal/` は差分ゼロ。BE への新規 export API 追加なし。
- `range=selected&ids=...` は M13-01 由来で既存の `ExportRangeKind.RangeSelected`（`internal/service/comboio/types.go`）がすでにサポートしており、本サブは既存経路を呼んでいるだけ。CSV 契約（DES-002 §7.6）・スキーマ変更ともにゼロ。
- `MAX_EXPORT_SELECTION = 1000` は BE `exportRowLimit`（`csvcore.DefaultMaxRows = 1000`）と対称であることをコードで確認済み（コメントの主張と実値が一致）。

### §6 i18n 境界 — ◎

- `export.*`/`selectMode.countPlain` は ja/en 両方に追加済み。`web/src/locales/locales.test.ts`（双方向 key parity の機械テスト）を実行し通過を確認。
- エクスポート文書内のラベル（`export-items.ts` の `label`）は無変更＝固定 ja のまま。新規 i18n キーを文書側に足していない。

### §7 テスト・ドキュメント — △

- Vitest: 新規 `run-export.test.ts`（7件）・`ExportDialog.test.tsx`（8件）を実行し全通過。既存を含む全体でも `pnpm vitest run` で 107ファイル/749件 全通過を確認。`tsc --noEmit` もエラーなし。
- E2E: `m17-05b-export-flow.spec.ts` が一覧・マイコンボの双方でシナリオを用意（実行はしていない。§5.2 の要求件数は満たす作りだが、`make e2e` の実走はレビュー範囲外＝制約事項参照）。
- **ドキュメント面が未完了**: 指示書 §7 DoD は「完了報告に §3.3 の確認結果（とくに2〔BE要否〕・4〔ダイアログの容量〕）・DES 反映要点を記載」を要求しているが、`docs/progress/progress-log.md` に M17-05b のエントリがなく、`docs/progress/phase3/m17-05b-completion-report.md` 相当のファイルも存在しない（他サブ：M17-01/02/04 はいずれも completion-report を伴っている）。レビュー後の工程で作成されるのであれば問題ないが、本レビュー時点では確認できない。
- 禁則表現・簡体字・「起き攻け」誤字・「DR」略記: 変更ファイルに対し手動 grep を実施し該当なしを確認（`web/src/constants/export.ts` の「由来」の「来」を簡体字候補として誤検出したが、通常の常用漢字であり問題なし）。

## 設計準拠性以外の指摘事項

### 1. 比較対象選択（M15-02）の上限フィードバックが実質破壊されている（重要）

`ComboListPage.tsx`・`MyComboPage.tsx` はともに、既存の `useSelectMode(MAX_COMPARE_COMBOS)`（上限5）を `useSelectMode(MAX_EXPORT_SELECTION)`（上限1000）へ変更した（コミットメッセージが述べる「比較対象選択の上限とエクスポート選択の上限を分離」の実装）。

`useSelectMode` フックの `toggle()` は、渡された `maxItems` に達すると `false` を返す設計（`web/src/features/combo/hooks/useSelectMode.ts` L25-27）。この戻り値は `handleToggleSelect`（両ページとも無変更のまま残置）で使われている:

```ts
const handleToggleSelect = useCallback(
  (id: number) => {
    const ok = toggle(id);
    if (!ok) {
      setSelectModeMessage({
        kind: "info",
        text: t("compare.maxReached", { max: MAX_COMPARE_COMBOS }),
      });
    }
    ...
```

`toggle` の実体が `useSelectMode(MAX_EXPORT_SELECTION)`（1000）に差し替わったため、この `!ok` 分岐は**1000件到達時にしか発火しなくなった**。結果:

- 比較目的で6件目以降を選択しても、チェックボックスは選択でき続ける（`isSelectionAtMax`＝`isAtMax` も1000件基準になったため、`ComboTable.tsx` の `selectionDisabled` も5件では効かない）。旧来は5件到達でチェックボックスが disable され、その場で「比較対象は最大5件までです」という info メッセージが出ていたが、この即時フィードバックが消失した。
- 「比較」ボタン自体は `compareDisabled`（`selectedIds.length > MAX_COMPARE_COMBOS`）で正しく無効化され、`title` 属性でツールチップ表示されるため、**誤って6件以上で比較画面へ遷移することはない**（機能的な破綻はない）。
- ただし、万一1000件近くまで選択して `!ok` 分岐が発火した場合、表示される文言は `t("compare.maxReached", { max: MAX_COMPARE_COMBOS })`＝「比較対象は最大 **5** 件までです」という**事実と異なるメッセージ**になる（実際に引っかかったのは1000件上限であり5件ではない）。

指示書のスコープは export 側であり、比較（M15-02）の挙動を凍結する契約は指示書に明記されていないためチェックリスト §9「重大」には字義通りは該当しないが、**既存の共有フック（`useSelectMode`）のパラメータを流用先の都合で書き換えたことで、もう一方の既存消費者（比較機能）の可視フィードバックが劣化・不正確化した**という典型的な副作用であり、「既存機構の流用＝非破壊」という本サブの基本姿勢（チェックリスト §0.2）に照らすと看過すべきでない。

### 2. `ExportFormat` 型の重複定義（軽微）

`run-export.ts` が新たに `export type ExportFormat = "csv" | "pdf" | "png" | "clipboard";` を定義しているが、`ComboExportPage.tsx`（温存対象・無変更）にも同一のローカル型定義が既存で存在する（`web/src/pages/ComboExportPage.tsx` L27）。今回は `ComboExportPage.tsx` を触らない方針のため独立定義になったこと自体はやむを得ないが、型の単一情報源が2箇所に分裂した状態である。第2段（エクスポート画面除去）で自然に解消される見込みだが、要留意。

### 3. `ids` クエリパラメータの長さ（将来的な留意点）

`MAX_EXPORT_SELECTION = 1000` は BE の `exportRowLimit` と対称にした設計判断で妥当だが、`GET /api/export/csv?range=selected&ids=1,2,3,...`（最大1000件）は、実際に1000件近く選択された場合クエリ文字列がかなり長くなる（コンボIDが4桁なら約5,000文字程度）。本サブ由来の新規リスクではなく、既存の `ExportParams`/`useExportCombo` の GET+クエリパラメータ方式（M13-01由来）に内在する制約だが、チェックボックスでの大量選択が現実的に容易になったことで到達しやすくなった。ブラウザ・サーバ双方の実測上限内には収まる想定だが、将来的に長大な `ids` を扱うようになった場合は POST 化等の検討余地がある（現時点では低優先度）。

## 推奨修正（優先度別）

- 高（M17-05b完了前に修正必須）:
  - 比較対象選択（M15-02）の上限フィードバック不整合の是正。少なくとも、`handleToggleSelect` 内の `!ok` 判定用メッセージが `MAX_COMPARE_COMBOS` を参照しているのに実際の閾値が `MAX_EXPORT_SELECTION` になっているミスマッチを解消すること。対応案としては、比較用の上限チェックを `useSelectMode` の共有 `toggle` 戻り値に頼らず、`selectedIds.length > MAX_COMPARE_COMBOS` を選択直後にも判定して独立した info メッセージを出す（現状は「比較」ボタン押下時の disabled+tooltip のみで即時フィードバックがない）。

- 中（以後の作業と並行可）:
  - `docs/progress/progress-log.md`（または `docs/progress/phase3/m17-05b-completion-report.md`）へ、指示書 §7 DoD が要求する §3.3 確認結果（とくに2〔BE要否＝新API不要と確認〕・4〔ダイアログの容量＝28項目+形式がモーダルに収まる設計にした旨〕）と DES-005 §5.13 反映要点（画面自体は不変・新規契約なしのため CHANGE 起票は不要である旨、または要否の明記）を記録すること。
  - ダイアログのスマホ幅表示を実機/ブラウザ幅エミュレーションで確認し、「無理に詰めていないか」を明示的に報告すること（第2段＝画面除去判断の材料として重要）。
  - `ExportFormat` 型の重複定義の解消（`ComboExportPage.tsx` から `run-export.ts` の `ExportFormat` を import する等）。第2段で `ComboExportPage.tsx` が除去されれば自然消滅するため、それまでの暫定課題として記録に留めてよい。

- 低（将来対応）:
  - `ids` クエリパラメータの長さについて、将来的に大量選択が常態化するようであれば POST 化等の設計見直しを検討。

## 良かった点

- 既存の export 生成関数（`resolveExportCombos`/`exportComboImage`/`clipboard.ts`/`useExportCombo`）・既存の選択 UI（`useSelectMode`）・出力項目定義（`export-items.ts`）をいずれも作り直さず、新しい呼び出し元（`run-export.ts`/`ExportDialog.tsx`）として素直に組み込んだ点は指示書の「既存機構の流用」方針に忠実。
- `run-export.ts` がオーケストレーション（実行順序・結果集約・部分失敗時の継続）とUI（`ExportDialog.tsx`）を明確に分離しており、`run-export.test.ts` が固定順序・複数形式同時選択時の `resolveExportCombos` 呼び出し回数（1回のみ）・個別形式失敗時の独立性・0件時の挙動まで丁寧にテストされている。
- `MAX_EXPORT_SELECTION` の定義コメントが BE の `exportRowLimit`（`csvcore.DefaultMaxRows`）との対称性の根拠を明記しており、実値の突合も一致していた。
- i18n 境界（UI ラベル=ja/en、エクスポート文書内ラベル=固定ja）を正しく遵守し、`locales.test.ts` の機械的 parity テストも通過している。
- E2E が実ファイルダウンロード（ZIP+PDF の同時ダウンロード、ファイル名検証）まで踏み込んで検証しており、モック止まりでない実効性の高いテストになっている。

## 制約事項

- 本レビューはコード上で判定可能な範囲のみ対象。実際の動作確認（`make e2e` の実走、スマホ幅での実機/ブラウザ確認）・パフォーマンス・実機テストは別途実施が必要。
- Vitest（新規15件含む749件全件）・`tsc --noEmit` はレビュー中に実行し通過を確認したが、Go テスト・E2E（Playwright）は実行していない（BE無変更のため影響は低いと推定するが未検証）。
- Plan Mode（指示書 §3.3 の6項目）が開発者に提示され承認されたかどうかは、チャット履歴を参照できないため本レビューでは確認できない。「不明: Plan Mode での提示・承認の実施有無はコードからは判断できない」。
- `docs/progress/progress-log.md` に M17-05b の完了報告エントリが存在するか否かは本レビュー時点（コミット `486d2f7` 直後）の状態を確認したものであり、レビュー後に追記される可能性がある。

## 取り込み結果（自動トリアージ）

| # | 指摘 | 優先度 | 採否 | 理由 |
|---|------|--------|------|------|
| 1 | 比較対象選択（M15-02）の上限フィードバック不整合（`handleToggleSelect` が `MAX_COMPARE_COMBOS` 表示のまま実閾値 `MAX_EXPORT_SELECTION` を参照） | 高 | **採用** | 正当な指摘。`toggle()` の戻り値（真の上限=1000到達）とは別に、選択後の件数が `MAX_COMPARE_COMBOS`（5）を超えたかをその場で判定し正しいメッセージを出すよう `ComboListPage.tsx`/`MyComboPage.tsx` を修正。1000到達時の表示用に `export.maxReached` キーを新設（ja/en）。E2E に回帰防止ケース（6件選択時のメッセージ検証）を追加し `pnpm test`（749件）・`make e2e`（30件）全通過を確認。 |
| 2 | `docs/progress/` への完了報告未作成（指示書 §7 DoD 違反） | 中 | **採用** | `docs/progress/phase3/m17-05b-completion-report.md` を新規作成し、§3.3 確認結果（BE要否=不要と判明した根拠・ダイアログ容量=モバイル390px実測で確認）・DES-005 §5.13 反映要点を記載。 |
| 3 | ダイアログのスマホ幅表示が未検証 | 中 | **採用** | Playwright で 390×844px の実機相当ビューポートを一時スペックで検証（スクリーンショット目視確認済み・横スクロールなし・全項目操作可能）。結果を完了報告 §3.3-4・§7 に記録。検証用の一時ファイルはコミットに含めず削除済み（恒久 E2E 化はスコープ外と判断）。 |
| 4 | `ExportFormat` 型の重複定義（`run-export.ts` と `ComboExportPage.tsx`） | 中 | **不採用** | `ComboExportPage.tsx`（§5.13 温存対象）を一切変更しない方針を優先。レビュー報告書自身も「第2段（画面除去）で自然消滅するため暫定課題として記録に留めてよい」としており、次段まで持ち越すことが妥当と判断。完了報告 §4 に記録。 |
| 5 | `ids` クエリパラメータの長大化（将来的な留意点） | 低 | **不採用** | レビュー報告書自身が低優先度・将来検討事項として明記。既存 M13-01 由来の方式に内在する制約であり本サブ由来の新規リスクではないため、今回は対応しない。完了報告 §4 に記録。 |

「高」指摘（#1）は採用のため、開発者エスカレーションは発生していない。「中」「低」の不採用（#4・#5）は理由を記録した上で自動的に進めている。
