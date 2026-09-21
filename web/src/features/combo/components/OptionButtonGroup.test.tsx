import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import { OptionButtonGroup } from "./OptionButtonGroup";

const THREE = [
  { value: "a", label: "あ" },
  { value: "b", label: "い" },
  { value: "c", label: "う" },
] as const;

describe("M24-12 OptionButtonGroup(選択肢のボタン群・汎用部品)", () => {
  describe("単一選択", () => {
    it("押した選択肢が onChange へ渡る", () => {
      const onChange = vi.fn();
      render(
        <OptionButtonGroup
          mode="single"
          ariaLabel="テスト"
          testIdPrefix="t"
          options={THREE}
          value="a"
          onChange={onChange}
        />,
      );
      fireEvent.click(screen.getByTestId("t-b"));
      expect(onChange).toHaveBeenCalledWith("b");
    });

    // ★指示書 §4.3「有効なボタンは背景色が変わる」。
    it("★有効なボタンだけ見た目が変わる(aria-checked と背景)", () => {
      render(
        <OptionButtonGroup
          mode="single"
          ariaLabel="テスト"
          testIdPrefix="t"
          options={THREE}
          value="b"
          onChange={vi.fn()}
        />,
      );
      expect(screen.getByTestId("t-b").getAttribute("aria-checked")).toBe("true");
      expect(screen.getByTestId("t-b").className).toContain("bg-blue-600");
      expect(screen.getByTestId("t-a").getAttribute("aria-checked")).toBe("false");
      expect(screen.getByTestId("t-a").className).not.toContain("bg-blue-600");
    });

    it("数字キーで n 番目を選べる", () => {
      const onChange = vi.fn();
      render(
        <OptionButtonGroup
          mode="single"
          ariaLabel="テスト"
          testIdPrefix="t"
          options={THREE}
          value="a"
          onChange={onChange}
        />,
      );
      fireEvent.keyDown(screen.getByTestId("t"), { key: "3" });
      expect(onChange).toHaveBeenCalledWith("c");
    });

    // ★★複数選択と挙動を 2 種類作らないため、単一選択でも数字では進めない。
    it("★選択肢の数を超える数字キーは何もしない", () => {
      const onChange = vi.fn();
      render(
        <OptionButtonGroup
          mode="single"
          ariaLabel="テスト"
          testIdPrefix="t"
          options={THREE}
          value="a"
          onChange={onChange}
        />,
      );
      fireEvent.keyDown(screen.getByTestId("t"), { key: "4" });
      fireEvent.keyDown(screen.getByTestId("t"), { key: "0" });
      expect(onChange).not.toHaveBeenCalled();
    });

    it("★数字キー以外は奪わない(他の仕組みへ通す)", () => {
      const onChange = vi.fn();
      render(
        <OptionButtonGroup
          mode="single"
          ariaLabel="テスト"
          testIdPrefix="t"
          options={THREE}
          value="a"
          onChange={onChange}
        />,
      );
      for (const key of ["Enter", "Tab", "ArrowDown", "a"]) {
        fireEvent.keyDown(screen.getByTestId("t"), { key });
      }
      expect(onChange).not.toHaveBeenCalled();
    });

    // ★修飾キー付きはブラウザ/OS の割当なので奪わない。
    it("★Ctrl / Alt / Meta つきの数字キーは奪わない", () => {
      const onChange = vi.fn();
      render(
        <OptionButtonGroup
          mode="single"
          ariaLabel="テスト"
          testIdPrefix="t"
          options={THREE}
          value="a"
          onChange={onChange}
        />,
      );
      fireEvent.keyDown(screen.getByTestId("t"), { key: "2", ctrlKey: true });
      fireEvent.keyDown(screen.getByTestId("t"), { key: "2", altKey: true });
      fireEvent.keyDown(screen.getByTestId("t"), { key: "2", metaKey: true });
      expect(onChange).not.toHaveBeenCalled();
    });

    // ★★M24-12(レビュー 高-3): 物理キーボード入力(M21-05)との二重発火を止める。
    //   ★`useKeyboardInput` は window の capture 段で動き、利用者が割り当てたキーに
    //     対して `preventDefault()` を呼ぶ。これを見ないと、数字を技へ割り当てて
    //     いる利用者では**レシピにステップが入ると同時に選択肢もトグルされる**。
    //   ★実測(2026-08-28): ガード追加前は 2 を弱パンチへ割り当てた状態で
    //     「ステップが 1 本増え、かつ選択肢が変わる」ことを E2E で確認した。
    //     ガード追加後はステップだけが増え、選択肢は変わらない。
    it("★★他のハンドラが既に扱ったキー(defaultPrevented)には触らない", () => {
      const onChange = vi.fn();
      render(
        <OptionButtonGroup
          mode="single"
          ariaLabel="テスト"
          testIdPrefix="t"
          options={THREE}
          value="a"
          onChange={onChange}
        />,
      );
      // ★物理キーボード入力の実際の形を模す——`useKeyboardInput` は
      //   `window.addEventListener("keydown", handler, true)` の **capture 段**で
      //   `preventDefault()` を呼ぶ。
      //   ★`fireEvent(el, { defaultPrevented: true })` では模せない
      //     （defaultPrevented は読み取り専用の算出値であり、渡しても効かない）。
      const claim = (e: Event) => e.preventDefault();
      window.addEventListener("keydown", claim, true);
      try {
        fireEvent.keyDown(screen.getByTestId("t"), { key: "2" });
      } finally {
        window.removeEventListener("keydown", claim, true);
      }
      expect(onChange).not.toHaveBeenCalled();

      // ★対照: 誰も扱っていなければ従来どおり効く。
      fireEvent.keyDown(screen.getByTestId("t"), { key: "2" });
      expect(onChange).toHaveBeenCalledWith("b");
    });

    it("非活性のときは押しても数字キーでも変わらない", () => {
      const onChange = vi.fn();
      render(
        <OptionButtonGroup
          mode="single"
          ariaLabel="テスト"
          testIdPrefix="t"
          options={THREE}
          value="a"
          disabled
          disabledReason="固定中"
          onChange={onChange}
        />,
      );
      fireEvent.click(screen.getByTestId("t-b"));
      fireEvent.keyDown(screen.getByTestId("t"), { key: "2" });
      expect(onChange).not.toHaveBeenCalled();
      expect(screen.getByText("固定中")).toBeTruthy();
    });

    it("★11 個以上あっても 10 個までしか数字を出さない", () => {
      const many = Array.from({ length: 12 }, (_, i) => ({
        value: `v${i}`,
        label: `L${i}`,
      }));
      render(
        <OptionButtonGroup
          mode="single"
          ariaLabel="テスト"
          testIdPrefix="t"
          options={many}
          value="v0"
          onChange={vi.fn()}
        />,
      );
      // 10 番目(添字 9)までは数字が付く。
      expect(screen.getByTestId("t-v9").textContent).toContain("0");
      // 11 番目以降はラベルだけ。
      expect(screen.getByTestId("t-v10").textContent).toBe("L10");
    });
  });

  describe("複数選択(起き攻め)", () => {
    it("押した選択肢が onToggle へ渡る", () => {
      const onToggle = vi.fn();
      render(
        <OptionButtonGroup
          mode="multiple"
          ariaLabel="テスト"
          testIdPrefix="t"
          options={THREE}
          values={["a"]}
          onToggle={onToggle}
        />,
      );
      fireEvent.click(screen.getByTestId("t-b"));
      expect(onToggle).toHaveBeenCalledWith("b");
    });

    it("★選択済みも数字キーで押せる(選び直しではなくトグルである)", () => {
      const onToggle = vi.fn();
      render(
        <OptionButtonGroup
          mode="multiple"
          ariaLabel="テスト"
          testIdPrefix="t"
          options={THREE}
          values={["a"]}
          onToggle={onToggle}
        />,
      );
      fireEvent.keyDown(screen.getByTestId("t"), { key: "1" });
      expect(onToggle).toHaveBeenCalledWith("a");
    });

    it("複数を同時に選べる", () => {
      render(
        <OptionButtonGroup
          mode="multiple"
          ariaLabel="テスト"
          testIdPrefix="t"
          options={THREE}
          values={["a", "c"]}
          onToggle={vi.fn()}
        />,
      );
      expect(screen.getByTestId("t-a").getAttribute("aria-checked")).toBe("true");
      expect(screen.getByTestId("t-b").getAttribute("aria-checked")).toBe("false");
      expect(screen.getByTestId("t-c").getAttribute("aria-checked")).toBe("true");
    });

    // ★単一選択と同じ見た目にすると「1 つしか選べない」と誤読される。
    it("★単一選択と見分けが付く(チェック記号と role)", () => {
      render(
        <OptionButtonGroup
          mode="multiple"
          ariaLabel="テスト"
          testIdPrefix="t"
          options={THREE}
          values={["a"]}
          onToggle={vi.fn()}
        />,
      );
      expect(screen.getByTestId("t-a").textContent).toContain("☑");
      expect(screen.getByTestId("t-b").textContent).toContain("☐");
      expect(screen.getByTestId("t-a").getAttribute("role")).toBe("checkbox");
    });
  });
});
