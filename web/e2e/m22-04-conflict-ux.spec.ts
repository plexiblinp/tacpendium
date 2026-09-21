import { test, expect, type APIRequestContext } from "@playwright/test";

// M22-04: 競合したときの利用者体験。★見るのは「利用者が書いたものが消えないこと」である。
//
// ★M22-03 の spec は通信の層(拒否されること)を見ている。本 spec は画面の層
// (拒否されたあと利用者に何が見えるか)を見る。役割が違うため両方を残す。
//
// ★サーバの共有状態を書き換えない(D-399 (1))。本 spec が触るのは自分で作った
// コンボだけである。config・プリセット・タグには一切触れない。
//
// ★後始末は M22-03 spec と同じ制約を持つ(コンボは物理削除できる)。

const CHARACTER_ID = 1;

interface ComboJSON {
  id: number;
  version: number;
}

async function starterMoveId(request: APIRequestContext): Promise<number> {
  const res = await request.get(`/api/moves?character_id=${CHARACTER_ID}`);
  expect(res.ok(), `moves 取得失敗: ${res.status()}`).toBeTruthy();
  const moves = (await res.json()).items as Array<{ id: number; code: string }>;
  const m = moves.find((x) => x.code === "standing_light_punch") ?? moves[0];
  if (!m) throw new Error("seed に技が 1 件も無い(配布クリーン前提崩れ)");
  return m.id;
}

async function createCombo(request: APIRequestContext, memo: string): Promise<ComboJSON> {
  const moveId = await starterMoveId(request);
  const res = await request.post("/api/combos", {
    data: {
      characterId: CHARACTER_ID,
      isDraft: true,
      memo,
      steps: [{ stepOrder: 1, moveId }],
    },
  });
  expect(res.ok(), `combo 作成失敗: ${res.status()} ${await res.text()}`).toBeTruthy();
  return (await res.json()) as ComboJSON;
}

async function destroyCombo(request: APIRequestContext, id: number): Promise<void> {
  await request.delete(`/api/combos/${id}`);
  await request.delete(`/api/combos/${id}/permanent`);
}

test.describe("M22-04 競合したときの利用者体験", () => {
  // ★シナリオ A(非回帰)。「常に拒否する」実装でもシナリオ B は緑になるため、
  //   版が一致するときに通ることを別に固定する。
  test("A: 版が一致する通常の保存は、いままでどおり通る", async ({ page, request }) => {
    const combo = await createCombo(request, "m22-04 非回帰");
    try {
      await page.goto(`/combos/${combo.id}/edit`);
      const memo = page.getByTestId("combo-editor-memo");
      await expect(memo).toBeVisible({ timeout: 20000 });

      await memo.fill("非回帰の確認");
      await page.getByRole("button", { name: "保存", exact: true }).click();

      // 競合モーダルは出ない。保存はサーバまで届いている。
      await expect(page.getByTestId("conflict-dialog")).toBeHidden();
      await expect
        .poll(async () => (await (await request.get(`/api/combos/${combo.id}`)).json()).memo, {
          timeout: 10000,
        })
        .toBe("非回帰の確認");
    } finally {
      await destroyCombo(request, combo.id);
    }
  });

  test("B: 後から保存した側に「ほかの人が変更した」と出る。★入力が消えていない", async ({
    page,
    request,
  }) => {
    const combo = await createCombo(request, "m22-04 競合");
    try {
      // 文脈 A: 画面で編集画面を開く(version を握った状態)
      await page.goto(`/combos/${combo.id}/edit`);
      const memo = page.getByTestId("combo-editor-memo");
      await expect(memo).toBeVisible({ timeout: 20000 });

      // 文脈 B: 別の文脈が先に保存し、版を進める
      const first = await request.patch(`/api/combos/${combo.id}`, {
        data: { version: combo.version, memo: "B が先に保存した" },
      });
      expect(first.ok(), `先の保存が通らない: ${first.status()}`).toBeTruthy();

      // 文脈 A: 利用者が時間をかけて書いてから保存を押す
      const typed = "A が時間をかけて書いた内容";
      await memo.fill(typed);
      await page.getByRole("button", { name: "保存", exact: true }).click();

      // ★何が起きたかが伝わる(§4.3-1)
      const dialog = page.getByTestId("conflict-dialog");
      await expect(dialog).toBeVisible({ timeout: 10000 });
      await expect(dialog).toContainText("ほかの人がこのコンボを変更しました");

      // ★入力が残っていることが伝わる(§4.3-2)
      await expect(page.getByTestId("conflict-dialog-input-kept")).toBeVisible();

      // ★★実際に入力が消えていない(最重要ゲート 1)
      await expect(memo).toHaveValue(typed);

      // ★進む道が 2 つ示される(§4.3-3)
      const viewTheirs = page.getByTestId("conflict-dialog-view-theirs");
      await expect(viewTheirs).toHaveAttribute("href", `/combos/${combo.id}`);
      await expect(viewTheirs).toHaveAttribute("target", "_blank");
      await expect(page.getByTestId("conflict-dialog-reload")).toBeVisible();

      // ★読み込み直すと編集が消えることが、押す前に伝わる(§5.1-7)
      await page.getByTestId("conflict-dialog-reload").click();
      const confirm = page.getByTestId("conflict-dialog-reload-confirm");
      await expect(confirm).toBeVisible();
      await expect(confirm).toContainText("いま入力している内容は失われます");

      // ★やめれば入力は残ったまま(2 段階であることの実証)
      await page.getByTestId("conflict-dialog-reload-cancel").click();
      await expect(memo).toHaveValue(typed);

      // ★上書きの道は出していない(§4.4 案 A)
      await expect(dialog).not.toContainText("上書き");

      // ★誤上書きが起きていない —— B の保存が生きている(FR501)
      const after = await request.get(`/api/combos/${combo.id}`);
      expect((await after.json()).memo).toBe("B が先に保存した");
    } finally {
      await destroyCombo(request, combo.id);
    }
  });

  // ★§1.3.1 / §4.3-7。キー変更編集に負けた側には 409 が来ない(404 である)。
  //   409 の導線だけを作って終わっていないことを固定する。
  test("B': キー変更編集に負けた側(404)にも導線が出て、入力が消えていない", async ({
    page,
    request,
  }) => {
    const combo = await createCombo(request, "m22-04 404");
    try {
      const moveId = await starterMoveId(request);
      await page.goto(`/combos/${combo.id}/edit`);
      const memo = page.getByTestId("combo-editor-memo");
      await expect(memo).toBeVisible({ timeout: 20000 });

      // 文脈 B: キー変更編集(PUT)。旧行が論理削除され、新しい id が採番される。
      const put = await request.put(`/api/combos/${combo.id}`, {
        data: {
          characterId: CHARACTER_ID,
          isDraft: true,
          memo: "B が作り直した",
          version: combo.version,
          steps: [
            { stepOrder: 1, moveId },
            { stepOrder: 2, moveId },
          ],
        },
      });
      expect(put.ok(), `PUT が通らない: ${put.status()} ${await put.text()}`).toBeTruthy();
      const recreated = (await put.json()) as ComboJSON;

      try {
        // 文脈 A: 旧 id を握ったまま保存 → 行がもう無いので 404
        const typed = "A が時間をかけて書いた内容";
        await memo.fill(typed);
        await page.getByRole("button", { name: "保存", exact: true }).click();

        const dialog = page.getByTestId("conflict-dialog");
        await expect(dialog).toBeVisible({ timeout: 10000 });

        // ★「コンボが見つかりません」で終わっていない(§1.2-2)
        await expect(page.getByTestId("conflict-dialog-input-kept")).toBeVisible();
        await expect(memo).toHaveValue(typed);

        // ★404 を一律に「ほかの人が変更しました」と読み替えていない(§4.3-7)
        await expect(dialog).not.toContainText("ほかの人がこのコンボを変更しました");
        await expect(dialog).toContainText("作り直した");
        await expect(dialog).toContainText("削除した");

        // ★★【追補・§4.7.2】行き止まりにしない。保存する道と脱出路が出ている。
        await expect(page.getByTestId("conflict-dialog-save-as-new")).toBeVisible();
        await expect(page.getByTestId("conflict-dialog-go-to-list")).toBeVisible();
      } finally {
        await destroyCombo(request, recreated.id);
      }
    } finally {
      await destroyCombo(request, combo.id);
    }
  });

  // ★★【追補・§5.1-15】導線の「存在」ではなく「到達可能性」を見る。
  //   ボタンが在ることは v1.4.0 の行き止まりを弾けない。実際に保存が成立し、
  //   サーバに新しい行ができるところまで確かめる。
  test("B'': 404 から「この内容で新しく登録する」を通すと、書いた内容が実際に保存される", async ({
    page,
    request,
  }) => {
    const combo = await createCombo(request, "m22-04 救出");
    const createdIds: number[] = [];
    try {
      const moveId = await starterMoveId(request);
      await page.goto(`/combos/${combo.id}/edit`);
      const memo = page.getByTestId("combo-editor-memo");
      await expect(memo).toBeVisible({ timeout: 20000 });

      // 文脈 B: キー変更編集で旧行を消す
      const put = await request.put(`/api/combos/${combo.id}`, {
        data: {
          characterId: CHARACTER_ID,
          isDraft: true,
          memo: "B が作り直した",
          version: combo.version,
          steps: [
            { stepOrder: 1, moveId },
            { stepOrder: 2, moveId },
          ],
        },
      });
      expect(put.ok(), `PUT が通らない: ${put.status()}`).toBeTruthy();
      createdIds.push(((await put.json()) as ComboJSON).id);

      // 文脈 A: 時間をかけて書いてから保存 → 404
      const typed = "救出されるべき内容";
      await memo.fill(typed);
      // ★キー項目も変える。旧コンボと同じキーのままだと、B が作り直した行との
      //   重複ではなく「旧コンボの複製」になり、経路の意味が変わる。
      // ★M24-12: ポジションは select からボタン群になった(押す対象が変わっただけ)。
      await page.getByTestId("combo-editor-position-corner_self").click();
      await page.getByRole("button", { name: "保存", exact: true }).click();
      // キー変更のため再登録の確認が挟まる
      await page.getByRole("button", { name: "再登録する" }).click();

      await expect(page.getByTestId("conflict-dialog")).toBeVisible({ timeout: 10000 });

      // ★2 段階であること
      await page.getByTestId("conflict-dialog-save-as-new").click();
      const confirm = page.getByTestId("conflict-dialog-save-as-new-confirm");
      await expect(confirm).toBeVisible();

      await page.getByTestId("conflict-dialog-save-as-new-execute").click();

      // ★★保存が成立し、新しいコンボへ移ること(「閉じただけ」で終わらない)
      await page.waitForURL(/\/combos\/\d+$/, { timeout: 15000 });
      const newId = Number(page.url().split("/").pop());
      expect(Number.isFinite(newId)).toBeTruthy();
      createdIds.push(newId);

      // ★★サーバ側に、利用者が書いた内容がそのまま入っていること
      const saved = await request.get(`/api/combos/${newId}`);
      expect(saved.ok(), `新しいコンボが取れない: ${saved.status()}`).toBeTruthy();
      const savedBody = (await saved.json()) as { id: number; memo?: string };
      expect(savedBody.memo).toBe(typed);
      expect(savedBody.id).not.toBe(combo.id);
    } finally {
      for (const id of createdIds) await destroyCombo(request, id);
      await destroyCombo(request, combo.id);
    }
  });
});
