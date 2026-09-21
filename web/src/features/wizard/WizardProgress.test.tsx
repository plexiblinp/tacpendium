import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import "@/lib/i18n";
import WizardProgress from "./WizardProgress";

describe("WizardProgress", () => {
  it("displays current step and total", () => {
    render(<WizardProgress currentStep={3} totalSteps={7} />);
    expect(screen.getByText(/3.*\/.*7/)).toBeTruthy();
  });

  it("renders progress bar", () => {
    const { container } = render(<WizardProgress currentStep={1} totalSteps={4} />);
    const bar = container.querySelector("[style]");
    expect(bar).toBeTruthy();
  });
});
