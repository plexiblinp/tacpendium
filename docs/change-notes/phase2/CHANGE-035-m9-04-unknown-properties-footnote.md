# CHANGE-035 通知書: 再導出 unknown_properties の非パリティ性の脚注（DES-002 §4.2）

| 項目 | 内容 |
|------|------|
| 通知書ID | CHANGE-035 |
| バージョン | 1.0.0（承認・反映済み） |
| 起票日 | 2026-06-14 |
| 起票者 | 設計担当 Claude（フェーズ2 継続担当・M9 スパイン） |
| 承認者 | 開発者（2026-06-14、M9-04 レビュー低#2 の任意取り込み＝設計担当判断） |
| ステータス | 承認・反映済み（DES-002 v1.19.0、change-report-035、registry v1.22.0） |
| 影響範囲（設計書本体） | DES-002 §4.2（`GET /api/moves` MoveResponse の `warnings` 説明に、unknown_properties の再導出が取込済み行ではほぼ発火しない旨の脚注を追加） |
| 前提文書 | M9-04 レビュー「推奨修正・低 2」（properties パリティは end-to-end で不一致が正）、CHANGE-034（warnings 加算）、DES-002 v1.18.0 §4.2、取込 normalizeProperties（DES-002 §7.5 / DES-003 properties_extra） |
| 関連 | CHANGE-034（warnings 再導出の接地点）。本 CHANGE はその非自明な性質を明文化し将来の誤解を防ぐ（挙動変更なし・非規範的脚注） |

---

## 1. 変更の概要

CHANGE-034 で MoveResponse に加算した再導出 `warnings` のうち、`unknown_properties` は**取込済み行ではほぼ発火しない**（取込プレビューの unknown_properties とは end-to-end で一致しないのが正）。この非自明な性質を DES-002 §4.2 に脚注として明文化する。挙動変更はない（クラリフィケーション）。

---

## 2. 変更の理由

- 取込時 `normalizeProperties` が**未知の主属性を `raw_data.properties_extra` へ退避し `properties` 列を NULL 化**する（CHANGE-022 系の正規化）。このため、取込時に unknown_properties だった行は保存後に properties が NULL となり、**再導出では unknown_properties として検出されない**（total_null 等に転じるか、警告なし）。
- 結果、再導出 `unknown_properties` は実質「**PATCH 等で値域外の properties が保存された場合の防御検出**」に限られる。
- この性質を知らずに「再導出 = プレビューと同結果」と誤解すると、取込済み行で unknown_properties が出ないことを不具合と誤認しうる。DES に脚注を残し誤解を防ぐ（レビュー低#2＝設計担当判断・任意を採用）。

---

## 3. 変更の内容

DES-002 §4.2 の `GET /api/moves` MoveResponse `warnings` 説明（CHANGE-034 追記分）に、次の脚注を追加する。

> ※ unknown_properties の注記（CHANGE-035）: 取込時 `normalizeProperties` が未知の主属性を `raw_data.properties_extra` へ退避し `properties` 列を NULL 化するため、**取込済み行では再導出 unknown_properties はほぼ発火しない**（取込プレビュー §5.17 の unknown_properties とは end-to-end で一致しないのが正）。本警告は実質、PATCH 等で値域外の properties が保存された場合の**防御検出**として機能する。

---

## 4. 影響範囲

### 4.1 設計書本体（CHANGE 対象）
| 文書 | 現バージョン | 改訂箇所 |
|------|------------|----------|
| DES-002 | v1.18.0 → v1.19.0 | §4.2 `GET /api/moves` の warnings 説明に unknown_properties の非パリティ性脚注を追加（非規範的クラリフィケーション） |

> 挙動変更なし。DES-003/005/006 等は改訂しない（コード側はテストコメント `TestStoredWarnings_ShareWhitelistWithPreview` + progress-log で既出）。

### 4.2 派生（自由改訂）
- change-number-registry: 035 を使用済みへ・次回 036、§3 改訂表 1 行、§4 履歴 v1.22.0。change-report-035。

### 4.3 実装（参考）
- 実装変更なし（既存挙動の文書化）。

---

## 5. 移行影響
- なし（文書クラリフィケーションのみ）。

## 6. リスク
- なし（非規範的脚注。挙動・契約不変）。

## 7. 承認チェックリスト
- [x] DES-002 §4.2 に unknown_properties 非パリティ性の脚注を追加（クラリフィケーション）。
- [x] 本 CHANGE を 035、DES-002 v1.18.0→v1.19.0。

---

*以上、CHANGE-035 通知書 v1.0.0（承認・反映済み）*
