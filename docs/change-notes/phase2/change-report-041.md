# change-report-041: CHANGE-041 設計書本体 反映完了レポート

| 項目 | 内容 |
|------|------|
| 対象 CHANGE | CHANGE-041(custom_states 編集の往復保持に伴う PATCH /api/combos への situation 追加、M11-01) |
| 反映日 | 2026-06-20 |
| 反映担当 | 設計担当 Claude(フェーズ2 本流スパイン・M11 担当) |
| 起票文書 | `CHANGE-041-M11-01-patch-situation.md` |
| 背景 | M11-01 Plan Mode の質問(PATCH 経路で custom_states の往復保持を永続化できない)に対する案1採用(2026-06-20 開発者確定) |

---

## 1. 反映したファイル(旧→新バージョン)

| 設計書 | 旧 → 新 |
|--------|---------|
| DES-002 アーキテクチャ設計書 | v1.20.0 → **v1.21.0** |

## 2. 修正概要

### DES-002(v1.21.0)
- **§4.2 `PATCH /api/combos/{id}`**: メタデータ編集可能項目に「キャラ固有状態(custom_states／`situation` JSON)」を追加。custom_states は重複判定キーではない(DES-006 §2.4)ため、その編集は識別変更ではなく本 API で行う旨、`situation` は `*string` 素通しで保存し検証しない旨、`UpdateMetadataRequest` に situation を nil=不変更で加算する旨を明記。重複判定キー(レシピ本体・始動技・position・opponent_stance・hit_type・opponent_size)変更時に POST へ誘導する既存規定は不変。
- **ヘッダ**: バージョン 1.21.0、ステータスに CHANGE-041 反映を前置。

## 3. 影響範囲に挙がったが「変更しなかった」ファイル(漏れ検知)

| 設計書 | 判断 | 根拠 |
|--------|------|------|
| DES-005 画面設計書 | **変更なし** | §5.7 表示項目6(キャラ固有状態入力)・§5.6 表示項目5(表示)は既に CHANGE-040 で規定済み。round-trip の永続化は API 層の補完で、画面仕様は不変 |
| DES-006 バリデーション設計書 | **変更なし** | §2.4(custom_states 入力は検証しない・VAL-C02 対象外)は既に CHANGE-040 で規定済み。本変更はこの「メタデータ=非アイデンティティ」方針に整合する PATCH への追加であり、検証規定は不変 |
| DES-003 データモデル設計書 | **変更なし** | `combos.situation` は TEXT 既存。スキーマ変更なし |
| DES-004 / REQ-001 | **変更なし** | recipe notation・要件に影響なし |

## 4. 派生ドキュメント(CHANGE 対象外・自由改訂、registry §3 登録対象外)

| 文書 | 対応 |
|------|------|
| M11-01 指示書 | v1.0.0 → v1.1.0(§2.2 BE3点・§2.4 例外条項・§4.2 PATCH 受け口・§5 PATCH 永続化テスト) |
| M11-01 レビューチェックリスト | v1.0.0 → v1.1.0(PATCH 永続化の確認項目) |
| change-number-registry | §1 で 041 を使用済み・次番号 042、§3 に1行追加、§4 履歴 1.29.0 |

## 5. 整合性チェック結果

- DES-002 §4.2 PATCH の追加項目(custom_states)と DES-006 §2.4(custom_states は VAL-C02 対象外=メタデータ)が整合。識別変更でないため PATCH のままで正しい。
- DES-002 §4.2 PATCH の重複判定キー誘導(POST)記述は不変=識別キー項目の編集挙動に回帰なし。
- 指示書 v1.1.0 §2.2/§2.4/§4.2 と DES-002 §4.2 の記述(UpdateMetadataRequest への situation nil=不変更加算・3経路対称化)が一致。
- スキーマ(`combos.situation` TEXT)・後方互換(situation 未指定 PATCH は従来どおり)を確認。

---

*以上、change-report-041。配置 `docs/change-notes/change-report-041.md`。*
