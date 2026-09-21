import { describe, expect, it } from "vitest";

import {
  MAX_BUTTONIZED_OPTIONS,
  indexForShortcutKey,
  shortcutKeyForIndex,
  shouldButtonizeOptions,
} from "./optionButtons";

describe("M24-12 ボタン化の対象判定(選択肢の個数からの分岐)", () => {
  it("上限は 10 である(数字キーが 10 個しか無いことと同じ理由)", () => {
    expect(MAX_BUTTONIZED_OPTIONS).toBe(10);
  });

  it("10 以下はボタン化する", () => {
    expect(shouldButtonizeOptions(1)).toBe(true);
    expect(shouldButtonizeOptions(5)).toBe(true);
    expect(shouldButtonizeOptions(10)).toBe(true);
  });

  // ★★開発者の逐語＝「10を超えるものはボタン化の対象外。」(D-578(4))
  it("★10 を超えたらボタン化しない(境界は 10 と 11 の間)", () => {
    expect(shouldButtonizeOptions(11)).toBe(false);
    expect(shouldButtonizeOptions(12)).toBe(false); // 起き攻めの全数
    expect(shouldButtonizeOptions(19)).toBe(false); // キャラクター
    expect(shouldButtonizeOptions(136)).toBe(false); // 技(最多のキャラ)
  });

  it("0 個は描くものが無いので false", () => {
    expect(shouldButtonizeOptions(0)).toBe(false);
  });

  describe("実際の欄の個数(§3.3-3 の実測)", () => {
    // ★中立の選択肢「不問」を 1 つ足した後の個数で判定する。
    it.each([
      // ★M28-02a: 始動位置 5 → 7 値(mid_self / mid_opponent を追加)。
      //   ★7 + 1 = 8 で上限 10 の内側。⇒ ボタン群のまま(余白 2)。
      //   ★語も「ポジション」から「始動位置」へ改めた(詳細・比較・エディタ)。
      ["始動位置", 7 + 1],
      ["相手の状態", 4], // ★any が中立を兼ねるので足さない
      // ★M27-01: ヒット種別 4 → 8 値、相手の大きさ 3 → 4 値。
      //   ★どちらも上限 10 の内側なのでボタン群のまま(DES-005・CHANGE-138)。
      //   ★★★【M38-01・射程 5】ヒット種別は **8** になった(中立を足さなくなった)。
      //     ⇒ 余白は 1 から 2 へ増えた。以下は失効した記述: 「8 + 1 = 9 で余白 1。
      //     次に 2 値足すと上限を越える」。
      //   ★★数え上げはリテラルである。⇒ HIT_TYPE_VALUES へ値を足しても本行は
      //     自動で追随せず、緑のまま失効する。値を足す手番で本行も直すこと
      //     (M37-03 で実際に踏んだ —— 値を 1 つ足したのに本行は 8 + 1 のままだった)。
      //   ★★本行は `shouldButtonizeOptions` の境界を見るだけなので 8 でも 9 でも
      //     true が返る。⇒ **直さなくても緑のまま失効する型である。**
      ["ヒット種別", 8],
      ["相手の大きさ", 4 + 1],
      ["マイコンボ", 3 + 1],
      // ★★M31-05: キャラ固有状態の options 付き int state(設置系の変種)。
      //   ★「なし」を含めた個数である(既定値 min = 「なし」も 1 つのボタンになる)。
      //   ★★舞は当初 1 state 11 個で線の外側へ出ていた。⇒ 通常版 6 ＋ 焔版 6 の 2 state へ割った
      //     (レビュー 高-1 / 2026-09-10 開発者判断)。**11 個の欄は 1 つも残っていない。**
      //   ★★2026-09-10 追補: イングリッドとダルシムのサンバーストも「レベル / 段階」と「強度」の
      //     2 state へ割った(開発者の要望＝入力しやすさ)。⇒ 掛け合わせを 1 state へ詰めると
      //     どちらも 10 個(＝余白 0)で線に張り付いていた。**現状の最大は 7 で、余白は 3 ある。**
      ["ヨガアーチ設置", 5],
      ["ヨガサンバースト設置", 4],
      ["ヨガサンバーストの強度", 4],
      ["ヴィーハト設置", 5],
      ["花蝶扇バウンド中", 6],
      ["焔花蝶扇バウンド中", 6],
      ["サンオーダー発動中", 4],
      ["サンオーダーの強度", 4],
      ["歳破衝設置", 3],
      ["パンギル・サ・リクラン設置", 7],
    ])("%s (%i 個) はボタン化する", (_name, count) => {
      expect(shouldButtonizeOptions(count)).toBe(true);
    });

    it.each([
      ["起き攻めの全数", 12],
      ["レシピの区分フィルタ", 11],
      ["キャラクター", 19],
    ])("%s (%i 個) はボタン化しない", (_name, count) => {
      expect(shouldButtonizeOptions(count)).toBe(false);
    });
  });
});

describe("M24-12 数字キーのショートカット割当", () => {
  it("0 始まりの添字を 1..9,0 へ写す(キーボードの数字列の並び順)", () => {
    expect(shortcutKeyForIndex(0)).toBe("1");
    expect(shortcutKeyForIndex(8)).toBe("9");
    // ★10 番目は "0"。数字列 1234567890 で 0 は 9 の右隣にある。
    expect(shortcutKeyForIndex(9)).toBe("0");
  });

  it("★11 番目以降には割り当てない(押すキーが無い)", () => {
    expect(shortcutKeyForIndex(10)).toBeNull();
    expect(shortcutKeyForIndex(11)).toBeNull();
  });

  it("負値・非整数は割り当てない", () => {
    expect(shortcutKeyForIndex(-1)).toBeNull();
    expect(shortcutKeyForIndex(1.5)).toBeNull();
  });

  it("押された数字キーから添字を引ける(shortcutKeyForIndex の逆)", () => {
    expect(indexForShortcutKey("1")).toBe(0);
    expect(indexForShortcutKey("9")).toBe(8);
    expect(indexForShortcutKey("0")).toBe(9);
  });

  it("数字キー以外は null(他のキーを奪わない)", () => {
    for (const key of ["a", "Enter", "Tab", "ArrowDown", " ", "F5", ""]) {
      expect(indexForShortcutKey(key)).toBeNull();
    }
  });

  it("★往復して一致する(0..9 の全域)", () => {
    for (let i = 0; i < MAX_BUTTONIZED_OPTIONS; i += 1) {
      const key = shortcutKeyForIndex(i);
      expect(key).not.toBeNull();
      expect(indexForShortcutKey(key as string)).toBe(i);
    }
  });
});
