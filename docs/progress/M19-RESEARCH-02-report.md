# M19-RESEARCH-02 調査報告: 窓方式の追試 と 派生技フレーム表現の現況棚卸し

- 対象指示書: `docs/instructions/M19-RESEARCH-02-window-and-derived-move-survey.md`（v1.0.0 ドラフト）
- 種別: read-only 調査 ＋ PoC 追試（judgement-free・設計結論は書かない）
- 実施日: 2026-07-22（Claude Code on the Web セッション）
- 前提 report: `docs/progress/M19-RESEARCH-01-report.md`（実施済み）
- 実査対象: 本体 combomgr（seed DB は migrations から `/tmp/poc/seed.db` に構築・原本不変）／別リポ `autopilot-combomgr/projects/setplay-suggestion`（read-only）

---

## 0. 結論サマリ

1. **【R-A/R-B 窓方式の独立追試】§4 の机上計算と実測が完全一致した**（§0.4 に従い迎合せず独立実測）。窓条件 `1 ≤ N ≤ active`（`N = KA+2−S`）で **N_min=1 のとき 4/5 成立**（GC-1 N=4・GC-3 N=3・GC-4 N=3・GC-5 N=2）。**GC-2 のみ不成立**（S=74・N=−29＝窓外）。着弾は全件 `S+N−1 = KA+1`（構造上のトートロジー＝実ゲートは `N∈[1,active]`）。
2. **【R-B 訂正の確認】** RESEARCH-01 の strict `S==KA` 基準は取り違えで、正しい窓基準では GC-1/3/4/5 が成立する、という一次受けの是正は**実測で裏付けられた**。RESEARCH-01 が抽出した実フレーム値（S=38/74/26/26/34、active=4/3/3/3/3）自体は正しく、判定式のみが誤っていた。
3. **【R-C 派生技】現行スキーマに汎用の親子リンクは不在**。`is_derived`（000032）は**フラグのみ・親参照なし**。親子参照は `moves.original_move_id`（**ラッシュ版のみ**）に限られ、`combo_steps`/`setup_steps` は 1 行 1 move。**派生技は親コンテキストを code 文字列に埋め込んだ別 move 行**として格納される（例: `quick_dash_shoryuken`）。
4. **【R-C-5 複数親】実在する**。ケン `kasai_thrust_kick` は親違いで 2 行（`..._during_od_gorai_axe_kick` su=11 / `..._during_od_senka_snap_kick` su=15）＝**同一基底技が親ごとに別 code・別 startup で格納**。関係は relational でなく code 名の接尾辞（公式記法の機械変換）で表現。
5. **【R-C-4 紫電カカト落とし】判別不能**。`thunder_kick` は `is_derived=1`・`startup=29`・`original_move_id=NULL`・`raw_data=空`。**startup=29 が単体公式値か派生時実測値か（＝奮迅脚の run 分を二重に含むか）を判別できるフィールドは seed に存在しない**。
6. **【R-F 機械判定】部分的にしか材料がない**。`moves.on_hit`（硬直差ヒット）は存在するが充足率 370/944（≈39%）。**「持続何フレーム目からコンボになるか（N_min）」を機械導出するには、per-active-frame の有利フレーム（後active ほど有利）が要るが seed は単一 on_hit のみ**＝不足。
7. **【設計チャットへの引き渡し】** 派生技のフレーム二重計上（GC-2）は「親子リンク不在＋派生値の provenance 未記録」という横断課題。DES-004 は rush（`rush_` 接頭＋`original_move_id`）と SA レベル（`_lv` 接尾）のみ規定し、**汎用の親＞子派生技表記規定は不在**。M16 ④'（CHANGE-065）で「多段特殊技区分は人手付与・本体は取込値信頼・自動判定しない」は既に確定済み。

### PoC 実行方法（再現用・ハーネスは `/tmp` 使い捨て）
- RESEARCH-01 で構築した `/tmp/poc/seed.db`（combomgr migrations 全 35 up を raw 適用）を再利用。
- `/tmp/poc/window/`＝窓判定ハーネス（実エンジン `setplay.Suggest` を窓範囲 `S∈[KA+2−active, KA+2−N_min]` で反復呼び出し、窓判定はハーネス側で実装＝**別リポのエンジン本体は不変**）。`/tmp/poc/survey/`＝派生技棚卸し SELECT。**本体 DB 原本・両リポのソースは 1 バイトも変更していない**。

---

## R-A. golden-case 実フレーム値の再出力（机上計算の土台検証）

### 実態（seed DB SELECT の実値）

| # | キャラ | KA | filler（code, total） | target（code, startup, active） |
|---|--------|----|----------------------|--------------------------------|
| GC-1 | リュウ | 40 | `standing_light_kick`, 18 | `collarbone_breaker`, su20, act4 |
| GC-2 | ケン | 43 | `quick_dash`, 45 | `thunder_kick`, su29, act3 |
| GC-3 | ジュリ | 27 | `standing_medium_punch`, 21 | `throw_forward`, su5, act3 |
| GC-4 | テリー | 27 | `crouching_light_kick`, 17 | `standing_medium_kick`, su9, act3 |
| GC-5 | ガイル | 34 | `knee_bazooka`, 27 | `standing_medium_punch`, su7, act3 |

（GC-4「中K」は alias `立ち中K` → `standing_medium_kick` で解決。GC-2「奮迅脚」→ `quick_dash`、「紫電カカト落とし」→ `thunder_kick`。）

### S / N / 着弾 の計算と申告 N との一致（R-A-2）

| # | KA | S=Σtotal+startup | N=KA+2−S | 着弾=S+N−1 | 着弾==KA+1 | 申告 N | N 一致 | 現行 S==KA | 窓 1≤N≤active |
|---|----|------------------|----------|-----------|-----------|--------|--------|-----------|---------------|
| GC-1 | 40 | 38 | 4 | 41 | ✓ | 4 | ✓ | ✗ | ✓ |
| GC-2 | 43 | 74 | −29 | (44) | (✓ 恒等) | 3 | ✗ | ✗ | ✗ |
| GC-3 | 27 | 26 | 3 | 28 | ✓ | 3 | ✓ | ✗ | ✓ |
| GC-4 | 27 | 26 | 3 | 28 | ✓ | 3 | ✓ | ✗ | ✓ |
| GC-5 | 34 | 34 | 2 | 35 | ✓ | 2 | ✓ | ✓ | ✓ |

### §4 期待値との一致／不一致
- **完全一致**。§4 の S（38/74/26/26/34）・N（4/−/3/3/2）・着弾（41/−/28/28/35）・現行 `S==KA`（✗✗✗✗✓）・窓 N_min=1（✓✗✓✓✓）はすべて実測と一致。
- **事実の注記（想定外ではないが重要）**: 着弾 `= S+N−1 = S+(KA+2−S)−1 = KA+1` は N の定義から**恒等的に KA+1**。したがって「着弾==KA+1」は判定に使えない（GC-2 も式上は 44 と出る）。**実ゲートは `1 ≤ N ≤ active`**（GC-2 は N=−29 でここに落ちる）。

---

## R-B. 窓方式の実測追試

窓条件をハーネス側に実装（`S∈[KA+2−active, KA+2−N_min]` の各 S でエンジン `Suggest(knockdownAdvantage=S, moves, target(startup), DefaultOptions)` を呼び、成立時 `N=KA+2−S`）。エンジン本体は不変。

### R-B-1（N_min=1・品質評価はこの値で）

| # | 期待レシピ | hit（N_min=1） | 成立 N | 窓内提案総数 |
|---|-----------|----------------|--------|--------------|
| GC-1 | `standing_light_kick(18) > collarbone_breaker(su20)` | **✓ hit** | 4 | 1 |
| GC-2 | `quick_dash(45) > thunder_kick(su29)` | **✗ miss** | − | 2（別レシピ） |
| GC-3 | `standing_medium_punch(21) > throw_forward(su5)` | **✓ hit** | 3 | 6 |
| GC-4 | `crouching_light_kick(17) > standing_medium_kick(su9)` | **✓ hit** | 3 | 2 |
| GC-5 | `knee_bazooka(27) > standing_medium_punch(su7)` | **✓ hit** | 2 | 7 |

- **再現率（N_min=1）＝ 4/5**。GC-2 のみ miss（S=74 が窓外＝N が負＝派生技二重計上に起因）。
- **§4 期待値（窓 N_min=1: ✓✗✓✓✓）と完全一致**。

### R-B-2（N_min=3・除外ケースの実値提示）

| # | hit（N_min=3） | 窓内提案総数 | 備考 |
|---|----------------|--------------|------|
| GC-1 | ✓（N=4≥3） | 1 | |
| GC-2 | ✗ | 1 | 元々窓外 |
| GC-3 | ✓（N=3） | 4 | |
| GC-4 | ✓（N=3） | 1 | |
| GC-5 | **✗（N=2<3 で除外）** | 2 | **仕様どおりの絞り込み・不具合ではない** |

- N_min=3 は GC-5（N=2）を**設定どおり除外**。GC-1/3/4 は N≥3 で残る。**品質評価は N_min=1 の 4/5 が正**（N_min はユーザーの絞り込み設定）。

### R-B-3（候補数の増加・現行 S==KA vs 窓 N_min=1）

| # | 現行 S==KA 提案数 | 窓 N_min=1 提案数 | 窓幅=active |
|---|-------------------|--------------------|-------------|
| GC-1 | 0 | 1 | 4 |
| GC-2 | 1 | 2 | 3 |
| GC-3 | 1 | 6 | 3 |
| GC-4 | 1 | 2 | 3 |
| GC-5 | 1 | 7 | 3 |

- 窓化で候補は増える（窓幅＝active 段ぶん S をスキャンするため）。実行時間はいずれも sub-ms（数百 µs 台）で、性能上の懸念は現データ規模では小さい（RESEARCH-01 D-5 と整合）。

### §4 期待値との一致
- R-B-1/R-B-2 とも §4 の窓列と一致。**机上計算は正しく、実測がそれを裏付けた**（迎合ではなく独立実測での一致）。

---

## R-C. 派生技の現況棚卸し（設計チャットへの主要入力）

### R-C-1 `is_derived` の実 DDL・意味
- **実態**: `ALTER TABLE moves ADD COLUMN is_derived INTEGER NOT NULL DEFAULT 0`（マイグレ 000032）。**フラグのみ（0/1）・親技への参照は保持しない**。DES-003 §3.3 L275: 役割は「段階2 のコマンド入力解決の索引から除外すること」のみ。判定原理＝「コントローラでこの技だけをいきなり出せるか？ 出せない → true」。判定源は入力ツール側の人手付与（本体は CSV 値を信頼・導出しない）。**model の `Move` 構造体には持たせていない＝`GET /api/moves` に出ない**（提案 UI で使うなら model/DTO/SELECT 同期追加が要る）。
- **含意**: `is_derived` は「派生である」ことは示すが「何から派生するか（親）」「派生時 startup か」を一切持たない。

### R-C-2 親子関係を保持する仕組みの全数調査
- **実態**:
  - `moves.original_move_id INTEGER REFERENCES moves(id)` … **ラッシュ版のみ参照**（通常技・システム技では NULL。DES-003 L267）。実 seed でも `rush_*`（category=`rush_variant`）のみ `original_move_id` が非 NULL（例: `rush_crouching_heavy_kick` orig=797）。
  - `moves` のその他の列に親参照は**なし**（追加列 is_aerial/setup_only/is_derived はいずれもフラグ）。
  - `combo_steps` / `setup_steps` … `move_id` 単一・`UNIQUE(combo_id/setup_id, step_order)`＝**1 ステップ 1 move**。親＞子は「連続する 2 ステップ（各々別 move 行）」で表現するしかなく、1 ステップ内に親子を入れ子で持てない。
  - 派生技専用の関連テーブルは**不在**。
- **含意**: 汎用の派生技親子リンクは現行スキーマに**不在**。ラッシュ版だけが `original_move_id` で親を辿れる例外。

### R-C-3 seed 内の派生技件数（キャラ別）
- **実態**: `is_derived=1` は総計 **304 件**。
  | キャラ | 件数 | キャラ | 件数 |
  |--------|------|--------|------|
  | mai | 46 | lily | 32 |
  | guile | 40 | ryu | 28 |
  | kimberly | 40 | juri | 25 |
  | ken | 30 | terry | 22 |
  | | | zangief | 21 |
  | | | ingrid | 20 |
- （frame stub の c_viper/dhalsim は該当 0＝seed 未整備。）

### R-C-4 ケン「紫電カカト落とし」の startup 実値と provenance
- **実態**: `thunder_kick`＝`category=unique`・`startup=29`・`active=3`・`total=51`・`is_derived=1`・`is_aerial=0`・`original_move_id=NULL`・`raw_data=空`。関連する `quick_dash`（奮迅脚）＝`category=unique`・`startup=1`・`total=45`・`is_derived=0`・`original_move_id=NULL`。
- **判別可否**: **判別不能**。`is_derived=1` は「単体で出せない派生技」であることを示すが、**startup=29 が単体公式値か派生時実測値か（奮迅脚の run 分 45 を二重に含むか）を記録するフィールドは存在しない**（`original_move_id` は NULL・`raw_data` 空・専用列なし）。推測はしない。
- **含意**: 窓方式で GC-2 が miss（S=74）となる原因は、エンジンが `quick_dash(total45)` を filler、`thunder_kick(su29)` を target として**別個に合算**する構造にあるが、`thunder_kick` が `is_derived=1`（単体不可）である以上「filler+target の合算」自体がドメイン上不整合になり得る。これは「親子リンク不在＋派生値 provenance 未記録」という横断課題。

### R-C-5 派生元が複数ある技
- **実態**: **存在する**。ケン `kasai_thrust_kick`（火傘蹴り）が親違いで別 move 行として 2 件:
  - `kasai_thrust_kick_during_od_gorai_axe_kick`（category=special・**startup=11**）
  - `kasai_thrust_kick_during_od_senka_snap_kick`（category=special・**startup=15**）
  同様に `quick_dash_dragonlash_kick` / `quick_dash_shoryuken` / `quick_dash_tatsumaki_senpu_kyaku`（奮迅脚派生）等、**親コンテキストを code 名の接尾辞に埋め込んだ独立 move 行**で格納。OD 差は `_od` 接尾（`gorai_axe_kick` / `gorai_axe_kick_od` 等）。
- **格納形**: relational な親子リンクではなく、**公式記法（機械変換 code）の文字列**で親を表現。同一基底技でも親ごとに **startup 実値が異なる**（11 vs 15）。
- **含意**: 「複数親を持つ派生技」は seed 実在。現状は「親ごとに別 code・別 startup の独立行」で表現されており、基底技と親の関係を機械的に辿る手段はない（code 文字列パースを除く）。

---

## R-D. 「単体発生でない値を格納している技」の棚卸し

### R-D-1 startup が単体発生でない可能性のある技種別
- **実態（category 分布・startup 非 NULL 数）**:
  | category | 件数 | startup 非 NULL |
  |----------|------|------------------|
  | normal | 184 | 184 |
  | special | 296 | 296 |
  | unique | 47 | 47 |
  | rush_variant | 156 | 156 |
  | target_combo | 39 | 37 |
  | super_art | 56 | 56 |
  | throw | 28 | 28 |
  | critical_art | 10 | 10 |
  | drive_impact | 10 | 10 |
  | system | 118 | 10 |
  - `rush_variant`=156（すべてドライブラッシュ状態から出る＝startup は DR 経由の値）、`is_aerial=1`=70（空中技）、`is_derived=1`=304（派生・親コンテキスト値を含み得る）。
  - `system`（移動・dash/jump 等）は startup ほぼ NULL（10/118）＝発生値を持たない。
- **判別材料（事実）**: 「単体発生でない可能性」は (a) `category='rush_variant'`（DR 前提）、(b) `is_aerial=1`（空中＝計測基準点が地上技と異なり得る・R-D-2）、(c) `is_derived=1`（親コンテキスト値）、(d) code 名の接尾辞（`_during_od_*`・`quick_dash_*`・`rush_*`・`_od`）で識別できる。ただし**「格納値が派生時か単体か」を明示するフラグ／列は存在しない**（R-C-4 と同型）。

### R-D-2 空中技の startup 計測基準点
- **実態**: DES-003 §3.3 `is_aerial`＝「ジャンプ攻撃・空中技は true」。取込は公式名に「ジャンプ／（ジャンプ中に）」を含む技を true 化。DES-004 §2.1＝`jumping_<強度>_<ボタン>`。**startup を「ジャンプ入力から数えるか／技入力から数えるか」を規定・記録するフィールドや注記は seed・DES-003・DES-004 のいずれにも見当たらない**。
- **判別可否**: **判別不能**（推測しない）。→ 開発者への確認事項 2。

---

## R-E. 表記・格納の現況

### R-E-1 DES-004 の親＞子 派生技表記規定
- **実態**: DES-004 §2.1 に**部分的な規定のみ**:
  - ラッシュ版技＝`rush_<元技code>`（例 `rush_standing_medium_punch`）＋`original_move_id` で元技参照（§2.1・L82/L111）。
  - 「派生の区別」＝SA レベル違い等は `_lv1`/`_lv2` 接尾辞（L89）。
  - ジャンプ攻撃＝`jumping_<強度>_<ボタン>`（L73）。
- **汎用の「親＞子」派生技（例: `quick_dash_shoryuken`・`kasai_thrust_kick_during_od_*`）を relational に表す表記規定は不在**。これらは seedgen／入力ツールが機械変換した code 文字列として存在するのみで、DES-004 に正式な親子表記規則としての記述はない。

### R-E-2 phase3-overview §M16 ④'（確定済み内容）
- **実態**: phase3-overview v1.1.1 で **M16 ④'＝`target_combo`（多段特殊技）区分の正典化**を記録（開発者承認 2026-07-03、CHANGE-065）。確定内容:
  - target_combo 区分は**入力支援ツールで熟練入力者が人手で付与する分類**。
  - 本体は取込値を信頼し**自動判定・アルゴリズム分類をしない**。
  - 公式取込では多段特殊技を `special`／所属セグメントとして扱う。
  - 誤分類は非致命（ユーザー指摘→本体編集/再取込で是正）。**本体コード変更ゼロ・doc 限定・実装非依存**。
  - 併せて M16 ④''＝dash の move/modifier 二重表現を system move へ一本化（canonical=system move）。
- **含意（設計チャット再発明防止）**: 「派生技・多段技の分類は人手付与・本体は信頼のみ・機械判定しない」は**既定の方針**。フレーム意味論・派生技モデル設計はこの前提上で組む。

### R-E-3 combo_steps / setup_steps の格納粒度
- **実態**: 両テーブルとも `move_id` 単一・`UNIQUE(親id, step_order)`＝**1 ステップ 1 move**。親＞子は**別々の 2 ステップ**（各々独立 move 行）で並べる形。1 ステップ内に親子をネストする構造は**不在**。`combo_steps` は `move_id` NULL の非技ステップ（`modifiers.type`＝`parry_drive_rush`/`cancel_drive_rush` のみ）も持つ。
- **含意**: レシピ上、派生技は「独立 move 行を順に並べる」前提。二重計上問題は「並べた各 move の frame をどう合算するか」の意味論の問題であり、格納構造の問題ではない。

---

## R-F. `N_min` の機械判定可能性

### R-F-1 「ヒット時有利フレーム」列の有無
- **実態**: `hit_advantage` という名称の列は**存在しない**。相当する列は `moves.on_hit`（硬直差ヒット・符号付き・DES-003 L272）。**充足率＝370/944（≈39%）**（参考: `startup` 非 NULL は 834/944）。
- **含意**: ヒット有利フレームの素材は一部あるが半数超が NULL。

### R-F-2 N_min の機械導出可能性
- **実態（事実評価）**: 「持続何フレーム目以降ならコンボになるか（＝N_min）」を機械導出するには、少なくとも次が要る:
  1. target（当てたい技）の**各 active フレームごとの有利フレーム**（SF6 では後 active 目ほど有利フレームが増える）。→ seed は**単一の `on_hit` のみ**で per-active-frame の値を持たない。
  2. `on_hit` が**どの active フレームで計測された値か**（第1 active か meaty 深めか）の記録。→ **不在**。
  3. 後続技（コンボの次の技）の `startup` と比較する仕組み。→ `startup` はあるが、上記 1/2 が無いと「N フレーム目重ねなら繋がる」を判定できない。
- **足りない要素（列挙）**: (a) per-active-frame 有利フレーム、(b) `on_hit` の計測基準 active フレーム、(c) `on_hit` の充足率（現 39%）。
- **含意**: 現データでは **N_min の機械判定は成立しない**（ユーザー指定の絞り込み設定として持つのが現実的、という事実のみ提示。設計判断は開発者/設計チャット）。

---

## フレーム意味論・派生技モデル 設計担当への引き渡し事実

1. **窓方式は実測で妥当**（N_min=1 で GC 4/5 成立・§4 机上計算と完全一致）。判定の実ゲートは `1 ≤ N ≤ target.active`（`N=KA+2−S`、`S=Σfiller.total+target.startup`）。着弾=KA+1 は恒等式なので判定に使わない。
2. **GC-2 の miss は窓方式の失敗ではなく、派生技のフレーム二重計上**（`quick_dash` total45 を filler にしつつ `thunder_kick` su29 を target に合算＝S=74）。`thunder_kick` は `is_derived=1`（単体不可）。
3. **現行スキーマに汎用の派生技親子リンクは不在**。親参照は `moves.original_move_id`（**ラッシュ版のみ**）だけ。`is_derived` はフラグのみ・親を持たない。`combo_steps`/`setup_steps` は 1 ステップ 1 move。
4. **派生技は親を code 文字列に埋め込んだ独立 move 行で格納**。複数親は「親ごとに別 code・別 startup の別行」で実在（ケン `kasai_thrust_kick_during_od_gorai_axe_kick` su11 / `..._senka_snap_kick` su15）。relational に辿る手段は無い。
5. **派生技 startup の provenance（単体公式値か派生時実測値か）を記録するフィールドは存在しない**（`thunder_kick` su29 の由来は判別不能）。二重計上是正には、この provenance か「親を消費済みとして filler から差し引く」情報が要る（設計課題）。
6. **DES-004 の派生技表記規定は部分的**（rush=`rush_`+`original_move_id`、SA レベル=`_lv` 接尾のみ）。汎用の親＞子表記規定は不在。
7. **多段/派生の分類方針は M16 ④'（CHANGE-065）で確定済み**＝人手付与・本体は取込値信頼・機械判定しない。設計はこの前提上で。
8. **N_min の機械判定は現データでは不可**（per-active-frame 有利フレーム不在・`on_hit` 充足 39%・計測基準 active 不明）。ユーザー指定の絞り込み設定として扱うのが現実的（事実提示のみ）。
9. **`is_derived` は `GET /api/moves` に出ない**（model.Move 非搭載）。提案 UI/グルーで使うなら model/DTO/SELECT 同期追加が要る。

---

## 完了条件チェック（指示書 §6）
- [x] R-A〜R-F を実値で報告。確認不能（R-C-4 provenance・R-D-2 計測基準点）は「判別不能」と明記。
- [x] R-B を **N_min=1 と N_min=3 の両方**で実測（hit/miss と N を実値表で）。
- [x] R-C で `is_derived` の実 DDL（フラグのみ・親参照なし）と親子関係保持の有無（`original_move_id` はラッシュのみ）を事実確定。
- [x] R-C-4／R-D-2 の判別不能を推測せず「判別不能」と明記。
- [x] read-only を逸脱していない（両リポのソース・マイグレ・seed・DES/REQ・DB 原本が不変。ハーネスは `/tmp` 使い捨て）。
- [x] 採番していない。

*以上、M19-RESEARCH-02 調査報告。judgement-free（窓方式の採否・二重計上是正方式・派生技モデルは開発者/設計チャット判定）。§4 机上計算との一致は独立実測で確認（§0.4）。*
