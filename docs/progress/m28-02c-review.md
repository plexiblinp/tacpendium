# M28-02c レビュー報告書

| 項目 | 内容 |
|------|------|
| 対象指示書 | `docs/instructions/M28-02c-game-update-backend-remainder.md` **v1.0.0** |
| チェックリスト | `docs/instructions/reviews/M28-02c-review-checklist.md` **v1.0.0** |
| 着手基点 | `233f48e` → `98cc43d`（10 コミット／58 ファイル／+3,444 / -19 行） |
| レビュー日 | 2026-09-07 |
| 実施範囲 | コード読取・機械検査の実走・Go / Vitest の実走（コード変更なし） |

## 総評

**チェックリスト §7 の「重大」10 項目は 0 件である。** 本サブで最も落ちやすい「判定式の書き写し」は、行レベル述語 `affectedMoveCondSQL` を 1 本だけ置き、EXISTS／SELECT 派生列／列挙／`buildListWhere` 共有の `COUNT` の 4 経路すべてをそこから組む形になっており、しかも `go/ast` でパッケージ内の文字列リテラルを走査して「マーカーと基準の両方に言及する文字列は 1 本だけ」を主張する構造テストが付いている。リポジトリ全体を grep しても判定式は 1 本しか無い。分水嶺（延期はバナーだけ抑止／ボタンは残す）、`HomePage` ＋ `ComboListPage` の 2 か所マウント、取得失敗を 0 件にしない、`?? false` 不在、列設定共有物の不可触も、いずれも実装とテストの両方で押さえられている。破壊確認 3 件は実走され、(a) が意図どおりの主張で落ちないことに気づいて spec を並べ替えた形跡（`7908e0b`）まで残っている。

一方で、**画面に「押しても何も起きないボタン」が 1 個生えている**（専用画面の［削除］）。本サブが繰り返し警戒してきた「黙って何も起きない」型の実害が、警戒していなかった側の列に出た。加えて、**エラー契約に書いた 503 `database_busy` が実配線では到達不能**であり、テストが sentinel を直接注入するため緑のまま通っている。**`progress-log.md` の索引行も未追記**で `check-progress-log-index.sh` が NG 1 件を返す（完了条件 6 未達）。

「高」は 4 件、「中」は 4 件、「低」は 5 件。いずれも局所修正で閉じられる。

---

## 設計準拠性レビュー結果

### 束 A — `affectedMoves`（チェックリスト §1）: ◎

| # | 観点 | 評価 | 実測 |
|---|---|---|---|
| ★★1 | 判定式が 1 か所から導かれ、2 本ある状態を作れないことが構造で示されているか | **◎** | `internal/repository/combo/repository.go:408` の `affectedMoveCondSQL` が唯一。`affectedByGameUpdateCondSQL`（真偽）／ `affectedByGameUpdateExprSQL`（SELECT 派生列）／ `listAffectedMovesSQLTemplate`（列挙）が文字列連結でこれを取り込む。`m28_02c_predicate_source_test.go` が `go/ast` でパッケージ内の非テスト `.go` を走査し、`last_changed_game_version` と `baseline_version` の両方を含む文字列リテラルが 1 本であることを主張。**リポジトリ全体を grep しても複製は無い**（`internal/api/debug` の `UPDATE` 2 本は述語ではなく列書き込み）。 |
| ★★2 | バッチ取得（N+1 回避） | **◎** | `listAffectedMovesByComboIDs` が `IN (?,…)` で 1 クエリ。`List` の末尾で 1 回だけ呼ぶ。**しかも `AffectedByGameUpdate == true` の行が 0 件ならクエリを撃たない**（初回は必ず 0 件という前提に合っている）。 |
| ★3 | `nameJa` が引けないときの `code` フォールバック | **◎** | サーバは `omitempty` で落とし、画面側が `m.nameJa?.trim() \|\| m.code`。`findMoveLabelsByIDs` と同一形の `LEFT JOIN preset_aliases`。先例（`starterMoveNameJa`）の作法どおり。 |
| ★★4 | 空のときに `[]` を明示 | **◎** | `attachAffectedMoves` が全行へ `[]model.AffectedMove{}` を先に敷き、`toComboResponse` にも nil→`[]` のフォールバックがある（二重）。ハンドラテストで `map[string]any` のキー存在を確認。 |
| ★★5 | `affectedMoves.length` で真偽を判定する経路が 1 つも無いか（画面・API・テスト） | **○** | 判定は全経路で `affectedByGameUpdate`。`ComboTableRow.tsx:191` と `ComboDetailMetadata.tsx:152` の `affectedMoves.length > 0` は**いずれも「印を出すか」ではなく「文字列を並べるか / `-` を出すか」の描画分岐**であり、外側が `combo.affectedByGameUpdate &&` で括られている（詳細側）か、全行が該当する専用画面（表側）。真偽の二重表現にはなっていない。テスト側（`TestAffectedMoves_AgreesWithTheBooleanOnEveryRow`）の `hasMoves != AffectedByGameUpdate` は不変条件の主張であり、判定経路ではない。 |

**リポジトリ層への取り付け位置も妥当**：`attachComboChildren` に入れたため、`FindByID`（通常詳細）と `FindByIDAllowDeletedWithChildren`（ゴミ箱詳細）の 2 面が同じヘルパを通る。**応答から `affectedMoves` が落ちる詳細経路が構造的に無い。**

### 束 B — 告知の経路 2 本 ＋ `COUNT`（チェックリスト §2）: ○

| # | 観点 | 評価 | 実測 |
|---|---|---|---|
| ★★1 | 常に 200 で `{currentDataVersion, affectedCount, postponedForVersion?}` | **◎** | 0 件でも 200（`TestGameUpdateNotice_AlwaysReturns200`）。`postponedForVersion` は現在版と一致するときだけ載る。 |
| ★★2 | `COUNT` が判定式を共有しているか | **◎** | `Count` は `List` から括り出した `buildListWhere` を通す。**判定式を持たず、WHERE 組み立てごと共有する**形なので「式が 2 本」自体が起こらない。`TestCountMatchesListFilter` が 5 通りのフィルタで実 DB の件数と行数の一致を主張し、ゴミ箱行が入らないことも押さえている。 |
| ★★3 | 一覧 API の `count` で代用していないか | **◎** | 代用していない。`TestCountIsNotCappedByListLimit` が `limit=1` の `List`（1 行）と `Count`（3）の差で裏返しを固定。 |
| ★★4 | `postpone` が本文を取らず、サーバが現在版を読むか | **◎** | ハンドラは本文を読まない。Vitest 側にも「延期ボタンは要求本文を送らない」がある。 |
| ★5 | 保存先が `filepath.Dir(dbPath)` 直下の `.game-update-notice.json` か | **◎** | `internal/infra/datadir/game_update_notice.go`。tmp→rename。マイグレ 0 消費、ブラウザストレージ台帳も 1 行も動いていない（`check-browser-storage-keys.sh` 緑）。 |
| ★★6 | 延期が抑止するのはバナーだけか | **◎** | `GameUpdateBanner` だけが `postponedForVersion === currentDataVersion` を見る。`AffectedCombosButton` は見ない。Vitest（分水嶺の陽性対照）と E2E の両方で固定。 |
| ★7 | エラー契約の全行が報告に書かれているか | **×** | 書かれてはいるが**内容が実装と一致しない**。→ **高-2**。 |

### 束 C — 専用画面（チェックリスト §3）: △

| # | 観点 | 評価 | 実測 |
|---|---|---|---|
| ★★1 | `ComboTable` / `ComboTableRow` の再利用 | **◎** | 新しい表の仕組みは作っていない。既存の「optional prop があると 1 列生える」型（先例＝`onStatusChange` / `isSelectMode`）に揃えてある。`colSpan` の勘定も `+3` を足してある。 |
| ★★2 | 足す 3 列が専用画面のときだけか。共有物に触れていないか | **◎** | `COLUMN_DEFINITIONS` / `ColumnVisibility` / `combo-list-columns-v1` は 1 文字も動いていない。専用画面は `DEFAULT_COLUMN_VISIBILITY` を渡すため、利用者の列設定に左右されず、また汚しもしない。 |
| ★★3 | 取得失敗を「0 件」として扱っていないか（バナー位置・ボタン位置の 2 か所） | **◎** | `GameUpdateBanner` は `isError` で `game-update-banner-error` ＋ 再試行、`AffectedCombosButton` は `game-update-button-error`、専用画面は `game-update-page-error`。`retry: false` で失敗を早く出す。`isSuccess` のときだけ「ありません」を出しており、**ローディング／失敗が空表に化けない**。 |
| ★4 | 既存の一覧にフィルタ軸を足していないか | **◎** | 増えたのは `AffectedCombosButton` 1 個だけ。Vitest で固定。 |
| ★5 | キャラ横断で統一され、ボタン文面に「全キャラ」があるか | **◎** | `listButton`「更新未確認のコンボ({{count}} 件・全キャラ)」／ `bannerBody`「(全キャラ合計)」／ `pageLead`「(全キャラ)」。キャラは「見出し ＋ 表」を縦に並べている。 |
| ★6 | ルートが `/game-update/combos` か | **◎** | `router.tsx`。理由（`/combos/affected` を採らない）もコメントに残っている。 |
| — | **表の［削除］が no-op** | **×** | → **高-1**。 |
| — | **`limit: 1000` の無告知打ち切り** | **△** | → **中-1**。 |

### 束 D — 告知バナーと詳細（チェックリスト §4）: ◎

| # | 観点 | 評価 | 実測 |
|---|---|---|---|
| ★★1 | マウント先が `HomePage` ＋ `ComboListPage` の 2 か所か | **◎** | 両方にある。`ComboListPage.banners.test.tsx` が**マウント先の存在そのもの**を固定しており、E2E のビューポート依存の主張に頼っていない。 |
| ★★2 | 移行告知バナーのマウント先も増えたか。コミットが分かれているか | **◎** | `fc0611a fix(M28-01/web): 移行告知バナーを ComboListPage にもマウントする` が独立コミット。`followup` `migration-banner-never-shown-on-desktop` の是正。 |
| ★3 | バナーとボタンが同時に出るか | **◎** | 隠す条件は無い。Vitest「バナーとボタンが同時に出る」で固定。 |
| ★★4 | 印を出しているのがコンボ詳細だけか | **◎** | 専用画面・一覧・マイコンボには印が無い（`combo-detail-game-update-mark` は `ComboDetailMetadata` のみ）。 |
| ★★5 | ゴミ箱詳細で印は出てボタンは出ず、理由が添うか | **◎** | `inTrash` prop。文面は `DES-005` §5.6 の逐語「ゴミ箱の項目は確認できません。復元すると確認できます。」と一致。Vitest で固定。 |
| ★★6 | FE 型 3 分岐で必須か。`?? false` が無いか | **◎** | `ComboSummary` / `Combo` を必須化（`ComboDetail` は `ComboSummary` を継承）。**`?? false` は `web/src` に 1 か所も無い**（grep 実測）。 |
| ★7 | `baselineVersion` が無いときに「不明」＋印か | **◎** | 表・詳細とも `?? t("gameUpdate.baselineUnknown")`＝「不明」。「-」ではない。Vitest 2 本で固定。 |
| ★8 | エクスポートへ前提バージョン・印が出ていないか | **◎** | `export-model.test.ts` に非出力の主張が足されている。 |

### テストの妥当性（チェックリスト §5）: ◎（1 か所抜け）

| # | 観点 | 評価 | 実測 |
|---|---|---|---|
| ★★1 | 人工的に古い基準を作ってから流しているか | **◎** | Go 側は `setMarker` / `setBaseline` で判定表 6 行を全部作る。E2E も `beforeAll` でマーカーと基準を人工的に置き、**さらに `MARKER < currentDataVersion` を前提として主張**して分離が崩れたら止まるようにしている。「初回は 0 件」の罠を正面から踏んでいない。 |
| ★★2 | `COUNT` と一覧の集合一致を実 DB で主張しているか | **◎** | 上述。ゴミ箱行の除外まで含む。 |
| ★3 | 延期の保存・読み出し・版が上がったら外れること | **◎** | `datadir` と `api/notice` の 2 階層で持っている。壊れた JSON を「延期していない」に倒す（安全側）テストもある。 |
| ★4 | 取得失敗が 0 件と区別されること／実 `ja.json` を引く `t` | **◎** | 4 ファイルとも `import "@/lib/i18n";`。21 テスト実走緑。 |
| ★5 | `make e2e-only P=<パターン>` を使っているか | **◎** | 報告に `make e2e-only P=m28-02c`。`playwright` 直叩きは無い。 |
| — | **E2E が `.game-update-notice.json` を戻していない** | **△** | → **中-2**。 |

### 破壊確認（チェックリスト §6）: ◎

3 件とも「壊して赤を見て、戻して緑を見た」記録が完了報告 §8 にあり、**(a) は最初『言いたいことを表す主張』ではなく別の主張が先に落ちていたことに気づいて spec を並べ替え、再度壊し直している**（コミット `7908e0b` が独立に残っている）。破壊確認としての質が高い。

### §7 重大の判定（完了承認を妨げるもの）: **0 件**

| # | 内容 | 判定 |
|---|---|---|
| ★★1 | 判定式が 2 か所に在る | **無し**（構造テスト＋全文 grep で確認） |
| ★★2 | `affectedMoves.length` で影響の有無を判定 | **無し** |
| ★★3 | 取得失敗を「0 件」として扱っている | **無し**（3 か所とも失敗として出る） |
| ★★4 | 画面側に `?? false` | **無し** |
| ★★5 | 延期でボタンまで消える | **無し** |
| ★★6 | `HomePage` だけにマウント | **無し** |
| ★★7 | `COUNT` を一覧 API の `count` で代用 | **無し** |
| ★★8 | 列設定の共有物を触っている | **無し** |
| ★9 | 契約と実装がずれているのに設計卓へ請求していない | **無し**。完了報告 §11 が「契約そのもののずれは 0 件、失効したのは『★未実装』の注記 4 か所だけ」と一覧にしており、指示書 §6-5 の「契約どおりなら 0 件のはず」に正しく答えている |
| ★10 | `docs/design/` 編集 ／ `followup-backlog.md` §J 以外の編集 ／ 番号の自採番 | **無し**。`git diff --numstat 233f48e HEAD -- docs/` の出力は `docs/progress/M28-02c-completion-report.md` の 1 行のみ。`migrations/` の差分 0、`change-number-registry.md` 不変 |

### `E-225`（新規追加のはずのファイルに deletions が付いていないか）: **クリア**

`git diff --numstat` で deletions を持つのは 8 ファイル（`dto.go` / `routes.go` / `repository.go` / `playwright.config.ts` / `ComboEditor.tsx` / `ComboTable.tsx` / `types.ts` / `TrashComboDetailPage.tsx`）だけで、**いずれも意図した既存ファイルの編集**。新規テストファイル・新規 spec はすべて追加のみ（上書きで消えたテストは無い）。

### E2E のための debug 書き込み口（2026-09-07 開発者確定分の実装妥当性）

| # | 観点 | 判定 |
|---|---|---|
| 1 | 本番ビルドへ漏れていないか | **○**。`internal/api/debug/game_version.go` は `//go:build debug` 配下。`routes.go` も同ファイル群（既存の debug パッケージは build tag で分岐し、本番は `routes_noop.go`）。**`go build ./...` と `go build -tags=debug ./...` の両方が通ることを実走確認**。 |
| 2 | E2E の分離が壊れていないか | **○**。マーカー（`2020.06.01.00`）も基準（`2020.01.01.00`）も**現在版より古い**値を選び、他 spec のコンボ（基準＝現在版）を巻き込まない形にしてある。`beforeAll` で `MARKER < current` を主張して前提崩れを検出する。E-232 の轍を正面から避けている。 |
| 3 | 共有状態を戻しているか | **△**。`afterAll` でマーカーを NULL へ戻し、作ったコンボを削除している。**ただし 2 本目のテストが書いた `.game-update-notice.json` は戻していない**（→ **中-2**）。 |
| 4 | 入力の検証 | **○**。`gameversion.Validate` を通す。DB 側 `CHECK` と同じ書式を見るので、崩れた値で 500 にならない。 |

---

## 設計準拠性以外の指摘事項

### 1. `internal/api/notice/game_update.go` — 503 分岐が到達不能で、godoc が事実と違う

```go
// ErrDatabaseBusy は write lock を取れなかったことを表す(サービス層から包んで渡す)。
var ErrDatabaseBusy = errors.New("notice: database busy")
```

**本経路にサービス層は無い。** `cmd/tacpendium/main.go` が渡す 2 本のクロージャは `comborepo.Count` と `gamerepo.CurrentDataVersion` を直接呼び、返るのは `fmt.Errorf("count combos: %w", err)` で包まれた `modernc.org/sqlite` のエラーである。`combosvc.busyOr` に相当する翻訳が挟まっていないため、**`errors.Is(err, notice.ErrDatabaseBusy)` は本番配線では決して true にならない**。`TestGameUpdateNotice_ErrorContract` は sentinel を直接注入するため緑になる。

完了報告 §4 のエラー契約表も「write lock を取れない → 503 `database_busy`（`notice.ErrDatabaseBusy` で包んで渡す）」と書いており、**次の担当はこれを実在の契約として読む**。

### 2. `web/src/pages/GameUpdateCombosPage.tsx` — ［削除］が押しても何も起きない

```tsx
<ComboTable combos={combos} onDelete={() => undefined} … />
```

`ComboTableRow` は `onDelete` の有無に関わらず**常に**［削除］ボタンを描く（`ComboTableRow.tsx:267-273`）。専用画面では押しても確認ダイアログも出ず、行も消えず、失敗表示も出ない。**本サブが「取得失敗を 0 件にしない」「ボタンだけ黙って消さない」で徹底して避けてきた『黙って何も起きない』の実物**が、警戒していなかった側の列に出ている。既存の先例（`onStatusChange` / `isSelectMode`）と違い `onDelete` は必須 prop なので、no-op を渡す以外に選択肢が無い形になっている。

### 3. `web/src/lib/query-keys.ts` — 注記のフィールド数が失効

```ts
/** ★例外: ComboListFilter は 11 フィールドの束であり、位置引数へ展開できない。 */
```

`ComboListFilter` の実測は **14 フィールド**（本サブが `affectedByGameUpdate` と `limit` を足した）。作法 3 の例外を正当化する根拠の数字であり、`queryKeys` の例外を増減するときに読まれる行である。

### 4. `web/src/features/game-update/api.ts` — 生 `fetch` が 2 か所

`useGameUpdateNotice` は `fetchJSON` を使っているが、`usePostponeGameUpdateNotice` と `useAcknowledgeComboVersion` は生 `fetch` でエラー整形を手書きしている。**直近の同型の先例**（`web/src/features/data-migration/useDataMigrationNotice.ts` — 同じ告知系の POST）**は `fetchJSON<void>(path, { method: "POST" })` を使っており**、`fetchJSON` は 204 を `undefined` で返す実装になっている（まさに本件の形）。`API_BASE` の一元化からも外れる。

### 5. `GameUpdateHandler.Postpone` — `dir == ""` のとき保存せず 204 を返す

```go
if h.dir == "" {
    return c.NoContent(http.StatusNoContent)
}
```

保存できていないのに成功を返す。現在の配線では `dir` は常に非空なので実害は無いが、**ハンドラの godoc がこの状態を「サポートする状態」として明記している**（「dir が空なら延期を持てない」）以上、成功で返すのは「失敗を成功として扱う」型である。500 か、少なくとも `postponedForVersion` を返さない現状の `Get` 側との整合の説明が要る。

### 6. `web/src/pages/GameUpdateCombosPage.tsx` — `limit: 1000` の打ち切りが画面に出ない

`affectedCount` が 1000 を超えると、バナーとボタンは総数を出すのに表は 1000 行までしか出ず、**画面はその食い違いを一言も言わない**。`CHANGE-162` §6.3 自身が「1 回のバランス調整で 1 キャラのコンボが数十件まとめて当たる形は普通に起きる」と書いており、全キャラ分では 1000 到達は非現実的な想定ではない。「部分データを全部として見せる」は `combo-list-setup-count-hides-fetch-failure` と同じ族である。

### 7. `web/e2e/m28-02c-game-update.spec.ts` — 共有状態を 1 つ戻していない

`afterAll` はマーカーの NULL 復帰とコンボ削除を行うが、2 本目のテストが `POST /api/notices/game-update/postpone` で書いた `.game-update-notice.json` を消していない。**`webServer` の `rm -rf web/e2e/.tmp` が run ごとに救っているだけ**であり、指示書 §5 の「★サーバの共有状態を書き換えないこと（`D-399` (1)）」の規律としては穴が残る。将来 spec の実行順が変わったり、告知を見る spec が増えたときに黙って落ちる形。

### 8. `web/e2e/m28-02c-game-update.spec.ts` — 冒頭コメントの列挙が test ブロック数と合わない

```
//   1: バナー → 専用画面 →「問題なし」→ 件数が減る、の往復
//   2: 破壊確認 (a) 画面を開いただけで基準が進まないこと
//   3: 破壊確認 (b) 延期してもボタンが消えないこと
//   4: 破壊確認 (c) 640px 以上でもバナーが出ること
```

実際の `test()` は 2 本で、(a) と (c) は 1 本目に同居している。番号付きの列挙は「4 本ある」と読める。完了報告 §7 は「E2E ・2 本」と正しく書いているので、失効しているのは spec 側のコメントだけである。

### 9. 判定式の構造テストの走査範囲

`m28_02c_predicate_source_test.go` は `filepath.Glob("*.go")`＝**自パッケージのディレクトリだけ**を見る。現時点で複製は無い（リポジトリ全文 grep で確認済み）が、`internal/service/` や別のリポジトリパッケージへ書き写した場合は検出しない。テスト自身の godoc は「本パッケージの非テストコードを走査し」と正しく限定しているので誤記ではないが、**守備範囲が想定より狭い**ことは覚えておく価値がある。

### 10. `ComboDetailMetadata.tsx` — 空の `<dd>` が描画される

`affectedByGameUpdate === true` かつ `affectedMoves.length === 0` のとき、外側の `<dd className="mt-1 text-xs …">` だけが中身無しで出る。実運用では起きない組み合わせだが（両者は同じ述語から出る）、`ComboDetailMetadata.gameUpdate.test.tsx:90` が**まさにその組み合わせを陽性対照として作っている**ので、描画上は空要素が出る。

### 11. `AcknowledgeVersionButton` の成功表示が一瞬しか出ない

`onSuccess` で `combo.all()` を invalidate → 詳細が再取得 → `affectedByGameUpdate` が false → **成功メッセージを含むブロックごとアンマウント**される。`CHANGE-162` §6.2 が「✓ 問題なしにしました」を「操作結果の表示」として明示的に残した唯一の例外なので、見えないまま消えるなら意図と食い違う。専用画面側（`acknowledgeFailedId` で失敗だけ出す形）は行が消えるので自然だが、詳細側は「押した結果」を利用者が読めるべき面である。

### 12. コーディング規約・その他

- **Go**: エラー wrap（`%w`）、`context.Context` 第一引数、公開 API の godoc、JSON タグ camelCase（`moveId` / `nameJa` / `lastChangedGameVersion`）——すべて準拠。`fmt.Println` / `console.log` の混入なし。`nolint` / `eslint-disable` の追加なし。
- **TypeScript**: `any` なし、`strict` 通過（`tsc --noEmit` は完了報告が緑と報告、`check-import-order.sh` はベースラインどおり）。
- **依存**: 新規依存 0（`go.mod` / `package.json` 不変）。indirect→direct 昇格も無し。
- **i18n**: ja / en とも 29 キーが対応。日本語文面は `DES-005` の逐語（「更新未確認」「問題なし」「このコンボはゲームの更新後も問題ないと記録します」「ゴミ箱の項目は確認できません。復元すると確認できます。」）と一致。
- **セキュリティ**: debug 書き込み口は `//go:build debug` 配下のみ。`gameversion.Validate` を通すので任意文字列の注入は無い（そもそも placeholder バインド）。本番ビルドに 1 バイトも出ないことをビルド 2 本で確認。

### 13. 機械検査の実走結果（レビュー側で再実行）

| 検査 | 結果 |
|---|---|
| `scripts/check-artifact-integrity.sh`（1 本目） | **違反なし**（自己検査 14 件 ／ 生成物 4 件 OK） |
| `scripts/check-browser-storage-keys.sh` | **違反なし** |
| `scripts/check-import-order.sh` | **ベースラインどおり** |
| `scripts/check-enum-sync.sh` | **ベースラインどおり** |
| `scripts/check-doc-refs.sh` | **dead reference なし** |
| `scripts/check-md-emphasis.sh` | **NG（495 行 / ベースライン 436）。★本サブ由来ではない**——`--list` の内訳に `M28-02c-completion-report.md` は **0 行**。上位は `retrospective-digest.md`(41) / `M26-02-completion-report.md`(40) / `M21-RESEARCH-01-report.md`(40)。完了報告 §9 の主張を実測で追認した。チェックリスト §0.3-4 の対象。 |
| `scripts/check-progress-log-index.sh` | **NG 1 件**——`m28-02c` が `docs/progress/progress-log.md` に現れない。→ **高-3** |
| `go build ./...` / `go build -tags=debug ./...` | **緑**（実走） |
| `go test ./internal/{repository,service}/combo/... ./internal/api/{notice,combo}/... ./internal/infra/datadir/...` | **緑**（実走） |
| Vitest（新規 4 ファイル・21 テスト） | **緑**（実走） |

---

## 推奨修正（優先度別）

### 高（M28 完了前に修正必須）

- **高-1 専用画面の［削除］を no-op のまま出さない**（`web/src/pages/GameUpdateCombosPage.tsx` / `web/src/features/combo/components/ComboTableRow.tsx`）
  `ComboTable.onDelete` を optional にし、`ComboTableRow` 側を `{onDelete && (<button …>)}` にして専用画面では［削除］を描かない——のが最小。あるいは専用画面で実際に削除できるようにする（要設計判断）。**どちらにせよ「押しても何も起きないボタン」を残さないこと。**
- **高-2 到達不能な 503 契約を実装か文面のどちらかへ寄せる**（`internal/api/notice/game_update.go` / `cmd/tacpendium/main.go` / 完了報告 §4）
  (a) `main.go` のクロージャで `sqlite` の busy / locked を `notice.ErrDatabaseBusy` へ翻訳する（`combosvc.busyOr` と同型）か、(b) 503 分岐・sentinel・godoc「サービス層から包んで渡す」・完了報告 §4 の該当行をまとめて落とす。**(b) を採るならテストの 503 ケースも一緒に落とすこと**（sentinel を直接注入して緑になるテストが残ると、次の担当が契約の存在を信じる）。
- **高-3 `docs/progress/progress-log.md` へ索引行を追記する**（`CLAUDE.md` §8 ／ 指示書 §6-6 ／ チェックリスト §9-6）
  `bash scripts/check-progress-log-index.sh` が NG 1 件。日付・作業 ID（`m28-02c`）・結果・報告書リンク ＋ 横断課題（`check-md-emphasis.sh` の既存赤）を 1 行で。
- **高-4 `web/src/lib/query-keys.ts` の「11 フィールド」を実測値へ直す**（実測 14）
  数字が根拠として置かれている注記であり、本サブが 2 つ足したことで失効した。**較正どおり「高」に置く**——動作は正しいままなので、テストも lint も型検査も緑になり、人が読む以外に見つける経路が無い。

### 中（M29 着手と並行可）

- **中-1 専用画面の 1000 件打ち切りを画面に出す**（`GameUpdateCombosPage.tsx`）
  `combosQuery.data.items.length` が `notice.data.affectedCount` に満たないときに「〇〇 件中 1000 件を表示しています」等を出す。**総数の正本が告知 API 側にある構造は正しい**ので、突き合わせて差を言うだけでよい。
- **中-2 E2E で `.game-update-notice.json` を戻す**（`web/e2e/m28-02c-game-update.spec.ts`）
  延期を解除する経路が無いなら、debug 側へ「延期の記録を消す」口を 1 本足すか、2 本目を `test.describe.serial` の末尾に固定したうえで「戻せないことと、`rm -rf` が救っていること」を spec に明記する。**いまは戻していないのに `afterAll` のコメントが「共有 DB を元へ戻す（D-399 (1)）」と書いてあるため、読み手は全部戻ったと読む。**
- **中-3 `Postpone` の `dir == ""` を成功で返さない**（`internal/api/notice/game_update.go`）
  500 にするか、少なくともこの分岐が「保存していない 204」であることを godoc と完了報告 §4 の「持たせなかった分岐」表へ明記する。
- **中-4 `game-update/api.ts` の 2 つの mutation を `fetchJSON` へ寄せる**
  同じ告知系の先例（`useDataMigrationNotice`）と揃える。`fetchJSON` は 204 を `undefined` で返すので、そのまま置き換えられる。

### 低（将来対応）

- **低-1** E2E spec 冒頭コメントの 4 項目列挙を、test ブロック 2 本の内訳が分かる形へ（(a)(c) は 1 本目に同居、と書く）。
- **低-2** `ComboDetailMetadata` の `affectedMoves` 用 `<dd>` を、中身があるときだけ描く（空 `<dd>` を出さない）。
- **低-3** 判定式の構造テストの走査範囲を `internal/` 全体へ広げるか、「自パッケージのみを見る」という限界を godoc へ 1 行足す（現在の godoc は正確だが、読み手は「リポジトリ全体を見ている」と受け取りやすい）。
- **低-4** `AcknowledgeVersionButton` の成功表示が invalidate で即座に消える件。`CHANGE-162` §6.2 が唯一の例外として残した表示なので、意図どおり見えるか（トースト等へ移すか）を一度決める。
- **低-5** `listAffectedMovesSQLTemplate` の `LEFT JOIN preset_aliases` は、同一 move × 同一 preset に alias が複数あると `DISTINCT` 後も 2 行になる。`findMoveLabelsByIDs` も同じ形なので**本サブ由来ではない**が、列挙側は 1 コンボに複数行が並ぶため見え方に出る。

---

## 良かった点

1. **判定式の一本化を「振る舞い」ではなく「構造」で担保した。** `go/ast` で文字列リテラルを走査し「マーカーと基準の両方に言及する文字列は 1 本だけ」を主張する形は、チェックリスト §0.4-1 が「ふつうのテストデータでは両方同じ答えを返して緑になる」と警告した穴に正面から答えている。**しかも `TestDerivedSQLSharesTheSinglePredicate` で 4 つの利用者が実際にその 1 本を取り込んでいることまで押さえてあり、片方だけ書き換えても赤になる。**
2. **`COUNT` を「判定式の共有」ではなく「`buildListWhere` の共有」で解いた。** 述語を持たせないので「式が 2 本」自体が起こらない。しかも `TestCountMatchesListFilter` が 5 通りのフィルタで実 DB の件数＝行数を主張し、ゴミ箱行の除外まで含む。指示書 §5-2 の要求より一段強い。
3. **「初回は必ず 0 件」の罠を正面から踏んでいない。** Go は判定表 6 行を人工的に作り、E2E は古い基準を作ったうえで**さらに前提（`MARKER < current`）が崩れたら止まる主張**まで置いた。E2E が DB を 1 本共有する（`E-232`）ことを踏まえてマーカーを現在版より**古く**選ぶ設計は、他 spec の巻き込みを構造的に断っており、思考の跡が明快。
4. **破壊確認 (a) を「赤が出た」で終わらせなかった。** 最初は言いたいことと違う主張が落ちていることに気づき、spec を並べ替えて壊し直し、その手直しを独立コミット（`7908e0b`）で残している。**破壊確認が形式になっていない。**
5. **`affectedMoves` の取り付け位置を `attachComboChildren` にした判断。** 通常詳細とゴミ箱詳細の 2 面が同じヘルパを通るため、応答から列挙が落ちる詳細経路が構造的に無い。`E-76`（2 か所に書くと片方だけ育つ）の既存コメントの意図に沿っている。
6. **列設定の共有物に一切触れず、`DEFAULT_COLUMN_VISIBILITY` を渡す形にした。** 「触らない」だけでなく「利用者の設定に左右されない」まで解いており、台帳も 1 行も動いていない。
7. **`ComboListPage.banners.test.tsx` が「マウント先が 2 か所ある」ことそのものを固定した。** E2E のビューポート依存の主張だけに頼らない二重化であり、`migration-banner-never-shown-on-desktop` が「テストでは気づけない」型だったことへの正しい応答。
8. **完了報告 §11 が「設計書に反映が要る箇所」を 4 件、失効の型を明記して一覧にした。** 「契約そのもののずれは 0 件、失効したのは『★未実装』の注記だけ」という切り分けは正確で、しかも**それが較正上「高」に当たる型であることを自分で書いている。**
9. **移行告知の是正を独立コミットに分けた**（指示書 §2.5-6）。同乗の判断と分離の作法がどちらも守られている。

---

## 制約事項

- 本レビューはコード上で判定可能な範囲のみ対象。実際の動作確認・パフォーマンス・実機テストは別途実施が必要。
- `make e2e`（249 passed）および `make test-web`（2477 tests）は完了報告の記載を採用し、本レビューでは再実行していない（Go の対象パッケージ、新規 Vitest 4 ファイル、常設検査 7 本、`go build` 2 本は再実走した）。
- 破壊確認 3 件は完了報告 §8 の記録を採用した（レビュー側でコードを壊す実験は行っていない＝コード変更禁止のため）。**ただし (b) と (c) は Vitest / E2E に陽性対照が常設されており、記録に依らず継続的に検出される形になっていることを確認した。** (a) は E2E 1 本目の中の主張として常設。
- **不明: `affectedCount` が実運用で 1000 を超えうるかは判断できない**（利用者のコンボ総数と 1 回のバランス調整で当たる技の広がりに依存する）。中-1 は「超えたときに黙る」構造への指摘であり、超える蓋然性の主張ではない。

---

*以上、M28-02c レビュー報告書。* **★本サブの中心（判定式の一本化・分水嶺・2 か所マウント・取得失敗の非隠蔽）は、いずれも実装とテストの両方で押さえられている。⇒ チェックリスト §7 の重大は 0 件である。** **★残った「高」4 件はいずれも局所であり、うち 3 件（高-2 / 高-3 / 高-4）は「実装は正しいのに記述・追記が追いついていない」型である**——**動作は正しいままなのでテストも lint も型検査も緑になり、人が読む以外に見つける経路が無い。⇒ 較正どおり「高」に置いた。** **★高-1（no-op の［削除］）だけが利用者に見える実害であり、これは本サブが最も警戒していた「黙って何も起きない」型が、警戒の外側の列に出たものである。**

---

## 取り込み結果（自動トリアージ）

| 項目 | 内容 |
|---|---|
| トリアージ日 | 2026-09-07 |
| 実施 | 製造担当 Claude Code（`/implement_plan_full` Phase C） |
| **「高」指摘の不採用** | **0 件**（⇒ 開発者へのエスカレーションは発生していない） |
| 採用 | **12 件**（高 4 ／ 中 4 ／ 低 4） |
| 不採用 | **1 件**（低 1 ／ 理由は下記） |
| 再レビュー往復 | **0 回**（初回のみ。上限 2 回に達していない） |

### 高（4 件・すべて採用）

| # | 指摘 | 採否 | 対応と理由 |
|---|---|---|---|
| **高-1** | 専用画面の［削除］が no-op | **採用** | **`ComboTable` / `ComboTableRow` の `onDelete` を optional にし、渡されない面では［削除］そのものを描かない形にした。** 専用画面は `onDelete` を渡さない。★指摘のとおり「押しても何も起きないボタン」であり、本サブが繰り返し避けてきた『黙って何も起きない』の実物である。**既存の呼び手はすべて `onDelete` を渡しているため挙動は不変。** |
| **高-2** | 503 `database_busy` が実配線で到達不能 | **採用**（案 (a)） | **`gameUpdateError` が `dbinfra.IsBusy(err)` でも判定する形にした。** ⇒ 呼び手が包み忘れても 503 へ届く。★案 (b)（契約ごと落とす）を採らなかった理由＝**`Count` は書き込みトランザクションと同じ DB を読むため busy は実在しうる**（実測: 別コネクションで書き込みロックを握ると `SQLITE_BUSY` が返る）。契約を消すと、起きたときに 500 になり利用者は再試行の判断ができない。★godoc の「サービス層から包んで渡す」も事実へ書き直した（本経路にサービス層は無い）。★**sentinel ではなく実 DB で起こした本物の busy エラーから 503 になることを主張するテストを足した** —— sentinel を注入するテストだけでは、まさに今回の穴が塞げない。 |
| **高-3** | `progress-log.md` の索引行が未追記 | **採用** | Phase D で追記した（本コマンドの工程順どおり。指摘時点では未実施が正しい状態）。`check-progress-log-index.sh` の緑を確認済み。 |
| **高-4** | `query-keys.ts` の「11 フィールド」が失効（実測 14） | **採用** | 14 へ是正。★較正どおり「高」である —— 動作は正しいままなのでテストも lint も型検査も緑になり、人が読む以外に見つける経路が無い。**本サブが 2 つ足したことで失効させた当事者である。** |

### 中（4 件・すべて採用）

| # | 指摘 | 採否 | 対応と理由 |
|---|---|---|---|
| **中-1** | 1000 件打ち切りが画面に出ない | **採用** | **総数（告知 API の `affectedCount`）と表示件数を突き合わせ、食い違うときに注記を出す形にした**（`gameUpdate.pageTruncated`）。★「部分データを全部として見せる」は `combo-list-setup-count-hides-fetch-failure` と同じ族であるという指摘に同意する。★上限は `PAGE_LIMIT` として定数化した（マジックナンバーを置かない）。 |
| **中-2** | E2E が `.game-update-notice.json` を戻していない | **採用** | **debug ビルドへ `DELETE /api/debug/notices/game-update` を足し、`afterAll` で消す形にした。** ★本番に「延期の解除」という操作は無い（版が上がれば自然に外れる）ので、本番経路としては作っていない。★`rm -rf web/e2e/.tmp` に頼ると、告知を見る spec が後から増えたときに実行順で黙って落ちる、という指摘に同意する。★ファイル名は `datadir` の 1 か所に保つため `RemoveGameUpdateNotice` を足して経由させた。 |
| **中-3** | `Postpone` の `dir == ""` が保存せず 204 | **採用** | **500 で失敗させる形にした。** ★「保存できないのに成功を返す」は「延期したのに次も出る」を利用者が説明できない形になる。テストも足した。 |
| **中-4** | mutation 2 本が生 `fetch` | **採用** | **`fetchJSON` へ寄せた。** ★同じ告知系の先例（`useDataMigrationNotice`）と揃う。`fetchJSON` は 204 を `undefined` で返す実装であり、本経路の形そのものである。`API_BASE` の一元化からも外れなくなった。 |

### 低（5 件・4 件採用 / 1 件不採用）

| # | 指摘 | 採否 | 対応と理由 |
|---|---|---|---|
| **低-1** | E2E spec 冒頭の 4 項目列挙が test 2 本と合わない | **採用** | 「(a) と (c) は 1 本目に同居している」と書く形へ是正した。★失効した記述の型である。 |
| **低-2** | 空の `<dd>` が描画される | **採用** | 中身があるときだけ描く形にした。 |
| **低-3** | 構造テストの走査範囲が自パッケージのみ | **採用** | **`internal/` 全体へ広げた。** ⇒ 判定式を別パッケージへ書き写しても検出する。★「自パッケージだけを見る形にすると『よそへ写す』が素通しになり、守りたいものの半分しか守れない」——指摘に同意する。★走査対象が少なすぎたら止まる主張も置いた（パスの前提が崩れたときに黙って緑にならないため）。 |
| **低-4** | 成功表示が invalidate で即消える | **採用** | **トースト（`sonner`）へ移した。** ★`CHANGE-162` §6.2 が「✓ 問題なしにしました」を**唯一の例外**として明示的に残した表示であり、見えないまま消えるのは意図と食い違う、という指摘に同意する。★詳細画面は成功すると当該ブロックごとアンマウントされるため、面の外へ出す以外に方法が無い。 |
| **低-5** | `LEFT JOIN preset_aliases` の alias 重複 | **★不採用** | **理由: 本サブ由来ではなく、直すなら既存の `findMoveLabelsByIDs` と同じ手番で直すのが筋だからである。** 両者は同一の JOIN 形であり、片方だけ直すと「同じ名前解決が 2 つの流儀を持つ」状態になる（`E-76` の型）。**⇒ 本サブの射程外として横断課題に残した**（`progress-log.md` の M28-02c 節）。★レビュー自身も「本サブ由来ではない」と明記している。★実害の程度は「同一 move × 同一 preset に alias が複数ある場合に列挙が 2 行になる」であり、`official_ja_move` は move ごとに 1 件を想定した運用のため現状では起きない。 |

### 取り込み後の実行結果（すべて緑）

| コマンド | 結果 |
|---|---|
| `go test ./...` | **緑** |
| `go test -tags=debug ./...` | **緑** |
| `make test-web` | **緑**（216 files / 2477 tests） |
| `make e2e` | **緑**（**249 passed**） |
| `make e2e-only P=m28-02c` | **緑**（2 passed） |
| `cd web && pnpm exec tsc --noEmit -p tsconfig.json` | **緑** |
| 常設検査 7 本（`check-artifact-integrity.sh` を 1 本目） | **違反なし** |
| `check-md-emphasis.sh` | **NG（496 / ベースライン 436）。★下記参照** |

> **★`check-md-emphasis.sh` の +1 について。** レビュー報告書 §「設計準拠性以外の指摘事項 3」のコードフェンス内に `/** ★例外: … */` を引用した行が在り、これが 1 行として数えられている。
> **★本検査は「1 行ずつ描画」する実装であり、コードフェンス（```）を認識しない**（インラインのコードスパンは除外する）。⇒ **フェンス内の `/**` は構造上かならず当たる偽陽性である。**
> **★レビュー報告書の本文は書き換えていない**（引用としては正しい記述であり、検査を通すために他者の報告書を編集しない）。**⇒ 検査側の限界として横断課題に残した。**
> **★なお着手前から 495 行で赤であり（ベースライン 436）、その 59 行は本サブ由来ではない**——本サブは `.md` を 1 行も触っていなかった（`git diff --stat 233f48e 98cc43d -- '*.md'` が空）。

*以上、取り込み結果（自動トリアージ）。* **★「高」指摘の不採用は 0 件である。** **★不採用は低-5 の 1 件のみで、理由は「本サブ由来ではなく、直すなら既存実装と同じ手番で直すのが筋」である。**
