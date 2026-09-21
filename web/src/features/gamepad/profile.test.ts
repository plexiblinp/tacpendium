import { describe, expect, it } from "vitest";

import {
  bindingOf,
  createEmptyProfile,
  deriveBrowserKey,
  isProfileComplete,
  missingRequiredTargets,
  profileKey,
  resolveProfile,
  withBinding,
  withProfile,
  withoutBinding,
  withoutProfile,
} from "./profile";
import {
  createStandardProfile,
  supportsStandardDefault,
} from "./defaultProfile";
import type { GamepadProfile, GamepadProfileStore } from "./types";

const PAD_ID = "Xbox One Game Controller (STANDARD GAMEPAD)";

const known: GamepadProfile = {
  version: 1,
  padId: PAD_ID,
  browserKey: "chromium",
  directions: { up: { kind: "button", index: 12 } },
  buttons: { light_punch: { kind: "button", index: 0 } },
};

const store: GamepadProfileStore = {
  [profileKey("chromium", PAD_ID)]: known,
};

describe("deriveBrowserKey", () => {
  it("Chrome / Firefox / Edge を別の鍵にする", () => {
    expect(
      deriveBrowserKey(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36",
      ),
    ).toBe("chromium");
    expect(
      deriveBrowserKey(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:130.0) Gecko/20100101 Firefox/130.0",
      ),
    ).toBe("firefox");
    expect(
      deriveBrowserKey(
        "Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36 Edg/151.0.0.0",
      ),
    ).toBe("edge");
  });

  it("不明な UA でも例外を投げない", () => {
    expect(deriveBrowserKey("")).toBe("unknown");
  });
});

describe("resolveProfile", () => {
  // (e) 既知の機体
  it("(e) 既知の機体でプロファイルが当たる", () => {
    expect(resolveProfile(store, "chromium", PAD_ID)).toEqual(known);
  });

  // (f) 未知の機体
  it("(f) 未知の機体でも弾かず null を返す(キャリブレーションへ倒す)", () => {
    expect(resolveProfile(store, "chromium", "Unknown Arcade Stick")).toBeNull();
  });

  it("(f') 同じ機体でもブラウザが違えば別プロファイルとして扱う", () => {
    // ★Gamepad.id だけを鍵にしていないことの検査（指示書 §4.2-7）。
    expect(resolveProfile(store, "firefox", PAD_ID)).toBeNull();
  });

  it("store が空・null でも例外を投げない", () => {
    expect(resolveProfile(null, "chromium", PAD_ID)).toBeNull();
    expect(resolveProfile({}, "chromium", PAD_ID)).toBeNull();
  });

  it("版が違うプロファイルは読まない", () => {
    const legacy = {
      [profileKey("chromium", PAD_ID)]: { ...known, version: 2 },
    } as unknown as GamepadProfileStore;

    expect(resolveProfile(legacy, "chromium", PAD_ID)).toBeNull();
  });
});

describe("標準配置の既定との解決順（保存済み → 既定 → null）", () => {
  // 解決順そのものは useGamepadProfiles が担うが、構成要素の性質をここで固定する。
  it("★保存済みは既定より優先される（利用者の登録が既定に上書きされない）", () => {
    const saved = resolveProfile(store, "chromium", PAD_ID);
    const standard = createStandardProfile("chromium", PAD_ID);

    expect(saved).toEqual(known);
    // 既定は 6 ボタン埋まっているが、保存済みは 1 ボタンだけ。取り違えると内容が変わる。
    expect(Object.keys(saved?.buttons ?? {})).toHaveLength(1);
    expect(Object.keys(standard.buttons)).toHaveLength(6);
  });

  it("★既定を当てても未知の機体を弾いていない（保存が無ければ null のまま）", () => {
    expect(resolveProfile(store, "chromium", "Unknown Arcade Stick")).toBeNull();
    expect(supportsStandardDefault("")).toBe(false);
  });
});

describe("読み出し時の形状検証", () => {
  function storeWith(raw: unknown): GamepadProfileStore {
    return { [profileKey("chromium", PAD_ID)]: raw } as GamepadProfileStore;
  }

  it("★既知でないキーは論理ボタンとして上位へ流さない", () => {
    // 破損・手編集・将来版のデータが混ざった場合。
    const resolved = resolveProfile(
      storeWith({
        ...known,
        buttons: {
          light_punch: { kind: "button", index: 0 },
          not_a_real_button: { kind: "button", index: 1 },
          // ★`step_commit` は `LogicalButton` には在るが登録対象ではないため通さない。
          //   M21-01 は「M21-04 が余りボタンへ割り当てる」つもりで予約していたが、
          //   その前提は `D-358` で撤回され、M21-04 は前置き 1 件だけを登録する形になった。
          //   ⇒ 本キーは今後も既知集合に入らない（＝このテストは恒久的に有効である）。
          step_commit: { kind: "button", index: 2 },
        },
      }),
      "chromium",
      PAD_ID,
    );

    expect(Object.keys(resolved?.buttons ?? {})).toEqual(["light_punch"]);
  });

  it("既知でない方向キーも落とす", () => {
    const resolved = resolveProfile(
      storeWith({
        ...known,
        directions: {
          up: { kind: "button", index: 12 },
          diagonal_up_left: { kind: "button", index: 13 },
        },
      }),
      "chromium",
      PAD_ID,
    );

    expect(Object.keys(resolved?.directions ?? {})).toEqual(["up"]);
  });

  it("構造が壊れたバインディングを落とす", () => {
    const resolved = resolveProfile(
      storeWith({
        ...known,
        buttons: {
          light_punch: { kind: "button" }, // index 欠落
          medium_punch: { kind: "button", index: -1 }, // 負の index
          heavy_punch: { kind: "axis", index: 1 }, // sign / threshold 欠落
          light_kick: { kind: "unknown", index: 1 }, // 未知の kind
          medium_kick: { kind: "axis", index: 1, sign: 1, threshold: 0.5 }, // 妥当
        },
      }),
      "chromium",
      PAD_ID,
    );

    expect(Object.keys(resolved?.buttons ?? {})).toEqual(["medium_kick"]);
  });

  it("padId / browserKey が文字列でなければ読まない", () => {
    expect(
      resolveProfile(storeWith({ ...known, padId: 123 }), "chromium", PAD_ID),
    ).toBeNull();
  });

  it("directions / buttons が欠けていても例外を投げず空で返す", () => {
    const resolved = resolveProfile(
      storeWith({ version: 1, padId: PAD_ID, browserKey: "chromium" }),
      "chromium",
      PAD_ID,
    );

    expect(resolved?.directions).toEqual({});
    expect(resolved?.buttons).toEqual({});
  });
});

describe("プロファイルの更新", () => {
  it("withBinding / withoutBinding が非破壊である", () => {
    const added = withBinding(known, "down", { kind: "button", index: 13 });

    expect(bindingOf(added, "down")).toEqual({ kind: "button", index: 13 });
    // 元は変わらない
    expect(bindingOf(known, "down")).toBeUndefined();

    const removed = withoutBinding(added, "down");
    expect(bindingOf(removed, "down")).toBeUndefined();
  });

  it("方向とボタンを取り違えずに書き分ける", () => {
    const withButton = withBinding(known, "heavy_kick", {
      kind: "axis",
      index: 3,
      sign: 1,
      threshold: 0.5,
    });

    expect(withButton.buttons.heavy_kick).toBeTruthy();
    expect(withButton.directions.up).toEqual({ kind: "button", index: 12 });
  });

  it("withProfile が store へ載せる", () => {
    const empty = createEmptyProfile("firefox", PAD_ID);
    const next = withProfile(store, empty);

    expect(Object.keys(next)).toHaveLength(2);
    expect(resolveProfile(next, "firefox", PAD_ID)).toEqual(empty);
  });
});

describe("必須区間の充足", () => {
  it("必須が埋まっていなければ未完了で、残りを列挙できる", () => {
    expect(isProfileComplete(known)).toBe(false);
    // 方向 4 + 攻撃 6 = 10 のうち up と light_punch が埋まっている。
    expect(missingRequiredTargets(known)).toHaveLength(8);
  });

  it("必須がすべて埋まれば完了になる(任意区間は不要)", () => {
    let profile = createEmptyProfile("chromium", PAD_ID);
    const targets = missingRequiredTargets(profile);
    targets.forEach((target, i) => {
      profile = withBinding(profile, target, { kind: "button", index: i });
    });

    expect(isProfileComplete(profile)).toBe(true);
  });
});

describe("withoutProfile（この機体の登録だけを消す）", () => {
  it("当該機体の登録を消す", () => {
    const next = withoutProfile(store, "chromium", PAD_ID);

    expect(resolveProfile(next, "chromium", PAD_ID)).toBeNull();
  });

  it("★他の機体・他のブラウザの登録は消さない", () => {
    const other = createStandardProfile("firefox", "Other Pad");
    const twoProfiles = withProfile(store, other);

    const next = withoutProfile(twoProfiles, "chromium", PAD_ID);

    expect(resolveProfile(next, "chromium", PAD_ID)).toBeNull();
    expect(resolveProfile(next, "firefox", "Other Pad")).toEqual(other);
  });

  it("非破壊である（元の store は変わらない）", () => {
    withoutProfile(store, "chromium", PAD_ID);

    expect(resolveProfile(store, "chromium", PAD_ID)).toEqual(known);
  });

  it("存在しない機体を消そうとしても例外を投げない", () => {
    expect(() => withoutProfile(store, "chromium", "Nope")).not.toThrow();
    expect(() => withoutProfile(null, "chromium", PAD_ID)).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// M21-04: ショートカット前置きの登録（§5 (h) 既存登録の温存）
// ---------------------------------------------------------------------------

describe("ショートカット前置きの登録対象が増えても既存の登録は壊れない（M21-04）", () => {
  it("★前置きを持たない保存済みプロファイルがそのまま読める", () => {
    // M21-01〜03 の時点で保存された形（`shortcut_prefix` のキーが無い）。
    const legacy: GamepadProfile = {
      version: 1,
      padId: PAD_ID,
      browserKey: "chromium",
      directions: { up: { kind: "button", index: 12 } },
      buttons: {
        light_punch: { kind: "button", index: 0 },
        drive_impact: { kind: "button", index: 4 },
      },
    };
    const store = withProfile(null, legacy);

    // ★無効化されず、既存の割当がすべて残る（登録対象が増えたことの影響を受けない）。
    expect(resolveProfile(store, "chromium", PAD_ID)).toEqual(legacy);
  });

  it("★前置きの割当が保存・復元できる（KNOWN_BUTTONS から漏れていると黙って消える）", () => {
    const withPrefix = withBinding(
      createEmptyProfile("chromium", PAD_ID),
      "shortcut_prefix",
      { kind: "button", index: 9 },
    );
    const store = withProfile(null, withPrefix);

    expect(
      bindingOf(resolveProfile(store, "chromium", PAD_ID)!, "shortcut_prefix"),
    ).toEqual({ kind: "button", index: 9 });
  });

  it("★前置きは必須対象ではない（登録しなくても『実用に足る』判定は変わらない）", () => {
    const standard = createStandardProfile("chromium", PAD_ID);

    // 標準既定は方向 4 ＋ 攻撃 6 を埋める。前置きは入っていない。
    expect(bindingOf(standard, "shortcut_prefix")).toBeUndefined();
    expect(isProfileComplete(standard)).toBe(true);
    expect(missingRequiredTargets(standard)).toEqual([]);
  });
});
