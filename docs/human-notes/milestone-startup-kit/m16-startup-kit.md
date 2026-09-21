# M16(データモデル拡充・スキーマの継ぎ目)起動キット

> 本ファイルは **フェーズ3 設計担当(Claude Web 版「設計・指示書作成担当」)チャット**を
> 立ち上げるためのプロンプト本文 + 投入ファイル一覧。流用方法は同フォルダの `README.md` を参照。
>
> **本キットは標準の連番マイルストーンキット(`m4`〜`m15-startup-kit.md`)の系譜です。**
> 直前の連番キットは `m15-startup-kit.md`(フェーズ3・入力/使いやすさ向上 = friend FB 第一波 + マイルストーン再編)で、
> 本キットは **M15 コード完了**(M15-01〜06・CHANGE-056〜059、2026-07-04)を引き継ぎ、**M16 データモデル拡充・
> スキーマの継ぎ目**を起こします。**フェーズ自体はフェーズ3 のまま**(M16 は新フェーズの開始ではない)。
>
> **M15 と M16 は性格が変わります。** M15 は全サブ非スキーマ(UX・表記・タグ色・オンボーディング)でしたが、
> **M16 はデータモデルの根 = スキーマ変更・§6 承認ゲートを伴い、SF6 ドメイン判断を含み開発者確認必須**です。
> 破壊的マイグレーションの安全性・後方互換 CSV 契約の観点が中核になります。
>
> **一次資料は引き継ぎ書 `m15-to-m16-handover.md`(§0 あり)** と **`phase3-overview.md` v1.1.2 §M16 / §2.4(承認ゲート
> G-a〜G-k)** です。読む順序は handover **§0 まず読む → §1 M15 完了 → §3 M16 申し送り → §4 M15-07 処遇 → §7 最初の一手**
> を主軸に、**§2 設計判断・§5 現行版/採番/環境・§6 未反映残タスク・§8 M15 教訓ダイジェスト** を前提として読みます
> (docs-map.md で文書ID→実パスを引きながら)。
>
> **M16 は単一タスク構成です**(M14/M15 のような「(II) マイルストーン再編」は phase3-overview v1.1.2 で完了済みのため無し)。
> ただし冒頭に **M15 wrap-up の片付け**(M15-overview 更新・M15 教訓の retrospective-log 転記)を早期タスクとして含みます。
>
> **本キットは複数ファイル添付時の受領確認ブロック(M10 から継続)を含みます**(下記 §2 末尾)。各成果物末尾への
> 「開発者への確認事項」集約(M12/M13/M14/M15 で定着)を引き続き踏襲します。

---

## 0. 本キットの位置づけ / 新セッションの作業順序(必読)

### 0.1 時系列

フェーズ1(M0〜M7)完了 → 整理工程(CHANGE-020 / 021)→ フェーズ2(M8〜M12)完了(2026-06-26 = 先行リリース実施点)→
**フェーズ3 キックオフ** → **M13(データ共有・export/import)完了**(CHANGE-050〜052、2026-06-28)→ **M14(公式データ配布是正・
スキーマ整理・DB 同梱)コード完了**(CHANGE-053〜055、2026-07-01。M14-03b 配布 seed は M16 後/M17 前へローリング保留)→
**M15(入力・使いやすさ向上 = friend FB 第一波)完了**(M15-01〜06・CHANGE-056〜059、2026-07-04)→ コンテキスト移行 →
**本キット = M16 の設計セッション**。

M15 は friend 先行リリース(2026-06-28・17 件の FB)第一波を **非スキーマ**(入力方式ボタン化・info-mark ヘルプ・
表示整理・タグ色・オンボーディング・コマンド解決 段階1・必殺技直接指定 UI 骨格)で消化した。**データに触れる論点は
すべて M16 へ routing** して非スキーマ規律を守った(handover §2-5・§8 L-M15-3-6)。**M16 はその「宿題」を承認ゲート付きで
回収する**: データモデル拡充・スキーマの継ぎ目 = ①ゲージ属性(SA 消費列)/ ②ドライブ小数化 / ③起き攻め正規化 /
④ステップ taxonomy 明文化 + 移動(ジャンプ・ダッシュ)の system move 登録 / ④' target_combo 区分正典化 /
④'' dash 二重表現一本化。**SF6 ドメイン判断を含み、各スキーマ変更は §6 承認ゲート(個別承認)**。

### 0.2 新セッションの作業順序(`m15-to-m16-handover.md` §0/§7 起点)

> **本セッションは M16 単一タスク**(再編は phase3-overview v1.1.2 で完了済み)。記憶で進めず、handover 実査 +
> code-facts / 実コード + `phase3-overview §M16` で裏取りする。

**早期(M15 wrap-up の片付け・handover §6/§7-5):**

0. **M15-overview の更新**(handover §6-1・未反映): §3 サブ表(M15-06=⑯・M15-05 完了)・§4.2(⑰→M15-05・
   **M15-07→M16 rollout**)・§4.6・§5・確認事項5 を M15 完了状態へ更新。開発者が更新タイミングを一任済み。
0'. **M15 教訓の retrospective-log 転記**(handover §6-2・未反映): 一時ノート 4 本(`m15-03-retrospective-notes-TMP` /
   `m15-04-design-notes-TMP` / `m15-05-design-notes-TMP` / handover §8 の M15-06 教訓)を retrospective-log へ転記。
   **log は開発者手交待ち**。転記後、開発者が Claude Code で `/retrospective-digest-update` を実行して digest を再蒸留する
   (digest は設計担当にとって読み取り専用)。**⚠ 本キット投入時点では M15-03〜06 教訓は digest 未反映**(0.4 参照)。

**本体(M16 着手準備):**

1. **phase3-overview v1.1.2 §2.4(承認ゲート G-a〜G-k)・§M16 を必読**し、④/④'/④''/① の論点を棚卸しする
   (handover §7-1)。**M16 スコープの正本は phase3-overview §M16**。⚠ **supp-001 §4.1 は M0〜M7 のみで M16 を記述しない**。
2. **M14-03b seed 状況を確認**(handover §7-2): 全キャラ move_code 充足 = 段階1・taxonomy の前提。現行 HEAD は ryu 中心。
3. **dash 一本化(④'')・target_combo 区分正典化(④')の移行計画**を、既存データ影響(FR301 dup・レシピ同一性)と
   セットで設計し、**§6 承認ゲートに載せる**(handover §7-3)。**各ゲートは個別に開発者承認**を得る。
4. **① 始動 vs 消費(ドライブ/SA ゲージ)のデータ確定** → その後 **M16 表記 rollout(旧 M15-07・下記 0.3)**(handover §7-4)。
5. **M16-overview を作成**(M14/M15-overview 書式。サブ分割・承認ゲート順・CHANGE 見込みの正本)。**旧 M15-07 を
   末尾サブ「M16 表記 rollout」として配置**(0.3)。**§3「依存」列 + §5「依存関係・進行順序」で worktree 並列可否を明示**(0.5)。
6. 各サブの使用モデルを model-allocation.md(v1.28.0)に追記。**M16 はスキーマ変更 = Opus 4.8 + Plan Mode 基本**
   (M15 の Sonnet 中心とは異なる。model-allocation の M12 注「UX・正しさ・データモデルは Opus」)。

### 0.3 M15-07 → M16 表記 rollout(旧 M15-07 の移管・重要)

- **M15-07 = 「M16 依存表記の追従(FB⑥⑨⑪⑬)」**。M15 期内は **未着手**(単独指示書も未作成)。開発者提案「M16 か M17 の
  担当か」への回答は **M16 担当が実施を推奨**(handover §4)。
- **順序依存(逆順は誤ラベル)**: FB⑥(技/非技ラベル)は **M16 ④ taxonomy 確定後**、FB⑨⑪⑬(ドライブ/SA「始動」vs
  「消費」ラベル)は **M16 ① 始動 vs 消費 確定後**でないと正しいラベルが書けない(handover §2-3・§8)。
- **配置**: taxonomy が fresh な M16 担当が **「M16 表記 rollout」として M16 の末尾(データ確定後)で実施**するのが最も安全・
  自然(M17 = command 解決 段階2 は無関係で不適)。**M16-overview では旧 M15-07 を末尾サブに置き、④/① のデータ確定を
  前提依存として明記**すること。phase3-overview §M16 への「M16 表記 rollout(旧 M15-07・FB⑥⑨⑪⑬)= taxonomy/始動消費
  確定後」明記も推奨(開発者の最終承認を得てから確定・handover §4)。

### 0.4 確定事項の継承(`m15-to-m16-handover.md` §1/§2、再協議不要)

- **M15 はコード完了**(全サブ非スキーマ)。M15-01 test-id 規約 / M15-02 info-mark + 「比較対象選択」改称(056)/
  M15-03 入力ボタン化 + コマンド解決 段階1 + 直接指定 UI + modifier flags + dash 近手当て(057・DES-004 v1.7.0)/
  M15-04 タグ色ピッカー(CHANGE なし)/ M15-05 表示整理 + 比較画面 生 ID バグ(058)/ M15-06 オンボーディング⑯(059・
  `onboarding-seen-v1`)。CHANGE 056〜059 全反映(registry v1.47.0・次 060)。
- **dash canonical = system move**(handover §2-1): DES-004 §2.1「移動は 1入力=1move。2 通り表現はデータ揺れ」原則の帰結。
  **SUPP-001 §3.3.3 の modifier.type `dash_forward`/`dash_back` が原則違反の重複**。M15-03 で新規入力経路は system move へ
  寄せた(近手当て・CHANGE-057 §7-1)。**modifier.type dash の廃止 + 既存データ移行は M16(④'')**。**parry_drive_rush は
  cancel 注釈のため modifier.type のまま正**(移動ではない)。
- **段階1(通常技の方向ゾーン×ボタン決定論引き当て)は実装済・非スキーマ・command 非依存**(handover §2-4)。**段階2
  (command 依存の特殊技解決)+ 索引元 command 再確立(G-k)は M17**。M16 で段階2 を扱わない。
- **M15 の非スキーマ規律の載せ先**(handover §2-5): OD/modifier 変種 = 既存 `modifiers.flags`(JSON)/ 別技 = 残置
  プルダウン / タグ色 = 既存 `tags.color`(HEX)/ UI 状態 = localStorage(`web/src/lib/browser-storage.ts`)。M16 は
  データ論点を回収する側。
- **M14-03b(全キャラ seed)は M16 前提**(handover §5-3・§7-2): 現行 HEAD は ryu 中心。**M14-03b は M16 後/M17 前に実施**
  (M16 が moves スキーマを触るため再入力 churn 回避)。**配布リリースは M14-03b 完了までブロック**(コード完了 ≠ 配布可能)。
- **検証**: `make e2e`(永続 dev DB 残渣**非依存** = seed 非依存 self-contained へ M15 で改善)+ Vitest。

### 0.5 worktree 並列実行と M16-overview の依存注記(開発者運用・重要)

- **開発者は最近 git worktree による並列実行を運用中**(`scripts/wt-*.sh` + `.claude/commands/*_wt.md`。**2〜3 並列想定**)。
  複数サブマイルストーンの製造/レビュー/取り込みを別 worktree(別ブランチ・別ポート・別 DB)で同時進行できる。
- **依頼**: **M16-overview の §3「依存」列 + §5「依存関係・進行順序」で、各サブが「worktree 並列可(相互独立)」か「直列必須
  (先行サブのデータ/スキーマ確定に依存)」かを明示**してほしい。これにより開発者が worktree レーンの割付(何を同時に走らせ、
  何を順に走らせるか)を判断できる。**既存の注記慣行を踏襲**すること(例: M15-overview §5「M15-04 / M15-05 / M15-06: 相互
  独立・並行可」/ M14-overview §5 の逆依存 = 段階削除必須)。
- **M16 は直列寄りである点に留意**: ④ taxonomy → ④'' dash 一本化 → 旧 M15-07 表記 rollout、① データ確定 → 表記 rollout の
  ように **承認ゲート・スキーマ移行・ドメイン判断の連鎖が多く、多くのサブは順序依存**。並列化は「指示書完成度が高く独立性の
  高いタスク群」に限定するのが安全(retro-002-M1 R-04「新領域・ドメイン判断重は直列基本」)。**独立に切り出せるサブ(例:
  ② drive 小数化のような波及が閉じた変更)があれば明示的に「並列可」とマーク**し、承認ゲート連鎖は「直列必須」と明記する。

---

## 1. 投入ファイル一覧(開発者用・パス付き)

Web チャットへアップロードするファイル。**必須**は初回投入、**任意**は対話の中で要望が出たとき・
必要になったときに渡す。

> **投入直前の鮮度更新(必須)**: `code-facts.md` は `/regen_code_facts`、`docs-map.md` は `/regen_docs_map`、
> `retrospective-digest.md` は `/retrospective-digest-update` で **投入直前に再生成し、現行コード / 構成 / 最新
> 教訓と一致させた版を貼る**こと。最終的な正は常に実コード / 実ファイルで、これらは静的抽出ゆえの限界がある。
> **⚠ 本キット生成時点の鮮度状況**: code-facts / docs-map は 2026-07-04(commit `094f741`)再生成済み。
> **retrospective-digest は M15-03〜06 教訓が未反映**(handover §6-2 = 一時ノート 4 本が retrospective-log に未転記のため。
> 上記 0.2-0' で転記 → 再蒸留)。**progress-summary は M0〜M15 まで追いついた**(M14・M15 をキャッチアップ要約済み)。

### 必須(初回投入・計 21 件)

**A. 設計書本体(プロジェクト恒久・真の情報源)**

| # | ファイル名 | リポジトリ上のパス | 種別 |
|---|-----------|------------------|------|
| 1 | requirements.md | `docs/design/requirements.md` | REQ-001 v2.16.0(§7 = 4 フェーズ定義。**M16 で REQ 候補あり**・NFR406 フェーズ移設の CHANGE を M18 前に見込み) |
| 2 | 01-tech-stack.md | `docs/design/01-tech-stack.md` | DES-001 v1.4.0 |
| 3 | 02-architecture.md | `docs/design/02-architecture.md` | DES-002 v1.28.0 |
| 4 | 03-data-model.md | `docs/design/03-data-model.md` | DES-003 v1.23.0(**M16 の主戦場**。SA 消費列・起き攻め正規化・drive 型・move taxonomy・dash 一本化の CHANGE 候補) |
| 5 | 04-notation-spec.md | `docs/design/04-notation-spec.md` | DES-004 v1.7.0(CHANGE-057。§2.1「移動は 1入力=1move」原則 = ④'' 一本化・④ taxonomy の根拠) |
| 6 | 05-screen-design.md | `docs/design/05-screen-design.md` | DES-005 v2.34.0(CHANGE-059。**M16 で表示・比較軸・表記 rollout の改訂見込み**) |
| 7 | 06-validation.md | `docs/design/06-validation.md` | DES-006 v1.14.0(**M16 で SA 消費・正規化の検証連動を判断**) |
| 8 | supp-001-detailed-design.md | `docs/design/supp-001-detailed-design.md` | SUPP-001 v1.25.0(**§3.3.3 `MODIFIER_NON_MOVE_TYPES` が ④'' dash 一本化の対象**。§4.1 は M0〜M7 のみ = **M16 非記述**) |

**B. 設計担当の恒久資料(運用ルール・反省・パターン・機械的事実)**

| # | ファイル名 | リポジトリ上のパス | 種別 |
|---|-----------|------------------|------|
| 9 | design-instruction-playbook.md | `docs/handover/design-instruction-playbook.md` | 運用ルール集(v1.12.0。最初に読む。§1 役割境界・§4.11/§4.12 マイルストーン構造の独断拡張禁止・§16 CHANGE 手順 = **承認ゲート起票で直結**) |
| 10 | retrospective-digest.md | `docs/handover/retrospective-digest.md` | **設計担当ミス蒸留版**(現役教訓のみ。指示書執筆前に必読。投入直前に `/retrospective-digest-update` で再蒸留)。**⚠ M15-03〜06 教訓は未反映**(0.2-0' で retrospective-log へ転記 → 再蒸留してから指示書執筆に使う) |
| 11 | code-facts.md | `docs/handover/code-facts.md` | **機械的事実の参照元**(Props・queryKey・フロントルート・Go ルート↔ハンドラ・config・ナビ・DTO・model。想定で書かず必ず引く。投入直前に `/regen_code_facts` で再生成。**2026-07-04 / commit `094f741` 再生成済**) |
| 12 | docs-map.md | `docs/handover/docs-map.md` | **文書ID ⇄ 実パス・役割マップ**(設計担当はファイル構成を直接見られない。`DES-003` 等の実パス逆引き。投入直前に `/regen_docs_map` で再生成。**2026-07-04 / commit `094f741` 再生成済**) |
| 13 | architecture-patterns.md | `docs/handover/architecture-patterns.md` | 確立アーキテクチャパターン(§9 custom_states 消費非モデル化 / recipe_cache §7・§10 LAN・§1.1 queryKey・§2.1 サービス層 IF。**起き攻め正規化・recipe_cache 波及の判断材料**) |
| 14 | change-number-registry.md | `docs/handover/change-number-registry.md` | CHANGE 番号運用(**次回採番 060**。欠番 008 / 009 / 014。直近 = CHANGE-056〜059 = M15 反映) |

**C. フェーズ3 / M16 引き継ぎ(本セッション固有・差分情報)**

| # | ファイル名 | リポジトリ上のパス | 種別 |
|---|-----------|------------------|------|
| 15 | m15-to-m16-handover.md | `docs/handover/phase3/m15-to-m16-handover.md` | **主引き継ぎ書**(**§0 あり**。§0 まず読む・§1 M15 完了・§2 設計判断・§3 M16 申し送り・§4 M15-07 処遇・§5 現行版/採番/環境・§6 未反映残タスク・§7 最初の一手・§8 M15 教訓ダイジェスト) |
| 16 | phase3-overview.md | `docs/instructions/phase3-overview.md` | **フェーズ3 マイルストーン分割の正本**(v1.1.2・承認済み、M13〜M23)。**§M16 と §2.4 承認ゲート G-a〜G-k が M16 スコープの正本**。番号振り直し・実装順・CHANGE 起票は設計担当委任 |
| 17 | followup-backlog.md | `docs/handover/followup-backlog.md` | **フェーズ3 繰越・生きた計画資料**。**§A friend FB(2026-06-28・17 件 = FB⑥⑨⑪⑬ の源 = 旧 M15-07 rollout)** / §C M14 論点(C-1 配布完了定義) / §D M13 統合可否 / §E リファクタ / §F 配布・運用 |

**D. 進捗・配分**

| # | ファイル名 | リポジトリ上のパス | 種別 |
|---|-----------|------------------|------|
| 18 | progress-summary.md | `docs/progress/progress-summary.md` | 進捗要約 **M0〜M15**(§14 = M14 期間・§15 = M15 期間・持ち越し = M16 着手時点)。M14/M15 をキャッチアップ要約済み |
| 19 | model-allocation.md | `docs/human-notes/model-allocation.md` | モデル配分(v1.28.0。**M16 サブは着手時追記**。**M16 はスキーマ変更 = Opus 4.8 + Plan Mode 基本**) |

**E. プロジェクト指針**

| # | ファイル名 | リポジトリ上のパス | 種別 |
|---|-----------|------------------|------|
| 20 | CLAUDE.md | `CLAUDE.md`(リポジトリルート) | 製造担当向け指針(設計担当も概要把握・編集境界 §8・禁止事項 §10・**§10.X ブラウザストレージ許容表**のため一読) |

**M16 データモデル spec 用(開発者手交)**

| # | ファイル名 | リポジトリ上のパス | 種別 |
|---|-----------|------------------|------|
| 21 | friend-feedback-datamodel-issues(データモデル論点 spec) | (**開発者が別途手交。リポジトリ未コミット・repo 外**) | **M16 ①〜④ の一次詳細 spec**(datamodel-issues ①ゲージ属性 / ②ドライブ小数 / ③起き攻め正規化 / ④ステップ taxonomy)。phase3-overview §M16 が正本だが、各論点の背景・上位プレイヤー需要の根拠は本 spec 側にある。**リポジトリに無いため、ファイル名を具体的に挙げて請求すること**(想定で仕様を埋めない)。届かない場合は phase3-overview §M16 を正として進め、詳細確定時に請求 |

> **retrospective-log.md は起動時に投入しない**(起動時の必読は #10 digest)。ただし **retrospective-log の
> 更新責任は設計担当(本 Web 版)にある**——マイルストーン完了時に当該期間のミス・教訓を本書へ追記する。
> **⚠ M15-03〜06 期間の教訓は一時ノート 4 本(TMP)に留まり retrospective-log 未転記**(handover §6-2)。**本セッションの
> 早期タスク**として TMP を retrospective-log へ転記し、その後 Claude Code が `/retrospective-digest-update` で digest を
> 再蒸留する(digest は設計担当にとって読み取り専用)。更新・事例遡及が必要なときに開発者へ投入を要求する。

### 任意(対話の中で要望が出たとき・必要になったときに投入)

| ファイル名 | パス | 渡すタイミング |
|-----------|------|--------------|
| M16 各論点の詳細 spec draft(punish-finder-spec-draft / creator-benefits / command-resolution-request 等) | (**リポジトリ外・開発者手交・未コミット**) | ①〜④ の各承認ゲート詳細を確定するとき(SA 消費・起き攻め正規化・taxonomy 等)。ファイル名を具体的に挙げて請求すること(想定で仕様を埋めない) |
| 過去の指示書テンプレート(直近完成 = M15-06 + M15-05 / スキーマ・破壊的マイグレ級 = M14-01 + M14-02 + 各レビューチェックリスト) | 直近 = `docs/instructions/phase3/M15-06-onboarding-advanced-mode.md` ・ `docs/instructions/phase3/M15-05-display-tidy-compare-id-bug.md`(+ `reviews/M15-06-review-checklist.md` ・ `reviews/M15-05-review-checklist.md`)/ スキーマ級 = `docs/instructions/M14-01-schema-cleanup.md` ・ `docs/instructions/M14-02-import-pipeline-staged-removal.md`(+ 各 `reviews/*-review-checklist.md`) | 指示書 / レビューチェックリストのテンプレート参照用(M16 の指示書は未作成のため直近完成版を例示)。**M16 は破壊的マイグレ・承認ゲートを含むため、スキーマ級の M14-01 / M14-02 が特に参考になる** |
| M14-03-distribution-seed.md | `docs/instructions/M14-03-distribution-seed.md` | M14-03b(全キャラ seed = M16 前提)の内容・配布 blocker(clean DB 要件・全 30/31 キャラ)の詳細を確認するとき |
| M15-overview.md | `docs/instructions/phase3/M15-overview.md` | M15 完了状態・FB 17 件の処遇・旧 M15-07 の位置づけ(§4.2 確認事項5)を遡るとき、または M16-overview の書式・粒度を参照するとき(**§3 依存列・§5 依存関係・進行順序 = 並列注記の書式手本**) |
| testid-convention.md | `docs/design/testid-convention.md` | E2E で test-id を扱うとき(test-id 正本。M15-01 で `combo-editor-*` 規約確立) |
| retrospective-log.md | `docs/handover/retrospective-log.md` | **設計担当が更新責任を持つ**。M15-03〜06 教訓の転記(0.2-0')、または digest だけでは足りず過去ミスの事実関係を遡るとき |
| CHANGE 通知書(056〜059 = M15 期間分) | `docs/change-notes/` | M15 で確定した表記・比較・オンボーディングの契約・経緯を遡るとき(特に 057 = dash 近手当て・DES-004) |
| progress-log.md | `docs/progress/progress-log.md` | M1〜M15 の詳細(curl 出力・E2E 手順・実装メモ)が必要になったとき |
| worktree 運用メモ(開発者向け) | `docs/human-notes/worktree-scripts-guide.md` ・ `docs/human-notes/parallel-execution-guide.md` | 並列注記(0.5)の粒度を詰めるとき、worktree 前提(2〜3 並列・ポート導出)を確認するとき。**Claude Code は scripts/git を実行しない(開発者が行う)** |
| アーカイブ handover(handover_1 / m1-to-m2 〜 m14-to-m15 等) | `docs/handover/` ・ `docs/handover/archive/` | 基本設計時点の前提や M1〜M15 期・整理工程の細部を遡るとき |

> M15 → M16 の変更点: 主 handover が `m15-to-m16-handover.md`(**§0 あり** = 読む順序を §0 起点に戻す。m15 の
> §0 なし対応から復帰)。**再編タスク(II)は phase3-overview v1.1.2 で完了済みのため削除** = M16 は単一タスク
> (M16 着手準備 + M15 wrap-up 片付け)。**必須の replan-input(#21)を廃し、M16 一次 spec の friend-feedback-datamodel-issues
> を #21 開発者手交枠へ差し替え**。設計書本体は M15 期間に **DES-004 v1.6.3→v1.7.0 / DES-005 v2.30.0→v2.34.0**
> (CHANGE-056〜059)へ改訂。`change-number-registry` 次回 **060**。マイグレーション **000018** まで(M16 は 000019 以降)。
> **progress-summary は M0〜M13 → M0〜M15 へキャッチアップ**。M16 主参照は DES-003 / DES-004 §2.1 / SUPP-001 §3.3.3 /
> phase3-overview §M16 / followup-backlog §A。

---

## 2. 最初のプロンプト(コピペ用)

```text
私はストリートファイター6(以下 SF6)のコンボを効率的に管理・比較・共有するための Web アプリケーションを個人開発中のエンジニアです。本体アプリは Go(modernc.org/sqlite)+ Echo + React + TypeScript の単一バイナリ配布です。

あなたは、データモデル設計・スキーマ設計・破壊的マイグレーションの安全な搬送(後方互換 CSV 契約を含む)・正規化、および SF6 のドメイン知識を要する分類設計に精通したシニアソフトウェアエンジニアです。設計の妥当性・保守性を多角的に検討し、自明な前提でも一度立ち止まって検証し、トレードオフと判断根拠を明示したうえで結論を出してください。不確かな点は推測で埋めず確認事項として挙げ、品質に妥協しないでください。特に本マイルストーン(M16)はスキーマ変更・承認ゲートを伴うため、破壊的マイグレーションの安全性(既存データ影響・FR301 重複キー・レシピ同一性・recipe_cache 波及)と後方互換 CSV(export/import)契約の観点を常に併せて検討してください。その立場で「詳細設計・製造準備担当」(設計・指示書作成担当)として私の作業を支援してください。

現在、要件定義・基本設計は完了済みで、フェーズ1(MVP、M0〜M7)・フェーズ2(先行リリース準備、M8〜M12)が完了しています。フェーズ3(共有・協調・入力拡充)では、M13(データ共有 = export/import、CHANGE-050〜052)→ M14(公式データ配布是正・スキーマ整理・DB 同梱、CHANGE-053〜055)コード完了 → M15(入力・使いやすさ向上 = friend FB 第一波、CHANGE-056〜059)完了、と進みました。あなたはその M15 完了状態を引き継ぐ、フェーズ3 の継続設計担当です。フェーズ自体はフェーズ3 のままで、M16 は新フェーズの開始ではありません。

本セッションは M16「データモデル拡充・スキーマの継ぎ目」の着手準備です(単一タスク。マイルストーン再編は M14/M15 で実施し phase3-overview.md は v1.1.2 として承認済みのため、本セッションに再編タスクはありません)。M15 は friend FB 第一波を非スキーマ(入力方式ボタン化・info-mark ヘルプ・表示整理・タグ色・オンボーディング・コマンド解決 段階1・必殺技直接指定 UI 骨格)で消化し、データに触れる論点はすべて M16 へ routing しました。M16 はその「宿題」を承認ゲート付きで回収します: ①ゲージ属性(SA 消費列)/ ②ドライブ小数化 / ③起き攻め正規化 / ④ステップ taxonomy 明文化 + 移動(ジャンプ・ダッシュ)の system move 登録 / ④' target_combo 区分正典化 / ④'' dash 二重表現一本化。SF6 ドメイン判断を含み、各スキーマ変更は §6 承認ゲート(G-a〜G-k)として個別に私(開発者)の承認を得て進めます。M16 のスコープの正本は phase3-overview.md v1.1.2 §M16 / §2.4 です(注: supp-001 §4.1 は M0〜M7 のみで M16 を記述しません。誤参照しないでください)。

M15-07 の扱い: M15 には「M16 依存表記の追従(FB⑥⑨⑪⑬)」= 旧 M15-07 がありましたが、これは M16 のモデル判断の直接の帰結(FB⑥ = ④ taxonomy 確定後 / FB⑨⑪⑬ = ① 始動 vs 消費 確定後でないと誤ラベルになる、順序依存)のため M15 では未着手とし、M16 へ移管しました。M16-overview では旧 M15-07 を「M16 表記 rollout」として M16 の末尾サブ(④/① のデータ確定後)に配置してください。M17(command 解決 段階2)ではありません。

あなたの役割は design-instruction-playbook.md §1 に定義された「設計担当 Claude」です。製造担当 Claude Code・レビュー担当 Claude Code とは別セッションで、Claude Code への指示書とレビューチェックリストの作成、製造担当・レビュー担当からの Q&A 対応、CHANGE 通知書の起票、handover / playbook / overview の改訂提案を担います。マイルストーン構造の独断拡張は禁止(playbook §4.11/§4.12)で、スキーマ変更(承認ゲート)は必ず私の承認を得て進めます。

まずこれまでの工程で完成したドキュメントを渡します。ファイル名:簡単な概要を記載しています。
読む順序は m15-to-m16-handover.md を起点にしてください(同書は §0 を持ちます)。まず design-instruction-playbook.md と m15-to-m16-handover.md を読み、docs-map.md で文書ID→実パスを引きながら、handover §0 まず読む → §1 M15 完了 → §3 M16 申し送り → §4 M15-07 処遇 → §7 最初の一手 を主軸に(§2 設計判断・§5 現行版/採番/環境・§6 未反映残タスク・§8 M15 教訓ダイジェスト を前提として)読むと M16 の全体構造が掴め、続いて phase3-overview.md v1.1.2 §M16 / §2.4(承認ゲート G-a〜G-k)で M16 のスコープ正本が把握できます。

A. 設計書本体(プロジェクト恒久・真の情報源)
  requirements.md:要件定義(REQ-001 v2.16.0、§7 = 4 フェーズ定義。M16 で REQ 候補・NFR406 移設は M18 前)
  01-tech-stack.md:技術スタック(DES-001 v1.4.0)
  02-architecture.md:アーキテクチャ(DES-002 v1.28.0)
  03-data-model.md:データモデル(DES-003 v1.23.0。M16 の主戦場 = SA 消費列・起き攻め正規化・drive 型・move taxonomy・dash 一本化)
  04-notation-spec.md:内部表現仕様(DES-004 v1.7.0。§2.1「移動は 1入力=1move」原則 = ④'' 一本化・④ taxonomy の根拠)
  05-screen-design.md:画面設計(DES-005 v2.34.0。M16 で表示・比較軸・表記 rollout の改訂見込み)
  06-validation.md:バリデーション(DES-006 v1.14.0。M16 で SA 消費・正規化の検証連動を判断)
  supp-001-detailed-design.md:設計補足・運用ルール(SUPP-001 v1.25.0。§3.3.3 MODIFIER_NON_MOVE_TYPES が ④'' dash 一本化の対象。§4.1 は M0〜M7 のみ = M16 非記述)

B. 設計担当の恒久資料(運用ルール・反省・パターン・機械的事実)
  design-instruction-playbook.md:プロジェクト恒久の開発スタイル・運用ルール集(設計担当専用、最初に読む、v1.12.0。§4.11/§4.12 独断拡張禁止・§16 CHANGE 手順 = 承認ゲート起票で直結)
  retrospective-digest.md:設計担当ミスの蒸留版(現役教訓のみ。指示書執筆前に毎回読む。投入直前に再蒸留した最新版。※本キット投入時点では M15-03〜06 教訓が未反映のため、あなたの早期タスクで一時ノート 4 本を retrospective-log へ転記し、その後 Claude Code が再蒸留します)
  code-facts.md:実コードの機械的事実(Props・queryKey・フロントルート・Go ルート↔ハンドラ・config・ナビ・DTO・model。想定で書かず必ず引く。投入直前に再生成した最新版)
  docs-map.md:文書ID ⇄ 実パス・docs 配下の役割マップ(あなたはファイル構成を直接見られないため、DES 等の文書ID で参照した資料の実パスをここで引く。投入直前に再生成した最新版)
  architecture-patterns.md:確立済みの実装アーキテクチャパターン(§9 custom_states 消費非モデル化 / recipe_cache §7・§10 LAN・§1.1 queryKey・§2.1 サービス層 IF。起き攻め正規化・recipe_cache 波及の判断材料)
  change-number-registry.md:CHANGE 通知書の採番状態(次番号の確認用、次回 060 から。欠番 008 / 009 / 014)

C. フェーズ3 / M16 引き継ぎ(本セッション固有・差分情報)
  m15-to-m16-handover.md:主引き継ぎ書(§0 あり。§0 まず読む・§1 M15 完了・§2 設計判断・§3 M16 申し送り・§4 M15-07 処遇・§5 現行版/採番/環境・§6 未反映残タスク・§7 最初の一手・§8 M15 教訓ダイジェスト)
  phase3-overview.md:フェーズ3 マイルストーン分割の正本(v1.1.2 承認済み、M13〜M23。§M16 と §2.4 承認ゲート G-a〜G-k が M16 スコープの正本)
  followup-backlog.md:フェーズ3 繰越・生きた計画資料(§A friend FB 17 件 = FB⑥⑨⑪⑬ = 旧 M15-07 rollout の源 / §C M14 論点 = C-1 配布完了定義 / §D M13 統合可否 / §E リファクタ / §F 配布・運用)

D. 進捗・配分
  progress-summary.md:製造工程の進捗要約(M0〜M15。§14 = M14 期間・§15 = M15 期間・持ち越し = M16 着手時点)。詳細が要るなら progress-log.md を別途渡します
  model-allocation.md:モデル配分リファレンス(v1.28.0。M16 サブは着手時追記。M16 はスキーマ変更 = Opus 4.8 + Plan Mode 基本)

E. プロジェクト指針
  CLAUDE.md:製造担当 Claude Code 向けのプロジェクト指針。設計担当も概要把握のため一読してください(§10.X ブラウザストレージ許容表を含む)

M16 データモデル spec 用(開発者手交)
  friend-feedback-datamodel-issues(データモデル論点 spec):M16 ①〜④ の一次詳細 spec(①ゲージ属性 / ②ドライブ小数 / ③起き攻め正規化 / ④ステップ taxonomy)。phase3-overview §M16 が正本ですが各論点の背景・上位プレイヤー需要の根拠は本 spec 側にあります。リポジトリに無いため、必要になったらファイル名を挙げて請求してください(届かない場合は phase3-overview §M16 を正として進め、詳細確定時に請求)。punish-finder / creator-benefits 等の他 spec draft も同様に固まり次第手交します。

なお、指示書・レビューチェックリストのテンプレートが必要であれば、特に問題がなければ M15 で直近完成した指示書(M15-06 / M15-05)と対応するレビューチェックリストをテンプレート参照用に次のチャットで添付します。M16 は破壊的マイグレ・承認ゲートを含むため、スキーマ級の書式が要ればあわせて M14-01(schema-cleanup)/ M14-02(import-pipeline 段階削除)+ レビューチェックリストを添付します(M16 の指示書はまだ未作成のため、直近完成版を例示します)。

あなたへの依頼事項(playbook §1 の設計担当の責任範囲)と作業順序:

早期(M15 wrap-up の片付け・handover §6/§7-5):
0. M15-overview を M15 完了状態へ更新する(handover §6-1・未反映)= §3 サブ表(M15-06=⑯・M15-05 完了)・§4.2(⑰→M15-05・M15-07→M16 rollout)・§4.6・§5・確認事項5。更新タイミングは私が一任します。
0'. M15 教訓を retrospective-log へ転記する(handover §6-2・未反映)= 一時ノート 4 本(m15-03-retrospective-notes-TMP / m15-04-design-notes-TMP / m15-05-design-notes-TMP / handover §8 の M15-06 教訓)。log は私が手交します。転記後、私(開発者)が Claude Code で /retrospective-digest-update を実行して digest を再蒸留します(digest はあなたにとって読み取り専用)。

本体(M16 着手準備):
1. phase3-overview v1.1.2 §2.4(承認ゲート G-a〜G-k)・§M16 を必読し、④ ステップ taxonomy 明文化 + 移動の system move 登録(FB⑦連動)/ ④' target_combo 区分正典化 / ④'' dash 二重表現一本化 / ① 始動 vs 消費の区別(ドライブ/SA ゲージ)/ ② ドライブ小数化 / ③ 起き攻め正規化 の論点を棚卸しする(記憶で進めない。DES-003 / DES-004 §2.1 / SUPP-001 §3.3.3 と実コード・code-facts で裏取り)。
2. M14-03b seed 状況を確認する(全キャラ move_code 充足 = 段階1・taxonomy の前提。現行 HEAD は ryu 中心・M14-03b は M16 後/M17 前に投入予定・配布 blocker)。
3. dash 一本化(④'')・target_combo 区分正典化(④')の移行計画を、既存データ影響(FR301 dup・レシピ同一性・recipe_cache 波及)とセットで設計し、§6 承認ゲートに載せる。各ゲートは個別に私の承認を求める。破壊的マイグレは M13 export = 安全網で安全だが、意味単位・後方互換の順序で搬送する(M14 スキーマ整理と衝突させない。次マイグレは 000019 以降)。
4. ① 始動 vs 消費(ドライブ/SA ゲージ)のデータ面を確定 → その後、旧 M15-07 を「M16 表記 rollout」として M16 の末尾(データ確定後)に配置する(FB⑥ = ④ taxonomy 後 / FB⑨⑪⑬ = ① 後。順序を逆にすると誤ラベル)。
5. M16-overview を作成する(M14/M15-overview 書式。サブ分割・承認ゲート順・全 FB 項目の処遇・CHANGE 見込みの正本)。旧 M15-07 を末尾サブに置くこと。【重要】§3「依存」列 + §5「依存関係・進行順序」で、各サブが「worktree 並列可(相互独立)」か「直列必須(先行サブのデータ/スキーマ確定に依存)」かを明示してください。私は最近 git worktree による並列実行(2〜3 並列想定)を運用しており、この注記でレーン割付を判断します。ただし M16 は承認ゲート・スキーマ移行・ドメイン判断の連鎖が多く直列寄りです。独立に切り出せるサブ(例: 波及が閉じた ② drive 小数化)があれば明示的に「並列可」とマークし、承認ゲート連鎖は「直列必須」と明記してください(既存の M15-overview §5「相互独立・並行可」/ M14-overview §5 の逆依存注記が書式の手本。並列化は指示書完成度が高く独立性の高いタスク群に限定)。
6. 各サブの使用モデルを難易度から決め model-allocation.md(v1.28.0)に追記する。M16 はスキーマ変更 = Opus 4.8 + Plan Mode 基本(M15 の Sonnet 中心とは異なる。model-allocation の M12 注「UX・正しさ・データモデルは Opus」)。CLAUDE.md・settings.json は整備済み。改訂が要れば改訂支援を行う。

製造工程の現在地:
- M0〜M7(フェーズ1)・M8〜M12(フェーズ2)は実装完了・E2E 動作確認済み・開発者承認済み(M12 = 2026-06-26 先行リリース実施点)。
- M13 完了(2026-06-28)。M14 コード完了(2026-07-01、CHANGE-053〜055)。M15 完了(2026-07-04)= M15-01 test-id 規約 / M15-02 info-mark + 「比較対象選択」改称(056)/ M15-03 入力ボタン化 + コマンド解決 段階1 + dash 近手当て(057・DES-004 v1.7.0)/ M15-04 タグ色ピッカー / M15-05 表示整理 + 比較 生 ID バグ(058)/ M15-06 オンボーディング⑯(059・onboarding-seen-v1)。次回 CHANGE 採番は 060。マイグレは 000018 まで。
- M14-03b(全キャラ seed)は保留(M16 後・M17 前に実施予定。M16 の前提の一つ = 全キャラ move_code 充足。配布リリースの blocker。実施時は clean マイグレ由来 DB から作る = dev DB 残渣不可)。
- 確定事項(再協議不要、m15-to-m16-handover §1/§2): dash canonical = system move(modifier.type dash 廃止 + 移行は M16 ④'' / parry_drive_rush は modifier.type のまま正)/ コマンド解決 段階1 は実装済・非スキーマ(段階2 は M17)/ M15 の非スキーマ規律の載せ先(modifiers.flags / 残置プルダウン / tags.color / localStorage)/ M14-03b は M16 前提・M16 後実施 / 検証は make e2e(seed 非依存 self-contained へ M15 改善)。

ドキュメント体系について:恒久情報(反省 = retrospective-digest、機械的事実 = code-facts、文書ID ⇄ 実パス = docs-map、アーキテクチャパターン、CHANGE 番号運用)は B グループの専用ファイルに分離済みです。過去の引き継ぎ資料・設計変更通知書はアーカイブ済みで、要るときに提示します。retrospective-log 本体は起動時には投入していません(起動時の必読は retrospective-digest)。ただし retrospective-log の更新責任はあなた(設計担当)にあります — マイルストーン完了時に当該期間のミス・教訓を追記してください。※M15-03〜06 期間の教訓は一時ノート 4 本(TMP)に留まり未転記のため、本セッションの早期タスクとして転記をお願いします(上記 0')。M14 期間の教訓は retrospective-log に記録済みです。

【開発者への質問は文末集約】設計・指示書作成の過程で私(開発者)への質問・確認事項が生じた場合は、本文や各節の途中に散らさず、その成果物(overview / 指示書 / レビューチェックリスト / CHANGE 通知書 / 設計判断メモ等)の末尾に「開発者への確認事項」セクションとしてまとめて記載してください(M12〜M15 で定着)。各項目は番号付きで「何を確認したいか・なぜ確認が必要か・あなたの暫定案」を添えてください。対話の途中で即答が要る質問はその場で聞いて構いません。

【添付ファイルの受領確認】本プロンプトに続けて A〜E + M16 データモデル spec 用の複数ファイルを添付します。添付は一度に全ては届かない、または届いていても即座に認識されないことがあります。次の手順で進めてください。
(1) まず上記 A 群〜E 群 + spec 用に列挙した必須ファイル(計 21 件。うち #21 friend-feedback-datamodel-issues はリポジトリ未コミットで私が別途手交します)のファイル名を「受領マニフェスト」とみなし、現時点で認識できているファイルを受領済みリストとして列挙してください。受領できたものは読み込み・内容理解を始めて構いません。
(2) マニフェストにあるのに見当たらないファイルは、すぐ「届いていない」と断定せず、一度添付の再走査・再確認をしてください。それでも見当たらない場合に限り、該当ファイル名を具体的に挙げて不足を報告し、再送を求めてください(「いくつか届いていません」のような曖昧な報告は避け、必ずファイル名単位で挙げる)。
(3) 必須ファイルが揃うまでは、CHANGE 通知書・指示書・M16-overview・承認ゲート設計などの成果物生成を始めないでください。不足したまま想定で進めない(これは本プロジェクトが最も警戒する「実態を確認せず想定で進める」アンチパターンです)。この段階では読み込み・内容理解・受領確認までに留めてください。任意ファイル(各論点の詳細 spec draft 等)は未着でも着手して構いません(必要時に追って投入します)。なお #21 friend-feedback-datamodel-issues が未着の場合は、phase3-overview §M16 を正としてスコープ棚卸しまでは進められますが、各論点の詳細確定(承認ゲート設計)前にはファイル名を挙げて請求してください。
(4) 必須ファイルの受領がすべて確認できたら(#21 の手交状況も含めて)、その旨を一行で報告してから、まず M16 着手前の確認事項リストを提案してください。特に: 承認ゲート G-a〜G-k の棚卸しと着手順(④ taxonomy → ④'' dash 一本化・④' target_combo・① 始動/消費 のデータ確定 → 旧 M15-07 表記 rollout)/ 各サブの worktree 並列可否(0.5 = 依存注記)/ M14-03b(全キャラ seed = M16 前提)の位置づけ / M15 wrap-up(M15-overview 更新・M15 教訓の retrospective-log 転記)の着手 / ② drive 小数・③ 起き攻め正規化前倒しの是非(ドメイン確認)。プロジェクトに対する質問も受け付けます。
```

---

## 3. 補足(対話の進め方)

- 流れ: 最初のプロンプト + A〜E + spec 用ファイルを投入 → 設計担当の読み込み・確認事項提示 →
  **(0) M15 wrap-up(M15-overview 更新・M15 教訓の retrospective-log 転記)** →
  **(1) M16 着手前確認(承認ゲート棚卸し・着手順・worktree 並列可否・M14-03b 前提・正規化前倒しのドメイン確認)** →
  **(2) M16-overview → 承認ゲート設計(個別承認) → 各サブの指示書 + レビューチェックリスト → 末尾サブ = M16 表記 rollout(旧 M15-07)**、という流れ。
- **想定で書かない、必ず引く**: 既存データ構造・移行影響は code-facts 最新版 + 実コード + DES-003 / DES-004 §2.1 /
  SUPP-001 §3.3.3 で確認する(M10-4)。**DB 実査 ≠ 仕様正典**、正典は DES 本体(最新 CHANGE 反映後)で確認(M10-1)。
  **M16 各論点の詳細 spec(friend-feedback-datamodel-issues 等)はリポジトリに無い**ため、仕様確定の段では開発者へ現物を
  請求する(記憶・推測で埋めない)。届かない間は phase3-overview §M16 を正としてスコープ棚卸しまで。
- **🔒 承認ゲート(スキーマ変更)の扱い**: phase3-overview §2.4 の G-a〜G-k は **着手前に設計判断が要る**。①ゲージ属性
  (SA 消費列)/ ②ドライブ小数化(INTEGER→REAL)/ ③起き攻め正規化(`combo_oki_options` 前倒しの是非)/ ④ステップ
  taxonomy + 移動 system move 登録 / ④' target_combo 区分正典化 / ④'' dash 一本化。破壊的マイグレは M13 export = 安全網で
  安全だが、意味単位・後方互換 CSV の順序で搬送する(M14 スキーマ整理と衝突させない)。**各ゲートは個別に開発者承認**を得る。
  マイグレ接続は FK=OFF → 子行は明示 DELETE(digest §5・M12-5)、`dbtest.Setup` 波及・down 整合に注意。次マイグレは 000019 以降。
  列削除は FK 非参照なら `ALTER TABLE DROP COLUMN`(前例 000008/000013.down)で足りる見込み(phase3-overview §M14 注)。
- **CHANGE 二層運用**: 設計書本体(REQ-001 / DES-001〜006)改訂は CHANGE 通知書必須(次回 060)。補足資料(SUPP-001 /
  handover / playbook / registry / progress / architecture-patterns / phase3-overview / followup-backlog / model-allocation /
  retrospective-digest / docs-map)は自由改訂。**M16 は DES-003 / DES-004 / DES-005 / DES-006・REQ 候補に触れる見込み**
  (SA 消費列・taxonomy・drive 型・正規化・表示)ため CHANGE 起票が複数見込まれる。SUPP-001 §3.3.3(dash modifier.type 廃止)は
  補足資料のため自由改訂だが、DES-003/004 との整合を保つ。
- **指示書執筆前に retrospective-digest を必読**。⚠ ただし **M15-03〜06 教訓は未反映**(本セッションで retrospective-log へ
  転記 → Claude Code が再蒸留)。M15 教訓は M16 の設計判断に直結(handover §8): **経路/入口の全数監査**(同一概念に複数入口 =
  dash 2 経路・比較の名称解決。**正典化の前に grep で全経路列挙** = M16 の taxonomy/一本化そのもの)/ **供給側(BE)の補完
  一貫性まで真因を追う** / **確立原則の DES 横断監査**(dash は DES-004 に原則があったのに SUPP-001 が違反)/ **実機確認 ≠
  コードレビュー**(UX/導線は実機確認要)/ **非スキーマ境界を data milestone へ routing**(M16 が宿題を回収)。
- **成果物 commit は開発者の別作業**: 提示済み ≠ リポジトリにある(M13-5・digest §2)。引継ぎ・完了時に commit 状態を
  確認事項に挙げる。worktree 内での git 操作・スクリプト実行は開発者が行う(Claude Code は worktree 内で「作業」のみ)。
- **マイルストーン構造の拡張・新規 overview の増設は独断せず開発者と合意する**(M9-5 / playbook §4.12)。M16-overview の
  サブ分割・承認ゲート順・並列注記の結果は確認事項に出して開発者承認を得る。
- 「任意」ファイル(各論点 spec draft、過去指示書テンプレ〔M15-06 / M15-05 / スキーマ級 M14-01 / M14-02〕、
  M14-03 指示書、M15-overview、testid-convention、retrospective-log、過去 CHANGE 通知書 056〜059、progress-log、
  worktree 運用メモ、アーカイブ handover)は要望時 / 次チャットで渡す。

---

## 4. 前提事実メモ(キット作成時点 = 2026-07-04)

- **CHANGE 採番**: 059 まで使用済み、**次回 060**。欠番 008 / 009 / 014(再利用不可)。直近 = CHANGE-056(M15-02 info-mark・
  「比較対象選択」改称、DES-005 v2.31.0)/ 057(M15-03 dash 近手当て・コマンド解決、DES-004 v1.7.0 / DES-005 v2.32.0)/
  058(M15-05 表示整理、DES-005 v2.33.0)/ 059(M15-06 オンボーディング、DES-005 v2.34.0 + CLAUDE.md §10.X onboarding-seen-v1)。
- **設計書本体現行版**(M15 反映後): REQ-001 v2.16.0 / DES-001 v1.4.0 / DES-002 v1.28.0 / DES-003 v1.23.0 /
  **DES-004 v1.7.0** / **DES-005 v2.34.0** / DES-006 v1.14.0 / SUPP-001 v1.25.0。**マイグレーション 000018 まで**
  (M16 は 000019 以降)。
- **補足資料現行版**: design-instruction-playbook v1.12.0(§4.11 / §4.12 / §16)/ change-number-registry v1.47.0(次回 060)/
  progress-summary(**M0〜M15**・§14 M14 期間・§15 M15 期間・持ち越し = M16 着手時点)/ model-allocation v1.28.0(**M16 サブは
  着手時追記**・スキーマ = Opus 基本)/ phase3-overview v1.1.2(承認済み・**§M16 と §2.4 が M16 スコープ正本**)/ followup-backlog
  (フェーズ3 生きた計画資料・§A friend FB 17 件)/ retrospective-log・architecture-patterns は各ファイル冒頭で現行版を確認 /
  code-facts(2026-07-04 / commit `094f741`)・docs-map(同)。
- **⚠ 派生ドキュメントの鮮度(本キット生成時)**:
  - **実施**: code-facts / docs-map を再生成(2026-07-04 / `094f741`)。progress-summary を **M0〜M15 へキャッチアップ要約**
    (M14・M15 節を追加)。
  - **保留(前提未達)**: retrospective-digest 再蒸留は **M15-03〜06 教訓が retrospective-log に未転記**(一時ノート 4 本が
    開発者手交待ち・handover §6-2)のため未実施 → 本セッションで TMP を retrospective-log へ転記 → `/retrospective-digest-update`。
    M14 教訓は既に retrospective-log 記録済み。
- **M16 引き継ぎ資料**: m15-to-m16-handover(主・**§0 あり**)/ phase3-overview v1.1.2(承認済み・M13〜M23・§M16 が正本)/
  followup-backlog(§A friend FB = 旧 M15-07 rollout の源)/ friend-feedback-datamodel-issues(M16 一次 spec・開発者手交・repo 外)。
- **M16 スコープ**(phase3-overview §M16): データモデル拡充・スキーマの継ぎ目 = datamodel-issues ①〜④ + ④'/④''。
  ①ゲージ属性(SA 消費列・始動値とは別・FR303 自動キャッシュ復活せず)/ ②ドライブ小数(`combos.drive_available_at_start`
  INTEGER→REAL)/ ③起き攻め(打撃重ね追加 + `combo_oki_options` 正規化前倒しの是非・6 bool 消費箇所の改修波及)/
  ④ステップ taxonomy(moves 行/非技ステップ/modifier 振り分け原則 + 移動 system move 登録・FR301 dup 波及)/
  ④' target_combo 区分正典化(多段特殊技の信頼分類)/ ④'' dash 一本化(modifier.type dash 廃止 → system move 移行)。
  **SF6 ドメイン判断を含み開発者確認必須**。Opus 4.8 + Plan Mode。
- **M16 への持ち越し課題**(handover §6):
  - **§6-1 M15-overview の更新(未反映)**: §3 サブ表・§4.2(⑰→M15-05・M15-07→M16 rollout)・§4.6・§5・確認事項5 を M15
    完了状態へ。開発者が更新タイミング一任。**本セッション早期タスク**。
  - **§6-2 retrospective-log 転記(未反映)**: 一時ノート 4 本(m15-03/04/05-notes-TMP + handover §8 M15-06 教訓)→ 転記後に
    Claude Code が digest 再蒸留。**log 手交待ち**。**本セッション早期タスク**。
  - **§6-3 followup 追記**: PC/タブレット能動的初回案内の構造的残課題(CHANGE-059 §7-2)。
  - **§6-4 他マイルストーン前提**: **M14-03b(全キャラ seed)= M16 前提・M16 後/M17 前実施・配布 blocker** / NFR406 移設
    (フェーズ4→3 移設済み。REQ-001 §7 表記是正を M18 着手前に CHANGE-060 系で処理)。
  - **旧 M15-07 = M16 表記 rollout**: FB⑥⑨⑪⑬ の表記追従を M16 末尾(④ taxonomy・① 始動/消費 のデータ確定後)で実施(0.3)。
  - **E2E・テストインフラ**: `make e2e` は M15 で seed 非依存 self-contained 化済み(永続 dev DB 残渣非依存)。M16 の
    破壊的マイグレ後は clean DB で全 E2E を一度走らせる(配布前ゲート・M14-03b と併せて)。

---

## 5. M15 プロンプトからの主な改訂点(キット作成 = 2026-07-04)

`m15-startup-kit`(M15 = 入力・使いやすさ向上 + マイルストーン再編を担った連番キット)を構造ベースに作成。M15 完了 →
M16(データモデル拡充・スキーマの継ぎ目)起点へ全面書き換え。**M15 の 2 タスク構成(着手準備 + 再編)から単一タスク
(M16 着手準備 + M15 wrap-up 片付け)へ簡素化**(再編は phase3-overview v1.1.2 で完了済み)。

| 反映 | 内容 |
|------|------|
| M16 起点化 | §0 時系列を M15 完了 → **M16(データモデル拡充・スキーマの継ぎ目)起点**へ書き換え。**フェーズ自体はフェーズ3 のまま**を冒頭・§0 に明記。**M15 = 非スキーマ/UX から M16 = スキーマ変更・承認ゲート・SF6 ドメイン判断へ性格が変わる**旨を明示 |
| **単一タスク化(再編削除)** | M15 の **(II) マイルストーン再編タスクを削除**(phase3-overview v1.1.2 で完了済み)。M16 = **(I) M16 着手準備のみ**。ただし冒頭に **M15 wrap-up 片付け**(M15-overview 更新・M15 教訓の retrospective-log 転記)を早期タスクとして保持(handover §7-5)。replan-input(#21)を廃し M16 一次 spec の friend-feedback-datamodel-issues を #21 開発者手交枠へ差し替え |
| 主 handover / 読む順序 | C グループ主 handover を `m15-to-m16-handover.md` に設定。**同書は §0 を持つ**ため「読む順序」を **§0 まず読む → §1 M15 完了 → §3 M16 申し送り → §4 M15-07 処遇 → §7 最初の一手 主軸 + §2/§5/§6/§8 前提**へ(m15 の §0 なし対応から §0 起点へ復帰) |
| M16 スコープの正本明示 | **phase3-overview v1.1.2 §M16 / §2.4(承認ゲート G-a〜G-k)を M16 スコープの正本**として §0/§1/§2/§4 に明記。⚠ **supp-001 §4.1 は M0〜M7 のみで M16 非記述**を注記(誤参照防止)。datamodel-issues ①〜④・④'・④'' と承認ゲートを論点列挙 |
| **M15-07 → M16 表記 rollout** | 旧 M15-07(FB⑥⑨⑪⑬ 表記追従)を **M16 の末尾サブ「M16 表記 rollout」として、④ taxonomy / ① 始動 vs 消費 のデータ確定後に配置**するよう §0.3 / §2 依頼事項 4・5 / §4 持ち越しに明記(順序を逆にすると誤ラベル。M17 でなく M16 担当。handover §4)|
| **worktree 並列可否の明示要請** | §0.5 / §2 依頼事項 5 / §3 補足に、**M16-overview の §3「依存」列 + §5「依存関係・進行順序」で各サブの worktree 並列可(相互独立)/ 直列必須(スキーマ/データ依存)を明示**し、開発者が worktree レーン(2〜3 並列想定)を判断できるようにする旨を追加。**M16 は承認ゲート・ドメイン判断比重が高く直列寄り**・並列化は独立性の高いタスク群に限定(retro-002-M1 R-04)の制約を併記。既存の M15-overview §5 / M14-overview §5 注記慣行を手本に指定 |
| CHANGE 起票・設計書改訂事実 | M15 期間に CHANGE-056〜059 起票・反映、**DES-004 v1.7.0 / DES-005 v2.34.0**、次回 **060**。マイグレ **000018**(M16 は 000019 以降)。M16 主参照を DES-003 / DES-004 §2.1 / SUPP-001 §3.3.3 / phase3-overview §M16 / followup-backlog §A へ |
| M14-03b 保留の継承 | 配布 seed(M14-03b)は **M16 後/M17 前に実施予定**(全キャラ seed = M16 前提・配布 blocker)を §0.4・§2・§4 持ち越しに明記。M16-overview で M16 前提として位置づけるよう指示 |
| ロール指定 | §2 冒頭を **データモデル/スキーマ設計/破壊的マイグレ安全性・後方互換 CSV 契約/正規化/SF6 ドメイン分類設計**に精通したシニアエンジニアへ調整(M15 の UX/入力改善から M16 のスキーマ/データモデル比重へ。破壊的マイグレ・後方互換観点を caveat でなく中核へ)|
| 直近指示書(任意投入) | M16 の指示書は未作成のため、テンプレ参照は直近完成版の M15-06 / M15-05 + レビューチェックリストを任意投入に設定。**M16 は破壊的マイグレ・承認ゲートを含むためスキーマ級の M14-01 / M14-02 も併せて例示**(§1 任意表 + §2 本文の 2 箇所に明示)|
| retrospective-digest / retrospective-log の鮮度注記 | **M15-03〜06 教訓が retrospective-log に未転記**(handover §6-2 = 一時ノート 4 本が開発者手交待ち)のため digest 再蒸留を **保留**。本セッションの早期タスクとして TMP を retrospective-log へ転記 → Claude Code が `/retrospective-digest-update` で再蒸留、を §0.2-0'・#10 注記・§2・§4 に明記。**M14 教訓は記録済み**を明記。投入直前に code-facts(2026-07-04 / `094f741`)+ docs-map(同)は再生成済み |
| progress-summary 対象範囲 | **M0〜M13 → M0〜M15 へキャッチアップ**(M14・M15 節を追加要約)。§14 = M14 期間・§15 = M15 期間・持ち越し = M16 着手時点 |
| 受領確認ブロック | M16 の必須件数(21 件)・着手前確認項目(承認ゲート棚卸しと着手順・worktree 並列可否・M14-03b 前提・M15 wrap-up・正規化前倒しのドメイン確認)を実値で更新。#21 friend-feedback-datamodel-issues が未着なら phase3-overview §M16 を正にスコープ棚卸しまで進める旨を追記。質問の文末集約は M12〜M15 で定着のため定常運用として記載 |
| ドキュメント体系について段落 | 恒久情報は B グループ専用ファイルに分離済み・過去資料はアーカイブ済みで要時提示、retrospective-log 更新責任は設計担当・digest 更新は Claude Code、の定常文を維持(**M15-03〜06 教訓は未転記のため早期転記を要請**・**M14 教訓は記録済み**へ更新)|

---

## 6. 改訂履歴

| 日付 | 内容 |
|------|------|
| 2026-07-04 | M15(入力・使いやすさ向上 = friend FB 第一波)完了 → M16 着手に伴い、連番キット `m16-startup-kit.md` を `m15-startup-kit.md` から構造流用作成(`/next_milestone_kit M16`。追加指示 = 旧 M15-07 の M16 移管の取り込み + git worktree 並列可否を設計担当がプロンプトで明示する要請)。CHANGE-056〜059 反映・**DES-004 v1.7.0 / DES-005 v2.34.0**、次回採番 060、マイグレ 000018。主 handover = `m15-to-m16-handover.md`(**§0 を持つ**ため「読む順序」を §0 まず読む → §1 M15 完了 → §3 M16 申し送り → §4 M15-07 処遇 → §7 最初の一手 主軸 + §2/§5/§6/§8 前提に適応 = m15 の §0 なし対応から §0 起点へ復帰)。§0 作業順序を M16(データモデル拡充・スキーマの継ぎ目)起点へ書き換え、ロール指定をデータモデル/スキーマ設計/破壊的マイグレ/SF6 ドメイン分類設計中心へ調整。**M15 の 2 タスク構成(着手準備 + 再編)から単一タスク(M16 着手準備 + M15 wrap-up 片付け)へ簡素化**(再編は phase3-overview v1.1.2 で完了済みのため削除)。**M16 スコープの正本を phase3-overview v1.1.2 §M16 / §2.4 承認ゲート G-a〜G-k に設定**(supp-001 §4.1 は M0〜M7 のみ = M16 非記述を注記)。**【追加指示①】旧 M15-07(FB⑥⑨⑪⑬ 表記追従)を M16 末尾「M16 表記 rollout」として ④ taxonomy / ① 始動消費 のデータ確定後に配置**するよう §0.3 / §2 / §4 に明記(handover §4)。**【追加指示②】M16-overview の §3 依存列 + §5 依存関係・進行順序で各サブの worktree 並列可否を明示**する要請を §0.5 / §2 / §3 に追加(2〜3 並列想定・M16 は直列寄り・retro R-04 制約併記)。必須 #21 を replan-input → friend-feedback-datamodel-issues(開発者手交)へ差し替え。C グループを M16 文脈へ整理(phase3-overview は「再編対象」→「M16 正本」へ)。**M14-03b(全キャラ seed)は M16 後/M17 前に実施予定**(M16 前提・配布 blocker)を明記。**retrospective-digest 再蒸留は前提未達(M15-03〜06 教訓が TMP 手交待ち・未転記)のため保留**し理由と再開条件を明記(M14 教訓は記録済み)。**progress-summary を M0〜M13 → M0〜M15 へキャッチアップ要約**。投入直前に code-facts(2026-07-04 / commit `094f741`)+ docs-map(同)再生成 |
