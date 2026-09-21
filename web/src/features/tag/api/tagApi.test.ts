import { afterEach, describe, expect, it, vi } from "vitest";

import { TagApiError, tagApi } from "./tagApi";

// ★★このリテラルは internal/api/tag/handler_test.go の
// TestDeleteTag_409_InUse_DetailKeysAreCamelCase が持つ wantBody と逐語同一である。
// 向こうは「BE が実際にこの JSON を出すこと」を、こちらは「FE がその JSON から
// 値を読めること」を主張する。⇒ 2 本で 1 組であり、片方だけ変えないこと。
//
// ★型検査は歯止めにならない —— 型と実装を同時に書き換えれば型は通る。
// ここが「キー文字列そのもの」を見る唯一の FE 側の場所である(M35-01 段 2)。
//
// ★★この literal はキーだけでなくメッセージ本文も固定している。
// ⇒ 文言を変えるときは 2 ファイルである(Go 側は golden 全体を DeepEqual するため赤くなるが、
//   こちらはキーしか見ないので緑のまま古くなる)。
const IN_USE_409_BODY = `{"error":{"code":"tag_in_use","message":"このタグは使用中です。確認の上削除してください","details":{"forceDeleteQuery":"?force=true","usageCount":3}}}`;

// 旧 snake_case（片側だけ直したときに BE から返ってくる形）。
const LEGACY_SNAKE_CASE_409_BODY = `{"error":{"code":"tag_in_use","message":"このタグは使用中です。確認の上削除してください","details":{"force_delete_query":"?force=true","usage_count":3}}}`;

function mockGlobalFetch(rawBody: string | null, status: number) {
  return vi.spyOn(globalThis, "fetch").mockResolvedValue(
    // ★204 は body を持てない(Response のコンストラクタが弾く)ため null を渡す。
    new Response(status === 204 ? null : rawBody, {
      status,
      headers: { "Content-Type": "application/json" },
    }),
  );
}

async function captureDeleteError(rawBody: string): Promise<TagApiError> {
  try {
    await tagApi.delete(1);
  } catch (e) {
    return e as TagApiError;
  }
  throw new Error(`delete が解決してしまった (body=${rawBody})`);
}

describe("tagApi.delete の 409 tag_in_use", () => {
  afterEach(() => vi.restoreAllMocks());

  it("BE が出す JSON から usageCount / forceDeleteQuery を読み取れる", async () => {
    mockGlobalFetch(IN_USE_409_BODY, 409);

    const err = await captureDeleteError(IN_USE_409_BODY);

    expect(err).toBeInstanceOf(TagApiError);
    expect(err.status).toBe(409);
    expect(err.code).toBe("tag_in_use");
    // ★これが本サブの主張。getter が実際に値を返すこと。
    expect(err.usageCount).toBe(3);
    expect(err.body?.error.details?.forceDeleteQuery).toBe("?force=true");
  });

  it("★旧 snake_case の body では usageCount を読み取れない(片側だけ直した形の検出)", async () => {
    mockGlobalFetch(LEGACY_SNAKE_CASE_409_BODY, 409);

    const err = await captureDeleteError(LEGACY_SNAKE_CASE_409_BODY);

    // ★このテストが固有に捉えるのは「getter が旧キーも読む形」である
    // (両対応にすると、BE が旧キーへ戻っても FE が気づかなくなる)。
    // ⇒ 「BE だけ直して FE を直し忘れた状態」を捉えるのは 1 本目のほうである。
    expect(err.usageCount).toBeUndefined();
    expect(err.body?.error.details?.forceDeleteQuery).toBeUndefined();
  });

  it("force=true のときはクエリを付けて 204 で解決する(対照)", async () => {
    const spy = mockGlobalFetch(null, 204);

    await expect(tagApi.delete(1, true)).resolves.toBeUndefined();
    expect(spy).toHaveBeenCalledWith(
      "/api/tags/1?force=true",
      expect.objectContaining({ method: "DELETE" }),
    );
  });
});
