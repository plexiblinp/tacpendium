# 指示書 M15-03: 入力方式ボタン化（FB④）＋コマンド入力解決 段階1＋直接指定 UI＋修飾フラグ

| 項目 | 内容 |
|------|------|
| 指示書ID | M15-03 |
| バージョン | 1.1.0 |
| 推奨モデル | **Sonnet 4.6 基本／着手時 Plan Mode で Opus 4.8 格上げを判断（スコープ拡大で Opus 有力）**（model-allocation v1.26.0 M15-03・§7） |
| Plan Mode | **必須**（§3.3。段階1 決定論は新規・現行入力機構/プルダウン残置は実査で確定。#1〜#7） |
| 機械レビュー | 必須（別チェックリスト: `M15-03-review-checklist.md` v1.1.0） |
| 並列性 | M15-02 後（レシピ入力領域を共有・info-mark 機構を新 UI の説明に活用可）。M14 と並行可 |
| 依存 | M15-01（`combo-editor-*` test-id 規約）／M15-02（info-mark 機構）。friend FB④／command-resolution-request §1-1〜§1-3。**seed は現行 HEAD（ryu 中心）で検証可・全キャラ別技面は M14-03b 後** |
| 想定所要時間 | 300〜480 分（段階1／ボタン化＋プルダウン残置／直接指定＋OD／modifier flags／recipe-* test-id／テスト）。**規模超過時は M15-03a/b 分割を Plan Mode で提案（開発者事前承認済み）** |
| 作成者・作成日 | 設計担当 Claude（フェーズ3 継続担当・M15 期）/ 2026-07-03 |

## 更新履歴

| 版 | 更新日 | 更新内容 |
|----|--------|----------|
| 1.0.0 | 2026-07-03 | 初版。段階1＋入力方式ボタン化＋必殺技直接指定 UI 骨格。 |
| 1.1.0 | 2026-07-03 | プロトタイプ v1〜v3 の開発者フィードバック確定を反映。**(1) §4.2 是正＝「プルダウン廃止」→「ボタン速い経路を足し、既存プルダウンを網羅フォールバックとして残置＋区分絞り込み」**（FB④ の本質＝置換でなく併存）。**(2)** カテゴリタブ（ラッシュ畳み込みで削減）・ラッシュ版トグル（単発技のみ）・必殺技＝ファミリー＋弱中強＋**OD 4 種フラット**を §4.3 に確定。**(3) §4.4 新設＝modifier flags**（OD 3 種＋一段目キャンセル＋垂直/前ジャンプ中）を `ModifiersEditor` に小追加。**(4)** 別技扱い変種のボタン面は **M14-03b 後・データ駆動フォローアップ**へ（別技命名は既存＝新設不要）。target_combo は M16。CHANGE-057 の束ね範囲を明記。 |

---

## 1. 背景と目的

### 1.1 背景

- friend FB④（followup-backlog §A・M15-overview §46）で「**プルダウン中心の入力が不便・ボタン等にしてほしい**」との指摘。発信者中心への舵切り（phase3-overview §1）で入力の自然さ・速さは魅力に直結するため、入力を軽くする。
- **FB④ の本質（開発者確定・重要）**: プルダウンを**廃止するのではなく**、頻出入力に**ボタンの速い経路を足し**、キャラ固有の別技（ホールド／Lv／ジャスト等）の網羅入力には**既存プルダウンを残置（＋区分で絞り込んで数を減らす）**。ボタン面＝速い共通入力、プルダウン＝網羅フォールバックの**併存**。
- あわせて `combmgr-command-resolution-request.md` の **段階1** を載せる（phase3-overview v1.1.0 §2.3 で M15 配置確定・承認済み 2026-07-02）。
- **死守契約 3 点（§1-1・全 UI/全段階で不変）**:
  1. **公式表記のみ解決**（汚い入力・簡易入力を認識しない＝「クリーンな入力状態を `move_code` に引く決定論ルックアップ」。入力エンジン再実装に踏み込まない）。
  2. **モーション解析はしない**（決定論ルックアップに徹する。仮想で 236 等を実演させない）。
  3. **出口は必ずキャラ別 `move_code`**（実装上はステップ確定＝当該キャラ `moves` から `move_code` 一致で解決した `moveId`＝`StepRequest.moveId`。code-facts §Model `ComboStep.MoveID`）。
- **本サブは非スキーマ**（追加列・新規テーブルなし・M16 非依存）。段階1 は `move_code` 構造から引き当てるだけで追加データ不要・**command 非依存**（段階2〔M17〕の話。M14-01 で `raw_data.command` 除去済み＝phase3-overview §2.3 G-k）。modifier flags は既存 `modifiers`（JSON・`Flags []string`/`Notes string`）に載る非スキーマ。
- **入力の実体**（code-facts §1・DES-005 §5.7/§6）: レシピ入力領域＝`RecipeBuilder`（Props `characterId`/`steps`/`moves`/`movesLoading`/`onChange`）・`SetupRecipeEditor`。技入力導線に `VirtualController`（`onStepAdd`）、ステップ表示に `StepRow`、修飾編集に `ModifiersEditor`（Props `open`/`step`/`stepIndex`/`movesById`/`onSave`/`onOpenChange`）。**現行プルダウンの実在箇所・現行入力機構は Props に現れず＝§3.3-1 で実査特定**。

### 1.2 目的

完了時に達成される状態:

- **通常技入力がボタン化**され、**段階1**（方向ゾーン〔ニュートラル／下／上〕×ボタン → `standing_/crouching_/jumping_<強度>_<ボタン>` を決定論引き当て → `moveId` 確定）が効く。
- **カテゴリタブ**（通常技・特殊技・投げ・必殺技・SA・システム・ドライブインパクト。ラッシュはトグルへ畳み込み）で入力面が切り替わる。
- **特殊技＝ワンプッシュ直接指定**、**必殺技＝ファミリー＋弱/中/強＋OD 4 種フラット**（OD 変種の非プレーンは `modifiers.flags`）。SA／システム／DI は直接指定。**モーション実演なし**。
- **ラッシュ版トグル**（通常技・特殊技の単発技のみ・空中技除外）で `rush_<元技>` に。
- **既存プルダウンを「全技から選ぶ」フォールバックとして残置**し、**区分（カテゴリ）で絞り込んで表示数を削減**。別技（ホールド／Lv／ジャスト等）はここで網羅入力＝取りこぼしなし。
- **modifier flags**（OD 組・一段目キャンセル・垂直/前ジャンプ中）が `ModifiersEditor` で付与できる。
- レシピ系 E2E の前提となる `recipe-*` 系 test-id が（本サブが触れる範囲で）付与される。既存 E2E 非回帰。

### 1.3 このマイルストーンで作らないもの（スコープ外・確定）

- **別技扱い変種をボタンで速く出す面**（キャラ別に有効な hold/Lv/just だけをボタン表示）＝ **M14-03b（全キャラ seed）後のデータ駆動フォローアップ**（followup-backlog 記録）。本サブでは**プルダウンで網羅入力**するため取りこぼしなし。**別技の命名基準は既存**（DES-004 §2.1・seed）＝新設不要。
- **target_combo（多段特殊技）の区分**＝ **M16**（§6 データの根・phase3-overview 記録）。本サブでは従来どおり normal/unique として扱う。
- **段階2（単方向＋ボタンの特殊技のコマンド解決）＝ M17**（`moves.command` ルックアップ・取込ヘルパーとエンジン共通化・索引元 command 再確立 G-k）。特殊技のワンプッシュ直接指定は段階2 とは別レイヤ（後付けしても土台として残る）。
- **物理コントローラ実モーション入力＝ M21**（FR105〜108。仮想側は常に直接指定）。
- **M16 依存の表記ラベル**（技/非技⑥・ドライブ/SA 始動明示⑨⑪⑬）＝ M15-07。**表記プリセット連動の表示**（プリセット→`official_ja_move` フォールバック）＝軽い後続サブ。
- **タグ色**（M15-04）／**表示整理・比較 ID バグ**（M15-05）／**オンボーディング・上級者モード**（M15-06）。
- データ/API 契約・スキーマの変更（段階1・modifier flags はいずれも非スキーマ）。moves 取込（削除済み）。i18n は ja/en 両ロケール必須（playbook §4.13）。

---

## 2. 成果物

### 2.1 作成/修正するファイル（想定パス。実配置は既存構成 code-facts §1 に合わせる）

| ファイル | 内容 |
|---|---|
| 段階1 引き当ての純関数（`web/src/features/combo/` 配下） | 方向ゾーン×ボタン → `move_code` variant → 当該キャラ move への決定論引き当て（§4.1）。副作用なしのテスタブルな純関数 |
| 入力方式のボタン UI（現行入力機構＝§3.3-1 で特定・`RecipeBuilder`／`VirtualController` 周辺） | カテゴリタブ＋通常技段階1＋直接指定（特殊技/必殺技/SA/システム/DI）＋ラッシュトグル（§4.2/§4.3）。**ISSUE-002（modifier 専用ボタン）整合** |
| 既存プルダウンの残置＋区分絞り込み（現行プルダウン＝§3.3-2 で特定） | 「全技から選ぶ」網羅フォールバック。カテゴリ選択で表示数を削減（§4.2） |
| `ModifiersEditor`（`web/src/features/combo/components/ModifiersEditor.tsx`）＋ modifier flag 定義 | OD 組（`od_lm`/`od_mh`/`od_lh`）・`first_hit_cancel`・`neutral_jump`・`forward_jump` を **`modifiers.flags` 列挙**に追加（§4.4）。flag マスタは固定選択式（DES-004 §2.3・自由入力不可） |
| `recipe-*` 系 test-id（本サブが触れる move 選択／入力ボタン／StepRow 範囲に限定） | レシピ系 E2E の前提（§4.5）。既存 `combo-editor-*` と同系統・別 topic。命名は**既存 test-id 規約を grep 実値確定してから採用**（digest §4 M15-1） |
| テスト（Vitest 純関数＝段階1／Vitest コンポーネント＝入力 UI・modifier flags／E2E＝入力→ステップ確定） | §5 |

### 2.2 変更しないもの（原則）

- データ/API 契約（`ComboResponse`/`CreateRequest`/`StepRequest`/`StepResponse`＝code-facts §DTO）。段階1 は既存 `StepRequest.moveId`、modifier flags は既存 `modifiers`（JSON）に載る（**新規フィールド・エンドポイント・列不要**）。
- スキーマ（`combo_steps`/`moves`/`modifiers TEXT`）。
- 既存の始動技自動推定（読み取り専用）・重複判定（VAL-C02）・M15-01 `combo-editor-*`／M15-02 `info-mark-*` test-id。
- **別技の move_code 命名**（既存・DES-004 §2.1）。target_combo 分類（M16）。

### 2.3 例外条項

- 既存に方向入力・ボタン入力・move 選択・**プルダウン**の UI があれば**流用/拡張**（自作再発明しない＝playbook §4.6・§4.9 の 3 点セット確認）。§3.3-1/§3.3-2 で実査。
- test-id・i18n・flag の命名は**既存規約の実値を grep 確定後**に決める（digest §4 M15-1／M11-4）。

---

## 3. 前提条件

### 3.1 必読ドキュメント

> 文書ID ⇄ 実パスの正は `docs/handover/docs-map.md`（自動生成）。記憶で書かない（digest §0）。

- **command-resolution-request**（開発者手交）§1-1（死守契約）・§1-2（段階1）・§1-3（必殺技直接指定）・§2/§3。
- **DES-004** §2.1（`move_code` 正典＝`standing_/crouching_/jumping_<強度>_<ボタン>`・移動のみジャンプは別系統・必殺技 `<技名>_<強度>`・ラッシュ `rush_<元技>`・SA/CA）・**§2.3（modifier flags/type）**・§3.2（表記資産）。改訂は設計担当 CHANGE・製造は直接編集しない。
- **DES-003** §3.3（category enum＝`normal/special/unique/super_art/critical_art/throw/system/target_combo/rush_variant/drive_impact`・**modifiers 構造＝`flags`/`notes`・JSON**・ラッシュ可否＝`category∈{normal,unique}∧is_aerial=false`）。
- **DES-005** §5.7（レシピ入力領域）・§6（仮想コントローラ）。
- **code-facts** §1（`RecipeBuilder`/`VirtualController`/`StepRow`/`ModifiersEditor` Props）・§Model/§DTO（`Move`/`ComboStep`/`Modifiers`/`StepRequest`）。
- **M15-overview** §3 M15-03・§4.7.1（`combo-editor-*`）。**phase3-overview** §2.3/§M15。
- **retrospective-digest** §1（真因のレイヤ）・§3（固定前提の動的化監査）・§4（命名の実値確定・E2E 実装非依存）・§6（CHANGE 規律）。**architecture-patterns** §10（LAN/モバイル＝タップ）。

### 3.2 参照不要

- moves 取込（削除済み）／段階2・command（M17）／物理（M21）／M16 データモデル（target_combo・別技命名新設）／確定反撃（M18）／英語ロケール文言品質。

### 3.3 着手前の確認（Plan Mode 必須・§9.4 と対応）

推測で進めない・現状を決め打ちしない（digest §1/§4）:

1. **現行入力機構と段階1/ボタン化の接続点**: `RecipeBuilder`／`VirtualController` の現行 move 選択・方向入力を grep 全数特定。段階1（方向ゾーン×ボタン）とボタン化をどの層に接続するか・方向ゾーンの入力源を確定。
2. **現行プルダウンの実在と残置方針**: **「プルダウンを廃止しない・網羅フォールバックとして残す」**前提で、現行プルダウンの場所・全技列挙の仕組みを実査。**区分（カテゴリ）絞り込み**をどう足すか確定（DES-005 §5.7 変更の範囲）。
3. **`move_code` 正典の充足**: 段階1 は消費側 `moves` seed の `move_code` が §2.1 正典形で揃うことに依存。**現行 HEAD（ryu 中心・M14-03b 保留）で段階1 が引けるか**を実査。引けない variant のフォールバック（§4.1）も確定。
4. **必殺技直接指定・OD 4 種フラットの UI**: ファミリー＋弱/中/強＋OD/弱中OD/中強OD/弱強OD の配置。存在する強度のみ活性（move データ駆動）。死守＝236 実演なし。
5. **modifier flags の付与経路**: OD 組・一段目キャンセル・垂直/前ジャンプ中を **`ModifiersEditor`** の固定選択式に追加（DES-004 §2.3・自由入力不可）。既存 flag マスタの実値を grep 確定してから列挙値を足す（digest §4）。
6. **`recipe-*` test-id の命名規約と付与範囲**: 既存 `combo-editor-*` を grep 実値確定→ `recipe-*` を同系統で採用。範囲は本サブが触れる move 選択／入力ボタン／StepRow に限定（フル sweep しない・playbook §4.12）。
7. **DES CHANGE 要否**: 段階1（DES-004 §2.1）／modifier flags（DES-004 §2.3 or DES-003 §3.3）／カテゴリタブ・プルダウン区分絞り込み（DES-005 §5.7）を **CHANGE-057 に 1 件束ね**要否を着手時 view で判定。要すれば設計担当が起票（製造は DES 直接編集しない）。**別技命名は既存のため CHANGE 対象外**（DES-004 §2.1 に hold/just 記載が無ければ軽微 errata 候補として別途拾う）。

> **規模判断**: §3.3 実査でスコープが想定超（例＝現行入力機構の作り替えが大）なら、**M15-03a（入力方式ボタン化＋段階1＋直接指定＋プルダウン残置）/ M15-03b（modifier flags）** への分割を Plan Mode で提案（開発者事前承認済み・playbook §4.12）。

---

## 4. 詳細仕様

### 4.1 コマンド入力解決 段階1（決定論引き当て・純関数）

**入力**: ボタン（強度 `light/medium/heavy` × `punch/kick`）＋方向ゾーン（ニュートラル／下／上）＋当該キャラの `moves: Move[]`。

**引き当て規則（決定論・DES-004 §2.1）**:

| 方向ゾーン | variant | 例 |
|---|---|---|
| ニュートラル | `standing_<強度>_<ボタン>` | `standing_medium_punch` |
| 下 | `crouching_<強度>_<ボタン>` | `crouching_light_kick` |
| 上（ジャンプ） | `jumping_<強度>_<ボタン>` | `jumping_heavy_punch` |

- 生成 `move_code` を当該キャラ `moves` から一致検索し `moveId` を確定（出口＝`move_code`／`StepRequest.moveId`）。
- **移動のみのジャンプ動作**（`jump_neutral` 等）は段階1 対象外（別系統 seed）。
- **未定義時のフォールバック**（該当 variant なし）は §3.3-3 で確定（暫定＝選択不可表示 or 既存 move 選択へ・request §2 の思想）。
- **純関数**（`moves` を引数に `moveId | null` を返す・副作用なし）。段階2（M17）で共通化しやすい形にするが**本サブは command 非依存の段階1 のみ**（過剰共通化しない＝YAGNI・digest §3）。

### 4.2 入力方式のボタン化＋既存プルダウン残置（FB④・重要）

- **ボタンの速い経路を足す**: カテゴリタブ（通常技・特殊技・投げ・必殺技・SA・システム・DI）で入力面を切替。通常技＝段階1（§4.1）。特殊技/SA/システム/DI＝直接指定。**variant 選択のプルダウンを段階1 で置き換える**が、これは**全技プルダウンの廃止ではない**。
- **既存プルダウンを残置＝網羅フォールバック**: 「全技から選ぶ」を残し、**区分（カテゴリ）で絞り込んで表示数を削減**（FB④「数を削る／区分で絞る」）。別技（ホールド/Lv/ジャスト等）は moves の別行なので**ここで網羅入力＝取りこぼしなし**。
- **ラッシュ版トグル**（通常技・特殊技）: ON で `rush_<元技>`（`category∈{normal,unique}∧is_aerial=false`＝**単発の非空中技のみ**・DES-004 §2.1/DES-003 §3.3）。通常技はジャンプ（空中）を無効化。多段（target combo）は M16 まで対象外。
- **ISSUE-002（modifier 専用ボタン）整合**・既存挙動（始動技自動推定・並び替え/削除・`ModifiersEditor`・info-mark）温存・モバイル/LAN タップ（arch §10）。説明が要る場合 M15-02 info-mark 機構に載せる。

### 4.3 直接指定 UI（特殊技・必殺技・SA・システム・DI）

- **特殊技**: ワンプッシュ直接指定（`unique` の move を選ぶ）。段階2（M17 コマンド解決）とは別レイヤ。
- **必殺技**: ファミリー（`hadoken` 等）を選び、**弱/中/強＋OD 4 種フラット**（OD/弱中OD/中強OD/弱強OD をドリルダウンなしで並べる）。弱/中/強 → `<技名>_<強度>`。OD 系 → `<技名>_od`（非プレーンは §4.4 の `modifiers.flags`）。**存在する強度のみ活性**（move データ駆動）。**236 等のモーションを実演させない**（死守2）。
- **SA/CA・システム・DI**: 直接指定（`sa1`/`ca`、`drive_parry`/`dash_*`/移動、`drive_impact`）。DI が単一技のため独立タブが過剰かは §3.3 で製造協議（システム/タブ外へ寄せる案）。

### 4.4 修飾フラグ（modifier flags・非スキーマ・ModifiersEditor 小追加）

- **既存 `modifiers.flags`**（`Flags []string`・JSON・固定選択式＝DES-004 §2.3/DES-003 §3.3）に**列挙値を追加**（列・テーブル変更なし）:
  - **OD 組**: `od_lm`（弱中）／`od_mh`（中強）／`od_lh`（弱強）。プレーン OD はフラグなし。必殺技 OD 4 種フラット（§4.3）から付与。
  - **一段目キャンセル**（通常技・modifier 扱い）: 例 `first_hit_cancel`。
  - **垂直ジャンプ中／前ジャンプ中**（必殺技・modifier 扱い）: 例 `neutral_jump`／`forward_jump`。
- 付与は **`ModifiersEditor`**（既存・ステップ単位の修飾編集）に固定選択式で足す。**flag マスタの実値を grep 確定してから列挙**（自由入力不可・命名衝突回避＝digest §4）。move_code は基底のまま（別技化しない）。

### 4.5 test-id（recipe-* 最小限・既存規約準拠）

- 既存 `combo-editor-*` を grep 実値確定 → `recipe-<field>`（仮）を同系統で採用（例の hardcode は §3.3-6 実値確認後）。付与範囲＝本サブが触れる move 選択／入力ボタン／StepRow に限定。命名規約・範囲を完了報告に明記。

---

## 5. テスト要件

### 5.1 必須テスト（Vitest / E2E）— ケース数で語る

- **段階1 引き当て（Vitest 純関数）**: 方向ゾーン×ボタン×強度の代表組で決定論引き当て。**未定義フォールバック・移動のみジャンプ非対象・汚い入力を解決しない**（死守1）を検証。`moves` 引数で self-contained。
- **入力 UI（Vitest コンポーネント）**: カテゴリ切替・通常技段階1・特殊技ワンプッシュ・必殺技ファミリー＋強度＋OD 4 種・ラッシュトグル（空中無効）・**236 実演 UI 不在**（死守2）・既存操作に副作用なし・`recipe-*` test-id 解決。
- **modifier flags（Vitest）**: OD 組・一段目キャンセル・垂直/前ジャンプ中が `modifiers.flags` に載る・`ModifiersEditor` で付与/解除・既存 flag と衝突しない。
- **プルダウン残置＋区分絞り込み（Vitest）**: 全技が出る・カテゴリ選択で件数が絞られる・別技（moves 別行）が選べる。
- **E2E（seed 非依存 self-contained）**: レシピ入力領域でボタン＋方向 → ステップ確定の代表フロー。**実装方式に依存しない記述**（digest §5 M5-2）。段階1 網羅は Vitest 純関数に寄せる。
- **既存 E2E 非回帰**: `make e2e` 全通過・**永続 dev DB 残渣非依存**（M14-6）。

---

## 6. レビュー観点（別ファイル参照）

機械レビューは `M15-03-review-checklist.md` v1.1.0 に従う。

---

## 7. 完了条件（Definition of Done）

### 7.1 機能要件
- 通常技がボタン化＋段階1 で `move_code`/`moveId` 決定論確定。カテゴリタブ・ラッシュトグル・直接指定（特殊技/必殺技 OD 4 種/SA/システム/DI）が機能。
- **既存プルダウンが残置され、区分絞り込みで表示数が減る**（別技の網羅入力可）。
- OD 組・一段目キャンセル・垂直/前ジャンプ中が `modifiers.flags` で付与できる。
- 非スキーマ（新規列/API/マイグレなし）。既存操作が非破壊。**236 実演なし**（死守）。

### 7.2〜7.3 自己テスト・品質
- §5.1 の Vitest/E2E 全通過（ケース数報告）。`make e2e` 通過・既存 spec 非回帰・契約/スキーマ差分なし。

### 7.4 ドキュメント
- **DES-004/005（・DES-003）CHANGE 要否（§3.3-7）の判定結果を完了報告に記載**。要なら設計担当が **CHANGE-057 に束ねて**起票（製造は DES 直接編集しない）。
- **`recipe-*` test-id・追加 modifier flags の命名規約を完了報告に明記**（後続参照・code-facts 非捕捉）。

### 7.5 完了報告
- Plan Mode 確定方式（現行入力機構・段階1 接続点・プルダウン残置/区分絞り込み・`move_code` 充足とフォールバック・必殺技/OD UI・modifier flag 付与経路・test-id・DES CHANGE 要否・分割有無）、変更点、段階1 テストケース数、既知の制約を報告。

---

## 8. 参照ドキュメント

| 文書（実パス） | 節 | 用途 |
|------|-----|------|
| command-resolution-request（開発者手交） | §1-1〜§1-3/§2/§3 | 死守契約・段階1・必殺技直接指定・委譲 |
| DES-004 `docs/design/04-notation-spec.md` | §2.1 / §2.3 / §3.2 | `move_code` 正典・modifier flags/type・表記資産 |
| DES-003 `docs/design/03-data-model.md` | §3.3 | category enum・modifiers（flags/notes）・ラッシュ可否 |
| DES-005 `docs/design/05-screen-design.md` | §5.7 / §6 | レシピ入力領域・仮想コントローラ |
| code-facts `docs/handover/code-facts.md` | §1 / §Model / §DTO | RecipeBuilder/VirtualController/StepRow/ModifiersEditor Props・Move/ComboStep/Modifiers/StepRequest |
| M15-overview / phase3-overview | §3 M15-03・§4.7.1 / §2.3・§M15 | 位置づけ・test-id 規約・配置境界 |
| retrospective-digest | §1/§3/§4/§6 | 真因のレイヤ・固定前提監査・命名実値確認・CHANGE 規律 |
| architecture-patterns | §10 | LAN/モバイル（タップ） |

---

## 9. 注意事項・判断に迷ったら

### 9.1 推測で進めてはいけない事項
- §3.3 #1〜#7（現行入力機構・プルダウン残置・`move_code` 充足・必殺技/OD UI・modifier flag 経路・test-id 実値・DES CHANGE 要否）: Plan Mode 確定前にコード化しない。
- 既存 API/データ契約・スキーマの変更: 不可（段階1・modifier flags は非スキーマ）。
- 死守契約 3 点: 緩めない（簡易入力・モーション認識・236 実演 UI は禁止）。
- **別技命名の新設**: しない（既存＝DES-004 §2.1/seed）。target_combo 分類は触らない（M16）。

### 9.2 推測で進めてよい事項（明示する）
- 段階1 純関数の内部実装・配置。必殺技/OD/ラッシュトグルのレイアウト詳細（死守・データ駆動活性を守る範囲）。プルダウン区分絞り込みの実装様式（既存 UI に沿う範囲）。

### 9.3 不明事項発見時
- §3.3 以外は Plan Mode 質問書（playbook §8.4）。command-resolution-request と現行 DES に矛盾があれば**現行 DES 優先**（reorg §2）。

### 9.4 Plan Mode で提示すべき項目
- §3.3 #1〜#7 全て。複雑度が想定超なら **Opus 4.8 格上げ**＋**M15-03a/b 分割**を判断（開発者事前承認済み）。

---

## 10. 完了後の次ステップ
- **別技ボタン面（データ駆動）**: 全キャラ seed（M14-03b）後に、キャラ別に有効な hold/Lv/just だけをボタン表示（既存命名使用・followup-backlog 記録）。
- **段階2（M17）**: 段階1 純関数の索引を取込ヘルパー表記解決（`236LP`→`hadoken_light`）と共通化（G-k）。
- **物理実モーション（M21）**。**表記プリセット連動**（軽い後続）。
- **target_combo 区分（M16）**。DES-004/005（・003）CHANGE-057（要の場合・設計担当起票）。model-allocation に M15-03 実績追記（着手時）。

---

## 11. 開発者への確認事項

> 本節に集約。各項目「何を・なぜ・暫定案」。

1. **規模拡大に伴う実装モデルと分割の扱い＝Plan Mode 判断でよいか**
   - 何を: スコープが v1.0.0 より拡大（段階1＋多面ボタン化＋プルダウン残置＋modifier flags）。実装モデルと M15-03a/b 分割。
   - なぜ: 段階1 は新規決定論（Opus 信号）＋多面 UI＋flag マスタで、自由改訂 Sonnet の範囲を超える公算。
   - 暫定案: **着手時 Plan Mode で Opus 4.8 格上げ・規模超過なら a/b 分割を判断**（開発者事前承認済み）。事前に Opus 固定/分割固定のご希望があれば合わせます。model-allocation は着手時に実績追記。

2. **CHANGE-057 の束ね範囲でよいか**
   - 何を: 段階1（DES-004 §2.1）＋modifier flags（DES-004 §2.3 or DES-003 §3.3）＋カテゴリタブ・プルダウン区分絞り込み（DES-005 §5.7）を 1 件束ね。別技命名は既存のため対象外。
   - なぜ: 複数小明確化は 1 件集約（digest §6 M13-4）・過剰起票回避。
   - 暫定案: 上記 3 領域を **CHANGE-057** に束ね、要否は着手時 view 確定。別技命名は DES-004 §2.1 に記載が無ければ軽微 errata 候補として別途拾う。

---

*以上、M15-03 製造指示書 v1.1.0。配置 `docs/instructions/phase3/M15-03-input-method-command-resolution-stage1.md`。段階1（非スキーマ・command 非依存）／入力方式ボタン化＋**既存プルダウン残置・区分絞り込み**（FB④＝置換でなく併存）／直接指定＋OD 4 種フラット／modifier flags（ModifiersEditor 小追加）。別技ボタン面は M14-03b 後・target_combo は M16。死守契約 3 点を死守。*
