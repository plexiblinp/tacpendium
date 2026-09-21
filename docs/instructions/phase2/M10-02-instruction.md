# M10-02 製造指示書 v1.0.0 — リュウ固定依存 UX の画面横断解消（A-2）

| 項目 | 内容 |
|------|------|
| 指示書ID | M10-02 |
| バージョン | 1.0.1（実装整合。新規登録導線＝一覧のみ・マイコンボ導線なし、E2E-A'、一覧情報バー defect 修正の追認を反映） |
| 作成日 | 2026-06-18 |
| 作成者 | 設計担当 Claude（フェーズ2 本流スパイン・M10 担当） |
| 対象マイルストーン | M10（複数キャラ登録 UI）/ M10-02（A-2 リュウ固定依存 UX の解消） |
| 実装モデル | Sonnet 4.6（M10-01 で確立したキャラ選択パターンの適用＋初期値プロップ伝播の機械的作業中心。survey で確定） |
| レビューモデル | Sonnet 4.6 |
| スコープ種別 | **フロント完結**（登録系 API は character_id 既存＝§2.4 例外条項 該当なし） |
| 関連 CHANGE | CHANGE-039（DES-005 v2.21.0 §4.3/§5.7/§5.8 既定キャラクターの文脈追従。反映済み） |

---

## §1 背景と目的

### §1.1 背景

- M10-01（ComboEditor キャラクター選択化）完了（E2E 通過、2026-06-18）。ComboEditor 新規モードは選択プルダウン化済みで、既定は `INITIAL_CHARACTER_ID`（=1、`@/lib/constants`、M10-01 製造判断 #2）。
- 残存課題（A-2）: ComboEditor 外のエントリポイントに残るリュウ固定／既定キャラ固定を、文脈キャラ追従へ解消する。
- **Plan Mode エントリポイント survey の確定（2026-06-18、開発者 2 問とも選択肢1）**:
  - (Q1) 新規登録の既定キャラを文脈追従にする（一覧/マイコンボの選択キャラ → 新規登録）。
  - (Q2) コンボ追加モーダル（`AddComboToCompareModal`、現状リュウ固定）の既定キャラを比較リスト先頭コンボのキャラに追従。
  - いずれも DES-005 §4.3 既定規定の拡張＝**CHANGE-039 で反映済み**（DES-005 v2.21.0 §4.3/§5.7/§5.8）。
- `AddComboToCompareModal` は既に mycombo の `CharacterSelector` を import 済み（M10-01 製造報告 #1）。本サブはその**既定値**をリュウ固定から文脈追従へ変更する。
- 実装 survey で **一覧（ComboListPage）の情報バーがリュウ固定（`comboList.characterRyu`）の defect** だったことが判明し、本サブで併せて是正（DES-005 §5.4「動的表示」既述に沿う defect 修正。新規 CHANGE 不要・追認）。

### §1.2 目的（完了時に達成される状態）

- 一覧/マイコンボでキャラ選択済みの状態から「新規登録」に入ると、ComboEditor 新規モードの既定がその文脈キャラになる（文脈なしの汎用導線では `INITIAL_CHARACTER_ID`）。
- コンボ比較画面の「コンボ追加」モーダルの既定キャラが、比較リスト先頭コンボのキャラになる（比較リストが空なら `INITIAL_CHARACTER_ID`）。モーダル内セレクタでの手動切替は維持。
- ComboEditor 外のエントリポイントに残るリュウ固定が解消される。

### §1.3 このサブユニットで作らないもの（スコープ外）

- **M10-01 で完了した ComboEditor 内部の選択化挙動**（新規プルダウン／編集固定／CHANGE-036 切替）。本サブは初期値を外から渡すのみで内部ロジックは変えない。
- **選択モード（`useSelectMode`）**: 既存コンボの一括選択機能であり、キャラクター既定／固定の解消対象は survey で surfaced しなかった（選択モードはコンボ選択であってキャラ選択ではない）。本サブのスコープ外。
- **M11**: `situation` のキャラ固有状態の機能化（custom_states 消費）。**§4.11 既知制約**。
- **followup-backlog B-7**: 仮想コントローラ／seed の move_code 旧形→新形統一（M12-02 系）。
- バックエンド変更（登録系 API は character_id 既存）。

---

## §2 成果物

### §2.1 修正対象（Plan Mode survey 確定）

| 区分 | ファイル | 修正内容 |
|------|---------|----------|
| 修正 | `ComboEditor.tsx`（features/combo） | 任意プロップ `initialCharacterId?: number` を追加。新規モードの初期選択に用いる（不在時は `INITIAL_CHARACTER_ID`＝M10-01 既存挙動）。内部選択ロジック・CHANGE-036 切替は不変 |
| 修正 | `ComboEditorPage`（実パスは view 確認） | route の `?character=`（または nav state）を読み、新規モード時に `initialCharacterId` として ComboEditor へ渡す。値が無い／編集モードでは従来どおり |
| 修正 | 新規登録導線（**一覧（ComboListPage）のみ**の「新規登録」アクション） | 選択中の characterId を `?character=` で `/combos/new` へ伝播。新規登録導線はホーム／フッター／一覧の3箇所で、**マイコンボには導線が存在せず・設けない**（開発者確定）。ホーム／フッターは文脈なし＝伝播しない |
| 修正 | `ComparePage`（コンボ比較） | `AddComboToCompareModal` へ `defaultCharacterId`（比較リスト先頭コンボの characterId／空なら `INITIAL_CHARACTER_ID`）を渡す |
| 修正 | `AddComboToCompareModal.tsx` | 既定キャラを固定（リュウ）から `defaultCharacterId` プロップ駆動へ変更。Props に `defaultCharacterId?: number` を追加。モーダル内 `CharacterSelector` の手動切替は維持 |
| 修正 | `ComboListPage`（一覧の情報バー） | 「現在選択中キャラクター情報バー」がリュウ固定（`comboList.characterRyu`＋アバター「R」）になっていた defect を是正＝`filters.characterId` に対応する名前を `useCharacterName` で動的表示・アバターは名前先頭1文字。DES-005 §5.4「動的表示」既述に沿う defect 修正で**新規 CHANGE 不要**（2-2 追認） |

> 正確なファイルパス・既存 state 機構は Plan Mode の実 view で最終確認のうえ実装する（§3.4）。

### §2.2 追加対象

- なし（既存コンポーネントへのプロップ追加と伝播のみ）。

### §2.3 変更しないもの（保護対象）

- M10-01 の ComboEditor 内部挙動（選択化・CHANGE-036 切替）。`AddComboToCompareModal` 内の `CharacterSelector` 手動切替。
- 編集モードのキャラ固定表示。
- 閲覧系の `useCharacters`/`CharacterSelector` の既存呼び出し元の挙動。
- 登録系 API・スキーマ。
- 選択モード（`useSelectMode`）。

### §2.4 例外条項（バックエンドへの追加変更）

**該当なし**（登録系 API は character_id 既存。文脈キャラ伝播はフロント完結）。

---

## §3 前提条件

### §3.1 必読

- **DES-005**（`docs/design/05-screen-design.md` **v2.21.0**、CHANGE-039 反映済み）§4.3／§5.7「新規モードの既定キャラクター」／§5.8「コンボ追加モーダルの既定キャラクター」。
- **CHANGE-039 通知書**（`docs/change-notes/CHANGE-039-M10-02-default-character-context.md`）。
- **code-facts.md**（`docs/handover/code-facts.md` commit ff0620b）§1 Props（`AddComboToCompareModal`／`ComboEditor`）/ §2 hooks / §3 ルート（`/combos/new`→ComboEditorPage）/ §5 config / §6 共通ナビ（Footer `/combos/new`）。
- **M10-01 製造成果・完了報告**（`docs/instructions/M10-01-instruction.md` v1.0.0、製造判断 #1 CharacterSelector 現位置 import・#2 既定 INITIAL_CHARACTER_ID）。
- **architecture-patterns.md**（`docs/handover/architecture-patterns.md`）§1.1 queryKey。

### §3.2 任意

- `docs/instructions/M10-overview.md` §2.4／§4.2、`docs/design/02-architecture.md`（DES-002）§4.2。

### §3.3 参照不要

- ComboEditor 内部の選択化（M10-01 済）。M11 custom_states。仮想コントローラ code 是正（followup-backlog B-7）。

### §3.4 着手前の確認（Plan Mode。survey は実施済み・実装前の最終 view 確認）

> エントリポイント survey は完了し、対象は (1) 新規登録の既定キャラ伝播 (2) コンボ追加モーダルの既定キャラの2点に確定。実装着手前に以下を実 view で最終確認する。

1. **文脈キャラ伝播機構**: 新規登録導線（一覧 ComboListPage）→ `/combos/new` の伝播を `?character=` route param で行う（実装確定）。`ComboEditorPage` の新規モード初期化への流し込み経路を view 確認。
2. **ComboEditor の初期値受け口**: M10-01 で導入した新規モードの既定 state へ `initialCharacterId` を流す位置（react-hook-form の defaultValues か局所 state の初期化か）を view 確認。
3. **ComparePage → AddComboToCompareModal**: 比較リスト（`CompareTargetList`/ids）から先頭コンボの characterId を取得する経路、`AddComboToCompareModal` の現状の既定キャラ固定箇所を view 確認。

### §3.5 Plan Mode 確定事項（survey 結果）

- 既定キャラの文脈追従を採用（Q1/Q2 とも選択肢1、CHANGE-039 反映済み）。
- 選択モード（`useSelectMode`）はキャラ既定の解消対象なし＝スコープ外。
- フロント完結（BE 変更なし）。

---

## §4 詳細仕様

### §4.1 新規登録の既定キャラの文脈追従（DES-005 §5.7「新規モードの既定キャラクター」）

- 一覧（ComboListPage）で選択中のキャラから「新規登録」した場合、その characterId を `/combos/new` へ伝播し、ComboEditor 新規モードの初期選択に用いる。**マイコンボには新規登録導線が存在せず・設けない**（開発者確定。新規登録導線はホーム/フッター/一覧の3箇所）。
- フッターの汎用「新規登録」導線など文脈の無い遷移では伝播せず、ComboEditor は `INITIAL_CHARACTER_ID` を既定とする（M10-01 既存挙動）。
- `ComboEditor` に `initialCharacterId?: number` を追加。不在時は `INITIAL_CHARACTER_ID`。編集モードでは無視（`initial.characterId` 固定）。

### §4.2 コンボ追加モーダルの既定キャラ（DES-005 §5.8）

- `ComparePage` が比較リスト先頭コンボの characterId（比較リストが空なら `INITIAL_CHARACTER_ID`）を `AddComboToCompareModal` の `defaultCharacterId` として渡す。
- モーダルは `defaultCharacterId` を既定選択にし、内部 `CharacterSelector` での手動切替は維持。

### §4.3 伝播機構

- §3.4-1 で確定した方式（`?character=` route param 推奨。既存実装に合わせる）で文脈キャラを伝播。ComboEditor／モーダルは「初期値を外から受ける」形にとどめ、内部選択ロジックは不変。

### §4.10 表示項目 ↔ 既存実装実態 対応表

| 対象 | 既存実装/Props（code-facts） | M10-02 での扱い |
|------|------------------------------|----------------|
| 新規登録導線（一覧 ComboListPage のみ） | 「新規登録」アクション → `/combos/new`（§3 ルート） | 選択中 characterId を `?character=` で伝播。マイコンボには導線なし・設けない |
| フッター新規登録 | `Footer` `/combos/new`（§6 共通ナビ） | 文脈なし＝伝播しない（INITIAL_CHARACTER_ID 既定） |
| ComboEditor | Props `{ mode; initial? }`（§1） | `initialCharacterId?` を追加（M10-01 の選択 state の初期値） |
| コンボ比較 | `AddComboToCompareModal`（`open/currentIds/onAdd/onOpenChange`、§1）/ `CompareTargetList`（ids） | `defaultCharacterId?` を追加。ComparePage が先頭コンボのキャラを渡す |
| 選択モード | `useSelectMode` / `ComboTable`（isSelectMode 系、§1） | 変更なし（キャラ既定の解消対象なし） |

### §4.11 既知制約

- `situation` のキャラ固有状態は M11 送り（custom_states 消費未実装）。本サブで穴埋めしない。
- 仮想コントローラ／seed の move_code 旧形→新形統一は followup-backlog B-7（M12-02 系）。本サブで触らない。

---

## §5 テスト要件

### §5.1 必須テスト（ケース数で確認）

- 新規登録の既定: (1) 一覧/マイコンボで特定キャラ選択 → 新規登録の既定がそのキャラ、(2) 文脈なし（フッター導線）→ 既定が `INITIAL_CHARACTER_ID`、の2ケース。
- コンボ追加モーダルの既定: (3) 比較リストに特定キャラのコンボあり → モーダル既定がそのキャラ、(4) 比較リスト空 → 既定が `INITIAL_CHARACTER_ID`、の2ケース。
- 後方互換: (5) `initialCharacterId`／`defaultCharacterId` 不在時に従来挙動（INITIAL_CHARACTER_ID）になる、の1ケース。

### §5.2 E2E シナリオ（実装方式非依存）

- A'（一覧起点）: 一覧（ComboListPage）でダルシム選択 → 新規登録 → 既定がダルシム → 登録 → 一覧で確認。（当初案のマイコンボ起点 A はマイコンボに導線が無いため非該当）
- B: フッター「新規登録」→ 既定が `INITIAL_CHARACTER_ID`。
- C: コンボ比較でダルシムのコンボを比較中 → コンボ追加モーダル → 既定がダルシム。
- D: 既存 E2E（M10-01 / 閲覧系キャラ動的化 / combo-crud）非回帰。

---

## §7 完了条件（DoD）

- **機能要件**: §1.2 の状態。§5.2 シナリオ A〜D が手動 E2E で通る。
- **自己テスト**: §5.1 全ケース通過。
- **品質チェック**: 型・lint 通過。M10-01／閲覧系に非回帰。
- **ドキュメント**: 完了報告に Plan Mode 最終 view 確認結果・推測内容・テストケース数。DES 変更は設計担当が CHANGE-039 で反映済み（製造は DES を直接編集しない）。
- **完了報告**: 実装裁量・乖離・要確認を報告。**実機 E2E が完了の必須ゲート**。

> §5 ↔ §7 リンク: §5.1 → DoD 自己テスト、§5.2 A〜D → DoD 機能要件・実機ゲート。

---

## §9 注意事項

### §9.1 推測 NG（必ず view で確認）

- 文脈キャラ伝播機構（route param か nav state か）/ ComboEditor の初期値受け口（RHF defaultValues か局所 state か）/ AddComboToCompareModal の現状の既定キャラ固定箇所 / ComparePage の比較リスト先頭コンボ取得経路。**実装済み/未実装を想定で決めない**（playbook §4.12、retrospective-digest §1 パターンA）。

### §9.2 推測 OK（裏取り済みの事実）

- 新規モード既定 = `INITIAL_CHARACTER_ID`（M10-01 製造判断 #2）。`AddComboToCompareModal` が CharacterSelector を import 済み（製造報告 #1）。登録系 API は character_id 既存（code-facts §7-2）。既定キャラ文脈追従は CHANGE-039（DES-005 v2.21.0）で確定。

### §9.4 Plan Mode 必須項目（§3.4 と同一）

§3.4 の 1〜3（伝播機構 / ComboEditor 初期値受け口 / ComparePage→モーダル経路）の実 view 最終確認。

---

*M10-02 製造指示書 v1.0.0。配置 `docs/instructions/M10-02-instruction.md`、対のレビューチェックリストは `docs/instructions/reviews/M10-02-review-checklist.md`（v1.0.0）。*
