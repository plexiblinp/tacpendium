# M22-RESEARCH-01 調査レポート: 協調基盤の実態調査（7 軸）

| 項目 | 内容 |
|------|------|
| 対応指示書 | `docs/instructions/M22-RESEARCH-01-collaboration-baseline.md` v1.0.0 |
| 実施日 | 2026-08-15 |
| 種別 | **read-only・judgement-free**（事実列挙のみ。方式の推奨・「安全である／ない」の評価を含まない） |
| 実施環境 | Claude Code on the web（クラウド実行コンテナ・Linux 6.18.5 / x86_64） |

---

## 結論サマリ（事実のみ）

- **軸 A**: `version` を受け取る更新経路は **3 件**（`PATCH /api/combos/:id` ／ `PUT /api/combos/:id` ／ `PATCH /api/setups/:id`）。**3 件とも DB の現在値と `WHERE ... AND version = ?` で突き合わせている**。受け取るだけの経路 0 件、突き合わせるが不一致を無視する経路 0 件。不一致時の応答は 409 だがエラーコードが **combos 系 `conflict` ／ setups 系 `version_conflict`** で異なる。
- **軸 B**: 非 GET のルートは **36 件**。うち `version` を受け取るのは上記 3 件のみ = **`version` を持たない非 GET ルートは 33 件**。`combo_setups` / `combo_setup_results` / `tags` / `presets` はいずれも **`version` 列を持たない**（`version` 列を持つ表は `combos` と `setups` の 2 表のみ）。
- **軸 C**: `users` 表は実在し、seed（`000007`）が `id=1, name='default'` を 1 行だけ投入する。**`internal/{api,service,repository}/user/` は `doc.go` のみの空パッケージ**で、`users` を読む・書くコード経路は **0 件**。利用者 ID は **`defaultUserID int64 = 1` として 3 か所にリテラル固定**されている。ログイン・セッション相当の仕組みは **0 件**。
- **軸 D**: `SecurityConfig` のフィールドは **`PasswordEnabled bool` の 1 個のみ**（`PasswordHash` はコメントでの予約）。`PasswordEnabled` を読む箇所は **7 件**（非テスト）あるが、**いずれも「値の運搬・表示」であり、認証判断に使う箇所は 0 件**。`config.toml.example` と `SUPP-001` §5.8 の例は **一致していない**（`[defaults]` セクション欠落を含む複数差分）。
- **軸 E**: 登録ミドルウェアは **3 本のみ**（`RequestID` → `Logger` → `CORS`、すべて `e.Use` の全体適用）。CORS は起動時固定の許可 Origin リストで完全一致判定。**CSRF に相当する実装は Go・TS 双方で 0 件**（`SameSite` / `Set-Cookie` / `document.cookie` も 0 件）。`server.mode` はミドルウェアの構成を変えず、`allowedOrigins` の中身と bind ホストだけを変える。設定変更系 API に他と違う保護は無い。
- **軸 F**: 設定画面は `web/src/pages/SettingsPage.tsx` + `web/src/features/config/SettingsSection*.tsx` の **6 セクション構成**。LAN IP 取得は `internal/infra/netutil`（`ListPrivateIPv4` / `SelectPrimaryLANIP` 等）に実在。起動時 stdout 案内は `printStartupNotice`（配布ビルド `WebEmbedded` 時のみ）。**QR は「依存が入っている」段階ではなく `qrcode.react@4.2.0` を用いた `QRCodeModal` が実装済みで設定画面に配線されている**（§8 参照）。
- **軸 G**: `go.mod` の direct 7 / indirect 15。`golang.org/x/crypto v0.46.0` は **indirect** で依存グラフに実在（要求元 3 モジュール）。同モジュールに **`bcrypt` / `scrypt` / `argon2` の 3 パッケージすべてが実在**。ライセンスは `GOMODCACHE` 配下の `LICENSE` 実体から確認（本文逐語を §7 に引用）。`/app_build_check` は **総合判定 WAIT**（`pnpm audit` で high=3 / moderate=4。`govulncheck` は未インストールで SKIP）。
- **取れなかったもの**: **軸 C-1 / C-2 / C-3（`users` / `tags.user_id` / `presets.user_id` の実データ）は実行環境に DB が存在せず取得できていない**（「行が無い」ではない）。詳細は §10。

---

## §0 メタ

### §0.1 読んだ commit と作業ツリーの状態

```bash
git rev-parse HEAD
# 8af2ca6afc3cc1e6a69e17c86c534b1b7ead7545

git log -1 --format='%H %ad %s' --date=iso
# 8af2ca6afc3cc1e6a69e17c86c534b1b7ead7545 2026-08-15 17:19:58 +0900 Merge pull request #57 from plexiblinp/claude/sf6-combo-app-m21-design-t80qmo

git branch --show-current
# claude/research-plan-m22-01-mmgeyw

git status --porcelain
# (出力なし = 作業ツリーはクリーン)
```

**本調査で読んだファイルはすべて上記 commit 時点のものである**（指示書 §0.5 の要求）。`M21-07` の作業中ファイルは本作業ツリーには存在しない（`git status --porcelain` が空）。

`git status --porcelain` は **調査開始時 ／ 軸 G の `go mod download` 前後 ／ 調査終了時（本レポートと `progress-log.md` の追記前）** の 3 時点で確認し、いずれも空であった。

### §0.2 DB のコピー元と時点

**DB のコピーは作成していない。コピー元となる DB ファイルが実行環境に存在しないため。**

```bash
find / -name "*.db" -not -path "*/node_modules/*" -not -path "/proc/*" -not -path "/sys/*" 2>/dev/null
# /usr/lib/x86_64-linux-gnu/avahi/service-types.db   ← OS 同梱。本アプリと無関係

ls -la ~/.local/share/combomgr/
# ls: cannot access '/root/.local/share/combomgr/': No such file or directory

ls -la config.toml
# ls: cannot access 'config.toml': No such file or directory

command -v sqlite3
# exit=1（sqlite3 CLI も不在）
```

- 実行環境はリポジトリのクリーンクローンのみを持つクラウドコンテナであり、開発 DB（`combomgr.db`）は `.gitignore`（`*.db` = 24 行目）で追跡外のため clone されない。
- **DB を作るにはマイグレーションの適用（＝ DB への書き込み）が要る**ため、指示書 §0.2 の禁止事項に触れる。実施していない。
- 影響範囲は **C-1 / C-2 / C-3 の 3 項目**。詳細と代替で取れた事実は §3 および §10 に記す。

### §0.3 本レポートの計数規約

- **「件数」はすべて HEAD = `8af2ca6` 時点の作業ツリーに対する実測値**である。
- 特記しない限り、Go の走査は `internal/` と `cmd/` を対象とし、`*_test.go` を除外する（テストを含めた場合はその旨を明記する）。
- フロントの走査は `web/src/`（必要に応じて `web/e2e/`）を対象とし、`node_modules` を除外する。`*.test.ts(x)` を除外した場合はその旨を明記する。
- **走査コマンドは各項目に併記する**（指示書 §5 の要求）。

---

## §1 軸 A — 楽観排他がどこまで効いているか

### A-1 `version` を受け取る更新経路の一覧（全数）

**走査**:

```bash
grep -rn 'json:"version"' internal/ --include=*.go        # → 10 件
grep -rn "Version" internal/ --include=*.go | grep -v "_test.go" | grep -iE "version\s+(int|\*int|int64)"
grep -rn "c.Bind(&" internal/api/ --include=*.go | grep -v "_test.go"   # → 25 件
for f in internal/api/*/routes.go; do grep -nE "\.(GET|POST|PUT|PATCH|DELETE)\(" "$f"; done
```

`json:"version"` の 10 件の内訳（**10 件 = リクエスト DTO 3 + 応答/モデル 7**）:

| # | 位置 | 種別 |
|---|------|------|
| 1 | `internal/api/combo/dto.go:133` `UpdateMetadataRequest.Version` | **リクエスト DTO** |
| 2 | `internal/api/combo/dto.go:167` `PutRequest.Version` | **リクエスト DTO** |
| 3 | `internal/api/setup/dto.go:66` `UpdateSetupRequest.Version` | **リクエスト DTO** |
| 4 | `internal/model/combo.go:147` `model.Combo.Version`（`db:"version"`） | モデル |
| 5 | `internal/model/setup.go:32` `model.Setup.Version`（`db:"version"`） | モデル |
| 6 | `internal/api/combo/dto.go:220` `ComboResponse.Version` | 応答 |
| 7 | `internal/api/combo/dto.go:183` `SetupSummary.Version` | 応答 |
| 8 | `internal/api/setup/dto.go:80` `SetupResponse.Version` | 応答 |
| 9 | `internal/api/setup/dto.go:105` `SetupCandidateSummary.Version` | 応答 |
| 10 | `internal/api/health/handler.go:16` `Version string` | 応答（**アプリ版数の文字列。楽観排他とは無関係**） |

**`version` を受け取る更新経路 = 3 件（全数）**:

| # | メソッド | パス | ハンドラ | リクエスト DTO |
|---|---|---|---|---|
| A-1-1 | PATCH | `/api/combos/:id` | `combo.Handler.UpdateMetadata`（`internal/api/combo/handler.go:313`） | `UpdateMetadataRequest`（`dto.go:132`） |
| A-1-2 | PUT | `/api/combos/:id` | `combo.Handler.UpdateWithKeyChange`（`internal/api/combo/handler.go:360`） | `PutRequest`（`dto.go:166`） |
| A-1-3 | PATCH | `/api/setups/:id` | `setup.Handler.UpdateSetup`（`internal/api/setup/handler.go:177`） | `UpdateSetupRequest`（`dto.go:62`） |

> **`code-facts` §7-2 の 3 件は、HEAD = `8af2ca6` 時点で全数である**（上記の 3 系統走査で 4 件目は出ない）。

### A-2 受け取った `version` の使われ方の仕分け

**(a) DB の現在値と突き合わせている = 3 件（A-1 の全件）／(b) 受け取るだけで使っていない = 0 件／(c) 使うが不一致でもエラーにしない = 0 件。**

| 経路 | 突合の実体 | 位置 |
|---|---|---|
| A-1-1 PATCH `/api/combos/:id` | `UPDATE combos SET %s WHERE id = ? AND version = ? AND deleted_at IS NULL` → `RowsAffected() == 0` なら `SELECT COUNT(*) FROM combos WHERE id = ? AND deleted_at IS NULL` で `ErrNotFound` / `ErrConflict` を弁別 | `internal/repository/combo/repository.go:832`（`UpdateMetadata`）・`:890` の SQL・`:900-914` の弁別 |
| A-1-2 PUT `/api/combos/:id` | **リポジトリではなくサービス層が直接 1 文で行う**。`UPDATE combos SET deleted_at = datetime('now'), updated_at = datetime('now') WHERE id = ? AND version = ? AND deleted_at IS NULL`（旧行の論理削除と版確認を兼ねる）→ `rows == 0` なら `SELECT COUNT(*)` で `ErrNotFound` / `ErrConflict` を弁別 | `internal/service/combo/service.go:518`（`UpdateWithKeyChange`）・`:557-582` |
| A-1-3 PATCH `/api/setups/:id` | `UPDATE setups SET name = ?, description = ?, step_count = ?, version = version + 1, updated_at = datetime('now') WHERE id = ? AND version = ? AND deleted_at IS NULL` → `rows == 0` なら `SELECT COUNT(*) FROM setups WHERE id = ? AND deleted_at IS NULL` で弁別 | `internal/repository/setup/repository.go:388`（`UpdateSetup`）・`:391-414` |

**呼び出しの受け渡し（受け取った値が突合まで届いていることの確認）**:

- A-1-1: `handler.go:324` `h.service.UpdateMetadata(ctx, id, req.Version, ...)` → `service.go:461` `s.repo.UpdateMetadata(ctx, tx, id, version, input)` → `repository.go:888` `args = append(args, id, version)`
- A-1-2: `handler.go:371` `h.service.UpdateWithKeyChange(ctx, id, req.Version, ...)` → `service.go:560` の SQL 引数 `oldID, version`
- A-1-3: `handler.go:188` `h.service.UpdateSetup(ctx, id, toServiceUpdateInput(req))`（`dto.go:151` `Version: req.Version` で service 入力へ写す）→ `service.go:406` `s.repo.UpdateSetup(ctx, tx, setupID, input.Version, ...)`

### A-3 不一致時に返るもの

| 経路 | HTTP | エラーコード | 本文の形 | 位置 |
|---|---|---|---|---|
| A-1-1 PATCH `/api/combos/:id` | **409** | **`conflict`** | `model.NewAPIError("conflict", "このコンボは他の処理で更新されました。再取得してください")` = `{"error":{"code":...,"message":...}}` | `internal/api/combo/handler.go:329-330` |
| A-1-2 PUT `/api/combos/:id` | **409** | **`conflict`** | 同上（同一文言） | `internal/api/combo/handler.go:376-377` |
| A-1-3 PATCH `/api/setups/:id` | **409** | **`version_conflict`** | `model.APIErrorResponse{Error: model.APIError{Code: "version_conflict", Message: "セットプレイが他で更新されています。最新版を取得してから再実行してください"}}` | `internal/api/setup/handler.go:193-201` |

**★事実**: 同じ楽観排他衝突に対して、**combos 系は `conflict`、setups 系は `version_conflict`** と別のコードを返す。

**`DES-002` §4.2 との突合**:

**走査**（§4.2 は `docs/design/02-architecture.md` の 127〜198 行）:

```bash
awk 'NR>=127 && NR<=198 {if ($0 ~ /楽観/ || $0 ~ /version/) print NR}' docs/design/02-architecture.md
# → 137, 146 の 2 行のみ
awk 'NR>=127 && NR<=198 {if ($0 ~ /409/) print NR}' docs/design/02-architecture.md
# → 138, 169, 170, 171, 172 の 5 行
```

- **§4.2 に、`version` 不一致時の HTTP ステータス・エラーコード・本文の規定は存在しない**（走査範囲＝§4.2 の 127〜198 行、パターン `楽観|version|409`）。
  - 137 行 = `PATCH /api/moves/:id` の「**楽観ロックは設けない（MVP は last-write-wins、version 列なし）**（CHANGE-032・CHANGE-054）」。
  - 146 行 = `PATCH /api/combos/{id}` の nullable クリア規約の説明中にある「部分 PATCH（昇格 `{version, isDraft}` 等）」という**用例の言及**であり、衝突時の応答規定ではない。
  - 409 の 5 行はいずれも別事象（138 = `rush-variant` の重複生成、169〜172 = プリセットの上限超過 / 名前重複 / 表記衝突 / `config` 参照中）。
- 楽観排他の規定は **§4.2 ではなく §6.4**（366〜370 行）にあり、内容は方針の一文のみ:
  > 「書き込み処理はサービス層でトランザクション境界を設け、楽観的排他制御（更新時のバージョン番号チェック）を導入して上書き事故を防ぐ。」
  - **ステータス・コード・粒度の規定は含まない。**
- ⇒ **実装の 409 / `conflict` / `version_conflict` を照合できる規定が `DES-002` §4.2 に無い**ため、「一致するか」は判定できない（§9 に矛盾候補として再掲）。

### A-4 `version` が増える契機

**走査**:

```bash
grep -rn "version = version + 1" internal/ --include=*.go | grep -v _test   # → 2 件
grep -rn "UPDATE combos" internal/ --include=*.go | grep -v "_test.go"      # → 7 件
grep -rn "UPDATE setups" internal/ --include=*.go | grep -v "_test.go"      # → 5 件
```

**`version` を `+1` する SQL は 2 本だけである**:

| # | 位置 | 対象 | 契機 |
|---|---|---|---|
| 1 | `internal/repository/combo/repository.go:887` | `combos` | `UpdateMetadata`（= `PATCH /api/combos/:id`）。**`SET` フィールドが 1 つも無い場合でも `version` と `updated_at` は常時更新する**（`:886` のコメントが明記） |
| 2 | `internal/repository/setup/repository.go:393` | `setups` | `UpdateSetup`（= `PATCH /api/setups/:id`） |

**`combos` への UPDATE 全 7 本のうち、`version` を増やさない 6 本**:

| 位置 | 用途 | `version` |
|---|---|---|
| `repository.go:890` | `UpdateMetadata` | **+1** |
| `repository.go:925` | `SoftDelete`（`DELETE /api/combos/:id`） | 変えない |
| `repository.go:942` | `Restore`（`POST /api/combos/:id/restore`） | 変えない |
| `repository.go:1335` / `:1345` / `:1355` | `recipe_cache` の更新・クリア | 変えない。`repository.go:205` に「**`updated_at` も更新するが `version` はインクリメントしない（キャッシュは排他対象外）**」と明記 |
| `service.go:559` | `UpdateWithKeyChange` の旧行論理削除 | 変えない（旧行はそのまま論理削除される） |

**`setups` への UPDATE 全 5 本**: `:391`（`UpdateSetup`）のみ **+1**。`:369`（論理削除）・`:453` / `:463` / `:473`（`recipe_cache`）は変えない。

**新規行の初期値 `version = 1`**:

| 位置 | 対象 |
|---|---|
| `internal/service/combo/service.go:226` | `Create`（`POST /api/combos`） |
| `internal/service/combo/service.go:586` | `UpdateWithKeyChange` が作る**新コンボ**（旧行は論理削除され、新行は `version = 1` から始まる） |
| `internal/service/combo/service.go:938` | `Materialize`（`POST /api/combos/:id/materialize`）が生成するコンボ |
| `internal/service/setup/service.go:170` / `:234` | セットプレイ新規作成（バンドル生成を含む） |

**本体だけか、ステップ・タグ・起き攻めの変更でも増えるか**:

| 変更対象 | `combos.version` が増えるか | 根拠 |
|---|---|---|
| コンボのメタデータ | **増える** | `PATCH /api/combos/:id` の `UPDATE` に含まれる |
| **タグ（`combo_tags`）** | **増える**（`PATCH /api/combos/:id` 経由の場合） | `service.go:463-471` の `ReplaceTagAssociations` は `repo.UpdateMetadata`（`:461`）と**同一トランザクション内**で走る。`tagIds` だけを送る PATCH でも `:887` により `version` は +1 される |
| **起き攻めオプション（`combo_oki_options`）** | **増える**（同上） | `repository.go:881-883` のコメント（「`combos` の `UPDATE` では扱わず、サービス層が `ReplaceOkiOptions` で子行を差し替える」）＋ 同一 tx |
| **コンボのステップ（`combo_steps`）** | 単独で変える経路が無い | レシピ本体の変更は `PUT /api/combos/:id`（新規行 + 旧行論理削除）に限られる（`DES-002` §4.2 / `combo/routes.go:24-25`） |
| **セットプレイのステップ（`setup_steps`）** | **`setups.version` が増える** | `service/setup/service.go:406` の `UpdateSetup` 後に、同一 tx で `DeleteStepsBySetupID` → 再挿入（`:415-425`） |
| **セットプレイの紐付け（`combo_setups`）** | **増えない** | B-4 参照 |
| **成立条件（`combo_setup_results`）** | **増えない** | B-4 参照 |
| **確定反撃系（`combo_punishes` ほか）** | **増えない** | B-4 参照 |

### A-5 既存テストが楽観排他を固定しているか

**走査**:

```bash
grep -rln "ErrConflict\|StatusConflict\|version_conflict" --include=*_test.go internal/ cmd/
grep -rn "^func Test" --include=*_test.go internal/ | grep -iE "conflict|version|optimist"
grep -n "StatusConflict\|409\|ErrConflict" internal/api/combo/*_test.go
```

> **★関数名だけの走査では取りこぼす。** `internal/api/combo/handler_test.go` の 2 件は関数名に `Conflict` / `Version` を含まないため、`^func Test` + 名前パターンの走査では出てこない。本項は `StatusConflict` / `ErrConflict` の**本文走査**を併用して確定した。

| # | テスト | 主張していること |
|---|---|---|
| 1 | `internal/repository/combo/repository_test.go:494` `TestRepository_UpdateMetadata_VersionConflict` | 実 DB に `version=1` の行を作り、`version=99` で `UpdateMetadata` を呼ぶと `comborepo.ErrConflict` が返る |
| 2 | `internal/service/combo/service_test.go:647` `TestService_UpdateMetadata_VersionConflict` | `Create` した直後のコンボに `version=999` で `UpdateMetadata` すると `combosvc.ErrConflict` が返る |
| 3 | `internal/service/combo/service_test.go:865` `TestService_UpdateWithKeyChange_VersionConflict` | `UpdateWithKeyChange` の版不一致で `ErrConflict` が返る |
| 4 | `internal/service/combo/service_test.go:1115` `TestService_UpdateMetadata_VersionConflict_TagIDs_NoChange` | 版不一致で失敗したとき `tagIds` の関連付けが変わっていない |
| 5 | `internal/service/setup/service_test.go:428` `TestService_UpdateSetup_VersionConflict` | `UpdateSetup` の版不一致で `ErrConflict` が返る |
| 6 | `internal/api/setup/handler_test.go:429` `TestHandler_UpdateSetup_409_VersionConflict` | サービスが `ErrConflict` を返したとき **HTTP 409** かつ **`Error.Code == "version_conflict"`** |
| 7 | `internal/api/combo/handler_test.go:770` `TestHandler_UpdateMetadata_409` | サービスが `ErrConflict` を返したとき **HTTP 409**。**`Error.Code` は検証していない** |
| 8 | `internal/api/combo/handler_test.go:876` `TestHandler_UpdateWithKeyChange_409` | 同上。**`Error.Code` は検証していない** |

**★事実**: setups 系（#6）はエラーコード `version_conflict` を固定しているが、combos 系（#7 / #8）は**ステータス 409 のみを固定し、`conflict` というコード文字列は固定していない**。

**「`version` が実際に +1 されたこと」を主張するテストは、上記の走査では 0 件**（走査範囲＝`internal/` と `cmd/` の全 `*_test.go` に対する `ErrConflict` / `StatusConflict` / `version_conflict` の本文走査、および関数名の `conflict|version|optimist` 走査）。

### A-6 フロント側が `version` をどこから取り、どう送っているか

**走査**:

```bash
grep -rn "version" web/src/ --include=*.ts --include=*.tsx | grep -viE "\.test\.|appVersion|schemaVersion"
grep -rn "queryKey" web/src/features/combo/ web/src/features/setup/ --include=*.ts --include=*.tsx | grep -v "\.test\."
```

**型定義（3 分岐と Setup 側）**:

| 型 | 位置 | `version` |
|---|---|---|
| `ComboSummary` | `web/src/features/combo/types.ts:48`（`version: number` は `:73`） | あり |
| `ComboDetail extends ComboSummary` | `:81` | 継承であり |
| `Combo` | `:117`（`version: number` は `:141`） | あり |
| `UpdateMetadataRequest` | `:189`（`version: number` は `:190`） | あり |
| `PutComboRequest extends CreateComboRequest` | `:210`（`:211`） | あり |
| `Setup` | `web/src/features/setup/types.ts:6`（`:12`） | あり |
| `UpdateSetupInput` | `:80`（`:84`） | あり |

**取得元（queryKey）**:

| queryKey | 定義位置 | 供給する型 |
|---|---|---|
| `["combos", filter]` | `web/src/features/combo/api.ts:70` | `ComboSummary[]`（一覧） |
| `["combo", numId]` | `web/src/features/combo/api.ts:82` | コンボ詳細（`version` を含む） |
| `["combos", "trash", characterId]` | `web/src/features/combo/hooks/useTrashCombos.ts:7` | ゴミ箱一覧 |
| `["combo", id]`（比較） | `web/src/features/combo/hooks/useCompareCombos.ts:8` | 比較用詳細 |
| `["setupCandidates", comboId]` ほか | `web/src/features/setup/hooks/useSetupCandidates.ts:7` / `useSetupCandidatesByKnockdown.ts:12` | `SetupCandidateSummary`（`version` を含む） |

**送信元（`version` を載せる箇所の全数）**:

| # | 位置 | 送る値 | 送り先 |
|---|---|---|---|
| 1 | `web/src/features/combo/components/ComboEditor.tsx:237` `buildPatchPayload` | **`initial?.version ?? 0`** | `PATCH /api/combos/:id` |
| 2 | `web/src/features/combo/components/ComboEditor.tsx:418` `runPut` | `initial.version`（`:413` で `if (!initial) return;`） | `PUT /api/combos/:id` |
| 3 | `web/src/features/combo/components/PromoteToFinalButton.tsx:49` | `combo.version`（`{ version, isDraft: false }` の部分 PATCH） | `PATCH /api/combos/:id` |
| 4 | `web/src/features/mycombo/hooks/useUpdateMyComboStatus.ts:49` | `combo.version`（`combo` は `ComboSummary` = 一覧クエリ `["combos", filter]` 由来） | `PATCH /api/combos/:id`（`:22-23`） |
| 5 | `web/src/pages/SetupEditorPage.tsx:110` | `setupQ.data.version` | `PATCH /api/setups/:id` |

> **★事実（#1）**: `buildPatchPayload` の `initial?.version ?? 0` は、`initial` が `undefined` のとき **`version: 0`** を送る。`combos.version` は `INTEGER NOT NULL DEFAULT 1`（`migrations/000001_init_schema.up.sql:87`）であり、`version = 0` の行は生成経路が無い（A-4 の初期値はすべて 1）。

**成功後の無効化（`invalidateQueries` / `removeQueries` の全数・combos と setups 系）**:

| 位置 | 契機 | 対象 queryKey |
|---|---|---|
| `web/src/features/combo/api.ts:118` | 作成 | `["combos"]` |
| `web/src/features/combo/api.ts:175-178` | （削除系） | `["combos"]` ／ 条件付きで `["setups"]` `["setupCandidates"]` |
| `web/src/features/combo/api.ts:193-194` | `useUpdateComboMetadata`（PATCH）成功 | `["combos"]` ／ `["combo", id]` を invalidate |
| `web/src/features/combo/api.ts:208-210` | `useUpdateComboWithKeyChange`（PUT）成功 | `["combos"]` を invalidate ／ **`["combo", id]` を `removeQueries`** ／ 新 id へ `setQueryData` |
| `web/src/features/mycombo/hooks/useUpdateMyComboStatus.ts:26-28` | マイコンボ状態変更成功 | `["combos"]` ／ `["combo", comboId]` ／ `["tags", {...}]` |
| `web/src/features/setup/hooks/useSetupResults.ts:25` | 成立条件の更新 | `["combo", comboId]` |
| `web/src/features/setup/hooks/useSetupLinks.ts:16-18` | 紐付け変更 | `["combo", comboId]` ／ `["setup", { id: setupId }]` ／ `["setupCandidates", comboId]` |
| `web/src/features/setup/hooks/useCreateSetup.ts:18` | セットプレイ作成 | `["combo", comboId]` |
| `web/src/features/combo/hooks/usePermanentDelete.ts:17` / `useRestoreCombo.ts:17` | 物理削除 / 復元 | `["combos"]` |

> **★事実**: `PATCH /api/setups/:id` の成功後に `["setup", ...]` / `["setups"]` を無効化する箇所は、上記走査では現れない（`SetupEditorPage.tsx` の更新経路。走査範囲＝`web/src/features/setup/` と `web/src/pages/SetupEditorPage.tsx` の `queryKey` 全出現）。

---

## §2 軸 B — `version` を持たない更新経路の全数

### B-1 `internal/api/` 配下の書き込みハンドラの一覧

**走査**:

```bash
for f in internal/api/*/routes.go; do echo "--- $f ---"; grep -nE "\.(GET|POST|PUT|PATCH|DELETE)\(" "$f"; done
grep -rn "\.Use(\|e.GET(" cmd/combomgr/main.go
grep -rhoiE "(INSERT( OR IGNORE| OR REPLACE)? INTO|UPDATE|DELETE FROM)[[:space:]]+[a-z_]+" internal/ --include=*.go | sort | uniq -c
```

**基準**: `routes.go` に登録されたルートのうち **HTTP メソッドが GET 以外のもの**を「非 GET ルート」として数え、そのうち **DB に書くもの**を別途区別する。`e.GET("/api/health", ...)`（`main.go:250`）と静的配信（`WebEmbedded` 時のみ）は GET のため対象外。`internal/api/debug/` は **`-tags=debug` ビルドでのみ登録**され、本番ビルドでは `routes_noop.go:18` により no-op（かつ 2 本とも GET）。

**非 GET ルート = 36 件**（内訳）:

| ドメイン | メソッド・パス | 対象テーブル | DB 書込 | `version` 受領 |
|---|---|---|---|---|
| combo | POST `/api/combos` | `combos` / `combo_steps` / `combo_tags` / `combo_oki_options` | ○ | ✕ |
| combo | POST `/api/combos/check-duplicate` | — | **✕（読み取りのみ）** | ✕ |
| combo | **PATCH `/api/combos/:id`** | `combos` / `combo_tags` / `combo_oki_options` | ○ | **○** |
| combo | **PUT `/api/combos/:id`** | `combos`（新行 + 旧行論理削除） / `combo_steps` / `combo_setups` ほか | ○ | **○** |
| combo | DELETE `/api/combos/:id` | `combos`（論理削除） | ○ | ✕ |
| combo | POST `/api/combos/:id/restore` | `combos`（`deleted_at = NULL`） | ○ | ✕ |
| combo | DELETE `/api/combos/:id/permanent` | `combos`（物理削除） | ○ | ✕ |
| combo | POST `/api/combos/:id/materialize` | `combos`（新行） / `combo_punishes` | ○ | ✕ |
| comboio | POST `/api/import/csv/preview` | — | **✕（`ParsePreview` に `INSERT`/`UPDATE`/`DELETE`/`BeginTx` は 0 件）** | ✕ |
| comboio | POST `/api/import/csv` | `combos` ほか（`Commit`） | ○ | ✕ |
| config | PUT `/api/config` | **DB ではなく `config.toml`** | △ | ✕ |
| move | PATCH `/api/moves/:id` | `moves` | ○ | ✕ |
| move | POST `/api/moves/:id/rush-variant` | `moves` / `move_derivations` | ○ | ✕ |
| preset | POST `/api/presets` | `presets` / `preset_aliases` | ○ | ✕ |
| preset | PUT `/api/presets/:id` | `presets` / `preset_aliases` | ○ | ✕ |
| preset | DELETE `/api/presets/:id` | `presets` / `preset_aliases` | ○ | ✕ |
| punish | POST / DELETE `/api/combo-punish-starters` | `combo_punish_starters` | ○ | ✕ |
| punish | POST / DELETE `/api/combo-punishes` | `combo_punishes` | ○ | ✕ |
| punish | POST / DELETE `/api/combo-punish-prunings` | `combo_punish_prunings` | ○ | ✕ |
| punish | POST / DELETE `/api/combo-punish-curations` | `combo_punish_curations` | ○ | ✕ |
| setplay | （非 GET なし） | — | — | — |
| setup | POST `/api/combos/:comboId/setups` | `setups` / `setup_steps` / `combo_setups` / `combo_setup_results` | ○ | ✕ |
| setup | POST `/api/combos/:comboId/setup-links` | `combo_setups` | ○ | ✕ |
| setup | DELETE `/api/combos/:comboId/setup-links/:setupId` | `combo_setups` | ○ | ✕ |
| setup | **PATCH `/api/setups/:id`** | `setups` / `setup_steps` | ○ | **○** |
| setup | DELETE `/api/setups/:id` | `setups`（論理削除） | ○ | ✕ |
| setup | PUT `/api/combos/:comboId/setups/:setupId/results` | `combo_setup_results` | ○ | ✕ |
| setup | DELETE `/api/combos/:comboId/setups/:setupId/results` | `combo_setup_results` | ○ | ✕ |
| tag | POST `/api/tags` | `tags` | ○ | ✕ |
| tag | PATCH `/api/tags/:id` | `tags` | ○ | ✕ |
| tag | DELETE `/api/tags/:id` | `tags` | ○ | ✕ |
| intake | POST `/api/intake/resolve` | — | **✕（読み取りのみ）** | ✕ |
| intake | POST `/api/intake/csv` | — | **✕（読み取りのみ）** | ✕ |

**数え方**（punish の 8 件は POST / DELETE を別ルートとして 1 件ずつ数える）:

- 非 GET ルート **36 件**
- そのうち **DB に書かないもの 4 件**（`POST /api/combos/check-duplicate` ／ `POST /api/import/csv/preview` ／ `POST /api/intake/resolve` ／ `POST /api/intake/csv`）
- そのうち **DB ではなく `config.toml` に書くもの 1 件**（`PUT /api/config`）
- **⇒ DB へ書き込む非 GET ルート = 31 件**

### B-2 `version` を受け取らない非 GET ルートの全数

**36 − 3 = 33 件**（A-1 の 3 件以外すべて）。DB へ書き込むものに限れば **31 − 3 = 28 件**。

各々の書き込み対象は B-1 の表の「対象テーブル」列のとおり。

### B-3 `UpsertSetupResultRequest` / `CreateSetupLinkRequest` の対象テーブルに `version` 列があるか

**走査**:

```bash
grep -rn "version" migrations/*.sql | grep -viE "^\S+:-{2}"      # DDL 側の version 列の全数
grep -rn -A 14 "CREATE TABLE combo_setups\|CREATE TABLE combo_setup_results" migrations/*.sql
grep -nE "^type [A-Za-z]+ struct|Version" internal/api/setup/dto.go
```

| リクエスト DTO | 位置 | `Version` フィールド | 対象テーブル | 対象テーブルの `version` 列 |
|---|---|---|---|---|
| `UpsertSetupResultRequest` | `internal/api/setup/dto.go:38` | **無し** | `combo_setup_results` | **無し** |
| `CreateSetupLinkRequest` | `internal/api/setup/dto.go:57` | **無し** | `combo_setups` | **無し** |

DDL 実体:

```sql
-- migrations/000001_init_schema.up.sql:193
CREATE TABLE combo_setups (
    combo_id INTEGER NOT NULL REFERENCES combos(id) ON DELETE CASCADE,
    setup_id INTEGER NOT NULL REFERENCES setups(id) ON DELETE CASCADE,
    PRIMARY KEY (combo_id, setup_id)
);

-- migrations/000042_create_combo_setup_results.up.sql:23
CREATE TABLE combo_setup_results (
    combo_id   INTEGER NOT NULL,
    setup_id   INTEGER NOT NULL,
    tech_type  TEXT    NOT NULL,
    in_corner  BOOLEAN NOT NULL,
    result     TEXT    NOT NULL,
    note       TEXT,
    PRIMARY KEY (combo_id, setup_id, tech_type, in_corner),
    FOREIGN KEY (combo_id, setup_id) REFERENCES combo_setups(combo_id, setup_id)
        ON UPDATE CASCADE ON DELETE CASCADE
);
```

**`version` 列を持つ表は `combos` と `setups` の 2 表のみ**（`migrations/` 全 78 ファイル走査。DDL としての `version` 出現は `000001`（`combos` = 87 行 ／ `setups` = 172 行）と、`combos` を再構築する `000016` / `000019` の `up`/`down` 内の同列のみ）。

### B-4 「コンボの一部を変えるが `combos` 行そのものは触らない」経路

**該当する = 全 13 件**（すべて `combos.version` を増やさない）:

| # | ルート | 書き込み対象 | `combos` を触るか |
|---|---|---|---|
| 1 | PUT `/api/combos/:comboId/setups/:setupId/results` | `combo_setup_results`（`ON CONFLICT ... DO UPDATE`。`repository/setup/setup_results.go:57-61`） | 触らない |
| 2 | DELETE `/api/combos/:comboId/setups/:setupId/results` | `combo_setup_results`（物理削除。同 `:76-78`） | 触らない |
| 3 | POST `/api/combos/:comboId/setup-links` | `combo_setups`（`InsertComboSetup`。`service/setup/service.go:309`） | 触らない（`:291` で `ComboExists` を**読むだけ**） |
| 4 | DELETE `/api/combos/:comboId/setup-links/:setupId` | `combo_setups`（`DeleteComboSetup`。同 `:333`） | 触らない |
| 5 | POST `/api/combo-punish-starters` | `combo_punish_starters` | 触らない |
| 6 | DELETE `/api/combo-punish-starters` | 同上 | 触らない |
| 7 | POST `/api/combo-punishes` | `combo_punishes` | 触らない |
| 8 | DELETE `/api/combo-punishes` | 同上 | 触らない |
| 9 | POST `/api/combo-punish-prunings` | `combo_punish_prunings` | 触らない |
| 10 | DELETE `/api/combo-punish-prunings` | 同上 | 触らない |
| 11 | POST `/api/combo-punish-curations` | `combo_punish_curations` | 触らない |
| 12 | DELETE `/api/combo-punish-curations` | 同上 | 触らない |
| 13 | POST `/api/combos/:comboId/setups` | `setups` / `setup_steps` / `combo_setups` / `combo_setup_results`（新規セットプレイの作成 + 当該コンボへの紐付け） | 触らない |

**参考（`combos` を触るが `version` を増やさない経路）**: `recipe_cache` の更新（`repository/combo/repository.go:1335` / `:1345` / `:1355`）。`RecomputePresetCache` / `DeletePresetCache` 経由で走る。

### B-5 タグ・プリセットの更新経路が `version` を持つか

| ルート | リクエスト DTO | `version` |
|---|---|---|
| POST `/api/tags` | `model.CreateTagInput`（`internal/api/tag/handler.go:87`） | **無し** |
| PATCH `/api/tags/:id` | `model.UpdateTagInput`（同 `:118`） | **無し** |
| DELETE `/api/tags/:id` | （ボディ無し。`force` はクエリ） | **無し** |
| POST `/api/presets` | `CreatePresetRequest`（`internal/api/preset/handler.go:118`） | **無し** |
| PUT `/api/presets/:id` | `UpdatePresetRequest`（同 `:138`） | **無し** |
| DELETE `/api/presets/:id` | （ボディ無し） | **無し** |

**DDL**（`migrations/000001_init_schema.up.sql:108` / `:131`）:

```sql
CREATE TABLE tags (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name      TEXT    NOT NULL,
    category  TEXT,
    color     TEXT,
    UNIQUE (user_id, name)
);

CREATE TABLE presets (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id           INTEGER REFERENCES users(id) ON DELETE CASCADE,  -- NULL は組み込み
    code              TEXT    NOT NULL UNIQUE,
    name              TEXT    NOT NULL,
    base_preset_code  TEXT,
    is_builtin        INTEGER NOT NULL DEFAULT 0
);
```

**`tags` / `presets` とも `version` 列は無い。**

---

## §3 軸 C — `users` 表の実データと使われ方

### C-1 `users` の行数と中身

**取得できていない。** 実行環境に DB ファイルが存在せず（§0.2）、DB を作るにはマイグレーション適用（＝書き込み）が要るため。**「行が無い」ではない**（§10-1）。

**代替として取れた事実（コードとマイグレーションからの静的事実）**:

- DDL（`migrations/000001_init_schema.up.sql:154`）:

```sql
CREATE TABLE users (
    id                 INTEGER PRIMARY KEY AUTOINCREMENT,
    name               TEXT    NOT NULL UNIQUE,
    password_hash      TEXT,                                -- NULL 可(認証不要ユーザー)
    main_character_id  INTEGER REFERENCES characters(id),
    created_at         DATETIME NOT NULL DEFAULT (datetime('now'))
);
```

- **`users` へ行を入れるマイグレーションは 1 本のみ**（走査 `grep -rn -i "insert into users\|INTO users" migrations/`）:

```sql
-- migrations/000007_seed_initial_tags_user1.up.sql:8
INSERT OR IGNORE INTO users (id, name) VALUES (1, 'default');
```

同ファイルのヘッダコメント（`:1-6`）:
> 「(1) デフォルトユーザー(id=1, name='default')が未存在の場合のみ生成する。**本来は M6 初回起動ウィザードで生成(SUPP-001 §2.5)。M3 期間は未実装のため seed で凌ぐ。**」／「M6 着手時にウィザード経由生成へ切り替える。」

- **`password_hash` に値を入れるコードは 0 件**（走査 `grep -rn "PasswordHash\|password_hash" internal/ cmd/ migrations/ --include=*.go --include=*.sql` → 6 件。うち書き込みは 0 件。内訳は `model/user.go:7,10,14`（定義とコメント）／`config/config.go:82`（コメント）／`api/config/dto.go:3`（コメント）／`migrations/000001_init_schema.up.sql:157`（DDL））。
- **`password_hash` の値そのものは本レポートに記載していない**（値を取得していないため。指示書 §6 条件 6）。

### C-2 `tags.user_id` の実値の分布

**取得できていない**（§10-1）。静的事実として、`migrations/000007_seed_initial_tags_user1.up.sql:10-13` が `user_id = 1` で 3 行（`使用中` / `練習中` / `頻度低下`、`category = 'mycombo_status'`）を投入する。

### C-3 `presets.user_id` の実値の分布（NULL を含む）

**取得できていない**（§10-1）。静的事実として:

- `migrations/000005_seed_presets.up.sql:4` のコメント: 「全て `is_builtin=1`、`user_id=NULL`(組み込みプリセット)」。
- `migrations/000069_m20_initial_presets_three.up.sql:34` のコメント（M20-03 期の実測値の記録）: 「`presets` = 5 行 / `user_id` 非 NULL(カスタム)= 0 行 / 検査した全行数 5。」
- ⇒ **上記はマイグレーション内のコメントに記録された過去の実測値であり、本調査で測った値ではない。**

### C-4 `users` を読む・書くコード経路の全数

**走査**:

```bash
ls -la internal/api/user/ internal/service/user/ internal/repository/user/
grep -rniE "user_?id|userID|UserID|defaultUser" internal/ cmd/ --include=*.go | grep -v "_test.go"
grep -rn "FROM users\|INTO users\|UPDATE users\|DELETE FROM users" internal/ cmd/ --include=*.go
```

**`users` 表に対する SELECT / INSERT / UPDATE / DELETE を発行するコードは 0 件**（走査範囲＝`internal/` と `cmd/` の全 `*.go`、テストを含む）。

| レイヤ | パッケージ | 中身 |
|---|---|---|
| handler | `internal/api/user/` | **`doc.go` の 1 ファイルのみ**（105 バイト）。中身は `// Package user はユーザー管理の HTTP ハンドラを提供する。M6 で実装。` + `package user` |
| service | `internal/service/user/` | **`doc.go` の 1 ファイルのみ**（156 バイト）。`// ... フェーズ2(M6 以降)で実装。` |
| repository | `internal/repository/user/` | **`doc.go` の 1 ファイルのみ**（104 バイト）。`// ... M6 で実装。` |

- `internal/model/user.go` に `model.User` 構造体は実在する（`ID` / `Name` / `PasswordHash *string` / `MainCharacterID *int64` / `CreatedAt`）が、**`model.User` を参照するコードは `model/user.go` 自身の 1 ファイルのみ**（走査 `grep -rn "model.User\b" internal/ cmd/ --include=*.go` → 0 件、定義側を除く）。
- ルートも登録されていない（`cmd/combomgr/main.go:253-298` の `RegisterRoutes` 呼び出し 14 本に `user` は含まれない）。

### C-5 単一利用者を前提にしている箇所（利用者 ID のリテラル固定・既定値埋め）

**全 3 か所**（`defaultUserID` 定数の定義箇所）:

| # | 位置 | 定数名・値 | 添えられたコメント | 使用箇所 |
|---|---|---|---|---|
| 1 | `internal/api/tag/handler.go:17` | `const defaultUserID int64 = 1` | `:16` 「M3 期間中の認証スキップ運用で使用する固定ユーザーID(SUPP-001 §2.5)。」 | `handler.go:51`（`ListTags`）／`:70`（`GetTag`）／`:92`（`CreateTag`）／`:123`（`UpdateTag`）／`:154`（`DeleteTag`）= **5 か所** |
| 2 | `internal/api/preset/handler.go:17` | `const defaultUserID int64 = 1` | `:15` 「認証スキップ運用で使用する固定ユーザーID(SUPP-001 §2.5)。」 | `handler.go:124`（`Create`）／`:149`（`Update`）／`:163`（`Delete`）= **3 か所** |
| 3 | `internal/service/comboio/types.go:9` | `defaultUserID int64 = 1` | `:8` 「認証スキップ運用の固定ユーザー ID(SUPP-001 §2.5、tag handler と同値)。」 | `import.go:476`（`ListTags`）／`:494`（`CreateTag`）= **2 か所** |

**⇒ 固定利用者 ID の参照は合計 10 か所。**

**構造としては `userID` を引数で受け渡している**（リテラル固定はハンドラ／サービス入口の 3 か所に閉じている）:

- `internal/service/tag/service.go:19,22,25,28,31`（`ListTags` / `GetTag` / `CreateTag` / `UpdateTag` / `DeleteTag` はすべて第 2 引数に `userID int64`）
- `internal/repository/tag/repository.go:19-23`（同様）。SQL は `WHERE user_id = ?`（`:52` / `:89` / `:115` / `:166` / `:184`）で常にスコープする
- `internal/service/preset/service.go:60,64,68`（`Create` / `Update` / `Delete` が `userID int64` を取る）

**`combos` に `user_id` 列は無い**（走査 `awk '/^CREATE TABLE combos \(/,/^\);/' migrations/000001_init_schema.up.sql | grep -c "user_id"` → **0**）。`users(id)` を参照する外部キーは `tags.user_id`（NOT NULL）と `presets.user_id`（nullable）の **2 件のみ**（走査 `grep -rn "user_id" migrations/*.sql`）。

### C-6 `FR013` 後半「タグ・プリセットは作成者のみ編集・削除可能」が実装で強制されているか

**`FR013` 後半の原文**（`docs/design/requirements.md:128`）:
> 「**本方針の射程はコンボ・セットプレイに限る**。タグ・プリセットはユーザー個人の好みを反映するデータとして、作成者のみ編集・削除可能（他ユーザーは参照のみ可能）という従来方針を維持する」

**実装の実体**:

| 対象 | 所有者チェックの実装 | 位置 |
|---|---|---|
| **プリセット** | **あり**。`authorizeMutation` が `if p.UserID == nil \|\| *p.UserID != userID` で弾く（`UserID == nil` = 組み込みプリセットも弾く）。`Update`（`:230`）と `Delete`（`:323`）の双方が通す | `internal/service/preset/service.go:366-378` |
| **タグ** | **あり（クエリスコープによる）**。すべての SQL が `WHERE ... user_id = ?` を含み、他人のタグは取得も更新も削除もできない | `internal/repository/tag/repository.go:52` / `:89` / `:115` / `:166` / `:184` |

**★ただし、両者に渡る `userID` は常に定数 `1` である**（C-5）。**利用者を識別する入力（リクエストヘッダ・ボディ・セッション等）から `userID` を得る経路は 0 件**（走査＝C-7 の語彙走査と、`defaultUserID` 以外の `userID` 供給元の追跡）。

**⇒ 「所有者による絞り込みの構造は実装されているが、その所有者は常に `id = 1` の 1 人である」という状態。** 複数利用者が区別される状況は成立していない。

### C-7 ログイン・セッションに相当する仕組みが既に在るか

**0 件。**

**探した範囲（Go）**:

```bash
grep -rniE "session|cookie|login|logout|bearer|authorization|authenticate|jwt|bcrypt|argon2|scrypt|password" \
  internal/ cmd/ --include=*.go | grep -viE "passwordEnabled|password_enabled|PasswordHash|password_hash"
```

対象 = `internal/` および `cmd/` 配下の全 `*.go`（**テストファイルを含む**）。**ヒット 1 件**:

- `internal/api/middleware/middleware_test.go:274` — `httptest.NewRequest(http.MethodPost, "/api/config", strings.NewReader('{"password":"secret-value"}'))`。**ログのマスキング挙動を固定するテストのリクエストボディ**であり、認証実装ではない。

**探した範囲（フロント）**:

```bash
grep -rniE "session|cookie|login|logout|bearer|authorization|credentials|token" \
  web/src/ web/e2e/ --include=*.ts --include=*.tsx
```

対象 = `web/src/` と `web/e2e/` の全 `*.ts` / `*.tsx`（**テストファイルを含む**、`node_modules` 除外）。ヒットの内訳:

- `web/src/hooks/useSessionStorage.ts` および同 `.test.ts` — **ブラウザの `sessionStorage` ヘルパ**であり、サーバセッションとは無関係
- `web/src/features/combo/components/ComboTable.tsx:12,50` — 上記ヘルパの利用（展開行 ID の保持）
- `credentials: "same-origin"` = **4 か所**（`web/src/features/preset/api.ts:54` ／ `web/src/features/combo-io/api.ts:16,57` ／ `web/src/features/combo/hooks/useCheckDuplicate.ts:68` ／ `web/src/features/combo/hooks/usePermanentDelete.ts:9`）— `fetch` のオプション指定であり、**送るべき Cookie を発行する側の実装は無い**（`Set-Cookie` / `SameSite` / `document.cookie` の全走査は §5 の E-3 のとおり 0 件）
- `tokenKey` / `token_key`（`web/src/features/moves/types.ts:66` ほか）— **技コマンドの解決トークン**であり認証トークンではない

**⇒ ログイン画面・セッション発行・セッション検証・認証ミドルウェア・パスワード照合のいずれも、上記の走査範囲に存在しない。**

---

## §4 軸 D — `[security]` の配線状況

### D-1 `SecurityConfig` の全フィールド

**実体**（`internal/config/config.go:79-83`、逐語）:

```go
// SecurityConfig はパスワード保護設定を保持する。フェーズ2(M6 以降)で本格利用。
type SecurityConfig struct {
	PasswordEnabled bool `toml:"password_enabled"`
	// PasswordHash は M6 以降で扱う。M1 では未使用。
}
```

- **フィールドは `PasswordEnabled bool` の 1 個のみ**。`PasswordHash` は**コメントによる予約**であり、フィールドとしては存在しない。
- `Config` への埋め込みは `internal/config/config.go:52` `Security SecurityConfig \`toml:"security"\``。
- 既定値は `internal/config/config.go:108-109` `Security: SecurityConfig{ PasswordEnabled: false }`。
- **`code-facts` §5 の記述（`SecurityConfig` は `PasswordEnabled bool \`password_enabled\`` のみ）と実体は一致する。**

### D-2 `PasswordEnabled` を読んでいる箇所の全数

**走査**:

```bash
grep -rn "PasswordEnabled" . --include=*.go --include=*.ts --include=*.tsx --include=*.toml | grep -v node_modules
grep -rn "password_enabled" . --include=*.go --include=*.ts --include=*.tsx --include=*.toml --include=*.json --include=*.sql | grep -v node_modules
grep -rn "passwordEnabled" web/src/ --include=*.ts --include=*.tsx
```

**Go 側 = 11 件**（うち**テスト 2 件を除いた非テスト 9 件**。定義・既定値の 2 件を除く **実参照 7 件**）:

| # | 位置 | 何をしているか |
|---|---|---|
| 1 | `internal/config/config.go:81` | フィールド定義 |
| 2 | `internal/config/config.go:109` | 既定値 `false` の設定 |
| 3 | `internal/api/config/handler.go:104` | `toConfigResponse` で `SecurityDTO.PasswordEnabled` へ**転記** |
| 4 | `internal/api/config/dto.go:44` | `SecurityDTO.PasswordEnabled bool \`json:"passwordEnabled"\``（応答 DTO 定義） |
| 5 | `internal/api/config/dto.go:91` | `SecurityUpdateDTO.PasswordEnabled *bool`（部分更新 DTO 定義） |
| 6 | `internal/api/config/dto.go:125` | `ToServiceRequest` でサービス層 DTO へ**転記** |
| 7 | `internal/service/config/service.go:72` | `SecurityUpdate.PasswordEnabled *bool`（サービス層 DTO 定義） |
| 8 | `internal/service/config/service.go:186-187` | `PUT /api/config` の部分更新で `next.Security.PasswordEnabled = *req.Security.PasswordEnabled` と**代入** |
| 9-10 | `internal/config/config_test.go:29-30` / `:149-150` | 既定 `false` と TOML 読込 `true` を固定するテスト |
| 11 | `internal/config/config_test.go:124` | テスト用 TOML の `password_enabled = true` |

**フロント側 = 3 件**:

| 位置 | 何をしているか |
|---|---|
| `web/src/features/config/types.ts`（`ConfigResponse.security`） | 型定義 |
| `web/src/features/config/SettingsSectionUser.tsx:20-22` | **表示のみ**（`config.security.passwordEnabled ? t("common.yes") : t("common.no")`） |
| `web/src/features/config/useUpdateConfig.ts` / `SettingsSectionNetwork.tsx` 経由 | `PUT /api/config` の送信ペイロード型 |

**★事実**: **`PasswordEnabled` の値で分岐する実装（認証の要否を切り替える `if` 文・ミドルウェアの有無を変える処理）は 0 件。** 全参照が「定義」「既定値」「DTO 間の転記」「PUT による代入」「画面での文字列表示」のいずれかである（走査範囲＝リポジトリ全体の `*.go` / `*.ts` / `*.tsx` / `*.toml` / `*.json` / `*.sql`、`node_modules` 除外）。

### D-3 `config.toml.example` の `[security]` セクションの現物（逐語）

```toml
[security]
# フェーズ2以降で実装予定。M1 では未使用。
password_enabled = false
# password_hash = ""
```

（`config.toml.example` の 29〜32 行目 = ファイル末尾。ファイル全体は 31 行）

### D-4 `SUPP-001` §5.8 の設定ファイル例と `config.toml.example` の実体の差分（全件）

**走査**: `SUPP-001` §5.8 の TOML 例（`docs/design/supp-001-detailed-design.md` 1044〜1076 行、``` で囲まれたブロック）を切り出し、`config.toml.example`（31 行）と `diff -u` した。

**差分は 6 グループ。以下が全件である。**

| # | 箇所 | `SUPP-001` §5.8 | `config.toml.example` |
|---|---|---|---|
| D-4-1 | ファイル冒頭 | （ヘッダコメントなし） | 3 行のヘッダコメント（`# CombMgr 設定ファイル(サンプル)` / `# 本ファイルを config.toml にコピーして使用する。` / `# config.toml が存在しない場合はすべてデフォルト値で動作する。`） |
| D-4-2 | `[server]` | `mode = "local"　# "local" または "lan"` の**行末コメント 1 行** | `mode` の**前に 3 行のコメント**（`# "local" または "lan"` / `# local: 127.0.0.1 のみ bind、CORS は localhost/127.0.0.1 のみ許可` / `# lan:   0.0.0.0 で bind、CORS は localhost/127.0.0.1 + 検出した代表 LAN IP を許可`） |
| D-4-3 | `[database]` | `path` の行末コメントに **OS 別パス 3 行 + CHANGE-049 のパス制約 2 行**（「配置先はアプリ既定データディレクトリ／実行時 CWD 配下に限る」「(.. トラバーサル・管轄外の絶対パスは拒否。CHANGE-049)」） | `path` の前に OS 別パス 3 行のみ。**CHANGE-049 のパス制約の記載が無い** |
| D-4-4 | `[logging]` | `level` の行末コメントは値域のみ。`file` の行末に **CHANGE-049 のパス制約**（「`database.path` と同じパス制約(CWD/データディレクトリ配下)が適用される(CHANGE-049)」） | `level` の前に **`COMBOMGR_LOG_LEVEL` 優先の記載**（SUPP-001 側には無い）。`file` に**パス制約の記載が無い** |
| D-4-5 | `[security]` | `password_enabled = false　# フェーズ3以降で実装` ／ `# password_hash = ""　# 設定時のみ記載` | `# フェーズ2以降で実装予定。M1 では未使用。` ／ `password_enabled = false` ／ `# password_hash = ""`（**「フェーズ3」と「フェーズ2」で食い違う**。`password_hash` の行末説明も無い） |
| D-4-6 | `[defaults]` | **セクションが存在する**（`character_id = 1` / `preset_id = 1` + 各 3 行の由来コメント） | **セクションが丸ごと存在しない** |

> **★D-4-6 について**: `DefaultsConfig` は実装に存在し（`internal/config/config.go:86-89`）、`PUT /api/config` の対象でもある（`internal/api/config/dto.go:96-99`）。`config.toml.example` にのみ無い。

### D-5 `PUT /api/config` が `[security]` をどう扱うか

**経路**（`PUT /api/config` → `internal/api/config/handler.go:41` `Update`）:

1. `c.Bind(&req)` で `UpdateConfigRequest` を読む（`handler.go:43`）。`Security *SecurityUpdateDTO \`json:"security,omitempty"\``（`dto.go:66`）→ `SecurityUpdateDTO{ PasswordEnabled *bool \`json:"passwordEnabled,omitempty"\` }`（`dto.go:90-92`）。**`SUPP-001` §5.9 の部分更新ポリシー（`nil` = 変更なし）に従う。**
2. `ToServiceRequest`（`dto.go:122-127`）が `configsvc.SecurityUpdate{ PasswordEnabled: r.Security.PasswordEnabled }` へポインタのまま転記。
3. `service.Update`（`internal/service/config/service.go`）が `:185-189` で:

```go
if req.Security != nil {
    if req.Security.PasswordEnabled != nil {
        next.Security.PasswordEnabled = *req.Security.PasswordEnabled
    }
}
```

4. `validateConfig(&next)`（`:203`）で検証。**走査 `grep -n -i "security\|password" internal/service/config/service.go` の結果、`validateConfig` に `Security` に関する検証は無い**（検証対象は `server.mode` / `server.port` / `database.path` / `logging.*` / `defaults.*`）。
5. `restart` の判定（`:227-229`）は `Server.Mode` / `Database.Path` / `Logging.File` の 3 つのみ。**`Security.PasswordEnabled` の変更は `restartRequired` を立てない。**
6. `configForPersistence`（`:262`）で env override 分を除外したコピーを作り、`writeAtomic(s.configPath, persisted)`（`:238`）で `config.toml` へ書き戻す。書き戻しは `toml.NewEncoder(f).Encode(cfg)`（`:391`）= **構造体全体のエンコード**であり、`[security]` セクションは `password_enabled` の 1 キーのみが出力される（`SecurityConfig` に他のフィールドが無いため）。
7. 応答は `toConfigResponse`（`handler.go:104`）で `SecurityDTO{ PasswordEnabled: cfg.Security.PasswordEnabled }` を返す。

**★事実**:

- **`passwordEnabled` は無条件に更新できる**（真偽値の範囲検証・遷移条件・他フィールドとの整合検証はいずれも 0 件）。
- **`PUT /api/config` に `password_hash` に相当する入力口は無い**（`SecurityUpdateDTO` のフィールドは `PasswordEnabled` のみ）。
- `internal/api/config/dto.go:3-5` に規約コメントがある（逐語）:
  > 「機微情報除外規約: 将来追加される機微情報フィールド(例: `SecurityConfig.PasswordHash`)は `ConfigResponse` に含めず、`json:"-"` タグで明示的に除外すること。現状の `Config` 構造体には機微情報フィールドは存在しないが、本規約を将来の実装で厳守する。」
- `internal/model/user.go:14` にも同型の規約が実装されている: `PasswordHash *string \`db:"password_hash" json:"-"\` // 絶対に API 応答に出さない`。

---

## §5 軸 E — CORS/CSRF の現状

### E-1 登録されているミドルウェアの全数と順序

**走査**:

```bash
grep -rn "\.Use(" cmd/ internal/ --include=*.go | grep -v "_test.go"   # → 3 件
grep -rn "^func [A-Z]" internal/api/middleware/*.go | grep -v _test    # → 4 件（うち MiddlewareFunc を返すのは 3 件）
grep -rn "\.Use(" cmd/ internal/ --include=*_test.go                   # → 0 件
```

**登録は 3 本のみ。すべて `e.Use`（Echo インスタンス全体への適用）で、`cmd/combomgr/main.go` に順に並ぶ**:

| 順 | 位置 | ミドルウェア | 実装 |
|---|---|---|---|
| 1 | `cmd/combomgr/main.go:246` | `mw.RequestID()` | `internal/api/middleware/logger.go:22`。`X-Request-ID` ヘッダを読み、無ければ採番してレスポンスヘッダとコンテキストへ付与 |
| 2 | `cmd/combomgr/main.go:247` | `mw.Logger()` | `internal/api/middleware/logger.go:41` |
| 3 | `cmd/combomgr/main.go:248` | `mw.CORS(allowedOrigins)` | `internal/api/middleware/cors.go:19` |

- **グループ単位（`apiGroup.Use(...)`）・ルート単位のミドルウェアは 0 件**（走査範囲＝`cmd/` と `internal/` の全 `*.go`、テストを含む）。
- `internal/api/middleware/` パッケージのファイルは `cors.go` / `doc.go` / `logger.go` / `middleware_test.go` の 4 本のみ。公開関数は `CORS` / `RequestID` / `Logger` / `RequestIDFromContext` の 4 個。

### E-2 CORS に相当する設定

**あり**（`internal/api/middleware/cors.go`）。実値は以下のとおり:

| 項目 | 実値 | 位置 |
|---|---|---|
| 許可 Origin | **起動時に一度だけ構築した固定リストとの完全一致**（`map[string]struct{}` で保持）。ワイルドカード `*` は使わない（空リスト = 全拒否） | `cors.go:20-23`、判定は `:38-40` |
| 許可 Origin の中身（common） | `http://localhost:<実ポート>` ／ `http://127.0.0.1:<実ポート>` | `cmd/combomgr/main.go:461-464`（`buildAllowedOrigins`） |
| 許可 Origin の中身（`lan` 追加分） | `http://<SelectPrimaryLANIP() の代表 IP>:<実ポート>` の **1 件のみ** | `cmd/combomgr/main.go:469-475` |
| 許可メソッド | `"GET, POST, PUT, DELETE, PATCH, OPTIONS"` | `cors.go:26` |
| 許可ヘッダ（既定） | `"Content-Type, Origin, Accept, X-Requested-With"` | `cors.go:27` |
| 許可ヘッダ（プリフライト時） | **リクエストの `Access-Control-Request-Headers` をそのまま反射**し、空のときのみ上記既定を返す | `cors.go:50-55` |
| `Max-Age` | `"600"` | `cors.go:28` |
| `Allow-Credentials` | 許可 Origin のとき `"true"` を付与 | `cors.go:42` |
| `Vary` | 許可 Origin のとき `Origin` を付与 | `cors.go:41` |
| プリフライト応答 | `OPTIONS` は常に **204 No Content**。許可外 Origin の場合は CORS ヘッダを付けずに 204 | `cors.go:47-60` |
| 許可外 Origin の非 OPTIONS 要求 | **CORS ヘッダを付けずに `next(c)` へ通す**（サーバ側では処理される。`:44` のコメント「許可外 Origin は CORS ヘッダを付けず、ブラウザ側で拒否される」） | `cors.go:43-45`, `:62` |

`lan` モードで `SelectPrimaryLANIP()` が失敗した場合、`buildAllowedOrigins` はエラーを返し、`main.go:225` が `return fmt.Errorf("build allowed origins: %w", err)` で**起動を中止する**。

### E-3 CSRF に相当する設定

**0 件。**

**探した範囲**:

```bash
# (1) CSRF そのもの
grep -rni "csrf" --include=*.go --include=*.ts --include=*.tsx --include=*.toml --include=*.json --include=*.md . | grep -v node_modules | grep -v "docs/"
# → 0 件（docs/ を除いたコード・設定・ロックのすべて）

# (2) Cookie / SameSite
grep -rniE "samesite|setcookie|document\.cookie" --include=*.go --include=*.ts --include=*.tsx . | grep -v node_modules
# → 0 件

# (3) X-Requested-With
grep -rn "X-Requested-With" --include=*.go --include=*.ts --include=*.tsx . | grep -v node_modules
# → 3 件
```

`csrf` はコード・設定ファイルには 1 件も無く、**`docs/` 配下の 23 ファイルにのみ現れる**（設計書・指示書・進捗ログ等）。

`X-Requested-With` の 3 件の内訳:

| 位置 | 何をしているか |
|---|---|
| `internal/api/middleware/cors.go:27` | **プリフライト応答の許可ヘッダ文字列に含まれるだけ**。要求も検証もしない |
| `web/src/lib/configApi.ts:9` | **フロントが `PUT /api/config` にだけ** `headers: { "X-Requested-With": "XMLHttpRequest" }` を付けて送る |
| `web/src/features/config/useUpdateConfig.test.ts:53` | 上記を固定するテスト |

**★事実**: `DES-002` §4.4 が挙げる CSRF 対策 2 本のうち、**「第一対策」の SameSite=Strict Cookie は Cookie 自体が存在しないため成立していない**（走査 (2) が 0 件）。**「補助対策」の `X-Requested-With` は、フロントが 1 経路にだけ付けているが、サーバ側で要求・検証する実装は無い**（`cors.go:27` は許可ヘッダの列挙であって検証ではない）。§9 に矛盾として再掲。

### E-4 `server.mode` でミドルウェアの構成が変わるか

**変わらない。** `e.Use` の 3 本は `cmd/combomgr/main.go:246-248` で**モードに依らず無条件に登録される**（分岐は無い）。`server.mode` が変えるのは以下の 3 点のみ:

| 変わるもの | 位置 | `local` | `lan` |
|---|---|---|---|
| bind ホスト | `main.go:440-448`（`determineBindHost`） | `127.0.0.1` | `0.0.0.0` |
| `allowedOrigins` の**中身** | `main.go:460-476`（`buildAllowedOrigins`） | localhost / 127.0.0.1 の 2 件 | 上記 + 代表 LAN IP の 1 件 = 3 件 |
| 起動時案内 | `main.go:238-241`（`logLANAccessGuide`）・`:311-315`（`printStartupNotice` の LAN 行） | LAN 案内なし | LAN URL 一覧 + FW/AV ヒント |

`internal/service/config/service.go:312-315`（`resolveNetwork`）も `s.cfg.Server.Mode != "lan"` のとき空の `NetworkInfo{}` を返す（F-2 参照）。

### E-5 設定変更系 API に他と違う保護が掛かっているか

**掛かっていない。**

- `PUT /api/config` は `confighandler.RegisterRoutes(apiGroup, configHandler)`（`main.go:294`）で **他の API と同じ `apiGroup`（`/api`）に登録**される（`internal/api/config/routes.go:8` `g.PUT("/config", h.Update)`）。
- `apiGroup` にグループ固有ミドルウェアは無い（E-1）。
- `internal/api/config/handler.go` の `Update`（`:41-82`）にヘッダ検証・Origin 検証・トークン検証のいずれも無い（先頭処理は `c.Bind(&req)`）。
- **`PUT /api/config` にだけ存在する差分は、フロントが `X-Requested-With: XMLHttpRequest` を送っていること**（`web/src/lib/configApi.ts:9`）**のみで、サーバ側の検証は無い**（E-3）。
- 参考: `internal/config` / `internal/service/config` にはパス検証（`ValidateDataPath` 相当。`SUPP-001` §5.8 の CHANGE-049 ポリシー）が実装されているが、これは**入力値の妥当性検証であって呼び出し元の認可ではない**。

---

## §6 軸 F — 設定画面の構成と LAN IP の取得経路

### F-1 設定画面の実体

**読んだ時点**: HEAD = `8af2ca6afc3cc1e6a69e17c86c534b1b7ead7545`、`git status --porcelain` は空（§0.1）。**`M21-07` の作業中ファイルは本作業ツリーに存在しない。**

| 項目 | 実体 |
|---|---|
| ページ | `web/src/pages/SettingsPage.tsx`（38 行）。`SettingsPage` を default export |
| データ取得 | `useConfig()`（`web/src/features/config/useConfig.ts`）= `GET /api/config` |
| レイアウト | `Header` + `max-w-3xl mx-auto px-4 py-6 space-y-6` のコンテナ。`isLoading` / `error` / `config` の 3 状態 |

**セクション構成（`SettingsPage.tsx:27-33` の描画順、6 件）**:

| 順 | コンポーネント | 実パス | 主な要素 |
|---|---|---|---|
| 1 | `SettingsSectionBasic` | `web/src/features/config/SettingsSectionBasic.tsx` | 見出し `settings.basic.heading`。`<select>` 1 個 + 保存ボタン（`:76-80`、`updateConfig.isPending` で disabled） |
| 2 | `SettingsSectionUser` | `.../SettingsSectionUser.tsx` | 見出し `settings.user.heading`。**`passwordEnabled` の表示のみ**（`:20-22`）＋ **`disabled` のボタン 2 個**（`settings.user.addUser` / `settings.user.changePassword`、いずれも `title={t("settings.user.notImplemented")}`） |
| 3 | `SettingsSectionNetwork` | `.../SettingsSectionNetwork.tsx` | 見出し `settings.network.heading`。モード切替（`:59` で `updateConfig.isPending` 時 disabled）／ **QR 表示ボタン**（`:96-101`）／ `LanModeConfirmDialog` |
| 4 | `SettingsSectionData` | `.../SettingsSectionData.tsx` | 見出し `settings.data.heading`。**`disabled` のボタン 3 個**（`:22` / `:30` / `:38`） |
| 5 | `SettingsSectionPresetLink` | `.../SettingsSectionPresetLink.tsx`（16 行） | 見出し `settings.presetLink.heading`。プリセット管理画面へのリンク |
| 6 | `SettingsSectionDetails` | `.../SettingsSectionDetails.tsx` | 見出し `settings.details.heading`。`GET /api/health` の `version` を表示（`:14-20`, `:39-40`） |

同ディレクトリの補助ファイル: `LanModeConfirmDialog.tsx` ／ `QRCodeModal.tsx` ／ `types.ts` ／ `useConfig.ts` ／ `useUpdateConfig.ts` ＋ テスト 5 本（`QRCodeModal.test.tsx` / `SettingsSectionDetails.test.tsx` / `SettingsSectionNetwork.test.tsx` / `useConfig.test.ts` / `useUpdateConfig.test.ts`）。

### F-2 LAN の IP アドレスを取得している経路

**あり**: `internal/infra/netutil/private_ip.go`（`port.go` と合わせて 2 ファイル + テスト 2 本）。

**公開インターフェース（全数）**:

| シンボル | 位置 | 内容 |
|---|---|---|
| `func IsVirtualInterface(name string) bool` | `private_ip.go:35` | 仮想 NIC 判定。前方一致（大小無視）。パターンは `docker` / `veth` / `br-` / `vEthernet` / `tailscale` / `tun` / `tap` / `vmnet` / `vboxnet` / `utun` / `ppp` / `zt` の **12 個**（`:15-28`） |
| `func IsPrivateIPv4(ip net.IP) bool` | `private_ip.go:47` | RFC1918（10/8・172.16/12・192.168/16）と 169.254/16 を true。**ループバックと CGNAT 100.64/10 は false** |
| `func ListPrivateIPv4() ([]net.IP, error)` | `private_ip.go:72` | 仮想 NIC・ループバック・ダウン中 IF を除外したプライベート IPv4 の**一覧**（インタフェース列挙順を維持） |
| `func SelectPrimaryLANIP() (net.IP, error)` | `private_ip.go:130` | 優先順位に従って**代表 IP 1 件**を返す。優先度は `192.168/16`（VirtualBox 既定 `192.168.56.0/24` を除く） > `10/8` > `172.16/12` > `192.168.56.0/24` の 4 段（`:150-183` の `selectByPriority`）。候補ゼロで `ErrNoLANIP` |
| `var ErrNoLANIP` | `private_ip.go:120` | `errors.New("netutil: no LAN IPv4 available")` |
| `const DefaultPortScanRange = 20` | `port.go:9` | ポート競合フォールバックの探索本数 |
| `func ListenAvailable(host string, startPort, maxAttempts int) (net.Listener, int, error)` | `port.go:17` | 空きポート連番探索 |

パッケージ doc（`private_ip.go:1-4`）は設計参照として `SUPP-001` §2.6.2（**QRコードIP選定 = 代表IP決定ロジック**）を明示している。

**呼び出し元（全数）**:

| 呼び出し元 | 関数 | 用途 |
|---|---|---|
| `cmd/combomgr/main.go:471` | `netutil.SelectPrimaryLANIP()` | `buildAllowedOrigins` の CORS 許可 Origin 構築 |
| `cmd/combomgr/main.go:279` | `configsvc.NewService(cfg, configPath, netutil.SelectPrimaryLANIP, ...)` | **config サービスへ関数として注入**（`service.lanIpResolver`。`internal/service/config/service.go:107`） |
| `cmd/combomgr/main.go:424` | `netutil.ListPrivateIPv4()`（`logLANAccessGuide` 内） | 起動ログの LAN URL 一覧 |
| `cmd/combomgr/main.go:314` | `netutil.ListPrivateIPv4()` | `printStartupNotice` に渡す LAN IP 一覧 |
| `cmd/combomgr/main.go:201` | `netutil.ListenAvailable(...)` | ポート競合フォールバック |

**API への露出**（`GET /api/config` / `PUT /api/config` の応答）: `internal/service/config/service.go:312-326` `resolveNetwork()`

```go
func (s *service) resolveNetwork() NetworkInfo {
	if s.cfg.Server.Mode != "lan" {
		return NetworkInfo{}
	}
	ip, err := s.lanIpResolver()
	if err != nil {
		slog.Warn("config: failed to resolve LAN IP", "error", err)
		return NetworkInfo{}
	}
	ipStr := ip.String()
	return NetworkInfo{
		PrimaryLanIp: ipStr,
		LanUrl:       fmt.Sprintf("http://%s:%d", ipStr, s.cfg.Server.Port),
	}
}
```

これが `NetworkDTO`（`internal/api/config/dto.go:47-50`）として応答に載る。

```go
// NetworkDTO は LAN 接続情報のレスポンス表現。
type NetworkDTO struct {
	PrimaryLanIp string `json:"primaryLanIp"`
	LanUrl       string `json:"lanUrl"`
}
```

**`local` モードでは両フィールドとも空文字になる。**

### F-3 起動時の案内（stdout）に接続 URL が出ているか

**出ている。ただし配布ビルド（`WebEmbedded`）時のみ。**

| 出力先 | 関数 | 発火条件 | 内容 |
|---|---|---|---|
| **stdout** | `printStartupNotice`（`cmd/combomgr/main.go:372-392`） | **`combomgr.WebEmbedded == true` のときだけ**（`main.go:301` の `if` 配下、`:314` で呼ぶ） | 罫線 + 「CombMgr が起動しました」＋ `この PC からアクセス: http://localhost:<実ポート>/` ＋（`lan` 時）LAN IP ごとの URL 一覧・IP 未検出時の案内・ファイアウォール/ウイルス対策の許可案内 ＋ 「終了するにはこのウィンドウを閉じてください。」 |
| slog（既定はファイル） | `logLANAccessGuide`（`main.go:417-437`） | **`cfg.Server.Mode == "lan"` のとき**（`main.go:239-241`。`WebEmbedded` に依らない） | LAN URL 一覧 ＋ FW / AV 許可のヒント |
| slog | `launchBrowser`（`main.go:399-415`） | `WebEmbedded` 時 | `http://localhost:<実ポート>` を info ログに出しつつブラウザを自動起動 |
| slog | `main.go:230-236` | 常時 | `version` / `mode` / `addr` / `port` / `allowed_origins` |

**`SUPP-001` §5.6 との突合**: 同節は「実装は専用関数 `printStartupNotice`(配布ビルド `WebEmbedded` 時のみ、`launchBrowser` と同 gating)」と明記しており、**実装（`main.go:301` の `if combomgr.WebEmbedded` 配下に `printStartupNotice` と `launchBrowser` が並ぶ）と一致する**。

### F-4 QR コード生成に使えるフロント側の依存が既に入っているか

**入っている。かつ既に使われている。**

| 項目 | 実体 |
|---|---|
| 依存 | **`"qrcode.react": "^4.2.0"`**（`web/package.json:37`、`dependencies`）。`web/pnpm-lock.yaml:80` / `:1773` / `:3693` に `qrcode.react@4.2.0` として解決済み |
| 実装 | `web/src/features/config/QRCodeModal.tsx`（`:4` `import { QRCodeSVG } from "qrcode.react";`、`:45` `<QRCodeSVG value={url} size={200} />`） |
| 配線 | `web/src/features/config/SettingsSectionNetwork.tsx:6` で import、`:16` `const [showQr, setShowQr] = useState(false)`、`:96-101` の表示ボタン、`:109-110` `{showQr && config.network.lanUrl && (<QRCodeModal url={config.network.lanUrl} ... />)}` |
| i18n キー | `qrModal.title` / `qrModal.description` / `qrModal.close` / `settings.network.showQr` |
| テスト | `web/src/features/config/QRCodeModal.test.tsx`（3 ケース） |

**依存の追加は行っていない**（指示書 §0.2 / §1.3-4）。

---

## §7 軸 G — パスワードハッシュ候補の実在とライセンス（機械の出力のみ）

> **本節は「いま何が在るか」の機械出力のみを記す。方式の推奨・優劣の評価は含まない**（指示書 §0.3）。

### G-1 `go.mod` の全 `require` 行（逐語）

```
module github.com/plexiblinp/combomgr

go 1.26.4

require (
	github.com/BurntSushi/toml v1.6.0
	github.com/golang-migrate/migrate/v4 v4.19.1
	github.com/labstack/echo/v4 v4.15.1
	github.com/pkg/browser v0.0.0-20240102092130-5ac0b6a4141c
	golang.org/x/text v0.32.0
	gopkg.in/natefinch/lumberjack.v2 v2.2.1
	modernc.org/sqlite v1.50.0
)

require (
	github.com/dustin/go-humanize v1.0.1 // indirect
	github.com/google/uuid v1.6.0 // indirect
	github.com/labstack/gommon v0.4.2 // indirect
	github.com/mattn/go-colorable v0.1.14 // indirect
	github.com/mattn/go-isatty v0.0.20 // indirect
	github.com/ncruces/go-strftime v1.0.0 // indirect
	github.com/remyoudompheng/bigfft v0.0.0-20230129092748-24d4a6f8daec // indirect
	github.com/valyala/bytebufferpool v1.0.0 // indirect
	github.com/valyala/fasttemplate v1.2.2 // indirect
	golang.org/x/crypto v0.46.0 // indirect
	golang.org/x/net v0.48.0 // indirect
	golang.org/x/sys v0.42.0 // indirect
	modernc.org/libc v1.72.0 // indirect
	modernc.org/mathutil v1.7.1 // indirect
	modernc.org/memory v1.11.0 // indirect
)
```

**direct = 7 件 ／ indirect = 15 件（計 22 件）。**

### G-2 `go list -m all` の出力

```bash
go version
# go version go1.26.4 linux/amd64
go env GOMODCACHE
# /root/go/pkg/mod
go list -m all
```

**出力は 208 モジュール**（メインモジュール `github.com/plexiblinp/combomgr` を含む）。全文は長いため、**`crypto` / `bcrypt` / `scrypt` / `argon2` / `pbkdf2` に関係する行と、`golang.org/x/` の全行**を以下に引く（残りは上記コマンドで再現できる）:

```
golang.org/x/crypto v0.46.0
golang.org/x/exp v0.0.0-20230315142452-642cacee5cc0
golang.org/x/mod v0.33.0
golang.org/x/net v0.48.0
golang.org/x/oauth2 v0.30.0
golang.org/x/sync v0.20.0
golang.org/x/sys v0.42.0
golang.org/x/telemetry v0.0.0-20251008203120-078029d740a8
golang.org/x/term v0.38.0
golang.org/x/text v0.32.0
golang.org/x/time v0.14.0
golang.org/x/tools v0.42.0
golang.org/x/tools/godoc v0.1.0-deprecated
golang.org/x/xerrors v0.0.0-20231012003039-104605ab7028
github.com/xdg-go/pbkdf2 v1.0.0
github.com/xdg-go/scram v1.1.1
github.com/xdg-go/stringprep v1.0.3
github.com/youmark/pkcs8 v0.0.0-20181117223130-1be2e3e5546d
gitlab.com/nyarla/go-crypt v0.0.0-20160106005555-d9a5dc2b789b
github.com/mutecomm/go-sqlcipher/v4 v4.4.0
```

> **★注記（数え方）**: `go list -m all` は **`golang-migrate` が引き込む多数のドライバ（Docker / Spanner / MongoDB / Snowflake 等）を含む build list 全体**を返す。**「依存グラフに実在する」ことと「本体のビルドに必要である」ことは別である。** 上記の `github.com/xdg-go/pbkdf2` / `gitlab.com/nyarla/go-crypt` / `github.com/mutecomm/go-sqlcipher/v4` などは `golang-migrate` のドライバ経由で build list に載っているものであり、本体のインポートグラフに入っているかは本項では判定していない。

### G-3 `golang.org/x/crypto` は依存グラフに居るか

**居る。**

| 項目 | 値 |
|---|---|
| 選択されたバージョン | **`v0.46.0`** |
| direct / indirect | **indirect**（`go.mod` の第 2 `require` ブロックに `// indirect` 付きで記載） |

**`go mod graph` による要求元（全数）**:

```bash
go mod graph | grep " golang.org/x/crypto@" | sort -u
```

```
github.com/golang-migrate/migrate/v4@v4.19.1 golang.org/x/crypto@v0.45.0
github.com/labstack/echo/v4@v4.15.1 golang.org/x/crypto@v0.46.0
github.com/plexiblinp/combomgr golang.org/x/crypto@v0.46.0
golang.org/x/net@v0.48.0 golang.org/x/crypto@v0.46.0
```

**4 辺**。うち `github.com/plexiblinp/combomgr → golang.org/x/crypto@v0.46.0` の辺は、**`go.mod` の indirect require 行に由来する**（Go 1.17 以降のモジュールグラフ枝刈りにより、indirect 依存も main module の require に列挙される）。**本体のソースが `golang.org/x/crypto/...` を import している箇所は 0 件**（走査 `grep -rn "golang.org/x/crypto" internal/ cmd/ --include=*.go` → 0 件）。

### G-4 `bcrypt` / `scrypt` / `argon2` の実在

**走査**（`go env GOMODCACHE` = `/root/go/pkg/mod`）:

```bash
ls /root/go/pkg/mod/golang.org/x/crypto@v0.46.0/
```

> **★前提**: 調査開始時点では `golang.org/x/crypto` は展開されておらず、`cache/download/golang.org/x/crypto/@v/` に `.info` と `.mod` のみが在り `.zip` は無かった。**`go.sum` に `h1:` と `/go.mod` の両ハッシュが既に在る**（`go.sum:39-40`）ため、`GOFLAGS=-mod=readonly go mod download golang.org/x/crypto` で**既存の依存をローカルキャッシュへ取得した**（新規依存の追加ではない）。**実行前後で `go.mod` / `go.sum` の sha256 は不変**、`git status --porcelain` も空であることを確認済み（§0.1）。

`golang.org/x/crypto@v0.46.0` 直下のディレクトリ・ファイル一覧（逐語）:

```
CONTRIBUTING.md  acme          blake2s   bn256    chacha20poly1305  curve25519  hkdf      nacl   openpgp  pkcs12    ripemd160  sha3  tea      x509roots
LICENSE          argon2        blowfish  cast5    codereview.cfg    ed25519     internal  ocsp   otr      poly1305  salsa20    ssh   twofish  xtea
PATENTS          bcrypt        cryptobyte         go.mod            go.sum      md4       pbkdf2  scrypt   xts
README.md        blake2b
```

**指示書 G-4 の 3 パッケージは 3 件とも実在する**（実在するものだけを挙げる）:

| パッケージ | 実在 | ディレクトリ内のファイル |
|---|---|---|
| `golang.org/x/crypto/bcrypt` | **あり** | `base64.go` / `bcrypt.go` / `bcrypt_test.go` |
| `golang.org/x/crypto/scrypt` | **あり** | `example_test.go` / `scrypt.go` / `scrypt_test.go` |
| `golang.org/x/crypto/argon2` | **あり** | `argon2.go` / `argon2_test.go` / `blake2b.go` / `blamka_amd64.go` / `blamka_amd64.s` / `blamka_generic.go` / `blamka_ref.go` |

（参考・指示書の名指し外）`golang.org/x/crypto/pbkdf2` も実在する。

### G-5 ライセンス（`GOMODCACHE` 配下の実体から）

**対象**: `golang.org/x/crypto@v0.46.0`

**ライセンス関連ファイルの一覧**（`ls -la` から抽出）:

```
-r--r--r--  1 root root 1453  LICENSE
-r--r--r--  1 root root 1303  PATENTS
```

**`LICENSE` の冒頭 30 行（逐語）**:

```
Copyright 2009 The Go Authors.

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are
met:

   * Redistributions of source code must retain the above copyright
notice, this list of conditions and the following disclaimer.
   * Redistributions in binary form must reproduce the above
copyright notice, this list of conditions and the following disclaimer
in the documentation and/or other materials provided with the
distribution.
   * Neither the name of Google LLC nor the names of its
contributors may be used to endorse or promote products derived from
this software without specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS
"AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT
LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR
A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT
OWNER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL,
SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT
LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE,
DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY
THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
(INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
```

**`PATENTS` の冒頭 5 行（逐語）**:

```
Additional IP Rights Grant (Patents)

"This implementation" means the copyrightable works distributed by
Google as part of the Go project.
```

> **★本項に記したのはファイルの実体の逐語である。SPDX 識別子（`BSD-3-Clause` 等）は当該ファイル中に文字列として存在しないため、記憶や推定による識別子の付与は行っていない**（指示書 §8.1-1）。判定は `CLAUDE.md` §6 の許可／禁止表と照合する側の手番。

### G-6 `/app_build_check` の出力（そのまま添付）

```bash
bash scripts/app-build-supplychain-check.sh
```

```
アプリビルド前 サプライチェーン安全確認  (2026-08-15 08:25)
  WAIT 閾値: high 以上

=== 1. Go 依存の整合性 (go mod verify) ===
  OK: all modules verified

=== 2. Go 既知脆弱性 (govulncheck) ===
  SKIP: govulncheck 未インストール。Go の CVE 検査は実行していません。
  有効化するには: APP_CHECK_GO_VULN=1 を付けて再実行(要 vuln.go.dev の FW 許可)。
    例) APP_CHECK_GO_VULN=1 bash scripts/app-build-supplychain-check.sh

=== 3. フロント依存 既知脆弱性 (pnpm audit) ===
  検出: critical=0 high=3 moderate=4 low=0
  詳細は: (cd web && pnpm audit) / 個別調査は pnpm why <pkg>

=== 総合判定 ===
WAIT
  閾値(high)以上の脆弱性または整合性の問題があります。ビルド前の対応を推奨します。
  ※ 本チェックは「既知 CVE + 整合性」の確認です。公開直後の速報的な侵害までは
    カバーしません。必要なら AI プロンプト版の併用を検討してください。
```

**exit code = 2**（スクリプトのヘッダ `:29` により **WAIT = ビルド前に対応を推奨**）。

**判定は WAIT**。ラッパー（`.claude/commands/app_build_check.md`）の要求に従い、検出内容の内訳を添える。`cd web && pnpm audit` の実行結果（`7 vulnerabilities found / Severity: 4 moderate | 3 high`）:

| 深刻度 | パッケージ | 脆弱バージョン | 修正版 | Advisory |
|---|---|---|---|---|
| high | `nanoid` | `<3.3.16` | `>=3.3.16` | GHSA-28wg-ghj8-5hjv（non-secure generators can loop indefinitely with negative size） |
| high | `nanoid` | `<3.3.18` | `>=3.3.18` | GHSA-2v37-7h3g-55p8（custom generators can loop indefinitely when size is zero） |
| high | `postcss` | `<=8.5.17` | `>=8.5.18` | GHSA-r28c-9q8g-f849（Path Traversal in Previous Source Map Auto-Loading） |
| moderate | `react-router` | `>=6.0.0 <7.18.0` | `>=7.18.0` | GHSA-wrjc-x8rr-h8h6（Open redirect via backslash in `<Link>` / `useNavigate`） |
| moderate | `react-router-dom` | `>=6.30.2 <=6.30.4` | `<0.0.0` | GHSA-jjmj-jmhj-qwj2（Open redirect leading to XSS） |
| moderate | `react-router` | `>=6.4.0 <7.18.0` | `>=7.18.0` | GHSA-337j-9hxr-rhxg（Arbitrary Constructor Injection via `deserializeErrors()` in SSR Hydration） |
| moderate | `postcss` | `<=8.5.22` | `>=8.5.23` | GHSA-fxqj-rqcc-2cmp（incomplete fix of GHSA-6g55-p6wh-862q） |

> **★上記 7 件はいずれもフロント依存であり、`golang.org/x/crypto` を含む Go 依存に関する検出ではない。** Go 側は `go mod verify` が `OK: all modules verified` を返し、**CVE 検査（`govulncheck`）は実行されていない**（G-7）。

### G-7 実行できなかったもの（軸 G 内）

| # | 項目 | 状態 | 理由 |
|---|---|---|---|
| G-7-1 | `govulncheck` による Go の CVE 検査 | **実行していない**（「脆弱性が無い」ではない） | 既定の `/app_build_check` は `govulncheck` 未インストール時に SKIP する（`scripts/app-build-supplychain-check.sh:101-106`）。`APP_CHECK_GO_VULN=1` を付けると `go run golang.org/x/vuln/cmd/govulncheck@latest` で取得実行する分岐（同 `:98-100`）があるが、**指示書 G-6 が求めるのは `/app_build_check` を回すことであり、既定の実行結果をそのまま添付した**。実施する場合は `vuln.go.dev` への到達が要る |
| G-7-2 | `golang.org/x/crypto` 以外のモジュールのライセンス実体確認 | **実行していない** | 指示書 G-5 の「各モジュール」の範囲を、G-3 / G-4 が名指しする `golang.org/x/crypto` に限って実施した。他 207 モジュールの `LICENSE` 実体は読んでいない（**`GOMODCACHE` に展開されていないモジュールが大多数であり、全件の展開は依存の一括取得になる**） |

---

## §8 ★想定外の発見

> 指示書 §0.3 の例外 (1)。**判断ではなく事実として記す。**

### §8-1 QR コード表示は「依存が入っているか」ではなく、既に実装され設定画面に配線されている

指示書 §0.4 は軸 F を「`FR407`（QR）の前提」と位置づけ、F-4 を「**QR コード生成に使えるフロント側の依存が既に入っているか**（★「入っていない」も答えである）」としている。

**実測結果は「依存が入っている」を超えている**:

- 依存 `qrcode.react@4.2.0` が `web/package.json:37` の `dependencies` に在り、lock も解決済み
- `web/src/features/config/QRCodeModal.tsx` が `QRCodeSVG` で QR を描画する完成したモーダルとして実在（58 行）
- `web/src/features/config/SettingsSectionNetwork.tsx:96-110` が表示ボタンと `config.network.lanUrl` を渡す配線を持つ
- バックエンド側も `GET /api/config` の `network.lanUrl`（`internal/service/config/service.go:322-325`）で LAN URL を供給済み
- テスト `QRCodeModal.test.tsx` が 3 ケースで固定

**⇒ `M22-06`（QR）の起点は「未実装」ではない**（何が残っているかは本調査では判定しない）。

### §8-2 `internal/{api,service,repository}/user/` は `doc.go` だけの空パッケージとして 3 レイヤ分存在する

3 ディレクトリとも中身は `doc.go` 1 本（105 / 156 / 104 バイト）で、コメントは「M6 で実装」「フェーズ2(M6 以降)で実装」と書かれている。**`model.User` 構造体も定義だけがあり参照 0 件**。ルート登録も 0 件。

### §8-3 `combos` 系と `setups` 系で、同一事象の 409 エラーコードが異なる

A-3 のとおり `conflict` ／ `version_conflict`。加えて、**ハンドラ層テストの固定強度も非対称**（setups はコード文字列まで固定、combos はステータスのみ。A-5）。

### §8-4 `ComboEditor.buildPatchPayload` は `initial` 不在時に `version: 0` を送る

`web/src/features/combo/components/ComboEditor.tsx:237` `version: initial?.version ?? 0`。`combos.version` は `NOT NULL DEFAULT 1` であり、A-4 のとおり `version = 0` の行が生成される経路は無い。

### §8-5 `[defaults]` は実装にも `PUT /api/config` にも在るが、`config.toml.example` にだけ無い

D-4-6。`SUPP-001` §5.8 は `[defaults]` を持ち、`internal/config/config.go:86-89` に `DefaultsConfig` が在り、`internal/api/config/dto.go:96-99` に更新 DTO も在る。`config.toml.example` にのみ欠けている。

### §8-6 `PATCH /api/combos/:id` は `SET` 対象が空でも `version` を +1 する

`internal/repository/combo/repository.go:886-887` のコメントと実装（「何も SET フィールドがない場合(setParts が空)でも version / updated_at は常時更新する」）。`{"version": N}` だけを送る要求でも版が進む。

### §8-7 `recipe_cache` の更新は `combos.updated_at` を進めるが `version` は進めない

`internal/repository/combo/repository.go:205` のコメント「updated_at も更新するが version はインクリメントしない（キャッシュは排他対象外）」＋ `:1335`（`updated_at` あり）／`:1345`・`:1355`（`updated_at` なし）の 3 本。**`updated_at` と `version` が同期しない書き込みが実装上存在する。**

### §8-8 CORS のプリフライトはリクエストの `Access-Control-Request-Headers` をそのまま反射する

`internal/api/middleware/cors.go:50-55`。許可 Origin であることが前提だが、許可ヘッダの固定リスト（`:27`）は**要求ヘッダが空のときのフォールバック**として使われる。

---

## §9 ★明らかな矛盾

> 指示書 §0.3 の例外 (2)。**とくに §3.2 の前提事実 6 件と実体の食い違い。**

### §9-A `M22-RESEARCH-01` §3.2 前提事実 6 件の突合

| # | 前提事実 | 実測 | 判定 |
|---|---|---|---|
| 1 | `combos` の DDL に `version INTEGER NOT NULL DEFAULT 1` がある（`000019` 系のテーブル再構築）。`setups` にも同じ列がある（`000001_init_schema`） | `combos` = `000001:87`（初出）／`000016:41` ／`000019:43`（再構築時の再定義）。`setups` = `000001:172` | **一致**（`combos` の初出は `000019` ではなく `000001` である点だけ補足） |
| 2 | `model.Combo` / `model.Setup` に `Version int (db:version, json:version)` がある | `internal/model/combo.go:147` ／ `internal/model/setup.go:32` | **一致** |
| 3 | `SecurityConfig` は `PasswordEnabled bool \`password_enabled\`` のみ | `internal/config/config.go:80-83` | **一致** |
| 4 | `model.User` は `ID` / `Name` / `PasswordHash *string` / `MainCharacterID` / `CreatedAt` を持つ | `internal/model/user.go:11-17` | **一致** |
| 5 | `tags.user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE`、`presets.user_id INTEGER REFERENCES users(id) ON DELETE CASCADE`（nullable）、`combos` に `user_id` 列は無い | `migrations/000001_init_schema.up.sql:110` / `:133`。`combos` ブロックの `user_id` は 0 件 | **一致** |
| 6 | `c.Bind` バインド先の一覧に `UpsertSetupResultRequest` と `CreateSetupLinkRequest` があり、いずれも `version` フィールドを持たない | `internal/api/setup/setup_results_handler.go:34` ／ `internal/api/setup/handler.go:79`。DTO は `dto.go:38` / `:57` でいずれも `Version` 無し | **一致** |

**⇒ §3.2 の前提事実 6 件に、実体との食い違いは無い。**

### §9-B 設計書と実装の食い違い

| # | 箇所 | 設計書の記述 | 実装 |
|---|---|---|---|
| 1 | **`DES-002` §4.4 CSRF「第一対策」** | 「SameSite=Strict Cookie によるCookie送信制限（外部サイトから本アプリへのリクエストでCookieが送られないため、CSRF攻撃が成立しない）」 | **Cookie を発行・検証するコードが 0 件**（`SameSite` / `Set-Cookie` / `document.cookie` の全走査 = 0 件。E-3）。当該対策の前提となる Cookie が存在しない |
| 2 | **`DES-002` §4.4 CSRF「補助対策」** | 「POST/PUT/DELETE/PATCH リクエストに独自ヘッダ（`X-Requested-With`）を**要求し**、CORS preflight と組み合わせて簡易的な検証を行う」 | **サーバ側で要求・検証する実装が 0 件**。`X-Requested-With` は CORS の許可ヘッダ列挙（`cors.go:27`）に現れるのみ。フロントは `PUT /api/config` の 1 経路だけ付与（`web/src/lib/configApi.ts:9`）で、他の 35 件の非 GET ルートには付けていない |
| 3 | **`DES-002` §8 認証・ユーザー管理** | 「利用者が2人以上の場合：起動時にユーザー選択画面を表示」「LAN共有モードON時：簡易パスワード（全ユーザー共通の1パスワード）を要求可能とする」「セッション管理はサーバーサイドセッション（メモリ保持）で十分」「セッションタイムアウトは最低12時間以上に設定する」 | **ユーザー選択画面・パスワード要求・セッション管理・セッションタイムアウトのいずれも実装 0 件**（C-7）。設定画面の当該ボタン 2 個は `disabled` + `notImplemented` ツールチップ（F-1） |
| 4 | **`DES-002` §8 LAN 共有モード時の認証ポリシー** | 「LAN共有モードONに切り替える際、パスワード未設定の場合は『パスワード保護を強く推奨します』と警告し、パスワード設定へ誘導する」／「明示的な同意ダイアログ（『パスワードなしでLAN公開します。よろしいですか』）で承認を得る」 | `LanModeConfirmDialog.tsx` は実在するが、**`passwordEnabled` を参照する分岐は 0 件**（D-2 の全数走査で当該ファイルはヒットしない）。パスワード設定への誘導も存在しない（設定は `disabled` ボタン） |
| 5 | **`DES-002` §4.2 と実装の照合可能性** | §4.2 は「主要エンドポイント（概要）」の表だが、**楽観排他の衝突時のステータス・エラーコードを規定していない** | 実装は 409 + `conflict` / `version_conflict`。**指示書 A-3 が求める「§4.2 の記述と一致するか」は、照合対象の記述が §4.2 に無いため判定できない**（規定は §6.4 の方針一文のみ）。A-3 参照 |
| 6 | **`SUPP-001` §5.8 と `config.toml.example`** | §5.8 の設定ファイル例（`[defaults]` を含む、CHANGE-049 のパス制約コメントを含む、`[security]` は「フェーズ3以降で実装」） | `config.toml.example` は `[defaults]` 欠落・パス制約コメント欠落・`[security]` は「フェーズ2以降で実装予定。M1 では未使用。」。差分 6 グループ（D-4） |
| 7 | **`migrations/000007` のヘッダコメント** | 「本来は M6 初回起動ウィザードで生成(SUPP-001 §2.5)。M3 期間は未実装のため seed で凌ぐ。」「**M6 着手時にウィザード経由生成へ切り替える。**」 | `internal/{api,service,repository}/user/` は `doc.go` のみ（C-4）。**切り替えは行われておらず、seed の暫定措置がそのまま残っている** |
| 8 | **`SUPP-001` §5.6 センシティブ情報** | 「パスワードハッシュ、セッションID、`config.toml` のパスワード項目等は**絶対にログ出力しない**。slog のハンドラで該当フィールドをマスクする。」 | マスキングを固定するテストは `internal/api/middleware/middleware_test.go:274` に存在する。**ただし現時点でパスワードハッシュ・セッションIDを生成するコードが 0 件のため、マスク対象の実データは発生しない**（事実の記述であり評価ではない） |

---

## §10 ★実行できなかったこと

> **「無い」と「取れなかった」を分ける。**

| # | 項目 | 状態 | 理由・詳細 |
|---|---|---|---|
| 10-1 | **C-1 `users` の行数と中身** ／ **C-2 `tags.user_id` の分布** ／ **C-3 `presets.user_id` の分布** | **取れなかった**（「行が 0 件」ではない） | 実行環境（Claude Code on the web のクラウドコンテナ）は**リポジトリのクリーンクローンのみ**を持ち、DB ファイルが存在しない。`find / -name "*.db"` の結果は OS 同梱の `/usr/lib/x86_64-linux-gnu/avahi/service-types.db` 1 件のみで、`~/.local/share/combomgr/` も `config.toml` も不在。**DB を作るにはマイグレーションの適用（＝ DB への書き込み）が要り、指示書 §0.2 の禁止事項に触れる**（§8.3 停止条件 1 に該当するが、同 2 により「コピーで取れないなら §10 へ書いて先へ進む」に従った）。**加えて `sqlite3` CLI も未インストール**（`command -v sqlite3` → exit 1）であり、DB があっても本セッションでは別途の手当が要る。⇒ **開発 DB を持つ環境（ローカル）での再実施が要る** |
| 10-2 | **G-6 の `govulncheck`（Go の CVE 検査）** | **実行していない**（「脆弱性が無い」ではない） | `/app_build_check` の既定実行では未インストールにより SKIP。`APP_CHECK_GO_VULN=1` 付き実行は `go run golang.org/x/vuln/cmd/govulncheck@latest` で外部取得を伴い、指示書 G-6 が求める「`/app_build_check` を回す」の既定挙動から外れるため実施していない |
| 10-3 | **G-5 の `golang.org/x/crypto` 以外のライセンス実体** | **実行していない** | G-3 / G-4 が名指しするモジュールに範囲を限った。他 207 モジュールは `GOMODCACHE` に未展開のものが大多数で、全件確認は依存の一括取得になる |
| 10-4 | **`e2e` / 実サーバの挙動確認**（CORS の実応答ヘッダ、409 の実 JSON 本文、`printStartupNotice` の実出力） | **実行していない** | いずれもサーバ起動 → DB 作成（マイグレーション適用）を伴い、指示書 §0.2 の禁止事項に触れる。本レポートの記述はすべて**ソースコードからの静的読み取り**である |
| 10-5 | **`M21-07` の作業ツリー状態の確認**（指示書 §0.5 の注意） | **確認済み・該当なし** | 本セッションの作業ツリーは `git status --porcelain` が空で、`M21-07` の作業中ファイルは存在しない。**「読めなかった」ではなく「並走の影響が無い状態で読んだ」** |
| 10-6 | **`git log -S` によるコード変更時期の追跡** | **実施していない** | 本調査の 7 軸はいずれも「いまどうなっているか」を問うており、変更時期を求める項目が無いため対象外とした（**取れなかったのではなく、走査していない**） |

---

## §11 followup の更新候補

> **★製造は `followup-backlog.md` を編集しない**（`D-382`）。**設計卓が畳める形で以下に置く。**

| # | スラッグ | 何が起きるか | 再現条件または根拠 | 割付の候補と理由 | 新規／既存行の更新 |
|---|---|---|---|---|---|
| 11-1 | `research-db-dependent-items-m22` | **C-1 / C-2 / C-3 が未測定のまま**。`users` の実行数、`tags.user_id` / `presets.user_id` の実分布が分かっていない | 本レポート §10-1。クラウド実行環境に DB が無く、DB 生成はマイグレ適用（書き込み）になるため実施できない | **開発 DB を持つ環境での追補調査**（`M20-RESEARCH-01` がローカル担当を分けた前例と同型）。`M22-01` の指示書発行前に埋めるか、`M22-01` の Plan Mode で確認するかは設計卓の判断 | **新規** |
| 11-2 | `conflict-error-code-inconsistency` | 同一の楽観排他衝突に対し、`combos` 系が `conflict`、`setups` 系が `version_conflict` を返す。フロントの 409 判別は `web/src/features/setup/errors.ts` が setups 側のみを持つ | 本レポート A-3 / §8-3。`internal/api/combo/handler.go:330,377` ／ `internal/api/setup/handler.go:196` | `M22` の粒度論点（`M22-overview` §4.2）と同じ面。契約に触るため設計卓の判断が要る | **新規** |
| 11-3 | `des002-4-2-lacks-conflict-contract` | `DES-002` §4.2 に版不一致時のステータス・エラーコードの規定が無く、実装との照合ができない（§6.4 は方針の一文のみ） | 本レポート A-3 / §9-B-5。§4.2（127〜198 行）に `楽観|version|409` を走査した結果 | 設計書の改訂は設計担当の手番。`M22-01` で粒度を決める際に同時に書き足す候補 | **新規** |
| 11-4 | `csrf-design-vs-implementation-gap` | `DES-002` §4.4 が定める CSRF 対策 2 本（SameSite=Strict Cookie ／ `X-Requested-With` の要求）が、いずれも実装に存在しない | 本レポート E-3 / §9-B-1 / §9-B-2 | **`M22` の軸 E の面そのもの**。方式の決定は開発者の承認事項（`D-386 (4)`） | **新規**（既存に CSRF 関連行があれば更新） |
| 11-5 | `config-toml-example-vs-supp001-5-8` | `config.toml.example` と `SUPP-001` §5.8 の例が 6 グループで食い違う。とくに `[defaults]` が example にだけ無い | 本レポート D-4 / §8-5 | 配布物の既定値の話であり、`2026-08-15` の改善レーン第 1 束 横断課題 5（`port = 47318` と `BASE_DEV_PORT = 47320` の不一致）と同じ面 | **既存行の更新候補**（改善レーン横断課題 5 と束ねられる可能性） |
| 11-6 | `user-package-stubs-since-m6` | `internal/{api,service,repository}/user/` が `doc.go` のみの空パッケージとして 3 レイヤ分残り、`migrations/000007` のヘッダが「M6 着手時にウィザード経由生成へ切り替える」と宣言したまま切り替わっていない | 本レポート C-4 / §8-2 / §9-B-7 | **`M22` が触る面**（利用者の扱いを決める先）。設計卓が `M22-01` の設計判断に含めるかを決める | **新規** |
| 11-7 | `combo-editor-version-zero-fallback` | `ComboEditor.buildPatchPayload` が `initial` 不在時に `version: 0` を送る。`combos.version` は `NOT NULL DEFAULT 1` で `0` の行は生成経路が無い | 本レポート A-6 / §8-4。`web/src/features/combo/components/ComboEditor.tsx:237` | フロント側の局所修正の候補。ただし**現在この経路が実行されうるかは本調査では判定していない** | **新規** |
| 11-8 | `updated-at-version-desync-on-recipe-cache` | `recipe_cache` の更新が `combos.updated_at` を進めるが `version` を進めない経路が 3 本ある | 本レポート A-4 / §8-7。`internal/repository/combo/repository.go:205, 1335, 1345, 1355` | `M22` の粒度論点（`M22-overview` §4.2）の材料 | **新規** |
| 11-9 | `qr-already-implemented-m22-06-scope` | 指示書 §0.4 が `M22-06`（QR）の前提として F-4 を「依存が入っているか」と設定しているが、実装済み・配線済みである | 本レポート F-4 / §8-1 | **`M22-06` のスコープ確定**（`M22-RESEARCH-01` §9-4 が「開発者の指示を待って発行」としている指示書）。設計卓の起票判断 | **新規** |
| 11-10 | `pnpm-audit-wait-frontend-deps` | `/app_build_check` が **WAIT**（`nanoid` high×2 ／ `postcss` high×1 + moderate×1 ／ `react-router` 系 moderate×2 ／ `react-router-dom` moderate×1） | 本レポート G-6 | **`M22` のスコープ外**（依存更新の判断は開発者。`CLAUDE.md` §6）。記録として残す | **新規**（既存に依存更新の行があれば更新） |

---

## §12 ■ 併せて更新が要るもの

| # | 対象 | 内容 |
|---|---|---|
| 1 | `docs/progress/progress-log.md` | **索引行の追記**（本調査の日付・作業 ID・結果・報告書リンク ＋ 横断課題）。指示書 §0.2 の書き込み例外 2 ／ §6 DoD-5 ／ `CLAUDE.md` §8 の常設要求。**本レポートと同時に実施する** |

**上記 1 件以外に、併せて更新が要るものは無い。**

- 設計書（`docs/design/` 配下）の改訂は**設計担当の手番**であり、本調査は 1 バイトも触っていない（§9-B に矛盾として列挙するに留めた）。
- `docs/handover/followup-backlog.md` は **`D-382` により製造が編集しない**。候補は §11 に置いた。
- CHANGE 番号・マイグレ連番の消費は **0 件**（本調査は read-only）。
- `docs/handover/code-facts.md` の再生成は**不要**（本調査はコードを 1 行も変えていない）。

---

## 付録: 本レポートの走査コマンド一覧（再現用）

```bash
# §0 メタ
git rev-parse HEAD; git status --porcelain; git log -1 --format='%H %ad %s' --date=iso
find / -name "*.db" -not -path "*/node_modules/*" -not -path "/proc/*" -not -path "/sys/*" 2>/dev/null
command -v sqlite3

# 軸 A
grep -rn 'json:"version"' internal/ --include=*.go
grep -rn "ErrConflict" internal/ --include=*.go | grep -v "_test.go"
grep -rniE "StatusConflict|409|version_conflict|conflict" internal/ --include=*.go | grep -v "_test.go"
grep -rn "version = version + 1" internal/ --include=*.go | grep -v _test
grep -rn "UPDATE combos" internal/ --include=*.go | grep -v "_test.go"
grep -rn "UPDATE setups" internal/ --include=*.go | grep -v "_test.go"
grep -rn "^func Test" --include=*_test.go internal/ | grep -iE "conflict|version|optimist"
grep -n "StatusConflict\|409\|ErrConflict" internal/api/combo/*_test.go
awk 'NR>=127 && NR<=198 {if ($0 ~ /楽観/ || $0 ~ /version/) print NR}' docs/design/02-architecture.md
grep -rn "version" web/src/ --include=*.ts --include=*.tsx | grep -viE "\.test\.|appVersion|schemaVersion"
grep -rn "queryKey" web/src/features/combo/ web/src/features/setup/ --include=*.ts --include=*.tsx | grep -v "\.test\."

# 軸 B
for f in internal/api/*/routes.go; do echo "--- $f ---"; grep -nE "\.(GET|POST|PUT|PATCH|DELETE)\(" "$f"; done
grep -rn "c.Bind(&" internal/api/ --include=*.go | grep -v "_test.go"
grep -rhoiE "(INSERT( OR IGNORE| OR REPLACE)? INTO|UPDATE|DELETE FROM)[[:space:]]+[a-z_]+" internal/ --include=*.go | sort | uniq -c | sort -rn
grep -rn "version" migrations/*.sql | grep -viE "^\S+:-{2}"
grep -rn -A 14 "CREATE TABLE combo_setups\|CREATE TABLE combo_setup_results" migrations/*.sql

# 軸 C
ls -la internal/api/user/ internal/service/user/ internal/repository/user/
grep -rniE "user_?id|userID|UserID|defaultUser" internal/ cmd/ --include=*.go | grep -v "_test.go"
grep -rn "user_id" migrations/*.sql
grep -rn -i "insert into users\|INTO users" migrations/
awk '/^CREATE TABLE combos \(/,/^\);/' migrations/000001_init_schema.up.sql | grep -c "user_id"
grep -rniE "session|cookie|login|logout|bearer|authorization|authenticate|jwt|bcrypt|argon2|scrypt|password" \
  internal/ cmd/ --include=*.go | grep -viE "passwordEnabled|password_enabled|PasswordHash|password_hash"
grep -rniE "session|cookie|login|logout|bearer|authorization|credentials|token" web/src/ web/e2e/ --include=*.ts --include=*.tsx

# 軸 D
grep -n -A 12 "type SecurityConfig" internal/config/config.go
grep -rn "PasswordEnabled" . --include=*.go --include=*.ts --include=*.tsx --include=*.toml | grep -v node_modules
grep -rn "password_enabled" . --include=*.go --include=*.ts --include=*.tsx --include=*.toml --include=*.json --include=*.sql | grep -v node_modules
cat config.toml.example
sed -n '1044,1076p' docs/design/supp-001-detailed-design.md > /tmp/supp58.toml && diff -u /tmp/supp58.toml config.toml.example

# 軸 E
grep -rn "\.Use(" cmd/ internal/ --include=*.go | grep -v "_test.go"
grep -rn "^func [A-Z]" internal/api/middleware/*.go | grep -v _test
grep -rni "csrf" --include=*.go --include=*.ts --include=*.tsx --include=*.toml --include=*.json --include=*.md . | grep -v node_modules | grep -v "docs/"
grep -rniE "samesite|setcookie|document\.cookie" --include=*.go --include=*.ts --include=*.tsx . | grep -v node_modules
grep -rn "X-Requested-With" --include=*.go --include=*.ts --include=*.tsx . | grep -v node_modules

# 軸 F
cat web/src/pages/SettingsPage.tsx
for f in web/src/features/config/SettingsSection*.tsx; do grep -nE "<h2|<button|<select|disabled" "$f"; done
grep -n "^func [A-Z]\|^var [A-Z]\|^const" internal/infra/netutil/private_ip.go internal/infra/netutil/port.go
grep -rn -i "qrcode\|qr-code" web/package.json web/pnpm-lock.yaml
grep -rn -i "qr" web/src/ --include=*.ts --include=*.tsx

# 軸 G
cat go.mod
go version; go env GOMODCACHE
go list -m all
go mod graph | grep " golang.org/x/crypto@" | sort -u
sha256sum go.mod go.sum   # 前後で比較
GOFLAGS=-mod=readonly go mod download golang.org/x/crypto
ls "$(go env GOMODCACHE)/golang.org/x/crypto@v0.46.0/"
head -30 "$(go env GOMODCACHE)/golang.org/x/crypto@v0.46.0/LICENSE"
bash scripts/app-build-supplychain-check.sh
(cd web && pnpm audit)
```

---

*以上、M22-RESEARCH-01 調査レポート。read-only・judgement-free。読んだ commit = `8af2ca6afc3cc1e6a69e17c86c534b1b7ead7545`（作業ツリーはクリーン）。*
