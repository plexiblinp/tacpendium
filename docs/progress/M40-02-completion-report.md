# M40-02 完了報告: 5 ファイルの独立実装への書き換え（**★書き換えるかどうかの判定を含む**）

| 項目 | 内容 |
|------|------|
| 作業ID | **M40-02** |
| 指示書 | `docs/instructions/M40-02-independent-reimplementation.md` **v1.0.0** |
| 上位 | `docs/instructions/M40-overview.md` **v1.0.0**（`D-919`） |
| チェックリスト | `docs/instructions/reviews/M40-02-review-checklist.md` **v1.0.0** |
| 実施日 | **2026-09-20** |
| 枝元コミット | `c788714e7f0ed0fb68a7d67fb37b6717d010b142`（2026-09-20 22:53:35 +0900） |
| 実装コミット | `0a2e78b`（段 2）／ `ddebaaf`（レビュー取り込み） |
| ブランチ | `claude/dreamy-keller-mn6717` |
| レビュー報告 | `docs/progress/m40-02-review.md` |
| 設計伝達レポート | `docs/handover/design-reports/20260920-m40-02-design-exceptions.md` |
| **CHANGE 消費** | **0 本**（自採番しない＝`D-293`。**原稿 1 本**は設計伝達レポート §1 / §6） |
| **マイグレ消費** | **0 本**（`migrations/` の差分 **0 行**） |

---

## 0. 結論（先に書く）

**★★★本サブの本体は書き換えではなく「書き換えるべきかの判定」であった**（指示書 §4.1・チェックリスト §0）。

| 分類 | 件数 | ファイル |
|---|---:|---|
| **(i) 別の理由が在る → 書き換えた** | **2** | `useSessionStorage.ts` ／ `useRecentCombos.test.ts` |
| (ii) 別の理由は無いが劣化しない → 書き換える | **0** | — |
| **(iii) 劣化する／一致が消えない見込み → 書き換えない** | **3** | `useIsMobile.ts` ／ `useUpdateSetup.ts` ／ `useDeleteSetup.test.ts` |
| **合計** | **5** | |

**★(iii) 3 件は指示書 §2.1 / §7-1 に従って開発者へ諮り、「この仕分けで確定」の回答を得た**（2026-09-20・§9 に逐語）。

**★★一致先コードは 1 行も開いていない**（追補報告 §7.2-1）。**外部リポジトリの取得は 0 回**である。

---

## 1. 着手前の版ゲート（指示書 §0.6・6 点）

| # | 確かめること | 実測 |
|---|---|---|
| 1 | チェックリストの存在 | **✅** `docs/instructions/reviews/M40-02-review-checklist.md`（v1.0.0・108 行） |
| 2 | 上位が v1.0.0 | **✅** `M40-overview.md` バージョン欄＝「**1.0.0**（2026-09-20・起票＝`D-919`）」 |
| 3 | 3 本とも緑 | **✅** `go test ./...` **EXIT=0**（FAIL 0 ／ ok 60 pkg）／ `pnpm test -- --run` **EXIT=0**（234 files・2974 tests）／ `make e2e` **EXIT=0**（363 passed ＋ 1 flaky＝計 364・spec 81 本） |
| 4 | 5 ファイルが実在し `git log` で初出を引けること | **⚠️ 実在は ✅／初出は引けない。** 本作業ツリーは**浅いクローン**である（§5.2 に詳述）。**⇒ 代替として初回 SCANOSS の chronology CSV を使った** |
| 5 | `check-browser-storage-keys.sh` が EXIT=0 | **✅ EXIT=0**（台帳 12 件 / 本番コード 11 件で一致） |
| 6 | 枝元のコミットを報告へ書く | **✅** `c788714e7f0ed0fb68a7d67fb37b6717d010b142` |

**★ゲート 4 は「満たせなかった」ことを明記する。** 指示書は満たさない場合「射程が古い。⇒ 報告へ書く」としているが、
**実際には 5 ファイルとも実在しており、引けなかったのは初出コミットだけである**（原因はクローンの深さであって射程ではない）。
## 2. 段 1 — 5 件の判定（**本サブの本体**）

**★★★前提**: 追補報告 §7 は 5 件とも「書き換える*候補*」と書いている。`M40-overview` §3.2 と `D-919` が
「確定と読むな」と明記している。**⇒ 問うのは (1) SCANOSS とは別の理由が在るか (2) 無いなら書き換えたら本当に消えるか、の 2 つだけ。**

**★★一致先コードは 1 行も開いていない**（追補報告 §7.2-1 の要求）。判定の材料は
**本リポジトリ内のコード・設計書・規約・既存テスト**と、**追補報告が記録した一致率・一致行範囲・目視所見**だけである。
そもそも 5 件中 3 件は上流が再取得不能（HTTP 404 ／ GitLab 認証 ／ Repository not found）であり、開こうにも開けない。

### 2.1 判定表（5 件 × 4 項目）

| # | ファイル | 一致先 / 率 / 一致行 | ①現行の挙動・外部契約・主張 | ②形を強制している制約（**名指し**） | ③SCANOSS とは別の書き換え理由 | ④書き換えたら一致が消えるか | 分類 |
|---|---|---|---|---|---|---|---|
| 1 | `web/src/hooks/useSessionStorage.ts` | `aia-product-compass-hub` / **80%** / L4-20 | `[T, (v: T \| ((prev:T)=>T)) => void]` を返す汎用フック。初期読取は 1 回・関数形式 updater 可・読取/書込の例外はフォールバック。**外部契約＝この戻り値の形**。床＝`useSessionStorage.test.ts` **6 本** | **無い。むしろ規約に反している** | **★★在る（2 つ）**<br>**(a) 規約違反**＝`CLAUDE.md` §10.X ／ `web/CLAUDE.md` §1「実装ガイドライン」が求める**専用ヘルパ `web/src/lib/browser-storage.ts` 経由**から外れ、raw の `sessionStorage.getItem` / `setItem` を直に呼んでいる。**台帳 §1 脚注「#7 の非整合」が既知の負債として明記**（「是正は followup 扱い。新規実装では踏襲しないこと」）<br>**(b) React の純粋性違反**＝保存を `setStoredValue` の **updater の中**で行っている。updater は純関数でなければならず、StrictMode は二重に呼ぶ | **副次的**。ただし追補報告が挙げる一致範囲〔state 初期化 / `getItem` / JSON parse / functional update / `JSON.stringify` / 例外処理 / 戻り値〕のうち **`getItem`・parse・stringify・例外処理の 4 つがヘルパ側へ移る**ため、消える見込みは高い | **(i)** |
| 2 | `web/src/hooks/useRecentCombos.test.ts` | `ai-kanban` / **95%** / L3-63 | ①要求クエリが正しい ②成功時に 3 件返る ③HTTP エラーで `isError`。**主張＝この 3 つ** | `.ts` 拡張子のため JSX 不可（`createElement` 必須）／ 要求 URL を観測するには fetch 層の spy が要る（同型が**本リポジトリに 23 ファイル**） | **★在る＝assert が緩い。** `expect(calledUrl).toContain("limit=3")` は **`limit=30` でも通る**。`toContain("order=desc")` は **`order=descending` でも通る**。**⇒ 部分文字列一致を `URLSearchParams` の厳密一致へ替えるのは、SCANOSS と無関係な実質的強化である** | 見込み高（65 行中、helper 2 本と assert 3 群がすべて変わる）。**★ただし上流が HTTP 404 で再取得不能のため確言はしない** | **(i)** |
| 3 | `web/src/hooks/useIsMobile.ts` | `kenlasko/monize` / **70%** / **L5-19** | viewport 639px 以下で `true`。`change` で追随。unmount で購読解除。SSR は `false`。床＝`useIsMobile.test.ts` **4 本** | **①`(max-width: 639px)` は `DES-005` §4.4 の契約**（Tailwind `sm` 整合＝`CHANGE-017`。「`tailwind.config.js` はデフォルト設定のまま運用」）<br>**②`useSyncExternalStore` + `matchMedia` は React 18 の定石**（`useEffect`+`useState` へ倒すと tearing と hydration の問題が戻る）<br>**③`subscribe` はモジュールスコープの安定参照でなければならない**——毎レンダ再生成すると `useSyncExternalStore` が購読し直す<br>**④既存テストが `addEventListener("change", fn)` / `removeEventListener("change", fn)` を名指しで assert**（mock は `addListener` を持たない＝旧 API へ倒せない）<br>**⑤`getServerSnapshot` は `useSyncExternalStore` の API 要求** | **無い** | **★★★消えない見込み。** 追補報告 §5.4 の目視所見は「`MOBILE_QUERY` の値、**関数名、関数分割、購読・解除、server snapshot、最終 return** が一致する」。**①〜⑤がそのすべてを固定している。⇒ 動かせるのは識別子名だけ**であり、しかも `subscribe` / `getSnapshot` / `getServerSnapshot` は **React 公式ドキュメントの引数名そのもの**である。**★一致行 L5-19 は 21 行中 15 行＝まさに制約が効いている領域と一致する** | **(iii)** |
| 4 | `web/src/features/setup/hooks/useUpdateSetup.ts` | `octant` / **60%** / L4-18 | `setupApi.update` を呼び、成功時に detail へ `setQueryData` → 親コンボ詳細を個別 invalidate → `setupCandidates` を前方一致 invalidate。床＝`useUpdateSetup.test.ts` **2 本** | **①`useMutation` / `useQueryClient` の API 形状は TanStack Query が決める**（`mutationFn` + `onSuccess` 以外の書き方が無い）<br>**②`queryKey` は `web/CLAUDE.md` §1.5 により `queryKeys` ファクトリが正本**（画面・フック側で配列リテラルを書くことを禁止）<br>**③リポジトリ内の統一様式**＝`useCreateSetup.ts` / `useDeleteSetup.ts` と前文・構造が揃っている | **無い** | **★★消えない見込み。5 件中最低率の 60%** であり、一致しているのは `useMutation` + `onSuccess` + `invalidateQueries` という**フレームワークの骨格そのもの**と見られる。**①②がその骨格を固定しており、変える手段が無い。⇒ 無理に崩せば兄弟 2 本との統一が壊れる＝劣化**（§0.1） | **(iii)** |
| 5 | `web/src/features/setup/hooks/useDeleteSetup.test.ts` | `GIRO` / **83%** / L4-65 | ①`unlinkFrom` 省略時は第 2 引数 `undefined` ②指定時は API へ素通し（`M31-01` / `P4M-019` の契約）③削除成功時に `setupCandidates` を無効化（改善レーン F5）。**主張＝この 3 つ** | **★`web/src/features/setup/hooks/*.test.ts` の統一様式**——`useCreateSetup.test.ts` / `useSetup.test.ts` / `useUpdateSetup.test.ts` の **1〜27 行目が識別子を除いてバイト一致**（import 順・`vi.mock`・`createWrapper`・`beforeEach`）。**崩すと 4 本の統一が壊れる** | **無い。** assert は `toHaveBeenCalledWith(3, undefined)` / `toContainEqual({ queryKey: ["setupCandidates"] })` と**既に厳密**で、#2 のような緩さが無い | **不明**（上流が `Repository not found` で再取得不能）。**⇒ 「消えるかもしれない」を理由に統一様式を崩すのは §0.1 の本末転倒である** | **(iii)** |

### 2.2 3 分類の集計

| 分類 | 件数 | ファイル |
|---|---:|---|
| **(i) 別の理由が在る → 書き換える** | **2** | `useSessionStorage.ts` ／ `useRecentCombos.test.ts` |
| (ii) 別の理由は無いが書き換えても劣化しない → 書き換える | **0** | — |
| **(iii) 劣化する／一致が消えない見込み → 書き換えない** | **3** | `useIsMobile.ts` ／ `useUpdateSetup.ts` ／ `useDeleteSetup.test.ts` |
| **合計** | **5** | |

### 2.3 ★★★(iii) 3 件は開発者へ諮り、「書き換えない」で確定を得た

**諮った内容**＝上表 ③④ 欄（制約の名指しと、消えない見込みの根拠）。
**回答**（2026-09-20・本セッション）＝**「この仕分けで確定」**。
**⇒ 勝手に書き換えても、勝手に残してもいない**（チェックリスト §0-5）。
## 3. 段 2 — 書き換えた 2 件

### 3.0 ★★★一致先コードを実装資料として使っていない（追補報告 §7.2-1）

**★外部リポジトリを 1 つも取得していない。ネットワークアクセスは 0 回である。**
判定・実装の材料はすべて本リポジトリ内にある——現行コード ／ 既存テスト ／ `DES-005` ／ `CLAUDE.md` ／
`web/CLAUDE.md` ／ 兄弟ファイルの統一様式 ／ 追補報告が記録した一致率・一致行範囲・目視所見。
**★「ここを変えれば一致が消える」という設計は一度もしていない**（危険 §4.3）。
書き換えた 2 件はどちらも**先に理由が在り**（規約違反 ／ assert の緩さ）、**その理由から形が決まった**。

### 3.1 `web/src/hooks/useSessionStorage.ts`（+37 / -18）

#### やったこと

| # | 変更 | 理由（**SCANOSS ではない**） |
|---|---|---|
| 1 | raw の `sessionStorage.getItem` / `setItem` を `createSessionStorageHelper` 経由へ | **`CLAUDE.md` §10.X ／ `web/CLAUDE.md` §1「専用ヘルパ経由」**。台帳 §1 脚注が「#7 の非整合」として既知の負債に挙げていた |
| 2 | `storage.save()` を `setStoredValue` の **updater の外**へ出した（直前値を `useRef` で追跡） | **React の純粋性**。updater は純関数でなければならず、StrictMode は二重に呼ぶ。**旧実装は updater 内で書き込んでいた** |

#### 変えなかったもの

- **公開シグネチャ** `[T, (value: T \| ((prev: T) => T)) => void]`（外部契約）
- **台帳のキー `combo-list-expanded-ids-v1`**（1 文字も触っていない）
- **唯一の本番利用箇所 `web/src/features/combo/components/ComboTable.tsx`**（差分 0 行）
- **既存テスト `useSessionStorage.test.ts` の 6 本**（差分 0 行。**実装だけを先に直し、テストはそのまま通した**＝順序は逆になっていない）

#### ★★挙動が変わっていないことを、テストの緑以外の言葉で示す

外部契約は「**未設定なら `initialValue`、保存済みならその値。書込・読取の失敗でアプリを落とさない**」である。
入力の場合分けで新旧を突き合わせると次のとおり。

| 入力 | 旧（raw 呼び出し） | 新（ヘルパ経由） | 同値 |
|---|---|---|---|
| キー未保存（`getItem` → `null`） | `null` は falsy → `initialValue` | `load()` が `raw === null` を見て `null` → `initialValue` | ✅ |
| 空文字 `""` が保存されている | falsy → `initialValue` | `JSON.parse("")` が throw → catch → `null` → `initialValue` | ✅ |
| 不正 JSON | `JSON.parse` が throw → catch → `initialValue` | 同（catch は helper 側） → `null` → `initialValue` | ✅ |
| 正常な値 | `JSON.parse` の結果 | 同 | ✅ |
| `getItem` が throw（プライベートブラウジング等） | catch → `initialValue` | helper が catch → `null` → `initialValue` | ✅ |
| `setItem` が throw | catch して **state は更新する** | helper が `false` を返し **state は更新する** | ✅ |
| 値形式 setter | 渡した値をそのまま採用 | 同 | ✅ |
| 関数形式 updater | React の updater が直前値を渡す | `latestValue.current`（直前値）を渡す | ✅ |
| 同一イベント内の連続 `setValue` | updater キューで直前値が連鎖 | `latestValue.current` を同期更新するため同じく連鎖 | ✅ |
| `key` が変わったとき | `useState` の初期化は再実行されない／`setValue` は新キーへ書く | 同（`useMemo` の dep が `key`） | ✅ |

#### ★★意図した差分は 2 つだけ。どちらも報告する

| # | 差分 | 扱い |
|---|---|---|
| 1 | **失敗時に `console.warn` が 1 本出る**（`browser-storage.ts` の既定挙動） | **開発者が許容を確認済み**。`CLAUDE.md` §10 が禁じるのは `console.log` であり、これは**規約が求める経路そのもの**の挙動である |
| 2 | **`T` が `null` を含む場合、保存済みの `null` が「未設定」に畳まれる** | `load(): T \| null` は**未保存・parse 失敗・読取例外をすべて `null` で表す**——これは規約が正本とする helper の契約であり、**規約に寄せる以上そのセマンティクスを引き受けることになる**。**★既存の唯一の利用箇所は `number[]` で `null` を取らない**。**★`useFilterPanelCollapsed` / `useRecipeFullView` も同じ形**（`typeof saved === "boolean" ? saved : 既定`）**で `null` を未設定に畳んでおり、本リポジトリの既定の扱いと一致する** |

### 3.2 `web/src/hooks/useRecentCombos.test.ts`（+47 / -26）

#### ★★★主張の対照表（**it は 3 本のまま・assert は増えている**）

| 計数 | 前 | 後 |
|---|---:|---:|
| `it` の本数 | **3** | **3** |
| `expect(` の総数 | **7** | **14** |
| うち `waitFor` 内の待機 assert | 3 | 3 |
| **正味の assert** | **4** | **11** |

| # | 主張 | 書き換え前 | 書き換え後 | 強弱 |
|---|---|---|---|---|
| 1 | 並び順のキー | `toContain("sort=updated_at")` | `searchParams.get("sort")` === `"updated_at"` | **強化** |
| 2 | 並び順の向き | `toContain("order=desc")` | `searchParams.get("order")` === `"desc"` | **強化** |
| 3 | 件数 | `toContain("limit=3")` | `searchParams.get("limit")` === `"3"` | **強化** |
| 4 | 要求先のパス | — | `url.pathname` === `"/api/combos"` | **追加** |
| 5 | 成功時の件数 | `toHaveLength(3)` | 維持 | 同 |
| 6 | 成功時の中身 | — | `items.map(c => c.id)` === `[1,2,3]` ／ `items[0].defaultRecipe` ／ `count` | **追加 3** |
| 7 | エラー時 | `isError` のみ | `isError` ＋ `data` が `undefined` ＋ `fetch` が **1 回だけ** | **追加 2** |
| 8 | 要求が実際に飛んだこと | — | `firstRequestUrl()` 内で `toHaveBeenCalled()`（レビュー 低-1 の取り込み） | **追加** |

**⇒ 落とした主張は 1 つも無い。**

#### ★★「強化」を実測で示した（破壊確認）

`toContain` による部分文字列一致は**誤った値でも通る**。実測:

```
old toContain("limit=3") on "…&limit=30"        -> true
old toContain("order=desc") on "?order=descending" -> true
```

新しい assert が実際にそれを捕まえることを、実装を一時的に壊して確かめた（**確認後に復元済み・差分 0 行**）:

```
# web/src/hooks/useRecentCombos.ts の limit=3 → limit=30 に変えて実行
MUTATION_EXIT=1
  × useRecentCombos > 更新日時の降順で 3 件だけを要求する
    → expected '30' to be '3' // Object.is equality
  Tests  1 failed | 2 passed (3)
```

**⇒ 旧 assert なら緑のまま通り抜けていた欠陥を、新 assert は赤で止める。**

#### 併せて直したもの

- **import 順**を `CLAUDE.md` §4（React → サードパーティ → `@/` → 相対）へ是正。
  本ファイルは `check-import-order.sh` の**違反一覧に載っていた**（`useRecentCombos.test.ts:4 サードパーティ -> React`）。

### 3.3 ★射程の外へ出た 3 ファイル（**失効記述の是正**）

**★指示書 §0.5 の「5 ファイル」の外側である。⇒ なぜ触ったかを明示する。**
いずれも **本サブの変更によって記述が偽になった**ためであり、レビューチェックリストの較正が
「撤回済み・失効した記述がコード上に残っている」を「**高**」に置いていることに従った。

| ファイル | 変更 | 失効した記述 |
|---|---|---|
| `scripts/check-browser-storage-keys.sh` | `DIRECT_ALLOW` から `useSessionStorage.ts` を削除し、直上の「下記 **2 本**だけ」を「**1 本**だけ」へ | 旧エントリは「`sessionStorage.getItem/setItem` を**直接呼ぶ唯一の正規箇所**」と書いていた。**是正後は直接呼んでいない**——実測で当該ファイルは直接呼び出し検出の正規表現に**もう一致しない**。**⇒ 残すと「直接呼んでよい箇所」という偽の許可が居座る** |
| `scripts/check-import-order.sh` | `BASELINE=99` → `98` | **スクリプト自身が「減ったら BASELINE を下げること」と指示している**（L47 / L311-313 の出力）。実測 98 |
| `web/CLAUDE.md` §1 脚注 | 「#7 の非整合 … **是正は followup 扱い**」を as-built へ更新 | **是正したので偽になった**。**★台帳の表（キー・ストレージ種別・用途・設計書根拠）は 1 行も触っていない** |

**★`check-browser-storage-keys.sh` は `--self-test` も回して合格を確認した**（陰性 2 ・陽性 6 の対照）。**⇒ 検査自体を壊していない。**
## 4. 段 3 — 挙動が変わっていないことを示す

### 4.1 ★★★全数テスト（**着手前と着手後の件数が一致すること**＝`E-125`）

**★出力はすべてファイルへ全量落とし、`head` / `tail` で切っていない。** 合否はパイプを挟まず終了コードで判定した。

| 検査 | 着手前 | 着手後 | 一致 |
|---|---|---|---|
| `go test ./...` | **EXIT=0** ／ `--- FAIL` **0 件** ／ `ok ` **60 パッケージ** | **EXIT=0** ／ `--- FAIL` **0 件** ／ `ok ` **60 パッケージ** | ✅ |
| `cd web && pnpm test -- --run` | **EXIT=0** ／ Test Files **234 passed (234)** ／ Tests **2974 passed (2974)** | **EXIT=0** ／ Test Files **234 passed (234)** ／ Tests **2974 passed (2974)** | ✅ |
| `make e2e` | **EXIT=0** ／ **363 passed** ／ **1 flaky** ／ spec ファイル **81** | **EXIT=0** ／ **364 passed** ／ **0 flaky** ／ spec ファイル **81** | ✅（**総数 364 で一致**＝前は `363 passed + 1 flaky`、後は `364 passed + 0 flaky`） |

**★★`make e2e` は 2 回回した**——**実装コミット `0a2e78b` の後**（364 passed / 0 flaky / 6.6m）**と、レビュー取り込みコミット `ddebaaf` の後**（364 passed / 0 flaky / 6.2m）**。⇒ どちらも EXIT=0 で同数である。**
**★取り込みで触ったのは godoc コメント・テストヘルパ・スクリプトのコメント・Markdown だけであり、本番コードの実行部は 1 行も変えていない**（`useSessionStorage.ts` の差分は JSDoc ブロックのみ）**が、それを理由に省略せず実走した。**

**★`pnpm test` の件数が前後で完全一致している。** 書き換えた 2 ファイルは
**テストの本数を変えていない**（`useSessionStorage.test.ts` は 6 本のまま無変更、
`useRecentCombos.test.ts` は `it` 3 本のまま assert だけを増やした）ため、これが期待どおりの値である。

**★着手前の `make e2e` に flaky が 1 件ある**——`e2e/m31-02-tag-field-drag.spec.ts:49` 「右へ枠外までドラッグしても文字選択が消えない」。
**本サブの変更前から存在し、retry #1 で緑になる。⇒ 本サブ起因ではない**（変更したのは `useSessionStorage` と 1 本のユニットテストであり、
タグ欄のドラッグ経路には触れていない）。

**★着手後は同 spec が 1 回目で緑になり flaky 0 件であった。⇒ 総数は 364 で前後一致している**（`363 + 1 flaky` = `364 + 0 flaky`）**。★「flaky が消えた」を本サブの成果とは書かない**——同 spec は本サブの射程と交点が無く、**再現性のある改善を示す観測は取れていない**。`M39-02` の完了報告は同 spec の flaky を 2 件観測しており、**揺れる spec であること自体が既知**である。

### 4.2 各検査

| 検査 | 結果 |
|---|---|
| `bash scripts/check-browser-storage-keys.sh` | **EXIT=0**「台帳 12 件 / 本番コード 11 件 ／ OK 台帳と実装が一致(未記載キーの使用なし・状態のズレなし) ／ 結果: 違反なし」 |
| `bash scripts/check-browser-storage-keys.sh --self-test` | **EXIT=0**「自己検査: 合格(陽性は赤・陰性は緑)」＝陰性 2 ・陽性 6 の対照。**★`DIRECT_ALLOW` を 1 件減らしても検査自体は壊れていない** |
| `bash scripts/check-import-order.sh` | **EXIT=0**「現在 98 ファイル / ベースライン 98 ファイル(本番 14 ／ テスト 84) ／ OK ベースラインどおり(増加なし)」。**★是正前は「現在 98 / ベースライン 99 ／ OK ベースラインより 1 ファイル少ない → BASELINE を 98 へ下げること」であり、スクリプト自身の指示に従って下げた** |
| `cd web && pnpm lint`（`tsc --noEmit`） | **EXIT=0** |
| `bash scripts/check-artifact-integrity.sh` | **EXIT=0**「結果: 違反なし」（生成物 4 件 OK）。**★1 本目に回した** |
| `bash scripts/check-doc-refs.sh` | **EXIT=0**「対象 37 ファイル ／ 結果: dead reference なし」。**★`web/CLAUDE.md` は本検査の対象範囲に入っており、脚注の書き換えで参照は壊れていない** |
| `bash scripts/check-md-emphasis.sh`（本手番の新規 .md のみ） | <!--MDEMPH--> |

### 4.3 ★★外から見える挙動が同じであること（**テストの緑以外の言葉で**）

**★「テストが通った」は「契約が同じ」の証明ではない。⇒ 契約そのものを書く。**

| 対象 | 外部契約 | 変わっていないことの示し方 |
|---|---|---|
| `useSessionStorage` | ①戻り値は `[現在値, setter]` の 2 要素タプル ②`setter` は値形式と関数形式の両方を受ける ③未設定なら `initialValue` ④読取・書込が失敗してもアプリを落とさず、state は更新される ⑤保存先は `sessionStorage` の指定キー | **§3.1 の入力場合分け表で 9 通りすべてを新旧突合した**（意図した差分 2 つは明示）。**公開シグネチャの型は差分 0**。**唯一の本番利用箇所 `ComboTable.tsx` は差分 0 行**＝呼び出し側から見た形が変わっていない |
| `useRecentCombos` | **実装に 1 行も触れていない**（`.ts` 本体は差分 0 行） | **⇒ 挙動は定義上不変。** 変えたのは `.test.ts` のみであり、**しかも主張は減らさず増やした**（§3.2 対照表） |
| `combo-list-expanded-ids-v1` | 台帳 §1 #7 のキー・ストレージ種別・用途 | **台帳の表は差分 0 行**。`check-browser-storage-keys.sh` が**台帳 12 件 / 本番コード 11 件で一致**を報告 |

### 4.4 ★書き換えなかった 3 件が本当に無変更であること

```
$ git diff --numstat c788714 -- web/src/hooks/useIsMobile.ts \
    web/src/features/setup/hooks/useUpdateSetup.ts \
    web/src/features/setup/hooks/useDeleteSetup.test.ts
（出力なし＝差分 0 行）
```

### 4.5 ★新規ファイルの上書き事故が無いこと（教訓 `E-225`）

```
$ git diff --stat c788714
 scripts/check-browser-storage-keys.sh |  7 +++-
 scripts/check-import-order.sh         |  2 +-
 web/CLAUDE.md                         |  2 +-
 web/src/hooks/useRecentCombos.test.ts | 73 ++++++++++++++++++++++-------------
 web/src/hooks/useSessionStorage.ts    | 55 +++++++++++++++++---------
 5 files changed, 91 insertions(+), 48 deletions(-)
```

**★Phase A で新規ファイルを 1 つも作っていない**（5 件すべて既存ファイルの変更）。
**⇒ 「新規のつもりのファイルに deletions が付く」型の事故は構造上起きていない。**
**★`docs/` 側の新規ファイル**（本完了報告・レビュー報告・設計伝達レポート）**は、作る前に `ls` で同名の不在を確かめた。**
## 5. 段 4 — 書き換えなかった 3 件の証跡

### 5.1 ★★★収束の説明（「同じ制約の下では誰が書いても同じ形になる」）

**★制約を名指しする。「一般的だから」では足りない**（チェックリスト A-2）。

#### (a) `useIsMobile.ts`（70%・一致行 L5-19／全 21 行）

同フックが満たさねばならない条件を列挙すると、書ける形はほぼ 1 つに定まる。

| # | 制約 | 出所（**名指し**） | それが固定するもの |
|---|---|---|---|
| 1 | 閾値は `(max-width: 639px)` | **`DES-005` §4.4**「スマホ:〜639px(sm 未満)」＋「`tailwind.config.js` はデフォルト設定のまま運用、`theme.screens` 拡張なし」（**`CHANGE-017`** で Tailwind 標準値へ整合化） | **クエリ文字列そのもの** |
| 2 | `useSyncExternalStore` + `matchMedia` を使う | React 18 の定石。`useEffect` + `useState` へ倒すと tearing と hydration の問題が戻る。**本リポジトリでも `useRecipeFullView` / `gamepad-notice-storage` が同じ理由で同じ形を採っている** | **フック本体の 1 行**（`useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)`） |
| 3 | `subscribe` はモジュールスコープの安定参照 | `useSyncExternalStore` は `subscribe` の参照が変わると購読し直す。フック内で毎レンダ生成すると再購読が走る | **関数をモジュールトップへ出す「関数分割」そのもの** |
| 4 | 購読は `addEventListener("change", cb)`、解除は `removeEventListener("change", cb)` | **既存テスト `useIsMobile.test.ts`** が `expect(mql.removeEventListener).toHaveBeenCalledWith("change", expect.any(Function))` と**名指しで assert**。mock は `addListener` / `removeListener` を持たないため旧 API へは倒せない | **購読・解除の 4 行** |
| 5 | `getServerSnapshot` を用意する | `useSyncExternalStore` の第 3 引数（API 要求） | **server snapshot の関数** |

**⇒ 追補報告 §5.4 が一致点として挙げた「`MOBILE_QUERY` の値、関数名、関数分割、購読・解除、server snapshot、最終 return」は、1〜5 が 1 対 1 で固定している。★残る自由度は識別子名だけであり、しかも `subscribe` / `getSnapshot` / `getServerSnapshot` は React 公式ドキュメントが使っている引数名そのものである**。
**★★一致行が L5-19（21 行中 15 行）であることは、一致した領域と制約が効いている領域が重なっていることの裏づけである。**

#### (b) `useUpdateSetup.ts`（60%・一致行 L4-18／全 27 行）

| # | 制約 | 出所（**名指し**） |
|---|---|---|
| 1 | `useMutation({ mutationFn, onSuccess })` の形 | TanStack Query v5 の API。**mutation フックにこれ以外の書き方が無い** |
| 2 | `queryKey` は `queryKeys` ファクトリから引く | **`web/CLAUDE.md` §1.5**「`queryKey` は `web/src/lib/query-keys.ts` の `queryKeys` ファクトリが正本」「画面・フックの側で配列リテラルを書かないこと」 |
| 3 | 兄弟と同じ前文・構造 | `useCreateSetup.ts` / `useDeleteSetup.ts` と揃っている（同ディレクトリの統一様式） |

**⇒ 5 件中の最低率 60% は、一致が「フレームワークの骨格」に留まっていることの傍証である。★骨格は 1・2 が固定しており、崩す手段は「規約違反を犯す」以外に無い**。

#### (c) `useDeleteSetup.test.ts`（83%・一致行 L4-65／全 75 行）

| # | 制約 | 出所（**名指し**） |
|---|---|---|
| 1 | `vitest` + `@testing-library/react` の `renderHook` / `waitFor` | 本プロジェクトのフロントテスト基盤（`CLAUDE.md` §5） |
| 2 | `QueryClientProvider` を `retry: false` で張る | TanStack Query のフックを単体で回すための定石 |
| 3 | **同ディレクトリ 4 本の統一様式** | `useCreateSetup.test.ts` / `useSetup.test.ts` / `useUpdateSetup.test.ts` の **1〜27 行目が識別子を除きバイト一致**（import 順 → `vi.mock` → `mocked` → `createWrapper` → `beforeEach`）。**★実測で確認した** |

**⇒ 一致行 L4-65 は「前文＋3 ケース」であり、前文は 3 に、ケースの骨格は 1・2 に固定されている。★assert の中身（`unlinkFrom` の素通し・`setupCandidates` の無効化）は本プロジェクト固有であり、外部と一致しようがない**。

### 5.2 ★★★監査証跡（追補報告 §7.1 の 4 項目の形）

**★★★重大な制約＝本作業ツリーは浅いクローン（shallow clone）である。**
`.git/shallow` に境界コミットが **20 件**あり、到達可能な最古のリビジョンは **2026-09-10**。
**⇒ 5 ファイルはいずれも境界マージ `b873d59`（2026-09-11）で「追加」として現れ、`git log --diff-filter=A` は初出を返さない。**
`git cat-file -t` で確認したところ、**下表の初出 SHA は 5 件とも本クローンに存在しない**（`could not get object info`）。
**★`gh` / GitHub MCP による履歴補完は `CLAUDE.md` §10 で `deny`。⇒ 本作業ツリーからは引けない。**

**代替＝初回 SCANOSS の chronology CSV が、全履歴が在った時点で初出を記録している。**
（`docs/progress/evidence/m26-04-scanoss/scan-review-chronology-initial.csv`・検査対象 SHA `3e6e60555c68bdacf32076170f21b872fdd5f9bb`）

| §7.1 の項目 | `useIsMobile.ts` | `useUpdateSetup.ts` | `useDeleteSetup.test.ts` |
|---|---|---|---|
| **初出 commit SHA** | `489e717451a676a01e73b20cbd828b21c78f9af2` | `f56eb52389262db4066ac28c3a023cb6c8d03472` | `01c47710f0a5cecadca2e3c05c36df64a268447b` |
| **author date（CSV の `TacpendiumAdded`）** | **2026-05-24** | **2026-05-17** | **2026-05-17** |
| **milestone 名** | **M6-03**「スマホ専用ホーム画面 + スマホフッター」（**2026-05-24 完了**・`progress-log.md` L1993） | **M4-02**「セットプレイ単体 UI + コンボ詳細展開 + 紐付け操作 UI」（**2026-05-17 完了**・同 L1138） | **M4-02**（同上） |
| **変更統計** | **★引けない**（初出コミットが本クローンに無い）。⇒ 完了報告の記載で代替＝`progress-log.md` L2045「`web/src/hooks/useIsMobile.ts` — スマホ判定フック（`useSyncExternalStore` + `window.matchMedia("(max-width: 639px)")`）」／ L2059「`useIsMobile.test.ts` — 4 テスト」 | **★引けない**。⇒ `M4-02` 完了報告（L1138〜）で代替 | **★引けない**。⇒ 同上 |
| **同時に入った設計・指示・レビュー記録** | 指示書 `docs/instructions/phase1/M6-03-mobile-home-and-footer.md` ／ チェックリスト `phase1/reviews/M6-03-review-checklist.md` ／ レビュー報告 `docs/progress/phase1/m6-03-review.md` ／ 完了報告 `progress-log.md` L1993〜 | 指示書 `phase1/M4-02-setup-ui-and-link-operations.md` ／ `phase1/reviews/M4-02-review-checklist.md` ／ `docs/progress/phase1/m4-02-review.md` ／ `progress-log.md` L1138〜 | 同左（＋後続の `M23-02` / `M23-03` / `M23-07` / `M31-01` が assert を拡張） |
| **chronology CSV と固定検査対象 SHA** | `scan-review-chronology-initial.csv`（`Chronology` 欄＝`Matched-project-first`）／ 検査対象 `3e6e6055…` | 同（`Matched-project-first`） | 同（`Matched-project-first`） |

**★★「日付が先なら独自実装と証明できる」という意味ではない**（追補報告 §7.1 末尾の否認文）。
**⇒ 上表は日付だけでなく、①同時に入った設計・指示・レビュー記録 ②プロジェクト固有の契約（`DES-005` の breakpoint・`queryKeys` 正本・`M31-01` の `unlinkFrom` 契約）③実コードを強制している制約、を組み合わせて説明するための保全である**。

**★★★3 件とも `Chronology` 欄は `Matched-project-first`＝外部側のリリースのほうが日付として先である。⇒ 本節は「日付で勝っている」という主張ではない。§5.1 の収束の説明がこの 3 件の根拠であり、日付はその補助ですらない**。

### 5.3 ★「取得不能だから問題なし」にしていないこと

追補報告は 3 件について「**取得不能を理由に「問題なし」とはしない。**」と逐語で書いている。
**⇒ 本サブは取得不能を理由に (iii) と判定していない。** 判定の根拠は §5.1 の制約の名指しであり、
`useDeleteSetup.test.ts` の ④ 欄は「**不明**」と書いてある（消えると書いていない）。

---

## 6. ■ 併せて更新が要るもの

| # | 項目 | 状態 |
|---|---|---|
| 1 | **消費した CHANGE 番号の登録** | **なし。0 本消費**（自採番しない＝`D-293`）。**⇒ `docs/handover/change-number-registry.md` §1 は差分 0 行。**「次の番号」の写し先 4 か所（registry §1 ／ 契約 §4 ／ ボード §2.1 ／ ボード §2.4）も**いずれも触っていない** |
| 2 | **消費したマイグレ連番** | **なし。0 本。** `git diff --numstat c788714 -- migrations/` が **0 行**。`ls migrations/*.up.sql` は **9 本**で不変、次番は `000010` のまま |
| 3 | **版を上げた文書の参照元** | **なし。** 版数を上げた文書は 0 件（指示書・チェックリスト・overview はいずれも読むだけ） |
| 4 | **★台帳（`web/CLAUDE.md` §1）の脚注** | **更新した**（#7 の非整合を as-built へ）。**★表本体は 0 行不変。★CHANGE 原稿は設計伝達レポート §1 / §6** |
| 5 | **★`scripts/check-browser-storage-keys.sh` の `DIRECT_ALLOW`** | **1 件削除した**（`useSessionStorage.ts`）。直上の「下記 **2 本**だけ」も「**1 本**だけ」へ。**⇒ `--self-test` 合格を確認済み** |
| 6 | **★`scripts/check-import-order.sh` の `BASELINE`** | **99 → 98**（スクリプト自身の指示）。**★あわせて直上の実測コメントも更新した**（レビュー 高-4。「101・本番 16 / テスト 85」が失効していた） |
| 7 | **★失効したが製造が直さないもの** | **`docs/change-notes/change-report-085.md:58`**（レビュー 高-3）。**CHANGE 本体は歴史記録であり製造は編集しない**（`CLAUDE.md` §8 ／ `D-274` (3)）。**⇒ 設計伝達レポート §4-6 へ申し送った** |

---

## 7. ★開発者への確認事項（指示書 §7）と、その回答

| # | 諮ったこと | 回答（**2026-09-20・本セッション**） |
|---|---|---|
| **1** | **(iii) 3 件を「書き換えない」で確定してよいか**（§7-1＝「一覧と理由を出して*その場で*諮る」） | **「この仕分けで確定」**。⇒ §2.1 の表の ③④ 欄を根拠として提示し、承認を得た |
| **2** | `useSessionStorage` が規約から外れていた場合の直し方（§7-2） | **「汎用フックのまま委譲」**。⇒ 専用フックへの置換（`ComboTable.tsx` と既存テスト 6 本に波及）は採らなかった |
| **3** | helper 経由で `console.warn` が 1 本増えること | **許容し、完了報告へ明記する** |
| **4** | 「followup 扱い」と 5 箇所が書いているのに `followup-backlog.md` へ起票されていない件 | **設計伝達レポート §4 の原稿として出す**（backlog 本体は 1 文字も触らない＝`D-838`） |
| **5** | 5 ファイルのいずれかが実在しない場合（§7-3） | **該当なし。5 件とも実在した**（諮る必要が生じなかった） |

**★★保存済み `null` の扱いが変わる件は、諮らずに報告した**（レビュー 中-4 の指摘どおり、諮る余地があった）。
**⇒ §3.1 の「意図した差分」表と `useSessionStorage.ts` の godoc に開示してある。★実害の無い範囲であることも併記した。**

---

## 8. レビューと取り込み（Phase B / Phase C）

### 8.1 レビューの実施形態

**fresh subagent**（メイン会話文脈を継承しない独立エージェント）で実施した。**★`fork` は使っていない**（レビュアーの独立性の担保）。
報告書＝`docs/progress/m40-02-review.md`（197 行）。

**★レビュアーは報告の「緑」を鵜呑みにせず、自分で検査を回し直した**——
`check-artifact-integrity.sh` ／ `check-browser-storage-keys.sh`（と `--self-test`）／ `check-import-order.sh` ／
`check-md-emphasis.sh` ／ `check-doc-refs.sh` ／ `check-progress-log-index.sh` ／ `check-stop-discipline.sh` ／
`pnpm test -- --run` ／ `tsc --noEmit` ／ `go test ./...`。**⇒ これは `D-890` が求める姿である。**

### 8.2 ★★★指摘の総数と採否

**指摘 13 件（高 4 ／ 中 5 ／ 低 4）。★「高」の不採用は 0 件であり、安全弁は発動していない。★再レビュー往復は 0 回。**

| # | 優先度 | 指摘 | 採否 | 理由 |
|---|---|---|---|---|
| 高-1 | 高 | 完了報告・設計伝達レポート・`progress-log` 索引行が存在しない | **採用** | **★工程順による**——本 CLI は Phase A → **B（レビュー）** → C → **D-0（完了報告）** → D（索引行）であり、**レビュー時点では構造上まだ存在しない**（Phase D-0 が「レビュー結果を参照する欄は Phase C の後にしか書けない」と定めている）。**⇒ 本報告・設計伝達レポート・索引行の作成で満たした** |
| 高-2 | 高 | `web/CLAUDE.md` の脚注が存在しない設計伝達レポートを指している | **採用** | 同上。**⇒ レポートを実在させ、あわせて脚注にフルパスを書いた**（`ddebaaf`） |
| 高-3 | 高 | `docs/change-notes/change-report-085.md:58` が失効した | **採用（申し送り）** | **実測で確認した**（逐語「是正は followup 扱い」）。**★CHANGE 本体は歴史記録であり製造は編集しない**（`CLAUDE.md` §8）。**⇒ 設計伝達レポート §4-6 へ原稿として上げた** |
| 高-4 | 高 | `check-import-order.sh` の `BASELINE` 直上の実測コメントが失効 | **採用（修正済み）** | **実測で確認**（コメント「101・本番 16 / テスト 85」／ 実測 98・本番 14 / テスト 84）。**★失効自体は `5133be3` からの持ち越しだが、本サブが直下の行を編集したため同一ブロックに矛盾する数字が並んだ。⇒ 触った本人が直す型である。**`ddebaaf` で更新し、「数字が 2 か所に在る」ことも注記した |
| 中-1 | 中 | `useDeleteSetup.test.ts` の (iii) 判定を再検討すべき（import 順違反＝規約違反が在る） | **★部分採用**（事実は採用・**ファイルは触らない**） | **§10 に詳述** |
| 中-2 | 中 | (iii) の監査証跡は本作業ツリーからは取得できないと明記すること | **採用** | **⇒ §5.2 に明記した。★レビュアーが警告した `b873d59` は 1 度も書いていない**——代わりに初回 SCANOSS の chronology CSV が保持する `FirstCommit` を使い、**その SHA が本クローンに存在しないことも `git cat-file` の実測で示した** |
| 中-3 | 中 | `useSessionStorage.ts` の godoc へ不変条件を明記 | **採用（修正済み）** | `ddebaaf`。「`setStoredValue` を呼ぶ箇所では `latestValue.current` も更新する」を明記 |
| 中-4 | 中 | 保存済み `null` の扱いの変更を開発者へ報告 | **採用** | **⇒ §3.1 の「意図した差分」表と §7 の末尾に明記した** |
| 中-5 | 中 | `check-browser-storage-keys-stderr-syntax-error` の現況を報告へ書くこと | **採用** | **⇒ §11 に実測を書いた** |
| 低-1 | 低 | `firstRequestUrl()` の失敗時メッセージが読めない | **採用（修正済み）** | `ddebaaf`。`?.` を外し、先に `toHaveBeenCalled()` を主張する形へ |
| 低-2 | 低 | ヘルパ経由化で増えたテスト stderr の扱い | **採用（報告のみ）** | **⇒ §11。★抑止はしない**——`console.warn` は開発者が許容を確認済みであり、抑止すると規約が求める経路から再び外れる |
| 低-3 | 低 | `web/CLAUDE.md` の追記脚注の括弧を全角へ | **採用（修正済み）** | `ddebaaf` |
| 低-4 | 低 | godoc の「`useFilterPanelCollapsed` / `useRecipeFullView` も同じ形」が不正確 | **採用（修正済み）** | `ddebaaf`。**「畳む点は同じだが述語は同じではない」へ言い換えた**（両者は `typeof` の型ガードであり `null` 以外も畳む） |

**★不採用は 0 件。部分採用が 1 件（中-1）。**

---

## 9. ★★★開発者裁定の逐語（レビューの「不明」への回答）

**レビュー報告の「不明」欄は、「(iii) 3 件は開発者裁定により書き換えない」という主張の裁定記録がリポジトリ内に無く検証できない、としている。⇒ 正当な指摘である**（レビュアーはチャットを見られない）。

**裁定は 2026-09-20 の本セッションで、Plan Mode の計画提示時に行われた。** 提示した選択肢と回答:

| 諮った内容 | 選択肢 | **回答** |
|---|---|---|
| 段 1 の仕分け | (a) この仕分けで確定 ／ (b) `useRecentCombos.test.ts` も (iii) へ ／ (c) `useIsMobile` 以外は書き換える ／ (d) 5 件とも書き換える | **(a) この仕分けで確定** |
| `useSessionStorage` の是正の形 | (a) 汎用フックのまま委譲 ／ (b) 専用フックへ置換 ／ (c) 是正しない | **(a) 汎用フックのまま委譲** |
| 付随 2 件（`console.warn` ／ 起票漏れ） | (a) 両方とも推奨どおり ／ (b) `console.warn` は抑止 ／ (c) 起票漏れは報告しない | **(a) 両方とも推奨どおり** |

**★本節がその記録である。⇒ 以後は本節を参照すること。★ボードへの登録は設計卓の手番**（製造は `parallel-board.md` を編集しない）。

---

## 10. ★★中-1（`useDeleteSetup.test.ts` の import 順違反）を部分採用とした理由

**★指摘の事実は正しい。** 実測で確認した:

```
web/src/features/setup/hooks/useCreateSetup.test.ts:4  サードパーティ -> React
web/src/features/setup/hooks/useDeleteSetup.test.ts:4  サードパーティ -> React
web/src/features/setup/hooks/useSetup.test.ts:4        サードパーティ -> React
web/src/features/setup/hooks/useUpdateSetup.test.ts:4  サードパーティ -> React
```

**⇒ しかし「`useSessionStorage` と同じ論拠が成立する」とは言えない。理由は 3 つある。**

| # | 理由 |
|---|---|
| **1** | **★★検査の性質が違う。** `check-import-order.sh` は**ベースライン固定型**であり、ヘッダが逐語でこう書いている——**「既存の違反が多いため、件数そのものではなく『ベースラインから増えたか』を見る。★既存分を機械的に並べ替えない。…書いた本人が触るときに直していく。」⇒ 本プロジェクトは「既存の import 順違反は在庫として許容し、触る手番で直す」と*明示的に決めている*。** 一方 `useSessionStorage` のヘルパ非経由は**ベースラインを持たず**、台帳脚注が「**是正は followup 扱い**」と**是正を負債として明記**していた。**⇒ 「許容されている在庫」と「負債として計上済みの未済」は同じではない。** |
| **2** | **★4 本すべてが同じ違反を持つ。** 1 本だけ直すと、(iii) の根拠にした**統一様式（1〜27 行目のバイト一致）が崩れる**。4 本すべて直すのは**射程（5 ファイル）を 3 ファイル超過**する |
| **3** | **★開発者裁定（§9）が「書き換えない」で確定している。** import 順だけとはいえ、裁定の対象ファイルを諮らずに編集するのは筋が違う |

**★★そして最も重要な点＝import 順の是正は「独立実装への書き換え」ではない。**
**⇒ 一致は L4-65 に及んでおり、import 4 行の並べ替えで 83% が動くとは考えにくい。**
**⇒ 仮に直しても (iii) の判定（独立実装への書き換えはしない）は変わらない。**

**★★★したがって「(iii) のままとし、import 順の是正は 4 本まとめて別の手番で行う」を提案する。⇒ 設計伝達レポート §4-7 へ原稿として上げた。**

---

## 11. ★その他の実測（レビュー 中-5 / 低-2 への回答）

### 11.1 `check-browser-storage-keys-stderr-syntax-error` は当環境で再現しない

`followup-backlog.md` L356 の同項目は「実行のたびに `line 115: syntax error near unexpected token '('` が stderr に出る」としている。
**本サブは同スクリプトの当該行域（`DIRECT_ALLOW` ブロック）を編集したため、実測した。**

| 版 | `bash -n` | 実行時の stderr |
|---|---|---|
| 着手基点 `c788714` | **通る** | — |
| 変更後 | **通る** | **0 バイト** |

**⇒ 当環境（本コンテナ）では基点版・変更後版のいずれも再現しない。★「直した」とは書かない**——
**本サブは構文に触れておらず、再現しない理由は環境差（bash の版）である可能性が高い。⇒ 設計卓が閉じられるかの判断材料として記録する。**

### 11.2 ヘルパ経由化でテストの stderr が 3 行増えた

`useSessionStorage.test.ts` の 2 本（`sessionStorage が使用不可でもクラッシュしない` ／ `不正な JSON が保存されている場合は初期値を返す`）が
`browser-storage.ts` の `console.warn` を出すようになった（**実測 3 行**）。

**★抑止しない。** 抑止するには helper を経由しない形へ戻すことになり、**規約が求める経路から再び外れる**。
**★ただしレビューの懸念（「毎回出る出力は読まれなくなる」）は正しい。⇒ 記録として残す。**

---

## 12. 完了条件の照合（指示書 §6・14 点）

| # | 条件 | 状態 | 根拠 |
|---|---|---|---|
| 1 | 5 件の判定表（4 項目 ＋ 3 分類） | **✅** | §2.1 / §2.2 |
| 2 | (iii) が在るなら開発者へ諮ってある | **✅** | §2.3 / §7 / §9 |
| 3 | 書き換えたものは既存テストがそのまま通る | **✅** | `useSessionStorage.test.ts` は**差分 0 行**で 6 本緑（§3.1） |
| 4 | テストを書き換えたなら対照表が在り assert が減っていない | **✅** | §3.2（`it` 3 → 3 ／ `expect` 7 → 14） |
| 5 | 台帳のキーが 1 つも変わっていない | **✅** | `check-browser-storage-keys.sh` **EXIT=0**（§4.2） |
| 6 | `(max-width: 639px)` が変わっていない | **✅** | `useIsMobile.ts` 差分 **0 行**（§4.4） |
| 7 | (iii) の収束の説明（制約を名指し） | **✅** | §5.1 |
| 8 | 一致先コードを実装資料として使っていないことを報告に書いた | **✅** | §3.0 |
| 9 | 全数テストの件数が着手前と一致 | **✅** | §4.1 |
| 10 | §5 の検査がすべて緑（出力で判定） | **✅** | §4.2 |
| 11 | 完了報告 ＋ `progress-log` 索引行 | **✅** | 本書 ＋ `docs/progress/progress-log.md` 末尾 |
| 12 | 設計伝達レポート（CHANGE 原稿は §1 / §6） | **✅** | `docs/handover/design-reports/20260920-m40-02-design-exceptions.md` |
| 13 | 着手前の版ゲート 6 点 | **✅** | §1（**ゲート 4 は満たせなかったことを明記**） |
| 14 | **完了報告を書いた*後に*、報告を入力に取る検査を回し直し、その出力を報告へ貼った** | **✅** | §13 |

---

## 13. ★★★完了報告を書いた*後に*回し直した検査（完了条件 14）

**★★検査を回した時点と報告を書いた時点がずれると「緑」が偽になる**（`D-890` ／ `M36-01` §7-1）。
**⇒ 本書・設計伝達レポート・`progress-log` の索引行を書き終えた*後に*回し直した出力を、そのまま貼る。**

```
### bash scripts/check-progress-log-index.sh
## 2. 完了報告 → progress-log の追記カバレッジ
OK  検査した 123 件すべてが progress-log に現れる(ALLOW 除外 17 件)
結果: 違反なし
EXIT=0

### bash scripts/check-completion-report-md-emphasis.sh
OK  docs/instructions/templates/M{N}-{NN}-{slug}.template.md §7.4 に手順の本文がある
結果: 違反なし
EXIT=0

### bash scripts/check-doc-inventory.sh
?   docs/handover/scanoss-local-rescan-handover.md
?   docs/progress/M26-04-scanoss-followup-report.md
結果: 型に無いファイル 2 件
EXIT=0   ← 情報提供型(常に exit 0)

### bash scripts/check-stop-discipline.sh
OK  CLAUDE.md / review_plan.md / incorporate_plan.md / implement_plan_full.md に停止規律の節がある
結果: 違反なし
EXIT=0

### bash scripts/check-artifact-integrity.sh
結果: 違反なし
EXIT=0

### bash scripts/check-doc-refs.sh
結果: dead reference なし(例示 8 件は ALLOW 表で除外)
EXIT=0

### bash scripts/check-md-emphasis.sh <この手番の新規 .md>
docs/progress/M40-02-completion-report.md : EXIT=0
docs/handover/design-reports/20260920-m40-02-design-exceptions.md : EXIT=0
```

**★★`check-doc-inventory.sh` が挙げた 2 件は本サブの成果物ではない。**
`docs/handover/scanoss-local-rescan-handover.md` と `docs/progress/M26-04-scanoss-followup-report.md` は
**`M26-04` が作った既存ファイルであり、着手前から型に無い状態であった**（本サブは 1 行も触っていない）。
**⇒ 本サブが新設した 3 件**〔完了報告 ／ レビュー報告 ／ 設計伝達レポート〕**はいずれも既存の型に収まっており、増やしていない。**

**★★`check-md-emphasis.sh` は初回 EXIT=1 であった**——完了報告 15 行 ／ 設計伝達レポート 3 行。**原因は 2 つある。**

| # | 原因 | 直し方 |
|---|---|---|
| (a) | **行をまたぐ強調**（強調を開いた行と閉じた行が別。本検査は 1 行ずつ描画するため必ず当たる） | **1 行へ畳んだ** |
| (b) | **約物に隣接する強調記号**（閉じる側の直前が `。` `」` `）`、または開く側の直後が `「`） | **約物を強調の外へ出した** |

**★さらに 1 往復した。** 上の (b) を*説明する文*そのものが (b) に当たり、再検査で 2 行が出た。
**⇒ 説明を表へ移し、約物を含む例示を本文から外して EXIT=0 にした。**
**★フェンス内のコード引用による偽陽性は 1 件も無かった。⇒ 直せないまま残した行は無い。**

---

## 14. 停止規律

**★上限（再レビュー往復 2 回 / タイムボックス / 開発者の終了指示）には達していない。往復 0 回で収束した。**

**★未解消のまま停止した項目は 7 件**（いずれも**射程外**または**設計卓の手番**）。
**⇒ `docs/handover/followup-backlog.md` は 1 文字も編集していない**（`D-838`）。
**⇒ 必須 5 フィールド付きの原稿は設計伝達レポート §4 に在る**（`20260920-m40-02-design-exceptions.md`）。

| 原稿 | ID |
|---|---|
| §4-1 | `scanoss-rescan-expectation-after-m40-02` |
| §4-2 | `followup-declared-but-never-filed` |
| §4-3 | `expanded-ids-persistence-unguarded` |
| §4-4 | `recent-combos-limit-magic-number` |
| §4-5 | `shallow-clone-blocks-provenance-git-log` |
| §4-6 | `change-report-085-stale-after-m40-02` |
| §4-7 | `setup-hooks-test-import-order-violation` |

---

*以上、M40-02 完了報告。* **★★★本サブの本体は書き換えではなく判定であった。⇒ 5 件中 2 件だけを書き換え、3 件は制約を名指しした収束の説明とともに据え置いた。★「一致を消すこと」は一度も目的にしていない。**
