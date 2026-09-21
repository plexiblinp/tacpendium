import type { ReactNode } from "react";

import type { Move } from "@/features/moves/types";

import { resolveRushByCode } from "../../inputResolution";
import { ControllerButton } from "./ControllerButton";
import { useTranslation } from "react-i18next";

// 直接指定パネル(特殊技 unique / SA・CA / ターゲットコンボ / 未掲載 / キャラ固有状態)。
// 1 ボタン = 1 技のワンプッシュ指定。
// 段階2(command 解決、M17)は先取りしない。表示名は nameJa フォールバック code。
// rushOn=true のとき各技を rush_<元技code> へ解決する(特殊技のラッシュ版、§4.2)。
// 該当 rush_variant が無い技はデータ駆動で非活性。
// ★rushOn を渡すのは特殊技タブだけである。SA / ターゲットコンボ / 未掲載 /
//   キャラ固有状態の 4 タブはいずれもラッシュ非対象のため渡さない(M30-01)。
//
// ★★M30-01: 並べる技の決定を本部品から取り上げ、呼び出し側が `list` で渡す形にした。
//   旧版は `categories: string[]` を受け取って自分で `moves.filter` していたが、
//   それだと「何を出すか」の規則がタブごとにこの部品の呼び出し引数へ散る。
//   ⇒ 規則は features/combo/moveSurfacing.ts の 1 本だけが持つ(指示書 §2.5-2)。
//   ★`moves` は引き続き全件を受け取る。ラッシュ版の引き当て(rush_<code>)に要るためであり、
//     `list` の絞り込みには使わない。
interface Props {
  moves: Move[];
  /** このパネルがボタンとして並べる技(呼び出し側が moveSurfacing で決める)。 */
  list: Move[];
  emptyLabel: string;
  onAdd: (moveId: number) => void;
  rushOn?: boolean;
  /** ボタンの data-testid 接頭辞。既定 "recipe-direct"(既存 E2E のセレクタ)。 */
  testIdPrefix?: string;
  /**
   * 物理コントローラで押されている move_code(M21-03 §4.4 の点灯)。
   *
   * ★★共通技を常設行からタブへ移設したとき(M30-01 追補)、点灯が消えないように足した。
   *   移設前は SystemRow が `held` を受けており、渡さないと**静かに機能が減る**。
   */
  heldCodes?: ReadonlySet<string>;
  /**
   * 枠の中の末尾へ描く要素(M37-02 / B07)。
   *
   * ★★用途はラッシュ版トグルを**枠の中**へ入れることである。着手前は特殊技タブだけ
   *   トグルがパネルの外・上・全幅に在り、通常技(`HitBoxLayout`)は枠の中・下に在った。
   *   ⇒ 外に在ると「特殊技だけに効く」ことが読めず、パネル横断の設定に見える。
   */
  footer?: ReactNode;
}

export function DirectSpecPanel({
  moves,
  list,
  emptyLabel,
  onAdd,
  rushOn = false,
  testIdPrefix = "recipe-direct",
  heldCodes,
  footer,
}: Props) {
  const { t } = useTranslation();

  if (list.length === 0) {
    return (
      <div className="space-y-2">
        <p className="rounded border border-dashed border-gray-300 p-3 text-center text-xs text-gray-500">
          {emptyLabel}
        </p>
        {footer}
      </div>
    );
  }

  return (
    // 指摘9: 枠で囲み共通技エリアとの境目を明確化。指摘10: 技ボタンサイズを統一(grid 3列・size=move)。
    //
    // ★★★M37-02(B09 / B14): 高さ上限と局所スクロールを足した。必殺技タブだけでなく
    //   **本部品を使う 5 タブすべて**(特殊技 / ターゲットコンボ / SA・CA / 未掲載 /
    //   キャラ固有状態)が対象である —— ターゲットコンボは技数が多いキャラで長くなる。
    //   ⇒ 縦の伸びが `O(技数)` から `O(1)` になる。
    // ★上限は `rem`。`vh` はモバイルの URL バー開閉で伸縮し、操作中にボタンが動く。
    // ★`overscroll-contain` が無いと末尾でページへスクロールが連鎖し、レシピが画面外へ出る。
    <div className="rounded border border-gray-300 bg-gray-50 p-2.5">
      <div
        className="max-h-[11.5rem] overflow-y-auto overscroll-contain pr-1 sm:max-h-[16rem] md:max-h-[18rem]"
        /*
          ★★★スクロール容器の testid を `${testIdPrefix}-...` にしないこと。
            床が `[data-testid^="recipe-common-"]` のような**接頭辞走査**で技ボタンを
            数えており、同じ接頭辞を持つ非ボタン要素を足すと**静かに 1 件多く数える**
            (実際に `VirtualController.test.tsx:499` の並び順の床が落ちて気づいた)。
          ⇒ `recipe-scroll-*` の別名前空間に置く。
        */
        data-testid={testIdPrefix.replace(/^recipe-/, "recipe-scroll-")}
      >
        <div className="grid grid-cols-3 gap-1.5">
      {list.map((m) => {
        const name = m.nameJa ?? m.code;
        const rushId = rushOn ? resolveRushByCode(moves, m.code) : null;
        const targetId = rushOn ? rushId : m.id;
        return (
          <ControllerButton
            key={m.id}
            label={rushOn ? t("controller.direct.rushLabel", { name }) : name}
            aria={rushOn ? t("controller.direct.rushAria", { name }) : name}
            size="move"
            disabled={targetId == null}
            held={heldCodes?.has(m.code) === true}
            onClick={() => targetId != null && onAdd(targetId)}
            testId={
              rushOn
                ? `${testIdPrefix}-rush-${m.code}`
                : `${testIdPrefix}-${m.code}`
            }
          />
        );
      })}
        </div>
      </div>
      {footer !== undefined && <div className="mt-2">{footer}</div>}
    </div>
  );
}
