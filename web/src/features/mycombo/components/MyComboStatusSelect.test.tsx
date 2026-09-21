import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeAll } from "vitest";

beforeAll(() => {
  // Radix Select requires APIs not available in jsdom
  if (!Element.prototype.hasPointerCapture) {
    Element.prototype.hasPointerCapture = () => false;
  }
  if (!Element.prototype.setPointerCapture) {
    Element.prototype.setPointerCapture = () => {};
  }
  if (!Element.prototype.releasePointerCapture) {
    Element.prototype.releasePointerCapture = () => {};
  }
  if (!Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = () => {};
  }
});

import MyComboStatusSelect from "./MyComboStatusSelect";

describe("MyComboStatusSelect", () => {
  it("renders the trigger with current status label", () => {
    render(
      <MyComboStatusSelect currentStatus="in_use" onChange={() => {}} />,
    );
    expect(screen.getByRole("combobox")).toBeTruthy();
    expect(screen.getByText("使用中")).toBeTruthy();
  });

  it("displays correct label for practicing status", () => {
    render(
      <MyComboStatusSelect currentStatus="practicing" onChange={() => {}} />,
    );
    expect(screen.getByText("練習中")).toBeTruthy();
  });

  it("displays 'マイコンボから外す' for empty status", () => {
    render(
      <MyComboStatusSelect currentStatus="" onChange={() => {}} />,
    );
    expect(screen.getByText("マイコンボから外す")).toBeTruthy();
  });

  it("fires onChange with new status value", async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();
    render(
      <MyComboStatusSelect currentStatus="in_use" onChange={handleChange} />,
    );
    await user.click(screen.getByRole("combobox"));
    await user.click(screen.getByRole("option", { name: "頻度低下" }));
    expect(handleChange).toHaveBeenCalledWith("reduced");
  });

  it("fires onChange with empty string when removing", async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();
    render(
      <MyComboStatusSelect currentStatus="in_use" onChange={handleChange} />,
    );
    await user.click(screen.getByRole("combobox"));
    await user.click(screen.getByRole("option", { name: "マイコンボから外す" }));
    expect(handleChange).toHaveBeenCalledWith("");
  });

  it("is disabled when disabled prop is true", () => {
    render(
      <MyComboStatusSelect currentStatus="in_use" onChange={() => {}} disabled />,
    );
    const trigger = screen.getByRole("combobox");
    expect(trigger.getAttribute("disabled")).not.toBeNull();
  });

  it("is disabled when isLoading prop is true", () => {
    render(
      <MyComboStatusSelect currentStatus="in_use" onChange={() => {}} isLoading />,
    );
    const trigger = screen.getByRole("combobox");
    expect(trigger.getAttribute("disabled")).not.toBeNull();
  });
});
