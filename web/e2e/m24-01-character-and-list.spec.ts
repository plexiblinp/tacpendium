import { test, expect, type Page } from "@playwright/test";

import { completeNewComboSave } from "./support/new-combo";
import { toggleListColumns } from "./support/column-visibility";
import { pickCharacter } from "./support/characters";
import { minimalDraftSteps } from "./support/draft-combo";
import { addMinimalRecipeStep } from "./support/editor-input";

// M24-01: 既定キャラの解決順(§4.1)・新規登録の遷移先(§4.4)・セットプレイ数の列(§4.5)。
//
// ★判定キーは本 spec 固有にする(教訓 E-232)。playwright は fullyParallel: false でも
//   ファイル単位では並行に走り、E2E は DB を 1 本共有する。afterEach の後片付けでは
//   原理的に埋められない。
// ★「行が作られていないこと」を一覧の件数で判定しない(一覧はページングされる)。

const STAMP = `m2401-${Date.now()}`;

async function characterId(page: Page, code: string): Promise<number> {
  const res = await page.request.get("/api/games/1/characters");
  expect(res.ok()).toBeTruthy();
  const items = (await res.json()).items as Array<{ id: number; code: string; nameJa: string }>;
  const found = items.find((c) => c.code === code);
  expect(found, `キャラ ${code} が seed されていない`).toBeTruthy();
  return found!.id;
}

async function characterName(page: Page, code: string): Promise<string> {
  const res = await page.request.get("/api/games/1/characters");
  const items = (await res.json()).items as Array<{ code: string; nameJa: string }>;
  return items.find((c) => c.code === code)!.nameJa;
}

test.describe("M24-01 既定キャラの追従と一覧の列", () => {
  test("A: 一覧でキャラを選ぶ → 新規登録 → 保存 → 一覧へ戻り、そのキャラが対象のまま", async ({
    page,
  }) => {
    const dhalsimId = await characterId(page, "dhalsim");
    const dhalsimName = await characterName(page, "dhalsim");
    const memo = `${STAMP}-a`;

    await page.goto("/combos");
    // ★M24-02 §4.3: キャラ選択は native select からコンボボックスへ変わった。
    await pickCharacter(page.getByTestId("combo-list-character-scope"), dhalsimName);
    await expect(page).toHaveURL(new RegExp(`character_id=${dhalsimId}`));

    await page.getByRole("link", { name: "新規登録" }).click();
    await expect(page).toHaveURL(new RegExp(`/combos/new\\?character=${dhalsimId}`));

    await page.getByTestId("combo-editor-draft-checkbox").click();
    // ★M24-13: 仮登録でもレシピのステップ 1 本以上が要る(VAL-C09)。
    await addMinimalRecipeStep(page);
    await page.getByPlaceholder("このコンボに関するメモ(任意)").fill(memo);

    const comboId = await completeNewComboSave(page, () =>
      page.getByRole("button", { name: "保存" }).click(),
    );

    try {
      // ★遷移先が一覧であることと、対象キャラが保たれていることの両方を主張する。
      await expect(page).toHaveURL(new RegExp(`/combos\\?character_id=${dhalsimId}`));
      // 主張の前に「一覧が実際に描画されたこと」を確かめる(M23-07 の型)。
      const row = page.locator("tr", { hasText: memo });
      await expect(row).toHaveCount(1);
      // ヘッダ帯の「対象キャラ」が追従している(URL だけでなく画面も追従している)。
      // ★M24-02 §4.3: native <select> からコンボボックス(button)へ変わったため、
      //   value ではなくトリガの表示名で判定する。閉じた状態でも選択中の名前は
      //   トリガ自身に出ており、hidden 扱いにはならない。
      await expect(
        page.getByTestId("combo-list-character-scope"),
        "ヘッダ帯の対象キャラが保存したキャラになっていない",
      ).toContainText(dhalsimName);
    } finally {
      await page.request.delete(`/api/combos/${comboId}`);
    }
  });

  test("B: 一覧でキャラを選ぶ → マイコンボへ遷移 → そのキャラが維持されている", async ({
    page,
  }) => {
    const kenId = await characterId(page, "ken");
    const kenName = await characterName(page, "ken");

    await page.goto("/combos");
    // ★M24-02 §4.3: キャラ選択は native select からコンボボックスへ変わった。
    await pickCharacter(page.getByTestId("combo-list-character-scope"), kenName);
    await expect(page).toHaveURL(new RegExp(`character_id=${kenId}`));

    // マイコンボが引く一覧のクエリを観測する(画面表示だけだと同名キャラで曖昧になる)。
    const comboRequests: string[] = [];
    page.on("request", (r) => {
      const u = new URL(r.url());
      if (u.pathname === "/api/combos") comboRequests.push(u.search);
    });

    await page.getByRole("link", { name: "マイコンボ" }).first().click();
    await expect(page).toHaveURL(/\/mycombo/);
    // 対象が描画されたことを先に確かめる(タブが出るまで待つ)。
    await expect(page.getByRole("tab").first()).toBeVisible();
    await expect(page.getByText(kenName).first()).toBeVisible();

    await expect
      .poll(() => comboRequests.some((q) => q.includes(`character_id=${kenId}`)), {
        message: "マイコンボが一覧の選択キャラで引いていない",
      })
      .toBe(true);

    // ★キャラ以外は持ち込まない(§4.1-7)。マイコンボ自身の status タグは正当に送られ、
    //   ソートもマイコンボが自前で常に送るため、E2E で見分けられるのは
    //   「一覧側にしか無い軸」＝仮登録トグルだけである。
    //   ★タグ・ソートまで含む否定形は MyComboPage.test.tsx が担っている
    //     (そちらは全クエリを URLSearchParams で解いて 4 軸を見る)。
    for (const q of comboRequests) {
      expect(new URLSearchParams(q).get("is_draft"), `仮登録トグルを持ち込んでいる: ${q}`).toBeNull();
    }
  });

  test("C: 一覧にセットプレイ数の列が出る(0 件と 1 件以上の両方)", async ({ page }) => {
    const ryuId = await characterId(page, "ryu");
    const memoZero = `${STAMP}-c0`;
    const memoOne = `${STAMP}-c1`;

    // fixture は API で作る(既存 spec の作法。m23-03 と同じ形)。
    const moveRes = await page.request.get(`/api/moves?character_id=${ryuId}`);
    expect(moveRes.ok()).toBeTruthy();
    const moves = (await moveRes.json()).items as Array<{ id: number; code: string }>;
    const moveId = (moves.find((m) => m.code === "standing_light_punch") ?? moves[0]).id;

    const created: number[] = [];
    const createCombo = async (memo: string) => {
      const res = await page.request.post("/api/combos", {
        // ★M24-13: 仮登録でもレシピのステップ 1 本以上が要る(VAL-C09)。
        data: {
          characterId: ryuId,
          isDraft: true,
          position: "mid_screen",
          memo,
          steps: minimalDraftSteps(),
        },
      });
      expect(res.ok(), `コンボ作成に失敗: ${res.status()} ${await res.text()}`).toBeTruthy();
      const id = (await res.json()).id as number;
      created.push(id);
      return id;
    };

    await createCombo(memoZero);
    const withSetupId = await createCombo(memoOne);
    const setupRes = await page.request.post(`/api/combos/${withSetupId}/setups`, {
      data: {
        characterId: ryuId,
        name: `${STAMP}-setup`,
        steps: [{ moveId }],
      },
    });
    expect(
      setupRes.ok(),
      `セットプレイ作成に失敗: ${setupRes.status()} ${await setupRes.text()}`,
    ).toBeTruthy();

    try {
      await page.goto(`/combos?character_id=${ryuId}`);

      // ★★M24-03 の手動確認(開発者判断 2026-08-26)で本列は既定 OFF になった。
      //   列そのものは残っており「表示列」から戻せる。
      //   ⇒ 本ケースの命題は「列が機能するか」であって「既定で出るか」ではないため、
      //     明示的に ON にしてから確かめる(既定 OFF そのものは下のケースで固定する)。
      await expect(
        page.getByRole("columnheader", { name: "セットプレイ数" }),
        "既定では出ないはず(M24-03)",
      ).toHaveCount(0);
      await toggleListColumns(page, "セットプレイ数");

      // ★列が実際に描画されたことを先に確かめてから中身を主張する。
      await expect(
        page.getByRole("columnheader", { name: "セットプレイ数" }),
      ).toHaveCount(1);

      const zeroRow = page.locator("tr", { hasText: memoZero });
      const oneRow = page.locator("tr", { hasText: memoOne });
      await expect(zeroRow).toHaveCount(1);
      await expect(oneRow).toHaveCount(1);

      await expect(zeroRow.getByTestId("combo-setup-count")).toHaveText("0");
      await expect(oneRow.getByTestId("combo-setup-count")).toHaveText("1");
    } finally {
      for (const id of created) {
        await page.request.delete(`/api/combos/${id}`);
      }
    }
  });
});
