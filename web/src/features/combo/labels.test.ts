import { describe, it, expect } from "vitest";

import {
  GAUGE_AT_START_LABEL_JA,
  GAUGE_CONSUMED_LABEL_JA,
  MODIFIER_FLAGS,
  MODIFIER_FLAGS_COMMON,
  MODIFIER_NON_MOVE_TYPES,
  MODIFIER_OD_VARIANT_FLAGS,
  gaugeFieldLabelJa,
} from "./labels";

// M24-04(SM-007 / SM-101): ゲージ欄のラベルは 4 通り(始動側・消費側 × ドライブ・SA)ある。
// 従来は 4 通りが別々の場所に散っており、片側だけ直す事故が繰り返された(CHANGE-137 §3-3)。
// ⇒ 1 か所で組み立てる形にしたので、4 通りの出力をここで固定する。
describe("gaugeFieldLabelJa(4 通りの正典)", () => {
  // ★★M24-12(D-582): スピナー撤廃で「0.5刻み」は事実でなくなった。
  //   `6.0` の `.0` が「小数が入る」を伝える(先例＝`ドライブダメージ(-6.0〜6.0)`)。
  it("★ドライブ始動側は上限に根拠があるので書く(小数は 6.0 の形で示す)", () => {
    expect(gaugeFieldLabelJa("start", "drive")).toBe(
      "コンボ開始時のドライブゲージ残量(0〜6.0本)",
    );
  });

  // ★★M29-01(開発者裁定 3-A・2026-09-06)で旧記述「SA 始動側は据え置き」は失効した。
  //   着手前は同じ SA ゲージが始動側「(0〜3)」・消費側「(0〜6本)」で割れていた
  //   ——SM-007(2026-08-27)が名指ししたのが消費の 1 件だけだったためである。
  //   ⇒ 「本」を付ける側へ揃えた。sa_available_at_start は INTEGER(0〜3)であり
  //     本数表記が意味的にも正しい。
  it("★★M29-01: SA は始動・消費とも「本」を付ける(SM-007 の射程が 2 欄へ広がった)", () => {
    expect(gaugeFieldLabelJa("start", "sa")).toBe(
      "コンボ開始時のSAゲージ残量(0〜3本)",
    );
    expect(gaugeFieldLabelJa("consumed", "sa")).toBe("SAゲージ消費(0〜6本)");
  });

  // ★★SM-101(2026-08-27 開発者裁定)。実際の上限 20 は変えず、ラベルから上限を消す。
  //   逐語＝「20の根拠が薄いため、ラベルが違和感を出しているのだと気づきました。」
  // ★★M24-12(D-582): 注記が空になったので括弧ごと出さない。
  //   ★消費側はラベルから「小数が入る」情報が完全に消える。**これは許容する**
  //     ——同欄は範囲 VAL 非連動(DES-006 §2.5)であり、そもそも上限を語れないためである
  //     (指示書 §4.9.2)。
  it("★★SM-101 + M24-12: ドライブ消費側は注記が空なので括弧を出さない", () => {
    expect(gaugeFieldLabelJa("consumed", "drive")).toBe("ドライブゲージ消費");
  });

  // ★「0.5刻み」がどの通りにも残っていないこと(片側だけ直す事故の再発防止)。
  it("★「0.5刻み」が 4 通りのどこにも残っていない", () => {
    const all = (["start", "consumed"] as const).flatMap((side) =>
      (["drive", "sa"] as const).map((kind) => gaugeFieldLabelJa(side, kind)),
    );
    expect(all).toHaveLength(4);
    expect(all.some((label) => label.includes("0.5"))).toBe(false);
  });

  // ★空の注記で括弧だけが残る形を作らない。
  it("★空括弧「()」が 4 通りのどこにも出ない", () => {
    const all = (["start", "consumed"] as const).flatMap((side) =>
      (["drive", "sa"] as const).map((kind) => gaugeFieldLabelJa(side, kind)),
    );
    expect(all.some((label) => label.includes("()"))).toBe(false);
  });

  it("根拠の薄い上限「20」がラベルのどこにも残っていない", () => {
    const all = (["start", "consumed"] as const).flatMap((side) =>
      (["drive", "sa"] as const).map((kind) => gaugeFieldLabelJa(side, kind)),
    );
    expect(all).toHaveLength(4);
    expect(all.some((label) => label.includes("20"))).toBe(false);
  });

  it("語幹の定数と組み立て結果が食い違わない(第 2 の語彙を作らない)", () => {
    expect(gaugeFieldLabelJa("start", "drive")).toContain(
      GAUGE_AT_START_LABEL_JA.drive,
    );
    expect(gaugeFieldLabelJa("start", "sa")).toContain(
      GAUGE_AT_START_LABEL_JA.sa,
    );
    expect(gaugeFieldLabelJa("consumed", "drive")).toContain(
      GAUGE_CONSUMED_LABEL_JA.drive,
    );
    expect(gaugeFieldLabelJa("consumed", "sa")).toContain(
      GAUGE_CONSUMED_LABEL_JA.sa,
    );
  });
});

// ============================================================================
// M37-06: modifier flags の全数と内容(指示書 §2.2 / §5-1・チェックリスト束 B)。
//
// ★★★要否は開発者が全件決めた表である(`D-873`)。⇒ 本 describe は「実装が表と
//   1 値も違わないこと」だけを見る。値の是非はここでは判断しない。
// ★★数が 2 つあることに注意する:
//     選択肢   14 値 … MODIFIER_FLAGS_COMMON(11) + MODIFIER_OD_VARIANT_FLAGS(3)
//     引き当て 17 件 … 上記 ＋ MODIFIER_FLAGS_RETIRED(3)
// ============================================================================
describe("M37-06 modifier flags の全数(選択肢 14 / 引き当て 17)", () => {
  const selectable = [...MODIFIER_FLAGS_COMMON, ...MODIFIER_OD_VARIANT_FLAGS];

  it("★★★選択肢はちょうど 14 値である", () => {
    expect(selectable).toHaveLength(14);
  });

  it("★★★選択肢の値の集合が指示書 §2.2 の表と一致する", () => {
    expect(selectable.map((f) => f.value).sort()).toEqual(
      [
        "cross_under",
        "delay",
        "first_hit_cancel",
        "juggle_high",
        "juggle_low",
        "late_cancel",
        "link",
        "low_jump",
        "meaty",
        "no_cancel",
        "od_lh",
        "od_lm",
        "od_mh",
        "whiff",
      ].sort(),
    );
  });

  it("★★od_* は 3 値のまま残っている(畳んでいない)", () => {
    expect(MODIFIER_OD_VARIANT_FLAGS.map((f) => f.value)).toEqual([
      "od_lm",
      "od_mh",
      "od_lh",
    ]);
  });

  it("★★★選択肢から外した 3 値は選択肢に無い", () => {
    const values = selectable.map((f) => f.value);
    for (const retired of ["just", "neutral_jump", "forward_jump"]) {
      expect(values).not.toContain(retired);
    }
  });

  // ★★★これが `B04` の逆行を防ぐ床である(指示書 §4.1)。表示語を消すと、既存行が
  //   `just` のような内部コードで画面へ出る(ModifiersSummary のフォールバックは `?? f`)。
  it("★★★外した 3 値の**表示語は残っている**(引き当て表に在る)", () => {
    for (const [value, label] of [
      ["just", "ジャスト"],
      ["neutral_jump", "垂直ジャンプ中"],
      ["forward_jump", "前ジャンプ中"],
    ]) {
      expect(MODIFIER_FLAGS.find((f) => f.value === value)?.label).toBe(label);
    }
  });

  it("★引き当て表は 17 件(選択肢 14 ＋ 外した 3)で、値の重複が無い", () => {
    expect(MODIFIER_FLAGS).toHaveLength(17);
    expect(new Set(MODIFIER_FLAGS.map((f) => f.value)).size).toBe(17);
  });

  // ★表示語の重複が無いこと。⇒ 重複すると splitStepSegments の逆引き(表示語 → バッジ)が
  //   どちらの flag か決められない(M37-06 案 C)。
  it("★表示語が 17 件すべて相異なる", () => {
    expect(new Set(MODIFIER_FLAGS.map((f) => f.label)).size).toBe(17);
  });

  it("★low_jump の表示語は「低空」・コードは変えていない(CHANGE-057)", () => {
    expect(MODIFIER_FLAGS.find((f) => f.value === "low_jump")?.label).toBe("低空");
  });

  // ★★link(難易度の注記)と no_cancel(接続の事実)は別の flag である(D-873・指示書 §0.3)。
  //   ⇒ 統合していないことを名指しで固定する。両方が付く行がありうるため排他にもしない。
  it("★★link と no_cancel が別の flag として在る", () => {
    const values = selectable.map((f) => f.value);
    expect(values).toContain("link");
    expect(values).toContain("no_cancel");
    expect(MODIFIER_FLAGS.find((f) => f.value === "link")?.label).toBe("目押し");
    expect(MODIFIER_FLAGS.find((f) => f.value === "no_cancel")?.label).toBe(
      "ノーキャン",
    );
  });

  // ★指示書 §3-7:「最速キャンセル」「連打キャンセル」「溜め」等を足していないこと。
  it("★開発者が不要と述べた flag を足していない", () => {
    const labels = MODIFIER_FLAGS.map((f) => f.label);
    for (const forbidden of ["最速キャンセル", "連打キャンセル", "溜め"]) {
      expect(labels).not.toContain(forbidden);
    }
  });

  // ★M37-06 §2.6-3: type 2 値は両方残す。表記は parry のみ「生ラッシュ」へ寄せた。
  it("★type は 2 値のまま。parry_drive_rush の表記は「生ラッシュ」", () => {
    expect(MODIFIER_NON_MOVE_TYPES).toHaveLength(2);
    expect(
      MODIFIER_NON_MOVE_TYPES.find((t) => t.value === "parry_drive_rush")?.label,
    ).toBe("生ラッシュ");
    expect(
      MODIFIER_NON_MOVE_TYPES.find((t) => t.value === "cancel_drive_rush")?.label,
    ).toBe("キャンセルドライブラッシュ");
  });
});
