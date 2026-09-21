# M18-RESEARCH-02 調査報告: FR301 重複判定の実機序 ＋ materialize 実装面 ＋ 案C 影響範囲の実測

| 項目 | 内容 |
|------|------|
| 対応指示書 | `docs/instructions/phase3/M18-RESEARCH-02-dup-key-and-materialize-surface.md` v1.0.0 |
| 種別 | 調査報告(read-only・judgement-free。事実列挙のみ) |
| 実施日 | 2026-07-26 |
| dev DB 基準時点 | `~/.local/share/combomgr/combomgr.db`、`schema_migrations` version=41(最新。000041 まで適用済み) |

---

## §0 結論サマリ

1. **A-2(nil比較・最重要)**: `FindActiveByDuplicateKey`(`internal/repository/combo/repository.go:825-837`)は、キー項目が nil のとき `col IS NULL` を WHERE に追加する。**nil 同士は「一致」として扱われる**(SQL 上 `IS NULL` は他の NULL 行にもマッチするため)。
2. **C-3(jump 3 code の同値・最重要)**: dev DB 全12キャラクター中、`jump_neutral`/`jump_forward`/`jump_back` の `total` が非NULLな10キャラ全てで**3値が完全一致**(不一致キャラ 0 件)。`c_viper`/`dhalsim` は3値ともNULL。
3. **B-1/B-3**: `materialized_from_combo_id` は migrations 000038 とそのマイグレテスト以外、`internal/`・`web/src/` に**読み書きコード 0 件**(model.Combo にもフィールド無し)。
4. **A-3**: `recipe_hash` は DB カラムではなく **`internal/service/combo.CalcRecipeHash`(SHA-256)によるサービス層計算値**。DB には持たない(`recipe_cache` とは別物)。
5. **C-2**: 案C(`category='normal' AND code に jumping_heavy_ を含む`)で新たに拾われる技は **2件**(juri・ken の `neutral_jumping_heavy_kick`)。現行述語(prefix一致)21件 → 案C適用後23件。
6. **D-6**: `combo_punish_curations` はマイグレ(000037)とそのマイグレテスト以外、**repository/service/api/frontend の全レイヤで参照 0 件**(未使用確定)。`combo_punish_prunings` は DELETE の repository/APIルートは存在するが、**フロントエンドに削除(解除)フックが見当たらない**(POST=`useAddPruning` のみ確認)。
7. **C-5**: unique系空中特殊技(category='unique' AND is_aerial=1)は **7件**(前提の「8件」と不一致。実測 2026-07-26)。
8. **D-7**: `is_aerial=0 AND damage>0 AND startup IS NULL` は **2件**(ingrid・lily、いずれも category='target_combo')。
9. **A-4**: `RecomputeComboCache` は Create/UpdateWithKeyChange/Restore の3経路でのみ呼ばれ、UpdateMetadata(PATCH)・Delete・PermanentDelete では呼ばれない。
10. **開発者への確認事項#1(dev DB基準時点)は本調査で解消**: migration version=41(最新)を実測確認済み。

---

## A. FR301 重複判定の実機序

### A-1: DuplicateKey の定義箇所と呼び出し元

**実態**: `DuplicateKey` という同名の型が **2つ、意図的に別パッケージで定義**されている(層独立性のため。コメントで明記)。

| 定義箇所 | 層 | 備考 |
|---|---|---|
| `internal/repository/combo/repository.go:35-42` | リポジトリ層 | 6項: CharacterID `int64` / StarterMoveID `*int64` / Position `*string` / OpponentStance `*string` / HitType `*string` / OpponentSize `*string` |
| `internal/service/validation/combo.go:74-81` | サービス層(validation) | 同一6項。両者の変換は `internal/service/combo/deps_adapter.go` の... ではなく実際は `internal/service/combo/service.go:807-830` の `ComboDuplicateAdapter.FindActivePublishedDuplicates` で行っている(リポジトリ側コメントは `deps_adapter.go` を指すが、現物は `service.go` に実装。**指示書P-2ではなく実コードでの食い違いとして記録**) |

呼び出し元(構築箇所)一覧、経路別:

| ファイル:行 | 経路 |
|---|---|
| `internal/service/validation/combo.go:163`(`validateC02Duplicate`内) | `ValidateComboForCreate` 経由。**POST /api/combos**(Create)と **PUT /api/combos/:id**(UpdateWithKeyChange)の両方が共通利用 |
| `internal/service/combo/service.go:735`(`CheckDuplicate`内) | **POST /api/combos/check-duplicate** |
| `internal/service/combo/service.go:820`(`ComboDuplicateAdapter.FindActivePublishedDuplicates`内) | 上記2経路から`validDeps.ComboRepo`経由で呼ばれるアダプタ変換 |
| `internal/repository/combo/repository_test.go`、`internal/service/combo/service_test.go`、`internal/service/validation/combo_test.go` | テストのみ(本番経路ではない) |

**CSV import 経路**: `internal/service/comboio/import.go:201,284` にコメントで「いずれも combos の同一性(recipe_hash / RecomputeComboCache / DuplicateKey)には触れない」と明記されており、**CSV import は重複判定を実行しない**(DuplicateKey構築コード自体が comboio パッケージに存在しない。0件)。

**web/src/ での該当**: `grep -rn "DuplicateKey" web/src/` は **0件**(フロントは型名を参照せず `CheckDuplicateRequest` の各フィールドを直接送信するのみ)。

**契約・正典との差**: 指示書 P-1/P-2 の記述(6項の型・CheckDuplicateRequestの形)は実コードと一致。P-2 の「変換は `deps_adapter.go`」という repository.go のコメント記述は、実際の実装ファイル(`service.go`)とズレている(コメントの参照先誤りの可能性。事実として記録、判断はしない)。

**M18-03スコープへの含意**: dup判定の呼び出し口はCreate/PUT/check-duplicateの3箇所に閉じている。CSV importは対象外(意図的)。materialize生成時にどの経路を使うかで、dup判定の要否が変わりうる。

---

### A-2: 重複判定の実SQL・nil比較セマンティクス(最重要)

**実態**: `internal/repository/combo/repository.go:817-870` の `FindActiveByDuplicateKey` が実SQLを組み立てる。

```go
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
```
(`repository.go:825-837`)

- **5項(StarterMoveID/Position/OpponentStance/HitType/OpponentSize)全て**、nil のとき `col IS NULL` を WHERE に追加(キーから外す、ではなく `IS NULL` 述語として残す)。非nilのときは `col = ?`。
- **CharacterID は非nullable(`int64`)なので常に `character_id = ?`。**
- **結論(根拠行 `repository.go:825-832`)**: nilのフィールドは `IS NULL` として評価されるため、**同じフィールドがnilの既存コンボは「一致」とみなされる**(SQLの `IS NULL` は他のNULL行にもマッチする。`= NULL` ではないため常に偽になる問題は発生しない)。つまり `starter_move_id` が両方未設定の2コンボは、他の項目が一致すれば重複候補として拾われる。

**recipe_hash比較との関係**: SQL側の6項一致で候補を絞り込んだ後、`internal/service/validation/combo.go:177-183`(`validateC02Duplicate`)および`internal/service/combo/service.go:750-766`(`CheckDuplicate`)で **`c.RecipeHash == newComboRecipeHash` の文字列完全一致**を追加で判定する。両方(6項一致 かつ recipe_hash一致)が揃って初めて重複と判定される。

**契約・正典との差**: DES-006 §2.3 は「同一コンボ」の判定基準(character_id/starter_move_id/レシピシーケンス/position・opponent_stance・hit_type・opponent_size)を文章で定義しているが、**nil同士の扱いについては明記が無い**。実装は上記の通り「nil同士は一致」という一貫した解釈で動いている。矛盾ではなく、設計書側が未言及の実装詳細。

**M18-03スコープへの含意**: `starter_move_id`が未設定(NULL)のコンボ同士でも、他5項+recipe_hashが一致すれば重複判定にヒットする。手動入力導線(§4-j)でstarter_move_idを設定しないケースを想定する場合、このnil一致挙動を踏まえてテストケースを設計する必要がある。

---

### A-3: recipe_hash / CalcRecipeHash の実体

**実態**:
- **DBカラムとしての`recipe_hash`は存在しない**(`grep -rn "recipe_hash" migrations/`は0件。`combos`/`setups`双方に存在するのは`recipe_cache`(JSON、表示用プリセット文字列キャッシュ、DES-003 §3.4記載どおり)であり、別物)。
- `internal/repository/combo/repository.go:108`のコメント: 「recipe_hash は使わない(SUPP-001 §2.2 はサービス層計算値、Q1 で決定)」— **recipe_hashはサービス層の計算値であり、DBに保存されない**ことが設計判断として明記されている。
- **定義箇所**: `internal/service/combo/duplicate_keys.go:45` `func CalcRecipeHash(steps []model.ComboStep) string`。
- **入力材料・アルゴリズム**(同ファイル34-75行のコメント+実装): (1) steps を `StepOrder` 昇順にソート、(2) 各ステップの `Modifiers.Flags` を `sort.Strings` で正規化、(3) 各ステップを `<moveID or "null">:<canonicalModifiersJSON>` に文字列化、(4) `\n` 連結、(5) SHA-256 → hex文字列。空レシピは precomputed な `emptyRecipeHash`(空文字列のSHA-256)を返す。
- **呼び出し元**(非テスト): `internal/service/combo/service.go:165`(Create)/`377`(UpdateMetadata内、他候補との比較用途)/`480`(UpdateWithKeyChange)/`733`(CheckDuplicate)/`847`(ComboDuplicateAdapter内、候補のsteps一括ロード後)。
- **setup側の並行実装**: `internal/repository/setup/repository.go:787-841` に `calcSetupRecipeHashFromSteps`(コメントで「comboパッケージのCalcRecipeHashと同アルゴリズム(SHA-256)」と明記)が存在。setupsサービス側に`CalcSetupRecipeHash`(`internal/repository/setup/repository_test.go:514`で参照)。

**契約・正典との差**: 差なし。DES-006 §2.3の「レシピ(combo_stepsのシーケンス)が同じ」という文言と、実装(step_order昇順+flags正規化+SHA-256)は整合する。ただし**「move_id列とmodifiers列の順序込み完全一致」という文言**は、`Modifiers.Flags`配列内部の順序については実装が明示的に**無視(sort.Stringsで正規化)**しており、`TestCalcRecipeHash_FlagsOrderInvariant`(`internal/service/combo/duplicate_keys_test.go`)がその挙動をテストしている。「順序込み」がFlags配列内部の順序まで含意するかは読み方次第であり、事実として指摘するのみで判断はしない。

**M18-03スコープへの含意**: materializeで生成するコンボのrecipe_hashは、基底コンボと異なるsteps(始動技×1.2ダメージ等の加工)であれば当然異なる値になる。DBに保存されないため、materialize後のドリフト検出(§3.4のコメント参照)にはrecipe_hashは使われない設計になっている(`materialized_from_combo_id`列自体がドリフト検出用と DES-003 に明記)。

---

### A-4: RecomputeComboCache の定義箇所・呼び出し条件

**実態**:
- **定義箇所**: `internal/service/notation/cache.go:62` `func (s *service) RecomputeComboCache(ctx context.Context, tx *sql.Tx, comboID int64) error`。インターフェース宣言は `internal/service/notation/service.go:23-25`。

| 呼ばれる経路 | ファイル:行 |
|---|---|
| Create(POST /api/combos) | `internal/service/combo/service.go:203` |
| UpdateWithKeyChange(PUT /api/combos/:id) | `internal/service/combo/service.go:599` |
| Restore(POST /api/combos/:id/restore) | `internal/service/combo/service.go:683` |

| 呼ばれない経路 | 根拠 |
|---|---|
| UpdateMetadata(PATCH /api/combos/:id) | `service.go:362-478`の範囲に呼び出しなし(steps/レシピを変更しないため) |
| Delete(DELETE /api/combos/:id、論理削除) | `service.go:639-662`は`DeleteComboCache`のみ呼ぶ(`654行`) |
| PermanentDelete(DELETE /api/combos/:id/permanent) | `service.go:697-724`に notation 呼び出し無し |
| CheckDuplicate | 保存を伴わないため対象外(コメントで明記: `service.go:731`) |

**契約・正典との差**: DES-003 §3.4のメディア3列(link/video_path/image_path)・§2.5のゲージ消費列に関する「RecomputeComboCacheを呼ばない」という記述と、UpdateMetadataが呼ばないという実測は整合(UpdateMetadataはこれらのフィールドのみ更新でstepsを触らないため)。差なし。

---

### A-5: check-duplicate ハンドラの経路とレスポンス形状

**実態**: `internal/api/combo/check_duplicate_handler.go`(独立ファイル)。
- `Handler.CheckDuplicate`(15-67行) → `c.Bind(&CheckDuplicateRequest)` → `combosvc.CheckDuplicateInput`に変換 → `s.service.CheckDuplicate`(`internal/service/combo/service.go:732-768`) → `s.validDeps.ComboRepo.FindActivePublishedDuplicates`(`ComboDuplicateAdapter`経由、`repository.FindActiveByDuplicateKey`へ)。
- **レスポンス形状**: `CheckDuplicateResponse{ Duplicates []DuplicateInfoResponse }`。各要素は `id/characterId/starterMoveId/position/opponentStance/hitType/opponentSize/stepCount` のみ(`internal/api/combo/dto.go`)。**damage・名称等は含まれない**(真偽だけでもないが、既存コンボの完全な内容も返さない中間的な形)。
- **excludeComboIdの用途**: `internal/service/combo/service.go:752` で `c.ID == *input.ExcludeComboID` の候補をスキップする。**呼び出し元**: `web/src/features/combo/components/ComboEditor.tsx:168` `excludeComboId: mode === "edit" ? initial?.id : undefined` — **編集モードで自分自身を重複候補から除外する**ために使われている(新規/コピーモードでは未指定)。

**契約・正典との差**: 記載なし(DES側にレスポンス形状の詳細規定は無い)。

---

### A-6: hit_type の Go 側 whitelist

**実態**: **whitelist(値検証)は複数箇所に分散して存在**し、しかも定義場所によって役割が異なる。

| 箇所 | 内容 | 実際に使われているか |
|---|---|---|
| `internal/model/combo.go:9-14` | `const HitTypeNormal="normal" / HitTypeCounter="counter" / HitTypePunishCounter="punish_counter" / HitTypeJustParryPunishCounter="just_parry_punish_counter"` | **定義のみで、他ファイルからの参照 0 件**(grep実測。自ファイル内コメント言及のみ) |
| `internal/service/comboio/csvcore/rules.go:50-52` | `DefaultHitTypes = []string{"normal","counter","punish_counter","just_parry_punish_counter"}` (model.HitType*定数を再利用せずリテラルで再定義) | **CSV import検証(VAL-I相当)で実使用**。`rules.go:112` `hitTypes: toSet(o.AllowedHitTypes, DefaultHitTypes)` 経由 |
| `web/src/constants/combo-list.ts:35-41` | `HIT_TYPE_VALUES`(配列+型+ラベル) | フロントの主定義 |
| `web/src/features/combo/labels.ts:44-60` | `HIT_TYPE_LABEL_JA` / `HIT_TYPE_OPTIONS`(combo-list.tsとは別に同じ4値をリテラルで再定義) | ComboEditorの選択肢UIで使用 |

**それを参照している検証関数**: CSV importの`ParseAndValidate`(`csvcore/rules.go`経由)のみが確認できた。**メインのCreate/PUT API経路(`ValidateComboForCreate`)には hit_type の値そのものを検証するVAL-Cxxが存在しない**(DES-006 §2.1のVAL-C02〜C13一覧にもhit_type値検証は無い。hit_typeは重複判定キーの材料としてのみ使われ、値の妥当性チェックはCSV importの境界でのみ行われる)。

**契約・正典との差**: DES-003 §3.4は「hit_typeはTEXT、NULL可、DB CHECK制約なし、アプリ層で制約」と記載。実態は「アプリ層」がCSV import限定であり、メインAPI(POST/PUT /api/combos)には値検証が無い。CLAUDE.mdの列挙定数規約(「列挙的文字列定数はパッケージ定数として定義」)と照らすと、`model.HitType*`定数が定義済みなのに`csvcore/rules.go`・`web/src/features/combo/labels.ts`の双方がリテラルで再定義しており、3箇所以上に同じ4値がリテラル散在している状態。事実として記録。

---

### A-7: DES-006 §2.3 記述と実機序の差分(まとめ)

| DES-006 §2.3 の記述 | 実機序 | 差分 |
|---|---|---|
| character_id が同じ | `character_id = ?`(非nullable) | 差なし |
| starter_move_id が同じ | nilなら`IS NULL`、非nilなら`= ?` | **nil同士の扱いは設計書に明記なし(A-2参照)。実装は「一致」として扱う** |
| レシピ(combo_stepsのシーケンス)が同じ(move_id列とmodifiers列の順序込み完全一致) | `CalcRecipeHash`でstep_order昇順+Flags配列を正規化(順序無視)した上でSHA-256比較 | **Flags内部の順序は実装上ハッシュに影響しない(A-3参照)。「順序込み」の読み方次第で差と見るかは判断が分かれる余地があるため事実のみ記録** |
| 状況の主要項目(position/opponent_stance/hit_type/opponent_size)が同じ | 同様に`IS NULL`/`=?` | 差なし(nil扱いはstarter_move_idと同型) |
| 仮登録と本登録の間では重複判定は行わない | `is_draft = 0` が固定WHERE句 | 差なし |
| 論理削除済みレコードは対象外 | `deleted_at IS NULL` が固定WHERE句 | 差なし |

---

## B. materialize の実装面(既存経路の棚卸し)

### B-1: materialized_from_combo_id を読み書きしているコード

**実態**: `grep -rn "materialized_from\|MaterializedFrom" internal/ web/src/ migrations/`の結果、ヒットは以下のみ。

- `migrations/000038_add_combos_materialized_from.up.sql:6` — `ALTER TABLE combos ADD COLUMN materialized_from_combo_id INTEGER REFERENCES combos(id);`
- `migrations/000038_add_combos_materialized_from.down.sql:3` — DROP COLUMN
- `internal/infra/migration/migrate_m1801_test.go`(6箇所) — このマイグレ自体の存在確認・self-FK制約テスト(生SQL直書き)

**model/service/repository/api/frontend の全レイヤで参照0件**。つまり「マイグレのみ＝列は追加されただけで未使用」(指示書の想定どおり)。

### B-2: コンボ新規作成の実経路・INSERT列全数

**実態**: `combo.Handler.Create` → `combosvc.Service.Create`(`internal/service/combo/service.go:161-260`) → `repo.InsertCombo`(`internal/repository/combo/repository.go:248-271`、SQL本体は`221-246`の`insertComboSQL`)。

**INSERT対象列(22列、`materialized_from_combo_id`は含まれない)**:
`character_id, is_draft, damage, drive_available_at_start, sa_available_at_start, drive_damage, sa_gauge_consumed, drive_gauge_consumed, starter_move_id, position, opponent_stance, hit_type, opponent_size, situation, knockdown_advantage, memo, link, video_path, image_path, step_count, recipe_cache, version`

(`id`/`created_at`/`updated_at`/`deleted_at`はPKまたはDBデフォルトで別途処理。`materialized_from_combo_id`はB-1同様、INSERT文に一切現れない)

### B-3: model.Combo の全フィールド・MaterializedFromComboID の有無

**実態**(`internal/model/combo.go`、code-facts §8で確認済みの内容を実ファイルでも裏取り): `Combo`構造体は27フィールド(ID/CharacterID/IsDraft/Damage/DriveAvailableAtStart/SAAvailableAtStart/DriveDamage/SAGaugeConsumed/DriveGaugeConsumed/StarterMoveID/Position/OpponentStance/HitType/OpponentSize/Situation/KnockdownAdvantage/Memo/Link/VideoPath/ImagePath/StepCount/RecipeCache/Version/CreatedAt/UpdatedAt/DeletedAt/Steps/Tags/OkiOptions/DefaultRecipe/StarterMoveCode)。**`MaterializedFromComboID`相当のフィールドは存在しない**。

`ComboResponse`(`internal/api/combo/dto.go`)にも同様に該当フィールドなし(code-facts §7で確認)。GET /api/combos/:idのレスポンスに`materializedFromComboId`は**露出していない**。

### B-4: ダメージ列の型・NULL可否、始動技ダメージ経路

**実態**: `combos.damage`は`migrations/000001_init_schema.up.sql:62`で`INTEGER`(NULL可、NOT NULL制約なし)として定義され、以後の変更マイグレなし。`model.Combo.Damage *int`(db:damage)と対応。

**始動技のダメージを引く経路**: `grep -rn "\.Damage\b" internal/service/ internal/repository/`の結果、combos.damageは常に`input.Damage`(APIリクエストの手入力値、`CreateInput.Damage *int`)がそのままINSERT/UPDATEされるのみで、**`moves.damage`(始動技のダメージ)から自動計算・コピーする既存コードは見つからなかった(無し)**。`punishfinder`や`setplay`サービスは`move.Damage`を参照するが、それらは走査用途であり`combos.damage`への書き込みには関与しない。

### B-5: レシピ(combo_steps)複製に使える既存コード

**実態**: 専用の「stepsを複製する」ヘルパー関数は見つからなかった(無し)。最も近い既存パターンは以下:

- `UpdateWithKeyChange`(PUT、`internal/service/combo/service.go:478-633`)は、**リクエストで送られてきた全stepsを`buildComboFromInput`(`774-818`行)で新規構築し直す**方式(旧コンボのstepsをDBから読んで複製する処理ではなく、クライアントが常にフルレシピを再送する前提)。
- `CreateInput.Steps`の型は`[]model.ComboStep`であり、これは`FindByID`が返す`model.Combo.Steps`と**同一の型**。そのため、基底コンボの`Steps`を`CreateInput.Steps`にそのまま渡すことは型としては可能(専用の変換関数は存在しないが、型変換コードを新規に書く必要は無い、という事実)。
- フロント側の「コピー」機能: `web/src/pages/ComboDetailPage.tsx:75` `to={\`/combos/new?copyFrom=${comboQuery.data.id}\`}` というリンクが存在する(コピー登録導線。ComboEditorの`mode="copy"`に対応)。

### B-6: combos の論理削除と重複判定の関係

**実態**: A-2で確認した`FindActiveByDuplicateKey`のWHERE句に`deleted_at IS NULL`が固定で含まれる(`repository.go:821`)。**論理削除済みコンボは重複判定の対象から除外される**。DES-006 §2.3の記述(「論理削除済みレコードは重複判定の対象外とする」)と一致(差なし)。

---

## C. 案C(neutral_jumping_heavy_kick を含める)の影響範囲

### C-1: ジャンプ経由レーンの始動技抽出述語の実体

**実態**: `internal/service/punishfinder/service.go:290-296`(`buildStarters`関数内):

```go
// ジャンプ経由レーン: jump_forward.total が非 NULL のキャラのみ・強攻撃(is_aerial=1 かつ jumping_heavy_)。
if totals.JumpForward != nil {
    if sm.IsAerial && strings.HasPrefix(sm.Code, jumpHeavyPrefix) && adv >= *totals.JumpForward-JumpSlack {
        out = append(out, s.starterNode(sm, model.PunishLaneJump, nil, oppMoveID, verdictIdx))
    }
}
```

**現行述語**: `sm.IsAerial == true` かつ `strings.HasPrefix(sm.Code, "jumping_heavy_")`(前方一致)かつフレーム条件。**`category`は現行述語に含まれていない**。

**定数の実値**(`internal/service/punishfinder/constants.go`):
- `DashMinSlack = 4`(ダッシュ経由レーンの残り猶予下限。指示書が想定した`DASH_MIN_SLACK`という命名ではなくPascalCaseの`DashMinSlack`)
- `JumpSlack = 4`(同様に`JUMP_SLACK`ではなく`JumpSlack`)
- `jumpHeavyPrefix = "jumping_heavy_"`(非公開定数)
- `movementSystemCodes`(9種、map[string]bool): forward/back/micro_forward/micro_back/dash_forward/dash_back/jump_neutral/jump_forward/jump_back

### C-2: dev DB実測(基準時点2026-07-26、一次源=dev DB、単位=moves行)

**(a) is_aerial=1 AND category='normal' AND code に `jumping_heavy_` を含む — 全23件**:

| character | code | startup | damage |
|---|---|---|---|
| guile | jumping_heavy_kick | 10 | 800 |
| guile | jumping_heavy_punch | 9 | 800 |
| ingrid | jumping_heavy_kick | 12 | 800 |
| ingrid | jumping_heavy_punch | 9 | 800 |
| juri | jumping_heavy_kick | 10 | 800 |
| juri | jumping_heavy_punch | 12 | 900 |
| juri | neutral_jumping_heavy_kick | 10 | 800 |
| ken | jumping_heavy_kick | 10 | 800 |
| ken | jumping_heavy_punch | 9 | 800 |
| ken | neutral_jumping_heavy_kick | 6 | 900 |
| kimberly | jumping_heavy_kick | 9 | 630 |
| kimberly | jumping_heavy_punch | 8 | 630 |
| lily | jumping_heavy_kick | 11 | 800 |
| lily | jumping_heavy_punch | 10 | 800 |
| mai | jumping_heavy_kick | 10 | 800 |
| mai | jumping_heavy_punch | 9 | 800 |
| ryu | jumping_heavy_kick | 10 | 800 |
| ryu | jumping_heavy_punch | 9 | 800 |
| terry | jumping_heavy_kick | 10 | 800 |
| terry | jumping_heavy_punch | 9 | 800 |
| zangief | jumping_heavy_kick | 10 | 800 |
| zangief | jumping_heavy_kick_holding | 32 | 1500 |
| zangief | jumping_heavy_punch | 9 | 800 |

**(b) 上記のうち現行述語(`code LIKE 'jumping_heavy_%'`前方一致)に合致 — 21件**(上表からjuri/kenの`neutral_jumping_heavy_kick`2行を除いた全て。P-7「21件」と一致)。

**(c) (a)−(b) = 案Cで新たに拾われる技 — 2件**:

| character | code | startup | damage |
|---|---|---|---|
| juri | neutral_jumping_heavy_kick | 10 | 800 |
| ken | neutral_jumping_heavy_kick | 6 | 900 |

**(d) code に `neutral_jumping` を含む全件(全category対象) — 2件**(上記(c)と同一。他characterに`neutral_jumping`系moveは存在しない)。

### C-3: 移動system moveのtotal、jump 3code同値確認(全キャラ・基準時点2026-07-26・一次源=dev DB)

| character | jump_neutral | jump_forward | jump_back | 3値同一か |
|---|---|---|---|---|
| c_viper | NULL | NULL | NULL | ○(NULL同士) |
| dhalsim | NULL | NULL | NULL | ○(NULL同士) |
| guile | 43 | 43 | 43 | ○ |
| ingrid | 43 | 43 | 43 | ○ |
| juri | 43 | 43 | 43 | ○ |
| ken | 43 | 43 | 43 | ○ |
| kimberly | 43 | 43 | 43 | ○ |
| lily | 45 | 45 | 45 | ○ |
| mai | 43 | 43 | 43 | ○ |
| ryu | 43 | 43 | 43 | ○ |
| terry | 43 | 43 | 43 | ○ |
| zangief | 44 | 44 | 44 | ○ |

**結論**: dev DB全12キャラクター中、**不一致キャラは0件**。`c_viper`/`dhalsim`は3値ともNULL(P-9と一致)。**キャラ総数は12件**(指示書の「10キャラ全数」という表現は、movement backfill対象の10キャラを指すと解釈すれば整合。NULLの2キャラを含めれば12キャラ)。

### C-4: MovementTotals の取得列・SQL

**実態**: `internal/repository/punish/queries.go:27-31`:
```sql
SELECT code, total
FROM moves
WHERE character_id = ?
  AND code IN ('dash_forward', 'jump_forward')
```
**`jump_neutral`はSQLのIN句に含まれておらず、取得していない**ことをSQL文そのもので確認(`internal/repository/punish/scan.go:57-84`の`GetMovementTotals`実装が上記SQLを実行し、switch文で`dash_forward`/`jump_forward`の2値のみを`MovementTotals`構造体に詰める)。

### C-5: unique系空中特殊技のcategory実値(基準時点2026-07-26・一次源=dev DB)

**実態**: `category='unique' AND is_aerial=1`でSELECTした結果、**7件**:

| character | code | category | is_aerial |
|---|---|---|---|
| kimberly | elbow_drop | unique | 1 |
| kimberly | step_up_backward | unique | 1 |
| kimberly | step_up_forward | unique | 1 |
| kimberly | step_up_neutral | unique | 1 |
| lily | great_spin | unique | 1 |
| zangief | flying_body_press | unique | 1 |
| zangief | flying_headbutt | unique | 1 |

**契約・正典との差**: M18-overview §2.2の記載は「unique系空中特殊技(elbow_drop等8件)」だが、**dev DB実測は7件**。件数の食い違いを事実として記録する(想定外の発見。判断はしない)。全件`category='unique'`であり、案Cの`category='normal'`条件では自動的に除外される(事実確認)。

---

## D. M18-03 が触る面の as-built 棚卸し(E-14)

### D-1: M18-02が触った資産(実ファイル・行数)

| ディレクトリ | ファイル | 行数 |
|---|---|---|
| `internal/service/punishfinder/` | constants.go | 53 |
| | service.go | 367 |
| | service_test.go | 510 |
| `internal/repository/punish/` | crud.go | 48 |
| | queries.go | 81 |
| | repository.go | 113 |
| | repository_test.go | 177 |
| | scan.go | 151 |
| `internal/api/punish/` | dto.go | 29 |
| | handler.go | 161 |
| | handler_test.go | 181 |
| | routes.go | 17 |
| `web/src/features/punish/` | types.ts | 59 |
| | api.ts | 118 |
| | components/PunishTree.tsx | 438 |
| | components/PunishTree.test.tsx | 221 |

(punishディレクトリ計4ファイル・836行)

### D-2: M19-01が触った資産

| ディレクトリ | ファイル | 行数 |
|---|---|---|
| `internal/service/setplay/` | golden_test.go | 111 |
| | service.go | 369 |
| | service_test.go | 407 |
| | setplay.go | 265 |
| | setplay_test.go | 510 |
| `internal/api/setplay/` | handler.go | 131 |
| | dto.go | 52 |
| | handler_test.go | 148 |
| | routes.go | 9 |
| `web/src/features/setplay/` | setplay-notice-storage.ts | 8 |
| | types.ts | 55 |
| | api/setplayApi.ts | 36 |
| | components/SetplaySuggestionSection.tsx | 432 |
| | components/SetplaySuggestionSection.test.tsx | 229 |
| | components/SetplayLimitationNotice.tsx | 75 |
| | components/SetplayLimitationNotice.test.tsx | 53 |
| | components/SetplayTargetPicker.tsx | 97 |
| | hooks/useSetplaySuggestions.ts | 16 |

**`setplay-suggestions`/`SetupCandidateList`キーワードで見つかった追加の関連箇所**: `web/src/pages/ComboDetailPage.tsx`(統合ポイント。D-3参照)、`web/src/features/setup/components/SetupCandidateList.tsx`/`.test.tsx`(自コンポーネント名としての一致。setplay自体のファイルではない)。

### D-3: ComboDetailPage の as-built 表示項目(上から順・全数)

**実態**(`web/src/pages/ComboDetailPage.tsx`):

1. 戻るリンク + アクションボタン行(編集/コピー/PromoteToFinalButton〔isDraftの場合〕/削除)
2. `ValidationDisplay`(昇格時バリデーションエラー、promoteError)
3. ローディング/エラー表示(条件付き)
4. `ComboDetailHeader`
5. `ComboDetailRecipe`
6. `ComboDetailMetadata`
7. セットプレイ展開セクション(コード内コメント「DES-005 §5.6 item 8」。setups一覧 + 「セットプレイ追加」「既存から紐付け」ボタン)
8. `SetupCandidateList`(`candidatesQuery.data.length > 0`のとき表示)
9. **`SetplaySuggestionSection`**(M19-01。コード内コメント「M19-01: セットプレイ自動提案(単一コンボ候補面に相乗り)。既存FR011候補は不変。」)
10. `LinkExistingSetupModal`(モーダル、characterId存在時)
11. `DeleteComboConfirm`(モーダル、メインコンテンツ外)

**M19-01のセットプレイ自動提案の位置**: 項目9、`SetupCandidateList`(項目8)の直後・`LinkExistingSetupModal`の直前に配置。

### D-4: ComboEditor の Props契約・location.state

**実態**(`web/src/features/combo/components/ComboEditor.tsx:57-64`):
```ts
interface Props {
  mode: "new" | "edit" | "copy";
  initial?: ComboDetail;
  initialCharacterId?: number;
}
```
**Props全数3件**。

**location.stateから読んでいるキー**(同ファイル78-86行):
- `punishReturn?: string`(確定反撃サーチ〔M18-02〕からの遷移時の戻り先URL)
- `punishContext?: { opponentLabel: string; starterLabel?: string }`(保存メッセージ用の文脈情報)

**キー全数2件**(ファイル全体を確認、他のlocation.state参照は無し)。

### D-5: queryKey全数(punish/combo/setplayに関わるもの)と invalidate元

**combo関連**:

| queryKey | 用途 | ファイル:フック名 |
|---|---|---|
| `["combo", numId]` | query定義 | combo/api.ts: `useCombo` |
| `["combo", comboId, "recipe", presetId]` | query定義 | combo/api.ts: `useComboRecipe` |
| `["combos", filter]` | query定義 | combo/api.ts: `useCombos` |
| `["combos"]` | invalidate | combo/api.ts: `useDeleteCombo`(104-107行)/`useCreateCombo`(161-168行、常に)/`useUpdateComboMetadata`(179-183行)/`useUpdateComboWithKeyChange`(194-201行) |
| `["combo", id]` | invalidate | combo/api.ts: `useUpdateComboMetadata`(181行) |
| `["combo", id]` | invalidate(削除・removeQueries) | combo/api.ts: `useUpdateComboWithKeyChange`(196行。旧IDを削除し`setQueryData(["combo", newId], data)`で新IDを直接注入。newIdへのinvalidateはしない) |
| `["setups"]` | invalidate | combo/api.ts: `useCreateCombo`(164行、`variables.setups`が空でない場合のみ) |
| `["setupCandidates"]` | invalidate | combo/api.ts: `useCreateCombo`(165行、同条件) |
| `["combos"]` | invalidate | combo/hooks/usePermanentDelete.ts・useRestoreCombo.ts |
| `["combo", args.comboId]`/`["combos"]`/`["tags",...]` | invalidate | mycombo/hooks/useUpdateMyComboStatus.ts |

**punish関連**(`web/src/features/punish/api.ts`。**5つの mutation全てが共通ヘルパ`useInvalidatePunishFinder()`(38-41行)経由で`[PUNISH_FINDER_KEY]`(="punish-finder")を invalidate**):

| queryKey | 用途 | フック |
|---|---|---|
| `[PUNISH_FINDER_KEY, selfCharacterId, opponentCharacterId, guardType]` | query定義 | `usePunishTree` |
| `[PUNISH_FINDER_KEY]` | invalidate | `useSetStarterVerdict`/`useDeleteStarterVerdict`/`useAddPruning`/`useAddPunish`/`useRemovePunish`(全て同一ヘルパ経由) |
| `["command-index",...]`/`["punish-finder"]`(リテラル文字列) | invalidate | moves/api.ts(技編集の副作用としてpunish-finderも無効化) |

**setplay関連**:

| queryKey | 用途 | ファイル |
|---|---|---|
| `["setplaySuggestions", { comboId, applied }]` | query定義 | setplay/hooks/useSetplaySuggestions.ts |
| `["setplaySuggestions"]` | invalidate | setplay/components/SetplaySuggestionSection.tsx(256-258行、採用ミューテーション成功時) |

### D-6: 4表それぞれの現在のCRUD状況

| 表 | repository層のSELECT/INSERT/DELETE | frontend | 備考 |
|---|---|---|---|
| `combo_punishes` | SELECT(queries.go:48、JOIN内)/INSERT(65行)/DELETE(71行) | POST=`useAddPunish`/DELETE=`useRemovePunish`(punish/api.ts) | フルCRUD稼働 |
| `combo_punish_prunings` | SELECT(36行)/INSERT(75行)/DELETE(81行) | POST=`useAddPruning`のみ確認。**DELETE(解除)を呼ぶフロントエンドフックは見当たらなかった**(`grep -rn "combo-punish-prunings" web/src/`は`useAddPruning`のPOST呼び出し1件のみ) | バックエンドのDELETE経路(`punish.Handler.DeletePruning`、ルート登録済み)は存在するが、フロント未接続の可能性 |
| `combo_punish_curations` | **repository/service/api の全レイヤで0件**(migrations 000037とそのマイグレテスト`migrate_m1801_test.go`のみ) | 0件 | **未使用確定**。APIルート一覧(code-facts §4)にも`combo-punish-curations`関連のエンドポイントが存在しない |
| `combo_punish_starters` | SELECT(42行)/INSERT(54行)/DELETE(60行) | POST=`useSetStarterVerdict`/DELETE=`useDeleteStarterVerdict` | フルCRUD稼働 |

### D-7: 自技側 startup IS NULL の実測(基準時点2026-07-26・一次源=dev DB)

**実態**: `is_aerial=0 AND damage>0 AND startup IS NULL` — **全2件**(20件以下のため全件列挙):

| character | code | category | damage |
|---|---|---|---|
| ingrid | satelite_leap | target_combo | 1400 |
| lily | double_arrow | target_combo | 1400 |

両件とも`category='target_combo'`。

### D-8: export経路のas-built(hit_typeの出力)

**実態**:
- **CSV export**: `internal/service/comboio/csvcore/csvexport.go:90` `ColHitType: c.HitType` — **verbatim文字列そのまま出力**(ラベル変換なし)。DES-003 §3.4の「CSV契約はverbatim往復」と整合。
- **PDF/PNG export**(html-to-imageベース。`web/src/features/combo-io/export-model.ts`): `HIT_TYPE_LABELS`(`web/src/constants/combo-list.ts`由来)を`labelFor(HIT_TYPE_LABELS, combo.hitType)`(export-model.ts:82行)で日本語ラベルに変換して表示。
- **`just_parry_punish_counter`の写像**: `web/src/constants/combo-list.ts:100` `just_parry_punish_counter: "パニッシュカウンター(ジャストパリィ反撃)"` として**存在を確認**。PDF/PNG export側はこのラベル定義を再利用するため、ジャストパリィ区分も出力に反映される。

---

## 想定外の発見・矛盾の事実指摘(§0.3(2))

1. **C-5**: unique系空中特殊技の件数が、M18-overview §2.2の記載「8件」に対し、dev DB実測は**7件**。
2. **A-1**: `internal/repository/combo/repository.go:33`のコメントは変換アダプタの実装場所を`internal/service/combo/deps_adapter.go`と記しているが、実際の実装は`internal/service/combo/service.go:807-830`(`ComboDuplicateAdapter`)にある(`deps_adapter.go`というファイル自体は`internal/service/combo/`に存在する — `ls`で確認済み — が、当該アダプタの実装本体は`service.go`側)。
3. **A-6**: `model.HitType*`定数(`internal/model/combo.go`)が定義済みだが、CSV import側(`csvcore/rules.go`)・フロント2箇所(`combo-list.ts`/`labels.ts`)がいずれもリテラルで同じ4値を再定義しており、定数を参照していない(3箇所以上のリテラル散在)。
4. **D-6**: `combo_punish_prunings`はDELETE経路がバックエンドに実装済み(ルート・リポジトリとも存在)だが、フロントエンドから呼ぶフックが見当たらない。

---

## 開発者確認事項 P-1〜P-10 の裏取り結果

| # | 前提事実 | 裏取り結果 |
|---|---|---|
| P-1 | DuplicateKey 6項 | **裏取りできた**(A-1参照。ただし同名の型が2つ、サービス層側にも存在する点は指示書に無い追加情報) |
| P-2 | CheckDuplicateRequest 6項+steps+excludeComboId | **裏取りできた**(A-1/A-5参照) |
| P-3 | CreateRequestにmaterializedFromComboId無し | **裏取りできた**(B-2/B-3参照) |
| P-4 | materialized_from_combo_idはNULL可・dup判定と recipe_hash の非対象 | **裏取りできた**(B-1で読み書きコード自体が無いことを確認。DES-003 §3.4の記述とも整合) |
| P-5 | hit_type 4値・DB CHECK無し・Go側whitelist | **一部食い違い**。Go側whitelist(名前付き定数)は存在するが実際に使われているのはCSV import限定のリテラル配列(A-6参照) |
| P-6 | MovementTotalsはDashForward/JumpForwardの2値のみ | **裏取りできた**(C-4参照) |
| P-7 | ジャンプ経由レーン該当21件(基準時点2026-07-24) | **裏取りできた**(C-2(b)で21件、基準時点2026-07-26でも同数) |
| P-8 | is_aerial=1は70件、うち9件がjumping_以外 | **未確認**(指示書スコープ外のためSELECT未実施。C-2ではjumping系のみ対象とした) |
| P-9 | 移動5code backfillは10キャラ×5、c_viper/dhalsimはNULL | **裏取りできた**(C-3で3codeのみ確認したが、10キャラ非NULL・2キャラNULLの構図は一致) |
| P-10 | M19-01がsetplay-suggestionsエンドポイント+DES-005項目12を追加 | **裏取りできた**(D-2/D-3参照) |

---

## read-only 遵守の確認

本調査では `view`/`grep`/`find`/`ls`/dev DBへの`SELECT`(python3標準`sqlite3`モジュール経由、`mode=ro`で接続)のみを使用し、ソース・マイグレ・seed・DES/REQ本体・テスト・dev DBへの書き込みは一切行っていない。

**git status(本レポート作成直前に実行)**: 本調査の開始前から `docs/handover/code-facts.md` / `docs/handover/docs-map.md` / `docs/design/04-notation-spec.md` / `docs/design/05-screen-design.md` が変更状態(M)であり、`docs/instructions/phase3/M18-RESEARCH-02-dup-key-and-materialize-surface.md` が未追跡(??)だった。**これらは本調査(read/grep/SELECT操作のみ)によって生じた変更ではない**(本調査中にWrite/Edit系操作を実行したのは本レポートファイルの新規作成のみ)。`code-facts.md`/`docs-map.md`の差分は生成日時・commitハッシュの更新(2026-07-25→2026-07-26)であり、自動生成資料の再生成による差分と推測されるが、本調査のスコープ外のため深追いしていない。

---

## M18-03 スコープ確定のための要決定事項

1. **nil比較の扱い(A-2)を前提にテストケースを設計するか**: 現状「nil同士は一致」という挙動が確定している。手動入力導線(starter_move_id未設定を許容するケース)でこの挙動を維持するか変更するかは本調査の範囲外(根拠: A-2実測)。
2. **materialize生成経路の選定(B-2/B-5)**: 既存Create経路(DTO拡張)を使うか専用endpointを新設するか。`CreateInput.Steps`と`model.Combo.Steps`が同一型である点(B-5)、`materialized_from_combo_id`がINSERT対象に一切含まれていない点(B-2)が材料。
3. **hit_type値検証の扱い(A-6)**: メインAPI経路には値検証が無く、CSV importにのみ存在する非対称な状態。`model.HitType*`定数が未参照である点も踏まえ、materializeで新設するhit_type値(ジャストパリィ確定反撃等)の検証をどこに置くかは未確定。
4. **combo_punish_curations(D-6)の扱い**: 表は存在するが全レイヤで未使用。M18-03の「隠したもの管理」でこの表を使うのか、別の仕組みにするのかは未確定。
5. **combo_punish_pruningsのDELETE(解除)UI(D-6)**: バックエンドは実装済みだがフロント未接続の可能性がある。M18-overview §2.2の「pruning解除・再表示UI」がM18-03相乗りとされている点と符合するかは、本調査の範囲外(事実確認のみ)。
6. **案C適用後の該当技(C-2(c))2件**(juri/ken の neutral_jumping_heavy_kick)に対する、materialize・確定反撃サーチ双方でのテストケース要否。
7. **C-5の件数食い違い(7件 vs 8件)**: どちらが正か、追加調査が必要か。

---

*以上、M18-RESEARCH-02 調査報告。*
