# M20-05 完了報告: `recipe_cache` 再計算の配線（eager）＋ 既定プリセットへの追随

| 項目 | 内容 |
|------|------|
| 対象指示書 | `docs/instructions/M20-05-recipe-cache-wiring.md` **v1.2.0** |
| チェックリスト | `docs/instructions/reviews/M20-05-review-checklist.md` **v1.2.0** |
| 対の CHANGE | `CHANGE-102`（承認済み・未反映） |
| 反映した裁定 | **D-360**（境界＝案 A ／ 既定プリセット値＝案 B・注入 ／ `punishfinder` の diff 0 例外）・**D-358**・**D-356**・**D-313**・**D-303** |
| 実施日 | 2026-08-14 |
| 実施ブランチ | `claude/m20-05-implementation-plan-m41jfh` |

---

## 0. 要旨

**既にある 2 メソッドを呼び出し元へ挿すサブだった。** 再計算のロジックは 1 行も書き直していない。足したのは「いつ呼ぶか」と「どの値を読むか」と「どの入力を拒否するか」である。

3 点を同じ手番で入れた——**(1) プリセット書き込み 3 経路からの再計算**（§4.4）／**(2) 既定プリセットへの追随**（§4.2）／**(3) `config.preset_id` の実在確認**（§4.3）。**(2) と (3) は不可分**であり、同一コミットに入れてある（追随だけ入れると、実在しない ID を指した状態でレシピ行が黙って消える）。

**スキーマ・マイグレーションは変えていない。** API 応答の形も変えていない（契約 F-2 不変）。

---

## 1. §3.3 着手前実査の結果（8 項目）

> **★設計卓は実装ソースを読めないため、実査で覆った点は理由を添えて書く。**

### 1-1. M20-04 が作った書き込み経路の実体（**見込みが覆った**）

**`SUPP-001` §7.2 が挙げる `create.go` / `update_aliases.go` / `delete.go` は存在しない。** as-built は **`internal/service/preset/service.go` の 1 ファイル**にすべて入っている（同表は M4 期に書かれたもので、基準時点が古い）。

**★「作成」と「コピー」は同一経路である。** `POST /api/presets` = `Create()` が組み込みプリセットのエイリアスを複製する形で、独立した duplicate エンドポイントは存在しない（`Copy` / `Duplicate` というメソッドも無い）。**⇒ 指示書 §4.1-4 が数える「4 経路」は、as-built では 3 経路である**（作成兼コピー ／ エイリアス更新 ／ 削除）。呼び忘れの有無は 3 経路で判定した。

トランザクションは**すべてサービス層**が開いて閉じる（`service.go:159/216`・`246/300`・`326/353`）。リポジトリ層は `tx *sql.Tx` を引数で受けるのみで、自分では開かない。

### 1-2. 2 メソッドの現在のシグネチャ（**ボードの伝聞は正しかった**）

| メソッド | 変更前 | 変更後 |
|---|---|---|
| `RecomputePresetCache` | `(ctx, presetID)` — **4 兄弟で唯一 `*sql.Tx` を取らない** | **据え置き**（理由は §3） |
| `DeletePresetCache` | `(ctx, tx, presetID)` | 据え置き（読みを tx へ寄せた） |
| `RecomputeComboCache` / `DeleteComboCache` | `(ctx, tx, id)` | 変更なし |

両メソッドとも**コンボ・セットプレイの両方**が対象で、`SUPP-001` §7.1 の v1.13.0 拡張は as-built で成立している。`notation.service` は `*sql.DB` を持たずリポジトリ 3 本だけを持っていた。

### 1-3. 読み出しキーの独立した固定値（**D-313 の記録より 1 多かった**）

**3 か所**あった（`D-313` は 2 か所と記録している）。

| # | 位置 | 形 |
|---|---|---|
| 1 | `internal/model/recipe.go:7` | `const DefaultPresetID = "1"` |
| 2 | `internal/service/combo/service.go:324` | `const defaultPresetID = "1"`（private 複製） |
| 3 | `internal/service/setup/service.go:665` | `const defaultPresetID = "1"`（private 複製） |

**★4 つ目として `internal/config/config.go:113` の `PresetID: 1` があるが、これは残骸ではない**——設定そのものの既定値であり、読み出しキーを設定から取らずにバイパスしている箇所ではない。

**★`model.ExtractDefaultRecipe` の呼出元に `internal/service/punishfinder/`（2 か所）と `internal/service/punishlist/`（1 か所）が含まれていた。** これが D-360 で裁定を要した衝突の実体である。`internal/service/setplay/` は `recipe_cache` を読まないため diff 0 は自然に満たす。

### 1-4. `config` の検証の現在地

**値域のみ、しかも 2 か所に重複していた**——`internal/service/config/service.go:285`（更新時・422）と `internal/config/config.go:225`（起動ロード時）。いずれも `< 1` を見るだけで DB 上の実在を見ない。config サービスは **`database/sql` を import しておらず、DB 依存を一切持っていなかった**（followup の記録どおり）。

### 1-5. `migrations/` の disk 末尾

**`000075`**。ボードの記録（次に払い出す番号 `000076` / disk 末尾 `000075`）と**一致**。**再請求は不要**であり、本サブは 0 本を消費した（diff 0）。

### 1-6. 実在しない `preset_id` を指した状態での起動時の現在の挙動

**黙って素通りしていた。** `preset_id = 999` でも起動は成功し、ログも出ず、フォールバックもせず、**表示にも一切影響しなかった**（読み出しキーが固定値 `"1"` だったため）。

**★ここが §4.2 と §4.3 を不可分にする理由である。** 追随させると同じ状態で `m[key]` が map ミス → 空文字 → **レシピ行が黙って消える**（extractor は miss をエラーにせず `""` を返す）。指示書 v1.2.0 §4.2 の注記はこの実査を受けたものである。

### 1-7. `P-34` の抽出条件（**見込みどおり 27 件**）

§6 に全件を載せた。**★27 件すべてが `original_move_code`（派生元）も空**であり、これが除外した 272 件（`category = rush_variant`）との判別条件だった。

### 1-8. 再計算の実行時間（**桁で外れていない。停止条件 1 は発動せず**）

**53 エンティティ（有効 combos 39 ＋ 有効 setups 14）・212 move step で 5.5 / 6.5 / 5.6 ms（3 回計測）。**

`dbtest.Setup` のクリーン DB へ `D-303` と同数のエンティティを投入して測った（計測用テストは実測後に削除済み）。`D-292` / `D-303` が eager を確定させた前提と桁で外れていない。

### 1-9. 実装形を決めた追加の実測（**指示書に無いが決定的だった 2 点**）

1. **★再計算の読みはトランザクション非対応だった。** `RecomputePresetCache` → `ComputeSingleCache` → `resolveRecipe` → `resolveMoveStep` → `presetRepo.FindAlias` / `FindPresetByID` / `FindPresetByCode` が**すべて `r.db` 直読み**で、渡された tx を見ない。
2. **★`sql.DB` のプールは無制限で `busy_timeout = 5000`**（`internal/infra/db/db.go`）。開いている書き込み tx の内側から非 tx の UPDATE を撃つと別コネクションになり競合する。

**⇒ この 2 点が D-360 の裁定（案 A）の根拠になった。** 実際に陽性対照で確かめてある（§5-2）。

---

## 2. as-built（`CHANGE-102` の反映に必要な 5 点）

### 2-1. どの経路から再計算を呼んだか

| 経路 | 位置 | 形 |
|---|---|---|
| **作成兼コピー**（`POST /api/presets`） | `preset.Create` の **`tx.Commit()` の後** | `RecomputePresetCache(ctx, newID)` |
| **エイリアス／名前更新**（`PUT /api/presets/{id}`） | `preset.Update` の **`tx.Commit()` の後** | `RecomputePresetCache(ctx, id)` |
| **削除**（`DELETE /api/presets/{id}`） | `preset.Delete` の**既存 tx の内側**（子行削除の前） | `DeletePresetCache(ctx, tx, id)` |
| **既定プリセットの切替**（`PUT /api/config`） | config 更新の成功後 | `RecomputePresetCache(ctx, 切替先ID)` |

呼び出しは**利用者の操作で分岐させていない**（eager。「変更が小さいときは呼ばない」のような最適化は入れていない）。`preset.New` に notation サービスを注入した（`preset` → `notation` の依存。`notation` は preset の**リポジトリ**にのみ依存しており循環しない）。

### 2-2. 既定プリセットの読み出しキーをどこへ寄せたか

**`model.ExtractDefaultRecipe(cache *string, presetID int64) string` へ寄せ、値は注入で渡す**（D-360＝案 B）。`model/recipe.go` のコメントが以前から「将来それら 2 箇所を寄せる先も本関数とする」と指名していた先である。

- **固定値 3 か所をすべて撤去した。** `combo` / `setup` の private 複製（定数＋関数）は削除。
- **注入は既存イディオムに揃えた**——`defaultPresetID func() int64`（`preset.New` が config を関数で受けるのと同形）。`cmd/combomgr/main.go` に**クロージャを 1 つだけ**置き、5 サービス（`preset` / `combo` / `setup` / `punishfinder` / `punishlist`）へ配る。
- **★可変なプロセス状態は作っていない**（§4.2 注記 2）。共有関数が内部に「現在の既定プリセット ID」を持つ形は採らなかった。

### 2-3. `config` の実在確認をどの層に置き、起動時にどう振る舞わせたか

**関数注入で config サービスへ渡した**（`PresetExistsFunc` / `DefaultPresetChangedFunc`）。**config サービスは preset パッケージ・DB・notation のいずれにも直接依存していない。**

- **更新時**: `validateConfig` の後に実在検査を足し、不在なら **422 `validation_failed`**（`field: "defaults.presetId"` / `message: "preset {id} does not exist"`）。**★既定プリセットが変わるときだけ検査する**（他項目だけの部分更新で無駄な DB アクセスを増やさないため）。
- **起動時**: `cmd/combomgr/main.go` の `ensureDefaultPresetExists()`。DB / repo が揃った直後に実在を検査し、不在なら **`slog.Warn` を出して組み込み既定へ倒す**。**起動は止めない**（D-358）。
- **倒し先は `model.PresetCodeOfficialJaMove` からプリセットを引いて解決している。** ★固定値 `1` を再導入していない——`presets.id` は 1 / 3 / 5 と欠番があり（`migrations/000069`）、番号を直書きすると本サブが撤去した「既定 = ID 1」の暗黙前提が別の形で復活する。
- **★`config.toml` へは書き戻していない**（倒すのはメモリ上の値だけ）。**推測で決めた**——env 上書き値の焼き付き followup `config-toml-write-back-env-asymmetry` に触れないため。実機で書き戻されないことを確認済み（§5-4）。
- **画面への告知は行っていない**（D-358）。

**★`internal/config/config.go:225` のロード時 validate は値域のまま据え置いた。** DB が開く前に走るため実在を見られない。

**DES-006 に増える検証の内容**（**製造は採番していない**＝§4.3-5）:

> **`config` の `[defaults] preset_id` が `presets` に実在すること。** 違反時は `PUT /api/config` が 422 `validation_failed` を返し、`issues[]` に `{field: "defaults.presetId", message: "preset {id} does not exist"}` を含む。起動時に違反を検出した場合は拒否ではなく組み込み既定（`official_ja_move`）へフォールバックし `WARN` を残す。

### 2-4. 再計算の境界をどう取ったか

**D-360 の案 A。書き込みをコミットしたあとに、再計算だけを 1 つの境界で走らせる。**

**★`RecomputePresetCache` は `*sql.Tx` を取らない形を採った**（§4.4-4 が実装判断に委ねた点）。**理由**——§4.4-4 は「tx を取るなら読みにも使う」ことを求める。取る形にすると resolver とリポジトリ 3 本の読み経路を tx 対応にする必要があり、**それは設計卓が費用対効果で退けた案 B そのもの**になる。⇒ 呼び出し元ではなく**本メソッドが自分で境界を持つ**形にした（内部で `BeginTx` → ループ全体 → `Commit`。書き込みは `UpdateRecipeCacheTx` 系へ寄せた）。tx を引数に取らないことで「この tx の内側で呼んでよい」という誤った招待も出さない。

**`DeletePresetCache` は tx を取り続け、§4.4-4 に従って読みも同じ tx を通すようにした。** そのために `ListAllActiveCombos` / `ListAllActiveSetups` を `...Tx(ctx, tx)` へ変えた（combo / setup 両リポジトリは既に `runner(tx)` ヘルパを持っており機械的な変更。呼出元は notation だけで、他に影響しない）。

**★`SUPP-001` §7.5.4 から外れるのは作成・エイリアス更新の 2 経路だけである。これは逸脱ではなく明示的な例外である**（§4.4-6・D-360）。同節が守ろうとしている不変条件は「保存とキャッシュが食い違わないこと」だが、**ここでの食い違いは stale であって不整合ではない**——真実は `preset_aliases` にあり、再実行で回復できる。**削除経路は §7.5.4 の流儀どおり同一 tx 内**である（§4.4-7）。

**帰結として「保存は成功したが再計算に失敗した」状態が原理的に生じる。これは設計どおりであり**（D-360。`D-356` で開発者が許容した形と同じ）、**失敗は握り潰さず呼び出し元へ返している**（§4.4-2）。

**★挙動差を 1 件報告する**——非 tx の `UpdateRecipeCache` は `updated_at` を bump するが、`UpdateRecipeCacheTx` は bump **しない**。tx 版へ寄せたため、**エイリアス編集で全コンボの `updated_at` が動かなくなった**。望ましい方向（キャッシュの作り直しは利用者によるコンボの編集ではない）だが、挙動が変わった事実として記録する。`RecomputeComboCache` は元から tx 版を使っており、そちらに揃った形になる。

### 2-5. `P-34` の 27 行の列挙結果

§6 に載せた。

---

## 3. `SUPP-001` / `architecture-patterns` と as-built の食い違い（**是正は設計卓の手番**）

| # | 記述 | as-built | 備考 |
|---|---|---|---|
| 1 | **§7.1**「当該プリセットの recipe_cache 全エントリを **delete → insert**」 | **インライン JSON の当該キーを行単位で UPDATE する**（`combos.recipe_cache` / `setups.recipe_cache` は JSON カラムであり、`recipe_cache` という**テーブルは存在しない**） | **D-303** の実測どおり。§7.1 の他の行（`RecomputeComboCache` 等）も同じ食い違いを持つ |
| 2 | **§7.1**「`RecomputePresetCache(presetID) error`」 | シグネチャは一致するが、**★同メソッドだけが tx を取らない**という重要な性質が書かれていない | **★これは誰かが必ず踏む地雷である**（設計卓の指摘どおり）。M20-05 で「コミット後に呼ぶ」という呼び出し規約をインタフェース宣言のコメントへ明記した |
| 3 | **§7.2**「`internal/service/preset/create.go` / `update_aliases.go` / `delete.go`」 | **いずれも存在しない。`service.go` の 1 ファイル**（§1-1） | 同表は M4 期の想定 |
| 4 | **§7.2** 呼出元表がプリセット側 3 行を挙げる | **as-built は 3 経路**だが、内訳が違う——「作成」と「コピー」が同一経路で、代わりに**「既定プリセットの切替」（`PUT /api/config`）が呼出元に加わる**（§4.2-3） | **★§7.2 に `config` 起点の行が無い**。追記が要る |
| 5 | **§7.4.1**「デフォルトプリセット = プリセット ID 1 を暗黙前提とする」＋「実装箇所＝`combo/service.go` の `extractDefaultRecipe()` 内 `defaultPresetID = "1"`」 | **本サブで失効した。** 固定値は 3 か所すべて撤去し、config から注入する形になった | **§7.4.3**「ID 体系変更時に同期更新が必要な箇所」も、注入 1 か所になったため失効 |
| 6 | **§7.3**「`config.preset_id` の実在確認は半分だけ」 | **本サブで完成した**（更新時＋起動時の両方） | followup `preset-config-preset-id-existence` は解消 |
| 7 | **`architecture-patterns` §9.2**「再計算のトリガは未実装。トリガを引く機能自体がフェーズ3 だから」 | **本サブで接続済み** | コード内コメント側は §7 で是正済み。**同書本体の是正は設計卓の手番** |

---

## 4. `punishfinder` の変更行（**D-360 の例外の範囲内**）

**`internal/service/punishfinder/service.go` のみ。候補集合の算出には一切触れていない。**

| # | 行 | 内容 |
|---|---|---|
| 1 | `service struct` へ 1 フィールド | `defaultPresetID func() int64` を追加（＋説明コメント） |
| 2 | `New` のシグネチャ | `New(repo, combos)` → `New(repo, combos, defaultPresetID)` |
| 3 | 新規ヘルパ 1 本 | `func (s *service) defaultRecipe(cache *string) string`（`model.ExtractDefaultRecipe` に注入値を渡すだけ） |
| 4 | 呼び出し 2 か所 | `Recipe: model.ExtractDefaultRecipe(e.RecipeCache)` → `Recipe: s.defaultRecipe(e.RecipeCache)`（`service.go:220` / `:330`） |

**走査述語・レーン分け・除外規則・手動確認レーンの振り分け・`moves` の読み方は 1 文字も変えていない。**

**★diff 0 を外した代わりに、不変条件そのものを測る検査を置いた**（§5 (n)＝`TestScan_DefaultPresetChange_DoesNotAffectCandidates`）。既定プリセットを変えて 2 回走査し、**Recipe を除いた候補集合の形**（相手技 ID・始動技 ID・レーン・コンボ ID 集合・手動確認レーン）が完全一致することを主張する。**陽性対照も入れてある**——表示文字列のほうは実際に変わることを確認しており、変わらなければ「注入が効いておらず本テストが何も測っていない」として落ちる。

**`internal/service/punishlist/` も同形の変更をした**（構造体フィールド＋`New` の引数＋ヘルパ＋呼び出し 1 か所、および `groupByOpponentMove` をメソッド化）。**同パッケージは凍結対象ではない**が、`model.ExtractDefaultRecipe` の呼出元であるため必然的に触った。

---

## 5. 自己テスト結果

### 5-1. 各種テスト

| 種別 | 結果 |
|---|---|
| `go test ./...` | **全緑。47 パッケージ**（`ok` を返したもの。他に `[no test files]` が 9 件） |
| `go vet ./...` | **0 件** |
| `gofmt` | 未整形 0 件 |
| `pnpm test`（vitest） | **全緑。135 テストファイル / 1156 テスト** |
| `make e2e` | **84 passed / 0 failed。フルスイート完走**（1.5 分） |

**E2E の環境準備**（`remote-ops` §5.1.1）: **手順 0**＝E2E ポート（47390 / 5273）の残プロセスを確認（無し）→ **手順 1**＝`cp config.toml.example config.toml` → **手順 2**＝`PW_EXECUTABLE_PATH=/opt/pw-browsers/chromium`。**フルスイートで落ちた件数は 0 件のため、小バッチでの切り分けは不要だった。**

### 5-2. 追加したテスト（§5 の (a)〜(n) のうち本サブが新設する 9 本）

| 記号 | テスト | 置き場 |
|---|---|---|
| (a) | `Test_Update_RefreshesRecipeCache` | `internal/service/preset/recipe_cache_wiring_test.go` |
| (b) | `Test_Create_PopulatesRecipeCache` | 同上 |
| (c) | `Test_Delete_RemovesRecipeCacheEntry` | 同上 |
| **(l)** | `Test_Update_RecomputesAfterCommit` | 同上 |
| (f)(g) | `Test_Update_RecomputeFailure_IsAtomicAndVisible` | 同上 |
| (d) | `Test_ConfigUpdate_RecomputesSwitchedPreset` ／ `Test_ConfigUpdate_NoRecomputeWhenUnchanged` | `internal/service/preset/default_preset_test.go` |
| (e) | `Test_DefaultRecipe_FollowsConfig` | 同上 |
| (h) | `Test_ConfigUpdate_RejectsNonexistentPreset` | 同上 |
| (i)(m) | `TestEnsureDefaultPresetExists_FallsBackAndLogs` ／ `_KeepsValidValue` ／ `_RecipeRowSurvives` | `cmd/combomgr/default_preset_test.go` |
| **(n)** | `TestScan_DefaultPresetChange_DoesNotAffectCandidates` | `internal/service/punishfinder/default_preset_test.go` |
| (j)(k) | 既存資産（M20-04 の保護・上限テスト、コンボ側再計算経路のテスト）が全緑 | — |

**★(l) の検出力を陽性対照で確かめた。** 再計算の呼び出しを一時的にコミット前へ移すと、`Test_Update_RecomputesAfterCommit` が落ちる（`SQLITE_BUSY` ＝ §1-9 で予見した競合がそのまま顕在化した）。**このテストは「順序が壊れたこと」を実際に検出する。** 対照実験のあとコードは元へ戻し、差分が無いことを `git diff` で確認済み。

**★(f) は 2 コンボ以上でないと主張が成立しない。** 1 本だと「先行行が残っていない」ことを言えないため、フィクスチャはコンボを 2 本置き、2 回目の `UpdateRecipeCacheTx` で失敗を注入している。

### 5-3. E2E の配置についての判断（**報告事項**）

**カスタムプリセットを作る 2 本を `m20-04-preset-management.spec.ts` と同一ファイルに置いた。**

**理由**——`playwright.config.ts` は `fullyParallel: false` だが、**ファイル単位では並列に走る**。E2E スタックはバックエンド 1 本・DB 1 個の共有資源であり、別ファイルへ置くと M20-05 のテストがカスタムプリセットを保持している間に M20-04 の「上限 8 件」テストが 5 件目を作れず落ちる（**実測で再現。単独実行では 4/4 緑だった**）。同一ファイル内は直列に走るため衝突しない。**プリセットを作らない 2 本は `m20-05-recipe-cache-wiring.spec.ts` に置いた。**

**★横断課題として followup へ記録した**（`e2e-shared-global-resource-parallel`）。本サブ固有ではなく、**今後グローバル資源を触る spec を足すたびに同じ罠がある**。

### 5-4. 実機での 1 周（`make run-server`）

`logs/combomgr.log`（JSON）で **`"migration completed" version=75`** を確認。以下を実測した。

| # | 操作 | 結果 |
|---|---|---|
| 1 | `POST /api/presets`（`srk` コピー） | 201。`id=6` |
| 2 | `GET /api/combos/1/recipe?preset_id=6`（編集前） | `"236236K (CA)"` |
| 3 | `PUT /api/presets/6`（エイリアスを「実機テスト表記」へ） | 200 |
| 4 | 同じ `GET`（編集後） | **`"実機テスト表記"`** ← **stale が解消している** |
| 5 | `GET /api/combos/1` (既定=1) | `defaultRecipe: "CA 真・昇龍拳"` |
| 6 | `PUT /api/config {defaults:{presetId:6}}` → 同じ `GET` | **`defaultRecipe: "実機テスト表記"`** ← **追随している** |
| 7 | `PUT /api/config {defaults:{presetId:999999}}` | **422** `validation_failed` / `"preset 999999 does not exist"` |
| 8 | `DELETE /api/presets/6` | 204 |
| 9 | 削除後の `recipe_cache` を SQLite で直接確認 | **`keys = ['1','3','5']`** ← **孤児キーなし**。既定の表示も健在 |
| 10 | `config.toml` に `preset_id = 999999` を手書きして再起動 | **起動成功**。`WARN "config defaults.preset_id points to a preset that does not exist; falling back to the builtin default"` / `configured_preset_id=999999` `fallback_preset_id=1` `fallback_preset_code=official_ja_move` |
| 11 | 同状態で `GET /api/combos/1` | **`defaultRecipe` が空にならない**（§5 (m) の実機確認）。`GET /api/config` の応答は `presetId: 1` |
| 12 | `config.toml` を確認 | **`preset_id = 999999` のまま**＝**書き戻していない**（意図どおり） |

**★`make run-web` は起動していない。** 本サブはフロントを 1 行も変えておらず（コメント 1 か所とテストのみ）、画面経由の 1 周は `make e2e`（84 件・ブラウザ実行）が同じ面をカバーしているため。**画面を目視した 1 周ではないことを明記する。**

### 5-5. 開発者の実機確認（**2026-08-14・製造の実装後**）

**製造が実施できなかった画面目視と、挙動が変わった 3 点の確認を依頼し、結果を受領した。**

| # | 確認項目 | 結果 | 解釈 |
|---|---|---|---|
| 1 | **起動時に `WARN` が出ないか** | **出なかった** | **正常。** `config.toml` の `[defaults] preset_id` が実在するプリセットを指している証拠である（**同 `WARN` は不在のときだけ出る**）。⇒ 開発者機では §4.3-3 のフォールバックは発動していない |
| 2 | **設定画面の保存が通るか** | **成功**（新規プリセット作成で確認） | **★厳密には `POST /api/presets` であり、実在検査を足した `PUT /api/config` とは別経路である。** ただし**後者は製造が実機で 200（切替）と 422（実在しない ID の拒否）の両方を実測済み**（§5-4 の 8・10）なので、追加確認は不要と判断した |
| 3 | **既定プリセット切替の体感** | **影響なし**（現在のコンボ数では） | **★大量登録後は未知であり、開発者の依頼で後日課題化した**（followup `recipe-cache-recompute-scale-unmeasured`。§11） |

**⇒ 指示書 §7.2 の完了条件のうち、製造が未実施だった「画面での目視 1 周」は開発者側で確認された。** 未達項目は残っていない。

---

## 6. `P-34` の 27 行（**読むだけ・値は決めていない**）

**実測 27 件（見込みどおり）。** 抽出条件＝`is_derived=true` かつ `command` 空欄かつ `category != rush_variant`。

**再現コマンド**（`notes_tool` に引用符付きカンマが入るため `awk -F,` では誤分割する。Python の `csv` を使う）:

```bash
cd character_data && python3 -c "
import csv,glob
rows=[]
for f in sorted(glob.glob('*.csv')):
    with open(f,newline='',encoding='utf-8') as fh:
        for r in csv.DictReader(fh):
            if r['is_derived'].strip().lower()=='true' and r['command'].strip()=='' and r['category'].strip()!='rush_variant':
                rows.append(r)
print(len(rows))
"
```

**内訳**: 全 1,479 行 → `is_derived=true` 581 行 → `command` 空 299 行 → `rush_variant`（272 行）を除いて **27 行**。
**キャラ別**: manon 7 / marisa 6 / rashid 6 / jp 2 / kimberly 2 / lily 2 / guile 1 / m_bison 1。**category 別**: `special` 21 / `unique` 6。

### 6-1. ★最重要の一次情報: 27 件すべてが「派生元の指定も空」である

**除外した 272 件（`rush_variant`）は `original_move_code` に基底技を持つため、段階1 解決で到達できる**（`command-correction-history.md:601`「rush は original_move_code で段階1解決(空維持)」）。**27 件はコマンドも派生元も持たない**——つまり**現状どの経路からも解決できない**。これが 272 件との判別条件であり、値決めに直接効く。

### 6-2. (a) 入力が無いために派生する技（**値を決める対象**）— 18 件

**repo 内に「割り当てない」旨の一次記録があるものを (a) とした**（`character_data/command-correction-history.md`）。

| # | character | move_code | category | name_ja | 派生元 | 根拠（同ファイル内の行） |
|---|---|---|---|---|---|---|
| 1 | kimberly | `arc_step` | unique→special | 弧空 | 空 | `:398` 公式側も command 空(入力表現なし) ／ `:409` 割り当てない(確定) ／ `:493` 教訓11 |
| 2 | kimberly | `arc_step_od` | special | OD弧空 | 空 | 同上（`:397`） |
| 3 | lily | `condor_dive_follow_up` | special | コンドルダイブ(派生) | 空 | `:396` 公式は 1 行に統合され派生時の実入力を特定できない ／ `:408` 割り当てない(確定) |
| 4 | lily | `windclad_od_condor_dive_follow_up` | special | ODコンドルダイブ(派生) | 空 | 同上（`:395`・`:408`） |
| 5 | jp | `departure_shadow_od` | special | ODヴィーハト・チェーニ | 空 | `:686` **派生技のため command なしで確定（開発者回答）** |
| 6 | jp | `departure_window_double_warp_od` | special | ODヴィーハト・アクノ(二連続ワープ) | 空 | `notes_tool`「ODで二連続で使うと1回目のrecoveryが2F減るので別枠」＝**同一入力の別枠行** |
| 7 | marisa | `scutum_counterattack` | special | スクトゥム(当身) | 空 | `:831` 公式側も command 空(条件欄に「スクトゥム中に打撃を受ける」のみ)＝教訓11。割り当てない |
| 8 | marisa | `scutum_counterattack_od` | special | ODスクトゥム(当身) | 空 | 同上（`:831`） |
| 9 | marisa | `tonitrus_1hit_od` | special | ODトニトルス(単発) | 空 | `:830` ODスクトゥム派生。**`departure_shadow_od` の裁定を踏襲して空維持** |
| 10 | marisa | `tonitrus_od` | special | ODトニトルス | 空 | 同上（`:830`） |
| 11 | marisa | `procella_od` | special | ODプロケッラ | 空 | 同上（`:830`） |
| 12 | marisa | `enfold_od` | special | ODエンフォルド | 空 | 同上（`:830`） |
| 13 | m_bison | `psycho_mine_auto_detonation` | special | サイコマイン（自動爆発） | 空 | **自動爆発**＝利用者の入力を伴わない |
| 14 | manon | `renverse_feint_light` | special | 弱ランヴェルセ(フェイント) | 空 | フェイント＝追加入力を**しない**ことで成立する派生。兄弟 4 件とも command 空で、入力を持つ兄弟が無い |
| 15 | manon | `renverse_feint_medium` | special | 中ランヴェルセ(フェイント) | 空 | 同上 |
| 16 | manon | `renverse_feint_heavy` | special | 強ランヴェルセ(フェイント) | 空 | 同上 |
| 17 | manon | `renverse_feint_od` | special | ODランヴェルセ(フェイント) | 空 | 同上 |
| 18 | rashid | `wall_jump` | unique | 三角飛び | 空 | 壁際でのみ成立する移動派生。基底の移動 9 種は**マイグレ `000025` 系が投入し command を持たない** |

> **★14〜18 は repo 内に明示の裁定記録が無い。** 上記は CSV の兄弟行の形（同族が全件 command 空か、入力を持つ兄弟があるか）から読んだものである。**開発者のドメイン知識で覆ってよい。**

### 6-3. (b) 入力があるのに `command` 欄が空いている技（**入力漏れ**＝D-312 と同じ型）— 4 件

**★同族に「command を持つ兄弟」が実在するものだけを (b) とした。** 判断ではなく CSV の形が根拠である。

| # | character | move_code | **category** | name_ja | 派生元 | **command を持つ兄弟** |
|---|---|---|---|---|---|---|
| 1 | guile | `sonic_break` | `special` | ソニックブレイク | 空 | **`sonic_break_od` が `p` を持つ**（`guile.csv`）。`command-correction-history.md:82` にも `sonic_break_od` ← `p` の対応が記録されている |
| 2 | manon | `grand_fouette_light` | `special` | 弱グラン・フェッテ | 空 | **`grand_fouette_od` が `k` を持つ**（`manon.csv`） |
| 3 | manon | `grand_fouette_medium` | `special` | 中グラン・フェッテ | 空 | 同上 |
| 4 | manon | `grand_fouette_heavy` | `special` | 強グラン・フェッテ | 空 | 同上 |

> **★(b) を値決めの対象に混ぜてはならない**（§4.5-3）。これらは「入力が無い技」ではなく、**入力があるのに CSV のセルが空いている**状態である。**⇒ 値を決めるのではなく CSV を埋めるのが筋**であり、`command-correction-history.md:392` に guile の未確定として既に記録がある（同行は `sonic_break_light` という別 code について書かれており、**`sonic_break` 本体は未記録**）。

### 6-4. ★`rashid` の `buffed_*` 5 件の衝突（§4.5-5・**D-337 の指摘どおり該当する**）

上記 (a) 表の外に、**分類が (a) でも (b) でもない扱いにくい 5 件**がある。**27 件の内訳としては (a) 側に数えず、本節で独立に報告する**（合計 18 + 4 + 5 = 27）。

> **★この 5 件を (a) と (b) のどちらに置くかは設計卓の裁定が要る。** **入力は存在する**（基底の移動技と同一）ため形式上は (b) 寄りだが、**基底自体が command を持たない**ため「埋めれば済む」(b) の型には収まらない。**製造が第 3 の枠を立てたのは、(a) に混ぜると「入力が無い技」として値を与える対象になり、(b) に混ぜると「CSV を埋めればよい」と読まれるためである。** どちらも実態と違う。

| # | move_code | **category** | name_ja | 派生元 | 基底の移動系 code |
|---|---|---|---|---|---|
| 1 | `buffed_dash_forward` | `unique` | 【強化】前方ステップ | 空 | `dash_forward` |
| 2 | `buffed_dash_back` | `unique` | 【強化】後方ステップ | 空 | `dash_back` |
| 3 | `buffed_jump_forward` | `unique` | 【強化】前ジャンプ | 空 | `jump_forward` |
| 4 | `buffed_jump_neutral` | `unique` | 【強化】垂直ジャンプ | 空 | `jump_neutral` |
| 5 | `buffed_jump_back` | `unique` | 【強化】後ろジャンプ | 空 | `jump_back` |

**衝突の実体**——rashid の強化状態（気流強化）による派生であり、**入力は基底の移動技とまったく同じ**である。同キャラの `buffed_*` は全 14 件あり、**うち攻撃技 9 件は既に command が補完済み**（`command-correction-history.md:735`・batch 2 で投入。教訓 17「状態変化派生は基底と同一 command」）。**残る 5 件だけが空なのは、基底が移動系だからである。**

**★移動系 9 種は CSV ではなくマイグレが投入しており（`migrations/000025_seed_movement_system_moves_all.up.sql`、rashid は第 3 波 `000054`）、`character_id, code, category` の 3 列だけで command を持たない。** つまり基底自体が command 無しであり、**同じ値を与えると衝突する**という D-337 の懸念は成立する。加えて `moves` に `command` 列は無く（`migrations/000033`）、索引 `move_commands` の `(character_id, token_key)` は**非一意**であるため、**重複入力は表現できてしまうが解決は曖昧になる**。

**★本サブは値を決めていない・投入していない。エイリアスも生成していない。`character_data/` の diff は 0 である。**

---

## 7. §4.6 否定形確認（**最後にコードを触った時点で実施。件数と検査範囲の両方を報告**）

| # | 走査 | 検査範囲 | 見つかった件数 | 対応 |
|---|---|---|---|---|
| 1 | **既定プリセットを表す固定値**（`DefaultPresetID` / `defaultPresetID` / `presetID = 1` / `PresetID: 1` / `["1"]` / `m["1"]`） | Go 本番コード全体（`internal/` ＋ `cmd/`、`_test.go` 除く） | **残骸 0 件** | 当たった 10 行はすべて**注入クロージャの宣言・コメント**。`internal/config/config.go:113` の `PresetID: 1` は**設定そのものの既定値であり残骸ではない**（§4.6-1 の注記どおり） |
| **2-a** | **`M20-05` を「これから／所管」として参照する記述** | Go 本番コード ＋ `web/src` ＋ `web/e2e` | **残骸 3 件** → **全件是正** | `internal/service/preset/doc.go:9`／`web/src/features/preset/api.ts:159`／`web/e2e/m20-04-preset-management.spec.ts:329`。いずれも「再計算は M20-05 の所管（未接続）」と書いており本サブの完了で失効した |
| **2-b** | **`未実装` を含む `recipe_cache` / preset 周辺のコメント** | 同上（`*.go` / `*.ts` / `*.tsx`） | **3 件**（**全件、是正せず＝理由は下記**） | `web/src/features/combo/components/RecipeBuilder.tsx:123`／**`web/src/features/combo/utils.ts:68`**／`web/src/pages/HomePage.test.tsx:67` |
| 3 | **「呼出元が 0 件」を前提にしたテスト資産**（`呼出側なし` / `呼出元が 0` / `本番から呼ばれない` / `M1 内では`） | Go コード全体（テスト含む） | **0 件** | `notation/service.go` の「M1-04 では実装するが M1 内では呼出側なし」は §2-4 の実装で呼び出し規約のコメントへ置き換え済み。**「本番から呼ばれないこと」を固定しているテストは存在しなかった** |

> **★★ 走査 2-b は当初 1 件を取りこぼしていた（2026-08-14・レビュー指摘 高-1 で是正）★★**
>
> **初回の走査は「`未実装` を含む行」を `grep -iE "recipe|preset|cache"` で絞っていた。** ところが**本リポジトリのコメントは日本語であり、「プリセット」「レシピ」「キャッシュ」は ASCII の `preset` / `recipe` / `cache` に一致しない。** ⇒ `web/src/features/combo/utils.ts:68` を落とし、**「`web/src` は 2 件」と実態より少なく報告していた。**
>
> **是正後の走査条件**（再現可能）:
>
> ```bash
> grep -rn "未実装" --include=*.go --include=*.ts --include=*.tsx internal/ cmd/ web/src web/e2e \
>   | grep -iE "recipe|preset|cache|プリセット|レシピ|キャッシュ"
> ```
>
> **★教訓**——**否定形確認のキーワードは、コメントが書かれている言語で書くこと。** ASCII の識別子だけを網にすると、日本語コメントの残骸は構造的に見えない。

**★是正しなかった 3 件を報告する**（いずれも本サブが作ったものではない）:

- **`web/src/features/combo/components/RecipeBuilder.tsx:123`**「プリセット未実装のため技名で近似」——**レシピ入力面であり §2.2-1 で diff 0 が要求されている**（`M21-04` と並走中）。触らなかった。
- **★`web/src/features/combo/utils.ts:68`**「プリセット未実装の現状ではサーバも公式日本語へフォールバックするため実質的に一致する」——**本サブで失効した記述である**（既定プリセットが `config` に追随するため、サーバの正規 notation は `numeric` にもカスタムにもなり、「サーバも公式日本語へフォールバックする」前提は成り立たない）。**しかし触っていない**——`formatRecipeLine` の呼出元は `RecipeBuilder.tsx`（レシピ入力面）と `SetupInputRow.tsx`（セットプレイ入力面）の 2 つだけで、**§2.2-1 の diff 0 要求の範囲にある**（実査で確認）。**★是正は `M21-04` 完了後の手番として設計卓へ回す。** 実害は「既定プリセットを切り替えた利用者に、編集中プレビュー（公式日本語固定）と保存後表示が食い違う」こと——**これは本サブが作った差ではなく、追随を入れたことで顕在化した既存の近似の限界である。**
- **`web/src/pages/HomePage.test.tsx:67`**「`/presets` が未実装で」——M20-04 で `/presets` は実装済み。**本サブのスコープ外**（M20-04 の残骸）。

---

## 8. 品質チェック / 契約

| 項目 | 結果 |
|---|---|
| `go vet` 相当のエラー | **0 件** |
| `fmt.Println` の本番混入 | **0 件**（追加なし） |
| `nolint` の追加 | **0 件** |
| `web/src/features/gamepad/` ／ レシピ入力面 ／ セットプレイ入力面 | **diff 0** |
| `internal/service/setplay/` ／ `internal/moveindex/` | **diff 0**（契約 F-3 / F-4） |
| `internal/service/punishfinder/` | **例外の範囲内**。変更行は §4 に列挙。候補集合の算出に触れていないことを §5 (n) で振る舞いから固定 |
| `migrations/` ／ `scripts/` ／ `docs/design/` ／ `character_data/` | **diff 0** |
| 契約 F-2 の形 | **不変**。`RecipeResponse.presetId` はクエリパラメータのエコーのまま／queryKey `["combo", comboId, "recipe", presetId]` 不変／config の `[defaults] preset_id` の構造不変 |
| エラーの wrap | 追加した経路はすべて `fmt.Errorf("...: %w", err)` |
| `context.Context` を第一引数に取る | 既存の形を崩していない |

### 常設検査

| 検査 | 結果 |
|---|---|
| `scripts/check-artifact-integrity.sh`（**1 本目**） | **違反なし**（検査 11 件 ／ 生成物 4 件すべて OK） |
| `scripts/check-progress-log-index.sh` | §9 参照 |
| `scripts/check-stop-discipline.sh` | §9 参照 |
| `scripts/check-doc-refs.sh` | dead reference なし |
| `scripts/check-browser-storage-keys.sh` | 違反なし（台帳 8 件 / 実装 7 件が一致） |
| `scripts/check-enum-sync.sh` | ベースラインどおり（増加なし） |
| `scripts/check-instruction-format.sh` | ベースラインどおり（増加なし） |
| `scripts/check-md-emphasis.sh` | 違反なし。**372 行 / ベースライン 373 行**（1 行減少） |
| `scripts/check-doc-inventory.sh` | 型に無いファイル 2 件（`docs/handover/m20-desk-startup-prompt.md` ／ `docs/process/m21-measurement-scope-assessment.md`）。**いずれも本サブが作ったものではない**。情報提供型のため exit 0 |

> **★`check-artifact-integrity.sh` は初回赤だった。** 原因は**クラウド実行環境に `markdown-it-py` が入っていなかった**ことで、`check-md-emphasis.sh` の自己検査が「未実行」で落ちていた（**本スクリプトは依存欠落時に緑を返さない設計になっており、正しく振る舞っていた**）。`pip install markdown-it-py` の後は全緑。**本サブの変更起因ではない。**
>
> **★`check-md-emphasis.sh` が「BASELINE_BROKEN を 372 へ更新してよい」と出しているが、更新していない。** `scripts/` は §2.2-6 で diff 0 が要求されている（`M21-04` と並走中でベースライン定数を触ると片方の増分が隠れる＝**D-335** の再演）。**設計卓／改善レーンの手番として報告する。**

---

## 9. ドキュメント

- **`docs/progress/progress-log.md` へ索引行を追記した。** 追記行は実際に目視で確認している。**★`check-progress-log-index.sh` の緑を「追記した証明」として引いていない**（同スクリプトは「ID が本文のどこかに現れれば緑になる」と自ら明記している）。
- **`docs/handover/followup-backlog.md`** へ横断課題 1 件を追記（§10）。
- **設計伝達レポート**は `/design_handover_report` で別途生成する。

### 指示書・チェックリストの版

**開発者から渡された v1.2.0 をディスクへ反映した**（`docs/instructions/M20-05-recipe-cache-wiring.md` ／ `docs/instructions/reviews/M20-05-review-checklist.md`）。**理由**——Phase B のレビューはチェックリストを**ディスクから読む**ため、v1.1.0 のままだと `punishfinder` の diff を理由に**裁定どおりの実装が差し戻される**（チェックリスト v1.2.0 自身が `D-323` と同型として警告している事象）。**開発者の指示によりコミットはしていない。**

---

## 10. 併せて更新が要るもの

| 項目 | 状態 |
|---|---|
| **CHANGE 番号の払い出し** | **なし**。`CHANGE-102` は起票済みであり、`change-number-registry.md` §1 への新規登録は不要 |
| **消費したマイグレ連番** | **なし**。`ls migrations/` の実査値は末尾 `000075` のままで、ボード §2.2 の「次に払い出す番号 `000076`」と一致している（ズレなし） |
| **版を上げた文書** | **なし**。指示書・チェックリストの v1.2.0 化は設計卓の改訂を反映したものであり、製造が版を上げたものではない |
| **番号の写し先** | **なし**（番号を消費していないため） |

---

## 11. 横断課題・followup

| ID | 内容 | 記録先 |
|---|---|---|
| `recipe-cache-recompute-scale-unmeasured` | **再計算は eager・同期であり、`PUT /api/config` と `PUT /api/presets` の応答をブロックする。** 実測は **53 エンティティ・212 move step で 5.5〜6.5 ms**、**開発者の実機確認でも体感影響なし**（§5-5）。**ただし当時のコンボ数での話であり、大量登録後は未測定**（**開発者の依頼で後日課題化**）。計算量はエンティティ数 × 1 プリセットの線形で、`configsvc.Update` は `s.mu` 保持中に回す。**★`D-292` の「実件数が閾値を超えたら lazy を再検討する」条件は生きており、桁が変わったら再測定して設計卓が判断する**（製造の独断では変えられない＝§9.4 停止条件 1） | `followup-backlog.md` |
| `e2e-shared-global-resource-parallel` | **E2E spec がグローバル資源（プリセット総数等）を奪い合う。** `playwright.config.ts` は `fullyParallel: false` だが**ファイル単位では並列に走り**、E2E スタックはバックエンド 1 本・DB 1 個の共有資源である。本サブは「同一ファイルへ寄せる」ことで回避したが、**今後グローバル資源を触る spec を足すたびに同じ罠がある**。恒久策（`workers: 1` ／ 資源ごとの排他フィクスチャ ／ 上限テスト側を現在数から相対化）は**全 E2E の実行方針に関わるため設計卓・改善レーンの判断**が要る | `followup-backlog.md` |
| `preset-config-preset-id-existence` | **本サブで解消**（更新時＋起動時の両方を実装） | 同上（状態を更新） |
| `check-md-emphasis` のベースライン | **372 へ更新可**（1 行減少）。`scripts/` diff 0 のため本サブでは触っていない | 本報告書 §8 |

## 12. 推測で進めた事項（**その旨を明示する**＝§9.2）

1. **`RecomputePresetCache` は `*sql.Tx` を取らない形にした**（§4.4-4 が委ねた点）。理由は §2-4。**取る形にすると設計卓が退けた案 B の作業量になる**ため。
2. **起動時フォールバックで `config.toml` へ書き戻していない。** env 上書き値の焼き付き followup に触れないため。**倒すのはメモリ上の値だけ。**
3. **`config` の実在検査は「既定プリセットが変わるとき」だけ走らせている。** 他項目だけの部分更新で無駄な DB アクセスを増やさないため。
4. **`decodeRecipeCache` で壊れた JSON に警告を残すようにした。** 従来は `json.Unmarshal` の戻り値を捨てており、**他プリセットのエントリが消えても痕跡が残らなかった**。**復旧はしていない**（§4.1-2 で再計算の中身を変えないため）。**書き込む JSON の内容は従来と同一である**——**ただし 1 点だけ厳密には違う**（レビュー指摘 低-1）: 旧は `json.Unmarshal` の戻り値を捨てていたため**部分的にデコードできたエントリは残った**が、新は失敗時に空 map を返すため全部落ちる。**壊れた JSON という前提でのみ差が出る話**であり、新のほうが挙動が一貫している。
5. **`internal/service/punishlist/` を触った**（凍結対象ではないが、`model.ExtractDefaultRecipe` の呼出元であるため必然）。
6. **`P-34` の (a)/(b) 分類のうち、repo 内に一次記録が無い 5 件**（manon `renverse_feint_*` 4 件・rashid `wall_jump`）は **CSV の兄弟行の形から読んだ**。**開発者のドメイン知識で覆ってよい。27 行すべては報告に載せてあり、判断を根拠に落とした行は無い。**

---

*以上、M20-05 完了報告。*
