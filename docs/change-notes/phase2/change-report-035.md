# CHANGE-035 反映レポート

| 項目 | 内容 |
|------|------|
| 対応通知書 | CHANGE-035 v1.0.0（再導出 unknown_properties の非パリティ性の脚注） |
| 反映日 | 2026-06-14（M9-04 レビュー対応） |
| 反映者 | 設計担当 Claude（フェーズ2 継続担当・M9 スパイン） |
| 承認 | 開発者（2026-06-14、レビュー低#2 の任意取り込み＝設計担当判断） |

## 反映内容

| 文書 | 版遷移 | 反映箇所 |
|------|--------|---------|
| DES-002 | v1.18.0 → v1.19.0 | §4.2 `GET /api/moves` warnings 説明に、unknown_properties の再導出が**取込済み行ではほぼ発火しない**旨の脚注を追加（取込 `normalizeProperties` が未知主属性を `raw_data.properties_extra` へ退避し列 NULL 化。実質 PATCH 値域外の防御検出） |

## 確定方針
- 非規範的クラリフィケーション（挙動・契約変更なし）。コード側はテストコメント `TestStoredWarnings_ShareWhitelistWithPreview` + progress-log で既出だが、DES 読者の誤解（再導出＝プレビューと同結果）を防ぐため DES に脚注を残す。

## 派生反映（自由改訂）
- change-number-registry: §1 で 035 を反映済み・次回 036、§3 改訂表 1 行、§4 履歴 v1.22.0。

*以上、CHANGE-035 反映レポート*
