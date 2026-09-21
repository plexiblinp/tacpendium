# M11(custom_states 開始時状態)起動キット

> 本ファイルは **フェーズ2 本流スパイン継続設計担当(Claude Web 版「設計・指示書作成担当」)チャット**を
> 立ち上げるためのプロンプト本文 + 投入ファイル一覧。流用方法は同フォルダの `README.md` を参照。
>
> **本キットは標準の連番マイルストーンキット(`m4`〜`m10-startup-kit.md`)の系譜です。**
> M10(複数キャラ登録 UI)は M10-01 / M10-02 まで完了・E2E 通過(2026-06-19 / 20)。
> 本キットは **M11 custom_states 開始時状態**(situation = キャラ固有状態の機能化)を引き継ぎます。
>
> **一次資料は引き継ぎ書 `m10-to-m11-handover.md` です。** 同書は §0 を持たないため、冒頭の「前提」
> (本書 + docs-map を最初に読む)→ §4 M11 スコープ → §5 前向き注意点 → §6 持ち越し課題 → §7 ドキュメント参照
> の順で読みます。

---

## 0. 本キットの位置づけ / 新セッションの作業順序(必読)

### 0.1 時系列

フェーズ1(M0〜M7)完了 → 整理工程(CHANGE-020 / 021)→ フェーズ2 キックオフ(M8 設計)→ E2E 前倒し
(CHANGE-024)→ **M8(moves スキーマ / E2E 基盤)完了** → **M9(公式データ取込パイプライン)完了** →
**M10(複数キャラ登録 UI)完了**(M10-01 ComboEditor キャラ選択化 / M10-02 リュウ固定依存 UX 解消、
ともに E2E 通過)→ コンテキスト移行 → **本キット = M11 custom_states 開始時状態の設計セッション**。

M10 で登録系(ComboEditor)のリュウ固定が解消され、classic5 体(ryu / ken / ingrid / c_viper / dhalsim)の
コンボを他キャラでも登録できる状態になった。一方 **situation(キャラ固有の開始時状態)は M10 時点で汎用入力の
まま据え置き**(custom_states は phase-1 で保存 / API のみ実装・消費は未実装)。継続セッションが扱うのは
**M11(custom_states 開始時状態の機能化 = 消費の有効化)の設計と指示書化**。

### 0.2 新セッションの作業順序(`m10-to-m11-handover.md` §4 起点)

> M10 は M10-02 で完了済み。**本セッションは M11(custom_states 開始時状態)から始める。**

1. **最初に M11 着手前の現状裏取り**。M11 = custom_states 開始時状態(電刃〔denjin〕等の boolean 状態)を
   コンボに付与・表示・参照できるようにする機能化。**boolean 中心、状態の消費(コンボ中でどう減るか等)は
   モデル化せず notes 管理**(phase2-overview §M11)。着手前に必ず扱う:
   - **custom_states の保存 / API の現状を実コードで裏取り**(architecture-patterns §9.1 + code-facts。
     **想定で書かず必ず引く** — retrospective-digest §0 / §1 A。**DB 実査 ≠ 仕様正典**、正典は DES 本体〔最新
     CHANGE 反映後〕で確認 — M10-1 教訓)。
   - **消費ロジック**: 保存済み状態をどこで読み、コンボ計算 / 表示へどう効かせるか(現状は保存 + API 返却のみ)。
   - **キャラ別の状態定義**: どのキャラがどの開始時状態を持つか。データ駆動か定義テーブルか。
   - **状態付与 UI**: DES-005 §5.7 表示項目5「situation(キャラ固有状態)」の機能化(M10 時点で汎用入力)。
   - **影響設計書と CHANGE 判断**: DES-003 custom_states スキーマ / DES-005 §5.7 / DES-004 / DES-006、場合により
     DES-002 API。既存 DES で表現できるかを確認し追記要否を判断(**次回採番 040**)。
   - **前向き注意(M10-2 / M10-5)**: 「固定前提・未消費前提を有効化する改修は、phase-1 時代の固定 / 未消費前提を
     露出させる」。M11 はまさにこの型。**有効化対象(situation / custom_states)の周辺で、phase-1 で固定値・
     未消費を前提にしたハードコードや分岐が残っていないか**を着手前確認に含める(retrospective-digest §3)。
   - 推奨モデル: custom_states 消費は設計・実装とも関心が絡む見込み → **Opus + Plan Mode 必須の可能性**
     (着手時に指示書 §7 / model-allocation §7 判断軸で決定。playbook §7 / §9)。
2. **後続**: **M12 先行リリース仕上げ**(M12-01 UX・正しさ修正、M12-02 検証データ / 耐久 seed 除去 = A-3、
   **M12-03 統合 E2E + 先行リリース配布判定**)。**先行リリース判定は M12-03**(全大MS 完了後)。
3. 各サブユニットの使用モデル(Opus / Sonnet)を難易度を考慮して決め、`model-allocation.md` に追記する
   (M11 以降は未追記)。CLAUDE.md・settings.json は整備済み。

### 0.3 確定事項の継承(`m10-to-m11-handover.md` §1 / §4、再協議不要)

- **登録系の複数キャラ化は M10 で完了済み**(ComboEditor キャラ選択化 + 既定キャラ文脈追従)。M11 は
  **situation / custom_states の消費の有効化**に絞る。
- **custom_states は phase-1 で保存 / API のみ実装、消費(機能化)は未実装**(architecture-patterns §9.1)。
  DES-005 §5.7 表示項目5 situation は M10 時点で汎用入力のまま。M11 でここを機能化する。
- **moves スキーマ・取込 / 編集 API は M9 で確定、M10 でも変更なし**(DES-002 §4.2 / DES-003 §3.3)。M11 もこれらを
  変更しない想定(影響は custom_states 周辺に閉じる見込み)。
- **seed**: 破壊的 seed クリア + 再投入(配布クリーン初期状態)は **M12-02 へ延期**。旧 seed と取込データは共存。
- **E2E**: 段階導入(CHANGE-024)。基盤 = M8-02。M9 で 3 spec、M10 でキャラ追従シナリオ(B/C/D)。
  視覚 / レスポンシブ / LAN / 実機は手動継続、CI は本フェーズ非構築。M11 で開始時状態フローの spec 拡充を検討。
- **M9 / M10 外の後続候補**(`followup-backlog.md`、M11 のサブにしない): B-7 仮想コントローラ move_code 旧→新統一
  (M12-02 連動)/ B-8 情報バー ロード中フォールバック / B-9 情報バー i18n / B-1〜B-6(M9-03 由来)。M11 との前後は
  優先で別途判断。drive_parry 取込是正は CHANGE-038 で本体 DES 受入準備済み(取込実装は外部 FR701 側・管理外)。

---

## 1. 投入ファイル一覧(開発者用・パス付き)

Web チャットへアップロードするファイル。**必須**は初回投入、**任意**は対話の中で要望が出たとき・
必要になったときに渡す。

> **投入直前の鮮度更新(必須)**: `code-facts.md` は `/regen_code_facts`、`docs-map.md` は `/regen_docs_map`、
> `retrospective-digest.md` は `/retrospective-digest-update` で **投入直前に再生成し、現行コード / 構成 / 最新
> 教訓と一致させた版を貼る**こと。

### 必須(初回投入)

| # | ファイル名 | リポジトリ上のパス | 種別 |
|---|-----------|------------------|------|
| 1 | requirements.md | `docs/design/requirements.md` | 設計書本体(REQ-001 v2.15.0、§7 = 4 フェーズ定義・custom_states / situation の FR) |
| 2 | 01-tech-stack.md | `docs/design/01-tech-stack.md` | 設計書本体(DES-001 v1.3.0) |
| 3 | 02-architecture.md | `docs/design/02-architecture.md` | 設計書本体(DES-002 v1.20.0。§4.2 エンドポイント一覧。custom_states 波及時のみ参照) |
| 4 | 03-data-model.md | `docs/design/03-data-model.md` | 設計書本体(DES-003 v1.21.0。**M11 の主参照**。§3.x custom_states スキーマ) |
| 5 | 04-notation-spec.md | `docs/design/04-notation-spec.md` | 設計書本体(DES-004 v1.6.2。§2.1 code 規約・§6 プリセット/エイリアス) |
| 6 | 05-screen-design.md | `docs/design/05-screen-design.md` | 設計書本体(DES-005 v2.21.1。**M11 の主参照**。§5.7 表示項目5 situation = キャラ固有状態) |
| 7 | 06-validation.md | `docs/design/06-validation.md` | 設計書本体(DES-006 v1.11.0。custom_states 入力の検証要否を判断) |
| 8 | supp-001-detailed-design.md | `docs/design/supp-001-detailed-design.md` | 設計補足(SUPP-001 v1.24.0。§4.1 はフェーズ2分割を phase2-overview 参照) |
| 9 | design-instruction-playbook.md | `docs/handover/design-instruction-playbook.md` | 運用ルール集(v1.11.0。最初に読む。§1 役割境界・§4 セルフチェック群〔§4.11 将来送り帰結明記 / §4.12 枠の独断拡張禁止〕・§16 CHANGE 手順) |
| 10 | retrospective-digest.md | `docs/handover/retrospective-digest.md` | **設計担当ミス蒸留版**(現役教訓のみ。指示書執筆前に必読。投入直前に `/retrospective-digest-update` で再蒸留) |
| 11 | code-facts.md | `docs/handover/code-facts.md` | **機械的事実の参照元**(Props・queryKey・フロントルート・Go ルート↔ハンドラ・config・ナビ・DTO・model。投入直前に `/regen_code_facts` で再生成) |
| 12 | docs-map.md | `docs/handover/docs-map.md` | **文書ID ⇄ 実パス・役割マップ**(設計担当はファイル構成を直接見られない。`DES-003` 等の実パス逆引き。投入直前に `/regen_docs_map` で再生成) |
| 13 | architecture-patterns.md | `docs/handover/architecture-patterns.md` | 確立アーキテクチャパターン(現行版。**§9 custom_states**・§1.1 queryKey・§2.1 サービス層 IF・§8 react-hook-form) |
| 14 | change-number-registry.md | `docs/handover/change-number-registry.md` | CHANGE 番号運用(**次回採番 040**。欠番 008 / 009 / 014) |
| 15 | m10-to-m11-handover.md | `docs/handover/m10-to-m11-handover.md` | **主引き継ぎ書**(前提 = 本書 + docs-map を最初に読む・§1 M10 完了状態・§4 M11 スコープ・§5 前向き注意点・§6 持ち越し課題・§7 参照) |
| 16 | phase2-overview.md | `docs/instructions/phase2-overview.md` | フェーズ2 マイルストーン分割の正本(v0.2.0、M8〜M12。M11 = §M11 = custom_states 開始時状態。必読) |
| 17 | progress-summary.md | `docs/progress/progress-summary.md` | 進捗要約 M0〜M10(v1.7.0。§10 = M10 期間・§11 = M11 着手時点の持ち越し課題) |
| 18 | model-allocation.md | `docs/human-notes/model-allocation.md` | モデル配分(v1.16.0。**M11 以降未追記**、各サブユニット着手時に追記する) |
| 19 | CLAUDE.md | `CLAUDE.md`(リポジトリルート) | 製造担当向け指針(設計担当も一読) |

> **retrospective-log.md は起動時に投入しない**(起動時の必読は #10 digest)。ただし **retrospective-log の
> 更新責任は設計担当(本 Web 版)にある**——マイルストーン完了時に当該期間のミス・教訓を本書へ追記する。
> よって **更新が必要になったとき、または事例の事実関係・経緯(§6.6.3 M10 期間等)を遡る必要が出たときに、
> 開発者へ投入を要求して読む / 追記する**。digest(#10)は設計担当にとって **読み取り専用** で、その更新は
> Claude Code が `/retrospective-digest-update` で行う(設計担当は digest を直接編集しない)。

### 任意(対話の中で要望が出たとき・必要になったときに投入)

| ファイル名 | パス | 渡すタイミング |
|-----------|------|--------------|
| testid-convention.md | `docs/design/testid-convention.md` | E2E spec を M11 開始時状態フローに相乗りで拡充するとき(test-id 正本) |
| retrospective-log.md | `docs/handover/retrospective-log.md` | **設計担当が更新責任を持つ**(マイルストーン完了時の教訓追記)。**更新が必要になったとき**、または digest だけでは足りず過去ミスの事実関係・経緯(§6.6.3 M10 期間等)を遡るときに投入する |
| followup-backlog.md | `docs/handover/followup-backlog.md` | M9 / M10 外の後続候補(B-7 move_code 統一 / B-8 情報バー / B-9 i18n / B-1〜B-6)と M11 の前後を判断するとき(旧 `m9-03-followup-backlog.md` を改称・継承) |
| 過去の指示書テンプレート(M10-01 / M10-02 + 各レビューチェックリスト) | `docs/instructions/` ・ `docs/instructions/reviews/` | 指示書テンプレート参照用(M11 の指示書は未作成のため、直近完成版の M10-01 / M10-02 を参照) |
| CHANGE 通知書(036〜039 等 M10 期間分) | `docs/change-notes/` | M10 で確定したキャラ選択化・既定キャラ文脈追従・drive_parry 取込是正の経緯を遡るとき |
| progress-log.md | `docs/progress/progress-summary.md` で足りないとき | M1〜M10 の詳細(curl 出力・E2E 手順・実装メモ)が必要になったとき |
| アーカイブ handover(handover_1 / m1-to-m2 〜 m9-to-m10 等) | `docs/handover/` ・ `docs/handover/archive/` | 基本設計時点の前提や M1〜M10 期・整理工程の細部を遡るとき |

> M10 セッションからの変更点: 主 handover が `m10-to-m11-handover.md` に進捗。**`docs-map.md` を必須投入に追加**
> (#12、設計担当はファイル構成を直接見られないため文書ID→実パスの逆引きが必要、handover §7 が「最初に読む」と
> 明記)。設計書本体は M10 期間に **DES-002 v1.19.0 → v1.20.0 / DES-003 v1.20.0 → v1.21.0 / DES-004 v1.6.0 →
> v1.6.2 / DES-005 v2.19.0 → v2.21.1**(CHANGE-036〜039)へ改訂。`change-number-registry` 次回 **040**。
> REQ-001 v2.15.0 / DES-001 v1.3.0 / DES-006 v1.11.0 / SUPP-001 v1.24.0 / playbook v1.11.0 は据置。
> progress-summary は M0〜M10 へ前進(v1.7.0)。retrospective-digest に M10 教訓(M10-DP / M10-1〜5)を反映済み。

---

## 2. 最初のプロンプト(コピペ用)

```text
私はストリートファイター6(以下 SF6)のコンボを効率的に管理・比較・共有するための Web アプリケーションを個人開発中のエンジニアです。本体アプリは Go(modernc.org/sqlite)+ Echo + React + TypeScript の単一バイナリ配布です。

あなたは、データモデル・スキーマ設計、ドメインモデリング、React / TypeScript の状態管理、API 連携(REST)、バリデーション設計、テスト自動化(E2E / Playwright)に精通したシニアソフトウェアエンジニアです。設計の妥当性・保守性を多角的に検討し、自明な前提でも一度立ち止まって検証し、トレードオフと判断根拠を明示したうえで結論を出してください。不確かな点は推測で埋めず確認事項として挙げ、品質に妥協しないでください。その立場で「詳細設計・製造準備担当」(設計・指示書作成担当)として私の作業を支援してください。

現在、要件定義・基本設計は完了済みで、フェーズ1(MVP、M0〜M7)も完了しています。フェーズ2「先行リリース準備」では、M8(moves フレームデータ基盤)・M9(公式データ取込パイプライン)・M10(複数キャラ登録 UI)の設計・製造が完了しました(M10-01 ComboEditor キャラ選択化 / M10-02 リュウ固定依存 UX の画面横断解消、いずれも E2E 通過)。あなたはその M10 完了状態を引き継ぐ、フェーズ2 本流スパインの継続設計担当です。

本セッションが担う本流スパインは M11(custom_states 開始時状態)です。M10 で登録系のリュウ固定が解消され、他キャラのコンボ登録ができる状態になりました。一方、situation(キャラ固有の開始時状態)は汎用入力のまま据え置きで、custom_states は phase-1 で保存 / API のみ実装され、消費(機能化)は未実装です。M11 はこの custom_states の消費を有効化します = 開始時状態(電刃などの boolean 状態)をコンボに付与・表示・参照できるようにする。boolean 中心で、状態の消費(コンボ中でどう減るか等)はモデル化せず notes で管理する方針です(phase2-overview §M11)。

あなたの役割は design-instruction-playbook.md §1 に定義された「設計担当 Claude」です。製造担当 Claude Code・レビュー担当 Claude Code とは別セッションで、Claude Code への指示書とレビューチェックリストの作成、製造担当・レビュー担当からの Q&A 対応、CHANGE 通知書の起票、handover / playbook の改訂提案を担います。

まずこれまでの工程で完成したドキュメントを渡します。ファイル名:簡単な概要を記載しています。
読む順序は m10-to-m11-handover.md の冒頭「前提」(本書 + docs-map.md を最初に読む)を起点にしてください(まず design-instruction-playbook.md と m10-to-m11-handover.md を読み、docs-map.md で文書ID→実パスを引きながら、handover §4 M11 スコープ・§5 前向き注意点を読むと全体構造が掴め、続いて phase2-overview.md §M11 と DES-003 §3.x custom_states / DES-005 §5.7 表示項目5 で M11 の前提が把握できます)。

A. 設計書本体(プロジェクト恒久・真の情報源)
  requirements.md:要件定義(REQ-001 v2.15.0、§7 = 4 フェーズ定義・custom_states / situation の FR)
  01-tech-stack.md:技術スタック(DES-001 v1.3.0)
  02-architecture.md:アーキテクチャ(DES-002 v1.20.0。§4.2 エンドポイント一覧。custom_states 波及時のみ参照)
  03-data-model.md:データモデル(DES-003 v1.21.0。M11 の主参照。§3.x custom_states スキーマ)
  04-notation-spec.md:内部表現仕様(DES-004 v1.6.2。§2.1 code 規約・§6 プリセット/エイリアス)
  05-screen-design.md:画面設計(DES-005 v2.21.1。M11 の主参照。§5.7 表示項目5 situation = キャラ固有状態)
  06-validation.md:バリデーション(DES-006 v1.11.0。custom_states 入力の検証要否を判断)
  supp-001-detailed-design.md:設計補足・運用ルール(SUPP-001 v1.24.0。§4.1 はフェーズ2分割を phase2-overview 参照)

B. 設計担当の恒久資料(運用ルール・反省・パターン・機械的事実)
  design-instruction-playbook.md:プロジェクト恒久の開発スタイル・運用ルール集(設計担当専用、最初に読む、v1.11.0。§4.11 将来送り帰結明記 / §4.12 枠の独断拡張禁止)
  retrospective-digest.md:設計担当ミスの蒸留版(現役教訓のみ。指示書執筆前に毎回読む。投入直前に再蒸留した最新版)
  code-facts.md:実コードの機械的事実(Props・queryKey・フロントルート・Go ルート↔ハンドラ・config・ナビ・DTO・model。想定で書かず必ず引く。投入直前に再生成した最新版)
  docs-map.md:文書ID ⇄ 実パス・docs 配下の役割マップ(あなたはファイル構成を直接見られないため、DES-003 等の文書ID で参照した資料の実パスをここで引く。投入直前に再生成した最新版)
  architecture-patterns.md:確立済みの実装アーキテクチャパターン(現行版。§9 custom_states・§1.1 queryKey・§2.1 サービス層 IF・§8 react-hook-form)
  change-number-registry.md:CHANGE 通知書の採番状態(次番号の確認用、次回 040 から。欠番 008 / 009 / 014)

C. フェーズ2 M11 引き継ぎ(本セッション固有・差分情報)
  m10-to-m11-handover.md:主引き継ぎ書(前提 = 本書 + docs-map を最初に読む・§1 M10 完了状態・§4 M11 スコープ・§5 前向き注意点・§6 持ち越し課題・§7 参照)
  phase2-overview.md:フェーズ2 マイルストーン分割の正本(v0.2.0、M8〜M12。M11 = §M11 = custom_states 開始時状態)

D. 進捗・配分
  progress-summary.md:製造工程の進捗要約(M0〜M10、v1.7.0。§10 = M10 期間・§11 = M11 着手時点の持ち越し課題)。詳細が要るなら progress-log.md を別途渡します
  model-allocation.md:モデル配分リファレンス(v1.16.0、M11 以降未追記。各サブユニット着手時に追記する)

E. プロジェクト指針
  CLAUDE.md:製造担当 Claude Code 向けのプロジェクト指針。設計担当も概要把握のため一読してください

なお、指示書・レビューチェックリストのテンプレートが必要であれば、特に問題がなければ M10 で直近作成した指示書(M10-01 / M10-02)と対応するレビューチェックリストをテンプレート参照用に次のチャットで添付します(M11 の指示書はまだ未作成のため、直近完成版を例示します)。

あなたへの依頼事項(playbook §1 の設計担当の責任範囲)と作業順序:

1. M11 = custom_states 開始時状態の機能化の設計に着手する。着手前に必ず扱う事項 =
   (a) custom_states の保存 / API の現状を実コードで裏取り(architecture-patterns §9.1 + code-facts。想定で書かない。DB 実査 ≠ 仕様正典、正典は DES 本体〔最新 CHANGE 反映後〕で確認)、
   (b) 消費ロジック(保存済み状態をどこで読み、コンボ計算 / 表示へどう効かせるか。現状は保存 + API 返却のみ)、
   (c) キャラ別の状態定義(どのキャラがどの開始時状態を持つか。データ駆動か定義テーブルか)、
   (d) 状態付与 UI(DES-005 §5.7 表示項目5 situation のキャラ別動的状態 UI の機能化)、
   (e) 影響する設計書(DES-003 custom_states スキーマ / DES-005 §5.7 / DES-004 / DES-006、場合により DES-002 API)と CHANGE 判断(次回 040)。
   前向き注意(M10-2 / M10-5):「固定前提・未消費前提を有効化する改修は、phase-1 時代の固定 / 未消費前提を露出させる」。有効化対象の周辺で phase-1 固定値・未消費前提のハードコードや分岐が残っていないかを着手前確認に含める。
   推奨モデルは custom_states 消費が設計・実装とも関心が絡む見込みのため Opus + Plan Mode 必須の可能性。着手時に指示書 §7 / model-allocation §7 判断軸で決定。
2. M12 先行リリース仕上げ(M12-01 UX・正しさ修正、M12-02 = 検証データ / 耐久 seed 除去 = A-3、M12-03 = 統合 E2E + 配布判定)の指示書を順次。先行リリース判定は M12-03(全大MS 完了後)。
3. 各サブユニットの使用モデル(Opus / Sonnet)を難易度を考慮して決め、model-allocation.md に追記する(M11 以降は未追記)。CLAUDE.md・settings.json は整備済み。改訂が要れば改訂支援を行う。

製造工程の現在地:
- M0〜M7(フェーズ1)は実装完了・E2E 動作確認済み・開発者承認済み。
- M8 完了。M8-01(moves 8 列追加マイグレーション)/ M8-02(E2E Playwright 基盤)。
- M9 完了(2026-06-17、開発者 E2E 通過)。M9-01 FR701 取込ツール(別チャット)/ M9-02 FR704 アプリ取込 / M9-03 FR703 編集グリッド / M9-04 編集グリッド仕上げ・要確認再導出。
- M10 完了(2026-06-19 / 20、開発者 E2E 通過)。M10-01 ComboEditor キャラ選択化 / M10-02 リュウ固定依存 UX の画面横断解消。M10 期間に CHANGE-036〜039 を起票・反映(DES-002 v1.20.0 / DES-003 v1.21.0 / DES-004 v1.6.2 / DES-005 v2.21.1)。次回 CHANGE 採番は 040。
- 確定事項(再協議不要、m10-to-m11-handover.md §1 / §4): 登録系の複数キャラ化は M10 完了 / custom_states は保存・API のみ実装で消費は未実装(architecture-patterns §9.1)/ moves スキーマ・取込・編集 API は M9 確定・M10 でも不変 / 破壊的 seed クリアは M12-02 延期(旧 seed と取込データ共存)/ E2E 段階導入(M10 でキャラ追従 B/C/D)。
- M9 / M10 外の後続候補(followup-backlog.md): B-7 仮想コントローラ move_code 旧→新統一(M12-02 連動)/ B-8 情報バー ロード中フォールバック / B-9 情報バー i18n / B-1〜B-6(M9-03 由来)。M11 のサブにはしない。drive_parry 取込是正は外部 FR701 側・管理外。

ドキュメント体系について:恒久情報(反省 = retrospective-digest、機械的事実 = code-facts、文書ID ⇄ 実パス = docs-map、アーキテクチャパターン、CHANGE 番号運用)は B グループの専用ファイルに分離済みです。過去の引き継ぎ資料・設計変更通知書の過去成果物はアーカイブ済みで、要るときに提示します。retrospective-log 本体は起動時には投入していません(起動時の必読は retrospective-digest)。ただし retrospective-log の更新責任はあなた(設計担当)にあります — マイルストーン完了時に当該期間のミス・教訓を追記してください。更新が必要になったとき、または事例の事実関係を遡るときに私へ要求すれば投入します。digest は読み取り専用で、その更新は Claude Code が /retrospective-digest-update で行います。

【添付ファイルの受領確認(実験運用)】本プロンプトに続けて A〜E の複数ファイルを添付します。添付は一度に全ては届かない、または届いていても即座に認識されないことがあります。次の手順で進めてください。
(1) まず上記 A 群〜E 群に列挙した必須ファイル(計 19 件)のファイル名を「受領マニフェスト」とみなし、現時点で認識できているファイルを受領済みリストとして列挙してください。受領できたものは読み込み・内容理解を始めて構いません。
(2) マニフェストにあるのに見当たらないファイルは、すぐ「届いていない」と断定せず、一度添付の再走査・再確認をしてください。それでも見当たらない場合に限り、該当ファイル名を具体的に挙げて不足を報告し、再送を求めてください(「いくつか届いていません」のような曖昧な報告は避け、必ずファイル名単位で挙げる)。
(3) 必須ファイルが揃うまでは、CHANGE 通知書・指示書・設計判断などの成果物生成を始めないでください。不足したまま想定で進めない(これは本プロジェクトが最も警戒する「実態を確認せず想定で進める」アンチパターンです)。この段階では読み込み・内容理解・受領確認までに留めてください。任意ファイルは未着でも着手して構いません(必要時に追って投入します)。
(4) 必須ファイルの受領がすべて確認できたら、その旨を一行で報告してから、まず M11 着手前の確認事項リスト(上記 (a)〜(e)、特に custom_states の保存 / API の現状の実コード裏取りと、消費ロジック・キャラ別状態定義・状態付与 UI の論点整理)を提案してください。プロジェクトに対する質問も受け付けます。
```

---

## 3. 補足(対話の進め方)

- 流れ: 最初のプロンプト + A〜E のファイルを投入 → 設計担当の読み込み・確認事項提示 →
  **(1) M11 着手前確認(custom_states 保存 / API の実コード裏取り・消費ロジック・キャラ別状態定義・状態付与 UI・
  影響設計書 / CHANGE 判断)** → **(2) M11 custom_states 開始時状態の overview / 製造指示書** → M12、という流れ。
- **M11 要否は「着手時判断」(phase2-overview §M11)**。既存 DES(DES-003 §3.x custom_states 定義)で開始時状態の
  保持・参照が表現できるかを確認し、追記要否(DES-003 / DES-004 / DES-006、場合により DES-002)を判断する。
- **想定で書かない、必ず引く**: custom_states の保存 / API の現状は実コードの所在(architecture-patterns §9.1 +
  code-facts)で確認してから設計する(retrospective-digest §0 / §1 A)。**DB 実査 ≠ 仕様正典**、code 規約等の正典は
  DES 本体(最新 CHANGE 反映後)で確認する(M10-1 教訓)。**修正対象・E2E 起点の導線は「あるはず」で書かず実コードで
  存在確認**してから指示書に書く(M10-4 教訓)。
- **CHANGE 二層運用**: 設計書本体(REQ-001 / DES-001〜006)改訂は CHANGE 通知書必須(次回 040)。
  補足資料(SUPP-001 / handover / playbook / registry / progress / architecture-patterns / phase2-overview /
  model-allocation / retrospective-digest / docs-map / followup-backlog)は自由改訂。
- **指示書執筆前に retrospective-digest を必読**。とくに M10 期間の新教訓 — §3「固定前提 / 未消費前提を動的化・
  有効化する改修では、消費側のキャラ別ハードコード定数・コード正典の一致・phase-1 固定 defect を着手前に監査する」
  (M10-2 / 5、**M11 に直結**)・§1 A「DB 実査 ≠ 仕様正典 / 取り残し点検 / 導線の実コード存在確認」(M10-1 / DP / 4)。
  M11 でスコープを切る際は、開始時状態の付与(本フェーズ)と消費のモデル化(notes 管理 = スコープ外)の境界を
  明確にし、将来送りの帰結を明記する(playbook §4.11)。
- 「任意」ファイル(testid-convention、retrospective-log、followup-backlog、過去指示書テンプレ〔M10-01 / M10-02〕、
  過去 CHANGE 通知書、progress-log、アーカイブ handover)は設計担当から要望が出たとき、または次チャットで渡す。
- 各サブユニットの粒度・統合は phase2-overview を正本に、playbook のモデル運用基準で関心数を抑えて協議確定する。
  **マイルストーン構造の拡張・新規 overview の増設は独断せず開発者と合意する**(M9-5 / playbook §4.12 教訓)。
- **【実験運用】§2 プロンプト末尾の「添付ファイルの受領確認」ブロック**は複数ファイル添付時の一部未着・認識遅延への
  対処(M10 で有用と評価され継続)。効果(再送ループの減少・不足のまま誤着手の防止・受領状況の可視化)を本セッションでも
  評価し、冗長・不要なら撤去・簡略化してよい。

---

## 4. 前提事実メモ(キット作成時点 = 2026-06-20)

- **CHANGE 採番**: 039 まで使用済み、**次回 040**。欠番 008 / 009 / 014(再利用不可)。
- **M10 期間に起票・反映済み**: CHANGE-036(M10-01 ComboEditor キャラ選択化のキャラ変更時 確認 / 破棄挙動・
  DES-005 §5.7)/ 037(DES-004 §3.4 サンプル code を §2.1 現行規約 `standing_*` / `crouching_*` に整合)/
  038(drive_parry 取込方針の是正 = 旧 CHANGE-023/026 の取込対象外を転換・DES-002 §7.5 / DES-003 §3.3 / DES-004 §2.1)/
  039(M10-02 既定キャラの文脈追従・DES-005 §4.3 / §5.7 / §5.8、v2.21.1 errata = 文脈追従元を一覧のみに是正)。
- **設計書本体現行版**: REQ-001 v2.15.0 / DES-001 v1.3.0 / DES-002 v1.20.0 / DES-003 v1.21.0 /
  DES-004 v1.6.2 / DES-005 v2.21.1 / DES-006 v1.11.0 / SUPP-001 v1.24.0。
- **補足資料現行版**: design-instruction-playbook v1.11.0(§4.11 / §4.12)/ change-number-registry v1.27.0(次回 040)/
  progress-summary v1.7.0(**M0〜M10**)/ model-allocation v1.16.0(**M11 以降未追記**)/
  retrospective-log v1.0.38(§6.6.3 M10 期間記録済み)/ retrospective-digest・code-facts(commit 3e0f4bf)・
  docs-map(commit 3e0f4bf)・architecture-patterns は現行版(投入直前に digest / code-facts / docs-map を再生成する)。
- **M11 引き継ぎ資料**: m10-to-m11-handover v1.0.0(主)/ followup-backlog(M9 / M10 外後続)/ phase2-overview v0.2.0
  (M8〜M12 正本)。
- **マイルストーン位置**(phase2-overview v0.2.0): M8 moves フレームデータ基盤(完了)/ M9 公式データ取込
  パイプライン(完了)/ M10 複数キャラ登録 UI(完了)/ **M11 custom_states 開始時状態(次の本流)**/
  M12 先行リリース仕上げ(M12-02 seed 除去 = A-3、M12-03 = 統合 E2E + 配布判定)。
- **既知の前提**: custom_states は phase-1 で保存 / API のみ実装、消費(機能化)は未実装(architecture-patterns §9.1)。
  DES-005 §5.7 表示項目5 situation は M10 時点で汎用入力のまま。M11 で開始時状態(boolean 中心)の付与・参照を機能化し、
  消費は notes 管理(モデル化しない)。旧 seed と取込データは M12-02 まで共存。

---

## 5. 本キット作成の主な差分(キット作成 = 2026-06-20)

`m10-startup-kit`(M10 を担った本流スパイン継続キット)を範に作成。M10 完了 → M11 起点へ書き換え。

| 反映 | 内容 |
|------|------|
| M11 起点化 | M10(M10-01 / 02)完了を踏まえ、§0 作業順序を **M11 = custom_states 開始時状態の機能化(消費の有効化)起点**へ全面書き換え。前キットの M10 特殊事情(ComboEditor リュウ固定解消・既定キャラ文脈追従)を削除し、custom_states 消費の有効化にスコープを差し替え |
| 主 handover / 読む順序 | C グループ主 handover を `m10-to-m11-handover.md` に設定。同書は **§0 を持たない**ため「読む順序」参照を **header前提(本書 + docs-map を最初に読む)+ §4 M11 スコープ + §5 前向き注意点 + §7** に適応(機械的 §0 差し替えは不可) |
| docs-map.md を必須投入に追加 | m10 kit は未収録だったが、設計担当はファイル構成を直接見られず handover §7 が「最初に読む」と明記。**#12 として必須投入に追加**(文書ID→実パスの逆引き、投入直前に `/regen_docs_map` 再生成)。これに伴い必須が **18 件 → 19 件**、受領確認ブロックのマニフェスト件数も更新 |
| 持ち越し・確定事項 | handover §1 / §4 の確定事項(登録系複数キャラ化は M10 完了・custom_states は保存 / API のみで消費未実装・moves / 取込 / 編集 API は M9 確定で M10 不変・seed クリア M12-02 延期)を §0.3 / §2 に要約。M9 / M10 外後続(B-7 / B-8 / B-9 + B-1〜B-6)を `followup-backlog.md`(改称後)参照で明記 |
| CHANGE 起票・設計書改訂事実 | M10 期間に CHANGE-036〜039 起票・反映、DES-002 v1.20.0 / DES-003 v1.21.0 / DES-004 v1.6.2 / DES-005 v2.21.1、次回 040 を反映 |
| 投入資料の code-facts / digest / docs-map 維持・追加 | retrospective-log は **起動時必読から外す(任意・更新責任は設計担当に残す)**、起動時必読は `retrospective-digest.md`(#10、設計担当には読み取り専用)。`code-facts.md`(#11)/ `docs-map.md`(#12)を必須投入。digest / code-facts / docs-map は投入直前に再生成する注記を更新 |
| ロール指定 | §2 冒頭を **データモデル・スキーマ設計・ドメインモデリング・状態管理・API 連携・バリデーション・テスト自動化**に精通したシニアエンジニアへ文言調整(M10 の画面・UI 比重を下げ、M11 の custom_states データモデル / 状態管理比重へ) |
| progress-summary 対象範囲 | M0〜M10(v1.7.0)へ前進。§10 = M10 期間・§11 = M11 着手時点の持ち越し課題 |
| 直近指示書(任意投入) | M11 の指示書は未作成のため、テンプレ参照は直近完成版の M10-01 / M10-02 + レビューチェックリストを任意投入に設定 |
| ドキュメント体系について段落 | 恒久情報は B グループ専用ファイルに分離済み・過去資料はアーカイブ済みで要時提示、の定常文を維持(digest / code-facts / docs-map / retrospective-log の役割分担を踏襲) |

---

## 6. 改訂履歴

| 日付 | 内容 |
|------|------|
| 2026-06-20 | M10 完了 → M11 着手に伴い `m11-startup-kit.md` を `m10-startup-kit.md` から流用作成(`/next_milestone_kit M11`)。CHANGE-036〜039 反映・DES-002 v1.20.0 / DES-003 v1.21.0 / DES-004 v1.6.2 / DES-005 v2.21.1 / 次回 040。主 handover = m10-to-m11-handover(§0 非保持のため読む順序を header前提 + §4 + §7 に適応)。**docs-map.md を必須投入に追加(18 → 19 件)**、受領確認ブロックのマニフェスト件数を更新。§0 作業順序を M11(custom_states 開始時状態の機能化)起点へ書き換え、ロール指定を data model・スキーマ設計・状態管理中心へ調整。retrospective-digest(M10-DP / M10-1〜5 反映済)/ code-facts(2026-06-20 / commit 3e0f4bf 再生成)/ docs-map(2026-06-20 / commit 3e0f4bf 再生成)/ progress-summary(M0〜M10、v1.7.0)を最新化して同梱。持ち越し課題を A-1 / A-2 解消 → M11 スコープ(C-1 custom_states)+ M9 / M10 外後続 backlog(B-7 / B-8 / B-9 + B-1〜B-6、正本 `followup-backlog.md`)へ差し替え |
