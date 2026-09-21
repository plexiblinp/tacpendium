# CHANGE-032 通知書: moves 単一フル取得エンドポイントと編集系挙動の確定（M9-03 Plan Mode 決定）

| 項目 | 内容 |
|------|------|
| 通知書ID | CHANGE-032 |
| バージョン | 1.0.0（承認・反映済み） |
| 起票日 | 2026-06-14 |
| 起票者 | 設計担当 Claude（フェーズ2 継続担当・M9 スパイン） |
| 承認者 | 開発者（2026-06-14、Plan Mode 4 決定の採用） |
| ステータス | 承認・反映済み（DES-002 v1.17.0 / DES-005 v2.17.0、change-report-032、registry v1.19.0） |
| 影響範囲（設計書本体） | DES-002 §4.2（`GET /api/moves/:id` 単一フル取得の追加 + `PATCH`/`rush-variant` のレスポンス・重複挙動の確定）、DES-005 §5.18（name_ja は表示のみ・編集時フル取得経路の明記） |
| 前提文書 | M9-03 Plan Mode 開発者決定（Q1〜Q4、2026-06-14）、M9-03-instruction v1.0.1、DES-002 v1.16.0 §4.2、DES-005 v2.16.0 §5.18、DES-004 §2.1（組み込みプリセット read-only）、code-facts §9（MoveListItem 投影） |
| 関連 | CHANGE-031（編集/rush エンドポイント）。本 CHANGE は M9-03 Plan Mode で確定した編集グリッドのデータ取得経路と編集系挙動を設計書本体へ明文化する（実装裁量の暗黙仕様化を回避） |

---

## 1. 変更の概要

M9-03 の Plan Mode で開発者が確定した 4 決定のうち、設計書本体への明文化が要る項目を反映する。

1. **DES-002 §4.2**: `GET /api/moves/:id`（単一・フル項目）を追加（Q1）。編集グリッドが、narrow 一覧（`GET /api/moves`）が返さない 6 フィールド（damage / combo_scaling / drive_gauge_increase / drive_gauge_decrease_punish / super_art_gauge_increase / raw_data）を**編集時にその行だけ**取得するための経路。
2. **DES-002 §4.2**: `PATCH /api/moves/:id` と `POST /api/moves/:id/rush-variant` は更新後/生成後の**フル move を返す**（in-place 同期）。rush-variant は**同一 original_move_id の rush_variant が既存なら 409 + 既存 id**（Q2）。
3. **DES-005 §5.18**: name_ja（official_ja_move エイリアス）は本画面で**表示のみ**。エイリアス編集は M9-03 スコープ外（Q3。DES-004 の組み込みプリセット read-only 規則との整合は後続で別途設計）。

> Q4（編集 API の楽観ロック）は **MVP では last-write-wins（version 列を追加しない）** と確定。**スキーマ変更なし** のため設計書本体の改訂は不要（M9-03 指示書に記載）。

---

## 2. 変更の理由

- **編集グリッドのフル項目取得経路が CHANGE-031 に欠けていた**: CHANGE-031 は mutation 2 本（PATCH / rush-variant）のみで、編集対象に narrow 一覧が返さない 6 フィールドが含まれる（DES-005 §5.18）にもかかわらず、その取得経路が未定義だった。Plan Mode Q1 でこれを補完（`GET /api/moves/:id` 単一フル）。narrow 一覧は表示・要確認判定に使い、フルは編集時に行単位で取得する分離（M8-A4 の「narrow=表示の高頻度経路は軽く保つ」を踏襲、§2.3 の GET 一覧契約は不変）。
- **編集系の応答・重複挙動を契約化**: PATCH/rush がフル move を返すこと、rush-variant 重複時 409 は、UI と後続が依存する挙動のため明文化。
- **name_ja の編集可否を明示**: official_ja_move は組み込みプリセットで DES-004 上 read-only。本画面では表示のみと明記し、誤解（PATCH への混在等）を防ぐ。

---

## 3. 変更の内容

### 3.1 DES-002 §4.2: `GET /api/moves/:id` の追加

§4.2 のエンドポイント表に次を追加する（`PATCH /api/moves/:id` の近傍）。

| メソッド | パス | 説明 |
|---|---|---|
| GET | `/api/moves/:id` | 単一 move の**全フィールド取得**（FR703 編集グリッドの編集時取得。フェーズ2）。narrow 一覧（`GET /api/moves`）が返さない damage / combo_scaling / drive_gauge_increase / drive_gauge_decrease_punish / super_art_gauge_increase / raw_data を含む全列 + 表示用 name_ja を返す。一覧契約（MoveResponse）は別物・不変（CHANGE-032） |

### 3.2 DES-002 §4.2: `PATCH` / `rush-variant` の応答・重複挙動の確定

既存 2 行の説明に次を追記する。

> `PATCH /api/moves/:id`（追記）: 更新後のフル move を返す（編集グリッドの in-place 同期用）。
> `POST /api/moves/:id/rush-variant`（追記）: 生成後のフル move を返す。**同一 original_move_id の rush_variant（= `rush_<元技code>`）が既存の場合は 409 Conflict + 既存 rush_variant の id を返す**（重複生成を拒否。UI は既存行へ誘導）。`(character_id, code)` 一意制約とも整合（CHANGE-032）。

### 3.3 DES-005 §5.18: name_ja は表示のみ

§5.18 の表示項目に注記を追加する。

> name_ja（official_ja_move エイリアス）は**本画面では表示のみ**（編集不可）。official_ja_move は組み込みプリセットで DES-004 §2.1 上 read-only のため、エイリアス編集（通常投げ命名補正等）は M9-03 スコープ外とし、組み込みエイリアスの data-admin 編集可否を整理する後続で設計する（CHANGE-032）。編集時のフル項目は `GET /api/moves/:id`（§4.2）で取得する。

---

## 4. 影響範囲

### 4.1 設計書本体（CHANGE 対象）

| 文書 | 現バージョン | 改訂箇所 |
|------|------------|----------|
| DES-002 | v1.16.0 → v1.17.0 | §4.2 に `GET /api/moves/:id`（単一フル）を追加 + `PATCH`/`rush-variant` の応答（フル move 返却）・rush-variant 重複時 409 を確定 |
| DES-005 | v2.16.0 → v2.17.0 | §5.18 に「name_ja は表示のみ・編集時フル取得は `GET /api/moves/:id`」を明記 |

> REQ-001 / DES-003 / DES-004 / DES-006 は改訂しない。Q4（楽観ロックなし）はスキーマ変更なしのため DES 改訂なし（指示書記載）。

### 4.2 派生ドキュメント（CHANGE 対象外・自由改訂）

- change-number-registry: 032 を使用済みへ、次回採番 033、§3 改訂表 2 行、§4 履歴 v1.19.0。
- change-report-032。
- M9-overview §10: 編集グリッドのデータ取得経路の行を追加。
- M9-03-instruction（v1.0.1 → v1.0.2）: Plan Mode 4 決定（GET 単一フル / 409 / name_ja 表示のみ / last-write-wins）を §4.1/§4.2/§4.4/§3.4 に反映。
- M9-03-review-checklist: 上記決定に追従。

### 4.3 実装（製造工程・参考）

- 本 CHANGE は Plan Mode で確定済みの決定の明文化。`GET /api/moves/:id` の実装、PATCH/rush のフル返却、409、name_ja 表示のみ、last-write-wins を製造担当が実装。`GET /api/moves`（MoveResponse 契約）は不変。

---

## 5. 移行影響

- データ移行要否: なし。エンドポイント追加・挙動確定で既存データ・既存挙動に変更なし。スキーマ変更なし（楽観ロック version 列は追加しない）。

---

## 6. リスク

| リスク | 内容 | 緩和策 |
|--------|------|--------|
| 編集時の N+1 | グリッドが全行のフルを個別取得 | フルは**編集時の行単位**のみ取得（表示は narrow 一覧）。render 時の N+1 は起きない |
| last-write-wins の lost-update | 同一 move の同時編集で後勝ち | 単一利用者・低頻度補正で実用リスク小。実需時に version 列を別 CHANGE で追加（combos と揃える） |
| name_ja 編集不可の UX | 通常投げ命名補正ができない | 取込名は公式名で多くは妥当。要確認は is_aerial/分類で対応。命名補正は後続で組み込みエイリアス編集可否を整理して設計 |

---

## 7. 承認チェックリスト（Plan Mode 決定として承認済み）

- [x] DES-002 §4.2 に `GET /api/moves/:id`（単一フル）を追加（Q1）。
- [x] `PATCH`/`rush-variant` はフル move を返し、rush-variant 重複時は 409 + 既存 id（Q2）。
- [x] DES-005 §5.18 で name_ja は表示のみ・エイリアス編集はスコープ外（Q3）。
- [x] 楽観ロックは MVP では入れない（last-write-wins、スキーマ変更なし＝DES 改訂不要）（Q4）。
- [x] 本 CHANGE を 032、DES-002 v1.16.0→v1.17.0 / DES-005 v2.16.0→v2.17.0 とする。

---

*以上、CHANGE-032 通知書 v1.0.0（承認・反映済み）*
