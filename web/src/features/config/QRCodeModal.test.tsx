import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import "@/lib/i18n";
import QRCodeModal from "./QRCodeModal";

describe("QRCodeModal", () => {
  it("displays URL and QR code", () => {
    const onClose = vi.fn();
    render(<QRCodeModal url="http://192.168.1.100:47318" onClose={onClose} />);

    expect(screen.getByText("http://192.168.1.100:47318")).toBeTruthy();
    expect(screen.getByRole("dialog")).toBeTruthy();
  });

  it("calls onClose when close button is clicked", () => {
    const onClose = vi.fn();
    render(<QRCodeModal url="http://example.com" onClose={onClose} />);

    fireEvent.click(screen.getByText("閉じる"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose on Escape key", () => {
    const onClose = vi.fn();
    render(<QRCodeModal url="http://example.com" onClose={onClose} />);

    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
