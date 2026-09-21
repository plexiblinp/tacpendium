# M16-04 レビューチェックリスト

| 項目 | 内容 |
|------|------|
| 対象指示書 | `docs/instructions/phase3/M16-04-step-taxonomy-and-dash-unification.md` v1.0.1（taxonomy 明文化＋移動 system move 化＋④'' dash 一本化・G-i） |
| 対象指示書ID | M16-04 |
| レビューモデル | Sonnet 4.6（model-allocation v1.29.0。実使用は開発者判断） |
| バージョン | 1.0.1 |
| 作成者・作成日 | 設計担当 Claude（フェーズ3 継続担当・M16 期）/ 2026-07-07 |

> **文書ID ⇄ 実パスの正は `docs/handover/docs-map.md`（自動生成）**。本書は docs-map 準拠の実パスを併記する。

## 更新履歴

| 版 | 更新日 | 更新内容 |
|----|--------|----------|
| 1.0.0 | 2026-07-07 | 初版（指示書 v1.0.0 と対）。 |
| 1.0.1 | 2026-07-07 | 指示書 v1.0.1 追従（製造 Plan Mode 指摘＝000022 は純 SQL の transform＋skip に限定・recipe_hash 都度計算/dup は M14-03b remap＋CRUD 時/recipe_cache regen 不要）。§0.1・§0.2・§1.3・§2・§3・§4.1・§5・§7・§9・§12・footer を追従。 |

---

## 0. レビュー担当への前置き

### 0.1 レビュー前の準備

- 必読: 指示書 v1.0.1、M16-overview v1.2.0 §4.4/§4.8/§6、DES-004 §2.1/§2.3、DES-003 §3.5/§3.3、SUPP-001 §3.3.1/§3.3.2/§3.3.3、DES-006（modifier.type 検証）、code-facts §8（`ModifierType`・`Combo`）/§9（`DuplicateKey`・combo INSERT/SELECT）/§10（最新 000021・本サブ 000022）、M16-RESEARCH-01 report §A/§B/§C/§D（移動 seed・dash 二重表現・recipe_hash・dup 実測）、m16-design-session-handover §2/§3.1/§3.5、retrospective-digest §1-A/§3/§4/§5。
- **Plan Mode 着手前確認結果の確認（必須・playbook §8.4.4）**: 指示書 §3.4 の **8 項目すべて**（1 dash 全消費経路 grep / 2 recipe_hash 実挙動〔都度計算〕 / 3 移行 migratable/skip / 4 dup 検出の責務分界〔マイグレ非搭載・M14-03b remap／CRUD 時〕 / 5 recipe_cache regen 要否〔既定プリセット表示安定〕 / 6 alias 実査 / 7 マイグレ 000022 技法・down / 8 taxonomy DES 反映範囲）に Plan Mode 質問書＋開発者回答が残っているか。未確認のまま実装した項目があればその時点で重大（§9＝推測実装）。

### 0.2 レビューの基本姿勢

- **承認ゲート G-i（最重・破壊的移行）**: マイグレ実装は**開発者の個別承認後**か（着手前承認の証跡）。
- **`modifiers.type` dash の撤去と既存データ移行が本サブの肝**。撤去は再混入経路（`ModifiersEditor`・2 optgroup 重複）まで塞げているか、移行は **transform / skip（移行先不在）の 2 分岐**が正しいか、**dup 検出・recipe_cache regen をマイグレに積んでいない**（純 SQL）ことをコードとテストで確認。
- **recipe_hash 波及**は静的抽出非対象（`CalcRecipeHash`）＝**実コード直読み**で裏取り。目視は手順書で補う。

### 0.3 レビュー結果の報告フォーマット

- 各節ごとに「OK / 重大（§9）/ 軽微（§10）/ 質問（§11）」で報告。

---

## 1. 設計書本体・上位文書との照合（最重要）

### 1.1 taxonomy 原則（指示書 §4.1・DES 反映は CHANGE-064）

- [ ] 振り分け原則 (a) moves 行〔system 含む〕/ (b) 非技ステップ `modifiers.type` / (c) flag が 1 枚に整理され、**移動＝system move**・**ジャンプ→攻撃は空中技＋flag でジャンプ move 省略**（SUPP-001 §3.3.2）が原則として明記されているか。
- [ ] `parry_drive_rush`/`cancel_drive_rush` が (b) に残る正当性（技でも移動でもない出し方種別）が保たれ、dash が (b) から外れているか。
- [ ] 製造担当が DES を直接編集せず、原則の DES 反映を**設計担当への伝達メモ**で申し送っているか（DES-004 §2.1/§2.3・DES-003 §3.5）。

### 1.2 dash 撤去（指示書 §4.3・§2.2）

- [ ] Go `internal/model/combo.go` の `ModifierType` 許容値から **`dash_forward`/`dash_back` が除去**され、`parry_drive_rush`/`cancel_drive_rush` が残置されているか。
- [ ] FE `web/src/features/combo/labels.ts` の `MODIFIER_NON_MOVE_TYPES` から dash 2 値が除去されているか。
- [ ] `ModifiersEditor` の非技種別選択肢から dash が撤去され、**再混入経路が塞がれている**か。
- [ ] `RecipeBuilder`/`SetupRecipeEditor` の「システム」×「共通システム(移動・その他)」2 optgroup で **dash の重複表示が解消**（dash は system move optgroup のみ）されているか（RESEARCH §D）。
- [ ] **内部識別子 `uses_dr`/`_dr` 等・system move dash（`move.code=dash_forward`/`dash_back`）を誤って巻き込んでいない**か（撤去対象は `modifiers.type` 文脈の dash のみ）。

### 1.3 既存データ移行（指示書 §4.2・マイグレ 000022）

- [ ] `combo_steps`/`setup_steps` の `modifiers.type` dash 行が、**同キャラの system move dash（`move_id`）参照ステップへ transform**（`modifiers` から dash type 除去・`step_order` 保存）されているか。
- [ ] **移行先 system move 不在の行は skip＋一覧出力（据え置き・無損失）**か。**出荷マイグレに dev 固有 combo id（#91 等）が直書きされていない**か。
- [ ] **dup 検出をマイグレに積んでいない**か（recipe_hash は `CalcRecipeHash(steps)` 都度計算＝保存列なし・dup は DB 制約でなく CRUD 時 Go 強制。配布 DB は M14-03b remap がスキャン・既存 user DB は次回編集で顕在化）。in-migration の dup ロジックが無いことを確認。
- [ ] **マイグレで `RecomputeComboCache` を呼んでいない**か（既定プリセットの dash 表示は前後不変で regen 不要）。alias 実査で ryu dash の alias が無い場合のみ 000022 で alias を SQL INSERT しているか。

### 1.4 alias 実査（指示書 §4.4）

- [ ] ryu の `dash_forward`/`dash_back` の preset alias 有無を実査し、**移行後の生 code 表示フォールバックの有無**を伝達メモに残しているか。**alias 整備本体は M14-03b 委譲**の位置づけが保たれているか。

### 1.5 DES 直接編集の禁止

- [ ] taxonomy 原則・dash 撤去の変更詳細を製造担当が DES に直接書いていないか（設計担当が CHANGE-064 起票）。

---

## 2. マイグレーションの健全性（retro・digest §5）

- [ ] **FK=OFF と明示 DELETE が同一指示書に同居していない**か（digest §5・M12-5）。
- [ ] 000022 が transform／skip（移行先不在）の 2 分岐で、**down が system move dash step → `modifiers.type` dash への逆写像**（skip 分据え置き）か。純 SQL・Go 非依存で完結しているか。
- [ ] `dbtest.Setup` が 000022 を含む全マイグレ適用後に**全既存テスト通過**するか。
- [ ] 既存マイグレ（編集禁止）を改変していないか。連番 000022（M16-03 の 000021 の後）か。
- [ ] 移行が**専用 fixtures**（dev DB 非依存）で検証されているか（M14-6・dev DB 流用禁止）。

---

## 3. データ層・API の整合（指示書 §4・code-facts §8/§9）

- [ ] `ModifierType` から dash 除去後に `go build`/`go vet` が通り、dash を参照する残コードが無いか。
- [ ] `CalcRecipeHash(steps)` が移行後 steps で新 recipe_hash を返し、**移行が recipe_hash を変える**ことがテストで示されているか。
- [ ] `DuplicateKey`（6 フィールド）＋recipe_hash の dup 判定が **CRUD 経路**で移行後 published に期待どおり働くか（現行 fixtures で衝突 0 件）。**マイグレに dup 検出が無い**ことを確認。
- [ ] 新規 dash 入力（3 経路）が system move dash へ解決される（M15-03 非回帰）か。

---

## 4. テストの妥当性（ケース数で確認。指示書 §5 ↔ §7 DoD）

### 4.1 Go

- [ ] マイグレ up（純 SQL・transform・移行先不在 skip）／down（逆写像・skip 据え置き）を専用 fixtures で assert。
- [ ] recipe_hash（都度計算）が移行後 steps の値になる／**マイグレに `RecomputeComboCache`・dup 検出が無い**ことを確認。
- [ ] `ModifierType` から dash 除去後のビルド・残参照なし。dup 非回帰（現行 fixtures 衝突 0）。

### 4.2 FE（Vitest / tsc）

- [ ] `labels.ts`/`ModifiersEditor` から dash 消失後に tsc/ビルド通過（型エラーなし）。
- [ ] `ModifiersEditor` に dash 選択肢なし。`RecipeBuilder`/`SetupRecipeEditor` の dash 重複解消（system move optgroup のみ）。
- [ ] 新規 dash 入力が system move dash へ（M15-03 非回帰）。

### 4.3 E2E / 手順書

- [ ] 既存 `modifiers.type` dash コンボ（fixtures）が移行後に system move dash として詳細/一覧/比較で表示（既定プリセットは alias 経由で「前ダッシュ/後ろダッシュ」表示・regen 不要）。
- [ ] `ModifiersEditor` に dash 選択肢が無い（再混入不能）。
- [ ] M13 CSV export/import が dash 一本化後も往復成立（意味単位 move_code ベース）。

---

## 5. 設計意図との整合（精神の確認）

- [ ] **「1入力=1move の一本化」**: dash が system move に一本化され、`modifiers.type` の二重表現が消えた（DES-004 §2.1・L-M15-3-3 の解消）。
- [ ] **「再混入経路の遮断」**: `ModifiersEditor`・2 optgroup 重複まで塞ぎ、新規に `modifiers.type` dash を作れない。
- [ ] **「user DB 保護＝transform」**: 既存 dash を削除でなく移行し、移行先不在は無損失 skip、出荷物に dev 固有 id を焼き込まない。
- [ ] **「レシピ同一性の保全」**: recipe_hash は都度計算で移行後に変わるが、dup は CRUD 時強制・配布は M14-03b remap がスキャン＝**マイグレに検出/regen を積まず**データ喪失なし（現行 0 件）。

---

## 6. コード品質・規約遵守

- [ ] 曖昧語（「適切に」「必要に応じて」）依存でない。`console.log`/`fmt.Println` 残置なし。簡体字なし。
- [ ] `modifiers.type` dash 全接地経路 grep 結果（波及網羅・**system move dash と内部識別子を巻き込まない対象限定**の確証）が完了報告にあるか（指示書 §3.4-1）。
- [ ] 画面のユーザー向け dash 表示語が DES-005 と突合されているか（内部 code `dash_*` は不変）。

---

## 7. 既存挙動の温存（非破壊性）

- [ ] `parry_drive_rush`/`cancel_drive_rush`・system move dash（移行先）が不変か。
- [ ] ゲージ始動/消費列（M16-01/02）・起き攻め `combo_oki_options`（M16-03）・`knockdown_advantage`・他 combos 列が不変か。
- [ ] M13 CSV export/import・重複判定（VAL-C02）・recipe_cache（既定プリセット表示は不変・非既定は次回編集で self-heal）が壊れていないか。
- [ ] 新規 dash 入力（3 経路）の system move 解決が不変（M15-03 非回帰）か。

---

## 8. ドキュメント・進捗ログ

- [ ] 完了報告に Plan Mode 確定方式（8 項目）・移行結果（transform/skip/dup 件数）・alias 実査結果・既知の制約（down 損失＝skip 据え置き・移行先不在）が含まれるか。
- [ ] DES-004 §2.1/§2.3・DES-003 §3.5・SUPP-001 §3.3.3 への CHANGE-064 見込みを**設計担当への伝達メモ**で申し送っているか。

---

## 9. 重大な問題の判定基準（完了承認を妨げる）

- Plan Mode 8 項目（§3.4）のいずれかが未確認のまま実装されている（推測実装）。
- **承認ゲート G-i の着手前承認を経ずにマイグレ実装している**。
- **`modifiers.type` dash の消費箇所を取りこぼしている**（model/labels.ts/ModifiersEditor/RecipeBuilder/SetupRecipeEditor/VAL のいずれか＝再混入 or コンパイル不能）。
- **system move dash（`move.code`）or 内部識別子（`uses_dr`/`_dr`）を誤って撤去・改変している**（接頭辞/部分一致の巻き込み）。
- **移行が transform でなく削除になっている**（user DB 保護違反）。または**移行先不在を skip＋一覧でなくエラー/データ喪失にしている**。
- **出荷マイグレに dev 固有 combo id（#91 等）を直書きしている**。
- **マイグレに in-migration dup 検出を実装した**（責務は M14-03b remap／CRUD 時。マイグレは純 SQL の transform＋skip のみ）。
- **マイグレで `RecomputeComboCache` を呼んだ**（既定プリセット表示安定で regen 不要。alias 無い場合の SQL INSERT を除く）。
- recipe_hash 波及を実コードで裏取りせず想定で扱っている。down が逆写像になっていない。
- `dbtest.Setup` で既存テストを壊す。FK=OFF と明示 DELETE 同居。既存マイグレ改変。dev DB 実データにテストが依存。
- 製造担当が DES 本体を直接編集。

## 10. 軽微な問題の判定基準（持ち越し許容）

- マイグレ DML の具体書法（step 書換 vs 置換・既存規約に沿う範囲）。
- skip 一覧・移行ログの出力書式。
- 2 optgroup 整理後のプルダウン表示細部（重複が解消されていれば）。

## 11. 質問・確認事項のフォーマット

- 「指示書 §X.X / DES-00N（実パス）§Y / code-facts §Z / RESEARCH §W に対し実装が V。意図確認したい」の形で根拠節を併記。移行先不在が想定外に多い・dup 衝突発生・alias 実査で想定外の場合は状況を明記して照会。

## 12. レビュー完了の判定

- §1〜§8 が全て OK、§9 重大ゼロ（**特に dash 全接地経路・transform/skip の 2 分岐・dup/cache のマイグレ非搭載・system move dash 非巻き込み・出荷マイグレ非直書き**）、§0.1 の Plan Mode 着手前確認（8 項目）が揃っている。§10 軽微は持ち越し可。

---

*以上、M16-04 レビューチェックリスト v1.0.0。配置 `docs/instructions/phase3/reviews/M16-04-review-checklist.md`。指示書 v1.0.0 と対。**dash 全消費経路の撤去（再混入遮断）・既存データの transform/skip（純 SQL）・dup 検出と recipe_cache regen をマイグレに積まない（M14-03b remap／CRUD 時／表示安定）・system move dash と内部識別子の非巻き込み・出荷マイグレへの dev 固有 id 非直書き**を最重要ゲートとする。承認ゲート G-i の着手前承認を確認すること。*
