# M38-02 完了報告 — 技編集の導線除去 ＋「引っ越し取込」→「他から引っ越し」改名

| 項目 | 内容 |
|------|------|
| 作業ID | **M38-02** |
| 指示書 | `docs/instructions/M38-02-moves-grid-hide-and-rename.md` **v1.0.0** |
| チェックリスト | `docs/instructions/reviews/M38-02-review-checklist.md` **v1.0.0** |
| 実施日 | 2026-09-17 |
| 着手基点 | `7ce1393` |
| 実装コミット | `23e5bee` |
| ブランチ | `claude/clever-darwin-87l5gp` |
| 射程 identity | **2 件**（技編集の導線除去 ／ 改名） |
| マイグレ消費 | **0 本**（指示書どおり） |
| CHANGE 消費 | **2 本の見込み**（★自採番していない＝`D-293`。原稿は設計伝達レポート §1 / §6） |

---

## 0. 着手前の版ゲート（指示書 §0.4）— **5 点すべて通過**

| # | 確かめたこと | 実測 |
|---|---|---|
| 1 | チェックリストの存在 | ✅ `docs/instructions/reviews/M38-02-review-checklist.md` |
| 2 | `DES-005` §5.19 の節名が「引っ越し取込」 | ✅ `05-screen-design.md:1718` |
| 3 | `DES-005` §5.18 が「moves 編集グリッド」 | ✅ `05-screen-design.md:1700` |
| 4 | `docs/usermanual/` に説明書の本文 | ✅ `tacpendium-readme.html` ／ `tacpendium-quickstart.html` |
| 5 | 枝元 | ✅ `7ce1393 Merge pull request #230 from plexiblinp/claude/adoring-thompson-hl2142` |

---

## 1. 段 1 — 実査（**コードを書く前に完了。全数はファイルへ落として `wc -l` で計数**）

**走査方法**: `--include` を絞らず、`--exclude-dir` は `.git` / `node_modules` / `dist` のみ。出力は全量をファイルへ落とし `wc -l` で数えた。**`head` / `tail` で切っていない**（`D-881`）。

### 1-1. 「引っ越し取込」の出現 — **リポジトリ全体 102 行 ／ 製造の射程 31 行**

| 区分 | 件数 | 内訳 |
|---|---|---|
| **表示語（利用者に見える）** | **2** | `Header.tsx:36`（ナビ） ／ `IntakeHelperPage.tsx:159`（h1） |
| **テスト機構** | **3** | `retired-words.test.ts` の `:66`（`useInstead`） ／ `:135`（**陰性対照＝改名で赤になる唯一のテスト**） ／ `:9`（経緯コメント） |
| **`web/src` のコメント** | **15** | Header:33 ／ IntakeHelperPage:40,42 ／ ComboImportPage:66,80 ／ intake/prompt.ts:1,135,136 ／ intake/user-rules-storage.ts:3,5 ／ intake/types.ts:1 ／ intake/review.ts:1 ／ combo/moveSurfacing.ts:92 ／ combo-io/clipboard.ts:143 ／ mycombo/CharacterSelector.tsx:21 |
| **`web/e2e`** | **3** | m17-04 spec:4（コメント）・:17（`test.describe` の題） ／ support/characters.ts:50 |
| **Go** | **1** | `internal/model/move.go:33` |
| **説明書** | **7** | `tacpendium-readme.html` の 185 / 787 / 790 / 870 / 877 / 907 / 908 |
| **射程内 合計** | **31** | — |
| **射程外** | **71** | `docs/progress`（歴史記録） ／ `docs/change-notes` ／ `docs/handover/design-reports` ／ `docs/instructions` ／ `docs/design`（**CHANGE 原稿で対応**） ／ `followup-backlog.md`・`parallel-board.md`（**設計卓の面**） |

- 「引っ越し」**単独**の出現は **0 件**（すべて「引っ越し取込」の一部）。
- `docs/usermanual/tacpendium-quickstart.html` と `dist-readme.txt` は **0 件**（`dist-readme.txt` は `M36-01` の手番＝`D-887`。触っていない）。

> **★計画段階では「30 件」と書いたが、実測は 31 件であった**（`IntakeHelperPage.tsx` のコメントが 2 件ではなく 2 件 ＋ h1 の 3 件構成で、`web/src` コメントの総数が 14 ではなく 15 だった）。**⇒ 数え直したのは、ファイルへ全量落として `uniq -c` を取り直したからである。**

### 1-2. 技編集への導線 — **全数 1 件。★設定画面には無かった**

| 場所 | 実測 |
|---|---|
| **`web/src/components/Header.tsx:37`** | **★唯一の導線。** `NAV_LINKS` の 1 エントリであり、PC ナビ（`:79`）とモバイル Sheet（`:125`）の**両方が同じ配列を描く**ため、1 行の削除で両面から消える |
| `SettingsPage.tsx` ／ `SettingsSection*.tsx` | **0 件**（画面外への `Link` は `/presets` のみ） |
| `Footer.tsx`（モバイル下部ナビ 4 項目） | **0 件** |
| 確定反撃サーチ ／ その他の画面 | **0 件** |

**★★指示書 §0.1 の前提（「設定画面から技編集への導線を外す」）は as-built と食い違っていた。**
`DES-005` §3（`05-screen-design.md:131`）は「moves 編集グリッドへの導線は**主要ナビゲーションには含めず**、『設定』配下のデータ管理導線として配置する」と定めているが、**実装はヘッダのメインナビに置かれていた**。`DES-005` §5.16 の項目一覧にも技編集の行は無い。
**⇒ 指示書 §2.1-2 が「★設定画面だけとは限らない」と先回りしていたとおり、実際の除去対象は `Header.tsx:37` の 1 行であった。この乖離は M38-02 以前から在り、CHANGE 原稿 A へ含めた。**

**★あわせて `followup` の `punish-unknown-damage-fix-requires-moves-grid`（「確定反撃サーチに導線が無い」）を実測で確認した。⇒ 確かに 0 件である**（指示書 §2.1-2 が言う「*無い*ことの確認」）。

### 1-3. 技編集のルート・テスト・E2E — **すべて残す。★E2E の寄せ替えは不要だった**

| 対象 | 実測 | 本サブでの扱い |
|---|---|---|
| ルート | `web/src/router.tsx:44` `<Route path="/moves/edit" …>` | **温存**（注記のみ追加） |
| 画面・部品 | `pages/MovesEditGridPage.tsx` ／ `features/moves/{MoveEditGrid.tsx, api.ts, types.ts}` ／ `constants/move-warning.ts` | **温存** |
| 単体テスト | `features/moves/MoveEditGrid.test.tsx`（**14 本**）。部品を直接描画しており Header を通らない | **温存・無変更** |
| **E2E 4 本** | `moves-edit` ／ `m14-03d-manon-seed` ／ `m14-03e-third-wave-seed` ／ `m31-02-character-picker-drag` | **★4/4 が元から `page.goto("/moves/edit")` の URL 直打ち。リンク経由は 0 本** |
| Go | ルート参照 **0 件**（散文コメント 4 件のみ）。API（`GET/PATCH /api/moves` ／ rush-variant）は無変更 | **温存** |

> **★★指示書 §2.2-3（「導線を踏んでいた E2E が在れば URL 直打ちへ寄せる」）は、実測の結果 no-op であった。**
> **⇒ 寄せ替えるべき spec が 1 本も無かった。消した spec も 0 本である。**

**★着手前は守りが無かった**——`Header.test.tsx` の 1 本目は「NAV_LINKS の全リンクを表示」という題でありながら **12 本のうち 6 本しか主張しておらず、「技編集」は 1 度も主張されていなかった。⇒ 外しても戻しても赤くならない状態であった**（本サブで守りを新設した。§2-4）。

### 1-4. 説明書の該当章

| 章 | 実測 |
|---|---|
| **ch14「moves 編集グリッド」** | `readme.html:180`（TOC） ／ `:704`（`id="ch14"`） ／ `:705`（h2） ／ **`:712`「共通ヘッダから開きます。」＝導線除去で失効する 1 行** ／ `:731-734`（`shot todo`・未撮影） |
| **ch18「引っ越し取込」** | 1-1 の 7 行 |
| `tacpendium-quickstart.html` | **0 件**（両方とも） |

---

## 2. 実装（段 2〜段 3b）

### 段 2 — 技編集の導線除去（射程 1）

| # | ファイル | やったこと |
|---|---|---|
| 2-1 | `web/src/components/Header.tsx` | `NAV_LINKS` から `{ to: "/moves/edit", label: "技編集" }` を削除。**「なぜ外したか・なぜ残すか」を同位置へ 6 行で明記** |
| 2-2 | `web/src/pages/MovesEditGridPage.tsx` | 冒頭へ **★★★この画面・ルート・テストは意図して残してある** 旨を明記。**★理由は 2026-09-17 の開発者の訂正へ差し替え済み**（下記 §10）＝**外した理由は「利用者に見せない」／残した理由は「削除コストが高い」**。あわせて **③ の失効コメント**（`:17-18`「取込画面からの導線(?character=)」＝生成元の画面17 は `CHANGE-055` で削除済）を現状へ是正 |
| 2-3 | `web/src/router.tsx:44` | ルートは**変更せず**、「URL 直打ち専用になっただけであり消してはならない」旨の JSX コメントを添えた |
| 2-4 | `web/src/components/Header.test.tsx` | **テスト 2 本を新設**（+30 行 / -0 行）。①「技編集はナビに出ない」（PC ナビとモバイル Sheet の**両面**を見る） ②「『他から引っ越し』が `/import/combo/helper` を指し、旧名が出ない」 |
| 2-5 | `web/e2e/moves-edit.spec.ts` | spec は**消さず・`goto` のまま**、**ヘッダに技編集リンクが無いこと ＋ 改名が届いていること**の assert を 3 行追加（+11 行 / -0 行） |
| 2-6 | `web/e2e/combo-crud.spec.ts:44` | `exact: true` の**根拠コメントが失効**（「ヘッダーの『技編集』ナビ(M9-03 #5)と部分一致衝突しないため」）。**`exact: true` 自体は残し**、失効した旨と現在の根拠へ書き換えた |
| 2-7 | `docs/usermanual/tacpendium-readme.html` | **★2026-09-17 の開発者裁定で方針が変わった。⇒ ch14 節を丸ごと削除した**（下記 §10）。当初は「いまメニューに出していません」と書いて章を残したが、**「あまり見せたくない機能について言及を残すのは嫌だ」**との判断により、**節（旧 `:704-738`）・TOC 行・ch20 の相互参照・`shot todo` 枠を削除**し、**「全 22 章」→「全 21 章」を 4 箇所**で是正した |

### 段 3 — 改名（射程 2）

**★表示語の正本は `ja.json` ではなかった。**
実測で `ja.json` / `en.json` に intake・helper 系のキーは **0 件**であり、本画面は `DES-005` §5.19 の「i18n キーは追加しない（import/export 系の固定 ja 流儀）」どおり**全面直書き**である。**⇒ 正本は `Header.tsx:36` と `IntakeHelperPage.tsx:159` の 2 箇所である。設計書の節名は写していない**（指示書 §4.3 の趣旨＝`CHANGE` 通知書・設計書は表示語の正本ではない、は満たしている）。**i18n キーは新設していない**（新設すると `locales.test.ts` のキー対称と `no-japanese-in-en.test.ts` を巻き込み、射程外になる）。

| # | 対象 | やったこと |
|---|---|---|
| 3-1 | `Header.tsx:36` | `label: "引っ越し取込"` → **`"他から引っ越し"`** |
| 3-2 | `IntakeHelperPage.tsx:159` | h1 → **「他から引っ越し(他のアプリ・メモ・表計算から)」**（★括弧書きを残すのは**開発者の選択**である。下記 §5 参照） |
| 3-3 | `web/src/locales/retired-words.test.ts` | **4 点**: (a) `取込ヘルパー` の `useInstead` を「他から引っ越し」へ（**連鎖改名で旧値それ自体が退けた語になるため**） ／ (b) **新規 `RETIRED` エントリ**`{ word: "引っ越し取込", useInstead: "他から引っ越し", reason: "M38-02・開発者裁定 2026-09-17(D-892)…" }` ／ (c) **陰性対照**を「他から引っ越し」へ ／ (d) ファイル冒頭へ 2 度目の改名と**走査根が `web/src` だけである**旨を明記 |
| 3-4 | `web/src` のコメント **15 箇所** | 画面を**現在の呼び名で指している**記述を「他から引っ越し」へ。**経緯コメント**（`Header.tsx:33` ／ `IntakeHelperPage.tsx:42`）は歴史として残し、2 度目の改名を書き足した |
| 3-5 | `web/e2e` **3 箇所** | m17-04 spec の `test.describe` 題（:17）とコメント（:4） ／ `support/characters.ts:50` |
| 3-6 | `internal/model/move.go:33` | 「★★ただし**他から引っ越し**(intake)は「入力面」に含めない(2026-09-10 開発者判断)。」 |
| 3-7 | `docs/usermanual/tacpendium-readme.html` **7 箇所** | 185（TOC） / 787 / 790 / 870（h2） / 877（`<code class="path">`＝ナビ名） / 907（`alt`） / 908（figcaption）。**★画像ファイル名 `images/ch18-intake-helper-1.png` は変えていない**（未撮影の `shot todo` 枠であり、ファイル名規約は `M32` 系の手番） |

**★変えていないもの**: ルート `/import/combo/helper`（`router.tsx:46`） ／ `INTAKE_USER_RULES_STORAGE_KEY = "intake-helper-user-rules-v1"`（`user-rules-storage.ts:8`） ／ `/moves/edit` ／ 画像ファイル名。

### 段 3b — 既存の失効記述の是正（**★開発者裁定により射程へ加えた 3 件**）

**★これらは指示書に無い変更である。⇒ 実装前に開発者へ確認し、「①②③ すべて直す」との裁定を得た。**

| # | 対象 | やったこと |
|---|---|---|
| ① | `web/CLAUDE.md` §1 台帳 #4 | 用途欄「取込ヘルパーの独自ルール…」→「他から引っ越しの独自ルール…」。**2 度退けた語を指している状態**の解消。`check-browser-storage-keys.sh` は緑 |
| ② | Go の「取込ヘルパー」 **実測 19 箇所 / 16 ファイル** | `M24-07` の直し漏れ。**★`retired-words.test.ts` の走査根が `web/src` だけであるため、一度も赤くならなかった**。すべてコメント（1 件のみテスト失敗メッセージの文字列）であり、振る舞いは変わらない。読みが不自然になる 5 箇所は「他から引っ越し」を鉤括弧で括る等で整えた |
| ③ | `MovesEditGridPage.tsx:17-18` | 「取込画面からの導線(?character=)」→ **生成元であった moves 取込プレビュー（画面17）は `CHANGE-055` / `M14-02` で削除済であり、現在このクエリを付けて遷移してくる画面はコード上に 1 つも無い**旨へ是正 |

> **★② の件数は事前調査時点で 17 と見積もったが、実測は 19 であった**（`cmd/tacpendium/main.go` の 2 件を取りこぼしていた）。**⇒ ファイルへ全量落として数え直したことで捕まった。**

---

## 3. 数えた全数と直した数の突き合わせ（**チェックリスト B-1 / B-2**）

### 3-1. 「引っ越し取込」

| | 着手前 | 着手後 | 差 |
|---|---|---|---|
| **リポジトリ全体** | **102** | **84** | **-18** |
| **製造の射程（`web/` ／ `internal/` ／ `cmd/` ／ `docs/usermanual/`）** | **31** | **13** | **-18** |

**★残った 13 件は 1 件ずつ判定した。⇒ すべて「残すのが正しい」ものである。**

| # | 箇所 | 種別 | 残す理由 |
|---|---|---|---|
| 1 | `Header.test.tsx:65` | コメント | 改名の主張を説明する行 |
| 2 | `Header.test.tsx:70` | **否定アサート** | `queryByText("引っ越し取込")` が `null` であること＝**旧名が出ないことの主張** |
| 3 | `Header.tsx:33` | 経緯コメント | **1 度目の改名の記録**（「取込ヘルパー」→「引っ越し取込」） |
| 4 | `Header.tsx:35` | 経緯コメント | **2 度目の改名の記録** |
| 5 | `retired-words.test.ts:9` | 経緯コメント | 1 度目の改名の記録 |
| 6 | `retired-words.test.ts:13` | 経緯コメント | 2 度目の改名の記録 |
| 7 | `retired-words.test.ts:76` | コメント | `useInstead` を書き換えた理由 |
| 8 | `retired-words.test.ts:83` | **`RETIRED` の `word`** | **★退けた語そのもの。⇒ ここに書いてあるからこそ機械が見張る** |
| 9 | `retired-words.test.ts:152` | コメント | 陰性対照を移した理由 |
| 10 | `IntakeHelperPage.tsx:42` | 経緯コメント | 1 度目の改名の記録 |
| 11 | `IntakeHelperPage.tsx:43` | 経緯コメント | 2 度目の改名の記録 |
| 12 | `m17-04-intake-helper.spec.ts:4` | 経緯コメント | 2 度の改名を 1 行にまとめた記録 |
| 13 | `moves-edit.spec.ts:78` | **否定アサート** | `toHaveCount(0)`＝**旧名がナビに出ないことの主張** |

**★★「経緯はコメントに残せる」は `retired-words.test.ts` 自身が明示的に担保している**（同ファイル `:147-153` の「★コメントは走査対象から外れている(経緯は残せる)」テスト）。**⇒ 上の 1・3〜7・9〜12 は `stripComments` で落ちるため、新規 `RETIRED` エントリに当たらない。2・8・13 はテストファイル（`*.test.ts(x)`）か `web/e2e` であり、そもそも走査対象外である。**

**⇒ 実質的な「呼び名としての『引っ越し取込』」は 0 件である**（表示語 2・コメント 15・e2e 題 1 ＋ Go 1 ＋ 説明書 7 ＝ **26 箇所を直し**、機械機構 3 箇所は新しい語へ付け替えた）。

### 3-2. 「取込ヘルパー」（②）

| | 着手前 | 着手後 |
|---|---|---|
| **Go（`internal/` ＋ `cmd/`）** | **19** | **0** |
| **`migrations/`** | **1** | **0**（**★Phase C で追加。下記参照**） |
| **`web/CLAUDE.md`** | **1** | **0** |
| `web/src` ／ `web/e2e` | 6 | 6（**すべて経緯コメント ＋ `RETIRED` の `word` フィールド**） |

> **★★★製造の走査は `migrations/` を取りこぼした**（レビュー 高-1 が検出）。
> **⇒ 原因は射程の切り方である**——段 3b ② の走査を **`web/` ／ `internal/` ／ `cmd/` ／ `docs/usermanual/` の 4 箱**に限ったため、`migrations/000033_create_move_commands.up.sql:10` の 1 件が視界に入らなかった。
> **★機械では永久に捕まらない**——`retired-words.test.ts` の走査根は `web/src` だけである。
> **★直した**（コメント 1 行。`M29-01` が `SAゲージ` の統一で**適用済みマイグレのコメントを同じように直した先例**がある＝`migrations/000020_add_gauge_consumed_columns.up.sql:2` ／ 経緯は `retired-words.test.ts` の `SA ゲージ` エントリの `reason` に逐語で残っている）。**スキーマ・データは 1 バイトも変えていない。**
> **⇒ レビュー 中-7「走査根を広げるか」は設計卓の判断であり、設計伝達レポート §4 へ申し送った。★申し送りだけでは 3 度目が起きる、というレビューの指摘はそのまま伝えてある。**

---

## 4. テスト・検査の実測（**★パイプを挟まずに判定。出力は全量をファイルへ落とした**）

### 4-1. 全数テスト

| 対象 | コマンド | 実測 |
|---|---|---|
| **Go** | `go test ./... > gotest.txt 2>&1; echo "EXIT=$?"` | **`EXIT=0`** ／ `grep -cE "^--- FAIL"` → **`0`** ／ `grep -cE "^FAIL"` → **`0`** ／ 出力 90 行 |
| **フロント** | `cd web && pnpm test > pnpmtest.txt 2>&1; echo "EXIT=$?"` | **`EXIT=0`** ／ **Test Files 234 passed (234)** ／ **Tests 2953 passed (2953)** |
| **E2E** | `make e2e > e2e.txt 2>&1; echo "EXIT=$?"` | **`EXIT=0`** ／ **Running 352 tests** → **351 passed (6.0m) ／ 1 flaky** ／ 出力 434 行 |

**★E2E の 1 flaky は本サブと無関係である。**
`e2e/m31-02-tag-field-drag.spec.ts:49` 「タグ欄で始めたドラッグの文字選択 › 右へ枠外までドラッグしても文字選択が消えない」。**マウスのドラッグ操作のタイミングに依存する spec であり、リトライで緑になった**（同ファイルの左・上・下の 3 方向は初回から緑）。**本サブはタグ欄にもドラッグ挙動にも 1 バイトも触れていない。**

**★本サブに関係する spec の個別行（全量ファイルから抜粋。★「全体の結果」だけで済ませていない＝`M37-05` の教訓）**:

| spec | 結果 |
|---|---|
| `moves-edit.spec.ts:30`（moves 編集グリッド FR703） | **✓**（**★新設した「ナビに技編集が無い」assert を含む**） |
| `m17-04-intake-helper.spec.ts:18`（他から引っ越し） | **✓** |
| `m17-04-intake-helper.spec.ts:77`（c_viper 照合） | **✓** |
| `combo-crud.spec.ts:15`（コンボ CRUD スモーク・`exact: true` 経路） | **✓** |
| `combo-crud.spec.ts:81`（メモのみ編集） | **✓** |
| `m14-03d-manon-seed.spec.ts:23`（**画面18**） | **✓** |
| `m14-03e-third-wave-seed.spec.ts:25`（**画面18**） | **✓** |
| `m31-02-character-picker-drag.spec.ts:103`（**区分1 pick モード＝技マスタ編集**） | **✓** |

### 4-2. 検査スクリプト

| 検査 | 結果 |
|---|---|
| `check-artifact-integrity.sh`（**★1 本目に回した**） | **`EXIT=0`** |
| `check-browser-storage-keys.sh`（**台帳 #4 を触ったため**） | **`EXIT=0`** |
| `check-import-order.sh`（`.tsx` を触ったため） | **`EXIT=0`**（99 ファイル / ベースライン 99・増加なし） |
| `check-doc-refs.sh` | **`EXIT=0`** |
| `check-stop-discipline.sh` | **`EXIT=0`** |
| `check-enum-sync.sh` | **`EXIT=0`** |
| `check-doc-inventory.sh` | **`EXIT=0`**（情報提供型） |
| `pnpm exec tsc --noEmit -p tsconfig.json` | **`EXIT=0`** |
| `check-md-emphasis.sh docs/progress/M38-02-completion-report.md` | **§8 に記載**（本報告を書いた後に実行） |
| `check-progress-log-index.sh` | **§8 に記載**（**★本報告を書いた後に回し直す**＝`D-890`） |

### 4-3. `git diff --stat 7ce1393`

```
 cmd/tacpendium/main.go                             |  4 +--
 docs/usermanual/tacpendium-readme.html             | 17 ++++++------
 internal/aliasindex/aliasindex.go                  |  2 +-
 internal/aliasnorm/aliasnorm.go                    |  2 +-
 internal/api/comboio/handler_test.go               |  4 +--
 internal/api/intake/dto.go                         |  2 +-
 internal/api/intake/handler.go                     |  2 +-
 internal/api/intake/routes.go                      |  2 +-
 internal/api/preset/scope_test.go                  |  2 +-
 internal/model/move.go                             |  2 +-
 internal/model/preset.go                           |  2 +-
 internal/moveindex/moveindex.go                    |  2 +-
 internal/repository/movecommand/repository.go      |  2 +-
 internal/repository/preset/repository.go           |  2 +-
 internal/service/comboio/multiuser_test.go         |  2 +-
 internal/service/intake/service.go                 |  2 +-
 internal/service/intake/types.go                   |  2 +-
 .../service/preset/custom_preset_priority_test.go  |  4 +--
 web/CLAUDE.md                                      |  2 +-
 web/e2e/combo-crud.spec.ts                         |  6 ++++-
 web/e2e/m17-04-intake-helper.spec.ts               |  4 +--
 web/e2e/moves-edit.spec.ts                         | 11 ++++++++
 web/e2e/support/characters.ts                      |  2 +-
 web/src/components/Header.test.tsx                 | 30 ++++++++++++++++++++++
 web/src/components/Header.tsx                      | 11 ++++++--
 web/src/features/combo-io/clipboard.ts             |  2 +-
 web/src/features/combo/moveSurfacing.ts            |  2 +-
 web/src/features/intake/prompt.ts                  |  6 ++---
 web/src/features/intake/review.ts                  |  2 +-
 web/src/features/intake/types.ts                   |  2 +-
 web/src/features/intake/user-rules-storage.ts      |  4 +--
 .../mycombo/components/CharacterSelector.tsx       |  2 +-
 web/src/locales/retired-words.test.ts              | 28 +++++++++++++++++---
 web/src/pages/ComboImportPage.tsx                  |  4 +--
 web/src/pages/IntakeHelperPage.tsx                 |  9 ++++---
 web/src/pages/MovesEditGridPage.tsx                | 17 ++++++++++--
 web/src/router.tsx                                 |  2 ++
 37 files changed, 147 insertions(+), 56 deletions(-)
```

**★新規ファイルの上書き確認（教訓 `E-225`）**: `git diff --diff-filter=A --name-only 7ce1393` は **0 件**である。**⇒ 本サブは実装フェーズで新規ファイルを 1 つも作っていない**（追加したテスト 2 本は既存の `Header.test.tsx` への `Edit`、E2E の assert は既存 spec への追記であり、いずれも **`+` のみ・deletions 0**＝`Header.test.tsx` は `30 / 0`、`moves-edit.spec.ts` は `11 / 0`）。**⇒ 上書きで消えたテストは無い。**

### 4-4. 完了条件 §6-3「技編集のコード・ルート・テストが残っている」の `git diff` による提示

| 対象 | `git diff 7ce1393` での扱い |
|---|---|
| `web/src/router.tsx` | **`+2 / -0`**（JSX コメント 2 行の追加のみ。`<Route path="/moves/edit" …>` 行は**無変更**） |
| `web/src/pages/MovesEditGridPage.tsx` | **`+17 / -2`**（冒頭コメントと `?character=` コメントの是正のみ。**ロジックは 1 行も変えていない**） |
| `web/src/features/moves/MoveEditGrid.tsx` ／ `api.ts` ／ `types.ts` | **差分なし** |
| `web/src/features/moves/MoveEditGrid.test.tsx`（14 本） | **差分なし** |
| `web/e2e/moves-edit.spec.ts` | **`+11 / -0`**（assert の追加のみ。`page.goto` も既存 assert も**無変更**） |
| `web/e2e/{m14-03d,m14-03e,m31-02-character-picker-drag}.spec.ts` | **差分なし** |
| `internal/api/move/` ／ `internal/service/move*` ／ `internal/repository/move/` | **`repository.go` のコメント 1 行のみ**（②）。**実装コードは差分なし** |

---

## 5. 設計判断とその理由

| # | 判断 | 理由 |
|---|---|---|
| 1 | **導線の除去先を `Header.tsx` とした**（指示書は「設定画面から」と書いている） | **★as-built が設計書と食い違っていた**（§1-2）。指示書 §2.1-2 が「設定画面だけとは限らない」と全数走査を求めており、**実測で導線は Header の 1 行しか無かった**。⇒ 設計書間の矛盾ではなく**設計書と実装の乖離**であるため、止めずに進めて CHANGE 原稿へ載せた |
| 2 | **`NAV_LINKS` からエントリを削除した**（コメントアウトではない） | `CLAUDE.md` §4「不要なコメントアウトコードは削除する（Git 履歴で復元できる）」。**★代わりに「なぜ外したか・なぜ残すか」を 3 ファイル（Header / MovesEditGridPage / router）へ明記した**——コメントアウトは「いつか戻す」の意思を伝えるが、**なぜ消してはいけないかは伝えない** |
| 3 | **「なぜ外したか」を 1 行ではなく 3 ファイルへ置いた**（指示書 §2.2-4 は「1 行」） | **危険は 2 方向にある**。Header を読む人は「なぜ消えたか」を知りたく、`MovesEditGridPage` を読む人は「なぜ残っているか」を知りたい。**⇒ 片方だけだと、もう片方の読み手に届かない**（実際にチェックリスト A-4 は「次の担当が『使われていないから消そう』と判断しないため」と目的を書いている） |
| 4 | **h1 の括弧書きを残した** | **★開発者の選択である**（実装前に 3 案を提示して確認）。`DES-005` §2 の画面一覧 行19 が元から「引っ越し取込(他のアプリ・メモ・表計算から)」と **括弧込みで** 載せており、その形を踏襲する |
| 5 | **i18n キーを新設しなかった** | `DES-005` §5.19 が「i18n キーは追加しない（import/export 系の固定 ja 流儀）」と明記。新設すると `locales.test.ts` のキー対称・`no-japanese-in-en.test.ts` を巻き込み、射程外の変更になる |
| 6 | **`exact: true` を残した**（`combo-crud.spec.ts`） | 根拠であった「技編集」ナビは消えたが、**緩めると「どれを押したか」が実行時まで分からない指定に戻る**。⇒ 根拠コメントだけを現状へ書き換えた |
| 7 | **説明書 ch14 を残し、URL を載せなかった** | **★開発者の選択である**。章を消すと ch15 以降の章番号・アンカー・画像ファイル名規約へ波及し、`M32` 系の撮影運用と衝突する。URL を載せると「利用者に触らせない」という §0.1 の目的と逆方向に働く |
| 8 | **`m31-02-tag-field-drag` の flaky を再実行で確定させなかった** | **Playwright が自動でリトライして緑**にしており、**再実行の枠を使い切っていない**。⇒ 本サブと因果が無い（タグ欄のドラッグ挙動に 1 バイトも触れていない）ため、根本原因の追究は射程外とし申し送る |

**★推測で進めた箇所は無い。** 判断が要った 4 点（h1 の文言 ／ Go コメントの改名可否 ／ 説明書 ch14 の扱い ／ 既存の失効記述の是正範囲）は**すべて実装前に開発者へ確認して裁定を得た**。

---

## 6. ■ 併せて更新が要るもの

| # | 項目 | 実測・対応 |
|---|---|---|
| 1 | **消費した CHANGE 番号を registry へ登録したか** | **★該当なし。⇒ 番号を 1 本も払い出していない**（`D-293`＝製造は自採番しない）。**原稿を設計伝達レポート §1 / §6 へ置き、採番は設計卓の手番である** |
| 2 | **その番号の写し先を全数直したか** | **★該当なし**（上と同じ理由。`change-number-registry.md` §1 ／ 契約 §4 ／ ボード §2.1 ／ §2.4 のいずれにも触れていない） |
| 3 | **消費したマイグレ連番** | **★0 本**（指示書どおり）。`ls migrations/` の実査値もボード §2.2 も動かしていない |
| 4 | **版を上げた文書の参照元** | **★該当なし**（版を上げた文書は無い。指示書・チェックリストはいずれも v1.0.0 のまま） |
| 5 | **ブラウザストレージ台帳** | **★`web/CLAUDE.md` §1 の #4 の用途欄を更新した**（旧名「取込ヘルパー」→「他から引っ越し」）。**キー名 `intake-helper-user-rules-v1` は変えていない**。`check-browser-storage-keys.sh` は `EXIT=0` |
| 6 | **派生資料** | **★`docs/handover/code-facts.md:501-502` の 2 行が失効する**（レビュー 高-4 で 1 行と書いていたのを是正）。**`:501`** はナビ表示語を `"引っ越し取込"` とハードコードしており、**`:502`** は **`| Header | /moves/edit | "技編集" | active |`** ——**★消えた導線を `active` と主張している。⇒ こちらの方が誤解を生む。** 同ファイルは `scripts/generate-code-facts.sh` の生成物であるため**本サブでは触らず**、再生成の要否を設計伝達レポート §4 へ申し送る |

---

## 7. レビュー結果（Phase B / Phase C）

**レビュー報告書**: `docs/progress/m38-02-review.md`（Phase B の fresh subagent が作成。**`fork` は使っていない**＝レビュアーの独立性）

| 欄 | 実測 |
|---|---|
| 指摘の総数 | **10 件** |
| 優先度別の内訳 | **高 4 ／ 中 4 ／ 低 2** |
| **「高」指摘の不採用** | **0 件**（★4 件すべて採用・対応済み。⇒ 開発者エスカレーションは発生していない） |
| 中の採否 | **2 件採用 ／ 2 件は設計伝達レポート §4 へ送付** |
| 低の採否 | **0 件採用**（2 件とも理由つきで不採用。下表） |
| 再レビュー往復の回数 | **0 回**（上限 2 回に達していない。**★「高」4 件はすべて実測で裏を取ってから修正しており、再レビューを要する争点は残っていない**） |

### 7-1. トリアージ（採否と理由）

| # | 優先度 | 指摘 | 採否 | 理由・対応 |
|---|---|---|---|---|
| 1 | **高** | `migrations/000033_create_move_commands.up.sql:10` に「取込ヘルパー」が残存 | **採用** | **★製造の取りこぼしであることを実測で確認した**（`grep -rn "取込ヘルパー" migrations/` → 1 件）。原因は段 3b ② の走査を 4 箱に切ったこと。**コメント 1 行を直した。★スキーマ・データは変えていない。** 適用済みマイグレ本文の編集可否（レビューの「不明」①）は、**`M29-01` が `SAゲージ` の統一で同じことをした先例**で解決する（`migrations/000020_...up.sql:2` が実物、経緯は `retired-words.test.ts` の `SA ゲージ` エントリの `reason` に逐語で在る）。§3-2 の表へ `migrations/` 行と射程の切り方を明記した |
| 2 | **高** | 説明書 `tacpendium-readme.html:983`（ch20）が、いまメニューに無い画面へ利用者を送っている | **採用** | **★実測で確認**（「技のデータを直したいときは moves 編集グリッドへ。」）。ch14 と同じトーンへ書き換え、**`#ch14` への内部リンク**にした上で「この画面はいまメニューに出していません」を添えた。**★URL は載せていない**——ch14 と同じ扱いに揃えた（開発者裁定）。レビューの「不明」②（説明書の文面は開発者の面）については、**新しい方針を作らず、既に開発者が選んだ ch14 の文面へ揃えるだけに留めた** |
| 3 | **高** | `progress-log.md` の索引行が無く `check-progress-log-index.sh` が `EXIT=1` | **採用** | **★これは欠陥ではなく工程順である**——索引行の追記は **Phase D** であり、レビューは Phase B（Phase C/D より前）に走った。**⇒ 指摘は正しく、Phase D で追記して検査を回し直した**（§8）。**★レビューが「偽の緑ではなく正直な保留」と評価したとおり、`D-890` の偽装はしていない** |
| 4 | **高** | 完了報告 §6-6 の派生資料の申し送りが `code-facts.md:501` の 1 行だけだが、失効は `:501-502` の 2 行 | **採用** | **★実測で確認**（`:502` は `\| Header \| /moves/edit \| "技編集" \| active \|`）。**消えた導線を `active` と主張している方が誤解を生む。** §6-6 を 2 行へ是正した |
| 5 | 中 | `import-screen-has-two-names` の対象へ `IntakeHelperPage` を加える候補を §4 へ | **採用（送付）** | 設計伝達レポート §4 へ候補として書く。**★`followup-backlog.md` は 1 文字も編集しない**（`D-838`） |
| 6 | 中 | `Header.test.tsx` 1 本目の題「全リンクを表示」が 11 本中 6 本しか守っていない | **採用** | **★題が実態を偽っている＝本プロジェクトが「高」に較正する型そのものである**（撤回済み・失効した記述）。しかも**これが「技編集を外しても赤くならなかった」原因の一端**でもある。⇒ 期待値を緩めず、**全 11 本を名指しで主張し、件数も見る形へ作り替えた**（`D-308` と同じ扱い） |
| 7 | 中 | `retired-words.test.ts` の走査根を広げるかを設計卓で決める | **送付（本サブでは実施しない）** | **★走査根の変更は本サブの射程外である**——`web/e2e` / `internal` / `cmd` / `migrations` / `docs/usermanual` へ広げると、**歴史記録として残すべき経緯コメントまで赤くなる**設計判断が要る（現在の `stripComments` は TS 用であり `.sql` / `.html` のコメント構文を知らない）。**⇒ 設計卓の判断。§4 へ送る。★「申し送りだけでは 3 度目が起きる」というレビューの警告もそのまま伝える** |
| 8 | 中 | `web/e2e/combo-crud.spec.ts` のコメント変更が `M38-01` とマージで当たらないか確認 | **送付** | **★本サブの手番では確認できない**（`M38-01` は並列の別ブランチであり、取り込み系の git 操作は `deny`）。**⇒ 変更は 44 行目のコメント 5 行だけであり、衝突しても解決は自明**である旨を §4 へ書く |
| 9 | 低 | `stripComments` の 2 つの弱点（行末コメント判定 ／ ブロックコメントの早期クローズ） | **不採用** | **レビュー自身が「現状の実データでは発火していない・いま直す必要は無い」と書いている。** ⇒ 発火していない正規表現を投機的に直すと、**直したこと自体が検証できない**。次に同ファイルを触る手番へ委ねる |
| 10 | 低 | `moves-edit.spec.ts` がヘッダのナビ内容まで見るようになった（責務の混在） | **不採用** | **★意図した設計である。** 導線の有無だけを見る spec を新設すると、**E2E が 1 本増えて全数の実行時間が伸びる**割に、押さえる主張は 2 行しかない。**★将来ナビが変わったときに落ちる**というレビューの指摘は正しいが、**落ちること自体が望ましい**（技編集の導線が戻ったら知りたい）。**⇒ 理由は spec 内のコメントに明記済みである** |

### 7-2. ★「高」指摘の不採用は **0 件**である

**⇒ Phase C の安全弁（重大指摘の自動棄却時のみ開発者エスカレーション）は発動していない。**

**★★本節は Phase B / Phase C の完了後に書いた**（`D-510`）。**Phase A の時点ではプレースホルダを置いており、レビュー報告書へのリンクも張っていなかった**（当時は存在しないファイルであったため）。

---

## 8. 報告を入力に取る検査の回し直し（**★本報告と索引行を書いた後に実行**＝`D-890`）

> **★★検査を回した時点と報告を書いた時点がずれると「緑」が偽になる。⇒ 完了報告そのものが検査の入力だからである**（`M36-01` §7-1 の実例＝`check-progress-log-index.sh` を先に回して緑と書き、その後に完了報告を作ったことで赤へ変わったのに気づかなかった）。

**★★実際にそのとおりになった。** Phase A の時点では本報告がまだ無く、Phase B のレビューが `check-progress-log-index.sh` を回したところ **`EXIT=1`** であった（レビュー 高-3）。**⇒ Phase D で索引行を追記した後に回し直して緑を確認している。★「先に回した緑」を書き写していたら偽になっていた。**

| 検査 | 実測（**Phase D の追記後**） |
|---|---|
| `check-progress-log-index.sh` | **`EXIT=0`**（検査した 115 件すべてが progress-log に現れる／ALLOW 除外 17 件） |
| `check-completion-report-md-emphasis.sh` | **`EXIT=0`** |
| `check-doc-inventory.sh` | **`EXIT=0`**（情報提供型。新種のファイルは増えていない＝本サブの新規は完了報告とレビュー報告の 2 件で、いずれも既存の型） |
| `check-md-emphasis.sh <本報告> <レビュー報告>` | **`EXIT=0`**（検出 0 行。**★フェンス内の逐語引用による偽陽性も出ていない**） |
| `check-artifact-integrity.sh` | **`EXIT=0`** |
| `check-doc-refs.sh` | **`EXIT=0`** |
| `check-browser-storage-keys.sh` | **`EXIT=0`** |
| `check-import-order.sh` | **`EXIT=0`** |
| `check-stop-discipline.sh` | **`EXIT=0`** |

### 8-1. Phase C の修正を入れた後の全数テスト（**★再実測。Phase A の値を書き写していない**）

| 対象 | 実測 |
|---|---|
| **Go** | **`EXIT=0`** ／ `grep -cE "^--- FAIL"` → **`0`** |
| **フロント** | **`EXIT=0`** ／ **Test Files 234 passed (234)** ／ **Tests 2953 passed (2953)** |
| **E2E** | **`EXIT=0`** ／ **Running 352 tests** → **351 passed (5.9m) ／ 1 flaky** ／ 出力 434 行 |

**★flaky は 2 回とも同一である**——`e2e/m31-02-tag-field-drag.spec.ts:49`「右へ枠外までドラッグしても文字選択が消えない」。**⇒ 本サブの変更（Phase A / Phase C とも）とは独立に再現しており、因果が無いことの傍証になる。★同ファイルの左・上・下の 3 方向は 2 回とも初回から緑である。**

**★本サブに関係する spec は再実行でも全数緑**: `moves-edit.spec.ts:30` ✓ ／ `m17-04-intake-helper.spec.ts:18` ✓ ／ `:77` ✓。

---

## 9. 未解消のまま停止した項目

**★現時点で 0 件。** 停止規律（再レビュー往復上限 2 回 ／ タイムボックス ／ 開発者の終了指示）に達していない。
**Phase C 終了時に未解消の指摘が残った場合は、`followup-backlog.md` を 1 文字も編集せず、設計伝達レポート §4 へ「§J 行の原稿」として必須 5 フィールド付きで書く**（`D-838`）。

---

## 10. ★★★Phase C 後の開発者裁定 2 件（2026-09-17・完了報告提出後）

**★本節は完了報告を出した*後*に受けた裁定である。⇒ 上の §1〜§9 の記述のうち、該当箇所は本節が上書きする。**

### 10-1. **`/moves/edit` を残す理由が差し替わった**

| | 内容 |
|---|---|
| **指示書 v1.0.0 の記録** | §0.1 / §0.2 は **開発者の逐語として明示的にマークしていた** ——外す理由＝ **一部の技のフレームが特殊〔`through` 等〕であり、初期はフレームの誤りを開発者自身が直したい** ／残す理由＝ **将来「setplay only の技だけを作成・編集する画面」へリメイクする** |
| **★2026-09-17 の訂正** | 「**`/moves/edit` を残すのは消すコストが高かったからであり、フレームの誤りはマイグレ等で直す**」 |
| **差し替えた先** | `web/src/components/Header.tsx`（ナビ除去の理由コメント） ／ `web/src/pages/MovesEditGridPage.tsx`（冒頭の「外した理由／残す理由」） ／ 設計伝達レポート §6 の CHANGE 原稿 A |
| **★残る失効** | **指示書 `M38-02` §0.1 / §0.2** と **`M38-overview` §2**、**ボード `D-892` の行**が旧理由のままである。**⇒ いずれも設計卓の手番であり、製造は触っていない**（設計伝達レポート §2-3 で是正を請求した） |

**★「使われていないから消してよい」を防ぐ目的は、新しい理由でも成立する。** `MovesEditGridPage.tsx` の冒頭には「**消すには画面・ルート・API 経路・14 本の単体テスト・4 本の E2E を一括で畳む必要があり、その判断は開発者の手番である**」と明記した。

### 10-2. **説明書の `ch14`（moves 編集グリッド章）を丸ごと削除した**

**開発者の判断＝「あまり見せたくない機能について言及を残すのは少し嫌です」。** §2-7 で当初採った「章は残して『いまメニューに出していません』と書く」は撤回した。

| # | やったこと | 実測 |
|---|---|---|
| 1 | **`ch14` 節を削除**（旧 `:704-738`） | 節は**自己完結**しており、前後（`ch13` の `</section>` と第 4 部の `part-head`）に食い込みは無かった |
| 2 | **TOC 行を削除**（旧 `:180`） | **★`href="#ch14"` は 2 件あった**（TOC と ch20 の相互参照）。`toc-ch` クラスで絞って TOC 側だけを消した |
| 3 | **`ch20` の相互参照を文ごと削除** | Phase C で足した `<a href="#ch14">` を含む一文を撤去。**⇒ 説明書から「moves 編集グリッド」の語が 0 件になった** |
| 4 | **「全 22 章」→「全 21 章」を 4 箇所** | `tacpendium-readme.html:191` ／ **`docs/usermanual/dist-readme.txt:8, :223`（正本）** ／ そこから生成される **`README.txt:8, :223`** |
| 5 | **`README.txt` を再生成** | `bash scripts/check-dist-readme.sh --write` → `✅ 生成しました: README.txt (231 行)`。照合 `bash scripts/check-dist-readme.sh` → **`EXIT=0`「一致」** |

**★★★`docs/usermanual/dist-readme.txt` は指示書 §3-5 が「触るな」と明記していた**（`M36-01` の手番・`D-887`）**が、その前提は本サブの着手時点で既に失効していた**（2026-09-18 の実査で判明）**。**

| # | 実測 |
|---|---|
| 1 | **`D-887`**（2026-09-15）**は `M36-01` に対して「`dist-readme.txt` は射程内である」と許可を与えた裁定**であり、指示書 §3-5 はそれを「だから `M38-02` は触るな」へ読み替えたものである |
| 2 | **`D-890`**（2026-09-17）**が `M36-01` を受理した＝マージ可。⇒ 「`M36-01` の手番」は終わっている** |
| 3 | **`M36-01` の `dist-readme.txt` / `README.txt` への変更**（`37573df` ／ `e2e4260`）**は、マージ `1795065` 経由で本サブの着手基点 `7ce1393` に既に入っている。⇒ 本サブの編集はその上に積んだものであり、`D-888` が塞ごうとした「上書きによる消失」は発生していない** |

**⇒ 開発者裁定を仰いだこと自体は正しかったが、「指示書の禁止を上書きした」という整理は過大であった。★正確には「禁止の前提が既に消えていた」である。**

**★直した理由＝章数は `readme.html` と `dist-readme.txt` の両方に持たれており、片側だけ直すと「配布 zip の `README.txt` が『全 22 章』と名乗る一方、実物は 21 章」という食い違いが配布物の中に残るためである。**

**★副次的な変化**: 撮影枠が **readme 28 → 27**（`images/ch14-moves-grid-1.png` の枠が消えたため）。**⇒ 撮影対象の総数は `quickstart` の 1 枚を含めて 29 → 28 枚である**（`progress-log` の `M32-03` 追補が記録した 29 枚からの更新値）。**★画像は 1 枚も撮られていない**（`docs/usermanual/images/` は空）**ため、破棄した実ファイルは無い。**

**★HTML の構造は機械で検証した**（2026-09-18）: **タグの均衡**（未閉じ 0・不一致 0。`html.parser` で全走査） ／ **TOC の `toc-ch` 21 件 ＝ `section.chapter` 21 件** ／ **TOC の `href="#chNN"` 21 件すべてが実在する `id` へ解決** ／ **どの部も空になっていない**〔第 1 部 4 章・第 2 部 5 章・第 3 部 4 章・第 4 部 4 章・第 5 部 4 章〕。

**★章 `id` は詰め直していない**（`ch13` の次が `ch15`）。**⇒ 章番号は `<h2>` に出ず `id` 属性と TOC の `<ol>` 自動採番だけであるため、利用者には見えない。詰めると既存の全アンカーが動く。**

---

*以上、M38-02 完了報告。* **★★★本サブは「消しすぎ」と「直し漏れ」の両方で落ちる。⇒ §3 の突き合わせ表（直し漏れ）と §4-4 の `git diff` 提示（消しすぎ）を対にして読むこと。**
