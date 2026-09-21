# CHANGE-031 通知書: moves 編集／ラッシュ版生成エンドポイントと編集グリッド画面の追加

| 項目 | 内容 |
|------|------|
| 通知書ID | CHANGE-031 |
| バージョン | 1.0.0（承認・反映済み） |
| 起票日 | 2026-06-14 |
| 起票者 | 設計担当 Claude（フェーズ2 継続担当・M9 スパイン） |
| 承認者 | 開発者（2026-06-14 承認） |
| ステータス | 承認・反映済み（DES-002 v1.16.0 / DES-005 v2.16.0、change-report-031、registry v1.18.0） |
| 影響範囲（設計書本体） | DES-002 §4.2（moves 編集 `PATCH /api/moves/:id` + ラッシュ版生成 `POST /api/moves/:id/rush-variant` の追加）、DES-005 §2 画面一覧 + §5.18（moves 編集グリッド画面の新設） |
| 前提文書 | M9-03-instruction v1.0.0 §4.1（編集エンドポイント）/ §4.2（ラッシュ版生成）/ §4.6（編集グリッド UI）、m9-overview v0.3.0 §4、DES-002 v1.15.0 §4.2、DES-005 v2.15.0 §2 / §5.17、DES-003 v1.20.0 §3.3（rush 方針・is_aerial・original_move_id・category enum） |
| 関連 | CHANGE-029（取込プレビュー画面・/preview）、CHANGE-030（取込 API/データ契約）。本 CHANGE は M9-03（FR703 手動修正）の編集 API・UI を設計書本体へ確定する |

---

## 1. 変更の概要

M9-03（FR703 手動修正）で取込済み moves の編集・ラッシュ版生成・編集グリッドを新設するため、設計書本体を 2 点改訂する。

1. **DES-002 §4.2**: moves の更新系エンドポイント 2 本を追加 — `PATCH /api/moves/:id`（フィールド部分更新）+ `POST /api/moves/:id/rush-variant`（ラッシュ版生成）。
2. **DES-005**: moves 編集グリッド画面を新設する（§2 画面一覧に画面18 + §5.18 詳細）。

スキーマ・データモデル・enum・total 式・取込契約は変更しない（CHANGE-022/025/026/027/028/029/030 で確定済み）。本 CHANGE は編集エンドポイントと編集 UI の追加のみ。

---

## 2. 変更の理由

- **moves に更新系がない**: 現状 moves は `GET /api/moves` のみ（取込は別経路 `/api/import/moves`）。FR703 は取込済み moves の手動修正（total・各フレーム・properties・is_aerial・notes 付記）とラッシュ版生成を行うため、更新系エンドポイントが要る。
- **DES-005 に編集 UI が未定義**: §5.17（画面17）は取込プレビュー（FR704）専用で、取込済み moves を編集するグリッド UI は未定義。FR703 のためにこの画面定義が要る。
- **ラッシュ版生成の規則を API に確定**: DES-003 §3.3（`category ∈ {normal, unique}` ∧ `is_aerial = false` → `rush_<元技code>` + `original_move_id`）を生成エンドポイントの契約として確定する。

---

## 3. 変更の内容

### 3.1 DES-002 §4.2: moves 編集／ラッシュ版生成エンドポイントの追加

§4.2 のエンドポイント表に次の 2 行を追加する。

| メソッド | パス | 説明 |
|---|---|---|
| PATCH | `/api/moves/:id` | 取込済み move のフィールド部分更新（FR703、フェーズ2）。対象: total / startup / active / on_hit / on_block / drive_gauge_* / super_art_gauge_increase / damage / properties / is_aerial / combo_scaling / raw_data（notes 付記）。リクエストは各フィールドのポインタ（nil は不変更、`PATCH /api/combos/:id` と同方式）。保存時に型・制約検証（DES-006）。total は手動入力値を保存（取込時の自動算術と別系統） |
| POST | `/api/moves/:id/rush-variant` | 対象 move からラッシュ版 move を派生生成（FR703、フェーズ2）。**対象は `category ∈ {normal, unique}` かつ `is_aerial = false`**（DES-003 §3.3）。違反は 400 + 理由。生成: `code = rush_<元技code>`・`category = rush_variant`・`original_move_id = :id`、フレーム・補正値は元技からコピー（利用者が `PATCH` で編集）。同 original_move_id の rush_variant 既存時の扱いは実装で定義 |

### 3.2 DES-005 §2 画面一覧: 画面18 の追加

§2 画面一覧の末尾に次を追加する（既存最大は画面17）。

| No | 画面 | 概要 | 備考 |
|---|---|---|---|
| 18 | moves 編集グリッド | 取込済み moves の手動修正（FR703）。フィールド編集・is_aerial トグル・ラッシュ版生成・notes 付記編集 | 取込プレビュー（画面17）とは別画面・別系統 |

### 3.3 DES-005 §5.18: moves 編集グリッド画面（新設）

§5 に次の節を新設する。

> ### 5.18 moves 編集グリッド（CHANGE-031）
>
> 取込済み（commit 済み）moves を手動修正するための画面（FR703）。取込プレビュー（§5.17、画面17、FR704）とは**別画面・別導線**。
>
> **表示項目**:
> 1. キャラ選択 → 当該キャラの moves をグリッド表示（要確認行を強調＝WarningCode、§5.17 と同方式）
> 2. 各行: フィールドのインライン編集（total・各フレーム・properties・combo_scaling）、is_aerial トグル、ラッシュ版生成ボタン（`category ∈ {normal,unique}` ∧ `is_aerial=false` の行のみ活性）、notes 付記編集（raw_data `notes_tool`。原文 `notes` は表示のみ）
> 3. 保存（`PATCH /api/moves/:id`）／ラッシュ版生成（`POST /api/moves/:id/rush-variant`）
>
> **アクション**: キャラ選択 → 行編集／トグル／ラッシュ生成 → 保存。要確認状態（total NULL 等）のまま保存可（手動補正は段階的）だが、enum 値域・FK・NOT NULL 違反は拒否（DES-006）。
>
> **無害化**: セル値を式・コマンドとして解釈・実行せず描画エスケープ（DES-002 §7.5）。
>
> **レスポンシブ**: PC/スマホとも縦並び。大量行（数百行）はテーブル横スクロールで対応（§5.14 / §5.17 と同方針）。
>
> 注: 取込プレビュー（§5.17）は取込前の dry-run 表示、本画面は取込後の永続データ編集。

---

## 4. 影響範囲

### 4.1 設計書本体（CHANGE 対象）

| 文書 | 現バージョン | 改訂箇所 |
|------|------------|----------|
| DES-002 | v1.15.0 → v1.16.0 | §4.2 に `PATCH /api/moves/:id` + `POST /api/moves/:id/rush-variant` を追加 |
| DES-005 | v2.15.0 → v2.16.0 | §2 画面一覧に画面18 追加 + §5.18 moves 編集グリッド画面を新設 |

> REQ-001 / DES-003 / DES-004 / DES-006 は改訂しない。rush 方針・is_aerial・category enum・検証は既存 CHANGE で確定済み。

### 4.2 派生ドキュメント（CHANGE 対象外・自由改訂）

- change-number-registry: 031 を使用済みへ、次回採番 032（反映時）。
- change-report-031（新規、反映時）。
- M9-overview §10: 編集グリッド/編集エンドポイントの CHANGE 行を追加（反映時）。
- M9-03-instruction: §4.1/§4.6 の文書影響注記の解消（反映時）。

### 4.3 実装（製造工程・参考）

- M9-03（FR703）が編集 API・ラッシュ版生成・編集グリッドを実装。本 CHANGE 承認が実装コミットのゲート（反映完了は実装と並列可）。`GET /api/moves`（MoveResponse 契約）は不変。

---

## 5. 移行影響

- データ移行要否: なし。エンドポイント・画面の追加で、既存データ・既存挙動に変更なし。
- 取込パイプライン（FR704、画面17）・コンボ CRUD（FR405）に非影響。

---

## 6. リスク

| リスク | 内容 | 緩和策 |
|--------|------|--------|
| 編集 UI と取込プレビューの混同 | 画面18（編集）と画面17（取込プレビュー）を利用者が混同 | 別画面・別導線・「別系統」明記（§3.2/§3.3）。dry-run 表示 vs 永続編集の違いを注記 |
| ラッシュ版の重複生成 | 同 original_move_id の rush_variant が複数 | サーバ側で対象カテゴリ判定 + 重複時挙動を実装定義 |
| GET 契約への波及 | 編集 API 追加で MoveResponse が変わる懸念 | `GET /api/moves`（MoveResponse）は不変。レビューで確認 |

---

## 7. 承認チェックリスト

- [ ] DES-002 §4.2 に `PATCH /api/moves/:id`（フィールド部分更新）を追加してよいか（対象フィールド集合は §3.1 のとおり）。
- [ ] DES-002 §4.2 に `POST /api/moves/:id/rush-variant`（`category ∈ {normal,unique}` ∧ `is_aerial=false` 強制）を追加してよいか。
- [ ] DES-005 に moves 編集グリッド画面（画面18 + §5.18）を新設してよいか（取込プレビュー §5.17 とは別画面）。
- [ ] §5.18 の表示項目・アクション・要確認強調・検証強度でよいか。
- [ ] 本 CHANGE を **031**、DES-002 v1.15.0→v1.16.0 / DES-005 v2.15.0→v2.16.0 とする採番・版上げで問題ないか。

---

*以上、CHANGE-031 通知書 v1.0.0（承認・反映済み）*
