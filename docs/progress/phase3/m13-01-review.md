# M13-01 レビュー報告書

> レビュー対象: M13-01「コンボ CSV エクスポート/インポート(FR401/405)」
> レビュー実施日: 2026-06-28 / レビュー担当 Claude Code(read-only)
> 対象コミット: `9a8ba59` / `be72b9e` / `8d1744b` / `e0258cf`(feature/m13-01)

## 総評

製造品質は高い。csvcore(往復コア)/ comboio サービス(本体ドメイン接続)/ api(HTTP・DTO 変換)の三層分離が明快で、CHANGE-050 契約・CHANGE-051(skip+add 2 値)・指示書 §3.4 の 8 確定事項にいずれも整合している。型整合(drive_damage `*float64`・oki `*bool` の nil/false 区別・local_id)、VAL-I10 無害化の往復対称性、code→id の遅延キャッシュ、in-memory zip 配送、既存 API 契約の不変性(main.go は配線追加のみ)はいずれも要件どおりで、`go build` / `go vet` も新規パッケージで緑を確認した。

**重点指摘は 2 系統**: (1) セキュリティ堅牢性 — multipart 読み取り・zip 自動展開が **サイズ無制限で全量メモリ展開**してから 10MiB 判定する順序のため、解凍爆弾/巨大アップロードによる DoS 余地が残る(plain multipart は movesimport 既存と同一パターンだが zip は本サブ新設で増幅)。(2) テスト網羅 — §5.1 が明示する VAL-I01(サイズ)/VAL-I02(UTF-8)/式トリガ `+ - @`/空 name タグ/セットプレイ親失敗スキップ等のケースが未カバー。いずれも設計の根幹は満たしており、完了前修正は (1) の上限ハードニングと (2) の主要欠落ケース追加を推奨する。

**注記: レビュー専用チェックリスト `docs/instructions/phase3/reviews/M13-01-review-checklist.md` は不在のため作成されていない。** 本レビューは指示書 §6/§9.4 のレビュー観点・CHANGE-050/051・DES 契約(DES-002 §4.2/§7.6・DES-006 VAL-I01〜I10/C02/C03・DES-005 §5.13/§5.14)を基準に代替実施した。

## 設計準拠性レビュー結果

### starter 再導出(§3.4-1・VAL-C03) ◎
- `toCreateInput` / `checkDuplicate` ともに `steps[0].MoveID` を starter とし、両経路で同一導出(`import.go:293,327`)。重複判定キーと作成入力で starter がぶれない。
- 非技始動(レシピ先頭の move_code 空 or VAL-I07 未知技)は `MoveID` が nil のまま → starter NULL となり妥当。
- export は starter 列を持たず(`contract.go`/`combo.go`)、import 再導出に一本化。VAL-C03(starter=レシピ先頭)と整合。

### 重複動作 skip / add(§3.4-2・CHANGE-051・VAL-C02) ◎
- `DupAction` は `skip`(既定)/`add` の 2 値(`types.go:42-49`)。UI(画面14)も 2 択でラジオ実装(`ComboImportPage.tsx:174-195`)。CHANGE-051 と完全整合。
- draft(`is_draft=true`)は preview・commit とも重複判定の対象外(`import.go:61,198`)。VAL-C02 の本登録限定と一致。
- `add` 時は重複判定を掛けず `combo.Service.Create` に委ね、真の VAL-C02 重複は `ValidateComboForCreate` が `HasError` で弾き当該行 "failed" 化(`service.go:Create` で確認)。冪等性の担保ロジックは妥当。
- △ 軽微: 「add で真の完全重複 → Create が ERROR → failed」の経路は単体テスト未カバー(後述)。

### タグ解決(§3.4-3・VAL-T02) ○
- name(`defaultUserID=1` スコープ)で既存解決、無ければ `tag.Service.CreateTag`。一覧を 1 回だけロードしキャッシュ(`import.go:410-445`)。空 name は紐付け対象外(`continue`)で VAL-T02 WARNING は csvcore 側で既出。設計どおり。
- △ `byName` を **name のみ**でキー化(category/color を無視)。同名異カテゴリのタグが存在すると後勝ちで取り違える余地(単一ユーザー前提では実害小)。低優先。

### セットプレイ別ファイル(§3.4-4・§4.6) ○
- export は親コンボの local_id(`"c1"`,`"c2"`…採番)を `parent_combo_local_id` に対称付与(`export.go:37,164`)。steps はキャッシュ付きで `GetSetup` 取得。
- commit は `resolveSetupParent` で同一バッチ `createdByLocal` 優先→数値なら既存実 ID とみなす(`import.go:279-287`)。親が対象外/未作成なら setup を skip+レポート(`import.go:247-251`)。設計どおり。
- △ preview の `ParentResolvable` は `batchLocals || isNumericID`(`import.go:108`)。**数値だが実在しない既存 ID** でも preview は ○ を表示するが commit では `comboSvc.Get` 失敗で "failed" になる。preview と commit の楽観/厳格の差。低〜中優先(UX 上の予告ずれ)。
- △ セットプレイ親失敗スキップの統合テストが無い(後述テスト網羅)。

### code→id 解決(§3.4-5・VAL-I06/I07) ◎
- VAL-I06(character 不在)= ERROR で行除外(`validate.go:38`)、VAL-I07(move 不在)= WARNING で `move_id` NULL 化(`validate.go:139`, `import.go:366`)。指示書・DES-006 と一致。
- `codeResolver` はキャラ全件プリロード+技をキャラ単位で遅延ロード。未知キャラは空マップをキャッシュして以降を無害化(`lookup.go:88-94`)。実 DB テスト(未知 move NULL 化・未知キャラ ERROR・部分成功)で裏取り済み。

### 行数/サイズ上限(§3.4-6) ◎(一部 △)
- `DefaultMaxRows=1000` / `DefaultMaxBytes=10MiB`(`rules.go:4-12`)。movesimport の 5000 と明確に分離。export 側も `exportRowLimit=DefaultMaxRows` で対称(`export.go:17`)。
- △ VAL-I01(サイズ)/VAL-I02(UTF-8)は **コンボ CSV(`ParseAndValidate`)では実施**するが、**セットプレイ CSV(`ParseSetupsCSV`)は VAL-I02(UTF-8 検証)を欠く**(`validate.go:270-281` は maxBytes と BOM 除去のみ、`utf8.ValidString` 呼び出しなし)。低〜中優先。

### 無害化 VAL-I10(§3.4-7) ◎
- export 時 `sanitizeFreeText` を **memo / setup name / setup description のみ**に適用、import 時 `desanitizeFreeText` で対称剥がし(`sanitize.go`, `csvexport.go:100,114-115`, `validate.go:91,374-375`)。
- **数値セル(drive_damage 等)・JSON セル(tags/recipe/situation)には無害化を適用していない** → 負数 `-6` や JSON の往復同一性が保たれる(`TestRoundTrip` の `fp(-6)` / situation JSON / oki nil-false が DeepEqual で緑)。重点観点の懸念は解消されている。
- 既知の軽微欠陥(ユーザーが意図的に先頭 `'` + 式トリガを入力した稀ケースで往復時に `'` 1 文字が失われる)はコード内コメントで明示済み。低優先。
- frontend は memo 等の自由文を preview 表示せず(キャラ/始動技/警告文字列のみ)、すべて React 既定エスケープのプレーン描画で linkify ライブラリ不使用 → VAL-I08(URL 非リンク化)/描画エスケープを満たす。

### 型整合 §4.9 ◎
- drive_damage `*float64`(REAL・小数 -6〜6・VAL-C13 範囲 ERROR)、oki 6 列 `*bool`(空=NULL/true/false 明示)、local_id 列を契約・DTO・パーサ全層で一貫実装。`parseFloatPtr`/`parseIntPtr` は正準形のみ受理し黙った型強制(`2.0`/`+2`/`1e3`)を弾く(`parse.go`)。小数・nil/false・local_id の往復は `TestRoundTrip` で DeepEqual 検証済み。

### 取り込み単位 / json タグ(§3.4-8・CLAUDE.md §4) ◎
- csvcore へ一体ソースコピー(replace 解消)。csvcore の json タグは CSV 専用 snake_case、API 境界 `internal/api/comboio/dto.go` は camelCase 別建てで変換(`previewResponse`/`commitResponse`)。フロント型 `types.ts` も camelCase で一致。規約準拠。

### export 配送 / import 自動展開 ◎
- `archive/zip` + `bytes.Buffer` の in-memory zip、ディスク一時ファイルなし、`combos.csv → setups.csv` の決定的順序(`export.go:215-236`)。import は zip magic 判定で自動展開し往復対称(`handler.go:146,157-181`)。

### 既存契約の不変性 ◎
- `cmd/combomgr/main.go` の差分は comboio の DI 配線追加と既存変数の抽出のみ。既存 `ComboResponse`/`CreateRequest`/タグ・技・setup API 契約に変更なし。export は `comboSvc.List`/`Get`(Tags は repo が populate 済み・`repository.go:312,511`)を読むのみで副作用なし。

### DB 書込なし(preview) ◎
- `ParsePreview` は `CheckDuplicate`(read-only)と `ListTags` 不使用(tagResolver は commit のみ)で、書込経路なし。preview の DB 無書込を厳守。

## 設計準拠性以外の指摘事項

1. **【セキュリティ/堅牢性・中】multipart・zip のサイズ無制限受領**
   - `readFormFile` は `io.ReadAll(fh.Open())` で上限なし(`handler.go:196-207`)。`echo.BodyLimit` / `http.MaxBytesReader` の適用箇所が `cmd/` `internal/` 全体に存在しない(grep 確認)。10MiB 判定は csvcore が **全量メモリ展開後**に行うため、数 GB のアップロードで OOM/一時ファイル肥大の余地。plain multipart は movesimport(`handler.go:71` 同パターン)と同一の既存挙動。
   - **zip 自動展開は本サブ新設**で、`readZipEntry` も `io.ReadAll`(`handler.go:183-194`)。**解凍爆弾(小さな zip が GB 級に展開)** を 10MiB 判定前にメモリ展開する。エントリ数・解凍後合計サイズの上限なし。zip slip(パストラバーサル)はディスク書込が無いため非該当だが、解凍爆弾は実在リスク。
   - 推奨: ハンドラに body サイズ上限(MaxBytesReader / BodyLimit)を設け、zip エントリは `csvcore.DefaultMaxBytes` で頭打ちした制限付き読み取り(`io.LimitReader`)に変更。

2. **【堅牢性・低〜中】ParseSetupsCSV の VAL-I02(UTF-8)欠落**(上述)。コンボ CSV と非対称。

3. **【スタイル・低】`context.Context` の構造体フィールド保持**: `codeResolver.ctx`(`lookup.go:13`)は Go 標準の非推奨パターン(ctx は引数で引き回すべき)。遅延ロードの実装都合だが、`movesFor(ctx, code)` のように引数渡しが望ましい。

4. **【規約・なし指摘】** `console.log`/`fmt.Println`/`any`/`localStorage`/`dangerouslySetInnerHTML` の混入なし(grep 確認)。エラーは `%w` で wrap、サービス層メソッドは ctx 第一引数、マジック文字列は定数化(列名・ファイル名・上限)。フロント import 順・camelCase・strict も準拠。良好。

## 推奨修正(優先度別)

- **高(M13 完了前に修正必須)**:
  - 指摘1 の **zip 解凍爆弾ガード**(zip エントリの `io.LimitReader` 化 + 全体 body サイズ上限)。新設経路ゆえ本サブで塞ぐのが妥当。
  - §5.1 明示ケースのうち欠落分の最低限補完: **VAL-I01(サイズ超過)/VAL-I02(不正 UTF-8)のファイル拒否**、**式トリガ `+ - @`(現状 `=` のみ)**、**セットプレイ親失敗→スキップ+レポート**。

- **中(M14 着手と並行可)**:
  - 指摘2(ParseSetupsCSV の UTF-8 検証追加)。
  - 空 name タグ(VAL-T02 WARNING)・「add で完全重複→failed」経路の単体テスト追加。
  - preview の `ParentResolvable`(数値だが実在しない既存 ID を ○ 表示)を commit 厳格度に近づける(任意・UX 改善)。

- **低(将来対応)**:
  - 指摘3(codeResolver の ctx 引数化)。
  - tagResolver の name-only キー(同名異カテゴリの取り違え)を name+category キーへ。
  - 先頭 `'`+式トリガ自由文の 1 文字欠落(既知・コメント済み)。

## 良かった点

- **厳密スカラパーサ**(`parse.go`): 正準形のみ受理し `+5`/`2.0`/`1e3` 等の黙った型強制を拒否。再 export での静かな書き換えを構造的に防いでおり、往復同一性への配慮が秀逸。
- **三層責務分離**が明快(csvcore=純シリアライズ/検証、comboio=ドメイン接続、api=HTTP/DTO 変換)。json タグの snake_case↔camelCase 分離も規約どおり。
- **VAL-I10 の適用範囲を自由文セルに限定**し数値/JSON セルを除外した判断が的確で、往復同一性を壊していない。
- **DeepEqual ゴールデン往復テスト**が小数・nil/false 混在・situation JSON・特殊文字 memo・式注入ベクタを 1 行に凝縮しており、回帰検出力が高い。
- **未知キャラの空マップ poisoning**(`lookup.go`)で繰り返し探索を無害化する遅延キャッシュ設計。
- doc コメントが VAL コード・設計書節番号を逐一引用しトレーサビリティが高い。E2E は draft 取込で冪等・self-contained を担保。

## 制約事項

- 本レビューはコード上で判定可能な範囲のみを対象とする。実際の動作確認・パフォーマンス・実機テスト(`make e2e` 含む)・解凍爆弾/巨大アップロード時の実メモリ挙動は別途検証が必要。
- レビュー専用チェックリストが不在のため、指示書 §6/§9.4・CHANGE-050/051・DES 契約で代替した(総評参照)。
- 統合元(`autopilot-combomgr/projects/*`)は git 追跡外のため未参照。本体に取り込まれたコードのみを対象とした。

---

## 取り込み結果(自動トリアージ)

> `/implement_plan_full` Phase C による自動トリアージ(2026-06-28)。人間トリアージ承認を外す代償として採否と理由を事後監査可能化する。**「高」指摘の不採用はゼロ**(=エスカレーション不要)。

| 指摘 | 優先度 | 採否 | 対応 / 理由 |
|------|--------|------|-------------|
| 指摘1 zip 解凍爆弾ガード + body サイズ上限 | 高 | **採用** | `internal/api/comboio/handler.go`: `maxUploadBytes=10MiB` 定数を新設し、`readFormFile`・`readZipEntry` を `io.LimitReader(_, maxUploadBytes+1)` で頭打ち + 超過時エラー。全量メモリ展開前に上限で弾く。 |
| §5.1 欠落: VAL-I01(サイズ)/VAL-I02(UTF-8)拒否 | 高 | **採用** | csvcore に `TestSizeLimit`(VAL-I01)・`TestInvalidUTF8`(VAL-I02・コンボ/セットプレイ両方)を追加。 |
| §5.1 欠落: 式トリガ `+ - @`(現状 `=` のみ) | 高 | **採用** | csvcore に `TestFormulaTriggersAllSanitized`(= + - @ の 4 種を export 付与 + import 剥がしで検証)を追加。 |
| §5.1 欠落: セットプレイ親失敗→スキップ | 高 | **採用** | service に `TestImportSetupParentFailureSkipped`(親 local_id 解決不能 → setup skipped + レポート)を追加。 |
| 指摘2 `ParseSetupsCSV` の VAL-I02 欠落 | 中 | **採用** | `validate.go`: `ParseSetupsCSV` に `utf8.ValidString` 検証(コンボ CSV と対称)を追加。`TestInvalidUTF8` で裏取り。 |
| 空 name タグ・add 完全重複→failed の単体テスト | 中 | **採用** | csvcore `TestEmptyTagNameWarning`(VAL-T02)・service `TestImportAddDuplicateFails`(add で真 VAL-C02 → failed)を追加。 |
| preview `ParentResolvable` が実在しない数値 ID を ○ 表示 | 中 | **不採用(繰延)** | preview は楽観的(往復の対称性表示)、commit が `comboSvc.Get` 失敗で正確に failed 報告するため機能的欠陥でない。任意の数値 ID の実在検証を preview に足すと余計な DB ラウンドトリップが増える割に UX 改善は限定的。将来 UX 改善として申し送り。 |
| 指摘3 `codeResolver.ctx` の構造体フィールド保持 | 低 | **不採用(繰延)** | request スコープの短命オブジェクトで機能的問題なし。`movesFor(ctx, …)` への引数化は純スタイル改善のため将来対応。 |
| tagResolver の name-only キー(同名異カテゴリ) | 低 | **不採用** | タグ解決の同定キーは **name**(DES・§4.5 はタグを name で解決)。category/color は作成時属性であり同定キーでない。単一ユーザー前提で実害なし。仕様どおり。 |
| 先頭 `'`+式トリガ自由文の 1 文字欠落 | 低 | **不採用** | 既知・コード内コメント済み。稀ケースかつ実害軽微。 |

**採用後の検証**: `go build ./...`・`go vet`・gofmt 緑。comboio Go テスト **13 → 19 ケース**(全通過)。全 Go スイート非回帰。フロント(tsc/vitest)は本トリアージで未変更(BE のみの修正)。
