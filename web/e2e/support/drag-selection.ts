import { expect, type Locator, type Page } from "@playwright/test";

// M31-02: popover の中の検索欄で始めたドラッグの、文字選択の維持を測る道具。
//
// ★★2 部品が同じ欠陥を持っていたため、測り方を共有している
//   (キャラ選択 = SearchableSelect ／ タグ欄 = TagSelector)。
//   ⇒ 片方の spec だけを直して、もう片方が古い測り方のまま残る形を作らない。
//
// ★spec ではないので *.spec.ts 以外の名前にしてある
//   (playwright の既定 testMatch に拾われないため)。

export type Box = { x: number; y: number; width: number; height: number };
export type Selection = { start: number | null; end: number | null };

export const EDGE = 8;
const OUT = 60;

export function selectionLength(s: Selection): number {
  return (s.end ?? 0) - (s.start ?? 0);
}

export function readSelection(input: Locator): Promise<Selection> {
  return input.evaluate((el) => {
    const i = el as HTMLInputElement;
    return { start: i.selectionStart, end: i.selectionEnd };
  });
}

/**
 * 開いている popover の中身(Radix の Popper ラッパの直下)の実測矩形。
 *
 * ★`Locator.evaluate` から辿るので `Page` は要らない。★引数に残すと未使用のまま通る——
 *   `noUnusedParameters` は効くが **`web/e2e/` は tsconfig の `include` 外**であり
 *   (web/CLAUDE.md §3)、ESLint も未導入なので**拾う経路が 1 本も無い**
 *   (M31-02 追補レビュー 中-1)。
 */
export async function popoverBox(input: Locator): Promise<Box | null> {
  return input.evaluate((el) => {
    const wrapper = el.closest("[data-radix-popper-content-wrapper]");
    const content = wrapper?.firstElementChild;
    if (!content) return null;
    const r = content.getBoundingClientRect();
    return { x: r.x, y: r.y, width: r.width, height: r.height };
  });
}

// ★★押下位置と出口を対にすること。
//   出口と同じ端で押し下げると、枠外へ出た時点で focus が anchor へ戻り、
//   **native の挙動として正しく collapse する**。⇒ それを「消えた」と判定すると
//   直っている部品を赤にする(実際に初版でそうなった)。
//   ⇒ 各方向とも「出口から遠い端で押し下げ、近い端までドラッグしてから外へ出る」。
//
// ★★脱出点は **popover の実測矩形** から決める。入力欄からの相対で決めない。
//   popover の高さは候補件数で変わる(実測: 候補 1 件で bottom=261.7 / 全件で bottom=418.0)。
//   ⇒ 入力欄からの固定オフセットだと、候補が増えた日に脱出点が popover の中に留まり、
//     **テストが静かに vacuous になる**(赤くならないので誰も気づけない)。
export const DIRECTIONS: {
  name: string;
  press: (b: Box) => { x: number; y: number };
  drag: (b: Box) => { x: number; y: number };
  exit: (b: Box, pop: Box) => { x: number; y: number };
}[] = [
  {
    name: "左",
    press: (b) => ({ x: b.x + b.width - EDGE, y: b.y + b.height / 2 }),
    drag: (b) => ({ x: b.x + EDGE, y: b.y + b.height / 2 }),
    exit: (b, pop) => ({ x: pop.x - OUT, y: b.y + b.height / 2 }),
  },
  {
    name: "右",
    press: (b) => ({ x: b.x + EDGE, y: b.y + b.height / 2 }),
    drag: (b) => ({ x: b.x + b.width - EDGE, y: b.y + b.height / 2 }),
    exit: (b, pop) => ({ x: pop.x + pop.width + OUT, y: b.y + b.height / 2 }),
  },
  {
    // 縦の出口は x を左端に留める。⇒ focus は左端のまま維持されるはずである。
    name: "上",
    press: (b) => ({ x: b.x + b.width - EDGE, y: b.y + b.height / 2 }),
    drag: (b) => ({ x: b.x + EDGE, y: b.y + b.height / 2 }),
    exit: (b, pop) => ({ x: b.x + EDGE, y: pop.y - OUT }),
  },
  {
    // ★★下だけ押下位置が逆である(左端で押す)。
    //   1 行の <input> では、ポインタが行より下へ出ると **native の挙動として**
    //   キャレットが文字列の末尾へ動く(素の <input> でも同じであることを実測した)。
    //   ⇒ anchor を右端に置くと focus が anchor へ重なり、正しく collapse する。
    //     それを「消えた」と判定すると、直っている部品を赤にする。
    //   ⇒ anchor を左端に置く。すると focus は末尾のまま維持されるはずである。
    name: "下",
    press: (b) => ({ x: b.x + EDGE, y: b.y + b.height / 2 }),
    drag: (b) => ({ x: b.x + b.width - EDGE, y: b.y + b.height / 2 }),
    exit: (b, pop) => ({ x: b.x + b.width - EDGE, y: pop.y + pop.height + OUT }),
  },
];

/**
 * 1 方向ぶんのジェスチャを実行し、枠内で選択が出来ていることと、
 * 枠外へ出ても消えないことを assert する。
 */
export async function expectSelectionSurvivesDragOut(
  page: Page,
  search: Locator,
  dir: (typeof DIRECTIONS)[number],
): Promise<void> {
  const b = (await search.boundingBox())!;

  const press = dir.press(b);
  const drag = dir.drag(b);
  await page.mouse.move(press.x, press.y);
  await page.mouse.down();
  await page.mouse.move(drag.x, drag.y, { steps: 10 });

  // ★陽性対照の前提: 枠内では選択が出来ていること。
  //   ここが 0 なら以降の判定に意味が無い(「もともと選択できていない」と区別できない)。
  const inside = await readSelection(search);
  expect(
    selectionLength(inside),
    `枠内で文字選択が出来ていない: ${JSON.stringify(inside)}`,
  ).toBeGreaterThan(0);

  const pop = (await popoverBox(search))!;
  const out = dir.exit(b, pop);
  // ★脱出点が本当に popover の外であることを、毎回その場で確かめる。
  //   ⇒ 「外へ出たつもりで中に居た」まま緑になる形を塞ぐ。
  expect(
    out.x < pop.x || out.x > pop.x + pop.width || out.y < pop.y || out.y > pop.y + pop.height,
    `脱出点が popover の中に留まっている: out=${JSON.stringify(out)} popover=${JSON.stringify(pop)}`,
  ).toBe(true);

  await page.mouse.move(out.x, out.y, { steps: 10 });
  const outside = await readSelection(search);
  await page.mouse.up();

  expect(
    selectionLength(outside),
    `${dir.name}へ出たところで文字選択が消えた: 枠内=${JSON.stringify(inside)} 枠外=${JSON.stringify(outside)}`,
  ).toBeGreaterThan(0);
}
