# M23-RESEARCH-01 調査報告: ゴミ箱・復元の実態調査（8 軸）

| 項目 | 内容 |
|------|------|
| 文書ID | M23-RESEARCH-01-report |
| 対象指示書 | `docs/instructions/M23-RESEARCH-01-trash-and-restore-baseline.md`（v1.0.0・2026-08-20） |
| 作成日 | 2026-08-20 |
| 作成者 | 製造担当 Claude Code（調査モード・read-only / judgement-free） |
| baseline commit | **`39678e2`（2026-08-20）** `Merge pull request #80 from plexiblinp/claude/m22-close-m23-m24-kickoff-s4pyd3` |
| 作業ブランチ | `claude/research-plan-m23-01-ng09z1` |
| dev DB | **不在**（後述 §0.3）。**軸 G-4 / H-5 は未実査** |

---

## 0. 冒頭に置くもの

### 0.1 本報告が数えた範囲（`E-93`）

| 範囲 | 内容 |
|---|---|
| **Go 本番コード** | `internal/` 配下の `*.go` から `*_test.go` を除いた全ファイル。`cmd/` を PRAGMA 走査でのみ含む |
| **Go テスト** | `internal/` 配下の `*_test.go` 全ファイル |
| **フロント** | `web/src/` 配下の `*.ts` / `*.tsx`（`node_modules` 除外）。テストは別枠で数えた |
| **E2E** | `web/e2e/` 配下の `*.spec.ts` 全 40 本 |
| **マイグレ** | `migrations/` 配下の `*.up.sql` / `*.down.sql` 全件 |
| **設計書** | `docs/design/05-screen-design.md` §5.15 ／ `docs/handover/architecture-patterns.md` §11 ／ `docs/instructions/M23-overview.md` §1〜§4 |
| **範囲外** | dev DB の実データ（不在）。`docs/postmortem/`。`human-notes/` |

**★本報告の「無い」はすべて上表の範囲での「無い」である**（`E-106`）。**範囲外に在る可能性は排除していない。**

### 0.2 走査に使ったコマンドの全文

```bash
# 基点
git log -1 --format='%h %ad %s' --date=short
git status --porcelain

# 軸 A / B（ゴミ箱画面）
find web/src -iname '*rash*'
grep -rln "trash\|Trash" web/src internal migrations
grep -rn "TrashPage" --include=*.tsx --include=*.ts web/src
grep -rn "queryKey" --include=*.ts --include=*.tsx web/src | grep -v node_modules | grep -v '\.test\.'
grep -n "^export interface" web/src/features/combo/types.ts
grep -n "deletedAt" web/src/features/combo/types.ts web/src/types/*.ts

# 軸 C（セットプレイ側・4 層）
cat internal/api/setup/routes.go internal/api/combo/routes.go
grep -rn "Restore\|restore"   --include=*.go internal/ | grep -v "_test.go"
grep -rn "Permanent\|permanent" --include=*.go internal/ | grep -v "_test.go"

# 軸 D / E / G / H（SQL 全数）
grep -rn "deleted_at" --include=*.go internal/ | grep -v "_test.go"
grep -rn -iE "(FROM|JOIN|UPDATE|INTO)[[:space:]]+combos\b" --include=*.go internal/ | grep -v "_test.go"
grep -rn -iE "(FROM|JOIN|UPDATE|INTO)[[:space:]]+setups\b" --include=*.go internal/ | grep -v "_test.go"
grep -rn "materialized_from_combo_id\|MaterializedFromComboID\|materializedFromComboId" \
     --include=*.go --include=*.ts --include=*.tsx --include=*.sql . | grep -v node_modules
grep -rn "only_deleted\|OnlyDeleted\|include_deleted\|IncludeDeleted" \
     --include=*.go --include=*.ts --include=*.tsx . | grep -v node_modules
grep -rn "ListFilter{" --include=*.go internal/ | grep -v "_test.go"
grep -rn "CalcRecipeHash\|recipe_hash\|RecipeHash" --include=*.go internal/ | grep -v _test.go
grep -rn "FindComboIDsBySetupID" --include=*.go internal/ | grep -v _test.go
grep -rn "ParentComboIDs\|parentComboIds" --include=*.go --include=*.ts --include=*.tsx internal/ web/src

# 軸 F（CASCADE / PRAGMA）
grep -rn "foreign_keys\|SetMaxOpenConns\|SetMaxIdleConns\|_pragma\|busy_timeout\|journal_mode" \
     --include=*.go internal/ cmd/ | grep -v "_test.go"
cat internal/infra/db/db.go internal/testutil/dbtest/dbtest.go
grep -rn "REFERENCES combos(id)" migrations/*.up.sql
grep -rn "ON DELETE CASCADE" migrations/*.up.sql
grep -rn "HardDelete\|PermanentDelete" --include=*_test.go internal/
grep -rn -B2 -A20 "HardDelete(ctx, tx" --include=*_test.go internal/ | grep -iE "combo_steps|combo_tags|combo_oki"

# E2E
grep -rln "trash\|restore\|permanent" web/e2e/

# dev DB 探索（軸 G-4 / H-5）
find / -name 'combomgr*.db' -o -name '*.db' -path '*combomgr*' 2>/dev/null
ls -la ~/.local/share/
grep -n "db\|data/" .gitignore
```

### 0.3 ★dev DB は本セッションに存在しない（軸 G-4 / H-5 は未実査）

**`find / -name 'combomgr*.db' -o -name '*.db' -path '*combomgr*'` は 0 件。** `ls -la ~/.local/share/` は `gem` / `pnpm` / `uv` のみで `combomgr/` が無い。`.gitignore:24-27` が `*.db` / `*.db-journal` / `*.db-shm` / `*.db-wal` を除外しているため、**クラウド実行環境の使い捨てコンテナ（リポジトリを新規 clone した状態）には dev DB が構造的に存在しない。**

**⇒ 軸 G-4 / H-5 は「未実査」である**（`E-181`＝**未実査は「未実査」と書けばよく、断定だけが欠陥である**）。**空 DB を作って回す案は採らなかった**——母集団がゼロで全件 0 になり、問いに答えられないうえ、DB ファイル生成は read-only を厳密には逸脱するため（開発者の判断＝2026-08-20 本セッション）。**開発者が手元で回せる SQL を §G-4 / §H-5 に完成形で置いた。**

### 0.4 read-only の逸脱が無いことの証拠（DoD-8）

着手時 `git status --porcelain` = **空**。本報告作成時点の差分は、指示書 §0.2 が許可した **2 ファイルのみ**である。

```
?? docs/progress/M23-RESEARCH-01-report.md      ← §5 の調査レポート（許可 1）
 M docs/progress/progress-log.md                 ← 索引行の追記（許可 2・CLAUDE.md §8）
```

**本番コード ／ マイグレ ／ seed ／ `docs/design/` ／ `docs/handover/` ／ `docs/instructions/` ／ テスト ／ `web/e2e/` の差分は 0 である。**

---

## 1. 結論サマリ（先に読む用・事実のみ）

| 軸 | 一行の実態 |
|---|---|
| **A** | **★「自動完全削除までの残日数」は実在する**（`TrashListRow.tsx:12-22, 97-107`。`TRASH_RETENTION_DAYS = 90` のクライアント側計算）。**画面本文にも「90 日後に自動的に完全削除されます」と書いてある**（`TrashPage.tsx:31`）。**★だが自動完全削除を実行するコード・ジョブは 1 行も存在しない**（走査 0 件）。**表示だけが在り、機構が無い** |
| **B** | **専用 API は無い。** `GET /api/combos?character_id={id}&only_deleted=true` の絞り込み 1 本。queryKey は `["combos","trash",characterId]`。**セットプレイの削除済み一覧を取る経路は無い** |
| **C** | **★セットプレイの復元・完全削除は 4 層すべてに無い**（ルート・ハンドラ・サービス・リポジトリ）。**`setups.deleted_at` を NULL に戻す SQL は本番コードに 0 件。** ⇒ `DELETE /api/setups/:id` で消したセットプレイは、現状どこからも戻せない |
| **D** | 復元は `UPDATE combos SET deleted_at = NULL, updated_at = datetime('now') WHERE id = ? AND deleted_at IS NOT NULL`。**子には何もしていない**（子は物理的に残っている）。**★`PATCH` / `PUT` / `PATCH setups` はいずれも `WHERE ... AND deleted_at IS NULL` を持つ ⇒ 削除済み行は編集できない ⇒ 復元のすり抜けは構造的に起きない**。復元は `version` に触れない |
| **E** | **combos を読む SQL 15 本中、述語を持つ 11 本 ／ 持たない 3 本 ／ 部分的 1 本。** setups を読む SQL 14 本中、**持つ 13 本 ／ 持たない 1 本**。**★`hiddenCurations` の除外は実装と一致している**（`punish/queries.go:178`） |
| **F** | `HardDelete` は `combo_setup_results` → `combo_setups` → `combos` を明示削除。**残り 5 つの子テーブルは CASCADE 依存**（`combo_steps` / `combo_tags` / `combo_oki_options` / `combo_punishes` / `combo_punish_curations`）。**`PRAGMA foreign_keys = ON` は `*sql.DB.Exec` で 1 回だけ ／ `SetMaxOpenConns` は本番コードに 0 件 ⇒ `P-04` の影響下にある。★CASCADE 依存の 5 表が消えたことを主張するテストは 0 件** |
| **G** | **★旧行と新行を結びつける情報は現状 1 つも無い。** (a) `materialized_from_combo_id` は `PUT` 経路で書かれない（`buildComboFromInput` が同フィールドを設定しない ⇒ 常に NULL）／(b) 時刻の近接は同一トランザクションだが列としての結び付けは無い／(c) `recipe_cache` は `PUT` で必ず変わる想定／(d) それ以外の列も無い。**★`PUT` が積んだ旧行は、現在ゴミ箱の一覧に出ている** |
| **H** | 重複判定 `FindActiveByDuplicateKey` は `deleted_at IS NULL` を持つ ⇒ **削除済み行は判定の外**。`recipe_hash` は**列ではなく計算値**（`CalcRecipeHash`・SHA-256）。**復元の経路は重複判定を通らない** |

---

## 2. 軸別の報告

---

## A. ゴミ箱画面（`TrashPage`）の現状

### A-1 実態: `TrashPage` が実際に表示している項目（全数）

**構成ファイルは 5 本。**

| ファイル | 役割 |
|---|---|
| `web/src/pages/TrashPage.tsx`（61 行） | ページ本体 |
| `web/src/features/combo/components/TrashBulkActions.tsx`（99 行） | 一括操作バー |
| `web/src/features/combo/components/TrashList.tsx`（76 行） | テーブル |
| `web/src/features/combo/components/TrashListRow.tsx`（144 行） | 行 |
| `web/src/features/combo/hooks/useTrashCombos.ts`（13 行） | 取得フック |

**ページ全体（`TrashPage.tsx`）**

- `<Header sticky />`（`Header.tsx:36` に `{ to: "/trash", label: "ゴミ箱" }` のナビ項目が在る）
- `<h1>ゴミ箱</h1>`（`:29`）
- **説明文「削除したコンボは 90 日後に自動的に完全削除されます。」**（`:31`）
- ローディング「読み込み中...」（`:35`）／ エラー「読み込みに失敗しました」（`:40`）
- **キャラは `DEFAULT_CHARACTER_ID = 1` にハードコード**（`:9`。`// TODO(M3+): 複数キャラ対応時に CharacterSelector コンポーネントに差し替える`）

**テーブルの列（`TrashList.tsx:45-60`・8 列）**

| # | 列見出し | 中身（`TrashListRow.tsx`） |
|---|---|---|
| 1 | （チェックボックス） | 全選択 `aria-label="全選択"`（`:47-51`）／ 行選択 `aria-label="コンボ {id} を選択"`（`:76-80`） |
| 2 | **始動状況** | `formatStarterStatus(combo)` を `<Link to={/combos/${combo.id}}>` で包む（`:83-85`） |
| 3 | **ダメージ** | `formatDamage(combo.damage)`（`:88`） |
| 4 | **ルート** | **★固定文字列 `(レシピ表示なし)`**（`:91`）。実データを出していない |
| 5 | **タグ** | **★固定文字列 `-`**（`:93`）。実データを出していない |
| 6 | **削除日時** | `formatDeletedAt(deletedAt)` = `YYYY-MM-DD HH:mm`（`:24-28, 95`）。null なら `-` |
| 7 | **残日数** | **後述 A-2** |
| 8 | **操作** | 「復元」ボタン（`:109-116`）／「完全削除」ボタン（`:117-124`） |

**空状態**: `combos.length === 0` のとき **「ゴミ箱は空です」**（`TrashList.tsx:35-39`）。テーブル自体を描画しない。

**行のエラー表示**: 復元／完全削除に失敗すると、当該行の直下に `colSpan={8}` の `role="alert"` 行を出す（`TrashListRow.tsx:127-135`）。文言は `復元に失敗しました: {message}` ／ `完全削除に失敗しました: {message}`。

### A-2 ★「自動完全削除までの残日数」は**実在する**

**実在する。** 根拠は `web/src/features/combo/components/TrashListRow.tsx` の逐語:

```ts
12: const TRASH_RETENTION_DAYS = 90;
13:
14: function calculateRemainingDays(deletedAt: string): number {
15:   const deletedDate = new Date(deletedAt);
16:   const expirationDate = new Date(
17:     deletedDate.getTime() + TRASH_RETENTION_DAYS * 24 * 60 * 60 * 1000,
18:   );
19:   const now = new Date();
20:   const remainingMs = expirationDate.getTime() - now.getTime();
21:   return Math.ceil(remainingMs / (24 * 60 * 60 * 1000));
22: }
```

```tsx
 97: <TableCell className="tabular-nums">
 98:   {remainingDays !== null ? (
 99:     remainingDays > 0 ? (
100:       <span className="text-slate-600">あと {remainingDays} 日</span>
101:     ) : (
102:       <span className="font-medium text-red-600">期限切れ</span>
103:     )
104:   ) : (
105:     "-"
106:   )}
107: </TableCell>
```

**★ただし「自動完全削除」を実行する機構は存在しない。**

| 走査 | 結果 |
|---|---|
| `grep -rn "TRASH_RETENTION\|retention\|90" --include=*.go internal/ cmd/` の retention 系 | **0 件**（Go 側に保持期間の概念が無い） |
| `grep -rn "cron\|ticker\|time.Tick\|scheduler\|purge\|cleanup" --include=*.go internal/ cmd/` | 定期実行で完全削除する経路 **0 件** |
| `TRASH_RETENTION_DAYS` の参照元 | `TrashListRow.tsx:12, 17` のみ（**フロント 1 ファイルに閉じる**） |

**⇒ 90 日という値はフロントの 1 定数にしか存在せず、期限切れになっても行は消えない。** 「期限切れ」表示が出た行は、そのまま無期限に残る。

### A-3 「一括復元」「一括完全削除」は**実在する**。単位は**チェックボックスで選択したもの**

`TrashBulkActions.tsx`。

- 表示条件: **`selectedIds.length === 0` のとき `null` を返す**（`:62`） ⇒ **1 件も選択していないと操作バー自体が出ない**
- 「{n} 件選択中」（`:66`）／「**選択を復元**」（`:73`）／「**選択を完全削除**」（`:81`）
- **単位は `selectedIds`（画面上で選択した行）であり、「画面上の全件」ではない**。ただし `TrashList.tsx:23-25` の全選択チェックボックスが `combos.map(c => c.id)` を渡すため、**全選択 → 一括** で実質的に「表示中の全件」になる
- **実装は 1 件ずつの API を `Promise.allSettled` で並べているだけ**（`:28-30, 47-49`）。**一括用のエンドポイントは無い**（B-1 参照）
- 失敗時は `{n} 件失敗: ID 3, ID 7` の形で `role="alert"` に出す（`:86-90`）
- 完全削除は `PermanentDeleteConfirm` の確認ダイアログを挟む（`:91-96`。`count` を渡す）

### A-4 コンボとセットプレイは**混ざっていない**（コンボのみ）

`useTrashCombos` が返すのは `ComboListResponse` で、`TrashList` の props も `combos: ComboSummary[]`。**セットプレイを取得・表示するコードは `TrashPage` 系 5 ファイルに 1 行も無い**（走査＝`grep -n "setup\|Setup" web/src/pages/TrashPage.tsx web/src/features/combo/components/Trash*.tsx web/src/features/combo/hooks/useTrashCombos.ts` → **0 件**）。

### A-5 行クリックで開く詳細は**読み取り専用ではなく、そもそも開けない見込み**

- 行全体に `onClick={() => navigate(`/combos/${combo.id}`)}`（`TrashListRow.tsx:71-74`）。2 列目にも同じ先への `<Link>`（`:83`）
- **★遷移先の `GET /api/combos/:id` は削除済みコンボを返さない。** `service.Get`（`internal/service/combo/service.go:319-327`）→ `repo.FindByID` → `selectComboByIDSQL`（`internal/repository/combo/repository.go:349-364`）:

```sql
FROM combos
WHERE id = ? AND deleted_at IS NULL
```

  `ErrNotFound` → ハンドラが **404 `{"error":{"code":"not_found","message":"コンボが見つかりません"}}`**（`internal/api/combo/handler.go:114-116`）

**⇒ ゴミ箱の行をクリックすると、コンボ詳細画面は 404 の側に落ちる。** 「読み取り専用のコンボ詳細」を出す経路は実装されていない。**`FindByIDAllowDeleted`（`repository.go:408-431`・`WHERE id = ?` のみ）は存在するが、参照しているのは `service.PermanentDelete`（`service.go:805`）1 か所だけである**（走査＝`grep -rn "FindByIDAllowDeleted" --include=*.go internal/ | grep -v _test.go` → 定義 2 行 + 呼出 1 行）。

> **★本項は「404 になる」を実コードから導いた推論であり、実機で HTTP を叩いて確認したものではない**（dev サーバ未起動）。**SQL の述語と 404 分岐は逐語で確認済み。**

### A-6 `TrashPage` 系のテスト（全数）

**★`web/src/pages/TrashPage.test.tsx` は存在しない**（`ls web/src/pages/*.test.tsx` の 11 本に無い）。テストは配下コンポーネント／フックに在る。

| ファイル | ケース数 | 各ケースが主張していること |
|---|---|---|
| `TrashList.test.tsx` | **8** | ①コンボ一覧を 2 行表示する ②空リストで「ゴミ箱は空です」 ③**削除 30 日前 → 残日数 60 日** ④**削除 91 日前 → 「期限切れ」** ⑤チェックボックス選択で `onSelectionChange` が呼ばれる ⑥全選択で全 ID が選択される ⑦復元ボタンで `POST /api/combos/:id/restore` が呼ばれる ⑧完全削除ボタンで確認ダイアログが出る |
| `TrashListRow.test.tsx` | **5** | ①始動状況セルクリックで `navigate` が 1 回のみ ②復元失敗時に `role=alert` ③完全削除失敗時に `role=alert` ④完全削除成功時にエラーが出ない ⑤復元成功時にエラーが出ない |
| `TrashBulkActions.test.tsx` | **5** | ①`selectedIds` が空なら `null` ②要素があれば操作ボタンが出る ③一括復元で 3 件分 POST ④一括完全削除で確認 → DELETE ⑤一部失敗で `role=alert` |
| `useTrashCombos.test.ts` | **3** | ①`only_deleted=true` を含む URL で送る ②正常系で一覧を返す ③HTTP エラーで `error` をセット |
| `usePermanentDelete.test.ts` | **3** | ①`DELETE /api/combos/:id/permanent` に送る ②404 で throw ③409 で throw |
| **合計** | **24** | |

**★`useRestoreCombo` 専用のテストファイルは無い**（`ls web/src/features/combo/hooks/useRestoreCombo*` → 実装 1 本のみ）。復元は上記の `TrashList` / `TrashListRow` / `TrashBulkActions` から間接的に触られている。

**★E2E は 0 件。** `grep -rln "trash\|restore\|permanent" web/e2e/` のヒット 2 本は **`/trash` 画面と無関係**——`m22-03-optimistic-locking.spec.ts:81` と `m22-04-conflict-ux.spec.ts:45` が**後片付けとして `request.delete('/api/combos/:id/permanent')` を叩いているだけ**である。**全 40 spec のうち、ゴミ箱画面を開く spec は 0 本。**

### A-2〜A-6 の契約・正典との差

`DES-005` §5.15 の逐語:

```
### 5.15 ゴミ箱

**表示項目**：
1. 論理削除されたコンボ・セットプレイ一覧（削除日時、自動完全削除までの残日数）
2. 一括復元・一括完全削除ボタン

**アクション**：
- 行クリック → 詳細表示（読み取り専用のコンボ詳細）
- 復元ボタン → 論理削除解除
- 完全削除ボタン → 確認ダイアログ後、物理削除

**レスポンシブ**：コンボ一覧と同様。
```

| `DES-005` §5.15 の記述 | as-built | 差 |
|---|---|---|
| 論理削除された**コンボ**一覧 | 実在（8 列） | 一致 |
| 論理削除された**セットプレイ**一覧 | **無い**（A-4） | **差あり** |
| 削除日時 | 実在（列 6） | 一致 |
| **自動完全削除までの残日数** | **表示は実在（列 7）／ 機構は無い**（A-2） | **表示は一致・裏付けが無い**。`M23-overview` §1.3-2 は「**`DES-005` §5.15 の現行記述『自動完全削除までの残日数』は撤回が要る**」と既に判断している |
| 一括復元・一括完全削除ボタン | 実在（A-3） | 一致 |
| 行クリック → **読み取り専用のコンボ詳細** | 遷移はするが **`GET /api/combos/:id` が 404 を返す**（A-5） | **差あり** |
| 復元ボタン → 論理削除解除 | 実在 | 一致 |
| 完全削除ボタン → 確認ダイアログ後、物理削除 | 実在（`PermanentDeleteConfirm`） | 一致 |
| レスポンシブ：コンボ一覧と同様 | `TrashList.tsx:42` に `overflow-x-auto` のみ | **未実査**（コンボ一覧側の実装と突合していない。本軸の範囲外と判断） |

### 後続スコープへの含意

- **`M23-01`**（`DES-005` §5.15 の撤回と as-built 化）: A-1 の 8 列 ／ A-2 の「表示は在るが機構は無い」 ／ A-5 の 404 ／ A-4 のセットプレイ不在 が直接の入力。**★列 4「ルート」と列 5「タグ」が固定文字列である事実も as-built 化の対象になる**（`DES-005` は列構成を書いていないため、契約違反ではなく未記述の領域）
- **`M23-02`**（セットプレイ側の欠け）: A-4 が「無い」の 1 つ目の根拠。2 つ目は軸 C
- **`M23-06`**（ゴミ箱の UX）: A-3 の「1 件も選択していないと操作バーが出ない」 ／ A-1 のキャラ ID ハードコード ／ E2E 0 件

### 推奨（複数案の併記・決定はしない）

- **残日数の扱い**: 案 1＝表示ごと撤去する ／ 案 2＝表示を残し「自動削除はしない」と文言を変える ／ 案 3＝実際に自動完全削除を実装する（**`M23-overview` §1.3-2 が `D-458` で明示的に否定している方向**）
- **行クリック先**: 案 1＝`GET /api/combos/:id` に `include_deleted` 相当を足す ／ 案 2＝`FindByIDAllowDeleted` を使う読み取り専用の別ルートを足す ／ 案 3＝行クリックの遷移自体を外す

---

## B. ゴミ箱一覧の取得経路

### B-1 実態: 専用 API は無い。**既存 `GET /api/combos` の絞り込み**

`web/src/features/combo/hooks/useTrashCombos.ts`（全文 13 行）:

```ts
export function useTrashCombos(characterId: number) {
  return useQuery({
    queryKey: ["combos", "trash", characterId],
    queryFn: () =>
      fetchJSON<ComboListResponse>(
        `/api/combos?character_id=${characterId}&only_deleted=true`,
      ),
  });
}
```

`internal/api/combo/routes.go` の登録ルートは 11 本で、**ゴミ箱専用のルートは無い**:

```
POST   /combos                  POST   /combos/check-duplicate
GET    /combos                  GET    /combos/:id
PATCH  /combos/:id              PUT    /combos/:id
DELETE /combos/:id              POST   /combos/:id/restore
DELETE /combos/:id/permanent    GET    /combos/:id/recipe
POST   /combos/:id/materialize
```

**一括操作用のエンドポイントも無い**（A-3 のとおりフロントが 1 件ずつ叩く）。

### B-2 クエリパラメータとサーバ側の SQL 述語（逐語）

**ハンドラ**（`internal/api/combo/handler.go:241-245`）:

```go
if c.QueryParam("only_deleted") == "true" {
    filter.OnlyDeleted = true
} else if c.QueryParam("include_deleted") == "true" {
    filter.IncludeDeleted = true
}
```

**★`only_deleted` が `include_deleted` を上書きする**（`else if` のため）。両方 `true` で送ると `OnlyDeleted` だけが立つ。この挙動は `internal/api/combo/handler_test.go:416` `TestHandler_List_OnlyDeleted_OverridesIncludeDeleted` で守られている。

**リポジトリ**（`internal/repository/combo/repository.go:685-689`）:

```go
if filter.OnlyDeleted {
    whereParts = append(whereParts, "deleted_at IS NOT NULL")
} else if !filter.IncludeDeleted {
    whereParts = append(whereParts, "deleted_at IS NULL")
}
```

**⇒ ゴミ箱の絞り込みは `deleted_at IS NOT NULL` の 1 述語のみ。** `character_id = ?` と組み合わさる（`repository.go:653` 付近の `filter.CharacterID`）。

**★`is_draft` で絞っていないため、仮登録（`is_draft = 1`）の削除済みコンボもゴミ箱に並ぶ**（`ListFilter.IsDraft` はフロントが送っていない）。

**`ListFilter` を構築している箇所は本番コードに 3 か所**（`grep -rn "ListFilter{" --include=*.go internal/ | grep -v _test.go`）:

| 場所 | `OnlyDeleted` / `IncludeDeleted` |
|---|---|
| `internal/api/combo/handler.go:182` | クエリパラメータ由来（上記） |
| `internal/service/comboio/export.go:101-111` | **どちらも設定しない ⇒ 既定の `deleted_at IS NULL`。CSV エクスポートに削除済みは載らない** |
| `internal/service/punishfinder/service.go:296` | **どちらも設定しない ⇒ 既定** |

### B-3 queryKey（実値）

| フック | queryKey |
|---|---|
| `useTrashCombos` | **`["combos", "trash", characterId]`** |
| `useCombos`（通常一覧・`web/src/features/combo/api.ts:70`） | `["combos", filter]` |
| `useCombo`（詳細・`api.ts:82`） | `["combo", numId]` |
| `useRecentCombos`（`web/src/hooks/useRecentCombos.ts:7`） | `["combos", "recent"]` |

**invalidate 側**（ゴミ箱に効くもの）:

| 場所 | queryKey |
|---|---|
| `useRestoreCombo.ts:17` | `["combos"]` |
| `usePermanentDelete.ts:17` | `["combos"]` |
| `api.ts:118 / 175 / 193 / 208` | `["combos"]` |
| `features/combo-io/api.ts:123` ／ `features/punish/api.ts:148` ／ `features/mycombo/hooks/useUpdateMyComboStatus.ts:26` | `["combos"]` |

**⇒ `["combos"]` は prefix マッチで `["combos","trash",N]` を含むため、復元・完全削除の invalidate はゴミ箱一覧に届く。** ただし `TrashPage.tsx:21, 54` は**それとは別に `refetch()` を明示的に呼んでいる**（二重）。

**★M24（queryKey 統一）との交差**: 一覧系の key が `["combos", filter]` / `["combos","trash",id]` / `["combos","recent"]` の 3 形に分かれており、**第 2 要素がオブジェクト（filter）と文字列（"trash"/"recent"）で型が揃っていない**。これは `M24-RESEARCH-01` 軸 F の入力である。

**★もう 1 つの不揃い**: `useTrashCombos` は共通の `fetchJSON`（`@/lib/api-client`）を使うが、**`useRestoreCombo` / `usePermanentDelete` は素の `fetch` を直接呼んでいる**（`useRestoreCombo.ts:7` / `usePermanentDelete.ts:7`）。エラー整形も両者で独自実装（同一の 4 行）。

### B-4 セットプレイ側の削除済み一覧を取る経路は**無い**

- `internal/api/setup/routes.go` の 11 ルートに `only_deleted` / `include_deleted` に相当するものは無い
- `GET /setups`（`h.ListSetups`）→ `ListByCharacterID`（`internal/repository/setup/repository.go:512-517`）は `WHERE deleted_at IS NULL` 固定（`:517`）で、**切り替えるフラグを持たない**
- `only_deleted` / `include_deleted` の全数走査（§0.2）で `internal/repository/setup/` と `internal/api/setup/` のヒットは **0 件**

### 契約・正典との差

`DES-005` §5.15 は「論理削除されたコンボ・**セットプレイ**一覧」と書くが、**取得経路がコンボ側にしか無い**。

### 後続スコープへの含意

- **`M23-01`**: 「旧行を既定で隠す」（`D-460`）を実装する場所は **`repository.go:685-689` の `OnlyDeleted` 分岐**であり、そこに足す述語が軸 G の結論に依存する
- **`M23-02`**: B-4 が「無い」の 2 つ目の根拠
- **`M23-06`**: 一括操作が N 本の HTTP になっている事実（A-3）と、ページングが `limit` / `offset` である事実（`repository.go:727`）が、件数増加時の見せ方の入力
- **`M24-RESEARCH-01` 軸 F**: B-3 の queryKey 3 形と、`fetchJSON` / 素の `fetch` の混在

### 推奨（併記）

- 旧行を隠す実装位置: 案 1＝リポジトリの `OnlyDeleted` 分岐に述語を足す ／ 案 2＝サービス層でフィルタする ／ 案 3＝新しいクエリパラメータ（`include_superseded` 等）で切り替え可能にする
- セットプレイの削除済み一覧: 案 1＝`GET /setups` に `only_deleted` を足す ／ 案 2＝ゴミ箱専用の集約ルート（`GET /api/trash`）を新設してコンボとセットプレイを 1 応答で返す

---

## C. セットプレイ側の復元・完全削除

### C-1 ★4 層すべてで探した。**復元・完全削除は 1 層も存在しない**

走査は 2 本（§0.2）。**`_test.go` を除いた `internal/` 全体**が範囲。

**`grep -rn "Restore\|restore" --include=*.go internal/ | grep -v "_test.go"` = 全 16 ヒット**

| 層 | ヒット | パッケージ |
|---|---|---|
| repository | `combo/repository.go:151, 152, 926, 946, 951` | **combo のみ** |
| api | `combo/handler.go:422, 425, 431, 435, 441` ／ `combo/routes.go:15, 27` | **combo のみ** |
| service | `combo/service.go:164, 772, 775, 786` | **combo のみ** |
| **setup** | **0 件** | — |

**`grep -rn "Permanent\|permanent" --include=*.go internal/ | grep -v "_test.go"` = 全 12 ヒット**

| 層 | ヒット | パッケージ |
|---|---|---|
| repository | `combo/repository.go:136`（コメントのみ） | **combo のみ** |
| api | `combo/permanent_delete_handler.go:14, 16, 22, 27, 29` ／ `combo/routes.go:16, 28` | **combo のみ** |
| service | `combo/service.go:165, 801, 804` | **combo のみ** |
| **setup** | **0 件** | — |

**ルート層の逐語**（`internal/api/setup/routes.go:6-19`・**11 ルート全数**）:

```go
g.POST("/combos/:comboId/setups", h.CreateSetup)
g.POST("/combos/:comboId/setup-links", h.CreateSetupLink)
g.DELETE("/combos/:comboId/setup-links/:setupId", h.DeleteSetupLink)
g.GET("/setups", h.ListSetups)
g.GET("/setups/candidates", h.GetSetupCandidatesByCharacter)
g.GET("/setups/:id", h.GetSetup)
g.PATCH("/setups/:id", h.UpdateSetup)
g.DELETE("/setups/:id", h.DeleteSetup)
g.GET("/combos/:comboId/setup-candidates", h.GetSetupCandidates)
g.PUT("/combos/:comboId/setups/:setupId/results", h.UpsertSetupResult)
g.DELETE("/combos/:comboId/setups/:setupId/results", h.DeleteSetupResult)
```

**⇒ `/setups/:id/restore` も `/setups/:id/permanent` も無い。**

**`internal/repository/setup/repository.go` の全メソッド 36 個**（`grep -n "^func (r \*repository)"`）を目視した。`Restore` / `HardDelete` / `PermanentDelete` に相当するものは無い。**`SoftDelete`（`:366`）は在るが対になる復元が無い。**

### C-2 `setups.deleted_at` に書き込む経路の全数

**`deleted_at` を含む Go 本番コード行は 59 行**（走査＝`grep -rn "deleted_at" --include=*.go internal/ | grep -v "_test.go" | wc -l`）。**このうち `setups` に書き込むのは 1 か所のみ。**

| 経路 | 場所 | SQL（逐語） |
|---|---|---|
| **論理削除** | `internal/repository/setup/repository.go:366-370` | `UPDATE setups SET deleted_at = datetime('now'), updated_at = datetime('now') WHERE id = ? AND deleted_at IS NULL` |
| **NULL に戻す** | **0 件** | — |

**`UPDATE setups SET deleted_at = NULL` の走査**:

```bash
grep -rn "setups SET deleted_at" --include=*.go internal/     # → 1 件（上記 :369 のみ）
grep -rn "deleted_at = NULL" --include=*.go internal/          # → 1 件（combo/repository.go:949 のみ）
```

**⇒ `setups.deleted_at` を NULL に戻す SQL は本番コードに存在しない。**

呼び出し元は `internal/service/setup/service.go:449-481` `DeleteSetup` の 1 本のみ（`DELETE /api/setups/:id`）。同メソッドは:

```go
449: func (s *service) DeleteSetup(ctx context.Context, setupID int64) error {
450:     tx, err := s.db.BeginTx(ctx, nil)
...
460:     if err = s.repo.SoftDelete(ctx, tx, setupID); err != nil { ... }
...
467:     // 案 P1: combo_setups を明示的に削除（論理削除時は CASCADE 不発火）
468:     if err = s.repo.DeleteComboSetupsBySetupID(ctx, tx, setupID); err != nil { ... }
...
472:     // recipe_cache を物理削除（SUPP-001 §7.5.6）
473:     if err = s.notationSvc.DeleteSetupCache(ctx, tx, setupID); err != nil { ... }
...
477:     if err = tx.Commit(); err != nil { ... }
```

### C-3 ★「無い」と確定した場合の現状（事実の記述）

**`DELETE /api/setups/:id` を実行すると、上記トランザクションで 3 つのことが同時に起きる。**

1. `setups.deleted_at` に現在時刻が入る（論理削除）
2. **`combo_setups` の当該 `setup_id` の行が物理削除される**（`DeleteComboSetupsBySetupID`）⇒ **どのコンボに紐付いていたかの情報が消える**
3. **`setups.recipe_cache` が物理削除される**（`DeleteSetupCache`）

**⇒ 仮に将来 `setups.deleted_at` を NULL に戻す経路を足しても、2 と 3 は復元されない。** セットプレイ本体（`setups` 行 + `setup_steps`）は残るが、**コンボとの紐付けと `recipe_cache` は失われている。**

**★これは欠陥の断定ではなく、事実の記述である**（指示書 §4 C-3）。「戻す経路が無い」という事実と、「戻す経路を足しても紐付けは戻らない」という事実の 2 つを並記する。

**なお `combo_setup_results`（成立条件の検証結果）は、`combo_setups` の物理削除によって 2 段 CASCADE の対象になる。** ただし `DeleteComboSetupsBySetupID` が `combo_setup_results` を明示削除しているかは本軸の範囲外のため**未実査**。

### 契約・正典との差

- `DES-005` §5.15 の「論理削除されたコンボ・**セットプレイ**一覧」「復元ボタン → 論理削除解除」は、**セットプレイについては実装が無い**
- `architecture-patterns` §11「論理削除された親の子は、物理的に残る」は**コンボについては成り立つが、セットプレイについては成り立たない**——`DeleteSetup` が `combo_setups` を明示削除しているため、**子（紐付け）は残らない**。**★同節の一般化はセットプレイに当てはまらない**

### 後続スコープへの含意

- **`M23-02`**（セットプレイ側の欠けを揃える）は **「RESEARCH で『無い』が確定した場合のみ」実施と `M23-overview` §3 が定めている ⇒ 本軸の結論により起動条件を満たす**
- **★`M23-02` のスコープは「復元 API を足す」だけでは閉じない**。C-3 の 2 と 3（紐付けと `recipe_cache`）の扱いを決める必要がある
- **`M23-03`**（復元の単位と子の扱い）: コンボ側とセットプレイ側で「子の扱い」が既に非対称である事実が入力

### 推奨（併記）

- **紐付けの扱い**: 案 1＝`DeleteSetup` で `combo_setups` を消すのをやめ、参照側で `s.deleted_at IS NULL` 除外に委ねる（**除外は既に全 SELECT に入っている＝軸 E**） ／ 案 2＝`combo_setups` にも `deleted_at` を足す（**スキーマ変更**） ／ 案 3＝削除時に紐付けを退避表へ移す（**スキーマ変更**）
- **`recipe_cache`**: 案 1＝復元時に `RecomputeSetupCache` を呼ぶ（**コンボ側の `Restore` が既に同型のことをしている**＝D-1） ／ 案 2＝削除時に消さない

---

## D. 復元時の子の扱い ＋ `version` 据え置きのすり抜け

### D-1 `Restore` を実 SQL まで辿った（逐語）

| 層 | 場所 | 内容 |
|---|---|---|
| ルート | `internal/api/combo/routes.go:27` | `g.POST("/combos/:id/restore", h.Restore)` |
| ハンドラ | `internal/api/combo/handler.go:425-441` | `h.service.Restore(ctx, id)` → 成功後に `h.service.Get` で再取得して 200 で返す |
| サービス | `internal/service/combo/service.go:775-798` | 下記 |
| リポジトリ | `internal/repository/combo/repository.go:946-962` | 下記 |

**サービス層**（`service.go:775-798` 逐語）:

```go
func (s *service) Restore(ctx context.Context, id int64) error {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("begin tx: %w", err)
	}
	defer func() {
		if err != nil {
			_ = tx.Rollback()
		}
	}()

	if err = s.repo.Restore(ctx, tx, id); err != nil {
		return err
	}

	if err = s.notationSvc.RecomputeComboCache(ctx, tx, id); err != nil {
		return fmt.Errorf("recompute cache: %w", err)
	}

	if err = tx.Commit(); err != nil {
		return fmt.Errorf("commit: %w", err)
	}
	return nil
}
```

**リポジトリ層**（`repository.go:946-962`）——**`UPDATE` の対象・`SET` 句・`WHERE` 句の逐語**:

```sql
UPDATE combos
SET deleted_at = NULL, updated_at = datetime('now')
WHERE id = ? AND deleted_at IS NOT NULL
```

`RowsAffected() == 0` なら `ErrNotFound`（`:958-960`）⇒ **削除済みでない行に対する復元は 404 になる**（`handler.go:433-434` 経由）。

### D-2 ★子に対して復元時に何かしているか → **何もしていない**

`Restore` のトランザクション内で触るのは **`combos` 1 表と `recipe_cache` の再計算だけ**である。

| 子テーブル | 復元時の処理 |
|---|---|
| `combo_steps` | **無し** |
| `combo_tags` | **無し** |
| `combo_setups` | **無し** |
| `combo_oki_options` | **無し** |
| `combo_punishes` | **無し** |
| `combo_punish_curations` | **無し** |
| `combo_setup_results` | **無し** |

**これは `code-facts` §10 の前提どおりである**——論理削除では CASCADE が発火しないため子は物理的に残っており、親の `deleted_at` を NULL に戻すだけで子は繋がったまま復帰する。`architecture-patterns` §11 の記述と一致する。

**`RecomputeComboCache` は唯一の例外的な子への作用だが、対象は `combos.recipe_cache` 列そのものである**（`repository.go:1340-1366` の `UPDATE combos SET recipe_cache = ...`）。子表ではない。

### D-3 ★★削除済みの行を `PATCH /api/combos/:id` で編集できるか → **できない**

**`UpdateMetadata` の `WHERE` 句の逐語**（`internal/repository/combo/repository.go:897`）:

```go
query := fmt.Sprintf(`UPDATE combos SET %s WHERE id = ? AND version = ? AND deleted_at IS NULL`,
```

**`deleted_at IS NULL` が在る。**

さらに `RowsAffected() == 0` のときの分岐（`:910-921` 逐語）:

```go
	if rows == 0 {
		// 存在チェックで NotFound か Conflict か区別
		var existsActive int
		row := r.runner(tx).QueryRowContext(ctx,
			"SELECT COUNT(*) FROM combos WHERE id = ? AND deleted_at IS NULL", id)
		if err := row.Scan(&existsActive); err != nil {
			return 0, fmt.Errorf("scan exists: %w", err)
		}
		if existsActive == 0 {
			return 0, ErrNotFound
		}
		return 0, ErrConflict
	}
```

**⇒ 削除済み行への `PATCH` は `existsActive == 0` を通って `ErrNotFound`（404）になる。** 409 Conflict ではなく 404 である。

**★本軸の結論: 復元のすり抜けは構造的に起きない。** 削除済みの行は編集経路から締め出されており、「削除 → 他人が編集 → 復元が古い内容で上書き」という並びは成立しない。**`version` が据え置かれること（`M22-overview` §4.2.1 の (iii)）が問題にならないのは、削除済みの間は `version` が動く経路そのものが無いためである。**

### D-4 `PUT /api/combos/:id` と `PATCH /api/setups/:id` も同様

**`PUT`**（`internal/service/combo/service.go:596-599` 逐語）:

```go
	// 1. 旧コンボの楽観的排他チェック(version 確認 + 論理削除を 1 文で)
	res, execErr := tx.ExecContext(ctx,
		`UPDATE combos SET deleted_at = datetime('now'), updated_at = datetime('now')
		 WHERE id = ? AND version = ? AND deleted_at IS NULL`, oldID, version)
```

**`deleted_at IS NULL` が在る。** 0 行のときの分岐（`:609-622`）も `SELECT COUNT(*) FROM combos WHERE id = ? AND deleted_at IS NULL` で `ErrNotFound` / `ErrConflict` を分ける。

**`PATCH /api/setups/:id`**（`internal/repository/setup/repository.go:388-410`）:

```go
	res, err := exec.ExecContext(ctx, `
		UPDATE setups
		...
		WHERE id = ? AND version = ? AND deleted_at IS NULL`,
```

**`deleted_at IS NULL` が在る**（`:394`）。0 行のときの分岐も `SELECT COUNT(*) FROM setups WHERE id = ? AND deleted_at IS NULL`（`:406`）。

**⇒ 3 経路すべてが削除済み行を締め出している。**

### D-5 復元は `version` に触れない（逐語で裏取り）

D-1 の `SET` 句は **`deleted_at = NULL, updated_at = datetime('now')` の 2 列のみ**。`version` は含まれない。

**論理削除側も同じ**（`repository.go:932`）:

```sql
UPDATE combos SET deleted_at = datetime('now'), updated_at = datetime('now') WHERE id = ?
```

**⇒ `M22-overview` §4.2.1 の「(iii) 据え置き〔論理削除・復元・`recipe_cache`〕」は実装と一致する。**

**★ただし論理削除の `WHERE` には `deleted_at IS NULL` も `version = ?` も無い**（`repository.go:932`）。**⇒ `DELETE /api/combos/:id` は楽観排他を行わず、既に削除済みでも冪等に成功する**（`repository.go:147-148` のコメント「既に削除済みでも冪等(deleted_at を上書き)」と一致。テスト `internal/api/combo/handler_test.go:1036` `TestHandler_Delete_204_OnAlreadyDeleted` が守っている）。**★上書きするため `deleted_at` の値は最後の削除時刻に更新される ⇒ A-2 の残日数計算の基点も動く。**

### D-6 トランザクション境界

| 操作 | Tx | 境界 |
|---|---|---|
| **論理削除** `service.Delete`（`service.go:746-769`） | **張る** | `BeginTx` → `repo.SoftDelete` → `notationSvc.DeleteComboCache` → `Commit`。`defer` で `err != nil` なら `Rollback` |
| **復元** `service.Restore`（`:775-798`） | **張る** | `BeginTx` → `repo.Restore` → `notationSvc.RecomputeComboCache` → `Commit` |
| **完全削除** `service.PermanentDelete`（`:804-831`） | **張る（ただし前チェックは Tx 外）** | **`repo.FindByIDAllowDeleted` と `combo.DeletedAt == nil` の判定は `BeginTx` の前**（`:805-811`）。その後 `BeginTx` → `repo.HardDelete` → `Commit` |

**★`PermanentDelete` の前チェックが Tx 外である事実は、TOCTOU の窓を作る形である**（判定してから `BeginTx` するまでの間に他の利用者が復元しうる）。**在否の記述にとどめ、それが問題かどうかは判断しない。**

### 契約・正典との差

| 契約 | as-built | 差 |
|---|---|---|
| `M22-overview` §4.2.1 (iii)「論理削除・復元は `version` 据え置き」 | 一致（D-5） | 無し |
| `M23-overview` §2.2 論点 1「復元が楽観排他をすり抜ける経路になっていないか」 | **すり抜ける経路は無い**（D-3 / D-4） | **論点の前提が成り立たない**（想定していた危険が実装上は塞がれている） |
| `architecture-patterns` §11「論理削除された親の子は物理的に残る」 | コンボについて一致（D-2） | **セットプレイについては一致しない**（軸 C-3） |
| `DES-002` §6.4 楽観排他 | **未実査**（同節を本報告では読んでいない。実装側の `version = ?` 述語は D-3 / D-4 で確認済み） | — |

### 後続スコープへの含意

- **`M23-03`**（復元の単位と子の扱い）: **D-2 により「復元時に子へ何もしない」が現状であり、`architecture-patterns` §11 が示唆する形が既に成り立っている ⇒ `M23-03` の本体は「子に何かする」ではなく「参照側の除外の穴を塞ぐ」側に寄る**（軸 E が入力）
- **`M23-04`**（復元時のバリデーション）: D-3 により、削除中に内容が変わることは無い ⇒ **復元時に不正になりうるのは「自分の内容」ではなく「外部との関係」**（重複＝軸 H、参照先の消失＝軸 E / F）
- **D-5 の「論理削除が `deleted_at` を上書きする」は `M23-06`（残日数の見せ方）の入力**

### 推奨（併記）

- **`PermanentDelete` の前チェック**: 案 1＝`FindByIDAllowDeleted` を Tx 内へ移す ／ 案 2＝`HardDelete` の `DELETE FROM combos` に `AND deleted_at IS NOT NULL` を足して `RowsAffected` で判定する ／ 案 3＝現状のまま（**`M23` のスコープ外として `followup` へ回す**）
- **論理削除の冪等な上書き**: 案 1＝`WHERE ... AND deleted_at IS NULL` を足して 2 度目を no-op にする（**既存テスト `TestHandler_Delete_204_OnAlreadyDeleted` の期待と衝突しうる**） ／ 案 2＝現状のまま

---

## E. 参照側の `deleted_at` 除外（全数）

### E-1 `combos` を参照する SQL の全数と内訳

**走査**: `grep -rn -iE "(FROM|JOIN|UPDATE|INTO)[[:space:]]+combos\b" --include=*.go internal/ | grep -v "_test.go"` = **25 行**。`punish/queries.go:62` と `:63` は同一 statement の 2 行のため、**statement 数は 24。**

**内訳: 読み取り系 15 statement ／ 書き込み系 9 statement。**

#### 読み取り系 15 statement（★これが E-1 の本体）

**`deleted_at` の述語を持つ: 11**

| # | 場所 | 関数 / 定数 | 述語（逐語） | どこで使われる SQL か |
|---|---|---|---|---|
| 1 | `combo/repository.go:349-364` | `selectComboByIDSQL`（`FindByID`） | `WHERE id = ? AND deleted_at IS NULL` | **詳細**（`GET /api/combos/:id`）・PUT 前の旧行取得 |
| 2 | `combo/repository.go:685-727` | `List` | **条件付**: `OnlyDeleted`→`deleted_at IS NOT NULL` ／ 既定→`deleted_at IS NULL` ／ `IncludeDeleted`→述語なし | **一覧**（`GET /api/combos`）・**ゴミ箱**・**CSV export**・**確定反撃サーチ** |
| 3 | `combo/repository.go:910-914` | `UpdateMetadata` の存在チェック | `WHERE id = ? AND deleted_at IS NULL` | 404 / 409 の判別 |
| 4 | `combo/repository.go:1030-1067` | `FindActiveByDuplicateKey` | `deleted_at IS NULL`（`:1034`） | **重複判定**（VAL-C02 / `check-duplicate` / materialize） |
| 5 | `combo/repository.go:1369-1384` | `listAllActiveCombosSQL`（`ListAllActiveCombosTx`） | `WHERE deleted_at IS NULL` | **recipe_cache 一括再計算** |
| 6 | `tag/repository.go:81-94` | `listWithUsage` | `LEFT JOIN combos c ON c.id = ct.combo_id AND c.deleted_at IS NULL`（`:87-88`） | **タグ一覧の usage_count**（マイコンボ件数バッジ・タグ管理） |
| 7 | `setup/repository.go:703-711` | `ComboExists` | `WHERE id = ? AND deleted_at IS NULL` | セットプレイ作成・紐付けの親存在チェック |
| 8 | `setup/repository.go:728-747` | `FindCandidateSetups` | `AND c.deleted_at IS NULL`（`:743`）+ `AND s.deleted_at IS NULL`（`:742`） | **セットプレイ候補**（FR011） |
| 9 | `punish/queries.go:109-136` | `listPunishEntriesBaseSQL` | `AND c.deleted_at IS NULL`（`:136`） | **確定反撃マイリスト** |
| 10 | `punish/queries.go:157-178` | `listCurationsBaseSQL` | `AND c.deleted_at IS NULL`（`:178`） | **「使わない反撃」（隠したもの管理）** |
| 11 | `service/combo/service.go:612` | `UpdateWithKeyChange` の存在チェック | `WHERE id = ? AND deleted_at IS NULL` | PUT の 404 / 409 判別 |

**持たない: 3**

| # | 場所 | 関数 / 定数 | どこで使われる SQL か |
|---|---|---|---|
| 12 | `combo/repository.go:408-423` | `selectComboByIDAllowDeletedSQL`（`FindByIDAllowDeleted`）<br>`WHERE id = ?` | **完全削除の前チェック**（`service.PermanentDelete:805`）**1 か所のみ**。**★関数名が「AllowDeleted」であり、意図が名前に出ている** |
| 13 | `combo/repository.go:1324-1338` | `GetRecipeCache`<br>`SELECT recipe_cache FROM combos WHERE id = ?` | **レシピ文字列の取得**（`GET /api/combos/:id/recipe` 経路） |
| 14 | **`punish/queries.go:50-55`** | **`listAdoptedComboPunishesSQL`**<br>`SELECT cp.combo_id, cp.opponent_move_id FROM combo_punishes cp JOIN combos c ON c.id = cp.combo_id WHERE c.character_id = ?` | **確定反撃サーチの走査**（`punish/scan.go:298` → `ListAdoptedComboPunishes`）。**★「この相手技には既に採用済みのコンボがある」の判定に使う。同ファイルの `listPunishEntriesBaseSQL`（#9）は同じ `combo_punishes` を引きながら述語を持っている＝同一ファイル内で非対称** |

**部分的: 1**

| # | 場所 | 関数 / 定数 | 状況 |
|---|---|---|---|
| 15 | **`punish/queries.go:57-65`** | **`listMaterializedBaseComboIDsSQL`**<br>`SELECT DISTINCT child.materialized_from_combo_id FROM combos child JOIN combos base ON base.id = child.materialized_from_combo_id WHERE base.character_id = ? AND child.deleted_at IS NULL` | **`child` 側にのみ述語がある。`base` 側には無い。** `punish/scan.go:319` → `ListMaterializedBaseComboIDs`（**materialize 生成物を持つ基底コンボの id 集合**）。**リポジトリ層のインタフェースコメント（`punish/repository.go:137-139`）は「論理削除済みの**生成物**だけを除外する」と明記しており、`base` を除外しないことが意図的である可能性を示唆する。★意図的かどうかは判断しない**（指示書 §4 E-3） |

#### 書き込み系 9 statement（参考）

| 場所 | 内容 | 述語 |
|---|---|---|
| `combo/repository.go:267-294` | `INSERT INTO combos` | — |
| `combo/repository.go:897` | `UpdateMetadata` | `AND deleted_at IS NULL` |
| `combo/repository.go:932` | `SoftDelete` | **無し**（冪等・上書き。D-5） |
| `combo/repository.go:949` | `Restore` | `AND deleted_at IS NOT NULL` |
| `combo/repository.go:977` | `HardDelete` の `DELETE FROM combos WHERE id = ?` | **無し**（物理削除） |
| `combo/repository.go:1342` | `UpdateRecipeCache` | **無し** |
| `combo/repository.go:1352` | `UpdateRecipeCacheTx` | **無し** |
| `combo/repository.go:1362` | `SetRecipeCacheNullTx` | **無し** |
| `service/combo/service.go:598-599` | PUT の旧行論理削除 | `AND deleted_at IS NULL` |

### E-2 `setups` を参照する SQL の全数と内訳

**走査**: `grep -rn -iE "(FROM|JOIN|UPDATE|INTO)[[:space:]]+setups\b" --include=*.go internal/ | grep -v "_test.go"` = **20 行 = 20 statement**（複数行にまたがるものは 1 行のみヒット）。

**内訳: 読み取り系 14 ／ 書き込み系 6。**

**持つ: 13**

| # | 場所 | 関数 | 述語 |
|---|---|---|---|
| 1-4 | `combo/repository.go:578, 587, 600, 616` | `setupResultWhere`（4 つの副問い合わせ） | `JOIN setups s ON s.id = ... AND s.deleted_at IS NULL` |
| 5 | `setup/repository.go:286-290` | `selectSetupByIDSQL`（`FindByID`） | `WHERE id = ? AND deleted_at IS NULL` |
| 6 | `setup/repository.go:404-408` | `UpdateSetup` の存在チェック | `WHERE id = ? AND deleted_at IS NULL` |
| 7 | `setup/repository.go:484-488` | `listAllActiveSetupsSQL` | `WHERE deleted_at IS NULL` |
| 8 | `setup/repository.go:512-517` | `ListByCharacterID` | `WHERE deleted_at IS NULL` |
| 9 | `setup/repository.go:585-591` | `ListSetupsByComboID` | `WHERE cs.combo_id = ? AND s.deleted_at IS NULL` |
| 10 | `setup/repository.go:615-633` | `ListSetupsByComboIDs` | `AND s.deleted_at IS NULL` |
| 11 | `setup/repository.go:661-668` | `FindDuplicateInCombo` | `AND s.deleted_at IS NULL` |
| 12 | `setup/repository.go:713-716` | `SetupExistsActive` | `WHERE id = ? AND deleted_at IS NULL` |
| 13 | `setup/repository.go:728-747` | `FindCandidateSetups` | `AND s.deleted_at IS NULL` |

**持たない: 1**

| # | 場所 | 関数 | どこで使われる SQL か |
|---|---|---|---|
| 14 | `setup/repository.go:435-438` | `GetRecipeCache`<br>`SELECT recipe_cache FROM setups WHERE id = ?` | セットプレイのレシピ文字列取得。**★combos 側の #13 と同型** |

**書き込み系 6**: `INSERT INTO setups`（`:167`）／ `SoftDelete`（`:369`・`AND deleted_at IS NULL`）／ `UpdateSetup`（`:391-394`・`AND deleted_at IS NULL`）／ `UpdateRecipeCache`（`:453`）／ `UpdateRecipeCacheTx`（`:463`）／ `SetRecipeCacheNullTx`（`:473`）——後 3 つは述語なし。

**★`setups` を物理削除する SQL は本番コードに 0 件**（`grep -rn "DELETE FROM setups" --include=*.go internal/` → 0 件）。軸 C と整合。

### E-3 「持たないもの」がどこで使われる SQL か（判断はしない）

E-1 / E-2 の表の右端列に記載済み。**要約すると:**

| 持たない SQL | 使われる場面 |
|---|---|
| `FindByIDAllowDeleted`（combos） | **完全削除の前チェック** 1 か所のみ |
| `GetRecipeCache`（combos） | **レシピ文字列の取得** |
| `listAdoptedComboPunishesSQL`（combos） | **確定反撃サーチの走査**（採用済み判定） |
| `listMaterializedBaseComboIDsSQL` の `base` 側（combos） | **確定反撃サーチの走査**（materialize 済み判定） |
| `GetRecipeCache`（setups） | **レシピ文字列の取得** |

**★意図的か否かは判断しない**（指示書 §4 E-3）。ただし `FindByIDAllowDeleted` は関数名に、`listMaterializedBaseComboIDsSQL` はインタフェースコメント（`punish/repository.go:137-139`）に、それぞれ意図を示す記述がある。**`listAdoptedComboPunishesSQL` には該当する記述が無い。**

### E-4 ★既知の先例（`hiddenCurations`）は実装と**一致している**

`DES-005` の記述（指示書 §4 E-4 に引かれたもの）:

> `hiddenCurations` は論理削除済みコンボを除外する。`ON DELETE CASCADE` は物理削除にしか効かないため、`deleted_at` が入ったコンボの curation は明示的に除外する

**実装**（`internal/repository/punish/queries.go:155-178`）:

```sql
-- listCurationsBaseSQL は「使わない反撃」を表示用投影で返す(隠したもの管理)。
-- 論理削除済みコンボに紐づく行は出さない(マイリスト本体と同じ扱いに揃える)。
const listCurationsBaseSQL = `
SELECT
    cc.combo_id, cc.opponent_move_id, cc.note, ...
FROM combo_punish_curations cc
JOIN combos c ON c.id = cc.combo_id
...
WHERE c.character_id = ?
  AND c.deleted_at IS NULL`
```

**⇒ 一致。** コメントも設計書と同趣旨（「マイリスト本体と同じ扱いに揃える」）。

### E-5 子の側から親を辿る経路で、削除済みの親が見える箇所

**★2 つある。いずれも `combo_setups` を直接引いて `combos` を JOIN していない。**

| 場所 | SQL（逐語） |
|---|---|
| `setup/repository.go:343-345` `FindComboIDsBySetupID` | `SELECT combo_id FROM combo_setups WHERE setup_id = ? ORDER BY combo_id` |
| `setup/repository.go:548-558` `FindComboIDsBySetupIDs` | `SELECT setup_id, combo_id FROM combo_setups WHERE setup_id IN (%s) ORDER BY setup_id, combo_id` |

**`combos` を JOIN していないため、削除済みのコンボの id もそのまま返る。**

**使用箇所（本番コード・全数）**:

| 場所 | 用途 |
|---|---|
| `service/setup/service.go:370` | **`UpdateSetup` のバリデーション入力**（`parentComboIDs` を `ValidateSetupUpdate` へ渡す） |
| `service/setup/service.go:526 / 563 / 600 / 644` | セットプレイ一覧・候補一覧の応答組み立て |
| `service/setup/service.go:689` | `buildResponse`（セットプレイ詳細） |

**表面に出る先**:

| DTO | フィールド | 露出する API |
|---|---|---|
| `internal/api/setup/dto.go:85, 107` | ``ParentComboIDs []int64 `json:"parentComboIds"` `` | `GET /api/setups` ／ `GET /api/setups/:id` ／ `GET /api/setups/candidates` |
| `internal/api/combo/dto.go:185` | ``ParentComboIds []int64 `json:"parentComboIds"` `` | **`GET /api/combos/:id` に埋め込まれる `setups[]`**（`internal/api/combo/handler.go:89, 139, 296`） |

**⇒ セットプレイ詳細を開くと、`parentComboIds` に削除済みコンボの id が混ざりうる。** ただし**そこから実際にコンボを取ろうとすると `GET /api/combos/:id` が 404 になる**（A-5）ため、**画面上の見え方は「id はあるが開けない」形になる見込み**（**★フロント側での消費のされ方は未実査**）。

**★逆方向（コンボ → セットプレイ）は塞がれている**——`ListSetupsByComboID` / `ListSetupsByComboIDs` は `s.deleted_at IS NULL` を持つ（E-2 #9 / #10）。

### 契約・正典との差

- `architecture-patterns` §11「**参照側は `deleted_at` を明示的に除外する必要がある**」に対し、**除外していない読み取り経路が combos 側に 3 + 1（部分）、setups 側に 1、加えて子→親経路が 2 ある**
- `DES-005` の `hiddenCurations` 記述は一致（E-4）

### 後続スコープへの含意

- **`M23-03`**（参照側の `deleted_at` 除外）の作業対象リストが本軸で確定した。**候補は 6 か所**——`GetRecipeCache`（combos / setups）／ `listAdoptedComboPunishesSQL` ／ `listMaterializedBaseComboIDsSQL` の `base` 側 ／ `FindComboIDsBySetupID` ／ `FindComboIDsBySetupIDs`。**`FindByIDAllowDeleted` は名前と用途から対象外の候補**
- **`M23-02`**: E-5 の `parentComboIds` は、セットプレイの復元を作る際に「戻したセットプレイが削除済みコンボを指している」形を生みうる

### 推奨（併記）

- **`listAdoptedComboPunishesSQL`**: 案 1＝`AND c.deleted_at IS NULL` を足して `listPunishEntriesBaseSQL` と揃える ／ 案 2＝現状のまま（**採用済み判定を保守的に倒す＝削除済みでも「採用済み」と見なす**）
- **`FindComboIDsBySetupID(s)`**: 案 1＝`JOIN combos c ON c.id = cs.combo_id AND c.deleted_at IS NULL` を足す ／ 案 2＝サービス層で除外する ／ 案 3＝DTO に「削除済みか」のフラグを添えてフロントに判断させる
- **`GetRecipeCache`**: 案 1＝述語を足す ／ 案 2＝現状のまま（**`GET /api/combos/:id/recipe` は詳細と同じく 404 側で守られている可能性がある。★未実査**）

---

## F. 完全削除と CASCADE（`P-04` の影響）

### F-1 `PermanentDelete` を実 SQL まで辿った（逐語）

| 層 | 場所 |
|---|---|
| ルート | `internal/api/combo/routes.go:28` `g.DELETE("/combos/:id/permanent", h.PermanentDelete)` |
| ハンドラ | `internal/api/combo/permanent_delete_handler.go:16-33` |
| サービス | `internal/service/combo/service.go:804-831` |
| リポジトリ | `internal/repository/combo/repository.go:964-983` `HardDelete` |

**ハンドラの応答**: 成功 **204** ／ `ErrNotFound` → **404** ／ `ErrComboNotInTrash` → **409 `combo_not_in_trash`**（`permanent_delete_handler.go:27`）／ ID 不正 → **400**。

**`HardDelete` の逐語**（`repository.go:964-983`）:

```go
func (r *repository) HardDelete(ctx context.Context, tx *sql.Tx, id int64) error {
	exec := r.runner(tx)
	// M19-03: combo_setups → combo_setup_results は 2 段の ON DELETE CASCADE で消えるが、
	// FK=OFF の接続では発火しない(db.Open の PRAGMA が接続プール全体に効いていない)。
	// 完全削除でこれらが残ると、id 再利用時に他人の検証結果が見えかねないため明示的に落とす。
	// (combos.id は AUTOINCREMENT で再利用されない想定だが、FK に依存しない形に揃える。)
	if _, err := exec.ExecContext(ctx,
		`DELETE FROM combo_setup_results WHERE combo_id = ?`, id); err != nil {
		return fmt.Errorf("hard delete combo_setup_results: %w", err)
	}
	if _, err := exec.ExecContext(ctx,
		`DELETE FROM combo_setups WHERE combo_id = ?`, id); err != nil {
		return fmt.Errorf("hard delete combo_setups: %w", err)
	}
	_, err := exec.ExecContext(ctx, `DELETE FROM combos WHERE id = ?`, id)
	if err != nil {
		return fmt.Errorf("hard delete: %w", err)
	}
	return nil
}
```

**⇒ `DELETE` の対象は 3 表: `combo_setup_results` → `combo_setups` → `combos`。**

### F-2 ★明示削除は 2 表のみ。**残り 5 表は CASCADE に任せている**

**`combos(id)` を `ON DELETE CASCADE` で参照している子テーブルの全数**（走査＝`grep -rn "REFERENCES combos(id)" migrations/*.up.sql`）:

| 子テーブル | 定義 | 完全削除での扱い |
|---|---|---|
| `combo_steps` | `000001_init_schema.up.sql:98` | **CASCADE 依存** |
| `combo_tags` | `000001_init_schema.up.sql:121` | **CASCADE 依存** |
| `combo_setups` | `000001_init_schema.up.sql:194` | **明示削除** |
| `combo_oki_options` | `000021_normalize_combo_oki_options.up.sql:33` | **CASCADE 依存** |
| `combo_punishes` | `000036_create_combo_punishes.up.sql:8` | **CASCADE 依存** |
| `combo_punish_curations` | `000037_create_combo_punish_prunings_and_curations.up.sql:20` | **CASCADE 依存** |
| `combo_setup_results` | `000042_create_combo_setup_results.up.sql:31-32`（**親は `combo_setups`＝1 段深い**・`ON UPDATE CASCADE ON DELETE CASCADE`） | **明示削除** |

**★`combos.materialized_from_combo_id` は self-FK だが `ON DELETE` 句を持たない**（`000038_add_combos_materialized_from.up.sql:6`）:

```sql
ALTER TABLE combos ADD COLUMN materialized_from_combo_id INTEGER REFERENCES combos(id);
```

**⇒ SQLite の既定は `NO ACTION`。FK=ON の接続で基底コンボを完全削除しようとすると、materialize 生成物が残っていれば FK 違反で失敗しうる。FK=OFF の接続なら dangling 参照が残る。★どちらになるかは接続次第であり、これが `P-04` の影響そのものである**（**実挙動は未実査**——dev DB が無く、この経路の実行を確かめていない）。

**⇒ CASCADE 依存の 5 表（`combo_steps` / `combo_tags` / `combo_oki_options` / `combo_punishes` / `combo_punish_curations`）は `P-04` の影響を受ける。**

### F-3 `PRAGMA foreign_keys` の設定方法と `SetMaxOpenConns`

**設定方法**（`internal/infra/db/db.go:33-51` 逐語）:

```go
	conn, err := sql.Open(driverName, dbPath)
	...
	// WAL モードへの切替は接続単位ではなくデータベース単位で永続化されるが、
	// 念のため毎回適用する。foreign_keys は接続単位なので毎回必要。
	pragmas := []string{
		"PRAGMA journal_mode = WAL",
		"PRAGMA foreign_keys = ON",
		"PRAGMA busy_timeout = 5000",
		"PRAGMA synchronous = NORMAL",
	}
	for _, p := range pragmas {
		if _, execErr := conn.Exec(p); execErr != nil {
			_ = conn.Close()
			return nil, fmt.Errorf("db: exec %q: %w", p, execErr)
		}
	}
```

- **DSN パラメータではない。** `sql.Open(driverName, dbPath)` は生のパスのみを渡しており、`_pragma=` 等のクエリ文字列を付けていない（走査＝`grep -rn "_pragma" --include=*.go internal/ cmd/` → **0 件**）
- **`*sql.DB.Exec` による実行時のクエリである。** コメント自身が「foreign_keys は接続単位なので毎回必要」と書いているが、**`*sql.DB.Exec` はプールから 1 接続を借りて実行するだけで、以後に新規に張られる接続には適用されない**

**`SetMaxOpenConns` / `SetMaxIdleConns`**:

```bash
grep -rn "SetMaxOpenConns\|SetMaxIdleConns" --include=*.go internal/ cmd/ | grep -v "_test.go"
# → 0 件
```

**⇒ 本番コードに接続数の上限設定は 1 つも無い。プールは無制限に増えうる。**

**★これは `architecture-patterns` §11 の記述と完全に一致する**——「`*sql.DB.Exec` で `PRAGMA foreign_keys = ON` を流すと**プール中の 1 接続にしか適用されない**。`SetMaxOpenConns` が無くプールが無制限に増える構成では、**後から張られた接続は OFF のまま**になる」。

**テスト環境も同じ経路**（`internal/testutil/dbtest/dbtest.go:33` が `db.Open(dbPath)` を呼ぶ）。**⇒ テストも `P-04` の影響下にある**が、テストは並行度が低く 1 接続で完結しやすいため FK=ON の接続を引き当てやすい。**★この非対称は「テストが緑でも本番で CASCADE が発火しない」形を作りうる**（`architecture-patterns` §11 の一般論を本軸の実測に当てはめたもの）。

### F-4 完全削除に関するテストの全数と、**子の消滅を主張しているか**

| # | テスト | 場所 | 主張していること | **子の消滅を主張?** |
|---|---|---|---|---|
| 1 | `TestHandler_PermanentDelete_204` | `internal/api/combo/permanent_delete_handler_test.go:16` | 204 が返る（mock service） | **No**（DB を見ない） |
| 2 | `TestHandler_PermanentDelete_404` | `:36` | 404 が返る | **No** |
| 3 | `TestHandler_PermanentDelete_409_NotInTrash` | `:53` | 409 `combo_not_in_trash` | **No** |
| 4 | `TestHandler_PermanentDelete_400_InvalidID` | `:70` | 400 | **No** |
| 5 | `TestService_PermanentDelete_OK` | `internal/service/combo/service_test.go:1152-1172` | **`SELECT COUNT(*) FROM combos WHERE id = ?` が 0** | **★No——`combos` の行しか数えていない** |
| 6 | `TestService_PermanentDelete_NotFound` | `:1174` | `ErrNotFound` | **No** |
| 7 | `TestService_PermanentDelete_NotInTrash` | `:1181` | `ErrComboNotInTrash` | **No** |
| 8 | `TestSetupResults_HardDeleteRemovesResults` | `internal/repository/setup/setup_results_test.go:264-289` | **`combo_setup_results` が 0 ／ `combo_setups` が 0** | **Yes（2 表のみ）。★ただしこの 2 表は `HardDelete` が明示削除している ⇒ CASCADE を検査していない** |

**★CASCADE 依存の 5 表を主張するテストは 0 件。**

走査:

```bash
grep -rn -B2 -A20 "HardDelete(ctx, tx" --include=*_test.go internal/ | grep -iE "combo_steps|combo_tags|combo_oki"
# → 0 件
```

**⇒ `PRAGMA foreign_keys` が効いていない接続で完全削除が走り `combo_steps` / `combo_tags` / `combo_oki_options` / `combo_punishes` / `combo_punish_curations` が残っても、全テストは緑のままである。**

**★`TestSetupResults_HardDeleteRemovesResults` のコメント自身が「2 段の `ON DELETE CASCADE` に依存せず明示削除しているため、FK=OFF の接続でも消える」と書いている**（`setup_results_test.go:262-263`）。**この 1 本が守っているのは明示削除の側であり、CASCADE の側ではない。**

### 契約・正典との差

- `architecture-patterns` §11 の 3 つの処方——「**接続単位の設定は、プール全体に効く経路（DSN パラメータ等）で入れる**」「**新しい関連テーブルを作るときは CASCADE に依存せず明示削除／明示再ポイントを併用する**」「**既存の CASCADE 依存箇所を一括で直すのは独立した調査と全テーブルの回帰ゲートが要る**」——のうち、**1 つ目は未実施（DSN 化されていない）**、2 つ目は `combo_setups` / `combo_setup_results` の 2 表で実施済み・残り 5 表は未実施、3 つ目は `M23-overview` §1.3-5 が「本 MS では根治しない」と定めている
- `M23-overview` §2.3 が「完全削除が CASCADE に依存するため、影響の有無を実査する」と求めていた点への回答: **★依存している。5 表が対象であり、それを守るテストは 0 件。**

### 後続スコープへの含意

- **`M23-overview` §1.3-5** は `P-04` の根治を M23 のスコープ外としている。**本軸の結論は「根治しない」判断を覆すものではないが、影響範囲が 5 表 + self-FK 1 本であることを数値で確定させた**
- **`M23-06`**（完全削除の確認 UX）: 「完全削除しました」と伝えたのに子が残っている状態が起こりうる、という事実が入力

### 推奨（併記）

- **明示削除の拡張**: 案 1＝`HardDelete` に残り 5 表の `DELETE` を足す（**`combo_setups` / `combo_setup_results` と同型。`P-04` の根治ではないが影響を消す**） ／ 案 2＝`P-04` を DSN 化で根治する独立サブに委ねる ／ 案 3＝現状のまま
- **テスト**: 案 1＝`TestService_PermanentDelete_OK` に 5 表のカウントを足す ／ 案 2＝FK=OFF を強制した接続で完全削除を走らせる回帰テストを足す（**`P-04` の再現テスト**）
- **`materialized_from_combo_id` の self-FK**: 案 1＝`ON DELETE SET NULL` へ変える（**マイグレ消費**） ／ 案 2＝`HardDelete` で明示的に NULL 化する ／ 案 3＝現状のまま（**★実挙動が未実査のため、まず実査を先に置く案もある**）

---

## G. `PUT` が積む「旧行」の判別（★スキーマ変更の要否がここで決まる）

### G-1 `UpdateWithKeyChange`（`PUT /api/combos/:id`）を実 SQL まで辿った

**サービス層 `internal/service/combo/service.go:557-740`。** 主要な段は 8 つ。

**旧行の論理削除**（`:596-599` 逐語）:

```go
	// 1. 旧コンボの楽観的排他チェック(version 確認 + 論理削除を 1 文で)
	res, execErr := tx.ExecContext(ctx,
		`UPDATE combos SET deleted_at = datetime('now'), updated_at = datetime('now')
		 WHERE id = ? AND version = ? AND deleted_at IS NULL`, oldID, version)
```

**新行の作成**（`:624-638`）:

```go
	// 2. 新コンボ INSERT
	combo.Version = 1
	combo.StepCount = len(steps)

	newID, insertErr := s.repo.InsertCombo(ctx, tx, combo)
	...
	if stepErr := s.repo.InsertSteps(ctx, tx, newID, steps); stepErr != nil { ... }
```

**`combo` は `buildComboFromInput(input)` の戻り値**（`:558`）。

**続く段**（いずれも同一トランザクション内）:

| 段 | 内容 | 場所 |
|---|---|---|
| 3 | `combo_setups` の付け替え（`carry_all` / `unlink_all` / `individual`） | `:640-672` |
| 3-b | `combo_setup_results` の親キー再ポイント（`MoveSetupResultReferences`） | `:674-689` |
| 4 | `combo_punishes` / `combo_punish_curations` の再ポイント（`MovePunishReferences`） | `:691-699` |
| 5 | 旧行の `recipe_cache` 削除 + 新行の再計算 | `:701-708` |
| 6 | タグの付け替え（`ReplaceTagAssociations`。**`len(input.TagIDs) > 0` のときのみ**） | `:710-719` |
| 7 | 起き攻めオプション（`ReplaceOkiOptions`。**`len(input.OkiOptions) > 0` のときのみ**） | `:721-726` |
| 8 | `Commit` | `:728-730` |

**★旧行に残るもの**: `combo_steps`（新行へは新規 INSERT され、旧行のものは消されない）。**★旧行から移されるもの**: `combo_setups` / `combo_setup_results` / `combo_punishes` / `combo_punish_curations` / タグ（`TagIDs` が非空のとき）／ 起き攻めオプション（同）。

### G-2 ★★旧行と新行を結びつける情報が既に在るか → **(a)〜(d) すべて「無い」**

#### (a) `materialized_from_combo_id` — **使えない**

**全数走査**（`grep -rn "materialized_from_combo_id\|MaterializedFromComboID\|materializedFromComboId" --include=*.go --include=*.ts --include=*.tsx --include=*.sql . | grep -v node_modules` = **46 ヒット**）。**このうち値を書き込む箇所は 1 か所のみ。**

| 書き込み箇所 | 場所 |
|---|---|
| **`Materialize`（確定反撃版の生成）** | `internal/service/combo/service.go:981` `gen.MaterializedFromComboID = &base.ID` |

**`InsertCombo` は `combo.MaterializedFromComboID` をそのまま渡す**（`internal/repository/combo/repository.go:310`）:

```go
		combo.RecipeCache,
		combo.Version,
		combo.MaterializedFromComboID,
```

**★`PUT` が使う `buildComboFromInput` は同フィールドを設定しない**（`internal/service/combo/service.go:1101-1125` 逐語・**全 20 フィールド**）:

```go
func buildComboFromInput(input CreateInput) (*model.Combo, []model.ComboStep) {
	combo := &model.Combo{
		CharacterID:           input.CharacterID,
		IsDraft:               input.IsDraft,
		Damage:                input.Damage,
		StarterMoveID:         input.StarterMoveID,
		Position:              input.Position,
		OpponentStance:        input.OpponentStance,
		HitType:               input.HitType,
		OpponentSize:          input.OpponentSize,
		DriveAvailableAtStart: input.DriveAvailableAtStart,
		SAAvailableAtStart:    input.SAAvailableAtStart,
		DriveDamage:           input.DriveDamage,
		SAGaugeConsumed:       input.SAGaugeConsumed,
		DriveGaugeConsumed:    input.DriveGaugeConsumed,
		KnockdownAdvantage:    input.KnockdownAdvantage,
		Memo:                  input.Memo,
		Situation:             input.Situation,
		Link:                  input.Link,
		VideoPath:             input.VideoPath,
		ImagePath:             input.ImagePath,
		OkiOptions:            input.OkiOptions,
	}
	return combo, input.Steps
}
```

**`MaterializedFromComboID` は上記 20 フィールドに含まれない ⇒ ゼロ値（`*int64` の nil）⇒ `INSERT` で NULL が入る。**

**⇒ (a) は使えない。詳細は G-5。**

#### (b) `deleted_at` と新行の `created_at` の近接 — **同一トランザクション内だが、列としての結び付けは無い**

- 旧行の `deleted_at` は `datetime('now')`（`service.go:598`）
- 新行の `created_at` は `combos` テーブルの `DEFAULT`（`InsertCombo` の列リストに `created_at` が無い＝`repository.go:267-294`）
- **両者は同一トランザクション内で連続実行されるため秒単位でほぼ一致するが、`combos` に `datetime('now')` の精度は秒である**（SQLite の `datetime()` は `YYYY-MM-DD HH:MM:SS`）
- **⇒ 同じ秒に「削除された行」と「作られた行」が複数あれば区別できない。近接は判別の必要条件にはなるが十分条件にならない**
- **★これは「情報が在る」ではなく「推定の材料が在る」である**（指示書 §7.2 の推定可能事項）

#### (c) `recipe_cache` の一致 — **使えない**

- `PUT` は旧行の `recipe_cache` を **`DeleteComboCache` で削除している**（`service.go:701-704`）
- **⇒ 旧行の `recipe_cache` は NULL になっており、新行と照合できない**
- そもそも `PUT` は「レシピ等の重複判定キー変更」の操作であり（`service.go:552` のコメント）、**一致することを前提にできない**

#### (d) それ以外の列 — **無い**

**`combos` の全列**（`migrations/000001_init_schema.up.sql:58-94` + 後続の ALTER）を確認した。旧→新の由来を表す列は `materialized_from_combo_id` のみで、それは (a) のとおり `PUT` では書かれない。

**★`version` も使えない**——新行は `combo.Version = 1` で採番し直される（`service.go:625`）ため、旧行の `version` との連続性が無い。

**★`updated_at` も使えない**——旧行の `updated_at` は論理削除時に `datetime('now')` へ更新される（`service.go:598`）が、これは `DELETE /api/combos/:id`（`repository.go:932`）でも同じ形であり、`PUT` 由来と手動削除を区別しない。

### G-3 ★現在、`PUT` で積まれた旧行は**ゴミ箱の一覧に出ている**

軸 B-2 の絞り込み条件は **`deleted_at IS NOT NULL` + `character_id = ?` の 2 述語のみ**である（`repository.go:685-686` + `filter.CharacterID`）。

**`PUT` の旧行は `deleted_at` に値を持つため、この条件に合致する。**

**⇒ 利用者が `PUT`（識別キー変更編集）を行うたびに、ゴミ箱に 1 行ずつ増える。** これは `M23-overview` §2.2 論点 2 の「**利用者は消した覚えのない行を積んでいる**」と一致する。

**★区別する手段が無いため、ゴミ箱の画面上でも「自分で消した行」と「編集で積まれた行」は同じ見た目である**（A-1 の 8 列に区別を示すものが無い）。

### G-4 dev DB に対する `SELECT` — **★未実査**

**理由**: §0.3 のとおり、本セッション（クラウドの使い捨てコンテナ）に dev DB が存在しない。`find /` で 0 件、`.gitignore` が `*.db` を除外しているため新規 clone には含まれない。

**開発者が手元で回せる SQL を以下に置く**（`sqlite3 ~/.local/share/combomgr/combomgr.db` 等。Linux の既定パスは `internal/infra/db/db.go:94-104`。Windows は `%APPDATA%\combomgr\combomgr.db`、macOS は `~/Library/Application Support/combomgr/combomgr.db`）:

```sql
-- G-4-1: 削除済み行の総数
SELECT COUNT(*) AS deleted_rows FROM combos WHERE deleted_at IS NOT NULL;

-- G-4-2: 削除済み行のうち「PUT 由来と推定できる」行の件数
--   ★推定の根拠: 「その行の deleted_at と同じ秒に created_at を持つ、生きている同一キャラの行が
--     1 行以上ある」を PUT 由来の推定条件とする（G-2 の (b)）。
--   ★これは推定である。同じ秒に別のコンボを新規作成しつつ別のコンボを手動削除した場合も
--     この条件に合致するため、上振れしうる。
SELECT COUNT(*) AS put_derived_estimate
FROM combos old
WHERE old.deleted_at IS NOT NULL
  AND EXISTS (
      SELECT 1 FROM combos new
      WHERE new.deleted_at IS NULL
        AND new.character_id = old.character_id
        AND strftime('%Y-%m-%d %H:%M:%S', new.created_at)
            = strftime('%Y-%m-%d %H:%M:%S', old.deleted_at)
  );

-- G-4-3: 内訳の目視用（推定の妥当性を人が確かめるため）
SELECT old.id AS old_id, old.character_id, old.deleted_at, old.version,
       old.materialized_from_combo_id,
       (SELECT group_concat(new.id) FROM combos new
        WHERE new.deleted_at IS NULL AND new.character_id = old.character_id
          AND strftime('%Y-%m-%d %H:%M:%S', new.created_at)
              = strftime('%Y-%m-%d %H:%M:%S', old.deleted_at)) AS candidate_new_ids
FROM combos old
WHERE old.deleted_at IS NOT NULL
ORDER BY old.deleted_at DESC;

-- G-4-4: (a) が使えないことの実データ確認
--   ★PUT 由来なら materialized_from_combo_id は NULL のはずである（G-5）。
SELECT COUNT(*) FROM combos
WHERE deleted_at IS NOT NULL AND materialized_from_combo_id IS NOT NULL;
```

**★上記の「PUT 由来」はすべて推定であり、実装上の確定情報ではない**（G-2 のとおり結び付ける列が無いため）。

### G-5 ★`materialized_from_combo_id` が `PUT` の経路で書かれるか → **書かれない**（逐語で確認）

3 段で確定した。

1. **`PUT` は `buildComboFromInput(input)` の戻り値を `InsertCombo` に渡す**（`service.go:558` → `:628`）
2. **`buildComboFromInput` は `MaterializedFromComboID` を設定しない**（`service.go:1102-1123` の struct literal に同フィールドが無い＝G-2 (a) の逐語）
3. **`InsertCombo` は `combo.MaterializedFromComboID` をそのまま bind する**（`repository.go:310`）⇒ nil ⇒ **NULL**

**⇒ (a) は使えない。**

**★あわせて 1 つの帰結がある**——**materialize で生成されたコンボ（`materialized_from_combo_id` が非 NULL）を `PUT` で編集すると、新行の同列は NULL になり、出自が失われる。** `web/src/features/punish/components/PunishList.tsx:143` の「生成元バッジ」は `combo.materializedFromComboId != null` で出るため、**編集後はバッジが消える。**（→ §想定外の発見 ①）

### 契約・正典との差

- `M23-overview` §4.4 が「**`PUT` が積む旧行を判別する印を列で持つ案がある**」とし、§1.3 が「**列を足す判断が出た時点で開発者の個別承認を取る**」としている。**本軸の結論は「既存の列では判別できない」であり、承認事項が現実に発生する側に倒れた**
- `M23-overview` §2.2 論点 2「利用者は消した覚えのない行を積んでいる」は **G-3 で裏付けられた**

### 後続スコープへの含意

- **`M23-01`**（`PUT` が積む旧行を既定で隠す＝`D-460`）: **★隠すための判別手段が現状 1 つも無い ⇒ `M23-01` は「隠す」の前に「印をつける」が要る。これがスキーマ変更（`CLAUDE.md` §10 の開発者個別承認事項）を呼ぶ**
- **`M23-overview` §1.3-3**（変更履歴ビューは作らない＝旧行はどの画面からも到達できなくなる）: 印の列を足す場合、その列は「隠す」ためだけに使われ、到達経路を作らない

### 推奨（併記・**決定はしない**）

| 案 | 内容 | 要スキーマ変更 |
|---|---|---|
| **案 1** | **`combos` に `superseded_by_combo_id INTEGER REFERENCES combos(id)` を足す**（旧行 → 新行）。`PUT` の段 2 の後に旧行を `UPDATE` する。ゴミ箱は `superseded_by_combo_id IS NULL` で絞る | **要**（マイグレ 1 本。次の空きは `000078`） |
| **案 2** | **`materialized_from_combo_id` を汎用の由来列に読み替え、`PUT` の新行にも旧行 id を書く**（新行 → 旧行）。ゴミ箱は「自分を指す生きている行が在るか」で絞る | **不要**（列は既存）。**★ただし materialize の意味と混ざり、`punish/queries.go:57-65` と `PunishList.tsx:143` の意味が変わる** |
| **案 3** | **`combos` に `deleted_reason TEXT` を足す**（`'manual'` / `'superseded'`）。ゴミ箱は `deleted_reason != 'superseded'` で絞る | **要**（マイグレ 1 本）。**★案 1 と違い新行への到達手段は持たない ⇒ `M23-overview` §1.3-3 の「到達不能」と整合的** |
| **案 4** | **列を足さず、`PUT` の旧行を論理削除ではなく物理削除にする** | **不要**。**★ただし `FR601`「誤った更新を取り消せる」を `PUT` について放棄することになる** |
| **案 5** | **現状のまま**（旧行をゴミ箱に出し続ける） | 不要 |

---

## H. `FR301` の重複判定と削除済み行

### H-1 重複判定の実 SQL（逐語）

**判定経路は 3 本あり、いずれも同じリポジトリメソッドに合流する。**

| 経路 | 入口 | 合流点 |
|---|---|---|
| **作成時の VAL-C02** | `service.Create`（`service.go:214-215` で `CalcRecipeHash`）→ `validation.ValidateComboForCreate` → `validateC02Duplicate`（`internal/service/validation/combo.go:151-180`） | `ComboDuplicateAdapter.FindActivePublishedDuplicates` |
| **`POST /api/combos/check-duplicate`** | `service.CheckDuplicate`（`service.go:839-861`） | 同上（`:851`） |
| **materialize** | `service.Materialize`（`service.go:912-930`） | 同上 |

**アダプタ**（`internal/service/combo/service.go:1146-1180`）は `Repo.FindActiveByDuplicateKey` を呼び、候補の steps をバルク取得して `CalcRecipeHash` で比較する。

**実 SQL**（`internal/repository/combo/repository.go:1030-1067` 逐語）:

```go
func (r *repository) FindActiveByDuplicateKey(ctx context.Context, key DuplicateKey) ([]model.Combo, error) {
	whereParts := []string{
		"character_id = ?",
		"is_draft = 0",
		"deleted_at IS NULL",
	}
	args := []any{key.CharacterID}

	addNullable := func(col string, val any, isNil bool) {
		if isNil {
			whereParts = append(whereParts, col+" IS NULL")
		} else {
			whereParts = append(whereParts, col+" = ?")
			args = append(args, val)
		}
	}
	addNullable("starter_move_id", deref(key.StarterMoveID), key.StarterMoveID == nil)
	addNullable("position", derefStr(key.Position), key.Position == nil)
	addNullable("opponent_stance", derefStr(key.OpponentStance), key.OpponentStance == nil)
	addNullable("hit_type", derefStr(key.HitType), key.HitType == nil)
	addNullable("opponent_size", derefStr(key.OpponentSize), key.OpponentSize == nil)

	query := fmt.Sprintf(`
SELECT ... FROM combos
WHERE %s`, strings.Join(whereParts, " AND "))
```

**生成される `WHERE` 句**（全 7 述語）:

```sql
WHERE character_id = ?
  AND is_draft = 0
  AND deleted_at IS NULL
  AND starter_move_id  = ? （または IS NULL）
  AND position         = ? （または IS NULL）
  AND opponent_stance  = ? （または IS NULL）
  AND hit_type         = ? （または IS NULL）
  AND opponent_size    = ? （または IS NULL）
```

### H-2 ★判定の `WHERE` 句に `deleted_at IS NULL` が**在る**

`repository.go:1034` の逐語:

```go
		"deleted_at IS NULL",
```

**⇒ 削除済み行は重複判定の候補集合に入らない。判定の外に居る。**

**★あわせて `is_draft = 0` も在る**（`:1033`）⇒ **仮登録も判定の外に居る。**

### H-3 `recipe_hash` は**列ではなく計算値**

**`combos` テーブルに `recipe_hash` 列は無い**（`migrations/` 全走査＝`grep -rn "recipe_hash" migrations/` → **0 件**）。

**サービス層の計算値である。** `internal/service/combo/duplicate_keys.go`:

```go
// CalcRecipeHash は combo_steps 列を正規化して SHA-256 ハッシュの hex 文字列を返す。
func CalcRecipeHash(steps []model.ComboStep) string {   // :45
	if len(steps) == 0 {
		return emptyRecipeHash                            // :47
	}
	...
}
// emptyRecipeHash は空レシピの SHA-256(precomputed)。仮登録の空レシピでも安定的なハッシュを返す。
var emptyRecipeHash = func() string { ... }()            // :103-106
```

**リポジトリ層は明示的に使わない設計である**（`repository.go:124` 逐語のコメント）:

```
// recipe_hash は使わない(SUPP-001 §2.2 はサービス層計算値、Q1 で決定)。
```

**⇒ 判定は「同一キーの候補を SQL で絞る → 候補ごとに steps を取って SHA-256 を計算して比較」の 2 段。**

**セットプレイ側には同型の別実装がある**——`internal/service/setup/duplicate_keys.go:16` `CalcSetupRecipeHash` と、`internal/repository/setup/repository.go:831` `calcSetupRecipeHashFromSteps`（「combo パッケージの `CalcRecipeHash` と同アルゴリズム」とコメント）。**★同じアルゴリズムが 3 か所に別実装で存在する。**

### H-4 復元の経路は重複判定を**通らない**

**`service.Restore`（`service.go:775-798`）の全文は D-1 に逐語で置いた。呼んでいるのは 2 つだけである:**

1. `s.repo.Restore(ctx, tx, id)`
2. `s.notationSvc.RecomputeComboCache(ctx, tx, id)`

**`validation.` / `CalcRecipeHash` / `FindActivePublishedDuplicates` のいずれも呼んでいない。**

走査:

```bash
grep -n "func (s \*service) Restore" -A 25 internal/service/combo/service.go | grep -iE "valid|duplicate|hash"
# → 0 件
```

**⇒ 通らない。復元は無条件に `deleted_at` を NULL に戻す。**

**★帰結**: 削除済みのコンボ A と同じ判定キー + 同じレシピを持つコンボ B が後から作成された場合（**A は判定の外に居るので B の作成は通る**＝H-2）、**その後 A を復元すると、A と B が同時に「生きている重複」として並ぶ。** どちらの操作も現在の実装では拒否されない。

### H-5 dev DB に対する `SELECT` — **★未実査**

**理由**: §0.3 と同じ。dev DB が存在しない。

**開発者が手元で回せる SQL を以下に置く。**

**★注意**: `recipe_hash` は列ではなく SHA-256 の計算値（H-3）なので、**SQL だけでレシピの一致を判定することはできない。** 代替として「`combo_steps` の `(step_order, move_id, modifiers)` 列を `group_concat` した文字列」で近似する。**★これは近似であり、`CalcRecipeHash` の正規化（`duplicate_keys.go:45-101`）と一致する保証は無い**——本報告では同関数の正規化ロジックを逐語検証していないため。

```sql
-- H-5-1: 削除済み行と生きている行で「同じ判定キー」を持つ組の件数
--   ★判定キー = (character_id, starter_move_id, position, opponent_stance, hit_type, opponent_size)
--     ＋ is_draft = 0（H-1 の 7 述語のうち deleted_at 以外）
SELECT COUNT(*) AS colliding_pairs
FROM combos d
JOIN combos a
  ON  a.deleted_at IS NULL
  AND a.is_draft = 0
  AND a.character_id = d.character_id
  AND a.starter_move_id  IS  d.starter_move_id
  AND a.position         IS  d.position
  AND a.opponent_stance  IS  d.opponent_stance
  AND a.hit_type         IS  d.hit_type
  AND a.opponent_size    IS  d.opponent_size
WHERE d.deleted_at IS NOT NULL
  AND d.is_draft = 0;

-- H-5-2: そのうちレシピまで一致する組（★近似。CalcRecipeHash とは別経路）
WITH recipe AS (
  SELECT combo_id,
         group_concat(move_id || ':' || COALESCE(modifiers, ''), '|') AS sig
  FROM (SELECT combo_id, step_order, move_id, modifiers
        FROM combo_steps ORDER BY combo_id, step_order)
  GROUP BY combo_id
)
SELECT COUNT(*) AS colliding_with_same_recipe
FROM combos d
JOIN combos a
  ON  a.deleted_at IS NULL AND a.is_draft = 0
  AND a.character_id = d.character_id
  AND a.starter_move_id IS d.starter_move_id
  AND a.position        IS d.position
  AND a.opponent_stance IS d.opponent_stance
  AND a.hit_type        IS d.hit_type
  AND a.opponent_size   IS d.opponent_size
LEFT JOIN recipe rd ON rd.combo_id = d.id
LEFT JOIN recipe ra ON ra.combo_id = a.id
WHERE d.deleted_at IS NOT NULL AND d.is_draft = 0
  AND COALESCE(rd.sig, '') = COALESCE(ra.sig, '');

-- H-5-3: 目視用の内訳
SELECT d.id AS deleted_id, a.id AS alive_id, d.character_id,
       d.starter_move_id, d.hit_type, d.position, d.deleted_at, a.created_at
FROM combos d
JOIN combos a
  ON  a.deleted_at IS NULL AND a.is_draft = 0
  AND a.character_id = d.character_id
  AND a.starter_move_id IS d.starter_move_id
  AND a.position        IS d.position
  AND a.opponent_stance IS d.opponent_stance
  AND a.hit_type        IS d.hit_type
  AND a.opponent_size   IS d.opponent_size
WHERE d.deleted_at IS NOT NULL AND d.is_draft = 0
ORDER BY d.deleted_at DESC;
```

**★`IS` を使っているのは NULL 同士を等値と扱うため**（`FindActiveByDuplicateKey` の `addNullable` が nil のとき `col IS NULL` を生成するのと同じ意味論＝`repository.go:1038-1045`）。

**★H-5 の結果が 0 件でも、`PUT` の旧行が同じキーを持つとは限らない点に注意**——`PUT` は「重複判定キー変更」の操作なので（`service.go:552`）、旧行と新行のキーは通常異なる。**本 SQL が拾うのは「手動削除した行と、後から作り直した行」の組である。**

### 契約・正典との差

- `M23-overview` §2.2 論点 5（`D-458`）「**削除後に同じコンボが再登録されていた場合の復元挙動**」の前提は成立する——**H-2 により再登録が通り、H-4 により復元も通る。両方が通ることが確定した**
- `DES-006` の VAL-C02 に「復元時」の規定が在るかは**未実査**（本報告では `DES-006` を読んでいない。`M23-04` の入力）

### 後続スコープへの含意

- **`M23-05`**（削除済み行と再登録の衝突）: H-2 / H-4 が直接の入力。**衝突が起こりうることは確定した。実データで起きているかは H-5 の未実査**
- **`M23-04`**（復元時のバリデーション）: H-4 の「復元は何も検証しない」が起点。**`M23-overview` は「落とさずに戻して警告する」方針を既に持っている**

### 推奨（併記）

- **復元時の重複判定**: 案 1＝`Restore` に `FindActivePublishedDuplicates` + `CalcRecipeHash` を挟み、衝突時は 409 で拒否 ／ 案 2＝**衝突しても復元し、応答に警告を載せる**（`M23-overview` の「落とさずに戻して警告する」に沿う） ／ 案 3＝衝突時は復元後の行を `is_draft = 1`（仮登録）へ落とす（**判定の外へ逃がす**）／ 案 4＝現状のまま
- **判定キーの共通化**: 案 1＝`FindActiveByDuplicateKey` に `includeDeleted bool` を足して復元経路から呼ぶ ／ 案 2＝復元専用の別クエリを足す

---

## §想定外の発見

指示書 §0.3 の例外 2 つ（想定外の発見 ／ 明らかな矛盾）に該当するもの。**4 件。**

### ① ★`PUT` で編集すると materialize の出自が失われる（実装内部の矛盾）

**`materialized_from_combo_id` は `Materialize` でのみ書かれ（`service.go:981`）、`PUT` の `buildComboFromInput` は同フィールドを設定しない（`service.go:1102-1123`）。**

**⇒ materialize で生成されたコンボを `PUT` で編集すると、新行の `materialized_from_combo_id` は NULL になる。**

**帰結は 3 つ:**

1. **`web/src/features/punish/components/PunishList.tsx:143` の「生成元バッジ」が消える**（`combo.materializedFromComboId != null` が条件）
2. **`internal/repository/punish/queries.go:57-65` `listMaterializedBaseComboIDsSQL` が基底コンボを「materialize 済み」と見なさなくなる** ⇒ 確定反撃サーチで同じ基底コンボが再び materialize 候補として出うる
3. `M18-03b` の裁定 11（`service.go:691-695` のコメント「これを行わないと識別キー変更編集で採用が silent に消える」）は `combo_punishes` / `combo_punish_curations` の再ポイントを実装しているが、**`materialized_from_combo_id` は同じ手当てを受けていない**

**★これは「`PUT` の旧行を判別する印」を探した副産物であり、`M23` のスコープには属さない可能性がある**（`M18-03b` の領域）。**判断はしない。** → §followup 候補 ①

### ② ★`DES-005` §5.15 の「自動完全削除までの残日数」は、表示は在るが機構が無い

軸 A-2 のとおり。**設計書と実装が「表示項目」については一致し、「その表示が指している機能」については実装が存在しない。**

**★これは `M23-overview` §1.3-2 が既に把握しており（「`DES-005` §5.15 の現行記述『自動完全削除までの残日数』は撤回が要る」）、新規の発見ではない。** ただし**設計卓が把握していたのは「撤回が要る」であって、「表示は既に実装されている」ことまでかは本報告からは分からない**——`M23-overview` §1.1 が列挙した実在物 4 種に残日数は含まれていない。**⇒ 撤回の作業には「フロントの表示コードを消すか残すか」の判断が伴う。**

### ③ ★ゴミ箱の行をクリックすると 404 に落ちる（設計書と実装の食い違い）

軸 A-5 のとおり。`DES-005` §5.15 は「行クリック → 詳細表示（読み取り専用のコンボ詳細）」と書くが、**`TrashListRow.tsx:73` の遷移先 `GET /api/combos/:id` は `deleted_at IS NULL` で締め出しており 404 を返す。**

**★遷移リンクは 2 つある**（行全体の `onClick` と 2 列目の `<Link>`）。**どちらも同じ先を指す。**

**★「読み取り専用の詳細」を出すための道具（`FindByIDAllowDeleted`）は既にリポジトリ層に在り、完全削除の前チェックにのみ使われている**（`service.go:805`）。

### ④ ★`architecture-patterns` §11 の一般化がセットプレイに当てはまらない

同節は「**論理削除された親の子は、物理的に残る**」「**したがって『復元』は子を作り直す作業ではなく、親の `deleted_at` を戻せば子が繋がったまま復帰する形になりうる**」と書くが、**`DeleteSetup`（`internal/service/setup/service.go:467-470`）は `combo_setups` を明示的に物理削除している**:

```go
	// 案 P1: combo_setups を明示的に削除（論理削除時は CASCADE 不発火）
	if err = s.repo.DeleteComboSetupsBySetupID(ctx, tx, setupID); err != nil {
		return fmt.Errorf("delete combo_setups: %w", err)
	}
```

**⇒ セットプレイについては「親の `deleted_at` を戻せば子が繋がったまま復帰する」が成り立たない。** 紐付けは消えている。`recipe_cache` も同様（`:473`）。

**★同節の記述は `code-facts` §10 の「子は `deleted_at` を持たず、親を CASCADE で参照する」というスキーマの事実からは正しく導かれるが、`DeleteSetup` の実装がその一般化の外に居る。** `M23-overview` §2.1-⑤ は同節を「注意」として引いているため、**セットプレイ側を扱う `M23-02` がこの一般化を前提にすると外す。**

---

## §`M23` スコープ確定のための要決定事項

**★設計卓が既に知っている 3 件（指示書 §5 の表）に実測を与えたうえで、本調査で新たに浮上した 4 件を足す。計 7 件。**

### 1. **`PUT` の旧行を判別する印に、新しい列が要るか**（★スキーマ変更＝開発者の個別承認事項）

- **何を決めるか**: 旧行を「消した覚えのない行」として既定で隠すために、`combos` へ列を足すか。足すなら §G の推奨 5 案のどれか
- **なぜ決める必要があるか**: **★軸 G の結論は「既存の情報では判別できない」である。** (a)〜(d) すべて使えない（G-2 / G-5）。**⇒ 印を作らない限り「隠す」は実装できない**
- **決めないと何が止まるか**: **`M23-01` が書けない。** 同サブの半分（`D-460`「`PUT` が積む旧行を既定で隠す」）が実装手段を持たないため。**また列を足すならマイグレ `000078` の消費とその承認が先に要る**

### 2. **復元時に子をどう扱うか**（何もしないで足りるか）

- **何を決めるか**: 現状の「何もしない」（軸 D-2）を維持するか、参照側の除外の穴（軸 E の 6 か所）を塞ぐか、両方か
- **なぜ決める必要があるか**: **★軸 D の結論は「子は繋がったまま残っており、復元は親の `deleted_at` を戻すだけで足りる」である。** 問題は子ではなく**参照側**にある——`listAdoptedComboPunishesSQL` ／ `listMaterializedBaseComboIDsSQL` の `base` 側 ／ `GetRecipeCache`（combos / setups）／ `FindComboIDsBySetupID(s)` の 6 か所が削除済みの親を見せうる（E-1 #14 / #15、E-2 #14、E-5）
- **決めないと何が止まるか**: **`M23-03` のスコープが定まらない。** 「子の扱い」と読むと作業が無く、「参照側の除外」と読むと 6 か所の作業がある

### 3. **復元時に重複判定を掛けるか**

- **何を決めるか**: `Restore` に重複判定を挟むか（§H の推奨 4 案）
- **なぜ決める必要があるか**: **★軸 H の結論は「判定は削除済み行を見ておらず（H-2）、復元は判定を通らない（H-4）」である。** 両方が通るため、削除 → 再登録 → 復元で「生きている重複」が並ぶ形が成立する
- **決めないと何が止まるか**: **`M23-05` が書けない。** また `M23-04`（復元時のバリデーション）の VAL コードの範囲が定まらない

### 4. **★新規: セットプレイの復元は「紐付けと `recipe_cache` の復旧」まで含むか**

- **何を決めるか**: `M23-02` のスコープ。`setups.deleted_at` を NULL に戻す API を足すだけか、`DeleteSetup` が消してしまう `combo_setups` と `recipe_cache`（軸 C-3）の扱いまで含むか
- **なぜ決める必要があるか**: **★復元 API だけを足しても、戻ってきたセットプレイはどのコンボにも紐付いていない。** 利用者から見ると「戻ったが空になっている」形になる
- **決めないと何が止まるか**: **`M23-02` のスコープが定まらない。** 紐付けを守る案の一部（`combo_setups` に `deleted_at` を足す／退避表を作る）は**スキーマ変更を伴う ⇒ 要決定事項 1 と同じ承認が要る**

### 5. **★新規: ゴミ箱の行クリック先をどうするか**

- **何を決めるか**: `DES-005` §5.15 の「行クリック → 読み取り専用のコンボ詳細」を実装するか、記述を撤回するか（想定外の発見 ③）
- **なぜ決める必要があるか**: **★現状は 404 に落ちる。** 実装するなら `GET /api/combos/:id` に削除済みを通す経路が要る（**道具＝`FindByIDAllowDeleted` は既に在る**）。撤回するなら遷移リンク 2 本の扱いを決める
- **決めないと何が止まるか**: **`M23-01`（`DES-005` §5.15 の as-built 化）が書けない。** 「as-built に揃える」と「設計どおりに実装する」で結果が正反対になる

### 6. **★新規: 完全削除の CASCADE 依存 5 表を明示削除へ移すか**

- **何を決めるか**: `HardDelete` に `combo_steps` / `combo_tags` / `combo_oki_options` / `combo_punishes` / `combo_punish_curations` の明示削除を足すか（軸 F-2）
- **なぜ決める必要があるか**: **★`M23-overview` §1.3-5 は `P-04` の根治を M23 のスコープ外としているが、「根治しない」と「影響を受けたままにする」は別である。** `combo_setups` / `combo_setup_results` の 2 表は既に明示削除へ移してある（`repository.go:966-977` のコメントが理由を書いている）ため、**残り 5 表を同型に揃えるのは根治ではなく既存パターンの適用である**
- **決めないと何が止まるか**: **止まりはしない**（現状維持で `M23` は進む）。ただし **「完全削除しました」と伝えたのに子が残る形が続く**。**★あわせて、それを検出するテストが 0 件である**（F-4）

### 7. **★新規: `materialized_from_combo_id` が `PUT` で失われることを M23 で扱うか**

- **何を決めるか**: 想定外の発見 ① を `M23` のスコープに入れるか、`followup` へ回すか
- **なぜ決める必要があるか**: **★軸 G の (a) を潰す過程で見つかったものであり、`M23` の目的（消したものを戻す）とは直接関係しない。** ただし**要決定事項 1 の案 2（`materialized_from_combo_id` を汎用の由来列に読み替える）を採る場合は、同じ列を触るため合流する**
- **決めないと何が止まるか**: **止まらない。** ただし要決定事項 1 で案 2 を検討する際に必ず交差する

---

## §`followup-backlog` への登録候補

**★製造は `followup-backlog` を編集していない**（`D-382`）。**以下 5 項目を設計卓へ渡す。**

### ① `materialize-origin-lost-on-put`

| 項目 | 内容 |
|---|---|
| **スラッグ** | `materialize-origin-lost-on-put` |
| **何が起きるか** | **materialize で生成したコンボを `PUT /api/combos/:id`（識別キー変更編集）すると、新行の `combos.materialized_from_combo_id` が NULL になり、出自が失われる。** 確定反撃マイリストの「生成元バッジ」（`web/src/features/punish/components/PunishList.tsx:143`）が消え、`listMaterializedBaseComboIDsSQL`（`internal/repository/punish/queries.go:57-65`）が基底コンボを「materialize 済み」と見なさなくなる |
| **再現条件または根拠** | **逐語根拠**: `internal/service/combo/service.go:1102-1123` `buildComboFromInput` の struct literal に `MaterializedFromComboID` が無い ／ 同ファイル `:558` で `PUT` が同関数を使う ／ `internal/repository/combo/repository.go:310` が `combo.MaterializedFromComboID` をそのまま bind する。**書き込みは `service.go:981`（`Materialize`）の 1 か所のみ**（全数走査済み）。**★実行による再現は未実施**（dev DB 不在） |
| **割付の候補と理由** | **`M18-03b` の領域**（同サブは `combo_punishes` / `combo_punish_curations` の再ポイントを `service.go:691-699` で実装しており、**同じ「`PUT` で silent に消える」の型**。同箇所のコメントが「これを行わないと識別キー変更編集で採用が silent に消える(followup §I-(b))」と明記している）。**★`M23` の要決定事項 1 で案 2（`materialized_from_combo_id` の汎用化）を採る場合のみ `M23-01` へ合流する** |
| **新規か既存行の更新か** | **新規**（走査＝`grep -rni "materialize" docs/handover/followup-backlog.md` の結果を本報告では確認していない ⇒ **設計卓が既存行の有無を確認したうえで判断されたい**） |

### ② `permanent-delete-cascade-untested`

| 項目 | 内容 |
|---|---|
| **スラッグ** | `permanent-delete-cascade-untested` |
| **何が起きるか** | **完全削除が CASCADE に依存している 5 表（`combo_steps` / `combo_tags` / `combo_oki_options` / `combo_punishes` / `combo_punish_curations`）について、「子も消えたこと」を主張するテストが 0 件である。** `P-04`（`PRAGMA foreign_keys` が接続プール全体に効かない）で CASCADE が発火しなくても、全テストは緑のまま |
| **再現条件または根拠** | `internal/repository/combo/repository.go:964-983` `HardDelete` が明示削除するのは `combo_setup_results` / `combo_setups` の 2 表のみ。`migrations/*.up.sql` の `REFERENCES combos(id) ON DELETE CASCADE` は 6 表（うち 1 表が明示削除済み）。テスト全数は本報告 §F-4 の表 8 本。走査＝`grep -rn -B2 -A20 "HardDelete(ctx, tx" --include=*_test.go internal/ \| grep -iE "combo_steps\|combo_tags\|combo_oki"` → **0 件** |
| **割付の候補と理由** | **`M23-06` または `P-04` 根治の独立サブ**。**★`M23-overview` §1.3-5 が `P-04` の根治を M23 のスコープ外としているため、テストの追加だけを `M23` で行い、根治は独立サブへ残す分割もありうる** |
| **新規か既存行の更新か** | **既存行（`P-04`）の更新が有力**——ボード `P-04` は「根治は独立サブ推奨」と既に記録している。**本項は「影響範囲が 5 表であること」と「検出器が 0 件であること」の 2 つの実測を足すもの** |

### ③ `trash-row-click-404`

| 項目 | 内容 |
|---|---|
| **スラッグ** | `trash-row-click-404` |
| **何が起きるか** | **ゴミ箱の行をクリックすると `/combos/:id` へ遷移するが、`GET /api/combos/:id` が `deleted_at IS NULL` で締め出しており 404 を返す。** `DES-005` §5.15 の「行クリック → 詳細表示（読み取り専用のコンボ詳細）」が機能しない |
| **再現条件または根拠** | `web/src/features/combo/components/TrashListRow.tsx:73`（行全体の `onClick`）と `:83`（2 列目の `<Link>`）が `/combos/${combo.id}` を指す ／ `internal/repository/combo/repository.go:363-364` `FROM combos WHERE id = ? AND deleted_at IS NULL` ／ `internal/api/combo/handler.go:114-116` が `ErrNotFound` を 404 に落とす。**★実機での 404 確認は未実施**（dev サーバ未起動） |
| **割付の候補と理由** | **`M23-01`**（`DES-005` §5.15 の撤回と as-built 化が同サブの担当であり、本項はその判断対象そのもの）。**要決定事項 5 と同一** |
| **新規か既存行の更新か** | **新規**（`M23-overview` §2.3 が「`followup-backlog` に M23 へ割り付けられた行は 1 件も無い」と 2026-08-20 に実査済み） |

### ④ `dev-db-absent-in-cloud-session`

| 項目 | 内容 |
|---|---|
| **スラッグ** | `dev-db-absent-in-cloud-session` |
| **何が起きるか** | **クラウド実行環境（使い捨てコンテナ・新規 clone）には dev DB が存在しないため、実データに対する `SELECT` を求める調査項目が実行できない。** 本調査では軸 G-4 / H-5 が未実査になった |
| **再現条件または根拠** | `find / -name 'combomgr*.db' -o -name '*.db' -path '*combomgr*'` → **0 件** ／ `ls -la ~/.local/share/` に `combomgr/` 無し ／ `.gitignore:24-27` が `*.db` / `*.db-journal` / `*.db-shm` / `*.db-wal` を除外。**構造的な不在であり、環境の一時的な不調ではない** |
| **割付の候補と理由** | **プロセス面（`docs/process/remote-ops.md` または指示書テンプレート）**。**★これは実装の欠陥ではなく、指示書の設計時に踏むべき前提である**——「dev DB への `SELECT`」を DoD に入れた指示書は、クラウド実行では必ず未実査になる。**`IMPROVE-01` が扱った「クリーンなクローンで検査が回らない」と同じ型**（`E-...` の系統）。**⇒ 指示書側に「dev DB を要する項目は、クラウド実行なら未実査として扱う」の但し書きを置くか、seed 済みの検証用 DB を生成する手順を用意するかの判断が要る** |
| **新規か既存行の更新か** | **新規**（既存の `e2e-requires-pnpm-install-on-clean-clone` と同じ「クリーンな環境では回らない」系統だが、対象が `node_modules` ではなく dev DB であり別物）。**★設計卓が既存行への追記で畳む判断もありうる** |

### ⑤ `architecture-patterns-s11-setup-exception`

| 項目 | 内容 |
|---|---|
| **スラッグ** | `architecture-patterns-s11-setup-exception` |
| **何が起きるか** | **`architecture-patterns` §11「論理削除された親の子は、物理的に残る」「復元は親の `deleted_at` を戻せば子が繋がったまま復帰する形になりうる」が、セットプレイには当てはまらない。** `DeleteSetup` が `combo_setups` と `recipe_cache` を明示的に物理削除しているため、`setups.deleted_at` を NULL に戻しても紐付けは戻らない |
| **再現条件または根拠** | `internal/service/setup/service.go:467-470`（`DeleteComboSetupsBySetupID` を「案 P1: `combo_setups` を明示的に削除（論理削除時は CASCADE 不発火）」のコメント付きで呼ぶ）／ 同 `:472-475`（`DeleteSetupCache`）。**★コンボ側の `service.Delete`（`service.go:746-769`）は `combo_setups` を消さない ⇒ 両者は非対称** |
| **割付の候補と理由** | **`M23-02`**（セットプレイ側の欠けを揃えるサブが、同節を前提にすると外すため）。**あわせて `architecture-patterns` §11 への追記が要る**——**★同書は `docs/handover/` 配下であり製造は編集しない。設計卓の手番** |
| **新規か既存行の更新か** | **新規**。**★ただし「`followup-backlog` への登録」ではなく「`architecture-patterns` §11 の追記」で畳む形もありうる**（同書は継続更新ファイルであり、行として足せる） |

---

## §DoD 対応表（自己点検）

| # | 完了条件 | 状態 |
|---|---|---|
| 1 | §4 の軸 A〜H を全項目、実値で報告した | **★G-4 / H-5 を除き達成**（両者は §0.3 の理由で未実査と明記） |
| 2 | 「無い」と書いた項目すべてに走査コマンドと走査範囲が添えてある | **達成**（§0.1 が範囲、§0.2 がコマンド全文。各軸で個別の走査も逐語で再掲） |
| 3 | 軸 C を 4 層すべてで探した | **達成**（§C-1 にルート・ハンドラ・サービス・リポジトリの層別ヒット表） |
| 4 | 軸 D-3 に逐語の `WHERE` 句で答えている | **達成**（`repository.go:897` の逐語 + 0 行時の分岐 `:910-921` の逐語） |
| 5 | 軸 E の全数が件数で示されている | **達成**（combos 読み取り 15 = 持つ 11 / 持たない 3 / 部分 1、setups 読み取り 14 = 持つ 13 / 持たない 1） |
| 6 | 軸 G-2 の候補 (a)〜(d) を全部確認した | **達成**（4 つとも個別に判定。(a) は G-5 で逐語 3 段） |
| 7 | dev DB に対する `SELECT` を回した項目に基準時点とコマンドが添えてある | **★該当なし（未実査）**。**代わりに不在の根拠（`find /` 0 件）と、開発者が回せる SQL 完成形（G-4 に 4 本 / H-5 に 3 本）を置いた** |
| 8 | read-only を逸脱していない。作業ツリーの差分一覧を報告へ転記する | **達成**（§0.4） |
| 9 | `docs/progress/progress-log.md` へ索引行を追記した | **達成**（本報告の commit と同時） |
| 10 | §要決定事項が `M23-01` の指示書執筆に足る粒度でそろっている | **達成**（7 件。うち `M23-01` に直結するのは 1 / 5） |

---

*以上*
