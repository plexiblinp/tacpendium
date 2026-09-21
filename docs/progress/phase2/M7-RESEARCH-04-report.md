# M7-RESEARCH-04 調査結果レポート

| 項目 | 内容 |
|------|------|
| 対応指示書 | M7-RESEARCH-04 v1.0.0 |
| バージョン | 1.0.0 |
| 実施日 | 2026-06-03 |
| 実施モデル | Sonnet 4.6 |
| 調査担当 | Claude Code セッション |

---

## 0. 結論サマリ(設計担当による事実集約、最初に読む)

### 0.1 削除対象の使用箇所サマリ

- 削除対象 2 シンボルの総ヒット数: コードファイル(Go/TS/SQL/JSON)合計で **47 箇所**
- 領域別内訳:
  - バックエンド Go: 19 箇所(model 2, repository 9, DTO 4, validation 4)
  - バックエンド Go テスト: 4 箇所(validation/combo_test.go)
  - フロント TS: 8 箇所(types.ts 4, combo-list.ts 4)
  - フロント TS コンポーネント: 4 箇所(CompareTable.tsx 2, CompareTable.test.tsx 2)
  - フロント TS テスト(hook): 2 箇所(useCompareCombos.test.tsx)
  - マイグレーション SQL: 2 箇所(000001_init_schema.up.sql)
  - i18n JSON: 4 箇所(ja.json 2, en.json 2)
- 書き込み経路: 存在しない。`CreateInput`(service.go:48-78) にフィールドなし、`buildComboFromInput`(service.go:691-715) でマッピングなし、`UpdateMetadataInput`(repository.go:64-86) にフィールドなし、`UpdateMetadata` SQL (repository.go:583-670) に列指定なし。INSERT SQL(repository.go:209) にはカラム名が含まれるが、バインド引数(repository.go:239)の値は `model.Combo` から取得されており、その値が常に nil であることを確認した。
- 主要な事実:
  1. `drive_gauge_consumed_total` / `sa_gauge_consumed_total` は `migrations/000001_init_schema.up.sql:83-84` で `combos` テーブルに定義され、型はそれぞれ `REAL` / `INTEGER`、NULL 可、インデックスなし。
  2. INSERT を含む全 SELECT クエリ(5 本)でカラムが列挙されているが、INSERT バインド値は常に nil(書き込み経路が存在しない)ため、DB 上のすべての行でこの 2 カラムは NULL のまま。
  3. バリデーション VAL-C06 / VAL-C07 の両関数は最初に nil チェックし、nil なら早期 return しているため、現状は **常にスキップ**される。
  4. コンボ比較画面(CompareTable.tsx:218/226)は削除対象カラムを表示用として参照している。コンボ詳細画面(ComboDetailMetadata.tsx:49/57)は `driveAvailableAtStart` / `saAvailableAtStart` を使用しており、削除対象カラムへの参照はない。
  5. ソート UI の選択肢として `drive_gauge_consumed_total` / `sa_gauge_consumed_total` が combo-list.ts(SORT_FIELD_VALUES) に含まれており、コンボ一覧画面(ComboListFilters.tsx) とマイコンボ画面(MyComboPage.tsx)の両方でドロップダウンに表示されている。

### 0.2 機能影響サマリ

- **ソート機能**: 影響あり(選択肢が存在する)。`SORT_FIELD_VALUES` に `"drive_gauge_consumed_total"` / `"sa_gauge_consumed_total"` が含まれ、ソート UI ドロップダウンに「消費少/消費多」ラベルで表示されている。バックエンド `sortFieldWhitelist`(repository.go:386-387)にも登録されており、API の `sort` クエリパラメータとして受け付ける。DB カラムが常に NULL であるため、このソートを選択しても実質的な並び替えは発生しない(全件が NULL = 同値)。
- **CSV エクスポート**: 影響なし(機能が未実装)。コードベース全体を調査したが、CSV エクスポート機能は実装されていない(バックエンド API ハンドラにも、フロントにも CSV 関連コードが存在しない。`docs/design/` の FR005 は未実装のまま)。
- **コンボ詳細表示**: 影響なし(削除対象カラムは詳細画面では使用されていない)。`ComboDetailMetadata.tsx` はラベル `comboDetail.metadata.driveGauge`(= "ドライブゲージ開始残量")・`comboDetail.metadata.saGauge`(= "SAゲージ開始残量")の下に `driveAvailableAtStart` / `saAvailableAtStart` の値を表示しており、削除対象カラムへの参照はない。
- **コンボ比較画面**: 影響あり。`CompareTable.tsx:218/226` が `driveGaugeConsumedTotal` / `saGaugeConsumedTotal` を `formatDriveGauge` / `formatSAGauge` で表示しており、「ドライブ消費」・「SA 消費」行として比較表に表示される。DB 値は常に NULL のため現状の表示は常に「-」。

### 0.3 バリデーション影響サマリ

- `validateC06DriveConsumption`(validation/combo.go:241-258) は `combo.DriveGaugeConsumedTotal` フィールドを直接参照する。nil チェック(combo.go:247)で常に早期 return する(常に NULL のため)。カラム削除時、この関数内の参照が断ち切られる。
- `validateC07SAConsumption`(validation/combo.go:261-273) は `combo.SAGaugeConsumedTotal` を参照する。同様に nil チェック(combo.go:262)で常に早期 return。
- 両関数は `ValidateComboForCreate`(combo.go:122-123) から `isDraft=false` 時のみ呼ばれる。
- `combo_test.go`(validation)でテスト 4 件(lines 255-294)が `DriveGaugeConsumedTotal` / `SAGaugeConsumedTotal` を手動で非 nil に設定してバリデーション動作を検証している。カラム削除時、これらのテストは `model.Combo` 構造体フィールドへの参照を失う。

### 0.4 削除対象外シンボルとの区別

- grep ヒットのうち削除対象外に該当したものは **0 件**。`drive_gauge_increase` / `super_art_gauge_increase`(ゲージ増加) / `drive_available_at_start` / `sa_available_at_start` / `drive_damage` は今回の 3 系統 grep ではヒットしなかった(§4.4 の除外対象は今回の検索パターンとは語形が異なるため、混同のリスクはなかった)。
- `step_count` は `sortFieldWhitelist` の同一コメント行(repository.go:54)に言及されているが、削除対象外であり、今回の調査対象ではない。

### 0.5 想定外の発見

1. **`formatDriveGauge` / `formatSAGauge` の二重使用**: これら 2 つのユーティリティ関数 (`utils.ts:68-77`) は、削除対象カラム(`CompareTable.tsx` 経由)と削除対象外カラム(`ComboDetailMetadata.tsx`：`driveAvailableAtStart` / `saAvailableAtStart` 経由)の両方で使用されている。削除時に `CompareTable.tsx` の使用箇所を除去しても、`ComboDetailMetadata.tsx` 側の使用は残るため、関数自体は削除対象にならない。
2. **`utils.test.ts` の formatter テストは consumed_total を直接参照しない**: `web/src/features/combo/utils.test.ts:117-126` に `formatDriveGauge` / `formatSAGauge` のテストがあるが、削除対象カラム値を直接テストしているわけではなく、関数の引数に `undefined` / 数値を渡すケースを検証しているのみ。削除後もこれらのテストは変更不要。

### 0.6 明らかな矛盾の事実指摘

1. **i18n キー `comboDetail.metadata.driveGauge` の意味の不整合**: `ja.json:91` の `comboDetail.metadata.driveGauge` は "ドライブゲージ開始残量"(= `driveAvailableAtStart` 表示用)、`ja.json:55` の `comboList.sort.driveGauge` は "ドライブゲージ消費"(= ソートラベル)、`ja.json:160` の `compare.row.driveGauge` は "ドライブ消費"(= CompareTable の行ラベル、`driveGaugeConsumedTotal` 表示用) と、同一キー語 `driveGauge` が 3 つの異なる文脈で異なる意味に使われている。これは削除時の判断に影響する事実として記録する(混同のリスクがある)。
2. **コンボ一覧のソートホワイトリストコメントと `step_count` の非対称**: `ListFilter` コメント(repository.go:54)のホワイトリスト列挙に `"step_count"` が含まれているが、`sortFieldWhitelist` マップ(repository.go:380-388)には `"step_count"` が含まれていない。削除対象カラムとは別の不整合だが、同じコメント行にあるため記録する。

---

## 1. 削除対象 2 シンボルの全使用箇所

### 1.1 横断 grep の全ヒット一覧

以下、コードファイル(Go/TS/SQL/i18n JSON)のみ列挙。ドキュメント類(`docs/`)は §5 関連ドキュメントで記載する。

#### 削除対象シンボル: `consumed_total`(snake_case)

| ファイル | 行番号 | 内容 | 区分 |
|----------|--------|------|------|
| `migrations/000001_init_schema.up.sql` | 83 | `drive_gauge_consumed_total REAL,` | 削除対象 |
| `migrations/000001_init_schema.up.sql` | 84 | `sa_gauge_consumed_total INTEGER,` | 削除対象 |
| `internal/repository/combo/repository.go` | 54 | Sort コメント: `"drive_gauge_consumed_total" / "sa_gauge_consumed_total"` | 削除対象 |
| `internal/repository/combo/repository.go` | 209 | INSERT SQL 列指定 | 削除対象 |
| `internal/repository/combo/repository.go` | 292 | `selectComboByIDSQL` SELECT 列指定 | 削除対象 |
| `internal/repository/combo/repository.go` | 333 | `selectComboByIDAllowDeletedSQL` SELECT 列指定 | 削除対象 |
| `internal/repository/combo/repository.go` | 386 | `sortFieldWhitelist` キー `"drive_gauge_consumed_total"` | 削除対象 |
| `internal/repository/combo/repository.go` | 387 | `sortFieldWhitelist` キー `"sa_gauge_consumed_total"` | 削除対象 |
| `internal/repository/combo/repository.go` | 478 | List クエリ SELECT 列指定 | 削除対象 |
| `internal/repository/combo/repository.go` | 796 | FindActiveByDuplicateKey SELECT 列指定 | 削除対象 |
| `internal/repository/combo/repository.go` | 1032 | `listAllActiveCombosSQL` SELECT 列指定 | 削除対象 |
| `internal/model/combo.go` | 107 | `DriveGaugeConsumedTotal *float64` フィールド | 削除対象 |
| `internal/model/combo.go` | 108 | `SAGaugeConsumedTotal *int` フィールド | 削除対象 |
| `internal/service/validation/combo.go` | 246 | コメント `combos.drive_gauge_consumed_total キャッシュ値で判定する` | 削除対象 |
| `web/src/constants/combo-list.ts` | 6 | `SORT_FIELD_VALUES` 配列要素 `"drive_gauge_consumed_total"` | 削除対象 |
| `web/src/constants/combo-list.ts` | 7 | `SORT_FIELD_VALUES` 配列要素 `"sa_gauge_consumed_total"` | 削除対象 |
| `web/src/constants/combo-list.ts` | 21 | `SORT_FIELD_LABELS` キー `drive_gauge_consumed_total` | 削除対象 |
| `web/src/constants/combo-list.ts` | 22 | `SORT_FIELD_LABELS` キー `sa_gauge_consumed_total` | 削除対象 |
| `web/src/locales/ja.json` | 54 | `"drive_gauge_consumed_total": "ドライブゲージ消費"` | 削除対象 |
| `web/src/locales/ja.json` | 56 | `"sa_gauge_consumed_total": "SAゲージ消費"` | 削除対象 |
| `web/src/locales/en.json` | 54 | `"drive_gauge_consumed_total": "Drive gauge"` | 削除対象 |
| `web/src/locales/en.json` | 56 | `"sa_gauge_consumed_total": "SA gauge"` | 削除対象 |

#### 削除対象シンボル: `ConsumedTotal`(camelCase / PascalCase)

| ファイル | 行番号 | 内容 | 区分 |
|----------|--------|------|------|
| `internal/model/combo.go` | 107 | `DriveGaugeConsumedTotal *float64` フィールド | 削除対象(上掲と同一行) |
| `internal/model/combo.go` | 108 | `SAGaugeConsumedTotal *int` フィールド | 削除対象(上掲と同一行) |
| `internal/api/combo/dto.go` | 151 | `DriveGaugeConsumedTotal *float64 \`json:"driveGaugeConsumedTotal,omitempty"\`` | 削除対象 |
| `internal/api/combo/dto.go` | 152 | `SAGaugeConsumedTotal *int \`json:"saGaugeConsumedTotal,omitempty"\`` | 削除対象 |
| `internal/api/combo/dto.go` | 337 | `DriveGaugeConsumedTotal: combo.DriveGaugeConsumedTotal,` | 削除対象 |
| `internal/api/combo/dto.go` | 338 | `SAGaugeConsumedTotal: combo.SAGaugeConsumedTotal,` | 削除対象 |
| `internal/repository/combo/repository.go` | 239 | INSERT バインド引数 `combo.DriveGaugeConsumedTotal, combo.SAGaugeConsumedTotal` | 削除対象 |
| `internal/repository/combo/repository.go` | 915 | `scanCombo` スキャン `&c.DriveGaugeConsumedTotal, &c.SAGaugeConsumedTotal` | 削除対象 |
| `internal/service/validation/combo.go` | 247 | `if combo.DriveGaugeConsumedTotal == nil { return }` | 削除対象 |
| `internal/service/validation/combo.go` | 251 | `consumed := *combo.DriveGaugeConsumedTotal` | 削除対象 |
| `internal/service/validation/combo.go` | 262 | `if combo.SAAvailableAtStart == nil \|\| combo.SAGaugeConsumedTotal == nil { return }` | 削除対象 |
| `internal/service/validation/combo.go` | 266 | `consumed := *combo.SAGaugeConsumedTotal` | 削除対象 |
| `internal/service/validation/combo_test.go` | 258 | `combo.DriveGaugeConsumedTotal = ptrFloat(10.0)` | 削除対象 |
| `internal/service/validation/combo_test.go` | 268 | `combo.DriveGaugeConsumedTotal = ptrFloat(10.0)` | 削除対象 |
| `internal/service/validation/combo_test.go` | 278 | `combo.SAGaugeConsumedTotal = ptrInt(3)` | 削除対象 |
| `internal/service/validation/combo_test.go` | 289 | `combo.SAGaugeConsumedTotal = ptrInt(3)` | 削除対象 |
| `web/src/features/combo/types.ts` | 62 | `driveGaugeConsumedTotal?: number;`(ComboSummary) | 削除対象 |
| `web/src/features/combo/types.ts` | 63 | `saGaugeConsumedTotal?: number;`(ComboSummary) | 削除対象 |
| `web/src/features/combo/types.ts` | 131 | `driveGaugeConsumedTotal?: number \| null;`(Combo 編集用) | 削除対象 |
| `web/src/features/combo/types.ts` | 132 | `saGaugeConsumedTotal?: number \| null;`(Combo 編集用) | 削除対象 |
| `web/src/features/combo/components/CompareTable.tsx` | 218 | `{formatDriveGauge(c.driveGaugeConsumedTotal)}` | 削除対象 |
| `web/src/features/combo/components/CompareTable.tsx` | 226 | `{formatSAGauge(c.saGaugeConsumedTotal)}` | 削除対象 |
| `web/src/features/combo/components/CompareTable.test.tsx` | 17 | `driveGaugeConsumedTotal: 2` (フィクスチャ) | 削除対象 |
| `web/src/features/combo/components/CompareTable.test.tsx` | 18 | `saGaugeConsumedTotal: 1` (フィクスチャ) | 削除対象 |
| `web/src/features/combo/hooks/useCompareCombos.test.tsx` | 31 | `driveGaugeConsumedTotal: 0` (フィクスチャ) | 削除対象 |
| `web/src/features/combo/hooks/useCompareCombos.test.tsx` | 32 | `saGaugeConsumedTotal: 0` (フィクスチャ) | 削除対象 |

#### `GaugeConsumed` grep ヒット

`GaugeConsumed` の grep ヒットは上記 `ConsumedTotal` ヒットと完全に同一ファイル・同一行の部分集合(すべて `DriveGaugeConsumedTotal` / `SAGaugeConsumedTotal` の形で出現)。追加の独立したシンボルはなし。

---

### 1.2 バックエンド Go の使用箇所

#### 1.2.1 model 層

**`internal/model/combo.go`:**
```
107: DriveGaugeConsumedTotal *float64  `db:"drive_gauge_consumed_total" json:"driveGaugeConsumedTotal,omitempty"`
108: SAGaugeConsumedTotal    *int      `db:"sa_gauge_consumed_total"   json:"saGaugeConsumedTotal,omitempty"`
```
- `model.Combo` 構造体のフィールドとして定義。型はそれぞれ `*float64` / `*int`(ポインタ、NULL 対応)。`omitempty` 付きの JSON タグあり。`db` タグにより sqlx スキャン対象。
- 関連構造体 `ComboSummary` 等は `model.Combo` を経由せず別ファイルに定義されているが、`model` パッケージにはこの 2 カラムを持つ他の構造体は存在しない(0件確認)。

#### 1.2.2 repository 層

**`internal/repository/combo/repository.go`:**

(a) **ソートホワイトリスト**
```
54:  Sort コメント: "default" / "updated_at" / "damage" / "starter_move_id" / "drive_gauge_consumed_total" / "sa_gauge_consumed_total" / "step_count"
380-388: sortFieldWhitelist マップ
  386: "drive_gauge_consumed_total": "drive_gauge_consumed_total",
  387: "sa_gauge_consumed_total":    "sa_gauge_consumed_total",
```

(b) **INSERT SQL**
```
209: drive_gauge_consumed_total, sa_gauge_consumed_total,   (insertComboSQL の列名列)
239: combo.DriveGaugeConsumedTotal, combo.SAGaugeConsumedTotal,  (バインド引数)
```
`InsertCombo` 関数からこの SQL が呼ばれる。バインド値は `model.Combo` のフィールド = 書き込み経路がないため常に nil。

(c) **SELECT SQL(5 本)**
```
292: selectComboByIDSQL           (FindByID 用)
333: selectComboByIDAllowDeletedSQL (FindByIDAllowDeleted 用)
478: List クエリ(動的 fmt.Sprintf 内、List 用)
796: FindActiveByDuplicateKey クエリ(動的 fmt.Sprintf 内)
1032: listAllActiveCombosSQL      (ListAllActiveCombos 用)
```
5 本すべての SELECT クエリに `drive_gauge_consumed_total, sa_gauge_consumed_total` が列挙されている。

(d) **scanCombo スキャン**
```
915: &c.DriveGaugeConsumedTotal, &c.SAGaugeConsumedTotal,
```
`scanCombo` 関数が全 SELECT クエリの結果をスキャンする際に両フィールドをスキャン対象とする。

(e) **UPDATE 系 SQL**: `UpdateMetadata`(repository.go:583) の SET 句に `drive_gauge_consumed_total` / `sa_gauge_consumed_total` は含まれない(UpdateMetadataInput にフィールドなし)。UPDATE 系 SQL での参照は 0 件。

#### 1.2.3 service 層

**`internal/service/combo/service.go`:**
- `CreateInput` 構造体(service.go:48-78): `DriveGaugeConsumedTotal` / `SAGaugeConsumedTotal` フィールドなし。
- `buildComboFromInput`(service.go:691-715): 削除対象フィールドへのマッピングなし。
- `UpdateMetadataInput`(comborepo との型エイリアス、service.go:81): comborepo.UpdateMetadataInput と同型 = フィールドなし(§1.2.2 参照)。
- service.go 全体での `ConsumedTotal` / `consumed_total` grep: 0 件。

#### 1.2.4 DTO・handler 層

**`internal/api/combo/dto.go`:**
```
151: DriveGaugeConsumedTotal *float64  `json:"driveGaugeConsumedTotal,omitempty"`
152: SAGaugeConsumedTotal    *int      `json:"saGaugeConsumedTotal,omitempty"`
337: DriveGaugeConsumedTotal: combo.DriveGaugeConsumedTotal,
338: SAGaugeConsumedTotal:    combo.SAGaugeConsumedTotal,
```
- `ComboResponse` 構造体のフィールドとして定義(lines 151-152)。`omitempty` 付き = nil の場合 JSON に出力されない。
- `toComboResponse` 関数(lines 337-338)で `model.Combo` フィールドから `ComboResponse` へマッピング。
- リクエスト DTO(CreateComboRequest / UpdateMetadataRequest 等)への追加: 0 件(削除対象フィールドは受け取らない)。

**`internal/api/combo/handler.go`:**
- ソートパラメータの受け取り: `sort` クエリパラメータを文字列として受け取り、そのまま `ListFilter.Sort` に設定。`drive_gauge_consumed_total` / `sa_gauge_consumed_total` の文字列リテラルは handler に存在しない(ホワイトリスト検証はリポジトリ層で行う)。
- handler.go 全体での `ConsumedTotal` / `consumed_total` grep: 0 件。

**`internal/api/combo/handler_test.go`:**
- `ConsumedTotal` / `consumed_total` grep: 0 件。

#### 1.2.5 notation・cache 層

**`internal/service/notation/cache.go`:**
- `RecomputeComboCache`(cache.go:50-76): `recipe_cache` のみを更新する。`drive_gauge_consumed_total` / `sa_gauge_consumed_total` への参照なし。
- notation パッケージ全体での `ConsumedTotal` / `consumed_total` grep: 0 件。

**集計ロジックの有無確認:**
- `drive_gauge_consumed_total` を計算・更新する関数は存在しない(RESEARCH-03 と同結論)。

---

### 1.3 フロント TS の使用箇所

#### 1.3.1 型定義

**`web/src/features/combo/types.ts`:**
```
62:  driveGaugeConsumedTotal?: number;     (ComboSummary インターフェース)
63:  saGaugeConsumedTotal?: number;        (ComboSummary インターフェース)
131: driveGaugeConsumedTotal?: number | null;  (Combo インターフェース、編集用)
132: saGaugeConsumedTotal?: number | null;     (Combo インターフェース、編集用)
```
- `ComboSummary`(一覧用): `?:` によりオプショナル定義。
- `ComboDetail`(詳細表示用): `ComboSummary extends` により両フィールドを継承(types.ts:74-78)。types.ts に `ComboDetail` 独自の追加定義はない。
- `Combo`(編集用): `number | null` 形式で定義(lines 131-132)。
- `CreateComboRequest` / `UpdateMetadataRequest` 等の入力型への定義: 0 件。

#### 1.3.2 コンポーネント

**`web/src/features/combo/components/ComboDetailMetadata.tsx`:**
- 削除対象フィールドへの参照: **0 件**。
- `formatDriveGauge(combo.driveAvailableAtStart)`(line 49)・`formatSAGauge(combo.saAvailableAtStart)`(line 57) として `driveAvailableAtStart` / `saAvailableAtStart` を使用。i18n ラベルは `comboDetail.metadata.driveGauge`(= "ドライブゲージ開始残量")・`comboDetail.metadata.saGauge`(= "SAゲージ開始残量")。

**`web/src/features/combo/components/CompareTable.tsx`:**
```
215: labelKey: "compare.row.driveGauge",
218: {formatDriveGauge(c.driveGaugeConsumedTotal)}
223: labelKey: "compare.row.saGauge",
226: {formatSAGauge(c.saGaugeConsumedTotal)}
```
- 比較テーブルの「ドライブ消費」「SA 消費」行として削除対象フィールドを表示に使用。
- i18n キー `compare.row.driveGauge`(ja.json:160 = "ドライブ消費")・`compare.row.saGauge`(ja.json:161 = "SA 消費")がラベルとして使用されている。

その他コンポーネント(`ComboListPage`, `ComboEditorPage`, `ComboDetailPage`, `MyComboPage` 等): `ConsumedTotal` / `consumed_total` の直接参照は 0 件。

#### 1.3.3 ソート・フィルタ・表示列カスタマイズ

**`web/src/constants/combo-list.ts`:**
```
6:  "drive_gauge_consumed_total",   (SORT_FIELD_VALUES 配列)
7:  "sa_gauge_consumed_total",      (SORT_FIELD_VALUES 配列)
21: drive_gauge_consumed_total: { asc: "消費少", desc: "消費多" },  (SORT_FIELD_LABELS)
22: sa_gauge_consumed_total: { asc: "消費少", desc: "消費多" },     (SORT_FIELD_LABELS)
```
- `SORT_FIELD_VALUES` は `as const` タプル型で定義(line 1-8)。`SortField` 型のユニオン型の元になる(line 9)。
- `SORT_FIELD_LABELS` は `Record<SortField, ...>` 型(lines 13-23)。すべての `SortField` のエントリが必須。

**ソート UI 参照箇所:**
- `web/src/features/combo/components/ComboListFilters.tsx:206-211`: `SORT_FIELD_VALUES.map` でドロップダウン選択肢を動的生成。`drive_gauge_consumed_total` / `sa_gauge_consumed_total` の選択肢がコンボ一覧ページのソート UI に表示される。
- `web/src/features/mycombo/components/MyComboPage.tsx:41/66/87/255-263`: `SORT_FIELD_VALUES` から `isSortField` 判定し、`SortField` 型ガードを経由して使用。マイコンボ画面でも同じ定数から選択肢を生成。

**表示列カスタマイズ(`ColumnVisibility`):**
- `ColumnVisibility` インターフェース(combo-list.ts:49-56)と `COLUMN_DEFINITIONS`(lines 67-77)に `driveGaugeConsumedTotal` / `saGaugeConsumedTotal` への参照は 0 件。表示列カスタマイズは削除対象カラムを含まない。

#### 1.3.4 API クライアント

**API クライアント全体:** `consumed_total` / `ConsumedTotal` の明示的な処理は 0 件。フロントは型定義(types.ts)経由で JSON パースを行うのみ。

---

### 1.4 マイグレーション SQL の使用箇所

**`migrations/000001_init_schema.up.sql`:**
```
83:    drive_gauge_consumed_total        REAL,
84:    sa_gauge_consumed_total           INTEGER,
```
- `combos` テーブルの CREATE TABLE 定義(lines 83-84)。コメントは「一覧表示用キャッシュ」(line 81)。
- 型: `REAL`(float64 相当)/ `INTEGER`(int 相当)。制約: なし(NULL 可、DEFAULT なし)。

**インデックス:**
- `drive_gauge_consumed_total` / `sa_gauge_consumed_total` に対するインデックス定義は存在しない(migration:203-231 の全 CREATE INDEX を確認、両カラムへのインデックスなし)。

**`migrations/000001_init_schema.down.sql`:**
- 削除対象カラムへの参照: 0 件(down マイグレーションは `DROP TABLE combos` 相当で個別カラム削除記述なし)。

**後続マイグレーション(000002〜000007):**
- `drive_gauge_consumed_total` / `sa_gauge_consumed_total` への参照: 0 件(seed データ系マイグレーション、combos テーブルへの INSERT/UPDATE なし)。

---

### 1.5 テストの使用箇所

**`internal/service/validation/combo_test.go`:**
```
258: combo.DriveGaugeConsumedTotal = ptrFloat(10.0)   (TestC06_DriveConsumption_Exceeds)
268: combo.DriveGaugeConsumedTotal = ptrFloat(10.0)   (TestC06_DriveConsumption_DraftSkipped)
278: combo.SAGaugeConsumedTotal = ptrInt(3)            (TestC07_SAConsumption_Exceeds)
289: combo.SAGaugeConsumedTotal = ptrInt(3)            (TestC07_SAConsumption_DraftSkipped)
```
テスト関数 4 件: `TestC06_DriveConsumption_Exceeds`(line 255)、`TestC06_DriveConsumption_DraftSkipped`(line 265)、`TestC07_SAConsumption_Exceeds`(line 275)、`TestC07_SAConsumption_DraftSkipped`(line 285)。いずれも `model.Combo` フィールドに直接代入してバリデーション動作を検証する。

**`web/src/features/combo/components/CompareTable.test.tsx`:**
```
17: driveGaugeConsumedTotal: 2,   (makeCombo フィクスチャ)
18: saGaugeConsumedTotal: 1,      (makeCombo フィクスチャ)
```
`ComboDetail` 型を要求する `makeCombo` ヘルパのフィクスチャデータ(line 8-46)。

**`web/src/features/combo/hooks/useCompareCombos.test.tsx`:**
```
31: driveGaugeConsumedTotal: 0,   (makeCombo フィクスチャ)
32: saGaugeConsumedTotal: 0,      (makeCombo フィクスチャ)
```
`makeCombo` ヘルパのフィクスチャデータ(line 25-39)。

**その他テストファイル:**
- `internal/repository/combo/repository_test.go`: 0 件
- `internal/service/combo/service_test.go`: 0 件
- `internal/api/combo/handler_test.go`: 0 件
- `web/src/features/combo/utils.test.ts`: 直接参照 0 件(formatDriveGauge/formatSAGauge 関数をテストするが、引数に consumed_total 値は使用していない)

---

### 1.6 i18n の使用箇所

**`web/src/locales/ja.json`:**
```
54: "drive_gauge_consumed_total": "ドライブゲージ消費"   (comboList.sort セクション)
56: "sa_gauge_consumed_total": "SAゲージ消費"           (comboList.sort セクション)
```
- `comboList.sort.drive_gauge_consumed_total` / `comboList.sort.sa_gauge_consumed_total` として定義。
- 参照箇所: `ComboListFilters.tsx:208` の `t(\`comboList.sort.${v}\`)` で動的に参照される(v = "drive_gauge_consumed_total" / "sa_gauge_consumed_total" 時)。MyComboPage.tsx のソートラベル生成も同様。

**`web/src/locales/en.json`:**
```
54: "drive_gauge_consumed_total": "Drive gauge"   (comboList.sort セクション)
56: "sa_gauge_consumed_total": "SA gauge"         (comboList.sort セクション)
```
- ja.json と同一構造。

**削除対象 i18n キーの参照先コンポーネント:**
- `ComboListFilters.tsx`(ComboListPage 経由)
- `MyComboPage.tsx`

**削除対象ではないが関連する i18n キー(設計担当の判断用に事実記録):**
- `compare.row.driveGauge`(ja.json:160 = "ドライブ消費", en.json:157 = "Drive Gauge"): CompareTable.tsx(line 215)から参照。削除対象カラムの表示行ラベル。
- `compare.row.saGauge`(ja.json:161 = "SA 消費", en.json:158 = "SA Gauge"): CompareTable.tsx(line 223)から参照。削除対象カラムの表示行ラベル。

---

## 2. 機能影響の特定

### 2.1 ソート機能への影響

**DES-005 §5.4 の規定とコード実装の照合:**
- DES-005 §5.4 にはソート対象として「ドライブゲージ消費 / SAゲージ消費」の規定がある。
- コード上では `SORT_FIELD_VALUES`(combo-list.ts:1-8)に `"drive_gauge_consumed_total"` / `"sa_gauge_consumed_total"` が含まれており、ソート選択肢として実装されている。
- `ComboListFilters.tsx:206-211` でドロップダウン選択肢を `SORT_FIELD_VALUES.map` で動的生成するため、**現在の UI にはソート選択肢として「消費少/消費多」が表示される**。
- `MyComboPage.tsx:257-263` でも同様に `SORT_FIELD_VALUES.map` で選択肢を生成。

**バックエンドのソート実装:**
- `sortFieldWhitelist`(repository.go:380-388)に `"drive_gauge_consumed_total"` → `"drive_gauge_consumed_total"` / `"sa_gauge_consumed_total"` → `"sa_gauge_consumed_total"` のマッピングあり。
- API の `sort` クエリパラメータとして `drive_gauge_consumed_total` を受け取ると、`ORDER BY drive_gauge_consumed_total ASC/DESC` が生成される。

**DB カラム値の現状:**
- すべての行で `drive_gauge_consumed_total` / `sa_gauge_consumed_total` は NULL(書き込み経路が存在しない)。
- SQLite で NULL カラムを ORDER BY した場合: NULL は昇順(ASC)では先頭、降順(DESC)では末尾に配置される(SQLite の NULLS FIRST/NULLS LAST 仕様。NULL 同士の順序は非確定)。全行 NULL の場合、「消費少」/「消費多」ソートを選択しても実質的な並び替えは発生しない。

**削除した場合の UI 挙動:**
- `SORT_FIELD_VALUES` から除去 → ドロップダウン選択肢から「ドライブゲージ消費」「SAゲージ消費」が消える。
- `SORT_FIELD_LABELS` は `Record<SortField, ...>` 型のため、`SortField` 型から削除すると型エラーが発生する。
- `sortFieldWhitelist` から除去 → そのキーを `sort` パラメータとして渡しても `"default"` ソートにフォールバックする(repository.go:393-394)。

### 2.2 CSV エクスポートへの影響

**調査結果:**
- バックエンド API ハンドラ(`internal/api/combo/handler.go` 等): CSV 出力処理なし。`text/csv` Content-Type の設定なし。`encoding/csv` のインポートなし。
- フロントエンド: CSV ダウンロード処理なし。
- コードベース全体での `csv` / `CSV` 文字列検索: 結果は `docs/design/` 内のドキュメント 1 件のみ(validation/doc.go のコメント "CSV、LAN モード" は別文脈)。
- **CSV エクスポート機能は現時点で未実装**。削除対象カラムが CSV 出力に含まれるかの問いは、機能が存在しないため該当しない。

### 2.3 コンボ詳細表示への影響

**`ComboDetailMetadata.tsx` の現状:**
- `driveGaugeConsumedTotal` / `saGaugeConsumedTotal` への参照: 0 件。
- 表示値: `formatDriveGauge(combo.driveAvailableAtStart)`(line 49)・`formatSAGauge(combo.saAvailableAtStart)`(line 57)。
- ラベル: `t("comboDetail.metadata.driveGauge")` = "ドライブゲージ開始残量"・`t("comboDetail.metadata.saGauge")` = "SAゲージ開始残量"(ja.json:91-92)。
- **コンボ詳細画面で削除対象カラムは表示されていない**。M7-02 Q10 (X) での変更は実施済みと確認。

**`CompareTable.tsx` の現状:**
- `driveGaugeConsumedTotal`(line 218)・`saGaugeConsumedTotal`(line 226)を表示に使用している。
- 行ラベル: `compare.row.driveGauge`(= "ドライブ消費")・`compare.row.saGauge`(= "SA 消費")。
- DB 値が常に NULL のため、現状の比較表における「ドライブ消費」・「SA 消費」列の表示は常に「-」(formatDriveGauge/formatSAGauge の undefined/null 分岐による)。

---

## 3. バリデーション影響の特定(VAL-C06 / VAL-C07)

**依存構造:**

`validateC06DriveConsumption`(validation/combo.go:241-258):
```go
func validateC06DriveConsumption(r *ValidationResult, combo *model.Combo, steps []model.ComboStep) {
    if combo.DriveAvailableAtStart == nil {
        return
    }
    // M1-03 段階では steps[i].MoveID から drive_gauge_increase を引く専用クエリを持たないため、
    // combos.drive_gauge_consumed_total キャッシュ値で判定する。
    if combo.DriveGaugeConsumedTotal == nil {  // line 247: 削除対象フィールド参照
        return
    }
    available := float64(*combo.DriveAvailableAtStart)
    consumed := *combo.DriveGaugeConsumedTotal  // line 251: 削除対象フィールド参照
    if consumed > available+1.0 {
        r.AddWarning(CodeC06DriveConsumption, "driveAvailableAtStart", ...)
    }
    _ = steps
}
```

`validateC07SAConsumption`(validation/combo.go:261-273):
```go
func validateC07SAConsumption(r *ValidationResult, combo *model.Combo, steps []model.ComboStep) {
    if combo.SAAvailableAtStart == nil || combo.SAGaugeConsumedTotal == nil {  // line 262: 削除対象フィールド参照
        return
    }
    available := *combo.SAAvailableAtStart
    consumed := *combo.SAGaugeConsumedTotal  // line 266: 削除対象フィールド参照
    if consumed > available {
        r.AddWarning(CodeC07SAConsumption, "saAvailableAtStart", ...)
    }
    _ = steps
}
```

**現状の挙動:**
- `DriveGaugeConsumedTotal` / `SAGaugeConsumedTotal` は常に nil のため、VAL-C06 は line 247 で、VAL-C07 は line 262 で早期 return する。両バリデーションは実際には **常にスキップ**される。

**呼び出し箇所:**
- `ValidateComboForCreate`(combo.go:104-133): `isDraft=false` の場合のみ lines 122-123 で呼ばれる。

**カラム削除時のバリデーション関数への影響:**
- `model.Combo` から `DriveGaugeConsumedTotal` / `SAGaugeConsumedTotal` フィールドが削除されると、`validateC06DriveConsumption`(combo.go:247/251)および `validateC07SAConsumption`(combo.go:262/266) 内の参照がコンパイルエラーになる。
- カラム削除は両バリデーション関数自体の削除を必要とする依存関係を持つ。

**関連テスト:**
- `internal/service/validation/combo_test.go` のテスト 4 件(lines 255-294):
  - `TestC06_DriveConsumption_Exceeds`: `DriveGaugeConsumedTotal = ptrFloat(10.0)` 設定(line 258)
  - `TestC06_DriveConsumption_DraftSkipped`: `DriveGaugeConsumedTotal = ptrFloat(10.0)` 設定(line 268)
  - `TestC07_SAConsumption_Exceeds`: `SAGaugeConsumedTotal = ptrInt(3)` 設定(line 278)
  - `TestC07_SAConsumption_DraftSkipped`: `SAGaugeConsumedTotal = ptrInt(3)` 設定(line 289)
- 4 件すべてが `model.Combo` フィールドへの直接代入を行うため、カラム削除時にはコンパイルエラーになる。

---

## 4. 削除対象外シンボルとの区別

今回の 3 系統 grep(`consumed_total` / `ConsumedTotal` / `GaugeConsumed`)において、§4.4 で削除対象外として列挙されたシンボルとの混同ヒットは **0 件**。

| 削除対象外シンボル | 語形 | 今回の grep ヒット |
|-------------------|------|-------------------|
| `drive_gauge_increase`(moves テーブル) | `_increase` 末尾 | 0 件 |
| `super_art_gauge_increase`(moves テーブル) | `_increase` 末尾 | 0 件 |
| `drive_gauge_decrease_punish`(moves テーブル) | `_decrease_` 含む | 0 件 |
| `drive_available_at_start`(combos テーブル) | `_available_` 含む | 0 件 |
| `sa_available_at_start`(combos テーブル) | `_available_` 含む | 0 件 |
| `drive_damage`(combos テーブル) | `_damage` 末尾 | 0 件 |

**補足:** `drive_available_at_start` / `sa_available_at_start` は `ComboDetailMetadata.tsx` で使用されているが、今回の grep パターンとは語形が異なるため、削除対象シンボルとの混同は発生しなかった。`formatDriveGauge` / `formatSAGauge` は削除対象カラムと非削除対象カラムの両方で使用されているが(§0.5 想定外の発見参照)、これらは格納値を参照するコードであり、シンボル名自体の混同ではない。

---

## 5. 関連ドキュメント

| ID | ファイルパス | 本調査との関係 |
|----|-------------|---------------|
| 対応指示書 | `docs/instructions/M7-RESEARCH-04-gauge-consumed-total-removal-impact.md` | 本調査の指示書 |
| 前調査レポート | `docs/progress/M7-RESEARCH-03-report.md` | 本調査の出発点(§1.1.2) |
| データモデル設計書 | `docs/design/03-data-model.md` | §341-342: 削除対象カラム定義、§376-383: キャッシュパフォーマンス対策・自動集計規定 |
| 画面設計書 | `docs/design/05-screen-design.md` | §5.4: ソート対象規定、§5.6: 詳細表示規定 |
| バリデーション設計書 | `docs/design/06-validation.md` | VAL-C06 / VAL-C07 の規定 |
| 補足設計資料 | `docs/design/supp-001-detailed-design.md` | §2.1: 仮登録の NULL 許容ルール |

---

## 6. 調査担当からの完了宣言

本調査(`M7-RESEARCH-04`)は以下の制約を厳守して実施した:

- **read-only 厳守**: コードの変更は一切行わず、`grep` / `find` / `ls` / `Read` による読み取り系操作のみを使用した。本レポートファイルの作成のみが唯一の書き込み操作である。
- **judgement-free**: 削除可否の判断・削除順序の提案・安全性評価は含めていない。観察された事実とコード状態の列挙のみを記録した。
- **全数性**: `consumed_total`(snake_case)・`ConsumedTotal`(camelCase/PascalCase)・`GaugeConsumed`(部分一致)の 3 系統 grep を実施し、ヒット 0 件の領域(notation/cache、handler、service.go 本体、UpdateMetadata SQL、CSV 等)も明示的に「0 件」と記録した。
- **削除対象外との区別**: §4.4 に列挙された削除対象外シンボル(`*_increase` / `*_at_start` / `drive_damage`)との混同なし(0 件確認)。

設計担当および開発者は、本レポートの事実情報を元に CHANGE-019 の起票判断・スコープ確定・M7-04 への組込方法の判断を行うことを前提として、調査を完了する。

*以上、M7-RESEARCH-04 調査結果レポート v1.0.0*
