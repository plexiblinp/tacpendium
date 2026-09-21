// プロファイルの解決（M21-01 §4.2-7・§4.2-8）。すべて純粋関数。
//
// ★解決鍵を Gamepad.id だけにしない。同じ機体でもブラウザによって Gamepad.id の文字列が
//   異なるため（指示書 §4.2-7）。⇒ 「機体 ＋ ブラウザ」で解決する。
// ★プロファイルが無い機体でも弾かない。未知の機体はキャリブレーションへ倒す（§4.2-8）。

import type {
  CalibrationButton,
  DirectionCardinal,
  GamepadProfile,
  GamepadProfileStore,
  PhysicalBinding,
} from "./types";
import {
  ACTION_BUTTONS,
  ATTACK_BUTTONS,
  DIRECTION_CARDINALS,
  OPTIONAL_BUTTONS,
} from "./types";
import { REQUIRED_TARGETS } from "./logicalButtons";
import { isDirectionCardinal } from "./logicalButtons";

/**
 * ブラウザ識別子を User-Agent 文字列から導出する。
 *
 * ★引数で UA を受け取る純粋関数である（navigator に触らない）。呼び出し側が渡す。
 * 目的は「ブラウザが変わったら別プロファイルとして扱う」ことだけなので、厳密なブラウザ判定は
 * 要らない。バージョン差で対応表が変わることは無いため、エンジン系統の粒度で十分である。
 */
export function deriveBrowserKey(userAgent: string): string {
  const ua = typeof userAgent === "string" ? userAgent : "";
  if (/\bFirefox\/|\bGecko\/\d/.test(ua)) return "firefox";
  if (/\bEdg\//.test(ua)) return "edge";
  // Chrome 判定は Edg / OPR を除いた後に行う（いずれも Chrome を名乗るため）。
  if (/\bOPR\//.test(ua)) return "opera";
  if (/\bChrome\/|\bChromium\//.test(ua)) return "chromium";
  if (/\bSafari\//.test(ua)) return "safari";
  return "unknown";
}

/** localStorage 上のプロファイル鍵。 */
export function profileKey(browserKey: string, padId: string): string {
  return `${browserKey}::${padId}`;
}

// ★`ACTION_BUTTONS`（M21-04 の前置き）を落とさないこと。ここに無いキーは sanitizeBindings が
//   **黙って捨てる**ため、足し忘れると「登録できたのに次回起動で消えている」という形で壊れる。
const KNOWN_BUTTONS: readonly string[] = [
  ...ATTACK_BUTTONS,
  ...OPTIONAL_BUTTONS,
  ...ACTION_BUTTONS,
];

/** 1 件のバインディングが構造として妥当か。 */
function isValidBinding(value: unknown): value is PhysicalBinding {
  if (!value || typeof value !== "object") return false;
  const b = value as Record<string, unknown>;
  if (typeof b.index !== "number" || !Number.isInteger(b.index) || b.index < 0) {
    return false;
  }
  if (b.kind === "button") return true;
  if (b.kind === "axis") {
    return (
      (b.sign === 1 || b.sign === -1) &&
      typeof b.threshold === "number" &&
      Number.isFinite(b.threshold)
    );
  }
  return false;
}

/**
 * 既知のキーかつ妥当なバインディングだけを残す。
 *
 * ★破損・手編集・将来版のデータが混ざったとき、`LogicalButton` に存在しない文字列が
 *   論理ボタンとして上位へ流れるのを止める（例外を出さず静かに壊れる形を作らないため）。
 */
function sanitizeBindings<K extends string>(
  raw: unknown,
  allowed: readonly string[],
): Partial<Record<K, PhysicalBinding>> {
  const result: Partial<Record<K, PhysicalBinding>> = {};
  if (!raw || typeof raw !== "object") return result;
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!allowed.includes(key)) continue;
    if (!isValidBinding(value)) continue;
    result[key as K] = value;
  }
  return result;
}

/**
 * 保存済みプロファイルから当該機体のものを引く。
 *
 * ★見つからなければ null を返す（例外を投げない・弾かない）。呼び出し側はキャリブレーションへ倒す。
 * ★読み出し時に形状を検証し、既知のキー・妥当なバインディングだけを通す。
 */
export function resolveProfile(
  store: GamepadProfileStore | null,
  browserKey: string,
  padId: string,
): GamepadProfile | null {
  if (!store || typeof store !== "object") return null;
  const found = store[profileKey(browserKey, padId)];
  if (!found || typeof found !== "object") return null;
  // 版が違うものは読まない（キーバージョニングとは別に、構造変更へ備える）。
  if (found.version !== 1) return null;
  if (typeof found.padId !== "string" || typeof found.browserKey !== "string") {
    return null;
  }

  const directions = sanitizeBindings<DirectionCardinal>(
    found.directions,
    DIRECTION_CARDINALS,
  );
  const buttons = sanitizeBindings<CalibrationButton>(
    found.buttons,
    KNOWN_BUTTONS,
  );

  return {
    version: 1,
    padId: found.padId,
    browserKey: found.browserKey,
    directions,
    buttons,
  };
}

/** 空のプロファイルを作る（キャリブレーション開始時）。 */
export function createEmptyProfile(
  browserKey: string,
  padId: string,
): GamepadProfile {
  return {
    version: 1,
    padId,
    browserKey,
    directions: {},
    buttons: {},
  };
}

/** プロファイルへ 1 件の割当を書き込んだ新しいプロファイルを返す（非破壊）。 */
export function withBinding(
  profile: GamepadProfile,
  target: DirectionCardinal | CalibrationButton,
  binding: PhysicalBinding,
): GamepadProfile {
  if (isDirectionCardinal(target)) {
    return {
      ...profile,
      directions: { ...profile.directions, [target]: binding },
    };
  }
  return { ...profile, buttons: { ...profile.buttons, [target]: binding } };
}

/** プロファイルから 1 件の割当を外した新しいプロファイルを返す（非破壊）。 */
export function withoutBinding(
  profile: GamepadProfile,
  target: DirectionCardinal | CalibrationButton,
): GamepadProfile {
  if (isDirectionCardinal(target)) {
    const directions = { ...profile.directions };
    delete directions[target];
    return { ...profile, directions };
  }
  const buttons = { ...profile.buttons };
  delete buttons[target];
  return { ...profile, buttons };
}

/** 当該対象に割り当てられているバインディングを引く。 */
export function bindingOf(
  profile: GamepadProfile,
  target: DirectionCardinal | CalibrationButton,
): PhysicalBinding | undefined {
  return isDirectionCardinal(target)
    ? profile.directions?.[target]
    : profile.buttons?.[target];
}

/**
 * 必須区間（方向 4 ＋ 攻撃 6）がすべて埋まっているか。
 * ★埋まっていなくても使える。これは「実用に足るか」の目安であって、利用の可否ではない
 * （指示書 §4.3-2「全部を埋めないと使えない形にしない」）。
 */
export function isProfileComplete(profile: GamepadProfile): boolean {
  return REQUIRED_TARGETS.every(
    (target) => bindingOf(profile, target) !== undefined,
  );
}

/** 未割当の必須対象を返す（UI の「残り」表示用）。 */
export function missingRequiredTargets(
  profile: GamepadProfile,
): (DirectionCardinal | CalibrationButton)[] {
  return REQUIRED_TARGETS.filter(
    (target) => bindingOf(profile, target) === undefined,
  );
}

/**
 * 当該機体のプロファイルを store から外した新しい store を返す（非破壊）。
 * ★他の機体の登録は消さない。
 */
export function withoutProfile(
  store: GamepadProfileStore | null,
  browserKey: string,
  padId: string,
): GamepadProfileStore {
  const next = { ...(store ?? {}) };
  delete next[profileKey(browserKey, padId)];
  return next;
}

/** プロファイルを store へ載せた新しい store を返す（非破壊）。 */
export function withProfile(
  store: GamepadProfileStore | null,
  profile: GamepadProfile,
): GamepadProfileStore {
  return {
    ...(store ?? {}),
    [profileKey(profile.browserKey, profile.padId)]: profile,
  };
}
