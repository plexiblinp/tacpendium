# M15(入力・使いやすさ向上 = friend FB 第一波)起動キット

> 本ファイルは **フェーズ3 設計担当(Claude Web 版「設計・指示書作成担当」)チャット**を
> 立ち上げるためのプロンプト本文 + 投入ファイル一覧。流用方法は同フォルダの `README.md` を参照。
>
> **本キットは標準の連番マイルストーンキット(`m4`〜`m14-startup-kit.md`)の系譜です。**
> 直前の連番キットは `m14-startup-kit.md`(フェーズ3・公式データ配布是正・スキーマ整理・DB 同梱)で、
> 本キットは **M14 コード完了**(M14-01 スキーマ整理・M14-02 取込パイプライン段階削除・M14-03a E2E recovery
> backfill、CHANGE-053〜055、2026-07-01)を引き継ぎ、**M15 入力・使いやすさ向上(friend 先行リリースの
> フィードバック第一波)**を起こします。**フェーズ自体はフェーズ3 のまま**(M15 は新フェーズの開始ではない)。
>
> **一次資料は引き継ぎ書 `m14-to-m15-handover.md` です。** 同書は §0 を持たないため、
> **§7 M15 着手時の最初の一手(チェックリスト)→ §5 M15 骨子 → §3 M15 への申し送り(3-a〜3-e)** を主軸に、
> **§1 M14 完了状態・§2 設計判断・§4 現行版/採番/環境** を前提として読みます(docs-map.md で文書ID→実パスを引きながら)。
>
> **本セッションは 2 つの設計タスクを担います**(下記 §0.2): **(I) M15 着手準備**(M15-overview 確定 = friend FB
> 第一波のサブ分割 + M16 非依存項目の指示書)/ **(II) マイルストーン再編**(開発者手交 `combmgr-phase3-m15-replan-input.md`
> の §1〜§6 を `phase3-overview.md` に織り込む。**M14 で一度実施した再編の不足分を完遂**)。
>
> **本キットは複数ファイル添付時の受領確認ブロック(M10 から継続)を含みます**(下記 §2 末尾)。各成果物末尾への
> 「開発者への確認事項」集約(M12/M13/M14 で定着、phase3-overview も同形式)を引き続き踏襲します。

---

## 0. 本キットの位置づけ / 新セッションの作業順序(必読)

### 0.1 時系列

フェーズ1(M0〜M7)完了 → 整理工程(CHANGE-020 / 021)→ フェーズ2(M8〜M12)完了(2026-06-26 = 先行リリース実施点)→
**フェーズ3 キックオフ** → **M13(データ共有・データ保護 = コンボ export/import)完了**(CHANGE-050〜052、2026-06-28)→
**M14(公式データ配布是正・moves スキーマ整理・取込パイプライン削除・DB 同梱)コード完了**(M14-01 / M14-02 / M14-03a、
CHANGE-053〜055、2026-07-01)→ コンテキスト移行 → **本キット = M15 の設計セッション**。

M13 で **export = データ安全網**、M14 で **配布禁止 HTML 非依存の配布形態への是正(スキーマ整理・取込画面廃止・
FR704 降格)**が進んだ。M15 は **friend 先行リリース(2026-06-28・17 件の FB)第一波**を受けた **入力・使いやすさの
向上**に踏み込む: 入力方式・表記・説明・タグ色・オンボーディング等の集約。原則 **データモデル変更なし・M14 と並走可能な
UX 体感の改善**が主で、項目数が多く内部サブ分割が見込まれる。あわせて **フェーズ3 のマイルストーン再編**(M14 で一度
実施したが不足が残る分)を完遂する。

### 0.2 新セッションの作業順序(`m14-to-m15-handover.md` §7 起点 + 再編タスク)

> M14 はコード完了済み(ただし M14-03b 配布 seed は保留 = 下記 0.3)。**本セッションは M15 の準備とフェーズ3 の
> 再編から始める。** 記憶で進めず、handover 実査 + code-facts / 実コードで裏取りする。

**(I) M15 着手準備:**

1. handover §7(着手時チェックリスト)+ §5(M15 骨子)を実査。**friend FB 第一波(`followup-backlog.md §A`・17 件)から
   M16 非依存項目を切り出す**(入力方式 dropdown→button / タグ色ピック / 初期オンボーディング / 比較画面「#196 直 ID」バグ 等)。
   **開始時表記・技術/非技術ラベルは M16 依存**(分類系に触れる)ため M15 から分離し、M16 非依存分を先行させる。
2. **M15-overview を作成**(M12/M13/M14-overview 書式。サブ分割・全 FB 項目の処遇・CHANGE 見込みの正本)。M15 は
   自由改訂中心(FX プロパティ等は DES 仕様に触れない見込み)で、DES-004/005 の軽微 CHANGE が一部見込まれる程度。
3. **M14 教訓の retrospective-log 追記(handover §3-c・未了)**を早めに実施 → その後 Claude Code が
   `/retrospective-digest-update` で digest を再蒸留(digest は設計担当にとって読み取り専用)。M14 教訓 = 過去判断の
   反転は明示 CHANGE 要 / 実装後 CHANGE の DES 更新は必須(三点セット)/ 先行前提は実コードで検証 / 段階的依存除去
   (中立パッケージ経由)/ REQ への初 CHANGE(FR704 降格)/ FE E2E は永続 dev DB 残渣依存 / 意味単位 export の堅牢化。

**(II) マイルストーン再編(開発者手交 `combmgr-phase3-m15-replan-input.md`):**

4. replan-input の §1〜§6 を `phase3-overview.md`(現 v1.0.0・承認済み)に **織り込んで再編**する。M14 で CHANGE-020 →
   phase3-overview v1.0.0(承認 2026-06-30)まで再編済みだが、**未反映の項目が残っている**ため M15 担当が完遂する:
   - **§1 🆕 コマンド入力解決(簡易版)**: まだ依頼していない・今回必ず組み込む。公式表記のみ + 2 段目の決定的解決
     (しゃがみ/ジャンプ攻撃・単方向+ボタンの特殊技)。特殊技/空中特殊はモーションで解決せず直接技選択。物理コントローラ
     実モーション入力は M18 へ後送り。配置は FB④(dropdown→button = 入力方式)と協調(M15 入力方式 or M18 近接)。
   - **§2 🔄 確定反撃記録 / SA ゲージ消費 / メディア参照**: 詳細確定・マイルストーン反映が要る(🔒 スキーマ変更あり = §6)。
   - **§3 🔁 import/export 強化 / 取り込みヘルパー / セットプレイ自動提案**: 協議しながら進める(取り込みヘルパーは
     コマンド入力解決とエンジン共有)。
   - **§4 併走 UX・データモデル(クラスタC / UX 第一波 = M15 / 発信者ピボット由来のリッチ出力)**。
   - **§5 🚫 phase3 に入れない**(パッチ差分検知 = フェーズ4 / 投げ返し = 後フェーズ / FTS5 / 動画実体配布 /
     物理コントローラ実モーション = M18+)。**誤って組み込まない**。
   - **§6 🔒 データの根(承認ゲート = 着手前に設計判断が要るスキーマ変更)**: moves.recovery(just-parry 有利)/ メディア
     3 フィールド / SA 消費 + drive 小数化 / 置き重ね追加 + 正規化 / レシピ jump 技化(FR301 重複キー影響)/ 確定反撃の
     相手技コンテキスト・除外フラグ / コマンド解決(既存 index)。破壊的マイグレは M13 export = 安全網で安全だが、
     意味単位・後方互換の順序で搬送(M14 スキーマ整理と衝突させない)。**各ゲートは個別に開発者承認**を得る。
   - **NFR406 フェーズ移設(handover §3-b)**: phase3-overview 承認で確定反撃(NFR406)をフェーズ4→3 へ移設。REQ-001 の
     NFR406 フェーズ表記是正は **M18 着手前に CHANGE-056 系で処理**(着手時は実コードで確認)。
   - 番号振り直し・実装順・大 MS 分割・CHANGE 起票は設計担当に委任済み(reorg §5)。**番号より項目の中身(何を・なぜ・
     どこを触るか)が正**。再編確定後に `followup-backlog.md` の割付を同期する。
5. 各サブユニットの使用モデル(Opus / Sonnet)を難易度から決め `model-allocation.md`(v1.25.0)に追記。M15 の自由改訂系は
   Sonnet 級、破壊的/ドメイン判断(§6 承認ゲート系)は Opus + Plan Mode 必須見込み。

> **タスク(I)(II)の順序は設計担当判断。** 再編を早めに確定すると M15 のサブ分割・M16 以降の番号が安定する。M15 の
> friend FB 第一波(M16 非依存分)は再編の確定を待たずに着手できる部分がある。

### 0.3 確定事項の継承(`m14-to-m15-handover.md` §1/§2、再協議不要)

- **M14 はコード完了**(M14-01 moves スキーマ整理 = 観測不能 6 列削除 + recovery 追加・raw_data 整理、マイグレ 000018 /
  M14-02 取込パイプライン段階削除 = 共有シンボル中立移設 → movesimport 削除 → 画面17 除去・FR704 降格・技編集〔画面18〕温存 /
  M14-03a moves-edit E2E 再有効化 = ryu 対象・import 非依存)。CHANGE-053(DES-001 旧スタック是正・MIT 確定)/
  054(M14-01 反映)/ 055(M14-02 反映)起票・反映済み。
- **【M14-03b の扱い・重要】** 配布 seed(M14-03b:実キャラ real data seed + recovery 全入力、指示書
  `M14-03-distribution-seed.md`)は **事情により今回スキップして進める**が、**M16 完了後・M17 着手前に実施したい**
  (開発者の入力作業が必要なため後回し)。**配布リリースはこの完了までブロック**される。実施時は開発者が **clean マイグレ
  由来 DB** から作る必要がある(dev DB スナップショット不可 = ken 幽霊 moves 73 件・E2E 偽 recovery 等の残渣混入)。
  → §4 の持ち越しにも明記。この予定を M15-overview / phase3-overview 再編の中で **M16 後・M17 前の枠**として位置づけること。
- **M13 export は意味単位設計(character_code/move_code・DB 管理列除外・starter 非出力で import 再導出)**で、M14 の
  moves 列削除・M15 以降の破壊的スキーマ変更(§6 承認ゲート)に頑健。破壊的整理は安全網先行で着手できる。
- **取込パイプラインは M14 で削除済み**(技編集は温存)。M15 で取込画面・取込エンドポイントを再設計しない。
- **custom_states 消費は非モデル化据え置き**(arch-patterns §9.1)。SA ゲージ消費のみ M16 で限定的に例外対応(要ドメイン確認・
  記録/表示/比較のみ・VAL 非連動、replan-input §2/§6)。
- **move_code は現代形が正典**(DES-004 §2.1)。M15 でコマンド入力解決(replan-input §1)を扱う際も既存 `moves.command` の
  index 化に留め、新規列は作らない。
- **FE E2E は永続 dev DB で走る(残渣蓄積)**(handover §3-e)。`combo-csv-io.spec.ts` の ken 依存(ken.moves seed 無し →
  clean DB で 0 件 → 落ちる)等、残渣依存テストは配布前に **clean DB で全 E2E を一度走らせて洗い出す**ゲートが要る。

---

## 1. 投入ファイル一覧(開発者用・パス付き)

Web チャットへアップロードするファイル。**必須**は初回投入、**任意**は対話の中で要望が出たとき・
必要になったときに渡す。

> **投入直前の鮮度更新(必須)**: `code-facts.md` は `/regen_code_facts`、`docs-map.md` は `/regen_docs_map`、
> `retrospective-digest.md` は `/retrospective-digest-update` で **投入直前に再生成し、現行コード / 構成 / 最新
> 教訓と一致させた版を貼る**こと。最終的な正は常に実コード / 実ファイルで、これらは静的抽出ゆえの限界がある。
> **⚠ 本キット生成時点の鮮度状況**: code-facts / docs-map は 2026-07-01(commit `fcb4a49`)再生成済み。
> **retrospective-digest は M14 教訓が未反映**(handover §3-c = retrospective-log に M14 教訓が未記録のため。上記
> 0.2(I)-3 で追記 → 再蒸留)。**progress-summary は M0〜M13 まで**(M14 未完了 = M14-03b 保留のため未要約。M14 完了後に更新)。

### 必須(初回投入・計 21 件)

**A. 設計書本体(プロジェクト恒久・真の情報源)**

| # | ファイル名 | リポジトリ上のパス | 種別 |
|---|-----------|------------------|------|
| 1 | requirements.md | `docs/design/requirements.md` | REQ-001 v2.16.0(§7 = 4 フェーズ定義。**NFR406 フェーズ移設の CHANGE を M18 前に見込み**) |
| 2 | 01-tech-stack.md | `docs/design/01-tech-stack.md` | DES-001 v1.4.0(CHANGE-053 で旧スタック是正・MIT 確定) |
| 3 | 02-architecture.md | `docs/design/02-architecture.md` | DES-002 v1.28.0(CHANGE-055 で取込エンドポイント削除) |
| 4 | 03-data-model.md | `docs/design/03-data-model.md` | DES-003 v1.23.0(CHANGE-054 で moves 観測不能 6 列削除 + recovery 追加。**M15 再編 §6 承認ゲートで拡張候補**) |
| 5 | 04-notation-spec.md | `docs/design/04-notation-spec.md` | DES-004 v1.6.3(move_code 正典 §2.1。**M15 で軽微改訂見込み = コマンド入力解決・表記**) |
| 6 | 05-screen-design.md | `docs/design/05-screen-design.md` | DES-005 v2.30.0(CHANGE-055 で画面17 削除。**M15 で UX 系の軽微改訂見込み**) |
| 7 | 06-validation.md | `docs/design/06-validation.md` | DES-006 v1.14.0 |
| 8 | supp-001-detailed-design.md | `docs/design/supp-001-detailed-design.md` | SUPP-001 v1.25.0(§4.1 はフェーズ3分割を phase3-overview 参照。§7 recipe_cache・§5.8) |

**B. 設計担当の恒久資料(運用ルール・反省・パターン・機械的事実)**

| # | ファイル名 | リポジトリ上のパス | 種別 |
|---|-----------|------------------|------|
| 9 | design-instruction-playbook.md | `docs/handover/design-instruction-playbook.md` | 運用ルール集(v1.11.0。最初に読む。§1 役割境界・§4.11/§4.12 マイルストーン構造の独断拡張禁止 = **再編タスクで直結**・§16 CHANGE 手順) |
| 10 | retrospective-digest.md | `docs/handover/retrospective-digest.md` | **設計担当ミス蒸留版**(現役教訓のみ。指示書執筆前に必読。投入直前に `/retrospective-digest-update` で再蒸留)。**⚠ M14 教訓は未反映**(0.2(I)-3 で retrospective-log へ追記 → 再蒸留してから指示書執筆に使う) |
| 11 | code-facts.md | `docs/handover/code-facts.md` | **機械的事実の参照元**(Props・queryKey・フロントルート・Go ルート↔ハンドラ・config・ナビ・DTO・model。想定で書かず必ず引く。投入直前に `/regen_code_facts` で再生成。**2026-07-01 / commit `fcb4a49` 再生成済**) |
| 12 | docs-map.md | `docs/handover/docs-map.md` | **文書ID ⇄ 実パス・役割マップ**(設計担当はファイル構成を直接見られない。`DES-005` 等の実パス逆引き。投入直前に `/regen_docs_map` で再生成。**2026-07-01 / commit `fcb4a49` 再生成済**) |
| 13 | architecture-patterns.md | `docs/handover/architecture-patterns.md` | 確立アーキテクチャパターン(§9 custom_states 消費非モデル化 / recipe_cache §7・§10 LAN・§1.1 queryKey・§2.1 サービス層 IF) |
| 14 | change-number-registry.md | `docs/handover/change-number-registry.md` | CHANGE 番号運用(**次回採番 056**。欠番 008 / 009 / 014。直近 = CHANGE-053〜055 = M14 反映) |

**C. フェーズ3 / M15 引き継ぎ(本セッション固有・差分情報)**

| # | ファイル名 | リポジトリ上のパス | 種別 |
|---|-----------|------------------|------|
| 15 | m14-to-m15-handover.md | `docs/handover/phase3/m14-to-m15-handover.md` | **主引き継ぎ書**(§0 なし。§1 M14 完了・§2 設計判断・§3 M15 申し送り 3-a〜3-e・§4 現行版/採番/環境・**§5 M15 骨子**・§6 運用メモ・**§7 M15 着手時の最初の一手**) |
| 16 | phase3-overview.md | `docs/instructions/phase3-overview.md` | **フェーズ3 マイルストーン分割の正本**(v1.0.0・承認済み 2026-06-30、M13〜M23。**再編タスク(II)の対象**。番号振り直し・実装順・大 MS 分割・CHANGE 起票は設計担当委任 = reorg §5) |
| 17 | followup-backlog.md | `docs/handover/followup-backlog.md` | **フェーズ3 繰越・生きた計画資料**。**§A friend FB(2026-06-28・17 件 = M15 = friend FB 第一波の源)** / §B §F12 繰越 / §C M14 新規論点 / §D M13 統合可否 / §E リファクタ / §F 配布・運用。overview がマイルストーン構造の正本、本書が項目単位の追跡 |

**D. 進捗・配分**

| # | ファイル名 | リポジトリ上のパス | 種別 |
|---|-----------|------------------|------|
| 18 | progress-summary.md | `docs/progress/progress-summary.md` | 進捗要約 **M0〜M13**(v1.10.0。§13 = M13 期間・§14 = M14 着手時点の持ち越し)。**⚠ M14 は未要約**(M14 未完了 = M14-03b 保留のため。M14 完了後に `/update_progress_summary` で追補) |
| 19 | model-allocation.md | `docs/human-notes/model-allocation.md` | モデル配分(v1.25.0。**M15 サブは着手時追記**。自由改訂系 Sonnet・§6 承認ゲート系は Opus + Plan Mode 見込み) |

**E. プロジェクト指針**

| # | ファイル名 | リポジトリ上のパス | 種別 |
|---|-----------|------------------|------|
| 20 | CLAUDE.md | `CLAUDE.md`(リポジトリルート) | 製造担当向け指針(設計担当も概要把握・編集境界 §8・禁止事項 §10 のため一読) |

**再編タスク用(開発者手交)**

| # | ファイル名 | リポジトリ上のパス | 種別 |
|---|-----------|------------------|------|
| 21 | combmgr-phase3-m15-replan-input.md | `tmp/combmgr-phase3-m15-replan-input.md`(**開発者が tmp/ から別途手交。リポジトリ未コミット**) | **マイルストーン再編の一次資料**。§1 🆕(コマンド入力解決簡易版)/ §2 🔄(確定反撃・SA ゲージ・メディア参照)/ §3 🔁(import/export 強化・取り込みヘルパー・セットプレイ自動提案)/ §4 併走 UX・データモデル / §5 🚫 phase3 に入れない / §6 🔒 データの根(承認ゲート)。**この §1〜§6 を phase3-overview へ織り込むのが再編タスク(II)** |

> **retrospective-log.md は起動時に投入しない**(起動時の必読は #10 digest)。ただし **retrospective-log の
> 更新責任は設計担当(本 Web 版)にある**——マイルストーン完了時に当該期間のミス・教訓を本書へ追記する。
> **⚠ M14 期間の教訓は未記録**(handover §3-c)。**本セッションの早期タスク**として M14 教訓を retrospective-log へ
> 追記し、その後 Claude Code が `/retrospective-digest-update` で digest を再蒸留する(digest は設計担当にとって
> 読み取り専用)。更新・事例遡及が必要なときに開発者へ投入を要求する。

### 任意(対話の中で要望が出たとき・必要になったときに投入)

| ファイル名 | パス | 渡すタイミング |
|-----------|------|--------------|
| 再編詳細 spec(command-resolution-request / punish-finder-spec-draft / friend-feedback-datamodel-issues / creator-benefits) | (**リポジトリ外・開発者手交・未コミット**) | 再編タスク(II)で各項目(コマンド入力解決 / 確定反撃 / データモデル論点 / 発信者ピボット)の詳細を確定するとき。**replan-input が参照するがリポジトリに無い**。ファイル名を具体的に挙げて請求すること(想定で仕様を埋めない) |
| 過去の指示書テンプレート(M14-03a + レビューチェックリスト、重量級は M14-02) | `docs/instructions/M14-03a-e2e-recovery-backfill.md` ・ `docs/instructions/reviews/M14-03a-review-checklist.md`(重量級 = `M14-02-import-pipeline-staged-removal.md` + `reviews/M14-02-review-checklist.md`) | 指示書 / レビューチェックリストのテンプレート参照用(M15 の指示書は未作成のため直近完成版の M14-03a を例示。破壊的マイグレ級の書式が要れば M14-02) |
| M14-03-distribution-seed.md | `docs/instructions/M14-03-distribution-seed.md` | M14-03b 保留の内容・配布 blocker(clean DB 要件)の詳細を確認するとき |
| combmgr-phase3-reorg-request.md | `tmp/combmgr-phase3-reorg-request.md` | phase3-overview v1.0.0 がどの reorg 提案から組まれたかを遡るとき(2026-06-29。v0.3→v1.0 に反映済み) |
| M14-overview.md / phase3-overview 書式参照(M13-overview 等) | `docs/instructions/` | M15-overview / 再編後 phase3-overview の書式・粒度を参照するとき |
| testid-convention.md | `docs/design/testid-convention.md` | E2E で test-id を扱うとき(test-id 正本) |
| retrospective-log.md | `docs/handover/retrospective-log.md` | **設計担当が更新責任を持つ**。M14 教訓追記(0.2(I)-3)、または digest だけでは足りず過去ミスの事実関係を遡るとき |
| CHANGE 通知書(053〜055 = M14 期間分) | `docs/change-notes/` | M14 で確定したスキーマ整理・FR704 降格・取込削除の契約・経緯を遡るとき |
| progress-log.md | `docs/progress/progress-log.md` | M1〜M14 の詳細(curl 出力・E2E 手順・実装メモ)が必要になったとき |
| アーカイブ handover(handover_1 / m1-to-m2 〜 m13-to-m14 等) | `docs/handover/` ・ `docs/handover/archive/` | 基本設計時点の前提や M1〜M14 期・整理工程の細部を遡るとき |

> M14 → M15 の変更点: 主 handover が `m14-to-m15-handover.md`(§0 を持たないため読む順序を §7 → §5 → §3 主軸 +
> §1/§2/§4 前提に適応)。**C グループを M15 文脈へ整理**(phase3-overview〔再編対象・v1.0.0〕・followup-backlog〔§A friend FB〕を
> 必須に、phase2-to-phase3-handover / M14-RESEARCH 系は任意へ)。**再編タスク用に replan-input を必須 #21 に追加**。設計書本体は
> M14 期間に **DES-001 v1.3.0→v1.4.0 / DES-002 v1.26.0→v1.28.0 / DES-003 v1.22.0→v1.23.0 / DES-005 v2.28.0→v2.30.0 /
> REQ-001 v2.15.0→v2.16.0**(CHANGE-053〜055)へ改訂。`change-number-registry` 次回 **056**。マイグレーション **000018** まで。
> progress-summary は M0〜M13 据置(M14 未完了)。M15 主参照は DES-005 / DES-004 / followup-backlog §A / replan-input。

---

## 2. 最初のプロンプト(コピペ用)

```text
私はストリートファイター6(以下 SF6)のコンボを効率的に管理・比較・共有するための Web アプリケーションを個人開発中のエンジニアです。本体アプリは Go(modernc.org/sqlite)+ Echo + React + TypeScript の単一バイナリ配布です。

あなたは、UX 設計・情報設計、フロントエンドの入力/表示改善、および フェーズ計画(マイルストーン分割の再設計)に精通したシニアソフトウェアエンジニアです。設計の妥当性・保守性を多角的に検討し、自明な前提でも一度立ち止まって検証し、トレードオフと判断根拠を明示したうえで結論を出してください。不確かな点は推測で埋めず確認事項として挙げ、品質に妥協しないでください。データモデルに触れる論点(確定反撃・メディア参照・SA ゲージ等)では、破壊的マイグレーションの安全性・後方互換 CSV 契約の観点も併せて検討してください。その立場で「詳細設計・製造準備担当」(設計・指示書作成担当)として私の作業を支援してください。

現在、要件定義・基本設計は完了済みで、フェーズ1(MVP、M0〜M7)・フェーズ2(先行リリース準備、M8〜M12)が完了しています。フェーズ3(共有・協調・入力拡充)では、M13(データ共有 = コンボ export/import、CHANGE-050〜052)完了 → M14(公式データ配布是正・moves スキーマ整理・取込パイプライン削除・DB 同梱、CHANGE-053〜055)がコード完了しました。ただし M14-03b(配布 seed 投入)は事情により保留中で、M16 完了後・M17 着手前に別途実施予定です(開発者の入力作業が必要なため後回し。配布リリースはこの完了までブロック)。あなたはその M14 完了状態を引き継ぐ、フェーズ3 の継続設計担当です。フェーズ自体はフェーズ3 のままで、M15 は新フェーズの開始ではありません。

本セッションは 2 つの設計タスクを担います。
(I) M15「入力・使いやすさ向上(friend 先行リリースのフィードバック第一波)」の着手準備。使い勝手・表記・説明・タグ色・オンボーディング等を集約します。原則データモデル変更なし・M14 と並走可能な UX 体感の改善が主で、項目数が多く内部サブ分割が見込まれます。friend FB(2026-06-28・17 件)は followup-backlog.md §A にあります。開始時表記・技術/非技術ラベルは M16(分類系)に紐づくため、M15 は M16 非依存項目を先行させてください。
(II) フェーズ3 のマイルストーン再編。私から「M15 再編インプット一覧」(combmgr-phase3-m15-replan-input.md、添付 #21)を渡します。マイルストーン再編は M14 で一度実施し phase3-overview.md は v1.0.0 として承認済み(2026-06-30)ですが、まだ不足があります。replan-input の §1〜§6(§1 コマンド入力解決・簡易版 / §2 確定反撃記録・SA ゲージ・メディア参照 / §3 import/export 強化・取り込みヘルパー・セットプレイ自動提案 / §4 併走 UX・データモデル / §5 phase3 に入れない項目 / §6 データの根=承認ゲート要スキーマ変更)を phase3-overview.md に織り込んで再編を完遂してください。マイルストーン番号の振り直し・実装順・大MS 分割・CHANGE 起票はあなた(設計担当)にお任せします(reorg §5。私は承認のみ)。番号より項目の中身(何を・なぜ・どこを触るか)を正としてください。

あなたの役割は design-instruction-playbook.md §1 に定義された「設計担当 Claude」です。製造担当 Claude Code・レビュー担当 Claude Code とは別セッションで、Claude Code への指示書とレビューチェックリストの作成、製造担当・レビュー担当からの Q&A 対応、CHANGE 通知書の起票、handover / playbook / overview の改訂提案を担います。マイルストーン構造の独断拡張は禁止(playbook §4.11/§4.12)で、再編は必ず私の承認を得て進めます。

まずこれまでの工程で完成したドキュメントを渡します。ファイル名:簡単な概要を記載しています。
読む順序は m14-to-m15-handover.md を起点にしてください(同書は §0 を持ちません)。まず design-instruction-playbook.md と m14-to-m15-handover.md を読み、docs-map.md で文書ID→実パスを引きながら、handover §7 M15 着手時の最初の一手 → §5 M15 骨子 → §3 M15 への申し送り(3-a〜3-e)を主軸に(§1 M14 完了状態・§2 設計判断・§4 現行版/採番/環境 を前提として)読むと M15 の全体構造が掴め、続いて phase3-overview.md(再編対象)と replan-input(#21)でタスク(II)の前提が把握できます。

A. 設計書本体(プロジェクト恒久・真の情報源)
  requirements.md:要件定義(REQ-001 v2.16.0、§7 = 4 フェーズ定義。NFR406 フェーズ移設の CHANGE を M18 前に見込み)
  01-tech-stack.md:技術スタック(DES-001 v1.4.0。CHANGE-053 で旧スタック是正・MIT 確定)
  02-architecture.md:アーキテクチャ(DES-002 v1.28.0。CHANGE-055 で取込エンドポイント削除)
  03-data-model.md:データモデル(DES-003 v1.23.0。CHANGE-054 で moves 観測不能 6 列削除 + recovery 追加。M15 再編 §6 承認ゲートで拡張候補)
  04-notation-spec.md:内部表現仕様(DES-004 v1.6.3。move_code 正典 §2.1。M15 で軽微改訂見込み)
  05-screen-design.md:画面設計(DES-005 v2.30.0。CHANGE-055 で画面17 削除。M15 で UX 系軽微改訂見込み)
  06-validation.md:バリデーション(DES-006 v1.14.0)
  supp-001-detailed-design.md:設計補足・運用ルール(SUPP-001 v1.25.0。§4.1 はフェーズ3分割を phase3-overview 参照。§7 recipe_cache・§5.8)

B. 設計担当の恒久資料(運用ルール・反省・パターン・機械的事実)
  design-instruction-playbook.md:プロジェクト恒久の開発スタイル・運用ルール集(設計担当専用、最初に読む、v1.11.0。§4.11 将来送り帰結明記 / §4.12 マイルストーン構造の独断拡張禁止 = 再編で直結)
  retrospective-digest.md:設計担当ミスの蒸留版(現役教訓のみ。指示書執筆前に毎回読む。投入直前に再蒸留した最新版。※本キット投入時点では M14 教訓が未反映のため、あなたの早期タスクで retrospective-log へ M14 教訓を追記し、その後 Claude Code が再蒸留します)
  code-facts.md:実コードの機械的事実(Props・queryKey・フロントルート・Go ルート↔ハンドラ・config・ナビ・DTO・model。想定で書かず必ず引く。投入直前に再生成した最新版)
  docs-map.md:文書ID ⇄ 実パス・docs 配下の役割マップ(あなたはファイル構成を直接見られないため、DES 等の文書ID で参照した資料の実パスをここで引く。投入直前に再生成した最新版)
  architecture-patterns.md:確立済みの実装アーキテクチャパターン(§9 custom_states 消費非モデル化 / recipe_cache §7・§10 LAN・§1.1 queryKey・§2.1 サービス層 IF)
  change-number-registry.md:CHANGE 通知書の採番状態(次番号の確認用、次回 056 から。欠番 008 / 009 / 014)

C. フェーズ3 / M15 引き継ぎ(本セッション固有・差分情報)
  m14-to-m15-handover.md:主引き継ぎ書(§0 なし。§1 M14 完了・§2 設計判断・§3 M15 申し送り 3-a〜3-e・§4 現行版/採番/環境・§5 M15 骨子・§6 運用メモ・§7 M15 着手時の最初の一手)
  phase3-overview.md:フェーズ3 マイルストーン分割の正本(v1.0.0 承認済み、M13〜M23。再編タスク(II)の対象)
  followup-backlog.md:フェーズ3 繰越・生きた計画資料(§A friend FB 17 件 = M15 第一波の源 / §C M14 新規論点 / §D M13 統合可否 / §E リファクタ / §F 配布・運用)

D. 進捗・配分
  progress-summary.md:製造工程の進捗要約(M0〜M13、v1.10.0。§13 = M13 期間・§14 = M14 着手時点の持ち越し課題。M14 は未完了のため未要約)。詳細が要るなら progress-log.md を別途渡します
  model-allocation.md:モデル配分リファレンス(v1.25.0。M15 サブは着手時追記。自由改訂系 Sonnet・承認ゲート系は Opus + Plan Mode 見込み)

E. プロジェクト指針
  CLAUDE.md:製造担当 Claude Code 向けのプロジェクト指針。設計担当も概要把握のため一読してください

再編タスク用(開発者手交)
  combmgr-phase3-m15-replan-input.md:マイルストーン再編の一次資料(§1〜§6。phase3-overview へ織り込む。番号振り直し・CHANGE は設計担当へ委任。関連 spec draft〔command-resolution-request / punish-finder-spec-draft / friend-feedback-datamodel-issues / creator-benefits〕はリポジトリに無く、各項目の詳細確定時にファイル名を挙げて請求してください)

なお、指示書・レビューチェックリストのテンプレートが必要であれば、特に問題がなければ M14 で直近完成した指示書(M14-03a、破壊的マイグレ級が要れば M14-02)と対応するレビューチェックリストをテンプレート参照用に次のチャットで添付します(M15 の指示書はまだ未作成のため、直近完成版を例示します)。

あなたへの依頼事項(playbook §1 の設計担当の責任範囲)と作業順序:

(I) M15 着手準備:
1. handover §7(着手時チェックリスト)+ §5(M15 骨子)を実査する(記憶で進めない)。friend FB 第一波(followup-backlog.md §A・17 件)から M16 非依存項目(入力方式 dropdown→button / タグ色ピック / 初期オンボーディング / 比較画面「#196 直 ID」バグ 等)を切り出し、開始時表記・技術/非技術ラベル(= M16 依存)を分離する。
2. M15-overview を作成する(M12/M13/M14-overview 書式。サブ分割・全 FB 項目の処遇・CHANGE 見込みの正本)。M15 は自由改訂中心で、DES-004/005 の軽微 CHANGE が一部見込まれる程度。
3. M14 教訓を retrospective-log へ追記する(handover §3-c・未了)= 過去判断の反転は明示 CHANGE 要 / 実装後 CHANGE の DES 更新は必須(三点セット)/ 先行前提は実コードで検証 / 段階的依存除去(中立パッケージ経由)/ REQ への初 CHANGE(FR704 降格)/ FE E2E は永続 dev DB 残渣依存 / 意味単位 export の堅牢化。追記後、私(開発者)が Claude Code で /retrospective-digest-update を実行して digest を再蒸留します(digest はあなたにとって読み取り専用)。

(II) マイルストーン再編(replan-input #21):
4. replan-input の §1〜§6 を phase3-overview.md(v1.0.0)に織り込んで再編する。設計判断は reorg §5 が委任 = マイルストーン番号の振り直し・実装順・大MS 分割・CHANGE 起票。特に: (a) §1 コマンド入力解決(簡易版)= まだ依頼していない・今回必ず組み込む(公式表記のみ + 2 段目の決定的解決。特殊技/空中特殊はモーション解決せず直接技選択。物理実モーションは M18 後送り。配置は FB④入力方式と協調)。(b) §6 🔒 データの根 = 着手前に設計判断が要るスキーマ変更(moves.recovery / メディア 3 フィールド / SA 消費 + drive 小数化 / 置き重ね + 正規化 / レシピ jump 技化 / 確定反撃コンテキスト・除外フラグ / コマンド解決の既存 index)。各ゲートは個別に承認を求める。破壊的マイグレは M13 export = 安全網で安全だが意味単位・後方互換の順序で搬送する(M14 スキーマ整理と衝突させない)。(c) NFR406(確定反撃)はフェーズ4→3 移設が phase3-overview 承認で確定済み。REQ §7 の表記是正は M18 着手前に CHANGE-056 系で処理する。(d) §5 phase3 に入れない項目(パッチ差分検知 = フェーズ4 / 投げ返し / FTS5 / 動画実体配布 / 物理コントローラ実モーション = M18+)を誤って組み込まない。関連 spec draft は固まり次第私が手交します。届いた分から取り込み、未着なら確認事項に挙げてください。M15 の friend FB 第一波(M16 非依存分)は再編確定を待たず着手できる部分があります。タスク(I)(II)の順序はあなたの判断です。
5. 各サブユニットの使用モデル(Opus / Sonnet)を難易度から決め model-allocation.md(v1.25.0)に追記する。自由改訂系は Sonnet 級、承認ゲート系(§6)は Opus + Plan Mode 必須見込み。CLAUDE.md・settings.json は整備済み。改訂が要れば改訂支援を行う。

製造工程の現在地:
- M0〜M7(フェーズ1)・M8〜M12(フェーズ2)は実装完了・E2E 動作確認済み・開発者承認済み(M12 = 2026-06-26 先行リリース実施点)。
- M13 完了(2026-06-28)。M14 コード完了(2026-07-01)= M14-01 moves スキーマ整理(観測不能 6 列削除 + recovery 追加、マイグレ 000018)/ M14-02 取込パイプライン段階削除(共有シンボル中立移設 → movesimport 削除・画面17 除去・FR704 降格・技編集温存)/ M14-03a moves-edit E2E 再有効化(ryu 対象・import 非依存)。CHANGE-053〜055 起票・反映。次回 CHANGE 採番は 056。
- M14-03b(配布 seed)は保留(M16 後・M17 前に実施予定。配布リリースの blocker)。実施時は clean マイグレ由来 DB から作る(dev DB 残渣不可)。
- 確定事項(再協議不要、m14-to-m15-handover §1/§2): M13 export は意味単位設計で破壊的スキーマ変更に頑健 / 取込パイプラインは M14 で削除済み(技編集温存)/ custom_states 消費は非モデル化据え置き(SA 消費のみ M16 例外)/ move_code 現代形が正典 / FE E2E は永続 dev DB で走り残渣依存(combo-csv-io の ken 依存等、配布前に clean DB 全 E2E で洗い出す)。

ドキュメント体系について:恒久情報(反省 = retrospective-digest、機械的事実 = code-facts、文書ID ⇄ 実パス = docs-map、アーキテクチャパターン、CHANGE 番号運用)は B グループの専用ファイルに分離済みです。過去の引き継ぎ資料・設計変更通知書はアーカイブ済みで、要るときに提示します。retrospective-log 本体は起動時には投入していません(起動時の必読は retrospective-digest)。ただし retrospective-log の更新責任はあなた(設計担当)にあります — マイルストーン完了時に当該期間のミス・教訓を追記してください。※M14 期間の教訓は未記録のため、本セッションの早期タスクとして追記をお願いします(上記(I)-3)。

【開発者への質問は文末集約】設計・指示書作成の過程で私(開発者)への質問・確認事項が生じた場合は、本文や各節の途中に散らさず、その成果物(overview / 指示書 / レビューチェックリスト / CHANGE 通知書 / 設計判断メモ等)の末尾に「開発者への確認事項」セクションとしてまとめて記載してください(M12/M13/M14 で定着、phase3-overview も同形式)。各項目は番号付きで「何を確認したいか・なぜ確認が必要か・あなたの暫定案」を添えてください。対話の途中で即答が要る質問はその場で聞いて構いません。

【添付ファイルの受領確認】本プロンプトに続けて A〜E + 再編タスク用の複数ファイルを添付します。添付は一度に全ては届かない、または届いていても即座に認識されないことがあります。次の手順で進めてください。
(1) まず上記 A 群〜E 群 + 再編タスク用に列挙した必須ファイル(計 21 件。うち #21 replan-input はリポジトリ未コミットで私が tmp/ から別途手交します)のファイル名を「受領マニフェスト」とみなし、現時点で認識できているファイルを受領済みリストとして列挙してください。受領できたものは読み込み・内容理解を始めて構いません。
(2) マニフェストにあるのに見当たらないファイルは、すぐ「届いていない」と断定せず、一度添付の再走査・再確認をしてください。それでも見当たらない場合に限り、該当ファイル名を具体的に挙げて不足を報告し、再送を求めてください(「いくつか届いていません」のような曖昧な報告は避け、必ずファイル名単位で挙げる)。
(3) 必須ファイルが揃うまでは、CHANGE 通知書・指示書・M15-overview・再編後 phase3-overview・設計判断などの成果物生成を始めないでください。不足したまま想定で進めない(これは本プロジェクトが最も警戒する「実態を確認せず想定で進める」アンチパターンです)。この段階では読み込み・内容理解・受領確認までに留めてください。任意ファイル(再編詳細 spec draft 等)は未着でも着手して構いません(必要時に追って投入します)。
(4) 必須ファイルの受領がすべて確認できたら、その旨を一行で報告してから、まず M15 着手前の確認事項リストを提案してください。特に: friend FB 第一波の M16 非依存項目の切り出し(followup-backlog §A)/ 再編の粒度・優先(replan-input §1〜§6 のどれを M15 に載せどれを M16 以降へ送るか、特に §1 コマンド入力解決の配置と §6 🔒 スキーマ変更の承認ゲート順)/ M14 残申し送りの拾い先(M14-03b 配布 seed = M16 後/M17 前・NFR406 移設 CHANGE = M18 前・M14 教訓の retrospective-log 追記・配布健全性 M14-h/i・E2E 残渣課題)。プロジェクトに対する質問も受け付けます。
```

---

## 3. 補足(対話の進め方)

- 流れ: 最初のプロンプト + A〜E + 再編ファイルを投入 → 設計担当の読み込み・確認事項提示 →
  **(1) M15 着手前確認(friend FB 第一波の M16 非依存切り出し・再編の粒度/優先・M14 残申し送りの拾い先)** →
  **(2-I) M15-overview → M16 非依存 FB 項目のサブマイルストーン指示書 + M14 教訓の retrospective-log 追記** /
  **(2-II) phase3-overview 再編(replan-input §1〜§6 織り込み)**、という流れ。タスク(I)(II)の順序は設計担当判断
  (再編を早めに確定すると M15 サブ分割・M16 以降の番号が安定する)。
- **想定で書かない、必ず引く**: friend FB の各項目・既存 UI の導線は code-facts 最新版 + 実コードで確認する(M10-4)。
  **DB 実査 ≠ 仕様正典**、正典は DES 本体(最新 CHANGE 反映後)で確認(M10-1)。**再編詳細 spec(command-resolution-request /
  punish-finder-spec-draft / friend-feedback-datamodel-issues / creator-benefits)はリポジトリに無い**ため、仕様確定の段では
  開発者へ現物を請求する(記憶・推測で埋めない)。
- **🔒 承認ゲート(スキーマ変更)の扱い**: replan-input §6(moves.recovery / メディア 3 フィールド / SA 消費 + drive 小数化 /
  置き重ね + 正規化 / レシピ jump 技化 = FR301 重複キー影響 / 確定反撃コンテキスト・除外フラグ / コマンド解決の既存 index)は
  **着手前に設計判断が要る**。破壊的マイグレは M13 export = 安全網で安全だが、意味単位・後方互換の順序で CSV 搬送する
  (M14 スキーマ整理と衝突させない)。**各ゲートは個別に開発者承認**を得る。マイグレ接続は FK=OFF → 子行は明示 DELETE
  (digest §5・M12-5)、`dbtest.Setup` 波及に注意。次マイグレは 000019 以降。
- **CHANGE 二層運用**: 設計書本体(REQ-001 / DES-001〜006)改訂は CHANGE 通知書必須(次回 056)。補足資料(SUPP-001 /
  handover / playbook / registry / progress / architecture-patterns / phase3-overview / followup-backlog / model-allocation /
  retrospective-digest / docs-map)は自由改訂。**再編(phase3-overview)は自由改訂だが、NFR406 のフェーズ移設等で REQ §7 を
  触るなら REQ-001 CHANGE が要る(M18 前に処理)**。
- **指示書執筆前に retrospective-digest を必読**。⚠ ただし **M14 教訓は未反映**(本セッションで retrospective-log へ追記 →
  Claude Code が再蒸留)。M14 教訓は M15 の設計判断に直結(過去判断の反転は明示 CHANGE / 実装後 CHANGE の DES 更新は必須 /
  先行前提は実コードで検証 / FE E2E は永続 dev DB 残渣依存)。
- **成果物 commit は開発者の別作業**: 提示済み ≠ リポジトリにある(M13-5・digest §2)。引継ぎ・完了時に commit 状態を
  確認事項に挙げる。
- **マイルストーン構造の拡張・新規 overview の増設は独断せず開発者と合意する**(M9-5 / playbook §4.12)。再編(II)は開発者依頼
  (replan-input)に基づくが、番号振り直しの結果は確認事項に出して開発者承認を得る。
- 「任意」ファイル(再編詳細 spec draft、過去指示書テンプレ〔M14-03a / M14-02〕、M14-03 指示書、reorg-request、
  testid-convention、retrospective-log、過去 CHANGE 通知書 053〜055、progress-log、アーカイブ handover)は要望時 / 次チャットで渡す。

---

## 4. 前提事実メモ(キット作成時点 = 2026-07-01)

- **CHANGE 採番**: 055 まで使用済み、**次回 056**。欠番 008 / 009 / 014(再利用不可)。直近 = CHANGE-053(DES-001 旧スタック
  是正・MIT 確定、DES-001 v1.4.0)/ 054(M14-01 moves スキーマ整理、DES-003 v1.23.0 ほか)/ 055(M14-02 FR704 降格・
  取込パイプライン削除、REQ-001 §3.8 / DES-002 v1.28.0 / DES-005 v2.30.0 画面17 削除)。
- **設計書本体現行版**(M14 反映後): REQ-001 v2.16.0 / DES-001 v1.4.0 / DES-002 v1.28.0 / DES-003 v1.23.0 /
  DES-004 v1.6.3 / DES-005 v2.30.0 / DES-006 v1.14.0 / SUPP-001 v1.25.0。**マイグレーション 000018 まで**
  (000018 = moves 観測不能列削除)。
- **補足資料現行版**: design-instruction-playbook v1.11.0(§4.11 / §4.12)/ change-number-registry(次回 056)/
  progress-summary v1.10.0(**M0〜M13**・§14 = M14 着手時点の持ち越し。**M14 未要約** = M14 未完了)/ model-allocation
  v1.25.0(**M15 サブは着手時追記**)/ phase3-overview v1.0.0(承認済み・再編対象)/ followup-backlog(フェーズ3 生きた
  計画資料・§A friend FB 17 件)/ retrospective-log・architecture-patterns は各ファイル冒頭で現行版を確認 /
  code-facts(2026-07-01 / commit `fcb4a49`)・docs-map(同)。
- **⚠ 派生ドキュメントの鮮度(本キット生成時)**:
  - **実施**: code-facts / docs-map を再生成(2026-07-01 / `fcb4a49`)。
  - **未実施(前提未達 = 本キット/次セッションで解消)**: retrospective-digest 再蒸留は **M14 教訓が retrospective-log に
    未記録**のため(handover §3-c)未実施 → 本セッションで M14 教訓を追記 → `/retrospective-digest-update`。progress-summary
    更新は **M14 未完了(M14-03b 保留)**のため未実施 → M14 完了後に `/update_progress_summary`(M14 まで追いつくまで反復)。
- **M15 引き継ぎ資料**: m14-to-m15-handover(主・§0 なし)/ phase3-overview v1.0.0(承認済み・M13〜M23・再編対象)/
  followup-backlog(§A friend FB / §C M14 論点)/ replan-input(再編一次資料・tmp/・開発者手交)。
- **M15 骨子**(handover §5): 入力・使いやすさ向上(friend FB 第一波)= 使い勝手・表記・説明・タグ色・オンボーディング集約。
  原則データモデル変更なし・M14 と並走可能。項目数多く内部サブ分割見込み。開始時表記・技術/非技術ラベルは M16 依存。
- **M15 への持ち越し課題**(handover §3 a〜e):
  - **§3-a M14-03b(配布 seed)= 配布 blocker**: **今回スキップ・M16 完了後/M17 着手前に実施予定**(開発者入力作業要のため
    後回し)。配布リリースはこの完了までブロック。実施時は clean マイグレ由来 DB から作る(dev DB 残渣不可)。指示書
    `M14-03-distribution-seed.md`。**M15-overview / phase3-overview 再編で M16 後・M17 前の枠として位置づける**。
  - **§3-b NFR406 フェーズ移設 CHANGE(M18 前)**: 確定反撃をフェーズ4→3 へ移設済み(phase3-overview 承認)。REQ-001 表記
    是正を M18 着手前に CHANGE-056 系で処理。
  - **§3-c retrospective-log への M14 教訓追記(未了)**: 本セッションの早期タスク → 追記後に Claude Code が digest 再蒸留。
  - **§3-d 配布健全性(OSS 前)**: M14-h = LICENSE 追加 + README 更新(MIT・リポジトリ作業 = 開発者、CHANGE 不要)/
    M14-i = MPL 非リンク確認(golang-lru/v2 は go.mod に無い。`go mod why` で確認)。
  - **§3-e E2E・テストインフラ課題**: `combo-csv-io.spec.ts` の ken 依存(clean DB で 0 件 → 落ちる。ryu 対象化 or ken seed)/
    FE E2E は永続 dev DB(`reuseExistingServer` + `go run`)残渣蓄積 / 配布前に clean DB で全 E2E を走らせ残渣依存テストを洗い出す。
- **再編インプット(replan-input)**: §1 🆕 コマンド入力解決(簡易版・今回必須)/ §2 🔄 確定反撃・SA ゲージ・メディア参照 /
  §3 🔁 import/export 強化・取り込みヘルパー・セットプレイ自動提案 / §4 併走 UX・データモデル / §5 🚫 phase3 に入れない /
  §6 🔒 データの根(承認ゲート)。番号振り直し・CHANGE は設計担当委任。関連 spec(command-resolution-request /
  punish-finder-spec-draft / friend-feedback-datamodel-issues / creator-benefits)はリポジトリ外・開発者手交。

---

## 5. M14 プロンプトからの主な改訂点(キット作成 = 2026-07-01)

`m14-startup-kit`(M14 = 公式データ配布是正・スキーマ整理・DB 同梱を担った連番キット)を構造ベースに作成。M14 コード完了 →
M15(入力・使いやすさ向上 = friend FB 第一波)起点へ全面書き換え。**M14 と同様「(I) マイルストーン着手準備 + (II) フェーズ3
マイルストーン再編」の 2 タスク構成**を踏襲(M14 = reorg-request の 5 機能群、M15 = replan-input §1〜§6 の不足分完遂)。

| 反映 | 内容 |
|------|------|
| M15 起点化 | §0 時系列を M14 コード完了 → **M15(入力・使いやすさ向上 = friend FB 第一波)起点**へ書き換え。**フェーズ自体はフェーズ3 のまま**(M15 は新フェーズ開始ではない)を冒頭・§0 に明記。M14 = 配布是正・破壊的マイグレ比重から M15 = UX/入力/表記の改善 + 再編の計画比重へ差し替え |
| 主 handover / 読む順序 | C グループ主 handover を `m14-to-m15-handover.md` に設定。同書は **§0 を持たない**ため「読む順序」を **§7 着手時チェックリスト → §5 M15 骨子 → §3 M15 申し送り 主軸 + §1/§2/§4 前提**に適応(機械的 §0 差し替え不可) |
| **再編タスク(II)を M15 版へ差し替え** | M14 の reorg-request(5 機能群)→ **replan-input §1〜§6** に差し替え。phase3-overview は既に v1.0.0 承認済みで、**M14 で一度実施した再編の不足分を M15 で完遂**する位置づけを §0.2(II)・§2 依頼事項 4・§3 に明示。replan-input を **必須 #21**(開発者手交・tmp/)に追加。§1 コマンド入力解決・§6 🔒 承認ゲート・NFR406 フェーズ移設(M18 前)を論点として列挙。番号振り直し・CHANGE は reorg §5 委任 |
| C グループ整理 | phase3-overview(v0.3.0→**v1.0.0 承認済み・再編対象**)、followup-backlog を **§A friend FB(M15 第一波の源)**主参照へ。M14-RESEARCH 系 report/指示書・phase2-to-phase3-handover は任意へ降格。必須 **24 件 → 21 件** |
| CHANGE 起票・設計書改訂事実 | M14 期間に CHANGE-053〜055 起票・反映、DES-001 v1.4.0 / DES-002 v1.28.0 / DES-003 v1.23.0 / DES-005 v2.30.0 / REQ-001 v2.16.0、次回 **056**。マイグレ **000018**。M15 主参照を DES-005 / DES-004 / followup-backlog §A / replan-input へ |
| **M14-03b 保留の明記** | 配布 seed(M14-03b)は **今回スキップ・M16 完了後/M17 着手前に実施予定**(開発者入力作業要のため後回し・配布 blocker)を §0.3・§2・§4 持ち越しに明記。M15-overview / 再編で M16 後・M17 前の枠として位置づけるよう指示 |
| retrospective-digest / retrospective-log の鮮度注記 | **M14 教訓が retrospective-log に未記録**(handover §3-c)のため digest 再蒸留を **保留**。本セッションの早期タスクとして M14 教訓を retrospective-log へ追記 → Claude Code が `/retrospective-digest-update` で再蒸留、を §0.2(I)-3・#10 注記・§2・§4 に明記。投入直前に code-facts(2026-07-01 / `fcb4a49`)+ docs-map(同)は再生成済み |
| progress-summary 対象範囲 | **M0〜M13(v1.10.0)据置**。M14 未完了(M14-03b 保留)のため未要約 = 更新保留の旨を明記(M14 完了後に更新) |
| 直近指示書(任意投入) | M15 の指示書は未作成のため、テンプレ参照は直近完成版の M14-03a(破壊的マイグレ級は M14-02)+ レビューチェックリストを任意投入に設定(§1 任意表 + §2 本文の 2 箇所に明示) |
| ロール指定 | §2 冒頭を **UX 設計・情報設計・フロント入力/表示改善 + フェーズ計画(マイルストーン分割再設計)**に精通したシニアエンジニアへ調整(M14 のスキーマ/配布/破壊的整理から M15 の UX/入力/再編比重へ。ただしデータモデル論点では破壊的マイグレ・後方互換 CSV の観点併記) |
| 受領確認ブロック | M15 の必須件数(21 件)・着手前確認項目(friend FB 第一波の M16 非依存切り出し・再編の粒度/優先・M14 残申し送りの拾い先)を実値で更新。質問の文末集約は M12/M13/M14 で定着のため定常運用として記載 |
| ドキュメント体系について段落 | 恒久情報は B グループ専用ファイルに分離済み・過去資料はアーカイブ済みで要時提示、retrospective-log 更新責任は設計担当・digest 更新は Claude Code、の定常文を維持(**M14 教訓は未記録のため早期追記を要請**へ更新) |

---

## 6. 改訂履歴

| 日付 | 内容 |
|------|------|
| 2026-07-01 | M14(公式データ配布是正・スキーマ整理・DB 同梱)コード完了 → M15 着手に伴い、連番キット `m15-startup-kit.md` を `m14-startup-kit.md` から構造流用作成(`/next_phase_kit` を M15 起動 + マイルストーン再編の指示で実行。M15 はフェーズ3 途中のため出力先は本 `milestone-startup-kit/`)。CHANGE-053〜055 反映・DES-001 v1.4.0 / DES-002 v1.28.0 / DES-003 v1.23.0 / DES-005 v2.30.0 / REQ-001 v2.16.0、次回採番 056、マイグレ 000018。主 handover = `m14-to-m15-handover.md`(§0 を持たないため「読む順序」を §7 着手時チェックリスト → §5 M15 骨子 → §3 申し送り 主軸 + §1/§2/§4 前提に適応)。§0 作業順序を M15(入力・使いやすさ向上 = friend FB 第一波)起点へ書き換え、ロール指定を UX/情報設計/入力改善 + フェーズ計画中心へ調整。**M14 と同じ 2 タスク構成を踏襲: (I) M15 着手準備(M15-overview + M16 非依存 FB 指示書 + M14 教訓の retrospective-log 追記)/ (II) マイルストーン再編(`combmgr-phase3-m15-replan-input.md` §1〜§6 を phase3-overview〔v1.0.0 承認済み〕へ織り込み、M14 で実施した再編の不足分を完遂)**。replan-input を必須 #21(開発者手交・tmp/)に追加。C グループを M15 文脈へ整理(phase3-overview〔再編対象〕・followup-backlog〔§A friend FB〕を必須、M14-RESEARCH 系・phase2-to-phase3-handover は任意)、必須 24 → 21 件。**M14-03b(配布 seed)は今回スキップ・M16 完了後/M17 着手前に実施予定**(開発者入力作業要・配布 blocker)を §0.3/§2/§4 に明記。**retrospective-digest 再蒸留・progress-summary 更新は前提未達(M14 教訓未記録・M14 未完了)のため保留**し、理由と再開条件を明記。投入直前に code-facts(2026-07-01 / commit `fcb4a49`)+ docs-map(同)再生成。※本キットは `phase-startup-kit/` に一旦生成した後、フェーズ境界ではない(M15 はフェーズ3 途中)ため `milestone-startup-kit/m15-startup-kit.md` へ移設・改題し m14 系書式へ整えた |
