# M23-09 完了報告: 登録前の重複ダイアログ

| 項目 | 内容 |
|---|---|
| 作業 ID | **M23-09** |
| 対象指示書 | `docs/instructions/M23-09-pre-save-duplicate-dialog.md` **v1.1.0** |
| チェックリスト | `docs/instructions/reviews/M23-09-review-checklist.md` **v1.0.1** |
| 実施日 | 2026-08-23 |
| ブランチ | `claude/m23-09-implementation-plan-chb8ch` |
| 起点 commit | `67bdc32`（`Merge pull request #100 ... design-desk-handover-m23-m24`） |
| **消費マイグレーション** | **0 本**。根拠＝`ls migrations/*.up.sql \| wc -l` が着手前・完了後とも **78**（最新は `000078_add_combos_superseded_by`）。`git diff --numstat 67bdc32 -- migrations/` が空 |
| **消費 CHANGE 番号** | **0 件**（`CHANGE-141` は設計卓が起票済み＝**D-520**。製造は消費しない） |
| 新規依存 | **0 件**（`go.mod` / `go.sum` / `package.json` / `pnpm-lock.yaml` の差分 0） |

> **★先行担当の成果物について**。PR#100 未マージの main から分岐したため破棄された先行実装の
> 完了報告・レビュー報告・progress 索引行を開発者から参考資料として受領した。
> **コードは本作業ツリーに 1 バイトも存在せず、実装はゼロから行っている**
> （着手前の走査＝`PreSaveDuplicateDialog` / `preSaveDuplicateCheck` / `deletedDuplicates` /
> `findDeletedDuplicateRefsByKey` で **0 件**）。
> **★先行資料からは「設計判断」と「踏んだ落とし穴」だけを取り出した**（§12.3 に一覧）。
> 先行は指示書 v1.0.0 対応だが、v1.1.0 との差分は並列性欄の訂正（**D-524**）のみで仕様本文は同一である。

---

## 1. §3.3 着手前の実査 10 件（走査コマンドと件数付き）

**★見立てとの一致・食い違いを 1 件ずつ書く。** `E-125` により終了コードだけを根拠にしない。

### #1 `M23-05` が作った「削除済みの重複を探す」処理の現物 — **見立てどおり（名前 3 つとも実在）**

```
$ grep -rn "FindDeletedByDuplicateKey\|CheckTrashDuplicate\|CheckTrashDuplicateSetup" --include=*.go . | wc -l
50
```

| VAL | 層 | 現物 | 位置 |
|---|---|---|---|
| VAL-C14 | サービス | `CheckTrashDuplicate(ctx, comboID) validation.ValidationResult` | `internal/service/combo/service.go:922` |
| VAL-C14 | サービス補助 | `findDeletedDuplicateCandidates` ／ `withRecipeHashes` | 同 `:962` ／ `:971` |
| VAL-C14 | リポジトリ | `FindDeletedByDuplicateKey(ctx, key)` | `internal/repository/combo/repository.go:1385` |
| VAL-C14 | 判定 | `ValidateC14DuplicateInTrash` | `internal/service/validation/duplicate.go:57` |
| VAL-S07 | サービス | `CheckTrashDuplicateSetup(ctx, parentComboID, setupID)` | **`internal/service/setup/restore.go:322`**（`service.go` ではない） |
| VAL-S07 | リポジトリ | `FindDeletedDuplicateRefsInCombo(ctx, comboID, characterID, recipeHash)` | `internal/repository/setup/repository.go:987` |
| VAL-S07 | 判定 | `ValidateS07DuplicateInTrash` | `internal/service/setup/validate.go:196` |

**★本サブはこれらを呼ぶだけである。判定を書き直していない**（§9 の機械的確認・§4 の否定形確認も参照）。

### #2 呼び出し元の数 — **見立てどおり（production は 1 か所ずつ）**

```
$ grep -rn "\.CheckTrashDuplicate(" --include=*.go . | wc -l        → 8（うち非テストは 1）
$ grep -rn "\.CheckTrashDuplicateSetup(" --include=*.go . | wc -l   → 4（うち非テストは 1）
$ grep -rn "\.FindDeletedByDuplicateKey(" --include=*.go . | wc -l  → 1
$ grep -rn "\.FindDeletedDuplicateRefsInCombo(" --include=*.go . | wc -l → 1
```

非テストの呼び出し元は `internal/api/combo/handler.go:103` と `internal/api/setup/handler.go:73` のみ。

**★★本サブ後もこの 2 か所は増えていない。** 保存前チェックは **VAL コードを 1 つも発火させない**
（データを返すだけ）ため、検証関数からは呼んでいない。増えたのは**母集団を返すリポジトリ関数**の
呼び出し元だけである（各 1 → 2）。**⇒ `M23-05` の「経路で絞る」は崩れていない。**

### #3 コンボの保存前チェックの現物 — **見立てどおり（★生きた行しか見ていなかった）**

```
$ grep -rn "check-duplicate" --include=*.go . | wc -l   → 13（着手前はすべて combo 側）
```

経路 `internal/api/combo/routes.go:22` → `check_duplicate_handler.go` → `service.go:1165` →
`FindActiveByDuplicateKey`（`repository.go:1251`）。着手前の母集団（逐語）:

```go
whereParts := []string{"character_id = ?", "is_draft = 0", "deleted_at IS NULL"}
```

**★`superseded_by_combo_id` の述語は無い**（SELECT 句にのみ登場）。レシピ比較は SQL ではなく
Go 側（`service.go:1184`）。**⇒ ゴミ箱を 1 件も見ていなかった。本サブで削除済み側を追加した（§2）。**

### #4 `DuplicateInfoResponse` が人が読める文字列を持つか — **持っていなかった（見立てどおり）／足した**

着手前のフィールドは 8 項（`id` / `characterId` / `starterMoveId` / `position` / `opponentStance` /
`hitType` / `opponentSize` / `stepCount`）で **`memo` を持たない**。
さらに **`id` と `stepCount` 以外は要求値のエコーバック**であり、一致した行から読んだ値ではない
（`service.go:1187-1195`）。

**足せない理由は無かった**——`FindActiveByDuplicateKey` の SELECT に `memo` が含まれており
（`repository.go:1281`）、`model.ComboRef{id, memo}` / `model.SetupRef{id, name}` が
`internal/model/setup.go:121` / `:134` に既存である。

**⇒ 2 つとも実施した。**（a）削除済み側は既存の `ComboRef` / `SetupRef` をそのまま返す
（新しい形を作らない＝**D-417**）。（b）**生きた側の `DuplicateInfoResponse` にも `memo` を足した**
（§3.3-4 の「持たないなら足す」に従った）。**⇒ §9.1-5 の報告事由には該当しない。**

> **★「開発者確認済み」の根拠**（レビューの不明点への回答）。Plan Mode で計画を提示する際、
> (b) を実施するか否かを開発者へ選択肢として提示し、**「足す」の回答を得たうえで実装した**。
> **★指示書 §3.3-4 が「持たないなら足す」と指示しているため、確認が無くても指示の範囲内である。**
> 確認したのは「生きた側は画面がこの値を消費しないため、未使用フィールドを増やすことになる」
> という副作用を明示するためである。

### #5 `check-duplicate` が `DES-002` §4.2 に載っているか — **★載っていない（設計卓の走査値を再現）**

```
$ grep -c "check-duplicate" docs/design/02-architecture.md
0
$ grep -rn "check-duplicate" docs/design/ | wc -l
0
```

実在の記録は `docs/handover/code-facts.md:364` にのみ在る。
**⇒ 実装が在るのに経路表に無い形である（`M23-01` と同じ）。`CHANGE-141` で as-built を載せる必要がある。応答の逐語形は §5 に置いた。**

### #6 セットプレイ側に保存前チェックの経路が在るか — **★無い（見立てどおり）／新設した**

```
$ grep -rn "check-duplicate" --include=*.go internal/api/setup/ | wc -l   → 0（着手前）
$ grep -rn "setups/check-duplicate" --include=*.go . | wc -l              → 0（着手前）
```

着手前の setups 系ルートは 13 本（`internal/api/setup/routes.go`）＋ setplay 側 1 本
（`internal/api/setplay/routes.go:8`）で、事前チェックは含まれない。**⇒ 新設した（§2.2）。**

### #7 リアルタイム警告が保存ボタンの動作に関与しているか — **★関与していない（表示専用・見立てどおり）**

```
$ grep -n "duplicates" web/src/features/combo/components/ComboEditor.tsx  → 2 件（:208 取得 / :600 表示）
```

`DuplicateRealtimeWarning.tsx` の props は `{duplicates, moves}` のみでコールバックを持たない。
保存ボタンの活性条件は `ComboEditor.tsx:521-526` の `isMutating`（5 つの `isPending` の OR）だけで、
`duplicates` は `onSave` / `proceedSave` / `runCreate` / `disabled` のいずれからも参照されていない。
**⇒ 本サブのダイアログと二重にならない。リアルタイム警告は変えていない（§1.4-3）。**

### #8 `M23-05` が入れた文面の回帰ガード — **在る（見立てどおり）／消していない**

`web/src/features/trash/saveWarnings.unit.test.ts:143-169`
（`not.toContain("復元できます")` / `not.toContain("代わりに")` を VAL-C14 / VAL-S07 の 2 件で主張）。

**★同ファイル L154-155 のコメントが本サブを名指しで送り先にしていた**
（followup `save-time-duplicate-choice-missing`）。

**★本サブは `saveWarnings.unit.test.ts` と `trash.warning.*` を 1 文字も触っていない。**
根拠＝`git diff --numstat 67bdc32 -- web/src/features/trash/saveWarnings.unit.test.ts` が空。
新しい文言は別階層 `trash.preSaveDuplicate.*` に隔離した。
**⇒ 保存後トーストの文面は不変であり、ガードと衝突しない。**

**★ただし `saveWarnings.ts` の冒頭コメントは是正した**（§12.2-1）。同コメントは
「登録側は『作り直す前に』告げる」と書いていたが、**その主張は D-518 で撤回されている**。
**コメントの是正はガード（`ja.json` の文面とテスト）に触れずに行える。**

### #9 多重送信の防止 — **★ボタン `disabled` のみ在り、再入ガードは無かった（見立て無し）／本サブで防いだ**

着手前: コンボ＝`isMutating`（`ComboEditor.tsx:521-526` → 保存ボタン `:669` / 物理入力 `canSave` `:631`）、
セットプレイ＝`saveDisabled`（`SetupEditorPage.tsx:86-89`）。
**`onSave` / `handleSave` 内の early-return は 0 件**、`useRef` は両ファイルとも **0 件**であり、
防止は React の `disabled` 属性だけに依存していた。

**⇒ ダイアログを挟むと押下から送信までの間が長くなり、その間 `isMutating` は false のままである。本サブで 3 点足した（§4.6-3）。**

1. `onSave` / `handleSave` の冒頭に **再入ガード**（`useRef`。**state ではない**——同じイベント
   ハンドラ内で読むため state だと更新前の値を掴む）。
2. **保存前チェックの待ち（`checkingTrash`）とダイアログ表示中**を `isMutating` / `saveDisabled` に含めた。
   **★定義は各画面 1 か所であり、画面の保存ボタンと物理コントローラの `canSave` が同じ式を見る。**
3. ダイアログの全ボタンを送信中は押せなくした（`busy`）。

### #10 復元 API の応答 — **見立てどおり（復元後の完全な表現を返す）**

| 経路 | 応答 | 実装 |
|---|---|---|
| `POST /api/combos/{id}/restore` | `200` + `ComboResponse` 全体（再取得して返す）。警告があれば `warnings` | `internal/api/combo/handler.go:463` |
| `POST /api/setups/{id}/restore` | `200` + `SetupResponse` 全体 | `internal/api/setup/restore_handler.go:23` |

フロントには `useRestoreCombo` / `useRestoreSetup` が既存で、**本サブはそれを呼ぶだけである（復元 API に差分 0）。⇒ 復元後の id は応答から取れる。**

---

## 2. as-built の最終形

### 2.1 サーバ — コンボ側（既存経路を広げた）

- `internal/service/combo/service.go`
  - **`findDeletedDuplicateRefsByKey(ctx, key)` を抽出した。** `findDeletedDuplicateCandidates`
    （VAL-C14 が使う）はこれに委譲するだけになっている。
    **★★保存前チェックと VAL-C14 が同一の 1 本を通るため、母集団が構造的にずれない。**
    保存前は combos の行がまだ無く `*model.Combo` を作れないため、キーで受ける口を分けた。
  - `CheckDuplicate` に削除済み側を追加（`CheckDuplicateResult.DeletedDuplicates []model.ComboRef`）。
    絞り込みは `validation.MatchDuplicatesByRecipeHash`（既存 `matchByRecipeHash` へ委譲する公開点）。
  - **★削除済み側は `ExcludeComboID` を見ない。** 同 id は「編集中の自分自身」を除くためのもので、
    ゴミ箱に居る行は編集対象になりえない（VAL-C14 も除外していない）。
- `internal/service/validation/duplicate.go`: `MatchDuplicatesByRecipeHash` / `ToComboRefs` を公開点として追加。
  `comboRefDetails` は `ToComboRefs` を経由するようにした（**写像の切り出しであり挙動は不変**）。
- `internal/service/validation/combo.go` / `internal/service/combo/service.go`:
  `DuplicateCandidate` へ `Memo` を追加（**VAL-C02 は本フィールドを見ない。判定に一切関与しない**）。
- `internal/api/combo/dto.go` / `check_duplicate_handler.go`: 応答へ `deletedDuplicates` を追加し、
  `DuplicateInfoResponse` へ `memo` を追加（**既存キーの名前も意味も不変**）。

### 2.2 サーバ — セットプレイ側（新設）

- ルート **`POST /api/combos/:comboId/setups/check-duplicate`**（`internal/api/setup/routes.go`）。
  登録経路（`POST /api/combos/:comboId/setups`）の直下であり、コンボ側と対称の位置。
- `internal/repository/setup/repository.go`: **`FindLiveDuplicateRefsInCombo` を追加**。中身は
  **既存の `duplicateRefsInCombo` を `deletedOnly=false` / 除外なしで呼ぶだけ**
  （VAL-S04 と同じ母集団。返す値が id ではなく `SetupRef` である点だけが違う）。
- `internal/service/setup/check_duplicate.go`（**新規**）: `CheckSetupDuplicate`。
  **削除済みは `FindDeletedDuplicateRefsInCombo`（VAL-S07 が呼ぶのと同じ関数）**、生存は上記。
- **★404 を返さない**（§12.2-2）。親コンボの存在を確認しない——存在しなければ双方 0 件になるだけで
  あり、「チェックの失敗で登録という主目的を巻き添えにしない」規律（§4.2-3）と整合する。

### 2.3 フロント

| ファイル | 内容 |
|---|---|
| `web/src/components/PreSaveDuplicateDialog.tsx` | **新規**。`AlertDialogContent` 経由（`modal-presence` に自動参加）。`ConflictDialog.tsx` と同じ置き場 |
| `web/src/features/trash/preSaveDuplicateCheck.ts` | **新規**。命令的な保存前チェック ＋ `toComboCandidates` / `toSetupCandidates` |
| `web/src/features/combo/components/ComboEditor.tsx` | 新規/コピーの保存を「チェック →（一致が在れば）ダイアログ → 実行」に |
| `web/src/pages/SetupEditorPage.tsx` | 同上（`mode === "create"`） |
| `web/src/features/trash/saveWarnings.ts` | `dropAcknowledgedTrashDuplicates` を追加 ＋ 冒頭コメントの是正（§12.2-1） |
| `web/src/locales/{ja,en}.json` | `trash.preSaveDuplicate.*` を 10 キー ＋ `trash.warning.unnamedSetup` を追加（**`trash.warning.*` の既存キーは不変**） |

**★★保存前チェックの入力に `checkInput`（リアルタイム検知用）を流用していない**（§12.3-4）。

---

## 3. ★★§4.9 文言と行動の対応表（**本サブでいちばん重要な成果物**）

**出すすべての文言について「この文を読んだ利用者が次に取れる行動」を 1 つ挙げ、それが実装に在ることを確かめた。**
**★`M23-05` はここで失敗した**——文面が実装のしないことを約束し、翻訳キー経由で正しく描画されるため
テストも lint も型検査も緑だった。

| # | 翻訳キー | ja 文面（逐語） | 読んだ利用者が次に取れる行動 | **その行動は実装に在るか（実装位置）** |
|---|---|---|---|---|
| 1 | `trash.preSaveDuplicate.title` | ゴミ箱に同じものがあります | **ダイアログ本文を読む**（見出しであり、それ自体は行動を要求しない） | ○ 本文が同じダイアログ内に在る（`PreSaveDuplicateDialog.tsx`） |
| 2 | `…bodyCombo` | 同じ内容のコンボが {{count}} 件ゴミ箱にあります。**ゴミ箱から戻すか、新しく作るかを選んでください。** | **2 つのボタンのどちらかを押す** | ○ **「ゴミ箱から復元する」＝`handleTrashRestore`（復元 API を叩く）／「新しく作る」＝`handleTrashCreateNew`（登録 API を叩く）が実在する。** ★「戻す」も「作る」も文面が約束したとおりに起きる（§5.2-5 / §5.2-6 のテスト） |
| 3 | `…bodySetup` | 同じレシピのセットプレイが {{count}} 件このコンボのゴミ箱にあります。ゴミ箱から戻すか、新しく作るかを選んでください。 | 同上 | ○ 同上（`SetupEditorPage.tsx`） |
| 4 | `…selectPrompt` | 戻すものを選んでください | **一覧から 1 件を選ぶ** | ○ **ラジオが実在し、選ぶまで復元ボタンが `disabled` である。** ★選べない一覧を見せていない（§5.2-11 のテスト） |
| 5 | `…restore` | ゴミ箱から復元する | **押すと、ゴミ箱の行が戻る** | ○ `POST /api/combos/{id}/restore` ／ `POST /api/setups/{id}/restore` を叩き、成功で詳細画面へ遷移する。**★登録 API は叩かない**（E2E が `POST /api/combos` の発生回数 0 で主張） |
| 6 | **`…restoreCaution`** | **復元すると、いま入力した内容は保存されません。** | **「入力を残したいなら復元ではなく新しく作るを選ぶ」または「入力を捨ててよいと決めてから復元を押す」** | ○ **★実装は本当に入力を保存しない**（復元経路で登録 API を呼ばない）。**⇒ 文面が実装のしないことを約束していない。** 逆に「新しく作る」を選べば入力は保存される |
| 7 | `…createNew` | 新しく作る | **押すと、入力した内容で新しく登録される** | ○ `runCreate({ suppressSaveWarnings: true })` が従来どおり `POST /api/combos` を叩く |
| 8 | `…createNewCaution` | ゴミ箱の行はそのまま残ります。 | **「あとでゴミ箱から消す／戻すこともできる」と理解して押す** | ○ **★実装はゴミ箱の行に一切触らない。** E2E で「`/trash` に行が残っていること」を主張している |
| 9 | `…cancel` | 戻って編集を続ける | **押すと、入力したまま編集画面へ戻る** | ○ **`handleTrashCancel` は候補配列を空にするだけで、フォームの state に触らない。** §5.2-7 のテストが「打った文字が残ること」を実際に観測している |
| 10 | `…restoreFailed` | 復元できませんでした。**入力した内容はこのまま残っています。** | **「新しく作る」を選ぶ、またはキャンセルして編集を続ける** | ○ **★復元が失敗してもダイアログを閉じない**（`onError` で候補を空にしない）。⇒ 2 つの導線がまだ押せる状態に在る。**★専用テストで主張している**（両画面） |
| 11 | `trash.warning.unnamedSetup` | セットプレイ {{id}} | **（名前が無い行を）id で識別して選ぶ** | ○ **★名前が無い行も選択肢として必ず出す。** 落とすとその行は復元できなくなる（`toSetupCandidates` の単体テストで主張） |

**★あわせて確認した否定側**: ダイアログ内の文言に **「失敗」「エラー」を 1 つも使っていない**
（`DES-006` §11.2 の 4 点目。**重複が在ることは失敗ではない**）。**「両方」という語も出していない**（§1.4-1）。
いずれも両画面のテスト ＋ E2E で主張している。
（#10 の `restoreFailed` は復元が実際に落ちたときの文であり、対象外で妥当。）

---

## 4. §4.8 否定形確認（3 件・理由付き）

| # | 出さなかったもの | **この理由で出さないと判断した** |
|---|---|---|
| **1** | **「両方入れる」の選択肢** | **設計卓の裁定**（§1.4-1・**D-518**）。**禁止された状態ではない**（現状も「削除 → 作る → 復元」で到達でき、`VAL-R03` / `VAL-R04` が警告する）。**★出さない理由は目的と逆行するからである**——ボタン 1 つで重複を作れるようにすると、重複を減らすための導線が重複を増やす。**⇒ `VAL-C02` / `VAL-S04` の ERROR 契約には一切触れていない** |
| **2** | **生きた重複に対するダイアログ** | **既に ERROR で止まっている**（§4.1-4）——コンボは `VAL-C02` で `400 validation_failed`、セットプレイは `VAL-S04` で `409 duplicate_setup`。**応答には載せた**（`duplicates`。安いうえ経路の形が素直になるため）が、**画面は読み捨てている**。**★本サブの目的は「ゴミ箱の重複に気づかせる」ことであり、そこへ手を広げない** |
| **3** | **入力中（リアルタイム）のダイアログ** | **入力のたびにモーダルが出る**（§4.2-1）。**⇒ 保存ボタンを押したときにだけ叩く命令的な関数**（`checkComboTrashDuplicates` / `checkSetupTrashDuplicates`）**にした。debounce つきの `useCheckDuplicate` は表示専用のまま流用していない。** 両画面のテストが「押すまで `check-duplicate` を叩かない（押下前 0 回・押下後 1 回）」を主張している |

---

## 5. ★保存前チェックの応答の逐語形（**設計卓が `DES-002` §4.2 へ写す**）

**★`CHANGE-141` の反映がこれ待ちである。** 以下は実 DTO を `json.MarshalIndent` した**実行結果**であり、
転記ではない。

### 5.1 `POST /api/combos/check-duplicate` → `200`（**既存経路。★`DES-002` §4.2 に未掲載＝§1-#5**）

```json
{
  "duplicates": [
    {
      "id": 17,
      "characterId": 1,
      "starterMoveId": 12,
      "position": "mid_screen",
      "opponentStance": "standing",
      "hitType": "normal",
      "opponentSize": "medium",
      "stepCount": 5,
      "memo": "生きているほう"
    }
  ],
  "deletedDuplicates": [
    { "id": 91, "memo": "画面端 中央運び" }
  ]
}
```

**★`duplicates` の `characterId`〜`opponentSize` は要求値のエコーバックであり、一致した行から読んだ値ではない。** 行から来るのは `id` / `stepCount` / `memo` の 3 つである（既存挙動・M2-02 のまま）。

### 5.2 `POST /api/combos/{comboId}/setups/check-duplicate` → `200`（**新設**）

要求: `{ "characterId": 1, "steps": [{ "moveId": 12 }, { "moveId": 30 }] }`
（**★名前は送らない。重複判定は名前非依存である**＝`DES-006` §3）

```json
{
  "duplicates": [
    { "id": 11, "name": "生きている重ね" }
  ],
  "deletedDuplicates": [
    { "id": 22, "name": "投げ後の重ね" }
  ]
}
```

**★`steps` の `stepOrder` は配列順に 1 起算でサーバが採番する**（登録経路 `toServiceCreateInput` と
同じ採番）。違えると `CalcSetupRecipeHash` が別のハッシュを出し、保存前と保存後で判定がずれる。

### 5.3 0 件のとき（両経路とも）

```json
{"duplicates":[],"deletedDuplicates":[]}
```

**★`warnings` と違い、0 件でもキーを出し空配列を返す。** 既存の `duplicates` が M2-02 からそうであり、
画面は `length` で分岐する。omitempty にすると「キーが無い」と「0 件」の 2 通りを画面が扱うことになる。

### 5.4 母集団（**★`M23-05` と同一。逐語**）

| キー | 母集団 |
|---|---|
| `duplicates`（コンボ） | `character_id = ?` ＋ `is_draft = 0` ＋ **`deleted_at IS NULL`** ＋ 判定キー 5 項（NULL は `IS NULL` 一致） → `CalcRecipeHash` 比較。**★M2-02 のまま不変** |
| `deletedDuplicates`（コンボ） | **`VAL-C14` と同一**＝`deleted_at IS NOT NULL` ＋ `is_draft = 0` ＋ **`superseded_by_combo_id IS NULL`** ＋ 判定キー 6 項 → `CalcRecipeHash` 比較。**★同一関数 `findDeletedDuplicateRefsByKey` を共有している** |
| `duplicates`（セットプレイ） | **`VAL-S04` と同一**＝同一親コンボ（`combo_setups` 経由・`combos` 側に述語なし）＋ 同一キャラ ＋ `s.deleted_at IS NULL` → `CalcSetupRecipeHash` 比較 |
| `deletedDuplicates`（セットプレイ） | **`VAL-S07` と同一**＝同上 ＋ `s.deleted_at IS NOT NULL`。**★同一関数 `FindDeletedDuplicateRefsInCombo` を呼んでいる** |

### 5.5 ★エラー契約（**実装と逐語で一致させてある。ハンドラテストがコードまで主張している**）

| 経路 | 状況 | 応答 |
|---|---|---|
| コンボ | 本文が JSON として不正 | **400 `invalid_request`** |
| コンボ | `characterId` が 0 / 未指定 | **400 `invalid_request`** |
| コンボ | サービス層のエラー | **500 `internal_error`** |
| セットプレイ | `comboId` がパースできない | **400 `invalid_combo_id`**（★`invalid_request` **ではない**） |
| セットプレイ | 本文が JSON として不正 | **400 `invalid_request`** |
| セットプレイ | `characterId` が 0 / 未指定 | **400 `invalid_request`** |
| セットプレイ | サービス層のエラー | **500 `internal_error`** |

**★★404 は無い。** 存在しない `comboId` を渡すと **`200 {"duplicates":[],"deletedDuplicates":[]}`** が返る。
**返らない分岐を実装に持たせていない**——読む側が「存在確認をしている」と誤読するためである（§12.2-2）。
**★画面はエラーを保存の中止に使わない**（§4.2-3）。

---

## 6. ★ダイアログの文面の逐語（ja / en。**設計卓が `DES-005` へ写す**）

すべて `trash.preSaveDuplicate.*`（**★`trash.warning.*` の既存キーには触れていない**＝
`M23-05` の回帰ガードと構造的に衝突しない）。末尾の 1 件のみ既存階層へ追加した。

| キー | ja | en |
|---|---|---|
| `trash.preSaveDuplicate.title` | ゴミ箱に同じものがあります | The same item is in the trash |
| `…bodyCombo` | 同じ内容のコンボが {{count}} 件ゴミ箱にあります。ゴミ箱から戻すか、新しく作るかを選んでください。 | {{count}} identical combo(s) are in the trash. Choose whether to bring one back or create a new one. |
| `…bodySetup` | 同じレシピのセットプレイが {{count}} 件このコンボのゴミ箱にあります。ゴミ箱から戻すか、新しく作るかを選んでください。 | {{count}} setup(s) with the same recipe are in this combo's trash. Choose whether to bring one back or create a new one. |
| `…selectPrompt` | 戻すものを選んでください | Choose which one to bring back |
| `…restore` | ゴミ箱から復元する | Restore from trash |
| **`…restoreCaution`** | **復元すると、いま入力した内容は保存されません。** | **Restoring will not save what you have just entered.** |
| `…createNew` | 新しく作る | Create a new one |
| `…createNewCaution` | ゴミ箱の行はそのまま残ります。 | The item in the trash stays there. |
| `…cancel` | 戻って編集を続ける | Go back and keep editing |
| `…restoreFailed` | 復元できませんでした。入力した内容はこのまま残っています。 | Could not restore. What you entered is still here. |
| **`trash.warning.unnamedSetup`**（既存階層へ追加） | セットプレイ {{id}} | Setup {{id}} |

**★配置**（`DES-006` §11.2 の 4 点に揃えた）:

1. **入力を保持したまま表示する** — ダイアログはフォームの state に一切触らない。
2. **進む道を示す** — 「復元する」「新しく作る」の 2 つ ＋ キャンセル。
3. **消えることを押す前に伝える** — `restoreCaution` を**復元ボタンの直上に常時表示**
   （開いた瞬間から見えている。押した後ではない）。
4. **「失敗」と書かない** — ダイアログ内に「失敗」「エラー」の語を使っていない。

**★該当が 1 件のときはそのまま、複数のときはラジオ一覧（既定選択なし）。** 「1 件目を復元」にしていない。
**★`unnamedCombo`（既存キー「コンボ {{id}}」）を再利用し、セットプレイ用に `unnamedSetup` を同階層へ足した。**
名前の無い行も選択肢として必ず出す。

**★★WARNING でモーダルを出すことは逸脱ではない**（§4.2-2）。区別は「警告の表示」か「操作の分岐」かで
あり、選ばないと次へ進めないものはモーダルが正しい。**先例＝`VAL-N02`**（`DES-006` §7）。
**⇒ `CHANGE-141` で `DES-006` §11 へこの区別を明文化する。**

---

## 7. §5.3 破壊確認（2 件・コマンドと出力）

### 破壊確認 1 — 保存前チェックの母集団から「削除済み」の条件を外す

**壊し方**: `internal/repository/combo/repository.go` の `FindDeletedByDuplicateKey` から
`"deleted_at IS NOT NULL"` を削除。

```
$ git diff --stat internal/repository/combo/repository.go
 internal/repository/combo/repository.go | 2 --
 1 file changed, 2 deletions(-)

$ go test ./internal/service/combo/ ./internal/service/setup/ -count=1 \
    -run 'TestCheckDuplicate_|TestCheckSetupDuplicate_|TestCheckTrashDuplicate' -v
--- PASS: TestCheckDuplicate_ReturnsDeletedMatch (0.63s)
--- FAIL: TestCheckDuplicate_SeparatesAliveAndDeleted (0.58s)
--- PASS: TestCheckDuplicate_DeletedSide_ExcludesSupersededOldRow (0.56s)
--- PASS: TestCheckDuplicate_DeletedSide_ExcludesDraftRows (0.56s)
--- FAIL: TestCheckDuplicate_DeletedSide_ExcludesAliveRows (0.56s)
--- PASS: TestCheckDuplicate_DeletedSide_NotFiredWhenRecipeDiffers (0.57s)
--- PASS: TestCheckDuplicate_AliveSide_StillExcludesDeleted (0.54s)
--- PASS: TestCheckDuplicate_ExcludeComboID_StillAppliesToAliveSide (0.49s)
--- PASS: TestCheckDuplicate_DeletedSide_CarriesHumanReadableMemo (0.47s)
--- PASS: TestCheckDuplicate_AliveSide_CarriesHumanReadableMemo (0.46s)
--- FAIL: TestCheckTrashDuplicate_VALC14_FiresWhenTrashHasSameCombo (0.42s)
--- FAIL: TestCheckTrashDuplicate_VALC14_NotFiredWhenRecipeDiffers (0.42s)
--- FAIL: TestCheckTrashDuplicate_VALC14_ExcludesSupersededOldRow (0.42s)
--- FAIL: TestCheckTrashDuplicate_VALC14_ExcludesDraftRows (0.43s)
--- PASS: TestCheckTrashDuplicate_VALC14_SkippedWhenCreatingDraft (0.43s)
--- FAIL: TestCheckTrashDuplicate_VALC14_MatchesNullKeyFields (0.43s)
--- PASS: TestCheckTrashDuplicate_VALC14_DoesNotBlockCreate (0.43s)
FAIL	github.com/plexiblinp/combomgr/internal/service/combo	8.388s
ok  	github.com/plexiblinp/combomgr/internal/service/setup	5.420s
```

**⇒ §5.1-3 側は期待どおり赤くなる**（受け皿として `..._ExcludesAliveRows` を新設してある）。

**★★あわせて `M23-05` の VAL-C14 テストが 5 本まとめて赤くなった。これは証拠である**——
保存前チェックと VAL-C14 が **`findDeletedDuplicateRefsByKey` という同じ 1 本を通っている**
ことが、構造的に観測できている。**⇒ 母集団は「同じにしてある」のではなく「同じ 1 本である」。**

**★★指示書 §5.3-1 は「§5.1-3 と §5.2-2 が赤くなる」を期待していたが、§5.2-2（フロント）は赤くならない。**
**フロントテストは `check-duplicate` の応答を stub するため、サーバの SQL 変更を原理的に検出できない。**
**この継ぎ目を持つのは実 DB を通る E2E だけである。**
**⇒ 「母集団のずれ」を守らせたい指示書は、フロント側に受け皿を求めないこと。**（期待とのずれ 1 点）

**復旧確認**:
```
$ git diff --stat internal/repository/combo/repository.go
（出力なし＝復旧済み）
$ go test ./internal/service/combo/ -count=1 -run 'TestCheckDuplicate_|TestCheckTrashDuplicate'
ok  	github.com/plexiblinp/combomgr/internal/service/combo	8.151s
```

### 破壊確認 2 — §4.5 の抑制を常時有効にする

**壊し方**: 両画面の `runCreate` で
`const suppressSaveWarnings = opts?.suppressSaveWarnings ?? false;` を `= true;` に。

```
$ git diff --stat web/src/features/combo/components/ComboEditor.tsx web/src/pages/SetupEditorPage.tsx
 web/src/features/combo/components/ComboEditor.tsx | 2 +-
 web/src/pages/SetupEditorPage.tsx                 | 2 +-
 2 files changed, 2 insertions(+), 2 deletions(-)

$ pnpm exec vitest run src/features/combo/components/ComboEditor.preSaveDuplicate.test.tsx \
                      src/pages/SetupEditorPage.preSaveDuplicate.test.tsx
 × M23-09 保存後トーストの抑制(セットプレイ) > ★★§5.2-9 ダイアログを出さずに保存した場合は、保存後トーストが出る(抑制しすぎない)
 × M23-09 保存後トーストの抑制(コンボ)     > ★★§5.2-9 ダイアログを出さずに保存した場合は、保存後トーストが出る(抑制しすぎない)
 × M23-09 保存後トーストの抑制(コンボ)     > ★チェックが失敗して保存したときも、保存後トーストが出る(抑制しない)
 × M23-09 保存後トーストの抑制(コンボ)     > ★抑制は 1 回きりである(次の保存では再びトーストが出る)
 Test Files  2 failed (2)
      Tests  4 failed | 32 passed (36)
```

**⇒ §5.2-9 が両画面で赤くなる（期待どおり）。★抑制しすぎたことを検出できるのはこの経路だけである。**

**復旧確認**:
```
$ git diff --stat（対象 2 ファイル）
（出力なし＝復旧済み）
$ pnpm exec vitest run（同 2 ファイル）
 Test Files  2 passed (2)
      Tests  36 passed (36)
```

---

## 8. テスト結果（件数付き）

| 検査 | 結果 |
|---|---|
| `go test ./... -count=1` | **53 パッケージ ok / FAIL 0**（テスト関数 **1557** 本 PASS。着手前も 53 パッケージ green） |
| `cd web && pnpm test` | **182 files / 1829 tests 全 pass**（着手前 178 files / 1773 tests ⇒ **+4 files / +56 tests**。★レビュー取り込みで 5 本追加した後の実測値） |
| `make e2e` | **175 passed / 0 failed / 0 flaky**（★セットプレイ側 E2E を足した後の最終実測）。取り込み直後の回は 174 件中 172 passed / 2 flaky / 0 failed。**★flaky が出た回の 2 件は `m18-03b-materialize` と `m18-03c-drainage` であり本サブと無関係**（`M23-06` 横断課題 6 の既知事象＝毎回 1〜2 件・毎回別のテストが当たる）。`m23-05` / `m23-09` の 6 本はいずれの回も green |
| `gofmt -l internal cmd` | 出力なし |
| `go vet ./...` | 出力なし |
| `pnpm exec tsc --noEmit` | 緑 |
| `bash scripts/check-artifact-integrity.sh` | **違反なし**（★1 本目に実行） |
| `bash scripts/check-browser-storage-keys.sh` | **違反なし**（台帳 9 件 / 本番コード 8 件。**本サブはブラウザストレージを使っていない**） |
| `bash scripts/check-enum-sync.sh` | **ベースラインどおり（増加なし）** |
| `bash scripts/check-doc-refs.sh` | dead reference なし |
| `bash scripts/check-progress-log-index.sh` | **緑**（★`progress-log.md` への索引行を追記した**後**に実行した実測値。**初版は索引行が無いまま「緑」と書いており事実と異なっていた**＝レビュー 高-1。`E-125` に反する記述であり、取り込みで是正した） |

**サーバ側の新規テスト内訳（22 本）**: サービス層 16（コンボ 9 ／ セットプレイ 7）＋
ハンドラ層 6（コンボ 2 ／ セットプレイ 4 ＋ ルーティング非回帰 1、うち 1 本は既存 mock 拡張）。
**フロント側の新規テスト内訳（51 本）**: `ComboEditor.preSaveDuplicate` 20 ／
`SetupEditorPage.preSaveDuplicate` 16 ／ `PreSaveDuplicateDialog` 9 ／ `preSaveDuplicateCheck.unit` 6。

**★指示書 §5.1（7 件）・§5.2（12 件）の対応**は §11 の対照表に置いた。

---

## 9. 変更しなかったものの機械的確認

```
$ git diff --numstat 67bdc32 -- <対象>
```

- **`migrations/` に差分 0**（マイグレ消費 0 本。`ls migrations/*.up.sql | wc -l` = **78** で着手前後不変）。
- **`docs/design/` に差分 0**（**設計書本体は編集していない**。反映は設計卓が `CHANGE-141` で行う）。
- **`web/src/features/trash/saveWarnings.unit.test.ts` に差分 0**
  （**`M23-05` の文面の回帰ガードは無傷**）。
- **`internal/service/setup/validate.go` に差分 0**（**`VAL-S04` / `VAL-S07` の判定を書き直していない**）。
- **`internal/api/combo/handler.go` / `internal/api/setup/handler.go` に差分 0**
  （**登録経路の成功応答と `warnings` の載せ方は不変**。`VAL-S04` の `409 duplicate_setup` を含む）。
- **復元 API（`useRestoreCombo` / `useRestoreSetup` / 両 restore ハンドラ）に差分 0。**
- **ゴミ箱画面（`TrashPage.tsx` / `TrashListRow.tsx` / `TrashSetupListRow.tsx`）に差分 0。**
- `go.mod` / `go.sum` / `package.json` / `pnpm-lock.yaml` に差分 0。
- `web/src/locales/*.json` は **追加 13 行のみ・削除 0**（`trash.warning.*` の既存文面を書き換えていない）。

**既存ファイルの変更**（意図のあるもののみ）:

| ファイル | 何を変えたか |
|---|---|
| `internal/service/combo/service.go`（+52/-4） | `findDeletedDuplicateRefsByKey` の抽出 ＋ `CheckDuplicate` の削除済み側 ＋ `DuplicateInfo.Memo` |
| `internal/service/validation/duplicate.go`（+27/-3） | 公開点 2 本の追加 ＋ `comboRefDetails` の写像を切り出し（挙動不変） |
| `internal/service/validation/combo.go`（+4/-0） | `DuplicateCandidate.Memo` の追加（**VAL-C02 は見ない**） |
| `internal/api/{combo,setup}/handler_test.go` | 新設インタフェースメソッドのモック追加（未設定なら 0 件を返す＝既存テストを壊さない形） |
| `web/src/features/trash/saveWarnings.ts`（+43/-5） | 冒頭コメントの是正（§12.2-1）＋ `dropAcknowledgedTrashDuplicates` |
| `web/src/features/combo/components/ComboEditor.test.tsx`（+9/-5） | **既存 5 本を async 化**。保存経路に非同期の一段が入ったため（§12.3-5。**主張は 1 つも変えていない**） |
| `web/e2e/m23-05-duplicate-collision.spec.ts` | 登録側の衝突が出る場所がトースト → 保存前ダイアログへ移ったことへの追随（§12.2-3） |

**★整形差分について**（レビュー 中-3）。初版は `ComboEditor.tsx` / `SetupEditorPage.tsx` に
**prettier の整形のみのハンクを 22 件・約 87 行**混入させていた（保存時整形が触れた領域）。
**リポジトリ全体は prettier 適用済みではなく**（`--check` で 330 files warn・`lint` は
`tsc --noEmit` のみ）、**整形は「規約への正規化」ではなく純粋なノイズだった**。
**⇒ 取り込みで、空白を無視すると同一になるハンクだけを機械的に元へ戻した。**
（コンボ側 15 件 / セットプレイ側 7 件。復元後も `tsc` 緑・関連テスト 128 本 green。）
**★リポジトリ全体の prettier 化は独立の改善レーンの手番である。**

---

## 10. 契約違反の独自判断

**0 件。**

`§9.1` の「推測で進めてはいけない事項」6 件のいずれにも触れていない——スキーマ変更なし ／
登録経路の外の欠けを直していない ／ `M23-05` の判定を書き直していない ／ `VAL-C02` / `VAL-S04` を
変えていない ／ 人が読める文字列は既存の `ComboRef` / `SetupRef` で足りた ／
**サーバへ「確認済み」フラグを送っていない**（抑制は画面側のみ）。

### 10.1 §9.2 の範囲で推測して進めた事項（**5 件・明示**）

| # | 推測 | 内容と理由 |
|---|---|---|
| 1 | **応答のキー名** | `deletedDuplicates`（生きた側 `duplicates` は不変）。§9.2 で裁量が認められている範囲 |
| 2 | **セットプレイ側の経路名** | `POST /api/combos/:comboId/setups/check-duplicate`（コンボ側の実経路に倣った） |
| 3 | **★仮登録ではダイアログを出さない** | **推測: 指示書は仮登録の扱いを明示していないため、`VAL-C14` の先例に揃えると仮定した。** `VAL-C14` / `VAL-S07` は仮登録では走らない（`DES-006` §2.3・`CHANGE-125`）。出すと「保存後には出ない警告が保存前だけ出る」非対称になる。既存のリアルタイム警告も `enabled: !isDraft` である。**コード内コメントにも明示し、専用テストを置いた** |
| 4 | **`MaxDuplicateRefsInDetails` の上限を適用しない** | **推測: 上限（5 件）は警告 `details` 専用と仮定した。** `DES-002` §4.3 規則 1 が `totalCount` を「切った場合」に限っており、ダイアログは「該当が複数のとき選ばせる」（§4.3-2）ため全件が要る |
| 5 | **該当複数のときの見せ方 ／ 復元後の遷移** | ラジオ一覧・既定選択なし ／ 詳細画面へ（指示書 §11 の暫定案どおり）。**★セットプレイの「詳細」は親コンボ詳細 `/combos/{comboId}` である**——`/setups/:id` は編集画面であり §1.4-8 が禁じている。登録成功時と同じ遷移先で、新しい規則を作っていない |

**★あわせて 1 件**: 復元を選んだときの**復元警告トースト**（`VAL-R01` / `VAL-R03` / `VAL-R04` / `VAL-C08` 等）
は既存の復元導線 4 か所と同じ形で出す——`formatRestoreWarnings` を通し、警告があれば
`trash.warning.restoredWithWarnings` に畳み、0 件なら `trash.warning.restored` を出す。
§4.5 の抑制対象は「保存後トースト」だけであり、復元の警告は別物である。

> **★是正の経緯（レビュー 高-3）**。初版はこの 2 か所だけが `restored.warnings` を捨てており、
> 記述（「既存どおり出す」）と実装が食い違っていた。**このダイアログ経路では `VAL-R03` /> `VAL-R04` が実際に起きうる**——応答の `duplicates`（生きた側）が非空のまま復元すれば> 必ず発火する。**⇒ 握り潰すと、利用者は「重複が並んだこと」を知る手段を失う。**
> 取り込みで実装を既存 4 か所へ揃え、両画面へ回帰テストを 2 本ずつ足した。

---

## 11. 指示書 §5.1 / §5.2 とテストの対照

| 指示書 | テスト |
|---|---|
| §5.1-1 削除済みの一致を返す | `TestCheckDuplicate_ReturnsDeletedMatch` |
| §5.1-2 生きた側と削除済み側が別のキー | `TestCheckDuplicate_SeparatesAliveAndDeleted` ／ `TestCheckSetupDuplicate_SeparatesAliveAndDeleted` ／ ハンドラ 2 本 |
| §5.1-3 母集団が VAL-C14 と一致（旧行・仮登録を返さない） | `..._ExcludesSupersededOldRow` ／ `..._ExcludesDraftRows` ／ `..._ExcludesAliveRows`（破壊確認 1 の受け皿）／ `..._NotFiredWhenRecipeDiffers` |
| §5.1-4 既存の応答のキーと意味が不変 | `TestCheckDuplicate_AliveSide_StillExcludesDeleted` ／ `..._ExcludeComboID_StillAppliesToAliveSide` ／ `TestHandler_CheckDuplicate_SeparatesAliveAndDeleted`（既存キー 8 項の存在を主張）／ 既存 `TestHandler_CheckDuplicate_*` が無改変で緑 |
| §5.1-5 セットプレイの削除済み一致 | `TestCheckSetupDuplicate_ReturnsDeletedMatch` |
| §5.1-6 別の親コンボを返さない | `TestCheckSetupDuplicate_ExcludesOtherParentCombo` |
| §5.1-7 人が読める文字列 | `..._CarriesHumanReadableMemo`（削除済み側・生きた側の 2 本）／ `..._CarriesHumanReadableName` ／ ハンドラ 2 本 |
| §5.2-1 ダイアログが出る | `§5.2-1 削除済みの一致が在るとき…`（両画面） |
| §5.2-2 生きた重複だけでは出ない | `§5.2-2 生きた重複だけのときは…`（両画面） |
| §5.2-3 一致 0 で出ない | `§5.2-3 一致が無いときは…`（両画面） |
| **§5.2-4 押す前に入力が失われることが書かれている** | **`§5.2-4 「復元する」を押す前に…`（両画面）＋ `PreSaveDuplicateDialog.test.tsx`。★実 `ja.json` の文面そのものを `toBe` で主張** |
| §5.2-5 復元 API のみ | `§5.2-5 「復元する」で…`（両画面） |
| §5.2-6 登録 API のみ | `§5.2-6 「新しく作る」で…`（両画面） |
| §5.2-7 キャンセルで入力保持 | `§5.2-7 キャンセルで入力内容が失われない`（両画面） |
| **§5.2-8 「新しく作る」後にトーストが出ない** | `§5.2-8 …`（両画面） |
| **§5.2-9 ダイアログ無しならトーストが出る** | `§5.2-9 …`（両画面）＋ `抑制は 1 回きりである` ＋ `チェックが失敗して保存したときも…` ＋ `抑制するのは VAL-C14 / VAL-S07 だけである` |
| §5.2-10 チェック失敗でも保存が止まらない | `§5.2-10 …`（両画面） |
| §5.2-11 複数から選べる | `§5.2-11 該当が複数のとき…`（両画面）＋ `PreSaveDuplicateDialog.test.tsx` |
| §5.2-12 二重押下不可 | `§5.2-12 ダイアログ表示中は保存ボタンを二重に押せない`（両画面）＋ 部品の `busy` テスト |
| §5.4 E2E 2 本 | `m23-09-pre-save-duplicate-dialog.spec.ts`（**4 本**。誤検知の対照を 1 本 ＋ **セットプレイ側を 1 本**足した） |

**★指示書が求めていない追加のテスト 4 種**（先行レビューが「回帰ガードを持たない」と指摘した点を潰した）:
復元失敗でダイアログが閉じないこと（両画面）／ 未知コードは抑制されないこと（両画面）／
名前が空の行も選択肢に出ること（両画面 ＋ 単体）／ **状況が空でもチェックを叩くこと**（§12.3-4）。

---

## 12. 設計卓へ回すもの・次サブへの申し送り

### 12.1 `CHANGE-141` の反映に要る逐語（**本報告の §5 / §6**）

- `DES-002` §4.2 → **保存前チェック 2 経路**（§5.1 / §5.2 / §5.3 / §5.4 / §5.5）。
  **★既存の `check-duplicate` が未掲載であることも併せて是正が要る**（§1-#5 ＝ 走査ヒット **0 件**）。
- `DES-005` → **ダイアログの規律と文面**（§6）。**★§5.15 の「既知の限界」ブロック**
  （「警告は保存の成功後に出るため、利用者は重複を作ったあとでしか気づけない」）**は本サブで解消したため、改訂対象である。**
- `DES-006` §11 → **「警告の表示」と「操作の分岐」の区別**（先例＝`VAL-N02`）。

**★あわせて設計卓へ回すもの 2 件**（レビュー 中-4 / 中-5）:

- **`followup-backlog.md` の `save-time-duplicate-choice-missing` は本サブで解消した。**
  同項目は現在も「★起票済・投入待ち」のままである。**★製造が直接書けるのは §J だけなので（D-382）本サブでは編集していない。⇒ 設計卓が畳むこと。** 放置すると `M23-CLOSE` の棚卸しに「投入待ち」として残る。
- **リアルタイム重複検知の経路にゴミ箱側のクエリが 2 本乗った**（**★実測すべき点**）。
  `useCheckDuplicate` は同じ `POST /api/combos/check-duplicate` を **300ms debounce で入力のたびに**叩いており、本サブ以降その 1 回ごとに `FindDeletedByDuplicateKey` ＋`FindStepsForCombos`（バルク）が追加で走る。**★指示書 §4.1-1 が「既存の経路を広げる」と明示しており、§4.1-4 が「安い」と judged しているため指示どおりの帰結である**（バルク取得でN+1 にもなっていない）。**ただし画面はリアルタイム経路では削除済み側を読み捨てており、追加コストは純粋に無駄である。** 将来「要求ボディで削除済み側の要否を切る／専用経路に分ける」を判断するときの入力として記録する。
- **CSV 取込（`internal/service/comboio/import.go`）も同経路を 1 行につき 1 回呼ぶ。**
  同じ理由で削除済み側の走査が乗るが、こちらも結果は使われない。

### 12.2 ★既存の振る舞いが変わった 3 点（**欠陥ではない。意図である**）

1. **`POST /api/combos` / `.../setups` の成功後に VAL-C14 / VAL-S07 のトーストが出なくなる場合がある**
   ——「ダイアログを出したうえで『新しく作る』を選んだとき」だけである（§4.5・チェックリスト N-5）。
   **サーバの契約は不変で、`warnings` は従来どおり載って来る。抑制は画面側のみ。**
   **★落とすのは `VAL-C14` / `VAL-S07` の 2 コードだけであり、未知のコードは出し続ける**
   （`saveWarnings.ts` 自身の「未知のコードでも黙って消さない」方針と衝突させない）。
2. **`internal/api/setup/check_duplicate_handler.go` に 404 分岐を持たせていない。**
   存在しない `comboId` は `200` ＋ 空配列で返る。**★「返らない 404」を残さないための判断である。**
3. **`web/e2e/m23-05-duplicate-collision.spec.ts` を更新した**——登録側の衝突が出る場所がトーストから
   保存前ダイアログへ移ったため。**★同 spec の主張（登録が落ちない／復元が落ちない／VAL-R03 が出る）は 1 つも落としていない。** spec 内に「これを『警告が消えた』と読んで直さないこと」を書き残してある。

### 12.3 次のサブが踏みそうな点（**6 件**）

1. **E2E の判定キーは spec ごとに分けること。** playwright は `fullyParallel: false` でも
   **ファイル単位では並行**に走り、DB を 1 本共有する。`m23-05` と同じ「ryu + 弱パンチ 1 手」で作ると、
   **片方がゴミ箱へ入れた行がもう片方の「ゴミ箱に同じものが無ければ〜」を壊す**（先行担当が実測）。
   **`afterEach` の後片付けでは足りない**——並行実行中は「まだ消していない時間」が必ず在る。
   ⇒ `m23-09` は「中パンチ + 強パンチ」の 2 手にしてある。
2. **「新しいコンボが作られていない」を一覧の件数で判定しないこと。** `/api/combos` の一覧は
   ページングされるため、1 件増えても総数が変わらないことがある。
   ⇒ **登録要求（`POST /api/combos`）の発生回数**を見る形にしてある。
3. **抑制フラグを `useState` で持たないこと。** 「新しく作る」の押下は `setState` と `runCreate` を
   同じイベントハンドラで行うため、**state だと `runCreate` が捉えるのは更新前の値**になり抑制が効かない。
   ⇒ **引数で渡す形**にしてある。**★型検査も lint も緑のまま通る型の欠陥である。**
4. **★★リアルタイム検知の門（`isFormReadyForDuplicateCheck`）を保存時の条件に流用しないこと。**
   同関数は状況 4 項がすべて埋まっていることを要求するが、**あれは「入力のたびに叩く」検知が未完成のフォームで API を打たないための門であり、判定の条件ではない。**
   **流用すると、状況を空のまま保存したコンボでダイアログが出ないのに `VAL-C14` だけが保存後に出る**
   （NULL 同士は一致するため）——**保存前と保存後で見えるものがずれる。**
   ⇒ 保存前チェック専用の入力（`buildCheckDuplicateInput`）を別に組み、専用テストを置いた。
   **★実装当初これを流用しており、E2E を書く段で気づいた。単体テストでは検出できていなかった。**
5. **保存経路へ非同期の一段を挟むと、押下直後に同期でアサートしている既存テストが落ちる。**
   `ComboEditor.test.tsx` の 5 本が該当した（`waitFor` で待つ形へ改めた。**主張は 1 つも変えていない**）。
   **★全ファイル同時実行で初めて出るのではなく、当該ファイル単体でも出る**——
   新規テストだけを回して緑を確認した段階では見えない。**⇒ 既存ファイルも必ず回すこと。**
6. **★フロントテストはサーバの SQL 変更を原理的に検出できない**（§7 の破壊確認 1）。
   応答を stub するためである。**この継ぎ目を持つのは E2E だけである。**
   ⇒ 「母集団のずれ」を守らせたい指示書は、フロント側に受け皿を求めないこと。

### 12.4 ■ 併せて更新が要るもの

**該当なし（4 項目とも「なし」）。** 実査値を添える（教訓 `E-114` ／ ボード **D-277**・**D-297**）。

| 項目 | 実査 | 結果 |
|---|---|---|
| **消費した CHANGE 番号を registry へ登録したか** | `CHANGE-141` は**設計卓が 2026-08-23 に起票登録済み**（`change-number-registry.md` §1 の `141`〜`143` 行＝**D-520**） | **なし。製造は CHANGE を 1 本も消費していない** |
| **「次の番号」の写し先を全数直したか** | 払い出していないため写し先の更新対象が無い | **なし** |
| **消費したマイグレ連番** | `ls migrations/*.up.sql \| wc -l` = **78**（disk 末尾 `000078_add_combos_superseded_by`）。**着手前後で不変** | **なし。消費 0 本** |
| **版を上げた文書の参照元** | **版を上げた文書が無い**（`docs/design/` の差分 0＝§9）。⇒ 版数を写している箇所の追随も不要 | **なし** |

### 12.5 `followup-backlog.md` §J へ書いた項目

**0 件。** 再レビューの往復上限に達しておらず、未解消のまま停止した項目が無いため。

**★本節はレビュー完了後に更新する**（`M23-04` 教訓 3）。

---

---

## 13. レビュー指摘の取り込み結果（自動トリアージ）

**レビュー報告書**: `docs/progress/m23-09-review.md`（**重大 0 件 ／ 高 4 件 ／ 中 5 件 ／ 低 3 件**）
**採否**: **高 4/4 採用 ／ 中 5/5 採用 ／ 低 2/3 採用（残 1 は確認結果で対応不要）。**
**★「高」指摘の不採用は 0 件＝開発者エスカレーションの発火なし。** 往復 1 回で完了。

| # | 優先度 | 指摘 | 採否 | 対応 / 理由 |
|---|---|---|---|---|
| 高-1 | 高 | `progress-log.md` へ索引行が無い ＋ 完了報告 §8 が検査を「緑」と誤記 | **採用** | 索引行を追記し、§8 の欄を実測どおりへ是正した。**★これは `E-125`（終了コードだけを根拠にしない）に反する私の記述であり、指摘のとおりである。** |
| 高-2 | 高 | `check_duplicate_handler.go` の godoc が旧のまま | **採用** | as-built へ是正（生きた側と削除済み側の 2 つを返すこと・母集団の対応を明記）。 |
| 高-3 | 高 | 新設した復元経路 2 か所だけが復元警告を握り潰す ＋ 完了報告の記述と不一致 | **採用** | 既存 4 か所と同じ形（`formatRestoreWarnings` ／ `restoredWithWarnings` ／ 0 件なら `restored`）へ揃え、**両画面へ回帰テストを 2 本ずつ**足した。§10 の記述も是正。**★本サブで唯一の機能欠陥であり、指摘が無ければ `CHANGE-141` へ誤った as-built が写っていた。** |
| 高-4 | 高 | `saveWarnings.unit.test.ts` の送り先コメントが失効 | **採用** | 「送り先は M23-09」「実装を変えられない以上」を、ダイアログ実装済み・**本ガードは保存後トーストの文面に対して生き続ける**旨へ書き換えた。**★`it.each` の 2 主張には触れていない**（12 本 green を実測）。 |
| 中-1 | 中 | ダイアログ表示中に保存ボタンが「保存中...」と表示する | **採用** | `isSavingNow`（ラベル用）と `isMutating`（disabled 用）に分け、`SetupEditorPage` の作法へ揃えた。**★§5.2-12 のテストが「保存中...」を期待していた＝バグを固定していたため、テストも是正した**（「押せない」かつ「保存中...と表示しない」を主張する形へ）。 |
| 中-2 | 中 | `restoreCaution` が `aria-describedby` の対象外 | **採用** | `AlertDialogContent` へ `aria-describedby` を明示し caution の id を含めた。**表示位置は変えていない。** 専用テストを 1 本追加。**★最重要ゲートが視覚利用者にしか成立していなかった。** |
| 中-3 | 中 | 無関係な prettier 整形差分が混入 | **採用** | 空白無視で同一になるハンク 22 件・約 87 行を機械的に復元（§9 の注記参照）。 |
| 中-4 | 中 | 解消した followup が申し送りに無い | **採用** | §12.1 へ「`save-time-duplicate-choice-missing` は解消済み・設計卓が畳むこと」を追記。**★§J 以外は製造が直接編集しない**（D-382）。 |
| 中-5 | 中 | リアルタイム経路 ／ CSV 取込に追加クエリが乗った | **採用** | §12.1 へ「実測すべき点」として記録。**★指示書 §4.1-1 / §4.1-4 が求めた形であり実装は変えない。** |
| 低-1 | 低 | 要求型の置き場が割れている ／ `modifiers` が `unknown` | **採用** | `CheckSetupDuplicateRequest` を `features/setup/types.ts` へ移し、`modifiers` を既存 `Modifiers` 型にした。 |
| 低-2 | 低 | 生きた重複が同居するとき「新しく作る」は必ず落ちる | **採用（記録のみ）** | §4.1-4 の範囲内で本サブでは直さない。`progress-log` の横断課題へ次サブの検討材料として残した。 |
| 低-3 | 低 | E2E の判定キー衝突は現時点で回避できている（確認結果） | **対応不要** | 指摘ではなく確認結果。**★「他 spec が保存しないこと」に依存する安全性である**点は §12.3-1 の申し送りに既に含まれている。 |

---

---

## 14. 追補: セットプレイ側を E2E で通した（レビュー後に見つけた穴）

**★レビュー完了後、「開発者がやるべき手動確認はあるか」を洗い出す過程で見つけた。**

**穴の内容**: **セットプレイ側の保存前ダイアログが E2E を 1 度も通っていなかった。**

```
$ grep -rn "setups/check-duplicate" web/e2e/ | wc -l
0
```

| 面 | サーバ | 単体・コンポーネント | E2E（追補前） |
|---|---|---|---|
| コンボ側 | 9 本 | 20 本 | 3 本 |
| **セットプレイ側** | **13 本** | **18 本** | **★0 本** |

**★指示書 §5.4 の違反ではない**——同節が挙げる E2E 2 本はどちらも「コンボを削除 → 同じものを
新規登録」というコンボ側の文言であり、契約としては満たしている。
**しかし実態として、セットプレイ側は「サーバの応答」と「部品の描画」を別々に検証しただけで、画面 → API → DB を貫いた経路が 1 度も通っていなかった。**

**★★これは本サブがいちばん警戒すべき型の穴である。** `M23-05` の失敗は実機で初めて見つかり、
本サブの `isFormReadyForDuplicateCheck` の流用（§12.3-4）も **E2E を書く段で初めて気づいた**。
**単体テストは stub の上で緑になるため、「経路が繋がっていないこと」を構造的に検出できない。**

**対応**: `m23-09-pre-save-duplicate-dialog.spec.ts` へ 1 本追加した
（親コンボとセットプレイを API で作る → 削除 → **画面から**同じレシピで登録しようとする →
ダイアログ → 「復元する」→ 復元され、**セットプレイの登録 API は 0 回**）。
UI 操作は `m19-07-setup-conditions.spec.ts:82-96`（UI でセットプレイを作る唯一の先例）に揃えた。

**★判定キーの衝突対策は要らない**——セットプレイの重複判定は同一親コンボ配下に閉じており
（`VAL-S04` / `VAL-S07` とも `combo_setups` で絞る）、テストごとに親コンボを新規作成するため
**他 spec と構造的に衝突しない**。§12.3-1 の申し送りはコンボ側だけに当たる（この非対称を spec 内へ明記）。

**★空振りしていないことの確認**（破壊確認と同じ作法）:

```
壊し方: SetupEditorPage の handleTrashRestore を「復元せず runCreate する」へ差し替え

$ PW_EXECUTABLE_PATH=/opt/pw-browsers/chromium pnpm exec playwright test e2e/m23-09-...spec.ts
  ✓  1 削除 → 同じものを登録しようとする → ダイアログ → 「復元する」…（コンボ）
  ✓  2 同じ流れで「新しく作る」を選ぶ…（コンボ）
  ✘  3 セットプレイ: 削除 → 同じレシピで登録しようとする → ダイアログ → 「復元する」…
       Error: ★「復元する」を選んだのにセットプレイの登録 API が叩かれている
       Expected: 0 / Received: 1
  ✓  5 ゴミ箱に同じものが無ければ、ダイアログは出ない
  1 failed / 3 passed

復旧確認:
$ git diff --stat web/src/pages/SetupEditorPage.tsx  →（出力なし）
$ （同コマンド再実行）                                 → 4 passed
```

**★★狙ったテストだけが赤くなり、他 3 本は緑のままである**（壊したのはセットプレイ側だけなので
正しい挙動）。**⇒ 新規 1 本は空振りしていない。**

> **★手順上の反省**: 最初の破壊確認は `pnpm exec playwright test <file>` を素で叩いたため、
> **4 本すべてが赤くなった**。原因は破壊ではなく `PW_EXECUTABLE_PATH` 未設定によるブラウザ起動失敗
> （`make e2e` が設定している）であり、**破壊確認としては何も証明していなかった**。
> **⇒ spec 単体を回すときは `PW_EXECUTABLE_PATH=/opt/pw-browsers/chromium` を付けること。**
> **★「赤くなった」だけでは破壊確認にならない。赤くなった理由を読むこと。**

## 15. 開発者による実機の手動確認（**3 件・すべて OK**）

**★§14 で「E2E では代替できない」と残した 3 点の決着である**（2026-08-24）。

| # | 確認事項 | 何が判定できないのでコードに委ねられないか | 結果 |
|---|---|---|---|
| 1 | **ダイアログの一文が実機で本当に読めるか**（`DES-006` §11.2 の 3 点目） | コードで判定できるのは「常時描画されている」までである。**折り返し・モーダル高さ・復元ボタンとの距離**は実機でしか分からない。**★`M23-05` はまさにこの型で失敗した** | **OK** |
| 2 | **スクリーンリーダーでの読み上げ順** | `aria-describedby` に `restoreCaution` の id を含めたことはテストで主張しているが（レビュー 中-2）、**実際の読み上げ順**は実機でしか判定できない | **OK** |
| 3 | **文面そのものの納得感** | §3 の対応表は「その行動が実装に在るか」まで検証しているが、**言い回しの是非は開発者の判断領域**である | **OK** |

**⇒ §6 の文面を `DES-005` へ写してよい**（設計伝達レポート §1-4）。**★とくに `restoreCaution`（「復元すると、いま入力した内容は保存されません。」）が実機で読めることが確認された**ため、`DES-005` §5.15 の「既知の限界」ブロックの撤去は根拠を持つ。

---

---

*以上、M23-09 完了報告。告げる場所を「保存の後」から「保存の前」へ移した。出したすべての文言について、
それを読んだ利用者が次に取れる行動が実装に在ることを §3 で確かめてある。*
