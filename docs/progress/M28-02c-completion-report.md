# M28-02c 完了報告: `FR702` のバックエンド追補 ＋ 影響コンボ画面

| 項目 | 内容 |
|------|------|
| 作業 ID | **M28-02c** |
| 指示書 | `docs/instructions/M28-02c-game-update-backend-remainder.md` **v1.0.0** |
| チェックリスト | `docs/instructions/reviews/M28-02c-review-checklist.md` **v1.0.0**（版一致） |
| 着手基点 | `233f48e` |
| 実施日 | 2026-09-07 |
| CHANGE 消費 | **0 本**（契約は `CHANGE-162` が先に書いてあり、実装は契約どおり） |
| マイグレ消費 | **0 本**（次に払い出すのは `000106` のまま） |
| 新規依存 | **0** |
| ブラウザストレージ台帳 | **不変**（延期はサーバ側ファイルが持つ） |

---

## 0. 本サブの結論

**`FR702` は「どの技が変わったかを見せて、利用者が直せるようにする」ことが目的である**（開発者の逐語）。
`M28-02a` が作ったのは**真偽**（`affectedByGameUpdate`）と絞り込みまでであり、目的には届いていなかった。

**⇒ 本サブは段 1（バックエンド）を先に作り、その上に段 2（画面）を載せた。**

- **段 1-a**: `ComboResponse.affectedMoves`（変わった技の列挙）
- **段 1-b**: 告知の経路 2 本 ＋ 判定式を共有した `COUNT`
- **段 2**: FE 型の必須化 ／ 専用画面 ／ 告知バナーと一覧のボタン ／ コンボ詳細の 1 行

---

## 1. 変更したファイル

`git diff --stat 233f48e HEAD`（末尾の合計）:

```
58 files changed, 3077 insertions(+), 19 deletions(-)
```

**★新規追加ファイルに deletions が付いていないことを確認済み**（教訓 `E-225`）:

```
$ git diff --numstat --diff-filter=A 233f48e HEAD | awk '$2 != "0" {print $3}'
（出力なし ＝ 新規ファイルはすべて + のみ）
```

### バックエンド

| ファイル | 内容 |
|---|---|
| `internal/repository/combo/repository.go` | **判定式の述語を `affectedMoveCondSQL` へ括り出し**／`listAffectedMovesByComboIDs`（バッチ）／`attachAffectedMoves`／`buildListWhere` の括り出し／`Count` の新設 |
| `internal/model/combo.go` | `AffectedMove` 型 ／ `Combo.AffectedMoves` |
| `internal/api/combo/dto.go` | `ComboResponse.AffectedMoves`（`omitempty` なし。nil のとき `[]`） |
| `internal/api/combo/routes.go` | **godoc の失効を是正**（「12 ルート」のままで 13 本目 `acknowledge-version` が一覧に無かった） |
| `internal/infra/datadir/game_update_notice.go` | `.game-update-notice.json` の読み書き（tmp → rename） |
| `internal/api/notice/game_update.go` ／ `routes.go` | 告知の経路 2 本 |
| `cmd/tacpendium/main.go` | 告知ハンドラの配線（件数は `repo.Count`、現在版は `gamerepo`） |
| `internal/api/debug/game_version.go` ／ `routes.go` | **E2E 用の書き込み口 3 本**（`//go:build debug` 配下） |

### フロントエンド

| ファイル | 内容 |
|---|---|
| `web/src/features/combo/types.ts` | `affectedByGameUpdate` を **3 分岐すべてで必須**へ ／ `affectedMoves` ／ `AffectedMove` 型 |
| `web/src/features/combo/api.ts` | `affectedByGameUpdate` / `limit` の絞り込み |
| `web/src/features/game-update/` | `types.ts` ／ `api.ts` ／ `GameUpdateBanner.tsx` ／ `AffectedCombosButton.tsx` |
| `web/src/pages/GameUpdateCombosPage.tsx` ／ `router.tsx` | 専用画面 `/game-update/combos` |
| `web/src/features/combo/components/ComboTable.tsx` ／ `ComboTableRow.tsx` | **専用画面のときだけ渡す 3 列** |
| `web/src/features/combo/components/ComboDetailMetadata.tsx` | 前提バージョンの 1 行 ／ 印 ／「問題なし」 |
| `web/src/features/combo/components/ComboEditor.tsx` | `location.state.returnTo`（保存後の戻り先） |
| `web/src/pages/ComboListPage.tsx` ／ `HomePage.tsx` | バナーのマウント（**移行告知の是正を同乗**） |
| `web/src/locales/{ja,en}.json` | `gameUpdate.*` 28 キー（**両方へ足した**） |
| `web/src/lib/query-keys.ts` ／ `query-keys.invalidation.test.ts` | `notices.gameUpdate()` |
| `web/playwright.config.ts` | E2E バックエンドを `go run -tags=debug` へ |

### コミット（9 本）

```
b9a22fc feat(M28-02c/combo): ComboResponse へ affectedMoves を足す
1c2dda4 feat(M28-02c/notice): ゲーム更新の告知 2 経路と判定式を共有した COUNT
02c2eb3 refactor(M28-02c/web): affectedByGameUpdate を FE 型で必須にし affectedMoves を足す
22319ac feat(M28-02c/web): 影響コンボの専用画面 /game-update/combos
13f5998 feat(M28-02c/web): ゲーム更新の告知バナーと一覧のボタン
fc0611a fix(M28-01/web): 移行告知バナーを ComboListPage にもマウントする  ← ★別件・分離済み
bad4427 feat(M28-02c/web): コンボ詳細に前提バージョンの 1 行と「問題なし」を出す
9d52af9 test(M28-02c/e2e): 影響コンボの往復 E2E と、そのための debug 書き込み口
7908e0b test(M28-02c/e2e): 破壊確認 (a) の主張を表の描画後・件数の前へ移す
```

**★指示書 §2.5 の割り方どおりである。移行告知の是正（`fc0611a`）は `M28-01` 由来の別件なのでコミットを分けた。**

---

## 2. ★★設計判断: 判定式を 1 本のままにする方法

**指示書 §5-1 は「式が 2 本ある状態を作れないことを、構造で示すこと」を求めている。**

### 採った形

行レベルの述語を 1 段外へ括り出し、**利用者をすべてそこから組む**。

```go
// affectedMoveCondSQL —— 「1 本の move が、そのコンボの基準より後に変わったか」
const affectedMoveCondSQL = `m.last_changed_game_version IS NOT NULL
          AND (combos.baseline_version IS NULL
               OR m.last_changed_game_version > combos.baseline_version)`

const affectedByGameUpdateCondSQL = `EXISTS ( ... AND ` + affectedMoveCondSQL + ` )`
```

| 利用者 | どこから組むか |
|---|---|
| SELECT の派生列 | `affectedByGameUpdateExprSQL`（= `Cond` ＋ `AS`） |
| 一覧の WHERE | `affectedByGameUpdateCondSQL` |
| **列挙（新）** | `listAffectedMovesSQLTemplate`（`affectedMoveCondSQL` を直接連結） |
| **総数（新）** | `Count` が `buildListWhere` を共有 ⇒ 判定式を持たない |

**★生成される SQL は着手前と 1 文字も変わっていない**（`Cond` の中身が定数連結になっただけ）。

### 構造での担保 — 2 本立て

1. **`TestJudgementPredicateExistsOnlyOnce`**（`internal/repository/combo/m28_02c_predicate_source_test.go`）
   パッケージの非テスト `.go` を `go/ast` で走査し、**マーカー（`last_changed_game_version`）と基準（`baseline_version`）の両方に言及する文字列リテラルが `affectedMoveCondSQL` の 1 本しか無いこと**を主張する。
   **★式を書き写した瞬間に赤になる。**
   - ★「列の読み出しだけの文字列」（`SELECT ... m.last_changed_game_version`）は基準に言及しないので当たらない。
   - ★「基準だけを書く文字列」（INSERT の列名）はマーカーに言及しないので当たらない。
   - ⇒ **判定式の定義そのもの**（2 つを突き合わせる文字列）だけを数える形になっている。
2. **`TestDerivedSQLSharesTheSinglePredicate`** — 3 つの派生 SQL が実際に `affectedMoveCondSQL` を含むことを主張する（片方だけ書き換えても赤）。

**⇒ なぜ振る舞いのテストでは足りないか**: 表示と絞り込みがずれるのは**マーカーと基準が特定の関係になったときだけ**であり、ふつうのテストデータではどの経路も同じ答えを返して緑で通る（チェックリスト §0.4-1）。

### `COUNT` — 一覧 API の `count` では代用できない

`Count: len(items)` はそのページの件数であり、`limit` は 100 / 1000 に丸められる（`CHANGE-162` §2.2）。
**⇒ `List` の WHERE 組み立てを `buildListWhere` として括り出し、`Count` がそれを共有する。**
`deleted_at IS NULL` も同じ述語を通るため、**集合の一致が構造で保証される**。

---

## 3. ★★設計判断: `affectedMoves` の取り付け位置

**問題**: `toComboResponse` の呼び出しは 9 か所あり、どれか 1 つで落とすと応答からキーが消える。

**採った形**: **リポジトリが注入する。**

| 注入点 | 効く経路 |
|---|---|
| `List` の末尾 | 一覧 ／ 専用画面 |
| `attachComboChildren` | 詳細 ／ ゴミ箱詳細 ／ **書き込み系すべて**（Create / PUT / PATCH / Restore / acknowledge はいずれも最後に `FindByID` を通る） |

- ⇒ **応答から `affectedMoves` が落ちる経路を作っていない。**
- `List` では **`AffectedByGameUpdate == true` の行が 1 つも無ければクエリを撃たない。**
  **★これは「真偽から列挙を導く」向きであり、禁じられた逆向き（長さで真偽を判定）ではない。**
- DTO は `omitempty` なし。`toComboResponse` が nil のとき `[]` を入れる（`Tags` / `Setups` と同じ扱い）。

### `nameJa` の落とし方

**サーバ側では `code` へ落としていない。** 先例（`starterMoveNameJa`）が「サーバは両方返し、落とすのは画面側の 1 関数」だからである（`web/src/features/combo/utils.ts:80-103`）。
⇒ 画面側で `nameJa?.trim() || code` に落とす。**表示名が引けない技（ラッシュ版）は `preset_aliases` に alias を持たない。**

---

## 4. エラー契約（`CHANGE-159` §1.1 と同じ粒度・全行）

### `GET /api/notices/game-update`

| 状況 | ステータス | コード | 備考 |
|---|---|---|---|
| 成功 | **200** | — | `{currentDataVersion, affectedCount, postponedForVersion?}`。**★204 にしない** |
| write lock を取れない | 503 | `database_busy` | `notice.ErrDatabaseBusy` で包んで渡す |
| それ以外（DB エラー・ファイル IO） | 500 | `internal_error` | **非空の `message` を持つ**（`DES-002` §4.2） |

### `POST /api/notices/game-update/postpone`

| 状況 | ステータス | コード |
|---|---|---|
| 成功 | **204** | — |
| write lock を取れない | 503 | `database_busy` |
| それ以外 | 500 | `internal_error` |

**★持たせなかった分岐（読む側が誤読しないために書く）**

| # | 内容 |
|---|---|
| 1 | **要求本文を取らない。** 版数をクライアントから受けない ⇒ 任意の版へ「延期した」ことにできない |
| 2 | **404 が無い。** 延期は「アプリ全体で 1 つ」であり、対象を指す ID が無い |
| 3 | **409 が無い。** 楽観的排他を要求しない（延期は内容の変更ではない） |
| 4 | **壊れた JSON はエラーにしない。**「延期していない」として扱い、告知そのものは 200 を返す（安全側 ＝ 告知が出るほう） |
| 5 | **`dir` が空なら延期を持てない。** 告知は返すが `postponedForVersion` は常に出ない |

---

## 5. 設計判断（本文に無く、製造が確定させたもの）

| # | 判断 | 理由 |
|---|---|---|
| 1 | **`Count` をリポジトリの `Repository` インタフェースへ足した** | 告知ハンドラが `repo.Count` を呼ぶため。★`listAffectedMovesByComboIDs` は**インタフェースへ足していない**（外から呼ぶ必要が無く、注入は `List` / `FindByID` の内側で完結する） |
| 2 | **専用画面の 3 列は「optional prop があると 1 列生える」型に揃えた** | 既存の先例が 2 つある（`onStatusChange` のステータス列 ／ `isSelectMode` のチェックボックス列）。**新しい流儀を作っていない** |
| 3 | **専用画面は `ComboTable` へ `DEFAULT_COLUMN_VISIBILITY` を渡す** | 利用者の列設定（`combo-list-columns-v1`）を読まない ⇒ 専用画面の見え方が一覧の設定で変わらない。**★台帳のキーには一切触れていない** |
| 4 | **一覧の取得上限に `limit` を足した**（`ComboListFilter.limit`） | 専用画面はキャラ横断で全件が要る。★BE 側で 1000 に丸められる。**件数の正本は告知 API の `affectedCount` である**（画面はそちらを出す） |
| 5 | **保存後の戻り先は既存の `punishReturn` と同じ仕組みに 1 値足す形**（`location.state.returnTo`） | **新しい戻り方を作らない。⇒ 履歴の形は 1 枚も変えていない**（`M24-12` (3) の契約と `NavigationGuardProvider` の `history.go` の勘定はそのまま）。★変えたのは「どこへ navigate するか」だけである |
| 6 | **`GET /api/moves` にマーカーを載せていない** | 指示書 §7-1 ／ 2026-09-07 開発者確定。**本サブは `affectedMoves` で足りる** |
| 7 | **E2E は `-tags=debug` のバックエンドで回す** | §6 に詳述。2026-09-07 開発者確定 |

---

## 6. ★★E2E のために踏んだ判断（開発者確定 2026-09-07）

### 問題 — 素の E2E では「影響コンボが在る状態」を作れない

**判定は `moves.last_changed_game_version` が非 NULL であることを要求するが、マーカーを立てる経路は DML マイグレしか無い**（`cmd/seedgen -mode game-version`）。実査の結果:

| 経路 | 使えるか |
|---|---|
| `PATCH /api/moves/{id}` | **不可**（マーカーは対象外） |
| 既存の debug API | **不可**（`GET /debug/tables` / `GET /debug/dump/:table` の read-only 2 本のみ） |
| `POST` / `PUT` / CSV 取込で基準を渡す | **不可**（`baselineVersion` は受けない ／ CSV にも載せない＝`CHANGE-159` §1.3・§6） |
| E2E バックエンド | debug タグなしで起動していた |

**★★しかも初回は必ず 0 件である**（`D-725` により既存コンボの基準は最新）。⇒ **「画面を開いても何も出ない」ので、動かして確認したことが証拠にならない**（チェックリスト §0.4-5）。

### 採った形

- `internal/api/debug/game_version.go` に **3 経路**（`//go:build debug` 配下）:
  `GET /api/debug/game-version` ／ `POST /api/debug/moves/:id/game-version` ／ `POST /api/debug/combos/:id/baseline-version`
- `web/playwright.config.ts` の E2E バックエンドを **`go run -tags=debug ./cmd/tacpendium`** へ。

**★本番バイナリには 1 バイトも出ない**（`routes_noop.go` は不変。本ファイルは build tag 配下）。
**★代償**: E2E が本番ビルドではなく debug ビルドを検査する。**差分は debug ルート 5 本の登録だけ**であり、本番コードの経路は同一である（`make test-go-debug` が既に debug ビルドを回している）。理由と代償は `playwright.config.ts` に書いた。

### ★E2E の分離をどう保ったか

**マーカーは技に立つので、同じ技を使う全コンボへ及ぶ。**
⇒ 現在版（既定 `2026.08.03.01`）より**新しい**マーカーを立てると、**他 spec が作ったコンボまで一斉に影響ありになり**、件数も行の並びも当てにならなくなる（E2E は DB を 1 本共有する ＝ 教訓 `E-232`）。

**⇒ マーカー（`2020.06.01.00`）も基準（`2020.01.01.00`）も現在版より古い値にした。**
他 spec のコンボは基準が現在版のままなので「マーカー ≦ 基準」で影響なしのままである。
**★この前提が崩れたら止まるよう、spec の `beforeAll` で `MARKER < currentDataVersion` を主張している。**

**★共有状態は `afterAll` で元へ戻す**（`D-399` (1)）: マーカーを NULL へ戻し、作ったコンボを削除する。

---

## 7. テスト

### Go

| ファイル | 内容 |
|---|---|
| `internal/repository/combo/m28_02c_predicate_source_test.go` | **AST 走査で「判定式が 2 本ある状態を作れない」ことを構造として主張**（§2） |
| `internal/service/combo/m28_02c_affected_moves_test.go` | 列挙の中身（変わった技だけ ／ 2 技とも変われば 2 件 ／ 非技ステップは入らない ／ 一覧のバッチ）＋ **判定表の全行で「真偽と列挙が食い違わない」ことを主張** |
| `internal/service/combo/m28_02c_count_test.go` | **`Count` と `List` の集合の一致**（5 通りのフィルタ）／ ゴミ箱の行が入らないこと ／ **`limit=1` でも総数が丸められないこと** |
| `internal/infra/datadir/game_update_notice_test.go` | 延期の往復 ／ **版が上がったら抑止が外れること** ／ 壊れた JSON ／ tmp を残さないこと |
| `internal/api/notice/game_update_test.go` | **常に 200**（0 件でも）／ 延期の往復 ／ **延期中でも件数が返ること** ／ エラー契約の全行 |
| `internal/api/combo/m28_02c_handler_test.go` | **空でも `affectedMoves` のキーが出ること**（`map[string]any` でキー存在を確認）／ 1 件ぶんの形 ／ `nameJa` が nil のときキーごと出ないこと |

### フロント（Vitest）

| ファイル | 内容 |
|---|---|
| `web/src/pages/GameUpdateCombosPage.test.tsx` | **取得失敗が「0 件」と区別されること** ／ 本当に 0 件のときだけ「ありません」 ／ 前提バージョンが無いときは「不明」 ／ 表示名が引けない技は `code` ／ 一括の入口が無いこと |
| `web/src/features/game-update/GameUpdateBanner.test.tsx` | **延期中はバナーだけ消えてボタンは消えないこと**（分水嶺の陽性対照）／ 版が上がれば戻ること ／ **失敗を両方の位置に出すこと** ／ 延期が本文を送らないこと |
| `web/src/pages/ComboListPage.banners.test.tsx` | **バナー 2 本のマウント先が一覧にもあること** ／ 増えたのはボタン 1 個だけであること |
| `web/src/features/combo/components/ComboDetailMetadata.gameUpdate.test.tsx` | 印 ／「不明」／ **真偽の正本が `affectedByGameUpdate` であること（列挙が空でも印が出る陽性対照）** ／ **ゴミ箱では印は出るがボタンは出ず理由が添うこと** |
| `web/src/features/combo-io/export-model.test.ts` | **エクスポートに前提バージョンも印も出ないこと** |

**★すべて実 `ja.json` を引く**（`import "@/lib/i18n";`。`jest-dom` は未導入なので `toBeTruthy()` を使う）。

### E2E（`web/e2e/m28-02c-game-update.spec.ts`・2 本）

1. **バナー → 専用画面 →「問題なし」→ 件数が減る**の往復
2. **破壊確認 (b)** 延期してもバナーだけが消え、一覧のボタンは消えない

`make e2e-only P=m28-02c`（`D-599`。`playwright` を直接叩いていない）／ `make e2e` はリポジトリルートで実行。

---

## 8. ★★破壊確認（3 件・実走した）

**すべて「壊して赤を見て、戻して緑を見た」。**

| # | 壊したもの | 結果 |
|---|---|---|
| **(a)** | 専用画面のマウント時に `acknowledge.mutate` を撃つ `useEffect` を足した | **赤**。`★専用画面を開いただけで基準が進んでいる` / `Expected: "2020.01.01.00" / Received: "2026.08.03.01"` |
| **(b)** | `AffectedCombosButton` で `postponedForVersion === currentDataVersion` のとき `null` を返す | **赤**。`getByTestId('game-update-button')` / `Expected: visible` / `element(s) not found` |
| **(c)** | `ComboListPage` からバナーを外し `HomePage` だけにした | **赤**（2 経路とも）。E2E: `getByTestId('game-update-banner')` が 1280px で見つからない ／ Vitest: `ComboListPage.banners.test.tsx` の 1 本が落ちる |

**★(a) は最初、行そのものが消えるため「件数の主張」が先に落ちていた**（言いたいことを表す主張が発火しない）。**⇒ 表の描画を待ってから基準を読む形へ並べ替え、再度壊して意図どおりの主張で落ちることを実測した**（`7908e0b`）。

**★3 件とも戻したあと、`git diff --stat HEAD` が spec 1 ファイルだけになることを確認してからコミットした。**

---

## 9. 実行結果（すべて緑）

| コマンド | 結果 |
|---|---|
| `go test ./...` | **緑** |
| `go test -tags=debug ./...` | **緑** |
| `make test-web` | **緑**（216 files / **2477 tests**） |
| `make e2e` | **緑**（**249 passed** / 4.0m） |
| `make e2e-only P=m28-02c` | **緑**（2 passed） |
| `cd web && pnpm exec tsc --noEmit -p tsconfig.json` | **緑** |

### 常設検査

| 検査 | 結果 |
|---|---|
| `scripts/check-artifact-integrity.sh`（**1 本目**） | **違反なし**（自己検査 14 件 ／ 生成物 4 件とも OK） |
| `scripts/check-browser-storage-keys.sh` | **違反なし**（台帳は 1 行も動いていない） |
| `scripts/check-enum-sync.sh` | **ベースラインどおり**（増加なし） |
| `scripts/check-import-order.sh` | **違反なし**（ベースラインどおり） |
| `scripts/check-doc-refs.sh` | **dead reference なし** |
| `scripts/check-doc-inventory.sh` | **型に無いファイルなし** |
| `scripts/check-migration-license.sh` | **違反なし**（層 A 30 / 層 B 72。**消費 0**） |
| `scripts/check-md-emphasis.sh` | **★下記参照（本サブ由来ではない）** |
| `scripts/check-progress-log-index.sh` | Phase D で追記後に実行 |

**★`check-md-emphasis.sh` は着手前から赤である**（着手時点で 495 行 / ベースライン 436 行）。
**実装コミットの時点で `.md` を 1 行も触っていない**（`git diff --stat 233f48e 98cc43d -- '*.md'` の出力は空）。
⇒ **その 59 行は本サブ由来ではない。** チェックリスト §0.3-4 が「ベースラインが動いていないこと」を重大でないとしている項に当たる。

**★取り込み後は 496 行である（+1）。内訳はレビュー報告書のコードフェンス内の引用 1 行である**
（`docs/progress/m28-02c-review.md:142` の `/** ★例外: … */`）。
**★本検査は「1 行ずつ描画」する実装でありコードフェンス（```）を認識しない**（インラインのコードスパンは除外する）。
**⇒ フェンス内の `/**` は構造上かならず当たる偽陽性である。**
**★検査を通すために他者の報告書の本文を書き換えていない。⇒ 検査側の限界として横断課題に残した。**

---

## 10. ■ 併せて更新が要るもの

| # | 項目 | 状態 |
|---|---|---|
| 1 | **消費した CHANGE 番号の登録** | **なし。** 契約は `CHANGE-162` が先に書いてあり、実装は契約どおりである ⇒ **CHANGE を起票していない**（`change-number-registry.md` §1 も不変） |
| 2 | **その番号の写し先の全数是正** | **なし**（番号を消費していないため。registry §1 ／ 契約 §4 ／ ボード §2.1 ／ §2.4 のいずれも不変） |
| 3 | **消費したマイグレ連番** | **なし。** `ls migrations/` の実査値は `000105` が最後であり、**次に払い出す番号は `000106` のまま**（ボード §2.2 とずれていない） |
| 4 | **版を上げた文書の参照元** | **なし**（`docs/design/` を 1 文字も編集していない） |
| 5 | **ブラウザストレージ台帳** | **なし**（延期はサーバ側ファイル。`web/CLAUDE.md` §1 は不変） |
| 6 | **`progress-log.md` への索引行** | **Phase D で追記する**（本報告の後） |

---

## 11. `docs/design/` に反映が要る箇所

**★契約どおりなら 0 件のはずである、という指示書 §6-5 の見立てに対する実測。**

| # | 箇所 | 判定 |
|---|---|---|
| 1 | `DES-002` §4.2 の経路 3 行の「**★未実装**」 | **★要更新**（3 本とも実装した。`GET /api/notices/game-update` ／ `POST .../postpone` ／ `ComboResponse.affectedMoves`） |
| 2 | `DES-005` §5.19b 冒頭の「**★未実装。`M28-02c` が作る**」と見出しの注記 | **★要更新**（実装した） |
| 3 | `DES-005` §5.6 の注記の「**★未実装**」 | **★要更新**（実装した） |
| 4 | `CHANGE-162` §0 の「本 CHANGE が書くものは、まだ実装されていない」 | **★要更新**（`VAL-C16` と同じ扱いで「見える形で残す」とした記述であり、解消した） |

**⇒ 契約そのもののずれは 0 件である。**「未実装」の注記が実装で失効しただけであり、**製造は `docs/design/` を編集しない**（`CLAUDE.md` §8）。**設計卓の手番として一覧にした。**

**★これは「撤回済み・失効した記述が残っている」型そのものである**（レビュー較正で「高」に当たる）。**⇒ 放置すると、次の担当が「まだ実装されていない」を前提として読む。**

---

## 12. レビューと取り込み

- **レビュー報告書**: `docs/progress/m28-02c-review.md`（fresh subagent で実施。**`fork` は使っていない**）
- **再レビュー往復**: **0 回**（初回のみ。上限 2 回に達していない）

### 指摘の件数・優先度別内訳

| 優先度 | 件数 | 採用 | 不採用 |
|---|---|---|---|
| **高** | 4 | **4** | **0** |
| 中 | 4 | 4 | 0 |
| 低 | 5 | 4 | **1** |
| 合計 | **13** | **12** | **1** |

**★チェックリスト §7 の「重大」10 項目は 0 件**（レビュー実測）。

### ★「高」指摘の不採用は 0 件である

**⇒ 開発者へのエスカレーションは発生していない**（Phase C 安全弁は「高の不採用」のときにだけ働く）。

### 各指摘の採否と理由

**★正本はレビュー報告書末尾の「## 取り込み結果（自動トリアージ）」である**（事後監査のため同書へ残した）。要点のみ:

| # | 指摘 | 採否 | 要点 |
|---|---|---|---|
| **高-1** | 専用画面の［削除］が no-op | **採用** | `onDelete` を optional にし、渡されない面では描かない。**既存の呼び手はすべて渡しているため挙動は不変** |
| **高-2** | 503 が実配線で到達不能 | **採用** | `gameUpdateError` が `dbinfra.IsBusy` でも判定する形へ。**実 DB で起こした本物の busy エラーから 503 になることを主張するテストを足した**（sentinel だけでは今回の穴が塞げない） |
| **高-3** | `progress-log.md` 未追記 | **採用** | Phase D で追記（工程順どおり） |
| **高-4** | `query-keys.ts` の「11 フィールド」失効 | **採用** | 14 へ是正。**本サブが 2 つ足して失効させた当事者である** |
| **中-1** | 1000 件打ち切りが画面に出ない | **採用** | 総数と表示件数を突き合わせて注記を出す。上限は `PAGE_LIMIT` へ定数化 |
| **中-2** | E2E が延期の記録を戻していない | **採用** | debug へ `DELETE /api/debug/notices/game-update` を足し `afterAll` で消す |
| **中-3** | `Postpone` の `dir == ""` が 204 | **採用** | 500 で失敗させる |
| **中-4** | mutation 2 本が生 `fetch` | **採用** | `fetchJSON` へ寄せた（先例と揃う） |
| **低-1** | E2E spec の列挙が失効 | **採用** | (a)(c) が 1 本目に同居していると明記 |
| **低-2** | 空の `<dd>` | **採用** | 中身があるときだけ描く |
| **低-3** | 構造テストの走査範囲 | **採用** | **`internal/` 全体へ広げた**（別パッケージへの書き写しも検出する） |
| **低-4** | 成功表示が即消える | **採用** | トーストへ移した（`CHANGE-162` §6.2 の唯一の例外を実際に読めるようにする） |
| **★低-5** | `LEFT JOIN preset_aliases` の alias 重複 | **★不採用** | **本サブ由来ではなく、直すなら既存の `findMoveLabelsByIDs` と同じ手番で直すのが筋**（片方だけ直すと同じ名前解決が 2 つの流儀を持つ＝`E-76` の型）。**⇒ 横断課題として `progress-log.md` へ残した** |

### 取り込み後の実行結果

**§9 の表を取り込み後に再実行し、すべて緑であることを確認した**（`go test ./...` ／ `-tags=debug` ／ `make test-web` 2477 ／ `make e2e` **249 passed** ／ 常設検査 7 本）。

---

*以上、M28-02c 完了報告。*
