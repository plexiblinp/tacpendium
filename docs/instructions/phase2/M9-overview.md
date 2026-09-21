# m9-overview: M9（公式データ取込パイプライン）設計概要

| 項目 | 内容 |
|------|------|
| 文書種別 | 補足資料（overview。CHANGE 通知書対象外・自由改訂） |
| バージョン | 0.5.0（ドラフト。M9-04 を §12 に統合〔旧 M9-04-overview 廃止〕・§11 を M9-04=最終サブ/M9 終了へ・B-1/B-2-heavy を M9 外後続として明記） |
| 作成日 | 2026-06-14 |
| 作成者 | 設計担当 Claude（フェーズ2 継続担当・M9-02 スパイン） |
| 位置づけ | M9（FR704 取込 / FR703 手動修正）の設計を製造指示書化する前に、設計判断・スコープ・着手前確認・CHANGE 見込みを確定する overview。phase2-overview v0.2.0 §5 が M9 成果物として本書を参照 |
| 前提 | m8-to-m9-handover v1.2.0、phase2-overview v0.2.0 §3 M9、DES-002 v1.13.0 §4.2/§7.5、DES-003 v1.19.0 §3.3（CHANGE-028 反映後）、DES-004 v1.6.0 §2.1、DES-005 v2.13.0 §5.14、DES-006 v1.11.0、SUPP-001 v1.24.0 §3.3.2/§3.6/§4.5、code-facts（2026-06-13 再生成版、§8/§9）、CHANGE-022/025/026/027/028、fr701-mainline-handover、fr701-m9-02-handover-addendum |

---

## 1. 目的・位置づけ

公式 HTML → CSV（FR701 別ツール、M9-01 完了）→ DB 取込（FR704、M9-02）→ 手動修正（FR703、M9-03）のパイプラインのうち、本体側（M9-02 / M9-03）を設計する。M8 で moves スキーマ・CSV 契約は確定済み（CHANGE-022/025/026/027）、total 算出式は確定済み（CHANGE-028）。本書は残る設計判断（取込挙動・プレビュー UI・model 型集約・seed 再生成・DES-005 追記要否）を確定する。

---

## 2. M9 サブユニット構成

| サブユニット | 内容 | 状態 |
|---|---|---|
| M9-01 | FR701 取込ツール（CSV 出力、別バイナリ） | 完了（別チャット）。本体とは CSV 契約越しに疎結合 |
| M9-02 | FR704 アプリ取込（`POST /api/import/moves`、プレビュー + 行単位 upsert + total 算出 + 正規化 + エイリアス投入 + model 型集約） | 本書で設計 |
| M9-03 | FR703 手動修正（グリッド編集・ラッシュ版生成・is_aerial トグル・投げ並び補正・notes 編集） | 本書で設計、M9-02 の取込結果に作用 |

---

## 3. M9-02（FR704 アプリ取込）設計

### 3.1 取込フロー

`POST /api/import/moves`（DES-002 §4.2 L143。設計定義済みだが**未実装** = code-facts §4 にルート無し → M9-02 が新設）。

- **依存順**: characters → moves → preset_aliases（DES-002 §7.5 L363 + L399/L414）。親キャラ取込に失敗した行に紐づく moves はスキップ。
- **3 種の書込先**:
  1. `characters`（upsert キー `(game_id, code)`）
  2. `moves`（upsert キー `(character_id, code)`）= 全列（startup〜raw_data）
  3. `preset_aliases`（preset = official_ja_move、`move_id`、`alias_text` = name_ja）。**moves に名前列は無い**（code-facts §8 で `model.Move` に NameJa が無いことを確認）。表示名は preset_aliases が保持し、GET の `NameJa` はこの結合由来（後述 §3.9）。
- **プレビュー → 実行**: プレビューは**寛容**（DES-002 §7.5 L361。正しさのバリデーションを課さず、エラーを含む行も表示。セキュリティ無害化のみ＝セル値を式・コマンドとして解釈せず描画時エスケープ）。DB 取込時に total 算出 + 行単位の型チェック + スキーマ制約（NOT NULL/FK/UNIQUE/enum 値域）を実施（DES-002 §7.5 L362、DES-006）。
- **行単位・部分成功**: 全体ロールバックは行わない。失敗行はスルーして次行へ、結果を行単位でレポートし、失敗行のみ再編集に回す（DES-002 §7.5 L363）。

### 3.2 CSV 列 → 反映先（DES-002 §7.5 L394-427 を正とする要約）

| CSV 列 | 反映先 |
|---|---|
| character_code / move_code | characters.code / moves.code（upsert キー） |
| category | moves.category（enum 写像） |
| name_ja | **preset_aliases**（official_ja_move） |
| startup / active | moves 同名列 |
| recovery | moves 非永続 → total 算出の入力（§3.3） |
| on_hit / on_block | moves 同名列（`D`/`※N`/範囲は退避規則、§3.6） |
| drive_gauge_* / super_art_gauge_increase / damage | moves 同名列 |
| combo_scaling | moves.combo_scaling（JSON 文字列、§3.4） |
| properties | moves.properties（コード値正規化、§3.5） |
| is_aerial / setup_only | moves 同名列 |
| notes | moves.raw_data（要確認強調の元・total 手修正の参照、§3.6） |
| command / condition_ja / condition_en | moves.raw_data（同名キー退避、CHANGE-027） |

### 3.3 total 算出（CHANGE-028 = DES-003 §3.3）

- 式: **`total = 発生 + 持続 − 1 + 硬直`**（`startup + active − 1 + recovery_frames`）。
- recovery は CSV の公式原文文字列。整数フレーム抽出の**解釈ロジックを M9-02 で設計**（CHANGE 対象外）。入力パターン: 整数 / `全体 N` / `着地後N` / `N+着地後M` / `N-着地まで` / `[※2] 1-12` / 空欄。
- **NULL 伝播**: 発生・持続・硬直のいずれかが空欄/解釈不能なら `total = NULL`（CHANGE-025。active も NULL 可なので弾系の持続空欄行も NULL になりうる）。
- 「空振り時硬直 N 増加」は式に算入せず FR703 手動補正。
- **要確認強調**: 取込プレビューで該当語（空振り/増加/減少/全体/変化）を含む行を強調（DES-003 §3.3。強調語リストは差し替え可能な形で保持）。未知 recovery パターンも要確認。

### 3.4 combo_scaling 正準キー

- 正準キー = `initial_scaling` / `combo_scaling` / `immediate_scaling` / `multiplier_scaling`（DES-003 §3.3 確定。構造例 + 日英対応表 + 命名方針）。
- **最新 CSV（dist.zip、classic 5・339 データ行）の実測**: combo_scaling セルは `initial_scaling`（101）/ `combo_scaling`（38）/ `immediate_scaling`（14）= **正準形（`_scaling` 付き）を出力済み**。3 キーはツール追従が反映済みと判断（ツール側の旧申告「initial/combo/immediate/multiplicative」とは異なり最新ビルドは追従済み → どのビルドが正かをツール側と突合）。第4キー `multiplier_scaling`（乗算補正）は classic 5 に1件も出現せず（`multiplic`/`multiplier`/`乗算` 全文0件）**未確認** → ツール側に第4キー形を明示確認（観測不能のため）。
- 本体は combo_scaling を JSON 文字列として moves.combo_scaling へ格納。**取込時に正準4キー集合と照合し、未知キーを要確認強調**（ツール追従漏れ・第4キー差異の検出ゲート。第4キーが観測不能な以上このゲートは必須）。

### 3.5 properties 正規化・critical_art 写像

- properties: 公式属性をコード値（`high`/`mid`/`low`/`throw`/`projectile`/`air_projectile`）へ正規化（DES-003 §3.3 L336、CHANGE-022 既定）。複数値（弾系「上・弾」等、稀）は主属性をコード値、残りを raw_data へ。
- critical_art: CA 行を `category = critical_art`（DES-003 §3.3 L285 enum）、code は `ca_` 接頭辞（DES-004 §2.1、CHANGE-025）で取込。`super_art`（SA1〜3）と区別。ラッシュ可否導出には不参加。

### 3.6 notes 取扱い方針【(d) 確定】

- ツールの 3 層出力（原文ブロック `;` 連結 / 境界 `【ツール付記】` / 付記ブロック `; ` 連結。DES-002 §7.5 L427、addendum §2）。
- **パース = `【ツール付記】` で 2 分割**（前半 = 原文・後半 = 付記）。
- **フェーズ2 方針: 原文ブロックは再分割せず保持・表示のみ**（英語ロケール範囲外・notes 消費機能なし・プレビューは寛容）。原文が `; ` を含む残リスクは、再分割しないため実害なし。FR703 で手動編集可。
- on_hit/on_block の `D`（空欄+付記）/ `※N`（数値+付記）/ 範囲（空欄+原文退避）は DES-002 §7.5 L402 の退避規則どおり。

### 3.7 取込プレビュー UI

- 表示: CSV 解析結果を行単位で表示。各行チェックボックス（取込対象選択、既定全チェック。DES-005 §5.14 のコンボ取込と同方式を踏襲）。
- 要確認強調: §3.3 強調語該当行・投げ 3 件目以降・未知 combo_scaling キー・未知 recovery パターン・算出不能（total NULL）行。
- 無害化: セル値を式/コマンドとして解釈せず描画エスケープ（DES-002 §7.5 L361）。
- 実行後: 行単位レポート（成功/スキップ/失敗）。失敗行は再編集へ。
- **この UI は DES-005 に未定義**（§6 参照）。

### 3.8 サイズ上限

- DES-001 の CSV 一括 1000 行は**コンボ CSV（FR405）の値であり本取込（FR704）へ流用しない**（DES-002 §7.5 L365）。
- **確定値: 5,000 行/ファイル（`MaxImportRows = 5000`）**（M9-02 製造で確定、2026-06-14）。DES-002 §7.5 が上限を「m9-overview / SUPP で定める」と委譲しているため、本書のこの値が正準（DES 本体の CHANGE 不要）。実測は数百行/キャラ × classic 5 で、5,000 行は十分な余裕。

### 3.9 model.Move 正準化【M8-A4 アーキ判断】

code-facts 再生成版 §8/§9 でフィールド突合済み。

- `model.Move`（`internal/model/move.go`）= moves 全 20 列、db+json タグ両持ち、構築箇所ゼロのデッドコード。NameJa を持たない。
- `MoveListItem`（`internal/repository/move/repository.go`）= GET 投影 15 フィールド = moves 14 列 + `NameJa`（結合由来、moves 列でない）。`model.Move` から `Damage`/`ComboScaling`/`DriveGaugeIncrease`/`DriveGaugeDecreasePunish`/`SuperArtGaugeIncrease`/`RawData` を非公開。`MoveResponse` DTO = MoveListItem と 1:1。

**判断**: `model.Move` を正準フル行型へ昇格し、M9-02 取込で活性化する。
- 取込 upsert は全 20 列を書くため `model.Move` が必要 → 取込が `model.Move` の自然な初の構築箇所（「構築箇所ゼロ」を削除でなく統合で解消）。
- GET 投影（MoveListItem）は意図的投影として残しつつ、共有 14 列を `model.Move` から導出して二重定義を解消（推奨: `MoveListItem` が `model.Move` を埋め込み + `NameJa`、非公開 6 列は DTO 側で露出制御）。
- `NameJa` は preset_aliases（official_ja_move）結合由来の表示フィールドで、moves 列ではない → `model.Move` の外に置く（埋め込みラッパ or サービス層注入）。取込は §3.1 のとおり preset_aliases へ name_ja を書くので、GET の NameJa はそこから解決される。

**Plan Mode 調査項目（製造担当が live code で確定。shell 抽出 code-facts は SQL を出さない）**:
1. **二重定義が「意味ある投影」か「死蔵スキャフォールド」かの判別**（開発者要望 2026-06-14）。`MoveListItem` が6列（`Damage`/`ComboScaling`/`DriveGaugeIncrease`/`DriveGaugeDecreasePunish`/`SuperArtGaugeIncrease`/`RawData`）を**意図的に除外している理由**を確認。判定基準: (a) GET 一覧のペイロード削減/性能目的の意図的投影 → 投影境界を保持（`model.Move` を scan/埋め込みしつつ GET 露出は DTO で従来どおり狭く保つ）。(b) writer 不在で未活性の死蔵 → 完全統合してよい。**いずれの結論でも推奨方式（`model.Move` 埋め込み + DTO 投影、`MoveResponse` を GET 契約として固定）は安全**で、本調査は隠れた投影意図の取りこぼし防止が目的（統合可否自体は止めない）。
2. GET `/api/moves` の実 SQL（SELECT 列・JOIN）と scan 先。`model.Move` へ寄せられるか・GET SQL を全列へ広げてよいか。
3. preset_aliases（official_ja_move）の結合実装と、取込での alias upsert 経路（既存 alias 投入 = seed 000006、新規取込で再利用可か）。
4. `model.Move` の json タグの現使用箇所（dead のはずだが、DTO 化で API 形を変えないこと。`MoveResponse` を GET 契約として固定）。

**M9-02 での実結果と確定（2026-06-14）**:

- Plan Mode-1 で開発者が「**GET 読取路は一切変更しない**」と確定。これにより、当初推奨した `model.Move` 埋め込み（GET 投影の導出）は**未実施**。`model.Move`（取込で活性化）と `MoveListItem`（GET 用）が約 14 フィールドを**重複保持**したまま。
- ただし **M8-A4 の主眼だったデッドコード（`model.Move` 構築箇所ゼロ）は取込活性化で解消済み**。GET 契約（`MoveResponse`）も不変。
- **設計判断（恒久確定にはしない・後続集約として延期）**: フェーズ2 中は moves スキーマが確定（列追加予定なし）で重複の主リスク（列追加時の同期漏れ）が発生しにくく、集約は GET 読取路変更を伴い利益が小さいため、**フェーズ2 中の集約は不要**。再着手条件＝ moves 列追加変更時、または専用リファクタ工程（フェーズ3 等）。集約を行う場合は GET 読取路変更を伴うため**別指示**が必要。
- **安価な防御（推奨・M9-03 か小タスクで）**: 両構造体の共有フィールド集合の一致を検証する単体テスト、または最低限の相互参照コメントを入れ、乖離を検出可能にする（GET 読取路は触らない範囲で M8-A4 の同期漏れ懸念に対処）。

M9-02 の取込結果（要確認行を含む）に作用する編集機能。

- **グリッド編集**: 取込済み moves の一覧グリッドで各列を手動修正（total・フレーム・properties・notes 付記）。
- **ラッシュ版生成**: 対象の通常技・特殊技（`category ∈ {normal, unique}` かつ `is_aerial = false`）から `category = rush_variant` + `original_move_id` の move を生成（DES-003 §3.3 L337/L418。CSV スコープ外＝FR703 が担う）。`code` は `rush_<元技code>`。
  - **M9-03 既知制約（レビュー指摘 #1、2026-06-14）**: ラッシュ版生成は **official_ja_move エイリアスを自動書込しない**（Plan Mode-Q3「name 表示のみ」+ §1.3「ラッシュ命名は将来」+ DES-004 組み込みプリセット read-only に整合。当初実装が `(ラッシュ)` サフィックスで自動書込していたのをレビューで検出し削除）。よって**生成された rush_variant は M9-03 では official_ja 名を持たない（無名）**＝想定済みの帰結。official_ja 名の付与は将来の「ラッシュ版エイリアス自動生成ルール」で行う。重複生成は 409 + 既存 id（CHANGE-032）。
- **is_aerial 手動トグル**: 接頭辞の付かない空中技を true 化（DES-003 §3.3 L279）。
- **投げ並び補正**: 通常投げ 3 件目以降・並び順想定外キャラの is_aerial・命名補正（DES-002 §7.5 L422/L424）。
- **notes 付記の手動編集**: `【ツール付記】` ブロックの編集。

設計は M9-02 の取込結果・プレビュー UI 確定後に詳細化する。

---

## 5. seed 再生成マイグレ【M9-02 では加算のみ・破壊的クリアは M12-02 へ延期（確定 2026-06-14）】

- **M9-02 実績**: マイグレ 000014 は **classic 5 体の未 seed キャラ名追加のみ（ken/ingrid/c_viper/dhalsim、ryu は既存）**。取込は既存 seed へ upsert して機能する。**旧 seed の破壊的 DELETE は行わない**。
- **延期の理由**: `dbtest.Setup` が全マイグレを適用するため、000014 で旧 seed を DELETE すると seed 依存の既存テスト（13 ファイル・約 185 箇所）が一斉に壊れ、M9-02 DoD「既存 spec 通過」に反する。破壊的 seed クリア + 参照（combos/combo_steps/recipe_cache）クリアは、配布クリーン初期状態を扱う **M12-02 へ移譲**（CHANGE-025 §3.4 の設計判断は不変、実行時期のみ M9→M12-02。指示書 §4.9 が M12-02 整合を明記）。
- **過渡状態（既知）**: dev/test DB では旧手 seed の ryu 技（`stand_*`/`forward_throw`）と取込後の公式技（`standing_*`/`throw_forward`）が共存する（コードが異なり upsert 衝突せず別行）。テストは旧コードを引くため通過。M12-02 で旧 seed + 参照を一掃して解消。
- **M12-02 への申し送り**: (1) 旧 seed（000004_seed_moves_ryu 等）の無効化 + 参照 combos/combo_steps/recipe_cache クリア（CHANGE-025）。(2) **テスト/seed 分離**（dbtest にテスト専用フィクスチャ＝製造担当案3 相当）を破壊的クリアと同工程で実施。(3) **純粋入力ジャンプ/基本ダッシュ/drive_parry の seed**: 実 CSV（classic 5）に system カテゴリ 0 件で取込対象外（SUPP §3.3.2 の「seed 管理継続」対象だが classic 5 はこれらを 1 件も持たない）。コンボ/セットプレイが移動入力を参照する設計なら、これらの seed 投入計画を後続（M10/M11 のデータ要件確認時 or M12-02）で立てる。(4) **000014 down の FK 注意点**（M9-02 製造申し送り B-7）: 000014 は classic 5 キャラ名の加算マイグレで、取込済 moves が ken/ingrid/c_viper/dhalsim に紐づくと down（rollback）が FK 制約で失敗する（取込前状態を前提とした down）。M12-02 の破壊的クリア／rollback 設計時に、down の前提（先に moves を消す等）を定義する。

---

## 6. DES-005 追記要否判断 → CHANGE-029（反映済み）

- DES-005 §5.14「インポート」は**コンボ CSV（FR405）専用**（コンボ CSV / セットプレイ CSV、NFR103 検証）で、moves 取込（FR704）のプレビュー UI は未定義だった。
- M9-02 取込プレビュー UI と `/preview` エンドポイント（別経路方式、§3.7 / 指示書 §4.1）を設計書本体へ確定するため **CHANGE-029 を起票・反映済み（2026-06-14）**: DES-002 §4.2 に `POST /api/import/moves/preview` 追加（v1.14.0）、DES-005 §2 画面17 + §5.17 新設（v2.14.0）。
- **M9-03（グリッド編集等）の UI は CHANGE-029 対象外**。M9-03 設計時に別途 CHANGE 起票する（当初の「M9-02/M9-03 を 1 通で」案は、M9-03 UI 仕様未確定のため分離した）。

---

## 7. E2E（M9 spec 相乗り）

- 段階導入（CHANGE-024）。基盤は M8-02（`make e2e` 通過）。M9 機能追加に spec を相乗り拡充。
- 再利用パターン（SUPP §4.5）: `isDraft` 0 ステップ回避、seed 非依存 self-contained spec（M9 で seed 再生成のため必須）、playwright.config 動的ポート読取。
- M9 候補 spec: 取込プレビュー → 行選択 → 実行 → 行単位レポート、FR703 グリッド編集の最小回帰。視覚/レスポンシブ/LAN/実機は手動継続。

---

## 8. サブユニット分割・モデル配分（提案）

| サブユニット | 関心数・特性 | 推奨モデル | Plan Mode |
|---|---|---|---|
| M9-02 | 中〜大（取込 + total 算出 + 正規化 + critical_art + preset_aliases 投入 + model.Move 正準化 + プレビュー UI + 行単位部分成功）= 複数システム統合 | **Opus クラス** | **必須** |
| M9-03 | 中（グリッド編集 UI + ラッシュ版生成ロジック + トグル/補正）。M9-02 結果に作用 | 着手時判断（Opus 候補。ラッシュ生成の original_move_id 派生に創発判断あり） | 必須 |

- 配分根拠は playbook §7.1（複数関心統合 → Opus、M6-02/M4-01 等の先例）。
- model-allocation.md への追記は各サブユニット**着手時**（M9-02 製造指示書作成時）に行う（M9 以降未追記。M9-01 はツール側で本表対象外）。

---

## 9. 着手前確認（Plan Mode 必須項目・集約）

M9-02 製造指示書の §3.4 に展開する。

1. model.Move 正準化 = 二重定義の意味判別（意図的投影か死蔵か）+ 実 SQL 突合（§3.9 の 1〜4）。
2. recovery 文字列 → 整数フレーム解釈ロジック（§3.3。未知パターンの要確認化）。
3. combo_scaling のツール追従反映確認 + 取込時の正準キー照合（§3.4）。
4. preset_aliases（official_ja_move）への name_ja upsert 経路（§3.1）。
5. seed クリア + 再投入マイグレの方式・番号（§5）。
6. 取込ファイルサイズ上限の具体値（§3.8）。
7. 取込プレビュー UI の DES-005 追記 CHANGE 起票（§6、着手前）。

---

## 10. CHANGE 見込みまとめ

| 対象 | 見込み | 時期 |
|---|---|---|
| total 算出式（DES-003 §3.3） | **CHANGE-028 済み** | 反映済み（2026-06-14） |
| moves 取込プレビュー UI + /preview（DES-002 §4.2 / DES-005 §2・§5.17） | **CHANGE-029 済み** | 反映済み（2026-06-14） |
| 取込 API/データ契約（raw_data キー・commit 形状・WarningCode/errors・FR701/FR704 責務分担） | **CHANGE-030 反映済み** | 反映済み（2026-06-14） |
| M9-03 moves 編集 API + 編集グリッド画面（DES-002 §4.2 / DES-005 §2・§5.18） | **CHANGE-031 反映済み** | 反映済み（2026-06-14） |
| M9-03 Plan Mode 契約（GET /api/moves/:id 単一フル・rush 重複 409・name_ja 表示のみ・楽観ロックなし） | **CHANGE-032 反映済み** | 反映済み（2026-06-14、実装と並行） |
| スキーマ・enum・CSV 契約 | 追加 CHANGE なし（022/025/026/027/028 で確定済み） | — |

---

## 11. M9 完了状況・後続（2026-06-14）

- **M9-02（FR704 取込）**: 検収完了（実装・レビュー・実機ゲート B-1/2/3/5/6 通過）。CHANGE-029/030 反映済み。
- **M9-03（FR703 手動修正）**: 検収完了（実装・レビュー・開発者 E2E 通過）。CHANGE-031/032/033 反映済み。レビュー指摘 #1〜#5 取り込み済み（#1=ラッシュ生成の official_ja エイリアス自動書込を削除＝生成 rush は M9-03 で無名・既知制約）。
- **M9-04（FR703 編集グリッド仕上げ・微修正）= M9 の最終サブマイルストーン**: §12 参照。これで **M9 終了**（開発者確認 2026-06-14）。
- **M9 外の後続（M9 のサブにしない・別マイルストーン候補として記録）**: 製造申し送りの後続課題を `m9-03-followup-backlog.md`（docs/handover）に永続記録。**B-1 命名クラスタ / B-2-heavy 編集グリッド操作拡張（行追加/削除/コピー）** は微修正規模を超える新機能（DES-004 read-only / DES-003 §616 上書き管理の設計判断を含む）のため M9 に含めず、M10 との優先を見て**別マイルストーンとして個別に立てる**（旧称 M9-05/M9-06 は撤回。記録は backlog §D）。B-3 フレーム式＝開発者課題（並行）、B-5 複数 CSV／B-6 検証ガードは後送り。
- **M12-02 申し送り**: §5 参照（旧 seed/参照クリア・test/seed 分離・移動入力 seed・000014 down FK）。

---

## 12. M9-04 設計（FR703 編集グリッド仕上げ・微修正）

> 旧 `M9-04-overview.md` を本節に統合（独立 overview は廃止。M9-02/M9-03 と同じく overview は本書集約・指示書のみ別）。詳細指示は `M9-04-instruction.md`。

- **スコープ（準備済み・軽量・現データ整備に直接効く）**: B-4 要確認シグナルの再導出 + B-2-light（ラッシュ版生成済みボタンの非活性化・表示順並び替え）。
- **B-4 要確認再導出（主設計）**: 取込済 moves は WarningCode 非永続（A-2）。取込プレビュー（§5.17）の WarningCode 判定を**共有関数**に整理し、保存済みデータから `total_null / unknown_properties / unknown_combo_scaling_key / extra_throw` を**読取時算出**（recovery_word は再導出不可＝total_null に吸収）。`GET /api/moves`（MoveResponse）に **`warnings: WarningCode[]` を加算**（後方互換・サーバ算出。extra_throw はキャラの throw 集合が要る）。編集グリッドは §5.17 と同じ WarningCode で全種強調。スキーマ不変（warnings は非永続）。
- **B-2-light(a)** rush_variant（`rush_<元技code>`）が一覧に既存ならボタン非活性（クライアント判定・API 追加不要・後段 409 は保険）。
- **B-2-light(b)** 表示順並び替え＝クライアント表示のみ（DB・主キー不変）。
- **接地点（Plan Mode 確定事項）**: warnings を MoveResponse 加算で surface（推奨）。判定は取込プレビューと**同一共有実装**に寄せ二重実装の乖離を防ぐ。
- **CHANGE-034 見込み**: DES-002 §4.2（MoveResponse に warnings 加算）+ DES-005 §5.18（要確認強調を warnings 全種へ・表示順並び替え追記）。Plan Mode 確定後・着手前に起票。
- **モデル**: Sonnet 4.6 / レビュー Sonnet 4.6（既存ロジック再利用中心・創発判断小。model-allocation v1.12.0）。

---

*以上、M9-overview v0.5.0（ドラフト）*
