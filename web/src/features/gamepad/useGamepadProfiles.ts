// 保存済みプロファイルの読込・保存と、現在の機体に対する解決（M21-01 §4.2-7・§4.5）。
//
// ★browserKey の導出（navigator.userAgent）はここで行い、純粋関数層へは引数で渡す。
//   純粋関数側を navigator 非依存に保つため（指示書 §4.2-2）。

import { useCallback, useMemo, useState } from "react";

import {
  createStandardProfile,
  supportsStandardDefault,
} from "./defaultProfile";
import {
  loadProfileStore,
  saveProfileStore,
} from "./gamepad-storage";
import {
  deriveBrowserKey,
  resolveProfile,
  withProfile,
  withoutProfile,
} from "./profile";
import type { GamepadProfile, GamepadProfileStore } from "./types";

/**
 * プロファイルの出どころ。
 * - `saved`   利用者が登録したもの
 * - `default` 標準配置の既定を仮適用中（登録なしで使えている状態）
 * - `none`    どちらも無い＝キャリブレーションが要る
 */
export type ProfileSource = "saved" | "default" | "none";

export interface UseGamepadProfilesResult {
  browserKey: string;
  /** 当該機体のプロファイル。未登録なら null（★弾かずキャリブレーションへ倒す）。 */
  profile: GamepadProfile | null;
  /** profile の出どころ。バッジの表示分けに使う。 */
  source: ProfileSource;
  /**
   * 保存する。戻り値は成否（失敗しても画面は壊さない）。
   * ★失敗の通知は呼び出し側（ダイアログ）が戻り値から行う。ここでは状態を持たない。
   */
  saveProfile: (profile: GamepadProfile) => boolean;
  /**
   * 当該機体の登録を消す（標準配置の既定、または未設定へ戻る）。
   * ★他の機体の登録は消さない。
   */
  removeProfile: () => boolean;
}

function currentUserAgent(): string {
  if (typeof navigator === "undefined") return "";
  return navigator.userAgent ?? "";
}

/**
 * @param padId 現在使用中の Gamepad.id。未接続なら null。
 */
/**
 * @param padId   現在使用中の Gamepad.id。未接続なら null。
 * @param mapping 現在使用中の Gamepad.mapping。標準配置の既定を当てるかの判定にだけ使う
 *                （★normalize 側は mapping を読まない。標準は速い経路であって要件ではない）。
 */
export function useGamepadProfiles(
  padId: string | null,
  mapping: string | null,
): UseGamepadProfilesResult {
  const [store, setStore] = useState<GamepadProfileStore>(() =>
    loadProfileStore(),
  );

  const browserKey = useMemo(() => deriveBrowserKey(currentUserAgent()), []);

  // ★解決順: 保存済み → 標準配置の既定 → null（キャリブレーションへ倒す）。
  const { profile, source } = useMemo((): {
    profile: GamepadProfile | null;
    source: ProfileSource;
  } => {
    if (padId === null) return { profile: null, source: "none" };

    const saved = resolveProfile(store, browserKey, padId);
    if (saved !== null) return { profile: saved, source: "saved" };

    if (mapping !== null && supportsStandardDefault(mapping)) {
      return {
        profile: createStandardProfile(browserKey, padId),
        source: "default",
      };
    }

    return { profile: null, source: "none" };
  }, [store, browserKey, padId, mapping]);

  const saveProfile = useCallback(
    (next: GamepadProfile): boolean => {
      const nextStore = withProfile(store, next);
      setStore(nextStore);
      // ★保存に失敗しても state は更新済みなので、そのセッション中は使える。
      return saveProfileStore(nextStore);
    },
    [store],
  );

  const removeProfile = useCallback((): boolean => {
    if (padId === null) return false;
    const nextStore = withoutProfile(store, browserKey, padId);
    setStore(nextStore);
    return saveProfileStore(nextStore);
  }, [store, browserKey, padId]);

  return { browserKey, profile, source, saveProfile, removeProfile };
}
