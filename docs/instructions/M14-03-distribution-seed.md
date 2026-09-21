# 指示書 M14-03b: 配布 seed データ投入（変換インフラ ＋ 全 30 クラシックキャラ実データ seed）【ローリング保留・M16 後推奨】

| 項目 | 内容 |
|------|------|
| 指示書ID | M14-03b |
| マイルストーン | M14（M14-03 を a/b 分割。b=手入力律速の配布実データ。**ローリング保留・M16 後着手推奨**） |
| バージョン | 1.1.0 |
| 作成者・作成日 | 設計担当 Claude（M14 担当）/ 2026-06-30 |
| 実装モデル | **Opus 4.8 ＋ Plan Mode 必須** / レビュー Sonnet 4.6（model-allocation v1.24.0） |
| 上位文書 | M14-overview v1.0.0 §2.1（配布対象＝クラシック全30）/ §4.4（seed インフラ先行設計） |
| 関連 | M14-RESEARCH-01-report §E（配布 seed 由来）/ M14-02 設計担当伝達メモ §4（画面18 E2E 再有効化）/ CHANGE-054（moves スキーマ）/ CHANGE-055（FR704 降格・配布 seed は SQL マイグレ経路） |

> **文書ID ⇄ 実パスの正は `docs/handover/docs-map.md`（自動生成）**。本書は docs-map 準拠の実パスを併記する。

## 更新履歴

| 版 | 更新日 | 更新内容 |
|----|--------|----------|
| 1.0.0 | 2026-06-30 | 初版（M14-03 単一時）。 |
| 1.1.0 | 2026-06-30 | M14-03 を a/b 分割（開発者確定・phase3-overview v1.0.0）。本書を **M14-03b（変換インフラ＋全 30 キャラ実データ seed）**へ転換し、**ローリング保留・M16 後着手推奨**を明記。**画面18 E2E 再有効化・ryu/ajg recovery backfill は M14-03a へ移設**（手入力非依存の先行分）。 |

> **【ローリング保留（M16 後着手推奨）】** 本サブは手入力 30（/31）キャラの実データに律速される。後続 M15/M16 はデータ量に依存しない。**M16（データモデル拡充）が moves スキーマを触る可能性があるため、M16 後に投入すれば再入力 churn を避けられる**。着手は配布が必要になる時点／M16 後のいずれか早い方で、本書を最新スキーマに対して見直したうえで確定する。**画面18 E2E 再有効化・recovery backfill は M14-03a（先行）で実施**するため本書スコープ外。**配布完了の定義＝全 30/31 キャラの moves が新スキーマで seed 済み**（followup-backlog §C-1）。**【必須制約】配布 seed はマイグレ由来のクリーン初期状態から構築する（dev DB スナップショット流用は厳禁）**＝dev DB は旧取込 E2E 由来の残渣（幽霊 ken moves・E2E が書いた偽 recovery/total・E2E 生成 rush）で汚染されており、流用すると配布物へ漏れる（M14-03a 報告 §1）。ryu recovery を実測 backfill する際、dev DB の偽値に注意（clean DB では NULL）。

---

## 1. 背景と目的

### 1.1 背景

M14-02 で公式データ取込（FR704）を本体から削除した。配布 DB は**開発者の手入力データを SQL マイグレ経路で同梱**する（取込非依存。CHANGE-055・DES-002 §7.5/§4.2）。配布対象は**クラシック全 30 キャラ**（モダンはフェーズ3 排除。M14-overview §2.1）。

現状の seed（code-facts §10）は moves が **ryu（000004）/ aki・jamie・guile（000010）のみ**。characters は classic5 含む投入済み（000014）だが大半のキャラの **moves は未投入**。M14-01（000018）で moves スキーマが確定（6列削除・`recovery` 追加・raw_data 整理）したため、配布 seed は**新スキーマで投入**する。

手入力データは開発者が逐次作成する（非同期）。本サブは**投入インフラ**（変換・マイグレ機構・既存行の整合・テスト）を先行構築し、データは完成分から流し込める形にする（M14-overview §4.4）。

### 1.2 目的

- **手入力 CSV（`moves-input-tool` 出力・22 列）→ seed SQL 変換インフラ**を構築（remap・`total` 算出・`raw_data` 構築・`recovery` 設定・category 写像・`move_code` 採番）。取込（削除済み）に依存しない dev/build 時の生成系。
- **seed マイグレ（000019〜）**で、未投入キャラの moves と official_ja_move エイリアス（`preset_aliases`）を FK 依存順（characters → moves → preset_aliases）で投入。
- （既存 ryu/ajg の `recovery` backfill・画面18 E2E 再有効化は **M14-03a**〔手入力非依存の先行分〕へ移設。本サブはスコープ外。）

### 1.3 このマイルストーンで作らないもの（スコープ外）

- **手入力データ自体の完成**＝開発者タスク（非同期）。本サブはインフラと、完成分の投入機構まで（全 30 キャラ分の数値そのものの正しさは開発者が担保）。
- **モダン操作キャラ**＝フェーズ3 排除（M14-overview §2.1）。
- **取込（FR704）の再導入**＝禁止（M14-02 で削除・FR704 降格）。本サブの変換系は dev/build 時の seed 生成であり、本体ランタイムに取込経路を復活させない。
- **moves スキーマ変更**＝M14-01 で確定（本サブはデータ投入のみ・スキーマを触らない）。
- **custom_states 投入**＝既存 000015（classic3）の範囲。新規キャラの状態定義が要る場合のみ別途（Plan Mode で要否判断）。

### 1.4 前提（配布対象・ロスター非依存）

- 配布対象はクラシック全 30 キャラ（**遅延で 31 になる可能性**あり）。seed インフラは**ロスター数非依存**（キャラ追加で変換・マイグレ機構を変えずに行追加で対応できる形）に設計する。

---

## 2. 成果物

### 2.1 作成するファイル

- **seed 生成変換系**（dev/build 時。実パス・形態は Plan Mode で確定。例 `tools/seedgen/` or `cmd/seedgen/` の Go 生成器、または `moves-input-tool` 側）: 22 列 CSV → seed SQL（INSERT 群）を生成。remap・`total = startup + active − 1 + recovery` 算出・`raw_data`（notes/notes_tool）構築・`recovery` 設定・category 写像・`move_code` 正準採番（DES-004 §2.1・新形）。
- **seed マイグレ（連番は M14-03a の 000019 以降＝着手時に確定）**（命名は既存連番規約。複数に分割可）: 未投入キャラの moves・official_ja_move エイリアス投入。（ryu/ajg の recovery backfill は M14-03a。）

### 2.2 修正するファイル

- （画面18 E2E 再有効化は **M14-03a**。本サブでは、全 30 キャラ seed で E2E の対象データが拡がるため、必要なら M14-03a の E2E を配布キャラへ拡張する程度。）
- **テスト fixture**: `dbtest.Setup` 経由で新 seed マイグレが全テストに波及するため、件数前提・期待値を持つ既存テスト（moves 件数・キャラ別件数等）を新 seed に追従。

### 2.3 変更しないもの（原則）

- moves スキーマ（M14-01 確定）。既存マイグレ 000002〜000018（**編集禁止**＝新規 000019〜で追加・UPDATE）。
- 技編集（画面18・`service/move`・`GET/PATCH /api/moves`）・export/import（comboio）・本体に取込経路を復活させない。
- 既存 ryu/ajg moves の `total`・フレーム値（recovery backfill 時に total と矛盾しないことを確認するのみ。再算術で書き換えない方針を Plan Mode で確定）。

### 2.4 例外条項

- code-facts と実コードに差があれば実コードを正とし、相違を完了報告に記録（playbook §4.1）。

---

## 3. 前提条件

### 3.1 必読ドキュメント

- M14-overview v1.0.0 §2.1/§4.4。
- DES-003（`docs/design/03-data-model.md`）§3.3（moves 新スキーマ・recovery・total 算出式・raw_data）/ §3.2 characters / §3.9 preset_aliases。
- DES-004（`docs/design/04-notation-spec.md`）§2.1（move_code 正準採番・official_ja_move）。
- DES-002 §7.5（FR704 降格後の CSV 列セマンティクス参照＝22 列の意味は §7.5＋DES-003 §3.3）/ §4.2（配布 seed は SQL マイグレ経路・取込非依存）。
- M14-RESEARCH-01-report §E（配布 seed 由来・既存 seed 実態）。
- M14-02 設計担当伝達メモ §4（画面18 E2E 再有効化）。
- code-facts §10（マイグレ一覧＝000017 まで＋M14-01 000018・次 000019）/ §8 model.Move / §9 repository。
- retrospective-digest §5（破壊的/大量マイグレ・dbtest.Setup 波及・FK=OFF×明示 DELETE 非同居）。

### 3.2 前提事実（実ファイルで確認・Plan Mode で再確認）

- 既存 moves seed = ryu（000004）/ aki・jamie・guile（000010）のみ。characters は base（000003）＋ aki/jamie/guile（000009）＋ classic5（000014）。official_ja_move エイリアスは 000006/000011。
- 次マイグレ連番 = **000019**（000018 が M14-01 で最新）。
- moves 新スキーマ（M14-01・CHANGE-054）: 6列削除済み・`recovery INTEGER`（手入力）・`total` stored（`startup+active−1+recovery`）・raw_data は notes/notes_tool。
- 既存 ryu/ajg の `recovery` は NULL（M14-01 は列追加のみ）。
- FK 依存順: characters → moves（character_id FK）→ preset_aliases（move_id FK）。
- 22 列 CSV の列セマンティクスは DES-002 §7.5（降格後・参照）＋ DES-003 §3.3。

### 3.3 参照不要

- 取込パイプライン（削除済み）・movesimport（削除済み）。本サブは dev/build 時の seed 生成と SQL マイグレに限定。

### 3.4 着手前の確認（Plan Mode 必須。§9.4 と対応）

以下 **8 項目**を Plan Mode で実コード確認のうえ計画提示すること。

1. **既存 seed 構成の実査**: どのキャラに moves が投入済みか（ryu/ajg）・未投入か、characters の全数（classic5＋他＝30 の内訳）、official_ja_move エイリアスの現状。配布 30 キャラの「投入済み／未投入／recovery backfill 要」を表で確定。
2. **DB 同梱方式の確定**: 配布データを **SQL マイグレ経路で seed**（既存 000004/000010/000014 と同方式・migrations を embed して起動時適用）でよいか、**事前ビルド `.db` の embed** を意図するか（CHANGE-055 は「SQL マイグレ経路で投入」と記録）。原則は前者（既存パターン踏襲）。
3. **変換系（22 列 CSV → seed SQL）の設計**: 配置（dev/build 時・本体ランタイム非経路）・remap・`total` 算出（`startup+active−1+recovery`・算出不能は NULL）・`raw_data` 構築（notes/notes_tool）・`recovery` 設定・category 写像・`move_code` 正準採番（DES-004 §2.1・新形）。**取込（削除済み）のロジックを復活させない**（必要なら新規に最小実装）。
4. **seed マイグレ方式（000019〜）**: 未投入キャラ moves の INSERT ＋ official_ja_move エイリアス（preset_aliases）の INSERT を **FK 依存順**で。複数マイグレ分割の要否。**既存マイグレ（000002〜000018）は非改変**。冪等性・down 整合。
5. **recovery backfill 方式**: 既存 ryu/ajg の `recovery`（現 NULL）を手入力値で UPDATE。`total`（stored）との整合（`total = startup+active−1+recovery` が既存 total と一致するか・不一致時の扱い＝再算術で total を書き換えるか／recovery のみ補填するかを確定）。**FK=OFF と明示 DELETE を同一マイグレに同居させない**（digest §5）。
6. **配布データ範囲・段階投入**: 手入力は非同期のため、本サブで「インフラ＋完成分」を投入し残りは後続マイグレで追加できる形か。全 30 一括か段階か。ロスター非依存（31 化に耐える）か。
7. **dbtest.Setup 波及・テスト fixture**: 新 seed マイグレが全テストに波及。moves 件数・キャラ別件数等の期待値を持つ既存テストの追従範囲を列挙。
8. **画面18 E2E（`moves-edit.spec.ts`）の再有効化設計**: 取込 seed 依存を配布 seed 依存へ。編集対象 move を配布 seed された行から選び、import 非依存で seed する書換え方針。skip 解除条件。

---

## 4. 詳細仕様

### 4.1 変換インフラ（22 列 CSV → seed SQL）

- 入力: `moves-input-tool` 出力の 22 列 CSV（列セマンティクスは DES-002 §7.5 降格後＋DES-003 §3.3）。
- 処理: 列 remap（CSV → moves 新スキーマ列）・`total` 算出（`startup+active−1+recovery`・素材欠落で NULL）・`raw_data` 構築（notes/notes_tool のみ）・`recovery` 設定・category 写像・`move_code` 正準採番（DES-004 §2.1・新形）。
- 出力: seed SQL（INSERT 群）。本体ランタイムを経由しない dev/build 時生成。**取込経路を復活させない**。

### 4.2 seed マイグレ（000019〜）

- 未投入キャラの moves・official_ja_move エイリアス（preset_aliases）を FK 依存順（characters→moves→preset_aliases）で INSERT。
- 既存 ryu/ajg の `recovery` を手入力値で UPDATE（backfill）。
- 既存マイグレ非改変（新規連番で追加）。down 整合。

### 4.3 recovery backfill と total 整合

- 既存 ryu/ajg moves の `recovery`（NULL）を手入力値で補填。`total = startup+active−1+recovery`（DES-003 §3.3）と既存 stored `total` の整合を確認（不一致時の扱いは §3.4-5 で確定）。

### 4.4 画面18 E2E 再有効化

- `moves-edit.spec.ts` の取込 seed 依存（skip＋TODO）を解除。配布 seed された move を編集対象に、import 非依存で seed する前提へ書換え（M14-02 伝達メモ §4）。

### 4.5 検証（DES-006）

- 投入 moves は既存 VAL（enum 値域・FK・NOT NULL・move_code 形式）に適合。recovery 専用 VAL は無い（M14-01・寛容方針）。

---

## 5. テスト要件（ケース数で語る。§7 DoD と対応）

### 5.1 Go テスト

- **seed マイグレ 000019〜**: up で配布キャラの moves・エイリアスが投入され、ryu/ajg の recovery が backfill される。down 整合。`dbtest.Setup` 経由の全テスト通過（件数前提テストの追従込み）。
- **変換系**: サンプル 22 列 CSV から期待 seed SQL（remap・total 算出・raw_data・recovery・category・move_code）が生成される（境界: total 算出不能 NULL・raw_data 空→省略・複数属性）。
- **FK 依存順**: characters→moves→preset_aliases の順序で投入され FK 違反が出ない。

### 5.2 FE / E2E

- **画面18 E2E 再有効化**: `moves-edit.spec.ts` が配布 seed 依存で通過（recovery 含む編集→保存→反映）。import 非依存 seed で安定。

### 5.3 手順書

- 起動時マイグレ適用で配布 DB が構築され、画面18 で配布キャラの moves が表示・編集できる（手入力完成分の範囲で）。

---

## 6. レビュー観点（別ファイル参照）

`docs/instructions/reviews/M14-03-review-checklist.md` を参照。重大判定は §9。

---

## 7. 完了条件（Definition of Done）

### 7.1 機能要件

- 変換インフラが 22 列 CSV から seed SQL を生成できる（取込経路非依存）。
- seed マイグレ 000019〜で配布キャラ moves・エイリアスが FK 順で投入され、ryu/ajg の recovery が backfill される。
- 画面18 E2E が import 非依存 seed で再有効化され通過。
- 既存マイグレ非改変・スキーマ不変・本体に取込経路を復活させていない。

### 7.2 自己テスト結果

- §5 をケース数で報告。`dbtest.Setup` 経由の全テスト通過・down 整合・件数前提テストの追従を明記。

### 7.3 品質チェック

- 配布 30（/31）キャラの投入済み／未投入／backfill の網羅表を完了報告に。禁則表現の grep 除去。

### 7.4 ドキュメント

- Plan Mode 確定方式（8 項目）・DB 同梱方式・段階投入の有無・手入力非同期の残範囲を完了報告に。
- DES 反映が要る点（DB 同梱方式の確定・seed 由来の明文化等）があれば設計担当への伝達メモで申し送り。

### 7.5 完了報告

- 上記＋ M14 完了判定（全サブ完了・配布健全性〔LICENSE/README/MPL 確認の状況〕）を申し送り（retrospective-log の M14 教訓追記は設計担当が実施）。

---

## 8. 参照ドキュメント

- M14-overview v1.0.0 §2.1/§4.4 / DES-003 §3.3/§3.2/§3.9 / DES-004 §2.1 / DES-002 §7.5/§4.2 / M14-RESEARCH-01-report §E / M14-02 伝達メモ §4 / code-facts §10/§8/§9 / retrospective-digest §5。

---

## 9. 注意事項・判断に迷ったら

### 9.1 推測で進めてはいけない事項

- 既存 seed の投入済み／未投入（§3.4-1 の実査）。
- DB 同梱方式（マイグレ seed か .db embed か。§3.4-2）。
- recovery backfill と total 整合の扱い（§3.4-5）。
- 既存マイグレ非改変（新規連番で追加）。

### 9.2 推測で進めてよい事項（その旨を明示）

- 変換系の配置・実装言語（dev/build 時で本体非経路なら）。
- seed マイグレの分割数（FK 順・冪等が満たされれば）。

### 9.3 不明事項発見時の対応

- 取込ロジックの復活が必要に見えた場合は止める（FR704 降格に反する）。新規の最小生成系で代替し設計担当へ相談。
- 手入力データの不足で全 30 投入できない場合は、インフラ＋完成分投入に留め残範囲を明示（段階投入）。

### 9.4 Plan Mode で計画提示時に含めるべき項目

- §3.4 の 8 項目すべて（既存 seed 実査 / DB 同梱方式 / 変換系設計 / seed マイグレ方式 / recovery backfill / 段階投入 / dbtest 波及 / 画面18 E2E 再有効化）。

---

## 10. 完了後の次ステップ

- 完了報告（伝達メモ）を受けて、設計担当が DB 同梱方式の明文化等で DES 反映の要否を判断（必要なら CHANGE 起票 056〜）。
- **M14 全完了**: 配布健全性（LICENSE/README/MPL 非リンク確認＝followup M14-h/M14-i）を最終確認のうえ、設計担当が retrospective-log へ M14 教訓を追記。
- 以降はフェーズ3 組み替え（phase3-overview 承認後）の M15（FB 第一波）等へ。

---

*以上、指示書 M14-03 v1.0.0。配置 `docs/instructions/M14-03-distribution-seed.md`。対のレビューチェックリストは `docs/instructions/reviews/M14-03-review-checklist.md`。*
