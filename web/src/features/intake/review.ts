// 他から引っ越しの人レビュー動線の純粋ロジック(M17-04 §4.3)。
// 照合結果 + ユーザーの上書き(候補選択・直接 code 入力)から、
// 未解決件数の算出と、取込 CSV 生成リクエストの組み立てを行う。UI から切り離してテスト可能にする。

import type {
  IntakeBuildCsvRequest,
  IntakeResolvedCombo,
  IntakeResolvedStep,
  IntakeResolveResponse,
} from "./types";

// StepOverrides は「コンボ# : ステップ番号」→ 上書き move_code のマップ。
// 空文字("")は「未解決へ戻す(照合結果も採用しない)」を意味する。
export type StepOverrides = Record<string, string>;

// StepExclusions は「コンボ# : ステップ番号」→ 除外フラグ。
// true のステップは取込 CSV から落とす(技に割当不能な補足行〔適当/.../2KKK 等〕の受け皿)。
// 除外したステップは「未解決」とは数えない(解決 or 除外で先へ進める)。
export type StepExclusions = Record<string, boolean>;

// stepKey は上書き/除外マップのキー。
export function stepKey(comboIndex: number, stepOrder: number): string {
  return `${comboIndex}:${stepOrder}`;
}

// isStepExcluded はステップが除外指定されているか。
export function isStepExcluded(
  comboIndex: number,
  step: IntakeResolvedStep,
  excluded: StepExclusions,
): boolean {
  return excluded[stepKey(comboIndex, step.stepOrder)] === true;
}

// effectiveMoveCode は上書きを優先した実効 move_code を返す(未解決は "")。
export function effectiveMoveCode(
  comboIndex: number,
  step: IntakeResolvedStep,
  overrides: StepOverrides,
): string {
  const key = stepKey(comboIndex, step.stepOrder);
  if (Object.prototype.hasOwnProperty.call(overrides, key)) {
    return overrides[key];
  }
  return step.moveCode;
}

// isStepResolved は実効 move_code が確定しているか。
export function isStepResolved(
  comboIndex: number,
  step: IntakeResolvedStep,
  overrides: StepOverrides,
): boolean {
  return effectiveMoveCode(comboIndex, step, overrides).trim() !== "";
}

// UnresolvedKind は未解決ステップの「なぜ未解決なのか」(M20-07 §4.3-4)。
// - "ambiguous": 候補は見つかったが 1 件に決まらなかった ⇒ 人が選ぶ作業
// - "no-match" : そもそも 1 つも当たらなかった          ⇒ 人が探す作業
export type UnresolvedKind = "ambiguous" | "no-match";

// unresolvedKind は未解決の理由を返す。
//
// ★「解けなかった」と「そもそも候補に挙がらなかった」を同じ顔で出さない(E-84)。
// 同じ「未解決」として出すと、利用者は次に何をすべきか判断できない。
//
// ★解決済みステップに対して呼ばないこと(呼び出し側で未解決を判定してから使う)。
export function unresolvedKind(step: IntakeResolvedStep): UnresolvedKind {
  return step.candidates.length > 0 ? "ambiguous" : "no-match";
}

// unresolvedHint は未解決の理由を人向けの 1 行にする(バッジの title)。
// ★出どころ(トークン列 / 技名 / ハッジの分割)は断定しない。候補は 3 系統から集まるため、
// 「技名が曖昧だった」と書くとトークン由来の候補のときに嘘になる。
export function unresolvedHint(step: IntakeResolvedStep): string {
  return unresolvedKind(step) === "ambiguous"
    ? `候補が ${step.candidates.length} 件あり、1 件に絞れませんでした。下の「候補」から選んでください。`
    : "一致する技が見つかりませんでした。技名を確かめて「すべての技」から選んでください。";
}

// countUnresolved は「解決も除外もされていない」ステップ数を返す(取込へ進むボタンの活性判定)。
// 除外したステップは解決不要として扱う(解決 or 除外で先へ進める)。
export function countUnresolved(
  resp: IntakeResolveResponse | null,
  overrides: StepOverrides,
  excluded: StepExclusions = {},
): number {
  if (!resp) return 0;
  let count = 0;
  for (const combo of resp.combos) {
    for (const step of combo.steps) {
      const settled =
        isStepExcluded(combo.comboIndex, step, excluded) ||
        isStepResolved(combo.comboIndex, step, overrides);
      if (!settled) count++;
    }
  }
  return count;
}

// comboHasExcludedStep はコンボに除外ステップがあるか(レシピが元表記より欠ける警告用)。
export function comboHasExcludedStep(
  combo: IntakeResolvedCombo,
  excluded: StepExclusions,
): boolean {
  return combo.steps.some((s) => isStepExcluded(combo.comboIndex, s, excluded));
}

// buildCsvPayload は解決済みステップから取込 CSV 生成リクエストを組み立てる。
// 未解決ステップ(実効 move_code が空)は除外する(CSV に空 move_code を載せない)。
// memo は元の表記を連結して残す(発信者が突き合わせられるように)。
export function buildCsvPayload(
  characterCode: string,
  resp: IntakeResolveResponse,
  overrides: StepOverrides,
  excluded: StepExclusions = {},
): IntakeBuildCsvRequest {
  const combos = resp.combos.map((combo) => {
    const steps = combo.steps
      // 除外ステップは CSV から落とす(技に割当不能な補足行の受け皿)。
      .filter((step) => !isStepExcluded(combo.comboIndex, step, excluded))
      .map((step) => effectiveMoveCode(combo.comboIndex, step, overrides))
      .filter((code) => code.trim() !== "")
      .map((moveCode) => ({ moveCode }));
    const memo = combo.steps
      .map((s) => s.rawText)
      .filter((t) => t.trim() !== "")
      .join(" > ");
    return { memo, isDraft: false, steps };
  });
  // ステップが 1 つも残らないコンボ(全行未解決)は取込対象から外す。
  const nonEmpty = combos.filter((c) => c.steps.length > 0);
  return { characterCode, combos: nonEmpty };
}
