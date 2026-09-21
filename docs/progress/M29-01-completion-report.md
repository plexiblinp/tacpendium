# M29-01 完了報告: 語彙・ラベルの統一

| 項目 | 内容 |
|------|------|
| 作業ID | M29-01 |
| 指示書 | `docs/instructions/M29-01-vocabulary-and-labels.md` **v1.0.0** |
| チェックリスト | `docs/instructions/reviews/M29-01-review-checklist.md` **v1.0.0** |
| 着手基点 | `25c9285` |
| 作業日 | 2026-09-06 |
| CHANGE 消費 | **0 本**（★起票は設計卓＝`D-293`。§7 に反映が要る箇所を一覧化した） |
| マイグレ消費 | **0 本** |

---

## 0. 変更統計（着手基点 `25c9285`）

```
 docs/progress/M29-01-completion-report.md          | 288 +++++++++++++++++++++
 internal/service/comboio/csvcore/combo.go          |   2 +-
 internal/service/validation/combo.go               |   2 +-
 web/e2e/combo-csv-io.spec.ts                       |  19 +-
 ...-05-seed-cleanup-and-controller-resolve.spec.ts |   6 +-
 web/e2e/m15-03-recipe-input.spec.ts                |   6 +-
 web/e2e/m21-05-keyboard-input.spec.ts              |   6 +-
 web/src/constants/label-keys.test.ts               |  57 ++++
 web/src/features/combo-io/formatIssue.test.ts      |  13 +-
 web/src/features/combo/components/ComboEditor.tsx  |  15 +-
 .../components/ComboEditorBasicFields.test.tsx     |   3 +-
 .../features/combo/components/ComboListFilters.tsx |   2 +-
 .../features/combo/components/RecipeBuilder.tsx    |   9 +-
 web/src/features/combo/components/RecipeText.tsx   |  10 +-
 .../combo/components/SetupTreeRow.test.tsx         |  15 +-
 web/src/features/combo/labels.test.ts              |  12 +-
 web/src/features/combo/labels.ts                   |  12 +-
 web/src/features/combo/recipeDisplay.ts            |  33 ++-
 .../preset/components/PresetCopyDialog.tsx         |   2 +-
 .../features/preset/components/PresetListTable.tsx |   4 +-
 .../setup/components/SetupRecipeEditor.test.tsx    |  10 +-
 .../setup/components/SetupRecipeEditor.tsx         |   8 +-
 web/src/locales/en.json                            |  11 +-
 web/src/locales/ja.json                            |  19 +-
 web/src/locales/retired-words.test.ts              |  41 +++
 web/src/pages/ComboImportPage.tsx                  |   2 +-
 web/src/pages/PresetEditPage.tsx                   |   2 +-
 web/src/pages/TrashComboDetailPage.test.tsx        |   2 +-
 web/src/pages/TrashComboDetailPage.tsx             |   9 +-
 29 files changed, 551 insertions(+), 69 deletions(-)
```

**★上表は `9b96a12` 時点。取り込み（`10170c5`）後の実測は `31 files changed, 1012 insertions(+), 72 deletions(-)`**（完了報告と レビュー報告書の 2 本が加わった。レビュー 低-1）。**★`E-225` の観点の結論は変わらない。**

**★教訓 `E-225` の観点で 1 度読んだ**：新規ファイルは `docs/progress/M29-01-completion-report.md` の **1 本だけ**であり、`288 +++`（**deletions 0**）である。**⇒ 「新規のつもりのファイルに deletions が付いている」状態は無い。** 他の 28 本はいずれも既存ファイルへの追記・置換であり、新規作成は行っていない。

**★マイグレーション 0 本・新規依存 0 本・スキーマ変更 0。**

---

## 1. §2.1 語の割れの全数（**★本サブで最も価値のある成果物**）

### 1.0 数え方

**★i18n のキーから引いた。「画面に出ている文言」では数えていない**（指示書 §2.1-2 ／ `M27-03` 教訓 7）。

走査した源泉は次の 4 つ。

| # | 源泉 | 件数 |
|---|---|---|
| 1 | `web/src/locales/ja.json` / `en.json` | **各 858 キー**（`locales.test.ts` が双方向の集合一致を機械検査済み。ja 専用・en 専用はいずれも 0 件） |
| 2 | `web/src/**/*.ts(x)` の直書き日本語リテラル | 実装ファイルのみ（`*.test.*` は別扱い） |
| 3 | `internal/**/*.go` の利用者向け日本語文字列 | バリデーションメッセージ・CSV 契約 |
| 4 | `migrations/*.sql` のコメント | 参考（画面には出ない） |

**★ja / en の両方を見た**（指示書 §2.1-3）。**片方だけ割れている群が実在した**——群 4 の `opponent_size` は **ja だけが 3 通りに割れており、en は `Opponent size` で揃っている**。逆に群 4 の `opponent_stance` は **en だけに `Opponent state` という第 2 形が在った**。

### 1.1 群 1 — 「空レシピ」のラベル

**★実査すると 5 種あり、意味は 3 つに分かれていた。**

| # | 出どころ（file:line） | ja | en | 発火条件 | 意味 |
|---|---|---|---|---|---|
| **1-a** | `web/src/features/combo/recipeDisplay.ts:25` `RECIPE_EMPTY_LABEL`（**i18n キー無し・直書き定数**） | `（レシピなし）`（全角括弧） | **無し**（英語表示でも和文が出る） | `steps.length === 0` | 表示すべきレシピが無い |
| **1-b** | `trash.detail.recipeUnavailable`（`ja.json:1084` / `en.json:1084`） | `レシピを表示できませんでした` | `The recipe could not be displayed` | **`!defaultRecipe`＝1-a と同じ真偽値** | 同上。**★ただし文面は「失敗」を主張している** |
| 1-c | `web/src/features/combo-io/export-model.ts:48` `EMPTY = "-"` | `-` | `-` | 同上 | **出力表での欠測**（レシピ専用ではなく 9 欄が共有） |
| 1-d | `RecipeBuilder.tsx:316` ／ `SetupRecipeEditor.tsx:351`（直書き 2 件） | `まだステップがありません。技を選んで「追加」してください。` ／ `ステップがありません` | 無し | 編集中 `steps.length === 0` | **入力がまだ無い** |
| 1-e | `comboImport.val.VAL-C09`（`ja.json:711`） | `レシピが空です({{row}}行目)` | `Recipe is empty (row {{row}})` | CSV 取込の検証 | **入力が不正** |

**★どこに出ているか（1-a の到達範囲＝14 面）**

| 経路 | 面 |
|---|---|
| 直接 import（3） | `RecipeText.tsx:35,89` ／ `SetupInputRow.tsx:11,77` ／ `RecipeBuilder.tsx:25,165` |
| `RecipeText` 経由（11） | `SetupRegistrationSection.tsx:97` ／ `AddComboToCompareModal.tsx:141` ／ `CompareTable.tsx:234` ／ `SetupTreeRow.tsx:45` ／ `ComboDetailRecipe.tsx:86` ／ `SetupSelectorModal.tsx:81` ／ `ComboTableRow.tsx:130` ／ `SetupAccordionItem.tsx:122` ／ `SetupCandidateList.tsx:69`（＋一覧・マイコンボが `ComboTableRow` を共有） |

**★1-c は 3 か所でベタ書きに複製されている**（定数を経由していない）: `clipboard.ts:67` ／ `clipboard.ts:100` ／ `ComboExportDocument.tsx:279` の `?? "-"`。

**★割れの所在（2 か所）**

1. **1-a ↔ 1-b が同じ真偽値から出ている。** `TrashComboDetailPage.tsx:181` の `comboQuery.data.defaultRecipe ? … : …` が分岐であり、`RecipeText` の `steps.length === 0` と同じ状態を指す。**にもかかわらず 1-b だけが「表示できませんでした」と、起きていない失敗を主張している。** 同ファイルのコメント（`:178-180`）は「解決に失敗した場合は空文字で来る（サーバ側の縮退）」を意図として書いているが、**ステップが 0 件のコンボでも同じ文が出る。**
2. **1-d がペア内で割れている**（案内文の有無）。

**★1-c / 1-e は「実は別のものを指していた」**（指示書 §2.2-4）。根拠は推測ではなく、**`recipeDisplay.ts:17-24` に `M24-07` の先行実査が逐語で残っている**——「★エディタの空状態（「まだステップがありません」「ステップがありません」）は**別の意味**である（入力がまだ無い）。1 本へ畳んでいない——followup が『4 種を 1 本へ』と書いていたが、実測すると意味が 2 群に分かれていた。」

### 1.2 群 2 — 「コピー」の言い回し

**「既存の 1 件を複製する」動作のラベル＝3 種**（これが逐語の「3 種」に当たる）

| # | キー / 出どころ | ja | en | 対象 | 描画元 |
|---|---|---|---|---|---|
| 2-a | `common.copy`（`ja.json:19`） | `コピー` | `Copy` | コンボ | `ComboTableRow.tsx:199-204` ／ `ComboDetailPage.tsx:145-150` |
| 2-b | `setup.editor.copy`（`ja.json:1108`） | `コピー`（**2-a と同値の別キー**） | `Copy` | セットプレイ | `SetupEditorPage.tsx:455-460` |
| **2-c** | `PresetListTable.tsx:119`（**i18n キー無し・直書き**） | **`コピーして作成`** | 無し | プリセット | 同左（`:88` `:137` にも同語の説明文） |

**見出し 2 種（書式は揃っているが語が違う）**

| # | キー | ja | en | 描画元 |
|---|---|---|---|---|
| 2-d | `comboEditor.titleCopy`（`:312`） | `コンボ新規登録（コピー元: #{{id}}）` | `New Combo (**copy** from #{{id}})` | `ComboEditorPage.tsx:72` |
| 2-e | `setup.editor.createFromCopyTitle`（`:1107`） | `セットプレイ登録（コピー元: #{{id}}）` | `New setup (**copied** from #{{id}})` | `SetupEditorPage.tsx:435` |

**既定名・説明文（直書き・i18n キー無し）**

- `PresetCopyDialog.tsx:22` — `` `${base.name} のコピー` ``
- **`PresetCopyDialog.tsx:60-61` — 1 文の中で「コピー」と「複製」を両方使っている**（`…をコピーして、自分用のプリセットを作ります。エイリアスはすべて複製され、…`）

**★別物と判断した（統一対象外・指示書 §2.2-4）**

| キー | ja | 実際の動作 |
|---|---|---|
| `conflict.saveAsNew`（`:287`） | `この内容で新しく登録する` | **版不一致時の別名保存。** 既存の複製ではなく、編集中の内容を新しい行として書く（`ConflictDialog.tsx:184-192`） |
| `trash.preSaveDuplicate.createNew`（`:1016`） | `新しく作る` | **ゴミ箱の重複を復元せず新規で進む分岐**（`PreSaveDuplicateDialog.tsx:174-181`） |
| `export.dialog.formatClipboard`（`:533`） | `クリップボード` | **出力先の 1 つ**（`ExportDialog.tsx:106`） |
| `IntakeHelperPage.tsx:267`（直書き） | `プロンプトをコピー` | **クリップボードへの書き出し** |

**★en 側だけの割れ**: `copy from`（2-d）vs `copied from`（2-e）／ `New Combo` vs `New setup`（大小文字も不一致）。**★`conflict.viewTheirs` の en は `See their copy`** で、名詞の copy が動作の copy と衝突している。

### 1.3 群 3 — SA ゲージの単位「本」の有無

**★現物は `web/src/features/combo/labels.ts` の注記表に集約されている。**

```
labels.ts:242  GAUGE_AT_START_LABEL_JA.sa   = "コンボ開始時のSAゲージ残量"
labels.ts:250  GAUGE_CONSUMED_LABEL_JA.sa   = "SAゲージ消費"
labels.ts:280  GAUGE_NOTE_JA.start    = { drive: "0〜6.0本", sa: "0〜3"   }
labels.ts:283  GAUGE_NOTE_JA.consumed = { drive: "",        sa: "0〜6本" }
labels.ts:292  gaugeFieldLabelJa() → note==="" ? stem : `${stem}(${note})`
```

組み上がる 4 通り（**2 対 2 で割れている**）:

| 欄 | ラベル | 「本」 |
|---|---|---|
| ドライブ始動 | `コンボ開始時のドライブゲージ残量(0〜6.0本)` | **あり** |
| SA 始動 | `コンボ開始時のSAゲージ残量(0〜3)` | **なし** |
| SA 消費 | `SAゲージ消費(0〜6本)` | **あり** |
| ドライブ消費 | `ドライブゲージ消費`（注記そのものが無い） | — |

**★同じ SA ゲージが `0〜3`（始動側）と `0〜6本`（消費側）で割れている。** 経緯も逐語で残っている——**`SM-007`（2026-08-27 開発者裁定）が名指ししたのは SA 消費の 1 件だけ**で、始動側 2 通りは据え置かれた（`labels.ts:281-283`）。ドライブ消費の注記が空なのは `D-582`（上限 20 に根拠が薄く書けない）。

**★数値そのものには単位を一切付けていない。** `utils.ts:167-176` の `formatDriveGauge` / `formatSAGauge` は素の数値を返し、`utils.test.ts:236-244` がそれを契約として固定している。**対照＝`formatKnockdownAdvantage`（`utils.ts:231-237`）は `F` を付けている。⇒ 「本」が出るのは欄ラベルの括弧注記だけである。**

**★表記の割れ（半角スペースの有無）**

| 形 | 出どころ |
|---|---|
| **`SAゲージ`（詰め・8 か所）** | `ja.json:232`（`comboDetail.metadata.saGauge`）／ `:235`（`.saGaugeConsumed`）／ `:369`（`compare.row.saAvailableAtStart`）／ `:370`（`compare.row.saGaugeConsumed`）／ `labels.ts:242` ／ `labels.ts:250` ／ `ComboEditor.tsx:1435` ／ `ComboEditor.tsx:1437` |
| **`SA ゲージ`（空き・3 か所）** | `ja.json:710`（`comboImport.val.VAL-C05`）／ `ja.json:730`（`comboImport.col.sa_available_at_start`）／ **`internal/service/validation/combo.go:304`** |

**★語幹の第 3 形・第 4 形**

| 形 | 出どころ | 備考 |
|---|---|---|
| `消費 SA` ／ `消費ドライブ` | `ja.json:332-333`（`comboEditor.duplicateDiff.*`） | **語順が反転し「ゲージ」が脱落している。** en も `SA gauge **used**` で、他の `consumed` と割れている |
| `SAゲージ` ／ `ドライブゲージ`（短縮） | `ComboEditor.tsx:1432-1438` `FIELD_LABELS`（直書き・バリデーションエラーの欄名） | **始動側が短縮形。** 正典は `コンボ開始時の…残量` |

**★ドライブ側の ja は全箇所が `ドライブゲージ`（詰め）で、`ドライブ ゲージ` は存在しない。**

**★「本」が意味的に正しいかの実査**

| 列 | DB 型 | 定義 | 範囲 |
|---|---|---|---|
| `sa_available_at_start` | **INTEGER** | `migrations/000001:64` ／ `000016:23` ／ `000019:25` | 0〜3（`VAL-C05`・ERROR） |
| `sa_gauge_consumed` | **INTEGER** | `migrations/000020:14` | UI クランプ 0〜6 のみ（BE 検証なし） |
| `drive_available_at_start` | **REAL** | `migrations/000019:24`（旧 INTEGER） | 0〜6（`VAL-C04`）。**`step=0.5` 撤廃で `1.3` も入る**（`D-582`） |
| `drive_gauge_consumed` | **REAL** | `migrations/000020:15` | UI クランプ 0〜20 のみ |

**⇒ SA は整数の本数であり「本」は正しい。ドライブは小数を取りうるが、`ja.json:554`（`help.driveDamage`）と `internal/service/validation/combo.go:309` がいずれも「1 本未満の増減は小数で表す」と書いており、単位そのものは「本」である。**

### 1.4 群 4 — 相手状態の語彙

**★2 つの別フィールドである。混ぜない。**

**`opponent_stance`（4 値）— ja 2 形 / en 2 形**

| キー / 出どころ | ja | en |
|---|---|---|
| `comboList.filter.opponentStance`（`:154`） | **相手スタンス** | Opponent stance |
| `comboDetail.situation.opponentStance`（`:220`） | **相手スタンス** | Opponent stance |
| `comboList.column.opponentStance`（`:181`） | 相手の状態 | **Opponent state** |
| `comboImport.col.opponent_stance`（`:722`） | 相手の状態 | opponent stance |
| `comboEditor.duplicateMatchedOn`（`:323`・埋込） | 相手の状態 | Opponent stance |
| `ComboEditorBasicFields.tsx:399,402`（直書き） | 相手の状態 | — |
| `ComboEditor.tsx:1450` `FIELD_LABELS`（直書き） | 相手の状態 | — |

**`opponent_size`（4 値）— ja 3 形 / en 1 形**

| キー / 出どころ | ja | en |
|---|---|---|
| `comboDetail.situation.opponentSize`（`:222`） | **相手サイズ** | Opponent size |
| `comboImport.col.opponent_size`（`:720`） | **相手の体格** | opponent size |
| `comboEditor.duplicateMatchedOn`（`:323`・埋込） | 相手の大きさ | Opponent size |
| `ComboEditorBasicFields.tsx:436,439,453`（直書き） | 相手の大きさ | — |
| `ComboEditor.tsx:1452` `FIELD_LABELS`（直書き） | 相手の大きさ | — |
| `setplay.limitations.frameOnly`（`:795`・散文） | 相手キャラの体格 | opponent body size |

**★値の側（選択肢ラベル）は割れていない**: `situation.opponentStance.*`（`:868-871`）／ `situation.opponentSize.*`（`:874-877`）はいずれも 1 本で、`label-keys.test.ts` の `KEY_MAPS` が値域との 1 対 1 を機械検査している。**割れているのは「欄の呼び名」だけである。**

**★as-built（巻き戻さない・指示書 §2.3-4）**

| 出所 | 内容 |
|---|---|
| `CHANGE-151`（`M27-01`・2026-09-02） | `opponent_size` を 3 → **4 値**（`standard` / `large` / `large1` / `large2`）。`medium` → `standard` は migration `000081` の DML。**「例示キャラ入りのラベルは全面に出す。⇒ エディタだけ長くする案は採らない（同じ値が画面によって違う名前で出るため）」** |
| `CHANGE-155`（`M27-03`・2026-09-05・コミット `b1e89f9`） | 一覧の「始動状況」1 列を **ヒット種別 / 始動位置 / 相手の状態** の 3 列へ。**参照 0 になった `comboList.column.starterStatus` を ja/en から削除**（本サブの先例）。**★同通知に「開発者の依頼は『相手スタンス』だったが、実装された見出しは『相手の状態』である」旨の記録が在る** |
| `DES-005` §5.7 / §5.11 | 欄の呼び名は **「相手の状態」「相手の大きさ」** |

**⇒ 設計正典・as-built・エディタ直書き・多数派がすべて「相手の状態」「相手の大きさ」で一致している。**

**★選定の材料として記録**: `状態` は現在 **4 つの無関係な意味**を担っている——`相手の状態` ／ `登録状態`（`comboList.filter.draft` `:139`・`comboList.column.draftState` `:185`）／ `キャラ固有状態`（`comboDetail.customStates.heading` `:225`）／ `選択中のセルの状態`（`setupResult.stateGroupLabel` `:833`）。**「相手の」で限定されている限り曖昧ではない。**

### 1.5 §2.1-5 参照 0 のキー

**★実査の結論＝4 群に真の参照 0 キーは 1 件も無い。**

**★静的 grep では 0 件に見えるが、消してはならないキーが在る。** 本サブの参照走査はこの 4 経路を除外して判定した。

| 経路 | 対象 | 解決元 |
|---|---|---|
| テンプレートリテラル | `comboImport.col.*`（15 件） | `formatIssue.ts:41` `` t(`comboImport.col.${parsed.column}`) `` |
| 同上 | `comboImport.val.*`（15 件） | `formatIssue.ts:44` |
| 同上 | `conflict.saveAsNewConfirm.*`（4 件） | `ConflictDialog.tsx:219-235` `` t(`conflict.${pending}Confirm.title`) `` |
| ja/en 対称の意図的な未参照 | `help.opponentSize` の **en** | エディタは i18n を通らず `jaLabel` で ja だけを引く。**`ComboEditorBasicFields.tsx:445-450` に「現時点の参照は 0 だが ja / en の対称を崩さないため置く」と逐語** |

**⇒ 本サブで削除するのは、統一の結果として参照 0 になった `trash.detail.recipeUnavailable` の 1 件のみ**（§3 群 1）。

### 1.6 §2.1-4 **合計は 29 ではなかった**

**★実査で挙がったのは 4 群あわせて 24 か所（i18n キー 15 ＋ 直書き 9）である。**

| 群 | i18n キー | 直書き | 小計 |
|---|---:|---:|---:|
| 1 空レシピ | 2（`trash.detail.recipeUnavailable` / `comboImport.val.VAL-C09`） | 4（`RECIPE_EMPTY_LABEL` / `EMPTY` / `RecipeBuilder` / `SetupRecipeEditor`） | **6** |
| 2 コピー | 4（`common.copy` / `setup.editor.copy` / `comboEditor.titleCopy` / `setup.editor.createFromCopyTitle`） | 2（`PresetListTable` / `PresetCopyDialog`） | **6** |
| 3 SA ゲージ | 6（`comboDetail.metadata.saGauge` / `.saGaugeConsumed` / `compare.row.saAvailableAtStart` / `.saGaugeConsumed` / `comboImport.col.sa_available_at_start` / `comboImport.val.VAL-C05` ＋ `duplicateDiff.saGaugeConsumed`） | 2（`labels.ts` の注記表 / `ComboEditor.tsx` の `FIELD_LABELS`）＋ Go 1（`validation/combo.go:304`） | **9** |
| 4 相手状態 | 5（`comboList.filter.opponentStance` / `comboList.column.opponentStance` / `comboDetail.situation.opponentStance` / `.opponentSize` / `comboImport.col.opponent_size`） | 2（`ComboEditorBasicFields.tsx` / `ComboEditor.tsx`） | **7** |
| | | | **合計 24**（重複除き） |

**★29 に合わせにいっていない**（チェックリスト §0.2 / §7-7）。理由は 2 つある。

1. **`29` は `M29` マイルストーン全体の raw ledger 件数である。** `phase4-overview` §7.1 の行は「用語・ラベル・入出力＝29 → `M29`」であり、**「入出力」がその行に含まれている**。**⇒ 入出力〔CSV の取込・書出・プレビューと確定の重大度の非対称・行数上限の黙った切り捨て・バックアップ／復元・下書きの往復〕＝`M29-02` の射程を含む。** 本サブは語彙のみを負うため、原理的に 29 にはならない。
2. **`M29-overview` §2.1 のとおり、ledger の `触る面` 列からこの 29 を再現する組み合わせが読み取れない**（計測点 `M-127`）。**⇒ 内訳を突き合わせる対象そのものが存在しない。**

**⇒ `phase4-overview` §7.1 への追随注記は設計卓の手番**（§7 に記載）。

---

## 2. §2.2 寄せ先 — **開発者が選んだ記録**

**★製造は選んでいない**（`D-742` 逐語＝「基本は私が選びたい」／ チェックリスト §0.4-2）。1 群につき 2〜3 案と「なぜその語か」を添えて提示し、2026-09-06 の本セッションで開発者が選択した。

#### ★選定の追補（レビュー 高-4 への対応）

| # | 項目 | 開発者が選んだ記録 |
|---|---|---|
| 1 | **表記 `SA ゲージ` → `SAゲージ`（半角スペースの有無）** | **★提示済みである。** 群 4 の設問に「**群 3 補足**」として同梱し、設問文で「表記のゆれ『SAゲージ』（詰め・6 か所）vs『SA ゲージ』（空き・2 か所＋Go 側）、および『消費 SA』という第 3 形」を明示、選択肢 **4-A**（採用）に「詰めへ統一し『消費 SA』も『SAゲージ消費』へ」、対案 **4-A'** に「空きあり `SA ゲージ` へ統一」を置いた。**⇒ 決定の不足ではなく、本報告への記録の不足であった**（レビューは報告だけを読むため未記録に見えた）。本行で是正する |
| 2 | **群 1 の寄せ先の語（`（レシピなし）`）** | **承認済みの実装計画に含まれていた** — 計画の 1-A / 1-B はいずれも「`trash.detail.recipeUnavailable` を `（レシピなし）` 相当へ寄せる」と書いており、開発者はその計画を承認したうえで 1-B を選んだ。**⇒ 語は多数派（到達 14 面）に従っており、製造が独自に作った語ではない** |
| 3 | **群 1-d の文面（鉤括弧を落とした）** | **★これは製造が書いた新しい文面である。** 承認済み計画は「`SetupRecipeEditor` を `RecipeBuilder` 側の文面へ揃える」だったが、実装時に **2 面でボタン名が違う**こと（`RecipeBuilder` は「追加」・`SetupRecipeEditor` は「ステップ追加」）が判明し、ボタン名を引用すると片方の画面で嘘になるため鉤括弧を落とした。**開発者へ提示して回答を得た（2026-09-06）＝「いったんこのままでいい。製造終了時に実画面を見て決める。」** ⇒ **現状維持。★製造終了時に実画面で決める旨を横断課題へ残した**（§8） |

| 群 | 提示した案 | **開発者の選択** | 選ばれた理由（開発者の判断） |
|---|---|---|---|
| **1 空レシピ** | 1-A 語だけ揃える ／ 1-B i18n キー化まで ／ 1-C 5 種すべて 1 語へ | **1-B** | 当初は「1-A で手戻りが出るなら 1-B」と条件付きで保留。**製造が「1-A は『語を 2 か所に書く』か『英語が退行する』のどちらかを必ず招き、1-B は実質 +2 行」という実測を返したうえで 1-B を選択。** 「エディタ側も i18n 化」する第 3 案は採らず、`M24-07` の意図的設計を維持 |
| **2 コピー** | 2-A「コピー」 ／ 2-B「コピーして作成」 ／ 2-C「複製」 | **2-A「コピー」** | 3 種のうち 2 種が既に「コピー」であり、`M20-04` の E2E が既定名「〜 のコピー」を固定済み＝先行決定側 |
| **3 SA ゲージ** | 3-A「本」を付ける側 ／ 3-B 全部落とす ／ 3-C ドライブ消費にも注記 | **3-A「本」を付ける側** | `SM-007`（2026-08-27 の裁定）で選ばれた側に揃える。SA は `INTEGER` の本数で意味的にも正しい |
| **4 相手状態** | 4-A 設計正典へ ／ 4-B カタカナ側へ ／ 4-A' 表記は空きあり | **4-A 設計正典へ** | `DES-005` §5.7・`M27-01`/`M27-03` の as-built・エディタ直書き・多数派がすべて一致し、**巻き戻しにならない唯一の案**。あわせて表記は `SAゲージ`（詰め・多数派）へ |

### 2.1 ★「実は別のものを指していた」と結論した群（指示書 §2.2-4 / §7-2）

**★無理に統一していない。**

| 対象 | 結論 | 根拠 |
|---|---|---|
| 群 1 の 1-c（出力欄の `-`） | **統一しない** | レシピ専用ではなく、出力表の 9 欄が共有する欠測記号である |
| 群 1 の 1-e（`VAL-C09`） | **統一しない** | 「無い」ではなく「不正」を言う検証メッセージである |
| 群 1 の 1-d（エディタの空状態） | **1-a とは統一しない**（ペア内だけ揃える） | `recipeDisplay.ts:22-24` に `M24-07` の実査結果が逐語で残っている |
| 群 2 の `conflict.saveAsNew` / `trash.preSaveDuplicate.createNew` / `export.dialog.formatClipboard` | **統一しない** | それぞれ別名保存・重複回避の分岐・出力先であり、「既存の 1 件を複製する」ではない |
| **群 4 の `setplay.limitations.frameOnly`（`ja.json:795`）の `相手キャラの体格`** | **統一しない**（**開発者判断・2026-09-06**） | **★欄の呼び名ではなく、提案の制約を説明する散文の中の語である**（「間合い・相手キャラの体格・ヒット時の状況は判定していません」）。**「相手キャラの」で限定されており、欄ラベルの `相手の大きさ` とは指すものが違う。** ★`retired-words.test.ts` の禁則語 `相手の体格` には部分一致しないため機械の網には掛からない。**⇒ 掛からないことを承知のうえで据え置いている**（レビュー 高-5） |

### 2.2 ★不採用にした案とその理由（チェックリスト §2-2 ／ レビュー 中-5）

| 群 | 不採用案 | 落とした理由 |
|---|---|---|
| 1 | **1-A**（語だけ揃える） | **「語を 2 か所に書く」（`E-76`）か「英語が退行する」のどちらかを必ず招く。** ゴミ箱詳細は en を持っており、定数を直接使うと英語表示が失われる |
| 1 | **1-C**（5 種すべて 1 語へ） | **`M24-07` の実測に反する**（`recipeDisplay.ts:22-24` に逐語）。**「値が無い」「取れなかった」「入力がまだ無い」「入力が不正」を言い分けられなくなる** |
| 2 | **2-B**（`コピーして作成` へ寄せる） | 一覧の行アクションは幅が狭く 6 文字は収まりにくい。既定名「〜 のコピー」との関係も整理が要る |
| 2 | **2-C**（`複製` へ寄せる） | `M20-04` の先行決定（既定名「〜 のコピー」）を覆す |
| 3 | **3-B**（「本」を全部落とす） | **`SM-007`（2026-08-27 の裁定）を覆す** |
| 3 | **3-C**（ドライブ消費にも注記） | **`D-582` が「上限 20 に根拠が薄いので書かない」と裁定済み** |
| 4 | **4-B**（カタカナ側へ） | **`M27-03` の as-built（一覧見出し「相手の状態」）を巻き戻す。** 指示書 §2.3-4 / §4-5 が禁じている |
| 4 | **4-A'**（表記を空きあり `SA ゲージ` へ） | 詰め形が多数派（8 か所 vs 3 か所）。Go 側 1 か所を直すほうが影響が小さい |

---

<!-- 以降 §3〜§10 は実装の進行にあわせて埋める。
     ★§9（レビュー結果）は Phase C の後にしか書けない欄である（`D-510`）。
       レビュー報告書 `docs/progress/m29-01-review.md` は Phase B のサブエージェントが作るまで存在しないため、
       それまでリンクを張らない・件数を断定しない。 -->

## 3. 統一の実装

### 3.1 コミットの割り方（指示書 §2.5）

**★1 コミットに 2 群を混ぜていない**（赤が出たときにどの群かが分からなくなるため）。

| 順 | コミット | 内容 |
|---|---|---|
| 1 | `d48e83c` `docs(M29-01): 語の割れの全数を実査(4 群・24 か所)` | **コードは動かない**（§1） |
| — | `76778a7` `docs(M29-01): 実査表の閉じない強調を 1 件直す` | `check-md-emphasis.sh` の指摘への追随 |
| 2 | `bbbe2d9` 群 1（1-B） | 空レシピ |
| 3 | `baa6939` 群 2（2-A） | コピー |
| 4 | `425d40e` 群 3（3-A） | SA ゲージ |
| 5 | `1b0a43a` 群 4（4-A） | 相手の状態・相手の大きさ |
| 6 | `7d2172e` `refactor(M29-01/i18n): 参照 0 になったキーを削除し、戻らないようにする網を張る` | 参照 0 キーの削除 ＋ 検査の拡張 |
| — | `c19819f` `test(M29-01/e2e): CSV 取込の課題バッジを testid で掴む` | E2E の判定を testid へ（§5） |

### 3.2 群ごとの着地

| 群 | 着地 |
|---|---|
| **1** | **`comboCommon.recipeEmpty` へ寄せた**（1-a ↔ 1-b）。**`comboCommon.recipeStepsEmpty` へ寄せた**（1-d のペア内）。**1-c / 1-e は据え置き**（別の意味） |
| **2** | **「コピー」へ統一。** `PresetListTable` / `PresetEditPage` の「コピーして作成」→「コピー」。`PresetCopyDialog` の 1 文内併用「複製」→「コピー」。en の `titleCopy` を `New combo (copied from …)` へ |
| **3** | **SA 始動へ「本」を付けた**（`0〜3` → `0〜3本`）。表記を **`SAゲージ`（詰め）** へ統一（`comboImport` 系 2 キー ＋ Go の VAL-C05）。`消費 SA` / `消費ドライブ` を正典の語幹へ。en の `used` → `consumed` |
| **4** | **`相手の状態` / `相手の大きさ` へ統一**（ja 5 か所）。en の `Opponent state` → `Opponent stance` |

### 3.3 ★i18n 化で同時に消えた欠陥（群 1・1-B の効き）

`RECIPE_EMPTY_LABEL` は着手前 i18n キーを持たない直書きであり、**英語表示でも和文「（レシピなし）」が出ていた**（到達 14 面）。`RecipeText` に `t()` を入れたことで **i18n を通る 11 面が英語になる**。

**★エディタ側 2 面（`SetupInputRow` / `RecipeBuilder`）は i18n を通さない `M24-07` の設計を維持した**（1 画面で 2 系統が混ざるのを避ける意図）。あちらは `jaLabel` で ja.json から日本語の写しを引く。**⇒ 語を 2 か所に書いていない**（`E-76`）。

### 3.4 ★あわせて塞いだ穴（**いずれも本サブの変更が静かに落ちうる箇所**）

| # | 穴 | 塞ぎ方 |
|---|---|---|
| **1** | **`label-keys.test.ts` の「エディタ直書きと ja.json の一致」表に `HIT_TYPE` と `OPPONENT_SIZE` しか載っておらず、状況 4 軸のうち相手の状態だけが検査の外に在った**（`M28-02a` が `POSITION` で塞いだのと同型） | `OPPONENT_STANCE` を登録した |
| **2** | **`labels.ts` の `GAUGE_*_LABEL_JA` と `ja.json` は同じ語を持つのに、両者を突き合わせる検査が 1 つも無かった** | ゲージ 4 通りの一致 ／ 詳細と比較で同じ語であること ／ `ja.json` に `SA ゲージ`（空き）が無いこと（陽性・陰性対照つき） |
| **3** | **`ComboEditor.tsx` の `FIELD_LABELS` が始動側だけ短縮形**（`ドライブゲージ` / `SAゲージ`）で、**同じ欄がエラー表示のときだけ別の呼び名**になっていた | 正典（`GAUGE_AT_START_LABEL_JA` / `GAUGE_CONSUMED_LABEL_JA`）を参照する形へ |
| **4** | **退けた語が戻っても何も赤くならない** | `retired-words.test.ts` の `RETIRED` へ 5 語を登録（`useInstead` と `reason` 必須）。陰性対照へ採った側の語も足した |

### 3.4b ★据え置いた判断とその理由（レビュー 中-4 / 中-6 / 低-3 / 低-4）

| # | 項目 | 判断 |
|---|---|---|
| **中-4** | **`common.copy` と `setup.editor.copy` が同値の別キーで 2 本ある** | **2 本のまま残した。** 値は同じだが**別の画面・別のエンティティの動作**を指しており、片方だけ語が変わる可能性がある（例＝セットプレイ側だけ「コピー」以外にする判断）。1 本へ畳むと、そのとき畳み直しが要る。**★参照 0 ではないため削除対象でもない** |
| **中-6** | **束 D-2「参照 0 のキーを削除したことを検出する検査」の担保範囲** | **★`locales.test.ts` が担保するのは「片側だけ消えた／片側だけ増えた」状態であって、「両側に残った参照 0 のキー」ではない。** 参照 0 を検出する網は**現在も無い**。**⇒ 次に参照 0 が生まれても赤くならない。** 本サブでは新設していない（射程外）が、**担保の範囲を誤って記録すると次の担当が「網が在る」と読む**ため明記する |
| **低-3** | `RECIPE_STEPS_EMPTY_LABEL` の本番参照 | **高-2 の取り込みで解消した。** 現在はエディタ 2 面（`RecipeBuilder` / `SetupRecipeEditor`）が本番で参照している |
| **低-4** | **en の `comboImport.col.*` だけ小文字始まり**（`opponent size`）で他面は大文字始まり（`Opponent size`） | **据え置き。** VAL-ENUM の文中へ補間される語であり、文中では小文字が自然である。**★チェックリスト §8-2 のとおり英語側の語選びは軽微**。記録のみ残す |

### 3.5 ★`check-enum-sync.sh`（チェックリスト §3-3）

**結果＝`ベースラインどおり(増加なし)`**（`BASELINE_SCATTER=28`・実測 28）。

**★ただし「緑」を担保と読んでいない。** 同スクリプト `:68-73` が逐語で述べているとおり、抽出パターンは接尾辞 `Category|Status|Type|Code` にしか当たらず **`model.OpponentSize*` を 1 件も見ない**。**★実査したところ `model.OpponentStance*` も同じ理由で見えていない**（スクリプトのコメントは `opponent_size` だけを名指ししている）。**⇒ 相手状態の同期の担保は `label-keys.test.ts` の `KEY_MAPS` 側である。**

**★本サブは列挙値を 1 つも増やしていない**（触ったのは欄の呼び名だけで、値域＝`situation.opponentStance.*` / `situation.opponentSize.*` は不変）。

---

## 4. §2.4 テスト

### 4.1 実行結果

| 対象 | 結果 |
|---|---|
| `go build ./...` | **OK** |
| `go test ./...` | **OK**（失敗 0） |
| `cd web && pnpm exec tsc --noEmit` | **OK** |
| `cd web && pnpm test`（vitest） | **212 ファイル / 2454 件 green** |
| `make e2e`（**全数**） | **247 件 green**（§5） |

### 4.2 ★「画面に出ている文言」で判定していたテストの是正（指示書 §2.4-1）

**★★文言を戻していない。判定側を `data-testid` とキーへ移した**（チェックリスト §0.4-4）。

| ファイル | 着手前の判定 | 是正 |
|---|---|---|
| `e2e/m12-05-…` / `m15-03-recipe-input` / `m21-05-keyboard-input` | `getByText("まだステップがありません。技を選んで「追加」してください。")` | `getByTestId("recipe-steps-empty")` |
| `e2e/combo-csv-io.spec.ts:194` | `getByText(/相手の体格に未知の値があります/)` | `getByTestId("import-issue")` ＋「生の列名が出ていない」ことで写像を確かめる |
| `SetupRecipeEditor.test.tsx` | `getByText("ステップがありません")` | `getByTestId` ＋ 源泉の定数で文面を主張 |
| `SetupTreeRow.test.tsx` | 手書きリテラル `"（レシピなし）"` | 源泉の定数 `RECIPE_EMPTY_LABEL` で主張 |
| `formatIssue.test.ts` | `t` スタブの文面を **spec へ直書き**（`"相手の体格"`） | 実 `ja.json` から引く |
| `TrashComboDetailPage.test.tsx` | `ja.trash.detail.recipeUnavailable`（キー参照・良好） | 新キー `ja.comboCommon.recipeEmpty` へ |
| `labels.test.ts` / `ComboEditorBasicFields.test.tsx` | `(0〜3)` を固定（`SM-007` 時点の意図的状態） | 3-A の裁定で失効 ⇒ `(0〜3本)` へ。**失効の理由を逐語で残した** |

**★`SetupTreeRow.test.tsx` / `SetupRecipeEditor.test.tsx` は実 `ja.json` を引いていなかった**（`t` がキーをそのまま返す状態）。**⇒ `import "@/lib/i18n"` を足した**（チェックリスト §4-4 ／ `M23-04` 教訓 2。**キーを返すモックでは文面の主張が空振りする**）。

### 4.3 ★破壊確認（チェックリスト §6・**2 件とも実走して赤を見た**）

| # | 壊したもの | 結果 |
|---|---|---|
| **1** | `OPPONENT_STANCE_LABEL_KEYS` から `crouching` を外した | **赤**：`label-keys.test.ts` >  `'OPPONENT_STANCE': 値域のすべてにキーが在る`。**⇒ 束 C-2 の 1 対 1 検査が実際に効いている** |
| **2** | 削除した `recipeUnavailable` を **`en` だけ**復活させた | **赤**：`locales.test.ts` > `en のキーはすべて ja に存在する(デッドキー蓄積防止)`。**⇒ 「`en` だけ残る」は既存の網が検出する** |

**いずれも確認後に復旧し、`git diff` で無差分を確認した。**

**★束 D-2「参照 0 のキーを削除したことを検出する検査」は新設していない。** 既存の `locales.test.ts` が **ja/en 双方向の集合一致**を見ており、破壊確認 2 がそれを実証したためである。

---

## 5. §3-5 `make e2e` で赤くなった箇所

### 5.1 語彙統一で赤くなったもの（**★赤は証拠であって事故ではない**）

| 箇所 | なぜ赤くなったか | 直し方 |
|---|---|---|
| `e2e/combo-csv-io.spec.ts:194` | 列ラベルの語そのもの（`/相手の体格に未知の値があります/`）を主張していた | **testid で掴む形へ。文言は戻していない** |
| `e2e/m12-05` / `m15-03` / `m21-05` | 空状態の文面そのものを `getByText` で主張していた | **`data-testid="recipe-steps-empty"` へ** |

**⇒ 4 本とも「文言で判定していた」証拠である。**

### 5.2 ★語彙とは無関係に落ちた 1 件 —— **着手前から赤であることを実証した**

`make e2e` の 1 回目で `e2e/m24-12-editor-rebuild.spec.ts:31 (3) 保存直後の遷移では確認が出ず、かつ編集画面へ戻らない` が落ちた（246 passed / 1 failed）。

**★「flake」で済ませず根本原因を確かめた。**

| # | 確かめたこと | 結果 |
|---|---|---|
| 1 | 単独実行で再現するか | **再現する**（`make e2e-only P="m24-12 --retries=0"`。3 回とも同じ） |
| 2 | 失敗しているのはどの主張か | **`戻るを 2 回押しても起点(ホーム)へ戻れない`**（履歴・離脱ガードの話）。**★保存そのものは成功している**（URL は `/combos?character_id=1`）。リトライ側の `POST /api/combos の応答に id が無い` は、1 回目が作った行との重複による**二次的な失敗**である |
| 3 | 本サブの差分が機序に触れているか | **触れていない。** 差分は表示文字列・i18n キー・Go のメッセージ・コメント・テストのみで、`navigate` にも離脱ガードにも及んでいない |
| 4 | **着手基点で再現するか** | **★★再現した。** 変更した 27 ファイルを `25c9285` の内容へ全数差し戻し（`git diff --stat` で無差分を確認）したうえで同じ spec を走らせ、**同一の主張が同一の理由で赤になることを実測した。復旧後に元へ戻してある** |

**⇒ 本サブの失敗ではない。** なお **`make e2e` の全数実行では 247 件すべて green** であり（2 回目）、本件は単独実行・実行順に依存する既存の不安定さである。**★横断課題として §8 に残す。**

---

## 6. §3-4 削除した参照 0 のキー

| キー | ja | en | 参照 0 になった理由 |
|---|---|---|---|
| `trash.detail.recipeUnavailable` | **削除** | **削除** | 群 1 の統一で `comboCommon.recipeEmpty` へ寄せたため |

**★ja / en の両方から消した**（チェックリスト §0.4-3。**`en` だけ残すと日常的に見ないため気づかれない**）。**★削除を検出する網は `locales.test.ts` であり、破壊確認 2 で実証済み**（§4.3）。

**★4 群の他のキーは 1 件も参照 0 になっていない。** 静的 grep で 0 件に見えるキーの扱いは §1.5 のとおり（動的解決の 4 経路を除外して判定した）。

**★キー総数は 858 → 859。** 追加 2（`comboCommon.recipeEmpty` / `.recipeStepsEmpty`）・削除 1。

---

## 7. `docs/design/` に反映が要る箇所の一覧（**製造は直さない**）

**★CHANGE 起票は設計卓の手番**（`D-293`。自採番していない）。

| # | ファイル:行 | 内容 |
|---|---|---|
| **1** | `docs/instructions/phase4-overview.md` §7.1 | **★★「用語・ラベル・入出力＝29」の内訳が ledger から引けない**（`M-127`）。本サブの実査は **語彙のみで 24 か所**であり、29 は入出力（`M29-02` の射程）を含む数である。**⇒ 追随注記が要る** |
| **2** | `docs/design/05-screen-design.md:562` | 重複警告の例示が **`ポジション：画面中央`** のまま。実装は `始動位置`（`M28-02a` / `CHANGE-159` で改名済み）。**★本サブの変更とは独立に既に失効している** |
| **3** | `docs/design/06-validation.md:337,341` | **`相手サイズ`** の呼称（本サブで `相手の大きさ` へ統一した） |
| **4** | `docs/design/06-validation.md:18,472` ／ `requirements.md:162` ／ `testid-convention.md:86` | **`SA ゲージ`（半角スペース入り）** の表記（本サブで詰め形 `SAゲージ` へ統一した） |
| **5** | `docs/design/05-screen-design.md` §5.15 相当 | **プリセット管理のボタン名が「コピーして作成」→「コピー」に変わった**（2-A）。設計書に同語の記述があれば追随が要る |
| **6** | `docs/design/05-screen-design.md` §5.7 | **SA 始動欄の注記が `(0〜3)` → `(0〜3本)` に変わった**（3-A。`SM-007` の射程が SA 消費の 1 件から SA 2 欄へ広がった） |
| **7** | `docs/design/05-screen-design.md:558` | **重複警告の「判定に使わない 7 項目」の例示が `消費 SA ／ 消費ドライブ` のまま。** 本サブが `comboEditor.duplicateDiff.*` を `SAゲージ消費 ／ ドライブゲージ消費` へ改めたため**失効している**。**★`retired-words.test.ts` は `docs/` を走査しないため永久に検出されない**（レビュー 高-3） |
| **8** | `docs/design/03-data-model.md:370` | `ドライブ/SA ゲージ系4列` の表記（**半角スペース入り**）。§7-4 の 3 本に加えて本行も対象（レビュー 高-3） |
| **9** | `docs/design/testid-convention.md` の「付与済み一覧」 | **本サブが新設した testid 3 本の登録** — `combo-recipe-steps-empty` / `setup-recipe-steps-empty` / `import-issue`。同書は「新規付与時は必ずこの一覧を更新すること」と定めている（レビュー 高-3） |
| — | `05-screen-design.md:315` の `相手スタンス` | **★対象外。** 取消線付きの「失効前の記述」であり、履歴として正しい |

---

## 8. ■ 併せて更新が要るもの

| # | 項目 | 状態 |
|---|---|---|
| 1 | **消費した CHANGE 番号の登録** | **なし。** 本サブは CHANGE を 1 本も起票していない（起票は設計卓＝`D-293`）。⇒ `change-number-registry.md` §1 への登録は不要 |
| 2 | **「次の番号」の写し先 4 か所** | **なし**（上と同じ理由。番号を消費していない） |
| 3 | **消費したマイグレ連番** | **なし。** マイグレーション 0 本。`ls migrations/` の実査値とボード §2.2 はずれていない |
| 4 | **版を上げた文書の参照元** | **なし。** 設計書・指示書の版を 1 本も上げていない（`docs/design/` は編集していない＝§7 に一覧化した） |
| 5 | **`web/CLAUDE.md` §1 のブラウザストレージ台帳** | **なし。** 新規キーを使っていない（`check-browser-storage-keys.sh` 緑） |
| 6 | **★横断課題（`M29-02` へ送るもの）** | **`VAL-C09` の重大度の非対称**（CSV 取込は WARNING＝`csvcore/validate.go:172`「recipe is empty (0 steps)」／ 本体保存は ERROR＝`validation/combo.go:366`「レシピが空です」）。**★文言も和英で割れているが、重大度の非対称ごと `M29-02` の射程である** |
| 7 | **★横断課題（既存 followup。本サブでは触っていない）** | `csvcore/rules.go:79-81` の `DefaultOpponentSizes = {"small","standard","large"}` が本体 4 値と **2/4 しか一致しない**。**既に followup `csv-import-opponent-size-whitelist-stale` に在り、開発者が「対応不要」と裁定済み** |
| 8 | **★横断課題（新規に判明）** | **`e2e/m24-12-editor-rebuild.spec.ts:31` が単独実行で常に赤**（§5.2。**着手基点 `25c9285` で再現することを実測済み**）。全数実行では緑になる実行順依存 |
| 9 | **★横断課題（新規に判明）** | **`check-md-emphasis.sh` が着手前から NG**（現在 494 行 / ベースライン 436 行）。**★本サブのファイルの寄与は 0 行**であり、差 58 行は `retrospective-digest.md`(41) / `M26-02-completion-report.md`(40) / `M21-RESEARCH-01-report.md`(40) 等の既存ファイル由来 |
| **11** | **★横断課題（開発者判断・製造終了時に決める）** | **群 1-d の空ステップ文面**「まだステップがありません。技を選んで追加してください。」は**製造が書いた新しい文面**である（承認済み計画は「`RecipeBuilder` 側の文面へ揃える」だったが、2 面でボタン名が違うため鉤括弧を落とした）。**開発者の逐語＝「いったんこのままでいい。製造終了時に実画面を見て決める。」⇒ 実画面での確認が残っている** |
| **13** | **★横断課題（開発者の実画面確認で判明・2026-09-06）** | **レシピタブは着手前から和英混在である。** `RecipeBuilder:179` / `SetupRecipeEditor:180` が内包する **`VirtualController` は `M24-07`（`899c4e1`）が 70 本を i18n 化済み**であり、英語表示で `Quick input (buttons)` / `Common moves` 等が出る。一方で 2 部品が自分で描く文字列（legend「レシピ」・「追加」/「ステップ追加」・「全技から選ぶ」・「編集ボタンについて」・空レシピ・空ステップ）は**日本語直書き**である。**★本サブが書いたコメント「エディタ 2 面は i18n を通さない設計（`M24-07` の意図。1 画面で 2 系統が混ざるのを避ける）」は事実に反していたため撤回・是正した**（`recipeDisplay.ts` / `RecipeText.tsx`）。**★レビュー 高-2 もこの誤った前提に立っており、製造が検証せずに取り込んだ。結論（実装側を直す）は正しかったが、理由の説明が誤っていた。** ⇒ **根本解決は 2 部品の直書きも i18n 化することだが、それは語彙の統一ではなく i18n 化であり本サブの射程外** |
| **12** | **★横断課題（レビュー 中-6）** | **参照 0 のキーを検出する網は存在しない。** `locales.test.ts` が見るのは「ja/en の片側だけ消えた／増えた」であり、**両側に残った参照 0 のキーは赤くならない**。⇒ 次に参照 0 が生まれても検出されない |
| 10 | **★横断課題（新規に判明）** | **`check-enum-sync.sh` は `model.OpponentStance*` も見ていない。** スクリプト `:68-73` のコメントは `opponent_size` だけを名指ししているが、`OpponentStance*` も接尾辞 `Category\|Status\|Type\|Code` に当たらないため同じ穴に在る。**⇒ 既存 followup `check-enum-sync-misses-size-suffix` の射程を 1 軸広げる必要がある** |

---

## 9. レビュー結果

**レビュー報告書**: `docs/progress/m29-01-review.md`（Phase B・fresh subagent。**メイン会話の文脈を継承しない独立エージェント**で実施。`fork` は使っていない）

### 9.1 件数と優先度別内訳

| 優先度 | 件数 | 採否 |
|---|---:|---|
| **高** | **5** | **採用 5 / 不採用 0** |
| **中** | **6** | **採用 6 / 不採用 0** |
| **低** | **4** | **採用 3 / 記録のみ 1**（低-4＝en の大小文字。チェックリスト §8-2 で軽微） |
| **合計** | **15** | **★「高」指摘の不採用は 0 件** |

**★チェックリスト §7「重大な問題の判定基準」8 項目は 0 件**（レビュー担当の判定）。

### 9.2 各指摘の採否と理由

| # | 指摘 | 採否 | 対応 |
|---|---|---|---|
| **高-1** | `progress-log.md` 未追記（`check-progress-log-index.sh` が赤） | **採用** | Phase D で追記し、緑を確認した |
| **高-2** | **`RecipeBuilder` が 1 画面で 2 系統を混ぜた**（製造が入れた `t()` が原因。自分で書いたコメントとも食い違い） | **採用** | エディタ 2 面を `jaLabel` 由来の定数へ戻し、コメントを as-built へ（`10170c5`）。**★レビューが検出した最大の欠陥。動作は正しく、テストも型検査も緑のまま通る型である** |
| **高-3** | `docs/design/` 反映一覧に 3 件漏れ | **採用** | §7 へ 3 件追加（`05-screen-design.md:558` / `03-data-model.md:370` / `testid-convention.md`） |
| **高-4** | 開発者が選んだ記録の無い語の決定が 3 件 | **採用**（3 件とも） | §2 の「選定の追補」へ記録。**★うち 1 件（`SA ゲージ` の表記）は提示・選択済みであり、報告への記録が落ちていただけである。**残り 2 件のうち 1-d の文面は**開発者へ提示して回答を得た**（現状維持＋製造終了時に実画面で決める） |
| **高-5** | `相手キャラの体格` の着地が未記録 | **採用** | **開発者判断で「統一しない」**。理由を §2.1 の表へ記録 |
| **中-1** | `recipe-steps-empty` が同一画面に 2 つ出うる | **採用** | **★仮定ではなく実在の危険だった**（`SetupInputRow` が `SetupRecipeEditor` を描くため、コンボエディタで両方が同時に存在する）。面ごとに分離（`10170c5`） |
| **中-2** | Go / migration に `SA ゲージ` が残る ／ `retired-words` の理由欄が走査範囲を誤読させる | **採用** | 3 件を詰めへ。理由欄を是正（`10170c5`） |
| **中-3** | E2E が語を持っている | **採用** | `readFileSync` + `JSON.parse` で源泉から引く形へ（`10170c5`） |
| **中-4** | 同値の重複キーを 2 本残す理由が未記録 | **採用** | §3.4b へ記録（**キーは畳まない**判断） |
| **中-5** | 不採用案の理由が未記録 | **採用** | §2.2 の表を新設（8 案） |
| **中-6** | 束 D-2 の担保範囲の誤記 | **採用** | §3.4b で是正し、**参照 0 を検出する網は存在しない**ことを §8-12 の横断課題へ |
| **低-1** | 変更統計が取り込み前の値 | **採用** | §0 へ実測を追記 |
| **低-2** | `SM-007` を grep で辿る経路が消えた | **採用** | テスト名へ戻した（`10170c5`） |
| **低-3** | `RECIPE_STEPS_EMPTY_LABEL` の本番参照が 0 | **採用** | 高-2 の取り込みで解消 |
| **低-4** | en の大小文字が揃っていない | **記録のみ** | VAL-ENUM の文中へ補間される語であり文中では小文字が自然。チェックリスト §8-2 で軽微 |

### 9.3 再レビューの往復

**初回レビュー 1 回のみ。上限（2 回）に達していない。**

**★「高」指摘の不採用は 0 件**であるため、Phase C の安全弁（重大指摘の自動棄却の禁止）によるエスカレーションは発生していない。開発者への確認は 2 件行ったが、**いずれも不採用ではなく着地の選択**である（高-4-3 の文面 ／ 高-5 の着地）。

---

## 10. 完了条件の充足（指示書 §5）

| # | 条件 | 状態 |
|---|---|---|
| 1 | §2.1 の全数が出ており、合計が報告に書かれている（29 でなくてよい） | **充足**（§1。**実測 24。29 でない理由も §1.6 に書いた**） |
| 2 | 4 群すべてに着地がある | **充足**（群 1 ＝統一＋一部据え置き ／ 群 2・3・4 ＝統一。§2） |
| 3 | 参照 0 になったキーが ja / en の両方から消えている | **充足**（§6。破壊確認 2 で実証） |
| 4 | `go test ./...` / `pnpm test` / `make e2e` が緑 | **充足**（§4.1。`make e2e` 全数 247 件 green） |
| 5 | 常設検査が緑（`check-artifact-integrity.sh` を 1 本目・`check-enum-sync.sh` も） | **充足**（`artifact-integrity` 違反なし ／ `enum-sync` ベースラインどおり ／ `import-order` 違反なし ／ `browser-storage-keys` 違反なし ／ `doc-refs` 違反なし）。**★`check-md-emphasis.sh` のみ NG だが着手前から NG であり本サブの寄与は 0 行**（§8-9） |
| 6 | `docs/design/` に反映が要る箇所が一覧になっている | **充足**（§7。6 件） |
| 7 | `docs/progress/progress-log.md` へ追記されている | **充足**（Phase D。`check-progress-log-index.sh` 緑を確認） |
