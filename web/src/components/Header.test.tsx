import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import "@/lib/i18n";

import Header from "./Header";

function renderHeader(pathname: string, sticky?: boolean) {
  return render(
    <MemoryRouter initialEntries={[pathname]}>
      <Header sticky={sticky} />
    </MemoryRouter>,
  );
}

describe("Header", () => {
  // ★M38-02(2026-09-17)是正: 旧題は「NAV_LINKS の全リンクを表示」であったが、
  // **実際に主張していたのは 11 本のうち 6 本だけ**であった。⇒ 題が実態を偽っていた
  // (M38-02 で技編集を外すまで、外しても戻しても赤くならなかった原因でもある)。
  // ⇒ 期待値を緩めるのではなく、全 11 本を名指しで主張する形へ作り替えた(D-308 と同じ扱い)。
  // ★ここが「ナビに何が出ているか」の正本である。NAV_LINKS を増減させたらこの表も直すこと。
  const EXPECTED_NAV_LABELS = [
    "コンボ一覧",
    "マイコンボ",
    "コンボ比較",
    "確定反撃サーチ",
    "確定反撃マイリスト",
    "タグ管理",
    "取込",
    "他から引っ越し",
    "プリセット管理",
    "ゴミ箱",
    "設定",
  ] as const;

  it("PC サイズで NAV_LINKS の全 11 リンクを表示", () => {
    renderHeader("/combos");
    expect(screen.getByText("Tacpendium")).toBeTruthy();
    for (const label of EXPECTED_NAV_LABELS) {
      expect(screen.getByText(label), `ナビに「${label}」が無い`).toBeTruthy();
    }
    // ★件数も見る —— 名指しだけだと「知らないリンクが増えた」ことに気づけない。
    expect(screen.getAllByRole("link").length).toBe(EXPECTED_NAV_LABELS.length + 1); // +1 = ロゴ
  });

  // ★M20-04(2026-08-13)で主張を反転させた。
  //
  // 旧: 「プリセット管理リンクが disabled でツールチップ表示」。/presets が
  // router.tsx に未定義で、Header のリンクが disabled だったことを守っていた。
  // M20-04 で画面が実装され、この主張は成立しなくなった。
  // ⇒ 期待値を緩めるのではなく主張を作り替えた(D-308 と同じ扱い)。
  it("プリセット管理リンクが有効で /presets へ遷移できる", () => {
    renderHeader("/combos");
    const preset = screen.getByText("プリセット管理");
    expect(preset.className).not.toContain("cursor-not-allowed");
    expect(preset.getAttribute("href")).toBe("/presets");
  });

  // ★★M38-02(2026-09-17・D-892): 技編集(/moves/edit)をナビから外した。
  //
  // 着手前は「技編集」を主張するテストが 1 本も無く(上の 1 本目は 12 本のうち 6 本しか
  // 見ていない)、外しても戻しても何も赤くならない状態だった。⇒ 守りを置く。
  // ★画面・ルート・テストは残してある。ここが守るのは「ナビに出ていないこと」だけで
  //   あり、/moves/edit へ URL 直打ちで着けることは moves-edit.spec.ts が押さえる。
  it("技編集(/moves/edit)はナビに出ない(M38-02 で導線を外した)", async () => {
    const user = userEvent.setup();
    renderHeader("/combos");
    expect(screen.queryByText("技編集")).toBeNull();
    expect(
      screen.queryAllByRole("link").map((a) => a.getAttribute("href")),
    ).not.toContain("/moves/edit");

    // モバイル Sheet も同じ NAV_LINKS を描くため、そちらにも出ないこと。
    await user.click(screen.getByLabelText("メニューを開く"));
    expect(screen.queryByText("技編集")).toBeNull();
    expect(
      screen.queryAllByRole("link").map((a) => a.getAttribute("href")),
    ).not.toContain("/moves/edit");
  });

  // ★M38-02: 改名(「引っ越し取込」→「他から引っ越し」)がナビへ届いていること。
  it("「他から引っ越し」リンクが /import/combo/helper を指す(M38-02 で改名)", () => {
    renderHeader("/combos");
    const link = screen.getByText("他から引っ越し");
    expect(link.getAttribute("href")).toBe("/import/combo/helper");
    expect(screen.queryByText("引っ越し取込")).toBeNull();
  });

  // ★CurrentUserProvider の外で描いても壊れないこと(context の既定値が
  // multiUser: false のため利用者表示は出ない)。M22-02 の指摘 ⑤ で
  // Header が利用者の状態を読むようになったことへの担保である。
  it("Provider の外で描いても利用者表示は出ない", () => {
    renderHeader("/combos");
    expect(screen.queryByTestId("header-current-user")).toBeNull();
  });

  it("現在ページのリンクが active スタイル(遷移不可)", () => {
    renderHeader("/combos");
    const currentLink = screen.getByText("コンボ一覧");
    expect(currentLink.className).toContain("pointer-events-none");
    expect(currentLink.className).toContain("text-blue-600");
    expect(currentLink.getAttribute("aria-current")).toBe("page");
  });

  it("現在ページ以外のリンクは active でない", () => {
    renderHeader("/combos");
    const otherLink = screen.getByText("マイコンボ");
    expect(otherLink.className).not.toContain("pointer-events-none");
    expect(otherLink.getAttribute("aria-current")).toBeNull();
  });

  // ★M20-04(2026-08-13)で主張を作り替えた。
  //
  // 旧 2 本は「現在ページ表示と disabled(未実装)表示が視覚的に区別できる」で、
  // 唯一の disabled リンクだった「プリセット管理」を題材にしていた。
  // M20-04 で /presets を実装して有効化し、NAV_LINKS から disabled が
  // 1 つも無くなったため、題材そのものが消えた。
  // ⇒ 期待値を緩めるのではなく、まだ実在する区別(現在ページ vs 通常リンク)へ
  // 主張を作り替えた(D-308 と同じ扱い)。
  it("現在ページ表示と通常リンク表示が視覚的に区別できる", () => {
    renderHeader("/combos");
    const currentLink = screen.getByText("コンボ一覧");
    const normalLink = screen.getByText("プリセット管理");
    // ★hover:text-blue-600 は通常リンクにも付くため、色名の部分一致で
    // 区別しないこと。現在ページだけが持つのは font-bold /
    // pointer-events-none / aria-current である。
    expect(currentLink.className).toContain("font-bold");
    expect(currentLink.className).toContain("pointer-events-none");
    expect(currentLink.getAttribute("aria-current")).toBe("page");
    expect(normalLink.className).not.toContain("font-bold");
    expect(normalLink.className).not.toContain("pointer-events-none");
    expect(normalLink.getAttribute("aria-current")).toBeNull();
  });

  it("モバイル Sheet メニュー内でも現在ページと通常リンクが区別できる", async () => {
    const user = userEvent.setup();
    renderHeader("/combos");
    await user.click(screen.getByLabelText("メニューを開く"));

    const links = screen.getAllByText("コンボ一覧");
    const sheetCurrentLink = links[links.length - 1];
    const presetLinks = screen.getAllByText("プリセット管理");
    const sheetPresetLink = presetLinks[presetLinks.length - 1];

    expect(sheetCurrentLink.className).toContain("font-bold");
    expect(sheetCurrentLink.className).toContain("pointer-events-none");
    expect(sheetPresetLink.className).not.toContain("font-bold");
    expect(sheetPresetLink.getAttribute("href")).toBe("/presets");
  });

  it("sticky Props で sticky top-0 z-10 クラス付与", () => {
    const { container } = renderHeader("/trash", true);
    const header = container.querySelector("header");
    expect(header?.className).toContain("sticky");
    expect(header?.className).toContain("top-0");
    expect(header?.className).toContain("z-10");
  });

  it("sticky なしでは sticky クラスなし", () => {
    const { container } = renderHeader("/combos");
    const header = container.querySelector("header");
    expect(header?.className).not.toContain("sticky");
  });

  it("ハンバーガーボタンが存在する", () => {
    renderHeader("/combos");
    expect(screen.getByLabelText("メニューを開く")).toBeTruthy();
  });
});
