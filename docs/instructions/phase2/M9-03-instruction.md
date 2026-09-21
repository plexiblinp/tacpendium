# 指示書 M9-03: FR703 手動修正（moves 編集グリッド・ラッシュ版生成）

| 項目 | 内容 |
|------|------|
| 指示書ID | M9-03 |
| バージョン | 1.0.3 |
| 推奨モデル | Opus クラス（ラッシュ生成の original_move_id 派生・編集 UI・複数編集操作の統合。model-allocation 参照） |
| Plan Mode | **必須**（§3.4 / §9.4） |
| 機械レビュー | 必須（別チェックリスト: `M9-03-review-checklist.md`） |
| 並列性 | 単独（直列。M9-02 の取込結果に作用） |
| 依存指示書 | M9-02（取込・moves 書込・preset_aliases・raw_data キー）。**M9-02 の実機ゲート（B-1/2/3/5/6）通過後に着手**すること |
| 想定所要時間 | 240〜300 分（編集 API + ラッシュ生成 + 編集グリッド UI + テスト） |
| 作成者・作成日 | 設計担当 Claude（フェーズ2 継続担当・M9 スパイン）/ 2026-06-14 |

## 更新履歴

| バージョン | 更新日 | 更新内容 |
|-----------|--------|----------|
| 1.0.0 | 2026-06-14 | 初版 |
| 1.0.1 | 2026-06-14 | CHANGE-031 反映に追従。§4.1/§4.6 の文書影響注記を解消（編集 `PATCH /api/moves/:id` + `POST /api/moves/:id/rush-variant` は DES-002 §4.2 v1.16.0、編集グリッドは DES-005 §2 画面18 + §5.18 v2.16.0 に正式記載済み） |
| 1.0.2 | 2026-06-14 | M9-03 Plan Mode 4 決定を反映（CHANGE-032）。§3.4 に確定結果、§4.1 に `GET /api/moves/:id`（単一フル・編集時取得）+ PATCH フル返却 + last-write-wins、§4.2 に rush 重複 409、§4.4 を name_ja 表示のみ（スコープ外）、§4.7 を last-write-wins 確定 |
| 1.0.3 | 2026-06-14 | レビュー指摘の取り込み反映。#1=ラッシュ生成の official_ja エイリアス自動書込を削除（§4.2/§4.4、生成 rush は M9-03 で無名＝既知制約）、#3=rush 衝突は一意制約違反も捕捉しクリーン 409・生 500 を漏らさない（§4.2）、#4=properties は enum select 編集（§4.6）、#5=画面18 のナビ導線は設定/データ管理配下（§4.6、CHANGE-033 で DES-005 §4.1 明記）。#2（未保存 is_aerial の rush ボタンデシンク）は製造担当が修正 |

---

## 1. 背景と目的

### 1.1 背景

- M9-02（FR704）で公式 CSV を DB へ取込済み（characters / moves / preset_aliases）。取込結果には**要確認行**（recovery 要確認語・total NULL・未知 combo_scaling キー・未知 properties・通常投げ 3 件目以降・検出エラー）が含まれる（DES-005 §5.17、WarningCode = CHANGE-030）。
- これらは取込時に**自動算術・自動分類しない方針**（推測しない）で、利用者が手動補正する前提（DES-003 §3.3、DES-002 §7.5）。その受け皿が FR703。
- 現状 moves は **`GET /api/moves` のみ**で更新系エンドポイントが無い（code-facts §4）。本指示書で moves の編集・派生生成を新設する。

### 1.2 目的

完了時に達成される状態:

- 取込済み moves をグリッドで手動修正できる（total・各フレーム・properties・is_aerial・notes 付記）。
- 通常技・特殊技からラッシュ版 move を生成できる（`category = rush_variant` + `original_move_id`、`code = rush_<元技code>`）。
- 通常投げ 3 件目以降・並び順想定外キャラの is_aerial・命名を補正できる。
- 編集は DB 取込時と同等の型・制約検証を通って永続化される（DES-006）。

### 1.3 このマイルストーンで作らないもの（スコープ外）

- 取込パイプライン（FR704、M9-02 完了）・取込プレビュー（画面17）。本指示書は**取込済み（commit 済み）moves** を対象に編集する。
- ラッシュ版エイリアスの自動生成ルール（`DR>` 前置等、DES-003 §3.3 L291）＝ 将来。本指示書は rush_variant move の生成と手動編集まで。
- コマンド表記コンボ機能・英語ロケール・custom_states（フェーズ3 / M11）。
- 破壊的 seed クリア（M12-02）。

---

## 2. 成果物

### 2.1 作成するファイル（想定パス。実配置は既存構成に合わせる）

| ファイル | 内容 |
|---|---|
| `internal/api/move/*.go`（更新系ハンドラ追加） | `PATCH /api/moves/:id`（フィールド編集）+ `POST /api/moves/:id/rush-variant`（ラッシュ版生成）。§4.1 / §4.2 |
| `internal/service/move/*.go`（編集・派生生成サービス） | フィールド更新・ラッシュ版派生（規則検査）・notes 付記編集。§4.2〜§4.5 |
| `internal/repository/move/*.go`（Update / Insert 追加） | moves の Update（部分更新）+ rush_variant Insert（original_move_id 付き） |
| `web/src/features/moves/MoveEditGrid.tsx`（編集グリッド画面） | §4.6 |
| `web/src/features/moves/api.ts`（mutation 追加） | `useUpdateMove` / `useGenerateRushVariant`。query `["moves","by-character",characterId]` を invalidate（code-facts §2 規約） |

### 2.2 修正するファイル

| ファイル | 修正内容 |
|---|---|
| 既存 `internal/api/*/routes.go` 集約点 | moves 更新系ルート配線 |
| `web/src/router.tsx` | 編集グリッド画面のルート追加 |
| 取込フロー（画面17）からの導線 | commit 後に編集グリッドへ遷移できる導線（任意。§4.6） |

### 2.3 変更しないもの

- `GET /api/moves` の API 契約（`MoveResponse`。code-facts §7）。**M8-A4 の重複保持（model.Move / MoveListItem）は本指示書で集約しない**（§4.8。GET 読取路は触らない＝開発者確定 2026-06-14）。
- moves スキーマ（列追加なし。original_move_id / is_aerial は既存列）。
- 取込パイプライン（M9-02）・コンボ CRUD（FR405 等）。

### 2.4 例外条項

- `model.Move` と `MoveListItem` の共有フィールド**乖離検出ガード**（§4.8）は本指示書スコープ内の小タスク（GET 読取路は変更しない範囲）。

---

## 3. 前提条件

### 3.1 必読

- DES-003 v1.19.0 §3.3（is_aerial L279 / category enum L285 / rush 方針 L287-291 / original_move_id L266）
- DES-002 v1.14.0 §4.2（エンドポイント）/ §7.5 L420-424（通常投げ正規化・3 件目以降 要確認・並び補正）
- DES-006 v1.11.0（編集値の型・制約検証）
- CHANGE-030（raw_data 確定キー: notes/notes_tool/command/condition_ja/condition_en/properties_extra/import_notes）。**承認・反映後に着手**
- M9-overview v0.3.0 §4（M9-03 設計）/ §3.9（M8-A4 と乖離ガード）
- code-facts §4（ルート）/ §7（MoveResponse）/ §8/§9（model.Move / MoveListItem）/ §2（mutation invalidate 規約）

### 3.2 任意参照

- `combomgr-importer/dist/*.csv`（実データ。投げ 3 件目の実例 dhalsim `yoga_splash`、要確認行）。
- DES-005 §5.17（取込プレビュー画面。編集グリッドの UI パターン参考）

### 3.3 参照不要

- 取込パイプライン内部（M9-02 完了）・英語ロケール・custom_states。

### 3.4 着手前の確認（Plan Mode 必須。§9.4 と対応）

1. **編集グリッドの画面構成**: 取込プレビュー（画面17）とは別の新規画面（取込済み moves をキャラ単位で編集）とするか。導線（取込 commit 後に遷移／moves 管理から独立アクセス）を確定。→ DES-005 追記（CHANGE-031）に反映。
2. **編集エンドポイントの形**: `PATCH /api/moves/:id`（部分更新）の対象フィールド集合（total・startup・active・on_hit・on_block・drive_gauge_*・super_art_gauge_increase・damage・properties・is_aerial・combo_scaling・raw_data）。楽観ロック（version 列）の要否（combo は version 列を持つが moves は持たない可能性 → code-facts で確認）。
3. **ラッシュ版生成の対象判定**: `category ∈ {normal, unique}` かつ `is_aerial = false`（DES-003 §3.3 L279/L287）をサーバ側で強制するか。重複生成（同 original_move_id の rush_variant が既存）時の扱い（拒否 or 既存返却）。
4. **notes 付記編集の対象**: raw_data の `notes_tool`（`【ツール付記】` ブロック）のみ編集可とし、`notes`（原文ブロック）は表示のみとするか（CHANGE-030 キー構造）。
5. **編集値の検証強度**: FR703 は手動補正のため寛容（要確認状態のまま保存可）か、保存時に DES-006 の型・制約（enum 値域・FK・NOT NULL）を課すか。total は手動入力可（自動算術しない）。

> **Plan Mode 確定結果（開発者決定 2026-06-14、CHANGE-032 で設計書反映済み）**:
> - **1（画面構成）**: 取込プレビュー（画面17）とは別の新規画面（画面18、§5.18）。＝CHANGE-031 反映済み。
> - **2（編集 API 形・楽観ロック）**: `PATCH /api/moves/:id`（ポインタ部分更新・フル move 返却）。**楽観ロックなし＝last-write-wins**（moves に version 列を追加しない）。編集時のフル項目は新設 **`GET /api/moves/:id`**（単一フル）で行単位取得。
> - **3（rush 対象・重複）**: `category ∈ {normal,unique}` ∧ `is_aerial=false` をサーバ強制。**重複時は 409 + 既存 id**。
> - **4（notes 編集対象）**: `notes_tool` のみ編集可、`notes` 原文は表示のみ。**name_ja は表示のみ＝編集スコープ外**（official_ja_move 組み込みプリセット read-only）。
> - **5（検証強度）**: 要確認状態のまま保存可（段階的補正）。enum/FK/NOT NULL は拒否。total は手動入力可。

---

## 4. 詳細仕様

### 4.1 編集エンドポイント `PATCH /api/moves/:id`

- 既存 `PATCH /api/combos/:id`（`combo.Handler.UpdateMetadata`、`UpdateMetadataInput` のポインタ部分更新）と同パターン。`UpdateMoveInput`（各フィールド `*型`、nil は不変更）を受ける。
- 対象: total / startup / active / on_hit / on_block / drive_gauge_increase / drive_gauge_decrease_guard / drive_gauge_decrease_punish / super_art_gauge_increase / damage / properties / is_aerial / combo_scaling / raw_data（notes 付記）。
- 保存時に DES-006 の型・制約検証（enum 値域・NOT NULL・FK）。total は手動入力値をそのまま保存（取込時の「自動算術しない」と整合）。
- **更新後のフル move を返す**（編集グリッドの in-place 同期。Plan Mode-Q1 確定 2026-06-14）。
- **楽観ロックは設けない（MVP は last-write-wins、moves に version 列を追加しない＝スキーマ不変）**（Plan Mode-Q4 確定）。実装時に moves に `updated_at` 等があれば compare-on-write を採ってもよい（スキーマ不変の範囲）。
- **編集時のフル項目取得 `GET /api/moves/:id`（新設、Plan Mode-Q1 確定）**: narrow 一覧（`GET /api/moves`）が返さない 6 フィールド（damage / combo_scaling / drive_gauge_increase / drive_gauge_decrease_punish / super_art_gauge_increase / raw_data）を、編集グリッドが**編集時にその行だけ**取得する単一フル GET。表示・要確認判定は narrow 一覧でまかない、フルは編集時のみ行単位取得（render 時 N+1 を避ける）。一覧契約（MoveResponse）は不変（§4.8 / §2.3）。
- **文書影響（解消済み）**: `PATCH /api/moves/:id` と `GET /api/moves/:id` は **DES-002 §4.2 に記載済み（CHANGE-031 / CHANGE-032、v1.17.0）**。

### 4.2 ラッシュ版生成 `POST /api/moves/:id/rush-variant`

- 対象 move（`:id`）から rush_variant move を派生生成（DES-003 §3.3 L287-291）。
- **規則（サーバ強制）**: 対象は `category ∈ {normal, unique}` かつ `is_aerial = false`（DES-003 §3.3 L279）。違反は 400 + 理由。
- 生成内容: `code = rush_<元技code>`、`category = rush_variant`、`original_move_id = :id`、フレーム・補正値は元技からコピー（利用者が §4.1 で編集）。生成後のフル move を返す。
- **preset_aliases（official_ja_move）へのエイリアス自動書込はしない**（レビュー指摘 #1 / Plan Mode-Q3 / §4.4。`(ラッシュ)` 等の自動命名は §1.3 のとおり将来）。**結果として生成された rush_variant は M9-03 では official_ja 名を持たない（無名）**＝既知の制約。将来の「ラッシュ版エイリアス自動生成ルール」で付与する（§1.3 / §4.4）。
- **重複（同 original_move_id ＝ `rush_<元技code>` が既存）時は 409 Conflict + 既存 rush_variant の id を返す**（Plan Mode-Q2 確定 2026-06-14。生成は create-once。UI は 409 をハードエラーにせず「既に存在」表示で既存行へ誘導。`(character_id, code)` 一意制約と整合）。**事前チェックで弾くだけでなく、一意制約違反（事前チェック通過後の競合等のエッジ含む）も捕捉してクリーンな 409 を返し、生 500 を漏らさない**（レビュー指摘 #3）。

### 4.3 is_aerial 手動トグル

- §4.1 の `PATCH` で `is_aerial` を更新（DES-003 §3.3 L279。接頭辞の付かない空中技を true 化）。
- is_aerial はラッシュ可否（§4.2）に影響するため、トグル後にラッシュ版生成可否が変わる点を UI で反映。

### 4.4 通常投げ並び・命名補正

- 通常投げ 3 件目以降（取込時 要確認＝`extra_throw`、DES-002 §7.5 L422）の **is_aerial 補正は §4.1 の `PATCH` で実施**（実例: dhalsim `yoga_splash`）。
- **name_ja（official_ja_move エイリアス）の編集は M9-03 スコープ外（Plan Mode-Q3 確定 2026-06-14）**: official_ja_move は組み込みプリセットで DES-004 §2.1 上 read-only。本画面では name_ja は**表示のみ**（DES-005 §5.18、CHANGE-032）。取込名は公式名で多くは妥当、要確認は is_aerial/分類で対応。組み込みエイリアスの data-admin 編集可否を整理する後続で命名補正を設計する（preset_aliases 書込経路は本 MVP では作らない）。
- **既知の制約（レビュー指摘 #1 対応）**: §4.2 のとおりラッシュ版生成も official_ja エイリアスを書かないため、**生成された rush_variant は M9-03 では official_ja 名を持たない（無名）**。利用者は M9-03 内では rush 版に名前を付けられない（name 編集スコープ外）。これは §1.3「ラッシュ命名は将来」と Q3「name 表示のみ」の組合せによる想定済みの帰結で、将来のラッシュ命名ルールで解消する。

### 4.5 notes 付記の編集

- raw_data の `notes_tool`（`【ツール付記】` ブロック、CHANGE-030）を編集可能にする。`notes`（原文ブロック）は表示のみ（Plan Mode-4）。
- raw_data の他キー（command/condition_ja/condition_en/properties_extra/import_notes）は表示（編集要否は最小限に）。

### 4.6 編集グリッド UI（DES-005 — 新規画面、CHANGE-031）

- キャラ選択 → 当該キャラの moves をグリッド表示（要確認行を強調＝WarningCode、DES-005 §5.17 と同方式）。
- 各行: フィールドのインライン編集、is_aerial トグル、ラッシュ版生成ボタン（対象カテゴリのみ活性）、notes 付記編集、保存。
- **properties はフリーテキストではなく enum 値の select で編集**（high / mid / low / throw / projectile / air_projectile。レビュー指摘 #4。値域は DES-003 §3.3。typo 由来の unknown_properties を防ぐ。control 型は §9.2 裁量の範囲だが本指示で確定）。
- 大量行（数百行）のテーブル描画・横スクロール（M9-02 B-4 の視覚確認もここで担保）。
- 既存 UI ライブラリ（shadcn/ui）・編集パターン（combo 編集系）を踏襲。
- **共通ヘッダーナビへの導線（レビュー指摘 #5）**: 本画面（画面18）は**主要ナビ（コンボ一覧/マイコンボ/プリセット/設定）には並べず、「設定」配下またはデータ管理セクションに導線を置く**（データ整備系のため。CHANGE-033 で DES-005 §4.1 に明記）。取込 commit 後の遷移（§2.2）も併せて導線とする。
- **文書影響（解消済み）**: 本画面（編集グリッド）は **CHANGE-031 で DES-005 §2 画面18 + §5.18 に新設済み（v2.16.0）**、編集/rush エンドポイントは DES-002 §4.2（v1.17.0）に記載済み、ナビ導線は **CHANGE-033 で DES-005 §4.1 に明記**。製造担当は設計書を正として実装する。

### 4.7 検証（DES-006）

- 編集保存時に型・制約検証。要確認状態（total NULL 等）のまま保存することは許容（FR703 は手動補正＝段階的修正を許す）が、enum 値域・FK・NOT NULL 違反は拒否。
- **楽観ロックは設けない（MVP は last-write-wins、moves に version 列を追加しない＝スキーマ不変）**（Plan Mode-Q4 確定 2026-06-14）。combos は version 列を持つが、moves 編集は単一利用者・低頻度補正で lost-update リスクが小さく、スキーマ変更（§2.3 範囲外）を避ける。実需（LAN 多人数編集等）が出れば version 列を別 CHANGE で追加。moves に `updated_at` 等があれば compare-on-write を採るのは可（スキーマ不変の範囲）。

### 4.8 model.Move 乖離検出ガード（M8-A4。§3.9）

- GET 読取路は変更しない（開発者確定）。`model.Move`（取込で活性化）と `MoveListItem`（GET 投影）の**共有フィールド集合の一致を検証する単体テスト**を追加し、将来の列追加時の同期漏れを検出可能にする。または最低限、両 struct に相互参照コメント。集約自体は行わない（別指示）。

---

## 5. テスト要件

### 5.1 必須テスト（Go test / Vitest）

Go test:
- `PATCH /api/moves/:id`: 部分更新（指定フィールドのみ変更・nil 不変更）、enum 値域違反拒否、total 手動値保存、raw_data notes_tool 更新。
- ラッシュ版生成: 対象カテゴリ（normal/unique ∧ is_aerial=false）で生成（code=rush_<元技>・original_move_id 設定）、対象外（special/throw/is_aerial=true）で 400、重複時の確定挙動。
- 投げ 3 件目補正: extra_throw 行の is_aerial・エイリアス更新。
- model.Move / MoveListItem 共有フィールド一致テスト（§4.8）。

Vitest:
- 編集グリッド: インライン編集・is_aerial トグル・ラッシュ生成ボタンの活性条件・要確認強調・保存。

### 5.2 E2E シナリオ（seed 非依存 self-contained）

- 取込済み move を編集（total 手動入力）→ 保存 → `GET /api/moves` に反映。
- normal 技からラッシュ版生成 → グリッドに rush_variant 行が出現。
- 既存 combo-crud / 取込 spec が引き続き通過。視覚/レスポンシブは手動継続。

---

## 6. レビュー観点（別ファイル）

機械レビューは `M9-03-review-checklist.md` に従う（本指示書と対で設計担当が作成）。

---

## 7. 完了条件（DoD）

### 7.1 機能要件
- `PATCH /api/moves/:id` で取込済み move を編集・永続化できる。
- `POST /api/moves/:id/rush-variant` で規則に沿ってラッシュ版を生成できる。
- 編集グリッドで編集・トグル・生成・notes 付記編集・保存が動作する。
- `GET /api/moves`（MoveResponse 契約）が不変。

### 7.2 自己テスト結果
- §5.1 の Go test / Vitest ケースが全通過（ケース数で報告）。§4.8 の乖離ガードを含む。

### 7.3 品質チェック
- `make e2e`（§5.2 追加後）通過。既存 combo-crud / 取込 spec が通過。
- `GET /api/moves` 契約に差分なし。

### 7.4 ドキュメント
- 編集/rush エンドポイント・編集グリッド画面の DES 追記は設計担当が CHANGE-031 で対応（製造担当は実装のみ）。

### 7.5 完了報告
- Plan Mode で確定した編集 API 形・rush 重複挙動・画面構成・検証強度、テストケース数を報告。

---

## 8. 参照ドキュメント

| 文書 | 節 | 用途 |
|------|-----|------|
| DES-003 v1.19.0 | §3.3 | is_aerial / category / rush 方針 / original_move_id |
| DES-002 v1.14.0 | §4.2 / §7.5 | エンドポイント / 通常投げ補正 |
| DES-006 v1.11.0 | 検証 | 編集値の型・制約 |
| CHANGE-030 | — | raw_data 確定キー（notes 付記編集の対象） |
| M9-overview | v0.3.0 §4 / §3.9 | M9-03 設計 / 乖離ガード |
| code-facts | §2/§4/§7/§8/§9 | mutation 規約 / ルート / MoveResponse / model.Move |

---

## 9. 注意事項・判断に迷ったら

### 9.1 推測で進めてはいけない事項
- 画面構成・編集 API 形・rush 重複挙動・検証強度（§3.4 を Plan Mode で確定）。
- `GET /api/moves` 契約（MoveResponse）の変更: 不可。
- model.Move の集約（GET 読取路変更を伴う）: 本指示書では行わない（乖離ガードのみ）。

### 9.2 推測で進めてよい事項（明示）
- ハンドラ/サービス/フックの内部構成・ファイル分割は既存パターン（code-facts §2/§4）に合わせて裁量。
- 編集グリッドのレイアウト詳細は shadcn/ui・combo 編集系パターンに合わせて裁量。

### 9.3 不明事項発見時
- Plan Mode 質問書（playbook §8.4 方式）で開発者へ。

### 9.4 Plan Mode 必須項目
- §3.4 の 5 項目（画面構成 / 編集 API 形・version / rush 対象判定・重複 / notes 編集対象 / 検証強度）。

---

## 10. 完了後の次ステップ
- **CHANGE-031**（設計担当）: DES-002 §4.2（PATCH /api/moves/:id + rush-variant）+ DES-005（編集グリッド画面）。本指示書 §4.1/§4.6 の仕様確定後・着手前に起票。
- M9 完了 → M10 以降（phase2-overview）。
- model-allocation に M9-03 行を追記（着手時）。

---

*以上、M9-03 製造指示書 v1.0.3*
