import { useState } from "react";

import { Input } from "@/components/ui/input";
import {
  MAX_POSITION_MASS,
  massToPercent,
  percentToMass,
} from "@/constants/position";
import { NO_SPINNER, blockNonNumericKeys, clampNumericString } from "../numericInput";

/**
 * マス数「または」パーセントの 1 項目入力(M37-01)。
 *
 * ★★★本部品は区分(始動位置の 7 区分)を*持てない*。これは書き忘れではなく設計である。
 *
 *   `D-731` の不変条件 2 ＝「区分を持つのは始動位置だけであり、運び量を区分へ丸めない」。
 *   運び量に区分の入力を付けないだけでは、次に触る担当を止められない。
 *   ⇒ **付けられない形**にしてある:
 *     - props に区分に関する口が 1 つも無い(下の MassPercentInputProps が全数)
 *     - 本ファイルは POSITION_OPTIONS / POSITION_BANDS / OptionButtonGroup /
 *       positionFromMass / representativeMassOf を import しない
 *   この 2 つを `MassPercentInput.test.tsx`(props 完全一致の型テスト)と
 *   `MassPercentInput.convention.test.ts`(源泉走査)が機械で固定している。
 *
 * ★★【2026-09-13 開発者裁定で作り替えた】着手当初は 2 欄を並べて連動させていたが、
 *   **「入力方式を選んだ後、1 項目だけ入力させる」**形へ変えた。⇒ 本部品は `mode` の
 *   ぶんだけを描く。方式の選択そのものは呼び出し側(ComboEditorBasicFields)が持つ。
 *   ★保存する値は `mode` に依らず**マス数 1 本**である(`D-731`)。⇒ パーセントで
 *     入力しても、外へ出るのはマス数である。
 *
 * ★★丸めの向きは 1 か所に決めてある(指示書 §2.2-4):
 *   - 表示 = massToPercent の結果を小数第 1 位へ四捨五入
 *   - 入力 = 既存の percentToMass(四捨五入 ＋ 0〜160 クランプ)
 *   小数第 1 位なら 0〜160 の 161 値すべてで マス → % → マス が不変である
 *   (誤差上界 0.08 マス)。★整数 % だと 1% = 1.6 マスで往復が壊れる
 *   —— constants/position.test.ts が陽性対照でそれを固定している。
 *
 * ★★【2026-09-13 開発者裁定】値域外は画面に入らないようクランプする。
 *   ⇒ 他の数値欄(消費ゲージ)と同じ `clampNumericString` の流儀に揃えた。
 *   ★これは着手時の判断(「クランプせず zod に拒否させる」)の差し戻しである。
 *   ★zod と VAL-RANGE は残す —— CSV / API から入る経路は画面を通らないため、
 *     防衛線を外すと値域外が DB の CHECK 違反(500)になる。
 */
export interface MassPercentInputProps {
  /** どちらの単位で入力させるか。★保存される値は どちらでもマス数である。 */
  mode: "mass" | "percent";
  /** data-testid。★mode ごとに別 id を振るのは呼び出し側の責務ではなく本部品が行う。 */
  testIdPrefix: string;
  /** マス数(文字列。"" = 未入力)。★保存の正本はこちら 1 本である(D-731)。 */
  value: string;
  /** マス数の変更。★パーセントで入力したときもマス数へ換算して通知する。 */
  onChange: (massText: string) => void;
  ariaLabel: string;
  /**
   * ★現時点ではどの呼び出し元も渡していない。
   *
   * ★★「使われていないから」を理由に props 完全一致テスト(層 1)を緩めないこと。
   *   同テストが固定しているのは**口の集合**であり、口が 1 つ増えれば区分の口も
   *   増やせるようになる。⇒ 消すなら同テストの期待も同じ手番で狭めること。
   */
  disabled?: boolean;
  /**
   * ★M37-05: 入力を終えて欄から離れた合図。**代表値の補完はここを起点に親が行う。**
   *
   * ★★★本部品は区分を 1 つも知らない —— 代表値も区分表も持たず、持ってはならない
   *   (破壊確認 層 2 の MassPercentInput.convention.test.ts が禁じている)。
   *   ⇒ 本口が渡すのは「離れた」という事実だけであり、**何を埋めるかは親が決める**。
   *
   * ★★onChange では埋められない —— 毎キーストロークで発火するため、
   *   利用者が 80 を消して 12 と打ち直そうとした瞬間に 80 が戻り、打ち直せなくなる。
   *   ⇒ 確定の合図が要る。
   *
   * ★★渡さない呼び出し元では何も起きない。⇒ 運び量は本口を渡さないことで
   *   「埋まらない」ことが構造的に保証される(D-731 不変条件 2・指示書 §4.3)。
   */
  onBlur?: () => void;
}

/** パーセント表示の小数桁。★1 桁が往復不変の下限である(上の注記を参照)。 */
const PERCENT_DECIMALS = 1;

/** マス数の文字列から、表示用のパーセント文字列を作る。★表示専用であり保存しない。 */
function percentTextFromMass(massText: string): string {
  if (massText.trim() === "") return "";
  const mass = Number(massText);
  if (!Number.isFinite(mass)) return "";
  const scale = 10 ** PERCENT_DECIMALS;
  return String(Math.round(massToPercent(mass) * scale) / scale);
}

export function MassPercentInput({
  mode,
  testIdPrefix,
  value,
  onChange,
  ariaLabel,
  disabled = false,
  onBlur,
}: MassPercentInputProps) {
  /**
   * 入力途中のパーセント表記。
   *
   * ★★「どのマス数に対する下書きか」を一緒に持つ。⇒ マス数が外(方式の切替・親)から
   *   変わった瞬間に下書きは自動で無効になり、正準表示へ戻る。
   * ★下書きが要るのは "1." のような確定できない途中表記を消さないためだけである。
   */
  const [draft, setDraft] = useState<{ text: string; mass: string } | null>(
    null,
  );

  if (mode === "mass") {
    return (
      <div className="flex items-center gap-2">
        <Input
          type="number"
          className={`max-w-[7rem] ${NO_SPINNER}`}
          min={0}
          max={MAX_POSITION_MASS}
          step={1}
          aria-label={ariaLabel}
          data-testid={testIdPrefix}
          disabled={disabled}
          value={value}
          onChange={(e) =>
            onChange(clampNumericString(e.target.value, 0, MAX_POSITION_MASS))
          }
          onBlur={onBlur}
          onKeyDown={blockNonNumericKeys(false)}
        />
        <span className="text-xs text-slate-500">/ {MAX_POSITION_MASS} マス</span>
      </div>
    );
  }

  const percentText = draft && draft.mass === value ? draft.text : percentTextFromMass(value);

  const handlePercentChange = (raw: string) => {
    const clamped = clampNumericString(raw, 0, 100);
    if (clamped.trim() === "") {
      setDraft({ text: clamped, mass: "" });
      onChange("");
      return;
    }
    const percent = Number(clamped);
    if (!Number.isFinite(percent)) {
      // "1." のような途中表記。★マス数は動かさない(確定していないため)。
      setDraft({ text: clamped, mass: value });
      return;
    }
    const nextMass = String(percentToMass(percent));
    setDraft({ text: clamped, mass: nextMass });
    onChange(nextMass);
  };

  return (
    <div className="flex items-center gap-2">
      <Input
        type="number"
        className={`max-w-[7rem] ${NO_SPINNER}`}
        min={0}
        max={100}
        step={0.1}
        aria-label={ariaLabel}
        data-testid={`${testIdPrefix}-percent`}
        disabled={disabled}
        value={percentText}
        onChange={(e) => handlePercentChange(e.target.value)}
        onBlur={() => {
          // ★下書きを捨ててから親へ知らせる。⇒ 親が値を埋めたとき、
          //   古い下書きが残っていて正準表示を隠す事故を防ぐ。
          setDraft(null);
          onBlur?.();
        }}
        onKeyDown={blockNonNumericKeys(false, true)}
      />
      <span className="text-xs text-slate-500">%</span>
    </div>
  );
}
