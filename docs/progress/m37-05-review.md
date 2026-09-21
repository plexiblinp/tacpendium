# M37-05 レビュー報告書

| 項目 | 内容 |
|------|------|
| 対象サブ | `M37-05`（始動位置のマス数の不変条件・`P-60` の決着） |
| 対象指示書 | `docs/instructions/M37-05-position-mass-null-invariant.md` v1.0.0 |
| チェックリスト | `docs/instructions/reviews/M37-05-review-checklist.md` v1.0.0 |
| 完了報告 | `docs/progress/M37-05-completion-report.md` |
| 着手基点 / HEAD | `9a4d391` / `317cdd6` |
| レビュー実施日 | 2026-09-13 |
| レビュー担当 | 品質レビュー担当 Claude Code（コード変更なし・読取のみ） |

---

## 総評

設計の核心（`normalizePositionAndMass` をそのまま `PATCH` から呼ばず、補完の半分だけを `representativeMassFill` として切り出す）は正しく、チェックリスト §0 の不合格条件 5 件はいずれも踏んでいない。`position` は構造的に書けない形が保たれ、運び量は `onBlur` を渡さないことで JSX 上に不在が見える。破壊確認と逆向きの対照も置かれている。

一方で、**着手前から在ったテスト 1 本が本サブの変更で赤くなっており、`go test ./...` が現在 RED である**。完了報告 §5.7 の「緑（exit 0）」は事実と異なる。赤の原因は実装の欠陥ではなく、`D-864` が意図した新挙動と、旧挙動（明示クリアで NULL になる）を固定した `M37-01` のテストおよびその注記の衝突である。すなわち「撤回された前提がコード上に残っている」型であり、優先度は高である。

加えて、不変条件のうち閉じたのは片方向だけ（区分あり ⇒ マス数が入る）であり、逆向き（マス数あり ⇒ 区分が決まっている）は `PATCH` では依然として破れる。射程外の経路に限られるため実装の変更は不要だが、完了報告と godoc の「3 経路で不変条件が成り立つ」という言い切りは限定を足す必要がある。

`progress-log.md` への索引行が未追記で、機械検査が赤である。

---

## 設計準拠性レビュー結果

### 束 A — `PATCH` から `position` が動かないこと

| # | 評価 | 所見 |
|---|---|---|
| A-1 | ◎ | `comborepo.UpdateMetadataInput` に `Position` 欄が無く、`repository.UpdateMetadata` の SET 句にも `position` が現れない。サービス層の追加コードも `position` を読むだけである。実測で確認した |
| A-2 | ◎ | `normalizePositionAndMass` の呼び出しは `service.go:343`（Create）と `service.go:826`（UpdateWithKeyChange）の 2 か所のまま。`PATCH` は `fillStartPositionMassForPatch` だけを呼ぶ。型が `*CreateInput` であるため誤って呼べない点も含めて妥当 |
| A-3 | ◎ | `TestPatch_CrossBandMass_DoesNotMovePosition` が `mid_screen` の行へ 12 を投げて `position` 不動を確認し、DB 再読込でも確認している |
| A-4 | ○ | 逆向きの対照は 3 通り（不問の据え置き／`representativeMassFill` の埋めない 3 ケース／補完を外した positive control 10 件赤）。positive control は完了報告の記述であり本レビューでは再現していない。なお E2E の 1 本は対照になっていない（後述 中-2） |
| A-5 | ◎ | `TestNormalize_DerivationStillWorksOnCreateAndPut` が POST / PUT の導出を固定。切り出しによる退行は見当たらない |
| A-6 | ◎ | 差分 9 ファイルに `duplicate_keys.go` / `utils.ts` は含まれず、`extractKeyFields` / `hasKeyChanges` は無傷 |

### 束 B — 不変条件そのもの

| # | 評価 | 所見 |
|---|---|---|
| B-1 | △ | 3 経路の実測は在るが、成り立っているのは片方向だけである（高-2 / 中-1 に詳述）。`PATCH` は「区分あり ⇒ マス数が入る」を守るが、「マス数あり ⇒ 区分が決まっている」は守らない |
| B-2 | ◎ | `TestPatch_ClearMass_FillsRepresentative` が 7 区分すべてで代表値と `position` 不動を確認 |
| B-3 | ◎ | `TestPatch_Unspecified_StaysNull` が明示クリア・キー不在の両方で NULL 据え置きを確認。E2E でも詳細画面に要素が出ないことで確認している |
| B-4 | ◎ | `TestPatch_MemoOnly_FillsFromDBPosition` が固定し、完了報告 §4.5 に意図であることが 1 行以上書かれている |
| B-5 | ○ | NULL に 2 つ目の意味は足されていない。ただし旧テストの注記が「他の Optional 列と同じトライステート」という前提を残しており、そこだけ意味が二重に読める（高-2） |

### 束 C — 運び量

| # | 評価 | 所見 |
|---|---|---|
| C-1 | ◎ | `TestPatch_CarryDistanceMass_NeverFilled` と `TestFillStartPositionMassForPatch_NeverTouchesCarry` の 2 層。E2E でも詳細の運び量が `-` のままであることを確認している |
| C-2 | ◎ | 区分・代表値の概念を運び量へ持ち込んでいない |
| C-3 | ◎ | `onBlur` を始動位置の呼び出しにだけ渡す形は、指示書 §4.3 が名指しする事故を JSX の上で可視にしている。案 B を却下した理由づけも妥当 |

### 束 D — 画面の側

| # | 評価 | 所見 |
|---|---|---|
| D-1 | ◎ | 保存前に代表値が戻ることを単体と E2E で確認（E2E は保存操作を挟まずに値が戻ることを見ている）。★残余は低-4 を参照 |
| D-2 | ◎ | 不問なら空のまま。`representativeMassOf` が null を返す経路で担保 |
| D-3 | ◎ | マス目・パーセンテージの両方式で `onBlur` が親へ届くことを部品側の単体で、結果の同値を親側の単体と E2E で確認。パーセント側は `setDraft(null)` の後に親へ通知する順序も適切である |
| D-4 | ◎ | `setPositionBand` と同じ `representativeMassOf` を引いており、流儀が揃っている |
| D-5 | ◎ | 代表値表は Go 1 本・TS 1 本のまま。3 本目は作られていない |

### 束 E — 既存行と外部経路

| # | 評価 | 所見 |
|---|---|---|
| E-1 | ◎ | 違反 0 件を開発者実測として記載し、照合 SQL も残している。埋め戻しは行っていない |
| E-2 | ○ | 新規テスト 2 本で非退行を固定。ただし空セルを `ExportCSV` の往復で作っており、利用者が渡す生の CSV テキストを直接は固定していない（低-1） |
| E-3 | ◎ | CSV / API へ新しい拒否は 1 つも足されていない。`csvcore` の差分はテストのみである |
| E-4 | ◎ | `migrations/` に差分なし。最新は `000112` のまま |

### 束 F — 触っていないもの

| # | 評価 | 所見 |
|---|---|---|
| F-1 | ◎ | `VAL-C16` / `VAL-RANGE` に差分なし |
| F-2 | ◎ | `B01`〜`B15` の面に差分なし |
| F-3 | ◎ | スクリーンショットの追加なし |
| F-4 | ◎ | `docs/handover/followup-backlog.md` は差分 0 バイト |
| F-5 | ◎ | `docs/design/` に差分なし。CHANGE は自採番せず完了報告 §8 に原稿として置かれている |

### 束 G — 実査と検査

| # | 評価 | 所見 |
|---|---|---|
| G-1 | ◎ | 代表値 7 個を Go / TS の両方で数え直している。`M37-RESEARCH-01` の転記ではない |
| G-2 | ◎ | 「不問」に名前付き定数が無いこと、Go は `nil`・TS は `""` が番兵であることを実測で書き分けている。`OpponentStanceAny` との紛らわしさにも触れている |
| G-3 | ◎ | 「実測（開発者）」「実測（本セッション）」「算出」の書き分けが守られている |
| G-4 | ◎ | 版ゲート 5 点が報告 §1 に在る |
| G-5 | × | **`go test ./...` が赤である**（高-1）。`make e2e` 全数は未実測のまま（中-3）。`pnpm test` は本レビューで再実測し 233 ファイル / 2909 テスト緑、`make e2e-only P=m37-05` も 5/5 緑を確認した |
| G-6 | ◎ | 着手時実測 99 / ベースライン 99 を控えたうえで完了時と比較している。本レビューでも 99 を再実測した |
| G-7 | ◎ | `check-enum-sync.sh` はベースラインどおり。本レビューで再実測した |
| G-8 | × | `docs/progress/progress-log.md` に `M37-05` の索引行が無い（高-4） |
| G-9 | ○ | CHANGE 原稿 3 本が完了報告 §8 に在り、自採番していない。設計伝達レポート §4 への移送は後工程で必ず行うこと |

---

## 設計準拠性以外の指摘事項

### コーディング規約

- Go の godoc・エラーラップ・`context.Context` の作法は守られている。`representativeMassFill` / `fillStartPositionMassForPatch` は非公開だが godoc 相当の注記が充実しており、意図が読み取れる。
- TypeScript は `any` 無し、import 順の後退なし（`check-import-order.sh` 99 で不変）。`onBlur?: () => void` の型も妥当。
- `console.log` / `fmt.Println` の混入なし。`eslint-disable` / `nolint` の追加なし。

### 命名

- `representativeMassFill` は「埋める値を返すが、埋めはしない」関数であり、名前からは代入まで行うように読める。`representativeMassFor` のような取得動詞の方が実体に近い。ただし godoc に「埋めないときは nil を返す」と明記されているため実害は小さい。（低）

### 構造・性能

- `UpdateMetadata` 内の `s.repo.FindByID` が 1 回増えた（中-4）。`FindByID` は `attachComboChildren` 経由で steps / tags / okiOptions / starterMoveCode まで読む重い呼び出しであり、同一リクエスト内で必ず 1 回は既に取得済みである。
- トランザクション外から読んでいる点は既存 3 か所と同型であり、新規のリスクは無い。版によるロックで守られている点も従前どおりである。エラー面が変わらないという完了報告 §4.3 の検証は、`FindByID` が両分岐で必ず先に走っていることを確認した限り正しい。

### セキュリティ・ライブラリ

- 依存追加なし。ブラウザストレージの新規キーなし。セキュリティ上の論点は無い。

---

## 推奨修正（優先度別）

### 高（M37 完了前に修正必須）

**高-1. `go test ./...` が赤である。完了報告の「緑」は事実と異なる。**

```
--- FAIL: TestUpdateMetadata_PositionMass_ClearsWithPresentNull (0.01s)
    m37_01_position_mass_patch_test.go:93: startPositionMass = 80, want nil
FAIL	github.com/plexiblinp/tacpendium/internal/service/combo
```

- `validRyuInput` は `Position: ptr("mid_screen")` を持つ。したがって同テストが作る行は区分が決まっており、明示クリアすると本サブの仕様どおり代表値 80 が戻る。
- つまり赤の原因は実装の欠陥ではなく、`D-864` が意図的に変えた挙動と、旧挙動を固定した既存テストの衝突である。**期待値の側を直すのが正しい。** `startPositionMass` は 80 を期待し、`carryDistanceMass` の nil 期待はそのまま残すこと（運び量が埋まらないことの証拠であり、むしろ価値が上がる）。
- 完了報告 §5.7 の `go test ./...` 行と §3.1 の「既存の `m37_01_*` は 1 行も触っていない」を、実測に合わせて訂正すること。
- **手順上の教訓**: 補完を外す positive control（10 件赤）は実施されていたが、**入れたことで既存が赤くなる方向の確認が漏れている。** 新しい既定値・補完を足すサブでは、「外すと赤くなる数」と「入れて赤くなる既存」は別の確認である。

**高-2. 撤回された前提が `m37_01_position_mass_patch_test.go` に残っている。**

- L65 のテスト名注記: `// present + null で NULL クリアできること(他の Optional 列と同じトライステート)` — `start_position_mass` はもはや他の Optional 列と同じではない。区分が決まっている行では明示クリアしても NULL にならない。
- L22-24 のヘッダ: 「本経路は position を触らない。⇒ `normalizePositionAndMass` は Create と UpdateWithKeyChange からしか呼ばれない」は文字どおりには今も真だが、**読者が「`PATCH` はマス数もそのまま保存する」と受け取る位置にある。** 本サブで `PATCH` はマス数を正規化するようになったため、1 行足して `fillStartPositionMassForPatch` を指すこと。
- 高-1 の期待値修正と同じ手番で直すこと。注記だけが旧のまま残ると、後任が本文をコピーして前提ごと複製する。

**高-3. `ComboEditorBasicFields.tsx` L241-243 の注記が失効に近い。**

> ★サーバの PATCH 経路は normalizePositionAndMass を呼ばないため、この振り分けが 食い違いを防ぐ唯一の仕掛けである。

- 前半は今も真である（`normalizePositionAndMass` 自体は呼んでいない）。しかし本サブ以後、サーバの `PATCH` 経路は同関数の補完の半分を適用する。
- この注記は「サーバ側の `PATCH` は始動位置に一切触らない」と読める唯一の場所であり、その前提が半分崩れた。**1 行足して `fillStartPositionMassForPatch` の存在と、それが埋めるのは NULL のときだけで `position` は動かないことを書くこと。**
- 体裁の問題に見えるが、次サブがこの注記を根拠に「サーバは触らないから画面で担保する／しない」を判断しうる。優先度は高で扱う。

**高-4. `docs/progress/progress-log.md` に索引行が無い（完了条件 #10 / G-8）。**

```
$ bash scripts/check-progress-log-index.sh
NG  作業 ID `m37-05` が docs/progress/progress-log.md に現れない(完了報告: docs/progress/M37-05-completion-report.md)
結果: 違反 1 件
```

- 完了報告にも「後工程で追記する」という記録が無い。後続フェーズで追記する計画があるなら、その旨を報告へ 1 行残すこと。無いまま進むと、`M19-04b` 系の落とし方と同じになる。
- 併せて、本レビューで判明した横断課題（高-1 の「入れて赤くなる既存の確認」）を索引行の横断課題欄に 1 行入れる価値がある。

### 中（M38 着手と並行可）

**中-1. 不変条件は片方向しか閉じていない。言い切りに限定を足すこと。**

- `PATCH` は「区分あり ⇒ マス数が入る」を守る。しかし「マス数あり ⇒ 区分が決まっている」は守らない。`position` が不問の行へ `startPositionMass: 80` を送ると、`position` は NULL のまま値だけが入る。`representativeMassFill` の内部テストにある「★不問 ＋ マス数あり ⇒ 触らない」が、その状態を許すことを自ら明文化している。
- **実装の変更は不要である。** 画面からは `setStartPositionMass` が `positionFromMass` で区分を導出するため到達せず、API 直叩きは指示書 §0.4 で射程外、指示書 §7-2 も「別の裁定が要る」としている。
- 直すべきは記述である。完了報告 §0・§5.1 の「不変条件が 3 経路すべてで成り立つ」と `representativeMassFill` の godoc の「不変条件は 1 行である」に、`PATCH` で閉じているのは片方向であること、逆向きは UI の導出と `PUT` 振り分けに依存していることを 1 行で添えること。CHANGE 原稿 §8.1 / §8.3 にも同じ限定を入れると、設計卓が過大な契約を設計書へ書かずに済む。

**中-2. E2E の「サーバ側(PATCH)の補完」を見る 1 本が、実際にはサーバ補完を検証していない。**

- `web/e2e/m37-05-position-mass-invariant.spec.ts` の「編集でマス数を空にして保存すると、代表値で保存される(PATCH)」は、`fill("")` の後に保存ボタンをクリックする。**クリックの前に blur が発火し、画面側の `fillStartPositionMassOnBlur` が 102 を入れてから `PATCH` が飛ぶ。** したがってサーバ側の `fillStartPositionMassForPatch` を外しても、この spec は緑のままである。
- サーバ補完の証拠は Go 側のテストに十分あるため実害は限定的だが、**コメントの「★★★サーバ側(PATCH)の補完。⇒ 画面が埋めなかった経路でも不変条件が守られること」は誤りである。** コメントを実態に合わせるか、blur を経ずに保存する経路（欄に触れない編集）に組み替えること。
- 本レビューで `make e2e-only P=m37-05` を実測し 5/5 緑（40.4s）であることは確認している。

**中-3. `make e2e` 全数が未実測のまま完了報告が出ている。**

- 報告 §5.7 が「§6.4 に記載」、§6.4 が「（Phase C の直前に確定値を記入する）」で空欄。指示書 §5-7 とチェックリスト G-5 は全数を求めている。Phase C の前に必ず埋めること。既知の flaky（`m19-03-setup-results.spec.ts`）に当たった場合は、`M37-03` と同じく切り分けを添えること。

**中-4. `UpdateMetadata` の `FindByID` を 1 回に寄せること。**

- 追加された `currentForMass, findErr := s.repo.FindByID(ctx, id)` は、`promoting` 分岐と `!promoting` 分岐のどちらを通っても**必ず直前に 1 回実行済み**である。`FindByID` は steps / tags / okiOptions / starterMoveCode を伴う重い読み取りで、PATCH 1 回あたりの DB 往復が明確に増える。
- 関数先頭で 1 回引いて共有する形にすれば、エラー面を変えずに削れる。既存 3 か所の重複も同時に畳めるが、射程が広がるなら本サブでは新規追加分だけでも良い。

### 低（将来対応）

- **低-1.** `csvcore` の非退行テストが `ExportCSV` 往復で空セルを作っている。E-2 の床としては、ヘッダ行と空セルを含む生の CSV テキストを直接 `ParseAndValidate` に渡す形の方が強い（`ExportCSV` 側の仕様変更で床が静かに動かなくなるため）。
- **低-2.** `fillStartPositionMassForPatch` の godoc に位置依存の注記が無い。同関数は `ValidateMetadataRanges` / `ValidateRequiredForPublished` より後で `input` を書き換える。将来 `start_position_mass` が本登録の必須欄や相関検証の対象になると順序が効く。「検証より後・`repo.UpdateMetadata` の直前に呼ぶこと」を 1 行で足すと安全である。
- **低-3.** `representativeMassFill` は値を返すだけで代入しない。名前が代入を示唆するため、`representativeMassFor` 等の取得動詞の方が実体に近い。godoc で補われているため実害は小さい。
- **低-4.** 画面側の先回り補完は「マス数欄を触って離れた」ときにしか働かない。区分が決まっていてマス数が NULL の行をメモだけ直して保存すると、値はサーバ補完で入り、利用者からは保存後に生えて見える。開発者実測でその形の既存行は 0 件であり、UI の通常操作でも作れないため実害は無いが、指示書 §0.6 の観点では残余である。将来 `M37-04` 以降で編集画面のマウント時補完を検討する余地がある。
- **低-5.** `TestPatch_ClearMass_FillsRepresentative` が代表値 7 個をベタ書きしている。本人も注記で「第 3 の出所ではない」と断っており、外形固定として妥当だが、`TestRepresentativeMassFill_CoversAllBands` が表駆動で同じ面を見ているため重複ではある。将来値が変わったときに直す箇所が 1 つ増える点だけ認識しておくこと。

---

## 良かった点

- **最大の危険を正面から避けている。** 指示書 §0.3 の (b) を持ち込まず、補完の半分だけを関数として切り出した。案 B（引数で導出を切る）と案 C（`PATCH` 側に表を書く）の却下理由が具体的で、とくに案 B の「次の担当が既定で導出付きを呼ぶ」は `CHANGE-195` の穴と同型だという指摘が的確である。
- **破壊確認とその対照を両方置いた。** 区分をまたぐ `PATCH` で `position` が動かないことに加え、「補完を外すと 10 件赤・ただし不問と区分またぎは緑のまま」という positive control を実測で記録している。「効いている」と「効きすぎていない」を分けて測る形は、そのまま後任の型になる。
- **運び量を構造で守った。** `onBlur` を始動位置にだけ渡す形は、案 B（ラッパで `focusout` を拾う）と比べて「将来まとめられた瞬間に運び量まで埋まる」事故を JSX の上で見えるようにしている。props 完全一致テストを 6 → 7 に広げた理由と、層 2 を 1 文字も触っていないことの説明も筋が通っている。
- **段 1 の実査を正直に書いた。** クラウドのクリーンクローンでは測れないことを明示し、開発者実測として件数を受け取り、後任が追試できる SQL を残した。「実測（開発者）」と「実測（本セッション）」の書き分けも守られている。
- **射程を守った。** `followup-backlog.md`・設計書本体・マイグレ・CHANGE 番号のいずれにも手を出していない。CSV / API へ新しい拒否も足していない。
- **`E-225` の観点を自分で確認している。** 新規 5 ファイルがすべて deletions 0 であること、削除 7 行の内訳（`service.go` 4 / `MassPercentInput.test.tsx` 2 / `MassPercentInput.tsx` 1）が説明されており、本レビューの `git diff --numstat` と一致した。

---

## 本レビューで実測した値

| 対象 | 結果 |
|---|---|
| `git diff --numstat 9a4d391` | 新規 5 ファイルはすべて deletions 0。削除は `service.go` 4 / `MassPercentInput.test.tsx` 2 / `MassPercentInput.tsx` 1 の計 7 行で、完了報告の内訳と一致 |
| `go test ./internal/...` | **FAIL 1 件**（`TestUpdateMetadata_PositionMass_ClearsWithPresentNull`）。他パッケージはすべて ok |
| `pnpm test`（全数） | 緑。233 ファイル / 2909 テスト（130.5s） |
| `make e2e-only P=m37-05` | 緑。5 passed（40.4s） |
| `make e2e`（全数） | 未実施（本レビューでも未実測。中-3 を参照） |
| `bash scripts/check-import-order.sh` | 99 / ベースライン 99（本番 14 ／ テスト 85）。違反なし |
| `bash scripts/check-enum-sync.sh` | ベースラインどおり（増加なし） |
| `bash scripts/check-progress-log-index.sh` | **違反 1 件**（`m37-05` の索引行が無い） |
| `normalizePositionAndMass` の呼び出し箇所 | 2 か所（`service.go:343` Create ／ `service.go:826` UpdateWithKeyChange）。対照値どおり |
| `MassPercentInput` の呼び出し元 | 2 か所（始動位置 `onBlur` あり ／ 運び量 `onBlur` なし）。`disabled` はどちらも渡していないため、同 props の注記は失効していない |

---

## 不明点

- 不明: 完了報告 §5.7 が `go test ./...` を緑と記録した時点で何を実行したのかは判断できない。現 HEAD（`317cdd6`）では赤であり、`-run` による絞り込みか、変更前の実行結果を転記したかのいずれかと推測されるが、コード上からは確定できない。
- 不明: `make e2e` 全数の結果は、本レビューでも実行していないため判断できない（実行時間の都合。中-3 として未実測のまま残す）。

---

## 制約事項

- 本レビューはコード上で判定可能な範囲のみ対象。実際の動作確認・パフォーマンス・実機テストは別途実施が必要。

---

*以上、M37-05 レビュー報告書。* 最優先は高-1（`go test ./...` が赤）である。赤の中身は実装の欠陥ではなく、旧挙動を固定した既存テストと注記が残っていることであり、高-2 と同じ手番で直すのが正しい。

---

## 取り込み結果（自動トリアージ）

**実施日**: 2026-09-13（`implement_plan_full` Phase C） ／ **再レビュー往復**: 0 回（初回のみ・上限 2 回に未達）

**★★★「高」指摘の不採用は 0 件である。⇒ 開発者へのエスカレーションは発生していない。**

| # | 指摘 | 採否 | 理由と対応 |
|---|---|---|---|
| **高-1** | `go test ./...` が赤 | **採用** | **自分で再実行して確認した**（`EXIT=1`）。**★指摘のとおり実装の欠陥ではなく、`D-864` が意図的に変えた挙動を旧のまま固定した既存テストであった。** ⇒ `startPositionMass` の期待を代表値 `80` へ、`carryDistanceMass` の `nil` 期待は**そのまま残した**（トライステートが SET 句まで届く証拠であり、むしろ価値が上がる）。`position` 不動の確認も足した。完了報告 §3.1 / §5.7 の誤記も訂正した |
| **高-2** | `m37_01_*` の注記 2 か所が失効 | **採用** | ヘッダに「マス数はもう素通しではない／`position` は依然書かない／`carry` は埋めない」を 7 行、テスト名注記に「他の Optional 列と同じではない」を追記し、`m37_05_*` の該当テストを指した |
| **高-3** | `ComboEditorBasicFields.tsx` L241-243 の注記 | **採用** | 「サーバの `PATCH` は*触らない*わけではなくなった／ただし `position` は書かないので `PUT` 振り分けは依然必要」を 8 行で追記した |
| **高-4** | `progress-log.md` に索引行が無い | **採用** | Phase D で追記。`check-progress-log-index.sh` が違反 0 件になったことを確認した |
| **中-1** | 不変条件が片方向しか閉じていない | **採用**（記述のみ） | **指摘のとおり実装変更は不要**。`representativeMassFor` の godoc、完了報告 §0 / §5.1、CHANGE 原稿 §8.1 / §8.3 に「閉じるのは片方向」「逆向きは UI 導出と `PUT` 振り分けが担う」を明記した |
| **中-2** | E2E の 1 本がサーバ補完を検証していない | **採用（強化）** | 指摘のとおりであった。コメントを実態へ直したうえ、**`PATCH` の要求本文に `102` が載っていることを直接検証する形へ変えた**。⇒ 指示書 §0.6 の証拠がワイヤ上に出る。**★画面側の補完を無効化すると本文が `null` になり赤くなることを実測した**（positive control） |
| **中-3** | `make e2e` 全数が未実測 | **該当なし** | レビュー対象 `317cdd6` の時点では空欄だったが、`fe2a32b` で記入済み（350 passed）。**Phase C 後に再度全数を回している** |
| **中-4** | `FindByID` が 1 回増えた | **採用** | 指摘のとおり、既存 3 か所も含め必ず 1 回は先に実行済みであった。`UpdateMetadata` 内にメモ化クロージャ `currentBefore()` を置き、**4 か所すべてをそれ経由にした**。**★各呼び出し元のエラーの扱いは 1 文字も変えていない** |
| **低-1** | CSV 非退行が `ExportCSV` 往復 | **採用** | 生の CSV テキストを直接 `ParseAndValidate` へ渡すテストを 1 本追加。ヘッダは `CSVColumns` から組む（写経すると列追加で落ちるため）。レシピのセル内 JSON を含むため `encoding/csv` で組んだ |
| **低-2** | 呼び出し位置の注記が無い | **採用** | `fillStartPositionMassForPatch` の godoc に「検証より後・`repo.UpdateMetadata` の直前」と、**将来必須欄・相関検証の対象になったら前へ移すこと**を書いた |
| **低-3** | `representativeMassFill` の命名 | **採用** | **`representativeMassFor` へ改名**（値を返すだけで代入しないため）。呼び出し 2 か所とテスト関数名も追随 |
| **低-4** | 画面の先回り補完は欄を触ったときだけ | **不採用（記録のみ）** | **★実装しない。** (1) 開発者実測でその形の既存行は **0 件** (2) UI の通常操作では作れない (3) **指示書 §2.2-1′ が「メモだけの `PATCH` でも代表値が入る」ことを*意図した形*として明記している**。⇒ マウント時補完は射程超過。**残余であることは完了報告 §10.4 に記録した** |
| **低-5** | 代表値 7 個のベタ書きが重複 | **不採用（記録のみ）** | **意図した外形固定**である（本レビュー自身も「外形固定として妥当」と評価）。表駆動の `TestRepresentativeMassFor_CoversAllBands` と役割が違う——片方は表から期待値を作り、片方は表の外から値を固定する。**両方が緑でなければ「表が変わったのか実装が変わったのか」を切り分けられない** |

### ★不明点への回答

- **「`go test ./...` を緑と記録した時点で何を実行したのか」** —— **実行はしていた。⇒ 判定を誤った。**
  コマンドが `go test ./... 2>&1 | grep -v "^ok\|no test files" | head -20; echo "=== GO ALL DONE ==="` であり、
  **(a) `head -20` が `FAIL` 行を切り落とし (b) 報告された終了コードはパイプ末尾の `echo` のものであった。**
  **⇒ 一般形＝全数テストの合否はパイプを挟まずファイルへ落とし、終了コードで見ること。** 横断課題として `progress-log.md` へ 1 行残した。
- **「`make e2e` 全数」** —— レビュー時点で未記入だったのは情報差であり、`fe2a32b` で記入済み（350 passed / 失敗 0）。Phase C 後に再度全数を実行している。
