import { test, expect, type Page } from "@playwright/test";

// M22-02: ログイン画面・ユーザー選択(画面側)。
//
// ★★ 本 spec は共有バックエンドの認証状態を書き換えない ★★
// 認証状態はグローバル資源であり、`fullyParallel: false` が直列化するのは
// 「ファイル内」だけで、ファイル単位では並列に走る(D-362 / D-399 (1))。
// ⇒ config.toml の password_enabled を触ると、同時に走る他 spec が軒並み 401 で落ちる。
//   そこでコンテキスト単位で応答を差し替える(M22-01 と同じ形)。
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
 * ログインが通ると authenticated を反転させ、以降は実サーバへ素通しする。
 */
async function simulateProtectedServer(page: Page): Promise<void> {
  let authenticated = false;

  await page.route(API_ORIGIN_RE, async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;

    if (path === "/api/auth/status") {
      const body: AuthStatus = { passwordRequired: true, passwordSet: true, authenticated };
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(body),
      });
      return;
    }

    if (path === "/api/auth/login") {
      // 正しいパスワードだけ通す(照合が生きていることを画面側から見る)。
      const payload = route.request().postDataJSON() as { password?: string } | null;
      if (payload?.password === "correct-horse") {
        authenticated = true;
        await route.fulfill({ status: 204, body: "" });
      } else {
        await route.fulfill({
          status: 401,
          contentType: "application/json",
          body: JSON.stringify({
            error: { code: "invalid_password", message: "incorrect password" },
          }),
        });
      }
      return;
    }

    if (path === "/api/health" || path.startsWith("/api/auth/")) {
      await route.continue();
      return;
    }

    // 保護対象。通る前は 401、通ったあとは実サーバへ。
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

test.describe("M22-02 A: 既定(password_enabled = false)では何も増えない", () => {
  // ★これが「何も増えない」側の主要な網である(指示書 §5.2-A・§4.2)。
  // 既定は無効であり、いまの全利用者がこの経路を通る。
  test("ログイン画面が出ず、コンボ一覧が従来どおり表示される", async ({ page }) => {
    await page.goto("/combos");

    await expect(page.getByRole("link", { name: "コンボ一覧" }).first()).toBeVisible();
    await expect(page.getByTestId("auth-login-title")).toHaveCount(0);
    await expect(page.getByText(/エラーが発生しました/)).toHaveCount(0);
  });

  test("利用者が 1 人ならユーザー選択も出ない", async ({ page }) => {
    await page.goto("/combos");

    await expect(page.getByRole("link", { name: "コンボ一覧" }).first()).toBeVisible();
    await expect(page.getByTestId("user-select-title")).toHaveCount(0);
  });

  // ★対照実験。上の 2 本は「出ない」ことしか見ておらず、遮断が空振りでも緑になる。
  // 同じ画面で、保護を再現すると実際にログイン画面が出ることを見る。
  test("対照: 保護を再現するとログイン画面が出る", async ({ page }) => {
    await simulateProtectedServer(page);
    await page.goto("/combos");

    await expect(page.getByTestId("auth-login-title")).toBeVisible();
  });
});

test.describe("M22-02 B: 保護されているとき", () => {
  test("ログイン画面が出て、通ると使える", async ({ page }) => {
    await simulateProtectedServer(page);
    await page.goto("/combos");

    // ★保護中はアプリ本体を描かない。生の 401 本文も出さない
    //   (followup auth-401-shows-raw-error-body が閉じる状態)。
    await expect(page.getByTestId("auth-login-title")).toBeVisible();
    await expect(page.getByText(/エラーが発生しました/)).toHaveCount(0);
    await expect(page.getByText(/unauthorized/)).toHaveCount(0);

    await page.getByTestId("auth-login-password-input").fill("correct-horse");
    await page.getByTestId("auth-login-submit").click();

    // 通ったらアプリ本体が出る。
    await expect(page.getByRole("link", { name: "コンボ一覧" }).first()).toBeVisible();
    await expect(page.getByTestId("auth-login-title")).toHaveCount(0);
  });

  // ★§4.3-4（重大 §9-6）: ログイン経路自身の 401 を巻き込まない。
  test("パスワードを間違えても入力欄が消えず、そばに理由が出る", async ({ page }) => {
    await simulateProtectedServer(page);
    await page.goto("/combos");

    await page.getByTestId("auth-login-password-input").fill("wrong");
    await page.getByTestId("auth-login-submit").click();

    await expect(page.getByTestId("auth-login-error")).toBeVisible();
    // ★入力欄が残っていることが要件である。
    await expect(page.getByTestId("auth-login-password-input")).toBeVisible();
    await expect(page.getByTestId("auth-login-submit")).toBeVisible();
  });

  // ★§5.1-6 / D-397: ログイン欄はマスクが既定。表示へ切り替えられる。
  test("入力欄はマスクが既定で、表示へ切り替えられる", async ({ page }) => {
    await simulateProtectedServer(page);
    await page.goto("/combos");

    const input = page.getByTestId("auth-login-password-input");
    await expect(input).toHaveAttribute("type", "password");
    await page.getByTestId("auth-login-password-toggle").click();
    await expect(input).toHaveAttribute("type", "text");
  });

  // ★§5.1-15（重大 §9-20）: 更新しても入り直しにならない。
  // セッションは Cookie でブラウザが持ち、実体はサーバのメモリにある
  // (DES-002 §8.1 の 9〜12)。フロントが Cookie を触るとここが赤くなる。
  test("通ったあと画面を更新しても入り直しにならない", async ({ page }) => {
    await simulateProtectedServer(page);
    await page.goto("/combos");

    await page.getByTestId("auth-login-password-input").fill("correct-horse");
    await page.getByTestId("auth-login-submit").click();
    await expect(page.getByRole("link", { name: "コンボ一覧" }).first()).toBeVisible();

    await page.reload();

    await expect(page.getByRole("link", { name: "コンボ一覧" }).first()).toBeVisible();
    await expect(page.getByTestId("auth-login-title")).toHaveCount(0);
  });

  // ★§5.1-16 / §4.8-5: 入場済みなのに戻るでログイン画面が出ない。
  test("入場済みなら戻る・進むでログイン画面へ戻らない", async ({ page }) => {
    await simulateProtectedServer(page);
    await page.goto("/combos");

    await page.getByTestId("auth-login-password-input").fill("correct-horse");
    await page.getByTestId("auth-login-submit").click();
    await expect(page.getByRole("link", { name: "コンボ一覧" }).first()).toBeVisible();

    await page.goto("/settings");
    await expect(page.getByRole("heading", { name: "ユーザー管理" })).toBeVisible();

    await page.goBack();
    await expect(page.getByTestId("auth-login-title")).toHaveCount(0);
    await page.goForward();
    await expect(page.getByTestId("auth-login-title")).toHaveCount(0);
  });

  // ★対照実験。遮断そのものが効いているかを見る(route が空振りでも上は緑になりうる)。
  test("対照: 遮断しなければ保護対象は 200 を返す", async ({ page }) => {
    await page.goto("/combos");
    const before = await page.evaluate(async () => (await fetch("/api/combos")).status);
    expect(before, "遮断前は 200 のはず").toBe(200);

    await simulateProtectedServer(page);
    const after = await page.evaluate(async () => (await fetch("/api/combos")).status);
    expect(after, "遮断が効いていない(route が空振りしている)").toBe(401);
  });
});

/**
 * 利用者が 2 人居るサーバを、このブラウザコンテキストにだけ再現する。
 * ★サーバの users 表は書き換えない——他 spec と共有する資源であるため。
 */
async function simulateTwoUsers(page: Page): Promise<void> {
  await page.route(/^https?:\/\/[^/]+\/api\/users$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([
        { id: 1, name: "default" },
        { id: 2, name: "ふたりめ" },
      ]),
    });
  });
}

test.describe("M22-02 C: 利用者が 2 人以上のとき", () => {
  test("ユーザー選択が出て、選ぶと使える", async ({ page }) => {
    await simulateTwoUsers(page);
    await page.goto("/combos");

    await expect(page.getByTestId("user-select-title")).toBeVisible();
    // 選ぶまでアプリ本体は出ない。
    await expect(page.getByRole("link", { name: "コンボ一覧" })).toHaveCount(0);

    await page.getByTestId("user-select-item-2").click();

    await expect(page.getByRole("link", { name: "コンボ一覧" }).first()).toBeVisible();
    await expect(page.getByTestId("user-select-title")).toHaveCount(0);
  });

  // ★§4.8-3 / CHANGE-113 §7-1 の案 (α): 選んだ利用者は保持しない。
  // ★これは仕様であって欠陥ではない。手動確認の手順にも明記する。
  test("画面を更新すると選択画面へ戻る(保持しない)", async ({ page }) => {
    await simulateTwoUsers(page);
    await page.goto("/combos");
    await page.getByTestId("user-select-item-2").click();
    await expect(page.getByRole("link", { name: "コンボ一覧" }).first()).toBeVisible();

    await page.reload();

    await expect(page.getByTestId("user-select-title")).toBeVisible();
  });

  // ★§5.1-16 / §4.8-5: 選択済みなのに戻るで選択画面が出ない。
  test("選択済みなら戻る・進むで選択画面へ戻らない", async ({ page }) => {
    await simulateTwoUsers(page);
    await page.goto("/combos");
    await page.getByTestId("user-select-item-2").click();
    await expect(page.getByRole("link", { name: "コンボ一覧" }).first()).toBeVisible();

    await page.getByRole("link", { name: "設定" }).first().click();
    await expect(page).toHaveURL(/\/settings/);

    await page.goBack();
    await expect(page.getByTestId("user-select-title")).toHaveCount(0);
    await page.goForward();
    await expect(page.getByTestId("user-select-title")).toHaveCount(0);
  });

  // ★開発者の実機確認 ⑤(2026-08-16): 選んだあと、誰として操作しているかが
  // どこにも出ていなかった。ヘッダへ出し、押すと選び直せるようにした。
  test("選んだあとヘッダに名前が出て、押すと選び直せる", async ({ page }) => {
    await simulateTwoUsers(page);
    await page.goto("/combos");
    await page.getByTestId("user-select-item-2").click();

    const chip = page.getByTestId("header-current-user");
    await expect(chip).toBeVisible();
    await expect(chip).toContainText("ふたりめ");

    // 設定画面まで行かずに切り替えられる。
    await chip.click();
    await expect(page.getByTestId("user-select-title")).toBeVisible();
  });

  // ★対照実験。1 人なら出ないことを同じ spec 内で見る(FR502)。
  test("対照: 利用者が 1 人なら選択画面は出ない", async ({ page }) => {
    await page.route(/^https?:\/\/[^/]+\/api\/users$/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([{ id: 1, name: "default" }]),
      });
    });
    await page.goto("/combos");

    await expect(page.getByRole("link", { name: "コンボ一覧" }).first()).toBeVisible();
    await expect(page.getByTestId("user-select-title")).toHaveCount(0);
    // ★ヘッダの利用者表示も出ない(1 人運用の画面はいままでどおり)。
    await expect(page.getByTestId("header-current-user")).toHaveCount(0);
  });
});

test.describe("M22-02 D: 送信経路", () => {
  // ★§5.1-11: 選んだ利用者が実際のリクエストヘッダへ載る。
  test("選んだ利用者が X-User-Id として送られる", async ({ page }) => {
    await simulateTwoUsers(page);
    const seen: string[] = [];
    await page.route(/^https?:\/\/[^/]+\/api\/tags/, async (route) => {
      seen.push(route.request().headers()["x-user-id"] ?? "(なし)");
      await route.continue();
    });

    await page.goto("/combos");
    await page.getByTestId("user-select-item-2").click();
    await expect(page.getByRole("link", { name: "コンボ一覧" }).first()).toBeVisible();

    await expect
      .poll(() => seen.length, { message: "タグの問い合わせが飛んでいない" })
      .toBeGreaterThan(0);
    expect(seen.every((v) => v === "2"), `送られたヘッダ: ${JSON.stringify(seen)}`).toBe(true);
  });
});
