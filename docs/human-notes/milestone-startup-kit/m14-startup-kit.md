# M14(公式データ配布是正・スキーマ整理・DB 同梱)起動キット

> 本ファイルは **フェーズ3 設計担当(Claude Web 版「設計・指示書作成担当」)チャット**を
> 立ち上げるためのプロンプト本文 + 投入ファイル一覧。流用方法は同フォルダの `README.md` を参照。
>
> **本キットは標準の連番マイルストーンキット(`m4`〜`m12-startup-kit.md`)の系譜です。**
> 直前の連番キットは `m12-startup-kit.md`(フェーズ2 最終)で、**M13(データ共有・データ保護 = コンボ
> export/import)はフェーズ3 キックオフキットで起動したため連番キットを持ちません**。本キットは M13 完了
> (M13-01/02・RESEARCH-01/02、CHANGE-050〜052、2026-06-28)を引き継ぎ、**フェーズ3 から連番マイルストーン
> キット運用を再開**して **M14 公式データ配布是正・スキーマ整理・DB 同梱**を起こします。
>
> **一次資料は引き継ぎ書 `m13-to-m14-handover.md` です。** 同書は §0 を持たないため、
> **§4 M14-RESEARCH-01 評価 → §5 M14 サブ構成骨子 → §7 着手の最初の一手** を主軸に、
> **§1 M13 完了状態・§2 設計判断・§3 申し送り(3-a〜3-d)** を前提として読みます(docs-map.md で文書ID→実パスを引きながら)。
>
> **本セッションは 2 つの設計タスクを担います**(下記 §0.2): **(I) M14 着手準備**(M14-overview 確定 + M14-01/02/03 + DES-001 CHANGE)/
> **(II) フェーズ3 組み替え**(開発者依頼 `combmgr-phase3-reorg-request.md` の 5 機能群を `phase3-overview.md` に取り込む)。
>
> **本キットは複数ファイル添付時の受領確認ブロック(M10 から継続)を含みます**(下記 §2 末尾)。各成果物末尾への
> 「開発者への確認事項」集約は M12/M13 で定着済み(phase3-overview も同形式)。引き続き踏襲します。

---

## 0. 本キットの位置づけ / 新セッションの作業順序(必読)

### 0.1 時系列

フェーズ1(M0〜M7)完了 → 整理工程(CHANGE-020 / 021)→ フェーズ2(M8 moves スキーマ → M9 取込パイプライン →
M10 複数キャラ登録 UI → M11 custom_states 開始時状態 → **M12 先行リリース仕上げ**)完了(2026-06-26 = 先行リリース実施点)→
**フェーズ3 キックオフ**(phase2-to-phase3-handover・phase3-overview ドラフト作成)→ **M13(データ共有・データ保護 =
コンボ export/import)完了**(コンボ/セットプレイ CSV 往復 + PDF/PNG/クリップボード出力。先行成果物を契約準拠で統合。
CHANGE-050〜052、2026-06-28)→ コンテキスト移行 → **本キット = M14 の設計セッション**。

M13 で友人の蓄積データを退避できる **export = データ安全網**が稼働した。これを前提に、M14 は **OSS 配布の健全化**に踏み込む:
配布禁止の公式フレームデータ HTML に依存しない配布形態へ是正する(**手入力データの DB 同梱・取込画面廃止・取込前提
スキーマの整理・FR704 のユーザー機能としての降格**)。本プロジェクトで最重量クラスタ(破壊的マイグレ + 取込削除の
共有シンボル移設 + 全キャラ seed + 複数 CHANGE)であり、各実装は **Opus 4.8 + Plan Mode 必須**の見込み。

### 0.2 新セッションの作業順序(`m13-to-m14-handover.md` §4 起点 + 組み替えタスク)

> M13 は完了済み。**本セッションは M14 の準備とフェーズ3 の組み替えから始める。** M14-RESEARCH-01 は
> 実施済み(report 評価は handover §4)なので、新規に走らせるのではなく **評価結果を使って M14-overview を確定**する。

**(I) M14 着手準備:**

1. handover §4(M14-RESEARCH-01 評価)+ `docs/progress/M14-RESEARCH-01-report.md` 本体を実査(記憶で進めない)。
   核心は **§4-1 削除安全性**(取込パイプラインと技編集が共有するシンボル `IsKnownProperty` / `WarningCode` /
   `StoredMove` / `DeriveStoredWarnings` の参照経路を **code-facts 最新版 + 実コード**で再確認)。
2. **M14-overview を作成**(M12/M13-overview 書式。サブ分割・全論点処遇・CHANGE 見込みの正本)。骨子(handover §5):
   - **M14-01 スキーマ整理**(raw_data 取込専用 5 サブキーの JSON 整理。列削除は極小)。DES-003 §3.3。
   - **M14-02 取込パイプライン段階削除**(共有シンボル移設 → movesimport 削除・画面17 除去・**技編集〔画面18〕は温存**)。
     一括物理削除は共有経路見落としで技編集破壊のリスク(症状≠真因)があり **段階削除**(①UI 除去 → ②取込専用の全数確定 →
     ③取込専用のみ削除)。REQ-001 FR704 降格・DES-002 §4.2/§7.5・DES-005 §5.17。**Opus 4.8 + Plan Mode 必須**。
   - **M14-03 配布 DB 同梱**(全 SF6 キャラの手入力 seed 投入インフラ + seed。手入力ツール =
     `autopilot-combomgr/projects/moves-input-tool`、出力 CSV が現行契約と一致するかは handover §4-4 で照合済み)。
   - **M14-CHANGE(DES-001)**: §2.1/§4.1 を案C/Go へ同期 + §5 ライセンス確定(MIT)+ LICENSE 追加 / README 更新(handover §3-a)。
3. **破壊的マイグレ着手前の実査**: `FK=OFF × 明示 DELETE を同一指示書に同居させない`(digest §5・M12-5)、`dbtest.Setup`
   波及(digest §5)、次マイグレ = **000018**(handover §4-5)。M13 export が意味単位で頑健化済み(digest §5・M13-6)。

**(II) フェーズ3 組み替え(開発者依頼 `combmgr-phase3-reorg-request.md`):**

4. reorg-request の **5 機能群**(①確定反撃記録 ②セットプレイ自動提案 ③import/export 強化 ④既存フォーマット取込ヘルパー
   ⑤メディア参照)を `phase3-overview.md`(現 v0.3.0 ドラフト)に **組み替えで取り込む**。設計判断は reorg §5 が委任:
   - **マイルストーン番号の振り直し・実装順・大MS 分割**(M14 = 配布是正は確定・不動。新機能は M15 以降へ番号付け)。
   - **REQ §7 との矛盾解消**: ①確定反撃(NFR406)は現状 **REQ §7 / phase3-overview §2 でフェーズ4(含まない)**。
     フェーズ3 へ移す是非を判断し、移すなら **REQ-001 CHANGE** を起票(reorg §5 = 開発者は承認、起票は設計担当)。
   - **重複排除**: reorg §2 の「既にフェーズ3 に取り込み済みの可能性がある群」(データモデル拡充系 = M16 SA 消費系 /
     UX 第一波 = M15 / 配布是正 = M14)を現行 phase3-overview と突合し二重計上を避ける。
   - **メディア参照(⑤)**: 既存 CSV 列契約(M13 で確定)の**後方互換改訂**として設計(reorg §1-5 = 意味単位・破壊しない)。
   - **既存フォーマット取込(④)**: 二段の役割分担(①表記正規化=アプリ外プロンプト / ②コード確定=move マスタ厳密照合・
     AI に技コード生成させない)を外さない(reorg §1-4)。
   - スコープ外(reorg §3): FTS5・差し返し・動画実体配布(参照のみ持つ)。
   - **spec draft / datamodel-issues は未確定で後送り**(reorg §6・固まり次第開発者手交)。届いた分から取り込む。
   - 組み替え後の phase3-overview(v0.4.0 想定)が確定すれば、M14 近傍以降の番号が安定する。**M14 着手準備(I)とは
     独立**に進められる(M14 自体の定義は組み替えで変わらない)。順序は設計担当判断。
5. 各サブユニットの使用モデル(Opus / Sonnet)を難易度から決め `model-allocation.md`(v1.23.0)に追記。実装系は Opus + Plan Mode 必須見込み。

### 0.3 確定事項の継承(`m13-to-m14-handover.md` §1/§2・`phase2-to-phase3-handover.md` §2、再協議不要)

- **M13 export は意味単位(character_code/move_code・DB 管理列除外・starter 非出力で import 再導出)で設計済み**。
  M14 の moves 列削除に頑健(M13-RESEARCH-01 §C-4 / digest §5・M13-6)。M14 の破壊的整理は安全網が先行した状態で着手できる。
- **取込パイプライン最終ゴール = 完全削除**(開発者方針 2026-06-28)。ただし技編集(画面18・温存)との共有経路巻き込みを
  避けるため **段階削除**。温存/削除の境界は M14-RESEARCH-01 で全数確定済み。
- **配布データは開発者手入力・DB 同梱**。HTML 由来 CSV は**検証用に限定**(dev/test のみ・配布物から除外)。FR704 は
  ユーザー機能としての位置づけを見直す(REQ-001 CHANGE)。
- **custom_states 消費は非モデル化据え置き**(arch-patterns §9.1)。SA ゲージ消費のみ M16 で限定的に例外対応(要ドメイン確認)。
- **move_code は現代形が正典**(B-7 で旧形一掃済み、DES-004 §2.1)。**PATCH メタデータのクリアは presence-detection 単一
  トライステート**(CHANGE-043)。これらは M14 で再設計しない。
- **前提事実の訂正(handover §4-6)**: `dhalsim`(`dalsim` ではない)/ aki・jamie・guile は 000017 で完全 DELETE /
  raw_data の notes のみ parse。M14-RESEARCH-01 指示書 §3.2 の誤りは report が是正済み。

---

## 1. 投入ファイル一覧(開発者用・パス付き)

Web チャットへアップロードするファイル。**必須**は初回投入、**任意**は対話の中で要望が出たとき・
必要になったときに渡す。

> **投入直前の鮮度更新(必須)**: `code-facts.md` は `/regen_code_facts`、`docs-map.md` は `/regen_docs_map`、
> `retrospective-digest.md` は `/retrospective-digest-update` で **投入直前に再生成し、現行コード / 構成 / 最新
> 教訓と一致させた版を貼る**こと。最終的な正は常に実コード / 実ファイルで、これらは静的抽出ゆえの限界(各書冒頭の
> 「本資料の限界」節)がある。

### 必須(初回投入・計 24 件)

**A. 設計書本体(プロジェクト恒久・真の情報源)**

| # | ファイル名 | リポジトリ上のパス | 種別 |
|---|-----------|------------------|------|
| 1 | requirements.md | `docs/design/requirements.md` | REQ-001 v2.15.0(§7 = 4 フェーズ定義。**M14 で FR704 降格の CHANGE 見込み**) |
| 2 | 01-tech-stack.md | `docs/design/01-tech-stack.md` | DES-001 v1.3.0(**M14 で §2.1/§4.1 旧スタック是正 + §5 ライセンス確定の CHANGE**・handover §3-a) |
| 3 | 02-architecture.md | `docs/design/02-architecture.md` | DES-002 v1.26.0(**M14 主参照**。§4.2 取込エンドポイント・§7.5 取込スコープ・§7.6 コンボ CSV 契約) |
| 4 | 03-data-model.md | `docs/design/03-data-model.md` | DES-003 v1.22.0(**M14 主参照**。moves 列 / raw_data §3.3 / 列・テーブル削除) |
| 5 | 04-notation-spec.md | `docs/design/04-notation-spec.md` | DES-004 v1.6.3(move_code 正典・§2.1) |
| 6 | 05-screen-design.md | `docs/design/05-screen-design.md` | DES-005 v2.28.0(画面17 取込削除 §5.17・画面18 技編集 温存・§5.13 出力レイアウト) |
| 7 | 06-validation.md | `docs/design/06-validation.md` | DES-006 v1.14.0(VAL-I10・取込検証) |
| 8 | supp-001-detailed-design.md | `docs/design/supp-001-detailed-design.md` | SUPP-001 v1.25.0(§4.1 はフェーズ3分割を phase3-overview 参照。§7 recipe_cache・§5.8) |

**B. 設計担当の恒久資料(運用ルール・反省・パターン・機械的事実)**

| # | ファイル名 | リポジトリ上のパス | 種別 |
|---|-----------|------------------|------|
| 9 | design-instruction-playbook.md | `docs/handover/design-instruction-playbook.md` | 運用ルール集(v1.11.0。最初に読む。§1 役割境界・§4.5〜§4.12 セルフチェック群・§16 CHANGE 手順) |
| 10 | retrospective-digest.md | `docs/handover/retrospective-digest.md` | **設計担当ミス蒸留版**(現役教訓のみ。指示書執筆前に必読。投入直前に `/retrospective-digest-update` で再蒸留)。**M13 教訓は retrospective-log §6.6.6 に記録済み・digest も再蒸留済み(M13-1〜M13-6 反映)** |
| 11 | code-facts.md | `docs/handover/code-facts.md` | **機械的事実の参照元**(Props・queryKey・フロントルート・Go ルート↔ハンドラ・config・ナビ・DTO・model。想定で書かず必ず引く。投入直前に `/regen_code_facts` で再生成)。**M14-02 削除安全性 = 共有シンボルの参照経路をここで実査** |
| 12 | docs-map.md | `docs/handover/docs-map.md` | **文書ID ⇄ 実パス・役割マップ**(設計担当はファイル構成を直接見られない。`DES-005` 等の実パス逆引き。投入直前に `/regen_docs_map` で再生成) |
| 13 | architecture-patterns.md | `docs/handover/architecture-patterns.md` | 確立アーキテクチャパターン(§9 custom_states 消費非モデル化 / recipe_cache §7・§10 LAN・§1.1 queryKey・§2.1 サービス層 IF) |
| 14 | change-number-registry.md | `docs/handover/change-number-registry.md` | CHANGE 番号運用(**次回採番 053**。欠番 008 / 009 / 014。現行 v1.40.0) |

**C. フェーズ3 / M14 引き継ぎ(本セッション固有・差分情報)**

| # | ファイル名 | リポジトリ上のパス | 種別 |
|---|-----------|------------------|------|
| 15 | m13-to-m14-handover.md | `docs/handover/phase3/m13-to-m14-handover.md` | **主引き継ぎ書**(§0 なし。§1 M13 完了・§2 設計判断・§3 申し送り 3-a〜3-d・**§4 M14-RESEARCH-01 評価**・**§5 M14 サブ構成骨子**・§6 環境メモ・§7 最初の一手) |
| 16 | phase3-overview.md | `docs/instructions/phase3-overview.md` | フェーズ3 マイルストーン分割の正本(**v0.3.0 ドラフト**、M13〜M20。**組み替えタスク(II)の対象**) |
| 17 | phase2-to-phase3-handover.md | `docs/handover/phase2-to-phase3-handover.md` | フェーズ移行(v1.0.0。§2 フェーズ3 が前提とする設計判断・§3 残作業 A〜H 群・§5 キックオフ) |
| 18 | followup-backlog.md | `docs/handover/followup-backlog.md` | **フェーズ3 繰越正本 §F12**(F12-1〜F12-8 = 生きた追跡台帳。F12-7 は M13 で解消) |
| 19 | M14-RESEARCH-01-report.md | `docs/progress/M14-RESEARCH-01-report.md` | **M14 起票の主要インプット**(取込前提の列/経路の全数洗い出し・削除安全性。handover §4 が評価。記憶でなく本体を実査) |
| 20 | M14-RESEARCH-01 指示書 | `docs/instructions/M14-RESEARCH-01-distribution-fix-schema-cleanup-survey.md` | RESEARCH-01 指示書(§3.2 前提事実の一部は report が是正済み = handover §4-6) |

**D. 進捗・配分**

| # | ファイル名 | リポジトリ上のパス | 種別 |
|---|-----------|------------------|------|
| 21 | progress-summary.md | `docs/progress/progress-summary.md` | 進捗要約 M0〜M13(v1.10.0。§13 = M13 期間・§14 = M14 着手時点の持ち越し課題) |
| 22 | model-allocation.md | `docs/human-notes/model-allocation.md` | モデル配分(v1.23.0。M13 実績記入済み。**M14 サブは着手時追記**、実装系 Opus + Plan Mode 必須見込み) |

**E. プロジェクト指針**

| # | ファイル名 | リポジトリ上のパス | 種別 |
|---|-----------|------------------|------|
| 23 | CLAUDE.md | `CLAUDE.md`(リポジトリルート) | 製造担当向け指針(設計担当も概要把握のため一読) |

**組み替えタスク用(開発者手交)**

| # | ファイル名 | リポジトリ上のパス | 種別 |
|---|-----------|------------------|------|
| 24 | combmgr-phase3-reorg-request.md | `tmp/combmgr-phase3-reorg-request.md`(**開発者が tmp/ から別途手交。リポジトリ未コミット**) | **フェーズ3 組み替え依頼**(発信者中心への舵切り。5 機能群を phase3-overview へ取り込む。番号振り直し・CHANGE は設計担当へ委任 = §5) |

> **retrospective-log.md は起動時に投入しない**(起動時の必読は #10 digest)。ただし **retrospective-log の
> 更新責任は設計担当(本 Web 版)にある**——マイルストーン完了時に当該期間のミス・教訓を本書へ追記する。
> **M13 期間の教訓(自己/前任の §3.2 前提 DES 引用の裏取り、成果物 commit ギャップ、CHANGE 二段/集約、意味単位 export
> の頑健性)は retrospective-log §6.6.6(2026-06-28)に記録済み**で、digest も再蒸留済み(M13-1〜M13-6 反映)。digest は
> 設計担当にとって読み取り専用、その更新は Claude Code が `/retrospective-digest-update` で行う。今後のマイルストーン
> 完了時の教訓追記は設計担当の責務として継続。更新・事例遡及が必要なときに開発者へ投入を要求する。

### 任意(対話の中で要望が出たとき・必要になったときに投入)

| ファイル名 | パス | 渡すタイミング |
|-----------|------|--------------|
| reorg 関連 spec(punish-finder-spec-draft / friend-feedback-datamodel-issues / creator-pivot-summary) | `tmp/`(**開発者手交・未確定・未コミット**) | 組み替えタスク(II)で確定反撃・データモデル拡充・戦略背景の詳細が要るとき。**reorg §6 = 固まり次第手交**(現時点では未配置の可能性が高い)。届いた分から取り込む |
| 過去の指示書テンプレート(M13-01 / M13-02 + 各レビューチェックリスト) | `docs/instructions/` ・ `docs/instructions/reviews/` | 指示書 / レビューチェックリストのテンプレート参照用(M14 の指示書は未作成のため、直近完成版の M13-01 / M13-02 を例示) |
| M13-overview.md / phase3-kickoff-startup-kit.md / phase2-overview.md | `docs/instructions/` ・ `docs/human-notes/` | M14-overview / 組み替え後 phase3-overview の書式・様式を参照するとき |
| testid-convention.md | `docs/design/testid-convention.md` | 統合 E2E で test-id を扱うとき(test-id 正本) |
| retrospective-log.md | `docs/handover/retrospective-log.md` | **設計担当が更新責任を持つ**。M14 完了時の教訓追記、または digest だけでは足りず過去ミスの事実関係・経緯を遡るとき(M13 教訓は §6.6.6 に記録済み) |
| CHANGE 通知書(050〜052 等 M13 期間分) | `docs/change-notes/` | M13 で確定したコンボ CSV / 出力レイアウトの契約・経緯を遡るとき |
| progress-log.md | `docs/progress/progress-log.md` | M1〜M13 の詳細(curl 出力・E2E 手順・実装メモ)が必要になったとき |
| アーカイブ handover(handover_1 / m1-to-m2 〜 m12-to-m13 等) | `docs/handover/` ・ `docs/handover/archive/` | 基本設計時点の前提や M1〜M13 期・整理工程の細部を遡るとき |

> M13 → M14 の変更点: 主 handover が `m13-to-m14-handover.md`(§0 を持たないため読む順序を §4 → §5 → §7 主軸 +
> §1〜§3 前提に適応)。**フェーズ3 文脈に伴い C グループを刷新**(phase3-overview〔組み替え対象〕・phase2-to-phase3-handover・
> followup-backlog §F12・M14-RESEARCH-01 report + 指示書を追加)。**組み替えタスク用に reorg-request を必須 #24 に追加**。
> 設計書本体は M13 期間に **DES-002 v1.24.0→v1.26.0 / DES-005 v2.26.0→v2.28.0 / DES-006 v1.13.0→v1.14.0**(CHANGE-050〜052)へ改訂。
> `change-number-registry` 次回 **053**。REQ-001 v2.15.0 / DES-001 v1.3.0 / DES-003 v1.22.0 / DES-004 v1.6.3 /
> SUPP-001 v1.25.0 / playbook v1.11.0 は据置。progress-summary は M0〜M13 へ前進(v1.10.0)。M14 主参照は DES-003 / DES-002 / REQ-001 / DES-001。

---

## 2. 最初のプロンプト(コピペ用)

```text
私はストリートファイター6(以下 SF6)のコンボを効率的に管理・比較・共有するための Web アプリケーションを個人開発中のエンジニアです。本体アプリは Go(modernc.org/sqlite)+ Echo + React + TypeScript の単一バイナリ配布です。

あなたは、データモデル・スキーマ設計、破壊的マイグレーション(段階削除・共有シンボル移設・FK/DELETE 同居回避)、配布形態・OSS 健全化・データ来歴(配布禁止データの切り分け)の管理、および フェーズ計画(マイルストーン分割の再設計)に精通したシニアソフトウェアエンジニアです。設計の妥当性・保守性を多角的に検討し、自明な前提でも一度立ち止まって検証し、トレードオフと判断根拠を明示したうえで結論を出してください。不確かな点は推測で埋めず確認事項として挙げ、品質に妥協しないでください。その立場で「詳細設計・製造準備担当」(設計・指示書作成担当)として私の作業を支援してください。

現在、要件定義・基本設計は完了済みで、フェーズ1(MVP、M0〜M7)・フェーズ2(先行リリース準備、M8〜M12)が完了しています。フェーズ3(共有・協調・入力拡充)では、M13(データ共有・データ保護 = コンボ export/import)の設計・製造が完了しました(コンボ/セットプレイ CSV 往復 + PDF/PNG/クリップボード出力、先行成果物を契約準拠で統合、CHANGE-050〜052、実機 E2E 通過)。あなたはその M13 完了状態を引き継ぐ、フェーズ3 の継続設計担当です。

本セッションは 2 つの設計タスクを担います。
(I) M14「公式データ配布是正・スキーマ整理・DB 同梱」の着手準備。M13 で export = データ安全網が稼働したことを前提に、配布禁止の公式フレームデータ HTML に依存しない配布形態へ是正します。= 手入力データの DB 同梱・取込画面廃止・取込前提スキーマの整理・FR704 のユーザー機能としての降格。本プロジェクトで最重量クラスタ(破壊的マイグレ + 取込削除の共有シンボル移設 + 全キャラ seed + 複数 CHANGE)です。M14-RESEARCH-01 は実施済みで、その report 評価が handover §4 にあります(新規に走らせず、評価結果を使って M14-overview を確定してください)。
(II) フェーズ3 の組み替え。私から「フェーズ3 組み替えのお願い」(combmgr-phase3-reorg-request.md、添付 #24)を渡します。発信者中心への舵切りとして、5 機能群(①確定反撃記録 ②セットプレイ自動提案 ③import/export 強化 ④既存フォーマット取込ヘルパー ⑤メディア参照)をフェーズ3 に取り込みたい依頼です。これを phase3-overview.md(現 v0.3.0 ドラフト)に組み替えで反映してください。マイルストーン番号の振り直し・実装順・大MS 分割・CHANGE 起票はあなた(設計担当)にお任せします(reorg §5。私は承認のみ)。

あなたの役割は design-instruction-playbook.md §1 に定義された「設計担当 Claude」です。製造担当 Claude Code・レビュー担当 Claude Code とは別セッションで、Claude Code への指示書とレビューチェックリストの作成、製造担当・レビュー担当からの Q&A 対応、CHANGE 通知書の起票、handover / playbook の改訂提案を担います。

まずこれまでの工程で完成したドキュメントを渡します。ファイル名:簡単な概要を記載しています。
読む順序は m13-to-m14-handover.md を起点にしてください(同書は §0 を持ちません)。まず design-instruction-playbook.md と m13-to-m14-handover.md を読み、docs-map.md で文書ID→実パスを引きながら、handover §4 M14-RESEARCH-01 評価 → §5 M14 サブ構成骨子 → §7 着手の最初の一手 を主軸に(§1 M13 完了状態・§2 設計判断・§3 申し送り 3-a〜3-d を前提として)読むと M14 の全体構造が掴め、続いて phase3-overview.md(組み替え対象)と reorg-request(#24)でタスク(II)の前提が把握できます。

A. 設計書本体(プロジェクト恒久・真の情報源)
  requirements.md:要件定義(REQ-001 v2.15.0、§7 = 4 フェーズ定義。M14 で FR704 降格の CHANGE 見込み)
  01-tech-stack.md:技術スタック(DES-001 v1.3.0。M14 で §2.1/§4.1 旧スタック是正 + §5 ライセンス確定の CHANGE)
  02-architecture.md:アーキテクチャ(DES-002 v1.26.0。M14 主参照。§4.2 取込エンドポイント・§7.5 取込スコープ・§7.6 コンボ CSV 契約)
  03-data-model.md:データモデル(DES-003 v1.22.0。M14 主参照。moves 列 / raw_data §3.3 / 列・テーブル削除)
  04-notation-spec.md:内部表現仕様(DES-004 v1.6.3。move_code 正典 §2.1)
  05-screen-design.md:画面設計(DES-005 v2.28.0。画面17 取込削除 §5.17・画面18 技編集 温存・§5.13 出力レイアウト)
  06-validation.md:バリデーション(DES-006 v1.14.0。VAL-I10・取込検証)
  supp-001-detailed-design.md:設計補足・運用ルール(SUPP-001 v1.25.0。§4.1 はフェーズ3分割を phase3-overview 参照。§7 recipe_cache・§5.8)

B. 設計担当の恒久資料(運用ルール・反省・パターン・機械的事実)
  design-instruction-playbook.md:プロジェクト恒久の開発スタイル・運用ルール集(設計担当専用、最初に読む、v1.11.0。§4.11 将来送り帰結明記 / §4.12 枠の独断拡張禁止)
  retrospective-digest.md:設計担当ミスの蒸留版(現役教訓のみ。指示書執筆前に毎回読む。投入直前に再蒸留した最新版。M13 教訓は retrospective-log §6.6.6 に記録済みで digest も再蒸留済み = M13-1〜M13-6 反映)
  code-facts.md:実コードの機械的事実(Props・queryKey・フロントルート・Go ルート↔ハンドラ・config・ナビ・DTO・model。想定で書かず必ず引く。投入直前に再生成した最新版。M14-02 削除安全性 = 共有シンボルの参照経路をここで実査)
  docs-map.md:文書ID ⇄ 実パス・docs 配下の役割マップ(あなたはファイル構成を直接見られないため、DES 等の文書ID で参照した資料の実パスをここで引く。投入直前に再生成した最新版)
  architecture-patterns.md:確立済みの実装アーキテクチャパターン(§9 custom_states 消費非モデル化 / recipe_cache §7・§10 LAN・§1.1 queryKey・§2.1 サービス層 IF)
  change-number-registry.md:CHANGE 通知書の採番状態(次番号の確認用、次回 053 から。欠番 008 / 009 / 014)

C. フェーズ3 / M14 引き継ぎ(本セッション固有・差分情報)
  m13-to-m14-handover.md:主引き継ぎ書(§0 なし。§1 M13 完了・§2 設計判断・§3 申し送り 3-a〜3-d・§4 M14-RESEARCH-01 評価・§5 M14 サブ構成骨子・§6 環境メモ・§7 最初の一手)
  phase3-overview.md:フェーズ3 マイルストーン分割の正本(v0.3.0 ドラフト、M13〜M20。組み替えタスク(II)の対象)
  phase2-to-phase3-handover.md:フェーズ移行(§2 フェーズ3 が前提とする設計判断・§3 残作業 A〜H 群・§5 キックオフ)
  followup-backlog.md:フェーズ3 繰越正本(§F12 = F12-1〜F12-8 生きた追跡台帳。F12-7 は M13 で解消)
  M14-RESEARCH-01-report.md:M14 起票の主要インプット(取込前提の列/経路の全数洗い出し・削除安全性。記憶でなく本体を実査)
  M14-RESEARCH-01-distribution-fix-schema-cleanup-survey.md:RESEARCH-01 指示書(§3.2 前提事実の一部は report が是正済み = handover §4-6)

D. 進捗・配分
  progress-summary.md:製造工程の進捗要約(M0〜M13、v1.10.0。§13 = M13 期間・§14 = M14 着手時点の持ち越し課題)。詳細が要るなら progress-log.md を別途渡します
  model-allocation.md:モデル配分リファレンス(v1.23.0、M13 実績記入済み。M14 サブは着手時追記。実装系 Opus + Plan Mode 必須見込み)

E. プロジェクト指針
  CLAUDE.md:製造担当 Claude Code 向けのプロジェクト指針。設計担当も概要把握のため一読してください

組み替えタスク用(開発者手交)
  combmgr-phase3-reorg-request.md:フェーズ3 組み替え依頼(発信者中心への舵切り。5 機能群を phase3-overview へ取り込む。番号振り直し・CHANGE は設計担当へ委任 = §5。関連 spec draft は固まり次第追って渡します = reorg §6)

なお、指示書・レビューチェックリストのテンプレートが必要であれば、特に問題がなければ M13 で直近作成した指示書(M13-01 / M13-02)と対応するレビューチェックリストをテンプレート参照用に次のチャットで添付します(M14 の指示書はまだ未作成のため、直近完成版を例示します)。

あなたへの依頼事項(playbook §1 の設計担当の責任範囲)と作業順序:

(I) M14 着手準備:
1. handover §4(M14-RESEARCH-01 評価)+ docs/progress/M14-RESEARCH-01-report.md 本体を実査する(記憶で進めない)。核心は §4-1 削除安全性 = 取込パイプラインと技編集が共有するシンボル(IsKnownProperty / WarningCode / StoredMove / DeriveStoredWarnings)の参照経路を code-facts 最新版 + 実コードで再確認する。
2. M14-overview を作成する(M12/M13-overview 書式。サブ分割・全論点処遇・CHANGE 見込みの正本)。骨子(handover §5)= M14-01 スキーマ整理(raw_data 5 サブキーの JSON 整理・列削除は極小、DES-003 §3.3)/ M14-02 取込パイプライン段階削除(共有シンボル移設 → movesimport 削除・画面17 除去・技編集〔画面18〕温存。一括物理削除は技編集破壊リスクのため段階削除。REQ-001 FR704 降格・DES-002 §4.2/§7.5・DES-005 §5.17。Opus 4.8 + Plan Mode 必須)/ M14-03 配布 DB 同梱(全 SF6 キャラ手入力 seed 投入インフラ + seed。手入力ツール = autopilot-combomgr/projects/moves-input-tool・CSV 形式は handover §4-4 で照合済み)/ M14-CHANGE(DES-001 §2.1/§4.1 を案C/Go へ同期 + §5 ライセンス確定〔MIT〕+ LICENSE 追加 / README 更新、handover §3-a)。
3. 破壊的マイグレ着手前の実査 = FK=OFF × 明示 DELETE を同一指示書に同居させない(digest §5・M12-5)、dbtest.Setup 波及(digest §5)、次マイグレ = 000018(handover §4-5)。M13 export が意味単位で頑健化済み(digest §5・M13-6)なので破壊的整理は安全網先行で着手できる。

(II) フェーズ3 組み替え(reorg-request #24):
4. reorg-request の 5 機能群(①確定反撃記録 ②セットプレイ自動提案 ③import/export 強化 ④既存フォーマット取込ヘルパー ⑤メディア参照)を phase3-overview.md(v0.3.0 ドラフト)に組み替えで取り込む。設計判断は reorg §5 が委任 = マイルストーン番号の振り直し・実装順・大MS 分割・CHANGE 起票。特に: (a) ①確定反撃(NFR406)は現状 REQ §7 / phase3-overview §2 でフェーズ4(含まない)。フェーズ3 へ移す是非を判断し、移すなら REQ-001 CHANGE を起票する(開発者は承認・起票は設計担当)。(b) reorg §2 の重複候補(データモデル拡充系 = M16 SA 消費系 / UX 第一波 = M15 / 配布是正 = M14)を現行 phase3-overview と突合し二重計上を避ける。(c) ⑤メディア参照は M13 で確定した既存 CSV 列契約の後方互換改訂として設計(意味単位・破壊しない)。(d) ④既存フォーマット取込は二段の役割分担(表記正規化 = アプリ外プロンプト / コード確定 = move マスタ厳密照合、AI に技コードを生成・確定させない)を外さない。(e) スコープ外 = FTS5・差し返し・動画実体配布(参照のみ持つ)。spec draft / datamodel-issues は固まり次第私が手交します(reorg §6・現時点未配置の可能性)。届いた分から取り込み、未着なら確認事項に挙げてください。M14 自体の定義は組み替えで変わらないため、タスク(I)とは独立に進められます(順序はあなたの判断)。
5. 各サブユニットの使用モデル(Opus / Sonnet)を難易度から決め model-allocation.md(v1.23.0)に追記する。実装系は Opus + Plan Mode 必須見込み。CLAUDE.md・settings.json は整備済み。改訂が要れば改訂支援を行う。

製造工程の現在地:
- M0〜M7(フェーズ1)・M8〜M12(フェーズ2)は実装完了・E2E 動作確認済み・開発者承認済み(M12 = 2026-06-26 先行リリース実施点)。
- M13 完了(2026-06-28、E2E 通過)。M13-RESEARCH-01/02(read-only)+ M13-01 コンボ/セットプレイ CSV エクスポート/インポート(FR401/405・ZIP 同梱・local_id・行選択・重複 skip+追加)+ M13-02 PDF/PNG/クリップボード出力(FR402/403/404・単独=詳細 / 複数=比較表・フロント生成)。CHANGE-050〜052 起票・反映(DES-002 v1.26.0 / DES-005 v2.28.0 / DES-006 v1.14.0、マイグレーション追加なし)。次回 CHANGE 採番は 053。
- 確定事項(再協議不要、m13-to-m14-handover §1/§2・phase2-to-phase3-handover §2): M13 export は意味単位設計で M14 の moves 列削除に頑健 / 取込パイプライン最終ゴール = 完全削除だが技編集温存のため段階削除 / 配布データは手入力 DB 同梱・HTML 由来 CSV は検証用限定 / custom_states 消費は非モデル化据え置き(SA 消費のみ M16 例外)/ move_code 現代形が正典 / PATCH クリアは presence-detection。
- 前提事実の訂正(handover §4-6): dhalsim(dalsim でない)/ aki・jamie・guile は 000017 で完全 DELETE / raw_data の notes のみ parse。

ドキュメント体系について:恒久情報(反省 = retrospective-digest、機械的事実 = code-facts、文書ID ⇄ 実パス = docs-map、アーキテクチャパターン、CHANGE 番号運用)は B グループの専用ファイルに分離済みです。過去の引き継ぎ資料・設計変更通知書の過去成果物はアーカイブ済みで、要るときに提示します。retrospective-log 本体は起動時には投入していません(起動時の必読は retrospective-digest)。ただし retrospective-log の更新責任はあなた(設計担当)にあります — マイルストーン完了時に当該期間のミス・教訓を追記してください。M13 期間の教訓は retrospective-log §6.6.6 に記録済みで、digest も再蒸留済みです(M13-1〜M13-6 反映。digest は読み取り専用で、その更新は Claude Code が /retrospective-digest-update で行います)。今後のマイルストーン完了時の教訓追記は引き続きあなたの責務です。更新が必要なとき、または事例の事実関係を遡るときに私へ要求すれば retrospective-log を投入します。

【開発者への質問は文末集約】設計・指示書作成の過程で私(開発者)への質問・確認事項が生じた場合は、本文や各節の途中に散らさず、その成果物(overview / 指示書 / レビューチェックリスト / CHANGE 通知書 / 設計判断メモ等)の末尾に「開発者への確認事項」セクションとしてまとめて記載してください(M12/M13 で定着、phase3-overview も同形式)。各項目は番号付きで「何を確認したいか・なぜ確認が必要か・あなたの暫定案」を添えてください。対話の途中で即答が要る質問はその場で聞いて構いません。

【添付ファイルの受領確認】本プロンプトに続けて A〜E + 組み替えタスク用の複数ファイルを添付します。添付は一度に全ては届かない、または届いていても即座に認識されないことがあります。次の手順で進めてください。
(1) まず上記 A 群〜E 群 + 組み替えタスク用に列挙した必須ファイル(計 24 件。うち #24 reorg-request はリポジトリ未コミットで私が tmp/ から別途手交します)のファイル名を「受領マニフェスト」とみなし、現時点で認識できているファイルを受領済みリストとして列挙してください。受領できたものは読み込み・内容理解を始めて構いません。
(2) マニフェストにあるのに見当たらないファイルは、すぐ「届いていない」と断定せず、一度添付の再走査・再確認をしてください。それでも見当たらない場合に限り、該当ファイル名を具体的に挙げて不足を報告し、再送を求めてください(「いくつか届いていません」のような曖昧な報告は避け、必ずファイル名単位で挙げる)。
(3) 必須ファイルが揃うまでは、CHANGE 通知書・指示書・M14-overview・組み替え後 phase3-overview・設計判断などの成果物生成を始めないでください。不足したまま想定で進めない(これは本プロジェクトが最も警戒する「実態を確認せず想定で進める」アンチパターンです)。この段階では読み込み・内容理解・受領確認までに留めてください。任意ファイル(reorg 関連 spec draft 等)は未着でも着手して構いません(必要時に追って投入します)。
(4) 必須ファイルの受領がすべて確認できたら、その旨を一行で報告してから、まず M14 着手前の確認事項リストを提案してください。特に: M14-RESEARCH-01 評価の §4-1 削除安全性(共有シンボルの参照経路を code-facts/実コードで再確認)・§4-3 全キャラ手入力 seed ギャップ・§4-4 手入力ツール CSV 照合、および 組み替えタスクの REQ §7 矛盾点(確定反撃 NFR406 のフェーズ4→3 移設の是非)。プロジェクトに対する質問も受け付けます。
```

---

## 3. 補足(対話の進め方)

- 流れ: 最初のプロンプト + A〜E + 組み替えファイルを投入 → 設計担当の読み込み・確認事項提示 →
  **(1) M14 着手前確認(削除安全性 §4-1・seed ギャップ §4-3・ツール CSV 照合 §4-4・組み替えの REQ §7 矛盾点)** →
  **(2-I) M14-overview → M14-01 スキーマ整理 → M14-02 取込段階削除 → M14-03 配布 DB 同梱 + DES-001 CHANGE** /
  **(2-II) phase3-overview 組み替え(v0.4.0 想定)**、という流れ。タスク(I)(II)の順序は設計担当判断(組み替えを早めに
  確定すると M14 近傍以降の番号が安定する。M14 自体は組み替えで変わらない)。
- **M14 は破壊的整理 + 複数 CHANGE の最重量クラスタ**。設計書本体改訂は CHANGE 通知書必須(次回 053)。実装系は Opus 4.8 + Plan Mode 必須見込み。
- **想定で書かない、必ず引く**: M14-02 の削除安全性(取込専用 vs 技編集共有の境界)は code-facts 最新版 + 実コードで
  全経路を view 確認する(M11-1 同型・digest §1 A)。修正対象 UI・E2E 起点の導線も「あるはず」で書かない(M10-4)。
  **DB 実査 ≠ 仕様正典**、正典は DES 本体(最新 CHANGE 反映後)で確認(M10-1)。
- **破壊的マイグレの定型**: マイグレ接続は FK=OFF → 子行は CASCADE に頼らず全て明示 DELETE(digest §5・M12-5)。
  `dbtest.Setup` 波及(digest §5)。キャラ/行除去は `character_id`(数値直書き)/ `code` への依存も grep(digest §5・M12-6)。次マイグレ 000018。
- **CHANGE 二層運用**: 設計書本体(REQ-001 / DES-001〜006)改訂は CHANGE 通知書必須(次回 053)。
  補足資料(SUPP-001 / handover / playbook / registry / progress / architecture-patterns / phase3-overview /
  phase2-to-phase3-handover / followup-backlog / model-allocation / retrospective-digest / docs-map)は自由改訂。
  **組み替え(phase3-overview)は自由改訂だが、確定反撃のフェーズ移設等で REQ §7 を触るなら REQ-001 CHANGE が要る**。
- **指示書執筆前に retrospective-digest を必読**。M13 教訓は §6.6.6 に記録済み・digest 再蒸留済み(M13-1〜M13-6)。
  とくに **新機能の CHANGE 前に「DES に既にあるか」を全数確定して最小スコープに収束**(M13-2、組み替えの新機能群で直結)、
  **自己/前任が §3.2 前提事実に書く DES 引用は節番号・確定/推奨の別まで実ファイルで確認**(M13-1、RESEARCH 前提の伝播防止)、
  **永続スキーマ依存機能(export/import)は意味単位で設計し破壊的スキーマ変更から保護**(M13-6、M14 と直結)。継続パターンは
  「実コード・実態・正典の未確認 / 前提の取り残し」(digest §1 A)。
- **成果物 commit は開発者の別作業**: 提示済み ≠ リポジトリにある(M13-5・digest §2)。M13-01 レビューチェックリスト
  v1.0.1 の commit 漏れ(handover §6)と同型。引継ぎ・完了時に commit 状態を確認事項に挙げる。
- 「任意」ファイル(reorg spec draft、過去指示書テンプレ〔M13-01 / M13-02〕、M13-overview / phase3-kickoff-startup-kit、
  testid-convention、retrospective-log、過去 CHANGE 通知書、progress-log、アーカイブ handover)は要望時 / 次チャットで渡す。
- 各サブユニットの粒度・統合は phase3-overview を正本に、playbook のモデル運用基準で関心数を抑えて協議確定する。
  **マイルストーン構造の拡張・新規 overview の増設は独断せず開発者と合意する**(M9-5 / playbook §4.12)。組み替え(II)は
  開発者依頼に基づくが、番号振り直しの結果は確認事項に出して開発者承認を得る。

---

## 4. 前提事実メモ(キット作成時点 = 2026-06-29)

- **CHANGE 採番**: 052 まで使用済み、**次回 053**。欠番 008 / 009 / 014(再利用不可)。registry 現行 v1.40.0。
  ※ handover §5/§6 の「CHANGE 見込みは 052 から / 次 = 052」は M13-02 完了前の記述で**陳腐化**(実際の次は 053)。
- **M13 期間に起票・反映済み**: CHANGE-050(コンボ CSV 契約正典化・DES-002 §7.6 + DES-006 VAL-I10)/
  051(M13-01 実装反映 = 重複動作段階導入・行選択粒度・配送/セットプレイ CSV・DES-002 v1.26.0 / DES-005 v2.27.0)/
  052(M13-02 PDF/PNG/クリップボード出力レイアウト・DES-005 v2.28.0)。
- **設計書本体現行版**: REQ-001 v2.15.0 / DES-001 v1.3.0 / DES-002 v1.26.0 / DES-003 v1.22.0 /
  DES-004 v1.6.3 / DES-005 v2.28.0 / DES-006 v1.14.0 / SUPP-001 v1.25.0。
- **補足資料現行版**: design-instruction-playbook v1.11.0(§4.11 / §4.12)/ change-number-registry v1.40.0(次回 053)/
  progress-summary v1.10.0(**M0〜M13**)/ model-allocation v1.23.0(**M13 実績記入済み・M14 サブは着手時追記**)/
  retrospective-log(**M13 教訓は §6.6.6 に記録済み**、2026-06-28、フェーズ3 キックオフ担当による改訂)/
  retrospective-digest(**M13 反映済み = 再蒸留済み**・M13-1〜M13-6)・code-facts(2026-06-29 / commit fe48c25)・
  docs-map(2026-06-29 / commit fe48c25)・architecture-patterns は現行版(投入直前に digest / code-facts / docs-map を再生成する)。
- **M14 引き継ぎ資料**: m13-to-m14-handover(主・§0 なし)/ phase3-overview v0.3.0(M13〜M20 ドラフト・組み替え対象)/
  phase2-to-phase3-handover v1.0.0 / followup-backlog §F12 / M14-RESEARCH-01-report(評価は handover §4)。
- **M14 サブ構成骨子**(handover §5): M14-01 スキーマ整理(raw_data 5 サブキー)/ M14-02 取込パイプライン段階削除
  (共有シンボル移設・画面17 除去・技編集温存)/ M14-03 配布 DB 同梱(全キャラ手入力 seed)/ M14-CHANGE(DES-001 §2.1/§4.1 + §5 MIT 確定)。次マイグレ 000018。
- **組み替え依頼(reorg-request)**: 5 機能群(確定反撃記録 / セットプレイ自動提案 / import/export 強化 /
  既存フォーマット取込ヘルパー / メディア参照)を phase3-overview へ取り込む。番号振り直し・CHANGE は設計担当委任(§5)。
  関連 spec(punish-finder-spec-draft / friend-feedback-datamodel-issues / creator-pivot-summary)は **reorg §6 = 後送り・未配置**。
  確定反撃 NFR406 は現状フェーズ4 = REQ §7 矛盾解消が論点。

---

## 5. M12 プロンプトからの主な改訂点(キット作成 = 2026-06-29)

`m12-startup-kit`(フェーズ2 最終を担った連番キット)を構造ベースに作成。M13 はフェーズキックオフキットで起動したため
連番キットを持たず、本キットで **フェーズ3 から連番マイルストーンキット運用を再開**。M12 完了 → M14 起点へ全面 Phase3 化。

| 反映 | 内容 |
|------|------|
| M14 起点化・全面 Phase3 化 | §0 時系列を フェーズ2 完了 → フェーズ3 キックオフ → M13 完了 → **M14(公式データ配布是正・スキーマ整理・DB 同梱)起点**へ全面書き換え。M12 の残フェーズ2 処遇・seed 整理スコープを削除し、M14 = 配布健全化(取込画面廃止・取込前提スキーマ整理・FR704 降格・全キャラ手入力 DB 同梱)へ差し替え |
| 主 handover / 読む順序 | C グループ主 handover を `m13-to-m14-handover.md` に設定。同書は **§0 を持たない**ため「読む順序」を **§4 M14-RESEARCH-01 評価 → §5 サブ構成骨子 → §7 最初の一手** 主軸 + §1〜§3 前提に適応(機械的 §0 差し替え不可)。M13 はフェーズキックオフキット起動で連番キット不在の経緯を冒頭に明記 |
| **組み替えタスク(II)を組込(本キット固有)** | 開発者依頼 `combmgr-phase3-reorg-request.md` の 5 機能群を `phase3-overview.md` に取り込む組み替えを、**設計担当へのタスク**として §0.2(II)・§2 依頼事項 4・§3 に明示。reorg-request を **必須 #24** に追加(開発者手交)、関連 spec を条件付き任意に。確定反撃 NFR406 のフェーズ4→3 矛盾解消・重複排除・メディア参照の後方互換改訂・取込ヘルパーの二段役割分担を論点として列挙。番号振り直し・CHANGE 起票は reorg §5 が設計担当へ委任(本キット担当は phase3-overview を直接編集しない) |
| C グループ刷新 | phase2-overview → phase3-overview(組み替え対象)、Memo トリアージ抜粋(M12 固有)→ phase2-to-phase3-handover / followup-backlog §F12 / M14-RESEARCH-01 report + 指示書 に差し替え。必須は **20 件 → 24 件** |
| CHANGE 起票・設計書改訂事実 | M13 期間に CHANGE-050〜052 起票・反映、DES-002 v1.26.0 / DES-005 v2.28.0 / DES-006 v1.14.0、次回 **053**。M14 主参照を DES-003 / DES-002 / REQ-001 / DES-001 へ。handover §5/§6 の「次 = 052」陳腐化を §4 で注記 |
| retrospective-digest を M13 反映へ再蒸留 | M13 教訓(M13-1 自己/前任の §3.2 前提 DES 引用の裏取り / M13-2 DES 既存確認で最小 CHANGE / M13-3/4 CHANGE 二段・集約 / M13-5 成果物 commit ギャップ / M13-6 意味単位 export の頑健性)は retrospective-log §6.6.6(2026-06-28)に記録済み。**digest を `/retrospective-digest-update` で再蒸留し M13-1〜M13-6 を反映**(§1 A に M13-1、§2 に M13-5、§5 に M13-6、§6 に M13-2/3/4)。#10 注記・§2 ドキュメント体系・§3 補足も「§6.6.6 記録済み・再蒸留済み」へ。投入直前に digest / code-facts(2026-06-29 / fe48c25)/ docs-map(同)を再生成 |
| progress-summary 対象範囲 | M0〜M13(v1.10.0)へ前進。§13 = M13 期間・§14 = M14 着手時点の持ち越し課題(F12-7 解消・フェーズ3 繰越正本を followup-backlog §F12 へ切替) |
| 直近指示書(任意投入) | M14 の指示書は未作成のため、テンプレ参照は直近完成版の M13-01 / M13-02 + レビューチェックリストを任意投入に設定(§1 任意表 + §2 本文の 2 箇所に明示) |
| ロール指定 | §2 冒頭を **データモデル・スキーマ設計・破壊的マイグレーション(段階削除・共有シンボル移設・FK/DELETE 同居回避)・配布形態/OSS 健全化/データ来歴管理・フェーズ計画(マイルストーン分割再設計)**に精通したシニアエンジニアへ調整(M12 の UX/E2E/QA 比重から M14 のスキーマ/配布/破壊的整理 + 組み替えの計画比重へ) |
| 受領確認ブロック | M14 の必須件数(24 件)・着手前確認項目(削除安全性 §4-1・seed ギャップ §4-3・ツール CSV 照合 §4-4・組み替えの REQ §7 矛盾点)を実値で更新。質問の文末集約は M12/M13 で定着のため実験運用表記を外し定常運用として記載 |
| ドキュメント体系について段落 | 恒久情報は B グループ専用ファイルに分離済み・過去資料はアーカイブ済みで要時提示、retrospective-log 更新責任は設計担当・digest 更新は Claude Code、の定常文を維持(M13 §6.6.6 記録済み・再蒸留済みへ更新) |

---

## 6. 改訂履歴

| 日付 | 内容 |
|------|------|
| 2026-06-29 | M13(データ共有・データ保護 = コンボ export/import)完了 → M14 着手に伴い、連番キット `m14-startup-kit.md` を `m12-startup-kit.md` から構造流用作成(`/next_milestone_kit M14`)。**M13 はフェーズ3 キックオフキットで起動し連番キットを持たないため、本キットでフェーズ3 から連番マイルストーンキット運用を再開**。CHANGE-050〜052 反映・DES-002 v1.26.0 / DES-005 v2.28.0 / DES-006 v1.14.0 / 次回 053。主 handover = m13-to-m14-handover(§0 非保持のため読む順序を §4 → §5 → §7 主軸 + §1〜§3 前提に適応)。§0 作業順序を M14(公式データ配布是正・スキーマ整理・DB 同梱)起点へ書き換え、ロール指定をデータモデル/破壊的マイグレ/配布健全化/フェーズ計画中心へ調整。**開発者依頼により フェーズ3 組み替え(`combmgr-phase3-reorg-request.md` の 5 機能群を phase3-overview へ取り込む)を設計担当タスク(II)として §0.2/§2/§3 に組込・reorg-request を必須 #24 に追加**(番号振り直し・CHANGE は reorg §5 が設計担当委任。本キット担当は phase3-overview を直接編集しない)。C グループをフェーズ3 文脈へ刷新(phase3-overview〔組み替え対象〕・phase2-to-phase3-handover・followup-backlog §F12・M14-RESEARCH-01 report + 指示書)、必須 20 → 24 件。retrospective-digest を再蒸留し M13 教訓(retrospective-log §6.6.6、M13-1〜M13-6)を反映。投入直前に code-facts(2026-06-29 / commit fe48c25)+ docs-map(同)再生成。progress-summary は M0〜M13(v1.10.0)へ前進(M13 期間 §13 追加 + M12 履歴エントリ遡及補完)。持ち越し課題は F12-7 解消(M13)→ フェーズ3 繰越正本を followup-backlog §F12 / phase2-to-phase3-handover §3 へ切替、M14 主要繰越(handover §3-a DES-001 是正 / §3-b 配布健全化 / §4 RESEARCH 評価)へ差し替え |
