# M40-02 レビュー報告書

| 項目 | 内容 |
|------|------|
| 対象指示書 | `docs/instructions/M40-02-independent-reimplementation.md` v1.0.0 |
| 主入力 | `docs/instructions/reviews/M40-02-review-checklist.md` v1.0.0 |
| 着手基点 | `c788714e7f0ed0fb68a7d67fb37b6717d010b142` |
| 実装コミット | `0a2e78b`（5 ファイル・91 insertions / 48 deletions） |
| レビュー日 | 2026-09-20 |
| レビュー担当 | 品質レビュー担当 Claude Code |

---

## 総評

**書き換えた 2 件そのものの出来は良い。**`useSessionStorage.test.ts` を 1 行も触らずに実装だけを差し替えて 6 本が緑のまま通っており、「テストを先に書き換えてから実装を通す」という最悪形は起きていない。台帳のキー・`(max-width: 639px)`・射程外ファイルはいずれも実測で 0 行不変であり、assert も 7 → 13 へ増えている。検査も当方で回し直してすべて緑だった。

**しかし本サブの本体である「判定」の成果物が 1 つも存在しない。** `docs/progress/M40-02-completion-report.md` はリポジトリに無く、設計伝達レポートも `progress-log.md` の索引行も無い。段 1 の判定表・テストの主張の対照表・(iii) 3 件の収束の説明と監査証跡・開発者裁定の記録・検査の出力は、すべて置き場ごと欠落している。チェックリスト §0 の不合格 1 と 2 に直接当たり、**それだけで差し戻してよい状態**である。

加えて **`web/CLAUDE.md` §1 の脚注が「原稿は設計伝達レポート §1 / §6 に在る」と断言しているが、当該レポートは存在しない。** 失効記述をコード・正本資料へ残さないという本サブの美点が、自分の書いた 1 行で崩れている。

さらに **(iii) の監査証跡は本作業ツリーでは物理的に取得できない**（shallow clone・graft 2026-09-10）。これを知らずに `git log` の出力をそのまま書くと、誤った初出 SHA が証跡として残る。

---

## 設計準拠性レビュー結果

### A. 段 1 の判定（チェックリスト §A）

| # | 項目 | 評価 | 内容 |
|---|------|------|------|
| A-1 | 5 件 × 4 項目の判定表 | **×** | **完了報告が存在しないため判定表も存在しない。** `docs/progress/` に `M40-02` の名を持つファイルは 0 件（`git log --all --name-only` でも 0 件）。コミットメッセージに「段 1 の判定で (i) と分類した 2 件」とあるだけで、4 項目（現行の主張 ／ 形を強制している制約 ／ 別の理由の有無 ／ 一致が消えるか）は 1 件分も書かれていない |
| A-2 | 制約の名指し | **×** | 同上。コミットメッセージには制約の名指しが一部ある（`CLAUDE.md` §10.X）が、5 件分の表ではない |
| A-3 | 3 分類への割り付け | **△** | コミットメッセージに「(i) 2 件 ／ (iii) 3 件」と書かれており合計は 5。**ただし (ii) が 0 件である理由も、各件の割り付け根拠も無い** |
| A-4 | (iii) を開発者へ諮ったか | **×** | コミットメッセージは「開発者裁定により書き換えない」と主張するが、**リポジトリ内に裁定の記録が無い**。`docs/process/parallel-board.md` の `M40-02` 言及は 2 件（`D-919` 起票と版数行）のみで、(iii) に関する `D-` 番号は無い。指示書 §7-1 は「一覧と理由を出してその場で諮る」を求めており、記録が無いと後任は検証できない |
| A-5 | `useSessionStorage` の §10.X 実査 | **◎** | **実査は正しく行われ、結論も正しい。** 旧実装は `sessionStorage.getItem` / `setItem` を直接呼んでおり「専用ヘルパ経由」から外れていた。これは SCANOSS とは独立した規約違反であり、(i) の理由として妥当 |
| A-6 | `useIsMobile` の制約を踏まえたか | **◎** | 当方で独立に検証した。`DES-005` §4.4 は「スマホ:〜639px(sm 未満)」と定め、実装の `(max-width: 639px)` と一致する。`useSyncExternalStore` ＋ `subscribe` / `getSnapshot` / `getServerSnapshot` は React 18 の定石であり、全 21 行のうち動かせるのは関数名と並び順だけである。**据え置きの判断そのものは妥当** |

### B. 書き換えたもの（段 2）

| # | 項目 | 評価 | 内容 |
|---|------|------|------|
| B-1 | 既存テストがそのまま通るか | **◎** | **`web/src/hooks/useSessionStorage.test.ts` は差分 0 行**（diff に現れない）。当方の実行で 6 本すべて緑。実装だけを差し替えて既存の主張が保たれたことの最良の証拠であり、順序が逆でないことも示せている |
| B-2 | 対照表と assert の増減 | **△** | **対照表は存在しない**（置き場である完了報告が無い）。ただし当方が diff から数え直した結果、`it` は 3 本のまま、`expect` は 7 → 13 で**減っていない**。`toContain("limit=3")` が `limit=30` を通す穴を `URL.searchParams` の厳密一致で塞いだのは実質的な強化である。**成果は良いが、歯止めとして求められた成果物が無い** |
| B-3 | 台帳キーの不変 | **◎** | `web/CLAUDE.md` §1 の表は 12 行とも差分 0 行（変更は脚注 1 行のみ）。`bash scripts/check-browser-storage-keys.sh` を当方で実行して `EXIT=0`・台帳 12 件 / 本番コード 11 件で一致。`--self-test` も陰性 2 ・陽性 6 の全対照が合格 |
| B-4 | `(max-width: 639px)` の不変 | **◎** | `useIsMobile.ts` は差分 0 行。値も `DES-005` §4.4 と一致 |
| B-5 | 一致先コードを使っていない旨の記載 | **×** | **報告が無いため記載も無い**（指示書 §6-8 の明示的な完了条件）。コード上の状況証拠としては、新しい `useSessionStorage` がリポジトリ内の先例（`useFilterPanelCollapsed` / `useRecipeFullView` の `createXxxStorageHelper` ＋ `load()` の畳み込み）をなぞっており、外部由来をうかがわせる痕跡は無い。**ただし「書いていない」ことは完了条件の未達である** |
| B-6 | import 順 | **◎** | `bash scripts/check-import-order.sh` を当方で実行して `EXIT=0`・98 / ベースライン 98。`useRecentCombos.test.ts` は `react` → サードパーティ → 相対へ是正済み、`useSessionStorage.ts` も `react` → `@/lib/browser-storage` で規約どおり |

### C. 書き換えなかったもの（段 4）

| # | 項目 | 評価 | 内容 |
|---|------|------|------|
| C-1 | 収束の説明 | **×** | 存在しない。以下は**当方が独立に検証した結果**であり、製造の証跡の代わりにはならない |
| C-2 | 初出コミットの SHA と author date | **×** | **本作業ツリーでは取得不能である。** `.git/shallow` が存在し、履歴は 426 commit・最古が 2026-09-10 で切れている。`git log --diff-filter=A` は 3 件とも `b873d59`（2026-09-11 の merge）を返すが、**これは graft 境界であって初出ではない**。たとえば `useIsMobile.ts` は `docs/instructions/phase1/M6-03-mobile-home-and-footer.md` §（新設ファイル一覧）が示すとおりフェーズ1 の `M6-03` 由来である。**⇒ ここに `b873d59` を書くと、誤った SHA が監査証跡として残る** |
| C-3 | 置き場が完了報告か | **—** | 新しいファイルは作られていない（`CLAUDE.md` §10.Y には抵触しない）。**ただし作るべきファイルも作られていない** |
| C-4 | 「取得不能だから問題なし」になっていないか | **—** | 判定不能（報告が無い） |

**据え置き 3 件についての当方の独立判定**

| ファイル | 形を強制している制約（名指し） | 別の理由 | 判定 |
|---|---|---|---|
| `useIsMobile.ts` | `DES-005` §4.4「スマホ:〜639px(sm 未満)」／ React 18 の `useSyncExternalStore` ＋ `matchMedia` ／ 全 21 行 | **無し** | **(iii) 妥当** |
| `useUpdateSetup.ts` | TanStack Query `useMutation` の型 ／ `web/CLAUDE.md` §1.5「`queryKey` はファクトリが正本・配列リテラル禁止」／ `setupApi` 層の分離。`onSuccess` の 3 つの無効化はいずれも根拠コメント付き | **無し** | **(iii) 妥当** |
| `useDeleteSetup.test.ts` | `vi.mock` ＋ `renderHook` ＋ `QueryClientProvider` の定型 ／ `M31-01`（`P4M-019`）の契約＝第 2 引数 `unlinkFrom` | **★在る**（後述 中-1） | **(iii) は要再検討** |

### D. 挙動が変わっていないこと（段 3）

| # | 項目 | 評価 | 内容 |
|---|------|------|------|
| D-1 | 全数テストの件数一致 | **◎** | 当方で `pnpm test -- --run` を実行し **234 files / 2974 tests 全緑**。`progress-log.md` の `M39-02` 節が記録する着手前の件数 2974 と一致する。`go test ./...` も全 pkg ok |
| D-2 | 緑以外の言葉での契約の記述 | **△** | 報告は無いが、**`useSessionStorage.ts` の godoc に契約が書かれている**（`load()` が `null` を返す条件、`T` が `null` を含む場合の扱い、既存利用箇所が `number[]` であること）。この点は評価できる。ただし報告側の「何が契約か」は欠落 |
| D-3 | `pnpm test` への `--` | **—** | 判定不能（実行ログが無い）。当方は `--` 付きで実行した |

### E. 射程

| # | 項目 | 評価 | 内容 |
|---|------|------|------|
| E-1 | `NOTICE` / `REUSE.toml` | **◎** | `git diff c788714 -- NOTICE REUSE.toml` が **0 行**。`M40-01` の面へ踏み込んでいない |
| E-2 | 派生先ライセンスの適用 | **◎** | ライセンス表記の変更は 0 行 |
| E-3 | `docs/design/` 本体・`followup-backlog.md` | **◎** | ともに **0 行**。`D-838` の一本化を守っている |
| E-4 | **§0.5 の「5 ファイル」の外側**（スクリプト 2 本 ＋ `web/CLAUDE.md`） | **○** | **射程超過ではなく、失効記述の是正として必要だったと判断する。**(a) `check-browser-storage-keys.sh` の `DIRECT_ALLOW` は「`useSessionStorage.ts` は直接呼んでよい」と宣言する行であり、実装が直接呼ばなくなった以上、残せばそれ自体が失効記述である。(b) `check-import-order.sh` の `BASELINE` はスクリプト自身が「減ったら下げること」と明記し、実行時にも「BASELINE を 98 へ下げること」と出力する。(c) `web/CLAUDE.md` §1 の脚注は「#7 の非整合 ／ 是正は followup 扱い」であり、是正した以上は失効する。**3 件とも「触らない」ほうが有害であった。⇒ 妥当。ただし射程外に出たこと自体は報告に明記されるべきである** |

### F. 報告

| # | 項目 | 評価 | 内容 |
|---|------|------|------|
| F-1 | CHANGE 原稿が設計伝達レポート §1 / §6 に在るか | **×** | **設計伝達レポートが存在しない**（`docs/handover/design-reports/` の最新は `20260919-m39-02-*`）。`web/CLAUDE.md` は「原稿は設計伝達レポート §1 / §6 に在る」と書いているが、参照先が無い |
| F-2 | 完了報告 ＋ `progress-log` の索引行 | **×** | どちらも存在しない。`check-progress-log-index.sh` は緑だが、**それは「完了報告が在るのに索引行が無い」を見る検査であり、完了報告ごと無い場合は検出できない** |
| F-3 | 報告後に回し直した検査の出力 | **×** | 存在しない |
| F-4 | 着手前の版ゲート 6 点 | **×** | 記録が無い（指示書 §6-13） |

---

## 設計準拠性以外の指摘事項

### 1. `useSessionStorage.ts` は規約適合に必要な最小差分を超えている

規約違反（ヘルパ非経由）を消すだけなら、旧実装の `setStoredValue((prev) => {...})` の形を保ったまま、`sessionStorage.getItem` / `setItem` を `storage.load()` / `storage.save()` へ置き換えるだけで足りた。実際に採られたのは、それに加えて **`latestValue` という ref を導入し、state と ref の二重管理へ変える**構造変更である。

- godoc の理由づけ（StrictMode が updater を二重実行する）は事実だが、**旧実装で二重に走っていたのは同じ値の冪等な書込みであり、実害は開発時のみ**である。
- 代わりに導入された不変条件は「`setStoredValue` を呼ぶ箇所ではかならず `latestValue.current` も更新する」である。**現在は `setValue` 1 箇所なので成立しているが、将来 `reset` や `key` 変更時の再読込を足した担当がこの不変条件を破ると、関数形式の `setValue` が静かに古い値を見る。** godoc にこの不変条件が書かれていない。

### 2. 保存済み `null` の扱いが変わった

旧実装は `sessionStorage` に `"null"` が入っていれば `null` を値として返した。新実装はヘルパの契約（未保存・parse 失敗・読取例外がすべて `null`）と合流するため、**保存済みの `null` も未設定として `initialValue` を返す**。godoc に明記されている点は良いが、指示書 §2.2-2 は「挙動を 1 ビットも変えない」であり、逸脱である。唯一の利用箇所が `number[]` であるため実害は無いが、**逸脱を自分で見つけて開示した以上、開発者へ諮るか報告へ書く対象だった**。

### 3. テストヘルパの失敗時メッセージ

`firstRequestUrl()` は `String(spy.mock.calls[0]?.[0])` を使うため、fetch が 1 度も呼ばれていない場合に `new URL("undefined", "http://localhost")` が成功してしまい、`pathname` が `/undefined` という分かりにくい失敗になる。`expect(fetchSpy).toHaveBeenCalledTimes(1)` を先に置くか、`?.` を外して落とすほうが原因が読める。

### 4. ヘルパ経由化でテストの stderr にノイズが増えた

`browser-storage.ts` は失敗時に `console.warn` を出すため、`useSessionStorage.test.ts` の 2 本（`sessionStorage が使用不可でもクラッシュしない` ／ `不正な JSON が保存されている場合は初期値を返す`）が新たに stderr を出すようになった（実測 3 行）。既存の他キーでも同種の出力があるため床が少し上がるだけだが、「毎回出る出力は読まれなくなる」は本プロジェクトが `check-browser-storage-keys-stderr-syntax-error` で自ら書いている危険である。

### 5. コーディング規約・命名

- `CLAUDE.md` §4 の TypeScript 規約（`any` 禁止・import 順・命名）はいずれも満たしている。`tsc --noEmit` および `pnpm run lint` は `EXIT=0`。
- `stubFetch` / `withQueryClient` / `firstRequestUrl` への改名は意図が読める。テスト名の日本語化も既存テスト群（`useSessionStorage.test.ts` / `useDeleteSetup.test.ts`）と揃っている。
- `web/CLAUDE.md` の追記した脚注だけ丸括弧が半角で、周囲の全角と不統一。

### 6. セキュリティ・ライブラリ

- 依存追加は 0 件。`package.json` / `go.mod` の差分も 0 行。
- 機密情報の取り扱いに変更は無い。保存先は `sessionStorage` のまま、保持するのは行展開 ID の `number[]` のみで `CLAUDE.md` §10.X の禁止用途に当たらない。

---

## 推奨修正（優先度別）

### 高（M40 完了前に修正必須）

- **高-1: `docs/progress/M40-02-completion-report.md` を作成し、段 1 の判定表（5 件 × 4 項目 ＋ 3 分類）・テストの主張の対照表・(iii) 3 件の収束の説明と監査証跡・開発者裁定の記録・検査の出力・版ゲート 6 点を載せること。** あわせて `docs/progress/progress-log.md` へ索引行を 1 行、`docs/handover/design-reports/` へ設計伝達レポートを 1 本。**チェックリスト §0 の不合格 1 と 2 に当たり、これが無い限り本サブは合格にできない。**
- **高-2: `web/CLAUDE.md` §1 の脚注の「原稿は設計伝達レポート §1 / §6 に在る」が、存在しないファイルを指している。** レポートを作って参照先を実在させるか、記述を実態に合わせること。**失効記述を残さないために脚注を直したのに、その脚注自体が失効記述になっている。**
- **高-3: `docs/change-notes/change-report-085.md:58` の記述が失効した。** 逐語で「`combo-list-expanded-ids-v1` は `browser-storage.ts` を経由せず `useSessionStorage` を直接使用しており実装ガイドラインと非整合。是正は followup 扱い」と書かれており、**本サブで事実でなくなった。** CHANGE 本体は製造が直さない（`CLAUDE.md` §8）ため、**設計伝達レポートへ申し送ること。** 後任はこの行を読んで「まだ非整合が残っている」と誤解する。
- **高-4: `scripts/check-import-order.sh` の `BASELINE` 直上の実測コメントが失効している。** 「2026-09-01 実測 … 545 ファイル中 101 ファイル。内訳は本番 16 / テスト 85」と書かれているが、実測は **98 ファイル** （本番 14 / テスト 84）である。失効は `5133be3`（101 → 99）からの持ち越しだが、**本サブが直下の行を編集し「99 → 98」と書いたことで、同一ブロック内に矛盾する 2 つの数字が並んだ。** 触った本人が直す型である。

### 中（M41 着手と並行可）

- **中-1: `useDeleteSetup.test.ts` の (iii) 判定を再検討すること。** 同ファイルは `import React from "react"` が 4 行目にあり、**`CLAUDE.md` §4 の import 順に違反している**（`check-import-order.sh --list` で実測。`useDeleteSetup.test.ts:4 サードパーティ -> React`）。`useSessionStorage` を (i) へ上げた論拠は「SCANOSS ではなく規約が理由」であり、**同じ論拠がこのファイルにも成立する。** 5 件中 1 件だけ論拠を適用しなかった理由が示されていない。
- **中-2: (iii) の監査証跡は本作業ツリーからは取得できないことを報告へ明記すること。** `.git/shallow` があり履歴が 2026-09-10 で切れているため、`git log --diff-filter=A` は 3 件とも graft 境界の `b873d59` を返す。**この値を初出 SHA として書いてはならない**（`useIsMobile.ts` の実際の初出はフェーズ1 の `M6-03`）。full clone を持つ開発者へ回すか、「取得不能である」と書くこと。**「取得不能だから問題なし」にはしない**（追補報告の逐語）。
- **中-3: `useSessionStorage.ts` の godoc へ「`setStoredValue` を呼ぶ箇所ではかならず `latestValue.current` も更新する」という不変条件を明記すること**（設計準拠性以外 1）。
- **中-4: 保存済み `null` の扱いの変更を開発者へ報告すること**（設計準拠性以外 2）。
- **中-5: `followup-backlog.md` の `check-browser-storage-keys-stderr-syntax-error` の現況を報告へ書くこと。** 本サブは同スクリプトの当該行域（旧 115 行目を含む `DIRECT_ALLOW`）を編集している。**当方の実測では、着手基点の版・変更後の版のいずれも当環境では stderr へ何も出さず、`bash -n` も通る。** 設計卓がこの行を閉じられるかを判断できる情報であり、触った手番で書き残す値打ちがある。**⇒ `followup-backlog.md` 自体は編集しないこと**（`D-838`）。

### 低（将来対応）

- **低-1: `firstRequestUrl()` の失敗時メッセージを読めるようにする**（設計準拠性以外 3）。
- **低-2: ヘルパ経由化で増えたテスト stderr の扱いを整理する**（設計準拠性以外 4）。
- **低-3: `web/CLAUDE.md` の追記脚注の括弧を周囲と同じ全角へ揃える。**
- **低-4: `useSessionStorage.ts` の godoc の「`useFilterPanelCollapsed` / `useRecipeFullView` も同じ形で `null` を未設定に畳んでいる」は厳密には不正確。** 両者は `typeof saved === "boolean"` の型ガードであり、`null` だけでなく型の合わない値も既定へ畳む。効果は同じだが「同じ形」ではない。

---

## 良かった点

- **`useSessionStorage.test.ts` を 1 行も触っていない。** 実装だけを差し替えて既存の 6 本がそのまま緑という形は、「テストを先に書き換えてから実装を通す」の対極にあり、挙動不変の最も強い証拠である。チェックリスト B-1 が求めていたものを、文章ではなく差分で示している。
- **assert を減らさず増やした。** `it` 3 本のまま `expect` 7 → 13。とくに `toContain("limit=3")` が `limit=30` を通す穴を `URL.searchParams` の厳密一致で塞ぎ、さらに `pathname` ・ id の並び順 ・ `count` ・ 再試行しないことを足している。**「一致を消すためにテストを弱める」の逆をやっている。**
- **不要になった `DIRECT_ALLOW` のエントリを外した。** 残しても検査は緑のままだったが、「直接呼んでよい箇所」という失効記述が居座るため外す、という判断はこのプロジェクトが最も重視する型である。外した理由をスクリプト内のコメントで残し、「実装が戻ったときはここへ足すのではなくヘルパ経由へ直すこと」まで書いてある。
- **`BASELINE` をスクリプトの指示どおりに下げた。** レーンごとではなく作業ツリー全体の実測値であり、「増える方向の更新はしない」という制約にも従っている。
- **射程の外へ出ていない。** `NOTICE` / `REUSE.toml` / `docs/design/` / `followup-backlog.md` がいずれも 0 行差分であり、`M40-01` の面と `D-838` の一本化の両方を守っている。
- **据え置き 3 件のうち `useIsMobile` と `useUpdateSetup` の判断は、当方が独立に検証しても同じ結論になった。** 「雑に書き換えれば一致は消える」に流されていない。
- **`useSessionStorage.ts` の godoc に、自分が変えてしまった境界条件（保存済み `null` の扱い）を自分で書いている。** 報告が無いのは問題だが、コードに残した契約の記述そのものは質が高い。

---

## 当方で実行した検査（報告の緑を鵜呑みにしないための実走）

| 検査 | 結果 |
|---|---|
| `bash scripts/check-artifact-integrity.sh` | `EXIT=0`・自己検査 19 件すべて OK ・生成物 4 件 OK |
| `bash scripts/check-browser-storage-keys.sh` | `EXIT=0`・台帳 12 件 / 本番コード 11 件で一致 |
| `bash scripts/check-browser-storage-keys.sh --self-test` | `EXIT=0`・陰性 2 ・陽性 6 の全対照が合格 |
| `bash scripts/check-import-order.sh` | `EXIT=0`・98 / ベースライン 98（本番 14 ／ テスト 84） |
| `bash scripts/check-md-emphasis.sh web/CLAUDE.md` | `EXIT=0`・検出 0 行 |
| `bash scripts/check-doc-refs.sh` | `EXIT=0`・dead reference なし |
| `bash scripts/check-progress-log-index.sh` | `EXIT=0`（**ただし完了報告ごと無い場合は検出できない**） |
| `bash scripts/check-stop-discipline.sh` | `EXIT=0` |
| `cd web && pnpm test -- --run` | **234 files / 2974 tests 全緑**（着手前の記録 2974 と一致） |
| `cd web && pnpm exec tsc --noEmit` ／ `pnpm run lint` | ともに `EXIT=0` |
| `go test ./...` | 全 pkg ok |
| `git diff c788714 -- NOTICE REUSE.toml docs/design docs/handover/followup-backlog.md` | **0 行** |

**★`make e2e` は当方では実行していない。** 本サブの変更は `ComboTable` の行展開状態（`combo-list-expanded-ids-v1`）へ届くため E2E の全数は指示書 §5-1 の完了条件であり、**製造側の実行記録が必要**である。なお `ComboTable.test.tsx` が同キーの展開・折りたたみを covering しており、上記の 2974 件にそれが含まれていることは確認した。

---

## 制約事項

- 本レビューはコード上で判定可能な範囲のみ対象。実際の動作確認・パフォーマンス・実機テストは別途実施が必要。
- 外部リポジトリ（SCANOSS の一致先）は取得・参照していない。したがって「書き換えによって一致が実際に消えたか」は本レビューでは判定していない。判定するのは再スキャンの工程である（指示書 §8-2）。
- 完了報告・設計伝達レポートが存在しないため、それらの存在を前提とする項目（A-1〜A-4 / B-2 / B-5 / C-1〜C-4 / F-1〜F-4）は **検証不能として扱った** 箇所がある（不備と断定してはいない）。作成後に再度確認が要る。
- **不明: 「(iii) の 3 件は開発者裁定により書き換えない」というコミットメッセージの主張について、裁定が実際に行われたかどうかはリポジトリ内の記録からは判断できない。** ボード・`progress-log` のいずれにも該当する記録が無い。

---

*以上、M40-02 レビュー報告書。*
