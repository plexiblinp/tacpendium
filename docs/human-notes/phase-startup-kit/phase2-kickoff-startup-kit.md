# フェーズ2「先行リリース準備」キックオフ担当チャット 起動キット

> 本ファイルは **フェーズ2「先行リリース準備」キックオフ担当チャット**(Claude Web 版「設計・指示書
> 作成担当」)を立ち上げるためのプロンプト本文 + 投入ファイル一覧。流用方法は同フォルダの
> `README.md` を参照。
>
> **本キットはフェーズ単位のキックオフ用です。** マイルストーン連番キット
> (`docs/human-notes/milestone-startup-kit/m{N}-startup-kit.md`)が単一マイルストーンの指示書作成を
> 目的とするのに対し、本キットは **新フェーズの立ち上げ = フェーズ全体のマイルストーン分割策定
> (phase2-overview ドラフト)** を最初の仕事とします。
>
> **本キットは `/next_phase_kit` 初回実行の bootstrap 生成物です。** 前フェーズのキックオフ kit が
> 存在しないため、最新の `m7-startup-kit.md` 構造 + `milestone-startup-kit/phase1-completion-restructure-startup-kit.md`
> を範に、一次資料 `docs/handover/phase2-kickoff-handover.md` の事実で具体化しています。

---

## 0. 本工程の位置づけ(必読)

- 時系列は **フェーズ1(M0〜M7)完了 → 整理工程(スケジュール再設定 + フェーズ番号再設定 = CHANGE-020 / 021)完了 → フェーズ2 着手**。
- 一次資料は `docs/handover/phase2-kickoff-handover.md`(整理工程担当作成、v1.0.0)。設計書バージョン・
  持ち越し課題・読む順序・推奨マイルストーン分割が集約済み。
- 持ち越し課題の **逐条正本** は `docs/handover/archive/m7-phase1-completion-handover.md` の第2層カタログ
  (`[フェーズ2]` タグ項目)。本工程はそのうちフェーズ2 着手に必要な範囲を扱う。
- **キックオフ担当の最初の仕事 = phase2-overview ドラフト(M8 以降のマイルストーン分割策定)**。
  コンテキストに余力があれば、そのまま序盤マイルストーン(M8 = moves スキーマ見直し見込み)に着手してよい。
- マイルストーン番号は **M8 以降の連番を継続**(開発者方針 2026-06-07)。フェーズ番号(1〜4)と
  マイルストーン番号(M0〜)は別軸。
- **実施環境と分担**: 本工程は Claude Web 版の設計担当チャットで実施。設計書本体を含む資料はそのまま
  投入し、Web 版が必要に応じて改訂(設計書本体の改訂は CHANGE 通知書を伴う)、開発者がコミットする。

---

## 1. 投入ファイル一覧(Web チャットへアップロード)

> **必須**は初回投入、**任意**は対話の中で必要になったら渡す。読む順序は §2 のプロンプト本文 +
> 一次資料 `phase2-kickoff-handover.md §7.4` に従う。

### A. 設計書本体(必須・プロジェクト恒久・真の情報源)

| # | ファイル | パス | 種別(キット作成時点) |
|---|---------|------|---------------------|
| 1 | requirements.md | `docs/design/requirements.md` | REQ-001(v2.15.0、**§7 = 4 フェーズ定義の正本**、CHANGE-020 / 021 反映済み) |
| 2 | 01-tech-stack.md | `docs/design/01-tech-stack.md` | DES-001(v1.3.0) |
| 3 | 02-architecture.md | `docs/design/02-architecture.md` | DES-002(v1.9.0) |
| 4 | 03-data-model.md | `docs/design/03-data-model.md` | DES-003(v1.16.0、**moves / combos 現行スキーマ = 見直しの出発点**) |
| 5 | 04-notation-spec.md | `docs/design/04-notation-spec.md` | DES-004(v1.4.0) |
| 6 | 05-screen-design.md | `docs/design/05-screen-design.md` | DES-005(v2.13.0) |
| 7 | 06-validation.md | `docs/design/06-validation.md` | DES-006(v1.11.0) |
| 8 | supp-001-detailed-design.md | `docs/design/supp-001-detailed-design.md` | SUPP-001(v1.19.0、§3.1 キャラスコープ / §4.3 取込ツール / §7 recipe_cache 再計算) |

### B. 設計担当の恒久資料(必須・運用ルール・反省・パターン)

| # | ファイル | パス | 目的 |
|---|---------|------|------|
| 9 | design-instruction-playbook.md | `docs/handover/design-instruction-playbook.md` | 設計担当の役割定義(§1)・運用ルール集(v1.9.1、最初に読む) |
| 10 | retrospective-log.md | `docs/handover/retrospective-log.md` | 設計担当が全期間で犯した指示書ミスの累積記録(大容量 ~300KB) |
| 11 | architecture-patterns.md | `docs/handover/architecture-patterns.md` | 確立済み実装アーキテクチャパターン(v1.0.15、§9 = custom_states / recipe_cache の前提) |
| 12 | change-number-registry.md | `docs/handover/change-number-registry.md` | CHANGE 採番状態(v1.9.0、**次回 022 から**。欠番 008 / 009 / 014) |

### C. フェーズ2 キックオフ固有(必須・差分情報)

| # | ファイル | パス | 目的 |
|---|---------|------|------|
| 13 | phase2-kickoff-handover.md | `docs/handover/phase2-kickoff-handover.md` | **一次資料**。フェーズ2 着手の現在地・主要決定・推奨マイルストーン分割・持ち越し・読む順序(v1.0.0) |
| 14 | m7-phase1-completion-handover.md | `docs/handover/archive/m7-phase1-completion-handover.md` | **持ち越し逐条正本**(第2層カタログの `[フェーズ2]` タグ項目)。フェーズ1 完了状態 |

### D. 進捗・配分(必須)

| # | ファイル | パス | 目的 |
|---|---------|------|------|
| 15 | progress-summary.md | `docs/progress/progress-summary.md` | 製造進捗要約 M0〜M7(v1.4.1、§8 = 持ち越し要約)。詳細が要れば progress-log.md を別途 |
| 16 | model-allocation.md | `docs/human-notes/model-allocation.md` | モデル配分リファレンス(フェーズ2 着手時に追記する) |

### E. プロジェクト指針(必須)

| # | ファイル | パス | 目的 |
|---|---------|------|------|
| 17 | CLAUDE.md | `CLAUDE.md`(リポジトリルート) | 製造担当 Claude Code 向け指針。設計担当も編集境界(§8)・禁止事項(§10)の確認のため一読 |

### 任意(対話の中で必要になったら投入)

| ファイル | パス | 渡すタイミング |
|---------|------|--------------|
| CHANGE-020 / 021 通知書 + change-report-020 / 021 | `docs/change-notes/` ・ `docs/progress/` | フェーズ番号再設定の経緯を遡るとき |
| progress-log.md | `docs/progress/progress-log.md` | M0〜M7 の詳細(curl 出力・E2E 等)が要るとき(大容量、抜粋投入可) |
| archive の旧 handover 群 | `docs/handover/archive/` | M1〜M7 期の細部を遡るとき(`m6-to-m7-handover.md` 等) |
| 直近指示書 + レビューチェックリスト | `docs/instructions/` ・ `docs/instructions/reviews/` | 指示書テンプレート参照用。phase2-overview 確定後、最初のサブマイルストーン指示書作成時 |
| CHANGE 通知書(過去分) | `docs/change-notes/` | 設計変更の経緯・フォーマットを遡るとき |

---

## 2. 最初のプロンプト(コピペ用)

```text
私はストリートファイター6(以下 SF6)のコンボを効率的に管理・比較・共有するための Web アプリケーションを個人開発中のエンジニアです。
あなたは「詳細設計・製造準備担当」(設計・指示書作成担当)として私の作業を支援してください。

【現在地】
要件定義・基本設計は完了済みです。製造工程はフェーズ・マイルストーンに分割して進めています。
フェーズ1(MVP、M0〜M7)は完了済み(go test ./... / pnpm test 435 全パス、スキーマ変更なし)。
その後の整理工程で作業スケジュールとフェーズ番号を再設定しました(3 フェーズ → 4 フェーズ、CHANGE-020 / 021 起票・反映済み)。CHANGE は 021 まで使用済みで、次回採番は 022 からです。
これから新フェーズ「フェーズ2(先行リリース準備)」を立ち上げます。あなたにはフェーズ2 のキックオフから作業を引き継いでいただきます。

【あなたの役割】
あなたの役割は design-instruction-playbook.md §1 に定義された「設計担当 Claude」です。製造担当 Claude Code・レビュー担当 Claude Code とは別セッションで、Claude Code への指示書とレビューチェックリストの作成、Q&A 対応、CHANGE 通知書の起票、handover / playbook の改訂提案を担います。

【フェーズ2 のゴール】
先行リリース可能な状態にすること = 複数キャラ(クラシック操作 5 体)が UI から登録・閲覧でき、moves が正式スキーマで入り、custom_states が機能する、その上で近しい関係者へ提供し反応を見つつ並行開発する。詳細は REQ-001 §7(4 フェーズ定義の正本)と phase2-kickoff-handover.md を参照してください。

【あなたの最初の仕事】
1. phase2-overview ドラフトの作成 = M8 以降のマイルストーン分割策定。phase2-kickoff-handover.md §3(推奨マイルストーン分割 M8〜M14)を起点に、粒度・統合・先行リリースのタイミングを判断して独自構成してください。マイルストーン番号は M8 以降の連番を継続します。
2. コンテキストに余力があれば、そのまま M8(moves スキーマ見直し = 発生 / 持続 / 硬直 + 硬直差)に着手してよいです。M8 は DES-003 改訂を伴う CHANGE 起票見込みで、後続(取込ツール・CSV 取込・登録 UI)がすべて依存するフェーズ2 のゲートです。最初に固めてください。

【最初に読む順序】(phase2-kickoff-handover.md §7.4 準拠)
1. phase2-kickoff-handover.md(一次資料。フェーズ2 着手の現在地・主要決定・推奨分割・持ち越し)
2. REQ-001 §7(4 フェーズ定義 = フェーズ2 スコープの正本)+ FR701〜704 / FR105 系
3. m7-phase1-completion-handover.md 第2層カタログ([フェーズ2] タグ = 持ち越し逐条正本)
4. progress-summary.md §8(持ち越し要約)
5. SUPP-001 §3.1(キャラスコープ)/ §4.3(取込ツール)/ §7(recipe_cache 再計算)
6. architecture-patterns.md §9(custom_states / recipe_cache の前提)
7. DES-003(moves / combos の現行スキーマ = 見直しの出発点)
8. 必要に応じて change-number-registry.md / design-instruction-playbook.md / retrospective-log.md

【着手前に私(開発者)へ確認すべき事項】(phase2-kickoff-handover.md §7.3)
- moves スキーマの具体仕様: 発生 / 持続 / 硬直 + 硬直差の正確な定義・データ型・必須性(格ゲー知識前提)
- 先行リリース対象キャラの custom_states 挙動: ヴァイパー(SA 強化)/ イングリッド(チャージストック)/ リュウ電刃 の消費・表示・使用可能技の変化
- 先行リリースのタイミング / 基準(どのマイルストーン到達で近しい関係者へ配布するか)
- 「ゲームテーブル不要・別PJ化」メモ(NFR407 矛盾)の扱い方針
- A-3 の seed 整理方針: migration 000012 耐久 seed を残すか、無効化マイグレーションを切るか

【厳守する制約】
- 提案 → 私の承認 → 改訂 / 起票、の順で進める。承認前に資料を改訂しない。
- Git 操作(commit / push 等)は私が行う(あなたは改訂結果・指示書を提示するまで)。
- 設計書本体(REQ-001 / DES-001〜006)の改訂は CHANGE 通知書(次回 022)を起票したうえで該当箇所を改訂する(CLAUDE.md §8)。補足資料(handover / retrospective-log / architecture-patterns / SUPP-001 / playbook / progress 系)は CHANGE 不要・自由改訂。
- CLAUDE.md の編集境界(§8)・禁止事項(§10)を踏まえる。疑義があれば確認を求める(独自判断で進めない)。

まずは添付のファイルを読み込み、上記「最初に読む順序」に従って現状とフェーズ2 のスコープ・持ち越しを把握してください。読み込みに失敗したファイルや不足資料があれば連絡してください、再送します。理解後、phase2-overview ドラフト(マイルストーン分割)の進め方を提案してください。
```

---

## 3. 補足(対話の進め方)

- 流れ: 最初のプロンプト + A〜E のファイル投入 → 設計担当の読み込み・質問対応 → **phase2-overview
  ドラフト(M8 以降のマイルストーン分割)を協議・確定** → 序盤サブマイルストーン指示書へ。
- **moves スキーマ(M8)を最初に固める**こと。後続の取込ツール・CSV 取込・登録 UI がすべて moves 構造に
  依存するため、後でスキーマを変えると手戻りが大きい(handover §3.3)。
- moves スキーマの具体カラム(発生 / 持続 / 硬直 + 硬直差)は **開発者の格ゲー知識が前提**。着手前に
  開発者へ確認(handover §7.3)。
- 「任意」ファイル(直近指示書 + レビューチェックリスト、progress-log、archive handover、CHANGE 通知書)は
  設計担当から要望が出たとき、または phase2-overview 確定後の指示書作成フェーズで渡す。

### bootstrap 生成の主な反映点(キット作成 = 2026-06-07)

| 反映 | 内容 |
|------|------|
| フェーズ単位への適応 | マイルストーン連番キットを範に、第一成果物を「単一マイルストーン指示書」→「phase2-overview ドラフト(M8+ 分割)」に変更 |
| 一次資料 | C グループに `phase2-kickoff-handover.md`(live)+ `m7-phase1-completion-handover.md`(archive、持ち越し逐条正本)を必須投入 |
| 設計書現行版反映 | REQ-001 v2.15.0 / DES-001 v1.3.0 / DES-002 v1.9.0 / DES-003 v1.16.0 / DES-004 v1.4.0 / DES-005 v2.13.0 / DES-006 v1.11.0 / SUPP-001 v1.19.0 |
| 補足資料現行版反映 | playbook v1.9.1 / architecture-patterns v1.0.15 / change-number-registry v1.9.0(次回 022)/ progress-summary v1.4.1 |
| 「読む順序」参照 | `phase2-kickoff-handover.md §7.4` を参照 |
| bootstrap 注記 | 前フェーズ kit 不在のため `m7-startup-kit.md` 構造から起こした旨を明記 |

---

## 4. 前提事実メモ(キット作成時点 = 2026-06-07)

- **CHANGE 採番**: 021 まで使用済み、**次回 022**。欠番 008 / 009 / 014(再利用不可)。整理工程で
  CHANGE-020(フェーズ番号再設定、設計書本体 5 ファイル横断)/ 021(FR702 文言修正 + FR704 新設)を起票。
- **新 4 フェーズ体系**(正本 = REQ-001 §7): フェーズ1 = MVP(完了)/ **フェーズ2 = 先行リリース準備(次)**
  / フェーズ3 = 共有・協調・入力拡充 / フェーズ4 = 外部データ追従・拡張。
- **フェーズ2 の作業順序**(handover §2.2 / A-3): 1 moves スキーマ見直し(ゲート、CHANGE 見込み)→
  2 FR701 取込ツール → 3 moves CSV 取込(FR704)+ FR703 → 4 A-1 / A-2(ComboEditor キャラ選択)→
  5 C-1 custom_states + リュウ電刃 → 6 UX・正しさ修正 → 7 A-3 検証データ / seed 整理。
- **推奨マイルストーン分割**(handover §3.2、キックオフ担当が最終決定): M8 moves スキーマ / M9 取込ツール /
  M10 CSV 取込 + FR703 / M11 A-1・A-2 / M12 custom_states + リュウ電刃 / M13 UX 修正 / M14 seed 整理。
  **CHANGE 見込みは M8(moves スキーマ)と M12(custom_states)**。
- **持ち越し課題**(フェーズ2 着手分、逐条正本 = m7-phase1-completion-handover 第2層カタログ):
  A-1(ComboEditor キャラ選択)/ A-2(リュウ固定 UX)/ A-3(検証データ・耐久 seed)/ C-1(custom_states)/
  moves スキーマ見直し。フェーズ3 タグ項目(B 系プリセット / E 系配布 / F 系リファクタ / 認証 等)は対象外。
- **設計書本体と補足資料の境界**: フェーズ2 で moves スキーマ・custom_states が REQ/DES に及ぶ場合、
  CHANGE 通知書(022〜)を起票して改訂(CLAUDE.md §8)。補足資料は CHANGE 不要・自由改訂。
  いずれも改訂結果は開発者がコミットする。
- **設計書現行版**: REQ-001 v2.15.0 / DES-001 v1.3.0 / DES-002 v1.9.0 / DES-003 v1.16.0 / DES-004 v1.4.0 /
  DES-005 v2.13.0 / DES-006 v1.11.0 / SUPP-001 v1.19.0。
- **補足資料現行版**: progress-summary v1.4.1 / architecture-patterns v1.0.15 / playbook v1.9.1 /
  change-number-registry v1.9.0。
