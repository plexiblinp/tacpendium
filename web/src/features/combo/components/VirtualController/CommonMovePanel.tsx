import { useTranslation } from "react-i18next";

import type { Move } from "@/features/moves/types";

import { ControllerButton } from "./ControllerButton";
import { DirectSpecPanel } from "./DirectSpecPanel";

// 共通技タブ(M30-01 追補・2026-09-08 開発者指示)。
//
// ★★タブ外の常設行(旧 SystemRow の共通技グループ)から**ここへ移設**した。
//   移設前の常設行が持っていたのは 6 code だけで、移動系の 7 code
//   (前入力 / 後ろ入力 / 微歩き 2 / ジャンプ 3)はどの面にも出ておらず、
//   実 DB で 217 行(7 code × 31 キャラ)が未分類へ落ちていた。
//
// ★並べる 13 code と並び順は features/combo/moveSurfacing.ts の COMMON_MOVE_CODES が持つ。
//   ここは描画だけを行う(規則を 2 か所へ書かない = 指示書 §2.5-2)。
//
// ★★生ラッシュだけは move ではない。`modifiers.type = "parry_drive_rush"` であり
//   (`DES-004` §2.1)、13 code の外に別のボタンとして置く。
//   ⇒ 押したときの経路も別である(handleSystemButton を通る)。
interface Props {
  /** COMMON_MOVE_CODES の並び順で渡される共通技(存在するものだけ)。 */
  list: Move[];
  /** 全 move(DirectSpecPanel がラッシュ版の引き当てに使う。ここでは使わない)。 */
  moves: Move[];
  onAdd: (moveId: number) => void;
  /** 生ラッシュ(modifiers.type)を積む。★move ではないので onAdd とは別の口である。 */
  onRawRush: () => void;
  /** 物理コントローラで押されている move_code(M21-03 §4.4 の点灯)。 */
  heldCodes?: ReadonlySet<string>;
}

export function CommonMovePanel({
  list,
  moves,
  onAdd,
  onRawRush,
  heldCodes,
}: Props) {
  const { t } = useTranslation();
  return (
    <DirectSpecPanel
      moves={moves}
      list={list}
      emptyLabel={t("controller.panel.commonEmpty")}
      onAdd={onAdd}
      testIdPrefix="recipe-common"
      heldCodes={heldCodes}
      footer={
        /*
          生ラッシュ。★move ではないため上のグリッドには入れられない
          (`modifiers.type = "parry_drive_rush"`。押下経路も別である)。

          ★★M37-02(B14): **枠を 1 つ畳んだ。** 着手前はボタン 1 個のために
            `grid grid-cols-3 ... rounded border ... p-3` の箱をもう 1 つ持っており、
            枠 ＋ 余白だけで 1 行ぶんの縦を使っていた。
            ⇒ 上のパネルの枠の中の末尾へ入れた。**意味は統合していない** ——
              足したのは容れ物の共有だけであり、`onRawRush` の経路は不変である。
        */
        <div className="border-t border-gray-200 pt-2">
          <ControllerButton
            label={t("controller.system.rush.label")}
            aria={t("controller.system.rush.aria")}
            size="chip"
            onClick={onRawRush}
            testId="recipe-system-parry-drive-rush"
          />
        </div>
      }
    />
  );
}
