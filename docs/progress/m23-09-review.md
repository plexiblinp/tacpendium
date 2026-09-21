# M23-09 レビュー報告書

| 項目 | 内容 |
|---|---|
| 対象作業 | **M23-09**（登録前の重複ダイアログ） |
| 対象指示書 | `docs/instructions/M23-09-pre-save-duplicate-dialog.md` **v1.1.0** |
| チェックリスト | `docs/instructions/reviews/M23-09-review-checklist.md` **v1.0.1** |
| 対象差分 | `git diff 67bdc32..HEAD`（2 commit / 33 ファイル） |
| レビュー実施日 | 2026-08-23 |
| 判定 | **重大 0 件 ／ 高 4 件 ／ 中 5 件 ／ 低 3 件** |

**★本レビューで実際に回したもの**（結果は §「実測」に記載）:
`go test ./internal/... -count=1` ／ `pnpm exec vitest run`（M23-09 の 4 本 ＋ `saveWarnings.unit.test.ts` ＋ `ComboEditor.test.tsx`）／
`pnpm exec tsc --noEmit` ／ `pnpm exec prettier --check` ／
`check-artifact-integrity.sh` ／ `check-progress-log-index.sh` ／ `check-enum-sync.sh` ／
`check-browser-storage-keys.sh` ／ `check-doc-refs.sh` ／ `check-md-emphasis.sh` ／
`check-stop-discipline.sh` ／ `check-doc-inventory.sh`。**`make e2e` は回していない**（3 分以上・必須外）。

---

## 総評

**本サブは目的を達成している。** `M23-05` が「保存後のトースト」で果たそうとして構造的に果たせなかったものを、保存前のダイアログへ正しく移した。最重要ゲート（「復元する」を押す**前**に入力が保存されないことが書かれている）は、実 `ja.json` を引くコンポーネントテスト・両画面テスト・E2E の 3 層で守られており、`§4.9` の文言と行動の対応表も「並べただけ」ではなく実装位置まで指している。母集団を `findDeletedDuplicateRefsByKey` の 1 本に寄せ、破壊確認 1 で `VAL-C14` のテストが 5 本まとめて赤くなる形にしたのは、指示書が求めた以上の構造的な担保である。

一方で、**実装が変わったのに記述が旧のまま残っている型の欠けが 3 か所ある**（高-2 / 高-3 / 高-4）。いずれもテスト・lint・型検査が緑のまま通り、人が読む以外に見つける経路が無い。さらに**指示書 §7.4 が必須とした `progress-log.md` への索引行が 1 行も無く、完了報告 §8 はその検査を「緑」と記載している**（高-1）。動作品質は高いが、記述の整合はレビュー前の自己確認で落ちている。

機能面で 1 件、**新設した復元経路だけが復元警告（`VAL-R01` / `VAL-R03` / `VAL-C08` 等）を握り潰している**（高-3）。既存の復元呼び出し元 4 か所はすべて `formatRestoreWarnings` を通しており、本サブの 2 か所だけが例外になっている。

---

## 設計準拠性レビュー結果

| # | 観点（チェックリスト §1〜§8） | 評価 | 所見 |
|---|---|---|---|
| 1-1 | **★★「復元する」を押す前に入力が失われることが画面に書かれている**（§4.4） | **◎** | `PreSaveDuplicateDialog.tsx` が `restoreCaution` を復元ボタンの直上に**常時**描画。`restoreFailed` のような条件付きではない。ja/en とも文面が「押した後の通知」になっていない。ただし読み上げ経路に穴がある（中-2） |
| 1-2 | **★★§4.9 の文言と行動の対応表が完了報告に在る** | **◎** | 完了報告 §3 に 11 行。各行が「次に取れる行動」→「実装位置」まで書いており、#6（`restoreCaution`）・#8（`createNewCaution`）・#10（`restoreFailed`）は否定側（実装は本当に入力を保存しない／ゴミ箱の行に触らない／ダイアログを閉じない）まで押さえている |
| 1-3 | 保存ボタン押下で出る。入力中には出ない（§4.2-1） | **◎** | `checkComboTrashDuplicates` / `checkSetupTrashDuplicates` は命令的関数。`useCheckDuplicate`（debounce 付き）を流用していない。両画面に「押下前 0 回・押下後 1 回」のテストが在る |
| 1-4 | 選択肢が「復元する」「新しく作る」＋キャンセルの 3 つ。「両方入れる」が無い（§4.3-1） | **◎** | 部品テストと E2E の両方で `not.toContain("両方")` を主張 |
| 1-5 | どれが該当したのかが人が読める文字列で見える（§4.1-3） | **◎** | サーバは `model.ComboRef{id,memo}` / `model.SetupRef{id,name}` を返し（新形を作っていない＝D-417）、画面は空名を `unnamedCombo` / `unnamedSetup` へ倒す。**空名の行を落とさない**ことに専用テストが在る（落とすと復元不能になる） |
| 1-6 | 複数のとき選べる。「1 件目を復元」になっていない（§4.3-2） | **◎** | 複数時は既定選択なしのラジオ。選ぶまで復元ボタンが `disabled`。部品・両画面の 3 か所で主張 |
| 1-7 | `M23-05` の判定処理を呼んでいる。書き直していない（§2.2 / §3.3-1） | **◎** | コンボは `findDeletedDuplicateRefsByKey` を `VAL-C14` と**共有**（分岐した写しではない）。セットプレイの削除済み側は `FindDeletedDuplicateRefsInCombo`（`VAL-S07` が呼ぶ関数そのもの）。`internal/service/setup/validate.go` 差分 0 を確認 |
| 1-8 | 母集団が `VAL-C14` / `VAL-S07` と一致（§4.1） | **◎** | 実コードで確認。削除済み側＝`is_draft = 0` ＋ `deleted_at IS NOT NULL` ＋ `superseded_by_combo_id IS NULL` ＋ キー 6 項 → `CalcRecipeHash`。セットプレイ生存側の新設 `FindLiveDuplicateRefsInCombo` は `duplicateRefsInCombo` 経由で、`FindDuplicateInCombo`（`VAL-S04`）と述語が一致していることを SQL で確認した |
| 1-9 | 生きた側と削除済み側が別のキー（§4.1-1） | **◎** | `duplicates` / `deletedDuplicates`。0 件でも空配列（`omitempty` にしていない）。サーバ・DTO・フロント型の 3 層に理由がコメントで残っている |
| 1-10 | 保存前チェックが失敗しても保存が止まらない（§4.2-3） | **◎** | `PreSaveDuplicateCheck` を判別共用体にして**例外を投げない型**に落としてある。呼び出し側の try/catch 忘れが原理的に起きない。両画面にテスト |
| 1-11 | 「新しく作る」後にトーストが出ない／出さなかった場合は出る（§4.5-2） | **◎** | `dropAcknowledgedTrashDuplicates` が落とすのは `VAL-C14` / `VAL-S07` の 2 コードだけ。未知コードは出し続ける専用テストが在る。抑制は引数渡しで **1 回きり**（その専用テストも在る） |
| 1-12 | サーバへ「確認済み」フラグを送っていない（§4.5-1） | **◎** | `buildCreatePayload` 差分 0。抑制は画面側のみ |
| 2-x | **契約の不変**（スキーマ / 既存キー / 登録応答 / `VAL-C02`・`VAL-S04` / 復元 API） | **○** | `migrations/` 差分 0（78 本のまま）。`handler.go` 2 本の差分 0。既存キーは名前も意味も不変で `memo` の追加のみ。**ただし `check_duplicate_handler.go` の godoc だけが旧の主張のまま残っている**（高-2） |
| 3-1 | キャンセルで入力が失われない（§4.6-2） | **◎** | `handleTrashCancel` は候補配列と失敗フラグを空にするだけ。テストが「打った文字が残ること」を実際に観測している |
| 3-2 | ダイアログ表示中に保存ボタンを二重に押せない（§4.6-1 / §4.6-3） | **○** | `useRef` の再入ガード ＋ `checkingTrash` / `trashCandidates.length > 0` を `isMutating` / `saveDisabled` へ算入 ＋ ダイアログの `busy`。3 段で塞いである。**ただしその副作用でボタンのラベルが嘘になる**（中-1） |
| 3-3 | 文面が翻訳キー経由。ja / en 両方 | **◎** | `trash.preSaveDuplicate.*` 10 キー ＋ `trash.warning.unnamedSetup`。ja/en とも追加のみ・既存文面の書き換え 0 |
| 3-4 | `M23-05` の回帰ガードが消えていない | **○** | `saveWarnings.unit.test.ts` の差分 0（実測）。文面も不変。**ただし同ファイルのコメントが失効している**（高-4） |
| 3-5 | 文面が「失敗」「エラー」と読めない（`DES-006` §11.2） | **◎** | ダイアログ本文に両語を含まないことをテストで主張。`restoreFailed`（復元が実際に落ちたとき）は対象外で妥当 |
| 4-x | **テストの妥当性** | **◎** | サーバ 7 件・フロント 12 件が §11 の対照表どおり全数対応。§5.2-4 / §5.2-9 / 誤検知側 4 件すべて実在。破壊確認 2 件はコマンドと出力付き。フロントは実 `ja.json` を引く `t`（キー返しモックではない）。E2E は 3 本（誤検知の対照を 1 本追加） |
| 5-x | **設計意図との整合** | **◎** | 否定形確認 3 件が理由付きで在る。「重複が在ること」を失敗として扱っていない。入力を保持したまま選択させている |
| 6-x | **コード品質・規約** | **○** | JSON タグ camelCase ／ `any` 0 件 ／ `console.log` `fmt.Println` 0 件（`console.warn` は `browser-storage.ts` 等の既存作法）／ 未処理の `TODO` 0 件。**整形差分の混入あり**（中-3） |
| 7-x | **既存挙動の温存** | **◎** | `go test ./internal/...` 全パッケージ ok（実測・FAIL 0）。`tsc --noEmit` 緑（実測）。ゴミ箱画面 3 ファイル差分 0。`m23-05` spec の追随は主張を 1 つも落としていない（「登録が落ちない／復元が落ちない／`VAL-R03` が出る」は保持、トーストの主張だけが「二重に告げない」の否定主張へ移った） |
| 8-x | **ドキュメント・進捗ログ** | **×** | **`progress-log.md` に索引行が 1 行も無い**（高-1）。完了報告 §7.5 の 8 点は揃っており、応答の逐語形（§5）・文面の逐語（§6）も `CHANGE-141` へ写せる形で在る。`docs/design/` 差分 0 |

---

## 設計準拠性以外の指摘事項

### 高-1（**必須成果物の欠落 ＋ 完了報告の検査結果の誤り**）

**`docs/progress/progress-log.md` に `M23-09` の索引行が 1 行も無い。**

```
$ grep -ni "m23-09" docs/progress/progress-log.md
（出力なし）

$ bash scripts/check-progress-log-index.sh
NG  作業 ID `m23-09` が docs/progress/progress-log.md に現れない(完了報告: docs/progress/m23-09-completion-report.md)
結果: 違反 1 件
```

指示書 §7.4 と `CLAUDE.md` §8（「サブ完了時の追記は**必須**」）に対する欠落である。
**さらに完了報告 §8 の検査表は `bash scripts/check-progress-log-index.sh` を「緑（§10 の追記後に実行）」と記載しているが、実測は上記のとおり NG 1 件である。** 終了コードだけでなく出力を貼る規律（`E-125`）が、この 1 行で破れている。

**★本件は「検査が偽陽性で緑を返す」既知の横断課題（followup `check-progress-log-index-false-green`。`M23-05` / `M23-06` で 2 サブ連続）とは逆向きである。** 今回は検査が正しく欠落を検出しており、報告のほうが実態と食い違っている。**⇒ 「検査は当てにならない」を理由に読み飛ばせる状況ではない。**

`M23-04` 教訓 3 に従い、レビュー結果を参照する箇所はプレースホルダで置いてよいが、**行そのものは存在しなければならない**。

### 高-2（**撤回済みの記述がコード上に残っている**）

`internal/api/combo/check_duplicate_handler.go:13-14`

```go
// CheckDuplicate は POST /api/combos/check-duplicate のハンドラ(M2-02)。
// コンボ保存前に入力内容が既存の本登録コンボと重複するかを判定して返す。
```

**本サブで同経路は「削除済み（ゴミ箱）の一致」も返すようになった。** 「既存の本登録コンボと重複するか」はもはや応答の全体を説明していない。

同じ経路の他の 3 か所（`dto.go` の `CheckDuplicateResponse` / `DuplicateInfoResponse`、`service.go` の `CheckDuplicate`）は as-built へ丁寧に更新されており、**ハンドラの godoc だけが取り残されている**。読む人がまず開くのがハンドラであるため、影響は小さくない。

> 優先度較正について: 本件は動作が正しいまま記述だけが旧になる型であり、テストも lint も `tsc` も緑で通る。人が読む以外に見つける経路が無く、後任は本文をコピーして注記を読まない。**⇒ 本プロジェクトでは「高」として扱う。**

### 高-3（**新設した復元経路だけが復元警告を握り潰している ／ 完了報告の記述と実装の不一致**）

`web/src/features/combo/components/ComboEditor.tsx` の `handleTrashRestore`

```ts
restoreMut.mutate(id, {
  onSuccess: (restored) => {
    setTrashCandidates([]);
    toast.success(t("trash.warning.restored"));
    navigate(`/combos/${restored.id ?? id}`);
  },
```

`web/src/pages/SetupEditorPage.tsx` の `handleTrashRestore` も同型（`onSuccess: () => {...}` で応答を受け取ってすらいない）。

**既存の復元呼び出し元は 4 か所あり、すべて応答の `warnings` を `formatRestoreWarnings` へ通して `trash.warning.restoredWithWarnings` を出す。**

- `web/src/features/combo/components/TrashListRow.tsx:50-59`
- `web/src/features/setup/components/TrashSetupListRow.tsx:84-92`
- `web/src/pages/TrashComboDetailPage.tsx:54-61`
- `web/src/features/combo/components/TrashBulkActions.tsx`

**本サブが足した 2 か所だけが `restored.warnings` を捨てている。**
`useRestoreCombo` / `useRestoreSetup` はいずれも応答本文を返す設計であり（`useRestoreCombo` の godoc に「呼び出し側がそれを利用者へ見せる必要がある」と明記されている）、握り潰しは意図された分業ではない。

**具体的に失われる情報**（すべて `M23-04` / `M23-05` が実装済みの WARNING）:

| コード | 発火条件 | 本ダイアログ経路で起きうるか |
|---|---|---|
| `VAL-R03` | 復元するコンボと判定キーが一致する**生きた**コンボが在る | **起きる。** 応答の `duplicates`（生きた側）が非空のとき、そのまま復元すれば必ず発火する |
| `VAL-R04` | 同一親コンボに同一レシピの生きたセットプレイが在る | **起きる**（同上） |
| `VAL-R01` | 復元するコンボに紐付くセットプレイがゴミ箱に居る | **起きる。** コンボを削除した経緯によって普通に発生する |
| `VAL-C08` / `VAL-S03` | 復元対象の技が存在しない | 起きうる |

**さらに、完了報告 §10 の末尾は次のように書いている（逐語）。**

> **★あわせて 1 件**: 復元を選んだときの**復元警告トースト**（`VAL-R03` / `VAL-R04`）は既存どおり出す。

**これは実装と一致していない。** 設計卓は本報告を `CHANGE-141` の入力として読むため、誤った as-built が設計書へ写る危険がある。

**★指示書 §2.2「復元 API を変えない」には抵触しない**——復元 API の応答は不変であり、変えるのは画面側の 1 か所である。既存 4 か所と同じ形（`warnings.length > 0` なら `restoredWithWarnings`、そうでなければ `restored`）へ揃えれば済む。

### 高-4（**失効した送り先コメントが残っている**）

`web/src/features/trash/saveWarnings.unit.test.ts:152-156`

```
// ★保存前に選ばせる導線(ダイアログ)は本サブのスコープ外である
//   (指示書 §1.4-2「重複を解消する導線」／ §4.6「モーダルにしない」)。
//   ★登録前に選ばせる導線は M23-07 では作っていない。送り先は M23-09
//   (登録前の重複ダイアログ・followup save-time-duplicate-choice-missing)である。
//   ⇒ 実装を変えられない以上、文面のほうを実装に合わせる。
```

**「送り先は M23-09」「実装を変えられない以上」は、本サブの完了によって失効した。** ダイアログは実在し、「保存前に選ばせる導線はスコープ外」も現在は真ではない。

製造は同じ理由で `saveWarnings.ts` の冒頭コメントを是正しており（完了報告 §12.2-1）、**判断の基準は正しかったが適用が片側に留まった**。テストの `expect` には一切触れずコメントだけを直せるため、チェックリスト §3「回帰ガードを消していないこと」とは衝突しない（`it.each` の 2 主張はそのまま残す）。

---

### 中-1: ダイアログ表示中に保存ボタンが「保存中...」と表示する（ComboEditor のみ）

`ComboEditor.tsx:660` で `isMutating` に `checkingTrash || trashCandidates.length > 0` を算入したのは正しい（`§4.6-1`）。しかし同じ `isMutating` が `:816` でラベルにも使われている。

```ts
{isMutating ? "保存中..." : "保存"}
```

**⇒ ダイアログが開いて利用者の選択を待っている間、背後の保存ボタンは「保存中...」と表示する。何も保存されていない。**

`SetupEditorPage.tsx` は同じ場面で `disabled={saveDisabled}` / ラベルは `{isSaving ? "保存中..." : "保存"}` と**分けており正しい**（`:404-406`）。2 画面で作法が割れている。

本サブは「文面が実装のしないことを言っていないか」を主題に置いたサブであり、この 1 語はその規律にそのまま当たる。**⇒ ComboEditor 側も「押せない条件」と「保存中の表示」を分けること**（例: `isMutating`（disabled 用）と `isSavingNow = createMut.isPending || patchMut.isPending || putMut.isPending || ...`（ラベル用））。

### 中-2: 最重要ゲートの一文がスクリーンリーダーに読まれない

`PreSaveDuplicateDialog.tsx` はラジオ群を `AlertDialogDescription` の外へ出しており、その判断自体は正しい（コメントの理由づけも妥当）。しかし **`restoreCaution` も description の外に置かれている**。

`AlertDialogContent`（Radix）はダイアログを開いた時点で `aria-describedby` が指す `AlertDialogDescription` を読み上げる。`restoreCaution` はその対象外なので、**スクリーンリーダー利用者はフォーカス移動で辿り着くまでこの一文を聞かない。** 「押す前に伝える」（§4.4）が視覚利用者にしか成立していない。

**⇒ `restoreCaution` を `AlertDialogDescription` の中へ入れる（本文と 2 段落にする）か、`AlertDialogContent` に `aria-describedby` を明示して caution の id を含める。** 表示位置（復元ボタンの直上）は変えなくてよい。

### 中-3: 無関係な prettier 整形差分が 2 ファイルに大量混入している

`ComboEditor.tsx` の差分 258 行のうち、**20 か所以上・約 80 行が整形のみのハンク**である（`punishState` の型注釈 / `setPendingCharacterId` / `situation` ×2 / `onOpenChange` ×4 / `viewTheirsHref` / `onReload` / `initialBasic` / `parsePunishHitType` / `isFormDirty` ほか）。`SetupEditorPage.tsx` も同様。

**この整形は「リポジトリ規約への正規化」ではない。**

```
$ pnpm exec prettier --check src
[warn] Code style issues found in 330 files.

$ pnpm exec prettier --check src/features/combo/components/ComboEditor.tsx
[warn] src/features/combo/components/ComboEditor.tsx      ← 変更後もまだ warn
```

`package.json` の `lint` は `tsc --noEmit` のみで prettier を含まない。**リポジトリ全体が prettier 適用済みではなく、変更後の `ComboEditor.tsx` も prettier--check を通っていない**（＝エディタの保存時整形が触れた領域だけが部分的に書き換わった形）。

実害は 2 つ。(a) レビューと `git blame` で本サブの実質変更を探すコストが上がる。(b) 完了報告 §9「既存ファイルの変更（意図のあるもののみ）」の表に整形の記載が無く、**読む人は 258 行すべてが意図のある変更だと読む。**

**⇒ 整形は本サブでは戻す（機能差分だけを残す）か、少なくとも完了報告に「整形差分が N 行含まれる」と明記すること。** リポジトリ全体を prettier 化するなら独立の改善レーンの手番である。

### 中-4: 解消した followup が完了報告の申し送りに載っていない

`docs/handover/followup-backlog.md:675` の `save-time-duplicate-choice-missing` は、状態が **「★起票済・投入待ち」** のまま残っている。本サブはこの項目そのものを解消した張本人である。

`D-382` により製造が直接書けるのは §J だけなので、**編集しなかったこと自体は正しい**。しかし完了報告 §12（設計卓へ回すもの）に「本サブで解消。設計卓が畳むこと」という候補が 1 行も無い。§12.5 は「§J へ書いた項目 0 件」としか述べていない。

**⇒ 完了報告 §12.1 か設計伝達レポート §4 へ「`save-time-duplicate-choice-missing` は解消済み。畳む候補」を明記すること。** 放置すると `M23-CLOSE` で「投入待ち」のまま棚卸しに残る。

### 中-5: リアルタイム重複検知の経路にゴミ箱側のクエリが 2 本乗った（**報告事項・製造の誤りではない**）

`web/src/features/combo/hooks/useCheckDuplicate.ts:65` は同じ `POST /api/combos/check-duplicate` を **300ms debounce で入力のたびに**叩いている。本サブ以降、その 1 回ごとに `FindDeletedByDuplicateKey` ＋ `FindStepsForCombos`（バルク）が追加で走る。

**指示書 §4.1-1 が「既存の経路を広げる」と明示しているため、これは指示どおりの帰結であり製造の判断ミスではない。** バルク取得なので N+1 にもなっていない。ただし、

- 画面は削除済み側を**リアルタイム経路では読み捨てている**（使うのは保存時の命令的経路だけ）
- したがって追加コストは純粋に無駄である

という構造が完了報告にも設計伝達にも記録されていない。**⇒ 「実測すべき点」として設計卓へ回すこと**（要求ボディで削除済み側の要否を切る／専用経路に分ける、等の選択肢が将来必要になったときの入力になる）。

---

### 低-1: 保存前チェックの要求型の置き場が割れている

`CheckSetupDuplicateResponse` は `web/src/features/setup/types.ts` に在るが、対の `CheckSetupDuplicateRequest` は `web/src/features/trash/preSaveDuplicateCheck.ts` に在る。コンボ側は要求・応答とも `features/combo/types.ts` に揃っている。**⇒ セットプレイ側も `features/setup/types.ts` へ寄せるのが素直。**

あわせて同型の `steps` が `modifiers?: unknown` になっている。`any` ではないので `CLAUDE.md` §4 には抵触しないが、既存の `Modifiers` 型が在るのに使っていないため、送信ボディの形が変わってもコンパイルが通る。

### 低-2: 生きた重複が同居するとき「新しく作る」は必ず落ちる

生きた重複と削除済み重複が同時に在る状態では、ダイアログの「新しく作る」を押すと `VAL-C02` の `400 validation_failed` で必ず失敗する。`§4.1-4`（生きた重複には手を広げない）の範囲内なので**本サブで直すべきとは考えない**が、応答の `duplicates` は取得済みで読み捨てているため、将来「新しく作るを出さない／注記を添える」判断をするときの材料はすでに手元に在る。**⇒ 次サブの入力として記録するのが妥当。**

### 低-3: E2E の判定キー衝突は現時点では回避できている（確認結果）

完了報告 §12.3-1 の懸念（`m23-05` と同じ判定キーで作ると相互に壊す）について、実際に走査した。

```
$ grep -ln "中パンチ" web/e2e/*.spec.ts
m17-03-stage2-input.spec.ts / m21-05-keyboard-input.spec.ts / m23-09-pre-save-duplicate-dialog.spec.ts
```

前 2 本は `"保存"` を 1 度も押しておらず（`grep -n '"保存"'` が 0 件）、コンボを作らない。**⇒ 現時点で `中パンチ + 強パンチ` は衝突しない。** ただしこの安全性は「他の spec が保存しないこと」に依存しており、テスト側に主張が無い。完了報告 §12.3-1 の申し送りどおり、**ゴミ箱を作る spec を足す担当は先に判定キーの一覧を確認すること**が引き続き必要である。

---

## 推奨修正（優先度別）

### 高（M23 完了前に修正必須）

1. **`docs/progress/progress-log.md` へ `M23-09` の索引行を追記する**（高-1）。あわせて**完了報告 §8 の `check-progress-log-index.sh` の欄を実測値へ是正する**——現状の「緑」は事実と異なる。追記後に再実行し、出力を貼ること（`E-125`）。
2. **`internal/api/combo/check_duplicate_handler.go` の godoc を as-built へ是正する**（高-2）。「既存の本登録コンボと重複するか」→ 生きた側と削除済み側の 2 つを返すこと（母集団は `VAL-C02` / `VAL-C14` と同一であること）を明記する。
3. **両画面の `handleTrashRestore` で復元応答の `warnings` を表示する**（高-3）。既存 4 か所と同じ形（`formatRestoreWarnings` ＋ `trash.warning.restoredWithWarnings` / 0 件なら `trash.warning.restored`）へ揃える。**あわせて完了報告 §10 末尾の「復元警告トーストは既存どおり出す」を、修正後の実装に合う記述へ直す**（設計卓が `CHANGE-141` の入力として読むため）。回帰テストを両画面に 1 本ずつ。
4. **`web/src/features/trash/saveWarnings.unit.test.ts:152-156` の失効コメントを是正する**（高-4）。「送り先は M23-09」「実装を変えられない以上」を、`M23-09` で保存前ダイアログが実装済みであること・本ガードは**保存後トーストの文面**に対する回帰ガードとして生き続けること、へ書き換える。**`it.each` の 2 主張には触れない。**

### 中（M24 着手と並行可）

5. **`ComboEditor.tsx` の保存ボタンで「押せない条件」と「保存中の表示」を分ける**（中-1）。`SetupEditorPage.tsx` の作法へ揃える。
6. **`restoreCaution` を `aria-describedby` の対象に含める**（中-2）。表示位置は変えない。
7. **`ComboEditor.tsx` / `SetupEditorPage.tsx` の整形差分を戻すか、完了報告へ明記する**（中-3）。
8. **`save-time-duplicate-choice-missing` を「解消済み・畳む候補」として完了報告 §12 か設計伝達レポート §4 へ載せる**（中-4）。**§J 以外は製造が直接編集しないこと**（`D-382`）。
9. **リアルタイム経路に乗った追加クエリを設計卓へ報告する**（中-5）。

### 低（将来対応）

10. `CheckSetupDuplicateRequest` を `features/setup/types.ts` へ移し、`modifiers` を既存 `Modifiers` 型にする（低-1）。
11. 生きた重複が同居するときの「新しく作る」の扱いを、次サブの検討材料として `progress-log` へ 1 行残す（低-2）。

---

## 良かった点

**Claude Code へのフィードバックとして残す。**

1. **★★母集団を「同じにした」のではなく「同じ 1 本にした」。** `findDeletedDuplicateRefsByKey` を `VAL-C14` と共有し、`duplicateKeyOf` を通すか入力からキーを組むかだけを入口で分けた。おかげで**破壊確認 1 で `VAL-C14` のテストが 5 本まとめて赤くなり**、共有が構造的に観測できている。「片方だけ直されて静かにずれる」型の事故を、コメントではなくコードの形で塞いだ。
2. **★★チェック結果を判別共用体（`{ok:true,...} | {ok:false}`）にして例外を投げない設計。** §4.2-3「チェックの失敗で保存を止めない」を、呼び出し側の `try/catch` 忘れが原理的に起きない形で型に落としている。規律を人の注意力ではなく型で守らせた良い例。
3. **★★抑制フラグを state ではなく引数で渡した**（両画面）。同じイベントハンドラ内で `setState` と `runCreate` を行うため state だと更新前の値を掴む、という「型検査も lint も緑のまま通る欠陥」を先回りして潰し、その理由をコード内に残している。§12.3-3 の申し送りも的確。
4. **★★誤検知・抑制しすぎの対照テストを自発的に厚くした。** 指示書が求めた §5.2-2 / §5.2-3 / §5.2-9 に加え、「未知コードは抑制されない」「抑制は 1 回きり」「チェック失敗時も出る」「復元失敗でダイアログを閉じない」「名前が空の行も選択肢に出る」を足している。**本サブの誤りは「出ること」より「出すぎること」で起きる**という自己分析（テストファイル冒頭のコメント）がそのままテスト設計になっている。
5. **★★`isFormReadyForDuplicateCheck` の流用を自力で止めた**（§12.3-4）。「あれは未完成フォームで API を打たないための門であり、判定の条件ではない」を見抜き、保存前と保存後で見えるものがずれる形を回避した。**当初は流用していて E2E を書く段で気づいた**ことまで正直に書いてある。この種の自己申告は後任にとって最も価値が高い。
6. **★破壊確認 1 で「指示書の期待が外れた」ことを、期待どおりに直さず事実として報告した。** §5.3-1 が求めた「§5.2-2 が赤くなる」はフロントが応答を stub する以上原理的に起きない、と根拠付きで書き、「母集団のずれを守らせたい指示書はフロント側に受け皿を求めないこと」まで一般化している。**指示書に合わせて赤くなるテストを捏造しなかったこと**が正しい。
7. **`m23-05` spec の追随で、主張を 1 つも落とさず「二重に告げないこと」の否定主張へ置き換え、spec 内に「これを『警告が消えた』と読んで直さないこと」を書き残した。** 次に触る人が誤って戻す経路を先に塞いでいる。
8. **404 分岐を「作らない」と決めて理由を残した**（`check_duplicate_handler.go`）。「返らない分岐を持たせると、読む側が『存在確認をしている』と誤読する」は、後任の読み違いを想定した良い判断である。

---

## 実測

| 検査 | コマンド | 結果 |
|---|---|---|
| Go テスト | `go test ./internal/... -count=1` | **全パッケージ ok / FAIL 0**（`grep -E "FAIL\|^---"` が 0 件） |
| フロント（M23-09 関連 ＋ 回帰ガード ＋ 既存 ComboEditor） | `pnpm exec vitest run ComboEditor.preSaveDuplicate / SetupEditorPage.preSaveDuplicate / PreSaveDuplicateDialog / preSaveDuplicateCheck.unit / saveWarnings.unit / ComboEditor.test` | **6 files / 97 tests 全 pass** |
| 型検査 | `pnpm exec tsc --noEmit` | **緑**（exit 0） |
| 整形 | `pnpm exec prettier --check` | リポジトリ全体 330 files warn ／ **`ComboEditor.tsx` は変更後も warn**（中-3 の根拠） |
| 検査機構 | `bash scripts/check-artifact-integrity.sh` | **違反なし**（自己検査 11 件 OK / 生成物 4 件 OK） |
| 索引行 | `bash scripts/check-progress-log-index.sh` | **NG 1 件**（高-1 の根拠） |
| 列挙同期 | `bash scripts/check-enum-sync.sh` | ベースラインどおり（増加なし） |
| ブラウザストレージ | `bash scripts/check-browser-storage-keys.sh` | 違反なし（本サブは未使用） |
| dead reference | `bash scripts/check-doc-refs.sh` | dead reference なし |
| Markdown 強調 | `bash scripts/check-md-emphasis.sh` | ベースラインどおり（436 行） |
| 停止規律 | `bash scripts/check-stop-discipline.sh` | 違反なし |
| ファイル型 | `bash scripts/check-doc-inventory.sh` | 型に無いファイル 3 件（**すべて `IMPROVE-01` 由来で本サブとは無関係**） |
| E2E | `make e2e` | **未実行**（3 分以上・必須外。完了報告の「174 passed / 0 failed / 0 flaky」は未検証） |

**★未検証の申告値**: `go test ./...` のテスト関数 1557 本・`pnpm test` の 182 files / 1824 tests・`make e2e` 174 passed。いずれもパッケージ単位／サブセットでの緑は確認したが、件数そのものは再現していない。

---

## 不明点

- **不明: 完了報告 §1-#4 の「（b）生きた側の `DuplicateInfoResponse` にも `memo` を足した（**開発者確認済み**）」の「開発者確認済み」が何を指すか、コード上・ドキュメント上から判断できない。** 指示書 §3.3-4 は「持たないなら足す」と指示しており追加自体は指示の範囲内なので、契約違反には当たらないと判断した。確認の経緯が別途あるなら、完了報告 §10（契約違反の独自判断＝0 件）の脇に根拠を添えると後任が迷わない。
- **不明: `make e2e` を回していないため、完了報告 §8 の E2E 件数（174 passed / 0 failed / 0 flaky）と §12.3-1 の判定キー分離が実際に成立しているかは、静的走査以上には検証できていない。**

---

## 制約事項

- 本レビューはコード上で判定可能な範囲のみ対象。実際の動作確認・パフォーマンス・実機テストは別途実施が必要。
- **★とくに「復元する」を押す前の一文が実機で本当に読めるか**（配置・折り返し・モーダル高さ）は、コード上では「常時描画されている」ことまでしか判定できない。`M23-05` が実機確認で初めて見つかった型の失敗であることを踏まえ、開発者の実機確認を推奨する。

---

*以上、M23-09 レビュー報告書。重大 0 件・高 4 件・中 5 件・低 3 件。最重要ゲート 2 件（「復元を押す前に入力が失われることが伝わる」「文言と行動の対応表」）はいずれも満たされている。*
