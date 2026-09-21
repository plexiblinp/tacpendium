import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import "@/lib/i18n";

import SettingsSectionDetails from "./SettingsSectionDetails";
import type { ConfigResponse } from "./types";

function makeConfig(): ConfigResponse {
  return {
    server: { mode: "local", port: 47318 },
    database: { path: "" },
    logging: { level: "info", file: "logs/app.log", maxSizeMb: 10, maxBackups: 5, maxAgeDays: 30 },
    security: { passwordEnabled: false },
    network: { primaryLanIp: "", lanUrl: "" },
    defaults: { characterId: 1, presetId: 1 },
    isInitialized: true,
    restartRequired: false,
  };
}

describe("SettingsSectionDetails", () => {
  it("初回ガイドを見るボタンを表示する", () => {
    render(<SettingsSectionDetails config={makeConfig()} />);
    expect(
      screen.getByRole("button", { name: "初回ガイドを見る" }),
    ).toBeTruthy();
  });

  it("クリックするとオンボーディング内容をその場でダイアログ表示する", async () => {
    const user = userEvent.setup();
    render(<SettingsSectionDetails config={makeConfig()} />);

    await user.click(screen.getByRole("button", { name: "初回ガイドを見る" }));

    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(screen.getByText("はじめてご利用の方へ")).toBeTruthy();
  });
});
