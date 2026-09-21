# M17-05c-fix 完了報告書 — PDF/PNG 実出力レビュー是正（CHANGE-073）

| 項目 | 内容 |
|------|------|
| 対象指示書 | `docs/instructions/phase3/M17-05c-fix-output-spec.md` v1.0.0 |
| 親サブ | M17-05c（base・`m17-05c-completion-report.md`） |
| 設計正典 | CHANGE-073（DES-005 §5.13/§5.13a v2.44.0 反映済み） |
| 実装日 | 2026-07-18 |
| スキーマ変更 | なし |

---

## 1. §3.3 着手前確認 7 項目（結果）

1. **A4 寸法の実定義**: 単独＝A4 縦（595.28×841.89pt ＝ 793.7×1122.5px）／比較＝**幅 A4 横長辺(841.89pt)×高さ A4 縦相当(841.89pt)**（`paginate.A4_PORTRAIT_PT`/`COMPARISON_PAGE_PT`）。現行「内容幅ページ」を差し替え。DOM ラスタ多重キャプチャ方式は維持（pdf-lib ネイティブ描画にしない）。
2. **縮小フィット位置**: `pngsToPdf`（capture 後の pt 換算で用紙にアスペクト維持配置）。判定は `render-and-capture.renderPageRaster`（画像 pt / 用紙 pt の scale）。**scale ≥ 70%＝用紙固定＋縮小／< 70%＝注記付きで再描画し原寸(paper 未指定)出力**（切らない）。注記文言は仮（`ComboExportDocument.OVERFLOW_NOTE_TEXT`・確定は開発者）。
3. **メディア視覚除外**: `run-export.ts` が視覚経路（`exportComboImage`・`buildClipboardHtml/Text`）へ `toVisualSelected()`（video/image 除外）を渡す。`exportCsv`（BE・selected 非依存）は不変＝**CSV 非波及**（単体テストで検証）。
4. **セットプレイ名称のみ**: `export-model.setupsValue` が名称のみ（複数 `" / "`・名称未設定はレシピ流用）。`buildComboFields` 経由で PDF/PNG/クリップボードに波及・CSV 非波及。
5. **ExportDialog 出し分け**: `formats.has("csv") ? EXPORT_ITEMS(17) : VISUAL_EXPORT_ITEMS(15)`（案B）。CSV 含む時 17／視覚のみ 15。
6. **base 非回帰**: `paginate` の列分割（4 列/ページ・5 件以上で列分割）・見出し/thead 再掲・ページ番号 N/M・範囲ラベル・PNG(1 枚・22 件警告) を維持。行分割のみ撤去。
7. **再実測**（下記 §2）。

## 2. 是正後の再実測（Chromium・2026-07-18・視覚 26 項目）

| ケース | 総高 | A4 縦相当(1122.5px) 判定 |
|--------|------|--------------------------|
| 単独 26 項目 | **1053px** | 原寸 1 ページ（base の「単独 28 項目は常に 2 ページ」問題が解消）|
| 比較 4 列・通常レシピ | 1049px | 原寸 |
| 比較 4 列・レシピ 4 行 | 1070px | 原寸 |
| 比較 4 列・レシピ 6 行級 | 1112px | 原寸 |
| 比較 4 列・レシピ 8 行級（激長） | 1154px | 縮小 97.3%（下限 70% 以上）|

**縮小注記（< 70%）** は複数項目が同時に極端に長い（総高 > 約 1604px）レアエッジのみ。単体テスト `render-and-capture.test`（capture 高 10000px→注記付き再描画→原寸）で発火経路を担保。

## 3. base の生き残る機構が非回帰（証跡）

- E2E: 単独 PDF=1 ページ／**比較 5 件 PDF=4 列/ページで 2 ページに列分割**（`m17-05c-fix-output.spec.ts`）。既存 `m17-05c-pdf-pagination`（列分割・PNG 22 件 hint）・`m17-05b`（動線）非回帰 pass。
- 単体: `paginate.test`（列分割 4/5/9 件）、`ComboExportDocument.test`（項目名列+thead 再掲・範囲ラベル・ページ番号 N/M）、`render-and-capture.test`（PNG 1 枚・列分割 3 ページ・用紙固定）。

## 4. CSV 非波及

- `run-export.test`「視覚出力に video/image を渡さず link は残す・CSV は exportParams のみで呼ぶ」pass。CSV は BE 生成・selected 非依存（3 列・往復契約不変）。既存 `combo-csv-io`/`m17-01-media-fields` の往復 E2E は非回帰。

## 5. 変更点サマリ

| ファイル | 変更 |
|---|---|
| `export-items.ts` | `MEDIA_PATH_KEYS`/`VISUAL_EXPORT_ITEMS`/`toVisualSelected` 追加 |
| `run-export.ts` | 視覚経路に `visualSelected`（video/image 除外）・CSV は不変 |
| `components/ExportDialog.tsx` | 出力項目を形式別 15/17 出し分け |
| `export-model.ts` | `setupsValue` を名称のみ `" / "` 連結 |
| `export-layout/ComboExportDocument.tsx` | 総題削除・A4 横幅固定/table-fixed・`page` を列範囲中心・`overflowNote` 注記 |
| `export-image/paginate.ts` | 列分割のみに簡素化（行分割撤去）・A4 pt 定数・下限 70% |
| `export-image/pdf.ts` | `pngsToPdf` に用紙固定＋縮小フィット（paper 未指定=原寸） |
| `export-image/render-and-capture.tsx` | 列分割→各ページ描画→scale 判定→fit/actual |
| `export-image/measure.ts` | 行分割撤去で不要化＝**削除** |

## 6. DES との drift（要設計判断）

- **比較ページの高さ基準**を **A4 縦相当（1122.5px / 841.89pt）** とした（CHANGE-073 §2.5「A4 縦相当 1122px に原寸で収まる」に忠実）。一方 §2.1/§1.2-1 の字面は「比較＝A4 横」で、厳密 A4 横（高 210mm=595pt）だと 26 項目が常時 76% 縮小になり §2.5 の「原寸」と両立しない。
- 実装は §2.5（原寸前提）を採用＝**用紙は「幅 A4 横長辺 × 高 A4 縦相当長辺」の正方形(297×297mm 相当)**。印刷時はプリンタが A4 に縮小。
- **drift 判定**: §2.5 とは一致、§2.1 の「A4 横」の字面とは高さが異なる。**設計へ報告**し、DES 明確化（§5.13 に「比較の用紙高さは A4 縦相当」を補足）を CHANGE-074 で行うか、既存 §2.5 記述で足りるかは**開発者/設計担当の判断**。製造は DES を直接編集していない。

## 7. 持ち越し（スコープ外・followup）

- 比較列数の可変 UI（3 列/A3 切替）＝`PDF_COLUMNS_PER_PAGE` 名前付き定数のみ（値変更は 1 行）。
- 縮小下限下回り時の列自動削減（今回やらない・注記が正）。
- 多ページ PDF の直列キャプチャ並列化・`buildComboFields` メモ化・fonts.ready（§151）＝低。

## 8. 追加是正（実出力レビュー第 2 波・2026-07-18）

- **項目名（ラベル）が枠から飛び出す不具合**を是正。原因＝`ComboExportDocument.LABEL_CELL` の `white-space: nowrap` で、比較 A4 固定の項目名列(150px)・単独(32%)の**固定幅で長ラベルが折り返さずはみ出す**（「コンボ開始時のドライブゲージ残量」「同 SA ゲージ残量」、oki の「投げ重ね(その場受け身・ドライブラッシュ)」等のドライブラッシュ版）。
- 是正＝`nowrap` 除去(→ default `normal`)＋`overflow-wrap: anywhere`。実ユーザー環境(日本語フォントあり)では CJK が文字境界で折り返し、固定幅列に収まる。増える行高は縮小フィットが吸収。
- **検証の書き分け**:
  - **折り返し機構は Playwright 実測で確認済み**（英数字 40 連続を 150px 列で `nowrap`=29px → `overflow-wrap:anywhere`=55px に折り返し）。実装は正しく機能する。
  - **飛び出しの原因**も nowrap 版スクリーンショットで再現・確定。
  - **日本語ラベルの折り返しのみ実装環境では目視不可**（日本語フォントが無く tofu=欠損グリフが改行不可のため、この環境でのみ日本語が折り返さない。実ユーザー環境では CJK は改行機会を持ち折り返す）。→ **実ユーザー環境での日本語ラベルの折り返し目視は開発者確認事項**。
  - 全単体・E2E(単独1頁/比較2頁/Dialog15-17)非回帰は確認済み。
