# M19-07 完了報告: コンボ新規登録時のセットプレイ成立条件の入力

| 項目 | 内容 |
|------|------|
| 対象指示書 | `docs/instructions/M19-07-bundled-setup-verified-conditions.md` v1.0.0 |
| チェックリスト | `docs/instructions/reviews/M19-07-review-checklist.md` v1.0.0 |
| 実装ブランチ | `claude/m19-07-bundled-setup-conditions-4k08h7`（分岐点 `d7710a6`） |
| マイグレ | **非消費**（`migrations/` に diff 0） |
| CHANGE | **要**（判定は §8）。**起票は設計卓。製造は DES 本体を編集していない** |
| 作成日 | 2026-08-09 |

---

## 1. 実装したもの

**コンボの新規登録・コピー時に、同梱で作るセットプレイの「確認できた条件」を入力し、コンボと同一トランザクションで `combo_setup_results` へ記録できるようにした。**

**★本サブは「既存の非対称を揃えるだけ」で完結した。** 新しい保存機構・新しい書き込み経路・新しい操作モデルは 1 つも作っていない。

変更は **10 ファイル・+968 / −6 行**（**うち 5 ファイルがテスト**、1 ファイルは E2E のコメントのみ）。

| 層 | ファイル | 変更 |
|---|---|---|
| API | `internal/api/combo/dto.go` | `BundledSetupRequest` に `verifiedConditions` を 1 フィールド追加 ＋ `toServiceCreateInput` に写像を追加 |
| API | `internal/api/combo/handler.go` | `ErrInvalidResultValue` → 400 の写像を 1 分岐追加 |
| FE | `web/src/features/setup/components/VerifiedConditionsField.tsx` | 新規。ステージング専用の 2×2 チェックボックス |
| FE | `web/src/features/combo/components/SetupInputRow.tsx` | 上記を配線 |
| テスト | `internal/api/combo/bundled_setup_results_test.go`／`internal/service/combo/bundled_setup_results_test.go`／`VerifiedConditionsField.test.tsx`／`SetupInputRow.test.tsx`／`ComboEditor.test.tsx` | 追加 |
| その他 | `web/e2e/m19-03-setup-results.spec.ts` | §5 走査で見つかった v1 形コメントの是正（**コメントのみ。アサーション・テスト名は不変**） |

### 1.1 ★サービス層・リポジトリ層に変更が要らなかった

指示書 §2.1 は「サービス層——コンボ作成のトランザクション内で、`combo_setups` を作った直後に `combo_setup_results` を書く」と書いており、サービス層に作業があるかのように読める。**実査の結果、そこは M19-03 の時点で既に完成していた。**

```
internal/service/setup/service.go:243  InsertComboSetup       ← combo_setups を作る
internal/service/setup/service.go:248  insertVerifiedConditions(ctx, tx, ...)
```

`CreateSetupInTx` は既に、**呼び出し側の Tx を受け取り・`InsertComboSetup` の直後に** `insertVerifiedConditions` を呼んでいた（`setup_results.go:88-90` の「呼び出し側は `combo_setups` を作った後・同一トランザクション内で呼ぶこと」の前提を満たしている）。

**壊れていたのは API 層だけ**である——`internal/api/combo/dto.go` の `toServiceCreateInput` が `VerifiedConditions` を埋めないため、同梱経路では常に空で届いていた。

⇒ `internal/service/` / `internal/repository/` に **diff 0**。R-4（新しい書き込み経路）は構造的に発生していない。

**これは指示書の前提より作業が少ない方向の食い違い**であり、前提（「片側にある形をもう片側へ揃える」）は崩れていないため、報告のうえ実装を続行した（PARENT-E21 の趣旨に照らして停止不要と判断）。

---

### 1.2 ★【2026-08-10 追補】開発者要望 2 件を実装（BE 無変更）

実機確認を受けて 2 件の要望が入り、実装した。**`internal/` に diff 0**（FE のみ）。

| # | 要望 | 対応 |
|---|---|---|
| 1 | **「確認できた条件（任意）」が分かりにくい。詳細画面の「成立条件を編集」と見た目を揃えたい** | `VerifiedConditionsField` を `SetupResultEditor` と**同じテーブル構造・同じ Tailwind クラス**で描き直した（列＝受け身種別／行＝画面端／セルに状態アイコン／凡例） |
| 2 | **セットプレイ登録画面（`/combos/:comboId/setups/new`）でも入力したい** | 同フィールドを `SetupEditorPage` の **create モードにのみ**追加。作成 payload に `verifiedConditions` を載せる |

**★要望 1 は、こちらの実装不足だった。** 指示書 §2.3 は「`DES-005` §5.6 項目10 と**同じ 2×2 グリッド**」を求めていたのに、`SetplaySuggestionSection` のインライン実装を流用したため **チェックボックス 4 個の横並び**になっており、「2×2」という構造が画面に現れていなかった。**指摘のほうが指示書に忠実である。**

実装の要点:

- セルは `<input type="checkbox" className="sr-only">` を `<label>` で包み、label へ編集画面のセルと同じクラス（`rounded border px-2 py-1` ／ チェック時 `border-blue-500 bg-blue-50 ring-1 ring-blue-300`）を当てた。**見た目を揃えつつ、複数選択のセマンティクスと既存 `data-testid` を保つ**ため（既存テストが無改変で通る）。
- `SetupResultLegend` に **optional な `states`** を追加し、本フィールドは `[ok, unverified]` の 2 値だけ出す。**選べない「不成立」を凡例に出すと誤読される**ため。既定値は現行と同一で、**コンボ詳細側の DOM は不変**。
- 呼び出し面の枠に合わせる `variant`（`"inline"` 既定／`"section"`）を追加。
- **★`mode === "create"` のときだけ出す。** `/setups/:setupId`（編集）と**同一コンポーネント**であり、`DES-005` §5.6 が編集画面は「実装しない（開発者判断 2026-07-28）」と明記しているため。

**★E2E が a11y 欠陥を 1 件検出した**——`sr-only` の checkbox は**フォーカスされても視覚的な手がかりが出ない**（Playwright が「アイコンがポインタを遮る」で落ちたのが発端）。label に `focus-within:ring-2 focus-within:ring-blue-400` を足して是正した。**「テストが落ちた原因を回避する」で終わらせず、落ちた理由が指している実際の欠陥を直した。**

**BE 変更がゼロで済んだ理由**: `POST /api/combos/{comboId}/setups` は M19-03 で既に `verifiedConditions` を受け付け、`InsertComboSetup` の直後・**同一 Tx 内**で書いている（`internal/service/setup/service.go:179-188`）。TS の `CreateSetupInput` にもフィールドがある。**FE の配線だけで足りた。**

**v3 原則の判定**: セットプレイ登録画面は **URL に `comboId` があり親が確定している**＝`親確定 ○`。

**⇒ `DES-005` への反映が要る**（§8 の CHANGE 範囲に追加）。§5.9 の表示項目に成立条件が無く、§5.6 の v3 判定表にも登録ルートの行が無い。

---

## 2. §3-2 の突合結果（`BundledSetupRequest` × `CreateSetupRequest`）

**差は `verifiedConditions` だけだった。** 前提は崩れていない。

| # | `BundledSetupRequest`（`api/combo/dto.go:98`） | `CreateSetupRequest`（`api/setup/dto.go:16`） | 判定 |
|---|---|---|---|
| 1 | `CharacterID int64` `json:"characterId"` | 同一 | 一致 |
| 2 | `Name *string` `json:"name,omitempty"` | 同一 | 一致 |
| 3 | `Description *string` `json:"description,omitempty"` | 同一 | 一致 |
| 4 | `Steps []BundledSetupStepRequest` `json:"steps"` | `Steps []SetupStepRequest` `json:"steps"` | **Go の型名だけ違う。要素の構造・JSON タグは完全一致**（`MoveID *int64` / `Modifiers *model.Modifiers`）。ワイヤ契約としては差なし |
| 5 | 無し → **追加した** | `VerifiedConditions []SetupResultConditionRequest` | **唯一の実差** |

どちらにも validate タグは無く（検証はサービス層の手書き）、タグ差もゼロ。

### 2.1 ★付随して見つかった構造の重複（本サブでは統合していない）

上表 #4——`BundledSetupStepRequest` と `SetupStepRequest` は **構造が同一で名前だけが違う型が 2 つ** ある状態である。

- **統合しなかった理由**: §8.3「対称にするを超えないこと」。R-8 が禁じているのは「**同名で中身が違う型**」であり、これは「**別名で中身が同じ型**」＝別事象である。統合は `api/combo` の公開 DTO 名を消すことになり、対称化の範囲を超える。
- **設計卓へ**: 上げるほどの案件ではないと判断した（`verifiedConditions` 以外の**契約上の差**ではないため §7.3 の条件に該当しない）。記録として残す。

---

### 2.2 §3-8 の実査結果（`SETUP_RESULT_CELLS` と `OKI_TECH_TYPES` の BE / FE 値域一致）

**一致している（2 値 × 2 値 = 4 セル）。**

| 側 | 定義 | 値 |
|---|---|---|
| BE | `internal/model/combo.go:54-65` `OkiTechTypes` | `["neutral_tech", "back_tech"]` |
| BE 判定 | `internal/model/setup.go:85-90` `IsValidOkiTechType` | `slices.Contains(OkiTechTypes, v)` |
| FE | `web/src/constants/oki.ts:15` `OKI_TECH_TYPES` | `["neutral_tech", "back_tech"]` |
| FE セル | `web/src/constants/setup-result.ts:42-44` `SETUP_RESULT_CELLS` | `OKI_TECH_TYPES × SETUP_IN_CORNER_VALUES([false, true])` ＝ **4 セル** |

`inCorner` は `bool` のため BE 側に値域検証は不要・不可能（DB は `BOOLEAN NOT NULL`）。

**★片側だけ値が増えたときに機械的に検出する手段は現状無い**（CLAUDE.md §4 の grep 運用に依存）。追加した BE テストの `allCells()` は `model.OkiTechTypes` 由来なので **BE 側の増加は検出できる**が、FE 側 `SETUP_RESULT_CELLS` との突合は誰も見ていない。**followup 候補**（§11-6）。

---

## 3. パッケージ境界を跨ぐために採った形と理由（§2.1）

**採った形＝`internal/api/combo` から `internal/api/setup` を import し、`setupapi.SetupResultConditionRequest` を**そのまま使う**（型を 1 つも新設しない）。**

```go
// internal/api/combo/dto.go
VerifiedConditions []setupapi.SetupResultConditionRequest `json:"verifiedConditions,omitempty"`
```

| 案 | 内容 | 採否 |
|---|---|---|
| **A** | `api/setup` を import して型をそのまま使う | **採用** |
| B | `combo` 側に type alias を置く | 不採用。名前が 2 つになり「別型では？」の疑いを生む。宣言ゼロの A で足りる（`service/combo/service.go:87,90` に alias の前例はあるが、あちらは repo 型を service の公開 API として再輸出する必要があった） |
| C | 共有 DTO パッケージへ移動 | 不採用。該当パッケージが既存に無く、`api/setup` 側の既存参照を全部書き換える。対称化の範囲を超える |
| D | `combo` 側に同名同構造の型を定義 | **不採用（R-8 に直撃）** |

**A の安全性（実査）**:

- `internal/api/setup` は `internal/api/combo` を **テストを含め一切 import していない**（`grep -rn 'internal/api/combo' internal/api/setup/` が 0 件）。**循環しない。**
- 層としては handler 層内の同層参照であり、`DES-002` §2「依存方向は上から下への一方向とし、下位層は上位層を参照しない」に反しない（上位層を参照していない）。
- `internal/api/combo/dto.go` は既に `setupsvc "internal/service/setup"` を import しており、setup ドメインへの依存自体は新規ではない。

⇒ **`SetupResultConditionRequest` は DB 上に 1 つだけ**（R-8 クリア）。

---

## 4. `SetupResultGrid` / `SetupResultEditor` を再利用したか（§2.3）

**どちらも再利用しなかった。理由は以下。** 代わりに **別の既存実装と同じ操作モデル**を採った。

| 対象 | props | 再利用不可の理由 |
|---|---|---|
| `SetupResultGrid`（`SetupResultGrid.tsx:118`） | `{ results?: SetupResultCell[] }` | (1) **表示専用**で `onChange` を持たない。(2) 入力が `SetupResultCell[]` ＝ **`setupId: number` 必須**で、未発番の同梱セットプレイでは作れない。(3) `hasAnyResult()` が false のとき `null` を返す＝**全セル未検証の既定状態では何も描画しない**（本サブの既定と正面衝突する） |
| `SetupResultEditor`（`SetupResultEditor.tsx:41-46`） | `{ comboId, setupId, results?, onChanged }` | (1) `useSetupResultMutations(comboId, setupId, …)` を内部に持ち、**1 クリックごとに即時 API 書き込み**する。(2) `comboId`・`setupId` とも新規登録時には存在しない。**これをそのまま載せることが R-9（v3 原則違反＝M19-01 の再発）そのもの** |

**代わりに再利用したもの（第 3 の語彙を作らないための正典）**:

| 対象 | 出所 |
|---|---|
| `SETUP_RESULT_CELLS` / `setupResultCellKey` | `web/src/constants/setup-result.ts:42-49` |
| `OKI_TECH_TYPE_LABELS` | `web/src/constants/oki.ts:26-29`（項目6 由来） |
| `cornerLabelKey()` → `setupResult.corner.inCorner` / `.midScreen` | `SetupResultGrid.tsx:114-116`（**項目10 のグリッドと同じ i18n キー**） |
| legend / hint の i18n キー `setplay.confirmedConditions*` | ja/en とも既存。**項目12 の採用ダイアログと同じ文言** |

**★操作モデルの先例**: `web/src/features/setplay/components/SetplaySuggestionSection.tsx:573-597`（提案の採用ダイアログ＝項目12）が **同じ 2×2 チェックボックス**をインラインで持つ。本サブはこれと同じ操作モデル・同じ語彙・同じ i18n キーを使い、**新しい操作モデルを作っていない**。

**★共通コンポーネント化の範囲（判断）**: 新規 `VerifiedConditionsField` は **本サブの新規箇所でのみ使い、`SetplaySuggestionSection` のインライン実装は差し替えていない**。§8.3「対称にするを超えないこと」を優先し、diff を本サブのスコープに閉じた。**結果として同じマークアップが 2 か所に残る**——これは既知の限界（§9-1）であり、followup 候補として上げる。

---

## 5. §2.5 の 2 件の判定

### 5-1 `SetupSelectorModal` — **触らなかった。v3 原則には反していない。**

**★触らなかったことと、気づかなかったことは違う（指示書 §2.5 の但し書き）。以下が実査結果である。**

`web/src/features/combo/components/SetupSelectorModal.tsx`（全 87 行）を全数読んだ。

| 観点 | 実査結果 |
|---|---|
| ネットワーク呼び出し | **読み取り 1 本のみ**。`useSetupCandidatesByKnockdown`（`:29-32`）→ `GET /api/setups/candidates`。**書き込みは 1 本も無い** |
| 選択時の挙動 | `onSelect(setup)` を呼ぶだけ（`:66`） |
| 唯一の利用元 | `SetupRegistrationSection.tsx:127-134`。`handleSelectExisting`（`:51-54`）が `linkedSetups` 配列へ **ステージング**する |
| 実際の紐付け | `POST /api/combos/{comboId}/setup-links` は **コンボ作成成功後**に、発番された `data.id` を使って `ComboEditor.runCreate` の `onSuccess` で発火（`:357-370`） |

⇒ **紐付けの「保存」時点では親コンボが確定している。** モーダル自身は保存 UI ではなく **選択 UI** であり、v3 原則（「保存 UI を置く面は、保存先の親が確定しているか、親と同一 Tx でコミットできること」）に **適合している**。**M19-01 の再発ではない。**

**触らない理由は 2 つあり、どちらか一方でも十分である**:

1. **スコープ外**（指示書 §1.3-2）。既存セットプレイの紐付けへの成立条件入力は本サブの対象外。
2. **同一 Tx 要件を満たせない**。link の POST は **コンボ作成の Tx の外**（作成成功後の別リクエスト）で走るため、そこに成立条件を載せると G-1 を満たせない。

**対照（親が確定している面には既に即時保存の口がある）**: `LinkExistingSetupModal`（`ComboDetailPage.tsx:189-196`。ヘッダコメントに「詳細画面はコンボ保存済みのため comboId が常に存在する。」）／`SetplaySuggestionSection` の採用（`setupApi.create(comboId, input)`）。

### 5-2 `CreateSetupRequest` を使う既存の面 — **影響しない（diff 0 で実証）**

`git diff --stat d7710a6 -- internal/api/setup/` が **空**。`POST /api/combos/{comboId}/setups` / `PUT …/results` / `DELETE …/results` の経路は 1 行も変わっていない。既存テスト（`internal/api/setup/setup_results_handler_test.go:229,261` ほか）は無改変で green。

---

## 6. 同一 Tx であることをどう検証したか（テスト名）

| テスト | 何を固定するか |
|---|---|
| `TestService_Create_BundledVerifiedConditions_RolledBackWithCombo`<br>（`internal/service/combo/bundled_setup_results_test.go`） | ★**中心**。1 本目の同梱セットプレイに成立条件を載せ、2 本目を VAL-S02 でエラーにする。**`combos` / `setups` / `combo_setups` / `combo_setup_results` の全 4 表が 0 行**であることを固定。「1 本目の結果行だけが親を失って残る」ことが起きない |
| `TestService_Create_BundledVerifiedConditions_RolledBackOnCharacterMismatch` | キャラクター不一致で落ちた場合も同じく残らない |
| `TestService_Create_BundledVerifiedConditions_OutOfRangeTechType` | 値域外 `techType` でも `combos` ごと巻き戻る（結果行だけ先に書かれていない） |

ロールバック検証では **コンボ ID が発番されない／巻き戻る**ため、`comboID` で絞ると「消えたのか、そもそも書かれなかったのか」を区別できない。したがって `countAllSetupResults`（DB 全体）で数えている。

### 6.1 §4 の 11 要件の充足

| # | 要件 | 固定した場所 |
|---|---|---|
| 1 | 同一 Tx（失敗で両方残らない） | 上表 3 件 |
| 2 | 渡すと `result='ok'` の行が入る（セルの組を明示） | `TestService_Create_BundledVerifiedConditions_RecordsOnlyGivenCells`（`(tech_type, in_corner)` の組を期待値と完全一致で比較） |
| 3 | 渡さない／空で 0 行 | `TestService_Create_BundledWithoutVerifiedConditions_NoRows`（nil / 空配列の 2 ケース） |
| 4 | ★渡したセルと渡さなかったセルを**対で**固定 | 同 `RecordsOnlyGivenCells`。(a) 入った組の完全一致 (b) **渡さなかった 2 セルが各 0 行** (c) 値域が 4 セルであることの検算（given + notGiven == `allCells()`）。**件数だけ見ていない**（`SUPP-001` §5.5.2 (3)） |
| 5 | `ng` と note が入らない | `TestService_Create_BundledVerifiedConditions_OnlyOkNoNote` |
| 6 | 不正 `techType` が 400 | `TestHandler_Create_400_InvalidVerifiedConditionTechType`（`internal/api/combo/`） |
| 7 | `copy` で引き継がれない | `ComboEditor.test.tsx`「M19-07 copy モードで成立条件を引き継がない」3 件 |
| 8 | `CreateSetupRequest` 経路が不変 | `internal/api/setup/` に diff 0（§5-2）＋既存テスト無改変で green |
| 9 | 渡さない既存の作成が同じ結果 | `TestHandler_Create_WithoutBundledVerifiedConditions`（省略／空配列）＋既存 `TestService_Create_With{Nil,Empty,One,Multiple}Setups_OK` が無改変で green |
| 10 | FE 既定が全セル未チェック／即時保存しない | `VerifiedConditionsField.test.tsx`（8 件）＋ `SetupInputRow.test.tsx`「成立条件のステージング入力」4 件。**`fetch` を spy して呼ばれないことを固定**（R-9 の回帰ガード） |
| 11 | E2E 非回帰 | §7.1（**70 passed / 0 failed**） |

**追加で入れたもの**: `TestHandler_Create_PassesBundledVerifiedConditions`（★**本サブが実際に変えた API 層の写像**を固定する。ワイヤの `verifiedConditions` がサービス層の `CreateSetupInput` へ届くこと）／`…_PerSetup`（複数同梱でセルが setup 間で入れ替わらないこと）／`TestService_Create_BundledVerifiedConditions_PerSetup`（DB 側の振り分け）。

**★§4-1〜5 のサービス層テストは、本サブの変更が無くても green になる**（サービス層は M19-03 で完成していたため）。**このサブの実質的な回帰ガードは API 層のテスト**である。両方置いた理由は、指示書 §4 が要求する契約（同一 Tx・セルの対）を DB 実体で固定することと、変更点そのものを固定することは別の目的だからである。

### 6.2 HEAD 依存の確認（`SUPP-001` §5.5.2 (1)(2)）

**本サブはマイグレを消費しない。** 追加したテストはいずれも **自分で作成したコンボ／セットプレイの行しか数えず**、seed 済みデータの件数を期待値に持ち込まない（`countCombos` は既存ヘルパで seed コンボを除外済み、`countAllSetupResults` / `countAllComboSetups` は seed が 0 行の表を数える）。**後続の seed 波で落ちる HEAD 依存は無い。**

---

## 7. 検証結果

```
go build ./...                      OK
go vet ./...                        OK（出力なし）
gofmt -l internal/ cmd/             出力なし
go test ./...                       46 パッケージ すべて green
pnpm lint (tsc --noEmit)            OK
pnpm test --run                     120 files / 949 tests green（M19-07 着手前 119 / 924 → 本体 120 / 940 → 追補 120 / 949）
```

### 7.1 E2E — **73 passed / 0 failed（2.5 分）**

M19-07 本体では新規 spec を作っていない（非回帰のみ・70 passed）。**2026-08-10 の追補で `web/e2e/m19-07-setup-conditions.spec.ts` を新規追加**し、**73 passed** になった（A: 登録画面で 2×2 にチェック → 保存 → 渡したセルだけが成立で記録される／B: ★編集画面 `/setups/:id` には入力が無い／C: チェックせずに登録できる）。

**M19-03 の spec を 1 行変更している**——`m19-03-setup-results.spec.ts` が `setplay-confirmed-*` を直接 `.check()` していたが、追補でセルの checkbox が `sr-only` になりクリック不能になるため、label クリックへ変更した（挙動の変更ではなく操作方法の追随）。

実行コマンド:

```bash
PW_EXECUTABLE_PATH=/opt/pw-browsers/chromium pnpm exec playwright test
```

（`pnpm exec playwright install chromium` は本実行環境ではダウンロードが遮断されるため、プラットフォーム同梱の Chromium を `PW_EXECUTABLE_PATH` で指す。この escape hatch は `playwright.config.ts:74-77` に既存。)

**1 回目は 36 passed / 34 failed だった。M19-06 が記録したのと同一の環境要因であり、本サブとは無関係。**

- **原因**: **fresh clone に `config.toml` が無く**（`.gitignore:72` で管理外）、初回セットアップウィザードで止まる。`initialize()` を持つのは `m18-*` / `m19-*` 系の spec だけで、それらだけが通っていた。
- **切り分け**: 1 回目の実行中に `m18-*` / `m19-*` 系が `PUT /api/config` で初期化を書き込んだため、`config.toml` が生成された。**そのまま全数を再実行して 70/70 green。**
- 落ちた 34 件の顔ぶれ（`character-default` / `combo-crud` / `combo-csv-io` / `m12-*` / `m14-03d/e` / `m15-*` / `m17-*`）は **M19-06 完了報告 §9 の記載と一致**する。
- **本サブが編集した `m19-03-setup-results.spec.ts` は 1 回目・2 回目とも全 8 件 green**（コメントのみの変更のため当然だが、明示しておく）。

**★申し送り（M19-06 から継続）**: fresh clone での 1 回目の E2E は初期化の有無で結果が変わる。**落ちた spec 名だけを見て回帰と読むと誤る。**

### 完了条件（§6）の機械確認（分岐点 `d7710a6` との比較）

| 条件 | 結果 |
|---|---|
| `migrations/` に新規ファイルなし | **diff 0** |
| `moves` に触っていない（契約 F-1〜F-6） | `character_data/` `internal/seedgen/` **diff 0**。`moves` への SQL / マイグレなし |
| `internal/service/punishfinder/` ／ `setplay/` に diff 0（契約 §3.2） | **diff 0** |
| `CreateSetupRequest` を変更していない | `internal/api/setup/` **diff 0** |
| 新しい書き込み経路を作っていない | `internal/repository/` ／ `internal/service/setup/` **diff 0** |

---

## 8. CHANGE の要否の判定結果

**要。** ただし **起票は設計卓**（指示書 §7.2-8。**製造は DES 本体を 1 文字も編集していない**）。直前の M19-06 と同じ扱いとした。

| 項目 | 内容 |
|---|---|
| **番号** | **★`096`**（下記 8.1） |
| 反映先 | **`DES-002`**（`POST /api/combos` の `setups[]` に `verifiedConditions` を追加）／**`DES-005` §5.7**（コンボ登録画面のセットプレイ登録セクションに成立条件の 2×2 入力を追加。表示項目11） |
| `DES-003` | **変更なし**（`combo_setup_results` の形は CHANGE-087 で確定済み） |
| `DES-006` | **変更なし**（VAL を足さない＝ボード D-27。VAL-S05 は既存で満たす） |
| スキーマ変更 | **なし**。マイグレ **非消費**（次の空き連番 `000069` は不変） |

### 8.1 ★CHANGE 番号のレジストリが失効している（設計卓へ）

`change-number-registry.md:126` は「**次回起票は 095 から採番**」と書いているが、**`docs/change-notes/CHANGE-095-notification.md` が既にディスク上に存在する**（`# CHANGE-095 通知書: コンボ一覧に成立条件の絞り込みを追加（M19-06）`・起票日 2026-08-09）。

- **レジストリの §1 表は 094 行までしか無く、095 の行が無い。**
- **契約 `m18-m19-contract.md:102` の §4 採番表も `094` のまま。**
- ⇒ **本サブの番号は `096`。** レジストリと契約 §4 の両方の更新が要る（**★契約 §3.2 の注記が「本欄と §4 採番表は同じ数字である。片方だけ直さないこと」と警告している形と同型**）。

**これはレジストリ自身が予告していた失効である**——同ファイル 126 行が「★この行は連番を消費するサブが完了するたびに古くなる」「サブの完了報告と対で更新する運用が要る」と書いている。**本報告がその「対」にあたる。**

---

## 9. §5 否定形確認の走査結果

走査キーワード: `セットプレイ編集画面に置かない` / `保存先が一意に特定できない面` ＋ 近縁変形（`成立条件 UI を置かない` / `置かない` / `一意に特定`）。**3 系統すべて**を走査した（チェックリスト §7.2）。

| 系統 | 結果 |
|---|---|
| **本番コード**（`internal/` `cmd/` `web/src/` の `*.go` `*.ts` `*.tsx` `*.sql`） | **0 件**。`置かない` の 4 ヒットはファイル配置・UI 配置の別文脈（`canary_*_test.go` の配置注意、`PunishList.tsx:102`、`punish/api.ts:207`） |
| **テスト資産** | **★1 件**（下記 9-1） |
| 設計文書・指示書・overview | 16 か所。`05-screen-design.md:323-324` と `M19-overview.md:312-313` は **除外対象の撤回記録**。他も `change-report-087:35` / `playbook:891` / `retrospective-log:1166` / M19-03 の完了報告など **全て歴史・教訓記録**。ただし **`docs/instructions/M19-03-setplay-condition-record.md:241,439` は撤回マーカー無しの v1 文言**（完了済みサブの指示書＝歴史文書だが、マーカーが無い）→ 設計卓へ（§10） |

### 9-1 ★テスト資産のヒットと是正

`web/e2e/m19-03-setup-results.spec.ts:349`（是正前）:

```ts
// §4.4.1: セットプレイ編集画面には成立条件 UI を置かない(comboId を持たないため)。
```

- **アサーション自体は正しい。** `DES-005` §5.6（`05-screen-design.md:335,340`）が「セットプレイ編集画面 `/setups/:id` は**実装しない**（開発者判断 2026-07-28）」と現行で述べており、括弧内の理由 `(comboId を持たないため)` も **v3 の理由**である。
- しかし **文言の形が v1（画面名による禁止）**であり、指示書 §5 が警告する「後続担当やレビューが『M19-01 の再発』と誤判定して弾く」形にあたる。**本サブ自身が、まさに同じコンボエディタ上に保存 UI を載せるサブである。**
- **是正**: コメントに v3 の根拠（保存先が確定しない／開発者判断で実装しない）と、「同じコンボエディタ上でも同一 Tx でコミットできる面は v3 で ○」を明記した。**アサーション・テスト名は 1 文字も変えていない。**

---

## 10. 設計卓へ上げてほしいもの（§7.3）

| # | 内容 | 該当条件 |
|---|---|---|
| 1 | **CHANGE 番号レジストリと契約 §4 が 094 で失効している**（§8.1）。実在する最新は `CHANGE-095`（M19-06）。本サブは `096` | 運用（レジストリの管掌は設計卓） |
| 2 | **§5 の走査で v1 形の残骸が実装側（E2E spec）に 1 件見つかった**（§9-1）。コメントのみ是正済み | §7.3-3 |
| 3 | **`docs/instructions/M19-03-setplay-condition-record.md:241,439` に撤回マーカー無しの v1 文言**が残っている。歴史文書だが、`M19-引き継ぎキット.md:98` が警告する誤判定の元になり得る | §7.3-3 |
| 4 | `docs/handover/M19-引き継ぎキット.md:98` が「§2-h の v3 への改訂を**中央へ請求済み**」と未完了形。v3 は既に `DES-005` §5.6 へ着地済み（陳腐化） | 参考 |
| 5 | **単独作成 `POST /api/combos/{comboId}/setups` は値域外 `techType` を 500 で返す**（§11-2）。本サブでは直していない | 参考（followup 候補） |

**該当しなかったもの**: §7.3-1（`verifiedConditions` 以外の差）＝**無し**。§7.3-2（`SetupSelectorModal` が v3 に反する）＝**反していない**。§7.3-4（契約の条項に触れる）＝**触れていない**。§7.3-5（マイグレが必要）＝**不要**。

---

## 11. 既知の限界

1. **同じ 2×2 チェックボックスのマークアップが 2 か所に残る**——新規 `VerifiedConditionsField`（コンボエディタ）と `SetplaySuggestionSection.tsx:573-597` のインライン実装（採用ダイアログ）。**語彙・セルの組・i18n キーは同一の正典を参照している**ため表記揺れは起きないが、将来セルが増えたときに片肺更新の危険がある。§8.3 を優先して差し替えを見送った。**followup 候補。**

2. **★単独作成の値域外 `techType` は 500 のまま**。`internal/api/setup/handler.go:46-53` が `ErrInvalidResultValue` を写像しておらず、`POST /api/combos/{comboId}/setups` は値域外を **500 `internal_error`** で返す（M19-03 からの既存挙動）。本サブは **同梱経路にだけ 400 の写像を足した**（§4-6 の要件）。**結果として「同梱は 400・単独は 500」という新しい非対称ができている。** 直さなかったのは §4-8 / R-2（`CreateSetupRequest` を使う既存経路の不変）に抵触するためで、**直すなら別サブで両方を揃えるべき**である。

3. **作成レスポンスに成立条件は載らない**。`POST /api/combos` のレスポンス `setups[]`（`SetupSummary`）は `results` フィールドを持つが、作成ハンドラは埋めていない（埋めているのは GET 詳細のみ）。FE は保存後にコンボ詳細へ遷移して GET し直すため実害はないが、**API 単体で使うと「書いたはずの条件が返ってこない」**。指示書に要求が無く、載せると `DES-002` のレスポンス契約が変わるため現状維持とした（**開発者確認済み・2026-08-09**）。
   - **★この判断の根は 3-b にある**——「作成レスポンスの `setups[]` はそもそも本番コードの誰も読んでいない」から「`results` を足しても誰も読まない」が導かれている。

3-b. **★`POST /api/combos` のレスポンスの `setups[]` は、本番コードの消費者がゼロである**（開発者依頼により調査・2026-08-09。**将来のデッドコード削除検討のための申し送り**）。

| 消費者候補 | 結果 |
|---|---|
| **FE 本番コード** | **読んでいない**。`useCreateCombo` は `invalidateQueries` のみで `setQueryData(["combo", id], data)` をしない（`web/src/features/combo/api.ts:174-181`。それをするのは PUT の `:211` だけ）。`ComboEditor.handleSaveSuccess`（`:324-329`）が読むのは `data.id` / `data.characterId` / `data.validations` のみ |
| **E2E** | **読んでいない**。`combo.setups` を読む 6 か所（`m19-01:84` / `m19-02:66` / `m19-03:63,199,218,314`）は**すべて `GET /api/combos/{id}` のレスポンス** |
| **Go ハンドラテスト** | **★読んでいる**。`TestHandler_Create_201_WithSetups`（`internal/api/combo/handler_test.go:1435-1474`）が `resp.Setups` の件数と ID を assert |
| **BE** | 読んでいない（レスポンス DTO であり書き出すだけ） |
| **`DES-002` §4.2** | `POST /api/combos` の行は **「コンボ新規登録」の 1 行のみ**で、レスポンス形状を規定していない |

**⇒ 厳密には「デッドコード」ではない**（テストが 1 本 assert しており、型 `ComboResponse.Setups` は GET 詳細で現役）。**しかしその test はこの挙動を assert するためだけに存在しており、独立した消費者ではない。** 実体は **「コンボ作成のたびに走る余分な `ListSetupsByComboID` クエリ 1 本 ＋ 誰も読まないペイロード」**である。

**★削除を検討する際の注意**:

- **`ComboResponse.Setups` フィールド自体は消せない**（GET 詳細が現役で使う）。消せるのは **`Handler.Create` の埋め込みブロック（`internal/api/combo/handler.go:66-90`）だけ**。
- `TestHandler_Create_201_WithSetups` の削除・改修が要る。
- **レスポンスからフィールドが消える＝後方互換を破る変更**のため **CHANGE が要る**（`DES-002` が形状を明記していなくても、実装が返しているものを消すのは契約変更）。
- 併せて `resp.Setups == nil` のとき `[]SetupSummary{}` に正規化している行（`handler.go:88-90`）の要否も判断する。

**設計卓へ**: `followup-backlog.md` §H（M19 課題記録）への登録を依頼した（設計伝達レポート §8）。**製造は同書を直接編集していない**（§H・§I が「中央登録」と明記しているため）。

4. **`copy` モードは「成立条件だけ」ではなく「同梱セットプレイごと」引き継がない**。`ComboEditor.tsx:145-146` が `setupsToCreate` / `linkedSetups` をモードに依らず空配列で開始し、`initial.setups` は copy 経路から読まれていない（`:284` `:333` `:415` `:602` の 4 か所は全て edit 専用）。**これは M19-07 以前からの挙動**であり、`DES-005` §5.7:374（「セットプレイは引き継がず、ユーザーが新規に追加する形とする」）どおりである。**本サブは変えていない**（N-7 の「成立条件以外の引き継ぎ」も現状のまま）。テストで固定した。

5. **`docs/handover/code-facts.md` を再生成した際、M19-05 / M19-06 の未反映分も一緒に取り込まれた**（`ListFilter` の 3 列・`MoveCandidate` の 3 列・`MoveDerivation` の新規行）。生成物であり、本サブが手で書いた差分ではない。

6. **BE / FE の値域一致を機械的に固定する手段が無い**（§2.2 末尾）。followup 候補。

7. **★`PUT /api/combos/:id`（キー変更編集）では `verifiedConditions` が黙って無視される**（レビュー指摘・2026-08-09）。`CreateRequest` は POST と PUT で共用され（`dto.go:21` のコメントどおり・`handler.go:371` が `toServiceCreateInput(req.CreateRequest)` を呼ぶ）、**サービス層で `input.Setups` を読むのは `Create`（`service.go:252-253`）だけ**で `UpdateWithKeyChange` は一切読まない（`grep 'Setups' internal/service/combo/service.go` が 82/83/252/253 の 4 行のみで、他は `CountComboSetups*` / `DeleteComboSetups*` ＝別物）。
   - **これは `setups` 自体が以前から同じ扱い**であり、**本サブが作った不具合ではない**。FE は edit モードで `setups` を送らないため実害も無い。
   - しかし本サブは「`edit` には入力 UI を出さない」を明示的な仕様として選んでいるため、**`DES-002` 反映時に「同じリクエストボディを持つ PUT では無視される」を併記しないと、API 単体利用者が「PUT でも書ける」と読む**。設計伝達レポート §4-8 で設計卓へ上げた。
   - PUT 経路に `ErrInvalidResultValue` → 400 の写像が無い点も同根だが、**無視される以上そのエラーは発生しない**ため実害は無い。

---

## 12. 推測で進めた箇所

全数は設計伝達レポート §5 に列挙した。要旨:

| # | 推測した事項 | 採った案 |
|---|---|---|
| 1 | パッケージ境界を跨ぐ手段（§8.2 で推測可） | import して型をそのまま使う（§3） |
| 2 | 新規コンポーネント名・配置 | `web/src/features/setup/components/VerifiedConditionsField.tsx`（既存の `SetupResult*` と同ディレクトリ） |
| 3 | `data-testid` の命名 | `setup-input-confirmed-{index}-{cellKey}`（`setplay-confirmed-{cellKey}` の流儀に合わせ、行ごとに index を挟む） |
| 4 | 400 のエラーコード・文言 | `invalid_setup_result` / 「受け身種別または検証結果の値が不正です」（`api/setup` の `setupResultError` と同一。第 3 の語彙を作らない） |
| 5 | 共通コンポーネント化の範囲 | 新規箇所のみに適用（§4 末尾） |
| 6 | CHANGE 通知書を製造側で起票しないこと | M19-06 に揃えた（§8） |
| 7 | 作成レスポンスに `results` を載せないこと | 現状維持（§11-3） |

---

*以上、M19-07 完了報告。**片側に既にある形を、もう片側へ揃えるだけで完結した。***
