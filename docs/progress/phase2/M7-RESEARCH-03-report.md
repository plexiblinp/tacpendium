# M7-RESEARCH-03 調査結果レポート

| 項目 | 内容 |
|------|------|
| 対応指示書 | M7-RESEARCH-03 v1.0.0 |
| バージョン | 1.0.0 |
| 実施日 | 2026-05-30 |
| 実施モデル | Opus 4.6（開発者ご判断により昇格）|
| 調査担当 | Claude Code セッション |

## 0. 結論サマリ（設計担当による事実集約、最初に読む）

### 0.1 指摘 1 軸（ゲージ消費表示）の結論

- 製造担当の所見「ComboDetailMetadata.tsx のコードは正しい」の真偽: **部分的真**
  - フロント側の表示ロジック自体は正しく動作する（値があれば表示、nil/undefined なら "-" 表示）
  - ただし、表示項目が DES-005 §5.6 item 2 の規定と異なる（後述 §1.3）
- 原因領域の特定: **バックエンドキャッシュ計算**
  - `drive_gauge_consumed_total` / `sa_gauge_consumed_total` を combo_steps から集計して保存するロジックが **実装されていない**
  - DES-003 §383 は「コンボ登録・編集時に combo_steps から自動集計して保存する」と規定しているが、対応するコードが存在しない
  - DB カラムは存在し（000001_init_schema.up.sql）、SELECT / INSERT SQL にも含まれるが、INSERT 時に渡される値が常に nil → DB には NULL が保存される
  - JSON タグ `omitempty` により NULL 値は API レスポンスから除外 → フロントでは undefined → "-" 表示
- 主要な事実:
  - `CreateInput` 構造体に `DriveGaugeConsumedTotal` / `SAGaugeConsumedTotal` フィールドが存在しない（service.go:48-78）
  - `buildComboFromInput()` でこれらの値がマッピングされていない（service.go:686-710）
  - `RecomputeComboCache()` は `recipe_cache` のみを扱い、ゲージ消費値の計算を含まない（notation/cache.go:50-76）
  - VAL-C06 / VAL-C07 はこれらの値を参照するが、nil の場合は早期 return でバリデーションをスキップする（validation/combo.go:247-248, 262）

### 0.2 指摘 6 軸（SetupTreeRow 仮実装）の結論

- 現状実装の状態: **完全仮実装**
  - `SetupTreeRow` は Props に `colSpan: number` のみを受け取り、i18n テキスト「紐付くセットプレイはありません」を表示するのみ
  - セットプレイデータの受け取り・表示ロジックは未実装
- M4-01 期間由来の真偽: **部分的真**
  - SetupTreeRow は **M1-05**（fe02008, 2026-05-05）で作成。初期コメントに「M4 でセットプレイデータ取得実装が来たら本データを描画する」と明記
  - M4-03（d2f369d, 2026-05-19）でそのコメントが削除されたが、描画ロジックは変更なし
  - M4-01 指示書にはフロント側 UI は「M4-02 で実装」と明記されているが、M4-02 ではコンボ**詳細画面**でのセットプレイ展開が実装され、コンボ**一覧画面**の展開行は対象外だった
- 主要な事実:
  - List API（GET /api/combos）はセットプレイ情報を返さない（handler.go:158-227）
  - Get API（GET /api/combos/:id）のみがセットプレイを埋め込む（handler.go:128-149、案 B1）
  - 展開アイコン（ChevronDown/ChevronRight）は全コンボ行に無条件で表示される
  - DES-005 §5.4 は「コンボ行の直下にインデント付きでセットプレイを表示」+ 各セットプレイのレシピ表示を規定

### 0.3 想定外の発見

1. **DES-005 §5.6 item 2 と ComboDetailMetadata.tsx の表示項目不整合**: DES-005 §5.6 item 2 は「ダメージ、**ドライブゲージ開始残量**、**SAゲージ開始残量**」を規定しているが、ComboDetailMetadata.tsx は「ダメージ、**ドライブゲージ消費**、**SAゲージ消費**」を表示している。i18n キー `comboDetail.metadata.driveGauge` = "ドライブゲージ消費"、`comboDetail.metadata.saGauge` = "SAゲージ消費"。表示対象が「開始残量」（available_at_start）ではなく「消費量合計」（consumed_total）になっている。
2. **VAL-C06 / VAL-C07 が実質的に無効**: `DriveGaugeConsumedTotal` / `SAGaugeConsumedTotal` が常に nil のため、これらのバリデーションルールは nil チェックで早期 return し、実質的に一度も警告を発しない状態にある。VAL-C06 のコメント（validation/combo.go:245-246）にも「M1-03 段階では steps[i].MoveID から drive_gauge_increase を引く専用クエリを持たないため、combos.drive_gauge_consumed_total キャッシュ値で判定する」と記述されている。

### 0.4 明らかな矛盾の事実指摘

1. **DES-003 §383 の規定と実装の不整合**: DES-003 §383「これらのキャッシュ値はコンボ登録・編集時に combo_steps から自動集計して保存する」という規定に対し、自動集計ロジックが実装されていない。`recipe_cache` は `RecomputeComboCache()` で計算・保存されるが、`drive_gauge_consumed_total` / `sa_gauge_consumed_total` には対応する計算関数が存在しない。
2. **DES-005 §5.6 item 2 と実装の乖離**: §5.6 item 2 は「ドライブゲージ開始残量、SAゲージ開始残量」（`drive_available_at_start` / `sa_available_at_start`）を規定しているが、ComboDetailMetadata.tsx は `driveGaugeConsumedTotal` / `saGaugeConsumedTotal`（消費量合計）を表示している。一方、DES-005 §5.7 (b) では「ゲージ消費」がメタデータ編集対象として言及されており、§5.6 と §5.7 の間にも表記の不統一がある。
3. **DES-005 §5.4 とコンボ一覧の展開行の乖離**: §5.4 は展開時に各セットプレイのレシピを表示する規定だが、実装はプレースホルダーテキストのみ。

---

## 1. 指摘 1 軸: ドライブ/SA ゲージ消費表示の調査結果

### 1.1 フロント側の現状

#### 1.1.1 ComboDetailMetadata.tsx の現状

- **ファイルパス**: `web/src/features/combo/components/ComboDetailMetadata.tsx`
- **Props 型定義**: `ComboDetailMetadataProps = { combo: ComboDetail }` — ComboDetail は ComboSummary を継承（types.ts:73-77）
- **ゲージ消費の表示ロジック**:
  - 49 行: `{formatDriveGauge(combo.driveGaugeConsumedTotal)}` — i18n ラベル `comboDetail.metadata.driveGauge` = "ドライブゲージ消費"
  - 57 行: `{formatSAGauge(combo.saGaugeConsumedTotal)}` — i18n ラベル `comboDetail.metadata.saGauge` = "SAゲージ消費"
- **フォーマット関数**（utils.ts:68-77）:
  - `formatDriveGauge`: value が undefined/null なら "-"、それ以外は `toFixed(1)` で小数 1 桁（.0 は除去）
  - `formatSAGauge`: value が undefined/null なら "-"、それ以外は `String(value)`
- **条件付き表示**: なし。常に表示エリアが存在し、値がなければ "-" と表示される
- **データソース**: Props 経由で親コンポーネントから受け取り

#### 1.1.2 親コンポーネントの呼び出し方

- **呼び出し元**: `web/src/pages/ComboDetailPage.tsx` 107 行: `<ComboDetailMetadata combo={comboQuery.data} />`
- **データ取得**: `useCombo(id)` フック経由で `GET /api/combos/:id` を呼び出し
- **Props への受け渡し**: `comboQuery.data` を丸ごと渡している。フィールドの加工・フィルタリングなし

#### 1.1.3 型定義 + API レスポンス受け取り

- **ComboSummary**（types.ts:62-63）: `driveGaugeConsumedTotal?: number;` / `saGaugeConsumedTotal?: number;`（オプショナル）
- **Combo**（編集用、types.ts:130-131）: `driveGaugeConsumedTotal?: number | null;` / `saGaugeConsumedTotal?: number | null;`
- **ComboDetail**（types.ts:73-77）: ComboSummary を継承。これらのフィールドはオプショナルのまま継承される
- **API レスポンスパース**: `web/src/features/combo/api.ts` で取得した JSON をそのまま型に割り当てる方式。snake_case → camelCase 変換は行わない（バックエンド JSON タグが camelCase のため不要）
- **JSON レスポンスでの挙動**: バックエンド model.Combo の JSON タグが `omitempty` であるため、値が nil のフィールドは JSON レスポンスに含まれない → フロントでは `undefined` になる

### 1.2 バックエンド側の現状

#### 1.2.1 GET /api/combos/{id} のレスポンス構造

- **ハンドラ**: `internal/api/combo/handler.go` Get 関数（111-152 行）
- **呼び出し経路**: handler.Get → service.Get → repo.FindByID
- **レスポンス DTO**: `ComboResponse`（dto.go:151-152）に `DriveGaugeConsumedTotal *float64 \`json:"driveGaugeConsumedTotal,omitempty"\`` と `SAGaugeConsumedTotal *int \`json:"saGaugeConsumedTotal,omitempty"\`` が存在
- **変換関数**: `toComboResponse`（dto.go:337-338）で model.Combo から直接マッピング
- **DB クエリ**: `selectComboByIDSQL`（repository.go:292）で `drive_gauge_consumed_total, sa_gauge_consumed_total` を SELECT している
- **スキャン**: `scanCombo` 関数内で `&c.DriveGaugeConsumedTotal, &c.SAGaugeConsumedTotal` にスキャン（repository.go:915）

#### 1.2.2 コンボ登録時のキャッシュ計算ロジック

- **サービス層 Create**（service.go:161-254）:
  - `buildComboFromInput(input)` でモデルを組み立てるが、`DriveGaugeConsumedTotal` / `SAGaugeConsumedTotal` はマッピング対象外（service.go:686-710 の `buildComboFromInput` 関数に該当フィールドなし）
  - `CreateInput` 構造体（service.go:48-78）にも `DriveGaugeConsumedTotal` / `SAGaugeConsumedTotal` フィールドが存在しない
  - `notationSvc.RecomputeComboCache()` が呼ばれるが、これは `recipe_cache` のみを扱う（notation/cache.go:50-76）
- **リポジトリ層 InsertCombo**（repository.go:226-251）:
  - INSERT SQL に `drive_gauge_consumed_total, sa_gauge_consumed_total` が含まれる（repository.go:209）
  - `combo.DriveGaugeConsumedTotal, combo.SAGaugeConsumedTotal` をバインドしている（repository.go:239）
  - 上記の通り `buildComboFromInput` でこれらが設定されないため、nil が渡される → DB には NULL が INSERT される
- **集計ロジック**: combo_steps から `drive_gauge_increase` / `sa_gauge_increase` を集計する関数は存在しない。`RecomputeComboCache` に相当するゲージ計算関数が存在しない

#### 1.2.3 コンボ編集時のキャッシュ再計算ロジック

- **PATCH（メタデータ編集）**: `UpdateMetadata`（repository.go:583-667）の動的 SET 句に `drive_gauge_consumed_total` / `sa_gauge_consumed_total` は含まれていない。これらのカラムは PATCH では更新されない
- **PUT（キー変更編集）**: `UpdateWithKeyChange`（service.go:397-545）は `buildComboFromInput` を使うため、Create と同様にこれらの値は nil
- **フロント側 UpdateMetadataRequest**（types.ts:177-188）: `driveGaugeConsumedTotal` / `saGaugeConsumedTotal` フィールドが存在しない。PATCH リクエストでこれらの値を送信する機能がない

#### 1.2.4 DB マイグレーション + テーブル定義

- **マイグレーション**: `migrations/000001_init_schema.up.sql` 83-84 行:
  - `drive_gauge_consumed_total REAL,` — 浮動小数点、NULL 許容、DEFAULT なし
  - `sa_gauge_consumed_total INTEGER,` — 整数、NULL 許容、DEFAULT なし
- **追加マイグレーション**: これらのカラムに関する追加マイグレーションは存在しない（000002〜000007 は seed データのみ）

#### 1.2.5 実データの確認

本調査ではアプリケーション実行 + DB アクセスは行っていない。コード分析から、全コンボの `drive_gauge_consumed_total` / `sa_gauge_consumed_total` は NULL であると推定される（値を書き込むコードパスが存在しないため）。

### 1.3 DES-005 §5.6 表示規定との整合

- **DES-005 §5.6 item 2**（05-screen-design.md:259 行）: 「ダメージ、ドライブゲージ**開始残量**、SAゲージ**開始残量**」
  - ここで規定されているのは `drive_available_at_start` / `sa_available_at_start`（開始残量）であり、`drive_gauge_consumed_total` / `sa_gauge_consumed_total`（消費量合計）ではない
- **ComboDetailMetadata.tsx の実装**: `driveGaugeConsumedTotal` / `saGaugeConsumedTotal`（消費量合計）を表示している
  - i18n ラベルも「ドライブゲージ消費」「SAゲージ消費」で、「開始残量」ではない
- **DES-005 §5.7 (b)**（05-screen-design.md:290 行）: 「ダメージ、**ゲージ消費**、起き攻め情報、knockdown_advantage、タグ、メモなどのメタデータ」とあり、「ゲージ消費」がメタデータ編集対象として言及されている
- **DES-005 §5.4 ソート対象**（05-screen-design.md:249 行）: 「ドライブゲージ消費、SAゲージ消費」がソート対象として規定されている

### 1.4 git log / git blame で経緯確認

- **ComboDetailMetadata.tsx**: M1-05（fe02008, 2026-05-05）で新規作成。M3-02（1f40ba7）でタグ表示追加。ゲージ消費表示は M1-05 初版から存在
- **model/combo.go**: `DriveGaugeConsumedTotal` / `SAGaugeConsumedTotal` フィールドは初期スキーマ（000001_init_schema.up.sql）から存在
- **notation/cache.go**: 全コミット履歴を通じてゲージ消費計算は含まれていない

### 1.5 特記事項

1. **DES-003 §383 の「自動集計」規定が未実装**: `recipe_cache` には `RecomputeComboCache()` が存在するが、`drive_gauge_consumed_total` / `sa_gauge_consumed_total` には対応する自動集計関数が存在しない。DES-003 §376-383 では `step_count` / `drive_gauge_consumed_total` / `sa_gauge_consumed_total` / `recipe_cache` の 4 つを並列にキャッシュとして規定しているが、実装されているのは `step_count`（service.go:185 `combo.StepCount = len(steps)`）と `recipe_cache`（`RecomputeComboCache`）の 2 つのみ
2. **集計に必要な技テーブルのゲージ情報**: DES-003 §376-383 は combo_steps からの集計を規定するが、各ステップのゲージ消費量は `moves` テーブルの属性に依存する可能性がある（VAL-C06 コメントに「steps[i].MoveID から drive_gauge_increase を引く専用クエリを持たない」と記載）。現状の `moves` テーブルに `drive_gauge_increase` / `sa_gauge_increase` 等のカラムが存在するかは本調査では未確認（指示書スコープ外のため追加調査が必要な場合は設計担当判断）
3. **DES-005 §5.6 item 2 の「開始残量」vs 実装の「消費量」**: これは表示対象そのものの食い違いであり、単純な表示バグとは性質が異なる。§5.7 (b) の「ゲージ消費」と §5.6 item 2 の「開始残量」のどちらを詳細画面で表示すべきかは設計判断に属する

---

## 2. 指摘 6 軸: SetupTreeRow 仮実装の調査結果

### 2.1 SetupTreeRow コンポーネントの特定 + 現状

- **ファイルパス**: `web/src/features/combo/components/SetupTreeRow.tsx`
- **コンポーネント名**: `SetupTreeRow`（default export）
- **Props 型定義**: `SetupTreeRowProps = { colSpan: number }` — セットプレイデータを受け取る Props は存在しない
- **描画内容**:
  ```tsx
  <tr className="bg-slate-50">
    <td colSpan={colSpan} className="px-4 py-2 pl-12 text-sm text-slate-500">
      └ {t("comboList.setupPlaceholder")}
    </td>
  </tr>
  ```
  - i18n テキスト `comboList.setupPlaceholder` = "紐付くセットプレイはありません"（ja.json:70 行）
  - 常に同一テキストを表示。セットプレイデータの有無に関わらず固定
- **データ取得経路**: 未実装。内部 useQuery もなく、Props 経由でもデータを受け取らない
- **スタイル定義**: `bg-slate-50`（行背景）、`pl-12`（左インデント）、`text-sm text-slate-500`。`└` 文字でインデント表現

### 2.2 呼び出し元（コンボ一覧画面）の状態

- **呼び出し元**: `web/src/features/combo/components/ComboTable.tsx` 133-138 行
- **展開状態管理**: `useState<Map<number, boolean>>`（ComboTable.tsx:42 行）。`toggleExpand` 関数で Map を更新（ComboTable.tsx:44-49 行）
- **展開アイコン**: ComboTableRow.tsx 68-81 行。`ChevronDown`（展開中）/ `ChevronRight`（折りたたみ中）を lucide-react から使用
  - DES-005 §5.4 の表示例は `▼` / `▶` だが、実装は lucide-react アイコン（実質同等の視覚表現）
- **展開アイコンの表示条件**: **無条件で全行に表示**。セットプレイの有無による表示制御なし
  - DES-005 §5.4 は展開アイコンの表示条件を明示的には規定していないが、表示例ではセットプレイが紐付いているコンボのみ展開アイコンを示している
- **展開時の描画ロジック**（ComboTable.tsx:132-138 行）:
  ```tsx
  {expanded.get(combo.id) && (
    <SetupTreeRow colSpan={...} />
  )}
  ```
  - セットプレイの有無に関わらず同一の SetupTreeRow を描画
- **展開状態の保持**: React の useState。コンポーネントのアンマウント（ページ遷移等）で状態は消失。DES-005 §5.4 の「ブラウザセッション内で保持」は、コンポーネントがマウントされている間のみ有効

### 2.3 バックエンド側のデータ取得経路

- **List API（GET /api/combos）**: handler.go:158-227 行。`toComboResponse(combo, nil)` で変換。セットプレイのロードなし。`ComboResponse.Setups` はゼロ値（nil）のまま。JSON タグ `json:"setups"` は omitempty でないため `null` として返却される
- **Get API（GET /api/combos/:id）**: handler.go:128-149 行。`h.setupSvc.ListSetupsByComboID()` でセットプレイを個別にロードし、`resp.Setups` に埋め込む（M4-02 案 B1）。ただしこれは詳細画面用であり、一覧画面では使用されない
- **combo_setups テーブルのクエリ**: List クエリ（repository.go:466-484 行）では `combo_setups` テーブルの JOIN や件数取得を行っていない。したがって一覧レスポンスにはセットプレイの存在有無情報が含まれない

### 2.4 DES-005 §5.4 規定との乖離整理

| 規定項目 | DES-005 §5.4 規定 | 現状実装 |
|----------|-------------------|----------|
| 展開時の表示内容 | 「コンボ行の直下にインデント付きでセットプレイを表示」、各セットプレイに `[レシピ]` を表示 | 全展開行で固定テキスト「紐付くセットプレイはありません」を表示。セットプレイ名・レシピは未表示 |
| セットプレイデータ | セットプレイ名 + レシピ（表示例: `└ セットプレイ1  [レシピ]`） | データ取得経路が未実装。Props にセットプレイデータなし |
| 展開アイコン | 表示例ではセットプレイ紐付きコンボのみ `▼` / `▶` を表示 | 全コンボ行に無条件で ChevronDown / ChevronRight を表示 |
| 展開状態の保持 | 「ブラウザセッション内で保持」 | React の `useState`。コンポーネントマウント中のみ有効、ページ遷移で消失 |
| インデント | `└` 記号 + インデント | `└` 文字 + `pl-12` クラス（実装あり） |
| セットプレイ行クリック | セットプレイ編集画面へ遷移（§5.4 アクション） | クリックイベント未実装（プレースホルダーテキストのみのため） |

### 2.5 M4-01 期間の経緯確認

- **M1-05（fe02008, 2026-05-05）**: SetupTreeRow 初版作成。ファイル冒頭コメント:
  ```
  // セットプレイ行のプレースホルダ。
  // M4 でセットプレイデータ取得実装が来たら本データを描画する。
  // それまでは「(セットプレイは M4 で実装予定)」を表示する。
  ```
- **M4-01 指示書**（M4-01-setup-backend-foundation.md:53 行）: 「フロント側 UI 全般（セットプレイ登録画面、コンボ詳細でのセットプレイ展開、紐付け操作 UI）— M4-02 で実装」
  - M4-01 はバックエンド基盤のみ。フロントのセットプレイ展開は M4-02 のスコープとして明記
- **M4-01 指示書**（988 行）: 「M4-02（セットプレイ単体 UI + コンボ**詳細**展開 + 紐付け操作 UI）に進む」
  - M4-02 のスコープは「コンボ詳細」でのセットプレイ展開であり、「コンボ一覧」での展開行は含まれていない
- **M4-03（d2f369d, 2026-05-19）**: SetupTreeRow の冒頭コメント（M4 実装予定のコメント）が削除された。描画ロジックの変更なし
- **progress-log.md:1615 行**: ComboTable.tsx の説明として「ComboTableRow + SetupTreeRow を描画」「表示専用テーブル、API 呼出なし」と記載

### 2.6 関連コンポーネントの状況

- **コンボ詳細画面のセットプレイ表示**（ComboDetailPage.tsx:109-148 行）: Accordion コンポーネントで各セットプレイを展開表示。`SetupAccordionItem` コンポーネントを使用。こちらは Get API（案 B1）で取得したセットプレイデータを表示する完全な実装
- **コンボ一覧画面とコンボ詳細画面のセットプレイ表示の実装差**: 詳細画面では Get API の Setups フィールドから取得。一覧画面では List API にセットプレイ情報が含まれないため、展開行にデータを渡す経路がない

### 2.7 特記事項

1. **M4-02 のスコープ定義**: M4-01 指示書が「コンボ詳細展開」と明記しており、「コンボ一覧の展開行」はいずれのマイルストーンの指示書にもスコープとして明記されていなかった可能性がある。これが SetupTreeRow が仮実装のまま残った経緯と整合する
2. **List API のセットプレイ情報不足**: 展開行にセットプレイデータを表示するには、List API がセットプレイ情報（少なくとも紐付き件数、理想的にはセットプレイ名・レシピ）を返す必要がある。現状の List API は combo_setups テーブルに一切アクセスしていない

---

## 3. 関連ドキュメント

| 種類 | ファイル | 役割 |
|------|---------|------|
| 本レポート | 本ファイル（`docs/instructions/M7-RESEARCH-03-report.md`）| 調査結果 |
| 対応指示書 | `docs/instructions/M7-RESEARCH-03-gauge-consumption-display-and-setup-tree-row-check.md` v1.0.0 | 本調査の指示書 |
| 連動完了報告 | M7-01 製造工程完了報告（2026-05-27、製造担当 → 設計担当 指摘 1 / 指摘 6）| 調査依頼の起点 |
| 設計書本体 | `docs/design/03-data-model.md` §341-342 / §376-383 | ゲージ消費キャッシュ規定 |
| 設計書本体 | `docs/design/05-screen-design.md` §5.4 / §5.6 / §5.7 | コンボ一覧展開表示 + コンボ詳細表示 + 編集規定 |
| 設計書本体 | `docs/design/06-validation.md` VAL-C06 / VAL-C07 | ゲージ消費バリデーション |
| 設計書本体 | `docs/design/requirements.md` FR004 | 編集方式 (a) / (b) |
| 運用ルール | `docs/handover/architecture-patterns.md` v1.0.8 §6 | 調査担当運用パターン |

---

## 4. 調査担当からの完了宣言

本調査は M7-RESEARCH-03 指示書 §0.2 read-only 厳守 + §0.3 judgement-free 原則（判断・提案を含めない、事実列挙のみ）に従って実施を完了した。修正コード、判断、提案は一切含まない。設計担当 Claude の指示書スコープ判断に活用されることを目的とする。

セッションを閉じる。

---

*以上、M7-RESEARCH-03 調査結果レポート v1.0.0*
