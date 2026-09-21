# 設計伝達レポート: M28-02c（`FR702` のバックエンド追補 ＋ 影響コンボ画面）

| 項目 | 内容 |
|------|------|
| 作業ID | M28-02c |
| 対象指示書 | `docs/instructions/M28-02c-game-update-backend-remainder.md` **v1.0.0** ／ チェックリスト `docs/instructions/reviews/M28-02c-review-checklist.md` v1.0.0（版一致） |
| CHANGE | **消費 0 本。★製造は番号を自採番していない**（`D-293`）。**契約は `CHANGE-162` が先に書いてあり、実装は契約どおり。⇒ ずれの請求は 0 件。** たたき台は §6 |
| マイグレ | **消費 0 本。⇒ 次に払い出す番号は `000106` のまま**（`ls migrations/` の末尾は `000105`） |
| 作成日 | 2026-09-07 |
| 実装コミット | `claude/m28-02c-implementation-hd1pki` の **12 コミット**（`233f48e..8b111e7`。65 files / +4318 / -40）。**push 済み ⇒ 設計卓は HEAD で読める** |
| 源泉 | 完了報告 `docs/progress/M28-02c-completion-report.md` ／ レビュー `docs/progress/m28-02c-review.md`（**重大 0 / 高 4 / 中 4 / 低 5 ・12 件採用 / 1 件不採用・★「高」の不採用 0 件・再レビュー往復 0 回**）／ **開発者の実機確認 1 回（2026-09-07）とその場での判断 4 件** |
| 宛先 | 設計卓（親チャット） |

**本レポートは ①独自確定仕様 ②契約違反の独自判断 ③製造判断 ④残課題 に絞る。指示書どおりの部分は割愛する。**

> **★★設計卓は `docs/progress/` を読まない**（2026-08-11 開発者裁定①）**。したがって本レポートは参照だけを書かず、判断に要る中身をここへ埋めてある。**

> **★★最重要は §1-1（API 経路 3 本の as-built・逐語）と §2-1（E2E を debug ビルドで回すことにした件）である。**
> §1-1 は `DES-002` §4.2 が「**★未実装**」と書いている 3 行の as-built であり、**これを反映しないと次の担当が「まだ実装されていない」を前提に読む**。
> §2-1 は**開発者確定済みだが設計書に as-built が無い**。受理して明文化するか却下するかの裁定が要る。

---

## §1 製造が独自に確定した実装仕様（DES 反映が要るもの）

### §1-1 ★★API 経路 3 本の as-built（宛先 `DES-002` §4.2。**現在の記述は「★未実装」**）

**`CHANGE-162` §0 が「本 CHANGE が書くものは、まだ実装されていない。⇒ 各行へ『未実装』と明記した」と書いた 3 本を、本サブが実装した。⇒ その注記は失効している。**

#### (a) `ComboResponse.affectedMoves`

**実 DTO（2026-09-07 開発者環境の実測。dev DB へ人工的に古い基準を作って取得したもの）**:

```json
{
  "affectedByGameUpdate": true,
  "baselineVersion": "2020.01.01.00",
  "affectedMoves": [
    {
      "moveId": 1040,
      "code": "standing_light_punch",
      "nameJa": "立ち弱P",
      "lastChangedGameVersion": "2020.06.01.00"
    }
  ]
}
```

| # | 確定した仕様 | 根拠 |
|---|---|---|
| 1 | **`omitempty` を付けない。空でも `[]` を返す** | `internal/api/combo/dto.go:283`。`toComboResponse` が nil のとき `[]model.AffectedMove{}` を入れる（`dto.go:575`）。`TestComboResponse_AffectedMovesKeyIsAlwaysPresent` |
| 2 | **`nameJa` は `omitempty`。★サーバ側では `code` へ落とさない** | `internal/model/combo.go` の `AffectedMove`。**落とすのは画面側の 1 関数**（`web/src/features/combo/components/ComboTableRow.tsx` の `m.nameJa?.trim() \|\| m.code`）。**先例＝`starterMoveNameJa`（サーバは両方返す）に揃えた** |
| 3 | **同じ技を 2 回使うコンボでも 1 行だけ出す**（`DISTINCT`）。並びは `ORDER BY cs.combo_id, m.id` | `internal/repository/combo/repository.go` の `listAffectedMovesSQLTemplate` |
| **4** | **★★載る面は「コンボを返す全経路」である** | 注入は `List` の末尾と `attachComboChildren` の 2 か所。**書き込み系（Create / PUT / PATCH / Restore / acknowledge）はいずれも最後に `FindByID` を通る。⇒ 応答から `affectedMoves` が落ちる経路は無い** |

**★母集団の述語**: そのコンボの `combo_steps` のうち `move_id` が非 NULL のもの（`JOIN moves` で非技ステップは構造的に落ちる）で、**基準より後に変わった技だけ**。

**★持たせなかった分岐**: **`affectedMoves` から真偽を導く経路を 1 つも作っていない。** 真偽の正本は `affectedByGameUpdate` の 1 本である（`CHANGE-162` §1.2-4）。`TestAffectedMoves_AgreesWithTheBooleanOnEveryRow` が判定表の全行で「真偽と列挙が食い違わない」ことを実 DB で主張する。

#### (b) `GET /api/notices/game-update`

**実 DTO（同じく実測）**:

```json
{"currentDataVersion":"2026.08.03.01","affectedCount":1}
```

**エラー契約（全行）**:

| 状況 | ステータス | コード |
|---|---|---|
| 成功 | **200** | — |
| write lock を取れない | **503** | `database_busy` |
| それ以外（DB エラー・告知ファイルの IO 失敗） | **500** | `internal_error`（**非空の `message` を持つ**） |

**★母集団の述語**: `affectedCount` は **`deleted_at IS NULL` かつ影響可能性あり**のコンボの総数（全キャラ合計）。**ゴミ箱の行は数えない。**

**★持たせなかった分岐**:

| # | 内容 |
|---|---|
| 1 | **204 は無い。** 0 件でも 200 を返す（返すのは「有無」ではなく件数と現在版であり、204 では表現できない） |
| 2 | **`postponedForVersion` は現在版と一致するときだけ載る。** 版が上がれば消え、抑止が外れる |
| 3 | **壊れた JSON はエラーにしない。**「延期していない」として扱い、告知そのものは 200 を返す（**安全側＝告知が出るほう**） |
| 4 | **キャラ別の内訳は返さない**（アプリ全体の合計 1 値のみ） |

#### (c) `POST /api/notices/game-update/postpone`

**エラー契約（全行）**:

| 状況 | ステータス | コード |
|---|---|---|
| 成功 | **204** | — |
| **データディレクトリが未設定** | **500** | `internal_error` |
| write lock を取れない | **503** | `database_busy` |
| それ以外 | **500** | `internal_error` |

**★持たせなかった分岐**:

| # | 内容 |
|---|---|
| 1 | **要求本文を取らない。** サーバが `games.current_data_version` を読んで書く（`acknowledge-version` と同型） |
| 2 | **404 が無い。** 延期はアプリ全体で 1 つであり、対象を指す ID が無い |
| 3 | **409 が無い。** 楽観的排他を要求しない（延期は内容の変更ではない） |
| **4** | **★「延期の解除」の経路を本番に作っていない。** 版が上がれば自然に外れるため。**⇒ 解除は debug ビルドにだけ在る**（§2-1） |

> **★★(c) の「データディレクトリが未設定 → 500」はレビュー中-3 で改めた。** 当初は **保存せずに 204 を返していた**。**⇒「保存できないのに成功を返す」は「延期したのに次も出る」を利用者が説明できない形になる。**

**⇒ `DES-002` §4.2 の該当 3 行から「★未実装」を外し、上記の as-built（とくに「持たせなかった分岐」）を書いてほしい。**

---

### §1-2 ★★判定式の一本化は「4 経路が 1 本の述語から組まれる」形になった（宛先 `DES-003` §3.4）

**`DES-003` §3.4 の現記述は「判定式は 1 か所しかなく、SELECT の派生列と一覧の WHERE が同じ式を共有する」である。⇒ as-built は 4 経路であり、記述が実態より狭い。**

**採った形＝行レベルの述語を 1 段外へ括り出した**（`internal/repository/combo/repository.go`）:

```go
const affectedMoveCondSQL = `m.last_changed_game_version IS NOT NULL
          AND (combos.baseline_version IS NULL
               OR m.last_changed_game_version > combos.baseline_version)`
```

| 利用者 | どこから組まれるか |
|---|---|
| 真偽（`EXISTS`） | `affectedByGameUpdateCondSQL` ＝ 上記を連結 |
| SELECT の派生列 | `affectedByGameUpdateExprSQL` ＝ 上記 ＋ `AS` |
| **列挙（`affectedMoves`）** | `listAffectedMovesSQLTemplate` ＝ 上記を直接連結 |
| **総数（`COUNT`）** | **判定式を持たない。`List` と同じ `buildListWhere` を共有する**（§1-3） |

**★生成される SQL は着手前と 1 文字も変わっていない**（`Cond` の中身が定数連結になっただけ）。

**★★構造での担保（指示書 §5-1 の「式が 2 本ある状態を作れないことを構造で示す」への答え）**:

`internal/repository/combo/m28_02c_predicate_source_test.go` が **`internal/` 全体**を `go/ast` で走査し、
「**マーカー（`last_changed_game_version`）と基準（`baseline_version`）の両方に言及する文字列リテラルは 1 本だけ**」を主張する。

- **判定式の定義そのもの**（2 つを突き合わせる文字列）だけを数える形になっている。列の読み出しだけの文字列は基準に言及しないので当たらない。
- **走査範囲は自パッケージではなく `internal/` 全体である**（レビュー低-3 で広げた）。⇒ **サービス層や別のリポジトリへ書き写しても検出する。**

**⇒ `DES-003` §3.4 へ「判定式は行レベルの述語 1 本であり、真偽・派生列・列挙の 3 つがそこから組まれる。総数は WHERE 組み立てごと共有する」と明文化してほしい。★「SELECT と WHERE の 2 つ」と書いたままだと、次の担当が列挙・総数を別に書いてよいと読む。**

---

### §1-3 `COUNT` は「判定式の共有」ではなく「WHERE 組み立ての共有」で解いた（宛先 `DES-002` §4.2）

**`DES-002` §4.2 の `GET /api/notices/game-update` 行は「判定式を共有した `COUNT` の新設が要る。★式を書き写さないこと」と書いている。⇒ as-built はもう一段強い。**

`List` の絞り込み条件の組み立てを `buildListWhere(filter) (string, []any)` として括り出し、`Count` がそれを通す。

```go
func (r *repository) Count(ctx context.Context, filter ListFilter) (int, error) {
	where, args := r.buildListWhere(filter)
	query := "SELECT COUNT(*) FROM combos\n" + where
	...
}
```

**⇒ `Count` は判定式を持たない。「式が 2 本」自体が起こらない。`deleted_at IS NULL` も同じ述語を通る。**

`TestCountMatchesListFilter` が 5 通りのフィルタで**実 DB の件数＝行数**を主張し、ゴミ箱の行が入らないことも押さえる。`TestCountIsNotCappedByListLimit` が「`limit=1` の `List` は 1 行、`Count` は 3」で裏返しを固定する。

**⇒ 該当行の「判定式を共有した `COUNT`」を「`List` と同じ絞り込みの組み立てを共有する `COUNT`」へ改めてほしい。**

---

### §1-4 ★★専用画面の行アクションは［コピー］を出さず［削除］を出す（宛先 `DES-005` §5.19b。**2026-09-07 開発者確定**）

**`DES-005` §5.19b は行アクションに触れていない。** 実装当初は `ComboTable` の既定どおり〔詳細 / 編集 / コピー / 削除〕が並んでいたが、開発者が実機で「**専用画面でコピーをするのはあまり良く分からない運用**」と判断した。

| # | 確定 | 理由（実装の事実に基づく） |
|---|---|---|
| 1 | **［コピー］を出さない** | **コピーで生まれる行は基準が登録時の現在版で埋まる**（`insertComboSQL` の `COALESCE`）**。⇒ コピーは「影響なし」として生まれ、元の行は影響ありのまま残る。「変わった技を確認して直す」という画面の目的に対して何も進まない操作である** |
| 2 | **［削除］を出す** | 直す代わりに捨てる、が自然な選択肢である |
| **★3** | **削除しても復元しても基準は動かない** | **`baseline_version` を書く本番コードは 2 か所しか無い**（`insertComboSQL` の `COALESCE` と `AdvanceBaselineVersion`）**。論理削除も復元も `deleted_at` / `updated_at` しか触らない**（`repository.go:1366` / `:1396`） |

**★★3 は不変条件として書き残してほしい。** これが崩れると、**影響コンボを 1 度ゴミ箱へ入れて戻しただけで「確認済み」に化ける**——利用者が中身を見ていないのに警告が消える形であり、`FR307` の向きに反する。
`TestDeleteAndRestore_DoesNotTouchBaseline`（`internal/service/combo/m28_02c_affected_moves_test.go`）が実 DB で固定した。**ゴミ箱の行でも判定そのものは生きていること（＝印が出ること）も併せて主張している。**

**⇒ `DES-005` §5.19b へ「行アクションは 詳細 / 編集 / 削除。コピーは出さない」と、`DES-003` §3.4 へ「削除・復元は基準に触らない」を明文化してほしい。**

---

### §1-5 専用画面は 1000 件で打ち切り、打ち切りを画面に出す（宛先 `DES-005` §5.19b）

- 一覧 API の `limit` は BE 側で 1000 に丸められる。**⇒ 専用画面は `PAGE_LIMIT = 1000` を渡す。**
- **★件数の正本は告知 API の `affectedCount` である**（一覧の応答は打ち切られている）。画面のバナー・ボタンはそちらを出す。
- **打ち切りの注記を出す条件は「行数が上限に達したこと」である**（`shownCount >= PAGE_LIMIT && affectedCount > shownCount`）。
  **★★総数と行数の差だけで判定しない** —— 総数（告知 API）と行数（一覧 API）は**別のクエリ**であり、片方だけ先に更新される瞬間が実在する（削除した直後など）。差だけを見ると、その瞬間に **「1 件中 0 件を表示しています」と嘘を言う。**

**⇒ §5.19b へ「上限 1000 件。件数の正本は告知 API。打ち切りは上限到達で判定する」を書いてほしい。**

---

### §1-6 保存後の戻り先の実装形と、**その限界**（宛先 `DES-005` §5.19b ／ `CHANGE-162` §7）

**採った形＝既存の `punishReturn` と同じ仕組みに 1 値足しただけ**（`location.state.returnTo`）。**⇒ 新しい戻り方を作っていない。履歴の形は 1 枚も変えていない**（`M24-12` (3) の契約と `NavigationGuardProvider` の `history.go` の勘定はそのまま）。

**★★ただし限界がある（実測）**:

| 入口 | 戻る先 |
|---|---|
| **専用画面の行の［編集］** | **`/game-update/combos`**（`web/src/features/combo/components/ComboTableRow.tsx:273`。`showGameUpdateColumns` が真のときだけ `state` を積む） |
| **専用画面 →［詳細］→［編集］** | **戻らない**（`web/src/pages/ComboDetailPage.tsx:140` の編集リンクに `state` が無い） |

**`CHANGE-162` §7 の文面は「専用画面から［編集］へ入った場合」なので契約としては満たしている。⇒ ただし「変わった技を確認してから直す」利用者は詳細を経由するのが自然であり、実運用では踏まれる経路だと考える。** §4-1 へ申し送る。

---

## §2 契約・設計に反する独自判断（★親の裁定が要る）

### §2-1 ★★E2E を **debug ビルド**で回すことにした（**1 件**。2026-09-07 開発者確定済み・**設計書に as-built が無い**）

**何に反したか**: 明文の契約には反していないが、**`CHANGE-135` §5-1 が「どの経路から E2E スタックを起こしても必ず本物を検査する形を保つ」を明記した領域**に触れる変更であり、**設計書のどこにも as-built が無い。**

**なぜそう判断したか（実測）**: 指示書 §5-5 は E2E 1 本（バナー → 専用画面 →「問題なし」→ 件数が減る）を要求するが、**素の構成では「影響コンボが 1 件以上ある状態」を作れない。**

| 経路 | 可否 |
|---|---|
| `PATCH /api/moves/{id}` | **不可**（マーカーは対象外） |
| 既存の debug API | **不可**（read-only 2 本のみ） |
| `POST` / `PUT` / CSV 取込で基準を渡す | **不可**（`baselineVersion` は受けない ／ CSV にも載せない＝`CHANGE-159` §1.3・§6） |
| マーカーを立てる | **DML マイグレのみ**（`cmd/seedgen -mode game-version`） |

**★★しかも `D-725` により初回は必ず 0 件である。⇒「画面を開いても何も出ない」ので、動かして確認したことが証拠にならない**（チェックリスト §0.4-5 が名指ししている罠）。

**実装がどうなっているか**:

- `internal/api/debug/game_version.go`（**`//go:build debug` 配下**）へ 4 経路: `GET /api/debug/game-version` ／ `POST /api/debug/moves/:id/game-version` ／ `POST /api/debug/combos/:id/baseline-version` ／ `DELETE /api/debug/notices/game-update`
- `web/playwright.config.ts` の E2E バックエンドを **`go run -tags=debug ./cmd/tacpendium`** へ
- **本番バイナリには 1 バイトも出ない**（`routes_noop.go` は不変。`go build ./...` と `go build -tags=debug ./...` の両方が通ることを実走確認）
- **`internal/api/debug/handler.go` の `NewHandler` シグネチャを変えた**（`(db)` → `(db, dir)`）。告知ファイルの位置を知るため

**★代償**: **E2E が本番ビルドではなく debug ビルドを検査する。** 差分は debug ルート 6 本の登録だけであり、本番コードの経路は同一である（`make test-go-debug` が既に debug ビルドを回している）。理由と代償は `web/playwright.config.ts` の注記に書いた。

**⇒ 親の裁定を求める**: 受理して `SUPP-001` §4.5（E2E の構成）または `DES-002` へ「E2E は debug ビルドで回す。理由は FR702 の状態を作れないこと」を明文化するか、却下して別の手段（マイグレ 1 本を消費して固定の seed マーカーを置く等）へ差し戻すか。

---

## §3 製造の判断

### §3-1 開発者へ確認して確定した点

| # | 論点 | 確定 | 出所 |
|---|---|---|---|
| 1 | **E2E で影響コンボを作る手段** | **debug タグの書き込み口を足す**（§2-1） | 2026-09-07 実装前の確認 |
| 2 | **`GET /api/moves` にマーカーを載せるか**（指示書 §7-1） | **載せない**（設計卓の推奨どおり） | 同上 |
| 3 | **移行告知の是正を同乗させるか**（指示書 §7-2） | **同乗させる。★コミットは分ける** | 同上。`fc0611a` が独立コミット |
| 4 | **専用画面の行アクション** | **［コピー］を外し［削除］を出す**（§1-4） | 2026-09-07 実機確認時 |

### §3-2 推測で進めた点（指示書に明示が無く、実装が決めた）

| # | 判断 | 理由 |
|---|---|---|
| 1 | **`showCopy` の既定を `true` にした** | **既存 4 面の挙動を 1 ミリも変えないため。** 専用画面だけが `showCopy={false}` を渡す |
| 2 | **専用画面は `DEFAULT_COLUMN_VISIBILITY` を渡す** | **利用者の列設定（`combo-list-columns-v1`）を読まない。⇒ 専用画面の見え方が一覧の設定で変わらず、汚しもしない。★台帳のキーには一切触れていない** |
| 3 | **`ComboListFilter` へ `limit` を足した** | 専用画面はキャラ横断で全件が要る。★BE 側で 1000 に丸められる |
| 4 | **`Count` は `Repository` インタフェースへ足し、`listAffectedMovesByComboIDs` は足さなかった** | 前者は告知ハンドラが呼ぶ。後者は注入が `List` / `FindByID` の内側で完結し、外から呼ぶ必要が無い |
| 5 | **`useDeleteCombo` / `useRestoreCombo` へ告知の無効化を足した** | **触らないと専用画面が嘘をつく**（§1-5 の「1 件中 0 件」）。★共有フックだが、件数は `combos` と同じ行から導かれるため一緒に落とすのが筋 |
| 6 | **`internal/api/combo/routes.go` の godoc を直した**（「12 ルート」→ 13） | `M28-02a` の取りこぼし。**「実装が変わったのに記述が旧のまま」はレビュー較正で「高」に当たる型**であり、射程外だが直した |

---

## §4 設計担当が未把握の残課題・申し送り

> **★`followup-backlog.md` の本表は製造が編集しない**（`D-382`）。**⇒ 設計卓が迷わず追加できる形で書く。**

| # | スラッグ | 何が起きるか | 根拠 | 割付の候補と理由 | 新規/更新 |
|---|---|---|---|---|---|
| 1 | **`game-update-return-to-lost-via-detail`** | 専用画面 →［詳細］→［編集］→ 保存 で**専用画面へ戻らない**。詳細を 1 枚挟むと `returnTo` が途切れる | `web/src/pages/ComboDetailPage.tsx:140` の編集リンクに `state` が無い（`ComboTableRow.tsx:273` にはある） | **フェーズ4 の画面レーン。** `CHANGE-162` §7 の契約は満たしているが、実運用で踏まれる経路である。**塞ぐなら詳細への遷移にも `state` を積み、詳細の編集リンクへ引き継ぐ形になる**（契約の範囲を超えるため設計判断が要る） | **新規** |
| 2 | **`combo-mutations-do-not-invalidate-game-update-notice`** | コンボを動かす経路のうち **8 か所**が `notices.gameUpdate()` を無効化しないため、バナー・ボタンの件数が古いまま残る瞬間ができる | `queryKeys.combos.all()` を無効化する箇所は **11**（`grep` 実測）。そのうち告知も落とすのは delete / restore / acknowledge の **3 本**だけで、本サブがその 3 本を塞いだ。⇒ 残り 8 本 | **フェーズ4 の改善レーン。** 構造的な解は「`combos` を無効化するときは告知も落とす」共通ヘルパへ寄せること。**11 か所の置換になるため本サブでは採らなかった**（`E-76` の型を新たに作らないため、片手間で 2 か所だけ直すのは避けた） | **新規** |
| 3 | **`move-label-join-duplicates-on-multiple-aliases`** | 同一 move × 同一 preset に alias が複数あると、`affectedMoves` の列挙が `DISTINCT` 後も 2 行になる | レビュー低-5。`listAffectedMovesSQLTemplate` と既存の `findMoveLabelsByIDs` が同じ `LEFT JOIN preset_aliases` 形 | **未割付。★本サブ由来ではない**——既存関数が同じ形である。**⇒ 直すなら両方を同じ手番で直すのが筋**（片方だけ直すと同じ名前解決が 2 つの流儀を持つ＝`E-76`）。**現状の `official_ja_move` は move ごとに 1 件を想定した運用のため実害は出ていない** | **新規**（レビューで不採用にした 1 件） |
| 4 | **`check-md-emphasis-counts-fenced-code`** | `check-md-emphasis.sh` が**コードフェンス（```）を認識しない**ため、フェンス内の `/**` が構造上かならず偽陽性で当たる | 本サブのレビュー報告書がコードを引用した 1 行で 495 → 496 になった（`docs/progress/m28-02c-review.md:142`）。インラインのコードスパンは正しく除外される（「1 行ずつ描画」する実装の性質） | **改善レーン。** ベースライン更新（`D-335` で改善レーンの手番とされている件）と同じ手番が自然 | **新規** |
| 5 | **`migration-banner-never-shown-on-desktop`** | — | 本サブで是正済み（`fc0611a`。`DataMigrationBanner` を `ComboListPage` にもマウント。`ComboListPage.banners.test.tsx` が固定） | — | **★既存行の更新**（`M28-02c`（同乗）／未着手 → **解消済み**） |

---

## §5 参考（触れていない＝不変の証跡）

- `docs/design/` と `migrations/` の差分 **0**（`git diff --numstat 233f48e HEAD -- docs/design migrations` が空）
- `docs/handover/change-number-registry.md` 不変（CHANGE を消費していない）
- `web/CLAUDE.md` §1 のブラウザストレージ台帳 不変（`check-browser-storage-keys.sh` 緑）
- `COLUMN_DEFINITIONS` / `ColumnVisibility` / `combo-list-columns-v1` 不変（指示書 §3-5）
- `go.mod` / `package.json` 不変（新規依存 0）
- 判定式の**生成 SQL は着手前と同一**（定数連結にしただけ。§1-2）
- 既存 4 面の行アクション不変（`showCopy` の既定 `true`）
- 常設検査 8 本 緑（1 本目は `check-artifact-integrity.sh`）。★`check-md-emphasis.sh` のみ赤だが着手前からであり本サブ由来ではない（§4-4）
- `go test ./...` ／ `-tags=debug` ／ `make test-web`（2480）／ `make e2e`（**250 passed**）緑

---

## §6 CHANGE 起票のたたき台（設計担当向けチェックリスト）

**番号は起票時に `change-number-registry.md` で採番すること。★製造は自採番していない。**

| 宛先 | 反映内容 |
|---|---|
| **`DES-002` §4.2** | 経路 3 行から「**★未実装**」を外し、§1-1 の as-built（実 DTO・エラー契約の全行・母集団・**持たせなかった分岐**）を書く ／ `COUNT` の記述を §1-3 の形へ改める |
| **`DES-003` §3.4** | 判定式の記述を「SELECT と WHERE の 2 つ」から **§1-2 の 4 経路**へ ／ **「削除・復元は基準に触らない」を不変条件として明記**（§1-4-3） |
| **`DES-005` §5.19b** | 「**★未実装**」を外す ／ **行アクションは 詳細 / 編集 / 削除（コピーは出さない）**（§1-4）／ **上限 1000 件と打ち切りの出し方**（§1-5）／ 戻り先の限界（§1-6） |
| **`DES-005` §5.6** | 注記から「**★未実装**」を外す |
| **`SUPP-001` §4.5 ほか** | **E2E を debug ビルドで回すことの as-built**（§2-1。**受理する場合のみ**） |
| `CHANGE-162` §0 | 「本 CHANGE が書くものは、まだ実装されていない」が失効した旨 |

**マイグレ**: **本サブは 1 本も作っていない。⇒ 次に払い出す番号は `000106` のまま**（`ls migrations/` の末尾が `000105` であることを実査）。

---

## §7 教訓（retrospective 行き）

> **★親（設計卓）は本節を読まなくてよい。** 宛先は `retrospective-log` へのバッチ反映であり、実施者は設計担当（反映担当の廃止＝2026-08-11 に伴う）。

| # | 教訓（一般形） |
|---|---|
| 1 | **「テストで作れない状態」は仕様の穴ではなく観測の穴である。⇒ 観測の口を先に作らないと、破壊確認そのものが成立しない。** 本サブは「初回は必ず 0 件」なので、口が無ければ E2E は永久に空の画面を見ていた |
| 2 | **センチネルを注入するテストは「契約が在る」ことしか示さない。「契約に届く」ことは、本物のエラーから作らないと示せない。** 503 `database_busy` は sentinel テストが緑のまま実配線で到達不能だった（レビュー高-2） |
| 3 | **共有部品を再利用するときは、必須 prop に no-op を渡した箇所を疑うこと。** 「押しても何も起きないボタン」はそこに生える。本サブは「黙って何も起きない」を繰り返し警戒しながら、警戒の外側の列でそれを作っていた（レビュー高-1） |
| 4 | **E2E の重複判定キーは spec 固有にすること。★単独で緑でも全数で赤になる。** 本サブは位置だけを変えた版が他 spec と `VAL-C02` で衝突した。**⇒ 他 spec が先頭を使う資源（通常技リスト）は末尾から取る**（`E-232` の具体的な回避形） |
| 5 | **破壊確認は「赤が出た」で終わらせない。「言いたいことを表す主張」で落ちているかを見ること。** 本サブの (a) は最初、別の主張が先に落ちており、並べ替えて壊し直した（`7908e0b`） |
| 6 | **完了報告の「レビュー結果を参照する欄」は Phase C の後にしか書けない**（`D-510`）**。⇒ 本サブは実装直後に書いた版へプレースホルダを置き、存在しないファイルへのリンクも張らなかった。機構として働いた** |
| 7 | **「1 か所を直すときは、同じ前提に乗っている記述を全数拾う」の再確認。** 本サブは `routes.go` の godoc の失効（「12 ルート」）を、射程外だが直した。**放置すると次の担当が旧の記述を前提としてコピーする** |

---

*以上、M28-02c 設計伝達レポート。* **★★親の裁定が要るのは §2-1 の 1 件である。** **★次に重いのは §1-1**——**`DES-002` §4.2 の 3 行が「未実装」のまま残ると、次の担当が「まだ作られていない」を前提に読む。**
