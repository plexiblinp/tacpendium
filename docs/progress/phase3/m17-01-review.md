# M17-01 レビュー報告書

| 項目 | 内容 |
|------|------|
| 対象 | M17-01(G-j メディア 3 フィールド: link・video_path・image_path) |
| 対象コミット | `6b5d7ef`〜`4dbc893`(feature/m17-01・5 コミット) |
| 対象指示書 | `docs/instructions/phase3/M17-01-media-fields.md` v1.0.2 |
| チェックリスト | `docs/instructions/phase3/reviews/M17-01-review-checklist.md` v1.0.0 |
| 設計判断の正 | `docs/change-notes/CHANGE-068-notification.md` |
| レビュー実施日 | 2026-07-16 |
| レビュー方式 | 読取専用コードレビュー + 検証としてテスト実行(Go: migration/repository/combo/comboio/api 全 ok、Vitest: 影響 6 ファイル 60 tests 全 pass、locales parity 含む) |

---

## 総評

CHANGE-068 の 4 性質(**非破壊・非 dup・非 recipe・文字列参照まで**)がコード・テストの両面で厳密に守られた、質の高い実装である。マイグレは 000031 単独の ADD COLUMN で既存 000001〜000030 に一切触れておらず、`DuplicateKey`(repo/validation 両層)・`CalcRecipeHash`・`RecomputeComboCache` への変更はゼロ(かつ「メディアだけ異なるコンボが重複判定される」「recipe_cache 不変」をテストで能動的に担保)。link の XSS 面は表示層の `isSafeHttpUrl`(前方一致ホワイトリスト方式)で無害化され、`javascript:`/`data:`/`file:`/`vbscript:` の非リンク化が Vitest・E2E の両方で検証されている。CSV は任意列末尾追加・`optionalImportColumns` 経由で旧 CSV 後方互換が成立し、VAL-I10 対称適用による verbatim 往復も統合テストまで揃っている。重大指摘(§9)はゼロ。指摘は完了報告の DES 節番号転写(中)と軽微な観察事項(低)のみ。

## 設計準拠性レビュー結果

チェックリスト §1〜§8 の判定(◎=問題なし・○=軽微な留意あり・△=要修正・×=重大)。

### §1 スキーマ・非破壊 — ◎

- `migrations/000031_add_combo_media.{up,down}.sql`: up は `ALTER TABLE combos ADD COLUMN` ×3(TEXT・NULL 可・DEFAULT NULL・backfill なし)、down は `DROP COLUMN` ×3(前例 000008/000013/000020 と同技法)。新列はインデックス・トリガ非参照のため単純 DROP で安全という down 側の理由記載も妥当。
- **連番 000031 は正**: 実ファイル確認で 000029(clear_ryu_legacy_seed)・000030(seed_moves_ryu)が存在し、次の空き番号を正しく使用。指示書 v1.0.2 の是正(M14-03c の 2 連番消費)と一致。`git diff main...HEAD -- migrations/` は 000031 の 2 ファイル追加のみ=**既存マイグレ 000001〜000030 非改変**。
- `TestRun_ComboMediaColumnsAdded`(3 列 TEXT・既存行 NULL・文字列 round-trip)+ `TestRun_ComboMediaColumnsDownRollback`(v31→v30→v31 のバージョン指定 down/up・無関係列 memo 不変確認)が実在し、migration パッケージのテストは全通過(dbtest.Setup 系の repository/service テストも全通過=全マイグレ適用が成立)。
- 既存列・他テーブル・setups への変更なし(diff で確認)。

### §2 非 dup・非 recipe(重点)— ◎

- `internal/repository/combo/repository.go` の `DuplicateKey`(6 キー)・`internal/service/combo/duplicate_keys.go` の `DuplicateCheckFields`(7 要素)・`CalcRecipeHash`(steps の move_id + modifiers のみ)・`internal/service/notation/cache.go` はいずれも**変更 0 件・メディア 3 列への参照なし**(grep で確認)。
- **テスト実在確認**: `TestService_Create_VAL_C02_MediaNotInDuplicateKey`(メディア 3 列だけ異なるコンボが VAL-C02 ERROR になる=非 dup の能動検証)、`TestService_UpdateMetadata_MediaTristate_NoRecipeRecompute`(メディア PATCH 前後で recipe_cache 完全一致)。チェックリスト §2 が求める両テストが揃っている。
- 構造面でも `UpdateMetadata`(PATCH 経路)は元々 `RecomputeComboCache` を呼ばない(呼出は Create/PUT/Restore のみ)ため、メディア PATCH での cache 再計算は機構的に発生しない。完了報告 §1-5 の実査記録と実コードが一致。

### §3 model/DTO/repository・PATCH トライステート — ◎

- `internal/model/combo.go`: `Link`/`VideoPath`/`ImagePath` を `*string` + db タグ(link/video_path/image_path)+ json タグ(link/videoPath,omitempty 等)で memo/situation と同型追加。camelCase JSON 規約(CLAUDE.md §4)準拠。
- repository: INSERT 1 + SELECT 4 本(FindByID/FindByIDAllowDeleted/List/FindActiveByDuplicateKey/ListAllActiveCombos)+ `scanCombo` の**列リスト 7 箇所すべて同期**(列順も SQL⇔Scan で一致)。
- PATCH: `UpdateMetadataInput` に `Optional[string]` ×3、`UpdateMetadata` の SET 句組立が memo/situation と同一機構(present のみ SET・`Arg()` の untyped nil で NULL クリア)。DTO `UpdateMetadataRequest` は `comborepo.Optional[string]`(omitempty なし=presence 検出可能)で CHANGE-043 に正しく準拠。
- **3 状態の各層テスト**: repository(`TestRepository_ComboMedia_InsertAndTristate`=不在温存/値更新/null クリアを 3 列で交差検証)、handler(`TestHandler_UpdateMetadata_MediaTristate`=実 JSON `{"link":"…","videoPath":null}` からのデコードで present+値/present+null/不在 の 3 状態を同時検証)、service(値更新+クリア+cache 不変)。E2E でも「link 空クリア時に未編集 path 2 種が温存」を確認しており、トライステートは全層で担保。
- service `applyMetadataInput` にも 3 列を merge 追加(検証プローブの網羅性維持)。CreateInput/buildComboFromInput 追従、`PutRequest`(embeds CreateRequest)経由で PUT(キー変更編集)でもメディアが引き継がれる(FE 側も `runPut` が `buildCreatePayload()` を spread しており整合)。

### §4 CSV(後方互換・verbatim)— ◎

- `csvcore/contract.go`: 3 列を `CSVColumns` **末尾**に追加し `optionalImportColumns` に登録。`requiredImportColumns` は差分自動算出(全列−任意列)のため**必須列に参入していない**。CHANGE-061/063 の任意列末尾追加標準に完全準拠。
- 旧 CSV 後方互換: `TestMediaBackwardCompatImport` が `requiredImportColumns` のみのヘッダで import 成立・3 列空(=NULL)を検証(必須列のみの最小 CSV で構成しており、M16 任意列も含まない一段古い CSV まで通ることを示す強いテスト)。
- verbatim: export は `sanitizeFreeText`、import は `desanitizeFreeText` の**対称適用**(VAL-I10・memo と同一扱い=開発者確認済みで OK)。`TestMediaRoundTrip` が `javascript:` 風文字列・非 ASCII 相対パス・式トリガ先頭 `=IMAGE(A1).png` の往復不変を検証。`TestMediaFieldsExportImportRoundTrip`(実 DB→export→import→再 export の統合)まで揃う。
- 緩検証: `decodeRow` は 3 列に対し desanitize のみで検証コードを一切積まない。`TestMediaNoValidation` が不正形式(非 URL・Windows 絶対パス風・不在ファイル)でも Issue 0 件を確認=「閲覧不可を許容」「import 検証エラーなし」に準拠。

### §5 表示・無害化(XSS 面)— ◎

- `web/src/lib/safe-url.ts` の `isSafeHttpUrl`: trim+小文字化のうえ `http://`/`https://` **前方一致のみ true** のホワイトリスト方式。ブラックリスト方式でないため `vbscript:` 等の列挙漏れリスクがなく、大文字偽装(`JavaScript:`)・偽装プレフィックス(`httpx://`)も遮断(テストで確認)。
- `ComboDetailMetadata.tsx`: link は判定 true のときのみ `<a href target="_blank" rel="noopener noreferrer">`(**rel 属性あり**)、false は生テキスト。React の JSX テキストレンダリングのため値のエスケープも自動で担保。`videoPath`/`imagePath` は**常にテキスト**(`<a>`/`<img>`/`<video>` を生成しない — テストで `document.querySelector("img")` null まで確認)。
- 危険スキーム非リンク化は Vitest(`javascript:`/`data:`/`file:`/`vbscript:`/`ftp:`/相対パス)+ **E2E spec 2 本目**(実ブラウザで `javascript:alert(...)` が非アンカー表示)の二重担保。
- 編集: 空入力=`nullIfEmpty` で null 送信=PATCH null クリア(`ComboEditor.test.tsx` で payload.link===null を検証、E2E でも実機確認)。比較表: 3 行追加・テキストのみ(`CompareTable.test.tsx` でアンカー不在を確認)・列ペアリング機構は不変。PDF/PNG/クリップボード: `export-items.ts`/`export-model.ts` で**文字列 3 行のみ**(既定 ON・画像実体埋め込みなし。全選択 28 行のテスト更新済み)。
- NULL 項目の扱いは「メディアセクションごと非表示(3 列全 NULL 時)/一部のみ値がある場合はその項目のみ表示」で、tags の hidden-when-empty 流儀に整合(指示書 §9.2 の許容裁量・Plan 提示済みと完了報告 §3 に記録)。

### §6 スコープ遵守 — ◎

- ファイルを開く/配信/再生/プレビュー/存在確認の実装は BE・FE ともに**皆無**(BE は文字列カラムの素通し、FE は `<a>` 1 個とテキストのみ)。リンク切れ・ファイル不在をエラーにする経路もなし。
- 各 1 件(`*string` ×3)であり配列化していない。setups への波及なし。

### §7 コード品質・i18n — ○

- 品質 grep: 「起き攻け」誤字 0・「DR」略記 0・簡体字 0(diff 全体を機械確認。完了報告内の「『起き攻け』0」は grep 対象の引用であり違反ではない)。
- i18n: 詳細(`comboDetail.metadata.media|link|videoPath|imagePath`)・比較(`compare.row.link|videoPath|imagePath`)を ja/en 両ロケールに追加。`locales.test.ts`(parity 機械強制)通過を実行確認。編集画面・エクスポートのラベルが固定日本語なのは既存流儀+開発者確認済み(完了報告ヘッダに記録)で妥当。
- コメント品質・エラー wrap(`fmt.Errorf %w`)・命名は既存規約に整合。`console.log`/`fmt.Println` の混入なし。
- 留意(低): ラベル文言は仮(§9.2 裁量・確定は開発者)だが、E2E spec がプレースホルダ文言セレクタに依存している(→ 推奨修正・低-a)。

### §8 ドキュメント — ○

- 完了報告 `docs/progress/phase3/m17-01-completion-report.md` に Plan Mode 6 項目の実査結果(連番 000031 のフォールバック発動と開発者確認・トライステート実装位置・スキーム制限方式=前方一致ヘルパ新設・dup/recipe 非波及の実コード確認)と DES 反映要点(§5)が揃っており、CHANGE-068 三点セット確定の材料として十分。独立した Plan Mode 質問書ファイルは見当たらないが、開発者回答 3 件(連番/VAL-I10 適用/i18n 流儀)が報告ヘッダに記録されており実質充足と判断する。
- **製造は DES 本体(REQ-001/DES-001〜006/SUPP-001)を編集していない**(diff で確認)。`docs/design/testid-convention.md` への 6 件追記は同規約自身が義務付ける一覧更新であり DES 本体編集に該当しない。
- 留意(中): 完了報告 §5・migration up.sql コメントに「DES-003 §3.3」が転写されているが、現行 DES-003 で combos は **§3.4**(§3.3 は moves)。指示書・CHANGE-068 由来の節番号誤りの伝播(→ 推奨修正・中-a)。

### チェックリスト §9(重大)判定

該当ゼロ。§9 列挙の 7 項目(推測実装/マイグレ改変・連番衝突/dup・recipe 参入/危険スキームリンク化/スコープ踏み越え/CSV 必須列化・非 verbatim/トライステート不全)すべて不成立をコードとテストで確認した。

## 設計準拠性以外の指摘事項

1. **isSafeHttpUrl の判定と href の値の非対称(セキュリティ実害なし)**: 判定は trim 済み値で行うが、`<a href>` には未 trim の生値を渡す。前後空白付き URL でもブラウザが先頭空白を除去して http(s) として解釈するため危険スキームへの化けは起きない(判定済みプレフィックスが http のため)。表示美観上の差のみ。
2. **zod `max(2000)` と BE/CSV 長さ非強制の非対称(memo と同一の既存パターン)**: BE・CSV は 3 列の長さを制限しないため、CSV import で 2000 字超の値を持つコンボを UI 編集すると保存時に CLIENT エラーになる非対称が理論上ある。これは memo が従来から持つ挙動と同一で、「長さ上限は形式強制に非該当」の解釈(完了報告 §3)も含め容認可能。DES-006 反映時に「UI のみ 2000 上限」を明文化すると将来の混乱を防げる。
3. **VAL-I10 desanitize の既知エッジの継承**: DB 値が「`'` + 式トリガ」で始まる場合(例 `'=x`)、export は無改変・import は `'` を 1 個剥がすため往復で値が変わる。これは memo/セットプレイ名が従来から持つ VAL-I10 実装全体の既知エッジであり、M17-01 固有の逸脱ではない(開発者確認の「memo と同じ扱い」の範囲内)。記録のみ。
4. **CompareTable のメディア行の `title` 属性**: `title={c.link}` は undefined 時に属性ごと省略され問題なし。truncate + title のパターンは長大値の比較表崩れ対策として妥当。

## 推奨修正(優先度別)

- **高(M17 完了前に修正必須)**:
  - なし。
- **中(M18 着手と並行可)**:
  - (a) **DES-003 節番号の転写誤りの申し送り**: CHANGE-068・指示書は「DES-003 §3.3(combos)」と参照するが、現行 DES-003 v1.29.0 では combos は **§3.4**(§3.3 は moves)。完了報告 §5 の反映要点と `migrations/000031_add_combo_media.up.sql` のコメントにも「§3.3」が転写されている。実装への影響はゼロだが、**CHANGE-068 三点セット確定時に設計担当が誤節へ反映するリスク**があるため、設計担当への連絡時に「combos の実節は §3.4」と明示すること(完了報告 §5 の当該表記の訂正でも可)。
- **低(将来対応)**:
  - (a) **E2E spec のセレクタとラベル仮確定の連動**: `m17-01-media-fields.spec.ts` はプレースホルダ文言セレクタ(testid-convention の優先順位 3=規約準拠)を使うが、メディアのラベル/プレースホルダ文言は仮(確定は開発者)。文言確定時に spec の追従修正が必要になる点を、ラベル確定タスクとセットで扱うこと(または確定時に `combo-editor-link` 等の付与済み test-id へ移行)。
  - (b) `isSafeHttpUrl` 判定に使った trim 済み値を href にも使う(表示整形のみの改善)。
  - (c) DES-006 反映時に「link/path の長さ上限は UI(zod/maxLength=2000)のみ・BE/CSV 非強制」を明文化(上記指摘 2)。

## 良かった点

- **4 性質の「変更ゼロ」を能動テストで証明する姿勢**: dup/recipe 非波及を「触っていない」で済ませず、「メディアだけ異なるコンボが重複判定される」「メディア PATCH で recipe_cache が不変」という反転視点のテストを書いており、将来の退行に対する防波堤になっている。
- **XSS 無害化の設計品質**: ブラックリストでなく http/https 前方一致のホワイトリスト方式を選び、単体(6 種の危険/偽装入力)・コンポーネント(rel/target 属性まで)・E2E(実ブラウザ)の三層で検証。VAL-I08 流用可否の実査(「コード実体なし」の発見)と新設判断の記録も的確。
- **後方互換テストの構成力**: 旧 CSV を `requiredImportColumns` から機械的に構成することで「必須列のみの最小 CSV」を検証しており、M16 任意列すら持たない世代の CSV まで通ることを一度に担保している。
- **マイグレテストの精度**: バージョン指定(`m.Migrate(31)`/`m.Migrate(30)`)による down/re-up 検証と、無関係列(memo)不変の確認まで含む。
- **連番フォールバックの正しい運用**: 指示書 v1.0.1 の陳腐化(000030)を実ファイル実査で検出し、開発者確認を経て 000031 で確定・記録した(§3.3-1 の想定どおりの動き)。
- **完了報告の質**: Plan Mode 6 項目の実査結果・推測箇所の明示(§3)・DES 反映要点(§5)・dev 再起動の申し送り(既知の罠への言及)まで揃い、設計担当の三点セット確定作業に直結する形になっている。
- **7 箇所の SQL 列リスト同期に漏れなし**(列順の SQL⇔Scan 一致含む)。3 interface 同期規約(ComboSummary/Combo/CreateComboRequest/UpdateMetadataRequest)も遵守。

## 制約事項

- 本レビューはコード上で判定可能な範囲のみ対象。実際の動作確認・パフォーマンス・実機テストは別途実施が必要。
- 検証として Go テスト(migration/repository/combo/comboio/csvcore/api の 6 パッケージ=全 ok)と Vitest(影響 6 ファイル 60 tests=全 pass・locales parity 含む)は実行したが、`make e2e` フルスイート(19 passed と報告)と Vitest 全量(696 tests と報告)はレビュー環境では再実行しておらず、完了報告の記載を採用した。
- ラベル文言(リンク/動画パス/画像パス、en: Link/Video path/Image path)は仮であり、確定は開発者判断(指示書 §9.2)。

---

## 取り込み結果(自動トリアージ)

> `/implement_plan_full` Phase C。実施日 2026-07-16。「高」指摘なし=エスカレーション不要。

| # | 指摘 | 採否 | 理由・対応 |
|---|------|------|-----------|
| 中-a | DES-003 節番号の転写誤り(combos は現行 §3.4・§3.3 は moves) | **採用** | 三点セット確定時の誤節反映リスク排除のため、完了報告 §5 の当該行と `000031_add_combo_media.up.sql` 冒頭コメントに「CHANGE-068 は §3.3 表記だが現行 DES-003 では combos は §3.4」の注記を追加。000031 は本サブ新設のマイグレでありコメントのみの修正=スキーマ非変更・dev DB 未適用のため安全(既存 000001〜000030 は非改変のまま) |
| 低-a | E2E spec が仮ラベルのプレースホルダ文言セレクタに依存 | **採用(申し送り化)** | ラベル文言の確定は開発者判断(指示書 §9.2)のため即時修正はせず、完了報告 §6 に「文言確定時に spec 追従(または testid 移行)をセットで行う」旨を追記 |
| 低-b | `isSafeHttpUrl` 判定に使った trim 済み値を href にも使う | **採用** | `ComboDetailMetadata.tsx` の `href={combo.link}` を `href={combo.link.trim()}` へ修正(表示整形のみ・セキュリティ実害なしの改善)。既存テストへの影響なしを Vitest で確認 |
| 低-c | DES-006 反映時に「長さ上限は UI のみ・BE/CSV 非強制」を明文化 | **採用(申し送り化)** | 製造は DES を直接編集しないため、完了報告 §5 の DES-006 反映要点に明文化推奨として追記(設計担当が三点セットで確定) |
| 指摘事項 3 | VAL-I10 desanitize の既知エッジ(`'`+式トリガ開頭値の往復非対称)の継承 | **不採用(記録のみ)** | memo/セットプレイ名が従来から持つ VAL-I10 実装全体の既知エッジであり M17-01 固有の逸脱ではない(開発者確認済み「memo と同じ扱い」の範囲内)。対応するなら VAL-I10 全体の別サブで扱うべき |
| 指摘事項 1/4 | href 非対称(=低-b と同件)・CompareTable title 属性 | 1 は低-b で対応済・4 は指摘自体が「問題なし」の観察 | — |
