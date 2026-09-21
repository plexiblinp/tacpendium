# 指示書 M14-03a: 画面18 E2E 再有効化 ＋ recovery backfill（ryu/aki/jamie/guile）

| 項目 | 内容 |
|------|------|
| 指示書ID | M14-03a |
| マイルストーン | M14（M14-03 を a/b 分割。a=手入力非依存の先行分） |
| バージョン | 1.0.1 |
| 作成者・作成日 | 設計担当 Claude（M14 担当）/ 2026-06-30 |
| 実装モデル | **Opus 4.8 ＋ Plan Mode 必須** / レビュー Sonnet 4.6（model-allocation v1.24.0。破壊的マイグレ＋dbtest.Setup 波及のため Opus） |
| 上位文書 | phase3-overview v1.0.0（M14 §・M14-03a/b 分割）/ M14-overview v1.0.0 §4.4 |
| 関連 | M14-02 設計担当伝達メモ §4（画面18 E2E skip）/ CHANGE-054（moves スキーマ・recovery 列）/ followup-backlog §C-1（M14-03-e2e / M14-03-backfill） |

> **文書ID ⇄ 実パスの正は `docs/handover/docs-map.md`（自動生成）**。本書は docs-map 準拠の実パスを併記する。

## 更新履歴

| 版 | 更新日 | 更新内容 |
|----|--------|----------|
| 1.0.0 | 2026-06-30 | 初版（M14-03 の a/b 分割で新設）。 |
| 1.0.1 | 2026-06-30 | **前提誤りの是正（製造 Plan Mode で発覚）**: §3.2/§1.4 が backfill 対象に aki/jamie/guile を含めていたが、**000017 で ajg は完全 DELETE 済み**＝HEAD には ryu 56 技のみ（すべて recovery=NULL）。かつ ryu の recovery 手入力値も未受領。→ **recovery backfill を M14-03b へ移設**し、本サブは**画面18 E2E 再有効化のみ**（完全に手入力非依存）に是正。000019 backfill マイグレは本サブでは作らない。 |

> **【本サブのスコープ（v1.0.1 是正後）】** 本サブ M14-03a は **画面18 E2E（`moves-edit.spec.ts`）の import 非依存 再有効化のみ**。recovery backfill（当初 a に含めた ryu/ajg 分）は、ajg 非存在（000017 削除済み）＋ryu recovery 値未受領のため **M14-03b へ移設**し、全 recovery 入力を b の seed 作業に集約する。よって本サブは seed マイグレ（000019）を作らず、既存 ryu seed（56 技）を編集対象に E2E を再有効化する（recovery 編集は NULL からの設定で検証）。以下 §2 以降の backfill 記述は M14-03b を参照。

---

## 1. 背景と目的

### 1.1 背景

M14-03（配布 DB 同梱）は、手入力データ準備が長時間かかるため **a/b に分割**した（2026-06-30 開発者確定・phase3-overview v1.0.0）。本サブ **M14-03a は手入力 30 キャラを待たずに片付く 2 点**を先行で閉じる。

1. **画面18 E2E の再有効化**: M14-02 で取込 seed 経路が消失し `moves-edit.spec.ts` を `test.describe.skip`＋TODO にした（伝達メモ §4）。これは技編集経路の**回帰安全網に空いた穴**で、放置は静かな回帰を招く。既存 seed（ryu/ajg・取込非依存で投入済み）で再有効化できる。
2. **recovery backfill**: M14-01 は `recovery` 列を追加したのみ（既存 ryu/aki/jamie/guile は NULL）。**観測可の 4 キャラ分**の recovery を手入力値で埋め、「列はあるが空」のスキーマ不整合を解消する。

配布用の全 30 キャラ実データ投入・変換インフラは **M14-03b（ローリング保留・M16 後推奨）**。本サブはそれに依存しない。

### 1.2 目的

- `moves-edit.spec.ts` を **import 非依存 seed** 前提へ書換え再有効化。
- 既存 ryu/aki/jamie/guile の `recovery` を手入力値で backfill（seed マイグレ 000019）。`total` 整合を確認。

### 1.3 このマイルストーンで作らないもの（スコープ外）

- **変換インフラ（22 列 CSV → seed SQL）・全 30 キャラ実データ seed** = **M14-03b**。
- **moves スキーマ変更** = M14-01 で確定（本サブは触らない）。
- **取込（FR704）の再導入** = 禁止（M14-02 で削除）。
- 新規キャラ・モダン。

### 1.4 前提・確認（手入力の所在）

- recovery backfill は **ryu/aki/jamie/guile の既存 moves 分の recovery 値**（観測可・手入力）を要する。30 キャラ分は不要。**この 4 キャラ分の recovery 値は開発者が用意する**（本サブ着手前 or Plan Mode で受領）。値が未用意の場合は、**E2E 再有効化のみ先行**し backfill を分離してよい（§9.3）。

---

## 2. 成果物

### 2.1 作成するファイル

- **seed マイグレ `000019_*`**（命名は既存連番規約）: 既存 ryu/aki/jamie/guile の moves に対する `recovery` UPDATE（backfill）。

### 2.2 修正するファイル

- **E2E**: `web/e2e/moves-edit.spec.ts` — `test.describe.skip`＋TODO を解除し、**配布/既存 seed された move を編集対象**とする import 非依存 seed 前提へ書換え・再有効化。
- **テスト fixture**: `dbtest.Setup` 経由で 000019 が全テストに波及するため、recovery 値前提を持つテストがあれば追従。

### 2.3 変更しないもの（原則）

- moves スキーマ（M14-01 確定）。既存マイグレ 000002〜000018（**編集禁止**＝新規 000019 で UPDATE）。
- 技編集の機能（`service/move`・`GET/PATCH /api/moves`・rush 生成・notes_tool）。
- 既存 ryu/ajg の startup/active/total 等（recovery 以外は不変。total 整合は §4.2 で確認のみ）。

### 2.4 例外条項

- code-facts と実コードに差があれば実コードを正とし、相違を完了報告に記録。

---

## 3. 前提条件

### 3.1 必読ドキュメント

- phase3-overview v1.0.0 M14 §（M14-03a/b）/ M14-overview v1.0.0 §4.4。
- DES-003 §3.3（moves 新スキーマ・recovery・`total = startup+active−1+recovery`）。
- M14-02 設計担当伝達メモ §4（画面18 E2E skip の経緯）。
- code-facts §10（マイグレ一覧＝000018 まで・次 000019）/ §8 model.Move / §9 repository。
- retrospective-digest §5（破壊的/UPDATE マイグレ・dbtest.Setup 波及・FK=OFF×明示 DELETE 非同居）。

### 3.2 前提事実（実ファイルで確認・Plan Mode で再確認）

- 既存 moves = ryu（000004）/ aki・jamie・guile（000010）。recovery は現状 NULL（M14-01 で列追加のみ）。
- 次マイグレ連番 = **000019**。
- `moves-edit.spec.ts` は取込画面経由で編集対象を seed していたため M14-02 で skip（move 新規作成 API 無し）。
- `total` は stored（DES-003 §3.3）。

### 3.3 参照不要

- M14-03b（変換インフラ・30 キャラ seed）。取込パイプライン（削除済み）。

### 3.4 着手前の確認（Plan Mode 必須。§9.4 と対応）

以下 **5 項目**を Plan Mode で実コード確認のうえ計画提示すること。

1. **画面18 E2E の seed 方式**: 現行 `moves-edit.spec.ts` の skip 理由（取込 seed 依存）を実コードで確認し、**import 非依存**で編集対象 move を用意する方式（既存 seed 行を使う／テスト用 seed ヘルパー）を提示。move 新規作成 API が無い前提の回避策。
2. **recovery backfill の対象と値の所在**: ryu/aki/jamie/guile の対象 move 行数・recovery 値の受領方法（開発者提供）。値未用意なら E2E のみ先行（§9.3）。
3. **total 整合**: backfill 後 `total = startup+active−1+recovery`（DES-003 §3.3）と既存 stored `total` が一致するか。不一致時に **total を再算術で書換えるか／recovery のみ補填するか**を確定（既存 total を壊さない方針の可否）。
4. **マイグレ 000019 技法**: recovery UPDATE のみ（子行 DELETE を伴わない＝FK=OFF×明示 DELETE 非同居に抵触しないことを確認）。`dbtest.Setup` 波及・down 整合。
5. **テスト追従範囲**: recovery 値・moves 件数前提を持つ既存テストの追従列挙。

---

## 4. 詳細仕様

### 4.1 画面18 E2E 再有効化

- `moves-edit.spec.ts` の skip＋TODO を解除。既存 seed された move を編集対象に、**import 非依存**で seed する前提へ書換え。recovery 含む編集→保存→反映を検証。

### 4.2 recovery backfill（000019）

- 既存 ryu/aki/jamie/guile の moves の `recovery` を手入力値で UPDATE。`total` 整合を §3.4-3 の確定方式で担保（既存 total を方針外に破壊しない）。

### 4.3 検証（DES-006）

- recovery は既存フレーム列と同じ寛容方式（専用 VAL なし・M14-01）。値域外は UI/入力で担保。

---

## 5. テスト要件（ケース数で語る）

### 5.1 Go

- マイグレ 000019 up で ryu/ajg の recovery が backfill され、down で復元。`dbtest.Setup` 経由の全テスト通過。
- total 整合（backfill 後の total が方針どおり）。

### 5.2 E2E

- `moves-edit.spec.ts` が import 非依存で通過（recovery 含む編集→保存→反映）。skip が解除されている。

---

## 6. レビュー観点

`docs/instructions/reviews/M14-03a-review-checklist.md` を参照。重大判定は §9。

---

## 7. 完了条件（DoD）

- `moves-edit.spec.ts` が再有効化され import 非依存で通過（skip 解除）。
- ryu/aki/jamie/guile の recovery が backfill され、total 整合が方針どおり。
- 既存マイグレ非改変・スキーマ不変・取込経路を復活させていない。
- `dbtest.Setup` 経由の全テスト通過・down 整合。
- 完了報告に Plan Mode 確定方式（5 項目）・テストケース数・（値未用意で E2E のみ先行した場合は）backfill の残扱いを明記。

---

## 8. 参照ドキュメント

- phase3-overview v1.0.0 / M14-overview §4.4 / DES-003 §3.3 / M14-02 伝達メモ §4 / code-facts §10/§8/§9 / retrospective-digest §5。

---

## 9. 注意事項・判断に迷ったら

### 9.1 推測で進めてはいけない事項

- E2E の import 非依存 seed 方式（§3.4-1）。
- total 整合の扱い（§3.4-3）。
- 既存マイグレ非改変（新規 000019 で UPDATE）。

### 9.2 推測で進めてよい事項（その旨を明示）

- E2E のテスト用 seed ヘルパーの形。

### 9.3 不明事項発見時の対応

- recovery 値が未用意なら **E2E 再有効化のみ先行**し、backfill を分離（残として followup へ・設計担当へ申し送り）。
- 取込ロジックの復活が必要に見えたら止める（FR704 降格違反）。

### 9.4 Plan Mode で計画提示時に含めるべき項目

- §3.4 の 5 項目すべて。

---

## 10. 完了後の次ステップ

- 完了報告を受けて followup-backlog §C-1 の M14-03-e2e / M14-03-backfill を「解消」へ（設計担当）。
- **M14-03b（変換インフラ＋全 30 キャラ seed）はローリング保留**（M16 後推奨）。配布完了定義（全 30/31 キャラ seed 済み）を満たすまで配布はブロック（followup §C-1）。

---

*以上、指示書 M14-03a v1.0.0。配置 `docs/instructions/M14-03a-e2e-recovery-backfill.md`。対のレビューチェックリストは `docs/instructions/reviews/M14-03a-review-checklist.md`。*
