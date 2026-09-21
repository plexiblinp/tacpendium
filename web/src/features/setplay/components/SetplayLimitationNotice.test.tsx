import { render, screen, fireEvent } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SetplayLimitationNotice } from "./SetplayLimitationNotice";
import { setplayNoticeStorage } from "../setplay-notice-storage";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const BODY = "setplay.limitations.frameOnly";

describe("SetplayLimitationNotice", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });
  afterEach(() => localStorage.clear());

  it("初回は自動表示される", () => {
    render(<SetplayLimitationNotice />);
    expect(screen.getByText(BODY)).toBeTruthy();
  });

  it("フレームデータ由来の制約3項目が表示される(#2)", () => {
    render(<SetplayLimitationNotice />);
    expect(screen.getByText("setplay.limitations.multiHit")).toBeTruthy();
    expect(screen.getByText("setplay.limitations.lingeringProjectile")).toBeTruthy();
    expect(screen.getByText("setplay.limitations.lingeringSetup")).toBeTruthy();
  });

  it("2 回目以降は自動表示されない", () => {
    setplayNoticeStorage.save(true); // 既読を記録
    render(<SetplayLimitationNotice />);
    expect(screen.queryByText(BODY)).toBeNull();
  });

  it("注意アイコンを押すと再表示される", () => {
    setplayNoticeStorage.save(true); // 既読(自動表示なし)
    render(<SetplayLimitationNotice />);
    expect(screen.queryByText(BODY)).toBeNull();
    fireEvent.click(screen.getByLabelText("setplay.limitations.info"));
    expect(screen.getByText(BODY)).toBeTruthy();
  });

  it("表示済みフラグを保持できないと非表示に倒れる(毎回表示にならない)", () => {
    // save が失敗する状況を模す(load=null, save=false)。
    vi.spyOn(setplayNoticeStorage, "load").mockReturnValue(null);
    vi.spyOn(setplayNoticeStorage, "save").mockReturnValue(false);
    render(<SetplayLimitationNotice />);
    expect(screen.queryByText(BODY)).toBeNull();
  });
});
