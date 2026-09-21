# M38-01 レビュー報告書

| 項目 | 内容 |
|------|------|
| 対象指示書 | `docs/instructions/M38-01-combo-editor-required-and-domain.md` v1.0.0 |
| チェックリスト | `docs/instructions/reviews/M38-01-review-checklist.md` v1.0.0 |
| 着手基点 | `7ce1393` |
| レビュー対象コミット | `dc2848f` / `ef176b7` / `adfffe8` / `919beb7` / `13e9246` / `01a5fe3` / `d9a4dc4` |
| レビュー実施日 | 2026-09-17 |
| レビュー時 HEAD | `d9a4dc4` |

> レビュー着手時の HEAD は `13e9246` だったが、作業中に `01a5fe3`（完了報告）と `d9a4dc4`（失効記述の是正 3 件）が積まれた。本レビューは `d9a4dc4` 時点のツリーを対象とする。

---

## 総評

射程 5 件はいずれも指示書の要求どおりに実装されており、落とせない条件（列を足さない・欄数 4 を維持・値域 8 値を動かさない・既存 NULL 行を書き換えない・必須でない欄を上へ混ぜない）はすべて守られている。とくに「不問と空のままは payload では同じ null であり、区別が残るのはフォーム state だけ」という判断と、その帰結として門を `requiredPublished.ts` に置いた設計は正しく、BE 側の `present()` を常に真にした理由も破壊確認テスト付きで残されている。段 1 の実査も (A) 分岐の根拠まで実測で書かれており、実 DB が無い 1-2 / 1-3 を推測で埋めていない。

一方で、本サブが自ら最重要と位置づけた「失効した記述の是正」に取りこぼしがある。完了報告 §3-6 は 7 件を直したと書くが、全数走査すると同種の記述が最低 22 か所残っている。うち 1 件は本サブが反転させた挙動そのもの（矢印キーの増減）を「残る（実測で確認）」と書いた本番コードの注記であり、後任が読めば確実に誤る。

加えて、`check-progress-log-index.sh` がレビュー時点で赤（`m38-01` の索引行なし）である。設計書への波及（CHANGE 原稿の候補）も、並び替え（射程 2）が `DES-005` §5.7 に及ぶ点と、`hit_type` 既定変更が VAL-C02 の重複判定に及ぼす帰結が挙がっていない。

---

## 設計準拠性レビュー結果

### A. 段 1 の実査

| # | 項目 | 評価 | 所見 |
|---|---|---|---|
| A-1 | 「不問」の正体が実測で書かれているか | ◎ | 選択肢の実体（`withUnspecifiedFirst(HIT_TYPE_OPTIONS)`）・保存値（NULL）・既定（空文字）・「1」の正体（`shortcutKeyForIndex(0)` の数字キー）まで実測。実査より先に §2.5 を直した形跡はない（`dc2848f` が射程 1、`ef176b7` が射程 5 で、完了報告 §2 が先行して書かれている） |
| A-2 | `hit_type` NULL 既存行の件数 | ○ | 「測っていない」と明記し、`find . -name '*.db'` が 0 件・`.gitignore:30` が `*.db` を除外という根拠を添えている。推測で件数を埋めていない |
| A-3 | 寄せたときの重複判定キー衝突 | ○ | 同上。測れないので測っていないと書き、代わりに「寄せない」判断の根拠を 3 点挙げている |
| A-4 | 実 DB が無いときに止まったか | ○ | 開発者へ諮り 2026-09-17 裁定で決着。指示書 §2.1 の要求を満たす |
| A-5 | (A)(B)(C) のどれを採ったかと根拠 | ◎ | (A) を採り、(B) でない根拠（`HIT_TYPE_OPTIONS` / `HIT_TYPE_VALUES` / `model.HitType*` がいずれも 8 値）と (C) でない根拠（`opponent_stance` は別欄・`stanceOptionsFor` を通る）を両方書いている |

### B. 必須の入れ替えと「不問」

| # | 項目 | 評価 | 所見 |
|---|---|---|---|
| B-1 | `VAL-C15` が 4 欄のままで中身が入れ替わったか | ◎ | 4 か所すべてで入れ替え済み（`validation/combo.go` / `csvcore/validate.go` / `constants/field-requirement.ts` / `schema.ts`）。欄数は 4 のまま |
| B-2 | 外した 2 欄の値域担保が生きているか | ◎ | `clampNumericString` は 1 文字も触られていない。`DES-006` §2.5 が「範囲 VAL 非連動」を定めており BE / zod に範囲 ERROR が元から無いことも正しく引いている。E2E で 25→20 / 9→6 を固定 |
| B-3 | 「不問」を選ぶと NULL が入るか・列を足していないか | ◎ | `git diff 7ce1393 -- migrations/` が 0 行、`ALTER TABLE` / `ADD COLUMN` の追加も 0。`*Any` はフォーム state のみで送信されない |
| B-4 | placeholder に薄く「不問」が出るか | ◎ | `placeholder={any ? UNSPECIFIED_LABEL : undefined}`。空のまま（未入力）では出さない対照テストも在り、「空」と「不問」が画面で見分けられる |
| B-5 | 空のままは保存できず、不問は保存できるか | ◎ | `requiredPublishedIssues` が両者を分けており、単体テストが `|| b.*Any` を落とす側と `|| true` にする側の両方から挟んでいる |
| B-6 | 既存行の NULL を書き換えていないか | ◎ | `hitType: initial.hitType ?? ""`（`?? HIT_TYPE_NORMAL` にしていない）。開始残量は `initial.x == null` を `*Any` へ写すだけで値は書き換えない |

**補足（減点ではないが契約の記録が要る）**: BE / CSV の新 2 欄の `present()` を常に真にした結果、サーバ側 `VAL-C15` は 4 欄中 2 欄を強制しなくなった。⇒ 指示書 §0.2 の「保存された NULL は必ず不問である」は、**エディタ経路に限った命題**になる。API 直叩き・CSV 取込・`Materialize`・仮登録からの昇格は、不問の意思なしに NULL を書ける。CSV については `csvcore/validate.go` に「空セル = 不問として通す。これは仕様である」と明記されており良いが、**API / materialize / 昇格については同等の記述が無い**。詳細は「推奨修正 中-1」。

### C. 操作性

| # | 項目 | 評価 | 所見 |
|---|---|---|---|
| C-1 | 矢印キーで数値が変わらずフォーカスが動くか | ○ | `keyIsClaimedByField` から number 分岐を落とし、呼び出し元が `preventDefault()` してから `move()` する形。E2E は先頭の停止点（ダメージ）を避けて有利フレームで見ており、「奪っていない」と「戻り先が無い」の取り違えも回避している。**ただし効くのは `useFieldSequence` が張られた基本情報タブ内だけ**（推奨修正 中-4） |
| C-2 | スピナーが残っていないか | ◎ | `NO_SPINNER` は `M24-12` で全撤去済み。本サブで消す作業は無かったと正しく報告し、E2E で `appearance: textfield` を 1 本固定している。射程外の `SetplaySuggestionSection.tsx` を横断課題へ回したのも妥当 |
| C-3 | 必須項目が上にまとまり、必須でないものが混ざっていないか | ◎ | 「必須の印が先頭に 4 つ連続し、それ以降には 1 つも無い」を DOM 順で数える単体テストが在る。任意 10 欄の相対順は不変で、重複判定キーの塊（`M37-07`）も数字キー割当も動いていない |
| C-4 | 採った並びと理由が報告に在るか | ◎ | 3 案の比較（スイッチ / 入力方式ピル / 事後解決型）と、並びの理由 4 点、代償（開始残量と消費が離れた）まで書かれている |

### D. ヒット種別

| # | 項目 | 評価 | 所見 |
|---|---|---|---|
| D-1 | 選択肢から「不問」が消えているか | ○ | 新規では 8 値ちょうど。NULL の既存行を開いたときだけ末尾に `(未指定)` が出る意図的な例外があり、完了報告 §7 に申し送られている。呼び名を「不問」にしなかった判断は妥当（`stanceOptionsFor` と同型） |
| D-2 | 既定が `normal` か | ◎ | `HIT_TYPE_NORMAL` を新設し `initialHitType ?? HIT_TYPE_NORMAL`。単体・E2E 双方で「先頭が `normal` で checked」を固定 |
| D-3 | 値域 8 値を動かしていないか | ◎ | `HIT_TYPE_OPTIONS` / `HIT_TYPE_VALUES` / `model.HitType*` いずれも差分 0。`role="radio"` の数が `HIT_TYPE_VALUES.length` ちょうどであることを単体テストが固定している |
| D-4 | マイグレの `UPDATE` 形式 | — | マイグレを使っていないため対象外 |
| D-5 | `000118` を未消費で返したか | ◎ | 完了報告 §7 に明記。`migrations/` の差分 0 で裏付けあり |

**補足（記録漏れ）**: 既定を NULL から `normal` へ変えた帰結として、`DES-006` §2.3 の「NULL 同士は一致」により、**既存の `hit_type` が NULL の行と、新規に保存される `normal` の行は重複判定で別物になる**。⇒ 見た目が同じコンボを 2 件登録できる状態が新たに生じる。`constants/combo-list.ts` の注記は「保存値が変わる」「キーの 1 つである」までは書いているが、この帰結そのものは書かれていない。詳細は「推奨修正 中-2」。

### E. 射程

| # | 項目 | 評価 | 所見 |
|---|---|---|---|
| E-1 | 列を 1 つも足していないか | ◎ | マイグレ差分 0・スキーマ差分 0 |
| E-2 | `M38-02` の面を触っていないか | ◎ | 技編集・改名に関わるファイルの差分は 0 |
| E-3 | `docs/design/` 本体・`followup-backlog.md` の差分が 0 行か | ◎ | `git diff --numstat 7ce1393 -- docs/` は `docs/progress/M38-01-completion-report.md` の 1 本のみ。設計書本体・`followup-backlog.md` とも差分 0 |
| — | 射程外の「不問」に手を出していないか | ◎ | `withUnspecifiedFirst` は `POSITION_OPTIONS` と `OPPONENT_SIZE_OPTIONS` に残されている（開発者裁定どおり） |

### F. 報告・検査

| # | 項目 | 評価 | 所見 |
|---|---|---|---|
| F-1 | 完了報告 + `progress-log` の索引行 | △ | 完了報告は `01a5fe3` で作成済み。**`progress-log.md` への索引行が無く、`check-progress-log-index.sh` が「違反 1 件」を返す**（推奨修正 高-4） |
| F-2 | CHANGE 原稿が設計伝達レポートの §1 と §6 に在るか | 不明 | `docs/handover/design-reports/` に `M38-01` の設計伝達レポートが存在しないため判定できない。完了報告 §6 は「原稿は §1 と §6 へ置く」と宣言しており方針は正しい |
| F-3 | 完了報告を書いた後に、報告を入力に取る検査を回し直したか | × | 上記のとおり `check-progress-log-index.sh` が赤のまま。まさに `M36-01` §7-1 で踏んだ型 |
| F-4 | 全数テストの出力を落とし `EXIT=` と `FAIL` 件数を貼っているか | ○ | 完了報告 §5 に `GO_EXIT=0` / `VITEST_EXIT=0` / `TSC_EXIT=0` / `E2E_EXIT=0`・361 passed と記載 |

**レビュー側で独立に回した検査**

| 検査 | 結果 |
|---|---|
| `go test ./internal/...` | 全パッケージ ok |
| `cd web && pnpm test` | 235 files / 2982 tests passed |
| `pnpm exec tsc --noEmit` | `TSC_EXIT=0` |
| `bash scripts/check-import-order.sh` | 違反なし（99 / ベースライン 99） |
| `bash scripts/check-enum-sync.sh` | ベースラインどおり |
| `bash scripts/check-browser-storage-keys.sh` | 違反なし |
| `bash scripts/check-progress-log-index.sh` | **違反 1 件**（`m38-01` が `progress-log.md` に無い） |
| `bash scripts/check-md-emphasis.sh docs/progress/M38-01-completion-report.md` | 検出 0 行 |
| `make e2e-only P=m38-01` | **実行できず**。ポート 47390 を使う E2E スタックが同時に稼働中だったため。E2E の緑は完了報告の記載に依拠している |

---

## 設計準拠性以外の指摘事項

### 1. 失効した記述の全数走査（本サブが自ら最重要と置いた点）

完了報告 §3-6 は 7 件を是正したと書くが、走査すると同種の記述が残っている。件数は `grep` の全数走査で出した（`head` / `tail` で切っていない）。

**(a) 本番コードの注記が、本サブで反転した挙動を「残る」と書いている（1 件）**

`web/src/features/combo/numericInput.ts:28`

```
 *   ⇒ 見た目のボタンだけを CSS で消す。**矢印キーでの増減は残る**(実測で確認)。
```

射程 1 で増減は止まった。⇒ この行は現在の挙動と正反対である。しかも `NO_SPINNER` の docstring という、次に数値欄をいじる人が必ず読む場所に在る。**テストも lint も型検査も緑のまま通る型**であり、本プロジェクトの較正基準では「高」。

**(b) 「必須 4 欄 = ダメージ / 有利フレーム / 消費ゲージ 2 欄」と読める注記（22 か所ヒット・うち要是正 19 か所）**

`grep -rn -A6 "必須 4 欄\|必須欄"` で拾い、直後 6 行に `driveGaugeConsumed` / `saGaugeConsumed` 系が現れるものを数えた結果は **22 件**。うち 3 件は是正済みまたは問題なし（`web/e2e/support/combo-io.ts:42` は `d9a4dc4` で是正済み、`internal/service/combo/service.go:1675` も是正済み、`web/src/features/combo/components/ComboEditor.tsx:425` は列挙を含まない一般的記述）。残る 19 か所は下表。

| # | 箇所 | 補足 |
|---|---|---|
| 1 | `web/src/features/combo/components/ComboEditor.conflict.test.tsx:198` | **二重に失効**。「必須 4 欄」に消費ゲージを含めており、かつ「無いと保存が zod で止まり」と書くが、zod からは 2 欄とも外れている |
| 2 | `web/e2e/combo-csv-io.spec.ts:70` | 「本登録行は必須 4 欄が要る」 |
| 3 | `web/e2e/combo-csv-io.spec.ts:82` | 同上 |
| 4 | `web/e2e/support/interference-probe.ts:110` | 「必須 4 欄。欠けると 400 になり」。実際は 400 になるのは damage / knockdown_advantage を欠いたときだけ |
| 5 | `web/e2e/m18-03b-materialize.spec.ts:89` | 同型 |
| 6 | `internal/api/combo/scope_test.go:134` | 「必須 4 欄。無いと 400 になる」＋ dg / sa を列挙 |
| 7 | `internal/api/combo/scope_test.go:193` | 同上 |
| 8 | `internal/service/comboio/service_test.go:128` | 同型 |
| 9 | `internal/service/comboio/service_test.go:274` | 同型 |
| 10 | `internal/service/comboio/service_test.go:551` | 同型 |
| 11 | `internal/service/comboio/service_test.go:617` | 同型 |
| 12 | `internal/service/comboio/multiuser_test.go:130` | 同型 |
| 13 | `internal/service/notation/setup_resolver_test.go:55` | 同型 |
| 14 | `internal/service/notation/cache_test.go:54` | 同型 |
| 15 | `internal/service/notation/resolver_test.go:49` | ヘルパの用途説明 |
| 16 | `internal/service/validation/combo_test.go:95` | `validBaseCombo` の fixture 注記 |
| 17 | `internal/service/combo/service_test.go:113` | 同型 |
| 18 | `internal/service/combo/service_test.go:231` | 同型 |
| 19 | `internal/service/combo/service_test.go:771` | 「必須 4 欄を空にする」と書きながら dg / sa を nil にしている。同ファイル 790 行台は `d9a4dc4` で是正されており、**同じテスト関数の中で新旧が同居している** |

加えて `internal/service/combo/materialize_required_fields_test.go:79-80` の診断メッセージが `必須 4 欄が空になっていない: damage=%v ka=%v dg=%v sa=%v` のままで、`dg` / `sa` は `blankRequiredFields` が空にしなくなった列を表示している（ヘルパ本体は是正済みなので、メッセージだけが取り残された）。

> **なぜ「低」に落とさないか**: 後任は fixture をコピーして使う。「本登録には dg / sa が要る」という前提が複製され、必須でなくなった欄を埋め続ける fixture が増える。本プロジェクトが `M19-DESIGN-08` §3.1 / `D-250` で見たのと同型である。

**(c) 用途が変わった定数の docstring（2 件）**

- `web/src/features/combo/labels.ts:34-40`: `LEGACY_UNSPECIFIED_LABEL` の説明が「**相手の状態**の空選択肢の呼び名」に限定されている。本サブで `hitTypeOptionsFor` も同じ定数を使うようになった。⇒ 「同じ欄に『不問』が 2 つ並ぶのを避けるため」という理由づけも、ヒット種別には当てはまらない（あちらに `any` は無い）
- `web/src/features/combo/components/ComboEditorBasicFields.tsx` の `withUnspecifiedFirst` docstring: 「『相手の状態』はこれを使わない」とだけ書いており、**ヒット種別も使わなくなった**ことが書かれていない。⇒ 次に「4 欄へ一律に足す」判断が復活しうる

**(d) 実測の根拠が縮小した注記（2 件）**

- `web/src/features/punish/materializeError.ts:9-11`
- `web/src/features/punish/components/PunishList.tsx:152-154`

いずれも「`D-724` の実測＝既存の本登録 83 件のうち 68 件が必須 4 欄のいずれか空。⇒ 400 は稀な異常系ではない」と書く。本サブでサーバが咎めるのは damage / knockdown_advantage の 2 列だけになったため、68 件という母数は現在の必須定義に対する数ではない。挙動（理由を捨てない）は正しいままなので優先度は中。

### 2. アクセシブル名に testid が漏れている

`ComboEditorBasicFields.tsx` の `GaugeAtStartInput`:

```tsx
aria-label={`${UNSPECIFIED_LABEL}(${testId})`}
```

スクリーンリーダーは `不問(combo-editor-drive-available)` と読み上げる。⇒ 内部識別子が利用者に露出する。どの欄の不問かを区別したいのが動機なら、欄ラベル（`gaugeFieldLabelJa("start", "drive")`）を使うべきである。`web/src` 内で `aria-label` に `data-testid` の値を埋めている箇所は本 2 か所のみ。

### 3. E2E 共有ヘルパ `fillRequiredComboFields` が冪等でない

`web/e2e/support/editor-input.ts` は `combo-editor-drive-available-any` を `click()` している。⇒ トグルであるため、**既に不問が ON の状態で呼ぶと OFF になり、保存が VAL-C15 で止まる**。現在の呼び出し元 9 か所はいずれも新規登録画面（既定 OFF）なので緑だが、編集画面で使った瞬間に落ちる。`isChecked()` で分岐するか、数値を入れる形にしておくほうが共有ヘルパとしては堅い。

### 4. 計算プロパティ名が型検査を素通りする

`setGaugeValue` / `setGaugeAny` は `` [`${field}Any`] `` でキーを組み立てている。⇒ `BasicFieldsValue` の `keyof` チェックが効かず、将来 `driveAvailableAtStartAny` を改名しても**コンパイルは通り、実行時に静かに別キーへ書く**。`Record<"driveAvailableAtStart" | "saAvailableAtStart", "driveAvailableAtStartAny" | "saAvailableAtStartAny">` の対応表を挟めば型で守れる。同ファイルの他の注記が「型検査もテストも緑のまま落ちる型」を繰り返し警戒しているだけに、ここだけ素通りなのは惜しい。

### 5. `REQUIRED_PUBLISHED_FIELDS_CANON` は要らない

`requiredPublished.ts` の末尾で「import を無駄にしないための静的な結び付け」として再エクスポートしているが、同ファイルは `RequiredPublishedComboField` を型として import しており、**正典ファイルを消せばその時点でコンパイルが落ちる**。⇒ 目的は既に達成されている。本番コードに用途のない公開定数が 1 つ増えているだけになっている。

### 6. 良好だった規約準拠

- JSON タグ / DTO はいずれも camelCase（新規フィールドは state のみで DTO 増なし）
- 新規依存 0、`console.log` / `fmt.Println` の混入なし、`eslint-disable` / `nolint` の追加なし
- 新規ファイル 3 本はすべて `deletions = 0`（`E-225` の観点で確認済み。レビュー側でも `git diff --numstat` で再確認した）
- Go 側の列挙定数と TS 側定数の同期（`model.HitTypeNormal` ↔ `HIT_TYPE_NORMAL`）が守られており、`check-enum-sync.sh` もベースラインどおり
- import 順は新規ファイルも規約どおり（製造側が一度赤にして是正したことを完了報告に正直に書いている点も良い）

---

## 推奨修正（優先度別）

### 高（M38 完了前に修正必須）

- **高-1**: `web/src/features/combo/numericInput.ts:28` の「矢印キーでの増減は残る（実測で確認）」を実態へ是正する。本サブで反転した挙動を本番コードの docstring が正反対に記述している状態を残さない。
- **高-2**: 上表 19 か所 ＋ `materialize_required_fields_test.go:79-80` の「必須 4 欄 = 消費ゲージを含む」記述を是正する。全数を直すのが重ければ、少なくとも (i) 同一テスト関数内で新旧が同居している `internal/service/combo/service_test.go:771`、(ii) 二重に失効している `ComboEditor.conflict.test.tsx:198`、(iii) 400 の理由を誤って説明している `interference-probe.ts:110` と `scope_test.go:134,193` を先に直し、残りを設計伝達レポート §4 へ「残作業」として必須 5 フィールドで記録すること。
- **高-3**: `LEGACY_UNSPECIFIED_LABEL`（`labels.ts:34-40`）と `withUnspecifiedFirst`（`ComboEditorBasicFields.tsx`）の docstring を、用途が増減した実態へ合わせる。とくに後者は「ヒット種別も通さなくなった」を明記しないと、次に同じ一律付与が復活しうる。
- **高-4**: `docs/progress/progress-log.md` へ `m38-01` の索引行を追記し、`bash scripts/check-progress-log-index.sh` を緑に戻す。完了条件 9 / 12 とチェックリスト F-1 / F-3 に直接該当する。

### 中（M39 着手と並行可）

- **中-1**: サーバ側 `VAL-C15` が 4 欄中 2 欄を強制しなくなったことの契約上の帰結を、CHANGE 原稿（設計伝達レポート §1 / §6）へ明記する。⇒ 「保存された NULL は必ず不問」はエディタ経路限定の命題であり、API 直叩き・`Materialize`・仮登録からの昇格は不問の意思なしに NULL を書ける。CSV についてのみ `csvcore/validate.go` に明記があるので、同等の記述を `validation/combo.go` にも 1 行足すとよい。
- **中-2**: `hit_type` の既定変更が VAL-C02 に及ぼす帰結を完了報告と CHANGE 原稿へ記録する。`DES-006` §2.3 は「NULL 同士は一致」と定めているため、既存の NULL 行と新規の `normal` 行は別キーになり、見た目が同じコンボを重複登録できる状態が新たに生じる。マイグレを作らない判断の代償として、完了報告 §7 の「意図的な例外」は現在 `(未指定)` の表示 1 件しか挙げていない。
- **中-3**: CHANGE 原稿の対象へ `DES-005` §5.7 を加える。射程 2 で入力欄の並びが変わったため §5.7 の入力項目の列挙（8. ダメージ / 9. drive_damage / 有利フレーム …）が実態とずれ、同節の「正典は `REQUIRED_PUBLISHED_COMBO_FIELDS`。サーバ側の `requiredPublishedFields` と対であり、片側だけ足すと画面は通るのに保存で落ちる」も新 2 欄については成り立たなくなった。完了報告 §8 は §5.7 のボタン数（8 対 9）にしか触れていない。
- **中-4**: 矢印キーの抑止が `useFieldSequence` を張った基本情報タブ内だけである旨を完了報告へ明記する。⇒ レシピタブ・セットプレイ・プリセット等の `type="number"` は従来どおり矢印で増減する。射程の線引きとして妥当だが、スピナー（`NO_SPINNER` は 12 箇所へ適用済み）とは適用範囲が違うため、書いておかないと「全欄で止めた」と誤読される。
- **中-5**: `GaugeAtStartInput` の `aria-label` から testid を外し、欄ラベルを使う。
- **中-6**: `materializeError.ts` / `PunishList.tsx` の `D-724` 実測注記に、本サブで必須欄が絞られた旨を 1 行足す。
- **中-7**: `fillRequiredComboFields` のトグル操作を冪等にする（`isChecked()` で分岐、または数値を入れる）。

### 低（将来対応）

- **低-1**: `setGaugeValue` / `setGaugeAny` の計算プロパティ名を型で守れる対応表へ置き換える。
- **低-2**: `REQUIRED_PUBLISHED_FIELDS_CANON` を削除する（型 import で同じ保証が得られる）。
- **低-3**: `keyIsClaimedByField` の未使用引数 `_key` と関数名を、textarea 専用になった実態へ寄せるか、コメントどおり将来の分岐余地として残すかを明示する。
- **低-4**: `OptionButtonGroup` の `testIdPrefix` の docstring が「個々のボタンは `${testIdPrefix}-${value}` になる」と書くが、実際は空文字が `unspecified` へ変換される。本サブの E2E がその変換に依存しているため、docstring 側を実態へ寄せると読み違いが減る（既存の記述であり本サブ起因ではない）。

---

## 良かった点

- **門の置き場の判断が正しく、理由が逐語で残っている**。「不問と空のままは payload で同じ null になる」「区別が残るのはフォーム state だけ」という推論から `requiredPublished.ts` を新設した判断は本サブで最も重い設計判断であり、BE 側の `present()` を常に真にした理由も同じ論理で説明されている。`TestC15_StartGauges_NilIsNotError` という「`!= nil` へ直すと赤くなる」破壊確認まで置いてあり、将来の善意の修正で不問の保存が 400 になる事故が構造的に防がれている。
- **正体を確かめてから消している**。「1 不問」の「1」が `shortcutKeyForIndex(0)` の数字キー表示であることまで突き止めており、開発者の「過去の実装担当が仕込んだバグの可能性」という見立てを、実測に基づいて「`M24-12` の開発者指示の副作用」と訂正している。指示書 §4.1 が最大の危険と置いた「正体を確かめずに消す」を回避できている。
- **消しすぎていない**。`hitTypeOptionsFor` が「読み込んだ値が空のときだけ末尾へ `(未指定)`」という形を採り、しかも先頭ではなく末尾に足すことで 8 値の数字キー割当を保っている。`stanceOptionsFor` という既存の型を写しており、新しい仕組みを作っていない。呼び名を「不問」にしなかった判断も適切。
- **キーボード経路の罠を先回りして潰している**。「入力欄を `disabled` にすると `focusableIn` が外側と入れ子で同じトグルを指して順送りが詰まる」「トグルを入力欄より DOM 上で後ろに置く」「トグルを独立した `data-seq-stop` で包む」の 3 点はいずれも型検査もテストも緑のまま落ちる型であり、実装前に洗い出して注記まで残している。
- **テストが両側から挟んである**。`|| b.*Any` を落とすと赤くなるテストと、`|| true` にすると赤くなるテストを対で置いており、「不問」と「空のまま」の区別が片側だけの主張になっていない。E2E も API で実値（NULL）を見に行っており、画面表示だけで済ませていない。
- **緑のまま失効する記述を自覚的に扱っている**。`optionButtons.test.ts` の `8 + 1` は `shouldButtonizeOptions` の境界判定に影響しないため直さなくても緑のままだと明記したうえで直しており、`m15-01-metadata-testid.spec.ts` でもヒット種別をループ外へ出して主張を弱めずに強めている。この姿勢自体は正しい。⇒ だからこそ、走査の取りこぼし（高-2）だけが惜しい。
- **測っていないことを測っていないと書いている**。実 DB が無い以上 NULL 行数と衝突組数は出せないと判断し、根拠（`find` が 0 件、`.gitignore` の除外行）を添えて止まり、開発者裁定を得ている。推測で件数を埋めていない。
- **`import` 順を一度赤にして是正したことを完了報告に正直に書いている**。`tsc` もテストも E2E も何も言わない検査であることを `M24-08` の先例に紐づけて説明しており、検査の存在意義が報告に残っている。

---

## 制約事項

- 本レビューはコード上で判定可能な範囲のみ対象。実際の動作確認・パフォーマンス・実機テストは別途実施が必要。
- `make e2e` はレビュー時点でポート 47390 を使う E2E スタックが別プロセスで稼働中だったため、レビュー側では実行できなかった。⇒ E2E の緑は完了報告 §5 の記載（`E2E_EXIT=0` / 361 passed / 新規 spec 9 本）に依拠している。`go test ./internal/...` / `pnpm test` / `tsc --noEmit` / 機械検査 6 本はレビュー側で独立に実行し、`check-progress-log-index.sh` 以外は緑であることを確認した。
- 設計伝達レポートは本レビュー時点で未作成のため、チェックリスト F-2（CHANGE 原稿が §1 と §6 に在るか）は判定できない。
- 不明: `hit_type` が NULL の既存行の実件数と、それらを `normal` へ寄せたときの重複判定キーの衝突組数について判断できない。実 DB が作業ツリーに存在せず、レビュー側でも測れないため。⇒ 2026-09-17 の開発者裁定で「マイグレを作らない」と決着しているため、本サブの判定には影響しない。

---

## 取り込み結果（自動トリアージ）

**2026-09-17・`implement_plan_full` Phase C。⇒ 採用 15 件 ／ 不採用 0 件。**

**★「高」の不採用は 0 件である。**（＝開発者へのエスカレーションは発生していない）

### 高（4 件・**全件採用**）

| # | 採否 | 対応と理由 |
|---|---|---|
| **高-1** | **採用** | `numericInput.ts` の `NO_SPINNER` docstring から「矢印キーでの増減は残る(実測で確認)」を失効として畳み、現在の挙動へ是正した。**★あわせて中-4 を同じ場所で解消した** —— `NO_SPINNER` はコンボエディタの数値欄全部に配ってあるが、矢印の抑止は `useFieldSequence` を張った面（基本情報タブ）の中だけであることを明記した。⇒ 適用範囲が違うものを同じ docstring が扱っているため、離して書くより 1 か所で対比させるほうが誤読が減る |
| **高-2** | **採用（全数）** | 「先に 3 件だけ直して残りは残作業へ」という逃げ道は**採らなかった**。⇒ 指摘のとおり後任は fixture をコピーするため、19 か所のうち 1 つでも残ると前提が複製される。Go 側 13 か所 ／ TS・E2E 側 7 か所 ＋ `materialize_required_fields_test.go` の診断メッセージを是正した。**★文面は「必須 4 欄」と断定する形をやめ、「本登録の fixture が埋める欄」＋「いまサーバが咎めるのは damage / knockdownAdvantage だけ」＋「消費ゲージは余分であって害は無い。そのまま写さないこと」の形へ揃えた** |
| **高-3** | **採用** | `LEGACY_UNSPECIFIED_LABEL` は「使う欄が 2 つになった」ことと、**別定数にしている理由が欄ごとに違う**ことを書いた（相手の状態＝「不問」が 2 つ並ぶのを避ける ／ ヒット種別＝消したことを打ち消さない）。`withUnspecifiedFirst` は**通す欄と通さない欄を表で固定**し、「次に欄を足すときはその欄の値域に『不問』が在るかを先に確かめる」を明記した。⇒ 指摘の懸念（一律付与の復活）に対する歯止めである |
| **高-4** | **採用** | Phase D で `progress-log.md` へ索引行を追記し、`check-progress-log-index.sh` を緑に戻した。**★指摘のとおり、本検査は完了報告の存在を入力に取るため「報告を書いた瞬間に赤へ変わる」型である**（`D-890` / `M36-01` §7-1）。⇒ 報告を書き終えた後に回し直す手順が製造 CLI に在り、それを踏んだ |

### 中（7 件・**全件採用**）

| # | 採否 | 対応と理由 |
|---|---|---|
| **中-1** | **採用** | `validation/combo.go` へ契約上の帰結を明記した ——「**保存された NULL は必ず不問である」はエディタ経路に限った命題**であり、API 直叩き・`Materialize`・昇格は不問の意思なしに NULL を書ける。★あわせて「空のまま保存された NULL は存在しない」を前提にした処理を書かないことを注記した。CHANGE 原稿（設計伝達レポート §1 / §6）にも載せる |
| **中-2** | **採用** | `hit_type` の既定変更が `VAL-C02` に及ぼす帰結（`DES-006` §2.3「NULL 同士は一致」により既存 NULL 行と新規 `normal` 行が別キーになり、見た目が同じコンボを重複登録できる）を完了報告 §7 の「意図的な例外」へ **2 件目として**足した。⇒ 指摘のとおり、マイグレを作らない判断の代償は `(未指定)` の表示 1 件では済んでいない |
| **中-3** | **採用** | CHANGE 原稿の対象へ `DES-005` §5.7 を加えた（射程 2 の並び替えで入力項目の列挙が失効。★完了報告 §8 はボタン数にしか触れていなかった）。完了報告 §8 へ追記した |
| **中-4** | **採用** | 高-1 と同じ場所で解消（上記）。完了報告にも明記した |
| **中-5** | **採用** | `GaugeAtStartInput` に `fieldLabel` prop を足し、`aria-label` を `不問(コンボ開始時のドライブゲージ残量)` の形へ。★testid を読み上げさせない旨を prop の docstring に書いた |
| **中-6** | **採用** | `materializeError.ts` / `PunishList.tsx` の `D-724` 実測注記へ「**当時の必須 4 欄に対する数である**」「母数は減る方向であり、現在の件数は測っていない」を足した。★挙動（理由を捨てない）は正しいままなので、直したのは数の解釈だけである |
| **中-7** | **採用** | `fillRequiredComboFields` のトグル操作を `setUnspecified`（`isChecked()` で分岐 → `toBeChecked()` で確かめる）へ。★指摘のとおり現在の呼び出し元 9 か所はすべて新規登録画面なので緑だが、**共有ヘルパは呼ばれ方を選べない** |

### 低（4 件・**全件採用**）

| # | 採否 | 対応と理由 |
|---|---|---|
| **低-1** | **採用** | `GaugeAtStartField` 型と `GAUGE_ANY_KEY` 対応表（`satisfies Record<GaugeAtStartField, keyof BasicFieldsValue>`）へ置き換えた。★指摘のとおり、同ファイルが繰り返し警戒している「型検査もテストも緑のまま落ちる型」がここだけ素通りしていた |
| **低-2** | **採用（レビュー着地前に対応済み）** | `REQUIRED_PUBLISHED_FIELDS_CANON` はレビュー報告を受け取る前に製造側で削除していた。⇒ **独立に同じ結論へ到達しており、指摘と食い違っていない** |
| **低-3** | **採用** | `keyIsClaimedByField` は textarea 1 分岐へ素直に畳み、**未使用引数 `_key` を将来の余地として意図的に残している**ことを明記した（消し忘れではないこと、消すなら呼び出し元も直すこと） |
| **低-4** | **採用** | `OptionButtonGroup` の `testIdPrefix` docstring へ「空文字だけは `unspecified` へ変換される」「E2E がこの変換に依存している」を明記した。★本サブ起因ではない既存の記述だが、本サブの E2E がまさにこの変換を使っているため同じ手番で直した |

### ★取り込み後の全数（**出力はファイルへ全量落とし、`head` / `tail` で切っていない**）

| 検査 | 実測 |
|---|---|
| `go test ./...` | **`GO_EXIT=0`** ／ `grep -cE '^--- FAIL'` ＝ **0 件** |
| `cd web && pnpm test` | **`VITEST_EXIT=0`** ／ **235 files / 2982 tests passed** |
| `pnpm exec tsc --noEmit` | **`TSC_EXIT=0`** |
| `make e2e`（全数） | **`E2E_EXIT=0`** ／ **361 passed** |
| `check-artifact-integrity.sh`（★1 本目） | EXIT=0 |
| `check-import-order.sh` | EXIT=0 |
| `check-enum-sync.sh` | EXIT=0 |
| `check-browser-storage-keys.sh` | EXIT=0 |
| `check-doc-refs.sh` | EXIT=0 |
| `check-stop-discipline.sh` | EXIT=0 |
| `check-progress-log-index.sh` | **Phase D の索引行を追記して EXIT=0**（高-4） |

### ★再レビューの往復

**0 回。** ⇒ 初回レビューの指摘を全件採用し、不採用が 1 件も無いため再レビューを要求していない（`CLAUDE.md` §9 の上限 2 回に対して 0 回）。**⇒ 停止規律の記録が要る未解消項目は無い。**

### ★レビューの制約事項に対する補足

- レビュー側は `make e2e` を実行できなかった（ポート 47390 を使う E2E スタックが別プロセスで稼働中）。⇒ **製造側で取り込み後に全数を回し直し、`E2E_EXIT=0` / 361 passed を得ている**（上表）。
- チェックリスト F-2（CHANGE 原稿が設計伝達レポート §1 / §6 に在るか）はレビュー時点で判定不能だった。⇒ **設計伝達レポートは本サブの Phase D で作成する**。
