# 指示書 M14-RESEARCH-01: 公式データ配布是正・スキーマ整理・取込画面廃止の着手前調査

| 項目 | 内容 |
|------|------|
| 文書ID | M14-RESEARCH-01 |
| バージョン | 1.1.0 |
| 種別 | 調査指示書(read-only。実装・マイグレ作成/編集・コード変更・seed 変更・ファイル移動を一切行わない) |
| 対象 | 製造担当 Claude Code |
| モデル | Sonnet 4.6(read-only 調査。M12/M13-RESEARCH 系と同方針。実使用は開発者判断) |
| レビュー | 不要(read-only。実装物が無いため機械レビュー対象なし) |
| 作成者・作成日 | 設計担当 Claude(フェーズ3 キックオフ担当)/ 2026-06-28 |
| 前提 | phase3-overview v0.3.0 §M14。M13(export=安全網)後の着手が望ましいが、read-only 調査のため M13-RESEARCH-01 と並行可。背景=公式フレームデータ HTML 配布禁止 → 配布データ手入力・DB 同梱・取込画面廃止(技編集温存)・取込前提列の見直し |
| 主参照 | code-facts §10(マイグレ/DDL)・§4(move/movesimport ハンドラ)・§7(DTO)・§8(Move model・raw_data)・§9(move repository)・§3(フロントルート 画面17/18)・§2(import/moves feature・queryKey)、DES-003 §3.3(moves 列・raw_data 構造)・§7(マイグレ方針)、DES-002 §4.2(取込エンドポイント)・§7.5(CSV 契約・正規化責務)、DES-005 §5.17(画面17)・§5.18(画面18)、REQ-001 FR701/703/704、followup-backlog §C、retrospective-digest §5 |

## 更新履歴

| 版 | 更新日 | 更新内容 |
|----|--------|----------|
| 1.0.0 | 2026-06-28 | 初版。フェーズ3 M14 着手前、配布是正・スキーマ整理・取込画面廃止の調査。 |
| 1.1.0 | 2026-06-28 | 開発者回答反映: 配布対象=**SF6 全キャラクター**(手入力同梱・ツールで公式 HTML 突合。モダンは phase3 にモダン対応を含む場合のみ)・`moves-input-tool` 同梱の `SPEC-fr704-intake.md`(FR704 取込規則の「正」)/`INTAKE.md`/`CODE-FACTS.md` を必読・調査起点に追加・確認事項 Q2/Q3 を解決済みに更新。 |

---

## 1. 背景と目的

### 1.1 背景

公式フレームデータの HTML は**配布禁止**であることが判明した(開発者確定 2026-06-28)。友人間配布は許容だが、**OSS 配布には是正が必須**。方針は次のとおり:

- HTML 由来 CSV は**検証用に限定**し、**配布データは開発者手入力**とする。手入力の手間軽減ツール(`autopilot-combomgr/projects/moves-input-tool`、CSV 出力、未動作確認、**旧式の可能性**)は作成済み。
- combomgr 側で**フレームデータ取込前提となっている一部の列/テーブルを見直し(場合によっては削除)**する。
- **取込画面を廃止**し、**最初から全キャラデータが DB に入った状態で配布**する(技編集は残す)。最終ゴール=取込パイプラインの**完全削除**だが、技編集(温存)との共有経路巻き込み回避のため**段階削除**を推奨(phase3-overview §M14-02)。

このため M14 の修正指示書(M14-01 列見直し/削除・M14-02 取込削除・M14-03 配布 DB 同梱)を書く前に、**read-only 調査で実態を確定**する。M13-RESEARCH-01 と同様、外部成果物(ツール)と本体の両面を実査するが、本サブの主対象は**本体(combomgr)側のスキーマ・取込/技編集経路・配布 seed**である。

### 1.2 目的

下記 §4 の A〜G を**実 SQL / 実コード / 実テストの view・grep で確認**し、§5 の様式で報告する。報告は M14-01〜03 のスコープ確定(温存/削除の境界・取込削除の段階・配布 seed 方式・CHANGE 範囲)と、開発者の Plan Mode 判断の入力になる。

### 1.3 この調査でやらないこと(read-only 厳守)

- 実装・マイグレーション作成/編集・列/テーブル削除・seed 変更・コード変更を**一切行わない**。
- 削除/温存・取込の完全削除 vs 残置・配布 seed 方式の**最終決定をしない**(材料提示のみ。決定は Plan Mode で開発者)。
- 設計書本体(DES/REQ)を変更しない(本サブは CHANGE 起票対象外。反映は M14-01〜03 側で要否判断・CHANGE 起票)。
- 手入力ツールのビルド・実行はしない(CSV・コードの静的 view・grep のみ)。

---

## 2. 成果物

### 2.1 作成するファイル
- `docs/progress/M14-RESEARCH-01-report.md`(調査報告。§5 の様式)。

### 2.2 変更しないもの
- combomgr 全ソース・全マイグレ・全 seed・DES/REQ 本体・テスト、および `autopilot-combomgr` 配下の全ファイル(read-only)。

---

## 3. 前提条件

### 3.1 必読ドキュメント
- **code-facts §10**(マイグレ一覧/DDL = DB スキーマ一次情報)・**§4**(move / movesimport のルート↔ハンドラ)・**§7**(Response/入力 DTO)・**§8**(Move model = `raw_data` 含む)・**§9**(move repository = `UpdateMoveFields` 等)・**§3**(フロントルート 画面17/18)・**§2**(`features/import`・`features/moves` のフック/queryKey)。
- **DES-003 §3.3**(moves 列定義・`raw_data` 確定キー構造)・**§7**(マイグレ方針・命名規則)。
- **DES-002 §4.2**(取込エンドポイント)・**§7.5**(FR704 CSV 契約・正規化責務分担)。
- **DES-005 §5.17**(画面17 取込プレビュー = 削除対象)・**§5.18**(画面18 技編集 = 温存対象)・§4.1(導線)。
- **REQ-001 FR701/FR703/FR704**(取込ツール・手動修正・本体取込の関係)。
- **followup-backlog §C**(M14 論点)・**retrospective-digest §5**(破壊的マイグレ × `dbtest.Setup`、FK=OFF×明示 DELETE)。
- **手入力ツール同梱資料**(`autopilot-combomgr/projects/moves-input-tool` 直下・**存在確定**): **`SPEC-fr704-intake.md`(= moves 手入力支援ツール / FR704 取込規則の「正」= 参照仕様・転記用)** を**最優先で読む**(取込規則の正典)。あわせて `INTAKE.md`・`CODE-FACTS.md` も調査起点として読む。これらは G-1 の CSV/突合照合と A/B/C の取込規則理解の起点。

### 3.2 前提事実(設計担当が code-facts / DES から確認済み = 調査の出発点)

調査担当はこれを起点に、実 SQL / 実コードを実査する。

- **取込(FR704)= 削除対象候補**: `movesimport` ドメイン(`Preview`=`POST /api/import/moves/preview`、`Commit`=`POST /api/import/moves`)、フロント `web/src/features/import`(`useImportMovesPreview`/`useImportMovesCommit`、invalidate `["moves"]`)、画面17(`/import/moves`=ImportMovesPage、DES-005 §5.17)。
- **技編集(FR703)= 温存対象**: `move` ドメイン(`List`/`Get`/`Update`=`PATCH /api/moves/:id`/`GenerateRushVariant`=`POST /api/moves/:id/rush-variant`)、フロント `web/src/features/moves`(MoveEditGrid、`useMovesByCharacter`/`useMoveDetail`/`useUpdateMove`/`useGenerateRushVariant`、invalidate `["move", id]`)、画面18(`/moves/edit`=MovesEditGridPage、DES-005 §5.18)。
- **前後端ともディレクトリ/ドメインは分離済み**(画面17/18 は CHANGE-031 で別系統化)。ただし両者は **moves テーブル**と **`["moves"]` queryKey 名前空間**を共有する。**`movesimport.Commit` の upsert が `move` の repository を共有するか独自実装かは未確認**(本調査で確定 = 削除安全性の核心)。
- **moves 列**(000001 init + 000013 add_moves_frame_columns): `startup`/`active`/`total`/`on_hit`/`on_block`/`drive_gauge_decrease_guard`/`is_aerial`/`setup_only` + `combo_scaling`/`drive_gauge_increase`/`drive_gauge_decrease_punish`/`super_art_gauge_increase`/`properties`/`damage`/`raw_data`。これらはフレームデータ由来だが、**手入力でも投入・技編集でも編集・コンボ表示でも使用**される ⇒ **大半は温存が前提**。削除候補は「**取込パイプライン専用**」に絞られる(例: `raw_data` の取込専用サブキー、取込時算出・正規化ロジック)。
- **`raw_data`**(JSON、DES-003 §3.3): `notes`/`notes_tool`/`command`/`condition_ja`/`condition_en`/`properties_extra`/`import_notes`。FR703 編集器がパース。フェーズ2 では保持のみ(消費未実装)。`notes_tool`/`import_notes`/`command`/`condition_*`/`properties_extra` は**取込由来の退避キー** ⇒ 手入力配布で要否を問う対象。
- **現行 moves データの由来**: seed = 000004(ryu)・000010(aki/jamie/guile、000017 で整理)。**classic5 のうち ken/ingrid/c_viper/dalsim の moves は取込(FR704)由来**(seed に無い。000014 は characters 行のみ)。
- **配布対象 = SF6 全キャラクター**(開発者確定 2026-06-28)。配布データは**全キャラ手入力**を DB 同梱(現状の seed/取込済みは一部のみ ⇒ 全キャラ分の配布 seed 投入が必要 = 大きなギャップ)。手入力ミス防止に、**手入力データを公式 HTML 取得データとツールで突合**して検証する運用見込み(HTML は配布せず検証専用)。**モダン操作版**は phase3 にモダン対応(ISSUE-007)を含める場合のみ対象(現 phase3-overview §2 では含まない=フェーズ4。含めるかは別途スコープ判断)。
- **次マイグレ連番 = 000018**(最新 000017 の次。命名規則 `NNNNNN_description.{up,down}.sql`、DES-003 §7)。
- **配布健全化**: 配布物(リポジトリ・同梱 DB)から**配布禁止 HTML・HTML 由来検証 CSV を除外**する必要(OSS)。検証データは dev/test 限定に隔離。
- 本体ライセンス MIT(DES-001 §5)。

---

## 4. 調査項目

各項目で **実 SQL / 実コードを view し、grep で全数を取る**。列名・関数名・件数・CSV 列は**実値**で報告する(要約・推測で埋めない)。確認不能は「未確認」と明記。

### A. moves / 関連スキーマの「取込専用 vs 温存」切り分け

- **A-1**: moves の**全列を列挙**し、各列を「(温存)手入力/技編集/表示で必要」「(削除候補)取込パイプライン専用」に分類。判断根拠を実コード(技編集 `UpdateMoveFields`・表示 DTO・コンボ表示)で示す。**大半は温存になる見込み**だが、決め打ちせず実コードで裏取り。
- **A-2**: `raw_data` の確定キー(`notes`/`notes_tool`/`command`/`condition_ja`/`condition_en`/`properties_extra`/`import_notes`)のうち、**取込専用(手入力配布で不要化しうる)**ものを特定。FR703 編集器が実際にパース・編集に使うキーと、取込時のみ書かれるキーを区別。
- **A-3**: **取込専用テーブル/構造**が存在するか(import staging・tracking 等)を全数確認(なければ「なし」)。`preset_aliases`(official_ja_move)は取込 commit で投入されるが**表示(技名)に必要 = 温存**。手入力配布での投入経路(seed か手入力か)を確認。
- **A-4**: **取込時のみ走る変換**を列挙(`total` 取込時算出〔DES-003 §3.3、`total=発生+持続-1+硬直`〕・`properties` コード値正規化・category 写像・on_hit/on_block 退避)。手入力配布でこれらが不要化/別経路化するか・温存すべきかを評価。

### B. 取込↔技編集の共有経路切り分け(削除安全性の核心)

- **B-1**: `movesimport`(Preview/Commit)の **service/repository を特定**し、`move` の repository(`UpdateMoveFields` 等)を**共有するか独自 upsert か**を実コードで確認(`grep -rn` でハンドラ→サービス→リポジトリを追う)。
- **B-2**: 取込 commit の upsert 経路(characters → moves → preset_aliases)で使う関数のうち、**技編集(FR703)も使う共有関数を全数特定**。取込専用関数(削除可)と共有関数(温存)の**境界を確定**(playbook §4.7 全ハンドラ列挙 / M11-1 経路全 view と同型)。
- **B-3**: フロント `features/import` 削除時、`features/moves`(技編集)が依存する**共有コンポーネント/フック/型/queryKey**(`["moves"]` invalidate の相互作用含む)が壊れないかを確認。共有物があれば温存対象として明示。
- **B-4**: 画面17 削除に伴う**ナビ導線の波及**(DES-005 §4.1 ヘッダ・「設定」配下・commit 後遷移=CHANGE-033)。画面18(技編集)の導線が画面17 を経由していないかを確認(経由していれば代替導線が要る)。

### C. 取込パイプライン削除のスコープ(段階削除の材料)

- **C-1**: **削除対象の全数列挙**: `movesimport` ドメイン(handler/routes/service/repo/dto)、`/api/import/moves`・`/preview`、`features/import`、画面17(ImportMovesPage・`/import/moves` ルート)、関連 test(E2E/unit)。
- **C-2**: 「**完全削除**」と「**dev/検証専用に残置**」の差・リスクを整理。検証 CSV(HTML 由来)を検証用に使い続ける運用があるなら、取込経路を dev/test 限定で残す選択肢の有無と、その場合の配布物からの除外方法。
- **C-3**: **REQ-001 FR704・DES-002 §4.2/§7.5・DES-005 §5.17 の改訂範囲**(降格 or 削除)を見立てる(CHANGE 対象=REQ+DES。起票は M14 修正サブ)。FR701(別ツール)/FR703(技編集)への波及有無も併記。

### D. 列/テーブル削除の破壊的マイグレ評価

- **D-1**: A-1 で確定した削除候補列の破壊的マイグレを、000016 の**非破壊テーブル再構築技法**(migrate 接続 FK=OFF〔modernc 既定〕+ 一時名経由)で行う要否を評価。`raw_data` サブキー削除は**列削除でなく JSON 更新**で済む可能性に留意。
- **D-2**: `dbtest.Setup`(全マイグレ適用)への波及と、既存マイグレテスト(`migrate_test.go` の round-trip 等)への波及を机上評価(retrospective-digest §5)。**FK=OFF と明示 DELETE を同一指示書に同居させない**(M12-5)前提を確認。
- **D-3**: combos/combo_steps/setup_steps/preset_aliases から moves(列・行)への**参照 FK・依存**を全数確認。削除で壊れる箇所を列挙。

### E. 配布 DB 同梱(手入力データの seed 投入)

- **E-1**: **現行 moves データの由来をキャラ別に確定**(seed 000004/000010/000017 vs 取込由来)。classic5(ryu/ken/ingrid/c_viper/dalsim)+ 既存 seed キャラ(aki/jamie/guile)の moves が seed にあるか取込必須かを実 seed/実 DB で確認。**配布対象=SF6 全キャラ**に対し、現状で seed/取込済みのキャラと**未投入キャラのギャップ(全キャラ分の手入力 seed が要る範囲)**を明示。
- **E-2**: **配布 DB 同梱の方式**: **全キャラ moves**を手入力データから **seed マイグレで投入する形**を、現行 seed 構造(000004 等)と整合する形で評価。手入力ツール CSV を seed へ変換する経路の要否(手書き seed か・CSV→seed 変換か)。大量キャラ分を扱うため、seed の生成・保守方式(1 キャラ 1 マイグレ vs 一括 等)の選択材料も提示。
- **E-3**: 配布対象の **characters/custom_states/preset_aliases** も全キャラ分の同梱が要るか(moves だけでなくキャラ・エイリアス・プリセットの配布 seed 整合)。000009/000014/000015 等の現状と、**配布対象=全キャラ**を突合し未整備範囲を列挙。モダン版を含む場合の追加(同一キャラのモダン操作差分の持ち方)は、phase3 にモダンを含めるか次第のため**条件付きで論点提示**(決定は別途)。

### F. 配布健全化(配布禁止 HTML・検証 CSV の除外)

- **F-1**: リポジトリ/配布物に**配布禁止 HTML・HTML 由来 CSV が含まれるか**を全数 grep(`testdata`/`fixtures`/`seed`/`docs`/サンプル等)。配布物(同梱 DB・リポジトリ・バイナリ)から除外すべきものを列挙し、検証データを dev/test 限定に隔離する現状(または不在)を報告。

### G. 手入力ツール CSV 照合(`moves-input-tool`)

- **G-1**: `autopilot-combomgr/projects/moves-input-tool` を実査。**まず `SPEC-fr704-intake.md`(FR704 取込規則の「正」)・`INTAKE.md`・`CODE-FACTS.md` を読み**、ツールが準拠する取込規則を要約。そのうえで **CSV 列・出力形式**を実査し、(i) `SPEC-fr704-intake.md` の規則、(ii) 本体の現行 CSV 契約(DES-002 §7.5・CHANGE-022/023/025〜027)、(iii) 現行 moves 列(§3.2)、の三者と突合。**旧式の可能性**(開発者注記)を念頭に、列名・並び・セマンティクスの乖離(SPEC と本体契約の差を含む)を**全数**報告。
- **G-2**: ツールの**公式 HTML 突合(手入力データの検証)機能**の有無・方式を実コードで確認(手入力ミス防止の QA を担う見込み=開発者注記)。突合の入力(HTML)・基準・出力(差分レポート等)を実態で報告。**ツールのビルド/実行はしない**(静的 view のみ)。

---

## 5. 報告様式(`M14-RESEARCH-01-report.md`)

各調査項目 A〜G について、以下を記す:

1. **実態**(view / grep の結果。列名・関数名・件数・CSV 列は実値)。
2. **契約・正典との差**(DES-003 §3.3 / DES-002 §4.2・§7.5 / DES-005 §5.17/§5.18 / FR704 との乖離)。
3. **M14-01〜03 スコープへの含意**(温存/削除の境界・段階削除の順序・配布 seed 方式・CHANGE 範囲をどう確定づけるか)。
4. **推奨**(複数案がある場合は playbook §13.4 の形式で併記。決定はしない)。

末尾に **「M14-01〜03 スコープ確定のための要決定事項」**を番号付きで集約する(削除可能列/サブキーの確定・取込の完全削除 vs dev 残置・配布 seed 方式・dbtest 波及と破壊的マイグレ技法・ツール CSV の新旧是正要否・REQ/DES の CHANGE 範囲・配布対象キャラ範囲)。

---

## 6. 完了条件(Definition of Done)

- §4 A〜G の全項目を、実 SQL / 実コード / 実テスト + ツール CSV の **view・grep で確認**して報告した。
- 列名・関数名・件数・CSV 列を**実値**で報告した(要約や記憶で代替していない)。確認できなかった点は「未確認」と明記し、推測は「推測:〜」と明示した。
- **取込↔技編集の共有経路の境界**(B 群)が、削除安全性を判断できる粒度で確定している。
- read-only を逸脱していない(実装・マイグレ作成/編集・seed/コード変更・DES/REQ 変更・ツールのビルド/実行がゼロ)。
- §5 末尾の「要決定事項」が、M14-01〜03 修正指示書の Plan Mode 入力として使える粒度でそろっている。

---

## 7. 参照ドキュメント

- code-facts(最新生成版)§10/§4/§7/§8/§9/§3/§2。
- DES-003 v1.22.0 §3.3/§7、DES-002 v1.24.0 §4.2/§7.5、DES-005 v2.26.0 §5.17/§5.18/§4.1、DES-001 v1.3.0 §5(MIT)。
- REQ-001 v2.15.0 FR701/FR703/FR704。
- phase3-overview v0.3.0 §M14、followup-backlog(フェーズ3)§C、retrospective-digest §5。
- 手入力ツール: `autopilot-combomgr/projects/moves-input-tool`(別リポジトリ・開発環境では combomgr 配下に展開。CSV 出力・旧式の可能性)。同梱: **`SPEC-fr704-intake.md`(FR704 取込規則の正)**・`INTAKE.md`・`CODE-FACTS.md`。

---

## 開発者への確認事項

**解決済み(開発者回答 2026-06-28)** — 本指示書 v1.1.0 に反映済み:
1. **サブ命名**: `M14-RESEARCH-01` で確定。
2. **手入力ツール同梱資料**: `SPEC-fr704-intake.md`(FR704 取込規則の「正」)・`INTAKE.md`・`CODE-FACTS.md` が存在。G-1 の調査起点として読ませる(SPEC を最優先・正典)。
3. **配布対象キャラ範囲**: **SF6 全キャラクター**を手入力で DB 同梱(開発者の手間は許容)。**モダン版**は phase3 にモダン対応(ISSUE-007)を含める場合のみ対象(現 overview ではフェーズ4=含まない)。手入力ミス防止に公式 HTML 突合をツールで実施見込み(HTML は配布せず検証専用)。E-1/E-3 を全キャラ前提に更新。
4. **取込「完全削除 vs dev 残置」**: report 後の Plan Mode で確定(完全削除を既定線)。
5. **model-allocation 追記**: 設計担当が実施(v1.22.0 で M13/M14 セクション新設・両 RESEARCH 記入済み)。

**残る確認事項**: なし(本指示書は確定可能な状態)。なお「モダン版を phase3 配布対象に含めるか」は phase3 スコープ判断として別途要確定(本サブは条件付きで論点提示にとどめる)。

---

*以上、M14-RESEARCH-01 調査指示書 v1.1.0。配置 `docs/instructions/M14-RESEARCH-01-distribution-fix-schema-cleanup-survey.md`。本調査の report が M14-01(列見直し/削除)・M14-02(取込パイプライン段階削除)・M14-03(配布 DB 同梱)修正指示書のスコープ確定入力となる。*
