import { test, expect, type Page } from "@playwright/test";

// M26-05: 初回起動ウィザードから LAN を公開する経路の警告と明示的な同意
// (DES-002 §8 / DES-005 §5.1「Step 5 の要件」「Step 7 の要件」6 / CHANGE-185)。
//
// 前提: `make e2e` / `make e2e-only` が起動する使い捨てスタックで実行される
//       (既定はバックエンド :47390 / Vite :5273。worktree ごとに決定的にオフセットされる)。
//       DB は毎回作り直す seed 済みの使い捨て DB であり、dev DB・dev サーバには影響しない。
//       ⇒ dev 側の状態(既存データ件数・開発者が最後に選んだ既定キャラ等)を仮定しないこと。
//
// ★★なぜ単体テストだけで閉じないか —— 実害は部品ではなく*通り道*に在った。
//   Step 5 で LAN を有効にし、Step 7 で「あとにする」と進むと、リスクを一度も
//   告げられないまま LAN 公開が完了していた(M26-04 の A6 実査)。
//   ⇒ ウィザードを 1 段目から通す経路そのものを固定する。
//
// ★★ 本 spec は共有バックエンドの状態を書き換えない ★★
//   完了ボタンは PUT /api/config で `server.mode: "lan"` を使い捨てスタックの
//   設定ファイルへ*永続化する*。
//
//   ★★危険の正体は並列ではない —— playwright.config.ts は `workers: 1` を固定して
//   おり(「外さないこと」と明記されている)、spec ファイル同士は並列に走らない。
//   ⇒ それでも書き換えてはならない理由は、**使い捨てスタックの設定ファイルが 1 個
//   しかなく、書き換えが走った時点から後続の全 spec が別モードの設定を読む**ことに
//   ある。直列であることは何も守らない。復元し忘れれば同じであり、復元しても
//   その間に走った spec は戻らない(D-466 / E-142)。
//   ★m22-06 が同じ `server.mode` について同じ対処を採っている。
//
//   ⇒ PUT だけをブラウザコンテキスト単位で捕まえ、送信ボディを検証して返す。
//   ★書き換えないので復元も要らない。
//
// ★照合パターンは「オリジン直下の /api/」に限る。`**/api/**` のような緩い glob は
//   Vite が配るソースモジュールのパスにも当たる(M22-01 で実測)。
const API_ORIGIN_RE = /^https?:\/\/[^/]+\/api\//;

// ウィザードは初期化済みでも開ける。App.tsx は「未初期化なら /wizard へ送る」だけで、
// 初期化済みを /wizard から追い出す逆ガードを持たない。
const WIZARD_PATH = "/wizard";

const WARNING = "wizard-lan-warning";
// ★同意まわりは testid で指す。「同意して次へ」は役割名でも取れるが、設定画面側の
//   `lan-consent-enable` / `lan-consent-check` と対称にしてある —— 2 か所の守りを
//   突き合わせる担当が、同じ形で両方を指せるようにするため。
//   ★あわせて、文言を直す手番が来ても本 spec は赤くならない(文言の検査は段 1 の
//   警告本文が引き受けている)。
const CONSENT_CHECK = "wizard-lan-consent-check";
const CONSENT_NEXT = "wizard-lan-consent-next";
const SKIP_PASSWORD = "auth-set-password-skip";

/**
 * 完了時の PUT /api/config を捕まえて、サーバへ届かせずに送信ボディだけ返す。
 *
 * GET は素通しする(ウィザードは実物の設定を読んで段を組み立てる)。
 * 応答は route を張る前に取った実応答から組み立てるので、DTO の形は実物に追随する。
 */
async function captureConfigWrites(page: Page): Promise<Array<Record<string, unknown>>> {
  const baseline = await (await page.request.get("/api/config")).json();
  const writes: Array<Record<string, unknown>> = [];

  await page.route(API_ORIGIN_RE, async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;

    if (request.method() !== "PUT" || path !== "/api/config") {
      await route.continue();
      return;
    }

    writes.push(request.postDataJSON() as Record<string, unknown>);
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ...baseline, restartRequired: true }),
    });
  });

  return writes;
}

/** Step 1 からキャラ・プリセットの段を通して Step 5(ネットワーク設定)まで進む。 */
async function advanceToNetworkStep(page: Page): Promise<void> {
  await page.goto(WIZARD_PATH);
  await expect(page.getByRole("heading", { name: "ようこそ" })).toBeVisible();

  await page.getByRole("button", { name: "次へ" }).click(); // 1 → 2
  await expect(page.getByRole("heading", { name: "言語選択" })).toBeVisible();

  await page.getByRole("button", { name: "次へ" }).click(); // 2 → 3
  await expect(page.getByRole("heading", { name: "デフォルトキャラクター" })).toBeVisible();

  await page.getByRole("button", { name: "次へ" }).click(); // 3 → 4
  await expect(page.getByRole("heading", { name: "デフォルトプリセット" })).toBeVisible();

  await page.getByRole("button", { name: "次へ" }).click(); // 4 → 5
  await expect(page.getByRole("heading", { name: "ネットワーク設定" })).toBeVisible();
}

test.describe("M26-05 ウィザードの LAN 公開に警告と同意", () => {
  test("LAN を有効にすると警告が出て、同意するまで完了まで通れない", async ({ page }) => {
    const writes = await captureConfigWrites(page);
    await advanceToNetworkStep(page);

    // ── 段 1: 警告 ──────────────────────────────────────────────────────
    // ★選ぶ前には出ていない(初期値は無効)。
    await expect(page.getByTestId(WARNING)).toHaveCount(0);

    await page.getByRole("button", { name: "LAN モードを有効にする" }).click();

    const warning = page.getByTestId(WARNING);
    await expect(warning).toBeVisible();
    // 何をされうるか(要件 1)と、届かない範囲(要件 2)の両方が出ていること。
    await expect(warning).toContainText("追加・変更・削除");
    await expect(warning).toContainText("別の回線からは開けません");

    await page.getByRole("button", { name: "次へ" }).click(); // 5 → 6
    await expect(page.getByRole("heading", { name: "LAN 接続情報" })).toBeVisible();

    await page.getByRole("button", { name: "次へ" }).click(); // 6 → 7
    await expect(page.getByRole("heading", { name: "パスワードを決める" })).toBeVisible();

    // ── 段 2: 同意 ──────────────────────────────────────────────────────
    // ★「あとにする」の導線そのものは残っている(D-396。必須化しない)。
    await page.getByTestId(SKIP_PASSWORD).click();

    const consentNext = page.getByTestId(CONSENT_NEXT);
    await expect(consentNext).toBeVisible();
    // ★要件は「チェックボックスが在る」ではなく「チェックするまで押せない」である。
    //   ⇒ 実際に押してみる。押せてしまうなら不合格(指示書 §4.1)。
    await expect(consentNext).toBeDisabled();
    await consentNext.click({ force: true });
    await expect(consentNext).toBeVisible(); // 段は進んでいない
    await expect(page.getByRole("heading", { name: "設定完了" })).toHaveCount(0);
    expect(writes).toHaveLength(0);

    await page.getByTestId(CONSENT_CHECK).click();
    await expect(consentNext).toBeEnabled();
    await consentNext.click(); // 7 → 8

    // ── 完了 ────────────────────────────────────────────────────────────
    await expect(page.getByRole("heading", { name: "設定完了" })).toBeVisible();
    await expect(page.getByText("ステップ 8 / 8")).toBeVisible();

    await page.getByRole("button", { name: "はじめる" }).click();

    // ★PC 幅では / が /combos へ送られる(App.tsx)。
    await expect(page).toHaveURL(/\/combos/);
    expect(writes).toHaveLength(1);
    expect(writes[0].server).toEqual({ mode: "lan" });
  });

  test("LAN を無効のまま進むと、警告も同意も 1 つも出ない", async ({ page }) => {
    // ★対照実験(D-375)。「同意なしでは進めない」だけでは、同意の段が誰にでも
    //   出てしまう作りでも緑になる。⇒ 公開しない人に「誰でも変更できます」と
    //   告げていないことを、同じ経路で確かめる(指示書 §4.3 / チェックリスト D-1)。
    const writes = await captureConfigWrites(page);
    await advanceToNetworkStep(page);

    await expect(page.getByTestId(WARNING)).toHaveCount(0);
    await expect(page.getByText("追加・変更・削除")).toHaveCount(0);

    await page.getByRole("button", { name: "次へ" }).click(); // 5 → 8(6 と 7 を飛ばす)

    await expect(page.getByRole("heading", { name: "設定完了" })).toBeVisible();
    await expect(page.getByText("ステップ 6 / 6")).toBeVisible();
    await expect(page.getByTestId(CONSENT_CHECK)).toHaveCount(0);
    await expect(page.getByTestId(CONSENT_NEXT)).toHaveCount(0);

    await page.getByRole("button", { name: "はじめる" }).click();

    await expect(page).toHaveURL(/\/combos/);
    expect(writes).toHaveLength(1);
    expect(writes[0].server).toEqual({ mode: "local" });
  });
});
