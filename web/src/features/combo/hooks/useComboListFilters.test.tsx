import { renderHook, act, waitFor } from "@testing-library/react";
import { describe, it, expect, beforeEach } from "vitest";
import { MemoryRouter } from "react-router-dom";
import type { ReactNode } from "react";
import {
  clearSessionCharacterId,
  readSessionCharacterId,
  useComboListFilters,
} from "./useComboListFilters";

// C-01 のセッション保持(combo-list-filters-v1)がテスト間で漏れないようクリアする。
beforeEach(() => {
  sessionStorage.clear();
});

function wrapper(initialEntries: string[] = ["/"]) {
  return ({ children }: { children: ReactNode }) => (
    <MemoryRouter initialEntries={initialEntries}>{children}</MemoryRouter>
  );
}

describe("useComboListFilters", () => {
  it("restores filters from URL query parameters", () => {
    const { result } = renderHook(() => useComboListFilters(), {
      wrapper: wrapper([
        "/?character_id=1&position=corner_self&hit_type=counter&starter_move_id=42&opponent_stance=crouching&is_draft=true&sort=damage&order=asc&tag_ids=1,2",
      ]),
    });
    expect(result.current.filters).toEqual({
      characterId: 1,
      tagIds: [1, 2],
      position: "corner_self",
      hitType: "counter",
      starterMoveId: 42,
      opponentStance: "crouching",
      starterMeaty: null, // M37-07: URL 未指定は絞り込みなし
      isDraft: true,
      setupResult: null,
      setupTechType: null,
      setupInCorner: null,
      sort: "damage",
      order: "asc",
    });
  });

  // ★★M27-03(P4M-022): 始動技フィルタが URL を往復すること。
  //   ★sessionStorage(combo-list-filters-v1)は「生の URL クエリ文字列」を持つ形なので、
  //     URL に載れば戻り時の保持も自動的に効く。新しいストレージキーは要らない。
  it("★始動技フィルタが URL を往復する", () => {
    const { result } = renderHook(() => useComboListFilters(), {
      wrapper: wrapper(["/"]),
    });

    act(() => {
      result.current.updateFilters({ starterMoveId: 42 });
    });
    expect(result.current.filters.starterMoveId).toBe(42);

    act(() => {
      result.current.updateFilters({ starterMoveId: null });
    });
    expect(result.current.filters.starterMoveId).toBeNull();
  });

  it("★始動技フィルタは「効いているフィルタ」に数える(解除ボタンが活性になる)", () => {
    const { result } = renderHook(() => useComboListFilters(), {
      wrapper: wrapper(["/?starter_move_id=42"]),
    });
    expect(result.current.hasActiveFilters).toBe(true);
  });

  it("updates URL when updateFilters is called", () => {
    const { result } = renderHook(() => useComboListFilters(), {
      wrapper: wrapper(["/"]),
    });

    act(() => {
      result.current.updateFilters({ position: "mid_screen" });
    });

    expect(result.current.filters.position).toBe("mid_screen");
  });

  // C-02: 既定ソートは更新日時(降順=最近)。URL パラメータが無いときの初期値。
  it("defaults sort to updated_at descending when URL has no params", () => {
    const { result } = renderHook(() => useComboListFilters(), {
      wrapper: wrapper(["/"]),
    });

    expect(result.current.filters.sort).toBe("updated_at");
    expect(result.current.filters.order).toBe("desc");
  });

  // 始動状況順(default) は引き続き選択でき、既定ではないため URL へ書き出され round-trip する。
  it("keeps default(始動状況) sort selectable and round-trips it", () => {
    const { result } = renderHook(() => useComboListFilters(), {
      wrapper: wrapper(["/"]),
    });

    act(() => {
      result.current.updateFilters({ sort: "default" });
    });

    expect(result.current.filters.sort).toBe("default");
  });

  // C-01/N-30: 一覧→他画面→一覧(URLパラメータ無し)で戻った時、セッション保存からフィルタ/ソートを復元する。
  it("restores filters from session storage when returning with an empty URL", async () => {
    // 1回目: フィルタ付きでマウント → セッションへ保存される。
    const first = renderHook(() => useComboListFilters(), {
      wrapper: wrapper(["/?character_id=2&position=mid_screen&sort=damage&order=asc"]),
    });
    await waitFor(() =>
      expect(first.result.current.filters.position).toBe("mid_screen"),
    );
    first.unmount();

    // 2回目: パラメータ無しでマウント(=戻ってきた状態) → 保存値から復元される。
    const second = renderHook(() => useComboListFilters(), {
      wrapper: wrapper(["/"]),
    });
    await waitFor(() => {
      expect(second.result.current.filters.position).toBe("mid_screen");
      expect(second.result.current.filters.characterId).toBe(2);
      expect(second.result.current.filters.sort).toBe("damage");
      expect(second.result.current.filters.order).toBe("asc");
    });
  });

  it("restores combined filters correctly", () => {
    const { result } = renderHook(() => useComboListFilters(), {
      wrapper: wrapper([
        "/?character_id=1&tag_ids=3,5&position=corner_opponent&sort=updated_at&order=asc",
      ]),
    });

    expect(result.current.filters.characterId).toBe(1);
    expect(result.current.filters.tagIds).toEqual([3, 5]);
    expect(result.current.filters.position).toBe("corner_opponent");
    expect(result.current.filters.sort).toBe("updated_at");
    expect(result.current.filters.order).toBe("asc");
    expect(result.current.filters.isDraft).toBeNull();
    expect(result.current.filters.hitType).toBeNull();
    expect(result.current.filters.opponentStance).toBeNull();
  });

  // -------------------------------------------------------------------------
  // 成立条件フィルタ (M19-06)
  // -------------------------------------------------------------------------

  it("成立条件の 3 項目を URL から復元する", () => {
    const { result } = renderHook(() => useComboListFilters(), {
      wrapper: wrapper([
        "/?setup_result=unverified&setup_tech_type=back_tech&setup_in_corner=true",
      ]),
    });

    expect(result.current.filters.setupResult).toBe("unverified");
    expect(result.current.filters.setupTechType).toBe("back_tech");
    expect(result.current.filters.setupInCorner).toBe(true);
  });

  it("値域外の URL は未指定として扱う", () => {
    const { result } = renderHook(() => useComboListFilters(), {
      wrapper: wrapper([
        "/?setup_result=maybe&setup_tech_type=quick_rise&setup_in_corner=corner",
      ]),
    });

    expect(result.current.filters.setupResult).toBeNull();
    expect(result.current.filters.setupTechType).toBeNull();
    expect(result.current.filters.setupInCorner).toBeNull();
  });

  it("updateFilters で URL へ書き出され round-trip する(画面中央=false も落ちない)", () => {
    const { result } = renderHook(() => useComboListFilters(), {
      wrapper: wrapper(["/"]),
    });

    act(() => {
      result.current.updateFilters({
        setupResult: "ng",
        setupTechType: "neutral_tech",
        setupInCorner: false,
      });
    });

    expect(result.current.filters.setupResult).toBe("ng");
    expect(result.current.filters.setupTechType).toBe("neutral_tech");
    expect(result.current.filters.setupInCorner).toBe(false);
  });

  it("新項目もアクティブなフィルタに数えられ、クリアで戻る", () => {
    const { result } = renderHook(() => useComboListFilters(), {
      wrapper: wrapper(["/?character_id=2"]),
    });
    // character_id だけではアクティブ扱いしない(既存の流儀)。
    expect(result.current.hasActiveFilters).toBe(false);

    act(() => {
      result.current.updateFilters({ setupResult: "ok" });
    });
    expect(result.current.hasActiveFilters).toBe(true);

    act(() => {
      result.current.clearFilters();
    });
    expect(result.current.filters.setupResult).toBeNull();
    expect(result.current.filters.setupTechType).toBeNull();
    expect(result.current.filters.setupInCorner).toBeNull();
    expect(result.current.hasActiveFilters).toBe(false);
    // キャラクターは残る(既存の clearFilters の挙動)。
    expect(result.current.filters.characterId).toBe(2);
  });

  it("軸だけでもアクティブなフィルタに数える(クリアで確実に戻すため)", () => {
    const { result } = renderHook(() => useComboListFilters(), {
      wrapper: wrapper(["/?setup_tech_type=back_tech"]),
    });
    expect(result.current.hasActiveFilters).toBe(true);
  });

  // 既存の保持機構(sessionStorage・combo-list-filters-v1)にそのまま乗ること。
  it("成立条件も既存のセッション保持で復元される", async () => {
    const first = renderHook(() => useComboListFilters(), {
      wrapper: wrapper([
        "/?setup_result=ok&setup_tech_type=back_tech&setup_in_corner=true",
      ]),
    });
    await waitFor(() =>
      expect(first.result.current.filters.setupResult).toBe("ok"),
    );
    first.unmount();

    const second = renderHook(() => useComboListFilters(), {
      wrapper: wrapper(["/"]),
    });
    await waitFor(() => {
      expect(second.result.current.filters.setupResult).toBe("ok");
      expect(second.result.current.filters.setupTechType).toBe("back_tech");
      expect(second.result.current.filters.setupInCorner).toBe(true);
    });
  });

  // ── M24-01 §3.3-13 / §4.1-6(SM-044) ────────────────────────────────────
  // ★実査の結果、SM-044「編集や登録から戻ったときにキャラフィルタを維持して欲しい」は
  //   既に満たされていた——DES-005 §5.4 の戻り時保持(combo-list-filters-v1)が
  //   URL クエリ全体を保存しており、そこに character_id が含まれる。
  // ⇒ 本サブでは実装せず、満たされていることをここで固定する。
  describe("SM-044: 編集・登録から戻ったときにキャラが維持される(既に成立)", () => {
    it("キャラを選ぶ → 空 URL で開き直す → character_id が復元される", async () => {
      const first = renderHook(() => useComboListFilters(), {
        wrapper: wrapper(["/"]),
      });
      act(() => first.result.current.updateFilters({ characterId: 5 }));
      await waitFor(() =>
        expect(first.result.current.filters.characterId).toBe(5),
      );
      first.unmount();

      // 編集/登録画面から navigate("/combos") で戻ったときと同じ「クエリなし」の入り方。
      const second = renderHook(() => useComboListFilters(), {
        wrapper: wrapper(["/"]),
      });
      await waitFor(() =>
        expect(second.result.current.filters.characterId).toBe(5),
      );
    });

    it("URL にキャラがあるときはセッションより URL が勝つ(段 1 > 段 2)", async () => {
      const first = renderHook(() => useComboListFilters(), {
        wrapper: wrapper(["/"]),
      });
      act(() => first.result.current.updateFilters({ characterId: 5 }));
      await waitFor(() =>
        expect(first.result.current.filters.characterId).toBe(5),
      );
      first.unmount();

      const second = renderHook(() => useComboListFilters(), {
        wrapper: wrapper(["/?character_id=7"]),
      });
      expect(second.result.current.filters.characterId).toBe(7);
    });
  });

  // ── M24-01 §4.1-3 / §4.1-7 ─────────────────────────────────────────────
  describe("readSessionCharacterId(既定キャラ解決の段 2)", () => {
    it("保存済みのクエリから character_id を取り出す", () => {
      const { result, unmount } = renderHook(() => useComboListFilters(), {
        wrapper: wrapper(["/"]),
      });
      act(() =>
        result.current.updateFilters({
          characterId: 4,
          tagIds: [1, 2],
          isDraft: true,
          sort: "damage",
        }),
      );
      unmount();
      expect(readSessionCharacterId()).toBe(4);
    });

    it("★他の軸が同居していても、返すのは character_id の値だけ(§4.1-7)", () => {
      // ★戻り値の「型」を見ても何も守れない(number | null は TypeScript が保証済み)。
      //   ここで見るのは「同じキーに tag_ids / is_draft / sort / order が同居していても、
      //   返る値が character_id のものであり、他の軸の値ではない」ことである。
      const { result, unmount } = renderHook(() => useComboListFilters(), {
        wrapper: wrapper(["/"]),
      });
      act(() =>
        result.current.updateFilters({
          characterId: 4,
          tagIds: [1, 2],
          isDraft: true,
          sort: "damage",
          order: "asc",
        }),
      );
      unmount();

      const got = readSessionCharacterId();
      expect(got).toBe(4); // character_id の値
      // 他の軸の値を掴んでいない(tag_ids の先頭 1 や 2 を返していない)。
      expect(got).not.toBe(1);
      expect(got).not.toBe(2);

      // ★対照: character_id を外すと、他の軸が残っていても null になる。
      //   「何か在れば数値を返す」実装ではないことを示す。
      sessionStorage.setItem(
        "combo-list-filters-v1",
        JSON.stringify("tag_ids=1,2&is_draft=true&sort=damage&order=asc"),
      );
      expect(readSessionCharacterId()).toBeNull();
    });

    it("未保存なら null(段 3 へ落ちる)", () => {
      expect(readSessionCharacterId()).toBeNull();
    });

    it("壊れた値でも例外を投げず null を返す", () => {
      sessionStorage.setItem("combo-list-filters-v1", "{壊れた JSON");
      expect(readSessionCharacterId()).toBeNull();
    });

    it("キャラを含まないクエリが保存されていれば null", () => {
      sessionStorage.setItem(
        "combo-list-filters-v1",
        JSON.stringify("sort=damage&order=asc"),
      );
      expect(readSessionCharacterId()).toBeNull();
    });
  });

  // ── M24-01 追補②: 既定キャラを書き換えたら段 2 を捨てる ────────────────
  //
  // ★呼び出し口は useUpdateConfig の onSuccess 1 か所(そちらのテストで固定する)。
  //   ここでは「何を捨て、何を残すか」を見る。
  describe("clearSessionCharacterId", () => {
    const KEY = "combo-list-filters-v1";

    it("character_id だけを落とし、他の軸は残す", () => {
      sessionStorage.setItem(
        KEY,
        JSON.stringify(
          "character_id=4&tag_ids=1,2&is_draft=true&sort=damage&order=asc",
        ),
      );
      clearSessionCharacterId();

      const rest = new URLSearchParams(JSON.parse(sessionStorage.getItem(KEY)!));
      expect(rest.get("character_id"), "キャラが残っている").toBeNull();
      // ★既定キャラを変えただけで作業中の絞り込みまで飛ぶのは行き過ぎである。
      expect(rest.get("tag_ids")).toBe("1,2");
      expect(rest.get("is_draft")).toBe("true");
      expect(rest.get("sort")).toBe("damage");
      expect(rest.get("order")).toBe("asc");
    });

    it("character_id しか無ければキーごと消える", () => {
      sessionStorage.setItem(KEY, JSON.stringify("character_id=4"));
      clearSessionCharacterId();
      expect(sessionStorage.getItem(KEY)).toBeNull();
    });

    it("★対照: 呼ぶ前は値が返り、呼んだ後は null になる", () => {
      sessionStorage.setItem(KEY, JSON.stringify("character_id=4&sort=damage"));
      expect(readSessionCharacterId()).toBe(4);
      clearSessionCharacterId();
      expect(readSessionCharacterId()).toBeNull();
    });

    it("未保存なら何も起きない(例外を投げない)", () => {
      expect(() => clearSessionCharacterId()).not.toThrow();
      expect(sessionStorage.getItem(KEY)).toBeNull();
    });

    it("★壊れた値には触らない(書き換えて悪化させない)", () => {
      sessionStorage.setItem(KEY, "{壊れた JSON");
      clearSessionCharacterId();
      expect(sessionStorage.getItem(KEY)).toBe("{壊れた JSON");
    });

    it("character_id を含まないクエリはそのまま残す", () => {
      sessionStorage.setItem(KEY, JSON.stringify("sort=damage&order=asc"));
      clearSessionCharacterId();
      expect(JSON.parse(sessionStorage.getItem(KEY)!)).toBe("sort=damage&order=asc");
    });
  });
});
