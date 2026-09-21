import { describe, expect, it } from "vitest";

import {
  abortCalibration,
  assignedTargets,
  calibrationProgress,
  cancelConflict,
  confirmOverwrite,
  currentTarget,
  isFinished,
  recordBinding,
  skipCurrent,
  startCalibration,
  startPartialCalibration,
  startRetake,
} from "./calibration";
import { createStandardProfile } from "./defaultProfile";
import { CALIBRATION_ORDER, OPTIONAL_TARGETS } from "./logicalButtons";
import { bindingOf, createEmptyProfile } from "./profile";
import type { GamepadProfile } from "./types";

const PAD_ID = "Test Controller";

function emptyProfile(): GamepadProfile {
  return createEmptyProfile("chromium", PAD_ID);
}

/** 案内順のとおりに n 件を連続で登録する（物理 index は 0,1,2,... と別々にする）。 */
function recordSequential(profile: GamepadProfile, count: number) {
  let state = startCalibration(profile, true);
  for (let i = 0; i < count; i += 1) {
    state = recordBinding(state, { kind: "button", index: i });
  }
  return state;
}

describe("キャリブレーションの進行", () => {
  it("案内順の先頭は方向から始まる", () => {
    const state = startCalibration(emptyProfile(), true);

    expect(currentTarget(state)).toBe("up");
  });

  it("押された物理入力を現在の対象へ記録して次へ進む", () => {
    let state = startCalibration(emptyProfile(), true);
    state = recordBinding(state, { kind: "button", index: 12 });

    expect(bindingOf(state.profile, "up")).toEqual({
      kind: "button",
      index: 12,
    });
    expect(currentTarget(state)).toBe("down");
  });

  it("方向が axes で来ても記録できる", () => {
    // 指示書 §4.3-5: buttons と axes のどちらで来ても記録できること。
    let state = startCalibration(emptyProfile(), true);
    state = recordBinding(state, {
      kind: "axis",
      index: 2,
      sign: -1,
      threshold: 0.5,
    });

    expect(bindingOf(state.profile, "up")).toEqual({
      kind: "axis",
      index: 2,
      sign: -1,
      threshold: 0.5,
    });
  });

  it("飛ばした対象は未割当のまま次へ進む", () => {
    let state = startCalibration(emptyProfile(), true);
    state = skipCurrent(state);

    expect(bindingOf(state.profile, "up")).toBeUndefined();
    expect(currentTarget(state)).toBe("down");
  });
});

describe("(g) 中断と再開", () => {
  it("(g) 中断した状態から再開できる", () => {
    // 3 件だけ登録して中断する。
    const partial = abortCalibration(recordSequential(emptyProfile(), 3));

    expect(assignedTargets(partial)).toEqual(["up", "down", "left"]);

    // 中断した内容を持ったまま再開すると、未割当の最初（right）から始まる。
    const resumed = startCalibration(partial, true);

    expect(currentTarget(resumed)).toBe("right");
    // 既に登録した内容は失われない。
    expect(bindingOf(resumed.profile, "up")).toEqual({
      kind: "button",
      index: 0,
    });
  });

  it("中断しても全部を埋めない限り使えない、という形になっていない", () => {
    const partial = abortCalibration(recordSequential(emptyProfile(), 2));

    // 部分的なプロファイルがそのまま返る（保存して使える）。
    expect(Object.keys(partial.directions)).toHaveLength(2);
  });

  it("resume=false なら先頭から取り直す", () => {
    const partial = abortCalibration(recordSequential(emptyProfile(), 3));
    const restarted = startCalibration(partial, false);

    expect(currentTarget(restarted)).toBe("up");
  });
});

describe("(h) 1 つだけ取り直す", () => {
  it("(h) 1 つだけ取り直せる", () => {
    const base = abortCalibration(recordSequential(emptyProfile(), 4));

    let retake = startRetake(base, "left");
    expect(currentTarget(retake)).toBe("left");
    expect(retake.mode).toBe("single");

    retake = recordBinding(retake, { kind: "button", index: 99 });

    // 取り直した対象だけが変わる。
    expect(bindingOf(retake.profile, "left")).toEqual({
      kind: "button",
      index: 99,
    });
    // 他は保たれる。
    expect(bindingOf(retake.profile, "up")).toEqual({
      kind: "button",
      index: 0,
    });
    // ★取り直しの対象は 1 件だけ（他の割当を巻き込まない）。
    // 完了するかどうかは「未設定が残っているか」で決まる——下の
    // 「取り直したあとの再開」を参照。
    expect(retake.lastRetaken).toBe("left");
  });
});

describe("(i) 同じ物理ボタンの二重割当", () => {
  it("(i) 二重割当を検出し、書き込まずに警告状態へ入る", () => {
    // up = button 0 を登録したあと、down にも button 0 を割り当てようとする。
    let state = startCalibration(emptyProfile(), true);
    state = recordBinding(state, { kind: "button", index: 0 }); // up
    state = recordBinding(state, { kind: "button", index: 0 }); // down（衝突）

    expect(state.conflict).toEqual({
      target: "down",
      existing: "up",
      binding: { kind: "button", index: 0 },
    });
    // ★黙って上書きしない。まだ書き込まれていない。
    expect(bindingOf(state.profile, "down")).toBeUndefined();
    // 対象も進んでいない。
    expect(currentTarget(state)).toBe("down");
  });

  it("(i') 上書きを承認すると、既存側の割当が外れて新しい側へ移る", () => {
    let state = startCalibration(emptyProfile(), true);
    state = recordBinding(state, { kind: "button", index: 0 });
    state = recordBinding(state, { kind: "button", index: 0 });
    state = confirmOverwrite(state);

    expect(bindingOf(state.profile, "down")).toEqual({
      kind: "button",
      index: 0,
    });
    // 同じ物理ボタンが 2 つの論理ボタンを同時に押す状態を作らない。
    expect(bindingOf(state.profile, "up")).toBeUndefined();
    expect(state.conflict).toBeNull();
    expect(currentTarget(state)).toBe("left");
  });

  it("(i'') 取り消すと何も変わらず同じ対象の入力待ちに戻る", () => {
    let state = startCalibration(emptyProfile(), true);
    state = recordBinding(state, { kind: "button", index: 0 });
    state = recordBinding(state, { kind: "button", index: 0 });
    state = cancelConflict(state);

    expect(state.conflict).toBeNull();
    expect(bindingOf(state.profile, "up")).toEqual({
      kind: "button",
      index: 0,
    });
    expect(bindingOf(state.profile, "down")).toBeUndefined();
    expect(currentTarget(state)).toBe("down");
  });

  it("(i''') 衝突が未解決の間は新しい入力を受け付けない", () => {
    let state = startCalibration(emptyProfile(), true);
    state = recordBinding(state, { kind: "button", index: 0 });
    state = recordBinding(state, { kind: "button", index: 0 });
    const held = state;
    state = recordBinding(state, { kind: "button", index: 5 });

    expect(state).toEqual(held);
  });

  it("同じ対象へ同じ入力を割り当て直すのは衝突ではない", () => {
    const base = abortCalibration(recordSequential(emptyProfile(), 1));
    let retake = startRetake(base, "up");
    retake = recordBinding(retake, { kind: "button", index: 0 });

    expect(retake.conflict).toBeNull();
    expect(bindingOf(retake.profile, "up")).toEqual({
      kind: "button",
      index: 0,
    });
  });
});

describe("進捗", () => {
  it("必須の残り件数を出す", () => {
    const state = recordSequential(emptyProfile(), 4); // 方向 4 件のみ
    const progress = calibrationProgress(state);

    // 必須は方向 4 + 攻撃 6 = 10。方向 4 が済んで残り 6。
    expect(progress.requiredRemaining).toBe(6);
    expect(progress.complete).toBe(false);
  });
});

describe("部分キャリブレーション（標準配置の既定へ任意区間だけ足す）", () => {
  it("渡した対象だけを順に案内する", () => {
    const base = createStandardProfile("chromium", PAD_ID);
    let state = startPartialCalibration(base, OPTIONAL_TARGETS);

    expect(state.mode).toBe("partial");
    // ★M21-04 で任意区間はマクロ 3 ＋ ショートカット前置き 1 の 4 件になった。
    expect(state.order).toHaveLength(4);
    expect(currentTarget(state)).toBe("drive_impact");

    state = recordBinding(state, { kind: "button", index: 4 });
    expect(currentTarget(state)).toBe("drive_parry");
  });

  it("既定で埋まっている必須区間を壊さない", () => {
    const base = createStandardProfile("chromium", PAD_ID);
    let state = startPartialCalibration(base, OPTIONAL_TARGETS);
    state = recordBinding(state, { kind: "button", index: 4 });

    // 攻撃・方向はそのまま残る。
    expect(bindingOf(state.profile, "light_punch")).toEqual({
      kind: "button",
      index: 2,
    });
    expect(bindingOf(state.profile, "up")).toEqual({ kind: "button", index: 12 });
    expect(bindingOf(state.profile, "drive_impact")).toEqual({
      kind: "button",
      index: 4,
    });
  });

  it("任意区間をすべて終えると完了し、mode は partial のまま", () => {
    const base = createStandardProfile("chromium", PAD_ID);
    let state = startPartialCalibration(base, OPTIONAL_TARGETS);
    state = recordBinding(state, { kind: "button", index: 4 });
    state = recordBinding(state, { kind: "button", index: 6 });
    state = recordBinding(state, { kind: "button", index: 9 });
    // ★M21-04 で加わったショートカット前置き（4 件目）。
    state = recordBinding(state, { kind: "button", index: 10 });

    expect(isFinished(state)).toBe(true);
    // ★完了文言を出し分けるために mode を保つ（1 件取り直しただけで
    //   「すべての案内が終わりました」と出るのが不自然だったため）。
    expect(state.mode).toBe("partial");
  });

  it("既定のボタンと同じ物理ボタンを割り当てようとすれば衝突として検出する", () => {
    const base = createStandardProfile("chromium", PAD_ID);
    let state = startPartialCalibration(base, OPTIONAL_TARGETS);
    // index 2 は既定で弱パンチに当たっている。
    state = recordBinding(state, { kind: "button", index: 2 });

    expect(state.conflict?.existing).toBe("light_punch");
    expect(bindingOf(state.profile, "drive_impact")).toBeUndefined();
  });
});

describe("完了時の mode（文言の出し分けに使う）", () => {
  it("すべて設定済みなら 1 件取り直しても single のまま完了する", () => {
    // ★標準配置の既定はマクロ 3 件が未設定であるため、それだけでは完了しない
    //   （未設定が残っていれば案内へ戻るのが正しい挙動）。全件を埋めてから確かめる。
    let filled = startCalibration(createStandardProfile("chromium", PAD_ID), true);
    for (const [i] of OPTIONAL_TARGETS.entries()) {
      filled = recordBinding(filled, { kind: "button", index: 20 + i });
    }

    let state = startRetake(abortCalibration(filled), "light_punch");
    state = recordBinding(state, { kind: "button", index: 11 });

    expect(isFinished(state)).toBe(true);
    expect(state.mode).toBe("single");
    expect(state.order[0]).toBe("light_punch");
  });
});

describe("取り直したあとの再開（★初回設定で手を止めない）", () => {
  it("★未設定が残っていれば、取り直しの 1 件を入れたあと次の技へ続く", () => {
    // 方向 4 件だけ登録済み（攻撃 6 件とマクロ 3 件が未設定）。
    const base = abortCalibration(recordSequential(emptyProfile(), 4));

    let retake = startRetake(base, "left");
    retake = recordBinding(retake, { kind: "button", index: 99 });

    // 取り直しは反映される。
    expect(bindingOf(retake.profile, "left")).toEqual({
      kind: "button",
      index: 99,
    });
    // ★ここで止まらない。未割当の先頭（弱パンチ）へ進む。
    expect(isFinished(retake)).toBe(false);
    expect(currentTarget(retake)).toBe("light_punch");
    expect(retake.mode).toBe("sequential");
    // 何を取り直したかが分かる。
    expect(retake.lastRetaken).toBe("left");
  });

  it("★すべて設定済みなら従来どおり 1 件で完了する（後日の単発編集）", () => {
    // 必須 10 件 ＋ マクロ 3 件をすべて埋める。
    let state = startCalibration(emptyProfile(), true);
    for (let i = 0; i < CALIBRATION_ORDER.length; i += 1) {
      state = recordBinding(state, { kind: "button", index: i });
    }
    const full = abortCalibration(state);

    let retake = startRetake(full, "light_punch");
    retake = recordBinding(retake, { kind: "button", index: 90 });

    expect(isFinished(retake)).toBe(true);
    expect(retake.mode).toBe("single");
    expect(retake.lastRetaken).toBe("light_punch");
  });

  it("上書きを承認した場合も同じように案内へ戻る", () => {
    const base = abortCalibration(recordSequential(emptyProfile(), 4));

    let retake = startRetake(base, "left");
    // index 0 は up に割り当て済み → 衝突。
    retake = recordBinding(retake, { kind: "button", index: 0 });
    expect(retake.conflict).toBeTruthy();

    retake = confirmOverwrite(retake);

    expect(bindingOf(retake.profile, "left")).toEqual({
      kind: "button",
      index: 0,
    });
    // up の割当は外れたので、未割当の先頭は up になる。
    expect(isFinished(retake)).toBe(false);
    expect(currentTarget(retake)).toBe("up");
    expect(retake.lastRetaken).toBe("left");
  });

  it("取り直しを飛ばしても手が止まらない（通知は出ない）", () => {
    const base = abortCalibration(recordSequential(emptyProfile(), 4));

    const retake = skipCurrent(startRetake(base, "left"));

    expect(isFinished(retake)).toBe(false);
    expect(currentTarget(retake)).toBe("light_punch");
    expect(retake.lastRetaken).toBeUndefined();
  });

  it("次の記録で取り直しの通知が消える", () => {
    const base = abortCalibration(recordSequential(emptyProfile(), 4));

    let retake = startRetake(base, "left");
    retake = recordBinding(retake, { kind: "button", index: 99 });
    expect(retake.lastRetaken).toBe("left");

    retake = recordBinding(retake, { kind: "button", index: 50 });
    expect(retake.lastRetaken).toBeUndefined();
  });
});
