import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import "@/lib/i18n";
import Step07Password from "./Step07Password";

// Step 7 の明示的な同意(DES-005 §5.1「Step 7 の要件」6 / CHANGE-185)。
//
// ★★本ファイルは「ずれ止め」の本体である(指示書 §2.3-3)。
//   同じ守りが設定画面とウィザードの 2 か所にあるため、部品ではなく不変条件を
//   共有する——SettingsSectionNetwork.test.tsx の
//   「未設定でも同意すれば ON にできる。同意するまで押せない」と*同じ主張*を
//   ここへ置く。★無ければ 2 か所の守りは次の改修で必ずずれる。

const setPasswordMutate = vi.fn();
const updateConfigMutate = vi.fn();

vi.mock("@/features/auth/useSetPassword", () => ({
  useSetPassword: () => ({
    mutate: setPasswordMutate,
    isPending: false,
    isError: false,
  }),
}));

vi.mock("@/features/config/useUpdateConfig", () => ({
  useUpdateConfig: () => ({
    mutate: updateConfigMutate,
    isPending: false,
    isError: false,
  }),
}));

const SKIP = "auth-set-password-skip";
const CHECK = "wizard-lan-consent-check";
const NEXT = "wizard-lan-consent-next";

beforeEach(() => {
  vi.clearAllMocks();
  // 決める → 有効化 → onDone の 2 段(PasswordSetForm.tsx:50-69)をどちらも通す。
  setPasswordMutate.mockImplementation(
    (_req: unknown, opts: { onSuccess: () => void }) => opts.onSuccess(),
  );
  updateConfigMutate.mockImplementation(
    (_payload: unknown, opts: { onSuccess: () => void }) => opts.onSuccess(),
  );
});

describe("Step07Password の同意ゲート", () => {
  it("★★★未設定でも同意すれば進める。同意するまで押せない", async () => {
    // ★SettingsSectionNetwork.test.tsx の同名テストと同じ主張である。
    const user = userEvent.setup();
    const onNext = vi.fn();
    render(<Step07Password onNext={onNext} onPrev={vi.fn()} />);

    await user.click(screen.getByTestId(SKIP));

    const next = screen.getByTestId(NEXT);
    expect(next.hasAttribute("disabled")).toBe(true);
    await user.click(next);
    expect(onNext).not.toHaveBeenCalled();

    await user.click(screen.getByTestId(CHECK));
    expect(next.hasAttribute("disabled")).toBe(false);
    await user.click(next);

    expect(onNext).toHaveBeenCalledTimes(1);
  });

  it("★「あとにする」の導線そのものは消えていない(D-396)", () => {
    render(<Step07Password onNext={vi.fn()} onPrev={vi.fn()} />);

    // ★パスワードを必須にしてはならない。禁じるのではなく、告げたうえで通す。
    expect(screen.getByTestId(SKIP)).toBeTruthy();
  });

  it("★★パスワードを設定して進む経路には同意を要求しない", async () => {
    // ★要求すると同意が儀式になり、読まれなくなる(指示書 §2.2-3)。
    const user = userEvent.setup();
    const onNext = vi.fn();
    render(<Step07Password onNext={onNext} onPrev={vi.fn()} />);

    // 同意ビューへ入る前の段には、チェックボックスがそもそも無い。
    expect(screen.queryByTestId(CHECK)).toBeNull();

    await user.type(screen.getByTestId("auth-set-password-input"), "abcd");
    await user.click(screen.getByTestId("auth-set-password-submit"));

    expect(updateConfigMutate).toHaveBeenCalledWith(
      { security: { passwordEnabled: true } },
      expect.anything(),
    );
    expect(onNext).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId(CHECK)).toBeNull();
  });

  it("★★同意ビューへ入り直すとチェックは外れている", async () => {
    // ★LanModeConfirmDialog.tsx:50-55 と同じ扱い(開き直すたびにやり直す)。
    const user = userEvent.setup();
    const onNext = vi.fn();
    render(<Step07Password onNext={onNext} onPrev={vi.fn()} />);

    await user.click(screen.getByTestId(SKIP));
    await user.click(screen.getByTestId(CHECK));
    expect(screen.getByTestId(NEXT).hasAttribute("disabled")).toBe(false);

    // 同意ビューの「戻る」でパスワードの段へ戻り、もう一度「あとにする」を押す。
    await user.click(screen.getByRole("button", { name: "戻る" }));
    await user.click(screen.getByTestId(SKIP));

    expect(screen.getByTestId(NEXT).hasAttribute("disabled")).toBe(true);
    await user.click(screen.getByTestId(NEXT));
    expect(onNext).not.toHaveBeenCalled();
  });

  it("★★キーボードでも同意を飛ばせない(Enter / Space)", async () => {
    // ★読解では「submit 経路が無いので抜けられない」と言えるが、読解は次の改修まで
    //   持たない。⇒ 実際にキーを撃って固定する。
    const user = userEvent.setup();
    const onNext = vi.fn();
    render(<Step07Password onNext={onNext} onPrev={vi.fn()} />);

    // 「あとにする」の上で Enter —— 同意ビューへ入るだけで、段は進まない。
    screen.getByTestId(SKIP).focus();
    await user.keyboard("{Enter}");
    expect(screen.getByTestId(NEXT)).toBeTruthy();
    expect(onNext).not.toHaveBeenCalled();

    // チェックせずに Enter —— チェックボックス上でも確定ボタン上でも進まない。
    screen.getByTestId(CHECK).focus();
    await user.keyboard("{Enter}");
    expect(screen.getByTestId(NEXT).hasAttribute("disabled")).toBe(true);
    expect(onNext).not.toHaveBeenCalled();

    screen.getByTestId(NEXT).focus();
    await user.keyboard("{Enter}");
    expect(onNext).not.toHaveBeenCalled();

    // ★対照: Space でチェックを入れれば同じ Enter で進める。
    //   ⇒ キーボード経路が死んでいるのではなく、同意が効いているのだと分かる。
    screen.getByTestId(CHECK).focus();
    await user.keyboard(" ");
    expect(screen.getByTestId(NEXT).hasAttribute("disabled")).toBe(false);

    screen.getByTestId(NEXT).focus();
    await user.keyboard("{Enter}");
    expect(onNext).toHaveBeenCalledTimes(1);
  });

  it("★入力欄で Enter を押しても、空欄のままなら段は進まない(submit 経路)", async () => {
    // ★PasswordSetForm は <form> を持つ。空欄の Enter が onDone へ抜けると、
    //   同意も設定もないまま段が進むことになる。
    const user = userEvent.setup();
    const onNext = vi.fn();
    render(<Step07Password onNext={onNext} onPrev={vi.fn()} />);

    screen.getByTestId("auth-set-password-input").focus();
    await user.keyboard("{Enter}");

    expect(setPasswordMutate).not.toHaveBeenCalled();
    expect(onNext).not.toHaveBeenCalled();
  });

  it("★段の「戻る」は同意ビューでは出ない(名前の衝突を作らない)", async () => {
    const user = userEvent.setup();
    const onPrev = vi.fn();
    render(<Step07Password onNext={vi.fn()} onPrev={onPrev} />);

    await user.click(screen.getByTestId(SKIP));

    // 「戻る」は 1 つだけ。押すと段ではなくパスワードの段へ戻る。
    await user.click(screen.getByRole("button", { name: "戻る" }));
    expect(onPrev).not.toHaveBeenCalled();
    expect(screen.getByTestId(SKIP)).toBeTruthy();
  });
});
