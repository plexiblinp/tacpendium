import { useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import PasswordSetForm from "@/features/auth/PasswordSetForm";

interface Props {
  onNext: () => void;
  onPrev: () => void;
}

/** 段の中の表示。form = パスワードを決める / consent = 決めずに進むことへの同意。 */
type View = "form" | "consent";

/**
 * Step07Password は初回起動ウィザードでパスワードを決める段。
 *
 * ★LAN 共有を有効にしたときだけ出す(DES-005 §5.1 の「任意、LAN共有有効時のみ表示」)。
 * ★設定せずに進める(必須化しない＝D-396)。「あとにする」で次へ進む。
 * ★入力欄は表示を既定とする(D-396)。詳細は PasswordSetForm を参照。
 *
 * ★★「あとにする」には明示的な同意が要る(DES-005 §5.1「Step 7 の要件」6 /
 *   DES-002 §8「同意は明示的な操作で得る(チェックボックス等。押すだけで通さない)」)。
 *   ⇒ 段の中を 2 ビューにして、設定画面の LanModeConfirmDialog が warn → consent で
 *   やっていることを、同じ不変条件のままインラインで持つ。
 * ★i18n のブロック名はコンポーネント名と 1 つずれている——wizard.step7.* は
 *   「設定完了」(Step07Complete)のものであり、本コンポーネントは 1 つも持たない。
 *   ⇒ 本段のキーは wizard.password.* に置いてある。wizard.step7 へ足さないこと。
 *   ★ダイアログを入れ子にしない——ウィザードは Step 5 → Step 7 で同じ 3 段を
 *   既に展開しており、入れると setPassword 段が二重になる(方式 (i) 不採用＝D-826)。
 * ★★パスワードを設定して進む経路(onDone)には同意を要求しない。要求すると
 *   同意が儀式になって読まれなくなる(指示書 §2.2-3)。
 * ★★同意は詰みを作らないため D-396 に抵触しない——同裁定が消したのは
 *   「パスワードを忘れると LAN 共有が二度と使えない」詰みであり、
 *   チェックは忘れようがなく、いつでも入れ直せる。
 */
export default function Step07Password({ onNext, onPrev }: Props) {
  const { t } = useTranslation();
  const [view, setView] = useState<View>("form");
  const [consented, setConsented] = useState(false);

  // ★同意ビューへ入るたびにチェックを外す(LanModeConfirmDialog の「開き直すたびに
  //   setConsented(false) する useEffect」と同じ扱い。★行番号では指さない——
  //   参照先が 1 行動いた瞬間に静かにずれるため)。
  // ★段をまたいだリセットは unmount が担う——WizardPage は {step === 7 && lanEnabled}
  //   で条件描画しており、戻るボタンで段を離れると本コンポーネントごと消える。
  //   ⇒ ここでの明示リセットは、その暗黙の挙動だけに頼らないための二重化である。
  const openConsent = () => {
    setConsented(false);
    setView("consent");
  };

  if (view === "consent") {
    return (
      <div>
        <h2 className="text-xl font-semibold mb-4 text-yellow-700">
          {t("wizard.password.consentTitle")}
        </h2>

        {/* ★本文とチェック文言は設定画面とキーを共有する。同じ意味のものを 2 本
            持つと、次の改修でどちらかだけが直ってずれる(指示書 §2.3-1)。 */}
        <p className="text-gray-700 mb-4">{t("settings.network.consentBody")}</p>

        <label className="flex items-center gap-2 text-sm mb-6">
          <Checkbox
            checked={consented}
            onCheckedChange={(v) => setConsented(v === true)}
            data-testid="wizard-lan-consent-check"
          />
          {t("settings.network.consentCheck")}
        </label>

        <div className="flex gap-2">
          {/* ★チェックを入れるまで押せない。これが「明示的な同意」の実体である
              (LanModeConfirmDialog の lan-consent-enable と同じ)。 */}
          <Button
            disabled={!consented}
            onClick={onNext}
            data-testid="wizard-lan-consent-next"
          >
            {t("wizard.password.consentAction")}
          </Button>
          {/* ★段の「戻る」はここでは出さない。同じ名前のボタンが 2 つ並ぶと
              役割名で一意に指せなくなる。段へ戻るには一度この段の form へ戻る。 */}
          <Button variant="outline" onClick={() => setView("form")}>
            {t("wizard.prev")}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">{t("auth.setPassword.title")}</h2>

      <PasswordSetForm onDone={onNext} onSkip={openConsent} />

      <div className="mt-6">
        <button
          type="button"
          onClick={onPrev}
          className="px-4 py-2 border border-gray-300 rounded text-sm hover:bg-gray-50"
        >
          {t("wizard.prev")}
        </button>
      </div>
    </div>
  );
}
