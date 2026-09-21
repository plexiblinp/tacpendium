import { expect, type Page } from "@playwright/test";

import { minimalDraftSteps } from "./draft-combo";

/**
 * M24-05 の下ごしらえ。★共通の準備は support/ へ寄せる(D-553)。
 *
 * 「転用可能なセットプレイ候補」は 同一キャラ ＋ 同一 knockdown_advantage ＋
 * 当該コンボ未紐付け で絞られる。⇒ 候補を出すには「同じキャラ・同じ KA の
 * 別コンボに紐付いたセットプレイ」が要る。ここではその形を 1 本で作る。
 */

/** seed の ryu の character_id を引く。 */
export async function ryuCharacterId(page: Page): Promise<number> {
  const res = await page.request.get("/api/games/1/characters");
  expect(res.ok()).toBeTruthy();
  const chars = (await res.json()).items as Array<{ id: number; code: string }>;
  const ryu = chars.find((c) => c.code === "ryu");
  if (!ryu) throw new Error("seed に ryu が見つからない(配布クリーン前提崩れ)");
  return ryu.id;
}

/** 仮登録のコンボを 1 本作る。★M24-13 以降はレシピのステップが 1 本以上要る。 */
export async function createCombo(
  page: Page,
  characterId: number,
  ka: number | null,
  memo: string,
): Promise<number> {
  const data: Record<string, unknown> = {
    characterId,
    isDraft: true,
    memo,
    steps: minimalDraftSteps(),
  };
  if (ka != null) data.knockdownAdvantage = ka;
  const res = await page.request.post("/api/combos", { data });
  expect(res.ok(), `combo 作成失敗: ${res.status()} ${await res.text()}`).toBeTruthy();
  return (await res.json()).id as number;
}

/**
 * 親コンボへセットプレイを 1 本作る。
 *
 * ★VAL-S05: セットプレイは親コンボに紐付く形でしか作れない。
 * ★VAL-S06: 名前は必須(空では作れない)。
 * ★steps は非技ステップ 1 本で足りる——VAL-S03(技の存在確認)を踏まないため、
 *   fixture へ警告が増えない(draft-combo と同じ理由)。
 */
export async function createSetup(
  page: Page,
  comboId: number,
  characterId: number,
  name: string,
): Promise<number> {
  const res = await page.request.post(`/api/combos/${comboId}/setups`, {
    data: {
      characterId,
      name,
      steps: [{ stepOrder: 1, modifiers: { type: "parry_drive_rush" } }],
    },
  });
  expect(res.ok(), `setup 作成失敗: ${res.status()} ${await res.text()}`).toBeTruthy();
  return (await res.json()).id as number;
}

/**
 * 「候補が出る状態」を 1 本で作る。
 *
 * 同じキャラ・同じ KA のコンボを 2 本作り、片方(source)にだけセットプレイを付ける。
 * ⇒ もう片方(target)の詳細画面で、そのセットプレイが候補として出る。
 *
 * ★★`ka` はテストごとに変えること。E2E の使い捨て DB は 1 回の実行の中では
 *   spec をまたいで共有される。候補の母集団は「同一キャラ ＋ 同一 KA」で決まるため、
 *   同じ KA を使い回すと他のテストが作ったセットプレイまで候補に出てくる。
 *   ⇒ 「候補は 1 件だけ」「候補は 0 件」といった前提が壊れる(実際に壊れた)。
 */
export async function seedCandidateFixture(
  page: Page,
  tag: string,
  ka = 40,
): Promise<{ characterId: number; sourceComboId: number; targetComboId: number; setupId: number; setupName: string }> {
  const characterId = await ryuCharacterId(page);
  const sourceComboId = await createCombo(page, characterId, ka, `${tag}-src-${Date.now()}`);
  const targetComboId = await createCombo(page, characterId, ka, `${tag}-dst-${Date.now()}`);
  const setupName = `${tag}-setup-${Date.now()}`;
  const setupId = await createSetup(page, sourceComboId, characterId, setupName);
  return { characterId, sourceComboId, targetComboId, setupId, setupName };
}

/** E2E 使い捨て DB は config.toml 未作成=未初期化のため、ウィザード相当で初期化する。 */
export async function initConfig(page: Page): Promise<void> {
  const res = await page.request.put("/api/config", { data: {} });
  expect(res.ok(), `config 初期化失敗: ${res.status()} ${await res.text()}`).toBeTruthy();
}

/**
 * 「候補が 0 件になる状態」を作る。
 *
 * その KA を持つコンボがこの 1 本しか無ければ、候補の母集団は空になる
 * (候補は「他コンボに紐付いたセットプレイ」であるため)。
 * ★KA は他のテストと重ならない値を渡すこと。
 */
export async function seedNoCandidateFixture(
  page: Page,
  tag: string,
  ka: number,
): Promise<{ characterId: number; comboId: number }> {
  const characterId = await ryuCharacterId(page);
  const comboId = await createCombo(page, characterId, ka, `${tag}-solo-${Date.now()}`);
  return { characterId, comboId };
}

/** 適当な 1 技の id を返す(レシピへ 1 手足すためだけに使う)。 */
export async function anyMoveId(page: Page, characterId: number): Promise<number> {
  const res = await page.request.get(`/api/moves?character_id=${characterId}`);
  expect(res.ok()).toBeTruthy();
  const moves = (await res.json()).items as Array<{ id: number; code: string }>;
  const m = moves.find((x) => x.code === "standing_light_punch") ?? moves[0];
  if (!m) throw new Error("seed に技が 1 件も無い(配布クリーン前提崩れ)");
  return m.id;
}

/** 親コンボに紐付いているセットプレイの件数。 */
export async function setupCountOf(page: Page, comboId: number): Promise<number> {
  const res = await page.request.get(`/api/combos/${comboId}`);
  expect(res.ok()).toBeTruthy();
  return ((await res.json()).setups ?? []).length;
}
