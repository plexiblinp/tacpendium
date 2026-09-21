# M13-01 レビュー報告書(チェックリスト準拠・第2回)

> 対象: M13-01「コンボ CSV エクスポート/インポート(FR401/405)」
> 準拠: `docs/instructions/phase3/reviews/M13-01-review-checklist.md` v1.0.1(§0〜§12 全項目)
> レビュー方式: コード Read のみ(変更なし)。Go test 緑・`go build ./internal/...` 緑を確認。
> レビュー日: 2026-06-28 / レビュー担当 Claude

## 総評

チェックリスト v1.0.1 の §1〜§8 を全小項目について検証した。**重大(§9)該当はゼロ**。Plan Mode 8 項目は progress-log §「Plan Mode 確定方式」に開発者回答(export 配送 ZIP 等)を含めて全て記録されており、推測実装は認められない。初回レビュー(指示書代替)との差分として新たに確認できた点は、(a) `drive_damage` float / oki nil-false 区別 / starter 再導出 / DuplicateKey 整合が往復ゴールデンテストと実 DB 統合テストの双方で担保されていること、(b) 上書きが DupAction から完全に排除され(skip/add のみ)CHANGE-051 と整合すること、(c) export/import が in-memory ZIP で完結しユーザ入力パスの FS 流入が構造的に発生しないこと。軽微(§10)は preview の親解決楽観表示、handler 層の HTTP ステータス単体テスト不在など数点に留まる。**レビュー完了判定: 承認可(軽微は持ち越し)**。

---

## チェックリスト項目別の結果

### §1.1 エンドポイント(DES-002 §4.2)

- `GET /api/export/csv`・`POST /api/import/csv/preview`・`POST /api/import/csv` 新設・ルート登録 → **OK**。`internal/api/comboio/routes.go:12-14`、`cmd/combomgr/main.go:211`(`RegisterRoutes(apiGroup, …)`)で配線確認。
- 別経路方式(preview = DB 書込なし / commit = 取込)で解析・検証・無害化が共通サービス層 → **OK**。preview/commit とも `csvcore.ParseAndValidate` を呼ぶ(`import.go:28` / `import.go:130`)。`dryRun` 単一経路ではない。共通コアは `csvcore` パッケージに単一化。
- moves 取込(`movesimport`)と別系統・別ドメイン → **OK**。`internal/service/comboio` は独立パッケージ。movesimport への参照・混在なし。

### §1.2 CSV 契約・案A(DES-005 §5.13/§5.14)

- コンボ CSV に `local_id`、セットプレイ CSV(別ファイル)に `parent_combo_local_id` → **OK**。`csvcore/contract.go:25`(`ColLocalID`)、`:78`(`ColSetupParentComboLocalID`)。両者紐付けは export 採番(`export.go:37` `"c"+i`)→ import 解決(`import.go:279` `resolveSetupParent`)で対称。
- export が意味単位(`character_code`/`move_code` + recipe/tags 埋込)、DB 管理列を出力しない → **OK**。`csvcore/combo.go:5-9` で id/version/created_at/updated_at/deleted_at/step_count/recipe_cache を持たない設計を明文化。`CSVColumns`(contract.go:51)に物理管理列なし。
- セットプレイ親解決(同一バッチ local_id / 既存 ID)・親失敗時スキップ + レポート → **OK**。`import.go:247-251`・`commitOneSetup` の skip + report。テスト `TestImportSetupParentFailureSkipped`(service_test.go:317)で担保。
- export 配送 = ZIP 1 ファイル・in-memory(サーバ FS 非書込)、import が ZIP 自動展開(往復対称)、パス流入なし → **OK**。`export.go:215` `zipFiles` は `bytes.Buffer` 上で完結しディスク一時ファイルを作らない。import 展開 `handler.go:161` `extractZip` は `f.Name` の basename のみ参照(`handler.go:167-170`)し展開先ファイルパスを生成しない(メモリ上で文字列化)→ パストラバーサル発生余地なし。解凍爆弾ガード `io.LimitReader(rc, maxUploadBytes+1)`(handler.go:194)も具備。

### §1.3 型整合・旧形是正(指示書 §4.9)

- `drive_damage` が float(REAL・小数 -6〜6)で往復、小数欠落なし → **OK**。`csvcore/combo.go:24` `*float64`、parse は正準形厳密化 `parseFloatPtr`(parse.go:58)。ゴールデン行 `fp(2.5)` / `fp(-6)` を `reflect.DeepEqual` 往復(csvcore_test.go `TestRoundTrip`)。範囲外 7 は VAL-C13 ERROR(`TestDriveDamageDecimalRange`)。
- oki 6 列が nullable(`*bool`)で空セル=NULL / `false`=明示を区別 → **OK**。`csvcore/combo.go:39-44`、`parseBoolPtr`(parse.go:26)が ""→nil / "false"→&false を分離。ゴールデン行に `bp(false)` と `nil` を混在させ DeepEqual 往復で担保。

### §1.4 starter 導出(指示書 §3.4-1)

- export が starter 列を持たず、import 時にレシピ先頭から `starter_move_id` を再導出 → **OK**。`CSVColumns` に starter 列なし。`toCreateInput`(import.go:327-330)で `steps[0].MoveID` を starter に設定。
- 再導出が DuplicateKey(VAL-C02)・VAL-C03 と整合 → **OK**。重複判定 `checkDuplicate`(import.go:293-294)も同じ `steps[0].MoveID` を starter として `CheckDuplicate` へ渡すため、取込時 starter と重複検出 starter が一致。import 後 combo は常に starter==先頭となるため VAL-C03(starter≠先頭 WARNING)は構造的に発火せず正規化として機能。実 DB 往復 `TestExportRoundTripAndDuplicateSkip` で重複検出一致を確認。
- レガシー「保存 starter≠先頭」の先頭正規化の明示 → **軽微(§10)**。実装上は先頭再導出で正規化される(データ破壊でない)が、progress-log の記述は「先頭から導出」に留まり「レガシー starter≠先頭が先頭へ正規化される」旨の明示は弱い。指示書 §3.4-1 が求めた明記としては軽微に不足。コード挙動は正しい。

### §1.5 code→id・重複・タグ(指示書 §3.4-2/3/5)

- `character_code`→id / `move_code`→id 解決、存在しない code の扱いが VAL-I06/I07 と整合し Plan Mode 確定どおり → **OK**。`lookup.go` resolver、VAL-I06 = ERROR 除外(csvimport.go:39-42)、VAL-I07 = WARNING で move_id NULL(csvimport.go:140-143 + import.go:366-369 で未解決時 MoveID nil)。progress-log の確定(I06=ERROR / I07=WARNING)と一致。`TestImportUnknownMoveNullified`・`TestCodeLookupValidation` で担保。
- 重複動作 = skip(既定)+ 新規追加の 2 択、上書き非実装、`check-duplicate` 再利用 → **OK**。`types.go:46-49` `DupSkip`/`DupAdd` のみ(overwrite 定数なし)。`commitOneCombo`(import.go:198)が skip 判定、add は `comboSvc.CheckDuplicate` 経由の既存 API 再利用。add の真重複は Create が VAL-C02 ERROR で弾く(`TestImportAddDuplicateFails`)。
- タグ name(+user スコープ)既存解決 / 無ければ新規作成(color 既定)、空 name は WARNING → **OK**。`tagResolver.resolve`(import.go:410-445)、空 name は紐付け対象外 + VAL-T02 WARNING(csvimport.go:110-114 / `TestEmptyTagNameWarning`)。`TestImportNewComboCreatesWithTags` で新規作成確認。

### §1.6 検証・無害化(DES-006 §6/§7.4)

- NFR103 検証(VAL-I01〜I09)が preview で機能、行数上限 1000(5000 と非混同)→ **OK**。`csvcore/rules.go:9` `DefaultMaxRows = 1000`(コメントで movesimport 5000 との別を明記)。VAL-I01 サイズ(`TestSizeLimit`)・I02 UTF-8(`TestInvalidUTF8`、setup 側も対称)・I03 行数(`TestRowLimit`)・I04 カラム(`TestMissingColumn`/`buildHeaderIndex`)・行単位型(parse.go 厳密化)・I06/I07 code 存在・I09 サマリ(`Summary`)を確認。
- CSV 無害化(描画エスケープ・式注入ガード `= + - @`・再 export `'` 接頭辞・URL 非リンク化)→ **OK**。式注入ガードは `csvcore/sanitize.go`(export 時 `'` 付与 / import 時対称剥がし)。memo / setup name・description に適用(csvexport.go:100,114,115)。`TestFormulaTriggersAllSanitized` が 4 トリガ全てで往復同一性を確認。tags/recipe/situation は JSON 始まりセルのため式評価対象外(sanitize.go 冒頭で論拠明示)。URL 非リンク化 = フロントが React 既定エスケープのみで `dangerouslySetInnerHTML`・データ由来 `href` を一切使わない(grep で確認、preview/report は Badge/TableCell のテキスト描画)→ 自動リンク化されない。統合元 verbatim に本体側で無害化を付加済み。

### §1.7 DES 直接編集の禁止

- 製造担当が DES-002/005/006 を直接編集していないか → **OK**。`git log -- docs/design/02|05|06` の直近編集は docs コミット(`a5ccd51`「M13-02完了時の資料修正等」・`2cfec46`「M13-01開始前ドキュメント整理」)で、M13-01 の製造コミット(`9a8ba59`/`be72b9e`/`8d1744b`/`e0258cf`/`e385b2d`/`799fe12`)は DES 本体を触っていない。CHANGE-050/051 が `docs/change-notes/` に存在。

---

## §2 API 整合性

- preview / commit のレスポンス型分離 → **OK**。`dto.go` に `previewResponse`(行検証結果)と `commitResponse`(行単位レポート)を別建て。流用なし。
- commit 成功後 `["combos"]` invalidate → **OK**。`api.ts:121-123` `qc.invalidateQueries({ queryKey: ["combos"] })`(既存規約準拠)。
- 成功/部分成功/失敗のステータスコード契約がテストで担保 → **軽微(§10)**。ハンドラはファイル全体拒否時 400(`badRequest`)、行レベルは 200 + レポートで一貫しているが、`internal/api/comboio/` に `*_test.go` が無く HTTP ステータスの httptest 単体テストが不在(CLAUDE.md §5 ハンドラ層「正常系+主要異常系」方針に対し未整備)。サービス層統合テスト(8 ケース)と E2E(happy path)が実質カバーしており持ち越し許容。

---

## §3 フロントエンドの動作仕様(指示書 §4.7)

- 画面13 エクスポート(対象選択 全/フィルタ/選択/マイコンボ・CSV・ZIP 1 ファイル DL)新設・router 登録・Header 導線 → **OK**。`ComboExportPage.tsx`、`router.tsx:38`、`Header.tsx:25`。`useExportCombo`→`triggerDownload(blob,"combomgr-export.zip")`(api.ts:64)。
- 画面14 インポート(コンボ CSV 必須/セットプレイ CSV 任意・チェックボックス既定全チェック・要確認/エラー強調・行単位レポート)→ **OK**。`ComboImportPage.tsx`。既定全チェック(`init[r.localId]=r.importable`、:56-57)、強調 `bg-amber-50`(:227)、レポート section(:327-373)。
- プレビューが CSV 値を式/コマンド解釈せず描画エスケープ → **OK**。全て JSX テキスト束縛(`{r.characterCode}` 等)、`dangerouslySetInnerHTML` 不使用。
- 既存 shadcn/ui 踏襲 → **OK**。`@/components/ui/{button,input,label,checkbox,badge,table}` を再利用、自作再発明なし。

## §4 テストの妥当性

### §4.1 バックエンド(Go test)

- export 往復(ZIP 生成→ import で DeepEqual / local_id・parent 紐付け / drive_damage 小数 / oki nil-false / starter 先頭再導出 DuplicateKey 一致)→ **OK**。csvcore `TestRoundTrip`(DeepEqual・全要素網羅)+ `TestSetupRoundTrip` + 実 DB `TestExportRoundTripAndDuplicateSkip`(zip→再 import→重複検出)。
- import preview(VAL-I01〜I09 各 / 式注入セル / code→id)→ **OK**。`TestSizeLimit`/`TestInvalidUTF8`/`TestRowLimit`/`TestMissingColumn`/`TestFormula*`/`TestCodeLookupValidation`/`TestEmptyTagNameWarning`。
- import commit(skip/add 各・上書き非対象 / タグ既存・新規・空 name / setplay 親解決・親失敗スキップ / 部分成功 / 冪等)→ **OK**。service_test の `TestImportNewComboCreatesWithTags`/`TestImportSetupParentResolution`/`TestImportSetupParentFailureSkipped`/`TestImportPartialSuccess`/`TestImportIdempotentSkip`/`TestImportAddDuplicateFails`。Go 全 19 ケース緑(キャッシュ ok 確認)。
- フィクスチャに統合元ゴールデン行を併用 → **OK**。`goldenCombos()`(csvcore_test.go:17)が local_id / 小数 / nil-false / situation / memo 特殊 / tags / recipe を網羅。

### §4.2 フロント(Vitest)

- 行チェックボックス選択 / 要確認・エラー強調 / 行単位レポート表示 → **一部OK・軽微(§10)**。`types.test.ts` は純粋関数 `rowNeedsConfirmation` の OK/WARNING/ERROR 3 ケースを担保(CLAUDE.md §5「純粋関数=必須」充足)。ただしチェックボックス選択・強調・レポート描画のコンポーネントテスト(Vitest + RTL)は未整備で、指示書 §5.1 Vitest 要件のうち選択/レポート描画は E2E(`combo-csv-io.spec.ts`)側でのみ担保。CLAUDE.md §5「ページは原則テストしない/E2E」に照らせば許容範囲で持ち越し可。

### §4.3 E2E

- コンボ作成→ export(ZIP)→ import(プレビュー→一部除外→実行→レポート)→ 一覧反映 が self-contained → **OK**。`combo-csv-io.spec.ts`。draft 取込で冪等・memo にタイムスタンプで自行同定・seed 非依存。progress-log に devContainer で 1 passed 確認の記録あり。
- 既存 `combo-crud.spec.ts` 非回帰 → **質問(§11)**(コード上判定外)。新規 spec は既存に干渉しない作りだが `make e2e` 全 spec 通過は実機確認領域。progress-log は本 spec の 1 passed のみ言及。

## §5 設計意図との整合

- 統合元 verbatim → 本体側で無害化/検証付加 → **OK**(§1.6)。式注入・型・range・code 存在を本体で厳格化。
- 2 段階(preview 寛容 / commit 厳格)→ **OK**。preview は VAL-T02/C09/I07 等を WARNING で通し(csvimport.go)、commit は `comboSvc.Create` のフルバリデーション(VAL-C02 含む)で弾く(import.go:220-222)。
- 意味単位 export(M14 moves 列変更耐性)→ **OK**(§1.2)。物理列直書きなし・code/recipe 単位。
- starter 再導出 = 正規化であってデータ破壊でない → **OK**(§1.4。明示文言は軽微)。
- コンボ取込(FR405)と moves 取込(FR704)別系統 → **OK**。別パッケージ・別ルート・別画面(`/import/combo` ↔ `/import/moves`)。

## §6 コード品質・規約遵守

- 曖昧語依存の実装判断なし → **OK**。範囲・severity・enum シードを定数化(rules.go)。
- snake_case json ↔ camelCase 整合 → **OK**。csvcore は CSV 専用 snake_case(contract.go コメント明記)、API 境界 `dto.go` は camelCase、サービス層 types は内部 Go 構造体(json タグなし)。§3.4-8 確定どおり DTO 変換層を `dto.go`/`export.go`/`import.go` が担う。
- バックエンド列挙定数とフロント定数の同期 → **OK**(本サブ範囲で新規の永続列挙定数追加なし)。`DupAction`("skip"/"add")はフロント `types.ts:6` と一致、`ExportRange` も一致。`model.TagCategory*` 系の新規追加なし(grep 範囲外の新規導入なし)。
- ファイル分割・命名が既存パターン整合 → **OK**。`api/<domain>` / `service/<domain>` / `service/<domain>/csvcore` のサブパッケージ化は既存構成と整合。

## §7 既存挙動の温存(非破壊性)

- 既存 `ComboResponse` 等公開フィールド不変 → **OK**。comboio は新規パッケージで、既存 combo/tag/setup サービスは公開 IF(`Create`/`Get`/`List`/`CheckDuplicate`/`CreateTag`/`CreateSetup` 等)を**呼ぶのみ**でシグネチャ変更なし。
- movesimport 別系統のまま影響なし → **OK**。参照・改変なし。
- 既存 spec 非回帰 → **質問(§11)**(§4.3 と同様、実機領域)。

## §8 ドキュメント・進捗ログ

- 完了報告に Plan Mode 確定方式・テストケース数・既知の制約を含む → **OK**。progress-log §3183 に 8 項目確定・Go 19/Vitest 3・既知制約(PDF/PNG/クリップボード=M13-02・英語ロケール除外・上書き未実装=CHANGE-051)を記載。
- DES 反映は設計担当が CHANGE-050 で対応(製造担当 DES 非編集)→ **OK**(§1.7)。

---

## §9 重大判定(完了承認を妨げる)— 全基準 非該当

| §9 基準 | 判定 | 根拠 |
|---|---|---|
| Plan Mode 8 項目未確認(推測実装) | **非該当** | progress-log に 8 項目 + 開発者回答(ZIP 配送)を記録。別途の質問書ファイルは未確認だが、確定内容は記録済みで推測実装の痕跡なし。 |
| 既存 API 契約(公開フィールド)変更 | **非該当** | comboio は新規パッケージ、既存サービスは呼出のみ。 |
| CSV 無害化が無く式注入素通し | **非該当** | sanitize.go の `'` ガード + フロント描画エスケープ。`TestFormulaTriggersAllSanitized` で担保。 |
| drive_damage 小数欠落 / oki nil-false 混同 | **非該当** | `*float64` 正準往復・`*bool` nil/false 分離、DeepEqual 往復で確認。 |
| starter 再導出が DuplicateKey 不整合 | **非該当** | 取込 starter と重複検出 starter が同一導出(steps[0].MoveID)。 |
| 全体ロールバック / 部分成功しない / 非冪等 | **非該当** | 行単位 report・失敗行スルー(`TestImportPartialSuccess`)、非 draft は skip 冪等(`TestImportIdempotentSkip`)。※ draft は DES-006 §2.2 により重複対象外で再作成されるが設計どおり(下記注記)。 |
| 上書きをスコープ外で実装 | **非該当** | `DupAction` は skip/add のみ。overwrite 経路なし。CHANGE-051 整合。 |
| FS 書込にユーザ指定パス流入 | **非該当** | export は in-memory ZIP、import 展開は basename のみ参照しメモリ文字列化。FS パス生成なし。 |
| 製造担当が DES 本体を直接編集 | **非該当** | M13-01 製造コミットは DES 未編集。 |

注記(draft 冪等性): is_draft コンボは preview/commit とも重複判定を回避する(`!dto.IsDraft` ガード、import.go:61,198)。再 import で draft は複製され得るが、これは DES-006 §2.2 が draft を VAL-C02 対象外とする仕様に沿ったもので、規約違反の「無秩序増加」ではない。冪等性要件は重複判定対象の非 draft に対して `TestImportIdempotentSkip` で担保済み。E2E が draft を使うのは再実行容易性のための意図的選択。

---

## §10 軽微(持ち越し許容)

1. **preview の親解決が楽観的**: `ParsePreview` は親コンボが「取込可能行のいずれか」であれば `parentResolvable=○` とする(import.go:108、選択状態を知らない段階)。一方 commit は親が実際に選択・作成された場合のみ紐付け、未選択なら setup を skip(+report)する。preview で ○ でも親をチェックボックス解除すると commit で skip される UX 不一致。データ整合性は損なわない(skip + レポート)。視覚/文言の細部に該当。
2. **starter 正規化の明示不足**(§1.4): レガシー starter≠先頭が再 import で先頭へ正規化される旨の報告記述が弱い。コード挙動は正しい。
3. **handler 層の HTTP ステータス単体テスト不在**(§2): `internal/api/comboio/` に httptest がなく、400/200 契約はサービス統合テスト + E2E に依存。
4. **フロントのコンポーネントテスト軽量**(§4.2): 純粋関数 `rowNeedsConfirmation` のみ Vitest 化。選択/強調/レポート描画は E2E 側。CLAUDE.md §5 の方針上は許容。
5. **export 行上限のサイレント打ち切り**: RangeSelected で 1000 件超は `break` で静かに頭打ち(export.go:87)。VAL-I03 と対称だが利用者通知なし。

## §11 質問・確認事項

1. 指示書 §5.2 / §7.3 に対し、`make e2e` 全 spec(`combo-crud.spec.ts` 等)の非回帰はコード上判定不可。progress-log は新規 `combo-csv-io.spec.ts` の 1 passed のみ言及。**全 spec 非回帰の実機確認結果を確認したい**(設計担当/開発者へ)。
2. 軽微 1(preview 親解決の楽観表示)について、UX として preview 時点で「親が未選択になると skip される可能性」を示す改善を将来サブで扱うか、現状(commit レポートで skip 明示)で確定とするかを確認したい。

---

## §12 レビュー完了判定

- **§1〜§8: 全 OK**(各小項目に重大なし。軽微 5 件・質問 2 件は持ち越し許容範囲)。
- **§9 重大: ゼロ**(全 9 基準 非該当)。
- **Plan Mode 8 項目: 確認済み**(progress-log §「Plan Mode 確定方式」に開発者回答含め全 8 項目記録。推測実装なし)。

→ **判定: M13-01 は完了承認可**。軽微(§10)・質問(§11)は後続マイルストーンまたは設計担当確認で持ち越し可能。

## 制約事項

- 本レビューはコード Read による静的判定。Go test は `ok`(キャッシュ)、`go build ./internal/...` 緑を確認したが、`make e2e` 全 spec 非回帰・実ブラウザ DL・実機 UI 操作は別途の動作確認領域(§11-1)。
- 統合元(`autopilot-combomgr/projects/*`)は本環境で未展開のため裏取りは本体コピー後のコードに基づく。

---

*以上、M13-01 レビュー報告書(チェックリスト準拠・第2回)。配置 `docs/progress/phase3/m13-01-review-checklist.md`。初回レビュー `docs/progress/phase3/m13-01-review.md` は上書きしていない。*

---

## 取り込み結果(自動トリアージ・第2回)

> チェックリスト準拠レビュー(本報告書)の自動トリアージ(2026-06-28)。**§9 重大ゼロ**のためエスカレーション不要。軽微 5 件・質問 2 件を以下のとおり処理。

| 指摘 | 区分 | 採否 | 対応 / 理由 |
|------|------|------|-------------|
| 軽微3 handler 層の HTTP ステータス単体テスト不在 | 軽微 | **採用** | **CLAUDE.md §5(ハンドラ層=正常系+主要異常系 httptest 必須)への準拠**。`internal/api/comboio/handler_test.go` を新設(6 ケース): Export 正常〔200/application/zip/Content-Disposition〕・range 不正〔400〕、Preview combo_file 欠落〔400〕・正常〔200/combos+summary〕、Commit 正常〔200・dupAction 既定 skip〕・dupAction=add。mock service で HTTP 契約を単体化。 |
| 軽微2 starter 正規化の明示不足 | 軽微 | **採用** | progress-log の starter 方式に「レガシー starter≠先頭は再 import で先頭へ正規化(VAL-C03 不発・PUT 自動補正と同型・データ破壊でない)」を追記(指示書 §3.4-1 が求めた明記)。 |
| 軽微5 export 行上限のサイレント打ち切り | 軽微 | **採用** | `export.go`: 対象が `exportRowLimit`(1000)に達した場合 `slog.WarnContext` で打ち切りの可能性を記録(no silent caps 原則)。利用者向け UI 通知は将来サブ。 |
| 軽微1 / 質問2 preview 親解決の楽観表示(UX) | 軽微/質問 | **不採用(繰延)** | データ整合は損なわない(commit が未選択親 setup を skip + レポート)。任意数値 ID の実在検証を preview に足すと DB 往復増の割に UX 改善限定的。設計伝達メモ H に記録済み・将来 UX サブ。 |
| 軽微4 フロント component テスト軽量 | 軽微 | **不採用(規約準拠)** | CLAUDE.md §5「フロントページは原則テストしない/E2E」に合致。純粋関数 `rowNeedsConfirmation` は Vitest 化済み、選択/強調/レポート描画は E2E(`combo-csv-io.spec.ts`)で担保。 |
| 質問1 `make e2e` 全 spec 非回帰 | 質問 | **解決済み(確認済)** | 開発者が `make e2e` 実行 → **14 passed + 1 flaky**(`combo-crud.spec.ts` はコールドスタート由来のフレークでリトライ通過=非回帰)。本サブ `combo-csv-io.spec.ts` は 1 passed。Playwright は flaky 通過を成功扱いで run は exit 0。 |

**採用後の検証**: `go build ./...`・`go vet`・gofmt 緑。comboio テスト **19 → 25 ケース**(csvcore 11 + service 8 + handler 6)全通過。全 Go スイート非回帰。「高/重大」指摘ゼロのためエスカレーションなし。
