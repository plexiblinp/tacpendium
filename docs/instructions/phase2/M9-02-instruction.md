# 指示書 M9-02: FR704 アプリ側 CSV 取込（moves インポート）

| 項目 | 内容 |
|------|------|
| 指示書ID | M9-02 |
| バージョン | 1.0.4 |
| 推奨モデル | Opus クラス（関心数中〜大・複数システム統合。§7・model-allocation 参照） |
| Plan Mode | **必須**（§3.4 / §9.4） |
| 機械レビュー | 必須（別チェックリスト: `M9-02-review-checklist.md`） |
| 並列性 | 単独（直列） |
| 依存指示書 | M8-01（moves スキーマ 8 列追加・検収完了）、M8-02（E2E 基盤・`make e2e` 通過） |
| 想定所要時間 | 240〜300 分（取込ロジック + UI + model 型集約 + テスト） |
| 作成者・作成日 | 設計担当 Claude（フェーズ2 継続担当・M9-02 スパイン）/ 2026-06-14 |

## 更新履歴

| バージョン | 更新日 | 更新内容 |
|-----------|--------|----------|
| 1.0.0 | 2026-06-14 | 初版 |
| 1.0.1 | 2026-06-14 | ファイル名を `M9-02-instruction.md`（先頭大文字 M）へ。対チェックリスト名を `M9-02-review-checklist.md` に統一。製造担当が実 CSV を `combomgr-importer/dist/*.csv` で閲覧できる旨を §1.1 / §3.2 / §4.2 / §4.3 / §5.1 / §8 に追記 |
| 1.0.2 | 2026-06-14 | 開発者確定2点を反映。(1) §4.3 recovery 分岐の `着地後N`・未知→FR703 routing を開発者確認済みに（§3.4-4 を方針確定・Plan Mode は parse 実装詳細のみへ）。(2) §4.1 取込エンドポイントを**別経路方式（preview + commit + 共通サービス層）に決定**（開発者一任、拡張性・保守性根拠を明記。§3.4-5 を設計確定・DES-002 §4.2 追記は CHANGE-029 同梱へ）。§9.4 を追従 |
| 1.0.3 | 2026-06-14 | CHANGE-029 反映に追従。§4.1 文書影響注記を解消（/preview は DES-002 §4.2 v1.14.0 に正式記載済み）、§4.7 を「DES-005 §5.17 画面17 新設済み」へ、上位設計参照を `M9-overview.md` v0.2.0 へ更新（リネーム追従） |
| 1.0.4 | 2026-06-14 | M9-02 完成反映。§4.9 を Option 1 確定（000014 は classic 5 キャラ名の加算のみ・破壊的 seed クリアと参照クリアは M12-02 へ延期・dbtest 全マイグレ適用によるテスト破壊を回避）に訂正。純粋入力ジャンプ等の seed は後続申し送りへ。raw_data キー・commit 形状・WarningCode の確定は CHANGE-030（別途起票）で設計書本体へ。model.Move/MoveListItem 重複保持は後続集約として延期（M9-overview §3.9） |

---

## 1. 背景と目的

### 1.1 背景

- M8 完了: moves スキーマ 8 列追加（M8-01 検収完了）、FR704 CSV 契約・技名正規化・取込スコープ・total 算出式が確定（CHANGE-022 / 025 / 026 / 027 / 028）。E2E 基盤成立（M8-02）。
- M9-01（FR701 取込ツール、別バイナリ）完了。実 CSV 出力を classic 5 体・339 データ行で確認済み。本体とは CSV 契約（DES-002 §7.5）越しに疎結合。**製造担当（Claude Code）は同じ実 CSV を `combomgr-importer/dist/*.csv`（+ 各 `*.review.md` = ツールの要確認メモ）で閲覧できる**。実装・テストの裏取りに参照すること。
- **未解決事項**: 本体取込（FR704）が未実装。`POST /api/import/moves` は DES-002 §4.2 L143 で設計定義済みだが**ルート未登録**（code-facts §4 に存在しない）。本指示書でこれを新設する。

### 1.2 目的

完了時に達成される状態:

- `POST /api/import/moves` 系で、ツール出力 CSV をプレビュー → 行単位 upsert で DB へ取り込める。
- 1 行が **characters / moves / preset_aliases** の 3 テーブルへ正しく反映される（依存順 characters → moves → preset_aliases）。
- 取込時に `total` を算出（CHANGE-028 式）、`properties` をコード値正規化、`critical_art` を写像、`combo_scaling` の正準キーを照合する。
- `model.Move` を正準フル行型へ集約し、取込で活性化する（M8-A4。Plan Mode で意味判別後）。
- 取込プレビュー UI で要確認行を強調し、行選択 → 実行 → 行単位レポートを返す。

### 1.3 このマイルストーンで作らないもの（スコープ外 = M9-03 / 後続）

- ラッシュ版生成（`rush_<元技code>`、`category = rush_variant` + `original_move_id`）＝ **M9-03**（DES-003 §3.3 L418）。
- 取込結果のグリッド編集・`is_aerial` 手動トグル・通常投げ 3 件目以降の並び/命名補正・notes 付記の手動編集 ＝ **M9-03**。
- コマンド表記コンボ機能・`official_ja_command` プリセット接続 ＝ フェーズ3以降（CHANGE-027。本指示書は command / condition を raw_data へ退避するのみ）。
- 英語ロケール（name_en・英語 UI）＝ フェーズ3以降。
- custom_states 開始時状態 ＝ M11。
- seed クリア + 再投入マイグレの**設計**は §4.9 で扱うが、実 seed データ生成はツール出力 CSV の取込で行う（静的 seed SQL を新規に手書きしない）。

---

## 2. 成果物

### 2.1 作成するファイル

| ファイル（想定パス。実配置は既存構成に合わせる） | 内容 |
|---|---|
| `internal/api/import/handler.go`（新規ハンドラ群） | `POST /api/import/moves/preview`（dry-run）+ `POST /api/import/moves`（commit）。§4.1 |
| `internal/api/import/routes.go` | 上記ルート登録 |
| `internal/service/import/*.go`（取込サービス） | CSV 解析・列マッピング・total 算出・正規化・行単位 upsert オーケストレーション。§4.2〜§4.6 |
| `internal/repository/move/*.go`（取込 upsert 追加） | moves の upsert（キー `(character_id, code)`）。preset_aliases upsert は §4.6 で経路確定 |
| `web/src/routes/ImportMoves.tsx`（取込プレビュー画面） | §4.7 |
| `web/src/hooks/useImportMovesPreview.ts` / `useImportMovesCommit.ts` | 取込 API フック。queryKey/mutation は code-facts §2 の既存規約に合わせる |

### 2.2 修正するファイル

| ファイル | 修正内容 |
|---|---|
| `cmd/combomgr/main.go` / 既存 `internal/api/*/routes.go` 集約点 | import ルートの配線 |
| `internal/model/move.go` | `model.Move` を正準フル行型として確立（M8-A4、§4.8。Plan Mode 確定後） |
| `internal/repository/move/repository.go` | `MoveListItem` を `model.Move` から導出/埋め込みへ（§4.8） |
| `web/src/router.tsx` | 取込ルート追加（code-facts §3 の既存ルート規約に合わせる） |
| `web/src/components/Header.tsx` ほかナビ | 取込画面への導線（必要なら。既存ナビ構造は code-facts §6 を確認） |

### 2.3 変更しないもの（原則）

- moves スキーマ（M8-01 で確定。**本指示書で列を追加しない**。command/condition/properties 残余は raw_data へ＝CHANGE-027/022）。
- `GET /api/moves` の API 契約（`MoveResponse` の公開フィールド＝ code-facts §7。§4.8 の集約で**この契約を変えない**）。
- コンボ CSV インポート（FR405、DES-005 §5.14）。本取込（FR704）は別フロー・別画面。

### 2.4 例外条項（§4 参照）

- `model.Move` 正準化（§4.8）は、本取込が moves 全列を書くために必要なドメイン型/リポジトリ投影の調整であり、本指示書スコープ内の正当な変更。ただし**実装方式は Plan Mode で意味判別（§3.4-1）を経てから確定**する。GET 契約（MoveResponse）は不変に保つ。
- 取込プレビューを dry-run 別経路として新設する場合、DES-002 §4.2 の主要エンドポイント表に追記が要る可能性がある（§4.1 末尾の文書影響を参照）。

---

## 3. 前提条件

### 3.1 必読ドキュメント

- DES-002 v1.13.0 §4.2（取込エンドポイント）/ §7.5（CSV 契約・列表 L394-427・取込挙動 L361-365）
- DES-003 v1.19.0 §3.3（moves 列・total 算出式・combo_scaling 正準キー L298-320・properties・raw_data）
- DES-004 v1.6.0 §2.1（code 規約・`ca_` 接頭辞）
- DES-006 v1.11.0（取込時バリデーション・型チェック）
- CHANGE-022 / 025 / 026 / 027 / 028（確定根拠）
- `M9-overview.md` v0.2.0（M9 設計概要・本指示書の上位設計）
- code-facts（2026-06-13 再生成版）§4（ルート）/ §7（MoveResponse）/ §8（model.Move）/ §9（MoveListItem）

### 3.2 任意参照

- **実 CSV: `combomgr-importer/dist/*.csv`（classic 5 体 = ryu / ken / ingrid / c_viper / dhalsim）+ 各 `*.review.md`（ツールの要確認メモ）。Claude Code から閲覧可。** 実データで挙動を裏取りすること。確認ポイント例: recovery の実パターン（`整数` / `全体 N` / `着地後N`）、category 分布（critical_art・drive_impact・throw 各実在）、通常投げ 3 件目の実例（dhalsim `yoga_splash`）、startup 空欄行（total NULL 候補）、combo_scaling の実キー（`initial_scaling`/`combo_scaling`/`immediate_scaling`）。
- SUPP-001 v1.24.0 §3.3.2（seed 境界）/ §3.6（seed 投入方式）/ §4.5（E2E 実装メモ）

### 3.3 参照不要

- 英語ロケール・コマンド表記コンボ・custom_states 関連（本スコープ外）。

### 3.4 着手前の確認（Plan Mode 必須。§9.4 と対応）

実装着手前に、以下を Plan Mode で開発者へ提示し確定すること（推測で進めない）:

1. **`model.Move` 二重定義の意味判別**（§4.8）。`MoveListItem` が 6 列（`Damage`/`ComboScaling`/`DriveGaugeIncrease`/`DriveGaugeDecreasePunish`/`SuperArtGaugeIncrease`/`RawData`）を除外している理由を実コードで確認。(a) GET 一覧のペイロード削減/性能目的の**意図的投影**なら投影境界を保持（`model.Move` を scan/埋め込みしつつ GET 露出は DTO で従来どおり狭く）。(b) writer 不在の**死蔵**なら完全統合。**いずれでも GET 契約（MoveResponse）は不変**。
2. GET `/api/moves` の実 SQL（SELECT 列・JOIN）と scan 先。`model.Move` へ寄せられるか / GET SQL を全列へ広げてよいか。
3. preset_aliases（official_ja_move）の結合実装と取込での alias upsert 経路（既存投入 = seed 000006。再利用可否）。
4. `total` の recovery 解釈分岐（§4.3）: 方針は**開発者確定済み（2026-06-14）**＝`整数`→式適用、`全体 N`→total=N 直接、`着地後N`・その他→要確認＋FR703（自動算術しない）。Plan Mode では parse 実装詳細（整数抽出・`全体 N` 判定の具体ロジック・未知パターンの拾い方）のみ確認すればよい。
5. 取込エンドポイント経路: **決定済み（別経路 `preview` + `commit`、共通サービス層。§4.1。開発者一任 2026-06-14）**。DES-002 §4.2 への `/preview` 追記は設計担当が CHANGE-029 で対応するため、製造担当の Plan Mode 確認は不要（経路は設計確定）。
6. 取込ファイルサイズ上限（提案: 1 ファイル数千行。DES-001 の 1000 行＝FR405 用は流用しない＝DES-002 §7.5 L365）。
7. seed クリア + 再投入マイグレの方式・番号（§4.9。既存 000004_seed_moves_ryu 等の無効化方法）。

---

## 4. 詳細仕様

### 4.1 取込エンドポイント（DES-002 §4.2 L143 / §7.5 L361-363）

「プレビュー → 実行」の2操作とする（DES-002 §7.5 L361-363）。プレビューは total 算出・properties 正規化・要確認判定をサーバ側で行い表示する必要があるため、サーバ解析を要する。

- **決定: 別経路方式**（`POST /api/import/moves/preview`（dry-run。CSV を解析・算出・正規化し、行ごとの確定値 + 要確認フラグ + 検出エラーを返す。**DB 書込なし**）+ `POST /api/import/moves`（commit。選択された行のみ upsert））。**解析・算出・正規化ロジックは共通サービス層に置き、preview / commit の両エンドポイントがそれを呼ぶ**（重複を作らない・計算の単一情報源）。開発者が方式を設計担当へ一任（2026-06-14）、拡張性・保守性の観点で本方式を採る。
- 採用根拠（拡張性・保守性）: (1) 読み取り（preview = 副作用なし）と書き込み（commit = 変更）の責務分離で、各々を独立に拡張できる（M9-03 のグリッド編集・将来の再取込は commit 側、プレビュー表示系は preview 側に閉じる）。(2) 「書き込みエンドポイントが条件次第で書かない」フラグ方式の事故（dryRun 取り違えで誤書込）を構造的に排除。(3) preview と commit はレスポンス型が異なる（PreviewRow[] vs RowResult[]）ため、別経路の方が型が素直で条件分岐の肥大を避けられる。(4) 監査ログ・レート制限・認可など横断関心を read/write で別ポリシー適用しやすい。(5) 設計書の「プレビューは寛容 / 取込時は厳格」（DES-002 §7.5 L361-362）の2段階思想に経路が素直に対応する。
- **文書影響（解消済み）**: `/preview` 経路は **CHANGE-029 で DES-002 §4.2 に正式記載済み（v1.14.0、2026-06-14）**。取込プレビュー画面も DES-005 §2 画面17 + §5.17 に新設済み（v2.14.0）。製造担当は両設計書を正として実装する。
- 概念シグネチャ（Go、完全実装でなくてよい）:
  ```
  // 共通サービス: ParsePreview(csv) → PreviewRow[]（解析・算出・正規化・要確認フラグ。書込なし）
  // preview ハンドラ: multipart で CSV 受領 → ParsePreview → PreviewRow[] を返す
  // commit  ハンドラ: 選択行（PreviewRow 由来）→ 行単位 upsert → RowResult[] を返す（内部で同じ ParsePreview を再利用してから書く）
  ```

### 4.2 CSV 解析と列マッピング（DES-002 §7.5 L394-427 を正とする）

CSV ヘッダは 22 列（`combomgr-importer/dist/*.csv` 実測一致）: character_code, move_code, category, name_ja, startup, active, recovery, on_hit, on_block, drive_gauge_increase, drive_gauge_decrease_guard, drive_gauge_decrease_punish, super_art_gauge_increase, damage, combo_scaling, properties, is_aerial, setup_only, notes, command, condition_ja, condition_en。

反映先（DES-002 §7.5 表）:

- character_code → `characters`（upsert キー `(game_id, code)`）。
- move_code → `moves.code`（upsert キー `(character_id, code)`）。
- name_ja → **preset_aliases**（preset = official_ja_move、`move_id`、`alias_text`）。**moves に名前列は無い**（code-facts §8 で `model.Move` に NameJa が無いことを確認）。§4.6。
- startup / active / on_hit / on_block / drive_gauge_* / super_art_gauge_increase / damage / is_aerial / setup_only → moves 同名列。
- recovery → moves 非永続。total 算出の入力（§4.3）。
- combo_scaling → moves.combo_scaling（JSON 文字列。§4.4）。
- properties → moves.properties（コード値正規化。§4.4）。
- notes → moves.raw_data（§4.5）。command / condition_ja / condition_en → moves.raw_data 同名キー（CHANGE-027）。

CSV 値の安全な解釈: セル値を式・コマンドとして評価しない（プレビュー描画時にエスケープ。DES-002 §7.5 L361 無害化）。

### 4.3 total 算出ロジック（CHANGE-028 = DES-003 §3.3 末尾注記）

式: **`total = 発生 + 持続 − 1 + 硬直`**（`startup + active − 1 + recovery_frames`）。recovery は公式原文文字列で、整数フレームの抽出が要る。`combomgr-importer/dist/*.csv` 実測で多いパターンは `整数` / `全体 N` / `着地後N`。

分岐（Plan Mode-4 で確定）:

- `recovery` が**整数** → `recovery_frames = 整数`、式適用。
- `recovery` が **`全体 N`**（弾系。実測多数）→ 公式が全体フレームを直接与えているので **`total = N` 直接**（式を適用しない。DES-003 §3.3 L333「total に反映」）。
- `recovery` が **`着地後N`**（空中技。実測多数）・`N+着地後M`・`N-着地まで`・`[※2] 1-12`・**その他/未知** → **自動算術せず `total = NULL` + 要確認強調**。利用者が FR703 で手動補正（DES-003 §3.3 L334。自動で誤った total を入れない）。**この routing は開発者確認済み（2026-06-14）**。
- **NULL 伝播**: 式適用ケースで 発生・持続・硬直のいずれかが空欄/解釈不能なら `total = NULL`（CHANGE-025）。`active` も NULL 可（弾系）。実測で startup 空欄が 24 行 → これらは total NULL。

> 設計判断: 自動算出は「整数」「全体 N」の明確ケースに限定し、それ以外は NULL + 要確認とする（推測で算術しない＝§9.1）。

### 4.4 properties 正規化 / critical_art 写像 / combo_scaling キー照合

- **properties**（DES-003 §3.3 L336、CHANGE-022）: 公式属性 → コード値（`high`/`mid`/`low`/`throw`/`projectile`/`air_projectile`）。複数値（稀）は主属性をコード値、残りを raw_data へ。未知属性は raw_data 退避 + 要確認。
- **critical_art**（DES-003 §3.3 L285 enum、DES-004 §2.1、CHANGE-025）: CA 行を `category = critical_art`、code は `ca_` 接頭辞で取込（実測 critical_art 5 件 = 各キャラ 1）。`super_art`（SA）と区別。ラッシュ可否導出には不参加。category enum 写像は DES-002 §7.5 L398（公式カテゴリ → enum）。
- **combo_scaling**（DES-003 §3.3 L298-320）: 正準4キー = `initial_scaling` / `combo_scaling` / `immediate_scaling` / `multiplier_scaling`。moves.combo_scaling へ JSON 文字列として格納。**取込時に JSON キーを正準4キー集合と照合し、未知キーを含む行は要確認強調**（ツール追従漏れ検出ゲート）。`multiplier_scaling` は実データ（取込対象）には出現しないが（キャンセルラッシュ限定・対象外）、正当キーとしてホワイトリストに含める（テスト出力で出力確認済み）。

### 4.5 notes 取扱い（DES-002 §7.5 L427、addendum §2）

- ツール出力 notes は 3 層: 原文ブロック（`;` 連結）+ 境界 `【ツール付記】` + 付記ブロック（`; ` 連結）。
- **パース = `【ツール付記】` で 2 分割**（前半 = 原文・後半 = 付記）。原文ブロックは**再分割しない・保持のみ**（フェーズ2。原文に `; ` を含む残リスクは再分割しないため実害なし）。
- on_hit/on_block の退避（DES-002 §7.5 L402）: `D` → 空欄（NULL）+ 付記、`※N` → 数値 N + 付記、範囲・`ー` → 空欄 + 原文退避。
- notes 全体は moves.raw_data へ格納し、取込プレビューの要確認強調の元データとする。

### 4.6 行単位 upsert・部分成功・preset_aliases 投入（DES-002 §7.5 L361-363）

- 依存順: **characters → moves → preset_aliases**。親 characters 失敗行に紐づく moves はスキップ。
- moves upsert キー `(character_id, code)`、characters upsert キー `(game_id, code)`。
- **name_ja の preset_aliases 投入**: official_ja_move プリセットの alias として upsert（move_id, alias_text = 正規化済み name_ja）。**既存の alias 投入経路（seed 000006_seed_aliases_official_ja_move）を確認し再利用**（Plan Mode-3）。通常投げ 1・2 件目の公式名退避（`公式名: …`）は notes 側（§4.5）。
- 全体ロールバックしない: 失敗行はスルーして次行へ、行単位レポート（成功/スキップ/失敗 + 理由）を返す。再編集は M9-03。
- DB 取込時に型チェック + スキーマ制約（NOT NULL / FK / UNIQUE / enum 値域）+ total 算出（§4.3）を実施（DES-002 §7.5 L362、DES-006）。

### 4.7 取込プレビュー UI（DES-005 §5.14 のコンボ取込と同方式を踏襲。ただし別画面）

- ファイル選択（moves CSV。複数キャラ分を 1 ファイル/複数ファイルで受領＝Plan Mode で確認）。
- プレビュー領域: 行ごとに確定値（算出後 total・正規化 properties・写像 category）を表示、各行チェックボックス（取込対象選択、既定全チェック）。
- **要確認強調**（行ハイライト）: (i) recovery 要確認語（空振り/増加/減少/全体/変化）含む行（DES-003 §3.3 L334。強調語リストは差し替え可能に保持）、(ii) total NULL 行、(iii) 未知 combo_scaling キー行、(iv) 未知 properties 行、(v) 通常投げ 3 件目以降（実例: dhalsim `yoga_splash`）、(vi) 検出エラー行。
- 無害化: セル値を式/コマンドとして解釈せず描画エスケープ（DES-002 §7.5 L361）。
- 実行後: 行単位レポート表示（成功/スキップ/失敗）。
- 本画面は **DES-005 §5.17（画面17）に新設済み（CHANGE-029、v2.14.0）**。§5.14 のコンボ CSV（FR405）とは別画面・別系統。

### 4.8 model.Move 正準化（M8-A4。Plan Mode-1/-2 確定後に実施）

- 実体（code-facts §8/§9）: `model.Move` = moves 全 20 列・db+json タグ両持ち・構築箇所ゼロのデッドコード。`MoveListItem` = GET 投影 15 フィールド = moves 14 列 + `NameJa`（結合由来、moves 列でない）。`MoveResponse` DTO = MoveListItem と 1:1。
- 方針: `model.Move` を正準フル行型へ昇格し、本取込 upsert を初の構築箇所とする（全 20 列を書くため `model.Move` が必要 → 「構築箇所ゼロ」を統合で解消）。
- GET 投影は **Plan Mode-1 の意味判別の結論に従う**: 意図的投影なら `model.Move` を scan/埋め込みしつつ GET 露出は DTO で従来どおり狭く保つ（推奨: `MoveListItem` が `model.Move` を埋め込み + `NameJa`、非公開 6 列は DTO 側で露出制御）。死蔵なら完全統合。**いずれでも `MoveResponse`（GET 契約）は不変**。
- `NameJa` は preset_aliases（official_ja_move）結合由来の表示フィールドで moves 列ではない → `model.Move` の外（埋め込みラッパ or サービス層注入）。取込が §4.6 で preset_aliases へ name_ja を書くので GET の NameJa はそこから解決。

### 4.9 seed（M9-02 = 加算のみ。破壊的クリアは M12-02 へ延期。確定 2026-06-14）

- **M9-02 スコープ**: マイグレ 000014 は **classic 5 体の未 seed キャラ名追加のみ（ken / ingrid / c_viper / dhalsim、ryu は既存 000003）**。取込は既存 seed へ upsert して機能する。**旧 seed の破壊的 DELETE・参照（combos/combo_steps/recipe_cache）クリアは行わない**。
- **延期の理由**: `dbtest.Setup` が全マイグレを適用するため、000014 で旧 seed を DELETE すると seed 依存の既存テスト（13 ファイル・約 185 箇所）が破壊され DoD「既存 spec 通過」に反する。破壊的 seed クリア + 参照クリアは配布クリーン初期状態を扱う **M12-02 へ移譲**（CHANGE-025 §3.4 の設計判断は不変、実行時期のみ M9→M12-02）。
- **境界（SUPP §3.3.2）の後続申し送り**: 純粋入力ジャンプ（`jump_neutral` 等）・基本ダッシュ・drive_parry は実 CSV（classic 5）に system カテゴリ 0 件で取込対象外。コンボ/セットプレイが移動入力を参照する設計なら、これらの seed 投入計画を後続（M10/M11 のデータ要件確認 or M12-02）で立てる。公式行を持つジャンプ系技（ヴァイパー `high_jump` 等）はツール取込。
- 過渡状態（既知）: 旧手 seed の ryu 技（`stand_*`/`forward_throw`）と取込後の公式技（`standing_*`/`throw_forward`）が dev/test DB で共存（コード相違で upsert 衝突せず別行）。テストは旧コードを引くため通過。M12-02 で一掃。

---

## 5. テスト要件

### 5.1 必須テスト（Go test / Vitest）

Go test（取込サービス・リポジトリ）— ケース数で語る。**フィクスチャは `combomgr-importer/dist/*.csv` の実データから代表行を抜き出して用いてよい**（合成データと併用。実パターンの回帰になる）:

- total 算出（§4.3）: (a) 整数 recovery で式適用（例 startup=4/active=3/recovery=7 → total=13）、(b) `全体 N` → total=N、(c) `着地後N` → total=NULL + 要確認、(d) startup 空欄 → total=NULL、(e) active 空欄（弾系）→ total=NULL。
- properties 正規化（§4.4）: 単一値→コード値、複数値→主+raw_data、未知→raw_data+要確認。
- combo_scaling キー照合（§4.4）: 正準4キー（multiplier_scaling 含む）受理、未知キー→要確認。
- critical_art 写像（§4.4）: CA 行 → category=critical_art / code `ca_`。
- notes パース（§4.5）: `【ツール付記】` 2 分割、原文に `; ` を含むケースで原文が壊れない。on_hit `D`→NULL+付記、`※N`→数値+付記。
- 行単位 upsert（§4.6）: 冪等（同一 CSV 再取込で重複行が増えない＝upsert キー有効）、部分成功（不正行スルー + 後続行取込継続 + レポート）、依存順（characters 失敗時の moves スキップ）、preset_aliases 投入。

Vitest（フロント）:

- 取込プレビュー: 要確認強調（§4.7 の (i)〜(vi) 各条件で行がハイライト）、行チェックボックス選択（既定全チェック・個別解除）、行単位レポート表示。

### 5.2 E2E シナリオ（§6 参照。seed 非依存 self-contained）

- シナリオA: moves CSV を選択 → プレビュー表示（要確認行の強調を確認）→ 一部行のチェックを外す → 実行 → 行単位レポート（成功/スキップ）→ `GET /api/moves` で取込結果が反映（name_ja の表示名解決を含む）。
- 注: seed 再生成前提のため spec は件数非依存・self-contained で書く（SUPP §4.5、CHANGE-024）。視覚/レスポンシブ/LAN/実機は手動継続。

---

## 6. レビュー観点（別ファイル参照）

機械レビューは `M9-02-review-checklist.md` に従う（本指示書と対で設計担当が作成）。

---

## 7. 完了条件（Definition of Done）

### 7.1 機能要件

- `POST /api/import/moves/preview`（または dryRun）で算出後 total・正規化 properties・写像 category・要確認フラグを含むプレビューを返す（DB 書込なし）。
- `POST /api/import/moves` で選択行を characters / moves / preset_aliases へ行単位 upsert、行単位レポートを返す。
- 取込プレビュー画面で要確認強調・行選択・実行・レポート表示が動作する。
- `model.Move` 正準化が完了し、`GET /api/moves`（MoveResponse 契約）が従来どおり動作する。

### 7.2 自己テスト結果（製造担当の責任範囲）

- §5.1 の Go test / Vitest ケースが全通過（ケース数で報告）。

### 7.3 品質チェック

- `make e2e`（§5.2 シナリオA 追加後）通過。既存 combo-crud spec が引き続き通過。
- 既存 `GET /api/moves` の API 契約（MoveResponse）に差分がないこと。

### 7.4 ドキュメント

- 取込プレビュー UI 確定に伴う DES-005 追記は設計担当が CHANGE-029 で対応（製造担当は実装のみ）。

### 7.5 完了報告

- 実装方式（Plan Mode で確定した model.Move 集約方式・recovery 分岐・preview 経路）、テストケース数、既知の制約（着地後N 等の要確認行は FR703 待ち）を報告。

---

## 8. 参照ドキュメント

| 文書 | 節 | 用途 |
|------|-----|------|
| DES-002 v1.13.0 | §4.2 / §7.5 | エンドポイント・CSV 契約・取込挙動 |
| DES-003 v1.19.0 | §3.3 | moves 列・total 式・combo_scaling キー・properties・raw_data |
| DES-004 v1.6.0 | §2.1 | code 規約・`ca_` |
| DES-006 v1.11.0 | 取込バリデーション | 型チェック・制約 |
| CHANGE-025/026/027/028 | — | 確定根拠 |
| M9-overview | v0.2.0 | 上位設計 |
| code-facts | §4/§7/§8/§9 | ルート・MoveResponse・model.Move・MoveListItem |
| `combomgr-importer/dist/*.csv` | classic 5 CSV（+ `*.review.md`、Claude Code 閲覧可） | 実データ裏取り |

---

## 9. 注意事項・判断に迷ったら

### 9.1 推測で進めてはいけない事項

- `model.Move` 集約の実装方式（§4.8）: Plan Mode-1/-2 で意味判別・実 SQL 突合を確定する前にコード化しない。
- recovery の不明パターンの total（§4.3）: 自動算術せず NULL + 要確認。
- preset_aliases 投入経路（§4.6）: 既存経路を確認してから実装。
- GET 契約（MoveResponse）の変更: 不可。集約しても公開フィールドを変えない。

### 9.2 推測で進めてよい事項（その旨を明示）

- 取込サービス/ハンドラ/フックの内部構成・ファイル分割は既存パターン（code-facts §2/§4 の命名・配置）に合わせて製造担当裁量でよい。
- 取込プレビューのレイアウト詳細（要確認強調の視覚表現）は shadcn/ui 既存パターンに合わせて裁量（DES-005 追記は確定仕様のみ規定）。

### 9.3 不明事項発見時の対応

- §3.4 / §9.4 以外の不明点が出たら Plan Mode 質問書（playbook §8.4 方式）で開発者へ提示。

### 9.4 Plan Mode で計画提示時に含めるべき項目

§3.4 のうち製造担当が Plan Mode で確認する項目: model.Move 意味判別（-1）/ GET 実 SQL（-2）/ preset_aliases 経路（-3）/ サイズ上限（-6）/ seed マイグレ方式（-7）の5点 ＋ recovery の parse 実装詳細（-4 は方針確定済、実装ロジックのみ）。preview 経路（-5）は設計確定のため Plan Mode 対象外。

---

## 10. 完了後の次ステップ

- **M9-03**（FR703 手動修正）: 取込結果のグリッド編集・ラッシュ版生成・is_aerial トグル・投げ並び補正・notes 編集。本取込結果に作用。
- **CHANGE-029**（設計担当）: 取込プレビュー UI 仕様確定後に DES-005 追記を起票（+ §4.2 preview 経路追記の要否を同梱判断）。
- model-allocation に M9-02 行を追記（着手時）。

---

*以上、M9-02 製造指示書 v1.0.4*
