import { describe, expect, it } from "vitest";

import {
  rowNeedsConfirmation,
  type ComboPreviewRow,
  type SetupPreviewRow,
} from "./types";

function comboRow(overrides: Partial<ComboPreviewRow>): ComboPreviewRow {
  return {
    rowNumber: 1,
    localId: "c1",
    characterCode: "ryu",
    starterMoveCode: "5lp",
    isDraft: false,
    stepCount: 2,
    duplicate: false,
    warnings: [],
    errors: [],
    importable: true,
    ...overrides,
  };
}

function setupRow(overrides: Partial<SetupPreviewRow>): SetupPreviewRow {
  return {
    rowNumber: 1,
    parentComboLocalId: "c1",
    name: "詐欺飛び",
    stepCount: 1,
    parentResolvable: true,
    warnings: [],
    errors: [],
    importable: true,
    ...overrides,
  };
}

describe("rowNeedsConfirmation", () => {
  it("clean row needs no confirmation", () => {
    expect(rowNeedsConfirmation(comboRow({}))).toBe(false);
    expect(rowNeedsConfirmation(setupRow({}))).toBe(false);
  });

  it("warning row needs confirmation", () => {
    expect(rowNeedsConfirmation(comboRow({ warnings: ["VAL-I07 unknown move"] }))).toBe(
      true,
    );
  });

  it("error row needs confirmation", () => {
    expect(rowNeedsConfirmation(comboRow({ errors: ["VAL-I06 unknown char"] }))).toBe(
      true,
    );
    expect(rowNeedsConfirmation(setupRow({ errors: ["bad recipe"] }))).toBe(true);
  });
});
