import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import "@/lib/i18n";
import Footer from "./Footer";

function renderFooter(initialEntries: string[] = ["/"]) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <Footer />
    </MemoryRouter>,
  );
}

describe("Footer", () => {
  it("renders 4 navigation buttons", () => {
    renderFooter();

    expect(screen.getByText("コンボ")).toBeTruthy();
    expect(screen.getByText("マイコンボ")).toBeTruthy();
    expect(screen.getByText("新規")).toBeTruthy();
    expect(screen.getByText("設定")).toBeTruthy();
  });

  it("has correct link targets", () => {
    renderFooter();

    const links = screen.getAllByRole("link");
    const hrefs = links.map((link) => link.getAttribute("href"));
    expect(hrefs).toContain("/combos");
    expect(hrefs).toContain("/mycombo");
    expect(hrefs).toContain("/combos/new");
    expect(hrefs).toContain("/settings");
  });

  it("highlights the center new combo button", () => {
    renderFooter();

    const newComboLink = screen.getByText("新規").closest("a");
    expect(newComboLink?.className).toContain("bg-blue-600");
    expect(newComboLink?.className).toContain("rounded-full");
  });

  it("shows active state for current route", () => {
    renderFooter(["/combos"]);

    const combosLink = screen.getByText("コンボ").closest("a");
    expect(combosLink?.className).toContain("text-blue-600");
  });

  it("has sm:hidden class for mobile-only visibility", () => {
    renderFooter();

    const nav = screen.getByRole("navigation");
    expect(nav.className).toContain("sm:hidden");
  });

  it("has aria-label for accessibility", () => {
    renderFooter();

    const nav = screen.getByRole("navigation");
    expect(nav.getAttribute("aria-label")).toBe("ナビゲーション");
  });
});
