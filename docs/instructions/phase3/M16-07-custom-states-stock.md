# 指示書 M16-07: int custom_states（ストック系）の始動最低/終了 2 値化＋増減表示（FB⑬ 深掘り）

| 項目 | 内容 |
|------|------|
| 指示書ID | M16-07 |
| マイルストーン | M16（データモデル拡充・スキーマの継ぎ目）。**M16 末尾を M16-06→M16-07 へ延長**（開発者承認 2026-07-08） |
| バージョン | 1.0.0 |
| 作成者・作成日 | 設計担当 Claude（フェーズ3 継続担当・M16 期）/ 2026-07-08 |
| 実装モデル | **Opus 4.8 ＋ Plan Mode 必須**（データモデル・UX・正しさ）/ レビュー Sonnet 4.6（model-allocation v1.29.0） |
| 承認ゲート | **データモデル判断ゲート（着手前承認・G-i 隣接型）**。破壊的 DDL マイグレはないが、custom_states の値表現（1→2 値）と def 拡張を伴うため着手前に開発者承認を得る |
| 上位文書 | M16-overview v1.2.6 §4.9・§3 サブ表 M16-07 |
| 関連 | followup §A FB⑬／architecture-patterns §9.1（custom_states・B-1 据え置き）／DES-003 §3.2/§3.4（custom_states 構造）／DES-005 §5.6/§5.7/§5.8/§5.13（custom_states 表示・CHANGE-040）／CHANGE-040（M11 situation 機能化）／M16-02（drive/SA 始動/消費＝本サブの drive/SA 版先例）／M16-06（en 境界・A-3 始動明示） |
| 前提（重要） | **situation は opaque JSON（BE 素通し `situation *string`）＝2 値化はスキーマ/DTO/BE 変更なし・FE 整形のみ**。situation は `recipe_hash`（steps）・`DuplicateKey`（6 フィールド）**いずれにも非対象＝dup/recipe 非波及**。**モデル＋Ingrid（唯一の testable）を実装、他 4 キャラは def フラグのみ・E2E は M14-03b 連動で後回し** |

> **文書ID ⇄ 実パスの正は `docs/handover/docs-map.md`（自動生成）**。本書は docs-map 準拠の実パスを併記する。

## 更新履歴

| 版 | 更新日 | 更新内容 |
|----|--------|----------|
| 1.0.0 | 2026-07-08 | 初版。int custom_states の始動最低/終了 2 値化＋増減（`show_delta` 時）＋明示ラベル。situation 構造化（スキーマ変更なし）・DEF `show_delta` フラグ・Ingrid 実装＋4 キャラ def フラグのみ。 |

---

## 1. 背景と目的

### 1.1 背景

FB⑬「サンシンボル等の始動ゲージ明示」の深掘り。int 型 custom_states（キャラ固有ストック・例 Ingrid の `sun_crest`〔0〜4〕）を持つキャラで、現状は当該状態の項目を **1 つ**しか出しておらず何を表すか不明。drive/SA ゲージの始動明示は M16-02（①）・M16-06（A-3）で達成したが、custom_states ストックは別データ体系（`combos.situation` の `custom_states` キー）で未達＝本サブで対応する。architecture-patterns §9.1 の B-1「一般 custom_states 消費モデル化＝据え置き」の**限定的再開**（表示用の 2 値＋派生増減のみ・消費セマンティクスの一般構築はしない）。

### 1.2 目的（開発者確定 2026-07-08）

- int custom_states を **①始動時に必要な最低ストック数／②終了時ストック数**の **2 値**で保持・表示。
- **③ストック増減＝②−①（符号付き・FE 自動計算）**。③は **`show_delta` フラグが立つ state のみ表示**（Ingrid=方向可変=表示／Mai・Lily・Juri・Kimberly=一方向=非表示）。
- 各項目に**明示ラベル**（name_ja/en＋固定文字列で生成）。総称「ストック」・**初版ラベルは仮**（開発者が出力を見て修正指示する）。

### 1.3 このサブで作らないもの（スコープ外）

- **スキーマ/DTO/BE の変更**（situation は opaque JSON・FE 整形）。**消費セマンティクスの一般構築**（架構 §9.1・B-1 据え置き＝コンボ中の逐次減少・技可用性連動・バリデーション連動はしない。本サブは「開始最低・終了・増減」の**表示用 2 値**のみ）。
- **他 4 キャラ（Mai/Lily/Juri/Kimberly）の E2E**（def フラグ設定のみ・実データ E2E は M14-03b 全キャラ seed 連動で後回し）。
- drive/SA ゲージ（M16-02 済）・flag 型 custom_states（トグル・不変）。

### 1.4 前提（確定事項・ガードレール）

- **格納**: per-combo 値は `combos.situation` の `custom_states` キー。int state は **`{"<code>": {"start_min": n, "end": m}}` 構造化**で保持（現状スカラ `{"<code>": n}` からの整形）。**スキーマ/DTO/BE 変更なし・situation は BE 素通し**。
- **DEF**: `characters.custom_states` の int state def に **`show_delta: true/false`** を追加（Ingrid=true・他 4 キャラ=false）。ラベルは name＋固定句生成＝DEF に 2 値項目は足さない。
- **増減**: ③＝②−①（正=増・負=減・符号付き）。`show_delta=true` の state のみ表示。
- **移行**: 既存 situation.custom_states スカラは dev-disposable（int 実データは Ingrid のみ）＝最小移行（既存スカラは②へ写像 or クリア＋Ingrid 手動再入力・他 4 キャラは対象なし）。
- **en 境界（M16-06 準拠）**: en ラベルは i18n サーフェス（詳細/比較）のみ・エクスポート/入力欄は ja。
- **dup/recipe 非対象**: situation は `DuplicateKey`・`recipe_hash` いずれにも非対象＝波及なし（Plan Mode で実コード確認）。

---

## 2. 成果物

### 2.1 作成・修正するファイル（code-facts 由来の想定接地点・**Plan Mode で全数確認**）

- **DEF/seed**: `characters.custom_states` の Ingrid `sun_crest` def に `show_delta: true` を追加（既存 seed は編集禁止のため**新規マイグレ 000023 で JSON patch** or seed 追補。他 4 キャラは def フラグのみ＝seed 状況次第で本サブ or M14-03b）。
- **FE editor**（`ComboEditorBasicFields.tsx`・custom_states 入力）: int state の入力を **1→2**（①start_min ②end。min/max 尊重・既存 int 入力方式踏襲）。`show_delta` 時は③を calc 表示（入力でなく）。
- **FE 値整形**（situation 構築）: int state 値を **構造化 `{start_min, end}`** で situation.custom_states へ格納。読取り時に旧スカラを graceful に扱う（移行）。
- **FE ラベル生成**（`customStates.ts` 等・SSOT）: name_ja/en＋固定句で ①②③ ラベルを生成（総称「ストック」・M16-06 の en 境界準拠）。
- **FE display**（詳細 §5.6・比較 §5.8・エクスポート §5.13）: int state を ①②（③）の明示ラベルで表示（現状 1 項目→2〜3 項目）。
- **DES 反映（CHANGE-067 見込み）**: DES-003 §3.2（def `show_delta`・custom_states int の 2 値表現）／DES-005 §5.6/§5.7/§5.8/§5.13／DES-006（2 int 検証・要否）＝設計担当が起票（製造は DES 直接編集しない・伝達メモで申し送り）。

### 2.2 変更しないもの

- スキーマ/DB/API/DTO/CSV 契約（situation opaque・BE 素通し）。`recipe_hash`・`DuplicateKey`・recipe_cache（situation 非対象）。
- flag 型 custom_states（トグル・不変）。drive/SA ゲージ（M16-02）。消費セマンティクスの一般構築（B-1 据え置き）。
- 他 4 キャラの E2E（def フラグのみ・M14-03b 連動）。

### 2.3 例外条項

- code-facts と実コードに差があれば実コードを正・完了報告に記録。

---

## 3. 前提条件

### 3.1 必読

- M16-overview v1.2.6 §4.9・§3。architecture-patterns §9.1（custom_states・B-1）。DES-003 §3.2/§3.4（custom_states 構造・combos.situation）。DES-005 §5.6/§5.7（custom_states 表示・入力・CHANGE-040）・§5.8/§5.13。code-facts（`Combo.Situation`・`ComboEditorBasicFields`・`customStates.ts`・`CustomStateDef`・seed 000015）。M16-02（drive/SA 始動/消費の先例）・M16-06（en 境界）。retrospective-digest §4（表示トークンの全箇所調査）・§7（ラベル SSOT）。

### 3.2 前提事実（実ファイルで確認・Plan Mode 再確認）

- `combos.situation` = TEXT（opaque JSON）・`Combo.Situation *string`・DTO は生文字列素通し。per-combo custom_states 値は situation JSON の `custom_states` キー（現状スカラ map）。
- `characters.custom_states` = JSON（DEF・code/name_ja/name_en/subject/type/value_definition{integer,min,max}）。seed 000015 系。
- int custom_state 値は現状 1 値（開始時数値・CHANGE-040）。
- situation は `DuplicateKey`（6 フィールド）・`recipe_hash`（steps）に非対象。
- 対象 5 キャラ: Ingrid（`sun_crest`・唯一の testable・増減必須）／Mai/Lily/Juri/Kimberly（増減不要・E2E 後回し）。

### 3.3 参照不要

- drive/SA（M16-02）・M17 以降・消費セマンティクス一般化（B-1）。

### 3.4 着手前の確認（Plan Mode 必須。§9.4 と対応）

1. **situation.custom_states の現状 read/write path**: FE がどこで situation JSON を構築/解釈するか全列挙。スカラ→構造化 `{start_min, end}` への整形点と、BE が素通し（`situation *string`・スキーマ/DTO 不変）であることを確認。
2. **`show_delta` def 追加の技法**: Ingrid `sun_crest` def への `show_delta:true` 追加を、**新規マイグレ 000023 の JSON patch** で行うか seed 追補か（既存マイグレ編集禁止）。他 4 キャラの def が現状 seed 済みか未 seed か実査し、未 seed 分は M14-03b 契約へ委譲。
3. **ラベル生成（SSOT・i18n 境界）**: name_ja/en＋固定句で ①②③ を生成する SSOT 集約点。i18n サーフェス（詳細/比較）は en 化・エクスポート/入力欄は ja（M16-06 境界）。総称「ストック」で仮ラベルを生成。
4. **③増減 calc**: ②−① の符号付き計算・`show_delta=true` の state のみ表示（入力でなく派生表示）。
5. **editor 1→2 int 入力**: 既存 int 入力方式（min/max 尊重・`-`/`e`/`.` 不可）を踏襲し ①② を並置。`show_delta` 時③を calc 表示。
6. **display surfaces**: 詳細（§5.6）・比較（§5.8）・エクスポート（§5.13）で int state を ①②（③）の明示ラベルへ（現状 1 項目からの拡張）。
7. **移行**: 既存 situation.custom_states スカラ値の graceful 読取り（旧スカラ→②へ写像 or 表示可能に）。dev-disposable（Ingrid のみ・他 4 キャラ対象なし）。
8. **dup/recipe/BE 非波及**: situation が `DuplicateKey`・`recipe_hash`・recipe_cache・BE 検証に非対象で、本変更が波及しないことを実コードで確認。
9. **5 キャラ def の全数確認**: 5 キャラの int state def を実 seed で全数列挙（複数 int state を持つキャラの有無・min/max）。

---

## 4. 詳細仕様

### 4.1 situation 値の 2 値化（構造化・FE 整形）

- int state 値を `{"<code>": {"start_min": n, "end": m}}` で situation.custom_states に格納。**スキーマ/DTO/BE 不変**（situation 素通し）。旧スカラ `{"<code>": n}` は移行（§4.7）で graceful に扱う。

### 4.2 DEF `show_delta` 追加

- `characters.custom_states` の int state def に `show_delta: true/false`（Ingrid=true・他=false）。マイグレ 000023 JSON patch or seed（§3.4-2 で確定）。DES-003 §3.2 拡張。

### 4.3 ラベル生成（name＋固定句・SSOT）

- ①「{name}：始動時に必要な最低のストック数」②「{name}：終了時のストック数」③「{name}：ストック増減」（総称「ストック」・**仮**）。en は name_en＋en 固定句（i18n サーフェスのみ）。SSOT へ集約。

### 4.4 ③増減の自動計算

- ③＝②end −①start_min（正=増・負=減・符号付き）。`show_delta=true` の state のみ表示（入力でなく派生）。

### 4.5 editor（1→2 int 入力）

- int state 入力を①②の 2 欄に（min/max 尊重・既存方式）。`show_delta` 時③を calc 表示。flag 型は不変。

### 4.6 display（詳細/比較/エクスポート）

- int state を①②（③）の明示ラベルで表示。現状 1 項目→2〜3 項目。詳細 §5.6・比較 §5.8・エクスポート §5.13。

### 4.7 移行（最小）

- 既存 situation.custom_states スカラ値を graceful に読取り（旧スカラ→②へ写像 or 表示）。int 実データは Ingrid のみ（dev-disposable）＝Ingrid は手動再入力可・他 4 キャラは対象なし。

---

## 5. テスト要件（ケース数で語る。§7 DoD と対応）

### 5.1 FE（Vitest / tsc）

- situation 値が構造化 `{start_min, end}` で往復（save/load）。旧スカラの graceful 読取り。
- ①② editor 入力（min/max・整数）が situation に乗る。`show_delta=true`（Ingrid）で③calc 表示・`false`（他）で非表示。
- ラベル（name＋固定句・ja/en 境界）が①②③に反映。詳細/比較/エクスポートに①②（③）表示。
- dup 非回帰（situation 変更が `DuplicateKey`・recipe_hash に非波及）。

### 5.2 Ingrid E2E（唯一の testable）

- Ingrid コンボで①②入力→保存→詳細/比較で①②③表示・エクスポートに出る。移行（既存スカラ）が破綻しない。

### 5.3 記録

- situation read/write path・show_delta def 追加技法（000023 or seed）・5 キャラ def 実査・dup/recipe 非波及の確認結果・**他 4 キャラ E2E 後回し（M14-03b 連動）**を完了報告に。

---

## 6. レビュー観点（別ファイル参照）

`docs/instructions/phase3/reviews/M16-07-review-checklist.md` を参照。

## 7. 完了条件（DoD）

### 7.1 機能要件

- int custom_states が①始動最低/②終了の 2 値で保持・表示され、③増減が `show_delta` 時に FE 計算表示。各項目に明示ラベル。situation opaque・スキーマ/DTO/BE 不変・dup/recipe 非波及。
- Ingrid が実装・testable。他 4 キャラは def フラグのみ（E2E は M14-03b 連動）。消費セマンティクス一般構築なし（B-1 据え置き）。

### 7.2 自己テスト

- §5 をケース数で報告。移行 graceful・dup 非回帰・show_delta 分岐を明記。

### 7.3 品質

- situation/custom_states の全 read/write・ラベル全箇所 grep（SSOT）。禁則表現・簡体字・「DR」略記なし。

### 7.4 ドキュメント

- Plan Mode 確定方式（9 項目）・show_delta 追加技法・5 キャラ def 実査・他 4 キャラ E2E 後回しを完了報告に。DES-003 §3.2・DES-005 §5.6/§5.7/§5.8/§5.13・DES-006 の CHANGE-067 見込みを設計担当への伝達メモで申し送り。

## 8. 参照ドキュメント

- M16-overview v1.2.6 §4.9／architecture-patterns §9.1／DES-003 §3.2/§3.4／DES-005 §5.6/§5.7/§5.8/§5.13／code-facts（Situation・ComboEditorBasicFields・customStates.ts・CustomStateDef・seed 000015）／M16-02／M16-06／retrospective-digest §4/§7。

## 9. 注意事項・判断に迷ったら

### 9.1 推測で進めてはいけない事項

- **situation.custom_states の read/write 全経路**（§3.4-1・整形漏れ）。**BE 素通し・スキーマ/DTO 不変**の確認。
- **`show_delta` def 追加技法**（§3.4-2・既存マイグレ編集禁止・000023 or seed）。
- **dup/recipe/BE 非波及**（§3.4-8・situation が非対象であること）。
- **移行の graceful**（§3.4-7・旧スカラを壊さない）。

### 9.2 推測で進めてよい事項（明示）

- ラベル SSOT の集約先ファイル（既存規約）。仮ラベルの固定句（開発者が後で修正指示）。

### 9.3 不明事項発見時

- situation が `DuplicateKey`/`recipe_hash` に実は関与している疑い／5 キャラの def が想定と異なる（複数 int state・未 seed）／既存スカラ移行が Ingrid 以外にも実データを持つ＝設計担当へ差し戻し。

### 9.4 Plan Mode 提示項目

- §3.4 の 9 項目すべて。

## 10. 完了後の次ステップ

- 完了報告（伝達メモ）→ 設計担当が **CHANGE-067 三点セット**（DES-003 §3.2・DES-005 §5.6/§5.7/§5.8/§5.13〔・DES-006〕）を起票。overview §3/§4.9 as-built・registry 067・followup（4 キャラ E2E＝M14-03b 連動）も同トランザクション。
- **M16-07 完了で M16 全工程が締まる** → retrospective-log 転記（一時ノート C-1〜C-5）→ 開発者が `/retrospective-digest-update`。→ M14-03b（配布 blocker・M16-04/05/07 の seed 契約）／M17。

---

*以上、指示書 M16-07 v1.0.0。配置 `docs/instructions/phase3/M16-07-custom-states-stock.md`。対のレビューは `docs/instructions/phase3/reviews/M16-07-review-checklist.md`。situation opaque＝スキーマ/DTO/BE 変更なし・dup/recipe 非波及。int custom_states を①始動最低/②終了 2 値化＋③増減（show_delta 時）＋明示ラベル。DEF に show_delta フラグ（Ingrid=true）。モデル＋Ingrid 実装・他 4 キャラ def フラグのみで E2E は M14-03b 連動。消費セマンティクス一般構築なし（B-1 据え置き）。ラベル初版は仮。*
