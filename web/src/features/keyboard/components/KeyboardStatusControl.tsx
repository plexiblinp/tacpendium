// キーボード入力の状態表示と登録導線の入口（M21-05 §4.1-3・§4.1-4）。
//
// ★**入力面に立った時点で「登録が要る」ことが分かること**が本コンポーネントの要件である。
//   Gamepad は標準配置の既定があったため未登録でも動いたが、**キーボードは登録しないと 1 つも
//   入力できない**（**D-370**）。⇒ この違いを利用者へ出す。
//
// ★**これは失敗ではなく状態として出す**（§4.1-4）。`role="alert"` を使わず、エラー色にもしない
//   ——`DES-005` §6.5 の「割り当てられない機体がある前提」と同じ流儀である。
//   ★同じ理由で「対応キーボード一覧」も作らない（§4.1-5）。
//
// ★**「未登録」と「除外」を混ぜない**（§4.3-3・`E-84`）。除外（＝そのキーは使えない）は
//   登録ダイアログの中でだけ出る。ここに出るのは「まだ登録していない」だけである。

import { useCallback, useId, useState } from "react";

import { usePhysicalInputContext } from "@/features/physical-input/PhysicalInputProvider";

import KeyboardBindingDialog from "./KeyboardBindingDialog";

export default function KeyboardStatusControl() {
  const [open, setOpen] = useState(false);
  const { available, keyboard } = usePhysicalInputContext();

  // ★入力面ごとに安定した id。**登録中の申告は面ごとに行う**——単一 boolean だと、
  //   後からマウントされた面が「開いていない」を書き込んで抑止を解いてしまう。
  const captureId = useId();
  const { setCapturing } = keyboard;
  const handleCapturingChange = useCallback(
    (capturing: boolean) => setCapturing(captureId, capturing),
    [setCapturing, captureId],
  );

  if (!available) return null;

  const registered = keyboard.registered;

  return (
    <>
      <span
        className={
          registered
            ? "rounded border border-gray-300 bg-gray-50 px-1.5 py-0.5 text-xs text-gray-700"
            : "rounded border border-gray-300 bg-gray-50 px-1.5 py-0.5 text-xs text-gray-600"
        }
        data-testid="recipe-keyboard-status"
        data-state={registered ? "ready" : "unregistered"}
      >
        {registered
          ? "キーボード入力: 使えます"
          : "キーボード入力: 登録すると使えます"}
      </span>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded border border-gray-300 bg-white px-1.5 py-0.5 text-xs font-medium hover:bg-gray-100"
        data-testid="recipe-keyboard-configure"
      >
        {registered ? "キーボード設定" : "キーを登録する"}
      </button>
      <KeyboardBindingDialog
        open={open}
        onOpenChange={setOpen}
        bindings={keyboard.bindings}
        onSave={keyboard.saveBindings}
        onClear={keyboard.clearBindings}
        onCapturingChange={handleCapturingChange}
      />
    </>
  );
}
