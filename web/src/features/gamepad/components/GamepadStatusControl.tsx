// 接続状態表示とキャリブレーション導線をまとめる入口（M21-01 §4.4）。
//
// レシピ入力面（VirtualController の見出し行）へ差し込んで使う。
// ★M21-03: ポーリング・判定・プロファイル解決は PhysicalInputProvider が 1 組だけ持つ形へ移した。
//   本コンポーネントは provider の値を読むだけである——入力面は同時に複数マウントされうるため
//   （コンボ編集画面のレシピ節 ＋ 紐づくセットプレイ行）、面ごとにループを持たせられない。
// ★M21-02 の最小可視化（GamepadStepPreview）はここから撤去した。本番の読取表示は
//   GamepadRecipeReadout が持つ（指示書 §4.7）。

import { useState } from "react";

import { usePhysicalInputContext } from "@/features/physical-input/PhysicalInputProvider";
import GamepadCalibrationDialog from "./GamepadCalibrationDialog";
import GamepadStatusBadge from "./GamepadStatusBadge";

interface Props {
  /** この面が物理入力の受け手か（★受け手は 1 面だけ）。 */
  active?: boolean;
  /**
   * 機体を観測できているか。
   *
   * ★受け手バッジは接続中だけ出す。未接続の利用者に「他の面が受付中」とだけ出しても
   *   意味が無く、常設の占有だけが増える（レビュー指摘 中-1）。
   *   **接続状態そのものの表示（GamepadStatusBadge）は M21-01 の導線であり常に出す。**
   */
  connected?: boolean;
}

export default function GamepadStatusControl({
  active = false,
  connected = false,
}: Props) {
  const [open, setOpen] = useState(false);
  const {
    status,
    snapshot,
    axesBaseline,
    padId,
    browserKey,
    profile,
    source,
    saveProfile,
    removeProfile,
    available,
  } = usePhysicalInputContext();

  if (!available) return null;

  return (
    <>
      <GamepadStatusBadge
        status={status}
        padId={padId}
        source={source}
        onOpenCalibration={() => setOpen(true)}
      />
      {/* 受け手であることの明示（2026-08-13 開発者判断＝「選択中であることは分かりやすく表示」）。 */}
      {connected && (
        <span
          data-testid="recipe-gamepad-owner"
          className={
            active
              ? "rounded border border-blue-400 bg-blue-50 px-1.5 py-0.5 text-xs font-medium text-blue-800"
              : "rounded border border-gray-300 bg-gray-50 px-1.5 py-0.5 text-xs text-gray-500"
          }
        >
          {active ? "パッド入力: この面で受付中" : "パッド入力: 他の面が受付中"}
        </span>
      )}
      <GamepadCalibrationDialog
        open={open}
        onOpenChange={setOpen}
        status={status}
        snapshot={snapshot}
        axesBaseline={axesBaseline}
        padId={padId}
        browserKey={browserKey}
        profile={profile}
        source={source}
        onSave={saveProfile}
        onRemove={removeProfile}
      />
    </>
  );
}
