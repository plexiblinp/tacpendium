# CHANGE-034 反映レポート

| 項目 | 内容 |
|------|------|
| 対応通知書 | CHANGE-034 v1.0.0（MoveResponse への warnings 加算と編集グリッドの要確認強調・表示順） |
| 反映日 | 2026-06-14（M9-04 実装着手と並行） |
| 反映者 | 設計担当 Claude（フェーズ2 継続担当・M9 スパイン） |
| 承認 | 開発者（2026-06-14、M9-04 Plan Mode 決定の採用） |

## 反映内容

| 文書 | 版遷移 | 反映箇所 |
|------|--------|---------|
| DES-002 | v1.17.0 → v1.18.0 | §4.2 `GET /api/moves` の MoveResponse に `warnings: WarningCode[]`（要確認の読取時再導出・後方互換加算・combo_scaling 非露出・判定は §5.17 と共有）を追記 |
| DES-005 | v2.18.0 → v2.19.0 | §5.18 要確認強調を再導出 warnings 全種（total_null/unknown_properties/unknown_combo_scaling_key/extra_throw）へ + 表示順並び替え（表示のみ・DB 並び不変）を追記 |

## 確定方針（M9-04 Plan Mode）

- **接地点**: warnings を MoveResponse に後方互換加算（サーバ算出）。recovery_word は再導出不可で total_null に吸収。combo_scaling 等は算出に内部使用のみで JSON 非露出（既存フィールド不変・乖離ガード §4.8 を壊さない）。
- **判定一致**: movesimport を共有元（既存 knownProperties/comboScalingKeys/WarningCode を再利用、move/service.go の重複 knownProperties を共有参照へ dedup）＝実装判断のため DES 変更なし。
- **表示順**: クライアント表示のみ。

## 派生反映（自由改訂）
- change-number-registry: §1 で 034 を反映済み・次回採番 035、§3 改訂表 2 行、§4 履歴 v1.21.0。
- M9-04-instruction v1.0.1 → v1.0.2（§3.4/§4.1 に Plan Mode 確定）。
- m9-03-followup-backlog: movewarn 抽出を将来の clean refactor 候補として記録。
- m9-to-m10-handover: CHANGE-034 反映済み・次回 035 へ更新。

*以上、CHANGE-034 反映レポート*
