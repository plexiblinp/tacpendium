# 指示書 M16-03: 起き攻めの正規化（`combo_oki_options` 新設＋シミー 4 区分化＋打撃重ね・G-h）

| 項目 | 内容 |
|------|------|
| 指示書ID | M16-03 |
| マイルストーン | M16（データモデル拡充・スキーマの継ぎ目・§6 承認ゲート） |
| バージョン | 1.0.0 |
| 作成者・作成日 | 設計担当 Claude（フェーズ3 継続担当・M16 期）/ 2026-07-05 |
| 実装モデル | **Opus 4.8 ＋ Plan Mode 必須** / レビュー Sonnet 4.6（model-allocation v1.29.0） |
| 承認ゲート | **G-h**（phase3-overview v1.1.2 §2.4）＝**着手前に開発者の個別承認を得てからマイグレ実装に入る** |
| 上位文書 | M16-overview v1.2.0（`docs/instructions/phase3/M16-overview.md`）§2.1/§4.3/§6 |
| 関連 | phase3-overview v1.1.2 §2.4 G-h / §M16 ③ / combmgr-friend-feedback-datamodel-issues 論点③ / DES-003 §3.4（起き攻め 6 bool・将来正規化の予見）/ DES-002 §7.6（CSV 任意列＝CHANGE-061 の後方互換パターン）/ M15-01（test-id `combo-editor-okiMeaty*`） |
| **前提（重要）** | **実装前に friend 語彙棚卸し**（上位1%・pressure-sequence 設計と同席）で attack_type/tech_type/uses_dr 語彙を確定すること。本書の語彙は overview 骨子＋開発者確定（シミー 4 区分・2026-07-05）に基づく**ベースライン**。棚卸しで細分（例 打撃重ねの下位分類）が加わる場合は着手前に本書 §4 の語彙を更新する（§確認事項1） |

> **文書ID ⇄ 実パスの正は `docs/handover/docs-map.md`（自動生成）**。本書は docs-map 準拠の実パスを併記する。

## 更新履歴

| 版 | 更新日 | 更新内容 |
|----|--------|----------|
| 1.0.0 | 2026-07-05 | 初版。起き攻め 6 bool を `combo_oki_options` へ正規化＋シミー 4 区分化＋打撃重ね追加。 |

---

## 1. 背景と目的

### 1.1 背景

本サブ **M16-03（ゲート G-h）** は datamodel-issues 論点③に対応する。

- 現状、起き攻め情報は combos の **6 個の bool**（`oki_meaty_neutral_tech_throw` / `_dr` / `oki_meaty_back_tech_throw` / `_dr` / `oki_shimmy_neutral_tech` / `oki_shimmy_back_tech`）＋ `knockdown_advantage`（INTEGER）で**平置き**されている。**DES-003 §3.4 自身が将来 `combo_oki_options` への正規化を予見**している。
- この平置きは **非対称**を抱える: **投げ重ねには ドライブラッシュ 有無があるのにシミーには無い**（シミーがノーゲージかドライブラッシュか区別できない）。かつ **打撃重ね（strike meaty）が丸ごと欠落**（friend FB #12）。
- 本サブは 6 bool を正規化テーブル `combo_oki_options` へ移し、**シミーを 4 区分化**（`uses_dr` を全 attack_type に一様適用）し、**打撃重ねを追加**する。**既存 6 bool は決定論的に backfill**（開発者確定＝既存シミーはドライブラッシュなし）。
- **起き攻めは FR301 dup キー・recipe（レシピ文字列）非対象**（M16-RESEARCH-01 で dup キー＝character/starter/position/stance/hitType/size＋`CalcRecipeHash(steps)` を実測確認。起き攻めは steps に含まれない）。**recipe_hash 不変・dup 非波及**。blast radius は表示/editor/DTO/CSV に閉じる。

### 1.2 目的

- 正規化テーブル **`combo_oki_options`** を新設し、**6 bool を行へ決定論 backfill** → **6 bool 列を DROP** するマイグレ（**000021**）を作成。
- **シミー 4 区分化**（その場×ノーゲージ／後ろ×ノーゲージ／その場×ドライブラッシュ／後ろ×ドライブラッシュ）＋**打撃重ね追加**。
- データ層（DTO/repository）・editor UI（6 チェックボックス → 正規化オプション UI）・詳細/比較/出力表示・CSV 往復（後方互換）を追従する。`knockdown_advantage` は combos に残置。

### 1.3 このマイルストーンで作らないもの（スコープ外）

- **① 消費列・② drive 型・④ taxonomy/dash**（M16-02/01/04）。
- **`knockdown_advantage` の変更**（combos に残置・不変）。
- **起き攻めを dup キー/recipe に含める**こと（**非対象を維持**）。
- **pressure-sequence（連携技）本体の実装**（語彙棚卸しで同席するが実装は将来サブ）。
- 語彙の独断拡張（打撃重ねの下位分類等は friend 棚卸しで確定＝§確認事項1）。

---

## 2. 成果物

### 2.1 作成するファイル

- `migrations/000021_normalize_combo_oki_options.up.sql` / `.down.sql`（命名は既存連番規約。実配置は code-facts §10。**M16-02 の 000020 の後**）。

### 2.2 修正するファイル（code-facts 由来の想定接地点・**Plan Mode で全数確認**）

- **DDL/マイグレ**: `combo_oki_options` 新設 → 6 bool を行へ backfill → 6 bool 列 DROP。
- **Go model**（`internal/model/combo.go`）: `Combo` の 6 bool フィールドを撤去し、**起き攻めオプションのスライス**（例 `OkiOptions []OkiOption`・`OkiOption{TechType, AttackType, Usesドライブラッシュ, Available}`）に置換。`KnockdownAdvantage` は残置。
- **Go DTO**（`internal/api/combo/dto.go`）: `ComboResponse`/`CreateRequest`/`UpdateMetadataRequest` の 6 bool を**オプション配列**へ置換（DTO の JSON 形＝Plan Mode で確定・§確認事項2）。
- **Go repository**: `combo_oki_options` の SELECT（combo 取得時に JOIN or 別クエリ）／INSERT・UPDATE（combo 作成/更新時にオプション行を差し替え）。**`DuplicateKey` は不変**（起き攻めは dup 非対象）。**`RecomputeComboCache` は起き攻め非依存**のため呼ばなくてよい（recipe 非対象）＝念のため Plan Mode で確認。
- **FE 型**: combo 型（`web/src/features/combo/types.ts` 等）の 6 bool をオプション配列へ（3 型＝ComboSummary/ComboDetail/Combo）。
- **FE editor UI**（DES-005 §5.7）: 6 チェックボックス → **正規化オプション UI**（attack_type × tech_type × uses_dr）。シミーに**ドライブラッシュ切替**、**打撃重ね**を追加。**画面ラベルは「ドライブラッシュ」正式名称・「DR」略記不可**（DES-005 §5.6 正典）。test-id は既存 `combo-editor-<field>` 規約を grep 実値で再設計（製造裁量）。
- **FE 表示**: 詳細（§5.6）・比較（§5.8）・出力（§5.13）の起き攻め表示を新構造へ（シミー ドライブラッシュ 行・打撃重ね行の増加）。
- **CSV export/import**（`comboio`）: 起き攻めの往復（後方互換＝§4.4）。

### 2.3 変更しないもの（原則）

- `knockdown_advantage`（combos 残置・不変）。
- `DuplicateKey`・VAL-C02・recipe_cache（起き攻めは dup/recipe 非対象＝回帰確認のみ）。
- 他 combos 列（ゲージ始動/消費・drive_damage 等）。

### 2.4 例外条項

- code-facts と実コードに差があれば**実コードを正**とし、相違を完了報告に記録。

---

## 3. 前提条件

### 3.1 必読ドキュメント

- M16-overview v1.2.0 §2.1/§4.3/§6。
- DES-003 §3.4 combos（起き攻め 6 bool・`knockdown_advantage`・**将来 `combo_oki_options(combo_id, tech_type, attack_type, uses_dr, available)` への正規化を検討**の記述）。
- DES-005 §5.6（詳細・起き攻め正典語彙）・§5.7（editor 起き攻めチェックボックス・折りたたみ）・§5.8（比較の起き攻め行＝現状シミー非対称）・§5.13（出力の起き攻め行展開）。
- DES-002 §7.6（**CSV 任意列＝CHANGE-061 の後方互換パターン**。新規オプション列は任意列として列末尾追加）。
- DES-006 VAL-C11（起き攻め BOOLEAN 整合性検証＝正規化後の整合〔available/uses_dr〕の扱いを判断）。
- code-facts §8 model（`Combo` の 6 oki bool・`KnockdownAdvantage`）/ §7-2 DTO / §9 repository（`DuplicateKey`・combo の INSERT/SELECT）/ §10 マイグレ（最新 000020／本サブ 000021・SQLite 版）。
- M16-RESEARCH-01 report（dup キー＝`CalcRecipeHash(steps)`＋DuplicateCheckFields・起き攻め非対象の裏付け）。
- retrospective-digest §1-A（論理型≠物理宣言）・§4（表示トークン変更は全表示箇所調査）・§5（破壊的マイグレ × `dbtest.Setup`・down 整合・FK=OFF×明示 DELETE 非同居）。

### 3.2 前提事実（実ファイルで確認済み・Plan Mode で再確認）

- **現状 6 bool**（code-facts §8・DES-003 §3.4）: `oki_meaty_neutral_tech_throw` / `oki_meaty_neutral_tech_throw_dr` / `oki_meaty_back_tech_throw` / `oki_meaty_back_tech_throw_dr` / `oki_shimmy_neutral_tech` / `oki_shimmy_back_tech`（各 `*bool`）＋ `knockdown_advantage`（`*int`）。
- **正規化案**（DES-003 §3.4・#21）: `combo_oki_options(combo_id, tech_type, attack_type, uses_dr, available)`。
- **語彙ベースライン**（overview §4.3・開発者確定）: `attack_type` ∈ {**投げ重ね `throw_meaty` / シミー `shimmy` / 打撃重ね `strike_meaty`**}（打撃重ねが新規）・`tech_type` ∈ {その場受け身 `neutral_tech` / 後ろ受け身 `back_tech`}・`uses_dr` ∈ {ノーゲージ `false` / ドライブラッシュ `true`}。**`uses_dr` を全 attack_type に一様適用**（シミー 4 区分化の要）。
- **決定論 backfill**（開発者確定 2026-07-05）: 既存 `oki_shimmy_*_tech`=true は **ドライブラッシュなし（`uses_dr=false`）** を表す。よって 6 bool → 行の写像は一意（§4.1）。ドライブラッシュ版シミー・打撃重ねは新規（既存データなし）。
- **dup/recipe 非対象**（M16-RESEARCH-01・code-facts §9）: 起き攻めは `DuplicateKey`・`CalcRecipeHash(steps)` に含まれない。正規化で dup/recipe_hash は不変。
- **CSV 後方互換パターン**（DES-002 §7.6・CHANGE-061）: 新規列は「任意列として列末尾追加」で旧 CSV を壊さない。
- **マイグレ連番**: 最新 = 000020（M16-02）。本サブ = **000021**。

### 3.3 参照不要

- M16-01/02/04/05 の実装詳細・pressure-sequence 本体。

### 3.4 着手前の確認（Plan Mode 必須。§9.4 と対応）

以下 **8 項目**を Plan Mode で実コード確認のうえ計画提示すること。

1. **語彙の確定（friend 棚卸し）**: 本書 §3.2 の語彙ベースライン（throw_meaty/shimmy/strike_meaty × neutral_tech/back_tech × uses_dr）で確定か。打撃重ねの下位分類等の追加が棚卸しで出ていないか（出ていれば着手前に本書更新）。**棚卸し未実施なら着手前に開発者へ確認**（§確認事項1）。
2. **`combo_oki_options` スキーマと `available` の扱い**: PK/UNIQUE（例 `(combo_id, tech_type, attack_type, uses_dr)`）・FK（`combo_id` → combos・ON DELETE CASCADE）・**`available` を列として持つ（dense）か行存在で表す（sparse＝行があれば available）か**を確定（§確認事項2）。既存 combos の nullable 列の物理宣言も view（digest §1-A）。
3. **6 bool → 行の backfill 写像（決定論）**: §4.1 の写像で全既存行を移行。既存シミー → `uses_dr=false`。**backfill が全 combo を漏れなく変換**するか（6 bool が全 false の combo は行ゼロ）。
4. **6 bool 列の DROP と down の損失**: up で 6 bool 列 DROP。**down は行 → 6 bool へ逆写像するが、シミー ドライブラッシュ・打撃重ねの行は 6 bool に受け皿が無く down で失われる**（破壊的 down＝C-3 型）。down の損失範囲を明記。**FK=OFF と明示 DELETE を同一指示書に同居させない**（digest §5）。
5. **全接地経路 grep**: 6 bool（`oki_*`）を読む箇所を全数列挙（model/DTO/repository/FE 型/editor/詳細/比較/出力/CSV/VAL-C11）。オプション配列へ置換する波及を確定。
6. **CSV 後方互換**: 起き攻めを CSV でどう往復するか（**フラット列を維持し新オプションを任意列として列末尾追加** vs 別方式）を確定。**旧 CSV（6 起き攻め列）の import が成立**（既存 6 列 → 行へ写像）。新オプション（シミー ドライブラッシュ・打撃重ね）は任意列（DES-002 §7.6）。export は行 → フラット列へ。
7. **検証（VAL-C11）**: 起き攻め BOOLEAN 整合性検証（VAL-C11）を正規化後にどう扱うか（available/uses_dr の整合・不能な組合せの有無）。**起き攻めは dup/recipe 非対象**を維持。
8. **recipe_cache 非依存の確認**: 起き攻め変更で `RecomputeComboCache` を呼ぶ必要がないこと（起き攻めはレシピ文字列に出ない）を確認。呼んでいる箇所があれば真因を確認。

---

## 4. 詳細仕様

### 4.1 マイグレ 000021（正規化・決定論 backfill）

- **新設** `combo_oki_options`（`combo_id` FK → combos ON DELETE CASCADE・`tech_type`・`attack_type`・`uses_dr`・`available`〔dense/sparse は §3.4-2〕・UNIQUE `(combo_id, tech_type, attack_type, uses_dr)`）。
- **backfill（決定論・6 bool → 行）**:
  - `oki_meaty_neutral_tech_throw`=true → (`throw_meaty`, `neutral_tech`, `uses_dr=false`)
  - `oki_meaty_neutral_tech_throw_dr`=true → (`throw_meaty`, `neutral_tech`, `uses_dr=true`)
  - `oki_meaty_back_tech_throw`=true → (`throw_meaty`, `back_tech`, `uses_dr=false`)
  - `oki_meaty_back_tech_throw_dr`=true → (`throw_meaty`, `back_tech`, `uses_dr=true`)
  - `oki_shimmy_neutral_tech`=true → (`shimmy`, `neutral_tech`, `uses_dr=false`)（既存シミー＝ドライブラッシュなし・開発者確定）
  - `oki_shimmy_back_tech`=true → (`shimmy`, `back_tech`, `uses_dr=false`)
  - false の bool は行を作らない。ドライブラッシュ版シミー・打撃重ねは新規（既存データなし）。
- **6 bool 列 DROP**（段階可＝列 DROP は M14-01 前例）。`knockdown_advantage` は残置。
- **down**: 行 → 6 bool へ逆写像。**シミー ドライブラッシュ・打撃重ねの行は 6 bool に受け皿が無く down で失われる**（破壊的 down・完了報告と down コメントに明記）。`dbtest.Setup` 全テスト通過・down 整合。

### 4.2 データ層（model / DTO / repository）

- `model.Combo`: 6 bool → 起き攻めオプション配列（`OkiOptions []OkiOption`）。`KnockdownAdvantage` 残置。
- DTO（`ComboResponse`/`CreateRequest`/`UpdateMetadataRequest`）: 6 bool → オプション配列（JSON 形は §3.4-2）。
- repository: combo 取得で `combo_oki_options` を読み、作成/更新でオプション行を差し替え（combo に紐づく子行の入替）。`DuplicateKey` 不変。

### 4.3 editor UI（DES-005 §5.7）

- 6 チェックボックス → **正規化オプション UI**（attack_type〔投げ重ね/シミー/打撃重ね〕× tech_type〔その場/後ろ〕× uses_dr〔ノーゲージ/ドライブラッシュ〕）。**シミーにドライブラッシュ切替**・**打撃重ね**を追加。
- **画面ラベルは「ドライブラッシュ」正式名称**（DES-005 §5.6 正典・「DR」略記不可）。内部コード `uses_dr` は不変。
- test-id は既存規約を grep 実値で再設計（製造裁量・M15-01 の `combo-editor-okiMeaty*` は正規化で変わる）。

### 4.4 表示・CSV（DES-005 §5.6/§5.8/§5.13・DES-002 §7.6）

- 詳細（§5.6）・比較（§5.8）・出力（§5.13）の起き攻め表示を新構造へ。**比較のシミーにドライブラッシュ区分行**・**打撃重ね行**が増える（§5.8 の現状非対称を解消）。
- **CSV**: フラット起き攻め列を維持し、**新オプション（シミー ドライブラッシュ・打撃重ね）を任意列として列末尾追加**（DES-002 §7.6）。既存 6 起き攻め列 → 行への import 写像で**旧 CSV 後方互換**。export は行 → フラット列。

### 4.5 検証（DES-006 VAL-C11）

- 起き攻め整合性検証（VAL-C11）を正規化後の構造に追従（available/uses_dr の整合）。**dup/recipe 非対象を維持**。**起き攻めに範囲/保存ブロックの新規 VAL は足さない**（従来の整合性検証の範囲で）。

### 4.6 dup / recipe 非対象（回帰確認）

- `DuplicateKey`・`CalcRecipeHash(steps)`・recipe_cache に起き攻めは非関与（M16-RESEARCH-01 裏付け）。重複判定・レシピ表示の回帰のみ確認。

---

## 5. テスト要件（ケース数で語る。§7 DoD と対応）

### 5.1 Go テスト

- **マイグレ 000021**: up で `combo_oki_options` 新設・6 bool が行へ決定論 backfill（写像 6 通り・既存シミー→uses_dr=false）・6 bool 列 DROP。down で行→6 bool（**シミー ドライブラッシュ・打撃重ね行は失われる**ことを明示テスト）。`dbtest.Setup` 全テスト通過。
- **model/DTO/repository**: オプション配列の read/write・combo 作成/更新でオプション行の差し替え。打撃重ね・シミー ドライブラッシュ の保存/取得。
- **dup 非回帰**: CheckDuplicate が起き攻めに非依存（正規化前後で同一判定・recipe_hash 不変）。
- **VAL-C11**: 正規化後の整合性検証。

### 5.2 FE テスト（Vitest）

- editor で attack_type × tech_type × uses_dr のオプションを設定でき（シミーのドライブラッシュ・打撃重ね含む）PATCH に乗る。ラベルが「ドライブラッシュ」正式名称。
- 3 型に追従し型エラーなくビルド。詳細/比較/出力で新オプションが表示。

### 5.3 E2E / 手順書

- コンボ編集で起き攻めオプション（シミー×ドライブラッシュ・打撃重ね）を設定→保存→リロード反映。
- 比較でシミーのドライブラッシュ区分・打撃重ねが行として並ぶ。
- M13 CSV export/import が正規化後も往復成立・**旧 CSV（6 起き攻め列）の import も成立**（後方互換）。

---

## 6. レビュー観点（別ファイル参照）

`docs/instructions/phase3/reviews/M16-03-review-checklist.md` を参照。重大判定は §9。

---

## 7. 完了条件（Definition of Done）

### 7.1 機能要件

- 起き攻めが `combo_oki_options` へ正規化され、**シミーが 4 区分化**（ドライブラッシュ有無）・**打撃重ねが記録**でき、6 bool が決定論 backfill された。
- editor/詳細/比較/出力が新構造で動作し、比較の起き攻め非対称が解消。
- dup/recipe_cache・`knockdown_advantage`・他 combos 列が不変。
- CSV が新旧ともに往復成立（後方互換）。

### 7.2 自己テスト結果

- §5 の Go/FE/E2E をケース数で報告。`dbtest.Setup` 通過・down 整合（**down の損失範囲＝シミー ドライブラッシュ/打撃重ね**を明記）。

### 7.3 品質チェック

- 6 bool 全接地経路 grep 結果（波及網羅）＋ dup/recipe 非対象の確認結果を報告。**画面ラベルが「ドライブラッシュ」正式名称**（「DR」略記なし・DES-005 §5.6 突合）。禁則表現・簡体字なし。

### 7.4 ドキュメント

- Plan Mode 確定方式（8 項目）・テストケース数・既知の制約（down 損失・`available` dense/sparse 選択）を完了報告に。
- DES-003 §3.4（正規化）／DES-005 §5.6/§5.7/§5.8/§5.13（表示・editor）／DES-002 §7.6（CSV 任意列）／DES-006 VAL-C11 への CHANGE 見込みを**設計担当への伝達メモ**で申し送り（DES 反映は設計担当が起票）。

### 7.5 完了報告

- 上記＋ CHANGE 見込み（採番 062〜）の具体化点を伝達メモで申し送り。

---

## 8. 参照ドキュメント

- M16-overview v1.2.0 §4.3 / phase3-overview v1.1.2 §2.4 G-h / DES-003 §3.4 / DES-005 §5.6/§5.7/§5.8/§5.13 / DES-002 §7.6 / DES-006 VAL-C11 / code-facts §8/§7-2/§9/§10 / M16-RESEARCH-01 report / retrospective-digest §1-A/§4/§5 / datamodel-issues 論点③。

---

## 9. 注意事項・判断に迷ったら

### 9.1 推測で進めてはいけない事項

- **語彙**（friend 棚卸しの結果＝§3.4-1・§確認事項1）。棚卸し未確定のまま打撃重ねの下位分類等を独断で作らない。
- 6 bool → 行の backfill 写像（§4.1 の決定論写像を厳守・既存シミーは uses_dr=false）。
- 6 bool 全接地経路（§3.4-5 の grep 全列挙）。
- 起き攻めを **dup キー/recipe に入れない**（非対象を厳守）。

### 9.2 推測で進めてよい事項（その旨を明示）

- test-id 命名（既存 `combo-editor-<field>` 規約に沿う範囲・grep 確定）。
- editor オプション UI のレイアウト（過密回避・DES-005 §5.7 の折りたたみに沿う）。

### 9.3 不明事項発見時の対応

- 起き攻めを **dup/recipe_cache で読む箇所**を発見、or 語彙が棚卸し未確定、or `available` の dense/sparse で迷う場合は実装を止め、設計担当へ差し戻す。

### 9.4 Plan Mode で計画提示時に含めるべき項目

- §3.4 の 8 項目すべて（語彙確定 / スキーマ・available / backfill 写像 / down 損失 / 全接地経路 / CSV 後方互換 / VAL-C11 / recipe_cache 非依存）。

---

## 10. 完了後の次ステップ

- 完了報告を受けて設計担当が **CHANGE（062〜）** を起票（DES-003 §3.4 正規化・DES-005 §5.6/§5.7/§5.8/§5.13・DES-002 §7.6・DES-006 VAL-C11）。三点セットで反映。
- **M16-04（G-i＝taxonomy／移動 move 化／dash 一本化）** へ（M16-RESEARCH-01 の要決定事項 6 件をご判断後）。

---

*以上、指示書 M16-03 v1.0.0。配置 `docs/instructions/phase3/M16-03-normalize-oki-options.md`。対のレビューチェックリストは `docs/instructions/phase3/reviews/M16-03-review-checklist.md`。承認ゲート G-h＝マイグレ実装着手前に開発者の個別承認を得る。**実装前に friend 語彙棚卸しで語彙を確定**すること。起き攻めは dup/recipe 非対象＝recipe_hash 不変・blast radius は表示/editor/DTO/CSV に閉じる。既存 6 bool は決定論 backfill（既存シミー＝ドライブラッシュなし）。画面ラベルは「ドライブラッシュ」正式名称。*
