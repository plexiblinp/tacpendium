# M13-02 レビュー報告書

対象: 指示書 `docs/instructions/phase3/M13-02-combo-pdf-png-clipboard-export.md` v1.0.0(FR402/403/404)
レビュー対象コミット: `feature/m13-02` 直近 3 件(`7123f7c` docs / `a7a4514` feat / `00eeeaf` test)
チェックリスト: `docs/instructions/phase3/reviews/M13-02-review-checklist.md` v1.0.0 準拠
判定区分: OK / 重大(§9)/ 軽微(§10)/ 質問(§11)

## 総評

正道方針(単独=詳細・複数=比較表・セットプレイ同梱・FR404 HTML クリップボード新規)を忠実に実装しており、設計意図(人が見る形式は 1 つにまとめる/フロント生成で FS を汚さない/貼って表になる)を満たしている。表示項目の単一の真実源(`export-items.ts`)を画像出力・クリップポード双方が参照する設計、出力専用レイアウトと値整形(既存 utils 再利用)の責務分離は良質。Vitest 31 ケースが通過、tsc/build クリーン、Go 側変更ゼロ(=新規 BE エンドポイント・サーバ FS 書込なし)を確認した。**§9 重大ゼロ。** 残る指摘は主にドキュメント DoD(progress-log/伝達メモ/model-allocation 未記入)と、比較表の既定項目が §5.8 の列挙より広い(superset)点の設計確認であり、いずれも完了承認を妨げない軽微〜中。

## 設計準拠性レビュー結果

### §1.1 画面13 への形式追加(DES-005 §5.13)— ◎
- `ComboExportPage.tsx` に形式 `csv/pdf/png/clipboard` を追加。`isVisualFormat`(=非 CSV)時のみ表示項目選択 UI(§5.13-4)を表示。対象選択(all/filter/selected/mycombo)は M13-01 と共通の `ExportParams`/range を維持。
- アクション: PDF/PNG=`triggerDownload`、クリップボード=`toast.success`(コピー完了トースト)。失敗時 `toast.error`、実行中 `busy` で `disabled`。DES-005 §5.13 のアクション規定に整合。

### §1.2 単独 / 比較表の両対応(FR402/403)— ○(軽微あり)
- `ComboExportDocument.tsx` が `combos.length === 1 → SingleLayout(data-export-mode=single)`、`>=2 → ComparisonLayout(data-export-mode=comparison)` を出力対象数で切替(§4.2 確定どおり)。`render-and-capture.test.tsx` が node の `data-export-mode` で単独/比較の選択を検証。切替条件は妥当。
- **軽微/質問(§10/§11)**: 比較表の既定項目が §5.8 の列挙(始動状況/ダメージ/ルート/起き攻め/有利フレーム/セットプレイ/タグ/備考)を**上回る superset**。既定で `driveDamage`(ドライブダメージ)/`driveStart`(ドライブゲージ開始残量)/`saStart`(SAゲージ開始残量)/`situation`(状況)/`customStates`(キャラ固有状態)も比較表に出る。これらは §5.6 詳細の項目であり、§5.13-4 表示項目選択で解除可能・単一真実源で詳細と比較を兼ねる設計のため**実害は小さく合理的**だが、§5.8 の「全項目常時表示」列挙とは厳密には齟齬する。設計担当へ「比較表既定=§5.6∪§5.8 で許容か」を伝達メモで確認推奨。
- **軽微(§10)**: 比較表のセットプレイ列が「名称: フルレシピ」を出すが、§5.8 は同列を「名称一覧(名前未設定時はレシピ先頭)」と規定。詳細(§5.6 item9 はレシピ全文)との統一を優先した結果で richer 方向の逸脱。要設計確認。
- **軽微(§10)**: 行順が §5.8 と一部相違(`recipe` が `damage` より前/`有利フレーム`(knockdownAdvantage)が起き攻めの前)。§5.8 は damage→route、有利フレームは「起き攻めセクションから独立行」=oki の後。レイアウト細部のため持ち越し可。

### §1.3 セットプレイ同梱(DES-005 §5.13)— ◎
- `export-model.ts setupsValue()` が紐づく setups を「名称: レシピ」(名称未設定はレシピのみ)で `\n` 連結し、`setups` 行として全形式に同梱。PDF/PNG はレイアウト行、クリップボードは HTML セル(`<br>`)/TSV(` / ` 畳み)として「コンボの下に」並ぶ。CSV の別ファイル方式とは別思想を維持。テスト(export-model/clipboard/ComboExportDocument)が同梱を検証。

### §1.4 FR404 クリップボード(新規)— ◎
- `clipboard.ts`: `ClipboardItem({ "text/html": Blob, "text/plain": Blob })` を `navigator.clipboard.write`。単独=2列(項目|値)、複数=列:各コンボ/行:項目(§5.8 同方向)。`<table border="1">` で Excel/スプレッドシート貼付時に表化。`escapeHtml` で `& < > " '` をエスケープ、セル改行は `<br>`、TSV はタブ→空白・改行→` / ` で行崩れ防止。
- **フォールバック**: `ClipboardItem` 非対応/`write` 失敗(権限不可等)時は `writeText(text/plain)`、いずれも不可で例外送出(呼出側で失敗トースト)。clipboard.test.ts が 4 経路(write/非対応/write失敗→writeText/API なし→throw)を検証。要件を満たす。

### §1.5 表示項目選択(DES-005 §5.13-4)— ◎
- `export-items.ts EXPORT_ITEMS` を**単一の真実源**とし、`ComboExportDocument`(画像)と `clipboard.ts`(HTML/TSV)が同じ `buildComboFields` 経由で同一項目・同順を参照。既定全選択。未選択項目は出力に含まれない(全形式)ことを各テストが検証。`oki` 選択時は §5.8 準拠で 6 個別行へ展開。

### §1.6 DES 直接編集の禁止 — ◎
- `git diff main...feature/m13-02` に `docs/design/` の変更なしを確認。製造担当は DES 本体を触っていない。

### §2 生成所在・FS・依存ライセンス — ◎
- フロント生成のみ。`export-data.ts` は参照系 `GET /api/combos`(snake_case クエリ。BE handler と一致確認)で ID 解決 → `GET /api/combos/{id}` で setups 込み詳細取得。3 コミットに Go 変更ゼロ=新規 BE エンドポイント・サーバ FS 書込なし(DES-002 §4.2 / M13-RESEARCH-02 整合)。
- 依存 license(node_modules 実体確認): `html-to-image`=MIT、`pdf-lib`=MIT、推移依存 `@pdf-lib/standard-fonts`=MIT、`@pdf-lib/upng`=MIT、`pako`=MIT AND Zlib、`tslib`=0BSD。**すべて CLAUDE.md §6 許可ライセンス**。非寛容ライセンスの混入なし。

### §3 動作仕様(導線・日本語・再発明回避)— ◎
- 形式選択→`handleExport`→DL/コピーの導線、`busy`/`running` によるローディング表示、成功/失敗/警告トーストあり。画像が大きい場合(`> EXPORT_IMAGE_WARN_COUNT=30`)は警告トースト、canvas 上限超過は明示エラー化。
- 日本語: DOM レンダリング(html-to-image)+ JP フォント指定(`Hiragino/Noto Sans JP/...`)、HTML/TSV はエスケープが日本語を保持(test で「日本語メモ確認」「&危険」検証)。文字化け要因はコード上見当たらない。
- 値整形は既存 `features/combo/utils`・`customStates` を再利用、出力専用レイアウトは既存表示コンポーネントを改変せず別建て(§2.3 遵守)。再発明なし。

### §4 テスト妥当性 — ◎
- combo-io スイート 31 ケース通過(export-model 8 / clipboard 12 / ComboExportDocument 4 / render-and-capture 4 / 既存 types 3)。形式別生成・単独/複数のレイアウト選択・setups 同梱・ClipboardItem(html+plain)+ フォールバック・表示項目選択・日本語・エスケープ・後始末(画面外ノード除去)を網羅。指示書 §5.1 の要求ケースを満たす。
- E2E/手順による実機貼付目視は §5.2/§10 のとおり持ち越し可(画像生成 E2E は重いため手順書併用)。

### §7 非破壊性 — ◎
- `api.ts` の変更は `triggerDownload` の `export` 公開(+コメント)のみで、`useExportCombo`(CSV zip)/import 系は不変。comboio CSV 契約・画面6/画面8 の既存表示に変更なし。

## 設計準拠性以外の指摘事項

- **規約遵守(◎)**: `ExportItemKey` 等は camelCase、命名は SCREAMING_SNAKE_CASE 定数/PascalCase コンポーネント/`useXxx`、import 順序も既存準拠。新規 API DTO の追加なし(フロント内部型のみ)。`console.log`/`fmt.Println` 残置なし。tsc 緑。
- **責務分離(◎)**: 生成ロジックは `web/src/features/combo-io/` 配下に集約、出力整形(export-model)・項目定義(export-items)・画像コア(export-image/)・レイアウト(export-layout/)・クリップボード(clipboard.ts)が明快に分離。
- **ソース取込の出典表記(低)**: コピーした `export-image/capture.ts`・`pdf.ts` のヘッダが出典を「`autopilot-combomgr/projects/combo-export-image`(MIT License)」と明記するが、当該統合元リポジトリには **LICENSE ファイルが存在しない**(INTAKE.md/CODE-FACTS.md にランタイム依存=html-to-image/pdf-lib が MIT との記載はある)。ランタイム依存の MIT は実体確認済みで問題ないが、一次製作物(combo-export-image 自体のコード)の「(MIT License)」表記は LICENSE 実体で裏付けられていない。内製コードであれば表記を「first-party 内製」とするか、統合元に LICENSE を置くのが望ましい。
- **同時取得の上限なし(低)**: `fetchComboDetails` は対象 ID 全件を `Promise.all` で並列 `GET /api/combos/{id}`。range=all で多数のとき burst になりうる(同時実行制限なし)。クリップボード経路には件数ガードがない(画像のみ `EXPORT_IMAGE_WARN_COUNT`)。実害は小だが将来の上限/逐次化を検討余地。
- **警告閾値と失敗閾値の不整合(低/軽微)**: 比較表幅 = `max(720, 160 + n*360)` CSS px、pixelRatio=2 で canvas 上限 16384px に対し概ね **n≧23 で `capture` がスローする**一方、警告トーストは `n>30` で初めて出る。23〜30 件の比較表出力は事前警告なしにハードエラーへ落ちる。警告閾値を比較表の実限界へ寄せる/対象数で閾値を分けると親切(ページ分割は後続=§10 許容)。
- **triggerDownload の即時 revoke(低)**: `a.click()` 直後に同期 `URL.revokeObjectURL`。一部ブラウザで DL が中断しうる既知パターンだが、M13-01 CSV 既存実装の再利用であり本サブで新規導入したものではない。挙動温存の観点では現状維持で可。

## 推奨修正(優先度別）

- 高(M13 完了前に修正必須): **なし**(§9 重大ゼロ)。
- 中(M14 着手と並行可):
  - DoD ドキュメント整備(指示書 §7.4/§7.5/§10・チェックリスト §8): `docs/progress/progress-log.md` に M13-02 完了報告(Plan Mode 7 項目確定方式・テストケース数・既知制約=ベクター PDF/ページ分割後続)を追記。実装で具体化した出力契約(クリップボード HTML 形式・単独/比較切替・表示項目セット)を**設計担当への伝達メモ**として申し送り。model-allocation に M13-02 行追記。**現状ブランチに progress-log の M13-02 セクション・伝達メモが見当たらず、Plan Mode の開発者確認記録(M13-01 にはあった「§3.4 全項目確定」相当)が未確認**=トレーサビリティ上、追記を推奨。
  - 比較表既定項目(§5.8 superset)とセットプレイ列の表記(名称+フルレシピ)について設計担当の許容確認(伝達メモ経由)。許容なら DES-005 §5.8/§5.13 の明確化要否を設計判断。
- 低(将来対応):
  - 警告閾値(30)を比較表の実 canvas 限界(~23)へ整合、または対象数依存に。
  - `fetchComboDetails` の同時実行上限/逐次化。
  - 取込コア出典ヘッダの license 表記の裏付け(統合元 LICENSE 配置 or first-party 表記)。
  - 行順を §5.8 配列(damage→route、有利フレームは oki の後)へ寄せる(レイアウト細部)。

## 良かった点(Claude Code へのフィードバック)

- 表示項目を `export-items.ts` の単一真実源に集約し、画像レイアウトとクリップボードの双方が同一 `buildComboFields` を経由する設計は、全形式での項目選択一致・テスト容易性・再発明防止を一手で達成しており秀逸。
- FR404 のフォールバック階段(ClipboardItem→writeText→throw)とエスケープ/行崩れ無害化(HTML は `<br>`、TSV は ` / ` 畳み)が丁寧で、4 経路をテストで固めている。
- canvas 上限の沈黙破綻を明示エラーへ変換し、後続のページ分割を TODO で明記する等、ラスタ方式の限界に対する誠実なガードがある。
- 出力専用レイアウトを別建てにし既存表示(画面6/画面8)を一切改変しない非破壊アプローチ、Go 変更ゼロでフロント生成を貫いた点が方針に忠実。

## 制約事項

- 本レビューはコード上で判定可能な範囲のみ対象。実際の PDF/PNG 描画結果・スプレッドシートへの貼付表化・各ブラウザのクリップボード権限挙動・パフォーマンス・実機テストは別途(手順書/E2E)実施が必要。
- Plan Mode の開発者確認 Q&A 実体はブランチ内に未確認。コード/コミットメッセージ上は §3.4 の 7 項目すべてが反映されているが、開発者署名記録の有無は progress-log 追記(中・上記)で担保されたい。

---

## 取り込み結果(自動トリアージ)

`/implement_plan_full` Phase C による自動トリアージ。**「高」指摘はゼロ**のためエスカレーション不要。各指摘の採否と理由を以下に記録する(事後監査用)。

| 指摘(優先度) | 採否 | 対応・理由 |
|---|---|---|
| DoD ドキュメント整備(中) | **採用** | `docs/progress/progress-log.md` に M13-02 完了報告(Plan Mode 7 項目・テスト・既知制約)+ **設計担当への申し送り**を追記。`docs/human-notes/model-allocation.md` に M13-02 行追記。`docs/handover/followup-backlog.md` に M13-02 後続(ベクター PDF・ページ分割・§5.8 superset 設計確認)を追記。指示書 §7.4/§7.5 の DoD。 |
| 比較表既定=§5.8 superset / setups 列が「名称+フルレシピ」(中・設計確認) | **採用(申し送り)** | コード変更はしない(単一真実源 + 項目選択可で合理的・実害小)。実装で具体化した契約として progress-log の申し送り + followup-backlog に記載し、DES-005 §5.8/§5.13 への明確化要否は設計担当判断に委ねる(製造担当は DES を直接編集しない)。 |
| 取込コア出典ヘッダの「(MIT License)」表記(低) | **採用** | `export-image/{capture,pdf,types}.ts` のヘッダを修正。統合元は LICENSE ファイル無しの先行内製成果物であり「(MIT License)」表記は未裏付けのため、「先行内製成果物(本体ライセンス下に取込)・ランタイム依存は MIT」へ正確化。 |
| 画像警告閾値(30)が比較表の実限界(~23)とずれ(低) | **採用** | `EXPORT_IMAGE_WARN_COUNT` を 30 → **20** に下げ、ハードエラー(n≧23)の手前で事前警告。コメントに算出根拠を明記。 |
| `fetchComboDetails` の同時実行上限なし(低) | **不採用(将来)** | range=all の大量出力は画像 canvas 上限で実用上制約され、クリップボードも数百件貼付は稀。同時実行制御の追加は複雑性に見合わず、followup-backlog に将来課題として記載。 |
| `triggerDownload` 即時 revoke(低) | **不採用** | M13-01 の既存実装の再利用であり本サブで新規導入したものではない。レビュアーも「現状維持で可」。スコープ厳守の観点で挙動温存。 |
| 行順が §5.8 配列と一部相違(低・レイアウト細部) | **不採用(将来)** | §10 軽微(レイアウト細部)で持ち越し可。項目選択・値は正しく、視認性に実害なし。followup-backlog に記載。 |

> 不採用はいずれも **低** 優先で理由付き。**中** 指摘は採用(コード or ドキュメント)。重大指摘の自動棄却はゼロ。

---

*以上、M13-02 レビュー報告書。配置 `docs/progress/phase3/m13-02-review.md`。*
