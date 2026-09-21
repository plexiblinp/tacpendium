// 「いまモーダルが開いているか」を 1 か所で持つ登録ストア（M21-07 §3.3-3・§4.5）。
//
// ★**守りたい不変条件は「利用者の注意と入力が別の面へ向いている間、レシピは変わらない」である**
//   （`DES-005` §6.4.3 項目 4″ ／ **D-380**）。本ファイルはその不変条件が成り立つ区間を持つだけで、
//   「どう抑止するか」は持たない。抑止の軸は `PhysicalInputProvider` に 1 本だけある。
//
// ★**DOM のセレクタ・属性値を見ない。** モーダルとして開かれたという事実そのものを登録する。
//   ⇒ UI ライブラリが何を DOM へ出すかが変わっても壊れない（**D-380** が避けたかった形）。
//   セレクタで判定する形は、
//     (a) 版によって重なり系の部品が同じ役割属性を出すため「モーダルでない重なり」を誤検出し、
//     (b) 誤検出の症状が「たまに入力が効かない」であって利用者が言語化できない、
//   という 2 点で採らなかった（完了報告 §2）。
//
// ★**共有プリミティブ**（`components/ui/` の `DialogContent` / `AlertDialogContent` /
//   `SheetContent`）**を通るモーダルは、何もしなくても対象になる。**
//
// ★★**ただし「アプリ内のすべてのモーダルが共有プリミティブを通る」わけではない。**
//   **自作のオーバーレイは自分で {@link ModalPresenceMarker} を置く必要がある**（現時点で
//   `ComboEditor` の「保存完了 — 警告があります」と `QRCodeModal` の 2 件）。
//   **⇒ モーダルを自作したら、ここへ参加させること。** **とくに入力面と同じツリーに置く場合、
//   参加させないと `D-383` の欠陥（モーダルの裏でレシピにステップが入る）がそのまま残る。**
//   ★M21-07 の初版はここを「例外なく共有プリミティブを通る」と書いており、**レビューで
//     反例 2 件が見つかった**。**「import を grep する」形の実査は、自作のオーバーレイを
//     構造的に見つけられない**——探すなら `aria-modal` ／ `createPortal` ／ `fixed inset-0`
//     のような**見た目の側**からも当たること。
//
// ★**モーダルでない重なり**（トースト・ツールチップ・ポップオーバー・選択メニュー・
//   ドロップダウン）**は別のプリミティブであり、登録経路を通らない。**
//   ⇒ 誤検出（抑止しすぎ）は「拾わないことの確認」ではなく**構造的に 0** である。

import { useEffect, useSyncExternalStore } from "react";

/**
 * いま開いているモーダルの数。
 *
 * ★boolean ではなく計数である。**モーダルは重なって開きうる**（確認ダイアログの上に
 *   さらに確認ダイアログ）。boolean だと、内側が閉じた時点で外側が開いたままなのに
 *   「閉じた」ことになる——`PhysicalInputProvider` の `capturing` が面ごとの id 集合を
 *   持っているのとまったく同じ理由である。
 */
let openCount = 0;

const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): boolean {
  return openCount > 0;
}

/**
 * モーダルが開いていることを登録する。戻り値を呼ぶと解除される。
 *
 * ★フックを使えない場所（テスト・将来の命令的な導線）からも使えるよう、素の関数として公開する。
 * ★**解除は必ず 1 回だけ呼ばれる前提にしない。** 二重に呼ばれても計数が負に振れないよう、
 *   解除済みかどうかを呼び出しごとに持つ。
 */
export function registerModalOpen(): () => void {
  openCount += 1;
  emit();
  let released = false;
  return () => {
    if (released) return;
    released = true;
    openCount -= 1;
    emit();
  };
}

/**
 * マウントされている間だけ「モーダルが開いている」を登録する。
 *
 * ★**モジュール外へ公開しない**（M21-07 レビュー指摘 低-3）。唯一の利用者は
 *   {@link ModalPresenceMarker} である。**誤った場所で呼ぶと物理入力が恒久的に効かなくなる**
 *   ため、コメントで警告するのではなく**呼べる場所を構造的に閉じる。**
 *
 * ★**「開いている」と等価なのは、UI ライブラリの Content 本体がマウントされていることである。**
 *   共有プリミティブのラッパ（`DialogContent` 等）は**閉じていてもマウントされたまま**である
 *   ——ラッパ自身が Portal を描画しており、開閉で入れ替わるのはその内側だからである。
 *   ⇒ 本フックを**ラッパの側で呼んではならない。** 呼ぶと、画面に置いてあるだけの
 *   ダイアログが常に「開いている」ことになり、**物理入力が恒久的に効かなくなる。**
 *   （2026-08-15 に実際にこの形で書いてテストが落ち、下の {@link ModalPresenceMarker} へ改めた。）
 * ★閉じるアニメーションの間は Content が残るため、閉じた直後もごく短い間は抑止が続く。
 *   **これは実害ではなく望ましい**——閉じる操作で押したキー・ボタンが裏へ漏れない。
 */
function useModalPresence(): void {
  useEffect(() => registerModalOpen(), []);
}

/**
 * 描画を持たない目印。**開閉で入れ替わる側（Content 本体の内側）へ置く。**
 *
 * ★フックではなくコンポーネントにしてあるのは、**置き場所を間違えにくくするため**である。
 *   ラッパの本体でフックを呼ぶ形は「閉じていても開いている」になるが、
 *   本コンポーネントは Content の子として書くしかなく、**その位置は必ず開閉に追従する。**
 * ★JSX を書いていない（`null` を返すだけ）ので、本ファイルは `.ts` のままでよい。
 */
export function ModalPresenceMarker(): null {
  useModalPresence();
  return null;
}

/** モーダルが 1 つでも開いているか（購読する）。 */
export function useAnyModalOpen(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/** モーダルが 1 つでも開いているか（購読しない一発読み）。 */
export function isAnyModalOpen(): boolean {
  return getSnapshot();
}
