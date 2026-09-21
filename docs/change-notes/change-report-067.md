# change-report-067: CHANGE-067 設計書本体 反映レポート

| 項目 | 内容 |
|------|------|
| 対象 CHANGE | CHANGE-067（int custom_states ストック 2 値化＋増減・M16-07／FB⑬ 深掘り） |
| 反映日 | 2026-07-08 |
| 反映担当 | 設計担当 Claude（フェーズ3 継続担当・M16 期） |
| 起票文書 | `docs/change-notes/CHANGE-067-notification.md` |
| ステータス | **反映（DES 適用済み・commit は開発者）** |
| 背景 | M16-07（データモデル判断ゲート）実装・レビュー完了。int custom_states を①始動最低/②終了 2 値化＋③増減（`show_delta` 時）。situation opaque＝スキーマ/DTO/BE 変更なし・dup/recipe 非波及。 |

---

## 1. 反映したファイル（旧→新）

| 設計書 | 旧 → 新 |
|--------|---------|
| DES-003 データモデル | v1.28.0 → **v1.29.0**（§3.2 custom_states DEF `show_delta`・int per-combo 値の 2 値構造 `{start_min,end}`） |
| DES-005 画面設計 | v2.37.0 → **v2.38.0**（§5.6/§5.8/§5.13 int①②③表示・§5.7 ①②2 欄入力＋③calc・ラベル SSOT/en 境界） |

REQ-001 / DES-001 / DES-002 / DES-004 / DES-006 / SUPP-001 は**変更なし**（§3 参照）。

## 2. 修正概要

- **DES-003 §3.2**: `show_delta`（boolean 任意・int state 増減表示可否・方向可変=true）を DEF に追加。per-combo int 値を `{"<code>": {"start_min": n, "end": m}}` 構造化（①②）として明文化・旧スカラは後方互換で②へ写像。situation opaque・BE 素通し＝DDL/DTO/BE 不変・dup/recipe 非対象・消費一般構築なし（B-1）。
- **DES-005 §5.6/§5.8/§5.13**: int state を①始動最低/②終了（③増減=②−①・`show_delta` 時）の明示ラベルで詳細/比較/出力表示。
- **DES-005 §5.7**: editor で int state を①②2 欄入力（min/max・整数）＋`show_delta` 時③calc 表示。
- **ラベル（DES-005 各§）**: name＋固定句生成（SSOT `customStateIntLabel(def,kind,locale)`・総称「ストック」）。i18n サーフェス（詳細/比較）は en 対応（name_en＋en 固定句）・エクスポート/入力欄は ja（M16-06 境界）。**仮ラベル**（開発者確定後に SSOT と DES 同期）。

## 3. 影響範囲に挙がったが「変更しなかった」項目（漏れ検知）

| 項目 | 判断 | 根拠 |
|------|------|------|
| DES-006（検証） | **変更なし** | §2.4（CHANGE-040）が既に custom_states int 入力の非検証を規定＝2 値（start_min/end）も同規定でカバー。VAL 非連動（B-1・UI クランプ担保・BE/CSV 非連動）。新規 VAL 不要。 |
| スキーマ/DTO/BE/CSV | **変更なし** | situation opaque JSON・`Combo.Situation *string`・DTO 素通し。2 値化は FE 整形。 |
| dup/recipe/recipe_cache | **非波及** | `DuplicateKey`・`CalcRecipeHash(steps)`・`RecomputeComboCache` いずれも situation 非読取り（実コード確認）。 |
| flag 型 custom_states・drive/SA | **不変** | flag `{"<code>": true}` 不変・drive/SA は M16-02。 |
| DES-004 | **変更なし** | notation 内部表現に影響なし（custom_states は situation・レシピ steps 外）。 |
| 消費セマンティクスの一般構築 | **未実装（意図的）** | architecture-patterns §9.1・B-1 据え置き。本サブは表示用 2 値＋派生増減のみ。 |

## 4. 整合性チェック結果

- DES-003 §3.2（DEF `show_delta`・int 2 値構造）⇔ DES-005 §5.6/§5.7/§5.8/§5.13（①②③表示・入力）⇔ DES-006 §2.4（VAL 非連動）が相互整合。
- CHANGE-040（custom_states 機能化）の「消費非モデル化」方針を維持したまま、int の**表示用 2 値＋派生増減**を追加（消費一般構築でない）。
- situation の opaque 性（M11/CHANGE-040 の設計）を活かし、DDL/DTO/BE 変更ゼロで実現。
- 実装詳細（マイグレ 000023 JSON patch・SSOT `customStateIntLabel`・テスト FE 682 件）は DES 規定文言外（完了報告 §M16-07 に記録）。

## 5. 派生・後続

| 文書 / アクション | 対応 |
|------|------|
| change-number-registry | **067 反映（次 068）**・§3 改訂表に 2 行（DES-003 v1.28.0→v1.29.0・DES-005 v2.37.0→v2.38.0）・版ログ v1.55.0 |
| M16-overview | §3 サブ表 M16-07 as-built（✅完了・Ingrid 実 seed・4 キャラ M14-03b 委譲）・§4.9 as-built（v1.2.7） |
| followup-backlog | M14-03b prep に「int custom_state def の `show_delta` 付与（4 キャラ方向性ドメイン判断）・Ingrid int①②③ E2E・remap が `{start_min,end}` 構造を取込」を追記 |
| retrospective-log | §6.6.10（M16-04〜07 完了・C-1〜C-5）転記済（v1.0.47） |
| model-allocation | M16-07＝Opus 4.8＋Plan（v1.30.0 反映済） |

## 6. 残ゲート（開発者）

- 本三点セット（通知書＋改訂 DES-003/005＋本レポート）の**内容確認・commit/push**。
- 仮ラベルの確定句（出力確認後・SSOT と DES 同期）。
- 4 キャラ E2E＋Ingrid int E2E は M14-03b 連動。

---

*以上、change-report-067。配置 `docs/change-notes/change-report-067.md`。*
