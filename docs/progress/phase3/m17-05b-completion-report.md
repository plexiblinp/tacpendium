# M17-05b 完了報告(③ export 動線・形式: A-1 選択エクスポート＋A-2 複数形式＋エクスポートダイアログ＝画面廃止 第1段)

| 項目 | 内容 |
|------|------|
| 対象指示書 | `docs/instructions/phase3/M17-05b-export-flow.md` v1.0.0 |
| レビューチェックリスト | `docs/instructions/phase3/reviews/M17-05b-review-checklist.md` v1.0.1 |
| 実施日 | 2026-07-18 |
| 実行フロー | `/implement_plan_full`(Plan 承認 → 実装 → fresh subagent レビュー → 自動トリアージ) |
| レビュー報告書 | `docs/progress/phase3/m17-05b-review.md`(取り込み結果は同ファイル末尾に追記) |

---

## 1. Plan Mode 確定方式(指示書 §3.3 の 6 項目・実査結果)

1. **選択 UI の流用点**: 一覧(`ComboListPage.tsx`)・マイコンボ(`MyComboPage.tsx`)は共通の `useSelectMode` フック(M15-02 由来)で選択状態(`selectedIds: number[]`)を持つ。両ページとも同一実装(重複実装なし)。エクスポート動線はこの `selectedIds` をそのまま読む(新しい選択機構を作らない)。選択ゼロ時の「現フィルタ結果の全件」は、一覧側が既に取得済みの `combosQuery.data.items`(`useCombos(apiFilter)` の結果)の ID をそのまま使う。`GET /api/combos` はページネーションを持たない(`internal/service/combo/service.go` `List`)ため、`items` が「画面に見えている全件」と一致することを実コードで確認した。
2. **BE 要否**: **BE 変更は不要**と判明した。`GET /api/export/csv` は M13-01 由来の `range=selected&ids=...`(`ExportRangeKind.RangeSelected`)を既に実装済みで、`internal/service/comboio/export.go` の `resolveTargetCombos` が `SelectedIDs` を素直に処理する。PDF/PNG/クリップボードのクライアント生成(`resolveExportCombos`)も同じ `ExportParams.ids` を経由する。よって「選択された ID 群を BE に渡す」ための新規契約は不要で、既存の `range: "selected", ids: [...]` を呼ぶだけで足りた。DES-002 §4.2 の CHANGE は発生しない。
3. **形式の複数同時**: `triggerDownload`(`features/combo-io/api.ts`)は単純な `<a>` 生成+`click()`で、多重発火のガードは無かった。新設の `run-export.ts`(`runExport()`)が形式を固定順(csv→pdf→png→clipboard)で**順次**呼び、ダウンロードを伴う形式間に約 300ms の待機を挟むことで多重発火を緩和した(チェックリスト §10 で「軽微・持ち越し許容」と整理済みの論点のため簡易対応に留めている)。クリップボードの排他は `ExportDialog.tsx` のチェックボックス `disabled` 属性で双方向に実装(クリップボード選択中は他形式非活性/他形式選択中はクリップボード非活性)。
4. **ダイアログの容量(28項目+形式+PDF/PNGオプションがモーダルに収まるか)**: `EXPORT_ITEMS`(`export-items.ts`)の選択可能項目は実際には**17 チェックボックス**であり(「28」は §5.13 の出力文書の**行数**=`oki` 1 トグルが 12 行に展開された後の数であり、チェックボックス数ではない。指示書・チェックリストの表記はこの区別が曖昧だが、対象の `EXPORT_ITEMS` 自体は M17-01 でメディア 3 項目を含め過不足なく更新済みであることをコードで確認した)。ダイアログは `max-w-lg` + 出力項目リストに `max-h-48 overflow-y-auto` を設定しスクロールで収める設計とした。**スマホ幅(390×844px 実測)で実機確認**したところ、横スクロールなし・全チェックボックスが操作可能な状態で収まることを確認した(スクリーンショットで目視確認済み。第2段=画面除去判断の材料)。詰め込み過ぎの兆候はなし。
5. **i18n 境界**: ダイアログ・一覧の新規 UI ラベル(`export.*`)・トーストは `ja.json`/`en.json` 両方に追加(`locales.test.ts` の parity テストで機械担保)。エクスポート文書内のラベル(`export-items.ts` の `label`)は無変更=固定 ja のまま。
6. **既存 export 画面の非改変**: `web/src/pages/ComboExportPage.tsx` は本サブで**一切変更していない**(git diff 差分ゼロ)。§5.13 の画面自体・ナビ・ルートは不変。

## 2. 成果物

| ファイル | 内容 |
|---|---|
| `web/src/constants/export.ts`(新規) | `MAX_EXPORT_SELECTION = 1000`(BE `exportRowLimit`=`csvcore.DefaultMaxRows` と対称) |
| `web/src/features/combo-io/run-export.ts`(新規)+テスト | 複数形式の順次生成・ダウンロード間隔調整・結果集約(`runExport()`)。既存の生成関数(`resolveExportCombos`/`exportComboImage`/`clipboard.ts`/`useExportCombo`)をそのまま呼び出すだけで新規生成ロジックは追加していない |
| `web/src/features/combo-io/components/ExportDialog.tsx`(新規)+テスト | エクスポートダイアログ本体(形式チェックボックス+クリップボード排他・出力項目チェックボックス・実行) |
| `web/src/pages/ComboListPage.tsx` / `web/src/features/mycombo/components/MyComboPage.tsx` | 常時表示の「エクスポート」ボタン追加・比較対象選択の上限をエクスポート用(1000)と比較用(5)に分離・比較上限超過時の即時フィードバック修正(後述 §3) |
| `web/src/locales/ja.json` / `en.json` | `export.*`(ボタン・ダイアログ・トースト)・`selectMode.countPlain` を追加 |
| `web/e2e/m17-05b-export-flow.spec.ts`(新規) | 一覧: 2件選択→CSV+PDF同時ダウンロード / 一覧: 6件選択時の比較上限フィードバック / マイコンボ: 選択ゼロ→現フィルタ全件エクスポート |

### 変更していないもの(非波及の担保)

`web/src/pages/ComboExportPage.tsx`(§5.13 画面本体)、`web/src/features/combo-io/export-items.ts`(出力項目定義)、`web/src/features/combo-io/export-data.ts`・`export-image/`・`clipboard.ts`(生成関数本体)、`internal/`(BE 全体・差分ゼロ)、CSV 契約(DES-002 §7.6)、マイグレーションなし。

## 3. レビュー指摘の取り込み(高優先度・修正済み)

fresh subagent レビュー(`docs/progress/phase3/m17-05b-review.md`)で、比較対象選択(M15-02)とエクスポート選択の上限を分離した際の副作用が指摘された: 共有フック `useSelectMode` の `toggle()` 戻り値に依存していた「上限到達時の即時メッセージ」が `MAX_EXPORT_SELECTION`(1000)基準になり、6件目以降を選択しても比較向けの「比較対象は最大5件までです」という即時フィードバックが出なくなっていた(比較ボタン自体は正しく無効化されるため機能的な破綻はないが、フィードバックが欠落・不正確化していた)。

**是正内容**: `handleToggleSelect`(`ComboListPage.tsx`/`MyComboPage.tsx`)で、`toggle()` の戻り値(真のエクスポート上限=1000到達)とは別に、選択後の件数が `MAX_COMPARE_COMBOS`(5)を超えたかをその場で判定し、超えていれば `compare.maxReached` メッセージを出すよう変更した。E2E に新規ケース(6件選択時に正しいメッセージが出ること・エクスポートボタンは件数どおり有効なままであること)を追加して回帰を防止した。

## 4. 取り込まなかった指摘(理由記録)

- **`ExportFormat` 型の重複定義**(`run-export.ts` と `ComboExportPage.tsx` に同一のローカル型)= 中優先度。`ComboExportPage.tsx` を一切変更しない方針(§5.13 温存の徹底)を優先し、今回は是正しない。レビュー報告書も「第2段(画面除去)で自然消滅するため暫定課題として記録に留めてよい」としており、次段(画面除去)まで持ち越す。
- **`ids` クエリパラメータの長さ**(将来 1000 件近い選択で URL が長大化しうる)= 低優先度。レビュー報告書も低優先度として明記。既存の GET+クエリパラメータ方式(M13-01 由来)に内在する制約であり、本サブ由来の新規リスクではないため今回は対応しない。

いずれも優先度は「中」「低」であり、指示書運用ルール(「高」指摘の不採用のみ開発者エスカレーション)に照らし、開発者へのエスカレーションは不要と判断した。

## 5. テスト結果(ケース数)

- **Vitest**: `pnpm test` **107 files / 749 tests 全通過**。新規: `run-export.test.ts` 7本(固定順序・resolveExportCombos 呼び出し回数・0件時挙動・部分失敗の独立性等)、`ExportDialog.test.tsx` 8本(件数表示・形式複数選択・クリップボード双方向排他・既定項目ON等)。`tsc --noEmit` エラーなし。
- **E2E**: `make e2e` **30 tests 全通過**(新規3本を含む)。稀flaky(並列ワーカー競合による2件のリトライ成功)は本プロジェクトの既知許容範囲(retryで吸収)。
- **品質 grep**: 「起き攻け」誤字・「DR」略記・簡体字は変更ファイルに該当なし。i18n 両ロケール parity は `locales.test.ts` で機械担保。

## 6. DES 反映要点

**DES-005 §5.13 は内容として不変**(出力項目・出力文書レイアウト・対象範囲の選択肢はすべて既存のまま)。本サブは「§5.4 コンボ一覧・§5.5 マイコンボから、既存の比較対象選択 UI を経由してエクスポートダイアログを開ける」という**新しい動線**を追加したものであり、§5.13 自体の記述(表示項目・出力形式・出力文書レイアウト)に変更はない。CHANGE 対象となるのは §5.4/§5.5 の「表示項目」節への動線追記(6.「比較対象選択」トグルの直後に「常時表示のエクスポートボタン」を追記)である可能性がある。**製造は DES を直接編集していない**ため、設計担当の判断で CHANGE 起票の要否を確認いただきたい。

## 7. 開発者への申し送り

- **第2段(エクスポート画面 §5.13 の除去)の判断材料**: 本サブの実物で、ダイアログはモバイル幅(390px)でも横スクロールなく操作可能であることを確認した。出力項目リストは内部スクロール(`max-h-48`)で17項目を収めている。除去の可否判断に活用いただきたい。
- 比較対象選択とエクスポート選択の上限分離(§3参照)は M15-02 由来の共有コンポーネント(`useSelectMode`)への軽微な呼び出し変更を伴う。次回このフックに触れる際は、比較専用ロジック(`MAX_COMPARE_COMBOS`)とエクスポート専用ロジック(`MAX_EXPORT_SELECTION`)が同一 state を共有している設計であることに留意されたい。
