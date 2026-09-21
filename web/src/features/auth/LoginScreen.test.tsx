import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";

import "@/lib/i18n";

vi.mock("./useLogin", () => ({ useLogin: vi.fn() }));

import LoginScreen from "./LoginScreen";
import { useLogin } from "./useLogin";

const mockedUseLogin = vi.mocked(useLogin);

let mutate: ReturnType<typeof vi.fn>;

function setLoginState(state: { isError?: boolean; isPending?: boolean } = {}) {
  mockedUseLogin.mockReturnValue({
    mutate,
    isError: state.isError ?? false,
    isPending: state.isPending ?? false,
  } as unknown as ReturnType<typeof useLogin>);
}

beforeEach(() => {
  vi.clearAllMocks();
  mutate = vi.fn();
  setLoginState();
});

describe("LoginScreen", () => {
  // ★§5.1-6 / D-397: ログイン欄はマスクが既定。表示へ切り替えられる。
  it("入力欄はマスクが既定で、表示へ切り替えられる", async () => {
    const user = userEvent.setup();
    render(<LoginScreen />);

    const input = screen.getByTestId("auth-login-password-input");
    expect(input.getAttribute("type")).toBe("password");

    await user.click(screen.getByTestId("auth-login-password-toggle"));
    expect(screen.getByTestId("auth-login-password-input").getAttribute("type")).toBe("text");
  });

  it("入力して送ると照合を依頼する", async () => {
    const user = userEvent.setup();
    render(<LoginScreen />);

    await user.type(screen.getByTestId("auth-login-password-input"), "hunter2");
    await user.click(screen.getByTestId("auth-login-submit"));

    expect(mutate).toHaveBeenCalledWith({ password: "hunter2" });
  });

  // ★§5.1-4（重大 §9-6 の対象）: 失敗は入力欄のそばに出す。画面を遷移させない。
  // 遷移させると入力欄が消えて理由も分からなくなる。
  it("失敗しても入力欄が消えず、そばにエラーが出る", () => {
    setLoginState({ isError: true });
    render(<LoginScreen />);

    expect(screen.getByTestId("auth-login-error").textContent).toBe("パスワードが違います。");
    // ★入力欄が残っていることが要件である。
    expect(screen.getByTestId("auth-login-password-input")).toBeTruthy();
    expect(screen.getByTestId("auth-login-submit")).toBeTruthy();
  });

  // ★理由を書き分けない(DES-002 §8.1)。サーバは invalid_password しか返さない。
  it("失敗の理由を書き分けない", () => {
    setLoginState({ isError: true });
    render(<LoginScreen />);

    const text = screen.getByTestId("auth-login-error").textContent ?? "";
    expect(text).not.toMatch(/未設定|無効|設定されていません/);
  });

  // ★§4.3-5: なぜ急に出たかが分かる文言。★時間切れとは書かない(D-395)。
  it("セッションが切れたときは理由の分かる文言になる", () => {
    render(<LoginScreen expired />);

    expect(screen.getByTestId("auth-login-title").textContent).toBe(
      "もう一度パスワードの入力が必要です",
    );
    expect(screen.getByText(/アプリが起動し直されたか、パスワードが変更されたとき/)).toBeTruthy();
    expect(screen.queryByText(/しばらく操作しなかった|時間切れ/)).toBeNull();
  });

  // ★§4.4-5: 案内は置くが、アプリからの復旧手段は作らない。
  it("「パスワードが分からないとき」の案内を開ける", async () => {
    const user = userEvent.setup();
    render(<LoginScreen />);

    expect(screen.queryByTestId("auth-forgot-help")).toBeNull();
    await user.click(screen.getByTestId("auth-login-forgot"));

    const help = screen.getByTestId("auth-forgot-help");
    expect(help.textContent).toContain("password_enabled = false");
    // ★アプリ側から無効化する操作(ボタン)を置いていないこと。
    // ★2026-08-16: コピーボタンを外したため 1 → 0 になった(開発者の実機確認 ①)。
    // ファイル名だけをコピーしても貼り付け先が無く、役に立っていなかった。
    // ⇒ ここは「案内の中に押せるものが 1 つも無い」という強い主張になった。
    expect(help.querySelectorAll("button")).toHaveLength(0);
  });

  // ★パスを出さない代わりに、そのフォルダへ辿り着く手順を出す(指摘 ①)。
  it("案内にファイルの置き場所と開き方のヒントが出る", async () => {
    const user = userEvent.setup();
    render(<LoginScreen />);
    await user.click(screen.getByTestId("auth-login-forgot"));

    const text = screen.getByTestId("auth-forgot-help").textContent ?? "";
    expect(text).toContain("config.toml");
    expect(text).toContain("ファイルの場所を開く");
    expect(text).toContain("テキストエディタ");
  });

  // ★手順が実際に成立すること(2026-08-16 の開発者の指摘)。
  // password_enabled を false にするだけでは新しいパスワードを決められない——
  // password_hash が残ると PasswordSet() が true のままで、設定画面は「変える」を
  // 出し、SetPassword が現在のパスワードの一致を要求する。
  // ⇒ 忘れた当のパスワードを聞かれて詰む。案内は hash の削除まで含むこと。
  it("案内が password_hash の削除まで含む(これが無いと手順が成立しない)", async () => {
    const user = userEvent.setup();
    render(<LoginScreen />);
    await user.click(screen.getByTestId("auth-login-forgot"));

    const text = screen.getByTestId("auth-forgot-help").textContent ?? "";
    expect(text).toContain("password_enabled = false");
    expect(text).toContain("password_hash");
    expect(text).toContain("の行を消してください");
    // ★書き換え前にアプリを止めること(動かしたまま書くと保存で戻る)。
    expect(text).toContain("アプリを終了");
  });
});

// ===========================================================================
// M22-08 §5.1-8: ★最重要ゲート 1 の画面側
// ログイン欄で止めるのは「空」だけである。それ以外は何も止めない。
// ===========================================================================

describe("M22-08 ログイン欄の検査は「空」だけ", () => {
  it("空のままでは押せない", () => {
    render(<LoginScreen />);
    const submit = screen.getByTestId("auth-login-submit") as HTMLButtonElement;
    expect(submit.disabled).toBe(true);
  });

  it("空白だけでも押せない(前後の空白は除去されるため空と同じである)", async () => {
    const user = userEvent.setup();
    render(<LoginScreen />);

    await user.type(screen.getByTestId("auth-login-password-input"), "   ");

    expect((screen.getByTestId("auth-login-submit") as HTMLButtonElement).disabled).toBe(true);
  });

  // ★★ここが最重要ゲート 1 の画面側である。
  // 長さ(VAL-N06)その他の規則をログイン欄へ掛けると、既に短いパスワードで決めた
  // 利用者が、正しい値を打っても押せなくなる。⇒ 長さでは絶対に止めない。
  // ★入力段階の除去(2026-08-16)は「非 ASCII」だけに掛かり、長さには連動しない——
  //   それを固定するのが本テストである。
  it.each([
    ["下限より短い", "ab"],
    ["上限より長い", "a".repeat(200)],
  ])("%s でも押せて、そのまま送られる", async (_name, password) => {
    const user = userEvent.setup();
    render(<LoginScreen />);

    const input = screen.getByTestId("auth-login-password-input") as HTMLInputElement;
    fireEvent.change(input, { target: { value: password } });

    expect((screen.getByTestId("auth-login-submit") as HTMLButtonElement).disabled).toBe(false);

    await user.click(screen.getByTestId("auth-login-submit"));
    expect(mutate).toHaveBeenCalledWith({ password });
  });

  // ★非 ASCII は入力段階で落ちるため、欄に入らない(2026-08-16 開発者要望)。
  // ★狙いは「全角のまま打ってログインに失敗する」煩わしさを消すことである——
  //   失敗の理由は「パスワードが違います。」としか出ず、原因が分からない。
  // ★★サーバ側の照合は無検査のままである。これは画面の入力補助にすぎない。
  it.each([
    ["日本語(非 ASCII)", "ぱすわーど"],
    ["全角英数", "ＡＢＣ１２３"],
    ["全角スペース", "　"],
  ])("%s は欄に入らない", async (_name, password) => {
    const user = userEvent.setup();
    render(<LoginScreen />);

    const input = screen.getByTestId("auth-login-password-input") as HTMLInputElement;
    fireEvent.change(input, { target: { value: password } });

    expect(input.value).toBe("");
    expect((screen.getByTestId("auth-login-submit") as HTMLButtonElement).disabled).toBe(true);

    await user.click(screen.getByTestId("auth-login-submit"));
    expect(mutate).not.toHaveBeenCalled();
  });

  // ★半角と混ざっている場合は、半角だけが残る。
  it("全角と半角が混ざっていると、半角だけが残る", () => {
    render(<LoginScreen />);

    const input = screen.getByTestId("auth-login-password-input") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "ｐａｓｓword１２３" } });

    expect(input.value).toBe("word");
  });

  it("規則違反の案内をログイン画面に出さない", async () => {
    const user = userEvent.setup();
    render(<LoginScreen />);

    await user.type(screen.getByTestId("auth-login-password-input"), "ぱすわーど");

    // ★決めるときの案内(auth.setPassword.rule)を流用して出していないこと。
    expect(screen.queryByText(/半角の英数字と記号で決めてください/)).toBeNull();
    expect(screen.queryByText(/日本語や全角の文字は使えません/)).toBeNull();
  });
});
