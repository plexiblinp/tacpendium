# CHANGE-034 通知書: MoveResponse への warnings 加算と編集グリッドの要確認強調・表示順（M9-04）

| 項目 | 内容 |
|------|------|
| 通知書ID | CHANGE-034 |
| バージョン | 1.0.0（承認・反映済み） |
| 起票日 | 2026-06-14 |
| 起票者 | 設計担当 Claude（フェーズ2 継続担当・M9 スパイン） |
| 承認者 | 開発者（2026-06-14、M9-04 Plan Mode 決定の採用） |
| ステータス | 承認・反映済み（DES-002 v1.18.0 / DES-005 v2.19.0、change-report-034、registry v1.21.0） |
| 影響範囲（設計書本体） | DES-002 §4.2（`GET /api/moves` の MoveResponse に `warnings: WarningCode[]` を後方互換で加算）、DES-005 §5.18（編集グリッドの要確認強調を再導出 warnings 全種へ・表示順並び替えを追記） |
| 前提文書 | M9-04 Plan Mode 決定（接地点=warnings 加算 / 判定一致=movesimport 共有、2026-06-14）、M9-04-instruction v1.0.1、M9-overview §12、DES-002 v1.17.0 §4.2、DES-005 v2.18.0 §5.17/§5.18、CHANGE-030（WarningCode enum） |
| 関連 | CHANGE-030（WarningCode enum 定義）。本 CHANGE は M9-04 の要確認再導出の接地点を設計書本体へ確定 |

---

## 1. 変更の概要

M9-04（FR703 編集グリッド仕上げ）で、取込済 moves の要確認シグナルを保存済みデータから**読取時再導出**し編集グリッドで強調するため、設計書本体を 2 点改訂する。

1. **DES-002 §4.2**: `GET /api/moves` の応答（MoveResponse）に `warnings: WarningCode[]`（要確認の読取時再導出結果）を**後方互換で加算**。サーバが算出。
2. **DES-005 §5.18**: 編集グリッドの要確認強調を「total NULL のみ」から**再導出 warnings 全種**（total_null / unknown_properties / unknown_combo_scaling_key / extra_throw）へ。表示順並び替え（表示のみ）を追記。

スキーマ・enum 定義・取込パイプラインは変更しない（warnings は非永続・読取時算出。WarningCode enum は CHANGE-030 で定義済み）。

---

## 2. 変更の理由

- 取込済 moves は WarningCode を永続化していない（M9-03 申し送り A-2）。編集グリッド（FR703）は要確認行を手動補正する機能なのに、要確認シグナルを total NULL の代理しか使えず、unknown_properties / unknown_combo_scaling_key / extra_throw の行を一覧で見落とす。
- 取込プレビュー（§5.17）と同じ WarningCode で全種強調するため、保存済みデータから再導出し MoveResponse に載せる（画面間で要確認種別を揃える・単一情報源）。

---

## 3. 変更の内容

### 3.1 DES-002 §4.2: MoveResponse に `warnings` 加算

`GET /api/moves` の説明に次を追記する。

> 応答（MoveResponse）に `warnings: WarningCode[]`（空配列可）を**後方互換で加算**（CHANGE-034）。要確認の**読取時再導出**結果で、サーバが算出する種別は `total_null`（total IS NULL。recovery_word はデータから復元不可で total_null に吸収）/ `unknown_properties`（ホワイトリスト外）/ `unknown_combo_scaling_key`（combo_scaling の正準キー外）/ `extra_throw`（通常投げ 3 件目以降、キャラ内で算出）。算出には combo_scaling 等を**内部使用するのみで JSON には露出しない**（既存フィールドは不変）。判定は取込プレビュー（§5.17）と同一実装を共有（二重実装の乖離防止）。

### 3.2 DES-005 §5.18: 要確認強調の全種化・表示順

§5.18 の該当記述を更新する。

> 要確認強調は `GET /api/moves` 応答の `warnings`（再導出 WarningCode、§3.1）に基づき、**total_null 以外（unknown_properties / unknown_combo_scaling_key / extra_throw）も含む全種**を取込プレビュー（§5.17）と同表現で強調する（CHANGE-034）。
> 表示順の並び替え（列ソート等）を提供してよい。**表示のみで DB の並び順・主キーは変更しない**（CHANGE-034）。

---

## 4. 影響範囲

### 4.1 設計書本体（CHANGE 対象）

| 文書 | 現バージョン | 改訂箇所 |
|------|------------|----------|
| DES-002 | v1.17.0 → v1.18.0 | §4.2 `GET /api/moves` の MoveResponse に `warnings: WarningCode[]` 加算（後方互換・サーバ算出・combo_scaling 非露出） |
| DES-005 | v2.18.0 → v2.19.0 | §5.18 要確認強調を再導出 warnings 全種へ + 表示順並び替え（表示のみ）を追記 |

> REQ-001 / DES-003（WarningCode enum は §無関係）/ DES-004 / DES-006 は改訂しない。

### 4.2 派生ドキュメント（CHANGE 対象外・自由改訂）

- change-number-registry: 034 を使用済みへ、次回採番 035、§3 改訂表 2 行、§4 履歴 v1.21.0。
- change-report-034。
- M9-04-instruction（v1.0.1 → v1.0.2）: Plan Mode 確定（接地点=warnings 加算 / 判定置き場所=movesimport 共有・dedup）を §3.4/§4.1 に反映。
- m9-03-followup-backlog: movewarn 抽出を将来の clean refactor 候補として記録。
- m9-to-m10-handover: CHANGE-034 反映済み・次回 035 へ更新。

### 4.3 実装（製造工程・参考）

- 判定一致の置き場所は **movesimport を共有元**（Plan Mode 決定）＝実装判断のため DES 変更なし（指示書記載）。`move/service.go` の重複 knownProperties を共有参照へ寄せて dedup。
- `GET /api/moves` の既存フィールド（MoveResponse の warnings 以外）は不変。

---

## 5. 移行影響
- なし。warnings は読取時算出・非永続でスキーマ不変。加算フィールドは後方互換。

---

## 6. リスク

| リスク | 内容 | 緩和策 |
|--------|------|--------|
| 判定の二重実装乖離 | プレビューと再導出で判定がずれる | movesimport の同一実装・同一ホワイトリストを共有（Plan Mode 決定） |
| combo_scaling の露出 | warnings 算出で combo_scaling を JSON に出してしまう | 内部使用のみ・MoveResponse は既存 + warnings のみ。乖離ガード（§4.8）を壊さない |
| 後方互換 | warnings 加算が既存 consumer に影響 | 加算のみ・既存 consumer は無視 |

---

## 7. 承認チェックリスト（M9-04 Plan Mode 決定として承認済み）

- [x] DES-002 §4.2 の MoveResponse に `warnings: WarningCode[]` を後方互換加算（サーバ算出・combo_scaling 非露出）。
- [x] DES-005 §5.18 の要確認強調を再導出 warnings 全種へ + 表示順並び替え（表示のみ）。
- [x] 判定は movesimport 共有（実装判断・DES 変更なし）。
- [x] 本 CHANGE を 034、DES-002 v1.17.0→v1.18.0 / DES-005 v2.18.0→v2.19.0。

---

*以上、CHANGE-034 通知書 v1.0.0（承認・反映済み）*
