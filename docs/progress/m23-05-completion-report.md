# M23-05 完了報告: 削除済み行と再登録の衝突（`FR301` の重複判定が見ていない側を、落とさずに知らせる）

| 項目 | 内容 |
|------|------|
| 作業 ID | M23-05 |
| 対象指示書 | `docs/instructions/M23-05-deleted-row-duplicate-collision.md` v1.0.0 |
| チェックリスト | `docs/instructions/reviews/M23-05-review-checklist.md` v1.0.0 |
| 実施日 | 2026-08-22 |
| ブランチ | `claude/m23-05-implementation-plan-d4j9aj` |
| 消費マイグレーション | **0 本**（§4.7 のとおりスキーマ不変。disk 末尾は `000078` のまま） |
| 消費 CHANGE 番号 | **0 件**（反映は設計卓が `CHANGE-125` で行う＝§7.4） |

---

## 1. §3.3 実査 8 件の結果（走査コマンドと件数付き）

**★`E-125` に従い、終了コードだけを根拠にしていない。** 各行に走査コマンドと件数を添える。

### 1-1. ★★`PUT` の書き込み順序 —— **見立てどおり。印は後から付く**

```
$ grep -rn "superseded_by_combo_id" --include=*.go internal/ | grep -v _test | wc -l
10        ← うち書き込みは internal/service/combo/service.go:648 の 1 件だけ
```

`internal/service/combo/service.go` の `UpdateWithKeyChange` の実際の順序:

| 順 | 文 | 行 |
|---|---|---|
| **0** | **★検証（`ValidateComboForCreate`）は Tx の外・`BeginTx` より前** | **`:568`** |
| 1 | `BeginTx` | `:590` |
| 2 | 旧行の論理削除 ＋ 楽観的排他（1 文） | `:601` |
| 3 | 新行 `InsertCombo`（ここで `newID` が確定） | `:632` |
| **4** | **`UPDATE combos SET superseded_by_combo_id = ? WHERE id = ?`** | **`:648`（2-b）** |
| 5 | `InsertSteps` 以降 | `:653`〜 |

**⇒ 印は新行 id を要するため 2 文目にまとめられず、Tx 内 3 文目に書かれる**（コード側のコメントが同じ理由を明記している）。**設計卓の見立てと一致。**

**★あわせて分かったこと（見立てより強い）**——**検証は Tx の外で走るため、`PUT` 自身の旧行はその時点でまだ生きている**（`deleted_at IS NULL`）。**⇒ 印による除外だけでは `PUT` を守れないという §4.2 末尾の指摘は、想定より強い意味で正しい。** 指示書どおり **§4.5-1 の「経路で絞る」を実装した**（下記 §1-9）。

### 1-2. `VAL-C02` の 2 段構造 —— **見立てどおり。関数として再利用できる形**

```
$ grep -rn "FindActiveByDuplicateKey\|CalcRecipeHash" --include=*.go internal/ | grep -v _test | wc -l
14
```

| 段 | 実装 |
|---|---|
| ① SQL で候補を絞る | `validation.validateC02Duplicate`（`internal/service/validation/combo.go:153`）が `DuplicateKey`（6 項）を組み `deps.ComboRepo.FindActivePublishedDuplicates` を呼ぶ |
| ② ハッシュで比較 | `ComboDuplicateAdapter`（`internal/service/combo/service.go:1220`）が `repo.FindActiveByDuplicateKey` → `FindStepsForCombos` → `CalcRecipeHash`。一致判定は `combo.go:178` |

**★判定キーは SQL 段が 6 項**（`character_id` ＋ nullable 5 項）**、これに `recipe_hash` の Go 側比較が加わる。** 指示書の「6 項」は SQL 段を指す。

### 1-3. `VAL-S04` が使うハッシュ実装 —— **★2 実装が 1 回の判定で同時に走る**

```
$ grep -rn "SetupRecipeHash\|setupRecipeHash" --include=*.go internal/ | wc -l
20
```

| 側 | 実装 | 場所 |
|---|---|---|
| 入力（新レシピ） | `setup.CalcSetupRecipeHash` | `internal/service/setup/duplicate_keys.go:16`（`service.go:163/241/401` から） |
| 候補（DB 上の既存） | `calcSetupRecipeHashFromSteps` | `internal/repository/setup/repository.go:963`（`FindDuplicateInCombo` 内 `:823`） |

**⇒ どちらか一方ではなく、両方が突き合わされる構造である。** コンボ側の `CalcRecipeHash` を含めて **3 実装**（`M23-RESEARCH-01` H-3 の記述は健在）。

**★本サブは統合しない**（§2.2 / §9.1-5）。**新規 4 本も同じ 2 実装の組み合わせを踏襲した**——入力側は `CalcSetupRecipeHash` / `CalcRecipeHash`、候補側は既存と同じ関数。**別の「同じ」を作らないため**（§4.1-2）。

### 1-4. `is_draft` の扱い —— **保つ（見立てどおり）**

`FindActiveByDuplicateKey` は `is_draft = 0` を持つ（`internal/repository/combo/repository.go:1080`）。**新規 2 本（`FindDeletedByDuplicateKey` / `FindActiveByDuplicateKeyExcludingTx`）でも `is_draft = 0` を保った。**

### 1-5. 成功応答のステータスと DTO —— **見立てどおり**

```
$ grep -rn "\.Warnings = " --include=*.go internal/api/ | grep -v _test
internal/api/combo/handler.go:450        resp.Warnings = warnings.Issues        ← 復元のみ（M23-04）
internal/api/setup/restore_handler.go:50 out.Warnings = warnings.Issues         ← 復元のみ（M23-04）
```

| 経路 | ステータス | DTO |
|---|---|---|
| `POST /api/combos` | **`201 Created`**（`internal/api/combo/handler.go:99`） | `ComboResponse.Warnings []validation.ValidationIssue` ＋ `omitempty`（`dto.go:254`）＝**既に在る** |
| `POST /api/combos/:comboId/setups` | **`200 OK`**（`internal/api/setup/handler.go:66`） | `SetupResponse.Warnings` 同型（`dto.go:99`）＝**既に在る** |

**⇒ DTO は 1 行も足していない。** 代入箇所を復元 2 か所から **登録 2 か所へ広げただけ**である。

### 1-6. 同一親コンボの削除済みセットプレイを引ける経路 —— **★見立てと食い違い（報告事項）**

**設計卓の見立ては「在る見込み」だったが、レシピ比較に使える経路は無かった。**

```
$ grep -n "deleted_at IS NOT NULL" internal/repository/setup/*.go | grep -v _test
restore.go:151   FindDeletedSetupRefsByComboID   ← 削除済みは引けるが {id, name} のみ・steps を返さない
restore.go:213   ListDeletedByCharacterID        ← ゴミ箱一覧（親コンボで絞れない）
```

- `FindDeletedSetupRefsByComboID`（`M23-04` の `VAL-R01` 用）は **`{id, name}` しか返さず、レシピ比較ができない。**
- `FindDuplicateInCombo`（`VAL-S04`）は **`AND s.deleted_at IS NULL` 固定**、かつ **非 Tx（`r.db` 直叩き）で復元 Tx の内側から呼べない。**

**⇒ リポジトリ層へ 2 本追加した**（§9.2-1 が名前・置き場・粒度を製造判断へ委ねている範囲）。

### 1-7. ★dev DB のセットプレイ側の実データ件数 —— **★数えられない**

```
$ find . -name '*.db' -not -path './node_modules/*' | wc -l
0
$ ls data/ 2>/dev/null || echo "(no data/)"
(no data/)
```

**本セッションに dev DB は存在しない**（`M23-RESEARCH-01` §0.3 と同じ構造的理由＝クラウド実行環境）。**追補 H-5 も `combos` / `combo_steps` のみを数えており、セットプレイ側（`setups` / `combo_setups`）の実データ計測は本報告時点で未実施である。**

**★推測で埋めていない。** **件数が 0 でも 4 件とも実装した**（§4.1-3＝実データの件数は優先度を決めるだけであり、作るかどうかを決めない）。

### 1-8. `M23-04` の `warnings` の要素の形 —— **`DES-002` §4.2 / §4.3 のとおり（見立てどおり）**

`internal/service/validation/result.go:25`:

```go
type ValidationIssue struct {
	Code     string         `json:"code"`
	Severity Severity       `json:"severity"`
	Field    string         `json:"field,omitempty"`
	Message  string         `json:"message"`
	Details  map[string]any `json:"details,omitempty"`
}
```

`model.ComboRef{ID, Memo}` / `model.SetupRef{ID, Name}`（`internal/model/setup.go:120` / `:133`）。生成は `AddWarningWithDetails`。**0 件ならキーごと出さない**（`omitempty` ＋ ハンドラ側 `if len(...) > 0` の二重）。

**★本サブは器を作り直していない。** `ValidationResult` をそのまま返し、ハンドラが `warnings.Issues` を代入する形も同じである。

### 1-9. ★実査で判明した、指示書との差分 3 件（**実装は指示書どおり進めた**）

| # | 差分 | 扱い |
|---|---|---|
| **1** | **`POST /api/setups` というルートは存在しない。** 実ルートは **`POST /api/combos/:comboId/setups`**（`internal/api/setup/routes.go:8`） | 指示書 §4.1 / §2.1 の表記は略称と解釈し、実ルートへ `VAL-S07` を載せた。**★`CHANGE-125` の逐語には実ルート名で書くこと** |
| **2** | **`VAL-S04` の応答は `409 duplicate_setup`**（`internal/api/setup/handler.go:56`）であり `400 validation_failed` ではない | **変えていない。** `VAL-S07` は同じ応答の `warnings` に載る別物である |
| **3** | **キーを変えない `PUT` は `M23-05` 以前から `VAL-C02`（ERROR）で落ちる** —— 検証が Tx の外で走るため旧行がまだ生きており、自分自身が重複候補に当たる（`service.go:565-573` に既知として明記あり） | **本サブは触っていない。** §5.1-4b のテストはこの既存挙動を前提に「そこへ `VAL-C14` が足されていないこと」を主張する |

---

## 2. §4.8 否定形確認 —— **4 件それぞれについて「この理由で変えないと判断した」**

**★「4 件とも触らなかった」ではない。** それぞれ別の理由で、別の性質の判断である。

| # | 変えなかったもの | 判断と理由 |
|---|---|---|
| **1** | **`VAL-C02` の述語・母集団・判定内容** | **変えないと判断した。外すと `PUT` が壊れるからである。** `deleted_at IS NULL` は意図的な設計であり、`DES-006` §2.3 が理由を明記している——`PUT` は旧コンボを論理削除して新コンボを登録する方式のため、述語を外すと自分の消した旧行に衝突してあらゆる編集が重複エラーで落ちる。**★§1-1 の実査で「検証は Tx の外・論理削除の前」と分かったため、外した場合に壊れるのは「キーを変えない編集」だけでなく、`PUT` 全般で旧行が候補に残り続ける形になる。** ⇒ 代わりに、判定の**外側**へ落とさない検証を足した |
| **2** | **`VAL-S04` の判定内容** | **変えないと判断した。同じ理由に加え、既存テストが現状を仕様として固定しているからである。** `internal/repository/setup/repository_test.go` の `TestRepository_FindDuplicateInCombo_IgnoresDeletedSetup` が「削除済みは候補に入らない」を明示的に主張している。**⇒ 母集団を変える設計を採ればこのテストが赤くなる。本サブは新規問い合わせを足す形を採ったため、同テストは緑のままである**（機械的な担保） |
| **3** | **`CalcRecipeHash` の 3 実装（統合しない）** | **統合は正しい方向でありうるが、本サブの射程ではないと判断した**（§9.1-5）。3 実装は `canonicalModifiersJSON` と `emptyRecipeHash` も各 3 本ずつ独立に持ち、共有コードは 1 行も無い（`internal/service/combo/duplicate_keys.go` / `internal/service/setup/duplicate_keys.go` / `internal/repository/setup/repository.go`）。**片方だけ変更してもコンパイルは通る**。**⇒ 統合の是非は設計卓へ送る**（下記 §6-2） |
| **4** | **materialize 経路の二重生成**（`DES-006` §2.3 の既知の穴） | **適用しないと判断した。警告を返す先が無いからである**（§1.4-4）。materialize は `POST /api/combos/:id/materialize` の内部処理であり、応答は `MaterializeResponse{comboId, alreadyExisted}` で `warnings` を持たない。**`DES-006` §2.3 の「仮登録またはゴミ箱にあると検出されず二重生成される」の記述は変えていない** |

---

## 3. §5.5 破壊確認 —— **必須 2 件**

**「テストが在る」は「テストが効く」ではない**（`M23-04` 教訓 1）。**母集団の述語を実際に外して、対応するテストが赤くなることを確かめた。**

| # | 壊し方 | 期待 | 実測 |
|---|---|---|---|
| **1** | `FindDeletedByDuplicateKey` の母集団から **`superseded_by_combo_id IS NULL`** を外す | §5.1-3 が赤 | **赤くなった** |
| **2** | `FindActiveByDuplicateKeyExcludingTx` の母集団から **`id <> ?`**（と対応する引数）を外す | §5.1-7 が赤 | **赤くなった** |

**★破壊 2 は述語だけでなく引数の追加も同時に外した。** 述語だけ消すとプレースホルダと引数の数が合わず SQL エラーになり、`validateR03` がログを残して空を返す——**警告が出ないのでテストは緑のまま通ってしまう。**「壊したのに緑」を「壊れていない」と誤読しないため、意味的に等価な壊し方（除外そのものの撤去）にした。

```
##### 破壊 1: VAL-C14 の母集団から superseded_by_combo_id IS NULL を外す #####
  -> 述語を外した
$ go test ./internal/service/combo/ -run 'TestCheckTrashDuplicate_VALC14_ExcludesSupersededOldRow' -count=1
--- FAIL: TestCheckTrashDuplicate_VALC14_ExcludesSupersededOldRow (0.53s)
    trash_duplicate_test.go:177: PUT が積んだ旧行に対して VAL-C14 が返った(母集団から除けていない):
      &{Code:VAL-C14 Severity:warning Field: Message:同じ内容のコンボ 1 件がゴミ箱にあります。作り直す代わりに復元できます   ← ★文言は §10 で差し替え済み
        Details:map[combos:[{ID:1 Memo:<nil>}] totalCount:1]}
FAIL
FAIL	github.com/plexiblinp/combomgr/internal/service/combo	0.540s

##### 破壊 2: VAL-R03 の母集団から id <> ? を外す #####
  -> 除外を外した
$ go test ./internal/service/combo/ -run 'TestRestore_VALR03_ExcludesRestoredComboItself' -count=1
--- FAIL: TestRestore_VALR03_ExcludesRestoredComboItself (0.51s)
    trash_duplicate_test.go:397: 重複相手が居ないのに VAL-R03 が返った(自分自身を数えている):
      &{Code:VAL-R03 Severity:warning Field: Message:同じ内容のコンボ 1 件が既に登録されています。復元したので重複して並んでいます
        Details:map[combos:[{ID:1 Memo:<nil>}] totalCount:1]}
FAIL
FAIL	github.com/plexiblinp/combomgr/internal/service/combo	0.518s

##### 復旧確認: 両テストが緑に戻る #####
$ go test ./internal/service/combo/ -run 'TestCheckTrashDuplicate_VALC14_ExcludesSupersededOldRow|TestRestore_VALR03_ExcludesRestoredComboItself' -count=1
ok  	github.com/plexiblinp/combomgr/internal/service/combo	1.090s

$ git diff --stat        ← 復旧後。ワークツリーに差分なし
(空)
```

**⇒ 静かに壊れる形が、実際にテストで落ちる。** **★破壊 1 の実測が示すとおり、除外を落とすと `PUT` の旧行がそのまま警告になる**——「編集のたびに『ゴミ箱に同じものがあります』が出る」状態が、**述語 1 行の欠落で本当に起きる。**

---

## 4. `DES-006` へ載せる 4 件の最終形（**★設計卓が逐語で写す。`CHANGE-125` の反映がこれ待ち**）

### 4.1 新設コード 4 件

| ID | 検証内容 | 種類 | 適用経路（as-built） | 発火条件（as-built） |
|---|---|---|---|---|
| **`VAL-C14`** | 登録しようとしたコンボと重複判定キー ＋ レシピが一致する論理削除済みのコンボが在る | **WARNING** | **`POST /api/combos` のみ** | 母集団に 1 件でも一致が在るとき |
| **`VAL-S07`** | 登録しようとしたセットプレイと同じ親コンボに、同一レシピの論理削除済みセットプレイが在る | **WARNING** | **`POST /api/combos/{comboId}/setups` のみ**（★`POST /api/setups` というルートは存在しない＝§1-9-1） | 同上 |
| **`VAL-R03`** | 復元するコンボと重複判定キー ＋ レシピが一致する生きたコンボが在る | **WARNING** | `POST /api/combos/{id}/restore` | 同上 |
| **`VAL-R04`** | 復元するセットプレイと同じ親コンボに、同一レシピの生きたセットプレイが在る | **WARNING** | `POST /api/setups/{id}/restore` | 同上 |

### 4.2 母集団（**★ここが本サブの本体である。逐語で写すこと**）

| ID | 母集団 |
|---|---|
| **`VAL-C14`** | `deleted_at IS NOT NULL` ＋ `is_draft = 0` ＋ **`superseded_by_combo_id IS NULL`** ＋ 判定キー 6 項 → 候補ごとに `CalcRecipeHash` で比較 |
| **`VAL-R03`** | `deleted_at IS NULL` ＋ `is_draft = 0` ＋ 判定キー 6 項 ＋ **`id <> ?`（復元対象自身）** → 同上 |
| **`VAL-S07`** | 同一親コンボ（`combo_setups` 経由・`combos` 側に述語なし）＋ **`s.deleted_at IS NOT NULL`** → レシピ比較 |
| **`VAL-R04`** | 同一親コンボ（同上）＋ **`s.deleted_at IS NULL`** ＋ **`s.id <> ?`（復元対象自身）** → レシピ比較 |

- **`NULL` 同士は一致として扱う**（`col IS NULL` を生成。既存 `addNullable` と同じ意味論）。
- **レシピ比較は SQL で近似しない。** 既存の 2 段（SQL で絞る → ハッシュで比較）を踏襲する。
- **セットプレイ側の親コンボの母集団は `AllowDeleted`**（`VAL-S04` が `UpdateSetup` で同じ選択をしている＝`M23-03` §4.5）。

#### ★★報告事項 1: 指示書 §4.2 と §4.4 が食い違っている（**設計卓の裁定が要る**）

**§4.2 の散文は「`VAL-C14` と `VAL-R03` の母集団から `superseded_by_combo_id IS NOT NULL` の行を除くこと」と書くが、§4.4 の表の `VAL-R03` 行にはその述語が無い。** **⇒ 指示書の内部矛盾である。**

**実装は §4.4 を採った**（`VAL-R03` に旧行除外を入れていない）。**理由 2 点:**

1. **§4.2 が挙げる 2 つの根拠は、どちらも「削除済みを見る母集団」にしか当てはまらない。** ——「旧行はゴミ箱の一覧に出ず利用者が復元できない」（`VAL-R03` の母集団は生存行であり、そこに居る行は画面に見えている）／「`PUT` のたびに警告が出る」（`PUT` が積む旧行は論理削除済みで生存行の母集団に入らない）。
2. **述語を足すと偽陰性になる。** 生存行の母集団に旧行が入りうるのは「隠されている旧行を API 直叩きで復元した」場合だけであり、**そのとき旧行は画面に見えている生きたコンボである。** 除くと、見えている重複を黙って見逃す。

**★ただしチェックリスト §9 は「`VAL-C14` / `VAL-R03` の母集団に旧行が入っている」を重大の判定基準に挙げている。** **⇒ `CHANGE-125` を確定させる前に、`DES-006` へ「`VAL-R03` は旧行を除かない（理由つき）」と書くか、指示書 §4.2 の散文側を直すかを設計卓が決めること。** 実装側には同じ理由をコード注釈として残してある（`internal/repository/combo/repository.go` の `FindActiveByDuplicateKeyExcludingTx`）。

**★本件は指示書内部の矛盾であり、設計書間の矛盾（`CLAUDE.md` §8 の停止条件）ではない。** 実害が生存行の母集団に限られ、どちらを採っても現行の到達可能な操作では挙動が変わらないため、`CLAUDE.md` §9 の「進めて報告する」に従い実装を進めた。**★着手時点で気づいて報告すべきだった**（レビュー 高-3 の指摘どおり）。

#### ★報告事項 2: `VAL-S07` / `VAL-R04` は `M23-02` 適用前の削除済みセットプレイを検出できない

**両者は `combo_setups` の JOIN で親コンボを絞るため、紐付けが失われているセットプレイは 1 件も拾えない。** `M23-02` 適用より前の論理削除は `combo_setups` を DELETE していたためである（`M23-02` §4.2-6。`internal/service/setup/restore.go` のコメントが同じ事実を引いている）。

**⇒ `DES-006` へ「同一親コンボの削除済みセットプレイを見る」とだけ書くと、この限界が落ちる。** **★dev DB でセットプレイ側の件数を数えたときに「0 件だった」の解釈を誤らせる**——検出できていないのか、本当に存在しないのかが区別できない。**`CHANGE-125` へ注記として写すこと。**

### 4.3 ★仮登録（`is_draft = true`）の扱い —— **as-built の追加確定事項**

**4 件とも、仮登録を「作る」ときと仮登録を「復元する」ときには走らせない。**

**指示書は母集団側の `is_draft = 0`（§3.3-4）しか明示していない。** 実装は `VAL-C02` の先例（`internal/service/validation/combo.go:114` の `if !isDraft`）へ揃えた。**根拠は `DES-006` §2.3「仮登録と本登録の間では重複判定は行わない」であり、走らせる側に倒すと試案を作るたびにゴミ箱の警告が出る形になる。**

### 4.4 ★`DES-006` §1.1 に対する例外の継承

**本サブの 4 件はいずれも WARNING であり、登録・復元を止めない**（`DES-006` §13.1 の原則をそのまま継承）。**`M23-04` が §13.1 で書いた「復元経路は ERROR 種別も止めない」は本サブでも維持している。**

### 4.5 応答と見せ方

- **`M23-04` が作った器をそのまま使う**（`DES-002` §4.2）。**器は作り直していない。**
- **★`M23-04` §1.6-2（「既存の登録・更新経路へ `warnings` を遡って足さない」）との関係**——**同項は `M23-04` の射程を守るための線であり、恒久の禁止ではない。本サブが登録 2 経路へ広げた**（指示書 §4.6 が明示的に解禁している）。**⇒ 設計書間の矛盾ではなく、`CLAUDE.md` §8 の停止条件には当たらない。**
- **`details` の形**——`VAL-C14` / `VAL-R03` は `combos: []ComboRef{id, memo}`、`VAL-S07` / `VAL-R04` は `setups: []SetupRef{id, name}`。**`M23-04` が定めた形に揃えてある。**
- **★`details.totalCount` を足した**（**新規**）。上限 5 件で切るため、配列長だけでは総数が分からない。**`message` は総数を含めて単体で成立させてある**（`DES-002` §4.3 規則 2）。
- **★`DES-002` §4.3 規則 3 の確認**——「新しい経路で `details` を設定するときは、その経路の応答形が本書に在ることを先に確かめる」。**登録 2 経路の `warnings` は `DES-002` に未記載であり、本サブが最初の実装者になる。** ⇒ **`CHANGE-125` で `DES-002` §4.2 / §4.3 へ追記が要る**（`400 validation_failed` の経路ではないため 2 段入れ子にはならない）。
- **文言は翻訳キー経由**（`trash.warning.*`）。**★登録側と復元側で文面を分けてある**——登録側は「ゴミ箱に**も**あります。重複していないか確認してください」、復元側は「復元したので重複して並んでいます」。**利用者にできることが違うため**（§4.6）。
- **★★登録側の文面は当初「作り直す代わりに復元できます」だった。開発者の実機確認で誤りと判明し、差し替えた**（2026-08-22・下記 §10）。
- **★モーダルにしない。** トーストである。

---

## 5. 契約違反の独自判断 —— **0 件**

**★指示書 §9.2 の「推測で進めてよい事項」の範囲を超えた判断は 1 件も無い。** 以下は §9.2 が明示的に製造判断へ委ねている範囲内であり、契約違反ではない。**記録のため列挙する。**

| # | 判断 | §9.2 のどれか | 内容 |
|---|---|---|---|
| 1 | 新しい問い合わせ関数の名前・置き場・粒度 | §9.2-1 | リポジトリ層へ 4 本（コンボ 2 / セットプレイ 2）。**既存 2 関数は無改変**（§7 の機械的確認） |
| 2 | 警告文言の ja / en | §9.2-2（`DES-006` §12 が協同決定としている項目） | `trash.warning.duplicateInTrash` / `duplicateSetupInTrash` / `duplicateAliveCombo` / `duplicateAliveSetup` / `savedWithWarnings` の 5 キー |
| 3 | `details` の件数上限 | §9.2-3 | **上限 5 件 ＋ `details.totalCount` に総数**（§11-2 の暫定案「上限を切り『他 N 件』を伝える」の実装形） |
| 4 | テストのデータ組み立て | §9.2-4 | 既存の `dbtest.Setup` / `newSvc` / `validRyuInput` / `newTestEnv` / `validSetupInput` を流用。新しいハーネスは作っていない |

### 5.1 ★推測で進めた点（コード内コメントにも明示済み）

| # | 推測 | 仮定した内容と理由 |
|---|---|---|
| **1** | **仮登録を「作る」「復元する」ときは判定しない** | 指示書は母集団側の `is_draft = 0` しか書いていない。**`VAL-C02` が draft を完全スキップしている先例（`validation/combo.go:114`）と `DES-006` §2.3 の方針に揃えると仮定した。** 走らせる側に倒すと試案を作るたびに警告が出る |
| **2** | **`details.totalCount`** | 上限で切ると画面が総数を出せなくなるため足した。**`M23-04` の `VAL-R01` / `VAL-R02` は上限を持たないので付かない**（画面は `totalCount ?? 配列長` で読む） |
| **3** | **`VAL-S07` / `VAL-R04` の VAL 定数を `setup` パッケージへ置いた** | `VAL-R` 系だが、判定に必要な材料（親コンボ・レシピハッシュ）が `setup` パッケージに閉じている。`VAL-R01` / `VAL-R02` が `validation` パッケージに在るのと非対称だが、**`validation` へ置くと `setup` の型を逆輸入することになる** |

### 5.2 ★経路の絞り込みをどう実装したか（**★レビューの最重要ゲートの片方**）

**`ValidateComboForCreate` は `POST` と `PUT` が共用しており（`service.go:222` と `:568`）、`Create` 自体も CSV 取込から呼ばれる（`service/comboio/import.go:224`）。⇒ どちらへ検証を足しても経路が絞れない。**

**⇒ 専用サービスメソッドへ切り出し、POST ハンドラからのみ呼ぶ形を採った。**

```
$ grep -rn "CheckTrashDuplicate\b" --include=*.go internal/ | grep -v _test | grep -v "^internal/service/combo/service.go"
internal/api/combo/handler.go:96    ← 呼び出し元はここ 1 か所だけ

$ grep -rn "CheckTrashDuplicateSetup" --include=*.go internal/ | grep -v _test | grep -v "^internal/service/setup/"
internal/api/setup/handler.go:72    ← 呼び出し元はここ 1 か所だけ
```

**⇒ 「`PUT` で `VAL-C14` が走らない」は振る舞いのテスト（§5.1-4a / 4b）だけでなく、grep で構造的に証明できる。** **「印で除く」（`superseded_by_combo_id IS NULL`）と併用している**（§4.2 末尾 / チェックリスト §9）。

---

## 6. `docs/handover/followup-backlog.md` §J へ書いた項目

**1 件も無い。**

**★停止規律に該当する事態が発生しなかった。** **再レビュー往復は 0 回**（初回レビューで重大 0 件、かつ「高」3 件をすべて採用したため、再レビューを要する未解消項目が残らなかった）。**⇒ `docs/handover/followup-backlog.md` は §J を含め 1 文字も編集していない**（§J 以外の節を製造が直接編集しないことも守っている＝**D-382**）。

**★「高」指摘の不採用は 0 件**であり、開発者エスカレーション（`implement_plan_full` Phase C の安全弁）は発火していない。

**レビュー結果と採否の全件は `docs/progress/m23-05-review.md` の「取り込み結果（自動トリアージ）」節が正本である。** 実測＝**重大 0 件 / 高 3 件 / 中 5 件 / 低 6 件**。採否＝**高 3/3 採用・中 5/5 採用・低 4/6 採用**（不採用 2 件＝低-4 は「`VAL-C02` の既存問い合わせに触れない」の帰結で統合すると最重要ゲートを自ら破る ／ 低-5 はチェックリスト §10 が明示的に軽微として名指ししている範囲）。

**★本節はレビュー完了後に記入した。** 製造 CLI（`implement_plan_full`）の工程順は完了報告を Phase B より前に置くため、**ここへ先に「0 件」と書くとレビュー結果を実施前に断定する形になる**（`M23-04` 教訓 3 / 同サブ横断課題 6 で実際に起きた）。**★ただしチェックリスト §9 は「§7.5 の 6 件のいずれかが完了報告に無い」を重大としており、教訓 3 と正面から衝突する。** 本サブでは「意図と再開条件を書いたプレースホルダを置く」形で両立させたが、**恒久の解は指示書テンプレート側にある**（§11 の申し送りへ回した）。

---

## 7. 変更しなかったものの機械的確認（§2.2）

**★「触っていない」を主張ではなく diff で示す。**

```
$ git diff HEAD~1 --numstat -- internal/repository/combo/repository.go \
      internal/repository/setup/repository.go internal/service/validation/combo.go
119     0       internal/repository/combo/repository.go
116     0       internal/repository/setup/repository.go
                internal/service/validation/combo.go   ← diff が空（1 行も変えていない）
```

- **`internal/service/validation/combo.go`（`VAL-C02` の実装本体）は diff が空である。**
- **リポジトリ 2 ファイルは削除行 0 の純粋な追加である**（`-N,0 +M,K` のハンクしか無い）。**⇒ `FindActiveByDuplicateKey` と `FindDuplicateInCombo` はバイト単位で同一。**
- **スキーマ・マイグレーション**: 1 本も消費していない。`docs/process/parallel-board.md` §2.2 の連番は動かない。
- **`400 validation_failed` ＋ `details.validations` の形**: 不変。
- **`PUT` / `PATCH` / materialize の挙動と応答形**: 不変。
- **復元の副作用**: 検証を 1 件足しただけ（`deleted_at = NULL` ／ `updated_at` ／ `recipe_cache` 再計算 ／ `version` に触れない）。
- **`M23-04` の `warnings` の器**: 再利用。作り直していない。DTO は 1 行も足していない。
- **設計書本体**（`DES-006` / `DES-002` / `DES-005`）: 編集していない。**反映は設計卓が `CHANGE-125` で行う。**

---

## 8. 成果物一覧

### 8.1 バックエンド

| ファイル | 変更 |
|---|---|
| `internal/repository/combo/repository.go` | **追加のみ。** `FindDeletedByDuplicateKey` / `FindActiveByDuplicateKeyExcludingTx` ＋ 新規専用の私有ヘルパ `duplicateKeyPredicates` / `queryCombosByDuplicateKey` / `duplicateKeySelectSQL` |
| `internal/repository/setup/repository.go` | **追加のみ。** `FindDeletedDuplicateRefsInCombo` / `FindLiveDuplicateRefsInComboTx` ＋ 私有ヘルパ `duplicateRefsInCombo` |
| `internal/service/validation/duplicate.go` | **新規。** `CodeC14DuplicateInTrash` / `CodeR03DuplicateAliveCombo` ／ `ValidateC14DuplicateInTrash` / `ValidateR03DuplicateAliveCombo` ／ `DuplicateComboRef` ／ `MaxDuplicateRefsInDetails` ／ `SetupRefDetails` |
| `internal/service/setup/validate.go` | `CodeS07DuplicateInTrash` / `CodeR04DuplicateAliveSetup` ／ `ValidateS07DuplicateInTrash` / `ValidateR04DuplicateAliveSetup` を追加 |
| `internal/service/combo/service.go` | `CheckTrashDuplicate`（新設・POST 専用）／ `validateR03` ／ `withRecipeHashes(Tx)` ／ `duplicateKeyOf` ／ `validateRestoredCombo` へ `VAL-R03` を 1 行追加 |
| `internal/service/setup/restore.go` | `CheckTrashDuplicateSetup`（新設・POST 専用）／ `validateR04` ／ `validateRestoredSetup` へ `VAL-R04` を 1 行追加 |
| `internal/service/setup/service.go` | Service インタフェースへ `CheckTrashDuplicateSetup` を追加 |
| `internal/api/combo/handler.go` | `Create` の末尾で `CheckTrashDuplicate` を呼び `resp.Warnings` へ（0 件ならキーごと出さない） |
| `internal/api/setup/handler.go` | `CreateSetup` で同型 |

### 8.2 フロントエンド

| ファイル | 変更 |
|---|---|
| `web/src/features/trash/saveWarnings.ts` | **新規。** 登録側（`VAL-C14` / `VAL-S07`）の文面。**★復元側と分けてある**（§4.6） |
| `web/src/features/trash/warningDetails.ts` | **新規。** `totalCount` を優先して件数を読むヘルパ |
| `web/src/features/trash/restoreWarnings.ts` | `VAL-R03` / `VAL-R04` の分岐を追加。既存 2 件も `warningRefCount` 経由へ（挙動は不変） |
| `web/src/features/combo/types.ts` | `WarningDetails`（`RestoreWarningDetails` は別名として保持）に `totalCount` ／ `CreateComboResponse` を新設 |
| `web/src/features/setup/types.ts` | `CreateSetupResponse` を新設 |
| `web/src/features/combo/api.ts` ／ `web/src/features/setup/api/setupApi.ts` ／ `hooks/useCreateSetup.ts` | 登録の戻り型を `warnings` 付きへ拡張 |
| `web/src/features/combo/components/ComboEditor.tsx` ／ `web/src/pages/SetupEditorPage.tsx` | 登録成功時に警告トースト（**モーダルにしない**） |
| `web/src/locales/ja.json` ／ `en.json` | `trash.warning.*` へ 5 キー |

### 8.3 テスト

| 層 | ファイル | 本数 |
|---|---|---|
| サービス（コンボ） | `internal/service/combo/trash_duplicate_test.go`（新規） | **12** |
| サービス（セットプレイ） | `internal/service/setup/trash_duplicate_test.go`（新規） | **6** |
| ハンドラ（コンボ） | `internal/api/combo/m23_05_trash_duplicate_handler_test.go`（新規） | **3** |
| ハンドラ（セットプレイ） | `internal/api/setup/m23_05_trash_duplicate_handler_test.go`（新規・**レビュー中-2 の取り込みで追加**） | **2** |
| フロント | `web/src/features/trash/saveWarnings.unit.test.ts`（新規） | **10** |
| E2E | `web/e2e/m23-05-duplicate-collision.spec.ts`（新規） | **2** |

**★指示書 §5.1 の 12 件はすべて対応がある**（`-4` は `PUT` のキー変更あり／なしの 2 本、`-11` は各 VAL の発火テストへ内包）。**★誤検知を防ぐ側（`-2` / `-3` / `-4` / `-5` / `-7` / `-9`）はいずれも独立したテストとして在る。**

---

## 9. 自己テスト結果（§7.2・**件数付き**）

| 検査 | 結果 |
|---|---|
| `go test ./... -count=1` | **53 パッケージ ok / FAIL 0**（テスト関数 **1269** 本 PASS。`M23-04` 時点は 1246 本＝**+23**） |
| `cd web && pnpm test` | **Test Files 174 passed (174) / Tests 1707 passed (1707)** — 取り込み前の基準は 173 files / 1697 tests（**+1 file・+10 件**） |
| `make e2e` | **165 passed / flaky 0**（取り込み前の基準は 163 passed。**+2 ＝ 本サブの新規 spec 2 本**） |
| `gofmt -l internal/ cmd/` | **0 件** |
| `go vet ./...` | **違反なし** |
| `cd web && pnpm run lint`（＝`tsc --noEmit`） | **エラーなし** |
| `bash scripts/check-artifact-integrity.sh` | **違反なし**（検査 11 件の自己検査 ＋ 生成物 4 件） |
| `bash scripts/check-enum-sync.sh` | **ベースラインどおり（増加なし）** |
| `bash scripts/check-browser-storage-keys.sh` | **違反なし**（台帳 9 件 / 本番コード 8 件。**★本サブはブラウザストレージを使っていない**） |
| `bash scripts/check-md-emphasis.sh` | **ベースラインどおり**（436 行 / ベースライン 436 行） |
| `bash scripts/check-doc-refs.sh` | **dead reference なし** |

**★上表はレビュー取り込み前（コミット `9b2abe5` / `7c35cb3` 時点）の値である。** 取り込み後（`31eb72e` 以降）の再測は次のとおり。

| 検査 | 取り込み後 |
|---|---|
| `go test ./... -count=1` | **53 パッケージ ok / FAIL 0**（テスト関数 **1271** 本 PASS＝**+2**。セットプレイ側ハンドラテスト 2 本の追加分） |
| `cd web && pnpm test` | **174 files / 1707 tests**（同数。フロントの修正は import 順・別名削除・コメントのみ） |
| `make e2e` | **165 件中 163 passed / flaky 2**（下記） |
| `gofmt` / `go vet` / `pnpm run lint` / 各 `check-*.sh` | いずれもクリーン・ベースラインどおり |

**★取り込み後の `make e2e` に flaky が 2 件出たが、本サブによる回帰ではない。** `m20-04-preset-management` と `m20-05-recipe-cache-wiring` であり、**「フレークだった」で済ませずに根本原因まで切り分けた**——`--workers=1` で直列実行すると **22 passed（1 件も落ちない）**、既定の並列だと **3 failed** で再現する。`playwright.config.ts` は `workers` を設定しておらず、`fullyParallel: false` はファイル内の直列化しか保証しないため、**既定プリセット（`config` のグローバル状態）を書き換える 2 つの spec が別ワーカーで同時に走る。** 落ちた 3 件はすべて `D-313`（既定プリセット切替）系である。**本サブの差分はプリセット・`notation`・`config` のいずれにも触れていない**（`git diff 9b2abe5~1..HEAD --name-only | grep -iE "preset|notation|config"` → **0 件**）。**恒久対応は M20 系 spec の担当範囲であり本サブの射程外。** 手順と出力は `m23-05-review.md` の取り込み結果節に残した。

**★E2E の新規 2 本は本登録（`isDraft: false`）でコンボを作る。** `m23-04` spec の fixture は仮登録（`isDraft: true`）であり、**そのまま流用すると `VAL-C14` / `VAL-R03` が 1 度も走らないまま緑になる**（仮登録は重複判定の対象外＝§4.3）。**同じ形は後続サブでも起こりうる。**


---

## 10. 開発者の実機確認で判明した文言の誤り（2026-08-22・レビュー後）

**★レビュー完了後、開発者が実機で確認して見つけた。自動テストでは検出できない種類の欠陥である。**

### 何が間違っていたか

登録側の文面は当初こうだった。

> 同じレシピのセットプレイ 1 件がこのコンボのゴミ箱にあります。**作り直す代わりに復元できます**

**これは実装がしないことを約束している。** 警告が出る時点で**登録は既に完了しており、画面は詳細へ遷移する**。利用者が「作り直すか復元するか」を選べる瞬間はどこにも無い。復元したければ、**いま作ったものを自分で消してゴミ箱から戻す手作業**が要る。

開発者の逐語＝**「作り直すか復元するか選べるのような印象を受けますが、実際は新しいセットプレイが作成され詳細画面に遷移します」**。

### なぜ起きたか（★原因は文言選びではない）

**指示書 §1.3 が掲げた目的と、§2.1 / §4.6 が指定した手段が食い違っている。**

> §1.3: **登録側の警告は「作り直す前に、ゴミ箱に同じものがある」を告げる。⇒ 重複そのものが減る。**

しかし §2.1 / §4.6 が指定したのは**保存成功後の応答に載せるトースト**である。**保存後に告げるものは、定義上「作り直す前」に告げられない。⇒ 重複は減らない。**

**★製造は文面を「実装がしていること」ではなく「§1.3 が掲げた目的」のほうから書いてしまった。** 目的が手段で達成できていないことに気づく機会がここにあったが、逃した。

### どう直したか（**文面のみ。実装は変えていない**）

| | 変更前 | 変更後 |
|---|---|---|
| `duplicateInTrash` | 同じ内容のコンボ {{count}} 件がゴミ箱にあります。**作り直す代わりに復元できます** | 同じ内容のコンボ {{count}} 件がゴミ箱に**も**あります。**重複していないか確認してください** |
| `duplicateSetupInTrash` | 同じレシピのセットプレイ {{count}} 件がこのコンボのゴミ箱にあります。**作り直す代わりに復元できます** | 同じレシピのセットプレイ {{count}} 件がこのコンボのゴミ箱に**も**あります。**重複していないか確認してください** |

- **「に*も*」** で「いま作ったものに加えて」を表し、**保存済みであることと両立させた。**
- **サーバ側の診断文（Go）も同時に直した**——`internal/service/validation/duplicate.go` ／ `internal/service/setup/validate.go`。画面は表示しないが、**API を単体で叩いたときに読まれる**（`M23-04` §4.1-1 の設計）。**直さないと「失効した記述」がそのまま残る**（レビュー高-1 と同じ型）。あわせて `(登録は成功しています)` を足し、プロトコル面でも取り違えを防いだ。
- **復元側（`VAL-R03` / `VAL-R04`）は変えていない。** 「復元したので重複して並んでいます」は状態を正しく述べている。
- **★回帰ガードを新設した**——`saveWarnings.unit.test.ts` に「登録側の文面が、実装がしないことを約束していないこと」を `VAL-C14` / `VAL-S07` の 2 件で主張するテストを追加（`復元できます` / `代わりに` を含まないこと）。

### ★実装を変えなかった理由（スコープ）

**開発者の提案は「保存前にダイアログを出し、入力内容を入れる／ゴミ箱から復元する／両方入れる を選ばせる」である。これは正しい方向だが、本サブでは作れない。**

| 根拠 | 逐語 |
|---|---|
| 指示書 §1.4-2 | **重複を解消する導線**（どちらかを消す・統合する）→ **`M23-06` / `M23-07`** |
| 指示書 §4.6 | **★モーダルにしない。** 本サブの警告はどれも ERROR ではない |
| チェックリスト §9 | **スコープ外 7 件（§1.4）のいずれかへ踏み込んでいる** ＝ **重大** |
| チェックリスト §0.3 N-9 | **重複を解消する導線が無い**のは**仕様である**（誤判定しないこと） |

**⇒ 設計卓へ返した。** 詳細と設計判断が要る点は §11 の申し送りを参照。

---

## 11. 次サブへの申し送り

- **`M23-06` / `M23-07`（ゴミ箱の作り込み・未達の導線）へ**——**`details` の材料は 4 件とも揃っている。** `combos` は `{id, memo}`、`setups` は `{id, name}`、加えて `totalCount`。**「重複している既存コンボへのリンク」の UI（`DES-006` §11.2）は本サブでは作っていない**（§1.4-3）。
- **★設計卓へ（`CHANGE-125` の反映時）**——**`DES-002` §4.2 / §4.3 に「登録 2 経路の `warnings`」の記述が要る。** 現行は復元 2 経路しか書かれておらず、`details` の規則 3（新しい経路で `details` を設定するときは応答形が本書に在ることを先に確かめる）を満たすには追記が必要である。
- **★設計卓へ（2）**——**`POST /api/setups` は存在しない**（§1-9-1）。指示書・overview の表記を実ルート名へ揃えるかは設計卓の判断。
- **★設計卓へ（3）＝`CHANGE-125` の必須注記**——**登録応答では `validations` と `warnings` の両方に警告が載りうる。** `POST /api/combos` は `VAL-C03` / `VAL-C08` / `VAL-C10` / `VAL-C11`（いずれも `severity=warning`）を従来どおり `validations` に載せたまま、`VAL-C14` を `warnings` に載せる。**⇒ 同じ severity の警告が 2 経路に分かれた状態が新しく生まれている。** 実害は無い（画面はそれぞれ別の表示経路を持つ）が、**`DES-002` §4.2 / §4.3 へ登録経路を書き足すときに明記しないと、後任が「登録応答の警告はどちらを見ればよいか」で迷う。** 現行の `DES-002` は「復元応答に `validations` は載らない」としか書いていない。
- **★`CalcRecipeHash` の 3 実装の統合**——本サブの射程外として送る（§2 の否定形確認 3）。**共有コードが 1 行も無く、片方だけ変更してもコンパイルが通る**状態が続いている。
- **★★`M23-06` / `M23-07` へ（0）＝最優先。保存前に選ばせる導線が要る（開発者の提案・2026-08-22）。** 登録側の警告は**保存後**に出るため、§1.3 が掲げた「作り直す前に告げる ⇒ 重複そのものが減る」を**構造上達成できない**（§10）。開発者の提案は「**登録時に同一レシピなら、いったんダイアログを出して〔入力内容を入れる／ゴミ箱から復元する／両方入れる〕を選ばせる**」。**★設計判断が要る点が 3 つある**——(a) **「両方入れる」はセットプレイでは矛盾する**。同一親・同一レシピの生きたセットプレイ 2 件は `VAL-S04` が **ERROR（`409 duplicate_setup`）で拒否している状態**であり、許すと**通常の登録では作れない状態をこの導線からだけ作れる**ことになる。コンボ側も `VAL-C02` と同じ関係。(b) 保存前チェックの土台は既にある（`POST /api/combos/check-duplicate` ＋ `DuplicateRealtimeWarning`）が、**現状は生きた行しか見ない**——削除済みを見る口が要る。**セットプレイ側には同等の事前チェック API が無い。** (c) **`DES-006` §11.2 は「ERROR はモーダル」としており、WARNING でモーダルを出すのは §11.1 からの逸脱**になる。**⇒ 本サブでは文面のみ是正した（§10）。**
- **★`M23-06` / `M23-07` へ（2）＝作り方によって警告の有無が変わる。** **コンボ同時登録（`POST /api/combos` の `setups` 配列）で作られるセットプレイには `VAL-S07` が出ない。** `CreateSetupInTx` 経由であり指示書 §4.5 の経路指定どおりの仕様だが、**利用者から見ると「同じセットプレイでも作り方によって警告の有無が変わる」。** 導線を作るときの入力として記録する。
- **★セットプレイ側の実データ件数は未計測のままである**（§1-7）。dev DB を持つ環境で `setups` / `combo_setups` に対する `VAL-S07` / `VAL-R04` 相当の組を数えると、優先度の判断材料になる（**作るかどうかは既に決まっており、影響しない**）。

---

*以上、M23-05 完了報告。*
