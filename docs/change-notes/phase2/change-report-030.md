# CHANGE-030 反映レポート

| 項目 | 内容 |
|------|------|
| 対応通知書 | CHANGE-030 v0.1.0（M9-02 完成に伴う取込 API/データ契約の確定） |
| 反映日 | 2026-06-14（M9-02 完成後） |
| 反映者 | 設計担当 Claude（フェーズ2 継続担当・M9 スパイン） |
| 承認 | 開発者（2026-06-14） |

## 反映内容

| 文書 | 版遷移 | 反映箇所 |
|------|--------|---------|
| DES-002 | v1.14.0 → v1.15.0 | §4.2 preview/commit のリクエスト形状（preview=multipart `file`、commit=multipart `file` + `selected[{characterCode,moveCode}]`、サーバ側セッション無し・commit 時再解析）を追記 + §7.5 に FR701/FR704 正規化責務分担注記（ツール一次正規化＋本体防御二重化）を追加 |
| DES-003 | v1.19.0 → v1.20.0 | §3.3 raw_data の確定キー構造（`notes`/`notes_tool`/`command`/`condition_ja`/`condition_en`/`properties_extra`/`import_notes`、空なら省略）を明記。M9-03 がパース |
| DES-005 | v2.14.0 → v2.15.0 | §5.17 要確認強調を WarningCode enum（`recovery_word`/`total_null`/`unknown_combo_scaling_key`/`unknown_properties`/`extra_throw`）+ `errors[]`/`importable:false` 分離として確定 |

## 確定方針

- M9-02 完成時に実装裁量（指示書 §9.2）で確定した、M9-03・取込 UI が依存する API/データ契約を**暗黙仕様にせず明文化**（実装挙動の変更ではない）。
- raw_data 確定キーは M9-03 グリッド編集器がパースする契約。変更時は CHANGE で M9-03 と同期。
- 取込の正規化責務: FR701 ツールが一次正規化、本体 FR704 は防御二重化（実 CSV ではほぼ発火しない防御層）。
- 要確認（取込可能・要注意）と検出エラー（取込不可）を API 表現で分離。

## 派生反映（自由改訂）

- change-number-registry: §1 で 030 を反映済み・次回採番 031 へ、§3 改訂表に DES-002 v1.14.0→v1.15.0 / DES-003 v1.19.0→v1.20.0 / DES-005 v2.14.0→v2.15.0 を追加、§4 履歴 v1.17.0。
- M9-overview §10: CHANGE-030 を「反映済み」へ。
- **申し送り（TOOL-002）**: FR701/FR704 責務分担注記（DES-002 §7.5）と整合するよう、ツール側設計書 TOOL-002 の責務記述もツール側（別チャット）で揃える（本体側管轄外のため申し送りのみ）。

*以上、CHANGE-030 反映レポート*
