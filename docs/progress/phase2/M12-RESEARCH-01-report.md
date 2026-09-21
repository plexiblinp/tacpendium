# M12-RESEARCH-01 調査結果レポート

| 項目 | 内容 |
|------|------|
| 対応指示書 | M12-RESEARCH-01 v1.0.0 |
| バージョン | 1.0.0 |
| 実施日 | 2026-06-21 |
| 実施モデル | Opus 4.8（開発者ご判断で昇格、Sonnet 4.6 指定枠）|
| 調査担当 | Claude Code セッション（製造担当起動・調査のみ実施して閉じる）|
| 調査時 HEAD | `2e64851`（M11-02 マージ済み）|

> **本レポートの制約**: read-only 厳守（コード・DB 変更なし、本ファイル作成のみ例外、DB 操作なし）+ judgement-free（事実列挙のみ、修正方針・設計結論を含まない）。grep は snake_case / camelCase 両系統で実行し、ヒット 0 件の領域も明示する。

---

## 0. 結論サマリ（設計担当が最初に読む、事実集約）

### 0.1 起き攻め 6 BOOLEAN の返却データ経路

- **モデル**: `internal/model/combo.go` L98-103 — `okiMeaty*` 4 件 + `okiShimmy*` 2 件は **`*bool`（nullable）**。`knockdownAdvantage`（L104）は **`*int`（nullable）**。
- **DB 型**: `migrations/000001_init_schema.up.sql` L73-79 — 6 BOOLEAN は **`INTEGER`**、`knockdown_advantage` も `INTEGER`（SQLite に bool 型なし）。
- **JSON タグ**: camelCase。ただし DR 系は **`...Dr`**（小文字 r）で出力（例 `okiMeatyNeutralTechThrowDr`）。Go フィールド名は `...DR`（大文字）だが JSON タグは `Dr`。
- **返却 DTO**: `internal/api/combo/dto.go` の `ComboResponse`（L33-42, L148-156）。**一覧・詳細・比較すべて同一の `ComboResponse`**（フロント `ComboSummary` / `ComboDetail` の供給元は同じ DTO）。各フィールド `*bool` / `*int` + `omitempty`。
- **BE での段（high/mid/low）変換**: **0 件**。`internal/api/combo` / `internal/service/combo` / `internal/repository/combo` / `internal/model/combo.go` に `high` / `mid` / `low` / `中段` 等は存在しない（>> 0 件確認済み）。6 BOOLEAN はそのまま透過。

### 0.2 詳細 vs 比較 vs 編集の起き攻め表示方式（対比）

| 観点 | 詳細（ComboDetailMetadata.tsx） | 比較（CompareTable.tsx） | 編集（ComboEditorBasicFields.tsx）|
|------|------|------|------|
| 表示単位 | **6 BOOLEAN を 6 行**で個別描画 | **2 行に集約**（その場 / 後ろ受け身）× 各 2 サブ行（DR 無 / DR 有）| **6 チェックボックス**（OKI_FIELDS）|
| shimmy の扱い | 独立 2 行（meaty と並列）| meaty throw と **同一セルに畳み込み**。DR 無行で「両方可/投げ重ねのみ可/両方不可」として表現。**shimmy 単独行なし** | 独立 2 チェックボックス |
| DR 有 の shimmy | shimmy に DR 列なし（DR は meaty のみ）| `formatOkiDrYes` は throwDr のみ参照。**shimmy DR は表現不可** | shimmy に DR チェックなし |
| true/false/null 表示 | `YesNo`: null/undefined→「-」, true→「✓」, false→「✗」 | `formatOkiDrNone/Yes`: null→「-」, それ以外は集約ラベル | チェック: `value===true` のみ checked。**null と false は同じ「未チェック」**。トグルで true/false のみ設定（null は設定不可）|
| ラベル源 | **i18n `comboDetail.oki.*`**（ja.json）| **i18n `compare.row.*` / `compare.oki.*`**（ja.json）| **`labels.ts` の `OKI_FIELDS`**（ハードコード日本語）|
| 有利フレーム | メタデータ grid 内。`combo.knockdownAdvantage ?? "-"`。**生値表示（例「26」）**。i18n ラベル `comboDetail.metadata.knockdownAdvantage`=「有利フレーム」 | 専用行。`formatKnockdownAdvantage`=**符号 + F 付き（例「+26F」）**。i18n `compare.row.knockdownAdvantage`=「有利フレーム」 | number 入力欄。i18n なしのハードコードラベル「有利フレーム」（ComboEditor.tsx L646）|

→ 同じ 6 BOOLEAN + 有利フレームに対し、**ラベル語彙が 3 系統で相違**。有利フレームの整形も **詳細（生値）と比較（+nF）で相違**。

### 0.3 「中段」等の段表現が起き攻め表示に現れる経路

- **段コード（`high`/`mid`/`low`）・日本語段（`中段`/`上段`/`下段`）が起き攻め表示コンポーネントに現れる箇所: 0 件**。`ComboDetailMetadata.tsx` / `CompareTable.tsx` / `ComboEditorBasicFields.tsx` のいずれにも move `properties` 由来の段表現は無い。
- 段コード `high/mid/low` の出現は **`web/src/features/moves/` 配下（`types.ts` L109-116 `MOVE_PROPERTY_VALUES`、`MoveEditGrid`、`ImportMovesPage`）と `docs/design` のみ**。起き攻め（`features/combo`）とは別 feature・別コンポーネントで、**共有コンポーネント / 共有ラベル関数は無い**。
- 一方、**「中段」という文字列は起き攻め詳細表示に現れる**。出所は **move `properties` 由来ではなく、`web/src/locales/ja.json` の `comboDetail.oki.meaty*` にハードコードされた i18n ラベル**（L98-101）:
  - `meatyNeutralTechThrow` = **「中段攻め(その場受け身/投げ)」**
  - `meatyNeutralTechThrowDr` = **「中段攻め(その場受け身/投げ・DR)」**
  - `meatyBackTechThrow` = **「中段攻め(後ろ受け身/投げ)」**
  - `meatyBackTechThrowDr` = **「中段攻め(後ろ受け身/投げ・DR)」**
- この「中段攻め」ラベルは **`oki_meaty_*`（meaty=重ね/重ね攻め）BOOLEAN の表示名**であり、データ駆動ではなくロケール文字列固定。`en.json` の同キーは「Meaty (...)」（L96-99、中段相当語なし）。→ 詳細 §1.6 / §0.8 参照。

### 0.4 autoStarterMoveId の導出ロジックと対応 move 種別

- **導出**: `web/src/features/combo/components/ComboEditor.tsx` L119-122
  `const autoStarterMoveId = useMemo(() => steps.find((s) => s.moveId != null)?.moveId ?? null, [steps])`
  = **レシピ（steps）の中で `moveId` が非 null である最初のステップの `moveId`**。
- **対応 move 種別**: `category` / `isAerial` 等による**分岐は一切なし**。`Move.category`（10 値: normal/special/unique/super_art/throw/system/target_combo/rush_variant/drive_impact/critical_art、`features/moves/types.ts` L11-21）に関係なく、steps に載っていればどの種別でも推定対象。
- **空（null）/ 失敗ケース**: ① steps が空、② 全ステップの `moveId` が null（非技ステップ = `modifiers.type` がダッシュ/パリィ DR 等のみ）。先頭が非技ステップの場合は **それを飛ばして最初の非 null move を採用**。

### 0.5 手動プルダウンと自動推定の関係・starter_move_id 保存経路

- **手動プルダウン**: `ComboEditorBasicFields.tsx` L183-206。選択肢は `moves.map`（`useMovesByCharacter(characterId)` の全 move）で **category フィルタなし**。空 option は `autoStarterMoveId != null` のとき「(自動推定: <move名>)」、null のとき「(自動推定 / レシピから)」を表示（`labelOfMove` L402 は `nameJa ?? code`、フィルタなし）。
- **優先順位**: `effectiveStarterMoveId = basic.starterMoveId ?? autoStarterMoveId`（ComboEditor.tsx L124）。**手動選択が常に優先**、自動推定は手動が null のときのみフォールバック。
- **保存経路**:
  - CREATE（`buildCreatePayload` L166）: `starterMoveId: effectiveStarterMoveId`。
  - PUT（キー変更編集、`runPut` L332 が `buildCreatePayload` を再利用）: 同じく `effectiveStarterMoveId`。
  - PATCH（メタデータ編集、`buildPatchPayload` L192-210）: **`starterMoveId` を送らない**（始動技はキーフィールドのため変更時は `hasKeyChanges` 判定で PUT 経路）。
  - BE: `dto.go` `StarterMoveID *int64` → `service/combo` → `repository/combo` の `starter_move_id` カラムへ**そのまま保存**。
- **重複判定キーに効く値の確定箇所**: `effectiveStarterMoveId`。`duplicate_keys.go` の `DuplicateCheckFields` に `"starter_move_id"` を含む（L27）。FE `hasKeyChanges`（utils.ts L123）・`checkInput`（ComboEditor.tsx L131/143）も `effectiveStarterMoveId` を使用。

### 0.6 自動推定と手動選択が食い違いうるケース

- `effectiveStarterMoveId = 手動 ?? 自動`。保存値が自動推定と異なるのは **手動選択が非 null のとき**（手動が常に勝つ）。
- 自動推定は category 非依存で常に **「レシピ先頭の最初の非 null move」** を返す。よって **手動選択 ≠ レシピ先頭 move** のとき両者は乖離する（例: 先頭が前ジャンプ攻撃ステップだが登録上の始動技を別に指定したい / 先頭に非技ステップがある）。
- **通常技 / ジャンプ攻撃以外（必殺技 special・投げ throw・ターゲットコンボ target_combo・ラッシュ版 rush_variant・SA super_art 等）の始動**:
  - 導出ロジックに category 分岐が無いため、当該種別が **レシピ先頭の最初の非 null move であれば `starter_move_id` として自動確定可能**（推定不可になる category は **0 件**）。
  - 手動プルダウンも全種別を列挙（フィルタ 0 件）。
  - 自動推定が当該種別を取りこぼすのは「レシピ先頭がその move でない場合」に限られ、**move 種別そのものを理由に推定が破綻する分岐は存在しない**。

### 0.7 想定外の発見

1. **同一 6 BOOLEAN に対するラベル語彙が編集 / 詳細 / 比較で 3 系統相違**（§0.2 表 / §1.5）。特に `oki_meaty_*`（meaty=重ね）が 編集=「重ね」・詳細=「中段攻め」・比較=「起き攻め」と異なる訳語。
2. **有利フレームの整形が詳細（生値「26」）と比較（「+26F」、`formatKnockdownAdvantage`）で相違**（§0.2）。
3. **比較は shimmy を独立表示せず、meaty throw と同一セルに「両方可」として畳み込む**。shimmy の DR バリアントは表現手段が無い（`formatOkiDrYes` は throwDr のみ参照、§1.4）。
4. **編集チェックボックスは null を設定できない**（`value===true` 判定、トグルで true/false のみ）。詳細は null を「-」表示するが、編集経由では false が入る（§1.7）。

### 0.8 明らかな矛盾の事実指摘

1. **ラベル vs データの乖離（中段）**: `ja.json` `comboDetail.oki.meaty*` = 「**中段攻め**(...)」だが、対応カラムは `oki_meaty_*`（meaty = 技を重ねる = 「重ね攻め」、指示書 §0.5 / DES-003 §3.x の定義は「その場/後ろ受け身に投げ重ね」）。同キーの `en.json` は「**Meaty** (...)」で「中段」相当語なし。見出しは `comboDetail.oki.heading`=「起き攻め情報」。→ 見出し「起き攻め」配下に項目ラベル「中段攻め」が並ぶ状態。
2. **「その場受け身」vs「中央受け身」の表記揺れ**: `neutral tech` を 詳細・比較 i18n は「その場受け身」、編集 `labels.ts` `OKI_FIELDS` は「中央受け身」と表記（指示書 §0.5 / DES-003 規定は「その場受け身」）。
3 つとも事実として記録。解釈・解消方針は含めない（設計担当判断）。

---

## 1. 起き攻め表示の現状

### 1.1 横断 grep の全ヒット一覧（領域別、対象/対象外の区別を付す）

`grep -rni "oki_meaty|okiMeaty"` / `"oki_shimmy|okiShimmy"` / `"knockdown_advantage|knockdownAdvantage|knockdown"` を `*.go` `*.ts` `*.tsx` `*.sql` `*.json` で実施。**全ヒットが起き攻め本体に関するもの**（無関係な別語ヒットなし）。領域別所在:

**バックエンド Go（起き攻め 6 BOOLEAN）**
| ファイル | 役割 |
|------|------|
| `internal/model/combo.go` L98-104 | ドメインモデル（`*bool` ×6 + `*int`）。db snake / json camel(`Dr`) |
| `internal/api/combo/dto.go` L37-42, L93-98, L151-156, L252-257, L300-305, L336-341 | Request/Response DTO（`*bool` / `Optional[bool]`）+ マッピング |
| `internal/service/combo/service.go` L65-70, L708-713 | サービス入力構造体 + 受け渡し |
| `internal/repository/combo/repository.go` L80-85, L211-213, L239-241, L291-293, L331-333, L473-475, L619-624, L781-783, L899-901, L1015-1017 | INSERT/SELECT 列・スキャン・部分更新（`addOptBool`）|
| `internal/service/validation/combo.go` L278-291 | DR=true なら親=true の整合チェック（meaty 2 ペア）|
| `migrations/000001_init_schema.up.sql` L73-78 | 6 列定義（INTEGER）|

**バックエンド Go（knockdown_advantage、※一部はセットプレイ連携 = §3 で別整理）**
| ファイル | 役割 |
|------|------|
| `internal/model/combo.go` L104 / `dto.go` L33,88,148 / `service.go` L60 / `repository.go` L74,214,… | knockdown_advantage 本体（`*int`）|
| `internal/service/validation/combo.go` L263-271 | VAL-C10 範囲チェック(-600〜+600、WARNING)|
| `internal/service/setup/*` / `internal/repository/setup/*` / `internal/api/setup/handler.go` | **対象外寄り**: 同一 knockdown_advantage のセットプレイ候補検索（FR011、§3 参照）|

**フロント TS/TSX**
| ファイル | 役割 |
|------|------|
| `web/src/features/combo/types.ts` L52,55-60,104-109,125,157,181 | `ComboSummary`/`ComboDetail`/`Combo`/`OkiBooleans` 型 |
| `web/src/features/combo/schema.ts` L44-51 | zod スキーマ（nullable optional）|
| `web/src/features/combo/labels.ts` L96-114 | **編集用ラベル** `OKI_FIELDS` |
| `web/src/features/combo/components/ComboDetailMetadata.tsx` L62-65,81-121 | **詳細描画** |
| `web/src/features/combo/components/CompareTable.tsx` L39-57,122-148,248-251 | **比較描画** |
| `web/src/features/combo/components/ComboEditorBasicFields.tsx` L40,244-245,314-329 | **編集入力** |
| `web/src/features/combo/components/ComboEditor.tsx` L177-208,563-607,646 | 編集 state 初期化・payload 構築・有利フレームラベル |
| `web/src/features/combo/components/KnockdownAdvantageChangeModal.tsx` | 有利フレーム変更時のセットプレイ引き継ぎモーダル（M4-03）|
| `web/src/locales/ja.json` L90,96-103,159,166-171 / `en.json` L88,94-101,156-168 | **詳細・比較の i18n ラベル** |

**テスト**: `repository_test.go` / `validation/combo_test.go` / `CompareTable.test.tsx` / `ComboEditorBasicFields.test.tsx` / `service_test.go` / `KnockdownAdvantageChangeModal.test.tsx` 等（read-only、変更なし）。

**ドキュメント**: `docs/design/03-data-model.md` L298（properties 段定義）等。

> 備考: `node_modules/.vite/vitest/.../results.json` に `knockdownAdvantage` を含む過去テスト結果がヒットしたが、ビルド生成物のため調査対象外。

### 1.2 起き攻め 6 BOOLEAN の返却データ経路（BE）

- フィールド名・型: §0.1 のとおり model/DTO ともに **`*bool`（nullable）**、`knockdown_advantage` は `*int`。一覧・詳細・比較は同一 `ComboResponse`。
- 段変換: **0 件 / BE では段変換なし**（§0.1, §0.3 確認済み）。

### 1.3 コンボ詳細（DES-005 §5.6）の起き攻め描画

- コンポーネント: `ComboDetailMetadata.tsx`。見出し `comboDetail.oki.heading`=「起き攻め情報」（L73）。
- **6 BOOLEAN を 6 行**で個別描画（L76-123）。各行 = `<dt>`（i18n ラベル）+ `<dd><YesNo value={...}/></dd>`。
- `YesNo`（L17-24）: `undefined||null`→「-」、`true`→緑「✓」、`false`→灰「✗」。
- 有利フレーム: メタデータ grid 内（L60-67）。`combo.knockdownAdvantage ?? "-"` で**生値**表示。
- 各行の i18n キーと ja.json ラベル: `meatyNeutralTechThrow`=「中段攻め(その場受け身/投げ)」/ `...Dr`=「…・DR」/ `meatyBackTechThrow`=「中段攻め(後ろ受け身/投げ)」/ `...Dr` / `shimmyNeutralTech`=「シミー(その場受け身)」/ `shimmyBackTech`=「シミー(後ろ受け身)」。
- **DES-005 §5.6「6 つの BOOLEAN と有利フレーム」記述との一致**: 表示項目数（6 BOOLEAN + 有利フレーム）は一致。ラベル文言「中段攻め」は §0.8 のとおりデータ意味（meaty=重ね）と乖離。

### 1.4 コンボ比較（DES-005 §5.8）の起き攻め描画

- コンポーネント: `CompareTable.tsx`。起き攻めは **行定義 2 件**（L256-262）:
  - `compare.row.okiNeutralTech`=「起き攻め(その場受け身)」→ `renderOkiCell(c, "neutral")`
  - `compare.row.okiBackTech`=「起き攻め(後ろ受け身)」→ `renderOkiCell(c, "back")`
- `renderOkiCell`（L122-148）: 各セルに 2 サブ行:
  - **DR 無**（`compare.oki.drNone`=「DR 無」）: `formatOkiDrNone(throwVal, shimmyVal)` — `throwVal==null`→「-」/ throw&&shimmy→`bothPossible`「両方可」/ throw のみ→`throwOnly`「投げ重ねのみ可」/ それ以外→`neither`「両方不可」。
  - **DR 有**（`compare.oki.drYes`=「DR 有」）: `formatOkiDrYes(throwDrVal)` — `null`→「-」/ true→「投げ重ねのみ可」/ false→「両方不可」。
- 集約構造: **6 BOOLEAN → 2 行 × 2 サブ行**。`okiShimmy*` は **DR 無サブ行に畳み込まれ**（meaty throw と AND 判定で「両方可」表示）、**shimmy 単独表示・shimmy DR 表示は無い**。
- 有利フレーム: 専用行 `compare.row.knockdownAdvantage`=「有利フレーム」（L248）→ `formatKnockdownAdvantage(c.knockdownAdvantage)`（L251）で **符号 + F 付き**（utils.ts L79-85）。

#### 詳細 vs 比較 表示方式の差異（対比）

| 観点 | 詳細 | 比較 |
|------|------|------|
| 起き攻め行数 | 6 | 2（× 2 サブ行）|
| shimmy | 独立 2 行 | meaty に畳み込み（「両方可」）|
| true/false/null | ✓ / ✗ / - | 集約ラベル / - |
| ラベル語彙 | 「中段攻め…」「シミー…」 | 「起き攻め(…)」+「DR 無/有」「両方可…」|
| 有利フレーム | 生値（例 26）| +nF（例 +26F）|

### 1.5 詳細 vs 比較 vs 編集 の表示方式 対比表

§0.2 の表参照（編集 = `OKI_FIELDS` 6 チェックボックス、ラベル「重ね・中央受け身・投げ」系）。3 系統のラベル対応:

| フィールド | 編集（labels.ts）| 詳細（ja i18n）| 比較（ja i18n、集約後）|
|------|------|------|------|
| okiMeatyNeutralTechThrow | 重ね・中央受け身・投げ | 中段攻め(その場受け身/投げ) | 起き攻め(その場受け身) → DR 無 |
| okiMeatyNeutralTechThrowDr | 重ね・中央受け身・投げ + DR | 中段攻め(その場受け身/投げ・DR) | 起き攻め(その場受け身) → DR 有 |
| okiMeatyBackTechThrow | 重ね・後ろ受け身・投げ | 中段攻め(後ろ受け身/投げ) | 起き攻め(後ろ受け身) → DR 無 |
| okiMeatyBackTechThrowDr | 重ね・後ろ受け身・投げ + DR | 中段攻め(後ろ受け身/投げ・DR) | 起き攻め(後ろ受け身) → DR 有 |
| okiShimmyNeutralTech | シミー・中央受け身 | シミー(その場受け身) | （その場受け身 DR 無に畳込「両方可」）|
| okiShimmyBackTech | シミー・後ろ受け身 | シミー(後ろ受け身) | （後ろ受け身 DR 無に畳込「両方可」）|

### 1.6 「中段」等の段表現が混入する経路

- 起き攻め描画パス（詳細 / 比較 / 編集）内での move `properties` 由来段表現（`high`/`mid`/`low`/`中段`/`上段`/`下段`）: **0 件**。
- 詳細表示に現れる「中段」は **`ja.json` `comboDetail.oki.meaty*` のハードコード i18n ラベル**（L98-101「中段攻め(…)」）由来。move `properties` とは無関係・非データ駆動。
- move `properties` の段表現は **`web/src/features/moves/`（別 feature）**にのみ存在（`types.ts` L109-116、`MoveEditGrid`）。起き攻めと**同一コンポーネント / 同一ラベル関数を共有する箇所: 0 件**。

### 1.7 コンボ編集（DES-005 §5.7）の起き攻め入力

- コンポーネント: `ComboEditorBasicFields.tsx` L313-329。`<legend>起き攻め</legend>` 配下に **`OKI_FIELDS.map` で 6 チェックボックス**。
- ラベル: `labels.ts` `OKI_FIELDS`（L108-113）— 「重ね・中央受け身・投げ」「…+ DR」「重ね・後ろ受け身・投げ」「…+ DR」「シミー・中央受け身」「シミー・後ろ受け身」。
- state: `checked={value[f.key] === true}` / `onCheckedChange={(c) => set(f.key, c === true)}`。**null は設定不可**（null/false ともに未チェック表示、トグルは true/false のみ）。CREATE/PATCH payload では `?? null`（ComboEditor.tsx L177-208）で未設定を null 送出。
- 入力ラベルと詳細/比較表示ラベルの一致: **不一致**（編集「重ね」「中央受け身」⇔ 詳細「中段攻め」「その場受け身」⇔ 比較「起き攻め」「その場受け身」。§1.5 / §0.8）。

---

## 2. 始動技自動推定の現状

### 2.1 autoStarterMoveId の導出ロジック

- 供給元: `ComboEditor.tsx` L119-122 の `useMemo`。依存配列 `[steps]`。
  `steps.find((s) => s.moveId != null)?.moveId ?? null`。
- 推定根拠: **レシピ先頭から見て最初の非 null `moveId`**。`category` / `isAerial` 等の**分岐なし**。
- 対応 move 種別: 全 10 category（`features/moves/types.ts` L11-21）。種別による除外なし。
- 空 / 失敗ケース: steps 空、または全ステップ `moveId==null`（非技ステップのみ）。先頭非技ステップはスキップ。
- 子へ伝播: `ComboEditorBasicFields` の Props `autoStarterMoveId`（ComboEditor.tsx L415 で `autoStarterMoveId` を渡す。L425 の moves は `movesQ.data`）。

### 2.2 手動プルダウンとの関係・starter_move_id 保存経路

- 手動 UI: `ComboEditorBasicFields.tsx` L183-206。`moves` = `useMovesByCharacter(basic.characterId)`（ComboEditor.tsx L85）の全件、**category フィルタなし**。空 option に自動推定値を表示（`labelOfMove`）。
- 優先順位: `effectiveStarterMoveId = basic.starterMoveId ?? autoStarterMoveId`（L124）。手動優先・自動フォールバック。
- 最終保存値の確定箇所:
  - CREATE: `buildCreatePayload` L166 `starterMoveId: effectiveStarterMoveId`。
  - PUT: `runPut` L327-340 が `buildCreatePayload` を再利用 → 同値。
  - PATCH: `buildPatchPayload` L192-210 に `starterMoveId` **なし**（キー変更は `hasKeyChanges`→PUT 経路、proceedSave L251-271）。
  - BE: `dto.StarterMoveID *int64` → service → repository `starter_move_id` 列へそのまま。
- 重複判定キー: `duplicate_keys.go` `DuplicateCheckFields` に `"starter_move_id"` を含む（L27、全 7 キー: character_id / recipe_hash / starter_move_id / position / opponent_stance / hit_type / opponent_size）。FE `hasKeyChanges`（utils.ts L123）・リアルタイム `checkInput`（ComboEditor.tsx L131,143）も `effectiveStarterMoveId` を使用。
- 補足: 表示用 `starterMoveCode` は BE `repository.go` L527-539 で `StarterMoveID` から codeMap 解決（`formatStarterStatus` utils.ts L47-59 が使用）。

### 2.3 自動推定と手動選択が食い違いうるケース

- `effectiveStarterMoveId = 手動 ?? 自動`。手動非 null のとき手動が常に勝つため、**保存値が自動推定と異なるのは「手動選択 ≠ レシピ先頭 move」のとき**。
- 自動推定は category 非依存・常に「レシピ先頭の最初の非 null move」。よって乖離する具体ケース:
  - レシピ先頭が前ジャンプ攻撃ステップだが、登録上の始動技を別の move として手動指定した場合。
  - レシピ先頭に非技ステップ（ダッシュ / パリィ DR 等、`modifiers.type`）があり、自動推定が次の技を拾う一方で手動が別 move の場合。
- **通常技 / ジャンプ攻撃以外の始動 move 種別**（special / throw / target_combo / rush_variant / super_art 等）:
  - 導出に category 分岐が無いため、当該種別が**レシピ先頭の最初の非 null move なら `starter_move_id` として自動確定可能**。手動プルダウンも全種別を列挙。
  - **move 種別を理由に自動推定が破綻（null 化 / 不可）する分岐は 0 件**。乖離は「レシピ先頭がその move でない」場合に限定される（再現操作は未実施、ロジック分岐上の事実として記録）。

---

## 3. 調査対象外シンボルとの区別

§4.1.1 横断 grep のヒットのうち、R-1 / C-12 と別物のシンボルを以下に分離記録（取り違え防止）:

| シンボル | 区分 | 所在（例）|
|------|------|------|
| `combos.situation` / `characters.custom_states` | **別物**（キャラ固有状態、M11 完了）| CompareTable.tsx L102-120 `renderCustomStates`、`customStates.ts` |
| `combos.position` / `opponent_stance` / `hit_type` / `opponent_size` | **別物**（独立カラム化済み状況）| labels.ts、CompareTable.tsx `renderSituationTags` L76-100 |
| `move.properties`（high/mid/low 段コード）| **別物**（move 属性。ただし起き攻め表示への交差有無は §1.6 で調査 = 交差 0 件）| `features/moves/types.ts` L109-116、`MoveEditGrid` |
| `Setup*`（セットプレイ系）| **別物** | `features/setup/*`、`internal/service/setup/*` |
| `knockdown_advantage` のセットプレイ候補検索（FR011）| **R-1 の表示とは別経路**（同一 KA のセットプレイ引き継ぎ。M4-03）| `internal/service/setup/service.go` L450-462、`repository/setup/repository.go` L686-708、`KnockdownAdvantageChangeModal.tsx` |

> `knockdown_advantage` 本体は R-1 対象（有利フレーム表示）だが、上記セットプレイ候補/引き継ぎ用途は別関心として分離。

---

## 4. 関連ドキュメント

| ID / パス | 参照箇所 | 本調査での用途 |
|------|------|------|
| DES-003 `docs/design/03-data-model.md` | L298（properties 段コード）, L368-374（起き攻め 6 BOOLEAN）, L447（起き攻め手動入力前提）| 段表現・起き攻め列定義の正典 |
| DES-005 `docs/design/05-screen-design.md` | §5.6 詳細 / §5.7 編集 / §5.8 比較 | 表示方式の設計規定 |
| code-facts `docs/handover/code-facts.md` | ヘッダ commit `3e0f4bf`（§0.8 鮮度差異参照）| Props/DTO 機械的事実（実コードで突合）|
| 実コード | `ComboDetailMetadata.tsx` / `CompareTable.tsx` / `ComboEditorBasicFields.tsx` / `ComboEditor.tsx` / `utils.ts` / `labels.ts` / `locales/{ja,en}.json` / `internal/{model,api,service,repository}/combo` / `migrations/000001` / `duplicate_keys.go` | 一次情報 |

### 4.1 鮮度に関する事実（§0.8 とは別の運用上の不一致）

- `code-facts.md` ヘッダの生成 commit は **`3e0f4bf`**（2026-06-20）。指示書 §3.1 / §3.4.1 は **`3fec816`** と記載。調査時 HEAD は **`2e64851`**。三者が不一致。
- 本調査は code-facts を鵜呑みにせず **実コードを正典として突合**（retrospective-digest §1）。code-facts 再生成は書き込み副作用のため read-only 調査内で実施せず、不一致を事実として記録するに留めた。

---

## 5. 調査担当からの完了宣言

- 本調査は **read-only 厳守**（コード・設計書・テスト・DB を一切変更せず、本レポート `docs/progress/M12-RESEARCH-01-report.md` の作成のみ）で実施した。DB アクセスは行っていない（SELECT も含め未実行。必要事実はマイグレーション SQL とコードから取得）。
- **judgement-free**（事実列挙のみ。修正方針・設計結論・推奨を含まない）を遵守した。§0.7 想定外の発見・§0.8 矛盾は事実としてのみ記録した。
- **全数性**: grep は snake_case / camelCase 両系統で実行し、ヒット 0 件の領域（BE 段変換・起き攻めパスの段表現・category 起因の推定破綻）は「0 件」と明示した。
- セッションを閉じる。R-1 / C-12 の修正設計・CHANGE 判断（044〜）は設計担当 + 開発者が本レポートを材料に実施する（M12-03）。

*以上、M12-RESEARCH-01 調査結果レポート v1.0.0*
