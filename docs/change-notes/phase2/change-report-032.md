# CHANGE-032 反映レポート

| 項目 | 内容 |
|------|------|
| 対応通知書 | CHANGE-032 v1.0.0（moves 単一フル取得エンドポイントと編集系挙動の確定＝M9-03 Plan Mode 決定） |
| 反映日 | 2026-06-14（M9-03 実装着手と並行） |
| 反映者 | 設計担当 Claude（フェーズ2 継続担当・M9 スパイン） |
| 承認 | 開発者（2026-06-14、Plan Mode 4 決定の採用） |

## 反映内容

| 文書 | 版遷移 | 反映箇所 |
|------|--------|---------|
| DES-002 | v1.16.0 → v1.17.0 | §4.2 に `GET /api/moves/:id`（単一・全フィールド取得）を追加（Q1）+ `PATCH`/`rush-variant` は**フル move を返す**・**rush-variant 重複時 409 + 既存 id**・**楽観ロックなし（last-write-wins）** を確定（Q2/Q4） |
| DES-005 | v2.16.0 → v2.17.0 | §5.18 に「name_ja は表示のみ（official_ja_move は DES-004 read-only、エイリアス編集はスコープ外）+ 編集時フル項目は `GET /api/moves/:id` で取得」を明記（Q3） |

## 確定方針（M9-03 Plan Mode 4 決定）

- **Q1**: 編集グリッドは narrow 一覧（`GET /api/moves`）で表示・要確認判定し、narrow が返さない 6 フィールド（damage / combo_scaling / drive_gauge_increase / drive_gauge_decrease_punish / super_art_gauge_increase / raw_data）は**編集時に行単位で `GET /api/moves/:id`** から取得。一覧契約（MoveResponse）は不変（§2.3 / M8-A4 踏襲）。
- **Q2**: rush-variant 重複（同 original_move_id ＝ `rush_<元技code>` 既存）は **409 Conflict + 既存 id**（生成は create-once、UI は既存行へ誘導、一意制約と整合）。
- **Q3**: name_ja（official_ja_move エイリアス）編集は M9-03 スコープ外（組み込みプリセット read-only の整理は後続）。本画面では表示のみ。
- **Q4**: 楽観ロックは MVP では入れない（last-write-wins、moves に version 列を追加しない＝スキーマ変更なし）。実需時に別 CHANGE で version 列を追加（combos と揃える）。

## 派生反映（自由改訂）

- change-number-registry: §1 で 032 を反映済み・次回採番 033 へ、§3 改訂表に DES-002 v1.16.0→v1.17.0 / DES-005 v2.16.0→v2.17.0 を追加、§4 履歴 v1.19.0。
- M9-overview §10: 編集グリッドのデータ取得経路（GET 単一フル）の行を追加。
- M9-03-instruction（v1.0.1 → v1.0.2）: §4.1（GET 単一フル + フル返却 + last-write-wins）/ §4.2（409）/ §4.4（name_ja 表示のみ）/ §3.4（Plan Mode 5 項目を確定済みに）。
- M9-03-review-checklist（v1.0.0 → v1.0.1）: 上記決定に追従。

*以上、CHANGE-032 反映レポート*
