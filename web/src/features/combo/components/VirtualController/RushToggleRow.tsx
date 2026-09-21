import { Switch } from "@/components/ui/switch";

// ラッシュ版トグルの 1 行（M37-02 / B07）。
//
// ★★★出所は開発者の要望「ラッシュ版のボタン位置を統一」である。着手前は 2 か所で形が違った:
//   - 通常技（`HitBoxLayout`）… 枠の**中**・攻撃グリッドの**下**・右カラム内
//   - 特殊技（`VirtualController`）… 枠の**外**・パネルの**上**・全幅
//
// ★★採ったのは `HitBoxLayout` 側である。理由 2 つ。
//   (1) **縦のコストが 0**。2×3 の攻撃グリッドが余らせた右カラム 3 行目に収まる。
//       `M30-02`（SM-149 案 X′）がまさに「全幅 1 行を節約するため」上から下へ移しており、
//       逆向きに統一すると `M37` の目的（縦の消費を減らす）に逆行する。
//   (2) 枠の外に在ると、**特殊技だけに効く設定がパネル横断の設定に見える**。
//
// ★★`CommonMovePanel` の「ラッシュ」ボタンは**ここへ統合しない**。あれはトグルではなく
//   `modifiers.type = "parry_drive_rush"` のステップを作る**別の経路**であり、
//   意味を統合したら欠陥である。⇒ 統合したのは容れ物（`DirectSpecPanel` の `footer`）だけ。

interface Props {
  checked: boolean;
  onToggle: () => void;
  /** 読み上げ用のラベル。 */
  ariaLabel: string;
  /** 「ラッシュ版」等の見出し語。 */
  label: string;
  /** 括弧書きの補足（「空中不可」「地上通常技のみ」等）。 */
  hint: string;
  /** ★既存の E2E / 単体テストが指している。**面ごとに違う値を渡すこと。** */
  testId: string;
}

export function RushToggleRow({
  checked,
  onToggle,
  ariaLabel,
  label,
  hint,
  testId,
}: Props) {
  return (
    <div className="flex items-center gap-2 border-t border-gray-200 pt-2">
      <Switch
        checked={checked}
        onCheckedChange={() => onToggle()}
        aria-label={ariaLabel}
        data-testid={testId}
      />
      <span className="text-xs font-medium text-gray-700">{label}</span>
      <span className="text-xs text-gray-500">({hint})</span>
    </div>
  );
}
