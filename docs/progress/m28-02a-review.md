# M28-02a レビュー報告書

| 項目 | 内容 |
|------|------|
| 対象 | `docs/instructions/M28-02a-game-update-schema-and-backend.md` **v1.5.0** |
| チェックリスト | `docs/instructions/reviews/M28-02a-review-checklist.md` **v1.0.0** |
| 完了報告 | `docs/progress/M28-02a-completion-report.md` |
| 対象コミット | `426c97f` / `d70be13` / `a0b5580` / `4bbc52d`（＋報告 `68c368e`）。着手基点 `56b06cb` |
| 実施日 | 2026-09-06 |
| レビュー時の実測 | `go test ./...` 緑 ／ `cd web && pnpm test` 緑（212 ファイル・2440 件）／ `check-artifact-integrity.sh` 違反なし ／ **`check-progress-log-index.sh` 違反 1 件**（後述・高 4） |

---

## 総評

指示書の確定事項 9 件と「やらないこと」12 項は、いずれも守られている。**本サブの中心である「バージョン文字列の順序」と「`seedgen` の出力」は、どちらも実装として着地しており、破壊確認でも赤が出ることを確認した**（CHECK 制約を外すと 10 種の崩れた値が全部通り、テストがそれを名指しで検出する）。判定は導出であり中間表は無い。NULL の向きは安全側であり、2 種類の NULL（基準＝不明／マーカー＝既知の未変更）が意図的に区別されている。既存 `position` は 1 行も書き換わっておらず、`DuplicateKey` も不変である。**重大は 0 件**。

一方で、**「機能を実際に使った瞬間」の着地が 1 つ欠けている**。`character_data/*.csv` のマーカー列に値を 1 つ入れると、golden テストが `000026_seed_moves_first_wave.up.sql` 不一致で落ちる（実測）。報告 §9.1 は「値が無い間は byte-identical」までしか書いておらず、**配信者がマーカーを立てる手順が成立しない**。あわせて、一覧の絞り込み `affected_by_game_update` の SQL は 1 度も実行されておらず、`normalizePositionAndMass` の godoc が存在しない「API 層の検証」を根拠にしている。

---

## 設計準拠性レビュー結果

### 束 A — `FR702` のスキーマと判定 … **○**（1 点で △）

| # | 観点 | 評価 | 所見 |
|---|---|---|---|
| A-1 | `moves` のマーカー列が 1 本か | ◎ | `moves.last_changed_game_version` の 1 本のみ（`migrations/000104_add_game_update_tracking.up.sql:42`）。増えていない |
| A-2 | `combos` の基準列 1 本・登録時に最新が入るか | ◎ | `combos.baseline_version`。**書くのは INSERT の `COALESCE(?, (SELECT current_data_version …))`**（`internal/repository/combo/repository.go:485`）であり、呼び出し側が忘れうる形になっていない。先例 `materialize-bypasses-required-fields` への正しい応答 |
| A-3 | 形式の検証をどこまで塞いだか | ◎ | 4 入口すべて。DB 側 `CHECK`（3 列）／`internal/gameversion.Valid`／`seedgen` の `validate()`（`internal/seedgen/generate.go:125`）／マイグレの直書き値。報告 §2.2 に一覧がある |
| A-4 | `2026.8.3.1` を弾くテストが在るか | ◎ | `internal/infra/migration/migrate_m2802a_test.go:121` に崩れた値 10 種 × 3 列。正しい 4 種が通ることも見ている（過剰に厳しくない） |
| A-5 | 「現在のデータバージョン」の持ち場 | ◎ | `games.current_data_version`（NOT NULL・DEFAULT `2026.08.03.01`）。**`MAX(moves…)` での代用は無い**（`grep` で `MAX(` の該当なし）。`internal/repository/game/` を新設して読み出している |
| A-6 | マーカーが `seedgen` の SQL 出力に入っているか | **△** | 入ってはいる（`writeGameVersionUpdate`）。実測でも `UPDATE moves SET last_changed_game_version = '2026.09.01.00' …` が出た。**ただし値を入れた瞬間に golden が落ちる**（高 1） |
| A-7 | 判定が導出か／保存表が無いか | ◎ | `affectedByGameUpdateCondSQL` の相関 `EXISTS` のみ。中間表なし |
| A-8 | `combo_steps` 経由・`move_id` NULL が入らないか | ◎ | `JOIN moves m ON m.id = cs.move_id` で構造的に落ちる。`TestAffectedByGameUpdate_IgnoresNonMoveSteps` がステップ内訳まで実測して固定 |
| A-9 | NULL の向きが安全側か | ◎ | 基準 NULL ⇒ 影響可能性あり／マーカー NULL ⇒ 影響なし。**破壊確認で `baseline_version IS NULL` を外したら `TestAffectedByGameUpdate_Matrix` が赤くなった**（出し漏らす側へ倒れたことを検出） |
| A-10 | `materialize` に基準が入るか | ◎ | `gen.BaselineVersion = nil` を明示（`service.go:1584` 付近）し、`TestBaselineWrittenOnEveryCreationPath` が **基底を意図的に古くしてから** 生成物の基準を見ている。良い作り |

### 束 B — 始動位置と運び量 … **◎**

| # | 観点 | 評価 | 所見 |
|---|---|---|---|
| B-1 | 区分 7 つ・境界が確定値どおりか | ◎ | `0〜25 / 26〜47 / 48〜69 / 70〜90 / 91〜112 / 113〜134 / 135〜160`。**失効値 `91〜111` / `112〜134` は入っていない**。`internal/model/position_test.go` と `web/src/constants/position.test.ts` の両方が名指しで固定 |
| B-2 | 代表値が定数表で直書きか | ◎ | `12 / 36 / 58 / 80 / 102 / 124 / 148` を直書き。丸め規則の実装は無い。左右対称 `mirror(x)=160-x` をテストが固定しており、**代表値を 13 に変えると 3 本が赤くなる**（破壊確認 §8-4 実施） |
| B-3 | 保存の正本がマス数 1 本か | ◎ | `combos.start_position_mass`（INTEGER・CHECK 0〜160）。パーセントは保存していない（`massToPercent` / `percentToMass` は FE の純関数のみ） |
| B-4 | 3 方式の連動・往復不変 | ◎ | 往復テストが 2 本（端数を保てば不変／整数 % へ丸めると壊れる＝陽性対照）。★UI は作っていない（正しい） |
| B-5 | 既定が従来型か | ◎ | 区分だけ送れば代表値が入る（`normalizePositionAndMass`）。既存エディタが無改修で動く |
| B-6 | 始動位置と運び量が別の列か | ◎ | `start_position_mass` / `carry_distance_mass` の 2 本。共有していない |
| B-7 | 運び量を区分へ丸めていないか | ◎ | 丸めなし。マイグレも運び量を backfill していない（逆算しない） |
| B-8 | 新区分のラベルと code | ◎ | `mid_self`「自分中央寄り」/ `mid_opponent`「相手中央寄り」。code は `internal/model/combo.go` の const、語は `ja.json` が源泉 |
| B-9 | 並び順 | ◎ | `不問 / 自分画面端 / 自分画面端寄り / 自分中央寄り / 画面中央 / 相手中央寄り / 相手画面端寄り / 相手画面端`。**末尾 2 値の順序反転にも気づいて報告 §7.2 に明記している**（設計卓が「間に 2 つ挿入するだけ」と書いた箇所の是正） |

### 束 C — 既存データとスキーマの安全性 … **◎**

| # | 観点 | 評価 | 所見 |
|---|---|---|---|
| C-1 / C-7 | 既存 `position` の値が書き換わっていないか | ◎ | `000105` は `start_position_mass` を UPDATE するだけ。`TestRun_M2802a_PositionMassSchema` が移行前後の分布（8 種）を突合 |
| C-2 | 「画面中央」が狭くなることの受容 | ◎ | 報告 §7.4 とマイグレのコメント（`000105 up:54`）の両方に明記 |
| C-3 | `DuplicateKey` が区分を使い続けているか | ◎ | `duplicateKeyPredicates` は不変。マス数は重複キーに入っていない |
| C-4 | 既存の重複判定が変わっていないことを確かめたか | ○ | 「`position` が 1 行も動いていない」ことを分布突合で実測 ⇒ 判定結果は変わりえない、という筋の通し方。**ただし重複判定そのものを移行前後で実行した比較ではない**（論理的には十分。指摘としては上げない） |
| C-5 | 既存コンボのマス数初期値 | ◎ | 区分の代表値／`position IS NULL` は NULL のまま（「不問」を勝手にどこかへ置かない）。報告 §1.3 |
| C-6 | down マイグレと失われるもの | ◎ | 2 本とも down 在り。**失われるものが「復元できる／できない」まで分けて書かれている**（基準＝部分消化の履歴は再生成できない、運び量は完全消失）。`DROP COLUMN` が CHECK 付き列で通ることを実測した記録も良い |

### 束 D — ラベルと並び順 … **◎**

| # | 観点 | 評価 | 所見 |
|---|---|---|---|
| D-1 | 詳細・エディタの語 | ◎ | `ja.json` / `en.json` の `comboDetail.situation.position` と `comboList.filter.position`、`ComboEditorBasicFields.tsx` の `label` / `ariaLabel`、`ComboEditor.tsx` の `FIELD_LABELS`、重複警告文面まで一括。比較面は「直すべき『ポジション』という文字列が存在しない」ことを実査して報告している（§8）—— 正しい確認の仕方 |
| D-2 | 一覧をやり直していないか | ◎ | 一覧の列は 1 行も触っていない。フィルタの**ラベル 1 語**だけを揃えた（開発者確認済みと報告 §14-4 にある） |
| D-3 | 直したのが定数だけか | ◎ | 画面の作りは不変。`web/src/constants/position.ts` は定数と純関数のみ |
| D-4 | 3 入力方式を作っていないか | ◎ | 作っていない |
| D-5 | i18n の ja/en 揃い・旧キーの残骸 | ◎ | 両言語に 7 値。**`POSITION_LABEL_JA` が `ja.json` 由来でない唯一の直書きだった穴を `label-keys.test.ts` の網へ入れた**のは良い（§8.1） |

### 束 E — CSV / エクスポートと API … **○**

| # | 観点 | 評価 | 所見 |
|---|---|---|---|
| E-1 | CSV 列契約の判断と理由 | ◎ | 基準は出さない（DB 管理列・先例 `materialized_from_combo_id`）／マス数と運び量は出す（出さないと往復で消える）。理由が報告 §5 と `contract.go` の両方に在る |
| E-2 | import の後方互換 | ◎ | 旧 CSV → 現行版は `optionalImportColumns` で通る。**必須列 22 が動いていないことを凍結テストで観測**している |
| E-3 | `DES-002` §4.2 の経路表に沿うか | ◎ | `POST /combos/:id/acknowledge-version` は `restore` / `materialize` と同じ形。新しい流儀は無い |
| E-4 | `M27-03` の面と衝突していないか | ◎ | `affected_by_game_update` は独立した分岐。`starter_move_id` 等の既存絞り込みに手が入っていない |
| E-5 | JSON が camelCase か | ◎ | `baselineVersion` / `affectedByGameUpdate` / `startPositionMass` / `carryDistanceMass`。`affectedByGameUpdate` に `omitempty` を付けない判断と理由も良い |
| E-6 | 絞り込みの実装 | **△** | **`filter.AffectedByGameUpdate` を立てた `List` が 1 度も DB に対して実行されていない**（高 3） |

### §6 テストの妥当性 … **○**

- **§6-1 網羅**: ◎。マーカー 新しい／古い／同じ／NULL × 基準 あり／NULL、`09→10` の繰り上がり、アプリ版だけの差、逆順まで。`move_id` NULL のステップも別テストで内訳を実測。
- **§6-2 マイグレ版数の直書き**: ◎。`m2802aBefore` / `m2802aFR702` / `m2802aMass` の名前付き定数に閉じてある（`followup` `migration-version-literals-in-tests` の流儀どおり）。
- **§6-3 golden の動き**: **△**。「今は緑」までしか書かれていない（高 1）。
- **§6-4 通っていない入口**: **△**。テスト量は多いが、**一覧の絞り込み SQL だけが 1 度も通っていない**（高 3）。API 層のテストは `mockService` であり `ListFilter` に値が入ることしか見ていない。

### §7 コミットの割り方 … **◎**

`426c97f`（マーカー・基準列＋000104）／`d70be13`（判定の導出＋API）／`a0b5580`（運び量の列＋000105）／`4bbc52d`（区分 7 値・CSV 契約・表示語）の 4 段。**`FR702` 側（1・2）と運び量側（3・4）は混じっていない**。1 本目に共有 SELECT 句の整理が入っているのは §10-1 の「細部の違い」の範囲であり、報告 §14-7 に理由がある。

### E-225（新規ファイルの deletions）… **問題なし**

`git diff --numstat 56b06cb HEAD` を実査。新規 15 ファイル（`gameversion.go` / `position.go` / `repository/game/repository.go` / `000104`・`000105` の 4 本 / 新規テスト 6 本 / `web/src/constants/position.ts`）は**すべて deletions 0**。`character_data/*.csv` の 2774/2774 は 24 列目追加による意図された変更（`csv` パーサで実測：2743 行すべて 24 列・マーカー列は全セル空）。

---

## 設計準拠性以外の指摘事項

1. **`internal/service/combo/service.go` の `normalizePositionAndMass` godoc が、存在しない検証を根拠にしている**
   「★値域外のマス数はここでは弾かない。DB の CHECK と **API 層の検証**が受け持つ」とあるが、`internal/service/validation/` にも `internal/api/combo/` にもマス数の値域検証は無い（`grep` で `StartPositionMass` / `Mass` の該当なし）。値域検証が在るのは **CSV 層（`PositionMassRange`）と DB の CHECK だけ**である。⇒ 高 2。
2. **`internal/api/combo/handler_test.go` のコメントが実在しないファイルを指す**
   「経路の検証は `handler_m2802a_test.go` と service 層のテストが持つ」とあるが、実ファイルは `internal/api/combo/m28_02a_handler_test.go`。dead file reference。
3. **`insertComboSQL` に `'sf6'` がリテラルで直書きされている**（`repository.go:485`）
   同じ値が `internal/repository/game/repository.go` の `CodeSF6` にも在る。`NFR407`（他ゲーム対応の余地）を持ち出して `games` を選んだ以上、SQL 側に固定文字列で焼くのは筋が通らない。現状 1 行しか無いので実害は無い。
4. **`AcknowledgeGameVersion` が同じコンボを 2 回読んでいる**
   サービスが `FindByID` で読み直し（「進めた結果が false になったことを応答で返せるようにする」というコメント付き）、ハンドラはその戻り値を `_` で捨てて `h.service.Get` を呼び直している。**コメントが述べた理由は API では実現していない**（サービス層テストのためだけの読み直しになっている）。
5. **バージョン文字列の日付は暦の妥当性を見ない**（`2026.02.31` が通る）
   `gameversion.Pattern` と DB の CHECK がともに日 1〜31。**意図であることはコメントに明記されている**ので欠陥ではないが、`NN` の存在意義（入力ミスの訂正）を考えると、日付の取り違えは実際に起きうる。
6. **`down` マイグレは `seedgen` が出す `UPDATE`（マーカー）を戻さない**
   `buildCharDown` は INSERT した行を消すだけであり、既存行に立てたマーカーは down で残る。実害はほぼ無いが、`000104` down が列ごと消すため状況としては閉じている。
7. **`AdvanceBaselineVersion` が `updated_at` を進める**
   `version`（楽観的排他）は上げない判断とその理由はコメントに在るが、**「確認した」を押すと更新日時順の一覧で並び順が動く**ことは報告に無い。画面が付く `M28-02b` で挙動として見えるので、いま決着を書いておくのが安い。
8. **FE の区分表と BE の区分表が独立した直書きである**
   `internal/model/position.go` の `PositionBands` と `web/src/constants/position.ts` の `POSITION_BANDS` は同じ 7 行を別々に持つ。両側にテストが在るため片側だけの改変は検出されるが、**両側を同じ誤り方で直すと誰も気づかない**。`check-enum-sync.sh` は値の集合しか見ず、境界と代表値は見ていない。

---

## 推奨修正（優先度別）

### 重大（完了承認を妨げる）

**0 件。** チェックリスト §9 の 9 項目に該当するものは無い（形式の検証は 4 入口／`seedgen` に入っている／`MAX` 代用なし／導出である／NULL は安全側／`position` 不変・重複判定不変／代表値は直書き／版数リテラルなし／down 在り）。

### 高（M28 完了前に修正必須）

**高 1. マーカーを実際に立てると golden テストが落ちる。運用の着地が無い**
根拠: `internal/seedgen/generate.go:247`（`writeGameVersionUpdate`）／`internal/seedgen/generate_m1702_test.go:120`（`assertGolden`）／報告 §3.1・§9.1。
**実測（本レビューの破壊確認 §8-2）**: `character_data/terry.csv` の 1 行の 24 列目へ `2026.09.01.00` を入れて `go test ./internal/seedgen/...` を回すと

```
--- FAIL: TestGolden_CommittedMigrationMatchesRegeneration
    000026_seed_moves_first_wave.up.sql がコミット済みと不一致。
    ★適用済みマイグレであり上書き再生成してはならない。
```

が出る。**golden は「現在の CSV から再生成した SQL」と「適用済みマイグレ」を byte 比較しており、マーカー列は生成物に出る列だからである。** つまり **配信者がマーカーを立てた瞬間に赤くなり、しかも失敗メッセージは「再生成してはならない」と言う** —— 直し方の無い赤である。同じ手番で `TestCSVAndDBAgreeOnFrameCostColumns` も落ちるが、こちらは「DML マイグレを書け」という正しい要求であり設計どおり。

★これは机上の懸念ではない。同じ壁に本プロジェクトは既に一度当たっており、`csv_db_sync_test.go` の冒頭に「zangief の連打版 3 行と dhalsim の連打版 1 行は **CSV に足すと生成物が変わって golden が壊れる**ので CSV に載せない」と書かれている（`D-94` / `D-99`）。**「CSV をマーカーの正本にする」は、その先例と正面から衝突する。**

要求: **(a) マーカーを立てる運用手順**（どの順で何を書けば全検査が緑になるか）を報告へ書くこと、または **(b) golden がマーカーを見ないようにすること**（例＝golden テストが呼ぶ生成に「マーカーの `UPDATE` を出さない」オプションを渡す／マーカーの `UPDATE` を `-mode` の別モードへ出し、`moves` の生成物には混ぜない）。**どちらを採るにせよ、`character_data/*.csv` に 1 つ値を入れた状態で `go test ./...` が緑になることを実測して報告すること。** 現状の報告 §9.1「golden 17 本は緑のまま」は、**値が 1 つも無い状態でしか成り立たない**。

**高 2. `normalizePositionAndMass` の godoc が存在しない「API 層の検証」を根拠にしている（＋値域外が 400 でなく 500 になる）**
根拠: `internal/service/combo/service.go`（`normalizePositionAndMass` の godoc「DB の CHECK と API 層の検証が受け持つ」）。
実装は `internal/api/combo/dto.go` → `combosvc.CreateInput` へ素通しで、値域を見る箇所が無い。`POST /api/combos` に `startPositionMass: 500` を送ると `INSERT` が CHECK 違反になり、ハンドラの既定分岐で **500 `internal_error`** になる（400 + `validations` ではない）。FE の `schema.ts` は `min(0).max(160)` を持つが、それは画面側の第一防衛線であって API の契約ではない。
**優先度の理由**: 「撤回済み・失効した記述がコード上に残っている」型である。動作は（画面経由なら）正しいままなので、テストも lint も型検査も緑になる。後任はこの godoc を読んで「API 層で弾かれている」と信じる。
要求: godoc を実態に合わせる（「値域は DB の CHECK と CSV 層だけが見る。API 経由の値域外は 500 になる」と書く）か、`validation` へ値域検証を足して 400 にすること。**どちらでもよいが、記述と実装を一致させること。**

**高 3. 一覧の絞り込み `affected_by_game_update` の SQL が 1 度も実行されていない**
根拠: `internal/repository/combo/repository.go:903`（`List` の `whereParts` へ `NOT (…)` を組む分岐）／`internal/api/combo/m28_02a_handler_test.go:18`（`mockService` で `filter` の中身を見るだけ）。
`AffectedByGameUpdate` を実 DB で通しているのは `FindByID`（`affectedOf` ヘルパ）だけであり、**`List` の `WHERE` 側は実行されたことがない**。チェックリスト §6-4 が名指ししている「テストが多いのに、判定の入口を 1 度も通っていない形」に当たる。判定式そのものは共有されているので値がずれる危険は小さいが、`true` / `false` の 2 分岐が期待どおりの集合を返すことは誰も見ていない。
要求: `internal/service/combo/m28_02a_game_update_test.go` に 2 行足すだけでよい（影響ありのコンボと無いコンボを作り、`comborepo.New(db).List(ctx, ListFilter{AffectedByGameUpdate: &t})` が前者だけを返すこと・`&f` が後者だけを返すこと）。

**高 4. 完了報告 §12-9「`progress-log.md` へ追記されている ✔」が事実と異なる**
根拠: `bash scripts/check-progress-log-index.sh` → `NG 作業 ID 'm28-02a' が docs/progress/progress-log.md に現れない`（違反 1 件）。`grep -n "M28-02a" docs/progress/progress-log.md` は 0 件。
`implement_plan_full` の Phase D は Phase C の後なので**まだ実施されていないこと自体は正しい**。問題は報告 §12 が完了条件 9 を **`✔`** と書き、§12-7 が「常設検査が緑」と書いていることである（`check-artifact-integrity.sh` は緑だが `check-progress-log-index.sh` は赤）。
要求: §12-9 を「Phase D で実施（未実施）」に直し、Phase D で実際に索引行を追記すること。

### 中（M29 着手と並行可）

**中 1. 運び量を後から編集する経路が無い ／ 基準の「更新時」の扱いが非対称**
`UpdateMetadataInput`（PATCH）に `StartPositionMass` / `CarryDistanceMass` が無い。運び量は重複判定キーではないため、エディタは非キー編集＝PATCH を選ぶ（`web/src/features/combo/components/ComboEditor.tsx` の `patchMut` / `putMut` 分岐）。⇒ **`M28-02b` が入力欄を作っても、運び量だけを直す保存は黙って捨てられる。**
あわせて、指示書 §2.2-2 の「登録・**更新**時に当時の最新を書く」は **PUT（キー変更＝新規 INSERT）でしか成立していない**。結果として「メモを直しても影響可能性は残る／区分を直すと黙って消える」という非対称になっている。`FR307`（自動断定しない）から見ると PATCH 側が正しく、PUT 側が自動断定に近い。**どちらが正しいかは開発者・設計卓の裁定事項**だが、報告に着地が無いのは埋めるべき。

**中 2. 重複の事前チェックがマス数を知らない**
`internal/service/comboio/import.go:327`（`checkDuplicate`）は `dto.Position` を**正規化前に**使う。`combosvc.CheckDuplicateInput` にもマス数の欄が無い（`POST /api/combos/check-duplicate` も同様）。手編集 CSV で `position` とマス数が食い違う行を入れると、**事前チェックが見る区分と保存後の区分が別になる**。`service.go` の godoc 自身が「正規化前に走ると送られてきた区分で重複を見てしまう」と警告している経路が、`comboio` 側に 1 本残っている。`M28-02b` が 3 方式入力を出すと、リアルタイム重複警告でも同じずれが起きる。

**中 3. 区分表が Go と TS に二重に直書きされ、突合する検査が無い**
`internal/model/position.go` の `PositionBands` と `web/src/constants/position.ts` の `POSITION_BANDS`。値の集合は `check-enum-sync.sh` / `TestDefaultPositionsMatchesModel` が見るが、**境界（`48〜69` 等）と代表値（`58` 等）は両側とも自前のテストで固定しているだけ**であり、片側の変更がもう片側へ波及しない。7 行しかないので実害は小さいが、`M28-02b` が FE 側で導出を使い始めると効いてくる。

### 低（将来対応）

- **低 1.** `internal/api/combo/handler_test.go` のコメントが `handler_m2802a_test.go` を指す（実ファイルは `m28_02a_handler_test.go`）。dead file reference。
- **低 2.** `AcknowledgeGameVersion` がコンボを 2 回読む（サービスの `FindByID` の戻り値をハンドラが捨てて `Get` を呼び直す）。サービス側 godoc の「応答で返せるようにする」は API では実現していない。
- **低 3.** `insertComboSQL` の `'sf6'` リテラル。`gamerepo.CodeSF6` と二重定義。
- **低 4.** `AdvanceBaselineVersion` が `updated_at` を進めるため、更新日時順の一覧で「確認した」を押すと並びが動く。意図なら報告へ 1 行。
- **低 5.** `gameversion.Pattern` と DB の CHECK が日 1〜31 まで（`2026.02.31` が通る）。意図はコメント済み。
- **低 6.** `seedgen` の `down` はマーカーの `UPDATE` を戻さない。

---

## 破壊確認の実施結果

**4 件実施した（チェックリスト §8 の 1・2 は必須、加えて 3・4 も実施）。★すべて元へ戻し、最後に `git status` が clean であること・`go test ./...` が緑であることを確認した。コミットはしていない。**

| # | 壊し方 | 結果 |
|---|---|---|
| **§8-1** | `migrations/000104_..up.sql` の `moves` 側 `CHECK` を外して `ALTER TABLE moves ADD COLUMN last_changed_game_version TEXT;` にした | **期待どおり赤**。`TestRun_M2802a_GameUpdateTrackingSchema` が `2026.8.3.1` を含む **10 種すべて**について「CHECK が効いていない」と名指しで落ちた。⇒ 形式の検証は「書いたつもり」ではなく実際に効いており、テストもそれを見ている。**復元後は同テストがキャッシュヒット（＝byte 単位で元に戻ったことの傍証）** |
| **§8-2** | `character_data/terry.csv` の 1 行の 24 列目へ `2026.09.01.00` を入れ、`go run ./cmd/seedgen -mode moves -chars terry` を実行 | **マーカーは残った**。`UPDATE moves SET last_changed_game_version = '2026.09.01.00' WHERE character_id IN (…) AND code IN ('standing_light_punch');` が INSERT の直後に出力され、`INSERT INTO moves (…)` の列は増えていない。**ただし同時に `TestGolden_CommittedMigrationMatchesRegeneration` が `000026` 不一致で落ちた**（高 1）。`TestCSVAndDBAgreeOnFrameCostColumns` も「CSV と DB が 1 件食い違っている」で落ちた（こちらは設計どおりの検出）。**CSV は復元済み** |
| **§8-3** | `affectedByGameUpdateCondSQL` から `combos.baseline_version IS NULL OR` を外した | **期待どおり赤**。`TestAffectedByGameUpdate_Matrix` が落ちた（基準 NULL が「影響なし」へ倒れ、出し漏らす側になったことを検出）。**復元済み** |
| **§8-4** | `model.PositionBands` の `corner_self` の代表値を `12` → `13` にした | **期待どおり赤**。`TestPositionBands_Boundaries` / `TestPositionBands_ContiguousAndSymmetric` / `TestRepresentativeMassOf` の 3 本が落ちた（左右対称が崩れたことを含めて検出）。**復元済み** |

**復元の確認**: `git status --short` は空（clean）。`go test ./...` 全パッケージ緑。`cd web && pnpm test` 212 ファイル・2440 件緑。

---

## 良かった点

1. **「静かに壊れる」ものを、静かに壊れないように作り替えている。** 版数の形式検証は 4 入口すべて塞ぎ、どこまで塞いだかを報告に一覧化した。`seedgen` の出力は「値が 1 つも無ければ 1 バイトも書かない」形にして既存 golden を守りつつ、`csv_db_sync_test` へ 24 列目を足して**投入し忘れ・CSV 直し忘れの両方向**を機械検査に載せた。`followup` `csv-db-frame-cost-columns-drift` の「残る運用」への回答になっている。
2. **2 種類の NULL を混同していない。** 基準 NULL（＝不明・安全側へ出す）とマーカー NULL（＝既知の未変更・出さない）の区別を、コード・コメント・テスト・報告のすべてで一貫させている。ここを混同すると全件が出続けるか出し漏らすかのどちらかになるが、そのことまで書いてある。
3. **判定式を 1 か所にしている。** `affectedByGameUpdateCondSQL` を SELECT の派生列と `WHERE` で共有し、「書き写すと表示される値と絞り込まれる集合が静かにずれる」と理由を残した。あわせて 6 か所に写しとして散っていた `combos` の SELECT 句を `comboSelectSQL` へ集約したのは、2 列を安全に足すための正しい前提整備である（`Scan` 順のずれは型が合うと**エラーにならない**）。
4. **`Materialize` の構造体まるごと複製に気づいて明示的に潰している。** `gen := *base` は列が増えるたび「基底の値を引き継ぐ」側へ既定で倒れる、という一般則まで書き、テストは**基底を意図的に古くしてから**検証している。指示書 §2.3-5 の実査要求に対する模範的な応答。
5. **設計卓の記述の誤りを黙って通していない。** 「間に 2 つ挿入するだけ」ではなく末尾 2 値の順序も入れ替わることを見つけて報告 §7.2 に明記した。
6. **ついでに塞いだ穴 2 件が本物である。** `DefaultPositions` の `corner_self_near` 欠落（本体 5 値に対し CSV 側 4 値）と、`POSITION_LABEL_JA` / `POSITION_OPTIONS` が検査の網の外だった件。どちらも「新しく足した値だけ通る」ちぐはぐな状態を避けるための最小の是正であり、同期テストも同じ手番で置いている。
7. **`down` で失われるものを「復元できる／できない」に分けて書いた。** 「基準は再生成できない＝部分消化の履歴が消える」という、列を消す以上の意味まで届いている。
8. **テストが陽性対照を持っている。** 「ゼロ埋めなしなら実際に壊れる（`"1.10" < "1.9"` が真）」「整数 % へ丸めると往復が実際に壊れる」を assert しており、テストが空振りしていないことを自分で示している。

---

## 制約事項

- 本レビューはコード上で判定可能な範囲のみ対象。実際の動作確認・パフォーマンス・実機テストは別途実施が必要。
- `make e2e`（247 件）は本レビューでは実行していない（チェックリスト §0 の指示による）。完了報告の「緑」を追認していない。
- `docs/design/` 側の反映（報告 §6 の 9 項目）が妥当かどうかは設計卓の判断であり、本レビューでは内容の当否を評価していない。
- 高 1 について「どちらの直し方が正しいか」は運用の設計であり、レビュー担当としては**現状のままでは機能を使えない**ことの提示にとどめる。
- 不明: `M28-overview` §3.6 の「パーセンテージで持つ」の改訂（`D-731`）が設計卓側でいつ反映されるかは、本レビューからは判断できない。報告 §6-9 が請求として挙げている。

---

*以上、M28-02a レビュー報告書。* **重大 0 件 / 高 4 件 / 中 3 件 / 低 6 件。** **★高 1（マーカーを立てると golden が落ちる）だけは、本サブの中心機能が使えるかどうかに直結する。** 実測で赤を確認しているので、着地を決めてから完了承認へ進むこと。

---

## 取り込み結果（自動トリアージ）

| 実施 | 内容 |
|---|---|
| 実施日 | 2026-09-06（`implement_plan_full` Phase C） |
| 往復 | **1 回目**（再レビュー未実施。上限 2 回に対して余裕あり） |
| **「高」指摘の不採用** | **0 件**（4 件すべて採用）⇒ 開発者へのエスカレーションは発生していない |

### 高（4 件・**すべて採用**）

| # | 指摘 | 採否 | 対応 |
|---|---|---|---|
| **高 1** | マーカーを実際に立てると golden が落ちる | **採用** | **★指摘は正しい。製造側でも `terry.csv` へ値を 1 つ入れて `TestGolden_CommittedMigrationMatchesRegeneration` の失敗を再現し、独立に確認した。** 要求 (b) を採り、**マーカーを moves 波の生成物から完全に外して `-mode game-version` の独立したモードへ移した**（`internal/seedgen/generate_m2802a.go` を新設。`derived-backfill` / `move-commands` と同じ流儀）。★あわせて `games.current_data_version` の引き上げを同マイグレへ含めた——**マーカーだけ立てて現在版を据え置くと、以後に登録されるコンボが「登録した瞬間に影響可能性あり」で出る**ため。**★要求どおり CSV に値を入れた状態で `go test ./...` が緑になることを実測し、運用手順を完了報告 §3.3 へ書いた。** テストも「値が空のとき出ない」から **「★値が在っても moves 波に出ない」** へ作り直した（空だけを見るテストは、まさに事故が起きる状況を素通しする） |
| **高 2** | `normalizePositionAndMass` の godoc が存在しない「API 層の検証」を根拠にしている（値域外が 500 になる） | **採用** | **記述を実態へ寄せるのではなく、実装を記述へ寄せた。** `internal/service/validation/combo.go` に `validatePositionMassRange` を新設し、**値域外を ERROR（400 + `validations`）で返す**ようにした。他の値域欄（`VAL-C04` / `C05` / `C13`）と同じ扱いになる。godoc も実態（validation 層が弾く／DB の CHECK は最後の砦）へ直した。★破壊確認済み——呼び出しを外すと 4 サブテストが赤くなる |
| **高 3** | 一覧の絞り込み `affected_by_game_update` の SQL が 1 度も実行されていない | **採用** | `TestListFilterByAffectedByGameUpdate` を新設し、**実 DB で `List` の WHERE 側を通した**。`true` が影響ありのみ・`false` が影響なしのみ・`nil` が両方を返すことを id で突合している |
| **高 4** | 完了報告 §12-9「progress-log へ追記済み ✔」が事実と異なる | **採用** | §12-9 を「Phase D で実施」へ、§12-7 へ「`check-progress-log-index.sh` は Phase D の追記まで赤」を明記。**★指摘のとおり、観測していないことを `✔` と書いていた**（`D-510` と同型を、同じ報告の別の欄でやっていた） |

### 中（3 件・**1 件採用 / 2 件は繰り越し**）

| # | 指摘 | 採否 | 理由 |
|---|---|---|---|
| **中 1** | 運び量が PATCH に載っておらず後から編集できない ／ 基準の「更新時」が PUT だけで非対称 | **繰り越し**（`M28-02b`） | **★前半は本サブでは実害が出ない**——入力欄が無いため運び量を編集する経路がそもそも存在しない（画面は `M28-02b` の射程）。**★後半（PATCH で基準を進めるべきか）は開発者・設計卓の裁定事項である**——指摘自身がそう書いており、`FR307`（自動断定しない）との兼ね合いで「メモを直したら確認済みになる」は `M28-overview` §3.2.6 が案 (e) を落とした理由そのものである。**⇒ 製造が独断で決める事項ではない。** 完了報告 §6 の設計反映一覧へ論点として残す |
| **中 2** | 重複の事前チェックがマス数を知らない（`comboio` の取込・`check-duplicate`） | **繰り越し**（`M28-02b` ／ 設計卓へ） | **★実害は「手編集 CSV で `position` とマス数を食い違わせた行」に限られる**。正規の経路（画面・API）は `normalizePositionAndMass` を通る。**★直すには `CheckDuplicateInput` にマス数を足して正規化を共有させる必要があり、`POST /api/combos/check-duplicate` の契約変更になる**——本サブの射程（§0.3 スキーマとバックエンド）を越え、リアルタイム重複警告の画面挙動に影響する。**⇒ `M28-02b` で 3 方式入力を作る手番に、画面側と一緒に決めるのが正しい。** 完了報告 §6 へ残す |
| **中 3** | 区分表が Go と TS に二重直書きで突合検査が無い | **採用** | 境界と代表値を突合するテストを FE 側へ足した（`web/src/constants/position.test.ts`）。★Go 側の値を TS のテストから直接読むことはできないため、**両側が同じ確定値表を名指しで固定する**形にしてある（`D-731` / `D-733` の値そのものが正本） |

### 低（6 件・**3 件採用 / 3 件は記録のみ**）

| # | 指摘 | 採否 | 対応 |
|---|---|---|---|
| 低 1 | `handler_test.go` のコメントが実在しないファイル名を指す | **採用** | `m28_02a_handler_test.go` へ是正（dead file reference） |
| 低 2 | `AcknowledgeGameVersion` がコンボを 2 回読む | **不採用** | **★ハンドラが `Get` を呼び直すのはタグを利用者スコープで載せるためである**（`M22-02` §4.5-13 ＝ `D-405`）。他の応答（`Restore` 等）と同じ形であり、ここだけ変えると流儀が割れる。★サービス側 godoc の「応答で返せるようにする」はサービスの契約としては正しい（`AcknowledgeGameVersion` 自身は判定込みで返す） |
| 低 3 | `insertComboSQL` の `'sf6'` リテラルが `gamerepo.CodeSF6` と二重 | **不採用** | **★リポジトリ層が別リポジトリ層のパッケージを import する形になる**（`repository/combo` → `repository/game`）。既存の `seedgen` / `character` も `'sf6'` を SQL 内リテラルで持っており、そちらへ揃えた。★恒久の是正は「ゲーム code の正本をどこに置くか」であり `NFR407`（他ゲーム対応）と一緒に決める事項 |
| 低 4 | `AdvanceBaselineVersion` が `updated_at` を進めるため並びが動く | **採用**（記述） | **意図した挙動である**旨と、据え置くと「いつ確認したか」が残らなくなることを godoc へ明記 |
| 低 5 | `2026.02.31` が通る | **不採用** | 暦の妥当性を見ない旨は `gameversion.Pattern` の godoc に明記済み。**★形式の目的は「固定幅ゼロ埋めによる辞書順＝時系列順」であり、暦の実在は目的外である** |
| 低 6 | `seedgen` の `down` がマーカーを戻さない | **採用**（是正済み） | `-mode game-version` の `down` が **マーカーを NULL へ戻す**ようになった（高 1 の是正に伴う）。★「立てる前の値」へは戻らないこと（前の値を記録していない）を完了報告 §3.4 へ明記 |

### 是正後の実測

- `go test ./...` **全パッケージ緑**
- `cd web && pnpm test` **緑**（212 ファイル・2440 件）
- `make e2e` **緑**（247 件）
- `check-artifact-integrity.sh` / `check-import-order.sh` / `check-enum-sync.sh` / `check-md-emphasis.sh` **違反なし**
- **★`character_data/terry.csv` へマーカーを 1 つ入れ、`-mode game-version` のマイグレを生成した状態でも `go test ./...` 全緑**（高 1 の要求。実測後は復元・削除済み）

### 破壊確認（是正後に製造側で再実施）

| # | 壊し方 | 結果 |
|---|---|---|
| 1 | CSV にマーカーを入れて golden を回す | **緑**（是正前は `000026` 不一致で赤。★是正の効果を直接確認した） |
| 2 | `validatePositionMassRange` の呼び出しを外す | **赤**（4 サブテスト） |
| 3 | `Materialize` の `gen.BaselineVersion = nil` を外す | **赤**（初回レビュー前に実施済み） |
| 4 | 判定から `baseline_version IS NULL` を外す | **赤**（同上） |
