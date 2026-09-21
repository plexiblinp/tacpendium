import { test, expect, type Page } from "@playwright/test";

// M22-08: 入場まわりの仕上げ(パスワードの検証・ログアウトの導線・利用者の改名)。
//
// ★★ 本 spec は共有バックエンドの状態を書き換えない ★★
// 認証状態も users テーブルもグローバル資源であり、`fullyParallel: false` が
// 直列化するのは「ファイル内」だけで、ファイル単位では並列に走る(D-362 / D-399 (1))。
// ⇒ config.toml の password_enabled を触ると同時に走る他 spec が軒並み 401 で落ち、
//   利用者を増やすと他 spec のユーザー選択の前提が変わる。
//   そこでコンテキスト単位で応答を差し替える(M22-01 / M22-02 と同じ形)。
//
// ★照合パターンは「オリジン直下の /api/」に限る。`**/api/**` のような緩い glob は
// Vite が dev で配るソースモジュールのパス(例 /src/features/tag/api/tagApi.ts)にも
// 当たり、JS が JSON へ化けてアプリが起動しなくなる(M22-01 で実測)。
const API_ORIGIN_RE = /^https?:\/\/[^/]+\/api\//;

interface AuthStatus {
  passwordRequired: boolean;
  passwordSet: boolean;
  authenticated: boolean;
}

/**
 * 入場ゲートが有効なサーバを、このブラウザコンテキストにだけ再現する。
 * ログアウトが呼ばれたら authenticated を倒し、以降は 401 を返す。
 *
 * ★`startAuthenticated = false` を渡すと、最初からログイン画面が出る状態になる。
 */
async function simulateProtectedServer(page: Page, startAuthenticated = true): Promise<void> {
  let authenticated = startAuthenticated;

  await page.route(API_ORIGIN_RE, async (route) => {
    const path = new URL(route.request().url()).pathname;

    if (path === "/api/auth/status") {
      const body: AuthStatus = { passwordRequired: true, passwordSet: true, authenticated };
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(body),
      });
      return;
    }

    if (path === "/api/auth/logout") {
      authenticated = false;
      await route.fulfill({ status: 204, body: "" });
      return;
    }

    if (path === "/api/health" || path.startsWith("/api/auth/")) {
      await route.continue();
      return;
    }

    // 保護対象。ログアウト後は 401 になる。
    if (!authenticated) {
      await route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({ error: { code: "unauthorized", message: "authentication required" } }),
      });
      return;
    }
    await route.continue();
  });
}

// ===========================================================================
// A: 既定(password_enabled = false)で非回帰。★ログアウトの導線が出ていない
// ===========================================================================

test.describe("M22-08 A: 既定では何も増えない", () => {
  test("設定画面にログアウトの導線が出ない", async ({ page }) => {
    await page.goto("/settings");

    // 利用者の欄そのものは出ている(前提の確認)。
    await expect(page.getByTestId("settings-user-password-action")).toBeVisible();

    // ★保護が無効なので、ログアウトは出ない。出すと押しても何も起きない導線になる。
    await expect(page.getByTestId("settings-user-logout")).toHaveCount(0);
  });

  test("既存の主要フローが非回帰である(コンボ一覧が従来どおり開く)", async ({ page }) => {
    await page.goto("/combos");
    await expect(page.getByTestId("auth-login-title")).toHaveCount(0);
    await expect(page.locator("body")).not.toContainText("Unexpected token");
  });

  // ★対照: 保護を再現するとログアウトが出る。これが無いと
  //   「そもそもセレクタが間違っていて 0 件」と区別できない。
  test("対照: 保護を再現するとログアウトの導線が出る", async ({ page }) => {
    await simulateProtectedServer(page);
    await page.goto("/settings");

    await expect(page.getByTestId("settings-user-logout")).toBeVisible();
  });
});

// ===========================================================================
// A-2: ★ログアウトを押すとログイン画面へ戻る(§5.1-9 後段・§4.3-3)
// ===========================================================================

test.describe("M22-08 A-2: ログアウトの動作", () => {
  // ★配線は「AUTH_STATUS_KEY を引き直す ⇒ AuthGate が passwordRequired &&
  // !authenticated を再評価して閉じ直す」であり、M22-02 が作った 401 の捕捉と同経路。
  // ★単体テストは logout が呼ばれることまでしか見られない。
  // 「戻る」ことはゲート全体を通さないと確かめられないため、ここで固定する。
  test("押すとログイン画面へ戻る", async ({ page }) => {
    await simulateProtectedServer(page);
    await page.goto("/settings");

    // 前提: 入れている(設定画面が描かれ、ログイン画面は出ていない)。
    await expect(page.getByTestId("settings-user-logout")).toBeVisible();
    await expect(page.getByTestId("auth-login-title")).toHaveCount(0);

    await page.getByTestId("settings-user-logout").click();

    // ★ログイン画面へ戻ること。
    await expect(page.getByTestId("auth-login-title")).toBeVisible();
    await expect(page.getByTestId("settings-user-logout")).toHaveCount(0);
  });

  // ★対照: 押さなければ戻らない。これが無いと
  //   「そもそも遷移していただけ」と区別できない。
  test("対照: 押さなければ設定画面のままである", async ({ page }) => {
    await simulateProtectedServer(page);
    await page.goto("/settings");

    await expect(page.getByTestId("settings-user-logout")).toBeVisible();
    await expect(page.getByTestId("auth-login-title")).toHaveCount(0);
  });
});

// ===========================================================================
// B: 日本語のパスワードを決めようとすると、理由が分かる形で弾かれる
// ===========================================================================

test.describe("M22-08 B: パスワードの検査", () => {
  // ★送信しない。決める操作を完了させるとサーバの検証子を書き換えてしまう。
  //
  // ★2026-08-16 開発者要望: 非 ASCII は入力段階で落とす。
  // ⇒ 「弾かれる」のではなく「そもそも欄に入らない」。
  test("日本語は欄に入らず、決められない", async ({ page }) => {
    await page.goto("/settings");

    await page.getByTestId("settings-user-password-action").click();
    const input = page.getByTestId("auth-set-password-input");
    await input.fill("ぱすわーど");

    await expect(input).toHaveValue("");
    await expect(page.getByTestId("auth-set-password-submit")).toBeDisabled();
  });

  test("全角と半角が混ざっていると、半角だけが残る", async ({ page }) => {
    await page.goto("/settings");

    await page.getByTestId("settings-user-password-action").click();
    const input = page.getByTestId("auth-set-password-input");
    await input.fill("ｐａｓｓword１２３");

    await expect(input).toHaveValue("word");
  });

  // ★ログイン欄にも掛かること——これが今回の要望の本体である。
  // 全角のまま打ってログインに失敗する経路をなくす。
  test("ログイン欄でも全角は入らない", async ({ page }) => {
    await simulateProtectedServer(page, false);
    await page.goto("/combos");

    const input = page.getByTestId("auth-login-password-input");
    await expect(input).toBeVisible();
    await input.fill("ＡＢＣ１２３");

    await expect(input).toHaveValue("");
    await expect(page.getByTestId("auth-login-submit")).toBeDisabled();
  });

  test("短すぎるときは下限が出る", async ({ page }) => {
    await page.goto("/settings");

    await page.getByTestId("settings-user-password-action").click();
    await page.getByTestId("auth-set-password-input").fill("abc");

    await expect(page.getByTestId("auth-set-password-rule-error")).toContainText("4 文字以上");
    await expect(page.getByTestId("auth-set-password-submit")).toBeDisabled();
  });

  // ★対照: 規則を満たせば押せるようになる(検査が常時止めているのではない)。
  test("対照: 半角の英数字なら押せるようになる", async ({ page }) => {
    await page.goto("/settings");

    await page.getByTestId("settings-user-password-action").click();
    await page.getByTestId("auth-set-password-input").fill("valid-password");

    await expect(page.getByTestId("auth-set-password-rule-error")).toHaveCount(0);
    await expect(page.getByTestId("auth-set-password-submit")).toBeEnabled();
    // ★押さない。押すとサーバの検証子が書き換わる(D-399 (1))。
  });
});

// ===========================================================================
// C: 利用者を改名すると、ヘッダの表示が変わる
// ===========================================================================

/**
 * 利用者が 2 人いるサーバを、このコンテキストにだけ再現する。
 * PATCH が来たら一覧側の名前も差し替え、引き直しで新しい名前が返るようにする。
 */
async function simulateTwoUsers(page: Page): Promise<void> {
  let users = [
    { id: 1, name: "いちばんめ" },
    { id: 2, name: "にばんめ" },
  ];

  await page.route(/^https?:\/\/[^/]+\/api\/users(\/\d+)?$/, async (route) => {
    const request = route.request();
    if (request.method() === "PATCH") {
      const id = Number(new URL(request.url()).pathname.split("/").pop());
      const payload = request.postDataJSON() as { name?: string } | null;
      users = users.map((u) => (u.id === id ? { ...u, name: payload?.name ?? u.name } : u));
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(users.find((u) => u.id === id)),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(users),
    });
  });
}

test.describe("M22-08 C: 利用者の改名", () => {
  test("改名するとヘッダの表示が追随する", async ({ page }) => {
    await simulateTwoUsers(page);
    await page.goto("/settings");

    // 2 人いるので選択画面が出る。1 人目を選ぶ。
    await page.getByTestId("user-select-item-1").click();
    await expect(page.getByTestId("header-current-user")).toContainText("いちばんめ");

    await page.getByTestId("settings-user-rename").click();
    await page.getByTestId("settings-user-rename-name").fill("あらためたなまえ");
    await page.getByTestId("settings-user-rename-submit").click();

    // ★これが §4.5-4 である。追随しないと、改名したのに古い名前が出たままになる。
    await expect(page.getByTestId("header-current-user")).toContainText("あらためたなまえ");
    await expect(page.getByTestId("header-current-user")).not.toContainText("いちばんめ");
  });

  // ★対照: 改名する前はヘッダに元の名前が出ている。
  test("対照: 改名しなければヘッダの名前は変わらない", async ({ page }) => {
    await simulateTwoUsers(page);
    await page.goto("/settings");

    await page.getByTestId("user-select-item-1").click();
    await expect(page.getByTestId("header-current-user")).toContainText("いちばんめ");

    await page.getByTestId("settings-user-rename").click();
    // 開いただけで閉じる。名前は変わらない。
    await page.getByRole("button", { name: "やめる" }).first().click();

    await expect(page.getByTestId("header-current-user")).toContainText("いちばんめ");
  });
});
