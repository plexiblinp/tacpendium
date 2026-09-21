import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import "@/lib/i18n";

import PresetListTable from "./PresetListTable";
import type { Preset } from "../types";

// ★§5.1-12: 別の利用者のプリセットを編集できない。かつ「編集できない」ことが
// 利用者に伝わる形になっている(CHANGE-113 §3.10)。
// ★押せるのに何も起きない形にしない。失敗だけが出る形にもしない。
//
// ★タグはこれと形が違う。そもそも見えないため、この文言は使わない(D-402 / §3.11)。

const OWN: Preset = { id: 10, code: "own", name: "自分のプリセット", isBuiltin: false, userId: 1 };
const OTHERS: Preset = {
  id: 11,
  code: "others",
  name: "他人のプリセット",
  isBuiltin: false,
  userId: 2,
};

function renderTable(currentUserId?: number) {
  return render(
    <MemoryRouter>
      <PresetListTable
        builtins={[]}
        customs={[OWN, OTHERS]}
        sampleCharacterId={undefined}
        currentPresetId={undefined}
        limitReached={false}
        onCopy={vi.fn()}
        onDelete={vi.fn()}
        onUse={vi.fn()}
        currentUserId={currentUserId}
        ownerName={(id) => (id === 2 ? "B" : "A")}
      />
    </MemoryRouter>,
  );
}

describe("PresetListTable の所有者表示", () => {
  it("他人のプリセットには編集・削除を出さない", () => {
    renderTable(1);

    // 自分のものには出る(対照)。
    expect(screen.getByTestId(`preset-edit-${OWN.id}`)).toBeTruthy();
    expect(screen.getByTestId(`preset-delete-${OWN.id}`)).toBeTruthy();

    // ★他人のものには出さない。押せるのに何も起きない形を作らない。
    expect(screen.queryByTestId(`preset-edit-${OTHERS.id}`)).toBeNull();
    expect(screen.queryByTestId(`preset-delete-${OTHERS.id}`)).toBeNull();
  });

  it("他人のものだと分かる印と理由を出す", () => {
    renderTable(1);

    expect(screen.getByTestId(`preset-other-owner-${OTHERS.id}`).textContent).toBe(
      "ほかの人が作ったプリセット",
    );
    const note = screen.getByTestId(`preset-other-owner-note-${OTHERS.id}`).textContent ?? "";
    expect(note).toContain("B");
    expect(note).toContain("見ることはできますが");
    // ★「自分で作れば変えられる」まで伝える(できないことだけを言わない)。
    expect(note).toContain("自分でプリセットを作ると");

    // 自分のものには印を出さない。
    expect(screen.queryByTestId(`preset-other-owner-${OWN.id}`)).toBeNull();
  });

  it("他人のプリセットでも「使用する」は選べる(参照はできる)", () => {
    renderTable(1);
    expect(screen.getByTestId(`preset-use-${OTHERS.id}`)).toBeTruthy();
  });

  // 利用者が未選択(1 人運用など)のときは、従来どおり全部編集できる。
  it("利用者が未選択なら従来どおり編集できる", () => {
    renderTable(undefined);

    expect(screen.getByTestId(`preset-edit-${OTHERS.id}`)).toBeTruthy();
    expect(screen.queryByTestId(`preset-other-owner-${OTHERS.id}`)).toBeNull();
  });
});
