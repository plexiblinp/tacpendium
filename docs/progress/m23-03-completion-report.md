# M23-03 完了報告: 参照側の `deleted_at` 除外の穴を 1 件ずつ塞ぐ（＋ 削除・復元の契約を as-built で固定する）

| 項目 | 内容 |
|------|------|
| 対象指示書 | `docs/instructions/M23-03-reference-side-exclusion-and-delete-contract.md` v1.0.0 |
| 実施日 | 2026-08-22 |
| ブランチ | `claude/m23-03-implementation-plan-x20h7t` |
| 消費 CHANGE | **`CHANGE-123`**（設計卓が 2026-08-20 に起票済み。**製造は番号を新規に払い出していない**） |
| 消費マイグレ | **0 本**（§4.7。disk 末尾は `000078` のまま。次に払い出すのは `000079`） |
| 並列相手 | **無し**（`M23-overview` §5.2＝本サブは単独。`E-121` の突合対象なし） |
| Plan Mode | 実施（§3.3 の 8 件を実物に当てて確認 → 計画提示 → 承認 → 実装） |

---

## 1. §3.3 着手前の実査（8 件）の結果

### 1-1. ★★`M23-02` の走査結果の引き継ぎ → **引き継ぎ済み。本サブが受け取るのは 2 か所**

`docs/progress/m23-02-completion-report.md` §1-1（`combo_setups` を読む SQL・10 サイト）から:

| M23-02 の # | 場所 | 本サブの処遇 |
|---|---|---|
| #2 `CountComboSetupsByComboID` | `internal/repository/combo/repository.go` | **M23-02 が是正済み。★触っていない** |
| #3 `comboSetupExists` | `internal/repository/setup/repository.go` | **M23-02 が是正済み。★触っていない** |
| #4 `FindComboIDsBySetupID` | `internal/repository/setup/repository.go` | **本サブの `#6`(a)** |
| #5 `FindComboIDsBySetupIDs` | `internal/repository/setup/repository.go` | **本サブの `#6`(b)** |
| #10 `FindCandidateSetups` の除外副問い合わせ | 同上 | **触っていない**（除外方向＝安全側。M23-02 が「報告のみ」と裁定済み） |

**⇒ `M23-02` が直した 2 か所を二重に触っていない**（チェックリスト §7 の最終項目）。

### 1-2. 6 か所の実パスと現在の述語 → **今も 6 か所。増減なし**

| # | 実パス（着手時の実査値） | 着手時の述語（逐語） |
|---|---|---|
| 1 | `internal/repository/combo/repository.go:412-428` `selectComboByIDAllowDeletedSQL` | `WHERE id = ?`（無し） |
| 2 | `internal/repository/combo/repository.go:1345-1359` `GetRecipeCache` | `SELECT recipe_cache FROM combos WHERE id = ?`（無し） |
| 3 | `internal/repository/punish/queries.go:50-54` `listAdoptedComboPunishesSQL` | `WHERE c.character_id = ?`（無し） |
| 4 | `internal/repository/punish/queries.go:57-65` `listMaterializedBaseComboIDsSQL` | `AND child.deleted_at IS NULL` のみ（`base` 側に無し） |
| 5 | `internal/repository/setup/repository.go:464-478` `GetRecipeCache` | `SELECT recipe_cache FROM setups WHERE id = ?`（無し） |
| 6 | `internal/repository/setup/repository.go:371-` / `:577-` `FindComboIDsBySetupID(s)` | `combos` を JOIN していない |

**`M23-01` / `M23-02` による増減は無かった**（`M23-overview` §4.9 の表と一致）。

### 1-3. `#3` と materialize の副作用の衝突 → **衝突しない**

materialize の副作用は `repo.RemovePunishLink`（`internal/service/combo/service.go:1052`）で、**`combo_punishes` の行を物理削除する**。本サブが足したのは同じ表の**読み取り側の親状態フィルタ**であり、書き込みと競合しない。materialize 済みの基底は行そのものが消えているため、`Adopted` は述語の有無に関わらず false になる。

### 1-4. `#4` の走査側が述語を持つか → **持っている。実挙動は変わらない**

`internal/service/punishfinder/service.go:295` が
`s.combos.List(ctx, combo.ListFilter{CharacterID: &p.SelfCharacterID, StarterMoveIDs: ids})`
で基底コンボを並べる。`ListFilter` は `OnlyDeleted` / `IncludeDeleted` のどちらも立てていないため、
`internal/repository/combo/repository.go:696` の `else if !filter.IncludeDeleted → deleted_at IS NULL` が効く。
`materializedBaseIDs[c.ID]` はこの生存コンボにしか引かれない。

**⇒ 過剰包含が結果に出ない。設計卓の見立て（確認事項 4）どおりであり、実装を止める条件には当たらなかった。**

### 1-5. ★★`#3` も同じ下流で守られていた（**指示書 §4.3-2 の前提と食い違う。差分として報告する**）

**`adoptedSet` を引くのも同じ `s.combos.List` 由来の生存コンボだけである**（`service.go:322`）。
`ListAdoptedComboPunishes` の**本番の呼び出し元は `service.go:306` の 1 か所のみ**（全数走査済み）。

**⇒ 「ゴミ箱に入っているコンボが『この相手技には採用済み』と主張し続ける」状態は、現状の応答には出ていない。**
`#4` とまったく同じ構図である。

- **裁定（塞ぐ＝D-495）は変えずに実装した。** 停止条件は §3.3-4（`#4`）にしか置かれておらず、`#3` には無いため、報告のうえ進めた。
- **ただし塞ぐ理由は §4.3-2 の「利用者に誤った状態が見える」ではない。** 実装後の理由は次の 2 つで、コメントにもそう書いた:
  1. 同一ファイル内の非対称（`listPunishEntriesBaseSQL` は述語を持つ）の解消。
  2. `#2` / `#5` と同じ「**別の経路の絞り込みに守られているだけ**」の状態をやめること。
- **★§5-4 のテストは、この事実の上でも成立する形で書いた**（下記 §5）。

### 1-6. `#2` / `#5` を塞いだとき削除済み行に対して呼ばれる経路 → **無い**

| # | 経路 | 実査結果 |
|---|---|---|
| `#2` | `GetRecipeCache`(combos) → `notation.ResolveComboRecipe`（唯一の呼び元）→ `internal/api/combo/handler.go:479` `GetRecipe` | **その手前 `:475` の `h.service.Get` が削除済みを `ErrNotFound` → 404 で返す**（`FindByID` が `deleted_at IS NULL` を持つ）。**⇒ 到達しない** |
| `#5` | `GetRecipeCache`(setups) → `notation.ResolveSetupRecipe` | **本番コードに呼び出し元が 0 件**（参照は `internal/service/notation/setup_resolver_test.go` と `internal/api/combo/handler_test.go` の mock のみ）。**⇒ 実挙動は変わらない** |

あわせて `M23-01` の実測どおり、論理削除の時点で `SetRecipeCacheNullTx` がキャッシュを NULL 化している。**⇒ 述語が無くても戻り値は `(nil, nil)` だった。**

**★ただし 1 つだけ観測手段が壊れた**——既存テスト `TestDeleteComboCache_NullifiesCache`（`internal/service/notation/cache_test.go`）が
`GetRecipeCache` を「キャッシュが NULL 化されたか」の観測に使っており、`ErrNotFound` を受けて赤くなった。
**テストの主張（`DeleteComboCache` が列を NULL にする）は変わっていない**ため、**観測を列の直読みへ変え、対で M23-03 の変更（削除済みは `ErrNotFound`）も固定した**（§8 の例外条項に列挙）。

### 1-7. マイグレーション → **1 本も足していない**

`ls migrations/` の末尾は `000078_add_combos_superseded_by`。ボード §2.2 の「次に払い出す番号 = `000079`」と一致し、**本サブは消費 0 である**。

### 1-8. 画面側のコードを変える必要があるか → **無い。差分 0**

`parentComboIds` を消費する本番コードは 5 か所（テスト・fixture を除く）。

| 消費箇所 | 応答から削除済み id が消えたときの影響 |
|---|---|
| `web/src/features/setup/hooks/useRestoreSetup.ts:20` | 無効化するコンボ詳細クエリが生存コンボだけに狭まる。**正しい方向** |
| `web/src/features/setup/hooks/useDeleteSetup.ts:16` | 同上 |
| `web/src/features/setup/hooks/useUpdateSetup.ts:18` | 同上 |
| `web/src/features/setup/hooks/useLinkExistingSetupForm.ts:17` | 判定対象は「編集中の生存コンボ」の id。**不変** |
| `web/src/pages/SetupEditorPage.tsx:75` | 「ほかの人の内容を見る」の遷移先に先頭の親を使う。**`?? null` で不在を扱う実装が既にある**（同 `:76` のコメント「★不在なら導線を出さない(null)」）。**ゴミ箱の親を指して 404 になっていた導線が消えるため改善方向** |

**⇒ フロント側のコードは 1 行も変えていない**（指示書 §1.5-8 ／ チェックリスト §3）。

---

## 2. 変更点（裁定 6 件の対応表）

| # | 裁定 | 実装 | 実パス |
|---|---|---|---|
| 1 | **塞がない** | SQL 無変更。**残す理由 2 つをコメントで固定** | `internal/repository/combo/repository.go`（`selectComboByIDAllowDeletedSQL` 直上 ＋ インタフェース宣言） |
| 2 | 塞ぐ | `AND deleted_at IS NULL` | `internal/repository/combo/repository.go` `GetRecipeCache` |
| 3 | 塞ぐ | `AND c.deleted_at IS NULL` | `internal/repository/punish/queries.go` `listAdoptedComboPunishesSQL` |
| 4 | 塞ぐ | `AND base.deleted_at IS NULL` ＋ **インタフェースコメント書き直し** | `internal/repository/punish/queries.go` / `repository.go` |
| 5 | 塞ぐ | `AND deleted_at IS NULL` | `internal/repository/setup/repository.go` `GetRecipeCache` |
| 6 | **関数を 2 つに分ける** | 下記 §3 | `internal/repository/setup/repository.go` ＋ `internal/service/setup/{service,restore}.go` |

**`#4` のインタフェースコメントは消さずに書き直した**（§4.4-4）:

```
- // 相手技と is_draft は判定に含めず、論理削除済みの生成物だけを除外する。
+ // 相手技と is_draft は判定に含めず、論理削除済みは基底・生成物の両側を除外する
+ // (M23-03 §4.4。以前は生成物だけを除外していた)。
```

---

## 3. ★★`#6` の分割後の 2 つの関数と、呼び出し側の割り当て表

### 3-1. 分割後の関数（3 本）

| 関数 | SQL | 役割 |
|---|---|---|
| `FindLiveComboIDsBySetupID` | `combo_setups cs JOIN combos c ON c.id = cs.combo_id AND c.deleted_at IS NULL` | **表示**（「いま見えているものだけ」） |
| `FindLiveComboIDsBySetupIDs` | 同上の `setup_id IN (…)` 版 | **表示**（バッチ） |
| `FindComboIDsBySetupIDAllowDeleted` | `SELECT combo_id FROM combo_setups WHERE setup_id = ? ORDER BY combo_id`（**現状のまま**） | **検証**（「復元されうるものも含めて」） |

- **命名は既存の流儀に合わせた**——`Live` は `M23-02` の `FindLiveReferencingCombos`、`AllowDeleted` は `FindByIDAllowDeleted`。
- **旧名 `FindComboIDsBySetupID` / `FindComboIDsBySetupIDs` は残していない**（走査結果は §6-2）。**どちらかが「古い関数の名残」に見える形を作らないため**（§4.5-6 ／ チェックリスト N-3）。
- **複数版の `AllowDeleted` は作っていない**——呼び元が無いため（godoc に 1 行明記）。

### 3-2. 呼び出し側の全数割り当て（**7 か所。判別不能 0**）

| # | 呼び出し側 | 関数 | 役割 | 割り当て |
|---|---|---|---|---|
| 1 | `internal/service/setup/service.go:383` `UpdateSetup`（VAL-S04 の母集団） | 単数 | **検証** | **`FindComboIDsBySetupIDAllowDeleted`** |
| 2 | `internal/service/setup/service.go:712` `buildResponse`（詳細） | 単数 | 表示 | `FindLiveComboIDsBySetupID` |
| 3 | `internal/service/setup/service.go:547` `buildCandidateResponses` | 複数 | 表示 | `FindLiveComboIDsBySetupIDs` |
| 4 | `internal/service/setup/service.go:584` `ListSetups` | 複数 | 表示 | `FindLiveComboIDsBySetupIDs` |
| 5 | `internal/service/setup/service.go:621` `ListSetupsByComboID` | 複数 | 表示 | `FindLiveComboIDsBySetupIDs` |
| 6 | `internal/service/setup/service.go:665` `ListSetupsByComboIDs` | 複数 | 表示 | `FindLiveComboIDsBySetupIDs` |
| 7 | `internal/service/setup/restore.go:157` `ListDeletedSetups`（ゴミ箱一覧） | 複数 | 表示 | `FindLiveComboIDsBySetupIDs` |

> **★`M23-RESEARCH-01` 軸 E-5 は使用箇所を 5 か所と数えていたが、実際は 7 か所である。**
> **`M23-02` が `ListDeletedSetups`（#7）を新設したため増えた。** 残る 1 件の差は、軸 E-5 が
> `service.go:526 / 563 / 600 / 644` を 4 行として数えた行番号が `M23-01` / `M23-02` の差分で
> ずれたことによるもので、関数の数は変わっていない。

### 3-3. **検証側を緩めていないこと**

`FindComboIDsBySetupIDAllowDeleted` の SQL は **1 文字も変えていない**。緩めた場合の破れ方（「ゴミ箱へ入れる → 同じレシピを作る → 復元する」で同一レシピが 2 本並ぶ／DB 制約が無いため誰も気づかない）は godoc に書いてある。**⇒ `M23-05` が扱う衝突は増えていない**（§4.5-5）。

---

## 4. ★★`#1` を塞がなかったことと、理由コメントの箇所

**述語を足していない。** 理由コメントは 2 か所に置いた。

| 箇所 | 内容 |
|---|---|
| `internal/repository/combo/repository.go` インタフェース宣言（`FindByIDAllowDeleted`） | 「述語を持たないのは意図である。理由は SQL 定数の直上。塞がないこと」 |
| 同ファイル `selectComboByIDAllowDeletedSQL` の直上 | **残す理由 2 つを明記**——(1) **完全削除の前チェック**（`service/combo.PermanentDelete`）が削除済み行を読む必要がある ／ (2) **followup `trash-row-click-404`**（ゴミ箱の行から読み取り専用の詳細を出す。`M23-06` 担当。`DES-005` §5.15 の未達分）が使う道具である。**あわせて「塞いだ瞬間に壊れるのは完全削除であり、通常操作のテストには出ない」ことも書いた** |

**★この記述は実測で裏を取ってある**——破壊確認（§5-3）で `selectComboByIDAllowDeletedSQL` に述語を足すと、
**`TestM2303_FindByIDAllowDeleted_StillReturnsSoftDeletedRow` と `TestService_PermanentDelete_OK` の 2 本だけが赤くなり、他は全部緑のまま通った。**

---

## 5. 自己テスト結果（§7.2。★コマンド自身の出力＝**E-125**）

### 5-1. `go test ./... -count=1`

```
$ time go test ./... -count=1
（全 62 パッケージ。FAIL 0 件。抜粋）
ok  	github.com/plexiblinp/combomgr/internal/repository/combo	49.246s
ok  	github.com/plexiblinp/combomgr/internal/repository/punish	12.169s
ok  	github.com/plexiblinp/combomgr/internal/repository/setup	27.228s
ok  	github.com/plexiblinp/combomgr/internal/service/combo	91.842s
ok  	github.com/plexiblinp/combomgr/internal/service/notation	25.106s
ok  	github.com/plexiblinp/combomgr/internal/service/punishfinder	3.772s
ok  	github.com/plexiblinp/combomgr/internal/service/setup	33.056s
（"FAIL" の行は 0 件 ／ "?   no test files" が 10 件）

real	2m44.097s
```

**★結果キャッシュが効いていないことの証拠**（followup `stop-test-hook-lacks-count-1`）:

```
$ time go test ./...            # キャッシュ有効の 3 走目
real	0m0.387s                 # ← "(cached)" 53 行。exit code は 0m44s の走行と同じ 0
```

**⇒ 所要が 2m44s と 0.39s で 3 桁違い、終了コードはどちらも 0。** 上記の 2m44s は `-count=1` の実走行である。

### 5-2. 本サブが追加した Go テスト（**12 本**）

```
$ go test ./internal/repository/combo/ -run TestM2303 -count=1 -v
--- PASS: TestM2303_FindByIDAllowDeleted_StillReturnsSoftDeletedRow (0.71s)
--- PASS: TestM2303_GetRecipeCache_ExcludesSoftDeletedCombo (0.67s)
ok  	github.com/plexiblinp/combomgr/internal/repository/combo	1.382s

$ go test ./internal/repository/setup/ -run TestM2303 -count=1 -v
--- PASS: TestM2303_SetupGetRecipeCache_ExcludesSoftDeletedSetup (0.65s)
--- PASS: TestM2303_FindComboIDs_LiveExcludes_AllowDeletedKeeps (0.68s)
--- PASS: TestM2303_FindLiveComboIDsBySetupIDs_ExcludesSoftDeletedCombo (0.65s)
ok  	github.com/plexiblinp/combomgr/internal/repository/setup	1.977s

$ go test ./internal/repository/punish/ -run TestM2303 -count=1 -v
--- PASS: TestM2303_ListAdoptedComboPunishes_ExcludesTrashedComboAndReturnsOnRestore (0.62s)
--- PASS: TestM2303_ListMaterializedBaseComboIDs_ExcludesTrashedBase (0.64s)
ok  	github.com/plexiblinp/combomgr/internal/repository/punish	1.262s

$ go test ./internal/service/punishfinder/ -run TestM2303 -count=1 -v
--- PASS: TestM2303_Scan_TrashedComboIsNotCountedAsAdopted_AndReturnsOnRestore (0.76s)
--- PASS: TestM2303_Scan_MaterializedFlagUnchangedByBasePredicate (0.71s)
ok  	github.com/plexiblinp/combomgr/internal/service/punishfinder	1.468s

$ go test ./internal/service/setup/ -run TestM2303 -count=1 -v
--- PASS: TestM2303_GetSetup_ParentComboIDsExcludesTrashedCombo (0.79s)
--- PASS: TestM2303_UpdateSetup_StillRejectsDuplicateInsideTrashedCombo (0.67s)
--- PASS: TestM2303_UpdateSetup_AllowsNonDuplicateInsideTrashedCombo (0.75s)
ok  	github.com/plexiblinp/combomgr/internal/service/setup	2.217s
```

**指示書 §5 の 9 件との対応**:

| §5 | 要求 | テスト |
|---|---|---|
| 1 | `#1` が削除済み行を返し続ける（否定形・実 DB） | `TestM2303_FindByIDAllowDeleted_StillReturnsSoftDeletedRow` |
| 2 | 完全削除がこれまでどおり動く | **既存 `TestService_PermanentDelete_OK` / `_NotFound` / `_NotInTrash`**（`internal/service/combo/service_test.go:1152-1181`。3 本とも PASS。**破壊確認で `_OK` が `#1` の是正漏れを検出することを実測済み**＝§5-3） |
| 3 | `#2` / `#5` が削除済み行を返さない（2 本） | `TestM2303_GetRecipeCache_ExcludesSoftDeletedCombo` ／ `TestM2303_SetupGetRecipeCache_ExcludesSoftDeletedSetup` |
| 4 | ゴミ箱のコンボを採用済みと数えない ／ 復元で戻る（対） | `TestM2303_ListAdoptedComboPunishes_ExcludesTrashedComboAndReturnsOnRestore`（述語そのものを固定）＋ `TestM2303_Scan_TrashedComboIsNotCountedAsAdopted_AndReturnsOnRestore`（応答側） |
| 5 | `#4` を塞いでも結果が変わらない | `TestM2303_Scan_MaterializedFlagUnchangedByBasePredicate` |
| 6 | 表示用が削除済みコンボを返さない | `TestM2303_FindComboIDs_LiveExcludes_AllowDeletedKeeps`（前半）＋ `TestM2303_GetSetup_ParentComboIDsExcludesTrashedCombo` |
| 7 | 検証用が削除済みコンボを返し続ける | `TestM2303_FindComboIDs_LiveExcludes_AllowDeletedKeeps`（後半。**同一テスト内で対にしてある**） |
| 8 | ゴミ箱のコンボ内の重複が今までどおり弾かれる | `TestM2303_UpdateSetup_StillRejectsDuplicateInsideTrashedCombo`（＋ 対照 `_AllowsNonDuplicateInsideTrashedCombo`） |
| 9 | E2E | `web/e2e/m23-03-reference-exclusion.spec.ts`（2 本） |

### 5-3. ★破壊確認（**通るだけのテストは歯止めにならないため、是正を戻して赤を確認した**）

| 戻した是正 | 赤くなったテスト | 判定 |
|---|---|---|
| `#1` に `AND deleted_at IS NULL` を**足す** | `TestM2303_FindByIDAllowDeleted_StillReturnsSoftDeletedRow` ／ **`TestService_PermanentDelete_OK`** | **★§4.1-2 の主張どおり「塞ぐと完全削除が壊れる」が実測で確定した** |
| `#2` / `#5` の述語を外す | `TestM2303_GetRecipeCache_ExcludesSoftDeletedCombo` ／ `TestM2303_SetupGetRecipeCache_ExcludesSoftDeletedSetup` | 各 1 本ずつ赤 |
| `#3` の述語を外す | `TestM2303_ListAdoptedComboPunishes_...` | 赤 |
| `#4` の `base` 述語を外す | `TestM2303_ListMaterializedBaseComboIDs_ExcludesTrashedBase` は**赤** ／ **`TestM2303_Scan_MaterializedFlagUnchangedByBasePredicate` は緑のまま** | **★これが §5-5 の「変わらない」の実測そのものである**——述語は集合を変えるが、応答は変わらない |
| 表示用（Live）から述語を外す | `TestM2303_FindComboIDs_LiveExcludes_AllowDeletedKeeps` ／ `TestM2303_FindLiveComboIDsBySetupIDs_...` ／ `TestM2303_GetSetup_ParentComboIDsExcludesTrashedCombo` | 3 本赤 |
| 検証用の呼び出しを Live へ寄せる | **`TestM2303_UpdateSetup_StillRejectsDuplicateInsideTrashedCombo`** | **★分割の意味そのものが守られている** |

### 5-4. `cd web && pnpm test -- --run`

```
 Test Files  171 passed (171)
      Tests  1682 passed (1682)
   Duration  90.97s
```

### 5-5. `make e2e`

```
  160 passed (3.5m)
real	3m33.491s
```

うち本サブの 2 本:

```
✓ e2e/m23-03-reference-exclusion.spec.ts:102:3 › 2 コンボで共有 → 片方をゴミ箱へ → 消える → 復元 → 戻る (501ms)
✓ e2e/m23-03-reference-exclusion.spec.ts:143:3 › ゴミ箱画面がゴミ箱のコンボを出し、復元すると消える(画面が壊れていないこと) (3.2s)
```

**★1 走目は 159 passed / 1 failed だった**——**落ちたのは本サブの UI テスト 1 本のみ**（ゴミ箱の行を `memo` の文字列で同定しようとしたが、`memo` は表の列に出ない）。**行リンク `a[href="/combos/:id"]` での同定へ直して 2 走目で 160 passed。** 既存 spec に影響は出ていない。

**★件数を絶対値で数える既存 spec と衝突していない**——本 spec は作成した id の在・不在だけを見て、`afterEach` で作成行を全部落としている（`m22-03` / `m23-01` / `m23-02` の慣行に揃えた）。

### 5-6. マイグレーション

```
$ ls migrations/ | tail -3
000077_m20_seed_aliases_p34_srk.up.sql
000078_add_combos_superseded_by.down.sql
000078_add_combos_superseded_by.up.sql
```

**消費 0 本。** ボード §2.2 の「次に払い出す番号 = `000079`」と整合。

---

## 6. §4.9 否定形確認（走査結果）

### 6-1. `#1` に述語を足していないこと

```
$ sed -n '/const selectComboByIDAllowDeletedSQL/,/^$/p' internal/repository/combo/repository.go | grep -n "WHERE"
17:WHERE id = ?`
```

**⇒ 述語なし。** 完了報告側にも「`#1` も塞いだ」旨の記述は無い（本報告 §2 / §4 が「塞がない」と明記）。

### 6-2. `#6` の呼び出し側が全数割り当て済みであること（**旧名の残存 0 件**）

```
$ grep -rn "FindComboIDsBySetupIDs\b" --include=*.go . | grep -v FindLive
  → 0 件
$ grep -rn "FindComboIDsBySetupID\b" --include=*.go . | grep -v FindLive | grep -v AllowDeleted
  → 0 件（`repository.go:387` のコメント内の言及のみ。分割の経緯を残すためのもの）
$ grep -rn "FindLiveComboIDsBySetupID\|FindComboIDsBySetupIDAllowDeleted" --include=*.go internal/service/ | grep -v _test.go
internal/service/setup/restore.go:157:  FindLiveComboIDsBySetupIDs
internal/service/setup/service.go:383:  FindComboIDsBySetupIDAllowDeleted   ← 検証側 1 か所
internal/service/setup/service.go:547:  FindLiveComboIDsBySetupIDs
internal/service/setup/service.go:584:  FindLiveComboIDsBySetupIDs
internal/service/setup/service.go:621:  FindLiveComboIDsBySetupIDs
internal/service/setup/service.go:665:  FindLiveComboIDsBySetupIDs
internal/service/setup/service.go:712:  FindLiveComboIDsBySetupID
```

**⇒ 7 か所すべて割り当て済み。判別のつかない呼び出し側は 0。**

### 6-3. ★「参照側の穴は全部塞いだ」という記述を残していないこと

```
$ grep -rniE "全部塞|すべて塞|全て塞|穴は無くなった|穴はなくなった|穴を全部|全部の穴" \
    --include=*.go --include=*.ts --include=*.tsx internal/ web/src/ web/e2e/
  → 0 件
```

**本完了報告・設計伝達レポートにも同種の記述は書いていない。** 逆に §2 / §4 で「**6 か所のうち 1 か所は意図的に残した**」と明示してある。

---

## 7. ★★§4.6 削除・復元の契約（as-built。**実装は 1 行も変えていない**）

> **設計卓が `CHANGE-123` で `DES-002` §4.2 へ写す材料。逐語で置く。**

### 7-1. コンボの論理削除は楽観排他を行わない（**契約として固定する**）

`internal/repository/combo/repository.go` `SoftDelete`:

```sql
UPDATE combos SET deleted_at = datetime('now'), updated_at = datetime('now') WHERE id = ?
```

- **`version = ?` も `deleted_at IS NULL` も無い。**
- **⇒ `DELETE /api/combos/:id` は版を突き合わせず、既に削除済みの行に対しても冪等に成功する（204）。**
- **これは欠陥ではない**——削除は「消す」意図であり、版が違っても消したいことに変わりはない。逆に排他を入れると「消したいのに消せない」経路が生まれる。
- **既存テストが挙動を守っている**: `internal/api/combo/handler_test.go:1043` `TestHandler_Delete_204_OnAlreadyDeleted`（同 `:1037-1042` のコメントに同趣旨が明記されている）。

### 7-2. ただし `deleted_at` は上書きされる（**`M23-06` の判断材料。本サブでは変えない**）

上記 `SET deleted_at = datetime('now')` は無条件である。**⇒ 削除済みの行へもう一度 `DELETE` を投げると、削除日時が後ろへずれる。利用者から見ると「消した日が変わる」。**
**削除日時の見せ方は `M23-06` が持つため、本サブは実装を変えていない**（§1.5-3）。

### 7-3. 復元は削除済みでない行に対しても「見つからない」を返す

`internal/repository/combo/repository.go` `Restore`:

```sql
UPDATE combos SET deleted_at = NULL, updated_at = datetime('now') WHERE id = ? AND deleted_at IS NOT NULL
```
`RowsAffected() == 0` → `ErrNotFound` → ハンドラで **404**。

- **⇒ 「存在しない」と「ゴミ箱に無い（＝生きている）」が同じ応答になる。**
- **`version` は `SET` 句に含まれない**（`M22-overview` §4.2.1 (iii)「据え置き」と一致）。

### 7-4. セットプレイ側の対応経路との異同（**★食い違っている。揃えずに報告する**）

| 観点 | コンボ側 | セットプレイ側（`M23-02` が新設） | 判定 |
|---|---|---|---|
| **論理削除の `WHERE`** | `WHERE id = ?`（**述語なし**） | `WHERE id = ? AND deleted_at IS NULL`（`internal/repository/setup/repository.go` `SoftDelete`） | **★非対称。** セットプレイは 2 度目の `DELETE` が `RowsAffected()==0` → `ErrNotFound` → **404**。コンボは **204（冪等）** |
| **論理削除が `deleted_at` を上書きするか** | **する** | **しない**（述語で弾かれるため） | **★非対称**（§7-2 と対） |
| **復元の `WHERE`** | `WHERE id = ? AND deleted_at IS NOT NULL` → 0 行なら 404 | `WHERE id = ? AND deleted_at IS NOT NULL` → 0 行なら 404（`internal/repository/setup/restore.go` `Restore`） | **一致** |
| **復元が `version` に触れるか** | 触れない | 触れない | **一致** |
| **完全削除の前チェックの位置** | **Tx 外**（`internal/service/combo/service.go` `PermanentDelete` は `FindByIDAllowDeleted` → `DeletedAt == nil` 判定の**後**に `BeginTx`） | **Tx 内**（`internal/service/setup/restore.go` `PermanentDelete` は `BeginTx` の**後**に `FindByIDAllowDeleted(ctx, tx, …)`） | **★非対称。`M23-02` §9 が意図的にコンボ側へ揃えなかった箇所であり、`M23-06` の担当**（followup `setup-permanent-delete-precheck-tx`） |

**★本サブでは揃えていない**（§4.6-5 の指示どおり報告に留める）。

---

## 8. §2.1 に無いファイルへ手を入れた箇所（§2.3 例外条項）

| ファイル | 理由 |
|---|---|
| `internal/service/notation/cache_test.go` | **§4.2 の直接の帰結。** `TestDeleteComboCache_NullifiesCache` が `GetRecipeCache` を「キャッシュが NULL 化されたか」の観測手段に使っていたため、`#2` を塞いだ時点で `ErrNotFound` を受けて赤くなった。**テストの主張は変えず、観測を列の直読み（`SELECT recipe_cache FROM combos WHERE id = ?`）へ変更し、あわせて「削除済みは `ErrNotFound`」を対で固定した。** 実装側は 1 行も変えていない |
| `internal/repository/setup/repository_test.go` | **`#6` の改名に伴う機械的な追随**（`FindComboIDsBySetupID` → `FindLiveComboIDsBySetupID`。既存アサーションは生存コンボに対するものであり、意味は変わらない） |

| `internal/api/setup/dto.go`（2 か所） ／ `internal/api/combo/dto.go` ／ `internal/service/setup/service.go`（`SetupResponse` 型） | **レビュー指摘 3（中）の取り込み。** `parentComboIds` の**値域が変わった**（「紐付く全コンボ」→「紐付く生存コンボ」）ため、露出点へ注記を足した。**「判定の母集団には使えない／検証は `FindComboIDsBySetupIDAllowDeleted` を使う」まで書いてある**——`#6` の分割で守った不変条件が DTO 経由で破れるのを止めるため。**コメントのみの追加であり、型・タグ・挙動は不変** |

**これ以外に §2.1 の表から外れたファイルは無い。**

---

## 9. `M23-04` / `M23-05` / `M23-06` の担当範囲へ踏み込みたくなった箇所（§2.3）

| # | 踏み込みたくなった箇所 | 踏み込まなかった理由 |
|---|---|---|
| 1 | **コンボ側の完全削除の前チェックを Tx 内へ移す**（§7-4 の最終行） | **`M23-06` の担当**（§1.5-1。followup `setup-permanent-delete-precheck-tx`）。セットプレイ側と非対称なのは承知のうえ（**D-494**） |
| 2 | **論理削除の `deleted_at` 上書きをやめる** | **`M23-06` の担当**（§1.5-3）。既存テスト `TestHandler_Delete_204_OnAlreadyDeleted` の期待と衝突しうるため、判断は削除日時の見せ方を持つサブがすべき |
| 3 | **コンボ側とセットプレイ側の論理削除の `WHERE` を揃える** | **契約として現状を固定する側である**（§4.6-2 / §2.2-3）。揃えると「消したいのに消せない」経路が生まれうるため、揃えずに §7-4 で報告した |
| 4 | **`ResolveSetupRecipe` に本番の呼び出し元が 1 つも無い**（§1-6） | **本サブのスコープ外の観察である。** 未使用経路の撤去は提案せず、事実として記録するに留めた |

---

## 10. 推測で進めた箇所（§9.2）

| # | 事項 | 採った案 |
|---|---|---|
| 1 | **分割後の関数名**（§9.2-1） | `FindLiveComboIDsBySetupID` / `FindLiveComboIDsBySetupIDs` / `FindComboIDsBySetupIDAllowDeleted`。**既存の `FindLiveReferencingCombos`（M23-02）と `FindByIDAllowDeleted` の流儀に合わせた。** 旧名は残していない |
| 2 | **コメントの文面**（§9.2-2） | §4 / §2 のとおり。`internal/repository/setup/restore.go` の `selectSetupByIDAllowDeletedSQL` の文体に揃えた |
| 3 | **テストの配置と命名**（§9.2-3） | 各パッケージに `m23_03_reference_exclusion_test.go` を新設。既存ファイルへ混ぜず、本サブの主張を 1 か所で読めるようにした。プレフィクス `TestM2303_` |
| 4 | **`#4` のインタフェースコメントの書き直し方**（§9.2-4） | 消さずに「基底・生成物の両側を除外する」へ書き換え、以前の形も 1 行残した |

**★コード内の `// 推測:` コメントは置いていない**——上記 4 件はいずれも §9.2 が「推測で進めてよい」と明示した事項であり、かつ本報告に採否を記録してある。仮定を置いた実装判断は無い。

---

## 10-B. レビュー指摘の取り込み（Phase C）

レビュー報告書 `docs/progress/m23-03-review.md`（**重大 0 件**・高 1 / 中 3 / 低 4）に対し、**採用 6 件 / 不採用 2 件**。
**「高」の不採用は 0 件のためエスカレーションは発生していない。** 採否と理由の全文は同報告書末尾の
「## 取り込み結果（自動トリアージ）」節にある。**再レビュー往復 0 回**（上限 2 回に達していない）。

| 指摘 | 優先度 | 採否 | 要点 |
|---|---|---|---|
| 1 `#3` の失効した帰結が `M23-overview` §4.9 に残る | **高** | **採用** | 設計伝達レポート §4 へ 7 件目として追加（**overview 本体は設計卓の手番のため触っていない**） |
| 2 §5-2 の対がコードから追えない | 中 | 採用 | §5-1 のテスト直上に `TestService_PermanentDelete_OK` を名指し |
| 3 `parentComboIds` の値域注記が露出点に無い | 中 | 採用 | 4 か所へ注記（§8 に列挙） |
| 4 `#3` / `#4` のコメントが「唯一の呼び元」に断定形で依存 | 中 | 採用 | 時点を付し「呼び元を足すときは数え直すこと」を追記 |
| 5 分割後 2 関数の接頭辞が揃わない | 低 | **不採用** | レビュー自身が「今から変える価値は低い」と結論。呼び元 7 か所とテスト 12 本が確定済みで、現行名は既存の流儀 2 つに乗っている |
| 6 行スキャンのループが重複 | 低 | **不採用** | **共通ヘルパは「片方に寄せられるのでは」という次の統合の誘因を作る。** 本サブは「同じに見える 2 関数を統合させないこと」が最重要の不変条件（§4.5-4 ／ N-3）であり、重複 20 行のコストより統合を誘発しない形を優先した |
| 7 テストコードの体裁 2 件 | 低 | 採用 | `_ = respA` の除去 ／ E2E のアサーションメッセージを実際に画面を開く 2 本目へ移動 |
| 8 `FindByIDAllowDeleted` の公開 godoc から用途が消えた | 低 | 採用 | 用途 1 行を戻したうえで「塞がないこと」を残した |

**取り込み後の再検証**: `go test ./... -count=1` → **ok 53 パッケージ / FAIL 0 / `(cached)` 0 / real 2m48.530s** ／
`make e2e` → **160 passed (3.3m) / exit 0** ／ `gofmt -l internal/` 0 件 ／ `go build ./...` OK ／
`pnpm exec tsc --noEmit -p e2e/tsconfig.json` OK ／ `bash scripts/check-md-emphasis.sh` 違反なし。

---

## 11. 品質チェック（§7.3）

```
$ bash scripts/check-enum-sync.sh
結果: ベースラインどおり(増加なし)

$ bash scripts/check-browser-storage-keys.sh
OK  台帳と実装が一致(未記載キーの使用なし・状態のズレなし)
結果: 違反なし

$ git diff（本サブの差分）| grep -E "console\.log|fmt\.Println"
  → 0 件

$ gofmt -l internal/
  → 0 件
$ go vet ./internal/repository/... ./internal/service/...
  → 0 件
```

- **エラーは全て wrap 済み**（`CLAUDE.md` §4）——新設の 3 関数はいずれも `fmt.Errorf("…: %w", err)`。
- **本サブは列挙定数もブラウザストレージキーも足していない**（§7.3 の「足していないことの確認」）。

---

## 12. 既知の制約

1. **`#3` を塞いだことによる利用者から見た変化は無い**（§1-5）。**指示書 §4.3-2 が想定した「ゴミ箱のコンボが採用済みを主張し続ける」状態は、下流の絞り込みに守られて発現していなかった。** 塞いだのは「守られているだけ」の状態をやめるためである。
2. **`#4` も同様に実挙動は変わらない**（§1-4。設計卓の見立てどおり）。
3. **`#5` は本番の呼び出し元が 0 件である**（§1-6）。**塞いだことによる実挙動の変化も無い。**
4. **コンボ側とセットプレイ側の論理削除・完全削除は非対称のままである**（§7-4）。**`M23-06` の入力。**
5. **`M23-03` は「6 か所のうち 5 か所を塞ぎ、1 か所を意図的に残した」状態である。** **`#1` を「残った穴」と読んで塞ぐと完全削除が壊れる**（§4 に実測付きで記載）。

---

## 13. ■ 併せて更新が要るもの（**E-114** ／ **D-277**）

| 項目 | 状況 |
|---|---|
| **消費した CHANGE 番号の登録** | **不要。** `CHANGE-123` は**設計卓が 2026-08-20 に起票し、`docs/handover/change-number-registry.md` §1（`| **123** |` の行）へ登録済み**であることを実査した。**製造が新規に払い出した番号は無い。** |
| **番号の写し先の全数確認** | **実査した。** `CHANGE-123` は registry §1 に在り、`docs/change-notes/CHANGE-123-notification.md` も存在する。**本サブは番号を消費していないため、「次に採番する CHANGE」の記載を動かす必要は無い。** |
| **消費したマイグレ連番** | **0 本。** `ls migrations/` の末尾 `000078` ／ ボード §2.2「次に払い出す番号 = `000079`」。**ずれていない。更新不要。** |
| **版を上げた文書の参照元** | **該当なし。** 本サブは設計書・指示書・チェックリストの版を 1 つも上げていない（`CLAUDE.md` §8 のとおり `DES-002` の改訂は設計卓が `CHANGE-123` で行う）。 |
| **`docs/progress/progress-log.md`** | **索引行を追記した**（`CLAUDE.md` §8）。 |
| **`docs/handover/followup-backlog.md`** | **製造は編集していない**（**D-382**）。更新候補は設計伝達レポート §4 に置いた。 |

---

## 14. 変更ファイル一覧

### バックエンド（変更 6・新規 0）

| ファイル | 内容 |
|---|---|
| `internal/repository/combo/repository.go` | `#1` のコメント（2 か所） ／ `#2` の述語追加 ＋ godoc |
| `internal/repository/setup/repository.go` | `#5` の述語追加 ＋ godoc ／ **`#6` の分割**（インタフェース 3 本・実装 3 本） |
| `internal/repository/punish/queries.go` | `#3` / `#4` の述語追加 ＋ 理由コメント |
| `internal/repository/punish/repository.go` | `#3` / `#4` のインタフェースコメント（**`#4` は書き直し**） |
| `internal/service/setup/service.go` | `#6` の呼び出し側割り当て（検証 1 / 表示 5） |
| `internal/service/setup/restore.go` | `#6` の呼び出し側割り当て（表示 1） |

### フロントエンド（変更 0）

**差分なし**（§1-8）。

### テスト（新規 6・変更 2）

| ファイル | 内容 |
|---|---|
| `internal/repository/combo/m23_03_reference_exclusion_test.go` | **新規**（2 本。§5-1 / §5-3） |
| `internal/repository/setup/m23_03_reference_exclusion_test.go` | **新規**（3 本。§5-3 / §5-6 / §5-7） |
| `internal/repository/punish/m23_03_reference_exclusion_test.go` | **新規**（2 本。§5-4 / §5-5 の前提） |
| `internal/service/punishfinder/m23_03_reference_exclusion_test.go` | **新規**（2 本。§5-4 / §5-5） |
| `internal/service/setup/m23_03_reference_exclusion_test.go` | **新規**（3 本。§5-6 / §5-7 / §5-8 ＋ 対照） |
| `web/e2e/m23-03-reference-exclusion.spec.ts` | **新規**（2 本。§5-9） |
| `internal/service/notation/cache_test.go` | **変更**（観測手段の変更。§8） |
| `internal/repository/setup/repository_test.go` | **変更**（改名への追随。§8） |

---

## 15. 並列相手との as-built 突合（`E-121` ／ **D-284**・**D-297**）

**★本サブは単独である**（`M23-overview` §5.2。`M23` の他サブと並列にせず、`M24` 側にも走っているレーンが無い）。**⇒ 突合対象は無い。**

---

*以上、M23-03 完了報告。参照側の除外の穴 6 か所を 1 件ずつ違う扱いで処理し、1 つは意図的に残した。*
