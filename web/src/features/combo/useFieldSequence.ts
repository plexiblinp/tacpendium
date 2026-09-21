import { useCallback, useEffect, useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";

import { nextSequenceTarget, type SequenceSection } from "./fieldSequence";

// M24-12: キーボードの順送り。ハイライトを次の欄へ移す。
//
// ★★新しいパッケージは作っていない。features/combo 配下に置いてある
//   ⇒ SUPP-001 §5.2 のパッケージ構成に増減が無く、CHANGE-138 の射程が広がらない
//     (指示書 §7.4.1-5 / D-564)。
//
// ★停止点の一覧は DOM から採る(`[data-seq-stop]` を数える)。手書きの配列は持たない
//   ——キャラ固有状態は選択キャラ次第、仮登録トグルはモード次第で描かれるため、
//   配列にすると必ず実物とずれる。

/** 順送りが辿るセクションの並び。★画面の並びと同じ順にすること。 */
export interface FieldSequenceSectionDef {
  key: string;
  open: boolean;
  setOpen: (open: boolean) => void;
}

interface Options {
  sections: readonly FieldSequenceSectionDef[];
}

/** 停止点の中で実際にフォーカスを受ける要素を探す。 */
function focusableIn(stop: Element): HTMLElement | null {
  return stop.querySelector<HTMLElement>(
    'input:not([disabled]), textarea:not([disabled]), select:not([disabled]), button:not([disabled]):not([tabindex="-1"]), [tabindex="0"]',
  );
}

/**
 * 順送りが効かない場所か。
 *
 * ★★メモ欄(textarea)ではこの仕組みを無効にする(指示書 §4.4.1 / D-578(5))。
 *   Enter は改行、↓ はカーソル移動であってほしい。抜けるのは Tab かクリックである。
 *
 * ★★★【M38-01・射程 1】数値入力の ↑↓ を**奪うようになった**。
 *   開発者の逐語＝「矢印でフォーカスを移動させれた方がうれしい」。
 *   ⇒ 除外していた number 分岐を落とした。呼び出し元(onKeyDown)が
 *     `preventDefault()` してから `move()` するため、**ブラウザ既定の増減の抑止と
 *     フォーカス移動が 1 手で揃う**。
 *   ★以下は失効した記述: 「数値入力では ↑↓ を奪わない。ブラウザ既定の増減が
 *     使えなくなるためである(Enter では進む)」(M24-12 の実装判断)。
 *   ★★スピナー(上下ボタン)は M24-12(`CHANGE-138`)で既に全撤去済みであり
 *     (`numericInput.ts` の `NO_SPINNER`)、本変更で「押せるのに効かないボタン」は
 *     生じない。⇒ 増減の手段が残るのはキーボードだけだったので、それを閉じた。
 *
 * ★★★【M38-01 レビュー 低-3】**残っているのは textarea の 1 分岐だけである。**
 *   ⇒ 引数 `key` は現在どの分岐からも読まれていない。**将来の余地として残してある**
 *     (キーごとに分ける必要が出たときに、呼び出し元 1 か所を触らずに済む)。
 *   ★意図して残しているものであり、消し忘れではない。⇒ 消すなら呼び出し元も直すこと。
 */
function keyIsClaimedByField(el: Element | null, _key: string): boolean {
  if (!el) return false;
  return el.tagName === "TEXTAREA";
}

export function useFieldSequence({ sections }: Options) {
  const rootRef = useRef<HTMLDivElement>(null);
  // 畳まれたセクションを開いた直後に focus するための予約。
  // ★開いた瞬間はまだ中身が DOM に無い(CollapsibleFieldset は畳むとアンマウントする)。
  //   ⇒ 「開く → 次の描画で focus」の 2 段にする。
  const [pendingFocus, setPendingFocus] = useState<{
    sectionKey: string;
    edge: "first" | "last";
  } | null>(null);

  const stopsOf = useCallback((sectionKey: string): HTMLElement[] => {
    const root = rootRef.current;
    if (!root) return [];
    const section = root.querySelector(`[data-seq-section="${sectionKey}"]`);
    if (!section) return [];
    return Array.from(
      section.querySelectorAll<HTMLElement>("[data-seq-stop]"),
      // ★★フォーカスを受けられない停止点は数に入れない。
      //   ★入れると順送りがそこで**詰まる**——focus 先が無いので動かず、
      //     利用者からは「Enter が効かなくなった」ようにしか見えない。
      //   ★実際に詰まった: 始動技はレシピ先頭から自動で決まる**読み取り専用の表示**
      //     であり、入力欄を持たない(C-12 でプルダウンを撤去した)。E2E の
      //     「キーボードだけで最後まで進める」がこれを捕まえた。
      //   ⇒ 読み取り専用の欄は将来増えても自動的に飛ばされる。
    ).filter((stop) => focusableIn(stop) !== null);
  }, []);

  const focusStop = useCallback((stop: HTMLElement | undefined) => {
    if (!stop) return;
    const el = focusableIn(stop);
    if (!el) return;
    el.focus();
    // ★★M24-12(§4.11): この停止点が「到達したら開く」欄なら、中の要素をクリックする。
    //   ★★開き方を自前で作らず**クリックそのもの**を使う理由——指示書 §4.11 が
    //     「開いた後の操作をクリック時と同一にすること」を求めており、同じ経路を
    //     通せば作法が割れようがないからである。
    //   ★`Tab` の素通りでは呼ばれない(本関数は順送りからしか呼ばれない)。
    //   ★既に開いているなら押さない——押すと閉じてしまう。
    if (
      stop.hasAttribute("data-seq-open-on-arrival") &&
      el.getAttribute("aria-expanded") !== "true"
    ) {
      el.click();
      // ★★開いたあと、フォーカスを開いた本人へ戻す。
      //   ★★理由＝Radix の Popover は開くと中身へフォーカスを移すが、その中身は
      //     Portal で body 直下に描かれる。**順送りは「このパネルの中に居るとき」しか
      //     効かない**(下の onKeyDown のガード)ため、そのままだとタグ欄が順送りの
      //     行き止まりになる——**指示書 §5.1 (5)「タグ欄で止まらないこと」に反する。**
      //   ★戻すのは次のフレームである。Radix は effect の中でフォーカスを移すため、
      //     同じターンで戻しても上書きされる(実測)。
      //   ★★候補一覧は開いたままである。⇒ 見えるものはクリック時と同じで、
      //     違うのは最初にフォーカスが載る場所だけ(検索欄 か 開くボタン か)。
      //     **次の ↓ / Enter で欄を離れると Radix が閉じる**(フォーカスが外へ出るため)。
      requestAnimationFrame(() => el.focus());
    }
  }, []);

  useEffect(() => {
    if (!pendingFocus) return;
    const stops = stopsOf(pendingFocus.sectionKey);
    focusStop(
      pendingFocus.edge === "first" ? stops[0] : stops[stops.length - 1],
    );
    setPendingFocus(null);
  }, [pendingFocus, stopsOf, focusStop]);

  const move = useCallback(
    (direction: 1 | -1) => {
      const root = rootRef.current;
      if (!root) return;
      const active = document.activeElement;
      if (!(active instanceof HTMLElement)) return;
      const currentStop = active.closest("[data-seq-stop]");
      if (!currentStop) return;
      const currentSectionEl = currentStop.closest("[data-seq-section]");
      const currentSectionKey =
        currentSectionEl?.getAttribute("data-seq-section") ?? "";

      const model: SequenceSection[] = sections.map((s) => ({
        key: s.key,
        open: s.open,
        stopCount: s.open ? stopsOf(s.key).length : 0,
      }));
      const sectionIndex = sections.findIndex(
        (s) => s.key === currentSectionKey,
      );
      if (sectionIndex < 0) return;
      const stopIndex = stopsOf(currentSectionKey).indexOf(
        currentStop as HTMLElement,
      );
      if (stopIndex < 0) return;

      const target = nextSequenceTarget(
        model,
        { sectionIndex, stopIndex },
        direction,
      );

      if (target.kind === "stop") {
        focusStop(stopsOf(sections[target.sectionIndex].key)[target.stopIndex]);
        return;
      }
      if (target.kind === "open") {
        // ★★畳まれたセクションは飛ばさない・止まらない。開いてから移す(§4.4.2)。
        const section = sections[target.sectionIndex];
        section.setOpen(true);
        setPendingFocus({ sectionKey: section.key, edge: target.edge });
        return;
      }
      // ★★kind === "end" / "start" では何もしない。
      //   ★「末尾より先へ進んだら自動でレシピタブへ移す」形は**採らなかった**——
      //     開発者の逐語は「タブのみ。あるいは普通にクリックでレシピ遷移のボタンを
      //     押す。」(D-578(5)) であり、自動で移ることは求められていない。
      //   ★そもそも末尾の停止点はメモ欄であり、そこは順送りを無効にしてある。
      //     ⇒ 自動遷移を書いても到達しない死んだ経路になる。
    },
    [sections, stopsOf, focusStop],
  );

  const onKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>) => {
      if (event.defaultPrevented) return;
      if (event.altKey || event.ctrlKey || event.metaKey) return;

      const target = event.target as Element | null;
      // ★★Popover(キャラ選択・タグ選択)の中は対象外にする。
      //   Radix は Portal で body 直下へ描くため DOM 上はここに含まれないが、
      //   **React の合成イベントは React ツリーを辿って上がってくる**ので、
      //   何もしないと候補を選ぶ Enter / ↓ を順送りが奪う。
      //   ⇒ 物理的にこのパネルの中に居るときだけ効かせる。
      if (!target || !rootRef.current?.contains(target)) return;

      const key = event.key;
      if (key !== "Enter" && key !== "ArrowDown" && key !== "ArrowUp") return;
      // ★メモ欄(textarea)の既定動作は奪わない。
      //   ★★M38-01: 数値入力は**奪う側へ回った**(上記 keyIsClaimedByField)。
      if (keyIsClaimedByField(document.activeElement, key)) return;
      if (!(document.activeElement as HTMLElement | null)?.closest?.(
        "[data-seq-stop]",
      )) {
        return;
      }

      event.preventDefault();
      move(key === "ArrowUp" ? -1 : 1);
    },
    [move],
  );

  return { rootRef, onKeyDown };
}
