import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";

import MyComboStatusTabs from "./MyComboStatusTabs";
import type { MyComboStatusCounts } from "../hooks/useMyComboStatusCounts";

const COUNTS: MyComboStatusCounts = { inUse: 5, practicing: 3, reduced: 1 };

describe("MyComboStatusTabs", () => {
  it("renders 3 tabs with count badges", () => {
    render(
      <MyComboStatusTabs selected="in_use" onSelect={vi.fn()} counts={COUNTS} />,
    );
    const tabs = screen.getAllByRole("tab");
    expect(tabs).toHaveLength(3);
    expect(screen.getByText("(5)")).toBeTruthy();
    expect(screen.getByText("(3)")).toBeTruthy();
    expect(screen.getByText("(1)")).toBeTruthy();
  });

  it("calls onSelect when a tab is clicked", async () => {
    const onSelect = vi.fn();
    render(
      <MyComboStatusTabs selected="in_use" onSelect={onSelect} counts={COUNTS} />,
    );
    const user = userEvent.setup();
    const tabs = screen.getAllByRole("tab");
    await user.click(tabs[1]);
    expect(onSelect).toHaveBeenCalledWith("practicing");
  });

  it("highlights the selected tab with data-state=active", () => {
    render(
      <MyComboStatusTabs selected="practicing" onSelect={vi.fn()} counts={COUNTS} />,
    );
    const tabs = screen.getAllByRole("tab");
    expect(tabs[1].getAttribute("data-state")).toBe("active");
    expect(tabs[0].getAttribute("data-state")).toBe("inactive");
  });
});
