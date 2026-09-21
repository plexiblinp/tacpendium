# フェーズ2 継続設計セッション 起動キット

> 本ファイルは **フェーズ2 継続設計担当(Claude Web 版「設計・指示書作成担当」)チャット**を
> 立ち上げるためのプロンプト本文 + 投入ファイル一覧。流用方法は同フォルダの `README.md` を参照。
>
> **本キットは標準の連番マイルストーンキット(`m4`〜`m7-startup-kit.md`)とは性格が異なる特殊キットです。**
> 連番キットが「新マイルストーンの overview から指示書作成までを起こす」のに対し、本キットは
> **フェーズ2 キックオフ設計セッション(M8 設計 + phase2-overview + FR701 委任ブリーフを完遂)を
> 引き継ぐ継続設計セッション**を起動します。本体フェーズ2 の**本流スパイン**(M8-01 製造指示書以降)を
> 担う設計チャットであり、FR701 取込ツールを専任委任する並列チャット(`m9-fr701-importer-startup-kit.md`)
> とは別に走ります。
>
> **一次資料は 2 つの引き継ぎ書です。**
> - `phase2-kickoff-design-session-handover.md` v1.0.0(本流タスク = M8-01 以降の引き継ぎ)
> - `phase2-e2e-playwright-handover.md` v1.0.0(E2E 自動化 Playwright 前倒し検討の workstream)

---

## 0. 本キットの位置づけ / 新セッションの作業順序(必読)

### 0.1 時系列

フェーズ1(M0〜M7)完了 → 整理工程(CHANGE-020 / 021)→ **フェーズ2 キックオフ設計セッション**
(M8 設計 = CHANGE-022 / 023、phase2-overview v0.1.0、FR701 委任ブリーフ v1.0.0 を完遂)→
コンテキスト圧迫により移行 → **本キット = フェーズ2 継続設計セッション**。

M8 の設計(moves スキーマ・FR704 CSV 契約・技名正規化・取込スコープ)は確定・反映済み。
継続セッションが扱うのは製造工程の指示書化と M9 以降の設計。

### 0.2 新セッションの作業順序(開発者方針 2026-06-09)

> **元の 2 引き継ぎ書は E2E Playwright を「M8-01 優先・E2E は queue(緊急度低)」と位置づけていたが、
> 開発者方針(2026-06-09)で順序を見直し、E2E 前倒し検討を先行させる。** 本キットはこの方針を反映する。

1. **最初に E2E Playwright 前倒し検討**(`phase2-e2e-playwright-handover.md`)。
   - **M-RESEARCH** を起票(現行フロー棚卸し + `data-testid` 準備状況 + Playwright 適合 + 既存
     `m*-e2e-scenarios.md` → spec 変換工数の見積り。判断・提案を含めない RESEARCH 運用、
     architecture-patterns §6 の調査担当パターン)。命名例 `M{N}-RESEARCH-NN-e2e-playwright-feasibility-check`、
     推奨モデル Sonnet クラス。→ 開発者が **採否判断**。
   - 採用する場合、DES-002 §12 / SUPP-001 §4.5 の「Playwright(フェーズ3以降)」を前倒しに改訂
     (DES-002 = 設計書本体 = CHANGE 通知書必須、**次回採番 024**。SUPP-001 §4.5 は自由改訂で DES-002 と整合)。
   - **基盤導入サブユニットの実施タイミングは M8 後〜M9 前後を目安**(moves スキーマ確定後に基盤を入れると
     以降 M9〜M12 が自動回帰の恩恵を受ける = e2e-handover §2 結論 / §3)。phase2-overview への位置づけ +
     model-allocation へのモデル配分追記。

2. その結論を踏まえ **M8-01 製造指示書作成**(本流の最重要タスク)。
   - スコープ: moves テーブルへ 8 列追加のマイグレーション(startup / active / total / on_hit / on_block /
     drive_gauge_decrease_guard / is_aerial / setup_only)+ model / DTO / `GET /api/characters/{id}/moves` 反映。
   - **着手前に開発者へ確認**: (a) `total` 算出式(発生・持続・硬直からの全体硬直、格ゲー仕様 = 開発者領域)、
     (b) 既存 seed の移行戦略(NOT NULL の startup / total を一時デフォルト → backfill 等)、(c) 耐久 seed
     (migration 000012)との順序(除去は M12-02)、(d) 次マイグレーション番号 view 確認、(e) 既存 moves
     スキーマ・seed の view 確認(design-session-handover §3)。
   - 推奨モデル Sonnet クラス + Plan Mode 必須(total 算出・NOT NULL backfill が複雑化するなら Opus クラス)。

3. **M9**(公式データ取込パイプライン)。
   - **M9-01 = FR701 取込ツールは別チャットへ委任**(`m9-fr701-importer-startup-kit.md` が並列起動。
     委任ブリーフ `phase2-tool-delegation-brief-fr701-importer.md`)。
   - M9-RESEARCH(技術スタック選定、委任側)/ M9-02(FR704 アプリ取込)/ M9-03(FR703 公式データ不備時の
     手動修正・グリッド編集)の設計。

4. **M10 複数キャラ登録 UI**(A-1 / A-2、ComboEditor キャラ選択化・リュウ固定 UX 解消)/
   **M11 custom_states**(開始時状態 = boolean 中心、消費はコンボ notes 管理でモデル化しない)/
   **M12 先行リリース仕上げ**(M12-01 UX #62 / #63、M12-02 耐久 seed 無効化マイグレ、
   M12-03 統合 E2E + 配布判定)。**先行リリース判定は M12-03**。

### 0.3 確定事項の継承(design-session-handover §2、再協議不要)

- **moves スキーマ 8 列**(CHANGE-022 v0.3.0、DES-003 v1.17.0 §3.3): recovery は moves 非永続(CSV のみ・
  total 算出素材)、properties は取込時コード値正規化、ラッシュ可否は `category ∈ {normal, unique}` かつ
  `is_aerial = false` で導出、setup_only はセットプレイ自動提案の予約列。
- **FR704 CSV 契約**(DES-002 §7.5): name_ja → official_ja_move のみ、**name_en は CSV 非出力**(英語ロケールは
  フェーズ3以降)、move_code / character_code はツールが決定論採番、total 非出力(recovery を出力し本体が算出)。
- **技名正規化・取込スコープ**(CHANGE-023 v0.2.0、DES-004 §3.2 / DES-002 §7.5): キャラ固有フレーバー除去・
  共通技の汎用名化、通常投げは出現順で前投げ / 後ろ投げ自動採番、取込対象外 = ステップ / パリィ / ラッシュ /
  ドライブリバーサル。
- **フェーズ2 = 5 大MS(M8〜M12)**(phase2-overview v0.1.0)。custom_states 消費・英語ロケールはフェーズ3以降。

---

## 1. 投入ファイル一覧(開発者用・パス付き)

Web チャットへアップロードするファイル。**必須**は初回投入、**任意**は対話の中で要望が出たとき・
必要になったときに渡す。

### 必須(初回投入)

| # | ファイル名 | リポジトリ上のパス | 種別 |
|---|-----------|------------------|------|
| 1 | requirements.md | `docs/design/requirements.md` | 設計書本体(REQ-001 v2.15.0、§7 = 4 フェーズ定義・FR701〜704) |
| 2 | 01-tech-stack.md | `docs/design/01-tech-stack.md` | 設計書本体(DES-001 v1.3.0) |
| 3 | 02-architecture.md | `docs/design/02-architecture.md` | 設計書本体(DES-002 v1.11.0、CHANGE-022 / 023 反映済み。§7.5 CSV 契約・§12 テスト方針) |
| 4 | 03-data-model.md | `docs/design/03-data-model.md` | 設計書本体(DES-003 v1.17.0、CHANGE-022 反映済み。§3.3 moves スキーマ) |
| 5 | 04-notation-spec.md | `docs/design/04-notation-spec.md` | 設計書本体(DES-004 v1.5.0、CHANGE-023 反映済み。§3.2 技名正規化) |
| 6 | 05-screen-design.md | `docs/design/05-screen-design.md` | 設計書本体(DES-005 v2.13.0) |
| 7 | 06-validation.md | `docs/design/06-validation.md` | 設計書本体(DES-006 v1.11.0) |
| 8 | supp-001-detailed-design.md | `docs/design/supp-001-detailed-design.md` | 設計補足(SUPP-001 v1.20.0。§4.1 phase2-overview 参照・§4.5 E2E 先送り) |
| 9 | design-instruction-playbook.md | `docs/handover/design-instruction-playbook.md` | 運用ルール集(v1.9.1。最初に読む。§1 役割境界・§2 指示書テンプレ・§16 CHANGE 手順) |
| 10 | retrospective-log.md | `docs/handover/retrospective-log.md` | 設計担当ミス累積記録(現行版、本セッション着手前の追記なし) |
| 11 | architecture-patterns.md | `docs/handover/architecture-patterns.md` | 確立アーキテクチャパターン(現行版。§6 調査担当パターン・§9 custom_states / recipe_cache) |
| 12 | change-number-registry.md | `docs/handover/change-number-registry.md` | CHANGE 番号運用(v1.11.0、次回採番 024 から。欠番 008 / 009 / 014) |
| 13 | phase2-kickoff-design-session-handover.md | `docs/handover/phase2-kickoff-design-session-handover.md` | **主引き継ぎ書**(v1.0.0。最初に読む。M8-01 以降の本流タスク・確定事項) |
| 14 | phase2-e2e-playwright-handover.md | `docs/handover/phase2-e2e-playwright-handover.md` | **E2E 前倒し検討 workstream**(v1.0.0。最初に読む。たたき台 + M-RESEARCH 進め方) |
| 15 | phase2-overview.md | `docs/instructions/phase2-overview.md` | フェーズ2 マイルストーン分割の正本(v0.1.0、M8〜M12。必読) |
| 16 | CHANGE-022-moves-frame-data-and-csv-contract.md | `docs/change-notes/CHANGE-022-...md` | moves スキーマ・CSV 契約(v0.3.0、確定根拠) |
| 17 | CHANGE-023-move-name-normalization-and-import-scope.md | `docs/change-notes/CHANGE-023-...md` | 技名正規化・取込スコープ(v0.2.0、確定根拠) |
| 18 | progress-summary.md | `docs/progress/progress-summary.md` | 進捗要約 M0〜M7(v1.4.2、フェーズ2 キックオフ着手前時点。§8 持ち越し要約) |
| 19 | model-allocation.md | `docs/human-notes/model-allocation.md` | モデル配分(v1.7.0。**M8 以降未追記**、各サブユニット着手時に追記する) |
| 20 | CLAUDE.md | `CLAUDE.md`(リポジトリルート) | 製造担当向け指針(設計担当も一読) |

### 任意(対話の中で要望が出たとき・必要になったときに投入)

| ファイル名 | パス | 渡すタイミング |
|-----------|------|--------------|
| phase2-kickoff-handover.md | `docs/handover/phase2-kickoff-handover.md` | フェーズ1→2 着手の文脈(v1.0.0)。phase2-kickoff-design-session-handover と相補的、フェーズ2 全体の作業順序や持ち越し全体像を遡るとき |
| phase2-tool-delegation-brief-fr701-importer.md | `docs/instructions/phase2-tool-delegation-brief-fr701-importer.md` | M9-01 FR701 委任(別チャット)の文脈把握。M9-02 / M9-03 の本体側 CSV 取込が委任側 CSV 契約とどう接続するか確認するとき |
| 過去の指示書テンプレート(M6-03 / M6-04 + M6-04 レビューチェックリスト) | `docs/instructions/` ・ `docs/instructions/reviews/` | 指示書テンプレート参照用(M8 / M9 の指示書は未作成のため、直近完成版の過去分を参照) |
| progress-log.md | `docs/progress/progress-log.md` | progress-summary.md で足りず、M1〜M7 の詳細(curl 出力・E2E 等)が必要になったとき |
| アーカイブ handover(handover_1 / m1-to-m2 〜 m7-phase1-completion 等) | `docs/handover/archive/` | 基本設計時点の前提や M1〜M7 期・整理工程の細部を遡る必要が出たとき |
| CHANGE 通知書(過去分 020 / 021 等) | `docs/change-notes/` | 設計変更の経緯を遡る必要が出たとき |

> フェーズ2 キックオフからの変更点: 主 handover が `phase2-kickoff-design-session-handover.md`(#13)に進捗し、
> E2E workstream `phase2-e2e-playwright-handover.md`(#14)が加わった。設計書本体は M8 着手前に
> **DES-002 v1.9.0 → v1.11.0 / DES-003 v1.16.0 → v1.17.0 / DES-004 v1.4.0 → v1.5.0**(CHANGE-022 / 023)、
> **SUPP-001 v1.19.0 → v1.20.0** に改訂。`change-number-registry v1.11.0`(次回 024)。
> REQ-001 v2.15.0 / DES-001 v1.3.0 / DES-005 v2.13.0 / DES-006 v1.11.0 / playbook v1.9.1 は M8 着手前から据置。

---

## 2. 最初のプロンプト(コピペ用)

```text
私はストリートファイター6(以下 SF6)のコンボを効率的に管理・比較・共有するための Web アプリケーションを個人開発中のエンジニアです。本体アプリは Go(modernc.org/sqlite)+ Echo + React + TypeScript の単一バイナリ配布です。

あなたは、データモデル・スキーマ設計、API 設計、テスト自動化(E2E / Playwright)設計、状態管理、バリデーション設計に精通したシニアソフトウェアエンジニアです。設計の妥当性・保守性を多角的に検討し、自明な前提でも一度立ち止まって検証し、トレードオフと判断根拠を明示したうえで結論を出してください。不確かな点は推測で埋めず確認事項として挙げ、品質に妥協しないでください。その立場で「詳細設計・製造準備担当」(設計・指示書作成担当)として私の作業を支援してください。

現在、要件定義・基本設計は完了済みで、フェーズ1(MVP、M0〜M7)も完了しています。フェーズ2「先行リリース準備」のキックオフ設計セッションが、M8 の設計(moves スキーマ + FR704 CSV 契約 = CHANGE-022 / 023)・フェーズ2 マイルストーン分割(phase2-overview)・FR701 取込ツールの委任ブリーフを完遂し、そのセッションから引き継いだのがあなたです。あなたはフェーズ2 の本流スパイン(M8-01 製造指示書以降)を担います。FR701 取込ツールは別チャットの専任設計担当へ委任済みで、あなたとは並列に進みます。

あなたの役割は design-instruction-playbook.md §1 に定義された「設計担当 Claude」です。製造担当 Claude Code・レビュー担当 Claude Code とは別セッションで、Claude Code への指示書とレビューチェックリストの作成、製造担当・レビュー担当からの Q&A 対応、CHANGE 通知書の起票、handover / playbook の改訂提案を担います。

まずこれまでの工程で完成したドキュメントを渡します。ファイル名:簡単な概要を記載しています。
読む順序は phase2-kickoff-design-session-handover.md §0「新セッション開始時の最優先作業」を起点にしてください(まず design-instruction-playbook.md と phase2-kickoff-design-session-handover.md を読むと全体構造が掴め、続いて phase2-overview.md と phase2-e2e-playwright-handover.md で計画と E2E workstream を把握できます)。

A. 設計書本体(プロジェクト恒久・真の情報源)
  requirements.md:要件定義(REQ-001 v2.15.0、§7 = 4 フェーズ定義・FR701〜704)
  01-tech-stack.md:技術スタック(DES-001 v1.3.0)
  02-architecture.md:アーキテクチャ(DES-002 v1.11.0、CHANGE-022 / 023 反映済み。§7.5 CSV 契約・§12 テスト方針)
  03-data-model.md:データモデル(DES-003 v1.17.0、CHANGE-022 反映済み。§3.3 moves スキーマ)
  04-notation-spec.md:内部表現仕様(DES-004 v1.5.0、CHANGE-023 反映済み。§3.2 技名正規化)
  05-screen-design.md:画面設計(DES-005 v2.13.0)
  06-validation.md:バリデーション(DES-006 v1.11.0)
  supp-001-detailed-design.md:設計補足・運用ルール(SUPP-001 v1.20.0。§4.1 phase2-overview 参照・§4.5 E2E 先送り)

B. 設計担当の恒久資料(運用ルール・反省・パターン)
  design-instruction-playbook.md:プロジェクト恒久の開発スタイル・運用ルール集(設計担当専用、最初に読む、v1.9.1)
  retrospective-log.md:設計担当が全期間で犯した指示書ミスの累積記録(現行版)
  architecture-patterns.md:確立済みの実装アーキテクチャパターン(現行版。§6 調査担当パターン・§9 custom_states / recipe_cache)
  change-number-registry.md:CHANGE 通知書の採番状態(次番号の確認用、次回 024 から。欠番 008 / 009 / 014)

C. フェーズ2 引き継ぎ(本セッション固有・差分情報)
  phase2-kickoff-design-session-handover.md:主引き継ぎ書(v1.0.0。M8-01 以降の本流タスク・確定事項・M9 委任方針)
  phase2-e2e-playwright-handover.md:E2E 自動化(Playwright)前倒し検討の workstream(v1.0.0。たたき台 + M-RESEARCH 進め方)
  phase2-overview.md:フェーズ2 マイルストーン分割の正本(v0.1.0、M8〜M12)
  CHANGE-022 / CHANGE-023 通知書:M8 設計の確定根拠(v0.3.0 / v0.2.0)

D. 進捗・配分
  progress-summary.md:製造工程の進捗要約(M0〜M7、v1.4.2)。詳細が要るなら progress-log.md を別途渡します
  model-allocation.md:モデル配分リファレンス(v1.7.0、M8 以降未追記。各サブユニット着手時に追記する)

E. プロジェクト指針
  CLAUDE.md:製造担当 Claude Code 向けのプロジェクト指針。設計担当も概要把握のため一読してください

あなたへの依頼事項(playbook §1 の設計担当の責任範囲)と作業順序:
私の方針として、まず E2E 自動化(Playwright)前倒しの可否を判断してから、M8 の製造指示書作成へ入りたいです。以下の順で進めてください。

1. E2E Playwright 前倒し検討(phase2-e2e-playwright-handover.md)を最初に扱う。現行フロー棚卸し・data-testid 準備状況・既存 E2E シナリオ(m*-e2e-scenarios.md)→ Playwright spec 変換工数を実数化する M-RESEARCH(調査担当運用、architecture-patterns §6)を起票し、私の採否判断を仰ぐ。採用するなら DES-002 §12 / SUPP-001 §4.5 の「フェーズ3以降」前倒しを CHANGE 通知書で改訂(DES-002 = 本体 = CHANGE 必須、次回 024)、基盤導入サブユニットを phase2-overview へ位置づける。基盤導入の実施タイミングは moves スキーマ確定後の M8 後〜M9 前後を目安とする。
2. その結論を踏まえ、M8-01 製造指示書(moves テーブル 8 列追加マイグレーション + model / DTO / GET /api/characters/{id}/moves 反映)を作成する。着手前に私へ確認すべき事項 = total 算出式・既存 seed の移行戦略・耐久 seed(migration 000012)との順序・次マイグレーション番号・既存 moves スキーマと seed の view 確認(phase2-kickoff-design-session-handover.md §3.2)。
3. M9(公式データ取込パイプライン)= M9-02(FR704 アプリ取込)/ M9-03(FR703 手動修正・グリッド編集)の設計。M9-01 = FR701 取込ツールは別チャットの専任設計担当へ委任済みで、あなたとは並列に進む(本体側 CSV 取込との契約整合のみ留意)。
4. M10 複数キャラ登録 UI(A-1 / A-2)/ M11 custom_states 開始時状態 / M12 先行リリース仕上げ(M12-03 = 統合 E2E + 配布判定)の指示書を順次。
5. 各サブユニットの使用モデル(Opus / Sonnet)を難易度を考慮して決め、model-allocation.md に追記する(M8 以降は未追記)。CLAUDE.md・settings.json は整備済み。改訂が要れば改訂支援を行う。

製造工程の現在地:
- M0〜M7(フェーズ1)は実装完了・E2E 動作確認済み・開発者承認済み。
- M8 の設計は確定・反映済み。M8 期間着手前に CHANGE-022(moves フレーム 8 列 + FR704 CSV 契約 + 取込エンドポイント是正)・CHANGE-023(技名正規化規約 + 取込対象スコープ + 通常投げ位置自動採番、moves スキーマ変更なし)を起票し、DES-002 v1.11.0 / DES-003 v1.17.0 / DES-004 v1.5.0 / SUPP-001 v1.20.0 に反映済み。次回 CHANGE 採番は 024。
- 確定事項(再協議不要、phase2-kickoff-design-session-handover.md §2): moves 8 列・recovery 非永続・properties コード値正規化・ラッシュ可否は category + is_aerial で導出 / FR704 CSV は official_ja_move のみ(name_en 非出力)/ 技名正規化・取込スコープ / フェーズ2 = 5 大MS(M8〜M12)・先行リリース判定 = M12-03 / 英語ロケール・custom_states 消費はフェーズ3以降。
- 開発者の反映状態に未了点がある場合(例: CHANGE-022 のラベル訂正版の再コミット)は §7 の申し送りを参照し、着手前に私へ確認してください。

ドキュメント体系について:恒久情報(反省・アーキテクチャパターン・CHANGE 番号運用)は B グループの専用ファイルに分離済みです。過去の引き継ぎ資料・設計変更通知書の過去成果物はアーカイブ済みで、要るときに提示します。

まずは添付のファイルを読み込み、作業を理解してください。読み込みに失敗したファイルは連絡してください、再送します。不足しているとみられる資料や、プロジェクトに対する質問は受け付けます。理解後、まず (1) E2E Playwright 前倒し検討の進め方(M-RESEARCH の枠組みと私への確認事項)、続いて (2) M8-01 着手前の確認事項リストを提案してください。
```

---

## 3. 補足(対話の進め方)

- 流れ: 最初のプロンプト + A〜E のファイルを投入 → 設計担当の読み込み・確認事項提示 →
  **(1) E2E Playwright 前倒し検討(M-RESEARCH feasibility → 開発者の採否判断)** →
  **(2) M8-01 製造指示書(moves スキーマ移行)** → M9-02 / M9-03 → M10 / M11 / M12、という流れ。
- **E2E 前倒しの採否を先に固める**: 開発者方針(2026-06-09)で、M8-01 製造に入る前に E2E 自動化の
  feasibility と採否を判断する。採用時の基盤導入サブユニットの差し込み先は moves スキーマ確定後の
  M8 後〜M9 前後を目安とする(e2e-handover §2 結論 / §3)。
- **M9-01 FR701 取込ツールは別チャットの専任設計担当へ並列委任**(`m9-fr701-importer-startup-kit.md`)。
  本流スパインの設計担当は本体側(FR704 / FR703)を扱い、委任側 CSV 契約との整合に留意する。
- **CHANGE 二層運用**: 設計書本体(REQ-001 / DES-001〜006)改訂は CHANGE 通知書必須(次回 024)。
  補足資料(SUPP-001 / handover / playbook / registry / progress / architecture-patterns / phase2-overview /
  model-allocation)は自由改訂。
- 「任意」ファイル(phase2-kickoff-handover、FR701 委任ブリーフ、過去指示書テンプレ、progress-log、
  アーカイブ handover、過去 CHANGE 通知書)は設計担当から要望が出たとき、または次チャットで渡す。
- 各サブユニットの粒度・統合は phase2-overview を正本に、playbook のモデル運用基準で関心数を抑えて協議確定する。

---

## 4. 前提事実メモ(キット作成時点 = 2026-06-09)

- **CHANGE 採番**: 023 まで使用済み、**次回 024**。欠番 008 / 009 / 014(再利用不可)。
- **M8 期間着手前に起票・反映済み**(2026-06-08): CHANGE-022 v0.3.0(moves フレーム列 startup / active /
  total / on_hit / on_block + drive_gauge_decrease_guard + is_aerial + setup_only + FR704 CSV 契約定義 +
  取込エンドポイント是正 = fetch-official 廃止 + `/api/import/moves` 新設、機械レビュー指摘 8 件を
  amendment v0.3.0 で反映)/ CHANGE-023 v0.2.0(技名正規化規約 = キャラ固有フレーバー除去・共通技の
  汎用名化 + 取込対象スコープ + 通常投げの位置自動採番、moves スキーマ変更なし)。
- **設計書本体現行版**: REQ-001 v2.15.0 / DES-001 v1.3.0 / DES-002 v1.11.0 / DES-003 v1.17.0 /
  DES-004 v1.5.0 / DES-005 v2.13.0 / DES-006 v1.11.0 / SUPP-001 v1.20.0。
- **補足資料現行版**: design-instruction-playbook v1.9.1 / change-number-registry v1.11.0(次回 024)/
  progress-summary v1.4.2(M0〜M7)/ model-allocation v1.7.0(M8 以降未追記)/ retrospective-log・
  architecture-patterns は現行版(本セッション着手前の追記なし)。
- **フェーズ2 引き継ぎ資料**: phase2-kickoff-design-session-handover v1.0.0(主)/ phase2-e2e-playwright-handover
  v1.0.0(E2E workstream)/ phase2-overview v0.1.0(M8〜M12 正本)/ phase2-kickoff-handover v1.0.0
  (フェーズ1→2 着手・任意)/ phase2-tool-delegation-brief-fr701-importer v1.0.0(M9-01 委任・任意)。
- **マイルストーン位置**(phase2-overview v0.1.0): M8 moves フレームデータ基盤(設計完了、M8-01 製造が次)/
  M9 公式データ取込パイプライン(M9-01 FR701 委任・M9-02 FR704・M9-03 FR703)/ M10 複数キャラ登録 UI /
  M11 custom_states 開始時状態 / M12 先行リリース仕上げ(M12-03 = 統合 E2E + 配布判定)。
- **E2E Playwright workstream**: 未決定。M-RESEARCH(feasibility 実数化)→ 開発者の採否判断 → 採用時に
  DES-002 §12 / SUPP-001 §4.5 の「フェーズ3以降」前倒しを改訂(DES-002 = CHANGE、SUPP-001 = 自由改訂)。
  影響想定: DES-002(CHANGE)/ SUPP-001・phase2-overview・model-allocation(自由改訂)。基盤導入の差し込みは
  M8 後〜M9 前後を目安。緊急度は元 handover では低(queue)だが、開発者方針(2026-06-09)で前倒し検討を先行。

---

## 5. 本キット作成の主な差分(キット作成 = 2026-06-09)

m7-startup-kit(連番キットの本流スパイン構成)+ m9-fr701-importer-startup-kit(§0 位置づけ・§4 前提事実メモの様式)を範に作成。

| 反映 | 内容 |
|------|------|
| 継続設計セッションへの適応 | 連番キット(新マイルストーン overview から起こす)とは異なり、phase2-kickoff 設計セッションを引き継ぐ本流スパイン継続セッションを起動する位置づけに変更(§0 / 冒頭注記)|
| 作業順序の反転(開発者方針 2026-06-09)| 元の 2 引き継ぎ書は「M8-01 優先・E2E は queue」だが、**E2E Playwright 前倒し検討(M-RESEARCH → 採否判断)を先行**させ、その後 M8-01 製造指示書へ入る順序に変更(§0.2 / §2 依頼事項 / §3)|
| E2E workstream の織り込み | phase2-e2e-playwright-handover v1.0.0 を必須投入(#14)に加え、M-RESEARCH・採否判断・前倒し CHANGE・基盤導入タイミング(M8 後〜M9 前後)を §0 / §2 / §3 / §4 に反映 |
| ロール指定の付与 | §2 冒頭にデータモデル/スキーマ設計・API 設計・テスト自動化(E2E / Playwright)設計・状態管理・バリデーション設計に精通したシニアエンジニアのロールと品質姿勢を明記 |
| 主 handover / 読む順序 | C グループ主 handover を phase2-kickoff-design-session-handover.md に設定、「読む順序」参照を同書 §0 起点へ変更 |
| 持ち越し・確定事項 | design-session-handover §2 の確定事項(moves 8 列・FR704 CSV 契約・技名正規化・5 大MS・M12-03 判定)を §0.3 / §2 に要約 |
| CHANGE 起票・設計書改訂事実 | M8 期間着手前に CHANGE-022 / 023 起票、DES-002 v1.11.0 / DES-003 v1.17.0 / DES-004 v1.5.0 / SUPP-001 v1.20.0 反映、次回 024 を反映 |
| progress-summary 対象範囲 | M0〜M7(v1.4.2)へ更新 |
| 直近指示書(任意投入)| M8 / M9 の指示書は未作成のため、テンプレ参照は過去分(M6-03 / M6-04 + レビューチェックリスト)を任意投入に設定 |
| ドキュメント体系について段落 | 恒久情報は B グループ専用ファイルに分離済み・過去資料はアーカイブ済みで要時提示、の定常文へ簡略化 |
