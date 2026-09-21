// 接続状態表示と user gesture 導線（M21-01 §4.4）。
//
// ★PoC の実測（D-324）: 全経路で user gesture が必須であり、入力面を開いた直後は
//   navigator.getGamepads() が空を返す。これが無いと、利用者は接続しているのに壊れていると判断する。
//   ⇒ 本表示は後から足す装飾ではなく、入力面の初期状態そのものの設計である。
//
// ★「認識していません」（障害）と「まだ 1 度も押されていません」（正常な初期状態）を
//   同じ文言にしない（指示書 §4.4-4）。
//
// ★★【M24-07 で失効】旧記述「文言は既存の仮想コントローラ（HitBoxLayout 等）に合わせて
//   直書きする（同面は i18n を経由していない）」は失効した——CO-020 で仮想コントローラ
//   （HitBoxLayout / SystemRow / VirtualController / SpecialMovePanel / DirectSpecPanel）は
//   locale の controller.* を通るようになった。
// ★本部品の文言はまだ直書きである。物理コントローラ系（gamepad / keyboard）の i18n 化は
//   本サブの射程外であり、面ごと片付けるまで直書きのままにしてある（1 画面で 2 系統を
//   混ぜないため）。⇒ 揃える先は「仮想コントローラ」ではなく「gamepad 系の面ごとの i18n 化」。

import type { GamepadConnectionStatus } from "../useGamepadPolling";
import type { ProfileSource } from "../useGamepadProfiles";

interface GamepadStatusBadgeProps {
  status: GamepadConnectionStatus;
  /** Gamepad.id。★複数機体があるときに自明になるため表示する（指示書 §4.4-3 の見込みを採用）。 */
  padId: string | null;
  /**
   * プロファイルの出どころ。
   * `default`（標準配置を仮適用中）と `none`（未設定）を別表示にする——前者はそのまま使えるが、
   * 後者はキャリブレーションが要るため。
   */
  source: ProfileSource;
  onOpenCalibration: () => void;
}

export default function GamepadStatusBadge({
  status,
  padId,
  source,
  onOpenCalibration,
}: GamepadStatusBadgeProps) {
  const connected = status === "connected";

  // ★3 状態で別の文言・別の色にする。
  const { icon, text, tone } =
    status === "connected"
      ? {
          icon: "✓",
          text: `認識中: ${padId ?? "コントローラ"}`,
          tone: "text-emerald-700",
        }
      : status === "disconnected"
        ? {
            icon: "⚠",
            // 障害側。「押してください」とは書かない（押しても直らないため）。
            text: "コントローラを認識していません",
            tone: "text-red-600",
          }
        : {
            icon: "•",
            // 正常な初期状態側。user gesture を促す導線がこれ（指示書 §4.4-2）。
            text: "コントローラのボタンを 1 度押してください",
            tone: "text-gray-500",
          };

  return (
    <span
      className="flex min-w-0 items-center gap-1.5 text-xs"
      data-testid="recipe-gamepad-status"
      data-status={status}
    >
      <span className={`shrink-0 ${tone}`} aria-hidden="true">
        {icon}
      </span>
      <span className={`truncate ${tone}`} title={connected ? (padId ?? undefined) : undefined}>
        {text}
      </span>
      {connected && source === "default" && (
        <span className="shrink-0 text-gray-500" data-source="default">
          （標準配置）
        </span>
      )}
      {connected && source === "none" && (
        <span className="shrink-0 text-amber-600" data-source="none">
          （未設定）
        </span>
      )}
      <button
        type="button"
        onClick={onOpenCalibration}
        className="shrink-0 rounded border border-gray-300 bg-white px-1.5 py-0.5 text-xs font-medium hover:bg-gray-100"
        data-testid="recipe-gamepad-calibrate"
      >
        コントローラ設定
      </button>
    </span>
  );
}
