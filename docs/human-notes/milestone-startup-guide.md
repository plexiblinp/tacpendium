# マイルストーン開始ガイド(開発者向け)

| 項目 | 内容 |
|------|------|
| 文書ID | MILESTONE-STARTUP-GUIDE |
| 用途 | 開発者が新マイルストーン開始時に、設計・指示書作成担当 Claude(別チャット)へ投入する資料を迷わず選べるようにする |
| 対象読者 | **開発者(本プロジェクトの個人開発者)専用** |
| 更新頻度 | 各マイルストーン着手時に §3 を追記 |

---

## 1. 本書の目的

開発者が新マイルストーン(M{N})開始時に、設計・指示書作成担当 Claude(別チャット、Web 版)に投入する
資料を迷わず選べるようにする。設計担当 Claude は投入された資料を初回応答で読み込み、M{N} の指示書
起票準備に入る。

---

## 2. 設計担当に投入する標準資料セット(全マイルストーン共通)

> **★★【2026-08-11 面の移行・本節より優先】親(設計卓)は Claude Code へ移り、「投入」という概念が無くなった。**
>
> 開発者裁定 6 件(正本 `docs/progress/20260811-design-desk-surface-study.md` §9)により、**親は repo の `docs/` を直接 Read/Edit する**。
> プロジェクトナレッジも Sync now も存在しないため、**以下 §2 の「ナレッジ常設 / 直読」の線引きと §5-1 の投入手順は親には当てはまらない**。
> キット §1 が列挙するのは「**起動時に必ず読むパス**」と「**必要時に引くパス**」で、線引きの理由も「検索は取りこぼす」から
> **「読ませすぎを防ぐ」**へ入れ替わった(`next_milestone_kit` 変換規則 19)。**鮮度は HEAD。**
>
> **★ただし親は実装ソースを読まない**——`scripts/design-desk-arm.sh` による**武装**(sparse-checkout で `internal/` `web/src/` `cmd/`
> `migrations/` を作業ツリーから物理排除)が担保する。**「repo が見える」と「実装が見える」は別**で、見えるようになったのは `docs/` だけ。
> 実装の事実は ①`code-facts.md` を引く → ②Explore サブエージェントに問い蒸留された答えだけ受け取る → ③製造に実査させる、の順で取る
> (playbook §12.0)。
>
> **以下 §2 / §5 は「個別設計チャット(Web 版)」向けとしては現役**である(Web 版は親をやめ `parallel-ops` §06 の個別設計チャットへ
> 配置換えされ、そちらは今も添付・GitHub 直読で動く)。
>
> ---
>
> **★【2026-07-30 切替】「毎回投入する」から「ナレッジ常設 + セッション固有だけ渡す」へ。**
>
> Web 版 Projects の **GitHub ナレッジに恒久資料を常設**したため、**§2.1 / §2.2 の資料は毎回渡さない**。キットが列挙するのは「**ナレッジに任せてよいもの**」と「**任せてはいけないもの**」の線引きである。
>
> | 資料の性格 | 渡し方 | 該当 |
> |---|---|---|
> | **バルク参照**(必要になったら引く) | **ナレッジ常設・投入不要** | §2.2 の設計書本体 8 件 / playbook / retrospective-digest / code-facts / docs-map / architecture-patterns / followup-backlog / model-allocation / `docs/instructions/templates/` |
> | **ロック・counter・状態** | **★検索に委ねず明示パスで直読させる** | ボード(`docs/process/parallel-board.md`)・契約・`change-number-registry.md` |
> | **当該セッション固有** | **明示パスで直読させる** | 引き継ぎ資料・overview・当該マイルストーンの一次 spec |
>
> **根拠(`docs/process/parallel-ops.html` §10)**: ナレッジは**検索ベース取得**で全ファイルが常時コンテキストに載るわけではなく、そして**検索は取りこぼす**(実例＝類似名の既存機能に意味検索が吸われ、目的ファイル本文を 3 回クエリを変えても引けなかった)。**ロックや counter を検索取得に委ねない。** 番号・現行版の要点は**起動プロンプト本文に載せ**、同期が多少古くても成立する設計にする。
>
> **鮮度**: ナレッジも直読も「**最終 push + Sync now 時点**」。**派生資料 3 件**(code-facts / docs-map / retrospective-digest)は**起動直前に再生成 → commit + push → Sync now**。
>
> **`retrospective-log` は渡さない**(下表に残っているが、起動時の必読は **retrospective-digest**。log はマージ担当＝反映係が扱う)。**`progress-summary` / `progress-log` も要求させない**(`parallel-ops` §08)。
>
> 以下の §2.1 / §2.2 は「**何がナレッジに入っている必要があるか**」の一覧として読む。

### 2.1 必須投入(運用・引き継ぎ資料)

| 資料 | 役割 |
|------|------|
| `CLAUDE.md` | プロジェクト指針。製造担当向け文書だが設計担当も概要把握のため読む |
| `docs/handover/design-instruction-playbook.md` | 設計担当向け恒久運用ルール |
| `docs/handover/retrospective-log.md` | 全期間の設計担当ミス累積記録 |
| `docs/handover/architecture-patterns.md` | 確立済みアーキテクチャパターン |
| `docs/handover/change-number-registry.md` | CHANGE 番号運用の最新状態 |
| `docs/handover/m{N-1}-to-m{N}-handover.md` | 直前期間からの引き継ぎ(マイルストーン固有の差分) |
| `docs/progress/progress-summary.md` | 製造工程の進捗要約(詳細は progress-log.md) |
| `docs/instructions/templates/`(テンプレ実体・GitHub 直読) | 各成果物(overview / 指示書 / レビューチェックリスト / RESEARCH / CHANGE 通知書・report)の書式・粒度の手本テンプレ集。従来の「直近指示書・レビューチェックリストを個別添付」を代替。**2026-07-20 直読切替**: テンプレ実体はコミット済みのため Web 版の GitHub ナレッジでディレクトリごと直読させる。添付フォールバック時のみ `bash scripts/generate-template-zip.sh` で `design-templates.zip` を再生成して添付する |

### 2.2 設計書本体(該当節のみ抜粋投入が望ましい)

| 資料 | 内容 |
|------|------|
| `docs/design/requirements.md`(REQ-001) | 要件定義 |
| `docs/design/01-tech-stack.md`(DES-001) | 技術スタック |
| `docs/design/02-architecture.md`(DES-002) | アーキテクチャ。特に §4.2 主要エンドポイント、§4.3 エラーハンドリング |
| `docs/design/03-data-model.md`(DES-003) | テーブル定義 |
| `docs/design/04-notation-spec.md`(DES-004) | 内部表現仕様 |
| `docs/design/05-screen-design.md`(DES-005) | 画面・UI 設計 |
| `docs/design/06-validation.md`(DES-006) | バリデーション設計 |
| `docs/design/supp-001-detailed-design.md`(SUPP-001) | 詳細設計補足 |

---

## 3. マイルストーン別の追加投入資料

### 3.1 M4 着手時(セットプレイ系・プリセット系)

標準資料セットに加えて、以下を投入・重点参照する:

- **設計書本体の重点節**: REQ-001 のセットプレイ系 FR、DES-005 のセットプレイ登録/編集画面の節、
  DES-004 内部表現仕様(プリセット)、DES-002 §4.2 主要エンドポイント、SUPP-001 §7 サービス層責務一覧
- **持ち越し課題**: m3-to-m4-handover §4 の P-01(RecipeBuilder console.warn)/ L-01(オプショナル型)/
  L-02(エラーコード大小混在)/ L-03(ハンドラヘルパ統一)を頭に入れる
- **テンプレート参照用**: M3-04 / M3-05 の指示書とレビューチェックリスト(直近の標準構成)
- M4 のサブマイルストーン分割は M4 起票フェーズで開発者と協議して確定する

### 3.2 M5 着手時(比較系)

標準資料セットに加えて、以下を投入・重点参照する:

- **設計書本体の重点節**(M5-overview 起票フェーズで開発者と Web 版設計担当の協議で確定):
  REQ-001 のコンボ比較系 FR、DES-005 のコンボ比較画面の節(§5.7 など、CHANGE-004 で簡素化済み)、
  DES-002 §4.2 主要エンドポイント、SUPP-001 §7 サービス層責務一覧(recipe_cache 活用方式)
- **持ち越し課題**: m4-to-m5-handover §3 の C-2(個別 VC UX 違和感)/ C-3(LinkExistingSetupModal /
  SetupSelectorModal 統合判断)/ C-4(setup.defaultRecipe 条件描画統一)/ L-02(エラーコード大小混在、
  setup 系のみ部分解消)/ L-03(ハンドラエラーヘルパ命名)を頭に入れる
- **テンプレート参照用**: M4-04 / M4-05 の指示書とレビューチェックリスト(直近の標準構成)
- **M4 期間の最重要教訓**: playbook §4.9「既存 UI コンポーネントの 3 点セット確認原則」、§1.4「プロジェクト
  現状の認識は開発者の責任範囲」、§13.4「複数案を提示する場合のフォーマット」を意識
- M5 のサブマイルストーン分割は M5 起票フェーズで開発者と協議して確定する

### 3.3 M6 着手時(初期体験系)

標準資料セットに加えて、以下を投入・重点参照する:

- **設計書本体の重点節**(M6-overview 起票フェーズで開発者と Web 版設計担当の協議で確定):
  REQ-001 の初回起動ウィザード・設定画面系 FR、DES-005 §5.1(ウィザード)・§5.2(スマホホーム)・
  §5.7 L343(下書き自動保存)・§5.16(設定画面)、SUPP-001 §4.2(LAN バインドロジック)・
  §3.6(default ユーザー seed 責務、M6 ウィザード実装時の正式分離方針)
- **持ち越し課題**: m5-to-m6-handover §3 の R-1(レスポンシブ調査、M7 向け)/ R-2(シミー DR 有、
  M7 向け)/ R-3(キャラフィルタ UI、M7 向け)/ M-1〜M-4(調査知見)/ C-2〜C-4(M4 継承)/
  L-02〜L-03(エラーコード・ハンドラヘルパ統一)を頭に入れる
- **テンプレート参照用**: M5-RESEARCH-01 / M5-01 の指示書と M5-01 レビューチェックリスト(直近の標準構成)
- **M5 期間の重要運用知見**: 調査担当 Claude Code 運用(M5-RESEARCH-01 で初導入、後続マイルストーンの
  参照実装)、M5 期間設計担当反省 3 件(M5-1 / M5-2 / M5-3 候補、retrospective-log v1.0.17 §6)
- M6 のサブマイルストーン分割は M6 起票フェーズで開発者と協議して確定する

### 3.4 M7 着手時(仕上げ)

標準資料セットに加えて、以下を投入・重点参照する:

- **設計書本体の重点節**(M7-overview 起票フェーズで開発者と Web 版設計担当の協議で確定):
  DES-005 の全画面(レスポンシブ仕上げ・shadcn/ui 統一導入で全画面を再確認)、DES-001 §2(shadcn/ui
  採用根拠)、DES-002 §4.2 主要エンドポイント、SUPP-001 §4.1(M7 スコープ)・§7 サービス層責務一覧
- **持ち越し課題**: m6-to-m7-handover §3 の P-1(プリセット管理、フェーズ 2 送り確定)/ 残課題 1(Step 6
  パスワード、フェーズ 2)/ 残課題 3(ヘッダ他ページ反映、M7 shadcn/ui 統一時)/ 残課題 4 関連(フェーズ 2)/
  R-1(レスポンシブばらつき)/ R-2(シミー DR 有データ)/ R-3(キャラフィルタ UI)/ M-1〜M-4(調査知見)/
  C-2〜C-4(M4 継承)/ L-02〜L-03(エラーコード・ハンドラヘルパ)/ L-04(ポート競合)/ スマホ LAN 実機検証 /
  日英切替不適応 を頭に入れる
- **テンプレート参照用**: M6-03 / M6-04 の指示書と M6-04 レビューチェックリスト(直近の標準構成)
- **M6 期間の重要運用知見**: CHANGE-016 ハイブリッド分担(Claude Code 委譲、5 ファイル以上の横断改訂時)、
  対応表の UI 全範囲拡張(M6-6 教訓)、P-1 フェーズ 2 送り判断(本プロジェクト初の画面フェーズ送り)、
  M6 期間設計担当反省 11 件(retrospective-log v1.0.21 §6)
- M7 のサブマイルストーン分割は M7 起票フェーズで開発者と協議して確定する

### 3.5 M9 着手時(FR701 公式フレームデータ取込ツール・並列委任)

> M8(moves スキーマ見直し)はフェーズ2 キックオフチャットで実施したため本ガイドに個別節を持たない
> (フェーズ単位の起動は `phase-startup-kit/` を参照)。M9 は本体とは別バイナリの外部ツール設計を
> 別チャットの専任設計担当へ委任する**並列キット**で進めるため、本書 §2 の標準資料セットは適用しない。

- **起動キット(実物)**: `milestone-startup-kit/m9-fr701-importer-startup-kit.md`(標準連番キットではなく
  並列委任の特殊キット。プロンプト本文 + 投入ファイル一覧の完成品)
- **一次資料**: 委任ブリーフ `docs/instructions/phase2-tool-delegation-brief-fr701-importer.md`(v1.0.0、自己完結)
- **投入資料セット**: **ブリーフ §7「引き渡しパッケージ」に厳密準拠**する。必須コア = playbook / REQ-001 /
  DES-002 / DES-003 / DES-004 / SUPP-001 / CHANGE-022・023 通知書 / 公式 HTML サンプル、推奨文脈 =
  CLAUDE.md / DES-001 / phase2-kickoff-handover、渡さない = DES-005 / DES-006 / change-number-registry /
  model-allocation / architecture-patterns / progress-summary / retrospective-log / change-report-*
- **特殊スコープ**: 外部ツールのため**技術スタック選定(M9-RESEARCH)を作業に含む**。本体は Go だがツールは
  別バイナリのため独立選定可。本体 CHANGE プロセス対象外(ただし CSV 契約 DES-002 §7.5 波及時は本体へ申し送り)

### 3.5b M9 本流着手時(公式データ取込パイプライン本体・M9-02 起点)

> §3.5 は M9-01(FR701 取込ツール = 別バイナリ・並列委任)の起動。本節は **本体側の本流スパイン**
> (M9-02 FR704 アプリ取込 以降)の起動で、標準連番キットの系譜。M9-01 は別チャットで完了済みのため
> 本セッションは **M9-02 から開始** する。

- **起動キット(実物)**: `milestone-startup-kit/m9-startup-kit.md`(本流スパイン継続キット。プロンプト本文 +
  投入ファイル一覧の完成品。`phase2-continuation-startup-kit.md` から流用作成)
- **一次資料(主 handover)**: `docs/handover/m8-to-m9-handover.md` v1.2.0(§0 開始点 = M9-02・§2 確定事項・
  §3 M9-02 設計入力・§6 申し送り)。読む順序は同書 §0 起点。
- **追加投入資料(C グループ)**: FR701 引き継ぎ 2 本 = `fr701-mainline-handover.md` v1.0.0 +
  `fr701-m9-02-handover-addendum.md` v1.0.0(combo_scaling キー突合・notes パース・フレーバー母集団)、
  `phase2-overview.md` v0.2.0、CHANGE-024〜027 通知書。
- **重点節(着手前に必ず扱う)**: total 算出式の DES-003 §3.3 記載 CHANGE(**028**)起票 / M8-A4 = `model.Move` vs
  `MoveListItem` 二重定義の正準型集約判断 / combo_scaling 正準キーへのツール側追従反映の確認 / notes パース方針。
- **§2 標準資料セットとの差分**: 必読の反省資料は `retrospective-log` ではなく **`retrospective-digest.md`**
  (現役教訓の蒸留版)、加えて **`code-facts.md`**(機械的事実)を必須投入。両者とも **投入直前に再生成**
  (`/regen_code_facts` / `/retrospective-digest-update`)した最新版を貼る。
- **持ち越し課題**: total 式 CHANGE-028 / M8-A4 集約判断 / combo_scaling キー追従 / notes パース残リスク
  (`; ` 境界曖昧化)。詳細は m8-to-m9-handover §3 / §6。

### 3.6 M10 着手時(複数キャラ登録 UI)

> M9(公式データ取込パイプライン)は M9-01〜M9-04 まで完了。本節は **M10 = ComboEditor のキャラクター
> 選択化(A-1)+ リュウ固定 UX 解消(A-2)** の起動で、標準連番キットの系譜。本セッションは **M10-01 から開始** する。

- **起動キット(実物)**: `milestone-startup-kit/m10-startup-kit.md`(プロンプト本文 + 投入ファイル一覧の完成品。
  `m9-startup-kit.md` から流用作成)
- **一次資料(主 handover)**: `docs/handover/m9-to-m10-handover.md`(§0 役割 / 作業順序・§1 現在地 = M9 完了・
  §3 M9 外後続 backlog・§4 確定事項)。読む順序は同書 §0 起点。
- **追加投入資料(C グループ)**: `phase2-overview.md` v0.2.0(§M10 = M10-01 / M10-02)。FR701 引き継ぎ 2 本は
  M9-02 取込専用のため任意降格(取込連携を遡るときのみ)。
- **重点節(着手前に必ず扱う)**: ComboEditor の現状リュウ固定箇所の実コード特定(code-facts §1 / §3 / 実 view)/
  登録系 API(`POST /api/combos` / `PUT /api/combos/:id`)が `character_id` を受けるか(code-facts §4 + DES-002 §4.2)/
  閲覧系の `useCharacters` + キャラ選択 UI パターンの登録系への踏襲 / キャラ切替時の RecipeBuilder・プリセット連動。
- **§2 標準資料セットとの差分**: 必読の反省資料は `retrospective-log` ではなく **`retrospective-digest.md`**
  (現役教訓の蒸留版)、加えて **`code-facts.md`**(機械的事実)を必須投入。両者とも **投入直前に再生成**
  (`/regen_code_facts` / `/retrospective-digest-update`)した最新版を貼る。DES-005(画面設計)が M10 の主参照。
- **持ち越し課題**: A-1 / A-2(M10 スコープそのもの)。M9 外後続(`m9-03-followup-backlog.md`)= B-1 命名クラスタ /
  B-2-heavy moves 手動 CRUD / B-3 フレーム計算式(開発者ドメイン課題)/ B-5 一括取込。M10 のサブにはしない。

### 3.7 M11 着手時(custom_states 開始時状態)

> M10(複数キャラ登録 UI)は M10-01 / M10-02 まで完了。本節は **M11 = custom_states 開始時状態の機能化**
> (situation = キャラ固有の開始時状態 boolean を付与・表示・参照、消費は notes 管理)の起動で、標準連番キットの系譜。

- **起動キット(実物)**: `milestone-startup-kit/m11-startup-kit.md`(プロンプト本文 + 投入ファイル一覧の完成品。
  `m10-startup-kit.md` から流用作成)
- **一次資料(主 handover)**: `docs/handover/m10-to-m11-handover.md` v1.0.0(前提 = 本書 + docs-map を最初に読む・
  §1 M10 完了状態・§4 M11 スコープ・§5 前向き注意点・§6 持ち越し課題・§7 参照)。同書は **§0 を持たない**ため
  読む順序は header前提 → §4 → §5 → §7。
- **追加投入資料(C グループ)**: `phase2-overview.md` v0.2.0(§M11 = custom_states 開始時状態)。
- **重点節(着手前に必ず扱う)**: custom_states の保存 / API の現状を実コードで裏取り(architecture-patterns §9.1 +
  code-facts。DB 実査 ≠ 仕様正典)/ 消費ロジック(どこで読み計算 / 表示へ効かせるか)/ キャラ別の状態定義
  (データ駆動か定義テーブルか)/ 状態付与 UI(DES-005 §5.7 表示項目5 situation の機能化)/ 影響設計書
  (DES-003 custom_states / DES-005 §5.7 / DES-004 / DES-006、場合により DES-002)と CHANGE 判断(次回 040)。
- **§2 標準資料セットとの差分**: 必読の反省資料は `retrospective-log` ではなく **`retrospective-digest.md`**
  (現役教訓の蒸留版)、加えて **`code-facts.md`**(機械的事実)+ **`docs-map.md`**(文書ID ⇄ 実パス、**M11 で必須
  投入に追加**)を必須投入。3 者とも **投入直前に再生成**(`/regen_code_facts` / `/regen_docs_map` /
  `/retrospective-digest-update`)した最新版を貼る。DES-003(custom_states スキーマ)/ DES-005 §5.7 が M11 の主参照。
- **前向き注意(M10-2 / M10-5)**: 「固定前提・未消費前提を有効化する改修は phase-1 の固定 / 未消費前提を露出させる」。
  M11 はまさにこの型——有効化対象周辺の phase-1 固定値・未消費前提のハードコード / 分岐を着手前確認に含める。
- **持ち越し課題**: C-1(custom_states 機能化 = M11 スコープそのもの)。M9 / M10 外後続(`followup-backlog.md`)=
  B-7 move_code 統一(M12-02 連動)/ B-8 情報バー ロード中フォールバック / B-9 情報バー i18n / B-1〜B-6。M11 のサブにはしない。

### 3.8 M12 着手時(先行リリース仕上げ)

> M11(custom_states 開始時状態)は M11-01 + 事後バグ修正まで完了。本節は **M12 = 先行リリース仕上げ**
> (フェーズ2 の最終マイルストーン。M12-01 UX・正しさ修正 / M12-02 検証データ・seed 整理 / M12-03 統合 E2E +
> 先行リリース配布判定)の起動で、標準連番キットの系譜。**M12 完了 = フェーズ2 完了 = 先行リリース実施点**。

- **起動キット(実物)**: `milestone-startup-kit/m12-startup-kit.md`(プロンプト本文 + 投入ファイル一覧の完成品。
  `m11-startup-kit.md` から流用作成)
- **一次資料(主 handover)**: `docs/handover/m11-to-m12-handover.md`(§0 を持たない。§1 M11 完了状態・
  §2 確定設計判断・§3 M12 への申し送り〔3-a〜3-g〕・§4 M12 スコープ・§5 環境メモ)。読む順序は §1 → §3 → §4。
- **追加投入資料(C グループ)**: `phase2-overview.md` v0.2.0(§M12 = 先行リリース仕上げ)+ **`m12-phase2-memo-triage.md`**
  (`tmp/` 配下・開発者手交・未コミット = 残フェーズ2 全件処遇の索引。出典 = `Memo_Someday.txt`)。
- **重点節(着手前に必ず扱う)**: 残フェーズ2(起き攻め表示バグ / 候補 23 件 / 取込 #30 キャラフィルター維持・
  #29 プルダウン再検討、#28 ノーキャンは除外)の **全件処遇の文書化**(M12 で実装 / フェーズ3+ へ根拠付き送り)/
  修正対象 UI の実コード存在確認(code-facts、M10-4)/ seed 整理範囲の実査(migration 000012 耐久 seed 36 件・
  000015・旧 seed と取込データ共存、M12-02)/ 統合 E2E の E-1 回帰穴(presence-detection 化後の最大リスク、M12-03)。
  M12 主参照は DES-005(UX/画面)/ DES-006(検証)。表記は DES-004、データ項目は DES-003。CHANGE 次回 044。
- **§2 標準資料セットとの差分**: 必読の反省資料は `retrospective-digest.md`(現役教訓の蒸留版)+ `code-facts.md` +
  `docs-map.md`(3 者とも投入直前に再生成)。**Memo トリアージ抜粋を必須投入 #20 に追加(19 → 20 件)**。
  **M11 期間の教訓は retrospective-log §6.6.4(v1.0.39)に記録済み**で digest も再蒸留済み(M11-1〜M11-5)。
- **2 つの実験運用**: (1) 設計担当→開発者の質問を各成果物の **文末に「開発者への確認事項」として集約**(本キット
  限りの試行、有効なら playbook へ恒久化提案)/ (2) 複数ファイル添付時の **受領確認ブロック**(M10 / M11 から継続)。
- **持ち越し課題**: 残フェーズ2 全件処遇が M12 スコープそのもの。handover §3 申し送り = 3-a seed 整理(M12-02 主)/
  3-c E2E 回帰穴 E-1(M12-03)/ 3-d `Optional[T]` 横断昇格(将来設計)/ 3-e 英語ロケール(フェーズ3)/ 3-g
  retrospective への M11 教訓追記(v1.0.39 §6.6.4 で記録済み=解消)。M9 / M10 外後続(`followup-backlog.md`)B-7(M12-02 連動)/ B-8 / B-9 / B-1〜B-6。

### 3.9 M14 着手時(公式データ配布是正・スキーマ整理・DB 同梱)

> フェーズ2 は M12 で完了。フェーズ3「共有・協調・入力拡充」は **M13(データ共有・export/import)からフェーズ3
> キックオフキット(`phase-startup-kit/phase3-kickoff-startup-kit.md`、`/next_phase_kit`)で起動**したため、M13 は
> 連番マイルストーンキットを持たない。**連番マイルストーンキット運用は M14 から再開**する(本節)。M14 は本プロジェクト
> 最重量クラスタ(破壊的マイグレ + 取込削除の共有シンボル移設 + 全キャラ seed + 複数 CHANGE)。

- **起動キット(実物)**: `milestone-startup-kit/m14-startup-kit.md`(`m12-startup-kit.md` から構造流用作成)。
- **一次資料(主 handover)**: `docs/handover/phase3/m13-to-m14-handover.md`(§0 を持たない。§1 M13 完了・§2 設計判断・
  §3 申し送り 3-a〜3-d・§4 M14-RESEARCH-01 評価・§5 M14 サブ構成骨子・§6 環境メモ・§7 最初の一手)。読む順序は
  §4 → §5 → §7 主軸 + §1〜§3 前提。
- **追加投入資料(C グループ)**: `phase3-overview.md` v0.3.0(M13〜M20 ドラフト・**組み替えタスクの対象**)+
  `phase2-to-phase3-handover.md` §2/§3 + `followup-backlog.md §F12`(繰越正本)+ `M14-RESEARCH-01-report.md`(削除安全性の主要インプット)。
- **重点節(着手前に必ず扱う)**: M14-RESEARCH-01 評価の **§4-1 削除安全性**(取込パイプラインと技編集が共有する
  シンボル `IsKnownProperty` / `WarningCode` / `StoredMove` / `DeriveStoredWarnings` の参照経路を code-facts + 実コードで
  全数再確認)/ **§4-3 全キャラ手入力 seed ギャップ** / **§4-4 手入力ツール CSV 照合**。破壊的マイグレは FK=OFF × 明示
  DELETE 同居回避(digest §5・M12-5)・`dbtest.Setup` 波及・次マイグレ 000018。M14 主参照は DES-003 / DES-002 / REQ-001 / DES-001。CHANGE 次回 053。
- **§2 標準資料セットとの差分**: 必読の反省資料は `retrospective-digest.md`(M13 §6.6.6 反映・再蒸留済み)+ `code-facts.md` +
  `docs-map.md`(3 者とも投入直前に再生成)。**必須投入が 24 件**(組み替え依頼 reorg-request を #24 に追加・開発者手交)。
- **開発者依頼の組み替えタスク(II)**: `combmgr-phase3-reorg-request.md`(発信者中心への舵切り)の 5 機能群(確定反撃記録 /
  セットプレイ自動提案 / import/export 強化 / 既存フォーマット取込ヘルパー / メディア参照)を `phase3-overview.md` に
  組み替えで取り込む。マイルストーン番号振り直し・CHANGE 起票は reorg §5 が設計担当へ委任(確定反撃 NFR406 のフェーズ4→3
  移設の是非 = REQ §7 矛盾解消が論点)。関連 spec draft は reorg §6 = 固まり次第開発者手交(現時点未配置)。
- **持ち越し課題**: フェーズ3 繰越正本は `phase2-to-phase3-handover.md §3`(A〜H 群)/ `followup-backlog.md §F12`。
  **M13 で F12-7(データ保護・export + FS 監査)解消**。M14 主要繰越 = handover §3-a DES-001 §2.1/§4.1 是正(M14 で CHANGE)/
  §3-b 配布健全化(LICENSE・README)/ §4 RESEARCH 評価。

### 3.10 M16 着手時(データモデル拡充・スキーマの継ぎ目)

> M15(入力・使いやすさ向上 = friend FB 第一波)は M15-01〜06 まで完了(2026-07-04・全サブ非スキーマ・CHANGE-056〜059)。
> M15 はフェーズ3 マイルストーン再編も担い `phase3-overview.md` を v1.1.2 として承認済み(M15 の起動は `/next_phase_kit` 派生の
> `m15-startup-kit.md` で実施)。本節は **M16 = データモデル拡充・スキーマの継ぎ目** の起動で、標準連番キットの系譜。
> **M15 = 非スキーマ/UX から M16 = スキーマ変更・§6 承認ゲート・SF6 ドメイン判断へ性格が変わる**。以下はスタブ(重点節等の
> 詳細は M16-overview 起票フェーズで開発者と Web 版設計担当の協議で後埋め)。

- **起動キット(実物)**: `milestone-startup-kit/m16-startup-kit.md`(`m15-startup-kit.md` から構造流用作成。`/next_milestone_kit M16`)。
- **一次資料(主 handover)**: `docs/handover/phase3/m15-to-m16-handover.md`(**§0 あり**。§0 まず読む → §1 M15 完了 → §3 M16 申し送り →
  §4 M15-07 処遇 → §7 最初の一手 主軸 + §2/§5/§6/§8 前提)。読む順序は同書 §0 起点。
- **M16 スコープの正本**: `phase3-overview.md` v1.1.2 **§M16 / §2.4(承認ゲート G-a〜G-k)**(⚠ supp-001 §4.1 は M0〜M7 のみで
  M16 非記述)。datamodel-issues ①ゲージ属性(SA 消費列)/ ②ドライブ小数 / ③起き攻め正規化 / ④ステップ taxonomy + 移動
  system move 登録 / ④' target_combo 区分正典化 / ④'' dash 二重表現一本化。
- **追加投入資料(開発者手交)**: `friend-feedback-datamodel-issues`(M16 ①〜④ の一次詳細 spec。実体は `docs/human-notes/future-notes/combmgr-friend-feedback-datamodel-issues.md` にコミット済み・Web版へは開発者投入)を必須 #21 へ差し替え
  (旧 replan-input を廃止 = 再編は phase3-overview v1.1.2 で完了)。punish-finder / creator-benefits 等の詳細 spec は任意・固まり次第手交。
- **重点節(着手前に必ず扱う・後埋め)**: 承認ゲート棚卸しと着手順(④ taxonomy → ④'' dash 一本化 / ④' target_combo / ① 始動-消費の
  データ確定 → 旧 M15-07 表記 rollout)/ 既存データ影響(FR301 dup・レシピ同一性・recipe_cache 波及)/ M14-03b(全キャラ seed = M16 前提)/
  ② drive 小数・③ 起き攻め正規化前倒しのドメイン確認。DES-003 / DES-004 §2.1 / SUPP-001 §3.3.3 が M16 主参照。CHANGE 次回 060。
- **【M16 固有の依頼①】旧 M15-07 = M16 表記 rollout**: 「M16 依存表記の追従(FB⑥⑨⑪⑬)」を M16 末尾サブとして ④ taxonomy /
  ① 始動-消費 のデータ確定後に配置(順序を逆にすると誤ラベル。M17 でなく M16 担当。handover §4)。
- **【M16 固有の依頼②】worktree 並列可否の明示**: M16-overview の §3「依存」列 + §5「依存関係・進行順序」で、各サブの
  worktree 並列可(相互独立)/ 直列必須(スキーマ/データ依存)を明示(開発者は 2〜3 並列運用。M16 は承認ゲート連鎖で直列寄り・
  並列化は独立性の高いタスク群に限定 = retro-002-M1 R-04。書式手本 = M15-overview §5 / M14-overview §5 の依存注記)。
- **§2 標準資料セットとの差分**: 必読の反省資料は `retrospective-digest.md` + `code-facts.md` + `docs-map.md`(3 者とも投入直前に
  再生成)。**⚠ retrospective-digest は M15-03〜06 教訓が未反映**(一時ノート 4 本が retrospective-log 未転記・handover §6-2)= 早期
  タスクで転記 → 再蒸留。**M14 教訓は記録済み**。progress-summary は M0〜M15。
- **持ち越し課題**: handover §6 = M15-overview 更新(未反映)/ retrospective-log 転記(TMP 手交待ち)/ followup 追記(PC/タブレット
  初回案内)/ M14-03b(M16 前提・M16 後/M17 前・配布 blocker)/ NFR406 移設(M18 前)/ 旧 M15-07 = M16 表記 rollout。

### 3.11 M17 着手時(発信者の流通基盤 = import/export 強化・取込ヘルパー・メディア参照)

> M16(データモデル拡充・スキーマの継ぎ目)は M16-01〜07 + RESEARCH-01 まで全工程完了(2026-07-08・CHANGE-060〜067・
> マイグレ 000019〜000023)。本節は **M17 = 発信者の流通基盤** の起動で、標準連番キットの系譜。**M16 = スキーマ変更・承認ゲート
> から M17 = データ流通・取込ヘルパー・決定論索引へ性格が移る**。**特殊事情**: 次の実装サブは M17 でなく **M14-03b(全キャラ配布
> seed・配布ブロッカー)**で、M17 本体はその後。本セッションは「M17 着手準備 + M14-03b 先行実装サブの指示書化」構成(m16 の
> M15 wrap-up 早期タスク構造の踏襲)。以下はスタブ(重点節等の詳細は M17-overview 起票フェーズで後埋め)。

- **起動キット(実物)**: `milestone-startup-kit/m17-startup-kit.md`(`m16-startup-kit.md` から構造流用作成。`/next_milestone_kit M17`)。
- **一次資料(主 handover)**: `docs/handover/phase3/m16-to-m17-handover.md`(**§0 あり**。§0 まず読む → §1 M16 完了 → §2 設計判断 →
  §3 M14-03b 申し送り → §4 M17 申し送り → §7 最初の一手 主軸 + §5/§6/§8 前提)。読む順序は同書 §0 起点。
- **M17 スコープの正本**: `phase3-overview.md` v1.1.2 **§M17 / §2.3(command 解決)/ §2.4(承認ゲート G-j・G-k)**(⚠ supp-001 §4.1 は
  M0〜M7 のみで M17 非記述)。①command 解決 段階2(G-k・index-only・取込ヘルパー共通化)/ ②G-j メディア 3 フィールド(link/video/image
  相対パス・後方互換 CSV 列末尾追加)/ ③import/export 強化(反復型)。
- **【M17 固有の特殊事情】M14-03b 先行(配布ブロッカー)**: 次の実装サブ = M14-03b(全キャラ配布 seed)。M16 の seed 契約が収束
  したため M16 後・M17 前に投入。過去担当作成 `M14-03-distribution-seed.md`(v1.1.0)を G-i canonical・現行スキーマ(000023)へ照合し、
  handover §3 の seed 契約 6 件〔(a) 移動 system move seed+alias /(b) skip 掃き取りマイグレ 000024 /(c) dup スキャン+再測定 /
  (d) target_combo passthrough /(e) custom_states show_delta+2値+4 キャラ E2E /(f) command 索引源(M17 G-k と共通化)〕を DoD 化。
  clean マイグレ由来 DB から構築。Opus 4.8 + Plan Mode。
- **追加投入資料(開発者手交)**: `command-resolution-request`(M17 command 段階2 一次 spec。実体は `docs/human-notes/future-notes/combmgr-command-resolution-request.md` にコミット済み・Web版へは開発者投入)を必須 #22 へ(旧 M16 の
  friend-feedback-datamodel-issues を差し替え)。M14-03b 先行のため即時必須ではなく M17 段階2 着手時に必須。import/export 改善項目・
  メディア参照の spec draft は任意・固まり次第手交。
- **【新規】設計テンプレ集(必須 #21)**: `design-templates.zip`(8 テンプレ + README)を必須投入に追加。M17/M14-03b の成果物は
  同梱テンプレの章立て・記入指針に従って作成(従来の個別実物添付を集約・実物は書式不足時のみ請求)。投入直前に
  `bash scripts/generate-template-zip.sh` で再生成。必須 21 → 22 件。
- **重点節(着手前に必ず扱う・後埋め)**: M14-03b の seed 契約 DoD 化と着手順 / 4 キャラ(Mai/Lily/Juri/Kimberly)の show_delta ドメイン
  確認 / キャラ数(30→絞る可能性)/ 仮ラベル確定(M16-07 custom_states int)/ M17 の command 段階2 スコープ(index-only・単方向+
  ボタン特殊技)・G-j メディア列・import/export 改善項目の確定順 / worktree 並列可否。DES-004 §2.1・§6 / SUPP-001 §7・§9.9 /
  DES-002 §7.6 が M17 主参照。CHANGE 次回 068。
- **【M17 固有の依頼】worktree 並列可否の明示**: M17-overview の §3「依存」列 + §5「依存関係・進行順序」で各サブの並列可否を明示
  (M17 は取込ヘルパー共通化で直列寄り・G-j メディア列など波及が閉じたサブは並列可。書式手本 = M16-overview §5 / M14-overview §5)。
- **§2 標準資料セットとの差分**: 必読の反省資料は `retrospective-digest.md` + `code-facts.md` + `docs-map.md`(3 者とも投入直前に
  再生成)+ **`design-templates.zip`(成果物テンプレ)**。**M16 教訓は retrospective-log 記録済み・digest 再蒸留済み**(保留なし)。
  progress-summary は M0〜M16(§16 = M16 期間・§17 持ち越し = M17 着手時点)。
- **持ち越し課題**: handover §6 = DES 本体 commit/push(開発者)/ 仮ラベル確定(M16-07)/ リリース前視覚確認 / NFR406 移設(M18 前)/
  M14-03b(配布ブロッカー・先行実装サブ)/ M17 = command 段階2・G-j メディア・import/export 強化。

### 3.12 M18 着手時(確定反撃記録 = 別コンボ materialize・reorg①。M18/M19 限定的並列・中央 + 指示書担当)

> M17(発信者の流通基盤)は M17-01〜04 + M14-03c + M17-05a/b/c/c-fix/d まで全工程完了(2026-07-18・CHANGE-068〜077 三点セット
> 全反映・pattern-D ゼロ)。本節は **M18 = 確定反撃記録(新ドメイン・大 MS)** の起動。**特殊事情**: **M18/M19 は限定的並列**
> (開発者承認 2026-07-18・playbook v2.0.0 §15.5〜§15.7・§21)で、**「中央」+「M18 指示書担当」+「M19 指示書担当」の最大
> 3 チャット構造**。中央が 3 直列リソース(マイグレ連番・CHANGE 番号・DES/REQ 本体)を一元管理する(**連番割り当ての一元化 =
> 今回が初導入**。実行時払い出し・予約帯なし)。以下はスタブ(重点節等の詳細は M18-overview 起票フェーズで後埋め)。

- **起動キット(実物)**: `milestone-startup-kit/m18-startup-kit.md`(**中央用**。`m17-startup-kit.md` から構造流用作成。
  `/next_milestone_kit M18`)+ **派生キット** `m18-instruction-startup-kit.md` / `m19-instruction-startup-kit.md`(指示書担当用。
  投入は中央が先・M18 用は M18-RESEARCH の目処後・M19 用は PoC 先行)。
- **一次資料(主 handover)**: `docs/handover/phase3/m17-to-m18-handover.md`(**中央用**。§0 → **§1 並列運用〔最重要〕** → §2 M17 完了 →
  §3 設計判断 → §5 現行版/採番/環境 → §7 M18 起点 → §8 M19 起点 → §12 最初の一手 主軸 + §4/§6/§9/§10/§11 前提)。
- **M18/M19 スコープの正本**: `phase3-overview.md` v1.1.2 **§M18 / §M19 / §2.4(承認ゲート G-b/c/d/e)**。M18 = 確定反撃の記録と
  別コンボ materialize(出自参照・生成後フォーク・ダメージ規則は開発者確定済み)・G-c combo_punishes・G-b is_projectile+有利フレーム
  算出・G-d 2 層フラグ・G-e 出自参照。M19 = セットプレイ自動提案(確度低・**PoC 先行** = 結果が出るまで本実装指示書を書かない)。
- **最初の一手**: **M18-RESEARCH**(seed 充足の最終確認 + G-b 有利フレーム算出〔飛び道具〕の実装前詰め・read-only・Sonnet 4.6)→
  G-b 算出式設計 → 物理設計 CHANGE(G-b/c/d/e 各個別承認・着手前ゲート = 通知書+registry・DES 反映は実装後)。
- **追加投入資料(開発者手交)**: **確定反撃 spec draft(2026-06-26 改訂版・repo 外)を必須 #21 へ**(旧 M17 の
  command-resolution-request を差し替え)。datamodel-issues 該当は任意手交。**CLAUDE.md は必須 → 任意へ降格**(必須 21 件)。
- **重点節(着手前に必ず扱う・後埋め)**: 並列運用の 3 直列リソース管理の確立(registry v1.69.0・次 078・次マイグレ 000036 以降実査)/
  M18-RESEARCH スコープ / G-b/c/d/e の承認順序 / recovery NULL 技の扱い / 指示書担当チャットの起動時期(M19 は PoC 先行)/
  並列打ち切り基準(§21.5)/ M14-03d(manon CSV 待ち)・03e(luke AI チェック待ち)の別枠管理 / FR301 dup キーの実コード確認(E-19)。
- **§2 標準資料セットとの差分**: 必読は `retrospective-digest.md`(**M17 教訓 E-14〜E-20 反映済み**)+ `code-facts.md` + `docs-map.md`
  (3 者とも投入直前に再生成)+ `design-templates.zip`。**progress-summary は M0〜M16 のまま**(M17 期は progress-log 未転記のため
  未要約 = 補記後に `/update_progress_summary M17`)。playbook は **v2.0.0**(§4.N 参照は不変)。
- **持ち越し課題**: handover §6 = DES/REQ 本体 commit/push(開発者・CHANGE-072〜077 分)/ CHANGE-072〜076 の開発者確認(低)/
  M14-03d/03e(待ち条件付き)/ M20(§G-14b 語彙・§G-11)。

### 3.13 M20 着手時(プリセット管理・カスタムプリセット。★M20∥M21 並列・設計卓 = Claude Code)

> M19(セットプレイ自動提案・reorg②)は 2026-08-10 にクローズ(完了の観点 11 項目達成・CHANGE 三点セット全数反映・pattern-D ゼロ)。
> **★本節から面が変わる**——**親(設計卓)は Claude Code(メインツリー)で動き、反映係の層は廃止**された(開発者裁定 6 件・2026-08-11・
> 正本 `docs/progress/20260811-design-desk-surface-study.md` §9)。**Web 版は親をやめ `parallel-ops` §06 の個別設計チャットへ配置換え。**
> したがって **§2 冒頭の「ナレッジ常設 + Sync now」と §5-1 の投入手順は親には当てはまらない**(個別設計チャットには当てはまる)。

- **起動キット(実物)**: `milestone-startup-kit/m20-startup-kit.md`(**★設計卓 = Code の初回キット**。`m18-close-m19-04-parent-startup-kit.md`
  の節構成から `/next_milestone_kit M20` で生成。**変換規則 19〔面の読み替え〕の初適用**)。
- **★守備範囲は M20 + M21 の並列で、親は 1 つ**。M20 用と M21 用に設計卓を分けない——**契約の発行者が 1 人であることが DES 所有権の
  排他性を構造的に保証する唯一の理由**(`parallel-ops` §04)。層は 親 1(Code・メインツリー)/ サブ設計 = サブエージェント N /
  製造 = worktree 2 本。
- **★資料の渡し方が変わった**: 親は repo の `docs/` を直接 Read/Edit するため**投入という概念が無い**。キット §1 が列挙するのは
  「**起動時に必ず読むパス(15 件)**」と「**必要時に引くパス**」で、線引きの理由は「検索は取りこぼす」ではなく「**読ませすぎを防ぐ**」。
  **鮮度は HEAD**(Sync now 不要)。
- **★武装が最初の 1 手**: `bash scripts/design-desk-arm.sh`(sparse-checkout で実装ソースを作業ツリーから物理排除)。
  **「repo が見える」と「実装が見える」は別**で、見えるようになったのは `docs/` だけ。**武装しないまま成果物を作らせない**
  (`--status` で確認)。解除はセッション内からできない(開発者が端末で行う)。**⚠ クラウドで `git sparse-checkout` が通るかは未検証**
  (`remote-ops` §8 V-6。最初の 1 手で判明する)。
- **一次資料(主 handover)**: `docs/handover/m19-to-m20-handover.md`(**`phase3/` を使わず直下**)。§0 まず読む → §3 運用の機構
  (効いたもの/効かなかったもの)→ §4 実査パス表 → §5 未反映・残タスク → §7 M19 教訓 → §8 最初の一手。
  **★同書は版番号・件数・連番を意図的に書いていない**(M19 期に写し先の失効が 9 回＝D-247)。**キットも同じ方針で実査パス表を主にした。**
  併読 = `m19-close-report.md` §4(既知の限界)・**§5(「やらない」と決めた 8 件＝否定形の記録)**。
- **M20/M21 スコープの正本**: `phase3-overview.md` v1.1.4 **§M20 / §M21**(supp-001 §4.1 は M0〜M7 のみ = 非記述)＋ `M19-overview` §2.x(後続送り)。
  M20 = プリセット管理 UI / カスタムプリセット作成(A-2・DES-004 §6)/ 残り 4 プリセットのエイリアス実データ(A-1)/
  **recipe_cache 無効化トリガ配線(A-3・SUPP-001 §7・eager/lazy が §7 改訂要否に直結)**/ B-1 命名クラスタ / F12-2。
  M21 = 物理コントローラ入力(FR105〜108・Gamepad API)＋コマンド実モーション入力(物理限定)。
- **レーン割り(`parallel-ops` §12)**: **M20 ∥ M21 は好適**(M20＝BE 寄り / M21＝FE 入力系で触る層が縦に割れる)。**条件 2 つ**＝
  (a) **recipe_cache の読み書き契約を M20 所有で凍結**(M20 は並行性バグ修正そのものを含む)(b) **M21 は PoC 先行**(Gamepad 検証が重い)。
  **改善版プロセスの初戦。**
- **重点節(着手前に必ず扱う)**: **★`preset_aliases` の `alias_text` 一意制約**(現行 UNIQUE は `(preset_id, move_id)` のみ。カスタム
  プリセットを取込の**逆引き**辞書に使うなら一意が要件＝1:N だと決定論が壊れる。**followup G-11 / G-14b は同じ実装面なので束ねる**)/
  recipe_cache の eager vs lazy(**M12-2 教訓＝保存済みキャッシュは全表示箇所の全数調査が前提**)/ `official_ja_move` の編集可否
  (DES-004 read-only 再整理)/ ブロック事前割当への移行(`parallel-ops` §02・**写し先 4 か所**)。
- **§2 標準資料セットとの差分**: **投入ではなく直接 Read**。必読は `retrospective-digest`(**⚠ 実質 2026-08-09。M19 終盤の教訓が
  `retrospective-log` へ未マージ＝反映係廃止により digest 再蒸留と log へのバッチマージは親の担当**＝`parallel-ops` §09 V2.4)+
  `code-facts` + `docs-map`(2026-08-11 再生成)+ `docs/instructions/templates/`(Read)+ **`progress-summary`(必読に維持・M19 まで要約済み。
  進行中の現在地はボードを優先)**。playbook は **v2.12.0**(**§12.0 読込の原則 / §12.A 親の Code 手順 / §12.A-2 武装の確認が新設**)。
  **CLAUDE.md は任意**(Code では読めるが**読ませないことが目的**)。
- **持ち越し課題**: `m19-close-report` §6 の 5 束(update 波と同波 / M19 スコープ外の再設計 / API 契約の是正 / 文言・表示 / 文書の整理)。
  **開発者手番**＝改訂 DES の目視確認 2 件・`chain-adjacency-across-units` 型 B の起票承認・`m19-desk-status.md` の廃止。
- **★M20 で観察すること**(本移行の検証): V-6 クラウドでの sparse-checkout / V-7 `/context` 消費(交換トリガの閾値決定)/
  ガードの誤爆率 / 効果測定(指示書 3〜5 本揃った時点・移行前の実測は surface-study §8)/ **resume kit がまだ要るか**
  (followup `resume-kit-necessity-after-code-migration`)。

### 3.14 M22 着手時(協調基盤 = ログイン・データバージョン管理・同時編集安全性。★`M21-07` の起票を先に行う)

**キット**: `milestone-startup-kit/m22-startup-kit.md`(2026-08-15 作成・`/next_milestone_kit M22`)。
**★本キットの守備範囲は 2 つで、順序が決まっている**——**(1) `M21-07` の起票**(モーダル表示中の物理入力の遮断。**CHANGE は `105` を使う**＝**D-384**。サブ名は承認済み＝**D-385**) → **(2) M22 の起票**。

**起動時に必ず読むパス(14 件)**: ボード → registry §1 → `m21-to-m22-handover.md` → `phase3-overview` §M22/§M23/§0 → `M21-overview` §3 → playbook §12.0/§12.A/§12.A-2/§1/§4/§16 → `retrospective-digest` → `code-facts`(節限定)+ `docs-map` → `architecture-patterns` §11 → `followup-backlog` → `progress-summary` §22/§23 → `templates/` → `parallel-ops.html` §02/§04/§05/§06/§12。

**★重点**:

- **CHANGE ブロックが未割当**。098〜111 は全部行き先が決まったので、**新規サブの前に開発者へ請求する**。
- **セキュリティ関連は開発者の承認事項**(`CLAUDE.md` §10)。パスワードハッシュ・認証方式を親が自己判断で決めない。
- **設計前に潰す論点 3 つ**——`version` 列の粒度(コンボ単位か集約単位か)／認証を後付けする際の既存データの扱い／パスワード保管の方式。
- **★`followup-backlog.md` を編集できるのは親だけ**(**D-382**・2026-08-14)。製造の完了報告 §4 に並ぶ更新候補を親が畳む。
- **`retrospective-log` へ M20/M21 期の 4 サブ分が未マージ**(タスク 1)。一次源は `design-reports/` の 4 本 §7。
- **★`parallel-ops` §12 の割り当てに注意**——**M22 は単独直列を推奨**(ログイン・版管理・同時編集は横断関心事で全 API に薄く触るため並列の相手として構造的に不向き)。
- **★範囲が大きく確度は「暫定」**。`phase3-overview` §M22 が自ら「範囲大・着手時分割」と述べており、**スコープを固めること自体が成果物**である。

### 3.15 M23 着手時(データバージョン管理 = `FR601`・ゴミ箱／復元の拡充)

> **★★2026-08-15 に番号が入れ替わった。** `phase3-overview` v1.2.0(開発者裁定 **D-386 (5)**)で旧 M22 を 2 つに割り、**`M23` = データバージョン管理**、**旧 M23(UX 整理・i18n・繰越・リファクタ)は `M24` へ繰り下がった**。**本節より前の版で「M23」と書かれた記述、および `docs/human-notes/` 配下のドラフト・`Memo_Someday.txt` 本文中の「M23」は旧番号である。**

起動キットは `milestone-startup-kit/m23-startup-kit.md`(**M22 のクローズ ＋ M23／M24 の起票**を 1 セッションで扱う。**親は 1 つ**)。

**追加投入資料・重点節**:

- `phase3-overview.md` の **`### M23`**(**★`###` 見出しなので `grep -n '^### '` で当たる**)。
- `M22-overview.md` **§4.2**(`version` の粒度・実測)と **§6**(完了の観点 12 項目 = M22 クローズの判定表)。
- `architecture-patterns.md` **§11**(**「論理削除では CASCADE が効かない」= M23 の出発点**)。
- `code-facts.md` **§10 マイグレーション(DDL)** / **§8 model 構造体** / **§9 repository 構造体**(`deleted_at` の張り方・`version` 列・scan/filter の形)。
- 設計書は `REQ-001` FR601 / FR013、`DES-002`(削除・復元の API)、`DES-003` §3.4 / §3.11、`DES-005`(ゴミ箱画面・取り消しの見せ方)、`DES-006`(復元時のバリデーション)。

**★設計前に潰す論点 4 つ**(いずれも M22 の実測由来):(1) 論理削除・復元は `version` を据え置く(増え方は 3 通り = `+1` / `1` で採番し直す / 据え置き)。(2) `PUT /api/combos/:id` は旧行を論理削除して新行を作るため、**ゴミ箱に「消した覚えのない行」が積まれている**。(3) 論理削除では CASCADE が効かないため、復元時の子データ(`combo_steps` / `combo_setups` / `combo_setup_results` / タグ関連)の扱いが設計判断。(4) **`FR013` の凍結は継続**——`FR601` は「所有者を持たない」を成立させている当の機構である。

**持ち越し**: `Memo_Someday.txt` の `[予定 M23]` 1 件(ゴミ箱から復元するデータのバリデーション)。

### 3.16 M24 着手時(UX 整理・i18n・繰越・リファクタ ＋ 蓄積した改善要望。旧 M23。さらに旧 M20)

`phase3-overview.md` の **`### M24`** が正本。**★`followup-backlog.md` §E(リファクタ・G 群)・§F(配布運用・H 群)が「→ M24(旧 M23。旧 M20)に集約」と明記しており、中身の一次源である。**

**追加投入資料**:

- **`docs/human-notes/m23-someday-parallel-submilestone-plan-draft.md`** … **M24 の一次案(未承認ドラフト・2026-08-13 作成)**。9 パッケージへの分割案・同時実行禁止マトリクス・無条件に取り込まない項目の仕分けを持つ。**★3 点の補正が要る**: (a) 本文中の「M23」は旧番号 (b) 母集団「131 行」は 2026-08-13 時点のスナップショットで、memo はその後 21 行増えている (c) 行番号 `Lnn` は当時のファイルに対する locator でありずれている(ledger には安定 ID を持たせる)。
- **`docs/human-notes/Memo_Someday.txt`** … 要求の一次源。**2026-08-19 に再仕分け済み**(`[予定 M24]` 9 件ほか)。**★本文の散文中に出てくる「M23」は旧番号**(マーカーだけを改番し本文は逐語保持したため)。
- `code-facts.md` **§1 Props** / **§2 queryKey** / **§3 ルート** / **§6 共通ナビリンク**。

**★`parallel-ops` §12 の割り当てに注意**——**M24 は分割**(高衝突の小修正だけ 1 レーンに束ねて直列・低衝突は並列)。**locale キーの大規模 rename は同時に 1 人だけが行う。**

**★M23 と並列にできるかは立証してから決める**——開発者の希望は並列だが、**M23 のゴミ箱・復元の導線は一覧・詳細画面に出る**ため M24 の UI レーンと交差しうる。契約必須 6 項目と E-14 相当の横断表で非交差を示せなければ直列でよい。

### 3.17 M25 以降(フェーズ3 継続 / フェーズ4)

各マイルストーン着手時に、本節へ「追加投入資料・重点節・持ち越し課題」を追記する。
`phase3-overview.md` の最新版のサブ構成・番号を正本とする。**★番号は再編されうる**(2026-08-15 に M22 以降が 1 つずつずれた前例がある)。**過去の資料に書かれた番号は、書かれた日付と `phase3-overview` の版を突き合わせてから読むこと。**

---

## 4. 投入時の注意

- 設計担当 Claude が初回応答で読み込むため、過剰投入は context を消費する。
- 該当マイルストーンに直接関係しない設計書節は省略してよい。
- 製造・レビュー担当が読む CLAUDE.md / 指示書本体 / レビューチェックリストは、設計担当のセッションに
  全件投入する必要はない。各成果物の**書式・粒度の手本は §2.1 の `docs/instructions/templates/`(骨格 +
  記入指針 + ミニ実例。GitHub 直読)で代替**するため、過去成果物の実物を個別添付する必要はない。
  §3 各マイルストーン欄の「テンプレート参照用: 〜の指示書とレビューチェックリスト」はテンプレ集導入前の
  運用の記録であり、実物の worked example が別途要る場合のみ直読パスを示す(直読不能時のみ任意投入)。

---

## 5. 投入後の流れ

> **★【2026-08-11】親(設計卓 = Claude Code)の場合は下記 1 が不要**(投入という概念が無い)。代わりに: (a) `git status` をクリーンにする
> (武装は排除対象に未コミット変更があると `exit 1` で失敗する)(b) ブランチを `claude/desk-YYYYMMDD-N` にする(**設計卓ブランチから
> 製造を分岐させない**＝`remote-ops` §6.1)(c) キット §2 のプロンプト 1 本を貼る(**先頭に武装コマンドが入っている**)
> (d) 親が `bash scripts/design-desk-arm.sh` を実行して報告するのを確認する(「作業ツリーに残した領域: docs .claude scripts」が出れば OK)。
> **下記 1 は個別設計チャット(Web 版)向けとして現役。**

1. 開発者が資料を **2 系統**で用意する(**2026-07-30 ナレッジ化**・2026-07-20 直読切替の続き): (a) **恒久資料はプロジェクトナレッジに常設**しておく——**毎回渡さない**。派生資料 3 件(code-facts / docs-map / retrospective-digest)を再生成 → commit + push した後、Web 版プロジェクトの GitHub ナレッジで **「Sync now」**を実行して鮮度を上げる。(b) **ロック・counter・状態・当該セッション固有の資料は、キット §1 Ⅱ の明示パスで直読させる**(ナレッジ検索に委ねない)。**フォールバック(直読不能時・PC 手動投入)**: 従来どおり手動アップロードする(`design-templates.zip` は `bash scripts/generate-template-zip.sh` で再生成した版を渡す)。
2. 設計担当が初回応答で資料を確認し、`M{N}-overview.md` 起票準備を完了する。
3. 開発者が M{N}-overview の協議に入る。
4. M{N}-overview 確定後、`M{N}-{NN}-{name}.md` サブマイルストーン指示書の起票へ進む。

---

## 6. 更新履歴

| 版 | 更新日 | 更新内容 |
|----|--------|---------|
| 2026-08-19 | **§3.15 を「M23 着手時(データバージョン管理＝`FR601`)」へ全面書き換えし、§3.16「M24 着手時」・§3.17「M25 以降」を新設**(`/next_milestone_kit M23` の副成果物)。**★旧 §3.15 は失効していた**——「M23 = UX 整理・i18n・繰越・リファクタ」と書いていたが、`phase3-overview` v1.2.0(**D-386 (5)**・2026-08-15)で**旧 M23 は M24 へ繰り下がり、M23 はデータバージョン管理になっていた**。§3.17 に「過去の資料の番号は書かれた日付と `phase3-overview` の版を突き合わせてから読む」旨を明記した |
| 2.1.0 | 2026-08-11 | **★親(設計卓)の面が Claude Web → Claude Code へ移った**(開発者裁定 6 件・正本 `docs/progress/20260811-design-desk-surface-study.md` §9)ことを本書へ反映。**Web 版は親をやめ `parallel-ops` §06 の個別設計チャットへ配置換え・反映係の層は廃止**。**§2 冒頭と §5 冒頭に「本節より優先」の面の注記を新設**——親には「投入」という概念が無く(repo の `docs/` を直接 Read/Edit する)、§2 の「ナレッジ常設 / 直読」の線引きと §5-1 の投入手順は**個別設計チャット向けとしてのみ現役**。キット §1 の線引きは「**起動時に必ず読む / 必要時に引く**」で、理由も「検索は取りこぼす」→「**読ませすぎを防ぐ**」へ入れ替わった。**★親は実装ソースを読まない**——`scripts/design-desk-arm.sh` の武装(sparse-checkout で物理排除)が担保し、実装の事実は code-facts → Explore サブエージェント → 製造への実査依頼 の順で取る(playbook §12.0)。**プレースホルダ §3.13「M20 以降」を §3.13「M20 着手時(プリセット管理・カスタムプリセット。★M20∥M21 並列・設計卓 = Code)」として具体化**(`/next_milestone_kit M20`)。起動キット = `milestone-startup-kit/m20-startup-kit.md`(**変換規則 19 の初適用**)、主 handover = `m19-to-m20-handover.md`(**`phase3/` を使わず直下・版番号を意図的に書かない方針＝D-247**)+ `m19-close-report.md` §4/§5。**★守備範囲は M20 + M21 の並列で親は 1 つ**(`parallel-ops` §04・§12「改善版プロセスの初戦は M20∥M21」。条件＝recipe_cache の契約を M20 所有で凍結・M21 は PoC 先行)。重点節＝**`preset_aliases` の `alias_text` 一意制約**(逆引き辞書に使うなら要件・followup G-11／G-14b を束ねる)/ recipe_cache の eager vs lazy(M12-2 教訓)/ `official_ja_move` 編集可否 / ブロック事前割当(写し先 4 か所)。**digest は M19 終盤の教訓が未マージ**(反映係廃止により再蒸留は親の担当＝`parallel-ops` §09 V2.4)。**M20 の観察項目**＝V-6 クラウドでの sparse-checkout / V-7 `/context` 消費 / ガード誤爆率 / 効果測定 / resume kit の要否。**新規プレースホルダ §3.14「M22 以降」を追加**(§12 の割り当て注記付き＝M22 は単独直列推奨・M23 は分割) |
| 2.0.0 | 2026-07-30 | **「毎回投入する」から「プロジェクトナレッジ常設 ＋ セッション固有だけ直読」へ切替**(開発者指示 2026-07-30。2026-07-20 の GitHub 直読切替の続き)。**§2 冒頭に線引きの表と根拠を新設**＝バルク参照(設計書本体・playbook・digest・code-facts・docs-map・architecture-patterns・followup-backlog・model-allocation・`templates/`)は**ナレッジ常設で毎回渡さない**／**ロック・counter・状態**(ボード・契約・`change-number-registry`)と**当該セッション固有**(引き継ぎ・overview・一次 spec)は**検索に委ねず明示パスで直読させる**。**根拠＝`docs/process/parallel-ops.html` §10**(ナレッジは検索ベース取得で取りこぼす。実例あり)。**番号・現行版の要点は起動プロンプト本文に載せ、同期が多少古くても成立する設計にする**。**§5-1 の投入手順を 2 系統へ**書き換え。**§2.1 / §2.2 の表は「何がナレッジに入っている必要があるか」の一覧として読む**旨を明記。`retrospective-log` は渡さない(必読は digest・log は反映係が扱う)／`progress-summary`・`progress-log` は要求させない |
| 1.9.0 | 2026-07-09 | M16(データモデル拡充・スキーマの継ぎ目)全工程完了 → M17 着手に伴い、プレースホルダ §3.11「M17 以降(フェーズ3 継続)」を §3.11「M17 着手時(発信者の流通基盤 = import/export 強化・取込ヘルパー・メディア参照)」スタブとして具体化(`/next_milestone_kit M17`)。起動キット = `milestone-startup-kit/m17-startup-kit.md`(`m16-startup-kit.md` から構造流用)、主 handover = `m16-to-m17-handover.md`(**§0 あり**・読む順序 §0 起点)、M17 スコープ正本 = `phase3-overview.md` v1.1.2 §M17 / §2.3 / §2.4 承認ゲート G-j/G-k(supp-001 §4.1 は M0〜M7 のみ = M17 非記述)。**M17 固有の特殊事情**: 次の実装サブは M17 でなく M14-03b(全キャラ配布 seed・配布ブロッカー)= キットは「M17 着手準備 + M14-03b 先行実装サブの指示書化」構成(m16 の M15 wrap-up 早期タスク構造の踏襲・handover §0/§7)。追加投入 = `command-resolution-request`(M17 command 段階2 一次 spec・開発者手交・必須 #22 = 旧 friend-feedback-datamodel-issues を差し替え)+ **【新規】`design-templates.zip`(成果物テンプレ・必須 #21)**(従来の個別実物添付を集約)、必須 21 → 22 件。M14-03-distribution-seed.md を M14-03b 先行の主参照として任意へ。重点節(M14-03b seed 契約 DoD・4 キャラ show_delta ドメイン確認・仮ラベル確定・M17 command 段階2 スコープ・G-j メディア列・import/export 改善項目・worktree 並列可否)・持ち越し課題(handover §6)を反映。CHANGE-060〜067 反映(DES-002 v1.30.0 / DES-003 v1.29.0 / DES-004 v1.11.0 / DES-005 v2.39.0 / DES-006 v1.17.0 / SUPP-001 v1.27.0、マイグレ 000019〜000023)、次回 068。新規プレースホルダ §3.12「M18 以降(フェーズ3 継続)」を追加。派生資料(code-facts/docs-map 2026-07-09・`62e2e05`、retrospective-digest 再蒸留、progress-summary M0〜M16、design-templates.zip 8 テンプレ)を全リフレッシュ |
| 1.8.0 | 2026-07-04 | M15(入力・使いやすさ向上 = friend FB 第一波)完了 → M16 着手に伴い、プレースホルダ §3.10「M15 以降(フェーズ3 継続)」を §3.10「M16 着手時(データモデル拡充・スキーマの継ぎ目)」スタブとして具体化(`/next_milestone_kit M16`)。起動キット = `milestone-startup-kit/m16-startup-kit.md`(`m15-startup-kit.md` から構造流用)、主 handover = `m15-to-m16-handover.md`(**§0 あり**・読む順序 §0 起点)、M16 スコープ正本 = `phase3-overview.md` v1.1.2 §M16 / §2.4 承認ゲート G-a〜G-k(supp-001 §4.1 は M0〜M7 のみ = M16 非記述)。追加投入 = `friend-feedback-datamodel-issues`(開発者手交・必須 #21 = 旧 replan-input を差し替え。再編は phase3-overview v1.1.2 で完了)。重点節(承認ゲート棚卸し・着手順・既存データ影響・M14-03b 前提・正規化前倒しのドメイン確認)・持ち越し課題(handover §6)を反映。**M16 固有の 2 依頼**: 旧 M15-07(FB⑥⑨⑪⑬ 表記追従)を M16 末尾「M16 表記 rollout」として ④ taxonomy / ① 始動-消費 確定後に配置(handover §4)/ M16-overview の §3 依存列 + §5 依存関係・進行順序で各サブの worktree 並列可否を明示(2〜3 並列想定・M16 は直列寄り・retro-002-M1 R-04 制約)。※M15 は `/next_phase_kit` 派生キットで起動したため本ガイドに個別節を持たない(§3.10 を M15 以降プレースホルダから M16 へ直接具体化)。新規プレースホルダ §3.11「M17 以降(フェーズ3 継続)」を追加 |
| 1.7.0 | 2026-06-29 | M13(データ共有・export/import)完了 → M14 着手に伴い、プレースホルダ §3.9「M13 以降(フェーズ3)」を §3.9「M14 着手時(公式データ配布是正・スキーマ整理・DB 同梱)」として具体化(`/next_milestone_kit M14`)。起動キット = `milestone-startup-kit/m14-startup-kit.md`(`m12-startup-kit.md` から構造流用)、主 handover = `m13-to-m14-handover.md`(§0 なし・読む順序 §4→§5→§7 主軸)、追加投入 = `phase3-overview.md`(組み替え対象)+ `phase2-to-phase3-handover.md` + `followup-backlog §F12` + `M14-RESEARCH-01-report.md`。重点節(削除安全性 §4-1・全キャラ seed ギャップ §4-3・ツール CSV 照合 §4-4・破壊的マイグレ規律)・持ち越し課題(F12-7 = M13 解消、handover §3-a/§3-b/§4)を反映。**M13 はフェーズ3 キックオフキットで起動し連番キット不在のため連番運用を M14 から再開**。**開発者依頼の組み替えタスク**(reorg-request の 5 機能群を phase3-overview へ取り込む・確定反撃 NFR406 のフェーズ4→3 移設の是非)を明記、必須投入 24 件(reorg-request #24)・retrospective-digest を M13 §6.6.6 反映へ再蒸留を注記。新規プレースホルダ §3.10「M15 以降(フェーズ3 継続)」を追加 |
| 1.0.0 | 2026-05-16 | ドキュメント整理に伴い新設。M3 完了時点の実態を反映 |
| 1.1.0 | 2026-05-22 | M4 完了 → M5 着手に伴い §3.2「M5 着手時(比較系)」を新設。重点節・持ち越し課題(C-2 / C-3 / C-4 / L-02 / L-03)・M4 期間最重要教訓(playbook §4.9 / §1.4 / §13.4)を反映。§3.2 を §3.3 にシフト(M6 以降のテンプレート用) |
| 1.2.0 | 2026-05-23 | M5 完了 → M6 着手に伴い §3.3「M6 着手時(初期体験系)」を新設。重点節(DES-005 §5.1/§5.2/§5.7/§5.16、SUPP-001 §4.2/§3.6)・持ち越し課題(R-1〜R-3 / M-1〜M-4 / C-2〜C-4 / L-02〜L-03)・M5 期間運用知見(調査担当 Claude Code 運用、反省 3 件)を反映。旧 §3.3 を §3.4 にシフト(M7 以降のテンプレート用) |
| 1.3.0 | 2026-05-26 | M6 完了 → M7 着手に伴い §3.4「M7 着手時(仕上げ)」を新設。重点節(DES-005 全画面、DES-001 §2、SUPP-001 §4.1/§7)・持ち越し課題(P-1 / 残課題 1/3/4 関連 / R-1〜R-3 / M-1〜M-4 / C-2〜C-4 / L-02〜L-04 / スマホ LAN / 日英切替)・M6 期間運用知見(CHANGE-016 ハイブリッド分担、対応表 UI 全範囲拡張、P-1 フェーズ 2 送り、反省 11 件)を反映。旧 §3.4 を §3.5 にシフト(M8 以降のテンプレート用) |
| 1.4.0 | 2026-06-08 | フェーズ2 M9 着手に伴い §3.5「M9 着手時(FR701 公式フレームデータ取込ツール・並列委任)」を新設。標準連番ではなく外部ツール設計を別チャットの専任設計担当へ委任する並列キット(`milestone-startup-kit/m9-fr701-importer-startup-kit.md`)で進める旨、一次資料 = 委任ブリーフ、投入はブリーフ §7「引き渡しパッケージ」厳密準拠、技術スタック選定(M9-RESEARCH)を含む特殊スコープ、本体 CHANGE 対象外(CSV 契約波及時は申し送り)を反映。M8(moves スキーマ)はフェーズ2 キックオフチャットで実施のため個別節なしの旨を注記。旧 §3.5 プレースホルダを §3.6「M10 以降」にシフト |
| 1.5.0 | 2026-06-17 | M9(公式データ取込パイプライン)完了 → M10 着手に伴い、プレースホルダ §3.6「M10 以降」を §3.6「M10 着手時(複数キャラ登録 UI)」として具体化(`/next_milestone_kit M10`)。起動キット = `milestone-startup-kit/m10-startup-kit.md`、主 handover = `m9-to-m10-handover.md`、重点節(ComboEditor リュウ固定箇所の実コード特定・登録系 API の character_id 契約・useCharacters 踏襲・キャラ切替連動)・持ち越し課題(A-1 / A-2 = M10 スコープ、M9 外後続 backlog B-1 / B-2-heavy / B-3 / B-5)を反映。FR701 引き継ぎ 2 本は任意降格。新規プレースホルダ §3.7「M11 以降」を追加 |
| 1.6.0 | 2026-06-21 | M11(custom_states 開始時状態)完了 → M12 着手に伴い、プレースホルダ §3.8「M12 以降」を §3.8「M12 着手時(先行リリース仕上げ)」として具体化(`/next_milestone_kit M12`)。起動キット = `milestone-startup-kit/m12-startup-kit.md`、主 handover = `m11-to-m12-handover.md`(§0 なし・読む順序 §1→§3→§4)、追加投入 = `phase2-overview.md` §M12 + `m12-phase2-memo-triage.md`(残フェーズ2 全件処遇の索引・開発者手交)。重点節(残フェーズ2 全件処遇の文書化・seed 整理範囲の実査・統合 E2E の E-1 回帰穴)・持ち越し課題(handover §3 申し送り 3-a / 3-c / 3-d / 3-e / 3-g、followup-backlog B-7〜B-9)を反映。**Memo トリアージ抜粋を必須投入 #20 に追加(19 → 20 件)**、2 つの実験運用(質問の文末集約 / 受領確認ブロック)を注記。新規プレースホルダ §3.9「M13 以降(フェーズ3)」を追加(フェーズ2 は M12 で完了)。※§3.7「M11 着手時」の新設は履歴未記載だった(M11 キット作成時)|
| 1.7.0 | 2026-07-19 | M17(発信者の流通基盤)全工程完了 → M18 着手に伴い、プレースホルダ §3.12「M18 以降」を §3.12「M18 着手時(確定反撃記録 = 別コンボ materialize・reorg①。M18/M19 限定的並列・中央 + 指示書担当)」として具体化(`/next_milestone_kit M18`)。**M18/M19 限定的並列運用(playbook v2.0.0 §15.5〜§21)を反映**: 起動キットは中央用 `m18-startup-kit.md` + 派生指示書担当キット `m18-instruction-startup-kit.md` / `m19-instruction-startup-kit.md` の 3 本構成(中央 = 連番・CHANGE・DES 反映の一元管理者 = 初導入)。主 handover = `m17-to-m18-handover.md`(中央用・§1 並列運用が最重要)。必須 #21 = 確定反撃 spec draft(開発者手交)・CLAUDE.md 任意降格 = 必須 21 件。progress-summary は M0〜M16 のまま(M17 期は progress-log 未転記のため未要約)の注記付き。新規プレースホルダ §3.13「M20 以降(フェーズ3 継続)」を追加(M20〜M23 の概要付き) |

---

*以上*
