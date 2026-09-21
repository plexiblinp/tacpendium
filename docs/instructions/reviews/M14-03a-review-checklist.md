# M14-03a レビューチェックリスト

| 項目 | 内容 |
|------|------|
| 対象指示書 | `docs/instructions/M14-03a-e2e-recovery-backfill.md` v1.0.0（画面18 E2E 再有効化＋recovery backfill） |
| 対象指示書ID | M14-03a |
| レビューモデル | Sonnet 4.6（model-allocation v1.24.0） |
| バージョン | 1.0.1 |
| 作成者・作成日 | 設計担当 Claude（M14 担当）/ 2026-06-30 |

> **文書ID ⇄ 実パスの正は `docs/handover/docs-map.md`（自動生成）**。

> **【v1.0.1 是正】** M14-03a は**画面18 E2E 再有効化のみ**（recovery backfill は M14-03b へ移設＝ajg は 000017 削除済みで ryu のみ・ryu recovery 値未受領・全 recovery を b で入力）。本チェックリストの **recovery backfill / 000019 マイグレ / total 整合に関するチェックは適用しない**（M14-03b で確認）。E2E 再有効化のチェックのみ適用する。

## 更新履歴

| 版 | 更新日 | 更新内容 |
|----|--------|----------|
| 1.0.0 | 2026-06-30 | 初版（指示書 v1.0.0 と対）。 |
| 1.0.1 | 2026-06-30 | 指示書 v1.0.1 是正に追従。recovery backfill を M14-03b へ移設したため、backfill/000019/total 整合のチェックを非適用化し E2E 専用へ。 |

---

## 0. レビュー前の準備

- 必読: `M14-03a-e2e-recovery-backfill.md` v1.0.0、DES-003 §3.3、M14-02 伝達メモ §4、code-facts §10、retrospective-digest §5。
- **Plan Mode 着手前確認（必須）**: 指示書 §3.4 の **5 項目**（1 E2E seed 方式 / 2 backfill 対象・値 / 3 total 整合 / 4 マイグレ 000019 技法 / 5 テスト追従）に質問書＋回答があるか。無ければ重大（推測実装）。

## 1. 設計・実装の照合

- [ ] `moves-edit.spec.ts` の `test.describe.skip`＋TODO が解除され、**import 非依存 seed** で再有効化されているか（取込依存が残っていない）。
- [ ] recovery 含む編集→保存→反映が E2E で通るか。
- [ ] seed マイグレ **000019** で ryu/aki/jamie/guile の `recovery` が backfill されているか（新規連番・既存マイグレ 000002〜000018 非改変）。
- [ ] `total = startup+active−1+recovery`（DES-003 §3.3）と既存 stored `total` の整合が Plan Mode 確定方式どおりか（既存 total を方針外に破壊していない）。
- [ ] 設計判断を製造担当が DES に直接書いていないか（伝達メモで申し送り）。

## 2. マイグレの健全性（digest §5）

- [ ] recovery UPDATE のみで子行 DELETE を伴わない（FK=OFF×明示 DELETE 非同居に抵触しない）か。
- [ ] `dbtest.Setup` 経由の全テスト通過・down 整合。

## 3. 温存対象の非破壊

- [ ] moves スキーマ（M14-01 確定）不変・既存マイグレ非改変か。
- [ ] 技編集（service/move・GET/PATCH /api/moves・rush・notes_tool）不変か。
- [ ] **本体に取込経路を復活させていない**か（FR704 降格維持）。

## 4. テストの妥当性

- [ ] マイグレ 000019 up/down・total 整合の Go テスト。
- [ ] `moves-edit.spec.ts` の import 非依存通過。
- [ ] recovery/件数前提テストの追従。

## 5. ドキュメント

- [ ] 完了報告に Plan Mode 確定方式（5 項目）・テストケース数が含まれるか。
- [ ] recovery 値未用意で E2E のみ先行した場合、backfill の残扱いを設計担当へ申し送っているか。

## 6. 重大な問題の判定基準（完了承認を妨げる）

- Plan Mode 5 項目のいずれかが未確認のまま実装（推測実装）。
- `moves-edit.spec.ts` が skip のまま or 取込依存のまま。
- 既存マイグレ改変・moves スキーマ変更。
- **本体ランタイムに取込経路を復活**（FR704 降格違反）。
- recovery backfill で既存 total を方針外に破壊。
- マイグレが `dbtest.Setup` 経由でテストを壊す or down 整合が無い。
- FK=OFF と明示 DELETE の同居。

## 7. 軽微（持ち越し許容）

- E2E seed ヘルパーの形。
- recovery 値未用意による backfill 分離（残が明示されていれば許容）。

## 8. レビュー完了の判定

- §1〜§5 が OK、§6 重大ゼロ、Plan Mode 5 項目が揃っている。

---

*以上、M14-03a レビューチェックリスト v1.0.0。配置 `docs/instructions/reviews/M14-03a-review-checklist.md`。*
