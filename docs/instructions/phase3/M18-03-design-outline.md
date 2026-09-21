# M18-03 設計方針書（骨子）: materialize ＋ 確定反撃マイリスト（使う）

| 項目 | 内容 |
|------|------|
| 文書ID | M18-03-DESIGN（骨子・実装指示書の前段） |
| バージョン | **v0.1.0**（2026-07-26・M18-RESEARCH-02 report を一次受けし、設計の芯を確定） |
| 作成者 | M18 指示書担当（playbook §15.6・委任 v1.2.0 §6＝**設計から委任**） |
| 上位文書 | `M18-overview.md` **v0.1.9** §2.1 f〜k・§3 |
| 前提（実査済） | **M18-RESEARCH-02-report**（2026-07-26・dev DB migration version=41）／DES-002 **v1.36.0** §4.2／DES-003 **v1.34.0** §3.4・§3.15〜3.18／DES-004 **v1.15.0** §2.5／DES-005 **v2.50.0** §5.6・§5.20／DES-006 **v1.21.0** §2.1・§2.3・§2.7／code-facts（生成 2026-07-26・commit `a2381a4`） |
| 採番 | **CHANGE 番号・マイグレ連番とも本書では採番しない**（中央払い出し・playbook §4.15／§15.7） |
| 配置（完成品） | `docs/instructions/phase3/M18-03-design-outline.md` |

## 更新履歴

| 版 | 更新日 | 更新内容 |
|----|--------|----------|
| 0.1.0 | 2026-07-26 | 初版。RESEARCH-02 の一次受け（§0.2）と、materialize の API 経路・ダメージ規則・FR301 の適用面・マイリストの母集合・隠したもの管理・内部 2 分割を確定。 |

---

> **【errata 2026-07-30・本書の内容は一部が後継文書に置き換わっています】**
> 本書 v0.1.0 は **M18-03 が 2 分割（03a／03b）だった時期**の骨子です。その後 M18-03 は **3 分割（03a／03b／03c）へ再構成**され、本書 §5〜§6（materialize・FR301・案C・export）と §7（内部分割）は次の後継文書に置き換わりました。**設計の現行正本は後継文書です。**
>
> | 範囲 | 現行正本 |
> |---|---|
> | 03a（マイリスト・隠したもの管理） | `M18-03a-punish-mylist.md` **v1.0.2**（as-built 確定版） |
> | 03b（materialize・FR301・編集引き継ぎ） | `M18-03b-design-outline.md` **v0.2.0** ／ `M18-03b-materialize.md` **v1.0.2** |
> | 03c（案C・導線整備・ノーマル版の畳み込み・ダメージ訂正） | `M18-03c-design-outline.md` **v0.2.0** ／ `M18-03c-drainage.md` **v1.0.2** |
> | materialize のダメージ加算の適用範囲 | `M18-close-report.md` **v1.0.1** §2.3（①〜④の分類・SA／CA の例外） |
>
> **本書に残る価値は §0.2（RESEARCH-02 の一次受け＝設計に効く事実 8 点）と §1〜§4（マイリスト・隠したもの管理・既登録表示の設計根拠）**です。§5 以降は歴史記録として読んでください。
>
> **この errata を置く理由**：M18-03b の製造が「骨子（§8 空欄・案C を含む）ではなく製造指示書を実装ソースに確定した」と報告しています（設計伝達レポート §2-1）。**scope の食い違った骨子が disk に残っていたことが原因**で、M18-01 教訓 **L-5** の再演でした。次に読む人が同じ迷いをしないよう明示します。

## 0. 本書の位置づけと RESEARCH-02 の一次受け

### 0.1 位置づけ

本書は M18-03 の**設計骨子**であり、実装指示書（`M18-03a-*.md`／`M18-03b-*.md`）の前段。M18-02 で `M18-02-design-outline.md` を挟んだのと同じ運用。**新スキーマ（新表・新列）は追加しない**見通しだが、**既存列 `combos.materialized_from_combo_id` を初めて使う**ため、model／INSERT／DTO への配線が発生する（§5.3）。

### 0.2 RESEARCH-02 の一次受け結果 ＝ 設計に効く事実 8 点

**受理**。26 項目すべてに実値の回答があり、read-only 逸脱なし。P-1〜P-10 の裏取りも実施済み（P-8 のみ「指示書スコープ外」で未実施＝**本設計には不要**なので追加調査は起票しない）。設計を左右する事実を抜き出す。

| # | 事実 | 出所 | 設計への効き方 |
|---|------|------|----------------|
| F-1 | **dup 判定は 2 段**＝(1) 6 項 SQL（nil は `col IS NULL`＝**nil 同士は一致**）で候補を絞り、(2) `recipe_hash` の**文字列完全一致**で確定 | A-2 | §6.1 の判定式をこの 2 段でそのまま組む |
| F-2 | `recipe_hash` は **DB 列ではなくサービス層の SHA-256 計算値**。`Modifiers.Flags` は `sort.Strings` で正規化＝**Flags 内部の順序は無視** | A-3 | 生成物の steps を基底から**そのまま複製**すれば hash は一致する。加工しないことが前提 |
| F-3 | dup 判定の WHERE は **`is_draft = 0` と `deleted_at IS NULL` が固定** | A-2／B-6 | **仮登録・ゴミ箱内の既存 PC 版は検出されない**＝二重生成が起こりうる。§6.2 で明示しテストに入れる |
| F-4 | `materialized_from_combo_id` は **マイグレ 000038 とそのテスト以外、全レイヤで参照 0 件**。`model.Combo` にフィールドなし・INSERT 22 列にも無し・`ComboResponse` に露出なし | B-1／B-2／B-3 | M18-03b で model／INSERT／DTO への配線が必要。**既存 Create 経路の INSERT 文が変わる**＝回帰ゲート必須 |
| F-5 | `combos.damage` は**常に手入力値をそのまま保存**。`moves.damage` から自動計算・コピーする既存コードは**無い** | B-4 | materialize が**本アプリ初のダメージ自動計算経路**になる。丸め規則を決め切る必要（§5.2・確認事項1） |
| F-6 | steps 複製の専用ヘルパーは**無い**。ただし `CreateInput.Steps` と `model.Combo.Steps` は**同一型**（`[]model.ComboStep`）。PUT は「クライアントがフルレシピを再送」方式 | B-5 | サーバ内で基底の `Steps` をそのまま渡せる。**クライアントに steps を往復させない**設計が取れる（§5.3） |
| F-7 | **`combo_punish_curations` は repository／service／api／frontend の全レイヤで参照 0 件**（未使用確定）。`combo_punish_prunings` は DELETE の BE 経路は稼働、**FE に解除フックが無い** | D-6 | M18-03a で **curation は BE から新設**、pruning は **FE 接続のみ**。工数が非対称 |
| F-8 | メイン API 経路（`ValidateComboForCreate`）に **`hit_type` の値検証が存在しない**。whitelist の実使用は CSV import 限定。`model.HitType*` 定数は**参照 0 件**で、同じ 4 値が 3 箇所以上にリテラル散在 | A-6 | 手動入力導線（§6.3）と DES-006 §2.7 の記述の扱いを決める（確認事項5） |

**あわせて確定した 2 件**（別途中央へ連絡済／連絡予定）：

- **案C の成立条件を充足**。`jump_neutral` / `jump_forward` / `jump_back` の `total` は **12 キャラ全数で一致・不一致 0 件**（C-3）。増分は **2 件**（`juri`／`ken` の `neutral_jumping_heavy_kick`）で、**強K 以外の `neutral_jumping_*` は 0 件**（C-2(c)(d)）。
- **unique 系空中特殊技は 7 件**（C-5）。M18-overview は v0.1.9 で是正済。DES-005 §5.20 は中央へ連絡済。

---

## 1. スコープと画面構成

### 1.1 スコープ（M18-overview v0.1.9 §2.1 f〜k ＋ 相乗り 3 件）

| 区分 | 項目 | サブ |
|------|------|------|
| overview g | 確定反撃マイリスト（使う・2 階層ツリー・curation で非採用を隠す・note） | 03a |
| overview h | materialize 生成規則（ダメージ・hit_type・出自） | 03b |
| overview i | FR301 重複防止 | 03b |
| overview j | 手動入力導線（ジャストパリィ始動・NULL／projectile 技の手動確反登録） | 03b |
| overview k | materialize コンボの export 整合（E-17・DoD に開発者実出力目視） | 03b |
| 相乗り1 | pruning 解除・再表示 UI（「隠したもの管理」へ集約） | 03a |
| 相乗り2 | 自動判定できない相手技への既登録確定反撃の表示 | 03a |
| 相乗り3 | 案C（`neutral_jumping_heavy_kick` を候補に含める）＝抽出述語の緩和 | 03b |

### 1.2 画面構成（E-20＝上から下へ 1 本の動線）

```
[探す] 画面20 確定反撃サーチ  /punish/search   … M18-02 実装済（03a/03b で部分改修）
   相手技 → 始動技 → コンボ（3 階層）
        ├─ 「確定反撃に採用」        → combo_punishes            （実装済）
        ├─ 「パニッシュカウンター版を作る」→ materialize          （03b で新設）
        └─ 「新規登録」              → /combos/new（手動入力）   （実装済・03b で拡張）

[使う] 画面21 確定反撃マイリスト /punish/list    … 03a で新設
   相手技 → コンボ（2 階層。始動技はコンボ行の属性表示）
        ├─ 「使わないので隠す」      → combo_punish_curations    （03a で BE から新設）
        └─ タブ「隠したもの管理」    → pruning / curation の解除 （03a）
```

**動線の芯**：`combo_punishes` が「探す」と「使う」を繋ぐ唯一の接点である。探す画面は**検証の作業場**（正＝`combo_punish_starters`）、使う画面は**採用結果の閲覧**（正＝`combo_punishes`）という役割分担を崩さない（DES-003 §3.18 の明記に従う）。

---

## 2. 確定反撃マイリスト（画面21）の設計 ［03a］

### 2.1 母集合と階層

- **母集合＝`combo_punishes`**（DES-003 §3.18「採用確定反撃画面（M18-03・使う）は `combo_punishes` だけを引く」）。**`materialized_from_combo_id` では絞らない**。前回整理したとおり、materialize 生成物と「確定反撃に採用したコンボ」は別概念であり、M18-02 で採用済みの**通常コンボも当然マイリストに出る**。
- **2 階層**：第1階層＝相手技（`opponent_move_id` → `moves`）／第2階層＝コンボ（`combo_id` → `combos`）。
- **始動技は第2階層の属性表示**（`combos.starter_move_id`）にとどめ、階層を切らない（探す画面の 3 階層と意図的に非対称。使う場面では「どの相手技にどのコンボを出すか」だけが要る）。

### 2.2 ガード／ジャストパリィの別

`combo_punishes` は `guard_type` を持たず、**紐づくコンボの `hit_type` で判別**する（DES-003 §3.15）。判別値は `punish_counter`（ガード始動）と `just_parry_punish_counter`（ジャストパリィ始動）。

- **暫定案＝探す画面と同じタブ切替**（既定＝ジャストパリィ）。理由は E-20 の一貫性で、同じドメイン概念に 2 つの UI イディオムを作らない。
- ただし使う場面では「このマッチアップの反撃を全部見たい」需要が想定される。**確認事項4** で開発者に諮る。

### 2.3 表示項目（第2階層＝コンボ行）

コンボ名称・始動技・ダメージ・手数・`hit_type` バッジ・**生成元バッジ**（`materialized_from_combo_id` が非 NULL のとき「PC版（生成）」）・note（`combo_punishes.note`＝この紐づけ固有の採用理由）。

> **生成元バッジのために `ComboResponse` へ `materializedFromComboId` を露出する**（F-4）。露出は 03b の配線に依存するため、**03a では列を読まず、03b 完了後にバッジを足す**か、03a で配線ごと先に入れるかを §7.2 で決める。

### 2.4 やらないこと

- ツリーの並べ替え・フィルタの作り込み（探す画面と同じ最小構成に留める）。
- マイコンボ（画面5）との統合。**別画面・別系統**であり、DES-005 §2 の画面一覧に「画面5 マイコンボとは別系統」の 1 行を添えることを DES 反映要点に含める（§9-3）。

---

## 3. 隠したもの管理（pruning ／ curation）［03a］

### 3.1 2 表を 1 画面に集約する際の見せ方

粒度が違う 2 表を並べるため、**粒度をラベルで明示して混同させない**。

| 系統 | 表 | 粒度 | 意味 | 表示ラベル（案） |
|------|----|------|------|------------------|
| pruning | `combo_punish_prunings` | 自キャラ × 相手技 | 物理的に届かない | 「確定反撃のない技」 |
| curation | `combo_punish_curations` | コンボ × 相手技 | 届くが使わない | 「使わない反撃」 |

- **pruning はコンボ非依存**（コンボを削除しても残る＝マッチアップの物理的事実）。この性質を UI 文言で表す。
- 解除は各行のボタン 1 つ。**片道操作を残さない**（DES-005 §5.20 既知の限界1 の解消）。

### 3.2 実装量の非対称（F-7）

| 系統 | BE | FE |
|------|----|----|
| pruning | **実装済**（`DELETE /api/combo-punish-prunings`・ルート／リポジトリとも稼働） | **未接続**＝解除フックの新設のみ |
| curation | **全レイヤ 0 件**＝repository／service／handler／routes を**新設** | 全新設 |

`combo_punish_curations` は M18-01（マイグレ 000037・CHANGE-079）で**表だけが作られ、以後どこからも触られていない**。M18-03a はこの表の**初めての消費者**になる。指示書には「未使用の表を新規に配線する」ことを明示し、**表定義（DES-003 §3.17）と実装の一致を着手前に実査させる**（L-1＝「既存と同型」と書くなら実機序を 1 回引く、の適用）。

### 3.3 新設する API（DES-002 §4.2 へ追加・採番は中央）

`POST /api/combo-punish-curations`（登録）／`DELETE /api/combo-punish-curations`（解除・**キー項目をボディで受ける**＝M18-02 で確立した DELETE の実装形）／`GET`（一覧）。一覧は「隠したもの管理」タブと、マイリスト本体の除外判定の両方で要る。**取得を専用 GET にするか、マイリストの取得 API に畳むかは指示書で確定する**（暫定案＝マイリスト API に畳む。FE が 2 系統の API を混ぜない）。

---

## 4. 自動判定できない相手技への既登録表示 ［03a］

DES-005 §5.20 既知の限界2 の解消。「自動判定できない相手技」セクションの相手技配下に、**フレーム判定を経ずに** `combo_punishes` の登録済みコンボを直接出す。

- **配信経路の暫定案＝`GET /api/punish-finder` のレスポンスに含める**。理由は (1) 走査規則の BE 一元化（DES-002 §4.2）に揃う、(2) FE が 2 系統の API を混ぜない、(3) invalidate が既存の `[punish-finder]` 1 本で済む（D-5＝punish 系 5 mutation は共通ヘルパー `useInvalidatePunishFinder()` 経由）。
- **これは探す画面（M18-02 の資産）への改修**である。§8 の E-14 突合で `internal/service/punishfinder/`・`web/src/features/punish/` の回帰ゲートを必ず張る。

---

## 5. materialize の設計 ［03b］

### 5.1 対象と非対象

| 生成元の `hit_type` | 扱い |
|---|---|
| `normal` | **materialize 対象**。始動技ダメージ × 0.2 を合計に加算し、`hit_type` を `punish_counter` にして別コンボとして生成 |
| `counter` | **materialize 対象**。**ダメージは不変**（カウンターもパニッシュカウンターも補正は 1.2 倍で同値＝spec §5。既に加算済みのため二重計上しない）。`hit_type` のみ `punish_counter` へ |
| `punish_counter` | **対象外**（既にパニッシュカウンター版）。UI にボタンを出さない |
| `just_parry_punish_counter` | **対象外**。ジャストパリィ始動は**手入力が正典**（自動算出しない） |

### 5.2 ダメージ計算（F-5＝本アプリ初の自動計算経路）

```
新 damage = 基底 combos.damage + round( 始動技 moves.damage × 0.2 )
```

決め切る必要がある縁を列挙する。**いずれも「silent に落とさない」思想（M18 の核）に従い、生成を止めるのではなく生成して注記する**方向で暫定案を置く。

| 条件 | 暫定案 |
|---|---|
| 基底 `combos.damage` が NULL | **生成する**。`damage` は NULL のまま。UI に「基底にダメージ未入力のため加算していない」と表示 |
| `starter_move_id` が NULL | **生成する**。ダメージは基底の値のまま。UI に「始動技が未設定のため加算していない」と表示 |
| 始動技の `moves.damage` が NULL | 同上 |
| `× 0.2` が整数にならない | **確認事項1**。暫定案＝四捨五入。**着手前 Plan Mode の実査項目に「`moves.damage` に 5 の倍数でない行があるか」を入れる**（実データで縁が存在しないなら規則の重みが下がる） |
| 基底が `is_draft = 1`（仮登録） | 生成物も `is_draft = 1`。**確認事項3**。dup 判定が `is_draft = 0` 固定（F-3）のため、仮登録同士は FR301 の網に掛からない点を指示書に明記 |

**生成後は編集可・独立フォーク**（spec §2）。基底を直しても生成物は追従しない。これはバグではなく仕様であり、UI 文言でもそう伝える。

### 5.3 API 経路の設計（**専用 endpoint 案を採る**）

**暫定案＝専用 endpoint `POST /api/combos/{id}/materialize`**（パス名は指示書で確定）。基底 id を path で受け、サーバ側で「基底読み込み → steps 複製 → ダメージ計算 → `hit_type` 決定 → FR301 チェック → `combos` INSERT ＋ `combo_punishes` INSERT」を **1 トランザクション**で行う。

**`CreateRequest` に `materializedFromComboId` を足す案を採らない理由**：

1. **出自はシステムが付ける値**である。`CreateRequest` に足すと、通常のコンボ登録経路から任意の出自を後付けできてしまう（出自の詐称が可能になり、ドリフト検出という列の目的が壊れる）。
2. **規則を BE に一元化する**（DES-002 §4.2 の流儀・M18-02 の走査で確立）。ダメージ加算と `hit_type` 決定を FE に持たせない。
3. **クライアントに steps を往復させない**。既存 PUT は「クライアントがフルレシピを再送」方式（F-6）だが、materialize でそれを採るとレシピが往復中に改変されうる。サーバ内で基底の `Steps` をそのまま複製すれば、`recipe_hash` が基底と一致することが構造的に保証され、FR301 の判定（§6.1）が素直になる。

**DES-002 v1.36.0 第37版が「materialize endpoint は M18-03 で追加〔本版では未追加＝候補のまま〕」と記していることとも整合する。**

### 5.4 既存経路への配線（F-4・**回帰ゲート必須**）

| 対象 | 変更 |
|---|---|
| `model.Combo` | `MaterializedFromComboID *int64` を追加（27 → 28 フィールド） |
| `InsertCombo`（`insertComboSQL`） | INSERT 列を **22 → 23** へ |
| `ComboResponse`（`internal/api/combo/dto.go`） | `materializedFromComboId` を露出（マイリストの生成元バッジ用・§2.3） |
| scan 経路 | 追加列の読み取り |

**これは既存の全コンボ作成経路が通る SQL の変更である。** `DuplicateKey`／`CalcRecipeHash`／`RecomputeComboCache` は**非改変**（DES-003 §3.4 が dup／recipe 非対象と明記）。指示書の DoD に「既存コンボ CRUD・CSV import/export・比較・エクスポートの非回帰」を必ず入れる。

---

## 6. FR301 重複防止・手動入力・案C・export 整合 ［03b］

### 6.1 FR301 の判定式（F-1／F-2 をそのまま使う）

生成前に、次のキーで既存コンボを探索し、**見つかれば生成しない**。

| 段 | 内容 |
|---|---|
| 1 段目（SQL） | `character_id`＝基底と同じ／`starter_move_id`・`position`・`opponent_stance`・`opponent_size`＝基底と同じ（**nil は `IS NULL`＝nil 同士は一致**）／**`hit_type` ＝ `punish_counter`**（ここだけ基底と異なる） |
| 2 段目 | 候補の `recipe_hash` と、**基底 steps から計算した `recipe_hash`** の文字列完全一致 |

- **基底自身は衝突しない**。`hit_type` が 6 項に含まれるため（基底は `normal` または `counter`）、基底と生成物は設計上すでに別コンボである（spec §2 の転換理由そのもの）。
- **実装は HTTP を往復しない**。`POST /api/combos/check-duplicate` は同じ判定を通るが（A-5）、materialize はサーバ内の操作なので、サービス層で `FindActivePublishedDuplicates` ＋ `recipe_hash` 比較を**直接再利用**する。
- **見つかったときの返し方**：生成せず、既存コンボの **id を返す**。FE は「既に登録済みです」と表示し `/combos/{id}` へのリンクを出す。`CheckDuplicateResponse` は id を含むため（A-5）、この UX に必要な情報は既に揃っている。

### 6.2 FR301 の穴を明示する（F-3）

dup 判定の WHERE は **`is_draft = 0` と `deleted_at IS NULL` が固定**である。したがって次の 2 ケースは**検出されず、二重生成が起こる**。

1. 既存の PC 版が**仮登録**（`is_draft = 1`）である。
2. 既存の PC 版が**ゴミ箱にある**（`deleted_at` が非 NULL）。

これは既存の全登録経路と一貫した挙動であり、**materialize だけの欠陥ではない**。ただし「重複防止がある」と説明された機能で二重生成が起きると驚きになるため、**指示書のテストケースに 2 ケースとも入れ、期待値を「生成される（既存仕様どおり）」と明示する**。M17-E19（既存 VAL の判定キーを確認せず矛盾する振る舞いを書いた）の対策として、**テスト軸を実機序に合わせる**。

### 6.3 手動入力導線（overview j）

ジャストパリィ始動の確定反撃は手入力が正典。M18-02 が実装済みの導線（`/combos/new` へ `punishContext` 付きで遷移・D-4）を再利用し、`hit_type` を `just_parry_punish_counter` にプリフィルする範囲へ拡張する。

**`hit_type` の値検証（F-8）について**：メイン API に値検証は無く、実使用の whitelist は CSV import 限定。`model.HitType*` 定数は参照 0 件で、同じ 4 値が 3 箇所以上にリテラル散在している。

- **暫定案＝現状維持**（VAL は新設しない）。FE は選択式で任意値を送れず、API 直叩きのリスクは他の全列と同じ水準にある。M18-03 のスコープを膨らませない。
- ただし **materialize 実装で新しいリテラルを増やさない**（`model.HitTypePunishCounter` を参照する）ことは指示書に明記する。散在を 4 箇所目へ広げない。
- DES-006 §2.7 の「自由 TEXT ＋ VAL whitelist 担保」という記述と実態のズレは、**DES 反映要点として中央へ回す**（§9-4）。**確認事項5**。

### 6.4 案C（相乗り3）

`internal/service/punishfinder/service.go:290-296` の抽出述語を緩和する。

| | 現行 | 案C |
|---|---|---|
| 述語 | `sm.IsAerial && strings.HasPrefix(sm.Code, jumpHeavyPrefix)` | `sm.IsAerial && sm.Category == "normal" && strings.Contains(sm.Code, "jumping_heavy_")` |
| 定数 | `jumpHeavyPrefix`（非公開） | 中間一致へ変わるため**定数名も改める**（`prefix` の語が実態と食い違う。L-7 の流儀） |

- **フレーム判定・レーン・`JumpSlack`（実値 4）は不変**。成立条件（jump 3 code 同値）は確認済（C-3）。
- **`MovementTotals` は変更不要**。`jump_neutral` を取得していない（C-4）が、3 code 同値のため `JumpForward` のみで判定できる。
- テスト軸：`juri`／`ken` の `neutral_jumping_heavy_kick` が jump レーンに**出る**こと／unique 系 7 件が**出ない**こと（`category = 'unique'` で自動除外・C-5）。

### 6.5 export 整合（overview k・E-17）

D-8 の実測により、**既存経路のままで出力される見込み**が立った。CSV は `hit_type` を verbatim 出力、PDF／PNG は `HIT_TYPE_LABELS` 経由で日本語化し、`just_parry_punish_counter` のラベル（「パニッシュカウンター(ジャストパリィ反撃)」）も定義済み。

残る設計判断は 1 つ、**`materialized_from_combo_id` を CSV export に出すか**。

- CSV は**意味単位**（code ベース・DB 管理列除外・DES-002 §7.6）。`materialized_from_combo_id` は combo の id ＝ DB 管理値であり、そのまま出すと往復で意味を失う。出すなら `local_id` 参照方式が要る。
- **暫定案＝出さない**。import 後は出自が失われ独立コンボになる。spec §2 の「生成後は独立フォーク」と整合し、ドリフト検出は自環境内でのみ機能する、と割り切る。**確認事項6**。
- **DoD に開発者の実出力目視を入れる**（E-17）。materialize コンボを 1 件、A4 縮小フィット下限 70% の条件で出力し、目視 OK まで完了報告を条件付き受理に留める。

---

## 7. 内部 2 分割（03a／03b）の根拠と順序

### 7.1 分割する理由

M18-03 は handover §4 が「M18 最大のサブ」と評したとおりで、BE 新設（curation の全レイヤ・materialize endpoint）と FE 新設（画面21・隠したもの管理・探す画面の改修）が同居し、**M18-02（51 commits）を上回る見込み**である。1 サブに束ねると Plan Mode の実査対象が広がりすぎ、レビューの粒度も落ちる。

**E-20 の「1 本動線」は設計を 1 本で通すことであり、実装を 1 サブに束ねることではない。** M18-overview §確認事項2 が「設計は 1 本動線・実装は 2 サブ（探す／使う）」と既に採っている流儀を、M18-03 の内部にも同じ形で適用する。本骨子（本書）が動線を 1 本で通す役割を担う。

### 7.2 順序＝03a（画面系）→ 03b（生成系）

| | 03a：確定反撃マイリスト＋隠したもの管理 | 03b：materialize＋登録導線 |
|---|---|---|
| 主な新設 | 画面21・curation の全レイヤ・pruning 解除の FE 接続・自動判定不可への既登録表示 | materialize endpoint・ダメージ計算・FR301・案C・export DoD |
| ドメイン判断 | 少ない（既存データの見せ方が中心） | 重い（ダメージ規則・丸め・dup の縁） |
| 依存 | M18-01／M18-02 | **03a**（生成物の着地先が先にある） |

**03a を先に置く理由**：(1) 03a は既存の `combo_punishes` だけで完結し、materialize の設計が固まる前に着手できる。(2) 03b の生成物が着地する画面が先にできているため、生成直後の確認が実画面で行える。(3) 03b はダメージ規則・丸め・dup の縁と判断が重く、Opus ＋ Plan Mode の集中を確保したい。

**手戻りリスクは小さい**と見る。マイリストはコンボを汎用に表示するため、materialize 生成物であっても「`hit_type = punish_counter` のコンボ」以上のものではない。追加で要るのは生成元バッジ（§2.3）だけであり、**バッジのための `ComboResponse` 露出（F-4）は 03b の配線に含める**（03a ではバッジを出さず、03b で足す）。

> **サブ数が 3 → 4 に増える。** 開発者裁定（2026-07-26）により内部分割は M18 指示書担当の裁量だが、M18-overview 末尾のメンテ条件に従い**開発者リレーで中央へ連絡する**（§9-6）。

---

## 8. E-14 突合と回帰ゲート

RESEARCH-02 D-1／D-2 で as-built を実ファイル・行数まで取得済み。M18-03 の改造対象と突合する。

| 既存資産 | 触るサブ | 張る回帰ゲート |
|---|---|---|
| `internal/service/punishfinder/`（constants.go 53／service.go 367／service_test.go 510） | **03a**（既登録表示）**03b**（案C） | 走査結果の非回帰（除外規則 a〜h・3 レーン境界・ガードタブ 0 件が正常であること） |
| `internal/repository/punish/`・`internal/api/punish/`・`web/src/features/punish/`（PunishTree.tsx 438／同 test 221） | **03a** | 探す画面の既存操作（採否トグル・pruning・note・新規登録導線）の非回帰 |
| `internal/repository/combo/`・`internal/service/combo/`・`internal/api/combo/` | **03b**（INSERT 22→23 列・model・DTO） | **既存コンボ CRUD・CSV import/export・比較・エクスポートの非回帰**（golden 維持） |
| `internal/service/setplay/`・`web/src/features/setplay/`（M19-01・CHANGE-085） | **接点なしの見込み** | materialize の導線を**コンボ詳細（DES-005 §5.6・D-3 項目9）に置かない**方針のため面の衝突は無い。ただし **03b が `model.Combo` を変更する**ため、**setplay サービスが `model.Combo` を読むかを着手前 Plan Mode で実査**する |
| queryKey（D-5） | 03a／03b | materialize 成功時に `["combos"]`・`["combo", id]`・`["punish-finder"]` の **3 系統を invalidate**。punish 系は既存の共通ヘルパー `useInvalidatePunishFinder()` に相乗りする（新しい流儀を作らない） |

**出力固定資産も突合対象に含める**（E-22／L-3）：`internal/seedgen` の golden、コンボ export の期待値、`divergence_test`。03b は `model.Combo` を変更するため、`divergence_test` の同期が要るかを着手前に確認する。

---

## 9. DES 反映要点の候補（実装完了後に中央へ／採番・改訂は中央）

現時点で見えているものを先に列挙する。**確定は各サブの完了報告時**。

1. **DES-002 §4.2**：materialize endpoint（§5.3）／curation の CRUD endpoint（§3.3）を追加。
2. **DES-003 §3.4**：`materialized_from_combo_id` の**初めての消費者**が現れたこと（列が未使用でなくなった）。§3.17 `combo_punish_curations` にも同様。
3. **DES-005**：画面21「確定反撃マイリスト」を新設（§2 画面一覧に**「画面5 マイコンボとは別系統」の 1 行**を添える）／§5.20 の既知の限界 1・2 を解消済みへ更新／§5.20 の「【未反映の確定事項】」（案C）を as-built へ昇格。
4. **DES-006 §2.7**：`hit_type` の「自由 TEXT ＋ VAL whitelist 担保」という記述と実態（メイン API に値検証なし・whitelist の実使用は CSV import 限定）のズレ（F-8）。**M18-03 で VAL を新設しない場合、記述を実態へ合わせる errata が要る**。
5. **DES-006 §2.3**：**nil 同士を一致として扱う**ことが設計書に未言及（F-1・A-7）。実装は一貫しているので矛盾ではないが、明文化を推奨。あわせて「レシピの順序込み完全一致」が **`Modifiers.Flags` 内部の順序は無視**する実装であること（F-2）。
6. **管理連絡**：M18-03 の内部 2 分割（サブ数 3 → 4）。

---

## 開発者への確認事項

> 形式＝【何を】【なぜ】【暫定案】。1〜3 は materialize のダメージ、4〜6 は仕様の選択、7〜8 は動線です。

**1. ダメージ加算の丸め規則**
- 何を：`始動技ダメージ × 0.2` が整数にならない場合、切り捨て・切り上げ・四捨五入のどれにするか。
- なぜ：`combos.damage` は INTEGER で、本アプリ初のダメージ自動計算経路になります（F-5）。規則を決めないと製造が推測で実装します。
- 暫定案：**四捨五入**。生成後編集可なので実害は小さい。あわせて**着手前 Plan Mode の実査項目に「`moves.damage` に 5 の倍数でない行があるか」**を入れ、実データに該当が無ければ規則の重みが下がることを確認します。

**2. 基底のダメージ・始動技が未設定のときの扱い**
- 何を：基底 `combos.damage` が NULL、または `starter_move_id`／始動技の `moves.damage` が NULL のとき、生成を許すか禁止するか。
- なぜ：加算の材料が欠けます。禁止すると、うろ覚え記録（FR009・仮登録）から PC 版を作れなくなります。
- 暫定案：**生成する**。ダメージは加算せず（NULL は NULL のまま／基底値のまま）、UI に理由を表示する。M18 の「silent に消さない」思想の適用です。

**3. 基底が仮登録（`is_draft = 1`）のときの扱い**
- 何を：生成物も仮登録にするか、本登録にするか。
- なぜ：dup 判定は `is_draft = 0` 固定（F-3）なので、仮登録同士は FR301 の網に掛かりません。挙動を決めておかないと二重生成の説明がつきません。
- 暫定案：**生成物も仮登録**（基底の状態を引き継ぐ）。FR301 の網に掛からないことは指示書に明記し、テストケースにも入れます。

**4. マイリストのガード／ジャストパリィの見せ方**
- 何を：探す画面と同じ**タブ切替**にするか、両方を 1 画面に**混ぜて表示**するか。
- なぜ：探す画面は「今どちらを検証しているか」が明確なのでタブが自然ですが、使う画面は「このマッチアップの反撃を全部見たい」需要が想定されます。
- 暫定案：**タブ切替**（既定＝ジャストパリィ・探す画面と一貫）。ただし実運用で不便なら、`hit_type` バッジ付きの混合表示へ倒します。

**5. `hit_type` の値検証を新設するか**
- 何を：メイン API（`ValidateComboForCreate`）に `hit_type` の whitelist 検証（VAL 新設）を足すか、現状維持にして DES-006 §2.7 の記述を実態へ合わせるか。
- なぜ：DES-006 §2.7 は「自由 TEXT ＋ VAL whitelist 担保」と書いていますが、実装では whitelist の実使用が CSV import 限定で、メイン API には値検証がありません（F-8）。M18-03 は手動入力で `hit_type` を扱うため、判断が要ります。
- 暫定案：**現状維持＋DES を実態へ合わせる errata**。FE は選択式で任意値を送れず、API 直叩きのリスクは他の全列と同水準です。M18-03 のスコープを膨らませません。ただし materialize 実装では `model.HitTypePunishCounter` を参照させ、**4 値のリテラル散在を 4 箇所目へ広げない**ことは指示書で縛ります。

**6. `materialized_from_combo_id` を CSV export に出すか**
- 何を：出自を CSV の往復対象に含めるか。
- なぜ：CSV は意味単位（code ベース・DB 管理列除外）で、id をそのまま出すと往復で意味を失います。含めるなら `local_id` 参照方式が要り、契約が複雑になります。
- 暫定案：**出さない**。import 後は独立コンボになる（spec §2「生成後は独立フォーク」と整合）。ドリフト検出は自環境内でのみ機能する、と割り切ります。

**7. materialize と `combo_punishes` 紐づけを同一トランザクションにするか**（前回の確認事項9・未回答分の再掲）
- 何を：生成と「確定反撃に採用」を 1 操作にするか、分けるか。
- なぜ：1 操作にすると「生成したがどこにも紐づいていないコンボ」が原理的に生じず状態が単純になりますが、「生成だけしてあとで採用先を決める」ができなくなります。
- 暫定案：**同一トランザクションで両方作る**。materialize は必ず「この相手技への反撃」という文脈から起動されるため、相手技が確定していない materialize は起こり得ません。解除は独立させ、`combo_punishes` を解除しても生成物のコンボは残します。

**8. 生成元が既にパニッシュカウンター版のとき**
- 何を：`hit_type` が `punish_counter`／`just_parry_punish_counter` のコンボに、materialize ボタンを**出さない**扱いでよいか。
- なぜ：二重計上を防ぐためです（spec §5「既にカウンター/PC 記録のものに足すと二重計上」）。ボタンを出したうえでエラーにする案もありますが、押せないものを見せない方が動線が素直です。
- 暫定案：**ボタンを出さない**。代わりに「確定反撃に採用」だけを出す（既に PC 版なので、そのまま紐づければよい）。

---

*以上、M18-03 設計方針書（骨子）v0.1.0。配置 `docs/instructions/phase3/M18-03-design-outline.md`。本書が M18-03a／M18-03b 実装指示書の前段であり、E-20 の 1 本動線を通す役割を担う。自採番なし・DES 直接改訂なし（playbook §15.7）。*
