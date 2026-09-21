import { useTranslation } from "react-i18next";

interface Props {
  lanEnabled: boolean;
  onChange: (enabled: boolean) => void;
  onNext: () => void;
  onPrev: () => void;
}

/**
 * Step05Network は初回起動ウィザードで LAN 共有モードを選ぶ段。
 *
 * ★LAN 有効を選んだときは、その場で警告を出す(DES-005 §5.1「Step 5 の要件」/
 *   CHANGE-185)。DES-002 §8 の「LAN共有モード有効化時には画面上で警告を表示し」は
 *   経路を限定していない——設定画面(SettingsSectionNetwork)とウィザードの両方に要る。
 *   ★穴の形: 本段に警告が無く、Step 7 で「あとにする」と進むと、リスクを一度も
 *   告げられないまま LAN 公開が完了していた(M26-04 の A6 実査・2026-09-11)。
 * ★LAN 無効を選んだときは出さない。公開していない人に「誰でも変更できます」と
 *   告げることになるため(要件 3)。
 */
export default function Step05Network({ lanEnabled, onChange, onNext, onPrev }: Props) {
  const { t } = useTranslation();

  return (
    <div>
      <h2 className="text-xl font-bold mb-4">{t("wizard.step5.title")}</h2>
      <p className="text-gray-600 mb-6">{t("wizard.step5.description")}</p>
      <div className="flex flex-col gap-3 mb-4">
        <button
          type="button"
          onClick={() => onChange(false)}
          className={`px-4 py-3 border rounded text-left ${!lanEnabled ? "border-blue-600 bg-blue-50" : "border-gray-300"}`}
        >
          {t("wizard.step5.lanDisable")}
        </button>
        <button
          type="button"
          onClick={() => onChange(true)}
          className={`px-4 py-3 border rounded text-left ${lanEnabled ? "border-blue-600 bg-blue-50" : "border-gray-300"}`}
        >
          {t("wizard.step5.lanEnable")}
        </button>
      </div>
      <p className={`text-sm text-gray-400 ${lanEnabled ? "mb-4" : "mb-8"}`}>
        {t("wizard.step5.lanHint")}
      </p>
      {/* ★ヒント(上の 1 行)と同じ見え方にしない(要件 4)。設定画面は見出しを
          text-yellow-700 で出しており、同じ強さに揃える。
          ★見出しのキーは設定画面と共有する——同じことを言っており、2 本持つと
          次の改修でずれる(指示書 §2.3-1 / §4.4)。
          ★本文だけは専用キーである: enableConfirmBodyNoPassword は
          「いまはパスワードが設定されていません」と述べるが、本段ではまだ Step 7 が
          来ていないため事実として早い(指示書 §2.3-2)。

          ★★★ただし wizard.step5.lanWarningBody は
          settings.network.enableConfirmBodyNoPassword の 4 段落のうち 3 段落を
          逐語で持っている。意味が違うのはパスワードの 1 段落だけだからである。
          ⇒ **片方の文言を直したら、もう片方も直すこと。** キーを分けた時点で
          機械の網は無く、テストも lint も型検査もずれを赤にしない。

          ★role="alert" を付ける。この枠は利用者が「LAN モードを有効にする」を
          押した*あと*に DOM へ入るため、付けないと読み上げ環境では警告が存在しない
          のと同じになる。設定画面側は AlertDialog(role="alertdialog")が同じ役目を
          担っている——本サブの要件は「告げること」そのものである。 */}
      {lanEnabled && (
        <div
          role="alert"
          className="mb-8 rounded border border-yellow-300 bg-yellow-50 p-4"
          data-testid="wizard-lan-warning"
        >
          <p className="font-semibold text-yellow-700 mb-2">
            {t("settings.network.enableConfirmTitle")}
          </p>
          <p className="text-sm text-gray-700 whitespace-pre-line">
            {t("wizard.step5.lanWarningBody")}
          </p>
        </div>
      )}
      <div className="flex justify-between">
        <button type="button" onClick={onPrev} className="px-4 py-2 text-gray-600 hover:text-gray-800">
          {t("wizard.prev")}
        </button>
        <button type="button" onClick={onNext} className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
          {t("wizard.next")}
        </button>
      </div>
    </div>
  );
}
