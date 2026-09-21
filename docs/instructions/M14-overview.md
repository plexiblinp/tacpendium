# M14 マイルストーン全体像（M14-overview）: 公式データ配布是正・スキーマ整理・取込画面廃止・配布 DB 同梱

| 項目 | 内容 |
|------|------|
| 文書種別 | 補足資料（overview。CHANGE 通知書対象外・自由改訂） |
| バージョン | **1.4.0**（**2026-09-02 自由改訂＝`D-655`。★§3 の「5〜6 段」を as-built の 13〜16 段へ是正した**） ／ 1.3.0（**2026-08-30 改訂＝`D-610` / `D-612`。★第四波の着手前調査 `M14-RESEARCH-03` を起票した。★残り 12〜14 キャラの seed 波は `M14` の所管であり、`M24` / `M25` のサブにしない**）<br>以下は前版の記述： 1.2.0（2026-08-01 改訂: **§3 に「seed 波は前提マイグレ 2 本を含む 5〜6 段」注記を追加**〔M14-03d の実測により確定・`characters` 行と移動 system move 9 種は波ごとに前提マイグレが要る〕。1.1.0＝2026-07-16 改訂: M14-03 の段階投入を as-built へ同期＝M14-03a/03b/03c 完了・**M14-03d/03e/03f 以降/最終波**を追加〔開発者承認 2026-07-16・playbook §4.12〕。§3 サブ表・§4.7/§4.8 新設・§5 進行順序・§6 完了の観点を更新） |
| 作成日 | 2026-06-30 |
| 作成者 | 設計担当 Claude（フェーズ3 継続担当・M14 担当） |
| 位置づけ | phase3-overview §M14 の具体化。M14 = フェーズ3 の配布健全化クラスタ。本書がサブユニット分割・全件処遇・CHANGE 見込みの正本。各サブ指示書の上位文書 |
| 前提 | phase3-overview v0.4.0 §M14 / m13-to-m14-handover §4（M14-RESEARCH-01 評価）/§5（サブ骨子）/ M14-RESEARCH-01-report（§A〜G・要決定11項）/ 開発者回答（2026-06-30・列削除/recovery/raw_data 確定）/ DES-003 §3.3 / DES-002 §4.2/§7.5 / DES-005 §5.17/§5.18 / DES-001 §2.1/§4.1/§5/§6 / REQ-001 §3.8 FR701〜704 |
| 実パス規約 | 文書ID ⇄ 実パスの正は `docs/handover/docs-map.md`。本書は実パス併記。 |
| 配置 | `docs/instructions/M14-overview.md` |

---

## 1. 目的・位置づけ

M14 はフェーズ3 の**配布健全化クラスタ**。完了 = 配布禁止の公式フレームデータ HTML に依存しない配布形態へ是正し、**手入力データを同梱した配布 DB**で OSS 配布可能になった状態。M13 で export = データ安全網が稼働したことを前提に、破壊的スキーマ整理に着手できる（意味単位 export が moves 列変更に頑健＝digest M13-6）。

本プロジェクト最重量クラスタ：**破壊的マイグレ ＋ 取込削除の共有シンボル移設 ＋ 全 30 キャラ seed ＋ 複数 CHANGE（REQ-001 含む）**。

達成目標：

- **配布前提スキーマの整理**: フレームデータのみで**ゲーム上から観測できない** moves 列を削除し、観測可能な `recovery` を persist。手入力で再現できる列だけを残す（観測できない列は配布禁止データ無しに手入力できず、編集もできないため）。
- **取込パイプラインの段階削除**: 取込画面（画面17）・取込エンドポイント・取込専用ロジックを削除。技編集（画面18・FR703）は温存。共有シンボルの逆依存を断つため段階削除。
- **FR704 の降格**: 「公式データ取込ツール出力 CSV の本体取込」をユーザー機能から降格（配布物の核心経路から外す）。
- **配布 DB 同梱**: クラシック全 30 キャラの手入力 seed を投入した DB を同梱。
- **OSS 健全化の確定**: DES-001 の旧スタック是正（案C/Go 同期）・MIT 確定・LICENSE 追加・README 更新。

---

## 2. スコープ全件処遇一覧（本MSの肝）

### 2.1 FR 処遇（REQ-001 §3.8）

| FR | 内容 | 処遇 | 担当サブ |
|----|------|------|---------|
| FR701 | 公式 HTML→CSV 別ツール（importer・配布せず） | **不変**（本体外・配布対象外。HTML/CSV は .gitignore 済み・go:embed 対象外＝handover §3-b） | — |
| FR702 | ゲームアップデート追従（FR701→FR704 反映） | フェーズ4 据え置き（FR704 降格に伴い文言整合の要否を確認） | M14-CHANGE 候補 |
| FR703 | 公式データ不備の手動修正（画面18 技編集） | **温存**（配布 DB の手入力是正手段として残す） | M14-02（温存側） |
| FR704 | 取込ツール出力 CSV の本体取込（画面17 プレビュー・選択取込） | **降格**（手入力 DB 同梱へ転換。取込画面・エンドポイント削除。検証用 CSV は dev/test 限定） | M14-02 |

### 2.2 スキーマ処遇（moves・DES-003 §3.3）

| 対象 | 処遇 | 観測可能性 | 根拠 |
|------|------|-----------|------|
| `properties`（TEXT・high/mid/low/throw/projectile/air_projectile） | **削除** | 正確値はフレームデータ依存・画面非表示 | 開発者確定 2026-06-30 |
| `combo_scaling`（JSON・補正値群） | **削除** | 同上 | 同上 |
| `drive_gauge_increase`（INT） | **削除** | ゲージ変動の目視のみ・正確値非表示 | 同上 |
| `drive_gauge_decrease_guard`（INT） | **削除** | 同上 | 同上 |
| `drive_gauge_decrease_punish`（INT） | **削除** | 同上 | 同上 |
| `super_art_gauge_increase`（INT） | **削除** | 同上 | 同上 |
| **`recovery`（INTEGER・新規）** | **追加** | 観測可（training フレームメーター）。手入力 | 開発者確定（M14-4） |
| `total`（INTEGER） | **温存（stored 維持）** | recovery から導出可だが seed 確定値で持つ | total = startup+active−1+recovery（案B・CHANGE-028） |
| `damage`/`startup`/`active`/`on_hit`/`on_block`/`is_aerial`/`setup_only`/`category`/`code`/`original_move_id` 他 | **温存** | 観測可 or 構造 | report A-1 |
| `raw_data`（JSON） | **器として温存・退避5キー削除** | — | 開発者確定 2026-06-30 |

### 2.3 raw_data サブキー処遇（DES-003 §3.3・CHANGE-030 のキー構造）

| サブキー | 処遇 | 根拠 |
|---------|------|------|
| `notes`（公式/手入力備考原文・画面18 表示） | **温存** | 技編集が表示・drive_parry 等の原文退避先（CHANGE-038） |
| `notes_tool`（`【ツール付記】`以降・画面18 編集の自由メモ） | **温存** | 技編集（画面18）が編集（PATCH raw_data） |
| `command` | **削除** | 取込退避・配布で生成しない（開発者確定） |
| `condition_ja` / `condition_en` | **削除** | 取込退避（CHANGE-027） |
| `properties_extra` | **削除** | properties 列削除で moot（CHANGE-022 残余） |
| `import_notes` | **削除** | 取込時退避メモ（配列） |

### 2.4 段階削除・後続送り（根拠付き・playbook §4.11）

| 項目 | 処遇 | 根拠 |
|------|------|------|
| 取込パッケージ `service/movesimport` 完全削除 | **段階削除**（共有シンボル移設 → 削除）。一括物理削除は技編集巻き込みでコンパイル不能（report B-1） | 逆依存（技編集 → movesimport）が核心 |
| `raw_data` 退避5キーの能動除去 | 既存行から**能動 JSON UPDATE で除去**（command 含む。notes/notes_tool は温存） | 開発者「command も削除」＝退避層を残さない |
| `total` の導出化（stored→derive） | **将来送り**（seed は確定値で stored 維持） | 導出は recovery 追加で可能になるが、表示の都度計算は別スコープ |
| モダン操作対応 | **フェーズ3 排除**（クラシック全 30 のみ。遅延時 31 の可能性） | 開発者方針。配布対象＝クラシック |
| §7.5 取込 CSV の複雑な recovery 文字列パース（全体N/着地後N 等） | 降格 FR704 側に残置（手入力 recovery は直接 INTEGER） | 官原文パースは降格経路・手入力は不要 |

---

## 3. サブユニット構成（フラット連番）

| サブ | 内容 | 主参照（実パス） | モデル | CHANGE 見込み | 依存 |
|------|------|------|------|------|------|
| **M14-RESEARCH-01** | 配布是正・スキーマ整理・取込廃止の read-only 全数調査 | M14-RESEARCH-01-report / DES-002・003・005 | Sonnet 4.6 / レビュー不要 | なし（調査） | **完了**（report 受領・handover §4 評価済み） |
| **M14-01** | スキーマ整理（moves 6 列削除＋`recovery` 追加＋`raw_data` 退避5キー除去・notes/notes_tool 温存） | DES-003 §3.3（`docs/design/03-data-model.md`）/ DES-005 §5.18（`docs/design/05-screen-design.md`）/ DES-002 §4.2（`docs/design/02-architecture.md`）/ code-facts §8/§10 | **Opus 4.8 ＋ Plan Mode 必須** | DES-003・DES-005 §5.18・DES-002 §4.2（DES-006 は要否確認） | M14-RESEARCH-01 |
| **M14-02** | 取込パイプライン段階削除（共有シンボル移設 → movesimport 削除・画面17 除去・技編集温存・FR704 降格） | M14-RESEARCH-01-report §B / DES-002 §4.2/§7.5 / DES-005 §5.17/§4.1 / REQ-001 §3.8 / code-facts §4/§3 | **Opus 4.8 ＋ Plan Mode 必須** | **REQ-001 FR704 降格**・DES-002 §4.2/§7.5・DES-005 §5.17 | M14-01（properties 削除で IsKnownProperty 消費者消失） |
| **M14-03**（親） | 配布 DB 同梱（全 30〔/31〕キャラ手入力 seed 投入インフラ＋seed）。**手入力律速のため段階投入へ分割**（開発者決定 2026-07-09）＝下記 03a〜最終波 | M14-RESEARCH-01-report §E / **手入力 CSV 20 列**（19＋`is_derived`。※§2 の「22 列」は importer CSV＝別物） / code-facts §10 | **Opus 4.8 ＋ Plan Mode** | seed マイグレ。**スキーマ変更ゼロ＝CHANGE 起票なし**（seedgen はランタイム非経路＝外部契約でない） | M14-01（スキーマ確定後に seed 形状確定） |
| **M14-RESEARCH-02** | 第一波キャラ選定のための特性調査（30 キャラ特性マトリクス・例外類型 20） | M14-RESEARCH-02-report / `M14-RESEARCH-02-first-wave-roster.md` | Sonnet 4.6 / レビュー不要 | なし（調査） | **完了**（report 受領。指示書の前提を複数覆した） |
| **M14-03a** | recovery backfill ほか（M14-03 分割の先行分） | — | Opus 4.8 ＋ Plan | なし | **完了**（2026-07-01） |
| **M14-03b** | **第一波 9 キャラ**（terry/guile/lily/ingrid/kimberly/juri/ken/mai/zangief）＋**全キャラ移動 system move**＋custom_states 7 state＋掃き取り＋**索引器 IF（`internal/moveindex`）** | `M14-03b-distribution-seed.md` v2.3.0 / m16-to-m17-handover §3 / DES-003 §3.2/§3.3/§3.9 | Opus 4.8 ＋ Plan | **なし**（スキーマ変更ゼロ） | **完了**（2026-07-15・レビュー重大ゼロ。**マイグレ 000024〜000028**・moves 909・alias 欠落 0） |
| **M14-03c** | **ryu 正規再 seed**（旧 000004 の仮 seed 削除＋combos クリア＋手入力 CSV 由来で再 seed） | `M14-03c-ryu-reseed.md` v1.0.2 | Opus 4.8 ＋ Plan | なし | **完了**（2026-07-16。**マイグレ 000029〔手書きクリア〕＋000030〔seedgen 生成 seed〕**・**seedgen を I/O 境界のみ拡張**〔§4.7〕） |
| **M14-03d** | **第二波＝manon 単独**＋**アクセント transliteration の実地検証**（AI 補正で埋まるか／input-tool の codegen 修正が要るかの判定を DoD に） | `M14-03d-second-wave-manon.md` / M14-RESEARCH-02-findings-analysis §1.3〔T3/F-14〕 | Opus 4.8 ＋ Plan | なし | **manon CSV の完成待ち**（M14-03b/03c 完了済＝インフラ充足） |
| **M14-03e** | **第三波＝m_bison / rashid / jamie / luke**（括弧の過長 code〔40〜57 字〕＋公式英語名の誤り） | `M14-03e-third-wave-code-quality.md` / findings-analysis §1.3〔T4/T5/F-13〕 | Opus 4.8 ＋ Plan | なし | **M14-03d の解**（codegen 修正の要否）＋各 CSV の完成待ち |
| **M14-03f 以降** | **量産波**＝残り（品質問題の報告がないキャラ）を **5 体前後の塊で 1 サブずつ**。**波の数は入力ペースに応じて開発者が開く**（指示書は 03d/03e の軽量な追補で足りる） | 同上 | Opus 4.8 ＋ Plan | なし | 各波の CSV 完成待ち |
| **M14-03（最終波）** | **c_viper / dhalsim** ＋ **配布 blocker 解除の判定**（全 30〔/31〕キャラ充足の確認・**clean DB で全 E2E**〔followup `pre-dist-e2e-clean`〕・**dup 再測定**〔全域〕） | followup §C-1・§F / §4.7 | Opus 4.8 ＋ Plan | なし（判定サブ） | **全キャラの CSV 完成**。**必ず最後**（§4.7） |
| **M14-CHANGE（DES-001）** | §2.1/§4.1 を案C/Go へ同期＋§5 ライセンス確定（MIT）＋LICENSE 追加/README 更新 | DES-001 §2.1/§4.1/§5/§6（`docs/design/01-tech-stack.md`） | （設計担当 CHANGE） | DES-001 | 独立（M14 期間中いつでも） |

> **採番**: M14-RESEARCH-01/02 は完了（CHANGE 非対象）。実装サブは破壊的マイグレ・取込削除・seed で full fidelity が要るため **Opus 4.8 ＋ Plan Mode 必須**。M14 の CHANGE 採番は **053〜055** で消化済み（M14-03 系列は**スキーマ変更ゼロ＝CHANGE 起票なし**）。model-allocation へ各サブ着手時に追記。
> **M14-03 系列の性格（開発者確認 2026-07-16）**: **他マイルストーンに組み込まれるものではなく M14 内への追加**。**「あるマイルストーンまでに必達」という期限を持たない**＝**手入力が出来上がり次第、投入していく**。**あるのは優先度（＝投入順）だけ**。したがって M17 以降の進行を待たせない・待たされない（相互に非依存）。
> **サブ分割の承認**: 03d／03e／03f 以降（量産波）／最終波 の 4 段構成は **開発者承認済み（2026-07-16・playbook §4.12）**。

> **★★【2026-09-02 是正＝`D-655`】下記の「5〜6 段」は失効している。⇒ 第四波の見込みは 13〜16 段である。**
>
> **一次源＝`docs/progress/M14-RESEARCH-03-report.md` §2.2-1 / §2.4-3。** **★実測の内訳**——**第三波（`M14-03e`）の as-built が 9 段**〔`characters` ／ 移動 9 種 ／ `moves`＋alias ／ `is_derived` ／ `move_commands` ／ `is_projectile` ／ 移動 `total` ／ `chain_cancel_total` ／ frame_cost〕**＋ `M20` 期に積まれた再適用 4 段**〔`numeric` ／ `srk` ／ `P-34` の `numeric` ／ `P-34` の `srk`〕**＝13 段。条件付きでさらに 0〜3 段**〔`custom_states` ／ `fastest_unreachable` ／ `move_derivations`〕。
>
> **★★下記の表は第二波（`M14-03d`・1 キャラ・6 本）を基準にしており、それが書かれた 2026-08-01 の時点で既に第三波の実績（9 段）に足りていなかった**（`is_derived` backfill ／ `move_commands` ／ `chain_cancel_total` ／ frame_cost の 4 段が表に無い）。**⇒ 「実測により確定」と書かれていたが、確定していたのは 1 波ぶんだけだった。**
>
> **★本数はキャラ数に比例しない。段の数で決まる**（第二波は 1 キャラで 6 本）。**⇒ 波を分割すると段の数が波の数だけ掛かる。**
>
> **★マイグレ連番の見込み＝`000081` から `000093`〜`000096`。**
>
> 以下は前回更新時の記述： **【2026-08-01・M14-03d の実測により確定】未 seed キャラの seed 波は「前提マイグレ 2 本を含む 5〜6 段」構成になる。**
>
> | 段 | 内容 |
> |---|---|
> | 1 | **`characters` 行の投入**（★前提） |
> | 2 | **移動 system move 9 種の投入**（★前提） |
> | 3 | moves 本体（seedgen 生成） |
> | 4 | preset_aliases（seedgen 生成） |
> | 5 | `is_projectile` backfill |
> | 6 | 移動 5 code の `total`（**実測値を受領できた場合のみ**） |
>
> **★1・2 が「前提」である理由**: `INSERT INTO characters` を持つマイグレは **000003 / 000009 / 000014 / 000024 の 4 本のみ**で、第二波以降のキャラはいずれにも含まれない。「全キャラへ投入」と書かれた既存 seed マイグレは、**適用時点に存在した行にしか効かない**。**`NOT EXISTS` ガードは冪等性のためであって、後から増えた行を遡って埋めるものではない。**
>
> **★同じ前提崩れは jamie / luke / m_bison / rashid / jp でも必ず起きる**（いずれも `characters` 未登録）。

---

## 4. 主要設計判断・調査結果の反映

### 4.1 列削除の安全性（M14-01・裏取りゲート）

- **削除6列の物理削除前に、recipe_cache / 比較 / 一覧 / その他がプログラム的に消費していないことを実コード grep で裏取り**（記憶で進めない）。report A-1 では 6 列とも「編集＋詳細表示」止まり（FR307 下で自動消費されず参照表示のみ）だが、開発者の「登録のみ・何にも使われていない」を grep で確証してから DROP。
- **画面18（§5.18）からの除去**: 編集グリッドのインライン編集対象は現在 `total`・各フレーム・`properties`・`combo_scaling`・is_aerial・rush 生成・notes 付記（DES-005 §5.18）。**`properties`/`combo_scaling`/ゲージ系の編集欄を除去**し、`total`・各フレーム・`recovery`（新規・手入力）・is_aerial・rush 生成・notes 付記（notes_tool）・name_ja 表示を残す。
- **warnings 再導出の縮小**: GET `/api/moves` の再導出 warnings（DES-002 §4.2・§5.18 強調）から **`unknown_properties`・`unknown_combo_scaling_key` を除去**（列消失で moot）。残る再導出は `total_null`・`extra_throw`。

### 4.2 共有シンボル移設の縮小（M14-02・§4-1 削除安全性の核心）

- 取込（`movesimport`）と技編集（`move`）は**逆依存**: 技編集が `movesimport` の `IsKnownProperty`/`WarningCode`/`StoredMove`/`DeriveStoredWarnings` を参照（report B-2）。`movesimport` をパッケージごと削除すると技編集がコンパイル不能 → **段階削除（共有シンボル移設 → 取込削除）が必須**。
- **`properties` 削除で `IsKnownProperty` の唯一の消費者（技編集 PATCH の properties 値域検証＝service/move/service.go:127）が消える** → `IsKnownProperty` は移設対象から外れ、`movesimport` と共に削除可能。
- 残る共有 3 シンボル（`WarningCode`/`StoredMove`/`DeriveStoredWarnings`＝GET `/api/moves` の `total_null`/`extra_throw` 再導出）を**中立パッケージ（仮 `internal/service/movewarning`）へ移設**してから `movesimport` を削除。`unknown_properties`/`unknown_combo_scaling_key` の WarningCode 値は廃止。
- **着手前ゲート（M14-02 Plan Mode）**: report B-2 の参照経路（service/move/service.go:127・api/move/dto.go・api/move/handler.go の `StoredMove`/`DeriveStoredWarnings` 経路＋repository interface `UpsertMove`/`UpsertOfficialJaAlias`）を**実コードで再 grep 裏取り**（code-facts は §9 公開構造体のみで interface・package 関数を捕捉しないため）。
- **フロント**: `web/src/constants/move-warning.ts`（共有 SSOT）を温存し、`features/import/` ＋ ImportMovesPage ＋ router ＋ Header 導線（画面17）を除去。

### 4.3 取込画面・エンドポイントの削除と FR704 降格（M14-02）

- **削除**: 画面17（§5.17 取込プレビュー・DES-005）/ `POST /api/import/moves`・`POST /api/import/moves/preview`（DES-002 §4.2）/ 取込専用サービス・テスト（commit_test/parse_test）。
- **温存**: 画面18（§5.18 技編集 FR703）/ `GET /api/moves`・`GET /api/moves/:id`・`PATCH /api/moves/:id`（フィールドから削除6列を除去）・`POST /api/moves/:id/rush-variant`。
- **REQ-001 FR704 降格**: §3.8 FR704 を「手入力 DB 同梱へ転換、取込はユーザー機能から降格、検証用 CSV は dev/test 限定」へ改訂（CHANGE）。FR702（アップデート追従）の FR704 参照文言の整合要否を確認。
- **DES-002 §7.5（FR704 CSV 契約）**: 降格に伴う扱い（残置・dev/test 限定明記・recovery の手入力列化に伴う記述整合）を CHANGE で確定。

### 4.4 配布 seed（M14-03・工数の長極）

- live = characters 5 体・moves は ryu のみ（56 行）。aki/jamie/guile は 000017 で完全 DELETE、classic5 の ken/ingrid/c_viper/dhalsim の moves は取込由来（seed に無い）（report E-1）。
- 配布対象 = **クラシック全 30 キャラ**（開発者確定。遅延時 31 の可能性 → **ロスター数非依存の seed インフラ**で設計）。全キャラの characters/moves/custom_states/official_ja_move を手入力 seed で投入。aki/jamie/guile も 30 に含むなら再 seed。
- **seed 投入インフラ（手入力進捗と非同期に先行設計可）**: 手入力ツール `moves-input-tool` の 22 列 CSV → seed SQL 変換（remap〔snake_case→camelCase・CLAUDE.md §4〕＋ `total` 算出〔startup+active−1+recovery〕＋ `raw_data` 構築〔notes/notes_tool のみ〕）。削除6列・`properties_extra` 等は変換対象外。
- **手入力ミス防止**: 公式 HTML 突合はツールで実施（HTML は配布せず検証専用）。突合入力は既タブ化 CSV/TSV（HTML→CSV は別ツール `combomgr-importer`）。状況により `moves-input-tool` 改修も選択肢（Plan Mode 次第）。
- **マイグレ方式**: 中粒度一括（数体ずつ）で連番濫費と巨大単一ファイルの両極を回避。最終は M14-03 Plan Mode。

### 4.5 破壊的マイグレ（次連番 000018・digest §5 ゲート）

- 次マイグレ連番 = **000018**（handover §4-5）。M14-01 = 6 列 DROP ＋ `recovery` ADD ＋ `raw_data` JSON UPDATE（退避5キー除去）。M14-03 = seed INSERT。
- **列削除技法**: 削除6列は FK 非参照（report D-3）のため `ALTER TABLE moves DROP COLUMN`（前例 000008/000013.down）で足り、テーブル再構築（000016 非破壊技法）は不要の見込み。Plan Mode で SQLite バージョン・既存マイグレ前例を確認。
- **必須ゲート（各実装サブ着手前・digest §5）**: (1) **FK=OFF と明示 DELETE を同一指示書に同居させない**（M12-5）。(2) `dbtest.Setup` が全マイグレを適用する波及（M9-1）。(3) `migrate_test.go` の down 整合。(4) seed INSERT の FK 順序（characters → moves → preset_aliases〔NOT NULL REFERENCES moves〕）。
- `raw_data` JSON UPDATE は notes/notes_tool を巻き込まない（退避5キーのみ delete）。

### 4.6 DES-001 是正（M14-CHANGE）

- §2.1（案A: Rust+React 推奨表）/§4.1（総合推奨: 案A）に残る旧スタック（Tauri/Rust/SQLx）を **§6 の案C/Go 採用決定へ同期**（handover §3-a の訂正 = 旧スタック残置は §5 でなく §2.1/§4.1）。§5 は MIT 方針で現行整合（推奨→確定の文言調整のみ）・§6 は案C 採用記録済み。
- 本体ライセンス **MIT 確定**（2026-06-28）を §5 で確定化。**LICENSE ファイル（MIT）追加**・**README「未定」更新**（OSS 前・handover §3-b）。
- MPL 依存 `hashicorp/golang-lru/v2` の `go mod why` 非リンク確認（handover §3-b・配布判定前）。

---

### 4.7 c_viper / dhalsim を最後に置く理由（2026-07-16）

> **★★【2026-09-05 失効＝`D-707` / `D-709`・`M14-03f`】「`c_viper` / `dhalsim` は必ず最終波」の制約は成立しない。⇒ 撤回する。** **実測＝クリーン DB へ全 80 本 ＋ 生成物 9 本を適用して UNIQUE 違反 0 件。★2 体とも第四波で通常どおり投入され、31 キャラすべてが seed 済みになった。** **⇒ 本節は履歴として残す。以下の判断は当時の前提に基づくものであり、現在は適用しない。**
>
> **★何が正しかったか**——**「構造」の記述**〔`characters` に既存だが `moves` 未 seed のキャラは、利用者が自作 moves を作れるため `UNIQUE(character_id, code)` 衝突がありうる〕**は誤っていない。★誤っていたのは「その経路が現に成立している」という推定である。** **⇒ 実測すると 2 体とも自作 move を持っていなかった**〔`dhalsim`＝未使用確認済み ／ `c_viper`＝連絡不通のため未使用と判断、という 2026-07-16 の見立てが実測で裏づけられた形〕**。**
> **★「推奨解（発動時）」は残す価値がある**——**将来、利用者が自作 move を持つ環境へ公式 seed を入れる場面では同じ手順が要る。**


- **構造**: 「**`characters` に既存だが `moves` 未 seed**」のキャラは、**利用者が画面18 で自作 moves を作れる**。将来その手入力データを seed すると `UNIQUE(character_id, code)` 衝突 → **マイグレ全ロールバック → 起動不能**（M14-03b の dev DB 実例と同一機序）。**該当は c_viper / dhalsim のみ**（ken/ingrid は M14-03b で seed 済み・利用なしを確認）。
- **現況**: **dhalsim＝未使用確認済み／c_viper＝連絡不通のため未使用と判断**（開発者判断 2026-07-16）。したがって現時点でリスクは無い前提で進む。
- **なぜ最後か**: **最後に置けばコストゼロで判断を後ろへ倒せる**（万一 c_viper の利用実績が判明した場合の余地も残る）。順序は総量に影響しない（blocker 解除は全キャラ充足時点＝総量で決まる）ため、**遅らせる費用がゼロで、得られる保険は起動不能の回避**。
- **推奨解（発動時）**: **seed 前に自作 move の `code` をリネーム**（`{code}` → `{code}_user`）してから公式 seed を INSERT。**`combo_steps` は `move_id`（FK）参照であり `code` 参照ではない**（DES-003 §3.5）＝**code をリネームしても利用者のコンボは壊れない・データ損失ゼロ**。マイグレ内で `UPDATE moves SET code = code || '_user' WHERE character_id = (該当) AND code IN (seed の code 群)` の 1 文＋INSERT。代替（`INSERT OR IGNORE`＝公式データが欠ける／自作 move 削除＝利用者のコンボが壊れる）は非推奨。

### 4.8 seed 品質の担保（M14-03b/03c で確立・以後の波に適用）

- **clean マイグレ由来 DB から構築**（dev DB 残渣不可）。**dev DB は事前退避**。
- **dup スキャン**（同一キャラ内 `move_code` 衝突・alias 衝突）で**生成 fail＋一覧報告**（自動リネーム・自動 skip をしない）。
- **seedgen の拡張は I/O 境界のみ**（対象キャラ・出力先・ヘッダのパラメータ化）＝**変換規則は無改変**。証拠＝**既存出力 `000026` の byte-identical**（golden＋`-check`）。**生成マイグレ 1 本につき golden テスト 1 本**。**手書き・コピー実装をしない**（「二度作らない」）。
- **破壊的削除を伴う波では**「**残すものの列挙＋NOT IN**」で書く（ユーザー生成行〔`rush_<code>`・自作 move〕が存在するため「消すものの列挙」では消し漏れる＝M14-03c の実例）。**moves を参照する 5 列**（`combos.starter_move_id` / `combo_steps.move_id` / `preset_aliases.move_id` / `setup_steps.move_id` / `moves.original_move_id`）を全数列挙する。
- **`pre-seed-data-check-prompt`（投入前 AI チェック）の観点**（2026-07-16 時点）: CA/`SA*_` 接頭語・command 補完・**`is_aerial=false` かつ command が単方向＋ボタン かつ 空中でしか出ない技**（M17-02 の段階2 解決表の正しさに効く）。

## 5. 依存関係・進行順序

1. **M14-RESEARCH-01**（完了）。評価は handover §4。
2. **M14-01（スキーマ整理）**: 削除6列の消費者 grep 裏取り → 画面18 編集欄・GET warnings から除去 → 6 列 DROP ＋ recovery ADD ＋ raw_data UPDATE（000018）。**properties/combo_scaling の PATCH 検証呼び出し（IsKnownProperty 等）を本サブで除去**し、シンボル本体の削除は M14-02 へ渡す。
3. **M14-02（取込段階削除）**: 残る共有3シンボルを中立パッケージへ移設 → movesimport 削除・画面17 除去・取込エンドポイント削除・FR704 降格。M14-01 完了後（properties 消費者消失済み）に着手すると移設が縮小。
4. **M14-03（配布 seed）**: スキーマ確定（M14-01）後に seed 形状を確定。インフラは手入力進捗と非同期に先行設計可。全 30 キャラ投入は開発者の手入力進捗に依存（長極）。**M16 の seed 契約（dash canonical・taxonomy・custom_states・target_combo）が収束した M16 後に本格投入**（開発者決定）。
   - **段階投入の順序（＝優先度。期限ではない）**: **M14-03b（第一波 9 キャラ・完了）→ M14-03c（ryu・完了）→ M14-03d（manon）→ M14-03e（m_bison/rashid/jamie/luke）→ M14-03f 以降（量産波・順不同）→ 最終波（c_viper/dhalsim＋blocker 解除判定）**。
   - **順序の根拠**: (1) **manon を単独で先に**＝アクセント transliteration（21 行の code 破損）の解を**1 体で見極める**（20 体入力後に発覚すると全滅。重量サブは調査→実装の順が安い）。(2) **03e＝code 品質問題が濃い組をまとめて**＝03d で得た解が効くかを問題側で確認し、以降を品質問題なしで量産できる状態にする。(3) **c_viper / dhalsim は必ず最後**（§4.7）。
   - **「必達期限なし・出来上がり次第」**: 各波は手入力の完成を唯一の起点とし、他マイルストーン（M17 等）を待たせない。**M14-03f 以降の指示書は着手時に用意する**（03d/03e の軽量な追補で足りるため先回りして書かない）。
5. **M14-CHANGE（DES-001）**: 独立。M14 期間中いつでも。（**完了**）

> 各実装は Opus 4.8 ＋ Plan Mode 必須。指示書着手前に code-facts/実コードを実査（記憶で進めない）。

---

## 6. 完了の観点（M14 クローズ）

- moves から削除6列が消え、`recovery` が persist・`total` が seed 確定値で stored（M14-01）。
- `raw_data` が notes/notes_tool のみ保持し退避5キーが消える（M14-01）。
- 画面18（技編集）が削除6列の編集欄を持たず、warnings 再導出が `total_null`/`extra_throw` のみ（M14-01）。
- `movesimport` パッケージ・画面17・取込エンドポイントが削除され、技編集（画面18）がコンパイル・動作する（M14-02）。
- FR704 が降格され REQ-001 に反映（M14-02）。配布物に配布禁止データ・HTML 由来検証 CSV が含まれない。
- 配布 DB がクラシック全 30（/31）キャラの手入力 seed で初期化される（M14-03 系列）。**段階投入のため、M14-03b/03c 等の個別サブの完了は blocker 解除を意味しない＝解除は全キャラ充足時点**（followup §C-1・最終波で判定）。
- **最終波の判定**（配布 blocker 解除の DoD）: 全 30（/31）キャラ充足・**clean DB で全 E2E 通過**（followup `pre-dist-e2e-clean`）・**dup 再測定 0 件**（全域）・移動 system move ＋ alias が全キャラで対（生 code フォールバックなし）。
- DES-001 が案C/Go に同期され MIT 確定・LICENSE/README 整備（M14-CHANGE）。
- 破壊的マイグレ 000018 が dbtest.Setup 経由の全テストで通過し、down 整合・FK 順序が成立。
- M13 export（意味単位）が削除6列・列追加後も往復成立（非回帰）。

---

## 開発者への確認事項

1. **raw_data 温存方式の最終確定**
   何を: `raw_data` を全削除せず器として温存し、退避5キー（command/condition_ja/condition_en/properties_extra/import_notes）のみ能動 JSON UPDATE で除去、`notes`/`notes_tool` を温存する方針で確定してよいか。
   なぜ: 開発者回答（notes/notes_tool の器として温存）を反映済み。能動 UPDATE で notes/notes_tool を巻き込まない設計が前提。
   暫定案: 本方針で確定。M14-01 で退避5キー除去の JSON UPDATE を 000018 に含める。

2. **削除6列の消費者裏取りの実施主体**
   何を: 削除6列（properties/combo_scaling/ゲージ4列）の「プログラム消費なし（登録・参照表示のみ）」の実コード grep 裏取りを、M14-01 Plan Mode の着手前ゲートとして製造担当に課す段取りでよいか（M14-RESEARCH 追補は新規に走らせない）。
   なぜ: handover §4 評価は read-only で完了済み。物理削除の最終確証は実コード grep（記憶で進めない）。
   暫定案: M14-01 指示書 §3.4 に「削除6列の消費者 grep（recipe_cache/比較/一覧/その他）」を Plan Mode 必須項目で明記。

3. **recovery の型・値域・検証**
   何を: `recovery` を INTEGER・NULL 可・手入力（observable 前提）とし、値域検証（VAL 新設）を設けるか否か。total は `startup+active−1+recovery`（案B）で seed 時算出・stored。
   なぜ: 取込時の複雑な recovery 文字列パース（全体N/着地後N 等）は降格 FR704 側に残し、手入力列は単純 INTEGER とする整理。値域検証の要否はドメイン判断。
   暫定案: recovery = INTEGER・NULL 可。VAL は当面設けない（取込寛容方針と一貫・UI 制約で担保）。要すれば M14-01 で VAL 新設。

4. **FR702（アップデート追従）の文言整合**
   何を: FR704 降格に伴い、FR702（FR701→FR704 で反映）の文言整合 CHANGE を M14-02 に含めるか。
   なぜ: FR702 はフェーズ4 据え置きだが FR704 を参照しており、降格で参照先の性格が変わる。
   暫定案: FR702 はフェーズ4 のまま、参照文言のみ「降格後の取込経路」に整合（M14-02 の REQ-001 CHANGE に同梱 or 別 item）。着手時に最小スコープで確定。

5. **DES-006 の M14-01 影響**
   何を: 削除6列に専用 VAL が無い（取込寛容・02 §7.4）ため、M14-01 で DES-006 改訂は基本不要との理解でよいか。
   なぜ: 過剰な「念のため起票」を避ける（§16.4.4）。warnings は WarningCode（DES-002 §4.2）側で DES-006 の VAL ではない。
   暫定案: M14-01 では DES-006 改訂なし。recovery に VAL を設ける場合のみ DES-006 を改訂。着手時 view で最終確認。

---

*以上、M14-overview v1.2.0。配置 `docs/instructions/M14-overview.md`。本書は M14（配布是正・スキーマ整理・取込画面廃止・配布 DB 同梱）の正本であり、各サブ指示書の上位文書。M14-01/02/03 ＋ M14-CHANGE は本書のサブ分割・CHANGE 見込みを具体化する。*
