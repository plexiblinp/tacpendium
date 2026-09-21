# 設計変更反映レポート（CHANGE-010）

| 作成日 | 2026-05-10 |
| 対象通知書 | CHANGE-010（ファイル名: CHANGE-010-api-error-common-type.md） |

---

## 修正されたファイル一覧

| ファイル | 旧バージョン | 新バージョン |
|---------|------------|------------|
| 02-architecture.md | v1.5.0 | v1.6.0 |

---

## 修正概要

### CHANGE-010：DES-002 §4.3 エラーレスポンス共通Go型の明示

| ファイル | 該当箇所 | 修正内容 |
|---------|---------|---------|
| 02-architecture.md | §4.3 エラーハンドリング | 「共通Go型」小見出しを追加。`model.APIError`（Code/Message/Details）と `model.APIErrorResponse`（ラップ型）のGo構造体定義を明示。配置先は `internal/model/api_error.go`。全ハンドラでの使用パターン（details有無の2例）を記載。ハンドラ独自のエラーレスポンス型の定義を禁止 |

---

## 修正されなかったファイル

- requirements.md
- 01-tech-stack.md
- 03-data-model.md
- 04-notation-spec.md
- 05-screen-design.md
- 06-validation.md
- handover.md

---

## 備考

- CHANGE-008は欠番
- SUPP-001への波及はM3-05起票時に製造担当が確認する（本レポートでは対応不要）

---

*以上*
