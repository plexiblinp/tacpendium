# CHANGE-067 通知書: int custom_states（ストック系）の始動最低/終了 2 値化＋増減表示（M16-07・FB⑬ 深掘り）

| 項目 | 内容 |
|------|------|
| 通知書ID | CHANGE-067 |
| サブマイルストーン | M16-07 |
| 起票日 | 2026-07-08 |
| 起票者 | 設計担当 Claude（フェーズ3 継続担当・M16 期） |
| 承認者 | 開発者（M16-07 実装・レビュー完了。データモデル判断ゲート承認済・実装コミット済） |
| ステータス | **反映済み**（DES 適用・三点セット）。REQ-001 不変 / **DES-003 §3.2・DES-005 §5.6/§5.7/§5.8/§5.13 → 改訂** / DES-006 不変（§2.4 が既にカバー・§3 参照） / 他 DES 変更なし |
| 影響設計書 | **DES-003 §3.2**（custom_states DEF `show_delta`・int per-combo 値の 2 値構造）・**DES-005 §5.6/§5.7/§5.8/§5.13**（int state の①②③表示・入力・比較・出力）。**situation は opaque JSON＝DDL/DTO/BE 変更なし・dup/recipe 非波及**（実装詳細で DES 規定文言外） |
| 関連 | 指示書 `M16-07-custom-states-stock.md` v1.0.1（en 実装反映）/ 伝達メモ `M16-07-to-design-memo.md` §1〜§4 / 完了報告 `progress-log.md` §M16-07 / M16-overview v1.2.6 §4.9 / architecture-patterns §9.1（B-1）/ CHANGE-040（M11 custom_states 機能化）/ M16-02（drive/SA 先例）・M16-06（en 境界） |

---

## 1. 変更の概要

M16-07（FB⑬ 深掘り）の実装を DES へ反映する。int 型 custom_states（キャラ固有ストック・例 Ingrid の `sun_crest`）を **①始動時に必要な最低ストック数／②終了時ストック数**の 2 値で保持・表示し、**③増減（②−①・符号付き）を FE 自動計算**（`show_delta=true` の state のみ表示）。各項目に明示ラベル（name＋固定句）。

**核心（低 blast radius）**: per-combo 値は `combos.situation` の opaque JSON（BE 素通し `situation *string`）に構造化保存するため、**スキーマ/DTO/BE 変更ゼロ**。situation は `DuplicateKey`（6 フィールド）・`recipe_hash`（steps）いずれにも非対象＝**dup/recipe 非波及**。消費セマンティクスの一般構築はしない（architecture-patterns §9.1・B-1 据え置き＝表示用 2 値＋派生増減のみ）。

**CHANGE 対象＝** DES-003 §3.2（DEF `show_delta`・int 2 値構造）／DES-005（①②③表示・入力・比較・出力）。**CHANGE 対象外＝** マイグレ 000023 の JSON patch・SSOT 実装（`customStateIntLabel`）・テスト（実装詳細・完了報告に記録）。

## 2. 変更の内容

| # | 対象 | 変更 |
|---|------|------|
| a | DES-003 §3.2 | custom_states DEF に **`show_delta`（boolean・任意）** を追加（int state の増減表示可否・方向可変=true）。per-combo の int 値を **`{"<code>": {"start_min": n, "end": m}}` 構造化**（①②）として明文化。旧スカラは後方互換で②へ写像。situation opaque＝DDL/DTO/BE 不変・dup/recipe 非対象。 |
| b | DES-005 §5.6/§5.8/§5.13 | int state を**①始動最低／②終了（③増減=②−①・`show_delta` 時）の明示ラベル**で詳細/比較/出力表示（現状 1 項目→2〜3 項目）。 |
| c | DES-005 §5.7 | editor で int state を**①②の 2 欄入力**（min/max・整数・既存方式）＋`show_delta` 時③calc 表示（派生値）。 |
| d | ラベル（DES-005 各§） | name＋固定句で生成（総称「ストック」・SSOT `customStateIntLabel(def,kind,locale)`）。**i18n サーフェス〔詳細/比較〕は en 対応（name_en＋en 固定句）・エクスポート/入力欄は ja**（M16-06 境界）。**仮ラベル**（開発者が出力確認後に確定句へ修正予定＝確定時に SSOT と DES を同期）。 |

## 3. 実装非依存・漏れ検知

| 項目 | 判断 | 根拠 |
|------|------|------|
| DES-006（検証） | **変更なし** | §2.4（CHANGE-040）が既に「custom_states int 入力は検証しない〔値域・必須・型・存在の VAL-* なし・VAL-C02 対象外・min/max は UI 制約〕」を規定＝2 値（start_min/end）も同規定でカバー。VAL 非連動（B-1 据え置き・UI クランプで担保・BE/CSV 非連動）。新規 VAL 不要。 |
| スキーマ/DTO/BE | **変更なし** | situation は opaque JSON・`Combo.Situation *string`・DTO 生文字列素通し。2 値化は FE 整形。 |
| dup/recipe/recipe_cache | **非波及** | `DuplicateKey`・`CalcRecipeHash(steps)`・`RecomputeComboCache` いずれも situation を読まない（実コード確認・伝達メモ §2）。 |
| flag 型 custom_states・drive/SA | **不変** | flag は `{"<code>": true}` 不変・drive/SA は M16-02。 |
| 他 4 キャラ（Mai/Lily/Juri/Kimberly） | **本サブ対象外** | 本リポジトリに未 seed（キャラ行なし）＝def フラグ付与対象なし。M14-03b で seed 時に `show_delta` 付与（伝達メモ §3・§4）。 |

## 4. 影響範囲・移行・リスク

| 区分 | 対象 | 内容 |
|------|------|------|
| 設計書本体 | **DES-003 v1.28.0 → v1.29.0** | §3.2 `show_delta`・int 2 値構造 |
| 設計書本体 | **DES-005 v2.37.0 → v2.38.0** | §5.6/§5.7/§5.8/§5.13 int①②③ |
| 設計書本体 | REQ/DES-001/002/004/006/SUPP-001 | 変更なし |
| 実装（DES 規定文言外） | マイグレ 000023（Ingrid `sun_crest.show_delta=true` JSON patch・既存 seed 000015 非編集）・FE editor/display/`customStates.ts` SSOT | as-built（FE 682 件通過） |
| 移行 | 旧スカラ→②(end) 後方互換写像（graceful） | int 実データは Ingrid のみ（dev-disposable） |
| E2E | **Ingrid int①②③ の E2E は M14-03b 連動**（キャラ選択フロー＋move seed 前提・伝達メモ §3）。本サブは単体/コンポーネントで担保 | 4 キャラ E2E も M14-03b |
| リスク | 仮ラベル（開発者が確定句へ後日修正）・4 キャラ def は M14-03b で付与 | followup 記録 |

## 5. 直列化・後続

- **registry**: 067 反映（次 **068**）。**三点セット**: 本通知書＋改訂 DES-003/005＋`change-report-067`。
- **M16-overview §3/§4.9**: as-built（Ingrid のみ実 seed・4 キャラ M14-03b 委譲）。
- **followup**: 4 キャラ E2E＋Ingrid int E2E＝M14-03b 連動・`show_delta` の 4 キャラ方向性は M14-03b でドメイン判断。
- **M16-07 完了で M16 全工程が締まる** → retrospective-log 転記済（§6.6.10・v1.0.47）→ M14-03b（配布 blocker）／M17。

## 6. 開発者への確認事項

1. **反映確定・commit/push**: DES-003 §3.2・DES-005 §5.6/§5.7/§5.8/§5.13 を本三点セットで適用しました。相違なければ commit/push をお願いします。暫定案＝確定。
2. **仮ラベルの確定**: ①②③の固定句は仮です（`customStateIntLabel` SSOT）。出力確認後に確定句をご指定いただければ SSOT と DES を同期します。暫定案＝仮のまま出荷・後日確定。

---

> 反映済み（三点セット）。改訂 DES-003 v1.29.0 / DES-005 v2.38.0 ＋ change-report-067 ＋ registry（067 反映・次 068）で確定。situation opaque＝スキーマ/DTO/BE 変更なし・dup/recipe 非波及。commit/push は開発者。

*以上、CHANGE-067 通知書。配置 `docs/change-notes/CHANGE-067-notification.md`。*
