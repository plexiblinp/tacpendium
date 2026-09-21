# 設計変更反映レポート（CHANGE-006〜007）

| 作成日 | 2026-04-30 |
| 対象通知書 | CHANGE-006, CHANGE-007 |

---

## 修正されたファイル一覧

| ファイル | 旧バージョン | 新バージョン |
|---------|------------|------------|
| requirements.md | v2.10.0 | v2.11.0 |
| 02-architecture.md | v1.5.0 | v1.5.0（バージョン据え置き、内容修正あり） |
| 03-data-model.md | v1.13.0 | v1.14.0 |
| 05-screen-design.md | v2.6.0 | v2.7.0 |
| 06-validation.md | v1.8.0 | v1.8.0（バージョン据え置き、内容修正あり） |
| handover.md | - | 内容修正あり |

---

## CHANGE-006：counter_type → hit_type リネーム

全ファイルで `counter_type` を `hit_type` に一括置換。

| ファイル | 該当箇所 | 修正内容 |
|---------|---------|---------|
| requirements.md | FR004、FR301 | `counter_type` → `hit_type` |
| 02-architecture.md | §4.x PATCH API説明 | `counter_type` → `hit_type` |
| 03-data-model.md | §3.4 combosカラム定義 | `counter_type` → `hit_type`、説明文を「ヒット状況」に更新、将来のガード破壊系拡張（guard_break、crush_counter等）を注記 |
| 03-data-model.md | §3.4 コード値採用方針 | `counter_type` → `hit_type` |
| 03-data-model.md | §3.4 situation使い分け | `counter_type` → `hit_type` |
| 03-data-model.md | §4 インデックス | `counter_type` → `hit_type` |
| 03-data-model.md | §6 実装時決定事項 | `counter_type` → `hit_type` |
| 03-data-model.md | OPEN-001 | `counter_type` → `hit_type`、将来拡張を注記 |
| 03-data-model.md | ER図 combos | `counter_type` → `hit_type` |
| 05-screen-design.md | §5.4 フィルタ | `counter_type` → `hit_type` |
| 05-screen-design.md | §5.6 詳細表示 | `counter_type` → `hit_type` |
| 05-screen-design.md | §5.7 編集画面（3箇所） | `counter_type` → `hit_type` |
| 06-validation.md | §2.3 重複判定 | `counter_type` → `hit_type` |
| handover.md | §3.1、§5.3 | `counter_type` → `hit_type` |

## CHANGE-007：presets テーブルに code カラム追加

| ファイル | 該当箇所 | 修正内容 |
|---------|---------|---------|
| 03-data-model.md | §3.8 presets テーブル定義 | `code` カラム（TEXT、UNIQUE、NOT NULL）を追加。説明文にサービス層からの機械可読参照、将来の多言語対応耐性を明記。`base_preset_code` の参照先を「他レコードの `code`」と明確化 |

---

## 修正されなかったファイル

- 01-tech-stack.md
- 04-notation-spec.md（CHANGE-007は変更不要、既存記述で `code` を定義済み）

---

*以上*
