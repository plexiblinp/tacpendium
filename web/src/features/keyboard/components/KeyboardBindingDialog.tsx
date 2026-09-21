// キー登録 UI（M21-05 §4.1・§4.3）。
//
// ★**既定が無いため、この導線を通らないとキーボードでは 1 つも入力できない**（**D-370**）。
//   Gamepad は標準配置の既定があったため未登録でも動いたが、キーボードは動かない。
//
// ★中断できる／やり直せる（Gamepad 側の登録導線と同じ流儀）。全部を埋めないと使えない形にしない。
//
// ★**除外キーは理由つきで拒否する**（§4.3-2）。無反応にしない——利用者は自分の押し方が悪いと
//   思って何度も押す。**「除外」と「未登録」は別の表示にする**（§4.3-3・`E-84`）。

import { useEffect, useRef, useState } from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { EXCLUSION_MESSAGE, keyExclusionReason } from "../excludedKeys";
import {
  cancelConflict,
  confirmOverwrite,
  currentTarget,
  dismissRejection,
  recordKey,
  registrationProgress,
  skipCurrent,
  startRegistration,
  startRetake,
} from "../keyboardRegistration";
import type { KeyboardRegistrationState } from "../keyboardRegistration";
import {
  keyboardTargetKindLabel,
  keyboardTargetLabel,
  keyboardTargetSlug,
} from "../labels";
import {
  KEYBOARD_REGISTRATION_ORDER,
  bindingOf,
  isRequiredTarget,
} from "../types";
import type { KeyboardBindings, KeyboardTarget } from "../types";

interface KeyboardBindingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bindings: KeyboardBindings;
  onSave: (bindings: KeyboardBindings) => boolean;
  onClear: () => void;
  /** 登録中であることを供給層へ伝える（通常の入力を止めるため）。 */
  onCapturingChange: (capturing: boolean) => void;
}

export default function KeyboardBindingDialog({
  open,
  onOpenChange,
  bindings,
  onSave,
  onClear,
  onCapturingChange,
}: KeyboardBindingDialogProps) {
  const [state, setState] = useState<KeyboardRegistrationState | null>(null);
  const [saveFailed, setSaveFailed] = useState(false);

  // ★listener の内側から最新の state を読むための ref。張り替えると押下を取り逃す。
  const stateRef = useRef<KeyboardRegistrationState | null>(null);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // ★開始時の割当も ref から読む。`bindings` を下の効果の依存に入れると、開いている最中に
  //   保存が起きたときに案内が先頭へ戻ってしまう（開始は「開いた瞬間」の 1 回だけでよい）。
  const bindingsRef = useRef(bindings);
  useEffect(() => {
    bindingsRef.current = bindings;
  }, [bindings]);

  useEffect(() => {
    if (!open) {
      setState(null);
      setSaveFailed(false);
      return;
    }
    // ★未割当の最初の対象から再開する。既に登録済みの分をもう一度押させない。
    setState(startRegistration(bindingsRef.current, true));
  }, [open]);

  // ★登録中は通常のキーボード入力を止める（§ provider の `capturing`）。
  useEffect(() => {
    onCapturingChange(open);
    return () => onCapturingChange(false);
  }, [open, onCapturingChange]);

  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      const current = stateRef.current;
      if (current === null) return;
      if (currentTarget(current) === null) return;

      const modifiers = {
        ctrlKey: event.ctrlKey,
        altKey: event.altKey,
        metaKey: event.metaKey,
      };

      // ★登録できるキーなら、**リピートでも**既定動作を止める。止めないと、案内中に
      //   矢印キーや Space を押した瞬間にダイアログの裏でページがスクロールする。
      // ★拒否されるキーでは止めない。**Esc でダイアログを閉じられ、Tab でフォーカスを
      //   移せる状態を保つ**（登録できないキーの既定動作を奪う理由が無い）。
      const registrable = keyExclusionReason(event.code, modifiers) === null;
      if (registrable) event.preventDefault();

      // ★★OS のキーリピートでは記録しない（2026-08-14 是正）。
      //   これが無いと、**押していない次の対象に対して同じキーが記録されようとし、
      //   身に覚えのない二重割当の確認が出る**——「W は『上』に割り当て済みです」。
      //   登録対象を順に登録していく導線であるため、押しっぱなしは実際に起こる。
      //   ★暴走が 2 件目で止まるのは衝突検出が次の記録を止めるためであり、
      //     **ガードが要らないという意味ではない**（利用者には確認ダイアログが見える）。
      //   拒否の表示もリピートで出し直さない。
      if (event.repeat) return;

      setState(recordKey(current, event.code, event.key, modifiers));
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [open]);

  if (state === null) return null;

  const target = currentTarget(state);
  const progress = registrationProgress(state.bindings);
  const pct = Math.round((progress.assigned / progress.total) * 100);

  const handleSave = () => {
    const ok = onSave(state.bindings);
    setSaveFailed(!ok);
    if (ok) onOpenChange(false);
  };

  const handleRetake = (retakeTarget: KeyboardTarget) => {
    setState(startRetake(state.bindings, retakeTarget));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-h-[85vh] overflow-y-auto"
        data-testid="recipe-keyboard-dialog"
      >
        <DialogHeader>
          <DialogTitle>キーボード設定</DialogTitle>
          <DialogDescription>
            案内されたキーを 1 つずつ押してください。キーボードは既定の割当を持たないため、
            ここで登録したキーだけが使えます。途中でやめても、ここまでの内容は保存できます。
          </DialogDescription>
        </DialogHeader>

        {/* 進捗 */}
        <div>
          <p className="mb-1 text-xs text-gray-600" data-testid="recipe-keyboard-progress">
            {progress.assigned} / {progress.total}
          </p>
          <div className="h-2 w-full rounded-full bg-gray-200">
            <div
              className="h-2 rounded-full bg-blue-600 transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>

        {/* ★除外キーの拒否（§4.3-2）。無反応にしない。 */}
        {state.rejection !== null && (
          <div
            className="rounded border border-rose-300 bg-rose-50 p-3 text-sm"
            data-testid="recipe-keyboard-excluded"
          >
            <p className="font-medium text-rose-900">
              「{state.rejection.binding.label}」は登録できません
            </p>
            <p className="mt-1 text-xs text-rose-800">
              {EXCLUSION_MESSAGE[state.rejection.reason]}
            </p>
            <button
              type="button"
              onClick={() => setState(dismissRejection(state))}
              className="mt-2 rounded border border-gray-300 bg-white px-2 py-1 text-xs font-medium hover:bg-gray-100"
              data-testid="recipe-keyboard-excluded-dismiss"
            >
              閉じる
            </button>
          </div>
        )}

        {/* 二重割当 */}
        {state.conflict !== null && (
          <div
            className="rounded border border-amber-300 bg-amber-50 p-3 text-sm"
            data-testid="recipe-keyboard-conflict"
          >
            <p className="font-medium text-amber-900">
              「{state.conflict.binding.label}」は「
              {keyboardTargetLabel(state.conflict.existing)}」に割り当て済みです
            </p>
            <p className="mt-1 text-xs text-amber-800">
              上書きすると「{keyboardTargetLabel(state.conflict.existing)}
              」の割当は外れます。
            </p>
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                onClick={() => setState(confirmOverwrite(state))}
                className="rounded bg-amber-600 px-2 py-1 text-xs font-medium text-white hover:bg-amber-700"
                data-testid="recipe-keyboard-conflict-confirm"
              >
                上書きする
              </button>
              <button
                type="button"
                onClick={() => setState(cancelConflict(state))}
                className="rounded border border-gray-300 bg-white px-2 py-1 text-xs font-medium hover:bg-gray-100"
                data-testid="recipe-keyboard-conflict-cancel"
              >
                やめる
              </button>
            </div>
          </div>
        )}

        {state.lastRetaken !== undefined && (
          <p
            className="rounded border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-800"
            data-testid="recipe-keyboard-retaken-notice"
          >
            「{keyboardTargetLabel(state.lastRetaken)}」を取り直しました。
          </p>
        )}

        {/* 案内 */}
        {target !== null ? (
          <div
            className="rounded border border-gray-200 bg-gray-50 p-4 text-center"
            data-testid={`recipe-keyboard-step-${keyboardTargetSlug(target)}`}
          >
            <p className="text-xs text-gray-500">
              {isRequiredTarget(target) ? "必須" : "任意（使わないなら飛ばせます）"}
              {" ／ "}
              {keyboardTargetKindLabel(target)}
            </p>
            <p className="mt-1 text-lg font-medium">
              {keyboardTargetLabel(target)}
            </p>
            <p className="mt-1 text-xs text-gray-600">
              に割り当てるキーを 1 度押してください
            </p>
            <button
              type="button"
              onClick={() => setState(skipCurrent(state))}
              className="mt-3 rounded border border-gray-300 bg-white px-2 py-1 text-xs font-medium hover:bg-gray-100"
              data-testid="recipe-keyboard-skip"
            >
              このキーは飛ばす
            </button>
          </div>
        ) : (
          <p
            className="rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800"
            data-testid="recipe-keyboard-finished"
          >
            案内は以上です。「保存する」で確定してください。
          </p>
        )}

        {/* 登録済み一覧（取り直しの導線） */}
        <div className="space-y-1">
          <p className="text-xs font-medium text-gray-600">登録した内容</p>
          <ul className="space-y-0.5">
            {KEYBOARD_REGISTRATION_ORDER.map((entry) => {
              const binding = bindingOf(state.bindings, entry);
              return (
                <li
                  key={entry}
                  className="flex items-center justify-between gap-2 text-xs"
                >
                  <span className="text-gray-700">
                    {keyboardTargetLabel(entry)}
                  </span>
                  <span className="flex items-center gap-2">
                    {/* ★「未登録」は除外の表示とは別物である（§4.3-3）。色も文言も分ける。 */}
                    <span
                      className={
                        binding === undefined
                          ? "text-gray-400"
                          : "font-medium text-gray-900"
                      }
                      data-testid={`recipe-keyboard-assigned-${keyboardTargetSlug(entry)}`}
                      data-state={binding === undefined ? "unassigned" : "assigned"}
                    >
                      {binding === undefined ? "未登録" : binding.label}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleRetake(entry)}
                      className="rounded border border-gray-300 bg-white px-1.5 py-0.5 hover:bg-gray-100"
                      data-testid={`recipe-keyboard-retake-${keyboardTargetSlug(entry)}`}
                    >
                      取り直す
                    </button>
                  </span>
                </li>
              );
            })}
          </ul>
        </div>

        {saveFailed && (
          <p
            className="rounded border border-rose-300 bg-rose-50 px-3 py-2 text-xs text-rose-800"
            data-testid="recipe-keyboard-save-failed"
          >
            保存できませんでした（ブラウザの保存領域が使えない可能性があります）。
            この画面を閉じるまでは、いまの設定のまま入力できます。
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleSave}
            className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
            data-testid="recipe-keyboard-save"
          >
            保存する
          </button>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="rounded border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium hover:bg-gray-100"
            data-testid="recipe-keyboard-abort"
          >
            やめる
          </button>
          <button
            type="button"
            onClick={() => {
              onClear();
              onOpenChange(false);
            }}
            className="rounded border border-rose-300 bg-white px-3 py-1.5 text-sm font-medium text-rose-700 hover:bg-rose-50"
            data-testid="recipe-keyboard-reset"
          >
            すべて消す
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
