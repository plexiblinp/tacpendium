# M24-13 レビュー報告書（2 回目・再レビュー）

| 項目 | 内容 |
|------|------|
| 対象指示書 | `M24-13-draft-requires-recipe-step.md` **v1.1.0**（設計卓の未コミット版を正本として読んだ） |
| チェックリスト | `M24-13-review-checklist.md` **v1.1.0** |
| 対象範囲 | **主眼＝`eb234c2..5ebb5e0`**（取り込み差分。13 ファイル / +417 -35）／ 回帰確認として `11bcb6a..5ebb5e0`（53 ファイル / +2336 -116） |
| レビュー実施日 | 2026-08-29 |
| 判定 | **重大 0 件 / 高 1 件 / 中 1 件 / 低 6 件** |
| 往復 | **2 回目**（`CLAUDE.md` §9・チェックリスト §11＝往復上限 2 回。**本回で上限に達する**） |

---

## 0. 1 回目の指摘 12 件の取り込み結果の検証

**★本節が本回の主眼である。取り込み差分（`eb234c2..5ebb5e0`）は 1 回目のレビュー対象外であり、誰も見ていない。**

| # | 1 回目の指摘 | 判定 | 検証の根拠（本レビューの実測） |
|---|---|---|---|
| **高-1** | `progress-log.md` に索引行が無い／完了報告が「追記した」「検査は違反なし」と書いている | **解消** | `docs/progress/progress-log.md:5111` に `### M24-13: …（2026-08-29）` の索引行あり。**本レビューで `bash scripts/check-progress-log-index.sh` を実行し「検査した 64 件すべてが progress-log に現れる／結果: 違反なし」を確認**。完了報告 §10 は「初版は回していないのに『違反なし』と書いた」ことを**消さずに残して**是正しており、対応の形も適切 |
| **高-2** | 失効コメントが E2E に 4 か所残存 | **部分的（新たな問題）** | 4 か所は as-built へ直っており、直した先の記述も実物と一致する（`combo-crud:25/89`・`m12-03:48`・`m17-01:25/93` がいずれも `addMinimalRecipeStep` を呼ぶ）。**★しかし取り込み記録の「`grep` で残存 0 を確認した」は成立していない**——**利用者に見えるラベル**が失効したまま残っている（**高-A**） |
| **高-3** | 対照 assert が空振り（`body.warnings` は VAL-C14 専用欄） | **解消** | `toComboResponse`（`internal/api/combo/dto.go:519`）は `len(validations.Issues) > 0` のときだけ `resp.Validations` を入れ、`json:"validations,omitempty"`（`:243`）でキーごと落ちる。`Create` ハンドラは 201 経路で `toComboResponse(combo, &result)` を呼ぶ（`handler.go:76`）。**⇒ WARNING が 1 本でも出れば `body.validations` は定義され、新 assert は赤くなる。空振りは解消している**（詳細は §1-6-4） |
| **中-1** | `REQ-001` FR305 の失効が §8 の一覧から漏れている | **解消** | 完了報告 §8 に `#6` として追加。`git diff --name-only 11bcb6a 5ebb5e0 -- docs/design/` は **0 件**で `REQ-001` は編集されていない（7-4 のとおり正しい結末）。**★表の行番号が `#1..#4, #6, #5` の順に乱れている点だけ 低-E** |
| **中-2** | 同梱セットプレイの 201→400 が CHANGE 判定・申し送りに無い | **解消** | §7.4.1 #1 に「応答が変わる経路 2 本」(a)(b) と「CSV 取込へ波及しない」根拠（`import.go:274` が `CreateSetup` を 1 本ずつコミット）が追記されている。本レビューでも `import.go:274` が `s.setupSvc.CreateSetup` であることを確認 |
| **中-3** | BE の `field` 書式の裏取りが E2E から消えた | **部分的** | `TestIssueFieldFormat_RecipeSideUsesIndexedPrefix` は追加され、**実サーバ側の `field` を実際に生成して**観測している（同じ文字列を両側でハードコードしているだけには戻っていない）。**★ただし押さえたのは `VAL-C08`＝WARNING であり、フロントの振り分けが実際に消費するのは severity=error だけである**（**中-A**） |
| **中-4** | 本番配線がアダプタを挟むことを固定する観測が無い | **解消（対応形態の変更）** | コード変更なし。完了報告 §11-6 へ申し送りとして格上げ。**理由（`M24-11` の `combo` 側も同構造であり片側だけ直すと非対称）は妥当**であり、1 回目の指摘が示した 2 案のうち後者を選んだ形として整合している |
| **低-1** | 完了報告 §2.2 の事実誤り | **解消** | 是正後の記述（`validateC03StarterMatchesStep1` / `validateC05SARange` は `_ = isDraft`、`validateC04DriveRange` は空ブロック）を `internal/service/validation/combo.go:212 / :239-242 / :253` で実物照合。**「`grep "_ = isDraft"` では 1 件足りない」まで書いた**のは良い |
| **低-2** | `slog.WarnContext` が `context.Background()` | **解消** | `txScopedValidDeps(ctx context.Context, tx *sql.Tx)` へ。**呼出元は 3 か所（`service.go:246` / `:321` / `:494`）で全数**であり、**いずれも自メソッドの第 1 引数 `ctx` を渡している。取り違え・シャドーイングは 0 件**（`CreateSetup` / `CreateSetupInTx` / `UpdateSetup` の各スコープに `ctx :=` の再束縛もクロージャ引数も無いことを確認） |
| **低-3** | `aria-live` の器が条件付きマウント | **解消** | `ComboEditor.tsx:1062` に `<div role="status" aria-live="polite">` を常設し、`data-testid` は内側の `<p>` に残している。**⇒ `toHaveCount(0)` で理由の不在を見ている観測（`m24-13-draft-requires-recipe.spec.ts:100-102`）は壊れていない。** 器を `getByRole("status")` で掴む spec / コンポーネントテストは ComboEditor 系に 0 件（唯一の `getByRole("status")` は `m23-07:254` でゴミ箱画面かつ `hasText` フィルタ付き）。**★空の器が `space-y-4` に 16px の余白を足す点のみ 低-D** |
| **低-4** | `m24-04` の import が 1 行 202 文字 | **解消** | 複数行へ復元（`m24-04-editor-input-safety.spec.ts:4-14`） |
| **低-5** | `FindDuplicateInCombo` の制約が godoc にしか無い | **解消** | `internal/repository/setup/repository.go:137-141` のインタフェース側 godoc へ「書き込みトランザクションの内側からは呼ばないこと」と、tx なし版が正当な経路（保存前チェック・提案の採択判定）を明記 |

**⇒ 12 件中 10 件が解消、2 件が部分的。不採用 0 件・エスカレーション 0 件という自己申告は事実と一致する。新たに混入した欠陥は「取り込みそのものの誤り」ではなく、「取り込み時に打ったと主張した `grep` が全数でなかった」型が 1 件（高-A）である。**

---

## 総評

取り込みは**丁寧である**。とくに 高-1 の是正の形——「回していない検査を『違反なし』と書いた」という事実を**消さずに §10 と progress-log 横断課題 8 へ残した**——は、次に同じ報告書テンプレートを引き継ぐ担当にとって最も価値が高い。低-2 の `ctx` は 3 呼出元すべてが正しく、低-3 は「器に test-id を付けない」という**壊してはいけない観測を先に特定してから**直しており、いずれも指摘の趣旨を取り違えていない。高-3 の差し替えは静的に追って**本当に赤くなる筋**であることを確認した（`toComboResponse` が `Issues` 0 件のときだけ `Validations` を出さない ⇒ WARNING が 1 本でも出れば定義される）。製造の「`starterMoveId` を足して `VAL-C03` を故意に発火させ、赤くなることを実測した」という主張は、コード上そのとおりに成立する。

回帰も落ちていない。`VAL-D02` の生存（技未指定 1 本・非技ステップ 1 本）、`len(steps)` だけで数えていること、保存ボタンを消していないこと、`disabled` がタブにも `isDraft` にも依存しないこと、`VAL-S04` が `r.runner(tx)` で**候補も steps も**同じ tx から読むこと、`M24-12` の E2E spec が 1 バイトも動いていないこと——すべて再確認した。`go test ./... -count=1` は **55 パッケージ ok / FAIL 0**、`pnpm exec vitest run` は **198 files / 2166 tests passed** で、完了報告 §1 の完了後の値と**一致する**。検査 9 本もすべて緑であり、1 回目に唯一赤だった `check-progress-log-index.sh` も違反なしになった。

一方で、**1 回目のレビューが見落とし、取り込みも「残存 0」と誤って断定した失効記述が 1 件残っている**。`ComboDraftToggleField` のラベル「**仮登録として保存（レシピ未入力や重複コンボの登録等を許容）**」がそれで、これは**コメントではなく利用者に見える文字列**である。同じ画面の下では保存ボタンが `disabled` になり「レシピを 1 つ以上入力してください（仮登録でも必要です）。」と出る。**上と下で正反対のことを言っている。** しかもこの旧文字列は**コンポーネントテストと `M24-12` の E2E の 2 本が固定している**ため、後から直そうとすると赤くなる。完了報告 §8 の失効一覧にも §11 の申し送りにも載っていない。

もう 1 件は 中-3 の取り込みが**半分だけ当たっている**ことである。追加された Go テストは `VAL-C08`（WARNING）の `field` を押さえたが、フロントの `countErrorsByTab` は **`severity !== "error"` を捨てる**。⇒ 添字付き前方一致 `steps[` を本番で実際に通るのは `VAL-C12`（ERROR）だけであり、そこは観測されていない。テストのコメントが「本テストが実サーバ側の出力を押さえる**唯一の**観測である」と書いている分、取りこぼしが見えにくい。

**重大 0 件。完了承認を妨げる欠陥は無い。**

---

## 設計準拠性レビュー結果

### 1. 設計・パターンとの照合

| # | 観点 | 評価 | 根拠・所見（**★は本回で新たに実測した箇所**） |
|---|---|---|---|
| **1-1** | 既存の `VAL-C09` を呼んでいるか | **◎** | 取り込み差分は `internal/service/validation/combo.go` に触れていない。判定は `validateC09RecipeNotEmpty` 1 本のままで、呼出元も `ValidateComboForCreate:143` の 1 か所。**★`grep -rn "validateC09RecipeNotEmpty\|CodeC09RecipeNotEmpty" internal/ --include=*.go \| grep -v _test.go` を再実行し、完了報告 §2.1 の 4 行と完全一致することを確認した。** |
| **1-2** | 仮登録でステップ 0 本が ERROR になるか | **◎** | **★`go test ./internal/service/validation/... -run TestC09 -v` を実行——`TestC09_EmptyRecipe_DraftError` を含む 5 本すべて PASS。** |
| **1-3** | `VAL-D02` が生きているか | **◎** | `TestC09_DraftSingleStepWithoutMoveID_OK` **PASS**。取り込みで同テストに入った変更は gofmt によるコメント整形のみで、`steps := []model.ComboStep{{StepOrder: 1, MoveID: nil}}` と assert は無改変（`git diff eb234c2 5ebb5e0` で確認）。 |
| **1-3b** | 非技ステップ 1 本が保存できるか | **◎** | `TestC09_DraftSingleNonMoveStep_OK` **PASS**。E2E fixture の `minimalDraftSteps()` も `modifiers.type = "parry_drive_rush"` のまま（`web/e2e/support/draft-combo.ts:31`）。 |
| **1-4** | 数えているのがステップの本数だけか | **◎** | BE `len(steps)`（`combo.go:328`）／ FE zod `z.array(stepSchema).min(1)`（`schema.ts:81`）／ 画面 `steps.length === 0`（`ComboEditor.tsx:827-828`）。**★取り込みで `ComboEditor.tsx` は理由の置き場だけが変わり、`saveBlockedReason` の式は 1 文字も動いていない。** |
| **1-5 / 7-3** | 適用経路の実査と見込み差 | **○** | §3.2 の 4 経路は不変。**★`grep -rn "ValidateComboForCreate(" internal/ --include=*.go \| grep -v _test.go` を再実行し、非テスト呼出元が `service.go:342 / :638 / :758` の 3 か所であること（`:638` は `false` 直値）を確認。** |
| **1-6** | 本登録の挙動が変わっていないか | **◎** | `TestC09_PublishedSingleStep_NoError` **PASS**。取り込みは本登録側の分岐に触れていない。 |
| **1-7** | `VAL-D01` / `VAL-D03` に触れていないか | **◎** | 差分なし。 |
| **1-8 / 5-5** | `M24-12` の成果 5 点 | **○** | `git diff --name-only eb234c2 5ebb5e0` に `m24-12-editor-rebuild.spec.ts` は現れない。保存ボタンは両タブパネルの外（`ComboEditor.tsx:1075` の flex 行）、`disabled={!canSaveNow}` の条件は `steps.length` のみ。**★新設した `role="status"` の器はタブパネルの外・`ValidationDisplay` の直後であり、タブ構造にも DOM 単一化にも触れていない。** ただし `make e2e` は本レビューでは未実行（制約事項）。 |
| **1-15** | `VAL-S04` が書き込み tx の内側か | **◎** | `CreateSetup` / `CreateSetupInTx` / `UpdateSetup` の 3 か所とも `s.txScopedValidDeps(ctx, tx)` を通す。**★`grep -rn "s.validDeps" internal/service/setup/` で生使用が残るのは `restore.go:122`（VAL-S03＝別判定）と `service.go:210`（アダプタ生成元）だけであることを再確認。** |
| **1-16** | 渡された `*sql.Tx` を**読みにも**使っているか | **◎** | `FindDuplicateInComboTx` が `runner := r.runner(tx)` を候補 SQL と `findStepsBySetupIDRunner(ctx, runner, …)` の**両方**に使う（`repository.go:912 / :937`）。`runner(tx)` は `tx != nil` なら tx を返す（`:250-255`）。**★`*sql.DB` 直読みの残存 0。** |
| **1-17** | 適用面の数え直しと差の報告 | **◎** | **★`grep -rn "ValidateSetupCreate(\|ValidateSetupUpdate(" …` で 3、`grep -rn "\.CreateSetup(\|\.CreateSetupInTx(\|\.UpdateSetup(" …` で 4（`api/setup/handler.go:46` / `:208` / `comboio/import.go:274` / `combo/service.go:384`）を独立に再現。完了報告 §2.9 の「3 / 4」と一致する。** |
| **1-18** | 何を重複とみなすかを変えていないか | **◎** | 取り込みで `repository.go` に入ったのは godoc 5 行のみ（`git diff --numstat` で `5 0`）。SQL・`calcSetupRecipeHashFromSteps`・`excludeSetupID` は無改変。 |
| **1-9** | 実査 11 件と母数 | **○** | 実査 1 / 2 / 5 / 9 は本回で数え直し、いずれも報告値と一致（§5-4 参照）。実査 4 のみ検証不能（制約事項）。 |

### 2. データ・API 契約・スキーマの不変

| # | 観点 | 評価 | 所見 |
|---|---|---|---|
| **2-1** | `DES-002` §4.2 の応答 | **○** | 新エラーコード 0 件。**★1 回目の 中-2 で指摘した「201 → 400 になる 2 経路」が §7.4.1 #1 へ明示された**ため、1 回目の **△** は解消。 |
| **2-2** | `DES-003` のスキーマ | **◎** | **★`git diff --name-only 11bcb6a 5ebb5e0 -- migrations/` が 0 件。** |
| **2-3** | 契約 F-1 | **◎** | **★同コマンドで `internal/service/notation` / `internal/service/preset` も 0 件。** |
| **2-4** | マイグレーション消費 | **◎** | 0 本。最新は `000079`。 |
| **2-5** | 既存データを書き換えていないか | **◎** | 取り込み差分に SQL の UPDATE / DELETE は無い。 |
| **2-6** | 新規依存 | **◎** | **★`git diff --name-only 11bcb6a 5ebb5e0 -- go.mod go.sum web/package.json` が 0 件。** |
| **2-7** | `DES-005` §5.7 の遷移先の表 | **◎** | 遷移まわりに差分なし。 |

### 3. 既存データへの影響

| # | 観点 | 評価 | 所見 |
|---|---|---|---|
| **3-1** | ステップ 0 本の仮登録の件数 | **◎** | 完了報告 §2.4（A〜F・母数 86・0 件）。**不明: 本セッションのコンテナに DB ファイルが無く、開発者のローカル DB の実測値は検証できない**（1 回目と同じ制約）。 |
| **3-2** | 勝手に直していないか | **◎** | 掃除・移行のコードなし。 |
| **3-3** | CSV 取込の報告 | **◎** | §2.3 / §7.4.1 #6 に「入る」「2 か所変わった」と記載。 |
| **3-4** | セットプレイ側の仮登録相当 | **◎** | §2.7 で「無い」。`VAL-S02` 無改変。 |

### 4. フロントエンドの動作仕様

| # | 観点 | 評価 | 所見 |
|---|---|---|---|
| **4-1** | `disabled` ＋ 理由か。消していないか | **◎** | `ComboEditor.tsx:1090-1108`。ボタンは残り `disabled={!canSaveNow}` ＋ `aria-describedby`。E2E (1a) が `toBeVisible()` と `toBeDisabled()` を両方見ている。 |
| **4-2** | `disabled` がタブ依存でないか | **◎** | `saveBlockedReason = steps.length === 0 ? … : null`。`activeTab` を参照していない。**★破壊確認 4 の「5 経路」も本回で追試——同 describe の 6 本のうち「1 本足すと押せる」だけがタブ依存化しても緑のままであり、残り 5 本が赤くなる。報告値と一致する。** |
| **4-3** | 理由が順送りで読める位置にあるか | **○** | 理由 `<p>` は保存ボタン行の直前・`tabIndex={0}`。**★器（`<div role="status">`）は `tabIndex` を持たないためフォーカス順に割り込まない。E2E (3) の「理由 → Tab → キャンセル」は壊れていない。** |
| **4-4** | 仮登録トグルで分岐していないか | **◎** | 条件に `isDraft` なし。専用テストあり。 |
| **4-5** | §4.4 の選択の報告 | **◎** | §3.4(a)「FE で先回りして塞ぐ」を採ったことと理由が明記。 |
| **★4-6** | **画面上の記述が as-built と整合しているか** | **×** | **★仮登録トグルのラベルが「レシピ未入力…を許容」のまま**（**高-A**）。チェックリスト §0.3-7 が委任しているのは「**保存できない理由**の文言・置き場」であり、**トグルのラベルは別物である。** |

### 5. テストの妥当性

| # | 観点 | 評価 | 所見 |
|---|---|---|---|
| **5-1** | Go サービス層 4 種 | **◎** | 4 種あり。取り込みで 1 本増（`TestIssueFieldFormat_…`）。 |
| **5-2** | 「仮登録＋`move_id` NULL で通る」テスト | **◎** | Go 2 層 ＋ zod ＋ E2E (2)(2b)。**★取り込みで assert は 1 つも減っていない。** |
| **5-3** | E2E 3 ケース | **◎** | (1a)(1b)(2)(2b)(3) ＋ 対照 2 本＝7 ケース。 |
| **5-4** | E2E 母数と「緩めていないか」 | **○** | **★本回で独立に数え直した**——`addMinimalRecipeStep(page` **16** ／ `minimalDraftSteps()` **20**。うち新規 spec `m24-13-…`（前者 2・後者 1）を除くと **14 ＋ 19 ＝ 33 サイト / 27 ファイル**、さらに `m24-04:396`（本登録側の下ごしらえ）を除いて **32 サイト / 26 ファイル**。**完了報告 §2.5 と一致し、取り込みで母数は動いていない。** 取り込み差分で E2E から削られた assert は 0 行。 |
| **5-5** | `M24-12` の E2E 7 ケース | **○** | 同 spec に差分なし。実行結果は完了報告に依拠（制約事項）。 |
| **5-6** | 基準値の背中合わせ | **○** | §1 の表は同一セッションで採ったと明記。**★完了後の値のうち `go test`（55 ok / FAIL 0）と `vitest`（198 files / 2166 tests）は本レビューで再現し一致した。** ただし §1 の `git diff --stat` の出力は as-built とずれている（**低-B**）。 |

### 6. 破壊確認

| # | 観点 | 評価 | 所見 |
|---|---|---|---|
| **6-1** | 5 件すべて実施 | **◎** | 5 件 ＋ 自発的な 5b。 |
| **6-1b** | 破壊確認 5 | **◎** | 2 経路が赤。5b で「1 本だけが守っている」ことまで特定。 |
| **6-2** | 破壊確認 2 | **◎** | 7 経路が赤。 |
| **6-3** | 破壊確認 1 で両側 | **○** | フロント側は緑（§6.1 で理由付きで報告済み）。 |
| **6-4** | 空振りしていないか | **◎** | **★1 回目に唯一空振りしていた E2E 対照が直っており、直した先も空振りしない**（§0 の 高-3 行）。**★あわせて、取り込みで追加した `TestIssueFieldFormat_…` が破壊確認 1〜5 の「赤くなる経路の数」を変えないことを確認した**——同テストは `MoveID: ptrInt64(999)`（非 nil）と 0 ステップの 2 系統しか使わないため、破壊確認 2（nil スキップの ERROR 化）でも 1（C09 に `if !isDraft` を戻す）でも赤にならない。**⇒ §6 の 3 / 7 / 7 / 5 / 2 / 1 は取り込み後も有効である。** |
| **6-5** | 赤くなる経路を数えているか | **◎** | 全件に経路数あり。 |

### 7. ドキュメント・進捗ログ

| # | 観点 | 評価 | 所見 |
|---|---|---|---|
| **7-1** | `progress-log.md` への追記 | **◎** | **★索引行あり（`:5111`）。形式は `M24-11` / `M24-12` と同型（見出しに日付／結果／報告リンク／★横断課題 9 件）。★リンク先 3 本の実在も確認した**——`docs/progress/M24-13-completion-report.md` ／ `docs/progress/m24-13-review.md` ／ `docs/progress/M24-13-mock/m24-13-save-blocked.html`（**`check-progress-log-index.sh` はリンク先の実在を見ないため独立に確認した**）。 |
| **7-2** | CHANGE 要否 7 件 | **◎** | 7 件とも判定あり。#1 は 中-2 の指摘を織り込んで加筆済み。 |
| **7-4** | `REQ-001` を編集していないか | **◎** | `docs/design/` の差分 0 件。 |
| **7-5** | 件数にコマンドが併記されているか | **○** | 併記はある。**★ただし §2.2 / §2.9 のコード柵の中身は「注釈を足した編集済み転記」であって逐語の出力ではない**（**低-C**）。 |
| **7-6** | 検査を回しているか | **◎** | **★本レビューで 9 本すべてを再実行した**——`artifact-integrity`（検査 11 件の自己検査 OK ／ 生成物 4 件 OK・**違反なし**）／ `progress-log-index`（**違反なし**）／ `md-emphasis`（436/436・増加なし）／ `doc-refs`（dead reference なし）／ `enum-sync`（ベースラインどおり）／ `browser-storage-keys`（台帳 11 / 実装 10・違反なし）／ `stop-discipline`（違反なし）／ `instruction-format`（78/78・違反なし）／ `doc-inventory`（型に無いファイル 4 件・**いずれも本サブ由来ではない**）。**1 回目に唯一赤だった 1 本が緑になり、完了報告 §10 の記述と実測が一致した。** |

---

## 設計準拠性以外の指摘事項

- **コーディング規約（Go）**: 取り込み差分に `fmt.Println` / 放置 TODO / `nolint` の追加は 0 件。`txScopedValidDeps` のシグネチャ変更は `CLAUDE.md` §4「サービス層のメソッドは第一引数に `context.Context`」の趣旨に沿う。**★ただし gofmt 未整形のファイルが 4 件ある**（**低-A**）。
- **コーディング規約（TS）**: `any` の新規使用なし。`pnpm build`（`tsc -b && vite build`）は本レビューで実行し **成功**。**★ただし `web/tsconfig.json` の `include` は `["src", "vite.config.ts"]` であり、`web/e2e/` は型検査の対象外である。** ⇒ 高-3 で差し替えた `expect(body.validations, message).toBeUndefined()`（Playwright の 2 引数 `expect`）は**型検査を一切通らず、`make e2e` を回すまで誤りが出ない**。API 自体は `@playwright/test` ^1.60 で正当だが、この経路の脆さは記録に値する。
- **セキュリティ**: 認証・ハッシュ・ストレージ API に触れていない。ブラウザストレージの新キー 0 件（検査で確認）。
- **a11y**: `role="status"` は暗黙に `aria-live="polite"` を持つため属性は冗長だが、明示は害にならない。器を常設した形は WAI-ARIA の live region の使い方として正しい。
- **`rows.Close()` / 接続プール**: 1 回目から差分なし。所見も変わらない。

---

## 推奨修正（優先度別）

### 高（M24 完了前に修正必須）

**高-A. 仮登録トグルのラベルが失効している——しかも「コメント」ではなく利用者に見える文字列であり、テスト 2 本が旧文字列を固定している**

- 位置と逐語:
  ```
  web/src/features/combo/components/ComboDraftToggleField.tsx:35-36
    export const DRAFT_TOGGLE_LABEL =
      "仮登録として保存(レシピ未入力や重複コンボの登録等を許容)";
  web/src/features/combo/components/ComboDraftToggleField.tsx:41
    const DRAFT_TOGGLE_NOTE = "レシピ未入力や重複コンボの登録等を許容";
  ```
- **同じ画面が上下で正反対のことを言っている。** トグルは `ComboEditor.tsx:907` の**最上部の行**に inline で常時描かれ（`DRAFT_TOGGLE_HEAD` ＋ 括弧付きの `DRAFT_TOGGLE_NOTE`）、非 inline 版（`ComboDraftToggleField.tsx:75`）も同じ文字列を出す。その**下**で保存ボタンが `disabled` になり `SAVE_BLOCKED_EMPTY_RECIPE`＝「レシピを 1 つ以上入力してください(仮登録でも必要です)。」が出る。**⇒ 利用者は「仮登録ならレシピ未入力でよい」と読んだ直後に、保存できない理由として逆のことを読む。**
- **★旧文字列は 2 本のテストが固定している。** ⇒ 後から直そうとすると赤くなり、直す側は「意図的に固定されている」と誤読しうる。
  ```
  web/src/features/combo/components/ComboEditorBasicFields.test.tsx:1231
    expect(container.textContent).toContain("レシピ未入力や重複コンボの登録等を許容");
  web/e2e/m24-12-editor-rebuild.spec.ts:206
    page.getByText("レシピ未入力や重複コンボの登録等を許容"),
  ```
- **★取り込み記録の「`grep` で残存 0 を確認した」（完了報告 §12 高-2 行）は成立していない。** 1 回目のレビューが挙げた 4 か所は E2E の spec ヘッダに限られており、**`web/src/` 側と「コメント以外の文字列」は走査されていない。** 本レビューは `grep -rn "仮登録" web/src --include=*.ts --include=*.tsx` で全数走査し、本件 1 件だけが残っていることを確認した（他の 25 ヒットはいずれも as-built と整合、または `VAL-C02` に関する記述で今も正しい）。
- **★併せて `ComboDraftToggleField.tsx:30-33` の godoc も半分失効している**——「`DES-006` §2.2 が『VAL-C01〜C11 のうち D01〜D03 以外は全て適用しない』と定めており」は、まさに `CHANGE-139` が例外 1 件を立てた文である。`VAL-C02` については今も正しいため、**根拠の引用の仕方を直す必要がある。**
- **★完了報告 §8（設計書の失効箇所）にも §11（申し送り）にも本件は載っていない。** §8 は設計書だけを走査対象にしており、**実装側の失効記述を挙げる節が存在しない。**
- **優先度較正の根拠**: 動作は正しいままなのでテストも lint も型検査も緑になる（むしろ**テストが旧文字列を守っている**）。人が画面を読む以外に見つける経路が無い。しかもモック `docs/progress/M24-13-mock/m24-13-save-blocked.html` はトグルのラベルを描いていないため、**開発者のモック確認でも見えなかった。**
- 対応（**★文言そのものの決定は開発者・設計卓の手番**）:
  1. `DRAFT_TOGGLE_LABEL` / `DRAFT_TOGGLE_NOTE` から「レシピ未入力」を落とす（例＝「重複コンボの登録等を許容」）。**★「唯一の正典」の規律（`M24-12` §4.10.2 / `D-582`）を守り、inline / 非 inline の両方が同じ文字列を見る形は崩さないこと。**
  2. 上記 2 本のテスト（コンポーネント 1・E2E 1）を新文字列へ追随させる。**★`DRAFT_TOGGLE_LABEL` を import している `ComboEditorBasicFields.test.tsx:1222-1223` は定数参照なので自動追随するが、`:1231` と E2E `:206` はリテラルであり手当てが要る。**
  3. `ComboDraftToggleField.tsx:30-33` の godoc を「`VAL-C02` は仮登録では走らない（`DES-006` §2.2）。**★`VAL-C09` は `M24-13`/`CHANGE-139` で仮登録にも適用するようになったため、レシピ未入力は許容しない**」の形へ。
  4. 完了報告 §8 に「**実装側の失効記述**」の行を足し、設計伝達レポート §4 へも並べる。

### 中（M25 着手と並行可）

**中-A. 中-3 で足した Go テストが押さえたのは WARNING の `VAL-C08` であり、フロントの振り分けが実際に消費する ERROR（`VAL-C12`）の書式は無検証のまま**

- フロント側の消費点は 1 か所しかない。`web/src/features/combo/editorTabs.ts:66`:
  ```ts
  for (const issue of issues ?? []) {
    if (issue.severity !== "error") continue;   // ★WARNING はここで捨てられる
    const tab = tabOfIssueField(issue.field);
  ```
  `tabOfIssueField` は `web/src/features/combo/components/ComboEditor.tsx:836` の `countErrorsByTab` からしか呼ばれていない（`grep -rn "tabOfIssueField\|countErrorsByTab" web/src` で確認）。
- **⇒ 添字付き前方一致 `steps[` を本番で実際に通るのは `VAL-C12`（ERROR・`combo.go:393 / :399`）だけである。** `VAL-C08` は WARNING（`:310 / :315`）で、`VAL-C03` の `starterMoveId` も WARNING。`VAL-C09` の `"steps"` は**前方一致ではなく完全一致集合** `RECIPE_TAB_FIELDS` の側で拾われる。
- 追加された `TestIssueFieldFormat_RecipeSideUsesIndexedPrefix` は `CodeC08MoveExists` の issue を探して `steps[` を確かめ、あわせて C09 の `"steps"` を確かめている。**⇒ 「振り分けの前提を押さえる」という中-3 の狙いのうち、前方一致規則の実際の唯一の生産者だけが漏れている。**
- **★同テストのコメントが「★本テストが実サーバ側の出力を押さえる唯一の観測である」と書いている分、取りこぼしが見えにくい。** `combo.go:310` と `:393` は同じ書式文字列だが**別の呼び出し箇所**であり、片方だけ変えられる。
- 対応（安い順）: `TestIssueFieldFormat_…` の中で `VAL-C12` の issue も 1 本取り、`strings.HasPrefix(field, "steps[")` と `Severity == error` を確かめる。あわせてコメントの「唯一の観測」の主張を、押さえた VAL コードの列挙へ置き換える。

### 低（将来対応）

**低-A. `M24-13` で gofmt 未整形のファイルが 4 件混入した**（本回で新規に検出）

```
$ gofmt -l ./internal ./cmd
internal/infra/migration/migrate_m2402_test.go    ← 着手前から未整形（本サブ由来ではない）
internal/service/combo/service_test.go            ← ★本サブで混入
internal/service/combo/setup_results_carry_test.go ← ★本サブで混入
internal/service/comboio/service_test.go          ← ★本サブで混入
internal/service/setup/service_test.go            ← ★本サブで混入
```
`git show 11bcb6a:<path> | gofmt -d` で着手前は 4 件とも整形済みであることを確認した。中身はいずれも `§4.6` のアダプタ配線で足した 1 行の構造体リテラルの整列崩れ:
```
-		SetupRepo:     &setupsvc.SetupDuplicateAdapter{Repo: sRepo},
+		SetupRepo: &setupsvc.SetupDuplicateAdapter{Repo: sRepo},
```
リポジトリに gofmt の機械検査は無く、`go vet` も `go build` も通るため、**読む以外に見つける経路が無い。** なお取り込み時に `internal/service/validation/combo_test.go` へ gofmt を掛けた形跡はある（コメント整形が差分に出ている）ので、**掛ける対象の選び方だけが漏れている。**

**低-B. 完了報告 §1 の `git diff --stat` の値が as-built と一致しない**

報告は「`50 files changed, 1551 insertions(+), 121 deletions(-)`」だが、実測は:
```
$ git diff --stat 11bcb6a eb234c2 | tail -1
 51 files changed, 1959 insertions(+), 121 deletions(-)
$ git diff --stat 11bcb6a 5ebb5e0 | tail -1
 53 files changed, 2336 insertions(+), 116 deletions(-)
```
**★deletions が 121 → 116 と「減っている」**（低-4 で `m24-04` の import を復元したため）。⇒ 単なるスナップショットの古さではなく、**取り込み後に §1 を採り直していないことが両方向に出ている。** あわせて §1 の「新規ファイル 6 件」も as-built では 8 件（完了報告・レビュー報告書が加わる）。**★教訓 `E-225` の主張（新規ファイルは `+` のみ）自体は今も成立している**ので、実害は「後任が §1 の数値を引き写す」ことに限る。

**低-C. §2.2 / §2.9 のコード柵の中身が逐語の出力ではなく、注釈を足した編集済み転記である**

```
$ grep -rn "ValidateComboForCreate(" internal/ --include=*.go | grep -v _test.go
internal/service/combo/service.go:342:	... input.IsDraft ...   # POST /api/combos
```
実際の出力は `result := validation.ValidateComboForCreate(ctx, combo, steps, input.IsDraft, hash, s.txScopedDeps(tx))` であり、`...` と `#` 注釈は製造が足したものである（`grep` は `#` を出さない）。**内容は正しく、母数も一致した**（本回で再現）。ただし柵の中は「打てば同じものが出る」と読まれるため、**注釈であることが分かる印を付けるか、逐語の出力と注釈の表を分けるのが安い。** 指示書 §7.5「その場で数え直したコマンドを併記する」の趣旨は満たしている。

**低-D. 常設した空の live region が `space-y-4` に 16px の余白を足す**

`ComboEditor.tsx:889` のルートは `space-y-4` であり、子要素間に `margin-top: 1rem` が入る。`ValidationDisplay` は結果が無いとき `null` を返して DOM ノードを作らない（`ValidationDisplay.tsx:21`）が、**新設した `<div role="status">` は中身が無くても常にノードとして残る。** ⇒ 理由が出ていない通常時に、保存ボタン行の上へ 1 行ぶんの余白が増える。**★低-3 の目的（初回の読み上げ）を損なわずに消せる**——器へ `className="empty:hidden"` を当てるか、余白を持たない位置（ボタン行の内側の先頭）へ移すか、どちらでも観測は変わらない（`toHaveCount(0)` は内側の `<p>` を見ているため）。**★実機で見える差であり、開発者の目視確認に載る前に潰しておくのが安い。**

**低-E. 完了報告 §8 の表の行番号が `#1 → #2 → #3 → #4 → #6 → #5` の順になっている**

中-1 で足した `#6` が既存の `#5` の**前**に挿入された。内容に誤りは無いが、以後この表を引く担当が「#5 と #6 が入れ替わっている」ことに気づかないまま番号で参照すると食い違う。並べ替えるか、末尾へ移すだけで済む。

**低-F. 高-3 の差し替えで `body.warnings`（`VAL-C14`）に対する観測が 0 本になった**

旧 assert は空振りだったが、副次的に「この fixture がゴミ箱の既存行と重複していない」ことだけは見ていた。差し替え後、E2E で `warnings` を見る assert は 1 本も無い（`grep -rn "body.warnings" web/e2e` が 0 件）。**★本サブの命題には無関係であり、直す必要は無い。** 記録のみ。

---

## 良かった点

1. **★★高-1 の是正を「消して直す」ではなく「誤りを残して直す」形で行った。** 完了報告 §10 の当該行は「**本報告書の初版はこの欄を『違反なし』と書いたが、その時点で本検査は 1 度も回していなかった。実測は `NG 1 件` であった**」と書き、progress-log 横断課題 8 にも同じ事実を残している。**検査結果の誤記は「回した証拠」として後任に効いてしまう**——その性質を正しく捉えた対応であり、次に同テンプレートを引き継ぐ担当への最良の防波堤である。
2. **★★低-3 を直す前に「壊してはいけない観測」を特定してから直した。** 器へ `data-testid` を付けず、その理由（「中身の有無を `toHaveCount` で見ている spec があるため」）をコード内コメントに残している。本レビューで `m24-13-draft-requires-recipe.spec.ts:100-102` の `toHaveCount(0)` が内側の `<p>` を見ていることを確認し、**実際に壊れていない**ことを裏取りした。**指摘の字面だけを実装すると器に test-id を付けてしまう場面であり、そこを踏まなかった。**
3. **★高-3 で「直したつもりの assert がまた空振りする」形を実際に潰した。** 1 回目の指摘は「差し替えたら赤くなることまで確かめること」と書いたが、これは**やらなくても報告上は分からない**種類の要求である。製造は `starterMoveId` を足して `VAL-C03` を故意に発火させたと報告しており、**本レビューでコードを追った結果その筋は成立する**（`VAL-C03` は `StarterMoveID != nil` かつ `steps[0].MoveID == nil` で WARNING を出す ⇒ `result.Issues` が 1 件 ⇒ `toComboResponse` が `Validations` を入れる ⇒ `body.validations` が定義される ⇒ 赤）。**旧 assert が同じ壊し方で緑のままであることも、`handler.go:109-111` が `Warnings` に入れるのが `CheckTrashDuplicate` だけであることから確かめられる。**
4. **★中-4 を「コードを変えずに申し送りへ格上げする」判断が正しい。** 1 回目の指摘は 2 案（`main.go` の切り出し ／ followup 候補として並べる）を示しており、製造は後者を選び、**理由（`M24-11` の `combo` 側も同構造であり片側だけ直すと非対称になる）を書いた。** 指摘を機械的に「採用＝コードを直す」へ倒さず、`D-382`（製造は `followup-backlog` を直接編集しない）も守っている。
5. **★低-1 の是正が「結論」ではなく「次の担当が踏む地雷」まで書いてある。** 単に `validateC04DriveRange` の形を訂正するのではなく、「**形は 2 種類ある**」「**`grep "_ = isDraft"` で数えると 1 件足りない**」まで残した。本レビューで `combo.go:212 / :239-242 / :253` を実物照合し、記述が実物と一致することを確認した。
6. **★低-2 の追随が漏れなく 3 か所ぜんぶで、内部テストまで直っている。** `txScopedValidDeps` の呼出元は `grep` で 3 か所が全数であり、いずれも自メソッドの `ctx` を渡している。**別スコープの `ctx` を掴む・`context.TODO()` で埋める、といった安易な逃げが 1 件も無い。**
7. **★取り込みで検査 9 本が全部緑になった。** 1 回目に唯一赤だった `check-progress-log-index.sh` が緑になり、**本レビューで 9 本すべてを独立に再実行して完了報告 §10 の記述と一致することを確認した。** 「報告書の緑が実測と一致する」状態は、本サブでは 2 回目にして初めて成立している。

---

## 制約事項

- 本レビューはコード上で判定可能な範囲のみ対象。実際の動作確認・パフォーマンス・実機テストは別途実施が必要。
- 本レビューで**実行して確認した**もの: `go test ./... -count=1`（**55 パッケージ ok / FAIL 0**）／ `go test ./internal/service/validation/... -run 'TestIssueFieldFormat|TestC09' -v`（**6 本すべて PASS**）／ `cd web && pnpm exec vitest run`（**198 files / 2166 tests passed**）／ `cd web && pnpm build`（**成功**）／ `gofmt -l ./internal ./cmd` ／ `go vet`（対象 3 パッケージ・出力なし）／ `check-artifact-integrity.sh`・`check-progress-log-index.sh`・`check-md-emphasis.sh`・`check-doc-refs.sh`・`check-enum-sync.sh`・`check-browser-storage-keys.sh`・`check-stop-discipline.sh`・`check-instruction-format.sh`・`check-doc-inventory.sh`（**すべて緑／ベースラインどおり**）。
- **`make e2e` は本レビューでは実行していない**（他サブと重ねられない＝`D-548`）。**⇒ 取り込み後の「215 passed / 0 failed（4.4m）」は完了報告・取り込み記録の記載に依拠している。** ただし取り込みが E2E に入れた変更は (a) spec ヘッダのコメント 4 か所、(b) `m24-04` の import 整形、(c) `m24-13` 対照 1 本の assert 差し替え——の 3 種であり、(c) は静的に「201 経路で `validations` キーが出ない」ことを `dto.go:519` ＋ `json:"validations,omitempty"`（`:243`）から確認した。**★なお `web/e2e/` は `web/tsconfig.json` の `include` に入っておらず型検査を受けないため、(c) の誤りは `make e2e` を回すまで出ない構造である**（本文の「設計準拠性以外の指摘事項」参照）。
- 実査 4（既存データにステップ 0 本の仮登録が何件あるか）は開発者のローカル DB に対する照会であり、本レビューでは検証できない。**不明: 実査 4 の 6 項目の数値（母数 86 を含む）が実際に採られたものかは判断できない**（本セッションのコンテナに DB ファイルが無いことは 1 回目と同様に確認した）。
- **不明: 完了報告 §1 の「着手前」の値（`vitest` 2156 / `make e2e` 208）は、着手前のツリーでコマンドを回さないと再現できないため検証していない**（`git checkout` は `CLAUDE.md` §10 で禁止）。完了後の値 2 本は再現して一致した。
- 破壊確認 5 件の「赤くなった経路の数」は、**コードを変更できないため実施ではなく静的追跡で検証した**（破壊確認 4 の「コンポーネント 5 本」は、当該 describe の 6 本のうちタブ依存化で緑のままになるのは「1 本足すと押せる」の 1 本だけであることから一致を確認）。**★取り込みで追加された Go テストが破壊確認の経路数を変えないことも確認済み**（§6-4）。
- チェックリスト §0.3「重大でないもの」8 件は誤判定していない——`VAL-D04` の不在、`REQ-001` の未編集、`VAL-S02` の未修正、既存データの未書換、FE で先回りしたこと、**保存できない理由**の文言・置き場、いずれも指示書がそう定めた結末として扱った。**★高-A は §0.3-7 が委任した「理由の文言」ではなく、仮登録トグルのラベル（別の文字列）である。**
- **`bash scripts/check-doc-inventory.sh` は本ファイル（`m24-13-review-2.md`）を「型に無いファイル」として 5 件目に数えるようになる**（既に `m24-12-review-2.md` が同じ扱いで挙がっている）。**★2 回目のレビュー報告書という型が TYPES 表に無いためであり、本サブの欠陥ではない。** 型へ昇格させるかは開発者の判断（`CLAUDE.md` §10.Y）。
- 設計伝達レポート `docs/handover/design-reports/2026MMDD-m24-13-design-exceptions.md` は未作成だが、これは工程順として**レビュー後に作るもの**であり欠陥ではない。**高-A / 中-A / 低-B〜低-F は同レポート §4 の候補として扱われたい。**
- **★往復上限に達した。** 本回で高 1 件・中 1 件が残る。取り込むか、`docs/handover/followup-backlog.md` §J へ必須 5 フィールド付きで記録して停止するかは製造担当の判断である（`CLAUDE.md` §9・チェックリスト §11）。

---

*以上、M24-13 レビュー報告書（2 回目）。* **重大 0 件。** **★取り込み 12 件のうち 10 件は解消、2 件が部分的。** **★新たに挙げた 高-A は「1 回目のレビューも取り込みも走査範囲を E2E のコメントに限ったため落ちた」型であり、残っているのはコメントではなく利用者が読む文字列である。**

---

## 取り込み結果（自動トリアージ・2 回目）

**Phase C（`implement_plan_full`）。全 8 件を採用。不採用 0 件。**
**⇒ 「高」の不採用によるエスカレーションは発生していない。**
**★★本回で再レビューの往復上限 2 回（初回 ＋ 再レビュー 1 回）に到達した**（`CLAUDE.md` §9 停止規律）。**未解消の指摘は 0 件のため、`followup-backlog` §J への記録は発生しない。**

| # | 優先度 | 指摘 | 採否 | 対応 |
|---|---|---|---|---|
| 高-A | 高 | 仮登録トグルのラベルが失効（**利用者に見える文字列**）。テスト 2 本が旧文字列を固定 | **採用** | `DRAFT_TOGGLE_LABEL` / `DRAFT_TOGGLE_NOTE` から「レシピ未入力」を落とし、godoc の根拠引用を `VAL-C02` のぶんへ絞った。**★正典 1 本の規律（`M24-12` §4.10.2）は崩していない。** テスト 2 本を新文字列へ追随。**★完了報告へ §8.1「実装側の失効記述」を新設した**——初版は設計書だけを走査対象にしており、実装側を挙げる欄が無かった。**★「grep で残存 0 を確認した」が E2E ヘッダしか見ていなかったことも §8.1 に残した** |
| 中-A | 中 | 中-3 の Go テストは `VAL-C08`（WARNING）を押さえたが、フロントが消費するのは ERROR のみ。前方一致の唯一の生産者 `VAL-C12` が無検証 | **採用** | `TestIssueFieldFormat_RushVariantErrorUsesIndexedPrefix` を追加し、**`VAL-C12` の severity が error であること**と `steps[` 前方一致を固定。**★「唯一の観測である」というコメントの主張を、押さえた VAL コードの列挙へ置き換えた**（C08 / C09 / C12） |
| 低-A | 低 | gofmt 未整形 4 件が本サブで混入 | **採用** | 4 件を `gofmt -w`。**★`internal/infra/migration/migrate_m2402_test.go` は着手前から未整形であり本サブ由来ではないため触っていない**（レビューの判定どおり） |
| 低-B | 低 | 完了報告 §1 の diff 統計が as-built と不一致（deletions が 121→116 と減っている） | **採用** | §1 を as-built で採り直した（57 files / +2671 / -126、新規 9 件）。**★「古い」ではなく「両方向にずれていた」ことを明記した** |
| 低-C | 低 | §2.2 / §2.9 のコード柵が注釈入りの編集済み転記 | **採用** | 両方の柵の前へ「注釈を足した転記であり逐語ではない」と明示し、実際の行の形も添えた |
| 低-D | 低 | 常設した空 live region が `space-y-4` に 16px の余白を足す | **採用** | 器へ `empty:hidden` を当てた。**★`display:none` でも要素は DOM に残るため、低-3 の目的（初回の読み上げ）は損なわれない** |
| 低-E | 低 | §8 の行番号が `#4 → #6 → #5` の順 | **採用** | `#6` を末尾へ移し、`#1〜#6` の順に直した |
| 低-F | 低 | `body.warnings`（VAL-C14）の観測が 0 本になった | **採用（記録のみ）** | 指摘どおり本サブの命題と無関係のため、コード変更なし。**★記録として本表に残す** |

### 取り込み後の再実行（**★すべて実測。値を書いてから確かめる形にしない**）

| 検査 | 結果 |
|---|---|
| `go test ./... -count=1` | **55 パッケージ ok / FAIL 0** |
| `pnpm exec vitest run` | **198 files / 2166 tests passed**（**★件数は動いていない**——中-A で足したのは Go 側のテストであり、高-A で触れた 2 本は文字列の追随であって本数を変えないため） |
| `cd web && pnpm build` | 成功 |
| `make e2e` | **215 passed / 0 failed（4.4m）**・ポートは実行直前に空き確認済み |
| `gofmt -l ./internal ./cmd` | **本サブ由来 0 件**（残る `internal/infra/migration/migrate_m2402_test.go` 1 件は着手前から未整形であり本サブ由来ではない） |
| `check-artifact-integrity` / `check-md-emphasis` / `check-doc-refs` / `check-enum-sync` / `check-browser-storage-keys` / `check-progress-log-index` / `check-stop-discipline` | **7 本すべて違反なし／ベースラインどおり** |

> **★★本節は 1 度、実行前に「+2」「本節の表のとおり」と書きかけた。** 実測すると **2166 のまま（±0）** であり、**書きかけの値は誤りだった。** **⇒ 本サブで 3 度目の同型**（1 回目 高-1＝回していない検査を「違反なし」と書いた ／ 2 回目 低-B＝取り込み後に統計を採り直していない）。**★数値は「書く前に採る」。**
