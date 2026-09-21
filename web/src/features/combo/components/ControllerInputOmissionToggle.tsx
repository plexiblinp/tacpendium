import { useTranslation } from "react-i18next";

// 全技一覧の「コントローラで入力できる技を省く」トグル(M30-01 / SM-100)。
//
// ★★M24-07(CO-020): 文言は locale が正典。ここは i18n キーだけを持つ。
//
// ★2 面(コンボのレシピ入力・セットプレイのレシピ入力)が同じ形を出す。
//   部品を 1 つにしておかないと、片方だけ文言や既定が変わって静かにずれる。
// ★判定そのものは持たない。省く/省かないの規則は
//   features/combo/hooks/useControllerInputOmission.ts が moveSurfacing から引く。
interface Props {
  checked: boolean;
  onChange: (next: boolean) => void;
  /** 省いた場合に隠れる件数(利用者へ「何件が消えるのか」を先に示す)。0 なら件数を出さない。 */
  omittedCount: number;
  testId?: string;
}

export function ControllerInputOmissionToggle({
  checked,
  onChange,
  omittedCount,
  testId = "recipe-omit-surfaced-toggle",
}: Props) {
  const { t } = useTranslation();
  return (
    <label className="flex flex-wrap items-center gap-2 text-xs text-gray-600">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        data-testid={testId}
      />
      {t("controller.panel.omitSurfacedLabel")}
      {/* ★0 件のときは件数を出さない(情報として無意味である。レビュー 低-13)。 */}
      {omittedCount > 0 && (
        <span className="text-gray-500">
          {t("controller.panel.omitSurfacedCount", { count: omittedCount })}
        </span>
      )}
    </label>
  );
}
