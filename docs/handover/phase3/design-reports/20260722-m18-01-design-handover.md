# M18-01 → 設計担当 設計伝達レポート(確定反撃スキーマ基盤)

| 項目 | 内容 |
|------|------|
| 対象 | Web 版設計担当 Claude(フェーズ3 継続担当) |
| 発信 | 製造担当 Claude Code / 2026-07-22 |
| 対象指示書 | `docs/instructions/phase3/M18-01-schema-foundation.md` **v0.2.0** |
| 実装コミット | ブランチ `claude/senior-engineer-support-pjw43m`・9 コミット(`4df5f28`〜`d95355c`)・**push 済** |
| 関連 | 完了報告 `docs/progress/phase3/M18-01-report.md` / 独立レビュー `docs/progress/phase3/m18-01-review.md` |
| 位置づけ | 製造は DES 本体を直接編集しない(CLAUDE.md §8)。本レポートは差分主義=**指示書どおりの部分は割愛**し、①独自確定仕様 ②製造判断 ③残課題に絞る |

本レポートは、指示書 v0.2.0 に明記済みの内容(backfill 専用への確定・新表3新列2 の DDL・搬送順・連番など)は繰り返さず、**設計担当がまだ把握していない差分**のみを扱う。**最重要は §1-1(DES-005 ラベルの開発者変更)・§3-B(ディスク上の指示書が v0.1.3 のまま)・§3-A(manon/luke の is_projectile 未反映)**。

---

## 1. 製造が独自に確定した実装仕様(DES 反映が要るもの)

### 1-1. hit_type ラベルの開発者変更(DES-005・要追随)
指示書 §4.5 / DES-005 / CHANGE-082 §2-c が指定した FE ラベル「**ジャストパリィパニッシュカウンター**」を、**2026-07-22 開発者指示で「パニッシュカウンター(ジャストパリィ反撃)」へ変更**した。
- 根拠(実装): `web/src/constants/combo-list.ts:100`(`HIT_TYPE_LABELS`)・`web/src/features/combo/labels.ts:48`(`HIT_TYPE_LABEL_JA`)。テスト期待値も更新(`web/src/features/combo/utils.test.ts`)。
- **内部値 `just_parry_punish_counter`・DB スキーマ・CSV 写像・dup 判定は不変**(純粋な表示文言変更)。括弧は既存規約に合わせ**半角**(`OD(弱中)` 等と同一・全角括弧ラベルはコード内に不在)。「ジャストパリィを略さない」(§4.5)方針は新ラベルも満たす。
- ⇒ **DES-005 のラベル表記**を新文言へ更新し、**CHANGE-082 §2-c**・指示書 §4.5・レビューチェックリスト §1.2 の該当表記も追随してほしい(スキーマ・内部値への影響なし)。

### 1-2. 全 CSV の is_projectile=true 実測が 122(指示書想定 109 と乖離・RESEARCH B-2 陳腐化)
指示書 §4.4 の件数検算は「是正後 全 CSV=109」を想定するが、**是正後の実測は 122**(+13)。
- 内訳: seeded-10 **104**(=想定どおり・backfill 対象)+ luke 5(manon 0)+ **m_bison 1・rashid 12**。
- m_bison/rashid は RESEARCH B-2 のスナップショット後に `character_data/` へ追加された**未 seed キャラ**の CSV で、moves 未投入のため **backfill(104)には一切影響しない**。
- ⇒ 指示書 §4.4 の「是正後 全 CSV 109」表記を **122** へ是正するか、母数を「seeded-10=104(backfill 対象)」に限定する注記へ改めてほしい(設計判断事項)。件数の一次源は seeded-10=104 で確定・不変。

### 1-3. 新表 3 の `created_at/updated_at` は指示書 DDL どおり `TEXT`(既存表は `DATETIME` 表記)
指示書 §4.1/§4.2 の DDL は `created_at TEXT NOT NULL DEFAULT (datetime('now'))` と明記しており、そのまま採用した(`migrations/000036`・`000037`)。既存テーブル(`combos` 等)は同じ既定値で列型を `DATETIME` と表記しているが、**modernc.org/sqlite 上は両者とも TEXT アフィニティで挙動同一**(NUMERIC ではない)。差異は表記のみ・動作差なし。
- ⇒ DES-003 反映時にプロジェクトの列型表記を `TEXT`/`DATETIME` どちらへ寄せるか(統一するか)を設計担当判断で確定してほしい。実害はないため本サブは指示書 DDL の明示表記を優先した。

---

## 2. 製造の判断

### 2-1. 開発者へ確認して確定した点

| # | 何を | 確定内容 | 経緯・根拠 |
|---|------|----------|-----------|
| a | is_projectile の投入経路 | **backfill 専用(Option A・is_derived と完全同型)**。seedgen の moves INSERT は 12 列のまま(is_projectile 非出力) | 着手前 Plan Mode 実査で v0.1.3 の「seedgen SQL 出力」要件が (i) golden byte-identical 失敗、(ii) 既存マイグレ改変抵触、(iii) 000026/000030 が 000039 より前に実行され `no such column` で**実行不能**、の 3 点で成立しないと判明しエスカレーション。指示書担当が **v0.2.0 で撤回・backfill 専用確定**(seedgen は `internal/seedgen/model.go` のコメント更新のみ) |
| b | hit_type ラベル文言 | 「パニッシュカウンター(ジャストパリィ反撃)」(§1-1) | 開発者指示 2026-07-22 |

### 2-2. 推測で進めた点(指示書 §9.2 の推測許容に基づく・明示)
- **テストのファイル名・配置**は既存規約に合わせた(§9.2 許容)。新規 `internal/infra/migration/migrate_m1801_test.go`、既存 test への追記(`generate_test.go`/`repository_test.go`/`csvcore_test.go`/`utils.test.ts`)。
- **`note` 列は UI 非露出**(§9.2 どおり列のみ・M18-02/03 で使用)。
- **`HIT_TYPE_OPTIONS`(コンボエディタの select)にも新値を追加**した(`web/src/features/combo/labels.ts`)。指示書 §4.5 は「FE ラベル・比較/絞り込み」を明示するがエディタ作成 select への追加は明記しない。materialize(M18-03)コンボが本 hit_type を持つため**編集画面での表示崩れ(選択肢欠落)を防ぐ**目的で追加した。副作用として **materialize 実装前でもユーザーが手動で `just_parry_punish_counter` を選択・作成できる**。正当な hit_type であり dup キー上も別コンボで無害と判断したが、「手動作成は M18-03 まで塞ぐべき」等の設計意図があれば `HIT_TYPE_OPTIONS` からの除外を指示してほしい(**設計判断事項として申し送り**)。

---

## 3. 設計担当が未把握の残課題・申し送り

- **A.(要作業項目化)manon/luke の is_projectile 未反映**: backfill 専用確定により、未 seed の manon/luke(is_projectile=true は luke 5・manon 0)は自動反映されない。放置すると M18-02 の有利フレーム自動走査で projectile 除外が漏れ、走査結果が誤る。**M14-03d/e の seed 投入時に is_projectile の backfill を併走**させる作業項目を追加してほしい(指示書 §11-5 の暫定案どおり)。
- **B.(要中央反映)ディスク上の指示書が v0.1.3 のまま**: `docs/instructions/phase3/M18-01-schema-foundation.md` はヘッダ・§4.4(`:32`「seedgen が…is_projectile を SQL 出力する」/`:189`「moves の INSERT に is_projectile を出力」)が**撤回済みの v0.1.3 要件のまま残存**。v0.2.0 へ更新されたのは開発者がチャットで手交した内容とレビューチェックリスト(`docs/instructions/phase3/reviews/M18-01-review-checklist.md` v0.2.0・commit `76d34cc`)のみ。**指示書ファイル本体の v0.2.0 反映(registry 追随含む)を中央で行ってほしい**。実装は正しく v0.2.0 に従っており実装欠陥ではない(独立レビュー §指摘1 と同旨)。
- **C.(要 change-report 是正)CHANGE-081 §2-b/§5 の記述矛盾**: 「seedgen の保全のみ→SQL 投入」「manon/luke は M14-03d/e 投入時に**自動反映**」は v0.2.0 の backfill 専用確定と不整合。change-report-081 では「backfill 専用・manon/luke は M14-03d/e で別途 backfill」と是正してほしい。
- **D.(環境要因)E2E 未実行**: 本リモート環境の Playwright ブラウザ版数不一致(pin `@playwright/test` 1.60=build **1223** 要求・コンテナ同梱 **1194**)により §5.2-A/B を確定実行できず。full chromium(1194)への `executablePath` 差し替え回避ではブラウザは起動したが `combo-crud`/`combo-csv-io` の 4 spec が M18-01 と無関係な動線(取込 UI・CRUD フォーム)で系統的タイミング差により失敗。**pin 一致(build 1223)環境で `make e2e` 再実行**を要す。非回帰は Go 統合テスト(実マイグレ+FK CASCADE+全 seed dbtest)+FE コンポーネントテスト+本番ビルド green で代替担保。
- **E.(スコープ確認)seedgen 版数対応は M18-01 スコープ外**: 将来 seed(000040 以降の manon/luke)へ is_projectile を inline 出力させるには seedgen の版数分岐+golden の版数対応が必要。指示書 §11-6 どおり M18-01 では見送り、M14-03d/e 着手時に判断(overview §2.2 記録済)。

---

## 4. 参考(触れていない=不変の証跡・非波及の担保)

- **seedgen 生成 SQL 不変**: `internal/seedgen/generate.go` の `writeMovesInsert`(`:192`)は 12 列(`character_id,code,category,damage,startup,active,total,on_hit,on_block,recovery,is_aerial,raw_data`)のまま。`TestGenerate_IsProjectileNotEmitted` が up/down 双方で is_projectile 非出力を明示 assert。`TestGolden_*`(000026/000030 byte-identical)は CSV 是正後も green。
- **既存マイグレ非改変**: `git diff` の対象は 000036–000039 の新規追加のみ(000001–000035 は無改変)。
- **`DuplicateKey`(6 項)・`CalcRecipeHash` のロジック不変**: hit_type 新値は whitelist 追加のみで自動的に別コンボ扱い(`internal/repository/combo/repository_test.go` の hit_type 弁別テストで実証・FR301/E-19)。
- **既存 3 hit_type 値の表示・挙動不変**(FE テスト `utils.test.ts`・`ComboListFilters`/`ComboEditorBasicFields`/`CompareTable` green)。

---

## 5. CHANGE 起票のたたき台(設計担当向けチェックリスト)

> 番号は起票時に change-number-registry で採番。以下は製造からの反映依頼のたたき台。

1. **DES-005 ラベル追随**: hit_type ラベルを「パニッシュカウンター(ジャストパリィ反撃)」へ(§1-1)。CHANGE-082 の改訂 or 新規 CHANGE のいずれかで、DES-005・CHANGE-082 §2-c・指示書 §4.5・チェックリスト §1.2 を同トランザクションで追随。内部値・スキーマ影響なし。
2. **change-report-081 の是正**: seedgen backfill 専用・manon/luke 別 backfill(§3-C)。
3. **指示書 `M18-01-schema-foundation.md` の v0.2.0 disk 反映**(§3-B・registry 追随)。
4. **DES-003 反映(本サブ主目的)**: 新表 3・新列 2(`combos.materialized_from_combo_id` self-FK/nullable・`moves.is_projectile` INTEGER NOT NULL DEFAULT 0)。列型表記は §1-3 の判断を反映。
5. **DES-004**: move 正典に is_projectile。**DES-006 §2**: hit_type whitelist に `just_parry_punish_counter`(VAL-C02)。**DES-002 §7**: 紐づけ/materialize endpoint 候補(本サブ未実装・M18-02/03)。
6. **指示書 §4.4「是正後 全 CSV 109」の是正**(§1-2・実測 122 / backfill 対象は seeded-10=104)。
7. **M14-03d/e への作業項目追加**: manon/luke の is_projectile backfill 併走(§3-A)。

---

*以上、M18-01 設計伝達レポート。push+Web 版側の Sync now 後に GitHub 直読可能。三点セット(通知書+改訂 DES 本体+change-report)の起票をお願いします。*
