# M17-05c-fix レビュー報告書

| 項目 | 内容 |
|------|------|
| 対象指示書 | `docs/instructions/phase3/M17-05c-fix-output-spec.md` v1.0.0 |
| 対象チェックリスト | `docs/instructions/phase3/reviews/M17-05c-fix-review-checklist.md` v1.0.0 |
| 対象差分 | `5431af6`（M17-05c base 完了時点）→ `HEAD`（`6f61d90`）。コミット `be957b5` `4f729d6` `64666bb` `6f61d90` |
| レビュー方式 | クリーンルーム・read-only（Read/git 読取のみ、コード変更なし） |
| レビュー日 | 2026-07-18 |

---

## 総評

CHANGE-073 で確定した「用紙寸法固定＋縮小フィット（下限70%）」「メディア視覚除外」「セットプレイ名称のみ」「総題削除」「ExportDialog 15/17出し分け」は指示書・チェックリストの要求どおりに実装されており、CSV/BE/スキーマ/M17-05bの動線には手が入っていない。行分割は完全に撤去され列分割のみが残り、縮小フィット判定（`renderPageRaster`／`pngsToPdf`）の再帰は数式・ロジック追跡上1回で確実に止まる（無限ループなし、境界`>=0.7`はshrink許容側で"下回る"の字面と整合）。base の列分割・見出し再掲・ページ番号・PNG 22件警告は非破壊で維持されており、`PDF_COLUMNS_PER_PAGE` も名前付き定数のまま。第2波の「ラベル飛び出し」是正（`white-space:nowrap`除去→`overflow-wrap:anywhere`）も技術的に妥当な選択（`word-break:break-all`より温和で、Unicode行分割はグリフ有無ではなくコードポイント特性に依存するため実装環境の日本語フォント欠如は視覚的な美観確認を妨げるだけで、layout上のoverflow防止効果自体はPlaywright実測で検証可能だった）。比較ページ高さのDES drift（A4横の字面 vs A4縦相当の実装）は製造が独自解決せず完了報告・引き継ぎの両方で設計へ明確に報告しており、CLAUDE.md §8の運用に沿っている。重大な逸脱は検出されなかった。

---

## 設計準拠性レビュー結果（項目別 ◎/○/△/×）

### §1 用紙寸法固定と縮小フィット（最重要） — ◎

- 単独＝A4縦（`A4_PORTRAIT_PT` 210×297mm）／比較＝「幅A4横長辺×高A4縦相当長辺」（`COMPARISON_PAGE_PT` 297×297mm）に固定。内容幅ページ（旧`Math.max(720, 160+n*360)`）は`isPaged`分岐でPDF経路からは外れ、PNG経路にのみ残置（意図通り＝PNG非回帰）。
- 行分割は`paginate.ts`から完全撤去（`packRows`/`RowMetric`/`PDF_PAGE_CONTENT_HEIGHT_CSS`等すべて削除済み、`measure.ts`も削除）。列分割のみの`planPages`に一本化されており、行分割の残骸との二重管理は検出されなかった（`grep`でdangling参照ゼロを確認）。
- 縮小フィット下限70%：`render-and-capture.ts`の`renderPageRaster`で`scale = Math.min(paper.w/imgW, paper.h/imgH, 1)`を計算し、`scale >= PDF_SHRINK_MIN_RATIO(0.7)`なら用紙固定＋縮小フィット、下回れば`withNote`済みなら原寸（`paper`未指定）で返す。境界`>=`により「ちょうど70%」はshrink側（縮小可）に倒れており、指示書の「70%を**下回る**とき」という字面と整合。
- 再帰は「1回だけ」で確実に止まる構造（`withNote=false`で下限未満のときのみ`return renderPageRaster(..., true)`を1回呼び、2回目の呼び出しはどちらの分岐を通っても即returnし3回目は発生しない）。ロジック上、無限ループの余地はない。
- 単体テスト`render-and-capture.test.tsx`に「縮小率<70%: 注記付きで再描画」のケースがあり`captureMock`呼び出し回数=2で再帰1回止まりを検証している。**ただし「ちょうど70%」の境界値を明示的に検証する単体テストは見当たらなかった**（`grep "0.7\|70%\|SHRINK_MIN"`で該当テスト1件のみ、これは`<70%`ケースのみ）。ロジック自体は追跡可能で妥当だが、指示書冒頭の重点確認事項（境界値）に対応する専用テストがない点は軽微なテストカバレッジの穴。
- §3.3-7の再実測は完了報告§2に記載（単独26項目1053px・比較4列各ケース1049〜1154px・縮小97.3%発火ケースあり）。ただしこれらの具体的px値そのものを固定して回帰検知する自動テストは存在しない（jsdomがレイアウト計算しないための既知の制約・base M17-05cから継続する設計判断であり新規の問題ではない）。将来のCSS変更（padding/font-size等）でこれらの実測値が崩れても、CI では検知できずに再度手動実測が必要になる点は認識しておくべき。

### §2 出力内容の変更は「CHANGE-073の列挙分だけ」（最重要） — ◎

- メディア：`export-items.ts`の`MEDIA_PATH_KEYS=["videoPath","imagePath"]`・`toVisualSelected()`で除外。`run-export.ts`が`visualSelected`をPDF/PNG/クリップボードの3経路すべてに一貫して渡し、`exportCsv(exportParams)`はselected非依存のまま（差分ゼロ）。`run-export.test.ts`に新規2件（画像経路・クリップボード経路それぞれでvideo/imagePath除外・link維持・CSVはexportParamsのみで呼ばれることを検証）があり、CSV非波及の主張は単体テストで裏付けられている。
- セットプレイ：`export-model.ts`の`setupsValue`が`s.name ? name : s.defaultRecipe`で名称のみ・複数`" / "`結合に変更、名称未設定時のレシピ流用フォールバックは維持。`export-model.test.ts`に新規テスト（名称あり/なし混在で`"起き攻めA / 2MK 持続"`を検証）あり。CSV側はBE生成でこの関数を経由しないため非波及。
- 総題削除：`ComboExportDocument.tsx`のComparisonLayoutから`<div>コンボ比較</div>`相当のブロックが削除され、`grep`でも当該箇所からは検出されない（アプリ内の別画面`ComparePage`の見出し「コンボ比較」は無関係で意図通り温存）。
- 上記以外の項目定義（`buildComboFields`本体・`EXPORT_ITEMS`のラベル/順序/28項目集合）は無変更。`ComboExportDocument.test.tsx`の「全項目選択の単独出力は28行」テストが継続してpassしており、CHANGE-052/068の定義は不変であることが確認できる。

### §3 baseの生き残る機構が非回帰（最重要） — ◎

- 列分割（4列/ページ・5件以上）はpaginate.test.tsで新設テスト（4列以下=1ページ／5件=2ページ／9件=3ページ／`PDF_COLUMNS_PER_PAGE`定数確認）でカバー。見出し列/thead再掲・ページ番号N/M・範囲ラベルは`ComboExportDocument.tsx`のComparisonLayoutで`isPaged`時に維持（`PageFooter`コンポーネント・`rangeLabel`）。
- PNG 1枚・22件警告・ハード例外：`export-data.ts`の`EXPORT_IMAGE_WARN_COUNT=22`・`run-export.ts`の`needsImageWarn`ロジック・`capture.ts`はいずれも本fixのdiffに含まれておらず（`git diff`で無変更を確認）、非回帰が構造的に担保されている。
- `PDF_COLUMNS_PER_PAGE`は`paginate.ts`にexportされた名前付き定数のまま(=4)、リテラル散在なし。
- 既存E2E `m17-05c-pdf-pagination.spec.ts`はassertionの粒度が緩い（`toBeGreaterThanOrEqual(2)`）ため通過に問題はないが、**コメントに「28項目の行分割」という旧base挙動の記述が残っており、行分割撤去後の実態（列分割のみで2ページ）と食い違っている**（軽微・後述）。

### §4 ExportDialog（§5.13a）の出し分け — ◎

- `visibleItems = formats.has("csv") ? EXPORT_ITEMS : VISUAL_EXPORT_ITEMS`（15/17）で意図通り。`selectedItems`の内部stateは常に17キー基準で保持され、表示上のみ絞り込む設計（handoverの記載と一致）。CSV+PDF同時選択時は17を表示しつつ、実出力ではPDF側だけ`toVisualSelected`で除外されCSVは全列という「同一チェックボックス状態が形式ごとに異なる扱いを受ける」設計はCHANGE-073 §7-2で開発者確認済み・確定事項どおり。
- 単体テスト（`ExportDialog.test.tsx`新規2件）・E2E（`m17-05c-fix-output.spec.ts`の1件目）の双方で15/17切替を検証。
- M17-05bの動線（排他・選択上限・WYSIWYG）は`ExportDialog.tsx`の該当ロジック（`hasClipboard`/`hasNonClipboard`/`disabled`等）が無変更で維持。

### §5 非改変 — ◎

- CSV契約・BE export・スキーマ：Goファイル・`go.mod`・マイグレーション・BEハンドラのdiffはゼロ（`git diff`で確認）。
- 比較列数可変UI・縮小下限下回り時の列自動削減：いずれも未実装（コード上に該当ロジックなし）。スコープ外の温存が正しく守られている。
- DOMラスタ多重キャプチャ方式：`render-and-capture.tsx`は引き続き`capture()`（html-to-image）→`pngsToPdf`（pdf-lib埋め込み）の構成で、pdf-libネイティブテキスト描画への置換は行われていない。

### §6 テスト・ドキュメント — ○

- §4のケース(a)〜(g)は概ね揃っている。(g)の「縮小<70%で注記して原寸出力」は単体テストで直接カバー。(a)(b)はE2Eではページ数のみ検証（描画内容はラスタのためE2Eで見えない旨がspecコメントに明記されており、方針として妥当）。
- 完了報告書には§3.3の7項目・再実測値・base非回帰証跡・CSV非波及・DES drift報告のすべてが揃っている（`m17-05c-fix-completion-report.md` §1〜§8）。製造がDESを直接編集していないことも明記されている。
- 品質grep（禁則・簡体字・「起き攻け」・「DR」略記）は本レビューの範囲では別途確認していない（下記「制約事項」参照）。ただし目視で確認した範囲（今回touchしたファイル）にはそれらの語は見当たらなかった。

---

## 設計準拠性以外の指摘（規約・命名・性能・セキュリティ等）

1. **CLAUDE.md §4 共通「TODOコメント形式」との軽微な不一致**（軽微）: `ComboExportDocument.tsx` の `OVERFLOW_NOTE_TEXT` 直前コメント「仮文言＝確定は開発者」は、指示書§6-1で明示された未確定事項（開発者確認事項）であり、内容自体は正しく申し送りされているが、CLAUDE.mdが定める `// TODO(<対応予定>): <内容>` 形式のタグが付与されていない。放置厳禁ルールの機械的トレース対象から外れる（grep `TODO(` では検出できない）ため、次工程で見落とされるリスクがわずかにある。
2. **CSSプロパティの技術的妥当性（良好、ただし要確認事項あり）**: `LABEL_CELL`の是正（`white-space:nowrap`除去＋`overflow-wrap:anywhere`）は技術的に妥当。`overflow-wrap:anywhere`は`word-break:break-all`より温和（不要な箇所まで強制的に破壊的分割しない）で、CSS Text Module的にもoverflow防止用途としてはこちらが推奨される。**完了報告§8・引き継ぎ§3-1の「日本語フォントが無いため目視検証不可」という申し送りは、美観（グリフ形状）確認については正しいが、layout上のoverflow発生有無自体はUnicode行分割特性（コードポイントベース）に依存しグリフ有無に依存しないため、Playwright実測（`getBoundingClientRect`等でセル幅超過の有無を確認）で検証可能だった**。この区別が完了報告に明記されていない点は、次工程が「フォントが無いので全く検証しようがない」と誤解する余地を残す。
3. **LABEL_CELLとVALUE_CELLで折り返し手法が不統一**（低）: `LABEL_CELL`は`overflowWrap:"anywhere"`のみ、`VALUE_CELL`は`whiteSpace:"pre-wrap"`+`wordBreak:"break-word"`と、similar な「長いテキストの折り返し」要件に対し異なる2手法が併存している。機能的には両方とも動作するため実害はないが、統一すると保守性が上がる（followup候補）。
4. **既存E2E `m17-05c-pdf-pagination.spec.ts` のコメント陳腐化**（軽微）: 46〜71行目のコメント「比較表5列→4列/ページの列分割 + 28項目の行分割で複数ページになる」は行分割撤去後の実態と矛盾する（実際は列分割のみで2ページ）。assertionが`toBeGreaterThanOrEqual(2)`と緩いため機能的には非回帰でpassし続けるが、コメントの更新漏れはドキュメントとして正確性を欠く。
5. **`PT_PER_CSS_PX`定数の重複定義**（低）: `export-image/pdf.ts`と`export-image/render-and-capture.tsx`の双方に同一の`const PT_PER_CSS_PX = 72/96;`が独立定義されている。値は一致しており実害はないが、DRY原則の観点では1箇所に集約する余地がある（followup候補）。
6. **console.log/eslint-disable/nolint**: 触れたファイル群に該当なし（grep確認済み）。
7. **依存追加**: package.json/pnpm-lock.yaml/go.mod/go.sumのdiffはゼロ。新規依存追加なし。

---

## 推奨修正（優先度別）

- **高（M17完了前に修正必須）**: なし。重大な設計逸脱・非回帰破壊・CSV波及は検出されなかった。
- **中（並行可）**:
  - 縮小フィット判定の「ちょうど70%」境界値を明示的に検証する単体テストを1件追加する（`renderPageRaster`のscale計算をユニットレベルで境界ぴったりに設定できるテストヘルパーが必要）。
  - ラベル折り返し是正について、Playwright実機（Chromium）でoverflow-wrap:anywhere適用後のセル幅・行高を`getBoundingClientRect`等で実測し、フォント欠如環境でもlayout上のoverflow解消は確認可能である旨を完了報告に追記する（「目視検証不可」と「layout検証不可」を書き分ける）。
- **低（将来対応）**:
  - `m17-05c-pdf-pagination.spec.ts`のコメント更新（行分割撤去を反映）。
  - `PT_PER_CSS_PX`定数の一元化（`pdf.ts`と`render-and-capture.tsx`の重複解消）。
  - `LABEL_CELL`/`VALUE_CELL`の折り返し手法統一。
  - `OVERFLOW_NOTE_TEXT`コメントをCLAUDE.md準拠の`TODO(...)`形式に揃える。

---

## 良かった点

- 行分割撤去に伴う「二重挙動の残骸」が一切なく、`grep`でdangling参照ゼロを確認できるほど整理されたリファクタリングになっている（`measure.ts`削除・`RowMetric`/`rowContinuation`等の関連型もすべて除去済み）。
- 縮小フィットの再帰構造が「最大1回で必ず止まる」形に素直に実装されており、無限ループのリスクを構造的に排除している。
- メディア除外の実装が`run-export.ts`の一点集約（`toVisualSelected`）で、PDF/PNG/クリップボードの3経路に一貫して波及しつつCSVには全く触れない設計になっており、CHANGE-073の「CSV非波及」要求を単体テストで裏付けている。
- DES drift（比較ページ高さのA4横字面 vs 実装のA4縦相当）を製造が独断で握りつぶさず、完了報告・引き継ぎの両方に明記して設計判断待ちとして報告している点はCLAUDE.md §8の運用方針に忠実。
- `overflow-wrap:anywhere`という技術的に妥当な選択をしており、`word-break:break-all`のような過剰な破壊的分割を避けている。

---

## 制約事項

- 本レビューはコード上で判定可能な範囲のみを対象とした（Read・git diff/logのみ、コード変更・コマンド実行なし）。
- 実際の動作確認（`pnpm test`/`make e2e`の実行）・パフォーマンス測定は行っていない。完了報告書記載のテスト結果（Vitest/E2E pass）は書面上の記述として参照したのみで、独自の再実行による検証はしていない。
- 実機（特に日本語フォント環境）でのラベル折り返しの目視確認は本レビューでは実施していない。上記「設計準拠性以外の指摘」2項に記載のとおり、layout上のoverflow解消自体は理論的にはグリフ有無に依存しないと考えられるが、これは静的コードレビューに基づく技術的推論であり、実機での最終確認は別途必要。
- 品質grep（禁則語・簡体字・「起き攻け」誤字・「DR」略記）の網羅的な再実行は行っていない。touchしたファイル群の目視範囲では該当なしを確認した。
- 不明点は本文中に明記のとおりであり、それ以外に「不明」として留保した事項はない。

---

*以上、M17-05c-fix レビュー報告書。判定＝重大ゼロ・軽微複数（持ち越し許容）。§12（チェックリスト§12「レビュー完了の判定」）の基準に照らし、§1〜§6 OK・§9重大ゼロのため完了承認の妨げとなる事項はないと判断する。*

---

## 取り込み結果（自動トリアージ・2026-07-18）

**判定=合格・重大ゼロ**。安全弁（高指摘の不採用エスカレーション）は不発。指摘 4 件すべて採用。

| 指摘 | 優先度 | 採否 | 対応 |
|------|--------|------|------|
| 縮小フィット「ちょうど70%」境界の単体テスト未整備 | 中 | **採用** | `render-and-capture.test` に境界近傍 2 ケース(height=3100→scale≒0.72=fit／3300→≒0.68=注記付き原寸)を追加。8 件 pass。 |
| ラベル折り返し検証の書き分け(overflow解消はグリフ非依存で実測可能だった) | 中 | **採用** | 英数字 40 連続で `overflow-wrap:anywhere` の折り返しを Playwright 実測確認(29px→55px)。完了報告 §8 を「折り返し機構は実測済/日本語はtofuで環境固有・目視のみ不可」に書き分け。 |
| `m17-05c-pdf-pagination.spec` コメント陳腐化(行分割前提) | 低 | **採用** | コメントを「列分割で複数ページ(行分割は fix で撤去)」へ修正。 |
| `PT_PER_CSS_PX` 重複定義・`OVERFLOW_NOTE_TEXT` が TODO 形式でない | 低 | **採用** | `pdf.ts` で `PT_PER_CSS_PX` を export し `render-and-capture` で再利用(重複解消)。注記文言コメントを `TODO(文言確定・開発者)` 形式へ。 |

**未採用の高指摘: なし**（開発者エスカレーション不要）。全 768 単体 pass・E2E 非回帰・tsc 通過。
