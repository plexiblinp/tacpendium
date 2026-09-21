# M37-07 完了報告: 始動技の持続当てを重複判定キーへ加える

| 項目 | 内容 |
|------|------|
| 作業 ID | **M37-07** |
| 指示書 | `docs/instructions/M37-07-starter-meaty-key.md` **v1.2.0** |
| チェックリスト | `docs/instructions/reviews/M37-07-review-checklist.md` **v1.2.0** |
| 実施日 | 2026-09-14 |
| 着手基点 | `6db1eb9`（Merge pull request #223） |
| ブランチ | `claude/tender-newton-csy9b2` |
| マイグレ消費 | **1 本＝`000117`**（払い出し済みを使用。**自採番していない**＝`D-293`） |
| CHANGE 消費 | **請求のみ**。製造は自採番しない（`D-293`）。⇒ §8 と設計伝達レポートへ |

---

## 0. ★★★最初に読むべきこと

### 0.1 ★★★`DuplicateCheckFields` は**参照 0 件の死んだ定数**であった

`SUPP-001` §2.2 は重複判定キーについてこう書いている（逐語）：

> 重複判定で比較するフィールドは、サービス層で**リスト定数として定義**する。将来「modifiers を比較から
> 外す」等の変更が必要になった場合、リスト定数を 1 箇所修正するだけで挙動を切り替えられる構造とする。

**⇒ 実装ではこれが成立していない。** 段 1-1 の実測（`grep -rn "DuplicateCheckFields" --include=*.go .`）は
**定義行のみの 1 件**を返した。判定ロジックからも、自身のテストからも参照されていない。

**★★本定数を書き換えても挙動は 1 バイトも変わらない。**
**⇒ 正本の写しとして更新したのであって、他の箇所の代わりにはならない。**
実際のキーは **30 箇所**に分かれて持たれている（§2.1）。

**★配線し直すのは本サブの射程外とした**——設計書の記述を実装へ強制する構造変更になる。
**⇒ 乖離は設計伝達レポートへ申し送る**（§8-2）。あわせて同定数の godoc へ「これは写しであって
スイッチではない」ことと、実際の足し先の一覧を逐語で書き足した。

### 0.2 ★★指示書内の失効記述を 2 件検出した（**実装は妨げない**）

| 箇所 | 記述 | 実測 |
|---|---|---|
| 指示書 **§2.1 段 1-2** | 「`ls migrations/` の最新は **`000115`** のはず」 | **`000116`** |
| チェックリスト **F-4** | 「3＝最新が **`000115`**」 | **`000116`** |

**★v1.1.0 が `§0.6 #3` だけを `000116` へ更新し、この 2 か所が追随していない。**
**⇒ 正は `§0.6 #3` の `000116` であり、実測と一致する。版ゲートは通っている。**
**★設計卓の手番である**（製造は指示書を編集しない）。

### 0.3 ★数えた上で「足さない」と判断した箇所が 3 つある

**★★「漏らした」と「数えた上で外した」を区別できる形にするため、ここに明記する**（§2.2）。

---

## 1. 着手前の版ゲート（§0.6）— **5 点すべて通過**

| # | 確かめること | 実測 |
|---|---|---|
| 1 | チェックリストの存在 | ✅ `reviews/M37-07-review-checklist.md` v1.2.0 |
| 2 | `M37-04` の着地 | ✅ `docs/progress/M37-04-completion-report.md` ／ `m37-04-review.md` ＋ 作業ツリーに `000114`〜`000116` |
| 3 | `ls migrations/` の最新が `000116` | ✅ `000116_data_backfill_moves_first_hit_startup`。欠番は `000012` と `000113`（`D-866`） |
| 4 | `SUPP-001` に 7 要素 | ✅ §2.2（L119-141） |
| 5 | 枝元 | ✅ `6db1eb9`（`Merge pull request #223 from plexiblinp/claude/adoring-thompson-hl2142`） |

---

## 2. 段 1 実査

### 2.1 ★★★段 1-1 足し先 — **実測 30 箇所。うち 29 箇所へ足し、1 件は据え置いた**

**★★初版は「30 箇所（Go 19 ／ フロント 11）へ全数足した」と書いていた。⇒ レビュー 中-4 で訂正。**
**フロントの 11 件目は `DuplicateRealtimeWarning`（表示のみで判定に関与しない）であり、据え置いたものである。**
**⇒ 「足した」と「数えたが据え置いた」を混ぜていた。**
正しくは **Go 19 ＋ フロント 10 ＝ 29 箇所へ足し、`DuplicateRealtimeWarning` の 1 件は据え置き**。
（据え置きの理由は §2.2 の表へ移した）

**★数えてから直した。** 内訳（いずれも非テスト）：

**Go（19）**

| # | 箇所 | 役割 |
|---|---|---|
| 1 | `service/combo/duplicate_keys.go:18` `DuplicateCheckFields` | `SUPP-001` §2.2 の写し（**§0.1＝参照 0 件**） |
| 2 | `repository/combo/repository.go:35` `DuplicateKey` struct | |
| 3 | 同 `FindActiveByDuplicateKey` の述語 | **VAL-C02 本体**（生きた行） |
| 4 | 同 `duplicateKeyPredicates` | **VAL-C14 / VAL-R03**（ゴミ箱側・復元時）。★godoc が「片方だけ直すな」と明記 |
| 5 | `service/validation/combo.go` インタフェース godoc の列挙 | **失効記述になるため更新** |
| 6 | 同 `DuplicateKey` struct | 層独立のため repo と意図的に二重定義 |
| 7 | 同 VAL-C02 のキー組み立て | |
| 8 | `service/combo/service.go` `CheckDuplicateInput` | |
| 9 | 同 `DuplicateInfo` | 要求値のエコーバック |
| 10 | 同 `CreateInput` | POST / PUT の入口 |
| 11 | 同 `buildComboFromInput` | 入力 → 行 |
| 12 | 同 `duplicateKeyOf` | VAL-C14 / VAL-R03 の共通ヘルパ |
| 13-14 | 同 `CheckDuplicate` の 2 箇所 | **1 関数内で型違いの 2 回構築**（生きた側 / 削除済み側） |
| 15 | 同 Materialize の FR301 探索 | ★`HitType` を差し替える特殊構築（§2.2） |
| 16 | 同 `ComboDuplicateAdapter` | 層間変換 |
| 17 | `api/combo/dto.go` `CheckDuplicateRequest` / `DuplicateInfoResponse` | |
| 18 | `api/combo/check_duplicate_handler.go` req→svc / svc→resp | |
| 19 | `service/comboio/import.go` `checkDuplicate` | **CSV 取込の事前重複判定** |

**フロント（11）**

`utils.ts` の `ComboKeyFields` / `hasKeyChanges` / `extractKeyFields` ／
`hooks/useCheckDuplicate.ts` の `CheckDuplicateInput` / `DuplicateInfo` ／
`types.ts` の `CheckDuplicateRequest` / `CheckDuplicateResponse.duplicates[]` ／
`ComboEditor.tsx` の `checkInput`（リアルタイム）/ `buildCheckDuplicateInput`（保存前）/
`currentKey`（**PUT/PATCH 分岐の実行点**）。**⇒ 足したのは 10 件である。**

### 2.2 ★★数えた上で「足さない」と判断した 3 箇所

| 箇所 | 判断と理由 |
|---|---|
| `utils.ts` **`isFormReadyForDuplicateCheck`** | **足さない。** 「必須 6 項が埋まったか」の門であり、`starter_meaty` は `NOT NULL` の bool で**常に値が在る**。足しても恒真であり、門の意味を変えない |
| `repository.go` `sortFieldWhitelist["default"]` | **足さない。** 偶然 5 列が並ぶが**一覧の既定ソート順**であって判定ではない（`character_id` を含まず順序も違う） |
| `service/setup/duplicate_keys.go` | **足さない。** セットプレイ側は `(parent_combo_id, character_id, recipe_hash)` の**別キー体系**である |
| `DuplicateRealtimeWarning.tsx` の `buildDuplicateLabel` | **足さない（据え置き）。** 重複警告の**表示**であって判定ではない。重複が成立した時点でキーは全一致しているため、本欄を出しても情報量が増えない。**★ただし同ファイルの「判定キー 6 項」という失効記述は直した**（レビュー 高-1） |

**★Materialize（`service.go` の FR301 探索）は「足した」側である。** ただし探索条件を広げても狭めてもいない
——**増えたフィールドを基底の値で埋めただけ**である。同探索が差し替えるのは `hit_type` だけであり
（`CHANGE-089`）、生成物は基底と同じ始動であるため `base.StarterMeaty` をそのまま渡す。

### 2.3 段 1-2 `ls migrations/` の最新 — **`000116`**（実測）。⇒ 払い出し済みの `000117` を使用

### 2.4 段 1-3 CSV の列契約の現況（実測）

- 正本＝`csvcore/contract.go`。`CSVColumns`（正準順）／ `optionalImportColumns`（任意列）／
  `requiredImportColumns`（その差分）。
- **後方互換は 2 重**：①ヘッダ列の欠落 → 任意列なら `VAL-I04` を出さない ②行のセル不足 →
  `csvimport.go` の `get` が `""` を返す。
- **着手前**：全 36 列 ／ 必須 22 ／ 任意 14。**着地後**：全 **37** 列 ／ 必須 **22（不変）** ／ 任意 **15**。
  **★必須列が動いていないことが「旧 CSV の取込を壊していない」ことの観測である。**

### 2.5 ★★段 1-4 既存行の総数 — **開発者が実 DB で実測した（2026-09-14）**

**★製造の作業ツリーでは取れない**（`find . -name "*.db"` が 0 件。クリーンクローンであり、
`combos` は seed ではなく利用者データであるため）。**⇒ 開発者が dev DB を読み取り専用で実測した。**
**★これは他者実測であって本手番の実測ではない**（計測点 `M-157` の書き分け）。

| 対象 | 実測（2026-09-14） |
|---|---:|
| `combos` の総数 | **144** |
| うち `starter_meaty <> 0` | **0** |
| うち `starter_meaty IS NULL` | **0** |
| 本登録・未削除（`is_draft = 0 AND deleted_at IS NULL`） | **111** |
| 識別キー ＋ `recipe_hash` が一致する組 | **0 組 / 0 件** |

列定義も実 DB で確認済み: `32|starter_meaty|INTEGER|1|0|0` ＝ **`INTEGER` / `NOT NULL` / `DEFAULT 0`**。

**★★★指示書 §2.1 段 1-4 とチェックリスト §8 の対照値「133 行〔有効 109 / 削除済み 24〕」とは食い違う。**
**⇒ あちらは `M37-05`（2026-09-13）時点の値であり、1 日のあいだに DB が増えている。**
**★結論は 1 つも変わらない**（全行 `0`・重複 0 組）**が、記録の側が古い。⇒ 設計卓へ申し送った**
（設計伝達レポート §4-2。**製造は指示書・チェックリストを編集しない**）。

**★「既存行がすべて `0` になる」ことは、そもそも行数に依らずマイグレの形から担保されている**
——`NOT NULL DEFAULT 0` の `ALTER TABLE ... ADD COLUMN` のみで `UPDATE` を 1 行も書いていない。
実測はその裏付けである（テスト側の主張は `TestStarterMeaty_DefaultsToFalseWhenNotSpecified`）。

**★★監査が返した「0 組」の読み方を書き分ける。** これは**重複が無いことの確認**であって、
**「監査の突合せロジックが `starter_meaty` を正しく織り込んでいる」ことの証明ではない**
——比較対象の組が 1 つも無いためである。
**⇒ この実行が積極的に示したのは「新列を含む `SELECT` が実 DB で通り、111 行を読めた」ことである。**
**★突合せの正しさは Go のテスト側（`TestStarterMeaty_*` 5 本）が担う。両者を混ぜない。**

### 2.6 段 1-5 `combo_oki_options` の出発点 — **差分 0 で終えた**（§5-7）

---

## 3. 変更したファイル

**★★`git diff --stat 6db1eb9`（§Phase D-0 (b)＝「新規のつもりのファイルが `+` だけか」の観点で読むこと）**

```
 .../20260914-m37-07-design-exceptions.md           | 231 ++++++++++++
 docs/progress/M37-07-completion-report.md          | 393 +++++++++++++++++++++
 docs/progress/m37-07-review.md                     | 213 +++++++++++
 internal/api/combo/check_duplicate_handler.go      |   2 +
 internal/api/combo/dto.go                          |  43 ++-
 internal/api/combo/handler.go                      |  11 +
 .../api/combo/m37_07_starter_meaty_routing_test.go |  96 +++++
 internal/model/combo.go                            |  22 +-
 internal/repository/combo/repository.go            |  31 +-
 internal/service/combo/duplicate_keys.go           |  22 +-
 .../combo/existing_duplicates_audit_test.go        |  21 +-
 .../service/combo/m23_09_check_duplicate_test.go   |   2 +-
 .../service/combo/m37_07_starter_meaty_test.go     | 225 ++++++++++++
 internal/service/combo/service.go                  |  35 +-
 internal/service/combo/trash_duplicate_test.go     |   2 +-
 .../comboio/csvcore/column_contract_test.go        |   9 +-
 internal/service/comboio/csvcore/combo.go          |   4 +
 internal/service/comboio/csvcore/contract.go       |  15 +-
 internal/service/comboio/csvcore/csvexport.go      |   3 +
 .../comboio/csvcore/m37_07_starter_meaty_test.go   | 101 ++++++
 internal/service/comboio/csvcore/validate.go       |   2 +
 internal/service/comboio/export.go                 |  14 +-
 internal/service/comboio/import.go                 |  22 +-
 internal/service/validation/combo.go               |   7 +-
 internal/service/validation/duplicate.go           |   6 +-
 .../000117_add_combos_starter_meaty.down.sql       |   4 +
 migrations/000117_add_combos_starter_meaty.up.sql  |  59 ++++
 web/e2e/m12-03-oki-starter-validation.spec.ts      |   6 +-
 web/e2e/m23-05-duplicate-collision.spec.ts         |   2 +-
 web/e2e/m28-02c-game-update.spec.ts                |   2 +-
 web/src/constants/combo-list.ts                    |  23 ++
 web/src/constants/label-keys.test.ts               |  13 +
 web/src/features/combo/api.ts                      |   6 +
 .../combo/components/ComboDetailHeader.tsx         |  16 +
 .../combo/components/ComboDetailMetadata.tsx       |   5 +-
 web/src/features/combo/components/ComboEditor.tsx  |  10 +
 .../components/ComboEditorBasicFields.test.tsx     |   1 +
 .../combo/components/ComboEditorBasicFields.tsx    |  43 ++-
 .../combo/components/ComboListFilters.test.tsx     |   1 +
 .../features/combo/components/ComboListFilters.tsx |  45 +++
 .../components/DuplicateRealtimeWarning.test.tsx   |   3 +-
 .../combo/components/DuplicateRealtimeWarning.tsx  |   3 +-
 .../features/combo/hooks/useCheckDuplicate.test.ts |   1 +
 web/src/features/combo/hooks/useCheckDuplicate.ts  |   4 +
 .../combo/hooks/useComboListFilters.test.tsx       |   1 +
 .../features/combo/hooks/useComboListFilters.ts    |   7 +
 web/src/features/combo/schema.ts                   |   4 +
 web/src/features/combo/types.ts                    |  22 ++
 web/src/features/combo/utils.test.ts               |  20 ++
 web/src/features/combo/utils.ts                    |  15 +-
 web/src/locales/en.json                            |  10 +-
 web/src/locales/ja.json                            |  10 +-
 web/src/pages/ComboListPage.tsx                    |   1 +
 53 files changed, 1794 insertions(+), 75 deletions(-)
```

**★新規に作った 8 ファイルは、いずれも deletions 0 である**（教訓 `E-225`。作る前に `ls` で同名の
有無を確かめ、既存を上書きしていないことを変更統計でも確認した）：

| ファイル | insertions | deletions |
|---|---:|---:|
| `docs/handover/design-reports/20260914-m37-07-design-exceptions.md` | **+231** | **0** |
| `docs/progress/M37-07-completion-report.md` | **+393** | **0** |
| `docs/progress/m37-07-review.md` | **+213** | **0** |
| `internal/api/combo/m37_07_starter_meaty_routing_test.go` | **+96** | **0** |
| `internal/service/combo/m37_07_starter_meaty_test.go` | **+225** | **0** |
| `internal/service/comboio/csvcore/m37_07_starter_meaty_test.go` | **+101** | **0** |
| `migrations/000117_add_combos_starter_meaty.down.sql` | **+4** | **0** |
| `migrations/000117_add_combos_starter_meaty.up.sql` | **+59** | **0** |

**⇒ deletions はすべて 0 である。**

---

## 4. 設計判断とその理由

| 事項 | 決定 | 理由 |
|---|---|---|
| **列名** | **`starter_meaty`** | **2026-09-14 開発者確定**（指示書 §7-1）。`combos` には既に `starter_move_id` が在り、ここでの `starter` は消費者の用途ではなく「そのコンボの始動」という**構造**を指す。`000114` が `starter_startup` を却下した理由（`M19-DESIGN-07` §7＝特定機能の用途を名前へ持ち込むな）には抵触しない |
| **`CHECK` 制約** | **付けない** | **実物の bool 列に倣った**（§2.2-3 の答え）。`combos.is_draft`（`000001`）／ `combos.oki_verified`（`000096`）／ `moves.is_derived`（`000032`）／ `moves.is_projectile`（`000039`）は**いずれも `CHECK` を持たない**。本リポジトリで `CHECK` を付けているのは値域列（`start_position_mass` の 0..160＝`000105` 等）だけである |
| **backfill** | **書かない** | §2.2-5。★先例 `000096` は backfill を書いたが、あちらは「既に `combo_oki_options` の行を持つコンボは調べ済みとみなせる」という既存データからの導出根拠があった。**持続当てであったかどうかは既存データのどこからも導出できない** |
| **Go の型** | `StarterMeaty bool`（ポインタにしない） | `model.Combo.OkiVerified` と同型。`NOT NULL DEFAULT 0` で「未設定」が無い |
| **応答 DTO** | **`omitempty` を付けない** | `false` は「通常始動である」という情報であり、キーが消えると「サーバがこの欄を持っていない」と区別が付かなくなる（`OkiVerified` / `AffectedByGameUpdate` の先例） |
| **述語の形** | `addNullable` を通さず常に `starter_meaty = ?` | 他の 5 列は NULL 一致のため `col IS NULL` を生成するが、本列は `NOT NULL` であり NULL の分岐が存在しない |
| **フロントの比較** | `nullableEqual` ではなく `(a ?? false) !== (b ?? false)` | 同上。★`undefined` と `false` を同値にしないと、**保存済みの行を読み直しただけで PUT へ流れ、旧行を捨てて id を採番し直す** |
| **編集画面の入力形** | `OptionButtonGroup mode="single"` ＋ **はい / いいえ** | **2026-09-14 開発者確定**。隣接する状況欄は全てボタン群（M24-12 / `D-583` が Switch を撤回済み）。**★「不問」を置いていない**（§0.5＝3 値禁止） |
| **選択肢の語の出どころ** | `ja.json` の `situation.starterMeaty.*` | **既存の `FLAG_STATE_OPTIONS`（「はい」「いいえ」を直書き）を流用しなかった。** 流用すると同じ語が 2 か所に在る状態（教訓 `E-76`）になり、`label-keys.test.ts` の網にも入らない |
| **欄の表示語** | **「持続当て（始動技）」** | **開発者裁定の逐語**（案の「持続当て（始動）」ではない。1 文字多い）。step の modifier「持続当て」と画面上で紛れるため |
| **一覧フィルタの形** | 3 状態 `<select>`（指定なし / はい / いいえ） | **横幅のため**。本行は `P-21` / `M27-03` で係争中の面に近く、ボタン群を増やすと最も先に折り返す。先例＝`isDraft` / `setup_in_corner`。**★「指定なし」はフィルタの状態であって列の値ではない**（列は 2 値のまま） |
| **一覧の*列*** | **増やさない**（フィルタのみ） | 指示書はフィルタを求めており列は求めていない。`ColumnVisibility` は 9 のまま。先例＝`M37-01`（列を足さずに詳細へ出した） |
| **CSV 取込プレビューの列ラベル** | **足さない** | `comboImport.col.*` は 37 列中 18 列だけの**部分的な写像**であり、未定義は snake_case 原文で出る仕様である。**直近に足った任意列 3 つ**（`oki_verified` / `start_position_mass` / `carry_distance_mass`）**も登録されていない。⇒ 先例に揃えた** |

---

## 5. テスト（指示書 §5）

### 5.1 個別（指示書 §5-1〜§5-7）

| # | 対象 | テスト | 結果 |
|---|---|---|---|
| **5-1** | 値だけ違う 2 行が**別コンボ** ／ 同じなら従来どおり重複 | `TestStarterMeaty_DifferentValueIsNotDuplicate` ／ `TestStarterMeaty_SameValueStillDuplicates` | **PASS** |
| **5-2** | **★★★破壊確認** | `TestStarterMeaty_DestructiveCheck_KeyWithoutColumnWouldCollide` | **PASS（下記 5.2 で実地に検証）** |
| **5-3** | 既存行の非退行（既定 0 ／ NOT NULL） | `TestStarterMeaty_DefaultsToFalseWhenNotSpecified` ／ **★実 DB での開発者実測（2026-09-14）＝列定義 `INTEGER/NOT NULL/DEFAULT 0` ・全 144 件が `0` ・重複 0 組**（§2.5） | **PASS** |
| **5-4** | `PUT` / `PATCH` の振り分け | Go `TestStarterMeaty_NotOnPatch`（**reflect で受け口の不在を主張・陽性対照つき**）／ `TestStarterMeaty_OnPostAndPut` ／ `TestStarterMeaty_ResponseKeepsFalse` ／ フロント `hasKeyChanges` 2 本 | **PASS** |
| **5-5** | `recipe_hash` の非退行 | `TestStarterMeaty_RecipeHashUnchanged` | **PASS** |
| **5-6** | CSV 往復 ／ **旧 CSV（列が 1 つ少ない）が読める** | `TestStarterMeatyRoundTrip` ／ `TestStarterMeatyBackwardCompatImport` | **PASS** |
| **5-7** | `combo_oki_options` の非退行 | §5.3 の実測 | **差分 0** |

### 5.2 ★★★破壊確認を「実地に」確かめた（§5-2 の本体）

**★テストが通ることは、そのテストが何かを見ている証拠にならない。⇒ 判定の側を壊して赤くなることを確かめた。**

`repository.go` の `FindActiveByDuplicateKey` から `starter_meaty = ?` の述語を**実際に外し**、
`go test ./internal/service/combo/ -run StarterMeaty` を回した結果（**その後ただちに復元し、`git diff` が空であることを確認した**）：

```
--- FAIL: TestStarterMeaty_DifferentValueIsNotDuplicate
    starter_meaty が違うのに VAL-C02 が返った(キーに入っていない)
--- FAIL: TestStarterMeaty_SameValueStillDuplicates
--- FAIL: TestStarterMeaty_DestructiveCheck_KeyWithoutColumnWouldCollide
    starter_meaty=true で引いたのに false の行が候補に出た(キーに入っていない): 1 件
--- FAIL: TestStarterMeaty_RecipeHashUnchanged
FAIL
```

**⇒ 述語を外すと 4 本が赤くなる。★本列が判定に効いていることの観測である。**

### 5.3 §5-7 `combo_oki_options` の非退行（実測）

- **変更行のうち `combo_oki_options` / `oki_strike_meaty_*` / `OkiOption` を含むものは、いずれも新しく書いたコメントの言及だけである。**
  （`git diff 6db1eb9 -U0` を `grep` で確認）
- **唯一の実コード差分は `import.go` の `OkiOptions:` 行の空白再整列 1 行**であり、
  `git diff -w`（空白無視）では **0 行**である。⇒ `gofmt` が隣接フィールドの追加に合わせて揃え直しただけ。
- **起き攻めの変種は 12 のまま**（`ColOki*` 定数から `ColOkiVerified` を除いた実測が 12）。

### 5.4 ★★★全数（§5-8）— **パイプを挟まずに判定した**

**★★下の実測は Phase A 時点のものである。★レビュー取り込み（Phase C）の後に全数を回し直した結果は §5.7 に在る。**

```
$ go test ./... > /tmp/gotest_full.txt 2>&1; echo "EXIT=$?"
EXIT=0
$ grep -cE "^--- FAIL" /tmp/gotest_full.txt
0
$ grep -cE "^ok  " /tmp/gotest_full.txt
60
```

```
$ pnpm test > /tmp/pnpmtest_full.txt 2>&1; echo "EXIT=$?"
EXIT=0
 Test Files  234 passed (234)
      Tests  2950 passed (2950)
```

```
$ make e2e > /tmp/e2e_full2.txt 2>&1; echo "EXIT=$?"
EXIT=0
  352 passed (7.7m)
$ grep -cE "✘" /tmp/e2e_full2.txt
0
```

**★出力は全量をファイルへ落としてある。`| head` / `| tail` で切っていない**（`M37-05` が赤を緑と報告した型＝`<!-- FULL-TEST-RUN-EXIT-CODE -->`）。

### 5.5 ★★E2E が 1 件落ちた（1 回目）。**原因は本サブの変更であり、直した**

**★★★`make e2e` の 1 回目は `351 passed / 1 failed` であった。⇒ 隠さずここに書く。**

| 項目 | 内容 |
|---|---|
| **落ちた spec** | `e2e/m12-03-oki-starter-validation.spec.ts:16` |
| **症状** | `getByText("始動技")` が **2 要素**に当たり strict mode violation |
| **原因** | **開発者裁定の表示語「持続当て（始動技）」が「始動技」を部分文字列として含む。⇒ 本サブが作った衝突である** |
| **対処** | **ロケータ側を `{ exact: true }` にした**（コミット `7cb6717`）。**★表示語は逐語指定であり変えられない。★主張の中身は変えていない**（「始動技の欄が在る」） |
| **確認** | **修正後に全数を再実行し `352 passed / 0 failed`。★当該 spec が 2 回目に走って通っていることを個別に確認した** |

**★同型の risk を全数走査した**——`web/e2e/` で「始動技」を部分一致で引くロケータは**この 1 件だけ**であった。
**★フロントの Vitest 側は無事である**——Testing Library の `getByText(string)` は既定で完全一致であり、
`ComboEditorBasicFields.test.tsx` の `getByText("始動技")` は新ラベルに当たらない（全数 2950 テストが緑であることが観測）。

### 5.6 機械検査（§5-9 ＋ 常設）

| 検査 | 結果 |
|---|---|
| `check-artifact-integrity.sh`（**★1 本目に回した**） | **違反なし**（検査 16 件の自己検査が通る／生成物 4 件 OK） |
| `check-migration-license.sh` | **違反なし**（`000117` は `_data_` を持たず層 A へ解決＝規則 (4)(b)） |
| `check-enum-sync.sh` | **ベースラインどおり（増加なし）** |
| `check-import-order.sh` | **99 / ベースライン 99（増加なし）** |
| `check-stop-discipline.sh` | **違反なし** |
| `check-browser-storage-keys.sh` | **違反なし**（★新キーを増やしていない） |
| `check-doc-refs.sh` | **dead reference なし** |
| `check-doc-inventory.sh` | **型に無いファイルなし** |
| `check-md-emphasis.sh`（**ファイル引数モード**・`D-775`） | 完了報告 **0 行** ／ 設計伝達レポート **0 行**（★どちらも初回は検出が出たため自分で直した。いずれも強調が改行をまたいでいた形） |
| `gofmt -l` | 変更した Go ファイルすべて空（緑） |
| `tsc --noEmit` | エラー 0 |

---

---

### 5.7 ★★★レビュー取り込み（Phase C）の**後**に全数を回し直した — **すべて緑**

**★取り込みは本番コードに触れている**（`existing_duplicates_audit_test.go` の実装追加 ／
要求 DTO 2 つの `omitempty` 除去 ／ E2E spec 2 本のコメント）。**⇒ 回し直した。**

```
$ go test ./... > /tmp/gotest_final.txt 2>&1; echo "EXIT=$?"
EXIT=0
$ grep -cE "^--- FAIL" /tmp/gotest_final.txt
0
$ grep -cE "^ok  " /tmp/gotest_final.txt
60
```

```
$ pnpm test > /tmp/pnpmtest_final.txt 2>&1; echo "EXIT=$?"
EXIT=0
 Test Files  234 passed (234)
      Tests  2950 passed (2950)
```

```
$ make e2e > /tmp/e2e_final.txt 2>&1; echo "EXIT=$?"
EXIT=0
  352 passed (7.3m)
$ grep -cE "✘" /tmp/e2e_final.txt
0
```

**★1 回目に落ちた `m12-03` が本実行でも通っていることを個別に確認した。**
**★機械検査 9 本（§5.6）も取り込み後に回し直し、すべて緑であることを確認している。**

### 5.8 ★取り込み後の全数走査 — **失効記述の残りは 0 件**

```
$ grep -rn "キー 6 項\|判定キー 6\|重複判定キーの 4 欄" --include=*.go --include=*.ts --include=*.tsx . | grep -v node_modules
(0 件)
```

**★★今度は `head` を付けていない。⇒ これが高-1 の直接の原因だった。**

---

### 5.9 ★★★開発者の手動確認（B-1〜B-5）— **全項目合格**（2026-09-14）

**★★ここに挙げるのは「やり残し」ではなく、製造の手番では原理的に取れない観測である。**
**⇒ 開発者が実施し、5 項目すべて問題なしであった。**

| # | 何を | 結果 |
|---|---|---|
| **B-1** | **実 DB**（列定義 ／ 既存行 ／ 重複監査） | **合格**。詳細と数値は **§2.5**。★列定義 `INTEGER / NOT NULL / DEFAULT 0` ・全 144 件が `0` ・重複 0 組 |
| **B-2** | **★★一覧フィルタの横幅**（`P-21` / `M27-03` の面） | **合格。⇒ 指示書 §2.4-5 の「横幅が苦しくなったら、外すのではなく止めて報告すること」の分岐には入らなかった** |
| **B-3** | 編集画面（欄の位置・2 値・数字キー・順送り・**modifier「持続当て」との紛れ**） | **合格** |
| **B-4** | `PUT` / `PATCH` の振り分け（実挙動） | **合格** |
| **B-5** | CSV の往復（実データ ／ **旧 CSV**） | **合格** |

**★★★B-2 が本サブで唯一、指示書が名指しで開発者判断を求めていた項目である。**
指示書 §2.4-5 の逐語＝
「**`P-21` / `M27-03`〔一覧の横幅・列の並び〕の面に近づくことは承知のうえの決定である。**
**⇒ 横幅が苦しくなったら、外すのではなく止めて報告すること**」。
**⇒ 承知のうえで受け入れたリスクが、実機で問題にならなかったことが確かめられた。**
**★製造は「苦しいか」を視覚的に判定できない。⇒ この観測は開発者にしか取れない。**

**★★B-3 の「紛れ」は表示語の存在理由そのものである。** step の modifier「**持続当て**」と
状況欄の「**持続当て（始動技）**」が同一画面に出る。
**⇒ 開発者裁定で「（始動技）」の 1 文字ぶんを足した判断が、実機で機能したことの確認である。**

**★B-5 の旧 CSV** は `starter_meaty` 列を削った CSV。**⇒ 後方互換が実データで確かめられた**
（テスト側の主張は `TestStarterMeatyBackwardCompatImport`）。

---

## 6. 併せて更新が要るもの

| # | 事項 | 状態 |
|---|---|---|
| 1 | **消費した CHANGE 番号の登録** | **該当なし。★製造は自採番していない**（`D-293`）。⇒ 原稿を設計伝達レポートへ出し、採番と `change-number-registry.md` §1 への登録は設計卓の手番である |
| 2 | **その番号の写し先（実査 4 か所）** | 同上。**★番号を消費していないため写し先も動かない** |
| 3 | **消費したマイグレ連番** | **`000117` を消費した。⇒ ボード §2.2「次に払い出す番号」は `000118` になる**（着手前の記載が既に `000118` であることを実測で確認済み＝`parallel-board.md` L123） |
| 4 | **版を上げた文書の参照元** | **該当なし**（設計書本体を 1 文字も編集していない＝`CLAUDE.md` §8） |
| 5 | **`docs/usermanual/` の該当章** | **該当なし。★実査の結果、`tacpendium-readme.html` は全 22 章が「本文は M32-02 で記述します」のプレースホルダであり、追随すべき記述が 1 行も無い**（指示書 完了条件 11） |
| 6 | **`web/CLAUDE.md` §1 ブラウザストレージ台帳** | **該当なし。★新しいストレージキーを増やしていない**——一覧フィルタは既存の `combo-list-filters-v1`（生の URL クエリ文字列）へ相乗りする |

---

## 7. 指示書 §7 の確認事項への回答

| # | 事項 | 結果 |
|---|---|---|
| 1 | 列名 `starter_meaty` | **開発者確定＝そのまま採用**（2026-09-14） |
| ~~2~~ | 一覧のフィルタへ足すか | **2026-09-14 決着済み＝足す。⇒ 足した** |
| ~~3~~ | 表示語 | **2026-09-14 決着済み＝「持続当て（始動技）」。⇒ その逐語で実装した** |

---

## 8. 設計伝達レポートへ回すもの（**★CHANGE 原稿の置き場**）

**★配置先＝`docs/handover/design-reports/20260914-m37-07-design-exceptions.md`**（作成済み）。

| # | 中身 | レポートの節 |
|---|---|---|
| **1** | **★★★`SUPP-001` §2.2 の重複判定キーを 7 → 8 要素へ広げる原稿（正本）** | **§1-1** |
| 2 | `DES-003` §3.3 の `combos` 列一覧へ 1 行 | §1-2 |
| 3 | `DES-006` §2.3 VAL-C02 へ 1 項 | §1-3 |
| 4 | `DES-002` §4.2（POST / PUT / check-duplicate / 一覧クエリ。**★PATCH には載せない**）・§7（CSV 任意列） | §1-4 |
| 5 | `DES-005` §5.7 / §5.6 / §5.4 | §1-5 |
| 6 | **★★`SUPP-001` §2.2 が約束する「1 箇所で切り替わる構造」が実装に存在しない**（§0.1）。⇒ 記述を実態へ合わせるか実装を記述へ合わせるかの判断 | **§4-1** |
| 7 | 指示書内の失効記述 2 件（§0.2） | §4-2 |
| 8 | `csv-import-precheck-duplicate-uses-unnormalized-position` の関連（**★本サブでは直していない**） | §4-3 |

**★CHANGE の起票たたき台は同レポート §6。★製造は自採番していない**（`D-293`。残枠は `207`〜`211`）。

**★`docs/handover/followup-backlog.md` は 1 文字も編集していない**（`D-838`）。**⇒ 停止時記録も同レポート §4-5 へ原稿として置く形にしてある（現時点で未解消は 0 件）。**

---

## 9. レビュー（Phase B / C）— **実測**

**★本節は Phase C の後に埋めた**（`D-510`）。

| 項目 | 実測 |
|---|---|
| レビュー報告書 | `docs/progress/m37-07-review.md`（fresh subagent で実施。**`fork` は使っていない**＝レビュアーの独立性） |
| 指摘の件数 | **全 10 件＝高 3 / 中 4 / 低 3** |
| 採否 | **採用 7 ／ 不採用 3（すべて「低」）** |
| **「高」指摘の不採用** | **0 件**（⇒ 開発者エスカレーションは発生していない） |
| 再レビュー往復 | **0 回**（上限 2） |

**★各指摘の採否と理由はレビュー報告書末尾の「## 取り込み結果（自動トリアージ）」に在る。**

### 9.1 ★★★「高」3 件はいずれも本物であり、うち 2 件は製造の数え落としであった

| # | 指摘 | 何が起きていたか |
|---|---|---|
| **高-1** | 失効記述 11 箇所 | **★★足し先を数える `grep` を `\| head -20` へ通していた。** 20 行で切られ `internal/service/validation/duplicate.go` 以降が視界に入っていなかった。**しかも `--include=*.go` しか掛けておらず、フロント（`*.tsx`）は一度も走査していない。⇒ `M37-05` の `go test \| head -20` と同型であり、対象がテスト出力から `grep` へ移っただけである。** 取り込みで全数を直し、**レビューの一覧に無かった `web/e2e/m23-05-duplicate-collision.spec.ts:21` を再走査で追加検出した** |
| **高-2** | `existing_duplicates_audit_test.go` の足し忘れ | **★キーの独立再実装（`auditKey` ＋ 生 SQL）である。`TACPENDIUM_AUDIT_DB` 未設定なら skip されるため `go test ./...` は緑のままであった。⇒ 開発者が実 DB を監査した瞬間に、持続当て違いの 2 行が「重複」として誤報される形だった。★計画段階では「追随が要る」と一覧に挙げていたのに、実装で落とした** |
| **高-3** | `progress-log.md` 未追記 | Phase D の工程であり、レビュー時点では未実施だった。追記し `check-progress-log-index.sh` が**違反なし**になることを確認した |

**★★「テストが緑」は足し先を数え切った証拠にならない。** 高-1 は人が読む以外に見つける経路が無く、
高-2 は環境変数で走行が切り替わるためその環境でしか観測できない。
**⇒ どちらも `go test` / `tsc` / lint をすべて緑にしたまま潜んでいた。**

### 9.2 「低」3 件の不採用理由

| # | 指摘 | 理由 |
|---|---|---|
| 低-8 | 出力（PDF / PNG）に本欄が出ない | **レビュー自身が「射程外の申し送りが妥当」と結論。★先例＝`start_position_mass` / `carry_distance_mass` も同関数に入っていない。⇒ 本欄だけ入れると流儀が割れる** |
| 低-9 | 重複警告のキー表示に本欄が出ない | **重複が成立した時点でキーは全一致しており、出しても情報量が増えない**（レビューも同旨） |
| 低-10 | E2E プロセスの残留 | **成果物の欠陥ではなく実行環境の運用上の穴。** ★取り込みの手番で残留プロセスとポート占有が無いことを確認し、`web/test-results/` を掃除した |

**★低-8 / 低-10 は設計伝達レポート §4 へ申し送る。**

---

*以上、M37-07 完了報告（Phase A 時点）。*
**★★§0.1 を最初に読むこと**——**`SUPP-001` が約束している「1 箇所で切り替えられる構造」は実装に無い。**
**★★次に重いのは §2.2 である**——**足し先を「数えた上で外した」3 箇所を、漏れと読まないこと。**
