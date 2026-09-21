# M9(公式データ取込パイプライン)起動キット

> 本ファイルは **フェーズ2 本流スパイン継続設計担当(Claude Web 版「設計・指示書作成担当」)チャット**を
> 立ち上げるためのプロンプト本文 + 投入ファイル一覧。流用方法は同フォルダの `README.md` を参照。
>
> **本キットは標準の連番マイルストーンキット(`m4`〜`m7-startup-kit.md`)の系譜だが、特殊事情を含みます。**
> M8(M8-01 moves スキーマ / M8-02 E2E 基盤)は完了済みで、本キットは **M9 公式データ取込パイプライン**の
> 本流スパインを引き継ぎます。ただし **M9-01(FR701 公式フレームデータ取込ツール=別バイナリ)は独立した
> 別ツールとして別チャットで完了済み**のため、本セッションは **M9-02(FR704 アプリ側 CSV 取込)から開始**します
> (`m8-to-m9-handover.md` §0 に明記)。M9-01 の再着手は不要。
>
> **一次資料は引き継ぎ書 `m8-to-m9-handover.md` v1.2.0 です。**
> FR701 ツール由来の本体連携は `fr701-mainline-handover.md` v1.0.0 + `fr701-m9-02-handover-addendum.md` v1.0.0 を参照。

---

## 0. 本キットの位置づけ / 新セッションの作業順序(必読)

### 0.1 時系列

フェーズ1(M0〜M7)完了 → 整理工程(CHANGE-020 / 021)→ フェーズ2 キックオフ設計セッション(M8 設計 =
CHANGE-022 / 023、phase2-overview、FR701 委任ブリーフ)→ フェーズ2 継続設計セッション(**E2E Playwright
前倒し検討 → M8-RESEARCH-01 → CHANGE-024 採用、M8-01 moves スキーマ製造、M8-02 E2E 基盤製造を完遂**)→
コンテキスト移行 → **本キット = M9-02 以降の継続設計セッション**。

M8 の設計・製造は完了・検収済み(M8-01 moves 8 列マイグレーション検収完了、M8-02 E2E 基盤 `make e2e`
通過)。M9-01 FR701 取込ツールは別チャットで完了(本体とは CSV 契約越しに疎結合)。継続セッションが扱うのは
**M9-02(FR704 アプリ取込)以降の本流の設計と指示書化**。

### 0.2 新セッションの作業順序(`m8-to-m9-handover.md` §0 起点)

> M8 は完了済み。M9-01(FR701)は別チャットで完了済み。**本セッションは M9-02(FR704 アプリ取込)から始める。**

1. **最初に M9-02(FR704 アプリ取込)の設計**。`POST /api/import/moves`(DES-002 §4.2)= プレビュー + 行単位
   upsert(upsert キー `(character_id, code)`)。着手前に必ず扱う:
   - **total 算出式の DES-003 §3.3 記載 CHANGE(028)を着手前に起票**(案B = `total = 発生 + 持続 − 1 + 硬直`、
     開発者承認済み。現行プレースホルダ注記を具体化。設計書本体改訂 = CHANGE 通知書必須、**次回採番 028**)。
   - **M8-A4 のアーキテクチャ判断**: `model.Move`(構築箇所ゼロの実質デッドコード)と `repository` の
     `MoveListItem`(GET 経路が実使用する投影型)の二重定義を **正準 move 型へ集約するか判断**(推奨は単一の
     正準型に集約)。M9 でフィールド利用が増えるほど同期漏れリスク増。**実コード(code-facts §1/§7)で確認**してから確定。
   - **combo_scaling キーの追従確認**: 本体の正準キーは `initial_scaling` / `combo_scaling` /
     `immediate_scaling` / `multiplier_scaling`(DES-003 §3.3)。FR701 ツールの旧写像(initial/combo/
     immediate/multiplicative)は不一致 → ツール側が本体定義へ追従済み(addendum §1)。**取込前に追従反映を確認**。
   - **notes パース方針**: ツールは 3 層出力(原文 / `【ツール付記】`境界 / 付記)。パース方針 = `【ツール付記】`で
     2 分割。原文に `; ` を含むと境界が曖昧化する残リスクあり(addendum §2)→ 本体の notes 取扱いを m9-overview で確定。
   - properties 正規化(CHANGE-022 既定、raw_data 退避)/ critical_art 写像(`category=critical_art`, code `ca`)/
     取込対象判別(位置+名称、DI のみ共通システム)。
   - 推奨モデル: 複数システム統合・取込ロジックで関心数中〜大 → **Opus クラス検討** + Plan Mode 必須。

2. **M9-03(FR703 手動修正)**。取込プレビューのグリッド編集、ラッシュ版生成、is_aerial 手動トグル、投げ並び順の
   例外補正、notes 付記の手動編集。M9-02 の取込結果に作用。

3. **M10 複数キャラ登録 UI**(A-1 / A-2、ComboEditor キャラ選択化・リュウ固定 UX 解消、M9 でデータ投入後)/
   **M11 custom_states**(開始時状態 = boolean 中心、消費はコンボ notes 管理でモデル化しない、M8 と独立)/
   **M12 先行リリース仕上げ**(M12-01 UX、M12-02 耐久 seed 除去、**M12-03 統合 E2E + 配布判定**)。
   **先行リリース判定は M12-03**。

4. 各サブユニットの使用モデル(Opus / Sonnet)を難易度を考慮して決め、`model-allocation.md` に追記する
   (M9 以降は未追記)。CLAUDE.md・settings.json は整備済み。

### 0.3 確定事項の継承(`m8-to-m9-handover.md` §2、再協議不要)

- **moves スキーマ(DES-003 §3.3 v1.18.0)**: 8 列追加済み(M8-01 検収完了)。`startup` / `total` は **NULL 可**
  (算出不能行は NULL)。真偽列 `is_aerial` / `setup_only` は物理 `INTEGER NOT NULL DEFAULT 0`(SUPP §2.7。
  論理型は BOOLEAN)。category enum に **`critical_art`** 追加(CA は SA3 と別行)。
- **code 規約(DES-004 §2.1 v1.6.0)**: 英語表示名の機械変換(`standing_medium_punch` 形式、強度接尾辞、slug 連結、
  `_2` フォールバック、SA=`sa1_`〜`sa3_`、CA=`ca`、通常投げ `throw_forward`/`throw_back`、`rush_<元技code>`)。
- **取込対象(DES-002 §7.5 v1.13.0)**: キャラセグメントは非攻撃含め全行、共通システムは **DI のみ**(位置+名称で判別)。
  ターゲットコンボは段数付き行を所属 category で取込。
- **通常投げ**: 1・2 件目 = 前/後ろ投げ自動採番(公式名は notes 退避)、3 件目以降 = 公式名保持・要確認、
  `（ジャンプ中に）`は is_aerial=true。
- **on_hit/on_block + notes 書式**: `D`→空欄+notes、`※N`→数値+notes、範囲→空欄+notes。付記書式 `【ツール付記】…`。
- **recovery 入力パターン**: 整数 / `全体 N` / `着地後N` / `N+着地後M` / `N-着地まで` / `[※2] 1-12` / 空欄(→total NULL)。
- **command/condition**: CSV に 3 列追加、FR704 は **moves.raw_data へ同名キー退避**(専用列なし=マイグレ不要)。
  official_ja_command 接続はフェーズ3以降。
- **seed**: 既存 seed(moves 186 件・characters)は削除・ツール再生成前提。参照 combos/combo_steps/recipe_cache は
  クリア。seed クリア+再生成マイグレは M9 で設計。
- **total 算出式(案B、開発者定義 2026-06-10)**: `total = 発生 + 持続 − 1 + 硬直`。**DES-003 §3.3 への正式記載は
  M9-02 着手前に CHANGE 起票(028)**。
- **E2E**: 段階導入(CHANGE-024)。基盤=M8-02。視覚/レスポンシブ/LAN/実機は手動継続、CI は本フェーズ非構築。

---

## 1. 投入ファイル一覧(開発者用・パス付き)

Web チャットへアップロードするファイル。**必須**は初回投入、**任意**は対話の中で要望が出たとき・
必要になったときに渡す。

> **投入直前の鮮度更新(必須)**: `code-facts.md` は `/regen_code_facts`、`retrospective-digest.md` は
> `/retrospective-digest-update` で **投入直前に再生成し、現行コード/最新教訓と一致させた版を貼る**こと。

### 必須(初回投入)

| # | ファイル名 | リポジトリ上のパス | 種別 |
|---|-----------|------------------|------|
| 1 | requirements.md | `docs/design/requirements.md` | 設計書本体(REQ-001 v2.15.0、§7 = 4 フェーズ定義・FR701〜704) |
| 2 | 01-tech-stack.md | `docs/design/01-tech-stack.md` | 設計書本体(DES-001 v1.3.0) |
| 3 | 02-architecture.md | `docs/design/02-architecture.md` | 設計書本体(DES-002 v1.13.0。§4.2 取込エンドポイント・§7.5 CSV 契約/取込対象・§12 E2E 段階導入) |
| 4 | 03-data-model.md | `docs/design/03-data-model.md` | 設計書本体(DES-003 v1.18.0。§3.3 moves スキーマ・combo_scaling キー・total/startup NULL 可・raw_data 退避) |
| 5 | 04-notation-spec.md | `docs/design/04-notation-spec.md` | 設計書本体(DES-004 v1.6.0。§2.1 code 規約) |
| 6 | 05-screen-design.md | `docs/design/05-screen-design.md` | 設計書本体(DES-005 v2.13.0) |
| 7 | 06-validation.md | `docs/design/06-validation.md` | 設計書本体(DES-006 v1.11.0) |
| 8 | supp-001-detailed-design.md | `docs/design/supp-001-detailed-design.md` | 設計補足(SUPP-001 v1.24.0。§2.7 真偽列規約・§3.3.2 seed 境界・§4.5 E2E 実装メモ) |
| 9 | design-instruction-playbook.md | `docs/handover/design-instruction-playbook.md` | 運用ルール集(v1.9.1。最初に読む。§1 役割境界・§2 指示書テンプレ・§16 CHANGE 手順) |
| 10 | retrospective-digest.md | `docs/handover/retrospective-digest.md` | **設計担当ミス蒸留版**(現役教訓のみ。指示書執筆前に必読。投入直前に `/retrospective-digest-update` で再蒸留) |
| 11 | code-facts.md | `docs/handover/code-facts.md` | **機械的事実の参照元**(Props・queryKey・フロントルート・Go ルート↔ハンドラ・config・ナビ。投入直前に `/regen_code_facts` で再生成) |
| 12 | architecture-patterns.md | `docs/handover/architecture-patterns.md` | 確立アーキテクチャパターン(現行版。§2.1 サービス層 IF・§9 custom_states / recipe_cache) |
| 13 | change-number-registry.md | `docs/handover/change-number-registry.md` | CHANGE 番号運用(**次回採番 028**。欠番 008 / 009 / 014) |
| 14 | m8-to-m9-handover.md | `docs/handover/m8-to-m9-handover.md` | **主引き継ぎ書**(v1.2.0。最初に読む。§0 開始点・§2 確定事項・§3 M9-02 設計入力・§6 申し送り) |
| 15 | fr701-mainline-handover.md | `docs/handover/fr701-mainline-handover.md` | FR701 ツール → 本体への申し送り(v1.0.0。CSV 契約・CHANGE-025/026/027 の根拠) |
| 16 | fr701-m9-02-handover-addendum.md | `docs/handover/fr701-m9-02-handover-addendum.md` | FR701 製造工程発・M9-02 向け追加申し送り(v1.0.0。§1 combo_scaling キー・§2 notes パース・§3 フレーバー母集団) |
| 17 | phase2-overview.md | `docs/instructions/phase2-overview.md` | フェーズ2 マイルストーン分割の正本(v0.2.0、M8〜M12。M8-02 追加済み。必読) |
| 18 | CHANGE-024〜027 通知書 | `docs/change-notes/CHANGE-024〜027-*.md` | M8 期間の確定根拠(024 E2E 前倒し / 025 スキーマ・enum・seed / 026 取込スコープ / 027 CSV 契約拡張) |
| 19 | progress-summary.md | `docs/progress/progress-summary.md` | 進捗要約 M0〜M7(v1.4.2。**M8 期間は未要約** = §8 持ち越し要約) |
| 20 | model-allocation.md | `docs/human-notes/model-allocation.md` | モデル配分(v1.9.0。**M9 以降未追記**、各サブユニット着手時に追記する) |
| 21 | CLAUDE.md | `CLAUDE.md`(リポジトリルート) | 製造担当向け指針(設計担当も一読) |

> **retrospective-log.md は起動時に投入しない**(起動時の必読は #10 digest)。ただし **retrospective-log の
> 更新責任は設計担当(本 Web 版)にある**——マイルストーン完了時に当該期間のミス・教訓を本書へ追記する。
> よって **更新が必要になったとき、または事例の事実関係・経緯(§6.6.1 M8 期間等)を遡る必要が出たときに、
> 開発者へ投入を要求して読む/追記する**。digest(#10)は設計担当にとって **読み取り専用** で、その更新は
> Claude Code が `/retrospective-digest-update` で行う(設計担当は digest を直接編集しない)。

### 任意(対話の中で要望が出たとき・必要になったときに投入)

| ファイル名 | パス | 渡すタイミング |
|-----------|------|--------------|
| testid-convention.md | `docs/design/testid-convention.md` | E2E spec を M9〜M12 機能に相乗りで拡充するとき(test-id 正本・補足同格) |
| retrospective-log.md | `docs/handover/retrospective-log.md` | **設計担当が更新責任を持つ**(マイルストーン完了時の教訓追記)。**更新が必要になったとき**、または digest だけでは足りず過去ミスの事実関係・経緯(§6.6.1 M8 期間等)を遡るときに投入する |
| phase2-kickoff-handover.md | `docs/handover/phase2-kickoff-handover.md` | フェーズ1→2 着手の文脈(v1.0.0)。フェーズ2 全体の作業順序や持ち越し全体像を遡るとき |
| phase2-tool-delegation-brief-fr701-importer.md | `docs/instructions/phase2-tool-delegation-brief-fr701-importer.md` | M9-01 FR701 委任(別チャット)の文脈把握。本体側 CSV 取込が委任側 CSV 契約とどう接続するか確認するとき |
| 過去の指示書テンプレート(M8-01 / M8-02 + 各レビューチェックリスト) | `docs/instructions/` ・ `docs/instructions/reviews/` | 指示書テンプレート参照用(M9 の指示書は未作成のため、直近完成版の M8-01 / M8-02 を参照) |
| progress-log.md | `docs/progress/progress-log.md` | progress-summary.md で足りず、M1〜M8 の詳細(curl 出力・E2E 等)が必要になったとき |
| アーカイブ handover(handover_1 / m1-to-m2 〜 m7-phase1-completion 等) | `docs/handover/archive/` | 基本設計時点の前提や M1〜M7 期・整理工程の細部を遡る必要が出たとき |
| CHANGE 通知書(過去分 020 / 021 / 022 / 023 等) | `docs/change-notes/` | 設計変更の経緯を遡る必要が出たとき |

> M8 継続セッションからの変更点: 主 handover が `m8-to-m9-handover.md`(#14)に進捗し、FR701 引き継ぎ 2 本
> (#15 / #16)が加わった。設計書本体は M8 期間に **DES-002 v1.11.0 → v1.13.0 / DES-003 v1.17.0 → v1.18.0 /
> DES-004 v1.5.0 → v1.6.0**(CHANGE-024〜027)、**SUPP-001 v1.20.0 → v1.24.0** に改訂。`change-number-registry`
> 次回 028。REQ-001 v2.15.0 / DES-001 v1.3.0 / DES-005 v2.13.0 / DES-006 v1.11.0 / playbook v1.9.1 は据置。
> retrospective-log は起動時必読から外し digest(#10)を起動時必読化(log の更新責任は設計担当に残す)、code-facts(#11)を必須投入に追加。

---

## 2. 最初のプロンプト(コピペ用)

```text
私はストリートファイター6(以下 SF6)のコンボを効率的に管理・比較・共有するための Web アプリケーションを個人開発中のエンジニアです。本体アプリは Go(modernc.org/sqlite)+ Echo + React + TypeScript の単一バイナリ配布です。

あなたは、データモデル・スキーマ設計、API 設計、データ変換(公式 HTML 由来 CSV の取込・正規化)、状態管理、バリデーション設計、テスト自動化(E2E / Playwright)に精通したシニアソフトウェアエンジニアです。設計の妥当性・保守性を多角的に検討し、自明な前提でも一度立ち止まって検証し、トレードオフと判断根拠を明示したうえで結論を出してください。不確かな点は推測で埋めず確認事項として挙げ、品質に妥協しないでください。その立場で「詳細設計・製造準備担当」(設計・指示書作成担当)として私の作業を支援してください。

現在、要件定義・基本設計は完了済みで、フェーズ1(MVP、M0〜M7)も完了しています。フェーズ2「先行リリース準備」では、M8(moves フレームデータ基盤)の設計・製造が完了しました(M8-01 = moves 8 列追加マイグレーション検収完了、M8-02 = E2E Playwright 基盤 `make e2e` 通過)。あなたはその M8 完了状態を引き継ぐ、フェーズ2 本流スパインの継続設計担当です。

重要な特殊事情: M9 の最初のサブユニット M9-01(FR701 公式フレームデータ取込ツール = 別バイナリ)は、独立した別ツールとして別チャットの専任設計担当が完了済みです。本体とは CSV 契約越しに疎結合で、FR701 由来の本体連携は CHANGE-025/026/027 で反映済みです。したがって、あなたが担う本流スパインは M9-02(FR704 アプリ側 CSV 取込)から開始します。M9-01 の再着手は不要です。

あなたの役割は design-instruction-playbook.md §1 に定義された「設計担当 Claude」です。製造担当 Claude Code・レビュー担当 Claude Code とは別セッションで、Claude Code への指示書とレビューチェックリストの作成、製造担当・レビュー担当からの Q&A 対応、CHANGE 通知書の起票、handover / playbook の改訂提案を担います。

まずこれまでの工程で完成したドキュメントを渡します。ファイル名:簡単な概要を記載しています。
読む順序は m8-to-m9-handover.md §0「新セッション開始時の最優先作業」を起点にしてください(まず design-instruction-playbook.md と m8-to-m9-handover.md を読むと全体構造が掴め、続いて phase2-overview.md と FR701 引き継ぎ 2 本で M9-02 取込の前提が把握できます)。

A. 設計書本体(プロジェクト恒久・真の情報源)
  requirements.md:要件定義(REQ-001 v2.15.0、§7 = 4 フェーズ定義・FR701〜704)
  01-tech-stack.md:技術スタック(DES-001 v1.3.0)
  02-architecture.md:アーキテクチャ(DES-002 v1.13.0。§4.2 取込エンドポイント・§7.5 CSV 契約/取込対象・§12 E2E 段階導入)
  03-data-model.md:データモデル(DES-003 v1.18.0。§3.3 moves スキーマ・combo_scaling キー・total/startup NULL 可・raw_data 退避)
  04-notation-spec.md:内部表現仕様(DES-004 v1.6.0。§2.1 code 規約)
  05-screen-design.md:画面設計(DES-005 v2.13.0)
  06-validation.md:バリデーション(DES-006 v1.11.0)
  supp-001-detailed-design.md:設計補足・運用ルール(SUPP-001 v1.24.0。§2.7 真偽列規約・§3.3.2 seed 境界・§4.5 E2E 実装メモ)

B. 設計担当の恒久資料(運用ルール・反省・パターン・機械的事実)
  design-instruction-playbook.md:プロジェクト恒久の開発スタイル・運用ルール集(設計担当専用、最初に読む、v1.9.1)
  retrospective-digest.md:設計担当ミスの蒸留版(現役教訓のみ。指示書執筆前に毎回読む。投入直前に再蒸留した最新版)
  code-facts.md:実コードの機械的事実(Props・queryKey・フロントルート・Go ルート↔ハンドラ・config・ナビ。想定で書かず必ず引く。投入直前に再生成した最新版)
  architecture-patterns.md:確立済みの実装アーキテクチャパターン(現行版。§2.1 サービス層 IF・§9 custom_states / recipe_cache)
  change-number-registry.md:CHANGE 通知書の採番状態(次番号の確認用、次回 028 から。欠番 008 / 009 / 014)

C. フェーズ2 M9 引き継ぎ(本セッション固有・差分情報)
  m8-to-m9-handover.md:主引き継ぎ書(v1.2.0。§0 開始点 = M9-02 から・§2 確定事項・§3 M9-02 設計入力・§6 申し送り)
  fr701-mainline-handover.md:FR701 ツール → 本体への申し送り(v1.0.0。CSV 契約・CHANGE-025/026/027 の根拠)
  fr701-m9-02-handover-addendum.md:FR701 製造工程発の追加申し送り(v1.0.0。combo_scaling キー突合・notes パース・フレーバー母集団)
  phase2-overview.md:フェーズ2 マイルストーン分割の正本(v0.2.0、M8〜M12)
  CHANGE-024 / 025 / 026 / 027 通知書:M8 期間の確定根拠(E2E 前倒し / スキーマ・enum・seed / 取込スコープ / CSV 契約拡張)

D. 進捗・配分
  progress-summary.md:製造工程の進捗要約(M0〜M7、v1.4.2。M8 期間は未要約 = §8 持ち越し)。詳細が要るなら progress-log.md を別途渡します
  model-allocation.md:モデル配分リファレンス(v1.9.0、M9 以降未追記。各サブユニット着手時に追記する)

E. プロジェクト指針
  CLAUDE.md:製造担当 Claude Code 向けのプロジェクト指針。設計担当も概要把握のため一読してください

あなたへの依頼事項(playbook §1 の設計担当の責任範囲)と作業順序:

1. M9-02(FR704 アプリ側 CSV 取込)の設計に着手する。POST /api/import/moves = プレビュー + 行単位 upsert(キー (character_id, code))。着手前に必ず扱う事項 =
   (a) total 算出式の DES-003 §3.3 記載 CHANGE(028)を着手前に起票(案B = total = 発生 + 持続 − 1 + 硬直、開発者承認済み。設計書本体改訂 = CHANGE 必須、次回 028)、
   (b) M8-A4 のアーキテクチャ判断 = model.Move(実質デッドコード)と repository.MoveListItem(GET 経路の実使用投影型)の二重定義を正準 move 型へ集約するか(実コード = code-facts §1/§7 で確認)、
   (c) combo_scaling 正準キー(initial_scaling / combo_scaling / immediate_scaling / multiplier_scaling)へのツール側追従反映を取込前に確認(addendum §1)、
   (d) notes パース方針(【ツール付記】で 2 分割、原文の '; ' 残リスク。addendum §2)を m9-overview で確定、
   (e) properties 正規化・critical_art 写像・取込対象判別・seed 再生成マイグレ。
   推奨モデルは関心数中〜大のため Opus クラスを検討、Plan Mode 必須。
2. M9-03(FR703 手動修正・グリッド編集・ラッシュ版生成・is_aerial トグル・投げ並び補正)を M9-02 の取込結果に作用する形で設計する。
3. M10 複数キャラ登録 UI(A-1 / A-2)/ M11 custom_states 開始時状態 / M12 先行リリース仕上げ(M12-03 = 統合 E2E + 配布判定)の指示書を順次。
4. 各サブユニットの使用モデル(Opus / Sonnet)を難易度を考慮して決め、model-allocation.md に追記する(M9 以降は未追記)。CLAUDE.md・settings.json は整備済み。改訂が要れば改訂支援を行う。

製造工程の現在地:
- M0〜M7(フェーズ1)は実装完了・E2E 動作確認済み・開発者承認済み。
- M8 は完了。M8-01(moves 8 列追加マイグレーション)検収完了、M8-02(E2E Playwright 基盤)`make e2e` 通過。M8 期間に CHANGE-024(E2E 前倒し・段階導入)・025(FR701 実データ反映訂正① スキーマ/enum/seed)・026(② 取込スコープ)・027(③ CSV 契約拡張)を起票・反映。次回 CHANGE 採番は 028。
- M9-01(FR701 取込ツール)は別チャットで完了。本体連携は CSV 契約(DES-002 §7.5)+ CHANGE-025/026/027 + FR701 引き継ぎ 2 本で反映済み。
- 確定事項(再協議不要、m8-to-m9-handover.md §2): moves 8 列・真偽列物理表現(INTEGER NOT NULL DEFAULT 0)・critical_art enum・code 規約・取込対象スコープ・通常投げ採番・on_hit/on_block 書式・recovery パターン・seed 再生成前提・total 算出式案B・E2E 段階導入。

ドキュメント体系について:恒久情報(反省 = retrospective-digest、機械的事実 = code-facts、アーキテクチャパターン、CHANGE 番号運用)は B グループの専用ファイルに分離済みです。過去の引き継ぎ資料・設計変更通知書の過去成果物はアーカイブ済みで、要るときに提示します。retrospective-log 本体は起動時には投入していません(起動時の必読は retrospective-digest)。ただし retrospective-log の更新責任はあなた(設計担当)にあります — マイルストーン完了時に当該期間のミス・教訓を追記してください。更新が必要になったとき、または事例の事実関係を遡るときに私へ要求すれば投入します。digest は読み取り専用で、その更新は Claude Code が /retrospective-digest-update で行います。

まずは添付のファイルを読み込み、作業を理解してください。読み込みに失敗したファイルは連絡してください、再送します。不足しているとみられる資料や、プロジェクトに対する質問は受け付けます。理解後、まず M9-02 着手前の確認事項リスト(上記 (a)〜(e)、特に total 式 CHANGE-028 の起票と M8-A4 集約判断)を提案してください。
```

---

## 3. 補足(対話の進め方)

- 流れ: 最初のプロンプト + A〜E のファイルを投入 → 設計担当の読み込み・確認事項提示 →
  **(1) M9-02 着手前確認(total 式 CHANGE-028 起票・M8-A4 集約判断・combo_scaling 追従確認・notes パース方針)** →
  **(2) M9-02 FR704 取込の製造指示書** → M9-03 → M10 / M11 / M12、という流れ。
- **M9-02 着手前に total 式 CHANGE-028 を起票する**(案B 既定、開発者承認済みの式を DES-003 §3.3 へ正式記載)。
- **M8-A4(model.Move 集約)は M9-02 のアーキテクチャ判断として必ず扱う**(推奨 = 単一の正準 move 型へ集約。
  実コードが見える M9-02 で確定。retrospective-digest §1 A「実装済み前提は code-facts で裏取り」を踏まえる)。
- **M9-01 FR701 取込ツールは別チャットで完了済み**。本流スパインの設計担当は本体側(FR704 / FR703)を扱い、
  委任側 CSV 契約・combo_scaling キー追従との整合に留意する(取込前に追従反映を確認)。
- **CHANGE 二層運用**: 設計書本体(REQ-001 / DES-001〜006)改訂は CHANGE 通知書必須(次回 028)。
  補足資料(SUPP-001 / handover / playbook / registry / progress / architecture-patterns / phase2-overview /
  model-allocation / retrospective-digest)は自由改訂。
- **指示書執筆前に retrospective-digest を必読**。とくに §1 A(実コード確認の省略 = 論理型≠物理宣言・実ルート≠
  DES §4.2 代表例)は M8-1 / M8-2 で継続したパターン。M9-02 着手時は DES-003 §3.3 の実 JSON キー・既存実装慣例・
  実ルートを **code-facts / view で確認**してから指示書化すること。
- 「任意」ファイル(testid-convention、retrospective-log、phase2-kickoff-handover、FR701 委任ブリーフ、過去指示書
  テンプレ、progress-log、アーカイブ handover、過去 CHANGE 通知書)は設計担当から要望が出たとき、または次チャットで渡す。
- 各サブユニットの粒度・統合は phase2-overview を正本に、playbook のモデル運用基準で関心数を抑えて協議確定する。

---

## 4. 前提事実メモ(キット作成時点 = 2026-06-13)

- **CHANGE 採番**: 027 まで使用済み、**次回 028**。欠番 008 / 009 / 014(再利用不可)。028 最有力 =
  total 算出式の DES-003 §3.3 記載(M9-02 着手前)。
- **M8 期間に起票・反映済み**: CHANGE-024(E2E Playwright 前倒し・段階導入、DES-002 §12 v1.13.0 / SUPP §4.5)/
  025(FR701 実データ反映訂正① = startup/total NULL 可化 + critical_art enum + code 規約英語機械変換 + seed 再生成
  前提化)/ 026(② 取込対象をキャラセグメント全行へ・DI 判別位置+名称・通常投げ 3 件目以降・on_hit/on_block 書式・
  recovery パターン)/ 027(③ CSV 契約に command/condition 3 列追加・raw_data 退避)。
- **設計書本体現行版**: REQ-001 v2.15.0 / DES-001 v1.3.0 / DES-002 v1.13.0 / DES-003 v1.18.0 /
  DES-004 v1.6.0 / DES-005 v2.13.0 / DES-006 v1.11.0 / SUPP-001 v1.24.0。
- **補足資料現行版**: design-instruction-playbook v1.9.1 / change-number-registry(次回 028)/
  progress-summary v1.4.2(**M0〜M7、M8 期間は未要約**)/ model-allocation v1.9.0(**M9 以降未追記**)/
  retrospective-log v1.0.30(§6.6.1 M8 期間記録済み)/ retrospective-digest・code-facts・architecture-patterns
  は現行版(投入直前に digest / code-facts を再生成する)。
- **M9 引き継ぎ資料**: m8-to-m9-handover v1.2.0(主)/ fr701-mainline-handover v1.0.0 / fr701-m9-02-handover-addendum
  v1.0.0 / phase2-overview v0.2.0(M8〜M12 正本)/ CHANGE-024〜027 通知書 + change-report。
- **マイルストーン位置**(phase2-overview v0.2.0): M8 moves フレームデータ基盤(完了)/ M9 公式データ取込パイプライン
  (M9-01 FR701 別チャット完了・**M9-02 FR704 が次の本流**・M9-03 FR703)/ M10 複数キャラ登録 UI /
  M11 custom_states 開始時状態 / M12 先行リリース仕上げ(M12-03 = 統合 E2E + 配布判定)。
- **新規正本**: `docs/design/testid-convention.md`(test-id 規約、補足資料同格・自由改訂。M8-02 で新設、E2E spec 拡充の参照元)。

---

## 5. 本キット作成の主な差分(キット作成 = 2026-06-13)

`phase2-continuation-startup-kit`(M8 を担った本流スパイン継続キット)を範に作成。M8 完了 → M9-02 起点へ書き換え。

| 反映 | 内容 |
|------|------|
| M9-02 起点化 | M8(M8-01 / M8-02)完了・M9-01 FR701 別チャット完了を踏まえ、§0 作業順序を **M9-02(FR704 取込)起点**へ全面書き換え。前キットの E2E 前倒し検討・M8-01 製造指示書(完了済み)を削除 |
| 主 handover / 読む順序 | C グループ主 handover を `m8-to-m9-handover.md` v1.2.0 に設定、「読む順序」参照を同書 §0 起点へ変更 |
| FR701 引き継ぎ 2 本の追加 | `fr701-mainline-handover.md` v1.0.0 + `fr701-m9-02-handover-addendum.md` v1.0.0 を必須投入(#15 / #16)に追加(M9-02 取込の本体連携 = combo_scaling キー・notes パース・フレーバー母集団) |
| 持ち越し・確定事項 | handover §2 の確定事項(moves 8 列・真偽列物理表現・critical_art・code 規約・取込対象・total 式案B・E2E 段階導入)を §0.3 / §2 に要約。§3/§6 の M9-02 設計入力(total 式 CHANGE-028・M8-A4 集約・combo_scaling 追従・notes パース)を反映 |
| CHANGE 起票・設計書改訂事実 | M8 期間に CHANGE-024〜027 起票・反映、DES-002 v1.13.0 / DES-003 v1.18.0 / DES-004 v1.6.0 / SUPP-001 v1.24.0、次回 028 を反映 |
| 投入資料に code-facts / digest を追加 | retrospective-log は **起動時必読から外す(任意のまま・更新責任は設計担当に残す)** + 起動時必読を `retrospective-digest.md`(#10、設計担当には読み取り専用)に変更。`code-facts.md`(#11)を必須投入に追加。digest / code-facts は投入直前に再生成する注記を付与 |
| ロール指定 | §2 冒頭にデータモデル/スキーマ設計・API 設計・**データ変換(公式 HTML 由来 CSV 取込・正規化)**・状態管理・バリデーション設計・テスト自動化に精通したシニアエンジニアのロールと品質姿勢を明記 |
| progress-summary 対象範囲 | M0〜M7(v1.4.2)。**M8 期間は未要約**である旨を明示 |
| 直近指示書(任意投入) | M9 の指示書は未作成のため、テンプレ参照は直近完成版の M8-01 / M8-02 + レビューチェックリストを任意投入に設定 |
| ドキュメント体系について段落 | 恒久情報は B グループ専用ファイルに分離済み・過去資料はアーカイブ済みで要時提示、の定常文を維持(digest / code-facts / retrospective-log の役割分担を追記) |

---

## 6. 改訂履歴

| 日付 | 内容 |
|------|------|
| 2026-06-13 | M8 完了 → M9-02 着手に伴い `m9-startup-kit.md` を `phase2-continuation-startup-kit.md` から流用作成(`/next_milestone_kit`、特殊指示 = M9-01 別ツール完了のため M9-02 起点)。CHANGE-024〜027 反映・DES-002 v1.13.0 / DES-003 v1.18.0 / DES-004 v1.6.0 / SUPP-001 v1.24.0 / 次回 028。主 handover = m8-to-m9-handover v1.2.0、FR701 引き継ぎ 2 本を必須投入に追加。retrospective-log は起動時必読から外し(任意のまま・更新責任は設計担当に残す)digest を起動時必読化 + code-facts を必須投入に追加(投入直前に再生成)。M9-02 設計入力(total 式 CHANGE-028・M8-A4 集約・combo_scaling 追従・notes パース)を §0 に反映 |
