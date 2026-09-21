# 設計変更反映レポート（CHANGE-011）

| 作成日 | 2026-05-15 |
| 対象通知書 | CHANGE-011（CHANGE-008/010は欠番、実質CHANGE-009の続き） |

---

## 修正されたファイル一覧

| ファイル | 旧バージョン | 新バージョン |
|---------|------------|------------|
| 02-architecture.md | v1.6.0 | v1.7.0 |

---

## 修正概要

### CHANGE-011：DES-002 §4.3 APIError.Details の validations 構造記載

| ファイル | 該当箇所 | 修正内容 |
|---------|---------|---------|
| 02-architecture.md | §4.3 共通Go型節の末尾 | 「Details.validationsの典型構造」小見出しを追加。バリデーションエラー時の推奨形式（`details.validations.issues` 配列構造）をJSON例として明示。Go側の標準パターン（`ValidationResult`型を`map[string]any`で渡す）を記載。バリデーション以外のエラー詳細との使い分けを明記。新規ハンドラは本形式を踏襲する旨を明記 |

---

## 修正されなかったファイル

- requirements.md、01-tech-stack.md、03-data-model.md、04-notation-spec.md、05-screen-design.md、06-validation.md、handover.md

---

## 欠番情報

- CHANGE-008: 欠番
- CHANGE-010: 欠番

---

*以上*
