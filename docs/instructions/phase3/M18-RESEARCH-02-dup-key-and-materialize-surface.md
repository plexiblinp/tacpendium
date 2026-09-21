# 指示書 M18-RESEARCH-02: FR301 重複判定の実機序 ＋ materialize 実装面 ＋ 案C 影響範囲の実測（M18-03 着手前）

| 項目 | 内容 |
|------|------|
| 文書ID | M18-RESEARCH-02 |
| バージョン | **1.0.0（最終版）** |
| 種別 | 調査指示書（**read-only**。実装・マイグレ作成/編集・コード変更・seed 変更・ファイル移動を一切行わない） |
| 対象 | 製造担当 Claude Code |
| モデル | **Sonnet 4.6**（read-only 調査。view / grep / SELECT 中心の事実列挙） |
| レビュー | 不要（read-only。実装物が無いため機械レビュー対象なし） |
| 作成者・作成日 | M18 指示書担当（playbook §15.6・委任 v1.2.0 §6）／ 2026-07-26 |
| 前提 | phase3-overview v1.1.2 §M18 ／ M18-overview v0.1.8 §2.1 f〜k ／ M18-03-handover v1.0.0 §4〜§5 |
| 主参照 | code-facts §1／§2／§4／§7-2／§9／§10 ・ DES-003 v1.34.0 §3.4・§3.15〜3.18 ・ DES-006 v1.21.0 §2.1・§2.3 ・ DES-005 v2.50.0 §5.6・§5.20 ・ retrospective-digest §3（M17-E19）・M18-01 教訓 L-1 |

> **【errata 2026-07-30・重要】本書は v1.0.0 が最終版であり、v1.1.0 は存在しません。**
> 2026-07-26 のチャット上で「(a) C-1 を『正典との照合』へ格上げ (b) 前提事実 P-7 の出所を格上げ (c) C-6 を新設 (d) 確認事項 3 に中央裁定を追記」を内容とする **v1.1.0 へ改訂した旨を申告しましたが、disk 実体への反映を行っていませんでした**（M18 指示書担当の作業漏れ）。
> **実務影響はありません。** 製造は本書 **v1.0.0** に対して調査を実施し、`M18-RESEARCH-02-report.md` も「指示書 v1.0.0」と記録しています。**v1.1.0 で追加しようとした内容は report 側で実質すべて満たされました**——C-1 は実述語がコード引用で報告され DES-005 §5.20 の as-built 表との照合が可能、C-6 は C-2(c) の差分実測が兼ねています。当時の判断も「再実行のコストに見合う追加情報はなく、v1.0.0 の report で確定として扱う」でした。
> **本 errata の目的は、v1.1.0 を探して見つからない読者を生まないことです。** これは M18-01 教訓 **L-5**（撤回・改訂した要件は disk 実体への反映まで完了条件に含める）に、私自身が抵触した事例です。**M18 の lessons-learned に「自分の成果物にも L-5 を適用する——チャットでの改訂申告は disk 反映まで完了ではない」として送ります。**

## 更新履歴

| 版 | 更新日 | 更新内容 |
|----|--------|----------|
| **1.0.0（最終）** | 2026-07-26 | 初版。M18-03（materialize＋確定反撃マイリスト）のスコープ確定入力として、dup 判定の実機序・materialize の実装面・案C の影響範囲・E-14 棚卸しを実測する。 |

---

## 0. この指示書の特殊性

### 0.1 製造担当として起動し、調査だけ実施して閉じる

本指示書は製造担当セッションを起動して **§4 の事実列挙 → §5 のレポート作成 → クローズ**するもの。実装は本調査の対象外（後続の M18-03 実装指示書で別途指示する）。**Plan Mode は不要**（read-only のため）。

### 0.2 read-only 厳守

`view` / `grep` / `find` / `ls` / `git log` / **SQL は SELECT のみ**。編集系・書き込み系のコマンドは禁止。例外は §2.1 のレポートファイル作成のみ。dev DB へ書き込まないこと（`sqlite3` CLI が無い環境では python3 標準 `sqlite3` モジュールで代替してよい＝M18-RESEARCH-01 と同じ流儀）。

### 0.3 判断・提案を含めない（judgement-free）

**事実列挙のみ**。「ここをこう直すべき」「この設計が良い」といった修正方針・設計結論は書かない。ただし次の 2 つは判断ではないため記録すること：**(1) 想定外の発見**、**(2) 明らかな矛盾の事実指摘**（例：本書 §3.2 の前提事実が実コードと食い違っていた場合）。複数の実現手段が見えた場合は**併記**にとどめ、選択はしない。

### 0.4 本調査の主目的

| 軸 | 主目的 | 誤解を避けるための注記 |
|---|---|---|
| A | **FR301 重複判定の実機序**を実コードで確定する | M18-03 のテストケースの軸を決める前に引く。**M17-E19（既存 VAL を確認せず矛盾する振る舞いを書いた）の再演防止**が目的であり、dup ロジックの良し悪しを論じるものではない |
| B | **materialize が既存のコンボ生成経路にどう乗るか**の実装面を棚卸しする | 設計の選択（どの経路に乗せるか）は M18-03 で行う。本調査は選択肢の材料出しに留める |
| C | **案C（`neutral_jumping_heavy_kick` を含める）の影響範囲**を実測する | 含める／含めないの判断は**開発者裁定で「含める」に確定済み**。本調査は影響件数と成立条件の裏取りのみ |
| D | **M18-03 が触る面の as-built 棚卸し**（E-14） | M18-02 だけでなく **M19-01（CHANGE-085）が同じ画面に着地している**ため、両方を対象にする |

---

## 1. 背景と目的

### 1.1 背景

M18-03（materialize＋確定反撃マイリスト＋手動入力＋export 整合＋pruning/curation の「隠したもの管理」）は M18 最大のサブであり、その設計は次の 4 点に依存する。いずれも**現時点で設計担当が実コードから確認できていない**。

1. **FR301 重複防止の判定キーの実機序**。M18-03 は「生成前に『同一レシピ＋ヒット区分＝パニッシュカウンター』の既存コンボを探索し、あれば生成しない」を実装する。この探索が既存の `DuplicateKey`（6 項）と `CalcRecipeHash` の**どちらで・どう比較されるか**を知らずにテストケースの軸を決めると、M17-E19（`setups` の重複 3 ケースが既存 VAL-S04 と原理的に矛盾していた）を繰り返す。とくに **`*int64` / `*string` の nil 同士をどう比較するか**（`= NULL` は SQL で常に偽）は、`starter_move_id` や `position` が未設定のコンボの扱いを左右する。
2. **materialize がどの生成経路に乗るか**。code-facts §7-2 の `CreateRequest` には `materializedFromComboId` が**無い**。既存 Create 経路をそのまま使えないのか、DTO 拡張で足りるのか、専用 endpoint が要るのかは実コードを見ないと分からない。
3. **案C の成立条件**。ジャンプ経由レーンの判定は `jump_forward.total` を消費する形で実装されており、code-facts §9 の `MovementTotals` は `DashForward` / `JumpForward` の 2 値しか持たない。垂直ジャンプ始動技を同レーンに載せてよいのは **`jump_neutral.total` = `jump_forward.total`** が成り立つ場合に限られる。この同値は CHANGE-084 v2 §3.1 の値表が一次源だが、**設計担当は伝聞でしか把握していない**（E-24）。
4. **M18-03 が触る面の現状**。M18-02（CHANGE-083/084）と **M19-01（CHANGE-085）**が相次いで着地しており、とくに **DES-005 §5.6 コンボ詳細**は M19-01 が項目12「セットプレイ自動提案」を追加したばかりである。M18-03 の導線設計は、この as-built を知らないまま引けない（E-14 の時間軸版＝M17-E14）。

### 1.2 目的

§4 の各項目を**実コード・実 SQL・実 DB の view / grep / SELECT で確認**し、§5 の様式で報告する。報告は M18-03 実装指示書の**スコープ確定入力**となる。

### 1.3 この調査でやらないこと（read-only 厳守）

- 実装・マイグレ作成・seed 変更・コード変更を**一切しない**。
- 最終決定をしない（材料提示のみ。§0.3）。
- DES / REQ 本体を変更しない。
- **案C の実装を前倒ししない**（抽出述語の変更は M18-03 の実装指示書で行う）。
- dev DB へ書き込まない。

---

## 2. 成果物

### 2.1 作成するファイル

- `docs/progress/phase3/M18-RESEARCH-02-report.md`（調査報告。§5 の様式）。

### 2.2 変更しないもの

全ソース（`internal/**`・`web/**`）・全マイグレ（`migrations/*.sql`）・全 seed（`internal/seedgen/**`・`character_data/*.csv`）・DES / REQ 本体・全テスト・dev DB。

---

## 3. 前提条件

### 3.1 必読ドキュメント

- `docs/handover/code-facts.md` §1（Props）／§2（queryKey）／§4（Go ルート↔ハンドラ）／§7-2（リクエスト DTO）／§9（repository 構造体）／§10（マイグレーション）。
- `docs/design/03-data-model.md`（DES-003 v1.34.0）§3.4 `combos`（`materialized_from_combo_id`）・§3.15〜§3.18（confirm 系 4 表）。
- `docs/design/06-validation.md`（DES-006 v1.21.0）§2.1 VAL-C02・**§2.3（VAL-C02 の同一コンボ判定条件）**・§2.7（`hit_type` 4 値）。
- `docs/design/05-screen-design.md`（DES-005 v2.50.0）§5.6（コンボ詳細）・§5.20（確定反撃サーチ）。
- `docs/handover/retrospective-digest.md` §3（M17-E19＝重複時の振る舞いを書く前に既存 VAL / UNIQUE の判定キーを実コードで引く）。

### 3.2 前提事実（設計担当が code-facts / DES から確認済み ＝ 調査の出発点）

以下は設計担当が **code-facts と DES から読み取った内容**であり、**実コードでの裏取りは未了**。調査担当はここを起点に実査し、**食い違いがあれば §0.3(2) として必ず報告する**こと。

| # | 前提事実 | 出所 |
|---|---|---|
| P-1 | `DuplicateKey`（`internal/repository/combo/repository.go`）は 6 項＝`CharacterID int64` / `StarterMoveID *int64` / `Position *string` / `OpponentStance *string` / `HitType *string` / `OpponentSize *string` | code-facts §9 |
| P-2 | `CheckDuplicateRequest`（`internal/api/combo/dto.go`）は上記 6 項＋`steps []StepRequest`＋`excludeComboId *int64` を持ち、`POST /api/combos/check-duplicate` が受ける | code-facts §4・§7-2 |
| P-3 | `CreateRequest`（同上）に **`materializedFromComboId` は無い**。`PutRequest` は `CreateRequest` を embed し `version` を足したもの | code-facts §7-2 |
| P-4 | `combos.materialized_from_combo_id` は self-FK・NULL 可・**dup 判定と `recipe_hash` の非対象**（マイグレ 000038／CHANGE-080） | DES-003 §3.4 |
| P-5 | `hit_type` は 4 値（`normal` / `counter` / `punish_counter` / `just_parry_punish_counter`）・**DB CHECK 無し**・Go 側 whitelist で担保 | DES-006 §2.7 |
| P-6 | `punish` リポジトリの `MovementTotals` は `DashForward *int` / `JumpForward *int` の 2 値のみ（`JumpNeutral` は持たない） | code-facts §9 |
| P-7 | ジャンプ経由レーンの始動技抽出は `is_aerial=1`（主）AND `HasPrefix(code,"jumping_heavy_")`（補助）の二重担保。該当 **21 件**（基準時点 2026-07-24） | M18-02 完了報告 §3 |
| P-8 | `is_aerial=1` は 70 件で全件 `startup` 非 NULL。うち 9 件が `jumping_` 接頭辞を持たない（基準時点 2026-07-24） | M18-02 完了報告 §3 |
| P-9 | 移動 5 code の `total` backfill は 10 キャラ×5 code＝50 行。`c_viper` / `dhalsim` は対象外で NULL のまま | M18-02 完了報告 §2 |
| P-10 | M19-01（CHANGE-085）が `GET /api/combos/:comboId/setplay-suggestions` と `internal/service/setplay` を追加し、DES-005 §5.6 コンボ詳細に項目12 を新設した | code-facts §4・DES-002 v1.36.0・DES-005 v2.50.0 |

---

## 4. 調査項目

各項目とも **実ファイルを view し、関数名・型名・列名・件数は実値で報告**すること。確認できなかったものは推測で埋めず**「未確認」と明記**する。

### A. FR301 重複判定の実機序（最重要）

- **A-1**: `DuplicateKey` の**定義箇所**（ファイル・行）と、**構築している呼び出し元をすべて**列挙する（`grep -rn "DuplicateKey" internal/ web/` 相当）。呼び出し元ごとに「どの経路（Create / Put / CSV import / check-duplicate / その他）か」を併記する。
- **A-2**: 重複判定の**実 SQL**（またはクエリ組み立てコード）を view し、**6 項それぞれの比較演算子**を報告する。とくに次を実値で示すこと：
  - `StarterMoveID` / `Position` / `OpponentStance` / `HitType` / `OpponentSize` が **nil のとき**、SQL 上どう表現されるか（`IS NULL` を出しているか、`= ?` に nil を渡しているか、そもそもキーから外しているか）。
  - **nil 同士を「一致」と扱うか「不一致」と扱うか**（＝`starter_move_id` 未設定のコンボ 2 件が重複と判定されるか否か）。判定できたら**その結論の根拠となる行**を引用する。
- **A-3**: レシピの一致判定に使われているものを特定する。`CalcRecipeHash` の**定義箇所・入力（何を材料にハッシュするか＝列・ステップの範囲・modifiers を含むか）・呼び出し元**を報告する。`recipe_hash` 列が DB にあるか（`migrations/` を grep）、あるなら誰が書き込むかも報告する。
- **A-4**: `RecomputeComboCache` の**定義箇所・呼び出し条件**（どの更新経路で呼ばれ、どの経路では呼ばれないか）を報告する。
- **A-5**: `POST /api/combos/check-duplicate`（`combo.Handler.CheckDuplicate`）の**ハンドラ→サービス→リポジトリの経路**を追い、**レスポンス形状**（重複ありのとき何を返すか＝真偽だけか、既存コンボの id / 名称 / ダメージ等を返すか）を実コードで報告する。`excludeComboId` が何のために使われているか（どの経路が渡しているか）も報告する。
- **A-6**: `hit_type` の **Go 側 whitelist の定義箇所**（定数名・4 値の実リテラル）と、それを参照している検証関数を列挙する。
- **A-7**: **DES-006 §2.3（VAL-C02 の同一コンボ判定条件）の記述と、A-2/A-3 で判明した実機序の差分**を列挙する。差が無ければ「差なし」と明記する（**判断は書かず、事実の対照のみ**）。

### B. materialize の実装面（既存経路の棚卸し）

- **B-1**: `materialized_from_combo_id` を**読み書きしているコードをすべて**列挙する（`grep -rn "materialized_from\|MaterializedFrom" internal/ web/ migrations/` 相当）。マイグレ 000038 以外に参照が無ければ「マイグレのみ＝列は追加されただけで未使用」と明記する。
- **B-2**: コンボ新規作成の**実経路**を追う：`combo.Handler.Create` → サービス → リポジトリ INSERT。**INSERT している列の全数**を列挙し、`materialized_from_combo_id` が INSERT 対象に含まれているかを報告する。
- **B-3**: `model.Combo`（`internal/model/combo.go`）の**フィールド全数と db / json タグ**を報告し、`MaterializedFromComboID` 相当のフィールドが存在するかを明記する。存在する場合、`GET /api/combos/:id` のレスポンス（`internal/api/combo/dto.go` の Response 構造体）に露出しているかも報告する。
- **B-4**: コンボの**ダメージ列の型と NULL 可否**（`combos.damage`）、および**始動技のダメージを引く経路**（`combos.starter_move_id` → `moves.damage`）が既存コードに存在するか（あれば関数名・ファイル）。無ければ「無し」と明記する。
- **B-5**: レシピ（`combo_steps`）の**複製に使える既存コード**があるか（コンボのコピー機能・`PUT`（識別キー変更＝旧論理削除→新規作成）の実装が steps をどう作り直しているか）。関数名・ファイル・行で報告する。
- **B-6**: `combos` の**論理削除**（`deleted_at`）の扱いを報告する。とくに **A-2 の重複判定が論理削除済みコンボを対象に含むか除外するか**を実 SQL で確認する。

### C. 案C（`neutral_jumping_heavy_kick` を含める）の影響範囲

- **C-1**: ジャンプ経由レーンの**始動技抽出述語の実体**（`internal/service/punishfinder/` 配下。ファイル・行・条件式そのもの）を引用して報告する。`internal/service/punishfinder/constants.go` の定数（`JUMP_SLACK` / `DASH_MIN_SLACK` / `movementSystemCodes` 等）も**実値**で列挙する。
- **C-2**: dev DB で次を **SELECT して実数**で報告する（基準時点を明記＝E-24）：
  - (a) `is_aerial=1 AND category='normal' AND code LIKE '%jumping\_heavy\_%'` の全数と全件列挙（character / code）。
  - (b) 上記のうち `code LIKE 'jumping\_heavy\_%'`（現行の抽出条件に合致）の全数。
  - (c) **(a) − (b) ＝ 案C で新たに拾われる技の全件列挙**（character / code / startup / damage）。
  - (d) `code LIKE '%neutral\_jumping\_%'` の全件列挙（**強K 以外も含めて全数**。category / is_aerial / startup / damage を併記）。
- **C-3**: 移動 system move の `total` を **10 キャラ全数**で SELECT し、**`jump_neutral` / `jump_forward` / `jump_back` の 3 code が同値か**をキャラごとに報告する（character / jump_neutral / jump_forward / jump_back の表）。**同値でないキャラがあれば必ず明示**する。`c_viper` / `dhalsim` が NULL であることも確認する。
- **C-4**: `MovementTotals`（`internal/repository/punish/repository.go`）が**取得している列と SQL** を報告し、`jump_neutral` を取得していないことを実コードで確認する。
- **C-5**: unique 系空中特殊技 8 件（`elbow_drop` / `flying_body_press` / `flying_headbutt` / `great_spin` / `step_up_*`）の **category を実値で**報告する（案C の `category='normal'` 条件で自動的に除外されるかの事実確認）。

### D. M18-03 が触る面の as-built 棚卸し（E-14）

- **D-1**: **M18-02 が触った資産**を実ファイルで列挙する：`internal/service/punishfinder/` 配下の全ファイル／`internal/repository/punish/` 配下の全ファイル／`internal/api/punish/` 配下の全ファイル／`web/src/features/punish/` 配下の全ファイル。各ファイルの行数を併記する。
- **D-2**: **M19-01 が触った資産**を同様に列挙する：`internal/service/setplay/` 配下／`internal/api/setplay/` 配下（存在すれば）／`web/` 側でセットプレイ自動提案の UI を実装しているファイル（`grep -rn "setplay-suggestions\|SetupCandidateList" web/src/` 相当）。
- **D-3**: **コンボ詳細画面（`ComboDetailPage`）の as-built の表示項目を上から順に全数**列挙する（実ファイルを view し、セクション見出し・項目名を実値で）。M19-01 の「セットプレイ自動提案」がどの位置に入ったかを明記する。
- **D-4**: `ComboEditor` の **Props 契約**（`mode` / `initial` / `initialCharacterId` 他・全数）と、`location.state` から読んでいるキー（`punishReturn` / `punishContext` 他・全数）を実コードで報告する。
- **D-5**: `web/src/` の **queryKey 全数のうち、`punish` / `combo` / `setplay` に関わるもの**を列挙し、それぞれの invalidate 元（どの mutation の onSuccess で無効化されるか）を報告する（code-facts §2 を起点に、実コードで裏取り）。
- **D-6**: `combo_punishes` / `combo_punish_prunings` / `combo_punish_curations` / `combo_punish_starters` の **4 表それぞれについて、現在 SELECT / INSERT / DELETE しているコード**を列挙する。とくに **`combo_punish_curations` を読み書きしているコードが存在するか**（M18-01 で表だけ作られ未使用の可能性）を明記する。
- **D-7**: **自技側 `startup IS NULL` の実測**（M18-02 申し送り §3-5）：dev DB で `is_aerial=0 AND damage>0 AND startup IS NULL` の件数と、キャラ別・category 別の内訳を報告する（基準時点を明記）。全件が 20 件以下なら全件列挙（character / code / category / damage）。
- **D-8**: **export 経路の as-built**：コンボの視覚出力（PDF / PNG）と CSV export が `hit_type` をどう出力しているか（ラベル写像の実体・ファイル・関数）を報告する。`just_parry_punish_counter` の写像が存在するかを実値で確認する。

---

## 5. 報告様式（`docs/progress/phase3/M18-RESEARCH-02-report.md`）

冒頭に **§0 結論サマリ**（箇条書き 10 行以内・実数中心）を置く。以降、§4 の A / B / C / D の順に節を立て、各調査項目について次を記す。

1. **実態**（view / grep / SELECT の結果。ファイル・行・関数名・列名・件数はすべて**実値**）。
2. **契約・正典との差**（DES-003 §3.4・§3.15〜3.18／DES-006 §2.3・§2.7／code-facts §7-2・§9 の記述との差分。差が無ければ「差なし」と明記）。
3. **M18-03 スコープへの含意**（何が決まり、何がまだ決まらないか。**設計判断はしない**）。
4. **複数の実現手段が見えた場合は併記**（選択はしない）。

**件数を報告するときは必ず「何を・どの単位で数えたか・基準時点・一次源か参考値か」を併記する**（E-16 / E-18 / E-24）。dev DB の実測は「基準時点＝実行日」「一次源＝dev DB」と明記し、CSV 由来の値と混ぜない。

末尾に **「M18-03 スコープ確定のための要決定事項」** を番号付きで集約する（各項目に「何が未確定か・どの調査結果が根拠か」を添える。**推奨・決定は書かない**）。

---

## 6. 完了条件（Definition of Done）

- §4 の **A-1〜A-7 / B-1〜B-6 / C-1〜C-5 / D-1〜D-8 の全 26 項目**に実値で回答している（確認不能な項目は「未確認」＋理由）。
- **read-only を逸脱していない**（ソース・マイグレ・seed・DES・テスト・dev DB のいずれにも書き込みが無い。`git status` が clean〔レポートファイルを除く〕であることを報告に記す）。
- **A-2（nil の比較）と C-3（jump 3 code の同値）に明確な結論が出ている**。この 2 つは M18-03 の設計を左右するため、「未確認」で通さず、判定できない場合はその理由を具体的に書く。
- §3.2 の前提事実 P-1〜P-10 のそれぞれについて、**裏取りできた／食い違った／未確認**のいずれかが明示されている。
- 「要決定事項」が Plan Mode の入力に足る粒度でそろっている。

---

## 7. 参照ドキュメント

- `docs/handover/code-facts.md`（生成 2026-07-26 / commit `a2381a4`）§1・§2・§4・§7-2・§9・§10
- `docs/design/03-data-model.md`（DES-003 v1.34.0）§3.4・§3.15〜§3.18
- `docs/design/05-screen-design.md`（DES-005 v2.50.0）§5.6・§5.20
- `docs/design/06-validation.md`（DES-006 v1.21.0）§2.1・§2.3・§2.7
- `docs/design/02-architecture.md`（DES-002 v1.36.0）§4.2
- `docs/instructions/phase3/M18-overview.md` v0.1.8 §2.1
- `docs/progress/phase3/M18-02-completion-report.md`（§2・§3 の実測値＝本書 P-7〜P-9 の出所）
- `docs/handover/retrospective-digest.md` §3（M17-E19）・§0（code-facts は想定で書かず必ず引く）

---

## 開発者への確認事項

1. **【要確認】dev DB の基準時点**
   - **何を**：C-2 / C-3 / D-7 の SELECT を実行する dev DB（`~/.local/share/combomgr/combomgr.db`）が、**M18-02 マージ後の全マイグレ（〜000041）適用済み**の状態か。
   - **なぜ**：000041（移動 total backfill）が未適用だと C-3 の `jump_*` が全件 NULL になり、案C の成立条件を確認できません。
   - **暫定案**：適用済みとして実行し、`jump_forward` が全キャラ NULL だった場合は「マイグレ未適用の可能性」として報告に明記させる（本書 §6 の「未確認＋理由」に該当）。

2. **【要確認】本調査に RESEARCH 連番を消費してよいか**
   - **何を**：本書を `M18-RESEARCH-02` として採番したこと（`M18-RESEARCH-01` ＋ addendum / addendum2 の次）。
   - **なぜ**：指示書番号はマイルストーンローカル＝自採番可（委任パッケージ §0）ですが、M18-02 期には `M18-02-RESEARCH-01-dash-frames.md` というサブ従属の命名も使われており、命名流儀が 2 系統あります。テンプレ README は `M{N}-RESEARCH-{NN}-{slug}` を「今後の正」としているため、本書はそちらに従いました。
   - **暫定案**：`M18-RESEARCH-02` のまま進める。中央から別の流儀の指示があれば改名する（内容は不変）。

3. **【解決済み・記録】案C の採否**
   - `neutral_jumping_heavy_kick` を含めるか否かは**開発者裁定で「含める」に確定**（2026-07-26）。本調査の C 軸は**採否の判断材料ではなく、確定済み方針の影響範囲の実測**です。調査担当が採否を論じる必要はありません（§0.3）。

---

*以上、M18-RESEARCH-02 調査指示書 v1.0.0。配置 `docs/instructions/phase3/M18-RESEARCH-02-dup-key-and-materialize-surface.md`。本調査の report が M18-03（materialize＋確定反撃マイリスト）のスコープ確定入力となる。*
