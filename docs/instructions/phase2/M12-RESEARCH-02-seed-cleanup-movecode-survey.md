# 指示書 M12-RESEARCH-02: M12-05(seed 整理 + B-7 move_code 統一・案B)着手前調査

| 項目 | 内容 |
|------|------|
| 文書ID | M12-RESEARCH-02 |
| バージョン | 1.0.0 |
| 種別 | 調査指示書(read-only。実装・マイグレ作成・コード変更を一切行わない) |
| 対象 | 製造担当 Claude Code |
| モデル | Sonnet 4.6(read-only 調査。M12-RESEARCH-01 と同方針) |
| レビュー | 不要(read-only。実装物が無いため機械レビュー対象なし) |
| 作成者・作成日 | 設計担当 Claude(フェーズ2 本流スパイン・M12 担当)/ 2026-06-25 |
| 前提 | M12-04 完了。M12-05 スコープ = **案B 確定**(seed 整理 + B-7 を束ねる、開発者確定 2026-06-25) |
| 主参照 | code-facts §10(マイグレ一覧/DDL)・§1/§2(VirtualController)、DES-003 §3.4/§7、DES-004 §2.1、followup-backlog §B-7、m11-to-m12-handover §3-a、retrospective-digest §5 |

## 更新履歴

| 版 | 更新日 | 更新内容 |
|----|--------|----------|
| 1.0.0 | 2026-06-25 | 初版。案B 確定を受けた M12-05 着手前調査。 |

---

## 1. 背景と目的

### 1.1 背景

M12-05(検証データ / seed 整理)は当初「migration 000012 の耐久 seed 36 件(combos)を無効化マイグレで除去」という素のスコープだったが、開発者確定(2026-06-25)で **案B = seed 整理 + B-7(仮想コントローラ / seed の move_code 旧形→新形統一)を束ねる**に確定した。本サブは次の理由で **破壊的マイグレ + テスト基盤波及 + B-7 ロックステップ + FR701 再取込**が同時に絡む:

- 破壊的 seed クリアはテストハーネス(`dbtest.Setup` = 全マイグレ適用)へ波及しうる(retrospective-digest §5 / M9-1 教訓)。
- B-7(followup-backlog §B-7)は seed 移行(b)とコントローラ更新(a)が**ロックステップ必須**で、初期キャラの FR701 再取込が絡むと seed 手動移行(b)が捨て仕事化しうる。
- code-facts §10 は migration の DDL は載せるが **seed 行の中身は展開しない**(設計上の限界)。行の実値(move code が旧形か新形か・36 件の内訳・custom_states JSON)は本調査で実査する以外に確定手段がない。

このため、M12-05 の修正指示書を書く前に **read-only 調査で実態を確定**し、スコープ・マイグレ方式・dbtest 波及・B-7 範囲・FR701 段取りの判断材料をそろえる(M12-RESEARCH-01 → M12-03 と同じ調査先行パターン)。

### 1.2 目的

下記 §4 の A〜F を実 SQL / 実コード / 実テストの view・grep で確認し、§5 の様式で報告する。報告は M12-05 修正指示書のスコープ確定と、開発者の Plan Mode 方式選択の入力になる。

### 1.3 この調査でやらないこと(read-only 厳守)

- 実装・マイグレーションファイルの作成/編集、seed の変更、コードの変更を**一切行わない**。
- マイグレ方式の最終決定をしない(材料の提示のみ。決定は Plan Mode で開発者)。
- 設計書本体(DES)を変更しない(本サブは CHANGE 起票対象外。DES 反映は M12-05 修正サブ側で要否判断)。

---

## 2. 成果物

### 2.1 作成するファイル
- `docs/progress/M12-RESEARCH-02-report.md`(調査報告。§5 の様式)。

### 2.2 変更しないもの
- 全ソース・全マイグレーション・全 seed・DES 本体・テスト(read-only)。

---

## 3. 前提条件

### 3.1 必読ドキュメント
- **code-facts §10**(マイグレーション一覧 000001〜000016 + 各 up の DDL)・**§1/§2**(`VirtualController` の Props と `useControllerInput` フック)。
- **DES-003** §3.4(combos 列定義)・§7(マイグレーション方針)。
- **DES-004 §2.1**(move_code の正典 = 新形 `standing_*` / `crouching_*` / `jumping_*` / `throw_forward` / `throw_back` / `drive_parry`)。
- **followup-backlog §B-7**(B-7 の真因・必要作業 (a)〜(e)・上位計画との関係・CHANGE 不要)。
- **m11-to-m12-handover §3-a**(jamie の custom_states 乖離・aki/jamie/guile を M11 で触っていない事実)。
- **retrospective-digest §5**(破壊的マイグレと `dbtest.Setup` 波及)。

### 3.2 前提事実(設計担当が code-facts §10 から確認済み = 調査の出発点)

調査担当はこれを起点に、各 SQL ファイルの**中身**を実査する。

- マイグレ連番は 000001〜000016。本調査に直結するもの:
  - **000004** `seed_moves_ryu` / **000010** `seed_moves_aki_jamie_guile`(moves seed。B-7(b) の旧形 move_code が含まれる疑い)。
  - **000012** `seed_combos_durability`(耐久 combos seed。M12-05 の主除去対象。INSERT combos + INSERT combo_steps + 末尾 UPDATE combos)。
  - **000014** `seed_characters_classic5`(classic5 体の characters 行のみ。moves は取込由来の見込み)。
  - **000015** `seed_custom_states_classic3`(UPDATE characters。ryu/ingrid/c_viper の custom_states)。**000009** が aki/jamie/guile の characters を INSERT(custom_states 列を含む)。
  - **000016** `change_drive_damage_to_real`(テーブル再構築。非破壊技法 = migrate 接続 FK=OFF + 一時名経由)。
- code-facts は seed 行を展開しない。**move code の旧/新形・36 件の内訳・custom_states の実 JSON は本調査で実査**する。

---

## 4. 調査項目

各項目で **実 SQL / 実コードを view し、grep で全数を取る**。件数・code 文字列・JSON は**実値**で報告する(要約・推測で埋めない)。

### A. seed / migration 共存実体

- **A-1**: `migrations/000012_seed_combos_durability.up.sql` と `.down.sql` を view。INSERT される combos の **件数(36 件か)・対象 character_id・combo_steps の構成・末尾 UPDATE combos が何を更新しているか**を報告。down が何を消すかも。
- **A-2**: `000004_seed_moves_ryu` / `000010_seed_moves_aki_jamie_guile` の **moves.code を全列挙**し、DES-004 §2.1 正典(新形)と突合。旧形(`stand_*` / `forward_throw` / `back_throw` 等)が残っているものを**全数**挙げる。
- **A-3**: classic5 体のうち ken / ingrid / c_viper / dalsim の **moves が seed か取込(FR704)由来か**を実コード/実 DB で確認。取込由来なら現状の code 形式(新形=正典準拠か)を報告。ryu の moves が現状 000004(seed・旧形)に由来するのか取込済みかも確認。
- **A-4**: 000016 後の `combos.drive_damage` は REAL。000012 seed が drive_damage を INSERT しているか・その値型(整数を REAL で受けているか)・000016 のテーブル再構築後も 000012 seed が破綻なく適用されるか(マイグレ適用順 000012 → 000016 の整合)を報告。

### B. `dbtest.Setup` 波及(別スコープだが本調査で実態を確定)

- **B-1**: `dbtest.Setup` の定義箇所を特定(例 `grep -rn "func Setup" internal/ | grep -i dbtest`)し、**全マイグレを適用するか**を実コードで確認(retrospective-digest §5)。
- **B-2**: テストコードが **000012 の耐久 seed に依存していないか全数 grep**。固定の combo ID・件数(36 等)・"durability"・seed 由来の特定レコードをテストが前提にしていないか(例 `grep -rn -iE "durability|seed|36" internal/**/*_test.go web/` 等で当たりを取り、ヒットを精査)。**依存が見つかれば、その fixture 移行が M12-05 に要る旨**を含意として報告(これがあると M12-05 が単純な seed 除去で済まない)。
- **B-3**: `internal/infra/migration/migrate_test.go`(000016 の round-trip)等の既存マイグレテストに、新規の無効化マイグレ追加が**波及しないか**を机上評価(本調査では追加しないが、影響の有無を見立てる)。

### C. B-7 実装範囲(実査)

- **C-1**: `web/src/features/combo/components/VirtualController/useControllerInput.ts` の `BUTTON_TO_MOVE_CODE` の **旧形 code マッピングを全列挙**。
- **C-2**: 旧形 code(`stand_*` / `forward_throw` / `back_throw` 等、A-2 で確定した実文字列)を**参照する箇所を全数 grep**(FE / BE / seed / エイリアス・プリセット〔DES-004 §5〕/ recipe 表示 / テスト)。
- **C-3**: `combo_steps.move_id` が ID 参照で、move code 変更が**保存済みコンボデータを壊さない**こと(followup-backlog §100(d))を実コードで再確認。
- **C-4**: 新形へ統一する場合の **(a) コントローラ・(b) seed の変更点を全数列挙**(ロックステップ対象の確定)。recipe 表示やエイリアスが旧 code に依存する箇所を併記する(該当ゼロなら「ゼロ」と記す)。

### D. FR701 再取込の実現性(開発者提供情報 + 実態)

- **D-1**: 再取込対象として **CSV 作成済みのキャラ一覧**を報告に転記(開発者が提供。本調査では受領した一覧を記録する。ツールは完成済み)。
- **D-2**: 取込経路(FR704 = `/api/import/moves` 等)で再取込すると、初期キャラ(特に ryu)の `moves.code` が **新形(正典準拠)になるか**を実コードで確認。新形になるなら seed 000004(ryu moves)は捨て仕事化する範囲を特定。
- **D-3**: 再取込・seed 削除(000012 / 000004 / 000010)・custom_states(000009 / 000015)・durability combos の **順序依存と冪等性**(moves upsert キー `(character_id, code)`、DES-002 §7.x)を整理。
- **D-4**: 「**再取込なし**(コントローラ(a)+ seed(b) のロックステップ更新のみで B-7 を閉じる)」案と「**再取込で seed ごと置換**」案の比較材料(工数・捨て仕事範囲・全キャラ仮想コントローラ回帰範囲)を提示。決定はしない。

### E. マイグレ方式の選択材料(Plan Mode 用)

- **E-1**: 次連番 = **000017** を確認(code-facts §10-1 の最終連番 000016 の次)。命名規則 `NNNNNN_description.{up,down}.sql`(DES-003 §7)。
- **E-2**: 「**無効化マイグレ**(新規 000017 で 000012 の seed を DELETE = 新規 DB 構築時に投入後すぐ消える / 実質投入されない)」と「**000012 自体を編集**」の差・リスクを整理。後者は適用済み環境で再適用されない golang-migrate の性質に触れる。
- **E-3**: 000016 の**非破壊テーブル再構築技法**(migrate 接続 FK=OFF〔modernc 既定〕+ 一時名経由で `legacy_alter_table` の FK 自動書換回避)を参照テンプレートとして記載。本件の破壊的操作(seed DELETE 等)で同技法・同注意が要るかを評価。

### F. D-7 連動(複数 custom_states キャラの動作確認)

- **F-1**: `characters.custom_states` の各キャラの**実 JSON を全列挙**(000009 の aki/jamie/guile、000015 の classic3 = ryu/ingrid/c_viper、000014 で作られた classic5 のうち未設定のもの)。
- **F-2**: jamie の `drunk_level` / composite(phase-1 seed)が、正典(Drink Level / Int 0–4)と**乖離しているか**を実値で確認(m11-to-m12-handover §3-a)。
- **F-3**: **複数の custom_states を持つキャラが実在するか**を確認(D-7「特殊状態が複数あるキャラ」の対象を実値で特定。先行リリース3体 ryu/ingrid/c_viper の custom_states 構成も併記)。
- **F-4**: 先行リリース5体(ryu/ken/ingrid/c_viper/dalsim)と、5体外(jamie/aki/guile 等)の custom_states の**取り扱い選択肢**(再投入で正典化 / 行・状態の除去 / 据え置き)を整理(決定は開発者。ブランカ等の5体外追加は §開発者への確認事項 で要確認)。

---

## 5. 報告様式(`M12-RESEARCH-02-report.md`)

各調査項目 A〜F について、以下を記す:

1. **実態**(view / grep の結果。件数・code 文字列・JSON は実値)。
2. **正典との差**(DES-004 §2.1 / custom_states 正典等との乖離)。
3. **M12-05 修正スコープへの含意**(この事実が M12-05 の作業範囲をどう広げる/狭めるか)。
4. **推奨**(複数案がある場合は playbook §13.4 の形式で併記。決定はしない)。

末尾に **「M12-05 スコープ確定のための要決定事項」**を番号付きで集約する(マイグレ方式・FR701 段取り・B-7 ロックステップ範囲・dbtest fixture 移行要否・custom_states 正典化対象キャラ)。

---

## 6. 完了条件(Definition of Done)

- §4 A〜F の全項目を、実 SQL / 実コード / 実テストの **view・grep で確認**して報告した。
- 件数・move code・custom_states JSON を**実値**で報告した(要約や記憶で代替していない)。確認できなかった点は「未確認」と明記し、推測は「推測:〜」と明示した。
- read-only を逸脱していない(実装・マイグレ作成・seed 変更・DES 変更がゼロ)。
- §5 末尾の「要決定事項」が、M12-05 修正指示書の Plan Mode 入力として使える粒度でそろっている。

---

## 7. 参照ドキュメント

- code-facts(commit `5acf478`、2026-06-25 生成)§10 / §1 / §2。
- DES-003 v1.22.0 §3.4 / §7、DES-004 v1.6.2 §2.1、DES-002 v1.23.0 §7.x(取込)。
- followup-backlog §B-7 + 関連メモ、m11-to-m12-handover §3-a、M12-overview §3(M12-05)、m12-design-session-handover §3.1。
- retrospective-digest §5(破壊的マイグレ × `dbtest.Setup`)、§1 パターン A(あるはずで書かない)。

---

## 開発者への確認事項

1. **サブの命名**
   何を確認したいか: 本調査サブの ID を `M12-RESEARCH-02` で確定してよいか。
   なぜ確認が必要か: 前例は `M12-RESEARCH-01`(マイルストーン階層の連番)。M12-overview §3 と change-number-registry(本サブは CHANGE 非対象だが進行記録)・model-allocation に追記する際の ID 安定のため。
   暫定案: 前例に倣い `M12-RESEARCH-02`。別 ID をご指定の場合は `M12-05-RESEARCH` 等へ変更する。

2. **FR701 再取込の対象キャラと5体外の扱い(D-1 / F-4 連動)**
   何を確認したいか: 再取込 CSV を作成済みのキャラ一覧と、ブランカ等「先行リリース5体外」を M12-05 のスコープに含めるか。
   なぜ確認が必要か: 先行リリースの正式対象は5体(ryu/ken/ingrid/c_viper/dalsim)。5体外(jamie/aki/guile/ブランカ)の custom_states 正典化や moves 再取込を含めるかはスコープと工数に直結し、SF6 ドメイン・優先度判断のため開発者確定が要る(playbook §1.4 / §17.4)。
   暫定案: 調査は5体 + 既存 seed キャラ(aki/jamie/guile)の現状を全件実査して報告。スコープ採否(特にブランカ等の新規追加)は報告後に協議。

3. **既配布 DB の有無(E-2 のマイグレ方式評価に影響)**
   何を確認したいか: 先行リリース前の現時点で、利用者環境に既に配布済みの DB が存在するか(= 破壊的操作が既存データに当たる可能性があるか)。
   なぜ確認が必要か: 先行リリース前で「新規 DB のみ」が前提なら破壊性の意味が小さく、無効化マイグレが素直に選べる。既配布 DB があるなら移行配慮が要る。
   暫定案: 先行リリース前 = 新規 DB のみ前提で材料を整理。違えばご指摘ください。

4. **model-allocation.md 未受領**
   何を確認したいか: 本サブのモデル(Sonnet 4.6・レビュー不要)を model-allocation.md に追記したいが、同ファイルが未受領。
   なぜ確認が必要か: playbook タスクとしてモデル配分の記録責任が設計担当にあるため。
   暫定案: 本指示書メタデータに記録。model-allocation.md 受領時に M12-RESEARCH-02 / M12-05 行を追記する。

---

*以上、M12-RESEARCH-02 調査指示書 v1.0.0。配置 `docs/instructions/M12-RESEARCH-02-seed-cleanup-movecode-survey.md`。本調査の report が M12-05 修正指示書のスコープ確定入力となる。*
