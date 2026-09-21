// 「何がモーダルとして数えられるか」の契約（M21-07 §4.5-3・チェックリスト §1）。
//
// ★**本ファイルが対照実験の本体である。** 「モーダルなら登録される」だけを見ると、
//   **すべてを登録していても緑になる**（`SUPP-001` §5.5 (10′)）。⇒ モーダルでない重なりが
//   登録**されない**ことを同じ数だけ主張する。
//
// ★**セレクタ・属性値を主張していない**（**D-380**）。主張しているのは
//   「利用者の注意が別の面へ移る部品か否か」という性質だけである。

import { render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent } from "@/components/ui/popover";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import { isAnyModalOpen } from "./modal-presence";

afterEach(() => {
  // 各ケースで unmount 済みであることを念のため確かめる（漏れると次のケースが常に true になる）。
  expect(isAnyModalOpen()).toBe(false);
});

describe("★モーダルとして数えるもの（共有プリミティブ 3 つ）", () => {
  it("Dialog を開いている間はモーダル扱いになる", () => {
    const view = render(
      <Dialog open>
        <DialogContent>
          <DialogTitle>t</DialogTitle>
          <DialogDescription>d</DialogDescription>
        </DialogContent>
      </Dialog>,
    );
    expect(isAnyModalOpen()).toBe(true);
    view.unmount();
  });

  it("AlertDialog を開いている間はモーダル扱いになる", () => {
    const view = render(
      <AlertDialog open>
        <AlertDialogContent>
          <AlertDialogTitle>t</AlertDialogTitle>
          <AlertDialogDescription>d</AlertDialogDescription>
        </AlertDialogContent>
      </AlertDialog>,
    );
    expect(isAnyModalOpen()).toBe(true);
    view.unmount();
  });

  it("Sheet を開いている間はモーダル扱いになる", () => {
    const view = render(
      <Sheet open>
        <SheetContent>
          <SheetTitle>t</SheetTitle>
          <SheetDescription>d</SheetDescription>
        </SheetContent>
      </Sheet>,
    );
    expect(isAnyModalOpen()).toBe(true);
    view.unmount();
  });

  it("閉じれば戻る（開きっぱなしにならない）", () => {
    const view = render(
      <Dialog open>
        <DialogContent>
          <DialogTitle>t</DialogTitle>
          <DialogDescription>d</DialogDescription>
        </DialogContent>
      </Dialog>,
    );
    expect(isAnyModalOpen()).toBe(true);
    view.rerender(
      <Dialog open={false}>
        <DialogContent>
          <DialogTitle>t</DialogTitle>
          <DialogDescription>d</DialogDescription>
        </DialogContent>
      </Dialog>,
    );
    expect(isAnyModalOpen()).toBe(false);
    view.unmount();
  });
});

// ★★共有プリミティブを通らない自作モーダルの取りこぼしを防ぐ番人（M21-07 レビュー指摘 高-1）。
//
// ★**初版は「アプリ内のモーダルは例外なく共有プリミティブを通る」と実査したつもりで誤っていた。**
//   `import` を grep する形の実査は、**自作のオーバーレイを構造的に見つけられない。**
//   実際に 2 件あり、うち 1 件（`ComboEditor` の「保存完了 — 警告があります」）は
//   **レシピ入力面と同じツリーに居て、`D-383` の欠陥がそのまま残っていた。**
//
// ★**⇒ 「見た目の側」から探す検査を置く。** 自作モーダルの目印になる語を含むファイルは、
//   `ModalPresenceMarker` を参照していなければならない。**新しく自作モーダルを書いた人は
//   ここで落ちる。**
// ★**除外リストを安易に増やさないこと。** 増やした時点で本検査は存在しないのと同じになる。
describe("★自作モーダルが登録から漏れていないこと", () => {
  const MARKER = "ModalPresenceMarker";
  /** 自作モーダルであることの目印（どれか 1 つでも当たれば対象）。 */
  const HINTS = ['aria-modal="true"', "aria-modal={true}"];
  /** 共有プリミティブ本体。★これらは「申告する側」であって「申告を要する側」ではない。 */
  const PRIMITIVES = ["src/components/ui/"];

  it("aria-modal を自分で書いているファイルは、必ず登録に参加している", async () => {
    const { readdirSync, readFileSync } = await import("node:fs");
    const { join, relative } = await import("node:path");

    const root = join(__dirname, "..");
    const offenders: string[] = [];

    const walk = (dir: string) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) {
          walk(full);
          continue;
        }
        if (!entry.name.endsWith(".tsx")) continue;
        if (entry.name.includes(".test.")) continue;
        const rel = relative(join(root, ".."), full).replace(/\\/g, "/");
        if (PRIMITIVES.some((p) => rel.includes(p))) continue;
        const source = readFileSync(full, "utf8");
        if (!HINTS.some((hint) => source.includes(hint))) continue;
        if (!source.includes(MARKER)) offenders.push(rel);
      }
    };
    walk(root);

    expect(offenders).toEqual([]);
  });
});

describe("★モーダルでない重なりは数えない（対照実験）", () => {
  it("Popover はモーダル扱いにならない", () => {
    const view = render(
      <Popover open>
        <PopoverContent>中身</PopoverContent>
      </Popover>,
    );
    expect(isAnyModalOpen()).toBe(false);
    view.unmount();
  });

  it("Tooltip はモーダル扱いにならない", () => {
    const view = render(
      <TooltipProvider>
        <Tooltip open>
          <TooltipTrigger>t</TooltipTrigger>
          <TooltipContent>中身</TooltipContent>
        </Tooltip>
      </TooltipProvider>,
    );
    expect(isAnyModalOpen()).toBe(false);
    view.unmount();
  });

  it("DropdownMenu はモーダル扱いにならない", () => {
    const view = render(
      <DropdownMenu open>
        <DropdownMenuContent>
          <DropdownMenuItem>項目</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>,
    );
    expect(isAnyModalOpen()).toBe(false);
    view.unmount();
  });
});
