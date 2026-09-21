# M15-03 完了報告(製造)

| 項目 | 内容 |
|------|------|
| 対象指示書 | `docs/instructions/phase3/M15-03-input-method-command-resolution-stage1.md` v1.1.0 |
| 実装ブランチ | feature/m15-03 |
| 実装モデル | Opus 4.8(着手時 Plan Mode で格上げ・開発者事前承認済み) |
| 分割 | **なし(一括実装)**。開発者確認で「一括実装」確定 |
| 作成日 | 2026-07-03 |
| 関連 | レビュー報告書 `docs/progress/phase3/m15-03-review.md`(重大ゼロ)/ 起票準備メモ `docs/change-notes/CHANGE-057-prep-note.md` |

---

## 1. Plan Mode 確定方式(§3.3 #1〜#7)

1. **接続点**: 段階1 は共有 `VirtualController`(RecipeBuilder/SetupRecipeEditor 両方が `onStepAdd(StepInput)` で受ける)に接続。現行の方向 no-op を「方向ゾーン state(ニュートラル/下/上)」へ置換し、攻撃ボタン押下時に純関数 `resolveStage1MoveId` で `move_code` を合成→解決。
2. **プルダウン**: 現行 native `<select>`＋`<optgroup>`(RecipeBuilder / SetupRecipeEditor)を**残置**。上部にカテゴリフィルタ state を追加し表示数を削減(FB④=廃止でなく併存)。別技(moves 別行)はプルダウンで網羅入力=取りこぼしなし。
3. **move_code 充足**: ryu のみ seed(migration 000017 で `standing_/crouching_/jumping_` 正典形に統一済み)。段階1 は ryu で引ける。未定義 variant はボタン非活性(データ駆動)でクラッシュ/誤引き当てなし。
4. **必殺技/OD**: `Move` に `strength` 列なし→ `code` から強度接尾辞(`_light/_medium/_heavy/_od`)を剥がしファミリー導出(`deriveSpecialFamilies`)。弱/中/強＋OD 4 種フラット。OD 4 種は同一 `<family>_od` に解決し、非プレーン 3 種のみ `modifiers.flags` を付与。存在する強度のみ活性。**236 実演 UI なし**。
5. **modifier flags**: 既存 `MODIFIER_FLAGS`(`labels.ts`)= `just/delay/link/low_jump` を grep 確定→衝突なしを確認して 6 値追加。`ModifiersEditor` 固定選択式。**Go 側 flags は `[]string` のまま(既存 flags も Go 定数なし)＝バックエンド変更なし**。
6. **test-id**: 既存 `combo-editor-*`(kebab, prefix-field)/ `info-mark-*` に倣い `recipe-*` を採用。recipe サブツリー限定(フル sweep なし)。
7. **DES CHANGE**: CHANGE-057(DES-004 §2.1 段階1 / DES-004 §2.3 flags 列挙 / DES-005 §5.7 カテゴリタブ・プルダウン残置)は**要**。実装後の三点セット反映を推奨。**製造は DES 本体を直接編集していない**(2 コミットとも `docs/design/` 差分ゼロ)。設計担当が起票。別技命名は既存のため対象外。

## 2. 変更点(成果物)

- **新規純関数** `web/src/features/combo/inputResolution.ts`(段階1 引き当て・ラッシュ解決・特殊技ラッシュ・必殺技ファミリー導出・OD 4 種→flags マッピング)。
- **modifier flags 追加** `web/src/features/combo/labels.ts`(`MODIFIER_FLAGS` に 6 値)。
- **VirtualController タブ式クイック入力** `.../VirtualController/`(`VirtualController.tsx` 刷新・`HitBoxLayout.tsx` 通常技段階1 面へ刷新・新規 `ControllerButton`/`SystemRow`/`SpecialMovePanel`/`DirectSpecPanel`・`useControllerInput.ts` 刷新)。
- **プルダウン残置＋区分絞り込み** `RecipeBuilder.tsx` / `SetupRecipeEditor.tsx`。
- **テスト** Vitest(純関数・UI・flags・プルダウン)＋ E2E(`web/e2e/m15-03-recipe-input.spec.ts`)。

## 3. テストケース数

| 対象 | ファイル | ケース数 |
|------|---------|---------|
| 段階1 純関数・ファミリー・ラッシュ | `inputResolution.test.ts` | 16 |
| 入力 UI(タブ・段階1・OD4種・ラッシュ・特殊技ラッシュ・236不在・system) | `VirtualController.test.tsx` | 12 |
| modifier flags(追加6値の描画/付与/解除/衝突なし含む) | `ModifiersEditor.test.tsx` | 16(うち M15-03 追加 3) |
| プルダウン残置＋区分絞り込み | `RecipeBuilder.test.tsx` | 12(うち M15-03 追加 2) |
| E2E(段階1＋必殺技直接指定のステップ確定) | `m15-03-recipe-input.spec.ts` | 1 spec |

- **全 Vitest 592 通過**(96 ファイル)。`locales.test.ts`(ja/en parity)含め非回帰。
- **`make e2e` 全通過**(ウォームキャッシュ時)。既存 spec 非回帰(特に m12-05「弱パンチ/投げ」)。moves-edit の `.toPass()` ラッシュ生成が初回コールドスタートで flaky→リトライ通過(本サブ非起因)。

## 4. 命名規約(後続参照・code-facts 非捕捉)

### recipe-* test-id
- `recipe-tab-{normal|unique|special|super-art}` … カテゴリタブ
- `recipe-zone-{neutral|down|up}` … 方向ゾーン
- `recipe-normal-{strength}-{punch|kick}` … 通常技段階1 ボタン
- `recipe-rush-toggle` … 通常技ラッシュトグル / `recipe-unique-rush-toggle` … 特殊技ラッシュトグル
- `recipe-special-{family}-{light|medium|heavy}` / `recipe-special-{family}-od-{plain|lm|mh|lh}` … 必殺技
- `recipe-direct-{code}` / `recipe-direct-rush-{code}` … 特殊技/SA 直接指定(rush 版)
- `recipe-system-{drive-impact|drive-parry|throw|parry-drive-rush|delete}` … システム行
- `recipe-category-filter` / `recipe-move-select` / `recipe-add-step` … プルダウン残置

### 追加 modifier flags(`modifiers.flags` 列挙値)
- OD 組: `od_lm`(OD弱中) / `od_mh`(OD中強) / `od_lh`(OD弱強)
- `first_hit_cancel`(一段目キャンセル) / `neutral_jump`(垂直ジャンプ中) / `forward_jump`(前ジャンプ中)
- いずれも固定選択式・move_code は基底のまま(別技化しない)。

## 5. DES CHANGE-057 要否判定・errata 候補

- **CHANGE-057 は要**(3 領域: DES-004 §2.1 / §2.3 / DES-005 §5.7)。実装で UI/flag 実値が固まったため**実装後の三点セット反映**を推奨。製造は DES を直接編集せず、設計担当レーンでの起票を前提とする。
- **errata 候補**: DES-004 §2.3 の flags 記述は `high_jump`(未実装)を挙げ `link`(実装済み)を欠くなど現行実装と乖離。CHANGE ではなく軽微 errata として別途拾う候補(playbook §16.4.4)。

## 6. 既知の制約

- **ryu 単独 seed 前提**: 未 seed キャラの段階1/必殺技/ラッシュはボタン非活性(データ駆動)。全キャラ別技面(hold/Lv/just のボタン速出し)は **M14-03b(全キャラ seed)後のデータ駆動フォローアップ**。本サブではプルダウンで網羅入力。
- **特殊技ラッシュ**: §4.2「通常技・特殊技」に従い特殊技(unique)タブにもラッシュトグルを配線。ただし当該キャラに `rush_<unique>` が seed に存在するときのみトグルを表示(ryu は無いため非表示)。
- **段階2(command 解決)= M17** / **物理実モーション = M21** / **target_combo 区分 = M16** は本サブ対象外(越境なし)。
- **i18n**: レシピ入力サブツリーが既に全面ハードコード JA(既存 `RecipeBuilder`/`VirtualController`/`MOVE_CATEGORY_LABEL_JA`)のため、新規 UI 文言も周辺コード踏襲でハードコード JA とした(新規 i18n キー追加ゼロ=ja/en parity 要件に非抵触)。サブツリー全体の i18n 化は将来 tech debt。

## 7. レビュー自動トリアージ結果(要約)

レビュー報告書(重大ゼロ・高ゼロ)の中位 3 点を採用、低位は理由付きで持ち越し。詳細は `docs/progress/phase3/m15-03-review.md` 末尾「## 取り込み結果(自動トリアージ)」参照。
- 採用: (中1)本完了報告の in-repo 化 / (中2)特殊技ラッシュを unique タブへデータ駆動配線 / (中3)`code-facts.md` 再生成。
- 持ち越し(理由付き): (低)`console.warn`(P-01 束ね) / レシピ入力サブツリー全体 i18n / ラッシュ版・ラッシュのラベル識別性 / `stripStrengthLabel` 先頭 OD 見栄え / 既存 `as any`(本サブ差分外)。
