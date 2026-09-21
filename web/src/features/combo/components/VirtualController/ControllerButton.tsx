import { cn } from "@/lib/utils";

// 強度トーン(指摘3): 弱=水色 / 中=黄色 / 強=赤 / OD=灰。通常技・必殺技の強度ボタンに用いる。
export type ButtonTone = "light" | "medium" | "heavy" | "od";

// ボタンサイズ(指摘10): "move" は技ボタン統一サイズ。
// "system" は共通技/削除向けにやや大きめ(1 行維持のため横は控えめ、指摘3-2)。
//
// ★★★M37-02(B13/B14・2026-09-13 開発者選択): "move" を一回り小さくし、
//   強度・種類・OD 組合せ用に "chip" を足した。
//
//   ★★"move" が縦を支配していた —— **最低高が family 行数だけ繰り返される**構造であり、
//     blanka(family 21)では必殺技パネルだけで 1086px あった(段 1 の実測・幅 390)。
//   ★★★縮めたのは高さだけではない。**text-sm → text-xs のほうが効く** ——
//     技名は 3 列 95px 幅で折り返すため、行の高さを決めているのは `min-h` ではなく
//     **折り返した行数 × 行送り**である。20px → 16px は 3 行なら 12px 効く。
//
//   ★"chip" は**折り返さない**(`whitespace-nowrap`)。これが B13 の要である ——
//     ラベルが折り返せない以上、**横を詰めても行が高くならない**。
//     ⇒ 「横を縮めたら縦が増えた」(指示書 §4.1 の最大の危険)が構造的に起きない。
//     ★`whitespace-nowrap` を base へ入れないこと。DirectSpecPanel は技名フルラベルを
//       出しており、折り返せないと横へ溢れる。
export type ButtonSize = "default" | "move" | "system" | "chip";

const TONE_STYLES: Record<ButtonTone, string> = {
  light: "border-cyan-300 bg-cyan-100 text-cyan-800 hover:bg-cyan-200",
  medium: "border-yellow-300 bg-yellow-100 text-yellow-800 hover:bg-yellow-200",
  heavy: "border-red-300 bg-red-100 text-red-800 hover:bg-red-200",
  od: "border-gray-400 bg-gray-200 text-gray-800 hover:bg-gray-300",
};

interface Props {
  label: string;
  aria: string;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
  variant?: "default" | "danger";
  tone?: ButtonTone;
  subLabel?: string;
  size?: ButtonSize;
  testId?: string;
  /**
   * 物理コントローラで押されている間の点灯(M21-03 §4.4)。
   * ★表示だけの効果であり解決には関与しない。状態源は論理ボタン層であって確定ステップではない。
   */
  held?: boolean;
}

// 仮想コントローラ共通のボタン(M15-03 でタブ式クイック入力へ拡張、旧 HitBoxLayout.Btn を共通化)。
// active=選択中トグル、disabled=データ駆動でその variant の move が存在しない場合。
// tone=強度色(指摘3)、subLabel=2段目の日本語表記(指摘5)、size="move"=技ボタン統一サイズ(指摘10)。
// スタイル優先順位: danger > tone > active > default。
export function ControllerButton({
  label,
  aria,
  onClick,
  disabled = false,
  active = false,
  variant = "default",
  tone,
  subLabel,
  size = "default",
  testId,
  held = false,
}: Props) {
  const base =
    "flex flex-col items-center justify-center rounded border font-medium disabled:cursor-not-allowed disabled:opacity-40";
  const sizeStyles =
    size === "move"
      ? "min-h-[2.5rem] px-1.5 py-1.5 text-xs"
      : size === "chip"
        ? "min-h-[2rem] whitespace-nowrap px-2.5 py-1.5 text-sm"
        : size === "system"
          ? "px-2.5 py-2 text-sm"
          : "px-2 py-1.5 text-xs";
  const colorStyles =
    variant === "danger"
      ? "border-red-300 bg-red-50 text-red-700 hover:bg-red-100"
      : tone
        ? TONE_STYLES[tone]
        : active
          ? "border-blue-500 bg-blue-50 text-blue-800"
          : "border-gray-300 bg-white text-gray-800 hover:bg-gray-100";
  // 点灯(M21-03 §4.4): 既存の色分け(tone/active/danger)を潰さないよう ring で重ねる。
  // data-held は「押している間だけ点灯する」ことをテストから見るための属性(§5 (d))。
  const heldStyles = held ? "ring-2 ring-offset-1 ring-emerald-500" : "";
  return (
    <button
      type="button"
      aria-label={aria}
      aria-pressed={active}
      onClick={onClick}
      disabled={disabled}
      data-testid={testId}
      data-held={held ? "true" : undefined}
      className={cn(base, sizeStyles, colorStyles, heldStyles)}
    >
      <span>{label}</span>
      {subLabel != null && subLabel !== "" && (
        <span className="text-[0.65rem] font-normal opacity-80">{subLabel}</span>
      )}
    </button>
  );
}
