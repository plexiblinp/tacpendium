# M16 期間 設計セッション継承資料（m16-design-session-handover）

| 項目 | 内容 |
|------|------|
| 文書ID | M16-DESIGN-SESSION-HANDOVER |
| バージョン | 1.5.0（2026-07-06：§3.5 判断3 を訂正＝「入力ツール」は moves-input-tool〔importer ではない〕・importer は照合専用で command のみ例外供給・moves-input-tool が公式CSVから command 自動取込→seed CSV 出力〔§9.9 verbatim〕・吸収は本体 net-new 取込スクリプト・index-only 推奨。v1.4.0＝§3.5 に判断3〔command 索引化方針〕を追記。v1.3.0＝§3.5「追加調査・判断メモ」を新設＝調査支援セッションの調査 3 件〔dash 用語二重・command 保存形式・is_aerial 消費先〕＋判断 2 件〔is_aerial 現状維持・移動系 frame 方式〕を M16-04 入力材料として記録。v1.2.0＝改訂 DES 本体の適用〔CHANGE-060〜063〕完了に伴い、DES 反映関連の記述〔旧 §0-3・§1.2(a)・§5 未適用注記・§6-1〕を除去。§0/§5/§6 に完了注記を追加。v1.1.0＝§0 に DES 反映最優先・照会可能・修正チェック・異例状態を追加/§1.3 retrospective 転記済み/§6 に 062/063 承認。v1.0.0＝初版） |
| 作成日 | 2026-07-05 |
| 作成者 | 設計担当 Claude（M16 期・前セッション） |
| 対象読者 | 設計担当 Claude（M16 期・新セッション） |
| 用途 | M16（データモデル拡充・スキーマの継ぎ目）の設計セッションを **M16-03 完了後・M16-04 着手前**で分割継承する（前セッションのコンテキスト圧迫回避＋M16-04＝G-i＝M16 最重〔破壊的 dash 移行・taxonomy・recipe_hash/FR301〕で新鮮なコンテキスト推奨）。新セッションは **M16-04 指示書作成から着手**する |
| 性質 | m15/m12/m7-design-session-handover と同型（実装サブ着手前での分割）。**標準ドキュメント（DES 各本体・registry・code-facts・恒久資料）は開発者が最新版を別途添付**するため、本書は **M16 固有の状態・確定判断・設計メモ**に絞る。※本書は m15-to-m16-handover（マイルストーン境界）とは別＝**マイルストーン内のセッション分割** |

---

## 0. 新セッション開始時の最優先作業

1. **受領確認**: 開発者から「開始時 PASTED プロンプト＋最新添付資料一式＋『M16-04 から再開』」が渡される。添付の現行版を正本として扱う（§5 のバージョンと突合）。**retrospective-log は起動時未投入が基本**（必要時に投入）。
2. **現状認識を 1 メッセージで共有**（§1）。
3. **M16-04（G-i）指示書＋レビューチェックリスト作成に着手**（§3.1）。**M16-RESEARCH-01 の要決定 6 件は全確定済み（§2.3）＝追加確認なしで直接着手可**。
4. 着手前に **§2 の確定判断**（要決定 6 件・high_jump=unique・移動 system move 正式コード・dash canonical）と **§3.1 の勘所**（ryu 既存データのみ移行・#91 削除・衝突検出組込・ModifiersEditor dash 撤去）を確認。

> **注記（2026-07-06）**: 前セッションで委譲されていた「改訂 DES 本体の適用（CHANGE-060〜063）」は完了済み（DES-002 v1.30.0 / DES-003 v1.26.0 / DES-004 v1.8.0 / DES-005 v2.37.0 / DES-006 v1.17.0・SUPP-001 v1.26.0 に適用、change-report-062 も作成）。本作業に関する記述は本引き継ぎ資料から除去した（残る M16-04 以降・残サブ設計メモは有効）。

---

## 1. M16 完了状態と現況

### 1.1 完了済み（設計・実装・レビュー・CHANGE 反映）

- **M16-RESEARCH-01（④/④''/dup 実態調査）完了**（report 受領・overview §4.8 反映）。dup 衝突 0 件（要 M14-03b 後再測定）・単値 dash 実装ゼロ・移動 system move は ryu のみ・ingrid #91 移行不能・target_combo 実データ 0 件・DES-004 自己矛盾検出。
- **M16-01（G-g・drive 始動残量 REAL 化・0.5 刻み）完了**。実装済・**CHANGE-060 反映**（DES-003 §3.4・DES-005 §5.7・DES-006 VAL-C04）。down 丸め＝切り捨てを標準化。
- **M16-02（G-f・ゲージ消費列）完了**。消費 2 列（SA 整数 0〜6/drive 小数 0〜20）＋追補 v1.0.1（比較 4 行）＋追補 v1.0.2（F-1(a) UI クランプ）。実装済・**CHANGE-061 反映**（DES-003 §3.4・DES-005 §5.4/5.6/5.7/5.8・DES-002 §7.6・DES-006 §2.4）。
- **M16-03（G-h・起き攻め正規化）完了**。`combo_oki_options`・シミー 4 区分化・打撃重ね・6 bool 決定論 backfill＋DROP。重大 0/高優先 0。実装済・**CHANGE-063 反映**（DES-003 §3.4・DES-005 §5.6/5.7/5.8/5.13・DES-002 §7.6/§4.2・DES-006 VAL-C11）。
- **CHANGE-062（DES-004 spec 是正・doc 限定）起票**（単値 dash 幽霊削除・high_jump=unique 正典化）。承認・commit 待ち。
- **正本**: M16-overview **v1.2.0**（§4.8 RESEARCH 反映・§4.6 M16-06 送り記録）／ model-allocation **v1.29.0**（M16 配分）／ registry **次 064**（v1.52.0・060〜063 反映・062 起票）。

### 1.2 残作業

- **M16-04（G-i＝taxonomy 明文化／移動 move 化／④'' dash 一本化）**: **新セッション最優先**。§3.1。
- **M16-05（④' target_combo 区分正典化）**: §3.2。実データ 0 件＝分類基準明文化のみ。
- **M16-06（表記 rollout・旧 M15-07）**: §3.3。FB⑥⑨⑬⑪＋始動/消費ラベル正典化（A-3）＋エクスポート消費（A-1）。
- **M14-03b（全キャラ seed 投入）**: §3.4。M16 末尾（G-i 後・M17 前・配布 blocker）。
- **前セッションからの未了（§6）**: (a) **code-facts 再生成**（`/regen_code_facts`）、(b) CHANGE-062・063 承認済み＝commit。※改訂 DES 本体の適用（CHANGE-060〜063）は完了済み（§0 注記）。retrospective-log 転記は**前セッションで実施済み**（§1.3）。

### 1.3 教訓・申し送りメモの扱い（重要）

- **M16 教訓は retrospective-log 本体へ転記済み**（前セッション末で実施・§6.6.9「M16 期間の反省」新設・**L-M16-doc-1〜11** を M16-1〜7＋正の前例＋反映工程未了として転記・log **v1.0.46**）。一時ファイル `retrospective-log-additions-TMP.md` は**引き継がない**（開発者方針＝転記済みのため）。
- **digest 再蒸留は開発者**（`/retrospective-digest-update`・再生成版を新セッションへ手交予定）。設計担当は log のみ更新。
- 転記した主眼: M16-1（引き継ぎ書残タスク欄の実態乖離）/ M16-2（RESEARCH が幽霊仕様・隠れブロッカー・DES 自己矛盾摘出）/ M16-3（指示書「表示追従」の実コード未確認）/ M16-4（DES 記述と実装の乖離＝down 標準/VAL-D03）/ M16-5（「VAL 非連動」の 2 段掘り下げ）/ M16-6（down 破壊性・CSV 任意列・BE 再起動）/ **M16-7（起き攻め誤字・DR 略記の 3 回再発＝出力前 grep 校正の運用強化）**。
- M16-03 伝達メモ（`20260705-M16-03-design-handover.md`）の独自判断（sparse/PATCH replace-set/VAL-C11 uniform 等）は CHANGE-063 に反映済み。

---

## 2. M16 で確定した重要判断（再協議不要）

- **サブ分割 M16-RESEARCH-01＋M16-01〜06＋番外 M14-03b 承認済み**（2026-07-05・playbook §4.12）。搬送順 G-g→G-f→G-h→G-i→④'→表記 rollout→M14-03b。
- **承認ゲート**: G-g（M16-01）/G-f（M16-02）/G-h（M16-03）済。**G-i＝M16-04**・④'＝M16-05。
- **M16-RESEARCH-01 要決定 6 件＝全確定（2026-07-05）**:
  1. **移動 system move の seed は M14-03b 全キャラ seed へ移譲**（入力ヘルパー CSV に含まれる見込み）。M16-04 は移動 move の seed 自体はしない（原則明文化のみ）。
  2. **dash 移行に衝突検出を組み込む**（検出→スキップ→一覧出力・母集団小で現状 0 件だが安全側）。
  3. **ingrid #91 は combo（テストデータ）＝削除で解決**。移行前処理で combo #91 削除。
  4. **ModifiersEditor の dash 撤去を M16-04 に含める**（modifier.type としての dash 選択肢を撤去＝再混入経路を断つ）。
  5. **spec 是正＝CHANGE-062 で先行解消済み**（単値 dash 幽霊・high_jump）。
  6. **alias 整備＝移動 move seed と alias を対に（M14-03b）／移行後は該当コンボのみ targeted `RecomputeComboCache`**（全件でなく dash 保有コンボのみ）。
- **high_jump = unique（ヴァイパー特有の特殊技）**（開発者確定・CHANGE-062）。移動 system move ではない・flag でもない。
- **dash canonical = 方向別 system move `dash_forward`/`dash_back`**。modifier.type の方向別 dash は M16-04（④''）で廃止＋実データ移行。**移行対象は ryu 既存データのみ**（#91 削除後・衝突 0 件）。
- **移動 system move 正式コード（`category="system"`・キャラごとに seed・DES-004 §2.1）**: `forward` / `back` / `micro_forward` / `micro_back` / `dash_forward` / `dash_back` / `jump_neutral` / `jump_forward` / `jump_back`。※ジャンプ攻撃は別＝通常技 `jumping_<強度>_<ボタン>`。
- **起き攻め正規化の確定**（CHANGE-063）: `combo_oki_options`（**available sparse＝列なし・行存在**）・語彙リテラル（`throw_meaty`/`shimmy`/`strike_meaty` × `neutral_tech`/`back_tech` × `uses_dr`）は DB/API/CSV/FE の**契約値**・**PATCH は replace-set（per-field 対象外）**・**VAL-C11 uniform**・詳細（利用可能分）と比較/出力（12 変種）の表示非対称は明記・tri-state→presence 縮約。
- **① ゲージ消費は VAL 非連動＋F-1(a) UI クランプ**（BE/CSV は非連動・UI で上限クランプ・始動欄は不触＝入力挙動非対称は暫定容認・M16-06 で判断）。
- **画面ラベルは「ドライブラッシュ」正式名称・「DR」略記不可**（DES-005 §5.6 正典）。内部コード `uses_dr`/`_dr` は別扱い。
- **down 破壊性**: 型変更（M16-01・再構築）は値保持 down、**ADD COLUMN（M16-02）・正規化（M16-03）の down は列/新変種喪失で破壊的**（本番は前進のみ想定）。
- **REAL→INTEGER down 丸め＝切り捨て（明示 CAST）を標準**（B-1）。

---

## 3. 残サブの設計メモ

### 3.1 M16-04（G-i＝taxonomy／移動 move 化／④'' dash 一本化）— 新セッション最優先

- **スコープ**: (1) **taxonomy 原則の明文化**（moves 行〔system 含む〕/ 非技ステップ modifier.type / modifier flags の振り分け原則を 1 枚に）。(2) **移動の system move 化＝原則格上げ**（レシピ表記ルール：ジャンプ→攻撃は空中技＋flag で省略・純移動ジャンプのみ move。実 seed 自体は M14-03b）。(3) **④'' dash 一本化＝modifier.type 方向別 dash を廃止**（`ModifiersEditor` からの撤去〔要決定4〕・許容値定数/バリデーションから除去）＋**ryu 既存 modifier.type dash データを system move dash へ移行**（衝突検出組込〔要決定2〕・移行前に combo #91 削除〔要決定3〕）＋**該当コンボのみ targeted `RecomputeComboCache`**〔要決定6〕。
- **勘所（最重要）**:
  1. **移行対象は ryu 既存データのみ**（他キャラの移動 move は M14-03b で canonical seed＝移行不要）。母集団小・衝突 0 件（RESEARCH 実測）だが検出は組み込む。
  2. **recipe_hash 波及**: dash 移行は steps を変える＝recipe_hash（`CalcRecipeHash(steps)`）が変わる。衝突検出→提示（自動マージしない）。移行後の recipe_cache 再生成は該当コンボのみ。
  3. **alias**: 移動 move の preset alias が無いと生 code 表示。alias 整備は M14-03b seed 契約（移動 move ＋ alias を対に）。M16-04 では ryu の既存 dash system move の alias 有無を実査。
  4. **CHANGE 見込み**: DES-004 §2.1/§2.3（taxonomy 原則・方向別 modifier.type dash 廃止）／DES-003 §3.3/§3.5（category 運用・combo_steps taxonomy）。**CHANGE-062（spec 是正）は済＝幽霊仕様の後追い不要**。
  5. **モデル**: Opus 4.8 ＋ Plan Mode 必須（最重・破壊的移行）。
- **④' target_combo は M16-05**（本サブと隣接だが別サブ）。

### 3.2 M16-05（④' target_combo 区分正典化）

- **実データ 0 件**（RESEARCH）＝既存移行なし。**今後の取込に備えた分類基準の明文化が中心**（どの多段特殊技を target_combo とするか＝SF6 ドメイン判断）。CHANGE 見込み DES-003 §3.3／DES-004 §2.1。Opus 4.8 ＋ Plan Mode。recipe_hash 非対象（category は dup キー外）。

### 3.3 M16-06（表記 rollout・旧 M15-07）— M16 末尾

- FB⑥（技/非技ラベル＝④ taxonomy 後）・FB⑨⑬⑪（始動/消費明示＝① 後）。**M16-02 由来の送り事項**（overview §4.6 記録済み）: **A-3 始動/消費ラベル横断正典化**（比較「始動残量」/詳細「開始残量」統一・en 始動 `(start)`/消費 `consumed` 非対称解消・詳細/比較/入力/エクスポート横断・ja/en parity）・**A-1 エクスポートカードへの消費項目追加**（`ExportItemKey` 新設）。※起き攻めラベルは CHANGE-063 で `okiOptionLabel` 正典化済み＝M16-06 対象外。Sonnet 4.6（非スキーマ表記）。

### 3.4 M14-03b（全キャラ seed 投入）— M16 末尾（G-i 後・M17 前）

- **配布 blocker**。seed 契約＝**G-i canonical（移動 system move 行＋その alias・dash 一本化後・taxonomy 準拠 move_code）を出力**。見込み前倒し CSV は remap で機械整形（人力再入力なし）。キャラは 30→絞る可能性あり（選定は製造裁量）＝M16 taxonomy はキャラ数非依存で不変・配布完了定義（followup §C-1）の閾値のみ調整。過去指示書 `M14-03-distribution-seed.md` を G-i canonical 確定時に最新スキーマへ照合（設計担当が請求）。Opus 4.8 ＋ Plan Mode。

### 3.5 追加調査・判断メモ（2026-07-06・調査支援セッション）

CHANGE-060〜063 反映後の調査支援セッションで確認した事実と、開発者が確定した小判断。**DES 本体は未改訂＝設計担当が CHANGE 経由で正式化する前提**。M16-04（§3.1）の taxonomy 検討の入力材料。

- **調査1：ダッシュ用語は二重表現（未統一）**。コードは `dash_forward`/`dash_back`（system move・canonical）で統一。だが表示ラベルが二重＝**編集画面は「前方ステップ／後方ステップ」**（FE `web/src/features/combo/labels.ts` `MODIFIER_NON_MOVE_TYPES`・importer scope）、**保存後の DB 表示は「前ダッシュ／後ろダッシュ」**（seed alias `official_ja_move`・migrations 000006/000011・docs `04-notation-spec.md §2.1`/`supp-001 §3.3.3`）。ユーザーは「前方ステップ」を選ぶが保存後「前ダッシュ」表示になる非対称（`M16-RESEARCH-01-report.md` L273-277 が dash 二重表現として記録）。→ **M16-04（④'' dash 一本化・§3.1）で一本化語（ステップ or ダッシュ）を確定**する。

- **調査2：command（入力コマンド）の DB 保存形式**。command は **DB 列ではなく `moves.raw_data` JSON の `command` キー**として保持する設計だった（CHANGE-030 の確定キー：notes/notes_tool/command/condition_ja/condition_en/properties_extra/import_notes）。ただし **CHANGE-054（M14-01）で取込退避キー群ごと除去済み**＝現行 raw_data は `notes`/`notes_tool` のみ（`03-data-model.md:275`。取込廃止 FR704 降格に伴う）。importer は今も CSV に `command` 列を出力＝シリアライズ済みトークン列（例 `d dr r plus p_l`＝QCF+弱P／`p_l`＝弱P／`r r`＝前ステップ入力。`condition_ja/en` は別列）。→ 現状、command はアプリ DB には保持されない（importer 成果物にのみ存在）。

- **調査3＋判断1：is_aerial は現状維持**（開発者確定：「現状維持、経緯を記録。将来のアップデートで扱いを変える可能性はあり」）。**唯一の機能的消費先は FR703 ラッシュ版生成**（`POST /api/moves/:id/rush-variant`・moves 編集グリッド・現役機能）。BE `rushEligible`（`internal/service/move/service.go`）＋FE `isRushEligible`（`web/src/features/moves/types.ts`）で「category ∈ {normal,unique} かつ is_aerial=false」のゲートに使用。**当初想定された FR704（降格済み取込）ではない点に注意**。対空・空中やられ（juggle）・空中ヒット状態の判定には**一切未使用**（コンボビルダーのラッシュ経路すら is_aerial を読まず「up ゾーン」で空中除外）。importer が name/condition の「ジャンプ／（ジャンプ中に）」から自動導出。→ **将来アップデートで扱い（廃止/意味変更）を再検討する余地あり。その際は FR703 ラッシュ版生成の存続と連動**（廃止するなら rush gating の代替が要る）。

- **判断2：移動系 system move のフレーム表現＝「発生=1・持続=残り・硬直=0・total 自動計算」**（開発者確定。**ダッシュだけでなくジャンプ等の純移動動作にも一律適用**）。対象＝`dash_forward`/`dash_back`・`jump_neutral`/`jump_forward`/`jump_back` 等（公式データ空欄・現状 seed で frame 全 NULL）。
  - **算出式との整合**：`total = startup + active − 1 + recovery`（`03-data-model.md:310`）。発生=1・硬直=0 を代入すると **total = active**（+1 と −1 が相殺）＝「持続に入れた値がそのまま total（全体フレーム）になる」。
  - **端数の確認点（設計担当が CHANGE 化時に確定）**：全体 N フレームを total=N にしたいなら active=N。「残り＝全体−発生1」を字義どおり active=N−1 とすると total=N−1。例：前ダッシュ全体17F → 発生1・硬直0で、持続=17 なら total=17／持続=16 なら total=16。どちらを採るか（全体そのもの or 全体−1）を確定要。
  - **位置づけ**：移動の system move 化＝M16-04（G-i・§3.1）の taxonomy 入力材料。**DES-003 §3.3（moves frame）／DES-004 §2.1（移動 system move）へ設計担当が CHANGE で追補**する前提（本メモは方針記録のみ）。

- **判断3：command の取込方針＝「moves-input-tool が公式CSVから command を自動取込→seed CSV 出力／§9.9 は verbatim パススルー／吸収は本体 net-new 取込スクリプト／index-only 推奨」**（開発者確定・2026-07-06）。調査2 の続き＝command を M17 に先行して確立（データを作らないと M17 に進めないジレンマの解消）。**用語注意**：ここでの「入力ツール」は **`autopilot-combomgr/projects/moves-input-tool`**（人が事実観測して手入力する Go 製ツール）であって combomgr-importer ではない。
  - **combomgr-importer の位置づけ**：公式サイトのフレームデータを CSV 化する独立ツール。**法的理由でデータ源としては使わず照合（`reconcile`）専用**・今後不変。**例外は command のみ**＝手転記困難で、importer が公式コマンド“アイコン名”を変換して §9.9 トークンを生成する（変換物＝低リスク）ため、command だけは importer 出力を利用可。
  - **分担（3層）**：(1) **moves-input-tool（入力ツール・autopilot）** ＝ フレーム等は人間観測で手入力。**command は公式CSV（importer 出力形式・`reconcile --official` と同経路で実行時供給）から `(character_code, move_code)` 突合で自動取込**し、`command`/`condition_ja/en` を **seed CSV へ verbatim 出力**（現行の「入力専用・非出力」を反転）。§9.9 は解釈・numpad 変換・技解決せず素通し。(2) **本体 net-new 取込スクリプト**（現状不存在＝本体 seed/dev 責務・M17 G-k 索引化の前倒し）が §9.9 トークン→本体索引形（numpad or 正準トークン）＋`condition`→`move_code` の索引を構築＝**command 形式の吸収はここ**。(3) 本体アプリ実行時（M17 段階2）は DB 索引を引くだけ（実行時パースなし）。
  - **保存形式＝index-only 推奨**：M14-01（migration 000018）で消した `moves.command` 列は**戻さず**、seed CSV から索引を機械再構築する。列復活は per-move で command を画面表示/編集したい場合のみ検討（表示は既存 `official_ja_command` プリセット系が別担当）。最終確定は M17 で可（入力ツール完成を**ブロックしない**）。
  - **段階2 の解決スコープ**：「単方向＋ボタンの特殊技」のみ決定論解決。溜め（`charge_*`）・一回転（`circle`）・空中特殊技はモーション解決せず「直接指定」。入力ツールは全部 verbatim 出力し、絞り込みは下流。
  - **入力ツールへの指示は発行済み**：プロンプトを `tmp/20260706-input-tool-command-contract-prompt.md` に作成（moves-input-tool の autopilot 向け＝公式CSV自動取込＋seed CSV 出力＋§9.9 verbatim＋法的経緯明記。combomgr-importer への変更は含まない）。
  - **本体側 CHANGE 見込み**：DES-002 §7.6（取込ヘルパー IF）／DES-003（command 索引源＝G-k・列復活なら）／DES-004 §2.1・§6（command 索引・move_code 解決）。M17 着手時に view 確認して設計担当が正式化。phase3-overview §2.3/§2.4 G-k・承認事項7 と整合（M17 繰り延べを前倒し決定した位置づけ）。

---

## 4. 本セッション固有の運用ルール

- **出力前チェック必須（本セッションで再発多発＝毎回必ず実行）**: 簡体字検査＋禁則表現（「必要に応じて」「適切に」等→playbook §4.2）＋**「起き攻め」誤字（`grep 起き攻め`）＋「DR」略記（画面ラベルは「ドライブラッシュ」・`OKI_USES_DR_LABEL` 等コード定数と「DR」略記禁止の規約引用は除く）**の grep。※誤字「起き攻め」・「DR」略記は M16-03 系で 3 回再発＝L-M16-doc-2/3/11。置換スクリプトのプレースホルダに "DR" を含めない（`@@…@@` で英字略記を避ける）。
- **確認事項は成果物末尾に集約**（番号付き・何を/なぜ/暫定案）。
- 設計担当は **DES 本体を CHANGE 経由で改訂**、製造担当は DES を直接編集しない。**git/commit/push は開発者専任**。
- **CHANGE 対象 = REQ-001＋DES-001〜006 のみ**。SUPP-001・CLAUDE.md 等は §10.X 規定に従い自由改訂/CHANGE 経由。「念のため起票」回避（digest §6）。
- **承認ゲート**: スキーマ変更（G-i）は着手前に開発者の個別承認（Plan Mode ExitPlanMode）。
- **三点セット**: CHANGE は 通知書＋**改訂 DES 本体**＋change-report。※CHANGE-060〜063 は三点セット揃い済み（DES 本体適用・change-report-062 作成とも完了。§0 注記）。
- コンテキスト評価は限界が近い/重い作業の後に自己観察。

---

## 5. 関連ドキュメント（現行版・開発者が最新を添付）

| 種類 | ファイル | 現行版 |
|------|---------|--------|
| フェーズ3 正本 | `phase3-overview.md` | **v1.1.2**（M16 スコープ・§2.4 G-a〜G-k） |
| M16 正本 | `M16-overview.md` | **v1.2.0**（§4.8 RESEARCH・§4.6 M16-06 送り） |
| モデル配分 | `model-allocation.md` | **v1.29.0**（M16 配分） |
| 採番管理 | `change-number-registry.md` | **次 064**（v1.52.0・060〜063 反映・062 起票・欠番 008/009/014） |
| 反省記録 | `retrospective-log.md` | **v1.0.46**（§6.6.9 M16 期間の反省 転記済み・TMP は引き継がない） |
| 反省ダイジェスト | `retrospective-digest.md` | 起動時必読（転記後に開発者が再蒸留） |
| 後続課題 | `followup-backlog.md` | §C-1 配布完了定義（M14-03b 絞り込みで調整）等 |
| データモデル | `03-data-model.md` | **DES-003 v1.26.0**（CHANGE-060/061/063 反映・適用済み） |
| 内部表現 | `04-notation-spec.md` | **DES-004 v1.8.0**（CHANGE-062・M16-04 で §2.1/§2.3 追加改訂見込み） |
| 画面設計 | `05-screen-design.md` | **DES-005 v2.37.0**（CHANGE-063 反映） |
| バリデーション | `06-validation.md` | **DES-006 v1.17.0**（CHANGE-063 反映） |
| アーキテクチャ | `02-architecture.md` | **DES-002 v1.30.0**（CHANGE-063 反映） |
| 補足資料 | `supp-001-detailed-design.md` | SUPP-001 v1.26.0（§3.3.1/§3.3.2 high_jump=unique 整合済み＝CHANGE-062 同方向・自由改訂／§3.3.3 MODIFIER_NON_MOVE_TYPES＝M16-04 で dash 廃止見込み） |
| 機械的事実 | `code-facts.md` | **要再生成（`/regen_code_facts`）**＝§10 stale（000021 まで）・§8 起き攻め構造 |
| 恒久資料 | playbook v1.12.0 / architecture-patterns / docs-map / CLAUDE.md | 各最新 |
| 完了済み成果物 | M16-RESEARCH-01 ／ M16-01/02/03 指示書＋各レビューチェックリスト | 参照（書式手本） |
| spec | `combmgr-friend-feedback-datamodel-issues.md` | ①〜④ 一次詳細 |
| 様式参考 | `m15/m12/m7-design-session-handover.md` | セッション継承様式 |

> **DES 版数の注記（2026-07-06 更新）**: CHANGE-060〜063 の DES 本体適用は完了済み（DES-002 v1.30.0 / DES-003 v1.26.0 / DES-004 v1.8.0 / DES-005 v2.37.0 / DES-006 v1.17.0）。SUPP-001 は high_jump=unique 整合を自由改訂で適用（v1.26.0）。change-report-062 も作成済み。commit は開発者。

---

## 6. 開発者への申し送り（継承時の確認）

1. **retrospective-log 転記＝前セッションで実施済み**（本 handover と同時に §6.6.9「M16 期間の反省」新設・L-M16-doc-1〜11 転記・log v1.0.46）。**TMP は引き継がない**（開発者方針）。新セッションは **開発者が `/retrospective-digest-update` で digest 再蒸留**（設計担当は log のみ）。
2. **code-facts 再生成**: `/regen_code_facts`（§10 を 000021 まで・§8 を起き攻め新構造へ・開発者実行・再生成版を新セッションへ手交予定）。
3. **CHANGE-062・063 承認済み**（開発者 2026-07-05）。062（doc 限定・spec 是正）・063（M16-03 反映）とも承認＝commit へ。
4. **M16-04 着手**: 要決定 6 件・high_jump=unique・正式コード・dash canonical はすべて確定済み（§2）＝**追加確認なしで M16-04 指示書作成から直接着手可**。

---

*以上、M16 期間 設計セッション継承資料 v1.5.0。配置 `docs/handover/phase3/m16-design-session-handover.md`。新セッションは §0 に従い M16-04（G-i）指示書作成から着手する。要決定 6 件は全確定・spec 是正（CHANGE-062）済み。改訂 DES 本体の適用（CHANGE-060〜063）は完了済み（§0 注記）＝retrospective 転記も済。code-facts 再生成は未了。*
