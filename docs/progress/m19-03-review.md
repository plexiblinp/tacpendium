# M19-03 レビュー報告書

| 項目 | 内容 |
|------|------|
| 対象 | M19-03（セットプレイ成立条件の記録）／指示書 v1.0.0・チェックリスト v1.0.0 |
| 対象コミット範囲 | `7b6520b..HEAD`（`2827528` 〜 `e343283` の 7 コミット・41 ファイル） |
| レビュー実施日 | 2026-07-28 |
| レビュー方法 | Read による全変更ファイルの読取＋`go build` / `go vet` / `go test`（該当パッケージ）／`pnpm vitest run`（全体）の実行。コードは一切変更していない |
| 総合判定 | **合格（§8 重大ゼロ）**。最重要ゲート 4 点はすべて充足。中 3 件・低 4 件・質問 2 件を指摘 |

---

## 総評

最重要ゲート 4 点（識別キー変更編集での引き継ぎ／「未検証」＝行の有無／CREATE TABLE のみ 1 本・中央払い出し連番／編集導線は項目10 のみ）はいずれも実装・テスト双方で充足しており、チェックリスト §8 の重大問題判定基準に該当するものは 1 件も無い。
特に §4.2 は、指示書が想定した (a)/(b) のどちらでも塞げない穴（`infra/db.Open` の `PRAGMA foreign_keys=ON` が接続プールの 1 本にしか効いていない）を Plan Mode の実査で発見し、**両方を併用したうえで PRAGMA 非適用の生接続を使う決定的な回帰テストを置いている**。この主張はレビュー側でも独立に裏取りでき（`internal/infra/db/db.go:42` が `*sql.DB.Exec`、リポジトリ全体に `SetMaxOpenConns` が 0 件、FK=OFF テストが skip せず PASS）、**製造の判断は妥当**である。
一方で、製造自身が採った「FK に依存しない明示削除」という方針が `PermanentDelete`（ゴミ箱からの完全削除）経路にだけ適用されておらず、また `note` の再編集がセルの巡回トグルと不可分な設計になっているため既存 `ok` セルの note を `ok` のまま編集できない、という 2 点は M20 と並行で潰しておきたい。
ドキュメント（完了報告）の記述精度は総じて高いが、E2E C の識別キー変更が「実 UI 操作」ではなく API 直叩きである点は §9.4 の要求に対してやや過大な表現になっている。

---

## 設計準拠性レビュー結果

### §0.2 最重要ゲート 4 点

| # | ゲート | 評価 | 根拠 |
|---|---|---|---|
| 1 | 識別キー変更編集で検証結果が失われない（§4.2） | **◎** | 下記 1.3 参照 |
| 2 | 「未検証」＝行の有無／`result` に NULL 無し（§4.1.3） | **◎** | 下記 1.2 参照 |
| 3 | CREATE TABLE のみ 1 本・連番は中央払い出し | **◎** | 下記 1.1 参照 |
| 4 | 編集導線は項目10・セットプレイ編集画面に無い（§4.4.1） | **◎** | 下記 1.5 参照 |

### 1.1 データモデル（§4.1・CHANGE-087 §2） — ◎

- `migrations/000042_create_combo_setup_results.up.sql` は **CREATE TABLE 1 本のみ**。`ALTER TABLE` 0 件（`grep -rnE "ALTER TABLE (setups|combo_setups|setup_steps)" migrations/` → 0）。down は `DROP TABLE IF EXISTS` のみ。
- 列 6 本（`combo_id` / `setup_id` / `tech_type` / `in_corner` / `result` / `note`）、**PK 4 列複合**、**`combo_setups` への複合 FK ＋ ON UPDATE/ON DELETE CASCADE**。`internal/infra/migration/migrate_m1903_test.go` が列数 6・PK 列数 4・nullable が `note` の 1 本のみ・`pragma_foreign_key_list` で `on_update='CASCADE' AND on_delete='CASCADE'` の列対応 2・`combo_setups` の列数が 2 のまま（＝既存表への ALTER なし）まで機械検証している。
- **timestamps／検証日時の列を先回りしていない**ことを `created_at` / `updated_at` / `verified_at` / `checked_at` の不在アサートで担保。
- `tech_type` は `model.OkiTechTypeNeutral` / `OkiTechTypeBack` を再利用（第 3 の語彙なし）、`result` は `ok` / `ng` の文字列コード値で `BOOLEAN` にしていない。`in_corner` に `combos.position` の値を流用していない。
- 連番 000042 は完了報告 §2 に**中央払い出しの事実と disk 実査（末尾 000041・GAP 0）**が併記されており、自採番ではない。`ls migrations/` でも 000042 が最新。
- インデックス追加なし（根拠は完了報告 §4.4 に記載）。妥当。

### 1.2 「未検証」の表現（§4.1.3） — ◎

- `result` は DDL で `NOT NULL`。migrate テストが `pragma_table_info` の `notnull` を直接確認している。
- 「未検証へ戻す」は `DeleteSetupResult`（物理削除）で実装。`SetupResultEditor.cycle` は `next === SETUP_RESULT_UNVERIFIED` のとき `upsert` ではなく `remove` を呼ぶ（`SetupResultEditor.test.tsx:71` が「未検証値で upsert していない」ことまでアサート）。
- FE の `SETUP_RESULT_UNVERIFIED = "unverified"` は画面表現専用。保存経路への漏れは**型でも遮断**されている（`UpsertSetupResultInput.result: "ok" | "ng"`。`cycle` / `saveNote` とも早期 return で narrowing され、`tsc --noEmit` が PASS）。実行時経路の走査でも `web/src` 側で `"unverified"` が API ペイロードに載る箇所は 0。
- 孤児行の担保: 取得は必ず `combo_setups` 経由（`attachSetupResults` が `setups` サマリへ `setup_id` で振り分ける形）＋紐付け解除系 4 関数（`DeleteComboSetup` / `DeleteComboSetupsBySetupID` / `DeleteComboSetupsByComboID` / `...Excluding`）での明示削除。E2E D が「解除 → 再紐付けで復活しない」ところまで見ている。**ただし `PermanentDelete` 経路は未カバー（→ 指摘 M-1）**。

### 1.3 ★識別キー変更編集での参照引き継ぎ（§4.2） — ◎

**製造の主張の妥当性をレビュー側で独立検証した。**

| 主張 | レビューでの検証結果 |
|---|---|
| `db.Open` の `PRAGMA foreign_keys=ON` がプール全体に効いていない | **妥当**。`internal/infra/db/db.go:42` は `conn.Exec(p)`（`conn` は `*sql.DB`）＝プールから 1 本借りて実行するだけ。`foreign_keys` は接続単位の PRAGMA であり、リポジトリ全体で `SetMaxOpenConns` / `SetMaxIdleConns` は**本番コードに 0 件**のため、後から張られる接続は SQLite 既定の FK=OFF になる。`TestUpdateWithKeyChange_CarriesSetupResults_WithForeignKeysOff` が skip せず PASS することからも、生接続の既定が FK=0 であることが裏取りできる（実測 16 本中 7 本という具体値までは検証できないが、構造的主張は成立）|
| 親キーが実際に UPDATE される（＝ON UPDATE CASCADE が有効な形） | **妥当**。本表の FK 親は `combos` ではなく `combo_setups` であり、`combo_setups.combo_id` は `repository.go:908 UpdateSetupReferences` が `UPDATE combo_setups SET combo_id = ? WHERE combo_id = ?` でその場更新する。チェックリスト 1.3 の「DELETE＋INSERT なら効かない」という条件には該当しない |
| ON UPDATE CASCADE が無いとキー変更編集自体が落ちる | **妥当**。FK=ON 接続では結果行が 1 行でもあると親キー UPDATE が FK 違反になる |
| 呼び出し順（`UpdateSetupReferences` の**後**）が正しい | **正しい**。`service.go:640` で 3（`combo_setups` 付け替え）の**直後**・4（punish 再ポイント）の**前**。先に子を動かすと FK=ON 下で移動先 `(新 combo_id, setup_id)` が未作成で FK 違反になるため、後置が唯一正しい。`individual` は `DeleteComboSetupsByComboIDExcluding`（解除分の結果行を明示削除）→ `UpdateSetupReferences` → `MoveSetupResultReferences` の順で、解除された組の結果行が孤児のまま新 `combo_id` へ移る事故が起きない。`unlink_all` は結果行が先に消えているため no-op |
| 同一トランザクション | **正しい**（`service.go:540 BeginTx` 〜 `682 Commit` の内側） |
| 既存の流儀に合わせている | **正しい**。`MovePunishReferences`（M18-03b）と同型の 1 文 UPDATE |
| 回帰テストが穴を塞げている | **塞げている**。`setup_results_carry_test.go` が 既定 / `carry_all` / `individual` / `unlink_all` / 原子性 / **FK=OFF 生接続** / PATCH では動かない、の 7 経路をカバー。FK=OFF ケースは明示再ポイントを外すと必ず 0 行になり落ちる（論理的に確認）。`note` と `result` の内容不変、`combo_setups` 側も同時に移っている（片肺でない）ところまで見ている |

### 1.4 API（§4.3） — ◎

- 取得方式は (a) コンボ詳細への同梱。根拠（項目10 は開いた時点で全セットプレイ分を描くため専用 GET だと N+1）が完了報告 §4.3 に記載。
- **N+1 でないことを回数アサートで機械検証**（`setup_results_embed_test.go:68` が `calls != 1` で失敗）。設計意図がテストに落ちている良い形。
- `SetupSummary.Results` は `omitempty` の追加のみ。後方互換テストが raw JSON map で既存 7 キーの存在と `id`/`defaultRecipe` の型不変、`results` 要素に `comboId` が出ないこと、`note` 未設定でキーが出ないことまで確認。
- 更新は `ON CONFLICT ... DO UPDATE` の upsert、削除は冪等。値域外は 400（`ErrInvalidResultValue`）、紐付け不在は 404（`ErrSetupLinkNotFound`）＝**API 層の多層防御あり**。E2E G が実経路で 400/400/404 を確認。
- 取得失敗は非ブロッキング（`attachSetupResults` が warn ログのみで詳細は 200）。FR305 の流儀と整合。

### 1.5 画面：コンボ詳細 項目10（§4.4） — ○

- 編集導線は `SetupAccordionItem`（項目10 の実体）にのみ存在。`web/src/pages/ComboDetailPage.tsx` が `comboId` を渡す唯一の呼び出し元で、`comboId` 未指定なら表示も編集導線も出ない防御が入っている。セットプレイ編集画面（`/setups/:id`）には無いことを E2E F と `grep -rnE "SetupResult" web/src/pages/SetupEditorPage.tsx ...` → 0 で二重確認。
- 2×2 グリッドは `Check` / `X` / `Minus`（lucide-react）＝**記号直書きでなくアイコン**、`aria-label` は i18n 解決。凡例あり。集計は出していない。全 4 セル未検証なら `SetupResultGrid` が `null` を返す（hidden-when-empty）。
- 行クリック遷移は**別 div**（`role="button"` の見出し行）に付いており、グリッド・エディタは兄弟要素なので誤遷移は構造的に起きない。編集導線は別ボタン（`data-testid="setup-result-edit-toggle"`）で `aria-expanded` 付き。既存の「紐付け解除」ボタンと並置するだけで面の再設計はしていない（E-20 の 1 本動線を守っている）。
- **△ 点**: `note` の再編集がセルの巡回トグルと不可分（→ 指摘 M-2）。

### 1.6 画面：提案の採用ダイアログ 項目12（§4.5） — ◎

- 2×2 チェック、既定は全て未チェック、未チェックでも採用可、チェック分のみ `verifiedConditions` に載る、`ng` を選ぶ UI も `note` 入力も無い（fieldset 内の input が checkbox 4 個のみであることをテストがアサート）、やり直しで初期化。
- 保存は `CreateSetup` / `CreateSetupInTx` の**同一 Tx 内・`InsertComboSetup` の後**（`service.go:180` / `:247`）。紐付け前に結果行を書かない要件を満たす。
- M19-02 delivered 契約（名前の自動生成 `t("setplay.adoptNameFormat")`・編集可・提案の非永続・gap モード・打ち切り・制約告知）は**変更されていない**。既存 setplay テスト 19 件と E2E 8 本が PASS。

### 1.7 語彙・i18n（§4.6） — ○

- 受け身種別は `web/src/constants/oki.ts` の `OKI_TECH_TYPES` / `OKI_TECH_TYPE_LABELS` を import して再利用。第 3 の語彙なし。BE も `model.OkiTechType*` を再利用。
- 画面端の 2 語は新規 i18n キー `setupResult.corner.inCorner` / `.midScreen`＝「相手が画面端」／「画面中央」。`combos.position` の既存ラベル（画面中央／自分画面端／相手画面端…）と表記が揃っており矛盾しない。
- **BE で日本語固定文字列を組んでいない**（保存されるのはコード値のみ。`setups.name` の既知課題を踏襲していない）。
- 追加 i18n キーは ja/en 同数・同構造で `locales.test.ts` が PASS。
- **△ 点**: `OKI_TECH_TYPE_LABELS` が日本語固定のため EN ロケールでも受け身ラベルが日本語表示になる（→ 指摘 L-2）。既存挙動と同一であり指示書の「第 3 の語彙を作らない」を優先した判断自体は妥当だが、完了報告 §5.3 の「ja/en parity」表記は「新規追加キーについて」の限定であることが読み取りにくい。

### 2. データ・API 契約・スキーマ（非破壊性） — ◎

- 既存テーブルのスキーマ不変（migrate テストで `combo_setups` の列数 2 を確認、`ALTER TABLE` 0 件）。
- **`moves` 系ファイルの変更 0 本**、punish 系ファイルの変更 0 本（`git diff --name-only` で確認）。
- `setup_tags` 等の別表なし、`setups` への成立条件列なし。
- `selectedIds` 未使用、提案結果の非永続維持、DES-006 に VAL 追加なし（`internal/service/validation/` に一切差分なし）。

### 3. テストの妥当性 — ◎

- Go 新規テスト**トップレベル 42 本**（`grep -c "^func Test"` で 3/9/6/9/11/4 を実測。完了報告の記載と一致）。§5.1 の 9 観点はすべて対応があり、**#7（識別キー変更編集）は 7 経路**でカバー。
- Vitest **全体 118 files / 883 tests PASS**（レビュー側で再実行して確認）。完了報告の数値と一致。
- E2E は A/B/B2/C/D/E/F/G の 8 本。§5.4 の A〜E に加え F（編集画面に UI が無いことの否定形）と G（多層防御の実経路）を自主追加しており、要求を上回る。
- マイグレ up/down/再 up の往復をテスト。
- §5.6 否定形 5 件を走査コマンド＋ヒット件数で報告。レビュー側で #3（`result` の NULL・"unverified"）と #4'（既存表への ALTER）を再走査し 0 件を確認。
- `go build ./...` / `go vet ./...` / 該当パッケージの `go test` すべて PASS（レビュー側で実行）。

### 4. 設計意図との整合 — ◎

- 記録は「コンボ × セットプレイの組」に紐づく（PK・FK とも組単位）。`setups` 単体の属性にしていない。
- 「未検証」と「不成立」が行の有無で明確に区別できる。
- 提案ロジックは本記録を読んでいない（`internal/service/setplay/` に差分なし）。
- 面を再設計していない（既存構造への追加のみ。既存要素の移動・削除なし）。
- スコープ外（一覧の絞り込み・提案への反映・検証日時・`moves` 系）に手を出していない。

### 5〜7. コード品質・既存挙動の温存・ドキュメント — ○

- 命名・配置は既存規約に整合（`setup` ドメイン配下、`Move*References` の既存命名に追従）。判断根拠は完了報告 §4.4 に列挙。
- 項目10 の既存仕様（常時展開・行クリックで遷移・紐付け解除）は不変で、Vitest に「成立条件を足しても既存挙動は不変」の明示ケースがある。
- 完了報告は §3.3 実査 6 項目・連番の中央払い出し・§4.1.3/§4.2/§4.3.1 の方式と根拠・否定形走査・既知の制約・実 UI 確認をすべて記載。DES 本体は編集していない（`docs/design/` に差分 0）。
- **△ 点**: §9.4 の記述精度（→ 指摘 M-3）、指示書本体への追記（→ 質問 Q-2）。

---

## 設計準拠性以外の指摘事項

### M-1（中）`PermanentDelete`（ゴミ箱からの完全削除）だけ明示削除の対象外

`internal/service/combo/service.go:757 PermanentDelete` → `repository.go:793 HardDelete` は `DELETE FROM combos WHERE id = ?` のみで、`combo_setups` / `combo_setup_results` の明示削除を行っていない。FK=ON の接続では `combos` → `combo_setups` → `combo_setup_results` の 2 段 CASCADE が効くが、**製造自身が「FK=ON はプール全体では保証されない」と結論づけた前提に立つと、この経路だけ CASCADE 依存のまま残っている**。他 4 経路（`DeleteComboSetup` / `...BySetupID` / `...ByComboID` / `...Excluding`）には明示削除を入れているので、方針が一貫していない。

- 実害の大きさ: `combos.id` は `AUTOINCREMENT`（`migrations/000001_init_schema.up.sql:59`）で id が再利用されないため、**孤児行が別コンボの成立条件として誤表示されることはない**。残るのは不可視のゴミ行のみ。
- したがってブロッカーではないが、§4.1.3 の「孤児行が『未検証でない状態』として残らないこと」の担保としては穴があり、テストも無い。
- 対応案: (i) `PermanentDelete` の Tx 内で `combo_setup_results` → `combo_setups` を明示削除する、または (ii) 完了報告 §9-1 の followup（`db.Open` の PRAGMA 根治）に「`PermanentDelete` の CASCADE 依存」も含めて起票する。**(ii) で十分**と考える。

### M-2（中）既存 `ok` セルの note を「`ok` のまま」編集できない／巡回で note が失われる

`SetupResultEditor` はセルの選択と状態遷移が同一の `onClick` に束ねられている（`setSelected(...)` と `cycle(...)` を必ず両方呼ぶ）。このため:

- 新規セル（未検証）に note を付けるのは可能（1 クリックで `ok` になり note 欄が開く）。
- **既に `ok` のセルの note を直したい場合、クリックすると必ず `ng` へ落ちる。** `ok` へ戻すにはさらに 2 クリック必要で、その途中の `unverified` で**行が物理削除され note も消える**。
- テスト `SetupResultEditor.test.tsx:139`「★成立(ok)のセルにも note を書ける」も、コメントで「ok のセルを選択すると ng へ遷移するが、note 欄は開く」と自認しており、`results` prop がモックで更新されないためテスト上は `result: "ok"` で保存されるが、実運用では refetch 後の状態（`ng`）で保存される。

指示書 §4.4.3「`note` はセル単位。**選択中のセル**に対して入力欄を開く」は「選択」と「状態変更」を別操作として想定していると読める。チェックリスト §9 では「3 状態の操作形式」「note 入力欄の出し方」は軽微扱いだが、**既存 note の消失を伴う**点で単なる見た目の問題を超えている。

- 対応案: セルの「選択」（note 欄を開く）と「巡回トグル」を分離する（例: セルクリック＝選択、別の小ボタンまたは長押し/右クリック＝巡回。あるいは選択セルに 3 択のラジオ/セグメントを出す）。既存テストの `data-testid` は維持できる。

### M-3（中）E2E C の識別キー変更が「実 UI 操作」ではない

`web/e2e/m19-03-setup-results.spec.ts` のシナリオ C は、識別キー変更を `page.request.put("/api/combos/:id")` の API 直叩きで行っている（画面での確認は変更後の詳細ページのみ）。完了報告 §10 の表は「**識別キー変更編集を実操作して**引き継がれる」と記載しており、指示書 §9.4／M17-E11 の「実 UI 経由」という要求に対して表現が過大。

- 実害: 引き継ぎ自体は Go テスト 7 経路＋E2E で十分に担保されているため機能面のリスクは低い。ただし **コンボ編集画面の「セットプレイ引き継ぎ」ダイアログ（`setupCarryOptions` を選ぶ UI）を通した経路が一度も実 UI で通っていない**ため、UI が `carry_all` 以外を送るケースの回帰は見ていない。
- 対応案: 完了報告の表現を「API 経由で識別キー変更を起こし、引き継ぎ結果を UI で確認」に正す。UI からのキー変更まで E2E に含めるかは M20 以降で可。

### L-1（低）FE の `"ok" | "ng"` リテラル直書き（CLAUDE.md §4 の列挙同期）

`web/src/features/setup/types.ts:34` / `:51` が `result: "ok" | "ng"` を直書きしており、同じ意味の `SetupResultValue`（`web/src/constants/setup-result.ts:18`）を使っていない。CLAUDE.md §4 TypeScript「バックエンド列挙定数との同期」「リテラル文字列の散在を防ぐ」の機械チェック（`grep -rn '"ok"' web/src/ --include='*.ts' | grep -v constants/`）に引っかかる。`SetupResultValue` を import すれば解消する（`constants/setup-result.ts` は `features/setup/types.ts` を import していないので循環はしない）。

### L-2（低）EN ロケールで受け身種別ラベルが日本語のまま

`OKI_TECH_TYPE_LABELS` が日本語固定であるため、EN UI でも「その場受け身／後ろ受け身」が出る。完了報告 §8-5 に既知の制約として明記され followup 候補として送られており、指示書 §4.6 の「第 3 の語彙を作らない」を優先した判断は妥当。ただし完了報告 §5.3 表の「**ja/en parity**」は新規追加キーに限った話なので、画面上の parity は未達である旨を並記したほうが後続に伝わる。

### L-3（低）`requireComboSetupLink` が Tx 外の事前チェック（TOCTOU）

`internal/service/setup/setup_results.go:70` / `:107` は `BeginTx` の**前**に `ComboSetupExists`（非 Tx 読取）で紐付けを確認している。チェックと upsert の間に紐付けが解除されると、FK=ON なら FK 違反で 500、**FK=OFF なら孤児行が書ける**。製造自身の「FK は接続によって効かない」という前提に立つと、多層防御の 1 層目が Tx 外にあるのは弱い。

- 対応案: `ComboSetupExists` を Tx 内で行う、または upsert を `INSERT ... SELECT ... WHERE EXISTS (SELECT 1 FROM combo_setups WHERE ...)` にして 1 文で原子的にする。単一ユーザー向けデスクトップアプリという性質上、実際の発生確率は極めて低い。

### L-4（低）`UpsertSetupResult` の note が常時上書き（PATCH セマンティクスでない）

`ON CONFLICT ... DO UPDATE SET result = excluded.result, note = excluded.note` のため、`note` を省略した PUT は既存 note を NULL で潰す。FE は `cycle` で既存 note を明示的に渡して保護しているので現状の実害は無いが、**API 契約としてはこの上書き挙動が DTO コメントにもハンドラ godoc にも書かれていない**。PUT なので全置換セマンティクスは筋が通っているが、一言明記しておくと後続（一覧の絞り込みサブ、外部からの利用）で事故りにくい。

---

## 推奨修正（優先度別）

- **高（M19 完了前に修正必須）**: **なし。** チェックリスト §8 の重大問題判定基準に該当する事象は 1 件も検出されなかった。最重要ゲート 4 点はすべて充足している。
- **中（M20 着手と並行可）**:
  - **M-2** `SetupResultEditor` のセル選択と巡回トグルを分離し、既存 `ok` セルの note を `ok` のまま編集できるようにする（巡回で note が失われる導線の解消）。
  - **M-1** `PermanentDelete` の CASCADE 依存を、完了報告 §9-1 の followup（`db.Open` の PRAGMA プール問題）に**明示的に含めて起票**する。コード修正まで踏み込むなら `PermanentDelete` の Tx 内で `combo_setup_results` → `combo_setups` を明示削除する。
  - **M-3** 完了報告 §10 の「識別キー変更編集を実操作して」を実態（API 経由でキー変更・UI で結果確認）に合わせて修正する。
- **低（将来対応）**:
  - **L-1** `web/src/features/setup/types.ts` の `"ok" | "ng"` を `SetupResultValue` に置換（CLAUDE.md §4 の列挙同期）。
  - **L-3** `requireComboSetupLink` を Tx 内へ移す（または upsert を `WHERE EXISTS` の 1 文にする）。
  - **L-4** `PUT .../results` が note を全置換する契約であることを DTO コメントに明記。
  - **L-2** `OKI_TECH_TYPE_LABELS` の i18n 化（M16-03 の正典に触れるため独立サブ）。完了報告 §5.3 の「ja/en parity」表記に限定条件を併記。

### 質問・確認事項

- **Q-1**（指示書 §11-2）項目10 の情報密度について、開発者確認事項として「折りたたむ／そのまま出す」が挙げられていたが、完了報告に**開発者確認の結果が記載されていない**。実装は暫定案どおり「そのまま出す（hidden-when-empty）＋編集はトグル展開」になっており妥当だが、確認済みか暫定案の採用かを明記しておきたい。なお §11-1（端の語彙）は §3.3-6 に「開発者確定＝『相手が画面端』／『画面中央』」と記載があり解決済み。
- **Q-2**（CLAUDE.md §8）製造担当が**指示書本体**（`docs/instructions/M19-03-setplay-condition-record.md` のヘッダ表と §9.1-3）を編集している。内容は中央からの申し送りの転記＋払い出し済み連番の記録で妥当であり、完了報告 §2 に経緯も残っているが、指示書は指示書担当の成果物であるため、製造側からの追記が運用上許容されるのか（あるいは完了報告側にのみ書くべきか）を明確化しておきたい。
- **不明: 「実測 16 接続中 7 本が `foreign_keys=OFF`」という具体値は、プローブスクリプトが残っていないためレビュー側で再現できない。** ただし構造的主張（`*sql.DB.Exec` による PRAGMA は 1 接続にしか適用されない・プール上限が未設定・生接続の既定が FK=0）はすべて独立に確認でき、結論に影響しない。

---

## 良かった点

1. **§3.3-1 の実査が「指示書の想定にない第 3 の形」を掘り当てている。** 指示書は (a) 明示再ポイント / (b) ON UPDATE CASCADE の二択を提示していたが、実査で「識別キー変更は UPDATE でも DELETE＋INSERT でもなく、旧を論理削除して新を INSERT する形」「本表の FK 親は `combos` ではなく `combo_setups`」「親キーはその場で UPDATE される」まで確定させ、**両方が必要という結論に至る過程が完了報告・コードコメント・マイグレコメントの 3 箇所で一貫**している。§9.3 の「独断で ON UPDATE CASCADE を付けて済ませない」を正面から守っている。
2. **`PRAGMA foreign_keys=ON` がプール全体に効いていないという既存の作りを発見し、自分の範囲だけ塞いだうえで根治を範囲外として申し送っている。** 全体影響のある根治に手を出さず、かつ「見つけたが黙っている」でもない。判断の切り分けが適切。
3. **回帰テストがミューテーションで裏取りされている。** `TestUpdateWithKeyChange_CarriesSetupResults_WithForeignKeysOff` は PRAGMA 非適用の生接続を使い、明示再ポイントを外すと必ず落ちる形になっている。「テストがあるが実は何も守っていない」を避けている。
4. **設計意図を機械アサートに落としている箇所が多い。** N+1 を呼び出し回数で、後方互換を raw JSON map の既存キー・型で、「未検証を値で表していない」を `pragma_table_info` の `notnull` で、「不成立を選べない」を fieldset 内の input 種別数で——いずれも「読めば分かる」で済ませず失敗させられる形にしている。
5. **否定形（§5.6）を走査コマンドとヒット件数で報告し、E2E にも「無いこと」のシナリオ F を自主追加している。** 指示書が求める A〜E に対し F・G・B2 を足しており、要求を上回る。
6. **既存挙動の温存を明示テストで固定している。** 「成立条件を足しても行クリック遷移・紐付け解除は不変」「編集導線は遷移を誘発しない（`mockNavigate` 未呼出）」を新規テスト内に置いており、E-20 の 1 本動線への配慮が形になっている。
7. **`comboId` 未指定なら成立条件 UI を一切出さないというガードを FE 側に持たせている。** §4.4.1 の「`comboId` を持たない画面に置けない」という制約が、レビュー時の目視ではなくコンポーネントの契約として表現されている。

---

## 制約事項

- 本レビューはコード上で判定可能な範囲のみ対象。実際の動作確認・パフォーマンス・実機テストは別途実施が必要。
- E2E（Playwright）はレビュー側では実行していない。完了報告の 8/8 PASS・非回帰 60 passed / 1 flaky / 1 failed（`m18-03a C`）は、spec の内容と `web/src` への文言走査（「変換機能は M18-03b で対応予定です。」が spec にのみ存在し `web/src` に 0 ヒット）から**主張の整合性は確認**したが、実行結果そのものは未再現。
- 「実測 16 接続中 7 本が FK=OFF」の具体値は再現していない（上記 Q 節参照）。
- 本レビューではコードを一切変更しておらず、Git の書き込み操作も行っていない。作成したファイルは本報告書のみ。

---

*以上、M19-03 レビュー報告書。配置 `docs/progress/m19-03-review.md`。*

---

## 取り込み結果（自動トリアージ）

**実施**: 2026-07-28（`/implement_plan_full` Phase C）。レビュー報告書の指摘を製造側で自動トリアージし、採否と理由を以下に記録する。
**優先度「高」の指摘は 0 件**のため、開発者へのエスカレーション事由（重大指摘の棄却）は発生していない。

### 中

| # | 指摘 | 採否 | 理由・対応 |
|---|---|---|---|
| **M-2** | `SetupResultEditor` のセル選択と巡回トグルが不可分で、既存 `ok` セルの note を `ok` のまま編集できない（巡回すると `unverified` を経由して行ごと消え note が失われる） | **採用** | **実質的な仕様ギャップ**と判断した。チェックリスト §1.5 は「`note` がセル単位で入力でき、**成立のセルにも書ける**」を要求しており、現状は「未検証 → 成立」の遷移直後にしか成立セルへ書けなかった。検証済みセルに**状態を変えない note 専用の導線**（`setup-result-note-open-<key>`）を追加し、巡回トグルは従来どおり残した（§4.4.3 の「未検証 → 成立 → 不成立 → 未検証」の巡回表記を壊さないため）。テスト 3 本追加（ok のまま note 更新／ng のまま note 更新／未検証セルには導線を出さない）。i18n は ja/en 同時追加。 |
| **M-1** | `PermanentDelete`（`HardDelete`）経路だけ「FK に依存しない明示削除」が未適用 | **採用**（コード修正まで実施） | 指摘どおり不可視ゴミに留まる軽微事象だが、**他経路と方針を揃える方が一貫性が高く修正も 6 行**のため、followup 送りではなくその場で直した。`HardDelete` の Tx 内で `combo_setup_results` → `combo_setups` を明示削除する。回帰テスト 1 本追加。 |
| **M-3** | 完了報告 §10 の「識別キー変更編集を実操作して」が実態（API 経由でキー変更・UI で結果確認）と乖離 | **採用** | 報告の正確性に関わるため completion report §10 の表現を実態に合わせて修正した。 |

### 低

| # | 指摘 | 採否 | 理由・対応 |
|---|---|---|---|
| **L-1** | `types.ts` の `"ok" \| "ng"` を `SetupResultValue` に置換 | **採用** | CLAUDE.md §4 の明文ルール（リテラル文字列を散在させない）。`SetupResultCell.result` と `UpsertSetupResultInput.result` を定数由来の型へ変更。 |
| **L-3** | `requireComboSetupLink` を Tx 内へ移す | **採用** | 複合 FK が防ぐ想定だが、**本サブの前提そのものが「FK=OFF の接続が混在する」**であり、FK に依存しない多層防御という設計意図と整合しない。`ComboSetupExistsTx` を追加し、upsert / delete の両方で確認を Tx 内へ移した。回帰テスト 1 本追加。 |
| **L-4** | `PUT .../results` が note を全置換する契約であることを明記 | **採用** | API DTO（`UpsertSetupResultRequest`）とサービス（`UpsertResult`）の godoc に明記した。 |
| **L-2** | `OKI_TECH_TYPE_LABELS` の i18n 化 | **不採用（followup へ送る）** | 指摘のとおり **M16-03 の正典（起き攻めラベルの単一 SSOT）に手が入る**ため、本サブのスコープ外。指示書 §4.6 は「第 3 の語彙を作らない」＝既存 SSOT の再利用を要求しており、実装はそれに従っている。完了報告 §8-5 に既知の制約として記載済みで、**§9 の followup 候補にも明記**した。あわせて §5.3 の「ja/en parity」に「新規追加キーが対象。受け身ラベルは既存 SSOT 由来で ja 固定」という限定条件を併記した（L-2 の後段）。 |

### 質問への回答

| # | 質問 | 回答（完了報告にも反映） |
|---|---|---|
| **Q-1** | 項目10 の情報密度（折りたたむ／そのまま出す）が開発者確認済みか暫定案か | **開発者確認済み**。本セッション着手前に指示書 §11 の 2 点を開発者へ確認し、**「そのまま出す（推奨）」を選択いただいた**。§11-1 の端の語彙も同時に「相手が画面端／画面中央」で確定している。完了報告 §3.3-6 に §11-1 のみ記載していたため、**§11-2 の確定も明記するよう追記**した。 |
| **Q-2** | 製造担当が指示書本体を編集した運用上の可否 | **開発者からの明示指示による**。マイグレ連番の払い出し時に中央から「製造への申し送り（指示書に入れてください）」として文面が示され、開発者経由で指示書への反映を求められたため転記した。完了報告 §2 にその経緯を記載済みだが、**指示書側にも出典が分かるよう「中央からの申し送り（2026-07-28）」と明示**してある。今後の運用ルール自体（製造が指示書へ追記してよいか）は**開発者判断を仰ぎたい事項**として §9 に追加した。 |
| **不明** | 「16 接続中 7 本が FK=OFF」がプローブ未保存で再現できない | **妥当な指摘として受け止め、完了報告に注記を追加**した。具体値は一度きりの計測であり、恒久的に担保しているのは構造的主張の方（`*sql.DB.Exec` の PRAGMA は 1 接続にしか適用されない／プール上限が未設定／生接続の既定が FK=0）である。**再現可能な形で残しているのは回帰テスト `TestUpdateWithKeyChange_CarriesSetupResults_WithForeignKeysOff`** で、PRAGMA 非適用の生接続を使い、明示再ポイントを外すと必ず落ちる（ミューテーション確認済み）。 |

### 取り込み後の再検証

| 項目 | 結果 |
|---|---|
| `go build` / `go vet` / `gofmt` | PASS / 0 件 |
| `go test ./...` | 全パッケージ PASS（新規 Go テストは M-1／L-3 の回帰追加で 56 → 58 件） |
| `pnpm vitest run` | **885 tests / 118 files PASS**（M-2 のテスト拡充で 883 → 885） |
| `tsc --noEmit`（lint） | PASS |
| E2E `m19-03-setup-results.spec.ts` | **8/8 PASS**（連続 2 回とも flake なし） |
| E2E M19-01／M19-02 非回帰 | PASS |

### 取り込み中に追加で発見・修正した不具合（レビュー指摘外）

- **成立条件の連続編集で画面が 1 手前の状態で止まることがある**（E2E A が flaky 化して発覚）。`useSetupResultMutations` が `invalidateQueries` を **await していなかった**ため、連続操作時に次の無効化が「まだ飛んでいる前回の GET」へ dedupe され、その GET が次の PUT より前の状態を返して確定してしまう（追加の再取得も走らないので自然回復しない）。
  - **修正**: `onSuccess` から invalidate の Promise を返すようにし、再取得完了まで `isPending` を維持（＝ボタンが disabled のまま）して操作を直列化した。あわせて `ComboDetailPage` 側の重複 `refetch()` を削除（同一キーの GET が二重に飛んでいた）。
  - 修正後、E2E A は連続 2 回とも安定して PASS。
