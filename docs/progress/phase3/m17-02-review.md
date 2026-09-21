# M17-02 レビュー報告書

| 項目 | 内容 |
|------|------|
| 対象指示書 | `docs/instructions/phase3/M17-02-command-index-stage2.md` v1.1.0 |
| チェックリスト | `docs/instructions/phase3/reviews/M17-02-review-checklist.md` v1.1.0 |
| レビュー実施日 | 2026-07-16 |
| レビュー対象コミット | 67db37d(スキーマ+正規化層)・c881bf2(seedgen 拡張+生成マイグレ)・543404a(リポジトリ+サービス+API)・cde0e94(rush is_derived+E2E+完了報告)。CSV 是正は a1ed022(開発者コミット) |
| レビュー時検証 | `go test ./...` 全 PASS(レビュアー実行)・`make e2e` 22 passed / exit 0(レビュアー実行)・既存マイグレ 000001〜000031 非改変(`git diff 9dfc936..HEAD -- migrations/` で機械確認)・製造コミットの DES/web/src 非接触(コミット別 `git show --name-only` で機械確認) |

## 総評

G-k 承認済みの確定判断 6 件(§1.5)がすべて実装へ正確に落ちており、死守 3 契約・index-only・「二度作らない」という本サブの核が構造(データ・パッケージ分割)で強制されている点が優れている。マイグレは既存非改変・生成物 golden 固定・down 整合まで機械担保され、実データ統合テストが空中衝突 3 件(実測での新発見 zangief/flying_body_press 含む)を能動固定している。完了報告は Plan Mode 13 項目の確定・実測をすべて記録し、CHANGE-069 と実物の節番号矛盾(DES-003 §3.13)も自ら検出して設計担当へ申し送っている。重大(§9)に該当する問題はゼロ。指摘はハンドラのログ欠落・語彙カバレッジの latent gap 等の中・低のみで、完了承認を妨げない。

## 設計準拠性レビュー結果

チェックリスト節別評価(◎=完全準拠 / ○=準拠・軽微指摘あり / △=要修正 / ×=違反)。

### §1 死守 3 契約・スコープ — ◎

- **公式表記のみ解決**: `moveindex.normalizeCommand` は §9.9 トークン→numpad 断片の純写像のみで、曖昧入力の吸収・ゆらぎ補正を一切持たない。語彙外トークンは verbatim 通過+unknown 報告(構築時は索引非搭載・クエリ時は自然ミス)で、汚い入力をサポートしない。
- **モーション解析なし**: 方向トークン列のパターンマッチ・時間依存の実装はどこにも無い。解決は `map[token_key]move_code` の決定論ルックアップのみ。
- **出口は move_code**: `CommandIndexResponse.Entries` は `token_key → move_code`。サービス・索引 IF とも move_code 以外を返さない。
- **段階2 スコープ厳守**: `stage2KeyPattern = ^[1-9]?(LP|MP|HP|LK|MK|HK)$` により溜め `[X]`・一回転 `360`・`/`(or)・`>`(chain)・`|`(alt_sep)・`(hold)`・複数方向(236 等)・複数ボタン(+)・強度なし P/K が形状で自動的に落ちる。unit(`TestCommandIndex_ShapeFilter` 9 ケース)・実データ統合(`len(k)>3` 混入検査)・E2E(`entries["236LP"]` undefined+全キー形状検査)の三層で固定。

### §2 index-only(command 列復活なし) — ◎

- `moves` への追加は `is_derived` 1 列のみ(000032)。`command` 列は復活していない(マイグレ・model・SQL を確認)。
- 索引源は専用テーブル `move_commands`(000033)+seed(000035、CSV 由来)。構築主体は M14-03b の `internal/moveindex` そのもの(seedgen は `Index.Add`/`Entries()` を呼ぶだけ)で、skip 規則・正規化を seedgen 側に再実装していない(「二度作らない」遵守)。

### §3 派生技フラグ・非派生のみ索引 — ◎

- `is_derived` は **moves 本体の BOOLEAN 列**(INTEGER NOT NULL DEFAULT 0・`is_aerial`/`setup_only` と同型)=§1.5-1 確定どおり。索引テーブル側フィルタにしていない(000033 に is_derived 列なし)。
- 索引への派生技混入ゼロを `TestRun_M1702_SeedIntegrity` が JOIN で機械検査(want 0)。seedgen 生成時も `moveindex.Add` の skip 規則(derived 最優先)で除外。
- 1:N は `insert` での id 昇順維持+`Lookup` 先頭返却(索引 IF)、解決表側は `MoveID` 最小走査で決定論。実測(完了報告 §1-7)では is_aerial 除外後の残衝突 0=解決表は完全 1:1。

### §3' backfill・rush 版 — ◎

- backfill(000034)は **seedgen 生成**(`GenerateDerivedBackfill`+`-mode derived-backfill`)で手書きでない。**CSV に載る code の列挙のみ UPDATE**(terry 22+guile 40+lily 32+ingrid 20+kimberly 40+juri 25+ken 30+mai 46+zangief 21+ryu 28=304 件、完了報告と一致)=ユーザー生成行に非接触。down は同列挙を =0 へ(000032 直後は全行 0 のため正確な逆操作)。
- 既存マイグレ 000001〜000031 非改変(git diff で機械確認・既存 golden 000026/000030 も全 PASS)。
- **生成マイグレ 1 本につき golden 1 本**: `TestGolden_DerivedBackfillMatchesRegeneration`(000034)・`TestGolden_MoveCommandsMatchesRegeneration`(000035)が byte-identical を固定し、再生成コマンドをコメントに明記。
- `POST /moves/:id/rush-variant` は `insertRushVariantSQL` で `is_derived` を定数 1 で INSERT(§4.7)+既存 201 テストへ DB 直読の検証追記。
- `category=rush_variant` の特例除外は索引構築のどこにも無い(データ側 `is_derived=true` で解決=§1.5-5)。CSV 156 行の rush 是正(a1ed022)は開発者差分承認済み・現 CSV で rush 行の is_derived=false は manon.csv の 15 行のみ(本サブ対象外・開発者指示)であることをレビューでも実測確認。

### §4 段階2 解決サービス=畳んだ解決表 — ◎(解釈 1 点は妥当・下記)

- **BE が畳む**: 規則(is_aerial 除外→category ガード→形状フィルタ→特殊技優先→id 最小)はすべて `service/inputresolve` の Go に一元化。**FE(web/src)は本サブで一切変更なし**(git で機械確認)=規則の TS 二重実装なし。E2E spec 内の形状 regex は契約検証用アサーションであり実装二重化に当たらない。
- **キャラ 1 体分・未 seed 空**: `GET /api/characters/:characterId/command-index` は 1 キャラ分を返し、未 seed・存在しない ID は 200+空(`TestCommandIndex_200_UnseededCharacterIsEmpty`・E2E)。仮データキャラ(c_viper)依存はテストから排除済み(開発者指摘反映)。
- **is_aerial=true 除外**: 畳み込み規則 1 で除外。実データ統合テストが lily/great_spin(2HP)・kimberly/elbow_drop(2MP)・zangief/flying_body_press(2HP)の 3 衝突解消と、ジャンプ通常技がボタン単独キーを奪わないことを能動固定。
- **索引は広く**: `move_commands` に必殺技(236LP 等)・空中技(great_spin '2HP'・jumping_* )が搭載されていることをマイグレ整合テスト・リポジトリテスト・seedgen unit の三箇所で固定(§1.5-6=M17-04 の土台保全)。
- **特殊技優先**: unique/special > normal を畳み段で適用(`TestCommandIndex_SpecialPriority`)。実データでは未発動(衝突 0)だが規則としてテスト固定済み。
- **一様フォールバック**: 方向ゾーンによる経路分岐は BE のどこにも無い。「表に無ければ段階1」は消費者(FE・M17-03)の分岐としてサービスはフォールバックを持たない=§1.5-3 どおり。段階1(FE `inputResolution.ts`)は無変更。
- **曖昧は載せない**: 「意味的に決めきれない組」の具体化=category ガード(normal/unique/special 以外は形状合致でも非掲載、`TestCommandIndex_CategoryGuard`)。特殊技優先+id 最小で必ず 1 件に畳めるため、この解釈で仕様の意図(死守契約のデータ構造強制)は満たされる。指示書 §9.2 の裁量範囲内であり Plan・完了報告 §3 に明示されている=妥当と判定。

### §5 numpad 正規化 — ○

- §9.9 のクラシック 24 トークン(方向 9・charge 3・circle・plus・or・chain・ボタン 8)+テキスト由来の hold/alt_sep を写像。plus は削除+ボタン断片隣接時のみ `+` 挿入(表現の一意化)。30 ケースの語彙テストで固定。再正規化の冪等性(runtime の AddIndexed 済みキーを正準トークン列/numpad 形どちらでも引ける)もテスト済み。
- M14-03b が確保した後付け位置(`Add`/`Lookup` の両方が同一正規化を通る)へ差し込み、既存 IF(Lookup/LookupAll/Skipped/CharKeys)の規約は不変=手戻りなし。skip の文字列マーカ簡易判定は指示書 §4.1 の要求どおり再評価され、「raw{/cond{ は部分文字列判定を維持(cond{…} 内空白対策)+語彙外トークンは正規化後にトークン単位検出」の二段構えへ強化された。
- **軽微**: §1.7 のテキスト由来トークンのうち **`opt_open`/`opt_close` が写像表に無い**。現 CSV 出現 0 件(レビューで実測)のため実害なしで、出現時も skip+記録(fail しない)+seedgen サマリで検出可能だが、意図(段階2 でもM17-04 でも扱わない=非搭載)がコード上に明文化されていない。第二波 seed 前に写像追加 or 非対応コメントの明文化を推奨(推奨修正・低)。

### §6 スキーマ・マイグレ・非波及 — ◎

- 新規連番 000032〜000035 のみ追加・既存非改変(機械確認)。up/down 往復整合をスキーマ(000032/000033)・seed(000034/000035)双方でテスト(件数 304/530・派生混入 0・孤児 0・down 後 0)。`dbtest.Setup` 依存の全テスト PASS(レビュアー実行の `go test ./...` で確認)。
- `moves` への変更は `is_derived` 1 列のみ(Plan Mode 確定どおり)。部分更新(`UpdateFields`)は明示列のみ SET する方式のため、技編集で is_derived が巻き戻る経路も無い。
- **recipe_cache 非波及**: 新規 3 パッケージ(repository/movecommand・service/inputresolve・api/inputresolve)は読取のみで `RecomputeComboCache`・dup/recipe_hash への参照ゼロ(grep で機械確認=構造で担保)。

### §7 DES 反映・失効記述是正 — ○(設計担当側の後続が前提)

- CHANGE-069(v2)は着手前ゲートで起票済み・registry v1.58.0/v1.59.0 に記録済み。DES 本体反映+change-report は実装後三点セット(教訓 D-10 の運用どおり)=本レビュー完了を受けて設計担当が実施する段取り。**製造は DES を直接編集していない**(製造 4 コミットの docs/design 非接触を機械確認。ブランチ上の DES 差分は開発者コミット a1ed022 の CHANGE-068 三点セット分)。
- §7.5 失効記述 2 件(dash・raw_data 退避)は DES-002 に現存することをレビューでも確認(L436 に退避記述残存)=CHANGE-069 三点セットでの同梱是正待ちで整合。
- **節番号矛盾の検出**: CHANGE-069/registry の「DES-003 §3.13 新設」は実物(§3.13=combo_setups 既存)と不一致であり、新設は **§3.14 が正**。完了報告 §5/§6-2 が正しく検出・申し送り済み。設計担当は三点セット時に §3.14 へ反映し、registry の 069 行の記述も是正すること(推奨修正・中=設計担当側タスク)。
- 完了報告が API 形の変更(`{code}` 案→数値 ID・理由付き)を DES-002 §4.2 反映用に明記している点も良い。

### §8 コード品質・ドキュメント — ○

- 禁則表現(「必要に応じて」「適切に」)・「起き攻け」誤字・「DR」略記・簡体字: 新規/変更ファイル全数 grep で検出ゼロ。i18n は FE 変更なしのため非該当。
- JSON タグ camelCase(`characterId`/`entries`)・godoc 全公開シンボル付与・エラー wrap(`fmt.Errorf %w`)・サービス層 ctx 第一引数、いずれも規約準拠。
- 完了報告に Plan Mode 13 項目の確定・実測(§3.3-10/-11/-12 含む)・共通化 IF 仕様・DES 反映要点・乖離事項(索引カバレッジ 631/278→530/306)が揃っている。
- **軽微**: ハンドラの 500 応答でエラーをログ出力していない(下記指摘 1)。

### §0.1 Plan Mode 13 項目 — 確認済み

完了報告 §1 に 13 項目すべての確定・実測が記録されている。1〜3 は G-k 確定判断(§1.5)と一致(索引テーブル物理設計・moves 本体列・正規化写像)。10(rush 現況=156 行 command 空・CSV 是正は開発者承認+差分チェック承認済み)・11(is_aerial 漏れ 0 件=報告不要)・12(condition_ja 非空 1 件・衝突 0=追加規則なし)も記録あり。12 は「非ゼロなら設計担当へ報告」の字義に対し、完了報告 §1-12 への記録が実質の報告となっている(§6 申し送りリストには未掲載=推奨修正・低)。

## 設計準拠性以外の指摘事項

1. **【中】ハンドラ 500 経路のログ欠落**: `internal/api/inputresolve/handler.go` L49 の `StatusInternalServerError` 返却前に `slog.ErrorContext` が無い。既存ハンドラ(例 `internal/api/move/handler.go` L87/L114/L141)は 500 前に必ずログする規約的パターンであり、本ハンドラだけ診断情報が失われる。
2. **【低】エラーメッセージの言語不統一**: 本ハンドラは英語(`"internal server error"`・`"characterId must be a positive integer"`)、既存ハンドラは日本語(`"サーバーエラーが発生しました"`)。FE 消費は M17-03 のため実害は未発生だが、M17-03 でエラー表示に使うなら統一が要る。
3. **【低】`stage2KeyPattern` の `5`(ニュートラル)と FE キー契約の非対称**: DTO コメントの FE 契約は「ニュートラルは数字なし」だが、正規化は `n`→`5` を無条件写像し、パターン `[1-9]` は 5 を許容する。将来 CSV に `n plus p_l` 型の command が入ると解決表に `5LP` が載り FE から永遠に引かれない(現 seed に該当キー 0 件=実測)。パターンから 5 を外すか、`5X` はニュートラル形として `X` へ畳む規則を M17-03 までに確定しておくのが安全。
4. **【低】`moveindex` の id 型**: `entry.id` が `int` で、`LoadIndex` が `int(moveID)`(int64→int)へ縮小変換している。現行 64bit 環境では無害だが、IF として moves.id を受けるなら int64 が素直。
5. **【低】失効コメント**: `internal/repository/move/rush.go` L16 と `queries.go` L31 の「upsertMoveSQL と同じ列順」は、参照先 `upsertMoveSQL` が既に存在しない(過去リファクタで消失した既存負債。今回 rush.go を触った際に is_derived が列順末尾へ加わり、記述の失効度が上がった)。
6. **【情報】manon.csv の rush 15 行は is_derived=false のまま**(本サブ対象外=開発者指示どおり)。完了報告 §6-4 が第二波での取り扱い(seedgen の INSERT への is_derived 直接組込と同時)を正しく申し送っている。第二波 seed 指示書で確実に回収すること。
7. **【情報】command 空の非派生行 2 件**(guile/sonic_blade_od・lily/condor_spire_od)は `command-correction-history.md` で「OD 強度統合により空のまま確定」と記録済み=索引非搭載は意図どおり。

## 推奨修正(優先度別)

- **高(M17完了前に修正必須)**:
  - なし(チェックリスト §9 の重大事項に該当ゼロ)。
- **中(M18着手と並行可)**:
  - 指摘 1: `api/inputresolve` の 500 経路に `slog.ErrorContext` を追加(既存ハンドラのパターンへ統一)。M17-03 で本 API の FE 消費が始まる前が望ましい。
  - 設計担当側: CHANGE-069 三点セットで `move_commands` の新設節を **DES-003 §3.14** とし(§3.13 は combo_setups 既存)、registry 069 行・CHANGE-069 通知書の「§3.13(実物確認済み)」記載を是正する。あわせて API 形(数値 ID・エンドポイント名)と正規化写像の確定形(完了報告 §1-3)・索引カバレッジ現況値(530/306)を DES へ反映する。
- **低(将来対応)**:
  - 指摘 3(`5` キーの契約非対称)を M17-03 の FE キー構築設計時に確定。
  - 指摘 2(メッセージ言語)・指摘 4(id 型)・指摘 5(失効コメント)の掃き取り。
  - `opt_open`/`opt_close` の写像方針(非対応の明文化 or 追加)を第二波 seed 前に確定(§5 指摘)。
  - Plan 実測 12(condition_ja 非空 1 件=ingrid/ca_cosmic_ray)を設計担当への申し送りリスト(完了報告 §6)にも一行明記(§1-12 の記録だけだと三点セット時に見落とし得る)。

## 良かった点

- **確定判断 6 件の構造化実装**: 「曖昧は載せない」「規則は Go に一元化」「索引は広く・絞りは消費者」を、コメントでなくデータ構造とパッケージ境界(index=広い/解決表=狭い、FE 非変更)で強制した。二重実装の芽が構造的に無い。
- **skip 判定の再評価**(指示書 §4.1 の宿題)への回答が的確: cond{…} 内空白のための部分文字列判定維持と、正規化導入で可能になった語彙外トークンのトークン単位検出を「二段構え」として実装・テスト・コメントの三点で残した。
- **ユーザー DB 耐性のある seed 形**: 000035 の INSERT…SELECT…JOIN(code 突合)は、先行リリース済みユーザー DB で seed 済み move が欠けていても黙って欠落するだけで起動不能を招かない(教訓 D-1 に整合)。backfill も UPDATE 列挙で非対称性(削除との違い)を正しく捉えている。
- **実データでの能動固定**: 空中衝突 3 件(Plan 実測での新発見 zangief/flying_body_press 含む)を統合テストで固定し、「実測で規則の正しさを裏取りしてからテストで錠を掛ける」運びが一貫している。仮データキャラ依存の排除(開発者指摘の即時反映)も良い。
- **乖離の自己申告**: DES-003 節番号矛盾・索引カバレッジ乖離・API 形変更の三つを完了報告で明示的に設計担当へエスカレーションしており、pattern-D(doc 追従漏れ)の予防線が張られている。
- **seedgen の誤爆防止設計**: 新モードは `-chars`/`-out` 必須(000026 への誤出力防止)・`-note` 単独指定拒否など、生成系 CLI の運用事故を先回りで塞いでいる。

## 制約事項

- 本レビューはコード上で判定可能な範囲のみ対象。実際の動作確認・パフォーマンス(NFR001 の実測)・実機テストは別途実施が必要。
- レビュアーは `go test ./...`(全 PASS)と `make e2e`(22 passed)を実行して検証したが、dev サーバでの手動疎通(dev バックエンド再起動後の新 API 確認=完了報告 §6-1)は開発者作業として残る。
- DES 反映(CHANGE-069 三点セット)は設計担当の後続工程であり、本レビューは「段取りの整合」までを確認した。

---

## 取り込み結果(自動トリアージ)

`/implement_plan_full` Phase C(2026-07-16 実施)。**優先度「高」の指摘はゼロ**のためエスカレーション対象なし。

| # | 指摘 | 優先度 | 採否 | 理由・対応 |
|---|------|--------|------|-----------|
| 1 | ハンドラ 500 経路のログ欠落 | 中 | **採用** | 既存ハンドラ(move 等)の規約的パターンへ統一。`slog.ErrorContext` 追加+500 メッセージを多数派の日本語「サーバーエラーが発生しました」へ変更(指摘 2 の 500 分も同時解消) |
| 2 | エラーメッセージの言語不統一 | 低 | **一部採用** | 500 は #1 で日本語化。**400 は現状維持(英語)**=character ハンドラの同型パラメータ(`gameId must be a positive integer`)と対で、既存にも英語前例あり。FE 表示は error code ベース想定のため、表示文言の統一が要るなら M17-03 で判断 |
| 3 | `stage2KeyPattern` の `5` と FE 契約の非対称 | 低 | **不採用(申し送り)** | 現 seed に `5X` 単独キー 0 件=実害なし。FE キー構築契約の確定は M17-03(UI 設計)の議題であり、根拠なく今規則を変えない。完了報告 §6-7 へ「M17-03 検討事項」として明記済み |
| 4 | `moveindex` の id 型(int vs int64) | 低 | **不採用** | `Add(… id int)` は M14-03b で固定済みの IF 規約=改変は消費者(seedgen)へ波及する。64bit 環境で縮小の実害なし・moves.id が int32 を超える現実性も無い。M17-04 で IF 拡張が要る際に併せて再検討 |
| 5 | 失効コメント(upsertMoveSQL 参照) | 低 | **一部採用** | 本サブで触った `rush.go` のみ是正(存在しない `upsertMoveSQL` への参照を削除)。`queries.go` L31 は本サブ非接触の既存負債のため対象外(スコープ厳守)=改善レーン向けに本表で記録 |
| 6 | `opt_open`/`opt_close` 未写像の意図不明文 | 低 | **採用** | `tokenFragments` の doc コメントへ「意図的に写像しない(出現時は語彙外 skip+記録・方針は第二波 seed で確定)」を明文化 |
| 7 | condition_ja 実測 1 件の申し送りリスト漏れ | 低 | **採用** | 完了報告 §6-6 へ設計担当向けに一行明記(三点セット時の見落とし防止) |
| 8 | DES-003 新設節は §3.14 が正(CHANGE-069 是正) | 中 | **採用(設計担当タスク)** | 製造側の対応なし。完了報告 §5/§6-2 で申し送り済み=設計担当が三点セット時に §3.14 反映+registry/通知書の記載是正 |
| 9 | manon.csv rush 15 行(情報) | 情報 | **対応不要** | 開発者指示どおり対象外。第二波 seed 指示書での回収は完了報告 §6-4 に申し送り済み |
| 10 | command 空の非派生 2 件(情報) | 情報 | **対応不要** | `command-correction-history.md` 記録済みの意図どおり(OD 強度統合) |

取り込みコミット後に `go test ./...`・E2E を再実行し全緑を確認。

*以上、M17-02 レビュー報告書。配置 `docs/progress/phase3/m17-02-review.md`。チェックリスト §12 判定=§1〜§8 OK・§9 重大ゼロ・Plan Mode 13 項目確認済み(1〜3 は G-k 承認付き)。軽微指摘のみ持ち越し可。*
