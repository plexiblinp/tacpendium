import { test, expect } from "@playwright/test";

import {
  anyMoveId,
  initConfig,
  seedCandidateFixture,
  seedNoCandidateFixture,
  setupCountOf,
} from "./support/setup-link";

// M24-05: セットプレイ導線・紐付け UI 統合(CO-002 / SM-011 / SM-088)。
//
// ★★指示書 §5.1 の 3 ケース:
//   (1) コンボ詳細に「既存から紐付け」が無いこと
//   (2) 候補表示から紐付けられること
//   (3) SM-088 の成立(実測した経路で名前が自動で入ること)
// ★★KA はテストごとに変える。E2E の使い捨て DB は 1 回の実行の中で spec をまたいで
//   共有され、候補の母集団は「同一キャラ ＋ 同一 KA」で決まる。同じ KA を使い回すと
//   他テストのセットプレイが候補に混ざり、「候補 0 件」も「候補 1 件」も成り立たない。
//   ★40 は m19-01 が使っているので避ける。
const KA = {
  removal: 41,
  emptyCandidates: 42,
  link: 43,
  autoName: 44,
  copy: 45,
  copySave: 46,
  copyDup: 47,
} as const;

test.describe("M24-05 セットプレイ導線・紐付け UI", () => {
  test.beforeEach(async ({ page }) => {
    await initConfig(page);
  });

  // (1) 撤去の確認。
  //
  // ★★可視性を要求するマッチャを使う(M24-12 の教訓)。toHaveCount / toHaveAttribute は
  //   隠れた要素にも通るため、それだけでは「消えた」ことの証拠にならない。
  // ★★さらに「面が描かれていること」を先に立てる——ページが真っ白でも
  //   「ボタンが 0 件」は成立してしまい、空振りのまま緑になる。
  test("(1) コンボ詳細に「既存から紐付け」が無い", async ({ page }) => {
    const f = await seedCandidateFixture(page, "e2e-m24-05-a", KA.removal);
    await page.goto(`/combos/${f.targetComboId}`);

    // 先に面の描画を立てる(候補セクションは 0 件でも出る=§4.1)。
    await expect(page.getByTestId("setup-candidates")).toBeVisible();
    // 撤去したボタンは可視要素として 1 つも無い。
    await expect(
      page.getByRole("button", { name: "既存から紐付け", exact: true }),
    ).toHaveCount(0);
    await expect(page.getByText("既存から紐付け", { exact: true })).toHaveCount(0);
    // 残す側は生きている。
    await expect(page.getByText("セットプレイ追加", { exact: true })).toBeVisible();
  });

  // ★候補 0 件でもセクションが出て「候補はありません」が読めること(§4.1)。
  test("(1b) 候補 0 件でもセクションが出て「候補はありません」が読める", async ({ page }) => {
    // ★この KA を持つコンボはこの 1 本だけ ⇒ 候補の母集団が空になる。
    const f = await seedNoCandidateFixture(page, "e2e-m24-05-b", KA.emptyCandidates);
    await page.goto(`/combos/${f.comboId}`);

    await expect(page.getByTestId("setup-candidates")).toBeVisible();
    await expect(page.getByTestId("setup-candidates-empty")).toBeVisible();
    await expect(page.getByTestId("setup-candidates-empty")).toHaveText("候補はありません");
  });

  // (2) 候補表示から紐付けられること。
  test("(2) 候補表示から紐付けられる", async ({ page }) => {
    const f = await seedCandidateFixture(page, "e2e-m24-05-c", KA.link);
    await page.goto(`/combos/${f.targetComboId}`);

    const section = page.getByTestId("setup-candidates");
    await expect(section).toBeVisible();
    await expect(section.getByText(f.setupName)).toBeVisible();

    // ★★first() で押さない。候補が 1 件である保証は無く(KA を分けていても将来
    //   増えうる)、取り違えると「別のセットプレイが紐付いた」ことに気づけない。
    //   ⇒ 目的のセットプレイの行を名前で特定してから押す。
    await section
      .locator("li")
      .filter({ hasText: f.setupName })
      .getByRole("button", { name: "このコンボにも紐付ける" })
      .click();

    // 紐付いたことを API で確かめる(表示だけでなく永続化を見る)。
    await expect
      .poll(async () => {
        const res = await page.request.get(`/api/combos/${f.targetComboId}`);
        const combo = await res.json();
        return (combo.setups ?? []).map((s: { id: number }) => s.id);
      })
      .toContain(f.setupId);

    // 紐付いた以上、同じセットプレイはもう候補ではない(母集団の条件が効いている)。
    await expect(section.getByText(f.setupName)).toHaveCount(0);
  });

  // (3) SM-088: 自動提案の採用で名前が自動で入る。
  //
  // ★★これは本サブが実装した機能ではない。既に成立していることを固定するケースである
  //   (開発者の実機確認 D-588)。実測した規則は `{技名} 持続{n}F目重ね`。
  test("(3) 自動提案の採用でセットプレイ名が自動で入る(SM-088)", async ({ page }) => {
    const f = await seedCandidateFixture(page, "e2e-m24-05-d", KA.autoName);
    await page.goto(`/combos/${f.targetComboId}`);

    await expect(page.getByTestId("setplay-section")).toBeVisible();
    await page.getByTestId("setplay-generate").click();
    await expect(page.getByTestId("setplay-row").first()).toBeVisible();

    await page.getByTestId("setplay-adopt").first().click();

    // ★利用者が 1 文字も打っていない時点で名前が入っている(＝「入力をサボれる」)。
    const nameInput = page.getByLabel("セットプレイ名");
    await expect(nameInput).toBeVisible();
    // 実測した書式を固定する。★設計卓の暫定案(「打撃重ね・弱P」)ではない。
    await expect(nameInput).toHaveValue(/^.+ 持続\d+F目重ね$/);
  });

  // SM-011: セットプレイ編集のコピー。
  test("(4) セットプレイ編集のコピーで内容が投入される(SM-011)", async ({ page }) => {
    const f = await seedCandidateFixture(page, "e2e-m24-05-e", KA.copy);
    await page.goto(`/setups/${f.setupId}`);

    const copy = page.getByTestId("setup-editor-copy");
    await expect(copy).toBeVisible();
    await copy.click();

    // 新規登録モードへ入り、コピー元が題名に出る。
    await expect(page).toHaveURL(new RegExp(`/combos/\\d+/setups/new\\?copyFrom=${f.setupId}$`));
    await expect(
      page.getByText(`セットプレイ登録（コピー元: #${f.setupId}）`),
    ).toBeVisible();
    // 名前が投入されている(空の新規登録ではない)。
    // ★getByLabel は使えない——SetupBasicInfoForm の <Label> は htmlFor を持たず
    //   input を包んでもいないため、ラベルと入力欄が関連付いていない。
    //   ⇒ placeholder で掴む(この面で一意である)。
    await expect(page.getByPlaceholder("セットプレイ名")).toHaveValue(f.setupName);
  });

  // ★★コピーして保存できるところまで運ぶ(SM-011 の機能要件＝指示書 §7.1-6)。
  //
  // ★★保存の前にレシピを 1 手足している。足さないと VAL-S04 で弾かれる——
  //   コピー先の親はコピー元の先頭の親であり、そこには同一レシピのセットプレイが
  //   既に紐付いているためである(VAL-S04 は名前を見ない)。
  //   ⇒ これは欠陥ではなく仕様どおりの挙動である。memo の逐語も
  //     「途中までレシピが同じ場合がある」であり、利用者はコピー後に手を入れる。
  test("(5) コピー先でレシピを足して保存すると別のセットプレイとして増える(SM-011)", async ({
    page,
  }) => {
    const f = await seedCandidateFixture(page, "e2e-m24-05-f", KA.copySave);
    const before = await setupCountOf(page, f.sourceComboId);
    expect(before).toBe(1);

    await page.goto(`/setups/${f.setupId}`);
    await page.getByTestId("setup-editor-copy").click();
    await expect(page.getByPlaceholder("セットプレイ名")).toHaveValue(f.setupName);

    // 名前を変え、レシピを 1 手足す(＝コピー元とは別のレシピにする)。
    const newName = `${f.setupName}-copied`;
    await page.getByPlaceholder("セットプレイ名").fill(newName);
    const moveId = await anyMoveId(page, f.characterId);
    await page.getByTestId("recipe-pulldown-toggle").click();
    await page.getByTestId("recipe-move-select").selectOption(String(moveId));
    await page.getByTestId("recipe-add-step").click();

    await page.getByRole("button", { name: "保存", exact: true }).click();

    // 保存後は親コンボの詳細へ戻る。★2 本になっている。
    await expect(page).toHaveURL(new RegExp(`/combos/${f.sourceComboId}$`));
    await expect
      .poll(async () => setupCountOf(page, f.sourceComboId))
      .toBe(before + 1);

    // ★コピー元は消えていない(コピーであって移動ではない)。
    const res = await page.request.get(`/api/combos/${f.sourceComboId}`);
    const names = ((await res.json()).setups ?? []).map((x: { name: string }) => x.name);
    expect(names).toContain(f.setupName);
    expect(names).toContain(newName);
  });

  // ★対照: コピー直後にレシピを変えずそのまま保存すると VAL-S04 で止まる。
  //   ★これは仕様である。「コピーが壊れている」と読まれないよう、挙動を固定して残す。
  test("(6) 対照: コピー後にレシピを変えずに保存すると VAL-S04 で止まる", async ({ page }) => {
    const f = await seedCandidateFixture(page, "e2e-m24-05-g", KA.copyDup);

    await page.goto(`/setups/${f.setupId}`);
    await page.getByTestId("setup-editor-copy").click();
    await page.getByPlaceholder("セットプレイ名").fill(`${f.setupName}-dup`);
    await page.getByRole("button", { name: "保存", exact: true }).click();

    // 同一レシピ重複の専用表示が出る(版不一致とは別物＝M22-04 §4.2-5)。
    await expect(page.getByTestId("setup-editor-duplicate-setup")).toBeVisible();
    // 増えていない。
    expect(await setupCountOf(page, f.sourceComboId)).toBe(1);
  });

});
