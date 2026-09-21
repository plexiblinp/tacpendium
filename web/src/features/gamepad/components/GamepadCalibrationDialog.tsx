// キャリブレーション／リマップ UI（M21-01 §4.3）。
//
// ★本サブの load-bearing な部分である。開発者はアケコンを所有せず Firefox も未計測であるため、
//   我々が持っていない機体で動くための唯一の手段がこれである（D-328）。
// ★中断できる／やり直せる（§4.3-2・§4.3-3）。全部を埋めないと使えない形にしない。

import { useEffect, useRef, useState } from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import {
  abortCalibration,
  calibrationProgress,
  cancelConflict,
  confirmOverwrite,
  currentTarget,
  describeBinding,
  recordBinding,
  skipCurrent,
  startCalibration,
  startPartialCalibration,
  startRetake,
  assignedTargets,
} from "../calibration";
import type { CalibrationState } from "../calibration";
import {
  calibrationTargetLabel,
  calibrationTargetSlug,
  isRequiredTarget,
} from "../logicalButtons";
import { detectPressedBinding } from "../normalize";
import { OPTIONAL_TARGETS } from "../logicalButtons";
import type { GamepadConnectionStatus } from "../useGamepadPolling";
import type { ProfileSource } from "../useGamepadProfiles";
import { bindingOf, createEmptyProfile } from "../profile";
import type {
  CalibrationTarget,
  GamepadProfile,
  GamepadSnapshot,
} from "../types";
import { DEFAULT_AXIS_THRESHOLD } from "../types";

interface GamepadCalibrationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 接続状態。★idle（正常な初期状態）と disconnected（障害）を出し分けるために要る。 */
  status: GamepadConnectionStatus;
  /** ポーリング中のスナップショット。未接続なら null。 */
  snapshot: GamepadSnapshot | null;
  /** 各軸の静止値。押下検出を「静止値からの変位」で行うために要る。 */
  axesBaseline: readonly number[] | null;
  padId: string | null;
  browserKey: string;
  /** 既存プロファイル。未登録なら null。 */
  profile: GamepadProfile | null;
  /** profile の出どころ。既定を仮適用中なら「マクロだけ」から始める。 */
  source: ProfileSource;
  onSave: (profile: GamepadProfile) => boolean;
  /** この機体の設定を初期化する（標準配置の既定、または未設定へ戻る）。 */
  onRemove: () => boolean;
}

export default function GamepadCalibrationDialog({
  open,
  onOpenChange,
  status,
  snapshot,
  axesBaseline,
  padId,
  browserKey,
  profile,
  source,
  onSave,
  onRemove,
}: GamepadCalibrationDialogProps) {
  const [state, setState] = useState<CalibrationState | null>(null);
  const [saveFailed, setSaveFailed] = useState(false);
  // 1 回の押下で複数の対象を埋めてしまわないよう、記録後は一旦離すまで受け付けない。
  const awaitingReleaseRef = useRef(false);

  // ★保存すると store → profile が変わるため、profile を deps に入れるとキャリブレーション状態が
  //   保存のたびにリセットされる（取り直し中なら通常モードへ戻ってしまう）。初期化に使う値は
  //   ref 経由で読み、deps は「開いたか」「機体が変わったか」だけにする。
  const profileRef = useRef(profile);
  profileRef.current = profile;
  const sourceRef = useRef(source);
  sourceRef.current = source;

  // ダイアログを開いたときに、既存プロファイルの続きから再開する（§4.3-2）。
  useEffect(() => {
    if (!open) {
      setState(null);
      setSaveFailed(false);
      awaitingReleaseRef.current = false;
      return;
    }
    if (padId === null) return;
    const base = profileRef.current ?? createEmptyProfile(browserKey, padId);
    // ★標準配置の既定が当たっている機体は、必須 10 件が既に埋まっている。
    //   その状態で全件を案内すると途中の番号から始まって分かりにくいため、
    //   任意区間だけの部分キャリブレーションから始める（全件やり直す導線は下にある）。
    // ★任意区間は M21-04 でマクロ 3 件 ＋ ショートカット前置き 1 件の計 4 件になった
    //   （`OPTIONAL_TARGETS` を見ており、ここに件数は直書きしていない）。
    setState(
      sourceRef.current === "default"
        ? startPartialCalibration(base, OPTIONAL_TARGETS)
        : startCalibration(base, true),
    );
    awaitingReleaseRef.current = true;
  }, [open, padId, browserKey]);

  // ライブのスナップショットから押下を拾う。
  useEffect(() => {
    if (!open || state === null || snapshot === null) return;
    if (state.conflict !== null) return;
    if (currentTarget(state) === null) return;

    const pressed = detectPressedBinding(
      snapshot,
      DEFAULT_AXIS_THRESHOLD,
      axesBaseline,
    );

    if (pressed === null) {
      awaitingReleaseRef.current = false;
      return;
    }
    if (awaitingReleaseRef.current) return;

    awaitingReleaseRef.current = true;
    setState((prev) => (prev === null ? prev : recordBinding(prev, pressed)));
  }, [open, snapshot, state]);

  if (state === null) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent data-testid="recipe-gamepad-dialog">
          <DialogHeader>
            <DialogTitle>コントローラ設定</DialogTitle>
            {/* ★idle（正常な初期状態）と disconnected（障害）を同じ文言にしない（指示書 §4.4-4）。
                バッジ側と同じ区別をここでも保つ。 */}
            <DialogDescription data-status={status}>
              {status === "disconnected"
                ? "コントローラを認識していません。接続を確認してください。"
                : "まだコントローラの入力を受け取っていません。コントローラのボタンをどれか 1 度押してください。"}
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    );
  }

  const target = currentTarget(state);
  const progress = calibrationProgress(state);
  const pct = Math.round((progress.current / progress.total) * 100);
  const assigned = assignedTargets(state.profile);

  const handleSave = () => {
    const ok = onSave(abortCalibration(state));
    setSaveFailed(!ok);
    if (ok) onOpenChange(false);
  };

  const handleRetake = (retakeTarget: CalibrationTarget) => {
    setState(startRetake(state.profile, retakeTarget));
    awaitingReleaseRef.current = true;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto" data-testid="recipe-gamepad-dialog">
        <DialogHeader>
          <DialogTitle>コントローラ設定</DialogTitle>
          <DialogDescription>
            案内された入力を 1 度ずつ押してください。途中でやめても、ここまでの内容は保存できます。
          </DialogDescription>
        </DialogHeader>

        {/* 進捗 */}
        <div>
          <p className="mb-1 text-xs text-gray-600">
            {progress.current} / {progress.total}
            {progress.requiredRemaining > 0 && (
              <span className="ml-2 text-amber-600">
                必須の残り {progress.requiredRemaining} 件
              </span>
            )}
          </p>
          <div className="h-2 w-full rounded-full bg-gray-200">
            <div
              className="h-2 rounded-full bg-blue-600 transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>

        {/* 二重割当の警告（§4.3-7）*/}
        {state.conflict !== null && (
          <div
            className="rounded border border-amber-300 bg-amber-50 p-3 text-sm"
            data-testid="recipe-gamepad-conflict"
          >
            <p className="font-medium text-amber-900">
              その入力は「{calibrationTargetLabel(state.conflict.existing)}」に割り当て済みです
            </p>
            <p className="mt-1 text-xs text-amber-800">
              上書きすると「{calibrationTargetLabel(state.conflict.existing)}」の割当は外れます。
            </p>
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                onClick={() => setState(confirmOverwrite(state))}
                className="rounded bg-amber-600 px-2 py-1 text-xs font-medium text-white hover:bg-amber-700"
                data-testid="recipe-gamepad-conflict-confirm"
              >
                上書きする
              </button>
              <button
                type="button"
                onClick={() => setState(cancelConflict(state))}
                className="rounded border border-gray-300 bg-white px-2 py-1 text-xs font-medium hover:bg-gray-100"
                data-testid="recipe-gamepad-conflict-cancel"
              >
                やめる
              </button>
            </div>
          </div>
        )}

        {/* ★取り直したあと案内へ戻ったときの通知。何を直したかが分かるようにする。 */}
        {state.lastRetaken !== undefined && (
          <p
            className="rounded border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-800"
            data-testid="recipe-gamepad-retaken-notice"
          >
            「{calibrationTargetLabel(state.lastRetaken)}」を取り直しました。
          </p>
        )}

        {/* 案内 */}
        {target !== null ? (
          <div
            className="rounded border border-gray-200 bg-gray-50 p-4 text-center"
            data-testid={`recipe-gamepad-step-${calibrationTargetSlug(target)}`}
          >
            <p className="text-xs text-gray-500">
              {isRequiredTarget(target) ? "必須" : "任意（無い機体は飛ばしてください）"}
            </p>
            <p className="mt-1 text-lg font-medium">
              {calibrationTargetLabel(target)}
            </p>
            <p className="mt-1 text-xs text-gray-600">
              に対応する入力を 1 度押してください
            </p>
            <button
              type="button"
              onClick={() => {
                setState(skipCurrent(state));
                awaitingReleaseRef.current = true;
              }}
              className="mt-3 rounded border border-gray-300 bg-white px-2 py-1 text-xs font-medium hover:bg-gray-100"
              data-testid="recipe-gamepad-skip"
            >
              この入力を飛ばす
            </button>
          </div>
        ) : (
          <p
            className="rounded border border-emerald-200 bg-emerald-50 p-4 text-center text-sm text-emerald-800"
            data-testid="recipe-gamepad-finished"
          >
            {/* ★1 件取り直しただけで「すべての案内が終わりました」と出るのは不自然であるため
                mode で出し分ける（2026-08-13 実機確認の指摘）。 */}
            {state.mode === "single"
              ? `「${calibrationTargetLabel(state.order[0])}」を取り直しました。保存してください。`
              : state.mode === "partial"
                ? "マクロボタンの登録が終わりました。保存してください。"
                : "すべての案内が終わりました。保存してください。"}
          </p>
        )}

        {/* 登録済み一覧とやり直し（§4.3-3）*/}
        {assigned.length > 0 && (
          <div>
            <p className="mb-1 text-xs font-medium text-gray-600">登録済み</p>
            <ul className="max-h-40 space-y-1 overflow-y-auto">
              {assigned.map((item) => {
                const binding = bindingOf(state.profile, item);
                return (
                  <li
                    key={item}
                    className="flex items-center justify-between gap-2 text-xs"
                  >
                    <span className="truncate">
                      {calibrationTargetLabel(item)}
                      <span className="ml-2 text-gray-500">
                        {binding ? describeBinding(binding) : ""}
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={() => handleRetake(item)}
                      className="shrink-0 rounded border border-gray-300 bg-white px-1.5 py-0.5 font-medium hover:bg-gray-100"
                      data-testid={`recipe-gamepad-retake-${calibrationTargetSlug(item)}`}
                    >
                      取り直す
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {saveFailed && (
          <p className="text-xs text-red-600" data-testid="recipe-gamepad-save-failed">
            保存できませんでした。ブラウザの設定で保存が制限されている可能性があります（この画面を開いている間は使えます）。
          </p>
        )}

        <div className="flex flex-wrap items-center justify-end gap-2">
          {/* 既定を仮適用中／部分登録中でも、いつでも全件やり直せる導線を残す。 */}
          {state.mode !== "sequential" && (
            <button
              type="button"
              onClick={() => {
                setState(startCalibration(state.profile, false));
                awaitingReleaseRef.current = true;
              }}
              className="mr-auto rounded border border-gray-300 bg-white px-3 py-1 text-sm font-medium hover:bg-gray-100"
              data-testid="recipe-gamepad-recalibrate-all"
            >
              すべて登録し直す
            </button>
          )}
          {/* 登録済みのときだけ出す。既定のままなら消すものが無い。 */}
          {source === "saved" && (
            <button
              type="button"
              onClick={() => {
                // 誤操作で登録が飛ぶため確認を挟む。
                if (!window.confirm("この機体の設定を初期化しますか？")) {
                  return;
                }
                onRemove();
                onOpenChange(false);
              }}
              className="rounded border border-red-300 bg-white px-3 py-1 text-sm font-medium text-red-700 hover:bg-red-50"
              data-testid="recipe-gamepad-reset"
            >
              初期化
            </button>
          )}
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="rounded border border-gray-300 bg-white px-3 py-1 text-sm font-medium hover:bg-gray-100"
            data-testid="recipe-gamepad-abort"
          >
            保存せずに閉じる
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="rounded bg-blue-600 px-3 py-1 text-sm font-medium text-white hover:bg-blue-700"
            data-testid="recipe-gamepad-save"
          >
            ここまでを保存
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
