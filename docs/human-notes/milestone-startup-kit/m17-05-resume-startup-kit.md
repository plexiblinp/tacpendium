# M17-05 途中再開 resume kit(M17 期・置換型)

> **本ファイルは開発者向けの手順書です。§2「最初のプロンプト」だけを Web チャットに貼ります(1 本)。base `m17-startup-kit.md` §2 は投入しません(本 §2 がその代替)。** §0/§1/§3/§4/§5 は開発者の準備メモです。
>
> **置換型(重要)**: 本 §2 は base kit `m17-startup-kit.md` §2 を **変換再生成した、単独で成立する完全プロンプト** です。開発者は **この §2 プロンプト 1 本を貼る + §1 のファイルを添付** するだけで新セッションを起動します。**base kit §2 の投入・2 本貼りは不要**です(1 回目の resume kit `m14-03c-m17-resume-startup-kit.md` は旧「上書き追記型」でしたが、本キットは新仕様の置換型です)。

---

## 0. 位置づけ / 投入手順

**マイルストーン内の途中再開(M17 期・2 回目)**です。**M17 は M17-04(取込ヘルパー)まで完了 → M17-05 から再開** します。

- **完了済み**: M17-01(G-j メディア 3 列)/ M17-02(G-k command 索引源 + 段階2 解決 BE)/ M17-03(段階2 UI・9 方向)/ M17-04(取込ヘルパー)+ M14-03c(ryu 正規再 seed)。**CHANGE-068〜071 を三点セット全反映済み**。
- **再開点**: M17-05a(import 体験再設計)/ M17-05b(export 動線)/ M17-05c(PDF/PNG 出力)+ M14-03 第二波以降(手入力 seed 律速)+ M18 準備。
- **完了サブ・確定判断の正本**は継承資料 `docs/handover/phase3/m17-design-session-handover.md` v1.0.0(2026-07-17)§1/§2。

### 投入手順

1. **§2「最初のプロンプト」1 本を Web チャットに貼る**(本キットの §2。base §2 は使わない)。
2. **§1 の必須ファイル(計 21 件)を添付する**。派生資料 3 件(code-facts / docs-map / retrospective-digest)は投入直前に再生成・再蒸留した最新版を貼る(下記 §1 の鮮度更新注記)。

> **1 回目(`m14-03c-...`)との違い**: 1 回目は base §2(PASTED)+ 上書きプロンプトの 2 本貼りでした。本キットは §2 が完全プロンプトなので **1 本貼り** です。base §2 は投入しません。

---

## 1. 投入ファイル一覧(開発者用・パス付き)

Web チャットへアップロードするファイル。**必須**は初回投入、**任意**は対話の中で要望が出たとき・必要になったときに渡す。

> **投入直前の鮮度更新(必須)**: `code-facts.md` は `/regen_code_facts`、`docs-map.md` は `/regen_docs_map`、`retrospective-digest.md` は `/retrospective-digest-update`、`design-templates.zip` は `bash scripts/generate-template-zip.sh` で **投入直前に再生成し、現行コード / 構成 / 最新教訓 / テンプレ本体と一致させた版を貼る**こと。最終的な正は常に実コード / 実ファイル / Playbook §2 等の運用ルール。
> **⚠ 本キット生成時点の鮮度状況(2026-07-17)**: code-facts / docs-map は本再開に合わせ再生成済み(2026-07-17 / commit `966e9ed`・**マイグレ 000035 まで反映**)。retrospective-digest は本期教訓(retrospective-log §6.6.12 = E-1〜E-13・§7.2)を反映して再蒸留済み。design-templates.zip は 8 テンプレ収録の最新版。progress-summary は **M0〜M16 まで**(M17 期の追いつきはマイルストーン境界作業=本再開の範囲外)。

### 必須(初回投入・計 21 件)

**C0. 現在状態の正本(本再開で最優先・新規)**

| # | ファイル名 | リポジトリ上のパス | 種別 |
|---|-----------|------------------|------|
| 0 | m17-design-session-handover.md | `docs/handover/phase3/m17-design-session-handover.md` | **M17 期 設計セッション継承資料 v1.0.0(2026-07-17)= 現在状態の正本**。完了サブ(§1)・確定判断(§2・再協議不要)・最重要残課題(§4 = §G-14)・現行版/採番/環境(§5)・判断待ち 4 件(§3)・§2 の根拠メモ一覧(§9)・M18 申し送り(§10)。**新セッションは §1→§2→§4→§7 の順に最優先で読む** |

**A. 設計書本体(プロジェクト恒久・真の情報源)**

| # | ファイル名 | リポジトリ上のパス | 種別 |
|---|-----------|------------------|------|
| 1 | requirements.md | `docs/design/requirements.md` | REQ-001 v2.16.0(§7 = 4 フェーズ定義。**NFR406 フェーズ移設の CHANGE を M18 前に見込み**) |
| 2 | 01-tech-stack.md | `docs/design/01-tech-stack.md` | DES-001 v1.4.0 |
| 3 | 02-architecture.md | `docs/design/02-architecture.md` | DES-002 **v1.34.0**(§4.2 command-index API・§7.5.1 索引 IF・§7.6 メディア 3 列。M17-05 の import/export 動線に効く) |
| 4 | 03-data-model.md | `docs/design/03-data-model.md` | DES-003 **v1.32.0**(§3.4 メディア 3 列・§3.14 move_commands・§3.3 is_derived/is_aerial) |
| 5 | 04-notation-spec.md | `docs/design/04-notation-spec.md` | DES-004 **v1.14.0**(§2.4 command 索引と段階2 の決定論解決) |
| 6 | 05-screen-design.md | `docs/design/05-screen-design.md` | DES-005 **v2.42.0**(**§5.19 取込ヘルパー**・§6.4 9 方向 + 段階2・**§5.13 export 出力項目 25→28**〔メディア 3 項目〕・§5.6/5.7/5.8 メディア表示。M17-05a/b/c の正本) |
| 7 | 06-validation.md | `docs/design/06-validation.md` | DES-006 **v1.19.0**(§6 メディアの緩検証・§2.6 is_derived/索引/段階2 の非検証方針) |
| 8 | supp-001-detailed-design.md | `docs/design/supp-001-detailed-design.md` | SUPP-001 v1.27.0(§7 recipe_cache・§9.9 token→索引キー正規化。**§4.1 は M0〜M7 のみ = M17 非記述**・§3.3.3 dash 失効記述の是正が未実施 = followup §G-9) |

**B. 設計担当の恒久資料(運用ルール・反省・パターン・機械的事実)**

| # | ファイル名 | リポジトリ上のパス | 種別 |
|---|-----------|------------------|------|
| 9 | design-instruction-playbook.md | `docs/handover/design-instruction-playbook.md` | 運用ルール集(**v1.13.0**。最初に読む。§1 役割境界・§4.11/§4.12 独断拡張禁止・**§4.13.1 i18n サーフェス境界**・**§4.14〜§4.17**〔本期新設 = 改変粒度と回帰ゲート・裁量の下流固定禁止・破壊的削除の書き方・導出契約〕・**§5.4.1 確認コマンド出力を切らない**・§16 CHANGE 手順) |
| 10 | retrospective-digest.md | `docs/handover/retrospective-digest.md` | **設計担当ミス蒸留版**(現役教訓のみ。**起動時必読**・指示書執筆前に毎回読む。投入直前に `/retrospective-digest-update` で再蒸留した最新版。**本期教訓 E-1〜E-13〔retrospective-log §6.6.12〕反映済み**) |
| 11 | code-facts.md | `docs/handover/code-facts.md` | **機械的事実の参照元**(Props・queryKey・フロントルート・Go ルート↔ハンドラ・config・ナビ・DTO・model・repository・マイグレ DDL。想定で書かず必ず引く。投入直前に `/regen_code_facts` で再生成。**2026-07-17 / commit `966e9ed`・マイグレ 000035 まで反映**。`useCommandIndex`・command-index ルート・マイグレ 000029〜000035 の追補を含む) |
| 12 | docs-map.md | `docs/handover/docs-map.md` | **文書ID ⇄ 実パス・役割マップ**(設計担当はファイル構成を直接見られない。`DES-003` 等の実パス逆引き。投入直前に `/regen_docs_map` で再生成。**2026-07-17 / commit `966e9ed`**) |
| 13 | architecture-patterns.md | `docs/handover/architecture-patterns.md` | 確立アーキテクチャパターン(§7 recipe_cache・§9 custom_states 消費非モデル化・§10 LAN・§1.1 queryKey・§2.1 サービス層 IF。**取込ヘルパー・command-index 配信・recipe_cache 波及の判断材料**) |
| 14 | change-number-registry.md | `docs/handover/change-number-registry.md` | CHANGE 番号運用(**v1.62.0・次回採番 072**。欠番 008 / 009 / 014。直近 = CHANGE-068〜071 = M17 反映) |

**C. フェーズ3 / M17 引き継ぎ(本セッション固有・差分情報)**

| # | ファイル名 | リポジトリ上のパス | 種別 |
|---|-----------|------------------|------|
| 15 | m16-to-m17-handover.md | `docs/handover/phase3/m16-to-m17-handover.md` | **マイルストーン文脈**(M16 完了・M14-03b/M17 の起点。§0 あり)。**現在状態の正本は #0 の design-session-handover** で、本書は M17 の起点経緯を辿るための文脈資料 |
| 16 | phase3-overview.md | `docs/instructions/phase3-overview.md` | **フェーズ3 マイルストーン分割の正本**(v1.1.2・承認済み、M13〜M23)。**§M17 と §2.3(command 解決)・§2.4 承認ゲート G-j/G-k が M17 スコープの正本**。M18 の内容もここで確認 |
| 17 | followup-backlog.md | `docs/handover/followup-backlog.md` | **フェーズ3 繰越・生きた計画資料**。**§G 新設(G-1〜G-15 = M17 期の新規論点。とくに §G-14 = ① プロンプト表現力不足)** / §C M14 論点 / §A friend FB / §E リファクタ / §F 配布・運用 |

**D. 進捗・配分**

| # | ファイル名 | リポジトリ上のパス | 種別 |
|---|-----------|------------------|------|
| 18 | progress-summary.md | `docs/progress/progress-summary.md` | 進捗要約 **M0〜M16**(§16 = M16 期間・§17 持ち越し)。M17 期の追いつきは境界作業(本再開では未実施)。詳細は progress-log.md を別途 |
| 19 | model-allocation.md | `docs/human-notes/model-allocation.md` | モデル配分(**v1.34.0**。M14-03d/03e/03f 以降/最終波を追記済。**M17-05b = Sonnet 4.6**・スキーマ/データ/配布は Opus 4.8 + Plan Mode 基本) |

**F. 設計テンプレ集(各成果物の書式・粒度の手本)**

| # | ファイル名 | リポジトリ上のパス | 種別 |
|---|-----------|------------------|------|
| 20 | design-templates.zip | `docs/instructions/templates/design-templates.zip` | **設計テンプレ集**(指示書 / レビューチェックリスト / overview / phase-overview / RESEARCH / CHANGE 通知書 / change-report の各テンプレ = 骨格 + 記入指針 + ミニ実例、計 8 件 + README)。M17-05 系・M14-03 波の各成果物を書くときの**書式・粒度の手本**。**投入直前に `bash scripts/generate-template-zip.sh` で再生成**した版を貼ること。最終的な正はテンプレでなく Playbook §2 等の運用ルール |

> **必須件数の変遷**: base `m17-startup-kit.md` は 22 件。本 resume kit は **21 件**(= base 22 **+1**〔#0 design-session-handover を追加〕**−1**〔CLAUDE.md を任意へ降格〕**−1**〔command-resolution-request = M17 段階2〔M17-02/03〕が完了済 = 消化済みのため任意へ〕)。**design-templates.zip は 1 件として数える**(中の個別テンプレを個別に数えない)。

### 任意(対話の中で要望が出たとき・必要になったときに投入)

| ファイル名 | パス | 渡すタイミング |
|-----------|------|--------------|
| CLAUDE.md | `CLAUDE.md`(リポジトリルート) | **任意(請求時)**。Web 版設計担当が CLAUDE.md を改訂する運用は終息・安定したため(2026-07-16 開発者方針)、起動時未投入。編集境界 §8・禁止事項 §10・§10.X ブラウザストレージ許容表を参照したくなったら請求 |
| retrospective-log.md | `docs/handover/retrospective-log.md` | **起動時未投入 = 請求時**(起動時の必読は #10 digest)。**v1.0.48・本期教訓は §6.6.12・§7.2**。digest だけでは足りず過去ミスの事実関係を遡るとき、または M17-05/M14-03 完了時に当該期間の教訓を追記するとき(更新責任は設計担当) |
| M17-export-import-item-inventory.md ほか §9 根拠メモ | (**未配置なら開発者が配置。1 回目 resume kit 時点で一部 `tmp/` 在・未検出**) | **§2 確定判断・M17-05 設計判断の正の根拠**(継承資料 §9)。`M17-export-import-item-inventory.md` v1.1.0(**M17-05a/05b/05c の設計判断の正**・A-1〜A-4 / B-1〜B-6)/ `command-index-resolution-design.md` v2.1.0(is_derived 判定原理・再発明禁止)/ `CHANGE-069〜071-notification.md` / `change-report-068〜071.md` / `M14-RESEARCH-02-findings-analysis.md`。§2 を疑ったら再協議前にファイル名で請求 |
| m14-03b-m17-design-session-handover.md | `docs/handover/phase3/m14-03b-m17-design-session-handover.md` | **前セッション継承資料 v1.1.0**。**§2(とくに §2.3 派生技フラグ is_derived の判定原理)は引き続き有効**。本期 §2 の前提を遡るとき |
| M17-05a/b/c・M14-03d/e 指示書 | `docs/instructions/phase3/M17-05a-import-redesign.md` ほか(`M17-05b-export-flow.md`・`M17-05c-pdf-pagination.md`・`M14-03d-second-wave-manon.md`・`M14-03e-third-wave-code-quality.md`) | **既に v1.0.0/v1.0.1 で存在**(製造投入用)。設計担当が Q&A 対応・CHANGE 反映・as-built 追従で参照したいとき |
| command-resolution-request(command 解決 spec) | (**開発者手交・repo 外**) | **M17 段階2 の一次 spec = M17-02/03 で消化済み**。M17-05 では原則不要。段階2 の経緯を遡るときのみ請求 |
| CHANGE 通知書(068〜071) | `docs/change-notes/` | M17 で確定したメディア列・command 索引・段階2・取込ヘルパーの契約・経緯を遡るとき |
| M16/M14/M17-overview・過去実物・testid-convention・worktree 運用メモ 等 | `docs/instructions/` ほか | overview 書式(§3 依存列・§5 進行順序 = 並列注記の手本)・書式不足時の性質近い過去実物・E2E test-id・並列注記の粒度を詰めるとき |
| progress-log.md / アーカイブ handover | `docs/progress/` ・ `docs/handover/` ・ `docs/handover/archive/` | M1〜M16 の詳細(curl 出力・E2E 手順・実装メモ)や前提の細部を遡るとき |

---

## 2. 最初のプロンプト(コピペ用・base m17 §2 の代替 = これ 1 本を貼る)

```text
私はストリートファイター6(以下 SF6)のコンボを効率的に管理・比較・共有するための Web アプリケーションを個人開発中のエンジニアです。本体アプリは Go(modernc.org/sqlite)+ Echo + React + TypeScript の単一バイナリ配布です。

あなたは、データの流通(import/export・後方互換 CSV 契約)・取込ヘルパー/変換パイプライン設計・決定論的な入力解決(command 索引・move_code ルックアップ)・メディア参照/出力(PDF ページ分割・PNG canvas 上限)、および全キャラ配布 seed の安全な構築(remap・重複検出)に精通したシニアソフトウェアエンジニアです。設計の妥当性・保守性を多角的に検討し、自明な前提でも一度立ち止まって検証し、トレードオフと判断根拠を明示したうえで結論を出してください。不確かな点は推測で埋めず確認事項として挙げ、品質に妥協しないでください。特に本セッションは、M17 の実装 5 サブ(M17-01〜04 + M14-03c)が完了した状態からの再開で、残る M17-05a/05b/05c(import 体験再設計・export 動線・PDF/PNG 出力)と M14-03 第二波以降(手入力 seed 律速・期限なし)、および M18 準備を担います。後方互換 CSV(列末尾追加・意味単位の往復不変)・メディア出力・配布 seed の健全性を常に併せて検討してください。その立場で「詳細設計・製造準備担当」(設計・指示書作成担当)として私の作業を支援してください。

【現況=最重要】要件定義・基本設計は完了済みで、フェーズ1(MVP、M0〜M7)・フェーズ2(先行リリース準備、M8〜M12)が完了、フェーズ3(共有・協調・入力拡充)を継続中です。フェーズ3 は M13(データ共有)→ M14(公式データ配布是正・スキーマ整理)→ M15(入力・使いやすさ第一波)→ M16(データモデル拡充)全工程完了と進み、M17(発信者の流通基盤)は M17-01(G-j メディア 3 列)/ M17-02(G-k command 索引源 + 段階2 解決 BE)/ M17-03(段階2 UI・9 方向)/ M17-04(取込ヘルパー)+ M14-03c(ryu 正規再 seed)まで完了しています(CHANGE-068〜071 を三点セット〔通知書 + 改訂 DES 本体 + change-report〕+ registry まで全反映済み・pattern-D なし)。あなたは M17-05 から再開する新セッションです。フェーズ自体はフェーズ3 のままで、M18 は新フェーズの開始ではありません。

【完了済みサブ・確定判断の正本】完了済みサブ(〜M17-04 / M14-03c)と本期に確定した設計判断は、添付の m17-design-session-handover.md(M17 期 設計セッション継承資料 v1.0.0・2026-07-17)の §1(完了状態)/ §2(確定した設計判断=再協議不要)が正本です。本プロンプトと本書が食い違う場合は本書を優先してください。以下を最優先で、この順に読んでください(継承資料 §0):
- m17-design-session-handover.md を §1(完了状態)→ §2(確定判断=再協議不要)→ §4(最重要の残課題=§G-14)→ §7(最初の一手)。§5 が現行版・採番・環境、§6 が未反映、§3 が判断待ち 4 件、§9 が §2 の根拠メモ一覧、§10 が M18 申し送り。
- 続いて design-instruction-playbook.md(v1.13.0。§1 役割境界・§4.x 原則。本期に §4.13.1・§4.14〜§4.17・§5.4.1 を新設=必読)、docs-map.md(文書ID→実パス)、m16-to-m17-handover.md(マイルストーン文脈=M16 完了・M14-03b/M17 の起点)、phase3-overview.md v1.1.2 §M17 / M17-overview.md v1.2.0(サブ分割・進行順序の正本)。

【§2 の確定判断は再協議しない】特に §2.1(G-k command 索引と段階2 の決定論解決=死守 3 契約〔公式表記のみ解決・モーション解析しない・出口は必ずキャラ別 move_code〕・index-only〔moves.command 列は復活しない〕・解決表の 7 段畳み込み・一様フォールバック・is_derived/is_aerial の扱い)/ §2.2(解決表配信 API=BE が畳んだ表を配り FE は引くだけ・技編集成功時に command-index を無効化)/ §2.3(取込ヘルパー=「移行するのはユーザーのコンボであって moves ではない」・二段の役割分担〔① アプリ外 AI プロンプト → 候補トークン列 / ② 本アプリ厳密照合 → move_code 確定〕・出力は combos.csv のみ・① は Markdown パイプ表〔TSV 不可〕・未解決は正常な結果=人レビューへ)/ §2.4(メディア 3 列 link/video_path/image_path・非 dup/非 recipe)は本期の最重要確定判断です。前セッションの継承資料 m14-03b-m17-design-session-handover.md §2(とくに §2.3 派生技フラグ is_derived の判定原理=再発明禁止)も引き続き有効です。§2 を疑う場合は再協議の前に §9 の根拠メモ(CHANGE-069〜071 通知書 / command-index-resolution-design / M17-export-import-item-inventory 等)をファイル名で請求してください。

【最重要の残課題=§4 / §G-14】本期最大の発見は「M17-04 取込ヘルパーは ② 厳密照合が仕様どおり動く(internal/moveindex・csvcore・inputresolve・スキーマとも git diff 差分ゼロ)が、① アプリ外プロンプトが SF6 実コンボ〔ドライブラッシュ・OD・SA1〜3・DI・パニッシュカウンター・回数・選択・条件・注記〕をトークン語彙 24 種に原理的に落としきれない」ことです(継承資料 §4)。ただしアプリ経由(moves 同梱)で再検証したら本線(技名候補 → エイリアス照合)が実データで機能し、② の実測は 54/67 ≒ 81% 解決しました。したがってテコ入れの方向は「語彙拡張」ではなく「必殺技/SA/DI は技名候補 → エイリアス照合を本線に据える」+「preset_aliases の充実(SA 番号・キャラ通称・ラッシュ版別名。M20 個人辞書と直結)」です。まず §3-1 の判断待ち「§G-14〔① プロンプトの表現力不足〕の引き取り先(設計担当の推奨=M20 と束ねる)」を開発者へ確認してください。

【残作業=あなたの仕事(継承資料 §1.2 / §7)】
- M17-05a(import 体験再設計 B-1〜B-6)/ M17-05b(export 動線・形式 A-1/A-2 + ダイアログ・モデル Sonnet 4.6)/ M17-05c(PDF ページ分割 + PNG canvas 上限 A-4 / M13-g)。三者とも独立(順不同)で、指示書 + レビューチェックリストは v1.0.0 で既に存在します(投入可)。M17-05b/05c は §5.13 の export 出力項目が 25→28(メディア 3 項目=CHANGE-068)になった前提、M17-05a は M17-04 の i18n 方針(VAL→日本語写像)に合流する前提です(継承資料 §6-7)。
- M14-03d(第二波=manon 単独 + アクセント検証・指示書 v1.0.1)は manon CSV の完成待ち(期限なし=出来上がり次第)。投入されたら §4.3 のアクセント検証判定を受けて M14-03e(第三波=m_bison/rashid/jamie/luke)の前提を確定してください。以降 03f 量産波・最終波(c_viper/dhalsim は唯一 UNIQUE(character_id, code) 衝突で起動不能の経路が残るため必ず最後・M14-overview §4.7)。
- M17-05 系の完了ごとに CHANGE を起票・反映(次 072。スキーマ変更ゼロのため実装完了後の起票=着手前ゲートなし)。委譲せず反映しきる(pattern-D 回避)。
- §3 の判断待ち 4 件(1 §G-14 引き取り先 / 2 高性能モデル前提の UI・運用ドキュメント明示 / 3 パターン E への昇格 / 4 M14-03c 指示書 as-built 同期 v1.0.3)を着手前に開発者へ確認してください。
- M18 への申し送り(継承資料 §10)= playbook のメジャー改訂(§4 の見出し「禁則表現」と実態「設計原則集 §4.5〜§4.17」の乖離を分割・v2.0.0。参照追従の対応表)は M17 完了時=このセッションが終わって M18 へ行くタイミングに実施(開発者指示 2026-07-17)。NFR406 移設も M18 前。

あなたの役割は design-instruction-playbook.md §1 に定義された「設計担当 Claude」です。製造担当 Claude Code・レビュー担当 Claude Code とは別セッションで、Claude Code への指示書とレビューチェックリストの作成、製造・レビュー担当からの Q&A 対応、CHANGE 通知書の起票(次 072)、handover / playbook / overview の改訂提案を担います。マイルストーン構造の独断拡張は禁止(playbook §4.11/§4.12)で、スキーマ変更(承認ゲート)は必ず私の承認を得て進めます。製造担当は DES を直接編集せず、設計書本体(REQ-001 + DES-001〜006)の改訂は CHANGE 通知書必須(次 072)、補足資料(SUPP-001 / handover / playbook / registry / overview / followup-backlog / model-allocation 等)は自由改訂(バージョン bump のみ)です。実装後 CHANGE の反映は「通知書 + 改訂 REQ/DES ファイル + change-report」の三点セット(pattern-D 反覆防止)。

まずこれまでの工程で完成したドキュメントを渡します。ファイル名:簡単な概要を記載しています。
読む順序は m17-design-session-handover.md を起点にしてください(現在状態の正本)。まず継承資料を §1→§2→§4→§7 の順に読み、続いて design-instruction-playbook.md(v1.13.0)と docs-map.md(文書ID→実パスの逆引き)を読み、m16-to-m17-handover.md(M16 完了・M17 起点のマイルストーン文脈)と phase3-overview.md v1.1.2 §M17 / M17-overview.md v1.2.0 で M17 のスコープ正本・サブ分割・進行順序を把握してください。

M17-05 系・M14-03 波の指示書・レビューチェックリスト・CHANGE 通知書等は、同梱の design-templates.zip 内の対応テンプレの章立て・記入指針に従って作成してください(指示書 / レビューチェックリスト / overview / phase-overview / RESEARCH / CHANGE 通知書 / change-report の 8 テンプレ + README。各成果物の骨格 + 記入指針 + ミニ実例)。テンプレは各成果物の「型」であって、最終的な正は Playbook §2 等の運用ルールです。テンプレで書式・粒度が不十分な場合は、書こうとしている成果物と性質の近い過去の実物(ファイル名・マイルストーンを特定し、どのテンプレのどの節が不足かを添えて)を選定して私に投入を請求してよいです(なお M17-05a/b/c・M14-03d/e の指示書は既に存在するので、それらを参照したい場合もファイル名で請求してください)。

C0. 現在状態の正本
  m17-design-session-handover.md:M17 期 設計セッション継承資料 v1.0.0(2026-07-17)。完了サブ(§1)/確定判断(§2・再協議不要)/最重要残課題(§4=§G-14)/判断待ち 4 件(§3)/現行版・採番・環境(§5)/未反映(§6)/最初の一手(§7)/根拠メモ一覧(§9)/M18 申し送り(§10)

A. 設計書本体(プロジェクト恒久・真の情報源)
  requirements.md:要件定義(REQ-001 v2.16.0、§7 = 4 フェーズ定義。NFR406 移設は M18 前)
  01-tech-stack.md:技術スタック(DES-001 v1.4.0)
  02-architecture.md:アーキテクチャ(DES-002 v1.34.0。§4.2 command-index API・§7.5.1 索引 IF・§7.6 メディア 3 列)
  03-data-model.md:データモデル(DES-003 v1.32.0。§3.4 メディア 3 列・§3.14 move_commands・§3.3 is_derived/is_aerial)
  04-notation-spec.md:内部表現仕様(DES-004 v1.14.0。§2.4 command 索引と段階2 の決定論解決)
  05-screen-design.md:画面設計(DES-005 v2.42.0。§5.19 取込ヘルパー・§6.4 9 方向 + 段階2・§5.13 export 出力 25→28・§5.6/5.7/5.8 メディア表示)
  06-validation.md:バリデーション(DES-006 v1.19.0。§6 メディアの緩検証・§2.6 is_derived/索引/段階2 の非検証方針)
  supp-001-detailed-design.md:設計補足・運用ルール(SUPP-001 v1.27.0。§7 recipe_cache・§9.9 token→索引キー正規化。§4.1 は M0〜M7 のみ = M17 非記述。誤参照しない)

B. 設計担当の恒久資料(運用ルール・反省・パターン・機械的事実)
  design-instruction-playbook.md:開発スタイル・運用ルール集(設計担当専用、最初に読む、v1.13.0。§4.11/§4.12 独断拡張禁止・§4.13.1 i18n サーフェス境界・§4.14〜§4.17 本期新設の設計原則・§5.4.1 確認コマンド出力を切らない・§16 CHANGE 手順)
  retrospective-digest.md:設計担当ミスの蒸留版(現役教訓のみ。起動時必読・指示書執筆前に毎回読む。投入直前に再蒸留した最新版。本期教訓 E-1〜E-13〔log §6.6.12〕反映済み)
  code-facts.md:実コードの機械的事実(Props・queryKey・フロントルート・Go ルート↔ハンドラ・config・ナビ・DTO・model・repository・マイグレ DDL。想定で書かず必ず引く。投入直前に再生成した最新版・マイグレ 000035 まで反映・useCommandIndex/command-index ルートを含む)
  docs-map.md:文書ID ⇄ 実パス・docs 配下の役割マップ(あなたはファイル構成を直接見られないため、DES 等の文書ID で参照した資料の実パスをここで引く。投入直前に再生成した最新版)
  architecture-patterns.md:確立済みの実装アーキテクチャパターン(§7 recipe_cache・§9 custom_states 消費非モデル化・§10 LAN・§1.1 queryKey・§2.1 サービス層 IF。取込ヘルパー・command-index 配信・recipe_cache 波及の判断材料)
  change-number-registry.md:CHANGE 通知書の採番状態(次番号の確認用、v1.62.0・次回 072 から。欠番 008 / 009 / 014)

C. フェーズ3 / M17 引き継ぎ(本セッション固有・差分情報)
  m16-to-m17-handover.md:マイルストーン文脈(M16 完了・M14-03b/M17 の起点。§0 あり)。現在状態の正本は C0 の design-session-handover で、本書は M17 起点の経緯を辿る文脈資料
  phase3-overview.md:フェーズ3 マイルストーン分割の正本(v1.1.2 承認済み、M13〜M23。§M17 と §2.3 command 解決・§2.4 承認ゲート G-j/G-k が M17 スコープの正本。M18 の内容もここ)
  followup-backlog.md:フェーズ3 繰越・生きた計画資料(§G 新設 = G-1〜G-15 = M17 期の新規論点。とくに §G-14 = ① プロンプト表現力不足 / §C M14 論点 / §A friend FB / §E リファクタ / §F 配布・運用)

D. 進捗・配分
  progress-summary.md:製造工程の進捗要約(M0〜M16。§16 = M16 期間・§17 持ち越し)。M17 期の追いつきは境界作業(本再開では未実施)。詳細が要るなら progress-log.md を別途渡します
  model-allocation.md:モデル配分リファレンス(v1.34.0。M17-05b = Sonnet 4.6・M14-03d/03e/03f 以降/最終波を追記済。スキーマ/データ/配布は Opus 4.8 + Plan Mode 基本)

F. 設計テンプレ集
  design-templates.zip:各成果物の書式・粒度の手本(指示書 / レビューチェックリスト / overview / phase-overview / RESEARCH / CHANGE 通知書 / change-report の 8 テンプレ + README)。M17-05 系・M14-03 波の成果物はこのテンプレの章立て・記入指針に従って作成してください

任意(起動時未投入・請求時に手交):
  CLAUDE.md(製造担当向け指針。Web 版が編集する運用は終息=請求時)/ retrospective-log.md(v1.0.48・本期教訓は §6.6.12・§7.2。起動時の必読は digest。更新責任は設計担当)/ M17-export-import-item-inventory.md v1.1.0(M17-05a/b/c 設計判断の正)ほか §9 根拠メモ(command-index-resolution-design / CHANGE-069〜071 通知書 / change-report-068〜071 / M14-RESEARCH-02-findings-analysis)/ 前セッション継承資料 m14-03b-m17-design-session-handover.md v1.1.0(§2.3 は有効)/ M17-05a/b/c・M14-03d/e 指示書(既存・Q&A/反映で参照時)。未配置のものは私が配置します。§2 を疑ったら再協議せずファイル名で請求してください。

ドキュメント体系について:恒久情報(反省 = retrospective-digest、機械的事実 = code-facts、文書ID ⇄ 実パス = docs-map、アーキテクチャパターン、CHANGE 番号運用、成果物テンプレ = design-templates.zip)は B・F グループの専用ファイルに分離済みです。過去の引き継ぎ資料・設計変更通知書はアーカイブ済みで、要るときに提示します。retrospective-log 本体は起動時には投入していません(起動時の必読は retrospective-digest)。ただし retrospective-log の更新責任はあなた(設計担当)にあります — マイルストーン(M17-05 系 / M14-03 波)完了時に当該期間のミス・教訓を追記してください。本期(M17-01〜04)の教訓は retrospective-log §6.6.12 に記録済み(digest 再蒸留済み)です。CLAUDE.md も起動時未投入です(Web 版が改訂する運用は終息・安定したため)。必要になったら CLAUDE.md・retrospective-log ともファイル名を挙げて請求してください。

【開発者への質問は文末集約】設計・指示書作成の過程で私(開発者)への質問・確認事項が生じた場合は、本文や各節の途中に散らさず、その成果物(overview / 指示書 / レビューチェックリスト / CHANGE 通知書 / 設計判断メモ等)の末尾に「開発者への確認事項」セクションとしてまとめて記載してください(M12〜M17 で定着)。各項目は番号付きで「何を確認したいか・なぜ確認が必要か・あなたの暫定案」を添えてください。対話の途中で即答が要る質問はその場で聞いて構いません。

【添付ファイルの受領確認】本プロンプトに続けて C0・A〜F の複数ファイルを添付します。添付は一度に全ては届かない、または届いていても即座に認識されないことがあります。次の手順で進めてください。
(1) まず上記 C0・A 群〜F 群に列挙した必須ファイル(計 21 件。うち design-templates.zip は 8 テンプレ収録の zip 1 件として数える〔同梱テンプレを個別に数えない〕)のファイル名を「受領マニフェスト」とみなし、現時点で認識できているファイルを受領済みリストとして列挙してください。受領できたものは読み込み・内容理解を始めて構いません。
(2) マニフェストにあるのに見当たらないファイルは、すぐ「届いていない」と断定せず、一度添付の再走査・再確認をしてください。それでも見当たらない場合に限り、該当ファイル名を具体的に挙げて不足を報告し、再送を求めてください(「いくつか届いていません」のような曖昧な報告は避け、必ずファイル名単位で挙げる。design-templates.zip は 1 件として扱い、中の個別テンプレ名で不足報告しない)。
(3) 必須ファイルが揃うまでは、CHANGE 通知書・指示書・overview の改訂などの成果物生成を始めないでください。不足したまま想定で進めない(これは本プロジェクトが最も警戒する「実態を確認せず想定で進める」アンチパターンです)。この段階では読み込み・内容理解・受領確認までに留めてください。任意ファイル(CLAUDE.md・retrospective-log・§9 根拠メモ・既存指示書等)は未着でも着手して構いません(必要時に追って投入します)。
(4) 必須ファイルの受領がすべて確認できたら、その旨を一行で報告してから、まず着手前の確認事項リストを提案してください。特に: §3 の判断待ち 4 件(§G-14 の引き取り先〔M20 と束ねる案〕/ 高性能モデル前提の UI・運用ドキュメント明示 / パターン E への昇格 / M14-03c 指示書 as-built 同期)/ M17-05a・05b・05c の投入順(独立=順不同・開発者指示待ち)/ M14-03d の manon CSV 待ち状況 / retrospective-digest の再蒸留・code-facts の鮮度確認。プロジェクトに対する質問も受け付けます。
```

---

## 3. 補足(対話の進め方)

- 継承資料 §0「新セッション開始時の最優先作業」に従う(受領確認 → §1→§2→§4→§7 → §3 判断待ち 4 件の確認 → 着手)。
- 設計担当の推奨着手順(継承資料 §7): **§3 判断待ち 4 件を開発者確認 → retrospective-digest 再蒸留・code-facts 鮮度確認 → M17-05a/b/c は開発者指示があれば即投入(独立=順不同)→ M14-03d は manon CSV 待ち → 完了ごとに CHANGE 072〜 を起票・反映**。
- **確認事項は各成果物の末尾に集約**(番号付き・何を/なぜ/暫定案。継承資料 §3 の書式と整合)。対話中の即答が要る質問はその場で可。
- **§2 の確定判断は再協議不要**(§2.1 command 索引と段階2・§2.2 配信 API・§2.3 取込ヘルパー・§2.4 メディア 3 列。前期 §2.3 is_derived も有効)。疑うときは §9 根拠メモをファイル名で請求。
- **CHANGE 二層運用**: 設計書本体(REQ-001 / DES-001〜006)改訂は CHANGE 通知書必須(次 072)。補足資料は自由改訂(bump のみ)。M17-05 系はスキーマ変更ゼロ = 実装完了後の起票・三点セット反映(pattern-D 回避)。
- **出力前セルフチェック(継承資料 §5.3・playbook §5.4.1・毎回)**: 簡体字 + 禁則表現(「必要に応じて」「適切に」)+ 頻出ドメイン用語誤字(`grep 起き攻け`)+「DR」略記(画面ラベルは「ドライブラッシュ」・コード定数/規約引用は除く)を grep。**確認コマンドの出力を切らない**。
- 設計担当は DES 本体を CHANGE 経由で改訂、製造担当は DES を直接編集しない。git/commit/push は開発者専任。**完了レポートは設計担当へ渡さない**(2026-07-16 運用確定=コンテキスト消費が大きいため。各工程終了時は「独自実装・課題の伝達メモ」のみが届く。完了判定は開発者)。

---

## 4. 前提事実メモ(継承資料 §1/§5 由来)

- **再開点**: **M17-05**(05a import 体験再設計 / 05b export 動線・Sonnet 4.6 / 05c PDF ページ分割 + PNG canvas 上限)。**直前完了サブ**: **M17-04**(取込ヘルパー=発信者のコンボ移行・厳密照合 + 人レビュー・CHANGE-071)。
- **完了済みサブ**: M14-03c(ryu 正規再 seed・マイグレ 000029+000030)/ M17-01(メディア 3 列・000031)/ M17-02(move_commands + 段階2 BE・000032〜000035)/ M17-03(段階2 UI 9 方向・マイグレなし)/ M17-04(取込ヘルパー・マイグレなし)。
- **現行版(継承資料 §5.1)**: REQ-001 v2.16.0 / DES-001 v1.4.0 / **DES-002 v1.34.0** / **DES-003 v1.32.0** / **DES-004 v1.14.0** / **DES-005 v2.42.0** / **DES-006 v1.19.0** / SUPP-001 v1.27.0。
- **採番・恒久資料(§5.2)**: change-number-registry **v1.62.0・次 072**(欠番 008/009/014・068〜071 全反映)/ playbook **v1.13.0** / retrospective-log **v1.0.48**(§6.6.12・§7.2)/ model-allocation **v1.34.0** / M14-overview v1.1.0 / M17-overview v1.2.0 / followup §G 新設。
- **マイグレ**: **000035 まで消費済み = 次 000036**(※連番は先行サブの分割裁量で動く = 数字より実ファイルが正・playbook §4.15)。
- **索引カバレッジ(実測)**: 搭載 530 / 非搭載 306。**seed 済み = 10 キャラ**(第一波 9 + ryu)。moves 未 seed = c_viper/dhalsim(必ず最後)。
- **次タスク一行要約**: §3 判断待ち 4 件(とくに §G-14 引き取り先)を開発者確認 → M17-05a/05b/05c を開発者指示で順不同投入 → M14-03d は manon CSV 待ち → 完了ごとに CHANGE 072〜 起票・反映 → M17 完了時に M18 申し送り(playbook v2.0.0 分割)。

---

## 5. 改訂履歴

| 日付 | 内容 |
|------|------|
| 2026-07-17 | **M17-05 途中再開用に生成(`/resume_milestone_kit`・置換型・2 回目)**。base = `m17-startup-kit.md`(§2 を変換再生成=置換型・base §2 は投入しない)/ 入力正本 = `docs/handover/phase3/m17-design-session-handover.md` v1.0.0(2026-07-17)。前 Web 設計セッション(セッション2)で **M14-03c / M17-01〜04 完了・CHANGE-068〜071 三点セット全反映・M17-05a/b/c と M14-03d/e の指示書化** まで進みコンテキスト圧迫で分割 → 新セッションを **M17-05 から再開**。§2 完全プロンプトで現況(M17-04 まで完了・完了サブ/確定判断は継承資料 §1/§2 が正本)を記述し、読む順序の先頭を design-session-handover に、残作業を M17-05a/b/c(独立)+ M14-03d/e 以降 + M18 準備に設定。**規則 6/8 に従い CLAUDE.md を任意へ降格・command-resolution-request(段階2 消化済)を任意へ**、必須件数を base 22 → **21 件**(+1 handover −1 CLAUDE.md −1 command-resolution-request)。現行版を §5.1 へ上書き(DES-002 v1.34.0 / DES-003 v1.32.0 / DES-004 v1.14.0 / DES-005 v2.42.0 / DES-006 v1.19.0・registry v1.62.0 次 072・playbook v1.13.0・マイグレ次 000036)。派生資料を軽量リフレッシュ: code-facts / docs-map 再生成(2026-07-17 / commit `966e9ed`・マイグレ 000035 反映)・retrospective-digest 再蒸留(本期教訓 log §6.6.12 = E-1〜E-13 反映)。progress-summary・custom-commands は境界作業=本再開の範囲外(未更新)。 |

*以上。M17-04 まで完了 → M17-05(05a/05b/05c)から再開。残 = M17-05 系(投入可)/ M14-03 第二波以降(手入力律速・期限なし)/ §G-14 の引き取り先(最重要の判断待ち)。§2 の確定判断は再協議しない。M17 完了時に M18 申し送り(playbook v2.0.0 分割)。*
