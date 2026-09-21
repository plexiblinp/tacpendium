// 物理入力の告知（M21-03 §4.6・D-347 の帰結・必須）。
//
// ★文言はこのファイル 1 か所だけに置く。2 面（コンボのレシピ入力面 / セットプレイ入力面）は
//   どちらも本コンポーネントを描画する（§4.9-5。同じ文言を 2 か所へ書き写さない＝`E-76`）。
//
// ★3 点目（不具合ではなく意図的な設定であること）を落とさないこと。1・2 だけだと
//   「使いにくいツール」に読める。窓を広く取ったのは、狭いほうが silent に入力を落とすから
//   である（`DES-005` §6.4.2 の「誤りの非対称性」）。
//
// ★判定窓の実値（ミリ秒）を利用者向け文言へ書かない。値は実装の 1 か所
//   （stepDetection.ts の定数）が正であり、UI へ写すとドリフトする（`E-76`）。
//
// ★★★M37-02（B10 / `P-59` の決着・2026-09-13）で「常設」をやめた。
//   旧記述＝「常設の注記にした（§9.2-2 で形は自由）。初回のみの説明にしなかったのは、
//   『意図せずまとまる』に出会うのが初回とは限らないためである。」
//   ⇒ 開発者の逐語で覆った。「問題点は文章量というよりも常にメッセージが表示される事。
//     初回だけ読めば後は充分な文言がずっと表示されて、画面の縦を消費するのを問題視している」。
//
// ★★`D-347` に反しない。同裁定が要求したのは「利用者に事前に伝える場所も決める」ことで
//   あって常設ではない。**畳むことは落とすことではない**——明示操作で開ける限り、
//   伝える場所は在る。⇒ 3 文は 1 文字も変えていない（`GAMEPAD_INPUT_NOTICE_POINTS`）。
//
// ★型は `DES-005` §5.9 の「制約の告知」と同じである（初回のみ自動表示 ＋ 以降は明示操作で
//   開く ＋ 既読フラグはブラウザに保持）。先例＝`SetplayLimitationNotice`。

import { useEffect, useRef } from "react";
import { Info, X } from "lucide-react";

import {
  persistGamepadNoticeSeen,
  useGamepadNoticeOpen,
} from "../gamepad-notice-storage";

/** 告知の 3 点。★順序も内容もここが正本である。★M37-02 でも 1 文字も変えていない。 */
export const GAMEPAD_INPUT_NOTICE_POINTS: readonly string[] = [
  "素早く入力すると、別々のつもりの入力が 1 ステップにまとまることがあります。",
  "ゆっくり正確に入力してください。",
  "これは不具合ではなく、入力を取りこぼさないための意図的な設定です。",
] as const;

/**
 * 畳んだときの見た目。★★★開発者が実物を見てから決める（`P-59` (2)・逐語＝
 * 「1 行の空きが縦スクロール量以前に不自然な空白に見える可能性もあるため」）。
 *
 * ★★**この 1 行を差し替えるだけで両方の形を試せる**（指示書 §2.2-5 / 完了条件 5）。
 *   どちらの形も同じ開閉状態・同じ既読フラグを使い、**描画だけが分岐する**。
 *
 *   - `"label-row"` … ラベル 1 行（開くボタン）を残す。縦は約 20px。
 *   - `"hidden"`    … 畳んだときは本体を**何も描かない**。縦は 0。
 *                     ⇒ 開く導線は `GamepadNoticeOpenButton` が持ち、
 *                       `VirtualController` の見出し行の空き幅へ載る（縦を増やさない）。
 *
 * ★★★どちらの形でも「明示操作で開ける」ことが**必ず成り立つ**ようにしてある。
 *   これは体裁ではない —— `D-347` が要求しているのは「利用者に事前に伝える場所が在る」ことであり、
 *   **畳むことが許されるのは開ける限りにおいてである**。開く導線を失った瞬間、本サブが
 *   `D-347` に反しないと主張した根拠そのものが崩れる。
 *   ⇒ 両分岐とも単体テストで押さえてある（`GamepadInputNotice.test.tsx`）。
 */
export const GAMEPAD_NOTICE_COLLAPSED_FORM: "label-row" | "hidden" = "label-row";

interface Props {
  /**
   * 畳んだ形の上書き。★**本番では渡さない**（既定＝`GAMEPAD_NOTICE_COLLAPSED_FORM`）。
   * テストが両方の分岐を実行するために開けてある。
   */
  collapsedForm?: "label-row" | "hidden";
}

/**
 * 畳んでいるときに告知を開くための小さなボタン。
 *
 * ★★`"hidden"` 形のときだけ描く。置き場は `VirtualController` の見出し行であり、
 *   既に横に空きがあるため**縦を 1px も増やさない**。
 * ★`"label-row"` 形では `GamepadInputNotice` 自身がラベル 1 行を出すので、ここは何も描かない
 *   （2 か所に開くボタンが出ないようにする）。
 */
export function GamepadNoticeOpenButton({ collapsedForm }: Props = {}) {
  const form = collapsedForm ?? GAMEPAD_NOTICE_COLLAPSED_FORM;
  const { noticeOpen, setNoticeOpen } = useGamepadNoticeOpen();

  if (form !== "hidden" || noticeOpen) return null;

  return (
    <button
      type="button"
      onClick={() => setNoticeOpen(true)}
      data-testid="recipe-gamepad-notice-open"
      aria-expanded={false}
      className="inline-flex items-center gap-1 rounded px-1 text-xs text-amber-800 hover:bg-amber-50 hover:text-amber-900"
    >
      <Info className="h-3.5 w-3.5" aria-hidden="true" />
      注意
    </button>
  );
}

export default function GamepadInputNotice({ collapsedForm }: Props = {}) {
  const form = collapsedForm ?? GAMEPAD_NOTICE_COLLAPSED_FORM;
  const { noticeOpen, setNoticeOpen } = useGamepadNoticeOpen();

  // ★初回描画時に開いていたか＝自動表示であったか。以後の手動開閉と区別する。
  const autoOpenedRef = useRef(noticeOpen);

  // ★★既読の書込みは**描画中ではなくここ**で行う（`getSnapshot` は純粋に保つ）。
  //   ★保存できない環境では畳む —— 表示したまま既読を記録できないと毎回自動表示になり、
  //     `B10` の要求（常時表示をやめる）を満たさない。
  //   ★手動で開いたときは畳まない（`autoOpenedRef`）。読む意思で開いたものを閉じない。
  useEffect(() => {
    if (!autoOpenedRef.current) return;
    if (!persistGamepadNoticeSeen()) setNoticeOpen(false);
  }, [setNoticeOpen]);

  if (!noticeOpen) {
    // ★`"hidden"` のときの開く導線は `GamepadNoticeOpenButton`（見出し行）が持つ。
    if (form === "hidden") return null;
    return (
      <button
        type="button"
        onClick={() => setNoticeOpen(true)}
        data-testid="recipe-gamepad-notice-toggle"
        aria-expanded={false}
        className="inline-flex items-center gap-1 text-xs text-amber-800 hover:text-amber-900"
      >
        <Info className="h-3.5 w-3.5" aria-hidden="true" />
        物理入力の注意
      </button>
    );
  }

  return (
    <div
      className="relative rounded border border-amber-200 bg-amber-50 px-2 py-1.5 pr-7 text-xs leading-relaxed text-amber-900"
      data-testid="recipe-gamepad-notice"
    >
      <ul className="list-inside list-disc space-y-0.5">
        {GAMEPAD_INPUT_NOTICE_POINTS.map((point, index) => (
          <li key={point} data-testid={`recipe-gamepad-notice-point-${index + 1}`}>
            {point}
          </li>
        ))}
      </ul>
      {/*
        ★★閉じるボタンは**行を足さない**形にする(右上へ絶対配置)。
          初版は本文の下に 1 行のボタンを置いており、**告知が 24px 高くなっていた**
          (段 6 の実測で 116px → 140px)。⇒ 初回だけ縦が増えるのは B10 に逆行する。
        ★`pr-7` が本文と重ならない余白を確保する。
      */}
      <button
        type="button"
        onClick={() => setNoticeOpen(false)}
        aria-label="物理入力の注意を閉じる"
        data-testid="recipe-gamepad-notice-close"
        className="absolute right-1 top-1 rounded px-1.5 leading-none text-amber-700 hover:bg-amber-100"
      >
        <X className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
    </div>
  );
}
