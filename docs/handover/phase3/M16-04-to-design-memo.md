# M16-04 → 設計担当 伝達メモ(CHANGE-064 見込み)

| 項目 | 内容 |
|------|------|
| 発信 | 製造担当 Claude(M16-04 実装) |
| 宛先 | 設計担当 Claude(フェーズ3 継続担当) |
| 日付 | 2026-07-06 |
| 対象指示書 | `docs/instructions/phase3/M16-04-step-taxonomy-and-dash-unification.md` v1.0.0(④''・G-i) |
| 完了報告 | `docs/progress/progress-log.md` §M16-04 |
| 位置づけ | 製造は DES 本体を直接編集しない(CLAUDE.md §8)。本メモは CHANGE-064 三点セット起票のための申し送り。 |

---

## 1. CHANGE-064 として DES へ反映してほしい内容

### 1.1 taxonomy 原則の明文化(指示書 §4.1・DES-004 §2.1/§2.3・DES-003 §3.5)

レシピ要素の振り分け原則を 1 枚に明文化(製造では実コードに反映済み・DES 本体は未編集):

- **(a) moves 行**(`combo_steps.move_id` あり): 技(通常/特殊/SA/CA/投げ/ラッシュ版/drive_impact)＋ **`category="system"` の共通システム動作**(`drive_parry`・**移動＝`dash_*`/`jump_*`/`micro_*`/`forward`/`back`**)。移動は「1入力=1move」で独立 move。
- **(b) 非技ステップ `modifiers.type`**(`move_id` NULL): **技でも移動でもない、隣接ステップの出し方**＝`parry_drive_rush`・`cancel_drive_rush` のみ。**dash はここに置かない**(移動＝(a))。
- **(c) flag(`modifiers.flags`)**: 直近 move の修飾。ジャンプ→攻撃は空中技＋`{neutral_jump}`/`{forward_jump}` で表現しジャンプ move を省略(純移動ジャンプのみ (a))。
- **判断基準**: 「独立した 1 入力の動作か」＝(a) move、「隣接動作の出し方の種別か」＝(b) type、「直近 move の修飾か」＝(c) flag。move と type の二重表現は不採用(DES-004 §2.1)。

### 1.2 方向別 dash の modifier.type 廃止の完了反映

- **DES-004 §2.3**: `modifiers.type` 非技種別の一覧から方向別 dash(`dash_forward`/`dash_back`)を削除(CHANGE-062 で単値 `dash` の doc 幽霊は是正済み。本サブは方向別の実撤去)。canonical は §2.1 の system move dash。
- **SUPP-001 §3.3.3**: 非技ステップ type の記述から dash を撤去(残置は `parry_drive_rush`/`cancel_drive_rush`)。§3.3.2 のレシピ表記ルール(移動=system move・ジャンプ move 省略)を taxonomy 原則へ格上げ。
- **DES-003 §3.5**: `combo_steps` の taxonomy(move_id あり=技/system move、move_id NULL=非技 type)を上記 (a)/(b)/(c) に整合。

### 1.3 実装で確定した接地点(DES 反映時の参照)

- Go: `internal/model/combo.go`(`ModifierType` 定数 = parry/cancel のみ)、`internal/service/notation/resolver.go`(`nonMoveTypeText` から dash 除去)。
- FE: `web/src/features/combo/labels.ts`(`MODIFIER_NON_MOVE_TYPES` = parry/cancel)、`ModifiersEditor`/`RecipeBuilder`/`SetupRecipeEditor`(dash は「システム」optgroup の system move のみ)。
- マイグレ: `migrations/000022_unify_dash_to_system_move.{up,down}.sql`(既存 modifier.type dash → system move dash へ移行)。

---

## 2. alias 実査結果(M14-03b seed 契約への申し送り)

- **ryu**: `dash_forward`/`dash_back`(system move)は `official_ja_move` に alias「前ダッシュ/後ろダッシュ」実在(`migrations/000006`)。resolver フォールバックで全プリセット表示安定。移行後の生 code 表示なし。
- **他キャラ(ken/ingrid/c_viper/dhalsim)**: system move dash 自体が未 seed。M14-03b で移動 move を seed する際、`preset_aliases` は `(preset_id, move_id)` キーのため新 move_id に既存 alias を流用不可。**move seed と alias seed を同一マイグレで対にすること**(さもないと `resolveMoveStep` が生 code へフォールバック)。

---

## 3. M16 overview 側の要決定確定反映(申し送り)

- **M16-overview §4.8/§6**: 本サブの G-i 確定方式(SQL transform 限定・dup 検出は M14-03b の Go remap＋既存 CRUD 時強制へ委譲・recipe_cache regen 不要・移動 system move の全キャラ seed は M14-03b)を確定反映されたい。
- **指示書 §4.2 の追補(推奨・独立レビュー質問由来)**: 指示書 v1.0.0 §4.2/§3.4-4/-5 の原文は「マイグレ内で published dup 衝突検出(skip＋提示)」「移行コンボのみ targeted `RecomputeComboCache`」を要求するが、**開発者確定方針(2026-07-06)により両者はマイグレに積まない**(recipe_hash/RecomputeComboCache は Go・SQL マイグレから呼べない/dup は M14-03b の Go remap＋既存 CRUD 時強制へ委譲/recipe_cache は移行前後で表示文字列がバイト一致するため regen 不要)。実装は確定方針に忠実だが**指示書本文との乖離が残る**ため、指示書 v1.0.1 での §4.2 追補(確定方針の反映)を CHANGE-064 or overview §4.8 と同トランザクションで行われたい。独立レビュー(`docs/progress/phase3/m16-04-review.md` §質問)も同追補を推奨。
- **dup 衝突再測定**: 現行 dev DB で 0 件。M14-03b 全キャラ seed 後にデータ量増を踏まえた再測定を M14-03b の DoD に含めることを推奨。

---

## 4. スコープ外(本サブでは扱っていない・後続)

- ④' target_combo 区分正典化 = M16-05。
- 表記 rollout(FB⑥⑨⑪⑬) = M16-06。
- 移動 system move の全キャラ seed・alias 整備 = M14-03b(本サブの G-i canonical を seed 契約とする)。
- `forward`/`back`(実装ゼロ)・`high_jump`(DES-004/SUPP-001 三者不一致・RESEARCH 想定外の発見)の整理 = 別途 CHANGE で設計担当判断。

---

*以上、M16-04 伝達メモ。CHANGE-064 三点セット(通知書＋改訂 DES 本体〔DES-004 §2.1/§2.3・DES-003 §3.5〕＋change-report。SUPP-001 §3.3.3 は自由改訂)の起票をお願いします。*
