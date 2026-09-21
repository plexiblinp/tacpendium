# M14-RESEARCH-01 調査報告: 公式データ配布是正・スキーマ整理・取込画面廃止

| 項目 | 内容 |
|------|------|
| 対応指示書 | `docs/instructions/M14-RESEARCH-01-distribution-fix-schema-cleanup-survey.md` v1.1.0 |
| 種別 | 実装調査報告(read-only。事実列挙のみ。温存/削除の最終決定は含めない) |
| 調査モード | auto(自由入力指示なし) |
| 作成日 | 2026-06-28 |
| 調査範囲 | §4 A〜G(実 SQL / 実コード / 実テスト / ツール CSV の view・grep) |

---

## 0. 結論サマリ(冒頭)

- **削除安全性の核心(B 群)**: 取込(`movesimport`)と技編集(`move`、温存)は **ディレクトリ/ドメインは分離済みだが、コード境界は相互依存している**。
  - 取込 service は **独自 upsert ではなく `move` repository の `UpsertMove` / `UpsertOfficialJaAlias` を共有**して使う。
  - **逆向きの依存がより重要**: 温存側(技編集)が **取込パッケージ `service/movesimport` の `IsKnownProperty` / `WarningCode` / `StoredMove` / `DeriveStoredWarnings` を参照**している(`service/move`・`api/move`)。**`service/movesimport` をパッケージごと削除すると技編集が壊れる。**
  - → 取込パイプラインの「完全削除」は、これら共有シンボルを別の置き場へ退避してからでないと不可能 ⇒ phase3-overview §M14-02 の **段階削除**方針が、実コード上も裏付けられる。
- **スキーマ(A 群)**: `moves` は **20 列**。**取込パイプライン専用の列は存在しない**(全データ列は技編集の到達範囲)。削除候補は **列ではなく `raw_data` の取込専用サブキー**(`command` / `condition_ja` / `condition_en` / `properties_extra` / `import_notes`)に絞られる。`notes` / `notes_tool` は技編集がパース・編集する=温存。**取込専用の staging/tracking テーブルは存在しない(0 件)**。
- **配布健全化(F 群)**: 配布禁止 HTML・HTML 由来 CSV は **すべて `.gitignore` 済み(`work_html/` `combomgr-importer/` `autopilot-combomgr/` `tmp/`)** で git 追跡外。バイナリの `go:embed` 対象は **`web/dist` と `migrations/*.sql` のみ**で HTML/CSV を同梱しない。**現時点で配布物(git リポジトリ・単一バイナリ)に配布禁止データは含まれていない**。
- **配布 seed のギャップ(E 群)**: 000017 適用後の **live 状態は characters 5 行(ryu / ken / ingrid / c_viper / dhalsim)のみ。moves を持つのは ryu(56 行)だけ**。ken / ingrid / c_viper / dhalsim は characters 行のみで moves 0 件(取込前提だった)。配布対象=SF6 全キャラに対し **ロスター大半(~26体規模)が未投入** = 大きなギャップ。
- **想定外の発見(事実指摘)**: 指示書 §3.2 の前提に実態とずれが 2 点(後述 §想定外の発見)。aki/jamie/guile は 000017 で「整理」ではなく **完全 DELETE** 済み。`dalsim` の正コードは `dhalsim`。

---

## A. moves / 関連スキーマの「取込専用 vs 温存」切り分け

### A-1. moves 全列の列挙と分類

**実態**: `moves` テーブルは **20 列**。内訳 = `000001_init_schema.up.sql`(12 列)+ `000013_add_moves_frame_columns.up.sql`(+8 列)。**`000008` / `000016` は `moves` を変更しない**(000008 は `combos` から 2 列 DROP、000016 は `combos` を再構築して `drive_damage` を INTEGER→REAL)。

| # | 列名(実値) | 型・制約 | 追加 |
|---|---|---|---|
| 1 | `id` | INTEGER PK AUTOINCREMENT | 000001 |
| 2 | `character_id` | INTEGER NOT NULL REFERENCES characters(id) | 000001 |
| 3 | `code` | TEXT NOT NULL | 000001 |
| 4 | `category` | TEXT NOT NULL | 000001 |
| 5 | `original_move_id` | INTEGER REFERENCES moves(id)(自己参照) | 000001 |
| 6 | `damage` | INTEGER | 000001 |
| 7 | `combo_scaling` | TEXT(JSON) | 000001 |
| 8 | `drive_gauge_increase` | INTEGER | 000001 |
| 9 | `drive_gauge_decrease_punish` | INTEGER | 000001 |
| 10 | `super_art_gauge_increase` | INTEGER | 000001 |
| 11 | `properties` | TEXT | 000001 |
| 12 | `raw_data` | TEXT(JSON) | 000001 |
| 13 | `startup` | INTEGER | 000013 |
| 14 | `active` | INTEGER | 000013 |
| 15 | `total` | INTEGER | 000013 |
| 16 | `on_hit` | INTEGER | 000013 |
| 17 | `on_block` | INTEGER | 000013 |
| 18 | `drive_gauge_decrease_guard` | INTEGER | 000013 |
| 19 | `is_aerial` | INTEGER NOT NULL DEFAULT 0 | 000013 |
| 20 | `setup_only` | INTEGER NOT NULL DEFAULT 0 | 000013 |

テーブル制約: `UNIQUE (character_id, code)`、索引 `idx_moves_character_category ON moves(character_id, category)`。タイムスタンプ列なし。

**列ごとの到達経路**(grep 結果。経路 = list SELECT `repository/move/queries.go:listByCharacterSQL` / detail SELECT `getByIDSQL` / 編集 PATCH `repository/move/edit.go:UpdateFields` / 取込 upsert `repository/move/upsert.go:upsertMoveSQL` + `rush.go`):

| 列 | list | detail | PATCH | 取込/rush | 分類 |
|---|---|---|---|---|---|
| id / character_id | ○ | ○ | キー/不可 | ○ | コア |
| code | ○ | ○ | 不可 | ○(競合キー) | コア(PATCH 編集不可) |
| category | ○ | ○ | 不可(rush 生成のみ) | ○ | コア |
| original_move_id | ○ | ○ | 不可(rush 生成のみ) | ○ | rush 連結 |
| properties / startup / active / total / on_hit / on_block / drive_gauge_decrease_guard / is_aerial | ○ | ○ | ○ | ○ | **温存**(編集+表示) |
| setup_only | ○ | ○ | **不可** | ○ | 表示/list + 取込のみ(PATCH 非対象の予約フラグ) |
| damage / combo_scaling / drive_gauge_increase / drive_gauge_decrease_punish / super_art_gauge_increase | **×** | ○ | ○ | ○ | **温存**(編集+詳細表示。list 非露出) |
| raw_data | **×** | ○ | ○ | ○ | **温存**(取込が書く・編集が round-trip。詳細 §A-2) |

**M14 スコープへの含意**: **列レベルで「取込パイプライン専用」の列は 1 つも存在しない**。`setup_only` は取込/表示専用かつ PATCH 非対象だが、表示には使う=削除候補ではない。識別系(`code`/`category`/`original_move_id`)は取込・rush 生成で設定し PATCH 自由編集不可だが、いずれも温存必須。⇒ **A-1 由来の列削除候補は実質ゼロ**。削除検討の主対象は §A-2 の `raw_data` サブキー。

**推奨(決定しない)**: 列削除を伴う M14-01 は範囲が極小(または不要)になる見込み。実体の削減余地は §A-2 の JSON サブキー更新に寄る。

### A-2. raw_data サブキーの取込専用 vs 編集利用

**実態**: `raw_data` は `model/move.go` に sub-struct を持たず、`*string`(不透明 JSON)。サブキーは取込 `service/movesimport/parse.go:buildRawData()` が `map[string]any` で構築。確定 7 キー(実値):

- `notes` — 公式備考原文(ツール付記マーカー前)
- `notes_tool` — ツール付記(`toolNoteMarker` 後)
- `command` — コマンド文字列
- `condition_ja` / `condition_en` — 前提条件テキスト
- `properties_extra` — properties 余剰(複数/未知値の退避)
- `import_notes` — 本体側付記(`[]string`)

**編集器(FR703)のパース実態**(`web/src/features/moves/MoveEditGrid.tsx:51-132`):
- **`notes`**: パースして **表示のみ**(原文)。
- **`notes_tool`**: パースして **表示+編集**(空なら `delete obj.notes_tool`、非空なら上書き → `JSON.stringify` で PATCH)。
- **`command` / `condition_ja` / `condition_en` / `properties_extra` / `import_notes`**: **保持(round-trip)。編集器は解釈しない**(`MoveEditGrid.tsx:52` コメントに明記、CHANGE-030)。
- バックエンド Go 側は全キーを **不透明 round-trip**(`service/move/service.go:isJSONObject` で JSON オブジェクト整形式チェックのみ。サブキー解釈なし)。

**契約・正典との差**: 指示書 §3.2 は「`notes_tool`/`import_notes`/`command`/`condition_*`/`properties_extra` は取込由来の退避キー」「FR703 編集器がパース」と記述。**実態は `notes` と `notes_tool` のみ編集器がパース/編集**し、`notes_tool` は技編集の自由メモ欄=温存。残る 5 キー(`command`/`condition_ja`/`condition_en`/`properties_extra`/`import_notes`)は **取込時のみ書き込み・以降は誰も読まない退避値**。

**M14 スコープへの含意**: `raw_data` の削除候補は **`command` / `condition_ja` / `condition_en` / `properties_extra` / `import_notes` の 5 サブキー**。これらは **列削除でなく JSON 更新(既存行の `raw_data` から該当キーを除去)** で対応可能(§D-1)。`notes` / `notes_tool` は温存。

### A-3. 取込専用テーブル/構造の有無

**実態**: import staging / tracking テーブルは **存在しない(0 件)**。マイグレ DDL 上、取込専用の中間テーブルなし。`preset_aliases`(`official_ja_move`)は取込 commit が `UpsertOfficialJaAlias` で投入するが、**技名表示に必須=温存**(`listByCharacterSQL` が JOIN して `NameJa` を付与)。

**M14 スコープへの含意**: 「取込専用テーブル削除」のスコープは **なし**。`preset_aliases` は配布 seed で投入経路を持つ必要がある(§E-3。取込廃止後は手入力 seed 経路)。

### A-4. 取込時のみ走る変換

**実態**(`service/movesimport/parse.go`、取込 preview/commit 経路のみ):
- `computeTotal()`(parse.go:225-248): **`total = 発生 + 持続 − 1 + 硬直`**(§4.3、CHANGE-028)。`全体 N`(弾系)は `total=N`。算出不能は nil + `WarnTotalNull`。
- `normalizeProperties()`(parse.go:282-): 公式属性のコード値検証 + 余剰を `properties_extra` へ退避。
- `validateComboScaling()`(parse.go:304-): JSON 整形式チェック。
- `parseFrameAdvantage()`(parse.go:265-): on_hit/on_block の符号付き整数化・退避。
- `recoveryWord` 検出(`recoveryWords = {"空振り","増加","減少","全体","変化"}`)。

**重要**: 技編集 PATCH(`repository/move/edit.go:UpdateFields`)は **`total` を再算出しない**。入力値をそのまま `total` 列へ書く。⇒ 上記変換群は **すべて取込パイプライン専用**で、削除対象に含まれうる(技編集側に等価ロジックなし)。

**M14 スコープへの含意**: 取込削除で `computeTotal` / `normalizeProperties` / `parseFrameAdvantage` 等は一緒に消える。手入力配布では **手入力ツール側(`moves-input-tool`)が同等の正規化を担い、`total` は本体が CSV 取込時に算出**していた(§G)。取込廃止後は **これらの算出責務をどこが持つか(seed 生成時に確定値で投入するか)** が論点。

---

## B. 取込↔技編集の共有経路切り分け(削除安全性の核心)

### B-1. movesimport の service/repository 特定 — 共有か独自 upsert か

**実態**: `internal/service/movesimport/service.go`:
- `service` 構造体は `db *sql.DB` / `moveRepo moverepo.Repository` / `charRepo charrepo.Repository` を保持。
- `Commit` → `commitRow`(行単位 tx)で **`move` repository を共有**して呼ぶ:
  - `s.moveRepo.UpsertMove(ctx, tx, &row.Move)`
  - `s.moveRepo.UpsertOfficialJaAlias(ctx, tx, moveID, row.NameJa)`
  - `s.charRepo.UpsertByCode(ctx, tx, gameID, code)` / `s.charRepo.GameIDByCode(...)`
- ⇒ **取込は独自 upsert ではなく、`move`/`character` repository を共有**している。

**`move` Repository インタフェース全 6 メソッド**(`repository/move/repository.go:80-106`):

| メソッド | 利用元 | 分類 |
|---|---|---|
| `ListByCharacter` | GET /api/moves(技セレクタ・編集 list) | 技編集/表示=温存 |
| `GetByID` | GET /api/moves/:id(編集グリッド) | 技編集=温存 |
| `UpdateFields` | PATCH /api/moves/:id(FR703) | 技編集=温存 |
| `InsertRushVariant` | POST /api/moves/:id/rush-variant(FR703) | 技編集=温存 |
| `UpsertMove` | `movesimport.commitRow` | **取込専用** |
| `UpsertOfficialJaAlias` | `movesimport.commitRow` | **取込専用** |

実装ファイル: `upsert.go`(`UpsertMove`/`UpsertOfficialJaAlias` = 取込専用)、`edit.go`(`GetByID`/`UpdateFields` = 編集)、`rush.go`(`InsertRushVariant` = 編集)、`repository.go`(`ListByCharacter` + インタフェース定義)。

**M14 スコープへの含意**: 取込削除時、**`repository/move/upsert.go`(`UpsertMove`/`UpsertOfficialJaAlias`)と Repository インタフェースの当該 2 メソッド宣言が取込専用=削除候補**。残り 4 メソッドは温存。`UpsertOfficialJaAlias` を消す場合、配布 seed が `preset_aliases` を別経路(seed SQL)で投入する前提が要る(§E-3)。

### B-2. 共有関数の全数特定(取込専用 vs 共有の境界)

**実態 — 逆向き依存(温存側が取込パッケージを参照)**。`grep -rn "service/movesimport"` で確定:

| 参照元(温存側) | 参照シンボル | 用途 |
|---|---|---|
| `internal/service/move/service.go:127` | `movesimport.IsKnownProperty` | 技編集 PATCH の properties 値域検証 |
| `internal/api/move/dto.go:32` | `movesimport.WarningCode`(型) | `MoveDetailResponse.Warnings` の型 |
| `internal/api/move/handler.go:57,59,67` | `movesimport.StoredMove`・`movesimport.DeriveStoredWarnings` | GET /api/moves 一覧で保存済みデータから「要確認」を再導出 |

これらの定義元(`internal/service/movesimport/`):
- `warning.go`: `IsKnownProperty`(L22)、`StoredMove`(L12、型)、`DeriveStoredWarnings`(L35)。
- `types.go`: `WarningCode`(L19、型)+ `WarningCode` 定数群(L21-)、`MaxImportRows`(L13)、`PreviewRow`/`RowStatus`/`RowResult`/`Selection`。

**取込専用シンボル**(他から参照されない): `service.go`(`Commit`/`commitRow`/`New`)、`parse.go`(`ParsePreview`)、`api/movesimport/*`、`repository/move/upsert.go`。

**M14 スコープへの含意(削除安全性の境界 = 核心)**: **`service/movesimport` をパッケージごと削除すると、技編集(`service/move`・`api/move`)がコンパイル不能になる**。共有されているのは:
1. `IsKnownProperty`(properties ホワイトリスト検証)
2. `WarningCode` 型 + 定数
3. `StoredMove` 型 + `DeriveStoredWarnings`(保存データからの要確認再導出)

これらを **共有の置き場(例: `service/move` 配下 or 中立パッケージ)へ移設**してからでないと取込パッケージを消せない。⇒ 段階削除が必須。

**推奨(決定しない)**:
- 案 a: 共有 3 群を技編集側へ移設 → 取込パッケージを完全削除(完全削除路線)。
- 案 b: 取込ハンドラ・ルート・commit/parse のみ削除し、`warning.go`/`types.go(WarningCode)` を温存して技編集が参照継続(残置路線)。
- いずれも CHANGE 起票対象(移設は DES-002/§5.17 系の構成変更)。決定は Plan Mode。

### B-3. フロント features/import 削除時の共有物

**実態**(grep `features/import` / `features/moves` / `move-warning`):
- **`features/moves`(技編集)は `features/import` を一切 import しない**(逆依存なし)。
- `features/import`(削除側)→ `ImportMovesPage.tsx:27` が `@/features/moves/types` の `MOVE_CATEGORY_LABEL_JA` を参照(取込ページ→技編集型の片方向依存。削除で消える)。
- **共有 SSOT: `web/src/constants/move-warning.ts`**。`WARNING_CODE_VALUES` / `WARNING_LABEL_JA` / 型 `WarningCode` を **双方が参照**:
  - 技編集: `features/moves/types.ts:4`、`features/moves/MoveEditGrid.tsx:5`(温存=要保持)。
  - 取込: `features/import/types.ts:4`(`ImportWarningCode` / `IMPORT_WARNING_LABEL_JA` は後方互換エイリアス)、`pages/ImportMovesPage.tsx:21`。
- **queryKey 相互作用**: 取込 commit は `qc.invalidateQueries({ queryKey: ["moves"] })`(広域)。技編集は `["moves","by-character",characterId]` と `["move",id]` を使用/invalidate。取込削除で広域 invalidate が消えるが、**技編集自身の invalidate は独立して機能**(編集→一覧反映は自前で完結)。

**M14 スコープへの含意**: フロント取込削除の安全境界は明快。**`web/src/constants/move-warning.ts` を温存**すれば技編集は壊れない。`features/import/` ディレクトリ + `ImportMovesPage.tsx`(+test)+ router ルート + Header エントリのみ削除対象。`MOVE_CATEGORY_LABEL_JA` は技編集側にあるため影響なし。

### B-4. 画面17 削除に伴うナビ導線の波及

**実態**:
- `web/src/router.tsx:34-35`: `/import/moves`(ImportMovesPage)と `/moves/edit`(MovesEditGridPage)は **別ルートで独立**。
- `web/src/components/Header.tsx:25-26`: `{ to: "/import/moves", label: "技取込" }` と `{ to: "/moves/edit", label: "技編集" }` が **別エントリ**。
- **画面18(技編集)の導線は画面17 を経由しない**。`MovesEditGridPage.tsx` は `features/moves` のみ参照。

**M14 スコープへの含意**: 画面17 削除 = **Header の「技取込」エントリ 1 件と router ルート 1 件の除去**で完結。技編集への代替導線は不要。commit 後遷移(CHANGE-033)は取込フロー内で閉じるため波及なし(取込ごと削除)。

---

## C. 取込パイプライン削除のスコープ(段階削除の材料)

### C-1. 削除対象の全数列挙

**バックエンド**:
- `internal/api/movesimport/`(`handler.go` / `routes.go` / `dto.go`)。
- `internal/service/movesimport/` のうち **取込専用**: `service.go`(`New`/`Commit`/`commitRow`)、`parse.go`(`ParsePreview` 等)、`commit_test.go` / `parse_test.go`。
  - **温存/移設要**: `warning.go`(`IsKnownProperty`/`StoredMove`/`DeriveStoredWarnings`)・`types.go` の `WarningCode` 型+定数(§B-2)。`warning_test.go` も該当ロジックに追随。
- `internal/repository/move/upsert.go`(`UpsertMove`/`UpsertOfficialJaAlias`)+ `repository.go` の当該 2 メソッド宣言。
- ルート: `POST /api/import/moves` / `POST /api/import/moves/preview`(`movesimport/routes.go`)。
- `cmd/combomgr/main.go`: `importsvc`(L53)・`importhandler`(L33)の wiring。

**フロント**:
- `web/src/features/import/`(`api.ts` / `types.ts` / `types.test.ts`)。
- `web/src/pages/ImportMovesPage.tsx` + `ImportMovesPage.test.tsx`。
- `web/src/router.tsx` の `/import/moves` ルート + import 文。
- `web/src/components/Header.tsx` の「技取込」エントリ。
- **温存**: `web/src/constants/move-warning.ts`(§B-3)。

**テスト**: `ImportMovesPage.test.tsx`、`service/movesimport/{commit_test,parse_test,warning_test}.go`。E2E に取込シナリオがあれば該当(本調査では features/import 直下に E2E 無し。`add_e2e_spec` 系の spec は別途要確認 = **未確認**)。

### C-2. 完全削除 vs dev/検証専用残置

**実態**: §B-2 の通り、技編集が `service/movesimport` の 3 シンボルを参照するため、**「パッケージ完全削除」は共有シンボル移設が前提**。検証 CSV(HTML 由来)の継続運用は **別ツール `combomgr-importer`(HTML→CSV、git 追跡外)** が担っており、本体取込経路を dev 残置しなくても検証 CSV 生成は本体外で完結する(§F・§G)。

**M14 スコープへの含意**:
- 完全削除(既定線): 共有 3 群移設 → 取込パッケージ・ルート・画面を全消去。配布物から取込経路が消え OSS 健全。
- dev 残置: 取込経路を build tag や別ルートで残す場合、配布物(バイナリ・git)からの除外方法が必要。ただし `combomgr-importer` が検証用 CSV を本体外で生成できるため、**本体内に取込経路を残す必然性は実コード上は低い**(事実。判断は開発者)。

### C-3. REQ/DES の改訂範囲(見立て)

**実態(該当節)**:
- **REQ-001 FR704**(本体取込)= 降格 or 削除対象。**FR701**(別ツール `combomgr-importer`/`moves-input-tool` 系)・**FR703**(技編集)は存続(波及は文言調整のみの可能性)。
- **DES-002 §4.2**(取込エンドポイント)・**§7.5**(FR704 CSV 契約・正規化責務)= 取込削除に伴い改訂。
- **DES-005 §5.17**(画面17 取込プレビュー)= 削除。**§5.18**(画面18 技編集)・§4.1(導線、Header の「技取込」)= 導線文言改訂。
- 連番 = 次マイグレ **000018**(最新 000017 の次。確認済み)。

**M14 スコープへの含意**: CHANGE 起票対象 = REQ-001 + DES-002 + DES-005(+ 共有シンボル移設なら DES-002 構成節)。起票は M14-01〜03 修正サブ側(本調査は起票しない)。

---

## D. 列/テーブル削除の破壊的マイグレ評価

### D-1. 削除候補の破壊的マイグレ要否

**実態**: §A-1 の通り **列削除候補は実質ゼロ**。削除実体は §A-2 の `raw_data` サブキー 5 種。
- **`raw_data` サブキー削除 = 列削除ではなく JSON 更新**(既存行の `raw_data` から該当キーを除去する `UPDATE`)で済む。テーブル再構築不要。
- 仮に列を落とす必要が出た場合、前例が 2 系統:
  - **直接 `ALTER TABLE moves DROP COLUMN`**(SQLite 3.35+)。実績: `000008`(combos 2 列)、`000013.down`(moves 8 列を直接 DROP)。
  - **テーブル再構築 + FK=OFF + 一時名経由**(`000016`: `new_combos` 作成→コピー→旧 DROP→RENAME。migrate 接続が `foreign_keys=OFF`〔modernc 既定、`migrate.go`〕のため子テーブル CASCADE を回避し、一時名経由で子の `"combos"` 参照を保つ)。

**M14 スコープへの含意**: M14-01 がもし列削除を含むなら 000016 技法を踏襲。`raw_data` サブキー整理なら軽量 JSON UPDATE マイグレで足りる。

### D-2. dbtest.Setup / 既存マイグレテストへの波及

**実態**:
- `internal/testutil/dbtest/dbtest.go:25 Setup` / `:45 SetupWithPath` が **全マイグレを適用**して in-memory/一時 DB を構築。多数のリポジトリ/ハンドラテストが依存(`repository/{preset,combo,tag,setup}`、`api/{move,preset,character,debug}`、`service/movesimport/commit_test.go` 等)。
- `internal/infra/migration/migrate_test.go` がマイグレ round-trip(up/down)を検証。`migrate.go` は `foreign_keys` pragma 無し接続(FK=OFF)。
- retrospective-digest §5 の教訓: **破壊的マイグレ × `dbtest.Setup`** の同居注意、**FK=OFF と明示 DELETE を同一指示書に同居させない**(M12-5)。

**M14 スコープへの含意**: 新マイグレ(000018)追加で `dbtest.Setup` 経由の全テストが新スキーマで走る。取込テスト(`commit_test.go`/`parse_test.go`)は取込削除で除去。`migrate_test.go` の down 整合(削除列/サブキーの down 復元)を要確認。**FK=OFF と明示 DELETE の同居回避**は seed 投入マイグレ(§E)設計時の前提。

### D-3. moves への参照 FK・依存の全数

**実態**(`grep -i "references moves"` + 000001 全読):

| 参照元.列 | 句 | NULL 可 | CASCADE |
|---|---|---|---|
| `moves.original_move_id` | REFERENCES moves(id)(自己参照、rush→基技) | 可 | なし |
| `combos.starter_move_id` | REFERENCES moves(id)(000016 で再宣言) | 可 | なし |
| `combo_steps.move_id` | REFERENCES moves(id) | 可(NULL=非技ステップ) | なし(combo_steps は combos に CASCADE) |
| `setup_steps.move_id` | REFERENCES moves(id) | 可 | なし |
| `preset_aliases.move_id` | **NOT NULL** REFERENCES moves(id) | **不可** | なし |

**M14 スコープへの含意**: moves **行**削除は `preset_aliases`(NOT NULL)を含む 4 テーブル + 自己参照を壊す(000017 が順序付き明示 DELETE で対処した型)。ただし **M14 は moves 行を消すのではなく増やす(配布 seed)** 方向のため、行削除リスクは主に再構築マイグレ時の一時的整合性(FK=OFF 期間)に限定。**列削除**は上記 FK には影響しない(FK 列は `id`/`character_id` 系で削除候補外)。

---

## E. 配布 DB 同梱(手入力データの seed 投入)

### E-1. 現行 moves データの由来(キャラ別確定)

**実態**(全 seed マイグレ read):

| キャラ code | name_ja/en | characters 行 | moves seed | 状態(000017 適用後) |
|---|---|---|---|---|
| `ryu` | リュウ/Ryu | ○(000003) | **56 行**(000004、code は 000017 で正規化) | live |
| `aki` | AKI/A.K.I. | 000009 追加 → **000017 で DELETE** | 000010 → **000017 で DELETE** | 消滅 |
| `jamie` | ジェイミー/Jamie | 000009 → **000017 DELETE** | 000010 → **000017 DELETE** | 消滅 |
| `guile` | ガイル/Guile | 000009 → **000017 DELETE** | 000010 → **000017 DELETE** | 消滅 |
| `ken` | ケン/Ken | ○(000014) | **0 行** | character のみ |
| `ingrid` | イングリッド/Ingrid | ○(000014) | **0 行** | character のみ |
| `c_viper` | C.ヴァイパー/C.Viper | ○(000014) | **0 行** | character のみ |
| `dhalsim` | ダルシム/Dhalsim | ○(000014) | **0 行** | character のみ |

**000017 適用後の live 状態**: characters 5 行(ryu / ken / ingrid / c_viper / dhalsim)。**moves を持つのは ryu のみ(56 行)**。ken/ingrid/c_viper/dhalsim は characters 行のみで moves 0 件 = 取込(FR704)前提だった。

**契約・正典との差(想定外の発見)**: 指示書 §3.2 は「seed = 000004(ryu)・000010(aki/jamie/guile、000017 で整理)」「classic5 のうち ken/ingrid/c_viper/dalsim の moves は取込由来」と記述。実態は:
1. **aki/jamie/guile は 000017 で「整理」ではなく完全 DELETE**(characters/moves/preset_aliases/combos まで)。現 live に存在しない。
2. 正コードは **`dhalsim`**(`dalsim` ではない)。
3. classic5 = ryu/ken/ingrid/c_viper/dhalsim と解すると、**ryu 以外の 4 体が moves 未投入**(取込前提)。

### E-2. 配布 DB 同梱の方式

**実態**:
- 現行 seed 形式の前例 = `000004`(ryu): `INSERT INTO moves (character_id, code, category, properties[, original_move_id]) VALUES ...`。**フレーム/damage/gauge/raw_data 列は NULL** のまま投入(取込/技編集で後埋め前提)。手書き SQL。
- 手入力ツール `moves-input-tool` の出力は **22 列 FR704 CSV**(§G)。本体は CSV を取込 commit で moves へ upsert していた。
- 配布バイナリは `migrations/*.sql` を `go:embed`(§F)。**seed は SQL マイグレとして同梱**される設計。

**M14 スコープへの含意**: 全キャラ moves を配布するには **CSV → seed SQL への変換経路**が要る(手書き seed か、CSV→INSERT 自動生成か)。大量キャラ分のため:
- 案 a: 1 キャラ 1 マイグレ(000004 流。レビュー単位細分、連番増大)。
- 案 b: 一括 seed マイグレ(連番節約、巨大ファイル)。
- 算出列(`total` 等)は取込時算出だったため、**seed には確定値を直接書く**(手入力ツール/突合で確定した値)か、別途算出スクリプトが要る(§A-4)。決定は Plan Mode。

### E-3. characters/custom_states/preset_aliases の配布整合

**実態**:
- **characters**: seed 済み 5 体(ryu/ken/ingrid/c_viper/dhalsim)。SF6 フルロスター(~26 体規模)に対し大半未投入(他キャラ code は migrations に 0 件)。
- **custom_states**: `000015` で ryu(denjin_charge)/ ingrid(sun_crest)/ c_viper(limit_decoupler)のみ設定。ken/dhalsim は NULL。aki/jamie/guile は設定後 000017 で消滅。
- **presets**: `000005` で 5 種 built-in(`official_ja_move` / `official_ja_command` / `numeric_ja` / `numeric_en` / `srk`、user_id NULL)。キャラ非依存。
- **preset_aliases**: `000006` で **ryu の official_ja_move のみ**。aki/jamie/guile 分(000011)は 000017 で DELETE。ken/ingrid/c_viper/dhalsim は moves 不在のためエイリアスなし。

**M14 スコープへの含意**: 配布対象=全キャラに対し、**moves だけでなく characters 行・custom_states・official_ja_move エイリアスも全キャラ分の seed が必要**。`UpsertOfficialJaAlias`(取込経路)を消すなら、エイリアスは seed SQL で投入する経路に一本化が要る(§B-1)。
- **モダン版(条件付き論点)**: `combomgr-importer/testdata/modern/` に modern HTML が存在(ryu/jamie/cammy/zangief の ja/en)。ただし `combomgr-importer` はモダン保存を**明示拒否**(README)、`moves-input-tool` は custom_states を FR704 22 列外として**除外**(CHANGE-040)。phase3 にモダン対応(ISSUE-007)を含めるかは現 overview ではフェーズ4。**同一キャラのモダン操作差分の持ち方**(別 character 行 or moves 拡張)は未設計 = phase3 スコープ確定後に別途。本調査は論点提示にとどめる。

---

## F. 配布健全化(配布禁止 HTML・検証 CSV の除外)

**実態**:
- **配布禁止 HTML・HTML 由来 CSV の所在**(`find` 全数):
  - `combomgr-importer/testdata/*.html`(SF6 フルロスター ja+en、約 90 ファイル。`modern/` 配下に modern 4 体 ja/en も)。`combomgr-importer/dist/*.csv`(ken/ryu/ingrid/dhalsim/c_viper)。`combomgr-importer/testdata/golden/*.csv`(フルロスターの golden CSV、約 35)。
  - `work_html/{guile,aki,jamie}.html`(+ `*_files/` ディレクトリ)。
- **git 追跡状態**: 上記は **すべて `.gitignore` 済み**で **git 追跡 0 件**:
  - `.gitignore`: `work_html/`(L81)、`combomgr-importer/`(L84)、`autopilot-combomgr/`(L87、`moves-input-tool` を含む)、`/tmp/`(L16)。
  - `git ls-files` 確認: `combomgr-importer/` 0 件、`work_html/` 0 件、`autopilot-combomgr/` 0 件、`tmp/` 0 件。
- **バイナリ同梱(`go:embed`)**: メインモジュールの embed は **`web/dist`(`embed_web_release.go:21`)と `migrations/*.sql`(`embed_migrations.go:25`)のみ**。HTML/CSV は同梱されない。DB は起動時に `migrations/` を適用して構築(`internal/infra/migration/migrate.go`)。
- 本体ライセンス MIT(DES-001 §5)。

**契約・正典との差**: なし。配布禁止データは設計意図どおり git 追跡外・非 embed。

**M14 スコープへの含意**: **現時点で配布物(git リポジトリ・単一バイナリ)に配布禁止 HTML / HTML 由来検証 CSV は含まれていない**。検証データ(`combomgr-importer/`・`work_html/`)は既に dev 作業ツリー限定に隔離済み。M14-03(配布健全化)で新たに除外作業が必要なものは、本調査の grep 範囲では **検出されず(0 件)**。
- **留意(事実)**: `docs/usermanual/*.html` や `docs/human-notes/future-notes/*.html` は git 追跡対象(ドキュメント HTML であり公式フレームデータ HTML ではない)。配布禁止対象ではないが、`docs/human-notes/future-notes/combmgr-framedata-legal-decision.html` 等は配布要否(OSS 公開可否)を別途確認する価値がある = **未判断(本調査スコープ外、事実のみ記載)**。

---

## G. 手入力ツール CSV 照合(`moves-input-tool`)

> 注: 本体周辺には **2 つの別ツール**が存在する。(i) **`combomgr-importer`**(HTML→CSV、TOOL-002、クラシック+ja/en のみ、モダン拒否、検証用 CSV/Markdown 出力)。(ii) **`moves-input-tool`**(手入力→FR704 22 列 CSV、本指示書 G の対象)。両者とも git 追跡外。

### G-1. 取込規則(正典)と CSV 契約

**実態 — `SPEC-fr704-intake.md`(FR704 取込規則の「正」)/ `config/fr704-csv.yaml` / コードの三者一致**:
- **CSV 列 = 22 列・固定順**(YAML `csv.columns` / `model.MoveRow` / SPEC 一致):
  `character_code, move_code, category, name_ja, startup, active, recovery, on_hit, on_block, drive_gauge_increase, drive_gauge_decrease_guard, drive_gauge_decrease_punish, super_art_gauge_increase, damage, combo_scaling, properties, is_aerial, setup_only, notes, command, condition_ja, condition_en`
- 必須(YAML `required:true`): `character_code` / `move_code` / `category` / `name_ja`。他は空=NULL 許容。
- **意図的に非出力**: `total`(本体が startup+active+recovery から算出)、`name_en`(フェーズ2 除外)、`original_move_code`(rush は出力しない)。
- `recovery` は CSV に raw 文字列で載るが **DB 非永続**(total 算出材料)。
- properties enum: `high, mid, low, throw, projectile, air_projectile`。category enum: `normal, special, unique, super_art, critical_art, throw, system, target_combo, rush_variant, drive_impact`。
- raw_data 退避: `notes` / `command` / `condition_ja` / `condition_en` / properties 余剰 → `properties_extra`。
- 正規化(ツール一次・本体防御的再正規化): on_hit/on_block の `D`/`KD`/`※N`/範囲 退避、active 範囲→カウント、properties コード化+余剰退避、name_ja 末尾 `（…）`/`: …` 除去。
- codegen = **moves.code 文字列生成**(英語表示名→snake_case slug、DES-004 §2.1)。SQL/Go コード生成ではない。
- 出力 = **CSV のみ**(`GET /api/export` text/csv、`movestool prefill`)。**本体 DB を一切触らない**(全パッケージコメントに明記)。

### G-2. 公式 HTML 突合(手入力検証)機能

**実態**(`internal/reconcile/reconcile.go`):
- **入力は HTML ではなく CSV/TSV**(区切りを sniff)。HTML→表データ化は **本ツールのスコープ外**(既タブ化済みの公式データを消費)。**HTML パース機能は 0 件**。
- `ParseOfficial(r)`(`character_code`/`move_code` ヘッダ必須)+ `Reconcile(hand, official, cfg, fields) []Diff`。
- 比較キー = `(character_code, move_code)`。`fields` 空なら **config の全 integer 列**(startup/active/on_hit/on_block/drive_gauge_*/super_art_gauge_increase/damage)を比較。
- 出力 = `[]Diff`(`mismatch` / `missing_in_official` / `missing_in_hand`)。整形レポートファイルではなく、CLI `reconcile` サブコマンド表示 + web UI セル強調。
- **コード内 TODO**: 「FR701 公式データの正確な列レイアウトは手元にない。ヘッダ名一致の暫定実装」。

**契約・正典との差(旧式の可能性 = 開発者注記の具体化)**:
- ツール `model.MoveRow` の JSON タグは **snake_case**(`json:"character_code"`)。本体 CLAUDE.md §4 は **camelCase** を要求。ツール内部用(本体取込時に remap、INTAKE.md §5)= 設計上の差で誤りではない。
- ツールのゲージ/damage 列は全て `integer`(`*int`)。本体は `combos.drive_damage` を REAL 化済み(000016)だが **`moves` のゲージ/damage 列は INTEGER のまま**(§A-1)。SPEC も M12 の combos 側 REAL 化は FR704 非影響と明記 ⇒ **現時点で moves 列型の乖離はなし**(REAL 化は combos 限定)。
- `name_en` / EN ロケール除外(フェーズ2)、`command` 語彙未実装(raw passthrough、TOOL-002 §9.9 待ち)、FR701 公式列レイアウト未確定(ヘッダ名一致の暫定)= いずれも既知の未完/意図的後回し。
- custom_states(例: Manon medal_level)は FR704 22 列外として除外(CHANGE-040)。

**M14 スコープへの含意**: 配布 seed 生成にツール CSV を使う場合、(i) 22 列 CSV → 本体 moves 列マッピング(camelCase remap・total 算出・raw_data 構築)が要る、(ii) 突合機能の入力は **公式 HTML ではなく既タブ化 CSV/TSV** のため、HTML→CSV 化は `combomgr-importer` 側 or 手作業に依存する(検証運用の前提)。ツールの「旧式」懸念は型乖離としては顕在化していない(列名/順は SPEC・YAML・コードで一致)。

---

## 想定外の発見(§0.3 許可の事実指摘)

1. **aki/jamie/guile の扱い**: 指示書 §3.2 は「000010(aki/jamie/guile、000017 で整理)」と記すが、実態は **000017 で完全 DELETE**(characters/moves/preset_aliases/combos まで)。現 live に 3 体は存在しない。配布対象=全キャラの観点では、この 3 体も **未投入キャラ扱い**(再 seed が必要)。
2. **キャラコード表記**: 指示書 §3.2/§E は `dalsim` と記すが、実 seed コードは **`dhalsim`**(000014)。
3. **raw_data パース範囲**: 指示書 §3.2 は「FR703 編集器がパース」とのみ記すが、実態は **`notes`(表示)/`notes_tool`(編集)のみパース**し、残り 5 キーは round-trip 保持(§A-2)。退避キーの削除候補は 5 種に確定。
4. **取込の repository 共有**: 指示書 §3.2 は「`movesimport.Commit` の upsert が `move` の repository を共有するか独自実装かは未確認」とするが、**実態は共有**(`UpsertMove`/`UpsertOfficialJaAlias` を `move` repository に持ち、取込 service が呼ぶ)。さらに **逆向き依存**(技編集が取込パッケージの `IsKnownProperty`/`WarningCode`/`DeriveStoredWarnings` を参照)が削除安全性の真の核心。

---

## M14-01〜03 スコープ確定のための要決定事項

1. **削除可能列の確定**: A-1 上、**取込専用列は存在しない**。M14-01 で列削除を実施するか(実質ゼロ)、`raw_data` サブキー整理(`command`/`condition_ja`/`condition_en`/`properties_extra`/`import_notes` の 5 種)に限定するか。
2. **raw_data サブキー削除の方式**: 列削除でなく JSON UPDATE で除去するか、当面温存(取込廃止後は新規書き込みが止まるだけ)とするか。
3. **共有シンボルの移設可否(削除安全性の核心)**: `service/movesimport` の `IsKnownProperty` / `WarningCode`(型+定数)/ `StoredMove` / `DeriveStoredWarnings` を技編集側 or 中立パッケージへ移設して取込パッケージを完全削除するか(案 a)、`warning.go`/`types.go` を残置するか(案 b)。
4. **取込の完全削除 vs dev 残置**: 既定線=完全削除。検証 CSV は `combomgr-importer`(本体外)で生成可能なため本体内残置の必然性は低い(事実)。最終決定は Plan Mode。
5. **`UpsertOfficialJaAlias` 削除に伴うエイリアス投入経路**: 取込廃止後、`preset_aliases`(official_ja_move)を **seed SQL 経路**へ一本化する前提でよいか。
6. **配布 seed 方式**: 全キャラ moves を 1 キャラ 1 マイグレ(000004 流)で投入するか、一括 seed マイグレにするか。CSV→seed 変換を自動化するか手書きか。算出列(`total` 等)の確定値投入方法。
7. **配布対象キャラの seed 整合**: characters / custom_states / official_ja_move エイリアスも全キャラ分 seed する範囲(現状 5 体・うち moves は ryu のみ)。
8. **dbtest 波及と破壊的マイグレ技法**: 000018 追加時の `dbtest.Setup` 全テスト影響、`migrate_test.go` down 整合、**FK=OFF と明示 DELETE を同一指示書に同居させない**(M12-5)前提の遵守。列削除が出る場合は 000016 のテーブル再構築技法を踏襲するか。
9. **ツール CSV の新旧是正要否**: `moves-input-tool` の 22 列 CSV は SPEC/YAML/コードで一致(列名/順の乖離なし)。snake_case JSON タグ・`command` 語彙未実装・FR701 列レイアウト暫定は既知。本体取込廃止後、ツールを配布 seed 生成の正系として使うか(remap・total 算出責務の所在)。
10. **REQ/DES の CHANGE 範囲**: REQ-001 FR704(降格 or 削除)、DES-002 §4.2/§7.5、DES-005 §5.17(削除)/§5.18・§4.1(導線文言)。起票は M14-01〜03 側。
11. **モダン版を phase3 配布対象に含めるか(別途確定)**: 含める場合の同一キャラ・モダン操作差分の持ち方(別 character 行 / moves 拡張 / custom_states)。現 overview ではフェーズ4。

---

*以上、M14-RESEARCH-01 調査報告。read-only 遵守(コード・設計書・seed・ツールの変更ゼロ、ツールのビルド/実行なし)。本報告が M14-01(列/サブキー見直し)・M14-02(取込パイプライン段階削除)・M14-03(配布 DB 同梱・配布健全化)修正指示書の Plan Mode 入力となる。*
