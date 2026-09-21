# M20-04 レビュー報告書

| 項目 | 内容 |
|------|------|
| 対象 | M20-04（プリセット管理 UI ＋ カスタムプリセット作成） |
| 対象範囲 | `2812a26..HEAD`（4 commit）**＋ 未コミットの作業ツリー差分**（`internal/api/preset/` ／ `cmd/combomgr/main.go` ／ 未追跡 `write_handler_test.go`） |
| 判定基準 | `docs/instructions/reviews/M20-04-review-checklist.md` v1.0.1 ／ 指示書 `M20-04` v1.0.1 |
| レビュー実施日 | 2026-08-13 |
| レビュー担当 | Claude Code（サブエージェント・read-only） |

---

## 総評

**チェックリスト §8 の差し戻し事由 9 件は 1 件も該当しない。** 本サブの主眼だった「抜けても動くもの」——`character_id`・サービス層の保護・上限検査・CASCADE に頼らない削除——はいずれも実装され、かつ **落ちないバグを検出できる形のテスト**で固定されている。とくに `Test_Delete_DeletesChildrenExplicitly`（削除呼び出し順の spy 検証）と `Test_UniqueConstraint_RawErrorNamesIntendedColumns`（エラー文字列の構成列確認）は、「孤児 0 件」「制約で落ちた」という**観測だけでは主張しきれない**ことを製造側が自覚して書いた形であり、M20-03 の教訓が効いている。

一方で **完了報告（`docs/progress/M20-04-completion-report.md`）と `progress-log.md` の索引行が存在しない。** 指示書は §3.3 の実査 9 項目・§3.3-8 の行数・§4.5-4 の config 判断・§4.7 の `recipe_cache` 状態・§4.8 の否定形確認の件数と範囲・`make e2e` と実機確認の結果を、**すべて完了報告で受け取る設計**になっている。報告が無いため `CHANGE-101` §5 の三点セット（改訂 `DES-005` ＋ `DES-002` ＋ `DES-006` ＋ change-report-101）が組めず、M20-04 は完了条件を満たしていない。**★`check-progress-log-index.sh` が緑なのは、対照すべき完了報告そのものが無いためであり、追記した証明にならない**（指示書 §7.4 が名指しで警告している型）。

コード面では、**実装が変わったのに記述が旧のまま残っている箇所が 2 件**ある（`api.ts` の invalidate コメント／E2E の孤児行コメント）。いずれも動作は正しくテストも緑のまま通るため、人が読む以外に見つける経路が無い。後任がこの記述を前提に M20-05 を設計すると誤りが伝播するため「高」に置いた。

---

## 設計準拠性レビュー結果

### §1.1 ★`character_id`（重大判定 1 本目） — ◎

| 確認項目 | 判定 | 根拠 |
|---|---|---|
| コピー時に `character_id` を入れている | ◎ | `internal/repository/preset/queries.go` `copyAliasesSQL` が `preset_id, move_id, alias_text, alias_text_en, character_id` を明示列挙した `INSERT ... SELECT` |
| NULL 0 件のテストがある（§5 (b)） | ◎ | 3 層で固定——リポジトリ層 `TestRepository_CopyAliasesTx` ／ サービス層 `Test_Create_CopiesAllAliases` ／ E2E `for (const a of aliases) expect(a.characterId).toBe(1)` |
| `alias_text_en` もコピーしている | ◎ | `Test_Create_CopiesAliasTextEn`（ベース側の非 NULL 件数と一致を主張し、`baseEn == 0` を `t.Fatal` で前提崩れとして検出する形になっている） |

**特筆**: `TestRepository_CopyAliasesTx` は件数一致だけでなく、**コピー元と 1 行ずつ突き合わせて `character_id` / `alias_text` / `alias_text_en` の食い違い 0 件**を主張している（`IS NOT` で NULL 同士も比較）。件数だけを見るテストなら「全行に同じ `character_id` を入れる」実装でも緑になるが、この形はそれを弾く。指示書 §4.3-2 の要求を上回っている。

### §1.2 保護（重大判定 2 本目） — ◎

| 確認項目 | 判定 | 根拠 |
|---|---|---|
| 組み込みの削除が 403 | ◎ | `service.authorizeMutation` → `ErrBuiltinProtected` → `writeServiceError` で `http.StatusForbidden`。`Test_Delete_BuiltinIsProtected`（3 種すべて）＋ `TestHandler_Delete_BuiltinIsForbidden` ＋ E2E |
| ★組み込みのエイリアス編集が 403（D-290） | ◎ | `Test_Update_BuiltinAliasEditIsProtected` が **拒否だけでなく `alias_text` が変わっていないこと**まで確認。`Test_Update_BuiltinNameIsProtected` で名前側も固定 |
| ★UI で出さないだけになっていない | ◎ | 保護は `service.authorizeMutation`（`internal/service/preset/service.go:299`）にある。UI 側（`PresetEditPage` の `readOnly`）は「案内であって防御ではない」とコード上で明言。E2E `★組み込みプリセットは API 直叩きでも 403 で守られる` が `page.request.put/delete` で直叩きして 403 を確認 |
| 上限 8 件が効いている／1 ユーザー上限を設けていない | ◎ | `CountPresets` は `SELECT count(*) FROM presets`（ユーザー条件なし）。`Test_Create_EnforcesTotalLimit` が **別ユーザーからの 9 件目も拒否される**ことまで主張 |
| 9 件目拒否・8 件目まで通るテスト（§5 (f)） | ◎ | サービス層・ハンドラ層・E2E の 3 層 |

**特筆**: 上限検査を `BeginTx` 後に `tx` 上で行っている（`CountPresets(ctx, tx)`）。検査と INSERT を別トランザクションに分けると同時作成で 9 件目が通りうる、という理由がコメントに書かれている。`Repository` インターフェースに `tx *sql.Tx` を受ける形を用意したのはこのためであり、設計意図が追える。

### §1.3 削除（重大判定 3 本目） — ◎（報告面のみ後述）

| 確認項目 | 判定 | 根拠 |
|---|---|---|
| ★CASCADE に頼っていない | ◎ | `service.Delete` が `DeleteAliasesByPresetTx` → `DeletePresetTx` の順に明示実行 |
| 1 トランザクション | ◎ | `service.go:276-292` |
| ★孤児 0 件のテスト（§5 (g)） | ◎ | `Test_Delete_LeavesNoOrphanAliases` ＋ `TestRepository_DeleteAliasesByPresetTx_LeavesNoOrphan` |
| `config` 参照時の扱いが決まっている | ○ | `ErrInUseByConfig` → 409。`Test_Delete_RefusedWhenReferencedByConfig` / `TestHandler_Delete_InUseByConfig_409` / E2E で固定。**ただし「報告にある」の条件は完了報告が無いため未達**（後述・高 1） |

**特筆（本レビューで最も評価する点）**: `Test_Delete_LeavesNoOrphanAliases` のコメントが「**このテストだけでは CASCADE に頼っていないことを主張しきれない**——`PRAGMA foreign_keys` は接続単位（P-04）であり、たまたま FK=ON の接続を引けば CASCADE 依存の実装でも孤児 0 件になる」と自ら限界を宣言し、**`Test_Delete_DeletesChildrenExplicitly` で呼び出し順を spy して実装の形そのものを固定**している。チェックリスト §8-4 が問うているのは「実装が CASCADE に依存していないこと」であって「孤児が 0 であること」ではないため、この 2 本目が無いと差し戻し事由 4 を判定できない。製造側がその差を理解して書いている。

### §1.4 `presets.id` を詰めていない — ◎

- `createPresetSQL` は `id` を指定しない（`INSERT INTO presets (user_id, code, name, base_preset_code, is_builtin)`）。再採番・詰め直し処理は全差分に 0 件。
- `Test_Create_CopiesAllAliases` が **(1) 新 id が 2 / 4 でないこと (2) 2 / 4 が欠番のままであること (3) 組み込み 3 種の id が 1 / 3 / 5 のままであること** の 3 点を固定。`TestRepository_CreatePresetTx_DoesNotReuseGap` も別途 `newID > 5` を主張。

### §1.5 コピーの原子性 — ○

| 確認項目 | 判定 | 根拠 |
|---|---|---|
| 1 トランザクション | ◎ | `Create` が `BeginTx` → 検査 → INSERT → コピー → `Commit`、`defer tx.Rollback()` |
| 途中失敗で 1 行も残らないテスト（§5 (h)） | ◎ | `Test_Create_RollsBackEverythingOnFailure`（`CopyAliasesTx` だけを失敗させる埋め込みリポジトリで、`presets` への INSERT 成功後に落ちる状況を作っている＝狙った断面） |
| コピー 1 回の INSERT 行数が報告にある（§3.3-8） | △ | 実測はある（`service.go:123` の「最大 1,653 行」／ `TestRepository_AliasCounts_Baseline` が `t.Logf` で 3 種の実数を出す）が、**報告先である完了報告が無い** |

### §1.6 一意制約違反の扱い — ◎

| 確認項目 | 判定 | 根拠 |
|---|---|---|
| ★500 で返していない | ◎ | `ErrAliasConflict` → 409。`TestHandler_Update_AliasConflict_NotInternalError` が **`rec.Code >= 500` を先に落とす**書き方（409 の期待より前に 5xx を弾く）。E2E も同型 |
| どの表記が衝突したかを伝えている | ◎ | `AliasConflictError.AliasText` → メッセージ本文 ＋ `details.aliasText`。ハンドラ・E2E 双方で `details` まで検証 |
| ★破壊テストが狙った制約の構成列まで確認 | ◎ | `Test_UniqueConstraint_RawErrorNamesIntendedColumns` が `UNIQUE constraint failed` ＋ `preset_aliases.preset_id` ／ `.character_id` ／ `.alias_text` の 4 文字列を要求。**さらに `isAliasUniqueViolation` 自体が構成列を見て絞っており**、`(preset_id, move_id)` 違反を「表記の衝突」と誤って伝えない |

**補足**: `Test_Update_DifferentCharacterSameTextIsAllowed`（別キャラなら同表記が通る）を置いて**制約の範囲**まで固定している。過剰拒否側の退行も検出できる。

### §1.7 編集範囲 — ◎

- 編集不可対象（連結子／ベースプリセット名／フォールバック挙動／技の追加・削除）は UI で入力欄を持たず、**サービス層でも `ErrAliasMoveNotFound` で技の追加を拒否**（`Test_Update_UnknownMoveIsRejected` が行数不変まで確認）。
- `alias_text_en` の編集 UI 無し。`PresetAliasEditor.test.tsx` が「**入力欄はエイリアス 1 行につき 1 個だけ**」「`aliasTextEn` の値が `queryByDisplayValue` で取れない」を主張しており、将来欄が増えたら落ちる形になっている。
- `updateAliasTextSQL` が `alias_text` のみを更新。`TestRepository_UpdateAliasTextTx` が `alias_text_en` / `character_id` の巻き込み 0 を主張。

### §1.8 `recipe_cache` — △

| 確認項目 | 判定 | 根拠 |
|---|---|---|
| ★読み書きしていない | ◎ | `recipe_cache` / `RecipeCache` の出現は全差分でコメント 4 箇所のみ。SQL・Go コードともに 0 |
| ★作成・編集直後の状態が完了報告に書かれている | × | **完了報告が存在しない**（高 1） |

**あわせて、記述と実装の齟齬が 1 件**（高 2）。`web/src/features/preset/api.ts:150-155` の `useUpdatePreset.onSuccess` が

```
// ★レシピ表示は preset ごとにキャッシュされている(queryKey は
// ["combo", comboId, "recipe", presetId] = 契約 F-2)。エイリアスを
// 変えたら表示も変わるため無効化する。
void qc.invalidateQueries({ queryKey: ["combo"] });
```

と書いているが、**サーバー側の `notation.ResolveComboRecipe`（`internal/service/notation/cache.go:16`）は当該 `preset_id` のエントリが `recipe_cache` にあればそれを返す**（`cache.go:38-41`）。エイリアスを編集しても `recipe_cache` は更新されないため、**クライアントを無効化しても再取得されるのは同じ stale 値である。** 「エイリアスを変えたら表示も変わる」は成立しない。`recipe_cache` が stale であること自体は設計どおり（チェックリスト §9）だが、**コメントは「変わる」と断言しており、M20-05 の担当がこの記述を前提にすると『クライアント無効化は済んでいる。残りはサーバーだけ』と読み違える。**

---

### §2 契約・凍結インターフェース — ◎

| 対象 | 判定 | 実測 |
|---|---|---|
| `internal/service/punishfinder` ／ `internal/service/setplay` の diff 0 | ◎ | `git diff --stat` に出現しない |
| `web/src/features/gamepad/` ／ `web/src/features/setup/` の diff 0（D-351） | ◎ | 同上 |
| `moves` テーブルの diff 0 | ◎ | `migrations/` の diff 0。`moves` への SQL は `JOIN` のみ |
| M20-02 が投入したエイリアスの値が不変 | ◎ | 組み込みへの UPDATE 経路は `authorizeMutation` で塞がれ、テスト（`Test_Update_BuiltinAliasEditIsProtected`）が値の不変を確認 |
| 適用済みマイグレの改変 0 ／ `migrations/` の diff 0 | ◎ | `git diff --stat` に `migrations/` なし（**マイグレ 0 本＝指示書 §2.1 の見込みどおり**） |
| `scripts/` ／ `docs/design/` の diff 0 | ◎ | 同上 |
| 既存 `GET /api/presets` ／ `GET /api/presets/:id` が不変（§5 (j)） | ◎ | `TestHandler_ReadRoutes_Unchanged` が **応答キー集合の増減**まで検査（`omitempty` 込みで `id`/`code`/`name`/`isBuiltin` のみ）。DTO も無改変 |

**契約面の指摘（中 6・高 1 に関連）**: `GET /api/presets/:id/aliases` は指示書 §4.2 の 3 本にも `CHANGE-101` §2.2 の e/f/g にも無い**新設の公開 API** である。追加の必然性（編集画面を作る手段が他に無い）はコード上に明記されており判断は妥当だが、**`DES-002` §4 へ反映する経路は完了報告（as-built）しかない。** 報告が無いため契約が宙に浮いている。`character_id` 必須・`limit` 任意・400/404 の形もあわせて as-built へ載せる必要がある。

### §3 実装品質 — ○

| 確認項目 | 判定 | 実測 |
|---|---|---|
| `pnpm lint` exit 0 | ◎ | 実行済み（`tsc --noEmit` 無出力・exit 0） |
| `console.log` ／ `fmt.Println` 混入 0 件 | ◎ | 差分全域で 0 件 |
| `any` ／ `@ts-ignore` ／ `eslint-disable` ／ `nolint` の追加 0 件 | ◎ | 0 件 |
| エラーが wrap されている | ◎ | リポジトリ層は全メソッドが `fmt.Errorf("...: %w", err)`。サービス層はセンチネル返却と wrap を使い分け |
| サービス層が第一引数に `context.Context` | ◎ | 全メソッド |
| JSON タグが camelCase | ◎ | `basePresetCode` / `isBuiltin` / `userId` / `moveId` / `aliasText` / `aliasTextEn` / `officialAliasText` |
| `internal/service/` に横断ヘルパを作っていない | ◎ | preset ドメインに閉じている。`config` への依存は**関数注入**（`defaultPresetID func() int64`）で回避しており、`internal/config` を import していない。設計として妥当 |

**品質面の指摘は「設計準拠性以外の指摘事項」に記載**（重複定義・マジックナンバー・未使用エクスポート）。

### §4 テスト — ○

| 区分 | 判定 | 所在 |
|---|---|---|
| (a) コピー件数一致 | ◎ | `Test_Create_CopiesAllAliases` ／ `TestRepository_CopyAliasesTx` |
| (b) `character_id` NULL 0 件 | ◎ | 3 層 |
| (c) 一意制約（構成列まで） | ◎ | `Test_UniqueConstraint_RawErrorNamesIntendedColumns` |
| (d) 組み込み削除 403 | ◎ | サービス／ハンドラ／E2E |
| (e) 組み込みエイリアス編集 403（サービス層で） | ◎ | 同上 |
| (f) 9 件目拒否 | ◎ | 同上 |
| (g) 孤児 0 件 | ◎ | サービス／リポジトリ |
| (h) トランザクション | ◎ | `Test_Create_RollsBackEverythingOnFailure` |
| (i) 欠番を詰めない | ◎ | サービス／リポジトリ |
| (j) 非回帰 | ◎ | `go test ./...` **47 パッケージ ok・FAIL 0**（レビュー担当が実行）／`pnpm test` **134 ファイル・1115 テスト pass**（同） |
| E2E 1 本以上 | ◎ | `web/e2e/m20-04-preset-management.spec.ts` に **7 本**（1 周／API 直叩き 403／読み取り専用画面／上限／衝突 409／config 参照／★カスタムでレシピが壊れないこと＝§3.3-5 の停止条件 1 の裏取り） |
| `make e2e` の結果が報告されている | × | 完了報告が無い（レビュー担当は環境上 `make e2e` を回していない） |
| `go run ./cmd/combomgr` 実機確認の結果が報告されている | × | 同上（開発者手番） |

**E2E の記述に齟齬 1 件**（高 3）。`m20-04-preset-management.spec.ts:144-149`：

```
// ★子行が残っていないこと。ON DELETE CASCADE は発火しない(P-04)ため、
// サービス層が明示削除していなければここに残る。
const orphanRes = await page.request.get(`/api/presets/${created!.id}/aliases?character_id=1`);
expect(orphanRes.status(), "削除したプリセットが引ける").toBe(404);
```

**この assertion は孤児行を検出できない。** `ListAliases` ハンドラは `service.ListAliases` → `s.Get(presetID)` で先に親の存在を見るため（`internal/service/preset/service.go:107`）、**子行が全件残っていても 404 が返る。** 実際に守っているのは「親が消えたこと」だけである。孤児 0 件は Go 側の 2 本が守っているので実害は無いが、コメントは「E2E でも孤児を見ている」と読める。E2E だけを読む後任が二重に守られていると誤解する。

### §5 ドキュメント — ×

| 確認項目 | 判定 | 実測 |
|---|---|---|
| `progress-log.md` へ索引行を追記した | × | `grep -n "M20-04" docs/progress/progress-log.md` は M20-01 / M20-03 の本文中の言及 3 件のみ。**M20-04 の索引行（日付・作業 ID・結果・報告書リンク ＋ 横断課題）は存在しない**。末尾は M20-03 節で終わっている |
| ★`check-progress-log-index.sh` の緑を証明として引いていない | — | スクリプトは緑（「検査した 26 件すべてが progress-log に現れる」）だが、**対照すべき `M20-04-completion-report.md` が存在しないため検査対象に入っていない**。指示書 §7.4 が名指しした型そのもの |
| ブラウザストレージの新規キー | ◎ | 新規キー 0 件（`localStorage` / `sessionStorage` の出現 0）。`bash scripts/check-browser-storage-keys.sh` 違反なし |

### §6 否定形確認（§4.8） — ×（報告が無い）／コード上は 0 件

**完了報告が無いため「件数と検査した範囲の両方」が報告されていない。** レビュー担当が代わりに走査した結果を以下に置く（採否は製造側が完了報告へ再掲すること）。

- **検査範囲**: `internal/service/preset/` ／ `internal/repository/preset/` ／ `internal/api/preset/` ／ `internal/model/preset.go` ／ `web/src/features/preset/` ／ `web/src/pages/PresetListPage.tsx` ／ `web/src/pages/PresetEditPage.tsx` ／ `web/e2e/m20-04-preset-management.spec.ts`
- **「組み込みが 5 個ある」前提の記述**: **0 件**。ヒットした 13 件はすべて「5 種 → 3 種へ整理した」という履歴記述、または「カスタム 5 件」（正しい値）。`preset_id = 5`（`srk`）はチェックリスト §6 のとおり正常値として除外。
- **上限 10 件の主張**: **0 件**。
- **「組み込みプリセットのエイリアスは編集可能」に相当する記述・分岐**: **0 件**。ヒット 3 件はいずれも `errors.go:22`「旧記載『編集は可能』は誤りだった」／`service_test.go:239` の同旨／`handler.go:69` の `DES-005` §5.11 引用（対象はカスタムプリセットの編集画面）であり、残骸ではない。
- **`ON DELETE CASCADE` に依存した削除**: **0 件**。ヒット 10 件はすべて「頼らない」旨の記述。
- **`console.log` / `fmt.Println`**: 0 件。**`any` / `@ts-ignore` / `eslint-disable` / `nolint`**: 0 件。

### §7 停止規律 — ◎（該当なし）

初回レビューであり往復 0 回。`bash scripts/check-stop-discipline.sh` 違反なし。`bash scripts/check-artifact-integrity.sh` 違反なし。

---

## 設計準拠性以外の指摘事項

### A. 技カテゴリのラベル・順序が二重定義になっている（中）

`web/src/features/preset/components/PresetAliasEditor.tsx:9-34` が `MOVE_CATEGORY_LABELS` と `CATEGORY_ORDER` を新規定義しているが、**同等のものが既に `web/src/features/moves/types.ts:107-132` に `MOVE_CATEGORY_LABEL_JA` / `MOVE_CATEGORY_ORDER` として存在する。** しかも値が食い違う。

| category | `moves/types.ts`（既存） | `PresetAliasEditor.tsx`（新規） |
|---|---|---|
| `super_art` | **SA** | **スーパーアーツ** |
| `rush_variant` | **ラッシュ版** | **ラッシュ派生** |
| 順序 | `... throw, special, super_art, ...` | `... special, super_art, ..., throw, ...` |

**同じ技カテゴリが、技セレクタとプリセット編集画面で違う名前・違う順序で出る。** `CLAUDE.md` §4「マジックストリングは定数化」と `.claude/rules/enum-sync.md` 規則 2（画面側のコードに生リテラルを書かない・`web/src/constants/<domain>.ts` に置く）の両方に反する。新しい列挙値が追加されたとき片方だけ更新される形でもある。`check-enum-sync.sh` はベースライン超過なしで通ってしまうため、機械検査では捕まらない。

> **是正案**: 既存の `MOVE_CATEGORY_LABEL_JA` / `MOVE_CATEGORY_ORDER` を import して使う（ラベルの是非は別議論として、まず 1 本にする）。あるいは両方を `web/src/constants/move.ts` へ移して両画面から引く。

### B. 上限「8」がリテラルで散在している（中）

`PRESET_TOTAL_LIMIT` / `presetsvc.PresetTotalLimit` という定数を用意しているのに、利用者向け文面では 8 が直書きされている。

- `internal/api/preset/handler.go:187` `"プリセットは全体で 8 件までです。..."`（同じ応答の `details` は `presetsvc.PresetTotalLimit` を使っている＝**同一レスポンス内で定数とリテラルが混在**）
- `web/src/features/preset/components/PresetListTable.tsx:97` `title={"プリセットは全体で 8 件までです。..."}`

`DES-006` VAL-P05 の値は M20-01 で 10 → 8 へ変わった実績がある（旧記載の失効は指示書 §4.8 の走査対象そのもの）。次に変わったとき、**メッセージだけが古い数字のまま残る形**になっている。

### C. 本番未使用のエクスポートがある（低）

`web/src/features/preset/errorMessage.ts` の `isPresetErrorCode` と `api.ts` の `PresetApiError.conflictAliasText` は、**テストからしか参照されていない**（本番コードは `presetErrorMessage` のみを使用）。サーバーメッセージを優先する方針（`errorMessage.ts` の doc）を採った結果、コード分岐が不要になったものと思われる。将来の分岐用に残すなら意図をコメントに置くか、使わないなら削る。

### D. `DES-004` §5.7-2 の「直接 INSERT する経路を増やさない」への逸脱が無報告（中）

同項は「既存の生成器を通す。直接 INSERT する経路を増やさない」を義務づけ、理由を **D-317 の交差条件（ある技の `alias_text` が、別の技の `alias_text_en` と一致する）が DB では守れず検査に残るため**としている（`D-344` も同旨）。

本サブは 2 本の直接書き込み経路を新設した。

- **コピー（`copyAliasesSQL`）** — ベース行を verbatim 複製するため、交差条件はコピー元と同一に保たれる。**安全**。
- **編集（`updateAliasTextSQL`）** — 利用者が任意の文字列を入れられる。**同一プリセット・同一キャラで、ある技の `alias_text` を別の技の `alias_text_en` と一致させられる。** `UNIQUE(preset_id, character_id, alias_text)` にも部分インデックス（`alias_text_en`）にも当たらないため、**DB でもサービス層でも検出されない。**

判断そのもの（編集経路を作らないと本サブが成立しない）は妥当だが、**規約からの逸脱であることが完了報告にも設計伝達レポートにも書かれていない。** 検査を足すか、「利用者編集の経路については交差検査を課さない」と明示的に決めて設計卓へ上げるかの判断が要る。

### E. `config.preset_id` の実在確認は片方向のみ（中）

`SUPP-001` §7.3 は「M20-04 でプリセット作成 UI を作るとき、403 保護・上限検査・**`config.preset_id` の実在確認**（D-313）が同時に要る」としている。本サブが実装したのは**削除側の拒否**（`ErrInUseByConfig` → 409）だけで、**`config` 側が実在しない `preset_id` を指せる状態は残っている**——`internal/service/config/service.go:227` の検証は `PresetID < 1` のみで、DB 上の実在を見ていない。

アプリ経由の削除は塞がれたが、(1) `config.toml` の手編集、(2) 別経路で消えたプリセット、では依然として起動時に実在しない `preset_id` を引く。指示書 §4.5-4 の要求（削除時の扱いを決めて報告）は満たしているため差し戻し事由ではないが、`SUPP-001` §7.3 が名指しした要件の半分が残っている。**扱い（本サブの範囲外とするか M20-05 で持つか）を報告に明記されたい。**

### F. サービス層と API 層の配線が未コミット（中・プロセス）

`git status` 時点で以下が作業ツリーにのみ存在する。

```
 M cmd/combomgr/main.go            ← presetsvc の DI 配線
 M internal/api/preset/dto.go      ← 新 DTO 4 つ
 M internal/api/preset/handler.go  ← 書き込み 3 本 + ListAliases + writeServiceError
 M internal/api/preset/routes.go   ← ルート 4 本
 M internal/api/preset/handler_test.go
?? internal/api/preset/write_handler_test.go  ← 未追跡
```

**指示された比較範囲 `2812a26..HEAD` には API 層が 1 行も入っていない。** その 4 commit だけを取り出すと、`presetsvc` を誰も呼ばない（＝画面が動かない）状態に見える。`CLAUDE.md` §7 は「作業の節目でチェックポイントコミットを切る」を求めており、`feat(M20-04/preset): サービス層を新設` → `feat(M20-04/preset): 2 画面を実装` → `test(M20-04/preset): E2E` と刻んだのに **API 層だけが commit されていない**のは規律の穴である。E2E 追加より前に存在していたはずのレイヤーなので、順序としても不自然。

> **本レビューは作業ツリーの状態（＝実際のコード）を対象に判定した。** 上記 6 ファイルを含めないと `go build ./...` は通らない（`presethandler.NewHandler` のシグネチャが変わっているため）。

### G. 2 つのエイリアスを入れ替える編集が通らない（低）

`service.Update` はエイリアスを 1 件ずつ順に `UPDATE` する。技 A と技 B の表記を入れ替える編集（A: "X"→"Y"、B: "Y"→"X"）を 1 リクエストで送ると、**1 件目の時点で中間状態が `UNIQUE(preset_id, character_id, alias_text)` に当たり 409 になる。** SQLite は `DEFERRABLE INITIALLY DEFERRED` を UNIQUE インデックスに適用できないため回避に工夫が要る（一旦ユニークな一時値へ逃がす等）。頻度は低いと見るが、利用者には「衝突していないのに衝突と言われる」形で見える。**現状の挙動を既知の制限として `followup-backlog` へ置くことを推奨。**

### H. その他（低）

1. `service.Create` 内で `FindPresetByCode` だけがトランザクション外（`r.db`）で実行される。`CountPresets` / `CountPresetsByName` / `ListCustomPresetCodes` は `tx` を受ける形にしたのに、ベース検索だけ揃っていない。組み込みプリセットは本サブの保護により変更されないため実害は無いが、意図が読めない非対称。
2. `presetsvc.New` に渡す `func() int64 { return cfg.Defaults.PresetID }` と、`configsvc` の `*s.cfg = next`（`internal/service/config/service.go:177`）は**同一構造体への無同期のリード/ライト**。単一利用者のローカルアプリのため実害は考えにくいが、`go test -race` で並行に叩けば検出されうる。
3. `PresetListPage` / `PresetEditPage` は文言をハードコードしている（`react-i18next` 非使用）。既存ページも混在しており（`TrashPage` / `PunishListPage` 等も未対応）本サブ固有の逸脱ではないため、踏襲の範囲と判断した。
4. `PresetEditPage` の `original` / `edits` はコンポーネント state に持つため、`/presets/A/edit` → `/presets/B/edit` を**直接**遷移すると前のプリセットの baseline が持ち越される（`moveId` はプリセット間で共通のため差分判定が狂う）。現行 UI に該当遷移路は無い（必ず一覧を経由する）ため実害なし。
5. `docs/handover/code-facts.md` は `/presets` を「router.tsx に未定義」「Header は disabled」「API は読み取り 2 本」と記述したままである（§305 / §339-340 / §406）。派生資料であり再生成は別手番だが、**次の設計卓が引く一次情報**であるため、完了報告の横断課題に「再生成が要る」旨を残されたい。

### I. 判定していないもの（チェックリスト §9 の適用）

以下はチェックリスト §9 により**判定対象外**とし、指摘にしていない。

- 一覧・編集画面のレイアウト（2 セクション構成・カード/テーブルの落とし方・ダイアログの形）
- 上限超過・名前重複・表記衝突・config 参照時の **409 という選択**（既存 `tag` の流儀に合わせたという説明で足りる）
- `config` が削除対象を指す場合に「拒否」を選んだこと（設計卓の見込みと一致。理由も明記されている）
- `recipe_cache` が stale であること自体（M20-05 の所管）
- `P-04` の根治

なお **DES-005 §5.10 の「作成日」を表示しなかったこと**（製造申告 #8）は、`presets` に `created_at` が無く、マイグレを自採番しない（D-293）以上**唯一取りうる判断**であり妥当。`PresetListTable.tsx:27-30` に理由が明記されている。ただし**設計書側の是正が要る**ため、完了報告 → `CHANGE-101` の三点セットで `DES-005` §5.10 から「作成日」を落とす（または「列追加を伴う将来対応」と明記する）必要がある。

---

## 推奨修正（優先度別）

### 高（M20 完了前に修正必須）

1. **完了報告 `docs/progress/M20-04-completion-report.md` と `progress-log.md` の索引行を作成する。**
   指示書が完了報告でしか受け取れない情報が以下 9 件ある。いずれも欠けると `CHANGE-101` §5 の三点セットが組めない。
   - §3.3 の実査 9 項目（とくに **§3.3-5**＝停止条件 1 の判定根拠。E2E `★カスタムプリセットを選んでもレシピ表示が壊れない` が裏取りになっているので、その結論を文章で）
   - **§3.3-8 のコピー 1 回の INSERT 行数**（`official_ja_move` 1,653 / `numeric` / `srk` の実数）
   - **§4.7 の `recipe_cache` の状態**（作成直後＝エントリ無し・初回表示で遅延計算されて書かれる／**編集後＝当該 `preset_id` のエントリが stale のまま残り、表示は更新されない**）
   - **§4.5-4 の `config` 判断**（削除を拒否・409・`preset_in_use_by_config`）
   - **§4.8 の否定形確認**（件数と検査範囲。本報告書 §6 の走査結果を流用可）
   - **API 4 本の as-built 契約**（`POST` / `PUT` / `DELETE` ＋ **`GET /api/presets/:id/aliases`**。パス・ボディ・応答・エラーコード一覧）
   - 一覧・編集画面の表示項目とアクション、**`DES-005` §5.10 との差分（作成日を出していない理由）**
   - 保護と上限の実装位置（`service.authorizeMutation` ／ `service.Create` の `CountPresets(ctx, tx)`）
   - `make e2e` の結果 ／ `go run ./cmd/combomgr` 実機確認（開発者手番）の依頼
   - ★あわせて `check-progress-log-index.sh` の緑を証明に使わず、**追記行そのものを目視で確認**すること（指示書 §7.4）。

2. **`web/src/features/preset/api.ts:150-155` のコメントを事実に合わせる。**
   「エイリアスを変えたら表示も変わるため無効化する」は成立しない（`ResolveComboRecipe` は `recipe_cache` ヒット時に stale を返す）。**「サーバー側が stale を返すため、この無効化だけでは表示は変わらない。M20-05 が再計算を接続するまでは反映されない」**と書き換えるか、無効化自体が現時点で無意味なら削って理由を残す。**動作は正しく、テストも型検査も緑のまま通るため、人が読む以外に検出経路が無い。** M20-05 の担当が「クライアント側は済み」と読み違える。

3. **E2E `m20-04-preset-management.spec.ts:144-149` のコメントと assertion を一致させる。**
   現状の `expect(orphanRes.status()).toBe(404)` は**孤児行を検出できない**（親が消えた時点で 404 になるため、子行が全件残っていても緑）。コメントを「親が消えたことを確認する」に直す（孤児 0 件は Go 側 2 本が守っている旨を添える）か、孤児を実際に見られる経路を用意する。**放置すると「E2E でも孤児を見ている」という誤った前提が次サブへ複製される。**

### 中（M21 着手と並行可）

4. **技カテゴリのラベル・順序の二重定義を解消する**（指摘 A）。`moves/types.ts` の既存定数を使うか、`web/src/constants/` へ移して両画面から引く。現状は同じカテゴリが画面ごとに別名・別順序で出る。
5. **上限「8」のリテラルを `PresetTotalLimit` / `PRESET_TOTAL_LIMIT` から組み立てる**（指摘 B）。`handler.go:187` は同一レスポンス内で定数とリテラルが混在している。
6. **`DES-004` §5.7-2 からの逸脱（利用者編集経路の新設と、D-317 交差条件の無検査）を完了報告・設計伝達レポートへ明記する**（指摘 D）。検査を足すか、課さないと決めて設計卓へ上げるかの判断が要る。
7. **`SUPP-001` §7.3 の「`config.preset_id` の実在確認」の残り半分（config 側の検証）の扱いを報告する**（指摘 E）。本サブ範囲外とするなら `followup-backlog` §J へ。
8. **API 層 4 ファイル ＋ `main.go` ＋ 未追跡テストをコミットする**（指摘 F）。現状 `2812a26..HEAD` だけではビルドが通らない。

### 低（将来対応）

9. 表記を入れ替える編集が中間状態で 409 になる制限を `followup-backlog` へ記録（指摘 G）。
10. `isPresetErrorCode` / `conflictAliasText` の本番未使用を解消（使うか削るか）（指摘 C）。
11. `service.Create` の `FindPresetByCode` をトランザクション上へ揃える（指摘 H-1）。
12. `cfg` の無同期共有（指摘 H-2）。単一利用者前提では実害小。
13. `code-facts.md` の `/presets` 記述が古い旨を横断課題へ（指摘 H-5）。

---

## 良かった点

1. **「観測では主張しきれない」ことを自覚してテストを 2 本立てにした。** `Test_Delete_LeavesNoOrphanAliases` が自らの限界（`PRAGMA foreign_keys` は接続単位なので FK=ON 接続を引けば CASCADE 依存の実装でも緑になる）をコメントで宣言し、`Test_Delete_DeletesChildrenExplicitly` で**呼び出し順を spy して実装の形そのもの**を固定している。チェックリスト §8-4 が問うているのは実装の形であって孤児の件数ではないため、この分離が無いと差し戻し判定ができない。**M20-03 の教訓（「別の理由で落ちても緑になる」）が具体的な形で継承されている。**

2. **コピーの検証が件数一致で止まっていない。** `TestRepository_CopyAliasesTx` はコピー元と 1 行ずつ突き合わせ、`character_id` / `alias_text` / `alias_text_en` の食い違い 0 件を `IS NOT` で（NULL 同士も含めて）主張している。件数だけを見るテストなら「全行に同じ `character_id` を入れる」実装でも緑になる。**指示書 §4.3-2 の要求を上回っている。**

3. **`isAliasUniqueViolation` が制約の構成列まで見ている。** `UNIQUE constraint failed` の部分一致で済ませず、`preset_aliases.character_id` と `preset_aliases.alias_text` の両方を要求している。`(preset_id, move_id)` 違反を「表記の衝突です」と利用者へ誤って伝えない。**D-275 の同型を「500 にしない」だけで終わらせず、正しい相手にだけ 409 を返す形まで詰めている。**

4. **失効したテストを「緩める」のではなく「作り替えた」。** `Header.test.tsx` の 3 本・`HomePage.test.tsx` の 2 本・`SettingsPage.test.tsx` の 2 本は、いずれも disabled を主張していた。期待値を反転させるだけでなく、**題材そのものが消えたケース（「現在ページ vs disabled」の対比）ではまだ実在する対比（「現在ページ vs 通常リンク」）へ主張を作り替え**、旧テストが `text-blue-600` の部分一致で判定していた穴（`hover:text-blue-600` が通常リンクにも付く）まで是正している。各所に理由をコメントで残しているのも良い。

5. **`config` への依存を関数注入で切った。** D-313 の検査に `config` の現在値が要るが、`internal/config` を import せず `defaultPresetID func() int64` を受ける形にした。指示書 §2.3「preset ドメインに閉じる」を満たしつつ、`nil` を渡せばテストで config 無しの状態を作れる。**制約を満たすための妥協ではなく、テスト容易性まで得ている。**

6. **推測で進めた 9 件がすべてコード上に理由付きで書かれている。** とくに `GET /api/presets/:id/aliases` の新設（`handler.go:66-72`）、作成日の非表示（`PresetListTable.tsx:27-30`）、`custom_<n>` の採番理由（`service.go:21-26`）、既定名「〜 のコピー」を連番化しなかった理由（`PresetCopyDialog.tsx`）は、いずれも**選ばなかった案とその理由**まで書かれている。完了報告さえ出れば、そのまま as-built として使える水準。

7. **E2E が「画面の見た目」ではなく「無いと気づけないもの」を狙っている。** spec 冒頭が守る対象を 3 点（実体化と `character_id` ／ API 直叩きの 403 ／ 孤児行）に明記し、`page.request` で API を直接叩く形を採っている。停止条件 1 の裏取り（`★カスタムプリセットを選んでもレシピ表示が壊れない`）を E2E に落としているのも良い判断。

---

## 制約事項

- 本レビューはコード上で判定可能な範囲のみ対象。実際の動作確認・パフォーマンス・実機テストは別途実施が必要。
- レビュー担当が実行したのは `go build ./...` ／ `go vet ./internal/...` ／ `go test ./...`（47 パッケージ ok）／ `pnpm lint`（exit 0）／ `pnpm test`（134 ファイル・1115 テスト pass）／ `scripts/check-progress-log-index.sh` ／ `check-browser-storage-keys.sh` ／ `check-enum-sync.sh` ／ `check-stop-discipline.sh` ／ `check-artifact-integrity.sh`（いずれも違反なし）。**`make e2e` は実行していない**（クラウド実行環境の既知の状態＝followup `cloud-e2e-browser-mismatch`）。E2E spec はコード上の読解のみで判定した。
- **判定対象は作業ツリーの現状**（未コミットの `internal/api/preset/` ／ `cmd/combomgr/main.go` ／ 未追跡 `write_handler_test.go` を含む）。指示された `2812a26..HEAD` の commit 範囲だけではビルドが通らないため（指摘 F）。
- **不明: `make e2e` の実際の結果について判断できない。** 7 本の spec はコード上は妥当だが、実行結果は完了報告での報告を待つ必要がある。
- **不明: `go run ./cmd/combomgr` による実機 1 周（指示書 §7.2・開発者手番）の結果について判断できない。**
- チェックリスト §9「判定してはいけないこと」に該当する 5 項目（レイアウト／HTTP ステータスの選択／config 参照時の扱いの中身／`recipe_cache` の stale 自体／P-04 の根治）は判定していない。

---

*以上、M20-04 レビュー報告書。*

---

## 取り込み結果（自動トリアージ）

`/implement_plan_full` Phase C による自動トリアージ。実施日 2026-08-13・往復 1 回目（上限 2 回）。

> **★「高」指摘の不採用は 0 件である**（安全弁の発動なし）。**高 3 件はすべて採用・修正済み。**

### 高

| # | 指摘 | 採否 | 対応と理由 |
|---|---|---|---|
| 1 | 完了報告と `progress-log.md` 索引行が無い | **採用** | **完了報告 `docs/progress/M20-04-completion-report.md` はレビュー開始後（commit `b9efc23`）に作成済みであり、レビュー担当が見た時点では存在しなかった。** 指摘された 9 件の内容はすべて収容している（§3.3 実査 9 項目＝§2 ／ §3.3-8 の行数＝1,653 / 1,245 / 1,260＝§2 ／ `recipe_cache` の状態＝§7.6 ／ config 判断＝§3.4 ／ 否定形確認の件数と範囲＝§4 ／ API 4 本の as-built＝§7.2・§7.3 ／ 画面と `DES-005` の差分＝§7.4 ／ 保護と上限の実装位置＝§3.2 ／ `make e2e` と実機確認＝§4・§9）。**`progress-log.md` の索引行は本トリアージ後の Phase D で追記した**（★`check-progress-log-index.sh` の緑は証明に使わず、追記行そのものを目視で確認した） |
| 2 | `api.ts` の invalidate コメントが事実と異なる（撤回済み記述型） | **採用** | **指摘のとおりで、コメントが誤っていた。** `ResolveComboRecipe` は `recipe_cache` ヒット時に stale を返すため、クライアント無効化では表示は変わらない。**「この無効化だけではレシピ表示は変わらない」を先頭に置き、なぜ変わらないか（`cache.go:38-41`）・いつ変わるか（M20-05 の `RecomputePresetCache` 接続後）・それでも無効化を残す理由（配線が入った時点でクライアント側の作業を要らなくするため）まで書き直した** |
| 3 | E2E の孤児行コメントと assertion が不一致 | **採用** | **指摘のとおりで、`expect(status).toBe(404)` は親の不在しか見ていない**（`ListAliases` は `service.Get` で先に親を見るため、子行が全件残っていても 404）。**コメントを「ここで確認しているのは親が消えたことだけである」に書き換え、孤児 0 件を守っているのは Go 側の 2 本（`Test_Delete_LeavesNoOrphanAliases` ＋ `Test_Delete_DeletesChildrenExplicitly`）であることを明記した。** 変数名も `orphanRes` → `goneRes` に直した |

### 中

| # | 指摘 | 採否 | 対応と理由 |
|---|---|---|---|
| 4 | 技カテゴリのラベル・順序が二重定義（指摘 A） | **採用** | **`PresetAliasEditor.tsx` の独自定義を削除し、`web/src/features/moves/types.ts` の `MOVE_CATEGORY_LABEL_JA` / `MOVE_CATEGORY_ORDER` を import する形にした。** 指摘のとおり `super_art`（SA / スーパーアーツ）・`rush_variant`（ラッシュ版 / ラッシュ派生）でラベルが、`throw` の位置で順序が食い違っていた。**既存側の値に寄せた**（ラベルの是非は別議論であり、まず 1 本にすることを優先した） |
| 5 | 上限「8」のリテラル散在（指摘 B） | **採用** | `handler.go` は `fmt.Sprintf` で `presetsvc.PresetTotalLimit` から組み立て（**同一レスポンス内の定数とリテラルの混在を解消**）、`PresetListTable.tsx` は `PRESET_TOTAL_LIMIT` から `LIMIT_REACHED_HINT` を組み立てる形にした |
| 6 | `DES-004` §5.7-2 からの逸脱・D-317 交差条件の無検査（指摘 D） | **採用（検査を足した）** | **報告に留めず実装した。** 「ある技の `alias_text` が、同一プリセット・同一キャラの別の技の `alias_text_en` と一致する」は列を跨ぐため `UNIQUE` で表現できず（`migrations/000075` の「★DB では守れないもの」）、**seed 経路は `migrate_m2003_test.go` (g) が守っているのに、M20-04 が作った利用者編集の経路には検査が無かった。** ⇒ `FindCrossingAliasEn`（リポジトリ）＋ `Update` の事前検査を追加し、衝突時は既存の `ErrAliasConflict`（409）へ写像する。**`Test_Update_RejectsCrossingWithAliasTextEn` で固定。** **★不変条件を守る検査であって新機能ではない**と判断した（`CLAUDE.md` §10「設計書に記載のない機能を追加しない」には当たらない） |
| 7 | `SUPP-001` §7.3 の `config` 側実在確認が未実装（指摘 E） | **採用（報告 ＋ followup 登録）** | **実装しない。** config サービスに DB 依存を持たせる変更になり、**指示書 §2.3（preset ドメインに閉じる）と §9.4 停止条件 3（他ドメインへの変更）の両方に当たる**ため、独断で進めない。⇒ `followup-backlog` §J **`preset-config-preset-id-existence`** へ必須 5 フィールド付きで登録し、完了報告 §7.7 でも扱いを明記した。**`M20-05` が `SUPP-001` §7.1・§7.2 の as-built 是正を持つため、同サブで併せて扱うのが自然である旨も添えた** |
| 8 | API 層 4 ファイル ＋ `main.go` が未コミット（指摘 F） | **採用（解消済み）** | **指摘のとおりのコミット漏れだった。** commit `5909377` で `internal/api/preset/`（dto / handler / routes / handler_test / write_handler_test）と `cmd/combomgr/main.go` をコミットし、`git status` はクリーン。**`2812a26..HEAD` だけでビルドが通る状態になった** |

### 低

| # | 指摘 | 採否 | 対応と理由 |
|---|---|---|---|
| 9 | 表記を入れ替える編集が中間状態で 409（指摘 G） | **採用（followup 登録）** | 直さない。回避には「一旦ユニークな一時値へ逃がす」等が要り、**中間状態が他の行と衝突しない保証を新たに設計する必要がある**（「落ちないバグ」を作りかねない）。⇒ `followup-backlog` §J **`preset-alias-swap-conflict`** へ登録 |
| 10 | 本番未使用のエクスポート（指摘 C） | **採用（削除）** | `isPresetErrorCode` を削除した（本番参照 0・将来の利用予定も無い）。**`PresetApiError.conflictAliasText` は残した**——同アクセサは `details.aliasText` という**サーバー契約の読み取り方そのもの**であり、テストが契約を固定している。`errorMessage.ts` の doc に「コード別分岐が不要になった経緯」と「必要になったら `PresetApiError` から取れる」ことを明記した |
| 11 | `Create` の `FindPresetByCode` がトランザクション外（指摘 H-1） | **採用** | `FindPresetByCodeTx` を追加し、**作成時の全検査（件数・ベース解決・名前・code 採番）を同じ断面へ揃えた**。指摘のとおり非対称に意図は無かった |
| 12 | `cfg` の無同期共有（指摘 H-2） | **採用（followup 登録）** | 直さない。**config サービスの公開 IF を変える必要があり M20-04 単独では直せない**（かつ M20-04 が作った構造ではなく、読む利用者を 1 つ増やしただけ）。⇒ `followup-backlog` §J **`preset-config-unsynchronized-read`** へ登録 |
| 13 | `code-facts.md` の `/presets` 記述が古い（指摘 H-5） | **採用（横断課題へ）** | 派生資料の再生成は別手番（`regen_code_facts`）であり、**製造が武装中に再生成すると差分が読めない**。⇒ `progress-log.md` の索引行の横断課題へ「再生成が要る」旨を残した |
| — | `PresetEditPage` の `original` / `edits` の持ち越し（指摘 H-4） | **採用** | 指摘は「現行 UI に該当遷移路は無いため実害なし」だったが、**URL 直打ちで起こりうる**ため直した。`presetId` の変化で両 state を捨てる `useEffect` を追加 |
| — | i18n 未対応（指摘 H-3） | **不採用** | レビュー担当自身が「既存ページも混在しており本サブ固有の逸脱ではない、踏襲の範囲」と判定しているため、本サブでは触らない。**i18n の全面適用は本サブのスコープ外**（指示書 §1.3・§2.1 のいずれにも無い） |

### 取り込み後の再検証

| 検査 | 結果 |
|---|---|
| `go test ./...` | **ok 47 パッケージ / FAIL 0** |
| `pnpm test` | **134 ファイル / 1,115 件 全緑** |
| `pnpm lint` | exit 0 |
| E2E `m20-04-preset-management.spec.ts` | **7/7 green**（小バッチ・17.4 秒） |
| `check-stop-discipline.sh` | 緑（§J の 3 件が必須 5 フィールドを満たす） |

> **★取り込みで見つかった副産物**: 指摘 6 の検査を追加したとき、当初のテストが「別キャラなら通る」を主張して落ちた。**実測すると `alias_text_en` は `micro_forward` / `micro_back` の 2 code に入る汎用語であり、全キャラで同一の文字列である**（「back microwalk」等）。したがって別キャラへ同じ文字列を入れるのも**本物の交差**であり、拒否が正しい。**テストの主張のほうを実測に合わせて作り替えた**（期待値を緩めたのではない）。

---

*以上、M20-04 取り込み結果（自動トリアージ）。*
