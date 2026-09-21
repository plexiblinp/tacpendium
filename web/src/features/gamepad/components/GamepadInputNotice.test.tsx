import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import GamepadInputNotice, {
  GAMEPAD_INPUT_NOTICE_POINTS,
  GamepadNoticeOpenButton,
} from "./GamepadInputNotice";
import {
  GAMEPAD_NOTICE_STORAGE_KEY,
  __resetGamepadNoticeForTest,
} from "../gamepad-notice-storage";

// M37-02 / B10（`P-59` の決着）: 告知を「初回のみ自動表示」へ変えた。
//
// ★★これは**足した床**である（指示書 §0.4＝「引くのではなく足す」）。既存の 7 ファイル
//   31 行は 1 行も外していない —— 定数も `data-testid` も変えておらず、変えたのは
//   「いつ出すか」だけだからである。
//
// ★★型と先例は `SetplayLimitationNotice.test.tsx`（`setplay-notice-seen-v1`）。

// ★モジュールレベルのキャッシュを毎回捨てる。localStorage.clear() だけでは足りない
//   —— 開閉状態は 2 面共有のためモジュール側に持っており、テスト間で漏れる。
beforeEach(() => {
  localStorage.clear();
  __resetGamepadNoticeForTest();
  vi.restoreAllMocks();
});

afterEach(() => {
  localStorage.clear();
  __resetGamepadNoticeForTest();
});

function noticeBody() {
  return screen.queryByTestId("recipe-gamepad-notice");
}

describe("M37-02 B10: 告知は初回のみ自動表示する", () => {
  it("★初回は展開されており、3 点がすべて出る", () => {
    render(<GamepadInputNotice />);

    const body = noticeBody();
    expect(body).not.toBeNull();
    for (let i = 1; i <= GAMEPAD_INPUT_NOTICE_POINTS.length; i += 1) {
      expect(
        screen.getByTestId(`recipe-gamepad-notice-point-${i}`).textContent,
      ).toBeTruthy();
    }
    // ★`D-347` が名指しで守っている 3 点目。畳んでも「開けば読める」ことが要件である。
    expect(body?.textContent).toContain("不具合ではなく");
  });

  it("★初回に既読フラグを書く", () => {
    render(<GamepadInputNotice />);
    expect(localStorage.getItem(GAMEPAD_NOTICE_STORAGE_KEY)).toBe("true");
  });

  it("★★2 回目以降は自動表示しない（＝縦を消費しない）", () => {
    localStorage.setItem(GAMEPAD_NOTICE_STORAGE_KEY, "true");
    render(<GamepadInputNotice />);

    expect(noticeBody()).toBeNull();
    expect(screen.getByTestId("recipe-gamepad-notice-toggle")).toBeTruthy();
  });

  it("★★明示操作で開ける（3 点目がふたたび読める）", async () => {
    const user = userEvent.setup();
    localStorage.setItem(GAMEPAD_NOTICE_STORAGE_KEY, "true");
    render(<GamepadInputNotice />);

    await user.click(screen.getByTestId("recipe-gamepad-notice-toggle"));

    expect(noticeBody()?.textContent).toContain("不具合ではなく");
  });

  it("★閉じられる", async () => {
    const user = userEvent.setup();
    render(<GamepadInputNotice />);

    await user.click(screen.getByTestId("recipe-gamepad-notice-close"));

    expect(noticeBody()).toBeNull();
  });

  it("★★保存できない環境では自動表示しない（毎回表示にしない）", () => {
    // localStorage.setItem が投げる環境（プライベートブラウジング等）を作る。
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });

    render(<GamepadInputNotice />);

    // ★表示してしまうと既読を記録できず毎回自動表示になる ⇒ B10 を満たさない。
    expect(noticeBody()).toBeNull();
  });
});

describe("M37-02 B10: 既読は 2 面で共有される", () => {
  it("★★同時にマウントされた 2 面が同じ状態になる（片方だけ畳まれない）", () => {
    render(
      <>
        <GamepadInputNotice />
        <GamepadInputNotice />
      </>,
    );

    // ★面ごとに useState を持たせると、1 面目が既読を書いた直後に 2 面目が
    //   それを読んで畳まれる。⇒ 2 つとも出ていることが「共有できている」証拠である。
    const bodies = screen.getAllByTestId("recipe-gamepad-notice");
    expect(bodies).toHaveLength(2);
    expect(bodies[0].textContent).toBe(bodies[1].textContent);
  });

  it("★★片方を閉じると両方畳まれる（2 個目のキーを作っていない）", async () => {
    const user = userEvent.setup();
    render(
      <>
        <GamepadInputNotice />
        <GamepadInputNotice />
      </>,
    );

    await user.click(screen.getAllByTestId("recipe-gamepad-notice-close")[0]);

    expect(screen.queryAllByTestId("recipe-gamepad-notice")).toHaveLength(0);
    expect(screen.getAllByTestId("recipe-gamepad-notice-toggle")).toHaveLength(2);
  });
});

// ============================================================================
// ★★★畳んだ形の 2 分岐（`P-59` (2)・完了条件 5 / チェックリスト B-3）。
//
// 開発者は実物を見てから `"label-row"` / `"hidden"` のどちらかを選ぶ。
// ⇒ **どちらを選んでも「明示操作で開ける」が成り立つこと**をここで固定する。
//   これは体裁ではない —— 開く導線を失った瞬間、`D-347` に反しないという
//   本サブの成立根拠そのものが崩れる。
// ============================================================================
describe("M37-02 B10: 畳んだ形は 2 つとも開ける", () => {
  describe('"label-row"（既定）', () => {
    it("★畳んだ状態でラベル 1 行が残り、そこから開ける", async () => {
      const user = userEvent.setup();
      localStorage.setItem(GAMEPAD_NOTICE_STORAGE_KEY, "true");
      render(<GamepadInputNotice collapsedForm="label-row" />);

      expect(noticeBody()).toBeNull();
      await user.click(screen.getByTestId("recipe-gamepad-notice-toggle"));
      expect(noticeBody()?.textContent).toContain("不具合ではなく");
    });

    it("★見出し行の開くボタンは出ない（導線が 2 か所にならない）", () => {
      localStorage.setItem(GAMEPAD_NOTICE_STORAGE_KEY, "true");
      render(
        <>
          <GamepadInputNotice collapsedForm="label-row" />
          <GamepadNoticeOpenButton collapsedForm="label-row" />
        </>,
      );
      expect(screen.queryByTestId("recipe-gamepad-notice-open")).toBeNull();
    });
  });

  describe('"hidden"', () => {
    it("★★畳んだ状態では本体もラベル行も描かれない（縦 0）", () => {
      localStorage.setItem(GAMEPAD_NOTICE_STORAGE_KEY, "true");
      render(<GamepadInputNotice collapsedForm="hidden" />);

      expect(noticeBody()).toBeNull();
      expect(screen.queryByTestId("recipe-gamepad-notice-toggle")).toBeNull();
    });

    it("★★★見出し行の開くボタンから開ける（到達不能にならない）", async () => {
      const user = userEvent.setup();
      localStorage.setItem(GAMEPAD_NOTICE_STORAGE_KEY, "true");
      render(
        <>
          <GamepadNoticeOpenButton collapsedForm="hidden" />
          <GamepadInputNotice collapsedForm="hidden" />
        </>,
      );

      // ★これが無ければ `D-347` の 3 点目へ到達する経路がゼロになる。
      await user.click(screen.getByTestId("recipe-gamepad-notice-open"));

      expect(noticeBody()?.textContent).toContain("不具合ではなく");
    });

    it("★開いている間は見出し行のボタンを出さない", () => {
      render(
        <>
          <GamepadNoticeOpenButton collapsedForm="hidden" />
          <GamepadInputNotice collapsedForm="hidden" />
        </>,
      );
      expect(noticeBody()).not.toBeNull();
      expect(screen.queryByTestId("recipe-gamepad-notice-open")).toBeNull();
    });
  });
});
