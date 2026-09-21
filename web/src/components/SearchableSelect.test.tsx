import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { SearchableSelect, type SearchableSelectOption } from "./SearchableSelect";

const TAGS: SearchableSelectOption<number>[] = [
  { value: 1, label: "起き攻め", colorDot: "#10B981" },
  { value: 2, label: "画面端" },
  { value: 3, label: "SA3 締め" },
  { value: 4, label: "ドライブラッシュ始動" },
];

const CHARS: SearchableSelectOption<number>[] = [
  { value: 1, label: "リュウ", searchTexts: ["リュウ", "Ryu", "ryu"] },
  { value: 2, label: "ケン", searchTexts: ["ケン", "Ken", "ken"] },
  { value: 3, label: "ダルシム", searchTexts: ["ダルシム", "Dhalsim", "dhalsim"] },
];

function renderMulti(selected: number[] = [], onChange = vi.fn()) {
  render(
    <SearchableSelect
      mode="multi"
      options={TAGS}
      selected={selected}
      onChange={onChange}
      triggerLabel="タグ"
      searchPlaceholder="タグを検索"
      emptyMessage="タグが見つかりません"
      clearLabel={(n) => `選択を解除（${n} 件）`}
      data-testid="tag-filter"
    />,
  );
  return onChange;
}

describe("SearchableSelect（複数選択）", () => {
  it("★閉じた状態でも選択件数が分かる", async () => {
    renderMulti([1, 3]);
    expect(screen.getByTestId("tag-filter-count").textContent).toBe("2");
  });

  it("★未選択のときは件数バッジを出さない", () => {
    renderMulti([]);
    expect(screen.queryByTestId("tag-filter-count")).toBeNull();
  });

  it("開くと検索欄と全件が出る", async () => {
    const user = userEvent.setup();
    renderMulti();
    await user.click(screen.getByRole("combobox"));
    expect(screen.getByPlaceholderText("タグを検索")).toBeDefined();
    expect(screen.getAllByRole("option")).toHaveLength(TAGS.length);
  });

  it("検索語で絞り込める", async () => {
    const user = userEvent.setup();
    renderMulti();
    await user.click(screen.getByRole("combobox"));
    await user.type(screen.getByPlaceholderText("タグを検索"), "攻め");
    const options = screen.getAllByRole("option");
    expect(options).toHaveLength(1);
    expect(options[0].textContent).toContain("起き攻め");
  });

  it("一致が無ければ空メッセージを出す", async () => {
    const user = userEvent.setup();
    renderMulti();
    await user.click(screen.getByRole("combobox"));
    await user.type(screen.getByPlaceholderText("タグを検索"), "存在しない");
    expect(screen.queryAllByRole("option")).toHaveLength(0);
    expect(screen.getByText("タグが見つかりません")).toBeDefined();
  });

  it("選ぶと onChange に追加され、外すと除かれる", async () => {
    const user = userEvent.setup();
    const onChange = renderMulti([], vi.fn());
    await user.click(screen.getByRole("combobox"));
    await user.click(screen.getByRole("option", { name: /起き攻め/ }));
    expect(onChange).toHaveBeenCalledWith([1]);
  });

  it("★連続でトグルしても閉じない（列カスタマイズと同じ作法）", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderMulti([], onChange);
    await user.click(screen.getByRole("combobox"));
    await user.click(screen.getByRole("option", { name: /起き攻め/ }));
    // 閉じていれば検索欄が消える
    expect(screen.getByPlaceholderText("タグを検索")).toBeDefined();
    await user.click(screen.getByRole("option", { name: /画面端/ }));
    expect(onChange).toHaveBeenCalledTimes(2);
  });

  it("★選択があるときだけ解除行を出し、押すと空になる", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <SearchableSelect
        mode="multi"
        options={TAGS}
        selected={[1, 2]}
        onChange={onChange}
        triggerLabel="タグ"
        searchPlaceholder="タグを検索"
        emptyMessage="なし"
        clearLabel={(n) => `選択を解除（${n} 件）`}
      />,
    );
    await user.click(screen.getByRole("combobox"));
    await user.click(screen.getByText("選択を解除（2 件）"));
    expect(onChange).toHaveBeenCalledWith([]);
  });

  it("選択が無いときは解除行を出さない", async () => {
    const user = userEvent.setup();
    renderMulti([]);
    await user.click(screen.getByRole("combobox"));
    expect(screen.queryByText(/選択を解除/)).toBeNull();
  });
});

describe("SearchableSelect（単一選択）", () => {
  function renderSingle(selected: number | null, onChange = vi.fn()) {
    render(
      <SearchableSelect
        mode="single"
        options={CHARS}
        selected={selected}
        onChange={onChange}
        placeholder="キャラクターを選択"
        searchPlaceholder="キャラクターを検索"
        emptyMessage="見つかりません"
        triggerAriaLabel="対象キャラ"
      />,
    );
    return onChange;
  }

  it("選択中の表示名をトリガに出す", () => {
    renderSingle(1);
    expect(screen.getByRole("combobox").textContent).toContain("リュウ");
  });

  it("未選択のときは placeholder を出す", () => {
    renderSingle(null);
    expect(screen.getByRole("combobox").textContent).toContain("キャラクターを選択");
  });

  it("ariaLabel がトリガに付く", () => {
    renderSingle(1);
    expect(screen.getByLabelText("対象キャラ")).toBeDefined();
  });

  it("★name_en / code でも引ける", async () => {
    const user = userEvent.setup();
    renderSingle(1);
    await user.click(screen.getByRole("combobox"));
    await user.type(screen.getByPlaceholderText("キャラクターを検索"), "dhal");
    const options = screen.getAllByRole("option");
    expect(options).toHaveLength(1);
    expect(options[0].textContent).toContain("ダルシム");
  });

  it("★選ぶと閉じる（単一選択は選び終わりであるため）", async () => {
    const user = userEvent.setup();
    const onChange = renderSingle(1, vi.fn());
    await user.click(screen.getByRole("combobox"));
    await user.click(screen.getByRole("option", { name: /ケン/ }));
    expect(onChange).toHaveBeenCalledWith(2);
    expect(screen.queryByPlaceholderText("キャラクターを検索")).toBeNull();
  });

  it("disabled のとき開かない", async () => {
    const user = userEvent.setup();
    render(
      <SearchableSelect
        mode="single"
        options={CHARS}
        selected={1}
        onChange={vi.fn()}
        placeholder="選択"
        searchPlaceholder="検索"
        emptyMessage="なし"
        disabled
      />,
    );
    await user.click(screen.getByRole("combobox"));
    expect(screen.queryByPlaceholderText("検索")).toBeNull();
  });
});

describe("SearchableSelect キーボード操作（M24-02 レビュー 中-4）", () => {
  it("★検索欄から ↓ で先頭の候補へ入れる", async () => {
    const user = userEvent.setup();
    renderMulti();
    await user.click(screen.getByRole("combobox"));
    await user.keyboard("{ArrowDown}");
    expect(document.activeElement?.textContent).toContain("起き攻め");
  });

  it("★↓↑ で候補を移動できる", async () => {
    const user = userEvent.setup();
    renderMulti();
    await user.click(screen.getByRole("combobox"));
    await user.keyboard("{ArrowDown}{ArrowDown}");
    expect(document.activeElement?.textContent).toContain("画面端");
    await user.keyboard("{ArrowUp}");
    expect(document.activeElement?.textContent).toContain("起き攻め");
  });

  it("★端で回り込む", async () => {
    const user = userEvent.setup();
    renderMulti();
    await user.click(screen.getByRole("combobox"));
    await user.keyboard("{ArrowUp}");
    expect(document.activeElement?.textContent).toContain("ドライブラッシュ始動");
  });

  it("★絞り込んだ後は残った候補だけを移動する", async () => {
    const user = userEvent.setup();
    renderMulti();
    await user.click(screen.getByRole("combobox"));
    await user.type(screen.getByPlaceholderText("タグを検索"), "攻め");
    await user.keyboard("{ArrowDown}{ArrowDown}");
    expect(document.activeElement?.textContent).toContain("起き攻め");
  });
});

// ★★M27-03(P4M-021): 閉じているときだけ出す短縮表記。
//
// ★native <select> では作れない形である——HTML の仕様上、閉じた表示は選択中
//   <option> のテキストそのものだからである。⇒ 本部品に任意の shortLabel を 1 つ足した。
describe("SearchableSelect（単一選択・shortLabel）", () => {
  const OPTS: SearchableSelectOption<string>[] = [
    { value: "", label: "全て" },
    { value: "normal", label: "通常", shortLabel: "通常" },
    {
      value: "just_parry_punish_counter",
      label: "パニッシュカウンター(ジャストパリィ反撃)",
      shortLabel: "PC(JP)",
    },
  ];

  function renderSingle(selected: string) {
    const onChange = vi.fn();
    render(
      <SearchableSelect
        mode="single"
        options={OPTS}
        selected={selected}
        onChange={onChange}
        placeholder="全て"
        searchPlaceholder="検索"
        emptyMessage="該当なし"
        data-testid="short-select"
      />,
    );
    return onChange;
  }

  it("★閉じているときは shortLabel を出す", () => {
    renderSingle("just_parry_punish_counter");
    const trigger = screen.getByTestId("short-select");
    expect(trigger.textContent).toContain("PC(JP)");
    expect(trigger.textContent).not.toContain(
      "パニッシュカウンター(ジャストパリィ反撃)",
    );
  });

  it("★開いた一覧はフル表記のままである", async () => {
    renderSingle("just_parry_punish_counter");
    await userEvent.setup().click(screen.getByTestId("short-select"));
    const list = screen.getByRole("listbox");
    expect(list.textContent).toContain(
      "パニッシュカウンター(ジャストパリィ反撃)",
    );
  });

  it("★shortLabel が無い選択肢は従来どおり label を出す(既存の利用箇所を壊さない)", () => {
    renderSingle("");
    expect(screen.getByTestId("short-select").textContent).toContain("全て");
  });

  it("★shortLabel も検索に当たる", async () => {
    renderSingle("");
    const user = userEvent.setup();
    await user.click(screen.getByTestId("short-select"));
    await user.type(screen.getByPlaceholderText("検索"), "PC(JP)");
    const list = screen.getByRole("listbox");
    expect(list.textContent).toContain(
      "パニッシュカウンター(ジャストパリィ反撃)",
    );
    expect(list.textContent).not.toContain("通常");
  });
});

// ★★M31-02: 検索欄の pointerdown が lib/text-drag-capture へ **結線されていること**。
//
//   ★★ここで固定するのは **結線** である。ガードの条件そのものの正本は
//     web/src/lib/text-drag-capture.test.ts であり、実体が 1 本なのでそちらで 1 度見る。
//     ⇒ 同じ役割を 2 ファイルが主張しない(M31-02 追補レビュー 高-1)。
//   ★4 条件すべてを残しているのは、**React の合成イベント経由でも同じ分岐になること**を
//     見るためである。共有関数側の試験は素のオブジェクトを渡しており、この経路を通らない。
//
//   実体(枠外へドラッグしても文字選択が消えないこと)は E2E が測る
//   (web/e2e/m31-02-character-picker-drag.spec.ts)。jsdom には文字選択の実装が無く、
//   ここでは測れない。
//
//   ★タッチ・ペン・右クリックで張らない根拠は「スマホ専用画面が在ること」ではなく、
//     **これらの欄を持つ画面がいずれもレスポンシブであり、タッチ環境でも使われること**である
//     (DES-005 §4.4 / §7)。★本体サブのレビュー 低-6 で撤回済みの根拠を書かないこと。
//   ★E2E は chromium 1 プロジェクトだけでタッチ文脈を持たないため、この分岐は単体で見るしかない。
describe("SearchableSelect（検索欄のポインタキャプチャの結線 / M31-02）", () => {
  function openAndSpy() {
    render(
      <SearchableSelect
        mode="single"
        options={CHARS}
        selected={1}
        onChange={vi.fn()}
        placeholder="未選択"
        searchPlaceholder="キャラクターを検索"
        emptyMessage="キャラクターが見つかりません"
        data-testid="char-select"
      />,
    );
    return screen.getByTestId("char-select");
  }

  async function openPopover() {
    const user = userEvent.setup();
    await user.click(openAndSpy());
    const search = screen.getByPlaceholderText("キャラクターを検索");
    const spy = vi.fn();
    // jsdom は setPointerCapture を持たない。どちらでも観測できるよう差し替える。
    (search as HTMLInputElement).setPointerCapture = spy;
    return { search, spy };
  }

  // ★★jsdom には `PointerEvent` が無い(実測: `typeof PointerEvent === "undefined"`)。
  //   ⇒ `fireEvent.pointerDown(el, { pointerType, button, pointerId })` を使うと
  //     **3 つとも黙って落ちる**(受け側は `type` しか受け取らない)。
  //     そのまま書くと「タッチでは張らない」が常に緑になり、ガードを外しても気づけない。
  //   ⇒ `MouseEvent` を組み立てて、足りない属性を載せてから投げる。
  function dispatchPointerDown(
    el: HTMLElement,
    init: { pointerType: string; button: number; pointerId: number },
  ) {
    const ev = new MouseEvent("pointerdown", { bubbles: true, button: init.button });
    Object.assign(ev, { pointerType: init.pointerType, pointerId: init.pointerId });
    fireEvent(el, ev);
  }

  it("マウスの主ボタンならキャプチャを張る", async () => {
    const { search, spy } = await openPopover();
    dispatchPointerDown(search, { pointerType: "mouse", button: 0, pointerId: 7 });
    expect(spy).toHaveBeenCalledWith(7);
  });

  it("★タッチでは張らない（タッチ環境の挙動を変えないこと）", async () => {
    const { search, spy } = await openPopover();
    dispatchPointerDown(search, { pointerType: "touch", button: 0, pointerId: 7 });
    expect(spy).not.toHaveBeenCalled();
  });

  it("★ペンでは張らない", async () => {
    const { search, spy } = await openPopover();
    dispatchPointerDown(search, { pointerType: "pen", button: 0, pointerId: 7 });
    expect(spy).not.toHaveBeenCalled();
  });

  it("★右クリックでは張らない", async () => {
    const { search, spy } = await openPopover();
    dispatchPointerDown(search, { pointerType: "mouse", button: 2, pointerId: 7 });
    expect(spy).not.toHaveBeenCalled();
  });
});
