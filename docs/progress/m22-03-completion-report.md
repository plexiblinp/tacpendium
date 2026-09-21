# M22-03 完了報告: 楽観排他の実効化（版の突き合わせを固定し、契約を 1 つに揃える）

| 項目 | 内容 |
|------|------|
| 対象指示書 | `docs/instructions/M22-03-optimistic-locking.md` v1.0.0 |
| 実施日 | 2026-08-16 |
| ブランチ | `claude/m22-03-implementation-plan-5fp989` |
| CHANGE | **`CHANGE-114`**（**開発者が本セッションで承認済みと回答**。**★通知書のステータス行が「起票（未承認・未反映）」のまま＝設計卓の更新漏れ**。§12 参照） |
| 関連裁定 | **`D-394`**（粒度の確定・スキーマ変更 0） ／ **`D-406`**（三点セット発行 ＋ エラーコード統一の割付変更） |
| マイグレ消費 | **0 本**（`D-394` のとおり。§9） |
| 状態 | **実装・自己テスト完了。★開発者の手動確認は不要**（`D-398` のいずれにも当たらない＝指示書 §7.1） |

> **★本サブは「作る」サブではなく「固定する」サブである。** 実測では 3 経路とも既に版を突き合わせていた。**⇒ 利用者から見た挙動は変わっていない。それが正しい。** 本番コードの差分はエラーコード 3 箇所とフロント 1 箇所だけであり、残りはテストである。

---

## 1. §3.3 の実査 8 項目の結果

### 1.1 3 経路の実体

| 経路 | ハンドラ | 突き合わせの位置 | 変更前のコード | 変更後 |
|---|---|---|---|---|
| `PATCH /api/combos/:id` | `internal/api/combo/handler.go:315` `UpdateMetadata` | **repository 層** `internal/repository/combo/repository.go:894-898`<br>`UPDATE combos SET %s WHERE id = ? AND version = ? AND deleted_at IS NULL` → `RowsAffected()==0` を `:905-921` で `SELECT COUNT(*)` により NotFound / Conflict 弁別 | 409 / `conflict` | 409 / **`version_conflict`** |
| `PUT /api/combos/:id` | `internal/api/combo/handler.go:362` `UpdateWithKeyChange` | **service 層に SQL 直書き**（repository を経由しない）`internal/service/combo/service.go:597-599`。旧行の論理削除 UPDATE が版確認を兼ねる → `:604-622` で弁別 | 409 / `conflict` | 409 / **`version_conflict`** |
| `PATCH /api/setups/:id` | `internal/api/setup/handler.go:177` `UpdateSetup` | **repository 層** `internal/repository/setup/repository.go:390-395` → `:399-414` で弁別 | 409 / `version_conflict` | **変更なし**（揃える先） |

- **Go コード上の `a.Version != b.Version` 形の比較は 0 件。** すべて SQL の `WHERE` 句 ＋ `RowsAffected()==0`。
- センチネル: `comborepo.ErrConflict`（`repository.go:25-26`）／ `setuprepo.ErrConflict`（`repository.go:24-25`）。サービス層は同一値をエイリアス再エクスポートしている。
- **`version = version + 1` の SQL は 2 本のみ**（`combo/repository.go:894` ／ `setup/repository.go:393`）。**`PUT` 経路は +1 の SQL を持たない**——旧行を論理削除し、新行を `version = 1` で採番し直す（`service/combo/service.go:625`）。
- 既存テストの固定強度（**`M22-RESEARCH-01` A-5 の非対称が HEAD でも残っていた**）:
  - `internal/api/combo/handler_test.go:770` → **ステータス 409 のみ**
  - `internal/api/combo/handler_test.go:876` → **ステータス 409 のみ**
  - `internal/api/setup/handler_test.go:429` → 409 ＋ `Error.Code == "version_conflict"`
  - **⇒ §4.1-5 のとおり強度を揃えた**（§3 参照）。

### 1.2 ★`version_conflict` への統一の影響範囲（全数）

**走査の作法**——`\b` は `_` を単語構成文字として扱うため、`\bconflict\b` は `version_conflict` にも `alias_conflict` にもマッチしない。**この分離が成立していることを、網羅トークン走査 `[A-Za-z_]*conflict[A-Za-z_]*` で裏取りした。**

| 区分 | `conflict`（統一前） | `version_conflict`（統一前） |
|---|---|---|
| 本番 Go（コード文字列として返却） | **2**（`combo/handler.go:332` / `:379`） | 1（`setup/handler.go:194`） |
| 本番 TS（コード文字列で比較・判定） | **0** | **0** |
| テスト（コード文字列を固定） | **0** | 3 |
| E2E | 0 | 0 |
| i18n 翻訳ファイル（`web/src/locales/`） | 0 | 0 |
| Go のエラーコード定数定義 | **0**（すべて生リテラル） | 0 |
| ドキュメント | 71 行 | 65 行（重複除去後 24 ファイル） |

**⇒ 本番コードの変更は Go 2 行のみ。§9.3-2「想定より広い」には当たらないと判断し、停止しなかった。**

**★フロントは 409 の理由を区別していない**——`web/src/features/setup/errors.ts:26` も `ComboEditor.tsx:441` も `err.status === 409` のみを見る。**⇒ `conflict` への依存が 0 件であるため、統一によって「競合が不明なエラーになる」壊れ方は起こらない。** **見せ方は変えていない**（`M22-04` の担当＝§1.6-3・§4.3-5）。

### 1.3 ★版を上げるべき経路の判定 → §2 に全数を掲載

**★件数が指示書の記述から動いていた。**

| 区分 | 指示書（`M22-RESEARCH-01` 時点） | **HEAD の実測** |
|---|---|---|
| 非 GET ルート総数 | 36 | **41** |
| うち DB へ書くもの | 31 | **34** |
| `version` を受け取る | 3 | 3 |
| **`version` を受け取らない** | **33** | **38** |
| **うち DB へ書くもの** | **28** | **31** |

**増分 5 本は `M22-01` / `M22-02` の as-built である**——`POST /api/users`・`PATCH /api/users/:id`（`users` ＋ 既定タグの `tags` へ書く）／ `POST /api/auth/login`・`POST /api/auth/logout`（メモリ上のセッションのみ・DB 書込なし）／ `POST /api/auth/password`（`config.toml` へ書く・DB 書込なし）。

**開発者回答（2026-08-16）により、HEAD の実測 38 件を判定対象とした。** 判定表は §2。

### 1.4 `ComboEditor.buildPatchPayload` の実体

- 変更前: `web/src/features/combo/components/ComboEditor.tsx:238` — `version: initial?.version ?? 0`
- **`initial` が不在のまま PATCH に到達する経路は実在しなかった**（`?? 0` は実行時到達不能な dead fallback）:
  - `buildPatchPayload` の参照は定義と `runPatch` の 2 箇所のみ
  - `runPatch` の唯一の呼び出しは `proceedSave` の **`if (initial && initialKey)` ブロックの内側**。`initialKey` は `initial && mode === "edit"` のときのみ非 null
  - 本番の呼び出し元は `web/src/pages/ComboEditorPage.tsx:86-90` の 1 箇所のみ。同ページは `isLoading` / `isError` で早期 return し、`mode === "edit"` では `useCombo` の `enabled` が必ず true になるため `data === undefined` のまま描画へ到達しない
- **⇒ 型で表せる。§4 のとおり直した。**

### 1.5 一意制約違反の 409 の実体

`internal/api/preset/handler.go:213-220` — **`alias_conflict`** ＋ `details.aliasText`。`internal/api/preset/write_handler_test.go:299-303` と `web/e2e/m20-04-preset-management.spec.ts:297-299` が既に固定している。

**版不一致と文字列が重ならず、サーバ側では区別可能。⇒ 触っていない**（§4.3-6）。

409 を返す他のコード（実測 **10 種**。`version_conflict` を除く）: `alias_conflict` / `preset_name_duplicate` / `preset_limit_exceeded` / `preset_in_use_by_config` / `tag_name_duplicate` / `tag_in_use` / `duplicate_setup` / `combo_not_in_trash` / **`rush_variant_exists`**（`internal/api/move/handler.go:138`） / **`user_name_duplicate`**（`internal/api/user/handler.go:82`）。**⇒ 総称 `conflict` では「どの衝突か」が読めないという `M22-overview` §4.2.2 の指摘は、実装上も妥当であった。**

### 1.6 ★`recipe_cache` の実体（**指示書の「3 本」は combos 側のみ。実測は 6 本**）

| 表 | 関数 | 位置 | `updated_at` | `version` |
|---|---|---|---|---|
| `combos` | `UpdateRecipeCache`（非 tx） | `combo/repository.go:1340-1343` | **進める** | 進めない |
| `combos` | `UpdateRecipeCacheTx` | `:1350-1353` | 進めない | 進めない |
| `combos` | `SetRecipeCacheNullTx` | `:1360-1362` | 進めない | 進めない |
| `setups` | `UpdateRecipeCache`（非 tx） | `setup/repository.go:451-454` | **進める** | 進めない |
| `setups` | `UpdateRecipeCacheTx` | `:461-464` | 進めない | 進めない |
| `setups` | `SetRecipeCacheNullTx` | `:471-473` | 進めない | 進めない |

**直していない**（§4.5-1・契約 F-5）。**as-built は §6 に記載。**

### 1.7 `make e2e` の前提

- **`web/node_modules` が不在だった**（followup `e2e-requires-pnpm-install-on-clean-clone` の状態）。**`make e2e` は `config.toml` と Chromium は吸収するが `pnpm install` は吸収しない**（`Makefile:83-104`）。**⇒ 着手前に `cd web && pnpm install` を回した。** **★自分の変更を疑う前にこの前提を確認した。**
- Chromium は `/opt/pw-browsers/chromium` にプリインストール済み（Makefile が `PW_EXECUTABLE_PATH ?= $(wildcard ...)` で拾う）。
- `config.toml` は不在時のみ `config.toml.example` から生成される（既存は上書きしない）。
- `go build ./...` は着手前から成功していた。

### 1.8 `M22-RESEARCH-01` の実パスと HEAD での成否

- 実パス: **`docs/progress/M22-RESEARCH-01-report.md`**（指示書本体は `docs/instructions/M22-RESEARCH-01-collaboration-baseline.md`）
- **軸 A は HEAD で今も全て成り立つ**——3 経路・突き合わせ位置・エラーコード・`+1` の 2 本・既存テストの非対称。`M22-02`（`bb9ec50` / `c198f6e`）は `combo_tags` のスコープ絞り込みを入れたが、**版の突き合わせも `version + 1` の位置も動かしていない**。**⇒ §9.3-7 には当たらなかった。**
- **軸 B はルート件数のみ動いていた**（§1.3）。線引きの結論は不変。

---

## 2. ★38 経路の判定（経路ごとに 1 行の根拠）

**判定基準は指示書 §1.3 の表**（`M22-overview` §4.2.2 を逐語で持ち込んだもの）。

**★結論を先に書く——「対象なのに `combos.version` / `setups.version` を上げていない」経路は 0 件であった。** 根拠は下表のとおり経路ごとに示す（`E-84`: 「0 件だった」で終わらせない）。

| # | メソッド・パス | DB 書込 | 書き込む表 | 判定 | 根拠（1 行） |
|---|---|---|---|---|---|
| 1 | POST `/api/auth/login` | ✕ | —（メモリ上のセッション） | 対象外 | 集約のどの表にも書かない。`M22-01` の as-built |
| 2 | POST `/api/auth/logout` | ✕ | —（メモリ） | 対象外 | 同上 |
| 3 | POST `/api/auth/password` | ✕ | `config.toml` | 対象外 | DB を書かない。設定であってコンボの内容ではない |
| 4 | POST `/api/combos` | ○ | `combos`(INSERT) 他 | 対象外 | **新規行を `version = 1` で作る。既存の版を上げる対象が無い** |
| 5 | POST `/api/combos/check-duplicate` | ✕ | — | 対象外 | 読み取りのみ（`service/combo/service.go:839`「保存は行わない」） |
| 6 | DELETE `/api/combos/:id` | ○ | `combos`（`deleted_at` ＋ `recipe_cache=NULL`） | 対象外 | **削除は「編集」ではない**（§1.6-5）。上げると削除のたびに他端末の編集が弾かれる |
| 7 | POST `/api/combos/:id/restore` | ○ | `combos`（`deleted_at=NULL`） | 対象外 | 削除の裏返し。同上（§1.6-5） |
| 8 | DELETE `/api/combos/:id/permanent` | ○ | `combo_setup_results` / `combo_setups` / `combos`（DELETE） | 対象外 | 行そのものが消えるため版の概念が無い |
| 9 | POST `/api/combos/:id/materialize` | ○ | `combos`(INSERT) 他 ／ `combo_punishes` ／ `combo_punish_curations` | 対象外 | **新しいコンボを `version = 1` で生成する。元コンボの内容を変えない。** 確定反撃系 2 表は §1.3 で対象外 |
| 10 | POST `/api/import/csv/preview` | ✕ | — | 対象外 | dry-run（`service/comboio/import.go:21` は読取のみ） |
| 11 | POST `/api/import/csv` | ○ | combo Create 経路の全表 ＋ `tags` ＋ setup Create 経路 | 対象外 | **コンボ本体は新規 INSERT のみ**（`DupAction` は `skip` / `setups_only` で、どちらも既存コンボ本体をスキップする）。**`setups_only` は既存コンボへ `combo_setups` を足すが**（`internal/service/comboio/import.go:198-211`）、**紐付けは §1.3 で対象外** |
| 12 | PUT `/api/config` | **○** | `config.toml` ／ **`combos.recipe_cache`・`setups.recipe_cache`** | 対象外 | **★書くのは `recipe_cache` 列だけであり、`recipe_cache` は §1.3 で対象外。** `defaults.preset_id` が変わると `internal/service/config/service.go:277` の `onDefaultPresetChanged` が発火し、`cmd/combomgr/main.go:271` の配線で `RecomputePresetCache` が走る（`CHANGE-102` / `M20-05` の as-built） |
| 13 | POST `/api/intake/resolve` | ✕ | — | 対象外 | 照合のみ |
| 14 | POST `/api/intake/csv` | ✕ | — | 対象外 | CSV 文字列生成のみ |
| 15 | PATCH `/api/moves/:id` | ○ | `moves` | 対象外 | **技マスタであってコンボの内容ではない。**`DES-002` §4.2 が「楽観ロックは設けない（MVP は last-write-wins、version 列なし）」と明記（`CHANGE-032` / `CHANGE-054`） |
| 16 | POST `/api/moves/:id/rush-variant` | ○ | `moves`(INSERT) ／ `move_derivations` | 対象外 | 同上。技マスタの追加 |
| 17 | POST `/api/presets` | ○ | `presets` ／ `preset_aliases` ／ `*.recipe_cache` | 対象外 | **§1.3「タグ・プリセット」。**`combos` への UPDATE は `recipe_cache` 列のみ＝同表の `recipe_cache` 行で対象外 |
| 18 | PUT `/api/presets/:id` | ○ | 同上 | 対象外 | 同上 |
| 19 | DELETE `/api/presets/:id` | ○ | 同上 | 対象外 | 同上 |
| 20 | POST `/api/combo-punish-starters` | ○ | `combo_punish_starters` | 対象外 | **§1.3「確定反撃系 4 表」**。関係の記録であってコンボの内容ではない |
| 21 | DELETE `/api/combo-punish-starters` | ○ | 同上 | 対象外 | 同上 |
| 22 | POST `/api/combo-punishes` | ○ | `combo_punishes` | 対象外 | 同上 |
| 23 | DELETE `/api/combo-punishes` | ○ | 同上 | 対象外 | 同上 |
| 24 | POST `/api/combo-punish-prunings` | ○ | `combo_punish_prunings` | 対象外 | 同上 |
| 25 | DELETE `/api/combo-punish-prunings` | ○ | 同上 | 対象外 | 同上 |
| 26 | POST `/api/combo-punish-curations` | ○ | `combo_punish_curations` | 対象外 | 同上 |
| 27 | DELETE `/api/combo-punish-curations` | ○ | 同上 | 対象外 | 同上 |
| 28 | POST `/api/combos/:comboId/setups` | ○ | `setups`(INSERT) ／ `setup_steps` ／ `combo_setups` ／ `combo_setup_results` | 対象外 | **新規セットプレイを `version = 1` で作る。** 紐付けと成立条件は §1.3 で対象外 |
| 29 | POST `/api/combos/:comboId/setup-links` | ○ | `combo_setups` | 対象外 | **§1.3「セットプレイ紐付け」**。紐付けの追加は「そのコンボの内容」ではなく関係の記録 |
| 30 | DELETE `/api/combos/:comboId/setup-links/:setupId` | ○ | `combo_setup_results` ／ `combo_setups` | 対象外 | 同上 |
| 31 | DELETE `/api/setups/:id` | ○ | `setups`（`deleted_at`） 他 | 対象外 | **削除は「編集」ではない**（§1.6-5） |
| 32 | PUT `/api/combos/:comboId/setups/:setupId/results` | ○ | `combo_setup_results` | 対象外 | **§1.3「成立条件」。** 衝突は `(combo_id, setup_id, tech_type, in_corner)` の組単位で起きる。**集約に含めると検証記録を 1 行足すたびに本体編集と衝突する** |
| 33 | DELETE `/api/combos/:comboId/setups/:setupId/results` | ○ | 同上 | 対象外 | 同上 |
| 34 | POST `/api/tags` | ○ | `tags` | 対象外 | **§1.3「タグ・プリセット」**。`FR013` により作成者のみ編集可能で、衝突は同一人物の 2 端末に限られる |
| 35 | PATCH `/api/tags/:id` | ○ | `tags` | 対象外 | 同上 |
| 36 | DELETE `/api/tags/:id` | ○ | `tags`（＋ `combo_tags` は DDL の `ON DELETE CASCADE`） | 対象外 | 同上。**★注記は下記** |
| 37 | POST `/api/users` | ○ | `users`(INSERT) ／ `tags`（既定タグを同一 tx で） | 対象外 | 集約のどの表にも書かない。`tags` は §1.3 で対象外。`M22-02` の as-built |
| 38 | PATCH `/api/users/:id` | ○ | `users` | 対象外 | 利用者の改名。集約に触れない |

> **★#36（`DELETE /api/tags/:id`）についての注記**——**判定は「対象外」で線引きに収まる**（このルートが発行する SQL は `tags` の DELETE であり、`tags` は §1.3 で明示的に対象外）。**ただし DDL の `ON DELETE CASCADE` により `combo_tags` の行が連鎖削除されるため、「コンボに付いているタグ」が `combos.version` を上げずに変わる状態が起こりうる。**
>
> **★これは §9.3-4 の「対象なのに上げていない経路」には当たらない**——ルート自身は集約の表に書き込まないためである。**⇒ 自分で塞がず、設計卓への申し送りとした**（§12）。**塞ぐ場合はタグ削除のたびに、そのタグが付いた全コンボの版が上がることになる。** `FR013` によりタグ削除は作成者のみが行えるため、実害の窓は狭い。

**★「対象」に当たるのに上げていない経路は 0 件であったため、§9.3-4 の停止は発生しなかった。** **§9.3-5（線引きに当てはめられない経路）も 0 件。**

---

## 3. ★破壊確認 A / B の結果

### 3.1 破壊確認 A — 版の突き合わせを外す

**壊し方**——3 経路すべての `WHERE … AND version = ? AND …` を、**プレースホルダ 1 個を保ったまま常に真になる `AND ? IS NOT NULL` へ置換した**（`version` は `NOT NULL` の整数のため常に真。引数の個数を変えずに突き合わせだけを無効化する）。

```
internal/repository/combo/repository.go:897  UPDATE combos SET %s WHERE id = ? AND ? IS NOT NULL AND deleted_at IS NULL
internal/repository/setup/repository.go:394  WHERE id = ? AND ? IS NOT NULL AND deleted_at IS NULL
internal/service/combo/service.go:599        WHERE id = ? AND ? IS NOT NULL AND deleted_at IS NULL
```

**Go テストの実出力:**

```
ok  	github.com/plexiblinp/combomgr/internal/api/combo	(cached)
ok  	github.com/plexiblinp/combomgr/internal/api/setup	(cached)
--- FAIL: TestRepository_UpdateMetadata_VersionConflict (0.71s)
--- FAIL: TestRepository_UpdateMetadata_EmptySetStillBumpsVersion (0.71s)
FAIL	github.com/plexiblinp/combomgr/internal/repository/combo	31.980s
ok  	github.com/plexiblinp/combomgr/internal/repository/setup	(cached)
--- FAIL: TestService_UpdateMetadata_VersionConflict (0.58s)
--- FAIL: TestService_UpdateWithKeyChange_VersionConflict (0.54s)
--- FAIL: TestService_UpdateMetadata_VersionConflict_TagIDs_NoChange (0.54s)
FAIL	github.com/plexiblinp/combomgr/internal/service/combo	71.303s
--- FAIL: TestService_UpdateSetup_VersionConflict (0.72s)
FAIL	github.com/plexiblinp/combomgr/internal/service/setup	18.623s
```

**E2E の実出力**（`SUPP-001` §5.5 (10′)「E2E でも破壊確認を回す」）:

```
✘  1 …PATCH /api/combos/:id: 2 つの文脈が同じ版を持ち、後の保存が 409 version_conflict になる (246ms)
✘  3 …PUT /api/combos/:id: キー変更編集でも後の保存が 409 version_conflict になる (113ms)
✘  5 …PATCH /api/setups/:id: セットプレイでも後の保存が 409 version_conflict になる (111ms)
✓  7 …recipe_cache の再計算を挟んでも版は据え置かれ、再計算前に取った版で保存できる (120ms)
    Error: 後の保存は 409 ／ Error: 古い版の PUT は 409 ／ Error: 後の保存は 409
  3 failed / 1 passed (9.6s)
```

**⇒ 赤くなった。** リポジトリ層 2 本 ／ サービス層 4 本 ／ E2E 3 本。

#### 3.1.1 ★赤にならなかった項目——ハンドラ層テスト（`SUPP-001` §5.5 (10′)）

**`internal/api/combo` と `internal/api/setup` は緑のままだった。**

**何が代わりに守っていたか**——**ハンドラ層のテストは `mockService` を使っており、実 SQL を通らない。** モックが `ErrConflict` を返す前提で「そのとき 409 ＋ `version_conflict` を返すか」だけを見ている。**⇒ 版の突き合わせそのものは、ハンドラ層の関心ではない。**

**⇒ 層の切り分けとして正しい状態であり、「テストが弱い」ではない。** 突き合わせを守っているのは次の 2 層であり、**どちらにも契約テストが置かれている**:

| ガードの位置 | 守っている契約 | 同じ層の契約テスト |
|---|---|---|
| `repository/combo`・`repository/setup` の SQL `WHERE … AND version = ?` ／ `service/combo` の直書き SQL | **古い版では 1 行も更新されない** | `TestRepository_UpdateMetadata_VersionConflict` ／ **`TestRepository_UpdateMetadata_EmptySetStillBumpsVersion`（本サブで追加）** ／ `TestService_UpdateMetadata_VersionConflict` ほか 3 本 |
| ハンドラ層の `errors.Is(err, ErrConflict)` → 409 ＋ コード | **その失敗が利用者へどう返るか** | `TestHandler_UpdateMetadata_409_VersionConflict` ／ `TestHandler_UpdateWithKeyChange_409_VersionConflict` ／ `TestHandler_UpdateSetup_409_VersionConflict`（**いずれも本サブでコード文字列まで固定**） |
| 全経路の結合 | **利用者の操作として拒否されること** | **`web/e2e/m22-03-optimistic-locking.spec.ts`（本サブで新設）** |

**★E2E を置いたことが効いた**——単体だけだと「ハンドラ層が緑だから守られている」と読み違える余地が残る。**E2E が 3 本とも赤くなったことで、突き合わせを外せば利用者の操作が実際に通ってしまうことが示された。**

**撤去確認**: `git diff --stat` で本番コードの差分 0 を確認済み（§9）。

### 3.2 破壊確認 B — エラーコードを `conflict` へ戻す

**壊し方**——`internal/model/api_error.go:9` の `ErrorCodeVersionConflict` を `"conflict"` へ戻した。

#### 3.2.1 ★1 回目は空振りした（**そして、それが本サブで最も重要な発見である**）

**1 回目の実出力:**

```
ok  	github.com/plexiblinp/combomgr/internal/api/combo	1.299s
ok  	github.com/plexiblinp/combomgr/internal/api/setup	0.009s
--- FAIL: TestErrorCode_AliasConflict_DistinctFromVersionConflict (0.00s)
    write_handler_test.go:339: ErrorCodeVersionConflict = "conflict"。総称ではどの衝突か読めない
FAIL	github.com/plexiblinp/combomgr/internal/api/preset	13.273s
```

**★ハンドラ層の 3 本が緑のままだった。** 原因——**期待値に `model.ErrorCodeVersionConflict` を使っていたため、定数の値を変えるとテストの期待値も一緒に動いていた。** **⇒ 「Go の内部で一貫していること」しか見ておらず、「線を流れる文字列が何か」を固定していなかった。**

**これは本サブが防ごうとしていた失敗そのものである**——**テストは緑のまま、通信の契約だけが変わる。** 破壊確認を回さなければ気づけなかった。

**是正**——期待値をリテラルへ変えた。

```go
// wantVersionConflictCode は版不一致のときに応答本文へ現れるべきコード文字列。
//
// ★あえてリテラルで書く。model.ErrorCodeVersionConflict を参照すると、定数の値を
// 変えたときにテストも一緒に動いてしまい、「通信の契約が変わった」ことを検出できない。
// ここが固定するのは Go の内部整合ではなく線を流れる文字列である。
const wantVersionConflictCode = "version_conflict"
```

#### 3.2.2 再実施の実出力

```
--- FAIL: TestHandler_UpdateMetadata_409_VersionConflict (0.00s)
    handler_test.go:807: Error.Code = "conflict", want "version_conflict"
--- FAIL: TestHandler_UpdateWithKeyChange_409_VersionConflict (0.00s)
    handler_test.go:961: Error.Code = "conflict", want "version_conflict"
FAIL	github.com/plexiblinp/combomgr/internal/api/combo	1.263s
--- FAIL: TestHandler_UpdateSetup_409_VersionConflict (0.00s)
    handler_test.go:471: Error.Code = "conflict", want "version_conflict"
FAIL	github.com/plexiblinp/combomgr/internal/api/setup	0.009s
--- FAIL: TestErrorCode_AliasConflict_DistinctFromVersionConflict (0.00s)
    write_handler_test.go:339: ErrorCodeVersionConflict = "conflict"。総称ではどの衝突か読めない
FAIL	github.com/plexiblinp/combomgr/internal/api/preset	12.904s
```

**⇒ 赤くなった。** 3 経路すべて ＋ 一意制約違反との区別を主張する契約テスト。

**撤去確認**: 本番コードの差分 0（§9）。

---

## 4. ★`conflict` を見ていた箇所の全数と、更新後の状態

| # | 位置 | 変更前 | 変更後 |
|---|---|---|---|
| 1 | `internal/api/combo/handler.go:332`（`UpdateMetadata`） | `model.NewAPIError("conflict", …)` | `model.NewAPIError(model.ErrorCodeVersionConflict, …)` |
| 2 | `internal/api/combo/handler.go:379`（`UpdateWithKeyChange`） | 同上 | 同上 |
| 3 | `internal/api/setup/handler.go:194`（`UpdateSetup`） | `model.APIErrorResponse{Error: model.APIError{Code: "version_conflict", …}}` の直組み | `model.NewAPIError(model.ErrorCodeVersionConflict, …)`（**返す文字列は不変**） |

**★呼び出し側（フロント・テスト・E2E・i18n）で `conflict` を見ていた箇所は 0 件であった。** ⇒ 更新すべき箇所は無く、「片方だけ直して競合が不明なエラーになる」型の壊れ方は発生しない。**この 0 件は §7 の走査で裏取りしてある。**

### 4.1 ★エラーコードを定数化した（`CLAUDE.md` §4 ／ チェックリスト §6）

`internal/model/api_error.go` へ `ErrorCodeVersionConflict = "version_conflict"` を追加し、上記 3 箇所から参照した。

**★本サブが触る 3 箇所に限った。** 他のエラーコード（`alias_conflict` 等）は定数化していない——本サブのスコープ外であり、無関係な差分を増やさないため。**⇒ エラーコードの集中定義は「版不一致 1 種類だけが定数、残りは生リテラル」という中途の状態にある。** 全面的な定数化は設計卓への申し送りとした（§12）。

**フロント側 `web/src/constants/` への同期は行っていない**——フロントはエラーコード文字列で分岐しておらず（§1.2）、参照を作ることは「409 をどう見せるか」＝`M22-04` の面に踏み込むためである。`bash scripts/check-enum-sync.sh` の結果は §10。

---

## 5. `version: 0` フォールバックをどう直したか

**変更前**（`web/src/features/combo/components/ComboEditor.tsx:237-238`）:

```ts
const buildPatchPayload = (): UpdateMetadataRequest => ({
  version: initial?.version ?? 0,
  …
});
```

**変更後**——**対象コンボを引数で受け取る形にし、既定値そのものを不要にした。**

```ts
const buildPatchPayload = (target: ComboDetail): UpdateMetadataRequest => ({
  version: target.version,
  …
});

const runPatch = (target: ComboDetail, setupCarryOptions?: SetupCarryOptionsInput) => { … };

// proceedSave の中、initial の存在が確定している位置から渡す
if (initial && initialKey) {
  …
  runPatch(initial, setupCarryOptions);
}
```

**★既定値を別の数（`1` 等）へ差し替えていない**（§4.4-4）。**差し替えは「必ず失敗する」を「静かに他人の編集を上書きしうる」に変えるだけで悪化である。** 型で不在を表せなくしたため、既定値を置く場所が消えた。

**★props 型の判別可能ユニオン化までは踏み込んでいない**（§9.2-3「迷ったら固定する側を採る」）。理由——`ComboEditorPage.tsx:74-79` の `comboQ.data` は react-query 由来で `ComboDetail | undefined` であり、ユニオン化するとページ側に narrowing を 1 箇所足す必要が生じる。**それは本サブのスコープ（版の扱い）を越えて編集画面の型設計に手を入れることになる。** 引数化だけで「`version` に既定値を置かない」は型で保証されるため、そこで止めた。

**同関数内の `initial?.situation` は `target.situation` へ揃えた**（同じ値。挙動不変）。

---

## 6. ★`recipe_cache` の非同期の as-built（設計卓が `DES-003` へ明記する根拠）

**★直していない。仕様として確定させるだけである**（§4.5-1、契約 F-5）。

**as-built（逐語で書けるかたち）:**

> **`recipe_cache` の更新は `combos.updated_at` / `setups.updated_at` を進めるが、`version` は進めない。**
>
> - 非 tx 版（`UpdateRecipeCache`）は `updated_at = datetime('now')` を含み、**`updated_at` を進める**。
> - tx 版（`UpdateRecipeCacheTx`）と無効化（`SetRecipeCacheNullTx`）は `recipe_cache` 列だけを書き、**`updated_at` も進めない**。
> - **⇒ `updated_at` が進んでいても `version` が同じ状態が正常に起こりうる。**
> - **⇒ `updated_at` で競合を判定してはならない。** キャッシュの更新が編集の衝突として現れる。

**実装コメントの裏付け**: `internal/repository/combo/repository.go:212` —「`updated_at` も更新するが `version` はインクリメントしない（キャッシュは排他対象外）」。

**★指示書 §3.3-6 は「3 本」と書いていたが、実測は 6 本である**（`combos` 側 3 本 ＋ `setups` 側 3 本）。指示書の 3 本は `combos` 側のみを指していた。**`DES-003` への明記は両表について書く必要がある。**

**この as-built はテストで固定した**（§8 の #9）——`TestRepository_UpdateRecipeCache_DoesNotBumpVersion` が「`version` が据え置かれ」「`updated_at` は進み」「キャッシュ更新前に取った版で今も更新できる」ことを主張し、**`TestRepository_UpdateRecipeCacheTx_DoesNotBumpVersionOrUpdatedAt` が tx 版について「`version` も `updated_at` も進めない」ことを主張する**（**★対照実験つき**——同じ行に非 tx 版を撃つと `updated_at` は進む。これが無いと「そもそも書き込みが効いていない」形の空振りと区別できない）。**「直っていない」ことを固定するのが目的である。次の担当が「ずれている＝バグだ」と読んで直すのを防ぐ。**

---

## 7. 否定形確認の走査（§4.9）

**★走査コマンドをそのまま残す。**

### 7.0 ★陽性対照（`E-84`。「0 件だった」は「走査が壊れている」かもしれない）

```bash
rg -n '楽観排他の 409' docs/design/02-architecture.md
```

```
169:> **★楽観排他の 409 については本節にまだ規定が無い**（`M22-RESEARCH-01` §9-B-5 が「照合対象が無い」と報告した箇所）。**`M22-03` / `M22-04` で書き足す。**
```

**⇒ 当たった。走査は生きている。**

### 7.1 ★`conflict` の走査は単語境界で行った（§7.5-8）

**★`\b` は `_` を単語構成文字として扱うため、`\bconflict\b` は `version_conflict` にも `alias_conflict` にもマッチしない。** **この分離が成立していることを、網羅トークン走査で裏取りしてある**（`\b` に頼りきらない対照）。

```bash
# (a) 単語境界
rg -n '\bconflict\b' internal/ cmd/ web/src/ web/e2e/ -S
# (b) API エラーコードとしてのリテラル
rg -n '"conflict"' internal/ cmd/ web/src/ web/e2e/ -S
# (c) JSON 本文の形
rg -n '"code"\s*:\s*"conflict"' . -g '!node_modules' -g '!.git' -g '!web/dist' -S
# (d) 対照(取りこぼしが無いこと)
rg -o -i '[A-Za-z_]*conflict[A-Za-z_]*' internal/ cmd/ web/src/ web/e2e/ | sed 's/.*://' | sort | uniq -c | sort -rn
```

**(b) の結果（統一後・全 5 件。★API エラーコードとして返している箇所は 0 件）:**

| 位置 | 内容 | 判定 |
|---|---|---|
| `internal/model/api_error.go:6` | 「★総称の `"conflict"` を使わない理由」の godoc コメント | **意図的**。撤回した定義ではなく、撤回した理由の記録 |
| `internal/api/preset/write_handler_test.go:329` / `:338` | 総称へ寄せる変更を赤にする契約テスト（本サブで追加） | **意図的** |
| `web/src/features/setup/errors.test.ts:45` | 分類がコード文字列に依存しないことを 3 通りで示す入力データ | **意図的** |
| `internal/service/setup/service_test.go:439` | `name := "conflict"`（セットプレイ名のフィクスチャ） | **無関係**。エラーコードではない |

**(a) の結果**——上記に加え、`web/src/features/{keyboard,gamepad}/` のキー割当衝突の状態名（**契約 F-4 の凍結領域。別ドメインであり無関係**）、`internal/api/preset/handler.go:213` のローカル変数名 `conflict`（`*presetsvc.AliasConflictError`）、SQL の `ON CONFLICT` 句 8 箇所、センチネルのメッセージ文字列 2 件（`"combo: optimistic lock conflict"` ／ `"setup: optimistic lock conflict"`。**API コードではないため変更しない**）。

**(c) の結果**——`docs/instructions/M22-03-optimistic-locking.md:245`（**本走査の指示そのもの**）の 1 件のみ。**⇒ 本番コード・テスト資産・E2E に `"code":"conflict"` を返す／期待する箇所は 0 件。**

### 7.2 「楽観排他は未実装である」旨の記述

```bash
export LC_ALL=C.UTF-8   # 日本語散文の走査(SUPP-001 §5.5 (11′))
rg -n '楽観排他' internal/ cmd/ web/src/ web/e2e/ -S | rg '未実装|まだ|TODO'
rg -n '楽観排他|楽観ロック|楽観的排他' internal/ cmd/ web/src/ web/e2e/ -S
rg -n 'TODO' internal/ cmd/ web/src/ web/e2e/ -S | rg -i 'version'
```

- **「未実装」「まだ」「TODO」との共起: 0 件。**
- 「楽観（的）排他」の全出現 **20 件**を目視した。**いずれも実装と一致している**——`ErrConflict` のセンチネル説明、`repository.go:892`「楽観的排他: version 一致確認 + +1」、`dto.go:126` / `:165`「Version は楽観的排他のため必須」、`model/combo.go:147`「楽観的排他用」等。**失効した記述は無かった。**
- `TODO` ＋ `version` の共起: **0 件。**

### 7.3 「`version` 列を足す」旨の記述

```bash
rg -n 'version' internal/ cmd/ web/src/ web/e2e/ -S -i | rg '列を追加|カラムを追加|列の追加|version 列'
```

**0 件。** **⇒ `D-394`（1 本も足さない）に反する記述は本番コード・テスト資産に無い。**

### 7.4 ★`migrations/` に当たったもの（§4.9-4: 当たっても直さない）

```bash
rg -n '\bconflict\b' migrations/ -S
```

**8 件当たった**（`000014` / `000024` / `000043` / `000053` の各 `up.sql`）。**いずれも SQL の `ON CONFLICT DO NOTHING` 句とその説明コメントであり、API エラーコードとは無関係である。** **⇒ 直していない（適用済みマイグレは改変できない）。当たったことのみ記録する。**

### 7.5 ★当たったファイルの目視

**(a)〜(d) で当たった全ファイルを開いて確認した。** 上表・上記の分類はその結果である。**「体裁として残っているが実装と食い違う記述」は 1 件も見つからなかった。**

**⇒ 是正した失効記述は 0 件。** 本サブで追加した記述（`api_error.go` の godoc、テストのコメント）は、いずれも実装と一致している。

---

## 8. 自己テスト結果

**★終了コードだけを根拠に「緑」と書かない**（`E-125`）。**コマンド自身の出力を転記する。**

### 8.1 `go test ./...` — **52 パッケージすべて `ok`**

```
ok  github.com/plexiblinp/combomgr/cmd/combomgr                    2.313s
ok  github.com/plexiblinp/combomgr/internal/api/auth              11.677s
ok  github.com/plexiblinp/combomgr/internal/api/combo             (cached)
ok  github.com/plexiblinp/combomgr/internal/api/preset            17.775s
ok  github.com/plexiblinp/combomgr/internal/api/setup             (cached)
ok  github.com/plexiblinp/combomgr/internal/model                  0.004s
ok  github.com/plexiblinp/combomgr/internal/repository/combo      39.829s
ok  github.com/plexiblinp/combomgr/internal/repository/setup      (cached)
ok  github.com/plexiblinp/combomgr/internal/service/combo         82.124s
ok  github.com/plexiblinp/combomgr/internal/service/notation      22.573s
ok  github.com/plexiblinp/combomgr/internal/service/preset        28.215s
ok  github.com/plexiblinp/combomgr/internal/service/setup         20.424s
…（全 52 パッケージ。FAIL 0 件）
```

**★`FAIL` の行は 1 つも出ていない。**

### 8.2 `cd web && pnpm test -- --run`

```
 Test Files  158 passed (158)
      Tests  1474 passed (1474)
   Duration  78.37s (transform 5.09s, collect 43.93s, tests 52.57s, environment 83.83s, prepare 15.65s)
```

### 8.3 `make e2e` — **133 passed / 0 failed**

```
✓  118 [chromium] › e2e/m22-03-optimistic-locking.spec.ts:80:3  › …PATCH /api/combos/:id: 2 つの文脈が同じ版を持ち、後の保存が 409 version_conflict になる
✓  119 [chromium] › e2e/m22-03-optimistic-locking.spec.ts:112:3 › …PUT /api/combos/:id: キー変更編集でも後の保存が 409 version_conflict になる (250ms)
✓  120 [chromium] › e2e/m22-03-optimistic-locking.spec.ts:160:3 › …PATCH /api/setups/:id: セットプレイでも後の保存が 409 version_conflict になる (122ms)
✓  121 [chromium] › e2e/m22-03-optimistic-locking.spec.ts:201:3 › …recipe_cache の再計算を挟んでも版は据え置かれ、再計算前に取った版で保存できる (105ms)

  133 passed (2.9m)
```

**⇒ シナリオ A（既存フローの非回帰）も成立している。** 既存 spec 37 本のすべてが緑。

#### 8.3.1 ★1 回目の実行で 2 件落ちた（**自分の変更が原因。前提の取り違え**）

**落ちたのは新設した spec 自身であり、既存 spec ではない。**

| 落ちたテスト | 原因 | 直し方 |
|---|---|---|
| `PATCH /api/setups/:id` | セットプレイ作成が `characterId` と 1 ステップ以上を要求する（`VAL-S01` / `VAL-S02`）のに、`{name, steps: []}` だけを送っていた | seed から技 id を引いて `characterId` ＋ 1 ステップを渡す |
| `recipe_cache` の非同期 | `GET /combos/:id/recipe` は `preset_id` クエリが**必須**（`handler.go:458-461`）なのに付けていなかった → 400 | 組み込みプリセットを `/api/presets` から引いて渡す（**id を直書きしない**。`presets.id` には欠番がある） |

**あわせて対照を 1 つ足した**——レシピ解決の結果が空文字でないことを主張する。**これが無いと「キャッシュ経路をそもそも通っていないから版が上がらなかった」でも緑になる。**

#### 8.3.2 ★1 回目に `m18-03b-materialize.spec.ts` が flaky として報告された（**本サブとは無関係**）

```
1 flaky
  [chromium] › e2e/m18-03b-materialize.spec.ts:200:3 › M18-03b materialize ›
    C: 識別キー変更編集で採用が引き継がれる(§4.6・マイリストから消えない)
  Error: expect(received).toBe(expected)
  Expected: 204 / Received: 500
    at e2e/m18-03b-materialize.spec.ts:233:7   ← POST /api/combo-punishes
```

**リトライで緑になり（flaky 扱い）、2 回目の実行では 1 回目から緑であった。**

**★本サブの変更とは無関係である**と判断した根拠:

- 落ちた経路は `POST /api/combo-punishes`（確定反撃系）であり、**本サブが触った 4 ファイルのいずれも通らない**。
- 本サブの本番コード差分は `internal/api/{combo,setup}/handler.go` のエラーコード ／ `internal/model/api_error.go` の定数 ／ `ComboEditor.tsx` の 1 関数のみ。**`combo_punishes` の書き込み経路に接点が無い。**
- 2 回目の全実行（変更を積んだ状態）で**リトライなしに緑**であった。

**⇒ 既存の間欠不安定として設計伝達レポートへ回す**（§12.5）。**本サブでは直していない**（スコープ外であり、原因の特定には別途の調査が要る）。

#### 8.3.3 ★取り込み後の最終実行——**132 passed / failed 0 / flaky 1**

レビュー指摘の取り込み（§13）後に `make e2e` を回し直した。

```
  1 flaky
    [chromium] › e2e/m17-05c-pdf-pagination.spec.ts:107:3 › M17-05c PDF ページ分割 / PNG 上限対処 ›
      PNG 選択時は canvas 上限の注意書き(実測件数)が UI に出る
  132 passed (3.7m)
```

**★flaky になった spec が 1 回目と違う**（1 回目＝`m18-03b-materialize` ／ 最終＝`m17-05c-pdf-pagination`）。**⇒ 特定の spec の欠陥ではなく、実行のたびに別の spec が当たる型である。** これは `M22-02` 横断課題 12 の実測（5 回中 2 回・**別々の spec** が落ちた）と一致し、followup `e2e-shared-global-resource-parallel` の型そのものである。

**★本サブの変更とは無関係**——落ちた 2 本（確定反撃の紐付け ／ エクスポートの UI 表示）はいずれも本サブが触った 4 ファイルを通らない。**failed は 0 件であり、リトライを含めて全 133 テストが緑である。**

---

## 9. 品質チェック（§7.3）— 実測値

**基準は `M22-02` マージ時点の `1083332`。**

```bash
for p in migrations/ character_data/ docs/design/ internal/service/notation/ internal/service/preset/ \
         web/src/features/physical-input/ web/src/features/gamepad/ web/src/features/keyboard/ \
         internal/api/auth/ internal/service/auth/ internal/api/middleware/ \
         go.mod go.sum web/package.json web/pnpm-lock.yaml; do
  echo "$p → $(git diff --stat 1083332..HEAD -- "$p" | wc -l) 行"
done
```

| 対象 | 根拠 | 実測 |
|---|---|---|
| `migrations/` | §2.2-6・**マイグレ消費 0**（`D-394`） | **0 行** |
| `character_data/` | §2.2-6 | **0 行** |
| `docs/design/` | §1.6-7（製造は設計書本体を編集しない） | **0 行** |
| `internal/service/notation/` | 契約 F-5 | **0 行** |
| `internal/service/preset/` | 契約 F-5 | **0 行** |
| `web/src/features/physical-input/` | 契約 F-4 | **0 行**（ディレクトリ自体が存在しない） |
| `web/src/features/gamepad/` | 契約 F-4 | **0 行** |
| `web/src/features/keyboard/` | 契約 F-4 | **0 行** |
| `internal/api/auth/` | §2.2-5（`M22-01` の as-built） | **0 行** |
| `internal/service/auth/` | §2.2-5 | **0 行** |
| `internal/api/middleware/`（認証ミドルウェア） | §2.2-5 | **0 行** |
| `go.mod` / `go.sum` / `web/package.json` / `web/pnpm-lock.yaml` | §2.3（新規依存を追加しない） | **すべて 0 行** |

**`recipe_cache` の読み書き（契約 F-5・§4.5-1）:**

```bash
git diff 1083332..HEAD -- internal/repository/combo/repository.go internal/repository/setup/repository.go \
  | grep -E "^[+-]" | grep -i "recipe_cache"
# → 0 件
```

**⇒ `recipe_cache` に触れる差分は 0。** 本サブが `repository_test.go` へ追加した `TestRepository_UpdateRecipeCache_DoesNotBumpVersion` は**読み取り側のテストであり、実装には触れていない**。

**マイグレーションの消費**: **0 本。** `ls migrations/ | tail` の最新は `000077_m20_seed_aliases_p34_srk`（`M20-07` のもの）で変化なし。**⇒ ボード §2.2 の「次に払い出す番号」も動かない。**

**変更ファイルの全数（12 件）:**

```
docs/progress/m22-03-completion-report.md                    （新規・本ファイル）
internal/api/combo/handler.go                     |   4 +-   ← エラーコード 2 箇所
internal/api/setup/handler.go                     |   7 +-   ← 定数参照へ(返す文字列は不変)
internal/model/api_error.go                       |   8 +    ← 定数の新設
web/src/features/combo/components/ComboEditor.tsx |  21 +-   ← version:0 の是正
internal/api/combo/handler_test.go                |  81 +
internal/api/setup/handler_test.go                |  34 +
internal/api/preset/write_handler_test.go         |  25 +
internal/repository/combo/repository_test.go      | 123 +
web/e2e/m22-03-optimistic-locking.spec.ts         | 241 +    （新規）
web/src/features/combo/components/ComboEditor.test.tsx |  51 +
web/src/features/setup/errors.test.ts             |  25 +
```

**★本番コードの差分は 4 ファイル・実質 40 行未満である。残りはすべてテストである。** **これは欠陥ではなく、本サブが「固定する」サブであることの帰結である**（チェックリスト §0.3 N-9）。

**スクリプト検査:**

### 9.1 スクリプト検査の実出力

**★`check-artifact-integrity.sh` を 1 本目に回した**（他の検査が緑でも、その緑が信用できるとは限らない）。

```
$ bash scripts/check-artifact-integrity.sh
OK  design-desk-guard.sh の自己検査が通る
…
OK  check-md-emphasis.sh の自己検査が通る
OK  check-progress-log-index.sh の自己検査が通る
OK  check-stop-discipline.sh の自己検査が通る
  検査 11 件 / ALLOW 除外 1 件
## 2. 生成物の健全性
OK  docs/handover/code-facts.md / docs-map.md / retrospective-digest.md / custom-commands.md
結果: 違反なし
```

> **★1 回目は `check-md-emphasis.sh` の自己検査が NG だった。** 原因は**本サブの変更ではなく実行環境**——`markdown-it-py` が未導入で、スクリプトが「未実行」として非ゼロ終了していた（**★緑を返さない設計であり、正しく動いていた**）。`pip install markdown-it-py` を入れて再実行し、自己検査が「合格（陽性は赤・陰性は緑）」になることを確認した。
>
> **⇒ これは Python パッケージの導入であってアプリの依存追加ではない**（`go.mod` / `package.json` の diff は 0）。**検査スクリプト自身が必要とする実行環境の欠落であり、`e2e-requires-pnpm-install-on-clean-clone` と同型である。** 設計伝達レポートへ回す（§12.5）。

```
$ bash scripts/check-browser-storage-keys.sh
台帳 9 件 / 本番コード 8 件
OK  台帳と実装が一致(未記載キーの使用なし・状態のズレなし)
結果: 違反なし

$ bash scripts/check-enum-sync.sh
結果: ベースラインどおり(増加なし)

$ bash scripts/check-md-emphasis.sh
現在 436 行 / ベースライン 436 行
OK  ベースラインどおり(増加なし)
結果: 違反なし
```

> **★`check-md-emphasis.sh` は 1 回目にベースライン +4 行で赤だった。** 本完了報告に書いた 4 行が「閉じない強調」の形（`**…。**確定反撃系` のように閉じ `**` の直後に文字が続く形）だったため。**指摘どおり閉じ `**` の後ろに空白を入れて是正し、ベースラインへ戻した。**

**`bash scripts/check-progress-log-index.sh` は §11 に記載**（`progress-log.md` へ索引行を追記した直後に回す）。

---

## 10. ★`DES-002` §6.4 / §4.2 と as-built の差の全数（設計卓が `CHANGE-114` の反映で使う）

### 10.1 `DES-002` §4.2（`docs/design/02-architecture.md` の 127〜198 行）

**現行の記述**——`docs/design/02-architecture.md:169` に**注記だけがあり、規定が無い**:

> **★楽観排他の 409 については本節にまだ規定が無い**（`M22-RESEARCH-01` §9-B-5 が「照合対象が無い」と報告した箇所）。**`M22-03` / `M22-04` で書き足す。**

| # | 差 | as-built（**設計卓はこれを書けばよい**） |
|---|---|---|
| 1 | **版不一致時のステータスが書かれていない** | **`409 Conflict`**（3 経路とも） |
| 2 | **エラーコードが書かれていない** | **`version_conflict`**（**★資源によらず 1 つ**。`combos` 系も `setups` 系も同一） |
| 3 | **本文の形が書かれていない** | 既存のエラー形式に従う: `{"error":{"code":"version_conflict","message":"…"}}`。**`details` は付けない**（`omitempty` で省かれる） |
| 4 | **メッセージの逐語** | `combos` 系＝「このコンボは他の処理で更新されました。再取得してください」 ／ `setups` 系＝「セットプレイが他で更新されています。最新版を取得してから再実行してください」。**★コードは同一だが文面は資源ごとに異なる**（指示書 §9.2-2 が文面を自由としているため揃えていない） |
| 5 | **409 の先客との関係が書かれていない** | **409 は一意制約違反ほかでも返る**——**`version_conflict` を除いて 10 コードを実測した**（`alias_conflict` / `preset_name_duplicate` / `preset_limit_exceeded` / `preset_in_use_by_config` / `tag_name_duplicate` / `tag_in_use` / `duplicate_setup` / `combo_not_in_trash` / `rush_variant_exists` / `user_name_duplicate`。§1.5）。**⇒ ステータスだけでは版不一致を識別できない。識別子はエラーコードである** |
| 6 | **`PATCH /api/moves/:id` の記述との整合** | 137 行の「楽観ロックは設けない（MVP は last-write-wins、version 列なし）」は**現在も正しい**（`moves` に `version` 列は無い）。**⇒ 本 CHANGE で触る必要はない** |

### 10.2 `DES-002` §6.4（同 380 行）

**現行の記述**——方針の一文のみ:

> 書き込み処理はサービス層でトランザクション境界を設け、楽観的排他制御（更新時のバージョン番号チェック）を導入して上書き事故を防ぐ。

| # | 差 | as-built |
|---|---|---|
| 7 | **対象が書かれていない** | **`combos` と `setups` の 2 表のみ。** `version` 列を持つ表はこの 2 つだけである（`migrations/` の全 77 マイグレーション ／ 154 ファイルの実測） |
| 8 | **粒度が書かれていない** | **集約である。** コンボ本体・ステップ・起き攻め・**タグ**をまとめて `combos.version` 1 つで扱う。セットプレイ本体・そのステップは `setups.version` |
| 9 | **★「タグだけを変えても版が上がる」が書かれていない** | **上がる。** `repository.go:892-894` が `SET` 対象の有無にかかわらず `version = version + 1, updated_at = datetime('now')` を必ず付ける。**★これは副作用ではなく、集約を選んだことの帰結である**（`D-394`）。テストで固定済み（`TestRepository_UpdateMetadata_EmptySetStillBumpsVersion`） |
| 10 | **★「集約の外」が書かれていない**（**最も重要な追記**） | **対象外は 5 種**——成立条件（`combo_setup_results`）／ セットプレイ紐付け（`combo_setups`）／ 確定反撃系 4 表 ／ タグ・プリセット（`tags` / `presets`）／ `recipe_cache`。**理由を併記しないと、次の担当が「穴だ」と読んで塞ぐ**（塞ぐと検証記録を 1 行足すたびに本体編集と衝突する） |
| 11 | **★「サービス層でトランザクション境界を設け」の例外** | **`PUT /api/combos/:id` はリポジトリを経由せず、サービス層が SQL を直書きしている**（`service/combo/service.go:597-599`）。**トランザクション境界はサービス層にあるため §6.4 の記述と矛盾しないが、版の突き合わせが 3 経路のうち 1 つだけ層が違う**——設計書へ書くかは設計卓の判断 |
| 12 | **★`version` の増え方が 3 通りあることが書かれていない** | **(i) `+1`＝`PATCH /api/combos/:id` と `PATCH /api/setups/:id` の 2 本のみ** ／ **(ii) `1` で採番し直す＝`PUT /api/combos/:id`**（旧行を論理削除し新行を作るため `+1` の SQL を持たない）／ **(iii) 据え置き＝論理削除・復元・`recipe_cache`** |
| 12.5 | **★`PUT /api/combos/:id` に負けた側は 409 ではなく 404 を受け取る**（**契約の実装上の例外。★`M22-04` の前提に直結する**） | **`PUT` は旧行を論理削除して新 id で採番し直す**（`service/combo/service.go:597-599` → `:625`）。**⇒ 旧 id と旧 `version` を握っていた別の文脈がその後 `PATCH` を撃つと、`repository.go:909-920` の弁別が 「`deleted_at IS NULL` の行が 0 件」となり `ErrNotFound` すなわち 404 を返す。`version_conflict` は返らない。** **⇒ キー変更編集に負けた側には 409 の導線が出ない**——`M22-04` が「他の人が編集した」体験を作るときの前提である。**実装の変更は不要**（版の突き合わせとしては正しい挙動であり、旧行はもう存在しない） |
| 13 | **論理削除・復元で版が上がらないことが書かれていない** | **上がらない。現状どおりが正しい**（§1.6-5）。**削除は「編集」ではない。上げると削除のたびに他端末の編集が弾かれる** |

### 10.3 `DES-003` への追記（`CHANGE-114` §2-d / §2-e）

| # | 対象 | as-built |
|---|---|---|
| 14 | `combos.version` / `setups.version` の説明 | 上記 8〜13 のとおり |
| 15 | **`updated_at` と `version` の非同期** | **§6 に逐語で記載。★`combos` 側 3 本だけでなく `setups` 側 3 本も同型である**（指示書 §3.3-6 は「3 本」と書いていた） |

---

## 11. スクリプト検査（`progress-log.md` 追記後）

```
$ bash scripts/check-progress-log-index.sh
```

```
## 1. 各検査の対照
OK  .claude/commands/implement_plan_full.md に索引行の節がある
OK  .claude/commands/incorporate_plan.md に索引行の節がある

## 2. 完了報告 → progress-log の追記カバレッジ
OK  検査した 37 件すべてが progress-log に現れる(ALLOW 除外 10 件)

結果: 違反なし
```

---

## 11.9 ★並列相手との突合（`E-121`）

**★並列相手は居なかった。**

- 指示書メタ表: **「★直列本線。並列にしない」**（`m22-contract` §3.3）。
- `docs/process/parallel-board.md` §1.6: **「★M22 は単独直列である」**。
- 直前のサブ `M22-02` は 2026-08-16 に完了済み（`D-407`）であり、同時に走っていたレーンは無い。
- **⇒ 突合すべき相手が存在しないため、as-built の食い違いも発生していない。**

---

## 12. ■ 併せて更新が要るもの

### 12.1 ★`CHANGE-114` 通知書のステータス行（**設計卓の更新漏れ**）

**開発者は本セッションで「承認済み。設計卓の更新漏れのため完了報告で伝えて欲しいが、作業はブロックしない」と回答した。**

**⇒ `docs/change-notes/CHANGE-114-notification.md` の現状は実態と食い違っている:**

| 行 | 現状 | あるべき状態 |
|---|---|---|
| 承認者 | **「開発者（承認待ち）」** | 開発者（**2026-08-16 承認済み**） |
| ステータス | **「起票（未承認・未反映）」** | **承認済み ／ 未反映**（反映は本 as-built 確定後） |

**あわせて `docs/process/parallel-board.md:175` の `M22-03` 行の CHANGE 欄「114（★起票済・未反映）」も、承認済みを反映した表記へ。**

**★製造は `docs/change-notes/` も `docs/process/parallel-board.md` も編集しない。** 設計卓の手番として申し送る。

**★この食い違いは着手前ゲートの判定を止めかけた**（指示書メタ表は「承認済みであること」を着手前ゲートとしている）。**先行 2 サブ（`CHANGE-112` / `CHANGE-113`）は着手時点で通知書が「承認済み」に更新されていたため、本件だけが例外である。**

### 12.2 消費した番号の登録

- **CHANGE 番号: 新規起票なし。** 本サブは既存の `CHANGE-114` に紐づく。**⇒ `docs/handover/change-number-registry.md` §1 への新規登録は不要。** ただし `114` の行を **「起票済・未反映」→「承認済・未反映」** へ更新する必要がある（設計卓の手番）。
- **「次に採番する番号」＝ `115` は動かない**（本サブは番号を消費していない）。**⇒ registry §1 ／ 契約 §4 ／ ボード §2.1 ／ ボード §2.4 の 4 か所とも更新不要。**
- **マイグレ連番: 消費 0 本。** `ls migrations/` の最新は `000077`（`M20-07`）のまま。**⇒ ボード §2.2 の「次に払い出す番号」も動かない。**

### 12.3 版を上げた文書の参照元

**本サブは設計書・指示書・チェックリストのいずれの版も上げていない**（製造は編集しない）。**⇒ 版を写している箇所の追随は不要。**

### 12.4 followup の更新候補（**★設計伝達レポート §4 へ書く。製造は `followup-backlog.md` を編集しない**＝`D-382`）

| followup | 状態 | 根拠 |
|---|---|---|
| `conflict-error-code-inconsistency` | **★畳める** | `version_conflict` へ統一済み（§4）。ハンドラ層テストの固定強度の非対称も解消（`combos` / `setups` ともコード文字列まで固定） |
| `combo-editor-version-zero-fallback` | **★畳める** | `?? 0` を消し、型で不在を表せなくした（§5）。テストで固定済み |
| `des002-4-2-lacks-conflict-contract` | **★`CHANGE-114` の反映で畳める** | as-built を §10 に全数列挙した |
| `updated-at-version-desync-on-recipe-cache` | **★仕様として確定させる形で畳める** | as-built を §6 に記載。**★`combos` 側 3 本だけでなく `setups` 側 3 本も同型である**（指示書は「3 本」と書いていた）。テストで「直っていない」ことを固定済み |
| `e2e-requires-pnpm-install-on-clean-clone` | **未解消（本サブでも踏んだ）** | §1.7。`make e2e` は `config.toml` と Chromium は吸収するが `pnpm install` は吸収しない |

### 12.5 ★新たに設計卓へ回す事項（**製造が判断しなかったもの**）

| # | 事項 | なぜ製造が決めなかったか |
|---|---|---|
| 1 | **`DELETE /api/tags/:id` が `combo_tags` を `ON DELETE CASCADE` で消すため、「コンボに付いているタグ」が `combos.version` を上げずに変わる** | **§1.3 の線引きでは「対象外」に収まる**（ルート自身は `tags` にしか書かない）。**⇒ §9.3-4 の停止条件には当たらない。** ただし塞ぐ／塞がないの判断は「上げる経路を増やす」判断であり設計卓の手番である。**塞ぐ場合はタグ削除のたびに、そのタグが付いた全コンボの版が上がる。**`FR013` によりタグ削除は作成者のみが行えるため実害の窓は狭い（§2 の #36 注記） |
| 2 | **エラーコードの集中定義が「版不一致 1 種類だけ定数、残り 8 コードは生リテラル」という中途の状態にある** | **本サブが触る 3 箇所に限って定数化した**（§4.1）。全面的な定数化は本サブのスコープ外であり、無関係な差分を増やさないため見送った。**⇒ 次に同じ不整合が起きうる面はまだ残っている** |
| 3 | **指示書 §3.3-6 の「`recipe_cache` の 3 本」は `combos` 側のみだった**（実測 6 本） | 実測値を §6 に記載。**`DES-003` への明記は両表について書く必要がある** |
| 4 | **指示書 §4.2 / §7.5-2 の「33 経路（DB へ書くもの 28 件）」は `M22-RESEARCH-01` 時点の値**（HEAD は 38 / 30） | 開発者回答により HEAD の実測で判定した（§1.3・§2）。**`M22-04` 以降の指示書が同じ数字を写している場合は追随が要る** |
| 5 | **`PUT /api/combos/:id` の版の突き合わせだけ層が違う**（リポジトリではなくサービス層に SQL 直書き） | 挙動は正しく、本サブは「固定する」サブであるため触っていない。**`DES-002` §6.4 へ書くかは設計卓の判断**（§10.2 の #11） |
