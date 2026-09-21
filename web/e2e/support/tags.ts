import { expect, type APIRequestContext } from "@playwright/test";

// タグの下ごしらえ(M24-02 §5.1)。
//
// ★E2E は spec を跨いで DB を 1 本共有し、playwright は fullyParallel: false でも
//   ファイル単位では並行に走る(教訓 E-232)。よって
//   「一覧の件数」「一番新しい行」では判定できない。呼び出し側が固有の判定キー(STAMP)を
//   名前へ含め、作った id を控えて後片付けする。
//
// ★spec ではないので *.spec.ts / *.test.ts 以外の名前にしてある
//   (playwright の既定 testMatch に拾われないため)。

export interface CreatedTag {
  id: number;
  name: string;
}

/** タグを 1 件作る。名前は呼び出し側が判定キーごと渡すこと。 */
export async function createTag(
  request: APIRequestContext,
  name: string,
  color = "#3B82F6",
): Promise<CreatedTag> {
  const res = await request.post("/api/tags", { data: { name, color } });
  expect(res.ok(), `タグ作成に失敗: ${res.status()} ${await res.text()}`).toBeTruthy();
  const body = (await res.json()) as { id: number };
  return { id: body.id, name };
}

/** タグをまとめて作る(渡した順に返る)。 */
export async function createTags(
  request: APIRequestContext,
  names: readonly string[],
): Promise<CreatedTag[]> {
  const created: CreatedTag[] = [];
  for (const name of names) created.push(await createTag(request, name));
  return created;
}

/**
 * 作ったタグを消す。
 * ★使用中でも消せるよう force を付ける(後片付けが本題ではないため)。
 * ★失敗しても投げない——後片付けの失敗でテストの成否を塗り替えない。
 */
export async function deleteTags(
  request: APIRequestContext,
  tags: readonly CreatedTag[],
): Promise<void> {
  for (const tag of tags) {
    await request.delete(`/api/tags/${tag.id}?force=true`).catch(() => undefined);
  }
}
