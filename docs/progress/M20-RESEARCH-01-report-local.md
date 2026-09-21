# M20-RESEARCH-01 ローカル調査レポート（D／F）

| 項目 | 内容 |
|---|---|
| 文書ID | M20-RESEARCH-01-report-local |
| 対象軸 | D（`recipe_cache` の実件数と再計算コスト）／F（旧表記と全表示箇所） |
| 実行環境 | ローカル devContainer |
| DB スナップショット時刻 | 2026-08-12T12:47:31Z |
| 調査方法 | 開発 DB の WAL-aware backup に対する SELECT、実コードの `rg` / `view` |
| 変更範囲 | 本レポートと、開発者が明示許可した `docs/progress/progress-log.md` の索引行のみ |

## 0. 結果サマリ

- 開発 DB は `combos` 45 行（有効 39／論理削除 6）、`setups` 14 行（有効 14／論理削除 0）だった。`recipe_cache` 非 NULL は、有効コンボ 39/39 行、有効セットプレイ 14/14 行だった。
- `RecomputePresetCache` が 1 プリセットを再計算すると、現 DB では有効エンティティ 53 行（コンボ 39＋セットプレイ 14）を順番に処理する。対象レシピは合計 215 ステップで、すべて move ステップだった。
- `RecomputePresetCache` は JSON 内の当該 preset key を各行ごとに更新する実装であり、delete → insert ではない。本番コードからの呼出箇所は 0 件だった。
- 非 NULL キャッシュ 53 行はすべて有効な JSON で、全行が 5 preset key を持っていた。調査した 265 表示文字列のうち、全 `moves.code` 928 種のいずれかをそのまま含むものは 0 件だった。
- 265 表示文字列を現在の DB と `resolver.go` の規則から再構成して比較したところ、不一致は 0 件だった。
- TypeScript 本番対象 232 ファイルに `recipe_cache` / `recipeCache` / `RecipeCache` の直接参照は 0 件だった。フロントは API 投影の `defaultRecipe` または確定反撃 API の `recipe`、詳細画面は専用 recipe API の `text` を読む。
- `defaultRecipe` を JSON に含めるルートは 12 組あった。うちコンボの POST/PATCH/PUT はフィールドを返すが、サービスが `DefaultRecipe` を抽出せず `FindByID` 結果を直接返すため、ルートの成功レスポンスでは空文字になる実装だった。

## 1. 調査基準と全数性

### 1.1 DB の取り扱い

- 原本: `/home/node/.local/share/combomgr/combomgr.db`
- 原本 main DB: 688,128 bytes、mtime `2026-08-10 05:56:54.774142775 +0000`
- 原本 WAL: 288,432 bytes、mtime `2026-08-10 06:19:22.194777178 +0000`
- Python 標準 `sqlite3.Connection.backup` を read-only URI 接続から実行し、`/tmp/m20-research-01.VdjahW/combomgr.db` にコピーした。原本に SQL 書込みは行っていない。
- コピーの `PRAGMA integrity_check` は `ok`、`schema_migrations` は `version=68, dirty=0` だった。

### 1.2 grep / 比較の母数

| 検査 | 検査した単位 | 件数 |
|---|---:|---:|
| Go 本番ファイル | `internal/`・`cmd/` の非 `*_test.go` | 152 ファイル |
| TypeScript 本番対象 | `web/src` の `.ts` / `.tsx`（非 `*.test.*`） | 232 ファイル |
| `moves.code` 照合 | `moves` 1,653 行から得た distinct code | 928 種 |
| キャッシュ JSON | 非 NULL の combo/setup 行 | 53 行 |
| キャッシュ表示文字列 | 53 行 × 各 5 preset key | 265 値 |
| 現行 resolver との再構成比較 | 上記キャッシュ表示文字列 | 265 値 |

A／B／C／E は §0.5 の環境割当および開発者指示により調査していない。web 側レポートも読んでいない。

## 2. 軸 D — `recipe_cache` の実件数と再計算コスト

### D-1. `combos` / `setups` の行数

**実態**

| テーブル | 論理削除を除く | 論理削除を含む | 論理削除行 |
|---|---:|---:|---:|
| `combos` | 39 行 | 45 行 | 6 行 |
| `setups` | 14 行 | 14 行 | 0 行 |

基準時点は DB スナップショット `2026-08-12T12:47:31Z`。論理削除の判定は `deleted_at IS NULL / IS NOT NULL` で行った。

**契約・正典との差**

- `SUPP-001` §7 は実件数を規定していないため、件数に関する差はない。

**後続スコープへの含意**

- D-292 が扱う有効行の母数は 53 エンティティ（39 combo＋14 setup）である。

**推奨**

- なし。§0.3 の judgement-free 制約により設計判断は行わない。

### D-2. `recipe_cache` 非 NULL 行数

**実態**

| テーブル / 状態 | 全行 | 非 NULL | NULL | 空文字 |
|---|---:|---:|---:|---:|
| `combos` 全体 | 45 | 39 | 6 | 0 |
| `combos` 有効 | 39 | 39 | 0 | 0 |
| `combos` 論理削除 | 6 | 0 | 6 | 0 |
| `setups` 全体 | 14 | 14 | 0 | 0 |
| `setups` 有効 | 14 | 14 | 0 | 0 |
| `setups` 論理削除 | 0 | 0 | 0 | 0 |

53 件の非 NULL 値はすべて JSON として parse でき、各 JSON は 5 key を持っていた。壊れた JSON は 0/53 行だった。

**契約・正典との差**

- 論理削除コンボ 6/6 行が NULL である事実は `SUPP-001` §7.2 の `DeleteComboCache` と一致する。
- 有効セットプレイ 14/14 行が非 NULL である事実は `SUPP-001` §7.5 の案 X と一致する。

**後続スコープへの含意**

- F12-2 の保存済みキャッシュ母数は 53 JSON 行、265 preset 別表示値である。

**推奨**

- なし。§0.3 の judgement-free 制約により設計判断は行わない。

### D-3. `RecomputePresetCache` の実装と 1 プリセット当たりの対象

**実態**

- 実装は `internal/service/notation/cache.go:94`。
- 最初に `comboRepo.ListAllActiveCombos` を呼び、`deleted_at IS NULL` のコンボを列挙する。現 DB では 39 行。
- コンボ 1 行ごとに既存 JSON を map へ展開し、`ComputeSingleCache(comboID, presetID)` を 1 回呼び、当該 key を上書きし、`UpdateRecipeCache` で `combos.recipe_cache` を 1 回 UPDATE する。
- 次に `setupRepo.ListAllActiveSetups` を呼び、`deleted_at IS NULL` のセットプレイを列挙する。現 DB では 14 行。
- セットプレイ 1 行ごとに `ComputeSingleSetupCache(setupID, presetID)` を 1 回呼び、当該 key を上書きし、`UpdateRecipeCache` で `setups.recipe_cache` を 1 回 UPDATE する。
- したがって現 DB で 1 preset を処理するループ単位は 53 エンティティ、compute 呼出し 53 回、recipe_cache UPDATE 53 回である。
- 有効コンボの対象ステップは 152 行、有効セットプレイは 63 行、合計 215 行。215/215 行が move ステップ、非技ステップは 0/215 行だった。
- `ComputeSingleCache` / `ComputeSingleSetupCache` は各エンティティの steps を取得し、`resolveRecipe` が step 単位でエイリアスを解決する。move step は現 DB で 215 個ある。
- `RecomputePresetCache` 全体を囲む transaction はない。途中の UPDATE でエラーが返ると、それ以前の行の UPDATE は残る実装である。
- 既存 JSON の `json.Unmarshal` の戻り値は確認していない。壊れた JSON の場合は空 map のまま当該 key を追加して UPDATE する実装である。

**契約・正典との差**

- `SUPP-001` §7.1 は「当該プリセットの recipe_cache 全エントリを delete → insert」と記載する。実装は combo/setup のインライン JSON key を 1 行ずつ UPDATE し、DELETE / INSERT は実行しない。
- `SUPP-001` v1.13.0 が求める combo＋setup の両方を対象にする点は実装と一致する。

**後続スコープへの含意**

- D-292 の eager 処理量の現物は、53 行の逐次 compute＋UPDATEと、215 move step の解決である。
- transaction 非使用と壊れた JSON の扱いは、同関数の現在の更新境界として後続実装が読む事実である。

**推奨**

- なし。eager / lazy の選択は行わない。

### D-4. `ResolveComboRecipe` / `ResolveSetupRecipe` のキャッシュヒット条件

**実態**

`ResolveComboRecipe`（`internal/service/notation/cache.go:16`）:

1. `FindPresetByID` で preset の存在を先に検証する。
2. `GetRecipeCache` で JSON を取得する。
3. cache が非 NULL・非空文字で、JSON parse に成功し、10 進文字列化した `presetID` key が存在すると、その value を返して再計算しない。
4. key の value が空文字でも key が存在すればヒットとして返す。
5. JSON 不正または key 不在なら `ComputeSingleCache` を実行する。更新失敗は warning に留め、計算結果自体は返す。

`ResolveSetupRecipe`（`internal/service/notation/setup_resolver.go:31`）:

1. `GetRecipeCache` で JSON を取得する。
2. cache が非 NULL・非空文字で、JSON parse に成功し、`presetID` key が存在すると、その value を返して再計算しない。
3. JSON 不正または key 不在なら `ComputeSingleSetupCache` を実行する。更新失敗は warning に留め、計算結果自体は返す。
4. combo 版にある事前の `FindPresetByID` は setup 版にはない。

**契約・正典との差**

- `SUPP-001` §7.1 と `DES-004` §5.2 の「ヒット時は返す／ミス時は計算・保存」という遅延計算の記述と一致する。
- combo と setup の preset 存在検証の非対称は `SUPP-001` §7.1 には記載されていない。

**後続スコープへの含意**

- F-1 の読み書き契約には「有効 JSON＋key 存在」が現在のヒット条件として含まれる。
- setup の preset 存在検証は combo と同じ条件ではない。

**推奨**

- なし。非対称を変更するかは本調査では決定しない。

### D-5. `RecomputePresetCache` の呼出元全数

**実態**

- 152 本の Go 本番ファイルを検索した結果、`RecomputePresetCache(` の本番ヒットは interface 宣言 `internal/service/notation/service.go:32` と実装定義 `internal/service/notation/cache.go:94` の 2 箇所だった。
- 宣言・定義を除く本番呼出箇所は 0 件だった。
- テスト内には実呼出し 2 箇所（`cache_test.go`、`setup_resolver_test.go`）と mock 定義 1 箇所がある。
- `internal/service/preset/` に存在するのは `doc.go` だけで、`create.go` / `update_aliases.go` / `delete.go` は存在しない。
- `DeletePresetCache` も本番では interface 宣言と実装定義だけで、呼出箇所は 0 件だった。

**契約・正典との差**

- `SUPP-001` §7.2 にある `preset/create.go` → `RecomputePresetCache`、`preset/update_aliases.go` → `RecomputePresetCache`、`preset/delete.go` → `DeletePresetCache` は、3 ファイルとも現コードに存在せず、3 経路とも本番呼出し 0 件だった。
- 表にない本番呼出元も 0 件だった。

**後続スコープへの含意**

- D-292 の 53 行 eager 実装は存在するが、現時点の本番プリセット API から到達する呼出経路はない。

**推奨**

- なし。後続でどの経路を配線するかは決定しない。

## 3. 軸 F — `recipe_cache` の旧表記と全表示箇所

### F-1. `moves.code` がそのまま固定化されたキャッシュ

**実態**

- 検査対象は非 NULL cache 53 行、JSON 内の表示文字列 265 値、`moves` 1,653 行から得た distinct `moves.code` 928 種。
- 文字列を `" > "` で step segment に分け、segment が code と完全一致する場合、および code の直後に flags (`" {"`)・notes (`" ("`) が続く場合を数えた。
- raw code segment を含む表示文字列は 0/265 値、raw code segment occurrence は 0 件だった。
- 補助検査として code の単純部分一致も全 265 値 × 928 種で確認し、ヒットは 0/265 値だった。
- したがって最大 20 件の実例は 0 件で、列挙対象はない。
- 現在の DB の presets / aliases / steps / modifiers と `resolver.go` の fallback・flag・notes 規則から 265 値を再構成した比較でも、不一致は 0/265 値だった。

**契約・正典との差**

- `DES-004` §5.3 の 3 段目 fallback 自体は実装に存在するが、このスナップショットの保存済み cache にはその出力が 0 件だった。
- 現行 resolver との差も 0 件だった。

**後続スコープへの含意**

- followup F12-2 の現 DB における raw `moves.code` 固定化の母数は 0/265 表示値である。

**推奨**

- なし。再生成の要否は本調査では決定しない。

### F-2. `recipe_cache` の読取箇所と表示面

**実態 — Go**

raw cache の主な読取経路は次のとおり。

| 層 | ファイル | 読取内容 |
|---|---|---|
| notation | `internal/service/notation/cache.go` | combo cache hit、preset 全行再計算・削除 |
| notation | `internal/service/notation/setup_resolver.go` | setup cache hit |
| combo repository | `internal/repository/combo/repository.go` | 一覧・詳細等の scan、`GetRecipeCache` |
| setup repository | `internal/repository/setup/repository.go` | 一覧・詳細・候補・親 combo 別の scan、`GetRecipeCache` |
| punish repository | `internal/repository/punish/queries.go` / `scan.go` | `c.recipe_cache` を `PunishEntry.RecipeCache` へ投影 |
| combo service | `internal/service/combo/service.go:305,319` | `DefaultRecipe` 抽出（詳細・一覧） |
| setup service | `internal/service/setup/service.go:532,569,606,652,678` | 候補・一覧・親 combo 別・詳細の `DefaultRecipe` 抽出 |
| punish finder | `internal/service/punishfinder/service.go:202,312` | `model.ExtractDefaultRecipe` で `recipe` へ投影 |
| punish list | `internal/service/punishlist/service.go:261` | `model.ExtractDefaultRecipe` で `recipe` へ投影 |

**実態 — TypeScript / 表示面**

- 232 本の TypeScript 本番対象ファイルを検索し、raw identifier `recipe_cache` / `recipeCache` / `RecipeCache` のヒットは 0 件だった。
- `defaultRecipe` は非 `*.test.*` 14 ファイルでヒットした。このうち `export-test-helpers.ts` は 5 本のテストからだけ import される test helper なので、runtime/type 経路は 13 ファイルだった。

| 面 | 実コード上の消費経路 |
|---|---|
| 一覧 | `ComboTableRow.tsx` が combo `defaultRecipe`、`SetupTreeRow.tsx` が setup `defaultRecipe`、`HomePage.tsx` が最近の combo `defaultRecipe` を表示 |
| 詳細 | `ComboDetailRecipe.tsx` が専用 `GET /api/combos/:id/recipe` の `text` を表示。埋込 setup は `SetupAccordionItem.tsx`、`SetupCandidateList.tsx`、`LinkExistingSetupModal.tsx` が `defaultRecipe` を表示 |
| 比較 | `AddComboToCompareModal.tsx` と `CompareTable.tsx` が combo `defaultRecipe`、`CompareTable.tsx` が setup `defaultRecipe` を表示 |
| 編集 | combo recipe 本体は `ComboEditor.tsx` の steps を使い、`defaultRecipe` の直接参照は 0 件。combo 編集内の setup 選択は `SetupRegistrationSection.tsx` / `SetupSelectorModal.tsx` が setup `defaultRecipe` を表示。`SetupEditorPage.tsx` も `defaultRecipe` の直接参照は 0 件 |
| エクスポート | `features/combo-io/export-model.ts` が combo と setup の `defaultRecipe` をレシピ列・表示名 fallback に使用 |
| 確定反撃 | Go が cache を `recipe` に投影し、`PunishTree.tsx` と `PunishList.tsx` が表示 |
| セットプレイ | 一覧・詳細・候補・既存紐付け・比較・combo 編集内選択の各 component が setup `defaultRecipe` を表示 |

**契約・正典との差**

- `combos.recipe_cache` / `setups.recipe_cache` が `json:"-"` で raw JSON をフロントへ出さず、`defaultRecipe` / `recipe` / recipe endpoint の `text` に投影する点は `code-facts` §8 と一致する。
- `SUPP-001` §7.4 は combo 一覧の `defaultRecipe` を記載する。実コードでは一覧以外に詳細・各 mutation 応答・setup 系・候補系にも投影される。

**後続スコープへの含意**

- cache 表記変更の表示影響面は、一覧・詳細・比較・combo 編集内 setup 選択・エクスポート・確定反撃・セットプレイ表示に存在する。
- combo/setup 編集の recipe editor 自体は steps を使い、保存済み `defaultRecipe` を直接描画しない。

**推奨**

- なし。表示面の変更方針は決定しない。

### F-3. `defaultRecipe` 経由で露出する API

**実態**

`json:"defaultRecipe"` を持つ `ComboResponse` / `SetupSummary` / `SetupResponse` / `SetupCandidateSummary` のハンドラと routes を突合した。該当する method＋path は 12 組。

| # | API | `defaultRecipe` の位置 |
|---:|---|---|
| 1 | `POST /api/combos` | root combo、同梱時は `setups[]` |
| 2 | `GET /api/combos` | `items[].defaultRecipe` と `items[].setups[].defaultRecipe` |
| 3 | `GET /api/combos/:id` | root combo と `setups[]` |
| 4 | `PATCH /api/combos/:id` | root combo |
| 5 | `PUT /api/combos/:id` | root combo |
| 6 | `POST /api/combos/:id/restore` | root combo |
| 7 | `POST /api/combos/:comboId/setups` | setup root |
| 8 | `GET /api/setups` | `items[]` |
| 9 | `GET /api/setups/:id` | setup root |
| 10 | `PATCH /api/setups/:id` | setup root |
| 11 | `GET /api/combos/:comboId/setup-candidates` | `items[]` |
| 12 | `GET /api/setups/candidates` | `items[]` |

別経路として `GET /api/combos/:id/recipe?preset_id=X` は `defaultRecipe` ではなく `{comboId, presetId, text}` を返し、`ResolveComboRecipe` を直接通る。

追加で確認した実装上の値:

- `GET /api/combos`、`GET /api/combos/:id`、restore は combo service の `List` / `Get` が cache key `"1"` を抽出する。
- POST create、PATCH metadata、PUT key change は、cache 再計算後の `FindByID` 結果を `toComboResponse` へ渡すが `model.Combo.DefaultRecipe` を設定しない。そのため JSON field は存在するが root `defaultRecipe` は空文字になる。
- setup 系の上記 API は `buildResponse` / list / candidate 経路で cache key `"1"` を抽出する。

**契約・正典との差**

- `SUPP-001` §7.4 が明記する一覧 API 以外にも、11 route-method 組が `defaultRecipe` を返す。
- combo mutation 3 経路は field の型は同じだが、GET/List と値の組立経路が異なる。

**後続スコープへの含意**

- default preset の cache 表記は 12 API 組へ投影される。専用 recipe API は任意 preset の cache hit / lazy compute 経路を別に持つ。

**推奨**

- なし。mutation response の値を変更するかは決定しない。

### F-4. `recipe_cache` の無効化・再計算箇所

**実態**

宣言・定義を除く本番呼出文を数えた。

| 関数 | 本番呼出文 | 呼出元 |
|---|---:|---|
| `RecomputeComboCache` | 4 | combo create、キー変更編集の新 combo、restore、materialize |
| `DeleteComboCache` | 2 | キー変更編集の旧 combo、combo 論理削除 |
| `RecomputeSetupCache` | 3 | setup create、combo 同時登録内 setup create、steps を変更する setup update |
| `DeleteSetupCache` | 1 | setup 論理削除 |
| `RecomputePresetCache` | 0 | 宣言・定義のみ |
| `DeletePresetCache` | 0 | 宣言・定義のみ |

補足:

- combo metadata update は再計算を呼ばない。
- setup metadata-only update は再計算を呼ばない。
- physical delete は行自体を削除するため inline `recipe_cache` 用の Delete 関数を呼ばない。
- `RecomputePresetCache` と `DeletePresetCache` の実装自体は combo と setup の両方を処理する。

**契約・正典との差**

- combo/setup の create・recipe update・logical delete・restore（実装済み範囲）は `SUPP-001` §7.2 の責務表と概念上一致する。ファイル構成は表の分割ファイルではなく各 `service.go` に統合されている。
- preset create/update/delete の 3 経路は D-5 のとおり本番呼出し 0 件で、責務表と一致しない。
- setup restore は `SUPP-001` で将来実装とされ、現コードにも呼出しはない。

**後続スコープへの含意**

- 現在の cache lifecycle は combo/setup 自身の変更には配線済みで、preset 変更側だけ本番経路が存在しない。

**推奨**

- なし。後続配線の形は決定しない。

## 4. 想定外の発見・明らかな契約差

1. `RecomputePresetCache` は現 DB で 53 行を更新する実装を持つが、本番呼出元は 0 件だった。
2. `SUPP-001` §7.1 の delete → insert という記述に対し、実装は inline JSON を行単位で UPDATE する。
3. `RecomputePresetCache` は transaction を使わず、既存 cache JSON の unmarshal error も確認しない。
4. `ResolveComboRecipe` は preset 存在を cache 読取前に検証するが、`ResolveSetupRecipe` は同じ検証を持たない。
5. `defaultRecipe` を返す API は一覧だけでなく 12 route-method 組あり、combo mutation 3 経路は root field が空文字になる組立経路だった。

## 5. M20 サブ分割・D-292・F12-2 のための要決定事項

本節は決定ではなく、設計卓が判断するときに使う実測事実の集約である。

1. **D-292 の実測量**: 有効 53 エンティティ、215 move step。`RecomputePresetCache` は 1 preset につき 53 compute＋53 UPDATE を逐次実行する。本番呼出元は 0 件。
2. **保存済み旧表記**: 53 cache JSON、265 表示値を検査し、raw `moves.code` は 0 件。現行 resolver との不一致も 0 件。
3. **preset lifecycle**: `SUPP-001` にある create/update/delete の 3 呼出元は未実装で、Recompute/Delete とも production caller は 0 件。
4. **更新境界**: preset 全行再計算は transaction を使わず、途中エラー時に先行 UPDATE が残る実装。
5. **API/表示波及**: `defaultRecipe` は 12 API 組、表示面は一覧・詳細・比較・編集内 setup 選択・エクスポート・確定反撃・セットプレイ。詳細の main recipe は専用 recipe API を使う。
6. **API 組立の非対称**: combo GET/List/restore は `defaultRecipe` を抽出し、POST/PATCH/PUT は field を空文字で返す。setup 系は抽出する。

P-30 と `alias_text` 一意制約は web 環境担当の A/B 軸であり、本レポートでは扱わない。

## 6. 完了確認

- D-1〜D-5、F-1〜F-4 を実値で記録した。
- 0 件の報告には検査母数を併記した。
- 数字には単位と基準時点を併記した。
- DB 原本への書込み、コード・マイグレーション・seed・テストの変更、Git 書込み操作は行っていない。
- 実装テストは実行していない。本調査は SELECT と静的読取で完了した。
- 判断・設計結論は含めていない。
- `docs/progress/progress-log.md` への索引追記は、§6 DoD と §2.2 の衝突に対する開発者の明示許可に基づく。

## ■ 併せて更新が要るもの

なし。CHANGE、マイグレーション、設計書本体の更新は本 read-only 調査では行わない。
