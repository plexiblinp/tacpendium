import { test, expect, type Page } from "@playwright/test";
import { minimalDraftSteps } from "./support/draft-combo";

// M12-06 E-1 回帰: CHANGE-043(presence-detection 単一トライステート)後の最大回帰リスク
// =「通常編集で触っていない nullable メタデータが消える」退行のネット。
//
// 既存の E-1 相当(combo-crud.spec / combo-custom-states.spec)は situation(custom_states)1 種のみ。
// 本 spec は numeric / boolean を含む複数型をまたぐ全 nullable 項目(DES-002 §4.2)で
// 「保持」と「クリア」の両方を検証する(指示書 §4.1)。
//
// 方式(実装方式非依存・指示書 §10-2):
//   - fixture 作成 = API(全 nullable 項目を確実に設定。FE への新規 test-id 付与=スコープ逸脱を回避)。
//   - 1 項目編集 = UI(editor が GET から全項目をロードし buildPatchPayload が全キーを再送するかを実検証)。
//     既存の安定セレクタのみ使用(memo=placeholder / drive_damage=既存 testid / 保存=role)。
//   - アサート = API GET(= 指示書 §4.1「再取得」。DOM 非依存)。
//
// 前提: `make e2e` / `make e2e-only` が起動する使い捨てスタックで実行される
//      (既定はバックエンド :47390 / Vite :5273。worktree ごとに決定的にオフセットされる)。
//      DB は毎回作り直す seed 済みの使い捨て DB であり、dev DB・dev サーバには影響しない。
//      既定キャラ ryu は custom_states 電刃錬気(denjin_charge / flag。000003_data_seed_characters)を持つ。

// E-1 が検証する nullable 項目セット(DES-002 §4.2 presence-detection 全13、API で設定可能な全項目を網羅):
//   文字列: memo / situation(custom_states)
//   整数:   damage / drive_available_at_start / sa_available_at_start / knockdown_advantage
//   小数:   drive_damage
//   起き攻め: okiOptions[](M16-03 正規化。本 fixture では代表 3 オプションを設定。他 9 は未設定=温存対象)
const MEMO_PLACEHOLDER = "このコンボに関するメモ(任意)";

// 起き攻めオプション(M16-03 正規化 combo_oki_options・API 形 {attackType, techType, usesDr})。
// 本 fixture の代表 3 オプション: 投げ重ね×その場受け身 の ノーゲージ/ドライブラッシュ 両方
// + シミー×後ろ受け身。他 9 オプション(12 通りのうち残り)は未設定=温存対象。
type OkiOptionLite = { attackType: string; techType: string; usesDr: boolean };
const EXPECTED_OKI_OPTIONS: OkiOptionLite[] = [
  { attackType: "throw_meaty", techType: "neutral_tech", usesDr: false },
  { attackType: "throw_meaty", techType: "neutral_tech", usesDr: true },
  { attackType: "shimmy", techType: "back_tech", usesDr: false },
];
// okiOptions を順不同の一意キー集合へ(round-trip の集合一致比較用)。
function okiKeySet(opts: unknown): Set<string> {
  const arr = (Array.isArray(opts) ? opts : []) as OkiOptionLite[];
  return new Set(arr.map((o) => `${o.attackType}:${o.techType}:${o.usesDr}`));
}

// 全範囲内・整合(VAL-C04/C05/C10/C11/C13 をパスする)値で多項目コンボの fixture を作る。
function fixturePayload(characterId: number, memo: string) {
  return {
    characterId,
    isDraft: true,
    // ★★M24-13: 「仮登録ならレシピ無しで作成可能」は撤回された(VAL-C09 を仮登録へ
    //   適用した)。⇒ 最小のレシピを持たせる。見ているのは多項目の往復である。
    steps: minimalDraftSteps(),
    damage: 3500,
    driveAvailableAtStart: 3, // 0〜6
    saAvailableAtStart: 2, // 0〜3
    driveDamage: -2.5, // -6〜6(小数)
    knockdownAdvantage: 4,
    memo,
    situation: JSON.stringify({ custom_states: { denjin_charge: true } }),
    // 起き攻め(M16-03 正規化): 代表 3 オプションを設定(他 9 は未設定=温存対象)。
    okiOptions: EXPECTED_OKI_OPTIONS,
  };
}

async function ryuCharacterId(page: Page): Promise<number> {
  const res = await page.request.get("/api/games/1/characters");
  expect(res.ok()).toBeTruthy();
  const chars = (await res.json()).items as Array<{ id: number; code: string }>;
  const ryu = chars.find((c) => c.code === "ryu");
  if (!ryu) throw new Error("seed に ryu が見つからない(配布クリーン状態の前提崩れ)");
  return ryu.id;
}

async function createFixtureCombo(page: Page, memo: string): Promise<number> {
  const characterId = await ryuCharacterId(page);
  const res = await page.request.post("/api/combos", {
    data: fixturePayload(characterId, memo),
  });
  expect(res.ok(), `fixture 作成失敗: ${res.status()} ${await res.text()}`).toBeTruthy();
  return (await res.json()).id as number;
}

// 触っていない全項目が fixture の値で保持されていることをまとめてアサート。
function expectUntouchedFieldsRetained(combo: Record<string, unknown>) {
  expect(combo.damage).toBe(3500);
  expect(combo.driveAvailableAtStart).toBe(3);
  expect(combo.saAvailableAtStart).toBe(2);
  expect(combo.knockdownAdvantage).toBe(4);
  // 起き攻め(M16-03 正規化): okiOptions[] が fixture の 3 オプションと集合一致で round-trip。
  // 集合の厳密一致 =「設定オプションの保持」+「逆方向ガード(未設定オプションが増えない)」を同時担保。
  expect(okiKeySet(combo.okiOptions)).toEqual(okiKeySet(EXPECTED_OKI_OPTIONS));
  // situation は custom_states を round-trip 再構築するため、文字列一致ではなく値で確認。
  const cs = JSON.parse(String(combo.situation)).custom_states as Record<string, unknown>;
  expect(cs.denjin_charge).toBe(true);
}

test.describe("M12-06 presence-detection 回帰(E-1 多項目・複数型)", () => {
  // 保持検証(本体): 多項目のうち memo だけ編集 → 他の全 nullable 項目が温存される。
  test("(E-1 保持) memo のみ編集 → 他の全 nullable 項目が保持される", async ({ page }) => {
    const memo = `e2e-e1-keep-${Date.now()}`;
    const memoEdited = `${memo}-edited`;
    const id = await createFixtureCombo(page, memo);

    // editor を開く(GET で全項目をロード)→ memo だけ書換 → 保存。
    await page.goto(`/combos/${id}/edit`);
    await expect(page).toHaveURL(/\/combos\/\d+\/edit$/);
    const memoArea = page.getByPlaceholder(MEMO_PLACEHOLDER);
    await memoArea.clear();
    await memoArea.fill(memoEdited);
    await page.getByRole("button", { name: "保存" }).click();
    await expect(page).toHaveURL(/\/combos\/\d+$/);

    // 再取得: memo は更新、その他は全保持(= presence-detection が効いている)。
    const combo = await (await page.request.get(`/api/combos/${id}`)).json();
    expect(combo.memo).toBe(memoEdited);
    expectUntouchedFieldsRetained(combo);

    await page.request.delete(`/api/combos/${id}`);
  });

  // クリア検証(対): drive_damage(小数)を 1 項目だけクリア → 当該のみ NULL・他は保持。
  // 既存(situation のクリア = combo-custom-states.spec)とは異なる「数値型のクリア」を補完する。
  test("(E-1 クリア) drive_damage のみクリア → 当該のみ NULL・他項目は保持", async ({
    page,
  }) => {
    const memo = `e2e-e1-clear-${Date.now()}`;
    const id = await createFixtureCombo(page, memo);

    // editor で drive_damage 入力(既存 testid)を空に → present+null 送信でクリア。
    await page.goto(`/combos/${id}/edit`);
    await expect(page).toHaveURL(/\/combos\/\d+\/edit$/);
    await page.getByTestId("combo-editor-drive-damage").fill("");
    await page.getByRole("button", { name: "保存" }).click();
    await expect(page).toHaveURL(/\/combos\/\d+$/);

    // 再取得: drive_damage のみ NULL(omitempty で undefined)・memo と他項目は保持。
    const combo = await (await page.request.get(`/api/combos/${id}`)).json();
    expect(combo.driveDamage).toBeUndefined();
    expect(combo.memo).toBe(memo);
    expectUntouchedFieldsRetained(combo);

    await page.request.delete(`/api/combos/${id}`);
  });
});
