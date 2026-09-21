import { beforeEach, describe, expect, it } from "vitest";

import {
  INTAKE_USER_RULES_STORAGE_KEY,
  intakeUserRulesStorage,
} from "./user-rules-storage";

describe("intakeUserRulesStorage", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("未保存なら null を返す", () => {
    expect(intakeUserRulesStorage.load()).toBeNull();
  });

  it("保存した自由ルールを復元できる(往復)", () => {
    intakeUserRulesStorage.save("屈中P = しゃがみ中P");
    expect(intakeUserRulesStorage.load()).toBe("屈中P = しゃがみ中P");
    expect(localStorage.getItem(INTAKE_USER_RULES_STORAGE_KEY)).not.toBeNull();
  });

  it("remove で削除され null に戻る", () => {
    intakeUserRulesStorage.save("something");
    intakeUserRulesStorage.remove();
    expect(intakeUserRulesStorage.load()).toBeNull();
  });
});
