# 指示書 M16-04: レシピ taxonomy 明文化＋移動の system move 化＋dash 二重表現一本化（G-i）

| 項目 | 内容 |
|------|------|
| 指示書ID | M16-04 |
| マイルストーン | M16（データモデル拡充・スキーマの継ぎ目・§6 承認ゲート） |
| バージョン | 1.0.1 |
| 作成者・作成日 | 設計担当 Claude（フェーズ3 継続担当・M16 期）/ 2026-07-07（v1.0.1 事後訂正） |
| 実装モデル | **Opus 4.8 ＋ Plan Mode 必須**（最重・破壊的移行）/ レビュー Sonnet 4.6（model-allocation v1.29.0） |
| 承認ゲート | **G-i**（phase3-overview v1.1.2 §2.4）＝**着手前に開発者の個別承認を得てからマイグレ実装に入る**（M16 最重・レシピ同一性/FR301 に波及） |
| 上位文書 | M16-overview v1.2.0（`docs/instructions/phase3/M16-overview.md`）§2.1/§4.4/§4.8/§6 |
| 関連 | phase3-overview v1.1.2 §2.4 G-i／§M16 ④・④'' ／ combmgr-friend-feedback-datamodel-issues 論点④ ／ m16-design-session-handover §2/§3.1/§3.5 ／ M16-RESEARCH-01 report §A/§B/§C/§D ／ DES-004 §2.1/§2.3 ／ DES-003 §3.5 ／ SUPP-001 §3.3.1/§3.3.2/§3.3.3 ／ CHANGE-062（単値 dash 幽霊・high_jump=unique の spec 是正・済） |
| **前提（重要）** | **破壊的マイグレ（recipe_hash 波及）**。**出荷マイグレは transform（user DB 保護）／dev DB のコンボは disposable（開発者手動 E2E 用）／ryu の moves は M14-03b で clean 再 seed 前提**（開発者確定 2026-07-07）。**移動 system move の実 seed（全キャラ）は M14-03b へ委譲**＝本サブは taxonomy 原則明文化＋既存 ryu dash の移行＋再混入経路遮断に限定 |

> **文書ID ⇄ 実パスの正は `docs/handover/docs-map.md`（自動生成）**。本書は docs-map 準拠の実パスを併記する。

## 更新履歴

| 版 | 更新日 | 更新内容 |
|----|--------|----------|
| 1.0.0 | 2026-07-07 | 初版。taxonomy 原則明文化＋移動 system move 原則格上げ＋dash 二重表現一本化（modifier.type 方向別 dash 廃止＋既存データ移行）。 |
| 1.0.1 | 2026-07-07 | **事後訂正**（製造担当 Plan Mode 指摘反映）。§4.2 が「recipe_hash 再計算」「in-migration dup 検出」「targeted RecomputeComboCache」の 3 幽霊ステップを混同していた点を是正＝**000022 は純 SQL の transform＋skip に限定**（recipe_hash は `CalcRecipeHash(steps)` 都度計算＝保存列なし／dup 検出は M14-03b remap＋CRUD 時強制／recipe_cache は既定プリセット表示安定で regen 不要・alias 無い場合のみ SQL INSERT）。§1.2/§2.2/§3.4-4/-5/§4.2/§4.5/§5.1/§7.1/§7.2/§9.1/§10/footer を追従。実装は本方式で完了済み。 |

---

## 1. 背景と目的

### 1.1 背景

本サブ **M16-04（ゲート G-i）** は datamodel-issues 論点④に対応する。M16 の最重サブであり、レシピ本体（`combo_steps`）を変える唯一のサブ＝FR301 レシピ同一性/dup に波及する。

- **taxonomy 原則が未明文**: レシピ要素を (a) moves 行〔system 含む〕・(b) 非技ステップ `modifiers.type`・(c) 隣接 move への flag のどれにするかの振り分け基準が DES-004 §2.1/§2.3・SUPP-001 §3.3.1〜§3.3.3・DES-003 §3.5 に断片化し場当たり（例：`drive_parry`＝system move ／ `parry_drive_rush`＝`modifiers.type` の役割分担は既存だが原則が未明文）。ジャンプ・移動がこの隙間に落ちている（datamodel-issues 論点④）。
- **dash の二重表現**: dash は **canonical = 方向別 system move `dash_forward`/`dash_back`（DES-004 §2.1）** である一方、**SUPP-001 §3.3.3 が同じ `dash_forward`/`dash_back` を `modifiers.type` の非技種別としても定義**しており、DES-004 §2.1「移動は 1入力=1move の独立 move。2通り表現はデータ揺れを生むため不採用」原則に**違反した重複**（digest L-M15-3-3）。M15-03（CHANGE-057）の近手当てで**新規入力の 3 経路（RecipeBuilder / SetupRecipeEditor / VirtualController）は system move へ誘導済み**だが、**既存ステップ編集の `ModifiersEditor` が `dash_forward`/`dash_back` を選択肢として温存**し、混在を再発させる経路が残る。
- **M16-RESEARCH-01 実測（report §A〜§D・§想定外）**: 単値 `dash` はリポジトリ全体で 0 件＝spec 幽霊（**CHANGE-062 で doc 是正済＝後追い不要**）。system move は **ryu のみ 8 code**（`forward`/`back` は実装ゼロ）。dev DB の modifier.type dash 移行を仮定した dup 衝突は **published で 0 件**（**要 M14-03b 後の再測定**）。**ingrid combo #91 は移行先 system move dash が無く移行不能**（dev DB 固有の取込由来アーティファクト）。`setup 13` は同一レコード内に両表現が混在。
- **recipe_hash 波及（核）**: recipe_hash は DB 列でなく **`combo.CalcRecipeHash(steps)` の都度計算**（code-facts 非表出＝静的抽出対象外関数・実コード直読み）で、**`modifiers.type`/`flags`/`notes` すべてがハッシュ対象**。dash 移行は steps を変える＝recipe_hash が変わる＝FR301 dup に波及する。

### 1.2 目的

- **taxonomy 原則を 1 枚に明文化**（(a) moves 行〔system 含む〕・(b) 非技ステップ `modifiers.type`・(c) flag の振り分け）。**移動（ジャンプ・ダッシュ・微歩き）＝ system move を原則格上げ**（SUPP-001 §3.3.2「ジャンプ→攻撃は空中技＋flag で表現しジャンプ move は省略・純移動ジャンプのみ move」のレシピ表記ルールを原則へ）。DES 反映は CHANGE-064（設計担当起票）。
- **④'' dash 一本化**: `modifiers.type` の方向別 `dash_forward`/`dash_back` を**許容値定数・UI 選択肢から撤去**（`internal/model/combo.go`・`web/src/features/combo/labels.ts` の `MODIFIER_NON_MOVE_TYPES`・`ModifiersEditor`）。
- **既存 modifier.type dash → system move dash へ step 移行（マイグレ 000022・純 SQL）**: **migratable（同キャラに system move dash が存在）は transform／移行先不在は skip＋一覧出力（無損失据え置き）**。**recipe_hash は `CalcRecipeHash(steps)` の都度計算＝保存列なし＝マイグレで再計算・保存しない**。**dup 検出はマイグレに積まない**（配布 DB 構築は M14-03b の Go remap がスキャン／既存 user DB は従来どおり CRUD 時強制。現行 clean DB は ryu のみ・全件 migratable・衝突 0 件実測）。**recipe_cache は既定プリセット表示安定で regen 不要**（alias 実査で ryu dash の alias が無い場合のみ 000022 で SQL INSERT・§4.4）。
- **alias 実査**: ryu 既存 dash system move（`dash_forward`/`dash_back`）の preset alias 有無を実査し伝達メモに残す（整備本体は M14-03b seed 契約）。

### 1.3 このマイルストーンで作らないもの（スコープ外）

- **移動 system move の実 seed（全キャラ）**＝**M14-03b**（本サブは原則明文化＋ryu 既存 dash の移行のみ）。`forward`/`back`（実装ゼロ）・`high_jump`（`category=unique`・CHANGE-062 済）の新規整備は含めない。
- **④' target_combo 区分正典化**＝**M16-05**。
- **表記 rollout（FB⑥⑨⑪⑬・技/非技ラベル・始動/消費明示）**＝**M16-06**（taxonomy/① 確定後）。
- **command 索引化**＝**M17**（判断3・DES 反映は M17。本サブでは触れない）。
- **dev DB の combo #91 削除を出荷マイグレへ直書きすること**（§4.6＝汎用 skip＋一覧＋dev クリーンアップで対応・出荷物に dev 固有 id を焼き込まない）。
- ゲージ列（M16-01/02）・起き攻め（M16-03）の変更（確定済み・不変）。

### 1.4 前提（確定事項・ガードレール）

- **出荷マイグレ = transform（user DB 保護）**。先行リリース（M12・2026-06-26）以降のローカル user DB に旧経路由来の modifier.type dash が残りうるため、削除でなく移行が data 安全上の正。**clean マイグレ由来の user DB は ryu のみ moves を持つ**（classic5 は 000014 でキャラ行のみ・moves は取込由来＝clean DB に不在）ため、実利用者の modifier.type dash は事実上 ryu のみ＝**全件移行可能**。
- **移行先 system move 不在行（dev DB 固有・ingrid #91 等）は skip＋一覧出力**（無損失据え置き）。**#91 は dev クリーンアップで削除**（出荷マイグレに dev 固有 combo id を直書きしない・§4.6）。
- **dash canonical = 方向別 system move `dash_forward`/`dash_back`**（DES-004 §2.1）。**`parry_drive_rush` は cancel 注釈のため `modifiers.type` のまま正**（撤去対象外）。
- **dup 衝突検出は VAL-C02 準拠で published のみ照合**。draft/trash は移行のみ（衝突照合対象外）。
- **画面にユーザー向け dash ラベルが出る箇所は「前ダッシュ／後ろダッシュ」等の正典表示語を DES-005 と突合**（内部 code `dash_forward`/`dash_back` は不変）。

---

## 2. 成果物

### 2.1 作成するファイル

- `migrations/000022_unify_dash_to_system_move.up.sql` / `.down.sql`（命名は既存連番規約。実配置は code-facts §10。**M16-03 の 000021 の後**）。

### 2.2 修正するファイル（code-facts 由来の想定接地点・**Plan Mode で全数確認**）

- **DDL/マイグレ 000022（純 SQL・Go 非依存）**: `combo_steps`/`setup_steps` の `modifiers.type` 方向別 dash を、**同キャラの system move dash（`move_id`）を参照するステップへ書換**（`json_remove` で dash type 除去・`move_id` 設定・`step_order` 保存・移行先は相関副問い合わせ）。**移行先 system move 不在の行は `WHERE EXISTS` で skip＋一覧出力**（据え置き）。**recipe_hash 再計算・in-migration dup 検出・`RecomputeComboCache` は含めない**（recipe_hash は都度計算・dup は M14-03b remap／CRUD 時・cache は既定プリセット表示安定）。**alias 実査で ryu dash の alias が無い場合のみ preset alias を SQL INSERT**（§4.4）。
- **Go model**（`internal/model/combo.go`）: `ModifierType` 許容値定数から **`dash_forward`/`dash_back` を除去**（`parry_drive_rush`/`cancel_drive_rush` のみ残置）。**識別子 `uses_dr`/`_dr` 等の内部コードは無関係・不変**。
- **FE labels**（`web/src/features/combo/labels.ts`）: `MODIFIER_NON_MOVE_TYPES` から **`dash_forward`/`dash_back` を除去**。
- **FE `ModifiersEditor`**: 既存ステップ編集の非技種別選択肢から **dash 撤去**（再混入経路の遮断）。
- **FE `RecipeBuilder` / `SetupRecipeEditor`**: 統合プルダウンの「システム」（`category=system` の move）×「共通システム(移動・その他)」（`modifiers.type`）の **2 optgroup に dash が重複表示される問題を整理**（dash は system move optgroup のみに寄せる。RESEARCH §D）。
- **VAL**（DES-006・該当あれば）: `modifiers.type` 許容値検証から dash を除去（実コードで有無を確認）。
- **taxonomy 原則の DES 反映**（DES-004 §2.1/§2.3・DES-003 §3.5）＝**設計担当が CHANGE-064 で起票**（製造は DES 直接編集しない・伝達メモで申し送り）。

### 2.3 変更しないもの（原則）

- **`parry_drive_rush` / `cancel_drive_rush`**（`modifiers.type` 残置・正。撤去対象は dash のみ）。
- **system move dash（`dash_forward`/`dash_back`）そのもの**（canonical・移行先。撤去しない）。
- **移動 move の全キャラ seed**（M14-03b）。`forward`/`back`（実装ゼロ）・`high_jump`（unique・CHANGE-062）。
- **ゲージ始動/消費列（M16-01/02）・起き攻め `combo_oki_options`（M16-03）・`knockdown_advantage`・他 combos 列**（確定済み・不変）。
- **M13 CSV export/import の契約**（意味単位 move_code ベース＝M13-6 頑健性で dash 一本化に不変・回帰確認のみ）。

### 2.4 例外条項

- code-facts と実コードに差があれば**実コードを正**とし、相違を完了報告に記録（playbook §4.1）。

---

## 3. 前提条件

### 3.1 必読ドキュメント

- M16-overview v1.2.0 §2.1/§4.4/§4.8/§6（`docs/instructions/phase3/M16-overview.md`）。
- phase3-overview v1.1.2 §2.4 G-i／§M16 ④・④''。
- DES-004（`docs/design/04-notation-spec.md`）§2.1（移動 system move・1入力=1move 原則・high_jump=unique）・§2.3（`modifiers.type` 非技種別・CHANGE-062 注記「方向別 dash 廃止・移行は M16-04」）。
- DES-003（`docs/design/03-data-model.md`）§3.5（`combo_steps`・`move_id` NULL 可＝非技ステップは `modifiers.type` 識別）・§3.3（category：`system` の役割）。
- SUPP-001（`docs/design/supp-001-detailed-design.md`）§3.3.1（flag）・§3.3.2（ジャンプ関連 move・レシピ表記ルール・high_jump=unique）・§3.3.3（**非技ステップ type に dash が残存＝撤去対象**）。
- DES-006（`docs/design/06-validation.md`）（`modifiers.type` 許容値の検証有無）。
- code-facts（`docs/handover/code-facts.md`）§8 model（`Combo`・`ModifierType`）／§9 repository（`DuplicateKey`・combo の INSERT/SELECT）／§10 マイグレ（最新 000021／本サブ 000022・SQLite 版）。
- M16-RESEARCH-01 report（`docs/progress/phase3/M16-RESEARCH-01-report.md`）§A（移動 seed 実態）／§B（dash 二重表現・recipe_hash）／§C（dup 衝突実測）／§D（入力 UI）／想定外の発見。
- m16-design-session-handover §2（確定判断）／§3.1（M16-04 勘所）／§3.5（追加調査・判断メモ）。
- retrospective-digest §1-A（実データ≠仕様正典・破壊的移行の対象は実測で確定）／§3（1入力=1move 原則の DES 横断監査 L-M15-3-3）／§4（表示トークン変更は recipe_cache 波及・全表示箇所調査）／§5（破壊的マイグレ×`dbtest.Setup`・down 整合・FK=OFF×明示 DELETE 非同居）。

### 3.2 前提事実（実ファイルで確認済み・Plan Mode で再確認）

- **`modifiers.type` 許容値**（code-facts §8・`internal/model/combo.go`）＝ `parry_drive_rush` / `cancel_drive_rush` / `dash_forward` / `dash_back`。**dash 2 値が撤去対象**（parry/cancel は残置）。
- **`MODIFIER_NON_MOVE_TYPES`**（`web/src/features/combo/labels.ts`）＝上記 4 値。dash 2 値撤去。
- **system move dash（移行先）** ＝ ryu の `dash_forward`(id=44)/`dash_back`(id=45)（RESEARCH §A）。**ryu のみ・他キャラは system move 0 件**。
- **dev DB 実データ**（RESEARCH §B）: `modifiers.type` dash = combo 17 件・setup 1 件／system move dash 参照 = combo 2 件・setup 1 件。**published 影響 4 件・うち ingrid #91 は移行不能**。`setup 13` は同一レコード内で両表現混在。
- **recipe_hash**（RESEARCH §C・実コード直読み）＝ `combo.CalcRecipeHash(steps)` 都度計算・`modifiers.type`/`flags`/`notes` ハッシュ対象。**code-facts 非表出**。
- **dup 判定**＝ `DuplicateKey`（code-facts §9：CharacterID/StarterMoveID/Position/OpponentStance/HitType/OpponentSize の 6 フィールド）**一致 かつ recipe_hash 一致**。起き攻め・ゲージは非対象。
- **`preset_aliases` UNIQUE `(preset_id, move_id)`**（DES-003 §3.5・code-facts）＝新規 move は既存 alias を流用できず、alias 行が無いと `resolveMoveStep` が生 code 表示にフォールバック（RESEARCH §B）。
- **マイグレ連番**: 最新 = 000021（M16-03）。本サブ = **000022**。

### 3.3 参照不要

- M16-05/06 の実装詳細・M14-03b seed 本体・command 索引化（M17）。

### 3.4 着手前の確認（Plan Mode 必須。§9.4 と対応）

以下 **8 項目**を Plan Mode で実コード確認のうえ計画提示すること（記憶・report のみで進めない。最終的な正は実コード）。

1. **`modifiers.type` dash の全消費経路 grep 全列挙（撤去安全性の核心）**: `dash_forward`/`dash_back`（`modifiers.type` 文脈）の**全消費箇所**を grep 全列挙（model 定数／`labels.ts` `MODIFIER_NON_MOVE_TYPES`／`ModifiersEditor`／`RecipeBuilder`／`SetupRecipeEditor`／VAL／その他）。**1入力=1move 原則の DES 横断監査**（DES-004 §2.1 ⇔ SUPP-001 §3.3.3 ⇔ DES-003 §3.5）で違反の残りが無いか（digest §3・L-M15-3-3）。system move の `dash_forward`/`dash_back`（`move.code`）を巻き込まないよう、`modifiers.type` 文脈に限定して対象を明示列挙する（digest §5・M12-7 の接頭辞巻き込み回避）。
2. **recipe_hash の実挙動**: `CalcRecipeHash(steps)` がハッシュ対象とするフィールド（`modifiers.type`/`flags`/`notes`）と決定論性（型付き struct・flags ソート）を実コードで確認。**移行が recipe_hash を変える**ことを確認。
3. **移行対象 SELECT と migratable/skip の振り分け**: `combo_steps`/`setup_steps` の `modifiers.type` dash 行を全列挙。各行の所属コンボの `character_id` に **同方向の system move dash が存在するか**を判定＝**migratable（transform）／skip（移行先不在・一覧出力）**の振り分け。draft/trash も transform 対象（衝突照合はしない＝下記4）。
4. **dup 検出の責務分界（マイグレに積まない）**: recipe_hash は `CalcRecipeHash(steps)` 都度計算・保存列なし＝マイグレで再計算しない。dup 判定は DB 制約でなく **CRUD 時 Go サービス層で強制**。よって **000022 に in-migration dup 検出を実装しない**。配布/新 DB の dup スキャンは **M14-03b の Go remap**（seed 構築時）、既存 user DB は **CRUD 時強制のまま**（仮に移行で 2 コンボが同一化しても DB は壊れず次回編集で顕在化）。現行 clean DB は ryu のみ・全件 migratable・衝突 0 件（RESEARCH §C・M14-03b 後に再測定）＝データ喪失なし。
5. **recipe_cache の扱い（regen 要否）**: 既定プリセット（`official_ja_move`）の dash 表示は「前ダッシュ/後ろダッシュ」で移行前後不変＝**regen 不要**（ryu dash に alias があれば）。非既定プリセット（空 alias→フォールバック）の残留は表示のみ・次回編集で self-heal。**マイグレで `RecomputeComboCache` を呼ばない**。alias 実査（§3.4-6）で ryu dash の alias が無ければ 000022 で alias を SQL INSERT（regen 経路も正にする）。影響範囲を Plan Mode で確認（digest §4）。
6. **alias 実査**: ryu の `dash_forward`/`dash_back` に preset alias（`official_ja_move` 等）が存在するか実査。無ければ移行後の recipe_cache 再生成で生 code 表示にフォールバックする（RESEARCH §B）。**整備は M14-03b seed 契約**＝本サブは**実査結果を伝達メモに残す**（本サブで alias を新設するかは実査結果で判断・原則は M14-03b 委譲）。
7. **マイグレ 000022 技法と down 整合**: `modifiers.type` dash step → system move dash step への書換 DML（`move_id` 設定＋`modifiers.type` 除去・step_order 保存）・**down は逆写像**（system move dash step → `modifiers.type` dash・skip 分は据え置き）・**FK=OFF と明示 DELETE を同一指示書に同居させない**（digest §5）・`dbtest.Setup` が 000022 を含む全マイグレ適用後に**全既存テスト通過**・既存マイグレ（編集禁止）非改変・連番 000022。
8. **taxonomy 原則の DES 反映範囲**: DES-004 §2.1/§2.3（原則明文化＋方向別 modifier.type dash 廃止の完了反映）・DES-003 §3.5（`combo_steps` taxonomy）・SUPP-001 §3.3.3（dash 撤去）の **CHANGE-064 見込み**を伝達メモへ（DES 反映は設計担当起票）。

---

## 4. 詳細仕様

### 4.1 taxonomy 原則の明文化（設計・非破壊）

レシピ要素の振り分け原則を 1 枚に明文化する（DES 反映は CHANGE-064）。

- **(a) moves 行**（`combo_steps.move_id` あり）: 技（通常/特殊/SA/CA/投げ/ラッシュ版/drive_impact）＋ **`category="system"` の共通システム動作**（`drive_parry`・**移動＝`dash_*`/`jump_*`/`micro_*`/`forward`/`back`**）。移動は「1入力=1move」で独立 move（DES-004 §2.1）。
- **(b) 非技ステップ `modifiers.type`**（`move_id` NULL）: **技でも移動でもない、隣接ステップの出し方を表す動作**＝`parry_drive_rush`（生ラッシュ）・`cancel_drive_rush`（キャンセルラッシュ）。**dash はここに置かない**（移動＝(a)）。
- **(c) flag（`modifiers.flags`）**: 直近 move の**出し方の修飾**（`just`/`delay`/`link`/`low_jump`/`neutral_jump`/`forward_jump`/`od_*` 等）。ジャンプ→攻撃は空中技＋`{neutral_jump}`/`{forward_jump}` flag で表現し、**ジャンプ move は省略**（純移動ジャンプのみ (a) の move。SUPP-001 §3.3.2 のレシピ表記ルールを原則へ格上げ）。
- **判断基準（原則の要旨）**: 「独立した 1 入力の動作か」＝ (a) move、「隣接動作の出し方の種別か」＝ (b) type、「直近 move の修飾か」＝ (c) flag。move と type の二重表現は不採用（DES-004 §2.1）。

### 4.2 マイグレ 000022（dash 一本化・純 SQL・破壊的）

- **移行（transform・migratable）**: `combo_steps`/`setup_steps` の `modifiers.type ∈ {dash_forward, dash_back}` の行を、**所属コンボの `character_id` の同方向 system move dash（`move.code=dash_forward`/`dash_back`）を参照するステップ**（`move_id` 設定・`modifiers` から dash type を `json_remove`・`step_order` 保存）へ書換。移行先は相関副問い合わせで解決。
- **skip（移行先不在）**: 所属 `character_id` に該当 system move dash が無い行は `WHERE EXISTS` で**移行せず据え置き＋一覧出力**（無損失。clean DB では発生しない・dev DB の ingrid #91 等が該当）。
- **含めないもの（純 SQL・Go 非依存で完結）**: **recipe_hash 再計算**（`CalcRecipeHash(steps)` は都度計算＝保存列なし・マイグレで再計算する対象が存在しない）・**in-migration dup 検出**（dup は DB 制約でなく CRUD 時 Go 強制。配布 DB は M14-03b remap がスキャン・既存 user DB は次回編集で顕在化）・**`RecomputeComboCache`**（既定プリセット表示安定で regen 不要）。
- **alias**: §3.4-6 の実査で ryu dash の preset alias が無い場合のみ 000022 で alias を SQL INSERT（§4.4・regen 経路の生 code フォールバックを防ぐ）。
- **down**: system move dash step → `modifiers.type` dash step へ逆写像。skip した行は据え置き。**FK=OFF と明示 DELETE を同一指示書に同居させない**（digest §5）。`dbtest.Setup` 全テスト通過・down 整合。

### 4.3 再混入経路の遮断（modifier.type dash 撤去）

- **Go model**（`internal/model/combo.go`）: `ModifierType` 許容値から `dash_forward`/`dash_back` を除去（`parry_drive_rush`/`cancel_drive_rush` のみ）。
- **FE `labels.ts`**: `MODIFIER_NON_MOVE_TYPES` から dash 2 値を除去。
- **FE `ModifiersEditor`**: 既存ステップの非技種別編集の選択肢から dash 撤去。
- **FE `RecipeBuilder`/`SetupRecipeEditor`**: 2 optgroup（「システム」／「共通システム(移動・その他)」）の dash 重複表示を整理（dash は system move optgroup のみ）。
- **VAL**（該当あれば）: `modifiers.type` 許容値検証から dash 除去。
- **新規入力の非回帰**: M15-03 の 3 経路（RecipeBuilder/SetupRecipeEditor/VirtualController）が引き続き system move dash へ解決されること（撤去で壊さない）。

### 4.4 alias 実査（M14-03b seed 契約への申し送り）

- ryu の `dash_forward`/`dash_back` に preset alias が存在するか実査。**移行後の recipe_cache 再生成で生 code 表示にフォールバックしないか**を確認し、結果を伝達メモへ。**移動 move の alias 整備本体は M14-03b seed 契約**（移動 move の seed と alias を対にする＝RESEARCH §B）。

### 4.5 recipe_hash / dup 波及の扱い

- 移行は steps を変える＝次回以降の `CalcRecipeHash(steps)` の値が変わる（保存 hash は無い）。dup 判定は CRUD 時 Go サービス層で強制されるため、**マイグレでの衝突検出は不要**（配布 DB は M14-03b remap がスキャン・既存 user DB は編集時に既存 dup 判定が拾う）。現行 clean DB は全件 migratable・衝突 0 件でデータ喪失なし。**M13 export = データ安全網**の上で移行する（意味単位 move_code ベース＝M13-6 頑健性）。

### 4.6 dev クリーンアップ（combo #91・出荷マイグレ非直書き）

- **出荷マイグレに dev 固有 combo id（#91 等）を直書きしない**。移行先不在は §4.2 の**汎用 skip＋一覧**で無損失据え置き。**dev DB の #91（ingrid・取込由来・disposable）はテスト setup / dev クリーンアップで削除**（開発者確定 2026-07-07＝dev コンボは disposable）。テストは**専用 fixtures**（既知の `modifiers.type` dash → system move dash）で移行ロジックを検証し、dev DB の実データに依存しない。

---

## 5. テスト要件（ケース数で語る。§7 DoD と対応）

### 5.1 Go テスト

- **マイグレ 000022 up（純 SQL）**: fixtures で `modifiers.type` dash step → system move dash step（migratable transform）・移行先不在 step の skip（据え置き・一覧）。**dev DB 非依存の専用 fixtures**で assert。
- **マイグレ 000022 down**: system move dash step → `modifiers.type` dash への逆写像・skip 分据え置き。`dbtest.Setup` 全テスト通過。
- **recipe_hash（都度計算）**: 移行後 fixtures で `CalcRecipeHash(steps)` が移行後 steps の値を返す（移行前とは異なる）ことを確認（保存列 regen ではない）。
- **dup 非回帰（CRUD 時）**: 移行後 published を CRUD 経路で扱ったとき重複判定（`DuplicateKey`＋recipe_hash）が期待どおり（現行 fixtures で衝突 0 件）。**マイグレに dup 検出ロジックが無い**ことを確認。
- **model 定数**: `ModifierType` から dash 除去後に `go build`/`go vet` 通過・dash を参照する残コードが無い。

### 5.2 FE テスト（Vitest / tsc）

- `labels.ts`/`ModifiersEditor` から dash 消失後に `tsc`/ビルド通過（型エラーなし）。
- `ModifiersEditor` の非技種別選択肢に dash が無い。
- `RecipeBuilder`/`SetupRecipeEditor` で dash が system move optgroup のみ・「共通システム(移動・その他)」からの dash 重複が解消。
- 新規 dash 入力（3 経路）が system move dash へ解決（M15-03 非回帰）。

### 5.3 E2E / 手順書

- 既存 `modifiers.type` dash コンボ（fixtures）が移行後に system move dash として詳細/一覧/比較で表示（recipe_cache 再生成）。
- `ModifiersEditor` に dash 選択肢が無い（再混入不能）。
- M13 CSV export/import が dash 一本化後も往復成立（意味単位 move_code ベース＝不変）。

### 5.4 移行検証の記録

- 移行前後の recipe_hash 差分・dup 衝突件数（現行 fixtures で 0）・skip 一覧（移行先不在）・alias 実査結果を完了報告に含める。

---

## 6. レビュー観点（別ファイル参照）

`docs/instructions/phase3/reviews/M16-04-review-checklist.md` を参照。重大判定は §9。

---

## 7. 完了条件（Definition of Done）

### 7.1 機能要件

- taxonomy 原則が明文化され（DES 反映は CHANGE-064）、移動が system move で扱える原則が確立。
- `modifiers.type` 方向別 dash が許容値・UI から撤去され、再混入経路（`ModifiersEditor`・2 optgroup 重複）が遮断された。
- 既存 modifier.type dash が system move dash へ移行（**純 SQL・migratable transform／移行先不在 skip＋一覧**）された。**dup 検出・recipe_cache regen はマイグレに積まず**（M14-03b remap／CRUD 時／既定プリセット表示安定）、alias 実査で無い場合のみ SQL INSERT。
- `parry_drive_rush`/`cancel_drive_rush`・system move dash・ゲージ/起き攻め列・M13 CSV が不変。

### 7.2 自己テスト結果

- §5 の Go/FE/E2E をケース数で報告。`dbtest.Setup` 通過・down 整合・**移行前後の recipe_hash（都度計算）検証・skip 一覧・現行 fixtures の dup 0 件**を明記。

### 7.3 品質チェック

- `modifiers.type` dash の全接地経路 grep 結果（波及網羅・system move dash を巻き込まない対象限定の確証）を報告。画面のユーザー向け dash 表示語を DES-005 と突合（内部 code `dash_*` は不変）。禁則表現・簡体字なし・出力前 grep 校正（「起き攻め」誤字・「DR」略記＝本サブは非該当だが規律として実行）。

### 7.4 ドキュメント

- Plan Mode 確定方式（8 項目）・移行結果（transform/skip/dup 件数）・alias 実査結果・既知の制約（down 損失範囲＝skip 据え置き・移行先不在）を完了報告に。
- **DES-004 §2.1/§2.3・DES-003 §3.5・SUPP-001 §3.3.3 への CHANGE-064 見込み**を**設計担当への伝達メモ**で申し送り（DES 反映は設計担当が起票）。

### 7.5 完了報告

- 上記＋ CHANGE-064 の具体化点（taxonomy 原則の確定文言・dash 撤去の実接地）を伝達メモで申し送り。

---

## 8. 参照ドキュメント

- M16-overview v1.2.0 §2.1/§4.4/§4.8/§6 ／ phase3-overview v1.1.2 §2.4 G-i ／ DES-004 §2.1/§2.3 ／ DES-003 §3.5/§3.3 ／ SUPP-001 §3.3.1/§3.3.2/§3.3.3 ／ DES-006 ／ code-facts §8/§9/§10 ／ M16-RESEARCH-01 report §A/§B/§C/§D ／ m16-design-session-handover §2/§3.1/§3.5 ／ retrospective-digest §1-A/§3/§4/§5 ／ datamodel-issues 論点④。

---

## 9. 注意事項・判断に迷ったら

### 9.1 推測で進めてはいけない事項

- **`modifiers.type` dash の全消費箇所**（§3.4-1 の grep。撤去漏れ＝再混入 or コンパイル不能）。**system move dash（`move.code`）を巻き込まない対象限定**。
- **recipe_hash の実挙動**（§3.4-2・実コード直読み。想定で「変わらない/変わる」を決めない）。
- **移行の migratable/skip 判定**（§3.4-3・移行先 system move の有無で振り分け）。
- **dup 検出をマイグレに積まない**（§3.4-4・recipe_hash は都度計算・dup は M14-03b remap／CRUD 時強制）。
- **`RecomputeComboCache` をマイグレで呼ばない**（§3.4-5・既定プリセット表示安定で regen 不要・alias 無い場合のみ SQL INSERT）。
- **FK=OFF と明示 DELETE の非同居**・既存マイグレ非改変（§3.4-7・digest §5）。

### 9.2 推測で進めてよい事項（その旨を明示）

- マイグレ DML の具体書法（step 書換 vs 置換・既存連番規約に沿う範囲）。
- skip 一覧・移行ログの出力書式。

### 9.3 不明事項発見時の対応

- **移行先不在が想定外に多い**（clean DB 相当で ryu 以外に `modifiers.type` dash を発見）・**dup 衝突が発生**・**alias 実査で想定外**（ryu dash に alias が無い等）の場合は実装を止め、設計担当へ差し戻す（§確認事項）。
- system move dash（`move.code`）と `modifiers.type` dash の区別が実コードで曖昧な箇所を発見した場合は設計担当へ確認（taxonomy 原則の追補要否）。

### 9.4 Plan Mode で計画提示時に含めるべき項目

- §3.4 の 8 項目すべて（dash 全消費経路 grep ／ recipe_hash 実挙動 ／ 移行 migratable/skip ／ published dup 衝突 ／ targeted cache ／ alias 実査 ／ マイグレ 000022 技法・down ／ taxonomy DES 反映範囲）。

---

## 10. 完了後の次ステップ

- 完了報告（伝達メモ）を受けて設計担当が **CHANGE-064 三点セット**を起票（通知書＋改訂 DES 本体〔DES-004 §2.1/§2.3・DES-003 §3.5〕＋change-report。SUPP-001 §3.3.3 の dash 撤去は自由改訂）。**M16-overview §4.8/§6 の要決定確定反映も同トランザクション**。
- **M16-05（④' target_combo 区分正典化）** → **M16-06（表記 rollout・旧 M15-07）** → **M14-03b（全キャラ seed・配布 blocker）**。M14-03b は本サブの G-i canonical（移動 system move 行・dash 一本化後・移動 move の alias）を seed 契約とし、**本サブがマイグレに積まない dup 検出（配布 DB 構築時スキャン）を M14-03b の Go remap が担う**（M16-overview §5-7 追記）。

---

*以上、指示書 M16-04 v1.0.0。配置 `docs/instructions/phase3/M16-04-step-taxonomy-and-dash-unification.md`。対のレビューチェックリストは `docs/instructions/phase3/reviews/M16-04-review-checklist.md`。承認ゲート G-i＝マイグレ実装着手前に開発者の個別承認を得る（M16 最重・破壊的移行）。出荷マイグレは **純 SQL の transform（user DB 保護）**・移行先不在は skip＋一覧（無損失）・#91 は dev クリーンアップ・出荷物に dev 固有 id を焼き込まない。**recipe_hash は都度計算＝マイグレで再計算しない／dup 検出は M14-03b remap（配布）＋CRUD 時強制（既存 user）＝マイグレに積まない／recipe_cache は既定プリセット表示安定で regen 不要・alias 無い場合のみ SQL INSERT**。移動 move の全キャラ seed・alias 整備・配布 DB の dup スキャンは M14-03b。dash canonical = 方向別 system move。*
