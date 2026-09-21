# M20-05 レビュー報告書

| 項目 | 内容 |
|------|------|
| 対象指示書 | `docs/instructions/M20-05-recipe-cache-wiring.md` **v1.2.0** |
| チェックリスト | `docs/instructions/reviews/M20-05-review-checklist.md` **v1.2.0** |
| 対象完了報告 | `docs/progress/M20-05-completion-report.md` |
| 対象差分 | `55e2d31..HEAD`（4 コミット / 43 ファイル / +2167 -233） |
| レビュー日 | 2026-08-14 |

---

## 総評

**差し戻し事由（チェックリスト §8 の 14 項目）に該当するものは 1 件も無い。** 再計算のロジックは書き直されておらず、書き込み 3 経路（作成兼コピー・エイリアス更新・削除）＋ 既定プリセット切替の計 4 呼出元から `RecomputePresetCache` / `DeletePresetCache` が呼ばれ、境界は D-360 の案 A どおり「コミット後に再計算だけを 1 つの tx で走らせる」形になっている。固定値 3 か所は撤去され、注入は `main.go` のクロージャ 1 か所に集約されている。可変プロセス状態は作られていない。

**とくに評価できるのは検査の作りかたである。** (l) 呼び出し順のテストは「再計算の瞬間に別コネクションからエイリアスを読む」形で順序そのものを固定しており、陽性対照（呼び出しをコミット前へ移すと落ちる）まで確認されている。(n) `punishfinder` 非回帰も件数ではなく候補集合の形で主張し、陽性対照を内蔵している。D-354 が求めた「検査が主張を支えている形」になっている。

**一方で、失効した記述の掃除が不完全である。** §4.6 の否定形確認は `web/src` を範囲に含めながら `web/src/features/combo/utils.ts:68`（「プリセット未実装の現状ではサーバも公式日本語へフォールバックする」）を拾えておらず、`followup-backlog.md` の `recipe-cache-stale-preset-keys` 行は本サブが撤去した `model.DefaultPresetID = "1"` を根拠に「表示影響は無い」と書いたまま残っている。いずれも動作は正しく、テストも lint も型検査も緑になる種類の残骸である。

`P-34` の列挙は 27 行すべてが載っており判断で落とされた行は無いが、`category` 欄が 9 行分だけ欠けている（§4.5-2 の必須列）。

---

## 設計準拠性レビュー結果

| # | 観点（指示書 / チェックリスト） | 評価 | 所見 |
|---|---|---|---|
| 1 | **§4.1 再計算のロジックを書き直していない** | ◎ | `internal/service/preset/service.go` は `notation.Service` を呼ぶだけで、同等処理の複製は無い（`recomputeCache` は wrap 1 枚）。切替経路（`config`）も同じ 2 メソッドを通る（切替専用の再計算は生えていない）。`cache.go` の変更は tx 境界の付与と `decodeRecipeCache` の抽出のみで、対象エンティティ・書き込む JSON の規則は不変 |
| 2 | **§4.1-4 呼び忘れ / eager** | ◎ | as-built の 3 経路（`Create` / `Update` / `Delete`）＋ `PUT /api/config` の 4 か所すべてから呼ばれている。「作成」と「コピー」が同一経路であることは実査で確認済みで、完了報告 §1-1 に理由付きで記載されている。利用者操作による分岐・差分最適化は入っていない |
| 3 | **§4.2 既定プリセットへの追随（注入）** | ◎ | 固定値 3 か所（`model/recipe.go` / `combo/service.go` / `setup/service.go`）を撤去し、`ExtractDefaultRecipe(cache, presetID)` へ寄せた。注入は `main.go:146` のクロージャ 1 本を 5 サービスへ配る形で、共有関数側に可変状態は無い（差し戻し事由 13 に非該当）。`internal/config/config.go:113` の `PresetID: 1` を残した判断も妥当（設定そのものの既定値であり読み出しキーのバイパスではない） |
| 4 | **§4.2-3 切替先の再計算** | ◎ | `configsvc.Update` が `presetSwitched` を**メモリ更新前の値と比較して**判定し、`*s.cfg = next` の後にコールバックを呼ぶ。順序が正しい。`Test_ConfigUpdate_RecomputesSwitchedPreset` が「切替先の 1 回だけ」を固定し、`_NoRecomputeWhenUnchanged` が過剰呼び出しも塞いでいる |
| 5 | **§4.3 `config.preset_id` の実在確認** | ◎ | 更新時＝422 `validation_failed`（`field: defaults.presetId`）、起動時＝`ensureDefaultPresetExists` が `WARN` を出して組み込み既定へ倒し、**起動は止めない**（D-358）。DES-006 に増える検証内容は文章で記載され、番号は採番していない（§4.3-5 遵守）。倒し先を `model.PresetCodeOfficialJaMove` から解決して固定値 `1` を再導入していない点は特筆に値する（`presets.id` に欠番があるという実測に基づく） |
| 6 | **§4.2 と §4.3 の不可分性** | ◎ | 同一コミット `4a1ac14` に両方が入っている。`TestEnsureDefaultPresetExists_RecipeRowSurvives`（§5 (m)）で「実在しない ID を指した状態でもレシピ行が空にならない」ことが固定されている |
| 7 | **§4.4 境界（差し戻し判定 3 本目）** | ◎ | `RecomputePresetCache` が自前で `BeginTx` → 全対象 → `Commit`。途中失敗で 1 行も残らない。`Create` / `Update` は `tx.Commit()` の**後**に呼び、`Delete` は既存 tx の**内側**で `DeletePresetCache` を呼ぶ（§4.4-7 / §7.5.4 の流儀どおり）。書き込み tx の内側で再計算を呼んでいる箇所は無い（差し戻し事由 11 に非該当） |
| 8 | **§4.4-4 tx を取るなら読みにも使う** | ○ | `DeletePresetCache` は `ListAllActiveCombosTx` / `ListAllActiveSetupsTx` へ変更して読みも tx を通しており、要求どおり。`RecomputePresetCache` は tx を取らない形を選び、その理由（取ると resolver とリポジトリ 3 本の tx 対応が要り、設計卓が退けた案 B の作業量になる）を §12-1 で明示している。妥当な判断。**ただし `RecomputeComboCache(ctx, tx, comboID)` は tx を取りながら `ListAllPresets` と `resolveRecipe` 内のエイリアス読みが tx を見ない**（下記「指摘事項」参照。本サブが作った形ではない） |
| 9 | **§4.4-2 失敗の可視性** | ◎ | `recomputeCache` は `%w` で wrap して返し、`Create` / `Update` はその error を上げる。`configsvc.Update` もコールバックの失敗を上げる。握り潰しは無い。`Test_Update_RecomputeFailure_IsAtomicAndVisible` が (f)(g) を 1 本で固定している |
| 10 | **§4.4-5 呼び出し順を固定する検査** | ◎ | `Test_Update_RecomputesAfterCommit`。再計算の瞬間に別コネクションから `preset_aliases` を読み、新しい値が見えることを主張する。**件数ではなく形を固定しており、陽性対照（コミット前へ移すと `SQLITE_BUSY` で落ちる）も実施済み**。D-354 が求めた型に合致している |
| 11 | **§4.4-6 §7.5.4 からの例外の明記** | ◎ | 完了報告 §2-4 に「作成・エイリアス更新の 2 経路だけが外れる」「stale であって不整合ではない」「削除経路は同一 tx 内」が明記され、progress-log 横断課題 7 にも索引されている |
| 12 | **§4.5 `P-34` の列挙** | ○ | 実測 27 件・全件掲載・値は決めていない・投入していない・`character_data/` diff 0・`rashid` `buffed_*` 5 件の衝突にも言及済み。「27 件すべてが `original_move_code` も空」という一次情報は値決めに直接効く良い発見。**ただし §4.5-2 が要求する `category` 欄が (b) 4 行と `buffed_*` 5 行に無い**（下記 中-1）。また (a)/(b) の 2 分類に対し第 3 の枠（`buffed_*`）を立てている——透明に報告されており妥当だが、設計卓が「これは (a) か (b) か」を裁定する必要がある旨は明示されていない |
| 13 | **§4.6 否定形確認** | △ | 件数と検査範囲の両方が報告され、走査 2 で 3 件を是正、是正しなかった 2 件も理由付きで報告されている点は要求どおり。**しかし走査範囲に含めた `web/src` から 1 件取りこぼしている**（下記 高-1）。走査 1（固定値）と走査 3（呼出元 0 件前提のテスト資産）は再走査しても 0 件で、報告と一致した |
| 14 | **契約 F-2 の形** | ◎ | `RecipeResponse.presetId` / queryKey / `[defaults] preset_id` の構造はいずれも差分無し。変わったのは「どの値を読むか」だけ |
| 15 | **契約 F-3 / F-4 と凍結面** | ◎ | `internal/service/setplay/` ・`internal/moveindex/` ・`migrations/` ・`scripts/` ・`docs/design/` ・`character_data/` ・`web/src/features/gamepad/` すべて diff 0（`git diff --stat` で確認）。`punishfinder` の diff は構造体 1 フィールド＋`New` の引数＋ヘルパ 1 本＋呼び出し 2 か所に限られ、走査述語・レーン分け・除外規則は 1 文字も変わっていない（D-360 の例外の範囲内） |
| 16 | **`punishlist` を触ったこと** | ◎ | 凍結対象外であり、`model.ExtractDefaultRecipe` の呼出元として必然。`groupByOpponentMove` のメソッド化も注入値を届けるための最小変更で、グルーピング規則は不変 |
| 17 | **§3 実装品質（wrap / ctx / P-04）** | ◎ | 追加経路のエラーはすべて `fmt.Errorf("...: %w", err)`。サービス層メソッドの ctx 第一引数は維持。削除の主張は「孤児 0 件」の件数観測ではなく、`DeletePresetCache` を tx 内で明示的に呼ぶ実装の形＋「他プリセットの巻き添えが無いこと」の両方で支えられている |
| 18 | **§5 テスト網羅** | ◎ | (a)〜(n) の新設 9 本がすべて存在し、置き場も妥当。最も落ちやすい (f)(g) の失敗注入が `failNthCacheUpdate` で実装され、**コンボ 2 本のフィクスチャで「先行行が残っていない」ことを本当に主張できる形**になっている |
| 19 | **§5 ドキュメント** | ○ | progress-log へ索引行＋横断課題 12 件を追記済み（実行行を目視で確認）。`check-progress-log-index.sh` の緑を証明として引いていない点も要求どおり。`SUPP-001` §7.1 / §7.2 / §7.4 と as-built の食い違いは §3 に 7 件整理されており、設計卓がそのまま反映できる品質。**ただし `followup-backlog.md` に失効行が 1 件残る**（下記 高-2） |
| 20 | **§4 E2E** | ○ | 84 件フルスイート完走。config を書き換える spec が `beforeAll` で元値を退避し `afterAll` で復元しており、初期状態を仮定していない（M20-04 の事故を踏まえた形）。**ただしファイル間のグローバル資源競合が片側しか塞がれていない**（下記 中-2） |
| 21 | **停止規律 §7** | ◎ | 停止に至っていない（再レビュー往復 0 回）。未解消の横断課題は followup へ ID 付きで登録済み |

---

## 設計準拠性以外の指摘事項

### 高-1: `web/src/features/combo/utils.ts:68` に失効した記述が残っている（§4.6 走査の取りこぼし）

```ts
// プリセット未実装の現状ではサーバも公式日本語へフォールバックするため実質的に一致する。
// 将来のプリセット/正規 notation 解決への差し替えは残課題(設計担当連携)。
```

- **なぜ失効か**: 本サブで既定プリセットが `config` に追随するようになったため、サーバの正規 notation は `numeric` にもカスタムプリセットにもなる。「サーバも公式日本語へフォールバックするので近似表記と実質一致する」という前提は**成り立たなくなった**。`formatRecipeLine` は編集中プレビューを `move.nameJa`（公式日本語）で組み立てるため、既定プリセットを切り替えた利用者には**編集中プレビューと保存後表示が食い違う**。
- **なぜ「高」か**: 完了報告 §7 の走査 2 は範囲を「Go 本番コード ＋ `web/src` ＋ `web/e2e`」、キーワードを「`未実装` を含む `recipe_cache` / preset 周辺のコメント」と宣言している。本行は両方に当たるが、**是正 3 件にも「是正しなかった 2 件」にも現れていない**。＝走査結果の件数が実態と合っていない。後任は「`web/src` は掃除済み」と読む。
- **推奨**: 本サブで文言を直せない（`web/src/features/combo/` はレシピ入力面に隣接し、`M21-04` と並走中）なら、`RecipeBuilder.tsx:123` と同様に**「是正しなかったもの」として完了報告 §7 へ 1 行足す**こと。走査の件数だけは実態に合わせる。

### 高-2: `followup-backlog.md` の `recipe-cache-stale-preset-keys` 行が、撤去済みの定数を根拠にしたまま残っている

`docs/handover/followup-backlog.md:318`:

> **表示影響は無い**（読み出しキーは `model.DefaultPresetID = "1"` 固定）… | **M20-05**（`recipe_cache` を扱うサブ＝**D-313**） | **未着手** |

- `model.DefaultPresetID` は本サブで**削除されている**。根拠として書かれた機構が既に存在しない。
- 本サブは同ファイルの**隣の行**（`preset-config-preset-id-existence`）の状態を「解消」へ更新し、新規行も追加している。＝触っているファイルの中で 1 行だけが旧世界のまま残った。
- 「表示影響は無い」という結論自体は今も真だが、**理由が変わった**（現在は「`config` が実在しないプリセット＝欠番 id `2`/`4` を指せないから」であって、「キーが `"1"` 固定だから」ではない）。担当欄が `M20-05` / 状態が `未着手` のままである点も、本サブの完了後の状態と整合しない。
- **なぜ「高」か**: 生きた台帳（継続更新ファイル）の記述であり、次にこの行を読む担当が「読み出しキーは固定値だ」という**撤回済みの前提**を引き継ぐ。テストでも lint でも検出できない。
- **推奨**: 根拠を現在の機構へ書き換え、担当・状態を実態（本サブでキー体系には触れていない／表示影響が無い理由が変わった）に合わせる。**`docs/change-notes/change-report-098.md:88` と `docs/handover/design-reports/*` の同記述は過去時点の記録であり、書き換え不要**（履歴として正しい）。

### 中-1: `P-34` の列挙で 9 行に `category` 欄が無い

- §4.5-2 とチェックリスト §1.6 は「`character_code` ／ `move_code` ／ `category` ／ `name_ja` ／ 派生元の有無」の 5 項目を全件について要求している。
- 完了報告 §6-2（(a) 18 行）は `category` を持つが、**§6-3（(b) 4 行）と §6-4（`buffed_*` 5 行）の表に `category` 列が無い**。集計（`special` 21 / `unique` 6）はあるが行単位では引けない。
- 設計卓が値を決める際、`special` と `unique` で与える値の性質が変わるため実害がある。**表に 1 列足すだけの修正**。

### 中-2: E2E のグローバル資源競合が片側しか塞がれていない

`web/e2e/m20-05-recipe-cache-wiring.spec.ts` の `beforeEach` / `afterEach` は `deleteCustomPresets(page)` で**カスタムプリセットを全削除**する。

- 完了報告 §5-3 と followup `e2e-shared-global-resource-parallel` は「**作る**側を同一ファイルへ寄せて回避した」と説明しているが、**この spec は別ファイルのまま「消す」側でグローバル資源を触っている**。`m20-04-preset-management.spec.ts` の「上限 8 件」テストが 5 件のカスタムプリセットを保持している最中に本 spec の `beforeEach` が走ると、**上限テストが数え損ねる**。
- 今回 84/84 緑なのは実行順が有利だっただけの可能性がある（同じ事象が「単独実行では 4/4 緑」という形で既に一度起きている）。
- **推奨**: followup 側の記述を「作る側を寄せた」から「**作る・消すの両方がグローバル資源に触る**」へ広げるか、本 spec の `deleteCustomPresets` を「自分が作ったものだけを消す」へ絞る（本 spec はプリセットを作らないので、そもそも削除が不要な可能性が高い）。

### 中-3: nil 注入で機能が黙って無効になる形が 8 か所に増えた

| 引数 | nil のときの挙動 |
|---|---|
| `preset.New(..., notationSvc)` | 再計算しない（エイリアス編集が表示へ反映されない） |
| `combo.New(..., defaultPresetID)` / `setup` / `punishfinder` / `punishlist` | `Recipe` / `DefaultRecipe` が空文字 |
| `configsvc.NewService(..., presetExists, onDefaultPresetChanged)` | 実在検査をしない／切替時に再計算しない |

- どれも「テスト用」と godoc に明記されており、`main.go` は全部渡している（実装として現状は正しい）。
- ただし**配線の抜けを検出する検査が無い**。`cmd/combomgr/default_preset_test.go` は `ensureDefaultPresetExists` 単体を見るだけで、DI 配線そのものは見ていない。将来サービスを 1 本足したときに `defaultPresetID` を渡し忘れると、**レシピ行が空になるだけで誰も落ちない**——本サブが §4.2 の注記で警戒した silent failure と同じ形である。
- **推奨**: 恒久策は不要だが、**followup へ 1 行**（「注入漏れを検出する検査が無い」）。あるいは `New` の godoc に留めるのではなく、nil を渡した経路で `slog.Warn` を 1 度出す案もある（本サブ範囲外）。

### 中-4: `RecomputeComboCache` は tx を取りながら preset / alias の読みが tx を見ない（本サブが作った形ではない）

`internal/service/notation/cache.go:62-88` は `tx *sql.Tx` を受け取り、`FindStepsByComboIDTx` は tx を使うが、`ListAllPresets` と `resolveRecipe` 内のエイリアス解決は DB ハンドル直読みである。

- §4.4-4 / チェックリスト §1.5 が「tx を取るのに読みは見ない形は採らない」と言っている形そのもの。
- **今日は害が無い**（コンボ書き込み tx は `presets` / `preset_aliases` を書かないため、読み違いが起きない）。だから本サブで直せという指摘ではない。
- ただし `RecomputePresetCache` の godoc が「tx を取らないのは読みが tx を見ないからだ」と明文化した直後に、**隣のメソッドが逆の形で残っている**。将来「エイリアスを書く tx の内側で `RecomputeComboCache` を呼ぶ」経路が生えると silent に古い表記を書く。
- **推奨**: followup へ 1 行記録（`notation-recompute-combo-cache-tx-read-asymmetry` 等）。完了報告 §3 の「§7.1 に tx の性質が書かれていない」という指摘と同じ束で設計卓へ渡すのが自然。

### 低-1: `decodeRecipeCache` の挙動が旧実装と厳密には同一でない

旧: `json.Unmarshal(...)` の戻り値を捨てていたため、**部分的にデコードできたエントリは `cache` に残った**。新: 失敗時に `map[string]string{}` を返すため全部落ちる。
完了報告 §12-4 は「書き込む JSON の内容は従来と同一である」と言い切っているが、**壊れた JSON が部分デコード可能なケースだけは同一でない**（実害はほぼ無い／新実装のほうが一貫している）。警告を足した判断自体は良い。文言だけの問題。

### 低-2: E2E が `presetId: 1` をハードコードしている

`m20-05-recipe-cache-wiring.spec.ts` / `m20-04-preset-management.spec.ts` の `beforeEach` が `{ defaults: { presetId: 1 } }` を直接投げている。`main.go` は「`presets.id` に欠番があるから番号を直書きしない」として `PresetCodeOfficialJaMove` から解決したのに、**テスト側で同じ前提が復活している**。E2E は使い捨て DB なので現状は落ちないが、seed の id 体系が動いたら意味不明な失敗になる。`listPresets` で `official_ja_move` を引ける関数が同ファイルに既にある。

### 低-3: 新設の関数型が `context.Context` を取らない

`PresetExistsFunc(presetID int64)` / `DefaultPresetChangedFunc(presetID int64)` は ctx を取らず、`main.go` で `run()` の ctx をクロージャに閉じ込めている。`configsvc.Service.Update(req)` が ctx を持たない（§9.4 停止条件 2 により公開形を組み替えられない）ためやむを得ず、判断としては正しい。結果として **`PUT /api/config` のクライアント切断では再計算がキャンセルされない**——これは望ましい方向だが、意図した設計であることがコメントに書かれていないので、将来 ctx を通すときの判断材料が残らない。

### 低-4: `RecomputePresetCache` の read-modify-write と自 tx 外の読み

自前 tx の内側で `ComputeSingleCache` / `resolveRecipe` が DB ハンドル直読みするため、「境界は本メソッドが自分で持つ」という godoc は**書きについてのみ**正しい。また recipe_cache JSON 全体を読んで書き戻す形のため、2 つの再計算が同時に走ると原理的には lost update になりうる（SQLite WAL の deferred tx では実際には `SQLITE_BUSY` で落ちる公算が高く、黙って壊れる形ではない）。単一利用者前提のアプリであり実害は想定しにくい。**指摘というより記録**。

### 低-5: `configsvc.Update` がミューテックス保持中に再計算を走らせる

`s.mu.Lock()` の内側で `onDefaultPresetChanged`（＝DB トランザクション）を呼ぶ。実測 5〜6.5 ms なので現状問題無し。エンティティが桁で増えたときに config API 全体がブロックされる点だけ頭に置いておけばよい。

---

## 推奨修正（優先度別）

### 高（M20 完了前に修正必須）

1. **高-1**: `web/src/features/combo/utils.ts:68` の失効記述を、完了報告 §7 の「是正しなかったもの」へ追記する（コード自体を触れないなら記録だけでよい。走査結果の件数を実態に合わせることが要件）。
2. **高-2**: `docs/handover/followup-backlog.md` の `recipe-cache-stale-preset-keys` 行から、撤去済みの `model.DefaultPresetID = "1"` を根拠とする記述を除き、担当・状態を実態へ合わせる。

### 中（M21 着手と並行可）

3. **中-1**: 完了報告 §6-3 / §6-4 の表に `category` 列を足す（§4.5-2 の必須項目。9 行分）。
4. **中-2**: E2E のグローバル資源競合について、`deleteCustomPresets` を撃つ側も同じ罠であることを followup `e2e-shared-global-resource-parallel` へ書き足す（または本 spec の削除処理を落とす）。
5. **中-3**: 注入漏れを検出する検査が無いことを followup へ 1 行記録する。
6. **中-4**: `RecomputeComboCache` の tx/読み非対称を followup へ 1 行記録し、`SUPP-001` §7.1 の是正と同じ束で設計卓へ渡す。

### 低（将来対応）

7. **低-1**: 完了報告 §12-4 の「書き込む JSON の内容は従来と同一である」に、部分デコード時の差を 1 句添える。
8. **低-2**: E2E の `presetId: 1` を `official_ja_move` からの解決に置き換える。
9. **低-3**: `PresetExistsFunc` / `DefaultPresetChangedFunc` が ctx を取らない理由（`Service.Update` が ctx を持たない／停止条件 2）を型の godoc に 1 行残す。
10. **低-4 / 低-5**: 記録のみ。対応不要。

---

## 良かった点（Claude Code へのフィードバック）

- **★検査が主張を支えている。** (l) 呼び出し順のテストは「別コネクションから未コミットのエイリアスが見えるか」という**機序そのもの**を測っており、陽性対照（コミット前へ移すと落ちる）まで確認されている。(n) `punishfinder` 非回帰も「Recipe を除いた候補集合の形」を突き合わせ、**表示文字列のほうは実際に変わることを確かめて「テストが何も測っていない」状態を排除**している。D-354 が指摘した型を正しく回避できている。
- **(f) のフィクスチャがコンボ 2 本である理由を明示している。** 1 本では「先行行が残っていない」を主張できない——この種の「テストが成立する条件」をコメントで残す形は、後任が縮めてしまう事故を防ぐ。
- **★倒し先を固定値 `1` にしなかった判断が良い。** `presets.id` に欠番（1/3/5）がある実測を根拠に `PresetCodeOfficialJaMove` から解決しており、**撤去した暗黙前提を別の場所で復活させていない**。この種の「直したつもりで別経路に残す」パターンを自力で避けている。
- **§3 の食い違い表（7 件）が設計卓にそのまま渡せる品質。** とくに「`RecomputePresetCache` だけが tx を取らないという性質が `SUPP-001` §7.1 に書かれていない＝誰かが必ず踏む」の指摘は、本サブで実際に踏みかけた実測に裏打ちされている。
- **実査で見込みが覆った点を、理由付きで全部書いている。** 「4 経路 → as-built は 3 経路」「固定値 2 か所 → 3 か所」「`create.go` 等は存在せず `service.go` 1 ファイル」——いずれも設計卓の記述を黙って実装へ寄せず、覆した理由を残している（§4.1-3 の求める形）。
- **E2E が `config.toml` の初期状態を仮定せず、退避と復元を実装している。** M20-04 で開発者機だけ落ちた事故を踏まえた対応になっている。
- **`scripts/check-md-emphasis.sh` のベースライン更新を「できるが、しない」と判断した**（`scripts/` diff 0・D-335 の再演回避）。緑にする誘惑に乗らず、設計卓の手番として報告へ回した判断は正しい。

---

## 制約事項

- 本レビューはコード上で判定可能な範囲のみ対象。実際の動作確認・パフォーマンス・実機テストは別途実施が必要。
- **テストは実行していない**（時間制約により省略）。`go build ./...` と `go vet ./internal/service/... ./cmd/...` のみ実行し、いずれも 0 件。`go test ./...` / `pnpm test` / `make e2e` の結果は完了報告 §5-1 の自己申告を採用した。
- チェックリスト §9「判定してはいけないこと」（eager/lazy、実在確認の層、成否の畳み込み、失敗の見せ方、一時的な stale、env 上書きの焼き付き、`*config.Config` の無同期リード、`P-34` の値の良し悪し、2 トランザクションに分かれること自体、`SUPP-001` §7.5.4 との不一致それ自体、`punishfinder` に diff があること自体、起動時告知の不在）は判定対象から除外した。
- `docs/handover/` 配下は全読込していない（実測 87 ファイル・約 3.0MB）。`followup-backlog.md` は本サブの差分該当箇所のみ確認した。
- `SUPP-001` は §7（1202〜1345 行）のみ読んだ。

---

## 取り込み結果（自動トリアージ）

| 指摘 | 優先度 | 採否 | 理由 / 対応 |
|---|---|---|---|
| **高-1** `web/src/features/combo/utils.ts:68` の失効記述を §4.6 走査が取りこぼしている | 高 | **採用** | **指摘は正しい。走査の欠陥を再現で確認した**——初回の走査は「`未実装` を含む行」を `grep -iE "recipe|preset|cache"` で絞っていたが、**本リポジトリのコメントは日本語であり「プリセット」は ASCII の `preset` に一致しない**。⇒ **走査を是正して回し直した**（キーワードに `プリセット|レシピ|キャッシュ` を追加）。真の件数は **3 件**（`RecipeBuilder.tsx:123` ／ `utils.ts:68` ／ `HomePage.test.tsx:67`）。完了報告 §7 を走査 2-a / 2-b に分割し、**取りこぼしの原因と再現可能な是正後コマンド、教訓を明記**した。**`utils.ts` 自体は触っていない**——`formatRecipeLine` の呼出元は `RecipeBuilder.tsx`（レシピ入力面）と `SetupInputRow.tsx`（セットプレイ入力面）の 2 つだけで、**§2.2-1 の diff 0 要求の範囲にある**（実査で確認）。是正は `M21-04` 完了後の手番として設計卓へ回す旨を報告へ記載 |
| **高-2** `followup-backlog.md` の `recipe-cache-stale-preset-keys` が撤去済み定数を根拠にしている | 高 | **採用** | 指摘どおり `model.DefaultPresetID` は本サブで削除済み。**根拠を現在の機構へ書き換えた**（「表示影響が無い理由は、`config` が実在しないプリセットを指せないから」）。**担当欄を `M20-05` → `未割付` へ、状態を「未着手（根拠のみ 2026-08-14 更新）」へ修正**。★本サブはキー体系に触れていないため掃除自体は別サブ／改善レーンの手番であることを明記 |
| **中-1** `P-34` の 9 行に `category` 欄が無い | 中 | **採用** | §4.5-2 の必須列。§6-3（(b) 4 行）と §6-4（`buffed_*` 5 行）の表へ `category` 列（＋ §6-4 は派生元列も）を追加。**あわせて「`buffed_*` 5 件を (a)/(b) のどちらに置くかは設計卓の裁定が要る」ことを明記**（製造が第 3 の枠を立てた理由も記載） |
| **中-2** E2E のグローバル資源競合が片側しか塞がれていない | 中 | **採用** | 指摘どおり「消す側」も同じ罠だった。**`m20-05-recipe-cache-wiring.spec.ts` から `deleteCustomPresets` を除去**（同 spec はプリセットを作らないため削除も不要だった）。**あわせて followup `e2e-shared-global-resource-parallel` の記述を「作る側」だけでなく「消す側」も含む形へ広げた** |
| **中-3** 注入漏れを検出する検査が無い | 中 | **採用** | followup **`di-injection-missing-detection`** を新規起票（8 か所の注入点を列挙し、対策候補 3 案を添付） |
| **中-4** `RecomputeComboCache` の tx / 読み非対称 | 中 | **採用** | followup **`notation-recompute-combo-cache-tx-read-asymmetry`** を新規起票。**`SUPP-001` §7.1 の是正（tx の性質が書かれていない）と同じ束で設計卓へ渡す**旨を割付欄へ記載 |
| **低-1** `decodeRecipeCache` の挙動が旧実装と厳密には同一でない | 低 | **採用** | 完了報告 §12-4 の断定に「部分デコード可能なケースだけは同一でない」旨を追記。**`cache.go` の godoc にも同じ注記を足した**（コードを読む人にも届くように） |
| **低-2** E2E が `presetId: 1` をハードコード | 低 | **採用（自ファイルのみ）** | `m20-05-recipe-cache-wiring.spec.ts` は `official_ja_move` から解決する形へ変更。**`m20-04-preset-management.spec.ts` の既存行は触っていない**——同 spec は M20-04 の資産であり、本サブが足した describe 以外を触ると `M21-04` 並走中の diff を広げる |
| **低-3** 新設の関数型が ctx を取らない理由が残っていない | 低 | **採用** | `PresetExistsFunc` の godoc へ理由（`Service.Update` が ctx を持たない／§9.4 停止条件 2）と帰結（クライアント切断でキャンセルされない）を明記 |
| **低-4** `RecomputePresetCache` の godoc が書きについてのみ正しい | 低 | **採用（記述の精密化のみ）** | godoc へ「この境界は書きについてのもので、計算に使う読みは tx を通らない。呼び出し規約がコミット後であるため読むべきものは常にコミット済み」を追記。**lost update の可能性は記録のみ**（単一利用者前提・SQLite WAL では `SQLITE_BUSY` で落ちる公算が高く黙って壊れる形ではない、というレビュー所見に同意） |
| **低-5** `configsvc.Update` がミューテックス保持中に再計算を走らせる | 低 | **不採用（記録のみ）** | レビュー自身が「現状問題無し・記録」としており、対応は求められていない。**実測 5〜6.5 ms**（完了報告 §1-8）であり、エンティティが桁で増えたときに再検討する。**★config サービスの排他の設計は followup `preset-config-unsynchronized-read` と同じ面**であり、本サブの範囲外（指示書 §1.3） |

**★優先度「高」の不採用は 0 件である**（エスカレーション不要）。

### 取り込み後の検証

- `go build ./...` / `go vet ./internal/... ./cmd/...` — **0 件**
- `go test`（`notation` / `config` / `preset` / `cmd/combomgr`）— **全緑**
- `make e2e` — **84 passed / 0 failed**（フルスイート完走。spec 変更後に再実行）
- `tsc --noEmit` — **0 件**

### 再レビュー往復

**0 回**（差し戻し事由 0 件・「高」の不採用 0 件のため再レビューは要求されていない）。上限 2 回に達していない。
