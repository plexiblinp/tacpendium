# M10-01 製造指示書（骨子 v0.1.0）— ComboEditor キャラクター選択化（A-1）

| 項目 | 内容 |
|------|------|
| 指示書ID | M10-01 |
| バージョン | 0.1.0（**骨子・Plan Mode 前**。§3.4 / §9.4 の確認結果を受けて v1.0.0 へ確定） |
| 作成日 | 2026-06-18 |
| 作成者 | 設計担当 Claude（フェーズ2 本流スパイン・M10 担当） |
| 対象マイルストーン | M10（複数キャラ登録 UI）/ M10-01（A-1 ComboEditor キャラクター選択化） |
| 実装モデル | Opus（暫定。§7.1 Opus 信号＝new/edit/copy モード分岐 + ステートフルな切替 UX + 横断連動）。**Plan Mode 必須** |
| レビューモデル | Sonnet 4.6（機械的チェックリスト + 設計意図照合中心） |
| スコープ種別 | **フロント完結**（バックエンド変更なし。§2.4 例外条項＝該当なし） |

---

## §1 背景と目的

### §1.1 背景

- M9（公式データ取込パイプライン）完了により、クラシック操作5体（ryu / ken / ingrid / c_viper / dhalsim）の moves フレームデータが取込・編集できる状態になった（開発者 E2E 通過、2026-06-17）。
- **閲覧系（マイコンボ / 一覧 / 比較）は複数キャラ動的化済み**（`useCharacters` フック + `CharacterSelector` で実装、code-facts §2-1 / §1）。
- **登録系（ComboEditor）はフェーズ1 以来リュウ固定**。code-facts §1 で `ComboEditor` の Props は `{ mode: "new"|"edit"|"copy"; initial?: ComboDetail }` のみで **`characterId` を受け取らない**一方、子コンポーネント `RecipeBuilder` / `VirtualController` / `SetupRegistrationSection` / `SetupInputRow` / `SetupSelectorModal` / `SetupBasicInfoForm` / `SetupRecipeEditor` は **`characterId: number` を必須**とする。よって ComboEditor は新規モードの characterId を内部で固定的に供給しているはず（固定値か `config.defaults.character_id` か）＝**本サブユニットで解消する固定箇所の核心**。
- DES-005 §5.7（v2.20.0）は既にキャラ選択を規定済み: 表示項目1「現在選択中キャラクター情報バー」、表示項目2「キャラクター選択プルダウン（**新規時のみ、編集時は固定表示**）」。§4.3 共通要素に「キャラクター選択プルダウン（複数画面で使用・デフォルト表示キャラがデフォルト選択）」。**設計は既述で、実装が遅れている状態**。
- CHANGE-036（DES-005 v2.20.0 §5.7）で **新規モードのキャラ変更時の確認・破棄挙動**を規範化済み（確認ダイアログ→「変更して入力を破棄」で全体リセット／「キャンセル」で選択を変更前へ revert／dirty 時のみ発火）。
- 登録系 API は当初から character_id を受領（code-facts §7-2: `CreateRequest.characterId int64`〔必須〕、`PutRequest` は `CreateRequest` を embed、`CheckDuplicateRequest.characterId` も保持）。**API 契約変更は不要**。

### §1.2 目的（完了時に達成される状態）

- ComboEditor の**新規登録モード**でクラシック5体から登録対象キャラを選択でき、選択に応じて以下が追従する: 始動技候補・仮想コントローラ・レシピ入力（`useMovesByCharacter(characterId)` 由来の moves）、束ねたセットプレイ入力（`characterId` 伝播）、リアルタイム重複検知（選択キャラ基準）。
- 登録時、選択したキャラの `characterId` が `POST /api/combos`（`CreateRequest.characterId`）に乗って保存される。
- **編集モード**はキャラクターを固定表示（変更不可）。**コピーモード**は新規モード扱いでキャラ選択可。
- 新規モードのキャラ変更時に CHANGE-036 の挙動（dirty 時に確認ダイアログ→破棄で全体リセット／キャンセルで revert）が機能する。

### §1.3 このサブユニットで作らないもの（スコープ外）

- **M10-02（A-2）**: ComboEditor 外の画面横断 UX（フッター「新規登録」導線の既定キャラ、選択モード、`AddComboToCompareModal` 等の既定値・固定表示の選択キャラ追従）。本指示書は **ComboEditor（新規/編集/コピー）内部の選択化**に限定し、エントリポイント側の既定値解消は M10-02 へ送る。
- **M11**: `situation`（DES-005 §5.7 表示項目5 の「キャラ固有状態」）の機能化。custom_states の消費セマンティクスは phase-1 で未実装（architecture-patterns §9.1）＝**§4.11 既知制約**参照。
- プリセット選択のキャラスコープ化（`PRESETS_KEY=["presets"]` はキャラ非スコープ＝code-facts §2-2。切替で preset リセットは原則不要。Plan Mode で確認）。
- バックエンド変更全般（API は character_id 既存）。moves 手動 CRUD 等 backlog 項目。英語ロケール・他ゲーム（フェーズ3+）。

---

## §2 成果物

### §2.1 / §2.2 修正・追加対象（**Plan Mode の実 view で確定**）

> 下記は code-facts §1/§3 からの想定タッチポイント。**正確なファイル集合・state 機構は §3.4 の Plan Mode view で確定**してから実装する（想定で書かない）。

| 区分 | 想定ファイル | 想定修正内容 |
|------|------------|------------|
| 修正 | `web/src/features/combo/components/ComboEditor.tsx` | 新規モードの characterId を固定供給 → 選択 state 化。選択キャラを子（RecipeBuilder / VirtualController / ComboEditorBasicFields / SetupRegistrationSection 等）へ伝播。キャラ変更時の確認・全体リセット・revert（CHANGE-036） |
| 修正 | `web/src/features/combo/pages/ComboEditorPage`（実パスは view 確認） | 新規モードの初期 characterId 供給源の変更（固定 → 既定キャラ）。編集/コピーは `initial.characterId` 由来を維持 |
| 追加（候補） | キャラ変更確認ダイアログ component | CHANGE-036 の確認ダイアログ。既存確認ダイアログ群（`DeleteComboConfirm` / `PutConfirmDialog` / `PermanentDeleteConfirm`）のパターン踏襲 |
| 流用/共有化（判断） | `CharacterSelector`（現 `features/mycombo/components/`）/ 情報バー（item1） | 登録系へ流用 or 共有配置へ移設（§3.4 で判断）。`CharacterInfoBar` は `statusCounts` 必須（mycombo 専用）のため item1 はそのまま流用不可の可能性 |

### §2.3 変更しないもの（保護対象）

- 登録系 API（`POST /api/combos` / `PUT /api/combos/:id` / `POST /api/combos/check-duplicate`）。`CreateRequest.characterId` は既存（code-facts §7-2）。
- 閲覧系の `useCharacters` / `CharacterSelector` の **既存呼び出し元**（mycombo 等）の挙動。
- **編集モードのキャラ固定表示挙動**（既存どおり、`initial.characterId` 固定）。
- ComboEditor 外の画面のエントリポイント既定（M10-02 で扱う）。

### §2.4 例外条項（バックエンドへの追加変更）

**該当なし**。`CreateRequest.characterId`（必須）・`PutRequest`（embeds CreateRequest）・`CheckDuplicateRequest.characterId` はいずれも既存（code-facts §7-2、commit ff0620b）。本サブユニットはフロント完結。

---

## §3 前提条件

### §3.1 必読

- **DES-005 §5.7**（`docs/design/05-screen-design.md`、v2.20.0、CHANGE-036 反映済み＝**本指示書の主参照**）、§4.1 ヘッダ、§4.3 共通要素（キャラクター選択プルダウン）。
- **code-facts.md**（`docs/handover/code-facts.md`、生成 2026-06-18 / commit ff0620b）§1 Props / §2 hooks・queryKey / §3 フロントルート / §4 Go ルート / §7-2 リクエスト DTO。
- **CHANGE-036 通知書**（`docs/change-notes/CHANGE-036-M10-01-combo-editor-character-switch.md`、新規モードのキャラ変更挙動）。
- **architecture-patterns.md**（`docs/handover/architecture-patterns.md`）§1.1（queryKey 規約・combo 系 flat tuple / setup 系 object 形式の混在）、§8（react-hook-form + zodResolver + shadcn/ui Form）、§9.1（custom_states phase-1 状態）。

### §3.2 任意

- DES-002 §4.2（`docs/design/02-architecture.md`、combos エンドポイント）、DES-004 §2.1（`docs/design/04-notation-spec.md`、code 規約）、DES-006（`docs/design/06-validation.md`、既存バリデーション）。

### §3.3 参照不要

- moves 取込/編集系（M9: §5.17 / §5.18 / movesimport）。M11 custom_states 消費。

### §3.4 着手前の確認（= Plan Mode 必須項目。§9.4 と同一）

1. **(a) 新規モードの characterId 供給源**: `ComboEditor.tsx` / `ComboEditorPage` を view し、現状の固定値が何か（ハードコード定数か `config.defaults.character_id`〔code-facts §5〕か）を特定。編集/コピーの `initial.characterId` 経路も確認。
2. **(b) Create サービス消費経路**: `combo.Handler.Create` → service → repository の insert を view し、`CreateRequest.characterId` が実際に永続化されること（途中で固定値に上書きされないこと）を確認。**code-facts §7-2 は DTO 形状のみ・サービス配線は非表示**（限界節）のため、実コードで裏取り。
3. **(c) state 機構と CharacterSelector 配置**: ComboEditor が react-hook-form（arch-patterns §8）か局所制御 state（`ComboEditorBasicFields` の value/onChange）かを view で確定し、キャラ field 追加と reset の実装位置を決める。`CharacterSelector`（現 mycombo 配下）の流用可否・共有化要否を判断。`useCharacters` への gameId 供給経路（閲覧系の実装）も確認。
4. **(d) 切替 reset 配線**: キャラ変更時に `useMovesByCharacter(characterId)` 再取得 → steps / starterMoveId / 束ねセットプレイ steps をリセットする経路、確認ダイアログの dirty 判定、制御コンポーネントの revert（キャンセル時に選択を戻す）の実装方式を確定。
5. **プリセット連動**: 切替で preset 選択リセットが不要か（`["presets"]` キャラ非スコープ）を確認。

---

## §4 詳細仕様

### §4.1 キャラクター選択 UI（DES-005 §5.7 表示項目1・2）

- `useCharacters`（queryKey `["characters", { gameId }]`、code-facts §2）でクラシック5体を取得。閲覧系で確立した `CharacterSelector`（Props `{ selectedCharacterId: number; onChange: (characterId: number) => void }`）のパターンを踏襲。
- 新規モード: プルダウン表示。編集モード: 固定表示（変更不可）。表示項目1 の情報バー（アイコン+名前）は item2 の上に表示。
- 既定選択は「デフォルト表示キャラ」（DES-005 §4.3）。供給源は §3.4-1 で確定。

### §4.2 ComboEditor の characterId 状態化

- 新規モード: 固定供給を**選択 state** へ置換。state 機構は §3.4-3 で確定した方式に合わせる。
- 編集/コピーモード: `initial.characterId`（ComboDetail）由来で初期化。編集は固定、コピーは選択可。

### §4.3 選択キャラの下流連動（DES-005 §5.7 表示項目4・6・10、リアルタイム重複検知）

- `useMovesByCharacter(characterId)`（queryKey `["moves","by-character",characterId]`）の moves を `RecipeBuilder` / `VirtualController` / `ComboEditorBasicFields`（`autoStarterMoveId` 再導出）へ渡す。
- 束ねセットプレイ（`SetupRegistrationSection` / `SetupInputRow`、Props に `characterId`）へ選択キャラを伝播。`BundledSetupRequest.characterId`（code-facts §7-2）に乗る。
- リアルタイム重複検知（`useCheckDuplicate` / `CheckDuplicateRequest.characterId`）は選択キャラ基準。

### §4.4 キャラ変更時の確認・リセット（CHANGE-036 / DES-005 §5.7）

- dirty（ユーザー入力が何かあれば）時にキャラ変更で確認ダイアログ表示。
- 「変更して入力を破棄」→ フォーム全体を新キャラの新規初期状態へリセット。
- 「キャンセル」→ キャラ変更取消、プルダウンの選択を**変更前へ revert**（フォーム保持）。制御コンポーネントとして確定時のみ適用。
- 初期状態（入力なし）→ 無確認切替。編集モード→ 固定（ダイアログなし）。コピーモード→ 初期 dirty のため必ずダイアログ。

### §4.10 表示項目 ↔ 既存実装実態 対応表（DES-005 §5.7、playbook §4.10）

| §5.7 表示項目 | 既存実装/Props（code-facts） | M10-01 での扱い |
|---|---|---|
| 1 キャラ情報バー | `CharacterInfoBar`(mycombo, `characterId`+`statusCounts`) | statusCounts 必須のため流用不可の可能性。簡易な icon+name 表示を確認の上用意 |
| 2 キャラ選択プルダウン | `CharacterSelector`(mycombo, `selectedCharacterId`/`onChange`) | 流用 or 共有化（§3.4-3）。新規=表示・編集=固定 |
| 3 仮登録トグル | ComboEditor（既存） | 変更なし |
| 4 始動技選択 | `ComboEditorBasicFields`(`moves`/`autoStarterMoveId`) | 選択キャラの moves で再導出 |
| 6 レシピ入力（仮想コントローラ/ステップ） | `RecipeBuilder`/`VirtualController`/`StepRow`（`characterId`/`moves`） | 選択キャラ追従。切替で steps リセット |
| 5 状況入力（situation 含む） | ComboEditor（既存） | position 等は非依存で維持。situation キャラ固有状態は **§4.11 既知制約** |
| 7-9 ダメージ/ドライブ/コンボ後 | ComboEditor（既存） | キャラ非依存・維持（切替時は §4.4 全体リセット対象） |
| 10 セットプレイ登録 | `SetupRegistrationSection`/`SetupInputRow`(`characterId`) | 選択キャラ伝播・切替で steps リセット |
| 11-13 タグ/メモ/保存 | 既存 | キャラ非依存・維持 |

### §4.11 既知制約（playbook §4.11、決定の足し算が作る穴）

- 「M11 送り（custom_states 消費の機能化）」＋「M10 でキャラ選択解禁」を重ねた帰結: **C.ヴァイパー/ダルシム等を選択しても、表示項目5 の `situation`「キャラ固有状態」は機能しない**（custom_states は phase-1 で保存/API のみ・消費未実装＝architecture-patterns §9.1）。M10 では situation は汎用入力のまま。
- これは **埋めない（その状態のまま残す）ことが正**。製造担当は穴埋めで custom_states 消費ロジック・キャラ別動的状態 UI を実装しないこと（M11 の範囲）。

---

## §5 テスト要件

### §5.1 必須テスト（ケース数で記述）

- ComboEditor キャラ選択（component/unit）: 新規=プルダウン表示・編集=固定表示の2ケース。
- 切替挙動: (1) dirty 時にダイアログ発火、(2) 破棄で全体リセット（steps/starter/setups/メタデータ初期化）、(3) キャンセルで選択 revert + 内容保持、(4) 初期状態は無確認切替 の4ケース。
- 送信: 選択した characterId が `CreateRequest.characterId` に乗る送信内容のテスト（1ケース、ヘルパのステータス契約も試験＝retro M4-02）。
- moves 連動: キャラ切替で `useMovesByCharacter` が新 characterId で再取得される（1ケース）。

### §5.2 E2E シナリオ（製造実装方式に依存しない記述）

- **A**: 新規でダルシムを選択 → ダルシムの技でレシピ入力 → 保存 → マイコンボ/一覧でダルシムのコンボとして表示される。
- **B**: 新規で入力後にキャラ変更 → 確認ダイアログ →「変更して入力を破棄」→ フォームが新キャラ初期状態にリセットされる。
- **C**: 新規で入力後にキャラ変更 →「キャンセル」→ プルダウンが元キャラに戻り、入力内容が保持される。
- **D**: 既存コンボの編集画面でキャラが固定表示・変更不可。
- **E**: コピーで開いた画面でキャラ変更 → 初期 dirty のため確認ダイアログが表示される。

---

## §7 完了条件（DoD）

- **機能要件**: §1.2 の状態（5体選択・登録、下流連動、CHANGE-036 切替挙動、編集固定）を満たす。§5.2 シナリオ A〜E が手動 E2E で通る。
- **自己テスト**: §5.1 の全ケースが通過（「ファイル有無」でなくケース数で確認＝retro D）。
- **品質チェック**: 型・lint 通過。既存 E2E（M8-02 以降の spec）と閲覧系キャラ動的化に**非回帰**。
- **ドキュメント**: 完了報告に「推測した内容」（§9.2 の範囲で判断した点）を明記。Plan Mode 確定事項を指示書 v1.0.0 へ反映。
- **完了報告**: 実装裁量・乖離・要確認事項を報告。**実機 E2E が完了の必須ゲート**（レビュー承認 ≠ 完了承認）。

> §5（必須テスト/E2E）↔ §7（DoD）リンク: §5.1 → DoD 自己テスト、§5.2 A〜E → DoD 機能要件・実機ゲート。

---

## §9 注意事項

### §9.1 推測 NG（必ず view で確認）

- 新規モードの characterId 供給源 / `CreateRequest.characterId` の service→repository 消費経路 / ComboEditor の state 機構（RHF か局所か）/ `CharacterSelector` の配置と流用可否 / `useCharacters` の gameId 供給。**想定で書かない**（retrospective-digest §1 パターンA: 症状のレイヤ ≠ 真因のレイヤ）。
- **code-facts は参考**（DTO 形状・Props・queryKey の機械的事実）。静的抽出のため `c.Bind` 追跡やサービス配線・コメントアウトを取りこぼしうる（限界節）。**契約・挙動判断の最終根拠は実コード**（playbook §9.2 / retrospective-digest §0）。

### §9.2 推測 OK（裏取り済みの事実）

- `useCharacters` queryKey `["characters",{gameId}]` / `CharacterSelector` Props（code-facts §1/§2）。
- `CreateRequest.characterId int64`（必須）/ `PutRequest` embeds CreateRequest / `CheckDuplicateRequest.characterId`（code-facts §7-2）。
- `useMovesByCharacter` queryKey `["moves","by-character",characterId]`（code-facts §2-2）。

### §9.4 Plan Mode 必須項目（§3.4 と同一・開発者提示）

§3.4 の 1〜5（characterId 供給源 / Create 消費経路 / state 機構と CharacterSelector 配置 / 切替 reset 配線 / preset 連動）。Plan Mode で実 view 確認の上、§2.1 のファイル集合と §4 の実装詳細を確定し、本指示書を v1.0.0 へ更新する。

---

*M10-01 製造指示書 骨子 v0.1.0。Plan Mode 確定後に v1.0.0 へ。対のレビューチェックリスト（M10-01-review-checklist）は v1.0.0 確定時に併せて作成（retrospective-digest §7: 指示書改訂時はチェックリストも追従）。*
