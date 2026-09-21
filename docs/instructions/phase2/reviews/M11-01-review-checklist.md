# M11-01 レビューチェックリスト v1.0.0

| 項目 | 内容 |
|------|------|
| 対象指示書 | `docs/instructions/M11-01-instruction.md` v1.1.0(custom_states 開始時状態の機能化=付与・表示・参照。フロント + seed マイグレーション + 軽微 BE〔PATCH への situation 加算〕) |
| 対象指示書ID | M11-01 |
| レビューモデル | Sonnet 4.6(model-allocation) |
| バージョン | 1.1.0 |
| 作成者・作成日 | 設計担当 Claude(フェーズ2 本流スパイン・M11 担当)/ 2026-06-20 |
| 関連 CHANGE | CHANGE-040(DES-005 v2.22.0 §5.6/§5.7 + DES-006 v1.12.0。反映済み)／ CHANGE-041(DES-002 v1.21.0 §4.2 PATCH に situation 追加。反映済み) |

## 更新履歴

| 版 | 更新日 | 更新内容 |
|----|--------|----------|
| 1.0.0 | 2026-06-20 | 初版(指示書 v1.0.0 と対)|
| 1.1.0 | 2026-06-20 | 指示書 v1.1.0(PATCH への situation 加算＝案1／CHANGE-041)と対。§0.1 前提ゲートに CHANGE-041、§1.3/§2 に PATCH 永続化、§4 にテスト追加、§5/§9 を更新 |

---

## 0. レビュー担当への前置き

### 0.1 レビュー前の準備
- 必読: `M11-01-instruction.md` v1.1.0、`docs/design/05-screen-design.md`(DES-005 **v2.22.0**)§5.6/§5.7、`docs/design/06-validation.md`(DES-006 **v1.12.0**)、`docs/design/02-architecture.md`(DES-002 **v1.21.0**)§4.2 PATCH、`docs/design/03-data-model.md` §3.2/§3.x、`docs/handover/m11-custom-states-definitions.md` v0.2.0、`docs/progress/M11-RESEARCH-01-report.md`(+FU)、`docs/handover/code-facts.md` commit `3e0f4bf`。
- **前提ゲート**: (1) M10 完了承認済み。(2) **CHANGE-040 反映済み**(DES-005 v2.22.0 / DES-006 v1.12.0)+ **CHANGE-041 反映済み**(DES-002 v1.21.0 §4.2 PATCH に situation)。(3) Plan Mode §3.4(8項目、PATCH の BE 受け口含む)の実 view 確認結果が完了報告にあるか。

### 0.2 基本姿勢
- 機械チェック(§1〜§4・§6・§7)+ 設計意図(§5)。
- **フロント + seed のみ**。登録系 API・サービス層ロジック非改変を重点確認。
- code-facts は参考。最終根拠は実コード(retrospective-digest §1 パターンA)。

### 0.3 報告フォーマット
- 各節「OK / 重大(§9)/ 軽微(§10)/ 質問(§11)」。

---

## 1. 設計書本体との照合(最重要)

### 1.1 付与 UI(指示書 §4.2、DES-005 §5.7)
- [ ] 「キャラ固有状態」セクションが**独立カラム「状況」とは別**に新設されているか(D-A=案1。i18n も新系統で `comboDetail.situation.*`/`compare.row.situation` と非衝突)。
- [ ] 選択キャラの custom_states 定義を `useCharacters` 戻りから取得・`JSON.parse`→`states[]` で**データ駆動描画**しているか(FU-3)。
- [ ] `type=flag`→トグル / `type=level`/`stock`(int)→数値入力 / 未対応 type(composite)→スキップ、になっているか。
- [ ] 状態を持たないキャラ(states 空 / customStates NULL)で**セクション非表示**か。
- [ ] Int 入力が `value_definition.min`/`max` を尊重し、`-`/`e`/`.` を入力不可(既存 drive/sa available と同方式、§3.4-3)か。専用バリデータを追加していないか(DES-006 v1.12.0=検証非構築)。

### 1.2 表示(指示書 §4.3、DES-005 §5.6)
- [ ] コンボ詳細(ComboDetailHeader)に「キャラ固有状態」表示が追加され、独立カラム「状況」と分離されているか。custom_states を持つコンボのみ表示か。
- [ ] コンボ比較(CompareTable)に新 `RowDef` が追加され、custom_states を表示するか。
- [ ] 表示の code→name_ja 解決がキャラ定義由来か。

### 1.3 situation 組立・round-trip(指示書 §4.2/§4.4)
- [ ] `buildCreatePayload`/`buildPatchPayload`/`runPut` の**3経路すべて**に situation 組立が追加されているか(現状いずれも未送信=FU-1)。
- [ ] **PATCH の BE 受け口**: `UpdateMetadataRequest`／`UpdateMetadataInput`／repo の UPDATE SET に situation が**加算的**に追加され（nil=不変更パターン）、custom_states 単独編集が永続化されるか（CHANGE-041／指示書 §2.2/§2.4/§4.2）。
- [ ] `initialBasic` で edit/copy 時に既存 situation を parse→復元しているか(round-trip)。
- [ ] 格納規則: boolean true のみ / int は min 以外 / 既存 situation 他キーの保全 / 空なら situation 未送信、になっているか(§4.4)。PATCH でも同一の保全マージ規則か。

### 1.4 seed 定義投入(指示書 §4.1、definitions §3.1)
- [ ] ryu=`'{}'`→`denjin_charge` 置換、ingrid=`sun_crest`(min0/max4)、c_viper=`limit_decoupler` が投入 JSON どおりか。
- [ ] `.down.sql` が ryu=`'{}'`/ingrid・c_viper=NULL へ戻すか。
- [ ] **aki/jamie/guile を変更していない**か(D-C-2)。破壊的 seed クリアを含まない(加算的 UPDATE)か。

---

## 2. API・スキーマ整合性
- [ ] **`POST`／`PUT`／check-duplicate の契約は不変**か。situation は CREATE/PUT で既存 DTO のまま（中身に custom_states キーが入るのみ）。
- [ ] **`PATCH /api/combos/:id` に situation（custom_states）が加算**されているか（CHANGE-041／DES-002 §4.2）。`UpdateMetadataRequest`／`UpdateMetadataInput`／UPDATE SET の3点で、nil=不変更パターンに揃っているか。**重複判定キー（VAL-C02）は不変**（custom_states は識別キーではない）。
- [ ] situation の追加は `*string` 素通しのみで、custom_states に対する**検証・業務ロジックを追加していない**か（DES-006 §2.4）。スキーマ（`combos.situation` TEXT）不変か。

---

## 3. フロントエンドの動作仕様
- [ ] flag=トグル / int=数値入力で付与でき、状態なしキャラで非表示。
- [ ] キャラ変更時(CHANGE-036 リセット)に付与値もリセットされるか。
- [ ] 編集/コピーで付与値が往復保持されるか。
- [ ] 独立カラム「状況」入力・M10 キャラ選択挙動が不変か。

---

## 4. テストの妥当性(ケース数で確認)
- [ ] 必須テスト: §5.1 の18ケース(seed4 / 付与描画5 / situation組立4 / round-trip2 / **PATCH永続化2** / 後方互換1)。
- [ ] E2E: A(リュウ電刃往復 + **既存コンボの custom_states 単独編集=PATCH 永続化・再生成ダイアログ非発火**)/ B(イングリッド数値・入力制約)/ C(ヴァイパー)/ D(ケン非表示)/ E(非回帰)。

---

## 5. 設計意図との整合
- [ ] **消費を作っていない**(減少・解除・レベル技変化・バリデーション連動なし。利用者 notes 管理=DES-006 v1.12.0、指示書 §4.11)。
- [ ] **データ駆動**(キャラ固有のハードコードでなく custom_states 定義から描画)。先行リリース3体以外も定義投入のみで動く構造か。
- [ ] **呼称分離**(「状況」独立カラムと「キャラ固有状態」custom_states を混同しない)。
- [ ] **スキーマ非変更**(situation/custom_states は TEXT 既存を活用)。
- [ ] **custom_states はメタデータ（PATCH 経路）**: custom_states 単独編集が PUT（論理削除→再生成）でなく **PATCH** で永続化されるか。重複判定キー（VAL-C02）に custom_states を加えていないか（DES-006 §2.4＝非アイデンティティ）。
- [ ] **ryu の `'{}'`→電刃 置換**が漏れていないか(phase-1 固定前提の解消)。

## 6. コード品質・規約
- [ ] queryKey 規約(`useCharacters` の `["characters",{gameId}]`)に整合。
- [ ] i18n キーが新系統で命名衝突を避けているか。JSON/型 camelCase。
- [ ] custom_states 値の格納キー(code)が定義(denjin_charge/sun_crest/limit_decoupler)と一致。

## 7. 既存挙動の温存(非破壊性)
- [ ] 独立カラム「状況」(position 等)入力・表示が不変。
- [ ] `POST`/`PUT` 契約・スキーマが不変（PATCH の situation 加算は CHANGE-041 承認済みの加算的拡張）。aki/jamie/guile seed が不変。
- [ ] situation=NULL の既存コンボが詳細/比較/編集で壊れない。
- [ ] 既存 E2E(M10 / 閲覧系 / combo-crud)が通過。

## 8. ドキュメント
- [ ] DES-005 §5.6/§5.7・DES-006（CHANGE-040）、**DES-002 §4.2（CHANGE-041）**の追記は**設計担当が対応済み**。製造担当が DES を直接編集していないか。
- [ ] 完了報告に Plan Mode §3.4(8項目)・推測内容・テストケース数を含むか。

---

## 9. 重大な問題の判定基準(完了承認を妨げる)
- 前提ゲート(CHANGE-040 + **CHANGE-041** 反映 / Plan Mode 8項目)未充足のまま実装。
- situation 組立の3経路 or round-trip(initialBasic 読込)に漏れ、**または PATCH の BE 受け口（DTO/Input/UPDATE SET）欠落**により、保存/編集（特に custom_states 単独編集）で付与値が消える。
- custom_states の**消費・検証を実装**している(スコープ外)。
- **PATCH への situation 加算（CHANGE-041 で承認済み）以外**のバックエンドのサービス層ロジック・スキーマを変更している。または custom_states を重複判定キー（VAL-C02）へ加えている。
- 独立カラム「状況」・`POST`/`PUT` 契約・M10 挙動に回帰。
- aki/jamie/guile の seed を変更、または破壊的 seed クリアを含む。
- 「状況」と「キャラ固有状態」の i18n キー/表記が衝突している。

## 10. 軽微な問題の判定基準(持ち越し許容)
- トグル/数値入力の見た目細部。表示セクションのラベル文言。custom_states 空時の表示細部。

## 11. 質問・確認事項のフォーマット
- 「指示書 §X.X / DES-005 §5.7(§5.6)/ definitions §Y に対し実装が Z。意図確認したい」の形で根拠節併記。

## 12. レビュー完了の判定
- §1〜§8 が全て OK、§9 重大ゼロ、§0.1 前提ゲート + Plan Mode 8項目が揃っている。§10 軽微は持ち越し可。

---

*以上、M11-01 レビューチェックリスト v1.0.0*
