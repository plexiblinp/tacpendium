# change-report-043: CHANGE-043 設計書本体 反映完了レポート

| 項目 | 内容 |
|------|------|
| 対象 CHANGE | CHANGE-043(PATCH メタデータのクリア規約を presence-detection 単一トライステートへ一般化、M11-02) |
| 反映日 | 2026-06-21 |
| 反映担当 | 設計担当 Claude(フェーズ2 本流スパイン・M11 担当) |
| 起票文書 | `CHANGE-043-M11-02-patch-clear-tristate.md` |
| 背景 | M11-RESEARCH-02 で確定した「nullable メタデータの PATCH クリア不能」の一般解(統一案=presence-detection、開発者確定) |

---

## 1. 反映したファイル(旧→新バージョン)

| 設計書 | 旧 → 新 |
|--------|---------|
| DES-002 アーキテクチャ設計書 | v1.22.0 → **v1.23.0** |

## 2. 修正概要

### DES-002(v1.23.0)
- **§4.2 `PATCH /api/combos/{id}`**: nullable メタデータのクリア規約を **presence-detection 単一トライステート**へ一般化。
  - **キー不在=不変更 / `null`=NULL クリア / 値=更新**。
  - 対象: memo / damage / drive_damage / drive_available_at_start / sa_available_at_start / knockdown_advantage / situation / 起き攻め6 BOOLEAN。
  - 部分 PATCH(昇格 `{version, isDraft}`)は不在=不変更で温存、編集経路は null=クリア。
  - **situation を本規約へ統一**(CHANGE-042 の空文字 `""` センチネルを置換。クリア成果 NULL は不変)。
  - `is_draft` は非 nullable でクリア対象外(不在=不変更 / 値=更新)。
  - CHANGE-041 の `nil=不変更` は「不在=不変更」として本規約に包含。
- **ヘッダ**: バージョン 1.23.0、ステータスに CHANGE-043 反映を前置。

## 3. 影響範囲に挙がったが「変更しなかった」ファイル(漏れ検知)

| 設計書 | 判断 | 根拠 |
|--------|------|------|
| DES-005 画面設計書 | **変更なし** | 付与/表示・状況入力の画面仕様は不変。クリアは API 層の規約 |
| DES-006 バリデーション設計書 | **変更なし** | §2.4(custom_states 入力は検証しない)は不変。クリアは検証ではない |
| DES-003 データモデル設計書 | **変更なし** | 対象列はすべて nullable 既存。スキーマ変更なし。クリアは NULL 保存(既存の NULL 表現) |
| DES-004 / REQ-001 | **変更なし** | recipe notation・要件に影響なし |

## 4. CHANGE-042 との関係

- CHANGE-042 で導入した situation の空文字 `""` センチネルは、本 CHANGE-043 の presence-detection 統一規約により **`null`=クリアへ置換**された(situation の特例を解消)。クリアの成果(NULL 保存)は不変。
- DES-002 §4.2 のステータスには CHANGE-043 と CHANGE-042 の両履歴を残し、置換関係を明示。

## 5. 派生ドキュメント

| 文書 | 対応 |
|------|------|
| M11-02 指示書 v1.0.0 / レビューチェックリスト v1.0.0 | 本 CHANGE 反映を前提に投入 |
| change-number-registry | §1 で 043 を使用済み・次番号 044、§3 に1行追加、§4 履歴 1.31.0 |

## 6. 整合性チェック結果

- DES-002 §4.2 の単一トライステート(不在=不変更 / null=クリア / 値=更新)が、M11-RESEARCH-02 Q6(部分 PATCH=昇格は不在=不変更で温存)と整合。full-replace ではない。
- situation の `null`=クリアが DES-003 の `combos.situation` NULL 可(既存)と整合。`""` センチネル(CHANGE-042)を包含・置換。
- `is_draft` 非 nullable のクリア対象外が DES-003(is_draft NOT NULL)と整合。
- 重複判定キー(VAL-C02)誘導記述は不変=識別キー編集挙動に回帰なし。
- スキーマ・後方互換(キー不在 PATCH は不変更)を確認。

---

*以上、change-report-043。配置 `docs/change-notes/change-report-043.md`。*
