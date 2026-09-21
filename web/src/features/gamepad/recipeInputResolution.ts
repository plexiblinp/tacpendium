// 物理入力（確定したステップ候補）→ レシピのステップ への写像（M21-03・★本サブの中核）。
//
// ★本ファイルは純粋関数だけで構成する。React にも navigator にも触らない。
//
// ★死守契約（契約 F-3 ／ 指示書 §4.1）——本ファイルは **解決規則を 1 つも持たない**。
//   決めるのは「仮想 UI のどの操作に当たるか」までであり（§4.1-5）、操作 → move_code は
//   既存の実装（inputResolutionStage2 / useControllerInput）がそのまま答える。
//   - モーション解析をしない: 方向は StepCandidate.direction の 1 状態だけを見る（§4.1-1）
//   - 段階1 の構造引き・段階2 の解決表・rush_<code>・9 方向 → 3 ゾーンの縮約は
//     すべて resolveDirectionalInput / resolveDirectionalRushInput の内側にある（§4.1-2）
//   - 共通技（DI/DP/投げ）の move_code への写像は resolveSystemButtonStep が持つ（§4.2-2′）
//   - ★OD 技（`<family>_od`）へ写す枝は**書かない**（§4.2-2″・D-352）。family を決める写像は
//     「入力から技を選ぶ」新設規則であり契約 F-3 に抵触する。OD は既存の必殺技パネルで入れる。
//   - ★**旧記述「物理からの確定は M21-06 の領分である」は決着した**（M21-06・2026-08-14）。
//     **答えは「物理からは出せないまま」である。** コマンド技入力モードの確定の契機は
//     攻撃ボタン 1 つであり（§4.1-5）、索引側の OD は `236P+P` のようにボタン部が複数である
//     ため一致しない。⇒ OD は引き続き必殺技パネル（仮想）で入れる。

import type { LogicalButton } from "@/features/combo/components/VirtualController/controllerTypes";
import type { StepInput } from "@/features/combo/components/VirtualController/useControllerInput";
import { resolveSystemButtonStep } from "@/features/combo/components/VirtualController/useControllerInput";
import type { AttackButton, Strength } from "@/features/combo/inputResolution";
import type {
  CommandIndexEntries,
  NumpadDirection,
} from "@/features/combo/inputResolutionStage2";
import {
  resolveDirectionalInput,
  resolveDirectionalRushInput,
} from "@/features/combo/inputResolutionStage2";
import type { Move } from "@/features/moves/types";

import type { StepCandidate } from "./stepDetection";

// ---------------------------------------------------------------------------
// 方向
// ---------------------------------------------------------------------------

/** 論理ボタンの方向 → テンキー方向。`direction_neutral` は 5。 */
export function numpadFromDirection(direction: LogicalButton): NumpadDirection {
  if (direction === "direction_neutral") return 5;
  const digit = Number(direction.slice("direction_".length));
  if (Number.isInteger(digit) && digit >= 1 && digit <= 9) {
    return digit as NumpadDirection;
  }
  // 方向でない論理ボタンが渡ることは無いが、例外を投げずニュートラル扱いにする。
  return 5;
}

/**
 * 後方成分を持つ方向か（1P 側 = 右向き基準なので 4 が後ろ）。
 *
 * ★投げの向きの判定にのみ使う（§9.2-7）。**解決には関与しない。**
 */
export function isBackwardDirection(dir: NumpadDirection): boolean {
  return dir === 1 || dir === 4 || dir === 7;
}

// ---------------------------------------------------------------------------
// ボタン集合 → 「どの操作か」（★move_code は決めない）
// ---------------------------------------------------------------------------

const ATTACK_BUTTON_PARTS: Partial<
  Record<LogicalButton, { strength: Strength; button: AttackButton }>
> = {
  light_punch: { strength: "light", button: "punch" },
  medium_punch: { strength: "medium", button: "punch" },
  heavy_punch: { strength: "heavy", button: "punch" },
  light_kick: { strength: "light", button: "kick" },
  medium_kick: { strength: "medium", button: "kick" },
  heavy_kick: { strength: "heavy", button: "kick" },
};

// 同じ強度の P＋K → 共通技の操作（§4.2-2′）。実機のボタン割当と同じ形である。
// ★ここが決めるのは「共通技エリアのどのボタンに当たるか」までで、move_code は決めない。
const SAME_STRENGTH_PAIR_TO_SYSTEM: Record<Strength, LogicalButton> = {
  heavy: "drive_impact",
  medium: "drive_parry",
  light: "throw",
};

/** 解決できない理由。★読取表示へそのまま出す（黙って捨てない＝§4.3-3）。 */
export type UnresolvableReason =
  /** PP / KK。OD 技は物理から出さない（§4.2-2″・D-352） */
  | "od_not_supported"
  /** 弱中強をまたぐ 2 ボタン */
  | "mixed_strength"
  /** 3 ボタン以上 */
  | "too_many_buttons"
  /** 攻撃 6 ボタンでもマクロでもない組み合わせ */
  | "unknown_combination";

/** ボタン集合が指す「操作」。★move_code はまだ決まっていない。 */
export type PhysicalInputIntent =
  | { kind: "attack"; strength: Strength; button: AttackButton }
  | { kind: "system"; button: LogicalButton }
  | { kind: "unresolvable"; reason: UnresolvableReason };

/**
 * まとまったボタン集合を「仮想 UI のどの操作か」へ写す（指示書 §4.2-2 / §4.2-2′ / §4.2-3）。
 *
 * ★推測しない。近い技を選ばない。判断できない組み合わせは unresolvable を返す。
 */
export function classifyButtons(
  buttons: readonly LogicalButton[],
): PhysicalInputIntent {
  if (buttons.length >= 3) {
    return { kind: "unresolvable", reason: "too_many_buttons" };
  }

  if (buttons.length === 1) {
    const attack = ATTACK_BUTTON_PARTS[buttons[0]];
    if (attack) return { kind: "attack", ...attack };
    // マクロボタン（専用の物理ボタンを持つ機体の DI / DP / 投げ）。
    if (resolveSystemButtonCandidate(buttons[0])) {
      return { kind: "system", button: buttons[0] };
    }
    return { kind: "unresolvable", reason: "unknown_combination" };
  }

  if (buttons.length === 2) {
    const first = ATTACK_BUTTON_PARTS[buttons[0]];
    const second = ATTACK_BUTTON_PARTS[buttons[1]];
    if (!first || !second) {
      return { kind: "unresolvable", reason: "unknown_combination" };
    }
    if (first.button === second.button) {
      // ★PP / KK。SF6 では OD だが、family が決まらないため本サブでは出さない（§4.2-2″）。
      //   強度が同じか違うかに関わらず OD である（弱P＋中P も 中P＋強P も OD）。
      return { kind: "unresolvable", reason: "od_not_supported" };
    }
    if (first.strength !== second.strength) {
      // P＋K だが強度が違う。共通技の操作に当たらない（§4.2-3）。
      return { kind: "unresolvable", reason: "mixed_strength" };
    }
    return {
      kind: "system",
      button: SAME_STRENGTH_PAIR_TO_SYSTEM[first.strength],
    };
  }

  // StepCandidate.buttons は空にならない（M21-02 の as-built）。防御的に倒しておく。
  return { kind: "unresolvable", reason: "unknown_combination" };
}

/** 共通技として扱える論理ボタンか（既存の写像に入口があるか）。 */
function resolveSystemButtonCandidate(button: LogicalButton): boolean {
  return (
    button === "drive_impact" ||
    button === "drive_parry" ||
    button === "throw" ||
    button === "throw_forward" ||
    button === "throw_back"
  );
}

// ---------------------------------------------------------------------------
// ステップ候補 → レシピのステップ（★出口は必ず move_code）
// ---------------------------------------------------------------------------

export interface PhysicalResolutionContext {
  /** 当該キャラの技一覧。 */
  moves: Move[];
  /** 段階2 の解決表（BE が畳み済み）。取得前・失敗時は空でよい。 */
  entries: CommandIndexEntries;
  /** 入力面のラッシュ版トグルの状態。★仮想 UI と同じ状態を渡すこと。 */
  rushOn: boolean;
}

/** 解決できなかった理由（分類できなかった ＋ 技が存在しなかった）。 */
export type UnresolvedReason =
  | UnresolvableReason
  /** 操作までは決まったが、当該キャラの moves に該当技が無い */
  | "move_not_found"
  /**
   * ラッシュ版トグルが ON で、方向が上系（7/8/9 ＝ 空中）だった。
   *
   * ★`move_not_found` と分けている。理由は「そのキャラに技が無い」ではなく
   *   「ラッシュ版は空中に存在しない」であり（`DES-005` §6.4 の空中ラッシュ不可）、
   *   **読取表示の理由文は `CHANGE-111` 経由で設計書へ写る**ため、誤った理由を写さない
   *   （レビュー指摘 中-4）。仮想 UI 側は同条件でボタンが非活性であり、出力は一致している。
   */
  | "rush_not_available_in_air";

export type PhysicalStepResolution =
  | { status: "resolved"; step: StepInput; intent: PhysicalInputIntent }
  | {
      status: "unresolved";
      reason: UnresolvedReason;
      buttons: LogicalButton[];
      direction: NumpadDirection;
    };

/**
 * 確定したステップ候補を、既存の解決経路へ通して 1 ステップにする。
 *
 * ★合流点はここ 1 か所である（指示書 §4.9-3）。2 面（レシピ入力・セットプレイ入力）は
 *   いずれも本関数を通るため、段階2 の解決表やラッシュ版の規則が更新されても片方だけが
 *   取り残されることが起きない。
 */
export function resolvePhysicalStep(
  candidate: StepCandidate,
  ctx: PhysicalResolutionContext,
): PhysicalStepResolution {
  const direction = numpadFromDirection(candidate.direction);
  const buttons = [...candidate.buttons];
  const intent = classifyButtons(candidate.buttons);

  if (intent.kind === "unresolvable") {
    return { status: "unresolved", reason: intent.reason, buttons, direction };
  }

  if (intent.kind === "attack") {
    // ★空中ラッシュは存在しない（`DES-005` §6.4。仮想 UI 側はボタンが非活性）。
    //   既存の resolveDirectionalRushInput も同条件で null を返すが、それをそのまま
    //   `move_not_found` として出すと理由が「そのキャラに技が無い」になって取り違える。
    if (ctx.rushOn && direction >= 7) {
      return {
        status: "unresolved",
        reason: "rush_not_available_in_air",
        buttons,
        direction,
      };
    }
    // ★既存の一様フォールバック（解決表 → 段階1 の構造引き）をそのまま呼ぶ。
    const resolved = ctx.rushOn
      ? resolveDirectionalRushInput(
          ctx.moves,
          ctx.entries,
          direction,
          intent.strength,
          intent.button,
        )
      : resolveDirectionalInput(
          ctx.moves,
          ctx.entries,
          direction,
          intent.strength,
          intent.button,
        );
    if (resolved == null) {
      return {
        status: "unresolved",
        reason: "move_not_found",
        buttons,
        direction,
      };
    }
    // ★move_code は moveId から引き直す。仮想 UI の addResolvedMove と同じ手順にして、
    //   同じ入力が同じ move_code になることを構造で保証するため（§5 (a)）。
    const move = ctx.moves.find((m) => m.id === resolved.moveId);
    if (!move) {
      return {
        status: "unresolved",
        reason: "move_not_found",
        buttons,
        direction,
      };
    }
    return {
      status: "resolved",
      step: { moveId: move.id, moveCode: move.code },
      intent,
    };
  }

  // 共通技。投げだけは向きを持つ（§9.2-7。既定は前投げ、後方入力なら後ろ投げ）。
  const systemButton =
    intent.button === "throw" && isBackwardDirection(direction)
      ? "throw_back"
      : intent.button;
  const step = resolveSystemButtonStep(ctx.moves, systemButton);
  if (step == null) {
    return {
      status: "unresolved",
      reason: "move_not_found",
      buttons,
      direction,
    };
  }
  return {
    status: "resolved",
    step,
    intent: { kind: "system", button: systemButton },
  };
}
