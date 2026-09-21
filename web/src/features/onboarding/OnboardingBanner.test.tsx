import { render, screen, fireEvent } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import "@/lib/i18n";
import OnboardingBanner from "./OnboardingBanner";
import { onboardingStorage } from "./onboarding-storage";

describe("OnboardingBanner", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("shows the banner on first visit (flag unset)", () => {
    render(<OnboardingBanner />);

    expect(screen.getByText("はじめてご利用の方へ")).toBeTruthy();
    expect(screen.getByRole("button", { name: "閉じる" })).toBeTruthy();
  });

  it("does not show the banner when already seen", () => {
    onboardingStorage.save(true);
    render(<OnboardingBanner />);

    expect(screen.queryByText("はじめてご利用の方へ")).toBeNull();
  });

  it("dismissing hides the banner and persists the flag", () => {
    render(<OnboardingBanner />);

    fireEvent.click(screen.getByRole("button", { name: "閉じる" }));

    expect(screen.queryByText("はじめてご利用の方へ")).toBeNull();
    expect(onboardingStorage.load()).toBe(true);
  });

  it("stays hidden after dismiss even after remount", () => {
    const { unmount } = render(<OnboardingBanner />);
    fireEvent.click(screen.getByRole("button", { name: "閉じる" }));
    unmount();

    render(<OnboardingBanner />);
    expect(screen.queryByText("はじめてご利用の方へ")).toBeNull();
  });
});
