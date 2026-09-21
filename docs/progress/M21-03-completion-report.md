# M21-03 完了報告: レシピ入力への接続 ＋ 読取表示（`FR105` / `FR106`）

| 項目 | 内容 |
|------|------|
| 対象指示書 | `docs/instructions/M21-03-recipe-input-and-readout.md` **v1.2.0** |
| チェックリスト | `docs/instructions/reviews/M21-03-review-checklist.md` **v1.2.0** |
| 対の CHANGE | `docs/change-notes/CHANGE-111-notification.md`（設計卓が起票済・registry 登録済） |
| 実施日 | 2026-08-13 |
| 基点 commit | `2812a26` |
| ブランチ | `claude/m21-03-implementation-plan-l1kuhp` |

> **★本ブランチの `docs/instructions/` は v1.1.0 のままである。** 設計卓は v1.2.0 を `ed18f36` でコミットしたが **push が拒否**されており、本ブランチへは届いていない。**製造は v1.2.0 の本体を開発者から添付で受領して実装した**（添付はブランチへコミットしていない）。**⇒ 本ブランチの指示書を読むと旧 §4.2-2「2 ボタン同時は OD 技（`_od`）」が見える。これは撤回済みである**（**D-352**）。**旧版のまま判定すると、正しい実装が「未実装」と判定される**（**D-323** の同型）。**設計卓の v1.2.0 が main へ入るまで、この食い違いは残る。**

---

## 0. 結果サマリ

| 項目 | 結果 |
|---|---|
| `cd web && pnpm test -- --run` | **1135 tests / 131 files 全緑**（着手前 1094/130 ＝ **+41 / +1**。内訳は §5.1。**うち +5 はレビュー取り込みぶん**＝§7） |
| `cd web && pnpm lint`（`tsc --noEmit`） | **exit 0**（`any` の追加・`@ts-ignore`・`eslint-disable` はいずれも **0 件**） |
| `go test ./...` | **全パッケージ ok / FAIL 0**（非回帰。バックエンドは 1 バイトも触っていない） |
| `make e2e` | **exit 0**（実装完了時 **73 passed** ／ レビュー取り込み後 **72 passed ＋ 1 flaky**。★flaky は本サブと無関係＝§5.2。★環境側の前提が 2 つ欠けており、そのままでは全件落ちる＝§8.1-1） |
| `scripts/check-enum-sync.sh` | **ベースラインどおり（増加なし）** |
| `scripts/check-browser-storage-keys.sh` | **違反なし**（台帳 8 件 / 本番 7 件。**新規ストレージキーなし**） |
| `scripts/check-artifact-integrity.sh` | **違反 1 件**（`check-md-emphasis.sh` の自己検査。**環境要因・§8.1-2**） |
| 契約 F-1 / F-3 ／ `internal/` 全体 ／ `migrations/` ／ `scripts/` ／ `docs/design/` の diff | **すべて 0**（§6.1） |
| `console.log` の本番混入 | **0 件** |
| 消費マイグレ連番 | **なし**（disk 末尾は `000075`。§1-8） |
| 消費 CHANGE 番号 | **なし**（`CHANGE-111` は設計卓が起票・registry 登録済み） |

---

## 1. §3.3 着手前実査の結果（9 項目）

> **★「確認した」ではなく、何が見えたかを書く。** **見込みと食い違った項目には ★ を付けた。**

| # | 実査結果 |
|---|---|
| **1** | **`StepCandidate`** = `{ direction: LogicalButton; buttons: LogicalButton[]; startedAt: number; closedAt: number; mergedCount: number }`（`stepDetection.ts`）。**`closedAt` は「窓が閉じた時刻」**——時間経過で閉じた場合は `startedAt + windowMs` **ちょうど**であり、タイマーの発火揺らぎは入らない。`buttons` は**空にならず**決定的順序（攻撃 6 → マクロ 3）。`direction` は **SOCD 解決済み**で生の上下左右は持たない。**⇒ 本サブは `direction` をそのまま使い、再判定していない**（§4.2-4） |
| **2** | **★合流できる。停止条件 1 は発動しない。** 解決の実体は純粋関数 **`resolveDirectionalInput(moves, entries, dir, strength, button)`** と **`resolveDirectionalRushInput(...)`**（`web/src/features/combo/inputResolutionStage2.ts`）。**段階2 の解決表引き → ミス時に `contractToZone` で 9 方向 → 3 ゾーン縮約 → 段階1 `resolveStage1MoveId` まで、この 1 関数の内側に入っている。** `HitBoxLayout` はこれを呼ぶだけで、自前の規則を持たない。**⇒ 物理側は同じ関数を呼ぶだけで合流できた** |
| **3** | 押しっぱなしの確定契機は **`useStepDetection` 内 `scheduleFlush()` の `window.setTimeout` 1 本のみ**。同じ窓（`closesAt` が不変）には張り直さない番兵つき。**⇒ 本サブは確定の契機を 1 つも足していない。** provider が `useStepDetection` を**アプリ全体で 1 個だけ**持つ形にしたため、二重発火は構造的に起こらない |
| **4** | **登録対象 13 件** = 方向 4（up/down/left/right）＋ **攻撃 6**（`light_punch` / `medium_punch` / `heavy_punch` / `light_kick` / `medium_kick` / `heavy_kick`）＋ **マクロ 3**（`drive_impact` / `drive_parry` / `throw`）。**強度の組は論理ボタン名から機械的に取れる。** **★共通技の `move_code` への既存の写像は実在した**——`useControllerInput.ts` の module 定数 **`SYSTEM_BUTTON_TO_MOVE_CODE`**（`drive_impact` / `drive_parry` / `throw`→`throw_forward` / `throw_forward` / `throw_back` / `dash_forward` / `dash_back`）。**⇒ 停止条件 5 は発動しない。** ただし**未 export だった**ため export を足し、あわせて解決本体を `resolveSystemButtonStep()` として切り出して**仮想 UI と物理の両方がそれを呼ぶ形**にした（§2.1） |
| **5** | レシピ入力面 = **`web/src/features/combo/components/RecipeBuilder.tsx`**（`code-facts` の見込みどおり）。props は `{characterId, steps: Step[], moves: Move[], movesLoading: boolean, onChange: (next: Step[]) => void}`。`Step = {id?, stepOrder, moveId?, moveCode?, modifiers?}`。**仮想コントローラからの追加は `handleVCStepAdd(partial: StepInput)` が受け、`stepOrder` を足して `reorder` する** |
| **6** | M21-02 の最小可視化 = **`web/src/features/gamepad/components/GamepadStepPreview.tsx`**。`GamepadStatusControl.tsx` の 1 行から描画され、`RecipeBuilder` → `VirtualController` の `headerSlot` 経由で本番画面に出ていた。**⇒ 撤去した**（§4.4） |
| **7** | **FB⑦ の前提は成立している。停止条件 2 は発動しない。** `jump_neutral` / `jump_forward` / `jump_back` は `category='system'` の move として seed 済み（`migrations/000004_seed_moves_ryu.up.sql` に加え、`000025` / `000054` が全キャラへ展開）。**★なお本サブでは方向のみの入力はステップを作らない**——`StepCandidate.buttons` は空にならない（M21-02 の as-built）ため、**方向入力からジャンプ動作をステップにする経路はそもそも生じない**（§4.1-1「方向は 1 つの状態」と整合） |
| **8** | **★`ls migrations/` の disk 末尾は `000075`**（`000075_m20_preset_aliases_unique`）。**M21-02 完了報告は「末尾 `000073` / 次は `000074`」と書いているが、それは同報告時点の値であり、以降 `M20` レーンが `000074` / `000075` を消費している**（M20-03 完了報告と一致）。**本サブの消費は 0 本**であり、`migrations/` の diff は 0。**自採番していない** |
| **★9** | **★2 面の差は「型の写し替えだけ」。停止条件 4 は発動しない。** **決定的な発見: 2 面はすでに同じ `VirtualController` を共有しており、同じ `onStepAdd: (step: StepInput) => void` / `onStepDelete: () => void` 契約で受けている。** `StepInput = Pick<Step, "moveId" ｜ "moveCode" ｜ "modifiers">`。レシピ面は `stepOrder` を足し、セットプレイ面は `SetupStepInput = {moveId?, modifiers?}` へ写す。**⇒ (a) ステップの型は写し替えのみ (b) `modifiers` は両面とも保持する (c) 選べる技の集合に差は無い**（どちらも同じ `moves`。セットプレイ側は `useMovesByCharacter` で自前取得）**(d) `onChange` の形は配列を返す点で同じ**。**★`moveCode` はセットプレイ側で落ちるが、`moveId` から一意に決まるため情報は失われない**（§4.3 の注記） |

### 1.1 ★実査で判明した、指示書が予見していなかった問題

**コンボ編集画面では `VirtualController` が同時に複数マウントされる。**

`ComboEditor` は「レシピ」節（`RecipeBuilder` → 入力面 1 個）と「このコンボに紐づくセットプレイ」節（`SetupRegistrationSection` → `SetupInputRow` × N → `SetupRecipeEditor` → 入力面 N 個）を持ち、**`CollapsibleFieldset` は既定 `defaultOpen = true`** である。

⇒ 素朴に入力面へ接続を置くと 2 つ壊れる。

1. **rAF ループが面の数だけ増える**（M21-01 §4.1-2 ／ M21-02 の「ループは 1 本に保つこと」に反する）。
2. **1 回の物理入力が全部の面へ同時にステップを足す。**

⇒ **単一の provider ＋ 受け手（owner）の調停**を入れた（§2.2）。**受け手の決め方は開発者判断＝「最後に触った面。選択中であることは分かりやすく表示」**（2026-08-13）。

---

## 2. ★実装の形

### 2.1 出口は `move_code`——合流点は 1 か所（§4.1・§4.9-3）

**`web/src/features/gamepad/recipeInputResolution.ts`（新規・純粋関数のみ）が唯一の合流点である。**

```
StepCandidate（M21-02 が確定）
  ↓ classifyButtons()      ← 「仮想 UI のどの操作に当たるか」までを決める（§4.1-5）
  ↓ resolvePhysicalStep()
  ├─ attack  → resolveDirectionalInput / resolveDirectionalRushInput（既存・不変）
  └─ system  → resolveSystemButtonStep（既存の写像・仮想 UI と共用）
  ↓
StepInput { moveId, moveCode, modifiers? }   ← 仮想コントローラと同一の中立な形
```

**★本ファイルは解決規則を 1 つも持たない。** 段階1 の構造引き・段階2 の解決表・`rush_<code>`・9 方向 → 3 ゾーンの縮約は、いずれも既存関数の内側にある。

**★`move_code` は `moveId` から引き直している。** 仮想 UI の `addResolvedMove` と同じ手順にして、同じ入力が同じ `move_code` になることを構造で保証するため（§5 (a) のテストはこれを外から固定する）。

### 2.2 2 面の共有（§4.9・**D-350**）

| 層 | 実体 | 個数 |
|---|---|---|
| 供給元 | `GamepadInputProvider`（`App.tsx` に 1 個） | **アプリ全体で 1 個**。rAF ループ・同時押し判定・プロファイル解決・受け手の調停 |
| 接続部品（**headless**） | `useGamepadRecipeInput`（描画なし） | 入力面ごとに 1 個。**解決は 1 モジュール** |
| 描画 | `GamepadInputNotice` / `GamepadRecipeReadout` / `GamepadStatusControl` | 入力面ごとに 1 個 |
| 呼び出し元 | **`VirtualController`** | **★2 面が既に共有していた唯一の入力面部品** |

**★セットプレイ入力面（`SetupRecipeEditor.tsx`）の変更は 0 行である。** 接続を `VirtualController` の内側へ置いたため、2 面目は自動的に有効になった。**これは §4.9 の条件が満たされていることの最も強い証拠でもある**——面ごとに書く余地がそもそも無い。

**★`VirtualController` を選んだ理由は 3 つ。** (1) 2 面が既に共有している (2) 解決に要る `moves` / 解決表 `entries` / ラッシュ版トグルの 3 つが揃う唯一の場所である (3) 出口の `onStepAdd: (StepInput) => void` が既に中立な形で、面ごとの写し替えは呼び出し元に実装済みである。

### 2.3 受け手の調停（★指示書に無い設計判断）

- 入力面はマウント時に provider へ登録する。**登録数が 0 の間はポーリングを回さない**（M21-01 §4.1-2 を維持）。
- **確定したステップ候補は受け手 1 面にだけ配送する。** 既定は最初に現れた面（＝コンボ編集画面ではレシピ入力面）。
- **入力面のどこかを触る（`pointerdown` / `focus`）と、その面が受け手になる。**
- **受け手であることは常時表示する**（`recipe-gamepad-owner`。受け手でない面は「他の面が受付中」と出る）。読取表示にも「この面は受付中ではありません」を出す。

### 2.4 点灯（§4.4）

- **状態源は論理ボタン層**（`normalizeSnapshot` の結果 ＋ `resolveDirection`）であり、**確定したステップではない**。押している間ずっと光り、離すと消える。
- `ControllerButton` に `held` prop を足し、**既存の色分け（tone / active / danger）を潰さないよう ring で重ねた**。`data-held` 属性でテストから見える。
- **★押下集合が変わったときだけ `setState` する。** rAF は約 238 Hz で回りうるため、毎フレーム再描画しない（M21-01 の申し送り 4 と同じ理由）。
- **マクロの「投げ」は方向に合わせて前投げ／後ろ投げの点灯を切り替える**——解決と同じ向きに合わせるため（§3.1）。

---

## 3. ★`CHANGE-111` の反映に必要な as-built

> **設計卓が `DES-005` §6.4・§6.4.2・§6.6 を改訂するための一次情報である。**

| # | 項目 | as-built |
|---|---|---|
| **1** | **どこへ合流するか**（§2-a） | **`inputResolutionStage2.resolveDirectionalInput` / `resolveDirectionalRushInput`**（通常技・特殊技・ラッシュ版）と **`useControllerInput.resolveSystemButtonStep`**（共通技）。**物理側に解決規則は 1 つも無い。** 合流点は `features/gamepad/recipeInputResolution.ts` の 1 ファイル |
| **2** | **読取表示**（§2-b） | **3 区画**——「押している入力」（方向テンキー ＋ ボタン名）／「確定したステップ」（技名）／**「解決できなかった入力」（入力内容 ＋ 理由）**。`data-testid` は `recipe-gamepad-readout` / `-held` / `-resolved` / `-unresolved` / `-inactive` |
| **3** | **点灯の状態源**（§2-c） | **論理ボタン層**。`ControllerButton` の `held` prop（`data-held="true"`）。**表示だけの効果であり解決に関与しない。** 方向パッド・攻撃 6 ボタン・共通技（DI/DP/前投げ/後ろ投げ）が対象 |
| **4** | **TC の連続入力**（§2-d・**§6.6-2 の回収**） | **見せ方だけを決めた。** 判定窓の外に出た入力は別ステップであり（M21-02 の as-built）、**本サブは判定を 1 つも足していない**。**TC としてまとめるデータ構造は作っていない**——レシピは 1 ステップ 1 行のまま。**連続入力は読取表示の「確定したステップ」欄に新しい順で最大 5 件並ぶ**だけである |
| **5** | **告知の置き場と文言**（§2-e） | **置き場＝入力面の常設注記**（`GamepadInputNotice`。仮想コントローラの見出し行の直下、タブより上）。**★文言の正本は `GAMEPAD_INPUT_NOTICE_POINTS` の 1 定数**であり、2 面はこれを描画する（**2 か所へ書き写していない**＝`E-76`）。**3 点**＝「素早く入力すると、別々のつもりの入力が 1 ステップにまとまることがあります。」／「ゆっくり正確に入力してください。」／**「これは不具合ではなく、入力を取りこぼさないための意図的な設定です。」** **★判定窓の実値は文言に含まれない**（テストで固定・§5.1） |
| **6** | **解決できない入力の扱い**（§2-g） | **ステップにせず、読取表示へ理由つきで出す。** 理由は **6 種**——`od_not_supported`（PP/KK）／`mixed_strength`（強度をまたぐ P＋K）／`too_many_buttons`（3 つ以上）／`unknown_combination`（対応する操作が無い）／`move_not_found`（当該キャラに技が無い）／**`rush_not_available_in_air`**（ラッシュ ON ＋ 上系方向。**★`move_not_found` と分けた**——理由は「そのキャラに技が無い」ではなく「ラッシュ版は空中に存在しない」であり、**この理由文は本項経由で設計書へ写る**ため誤った語を写さない。レビュー指摘 中-4） |
| **7** | **★OD を物理から出さないこと**（§2-g・**D-352**） | **`_od` へ写す枝はコードに存在しない。** PP / KK は `od_not_supported` として読取表示に出し、**「必殺技タブから選んでください」と利用者へ案内する**（既存の必殺技パネルで入れられる＝混在は §4.2-6 が保証）。**★テストで「`moves` に `hadoken_od` があっても OD へ解決しない」ことを明示的に固定した** |
| **8** | **★対象面は 2 つ**（§2-e′） | **レシピ入力面とセットプレイ入力面。** **接続層は共有部品 1 つであり、セットプレイ側の変更は 0 行**。**★ただし同時に複数マウントされうるため、受け手を 1 面に絞る調停を入れた**（§1.1・§2.3。**指示書に無い設計判断**） |
| **9** | **最小可視化の撤去**（§4.7） | **撤去した**（`GamepadStepPreview.tsx` ＋ そのテストを削除）。**開発用にも残していない**——本番の読取表示が同じ情報（確定したステップ）をより詳しく出すため、二重に出す理由が無い |
| **★10** | **告知・読取表示の出し分け条件**（**レビュー取り込みで確定**） | **`status === "connected"`（機体を観測できている）で出す。** provider の有無では出し分けない——**provider はアプリ全体に常設されるため、それだけで判定すると物理コントローラを一度も接続していない利用者にも常設される**（レビュー指摘 中-1）。**接続状態の表示そのもの（`recipe-gamepad-status`）は M21-01 の導線であり常に出す。** 切断時は読取表示も捨てる |
| **★11** | **§4.9-2 の「出口＝`move_code` ＋ 方向 ＋ 修飾」との差分** | **実装の出口は `StepInput { moveId, moveCode, modifiers? }` で、方向を独立フィールドに持たない。** **★方向は解決の時点で `standing_` / `crouching_` / `jumping_` として `move_code` へ畳み込まれる**ため、独立に持つと**同じ情報を 2 か所に持つ**ことになる（`E-76`）。**仮想コントローラと同一の中立形に揃えることを優先した**（面ごとの写し替えが既に実装済みで、新しい型を作らずに §4.9-2 の主旨を満たせる）。**⇒ `DES-005` へ §4.9-2 の文言をそのまま写すと実装とずれる**（レビュー指摘 低-2） |

---

## 4. §9.2 で「覆ってよい」とされた事項の判断

| # | 事項 | 判断 |
|---|---|---|
| 1 | **読取表示の見た目** | **設計卓の見込み（3 区画）どおり。** 覆っていない |
| 2 | **告知の形** | **常設の注記を採った。** 初回のみの説明にしなかった理由＝**「意図せずまとまる」に出会うのが初回とは限らない**ため。Popover にしなかった理由＝**開かないと読めない告知は、読まれないのと同じ**であるため |
| 3 | **TC の見せ方** | 読取表示の「確定したステップ」欄に新しい順で並べるだけにした。**強調表示は入れていない**——連続入力かどうかは判定窓の内外で決まり、それは M21-02 の領分である。**画面側で「連続入力中」を独自に判定すると、判定を 2 か所に持つことになる** |
| 4 | **削除導線の置き場** | **既存の共通技行の「削除」ボタンで足りる**（`recipe-system-delete` → `onStepDelete`）。**新しい導線を足していない。** パッドのボタンへは割り当てていない（**M21-04** の所管） |
| 5 | **接続部品の形** | **コンテキスト（供給元）＋ フック（headless な接続）の 2 段**にした。フック 1 つで済まなかった理由は §1.1（複数マウント） |
| 6 | **告知を両面から見せる方法** | **共通コンポーネント化**。文言の正本は 1 定数 |
| **★7** | **投げの向き**（**v1.2.0 で追加**） | **★設計卓の既定（`throw_forward` 固定）を覆した。** **`StepCandidate.direction` が後方成分を持つとき（テンキー 1 / 4 / 7）は `throw_back` を採る。** 理由＝**実機のボタン割当と同じ形であり、指示書 §9.2-7 が「推測ではない」と認めている**こと、および **`SYSTEM_BUTTON_TO_MOVE_CODE` が `throw_back` の入口を既に持っている**ため**新設規則にならない**こと。**★7 を含めたのは、上系の後ろ（後ジャンプ）でも「後方成分がある」と読むほうが規則として単純だからである**（空中投げは本アプリの入力対象ではなく、実害が無い） |

---

## 5. テスト

### 5.1 §5 (a)〜(h) の対応

| 区分 | 固定した内容 | 所在 |
|---|---|---|
| **(a) 出口** | **5 経路**（段階1 立ち／しゃがみ／ジャンプ ＋ 段階2 解決表ヒット ＋ 下後ろの縮約）で **`resolveDirectionalInput` の結果と `moveId` / `moveCode` が一致**。**ラッシュ版 ON でも一致。** 共通技も `SYSTEM_BUTTON_TO_MOVE_CODE` の値と一致 | `recipeInputResolution.test.ts` |
| **(b) 解決不能** | PP が `od_not_supported` を返し**ステップにならない**／**`moves` に `hadoken_od` があっても OD へ解決しない**／該当技が無ければ `move_not_found`／ラッシュ版が無ければ通常版へ倒さない。**画面側でも `onStepAdd` が呼ばれず、理由と入力内容が読取表示に出る** | 同上 ＋ `gamepadRecipeInput.test.tsx` |
| **(c) 混在** | **物理 → 仮想クリック → 物理** の順で `moveCode` が入力順どおりに並び、`stepOrder` が 1/2/3 になる | `gamepadRecipeInput.test.tsx` |
| **(d) 点灯** | 押している間だけ `data-held`／離すと消える／**押していないボタンは光らない**／**★ステップが確定していても、離していれば消える**（状態源が確定ステップでないことの主張）／マクロの投げが方向で切り替わる | 同上 |
| **(e) 削除** | 削除の直後も点灯が論理ボタン層のまま／**削除後に続けて物理入力が入り `stepOrder` が 1 から振り直される** | 同上 |
| **(f) 告知** | **3 点すべてが存在する**（文言の完全一致ではなく存在）／**★3 点目「不具合ではなく」が落ちていない**／**★判定窓の実値・「ミリ秒」・「ms」を文言へ写していない** | 同上 |
| **★(h) 2 面一致** | レシピ入力面とセットプレイ入力面を同時にレンダーし、**同じ入力が同じ `moveId` になる**／**受け手は常に 1 面で、レシピ側へ二重に入らない**／**告知は両面に出て文面が完全一致する**（同一定数から描かれているため） | 同上 |
| **(g) 非回帰** | `pnpm test` **1130 / 131 全緑**。**仮想コントローラの既存スイート・M21-01 / M21-02 の既存スイートすべて緑** | 全体 |

**テスト件数の増減（+41 / +1 ファイル）**——新規 `recipeInputResolution.test.ts` **25** ＋ 新規 `gamepadRecipeInput.test.tsx` **19** ＝ **+44**、撤去した `GamepadStepPreview.test.tsx` **-3**、`VirtualController.test.tsx` は `headerSlot` の 2 件を M21-03 の 2 件へ差し替え（**±0**）。**うち 5 件はレビュー取り込みで追加した**（ラッシュ空中の理由 2 ／ 未接続時の出し分け 2 ／ 解決不能が押し出されない 1）。**あわせて、誤った挙動（ニュートラルの常時点灯）を固定していた既存テスト 1 件を是正した。**

**手法**——**ポーリング層（`useGamepadPolling`）とプロファイル解決（`useGamepadProfiles`）だけを差し替え、rAF の観測 `(snapshot, now)` を手で流す。** 判定（`stepDetection` / `useStepDetection`）は**実物がそのまま動く**——本サブは判定を持たないため、モックすると接続を検証したことにならない。

### 5.2 E2E（★「書けなかった」と「回した」の内訳）

**新規 spec は追加していない。理由＝実機コントローラと user gesture を要するため Playwright から模擬できない**（M21-02 で確認済み。Gamepad API は実機接続がないと列挙されず、全経路に user gesture が必須＝`D-324` 軸 A-2）。

> **★「書かなかった」と「書けなかった」を区別して書く**（`E-84`）。**本件は「書けなかった」である。**

**既存 E2E の非回帰**——**2 回回した。どちらも `exit 0`。**

| 実行 | 時点 | 結果 |
|---|---|---|
| 1 回目 | 実装完了時（`3d28b62`） | **73 passed / exit 0**（1.6 分） |
| 2 回目 | **レビュー取り込み後**（`40fd7f1`） | **72 passed ＋ 1 flaky / exit 0**（1.6 分） |

**★2 回目の flaky は本サブと無関係である。** 失敗したのは `m19-03-setup-results.spec.ts:379`（**API の値域検査**＝値域外は 400・紐付け不在は 404）で、**落ちたのはテスト本体ではなく前準備の `POST /api/combos` が 500 を返したこと**である（`{"code":"internal_error"}`）。**retry で通過**した。
**⇒ 本サブは `internal/` の diff が 0**（フロントのみ）であり、**当該 spec は物理コントローラにも仮想コントローラにも触れない。** 1 回目の同一 spec は緑だった。**バックエンド側の一過性（並行ワーカーと使い捨て SQLite の競合が疑わしい）と見ているが、断定はしていない**——`error-context.md` に残っているのは 500 の応答本文だけで、サーバ側のログは採取していない。

**★そのままでは 73 件すべてが落ちる。** クラウド実行環境に前提が 2 つ欠けており、原因の特定に手間がかかった。**内訳と回避策は §8.1-1 に書いた。** 本サブの変更に起因する失敗は **0 件**である（`config.toml` を用意した時点で、コードを 1 行も変えずに全件緑になった）。

---

## 6. 契約の非干渉と検証

### 6.1 diff 0 の確認（`git diff 2812a26`）

| 対象 | 結果 |
|---|---|
| `internal/service/notation` ／ `internal/service/preset`（契約 F-1） | **diff 0** |
| `internal/moveindex` ／ `move_commands`（契約 F-3・読むだけ） | **diff 0**（読んでもいない。本サブはフロントで閉じた） |
| `internal/service/punishfinder` ／ `internal/service/setplay` | **diff 0** |
| **`internal/` 全体** | **diff 0** |
| `migrations/` | **diff 0**（消費連番なし。disk 末尾 `000075`＝§1-8） |
| `scripts/`（**D-335**） | **diff 0** |
| `docs/design/`（`CLAUDE.md` §8） | **diff 0** |

### 6.2 変更したファイル（17 件）

| ファイル | 種別 |
|---|---|
| `web/src/features/gamepad/recipeInputResolution.ts` | **新規**（★合流点。純粋関数のみ） |
| `web/src/features/gamepad/recipeInputResolution.test.ts` | **新規**（23 tests） |
| `web/src/features/gamepad/GamepadInputProvider.tsx` | **新規**（供給元・受け手の調停） |
| `web/src/features/gamepad/useGamepadRecipeInput.ts` | **新規**（headless な接続部品） |
| `web/src/features/gamepad/gamepadRecipeInput.test.tsx` | **新規**（16 tests） |
| `web/src/features/gamepad/components/GamepadInputNotice.tsx` | **新規**（告知 3 点・文言の正本） |
| `web/src/features/gamepad/components/GamepadRecipeReadout.tsx` | **新規**（読取表示 3 区画） |
| `web/src/features/gamepad/components/GamepadStatusControl.tsx` | provider を読む形へ ＋ 受け手バッジ |
| `web/src/features/gamepad/components/GamepadStepPreview.tsx` ／ `.test.tsx` | **削除**（§4.7） |
| `web/src/features/gamepad/logicalButtons.ts` | `logicalButtonLabel()` を追加（**既存の `BUTTON_LABEL` を再利用**。第 2 のラベル表を作らない） |
| `web/src/features/combo/components/VirtualController/VirtualController.tsx` | 接続の配線・点灯・受け手 claim。**`headerSlot` prop を撤去** |
| `.../VirtualController/useControllerInput.ts` | `SYSTEM_BUTTON_TO_MOVE_CODE` を export ＋ `resolveSystemButtonStep()` を切り出し（**仮想 UI 側も同じ関数を通す**） |
| `.../VirtualController/ControllerButton.tsx` ／ `HitBoxLayout.tsx` ／ `SystemRow.tsx` | `held` prop（点灯） |
| `.../VirtualController/VirtualController.test.tsx` | `headerSlot` の 2 件を M21-03 の 2 件へ差し替え |
| `web/src/features/combo/components/RecipeBuilder.tsx` | `headerSlot` の受け渡しを撤去 |
| **`web/src/App.tsx`** | **★`GamepadInputProvider` を 1 個マウント**（下記） |

**★`App.tsx` は §2.1 の一覧に無い。** **§2.2 の禁止列には当たらない**ため触った（同 §2.1 の記入指針・**D-348**）。**理由＝供給元を 1 個だけ持てる場所が他に無い**。入力面は同時に複数マウントされうるため面の中には置けず、ページ単位に置くと `ComboEditor` と `SetupEditorPage` で 2 個になる。**★アプリ全体に置いても入力面が 0 の間はポーリングを回さない**ため、M21-01 §4.1-2「入力面を表示していない間はループを回さない」は保たれている。

### 6.3 §4.10 否定形確認

> **★走査時点 = 2026-08-13、レビュー取り込み後の最終コード状態**（§4.10 は「サブの完了時点ではなく最後にコードを触った時点で回す」と定める。**取り込みでコメントを是正したため、取り込み前の走査結果は失効している**）。**走査範囲 = `web/src/features/gamepad/` 配下の全ファイル ＋ `web/src/features/combo/components/VirtualController/` 配下の全ファイル ＋ `web/src/App.tsx`**（本サブの変更はこの範囲で閉じている）。

| # | 走査 | ヒット | 判定 |
|---|---|---|---|
| 1 | `236` / `モーション` / `motion` | **9 件**（取り込み前 7 件 ＋ 2） | **入力列からコマンドを解決している箇所は 0 件。** 内訳＝(a) `stepDetection.ts` 2 件＝**M21-02 が書いた M21-06 への申し送り**（「実モーション入力」という語）(b) `recipeInputResolution.ts` 1 件＝**本サブが書いた「モーション解析をしない」という否定の宣言**（残骸ではなく契約の明示）(c) `VirtualController.test.tsx` 3 件 ＋ `SpecialMovePanel.tsx` 1 件＝**M15-03 の死守契約テストとその説明**（既存・不変）(d) **`types.ts` 2 件＝レビュー取り込み（高-2）で追加した是正文**——`dash_*` / `parry_drive_rush` が「方向の連続入力＝モーション解析であり M21-06 の領分」であることの明示。**これも否定の宣言であり残骸ではない** |
| 2 | `GamepadStepPreview` | **2 件**（取り込み前 1 件 ＋ 1） | **本番描画は 0 件。コンポーネント本体とテストは削除済み。** ヒットは 2 件とも**履歴を説明するコメント**＝(a) `GamepadStatusControl.tsx`「ここから撤去した」(b) **`useStepDetection.ts`（レビュー取り込み 高-1）「当初は最小可視化の表示件数だったが、現在は配送バッファである」**。**★後者は「失効した記述を残す」ではなく「役割が変わったことを明示する」記述であり、消すと高-1 の指摘に逆戻りする** |
| 3 | 判定窓の実値（`90`） | **本サブが作成した 7 ファイルで 0 件** | **本サブは値を写していない。** 全体の 9 件はすべて `stepDetection.ts`（**唯一の定義 ＋ 導出の説明**）とその既存テスト、および `calibration.test.ts` の無関係な `index: 90`。**テストは `SIMULTANEOUS_PRESS_WINDOW_MS` を import して参照している**（リテラルを書いていない） |

---

## 7. レビューの取り込み（Phase C・自動トリアージ）

**レビュー報告書**: `docs/progress/m21-03-review.md`（fresh subagent・**fork 不使用**。★リポジトリ内の v1.1.0 を読ませず、スクラッチパッド上の v1.2.0 で判定させた）
**判定**: **チェックリスト §8 の差し戻し事由（重大 1〜9）は 0 件。差し戻し事由なし。**
**往復**: **1 回**（初回のみ。停止規律の上限 2 回に未達）

**トリアージ結果: 13 件中 12 件を採用、1 件を不採用（低-3）。⇒ 「高」の不採用が 0 件のためエスカレーションは発生していない。**

**採否と理由の全件は `docs/progress/m21-03-review.md` の「## 取り込み結果（自動トリアージ）」に記載した**（事後監査用）。要点のみ:

| # | 優先度 | 指摘 | 採否 |
|---|---|---|---|
| 高-1 | **高** | `MAX_RETAINED_STEPS` の godoc が失効（可視化用 → 実際は配送バッファ） | **採用**（コメントのみ・挙動不変） |
| 高-2 | **高** | `types.ts` の「方向 ＋ ボタンの組から M21-02 / M21-03 が生成する」が偽（5 件中 2 件のみ） | **採用**（2 群へ書き分け ＋ `stepDetection.ts` の M21-04 誤帰属も是正） |
| 中-1 | 中 | 出し分けが `available` だけで接続状態を見ていない | **採用**（`connected` を導入。§3-10） |
| 中-2 | 中 | 方向ニュートラル（5）が常時点灯 | **採用**（非ニュートラルのみ点灯。**誤った挙動を固定していた既存テストも是正**） |
| 中-3 | 中 | `setState` updater 内で別の `setState` | **採用**（`surfaceIdsRef` で updater の外へ） |
| 中-4 | 中 | ラッシュ ON ＋ 上系の理由文が実態と食い違う | **採用**（`rush_not_available_in_air` を追加。§3-6） |
| 中-5 | 中 | 読取表示の 5 件バッファを 2 区画で共有 | **採用**（区画ごとに独立した上限へ） |
| 低-1 | 低 | `logicalButtonLabel` の型キャスト | **採用（形を変えて）**——`BUTTON_LABEL` の型は変えない（変えると**キャリブレーション対象が増えたときのラベル漏れが型で赤くならなくなる**） |
| 低-2 / 低-5 / 低-6 | 低 | 完了報告への追記 3 件 | **採用**（§3-11 ／ §8.1-6 ／ §8.1-5） |
| 低-3 | 低 | `handleSystemButton` の二重引き | **★不採用** |
| 低-4 | 低 | 切断時に読取表示が残る | **採用**（中-1 と同時に解決） |

> **★低-3 を不採用とした理由**（中・低の不採用は理由の記載で足りる＝Phase C 安全弁の対象外）——解消には `resolveSystemButtonStep` の戻り値を判別可能な直和へ広げる必要があるが、**同関数は仮想 UI と物理の 2 経路が通る共有の入口**である。**挙動が 1 ミリも変わらない整理のために共有入口の表面積を広げるのは割に合わない。** 引いているのは 7 エントリのオブジェクトで O(1) であり、レビュー自身も「実害は無い」としている。`M21-04` が同関数へ機能を足す局面で一緒に整理するのが安い。

**取り込み後の検証**: `pnpm test` **1135 tests / 131 files 全緑**（取り込み前 1130/131 ＝ **+5**。内訳＝ラッシュ空中の理由 2 件 ／ 未接続時の出し分け 2 件 ／ 解決不能が押し出されない 1 件）／ `pnpm lint` exit 0 ／ `internal` `migrations` `scripts` `docs/design` の diff 0 を再確認。

---

## 8. ■ 併せて更新が要るもの

| 項目 | 状態 |
|---|---|
| **消費した CHANGE 番号の registry 登録** | **なし。** `CHANGE-111` は**設計卓が起票し registry 登録済み**。**本サブは新規採番していない** |
| **「次の番号」の写し先 4 か所** | **更新不要**（本サブが番号を消費していないため）。`change-number-registry` §1 ／ `m21-contract` §3 ／ `parallel-board` §2.1 ／ §2.4 |
| **消費したマイグレ連番** | **なし。** **★ただし `ls migrations/` の disk 末尾は `000075` であり、M21-02 完了報告に書かれた `000073`（＝次は `000074`）とはずれている。** M20 レーンが `000074` / `000075` を消費した結果であり、**次に払い出す番号は `000076`**。ボード §2.2 の値を実査で確認すること |
| **版を上げた文書の参照元** | **なし。** 本サブは設計書・指示書・チェックリストの版を上げていない（**製造は設計書を編集しない**＝`CLAUDE.md` §8）。**★指示書 v1.2.0 / チェックリスト v1.2.0 は設計卓が `ed18f36` でコミット済みだが push が拒否されており、本ブランチには入っていない**（冒頭の注記） |
| **`docs/progress/progress-log.md` への索引行** | **追記済み**（本報告と対） |
| **ブラウザストレージ台帳** | **更新不要**（新規キーなし。`check-browser-storage-keys.sh` 緑） |

### 8.1 設計卓・開発者への申し送り

1. **★【要対応・環境】クラウド実行環境で `make e2e` を回すには `config.toml` が要る。**
   **本ブランチの初回実行は 73 件すべてが落ちた。** 原因は**アプリ側でも本サブの変更でもなく、`config.toml` が存在しないこと**である——`isInitialized` は `config.toml` の存在有無で決まり（`internal/api/config/handler.go`）、不在だと `App.tsx` が全ページを `/wizard` へリダイレクトするため、どの spec も対象要素に到達できない（Playwright のページスナップショットが「初期設定 / ようこそ」だった）。**`cp config.toml.example config.toml` で解消し、全件が回るようになった**（結果は下記）。
   **★`config.toml` は `.gitignore` 済みであり、リポジトリには入らない。** **⇒ クラウド実行環境は毎回この 1 手が要る。** 恒久対策の候補は (a) `Makefile` の `e2e` ターゲットで不在時に example からコピーする (b) `.claude/settings.json` のセットアップスクリプトで用意する (c) 手順として `remote-ops.md` に書く。**いずれも本サブのスコープ外であり、`scripts/` と `Makefile` は D-335 で触らない約束のため実施していない。**
   **★あわせて、プリインストールの Chromium を使う必要がある**——`playwright install` は `cdn.playwright.dev` が **403（host not permitted）**で失敗する。`Makefile` が既に `PW_EXECUTABLE_PATH` を受ける形になっていたため、`PW_EXECUTABLE_PATH=/opt/pw-browsers/chromium make e2e` で回せた（**既存 followup `cloud-e2e-browser-mismatch` の実運用回避策**）。
   **⇒ 結果として `PW_EXECUTABLE_PATH=/opt/pw-browsers/chromium make e2e` が 73 passed / exit 0 で通った**（1.6 分）。**★次に同じ環境で E2E を回す担当は、この 2 手（`config.toml` の用意 ＋ `PW_EXECUTABLE_PATH`）を先に踏むこと。** 踏まないと「全件落ちる」から始まり、**自分の変更が壊したように見える**。
2. **`scripts/check-md-emphasis.sh` の自己検査が `markdown-it-py` 未導入で不合格**（`check-artifact-integrity.sh` の違反 1 件）。**M21-02 横断課題 7 ／ M20-03 横断課題 5 の再演**であり、**本サブは `scripts/` を 1 バイトも触っていない**（diff 0）ため環境要因である。
3. **`scripts/check-browser-storage-keys.sh` が着手前から stderr にシェル構文エラーを出す**（既存 followup `check-browser-storage-keys-stderr-syntax-error`）。判定は完走して有効。
4. **★`CHANGE-111` の三点セットは本報告 §3 の 9 点で書ける。** **§2 の e′ と g（D-350 / D-352）は本サブの as-built がそのまま使える。**
5. **★開発者手番（実機確認）が要る。** 本サブは物理コントローラの実機を要する部分を**コンポーネントテストでしか固定できていない**（§5.2）。**とくに次の 4 点は実機でしか判断できない**——(a) **受け手の切り替え**が直感的か（最後に触った面・バッジの見え方） (b) **点灯の視認性**（ring の色・太さ） (c) **告知の置き場**が邪魔になっていないか（常設注記のため入力面が 1 行ぶん高くなる。**★コンボ編集画面では入力面の数だけ並ぶ**——レシピ節 1 個 ＋ 紐づくセットプレイ行 N 個＝レビュー指摘 低-6。**ただしレビュー取り込みにより、機体を接続していない間は 1 つも出ない**） (d) **読取表示の情報量**が多すぎないか（3 区画・**区画ごとに最大 5 件**）。

6. **★`M21-06`（実モーション入力）への申し送りは 3 件になった**（指示書 §10 は 2 件を挙げている）。
   1. **OD 技は物理から出せない**（`<family>_od` の family を決める情報は方向の連続入力から来る＝**D-352**）。
   2. **`StepCandidate` は SOCD 解決済みの `direction` しか持たない**（生の上下左右が要るなら `NormalizeResult` まで配管を戻す）。
   3. **★【追加】`dash_forward` / `dash_back` / `parry_drive_rush` も物理から出せない**（レビュー指摘 低-5）。ステップは**方向の 2 回入力**、ラッシュは**中P+中K のあと 6** であり、いずれもモーション解析にあたる。**`M21-01` の `types.ts` は当初「方向 ＋ ボタンの組から M21-02 / M21-03 が生成する」と書いていたが、生成できたのは `throw_forward` / `throw_back` の 2 件だけである**（同 godoc をレビュー取り込みで是正済み）。

7. **★「受け手は最後に触った面」という調停方針の一次記録がボードに無い。** 本裁定は 2026-08-13 の対話中に開発者が直接示したものであり（「最後に触った面。ただし選択中であることはわかりやすく表示」）、**`docs/process/parallel-board.md` 等には入っていない**（レビューも「不明」として指摘）。**⇒ `CHANGE-111` の三点セットを出すときに、設計卓がボードへ裁定として記録することを提案する**（製造はボードを書かない）。

---

## 9. 完了条件（DoD）の自己判定

### 9.1 機能要件（§7.1）

- [x] 物理コントローラの入力からレシピのステップが作られる（`FR105`）
- [x] 押されている入力と確定したステップが画面に出る（`FR106`）
- [x] 画面上の仮想コントローラのボタンが点灯連動する（§4.4）
- [x] **告知の 3 点が置かれている**（§4.6）
- [x] **M21-02 の最小可視化を撤去した**（§4.7）
- [x] **★2 面の両方で動く**（**D-350**）。**接続層は 1 つの部品を共有している**（セットプレイ側の変更は 0 行）

### 9.2 自己テスト結果（§7.2）

- [x] `pnpm test` **1130 tests / 131 files 全緑**
- [x] `go test ./...` **全 ok / FAIL 0**
- [x] `make e2e` を回し、結果を報告した（§5.2・§8.1-1）

### 9.3 品質チェック（§7.3）

- [x] `pnpm lint` exit 0 ／ `console.log` 0 件 ／ `any`・`@ts-ignore`・`eslint-disable` の追加 0 件
- [x] 契約 F-1 / F-3 の diff 0
- [x] `punishfinder` / `setplay` の diff 0
- [x] `migrations/` ／ `scripts/` ／ `docs/design/` の diff 0
- [x] **§4.10 の否定形確認**（最終コード状態・件数と検査範囲の両方を §6.3 に記載）
- [x] ブラウザストレージの新規キーなし（台帳の更新不要）

### 9.4 ドキュメント（§7.4）

- [x] `docs/progress/progress-log.md` へ索引行を追記
- [x] `check-progress-log-index.sh`（**★緑を「追記した証明」としては引かない**。実際の追記行を目視した）

---

*以上、M21-03 完了報告。配置 `docs/progress/M21-03-completion-report.md`。**本サブが書いたのは「どのボタンが押されたか」までであり、「どの技か」は 1 行も書いていない。***
