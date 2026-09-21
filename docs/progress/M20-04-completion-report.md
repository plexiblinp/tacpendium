# M20-04 完了報告: プリセット管理 UI ＋ カスタムプリセット作成

| 項目 | 内容 |
|------|------|
| 作業ID | M20-04 |
| 対象指示書 | `docs/instructions/M20-04-preset-management-ui.md` v1.0.1 |
| 対のチェックリスト | `docs/instructions/reviews/M20-04-review-checklist.md` v1.0.1 |
| 対の CHANGE | `CHANGE-101`（2026-08-13 承認済み） |
| ブランチ | `claude/m20-04-implementation-plan-z1gxt9` |
| 着手前コミット | `2812a26` |
| 実施日 | 2026-08-13 |
| 消費マイグレ | **0 本**（disk 末尾は `000075_m20_preset_aliases_unique` のまま） |

---

## 1. 何を作ったか

**プリセットは M20-01〜03 で「読める・引ける・一意である」状態まで来ていたが、利用者は 1 つも操作できなかった。** 本サブはその操作面と、**`preset_aliases` へ書く最初の本番コード**を作った（`DES-004` §5.7 の投入経路の規約が初めて適用された箇所である）。

| 層 | 追加したもの |
|---|---|
| リポジトリ | 書き込み・詳細読み取り 13 メソッド（既存の読み取り 6 メソッドと既存 SQL 4 本は非改変） |
| サービス | **`internal/service/preset/` を新設**。CRUD ＋ 保護 ＋ 上限検査 ＋ コピー時のエイリアス実体化 ＋ 削除時の子行削除 |
| API | `POST /api/presets` ／ `PUT /api/presets/:id` ／ `DELETE /api/presets/:id` ／ **`GET /api/presets/:id/aliases`**（§7.2 参照） |
| 画面 | `/presets`（一覧）と `/presets/:id/edit`（編集）。Header・ホーム・設定のリンクを有効化 |

変更規模: **32 ファイル / +3,767 / -99**。

---

## 2. §3.3 着手前実査の結果（9 項目・実測値付き）

| # | 確認事項 | 実査結果 |
|---|---|---|
| **1** | `/presets` の現況 | **ルート定義なし**（`web/src/router.tsx` に記載 0 件）。Header は `Header.tsx:31` で `disabled: true, tooltip: "今後実装予定"`。**ページ実体なし**。加えて `SettingsSectionPresetLink.tsx` の遷移ボタンと `HomePage.tsx` のカードも `disabled` 固定だった（**指示書の見込みに無かった 2 箇所**） |
| **2** | 3 層の現況 | **api**: `List` / `Get` の 2 本のみ。**service**: `doc.go` のみ（**公開メソッド 0**）。**repository**: 読み取り 6 メソッドのみ。**書き込み 0 件を確認**（指示書の見込みどおり） |
| **3** | `presets` の行 | **3 行・id = 1 / 3 / 5（2 と 4 は欠番）**。`migrate_m2001_test.go:131` の U-3 が欠番を固定済み |
| **4** | `preset_aliases` の列・制約 | 列＝`id` / `preset_id` / `move_id` / `alias_text` / `alias_text_en`(000070・nullable) / `character_id`(000074・**nullable**)。UNIQUE 3 本＝`(preset_id, move_id)` ／ `ux_preset_aliases_preset_char_alias` ／ 部分索引 `ux_preset_aliases_preset_char_alias_en`。**★既存のリポジトリ層 SQL 4 本はいずれも 4 列しか SELECT しておらず、`character_id` / `alias_text_en` を扱う経路が 1 本も無かった**（指示書の見込みに無かった事実。コピー実装は新規 SQL が必須になった） |
| **5** | **★カスタムプリセットで表示すると何が起きるか** | **壊れない。停止条件 1 は不発動。** 根拠＝`notation/cache.go:16` `ResolveComboRecipe` が**キャッシュミス時に `ComputeSingleCache` で遅延計算して書き戻す**。エイリアスは `resolver.go:76` が DB から直接引く（① 当該 preset → ② `base_preset_code` → ③ `official_ja_move` → ④ `moves.code`）。**コンボ一覧は `model.ExtractDefaultRecipe` が `DefaultPresetID = "1"` 固定で読む**ため、カスタムの有無に影響されない。**E2E でも実測して固定した**（§4 の 7 本目） |
| **6** | `config` の `[defaults] preset_id` | `config.go:88`。検証は `>= 1` のみで**実在確認なし**。config は TOML 側の状態で DB を見ない。`configsvc.Update` は `*s.cfg = next`（`service.go:175`）で main が握る `*Config` を書き換えるため、**main のポインタ越しに読めば常に最新** |
| **7** | `PRAGMA foreign_keys` | **P-04 は現存**。`infra/db/db.go:42` が接続取得時に発行するが**接続単位**でプール全体には効かない。**★ただし実測では FK=ON の接続を引く場合がある**（§7.5 に重要な帰結あり） |
| **8** | 組み込みエイリアス総数 | **一時 DB へ v75 まで適用して再実測（2026-08-13）**: `official_ja_move` **1,653** / `numeric` **1,245** / `srk` **1,260** ＝ **合計 4,158 行**。`numeric` の `alias_text_en` 非 NULL は **38 行**。**⇒ コピー 1 回で最大 1,653 行を 1 トランザクションで INSERT する**。所要は E2E 実測で 1 回あたり体感 1 秒未満（7 本の spec 全体で 14.7 秒） |
| **9** | `migrations/` の disk 末尾 | **`000075_m20_preset_aliases_unique`**。**0 本消費で完了**（§7.1 参照） |

### 停止条件の判定

| # | 条件 | 判定 |
|---|---|---|
| 1 | カスタムプリセットで表示が壊れる | **不発動**（§3.3-5。遅延計算で正しく表示される。E2E で固定済み） |
| 2 | 一意制約でコピーが通らない | **不発動**。コピーは `preset_id` だけを差し替えて `(character_id, alias_text)` を保つため、**ベースに違反が無ければ複製にも無い（構造的に保証）**。実測でも 3 種すべてコピー成功 |
| 3 | 他ドメインへの変更が要る | **不発動**（preset ドメインに閉じた） |
| 4 | マイグレが要ると判断した | **不発動**（§7.1 の判断で回避した） |

---

## 3. 実装の要点

### 3.1 コピー時のエイリアス実体化（§4.3・最重要）

```sql
INSERT INTO preset_aliases (preset_id, move_id, alias_text, alias_text_en, character_id)
SELECT ?, move_id, alias_text, alias_text_en, character_id
FROM preset_aliases WHERE preset_id = ?
```

**`character_id` を明示的に列挙している**（`DES-004` §5.7-1）。同列は nullable であり、入れ忘れても INSERT は通るうえ `UNIQUE(preset_id, character_id, alias_text)` にも当たらない。**落ちないため、テストが無ければ誰も気づけない。**

**1 トランザクション**で ①上限検査 → ②ベース解決 → ③名前重複検査 → ④`presets` INSERT → ⑤全行複製 → commit。

**`presets.id` は AUTOINCREMENT に任せている。** 欠番（2 / 4）を詰める処理は 1 つも書いていない。

### 3.2 保護（§4.4）

**すべてサービス層の `authorizeMutation` が門番である。** UI で操作を出さないだけにしていない——**E2E が API 直叩きで 403 を確認している**（`web/e2e/m20-04-preset-management.spec.ts` の 2 本目）。

| 検査 | 実装位置 |
|---|---|
| VAL-P01（組み込みは編集も削除も不可＝**D-290**） | `service.go` `authorizeMutation` → `ErrBuiltinProtected` → **403** |
| VAL-P02（エイリアス空） | `Update` の事前検証 → 400 |
| VAL-P03（名前の一意性・同一ユーザー内） | `Create` / `Update` → 409 |
| VAL-P04（ベースが実在し**組み込みである**こと） | `Create` → 400 |
| VAL-P05（**全体 8 件**。★1 ユーザーあたりの上限は設けない） | `Create` の**トランザクション内**カウント → 409 |
| VAL-P07（他ユーザーのものは参照のみ） | `authorizeMutation` → 403 |

### 3.3 削除（§4.5・P-04 の回避）

**CASCADE に頼っていない。** サービス層で `DeleteAliasesByPresetTx` → `DeletePresetTx` の順に、1 トランザクションで消す。

**★実装の形そのものをテストで固定した**（§7.5 の理由による）。

### 3.4 `config` 参照時の扱い（§4.5-4・D-313）

**削除を拒否する**（409 `preset_in_use_by_config`）。設計卓の見込みどおり。`presetsvc.New` の第 3 引数へ `func() int64 { return cfg.Defaults.PresetID }` を注入している（**config パッケージへ依存させないため**＝§2.3 の「横断ヘルパを作らない」に整合）。

---

## 4. テスト結果

| 区分 | 結果 |
|---|---|
| `go test ./...` | **全緑。ok 47 パッケージ / FAIL 0**（テストなし 10 パッケージ） |
| `cd web && pnpm test` | **全緑。134 ファイル / 1,115 件** |
| `pnpm lint`（= `tsc --noEmit`） | **exit 0** |
| E2E | **`make e2e` フルスイート exit 0 ／ 79 passed ／ 1 flaky（既知の `SQLITE_BUSY`・本サブ外）／ 1.8 分**。本サブの 7 本は green |

### 指示書 §5 (a)〜(j) の対応

| 区分 | 実装位置 |
|---|---|
| (a) コピーの件数一致 | `service_test.go` `Test_Create_CopiesAllAliases` |
| **(b) ★`character_id` NULL 0 件** | 同上 ＋ `write_repository_test.go` `TestRepository_CopyAliasesTx` ＋ **E2E**（3 経路で固定した） |
| (c) 一意制約 | `Test_UniqueConstraint_RawErrorNamesIntendedColumns`（**生のエラー文字列に `preset_aliases.preset_id` / `.character_id` / `.alias_text` が出ることまで確認**）＋ `Test_Update_AliasConflictIsNotAnInternalError` |
| (d) 保護・削除 403 | `Test_Delete_BuiltinIsProtected` ＋ `TestHandler_Delete_BuiltinIsForbidden` ＋ E2E |
| (e) 保護・編集 403 | `Test_Update_BuiltinAliasEditIsProtected`（**サービス層で拒否されること**）＋ `TestHandler_Update_BuiltinIsForbidden` ＋ E2E |
| (f) 上限 | `Test_Create_EnforcesTotalLimit`（8 件目まで通り 9 件目が拒否・**別ユーザーでも拒否**）＋ `TestHandler_Create_LimitExceeded_409` ＋ E2E |
| (g) 削除・孤児 0 件 | `Test_Delete_LeavesNoOrphanAliases` ＋ **`Test_Delete_DeletesChildrenExplicitly`**（§7.5） |
| (h) トランザクション | `Test_Create_RollsBackEverythingOnFailure`（`CopyAliasesTx` に失敗を注入し、`presets` 行が 1 つも残らないことを確認） |
| (i) `presets.id` の欠番 | `Test_Create_CopiesAllAliases` の後半 ＋ `TestRepository_CreatePresetTx_DoesNotReuseGap` |
| (j) 非回帰 | `TestHandler_ReadRoutes_Unchanged`（**応答のキー集合が増えていないことまで確認**）＋ 全スイート緑 |

### E2E の実行環境について（`remote-ops.md` §5.1 の 3 点報告）

**【2026-08-13 追補・★当初の報告を 2 点とも訂正する】**

| 項目 | 結果 |
|---|---|
| **`make e2e` フルスイート** | **exit 0 ／ 79 passed ／ 1 flaky ／ 1.8 分で完走**（本サブの 7 本を含む全 80 件） |
| flaky の中身 | `m19-03-setup-results.spec.ts` の `insert setup: database is locked (5) (SQLITE_BUSY)`。**既知の flaky**（progress-log「E2E の 4 flaky は `SQLITE_BUSY`」）で**本サブが触っていない面**。retry で green |
| 開発者機での完走可否 | **★当初は 1 件失敗した**（下記「開発者機で落ちた原因」）。**原因を特定して修正し、2026-08-13 に開発者機での `make e2e` 成功を確認済み** |

#### ★訂正 1: 「クラウド実行環境では `make e2e` が完走しない」は誤りだった

当初 `make e2e` が**広範囲に失敗**したため `cloud-e2e-browser-mismatch` と判断したが、**誤りである。** 真因は**前段の smoke test で起動したバックエンドが E2E ポート 47390 を掴んだまま残っていたこと**——直後の単体実行が `http://localhost:47390 is already used` を明示的に返しており、**E2E スタックが自分のサーバを起動できずに全滅していた**。

残プロセスを落としてから回すと、**同じ環境で 1.8 分・exit 0 で完走する。**

> **★これは `remote-ops.md` §5.1 が名指しで警告している型そのものである**——「**サブの失敗を環境要因として流さない**。両方向に注意する」。**既知事象の分布に似ていたので当てはめてしまった。** 切り分け手順 1「失敗が広範囲に散っていれば環境要因を疑う」は**必要条件でしかなく、「E2E スタック自身が起動できていないか」を先に見るべきだった。**

#### ★訂正 2 ＝ 開発者機で落ちた原因（**本サブ起因。修正済み**）

**症状**: `web/e2e/m20-04-preset-management.spec.ts:113` で `getByTestId('alias-input-1106')` が現れない。**初回・retry とも再現。**

**根本原因**: **spec の前提が誤っていた。**

- spec は `GET /api/presets/{id}/aliases?character_id=1`（ryu 直書き）でエイリアスを引き、`aliases[0].moveId`（= **1106 / `ryu` の `ca_shin_shoryuken`**）の入力欄を探していた。
- **`PresetEditPage` の初期キャラは `config` の `[defaults] character_id` である**（`useConfig` から初期化。`PresetEditPage.tsx:60-65`）。
- **`config.toml` は `.gitignore:72` で管理外であり、開発者ごとに値が違う。** 既定キャラが ryu でない開発者の環境では、**画面は別キャラのエイリアスを描画するため、ryu の `alias-input-<moveId>` は永遠に現れない。**

**⇒ 製造側の環境（`character_id = 1`）でだけ通る spec だった。** `character_id = 5` に変えて**同一の失敗を再現**し、修正後に**再現構成でも元の構成でも 7/7 green** であることを確認した。

**製品側は正しい。** 編集画面が config の既定キャラで開くのは設計どおりの挙動であり、**変更していない。**

**修正（`web/e2e/m20-04-preset-management.spec.ts` のみ）**:

| # | 内容 |
|---|---|
| 1 | **キャラを `code` から解決する**（`GET /api/games/1/characters` → `ryu`）。**id を直書きしない** |
| 2 | **編集画面のキャラを利用者と同じ操作で明示的に選ぶ**（`selectEditorCharacter`。`getByLabel("編集するキャラクター")` → `getByRole("option")`）。**`moves-edit.spec.ts:69-70` と同型。** 初期表示のキャラを仮定しない |
| 3 | **（別件・あわせて是正）開発者の `[defaults] preset_id` を書き換えたままにしない。** `beforeAll` で退避し `afterAll` で復元する。**既存 `m18-*` spec が `cfg.defaults?.presetId ?? 1` で保存しているのと同趣旨**で、本 spec だけが規約から外れていた |

**3 の検証**: `preset_id = 3` / `character_id = 5` に設定して全 7 本を実行し、**実行後も `preset_id = 3` / `character_id = 5` のまま**であることを確認した。

### §4.8 否定形確認（最終コード状態で実施）

**検査した範囲**: `internal/` ／ `cmd/` ／ `web/src/` ／ `web/e2e/`（`*.go` / `*.ts` / `*.tsx`。**テストコードを含む**）。

| 走査キーワード | 見つかった件数 | 判定 |
|---|---|---|
| 「組み込みプリセットが 5 個」前提の記述・分岐 | **残骸 0 件**（ヒット 8 件はすべて「組み込み 3 ＋ カスタム 5 = 8」または「5 種 → 3 種へ整理した」という**正しい記録**） | ○ |
| 上限を 10 件とする記述 | **残骸 0 件**（ヒット 14 件はすべて CSV 展開上限 10MiB・コンボ一覧 limit・エクスポート選択上限など**別ドメイン**） | ○ |
| 「組み込みプリセットのエイリアスは編集可能」に相当する記述・分岐 | **残骸 0 件**（ヒット 2 件はいずれも**編集不可が正**であると述べている側） | ○ |
| `ON DELETE CASCADE` に依存した削除 | **残骸 0 件**（ヒット 15 件はすべて「頼らない」と述べるコメント、またはマイグレ側の DDL 記述） | ○ |

**★本サブで実際に見つかり是正した失効記述は別にある**（§6）。上表の 4 キーワードでは検出できない種類だったため、**画面遷移の実在性を起点に手で探した。**

---

## 5. 品質チェック（§7.3）

- [x] `pnpm lint` exit 0
- [x] `console.log` / `fmt.Println` の**本サブ由来の**混入 **0 件**（`cmd/seedgen/main.go` の 2 件は既存の CLI 出力であり、本サブの diff は 0）
- [x] `any` / `@ts-ignore` / `eslint-disable` / `nolint` の追加 **0 件**
- [x] **`internal/service/punishfinder` ／ `internal/service/setplay` の diff 0**
- [x] **`web/src/features/gamepad/` ／ `web/src/features/setup/` の diff 0**（`M21-03` と並走＝**D-351**）
- [x] **`migrations/` の diff 0**（実査済み。末尾は `000075`）
- [x] **`scripts/` ／ `docs/design/` の diff 0**
- [x] **`moves` テーブルの diff 0**（行も列も）
- [x] **ブラウザストレージの新規キー 0 件**（台帳更新不要。`check-browser-storage-keys.sh` 緑）

### 機械検査

| 検査 | 結果 |
|---|---|
| `check-artifact-integrity.sh` | **緑**（★下記の注記あり） |
| `check-doc-refs.sh` | 緑 |
| `check-browser-storage-keys.sh` | 緑（台帳 8 件 / 実装 7 件・一致） |
| `check-enum-sync.sh` | 緑（ベースラインどおり・増加なし） |
| `check-md-emphasis.sh` | 緑（**現在 373 行 / ベースライン 375 行**。2 行減少しており、スクリプトの `BASELINE_BROKEN` を 373 へ下げてよい状態。**`scripts/` は diff 0 の対象のため本サブでは触っていない**） |
| `check-doc-inventory.sh` | 情報提供（exit 0） |
| `check-progress-log-index.sh` | 緑（§8 で追記後に実行） |
| `check-stop-discipline.sh` | 緑 |

> **★`check-artifact-integrity.sh` は最初に回したとき赤だった。** `check-md-emphasis.sh --self-test` が不合格を返しており、原因は**クラウド実行環境に `markdown-it-py` が入っていなかったこと**である（スクリプト自身は「依存欠落時は緑を返さない」と正しく振る舞っていた）。`pip install markdown-it-py` で解消し、再実行で緑。**本サブの変更に起因するものではない**（`scripts/` の diff は 0）。**⇒ クラウド実行環境では `markdown-it-py` の導入が要る。** 環境セットアップの課題として §9 へ上げる。

---

## 6. ★否定形確認で見つかり是正した失効記述

**指示書 §4.8 の 4 キーワードには当たらないが、本サブが実装したことで即座に失効した記述が 5 箇所あった。**

| # | 場所 | 何が失効したか |
|---|---|---|
| 1 | `web/src/components/Header.tsx:31` | `disabled: true, tooltip: "今後実装予定"` |
| 2 | `web/src/features/config/SettingsSectionPresetLink.tsx` | ボタンが `disabled` 固定 ＋ `notImplemented` ツールチップ |
| 3 | **`web/src/pages/HomePage.tsx:15-20`** | プリセットのカードが `enabled: false` ＋ `notImplemented` ツールチップ（**指示書 §2.1 の表に無かった箇所**） |
| 4 | `web/src/locales/ja.json` / `en.json` | `settings.presetLink.notImplemented` の i18n キー（**参照が 0 になった**ため削除） |
| 5 | `internal/model/preset.go:19-22` | 「★この上限を強制する実装は現時点で存在しない…実装対象は M20-04 以降である」「SUPP-001 §7.3 は 10 件のままであり一時的に食い違う」 |

**これらを守っていた既存テスト 5 本は、期待値を緩めるのではなく主張を作り替えた**（`D-308` と同じ扱い）。

- `Header.test.tsx`: 「disabled でツールチップ表示」→「有効で `/presets` へ遷移できる」
- `Header.test.tsx` × 2: 「現在ページと disabled 表示の区別」→「現在ページと**通常リンク**の区別」（★色名の部分一致で判定していたが、通常リンクにも `hover:text-blue-600` が付くため `font-bold` / `pointer-events-none` / `aria-current` で判定するよう是正した）
- `HomePage.test.tsx`: 「preset button is disabled with tooltip」→「links to /presets」
- `SettingsPage.test.tsx` × 2: 「disabled」→「enabled link to /presets」

### ★あわせて削除したもの: Header の `disabled` 分岐

**「プリセット管理」が `NAV_LINKS` で最後の `disabled` リンクだった。** 有効化した結果、`NavLink.disabled` / `tooltip` と `span + cursor-not-allowed` の分岐（PC nav とモバイル Sheet の 2 箇所）が**到達不能**になった。

**⇒ 削除した。** 理由＝(a) 到達不能な分岐はテストで動かす手段が無い（`NAV_LINKS` はモジュールスコープの const であり注入できない）、(b) 残すと「未実装リンクを置ける」という**実際には検証されていない前提**が次の担当へ引き継がれる。再び未実装リンクが要るときは Git 履歴から戻せる。

> **★これは §2.1 の表に無い変更である**（テンプレート §2.2 の記入指針・**D-348** により、禁止列に当たらないため実施した）。**判断そのものは開発者・レビューの確認対象として上げる。**

---

## 7. ★設計書との差分・独自判断（`CHANGE-101` の反映に必要な as-built）

### 7.1 `DES-005` §5.10 の「作成日」を表示していない（**要設計卓判断**）

**`presets` テーブルに `created_at` が存在しない。** `migrations/000001_init_schema.up.sql:131-138` の DDL は `id` / `user_id` / `code` / `name` / `base_preset_code` / `is_builtin` の 6 列のみで、`DES-003` §3.8 にもタイムスタンプ列の定義が無い（`internal/model/preset.go` のコメントが明記している）。

**⇒ 列を足さず、作成日を表示しない。** 理由＝(a) **マイグレは自採番しない**（**D-293**）、(b) `CHANGE-101` §1 が「**スキーマを変えない**」ことを非破壊性の根拠にしている。

**設計卓への依頼**: `DES-005` §5.10 の表示項目から「作成日」を落とすか、列追加のマイグレを払い出すかを決めてほしい。**本サブは前者を前提に実装した。**

### 7.2 `GET /api/presets/:id/aliases` を新設した（**§4.2 の 3 本に無い**）

**編集画面（`DES-005` §5.11「エイリアス一覧、キャラ別にグループ化、編集可能」）を実装する手段が 1 つも無かった。** `GET /api/presets/:id` はプリセットのメタ情報しか返さない。

**⇒ 読み取り 1 本を足した。** `character_id` を**必須**にしている——1 プリセットのエイリアスは最大 1,653 行あり、全件を 1 応答で返すべきではない。`limit` は一覧画面のサンプル表記プレビュー用（4 件）。

**契約**:

| 項目 | 内容 |
|---|---|
| パス | `GET /api/presets/:id/aliases?character_id=N[&limit=M]` |
| 応答 | `[{ moveId, moveCode, moveCategory, characterId, aliasText, aliasTextEn?, officialAliasText? }]` |
| `officialAliasText` | `official_ja_move` の同 move のエイリアス（公式技名）。**`moves` に技の表示名カラムが無いため**（`SUPP-001` §7.3）、記法プリセットの編集画面で「どの技の欄か」を判別する唯一の手掛かりになる |
| エラー | `character_id` 欠落・不正 → 400 ／ 存在しない `id` → 404 |

### 7.3 API 3 本の契約（as-built）

| メソッド | パス | ボディ | 成功応答 |
|---|---|---|---|
| `POST` | `/api/presets` | `{ basePresetCode, name }` | **201** ＋ `PresetResponse` |
| `PUT` | `/api/presets/:id` | `{ name?, aliases?: [{ moveId, aliasText }] }`（**部分更新**） | **200** ＋ `PresetResponse` |
| `DELETE` | `/api/presets/:id` | — | **204** |

**エラーの形**（`model.APIErrorResponse`）:

| 状況 | HTTP | code | details |
|---|---|---|---|
| 組み込みの編集・削除 | **403** | `builtin_protected` | — |
| 他ユーザーのカスタム | 403 | `forbidden` | — |
| **上限 8 件超過** | **409** | `preset_limit_exceeded` | `{ limit: 8 }` |
| 名前重複 | 409 | `preset_name_duplicate` | — |
| **表記衝突（一意制約違反）** | **409** | `alias_conflict` | **`{ aliasText: "<衝突表記>" }`** |
| プリセット名が空 | 400 | `preset_name_empty` | — |
| ベースが不正 | 400 | `invalid_base_preset` | — |
| エイリアスが空 | 400 | `alias_text_empty` | — |
| 当該プリセットに無い move | 400 | `alias_move_not_found` | — |
| `config` が参照中 | 409 | `preset_in_use_by_config` | — |
| 存在しない `id` | 404 | `not_found` | — |

> **★一意制約違反は 500 にしていない**（**D-275** と同型）。**メッセージ本文と `details.aliasText` の両方に衝突表記を載せている**ため、利用者はどの表記を直せばよいか分かる。

**★既存の `GET /api/presets` / `GET /api/presets/:id` は応答の形もキー集合も 1 バイトも変えていない**（`TestHandler_ReadRoutes_Unchanged` が固定）。ハンドラの構築が `NewHandler(repo)` → `NewHandler(service)` に変わっただけである。

### 7.4 画面の as-built（`DES-005` §5.10・§5.11 との差分）

| 節 | 設計書の記述 | as-built |
|---|---|---|
| §5.10 表示項目1 | 「組み込みプリセット**5つ**（名称、サンプル表記プレビュー）」 | **3 つ**（`CHANGE-101` §2.1-a のとおり）。プレビューは**既定キャラの先頭 4 件のエイリアスを ` / ` で連結**して表示 |
| §5.10 表示項目2 | 「カスタムプリセット一覧（名称、ベースプリセット名、**作成日**）」 | 名称・ベースプリセット名のみ。**作成日は非表示**（§7.1） |
| §5.10 表示項目3 | 新規カスタムプリセット作成ボタン | 各組み込み行の「コピーして作成」として実装。**上限到達時は `disabled` ＋ 理由をツールチップと画面上部の告知の 2 箇所で表示** |
| §5.10 アクション | 「使用する」ボタン | 実装（既存の `PUT /api/config` の `defaults.presetId` を使う）。**現在適用中の行は「使用中」の表示に置き換わる** |
| §5.11 表示項目3 | 「エイリアス一覧（技ごと、**キャラ別にグループ化**、編集可能）」 | **キャラは選択式**（`CharacterSelector`）、**その中を技カテゴリでグループ化**。1 キャラ 77 行あり、カテゴリで束ねないと目的の技へ辿り着けないため |
| §5.11 | 編集できないものの明示 | 「ベースプリセット・連結子・未定義時のフォールバック挙動・技の追加削除は変更できません」を画面に明記 |
| — | — | **★`alias_text_en` の編集欄は作っていない**（`DES-004` §5.4 の生成規則が入れる列であり、編集しても次の seed 波の再適用で消える）。表示もしていない |
| — | — | **組み込みプリセットの編集画面は読み取り専用表示**（告知 ＋ 全入力を `disabled`）。**保護そのものはサービス層の 403 であり、これは案内である** |

### 7.5 ★`P-04` について実測で分かったこと（**設計卓・後続への申し送り**）

**`SUPP-001` §7.3 と指示書 §3.3-7 は「`PRAGMA foreign_keys` が接続プール全体に効いていない」と書いている。これは正しいが、片側だけの記述である。**

**実測（2026-08-13・`dbtest.Setup` 上）**:

- **`PRAGMA foreign_keys = 1` を返す接続を引く場合がある**（`Test_Delete_LeavesNoOrphanAliases` の実行で確認）。
- その接続では **`ON DELETE CASCADE` が実際に発火する**。
- さらに **`presets.user_id → users(id)` の FK も発火する**——実在しない `user_id` での `INSERT` が `FOREIGN KEY constraint failed (787)` で落ちた。

**⇒ 帰結が 2 つある。**

1. **「削除後に孤児行 0 件」の観測だけでは、CASCADE に頼っていないことを主張できない。** FK=ON の接続を引けば CASCADE が子行を消し、**CASCADE 依存の実装でもテストが緑になる**。**⇒ `Test_Delete_DeletesChildrenExplicitly` を追加し、サービス層が「子行 → 親」の順で明示削除していることを呼び出し順で固定した。** 指示書 §5 (g) が求めた検査は**そのままでは主張が成立しない**種類のものだった。
2. **カスタムプリセットの作成は `users` に `id = 1` の行が実在することに依存する。** 同行はマイグレ `000007_seed_initial_tags_user1` が投入している（`INSERT OR IGNORE INTO users (id, name) VALUES (1, 'default')`）。**`tags` も同じ構造の FK を持っており既存機能と同条件**だが、**P-04 が「FK は効かない」と読まれていると、この依存が見えない。**

### 7.6 ★`recipe_cache` の状態（§4.7・**`M20-05` の入口**）

**本サブは `recipe_cache` を読み書きしていない**（§2.2-1 のとおり）。**その結果、以下の状態になる。**

| 操作 | `recipe_cache` の状態 | 表示 |
|---|---|---|
| **カスタムプリセットを作成した直後** | **当該 `preset_id` のエントリは無い** | **壊れない。** `GET /api/combos/:id/recipe?preset_id=N` が `ResolveComboRecipe` でキャッシュミスを検出し、`ComputeSingleCache` で**遅延計算して書き戻す**。**E2E で実測固定済み** |
| **エイリアスを編集した直後** | **★古い値が残る**（遅延計算で一度書かれたエントリは、エイリアスを変えても更新されない） | **★stale な表記が出る。** フロント側は TanStack Query のキー `["combo"]` を無効化して再取得するが、**サーバーが返すのはキャッシュ済みの古い文字列である** |
| **カスタムプリセットを削除した直後** | **★当該 `preset_id` のキーが JSON 内に残る**（孤児キー） | 実害は無い（誰も引かない）が、`recipe_cache` の JSON が肥大する |
| コンボ一覧 | 影響なし | `ExtractDefaultRecipe` が `DefaultPresetID = "1"` 固定で読むため |

**⇒ `M20-05` が接続すべきトリガは 2 つである。**

1. **`Update`（エイリアス編集）の成功後に `notation.RecomputePresetCache(ctx, presetID)` を呼ぶ**——同メソッドは**既に存在するが、本番の呼出元が 0 件である**（テスト以外から呼ばれていない。`internal/service/notation/cache.go:94`）。
2. **`Delete` のトランザクション内で `notation.DeletePresetCache(ctx, tx, presetID)` を呼ぶ**——**同様に既存・呼出元 0 件**（同 `cache.go:151`）。**`*sql.Tx` を取る形なので、本サブの削除トランザクションへそのまま挿せる。**

> **★`architecture-patterns` §9.2 が「未実装なのはトリガを引く機能自体がフェーズ3 だから」と記す状態は、本サブで解けた。** トリガを引く面（プリセット編集 UI）が存在するようになった。**M20-05 は「層を作る」のではなく「既にある 2 メソッドを配線する」サブである**（`M20-overview` §3 の M20-05 の行が「preset サービス層の新設」と書いているのは不正確＝ボード **M-53** の是正どおり）。

### 7.7 ★`DES-004` §5.7-2 からの逸脱（レビュー指摘 D の取り込み）

**同項は「既存の生成器を通す。直接 INSERT する経路を増やさない」を義務づけ、理由を D-317 の交差条件（ある技の `alias_text` が、別の技の `alias_text_en` と一致する）が DB では守れず検査に残るためとしている。**

**本サブは 2 本の直接書き込み経路を新設した。**

| 経路 | 交差条件への影響 |
|---|---|
| **コピー**（`copyAliasesSQL`） | ベース行を verbatim 複製するため、交差条件はコピー元と同一に保たれる。**安全** |
| **編集**（`updateAliasTextSQL`） | **利用者が任意の文字列を入れられる。** 当初は `UNIQUE(preset_id, character_id, alias_text)` にも部分インデックスにも当たらず、**DB でもサービス層でも検出されない状態だった** |

**⇒ サービス層に交差検査を足して塞いだ**（`FindCrossingAliasEn` ＋ `Update` の事前検査 → `ErrAliasConflict`（409））。`Test_Update_RejectsCrossingWithAliasTextEn` が固定する。

> **★設計卓への申し送り**: `DES-004` §5.7 の規約は**「生成器を通す経路」だけを想定して書かれている。** seed 経路は `migrate_m2003_test.go` (g) が守っていたが、**利用者編集の経路には誰も検査を置いていなかった。** 同節へ「利用者編集の経路も交差検査を課す」旨を足すかの判断が要る。

> **★実測で分かったこと**: `alias_text_en` は `micro_forward` / `micro_back` の 2 code に入る**汎用語であり、全キャラで同一の文字列である**（「back microwalk」等）。したがって「別キャラなら同じ文字列を入れてよい」は成立しない——**別キャラへ入れるのも本物の交差である。**

### 7.8 ★`SUPP-001` §7.3 の残り半分（レビュー指摘 E の取り込み）

**同節は「M20-04 でプリセット作成 UI を作るとき、403 保護・上限検査・`config.preset_id` の実在確認（D-313）が同時に要る」としている。本サブが実装したのは削除側の拒否だけである。**

**`config` 側が実在しない `preset_id` を指せる状態は残っている**——`internal/service/config/service.go:227` の検証は `PresetID < 1` のみで DB 上の実在を見ない。⇒ (1) `config.toml` の手編集、(2) 本サブの経路を通らずに消えたプリセット、では依然として起動時に実在しない preset を引く。

**実装しなかった理由**: config サービスに DB 依存（プリセットリポジトリ）を持たせる変更になり、**指示書 §2.3（preset ドメインに閉じる）と §9.4 停止条件 3（他ドメインへの変更）の両方に当たる**。独断で他ドメインの依存関係を変えない。

**⇒ `followup-backlog` §J `preset-config-preset-id-existence` へ登録した。** `M20-05` が `SUPP-001` §7.1・§7.2 の as-built 是正を持つため、同サブで併せて扱うのが自然である。

### 7.9 その他の独自判断（§9.2 の範囲・報告のみ）

| # | 判断 | 根拠 |
|---|---|---|
| 1 | 一覧・編集画面のレイアウト | §9.2-1。PC テーブル / スマホカードの方針に従い `md` で切り替え |
| 2 | 上限超過・名前重複・表記衝突を **409** | §9.2-2。既存 `internal/api/tag/handler.go` が `tag_name_duplicate` / `tag_in_use` を 409 で返す流儀に合わせた |
| 3 | `config` 参照時は**削除を拒否** | §9.2-3。設計卓の見込みどおり |
| 4 | コピー既定名 =「`<ベース名>` のコピー」 | §9.2-4。**機械的な連番にしていない**——「コピー 2」のような機械名を既定にすると、そのまま残りやすい |
| 5 | 編集画面のグループ化 = **キャラ選択 ＋ カテゴリ束ね** | §9.2-5 |
| 6 | 新規プリセットの `code` = **`custom_<n>`** | `presets.code` は `NOT NULL UNIQUE` であり何かを割り当てざるを得ない。トランザクション内で既存の最大 `n + 1` を採る |
| 7 | コピー元は**組み込みに限る** | `DES-004` §6.1「組み込みプリセットをベースにコピー」。カスタムからのコピーは設計されていないため `ErrBaseNotFound`（400）で拒否する |
| 8 | `PUT` は**変更のあった行だけ**を送る | 1 キャラ 77 行 × キャラ数を毎回送らないため。差分判定はフロント側で `trim` して行う（空白だけの違いを変更と数えない） |

---

## 8. ■ 併せて更新が要るもの

| 項目 | 状態 |
|---|---|
| **消費した CHANGE 番号** | **なし。** 本サブは `CHANGE-101`（設計卓が 2026-08-13 に起票・承認済み）**に対応する製造であり、新規の CHANGE を起票していない**。⇒ `change-number-registry.md` §1 への登録は不要 |
| **その番号の写し先（4 か所）** | **該当なし**（新規採番が無いため） |
| **消費したマイグレ連番** | **なし。** `ls migrations/` の実査末尾は **`000075`** で、着手前と同一。ボード §2.2 の「次に払い出す番号」は **`000076` のまま**で正しい |
| **版を上げた文書の参照元** | **なし**（設計書は 1 文字も編集していない＝`docs/design/` の diff 0） |
| **ブラウザストレージ台帳** | **更新不要**（新規キー 0 件） |
| **`web/CLAUDE.md`** | 更新不要 |
| **★`scripts/check-md-emphasis.sh` の `BASELINE_BROKEN`** | **375 → 373 へ下げられる状態**（検査自身がそう出力している）。**`scripts/` は本サブの diff 0 対象のため触っていない。開発者手番** |
| **`followup-backlog.md` §J** | **3 件を登録した**（レビュー取り込みの結果）——`preset-config-preset-id-existence`（§7.8）／`preset-alias-swap-conflict`（表記を入れ替える編集が中間状態で 409）／`preset-config-unsynchronized-read`（`*config.Config` の無同期リード/ライト。**M20-04 が作った構造ではなく、読む利用者を 1 つ増やしただけ**）。`check-stop-discipline.sh` 緑 |
| **`docs/handover/code-facts.md`** | **失効している**（§305 / §339-340 / §406 が `/presets` を「未定義」「disabled」「読み取り 2 本」と記述）。**再生成が要る**（`/regen_code_facts`）。★製造が武装中に再生成すると差分が読めないため本サブでは実施していない |

---

## 8.5 レビューと取り込み（Phase B / C）

**レビューは fresh subagent（メイン会話文脈を継承しない独立エージェント）が実施した**。報告書＝`docs/progress/m20-04-review.md`。

| 判定 | 結果 |
|---|---|
| **チェックリスト §8 の差し戻し事由 9 件** | **1 件も該当なし** |
| 指摘 | **高 3 件 ／ 中 5 件 ／ 低 5 件 ＋ 補足 2 件** |
| 取り込み | **「高」の不採用 0 件（安全弁の発動なし）。** 高 3・中 5・低 5 のすべてを採用。**不採用は 1 件のみ**（i18n 未対応＝レビュー担当自身が「既存ページも混在しており踏襲の範囲」と判定） |
| 往復 | **1 回**（上限 2 回。停止規律に抵触なし） |

**取り込みで直した主なもの**（採否と理由の全件はレビュー報告書末尾「## 取り込み結果（自動トリアージ）」）:

1. **`api.ts` の invalidate コメントが事実と異なっていた**（撤回済み記述型・高）——「エイリアスを変えたら表示も変わる」は成立しない（`ResolveComboRecipe` が stale を返すため）。**M20-05 の担当が「クライアント側は済み」と読み違える形だった。**
2. **E2E の孤児行コメントと assertion が不一致だった**（高）——`expect(status).toBe(404)` は親の不在しか見ておらず、**子行が全件残っていても緑**になる。
3. **技カテゴリのラベル・順序が二重定義だった**（中）——`moves/types.ts` に既存があり、しかも `super_art`（SA / スーパーアーツ）・`rush_variant`（ラッシュ版 / ラッシュ派生）でラベルが、`throw` の位置で順序が食い違っていた。既存側へ寄せて 1 本にした。
4. **D-317 の交差条件に検査が無かった**（中）——§7.7 のとおり塞いだ。
5. **API 層 4 ファイル ＋ `main.go` のコミット漏れ**（中）——commit `5909377` で解消。

---

## 9. 開発者手番・残課題

### ★完了した項目（2026-08-13・開発者）

| # | 内容 | 結果 |
|---|---|---|
| — | **実機 1 周**（一覧 → コピー → 編集 → 保存 → 削除。手順は §9.1 の 2〜7） | **完了。** 開発者の「**想定通り動いていました**」は **1 周ができたという意味**（本人確認済み）。⇒ 指示書 §7.2 の最後の未達項目が閉じた。**★上限到達時の見え方・表記衝突の見え方は手順に含まれておらず、E2E でのみ確認している**（設計伝達レポート §3-1） |
| — | **開発者機での `make e2e`** | **成功。** §4「訂正 2」で是正した spec の修正が開発者機でも有効であることが確認された |

### 残っている項目（**いずれも設計卓・開発者の判断待ちであり、製造側の実装作業は無い**）

| # | 内容 |
|---|---|
| 1 | **`DES-005` §5.10 の「作成日」の扱いの決定**（§7.1） |
| 2 | **`Header` の `disabled` 分岐削除の是非**（§6 末尾） |
| 3 | **クラウド実行環境への `markdown-it-py` の導入**（§5 の注記。`check-artifact-integrity.sh` が赤になる） |
| 4 | `scripts/check-md-emphasis.sh` のベースライン更新（§8） |
| 5 | **`config.toml` 焼き付きの根治**（§9.1 の落とし穴 2。`PUT /api/config` の書き戻しから env 上書き項目を除外する。**config ドメインの変更のため製造は触らない**＝設計伝達レポート §4-7） |

### 9.1 実機 1 周の手順（★そのまま実行できる形にした）

> **指示書 §7.2 の DoD は「`go run ./cmd/combomgr` で起動し、実機で 1 周する」と書いているが、★その 1 行だけでは実行できない。** 手順を書くために起動経路を実査した結果、**空振りする落とし穴が 2 つ**見つかった。両方とも「気づけない形で失敗する」種類である。

#### ★落とし穴 1: `go run ./cmd/combomgr` 単体では画面が出ない

`embed_web_stub.go`（`//go:build !embed_web`）が `WebEmbedded = false` を返すため、**タグ無しの `go run` は API しか起動しない**。静的配信ハンドラもブラウザ自動起動も登録されない。⇒ 画面を触るには次のどちらかが要る。

| 経路 | コマンド | 性質 |
|---|---|---|
| **dev 2 プロセス** | `make run-server` ＋ 別端末で `make run-web`（Vite `:5173` が `/api` を proxy。転送先は `config.toml` の `[server].port` から自動解決） | **本手順はこちらを使う。** E2E が使っているのも同じ経路 |
| 配布バイナリ | `make build` → `./combomgr` | `-tags=embed_web` で `web/dist` を同梱。**SPA フォールバックを通る唯一の経路** |

**★配布バイナリ経路は製造側で検証済み**（下記）。**開発者手番は dev 経路での UI 操作である。**

#### ★落とし穴 2: `make e2e` の後は `config.toml` が E2E スタックに焼き付いている

**既知事象**（`docs/progress/progress-log.md:4085`。**2026-08-08 に dev DB へのマイグレ適用確認を 3 回空振りさせた前科がある**）。spec が `PUT /api/config` を呼ぶと、**ハンドラが実行時 cfg（＝env 上書き後の値）を起点に `config.toml` を丸ごと書き戻す**ため、E2E の `database.path` と `server.port` がファイルへ残る。

**本クラウド環境の実測（2026-08-13）**: `port = 47390` / `database.path = "web/e2e/.tmp/combomgr-e2e.db"`。**`config.toml` は `.gitignore:72` で管理外**のため git から復元できない。**復元先の正解は `config.toml.example`**（`port = 47318` / `path = ""`）。

#### 手順

**手順 0（★最初に必ず）** — `config.toml` の `[database].path` を見る。`web/e2e/.tmp/...` を指していたら `config.toml.example` の値へ戻す。**戻さずに始めると E2E の使い捨て DB を触ることになる。**

**手順 1** — **専用 DB** で起動する（`CHANGE-101` の承認条件＝既存データに触らない）。

```bash
COMBOMGR_DB_PATH=data/m20-04-manual.db make run-server
make run-web        # 別端末。ブラウザで http://localhost:5173/ を開く
```

**★`db path resolved` の `path` が意図した DB であることを目視する。** `migration completed` の version だけを見ない（前科の再発防止）。**★同ログは標準出力ではなく `logs/combomgr.log`（JSON）に出る**——コンソールには起動バナーしか出ない（2026-08-13 実測）。

**手順 2〜7** — 完了条件 §7.1 の 6 項目に 1 対 1 で対応する。

| # | 操作 | 見るもの |
|---|---|---|
| 2 | ヘッダ「プリセット管理」→ `/presets` | 組み込みが **3 つ**（5 つではない）／各行にサンプル表記が出る／カスタムは空／件数が `3 / 8` |
| 3 | 「SRK 記法」の**コピーして作成** | 既定名が「SRK 記法 のコピー」／作成後に件数が `4 / 8` |
| 4 | 作ったプリセットの**編集** | 名前が編集可／ベース名 `srk` は表示のみ／キャラを選ぶとエイリアスが**カテゴリ別**に出る／**英語表記の欄が無い**／技名の参照として公式技名が出る |
| 5 | 表記を 1 つ変えて**保存** → 一覧の「使用する」→ コンボ詳細 | 保存が通る／**レシピ表示が壊れない**（★§3.3-5）。**⇒ ただし編集した表記は反映されない。これは不具合ではない**（§7.6。本サブは `recipe_cache` を書かない＝M20-05 の所管） |
| 6 | 組み込みプリセットの編集画面を**直 URL で開く**（`/presets/1/edit`） | 読み取り専用の告知が出て入力が `disabled`（**保護そのものはサービス層の 403**であり、これは案内である） |
| 7 | 作ったプリセットを**削除** | 件数が `3 / 8` に戻る／**既定に設定中は削除が拒否される**（D-313。設定で別のプリセットを既定にしてから再試行できる） |

**手順 8（★終了時）** — 専用 DB（`data/m20-04-manual.db*`）を削除し、`config.toml` を元に戻す。

#### 製造側で検証済み（開発者手番から外してよい部分）

**配布バイナリ経路を実測した**（2026-08-13）。**E2E は Vite dev server 上で回っており、SPA フォールバックを一度も通っていなかった**ため、新規ルート 2 本の直 URL・リロード経路がここまで未検証だった。

```
make build → COMBOMGR_DB_PATH=data/... COMBOMGR_PORT=47401 ./combomgr
  /presets            200 text/html   ← SPA
  /presets/1/edit     200 text/html   ← ★SPA フォールバック(直 URL)
  /api/presets        200 application/json
  /api/no-such-route  404             ← ★API を SPA に飲ませていない
  POST /api/presets   201 (id=6・code=custom_1・ryu のエイリアス 77 件)
  DELETE 組み込み      403 ／ DELETE カスタム 204
```

**⇒ 配布形態でも書き込み経路・保護・SPA フォールバックが成立する。** 生成物（バイナリ・専用 DB）は掃除済み、`config.toml` は無変化（本検証では `PUT /api/config` を呼んでいない）。

---

## 10. 完了条件（§7）の達成状況

### 7.1 機能要件

- [x] プリセット一覧・編集の 2 画面が動く（`/presets` が実装され、Header リンクが有効）
- [x] 組み込みをコピーしてカスタムプリセットを作れる（**エイリアスが実体化される**）
- [x] **`character_id` が全行に入っている**
- [x] 組み込みの削除・エイリアス編集が **403**
- [x] 上限 8 件が効いている
- [x] **削除で孤児行が残らない**

### 7.2 自己テスト結果

- [x] `go test ./...` 全緑（**47 パッケージ**）
- [x] `pnpm test` 全緑（**134 ファイル / 1,115 件**）
- [x] `make e2e` を回し結果を報告（§4。**フルスイート exit 0 ／ 79 passed ／ 1 flaky。当初「完走しない」と報告したのは誤りで、訂正済み**）
- [x] **実機 1 周**（2026-08-13・開発者。**「想定通り動いていました」**。手順は §9.1）

### 7.3 品質チェック / 7.4 ドキュメント / 7.5 完了報告

§5 ／ §8 ／ 本書 ＋ 設計伝達レポートのとおり。

---

*以上、M20-04 完了報告。*
