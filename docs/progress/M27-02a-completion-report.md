# M27-02a 完了報告: 届かないものを届かせる（保存の理由・候補選択の操作）

| 項目 | 内容 |
|------|------|
| 対象指示書 | `docs/instructions/M27-02a-reachability-save-path-and-selectors.md` **v1.2.0** |
| チェックリスト | `docs/instructions/reviews/M27-02a-review-checklist.md` **v1.0.0** |
| 着手基点 | `0853c74` |
| 実施日 | 2026-09-02 |
| マイグレ消費 | **0 本**（スキーマに触れていない） |
| CHANGE 消費 | **0 本**（★製造は自採番しない。たたき台は §5） |

---

## 0. 変更したファイルと変更統計

```
$ git diff --stat 0853c74
 ...M27-02a-reachability-save-path-and-selectors.md |  43 ++++-
 .../reviews/M27-02a-review-checklist.md            | 185 +++++++++++++++++++++
 internal/api/combo/handler.go                      |  22 +--
 internal/api/combo/handler_test.go                 |  80 +++++++++
 internal/api/config/handler.go                     |   2 +-
 internal/api/move/handler.go                       |   7 +-
 internal/api/setup/handler.go                      |  16 +-
 internal/model/api_error.go                        |  31 ++++
 web/e2e/m27-02a-reachability.spec.ts               | 140 ++++++++++++++++
 web/src/components/SearchableSelect.tsx            |  42 +----
 web/src/features/combo/components/ComboEditor.tsx  |   4 +
 web/src/features/combo/editorTabs.test.ts          |  29 ++++
 web/src/features/combo/editorTabs.ts               |  21 ++-
 .../features/tag/components/TagSelector.test.tsx   |  69 ++++++++
 web/src/features/tag/components/TagSelector.tsx    |  23 ++-
 web/src/hooks/useListboxKeyNav.ts                  |  59 +++++++
 16 files changed, 697 insertions(+), 76 deletions(-)
```

**新規ファイルは 3 本**（レビューチェックリスト 185 ／ E2E spec 140 ／ `useListboxKeyNav.ts` 59）。**いずれも `+` のみで deletions は 0** であり、上書き事故は起きていない（`E-225`）。作る前に `ls` / Glob で同名の不在を確認済み。

`SearchableSelect.tsx` の `-34` はキーボード処理をフックへ移した分である（振る舞いの削除ではない。既存 19 テストがそのまま緑）。

**並列レーンの面には 1 行も触っていない** —— `migrations/` ／ `character_data/` ／ `internal/seedgen/` の差分は 0（上表のとおり）。`internal/` のうち触ったのは `internal/api` と `internal/model` のみ。

**着手時の確認（指示書 §4.4）**

| # | 確認事項 | 結果 |
|---|---|---|
| 1 | `M27-01` が入っているか | **入っている**。`HitType*` 8 値 ／ `OpponentSize*` 4 値（`internal/model/combo.go:26-56`）／ マイグレ `000081` |
| 2 | `M14-03f` 走行中 | `ls migrations/` の最大は `000081`。`000082` 以降は本ツリーに無い。**自採番していない** |
| 3 | `M28-01` 未投入 | モジュールパスは旧のまま（`github.com/plexiblinp/combomgr`） |

---

## 1. 6 件それぞれの「いまも再現するか」（指示書 §0.3）

| # | identity | 判定 | 根拠 |
|---|---|---|---|
| 1 | `editor-validation-errors-unreachable-from-ui` | **★前提が失効している**（下記） | §4 |
| 2 | `editor-tab-badge-misroutes-setups-errors` | **再現した → 直した** | `editorTabs.ts` の前方一致は `["steps[", "steps."]` のみで、`setups[0].steps` は最終行 `return "basic"` に落ちていた |
| 3 | `combo-put-error-message-empty` | **再現した → 直した。★かつ追跡行より 1 件多い** | `PUT` に加え **`PATCH /api/combos/:id` も同じ欠落**。§4b |
| 4 | `SD-015`（キャラ選択後 Enter） | **再現した。★開発者裁定で対応不要** | 原因は特定済み（下記）。2026-09-02 開発者判断＝「キャラ欄については対象外でいい。修正しなくて良い」 |
| 5 | `SD-016`（ドラッグ判定） | **★再現しなかった。開発者裁定で対応不要** | 6 ジェスチャで再現せず。下記 |
| 6 | `tag-field-keyboard-unreachable` | **再現した → 直した** | `TagSelector` に `onKeyDown` / `ArrowDown` が 0 件、候補に `role="option"` も無し |

### 1.1 `SD-015` の正体（★症状ではなく原因）

**逐語**＝「キャラ選択の後、エンター押しても反応しない（タブエンターは反応）」（`Memo_Someday.txt:388`）。
Memo への追記は 2026-08-31 で、キャラ選択のコンボボックス化（`3a54305` 2026-08-26 ／ M24-02）**より後**である。⇒ 現行実装に対する観察。

**実測（Playwright / Chromium）**

| 操作 | 起きること |
|---|---|
| ↓ で候補へ → `Enter` | 正常に確定。popover が閉じ、フォーカスは `PopoverTrigger`（`role="combobox"` の button）へ戻る |
| そこでもう一度 `Enter` | **Radix がトリガを活性化して候補が開き直す**（focus = 検索欄） |
| `Tab` → `Enter` | フォーカスがトリガから外れるので次の要素の `Enter` が効く＝逐語の「タブエンターは反応」 |

**⇒ 「反応しない」の実体は「次へ進まず、同じ欄が開き直すだけ」である。** ただし折りたたまれた combobox で `Enter` が候補を開くのは **ARIA の標準挙動**であり、`SearchableSelect` 単体に欠陥は無い。

**★真の非対称はその隣にあった。** エディタでは `useFieldSequence` により `Enter` が次の欄へ進む。順送りの軌跡を実測すると `basic`(11) → `customStates` → `oki`(3) → `other`(5) の **20 停止点**を辿るが、**キャラ欄は 1 度も現れない**。キャラ欄は `ComboEditor.tsx:914` にあり、`rootRef` が付く `ComboEditorBasicFields`（同 `:255`）の外・タブより上に描かれているためである。⇒ **同じ画面でキャラ欄だけ `Enter` が進まない。**

**★開発者裁定＝対応不要**（2026-09-02）。⇒ 直していない。非対称そのものは §6 に候補として残す。

### 1.2 `SD-016` が再現しなかったこと

**逐語**＝「キャラ選択欄、判定がシビアでドラッグしすぎてテキストボックスからカーソルが外れると選択が消えるのが使いにくい。（一覧、ゴミ箱とか、全体の共通？部品）」（同 `:389`）

**6 通りのジェスチャで 1 度も再現しなかった** —— (1) 検索欄内→外へドラッグ (2) トリガの上で離す (3) 候補リストの上で離す (4) ダブルクリックで語を選択してからドラッグ (5) ページ最上部ま11でドラッグ (6) エディタ側で同じ操作。いずれも候補は開いたまま・検索語も保持され、ドラッグ後の打鍵も通る。**外側クリックでは正しく閉じる。**

**理由は説明が付く。** `SearchableSelect` も `TagSelector` も**自前の外側クリック判定も `blur` ハンドラも持たない**（grep 0 件）。閉じる判定は Radix `DismissableLayer` に全委譲で、同レイヤは `mousedown` ではなく **`pointerdown`** を見たうえ、`onPointerDownCapture` で「押下起点がレイヤ内側だった」ときは無視する。⇒ 内側から始まるドラッグでは原理的に閉じない。M24-02 の Popover 化で入った性質である。

**★開発者裁定＝対応不要**（2026-09-02）。逐語＝「検索用に手入力したキャラクター名をマウスでドラッグして選択しようとした時に違和感だったが、そもそもそんな操作はする必要はない事に気が付いたため、直さなくて良い」。

**★ただし閉じる条件を E2E で固定した。** 実装を差し替えたときに黙って再発しうるため（`web/e2e/m27-02a-reachability.spec.ts`）。

**★計測の限界**: Playwright の Chromium で測っている。実機のブラウザ・OS・入力機器では違う可能性は残る。

---

## 2. 束 B の部品の同定（指示書 §2.2.1・★本サブの成果物）

### 2.1 キャラ選択は 3 画面とも同一部品である

| 画面 | ファイル:行 | import |
|---|---|---|
| 編集 | `web/src/features/combo/components/ComboEditorCharacterField.tsx:3` | `@/features/mycombo/components/CharacterSelector` |
| 一覧 | `web/src/pages/ComboListPage.tsx:20` | 同上（文字列として完全に同一） |
| ゴミ箱 | `web/src/pages/TrashPage.tsx:5` | 同上 |

`CharacterSelector.tsx:87` が `<SearchableSelect mode="single">` を返す。**⇒ 開発者の逐語「（一覧、ゴミ箱とか、全体の共通？部品）」への答えは「はい」。**

**唯一の例外**: 編集画面は `mode === "edit"` または `lockedReason` 指定時、`CharacterSelector` 自体を描かず固定テキストになる（`ComboEditorCharacterField.tsx:36,49-58`）。

### 2.2 ★タグ欄は別実装だった（指示書の前提が半分外れている）

`TagSelector.tsx` は `SearchableSelect` を **import していない**。Popover + Input + ul の独立実装で、着手前は **矢印キー移動なし・`role="listbox"` / `role="option"` なし・`text-filter.ts` を通らない独自絞り込み**だった。

⇒ 指示書 §0.2 の「束 B の 3 件は同じ部品の話である見込みが高い」は、**キャラ 2 件については当たり、タグ 1 件については外れ**である。

### 2.3 寄せるか／個別に直すかの判断と、波及の数（§2.2.1-3）

**波及の実測**

| 区分 | 数 |
|---|---|
| `SearchableSelect` を直接 import する本番ファイル | **2**（`ComboListFilters.tsx` ／ `CharacterSelector.tsx`） |
| `CharacterSelector` 経由の間接利用 | **12 ファイル / 14 コントロール** |
| **改修時に動く実 UI の総数** | **15 コントロール / 13 ファイル** |
| mock の追随が要るテストファイル | 4 |
| `TagSelector` の利用画面 | **1**（コンボ登録・編集エディタのみ） |

**判断＝「共通フックだけを抽出して両方が使う」**（開発者確認済み。「過度な共通化にならないか、大変な作業にならないか評価した上で、問題なければ共通フックを抽出」）。

- 抽出したのは `optionButtons` / `moveFocus` / `handleListKeyDown` の **約 30 行**（`web/src/hooks/useListboxKeyNav.ts`）。依存は「コンテナの ref」と「`[role=option]` セレクタ」だけ。
- **`SearchableSelect` の Props にも DOM 契約にも触れていない。** ⇒ 15 コントロールへの波及は振る舞いを変えない内部リファクタに留まる。既存 19 テストがそのまま緑であることが回帰の網である。
- **`TagSelector` を `SearchableSelect` へ丸ごと統合する案は採らなかった。** `onCreateTag`（その場で新規タグ作成）・`excludeCategories`・×付きチップ列を共通部品側へ持ち込むことになり、15 コントロールすべてが載る部品を太らせる（指示書 §3-5）。
- **過度な共通化ではない根拠**: 呼び出し側が実在する 2 か所であり、責務が 1 つ（`[role=option]` 上の roving focus）である。

### 2.4 タグ欄の `Enter` の意味（§2.2.4-3 の決めごと）

**＝「選んで開いたまま」**（開発者確定）。

**実装は明示的な `Enter` 分岐を足していない。** 候補は既に `<button type="button">` であり、フォーカスが載ればブラウザ既定の活性化で `onClick` が撃たれる。`TagSelector.toggle()` は `setOpen(false)` を呼ばないので開いたままになる。`SearchableSelect` の `mode="multi"`（「連続トグルで閉じない」）と同じ作法。

**⇒ `SD-015` の `Enter` の扱いと矛盾しない**（§2.2.4-2）。単一選択は従来どおり選んで閉じ、複数選択は開いたまま。

「〜を新規登録」行も候補列に含めた（`role="option"` / `aria-selected={false}`）。含めないと検索が 0 件になった先で ↓ の行き先が無くなり、そこだけマウスが要るため。

---

## 3. 束 A の動線が 1 本につながったか（指示書 §2.1.4・実操作）

**つながった。** 経路は同梱セットプレイのレシピ未入力（`VAL-S02` → `field = "setups[0].steps"`）。

| 段 | 期待 | 実測 |
|---|---|---|
| 保存が通らない | BE 検証が発火する | 400 `validation_failed` ／ `field: "setups[0].steps"` |
| 理由が分かる | リスト本体に読める文言で出る | **「セットプレイ: レシピは 1 ステップ以上必要です」**。着手前は `setups[0].steps: …` と生のまま出ていた |
| 直す欄を指す | レシピタブのバッジに計上 | `combo-editor-tab-errors-recipe` = 1 ／ `combo-editor-tab-errors-basic` は不在。着手前は逆だった |
| 直す欄へ行ける | そのタブに欄が在る | レシピタブに `combo-editor-setup-section` が在る |

固定先＝`web/e2e/m27-02a-reachability.spec.ts`。**破壊確認**: 前方一致から `setups[` を外すと本テストが落ちる。

**★「編集モードで `setups[*]` の ERROR が出うるか」の先行確認（§2.1.2-1）＝出ない。**
同梱セットプレイの入力欄は `mode === "new" | "copy"` でのみ描画され（`ComboEditor.tsx:1046`）、`runPut`（同 `:720-733`）も `buildCreatePayload()` を土台にするため `setupsToCreate` が空のまま `setups: undefined` になる（同 `:369`）。**⇒ 「欄の無いタブを指す」形は起きない。前方一致を足すだけで足りる（分岐 1）。§2.1.2-2 の「第三の答え」は不要。**

**★バッジの計上規則の所在（§2.1.2-3）**: `editorTabs.ts` の `tabOfIssueField` **1 か所に集約済み**であり実装に散っていない。⇒ 定数化は不要。

---

## 4. `editor-validation-errors-unreachable-from-ui` の (a) の前提の実測（§2.1.1-2）

設計卓の判断 **(a) そのまま残す** はやり直していない。求められた 3 点の実測結果:

### 4.1 「到達不能」がいまも成り立つか → **★成り立たない**

**`setups[*]` の検証は BE だけが持ち、UI から到達できる。** FE の zod スキーマ（`web/src/features/combo/schema.ts`）は `setups` を検証しない。実測（`POST /api/combos` を実サーバへ）:

| 経路 | 応答 |
|---|---|
| レシピ空のセットプレイ 1 件 | `VAL-S02` / `field: "setups[0].steps"` |
| 同一リクエスト内の同一レシピ 2 本 | `VAL-S04` / `field: "setups[1]"` |

**⇒ 追跡行の「画面から到達できる検証エラーが 1 件も無くなった」は現在は成り立たない。** バッジ機構は死んでいない。§3 の動線はまさにこの経路を通っている。

### 4.2 BE 検証が発火したとき、その応答が画面へ届くか → **★届く**

実サーバ（使い捨て DB・専用ポート）へ直接 `curl` して確かめた。

| 経路 | `error.message` | `issues[].field` |
|---|---|---|
| `POST /api/combos`（`VAL-C09`） | 「バリデーションエラーがあります」 | `steps` |
| `PUT /api/combos/:id`（`VAL-C09`） | 同上（**着手前は空文字**） | `steps` |
| `PATCH /api/combos/:id`（`VAL-C02`） | 同上（**着手前は空文字**） | **キーごと無い**（`omitempty`） |

画面側は §3 の E2E で確認済み（`ValidationDisplay` に日本語ラベル付きで出て、タブバッジが直す欄のあるタブを指す）。

**★ただし着手前の状態では (a) は「備え」になり切っていなかった。** `PUT` で `VAL-C02` が出ると **`error.message` が空文字、かつ `issues[].field` も無い**という二重の欠落が同時に起きていた。§4b の修正で `message` 側は塞がった。`field` が無い件は設計どおり（`VAL-C02` は `DuplicateWarning` モーダルへ落ちる）。

### 4.3 `VAL-C02` が `field` 空でモーダルへ落ちる件はいまも同じか → **★同じ**

`internal/service/validation/combo.go:192,198` の `r.AddError(CodeC02Duplicate, "", …)` は不変。`ValidationIssue.Field` の `json:"field,omitempty"` により応答からキーごと消える（上表で実測）。フロントは `tabOfIssueField(undefined) → null` でどのタブにも計上せず、`ComboEditor.tsx:785-790` が `DuplicateWarning` を出す。**触っていない。**

---

## 4b. 空 `message` の全数と、`GET /api/moves` の 500 の判定（§2.1.3.2・§5-4b）

### 4b.1 空 `message` の全数

| 区分 | 件数 | 内訳 |
|---|---:|---|
| **検証エラー経路** | **2** | `PUT /api/combos/:id`（`handler.go:441` 当時）／ **`PATCH /api/combos/:id`**（同 `:391` 当時。★追跡行に無い新発見） |
| **非検証経路** | **1** | `internal/api/move/handler.go:51`（`GET /api/moves` 失敗時の 500 `internal_error`） |
| **合計** | **3** | **すべて直した** |

**非対称が無かったドメイン**（母数）: setups（POST / PATCH とも文言あり）／ tags ／ presets ／ users ／ moves の PATCH ／ punish ／ intake ／ comboio ／ auth。presets と users は POST と PUT が `writeServiceError` を共有しており**構造的に割れない**。

**`PUT /api/config` は寄せていない** —— 422・英語文言（`"configuration validation failed"`）・`issues[]` が `[]map[string]string` の手組みという別系統だから。エラーコードの定数化だけ揃えた（応答の値は 1 バイトも変わらない）。

### 4b.2 `GET /api/moves` の 500 の判定 = **★(a) 非対称の是正 → 射程内。直した**

**判別に使った実測**（§2.1.3-1 の全数調査と同じ 1 回の走査）:

```
$ grep -rn "internal_error" internal/api --include=*.go | grep -v _test.go | wc -l
53
$ grep -rn "internal_error" internal/api --include=*.go | grep -v _test.go | grep -v 'NewAPIError('
internal/api/move/handler.go:51:  Error: model.APIError{Code: "internal_error"},
```

**⇒ 500 `internal_error` の応答サイトは 53 件あり、うち 52 件が非空の `message` を持つ。空は 1 件だけ。**

**⇒ 局所的な正解が存在する（他の経路に合わせればよい）。「内部エラーで利用者に何を言うか」の方針決定ではない。** 判別表の (a) に当たるため射程内とし、**同ファイルの他 3 サイト（`:88` / `:115` / `:142`）と同じ形**へ揃えた（`model.NewAPIError("internal_error", "サーバーエラーが発生しました")`）。

**★影響の大きさ**（指示書が「低優先と書かず影響を書け」と求めた点）: `GET /api/moves` は**編集画面の技選択が引く経路**である（`web/src/features/moves/api.ts:28` の `useMovesByCharacter`）。ここが落ちると利用者はレシピを組めない。着手前は本文が `{"error":{"code":"internal_error","message":""}}` で返っていた。**⇒ 応答そのものが「何が起きたか」を 1 文字も載せていない状態**であり、束 A の 3 件（保存が通らない）より利用者への影響は大きい。

**★★ただし「画面表示がどう変わるか」は本修正だけでは変わらない**（2026-09-02 レビュー 中-1 の指摘で訂正。**初版は経路を取り違えていた**）。**`moves` は `web/src/lib/api-client.ts` の `fetchJSON` を通り、同関数は `throw new Error(\`HTTP ${res.status}: ${body}\`)` で生ボディをそのまま投げる**（`error.message` を取り出す処理を持たない）。⇒ 画面に出るのは修正の前後とも `HTTP 500: {…}` という生テキストである。**本修正で直ったのは応答の契約であって、`fetchJSON` 経路の見せ方ではない。** 見せ方は残課題 §6-6 へ回した。

**★初版が引用していた `body?.error?.message ?? …` は `web/src/features/combo/api.ts:163`（コンボ保存経路）であり、`moves` はこの行を通らない。** `web/src/features/` 配下に `api.ts` は 5 本あり（`moves` / `combo` / `preset` / `combo-io` / `tag`）、**ファイル名だけで書いたことが取り違えの原因である。⇒ 本報告のパス表記はすべてリポジトリルートからの相対で書く。**

### 4b.3 直し方（§2.1.3-2「寄せ先」）

**根本原因**: `validation_failed` 応答を組む共通ヘルパが無く、**5 か所で `model.APIError{…}` を直書き**していた。`APIError.Message` に `omitempty` が無いため、`Message:` の行を書き忘れた 2 か所だけが `"message":""` として応答に出ていた。

**寄せ先＝`internal/model/api_error.go` の `NewValidationFailedError`。**

- `ErrorCodeValidationFailed` / `MessageValidationFailed` を定数化（着手前はコードが 7 か所、文言が 3 か所にリテラル直書き。**兄弟の `ErrorCodeVersionConflict` 等は定数化されているのに `validation_failed` だけ無かった**）。
- `validations any` で受けることで `internal/model` → `internal/service/validation` の **import 循環を作っていない**（`validation` が `model` を import しているため、型で受けると循環する）。
- 呼び出し 5 か所を差し替え（combo の POST / PATCH / PUT ／ setup の POST / PATCH）。

**なぜ誰も気づかなかったか**: 検証エラーのテストが `Error.Code` しか見ておらず、**`Error.Message` を検査するテストがリポジトリ全体で 1 件も無かった**。⇒ 1 経路ずつ足すのではなく、3 経路を同じ表で回して**値の一致まで見る**形にした（`TestHandler_ValidationFailed_MessageIsUniformAcrossVerbs`）。

**応答の形（ステータス・エラーコード・`issues[]`）は変えていない。変えたのは `message` だけである。**

---

## 5. CHANGE たたき台（★製造は自採番しない）

| 宛先 | 書く内容 |
|---|---|
| **`DES-002`**（API のエラー応答） | **(1)** **`validation_failed` を返す形は 3 系統ある**（★「400 ＋ `details.validations`」だけだと書かないこと）。**(1-a)** 400 ＋ `details.validations` ＝ `model.NewValidationFailedError`（combo POST/PUT/PATCH ／ setup POST/PATCH の 5 経路）。`message` は `model.MessageValidationFailed` 固定で、**組み立ては同関数の 1 本のみ**。**(1-b)** **422 ＋ 英語文言**＝`PUT /api/config`（`issues[]` は `[]map[string]string` の手組みで `code` / `severity` を持たない）。**(1-c)** **400 ＋ `details.field`**＝`PATCH /api/moves/:id`（`message` は `ve.Message` で個別に決まる）。**★(1-b)(1-c) は統一漏れではなく別系統であることを明記する**——書いておかないと次の担当が「漏れ」と読んで揃えに行く。**(2)** 500 `internal_error` は必ず非空の `message` を持つ（実測 53/53）。 |
| **`DES-005`**（画面設計 §5.7） | **(1)** タブ見出しのエラーバッジの振り分けは、`steps` に加え **`setups[*]` もレシピタブ**（`D-593` の裁定の実装反映）。**(2)** エラーリストのフィールドラベルに「セットプレイ」を追加。**★添字（何件目か）は出さない**（`steps` と同じ理由＝BE と FE で基点が違う）。**(3)** タグ欄は候補の矢印キー移動と `Enter` 選択を持つ。**複数選択なので `Enter` では閉じない。**「新規登録」行も候補列に含む。 |
| **`DES-006`**（バリデーション） | **★「画面から到達できる検証エラーが 1 件も無い」という記述があれば失効させる。** `setups[*]`（`VAL-S02` / `VAL-S04`）は FE zod が検証しないため **BE だけが持ち、UI から到達できる**。 |

**★`followup-backlog` §AO の `combo-put-error-message-empty` 本文へ「`PATCH` も同じ欠落だった」を写す手番は設計卓が持つ**（`D-382`。指示書 §2.1.3.2 で済ませたとの記載あり）。

---

## 6. 残課題（★`followup-backlog` §J 以外への登録は候補として出す。設計卓が畳む）

| # | 候補 | 種別 | 根拠 |
|---|---|---|---|
| **1** | **エディタでキャラ欄だけが順送りの停止点になっていない。** 他の 20 停止点は `Enter` で進むのにキャラ欄だけ進まない。原因はキャラ欄が `ComboEditorBasicFields`（`rootRef` が付く領域）の外・タブより上に描かれていること。**★開発者裁定で本サブは対応不要**（2026-09-02）。直すなら `useFieldSequence` の根を `ComboEditor` 側へ上げる必要があり、順送り契約（`DES-005` §5.7）に触れる | 設計判断 | §1.1 |
| **2** | **`m24-12-editor-rebuild.spec.ts` (3)「保存直後の遷移では確認が出ず、かつ編集画面へ戻らない」が落ちる。** ★本サブの変更ではない —— `da8a1e3` でも**着手基点 `0853c74`** でも同一に落ちる。**★★2026-09-03 に開発者機でも同一に落ちることを確認した（2 台で再現・環境依存ではない）。★さらに調べた結果、判定が変わった——§6-2b を見ること。** ★同 spec の順送り・入力補助のテスト((5)(7)・畳まれたセクション)は両環境とも緑。**★retry の「POST /api/combos の応答に id が無い」は別の欠陥ではない**——84 行目の assert で落ちて **87 行目以降の後片付けに到達せず**、作成したコンボが E2E の DB に残るため、retry では `VAL-C02` で 400 になる。**⇒ 拾う人は 1 回目の失敗だけを見ること** | 既存の失敗 | §7-2 の手順で帰属を確定 ＋ 開発者機での追確認 |
| **3** | **`scripts/check-import-order.sh` がベースライン +1 で NG。** ★本サブの変更ではない —— **着手基点 `0853c74` の時点で既に 102 / ベースライン 101** だった。★同スクリプトは「増える方向の更新はしない」と定めているのでベースラインは触っていない | 既存の逸脱 | §7-2 |
| **4** | **`"VAL-C02"` が生リテラルで 2 か所に散っている**（`ComboEditor.tsx:786` ／ `features/combo/errors.ts:5`）。`web/src/constants/api-error.ts` に他のコードはある | 規約逸脱 | §3 の調査中に発見。**本サブの 6 件と無関係なので触っていない**（指示書 §3-5） |
| **5** | **`TagSelector` の絞り込みが `text-filter.ts` を通らず、NFKC 正規化も trim もしない**（`TagSelector.tsx:43-46`）。`text-filter.ts:11-13` が「付与側の振る舞いは変えない」と明記しており**意図的な残置**である | 既知の意図的残置 | 触っていない |

| **6** | **`GET /api/moves` が 500 を返したとき、画面には `HTTP 500: {…}` という生テキストが出る。** `web/src/lib/api-client.ts` の `fetchJSON` は `error.message` を読まず本文をそのまま `Error` に詰める。**⇒ 本サブで `message` を非空にしたのは応答の契約の是正であり、この経路の見せ方は変わっていない**（レビュー 中-1） | 見せ方 | §4b.2 |
| **7** | **`tabOfIssueField` は許可リストであり、集合に無い入れ子 field は黙って `basic` へ落ちる**（`editorTabs.ts:69-77`）。**今回の `setups[*]` の misroute はこの構造で起きた。⇒ 次に BE が新しい入れ子 field を組み立てた瞬間、また同じ報告が来る。** `DES-006` §2.7 が名指しした「許可リストか対象外リストか」の型そのもの（レビュー 中-3）。**★本サブでは塞いでいない**——既定 `basic` は正しい場合もあり（`okiOptions` 等は基本情報タブが正しい）、「未知の入れ子は落とす」床を作るには**基本情報側の既知の入れ子も列挙する必要**があって、6 件の射程を超える | 構造 | レビュー 中-3 |
| **8** | **`TagSelector` の絞り込みが `text-filter.ts` を通らず NFKC 正規化も trim もしない**（`TagSelector.tsx:43-46`）。`text-filter.ts:11-13` が「付与側の振る舞いは変えない」と明記しており**意図的な残置**。**★ただし本サブがキーボード操作を揃えた結果、「キャラ欄は正規化して絞り込むのにタグ欄はしない」という非対称が相対的に目立つようになった**（レビュー 低-5） | 既知の意図的残置 | 触っていない |
| **9** | **`<ul role="listbox">` の直下に `<li>`(generic) が挟まる**。ARIA では `listbox` の owned element は `option` が期待される。**★本サブの後退ではない**——`SearchableSelect.tsx` の既存の形を `TagSelector` が踏襲しただけであり、直すなら両方同時（レビュー 低-3。**理由付きで不採用**） | a11y | 触っていない |
| **10** | **`aria-multiselectable` は本サブで両者に付けた**（レビュー 低-2 を採用）。★ただし**両部品とも `<li>` を挟む形は残っている**ため、支援技術から見た正しさは #9 と一体である | a11y | 採用済み |

### ★★§6-2b `m24-12` (3) の再調査（2026-09-03）

**★★2026-09-03 調査で判定が変わった。** 開発者から「`M26-01` / `M27-01` のセッションでは単独実行で成功していた」との報告を受けて調べ直した結果:

1. **コードの退行ではない。** `44cabf5`（`M27-01` の tip）と着手基点 `0853c74` は **`web` / `internal` / `migrations` / `cmd` の差分が 0**（間の PR #144 は `docs/` と `.claude/commands/` のみ）。
2. **`make e2e`（全数）では通る。** 現 HEAD で **229 件すべて緑**。
3. **落ちるのは「この spec だけを単独で走らせたとき」に限る。** 先行 spec を 1 本足すだけ（`make e2e-only P="combo-crud m24-12-editor-rebuild"`）で通る。
4. **戻る 2 回で `/` には正しく着いている**（`framenavigated` の実測列＝`/combos/new?character=1` → **`/`** → `/combos` → `/combos?character_id=1`）。**⇒ テストが検証したい「補正が効いていること」自体は成立している。**
5. **その直後にアプリが `/` から前へ進む**（約 50ms 以内）。`HomePage` 自身に遷移の副作用は無いため、離脱ガードまたはルータの履歴処理が出所である。**⇒ `toHaveURL(/\/$/)` がこの競走に負けると落ちる。**

**⇒ 「常に落ちる既存の失敗」ではなく「実行モードで結果が変わる順序依存のテスト」である。** 常設のゲート（`make e2e`）は緑であり、**`M26-01` / `M27-01` の「成功」報告とも矛盾しない**。

**★★設計卓の手番として明示的に出すもの（レビュー 高-3。★実物を照合した）**

**`docs/handover/followup-backlog.md:950` の `combo-put-error-message-empty` は `PUT` のみを名乗ったままである。** 指示書 §2.1.3.2 末尾は「**`PATCH` の発見を追跡行へ写す手番は設計卓が持つ。⇒ 本追補の時点で設計卓が済ませた**」と書いているが、**実ファイルを開いて確認したところ写されていない**（本報告の初版は「済ませたとの記載あり」と伝聞で書いており、実物を照合していなかった）。

**⇒ 追跡行は次の担当の一次情報である。`PUT` だけを名乗る行が残ると、この欠陥が `PATCH` にも在ったという最も重要な発見が追跡表から読めない。** 指示書側に「済ませた」と書いてあるぶん誰も再確認しない（`D-250` と同型）。**★製造は `followup-backlog` の §J 以外を編集できない**（`D-382`）ため、設計伝達レポート §4 の候補として出す。

**★§J 停止時記録への登録は無し**（往復上限・タイムボックス・終了指示のいずれにも達していない。再レビュー往復 0 回）。

---

## 7. 教訓

1. **「追跡行に書いてある件数」は調査の出発点であって射程の定義ではない。** `combo-put-error-message-empty` は `PUT` 1 件として起票されていたが、**同じ欠陥が `PATCH` にもあった**。全数で見なければ「1 か所だけ直して、次に同じ報告が来る」になっていた。指示書 §2.1.3-1 の「全数で見る」がそのまま効いた。

2. **★「flake」は根本原因ではない。帰属を確かめる手順を持つこと。** `m24-12` (3) が落ちたとき、順送りのテストは緑だったので「自分の変更ではない」と言いたくなる。**実際に確かめた** —— 変更した全ファイルを `git show 0853c74:<path>` で着手基点の内容へ戻し、新規ファイルを退避して同じテストを回した。**着手基点でも同一に落ちた。** 推測ではなく実測で「既存の失敗」と言えるようになった。同じ手順を `check-import-order.sh` の +1 にも当てた。

3. **★破壊確認は「テストが何も守っていない」を暴く唯一の手段である。** 4 件で実施した —— `PATCH` の `message` を空へ戻す（1 件が落ちる）／ 前方一致から `setups[` を外す（ユニット 5 件 ＋ E2E 1 件が落ちる）／ タグ欄の矢印キー処理を外す（5 件が落ちる）／ `onInteractOutside` を殺す（外側クリックのテストが落ちる）。**落ちる箇所が期待どおりに局在すること**まで見た（`message` の破壊では `PATCH` のサブテストだけが落ち、`POST` / `PUT` は緑のまま）。

   **★チェックリスト §6-2（info-mark を選択肢群より前の DOM 位置へ移す）は実施していない。やらないと決めた**（`D-675`＝「触れなかった」と「やらないと決めた」を区別する）。**理由＝`ComboEditorBasicFields.tsx` の差分が 0 であり、同じ条件を既存テスト（`ComboEditorBasicFields.test.tsx:412-445`）が既に固定しているため。** 代わりに `setups[` 前方一致の破壊を当てた（本サブが実際に触った面である）。

4. **★逐語は症状であって原因ではない。** `SD-015`「エンター押しても反応しない」を額面どおり読むと `Enter` ハンドラを足したくなるが、実測すると `Enter` は正しく効いており（候補が確定し popover が閉じる）、ARIA 標準どおりトリガを開き直していただけだった。**真の非対称は「キャラ欄が順送りの停止点になっていない」という隣の事実**にあった。指示書 §2.2.2-1 の「★逐語は症状であって原因ではない」がそのまま効いた。

5. **★「再現しない」も成果である。** `SD-016` は 6 ジェスチャで再現せず、**解消した機構まで特定できた**（Radix `DismissableLayer` の `pointerdown` ＋ 内側起点ガード）。直っているものを直そうとして直っていない何かを壊すのが一番高くつく（§0.3）。**ただし閉じる条件はライブラリの実装依存なので、テストで固定してから閉じた。**

6. **★共通化の判断は「波及の数を出してから」行える。** `SearchableSelect` は直接 import が 2 ファイルしかないが、`CharacterSelector` 経由の間接を数えると **15 コントロール / 13 ファイル**になる。この数を出す前に「共通部品だから寄せよう」と決めていたら、`onCreateTag` や `excludeCategories` を共通部品へ持ち込んで 15 コントロール全部を太らせていた。**約 30 行のフックだけを共有する**という中間解は、数を出したから選べた。

7. **★「設計卓が済ませた」と書いてある記述を、実物を見ずに写さないこと。** 指示書 §2.1.3.2 は「`PATCH` の発見を追跡行へ写す手番は設計卓が持つ。⇒ 本追補の時点で設計卓が済ませた」と書いており、本報告の初版はそれを伝聞のまま §5 へ写した。**実ファイルを開くと写されていなかった**（レビュー 高-3）。**★指示書側に「済ませた」と書いてあるぶん、誰も再確認しない。** `D-250` と同型であり、**伝聞を報告へ載せる前に 1 度 `grep` すれば済む**。あわせて、**ファイル名だけで場所を書かないこと**——`api.ts` は `web/src/features/` 配下に 5 本あり、この曖昧さが §4b.2 の経路の取り違え（レビュー 中-1）を生んだ。

8. **★★E2E の「単独で緑」は「全数で緑」の証明にならない。両方向で実証された。** (a) **本サブが新設した動線 E2E は単独で緑・全数で赤だった**——親コンボを `ryu` ＋ 先頭技 1 ステップで作っており、E2E の DB は spec 間で共有され `ryu` は 97 か所で使われるため、全数では重複が既に存在し **`VAL-C02` が検証段階で ERROR になって同梱セットプレイのループ（`internal/service/combo/service.go:382`）まで到達しない**。⇒ 見たかった `VAL-S02` が出なかった。(b) **既存の `m24-12` (3) は単独で赤・全数で緑だった**（§6-2b）。**⇒ 完了の根拠にするのは常設のゲート（`make e2e`）であり、`make e2e-only` の緑ではない。** **★重複判定に載る形のデータを作る E2E は、キャラとレシピで他と離すこと**——他の spec はいずれも `firstMoveIdOf`（先頭技）の 1 ステップである。

9. **★★「2 台で再現した」は「常に落ちる」の証明ではない。** `m24-12` (3) を開発者機でも再現させたとき「環境依存ではない既存の失敗」と結論したが、**両方とも単独実行という同じ条件で測っていただけ**であり、**実行モードを変える実験をしていなかった**。⇒ 先行 spec を 1 本足すだけで結果が反転した。**★再現条件を「変えて」みるまで、再現の範囲は分からない。** §7-2 の「帰属を確かめる手順」は正しかったが、**帰属（誰のせいか）と範囲（いつ落ちるか）は別の問いである。**

---

## 8. レビュー結果（★Phase C で記入。実測）

- **レビュー報告書**: `docs/progress/m27-02a-review.md`（fresh subagent による独立レビュー。`fork` は使っていない）
- **指摘件数と優先度別内訳**: **重大 0 件 / 高 3 件 / 中 7 件 / 低 5 件**（計 15 件）
- **各指摘の採否と理由**: 同報告書末尾の「取り込み結果（自動トリアージ）」に全件を記載
- **★「高」指摘の不採用は 0 件**（高-1 / 高-2 / 高-3 とも採用。高-3 のみ `D-382` により製造が実ファイルを直せないため、§6 の「設計卓の手番として明示的に出すもの」へ回した）
- **不採用は 1 件のみ**（低-3 `<ul>` 直下の `<li>`。**本サブの後退ではなく、直すなら共通部品の両方を同時に触ることになり指示書 §3-5 に触れるため**。§6-9 に残課題候補として記録）
- **再レビュー往復の回数**: **0 回**（停止規律の上限 2 回に達していない）

### 8.1 ★レビューが見つけた、報告自身の誤り 2 件

**★どちらも「動作は正しいのに記述が違う」型であり、テストも lint も型検査も緑のまま通る。人が読む以外に見つける経路が無かった。**

1. **§4b.2 の影響記述が別の経路を根拠にしていた**（中-1）。`GET /api/moves` は `web/src/lib/api-client.ts` の `fetchJSON` を通るのに、`web/src/features/combo/api.ts:163`（コンボ保存経路）の nullish 合体を引用していた。**⇒ 修正の妥当性は変わらないが、「画面表示がどう変わるか」の主張が誤っていた。** 訂正済み。残る事実（`message` を非空にしても `fetchJSON` 経路の見せ方は変わらない）は §6-6 へ。
2. **§5 と §6 が `followup-backlog.md:950` の状態を伝聞で書いていた**（高-3）。指示書 §2.1.3.2 の「設計卓が済ませた」をそのまま写しており、**実ファイルを照合していなかった。実際には未反映**である。照合したうえで §6 へ書き直した。

**★教訓 7 として §7 へ追加した。**

---

## 9. ■ 併せて更新が要るもの

| # | 対象 | 状態 |
|---|---|---|
| 1 | **消費した CHANGE 番号の登録** | **該当なし**。本サブは CHANGE を消費していない（★製造は自採番しない。たたき台は §5 で出し、起票と登録は設計卓の手番） |
| 2 | **その番号の写し先の全数** | **該当なし**（同上）。番号が払い出された時点で `change-number-registry` §1 ／ 契約 §4 ／ ボード §2.1 ／ ボード §2.4 の**総数を都度実査**すること |
| 3 | **消費したマイグレ連番** | **該当なし**。`ls migrations/` の実査値は `000081` が最大で、**本サブは 1 本も消費していない**（`M14-03f` が `000082` から連番で消費中のため自採番しない＝`D-293`） |
| 4 | **版を上げた文書の参照元** | **該当なし**。`docs/design/` は 1 文字も編集していない（指示書 §3-6）。指示書 v1.2.0 とチェックリスト v1.0.0 は設計卓が発行したものを配置しただけ |
| 5 | **`web/CLAUDE.md` §1 のブラウザストレージ台帳** | **該当なし**。本サブはブラウザストレージを使っていない（`bash scripts/check-browser-storage-keys.sh` = 違反なし） |
| 6 | **`docs/progress/progress-log.md` の索引行** | **追記済み**（`CLAUDE.md` §8） |

---

## 10. 検証の実測

| 検査 | 結果 |
|---|---|
| `bash scripts/check-artifact-integrity.sh` | **違反なし** |
| `bash scripts/check-browser-storage-keys.sh` | **違反なし** |
| `bash scripts/check-import-order.sh` | **NG（ベースライン +1）。★着手基点 `0853c74` の時点で既に +1 であり本サブの増分ではない**（§6-3） |
| `go build ./...` | OK |
| `go test ./...` | **55 パッケージ green** |
| `cd web && pnpm lint`（`tsc --noEmit`） | green |
| `cd web && pnpm test` | **210 ファイル / 2356 件 green** |
| **`make e2e`（全数）** | **★★229 件すべて green**（2026-09-03。既存 226 ＋ 本サブの 3）。**★これが完了の根拠である**——`make e2e-only` の緑は根拠にしない（§7-9） |
| `make e2e-only P=m27-02a-reachability` | **3 件 green** |
| `make e2e-only P=m24-02` | **4 件 green**（キャラ選択の検索・並び順の回帰） |
| `make e2e-only P=m24-12` | **4 件 green / 1 件 failed**。**★落ちた 1 件は単独実行のときだけであり、`make e2e`（全数）では緑である**（§6-2b）。**順送り (5) ／ 入力補助 (7) ／ 畳まれたセクションはどちらでも緑** |

**★E2E は `make e2e-only P=…` で回した**（`playwright` を直接叩いていない＝`CLAUDE.md` §11 / `D-599`）。

---

*以上*
