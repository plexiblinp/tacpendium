import { test, expect, type Page } from "@playwright/test";

// M22-01: 簡易パスワードによる入場ゲート(サーバ側の骨格)。
//
// ★★ 本 spec は共有バックエンドの認証状態を書き換えない ★★
// 認証状態はグローバル資源であり、しかも `fullyParallel: false` が直列化するのは
// 「ファイル内」だけで、**ファイル単位では並列に走る**(followup
// `e2e-shared-global-resource-parallel` / board D-362)。
// ⇒ ここで `password_enabled = true` にすると、同時に走っている他 spec の API 呼出が
//   軒並み 401 になって落ちる。1 ファイルへ寄せても防げない(相手が別ファイルだから)。
//   config.toml も書き換えないため、復元も要らない。
//
// そこで 2 つの面を別の手段で見る:
//   - A(既定 OFF): 実バックエンドに対して確かめる。
//   - B(ON のときの見え方): `page.route` でこのブラウザコンテキストの API 応答だけを
//     401 に差し替える。サーバの状態は一切変わらないため他 spec に影響しない。
//     ★B が固定するのは「保護されているとき既存画面がどう見えるか」であり、
//     これは M22-02 が引き取る状態である。
//
// ON 側のサーバ挙動そのもの(誰が通り誰が弾かれるか)は Go 側で網羅している
// (internal/api/middleware/auth_test.go / internal/api/auth/handler_test.go)。

interface AuthStatus {
  passwordRequired: boolean;
  passwordSet: boolean;
  authenticated: boolean;
}

// ★オリジン直下の /api/ だけに当てる。`**/api/**` のような緩い glob は
// Vite が dev で配る **ソースモジュールのパス**(例 /src/features/tag/api/tagApi.ts)
// にも当たり、JS モジュールが 401 JSON に差し替わってアプリが起動しなくなる。
// そうなると「保護すると白画面になる」という誤った結論が出る(実測 2026-08-15)。
const API_ORIGIN_RE = /^https?:\/\/[^/]+\/api\//;

/** 認証ミドルウェアが有効なときの応答を、このブラウザコンテキストにだけ再現する。 */
async function denyProtectedApi(page: Page): Promise<void> {
  await page.route(API_ORIGIN_RE, async (route) => {
    const path = new URL(route.request().url()).pathname;

    // ★M22-02 で追加(2026-08-15)。認証状態も「保護されている」と答えさせる。
    // 初版は status を実サーバへ素通しさせていたため、保護対象は 401 なのに
    // status は passwordRequired=false と答える、実際には起きない状態を作っていた。
    // M22-02 の画面はこの実効値でログイン画面を出すため、素通しのままだと
    // 「保護中なのにログイン画面が出ない」という誤った観測になる。
    if (path === "/api/auth/status") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          passwordRequired: true,
          passwordSet: true,
          authenticated: false,
        }),
      });
      return;
    }

    // 保護対象から外れている経路は素通しにして、実際のミドルウェアと同じ形にする。
    // ★除外一覧の正本は `internal/api/middleware/auth.go` の `unprotectedPaths`
    // (パスの定数は `internal/api/auth/routes.go`)。ここは前方一致で束ねた近似であり、
    // 正本が変わっても本 spec は自動では追随しない。ON 側の除外の正しさは Go の
    // `TestAuth_Enabled_UnprotectedPathsPass` が全数で固定している。
    const unprotected = path === "/api/health" || path.startsWith("/api/auth/");
    if (unprotected) {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: 401,
      contentType: "application/json",
      body: JSON.stringify({
        error: { code: "unauthorized", message: "authentication required" },
      }),
    });
  });
}

/** fetchStatusInPage はページ内から fetch して status code を返す。
 *  ★page.request は APIRequestContext であり page.route を通らない。
 *  遮断が効いているかを見るには、ページ内の fetch を使う必要がある。 */
async function fetchStatusInPage(page: Page, path: string): Promise<number> {
  return page.evaluate(async (p) => (await fetch(p)).status, path);
}

test.describe("M22-01 A: 既定(password_enabled = false)では何も変わらない", () => {
  test("認証状態の問い合わせが未認証でも読め、保護が無効だと報告する", async ({ page }) => {
    const res = await page.request.get("/api/auth/status");
    expect(res.ok(), `status 取得失敗: ${res.status()}`).toBeTruthy();

    const status = (await res.json()) as AuthStatus;
    // ★落ちたときは自分の変更を疑う前に config.toml を見ること。E2E スタックは
    // TACPENDIUM_DB_PATH / TACPENDIUM_PORT は上書きするが [security] は
    // リポジトリの config.toml をそのまま読む。疎通確認(完了報告 §6)のあとに
    // password_enabled を戻し忘れると、ここだけでなく他の spec も軒並み 401 で落ちる。
    expect(
      status.passwordRequired,
      "config.toml の [security] password_enabled が true のままではないか(疎通確認の戻し忘れ)",
    ).toBe(false);
    expect(
      status.passwordSet,
      "config.toml の [security] password_hash が残っていないか(疎通確認の戻し忘れ)",
    ).toBe(false);
    expect(status.authenticated).toBe(false);
  });

  test("保護対象の API が認証なしで通り、セッション Cookie も発行されない", async ({ page }) => {
    const res = await page.request.get("/api/config");
    expect(res.status()).toBe(200);

    // ★OFF のときは Cookie を 1 枚も足さない(指示書 §4.9-4)。
    const setCookie = res.headersArray().filter((h) => h.name.toLowerCase() === "set-cookie");
    expect(setCookie, `OFF なのに Set-Cookie が付いた: ${JSON.stringify(setCookie)}`).toHaveLength(0);

    const cookies = await page.context().cookies();
    expect(cookies.filter((c) => c.name === "tacpendium_session")).toHaveLength(0);
  });

  test("コンボ一覧が従来どおり表示される", async ({ page }) => {
    await page.goto("/combos");
    await expect(page.getByRole("link", { name: "コンボ一覧" }).first()).toBeVisible();
    // ウィザードへ飛ばされない(= GET /api/config が読めている)。
    await expect(page).toHaveURL(/\/combos/);
    await expect(page.getByText(/エラーが発生しました/)).toHaveCount(0);
  });

  // ★対照実験。上の 3 本は「200 が返る」ことしか見ておらず、認証の骨格が
  // 生きていることの証明になっていない——全経路が素通しでも緑になる。
  // ログインが実際に照合していること(= 誤ったパスワードを弾くこと)を見る。
  test("対照: ログイン経路は生きており、誤ったパスワードを弾く", async ({ page }) => {
    const res = await page.request.post("/api/auth/login", {
      data: { password: "definitely-not-the-password" },
      failOnStatusCode: false,
    });
    expect(res.status(), "ログインが素通しになっている").toBe(401);

    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("invalid_password");
  });
});

test.describe("M22-01 B: 保護されているときの既存画面の見え方", () => {
  // ★M22-02 で主張を差し替えた(2026-08-15)。
  // 旧: 「外枠は描画され、データ領域が 401 のエラー表示になる」。
  // 当時は画面側が未実装で、生の 401 本文が赤枠に載るのが as-built だった
  // (followup `auth-401-shows-raw-error-body`)。M22-02 がログイン画面へ差し替えた
  // ため、その状態はもう正しくない。★旧記述を残すと、後任が「戻すべき状態」として
  // 読む(撤回済みの記述の残骸)。
  test("ログイン画面が出て、生の応答本文は表示されない", async ({ page }) => {
    await denyProtectedApi(page);
    await page.goto("/combos");

    // 1) 保護中はアプリ本体を描かず、ログイン画面を出す。
    //    ★AuthGate が App より外側にあるため、保護対象の GET /api/config は
    //    そもそも投げられない。初版が観測した約 7 秒の空転も無くなっている。
    await expect(page.getByTestId("auth-login-title")).toBeVisible();

    // 2) ウィザードへは飛ばない。★崩れると保護を掛けた瞬間に初期設定が始まる。
    await expect(page).toHaveURL(/\/combos/);

    // 3) 生の応答本文を利用者に見せない(指示書 §4.3-3)。
    await expect(page.getByText(/エラーが発生しました/)).toHaveCount(0);
    await expect(page.getByText(/unauthorized/)).toHaveCount(0);
  });

  test("保護対象から外れている経路は 401 のときも読める", async ({ page }) => {
    await denyProtectedApi(page);
    await page.goto("/combos");

    // ★M22-02 が「パスワードを求めるべきか」を知る経路。ここが塞がると
    // ログイン画面を出す判断ができない。
    expect(await fetchStatusInPage(page, "/api/auth/status")).toBe(200);
    expect(await fetchStatusInPage(page, "/api/health")).toBe(200);
  });

  // ★対照実験。上の 2 本は遮断した状態しか見ておらず、遮断そのものが
  // 効いているかを見ていない——route が空振りでも「外枠が出る」は緑になる。
  test("対照: 同じ画面で遮断の有無により保護対象の応答が変わる", async ({ page }) => {
    await page.goto("/combos");
    expect(await fetchStatusInPage(page, "/api/combos"), "遮断前は 200 のはず").toBe(200);

    await denyProtectedApi(page);
    expect(
      await fetchStatusInPage(page, "/api/combos"),
      "遮断が効いていない(route が空振りしている)",
    ).toBe(401);
  });
});
