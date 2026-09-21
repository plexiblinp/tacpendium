# 指示書 M16-RESEARCH-01: ④ 移動 move 化・④'' dash 一本化・レシピ同一性/FR301 dup の着手前調査

| 項目 | 内容 |
|------|------|
| 文書ID | M16-RESEARCH-01 |
| バージョン | 1.0.0 |
| 種別 | 調査指示書(read-only。実装・マイグレ作成/編集・コード変更・seed 変更・データ変更を一切行わない) |
| 対象 | 製造担当 Claude Code |
| モデル | Sonnet 4.6(read-only 調査。M12〜M14-RESEARCH 系と同方針。実使用は開発者判断) |
| レビュー | 不要(read-only。実装物が無いため機械レビュー対象なし) |
| 作成者・作成日 | 設計担当 Claude(フェーズ3 継続担当・M16 期)/ 2026-07-05 |
| 前提 | M16-overview v1.0.0 §2.1/§4.4/§4.5・phase3-overview v1.1.2 §2.4 G-i / §M16 ④/④'/④''。背景=M16-04(G-i=レシピ taxonomy 明文化＋移動 system move 登録＋④'' dash 二重表現一本化)は既存レシピ同一性・FR301 dup に波及する最重の破壊的移行。移行計画を書く前に、**移動 move の seed/UI 実態・modifier.type dash の実コード/実データ所在・dash→move 移行の dup 衝突を read-only で実測**する。M16-01/02/03(G-g/G-f/G-h)とは独立・並行可 |
| 主参照 | code-facts §8(model.Combo/ComboStep/Modifiers・Move)・§7-2(StepRequest/CheckDuplicateRequest/CreateRequest)・§9(combo repository・**DuplicateKey**)・§4(combo ルート↔ハンドラ・`CheckDuplicate`/`GetRecipe`)・§2(features/combo フック・queryKey)・§10(マイグレ/DDL・seed 一覧)、DES-003 §3.3(moves category・move_code)・§3.4(combos・recipe_cache)・§3.5(combo_steps・move_id NULL・modifiers.type)、DES-004 §2.1(移動 system move・「1入力=1move」原則 line 105)・§2.3(modifiers.type 一覧)、SUPP-001 §3.3.0(Modifiers 構造体・recipe_hash 言及)・§3.3.2(ジャンプ move・レシピ表記ルール)・§3.3.3(非技 type=dash)、architecture-patterns §9.2(recipe_cache 再生成)、retrospective-digest §1-A/§4/§5 |

## 更新履歴

| 版 | 更新日 | 更新内容 |
|----|--------|----------|
| 1.0.0 | 2026-07-05 | 初版。M16-04(G-i)着手前、④ 移動 move 化・④'' dash 一本化・レシピ同一性/dup の read-only 調査。 |

---

## 1. 背景と目的

### 1.1 背景

M16-04(承認ゲート **G-i**)は M16 で最重の破壊的移行であり、次を一体で扱う(M16-overview §4.4)。

- **④ taxonomy 明文化**: レシピ要素を「(a) moves 行(system 含む)／(b) 非技ステップ `modifiers.type`／(c) 隣接 move への `modifiers.flags`」のどれにするかの振り分け原則を明文化する。
- **④ 移動 move 化（FB⑦連動）**: 移動(ジャンプ・ダッシュ・歩き)を **system move**(`category="system"`)として seed/入力 UI で使えるようにする。DES-004 §2.1／SUPP-001 §3.3.2 に**定義はある**が、seed／UI で整備済みかは未確認。
- **④'' dash 二重表現一本化**: dash は **canonical = system move `dash_forward`/`dash_back`**(DES-004 §2.1・CHANGE-048)。一方 **`modifiers.type` にも dash 表現が併存**(DES-004 §2.3 の `dash` 単値／SUPP-001 §3.3.3 の `dash_forward`/`dash_back` 方向別)。M16-04 で modifier.type dash を廃止し既存データを system move へ移行する。

この移行は **combo_steps の構造と modifiers を変える**ため、**既存レシピの同一性（FR301 重複判定）に波及**し得る(dash 表現のみ異なる 2 コンボが移行後に同一レシピへ収束し dup 衝突する可能性)。移行計画(M16-04 指示書)を書く前に、**実 SQL / 実コードで実態を確定**する。とくに **dup 衝突の有無・件数を dev DB で実測**することが本調査の核心である。

### 1.2 目的

下記 §4 の A〜E を **実 SQL / 実コード / 実データの view・grep で確認**し、§5 の様式で報告する。報告は M16-04(G-i=移動 move 化・dash 一本化・taxonomy)と M16-05(④' target_combo)のスコープ確定と、開発者の Plan Mode 判断の入力になる。

### 1.3 この調査でやらないこと(read-only 厳守)

- 実装・マイグレーション作成/編集・seed 変更・データ変更・コード変更を**一切行わない**。**modifier.type dash の実際の移行はしない**(C-3 は「移行を仮定した照合クエリ」を read-only で走らせるのみ・データは書き換えない)。
- taxonomy 原則・dash 一本化方式・dup 衝突処理の**最終決定をしない**(材料提示のみ。決定は M16-04 の Plan Mode で開発者)。
- 設計書本体(DES/REQ)・SUPP・overview を変更しない(本サブは CHANGE 起票対象外。反映は M16-04/05 側で要否判断・設計担当が CHANGE 起票)。

---

## 2. 成果物

### 2.1 作成するファイル
- `docs/progress/phase3/M16-RESEARCH-01-report.md`(調査報告。§5 の様式)。

### 2.2 変更しないもの
- combomgr 全ソース・全マイグレ・全 seed・全データ・DES/REQ/SUPP/overview 本体・テスト(read-only)。dev DB はクエリ実行(SELECT のみ)は可・**書き込み(INSERT/UPDATE/DELETE/DDL)は禁止**。

---

## 3. 前提条件

### 3.1 必読ドキュメント
- **code-facts §8**(`model.Combo`・`ComboStep`・`Modifiers`〔Flags/Type/Notes〕・`Move`)・**§7-2**(`StepRequest`・`CheckDuplicateRequest`・`CreateRequest`)・**§9**(combo repository・**`DuplicateKey`**)・**§4**(combo ルート↔ハンドラ=`CheckDuplicate`/`GetRecipe`)・**§2**(features/combo フック・queryKey)・**§10**(マイグレ一覧・DDL・seed=000004 seed_moves_ryu 等)。
- **DES-003 §3.3**(moves category 列挙・move_code)・**§3.4**(combos・recipe_cache 遅延計算)・**§3.5**(combo_steps・move_id NULL 可・「非技ステップは modifiers.type で識別」)。
- **DES-004 §2.1**(移動・ジャンプ動作の system move 表・**「1入力=1move」原則 line 105**・CHANGE-048 で dash_forward/dash_back 追記)・**§2.3**(modifiers.type 一覧=parry_drive_rush/cancel_drive_rush/**dash**)。
- **SUPP-001 §3.3.0**(Modifiers 構造体・**recipe_hash に言及**)・**§3.3.2**(ジャンプ move `jump_neutral`/`jump_forward`/`jump_back`＋`high_jump`・**レシピ表記ルール**=ジャンプ→攻撃は空中技＋flag で表現しジャンプ move は省略)・**§3.3.3**(非技 type=`dash_forward`/`dash_back`)。
- **architecture-patterns §9.2**(recipe_cache 再生成=`RecomputeComboCache` は combo 作成/更新/復元経由・eager・`service/notation`)。
- **retrospective-digest §1-A**(実データ実査≠仕様正典・前提の裏取り)・**§4**(表示トークン変更は recipe_cache の旧表記固定化＋全表示箇所を全数調査)・**§5**(move_code 機械置換は `dash_*`/`micro_*` を接頭辞で巻き込まない=対象 code を明示列挙／破壊的マイグレの dbtest.Setup 波及)。

### 3.2 前提事実(設計担当が code-facts / DES / SUPP から確認済み = 調査の出発点)

調査担当はこれを起点に、実 SQL / 実コードを実査する。**確認済み**と**要 RESEARCH 確定**を区別する。

**確認済み(引用元付き)**
- **combo_steps 構造**(DES-003 §3.5・code-facts §8): `ComboStep`= `MoveID *int64`(db:move_id・NULL 可)＋ `Modifiers *Modifiers`(db:- ／ `combo_steps.modifiers` TEXT に JSON 保存)。非技ステップは `move_id=NULL`＋`modifiers.type` で識別。
- **Modifiers 構造体**(code-facts §8・SUPP-001 §3.3.0): `model.Modifiers{ Flags []string; Type string; Notes string }`(型付き struct・JSON Marshal 決定論性は recipe_hash 計算のため=SUPP §3.3.0)。
- **移動 system move の定義**(DES-004 §2.1・SUPP-001 §3.3.2): `forward`/`back`/`micro_forward`/`micro_back`/`dash_forward`/`dash_back`/`jump_neutral`/`jump_forward`/`jump_back`(＋Viper `high_jump`)を `category="system"` で登録する方針。dash_forward/dash_back は CHANGE-048 で §2.1 表へ追記・「seed 000004/000010 に実在を M12-05 で確認」と記載。
- **dash 二重表現**: canonical=system move(DES-004 §2.1)／重複=modifier.type(**DES-004 §2.3 は `dash` 単値・SUPP-001 §3.3.3 は `dash_forward`/`dash_back` 方向別**＝DES 間でも表現が揺れている)。`parry_drive_rush`/`cancel_drive_rush` は移動でなく cancel 注釈のため modifier.type のまま正(移行対象外)。
- **dup 判定キーの一部**(code-facts §9): `DuplicateKey`(`internal/repository/combo/repository.go`)= CharacterID / StarterMoveID / Position / OpponentStance / HitType / OpponentSize。**ゲージ・起き攻めは含まない**(G-f/G-g/G-h の dup 非波及の裏付け)。`CheckDuplicateRequest`(code-facts §7-2)は上記＋ `steps []StepRequest` を持つ=**レシピ(steps)比較は DuplicateKey とは別経路**。
- **recipe_cache 再生成**(arch §9.2): `RecomputeComboCache` が combo 作成/更新/復元で eager 実行。プリセット/エイリアス変更トリガの無効化は未実装(M20)。移動 move を表示するには preset alias が要る(未定義時は DES-004 §5.3 フォールバック=move.code)。
- **seed/HEAD 状況**(code-facts §10・M14 系記録): seed=000004 seed_moves_ryu ほか。**000017 で aki/jamie/guile は完全 DELETE 済＝現行 HEAD は ryu 中心**(M14-03b 全キャラ seed は M16 後)。次マイグレ連番=000019(本 RESEARCH は作らない)。
- **M15-03 近手当て**(CHANGE-057・M15-overview §4.4): 新規入力経路の dash を system move へ寄せた(一本化は M16)。DES-005 §5.7 の区分絞り込みプルダウンに「共通システム(移動・その他)」= `nonmove:<type>` を統合。

**要 RESEARCH 確定(断定しない・本調査で実値を取る)**
- **recipe_hash / レシピ等価ロジックの実体**: SUPP-001 §3.3.0 は recipe_hash に言及するが、**code-facts に該当フィールド/関数が surface しない**。dup 判定でレシピ(steps)をどう等価比較するか(recipe_hash か・直接 step 列比較か・**modifiers.type/flags を含むか**)は**未確認**=C 群で確定。
- **modifier.type dash の実装実値**: DES-004 §2.3(単値)と SUPP-001 §3.3.3(方向別)のどちらが実コードの許容値定数/バリデーションか=**未確認**=B 群で確定。
- **移動 system move の seed/UI 整備状況**: 定義はあるが、実 seed に何が入っているか・入力 UI で move として選べるか=**未確認**=A/D 群で確定。

---

## 4. 調査項目

各項目で **実 SQL / 実コードを view し、grep で全数を取る**。code 名・関数名・件数・combo_id は**実値**で報告する(要約・推測・記憶で埋めない)。確認不能は「未確認」と明記。**移動/system code は接頭辞・部分一致で巻き込まず、対象 code を完全一致で明示列挙する**(digest §5・M12-7)。

### A. 移動 system move の seed / 実データ実態(④・FB⑦)

- **A-1**: DES-004 §2.1／SUPP-001 §3.3.2 の移動 system move を**完全一致 code で列挙**(`forward`/`back`/`micro_forward`/`micro_back`/`dash_forward`/`dash_back`/`jump_neutral`/`jump_forward`/`jump_back`／`high_jump`)。各 code について、実 seed マイグレ(000004 seed_moves_ryu 等)と実 DB(`SELECT code, character_id, category FROM moves WHERE category='system'` 等)で**存在するキャラ・seed 出自**を照合。存在しない code は「未 seed」と明記。ryu 以外は現状 HEAD で不在の見込みだが**決め打ちせず実 DB で確認**。
- **A-2**: A-1 の移動 move を `combo_steps.move_id` で参照する実データ件数を **code 別**に集計(`SELECT m.code, COUNT(*) FROM combo_steps cs JOIN moves m ON cs.move_id=m.id WHERE m.category='system' GROUP BY m.code`)。参照ゼロなら「参照なし」。
- **A-3**: `high_jump`(Viper 固有・SUPP §3.3.2)の扱い(seed 管理か tool 取込か・現行 HEAD の有無)を確認。

### B. dash 二重表現の実コード / 実データ実態(④''・移行対象特定)

- **B-1**: `modifiers.type` の**許容値の実定数/バリデーションを grep 全数特定**。(i) Go 側(`internal/**` で `"dash"` / `"dash_forward"` / `"dash_back"` / `parry_drive_rush` / `cancel_drive_rush` を含む定数・enum・switch・validation)、(ii) FE 側(`web/src/**` の modifier.type 選択肢・`ModifiersEditor`・`nonmove:<type>` 生成箇所)。**DES-004 §2.3(`dash` 単値)と SUPP-001 §3.3.3(`dash_forward`/`dash_back` 方向別)のどちらが実装か**を実値で確定(両方混在も報告)。
- **B-2**: 既存 `combo_steps.modifiers`(JSON TEXT)に **type=dash 系を持つ行の実件数**を dev DB で実測(`SELECT ... WHERE json_extract(modifiers,'$.type') IN ('dash','dash_forward','dash_back')` 等)。**値の分布**(単値 `dash` か方向別か)・combo_id 一覧・step_order を報告。setup_steps 側も同様に確認。
- **B-3**: **system move dash を move_id で参照する** combo_steps の実件数(A-2 の dash_forward/dash_back 部分)。B-2(modifier.type dash)との対比で**二重表現の混在度**を示す。
- **B-4**: M15-03 近手当て(CHANGE-057)の実態=**現行入力 UI で dash を新規入力すると system move / modifier.type のどちらで保存されるか**を実コードで確認(DES-005 §5.7 の「共通システム(移動・その他)」`nonmove:<type>` 経路が dash をどちらに載せるか)。新規経路が canonical(system move)準拠かを確定。

### C. レシピ等価 / FR301 dup の実態と dash 移行の衝突実測(④'' の核リスク・最重要)

- **C-1**: dup 判定の**レシピ(steps)等価ロジックを実コードで特定**。`combo.Handler.CheckDuplicate`(code-facts §4)→ service →repository の経路を view し、`DuplicateKey`(character/starter/position/stance/hitType/size)に加えて **steps をどう比較するか**を確定: (i) **recipe_hash が実在するか**(算出関数・保存列/計算のみ・**hash 対象に move_id / step_order / modifiers.type / modifiers.flags のどれが入るか**)、(ii) recipe_hash が無ければ steps を直接列比較する実装か。SUPP-001 §3.3.0 の recipe_hash 言及と実コードの一致/乖離を報告。
- **C-2**: **dup 判定に `modifiers.type` が含まれるか**を確定(含まれれば dash 表現差=別レシピ扱い→移行で衝突し得る／含まれなければ既に同一視されている可能性)。`modifiers.flags`・`modifiers.notes` の dup 参加有無も併せて報告。
- **C-3**: **modifier.type dash → system move dash 移行を仮定した dup 衝突を dev DB で read-only 実測**。B-2 で得た「modifier.type dash を持つコンボ」それぞれについて、「その dash ステップを system move dash_forward/dash_back に置換したレシピ」が、**同一 DuplicateKey(character/starter/position/stance/hitType/size)＋同一 steps を持つ既存の別コンボ**と一致するかを SQL で照合(**実データは書き換えず、SELECT による仮定照合のみ**)。**衝突する combo_id ペア・件数を列挙**。衝突ゼロなら「衝突なし」。単値 `dash` を方向別へ寄せる場合に方向が一意に決まらない行があれば、それも「方向不定=手当て要」として列挙。
- **C-4**: **recipe_cache への影響**(digest §4・M12-2)。dash を含むコンボの `recipe_cache`(TEXT)に dash の表示文字列がどう固定化されているかをサンプル抽出。移行後に `RecomputeComboCache`(arch §9.2)で再生成する際、移動 move の **preset alias が未定義だと DES-004 §5.3 フォールバック(move.code 直出し)になる**箇所を確認(alias 整備=M14-03b seed 契約の要否材料)。

### D. 入力 UI の移動 / dash 露出実態(④ seed/UI enable 範囲確定・FB⑦)

- **D-1**: 編集画面(`RecipeBuilder`・`ModifiersEditor`・DES-005 §5.7「共通システム(移動・その他)」`nonmove:<type>` プルダウン)で、移動(jump/dash/micro/forward/back)が**どう入力されるか**の実態を実コードで確認。move として選べるか・modifier.type としてか・そもそも UI に露出しているか。
- **D-2**: FB⑦=`jump_neutral`/`jump_forward`/`jump_back` が**入力 UI で move として選択可能か**を確認(不可なら「未露出」)。SUPP-001 §3.3.2 のレシピ表記ルール(ジャンプ→攻撃は空中技＋flag・純移動ジャンプのみ move)が UI/実データで守られているか(空中攻撃ステップに `neutral_jump`/`forward_jump` flag が付く運用か=DES-004 §2.3 の M15-03 追加 flag)。

### E. ④' target_combo の分類実態(M16-05 準備・軽量)

- **E-1**: `category='target_combo'` の moves 行の実件数と、`tc_<番号>` code の使用実態(dev DB・seed)を確認。段数付き特殊技が現状 normal/unique の category で取り込まれている実データの有無(DES-003 §3.3・DES-004 §2.1・CHANGE-026=「段数付き行は所属セグメントの category で取込・`tc_<番号>` は FR703 手動分類用に温存」)。**本項は M16-05 の入力・軽量**(全数悉皆でなく実在確認レベル)。

---

## 5. 報告様式(`M16-RESEARCH-01-report.md`)

各調査項目 A〜E について、以下を記す:

1. **実態**(view / grep / SQL の結果。code 名・関数名・件数・combo_id は実値)。
2. **契約・正典との差**(DES-003 §3.3/§3.4/§3.5・DES-004 §2.1/§2.3・SUPP-001 §3.3.0/§3.3.2/§3.3.3 との乖離。とくに dash 単値 vs 方向別・recipe_hash の言及 vs 実装)。
3. **M16-04(G-i)/M16-05 スコープへの含意**(dash 廃止の実コード是正範囲・dup 衝突処理の要否と規模・移動 move の seed/UI enable 範囲・recipe_cache 再生成の要否・target_combo 正典化の対象)。
4. **推奨**(複数案がある場合は playbook §13.4 の形式で併記。決定はしない)。

末尾に **「M16-04/05 スコープ確定のための要決定事項」**を番号付きで集約する(dash canonical=方向別 system move への一本化に伴う実コード是正点／dup 衝突の処理方針〔検出→提示 の対象件数〕／方向不定 `dash` 行の手当て／移動 move の seed・UI enable 範囲／recipe_cache 再生成と alias 整備〔M14-03b seed 契約連動〕／target_combo 正典化の対象行)。

---

## 6. 完了条件(Definition of Done)

- §4 A〜E の全項目を、実 SQL / 実コード / 実データの **view・grep・SELECT で確認**して報告した。
- code 名・関数名・件数・combo_id を**実値**で報告した(要約や記憶で代替していない)。確認できなかった点は「未確認」と明記し、推測は「推測:〜」と明示した。
- **C-1 でレシピ等価ロジック(recipe_hash の実在/対象 or 直接 step 比較)が確定**し、**C-3 で dash 移行を仮定した dup 衝突件数・combo_id ペアが実測**されている(移行安全性を判断できる粒度)。
- **移動/system code を接頭辞で巻き込まず完全一致で列挙**した(digest §5・M12-7)。
- read-only を逸脱していない(実装・マイグレ・seed/データ/コード変更・DES/REQ/SUPP 変更がゼロ。dev DB は SELECT のみ・書き込みなし)。
- §5 末尾の「要決定事項」が、M16-04(G-i)/M16-05 修正指示書の Plan Mode 入力として使える粒度でそろっている。

---

## 7. 参照ドキュメント

- code-facts(最新生成版)§8/§7-2/§9/§4/§2/§10。
- DES-003 §3.3/§3.4/§3.5、DES-004 §2.1/§2.3、SUPP-001 §3.3.0/§3.3.2/§3.3.3。
- architecture-patterns §9.2(recipe_cache 再生成)。
- M16-overview v1.0.0 §2.1/§4.4/§4.5、phase3-overview v1.1.2 §2.4 G-i/§M16、retrospective-digest §1-A/§4/§5。

---

## 開発者への確認事項

1. **サブ命名**
   何を: 本調査を `M16-RESEARCH-01` とする(M16-overview §3・model-allocation v1.29.0 に記載)。
   なぜ: RESEARCH 運用(調査=Sonnet/実装=Opus 分離)の慣例に沿う。
   暫定案: `M16-RESEARCH-01` で確定。

2. **dev DB の状態と dup 衝突実測の母集団**
   何を: C-3 の dup 衝突実測は現行 dev DB(HEAD=ryu 中心・少量・開発者本人のコンボ)で行う理解でよいか。母集団が小さいため「衝突ゼロ」でも M14-03b(全キャラ seed)後に再確認が要る旨を report に明記させる方針でよいか。
   なぜ: 現行データは少量で、全キャラ seed 後にデータ量が増える。衝突評価の母集団を明示しないと過小評価になる。
   暫定案: 現行 dev DB で実測＋「全キャラ seed 後の再確認要」を report に明記。

3. **実行タイミング**
   何を: 本 RESEARCH を M16-01(G-g)と**並行で先行**させてよいか(read-only・G-g/G-f/G-h に非依存)。
   なぜ: 本調査の出力は M16-04(G-i)の前提であり、G-i より前に固めたい。G-g/G-f/G-h とは独立。
   暫定案: M16-01 と並行 or 先行で着手。report 受領後に M16-04 の移行計画・Plan Mode 入力とする。

---

*以上、M16-RESEARCH-01 調査指示書 v1.0.0。配置 `docs/instructions/phase3/M16-RESEARCH-01-taxonomy-dash-dup-survey.md`。本調査の report が M16-04(④ 移動 move 化・④'' dash 一本化・taxonomy)・M16-05(④' target_combo)修正指示書のスコープ確定入力となる。read-only 厳守(dev DB は SELECT のみ・実際の dash 移行はしない)。*
