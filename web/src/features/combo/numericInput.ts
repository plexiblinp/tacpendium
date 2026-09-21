import { type KeyboardEvent } from "react";

// 基本情報タブの数値入力で共有する定数とキーガード。
//
// ★★M37-01 で ComboEditorBasicFields.tsx から切り出した。理由は 1 つだけである ——
//   MassPercentInput が NO_SPINNER を要るのに、同ファイルから import すると
//   循環参照になる(向こうがこちらを描画するため)。★文字列の複製は禁じられている
//   (M24-12 §4.3「同じ形を各欄へ複製しない」)。⇒ 置き場を分けた。
// ★中身は 1 文字も変えていない。ComboEditorBasicFields は本モジュールを import し、
//   blockNonNumericKeys は従来どおり同ファイルからも re-export する(既存テストの
//   import 元を動かさないため)。

/**
 * ★★M24-12(§4.9・D-582): 数値入力からスピナー(上下ボタン)を消す。
 *
 * ★開発者の逐語＝「スピナーが大して便利ではない。マウスでスピナーを押すより
 *   数値入力する方が速い。」
 *
 * ★★適用は基本情報タブの `type="number"` **全欄**である(2026-08-29 開発者裁定)。
 *   ★指示書 §4.9 が名指ししたのはゲージ 4 欄だが、実査で 9 欄あることが分かり、
 *     開発者の理由は全欄に同じだけ当てはまる。4 欄だけ消すと同じ画面でスピナーの
 *     有無がまだらになるため、揃える判断を得た。
 *   ★★M37-01 で 9 → 13 欄になった(始動位置マス数・同パーセント・運び量マス数・
 *     同パーセント)。⇒ 「9 欄」と書いていた旧記述は失効している。
 *
 * ★★`type="number"` は外さない。外すと携帯の数値キーボード・`min`/`max` 属性・
 *   既存 E2E の `fill()` の前提がまとめて変わる(開発者確認 2026-08-29＝案 A)。
 *   ⇒ 見た目のボタンだけを CSS で消す。
 *
 * ★★★【M38-01・射程 1・2026-09-17】**矢印キーでの増減も止まった。**
 *   ★以下は失効した記述:「矢印キーでの増減は残る(実測で確認)」。
 *   ⇒ 開発者の逐語＝「矢印でフォーカスを移動させれた方がうれしい」。
 *     止めているのは本定数ではなく `useFieldSequence` の `keyIsClaimedByField`
 *     であり、同フックが ↑↓ を順送りへ回す前に `preventDefault()` する。
 *   ★★★**適用範囲が本定数と違う。** `NO_SPINNER` はコンボエディタの
 *     `type="number"` 全欄へ配ってあるが、矢印の抑止は
 *     **`useFieldSequence` を張った面**(コンボエディタの基本情報タブ)の中だけである。
 *     ⇒ レシピタブ・セットプレイ・プリセット等の数値欄は従来どおり矢印で増減する。
 *     ★「全欄で止めた」と読まないこと。
 */
export const NO_SPINNER =
  "[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none";

// type="number" は標準仕様で "e"/"E"(指数表記)・"+"・"-"・"."(小数点) のタイプを許してしまう。
// 本フォームの数値欄はすべて整数項目のため、これらのキー入力を抑止する。
// 負値が正当な欄(有利フレーム)では "-" のみ許可する(allowNegative=true)。
// allowDecimal は drive_damage(C-11、-6〜6・小数許容)用。既定は false で既存のゲージ入力と同方式。
// ★M37-01: パーセント欄も allowDecimal=true で使う(小数第 1 位まで受けるため)。
export function blockNonNumericKeys(
  allowNegative: boolean,
  allowDecimal = false,
) {
  return (e: KeyboardEvent<HTMLInputElement>) => {
    const blocked = ["e", "E", "+"];
    if (!allowNegative) blocked.push("-");
    if (!allowDecimal) blocked.push(".");
    if (blocked.includes(e.key)) {
      e.preventDefault();
    }
  };
}

// clampNumericString は消費入力欄(M16-02 追補 v1.0.2・F-1(a))の UI 上限クランプ。
// <input type="number" max> はタイプ入力を弾かない(伝達メモ F-2)ため、値レベルで [min,max]
// に収める。範囲内はタイプ途中の表記("", "1.", "1.5" 等)を壊さないよう raw を保持し、
// 範囲外のときだけ min/max へ丸める。
//
// ★★M37-01(2026-09-13 開発者裁定): 始動位置マス数・運び量にも本関数を使う。
//   ★着手時は「クランプすると 161 の*拒否*が観測できなくなる」として使わない判断をしたが、
//     開発者の要望は「他の項目と同じように、所定の範囲外は画面的に入力できないこと」であった。
//     ⇒ 差し戻した。★zod と VAL-RANGE は残す —— CSV / API から入る経路は画面を通らず、
//       防衛線を外すと値域外が DB の CHECK 違反(500)になるためである。
export function clampNumericString(raw: string, min: number, max: number): string {
  if (raw === "") return "";
  const n = Number(raw);
  if (!Number.isFinite(n)) return raw; // 解釈不能な途中入力(".", "1." 等)は保持
  if (n > max) return String(max);
  if (n < min) return String(min);
  return raw; // 範囲内は入力表記をそのまま保持(小数途中入力を壊さない)
}
