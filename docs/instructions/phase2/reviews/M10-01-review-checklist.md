# M10-01 レビューチェックリスト（骨子 v0.1.0）

| 項目 | 内容 |
|------|------|
| 対象指示書 | `docs/instructions/M10-01-instruction.md`（ComboEditor キャラクター選択化＝A-1。フロント完結） |
| 対象指示書ID | M10-01 |
| レビューモデル | Sonnet 4.6（model-allocation v1.14.0、機械的チェックリスト + 設計意図照合中心） |
| バージョン | 0.1.0（**骨子**。指示書 v0.1.0 と対。Plan Mode 後に指示書が v1.0.0 へ確定するのと同時に本書も v1.0.0 へ） |
| 作成者・作成日 | 設計担当 Claude（フェーズ2 本流スパイン・M10 担当）/ 2026-06-18 |

## 更新履歴

| バージョン | 更新日 | 更新内容 |
|-----------|--------|----------|
| 0.1.0 | 2026-06-18 | 初版（骨子。指示書骨子 v0.1.0 と対）。Plan Mode の §3.4 5項目確定後、指示書 v1.0.0 確定に合わせて §1.2/§3 のファイル集合・実装詳細を反映し v1.0.0 へ |

---

## 0. レビュー担当への前置き

### 0.1 レビュー前の準備
- 必読: `docs/instructions/M10-01-instruction.md` v1.0.0、`docs/instructions/M10-overview.md` §2.3/§4.1、`docs/design/05-screen-design.md`（DES-005 v2.20.0）§5.7/§4.1/§4.3、`docs/design/02-architecture.md`（DES-002）§4.2、`docs/handover/code-facts.md`（commit ff0620b）§1/§2/§7-2、`docs/change-notes/CHANGE-036-M10-01-combo-editor-character-switch.md`（CHANGE-036）、`docs/handover/architecture-patterns.md` §1.1/§8/§9.1。
- **前提ゲート**: (1) M9 完了（クラシック5体データ投入済み・E2E 通過）。(2) **CHANGE-036 反映済み**（DES-005 v2.20.0 §5.7 = 新規モードのキャラ変更挙動）。(3) Plan Mode §3.4 の 5 項目（characterId 供給源 / `CreateRequest.characterId` の service→repository 消費経路 / state 機構と CharacterSelector 配置 / 切替 reset 配線 / preset 連動）に質問書 + 開発者回答が揃っているか。

### 0.2 基本姿勢
- 機械チェック（§1〜§4・§6・§7）+ 設計意図（§5）の精神。
- **本サブユニットはフロント完結**。バックエンド（API・サービス・リポジトリ・スキーマ）への変更が無いことを重点確認（§2・§7）。
- code-facts は機械的事実の参照元だが静的抽出の限界あり。契約・挙動の最終根拠は実コード（retrospective-digest §0/§1 パターンA）。

### 0.3 報告フォーマット
- 各節「OK / 重大（§9）/ 軽微（§10）/ 質問（§11）」。

---

## 1. 設計書本体との照合（最重要）

### 1.1 キャラクター選択 UI（指示書 §4.1、DES-005 §5.7 表示項目1・2 / §4.3）
- [ ] 新規登録モードでキャラクター選択プルダウンが表示され、クラシック5体（ryu/ken/ingrid/c_viper/dhalsim）が選択できるか。
- [ ] 編集モードでキャラクターが固定表示（変更不可）か（DES-005 §5.7「編集時は固定表示」）。
- [ ] 表示項目1 のキャラクター情報バー（アイコン+名前）が表示されるか。
- [ ] `useCharacters`（queryKey `["characters", { gameId }]`、code-facts §2）+ 閲覧系の `CharacterSelector` パターンを踏襲しているか（独自再実装でないか）。

### 1.2 characterId の状態化（指示書 §4.2）
- [ ] 新規モードのリュウ固定が解消され、選択 state になっているか（固定値/定数が残っていないか）。既定選択は「デフォルト表示キャラ」（DES-005 §4.3、供給源は Plan Mode 確定）。
- [ ] 編集/コピーモードは `initial.characterId`（ComboDetail）由来で初期化されているか。
- [ ] 選択した `characterId` が `POST /api/combos`（`CreateRequest.characterId`、code-facts §7-2）に乗って送信されるか。

### 1.3 選択キャラの下流連動（指示書 §4.3、DES-005 §5.7 表示項目4・6・10 / リアルタイム重複検知）
- [ ] `useMovesByCharacter(characterId)`（queryKey `["moves","by-character",characterId]`）の moves が RecipeBuilder / VirtualController / ComboEditorBasicFields に渡るか。`autoStarterMoveId` が選択キャラの moves で再導出されるか。
- [ ] 束ねたセットプレイ（`SetupRegistrationSection`/`SetupInputRow`、Props に `characterId`）へ選択キャラが伝播し、`BundledSetupRequest.characterId` に乗るか。
- [ ] リアルタイム重複検知（`useCheckDuplicate`/`CheckDuplicateRequest.characterId`）が選択キャラ基準か。

### 1.4 キャラ変更時の確認・リセット（指示書 §4.4、CHANGE-036、DES-005 §5.7）
- [ ] dirty（ユーザー入力あり）時にキャラ変更で確認ダイアログが表示されるか。初期状態（入力なし）は無確認で切り替わるか。
- [ ] 「変更して入力を破棄」でフォーム全体が新キャラの新規初期状態にリセットされるか（steps/starter/束ねセットプレイ/メタデータ初期化）。
- [ ] 「キャンセル」でキャラ変更が取り消され、プルダウンの選択が**変更前に戻る**（制御コンポーネント・確定時のみ適用）か。フォーム内容が保持されるか。
- [ ] 編集モードはダイアログ非表示（固定）。コピーモードは初期 dirty のため必ずダイアログが出るか。

---

## 2. API 整合性
- [ ] `POST /api/combos`（`CreateRequest`）/ `PUT /api/combos/:id`（`PutRequest`）/ `POST /api/combos/check-duplicate`（`CheckDuplicateRequest`）の**既存契約が不変**か（character_id は既存、code-facts §7-2）。**バックエンドに変更を加えていないか**（フロント完結）。
- [ ] 選択 characterId が `CreateRequest.characterId` に正しく乗り、Create サービス経路で永続化されるか（Plan Mode で service→repository 経路を確認済みか）。固定値で上書きしていないか。

---

## 3. フロントエンドの動作仕様
- [ ] 新規でプルダウンから5体を選択でき、選択に応じて RecipeBuilder / VirtualController / ComboEditorBasicFields / SetupRegistrationSection が追従するか。
- [ ] 切替確認ダイアログの3挙動（破棄＝全体リセット / キャンセル＝選択 revert + 内容保持 / 初期＝無確認）が動作するか。明示ラベル（「変更して入力を破棄」「キャンセル」）か。
- [ ] situation（キャラ固有状態、DES-005 §5.7 表示項目5）が**汎用入力のまま**で、custom_states 消費ロジックやキャラ別動的状態 UI を実装していないか（M11 範囲、指示書 §4.11 既知制約）。

---

## 4. テストの妥当性（ケース数で確認）
- [ ] Vitest/component: (1) 新規=プルダウン表示・編集=固定表示、(2) 切替4ケース（dirty で発火 / 破棄で全体リセット / キャンセルで revert+保持 / 初期で無確認）、(3) 選択 characterId が `CreateRequest.characterId` に乗る送信テスト、(4) キャラ切替で `useMovesByCharacter` が新 characterId で再取得。
- [ ] E2E: A 新規でダルシム選択→登録→マイコンボ/一覧で確認、B 入力後キャラ変更→破棄で全体リセット、C 入力後キャラ変更→キャンセルで選択戻り+内容保持、D 編集モードでキャラ固定、E コピーでキャラ変更→必ずダイアログ。
- [ ] 既存 spec 非回帰: 閲覧系キャラ動的化 / combo-crud / moves spec が通過するか。

---

## 5. 設計意図との整合
- [ ] **フロント完結**（API は character_id 既存、BE 非改変。指示書 §2.4 例外条項＝該当なし）。
- [ ] **全体リセット採用**（選択的保持でない＝CHANGE-036 §2.3、陳腐メタデータ回避）。
- [ ] **制御コンポーネント**（確定時のみ適用、キャンセルでプルダウンを変更前へ revert＝表示と state の乖離防止、arch-patterns §1.2.6 系）。
- [ ] **situation は M11 送り**（埋めないことが正＝指示書 §4.11 既知制約）。穴埋め実装をしていないか。
- [ ] スコープは **ComboEditor 内部**（フッター新規登録の既定キャラ・選択モード・コンボ追加モーダル等のエントリポイント既定値は M10-02 範囲、本サブで触っていないか）。

---

## 6. コード品質・規約
- [ ] queryKey 規約（code-facts §2、`characters` は object 形式 `["characters",{gameId}]`、combo 系 flat tuple / setup 系 object の混在＝arch-patterns §1.1）に整合するか。
- [ ] `CharacterSelector` を共有化した場合、配置・Props 汎用性が妥当か（閲覧系の既存呼び出し元を壊していないか）。react-hook-form を使う場合は arch-patterns §8 パターンに整合するか。
- [ ] JSON/型が camelCase 統一（SUPP §6.4）。既存パターン（code-facts §1/§2/§4）に整合。

---

## 7. 既存挙動の温存（非破壊性）
- [ ] 閲覧系の `useCharacters`/`CharacterSelector` の**既存呼び出し元（mycombo 等）が不変**か。
- [ ] **編集モードのキャラ固定表示挙動が不変**か。
- [ ] 登録系 API（`POST`/`PUT`/`check-duplicate`）の既存契約・既存フィールドが不変か。**moves スキーマ・combos スキーマに変更がない**か。
- [ ] ComboEditor 外のエントリポイント（M10-02 範囲）に手を入れていないか。
- [ ] 既存 E2E spec（閲覧系キャラ動的化 / combo-crud / moves）が通過するか。

---

## 8. ドキュメント
- [ ] DES-005 §5.7 の CHANGE-036 追記は**設計担当が対応済み**（DES-005 v2.20.0）。製造担当が DES-002/DES-005 を直接編集していないか。
- [ ] 完了報告に Plan Mode 確定（§3.4 5項目）と推測した内容（§9.2 範囲）、テストケース数を含むか。

---

## 9. 重大な問題の判定基準（完了承認を妨げる）
- 前提ゲート（CHANGE-036 反映 / Plan Mode 5項目）未充足のまま実装。
- 選択 characterId が保存されない（リュウ固定/既定固定のまま）、または `CreateRequest.characterId` に乗っていない。
- 「キャンセル」時に選択が revert されず、表示（新キャラ）と state（旧キャラ）が乖離している。
- キャラ切替時に旧キャラの move ID（steps / starterMoveId / 束ねセットプレイ steps）がリセットされず残存している。
- バックエンド（API・サービス・リポジトリ・スキーマ）に変更を加えている（フロント完結のはず）。
- custom_states 消費ロジック・situation のキャラ別動的状態 UI を実装している（M11 範囲の穴埋め＝指示書 §4.11 違反）。
- 編集モードのキャラ固定が壊れている、または閲覧系のキャラ動的化に回帰がある。

## 10. 軽微な問題の判定基準（持ち越し許容）
- 確認ダイアログの文言・キャラ情報バーの表示細部。既定キャラ選定の細部。プルダウンのスタイル差異。

## 11. 質問・確認事項のフォーマット
- 「指示書 §X.X / DES-005 §5.7（または code-facts §7-2）に対し実装が Z。意図確認したい」の形で根拠節併記。

## 12. レビュー完了の判定
- §1〜§8 が全て OK、§9 重大ゼロ、§0.1 の前提ゲート + Plan Mode 5項目が揃っている。§10 軽微は持ち越し可。

---

*以上、M10-01 レビューチェックリスト 骨子 v0.1.0（指示書 v1.0.0 確定と同時に v1.0.0 へ）*
