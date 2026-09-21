import type { Move } from "@/features/moves/types";

import type { AttackButton, Strength } from "../../inputResolution";
import type {
  CommandIndexEntries,
  NumpadDirection,
  ResolvedInput,
} from "../../inputResolutionStage2";
import {
  resolveDirectionalInput,
  resolveDirectionalRushInput,
} from "../../inputResolutionStage2";
import type { ButtonTone } from "./ControllerButton";
import { ControllerButton } from "./ControllerButton";
import { RushToggleRow } from "./RushToggleRow";
import { useTranslation } from "react-i18next";

// 通常技クイック入力面(段階2＋段階1 一様フォールバック、M17-03、DES-004 §2.4.5)。
// 方向パッド(テンキー 9 方向)× 強度 × ボタン → 解決表を引き、ミスなら段階1 の構造引き。
// ラッシュトグル ON で rush_<確定技>(単発非空中のみ)。存在しない variant はボタン非活性(データ駆動)。

// 3×3 テンキーパッド(M17-03 開発者判断 = 案A)。行順は見た目どおり 7 8 9 / 4 5 6 / 1 2 3。
// 1P 側(右向き)基準で 6(前)= 右列。左右反転(2P 側)は現行流儀どおり非対応。
// 指摘6 の経緯により矢印記号(↖↑↗ 等)は使わず日本語テキスト主ラベル+テンキー数字副ラベル。
// 5/2/8 の aria は既存値(ニュートラル/下/上)を維持する(unit テストセレクタ非破壊)。
// ★M24-07(CO-020): 文言は locale が正典。ここは「どの方向があるか」と
//   「どのキーを引くか」だけを持つ。並び順は 7/8/9 → 4/5/6 → 1/2/3 の見た目どおり。
// ★★M30-01(レビュー 高-2): export している。features/combo/moveSurfacing.ts が
//   「通常技タブの入力面が持つ全組み合わせ」を別に持っており、片方だけ増えると
//   「押せるのに未掲載扱い」/「未掲載なのに押せる」が静かにずれる。
//   ⇒ moveSurfacing.test.ts が両者の一致を実際に検査する(描画には影響しない)。
export const DIRECTIONS: ReadonlyArray<{ dir: NumpadDirection; sub: string }> = [
  { dir: 7, sub: "7" },
  { dir: 8, sub: "8" },
  { dir: 9, sub: "9" },
  { dir: 4, sub: "4" },
  { dir: 5, sub: "5" },
  { dir: 6, sub: "6" },
  { dir: 1, sub: "1" },
  { dir: 2, sub: "2" },
  { dir: 3, sub: "3" },
];

// 指摘3: 強度トーン(弱=水色/中=黄/強=赤)。指摘5: 記号表記の下に副ラベルを重ねる。
//
// ★★【M24-07 レビュー(高-4)で是正】旧記述「記号表記の下に日本語表記(弱P 等)」は
//   en ロケールでは失効していた。主ラベル(label)は "LP" 等の ASCII 固定であり、
//   副ラベルのキーが `jpLabel`(日本語表記)だったため、en では両方が "LP" になって
//   同じ文字が上下に並んでいた。⇒ キー名を `subLabel` へ改め、en は空文字にして
//   2 段目を描かない。★ja は従来どおり「弱P」等を 2 段目に出す。
// ★★M30-01(レビュー 高-2): 同上。moveSurfacing 側の強度 × ボタンと一致を検査する。
export const ATTACKS: ReadonlyArray<{
  strength: Strength;
  button: AttackButton;
  label: string;
  key: string;
  tone: ButtonTone;
}> = [
  { strength: "light", button: "punch", label: "LP", key: "lp", tone: "light" },
  { strength: "medium", button: "punch", label: "MP", key: "mp", tone: "medium" },
  { strength: "heavy", button: "punch", label: "HP", key: "hp", tone: "heavy" },
  { strength: "light", button: "kick", label: "LK", key: "lk", tone: "light" },
  { strength: "medium", button: "kick", label: "MK", key: "mk", tone: "medium" },
  { strength: "heavy", button: "kick", label: "HK", key: "hk", tone: "heavy" },
];

interface Props {
  moves: Move[];
  entries: CommandIndexEntries;
  direction: NumpadDirection;
  onDirectionChange: (direction: NumpadDirection) => void;
  rushOn: boolean;
  onRushToggle: () => void;
  onAdd: (moveId: number) => void;
  // 物理コントローラで押されている方向(テンキー)。null = 押されていない/未接続(M21-03 §4.4)。
  heldDirection?: NumpadDirection | null;
  // 物理コントローラで押されている攻撃ボタン。`${strength}_${button}` 形式(例 "heavy_punch")。
  heldAttacks?: ReadonlySet<string>;
}

export function HitBoxLayout({
  moves,
  entries,
  direction,
  onDirectionChange,
  rushOn,
  onRushToggle,
  onAdd,
  heldDirection = null,
  heldAttacks,
}: Props) {
  const { t } = useTranslation();
  // 一様フォールバック(DES-004 §2.4.5): 全方向が同一経路(解決表 → 段階1)。方向で分岐しない。
  const resolve = (strength: Strength, button: AttackButton): ResolvedInput | null =>
    rushOn
      ? resolveDirectionalRushInput(moves, entries, direction, strength, button)
      : resolveDirectionalInput(moves, entries, direction, strength, button);

  return (
    <div className="rounded border border-gray-300 bg-gray-50 p-3">
      {/*
        ★★M30-02(SM-149): 移動(方向パッド)と技(攻撃ボタン)を**横並び**にする。
          開発者の逐語＝「移動ボタンと技ボタンが縦並びで直感的ではない。実物の
          コントローラのように移動と技は横並びにしたい。ただし現在の仮想コントローラの
          サイズ感はいいので、横に画面を広げないといけない」。
        ★ボタンの大きさ(ControllerButton の size)は 1 つも変えていない。横へ広げただけである。
        ★狭い画面では従来どおり縦へ折り返す。
        ★★data-testid と aria 名は 1 つも変えていない —— aria 名は
          VirtualController.test.tsx のセレクタである(契約の棚卸し §1.4)。
      */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
        {/* 左: 方向パッド(テンキー 9 方向 = 段階2 の入力面。M17-03) */}
        <div className="grid flex-1 grid-cols-3 gap-2">
          {DIRECTIONS.map(({ dir, sub }) => (
            <ControllerButton
              key={dir}
              label={t(`controller.direction.${dir}.label`)}
              subLabel={sub}
              aria={t(`controller.direction.${dir}.aria`)}
              active={direction === dir}
              // ラッシュ ON 時は上系(7/8/9 = 空中)を無効化(is_aerial 除外)。
              disabled={rushOn && dir >= 7}
              held={heldDirection === dir}
              onClick={() => onDirectionChange(dir)}
              testId={`recipe-dir-${dir}`}
            />
          ))}
        </div>

        {/* 右: 強度 × ボタン(2行3列)＋ 空いた 1 行ぶんへラッシュトグル */}
        <div className="flex flex-1 flex-col gap-2.5">
          {/* 解決できなければ非活性。色/2段ラベル/サイズ統一(指摘3/4/5/10) */}
          <div className="grid grid-cols-3 gap-2.5">
            {ATTACKS.map(({ strength, button, label, key, tone }) => {
              const resolved = resolve(strength, button);
              return (
                <ControllerButton
                  key={`${strength}_${button}`}
                  label={label}
                  // ★空文字なら 2 段目を描かない(en は主ラベルと同値になるため空)。
                  subLabel={t(`controller.attack.${key}.subLabel`) || undefined}
                  aria={t(`controller.attack.${key}.aria`)}
                  size="move"
                  tone={tone}
                  disabled={resolved == null}
                  held={heldAttacks?.has(`${strength}_${button}`) === true}
                  onClick={() => resolved != null && onAdd(resolved.moveId)}
                  testId={`recipe-normal-${strength}-${button}`}
                />
              );
            })}
          </div>

          {/*
            ラッシュ版トグル(iOS 風 Switch)。
            ★★M30-02(SM-149 案 X′): 攻撃ボタンの下に空く 1 行ぶんへ入れた。
              ⇒ 着手時点は方向パッドと攻撃ボタンの間に全幅で挟まっており、縦を 1 行使っていた。
            ★DOM 上は「方向 → 攻撃 → ラッシュ」の順になる(着手時点は方向 → ラッシュ → 攻撃)。
              名指ししているテストは data-testid 経由のみだが、Tab 順は変わる。
          */}
          {/* ★M37-02(B07): 共通部品へ切り出した。**位置も testid も変えていない。** */}
          <RushToggleRow
            checked={rushOn}
            onToggle={onRushToggle}
            ariaLabel={t("controller.rush.toggleAria")}
            label={t("controller.rush.label")}
            hint={
              rushOn
                ? t("controller.rush.airborneNo")
                : t("controller.rush.groundNormalOnly")
            }
            testId="recipe-rush-toggle"
          />
        </div>
      </div>
    </div>
  );
}
