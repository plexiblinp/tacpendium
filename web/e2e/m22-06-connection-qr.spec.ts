import { test, expect, type Page } from "@playwright/test";

// M22-06: 接続用 QR コード(FR407)。
//
// ★★ 本 spec は共有バックエンドの状態を書き換えない ★★
// `server.mode` はグローバル資源であり、`fullyParallel: false` が直列化するのは
// 「ファイル内」だけで、ファイル単位では並列に走る(D-362)。
// ⇒ config.toml の mode を lan にすると、同時に走る他 spec が許可 Origin の変わった
//   サーバを相手にすることになる。加えて lan モードは代表 LAN IP が見つからない環境
//   では起動そのものが中止されるため(followup `cloud-env-cannot-start-lan-mode`)、
//   E2E スタックを lan で立てることはできない。
//   そこでコンテキスト単位で応答を差し替える(M22-01 / M22-02 / M22-08 と同じ形)。
// ★書き換えないので復元も要らない。
//
// ★照合パターンは「オリジン直下の /api/」に限る。`**/api/**` のような緩い glob は
// Vite が dev で配るソースモジュールのパス(例 /src/features/tag/api/tagApi.ts)にも
// 当たり、JS が JSON へ化けてアプリが起動しなくなる(M22-01 で実測)。
const API_ORIGIN_RE = /^https?:\/\/[^/]+\/api\//;

// サーバが返す体で注入する代表 LAN IP と接続 URL。
// ★ブラウザが実際に見ているオリジン(localhost:5273 等)とは別の値にしてある。
//   接続 URL を `window.location` から組み立てる実装に変えると、画面に出る URL が
//   ブラウザ側のホストへ化けるため、B の最後のアサーションが赤くなる(指示書 §4.2-3)。
// ★ポートも一緒に差し替える。差し替えないとネットワーク節のポート行は E2E スタックの
//   実ポート(47390 系)を出し、注入した LAN_URL のポートと食い違って読み手を混乱させる。
//   `config.server.port` を読んでいるのは SettingsSectionNetwork.tsx:80 の表示のみで、
//   アプリの API 呼出は VITE_API_PORT を使うため、差し替えても通信には影響しない。
const LAN_IP = "192.168.1.50";
const LAN_PORT = 47318;
const LAN_URL = `http://${LAN_IP}:${LAN_PORT}`;

const QR_BUTTON = "QR コード表示";

/**
 * LAN 共有モードで動いているサーバを、このブラウザコンテキストにだけ再現する。
 *
 * 実応答を取ってから該当フィールドだけ差し替えるので、DTO の形は実物に追随する
 * (フィールドが増えても本 spec は古い形を配らない)。
 */
async function simulateLanMode(page: Page): Promise<void> {
  await page.route(API_ORIGIN_RE, async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;

    if (request.method() !== "GET" || path !== "/api/config") {
      await route.continue();
      return;
    }

    const response = await route.fetch();
    const body = await response.json();

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ...body,
        server: { ...body.server, mode: "lan", port: LAN_PORT },
        network: { primaryLanIp: LAN_IP, lanUrl: LAN_URL },
      }),
    });
  });
}

// ===========================================================================
// A: LAN 共有モード OFF(E2E スタックの既定 = local)
// ===========================================================================

test.describe("M22-06 A: LAN 共有モード OFF", () => {
  test("QR 表示ボタンが出ない", async ({ page }) => {
    await page.goto("/settings");

    // ★前提の確認: ネットワーク節そのものは描画されている。
    //   これが無いと「画面が壊れていてボタンが 0 件」と区別できない。
    await expect(page.getByRole("heading", { name: "ネットワーク" })).toBeVisible();

    // ★モードそのものを主張する。ここが崩れたとき「QR が漏れている」ではなく
    //   「前提が違う(config.toml が local ではない)」と読める失敗メッセージになる。
    await expect(page.getByText("ローカル", { exact: true })).toBeVisible();

    // local なので LAN 公開時の注記も出ない。
    await expect(page.getByTestId("settings-network-external-note")).toHaveCount(0);

    // ★DES-005 §5.16「LAN共有モードON時のみ有効」の as-built は非描画である。
    //   disabled なボタンが残るのではなく、DOM から消える。
    await expect(page.getByRole("button", { name: QR_BUTTON })).toHaveCount(0);
  });
});

// ===========================================================================
// B: LAN 共有モード ON
// ★A だけだと「常に出さない実装」でも緑になり、B だけだと「常に出す実装」でも
//   緑になる。1 組で置いてはじめて条件が固定される(指示書 §5.2)。
// ===========================================================================

test.describe("M22-06 B: LAN 共有モード ON", () => {
  test("QR 表示ボタンが出て、押すとモーダルが開く", async ({ page }) => {
    await simulateLanMode(page);
    await page.goto("/settings");

    const button = page.getByRole("button", { name: QR_BUTTON });
    await expect(button).toBeVisible();

    await button.click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText("QR コード");
  });

  test("モーダルに出る接続 URL がサーバ由来である", async ({ page }) => {
    await simulateLanMode(page);
    await page.goto("/settings");

    await page.getByRole("button", { name: QR_BUTTON }).click();

    // ★サーバが返した値がそのまま出ること。
    const dialog = page.getByRole("dialog");
    await expect(dialog).toContainText(LAN_URL);

    // ★ブラウザ自身のホストへ化けていないこと(指示書 §4.2-3)。
    const browserHost = new URL(page.url()).host;
    await expect(dialog).not.toContainText(browserHost);
  });

  test("ネットワーク節に接続可能な IP とポートが出ている", async ({ page }) => {
    await simulateLanMode(page);
    await page.goto("/settings");

    // DES-005 §5.16「接続可能IP/ポート表示」の as-built(指示書 §4.3-2)。
    // ★3 行そろって守る。ポートを落とすと §5.16 の項目の半分が無防備になる。
    await expect(page.getByText(LAN_IP, { exact: true })).toBeVisible();
    await expect(page.getByText(String(LAN_PORT), { exact: true })).toBeVisible();
    await expect(page.getByText(LAN_URL, { exact: true })).toBeVisible();
  });
});
