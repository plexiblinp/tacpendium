# M23-05 レビュー報告書

| 項目 | 内容 |
|------|------|
| 対象作業 | M23-05（削除済み行と再登録の衝突／`VAL-C14` `VAL-S07` `VAL-R03` `VAL-R04` の新設） |
| 対象指示書 | `docs/instructions/M23-05-deleted-row-duplicate-collision.md` v1.0.0 |
| チェックリスト | `docs/instructions/reviews/M23-05-review-checklist.md` v1.0.0 |
| 対象差分 | `9b2abe5`（実装）／ `7c35cb3`（完了報告）＝ `git diff 9b2abe5~1..HEAD` |
| 完了報告 | `docs/progress/m23-05-completion-report.md` |
| レビュー日 | 2026-08-22 |

---

## 総評

**最重要ゲート 3 件はいずれも通っている。** `VAL-C02` の実装本体（`internal/service/validation/combo.go`）は diff が空で、既存問い合わせ 2 本（`FindActiveByDuplicateKey` / `FindDuplicateInCombo`）も削除行 0 の純粋追加であることを差分で確認した。`VAL-C14` を `ValidateComboForCreate` や `Create` ではなく専用サービスメソッドへ切り出し、`POST` ハンドラ 1 か所からのみ呼ぶ形にしたのは、`PUT` / CSV 取込 / materialize が同じ関数を共用しているという実査結果に対する正しい解であり、grep で構造的に証明できる状態になっている。「経路で絞る」と「印で除く」の併用、復元対象自身の除外、`NULL` 一致の意味論、2 段（SQL で絞る → ハッシュで比較）の踏襲もすべて満たしている。破壊確認 2 件は出力付きで残っており、破壊 2 について「述語だけ外すと SQL エラーで緑のまま通る」ことに気づいて意味的に等価な壊し方へ切り替えた判断は特に良い。

**一方で、実装が変わったのに記述が旧のまま残った箇所が 7 か所ある。** いずれも「`warnings` / `details` を設定するのは復元経路だけである」という、本サブが正面から撤回した命題を断言し続けている。動作は正しくテストも lint も型検査も緑であり、人が読む以外に見つける経路が無い。`internal/api/combo/dto.go` は `CHANGE-125` の逐語源になる可能性が高いファイルであり、放置すると旧の前提が設計書へ複製される。

**加えて 2 件の手続き上の欠落がある。** `docs/progress/progress-log.md` への索引行が 1 行も追記されていない（`CLAUDE.md` §8 / 指示書 §7.4 / チェックリスト §8 が必須としている）。しかも `scripts/check-progress-log-index.sh` は緑を返す——`M23-04` のエントリ本文に「`M23-05` はこの器へ載る」という文字列があるため、ID の出現だけを見る検査が偽陽性で通っている。もう 1 件は、指示書 §4.2 が `VAL-R03` にも要求している旧行除外が実装されておらず（§4.4 の表には無い＝指示書の内部矛盾）、その食い違いが報告されていないことである。

---

## 設計準拠性レビュー結果

### §1 設計・パターンとの照合（最重要）: ◎ △ 1 件

| チェック項目 | 評価 | 実測 |
|---|---|---|
| `VAL-C02` の述語・母集団・判定内容が動いていない | ◎ | `internal/service/validation/combo.go` は diff 空。`internal/repository/combo/repository.go` は `119 / 0`（削除行 0）で `FindActiveByDuplicateKey`（`:1097`〜）はバイト単位で不変 |
| `VAL-S04` の判定内容が動いていない | ◎ | `internal/repository/setup/repository.go` は `116 / 0`。`FindDuplicateInCombo` 不変。`internal/service/setup/validate.go` の `VAL-S04` ブロック（`:168`〜）も不変 |
| `VAL-C14` が `POST /api/combos` でだけ走る・`PUT` では走らない | ◎ | `CheckTrashDuplicate` の本番呼び出し元は `internal/api/combo/handler.go:96` の 1 か所のみ。`Create` / `ValidateComboForCreate` へ入れず専用メソッドへ切り出した判断が正しい（両者とも `PUT`・CSV 取込と共用）。テストは `TestUpdateWithKeyChange_DoesNotEmitVALC14_KeyChanged` / `_KeyUnchanged` の 2 本 ＋ ハンドラ層 `TestHandler_UpdateWithKeyChange_DoesNotCarryVALC14` |
| `VAL-C14` の母集団から `superseded_by_combo_id IS NOT NULL` が除かれている | ◎ | `repository.go` の `FindDeletedByDuplicateKey` に `"superseded_by_combo_id IS NULL"` |
| **`VAL-R03` の母集団から旧行が除かれている** | **△** | **除かれていない。詳細は下記「高-3」** |
| 「経路で絞る」と「印で除く」の両方が入っている | ◎ | 経路＝ハンドラ 1 か所呼び出し／印＝`superseded_by_combo_id IS NULL`。完了報告 §1-1 の実査で「検証は Tx の外・論理削除の前に走る」ことまで確かめており、見立てより強い形で「印だけでは守れない」が確定している |
| `VAL-R03` / `VAL-R04` が復元対象自身を入れていない | ◎ | `FindActiveByDuplicateKeyExcludingTx` の `id <> ?` ／ `FindLiveDuplicateRefsInComboTx` の `s.id <> ?`。破壊確認 2 で実際に赤くなることを実測済み |
| `is_draft = 0` が保たれている | ◎ | 新規 2 本とも `"is_draft = 0"`。加えてサービス層で「仮登録を作る／復元するとき自体も判定しない」を `VAL-C02` の先例（`combo.go:114` の `if !isDraft`）に揃えており、`combo.IsDraft` ガードが `CheckTrashDuplicate` / `validateR03` の双方に入っている。**指示書の要求（母集団側のみ）より広い方向だが、方向として正しく、推測である旨も明示されている** |
| 判定キーの定義が `VAL-C02` と同じ | ◎ | `duplicateKeyOf`（`service.go`）が `CharacterID` ＋ nullable 5 項を組み、`duplicateKeyPredicates` が `addNullable` と同じ意味論を再現。セットプレイ側も入力＝`CalcSetupRecipeHash` / 候補＝`calcSetupRecipeHashFromSteps` という `VAL-S04` と同じ組み合わせを踏襲 |
| `NULL` 同士が一致として扱われている | ◎ | `duplicateKeyPredicates` の `addNullable` が `col IS NULL` を生成。テスト `TestCheckTrashDuplicate_VALC14_MatchesNullKeyFields` |
| レシピ比較が 2 段を踏襲（`group_concat` 近似でない） | ◎ | コンボ＝`FindStepsForCombos` → `CalcRecipeHash`。セットプレイ＝候補ごとに `findStepsBySetupIDRunner` → `calcSetupRecipeHashFromSteps`。SQL 近似は使っていない |
| 4 件とも登録・復元を止めていない | ◎ | すべて `AddWarningWithDetails`（`SeverityWarning`）。ハンドラは `201` / `200` を返したまま。テストで `HasError()` と生存を両方主張している |

### §2 データ・API 契約・スキーマの不変: ○

| チェック項目 | 評価 | 実測 |
|---|---|---|
| スキーマ・マイグレ不変 | ◎ | `migrations/` に差分 0。完了報告のとおり `000078` のまま |
| `M23-04` の `warnings` の器を再利用 | ◎ | `ComboResponse.Warnings` / `SetupResponse.Warnings` に 1 行も足していない。代入箇所を 2 か所 → 4 か所へ広げただけ |
| `details` の形が `M23-04` に揃っている | ○ | `combos`＝`[]model.ComboRef{id, memo}` ／ `setups`＝`[]model.SetupRef{id, name}` で揃っている。**ただし `totalCount` という新キーを足している**——指示書 §9.2-3 が件数上限を製造判断に委ねており、「他 N 件」の実装形として妥当だが、`DES-002` §4.3 規則 1（新しい形を作らない）に対する差分であることは事実。完了報告 §4.5 が「新規」と明記しており、`CHANGE-125` へ逐語で写す材料は揃っている |
| 警告 0 件のとき `warnings` キーが出ない | ◎ | `omitempty` ＋ ハンドラ側 `if len(...) > 0` の二重。`TestHandler_Create_OmitsWarningsKeyWhenNone` |
| `400 validation_failed` ＋ `details.validations` の形が不変 | ◎ | 変更なし |
| `PUT` / `PATCH` / materialize の応答形と挙動が不変 | ◎ | 差分なし |

### §3 フロントエンドの動作仕様: ◎

- 登録側（`saveWarnings.ts`）と復元側（`restoreWarnings.ts`）でファイルごと分けてあり、文面も明確に違う（登録＝「作り直す代わりに復元できます」／復元＝「復元したので重複して並んでいます」）。**ファイルを分けた理由がヘッダコメントに書かれており、「ここへ足さないこと」という後任向けの明示もある。**
- `toast.warning` であり、モーダルではない。E2E で `getByRole("alertdialog")` が 0 件であることまで主張している。
- ja / en 5 キーが揃っている。
- フロントテストは実 `ja.json` を読む最小 `t` を使っており、`M23-04` 教訓 2 に正しく従っている。サーバの `message` を表示していないことを `not.toContain("サーバ側の診断文")` で主張しているのが良い。

### §4 テストの妥当性: ◎

- サービス層 12（コンボ）＋ 6（セットプレイ）。指示書 §5.1 の 12 件はすべて対応があり、**誤検知を防ぐ側の 6 件（`-2` `-3` `-4` `-5` `-7` `-9`）はいずれも独立したテストとして実在する**（`NotFiredWhenRecipeDiffers` / `ExcludesSupersededOldRow` / `DoesNotEmitVALC14_*` 2 本 / `ExcludesDraftRows` / `ExcludesRestoredComboItself` / `NotFiredForOtherParentCombo`）。
- `NULL` 判定キー（§5.1-12）、登録・復元が止まらないこと（§5.1-11）も各テスト内で主張済み。
- ハンドラ層 3 件、E2E 2 本（発火側 ＋ 誤検知側）。E2E が「本登録で作らないと判定が 1 度も走らないまま緑になる」ことに気づいて `m23-04` spec の fixture を流用しなかった点は重要な回避である。
- **破壊確認 2 件はコマンドと出力付きで完了報告 §3 に在り、復旧確認（両テスト緑・`git diff --stat` 空）まで残っている。**

### §5 設計意図との整合: ○

- 「落とさずに知らせる」は 4 件すべてで守られている。
- 登録側／復元側の役割の違いが、母集団（削除済み ↔ 生存）・文面・ファイル分割の 3 層で実装に出ている。
- 否定形確認 4 件（完了報告 §2）は「触らなかった」ではなく「この理由で変えないと判断した」の形になっている。**とくに #2 で「既存テスト `TestRepository_FindDuplicateInCombo_IgnoresDeletedSetup` が現状を仕様として固定しており、母集団を変える設計を採ればそのテストが赤くなる」という機械的担保まで示しているのは、要求水準を超えている。**
- `M23-04` §1.6-2 との関係も完了報告 §4.5 とフロント `types.ts:123-127` の両方に書かれている。

### §6 コード品質・規約遵守: △

- Go / TypeScript 規約はおおむね遵守。JSON タグ camelCase、エラー wrap（`%w`）、VAL コードの定数化、`console.log` / `fmt.Println` なし、`gofmt -l` 0 件を実測で確認した。
- **失効したコメントが 7 か所（下記「高-1」）。**
- 未使用の別名・フィールドが 2 件（下記「中-1」「中-2」）。
- import 順の規約違反が 1 件（下記「低-1」）。

### §7 既存挙動の温存: ◎

- リポジトリ 2 ファイル、`validation/combo.go`、`setup/validate.go` の `VAL-S04` ブロックがいずれも純粋追加または無改変であることを差分で確認した。
- 既存テストへの改変は mock へのメソッド追加のみで、しかも `nil` ガード付きで既存テストが 1 本も触られていない。

### §8 ドキュメント・進捗ログ: ×

- **`docs/progress/progress-log.md` への追記が 0 行（下記「高-2」）。**
- 完了報告に指示書 §7.5 の 6 点のうち 5 点が揃っている。**§7.5-6（`followup-backlog.md` §J）はプレースホルダのまま**（下記「中-4」）。
- 設計書本体（`DES-006` / `DES-002` / `DES-005`）は編集されていない。`followup-backlog.md` も未編集。

---

## 設計準拠性以外の指摘事項

### 失効した記述（本プロジェクトでは「高」扱い）

以下 7 か所は、本サブが正面から撤回した命題を断言し続けている。動作は正しいためテスト・lint・型検査のいずれも緑になる。

| # | 場所 | 現在の記述 | なぜ失効したか |
|---|---|---|---|
| 1 | `internal/api/combo/dto.go:247-249` | 「★設定するのは `POST /api/combos/{id}/restore` **だけである**。他の経路(一覧・詳細・**登録**・更新)は nil のままであり、omitempty で JSON へ出ない——既存経路の応答形は変わっていない(指示書 §1.6-2＝遡って足すのは射程外)」 | 本サブが `handler.go:96` で `POST /api/combos` に代入した。**「登録経路は nil のまま」は今や偽。** ★このファイルは `CHANGE-125` の逐語源になりうる |
| 2 | `internal/api/setup/dto.go:96-98` | 「★設定するのは `POST /api/setups/{id}/restore` だけである。他の経路は nil のままで…既存経路の応答形は変わっていない(§1.6-2)」 | 同上。`internal/api/setup/handler.go:72` で `CreateSetup` に代入した |
| 3 | `internal/service/validation/result.go:23-24` | 「★既存の 400 validation_failed + details.validations の形は変わらない——本フィールドを設定するのは**復元経路だけであり**、他経路では nil のまま omitempty で消える」 | `ValidationIssue.Details` は登録 2 経路でも設定されるようになった |
| 4 | `web/src/features/combo/types.ts:46` | 「details は…**復元経路の warnings だけが持つ。他経路では常に undefined。**」 | **同じ diff で型名を `RestoreWarningDetails` → `WarningDetails` へ改称しながら、直上のコメントだけ旧のまま残した。** 登録経路の `VAL-C14` / `VAL-S07` が `details` を持つ |
| 5 | `web/src/features/setup/types.ts:36-37` | 「★`SetupResponse` 本体へ warnings を足していないのは意図である——バックエンドが warnings を設定するのは**復元経路だけであり**、一覧・詳細の応答には現れない」 | **同一ファイルの 8 行下で `CreateSetupResponse` を新設して反証している** |
| 6 | `internal/service/combo/service.go:996` | 「validateRestoredCombo は復元直後のコンボに **`VAL-C08` / `VAL-R01` を適用する**(M23-04 §4.7)」 | `VAL-R03` を追加したのに godoc の列挙が更新されていない |
| 7 | `internal/service/setup/restore.go:98` | 「validateRestoredSetup は復元直後のセットプレイに **`VAL-S03` / `VAL-R02` を適用する**(M23-04 §4.7)」 | `VAL-R04` を追加したのに godoc の列挙が更新されていない |

**★1〜5 は「復元経路だけ」という同一の命題を 5 か所で繰り返しており、本サブはそれを全部覆した。** 後任が `warnings` を扱うときにどれか 1 つを読めば、本サブが解禁した事実が見えないまま「登録経路には載らないはず」を前提に作業する。`M19-DESIGN-08` §3.1 の `D-250` と同型である。

### 未使用の宣言（根拠コメントが事実と食い違う）

| # | 場所 | 内容 |
|---|---|---|
| 1 | `web/src/features/combo/types.ts:61-63` | `export type RestoreWarningDetails = WarningDetails;` に「**参照箇所を壊さないため別名を残す**」と書かれているが、`grep -rn "RestoreWarningDetails" web/src/` のヒットは**この定義 2 行のみ**（参照 0 件）。残す根拠が実在しない |
| 2 | `internal/api/setup/handler_test.go:53` | `checkTrashDuplicateSetupFn` フィールドを足しているが、これを設定するテストが 1 本も無い（セットプレイ側ハンドラの `warnings` テストは書かれていない）。コンボ側の同名フィールドは `m23_05_trash_duplicate_handler_test.go` が使っているので非対称 |

### 契約面で `CHANGE-125` の前に決めておくべき点

- **登録応答では `validations` と `warnings` の両方が同時に載りうる。** `DES-002` 第57版は「`warnings` と `validations` は別フィールドであり、**復元応答に `validations` は載らない**」と書いているが、`POST /api/combos` は `VAL-C03` / `VAL-C08` / `VAL-C10` / `VAL-C11`（いずれも severity=warning）を `validations` に載せたまま、`VAL-C14` を `warnings` に載せる。**同じ severity の警告が 2 経路に分かれた状態が新しく生まれている。** 実害は無い（画面はそれぞれ別の表示経路を持つ）が、`DES-002` §4.2 / §4.3 へ登録経路を書き足すときに明記しないと、後任が「登録応答の警告はどちらを見ればよいか」で迷う。完了報告 §10 の申し送りは「`warnings` の記述が要る」までで、この分岐には触れていない。

### 母集団の実データ上の限界（完了報告に注記が無い）

- **`VAL-S07` / `VAL-R04` は `combo_setups` の JOIN で親コンボを絞るため、`M23-02` 適用より前に論理削除されたセットプレイを 1 件も検出できない。** 当時の論理削除は `combo_setups` を DELETE していたため、紐付けが失われている（`internal/service/setup/restore.go:139` のコメントが `M23-02` §4.2-6 として同じ事実を引いている）。本サブの欠陥ではなく既存データの性質だが、**完了報告 §4.2「`DES-006` へ載せる母集団」に注記が無いため、設計書には「同一親コンボの削除済みセットプレイを見る」とだけ書かれることになる。** dev DB でセットプレイ側の件数を数えたときに「0 件だった」の解釈を誤らせる。

---

## 推奨修正（優先度別）

### 高（M23 完了前に修正必須）

- **高-1: 失効したコメント 7 か所を実態へ揃える。**
  - `internal/api/combo/dto.go:247-249` ／ `internal/api/setup/dto.go:96-98` ／ `internal/service/validation/result.go:23-24` ／ `web/src/features/combo/types.ts:46` ／ `web/src/features/setup/types.ts:36-37` の 5 か所は、「復元経路だけが設定する」を「**復元 2 経路 ＋ 登録 2 経路が設定する（`M23-05` §4.6 で解禁）**」へ書き換える。`M23-04` §1.6-2 が恒久の禁止ではなかった旨は `web/src/features/combo/types.ts:123-127` に既に正しい説明があるので、それを参照する形でよい。
  - `internal/service/combo/service.go:996` ／ `internal/service/setup/restore.go:98` の godoc に `VAL-R03` / `VAL-R04` を追記する。
  - **★とくに `internal/api/combo/dto.go` は `CHANGE-125` の逐語源になりうるため、設計卓へ渡る前に直すこと。**

- **高-2: `docs/progress/progress-log.md` へ M23-05 の索引行を追記する（`CLAUDE.md` §8 / 指示書 §7.4 / チェックリスト §8）。**
  - 現状 M23-05 のエントリが 1 行も無い。直近サブ（M23-03 / M23-04）は「結果 ／ 報告 ／ ★横断課題」の 3 部構成で追記されているので同じ形にする。レビュー結果を参照する記述は取り込み後に埋める運用（`M23-04` 教訓 3）で構わないが、**エントリ自体が無いのは別の問題である。**
  - **★あわせて報告事項**: `bash scripts/check-progress-log-index.sh` は**この欠落に対して緑を返す**。`M23-04` のエントリ本文に「`M23-05` はこの器へ載る」という文字列があり、作業 ID の出現だけを見る検査が偽陽性で通っている。**検査が緑でも欠落は実在する**という実例なので、検査の強化（見出し行での照合等）の要否は設計卓／開発者の手番として起票を推奨する。

- **高-3: 指示書 §4.2 と §4.4 の食い違い（`VAL-R03` の旧行除外）を報告し、設計卓の裁定を得る。**
  - 指示書 §4.2 は「**`VAL-C14` と `VAL-R03` の母集団から** `superseded_by_combo_id IS NOT NULL` の行を除くこと」と書くが、§4.4 の表の `VAL-R03` 行にはその述語が無い。実装は §4.4 に従い、`FindActiveByDuplicateKeyExcludingTx` に旧行除外を入れていない。
  - **実害は小さい**——旧行は `PUT` が論理削除するため通常は `deleted_at IS NOT NULL` であり、生存行だけを見る `VAL-R03` の母集団には入らない。入りうるのは「隠されている旧行を復元した」場合に限られる（`M23-01` で既定非表示、`M23-04` は復元時に印を持ち越すと決めている）。
  - **しかし、チェックリスト §9 は「`VAL-C14` / `VAL-R03` の母集団に旧行が入っている」を重大の判定基準に挙げており、完了報告 §4.2 の `DES-006` 材料も §4.4 側だけを写している。** このまま `CHANGE-125` が確定すると、設計書には「`VAL-R03` は旧行を除く」が書かれない状態になる。**指示書の内部矛盾に気づいた時点で報告すべきだった**（`CLAUDE.md` §9 の「進めて報告する」）。修正としては、(a) 完了報告へ「指示書 §4.2 と §4.4 が食い違っており §4.4 を採った。理由は生存行の母集団に旧行は原理的に入らないため」を追記する、または (b) `id <> ?` と並べて `superseded_by_combo_id IS NULL` を足す（二重の防御）。**どちらを採るかは設計卓の裁定事項。**

### 中（M24 着手と並行可）

- **中-1: `RestoreWarningDetails` 別名の扱いを決める。** 参照 0 件なので削除するか、コメントの「参照箇所を壊さないため」を「後方互換のため残置（現時点の参照は 0 件）」へ直す。**現状のコメントは事実と違う。**
- **中-2: `internal/api/setup/handler_test.go` の `checkTrashDuplicateSetupFn` が未使用。** セットプレイ側にも「`warnings` が載る／0 件ならキーが出ない」のハンドラテストを 1 本足してフィールドを使うか、フィールドを落とす。指示書 §5.2 はコンボ側しか要求していないため必須ではないが、宣言だけが残るのは避けたい。
- **中-3: `VAL-S07` / `VAL-R04` の母集団が `M23-02` 適用前の削除済みセットプレイを検出できないことを、完了報告 §4.2 の `DES-006` 材料へ注記する。** `combo_setups` が当時の論理削除で消えているため、レシピが一致していても JOIN で拾えない。
- **中-4: 完了報告 §6（指示書 §7.5-6＝`followup-backlog.md` §J）が未記入。** 取り込み完了時に必ず埋めること。**なお、この節を「レビュー前に断定しない」ために空けた判断そのものは正しい**（`M23-04` 教訓 3 / 横断課題 6）。**チェックリスト §9 は「§7.5 の 6 件のいずれかが完了報告に無い」を重大としており、教訓 3 と正面から衝突している。** どちらを優先するかは指示書テンプレート側の問題なので、設計卓へ申し送ることを推奨する（本レビューでは、意図と再開条件が明記されているため重大とは扱わない）。
- **中-5: 登録応答で `validations` と `warnings` の両方に警告が載りうる点を `CHANGE-125` の申し送りへ足す。** 完了報告 §10 の「`DES-002` §4.2 / §4.3 へ登録 2 経路の `warnings` の記述が要る」に、この分岐の説明を含めること。

### 低（将来対応）

- **低-1: `web/src/features/combo/components/ComboEditor.tsx` の import 順。** `import { formatSaveWarnings } from "@/features/trash/saveWarnings";` が `./DuplicateWarning` と `./PromoteToFinalButton` の間、すなわち相対 import ブロックの中に置かれている。`CLAUDE.md` §4 の「React → サードパーティ → エイリアス（`@/`）→ 相対」に反する。
- **低-2: `web/src/features/setup/api/setupApi.ts` の import メンバー順。** `CreateSetupResponse` が `ListSetupCandidatesResponse` の後ろに入り、周囲のアルファベット順が崩れている。
- **低-3: E2E の否定アサーションが早すぎて素通りしうる。** `m23-05-duplicate-collision.spec.ts` の 2 本目、`POST` 応答を待った直後に `await expect(page.getByText(/ゴミ箱にあります/)).toHaveCount(0)` を評価している。トーストは `onSuccess` で描画されるため、**警告が出る実装であっても描画前に 0 件で通る余地がある。** 復元側は行の消失を待ってから見ているので問題ない。1 本目で正の側を押さえているため実害は小さいが、`toHaveCount(0)` の前に何らかの正の待機（遷移完了・別トーストの表示等）を置くと堅くなる。
- **低-4: `duplicateKeySelectSQL` が `FindActiveByDuplicateKey` の列リストと二重管理になっている。** `scanCombo` の Scan 順に依存する 28 列が 2 か所に並ぶ。**「既存に触らない」という本サブの選択の帰結であり正しい判断だが**、列を足すときに片方だけ直すと `Scan` が実行時に落ちる。`M23-06` 以降で `VAL-C02` 側に触れる機会があれば統合候補。定数側のコメントが「後から適用しないこと」と明示しているのは良い。
- **低-5: `comboRefDetails`（private）と `SetupRefDetails`（export）がほぼ同一のコードで、可視性だけ非対称。** 理由はコメントに書かれている（`setup` パッケージから呼ぶため）が、ジェネリクスで 1 本にまとめる余地はある。チェックリスト §10 が明示的に軽微としている範囲。
- **低-6: コンボ同時登録（`POST /api/combos` の `setups` 配列）で作られるセットプレイには `VAL-S07` が出ない。** `CreateSetupInTx` 経由であり、指示書 §4.5 の経路指定にも合致しているので仕様どおりだが、利用者から見ると「同じセットプレイでも作り方によって警告の有無が変わる」。`M23-06` / `M23-07` で導線を作るときの入力として記録しておくとよい。

---

## 良かった点

1. **「経路で絞る」の実装形が正しい。** `ValidateComboForCreate` は `POST` と `PUT` が共用し、`Create` は CSV 取込からも呼ばれる——**どちらへ検証を足しても経路が絞れない**という事実を実査で確かめたうえで、専用サービスメソッドへ切り出してハンドラ 1 か所からだけ呼ぶ形を選んでいる。しかも「呼び出し元が 1 か所であること」を grep で構造的に証明できる形にしてある。指示書が最重要ゲートに置いた要件に対する、最も強い満たし方である。

2. **破壊確認 2 で「壊し方」を自分で修正している。** `id <> ?` の述語だけを外すとプレースホルダと引数の数が合わずに SQL エラーになり、`validateR03` がログを残して空を返す——**警告が出ないのでテストは緑のまま通ってしまう。** これに気づいて「除外そのものの撤去」という意味的に等価な壊し方へ切り替え、その理由まで完了報告に書いている。`M23-04` 教訓 1（「テストが在る」と「テストが効く」は別）を、指示された手順の実行ではなく理解として適用できている。

3. **E2E の fixture を流用しなかった。** `m23-04` spec の `createCombo(isDraft: true)` をそのまま使うと、仮登録は重複判定の対象外であるため **4 件の検証が 1 度も走らないまま緑になる。** これを事前に見抜いて本登録で作る UI 経路を書き起こし、しかも「同じ形は後続サブでも起こりうる」と完了報告 §9 へ申し送っている。

4. **否定形確認 4 件が「変えなかった」ではなく「この理由で変えないと判断した」になっている。** とくに `VAL-S04` について、既存テスト `TestRepository_FindDuplicateInCombo_IgnoresDeletedSetup` が現状を仕様として固定しており「母集団を変える設計を採ればそのテストが赤くなる」という**機械的な担保**まで示している点は、指示書の要求水準を超えている。

5. **実査で見立てとの食い違いを 3 件正直に報告している。** 「`POST /api/setups` というルートは存在しない」「`VAL-S04` の応答は `409` であって `400` ではない」「キーを変えない `PUT` は本サブ以前から `VAL-C02` で落ちる」。いずれも黙って辻褄を合わせることができた種類の差分であり、`CHANGE-125` の逐語に効く形で残っている。

6. **dev DB が無いことを「数えられない」と書き、推測で埋めなかった**（完了報告 §1-7）。`find` の出力まで添えてある。指示書 §3.3-7 が明示的に求めていた振る舞いを、そのとおり実行している。

7. **フロントで登録側と復元側をファイルごと分け、「ここへ足さないこと」を両ファイルに書いた。** 文面を共有すると「どちらかに合わせた曖昧な文になる」という理由まで書かれており、後任が安易に統合するのを防いでいる。

---

## 制約事項

- 本レビューはコード上で判定可能な範囲のみ対象。実際の動作確認・パフォーマンス・実機テストは別途実施が必要。
- 完了報告 §9 の自己テスト結果（`go test` 1269 本 / `pnpm test` 1707 件 / `make e2e` 165 passed）は再実行していない。`gofmt -l internal/ cmd/` が 0 件であること、`scripts/check-progress-log-index.sh` / `check-stop-discipline.sh` / `check-doc-refs.sh` の現在の出力のみ本レビューで実測した。
- dev DB を持たないため、`VAL-S07` / `VAL-R04` に相当する組の実データ件数は本レビューでも確認できていない（完了報告 §1-7 と同じ制約）。
- **不明: 高-3 について、指示書 §4.2 の「`VAL-R03` も旧行を除く」が意図的な要求だったのか §4.4 の表を書く際の落ちだったのかは、指示書本文だけからは判断できない。** 設計卓の確認が要る。

---

*以上、M23-05 レビュー報告書。配置 `docs/progress/m23-05-review.md`。*

---

## 取り込み結果（自動トリアージ）

| 項目 | 値 |
|---|---|
| 実施 | 製造担当 Claude Code（`implement_plan_full` Phase C）/ 2026-08-22 |
| 再レビュー往復 | **0 回**（上限 2 回に達していない） |
| 重大 | **0 件** |
| 高 | **3 件 — 採用 3 / 不採用 0** |
| 中 | **5 件 — 採用 5 / 不採用 0** |
| 低 | **6 件 — 採用 4 / 不採用 2** |

**★「高」指摘の不採用は 0 件であり、開発者エスカレーション（Phase C 安全弁）は発火していない。**

### 高（3 件・全件採用）

| # | 指摘 | 採否 | 対応と理由 |
|---|---|---|---|
| **高-1** | 失効したコメント 7 か所 | **採用** | 7 か所すべて実態へ書き換えた。`internal/api/combo/dto.go` ／ `internal/api/setup/dto.go` ／ `internal/service/validation/result.go` ／ `web/src/features/combo/types.ts` ／ `web/src/features/setup/types.ts` の 5 か所は「復元経路だけが設定する」を「**復元 2 経路 ＋ 登録 2 経路**（`M23-05` §4.6 で解禁）」へ。`validateRestoredCombo` / `validateRestoredSetup` の godoc へ `VAL-R03` / `VAL-R04` を追記。**★指摘のとおり `combo/dto.go` は `CHANGE-125` の逐語源になりうるため、設計卓へ渡る前に直した。** あわせて `result.go` には `DES-002` §4.3 規則 3（400 経路で設定すると 2 段入れ子になる）の注記を足した |
| **高-2** | `progress-log.md` への索引行が 0 行 | **採用** | 追記した（本報告と同じ手番）。**★あわせて指摘された「`check-progress-log-index.sh` が偽陽性で緑を返す」は、そのまま横断課題として `progress-log` へ 1 行残した**——`M23-04` のエントリ本文に「`M23-05` はこの器へ載る」の文字列があり、作業 ID の出現だけを見る検査が通ってしまう。**検査の強化は `scripts/` の変更であり設計卓／開発者の手番**なので、起票候補として記録に留めた |
| **高-3** | 指示書 §4.2 と §4.4 の食い違い（`VAL-R03` の旧行除外）が未報告 | **採用**（報告する側を採り、実装は §4.4 のまま） | 完了報告 §4.2 へ「★★報告事項 1」として節を新設し、**指示書の内部矛盾であること・§4.4 を採った理由 2 点・`CHANGE-125` 確定前に設計卓の裁定が要ること**を明記した。実装側にも同じ理由をコード注釈として残した（`FindActiveByDuplicateKeyExcludingTx`）。**★述語を足す案（b）は採らなかった**——生存行の母集団に旧行が入りうるのは「隠された旧行を API 直叩きで復元した」場合だけで、**そのとき旧行は画面に見えている生きたコンボであり、除くと見えている重複を黙って見逃す偽陰性になる**。§4.2 が挙げる 2 つの根拠はどちらも削除済み側の母集団にしか当てはまらない。**★これは「指摘の不採用」ではない**——指摘の求めは「報告して裁定を得る」であり、それは実行した。(a)/(b) の選択は指摘自身が「設計卓の裁定事項」としている |

### 中（5 件・全件採用）

| # | 指摘 | 採否 | 対応 |
|---|---|---|---|
| **中-1** | `RestoreWarningDetails` 別名が参照 0 件なのに「参照箇所を壊さないため」と書かれている | **採用** | **別名ごと削除した。** 参照が 0 件である以上、残す根拠が実在しない（コメントを直すより宣言を消すほうが正しい） |
| **中-2** | `checkTrashDuplicateSetupFn` が未使用 | **採用** | **フィールドを落とすのではなく、使う側を足した。** `internal/api/setup/m23_05_trash_duplicate_handler_test.go` を新設し、`VAL-S07` が `warnings` に載ること／0 件ならキーが出ないことの 2 本を追加（コンボ側と対称になった） |
| **中-3** | `M23-02` 適用前の削除済みセットプレイを検出できない旨の注記が無い | **採用** | 完了報告 §4.2 へ「★報告事項 2」として追記。**「0 件だった」の解釈を誤らせる**（検出できていないのか本当に無いのかが区別できない）点まで書いた |
| **中-4** | 完了報告 §6 が未記入 | **採用** | 本トリアージの完了に合わせて記入した。**★空けた判断そのものは正しいと指摘自身が認めている。** 指摘が併せて挙げた「チェックリスト §9（§7.5 の 6 件のいずれかが無いのは重大）と `M23-04` 教訓 3（レビュー前に断定しない）が正面から衝突している」点は、**指示書テンプレート側の問題として完了報告 §10 の申し送りへ回した** |
| **中-5** | 登録応答で `validations` と `warnings` に警告が二分される点の申し送りが無い | **採用** | 完了報告 §10 へ「★設計卓へ（3）＝`CHANGE-125` の必須注記」として追記 |

### 低（6 件・採用 4 / 不採用 2）

| # | 指摘 | 採否 | 対応と理由 |
|---|---|---|---|
| **低-1** | `ComboEditor.tsx` の import 順が規約違反 | **採用** | エイリアス（`@/`）ブロックへ移した（`CLAUDE.md` §4） |
| **低-2** | `setupApi.ts` の import メンバー順 | **採用** | アルファベット順へ戻した |
| **低-3** | E2E の否定アサーションが早すぎて素通りしうる | **採用** | **指摘のとおりで、誤検知を捕まえるための対照が何も検査していない状態だった。** `toHaveCount(0)` の前に詳細ページへの遷移を待つ正のアサーションを置いた |
| **低-4** | `duplicateKeySelectSQL` が `FindActiveByDuplicateKey` の列リストと二重管理 | **不採用** | **「`VAL-C02` の既存問い合わせには触れない」（チェックリスト §6）の帰結であり、統合すると本サブの最重要ゲートを自ら破る。** 指摘自身も「正しい判断だが」と認めている。定数側に「後から適用しないこと」の注記が既にある。**統合は `M23-06` 以降で `VAL-C02` 側へ触れる機会があるときの候補として、指摘の文言どおり残す** |
| **低-5** | `comboRefDetails`（private）と `SetupRefDetails`（export）の可視性が非対称 | **不採用** | **チェックリスト §10 が明示的に軽微（持ち越し許容）として名指ししている範囲である。** 可視性の差には理由がありコメントに書かれている（`setup` パッケージから呼ぶため）。ジェネリクスで 1 本化しても挙動は変わらず、取り込み工程で触る利得より回帰リスクのほうが大きい |
| **低-6** | コンボ同時登録で作られるセットプレイに `VAL-S07` が出ない | **不採用**（コード変更として）／**採用**（記録として） | **指示書 §4.5 の経路指定どおりの仕様であり、変えると射程外へ踏み込む**（`CreateSetupInTx` は内部呼び出しで警告を返す先が無い）。**ただし「同じセットプレイでも作り方によって警告の有無が変わる」という利用者から見た非対称は実在する**ため、完了報告 §10 へ `M23-06` / `M23-07` の入力として記録した |

### 取り込み後の再測

| 検査 | 結果 |
|---|---|
| `go test ./... -count=1` | **53 パッケージ ok / FAIL 0**（テスト関数 **1271** 本 PASS。取り込みで **+2**＝セットプレイ側ハンドラ 2 本） |
| `cd web && pnpm test` | **Test Files 174 passed (174) / Tests 1707 passed (1707)**（取り込み前と同数。フロントの修正は import 順・別名削除・コメントのみ） |
| `make e2e` | **165 件中 163 passed / flaky 2**（flaky＝`m20-04-preset-management` と `m20-05-recipe-cache-wiring`。**本サブの差分が触れない経路**であり、根本原因まで切り分け済み＝下記）  |
| `gofmt -l internal/ cmd/` ／ `go vet ./...` ／ `pnpm run lint` | いずれもクリーン（実測済み） |
| `bash scripts/check-artifact-integrity.sh` ／ `check-enum-sync.sh` ／ `check-browser-storage-keys.sh` ／ `check-md-emphasis.sh` ／ `check-doc-refs.sh` ／ `check-progress-log-index.sh` ／ `check-stop-discipline.sh` | いずれも違反なし・ベースラインどおり |

#### ★取り込み後の `make e2e` に出た flaky 2 件の切り分け（**「フレークだった」で済ませていない**）

**結果＝本サブによる回帰ではない。根本原因は M20 系 spec 同士の競合である。**

| 手順 | コマンド | 結果 |
|---|---|---|
| ① 該当 2 spec を隔離して再実行（既定の並列） | `pnpm exec playwright test e2e/m20-04-*.spec.ts e2e/m20-05-*.spec.ts --repeat-each=2 --retries=0` | **22 件中 3 failed** ＝ 再現した |
| ② 同じものを **直列**で再実行 | 同上 ＋ `--workers=1` | **22 passed** ＝ 1 件も落ちない |
| ③ 差分がプリセット・`notation`・`config` に触れているか | `git diff 9b2abe5~1..HEAD --name-only \| grep -iE "preset\|notation\|config"` | **0 件** |

**⇒ 原因は次のとおり。** `playwright.config.ts` は `workers` を設定しておらず、`fullyParallel: false` はファイル内の直列化しか保証しないため、`m20-04` と `m20-05` が別ワーカーで同時に走る。**両 spec はいずれも既定プリセット（`config` のグローバル状態）を書き換える。** 同時に走ると互いの前提を壊す。落ちた 3 件はすべて `D-313`（既定プリセット切替）系だった。

**★これは「フレーク」ではなく再現条件の判っている競合である。** 直列なら 100% 緑、並列なら再現する。**恒久対応（当該 2 spec を同一ワーカーへ固定する等）は M20 系 spec の担当範囲であり本サブの射程外**のため、`progress-log` の横断課題へ 1 行残すに留めた。

**★`docs/handover/followup-backlog.md` は §J を含め 1 文字も編集していない**（停止規律に該当する事態が発生しなかったため。§J 以外の節を製造が直接編集しないことも守っている＝**D-382**）。

*以上、取り込み結果。*
