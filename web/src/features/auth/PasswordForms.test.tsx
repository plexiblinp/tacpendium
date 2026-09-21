import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi, beforeEach } from "vitest";
import type { ReactElement } from "react";

import i18n from "@/lib/i18n";

vi.mock("./useSetPassword", () => ({ useSetPassword: vi.fn() }));
vi.mock("@/features/config/useUpdateConfig", () => ({ useUpdateConfig: vi.fn() }));

import PasswordChangeForm from "./PasswordChangeForm";
import PasswordSetForm from "./PasswordSetForm";
import { useSetPassword } from "./useSetPassword";
import { useUpdateConfig } from "@/features/config/useUpdateConfig";

const mockedUseSetPassword = vi.mocked(useSetPassword);
const mockedUseUpdateConfig = vi.mocked(useUpdateConfig);

let updateConfigMutate: ReturnType<typeof vi.fn>;

let mutate: ReturnType<typeof vi.fn>;

/** mutate は既定で成功させる(onSuccess を同期に呼ぶ)。 */
function setMutation(opts: { succeed?: boolean; isError?: boolean } = {}) {
  mutate = vi.fn((_vars, handlers?: { onSuccess?: () => void }) => {
    if (opts.succeed ?? true) handlers?.onSuccess?.();
  });
  mockedUseSetPassword.mockReturnValue({
    mutate,
    isError: opts.isError ?? false,
    isPending: false,
    error: null,
  } as unknown as ReturnType<typeof useSetPassword>);
}

function renderWithClient(ui: ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

beforeEach(() => {
  vi.clearAllMocks();
  setMutation();
  updateConfigMutate = vi.fn((_req, handlers?: { onSuccess?: () => void }) => {
    handlers?.onSuccess?.();
  });
  mockedUseUpdateConfig.mockReturnValue({
    mutate: updateConfigMutate,
    isPending: false,
    isError: false,
  } as unknown as ReturnType<typeof useUpdateConfig>);
});

describe("PasswordSetForm(初回設定)", () => {
  // ★§5.1-6 / D-396: 設定欄は表示が既定。マスクへ切り替えられる。
  // ログイン欄(マスク既定)との非対称は意図したものである。
  it("入力欄は表示が既定で、マスクへ切り替えられる", async () => {
    const user = userEvent.setup();
    renderWithClient(<PasswordSetForm onDone={vi.fn()} />);

    const input = screen.getByTestId("auth-set-password-input");
    expect(input.getAttribute("type")).toBe("text");

    await user.click(screen.getByTestId("auth-set-password-toggle"));
    expect(screen.getByTestId("auth-set-password-input").getAttribute("type")).toBe("password");
  });

  // ★§5.1-7: 初回設定では現在のパスワードを要求しない。
  it("現在のパスワードを要求しない", async () => {
    const user = userEvent.setup();
    const onDone = vi.fn();
    renderWithClient(<PasswordSetForm onDone={onDone} />);

    await user.type(screen.getByTestId("auth-set-password-input"), "hunter2");
    await user.click(screen.getByTestId("auth-set-password-submit"));

    expect(mutate.mock.calls[0][0]).toEqual({ currentPassword: "", newPassword: "hunter2" });
    expect(onDone).toHaveBeenCalled();
  });

  // ★D-396 / N-8: 確認入力(2 回打たせる)を足さない。表示が既定であるため。
  it("確認入力の欄を持たない", () => {
    renderWithClient(<PasswordSetForm onDone={vi.fn()} />);
    expect(screen.getAllByTestId(/auth-set-password-input/)).toHaveLength(1);
  });

  // ★D-396: 必須化しない。設定せずに進める経路を残す。
  it("「あとにする」で設定せずに進める", async () => {
    const user = userEvent.setup();
    const onSkip = vi.fn();
    renderWithClient(<PasswordSetForm onDone={vi.fn()} onSkip={onSkip} />);

    await user.click(screen.getByTestId("auth-set-password-skip"));

    expect(onSkip).toHaveBeenCalled();
    expect(mutate).not.toHaveBeenCalled();
  });

  // ★H-2 の回帰テスト: 決めただけでは入場ゲートは効かない。
  // 検証子(password_hash)と有効化フラグ(password_enabled)は別物であり、
  // POST /api/auth/password は前者しか書かない。有効化まで通すこと。
  it("決めたあとパスワード保護を有効にする", async () => {
    const user = userEvent.setup();
    const onDone = vi.fn();
    renderWithClient(<PasswordSetForm onDone={onDone} />);

    await user.type(screen.getByTestId("auth-set-password-input"), "hunter2");
    await user.click(screen.getByTestId("auth-set-password-submit"));

    expect(updateConfigMutate).toHaveBeenCalledTimes(1);
    expect(updateConfigMutate.mock.calls[0][0]).toEqual({
      security: { passwordEnabled: true },
    });
    expect(onDone).toHaveBeenCalled();
  });

  // ★有効化に失敗したら成功として畳まない(「決めたのにゲートが効いていない」を隠さない)。
  it("有効化に失敗したら完了扱いにしない", async () => {
    const user = userEvent.setup();
    const onDone = vi.fn();
    updateConfigMutate = vi.fn();
    mockedUseUpdateConfig.mockReturnValue({
      mutate: updateConfigMutate,
      isPending: false,
      isError: true,
    } as unknown as ReturnType<typeof useUpdateConfig>);
    renderWithClient(<PasswordSetForm onDone={onDone} />);

    await user.type(screen.getByTestId("auth-set-password-input"), "hunter2");
    await user.click(screen.getByTestId("auth-set-password-submit"));

    expect(onDone).not.toHaveBeenCalled();
    expect(screen.getByTestId("auth-set-password-error")).toBeTruthy();
  });

  it("空のままでは決められない", () => {
    renderWithClient(<PasswordSetForm onDone={vi.fn()} />);
    const submit = screen.getByTestId("auth-set-password-submit") as HTMLButtonElement;
    expect(submit.disabled).toBe(true);
  });
});

describe("PasswordChangeForm(変更)", () => {
  // ★§5.1-7: 変更では現在のパスワードが要る。
  it("現在のパスワードが空のままでは変えられない", async () => {
    const user = userEvent.setup();
    renderWithClient(<PasswordChangeForm onCancel={vi.fn()} />);

    await user.type(screen.getByTestId("auth-change-password-new-input"), "newpass");

    const submit = screen.getByTestId("auth-change-password-submit") as HTMLButtonElement;
    expect(submit.disabled).toBe(true);
  });

  it("現在のパスワードを添えて送る", async () => {
    const user = userEvent.setup();
    renderWithClient(<PasswordChangeForm onCancel={vi.fn()} />);

    // ★現在欄は "old"(3 文字)のまま。検査が掛からないことを兼ねて確かめる
    //   (M22-08 §4.1-2＝最重要ゲート 1)。新パスワードだけが下限 4 文字を満たす。
    await user.type(screen.getByTestId("auth-change-password-current-input"), "old");
    await user.type(screen.getByTestId("auth-change-password-new-input"), "new-password");
    await user.click(screen.getByTestId("auth-change-password-submit"));

    expect(mutate.mock.calls[0][0]).toEqual({
      currentPassword: "old",
      newPassword: "new-password",
    });
  });

  // ★§4.4-4（重大 §9-8 の対象）: 変更が通ると自分も切れる。
  // それを伝えてログインへ戻す導線を出す。★黙って 401 が出るだけにしない。
  it("変更後に「自分も入り直す」ことを伝え、ログインへ戻す導線を出す", async () => {
    const user = userEvent.setup();
    renderWithClient(<PasswordChangeForm onCancel={vi.fn()} />);

    await user.type(screen.getByTestId("auth-change-password-current-input"), "old");
    await user.type(screen.getByTestId("auth-change-password-new-input"), "new-password");
    await user.click(screen.getByTestId("auth-change-password-submit"));

    const done = screen.getByTestId("auth-change-password-done");
    expect(done.textContent).toContain("もう一度入ってください");
    expect(screen.getByTestId("auth-change-password-done-action")).toBeTruthy();
  });

  // ★変更前に警告を出す(この画面も切れることを含む)。
  it("変更前に、いま開いている機器がすべて入り直しになることを伝える", () => {
    renderWithClient(<PasswordChangeForm onCancel={vi.fn()} />);
    expect(screen.getByText(/この画面も含みます/)).toBeTruthy();
  });

  // ★開発者の実機確認 ④(2026-08-16): 「いまのパスワード」に表示切替が無く、
  // 打ち間違えても「いまのパスワードが違います」しか返らず確かめられなかった。
  // ★既定はマスクのままである(現在欄と新パスワード欄で既定値が非対称＝D-396/D-397)。
  it("「いまのパスワード」は既定でマスクされ、切替で表示できる", async () => {
    const user = userEvent.setup();
    renderWithClient(<PasswordChangeForm onCancel={vi.fn()} />);

    const input = screen.getByTestId("auth-change-password-current-input") as HTMLInputElement;
    expect(input.type).toBe("password");

    await user.click(screen.getByTestId("auth-change-password-current-toggle"));
    expect(
      (screen.getByTestId("auth-change-password-current-input") as HTMLInputElement).type,
    ).toBe("text");
  });

  // 対照: 新パスワード欄は既定で表示される(こちらは変えていない)。
  it("「新しいパスワード」は既定で表示される", () => {
    renderWithClient(<PasswordChangeForm onCancel={vi.fn()} />);
    const input = screen.getByTestId("auth-change-password-new-input") as HTMLInputElement;
    expect(input.type).toBe("text");
  });
});

// ===========================================================================
// M22-08 §5.1-7: 画面側でも送る前に止まる(VAL-N05 / VAL-N06)
// ===========================================================================

describe("M22-08 パスワードの検査(初回設定)", () => {
  it("入力できる文字の案内が出ている", () => {
    renderWithClient(<PasswordSetForm onDone={vi.fn()} />);
    expect(screen.getByTestId("auth-set-password-rule").textContent).toContain("半角");
  });

  // ★既存の案内 2 行が消えていないこと(DES-005 §5.1 Step 7 の要件 4＝CHANGE-113)。
  // ★★i18n キーを消しても、型検査も ja/en parity 検査も緑のまま通る——
  // 両ロケールから同時に消えると parity は成立するためである。
  // 画面にキー文字列がそのまま出る形の回帰は、ここでしか止められない。
  it("既存の案内(ほかのサービス／あとから変えられる)が消えていない", () => {
    renderWithClient(<PasswordSetForm onDone={vi.fn()} />);

    expect(screen.getByText(/ほかのサービスで使っているパスワードは使わないでください/)).toBeTruthy();
    expect(screen.getByText(/あとから設定画面で変えられます/)).toBeTruthy();
    // 生のキー文字列が描画されていないこと。
    expect(screen.queryByText(/auth\.setPassword\./)).toBeNull();
  });

  // ★2026-08-16 開発者要望: 非 ASCII は入力段階で落とす。
  // ⇒ 欄に入らないため、規則違反の表示にも到達しない。
  it("日本語は欄に入らず、送信もされない", async () => {
    const user = userEvent.setup();
    renderWithClient(<PasswordSetForm onDone={vi.fn()} />);

    const input = screen.getByTestId("auth-set-password-input") as HTMLInputElement;
    await user.type(input, "ぱすわーど");

    expect(input.value).toBe("");
    // 空なので規則違反の表示は出ない(空のうちは出さない仕様)。
    expect(screen.queryByTestId("auth-set-password-rule-error")).toBeNull();
    expect((screen.getByTestId("auth-set-password-submit") as HTMLButtonElement).disabled).toBe(true);
    await user.click(screen.getByTestId("auth-set-password-submit"));
    expect(mutate).not.toHaveBeenCalled();
  });

  it("全角と半角が混ざっていると、半角だけが残る", () => {
    renderWithClient(<PasswordSetForm onDone={vi.fn()} />);

    const input = screen.getByTestId("auth-set-password-input") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "ｐａｓｓword１２３" } });

    expect(input.value).toBe("word");
  });

  it("短すぎると下限の数が出る(数は定数から差し込む)", async () => {
    const user = userEvent.setup();
    renderWithClient(<PasswordSetForm onDone={vi.fn()} />);

    await user.type(screen.getByTestId("auth-set-password-input"), "abc");

    expect(screen.getByTestId("auth-set-password-rule-error").textContent).toContain("4 文字以上");
    expect((screen.getByTestId("auth-set-password-submit") as HTMLButtonElement).disabled).toBe(true);
  });

  it("長すぎると上限の数が出る", async () => {
    renderWithClient(<PasswordSetForm onDone={vi.fn()} />);

    // ★1 文字ずつ打つと遅いので直接反映させる。
    const input = screen.getByTestId("auth-set-password-input") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "a".repeat(129) } });

    expect(screen.getByTestId("auth-set-password-rule-error").textContent).toContain(
      "128 文字まで",
    );
    expect((screen.getByTestId("auth-set-password-submit") as HTMLButtonElement).disabled).toBe(true);
  });

  it("規則を満たせば送信できる(半角スペースを含む合い言葉も通る)", async () => {
    const user = userEvent.setup();
    renderWithClient(<PasswordSetForm onDone={vi.fn()} />);

    await user.type(screen.getByTestId("auth-set-password-input"), "open the gate");

    expect(screen.queryByTestId("auth-set-password-rule-error")).toBeNull();
    await user.click(screen.getByTestId("auth-set-password-submit"));
    expect(mutate).toHaveBeenCalledWith(
      { currentPassword: "", newPassword: "open the gate" },
      expect.anything(),
    );
  });

  it("空のうちは規則違反を出さない", () => {
    renderWithClient(<PasswordSetForm onDone={vi.fn()} />);
    expect(screen.queryByTestId("auth-set-password-rule-error")).toBeNull();
  });
});

describe("M22-08 パスワードの検査(変更) — ★最重要ゲート 1 の画面側", () => {
  // ★★これが本サブで最も壊しやすい点である。「いまのパスワード」欄へ検査を掛けると、
  // 既に非 ASCII や短いパスワードで決めた利用者が変更もできなくなり、詰みが生まれる。
  // ★2026-08-16 開発者要望: 「いまのパスワード」欄にも入力段階の除去が掛かる。
  // ★★ただし掛かるのは「非 ASCII」だけである。長さ・その他の規則には連動しない——
  //   下のテストがそれを固定する。
  it("「いまのパスワード」も日本語は欄に入らない", async () => {
    const user = userEvent.setup();
    renderWithClient(<PasswordChangeForm onCancel={vi.fn()} />);

    const current = screen.getByTestId("auth-change-password-current-input") as HTMLInputElement;
    await user.type(current, "ぱすわーど");

    expect(current.value).toBe("");
  });

  it("「いまのパスワード」が下限より短くても止めない", async () => {
    const user = userEvent.setup();
    renderWithClient(<PasswordChangeForm onCancel={vi.fn()} />);

    await user.type(screen.getByTestId("auth-change-password-current-input"), "ab");
    await user.type(screen.getByTestId("auth-change-password-new-input"), "new-ascii-password");

    expect((screen.getByTestId("auth-change-password-submit") as HTMLButtonElement).disabled).toBe(false);
  });

  // 対照: 新パスワード欄にも同じ除去が掛かる。
  it("「新しいパスワード」も日本語は欄に入らず、送信されない", async () => {
    const user = userEvent.setup();
    renderWithClient(<PasswordChangeForm onCancel={vi.fn()} />);

    await user.type(screen.getByTestId("auth-change-password-current-input"), "current-password");
    const next = screen.getByTestId("auth-change-password-new-input") as HTMLInputElement;
    await user.type(next, "ぱすわーど");

    expect(next.value).toBe("");
    expect((screen.getByTestId("auth-change-password-submit") as HTMLButtonElement).disabled).toBe(true);
    await user.click(screen.getByTestId("auth-change-password-submit"));
    expect(mutate).not.toHaveBeenCalled();
  });

  // ★★規則違反の表示そのものは残してある(入力段階の除去が壊れたときの後ろ盾)。
  // 画面からは到達しないため、文言は i18n を直接引いて固定する。
  it("拒否の文言は 1 文だけである", () => {
    expect(i18n.t("auth.setPassword.errorCharset")).toBe("日本語や全角の文字は使えません。");
  });
});
