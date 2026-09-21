# M16-RESEARCH-01 調査報告: ④ 移動 move 化・④'' dash 一本化・レシピ同一性/FR301 dup の着手前調査

| 項目 | 内容 |
|------|------|
| 対応指示書 | `docs/instructions/phase3/M16-RESEARCH-01-taxonomy-dash-dup-survey.md` v1.0.0 |
| 種別 | 実装調査報告(read-only。事実列挙のみ。taxonomy 原則・dash 一本化方式・dup 衝突処理の最終決定は含めない) |
| 調査モード | auto(自由入力指示なし) |
| 作成日 | 2026-07-05 |
| 調査範囲 | §4 A〜E(実 SQL / 実コード / 実データの view・grep・SELECT) |
| dev DB 実測範囲 | `~/.local/share/combomgr/combomgr.db`(SELECT のみ、書込ゼロ)。combos 総数 81(is_draft=1 が 32、deleted_at 非NULL が 48、両条件の否定=`is_draft=0 AND deleted_at IS NULL`〔以下「published」〕が 30) |

---

## 0. 結論サマリ(冒頭)

- **A(移動 move の実態)**: DES-004 §2.1 が定義する移動 system move 9 code のうち、**実際に seed/DB に存在するのは 8 code(`drive_parry`/`dash_forward`/`dash_back`/`jump_neutral`/`jump_forward`/`jump_back`/`micro_forward`/`micro_back`)のみ**。**`forward`/`back`(方向入力単体)は全マイグレーション・全 DB を通じて 0 件**(未 seed)。さらに、**system move が実在するのは character_id=1(ryu)のみ**。ken/ingrid/c_viper/dhalsim(classic5、いずれもマイグレーション未追跡の取込データ)には system move が **1 件も存在しない**。
- **B(dash 二重表現)**: 実コード(Go `internal/model/combo.go`・FE `web/src/features/combo/labels.ts`)は **両方とも SUPP-001 §3.3.3 系(方向別 `dash_forward`/`dash_back`)のみを実装**しており、**DES-004 §2.3 の単値 `dash` はリポジトリ全体で 0 件**(コード・テスト・seed のどこにも存在しない)。dev DB 実データでは **modifier.type=dash 系の非技ステップが combo 17 件・setup 1 件**に対し、system move dash 参照は **combo 2 件・setup 1 件**(しかも setup 13 は両表現が同一レコード内に混在)。M15-03(CHANGE-057)の近手当てにより **新規入力の 3 経路(RecipeBuilder / SetupRecipeEditor / VirtualController)は既に system move へ誘導済み**だが、**既存非技ステップの type 編集(`ModifiersEditor`)は dash_forward/dash_back を選択肢として温存**しており、混在を再発させる経路が残っている。
- **C(dup 衝突実測・核心)**: **recipe_hash は DB 列ではなく `combo.CalcRecipeHash(steps)` によるリクエスト時都度計算**(code-facts に非表出=静的抽出の対象外関数のため)。**modifiers.type・flags・notes すべてがハッシュ対象**。published 30 件を母集団に「modifier.type dash → system move dash」移行を仮定した SELECT ベースの照合を行った結果、**dup 衝突は 0 件**。ただし **ingrid(character_id=6)の published combo #91 は移行不能**(ingrid 用の system move dash が 1 件も存在しないため、置換先が無い)。母集団は現行 dev DB(ryu 中心・少量)であり、開発者確認事項どおり **M14-03b 全キャラ seed 後の再確認が必須**。
- **D(入力 UI)**: dash の新規入力 3 経路は system move へ統一済み。一方、RecipeBuilder/SetupRecipeEditor の統合プルダウンは **「システム」(moves, category=system)と「共通システム(移動・その他)」(modifiers.type)の 2 optgroup に "前ダッシュ"/"後ろダッシュ" が重複表示**される(値は `44` 等の moveId 文字列 と `"nonmove:dash_forward"` の 2 通り)。jump_neutral/jump_forward/jump_back は VirtualController の専用ボタンが無く「全技プルダウン」経由でのみ選択可能だが、**実データでの使用は 0 件**。SUPP-001 §3.3.2 のレシピ表記ルール(ジャンプ move 省略・空中技へ flag 付与)は combo 116 で実例確認。
- **E(target_combo)**: `category='target_combo'` 行・`tc_<番号>` code 行とも **dev DB に 0 件**。schema・Go・FE のいずれにも enum 定義は存在するが、実データでの使用実績は皆無。
- **想定外の発見(事実指摘)**: DES-004 は **§2.1(dash_forward/dash_back)と §2.3(単値 dash)が自己矛盾**している。`high_jump` は DES-004 §2.3(flag・未実装)・SUPP-001 §3.3.1(flag として不採用と明記)・SUPP-001 §3.3.2(move `high_jump`・共通システム外)の**三者が食い違い**、実 DB は c_viper の `high_jump_forward`/`high_jump_neutral`(category=unique、方向別、マイグレーション未追跡origin)で **いずれとも一致しない**。詳細後掲。

---

## A. 移動 system move の seed / 実データ実態

### 実態

**A-1**: DES-004 §2.1(`docs/design/04-notation-spec.md:91-104`)は移動・ジャンプ動作の system move として次の 9 code を定義する: `forward` / `back` / `micro_forward` / `micro_back` / `dash_forward` / `dash_back` / `jump_neutral` / `jump_forward` / `jump_back`。SUPP-001 §3.3.2(`docs/design/supp-001-detailed-design.md:327-336`)はこれとは別に `high_jump`(ヴァイパー固有・「共通システム外」)を move として追加定義する。

実 seed(`migrations/000004_seed_moves_ryu.up.sql:108-118`)で `category='system'` として INSERT される code は次の **8 件のみ**(完全一致列挙):

| code | 000004(ryu) | 000010(aki/jamie/guile) | dev DB 実在(`SELECT code,character_id,category FROM moves WHERE category='system'`) |
|------|:---:|:---:|---|
| `drive_parry` | ✓ | ✓ | character_id=1(id=43) |
| `dash_forward` | ✓ | ✓ | character_id=1(id=44) |
| `dash_back` | ✓ | ✓ | character_id=1(id=45) |
| `jump_neutral` | ✓ | ✗ | character_id=1(id=46) |
| `jump_forward` | ✓ | ✗ | character_id=1(id=47) |
| `jump_back` | ✓ | ✗ | character_id=1(id=48) |
| `micro_forward` | ✓ | ✗ | character_id=1(id=49) |
| `micro_back` | ✓ | ✗ | character_id=1(id=50) |
| `forward` | ✗ | ✗ | **0 件(未 seed)** |
| `back` | ✗ | ✗ | **0 件(未 seed)** |

`grep -nE "SELECT 'forward'|SELECT 'back'" migrations/*.sql` は **0 件ヒット**。DES-004 §2.1 が定義する「前入力」「後ろ入力」単体の system move は、リポジトリ全体を通じて一度も seed されていない。

000010(aki/jamie/guile 向け)は `drive_parry`/`dash_forward`/`dash_back` の 3 code のみを seed していた(jump_*/micro_* は含まない)が、対象キャラは 000017 で characters/moves ごと完全 DELETE 済み(code-facts §10・M14-RESEARCH-01 既知)であり、現行 HEAD には影響しない。

dev DB の characters は `(1,ryu)/(5,ken)/(6,ingrid)/(7,c_viper)/(8,dhalsim)` の 5 件(classic5 は 000014_seed_characters_classic5 でキャラ行のみ追加)。`moves` の `category='system'` 行は **character_id=1(ryu)の 8 行のみ**であり、ken/ingrid/c_viper/dhalsim には system move が **1 件も存在しない**。これら 4 キャラの moves(`viper_elbow`/`high_jump_forward` 等)はどのマイグレーションにも定義がなく(`grep -rl "high_jump_forward\|viper_elbow" migrations/ internal/ web/` は 0 件)、マイグレーション以外の手段(手動 import ツール等)で投入された実データである。

**A-2**: `combo_steps`/`setup_steps` が system move を参照する実件数(code 別、完全一致):

| code | combo_steps | setup_steps |
|------|---:|---:|
| `dash_forward` | 2(combo 115, 116) | 1(setup 13) |
| `dash_back` | 2(combo 115, 116) | 1(setup 13) |
| `drive_parry` | 2(combo 115, 116) | 1(setup 13) |
| `jump_neutral` | **0** | **0** |
| `jump_forward` | **0** | **0** |
| `jump_back` | **0** | **0** |
| `micro_forward` | **0**(集計対象外含め確認) | **0** |
| `micro_back` | **0** | **0** |

combo 115(is_draft=0, **deleted_at='2026-07-04 04:19:55'** = trash)・combo 116(is_draft=0, deleted_at=NULL = published)。combo 116 は recipe_cache の内容(SA1〜SA3・drive_impact・drive_parry・前後投げ・前後ダッシュ・生ラッシュ・波動拳/昇龍拳/竜巻各強度・OD 変種・flags 一式)から、`migrations/000012_seed_combos_durability.up.sql` が投入した**耐久性テスト用の網羅コンボ**と判断できる(通常のユーザー入力コンボではない)。

**A-3**: `high_jump`(リテラル一致)は migrations/internal/web いずれにも **0 件**。一方 dev DB には c_viper(character_id=7)の `high_jump_forward`(id=208)/`high_jump_neutral`(id=209)が **category='unique'** として実在する(A-1 表と同じ「マイグレーション未追跡」データ)。DES-004/SUPP-001 の記述との差は次節参照。

### 契約・正典との差

- DES-004 §2.1 の `forward`/`back` は **完全に未 seed**(spec のみ存在、実装ゼロ)。
- DES-004 §2.3(`docs/design/04-notation-spec.md:129-158`)は `high_jump` を **flag**(状態列「未実装(planned)」)として掲載する。一方 SUPP-001 §3.3.1(`supp-001:317-319`)は「`high_jump` を(flag として)採用しなかった理由」を明記し、SUPP-001 §3.3.2(`supp-001:331-340`)は代わりに **`high_jump` という単一 move code**(方向別ではない)を「共通システム外」のキャラ固有 move として定義する。**DES-004(flag・未実装)と SUPP-001(flag 不採用・move として定義)が真っ向から食い違う**。
- 実 DB は上記いずれとも異なり、`high_jump_forward`/`high_jump_neutral` という**方向別 2 code**を **category='unique'**(SUPP-001 の言う「共通システム外」寄りではあるが、`category='system'` ではない)として持つ。かつ、この 2 行の投入元はマイグレーションに存在しない(retrospective-digest §1-A「実データ実査 ≠ 仕様正典」の実例)。

### M16-04(G-i)/M16-05 スコープへの含意

- 移動 move 化(FB⑦)を「全キャラで使える」状態にするには、**ryu 以外の 4 キャラ(ken/ingrid/c_viper/dhalsim)に system move(最低でも dash_forward/dash_back)を追加 seed する必要がある**。これを怠ると B/C 群で後述する ingrid combo #91 のように移行不能データが残る。
- `forward`/`back`(方向入力単体)は実データ・実装とも皆無のため、**M16-04 で新規に有効化する対象に含めるか、DES-004 の spec 側を削除するかの判断が必要**(現状は「絵に描いた餅」)。
- `high_jump` は DES-004/SUPP-001 間で定義自体が割れており、実データは第三の形(`high_jump_forward`/`high_jump_neutral`・unique category)。M16-04 の taxonomy 明文化でこの矛盾の解消(どちらの design を正とするか、あるいは実データに合わせて再定義するか)を扱うか、対象外として先送りするかの判断が必要。

### 推奨(決定しない)

- 案 A: M16-04 スコープを「既に modifier.type dash が存在する ryu/ingrid の dash_forward/dash_back のみ」に限定し、`forward`/`back`/`high_jump`/ken・c_viper・dhalsim 分の system move 整備は M14-03b(全キャラ seed)以降へ委譲する(影響範囲を絞れる)。
- 案 B: M16-04 で「dash 一本化に必要な最小限」として ingrid 分の dash_forward/dash_back のみ追加 seed し、ken/c_viper/dhalsim(現状 modifier.type dash 実データなし)は据え置く。
- 案 C: `forward`/`back`/`high_jump` の矛盾は本調査と切り離し、CHANGE 起票で設計担当に解消を依頼してから M16-04 着手する。

---

## B. dash 二重表現の実コード / 実データ実態

### 実態

**B-1(実コード全数)**: Go 側の modifiers.type 許容値は `internal/model/combo.go:30-36` の 4 定数のみ:

```go
const (
    ModifierTypeParryDriveRush  = "parry_drive_rush"
    ModifierTypeCancelDriveRush = "cancel_drive_rush"
    ModifierTypeDashForward     = "dash_forward"
    ModifierTypeDashBack        = "dash_back"
)
```

コメントは「SUPP-001 §3.3.3 準拠」と明記。FE 側 `web/src/features/combo/labels.ts:94-103` の `MODIFIER_NON_MOVE_TYPES` も同じ 4 値(`parry_drive_rush`/`cancel_drive_rush`/`dash_forward`/`dash_back`)を定義し、同じく SUPP-001 §3.3.3 を根拠コメントとする。

`grep -rn '"dash"' internal/ web/src/`(バリデーション用ソース全体)は **Go・FE とも 0 件**。migrations(000012 含む)・e2e specs にも `"dash"` 単値は **0 件**。→ **DES-004 §2.3 の単値 `dash` はリポジトリ全体でコード上一切存在しない**。実装は一貫して SUPP-001 §3.3.3(方向別)。

**B-2(dev DB 実データ)**: `combo_steps`(`move_id IS NULL AND json_extract(modifiers,'$.type') IN (...)`)の type 分布(非技ステップ全体):

| type | 件数 |
|------|---:|
| `dash_back` | 17 |
| `dash_forward` | 11 |
| `parry_drive_rush` | 23 |
| `cancel_drive_rush` | 15 |
| `dash`(単値) | **0** |

modifier.type=dash 系ステップを持つ combo は **combo_id 17 件**(`49,71,72,73,74,75,76,77,78,79,80,86,87,88,89,90,91`)。内訳: character_id=1(ryu)が 11 件(`49,71,72,73,74,75,76,77,78,79,80`)、character_id=6(ingrid)が 6 件(`86,87,88,89,90,91`)。ステータス別:

| combo_id | character | is_draft | deleted_at |
|---|---|---|---|
| 49 | ryu | 1 | 2026-06-28 |
| 71,72,73 | ryu | 0 | 2026-06-28(trash) |
| 74 | ryu | 1 | 2026-06-28 |
| 75,76,77 | ryu | 0 | 2026-06-28(trash) |
| **78,79,80** | ryu | 0 | **NULL(published)** |
| 86,88,89 | ingrid | 1 | (draft, 86/88/89 も deleted_at あり) |
| 87,90 | ingrid | 0 | 2026-06-28(trash) |
| **91** | ingrid | 0 | **NULL(published)** |

→ **published(FR301 dup 判定の母集団)は 78/79/80(ryu)・91(ingrid)の 4 件のみ**。残り 13 件は draft か trash であり、現行の VAL-C02(dup 判定)には元々関与しない。

`setup_steps` は `(id=73, setup_id=13, step_order=23, type=dash_forward)` の **1 件のみ**(`dash_back` 単値は 0 件)。

**B-3(system move dash 参照との対比)**: A-2 のとおり system move 経由の dash 参照は combo 2 件(115=trash, 116=published)・setup 1 件(setup 13)。**setup 13 は system move dash(step_order 11=dash_forward, 12=dash_back)と modifier.type dash(step_order 23=dash_forward)が同一レコード内に混在**する実例(表現の混在は combo 間だけでなく単一レコード内でも発生し得ることの実証)。

数量対比: modifier.type dash(17 combo)に対し system move dash(2 combo)。**現行データは旧表現(modifier.type)が圧倒的多数**。

**B-4(新規入力経路の実態)**: `RecipeBuilder.tsx:70-89` と `SetupRecipeEditor.tsx:95-106` はいずれも `handleAdd` 内で `DASH_MOVE_CODES.has(nonMoveType)`(`labels.ts:108` = `{dash_forward, dash_back}`)を判定し、真の場合は `moves.find(m => m.code === nonMoveType)` で **system move を解決してから move ベースのステップとして追加**する(モディファイアは flags/notes のみ残し type は破棄)。コメントに「M15-03 追補・dash 近手当て」と明記。`VirtualController/useControllerInput.ts:19-26,52-64` の `SYSTEM_BUTTON_TO_MOVE_CODE` も `dash_forward`/`dash_back` を move code として解決する。→ **3 つの新規追加経路(RecipeBuilder / SetupRecipeEditor / VirtualController)はすべて system move へ誘導済み**。

ただし `move` が見つからない場合(=当該キャラに system move dash が無い場合)は `console.warn` を出して **無言で追加をスキップ**する(`RecipeBuilder.tsx:74-77`、`SetupRecipeEditor.tsx:100-102`、`useControllerInput.ts:56-60`)。ユーザー向けエラー表示はない。ken/ingrid/c_viper/dhalsim は system move dash が 0 件のため、**これら 4 キャラでは現状 dash 入力ボタン/プルダウンを操作しても何も追加されない**(サイレント失敗)。

一方 `ModifiersEditor.tsx:111-130`(既存の非技ステップの type を編集するダイアログ、`isNonMove = step.moveId == null` の場合のみ表示)は `MODIFIER_NON_MOVE_TYPES` を**フィルタなしで全 4 値**(dash_forward/dash_back 含む)RadioGroup 選択肢として表示する。**dash を modifier.type として(再)設定できる唯一残存する経路**。

RecipeBuilder/SetupRecipeEditor の「区分で絞り込み」プルダウン(`RecipeBuilder.tsx:200-249`)は、`filterCategory==="all"`(初期値)の場合に **2 つの optgroup が同時表示**される: (1) `MOVE_CATEGORY_LABEL_JA["system"]`="システム"(実 moves、category=system。dash_forward/dash_back を含む)、(2) `NON_MOVE_FILTER`(値`__nonmove__`)ラベル="共通システム（移動・その他）"(`MODIFIER_NON_MOVE_TYPES`。値は `nonmove:dash_forward` 等)。**「前ダッシュ」「後ろダッシュ」が同一プルダウン内に 2 回、異なる optgroup・異なる内部値(moveId 文字列 vs `"nonmove:dash_forward"`)で表示**される(選択後は B-4 前半の特例処理により同じ system move 追加結果になるため実害は今のところ無いが、UI 上の taxonomy 未整理を直接示す)。

### 契約・正典との差

- DES-004 §2.3 の単値 `dash` は実装のどこにも存在しない(0 件)。**実装は例外なく SUPP-001 §3.3.3(方向別)**。DES-004 は自己の §2.1(方向別 system move)と §2.3(単値 modifier type)で表現が割れている。
- M15-03(CHANGE-057)の「近手当て」は 3 つの新規追加経路をカバーしているが、**既存ステップ編集経路(ModifiersEditor)は未着手**であり、dash の modifier.type 再混入経路が残る。
- UI の「システム」optgroup と「共通システム(移動・その他)」optgroup の並存は、指示書が触れていた DES-005 §5.7 の呼称と実装ラベルが一致する一方、**カテゴリ名の類似(「システム」/「共通システム」)が taxonomy 上の役割の違い(move vs modifier.type)を覆い隠している**。

### M16-04(G-i)スコープへの含意

- 是正が要る実コード箇所: `ModifiersEditor.tsx` の `MODIFIER_NON_MOVE_TYPES` から dash_forward/dash_back を外す(または system move への誘導に統一する)、`labels.ts` の `MODIFIER_NON_MOVE_TYPES` 自体から dash 系を削除、RecipeBuilder/SetupRecipeEditor のプルダウンから「共通システム(移動・その他)」optgroup 内の dash エントリを除去、の 3 点が具体的な是正候補になる。
- サイレント失敗(console.warn のみ)は、system move 未 seed キャラ(ken/c_viper/dhalsim、および seed 前の ingrid)で **dash 入力操作自体が事実上使えない**ことを意味し、A 群の seed 拡充と一体で扱う必要がある。

### 推奨(決定しない)

- 案 A: M16-04 で `ModifiersEditor`/`labels.ts` から dash_forward/dash_back の modifier.type 選択肢を完全撤去し、system move 一本に統一(taxonomy 明文化と一致)。
- 案 B: 撤去は M16-04 では見送り、既存データ移行後の後続マイルストーンで対応(混在再発リスクは残るが影響範囲を限定)。

---

## C. レシピ等価 / FR301 dup の実態と dash 移行の衝突実測(核心)

### 実態

**C-1(recipe_hash の実体)**: `combos` テーブルに `recipe_hash` 列は存在しない(migrations 全 18 本に無し)。実体は `internal/service/combo/duplicate_keys.go:45` の関数 `CalcRecipeHash(steps []model.ComboStep) string` で、**リクエスト時に都度計算**される(code-facts は関数を抽出対象にしないため §8/§9 に非表出。指示書の「要 RESEARCH 確定」は本関数の発見で解消)。

アルゴリズム(実コード読解): (1) steps を step_order 昇順ソート、(2) 各 step を `"<move_id または \"null\">:<canonicalModifiersJSON(modifiers)>"` に変換、(3) `"\n"` 連結、(4) SHA-256 hex。`canonicalModifiersJSON`(`duplicate_keys.go:81-101`)は modifiers が nil なら `"null"`、非 nil なら `Flags`(ソート済み)/`Type`/`Notes` を持つ **Modifiers 構造体全体を `json.Marshal`**(`omitempty`、Go 構造体のフィールド順 flags→type→notes)。→ **modifiers.Type・Flags(順序非依存)・Notes(自由記述含む)がすべてハッシュ対象**。

呼び出し経路: `internal/service/combo/service.go:708-744`(`CheckDuplicate`、POST /api/combos/check-duplicate)および `internal/service/validation/combo.go:153-184`(`validateC02Duplicate`、本登録の Create/UpdateWithKeyChange 経由)。両者とも `ComboRepo.FindActivePublishedDuplicates`(`service.go:795-826`)→ `repo.FindActiveByDuplicateKey`(`internal/repository/combo/repository.go:772-826`、SQL 条件 `character_id=? AND is_draft=0 AND deleted_at IS NULL` + starter_move_id/position/opponent_stance/hit_type/opponent_size の NULL 対応等価)で候補 combo を取得し、`FindStepsForCombos` で steps を一括取得後、**候補ごとに `CalcRecipeHash` を都度計算**して比較する。**recipe_hash は保存されないため、combo_steps の実データ(move_id・modifiers)を書き換えれば次回計算時のハッシュも自動的に追従する**(=移行後のハッシュ再計算に別途のマイグレーション作業は不要、ただし C-4 の recipe_cache は別物)。

**C-2(dup 判定対象フィールド)**: `modifiers.type` は上記のとおり **hash 対象に含まれる**(dash-as-modifier と dash-as-move は現状ハッシュが異なる=別レシピ扱い)。`modifiers.flags`・`modifiers.notes` も同様に対象。DuplicateKey 側(SQL 一致条件)は character_id/starter_move_id/position/opponent_stance/hit_type/opponent_size の 6 項目のみで、ゲージ・起き攻めは含まない(code-facts 記載どおり)。

**C-3(dash 移行を仮定した衝突実測)**: dev DB から published(is_draft=0, deleted_at IS NULL)combos 30 件・全 steps・moves 一覧を read-only 抽出し、以下を read-only スクリプト(Python、Go の `CalcRecipeHash` を文献どおり再現。実データの書き換えは一切なし)で照合した。

移行シミュレーション規則: 非技ステップ(`move_id IS NULL AND modifiers.type IN (dash_forward, dash_back)`)を、当該 combo の character_id に紐づく同 code の system move へ置換(`move_id`=該当 move の id、`modifiers` は flags/notes のみ残し type は破棄。RecipeBuilder の実装〔B-4〕と同じ規則)。

結果:
- 移行によってハッシュが変化する published combo は **78(ryu)・79(ryu)・80(ryu)・91(ingrid)** の 4 件。
- combo 91(ingrid)は **移行不能**: ingrid 用の system move `dash_forward`/`dash_back` が 0 件(A-1)のため置換先が存在しない。
- published 30 件を DuplicateKey(character_id, starter_move_id, position, opponent_stance, hit_type, opponent_size)でグルーピングした結果、2 件以上のグループは 6 個: `(5,398,corner_self,crouching,normal,medium)→[37,48]`、`(5,398,corner_self,any,normal,medium)→[40,45,46,50]`、`(5,398,corner_self,NULL,normal,medium)→[41,53]`、`(7,187,mid_screen,standing,normal,medium)→[57,58]`、`(1,1,mid_screen,standing,normal,NULL)→[78,79,80]`、`(6,327,mid_screen,standing,normal,medium)→[81,82,83,84]`。
- **移行前ハッシュのグループ内衝突: 0 件**(サニティチェック。既存データに VAL-C02 をすり抜けた重複が無いことの確認)。
- **移行後(dash migrated)ハッシュのグループ内衝突: 0 件**。`(1,1,mid_screen,standing,normal,NULL)→[78,79,80]` グループは dash 表現以外のステップ構成が combo 間で異なるため、dash 統一後も別レシピのまま(衝突しない)。
- **衝突ゼロ件・combo_id ペアなし**。

方法論注記: ハッシュは Go の `CalcRecipeHash` アルゴリズム(ソート・flags 正規化・omitempty 構造体 JSON・SHA-256)を文献に忠実に Python で再現したものであり、production の SHA-256 バイト列との一致自体は検証していない(内部 internal パッケージを read-only スコープ外の一時ファイル追加なしに実行できないため)。ただし本調査で必要なのは「等価類の一致判定」のみであり、上記再現で十分に判定可能。

**母集団の限定性(開発者確認事項#2 に対応)**: 母集団は dev DB(ryu 中心・少量・開発者本人データ)であり、published 30 件のうち dash 移行の影響を受けるのは 4 件のみ(うち 1 件は移行不能)。**「衝突ゼロ」は現行の小規模・偏ったデータでの結果であり、M14-03b(全キャラ seed)後にデータ量・組み合わせが増えれば結果は変わり得る**。draft/trash の 13 件(全 17 件中)は現行 VAL-C02 の対象外だが、移行作業が combo_steps 全体に及ぶ場合はこれらも書き換え対象になり得る(published 化・復元時に初めて dup 判定へ関与する)。

**C-4(recipe_cache への影響)**: modifier.type dash の表示テキストは `internal/service/notation/resolver.go:13-18` の**ハードコード辞書 `nonMoveTypeText`**(`model.ModifierType*` 定数をキーに「前ダッシュ」「後ろダッシュ」等を返す)で解決され、`resolveNonMoveStep`(`resolver.go:65-73`)は **プリセットを一切参照しない**(全 5 プリセットで同一表示)。

system move dash は `resolveMoveStep`(`resolver.go:75-125`)で (1) 当該プリセットの alias → (2) base_preset の alias → (3) **`official_ja_move` プリセットの alias へフォールバック** → (4) `move.code` 直出し、の順で解決する。`preset_aliases` 実データ(`SELECT ... WHERE move.code IN (dash_forward,dash_back,jump_*,micro_*,drive_parry)`)は **`official_ja_move`(preset_id=1)にのみ 8 行存在**し(`dash_forward`→「前ダッシュ」、`dash_back`→「後ろダッシュ」等)、他 4 プリセット(official_ja_command/numeric_ja/numeric_en/srk)には **0 行**。→ ryu の migrated dash ステップは、どのプリセットで表示してもステップ 3 の fallback により「前ダッシュ」/「後ろダッシュ」が表示され(直接 alias が無くても official_ja_move 経由で救済)、**表示崩れは発生しない**。

ただし `preset_aliases` は `(preset_id, move_id)` の**具体的な move 行 ID** をキーとする。A 群の含意どおり ingrid 等へ新規に system move dash を seed する場合、**新しい move_id には既存の alias(ryu の move_id=44/45 向け)が流用できず**、alias 行を新規に追加しない限り `resolveMoveStep` はステップ 4(`move.code` 直出し=`"dash_forward"`のような生 code 表示)にフォールバックする。これは指示書想定どおり **M14-03b の seed 契約(全キャラ seed)と alias 整備を連動させる必要がある**ことの実コード上の裏付け。

combo 91(ingrid)の recipe_cache サンプルは、現状「前ダッシュ」「後ろダッシュ」を(ハードコード辞書経由で)正しく表示している。表示結果だけを見ると移行前後で差が無いように見えるが、解決経路(ハードコード vs プリセット依存)が変わるため、**alias 未整備のまま移行すると表示が壊れるリスクがある**(ただし ingrid は C-3 のとおりそもそも move が存在せず移行不能のため、alias 整備は move seed とセットで必要)。

### 契約・正典との差

- SUPP-001 §3.3.0 の recipe_hash 言及(「JSON Marshal の決定論性(recipe_hash 計算で重要)」)は実コードと一致(型付き struct・flags ソートによる決定論性は実装済み)。ただし SUPP-001 は recipe_hash を「計算対象フィールド」として明記しておらず、**modifiers.notes(自由記述)までハッシュに含まれる**点は設計書に明記が無い(実装のみの事実)。
- DuplicateCheckFields(`duplicate_keys.go:24-32`)のコメントは「将来 modifiers を比較から外す変更も可能」としており、現状は比較に含める実装だが将来変更を前提としたコメントが付いている。

### M16-04(G-i)/M16-05 スコープへの含意

- 現行 dev DB では dash 移行による dup 衝突は 0 件だが、**ingrid combo #91 の移行不能というブロッカーが実在する**。M16-04 は「衝突処理」だけでなく「移行対象が無い(system move 未整備)ため移行不能なデータの扱い」も同時にスコープへ含める必要がある。
- dup 衝突検出→提示の実装が要るかどうかは、母集団拡大後(M14-03b 後)の再測定に依存する。現行データだけでは「不要」と断定できない。
- recipe_cache は `RecomputeComboCache`(arch §9.2)で combo 作成/更新/復元時に eager 再生成されるため、**dash 移行(combo_steps 書き換え)後に明示的な再生成トリガが無いと recipe_cache が旧表記のまま固定化される**(digest §4 の既知パターン)。alias 整備を move seed と同時に行わないと、再生成時に前述のフォールバック(4)=生 code 表示に陥るキャラが出る。

### 推奨(決定しない)

- 案 A: M16-04 は「衝突ゼロ」を根拠に検出ロジック無しで一括移行し、M14-03b 後に再度衝突チェックを実施する(小規模 dev DB での実測を前提とした軽量方針)。
- 案 B: 衝突ゼロでも将来の全キャラ seed を見越して、移行スクリプトに衝突検出(検出時は移行スキップ+一覧出力)を組み込む(保守的だが実装コスト増)。
- いずれにせよ ingrid combo #91 のような「移行先 move が無い」ケースの扱い(seed 追加を待つ/modifier.type のまま据え置く/エラーとして手動対応)は M16-04 で明示的に決定する必要がある。

---

## D. 入力 UI の移動 / dash 露出実態

### 実態

**D-1**: dash の新規追加は 3 経路(RecipeBuilder 統合プルダウン `nonmove:dash_forward`/`nonmove:dash_back`、SetupRecipeEditor 同様、VirtualController の SystemRow「前方ステップ」「後方ステップ」ボタン)いずれも system move への解決を経る(B-4 詳述)。RecipeBuilder/SetupRecipeEditor の「区分で絞り込み」プルダウンは `filterCategory==="all"`(初期値)時に「システム」(実 moves)と「共通システム(移動・その他)」(modifier.type)の 2 optgroup を同時表示し、dash の表示ラベルが重複する(B-4 詳述、taxonomy 未整理の直接証拠)。

`ModifiersEditor` は既存の非技ステップ(`step.moveId==null`)の type を編集する唯一の画面で、`MODIFIER_NON_MOVE_TYPES`(dash_forward/dash_back 含む全 4 値)を無条件表示する。

**D-2**: `SystemRow.tsx` の専用ボタンは `drive_impact`/`drive_parry`/`throw_forward`/`throw_back`/`dash_forward`/`dash_back`/`parry_drive_rush` の 7 種のみで、**jump_neutral/jump_forward/jump_back 用のボタンは無い**。これらは `groupMovesByCategory`(`RecipeBuilder.tsx:343-351`、category によるグルーピングのみでフィルタなし)経由の「全技プルダウン」の「システム」optgroup(`MOVE_CATEGORY_LABEL_JA.system`="システム"、`MOVE_CATEGORY_ORDER` に含まれる)からのみ選択可能。

実データ(A-2)では jump_neutral/jump_forward/jump_back の move 参照は combo_steps/setup_steps とも **0 件**。一方 SUPP-001 §3.3.2 のレシピ表記ルール(ジャンプ move は省略し空中技へ `{neutral_jump}`/`{forward_jump}` flag を付与)は、combo 116 の recipe_cache に実例がある(`OD昇龍拳 {…} {neutral_jump} {forward_jump} (ああああ)`)。`labels.ts:90-91` の `MODIFIER_FLAGS` に `neutral_jump`="垂直ジャンプ中"・`forward_jump`="前ジャンプ中" が定義済みで、このルールは flag 経由で実際に使われている。

### 契約・正典との差

- DES-005 §5.7 の「共通システム(移動・その他)」という呼称は、実装上は modifier.type(非技ステップ)専用の optgroup ラベルであり、**category=system の「移動」move(dash/jump/micro)そのものを指す呼称ではない**(命名が実体とややズレている)。
- ジャンプ move 省略ルール(SUPP-001 §3.3.2)は実データで守られている(0 件使用+flag 使用実例あり)一方、**move としての選択自体は技術的に可能**(UI 側で禁止されていない)。ルール遵守は運用(ユーザー入力習慣)に依存しており、UI 側に強制はない。

### M16-04(G-i)スコープへの含意

- taxonomy 明文化(④)にあたり、「共通システム(移動・その他)」optgroup の中身(modifier.type の非技種別)と「システム」optgroup の中身(category=system の move)を明確に分離・再命名するか、あるいは modifier.type 側の dash を撤去して 1 本化するかが具体的な UI 修正候補になる。
- jump move の UI 露出は現状「技術的に可能だが実データ上使われていない」ため、M16-04 で明示的にレシピ登録から除外する(flag 専用にする)か、現状維持するかの判断が要る。

### 推奨(決定しない)

- 案 A: 「共通システム(移動・その他)」optgroup から dash を削除し、`parry_drive_rush`/`cancel_drive_rush` のみの「非技ステップ」ラベルへ改称。
- 案 B: jump 系 move はプルダウンから隠し、flag 経由の入力のみをサポート対象として明文化(SUPP-001 のルールを UI でも強制)。

---

## E. ④' target_combo の分類実態(軽量)

### 実態

`SELECT * FROM moves WHERE category='target_combo'` は **0 件**。`SELECT * FROM moves WHERE code LIKE 'tc\_%'` も **0 件**。全 18 マイグレーションのうち `target_combo`/`tc_` を扱う箇所は `000001_init_schema.up.sql:43` の列コメント(`category` 列の許容値列挙の一部としての記載)のみで、実 INSERT は存在しない。

Go(`internal/model/move.go:11` `MoveCategoryTargetCombo = "target_combo"`)・FE(`web/src/features/moves/types.ts:19,103,117`)には enum 値・ラベル・表示順が定義済みで、コード上は扱える状態にある。

### 契約・正典との差

CHANGE-026 の方針(「段数付き行は所属セグメントの category で取込、`tc_<番号>` は FR703 手動分類用に温存」)どおり、**現状は「温存」段階のまま一度も使用されていない**。契約と実態に矛盾はない(未使用は方針どおりの状態)。

### M16-05 スコープへの含意

移行対象の実データが 0 件のため、M16-05 は既存データの移行作業を伴わない。今後の取込データに対する分類ルールの明文化・運用整備が中心になる見込み。

### 推奨(決定しない)

M16-05 は「今後の取込に備えた分類基準の明文化」を主眼とし、既存データへの遡及移行は不要という前提で進めてよいと考えられる(最終判断は開発者)。

---

## 想定外の発見(§0.3 許可の事実指摘)

1. **DES-004 内部の自己矛盾(dash)**: DES-004 §2.1(`04-notation-spec.md:99-100`)は system move として方向別 `dash_forward`/`dash_back` を定義する一方、同一文書の §2.3(`04-notation-spec.md:158`)は modifiers.type の非技種別として単値 `dash`(「ダッシュ(前後)」)を定義する。**同じ設計書内で dash の表現が 2 通りに割れている**。
2. **`high_jump` の三者不一致**: DES-004 §2.3 は `high_jump` を flag(状態「未実装(planned)」)として掲載。SUPP-001 §3.3.1 は「high_jump を flag として採用しなかった理由」を明記(不採用)。SUPP-001 §3.3.2 は代わりに `high_jump` という**単一 move code**(方向別ではない、「共通システム外」)を定義。**3 箇所の記述がすべて異なる**。実 DB は c_viper の `high_jump_forward`/`high_jump_neutral`(方向別 2 code、category=unique)であり、上記いずれの記述とも一致しない。
3. **classic5 キャラの moves のマイグレーション未追跡**: ken/ingrid/c_viper/dhalsim の moves(`high_jump_forward`/`viper_elbow` 等含む)は `migrations/*.sql` のどこにも定義が無く、`000014_seed_characters_classic5` はキャラ行のみを追加する。実データはマイグレーション以外の経路(手動 import ツール等、M14-RESEARCH-01 で既知の「取込由来」)で投入されている。
4. **setup 13 における表現混在の実例**: setup_id=13 は同一レコード内に system move dash(step_order 11=dash_forward, 12=dash_back)と modifier.type dash(step_order 23=dash_forward)を**両方**持つ。二重表現の混在は combo 間だけでなく単一レコード内でも発生し得ることの直接的な実データ証拠。
5. **DES-004 §2.1 の `forward`/`back` は実装ゼロ**: 移動 system move のうち `dash_forward`/`dash_back`/`jump_*`/`micro_*` は seed・データとも実在する一方、`forward`/`back`(方向入力単体)は seed・実データとも完全に 0 件(spec のみ存在)。

---

## M16-04/05 スコープ確定のための要決定事項

1. **dash canonical 化に伴う実コード是正点**: `ModifiersEditor.tsx`/`labels.ts` の `MODIFIER_NON_MOVE_TYPES` から dash_forward/dash_back を撤去するか(既存ステップ編集時の再混入経路を塞ぐか)。RecipeBuilder/SetupRecipeEditor の統合プルダウンで「システム」と「共通システム(移動・その他)」の両方に dash が重複表示される点を整理するか。
2. **dup 衝突の処理方針(検出→提示の対象件数)**: 現行 dev DB(published 30 件、影響を受けるのは 4 件・うち 1 件〔ingrid #91〕は移行不能)では衝突 0 件。この結果を根拠に検出ロジック無しで一括移行するか、M14-03b 全キャラ seed 後の再測定を必須の前提条件とするか。draft/trash 13 件(現状 VAL-C02 対象外)を移行作業の対象に含めるか。
3. **方向不定 `dash` 行の手当て**: 実データ上、単値 `dash` は 0 件のため方向不定行の手当ては不要と考えられる。ただし DES-004 §2.3 自体(単値 `dash` の記述)を SUPP-001 §3.3.3(方向別)に合わせて訂正するか(CHANGE 起票要否)。
4. **移動 move の seed・UI enable 範囲**: 現状 system move は ryu のみ(8 code)。ingrid の modifier.type dash(published #91 含む)を移行するには、最低限 ingrid 分の `dash_forward`/`dash_back` seed が必須。ken/c_viper/dhalsim(現状 modifier.type dash の実データなし)も同時に整備するか、M14-03b(全キャラ seed)へ委譲するか。`forward`/`back`(実装ゼロ)・`high_jump`(定義三者不一致)を M16-04 のスコープに含めるか除外するか。
5. **recipe_cache 再生成と alias 整備(M14-03b seed 契約連動)**: 新規に system move を追加するキャラについて、`preset_aliases` は `(preset_id, move_id)` キーのため既存 alias が流用できず、新規 alias 行を追加しないと `official_ja_move` 以外は勿論 `official_ja_move` 自体へのフォールバックも効かず生 code 表示になる。move seed と alias seed を同一マイグレーションで対にするか。移行後の `RecomputeComboCache` 実行(全件再計算)を M16-04 に含めるか。
6. **target_combo 正典化の対象行**: 現行データに移行対象の実データは 0 件。M16-05 は既存データ移行を伴わず、今後の分類基準明文化が中心という理解でよいか。

---

*以上、M16-RESEARCH-01 調査報告。read-only 厳守(実装・マイグレーション・seed/データ・コード変更ゼロ。dev DB は SELECT のみ)。本報告は M16-04(④ 移動 move 化・④'' dash 一本化・taxonomy)・M16-05(④' target_combo)修正指示書の Plan Mode 入力として作成した。*
