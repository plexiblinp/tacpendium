# M24-05 完了報告: セットプレイ導線・紐付け UI 統合

| 項目 | 内容 |
|---|---|
| 対象指示書 | `docs/instructions/M24-05-setup-navigation-and-link-ui.md` **v1.1.0** |
| チェックリスト | `docs/instructions/reviews/M24-05-review-checklist.md` **v1.0.0**（**★版ずれあり＝§8**） |
| CHANGE | **`CHANGE-140`**（設計卓が起票済み。**製造は番号を消費していない**） |
| 着手基点 | `ad42c4a` |
| 実施日 | 2026-08-30 |
| マイグレ消費 | **0 本**（**次に払い出す番号は `000080` のまま**。`ls migrations/` の最新は `000079_fix_character_display_names`） |
| 新規依存 | **0 件** |
| スキーマ変更 | **なし** |

---

## 1. 実査結果（§3.3）

### 1.0 ★★母数の訂正——実査は「12 件」ではなく **9 件**である

指示書 §7.1-1 は「**§3.3 の実査 12 件**」と書いているが、**v1.1.0 の §3.3 表は 9 行**である（番号は 1/2/3/6/7/8/9/11/12 で、4・5・10 が欠番）。v1.0.0 から `SM-146` と `VAL-S04` を射程外へ出したときに行を削り、**番号を詰めずに件数だけが残った**もので、**「12 件」は失効している**。

数え直したコマンドと出力:

```
$ sed -n '/^| # | 確かめること | 系統 | なぜ要るか |/,/^---$/p' \
    docs/instructions/M24-05-setup-navigation-and-link-ui.md | grep -cE '^\| \*\*'
9
```

同じ理由で、**§7.1-1 が母数を要求している `§3.3-4` / `§3.3-10`、§9.3 が挙げる `§3.3-4` / `§3.3-5` は v1.1.0 に存在しない**（いずれも `SM-146` とともに削られた行）。**以降 9 件として報告する。**

### 1.1 実査 9 件

| # | 確かめたこと | 結果 |
|---|---|---|
| **1** | `LinkExistingSetupModal` の入口の全数 | **本番の入口は 1 か所**（`ComboDetailPage.tsx`）。**母数＝`grep -rn "LinkExistingSetupModal" web/src` が 12 ヒット / 4 ファイル**〔定義 1・本番 2（import と JSX）・vitest 9〕。**★1 か所と決めつけずに数えた結果、本当に 1 か所だった。** **★★ただし「相当のモーダル」がもう 1 系統ある**——§2 を参照。 |
| **2** | **両者の母集団が本当に同じか**（消してよい根拠） | **★★同一である。消してよい。** 経路が完全に一致していた——`GET /api/combos/{comboId}/setup-candidates`（**クエリパラメータなし**）→ `internal/api/setup/handler.go` `GetSetupCandidates` → `internal/service/setup/service.go` `FindCandidateSetups(characterID, knockdownAdvantage, comboID)` → `internal/repository/setup/repository.go` の 1 本の SQL〔同一キャラ ＋ 同一 `knockdown_advantage` ＋ `c.id != comboID` ＋ `NOT IN`（当該コンボ紐付け）＋ setups/combos の論理削除除外〕。**react-query の queryKey `["setupCandidates", comboId]` まで共有しており、キャッシュも同一。** 差は 2 点だけで、いずれも結果集合を変えない——(a) モーダル側が `parentComboIds.includes(parentComboId)` を**クライアントで重ねて掛けていた**（サーバ SQL の `NOT IN` と同条件。コード内コメントも「防御的に」と明記）／ (b) 取得タイミング（モーダルは開いたときだけ・候補表示は常時）。 |
| **3** | 候補 0 件のときの現在の見せ方 | **セクションごと非表示**だった（`ComboDetailPage.tsx` の `candidatesQuery.data && candidatesQuery.data.length > 0 &&`）。`DES-005` §5.6 項目11 の記述どおりで、裏取りできた。**★あわせて見出しの i18n キー `comboDetail.setups.candidatesHeading` が ja / en どちらにも存在せず、`defaultValue` で描かれていた**ことが分かった（本サブで両ロケールへ追加した）。 |
| **6** | `RecipeText` を通っていない箇所の全数（**★単位＝セットプレイのレシピを描く面**。コンボ側にも未経由の面が 2 つ残る〔`HomePage` / `TrashComboDetailPage`〕が、本サブの射程外） | **★母数は 12 か所であり、followup と `RecipeText.tsx` のヘッダコメントが書いていた「5 か所」は失効していた。** 用途で 3 群に分かれる——**A. `setup.defaultRecipe` を本文として描く 6**〔`SetupAccordionItem` / `SetupCandidateList` / `SetupTreeRow` / `LinkExistingSetupModal` / `SetupSelectorModal` / **`SetupRegistrationSection`**〕**／ B. 名前の代替として描く 3**〔`CompareTable` / `TrashSetupListRow` / `TrashBulkActions`〕**／ C. steps から自前で組み立てる 3**〔`SetupInputRow` / `SetupRecipeEditor` / `SetplaySuggestionSection`〕。**★★`SetupRegistrationSection` は旧記述の 5 か所に入っていなかった**——「5 か所」を信じて数え直さなければ 1 か所取り残していた。空表示の文言も **4 種**に割れていた〔`"（レシピなし）"` 直書き 6 / `RECIPE_EMPTY_LABEL` / `"(レシピ未入力)"` / `"ステップがありません"`〕。 |
| **7** | **`SM-052` の実体** | **★★`RecipeText` では解けない。指示書 §4.2 の見立て（共通部品を通せば解ける）は機序と違っていた。** 実体は **modifiers 要約表示の 2 重実装**である——コンボ側 `StepRow.tsx` の `renderModifiersSummary` と、セットプレイ側 `SetupRecipeEditor.tsx` のインライン記述。**食い違いは 5 点**: (a) flags を `MODIFIER_FLAGS` へ通さず**内部コードのまま**出していた（`just` / `link` / `od_lm`）／ (b) notes を**本文ごと行内へ展開**していた（コンボ側は `※` 記号 ＋ `title` ホバー）／ (c) 1 個の `span` へ `", "` で連結していた（コンボ側は flag ごとにバッジ）／ (d) `modifiers.type` を内部コードのまま並べていた（コンボ側は要約に出さない）／ (e) **★型だけのステップ（`parry_drive_rush` / `cancel_drive_rush`）でも灰色のバッジを描いていた**——**主ラベルが「パリィドライブラッシュ」と日本語で出しているのと同じ情報が、バッジ側に内部コードで二重に出ていた**（コンボ側は flags も notes も無ければ `null` を返す）。**★★2026-08-30 訂正**——初版は「中身が空でも灰バッジが残る」と書いたが、**完全に空の修飾は画面操作では作れない**（`ModifiersEditor` は中身がゼロなら `undefined` を返す）。旧実装の「空文字を join して空のバッジを描く」分岐は理論上のものであり、**実際に見えていたのは上記の二重表示である**。**★開発者の実機確認で「何のことか分からず検証できない」と指摘され判明した——説明が不正確だと検証そのものを妨げる。** **★再現手順**＝セットプレイ編集 → 技プルダウン → 区分「共通システム」→ 「パリィドライブラッシュ」→ 「ステップを追加」。**★編集ダイアログ `ModifiersEditor` は元から共有されており、食い違っていたのは要約表示だけだった。** ⇒ 開発者の判断（本ターン）に従い**共通化して直した**（§3.2）。 |
| **8** | セットプレイ編集にコピーが在るか／コンボ側の形 | **セットプレイ側は 0 件。** `SetupEditorPage` は `useSearchParams` も `location.state` も使っておらず、**初期値を外部から注入する経路自体が無かった。** **コンボ側の形＝query 経由 `?copyFrom={id}`**〔入口は `ComboDetailPage` と `ComboTableRow` の 2 か所 → `/combos/new` に着地 → `ComboEditorPage` が `mode: "new" | "edit" | "copy"` を決め、`useCombo(copyFromId)` の結果を `initial` として `useState` の遅延初期化子で 1 回だけ投入。保存は常に POST〕。**★コンボのコピーは紐づくセットプレイを 1 件も引き継がない**（`setupsToCreate` / `linkedSetups` が `initial` を見ていない）。 |
| **★9** | **`SM-088` が既に成立しているか。どの経路で・どういう規則で名前が入るか** | **★成立している。§1.2 に逐語で記す。** |
| **11** | `/setups/:setupId` に離脱ガードが通っているか | **3 フックとも通っている**〔`useUnsavedChangesGuard` ／ `useRequestLeave`（上部・下部のキャンセルが同じ `handleCancel` を呼ぶ）／ `useLeaveWithoutConfirm`（保存後の遷移）〕。**★出所の訂正——指示書 §3.3-11 と followup は「`M24-12` の実測」と書いているが、実際に入れたのは `M24-04`（CO-003）である**（`1e41985 feat(M24-04/combo): 未保存のまま離れようとしたときの確認ダイアログ(CO-003)`。**`M24-12` のコミットは `SetupEditorPage.tsx` を 1 度も変更していない**）。 |
| **12** | `M24-13` の変更が入っているか（投入順） | **入っている。投入順は守られている。** `2542394 fix(M24-13/setup): VAL-S04 の check-then-act 競合を塞ぐ` が履歴にあり、HEAD に `internal/service/setup/deps_adapter.go`（`SetupDuplicateAdapter`）・`service.go` の `txScopedValidDeps`・`val_s04_race_test.go` が実在する。 |

### 1.2 ★★`SM-088` の実測結果（§4.4・§7.1-5）

**成立している。ただし経路は「セットプレイ自動提案からの採用」1 本である。**

**規則の逐語**（`web/src/locales/*.json` の `setplay.adoptNameFormat`）:

- **ja: `"{{move}} 持続{{n}}F目重ね"`**
- **en: `"{{move}} meaty on active frame {{n}}"`**

| 要素 | 実測 |
|---|---|
| `{{move}}` | **提案 steps の単純な末尾要素の技名**。`nameJa ?? code` で解決する（**en ロケールでも技名は日本語**。書式だけが英語になる） |
| `{{n}}` | 起き上がりに重なる持続フレーム番号 |
| 区切り | **半角スペース 1 個**。`・` は使わない |
| 「〇〇重ね」の語 | **`重ね` の 1 語だけ**。`attack_type` の表示語彙〔投げ重ね / シミー / 打撃重ね〕は**使っていない** |
| 入るタイミング | 「採用」を押した 1 回だけ `setName` する。**以後は入力欄で自由に編集でき、上書きしない** |
| モード差 | **gap（あえて重ねない）でも同じ書式**。名前側にモード分岐は無い |

**★★設計卓の暫定案（`CHANGE-140` §7 確認事項 2 の `{attack_type の表示名}・{最後の技の表示名}`、例「打撃重ね・弱P」）とは一致しない。実装側を正とした**（指示書 §5.1「実測した規則に従うこと。設計卓の暫定案を書かないこと」）。

**⇒ `DES-005` §5.9 へ as-built として書けるよう、上表をそのまま渡す。**

**通常の新規登録 `/combos/:comboId/setups/new` と編集 `/setups/:setupId` には自動生成が無い。これは仕様どおりである**——開発者の逐語が「**自動提案時に**通常の登録のようにユーザーが必須項目であるセットプレイ名をイチイチ決めないといけないのが良くなかった」と経路を限定しており、本ターンの開発者回答でも「現状のまま」と確定した。**⇒ 欠陥ではない。実装していない。**

---

## 2. ★★実査で見つけた「相当のモーダルがもう 1 系統ある」件（§3.3-1 の派生）

**memo の逐語は「編集の既存から紐付けボタンもういらない」であり、「編集の」と書かれている。** ところが**文言「既存から紐付け」は詳細画面のボタンのもの**で、**エディタ側には別部品の同趣旨のモーダルが在る**。

| | 詳細画面 | コンボ登録・編集エディタ |
|---|---|---|
| ボタン文言 | **「既存から紐付け」** | 「既存のセットプレイを紐付け」 |
| モーダル | `LinkExistingSetupModal` | `SetupSelectorModal`（**ダイアログ表題は「既存セットプレイから紐付け」で完全同文**） |
| API | `GET /api/combos/{comboId}/setup-candidates` | `GET /api/setups/candidates?characterId=&knockdownAdvantage=` |
| 母集団 | 同一キャラ ＋ 同一 KA ＋ **当該コンボ未紐付け** | 同一キャラ ＋ 同一 KA。**「当該コンボ未紐付け」が効かない**（`excludeComboID=0` で呼ぶため） |
| 同じ面に候補表示が在るか | **在る**（`SetupCandidateList`） | **無い** |

**開発者の回答（本ターン・逐語）＝「詳細は消す。編集については、KA入力して既存セットプレイを検索して紐づけるような形にしたい。その前段階として削除するかは任せる。編集については申し送りとして設計卓へ完了時のレポートで伝達。」**

**⇒ 詳細画面のみ撤去し、エディタ側 `SetupSelectorModal` は残した。**

**残した理由**——**代替の形（KA を入力して検索する）がまだ無く、今消すとコンボ登録・編集の途中で既存セットプレイを紐付ける手段がゼロになる**（あの面に候補表示は無い）。**母集団も別である**ため、指示書 §4.1「消す前提の検証」のゲート（母集団が同じこと）も、エディタ側については満たしていない。**⇒ 設計伝達レポート §4-1 へ開発者の逐語つきで申し送った**（`docs/handover/design-reports/20260830-m24-05-design-exceptions.md`。**★本報告の初版では同レポートが未作成のまま「申し送った」と過去形で書いており、レビュー 高-3 で指摘された。取り込みで実際に作成したうえでこの記述を残している**）。

---

## 3. 実装した内容

### 3.1 `CO-002`——「既存から紐付け」の撤去と候補 0 件の見せ方（§4.1）

- `ComboDetailPage.tsx` から import 2 行・`linkModalOpen` state・`useLinkExistingSetupForm` の呼び出し・ボタン・モーダル描画を撤去した。
- **削除したファイル 4 本**: `LinkExistingSetupModal.tsx` / `LinkExistingSetupModal.test.tsx` / `useLinkExistingSetupForm.ts` / `useLinkExistingSetupForm.test.ts`。`ComboDetailPage.test.tsx` の `vi.mock` も外した。**参照は 0 件**（`grep -rn "LinkExistingSetupModal\|useLinkExistingSetupForm" web/src web/e2e` が実装コードに 0 ヒット。残るのは撤去を説明するコメント 2 行のみ）。
- **候補 0 件でもセクションを出し「候補はありません」と書く**（`D-588`）。`SetupCandidateList` に空表示と `data-testid="setup-candidates"` / `"setup-candidates-empty"` を足し、`ComboDetailPage` 側の `length > 0` 条件を外した。
- **i18n**: `comboDetail.setups.candidatesHeading` と `candidatesEmpty` を **ja / en の両方**へ新設した（§4.6 の「新規キーは足してよい」）。**★見出しキーは元々どちらのロケールにも無く `defaultValue` 頼りだったため、この追加で欠落も埋まった。**

**文言「候補はありません」は §9.2 で委任された事項**であり、趣旨（候補が無いだけで機能は在る）が伝わることを基準に選んだ。

### 3.2 `SM-052`——modifiers 要約の共通化（§4.2 の実体・開発者の指示により実施）

- **新規 `web/src/features/combo/components/ModifiersSummary.tsx`** に `StepRow.tsx` の `renderModifiersSummary` を切り出した。**★描画の規則は変えていないが「1 文字も変えていない」ではない**（レビュー 低-2）——`data-testid="modifiers-summary"` を新設したため `StepRow` の DOM は変わる。
- `StepRow.tsx` は新部品を呼ぶだけにした（**コンボ側の見た目は不変**）。
- `SetupRecipeEditor.tsx` のインライン実装を新部品へ置換した。**⇒ セットプレイ側でも flags が日本語ラベルになり、notes が `※` ＋ ホバーになり、型だけのステップ（ドライブラッシュ類）で主ラベルと二重に出ていた内部コードのバッジが出なくなった。**
- **★`modifiers.type` の情報は失われていない**（レビュー 低-5）——同ファイルの `renderStepLabel` が `MODIFIER_NON_MOVE_TYPES` 経由で**ステップの主ラベルとして user 語彙で出し続ける**。要約から消えたのは「内部コードでの重複表示」だけである。

**★`RecipeText` は 1 行も作り替えていない**（§4.2 / チェックリスト 1-6）。

### 3.3 レシピ表示を `RecipeText` へ寄せる（§4.2 / followup）

**A 群 6 か所のうち、撤去した `LinkExistingSetupModal` を除く 5 か所を通した。**

| 面 | `fullView` | 理由 |
|---|---|---|
| `SetupAccordionItem` | **固定 `true`** | **`DES-005` §5.6 項目10 が「各セットプレイのレシピを全文〔複数行折返し〕表示」と定めている。** 省略側へ倒すと設計書に反する |

**★★利用者に見える変化が 1 つある**（レビュー 中-2）——`RecipeText` の全文モードは**ステップごとに `1.` `2.` と番号を振って縦へ展開する**実装であり、`SetupAccordionItem` 従来の「`>` 区切り 1 本の文字列を折り返す」表示とは見え方が違う。**`DES-005` §5.6 項目10 の「全文〔複数行折返し〕表示」には反しないが、モック HTML には含めていない面である**（§4）。**⇒ 開発者の目視確認では見えないため、ここに as-built として明記する。**
| `SetupCandidateList` / `SetupTreeRow` / `SetupSelectorModal` / `SetupRegistrationSection` | 固定 `false` | いずれも 1 行に収める面。現在の見え方を保つ |

**★★共有トグル（`recipe-full-view-v1`）へは繋いでいない。製造判断であり、理由は次のとおり。** 同キーは `DES-005` が「**コンボの 4 面が 1 つの値を共有する**」と定めたものであり（`web/CLAUDE.md` §1 台帳 #11）、**読み手を増やすことは台帳と設計書の変更を伴う**。§4.2 が求めているのは**表示の統一**であってトグルの拡張ではないため、面ごとの固定値で渡す形を採った。**⇒ ブラウザストレージのキーは新設も変更もしていない。**

**通していない残り 6 か所と、その理由**（§7.1-4「通していない箇所が残るなら理由を報告」）:

| 群 | 面 | 通さなかった理由 |
|---|---|---|
| **B（名前の代替）** | `CompareTable` / `TrashSetupListRow` / `TrashBulkActions` | **レシピの表示ではなく「名前が無いときの代替表示」である。** `getSetupDisplayName` が持つ**文字数での切り詰め規則**（`RecipeText` の CSS truncate とは別物）に従う面であり、通すと切り詰め方が変わる |
| **C（未保存の steps）** | `SetupInputRow` / `SetupRecipeEditor` | **編集中の steps を描く面**であり、`RecipeText` が要求する `recipe_cache` 由来の文字列がまだ存在しない |
| **C** | `SetplaySuggestionSection` | 同上に加え、**`DES-005` §5.6 項目12（自動提案）＝別系統であり §1.6-5 で触らないと定められている** |

**★`RecipeText.tsx` のヘッダコメントが書いていた「5 か所」は失効していたので是正した**（実測 12 か所・本サブで 5 を通した・残り 6 と理由を明記）。**撤回済みの記述をコードに残さない**（レビュー較正上「高」）。

**★面側の手書きリテラル `"（レシピなし）"` は 0 件になった**（`grep -rn '"（レシピなし）"' web/src --include=*.tsx | grep -v '\.test\.'` の残りは `recipeDisplay.ts` の定数定義 1 件と説明コメント 1 行のみ）。

### 3.4 `SM-011`——セットプレイ編集にコピー（§4.5）

- `/setups/:setupId`（編集モード）に「コピー」を置き、**`/combos/{parentComboId}/setups/new?copyFrom={setupId}`** へ飛ばす。**コンボ側と同じ作法（query 経由）であり、新しい作法は作っていない。**
- **親コンボの決め方＝コピー元の先頭の親。不在なら導線を出さない**（§4.5 が報告を求めた事項）。**★これは新しい規則ではない**——`DES-005` §5.9 が「ほかの人の内容を見る」で定めた既存の規則であり、この画面の `parentComboId` がまさにそれである。**`VAL-S05`（親コンボ ID 必須）のため、親が無ければそもそも作成が成立しない。**
- **成立条件は引き継がない**（`DES-005` §5.6「コピー時は成立条件を引き継がない・全セル未検証で開始」）。投入するのは**名前・説明・レシピの 3 つだけ**。
- **投入後に離脱ガードの基準値を採り直している。** 採らないと読み込みが終わった瞬間に「入力が変わった」ことになり、何も触っていないのに離脱確認が出る（編集モードの hydrate と同じ罠）。

**★製造判断: `mode` を 3 値にしなかった。** コンボ側は `"new" | "edit" | "copy"` だが、`SetupEditorPage` には `mode === "create"` の分岐が **6 か所**ある〔キャラの引き元 / 上部キャンセルの形 / 成立条件の表示 / 保存前ゴミ箱チェック / 保存経路 / 読み込み判定〕。3 値にすると**そのすべてを `mode !== "edit"` へ書き換える**ことになり、`M19-07` / `M22-04` / `M23-09` / `M24-04` が積んだ分岐へ波及する。**⇒ フラグを 1 本足すだけにして、既存の分岐を 1 つも動かしていない。**

**★i18n キーは足していない**（この画面は「セットプレイ登録」「保存」「キャンセル」まで含めて全面がハードコードの日本語であり、新規の 2 文字列だけ i18n にすると**同じ画面に 2 系統が混ざる**。`M24-03` が避けたのと同じ形である。**i18n は `M24-07` の手番**＝§1.6-8）。**⇒ 設計伝達レポート §4-9 へ渡した。**

### 3.5 `SM-088`——実装していない。成立を固定した（§4.4）

**実装は 1 行も足していない。** 既に成立している生成式を `web/src/features/setplay/adoptName.ts` へ切り出し、純粋関数テストで固定した。**★1 点だけ挙動差がある**（レビュー 低-2）——旧実装は `steps` が空なら例外になる形、新実装は空文字を返す。`SetplaySuggestionStep` の型と生成経路から空にはならないため実害は無いが、「挙動不変」と言い切れる形ではない。

**★切り出しが必要だった理由**: §5.1 が「`SM-088` の成立を固定する純粋関数テスト」を、§5.3 の破壊確認 3 が「自動生成を止めると純粋関数テストが赤くなる」ことを求めている。**インラインのままではどちらも書けず、「既に成立している」ことが 1 つも固定されない。**

**★locales の書式そのものもテストで固定した。** テスト側は書式を複製しているため、**複製元が変われば赤くなる**形にしてある（複製が静かにずれるのを防ぐ）。

---

## 4. ★★§4.7 モック HTML

`docs/progress/M24-05-mock/m24-05-link-ui.html`（単一 HTML・外部 CSS / JS / 画像に依存しない）。**承認直後・コード変更前**に作成して提示した。

内容＝**変更前**（「既存から紐付け」＋候補表示の 2 系統）／**変更後**（候補表示のみ）／**候補 0 件のときの見え方**／参考としてコピー導線。

**★§4.7 の 2 件目「`SM-146` の導線の置き場と見え方」は出していない。** `SM-146` は `D-588` で射程外になっており（§1.6-10）、**置き場も見え方も本サブでは決めないため**である。

---

## 5. テスト結果（§7.2）

**★基準値は変更を入れる前に、同一セッション内の背中合わせで採った。採取コマンドにパイプでの切り詰めは入れていない。**

| 対象 | 着手前（`ad42c4a`） | 完了時 | 差 |
|---|---|---|---|
| `go test ./... -count=1` | **全パッケージ `ok`** | **全パッケージ `ok`** | **同じ**（`git diff --stat ad42c4a -- internal/ cmd/ migrations/` が**空**＝Go を 1 行も触っていない） |
| `cd web && pnpm test` | **198 files / 2166 tests passed** | **199 files / 2192 tests passed** | **files +1 / tests +26** |
| `make e2e` | — | **222 passed** | 新規 spec 7 ケースを含む |

**フロントの内訳（差が合うことの確認）**:

| 操作 | ファイル | tests |
|---|---|---|
| 削除 | `LinkExistingSetupModal.test.tsx` ＋ `useLinkExistingSetupForm.test.ts` | **−8**（実測: 削除直後に 2158） |
| 既存へ追加 | `ComboDetailPage.test.tsx`「既存から紐付けボタンが存在しない」 ／ `SetupCandidateList.test.tsx`「レシピを RecipeText で描く」 | **+2**（実測: 2160） |
| 新規 | `ModifiersSummary.test.tsx` | **+7** |
| 新規 | `adoptName.test.ts` | **+12**（実測: 2179） |
| 新規 | `SetupEditorPage.copy.test.tsx` | **+8**（実測: 2187） |
| **レビュー取り込み** | `SetupAccordionItem` / `SetupSelectorModal` / `SetupRegistrationSection` の `RecipeText` 固定（中-1）・コピーの離脱ガード基準値（中-3）・名前を上書きしない（中-4） | **+5**（実測: 2192） |

**`2166 − 8 + 2 + 7 + 12 + 8 = 2187`**（レビュー提出時点）。**取り込みで 5 件足して `2192`**（実測と一致）。ファイル数は `198 − 2 + 3 = 199`（実測と一致）。**★`SetupTreeRow.test.tsx` の 2 ケースは件数を変えずに掴み方だけ書き換えたため、この計算には現れない。**

**`make e2e` 実行直前のポート確認**（§2.4・§7.2。毎回実行した）:

```
$ (ss -ltnp 2>/dev/null || netstat -ltnp 2>/dev/null) | grep -E '47390|5273' || echo "→ 47390 / 5273 ともに空き"
→ 47390 / 5273 ともに空き
```

### 5.1 既存 spec の扱い（§5.2）

- **「既存から紐付け」を踏んでいる E2E spec は 0 件だった**（母数＝**着手時点の `ls web/e2e/*.spec.ts | wc -l` は 58 本**。完了時は本サブの新規 1 本を足して 59 本。**58 本すべてを走査**した。`既存から紐付け` / `既存のセットプレイを紐付け` / `既存セットプレイから紐付け` / `LinkExistingSetupModal` / `このコンボにも紐付ける` / `転用可能` / `setups/candidates` のいずれも 0 ヒット）。**⇒ 書き換えた spec は 0 本であり、検証内容を緩めた箇所は無い。** `m19-01` / `m19-02` は同エンドポイントを `page.request.get` で叩くだけでモーダルを踏んでいない。
- **モーダルを踏んでいたのは vitest 単体テストのみ**（`LinkExistingSetupModal.test.tsx` の 5 ケース）。**部品ごと消えたため削除した。**
- **`m19-03` / `m19-07` / `m24-12` の spec は 1 本も落ちていない**（`make e2e` 221 passed に含まれる）。
- **書き換えたコンポーネントテスト 3 件と、緩めていないことの根拠**:
  - `ComboDetailPage.test.tsx`「候補 0 件時にセクションが非表示」→ **挙動が反転したため、「0 件でもセクションを出す」へ書き換えた**。さらに **「既存から紐付けボタンが存在しない」を新設** した（**検証は増えている**）。
  - `SetupCandidateList.test.tsx`「空配列の場合は見出しのみ表示」→ **「セクションと『候補はありません』を出す」へ**（**testid・見出し・文言の 3 点を見る形に増えた**）。
  - `SetupTreeRow.test.tsx` の 2 件 → `RecipeText` 経由で角括弧と本文が別要素になったため掴み方を変えた。**★緩めていない**——本文が `RecipeText` で描かれていること（`data-testid` ／ `data-recipe-view`）を**追加で**確かめ、括弧つきの見え方は包む要素の `textContent` で従来どおり確かめている。
- **`getByRole` の `name` の部分一致対策**（§5.1 / チェックリスト 5-8）: 破壊確認は**文言の「追記」ではなく実装の構造を変える形**で行った（§6）。E2E の撤去確認では `exact: true` を明示している。

---

## 6. 破壊確認 **3 件**（§5.3）

**★指示書 v1.1.0 §5.3 は 3 件である**（チェックリスト v1.0.0 の「5 件」は失効＝§8）。

**★書く前に 3 点を確かめた**——(a) 壊す対象が実在するか（各行を `grep` で提示）／ (b) その壊し方で観測が変わるか（下表の実測）／ (c) 期待経路は観測が何を見ているかから立てた。
**★クラスを足す形では壊していない**（jsdom は Tailwind を読まないため観測が変わらない＝`M24-12` の教訓）。**すべて構造を変える側で壊した。**

| # | 壊したもの（実施コマンド相当） | 結果 | 赤くなった経路の数 |
|---|---|---|---|
| **1** | `SetupCandidateList.tsx` の `disabled={linkMutation.isPending}` → `disabled`（常時無効化） | **E2E (2)「候補表示から紐付けられる」が赤**。他の 5 ケースは緑のまま | **1 経路**（E2E のみ。コンポーネントテストは押下を mutate のモックで見ているため、disabled 化では落ちない＝**この観測の限界を明示しておく**） |
| **2** | (前半) `SetupCandidateList.tsx` の空表示ブロックを削除 ／ (後半) `ComboDetailPage.tsx` の条件を `&& candidatesQuery.data.length > 0 &&` へ戻す | (前半) **`SetupCandidateList.test.tsx`「候補 0 件でもセクションと『候補はありません』を出す」が赤** ／ (後半) **`ComboDetailPage.test.tsx`「候補 0 件でもセクションを出す(D-588)」が赤 ＋ E2E (1b) が赤** | **3 経路**（コンポーネント 2 ＋ E2E 1） |
| **3** | `adoptName.ts` の `buildAdoptedSetupName` が常に空文字を返すようにする（**★型は valid のまま**。最初に単純な早期 return で壊したところ**ビルドが落ちて「テストが赤い」ではなく「起動しない」になった**ため、引数を使ったまま結果を捨てる形へ変えた） | **`adoptName.test.ts` の 4 ケースが赤 ＋ E2E (3) が赤** | **2 層 5 経路**（純粋関数 4 ＋ E2E 1）。**⇒ 「既に成立していること」は固定されている** |

**3 件とも実施後に完全に復元し、`git status` / `git diff` が空であることを確認したうえで全テストを再実行して緑に戻した**（フロント 199/2187・E2E 221 passed）。

**★レビュー取り込みで破壊確認を 2 件追加した**（下記）。いずれも実施後に復元し、差分が空であることを確認している。

| # | 壊したもの | 結果 |
|---|---|---|
| **追-1** | `SetupEditorPage` のコピー用 `useEffect` から `setDirtyBaseline(...)` を外す | **`SetupEditorPage.copy.test.tsx`「コピー直後は離脱ガードが張られない」が赤**（レビュー 中-3 の是正が空振りでないことの確認） |
| **追-2** | 採用パネルの名前入力の `value={name}` を `value={generatedName}` にする（＝利用者の入力を上書きする） | **`SetplaySuggestionSection.test.tsx`「入力済みのセットプレイ名を自動生成で上書きしない」が赤**（レビュー 中-4 の是正が空振りでないことの確認） |

---

## 7. §7.4.1 CHANGE 要否の判定（**7 件を 1 件ずつ・as-built で判定**）

| # | 条件 | 判定 |
|---|---|---|
| **1** | `DES-002` §4.2 の経路表に載る API を新設・変更したか | **していない。** `internal/` の差分は 0（`git diff --stat ad42c4a -- internal/ cmd/` が空）。既存の `GET /api/combos/{comboId}/setup-candidates` / `POST /combos/{comboId}/setup-links` / `POST /combos/{comboId}/setups` を**呼び方も含めて変えていない**。**⇒ §2.3 の例外条項は発動していない** |
| **2** | `DES-003` のスキーマに触れたか | **触れていない。** マイグレーション消費 **0 本**（`migrations/` の最新は `000079`。**次に払い出す番号は `000080` のまま**） |
| **3** | `DES-006` の VAL-S 系の判定結果が変わったか | **変わっていない。** `VAL-S01`〜`S07` の判定コードに差分なし。**★`VAL-S06`（名前必須）は撤回していない**——`SetupEditorPage` の `saveDisabled` に `!name \|\| name.trim() === ""` が残っており、BE の `validate.go` も無変更 |
| **4** | `SUPP-001` の契約を持つ節に触れたか（新パッケージ等） | **触れていない。** `internal/service/notation/` / `internal/service/preset/`（契約 F-1）に差分 0。**新設したのはフロントの部品・純粋関数のみ**（`ModifiersSummary.tsx` / `adoptName.ts`） |
| **5** | ブラウザストレージのキーを新設・変更したか | **していない。** `bash scripts/check-browser-storage-keys.sh` が緑（台帳 11 件 / 本番コード 10 件・一致）。**★`recipe-full-view-v1` の読み手も増やしていない**（§3.3 の製造判断） |
| **6** | **`DES-005` §5.6 項目12（自動提案）に触れたか** | **★★触れた。報告する。** `SetplaySuggestionSection.tsx` の 2 か所を変更した——(a) 名前生成のインライン式を `buildAdoptedSetupName` の呼び出しへ置換 (b) 不要になった `const target` を削除。**★提案エンジン・条件パネル・ソート・採用／不採用・制約告知・保存経路は 1 行も変えていない。挙動は不変である。** **★触った理由は §5.1 の純粋関数テストと §5.3 の破壊確認 3 が、切り出さなければ成立しないためである**（§3.5）。**⇒ 設計卓の判断を仰ぐ** |
| **7** | マイグレーションを消費したか | **していない（0 本）。** ボード §2.2 の連番セルの更新は**不要** |

**⇒ `CHANGE-140` の射程が広がる事項は #6 の 1 件のみ**（`DES-005` §5.6 項目12 のファイルに触れた事実。**設計書の記述を変える必要は無い見込み**——挙動が不変であるため）。**★判定した結果「射程は広がらなかった」項目も、判定したこと自体をここに残している**（§9.4）。

---

## 8. ★★逸脱・報告事項

**★指示書が挙げた要求を実装しないと決めた箇所は「判断」ではなく「逸脱」として書く**（playbook §4.42）。

| # | 事項 | 区分 |
|---|---|---|
| **1** | **チェックリスト v1.0.0 が指示書 v1.0.0 を対象にしており、v1.1.0 と食い違っている** | **★報告（製造では直せない）。** 具体的には——**実査 12 件（正 9 件）／ E2E 4 ケース（指示書 v1.1.0 §5.1 は 3 ケース）／ 破壊確認 5 件（同 §5.3 は 3 件）／ 参照先 §3.3-4・-5・-10 が v1.1.0 に存在しない／ §0.3-6 が参照する §7.1-8 も存在しない（§7.1 は 8 が欠番）**。**★チェックリスト 1-7（`SM-146` の「最後の技」の定義）・4-2〜4-4（セットプレイからコンボへ飛べるか）・1-10（`attack_type` の表示名）・5-4（非技ステップのテスト）・6-2（破壊確認 5）は、いずれも `D-588` で射程外になった `SM-146` / `SM-088` の暫定案に紐づく項目であり、本サブでは該当しない。** **⇒ 指示書 v1.1.0 を正として作業した。** `bash scripts/check-instruction-format.sh` は版数一致を見るが**チェックリストと指示書の版ずれは検出しない**（緑のまま） |
| **2** | **エディタ側 `SetupSelectorModal` を消していない** | **★製造判断 ＋ 開発者の明示的な委任**（「その前段階として削除するかは任せる」）。理由は §2。**⇒ 設計伝達レポート §4 へ申し送り** |
| **3** | **`SM-052` を `RecipeText` では解いていない** | **★指示書 §4.2 の見立てが機序と違った。**実体は modifiers 要約の 2 重実装であり、開発者の指示で共通化して直した（§1.1-7 / §3.2）。**★見立てを実装の根拠にしていない** |
| **4** | **`RecipeText` へ通したのは 12 か所中 5 か所** | **★理由を §3.3 に用途別で報告済み。** 残り 6 は「通せない」ものであり、取り残しではない |
| **5** | **`SM-146` に手を入れていない**（§7.1-7） | **★射程外**（§1.6-10・`D-588`）。**導線・「最後の技」の定義・一覧の始動技フィルター・持続当ての扱い、いずれも 1 行も触っていない。** モックも出していない（§4） |
| **6** | **`SM-088` を通常登録・編集へ広げていない** | **★仕様どおり**（開発者回答「現状のまま」）。§1.2 |
| **7** | **`SetupEditorPage` へ i18n キーを足していない** | **★製造判断**。同画面が全面ハードコードのため（§3.4）。`M24-07` へ渡す |
| **8** | **`internal/` の 2 件を直していない** | **★スコープ外として報告のみ**（§9） |

---

## 9. 直していない発見（followup 候補・設計伝達レポート §4 へ回す）

| # | 内容 | 直さなかった理由 |
|---|---|---|
| **1** | **`internal/service/setup/service.go` の `UpdateSetup` が `ValidateSetupUpdate` を `if input.Steps != nil` の内側でしか呼んでいない。** ⇒ `PATCH /setups/:id` に `steps` を含めず `name: ""` だけを送ると **`VAL-S06` が走らない**（`validate.go` のコメントは「レシピ未変更でも実行する」と書いており、記述と実装が食い違っている）。**画面は常に `steps` を同送するため UI からは踏めない** | **`internal/` かつ VAL の挙動であり、§1.6-4 / §2.2 / §9.1 が触ることを禁じている** |
| **2** | **`SetupEditorPage` の `handleTrashRestore` が素の `navigate()` を使っており、離脱ガードの 3 フックを 1 つも通していない**（M23-09 由来の既存挙動） | 本サブの射程外。**`M24-12` の成果を落としてはいないが、元から通っていない経路である** |
| **3** | **セットプレイのレシピ空表示の文言が 4 種に割れている**（`"（レシピなし）"` / `"(レシピ未入力)"` / `"ステップがありません"` / 定数）。本サブで**面側の直書きは 0 件になった**が、C 群の 2 種は残る | C 群は `RecipeText` を通せない面であるため（§3.3） |
| **4** | **コピーの作法が 3 通りある**（コンボ＝query ／ プリセット＝ダイアログ ／ セットプレイ＝本サブで query に揃えた） | 本サブは「新しい作法を作らない」を守っただけで、プリセット側の統一は射程外 |
| **5** | **離脱ガードの出所が `M24-12` と記録されているが実際は `M24-04`**（指示書 §3.3-11 ／ followup `setup-editor-not-on-shared-editor-parts`） | 記録の訂正であり、設計卓の手番 |

---

## 10. ■ 併せて更新が要るもの

| 項目 | 状態 |
|---|---|
| **消費した CHANGE 番号の登録** | **なし。** `CHANGE-140` は**設計卓が起票済み**であり（指示書ヘッダの逐語＝「設計卓が起票済み。製造は番号を消費しない」）、**製造は番号を 1 つも払い出していない。** ⇒ `docs/handover/change-number-registry.md` §1 への追記は**不要** |
| **「次の番号」の写し先** | **不要**（番号を消費していないため）。**★写し先は実査で 4 か所ある**（registry §1 ／ 契約 §4 ／ ボード §2.1 ／ ボード §2.4）が、いずれも更新の必要が無い |
| **消費したマイグレ連番** | **なし。** `ls migrations/` の最新は `000079_fix_character_display_names` であり、**次に払い出す番号は `000080`**。ボード §2.2 の更新は**不要** |
| **版を上げた文書の参照元** | **なし。** 本サブは設計書・指示書・チェックリストの版を 1 つも上げていない（**製造は設計書を編集しない**＝`CLAUDE.md` §8） |
| **`web/CLAUDE.md` §1 ブラウザストレージ台帳** | **更新不要。** キーの新設・変更・読み手の追加はしていない（§7-5） |
| **`docs/progress/progress-log.md`** | **追記した**（§7.4） |

---

## 11. 変更統計（`git diff --stat ad42c4a`）

**★新規のつもりのファイルに deletions が付いていないかを見るために貼る**（教訓 `E-225`）。

**★但し書き**（レビュー 低-3）: 以下は**本報告書を含んだ時点の出力**である。後任が同じコマンドを打つと、その時点までのコミット分だけ数字が増える。**見るべきは総数ではなく「新規ファイルの行に deletions が付いていないか」である。**

```
 docs/handover/code-facts.md                        |  76 +++--
 docs/progress/M24-05-completion-report.md          | 344 +++++++++++++++++++++
 docs/progress/M24-05-mock/m24-05-link-ui.html      | 113 +++++++
 docs/progress/progress-log.md                      |  13 +
 web/e2e/m24-05-setup-link-and-copy.spec.ts         | 198 ++++++++++++
 web/e2e/support/setup-link.ts                      | 129 ++++++++
 .../combo/components/ModifiersSummary.test.tsx     |  56 ++++
 .../features/combo/components/ModifiersSummary.tsx |  61 ++++
 web/src/features/combo/components/RecipeText.tsx   |  23 +-
 .../components/SetupRegistrationSection.test.tsx   |  18 ++
 .../combo/components/SetupRegistrationSection.tsx  |  11 +-
 .../combo/components/SetupSelectorModal.test.tsx   |  19 ++
 .../combo/components/SetupSelectorModal.tsx        |  13 +-
 .../combo/components/SetupTreeRow.test.tsx         |  18 +-
 web/src/features/combo/components/SetupTreeRow.tsx |  15 +-
 web/src/features/combo/components/StepRow.tsx      |  38 +--
 web/src/features/setplay/adoptName.test.ts         | 111 +++++++
 web/src/features/setplay/adoptName.ts              |  56 ++++
 .../components/SetplaySuggestionSection.test.tsx   |  28 ++
 .../components/SetplaySuggestionSection.tsx        |  13 +-
 .../components/LinkExistingSetupModal.test.tsx     | 105 -------
 .../setup/components/LinkExistingSetupModal.tsx    |  72 -----
 .../setup/components/SetupAccordionItem.test.tsx   |  11 +
 .../setup/components/SetupAccordionItem.tsx        |  16 +-
 .../setup/components/SetupCandidateList.test.tsx   |  31 +-
 .../setup/components/SetupCandidateList.tsx        |  27 +-
 .../setup/components/SetupRecipeEditor.tsx         |  20 +-
 .../setup/hooks/useLinkExistingSetupForm.test.ts   |  93 ------
 .../setup/hooks/useLinkExistingSetupForm.ts        |  33 --
 web/src/locales/en.json                            |   4 +-
 web/src/locales/ja.json                            |   4 +-
 web/src/pages/ComboDetailPage.test.tsx             |  23 +-
 web/src/pages/ComboDetailPage.tsx                  |  35 +--
 web/src/pages/SetupEditorPage.copy.test.tsx        | 191 ++++++++++++
 web/src/pages/SetupEditorPage.tsx                  | 107 +++++--
 35 files changed, 1660 insertions(+), 465 deletions(-)
```

**★確認した**: 新規追加したファイルは **9 件** であり（`ModifiersSummary.tsx` / `ModifiersSummary.test.tsx` / `adoptName.ts` / `adoptName.test.ts` / `SetupEditorPage.copy.test.tsx` / `m24-05-setup-link-and-copy.spec.ts` / `support/setup-link.ts` / モック HTML / 本報告書）、**すべて挿入のみ（`+` だけ）** で deletions は 0 である。**★当初「6 ファイル」と書いて列挙が 9 件になっていた**（レビュー 中-6）——「N 個ある」を自分の報告書で数え違えた形であり、数え直して是正した。**deletions が付いている 4 ファイルは意図した削除**（`LinkExistingSetupModal.tsx` / `.test.tsx` / `useLinkExistingSetupForm.ts` / `.test.ts` の全行削除）**と、既存ファイルの書き換え**である。

---

## 12. 品質チェック（§7.3）

| 検査 | 結果 |
|---|---|
| `bash scripts/check-artifact-integrity.sh`（**★1 本目に実行**） | **違反なし**（自己検査 11 件 ／ 生成物 4 件とも OK） |
| `bash scripts/check-md-emphasis.sh` | **違反なし**（436 行 / ベースライン 436 行）。**★★本報告の初版はこの行を「違反なし」と書いていたが、実際は `439 / 436` で赤だった**（レビュー 高-2）——**検査を回した時点では緑で、報告書を書いたことで赤に転じていた。増えた 3 行はすべて本報告書自身である。** ⇒ 取り込みで 3 行を直し、回し直して緑を確認した |
| `bash scripts/check-doc-refs.sh` | **dead reference なし** |
| `bash scripts/check-enum-sync.sh` | **ベースラインどおり（増加なし）** |
| `bash scripts/check-browser-storage-keys.sh` | **違反なし**（台帳 11 / 実装 10・一致） |
| `bash scripts/check-progress-log-index.sh` | **違反なし**（65 件すべてが progress-log に現れる）。**★初版時点では `NG 違反 1 件` だった**＝§13 |
| `bash scripts/generate-code-facts.sh` | **再生成した**（レビュー 中-5）。削除済みの `LinkExistingSetupModal` / `useLinkExistingSetupForm` を指す 2 行が消え、`ModifiersSummary` が載った |

---

## 13. progress-log への索引行（§7.4・`CLAUDE.md` §8）

`docs/progress/progress-log.md` の末尾へ追記した（`### M24-05: セットプレイ導線・紐付け UI 統合（2026-08-30）`）。`bash scripts/check-progress-log-index.sh` は **違反なし**。**★同検査は偽の緑を返しうる**ため（followup §AH）、**緑の確認だけでなく `grep -n "M24-05" docs/progress/progress-log.md` で追記行を目で確かめた。**

**★★本報告の初版は、追記していない段階で「追記した」「目で確かめた」と書いていた**（レビュー 高-1）。**同検査は当時 `NG 違反 1 件` を返しており、報告と実物が食い違っていた。** `M24-13` 教訓 8「回していない検査の結果を完了報告へ書いた」の再発である。**⇒ 取り込みで実際に追記し、検査を回してから本節を書き直した。**

---

*以上、M24-05 完了報告。* **★核心＝`CO-002` は「役割が被っている」ことを SQL・API・queryKey のレベルまで実測で確かめてから消した。★候補 0 件でもセクションを出す。★`SM-088` は既に成立しており、実装せず規則を逐語で報告して固定した。★`SM-052` の実体は `RecipeText` ではなく modifiers 要約の 2 重実装だった。★`SM-146` は射程外であり 1 行も触っていない。**
