# M15-03 レビュー報告書

対象: feature/m15-03（コミット 243b145「段階1純関数＋modifier flags＋VirtualController タブ式クイック入力」、131c1ab「プルダウン残置＋区分絞り込み＋テスト」）。基準: `docs/instructions/phase3/reviews/M15-03-review-checklist.md` v1.1.0。read-only レビュー（コード未変更）。

## 総評

死守契約 3 点（公式表記のみ解決／モーション解析なし／出口=`move_code`）を全て満たしており、最重要ゲートは通過している。FB④ の本質である「プルダウン廃止でなく残置＋区分絞り込み」も RecipeBuilder / SetupRecipeEditor 両面で正しく実装され、別技（例 `shoryuken_hold`）はプルダウンで取りこぼしなく入力できる。段階1 は純関数・非スキーマ・command 非依存で、DTO/型（`web/src/features/combo/types.ts`）に差分がなく契約は不変。既存 `VirtualController` を Props 互換のまま拡張（自作再発明なし）、`ModifiersEditor` の既存 flag マスタを踏襲して 6 値を追加、`recipe-*` test-id は recipe サブツリーに限定されておりフル sweep もない。重大（§9）はゼロ。持ち越し可の軽微指摘と、完了報告 in-repo 化（§7.5/§8）の欠落が中位で残る。

## 設計準拠性レビュー結果

### §1.1 死守契約 3 点 … ◎
- **公式表記のみ解決**: `inputResolution.ts` は `zone×strength×button` から `standing_/crouching_/jumping_<強度>_<ボタン>` を合成するのみで、文字列コマンドを受ける経路が存在しない（`inputResolution.ts:20-47`）。検証あり（`inputResolution.test.ts:81-89`）。
- **モーション解析なし**: `SpecialMovePanel.tsx` は強度/OD ボタンのみ。236/214/623 の実演 UI は不在（`VirtualController.test.tsx:158-164` で `queryByText(/236|214|623/)` が null）。
- **出口=`move_code`**: `addResolvedMove` が `moves` から `moveId` 解決してステップ化（`useControllerInput.ts:35-46`）。バックエンド `StepRequest` は `moveId` のみ搬送で契約整合。

### §1.2 段階1 決定論引き当て … ◎
- DES-004 §2.1 整合（neutral→standing / down→crouching / up→jumping、強度接尾辞）＝`inputResolution.ts:20-34`。
- 移動のみジャンプ（`jump_neutral`）非対象＝合成形が `jumping_<強度>_<ボタン>` のみのため一致しない（`inputResolution.test.ts:75-79`）。
- 未定義 variant フォールバック＝`resolveStage1MoveId` は `null` 返却→ボタン非活性（`HitBoxLayout.tsx:83-85`）。クラッシュ・誤引き当てなし（`inputResolution.test.ts:68-73`）。
- 純関数（`moves` 引数・`moveId|null`・副作用なし）、`raw_data.command` 参照なし。過剰共通化なし（YAGNI）。

### §1.3 入力方式ボタン化＋プルダウン残置 … ○（軽微 2 点）
- ◎ プルダウン残置＋区分絞り込み: `RecipeBuilder.tsx:165-219`（`recipe-category-filter` / `recipe-move-select`）・`SetupRecipeEditor.tsx:176-240` に同方式。全カテゴリ表示・区分で件数減・別技選択可を検証（`RecipeBuilder.test.tsx:131-149`）。
- ◎ カテゴリタブで入力面切替（通常技=段階1／特殊技等=直接指定）＝`VirtualController.tsx:47-95`。
- ◎ ラッシュトグルは `category∈{normal}∧is_aerial=false` に限定、上ゾーン（空中）を無効化（`inputResolution.ts:61-71`・`HitBoxLayout.tsx:53-68`）。多段は非対象。
- △（軽微・持ち越し可）**ラッシュトグルが「通常技」タブのみに配線**され、特殊技（unique）タブ（`DirectSpecPanel`）にラッシュ版導線がない。指示書 §4.2 は「ラッシュ版トグル（通常技・**特殊技**）」と明記しており、`rush_<unique>` はクイック入力から出せない。ただし `rush_variant` カテゴリはプルダウンで網羅入力可能なため**取りこぼしはない**（併存原則を満たす）。死守違反ではないが仕様文との差分として要確認。
- △（軽微）DI/システム/投げが独立タブでなく常設 SystemRow に集約。指示書 §4.3 が「DI 独立タブ過剰の可否は製造協議（システム/タブ外へ寄せる案）」と明示的に許容しており妥当。ただし SystemRow の投げは前投げ（`throw_forward`）のみで、後投げ・システム移動技（dash/micro/jump_neutral）はプルダウン専用（取りこぼしなし）。
- ISSUE-002 整合・既存挙動（始動技自動推定・並替/削除・info-mark）温存を確認。

### §1.4 直接指定 UI … ◎
- 特殊技=ワンプッシュ（`DirectSpecPanel.tsx`、段階2 先取りなし）。
- 必殺技=ファミリー＋弱/中/強＋OD 4 種フラット（`SpecialMovePanel.tsx:47-90`）。存在する強度のみ活性（`deriveSpecialFamilies` の `byStrength`、`inputResolution.test.ts:119-129`）。
- 236 実演 UI なし。SA/システム/DI は直接指定/SystemRow で入る。

### §1.5 modifier flags … ◎
- OD 組（`od_lm`/`od_mh`/`od_lh`）・`first_hit_cancel`・`neutral_jump`・`forward_jump` を既存 `modifiers.flags`（JSON）に追加、新規列/テーブルなし（`labels.ts:78-92`）。
- 既存 flag マスタ（`just`/`delay`/`link`/`low_jump`）を残置し衝突なし（`ModifiersEditor.test.tsx:131-159`）。固定選択式（自由入力不可）。非プレーン OD は同一 `<family>_od` に解決しフラグのみ付与（`SpecialMovePanel.tsx:71-87`、`VirtualController.test.tsx:114-136`）。move_code は基底のまま（別技化なし）。

### §1.6 test-id・DES 直接編集禁止 … ◎
- `recipe-*`（tab/zone/normal/special/direct/system/rush-toggle/category-filter/move-select/add-step）を recipe サブツリーに限定付与。フル sweep なし。既存 `combo-editor-*`／`info-mark-*` は本 2 コミットで無変更（grep 差分ゼロ）。
- 2 コミットとも `docs/design/` に差分なし＝製造は DES 本体を直接編集していない。`CHANGE-057-prep-note.md` は設計担当の起票準備メモ（未追跡・製造成果物外）で、DES 改訂は設計担当レーン起票前提が守られている。別技命名の新設なし。

### §2 データ・API 契約・スキーマ不変 … ◎
- `types.ts`（`ComboStep`/`Step`/`StepRequest`/`Modifiers`/`CreateComboRequest`）に差分なし。段階1 は既存 `moveId`、flags は既存 `modifiers` に載る。マイグレーション追加なし。

### §3 フロントエンド動作仕様 … ◎
- ボタン＋方向で `moveId` 付きステップ確定、必殺技/OD/特殊技/ラッシュ確定、flags 付与を検証（`VirtualController.test.tsx`）。shadcn/ui `Tabs`・既存 `VirtualController`/`ModifiersEditor` を踏襲（Props は code-facts §1 と一致＝`VirtualController.tsx:14-19`）。

### §4 テストの妥当性 … ○
- 段階1 純関数 14 ケース（方向×ボタン×強度代表・未定義フォールバック・移動ジャンプ非対象・汚い入力非解決）。入力 UI 10 ケース（カテゴリ切替・段階1・特殊技ワンプッシュ・OD 4 種・ラッシュ空中無効・236 不在・system 温存）。modifier flags・プルダウン残置も網羅。E2E は seed 非依存・実装方式非依存記述（`m15-03-recipe-input.spec.ts`）。
- △ E2E spec 冒頭に「製造環境はブラウザ未導入のため未実行」と明記。`make e2e` 全通過はコミットメッセージの自己申告で、レビュー環境では未実行（本レビュー範囲外）。Vitest 592 通過も自己申告（未実行）。

### §5 設計意図整合 … ◎
決定論ルックアップに徹し（入力エンジン再実装なし）、置換でなく併存（プルダウン残置）、別技はデータ駆動で後（M14-03b、プルダウンで受ける）、非破壊・非スキーマを満たす。

### §6 コード品質・規約 … ○
- 曖昧語依存なし。定数化（`ZONE_PREFIX`/`ATTACKS`/`OD_VARIANT_FLAG`/`MODIFIER_FLAGS`）一貫。
- △ `useControllerInput.ts:38,53` に `console.warn`（move 未解決ガード）。既知課題 P-01 と同系の既存パターンで、`console.log` 禁止（CLAUDE.md §10）には抵触しないが本番コードのログとして残る。

### §7 既存挙動温存 … ◎
- m12-05 回帰（弱パンチ=既定 normal タブ・neutral 既定で `standing_light_punch`／投げ=SystemRow `throw_forward`）は導線維持で通過見込み。始動技自動推定・重複判定・M15-01/02 test-id 不変。SetupRecipeEditor へ同型で波及済み。

### §8 ドキュメント・進捗ログ … △（中位・要是正）
- `docs/progress/` に M15-03 完了報告が存在しない（grep で M15-02 レビューのみ）。§7.5/§8 が求める「Plan Mode 確定方式・段階1 テストケース数・`recipe-*`/追加 flag 命名規約・DES CHANGE-057 要否判定結果・既知の制約」が in-repo 化されていない。M15-02 レビューでも同種指摘があり再発。

## 設計準拠性以外の指摘事項

- **code-facts 陳腐化（派生資料）**: `code-facts.md` §1 は旧 `HitBoxLayout` Props（`onButtonClick`）/`BtnProps` を記載。本サブで `HitBoxLayout` の Props が刷新され、新規 `ControllerButton`/`SystemRow`/`DirectSpecPanel`/`SpecialMovePanel`/`inputResolution.ts` が未捕捉。`/regen_code_facts` で再生成が必要（自動生成物のため製造欠陥ではない）。
- **i18n**: 新規 UI 文言（通常技/特殊技/必殺技/ラッシュ版/弱中強/OD 等）は全てハードコード JA。製造の「レシピ入力サブツリーが既に全面ハードコード JA（`RecipeBuilder` の『追加』『非技ステップ』等）のため部分 i18n を避け周辺踏襲」判断は妥当。新規 i18n キー追加はゼロのため playbook §4.13 の ja/en parity 要件には抵触しない。サブツリー全体の i18n 化は将来 tech debt として別途。
- **`as any` 残置（既存・スコープ外）**: `SetupRecipeEditor.tsx:330` の `toInternalStep(...) as any` は本 2 コミットの差分外（従前から存在）。CLAUDE.md TS 規約の `any` 原則禁止に触れるが M15-03 起因ではない。
- **UX 微差**: 「ラッシュ版」トグル（`rush_*` 独立 move）と SystemRow「ラッシュ」ボタン（`parry_drive_rush`=生ラッシュ modifiers.type）が別概念ながら近接ラベル。aria は区別（「ラッシュ版トグル」/「ラッシュ」）されるが視覚ラベルは紛らわしい可能性。
- **`moveCode` の非対称**: VC 経由ステップは `moveCode` を保持（`useControllerInput.ts:45`）、プルダウン経由（`RecipeBuilder.handleAdd`）は保持しない。`StepRequest` に `moveCode` は無く送信されないため実害なし（情報提供）。
- **`stripStrengthLabel` エッジ**: OD のみ存在するファミリーで代表名が「OD昇龍拳」のとき、正規表現は末尾強度のみ除去のため先頭 OD が残る（`inputResolution.ts:141-143`）。表示上の軽微な見栄えのみ。

## 推奨修正（優先度別）

- **高（M15 完了前に修正必須）**: なし（死守契約・プルダウン残置・非スキーマ・非破壊はいずれも充足）。
- **中（M16 着手と並行可）**:
  1. M15-03 完了報告を in-repo 化（§7.5/§8）。最低限「Plan Mode 確定方式・段階1/UI テストケース数・`recipe-*` と追加 flag の命名規約・CHANGE-057 要否判定結果・既知の制約（特殊技ラッシュはプルダウン受け）」を `docs/progress/` に残す。
  2. 特殊技ラッシュの扱いを確定。指示書 §4.2 の「ラッシュ版トグル（通常技・特殊技）」に対し実装は通常技のみ。プルダウン受けで確定（仕様を errata で追従）か、unique タブへトグル配線を追加するかを開発者判断。
  3. `/regen_code_facts` で code-facts §1 を再生成（HitBoxLayout 新 Props・新規 5 ファイル反映）。
- **低（将来対応）**:
  - `useControllerInput` の `console.warn` を将来的にトースト/no-op へ（P-01 と束ねて整理）。
  - レシピ入力サブツリー全体の i18n 化（本サブ範囲外の tech debt）。
  - 「ラッシュ版」/「ラッシュ」ラベルの識別性向上。`stripStrengthLabel` の先頭 OD ケース。

## 良かった点

- 死守契約 3 点をコード構造レベルで担保（文字列コマンド経路を作らない・OD を同一 move+flag に解決）し、テストでも死守 1/2 を明示検証していて設計意図の理解が正確。
- 純関数（`inputResolution.ts`）と UI（`HitBoxLayout`/`SpecialMovePanel`）を分離し、段階1 網羅を Vitest 純関数へ、E2E は実装非依存スモークへ寄せる切り分けが digest §4/§5 の教訓に忠実。
- 既存 `VirtualController` の Props（code-facts §1）を保ったまま内部をタブ式へ拡張し、`ModifiersEditor` の既存 flag マスタを grep 前提で踏襲。自作再発明・命名衝突を回避できている。
- FB④ を「置換でなく併存」と正しく解釈し、RecipeBuilder / SetupRecipeEditor 双方でプルダウン残置＋区分絞り込みを対称に実装（別技の取りこぼしを防止）。
- 非スキーマ（DTO/型・マイグレ差分ゼロ）と DES 非直接編集（設計担当レーンへ CHANGE-057 委譲）の規律を守れている。

## 制約事項
- 本レビューはコード上で判定可能な範囲のみ対象。実際の動作確認・パフォーマンス・実機テストは別途実施が必要。
- Vitest 592 通過・`make e2e` 全通過はコミットメッセージの自己申告であり、本レビュー環境（read-only・ブラウザ未導入）では未実行。E2E の実通過は別途確認が必要。

---

## 取り込み結果（自動トリアージ）

`/implement_plan_full` Phase C。**高（M15 完了前修正必須）の指摘はゼロ**のためエスカレーション不要。製造担当が各指摘を採否判定し、採用分を適用した（下記）。適用後に Vitest 全通過・`make e2e` 全通過を再確認。

| # | 指摘 | 優先度 | 採否 | 理由 / 対応 |
|---|------|--------|------|-------------|
| 1 | M15-03 完了報告が in-repo 化されていない（§7.5/§8） | 中 | **採用** | `docs/progress/phase3/m15-03-completion-report.md` を新設。Plan Mode 確定方式・テストケース数・`recipe-*`/追加 flag 命名規約・CHANGE-057 要否判定・既知の制約を記載。 |
| 2 | 特殊技ラッシュが「通常技」タブのみ配線（指示書 §4.2 は「通常技・特殊技」明記） | 中 | **採用** | `inputResolution.ts` に `resolveRushByCode`/`hasUniqueRushVariant` を追加、`DirectSpecPanel` に `rushOn` を追加、`VirtualController` の特殊技タブに **unique ラッシュ版が seed に存在するときだけ**表示するデータ駆動トグル（`recipe-unique-rush-toggle`）を配線。純関数 2 ケース＋UI 2 ケースを追加。仕様文（併存）に完全準拠。 |
| 3 | `code-facts.md` §1 が旧 `HitBoxLayout` Props のままで陳腐化（派生資料） | 中 | **採用** | `scripts/generate-code-facts.sh` で再生成。新規 `ControllerButton`/`SystemRow`/`DirectSpecPanel`/`SpecialMovePanel`・`HitBoxLayout` 新 Props を反映（`VirtualController` Props は不変）。 |
| 4 | `useControllerInput` の `console.warn`（move 未解決ガード） | 低 | **不採用（持ち越し）** | 既存 `useControllerInput`・`RecipeBuilder` draftNotes と同系の既存パターンで、`console.log` 禁止（CLAUDE.md §10）には非抵触。既知課題 P-01 と束ねてトースト/no-op 化するのが妥当なため P-01 に集約。本サブ単独で剥がすと周辺と不整合。 |
| 5 | レシピ入力サブツリー全体の i18n 化 | 低 | **不採用（持ち越し）** | 本サブ範囲外の tech debt。新規 i18n キー追加ゼロで playbook §4.13 の ja/en parity 要件に非抵触（レビューも妥当と評価）。サブツリー全体 i18n は別サブで扱う。 |
| 6 | 「ラッシュ版」/「ラッシュ」ラベル識別性・`stripStrengthLabel` 先頭 OD 見栄え | 低 | **不採用（持ち越し）** | いずれも表示上の軽微。ラベルは aria で区別済み。ラベル改称は既存 aria「ラッシュ」（テスト・導線）に波及するため、UX 改善サブで束ねる。 |
| 7 | `SetupRecipeEditor.tsx` の `as any`（`toInternalStep`） | 低 | **不採用（スコープ外）** | 本 2 コミットの差分外の既存コード。CLAUDE.md TS 規約 `any` 原則禁止に触れるが M15-03 起因ではないため、スコープ厳守により本サブでは触れない（別途 tech debt）。 |

**適用後の確認**: `tsc --noEmit` エラーゼロ / Vitest 全通過（純関数 16・VirtualController 12 に増加）/ `make e2e` 全通過（m12-05 非回帰・m15-03 スモーク通過）。
