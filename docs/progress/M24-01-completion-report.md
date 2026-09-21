# M24-01 完了報告 — 一覧・ナビゲーション・既定キャラの配線

| 項目 | 内容 |
|------|------|
| 指示書 | `docs/instructions/M24-01-list-navigation-and-default-character.md` **v1.3.0** |
| 着手基点 | `210ab49` |
| ブランチ | `claude/m24-01-implementation-plan-hno7kr` |
| 実施日 | 2026-08-25 |
| コミット | `5a6e2ec` → `b2794c6`（7 本） |
| マイグレ連番 | **0 本消費**（スキーマ変更なし） |
| CHANGE 番号 | **新規採番なし**（`CHANGE-130` 起票済みの射程内） |

---

## 1. 結論

**扱った 8 件のうち、実装したのは 5 件、実装しなかったのは 3 件である。**

| `SM-ID` | 判定 | 帰結 |
|---|---|---|
| `SM-041` | 実装 | 既定キャラの解決順を 1 本にし、5 面 6 ファイルがそこを通る |
| `SM-044` | **★既に満たされていた** | 実装せず、成立をテストで固定した |
| `SM-058` | 実装 | マイコンボへ**キャラだけ**を引き継ぐ |
| `SM-119` | 実装（**★対象画面を差し替え**） | 一覧のキャラ選択をヘッダ帯へ移し、役割を明記した |
| `SM-002` | **★既に解消していた** | 実装せず、現状の写しをモックで示した |
| `SM-004` | **★既に解消していた** | 実装せず、成立をテストで固定した（従来テスト 0 本） |
| `SM-084` | 実装 | 新規登録の保存後の遷移先を一覧へ |
| `SM-012` | 実装（**分岐 A**） | 一覧に「セットプレイ数」列 |
| ~~`SM-083`~~ | スコープ外（`D-541`） | **1 バイトも実装していない** |

---

## 2. §3.3 着手前の確認 14 件（**全件・数と根拠つき**）

| # | 実査項目 | 結果 |
|---|---|---|
| **1** | `INITIAL_CHARACTER_ID` の定義位置と参照の全数 | 定義＝`web/src/lib/constants.ts:17`（当時）。**実使用点 9 か所 / 6 ファイル**（§3 の表）。ほかに import 6・コメント言及 4。**★ledger の「4 面」は誤りで、`ComboListPage.tsx` と `ComparePage.tsx` が漏れていた** |
| **2** | 解決関数の置き場所 | `web/src/features/combo/` 直下（`customStates.ts` / `inputResolution.ts` / `utils.ts` と同じ平場の型）。**同名ファイルが無いことを `ls` で確認済み**（`defaultCharacter.ts` / `useResolvedCharacterId.ts` とも不在）。**同種の解決関数は既存に無い** |
| **3** | `Config.Defaults.CharacterID` のフロント到達経路 | `GET /api/config` → `defaults.characterId`（`internal/api/config/dto.go:27`）。フロントは `useConfig()`（`web/src/features/config/useConfig.ts`・`queryKey: ["config"]`・`staleTime 60s`）、型は `DefaultsInfo { characterId: number; presetId: number }`（`web/src/features/config/types.ts:6`）。**★`config.toml.example` に `[defaults]` 節は無く、既定値は 1**（`internal/config/config_test.go:32`）＝E2E 環境では段 3b と段 4 が同値 |
| **4** | `?character=` 伝播の現在の実装 | **書き手 2**＝`ComboListPage.tsx`（`newComboHref`）／`PunishTree.tsx:110`。**読み手 1**＝`ComboEditorPage.tsx:28-36`（正の整数のみ採用・`new` モードのみ）。**既存の仕組みへ乗せた**（置き換えていない） |
| **5** | `ComboSortControls` をマイコンボから使えるか | **★既に使っていた**——`MyComboPage.tsx:317`（`{/* C-17: コンボ一覧と共通のソート部品 */}`）／`ComboListFilters.tsx:303`。**Props も項目集合も同一**（両者とも `SORT_FIELD_VALUES` を参照）。**⇒ `SM-004` は M12-01 の C-17 で既に解消済み** |
| **6** | マイコンボのタブ構成と件数表示の実体 | タブ＝`MyComboStatusTabs`（使用中/練習中/頻度低下の 3 つ）。**件数はタブのラベル内**（`MyComboStatusTabs.tsx:58`＝`<span>({count})</span>`。押せばタブが切り替わる）。**タブ外の件数は `CharacterInfoBar.tsx:36-40` の合計 1 か所のみ**（緑の情報バー内の平文・非クリック）。**⇒ `SM-002` は M12-01 の C-07 で既に解消済み** |
| ~~7~~ | — | 実査せず（`SM-083` スコープ外＝`D-541`） |
| **8** | セットプレイ件数の取得経路 | **★材料は既に一覧応答に在った**——`GET /api/combos` の `List` が `ListSetupsByComboIDs` で**バッチ取得**し各 item に `setups` を積んでいる（`internal/api/combo/handler.go:305-341`。コメントに `// セットプレイ情報をバッチ取得（N+1 回避）`）。フロント型も `ComboSummary.setups?: SetupSummary[]`。**⇒ 分岐 A。Go 側は 1 バイトも触っていない。例外条項 §2.3 は発動していない** |
| **9** | 触るファイルを参照する既存テストの全数 | **Vitest 7 ファイル**（`ComboListFilters.test` / `ComboTable.test` / `TrashList.test` / `useComboListFilters.test` / `CharacterSelector.test` / `MyComboPage.test` / `ComboEditorPage.character.test`）＋ `ComboEditor` 系 5 ファイル ＋ `ComparePage.character.test` / `AddComboToCompareModal.test`。**E2E 1 ファイル**（`character-default.spec.ts`）。**Go 0 ファイル**（分岐 A のため）。**★実際に更新が要ったのは E2E 10 ファイル**——§5 に実測を書く |
| **10** | `queryKey` の現在の綴り | 一覧＝`["combos", filter]`（`api.ts:71`）／詳細＝`["combo", id]`／マイコンボ件数＝`useMyComboStatusCounts.ts:34`／config＝`["config"]`。**分岐 A のためキー変更も無効化追加も不要。rename もしていない** |
| **11 / 14** | 台帳（`web/CLAUDE.md` §1）の登録状況 | **`combo-list-filters-v1` は登録済み**（#6・sessionStorage・DES-005 §5.4・M12-01/CHANGE-044・実装済）。**⇒ 既存の欠落は無い。台帳への追記もしていない**（新しいキーを作っていないため） |
| **12** | 着手前の `make e2e` | **175 passed / 0 failed / 0 flaky・exit 0・5.4 分**。あわせて `go test ./...` **53 パッケージ ok**、`vitest run` **182 ファイル / 1829 テスト全 pass** |
| **13** | `SM-044` が既に満たされているか | **★満たされていた。** `useComboListFilters.ts:87-101` が「URL が空なら `combo-list-filters-v1` から復元」「変わるたび保存」を実装しており、保存対象は `searchParams.toString()` 全体＝**`character_id` を含む**。編集画面の戻り 2 経路（`ComboEditor` の `navigate("/combos")`＝空クエリで復元発火／`navigate(-1)`＝履歴でクエリごと復帰）とも成立。**⇒ 実装せず、テストで固定した** |

---

## 3. `INITIAL_CHARACTER_ID` の参照点：**着手前 9 か所 → 完了時 0 か所**

**★どちらも数で書く**（指示書 §7.1）。import・コメント・定義は含めない「実使用点」の数である。

| ファイル | 着手前の実使用点 | 完了時 |
|---|---|---|
| `web/src/pages/ComboListPage.tsx` | 2（`:50` `:73`） | 0 |
| `web/src/features/combo/components/ComboListFilters.tsx` | 2（`:111` `:123`） | 0 |
| `web/src/features/mycombo/components/MyComboPage.tsx` | 1（`:79`） | 0 |
| `web/src/features/combo/components/ComboEditor.tsx` | 1（`:968`） | 0 |
| `web/src/features/combo/components/AddComboToCompareModal.tsx` | 2（`:36` `:44`） | 0 |
| `web/src/pages/ComparePage.tsx` | 1（`:88`） | 0 |
| **合計** | **9** | **0** |

**完了時に定数を直接参照するのは `web/src/features/combo/defaultCharacter.ts:94`（段 4）の 1 か所だけである。**

---

## 4. 実装の中身

### 4.1 既定キャラの解決順（`SM-041` / `SM-044` / `SM-058` / `SM-119`）

**新規 `web/src/features/combo/defaultCharacter.ts`（純粋関数）**。段の列挙は `CHARACTER_RESOLUTION_STAGES` の **1 か所**にあり、段ごとに `if` を散らしていない。

| 段 | 入力 | 実在検査 | 本サブで実装 |
|---|---|---|---|
| 1 | URL のクエリ | しない | する |
| 2 | セッション（既存キー `combo-list-filters-v1`） | しない | する |
| **3a** | `users.main_character_id` | （する） | **★しない**（`D-545`） |
| 3b | `config.toml [defaults] character_id` | **する** | する |
| 4 | `INITIAL_CHARACTER_ID` | — | する |

**★★解決順に 1 条ある**（**2026-08-25 追補②。開発者の実機確認で見つかった穴**）:

> **段 3 系の既定（`config.toml [defaults] character_id`）を書き換えたら、段 2 の記憶のうち「最後に選んだキャラ」だけを捨てる。**

**なぜ要るか**——**順序だけ決めても穴が残っていた。** 段 2 は段 3b より優先されるため、**既定キャラを変えても段 2 が残っている限り一覧は変わらない。**

**開発者の再現手順**:

```
①初回起動 → ②ウィザードでキャラ選択 → ③一覧で対象キャラを変える → ④config.toml を消す
→ ⑤再起動 → ⑥ウィザードで③とは違うキャラを選ぶ → ⑦一覧を開く
→ ⑧★⑥で選んだ既定ではなく、③のキャラが出る
```

**機序**: 既定キャラを**書く**経路は 2 つ（`WizardPage.tsx:59-71` ／ `SettingsSectionBasic.tsx:22-36`）で、**どちらも `combo-list-filters-v1` を触っていなかった。** ウィザードの完了は `navigate("/", { replace: true })` ＝ **SPA 遷移で同じタブ**のため `sessionStorage` が生き残る。「完全に新規なら起きない」のは、そのタブの `sessionStorage` が空だから。

**★これは `config.toml` を消したときだけの話ではない。** **設定画面から既定キャラを変えたときも同じ**（一覧でケンを選んで作業 → 設定でイングリッドへ変更 → 一覧へ戻る → **ケンのまま**）。**実運用で普通に通る導線であり、利用者には「設定を変えたのに効かない」と見える。**

**実装**（`clearSessionCharacterId()`＝`useComboListFilters.ts`）:

- **★呼び出し口は `useUpdateConfig` の `onSuccess` 1 か所だけ。** 画面側（ウィザード・設定）には置いていない——**次に既定キャラを書く画面が現れたとき、呼び忘れても何も言わない**ためである。**既定キャラを書く経路は必ず本フックを通る。**
- **★`characterId` を含まない更新では捨てない。** `PresetListPage.tsx:79` は `{ defaults: { presetId } }` だけを送っており、その経路を壊さない。
- **★キャラ以外の軸（`tag_ids` / `is_draft` / `sort` / `order` / `setup_*`）は残す。** 既定キャラを変えただけで作業中の絞り込みまで飛ぶのは行き過ぎである。
- **★段の順序は変えていない。** 段 3b を段 2 より先にすると `SM-044`（一覧でキャラを選んで詳細へ行って戻ったら維持される）が壊れる。

**★ウィザード・設定画面のコードは 1 バイトも触っていない。**

- **★段 3a は「後から 1 行足せば差し込める形」になっている。** 配列内の該当位置にコメントで挿入行を書き置き、`CharacterSources` に `userMainCharacterId` の口も開けてある。**テストで「いま 3 段であること」と「1 行足せば 3a が 3b より先に効くこと」を両方固定した。**
- **★実在検査は段 3 系だけに掛けた**（`verifyExists`）。**判断の根拠**: 段 1・段 2 に掛けると `?character=` の現行挙動（正の整数なら採用）が変わり、`§1.3`「既存の遷移を壊さない」に反する（既存 E2E `character-default.spec.ts` が `?character=<任意 id>` を直接叩いている）。**この判断もテストで固定した。**
- **★キャラ一覧が未取得のあいだは実在検査をスキップして採用する。** 検査できないことを「不在」と読むと、取得前に段 4 へ落ちて表示が飛ぶ。
- **フック `web/src/features/combo/hooks/useResolvedCharacterId.ts`** が材料（config / characters / セッション）を集めるだけの薄い層。

**段 2 の読み取り**は `useComboListFilters.ts` の `readSessionCharacterId()`。

- **新しいキーを作っていない。保持する内容も増やしていない。`localStorage` へも移していない。**
- **専用ヘルパ `createSessionStorageHelper` 経由**（同ヘルパは try-catch 済みで失敗時 `null`）。
- **★`character_id` だけを取り出す。**「壊れた値」「未保存」「キャラを含まないクエリ」がすべて `null` になることをテストで固定した。

### 4.1-7 `SM-058`（マイコンボ）——**キャラだけ**

`MyComboPage` は `characterOverride ?? resolvedCharacterId` で対象キャラを決める。

- **★`useState` の初期化子で 1 回だけ読む形は採らなかった。** config の到着が初回描画より後になりうるためである。
- **★タグ・状況・仮登録トグル・ソートは読んでいない。** `MyComboPage.test.tsx` に**否定形テスト**を置いた——マイコンボが投げる `/api/combos` の全クエリを集め、`tag_ids` に一覧側の id が混ざらないこと・`is_draft` が無いこと・`sort=damage` / `order=asc` が無いことを確かめる。E2E 側にも同じ否定形を 1 本置いた。
- **★否定形の判定を部分文字列で書かない**（実装中に一度踏んだ）。マイコンボは自分の status タグ（`tag_ids=10` 等）を正当に送るため、`"tag_ids=1"` の部分一致は `tag_ids=10` にも当たる。**`URLSearchParams` で解いてから比較している。**
- **`DES-005` §5.4 / §5.5 は 1 文字も変えていない。**

### 4.1-4 `SM-119`——**★対象画面を差し替えた（2026-08-25 開発者ご指摘）**

**初版は指示書 §4.1-4 の指定どおり新規登録画面（`ComboEditorCharacterField`）に見出しを足した。**
**★しかし元の要求は一覧画面についてのものだった**（開発者逐語＝**「一覧画面についての依頼でした。一覧画面のフィルタのプルダウンが新規登録対象キャラ選択も兼ねているのが不自然だというものです」**）。

**採った形（開発者提案。逐語＝「プルダウンをフィルタからヘッダのキャラクター欄へ移動して、新規登録とフィルターを兼ねたキャラクター選択である事がわかるような内容をラベルとして添える」）**:

- キャラ選択を `ComboListFilters` のフィルタ欄から **`ComboListPage` のヘッダ帯（「新規登録」の隣）へ移した。**
- ラベルを **「対象キャラ」**、補足を **「一覧の絞り込みと、新規登録の対象を兼ねます」**（ja / en 両方）。
- **★兼ねている事実そのものは消していない。** 消すと「一覧でキャラを選んでから新規登録」の流れが壊れ、**`SM-044` と正面衝突する**（同じ仕組みの表と裏である＝指示書 §4.1-4）。**見える場所へ出して名前を付ける**形を採った。
- **★ヘッダ帯は余白が広く、キャラが増えたときにプルダウン以外の選択方法へ差し替える余地が残る**（開発者の狙い）。
- **`CharacterSelector` 部品自体は触っていない**（§1.3）。移したのは一覧が持っていた素の `<select>` である。

**★あわせてヘッダ帯の並びを変えた**（同日・開発者判断。**逐語＝「ラベルのダルシムはもういらないので、削ってもらっていいですか？ アイコンの隣に配置。登録済み 12 件はさらに選択プルダウンの右隣りでいいです。」**）:

- **キャラ名の大見出しを撤去した。** プルダウン自身が同じ名前を出しており、**同じ情報が 2 か所に並ぶだけ**だった。
- 並びを **アイコン → 対象キャラ（プルダウン＋補足）→ 登録済み N 件** にした。
- **★E2E ケース A の判定を差し替えた。** 大見出しを外した結果、キャラ名は**閉じた `<select>` の `<option>` にしか現れず hidden 扱い**になるため、`getByText(キャラ名)` では判定できない。`getByTestId("combo-list-character-scope")` の `toHaveValue` へ変えた（**主張はむしろ強くなっている**——「名前がどこかに見える」ではなく「その控えが対象キャラになっている」）。

**新規登録画面の見出し「このコンボのキャラ」は残した**（開発者判断）。初期値を解決順から取る配線は `SM-041` の本体としてどちらにせよ必要である。

### 4.4 `SM-084` 新規登録の保存後の遷移先

- `mode === "new"` のときだけ **`/combos?character_id=<保存したコンボのキャラ>`** へ遷移する。
- **★対象キャラは段 1（URL クエリ）で保っている。** 段 2（セッション）は一覧が URL 空で開いたときにしか復元しないため、確実なのは段 1 である。
- **編集（`mode === "edit"`）の遷移先は変えていない。** 対照テストを置いた。
- **★`mode === "copy"` も変えていない。** **★2026-08-25 開発者判断で確定した**（逐語＝**「現状のまま（詳細画面）」**）。**理由**——コピーは元から値が入っている分、入力ミスに気づきにくい。まず 1 件を詳細で確かめられるようにする。`SM-084` の memo も「**新規登録の**」遷移先しか言っていない。**⇒ 推測ではなく裁定済みである。**
- **`punishReturn`（確定反撃サーチからの復帰）の優先は変えていない。** これも対照テストを置いた。
- **★保存後の警告ダイアログの文面を是正した**（失効した記述）。「詳細画面へ移動しますか?」「続行（詳細へ移動）」が固定文言だったため、新規登録では「**詳細へ移動**」と言いながら一覧へ飛ぶ状態になっていた。遷移先から呼び名を導くようにした。

### 4.5 `SM-012` セットプレイ数の列（**分岐 A**）

- `ColumnVisibility` / `DEFAULT_COLUMN_VISIBILITY` / `COLUMN_DEFINITIONS` へ `setupCount` を 1 件追加（**既定は表示**）。
- 値は `combo.setups?.length ?? 0`。**0 件も 0 と出す**（空欄にすると「未取得」と区別できない）。
- **`colSpan` は全数走査した**（教訓 `E-192`）。実装コードのヒットは 5 か所（`ComboTable.tsx:100`／同 `:165`＝`SetupTreeRow`／`MoveEditGrid.tsx:261`／`TrashListRow.tsx:141`／`TrashSetupListRow.tsx` × 3）。
  - `ComboTable.tsx:100` は `Object.values(visibility).filter(Boolean).length` で数えるため**自動追随する**。**それでも「自動だから大丈夫」で終わらせず、非表示にすると展開行の `colSpan` が 1 減ることをテストで固定した。**
  - `TrashListRow`（`colSpan={6}`）は `/trash` の**独立したテーブル**であり `ComboTable` を使っていない（実査済み）。**触っていない。** 既存 E2E「コンボ表は 6 列のまま」も /trash 側であり、影響しない。
- `useColumnVisibility` は `{...DEFAULT, ...loaded}` でマージするため、**既存 localStorage の移行は不要**。
- **Go 側は触っていない。マイグレ連番 0 本。`queryKey` も変えていない。**

### 実装しなかった 3 件

| 件 | 根拠 |
|---|---|
| **`SM-002`** | **M12-01 の C-07（`CHANGE-044`・2026-06-22）で既に解消**。件数はタブの内側にあり、押せばタブが切り替わる。タブ外の件数は情報バーの合計 1 個・非クリックのみ。当時のレビューも C-07 を **◎** と判定（`docs/progress/phase2/m12-01-review.md:38`）。**memo の `【2026-07-21】未対応` は古い掃き取りの誤りと判断した**——同じ掃き取りは 2026-08-11 に別の 4 件で「前回の [未] は誤り」と是正されており、本件はそのとき取り残されたと見ている。**不変条件「利用者がタブだと思って件数を押さない」は現状で成立している。** |
| **`SM-004`** | **M12-01 の C-17 で既に解消**。両画面が同一の `ComboSortControls` と同一の `SORT_FIELD_VALUES` を使う。**ただし同部品はテストが 0 本だったため、成立を固定するテストを 6 件新設した。** |
| **`SM-083`** | スコープ外（`D-541`）。**1 バイトも実装していない。** |

### §4.10 モック HTML

`docs/progress/M24-01-mock/m24-01-screens.html`（**単一ファイル・外部依存ゼロ**）。**Plan Mode の提示に含め、UI コードへ着手する前に提示した。**

- パネル 1 = `SM-012`（変更前 / 変更後）
- パネル 2 = `SM-119`（**一覧画面**の変更前 / 変更後。★初版は新規登録画面を描いており、開発者ご指摘で差し替えた）
- パネル 3 = `SM-002`（**★「現状・変更しない」の写し 1 枚のみ**）

> **★パネル 3 は指示書 §7.1 の「既に解消していたならモックを出さない」から外れる。** 開発者の要請（`D-543` 逐語＝「実画面は今見れないため、製造担当にはモック html を出して欲しい。**直っている可能性がある。**」）が**まさに**「直っているかを自分で確かめたい」であったため、**変更提案ではなく現状の写しとして 1 枚だけ**添えた。**変更後の姿は 1 枚も描いていない。**

---

## 5. §3.3-9 の実測：**E2E の blast radius は事前の見立てより広かった**

**`SM-084`（保存後の遷移先）が、保存後 URL に依存する既存 spec を広く動かした。** 着手前に数えた「E2E 1 ファイル」は**実装の参照**の数であり、**挙動の依存**はもっと広かった。

| 種別 | 実測 | 対応 |
|---|---|---|
| 保存後 URL を `/combos/\d+$` で主張 | **12 か所 / 10 spec** | `saveNewComboAndOpenDetail()` 経由へ |
| 削除後に `toHaveURL("/combos")` で主張 | **10 か所 / 7 spec** | `/\/combos(\?.*)?$/` へ（段 2 の復元で `?character_id=` が付くようになったため） |
| 「文脈なしはリュウ」の主張 | 1 か所 | 後状態（段 2 が効く）へ更新し、**セッションを消したときに段 3b/4 へ落ちる対照を 1 件追加** |
| 保存後に詳細 URL を待つ（M23-05） | 1 か所 | 一覧 URL へ（**待ちの目的は不変**） |
| **編集モードの保存後 `/combos/\d+$`** | **6 か所 / 4 spec** | **★触っていない**（変えていないことの対照になる） |

**新規 `web/e2e/support/new-combo.ts`**（spec ではないため `testMatch` に拾われない）:

- **作成された combo id は `POST /api/combos` の応答から取る。**
- **★「一覧の一番新しい行」で代用していない。** playwright は `fullyParallel: false` でも**ファイル単位では並行**に走り、E2E は DB を 1 本共有する（教訓 `E-232`）。他ファイルが作った行を掴む。
- 保存の起こし方（ボタン / キーボードショートカット）は spec ごとに違うため、**呼び出し側からコールバックで渡す**。

> **★これは「10 ファイルへ同じ 3 行を複製する」を避けるための新規ファイルである。** 複製すると、並行実行を避ける理由（`E-232`）がコメントごと 10 か所に散り、次に誰かが 1 か所だけ直したときに気づけない。

---

## 6. §4.9 否定形確認（撤回した定義の全文走査）

撤回した定義は 1 つ＝**「対象キャラは `INITIAL_CHARACTER_ID` で決まる」**。

**走査コマンド（全文）:**

```bash
LC_ALL=C.UTF-8 grep -rn "INITIAL_CHARACTER_ID" \
  --include="*.ts" --include="*.tsx" --include="*.go" --include="*.md" . | grep -v node_modules
```

- **陽性対照**: 置換前に当たっていた `web/src/pages/ComboListPage.tsx:73` が置換後は 0 件になり、代わりに定義行 `web/src/lib/constants.ts` が拾えることを確かめた（**走査そのものは死んでいない**）。
- **`LC_ALL=C.UTF-8` を付けた**（日本語の散文を走査するとロケール次第で静かに 0 件を返す）。

**検出表（着手前のヒット・★ヒット行単位。`git grep -n INITIAL_CHARACTER_ID 210ab49 -- web/src` で数え直した）:**

| # | 位置 | 逐語（要旨） | 種別 |
|---|---|---|---|
| 1 | `web/src/lib/constants.ts:17` | `export const INITIAL_CHARACTER_ID = 1;` ＋「フェーズ1キャラスコープ。リュウ1キャラのみ運用するため、UI のキャラ選択も固定値を使用する」 | 定義 ＋ 注記 |
| 2 | `ComboListPage.tsx:50` `:73` | `filters.characterId ?? INITIAL_CHARACTER_ID` | 実使用 |
| 3 | `ComboListFilters.tsx:111` `:123` | `value={filters.characterId ?? INITIAL_CHARACTER_ID}` ／ `<option value={INITIAL_CHARACTER_ID}>` | 実使用 |
| 4 | `MyComboPage.tsx:79` | `useState<number>(INITIAL_CHARACTER_ID)` | 実使用 |
| 5 | `ComboEditor.tsx:968` | `initialCharacterId ?? INITIAL_CHARACTER_ID` | 実使用 |
| 6 | `AddComboToCompareModal.tsx:36` `:44` | `defaultCharacterId ?? INITIAL_CHARACTER_ID` | 実使用 |
| 7 | `ComparePage.tsx:88` | `?? INITIAL_CHARACTER_ID` | 実使用 |
| 8 | `AddComboToCompareModal.tsx:21` | 「不在時は `INITIAL_CHARACTER_ID`。」 | **コメント** |
| 9 | `ComboEditor.tsx:78` | 「不在時は `INITIAL_CHARACTER_ID`。」 | **コメント** |
| 10 | `ComparePage.tsx:86` | 「空なら `INITIAL_CHARACTER_ID`」 | **コメント** |
| 11 | `ComboEditorPage.tsx:26` | 「ComboEditor 側で `INITIAL_CHARACTER_ID` へフォールバック」 | **コメント** |
| 12 | `ComboEditor.test.tsx:647` | テスト名「initialCharacterId 不在時は **INITIAL_CHARACTER_ID(1) が既定**」 | **テスト資産** |
| 13〜15 | `AddComboToCompareModal.test.tsx:187` `:203` `:238` | 同型のテスト名 3 件 | **テスト資産** |

**手当て表（★「是正した」と「残す」を分けて全数）:**

| # | 対象 | 手当て |
|---|---|---|
| 1 | `constants.ts` の注記 | **★是正**——「段 4 のフォールバック。呼び出し元は `defaultCharacter.ts` の 1 か所」へ書き換え（値は変えていない） |
| 2〜7 | 実使用 9 か所 | **★置換**——解決順の呼び出しへ（§3 の表。残存 0） |
| 8 | `AddComboToCompareModal.tsx:21` | **★是正**——「不在時は既定キャラの解決順（§4.1-2）へ落ちる」へ |
| 9 | `ComboEditor.tsx:78` | **★是正**——「不在時は解決順の段 2 以降へ落ちる」へ |
| 10 | `ComparePage.tsx:86` | **★是正**——文脈ロジックの説明を残しつつ落ち先を解決順へ書き換え |
| 11 | `ComboEditorPage.tsx:26` | **★是正**——「段 1 にあたる。無効値は ComboEditor が段 2 以降へ落とす」へ |
| 12〜15 | テスト名 4 件 | **★是正**——「既定キャラ解決の段 4(= 1)」へ |
| — | `defaultCharacter.ts:1/6/91/94` | **残す**（段 4 の正しい実装とその説明。指示書 §4.9 が「指摘しない」と明示） |
| — | `defaultCharacter.test.ts:3/48/61` | **残す**（段 4 の期待値） |
| — | `lib/constants.ts` 定義行そのもの | **残す**（段 4 のフォールバックとして生き続ける＝§4.1-5） |
| — | `ComparePage.character.test.tsx:76` | **残す**（M10-02 時点の主張との対比。履歴の説明であり現状の説明ではない） |

**★是正は 8 件である**（コメント 4 ＋ テスト名 4）。**★初版の完了報告は「5 件」と書いていた**——本番コードのコメント 3 行（`AddComboToCompareModal.tsx:21` / `ComboEditor.tsx:78` / `ComparePage.tsx:86`）が仕分け表から落ちていた（レビュー 高-3 で指摘）。**是正そのものは 3 件とも行われており、壊れていたのは記録のほうである。** **⇒ これ自体が「自分が書く数も疑う」（教訓 `E-220` / `E-236`）の実例になった。**

**★是正 8 件はいずれも動作を変えない記述である。** テストも lint も型検査も緑のままであり、**走査以外に見つける経路が無かった。**

**`docs/` 側 143 ヒットの扱い:**

- **過去の進捗報告・完了報告・レビュー報告・CHANGE 通知書・retrospective は履歴の記録であり、書き換えない。**
- **★生きたルール面で旧定義を述べているのは 2 行**（下記 §8 で設計卓へ回す）。`docs/handover/code-facts.md` にはヒットが無い。

---

## 7. テスト結果（**★件数つき**。「全緑」「exit 0」だけを根拠にしない）

### 7.1 着手前 → 完了時

| 検査 | 着手前 | 完了時 |
|---|---|---|
| `go test ./...` | **53 パッケージ ok**・exit 0 | **53 パッケージ ok**・exit 0（**分岐 A のため差分ゼロ**） |
| `pnpm exec vitest run` | **182 ファイル / 1829 テスト全 pass** | **184 ファイル / 1881 テスト全 pass** |
| `make e2e` | **175 passed / 0 failed / 0 flaky**・exit 0・5.4 分 | **178 passed / 0 failed / 0 flaky**・exit 0・4.1 分 |
| `pnpm exec tsc --noEmit` | exit 0 | exit 0（**エラー 0 件**） |

**★完了時の数値は、レビュー指摘の取り込み後に測り直したものである**（レビュー 高-1）。

### 7.1-1 ★1 度だけ観測した flaky と、その切り分け（教訓 `E-216`）

**ヘッダ帯の並び替えを入れた回の `make e2e` で、`m14-03e-third-wave-seed.spec.ts` が 1 件 flaky になった**（1 回目失敗 → retry で pass）。**★「フレークで閉じない」ため、最小手 2 手を回した。**

| 手 | コマンド | 結果 |
|---|---|---|
| **隔離実行** | `pnpm exec playwright test e2e/m14-03e-third-wave-seed.spec.ts` | **1 passed（10.6s）** |
| **直列実行** | `pnpm exec playwright test --workers=1`（全 spec） | **178 passed（5.7m）・flaky 0** |

**⇒ 当該 spec は本サブの差分と接点が無い**（6 キャラの moves/alias の seed と画面 18 のスクロール領域。本サブが触った面ではない）**。以後の全実行（並行 2 回・直列 1 回）でも再現していない。** `m23-close-report` §7-1 が記録する「毎回 1 件・毎回別のテスト」の型と一致する。**本サブで手当てはしない。横断課題として記録する。**

### 7.2 追加したテスト

| 対象 | 件数 |
|---|---|
| `defaultCharacter.test.ts`（新規） | 11 |
| `ComboSortControls.test.tsx`（**新規・従来 0 本**） | 6 |
| `ComboTable.test.tsx`（追加） | 4 |
| `useComboListFilters.test.tsx`（追加） | 7 |
| `MyComboPage.test.tsx`（追加） | 4 |
| `ComboEditor.test.tsx`（追加） | 3 ＋ **4**（レビュー 中-2 の採り直し） |
| `ComparePage.character.test.tsx`（追加） | 2 |
| `ComboListFilters.test.tsx`（追加） | 1 |
| **追補② `useComboListFilters.test.tsx`**（`clearSessionCharacterId`） | **6** |
| **追補② `useUpdateConfig.test.ts`**（呼び出し口・3 本は否定形の対照） | **4** |
| `web/e2e/m24-01-character-and-list.spec.ts`（新規） | 3 |

### 7.3 品質チェック

| 検査 | 結果 |
|---|---|
| `bash scripts/check-artifact-integrity.sh`（**1 本目**） | **違反なし**（検査 11 件の自己検査 ＋ 派生資料 4 件の生成物健全性） |
| `bash scripts/check-browser-storage-keys.sh` | **違反なし**（台帳 9 件 / 本番コード 8 件） |
| `bash scripts/check-enum-sync.sh` | **ベースラインどおり（増加なし）** |

> **★`check-browser-storage-keys.sh` は一度赤で止めてくれた。** `defaultCharacter.ts` の docblock が `(sessionStorage \`combo-list-filters-v1\`)` という**式に見える形**だったため、「ヘルパ外からストレージ API を直接呼んでいる」として拾われた。**検査を緩めず、コメントの側を式に見えない形へ書き直した**（同ファイルはブラウザストレージに一切触れない）。

---

## 8. §5.3 破壊確認（**必須 3 件 ＋ レビュー取り込み 1 件 ＋ 追補② 1 件・コマンドと出力つき**）

**★「赤くなった」で終わらせていない。狙ったテストだけが、狙ったアサーションで赤いことまで確認した**（教訓 `E-230`）。**各回とも全 184 ファイルを回している**（他が巻き添えで赤くなっていないことの確認）。

### 破壊 1: 解決関数の段 2 と段 3b を入れ替える

```
$ pnpm exec vitest run
 FAIL  src/features/combo/defaultCharacter.test.ts > … > 段 2: URL が無ければ同一セッションで最後に選んだキャラ
 FAIL  src/features/combo/defaultCharacter.test.ts > … > 段 3a(users.main_character_id)は本サブでは実装されていない
 FAIL  src/features/combo/defaultCharacter.test.ts > … > 段 3a を 1 行足せば差し込める形になっている
 Test Files  1 failed | 183 passed (184)
      Tests  3 failed | 1863 passed (1866)
```

狙ったアサーション:
`expected { characterId, stageId } to deeply equal { characterId, stageId }`（段 2 が `2-session` を返さない）／
`expected [ '1-url', '3b-config', '2-session' ] to deeply equal [ '1-url', '2-session', '3b-config' ]`。
**同じ層（Vitest の純粋関数テスト）で赤くなっている。**

### 破壊 2（**★差し替え版**）: `ComboSortControls` が項目集合の一部しか出さなくする

> **★指示書 §5.3-2 の「マイコンボ側で一覧側の項目集合に差し替える」は実行不能だった。**
> **§3.3-5 の実査どおり両画面の項目集合は同一**（同じ部品・同じ `SORT_FIELD_VALUES`）であり、差し替えは **no-op** になる。
> **⇒ 破壊の趣旨（「両画面の項目集合がずれたら赤くなること」）を保つ等価な破壊へ差し替えた。**
> 集合が 1 本の部品と 1 本の定数へ統合されている以上、ずれを起こす唯一の経路は**部品が全数を出さなくなること**である。

```
$ pnpm exec vitest run
 FAIL  src/features/combo/components/ComboSortControls.test.tsx > … > ソート項目は SORT_FIELD_VALUES の全数を出す(両画面で同じ集合)
 FAIL  src/features/combo/components/ComboSortControls.test.tsx > … > マイコンボ側の項目集合で描画できる(一覧側と同一集合であることの固定)
 Test Files  1 failed | 183 passed (184)
      Tests  2 failed | 1864 passed (1866)
```

### 破壊 3: セットプレイ数の算出を定数 0 に固定する

```
$ pnpm exec vitest run
 FAIL  src/features/combo/components/ComboTable.test.tsx > … > 0 件・1 件・複数件をそのまま出す(0 件も空欄にしない)
     → expected [ '0', '0', '0' ] to deeply equal [ '0', '1', '3' ]
 Test Files  1 failed | 183 passed (184)
      Tests  1 failed | 1865 passed (1866)
```

### 破壊 4（**★レビュー取り込みで追加**）: 既定キャラの採り直し（レビュー 中-2）を止める

```
$ pnpm exec vitest run src/features/combo/components/ComboEditor.test.tsx
 FAIL  … > M24-01 中-2 既定キャラの採り直し(キャラ一覧が遅れて届く) > 解決値が後から変わったら、利用者が触れていない限り初期キャラを採り直す
     → expected '99' to be '1' // Object.is equality
      Tests  1 failed | 40 passed (41)
```

**狙った 1 件だけが赤くなり、「利用者が触れたあとは採り直さない」「段 1 が在るときは採り直さない」「編集モードでは採り直さない」の 3 本の対照は緑のままである。**

### 破壊 5（**★追補②**）: 既定キャラ更新時の `clearSessionCharacterId()` 呼び出しを止める

```
$ pnpm exec vitest run src/features/config/useUpdateConfig.test.ts
   ✓ sends PUT and returns updated config
   × 既定キャラの更新でセッションの段 2 を捨てる > defaults.characterId を送ると character_id が消える(他の軸は残る)
     → expected 'character_id=4&tag_ids=1,2&sort=damage' to be 'tag_ids=1%2C2&sort=damage'
   ✓ ★defaults.presetId だけのときは消えない(PresetListPage の経路)
   ✓ ★defaults を含まない更新では消えない
   ✓ ★失敗した更新では消えない(onSuccess でしか呼ばない)
      Tests  1 failed | 4 passed (5)
```

**狙った 1 件だけが赤く、3 本の否定形の対照は緑のままである**（対照はどちらでも緑になるのが正しい——「捨てない」ことを主張しているため）。

**5 件とも破壊を戻し、`git diff --stat` が空であることを確認した**（`git checkout` / `git restore` は `.claude/settings.json` の deny 対象のため、**手で書き戻して差分ゼロを確認**している）。

---

## 9. 変更統計（**★新規のはずのファイルに deletions が付いていないか**＝教訓 `E-225`）

```
$ git diff --stat 210ab49
 43 files changed, 2609 insertions(+), 175 deletions(-)
```

**新規 9 ファイルはすべて `+` のみ（deletions 0）:**

```
  391 + / 0 -  docs/progress/M24-01-completion-report.md
  477 + / 0 -  docs/progress/m24-01-review.md
  242 + / 0 -  docs/progress/M24-01-mock/m24-01-screens.html
  171 + / 0 -  web/e2e/m24-01-character-and-list.spec.ts
   48 + / 0 -  web/e2e/support/new-combo.ts
   89 + / 0 -  web/src/features/combo/components/ComboSortControls.test.tsx
  140 + / 0 -  web/src/features/combo/defaultCharacter.test.ts
  107 + / 0 -  web/src/features/combo/defaultCharacter.ts
   53 + / 0 -  web/src/features/combo/hooks/useResolvedCharacterId.ts
```

**作る前に `ls` で同名の不在を確認している**（実装 5 件とも不在だった）。

> **★初版の完了報告はこの節に `40 files / 1571 / 153` と書いていたが、その後の変更（開発者ご指摘によるヘッダ帯の並び替え・レビュー取り込み）を反映していなかった**（レビュー 高-1）。**⇒ §9 は「新規のはずのファイルに deletions が付いていないか」を確かめる節であり、数値が現物と対応していなければ何も検査していないのと同じである。** 数値は最終状態で取り直した。

---

## 10. §2.1 一覧に無いが触ったファイル（**理由つき**）

| ファイル | 理由 |
|---|---|
| `web/src/pages/ComboListPage.tsx` | **§3.3-1 の実査で参照点 2 か所が見つかった**（ledger の「4 面」に漏れていた）。加えて `SM-119` のキャラ選択の移設先 |
| `web/src/pages/ComparePage.tsx` | **同上**（参照点 1 か所） |
| `web/src/features/combo/components/AddComboToCompareModal.tsx` | 指示書 §1.3 が予見していた参照の置換 |
| `web/src/lib/constants.ts` | **失効した注記の是正のみ**（値は変えていない） |
| `web/src/pages/ComboEditorPage.tsx` | **失効したコメントの是正のみ** |
| `web/src/features/combo/components/ComboEditorCharacterField.tsx` | `SM-119` 初版の見出し追加（開発者判断で残置） |
| `web/src/constants/combo-list.ts` | `SM-012` の列定義 |
| `web/src/features/combo/hooks/useComboListFilters.ts` | 段 2 の読み取り `readSessionCharacterId()` |
| `web/src/features/combo/components/ColumnVisibilityMenu.test.tsx` | 列数のベタ書き 6 が赤くなったため。**★機械的に 7 へ +1 せず**、`COLUMN_DEFINITIONS.length` 由来へ書き直した（本来の主張は「定義した列がすべて出る」であり数ではない） |
| E2E 10 spec ＋ `web/e2e/support/new-combo.ts` | §5 の blast radius |

---

## 11. ★併せて更新が要るもの

| 項目 | 状況 |
|---|---|
| **消費した CHANGE 番号** | **なし。** 新規採番していない（`CHANGE-130` 起票済みの射程内）。⇒ `docs/handover/change-number-registry.md` §1 への登録は不要 |
| **その番号の写し先（実査 4 か所＝registry §1 ／ 契約 §4 ／ ボード §2.1 ／ ボード §2.4）** | **触っていない**（採番していないため） |
| **消費したマイグレ連番** | **0 本。** `ls migrations/` の実査値は動いていない |
| **版を上げた文書の参照元** | **版を上げた文書は無い**（設計書は設計卓の手番） |
| **`web/CLAUDE.md` §1 の台帳** | **追記なし**（新しいキーを作っていないため）。`combo-list-filters-v1` は登録済み |
| **★`DES-005` の 2 行が旧定義のまま残る** | **`CHANGE-130` の射程内。設計卓の手番である**（`CLAUDE.md` §8 により製造は設計書を編集しない）。逐語と行番号を §12 に置いた |
| **★`docs/handover/followup-backlog.md` の `F12-1 / E-2`** | **「未着手」のまま残っている。本サブで解消した。★製造が直接書けるのは §J だけである**（`D-382`）ため、**設計伝達レポート §4 へ候補として書く** |

---

## 12. 設計卓へ回す事項（**設計伝達レポート §1 / §4 に本文で書く**）

### 12-1 旧定義が残っている生きた記述 **3 行**（**行番号と逐語**）

**★初版の完了報告は「2 行」と断定していたが、`CHANGE-130` の 1 行が抜けていた**（レビュー 中-5）。

| 行 | 現在の記述 | 実装の as-built |
|---|---|---|
| `docs/design/05-screen-design.md:447` | 「…文脈の無い遷移（フッターの汎用「新規登録」導線・ホーム等）では従来どおりデフォルト表示キャラ（`INITIAL_CHARACTER_ID`）とする。」 | **文脈が無いときは段 2（セッション）→ 段 3b（`config.toml [defaults] character_id`）→ 段 4（`INITIAL_CHARACTER_ID`）の順に落ちる。** `INITIAL_CHARACTER_ID` は最終フォールバックであって「デフォルト表示キャラ」ではない |
| `docs/design/05-screen-design.md:560` | 「…（比較リストが空の場合はデフォルト表示キャラ `INITIAL_CHARACTER_ID`）。」 | **同上。** 空のときは解決順へ落ちる（先頭コンボのキャラを優先する文脈ロジックは不変） |
| `docs/change-notes/CHANGE-130-notification.md:78` | 「**`SM-119`（フィルタが新規登録のキャラ選択を兼ねていて不自然）は、新規登録側に明示的な入力を置き、その初期値を解決順から取ることで解く。**」 | **★開発者の途中指示で形が変わった。** 実装は**一覧側のヘッダ帯へキャラ選択を移し、役割をラベルで明記する**形である（新規登録側の見出しは併存）。**⇒ この 1 行は失効している** |

### 12-2 `DES-005` へ書く as-built（**分岐 A のため `DES-002` §4.2 は射程外**）

1. **既定キャラの解決順（5 段。段 3a は未実装の as-built 注記つき）**
2. **一覧のキャラ選択の位置**——**フィルタ欄ではなくヘッダ帯**（`SM-119`。**★開発者判断で指示書 §4.1-4 の指定から変更**）。ラベル「対象キャラ」＋補足「一覧の絞り込みと、新規登録の対象を兼ねます」
3. **新規登録（`mode === "new"`）の保存後の遷移先＝`/combos?character_id=<保存キャラ>`**。編集・コピー・確定反撃サーチ復帰は不変
4. **一覧の「セットプレイ数」列**（表示列カスタマイズ対象・既定は表示・0 件も 0 表示）
5. **★`SM-002` / `SM-004` は既に解消済みであり、`CHANGE-130` §2.2 / §2.3 の改訂は不要になった可能性がある**（設計卓の判断を仰ぐ）
6. **★一覧ヘッダ帯の並び**——**アイコン → 対象キャラ（プルダウン ＋ 補足）→ 登録済み N 件**。**キャラ名の大見出しは撤去した**（2026-08-25 開発者判断）
7. **★★既定を書き換えたら段 2 を捨てる**（追補②。§4.1）——**段 3 系の既定（`config.toml [defaults] character_id`）を書き換えたら、段 2 の記憶のうち「最後に選んだキャラ」だけを捨てる。** 他の軸は残す。**順序は変えない。** ★これは解決順の 5 段と対で書かないと意味が通らない
8. **★`setupCount` 列はマイコンボ画面にも出る**（`useColumnVisibility` / `ComboTable` を一覧と共有しているため）。**指示書は禁じておらず、既存の列カスタマイズの建付けと一貫している。意図した as-built である**（レビュー 低-4 の指摘で明記した）

### 12-3 その他

- **`followup-backlog.md` `F12-1 / E-2`（デフォルト表示キャラ配線漏れ）は本サブで解消した。** 状態の更新を設計卓へ。
- **★`web/CLAUDE.md` §1 台帳 #6 の用途欄が旧のまま**（レビュー 中-6）。現在の用途は「コンボ一覧のフィルタ・ソート状態（in-app ナビゲーション中の一時保持）」だが、**本サブでマイコンボ・エディタ・比較の 3 面が読み手として加わった**（読むのは `character_id` だけ）。**台帳への追記は CHANGE 経由のため製造は直さない。** `DES-005` §5.4 / §5.5 は 1 文字も変えていない。
- **★一覧応答のセットプレイ取得が失敗すると、新しい列が全行 `0` になる**（レビュー 低-5）。`internal/api/combo/handler.go:311-314` はバッチ取得の失敗を warn ログだけで握り、`setups` を空にする。**この経路では「本当に 0 件」と区別できない。** フロント単独では直せず、区別するには応答へ「取得に失敗した」を載せる必要がある＝**`DES-002` §4.2 の契約変更**（分岐 B 相当）。**本サブでは触らず、材料として記録する。**
- **★`docs/progress/M24-01-mock/` の寿命**（レビュー 低-7 ／ `CLAUDE.md` §10.Y）。**置き場は指示書 §4.10 の指定どおり。寿命は「`CHANGE-130` が `DES-005` へ反映され、設計卓が形を確認し終えた時点まで」とする。** それ以降は判断の材料としての役目を終える。**★「消す」は開発者の手番である**（D-196）ため、`M24-CLOSE` の観点として挙げる。
- **★`make e2e` で 1 度だけ観測した flaky**（`m14-03e-third-wave-seed.spec.ts`）。**隔離実行・直列実行の 2 手で再現せず、本サブの差分と接点も無い。** M23 期から続く「毎回 1 件・毎回別のテスト」の型（`m23-close-report` §7-1）。**横断課題として `progress-log.md` へ 1 行残す。**
- **`SM-083` は `要判断` として持ち越し**（`M24-CLOSE` の観点）。
- **`M-74`（設計卓の未実査）に加え、ledger の参照点「4 面」も実測と違った**（実測 6 ファイル）。**★ledger の数は 2026-08-20 時点の値であり identity ではない**という指示書の注意書きが、実際に効いた。

---

## 13. 判断が割れうる点 —— **★3 件とも決着した**（2026-08-25）

| # | 論点 | 決着 |
|---|---|---|
| 1 | **`SM-084` を `mode === "copy"` へ広げるか** | **★現状のまま（詳細画面）**（開発者判断。逐語＝**「現状のまま（詳細画面）」**）。理由は §4.4。**⇒ コード変更なし。推測ではなく裁定済みである** |
| 2 | **モックのパネル 3（`SM-002` の現状の写し）を残すか** | **★残す。** 指示書 §7.1 の literal（既に解消していたならモックを出さない）からは外れるが、**`D-543` の要請そのもの**が「実画面を見られないので、直っている可能性を自分で確かめたい」であり、**変更案ではなく現状の写しはその要請に直接応えるものである。変更後の姿は 1 枚も描いていない** |
| 3 | **`SM-002` / `SM-004` を「既に解消」と判定したこと** | **★コードで判定できる範囲では裏が取れている**（§2 の実査 #5 / #6。レビューも独立に確認済み）。**ただし「まだ紛らわしいか」は実画面を見ないと決まらない。⇒ §14-F で開発者に裏取りしていただく。まだ紛らわしければ判定を取り下げ、形の案を出し直す** |

---

## 14. ★開発者の手動確認（**コードでは判定できない項目**）

> **★実施済み**（**2026-08-25・開発者**）。**結果＝想定どおりの動作を確認**（開発者報告）。
>
> **★★この手動確認が解決順の穴を 1 つ掘り出した。** 実施の過程で「既定キャラを書き換えても段 2 のセッション記憶が勝って効かない」が見つかり、**追補②で是正して開発者が再確認、解消を確認した**（§4.1）。**⇒ 自動テストが原理的に届かない領域を人が見た、という本節の目的がそのまま働いた事例である。**
>
> **★実データの制約が 1 件**——**ダルシムは `moves` 未登録のため、確認にはイングリッドを用いた**（開発者報告）。**本サブの成果物とは無関係だが、次に同じ確認をする人のために記録する。**
>
> **★データ破壊のリスクは無い**——Go 側 0 バイト・スキーマ変更なし・マイグレ 0 本。
> **★`make e2e` を回すと `config.toml` が `PUT /api/config` で再シリアライズされる**（実際にコメントが落ちて `[defaults]` が付いた）。**A の設定が書き換わるため、手動確認の前後で回さないこと。**

**起動**: `go run ./cmd/combomgr`（別ターミナル）＋ `cd web && pnpm run dev` → `http://localhost:5173`

> **★`sessionStorage`（段 2）を消したいとき**——**タブを閉じるだけでよい。全ウィンドウを閉じる必要も、開発者ツールも要らない**（`sessionStorage` はタブ単位）。**ただし落とし穴が 2 つある**:
> 1. ブラウザの「**起動時に前回のタブを復元**」が効いていると、復元されたタブは `sessionStorage` も一緒に戻ることがある。
> 2. **リンク（`target="_blank"` / `window.open`）から開いた新タブは、開いた元タブの `sessionStorage` を複製して引き継ぐ。** アドレスバーから新規に開けば引き継がない。
>
> **確実にやるなら** DevTools の Console で `sessionStorage.clear()` → リロード。

| # | 確認すること | ★なぜコードでは判定できないか |
|---|---|---|
| **A** | **★★設定の既定キャラ（段 3b）が実際に効くか**<br>1. **設定 → 基本設定 → 「デフォルト表示キャラクター」**をリュウ以外（例: イングリッド）にして**保存**<br>2. `/combos` を開く → **対象キャラがそのキャラ**<br>3. `/mycombo` → **同じキャラ**<br>4. `/combos/new`（URL 直打ち等の文脈なし導線）→ **同じキャラ**<br>**★追補②で「タブを閉じる」は不要になった**——既定を書き換えた時点で段 2 の記憶（キャラのみ）を捨てるため、**その場で効く**（§4.1）。<br>**★対照**: 一覧でキャラ X を選ぶ → 詳細へ → 戻る → **X のまま**（段 2 は生きている。捨てるのは既定を書き換えたときだけ） | **★E2E 環境の `config.toml` は `character_id = 1`（リュウ）で、段 4 のフォールバックと同値である。** ⇒ **自動テストは「段 3b が効いた」のか「段 4 に落ちただけ」なのかを原理的に区別できていない。`SM-041` の本体そのもの。**<br>**★2026-08-25 の実機確認で、まさにここから追補②の穴が見つかった** |
| **B** | **段 1 → 段 2 の引き継ぎ**<br>1. `/combos` でダルシムを選ぶ<br>2. 適当なコンボの詳細へ → 戻る → **ダルシムのまま**（`SM-044`）<br>3. ヘッダの「マイコンボ」→ **ダルシム**（`SM-058`）<br>4. **★マイコンボのステータスタブとソートが、一覧で設定したものを持ち込んでいない** | 単体・E2E とも通っているが、**「体感として自然か」は人にしか判定できない**。とくに 4 は「持ち込むのはキャラだけ」という `D-545` の線が守れているかの体感確認 |
| **C** | **`SM-084` 保存後の遷移**<br>1. `/combos` でダルシムを選ぶ →「新規登録」→ 仮登録にチェック → **保存**<br>2. **一覧へ戻り、対象キャラがダルシムのまま**、保存した行が見える<br>3. **対照**: 既存コンボを**編集**して保存 → **詳細画面のまま**<br>4. **対照**: コンボ詳細の「コピー」→ 保存 → **詳細画面**（§13-1 の裁定どおり） | E2E で固定済みだが、**「保存を押したあと迷わないか」は人にしか判定できない** |
| **D** | **★ヘッダ帯の見た目**<br>・補足文「一覧の絞り込みと、新規登録の対象を兼ねます」で**帯が高くなりすぎていないか**<br>・ウィンドウを狭めたとき（タブレット幅・スマホ幅）の**折返しが崩れていないか**<br>・**アイコン → 対象キャラ → 登録済み N 件** の並びが読めるか | **★レイアウトは jsdom でも Playwright でも「壊れていないこと」しか見ていない。** 見栄え・行数・折返しの妥当性はテストの外側 |
| **E** | **`SM-012` セットプレイ数の列（実データで）**<br>・一覧に列が出る。**0 件も `0` と出る**<br>・表示列カスタマイズ（歯車）で**消せる／戻せる**<br>・**★マイコンボにも同じ列が出る**（列カスタマイズを一覧と共有しているため。意図した as-built） | E2E は使い捨て DB の 2 行で見ているだけ。**実 dev DB の件数分布（セットプレイが多いコンボ）での見え方**は別 |
| **F** | **★`SM-002`「既に解消」判定の裏取り**<br>`/mycombo` を開いて:<br>・3 つの件数が**タブの内側**にあり、**押すとタブが切り替わる**（空振りしない）<br>・タブの外の件数は情報バーの「**登録済み N 件**」1 個だけで、**押せる見た目をしていない** | **★「紛らわしいかどうか」は定義上コードで判定できない。** 製造は「M12-01 の C-07 で既に解消済み」と判定したが、**その判定が正しいかは実画面を見た人にしか決まらない。**<br>**★まだ紛らわしければ判定を取り下げ、形の案を出し直す** |
| **G** | **初回起動ウィザード**（余力があれば）<br>`config.toml` を**退避してから**消す → ウィザードが出る → Step 3 でキャラを選んで完了 → **一覧がそのキャラで開くか** | `SM-041` の出所。**ウィザード経路は E2E に無い**（`isInitialized` が false だと全ページが `/wizard` へリダイレクトされ、他の spec が全滅するため） |

**★A と F が本命である。** **A は自動テストでは原理的に確かめられない箇所**、**F は「実装しない」判定が正しいかの裏取り**である。

---

*以上、M24-01 完了報告。*
