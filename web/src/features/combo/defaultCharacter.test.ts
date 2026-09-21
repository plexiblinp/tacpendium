import { describe, expect, it } from "vitest";

import { INITIAL_CHARACTER_ID } from "@/lib/constants";
import {
  CHARACTER_FALLBACK_STAGE_ID,
  CHARACTER_RESOLUTION_STAGES,
  resolveCharacterId,
  resolveCharacterIdWithStage,
} from "./defaultCharacter";

// 実在するキャラの集合(検査を効かせたいときだけ渡す)。
const KNOWN = [1, 2, 3, 5] as const;

describe("resolveCharacterId 解決順(M24-01 §4.1-2)", () => {
  it("段 1: URL のクエリが最優先", () => {
    const r = resolveCharacterIdWithStage({
      urlCharacterId: 5,
      sessionCharacterId: 3,
      configCharacterId: 2,
      knownCharacterIds: KNOWN,
    });
    expect(r).toEqual({ characterId: 5, stageId: "1-url" });
  });

  it("段 2: URL が無ければ同一セッションで最後に選んだキャラ", () => {
    const r = resolveCharacterIdWithStage({
      urlCharacterId: null,
      sessionCharacterId: 3,
      configCharacterId: 2,
      knownCharacterIds: KNOWN,
    });
    expect(r).toEqual({ characterId: 3, stageId: "2-session" });
  });

  it("段 3b: URL もセッションも無ければ config.toml の既定", () => {
    const r = resolveCharacterIdWithStage({
      urlCharacterId: null,
      sessionCharacterId: null,
      configCharacterId: 2,
      knownCharacterIds: KNOWN,
    });
    expect(r).toEqual({ characterId: 2, stageId: "3b-config" });
  });

  it("段 4: どの段も値を出せなければフォールバック定数", () => {
    const r = resolveCharacterIdWithStage({ knownCharacterIds: KNOWN });
    expect(r).toEqual({
      characterId: INITIAL_CHARACTER_ID,
      stageId: CHARACTER_FALLBACK_STAGE_ID,
    });
  });
});

describe("resolveCharacterId 段の飛ばし方", () => {
  it("段 3 が実在しないキャラを指すときは段 4 へ落ちる(§4.1-2a)", () => {
    const r = resolveCharacterIdWithStage({
      configCharacterId: 99,
      knownCharacterIds: KNOWN,
    });
    expect(r).toEqual({
      characterId: INITIAL_CHARACTER_ID,
      stageId: CHARACTER_FALLBACK_STAGE_ID,
    });
  });

  it("キャラ一覧が未取得のあいだは実在検査をスキップして段 3 を採る", () => {
    // 検査できないことを「不在」と読まない(取得前に段 4 へ落ちて表示が飛ぶのを避ける)。
    expect(
      resolveCharacterIdWithStage({ configCharacterId: 99, knownCharacterIds: null }),
    ).toEqual({ characterId: 99, stageId: "3b-config" });
  });

  it("sessionStorage が読めない(null)ときは段 3 へ落ちる(§4.1-3)", () => {
    const r = resolveCharacterIdWithStage({
      urlCharacterId: null,
      sessionCharacterId: null, // 読取失敗・未保存・壊れた値はすべて null で来る
      configCharacterId: 2,
      knownCharacterIds: KNOWN,
    });
    expect(r).toEqual({ characterId: 2, stageId: "3b-config" });
  });

  it("段 1・段 2 には実在検査を掛けない(?character= の現行挙動を変えない)", () => {
    // ★掛けると M10-02 由来の伝播(正の整数なら採用)が変わり、既存 E2E を壊す。
    expect(
      resolveCharacterIdWithStage({ urlCharacterId: 99, knownCharacterIds: KNOWN }),
    ).toEqual({ characterId: 99, stageId: "1-url" });
    expect(
      resolveCharacterIdWithStage({ sessionCharacterId: 99, knownCharacterIds: KNOWN }),
    ).toEqual({ characterId: 99, stageId: "2-session" });
  });

  it("正の整数でない値はその段を飛ばす", () => {
    for (const bad of [0, -1, 1.5, Number.NaN]) {
      expect(
        resolveCharacterIdWithStage({ urlCharacterId: bad, configCharacterId: 2, knownCharacterIds: KNOWN }),
      ).toEqual({ characterId: 2, stageId: "3b-config" });
    }
  });
});

describe("段の列挙は 1 か所にある(§4.1-2a)", () => {
  it("段 3a(users.main_character_id)は本サブでは実装されていない", () => {
    // ★D-545: 優先度は低く、いったん未実装でよい。実装されていたら指示書違反。
    expect(CHARACTER_RESOLUTION_STAGES.map((s) => s.id)).toEqual([
      "1-url",
      "2-session",
      "3b-config",
    ]);
    // userMainCharacterId を渡しても、いまは効かない(段が居ないため)。
    expect(
      resolveCharacterId({ userMainCharacterId: 3, configCharacterId: 2, knownCharacterIds: KNOWN }),
    ).toBe(2);
  });

  it("段の列挙は配列 1 本であり、3a を 3b の前へ挟める位置がある", () => {
    // ★名乗りを実際に見ているものへ揃える(M24-01 レビュー 中-3)。
    //   ここで確かめるのは「段の列挙が 1 か所の配列であり、順序を保ったまま
    //   3a を 3b の前へ挟める」ことまでである。挟んだ結果が効くかどうかは
    //   resolveCharacterIdWithStage を通しておらず、ここでは見ていない
    //   (段を注入する口を本番コードへ作るほうが害が大きいため)。
    //   ★フック側でも材料を 1 つ増やす必要がある——「1 行」は解決関数側の話である。
    const withUserStage = [
      CHARACTER_RESOLUTION_STAGES[0],
      CHARACTER_RESOLUTION_STAGES[1],
      { id: "3a-user", pick: (s: { userMainCharacterId?: number | null }) => s.userMainCharacterId, verifyExists: true },
      CHARACTER_RESOLUTION_STAGES[2],
    ];
    expect(withUserStage.map((s) => s.id)).toEqual([
      "1-url",
      "2-session",
      "3a-user",
      "3b-config",
    ]);
    // 段の順序が「3a が 3b より前」であることが差し込みの要件。
    expect(withUserStage.findIndex((s) => s.id === "3a-user")).toBeLessThan(
      withUserStage.findIndex((s) => s.id === "3b-config"),
    );
  });
});
