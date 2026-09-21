# M22-06 完了報告: 接続用 QR コードの検証と穴埋め（`FR407`）

| 項目 | 内容 |
|------|------|
| 対象指示書 | `docs/instructions/M22-06-connection-qr-code.md` **v2.5.0** |
| チェックリスト | `docs/instructions/reviews/M22-06-review-checklist.md` **v2.2.0** |
| CHANGE | **`CHANGE-117`**（2026-08-17 承認済み・確認事項 0 件＝**D-428** / **D-427**） |
| 着手前 HEAD | `f223723` |
| 実施日 | 2026-08-18 |
| ブランチ | `claude/m22-06-implementation-plan-j5l13h` |

---

## 0. 結論（先に 3 行）

1. **穴は 1 件も無かった。** §4.3 の候補 4 件はいずれも「既に満たされていた」か「撤回済み」であり、**本番コードの差分は 0 バイトである**（チェックリスト §0.3 N-1）。
2. **本サブの成果は回帰ゲートである。** 破壊確認 A / B とも赤を確認し、**既存 20 ケースはいずれも緑のままだった**——**これまで何も守っていなかったことの裏付けになる**（**★ただし §5.1-5 だけは例外。§1-4b を参照**）。
3. **否定形確認の走査で、指示書にも調査レポートにも無い 2 つ目の消費側を見つけた**（ウィザード Step 6）。同じ契約をそちらにも置いた。

**★開発者の実機確認は実施済み・合格である**（§9。**2026-08-18 の開発者申告**）。**製造側の環境では到達できなかった**（クラウド実行環境では `lan` モードでバックエンドが起動しない＝§1-7）が、**開発者が先行する工程で QR および設定画面 URL からのアクセスを実機で確認しており、その確認は本サブの完了時点に対しても有効である**——根拠は §9-1 のバイト同一性。

---

## 1. §3.3 着手前の実査（8 項目）の結果

### 1-1. `M22-RESEARCH-01` の実パスと、HEAD での成否

実パスは `docs/progress/M22-RESEARCH-01-report.md`。**§6 F-4 ／ §8-1 の結論は HEAD でも成立する**（QR は実装済み・配線済み・依存済み）。

**ただし行番号は失効している。** 同レポートは HEAD `8af2ca6` のスナップショットであり（`E-56`）、その後 2 つのコミットが対象ファイルを触っている。

```bash
git log --oneline 8af2ca6..HEAD -- web/src/features/config/QRCodeModal.tsx \
                                   web/src/features/config/SettingsSectionNetwork.tsx
# 2789d11 fix(M21-07): レビュー指摘を取り込み — 共有プリミティブを通らない自作モーダル 2 件を塞ぐ
# b786540 feat(M22-02/auth): 段1 完了——パスワードの面を実装
```

| 項目 | レポートの記述 | HEAD の実値 |
|---|---|---|
| `QRCodeModal.tsx` | 58 行・`:45` に `QRCodeSVG` | **68 行**・**`:52`** に `QRCodeSVG` |
| QR ボタン | `SettingsSectionNetwork.tsx:96-101` | **`:99-105`** |
| モーダル配線 | 同 `:109-110` | **`:119-120`** |

**★§9.3-4 の停止条件には当たらない。** 停止条件は「実測が HEAD で成り立たない」場合であり、**成り立たなくなったのは行番号だけで、実測の中身（何が在るか）は不変**である。

### 1-2. **表示ボタンの `disabled` の実体**（★穴の在否を決める項目）

**`disabled` 属性は付いていない。条件レンダリングである。**

```tsx
// web/src/features/config/SettingsSectionNetwork.tsx
 84  {isLan && (
 93      {config.network.lanUrl && (
 99            <button
100              type="button"
101              onClick={() => setShowQr(true)}
...
105            </button>
```

**⇒ LAN 共有モード OFF のとき、ボタンは DOM に存在しない。** ファイル内で `disabled` を持つのは `:62` の `<Switch disabled={updateConfig.isPending}>` だけであり、QR ボタンとは無関係である。

**★これは `DES-005` §5.16 の「LAN共有モードON時のみ有効」より強い状態である。** 指示書 §4.3-1 が懸念した「押せてモーダルが出ない＝無反応なボタン」は、**構造的に発生しない。**

### 1-3. 「接続可能IP/ポート表示」の在否

**在る。3 行ともネットワーク節に描画されている。**

| 表示 | 位置 | 条件 |
|---|---|---|
| ポート | `SettingsSectionNetwork.tsx:77-82` | 常時（`local` 時は `127.0.0.1:<port>` 表記） |
| 代表 LAN IP | 同 `:86-91` | `isLan` 時。空なら `settings.network.noLanIp` へフォールバック |
| 接続 URL | 同 `:93-98` | `isLan` かつ `lanUrl` が非空 |

### 1-4. 既存 3 ケース（`QRCodeModal.test.tsx`）が何を主張しているか

| # | ケース名 | 主張 |
|---|---|---|
| 1 | `displays URL and QR code` | URL 文字列が `getByText` で見つかる ＋ `role="dialog"` が在る。**★名前に反して `QRCodeSVG` に渡る値は検査していない** |
| 2 | `calls onClose when close button is clicked` | 「閉じる」押下で `onClose` が 1 回 |
| 3 | `calls onClose on Escape key` | Escape で `onClose` が 1 回 |

**⇒ 3 件とも「符号化される値」に触れていない。** 本サブが足したケースはこれらと重複しない（§3.3-4）。

### 1-4b. ★重複調査を `QRCodeModal.test.tsx` の外へ広げた（レビュー指摘・高-1 の取り込み）

**初版の本節は `QRCodeModal.test.tsx` の 1 ファイルだけを見ていた。** レビューの指摘により `SettingsPage.test.tsx` を数え直したところ、**QR ボタン専用のケースが 2 件あった。**

```
:48  it("renders all 6 sections when config is loaded", ...)   ← 6 セクションの合成
:60  it("shows QR button in LAN mode with lanUrl", ...)         ← ★QR 専用
:67  it("does not show QR button in local mode", ...)           ← ★QR 専用
```

**★これは本報告の物語に対する重要な修正である。**

**⇒ §5.1-5（LAN 共有モード OFF 時のボタンの状態）は、着手前から画面層で守られていた。** 本サブが足した「LAN 共有モード OFF のとき、QR ボタンは描画されない」は `:67` とほぼ同じ主張であり（差は `queryByText` → `queryByRole` と、モーダル自体が構築されていないことの確認）、**この 1 項目については「既存が何も守っていなかった」は当てはまらない。**

**★「既存は何も守っていなかった」が成り立つのは、破壊確認 A / B が対象とする項目（§5.1 の 1〜4）である**——§3-1 / §3-2 の実測どおり、パスワードの混入も `window.location` 由来への差し替えも、既存テストを 1 つも赤にしなかった。**⇒ 本報告の主張は §5.1-5 には及ばない。設計卓は「既存テストは全面的に無力だった」と一般化して読まないこと。**

それでもコンポーネント層へ置いた理由は、`SettingsPage.test.tsx` が `useConfig` をモックした画面全体の組み立てを見るのに対し、本ケースは `DES-005` §5.16 の条件そのものを props で直接固定するためである。

### 1-5. `lanUrl` が空文字のときの画面の挙動

`resolveNetwork()` は `Mode != "lan"` でも、`lan` で IP 解決に失敗しても、**同じ空の `NetworkInfo{}` を返す**（`internal/service/config/service.go:367-383`）。画面はモード（`config.server.mode`）を別に持っているため、2 つを区別できる。

| 状態 | 画面 |
|---|---|
| `local` | IP 行・URL 行・QR ボタンとも非描画。モードは「ローカル」と表示 |
| `lan` かつ IP 未検出 | **「LAN IP を取得できませんでした」を表示**。URL 行と QR ボタンは非描画 |

**★`SUPP-001` §2.6.2 の項目 5（「候補が 1 つも見つからない場合……設定画面等で『LANに接続されていません』等のエラーを表示」）は満たされている。**

### 1-6. `web/src/features/config/` の現況（`M22-08` との交差）

`M22-08` が足したのは **`SettingsSectionUser.tsx`**（＋ `SettingsSectionUser.logout.test.tsx`）のみ。**本サブが触る 2 ファイルとは交差しない。**

**★指示書 §3.3-6 の記述に 1 点の誤りがある**——`UserManagement.tsx` は `web/src/features/config/` ではなく **`web/src/features/user/`** に在る。交差の判定結論は変わらない。

### 1-7. **`lan` モードでサーバを起動できるか**

**できない。実測で確認した。**

```bash
sed -i 's/^mode = "local"/mode = "lan"/' config.toml
COMBOMGR_DB_PATH=web/e2e/.tmp/probe-lan.db go run ./cmd/combomgr
```

```
fatal: build allowed origins: LAN モードで起動できる IP が見つかりません。config.toml の [server].mode を "local" に変更するか、ネットワーク接続を確認してください: netutil: no LAN IPv4 available
exit status 1
```

本機の非ループバックアドレスは `192.0.2.2`（RFC 5737 TEST-NET-1）1 本のみで、`IsPrivateIPv4` が **正しく** RFC1918 外として弾く。`buildAllowedOrigins`（`cmd/combomgr/main.go:489-512`）は代表 IP を得られないと **fatal で起動を中止する**。

**★これは実装の欠陥ではなく仕様どおりの挙動である**（followup `cloud-env-cannot-start-lan-mode`）。**⇒ QR に埋まる値を機械で実測することはできない。実機確認は開発者の手番である**（§9）。

**★確認後 `config.toml` は `local` へ戻し、プローブ用 DB も削除した**（§4.4-5）。`config.toml` は `.gitignore` 対象であり、`config.toml.example` と差分 0 の状態に戻っている。

### 1-8. `make e2e` の前提

- **`web/node_modules` が無かった**（followup `e2e-requires-pnpm-install-on-clean-clone`）。`pnpm install --frozen-lockfile` を実行した。
- `config.toml` も未生成だったが、`make e2e` が `config.toml.example` から生成する。
- **着手前の `make e2e` は完走した**（`149 passed (2.8m)`）。**⇒ 落ちた場合に自分の変更を疑う前の基準が取れている。**
- **`markdown-it-py` も未導入だった**（後述 §7-2）。

---

## 2. §4.3 穴の候補 4 件の在否と処遇

| # | 候補 | 在否 | 埋めたか | 理由 |
|---|---|---|---|---|
| **1** | LAN 共有モード OFF でボタンが押せてしまう | **穴では無かった** | **埋めていない** | 条件レンダリングで **DOM から消える**（§1-2）。「無反応なボタン」は構造的に発生しない。**`disabled` を足すと二重の守りになる**（`CHANGE-117` §5 リスク 2 が名指しで警告している形） |
| **2** | 「接続可能IP/ポート表示」が無い | **在った** | **埋めていない** | ポート・代表 IP・接続 URL の 3 行が既に描画されている（§1-3） |
| **3** | QR の内容がテキストでも見えない | **撤回済み**（`D-427`）。**実装されている** | **埋めていない** | 後述 §2.1 に as-built を書いた |
| **4** | `REQ-001` `FR407` の状態記述が失効 | **撤回済み**（`D-426`） | **追っていない** | 要件表の列は `ID / 要件 / 優先度 / フェーズ` であり実装状態を表さない。**製造は `REQ-001` を編集しない** |

**★4 件すべてについて在否が確定した。埋めるものは 1 つも無かった。**

### 2.1 穴候補 3 の as-built（`CHANGE-117` §2-c 向け）

**接続 URL は 2 か所に、それぞれ別の形で出ている。**

| 場所 | 実体 | 選択 | コピーボタン |
|---|---|---|---|
| **QR モーダルの中**（QR 直下） | `QRCodeModal.tsx:54` の `<p className="text-center … break-all">{url}</p>` | 可（通常の DOM テキスト） | **無し** |
| **設定画面のネットワーク節** | `SettingsSectionNetwork.tsx:93-98` の `<span className="… font-mono text-blue-600 break-all">{lanUrl}</span>` | 可（同上） | **無し** |

**★`CHANGE-117` §2-b と §2-c は別物である。** §2-b（接続可能IP/ポート表示）はネットワーク節の 3 行、§2-c（QR の内容のテキスト表示）はモーダル内の 1 行であり、**画面上の位置も出現条件も違う**（モーダル側はボタンを押さないと出ない）。**⇒ §5.16 へは 2 項として書くのが as-built に忠実である。**

**★開発者の回答「設定画面の QR コードの下に URL を出す、という意味なら既に出している」は、モーダル内の `:54` を指している。**

補足: `web/src/features/config/` 配下に `clipboard` / `copy` / `readOnly` / `<code` の出現は **0 件**。コピー用の導線はどこにも無い。

---

## 3. 破壊確認 A / B の結果（§5.1 の 2・4）

**★2 件とも赤になった。** 加えて、**既存テストがいずれも緑のままだったこと**を同時に測った——これが「何が代わりに守っていたか」への答え（＝**何も守っていなかった**）である。

### 3-1. 破壊確認 A — QR へパスワード相当を継ぎ足す

```diff
- <QRCodeSVG value={url} size={200} />
+ <QRCodeSVG value={`${url}?pw=hunter2`} size={200} />
```

```
 ❯ src/features/config/QRCodeModal.contract.test.tsx (2 tests | 2 failed) 46ms
   × QR に渡るのは接続 URL の 1 値だけである 37ms
   × パスワード・トークンを載せる入れ物(クエリ・フラグメント)を持たない 7ms
 ❯ src/features/config/SettingsSectionNetwork.qr.test.tsx (5 tests | 2 failed) 198ms
   × QR に渡る接続 URL は GET /api/config の network.lanUrl 由来である 147ms
   × ブラウザのホストが別でも、QR に渡る値はそれに引きずられない 31ms
 ✓ src/pages/SettingsPage.test.tsx (10 tests) 564ms
 ✓ src/features/config/SettingsSectionNetwork.test.tsx (7 tests) 472ms
 ✓ src/features/config/QRCodeModal.test.tsx (3 tests) 116ms

 Test Files  2 failed | 7 passed (9)
      Tests  4 failed | 32 passed (36)
```

```
AssertionError: expected 'http://192.168.1.50:47318?pw=hunter2' to be 'http://192.168.1.50:47318'
```

**★注目すべきは `QRCodeModal.test.tsx`（既存 3 ケース）が緑のままだったことである。** 同ファイルの「displays URL and QR code」は `<p>{url}</p>` のテキストを見ており、**`QRCodeSVG` に渡る値には触れていない**。**⇒ パスワードを QR にだけ載せる変更は、既存テストを 1 つも赤くしない。**

### 3-2. 破壊確認 B — 接続 URL を `window.location` から組み立てる

```diff
- <QRCodeModal url={config.network.lanUrl} onClose={() => setShowQr(false)} />
+ <QRCodeModal
+   url={`${window.location.protocol}//${window.location.host}`}
+   onClose={() => setShowQr(false)}
+ />
```

```
 ✓ src/features/config/QRCodeModal.contract.test.tsx (2 tests) 40ms
 ❯ src/features/config/SettingsSectionNetwork.qr.test.tsx (5 tests | 2 failed) 224ms
   ✓ 前提: 本ファイルはサーバの LAN URL と無関係なホストで走っている 2ms
   × QR に渡る接続 URL は GET /api/config の network.lanUrl 由来である 166ms
   × ブラウザのホストが別でも、QR に渡る値はそれに引きずられない 37ms
 ✓ src/pages/SettingsPage.test.tsx (10 tests) 599ms
 ✓ src/features/config/SettingsSectionNetwork.test.tsx (7 tests) 507ms

 Test Files  1 failed | 8 passed (9)
      Tests  2 failed | 34 passed (36)
```

```
AssertionError: expected 'http://qr-wrong-host.invalid:9999' to be 'http://192.168.1.50:47318'
```

**★既存の `SettingsSectionNetwork.test.tsx`（7 ケース）・`SettingsPage.test.tsx`（10 ケース）・`QRCodeModal.test.tsx`（3 ケース）は緑のままだった（計 20 ケース）。**

> **★A / B の記録の時点差について**（レビュー指摘・低-9 の取り込み）——上記 §3-1 / §3-2 の出力は 9 ファイル・36 ケースであり、**`Step06LanInfo.qr.test.tsx` を含まない**（同ファイルは後続コミット `b996273` で追加された）。ウィザード側については B 型の破壊確認のみ本報告に記録がある。**A 型（QR へパスワードを継ぎ足す）でもウィザード側のケースが赤くなることは、レビューが独立に再現して確認した**（レビュー報告 §1 の 1 行目＝`Tests 5 failed | 8 passed (13)` の内訳に `Step06LanInfo.qr` 1 件が含まれる）。

### 3-3. E2E でも破壊確認を行った（`D-375`）

同じ B の改変で E2E を回すと、**モーダルに出る URL がブラウザ自身のホストへ化ける**ことが目視できる形で出た。

```
 ✓ 2 M22-06 B: QR 表示ボタンが出て、押すとモーダルが開く (1.1s)
 ✘ 3 M22-06 B: モーダルに出る接続 URL がサーバ由来である (6.1s)

    Received string: "QR コードこのQRコードをスキャンしてアクセスしてください。http://localhost:5273閉じる"
```

**★「QR が表示された」を主張するケース（2 番）は緑のまま**である。**⇒ チェックリスト §0.2-3 が言う「『QR が表示された』で止まると、`window.location` 由来の実装でも通ってしまう」が、そのまま再現した。**

### 3-4. 「赤にならなかった項目」——**無し**

§5.1 の 7 項目のうち、破壊確認の対象である 2・4 はいずれも赤になった。**「テストを強くした」で済ませた項目は無い。**

### 3-5. 破壊確認の空回りを防ぐ仕掛け

破壊確認 B は「jsdom の location を別ホストへ固定する」ことで成立している。**この固定が効いていないと、テストは何も検査しないまま緑を返す。**

⇒ そこで **docblock が効いていることを主張する前提テストを 1 本置いた**（`E-84` の型を破壊確認の足場へ適用したもの）。

```tsx
it("前提: 本ファイルはサーバの LAN URL と無関係なホストで走っている", () => {
  expect(window.location.host).toBe(WRONG_HOST);
  expect(SERVER_LAN_URL.includes(WRONG_HOST)).toBe(false);
});
```

---

## 4. 実装した内容（**本番コードの差分は 0**）

```
 web/e2e/m22-06-connection-qr.spec.ts               | 125 ++++++++++++++
 web/src/features/config/QRCodeModal.contract.test.tsx  |  48 ++++++
 web/src/features/config/SettingsSectionNetwork.qr.test.tsx | 163 +++++++++++
 web/src/features/wizard/Step06LanInfo.qr.test.tsx  |  76 ++++++++
 4 files changed, 412 insertions(+)
```

### 4-1. §5.1 の 7 項目の対応

| # | 確認項目 | 置いた場所 | 備考 |
|---|---|---|---|
| 1 | QR に渡る値が接続 URL の 1 値だけ | `QRCodeModal.contract.test.tsx` | 破壊確認 A の受け皿 |
| 2 | **破壊確認 A** | 同上 | §3-1 で赤を確認 |
| 3 | 接続 URL が `network.lanUrl` 由来 | `SettingsSectionNetwork.qr.test.tsx` | |
| 4 | **破壊確認 B** | 同上 | §3-2 で赤を確認 |
| 5 | LAN OFF 時のボタンの状態 | 同上 | as-built は「非描画」 |
| 6 | `lanUrl` 空文字時に壊れず理由が出る | 同上 | |
| 7 | `resolveNetwork()` が `Mode != "lan"` で空を返す（Go） | **足していない** | **既存テストが在るため**（下記） |

**★項目 7 の判断**——`internal/service/config/service_test.go:333` の **`TestService_Get_NetworkLocalMode`** が、`mode="local"` ＋ 正常に応答するリゾルバという条件で `PrimaryLanIp == ""` / `LanUrl == ""` を主張している。加えて `:353` `TestService_Get_NetworkLanMode`、`:374` `TestService_Get_NetworkLanModeFailure` が lan 側と失敗側を固定している。**⇒ §5.1-7 の「既存テストが在るなら足さない」に従い、Go 側には 1 行も足していない。**

### 4-2. 設計上の判断

**(a) `qrcode.react` をモックした理由。** 実物の `QRCodeSVG` は値を `<svg>` の矩形群へ符号化してしまい、**テストから読み戻せない**。`FR407` が禁じているのは「符号化される中身」であるため、**渡す直前の値を捕まえる以外に固定する手段が無い**。実物が実際に描画されること自体は既存 3 ケースが押さえており、責務が分かれている。

**(b) `vi.stubGlobal("location", …)` ではなく docblock を使った理由。** jsdom の `window.location` は `[Unforgeable]` として定義されており、`defineProperty` 系の差し替えは環境によって失敗しうる。`@vitest-environment-options` で **jsdom 自身の URL を設定する**ほうが、実際のブラウザ状態に近く、かつ壊れ方が静かでない。

**(c) 新規 `data-testid` を 1 つも足していない理由。** `docs/design/testid-convention.md` は「`getByRole` 等で一意に取れるなら付けない」を方針としており、QR ボタンはアクセシブル名（`QR コード表示`）で引ける。**加えて、付けると台帳 2 か所（`DES-005` §6.8 ／ `testid-convention.md`）への追記が必要になり、`docs/design/` に差分が出る**——これはチェックリスト §9-7 の重大判定に当たる。**⇒ 付けないのが正しい。**

**(d) E2E で `server.mode` を書き換えなかった理由。** `server.mode` はグローバル資源であり、`fullyParallel: false` が直列化するのは**ファイル内だけ**でファイル単位では並列に走る（**D-362**）。加えて本環境では `lan` にすると**バックエンドが起動しない**（§1-7）。**⇒ `page.route` でこのブラウザコンテキストの `GET /api/config` だけを差し替えた**（`M22-01` / `M22-02` / `M22-08` と同じ形）。**書き換えていないので復元も要らない**——チェックリスト §5 の「復元」条項は**非該当**である。

### 4-3. ★指示書 §2.1 の一覧に無いファイルを 1 つ触った

**`web/src/features/wizard/Step06LanInfo.qr.test.tsx`（新規）。**

**理由**——§4.9 の否定形確認の走査で、**`QRCodeModal` の消費側が 2 つあることが判明した**。

```
web/src/features/wizard/Step06LanInfo.tsx:4:import QRCodeModal from "@/features/config/QRCodeModal";
web/src/features/wizard/Step06LanInfo.tsx:44:  <QRCodeModal url={network.lanUrl} onClose={() => setShowQr(false)} />
```

**★指示書も `M22-RESEARCH-01` も、この消費側を挙げていない。**

- **as-built は正しい**——`WizardPage.tsx:110-111` が `config?.network` をそのまま渡しており、サーバ由来である。**⇒ 穴ではない。**
- **しかし設定画面側だけを固定すると、こちらを `window.location` から組み立てる実装へ変えても全テストが緑のままになる。** `FR407` は消費側ごとに守られる必要がある。
- 破壊確認（`url` を `window.location.origin` へ差し替え）で赤を確認済み。

**本番コードは 1 バイトも変えていない。** 足したのは回帰ゲートのみ。

---

## 5. テスト結果（§7.2。**コマンド自身の出力を転記**＝`E-125`）

### 5-1. Go

```
$ go test ./...
ok  	github.com/plexiblinp/combomgr/internal/api/tag	2.248s
ok  	github.com/plexiblinp/combomgr/internal/config	0.010s
ok  	github.com/plexiblinp/combomgr/internal/infra/db	0.017s
ok  	github.com/plexiblinp/combomgr/internal/infra/migration	43.914s
ok  	github.com/plexiblinp/combomgr/internal/infra/netutil	0.006s
ok  	github.com/plexiblinp/combomgr/internal/model	0.003s
ok  	github.com/plexiblinp/combomgr/internal/moveindex	0.003s
ok  	github.com/plexiblinp/combomgr/internal/repository/character	4.425s
ok  	github.com/plexiblinp/combomgr/internal/repository/combo	33.336s
ok  	github.com/plexiblinp/combomgr/internal/repository/move	0.687s
ok  	github.com/plexiblinp/combomgr/internal/repository/movecommand	2.999s
ok  	github.com/plexiblinp/combomgr/internal/repository/preset	15.752s
ok  	github.com/plexiblinp/combomgr/internal/repository/punish	8.247s
ok  	github.com/plexiblinp/combomgr/internal/repository/setup	15.527s
ok  	github.com/plexiblinp/combomgr/internal/repository/tag	2.610s
ok  	github.com/plexiblinp/combomgr/internal/seedgen	0.114s
ok  	github.com/plexiblinp/combomgr/internal/service/auth	6.514s
ok  	github.com/plexiblinp/combomgr/internal/service/character	0.004s
ok  	github.com/plexiblinp/combomgr/internal/service/combo	64.118s
ok  	github.com/plexiblinp/combomgr/internal/service/comboio	10.569s
ok  	github.com/plexiblinp/combomgr/internal/service/comboio/csvcore	0.005s
ok  	github.com/plexiblinp/combomgr/internal/service/config	0.021s
ok  	github.com/plexiblinp/combomgr/internal/service/inputresolve	0.701s
ok  	github.com/plexiblinp/combomgr/internal/service/intake	0.004s
ok  	github.com/plexiblinp/combomgr/internal/service/move	0.003s
ok  	github.com/plexiblinp/combomgr/internal/service/movewarning	0.004s
ok  	github.com/plexiblinp/combomgr/internal/service/notation	18.284s
ok  	github.com/plexiblinp/combomgr/internal/service/preset	23.091s
ok  	github.com/plexiblinp/combomgr/internal/service/punishfinder	1.285s
ok  	github.com/plexiblinp/combomgr/internal/service/punishlist	0.004s
ok  	github.com/plexiblinp/combomgr/internal/service/setplay	0.034s
ok  	github.com/plexiblinp/combomgr/internal/service/setup	17.017s
ok  	github.com/plexiblinp/combomgr/internal/service/tag	11.524s
ok  	github.com/plexiblinp/combomgr/internal/service/user	4.747s
ok  	github.com/plexiblinp/combomgr/internal/service/validation	0.003s
（`[no test files]` の 7 パッケージを除き全て ok。FAIL 0 件）
```

**Go 側は 1 行も変更していないため、着手前後で同一である。**

### 5-2. Vitest

```
$ cd web && pnpm exec vitest run
 Test Files  170 passed (170)
      Tests  1674 passed (1674)
   Duration  69.69s
```

**着手前は `167 passed (167)` / `1664 passed (1664)`。⇒ ファイル +3、ケース +10。**

> **`pnpm test` ではなく `pnpm exec vitest run` を使った。** `package.json` の `"test": "vitest"` は素の `vitest` であり watch へ入りうる。**`E-125`（`vitest: not found` が exit 0 として「フロントは緑」と誤報告された `M20-06` の前例）を踏まないため、スイート名と件数を出力から転記している。**

### 5-3. 型検査

```
$ cd web && pnpm lint    # tsc --noEmit
（出力なし・エラー 0 件）
```

### 5-4. E2E

**着手前**（1 バイトも変更する前・§1-8）:

```
$ make e2e
  149 passed (2.8m)
```

**着手後**:

```
$ make e2e
  ✓  131 [chromium] › e2e/m22-06-connection-qr.spec.ts:65:3 › M22-06 A: LAN 共有モード OFF › QR 表示ボタンが出ない
  ✓  133 [chromium] › e2e/m22-06-connection-qr.spec.ts:88:3 › M22-06 B: LAN 共有モード ON › QR 表示ボタンが出て、押すとモーダルが開く
  ✓  132 [chromium] › e2e/m22-06-connection-qr.spec.ts:102:3 › M22-06 B: LAN 共有モード ON › モーダルに出る接続 URL がサーバ由来である (1.8s)
  ✓  134 [chromium] › e2e/m22-06-connection-qr.spec.ts:117:3 › M22-06 B: LAN 共有モード ON › ネットワーク節に接続可能な IP とポートが出ている (1.6s)

  153 passed (2.7m)
```

**⇒ 149 → 153（+4）。既存 149 件はすべて緑のままであり、回帰は無い。**

**レビュー取り込み後の再走**（コメント・ケース名・アサーションの修正後）:

```
$ make e2e
  1 flaky
    [chromium] › e2e/m18-03b-materialize.spec.ts:200:3 › M18-03b materialize › C: 識別キー変更編集で採用が引き継がれる(§4.6・マイリストから消えない)
  152 passed (2.6m)
```

**★flaky 1 件は本サブの変更とは無関係である**（followup `e2e-shared-global-resource-parallel`。**`M22-01` 〜 `M22-05` に続き 6 サブ連続で観測**）。根拠は 3 つ——(1) **本サブは `m18-03b-materialize.spec.ts` を触っていない**（`git diff` に現れない）、(2) **単発実行で緑**（`4 passed (8.5s)`。リトライ無し）、(3) **着手前ベースラインでも取り込み前の再走でも出ていない**（いずれも `149 passed` / `153 passed` で flaky 0）。**⇒ 一括実行時にだけ再現性なく出る既知の型であり、恒久策は未着手のままである。**

**§5.2 の A / B が 1 組で置かれている**——A だけだと「常に出さない実装」でも緑になり、B だけだと「常に出す実装」でも緑になる。**spec は `config` を書き換えていないため、復元は非該当である**（§4-2 の d）。

### 5-5. 単発実行時の注意

`pnpm exec playwright test <spec>` を素で叩くと `browserType.launch: Executable doesn't exist` で落ちる。**テストの失敗に見えるが環境の問題である**（followup `playwright-single-spec-needs-pw-executable-path`）。本作業では `PW_EXECUTABLE_PATH=/opt/pw-browsers/chromium` を前置きした。

---

## 6. 品質チェック（§7.3）

### 6-1. 凍結対象の差分（着手前 `f223723` → HEAD・**すべて 0**）

```bash
for p in migrations/ character_data/ docs/design/ \
         internal/service/notation/ internal/service/preset/ \
         web/src/features/physical-input/ web/src/features/gamepad/ web/src/features/keyboard/ \
         web/package.json web/pnpm-lock.yaml go.mod go.sum internal/infra/netutil/; do
  echo "$p : $(git diff --numstat f223723..HEAD -- "$p" | wc -l) 件"
done
```

```
  migrations/ : 0 件
  character_data/ : 0 件
  docs/design/ : 0 件
  internal/service/notation/ : 0 件
  internal/service/preset/ : 0 件
  web/src/features/physical-input/ : 0 件
  web/src/features/gamepad/ : 0 件
  web/src/features/keyboard/ : 0 件
  web/package.json : 0 件
  web/pnpm-lock.yaml : 0 件
  go.mod : 0 件
  go.sum : 0 件
  internal/infra/netutil/ : 0 件
```

**★`netutil` の優先順位ロジック（`private_ip.go` の `selectByPriority`）にも差分は無い**（§2.2-6・チェックリスト §9-9）。
**★依存を足していない・替えていない・上げていない**（チェックリスト §9-6・N-6。`qrcode.react@4.2.0` は着手前から `dependencies` に在ったものをそのまま使っている）。
**★API を新設・変更していない**（チェックリスト §9-10）。

### 6-2. 機械検査

| 検査 | 結果 |
|---|---|
| `bash scripts/check-artifact-integrity.sh` | **違反なし**（★下記 §7-2 の是正後） |
| `bash scripts/check-browser-storage-keys.sh` | **違反なし**（台帳 9 件 / 本番コード 8 件・**新規キー無し**） |
| `bash scripts/check-stop-discipline.sh` | **違反なし** |
| `bash scripts/check-md-emphasis.sh` | **違反なし**（436 行 / ベースライン 436 行） |
| `bash scripts/check-progress-log-index.sh` | §8 の追記後に実行（結果は progress-log 追記時に確認） |

---

## 7. 環境に関する記録（**自分の変更のせいではないもの**）

### 7-1. `/app_build_check` は着手前から WAIT である（§7.5-5）

**着手前に実行した実測**（本サブが 1 バイトも変更する前）:

```
=== 3. フロント依存 既知脆弱性 (pnpm audit) ===
  検出: critical=0 high=3 moderate=4 low=0

=== 総合判定 ===
WAIT
```

内訳は `M22-RESEARCH-01` G-6 の実測（2026-08-15）と**同一**である——`nanoid` high×2 ／ `postcss` high×1 ＋ moderate×1 ／ `react-router` 系 moderate×3。

**★本サブは `web/package.json` / `pnpm-lock.yaml` に差分 0 であり（§6-1）、この WAIT に一切寄与していない。** 依存更新の判断は開発者である（`CLAUDE.md` §6）。チェックリスト §0.3 N-5 / §12.1 が「緑にすることは求めていない」と明記している。

### 7-2. `check-artifact-integrity` が最初 NG を返した（**環境要因・是正済み**）

```
NG  check-md-emphasis.sh の --self-test が「自己検査: 合格」を出力しない
```

原因は **`markdown-it-py` の未導入**であり、スクリプト自身の欠陥ではない。

```
ERROR: markdown-it-py が見つかりません。検査を実行できませんでした(未実行)。
OK  陽性対照(依存欠落) → 未実行として非ゼロ終了・緑を返さない
```

**★スクリプトは依存が無いとき緑を返さない設計になっており、正しく振る舞っている。** `pip install markdown-it-py` を実行したところ、`check-artifact-integrity` / `check-md-emphasis` とも**違反なし**になった。

**⇒ クリーンなクローンでは `pnpm install` に加えて `pip install markdown-it-py` も要る**（followup `e2e-requires-pnpm-install-on-clean-clone` と同型。**同 followup は E2E 前提として記録されているが、実際には `check-md-emphasis` の前提でもある**）。

---

## 8. 否定形確認（§4.9）

### 8-1. 陽性対照（`E-84`）——**先に置いた**

```bash
LC_ALL=C.UTF-8 grep -rn "接続用QRコード表示ボタン" docs/design/05-screen-design.md
```

```
763:   - 接続用QRコード表示ボタン（FR407、押下でモーダル表示。LAN共有モードON時のみ有効。QRコードには接続URLのみを含めパスワードは含めない）
```

**⇒ 走査系は生きている。以降の「0 件」は「走査が壊れていた」ではない。**

### 8-2. 走査 1: 本番コード／テスト資産

```bash
LC_ALL=C.UTF-8 grep -rn -E "FR407|QR|qrcode|未実装|notImplemented" \
  --include="*.ts" --include="*.tsx" --include="*.go" \
  web/src internal cmd | grep -iE "QR|FR407|qrcode"
```

**結果: 失効記述 0 件。** ヒットはすべて実装・テスト・設計参照コメントであり、「未実装」を述べる記述は 1 件も無い。
**★本走査が `Step06LanInfo.tsx`（2 つ目の消費側）を掘り当てた**（§4-3）。走査の副産物としては最大の収穫である。

### 8-3. 走査 2: 設計文書・指示書・overview

```bash
LC_ALL=C.UTF-8 grep -rn -E "QR[^。]{0,40}(未実装|実装されていない|未着手)|(未実装|実装されていない)[^。]{0,40}QR" \
  docs/design docs/instructions docs/process
```

**結果: 現役の失効記述 0 件。** ヒット 3 件はいずれも **`M22-06` 指示書自身の更新履歴・§4.9 の走査キーワード表**であり、**過去の記録として正しい**（v1.0.0 の前提が誤っていたことを記した行）。

### 8-4. 走査 3: 「QR ライブラリの追加が要る」旨

```bash
LC_ALL=C.UTF-8 grep -rn -E "qrcode\.react" docs/design docs/instructions docs/process
```

**結果: 現役文書に失効記述 0 件。** ヒットは (a) `M22-06` 指示書・チェックリストの「既に在る／足さない」旨、(b) **`docs/instructions/phase1/` 配下の M6 期指示書**（`qrcode.react` 推奨・Plan Mode で確定）、(c) ボードの裁定記録。**(b) は当時は正しく、アーカイブ済みの履歴である。**

### 8-5. 走査 4: 行を跨ぐ文脈（ファイル単位）

```bash
LC_ALL=C.UTF-8 grep -rl "QR" docs/design docs/instructions docs/process \
  | xargs -r grep -l "未実装"
```

12 ファイルがヒットしたため **全ファイルの「未実装」出現箇所を目視した**。

**結果: QR に関する「未実装」記述は 1 件も無い。** `DES-005` の「未実装」は上書き（M13-i）とステップ並び替え、`SUPP-001` はプリセット保護と幽霊仕様、`M22-overview` は `FR013` 後半、`M22-05` は CSRF、`M22-07` は `alias_text_en` の表示——**いずれも QR とは無関係の別トピックである。**

---

## 9. 実機確認（§4.4）— **★実施済み・合格**（2026-08-18 開発者申告）

### 9-0. 結果

**開発者は本サブの直前の工程で、次の 2 つを実機で確認済みである。**

| # | 項目 | 結果 |
|---|---|---|
| 1 | **QR コードによるスマートフォンからのアクセス**（＝`FR407` の要求そのもの・§4.4-4） | **合格** |
| 2 | **設定画面に表示された URL からのアクセス**（＝§4.3-2 / §2.1 の as-built） | **合格** |

**⇒ チェックリスト §1 の最重要ゲート「スマートフォンのブラウザでアプリが開いた」は満たされている。** 「QR が表示された」で止まっていない。

> **★過大に主張しないために記す**（M22-05 完了報告 §12 の先例に倣う）——本報告が根拠にしているのは**開発者の申告**であり、製造側で観測したものではない。**申告に含まれていない項目**＝起動ログの `allowed_origins` の目視、スマートフォン側のアドレスバーの値、別セグメント時の挙動。**★いずれも合否判定に影響しない**——アクセスが成立した以上、代表 IP の選定と URL の生成は正しく働いている。

### 9-1. ★なぜ「先行工程での確認」が本サブの完了時点でも有効か

**確認が行われたのは M22-06 のコミットより前である。** それでも有効と判断した根拠は、**QR 経路のバイトが同一である**ことであり、次の 4 点を実測した。

```bash
# (1) 本サブが本番コードを 1 バイトも変えていない
git diff --stat f223723..HEAD -- web/src internal cmd migrations
#   → *.test.tsx 3 本のみ（QRCodeModal.contract / SettingsSectionNetwork.qr / Step06LanInfo.qr）

# (2) QR 経路の本番コード 7 ファイルを 2026-08-16 以降に触ったコミット
git log --since=2026-08-16 --oneline -- \
  web/src/features/config/QRCodeModal.tsx \
  web/src/features/config/SettingsSectionNetwork.tsx \
  web/src/features/wizard/Step06LanInfo.tsx \
  internal/service/config/service.go internal/api/config/dto.go \
  internal/infra/netutil/private_ip.go cmd/combomgr/main.go
#   → 0 件（最終変更は 2026-08-15 の 2789d11 / b786540）

# (3) URL 生成ロジック本体の変更履歴
git log --oneline -L '/func (s \*service) resolveNetwork/,/^}/:internal/service/config/service.go'
git log --oneline -L '/func SelectPrimaryLANIP/,/^}/:internal/infra/netutil/private_ip.go'
#   → いずれも本サブに至る窓で一度も変わっていない

# (4) QR 周辺の i18n 文言
git diff 7649450^..HEAD -- web/src/locales/ja.json web/src/locales/en.json \
  | grep -iE "qrModal|showQr|lanUrl|ipAddress|noLanIp"
#   → 0 件
```

**⇒ 開発者が確認したバイナリと、本サブ完了時点のバイナリは、QR 経路について同一である。** 同じバイトに同じ手動確認を再度当てても新しい情報は得られないため、**再実施は不要と判断した。**

**★この判断が成り立たなくなる条件**——上記 7 ファイルのいずれかが変わったら、確認は再度要る。とくに `resolveNetwork()` と `SelectPrimaryLANIP()` は、**壊しても `localhost` では正常に見える**（§4.2-3）ため、機械の緑では代替できない。

### 9-2. 手順（**★再確認が必要になったとき用に残す**）

**必要なもの**: アプリを動かす PC 1 台 ＋ **同じ Wi-Fi につないだスマートフォン** 1 台。

### 手順 1. LAN 共有モードを ON にする

アプリを起動し、設定画面（`/settings`）→ ネットワーク → 「LAN 共有モード」のスイッチを ON。確認ダイアログで続行する。

```bash
make run-server
```

別のターミナルで:

```bash
make run-web
```

> `make build` した配布バイナリでも可。その場合は起動時の案内（stdout）に LAN URL 一覧が出る。

### 手順 2. サーバを起動し直す

`server.mode` の変更は再起動が要る（画面に「再起動が必要」と出る）。起動し直したあと、ネットワーク節に **代表 LAN IP と接続 URL** が出ていることを確認する。

```bash
# マイグレが当たったかはコンソールではなくログで見る（JSON）
tail -f logs/combomgr.log
```

### 手順 3. QR を表示する

設定画面 → ネットワーク → 「QR コード表示」ボタンを押す。モーダルに QR と、その下に接続 URL が出る。

### 手順 4. ★スマートフォンで読み取り、**アプリが開くところまで**確認する

スマートフォンのカメラを起動 → QR を読み取り → 通知をタップ → **ブラウザで CombMgr が開くこと**を確認する。

> **★ここが最重要ゲートである。** 「QR が表示された」で止めないこと。**接続 URL を `window.location` から組み立てる実装でも、QR の表示までは通ってしまう**（§3-3 で実際に再現した）。**繋がるかどうかはスマートフォンで試したときにしか分からない。**

**確認する内容**:

- ブラウザのアドレスバーが `http://192.168.x.x:47318`（`localhost` ではないこと）
- コンボ一覧が表示されること

**繋がらない場合に疑うもの**（いずれも本サブの範囲外の既知事項）:

- スマートフォンが PC と**別のセグメント**に居る（`SelectPrimaryLANIP` は代表 IP を 1 件しか返さない＝`SUPP-001` §2.6.2・指示書 §1.3-5）。ネットワーク節に出ている IP と、スマートフォンの IP の先頭 3 オクテットを見比べる
- PC のファイアウォール／ウイルス対策ソフトがポートを塞いでいる

### 手順 5. ★設定を元へ戻す

確認が済んだら **LAN 共有モードを OFF に戻す**（`PUT /api/config` は `config.toml` を書き換える）。

---

## 10. `CHANGE` 要否の判定（§6.5）

**★該当する。3 件を設計卓へ渡す。**（**製造は起票しない**）

### 10-1. `CHANGE-117` が既に反映先として押さえている 4 点への回答

| # | `CHANGE-117` §2 の項目 | as-built の回答 |
|---|---|---|
| **a** | §5.16「LAN共有モードON時のみ有効」の実体 | **`disabled` でもモーダル側ガードだけでもない。「非描画」である。** ボタンは `isLan && lanUrl` の二重の条件レンダリング内に在り、OFF のとき DOM に存在しない。モーダル側のガード（`{showQr && config.network.lanUrl && …}`）は**さらにその内側**に在り、二重になっている（§1-2） |
| **b** | 「接続可能IP/ポート表示」の在否 | **在る。** ポート・代表 LAN IP・接続 URL の 3 行（§1-3）。**★ただし代表 IP 1 件のみであり、候補一覧ではない**（下記 10-2 の ii） |
| **c** | QR の内容のテキスト表示 | **在る。2 か所に別々の形で出ている**（§2.1）。**§2-b とは別物であり、§5.16 へは 2 項として書くのが as-built に忠実**。**選択は可・コピーボタンは無し** |
| **d** | 代表 LAN IP が CORS の許可 Origin と同じ関数で決まること | **同じ関数だが、値も経路も共有していない**（下記 10-2 の iii） |

### 10-2. 新たに見つかった「設計 vs as-built」の差（**製造は直していない**）

| # | 差 | 根拠 | なぜ直さなかったか |
|---|---|---|---|
| **i** | **接続 URL の末尾スラッシュ。** `REQ-001` `FR407`（`requirements.md:176`）と `SUPP-001` §2.6.2 は `http://<IP>:<Port>/` と書くが、as-built は `internal/service/config/service.go:381` の `fmt.Sprintf("http://%s:%d", ipStr, port)` で**スラッシュが無い** | §6.5-4「`SUPP-001` §2.6.2 の記述と実体が食い違った」に**該当** | **機能差は無い**（ブラウザが `/` へ正規化する）。**§6.5-4 の運用は「DES を as-built に合わせる（指示書に合わせない）」であり、`SUPP-001` §2.6.2 は `CHANGE-117` §2.1 の「変えないもの」に入っている。** ⇒ 製造が URL 形式を変える判断はできない |
| **ii** | **「接続可能IP/ポート表示」は代表 IP 1 件のみ。** 一方 `SUPP-001` §5.6 の起動時案内は「LAN モード時は **LAN URL 一覧**」と複数形で書かれており、`main.go:349-353` が `ListPrivateIPv4()` で実際に一覧を出している | 画面と stdout で**粒度が違う** | `ListPrivateIPv4()` は `internal/api` からは一度も呼ばれておらず、**画面へ一覧を出すにはサーバ側の新設が要る**（指示書 §4.3-2 は「サーバ側の新設は要らない見込み」としている）。⇒ スコープ外 |
| **iii** | **CORS と config は同じ関数を別経路で呼ぶ。** `buildAllowedOrigins`（`main.go:503`）は `netutil.SelectPrimaryLANIP()` を直接呼び、config サービスは同じ関数を注入で受ける（`main.go:261`）。**値・キャッシュ・抽象を一切共有していない** | `CHANGE-117` §2-d の回答 | 記述の問題であり実装の欠陥ではない。**★ただし振る舞いが 2 点で非対称である**——CORS は**起動時 1 回**で以後凍結・失敗すると **fatal**、`resolveNetwork` は**毎リクエスト**・失敗すると **warn ＋ 空**。**⇒ 稼働中に NIC が変わると `network.primaryLanIp` が凍結済みの CORS Origin から乖離しうる。§5.16 へ 1 行書くときは「同じ関数で決まる」だけでなくこの非対称も書かないと、片方だけ変えて他方が壊れる** |

### 10-3. 該当しない条件

- **§6.5-2**（`REQ-001` `FR407` の状態記述）——**★2026-08-17 に撤回済み**（`D-426`）。要件表の列は実装状態を表さない。**`REQ-001` は改訂しない**（チェックリスト §0.3 N-9 / §3）。
- **§6.5-3**（API の新設・変更）——**該当なし。** サーバ側は 1 バイトも変えていない。

---

## 11. 並列相手との突合（`E-121`・§7.5-8）

**★本サブの実施期間中、同時に走っていた並列サブは無かった。** 作業ブランチは `claude/m22-06-implementation-plan-j5l13h` のみで、着手前の作業ツリーはクリーンだった。

| 相手 | 状態 | 交差の実査結果 |
|---|---|---|
| **`M21-07`**（物理入力・モーダル遮断） | **完了・main へマージ済み**（`3fae137`） | **交差なし。** ただし**同じ `QRCodeModal.tsx` を触った履歴がある**（`2789d11`＝共有プリミティブを通らない自作モーダル 2 件に `ModalPresenceMarker` を追加）。**本サブはその行に触れておらず、`web/src/features/physical-input/` ほかの差分も 0 件**（§6-1） |
| **`M22-07`**（別名辞書） | **未着手** | **交差なし。** 本サブは `migrations/` に触れておらず（差分 0 件）、マイグレ連番を 1 つも消費していない |
| **`M22-08`**（入場まわりの仕上げ） | **完了・main へマージ済み**（`a3bab04`） | **同じ `web/src/features/config/` を触ったが、ファイルは分かれている**（`SettingsSectionUser.tsx` vs `SettingsSectionNetwork.tsx` / `QRCodeModal.tsx`）。**設定画面の節構成が変わっているため実査したが、ネットワーク節は無傷**。`SettingsPage.tsx` の 6 セクション構成は着手前後で不変 |
| **直列本線の完了済みサブ**（`M22-01`〜`M22-05`） | 完了 | `M22-02`（`b786540`）が `SettingsSectionNetwork.tsx` に `LanModeConfirmDialog` と `useAuthStatus` を足していた。**本サブの新規テストはこれを踏まえた足場を組んでいる**（`useAuthStatus` のモック）。`M22-05`（`5aed482`）は `useUpdateConfig.test.ts` のみで交差なし |

**回帰ゲート**: 設定画面の他セクションが壊れていないことは、`SettingsPage.test.tsx`（10 ケース）・`SettingsSectionUser.logout.test.tsx`（5 ケース）・`SettingsSectionDetails.test.tsx`（2 ケース）が着手前後で緑のままであることで確認した（§3-1・§3-2 の出力に含まれる）。

---

## 12. スコープ外として閉じた項目

| # | 項目 | 理由 |
|---|---|---|
| 1 | QR にトークン・パスワードを載せる | `FR407` 違反（指示書 §1.3-1） |
| 2 | 接続 URL のコピーボタン | **`CHANGE-117` §4-1 で「既に出している」と解決済み**（`D-427`）。**穴ではないものへ機能を足さない** |
| 3 | 「接続可能IP/ポート表示」を候補一覧化する | サーバ側の新設が要る（§10-2 の ii） |
| 4 | 末尾スラッシュの是正 | 設計卓の判断（§10-2 の i） |
| 5 | `SelectPrimaryLANIP` の優先順位 | 指示書 §1.3-5・§2.2-6。差分 0 件 |
| 6 | 認証・CORS/CSRF・楽観排他 | `M22-01` / `M22-02` / `M22-03` / `M22-04` / `M22-05` の担当 |
| 7 | `resolveNetwork()` の `Update()` 経路のテスト | **§5.1-7 の範囲外。** 既存 3 テストは `Get()` のみを見ており、`Update()` が返す network ペイロードは未テストである。**⇒ followup 候補として設計伝達レポート §4 へ回す** |

---

## 13. ■ 併せて更新が要るもの

| # | 項目 | 該当 |
|---|---|---|
| 1 | **CHANGE 番号の払い出しと registry 登録** | **なし。** 本サブは CHANGE を起票していない（`CHANGE-117` は設計卓が 2026-08-17 に起票済み・`117` は消費済み）。**⇒ `change-number-registry.md` §1 への新規登録は不要** |
| 2 | **「次の番号」の写し先 4 か所の同期** | **なし。** 番号を 1 つも消費していないため、registry §1 ／ 契約 §4 ／ ボード §2.1 ／ ボード §2.4 のいずれも動かない |
| 3 | **マイグレ連番** | **なし。** `migrations/` の差分 0 件。**マイグレを 1 つも消費していない**（`CHANGE-117` §5 の「マイグレーション消費なし」と一致） |
| 4 | **版を上げた文書の参照元** | **なし。** 製造は文書の版を上げていない |
| 5 | **設計書と食い違った箇所** | **★3 件ある**（§10-2 の i・ii・iii）。**`DES-005` §5.16 は `CHANGE-117` の反映で設計卓が改訂する。製造は編集していない**（`docs/design/` 差分 0 件） |
| 6 | **ブラウザストレージ台帳** | **なし。** 新規キー 0 件。`check-browser-storage-keys.sh` 違反なし |
| 7 | **test-id 台帳 2 か所** | **なし。** 新規 test-id 0 件（§4-2 の c） |
| 8 | **`progress-log.md` への索引行** | **要る。** §8 の手順で追記した |

---

## 14. 設計卓への申し送り（設計伝達レポートへ回すもの）

1. **`CHANGE-117` の 4 点への回答**（§10-1）。**とくに §2-b と §2-c が別物であることの確定**——`CHANGE-117` §4-1 が「同じものである可能性がある／同じなら 1 項にまとめる」としていたが、**実査の結論は「別物」である**。
2. **新たな差 3 件**（§10-2）。末尾スラッシュ ／ 一覧 vs 代表 1 件 ／ CORS との非対称。
3. **followup 候補**（設計伝達レポート §4 へ。**製造は `followup-backlog.md` を編集しない**＝**D-382**）:
   - `qrcode-modal-has-two-consumers` — `QRCodeModal` の消費側が設定画面とウィザード Step 6 の 2 つある。**指示書・調査レポートのいずれも挙げていなかった**。本サブで両方に契約テストを置いたが、**3 つ目が足されたときに気づく仕組みは無い**
   - `config-update-network-payload-untested` — `resolveNetwork()` は `Get()` と `Update()` の両方から呼ばれるが、既存テストは `Get()` 経路のみ（§12-7）
   - `check-md-emphasis-requires-markdown-it-py` — クリーンなクローンでは `pip install markdown-it-py` が要る。**既存 followup `e2e-requires-pnpm-install-on-clean-clone` は E2E の前提としてのみ記録されているが、実際には `check-artifact-integrity` を赤にする**（§7-2）
   - `lan-url-trailing-slash-spec-vs-asbuilt` — §10-2 の i
4. **`qr-already-implemented-m22-06-scope` を畳める**（指示書 §10-3）。
5. **★指示書側の版ずれが 1 件ある**（レビューが発見）。**指示書 §7.5-1 と §9.4 は「§3.3 の実査 6 項目」と書くが、§3.3 の実体は 8 項目である**——v2.1.0 で 6 → 7、v2.2.0 で 7 → 8 へ増えた際に §7 / §9 側が追随していない。**製造は 8 項目すべてを実査・報告しているため実害は無い**が、**チェックリスト §0.1 / §12 も「6 項目」を引いており、レビュー側が 6 項目で足切りすると 2 項目が検査されないまま通る。** 次に同じ型の指示書を書くとき、**節の項目数を本文中に書き写している箇所は、増補のたびに `grep` で全数拾うこと**（`E-118` と同型）。

---

*以上、M22-06 完了報告。**穴は 1 件も無く、本番コードの差分は 0 バイトである。本サブが作ったのは「次に壊したときに赤くなる状態」であり、破壊確認 2 件がそれを実証した。** **残るは開発者の実機確認（§9）である。***
