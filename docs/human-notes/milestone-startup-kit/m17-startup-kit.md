# M17(発信者の流通基盤 = import/export 強化・取込ヘルパー・メディア参照)起動キット

> **このファイルは開発者向けの手順書です**(設計担当 Claude Web 版に投入するものではありません)。
> 新しい設計・指示書作成担当チャット(Claude Web 版)を M17 着手のために立ち上げるとき、
> 開発者が (1) どのファイルを投入するか / (2) 最初にどのプロンプトを貼るか を、このキットからコピペします。
>
> **§2「最初のプロンプト」だけが Web チャットに貼る本文**です。§0/§1/§3/§4/§5/§6 は開発者の準備メモです。
>
> 直前の連番キットは `m16-startup-kit.md`(フェーズ3・データモデル拡充・スキーマの継ぎ目)で、
> M16 全工程(M16-01〜07 + RESEARCH-01)完了 → M17 起点へ全面書き換えたものが本キットです。

---

> **本キットの特殊事情(必読・M14-03b 先行)**
>
> `m16-to-m17-handover.md` §0/§7 のとおり、**次の実装サブは M17 ではなく M14-03b**(全キャラ配布 seed・
> **配布ブロッカー**・M16 の seed 契約が収束した最優先実装サブ・Opus 4.8 + Plan Mode)です。M17(発信者の
> 流通基盤 = command 解決 段階2・メディア参照・import/export 強化)は **M14-03b の後**に来ます。
>
> 本セッションは **M17 着手準備を主軸**としつつ、**冒頭の早期タスクとして M14-03b の指示書化を先に片付ける**
> 構成です(m16 キットが M15 wrap-up を早期タスクに置いた構造の踏襲)。「M17 の設計」と言われても、まず
> M14-03b が前提であることを忘れないでください。

---

## 0. 本キットの位置づけ / 新セッションの作業順序(必読)

### 0.1 時系列

- フェーズ1(MVP、M0〜M7)完了 → フェーズ2(先行リリース準備、M8〜M12)完了 → **フェーズ3(共有・協調・入力拡充)**継続中。
- フェーズ3: M13(データ共有 = export/import、CHANGE-050〜052)→ M14(公式データ配布是正・スキーマ整理・DB 同梱、
  CHANGE-053〜055、コード完了)→ M15(入力・使いやすさ向上 = friend FB 第一波、CHANGE-056〜059)完了 →
  **M16(データモデル拡充・スキーマの継ぎ目、CHANGE-060〜067)全工程完了**(2026-07-08)。
- **本セッション = M17 着手準備**。ただし **実装の次の一手は M14-03b(全キャラ配布 seed・配布ブロッカー)**で、
  M17 本体(command 解決 段階2・メディア・import/export 強化)は M14-03b の後(§0.3)。
- **フェーズ自体はフェーズ3 のまま**。M17 は新フェーズの開始ではありません。

### 0.2 新セッションの作業順序(`m16-to-m17-handover.md` §0/§7 起点)

> **本セッションは M17 着手準備 + M14-03b 先行実装サブの指示書化**。記憶で進めず、handover 実査 +
> code-facts / 実コード裏取りを徹底(digest §0/§1)。

- **0.** まず `design-instruction-playbook.md`(§1 役割境界・§4.x 原則)と `m16-to-m17-handover.md`(**§0 あり**)を読む。
  `docs-map.md` で文書ID→実パスを引く。読む順序: handover **§0 まず読む → §1 M16 完了 → §2 設計判断
  (M14-03b/M17 に効く 6 件)→ §3 M14-03b 申し送り → §4 M17 申し送り → §7 最初の一手**(§5 現行版/採番/環境・
  §6 未反映残タスク・§8 M16 教訓 を前提として)。
- **本体(早期タスク)**: **M14-03b(全キャラ配布 seed)の指示書化**(§3 seed 契約 DoD を織り込み・Opus 4.8 + Plan Mode)。
- **本体(M17 着手準備)**: **M17(command 解決 段階2・G-k / メディア 3 フィールド・G-j / import/export 強化)の
  棚卸しと overview**(M14-03b 完了後に本格化)。

### 0.3 M14-03b 先行(配布ブロッカー・最優先実装サブ・重要)

- **M14-03b = 全キャラ配布 seed 投入**(現行 HEAD は ryu 中心 → 配布には全 30/31 キャラの実データ seed が必須。
  **配布リリースの blocker**)。M16 が moves スキーマ・taxonomy・custom_states を確定したことで **seed 契約が収束**した
  ため、M16 の直後(= M17 の前)に投入するのが最も churn が少ない(phase3-overview §M14 / followup §C-1)。
- **M16 由来の seed 契約(handover §3)を DoD に織り込む**: (a) 移動 system move(`dash_forward`/`dash_back` ほか)
  全キャラ seed + `preset_aliases` 対 / (b) skip 残行の掃き取り follow-up マイグレ(000024) / (c) 配布 DB 構築時の
  dup スキャン(remap 層 Go)+ dup 再測定 / (d) target_combo passthrough(CHANGE-065)/ (e) custom_states int の
  `show_delta` 付与(Mai/Lily/Juri/Kimberly のドメイン判断)+ 2 値 situation 構造 `{start_min,end}` の取込 +
  Ingrid・4 キャラ E2E / (f) command 索引源の再確立(helper 経由・**判断3・M17 G-k と共通化 =「二度作らない」**)。
- **既存指示書 `M14-03-distribution-seed.md`(v1.1.0・過去担当作成)を G-i canonical 確定・現行スキーマ(000023 まで)へ
  照合してから着手**(clean マイグレ由来 DB から構築 = dev DB 残渣不可、M14-6)。**Opus 4.8 + Plan Mode**。

### 0.4 確定事項の継承(`m16-to-m17-handover.md` §1/§2、再協議不要)

- **dash canonical = 方向別 system move**(`dash_forward`/`dash_back`。DES-004 §2.1/§2.2)。modifier.type 方向別 dash は
  M16-04 で廃止・移行済(000022)。`parry_drive_rush`/`cancel_drive_rush` は modifier.type のまま正。移動 move の全キャラ
  seed + alias は M14-03b。
- **taxonomy 原則**(DES-004 §2.2・DES-003 §3.5): (a) moves 行〔system 含む〕/ (b) 非技 modifier.type〔parry/cancel のみ〕/
  (c) flag。移動 = system move(1入力=1move)。ユーザー表示語彙 =「技」/「共通システム(移動・その他)」(CHANGE-057/066)。
- **target_combo 運用**(DES-003 §3.3・CHANGE-065): 入力支援ツールで人手付与・本体は取込値を信頼(自動判定しない)。
  remap は category=target_combo を通過保存(M14-03b)。
- **custom_states int**(DES-003 §3.2・CHANGE-067): `show_delta` フラグ + per-combo 2 値構造 `{start_min,end}`。situation は
  **opaque = DDL/DTO/BE 不変・dup/recipe 非波及**。4 キャラ def の show_delta 付与・E2E は M14-03b。
- **始動/消費正典**(DES-005・CHANGE-066): 始動 ja =「コンボ開始時の◯◯ゲージ残量」/ 消費「◯◯ゲージ消費」/ en parity。
  register 分離(表示ラベル = 正典 / 検証エラー = 簡潔内部表現・BE 不変)。① VAL 非連動(BE/CSV 非強制・UI クランプ担保・
  DES-006 §2.4/§2.5)。
- **判断3 = command 索引化方針(M17)**: command は M14-01(000018)で本体除去済。M17 段階2 の索引源は **index-only 推奨**
  (列復活せず seed/helper から再構築)。本体 net-new 取込スクリプト = M14-03b remap + M17 G-k 索引化で command 吸収。
  段階2 スコープ = 単方向 + ボタンの特殊技のみ決定論解決(溜め `charge_*`・一回転 `circle`・空中特殊技は「直接指定」)。

### 0.5 worktree 並列実行と overview の依存注記(開発者運用・重要)

- 開発者は git worktree による並列実行(2〜3 並列想定)を運用。**overview の §3「依存」列 + §5「依存関係・進行順序」で、
  各サブが「worktree 並列可(相互独立)」か「直列必須(先行サブのデータ/スキーマ確定に依存)」かを明示**すること。
- **M14-03b は単一の大サブ(配布 seed・Plan Mode)**で、それ自体は並列化対象ではない。**M17(command 段階2)も
  取込ヘルパー(M14-03b remap)と索引エンジンを共通化する = M14-03b に依存**するため直列寄り。独立に切り出せるサブ
  (例: G-j メディア列追加 = 波及が閉じた任意列追加)があれば「並列可」と明示。既存 M15-overview §5 /
  M14-overview §5 の逆依存注記が書式の手本(並列化は指示書完成度が高く独立性の高いタスク群に限定)。

---

## 1. 投入ファイル一覧(開発者用・パス付き)

Web チャットへアップロードするファイル。**必須**は初回投入、**任意**は対話の中で要望が出たとき・
必要になったときに渡す。

> **投入直前の鮮度更新(必須)**: `code-facts.md` は `/regen_code_facts`、`docs-map.md` は `/regen_docs_map`、
> `retrospective-digest.md` は `/retrospective-digest-update`、`design-templates.zip` は
> `bash scripts/generate-template-zip.sh` で **投入直前に再生成し、現行コード / 構成 / 最新教訓 / テンプレ本体と
> 一致させた版を貼る**こと。最終的な正は常に実コード / 実ファイル / Playbook §2 等の運用ルールで、これらは静的抽出・
> テンプレゆえの限界がある。
> **⚠ 本キット生成時点の鮮度状況**: code-facts / docs-map は 2026-07-09(commit `62e2e05`)再生成済み(マイグレ
> **000023 まで**反映)。retrospective-digest は M16 全教訓(M16-1〜7 + §6.6.10 C-1〜C-5)反映済み。progress-summary は
> **M0〜M16 まで追いついた**(§16 = M16 期間・§17 持ち越し = M17 着手時点)。design-templates.zip は 8 テンプレ収録の最新版。

### 必須(初回投入・計 22 件)

**A. 設計書本体(プロジェクト恒久・真の情報源)**

| # | ファイル名 | リポジトリ上のパス | 種別 |
|---|-----------|------------------|------|
| 1 | requirements.md | `docs/design/requirements.md` | REQ-001 v2.16.0(§7 = 4 フェーズ定義。**NFR406 フェーズ移設の CHANGE を M18 前に見込み**) |
| 2 | 01-tech-stack.md | `docs/design/01-tech-stack.md` | DES-001 v1.4.0 |
| 3 | 02-architecture.md | `docs/design/02-architecture.md` | DES-002 v1.30.0(**M17 で取込ヘルパー IF・CSV 契約 §7.6 の改訂見込み**) |
| 4 | 03-data-model.md | `docs/design/03-data-model.md` | DES-003 v1.29.0(**M17 で G-j メディア 3 列・G-k command 索引源の CHANGE 候補**) |
| 5 | 04-notation-spec.md | `docs/design/04-notation-spec.md` | DES-004 v1.11.0(**§2.1・§6 = command 索引・move_code 決定論解決 = M17 段階2 の根拠**) |
| 6 | 05-screen-design.md | `docs/design/05-screen-design.md` | DES-005 v2.39.0(**M17 で import/export UI・メディア参照表示の改訂見込み**) |
| 7 | 06-validation.md | `docs/design/06-validation.md` | DES-006 v1.17.0(§2.4/§2.5 が custom_states・消費の非連動をカバー。M17 で import 検証の判断) |
| 8 | supp-001-detailed-design.md | `docs/design/supp-001-detailed-design.md` | SUPP-001 v1.27.0(**§7 recipe_cache・§9.9 token→索引キー正規化が M17 段階2 に効く**。§4.1 は M0〜M7 のみ = **M17 非記述**) |

**B. 設計担当の恒久資料(運用ルール・反省・パターン・機械的事実)**

| # | ファイル名 | リポジトリ上のパス | 種別 |
|---|-----------|------------------|------|
| 9 | design-instruction-playbook.md | `docs/handover/design-instruction-playbook.md` | 運用ルール集(v1.12.0。最初に読む。§1 役割境界・§4.11/§4.12 マイルストーン構造の独断拡張禁止・§4.13 i18n 両ロケール・§16 CHANGE 手順) |
| 10 | retrospective-digest.md | `docs/handover/retrospective-digest.md` | **設計担当ミス蒸留版**(現役教訓のみ。**起動時必読**・指示書執筆前に毎回読む。投入直前に `/retrospective-digest-update` で再蒸留。M16 教訓 M16-1〜7 + C-1〜C-5 反映済み) |
| 11 | code-facts.md | `docs/handover/code-facts.md` | **機械的事実の参照元**(Props・queryKey・フロントルート・Go ルート↔ハンドラ・config・ナビ・DTO・model・repository・マイグレ DDL。想定で書かず必ず引く。投入直前に `/regen_code_facts` で再生成。**2026-07-09 / commit `62e2e05`・000023 まで反映**) |
| 12 | docs-map.md | `docs/handover/docs-map.md` | **文書ID ⇄ 実パス・役割マップ**(設計担当はファイル構成を直接見られない。`DES-003` 等の実パス逆引き。投入直前に `/regen_docs_map` で再生成。**2026-07-09 / commit `62e2e05`**) |
| 13 | architecture-patterns.md | `docs/handover/architecture-patterns.md` | 確立アーキテクチャパターン(§7 recipe_cache・§9 custom_states 消費非モデル化・§10 LAN・§1.1 queryKey・§2.1 サービス層 IF。**取込ヘルパー・recipe_cache 波及の判断材料**) |
| 14 | change-number-registry.md | `docs/handover/change-number-registry.md` | CHANGE 番号運用(**次回採番 068**。欠番 008 / 009 / 014。直近 = CHANGE-060〜067 = M16 反映) |

**C. フェーズ3 / M17 引き継ぎ(本セッション固有・差分情報)**

| # | ファイル名 | リポジトリ上のパス | 種別 |
|---|-----------|------------------|------|
| 15 | m16-to-m17-handover.md | `docs/handover/phase3/m16-to-m17-handover.md` | **主引き継ぎ書**(**§0 あり**。§0 まず読む・§1 M16 完了・§2 設計判断〔M14-03b/M17 に効く 6 件〕・§3 M14-03b 申し送り・§4 M17 申し送り・§5 現行版/採番/環境・§6 未反映残タスク・§7 最初の一手・§8 M16 教訓ダイジェスト) |
| 16 | phase3-overview.md | `docs/instructions/phase3-overview.md` | **フェーズ3 マイルストーン分割の正本**(v1.1.2・承認済み、M13〜M23)。**§M17 と §2.3(command 解決)・§2.4 承認ゲート G-j/G-k が M17 スコープの正本**。番号振り直し・実装順・CHANGE 起票は設計担当委任 |
| 17 | followup-backlog.md | `docs/handover/followup-backlog.md` | **フェーズ3 繰越・生きた計画資料**。**§C M14 論点(C-1 配布完了定義 = M14-03b DoD)** / §A friend FB / §D M13 統合可否 / §E リファクタ / §F 配布・運用 |

**D. 進捗・配分**

| # | ファイル名 | リポジトリ上のパス | 種別 |
|---|-----------|------------------|------|
| 18 | progress-summary.md | `docs/progress/progress-summary.md` | 進捗要約 **M0〜M16**(§15 = M15 期間・§16 = M16 期間・§17 持ち越し = M17 着手時点)。M16 をキャッチアップ要約済み |
| 19 | model-allocation.md | `docs/human-notes/model-allocation.md` | モデル配分(v1.30.0。**M14-03b = Opus 4.8 + Plan 追記済**・M17 サブは着手時追記。**スキーマ/データ/配布は Opus 4.8 + Plan Mode 基本**) |

**E. プロジェクト指針**

| # | ファイル名 | リポジトリ上のパス | 種別 |
|---|-----------|------------------|------|
| 20 | CLAUDE.md | `CLAUDE.md`(リポジトリルート) | 製造担当向け指針(設計担当も概要把握・編集境界 §8・禁止事項 §10・**§10.X ブラウザストレージ許容表**のため一読) |

**F. 設計テンプレ集(各成果物の書式・粒度の手本)**

| # | ファイル名 | リポジトリ上のパス | 種別 |
|---|-----------|------------------|------|
| 21 | design-templates.zip | `docs/instructions/templates/design-templates.zip` | **設計テンプレ集**(指示書 / レビューチェックリスト / overview / phase-overview / RESEARCH / CHANGE 通知書 / change-report の各テンプレ = 骨格 + 記入指針 + ミニ実例、計 8 件 + README)。M17/M14-03b の各成果物を書くときの**書式・粒度の手本**。**投入直前に `bash scripts/generate-template-zip.sh` で再生成**した版を貼ること。最終的な正はテンプレでなく Playbook §2 等の運用ルール |

**M17 / M14-03b 一次 spec 用(開発者手交)**

| # | ファイル名 | リポジトリ上のパス | 種別 |
|---|-----------|------------------|------|
| 22 | command-resolution-request(command 解決 spec) | (**開発者が別途手交。リポジトリ未コミット・repo 外**) | **M17 command 解決 段階2 の一次 spec**(§1-2 = 段階1/段階2 スコープ・token→索引キー正規化・index-only 方針)。phase3-overview §2.3/§M17 が正本だが、段階2 の決定論解決範囲・入力例の根拠は本 spec 側にある。**リポジトリに無いため、ファイル名を具体的に挙げて請求すること**(想定で仕様を埋めない)。M14-03b 先行のため即時必須ではないが、M17 本体(段階2)着手時に必須。届かない場合は phase3-overview §M17 / handover §4 を正として進め、詳細確定時に請求 |

> **retrospective-log.md は起動時に投入しない**(起動時の必読は #10 digest)。ただし **retrospective-log の
> 更新責任は設計担当(本 Web 版)にある**——マイルストーン完了時に当該期間のミス・教訓を本書へ追記する。
> **M16 期間の教訓は retrospective-log v1.0.47 §6.6.9/§6.6.10 に記録済み**(digest 再蒸留済み)。log は
> **digest だけでは足りず過去ミスの事実関係を遡るとき**、または **M14-03b/M17 完了時に当該期間の教訓を追記するとき**に
> 開発者へ投入を要求して読む・追記する(digest は設計担当にとって読み取り専用・更新は Claude Code が
> `/retrospective-digest-update` で行う)。

### 任意(対話の中で要望が出たとき・必要になったときに投入)

| ファイル名 | パス | 渡すタイミング |
|-----------|------|--------------|
| M14-03-distribution-seed.md | `docs/instructions/M14-03-distribution-seed.md` | **M14-03b 先行の主参照**(過去担当作成 v1.1.0)。G-i canonical・現行スキーマ(000023)へ照合してから着手。§3 seed 契約を DoD に織り込む土台 |
| 過去の実物(テンプレで書式・粒度が不十分なとき) | 直近スキーマ級 = `docs/instructions/phase3/M16-04-step-taxonomy-and-dash-unification.md`(破壊的マイグレ)/ `docs/instructions/phase3/M16-07-custom-states-stock.md`(+ 各 `reviews/M16-0X-review-checklist.md`)/ 直近 doc 限定 = `docs/instructions/M16-05-*.md` | **design-templates.zip のテンプレで書式・粒度が不十分な場合のみ**、書こうとしている成果物と性質の近い過去の実物をファイル名指定で請求する(M14-03b = seed/配布級、M17 段階2 = ロジック/索引級)。テンプレ集が一次手本・実物は補助 |
| import/export 改善項目 spec / メディア参照 spec draft | (**リポジトリ外・開発者手交・未コミット**) | M17 の ③ import/export 強化(反復型・着手時に改善項目を確定)/ G-j メディア 3 フィールドの詳細を確定するとき。ファイル名を具体的に挙げて請求 |
| M16-overview.md | `docs/instructions/phase3/M16-overview.md` | M16 完了状態・承認ゲート処遇・as-built を遡るとき、または overview の書式・粒度(§3 依存列・§5 依存関係・進行順序 = 並列注記の書式手本)を参照するとき |
| retrospective-log.md | `docs/handover/retrospective-log.md` | **設計担当が更新責任を持つ**。M14-03b/M17 完了時の教訓追記、または digest だけでは足りず過去ミスの事実関係を遡るとき |
| CHANGE 通知書(060〜067 = M16 期間分) | `docs/change-notes/` | M16 で確定したスキーマ・taxonomy・始動/消費・custom_states の契約・経緯を遡るとき(特に 064 = dash 一本化・065 = target_combo・067 = custom_states int) |
| testid-convention.md | `docs/design/testid-convention.md` | E2E で test-id を扱うとき(test-id 正本) |
| worktree 運用メモ(開発者向け) | `docs/human-notes/worktree-scripts-guide.md` ・ `docs/human-notes/parallel-execution-guide.md` | 並列注記(0.5)の粒度を詰めるとき。**Claude Code は scripts/git を実行しない(開発者が行う)** |
| progress-log.md | `docs/progress/progress-log.md` | M1〜M16 の詳細(curl 出力・E2E 手順・実装メモ)が必要になったとき |
| アーカイブ handover(handover_1 / m1-to-m2 〜 m15-to-m16 等) | `docs/handover/` ・ `docs/handover/archive/` | 基本設計時点の前提や M1〜M16 期・整理工程の細部を遡るとき |

> M16 → M17 の変更点: 主 handover が `m16-to-m17-handover.md`(**§0 あり**)。**M17 の前に M14-03b(配布 seed・
> 配布ブロッカー)が先行実装サブ**として入る(§0.3・handover §7 最初の一手)。**必須の一次 spec(#22)を
> friend-feedback-datamodel-issues(M16 用)→ command-resolution-request(M17 command 段階2 用)へ差し替え**。
> **【新規】設計テンプレ集 `design-templates.zip`(#21)を必須に追加**(従来の「M15-06/M14-01 等の個別実物を
> テンプレ例として添付」運用を zip に集約 = 個別実物は書式不足時のみ請求)。設計書本体は M16 期間に **DES-002 v1.30.0 /
> DES-003 v1.29.0 / DES-004 v1.11.0 / DES-005 v2.39.0 / DES-006 v1.17.0 / SUPP-001 v1.27.0**(CHANGE-060〜067)へ改訂。
> `change-number-registry` 次回 **068**。マイグレーション **000023** まで(M17/M14-03b は 000024 以降)。
> **progress-summary は M0〜M15 → M0〜M16 へキャッチアップ**。M17 主参照は DES-004 §2.1/§6 / SUPP-001 §7・§9.9 /
> DES-002 §7.6 / phase3-overview §M17・§2.3・G-j/G-k。

---

## 2. 最初のプロンプト(コピペ用)

```text
私はストリートファイター6(以下 SF6)のコンボを効率的に管理・比較・共有するための Web アプリケーションを個人開発中のエンジニアです。本体アプリは Go(modernc.org/sqlite)+ Echo + React + TypeScript の単一バイナリ配布です。

あなたは、データの流通(import/export・後方互換 CSV 契約)・取込ヘルパー/変換パイプライン設計・決定論的な入力解決(command 索引・move_code ルックアップ)・メディア参照、および全キャラ配布 seed の安全な構築(remap・重複検出)に精通したシニアソフトウェアエンジニアです。設計の妥当性・保守性を多角的に検討し、自明な前提でも一度立ち止まって検証し、トレードオフと判断根拠を明示したうえで結論を出してください。不確かな点は推測で埋めず確認事項として挙げ、品質に妥協しないでください。特に本セッションは、まず M14-03b(全キャラ配布 seed = 配布ブロッカー)の指示書化を先に片付けてから M17(発信者の流通基盤)に入るため、配布 DB の健全性(clean マイグレ由来 DB・dup スキャン・全キャラ move_code 充足)と後方互換 CSV(export/import の列末尾追加・意味単位の往復不変)の観点を常に併せて検討してください。その立場で「詳細設計・製造準備担当」(設計・指示書作成担当)として私の作業を支援してください。

現在、要件定義・基本設計は完了済みで、フェーズ1(MVP、M0〜M7)・フェーズ2(先行リリース準備、M8〜M12)が完了しています。フェーズ3(共有・協調・入力拡充)では、M13(データ共有 = export/import、CHANGE-050〜052)→ M14(公式データ配布是正・スキーマ整理・DB 同梱、CHANGE-053〜055)コード完了 → M15(入力・使いやすさ向上 = friend FB 第一波、CHANGE-056〜059)完了 → M16(データモデル拡充・スキーマの継ぎ目、CHANGE-060〜067)全工程完了、と進みました。あなたはその M16 完了状態を引き継ぐ、フェーズ3 の継続設計担当です。フェーズ自体はフェーズ3 のままで、M17 は新フェーズの開始ではありません。

本セッションの構成には特殊事情があります。m16-to-m17-handover.md §0/§7 のとおり、次の実装サブは M17 ではなく M14-03b(全キャラ配布 seed・配布ブロッカー・M16 の seed 契約が収束した最優先実装サブ・Opus 4.8 + Plan Mode)であり、M17(発信者の流通基盤 = command 解決 段階2・メディア参照・import/export 強化)は M14-03b の後に来ます。したがって本セッションは、M17 着手準備を主軸としつつ、冒頭の早期タスクとして M14-03b の指示書化を先に片付ける構成です。「M17 の設計」と言われても、まず M14-03b が配布ブロッカーとして前提にあることを忘れないでください。

M14-03b の扱い(早期タスク・handover §3/§7): M14-03b = 全キャラ配布 seed 投入。現行 HEAD は ryu 中心で、配布には全 30/31 キャラの実データ seed が必須です(配布リリースの blocker)。M16 が moves スキーマ・taxonomy・custom_states を確定したことで seed 契約が収束したため、M16 の直後(= M17 の前)に投入するのが churn 最小です。過去担当作成の指示書 M14-03-distribution-seed.md(v1.1.0)を G-i canonical 確定・現行スキーマ(000023 まで)へ照合してから、handover §3 の seed 契約 6 件〔(a) 移動 system move 全キャラ seed + preset_aliases 対 /(b) skip 残行の掃き取り follow-up マイグレ 000024 /(c) 配布 DB 構築時の dup スキャン(remap 層 Go)+ dup 再測定 /(d) target_combo passthrough /(e) custom_states int の show_delta 付与(4 キャラのドメイン判断)+ 2 値 situation 構造の取込 + Ingrid・4 キャラ E2E /(f) command 索引源の再確立(M17 G-k と共通化 =「二度作らない」)〕を DoD に織り込んで指示書化してください。clean マイグレ由来 DB から構築(dev DB 残渣不可)。Opus 4.8 + Plan Mode。

M17 本体(command 解決 段階2・G-k / メディア 3 フィールド・G-j / import/export 強化): M14-03b の後に本格化します。M17 = 発信者の流通基盤で、①command 解決 段階2(入力→move_code 決定論ルックアップの索引源 = command。判断3 で index-only 推奨〔moves.command 列は復活せず seed/helper から索引再構築〕・段階2 スコープ = 単方向 + ボタンの特殊技のみ決定論解決・溜め/一回転/空中特殊技は「直接指定」。索引エンジンは取込ヘルパー〔M14-03b remap〕と共通化)、②G-j メディア 3 フィールド(combos に link・video 相対パス・image 相対パスを後方互換 CSV 列末尾追加・dup 判定対象外)、③import/export 強化(M13 の CSV/PDF/PNG/クリップボードを土台に、発信者流通向けの作り込み。先に固めず協議しながら改善する反復型)を含みます。M17 のスコープの正本は phase3-overview.md v1.1.2 §M17 / §2.3(command 解決)/ §2.4 承認ゲート G-j・G-k です(注: supp-001 §4.1 は M0〜M7 のみで M17 を記述しません。誤参照しないでください)。token→索引キー正規化仕様(SUPP-001 §9.9→numpad)は M17 で確定します。

あなたの役割は design-instruction-playbook.md §1 に定義された「設計担当 Claude」です。製造担当 Claude Code・レビュー担当 Claude Code とは別セッションで、Claude Code への指示書とレビューチェックリストの作成、製造担当・レビュー担当からの Q&A 対応、CHANGE 通知書の起票、handover / playbook / overview の改訂提案を担います。マイルストーン構造の独断拡張は禁止(playbook §4.11/§4.12)で、スキーマ変更(承認ゲート)は必ず私の承認を得て進めます。

まずこれまでの工程で完成したドキュメントを渡します。ファイル名:簡単な概要を記載しています。
読む順序は m16-to-m17-handover.md を起点にしてください(同書は §0 を持ちます)。まず design-instruction-playbook.md と m16-to-m17-handover.md を読み、docs-map.md で文書ID→実パスを引きながら、handover §0 まず読む → §1 M16 完了 → §2 設計判断(M14-03b/M17 に効く 6 件)→ §3 M14-03b 申し送り → §4 M17 申し送り → §7 最初の一手 を主軸に(§5 現行版/採番/環境・§6 未反映残タスク・§8 M16 教訓ダイジェスト を前提として)読むと本セッションの全体構造が掴め、続いて phase3-overview.md v1.1.2 §M17 / §2.3 / §2.4(承認ゲート G-j・G-k)で M17 のスコープ正本が把握できます。

M17/M14-03b の指示書・レビューチェックリスト・CHANGE 通知書等は、同梱の design-templates.zip 内の対応テンプレの章立て・記入指針に従って作成してください(指示書 / レビューチェックリスト / overview / phase-overview / RESEARCH / CHANGE 通知書 / change-report の 8 テンプレ + README を収録。各成果物の骨格 + 記入指針 + ミニ実例が入っています)。テンプレは各成果物の「型」であって、最終的な正は Playbook §2 等の運用ルールです。テンプレで書式・粒度が不十分な場合は、書こうとしている成果物と性質の近い過去の実物(ファイル名・マイルストーンを特定し、どのテンプレのどの節が不足かを添えて)を選定して私に投入を請求してよいです(例: M14-03b = seed/配布級、M17 段階2 = ロジック/索引級)。

A. 設計書本体(プロジェクト恒久・真の情報源)
  requirements.md:要件定義(REQ-001 v2.16.0、§7 = 4 フェーズ定義。NFR406 移設は M18 前)
  01-tech-stack.md:技術スタック(DES-001 v1.4.0)
  02-architecture.md:アーキテクチャ(DES-002 v1.30.0。M17 で取込ヘルパー IF・CSV 契約 §7.6 の改訂見込み)
  03-data-model.md:データモデル(DES-003 v1.29.0。M17 で G-j メディア 3 列・G-k command 索引源の CHANGE 候補)
  04-notation-spec.md:内部表現仕様(DES-004 v1.11.0。§2.1・§6 = command 索引・move_code 決定論解決 = M17 段階2 の根拠)
  05-screen-design.md:画面設計(DES-005 v2.39.0。M17 で import/export UI・メディア参照表示の改訂見込み)
  06-validation.md:バリデーション(DES-006 v1.17.0。§2.4/§2.5 が custom_states・消費の非連動をカバー。M17 で import 検証の判断)
  supp-001-detailed-design.md:設計補足・運用ルール(SUPP-001 v1.27.0。§7 recipe_cache・§9.9 token→索引キー正規化が M17 段階2 に効く。§4.1 は M0〜M7 のみ = M17 非記述)

B. 設計担当の恒久資料(運用ルール・反省・パターン・機械的事実)
  design-instruction-playbook.md:プロジェクト恒久の開発スタイル・運用ルール集(設計担当専用、最初に読む、v1.12.0。§4.11/§4.12 独断拡張禁止・§4.13 i18n 両ロケール・§16 CHANGE 手順)
  retrospective-digest.md:設計担当ミスの蒸留版(現役教訓のみ。起動時必読・指示書執筆前に毎回読む。投入直前に再蒸留した最新版。M16 教訓 M16-1〜7 + C-1〜C-5 反映済み)
  code-facts.md:実コードの機械的事実(Props・queryKey・フロントルート・Go ルート↔ハンドラ・config・ナビ・DTO・model・repository・マイグレ DDL。想定で書かず必ず引く。投入直前に再生成した最新版・000023 まで反映)
  docs-map.md:文書ID ⇄ 実パス・docs 配下の役割マップ(あなたはファイル構成を直接見られないため、DES 等の文書ID で参照した資料の実パスをここで引く。投入直前に再生成した最新版)
  architecture-patterns.md:確立済みの実装アーキテクチャパターン(§7 recipe_cache・§9 custom_states 消費非モデル化・§10 LAN・§1.1 queryKey・§2.1 サービス層 IF。取込ヘルパー・recipe_cache 波及の判断材料)
  change-number-registry.md:CHANGE 通知書の採番状態(次番号の確認用、次回 068 から。欠番 008 / 009 / 014)

C. フェーズ3 / M17 引き継ぎ(本セッション固有・差分情報)
  m16-to-m17-handover.md:主引き継ぎ書(§0 あり。§0 まず読む・§1 M16 完了・§2 設計判断・§3 M14-03b 申し送り・§4 M17 申し送り・§5 現行版/採番/環境・§6 未反映残タスク・§7 最初の一手・§8 M16 教訓ダイジェスト)
  phase3-overview.md:フェーズ3 マイルストーン分割の正本(v1.1.2 承認済み、M13〜M23。§M17 と §2.3 command 解決・§2.4 承認ゲート G-j/G-k が M17 スコープの正本)
  followup-backlog.md:フェーズ3 繰越・生きた計画資料(§C M14 論点 = C-1 配布完了定義 = M14-03b DoD / §A friend FB / §D M13 統合可否 / §E リファクタ / §F 配布・運用)

D. 進捗・配分
  progress-summary.md:製造工程の進捗要約(M0〜M16。§15 = M15 期間・§16 = M16 期間・§17 持ち越し = M17 着手時点)。詳細が要るなら progress-log.md を別途渡します
  model-allocation.md:モデル配分リファレンス(v1.30.0。M14-03b = Opus 4.8 + Plan 追記済・M17 サブは着手時追記。スキーマ/データ/配布は Opus 4.8 + Plan Mode 基本)

E. プロジェクト指針
  CLAUDE.md:製造担当 Claude Code 向けのプロジェクト指針。設計担当も概要把握のため一読してください(§10.X ブラウザストレージ許容表を含む)

F. 設計テンプレ集
  design-templates.zip:各成果物の書式・粒度の手本(指示書 / レビューチェックリスト / overview / phase-overview / RESEARCH / CHANGE 通知書 / change-report の 8 テンプレ + README)。M17/M14-03b の成果物はこのテンプレの章立て・記入指針に従って作成してください

M17 / M14-03b 一次 spec 用(開発者手交)
  command-resolution-request(command 解決 spec):M17 command 解決 段階2 の一次 spec(段階1/段階2 スコープ・token→索引キー正規化・index-only 方針)。phase3-overview §2.3/§M17 が正本ですが、段階2 の決定論解決範囲・入力例の根拠は本 spec 側にあります。リポジトリに無いため、必要になったらファイル名を挙げて請求してください(M14-03b 先行のため即時必須ではなく、M17 本体〔段階2〕着手時に必須。届かない場合は phase3-overview §M17 / handover §4 を正として進める)。import/export 改善項目・メディア参照の spec draft も同様に固まり次第手交します。

あなたへの依頼事項(playbook §1 の設計担当の責任範囲)と作業順序:

早期(M14-03b 先行実装サブの指示書化・handover §3/§7):
1. M14-03-distribution-seed.md(v1.1.0)を請求し、G-i canonical(dash = 方向別 system move)・現行スキーマ(000023 まで)へ照合する。記憶で進めず、DES-003 / DES-004 §2.1・§2.2 / code-facts(マイグレ DDL・model・repository)で裏取りする。
2. handover §3 の seed 契約 6 件〔(a)〜(f)〕を DoD に織り込み、M14-03b の指示書 + レビューチェックリストを作成する(Opus 4.8 + Plan Mode)。clean マイグレ由来 DB から構築(dev DB 残渣不可・M14-6)。skip 残行の掃き取り follow-up マイグレは 000024 以降。破壊的/移行系のマイグレを積む前に「保存列 vs 都度計算 / DB 制約 vs サービス層強制 / 表示 cache 依存 vs alias 安定」を実コードで確定する(digest C-3。M16-04 で recipe_hash 再計算・in-migration dup 検出・targeted cache が幽霊ステップだった再発防止)。

本体(M17 着手準備・M14-03b 完了後に本格化):
3. phase3-overview v1.1.2 §M17 / §2.3(command 解決)/ §2.4(承認ゲート G-j・G-k)を必読し、①command 解決 段階2(G-k・index-only・取込ヘルパー共通化)/ ②G-j メディア 3 フィールド(後方互換 CSV 列末尾追加)/ ③import/export 強化(反復型)の論点を棚卸しする(DES-004 §2.1・§6 / SUPP-001 §7・§9.9 / DES-002 §7.6 と実コード・code-facts で裏取り)。command 索引源は M14-03b の helper と共通化する前提(「二度作らない」)を守る。
4. M17-overview を作成する(M14/M16-overview 書式。サブ分割・CHANGE 見込み・全論点の処遇の正本)。【重要】§3「依存」列 + §5「依存関係・進行順序」で、各サブが「worktree 並列可(相互独立)」か「直列必須(M14-03b remap 依存等)」かを明示してください。私は git worktree による並列実行(2〜3 並列想定)を運用しており、この注記でレーン割付を判断します。M17 は取込ヘルパー共通化で直列寄りですが、独立に切り出せるサブ(例: G-j メディア列 = 波及が閉じた任意列追加)があれば明示的に「並列可」とマークしてください(既存の M16-overview §5 / M14-overview §5 の逆依存注記が書式の手本。並列化は指示書完成度が高く独立性の高いタスク群に限定)。
5. 各サブの使用モデルを難易度から決め model-allocation.md(v1.30.0)に追記する。M14-03b = 配布 seed = Opus 4.8 + Plan Mode(追記済)。M17 command 段階2 = ロジック/索引 = Opus 4.8 + Plan Mode 基本(model-allocation の M12 注「UX・正しさ・データモデルは Opus」)。CLAUDE.md・settings.json は整備済み。改訂が要れば改訂支援を行う。

製造工程の現在地:
- M0〜M7(フェーズ1)・M8〜M12(フェーズ2)は実装完了・E2E 動作確認済み・開発者承認済み(M12 = 2026-06-26 先行リリース実施点)。
- M13 完了(2026-06-28)。M14 コード完了(2026-07-01、CHANGE-053〜055)。M15 完了(2026-07-04、CHANGE-056〜059)。M16 全工程完了(2026-07-08、CHANGE-060〜067)= M16-01 drive REAL 化(060・000019)/ M16-02 ゲージ消費列 + 比較 4 行(061・000020)/ spec 是正(062・doc)/ M16-03 起き攻め正規化(063・000021)/ M16-04 taxonomy + dash 一本化(064・破壊的 000022)/ M16-05 target_combo(065・doc)/ M16-06 表記 rollout(066)/ M16-07 custom_states int(067・000023)。次回 CHANGE 採番は 068。マイグレは 000023 まで(M17/M14-03b は 000024 以降)。
- M14-03b(全キャラ配布 seed)= 次の実装サブ・配布ブロッカー。M16 の seed 契約が収束したため M16 後・M17 前に投入。clean マイグレ由来 DB から作る(dev DB 残渣不可)。
- 確定事項(再協議不要、m16-to-m17-handover §1/§2): dash canonical = 方向別 system move(modifier.type dash は M16-04 で廃止・移行済 / parry_drive_rush は modifier.type のまま正)/ taxonomy 原則(moves 行 / 非技 modifier.type〔parry/cancel のみ〕/ flag)/ target_combo は人手付与・本体は取込値信頼 / custom_states int = show_delta + 2 値・situation opaque / 始動 vs 消費の表示正典・register 分離・① VAL 非連動 / 判断3 = command index-only・段階2 スコープ = 単方向 + ボタンの特殊技。検証は make e2e(seed 非依存 self-contained)。

ドキュメント体系について:恒久情報(反省 = retrospective-digest、機械的事実 = code-facts、文書ID ⇄ 実パス = docs-map、アーキテクチャパターン、CHANGE 番号運用、成果物テンプレ = design-templates.zip)は B・F グループの専用ファイルに分離済みです。過去の引き継ぎ資料・設計変更通知書はアーカイブ済みで、要るときに提示します。retrospective-log 本体は起動時には投入していません(起動時の必読は retrospective-digest)。ただし retrospective-log の更新責任はあなた(設計担当)にあります — マイルストーン(M14-03b/M17)完了時に当該期間のミス・教訓を追記してください。M16 期間の教訓は retrospective-log に記録済み(digest 再蒸留済み)です。

【開発者への質問は文末集約】設計・指示書作成の過程で私(開発者)への質問・確認事項が生じた場合は、本文や各節の途中に散らさず、その成果物(overview / 指示書 / レビューチェックリスト / CHANGE 通知書 / 設計判断メモ等)の末尾に「開発者への確認事項」セクションとしてまとめて記載してください(M12〜M16 で定着)。各項目は番号付きで「何を確認したいか・なぜ確認が必要か・あなたの暫定案」を添えてください。対話の途中で即答が要る質問はその場で聞いて構いません。

【添付ファイルの受領確認】本プロンプトに続けて A〜F + M17/M14-03b 一次 spec 用の複数ファイルを添付します。添付は一度に全ては届かない、または届いていても即座に認識されないことがあります。次の手順で進めてください。
(1) まず上記 A 群〜F 群 + spec 用に列挙した必須ファイル(計 22 件。うち #21 design-templates.zip は 8 テンプレ収録の zip 1 件として数える〔同梱テンプレを個別に数えない〕、#22 command-resolution-request はリポジトリ未コミットで私が別途手交します)のファイル名を「受領マニフェスト」とみなし、現時点で認識できているファイルを受領済みリストとして列挙してください。受領できたものは読み込み・内容理解を始めて構いません。
(2) マニフェストにあるのに見当たらないファイルは、すぐ「届いていない」と断定せず、一度添付の再走査・再確認をしてください。それでも見当たらない場合に限り、該当ファイル名を具体的に挙げて不足を報告し、再送を求めてください(「いくつか届いていません」のような曖昧な報告は避け、必ずファイル名単位で挙げる。design-templates.zip は 1 件として扱い、中の個別テンプレ名で不足報告しない)。
(3) 必須ファイルが揃うまでは、CHANGE 通知書・指示書・M17-overview・M14-03b 指示書・承認ゲート設計などの成果物生成を始めないでください。不足したまま想定で進めない(これは本プロジェクトが最も警戒する「実態を確認せず想定で進める」アンチパターンです)。この段階では読み込み・内容理解・受領確認までに留めてください。任意ファイル(M14-03-distribution-seed.md・過去実物・import/export spec draft 等)は未着でも着手して構いません(必要時に追って投入します)。なお #22 command-resolution-request が未着でも、M14-03b 先行の指示書化と M17 スコープ棚卸しまでは phase3-overview §M17 / handover §4 を正として進められますが、M17 段階2 の詳細確定前にはファイル名を挙げて請求してください。
(4) 必須ファイルの受領がすべて確認できたら(#22 の手交状況も含めて)、その旨を一行で報告してから、まず着手前の確認事項リストを提案してください。特に: M14-03b の seed 契約 6 件〔(a)〜(f)〕の DoD 化と着手順(dash seed+alias → skip 掃き取りマイグレ 000024 → dup 再測定 → target_combo passthrough → custom_states show_delta+2値 → command 索引源)/ 4 キャラ(Mai/Lily/Juri/Kimberly)の show_delta 方向性(SF6 ドメイン判断)/ キャラ数 30→絞る可能性 / 仮ラベル確定(M16-07 custom_states int)の反映タイミング / M17 の command 段階2 スコープ(index-only・単方向+ボタン特殊技)・G-j メディア列・import/export 改善項目の確定順 / 各サブの worktree 並列可否(0.5 = 依存注記)。プロジェクトに対する質問も受け付けます。
```

---

## 3. 補足(対話の進め方)

- 流れ: 最初のプロンプト + A〜F + spec 用ファイルを投入 → 設計担当の読み込み・確認事項提示 →
  **(1) M14-03b 先行(seed 契約 DoD 化・着手順・4 キャラ show_delta ドメイン確認・dup 再測定範囲)→ M14-03b 指示書 +
  レビューチェックリスト** →
  **(2) M17 着手準備(command 段階2 スコープ・G-j メディア列・import/export 改善項目の確定)→ M17-overview →
  各サブの指示書 + レビューチェックリスト**、という流れ。
- **想定で書かない、必ず引く**: 既存データ構造・移行影響・seed 契約は code-facts 最新版(000023 まで)+ 実コード +
  DES-003 / DES-004 §2.1・§6 / SUPP-001 §7・§9.9 で確認する(digest §0/§1)。**DB 実査 ≠ 仕様正典**、正典は DES 本体
  (最新 CHANGE 反映後)で確認(M10-1)。**M17 各論点の詳細 spec(command-resolution-request 等)はリポジトリに無い**ため、
  仕様確定の段では開発者へ現物を請求する(記憶・推測で埋めない)。届かない間は phase3-overview §M17 / handover §4 を正に。
- **🔒 承認ゲート(スキーマ変更)の扱い**: phase3-overview §2.4 の **G-j(メディア 3 列)/ G-k(command 索引源)**は
  着手前に設計判断が要る。**G-j = combos への任意列末尾追加(link/video/image 相対パス・dup 判定対象外・後方互換 CSV)**、
  **G-k = command 索引源の再確立(index-only 推奨・列復活せず seed/helper から索引再構築・M14-03b remap と共通化)**。
  各ゲートは個別に開発者承認を得る。マイグレ接続は FK=OFF → 子行は明示 DELETE(digest §5・M12-5)、`dbtest.Setup` 波及・
  down 整合に注意。次マイグレは 000024 以降。列追加(ADD COLUMN)の down は列を失い破壊的 → 任意列で後方互換を保つ
  (M16-6・DES-002 §7.6 = 以後の列追加の標準)。
- **CHANGE 二層運用**: 設計書本体(REQ-001 / DES-001〜006)改訂は CHANGE 通知書必須(次回 068)。補足資料(SUPP-001 /
  handover / playbook / registry / progress / architecture-patterns / phase3-overview / followup-backlog / model-allocation /
  overview 等)は設計担当の自由改訂(バージョン bump のみ)。「念のため起票」は §16.4.4 違反(M4-15/M6-11)。実装後 CHANGE の
  反映は「通知書 + 改訂 REQ/DES ファイル + change-report」の三点セット(改訂 DES 適用は必須・M14-1/M16 の pattern-D 反覆防止)。
- **成果物の書式・粒度**: design-templates.zip の対応テンプレに従う。不十分なら性質の近い過去実物を請求(§1 任意表)。
  M14-03b = seed/配布級(M14-03-distribution-seed.md が土台)、M17 段階2 = ロジック/索引級。
- **出力前セルフチェック(digest §7・毎回)**: 簡体字 + 禁則表現(「必要に応じて」「適切に」)+ 頻出ドメイン用語誤字
  (`grep 起き攻け`)+「DR」略記(画面ラベルは「ドライブラッシュ」・コード定数/規約引用は除く)を grep。
- **M14-03b/M17 完了時**: retrospective-log に当該期間の教訓を追記(更新責任は設計担当)→ Claude Code が
  `/retrospective-digest-update` で digest 再蒸留。M14-03b 完了で M14-03-distribution-seed の DoD 達成を followup §C-1 に反映。

---

## 4. 前提事実メモ(キット作成時点 = 2026-07-09)

- **CHANGE 採番**: 067 まで使用済み、**次回 068**。欠番 008 / 009 / 014(再利用不可)。直近 = CHANGE-060(M16-01 drive REAL・
  000019)/ 061(M16-02 消費列 + 比較 4 行・000020)/ 062(spec 是正・doc)/ 063(M16-03 起き攻め正規化・000021)/
  064(M16-04 taxonomy + dash 一本化・破壊的 000022)/ 065(M16-05 target_combo・doc)/ 066(M16-06 表記 rollout)/
  067(M16-07 custom_states int・000023)。三点セット全反映(registry v1.56.0)。
- **設計書本体現行版**(M16 反映後): REQ-001 v2.16.0 / DES-001 v1.4.0 / DES-002 v1.30.0 / DES-003 v1.29.0 /
  **DES-004 v1.11.0** / **DES-005 v2.39.0** / DES-006 v1.17.0 / SUPP-001 v1.27.0(自由改訂)。**マイグレーション 000023 まで**
  (M17/M14-03b は 000024 以降)。
- **補足資料現行版**: design-instruction-playbook v1.12.0(§4.11 / §4.12 / §4.13 / §16)/ change-number-registry v1.56.0
  (次回 068)/ progress-summary(**M0〜M16**・§15 M15 期間・§16 M16 期間・§17 持ち越し = M17 着手時点)/
  model-allocation v1.30.0(**M14-03b = Opus + Plan 追記済**・M17 サブは着手時追記)/ phase3-overview v1.1.2(承認済み・
  **§M17 と §2.3 / §2.4 G-j/G-k が M17 スコープ正本**)/ followup-backlog(フェーズ3 生きた計画資料・§C-1 配布完了定義)/
  retrospective-log v1.0.47(§6.6.9/§6.6.10 = M16 教訓)・architecture-patterns は各ファイル冒頭で現行版を確認 /
  code-facts(2026-07-09 / commit `62e2e05`・000023 反映)・docs-map(同)・design-templates.zip(8 テンプレ収録)。
- **⚠ 派生ドキュメントの鮮度(本キット生成時)**: **全て実施済み** — code-facts / docs-map を再生成
  (2026-07-09 / `62e2e05`・マイグレ 000023 反映)。retrospective-digest を再蒸留(M16-1〜7 + §6.6.10 C-1〜C-5 反映)。
  progress-summary を **M0〜M16 へキャッチアップ要約**(§16 = M16 期間追加・持ち越しサブタイトルを M17 着手時点へ)。
  design-templates.zip を再生成(8 テンプレ)。**M16 教訓は retrospective-log に記録済み**(前提クリア済 = 保留なし)。
- **M17 引き継ぎ資料**: m16-to-m17-handover(主・**§0 あり**)/ phase3-overview v1.1.2(承認済み・M13〜M23・§M17 が正本)/
  followup-backlog(§C-1 配布完了定義 = M14-03b DoD)/ command-resolution-request(M17 command 段階2 一次 spec・開発者手交・repo 外)。
- **M17 スコープ**(phase3-overview §M17 = 発信者の流通基盤): ①command 解決 段階2(G-k・入力→move_code 決定論ルックアップ・
  index-only・単方向 + ボタンの特殊技のみ・取込ヘルパー共通化)/ ②G-j メディア 3 フィールド(combos に link/video/image 相対パス・
  後方互換 CSV 列末尾追加・dup 対象外)/ ③import/export 強化(M13 の CSV/PDF/PNG/クリップボードを土台に発信者流通向けの
  作り込み・反復型)。**M17 の前に M14-03b(配布 seed・配布ブロッカー)が先行**。CHANGE 見込み = DES-002 §7.6(取込ヘルパー IF)/
  DES-003(G-j 列・G-k 索引源)/ DES-004 §2.1・§6(command 索引・move_code 解決)。token→索引キー正規化(SUPP-001 §9.9→numpad)は M17 確定。
- **M14-03b(先行実装サブ・配布ブロッカー)**: 全キャラ配布 seed 投入。M16 由来 seed 契約(handover §3)= (a) 移動 system
  move 全キャラ seed + preset_aliases 対 /(b) skip 掃き取り follow-up マイグレ 000024 /(c) dup スキャン(remap 層 Go)+
  dup 再測定 /(d) target_combo passthrough /(e) custom_states int の show_delta 付与 + 2 値 situation 取込 + Ingrid・4 キャラ
  E2E /(f) command 索引源の再確立(M17 G-k と共通化)。clean マイグレ由来 DB から構築。Opus 4.8 + Plan Mode。
- **M17 への持ち越し / 残タスク**(handover §6): DES 本体の commit/push(開発者作業・CHANGE-064〜067 分)/ 仮ラベル確定
  (M16-07 custom_states int の ①②③固定句・SSOT `customStateIntLabel`・開発者が出力確認後に指定)/ リリース前視覚確認
  (長 ja ラベルの実機スマホ・エクスポート画像/PDF)/ NFR406 移設(M18 前)/ export・入力欄 full en 化(別マイルストーン・followup)。

---

## 5. M16 プロンプトからの主な改訂点(キット作成 = 2026-07-09)

`m16-startup-kit`(M16 = データモデル拡充・スキーマの継ぎ目)を構造ベースに作成。M16 全工程完了 →
M17(発信者の流通基盤 = import/export 強化・取込ヘルパー・メディア参照)起点へ全面書き換え。

| 反映 | 内容 |
|------|------|
| M17 起点化 | §0 時系列を M16 完了 → **M17(発信者の流通基盤)起点**へ書き換え。**フェーズ自体はフェーズ3 のまま**を冒頭・§0 に明記。M16 = スキーマ変更・承認ゲートから **M17 = データ流通・取込ヘルパー・決定論索引** へ性格が移る旨を明示 |
| **M14-03b 先行の明示(追加指示①)** | handover §0/§7「次の実装サブは M17 でなく M14-03b(配布ブロッカー)」を反映し、**キットを「M17 着手準備 + M14-03b 先行実装サブの指示書化」構成**に。冒頭「本キットの特殊事情」ブロック + §0.3 + §2 依頼事項 1-2 + 着手前確認に M14-03b の seed 契約 6 件〔(a)〜(f)〕を明記(m16 の M15 wrap-up 早期タスク構造の踏襲) |
| 主 handover / 読む順序 | C グループ主 handover を `m16-to-m17-handover.md` に設定。**同書は §0 を持つ**ため「読む順序」を **§0 まず読む → §1 M16 完了 → §2 設計判断 → §3 M14-03b 申し送り → §4 M17 申し送り → §7 最初の一手 主軸 + §5/§6/§8 前提**へ |
| M17 スコープの正本明示 | **phase3-overview v1.1.2 §M17 / §2.3(command 解決)/ §2.4 承認ゲート G-j・G-k を M17 スコープの正本**として §0/§1/§2/§4 に明記。⚠ **supp-001 §4.1 は M0〜M7 のみで M17 非記述**を注記(誤参照防止)。①command 段階2 / ②G-j メディア / ③import/export 強化 を論点列挙 |
| **設計テンプレ集 zip の必須化(規則7・復元)** | base m16 には design-templates.zip が **§1・§2 とも不在**(個別実物 M15-06/M14-01 をテンプレ例に添付する旧運用)だった。**§1 必須表に #21 design-templates.zip を新規追加(A)** + **§2 プロンプト本文に「M17/M14-03b の成果物は同梱テンプレの章立て・記入指針に従って作成」の一文(B)** + **「テンプレで不十分なら性質の近い過去実物を請求してよい」の一文**を追加。旧「個別実物添付」は zip へ集約(実物は書式不足時のみ請求)。zip は 8 テンプレ 1 件として受領マニフェストに算入 |
| **一次 spec の差し替え** | 必須 #22 を M16 用 friend-feedback-datamodel-issues → **M17 用 command-resolution-request(command 段階2 一次 spec・開発者手交・repo 外)**へ差し替え。M14-03b 先行のため即時必須ではないが M17 段階2 着手時に必須。M14-03-distribution-seed.md は M14-03b 先行の主参照として §1 任意へ |
| CHANGE 起票・設計書改訂事実 | M16 期間に CHANGE-060〜067 起票・全反映、**DES-002 v1.30.0 / DES-003 v1.29.0 / DES-004 v1.11.0 / DES-005 v2.39.0 / DES-006 v1.17.0 / SUPP-001 v1.27.0**、次回 **068**。マイグレ **000019〜000023**(M17/M14-03b は 000024 以降)。M17 主参照を DES-004 §2.1/§6 / SUPP-001 §7・§9.9 / DES-002 §7.6 / phase3-overview §M17 へ |
| ロール指定(規則12) | §2 冒頭を **データ流通(import/export・後方互換 CSV)/ 取込ヘルパー・変換パイプライン / 決定論入力解決(command 索引・move_code)/ メディア参照 / 全キャラ配布 seed の安全構築(remap・dup)**に精通したシニアエンジニアへ調整(M16 のスキーマ/データモデルから M17 の流通・索引・配布へ)。妥当性多角検討・前提検証・トレードオフ明示・不確かは確認・品質妥協なしの姿勢を明記 |
| 投入推奨資料(規則13/14/15) | code-facts(000023 反映)/ retrospective-digest(起動時必読・M16 教訓反映)/ docs-map を維持し鮮度・注記を更新。digest = 起動時必読・log = 任意参照(更新責任は設計担当・digest 更新は Claude Code)を明記 |
| 受領確認ブロック(規則16) | 必須件数を **22 件**へ更新(zip を 1 件として算入・#22 は開発者手交)。着手前確認項目を **M14-03b seed 契約 DoD・着手順 / 4 キャラ show_delta ドメイン確認 / キャラ数 / 仮ラベル確定 / M17 command 段階2 スコープ・G-j メディア列・import/export 改善項目 / worktree 並列可否** へ。design-templates.zip は個別テンプレ名で不足報告しない旨を明記 |
| ドキュメント体系について段落 | 恒久情報は B グループ + **成果物テンプレ = F グループ(design-templates.zip)** に分離済みの定常文へ更新(zip 追加を反映)。retrospective-log 更新責任は設計担当・digest 更新は Claude Code、**M16 教訓は記録済み**(保留なし)へ更新 |
| progress-summary 対象範囲 | **M0〜M15 → M0〜M16 へキャッチアップ**(§16 M16 期間追加・持ち越しサブタイトルを M17 着手時点へ) |

---

## 6. 改訂履歴

| 日付 | 内容 |
|------|------|
| 2026-07-09 | M16(データモデル拡充・スキーマの継ぎ目)全工程完了 → M17 着手に伴い、連番キット `m17-startup-kit.md` を `m16-startup-kit.md` から構造流用作成(`/next_milestone_kit M17`)。CHANGE-060〜067 反映・**DES-002 v1.30.0 / DES-003 v1.29.0 / DES-004 v1.11.0 / DES-005 v2.39.0 / DES-006 v1.17.0 / SUPP-001 v1.27.0**、次回採番 068、マイグレ 000019〜000023(M17/M14-03b は 000024 以降)。主 handover = `m16-to-m17-handover.md`(**§0 を持つ**ため「読む順序」を §0 まず読む → §1 M16 完了 → §2 設計判断 → §3 M14-03b 申し送り → §4 M17 申し送り → §7 最初の一手 主軸 + §5/§6/§8 前提に適応)。§0 作業順序を M17(発信者の流通基盤)起点へ書き換え、ロール指定をデータ流通/取込ヘルパー/決定論入力解決/メディア/配布 seed 中心へ調整。**【追加指示①】M14-03b(配布 seed・配布ブロッカー)を M17 の前の先行実装サブとしてキット冒頭・§0.3・§2 依頼事項に明示**(handover §0/§7・m16 の M15 wrap-up 早期タスク構造の踏襲)。**M17 スコープの正本を phase3-overview v1.1.2 §M17 / §2.3 / §2.4 G-j/G-k に設定**(supp-001 §4.1 は M0〜M7 のみ = M17 非記述を注記)。**【規則7・復元】base m16 に不在だった設計テンプレ集 `design-templates.zip` を §1 必須表(#21)+ §2 プロンプト本文の 2 箇所に新規追加**(個別実物添付の旧運用を zip へ集約・実物は書式不足時のみ請求)。必須 #22 を friend-feedback-datamodel-issues → command-resolution-request(M17 command 段階2 一次 spec・開発者手交)へ差し替え、M14-03-distribution-seed.md を M14-03b 先行の主参照として §1 任意へ。受領確認ブロックの必須件数を 22 件へ、着手前確認を M14-03b seed 契約 DoD + M17 論点へ更新。**派生資料を全リフレッシュ**: code-facts / docs-map 再生成(2026-07-09 / `62e2e05`・000023 反映)、retrospective-digest 再蒸留(M16 教訓 M16-1〜7 + §6.6.10 C-1〜C-5 反映)、progress-summary を M0〜M16 へキャッチアップ(§16 追加)、design-templates.zip 再生成(8 テンプレ)。**M16 教訓は retrospective-log 記録済み**(前提クリア = 保留なし) |
