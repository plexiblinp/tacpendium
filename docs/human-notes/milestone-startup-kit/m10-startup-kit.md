# M10(複数キャラ登録 UI)起動キット

> 本ファイルは **フェーズ2 本流スパイン継続設計担当(Claude Web 版「設計・指示書作成担当」)チャット**を
> 立ち上げるためのプロンプト本文 + 投入ファイル一覧。流用方法は同フォルダの `README.md` を参照。
>
> **本キットは標準の連番マイルストーンキット(`m4`〜`m9-startup-kit.md`)の系譜です。**
> M9(公式データ取込パイプライン)は M9-01〜M9-04 まで完了・検収済み(2026-06-17、開発者 E2E 通過)。
> 本キットは **M10 複数キャラ登録 UI**(A-1 ComboEditor キャラ選択化 / A-2 リュウ固定 UX 解消)を引き継ぎます。
>
> **一次資料は引き継ぎ書 `m9-to-m10-handover.md` です。** M9 の確定事項・M9 外の後続候補(backlog)は同書 §3 / §4 を参照。

---

## 0. 本キットの位置づけ / 新セッションの作業順序(必読)

### 0.1 時系列

フェーズ1(M0〜M7)完了 → 整理工程(CHANGE-020 / 021)→ フェーズ2 キックオフ(M8 設計)→ E2E 前倒し
(CHANGE-024)→ **M8(moves スキーマ / E2E 基盤)完了** → **M9(公式データ取込パイプライン)完了**
(M9-01 FR701 取込ツール = 別チャット / M9-02 FR704 アプリ取込 / M9-03 FR703 手動修正・編集グリッド /
M9-04 編集グリッド仕上げ・要確認再導出)→ コンテキスト移行 → **本キット = M10 複数キャラ登録 UI の設計セッション**。

M9 は全サブマイルストーンが実装・レビュー・開発者 E2E まで完了。classic5 体(ryu / ken / ingrid / c_viper /
dhalsim)のフレームデータが取込・編集できる状態になった。継続セッションが扱うのは **M10(ComboEditor の
キャラクター選択化 = 他キャラ登録 UI)の設計と指示書化**。

### 0.2 新セッションの作業順序(`m9-to-m10-handover.md` §0 起点)

> M9 は M9-04 で完了済み。**本セッションは M10(複数キャラ登録 UI)から始める。**

1. **最初に M10-01(A-1)= ComboEditor のキャラクター選択化の設計**。現状、登録系(コンボ新規登録 / 編集)は
   **リュウ固定**(`INITIAL_CHARACTER_ID` 相当のハードコード)。一方 **閲覧系(マイコンボ / 一覧 / 比較)は
   複数キャラ動的化済み**(`useCharacters` フック)。M9 で classic5 のデータが投入されたため、他キャラの
   コンボ登録が実用上必須になった。着手前に必ず扱う:
   - **現状のリュウ固定箇所を実コードで特定**(ComboEditor / 新規登録ページ / 編集ページ / RecipeBuilder の
     キャラ依存箇所)。**想定で書かず code-facts §1 Props / §3 フロントルート / 実 view で確認**(retrospective-digest
     §1 A「実装済み前提は code-facts で裏取り」)。
   - **登録系 API が `character_id` を受け取るか**を確認(`POST /api/combos` / `PUT /api/combos/:id` の契約。
     code-facts §4 Go ルート↔ハンドラ + DES-002 §4.2)。受けない場合の CHANGE 要否を判断(**次回採番 036**)。
   - **キャラ選択 UI の整合**: 閲覧系で確立済みの `useCharacters` + キャラ選択コンポーネントのパターンを踏襲
     できるか(architecture-patterns / code-facts で既存実装を確認)。新規 UI は DES-005 §5.x の登録/編集画面の
     「表示項目 ↔ アクション」をペアで読む(retrospective-digest §3)。
   - **キャラ切替時の RecipeBuilder / プリセット連動**: 選択キャラに応じた moves / preset_aliases の解決。
     recipe_cache・始動技候補のキャラ依存を確認。
   - 推奨モデル: フロント状態管理・画面設計中心で関心数は中 → **Sonnet / Opus を難易度で判断** + Plan Mode は
     複雑ロジック含む場合に必須(playbook §7 / §9)。
2. **M10-02(A-2)= リュウ固定に依存した UX の解消**。新規登録 / 選択モード / コンボ追加モーダル等で
   リュウ前提に組まれた既定値・固定表示を、選択キャラ追従へ。M10-01 の選択化を画面横断で仕上げる。
3. **後続**: **M11 custom_states 開始時状態**(開始時状態 = boolean 中心、消費はコンボ notes 管理でモデル化
   しない、M8 と独立・準独立で M9/M10 と並走可)/ **M12 先行リリース仕上げ**(M12-01 UX、M12-02 検証データ /
   耐久 seed 除去 = A-3、**M12-03 統合 E2E + 先行リリース配布判定**)。**先行リリース判定は M12-03**。
4. 各サブユニットの使用モデル(Opus / Sonnet)を難易度を考慮して決め、`model-allocation.md` に追記する
   (M10 以降は未追記)。CLAUDE.md・settings.json は整備済み。

### 0.3 確定事項の継承(`m9-to-m10-handover.md` §4、再協議不要)

- **閲覧系の複数キャラ動的化は完了済み**(`useCharacters`)。M10 は **登録系(ComboEditor)のリュウ固定解消**に絞る。
- **moves スキーマ・取込 API・編集 API は M9 で確定**(DES-002 §4.2 / DES-003 §3.3)。M10 はこれらを変更しない想定。
  - `model.Move` / `MoveListItem`(M8-A4): GET 読取路は不変(開発者確定)、二重保持は後続集約として延期 +
    乖離検出ガード(`MoveListItem→model.Move` 単体テスト)で同期漏れ検出。
  - 編集 API: `PATCH /api/moves/:id`(部分更新・フル返却)/ `POST /api/moves/:id/rush-variant`(409 + 既存 id)/
    `GET /api/moves/:id`(単一フル)。楽観ロックなし(last-write-wins)。
- **seed**: M9-02 の 000014 は **加算のみ**(classic5 のキャラ名追加)。破壊的 seed クリア + 再投入(配布クリーン
  初期状態)は **M12-02 へ延期**。M10 着手時点では旧 seed と取込データが共存している。
- **E2E**: 段階導入(CHANGE-024)。基盤 = M8-02。M9 で 3 spec(import-moves / combo-crud / moves-edit)。
  視覚/レスポンシブ/LAN/実機は手動継続、CI は本フェーズ非構築。M10 で複数キャラ登録フローの spec 拡充を検討。
- **M9 外の後続候補**(`m9-03-followup-backlog.md`、M10 のサブにしない): B-1 命名クラスタ / B-2-heavy moves 手動
  CRUD / B-3 フレーム計算式(開発者ドメイン課題)/ B-5 複数 CSV 一括取込。M10 との前後は優先で別途判断。

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
| 3 | 02-architecture.md | `docs/design/02-architecture.md` | 設計書本体(DES-002 v1.19.0。§4.2 エンドポイント一覧 = combos / moves 系・§7.5 取込責務分担) |
| 4 | 03-data-model.md | `docs/design/03-data-model.md` | 設計書本体(DES-003 v1.20.0。§3.3 moves スキーマ・raw_data 確定キー・§616 マスタ上書き管理) |
| 5 | 04-notation-spec.md | `docs/design/04-notation-spec.md` | 設計書本体(DES-004 v1.6.0。§2.1 code 規約・§6 プリセット/エイリアス) |
| 6 | 05-screen-design.md | `docs/design/05-screen-design.md` | 設計書本体(DES-005 v2.19.0。**M10 の主参照**。登録/編集画面・キャラ選択・§4.1 ヘッダ導線) |
| 7 | 06-validation.md | `docs/design/06-validation.md` | 設計書本体(DES-006 v1.11.0) |
| 8 | supp-001-detailed-design.md | `docs/design/supp-001-detailed-design.md` | 設計補足(SUPP-001 v1.24.0。§4.1 はフェーズ2分割を phase2-overview 参照) |
| 9 | design-instruction-playbook.md | `docs/handover/design-instruction-playbook.md` | 運用ルール集(v1.11.0。最初に読む。§1 役割境界・§4 セルフチェック群〔§4.11 将来送り帰結明記 / §4.12 枠の独断拡張禁止〕・§16 CHANGE 手順) |
| 10 | retrospective-digest.md | `docs/handover/retrospective-digest.md` | **設計担当ミス蒸留版**(現役教訓のみ。指示書執筆前に必読。投入直前に `/retrospective-digest-update` で再蒸留) |
| 11 | code-facts.md | `docs/handover/code-facts.md` | **機械的事実の参照元**(Props・queryKey・フロントルート・Go ルート↔ハンドラ・config・ナビ。投入直前に `/regen_code_facts` で再生成) |
| 12 | architecture-patterns.md | `docs/handover/architecture-patterns.md` | 確立アーキテクチャパターン(現行版。§1.1 queryKey・§2.1 サービス層 IF・§8 react-hook-form・§9 custom_states) |
| 13 | change-number-registry.md | `docs/handover/change-number-registry.md` | CHANGE 番号運用(**次回採番 036**。欠番 008 / 009 / 014) |
| 14 | m9-to-m10-handover.md | `docs/handover/m9-to-m10-handover.md` | **主引き継ぎ書**(§0 役割・§1 現在地 = M9 完了・§3 M9 外後続 backlog・§4 確定事項) |
| 15 | phase2-overview.md | `docs/instructions/phase2-overview.md` | フェーズ2 マイルストーン分割の正本(v0.2.0、M8〜M12。M10 = §M10、M10-01 / M10-02。必読) |
| 16 | progress-summary.md | `docs/progress/progress-summary.md` | 進捗要約 M0〜M9(v1.6.0。§9 = M9 期間・§10 = M10 着手時点の持ち越し課題) |
| 17 | model-allocation.md | `docs/human-notes/model-allocation.md` | モデル配分(v1.13.0。**M10 以降未追記**、各サブユニット着手時に追記する) |
| 18 | CLAUDE.md | `CLAUDE.md`(リポジトリルート) | 製造担当向け指針(設計担当も一読) |

> **retrospective-log.md は起動時に投入しない**(起動時の必読は #10 digest)。ただし **retrospective-log の
> 更新責任は設計担当(本 Web 版)にある**——マイルストーン完了時に当該期間のミス・教訓を本書へ追記する。
> よって **更新が必要になったとき、または事例の事実関係・経緯(§6.6.2 M9 期間等)を遡る必要が出たときに、
> 開発者へ投入を要求して読む/追記する**。digest(#10)は設計担当にとって **読み取り専用** で、その更新は
> Claude Code が `/retrospective-digest-update` で行う(設計担当は digest を直接編集しない)。

### 任意(対話の中で要望が出たとき・必要になったときに投入)

| ファイル名 | パス | 渡すタイミング |
|-----------|------|--------------|
| testid-convention.md | `docs/design/testid-convention.md` | E2E spec を M10 複数キャラ登録フローに相乗りで拡充するとき(test-id 正本) |
| retrospective-log.md | `docs/handover/retrospective-log.md` | **設計担当が更新責任を持つ**(マイルストーン完了時の教訓追記)。**更新が必要になったとき**、または digest だけでは足りず過去ミスの事実関係・経緯(§6.6.2 M9 期間等)を遡るときに投入する |
| m9-03-followup-backlog.md | `docs/handover/m9-03-followup-backlog.md` | M9 外の後続候補(B-1 命名 / B-2-heavy CRUD / B-3 フレーム計算式 / B-5 一括取込)と M10 の前後を判断するとき |
| 過去の指示書テンプレート(M9-03 / M9-04 + 各レビューチェックリスト) | `docs/instructions/` ・ `docs/instructions/reviews/` | 指示書テンプレート参照用(M10 の指示書は未作成のため、直近完成版の M9-03 / M9-04 を参照) |
| fr701-mainline-handover.md / fr701-m9-02-handover-addendum.md | `docs/handover/` | M9 取込パイプラインの本体連携(CSV 契約・combo_scaling キー・notes パース)を遡るとき |
| CHANGE 通知書(028〜035 等 M9 期間分) | `docs/change-notes/` | M9 で確定した取込/編集 API・データ契約の経緯を遡るとき |
| progress-log.md | `docs/progress/progress-summary.md` で足りないとき | M1〜M9 の詳細(curl 出力・E2E 手順・実装メモ)が必要になったとき |
| アーカイブ handover(handover_1 / m1-to-m2 〜 m8-to-m9 等) | `docs/handover/` ・ `docs/handover/archive/` | 基本設計時点の前提や M1〜M9 期・整理工程の細部を遡るとき |

> M9 セッションからの変更点: 主 handover が `m9-to-m10-handover.md` に進捗(FR701 引き継ぎ 2 本は M9-02 専用の
> ため任意降格)。設計書本体は M9 期間に **DES-002 v1.13.0 → v1.19.0 / DES-003 v1.18.0 → v1.20.0 /
> DES-005 v2.13.0 → v2.19.0**(CHANGE-028〜035)へ改訂。`change-number-registry` 次回 **036**。
> REQ-001 v2.15.0 / DES-001 v1.3.0 / DES-004 v1.6.0 / DES-006 v1.11.0 / SUPP-001 v1.24.0 は据置。playbook は
> M9 教訓機構化(M9-3 / M9-5)に伴い v1.9.1 → **v1.11.0**(§4.11 / §4.12 新設、retrospective-log §1 パターン F 昇格と対)。
> progress-summary は M0〜M9 へ前進(v1.6.0)。retrospective-digest に M9 教訓(M9-1〜M9-6)を反映済み。

---

## 2. 最初のプロンプト(コピペ用)

```text
私はストリートファイター6(以下 SF6)のコンボを効率的に管理・比較・共有するための Web アプリケーションを個人開発中のエンジニアです。本体アプリは Go(modernc.org/sqlite)+ Echo + React + TypeScript の単一バイナリ配布です。

あなたは、React / TypeScript のフロントエンド状態管理・画面設計(UI/UX)、コンポーネント設計、API 連携(REST)、バリデーション設計、テスト自動化(E2E / Playwright)に精通したシニアソフトウェアエンジニアです。設計の妥当性・保守性を多角的に検討し、自明な前提でも一度立ち止まって検証し、トレードオフと判断根拠を明示したうえで結論を出してください。不確かな点は推測で埋めず確認事項として挙げ、品質に妥協しないでください。その立場で「詳細設計・製造準備担当」(設計・指示書作成担当)として私の作業を支援してください。

現在、要件定義・基本設計は完了済みで、フェーズ1(MVP、M0〜M7)も完了しています。フェーズ2「先行リリース準備」では、M8(moves フレームデータ基盤)と M9(公式データ取込パイプライン)の設計・製造が完了しました(M9-01 FR701 取込ツール = 別チャット / M9-02 FR704 アプリ側 CSV 取込 / M9-03 FR703 手動修正・編集グリッド / M9-04 編集グリッド仕上げ・要確認再導出、いずれも開発者 E2E 通過)。あなたはその M9 完了状態を引き継ぐ、フェーズ2 本流スパインの継続設計担当です。

本セッションが担う本流スパインは M10(複数キャラ登録 UI)です。M9 で classic5 体(ryu / ken / ingrid / c_viper / dhalsim)のフレームデータが取込・編集できる状態になりました。一方、コンボ登録系(ComboEditor)はフェーズ1 以来リュウ固定のままで、閲覧系(マイコンボ / 一覧 / 比較)だけが複数キャラ動的化済みです。M10 はこの登録系のリュウ固定を解消します = M10-01(A-1)ComboEditor のキャラクター選択化、M10-02(A-2)リュウ固定に依存した UX の解消。

あなたの役割は design-instruction-playbook.md §1 に定義された「設計担当 Claude」です。製造担当 Claude Code・レビュー担当 Claude Code とは別セッションで、Claude Code への指示書とレビューチェックリストの作成、製造担当・レビュー担当からの Q&A 対応、CHANGE 通知書の起票、handover / playbook の改訂提案を担います。

まずこれまでの工程で完成したドキュメントを渡します。ファイル名:簡単な概要を記載しています。
読む順序は m9-to-m10-handover.md §0「このチャットの役割 / 作業順序」を起点にしてください(まず design-instruction-playbook.md と m9-to-m10-handover.md を読むと全体構造が掴め、続いて phase2-overview.md §M10 と DES-005 の登録/編集画面で M10 の前提が把握できます)。

A. 設計書本体(プロジェクト恒久・真の情報源)
  requirements.md:要件定義(REQ-001 v2.15.0、§7 = 4 フェーズ定義・FR701〜704)
  01-tech-stack.md:技術スタック(DES-001 v1.3.0)
  02-architecture.md:アーキテクチャ(DES-002 v1.19.0。§4.2 combos / moves 系エンドポイント・§7.5 取込責務分担)
  03-data-model.md:データモデル(DES-003 v1.20.0。§3.3 moves スキーマ・raw_data 確定キー・§616 マスタ上書き管理)
  04-notation-spec.md:内部表現仕様(DES-004 v1.6.0。§2.1 code 規約・§6 プリセット/エイリアス)
  05-screen-design.md:画面設計(DES-005 v2.19.0。M10 の主参照。登録/編集画面・キャラ選択・§4.1 ヘッダ導線)
  06-validation.md:バリデーション(DES-006 v1.11.0)
  supp-001-detailed-design.md:設計補足・運用ルール(SUPP-001 v1.24.0。§4.1 はフェーズ2分割を phase2-overview 参照)

B. 設計担当の恒久資料(運用ルール・反省・パターン・機械的事実)
  design-instruction-playbook.md:プロジェクト恒久の開発スタイル・運用ルール集(設計担当専用、最初に読む、v1.11.0。§4.11 将来送り帰結明記 / §4.12 枠の独断拡張禁止 を新設)
  retrospective-digest.md:設計担当ミスの蒸留版(現役教訓のみ。指示書執筆前に毎回読む。投入直前に再蒸留した最新版)
  code-facts.md:実コードの機械的事実(Props・queryKey・フロントルート・Go ルート↔ハンドラ・config・ナビ。想定で書かず必ず引く。投入直前に再生成した最新版)
  architecture-patterns.md:確立済みの実装アーキテクチャパターン(現行版。§1.1 queryKey・§2.1 サービス層 IF・§8 react-hook-form・§9 custom_states)
  change-number-registry.md:CHANGE 通知書の採番状態(次番号の確認用、次回 036 から。欠番 008 / 009 / 014)

C. フェーズ2 M10 引き継ぎ(本セッション固有・差分情報)
  m9-to-m10-handover.md:主引き継ぎ書(§0 役割 / 作業順序・§1 現在地 = M9 完了・§3 M9 外後続 backlog・§4 確定事項)
  phase2-overview.md:フェーズ2 マイルストーン分割の正本(v0.2.0、M8〜M12。M10 = §M10、M10-01 / M10-02)

D. 進捗・配分
  progress-summary.md:製造工程の進捗要約(M0〜M9、v1.6.0。§9 = M9 期間・§10 = M10 着手時点の持ち越し課題)。詳細が要るなら progress-log.md を別途渡します
  model-allocation.md:モデル配分リファレンス(v1.13.0、M10 以降未追記。各サブユニット着手時に追記する)

E. プロジェクト指針
  CLAUDE.md:製造担当 Claude Code 向けのプロジェクト指針。設計担当も概要把握のため一読してください

あなたへの依頼事項(playbook §1 の設計担当の責任範囲)と作業順序:

1. M10-01(A-1)= ComboEditor のキャラクター選択化の設計に着手する。着手前に必ず扱う事項 =
   (a) 現状のリュウ固定箇所を実コードで特定(ComboEditor / 新規登録ページ / 編集ページ / RecipeBuilder のキャラ依存。code-facts §1 Props / §3 フロントルート / 実 view で確認、想定で書かない)、
   (b) 登録系 API(POST /api/combos / PUT /api/combos/:id)が character_id を受けるか確認(code-facts §4 + DES-002 §4.2)、受けないなら CHANGE 要否を判断(次回 036)、
   (c) 閲覧系で確立済みの useCharacters + キャラ選択 UI パターンを登録系へ踏襲できるか(architecture-patterns / code-facts で既存実装を確認)、
   (d) キャラ切替時の RecipeBuilder / プリセット / recipe_cache / 始動技候補のキャラ依存の連動。
   推奨モデルは関心数中のためフロント状態管理・画面設計の難易度で Sonnet / Opus を判断、複雑ロジック含む場合は Plan Mode 必須。
2. M10-02(A-2)= リュウ固定に依存した UX の解消(新規登録 / 選択モード / コンボ追加モーダルの既定値・固定表示を選択キャラ追従へ)を M10-01 の選択化を画面横断で仕上げる形で設計する。
3. M11 custom_states 開始時状態 / M12 先行リリース仕上げ(M12-02 = 検証データ / 耐久 seed 除去、M12-03 = 統合 E2E + 配布判定)の指示書を順次。
4. 各サブユニットの使用モデル(Opus / Sonnet)を難易度を考慮して決め、model-allocation.md に追記する(M10 以降は未追記)。CLAUDE.md・settings.json は整備済み。改訂が要れば改訂支援を行う。

製造工程の現在地:
- M0〜M7(フェーズ1)は実装完了・E2E 動作確認済み・開発者承認済み。
- M8 完了。M8-01(moves 8 列追加マイグレーション)/ M8-02(E2E Playwright 基盤)。
- M9 完了(2026-06-17、開発者 E2E 通過)。M9-01 FR701 取込ツール(別チャット)/ M9-02 FR704 アプリ取込 / M9-03 FR703 手動修正・編集グリッド / M9-04 編集グリッド仕上げ・要確認再導出。M9 期間に CHANGE-028〜035 を起票・反映(DES-002 v1.19.0 / DES-003 v1.20.0 / DES-005 v2.19.0、マイグレーション 000014)。次回 CHANGE 採番は 036。
- 確定事項(再協議不要、m9-to-m10-handover.md §4): 閲覧系は複数キャラ動的化済み(useCharacters)・登録系のみリュウ固定 / moves スキーマ・取込/編集 API は M9 で確定(model.Move 集約は後続延期 + 乖離検出ガード)/ 破壊的 seed クリアは M12-02 延期(000014 は加算のみ・旧 seed と取込データ共存)/ E2E 段階導入(M9 で 3 spec)。
- M9 外の後続候補(m9-03-followup-backlog.md): B-1 命名クラスタ / B-2-heavy moves 手動 CRUD / B-3 フレーム計算式(開発者ドメイン課題)/ B-5 複数 CSV 一括取込。M10 のサブにはしない。

ドキュメント体系について:恒久情報(反省 = retrospective-digest、機械的事実 = code-facts、アーキテクチャパターン、CHANGE 番号運用)は B グループの専用ファイルに分離済みです。過去の引き継ぎ資料・設計変更通知書の過去成果物はアーカイブ済みで、要るときに提示します。retrospective-log 本体は起動時には投入していません(起動時の必読は retrospective-digest)。ただし retrospective-log の更新責任はあなた(設計担当)にあります — マイルストーン完了時に当該期間のミス・教訓を追記してください。更新が必要になったとき、または事例の事実関係を遡るときに私へ要求すれば投入します。digest は読み取り専用で、その更新は Claude Code が /retrospective-digest-update で行います。

【添付ファイルの受領確認(実験運用)】本プロンプトに続けて A〜E の複数ファイルを添付します。添付は一度に全ては届かない、または届いていても即座に認識されないことがあります。次の手順で進めてください。
(1) まず上記 A 群〜E 群に列挙した必須ファイル(計 18 件)のファイル名を「受領マニフェスト」とみなし、現時点で認識できているファイルを受領済みリストとして列挙してください。受領できたものは読み込み・内容理解を始めて構いません。
(2) マニフェストにあるのに見当たらないファイルは、すぐ「届いていない」と断定せず、一度添付の再走査・再確認をしてください。それでも見当たらない場合に限り、該当ファイル名を具体的に挙げて不足を報告し、再送を求めてください(「いくつか届いていません」のような曖昧な報告は避け、必ずファイル名単位で挙げる)。
(3) 必須ファイルが揃うまでは、CHANGE 通知書・指示書・設計判断などの成果物生成を始めないでください。不足したまま想定で進めない(これは本プロジェクトが最も警戒する「実態を確認せず想定で進める」アンチパターンです)。この段階では読み込み・内容理解・受領確認までに留めてください。任意ファイルは未着でも着手して構いません(必要時に追って投入します)。
(4) 必須ファイルの受領がすべて確認できたら、その旨を一行で報告してから、まず M10-01 着手前の確認事項リスト(上記 (a)〜(d)、特にリュウ固定箇所の実コード特定と登録系 API の character_id 契約確認)を提案してください。プロジェクトに対する質問も受け付けます。
```

---

## 3. 補足(対話の進め方)

- 流れ: 最初のプロンプト + A〜E のファイルを投入 → 設計担当の読み込み・確認事項提示 →
  **(1) M10-01 着手前確認(リュウ固定箇所の実コード特定・登録系 API の character_id 契約・useCharacters 踏襲・
  キャラ切替連動)** → **(2) M10-01 ComboEditor キャラ選択化の製造指示書** → M10-02 → M11 / M12、という流れ。
- **M10 要否は「着手時判断」(phase2-overview §3)だが、M9 で classic5 データ投入済みのため実用上必須**。
  着手見送りの判断材料(他キャラ登録の需要)があれば開発者と確認する。
- **想定で書かない、必ず引く**: ComboEditor のリュウ固定は実コードの所在(`INITIAL_CHARACTER_ID` 相当・
  キャラ選択の有無)を code-facts / view で確認してから指示書化する(retrospective-digest §1 A / §3)。
  登録系 API が character_id を受けるかは DES-002 §4.2 の代表例でなく **実ルート↔ハンドラ(code-facts §4)** で裏取りする。
- **CHANGE 二層運用**: 設計書本体(REQ-001 / DES-001〜006)改訂は CHANGE 通知書必須(次回 036)。
  補足資料(SUPP-001 / handover / playbook / registry / progress / architecture-patterns / phase2-overview /
  model-allocation / retrospective-digest / backlog)は自由改訂。
- **指示書執筆前に retrospective-digest を必読**。とくに M9 期間の新教訓 — §3「複数の将来送り/スコープ外決定の
  組合せが生む利用者帰結を明記」(M9-3)・§6「マイルストーン構造拡張・新規 overview 増設は独断せず開発者合意」
  (M9-5)。M10 でスコープを切る際は、A-1 と A-2 の境界・後続(B-1 命名等)との境界を明確にし、決定の足し算で
  「無名・編集不能」のような穴を作らないこと。
- 「任意」ファイル(testid-convention、retrospective-log、m9-03-followup-backlog、過去指示書テンプレ、FR701
  引き継ぎ、過去 CHANGE 通知書、progress-log、アーカイブ handover)は設計担当から要望が出たとき、または次チャットで渡す。
- 各サブユニットの粒度・統合は phase2-overview を正本に、playbook のモデル運用基準で関心数を抑えて協議確定する。
  **マイルストーン構造の拡張・新規 overview の増設は独断せず開発者と合意する**(M9-5 教訓)。
- **【実験運用】§2 プロンプト末尾の「添付ファイルの受領確認」ブロックは実験的に追加したもの**(複数ファイル添付時の
  一部未着・認識遅延への対処)。効果(再送ループの減少・不足のまま誤着手の防止・受領状況の可視化)を本セッションで
  評価し、有用なら次回以降の起動キットや `next_milestone_kit` の変換規則テンプレ・`milestone-startup-guide.md` へ
  展開を検討する(現時点では本キット限定)。逆に冗長・不要なら撤去・簡略化してよい。

---

## 4. 前提事実メモ(キット作成時点 = 2026-06-17)

- **CHANGE 採番**: 035 まで使用済み、**次回 036**。欠番 008 / 009 / 014(再利用不可)。
- **M9 期間に起票・反映済み**: CHANGE-028(total 算出式の DES-003 §3.3 記載・案B)/ 029(取込プレビュー UI +
  `/preview` エンドポイント)/ 030(M9-02 完成に伴う取込 API・データ契約の確定)/ 031(moves 編集・ラッシュ版生成
  + 編集グリッド画面18)/ 032(M9-03 Plan Mode 決定の明文化)/ 033(画面18 ナビ導線)/ 034(M9-04 要確認再導出の
  接地点 = MoveResponse に warnings 加算)/ 035(再導出 unknown_properties の非パリティ性脚注)。
- **設計書本体現行版**: REQ-001 v2.15.0 / DES-001 v1.3.0 / DES-002 v1.19.0 / DES-003 v1.20.0 /
  DES-004 v1.6.0 / DES-005 v2.19.0 / DES-006 v1.11.0 / SUPP-001 v1.24.0。
- **補足資料現行版**: design-instruction-playbook v1.11.0(§4.11 / §4.12 新設)/ change-number-registry(次回 036)/
  progress-summary v1.6.0(**M0〜M9**)/ model-allocation v1.13.0(**M10 以降未追記**)/
  retrospective-log v1.0.36(§6.6.2 M9 期間記録済み・§1 パターン F 昇格)/ retrospective-digest・code-facts・architecture-patterns
  は現行版(投入直前に digest / code-facts を再生成する)。
- **M10 引き継ぎ資料**: m9-to-m10-handover(主)/ m9-03-followup-backlog(M9 外後続)/ phase2-overview v0.2.0
  (M8〜M12 正本)。
- **マイルストーン位置**(phase2-overview v0.2.0): M8 moves フレームデータ基盤(完了)/ M9 公式データ取込
  パイプライン(完了)/ **M10 複数キャラ登録 UI(M10-01 A-1 ComboEditor キャラ選択化 = 次の本流・M10-02 A-2
  リュウ固定 UX 解消)**/ M11 custom_states 開始時状態 / M12 先行リリース仕上げ(M12-02 seed 除去 = A-3、
  M12-03 = 統合 E2E + 配布判定)。
- **既知の前提**: 閲覧系(マイコンボ / 一覧 / 比較)は複数キャラ動的化済み(`useCharacters`)。登録系
  (ComboEditor)のみフェーズ1 以来リュウ固定。classic5(ryu / ken / ingrid / c_viper / dhalsim)のフレーム
  データは M9 で取込・編集可能。旧 seed と取込データは M12-02 まで共存。

---

## 5. 本キット作成の主な差分(キット作成 = 2026-06-17)

`m9-startup-kit`(M9 を担った本流スパイン継続キット)を範に作成。M9 完了 → M10 起点へ書き換え。

| 反映 | 内容 |
|------|------|
| M10 起点化 | M9(M9-01〜M9-04)完了を踏まえ、§0 作業順序を **M10-01(A-1 ComboEditor キャラ選択化)起点**へ全面書き換え。前キットの M9 特殊事情(FR701 別ツール完了・M9-02 起点・取込ロジック)を削除し、登録系リュウ固定解消にスコープを差し替え |
| 主 handover / 読む順序 | C グループ主 handover を `m9-to-m10-handover.md` に設定、「読む順序」参照を同書 §0 起点へ変更 |
| FR701 引き継ぎ 2 本の降格 | M9-02 取込専用だった `fr701-mainline-handover.md` / `fr701-m9-02-handover-addendum.md` を必須 → 任意へ降格(取込連携を遡るときのみ) |
| 持ち越し・確定事項 | handover §4 の確定事項(閲覧系動的化済み・登録系リュウ固定・moves/取込/編集 API は M9 確定・model.Move 後続集約延期 + 乖離ガード・seed クリア M12-02 延期)を §0.3 / §2 に要約。M9 外後続(B-1/B-2-heavy/B-3/B-5)を backlog 参照で明記 |
| CHANGE 起票・設計書改訂事実 | M9 期間に CHANGE-028〜035 起票・反映、DES-002 v1.19.0 / DES-003 v1.20.0 / DES-005 v2.19.0、次回 036 を反映 |
| 投入資料の code-facts / digest 維持 | retrospective-log は **起動時必読から外す(任意・更新責任は設計担当に残す)**、起動時必読は `retrospective-digest.md`(#10、設計担当には読み取り専用)。`code-facts.md`(#11)を必須投入で維持。digest / code-facts は投入直前に再生成する注記を更新 |
| ロール指定 | §2 冒頭を **React / TypeScript フロント状態管理・画面設計(UI/UX)・コンポーネント設計・API 連携・バリデーション・テスト自動化**に精通したシニアエンジニアへ文言調整(M9 のデータ変換比重を下げ、M10 の UI 比重へ) |
| progress-summary 対象範囲 | M0〜M9(v1.6.0)へ前進。§9 = M9 期間・§10 = M10 着手時点の持ち越し課題 |
| 直近指示書(任意投入) | M10 の指示書は未作成のため、テンプレ参照は直近完成版の M9-03 / M9-04 + レビューチェックリストを任意投入に設定 |
| ドキュメント体系について段落 | 恒久情報は B グループ専用ファイルに分離済み・過去資料はアーカイブ済みで要時提示、の定常文を維持(digest / code-facts / retrospective-log の役割分担を踏襲) |

---

## 6. 改訂履歴

| 日付 | 内容 |
|------|------|
| 2026-06-17 | M9 完了 → M10 着手に伴い `m10-startup-kit.md` を `m9-startup-kit.md` から流用作成(`/next_milestone_kit M10`)。CHANGE-028〜035 反映・DES-002 v1.19.0 / DES-003 v1.20.0 / DES-005 v2.19.0 / 次回 036。主 handover = m9-to-m10-handover、FR701 引き継ぎ 2 本を任意降格。§0 作業順序を M10-01(A-1 ComboEditor キャラ選択化)起点へ書き換え、ロール指定を UI・画面設計・フロント状態管理中心へ調整。retrospective-digest(M9-1〜M9-6 反映済)/ code-facts(2026-06-17 再生成)/ progress-summary(M0〜M9、v1.6.0)を最新化して同梱 |
| 2026-06-17 | §2 プロンプト末尾に **「添付ファイルの受領確認(実験運用)」4 ステップ** を追加(複数ファイル添付時の一部未着・認識遅延への対処)。ハイブリッド方式 = 届いたものは読み始めつつ、必須 18 件をマニフェスト照合し不足はファイル名単位で報告(見当たらない時はまず再走査)、必須が揃うまで成果物生成・設計判断はゲート、全件受領後に M10-01 着手前確認へ。§3 補足に実験運用の評価・展開方針の注記を追加。本キット限定の実験的変更 |
