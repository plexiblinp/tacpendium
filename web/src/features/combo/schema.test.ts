import { describe, expect, it } from "vitest";

import { parseComboForm } from "./schema";

// M16-01: driveAvailableAtStart は 0.5 刻みの小数を許容する(旧: 整数のみ)。
// zod は第一防衛線であり、範囲 0〜6 のみ検証し 0.5 刻みは UI(widget)で担保する。
describe("comboForm schema: driveAvailableAtStart 小数許容(M16-01)", () => {
  // ★M24-13: レシピ 0 件は仮登録でも通らなくなった(VAL-C09 を仮登録へ適用した)。
  //   ここで見たいのは数値欄の値域なので、最小のレシピを持たせる。
  const draftBase = {
    isDraft: true as const,
    characterId: 1,
    steps: [{ stepOrder: 1, moveId: 5 }],
  };

  it("0.5 刻みの小数(2.5)を許容する", () => {
    const res = parseComboForm({ ...draftBase, driveAvailableAtStart: 2.5 });
    expect(res.success).toBe(true);
  });

  it("整数値(3)も従来どおり許容する", () => {
    const res = parseComboForm({ ...draftBase, driveAvailableAtStart: 3 });
    expect(res.success).toBe(true);
  });

  it("範囲外(6.5)は弾く", () => {
    const res = parseComboForm({ ...draftBase, driveAvailableAtStart: 6.5 });
    expect(res.success).toBe(false);
  });

  it("負値(-0.5)は弾く", () => {
    const res = parseComboForm({ ...draftBase, driveAvailableAtStart: -0.5 });
    expect(res.success).toBe(false);
  });
});

// M16-02: 消費ゲージは VAL 非連動(記録/表示/比較のみ)。指示書 §3.4-5/§9.1 に従い zod で
// 範囲 ERROR を設けない(範囲は UI ステッパー上限のみで担保)。BE/CSV も range=nil で型安全のみ。
// よって zod は範囲外の値でも success:true とし、型(SA=整数・drive=数値)だけを見る。
describe("comboForm schema: ゲージ消費は VAL 非連動(M16-02)", () => {
  // ★M24-13: レシピ 0 件は仮登録でも通らなくなった(VAL-C09 を仮登録へ適用した)。
  //   ここで見たいのは数値欄の値域なので、最小のレシピを持たせる。
  const draftBase = {
    isDraft: true as const,
    characterId: 1,
    steps: [{ stepOrder: 1, moveId: 5 }],
  };

  it("SA 消費は通常値(6)を許容する", () => {
    expect(parseComboForm({ ...draftBase, saGaugeConsumed: 6 }).success).toBe(true);
  });

  it("SA 消費は UI 上限を超える値(7・999)でも弾かない(範囲検証しない)", () => {
    expect(parseComboForm({ ...draftBase, saGaugeConsumed: 7 }).success).toBe(true);
    expect(parseComboForm({ ...draftBase, saGaugeConsumed: 999 }).success).toBe(true);
  });

  it("drive 消費は 0.5 刻み(10.5)・UI 上限(20)を許容する", () => {
    expect(parseComboForm({ ...draftBase, driveGaugeConsumed: 10.5 }).success).toBe(true);
    expect(parseComboForm({ ...draftBase, driveGaugeConsumed: 20 }).success).toBe(true);
  });

  it("drive 消費は UI 上限を超える値(20.5・100.5)でも弾かない(範囲検証しない)", () => {
    expect(parseComboForm({ ...draftBase, driveGaugeConsumed: 20.5 }).success).toBe(true);
    expect(parseComboForm({ ...draftBase, driveGaugeConsumed: 100.5 }).success).toBe(true);
  });
});

// ===========================================================================
// M24-13 (CHANGE-139): レシピは 1 ステップ以上を要する
// ===========================================================================
//
// ★★仮登録でも掛かる。掛かる範囲を広げただけであり、モードごとに 2 本目の判定を
//   書き起こしてはいない(条件を写すと静かにずれる = DES-006 §2.1 の規約)。
describe("comboForm schema: レシピは 1 ステップ以上(M24-13)", () => {
  const base = { characterId: 1 };

  it("★★仮登録でもレシピ 0 件は弾く", () => {
    const res = parseComboForm({ ...base, isDraft: true, steps: [] });
    expect(res.success).toBe(false);
  });

  it("本登録でもレシピ 0 件は弾く(従来どおり)", () => {
    const res = parseComboForm({ ...base, isDraft: false, steps: [] });
    expect(res.success).toBe(false);
  });

  // ★★VAL-D02 は変えていない。数えるのはステップの本数だけである。
  it("★★仮登録で「技が未指定のステップ」1 本なら通る(うろ覚えを守る)", () => {
    const res = parseComboForm({
      ...base,
      isDraft: true,
      steps: [{ stepOrder: 1 }],
    });
    expect(res.success).toBe(true);
  });

  it("★非技ステップ(modifiers.type のみ)1 本でも通る", () => {
    const res = parseComboForm({
      ...base,
      isDraft: true,
      steps: [{ stepOrder: 1, modifiers: { type: "parry_drive_rush" } }],
    });
    expect(res.success).toBe(true);
  });
});

// M27-02b(P4M-009) / ★★M38-01: 本登録で zod が見る欄。
// ★★★M38-01 追補2 の時点で、**必須そのものが damage / knockdownAdvantage の 2 欄**
//   であり、zod が見る欄と一致する。⇒ 追補1 までは「必須 4 欄のうち zod が見るのは
//   2 つだけ」というズレが在ったが(開始残量 2 欄は payload では「不問」と「空」が
//   同じ null になるため)、開始残量が任意になったことでズレが消えた。
//
// ★★ここが「埋めないと止まる」を見る唯一の**単体**の場所である。
//   `ComboEditor.test.tsx` は `ComboEditorBasicFields` を丸ごと mock しており、
//   保存の下ごしらえが必須欄を埋める側に回っているため、あちらでは観測できない。
//   ⇒ `CLAUDE.md` §5「フロント純粋関数は必須」に従い、スキーマを直接叩く。

const base = {
  characterId: 1,
  steps: [{ stepOrder: 1, moveId: 10 }],
  damage: 1500,
  knockdownAdvantage: 30,
};

describe("parseComboForm 本登録の必須項目(VAL-C15 のクライアント側予防)", () => {
  it("zod が見る 2 欄が埋まっていれば通る", () => {
    const r = parseComboForm({ ...base, isDraft: false });
    expect(r.success).toBe(true);
  });

  // ★1 欄ずつ落とす。⇒ まとめて 1 つの条件になっていないことを固定する。
  //
  // ★★★【M38-01・射程 3】消費ゲージ 2 欄を外した。⇒ VAL-C15 の 4 欄は
  //   damage / knockdownAdvantage / driveAvailableAtStart / saAvailableAtStart だが、
  //   **後ろ 2 欄は zod では見られない**(下の専用 it が理由ごと固定する)。
  it.each([["damage"], ["knockdownAdvantage"]])(
    "%s が null だと本登録で弾かれる",
    (field) => {
      const r = parseComboForm({ ...base, isDraft: false, [field]: null });
      expect(r.success).toBe(false);
      if (!r.success) {
        expect(r.error.issues.some((i) => i.path[0] === field)).toBe(true);
      }
    },
  );

  it("欄そのものが無い(undefined)場合も本登録で弾かれる", () => {
    const { damage: _omit, ...withoutDamage } = base;
    const r = parseComboForm({ ...withoutDamage, isDraft: false });
    expect(r.success).toBe(false);
  });

  // ★★★【M38-01・射程 3】外した 2 欄は**空のまま本登録で通る**。
  //   ⇒ 「必須を外した」ことの証跡である。
  it("★消費ゲージ 2 欄は空のままでも本登録で通る(必須から外れた)", () => {
    const r = parseComboForm({
      ...base,
      isDraft: false,
      driveGaugeConsumed: null,
      saGaugeConsumed: null,
    });
    expect(r.success).toBe(true);
  });

  // ★★★【M38-01・射程 3+4 → 追補2】主張は不変だが、**理由が変わった**。
  //
  // ★追補1 まで: 開始残量 2 欄は VAL-C15 の必須だったが zod は `null` を通した ——
  //   payload では「不問を選んだ null」と「空のまま送られた null」が同じ値になり
  //   (Go の encoding/json。DES-006 §5)、判定できなかったためである。
  //   ⇒ 門はフォーム state を見る features/combo/requiredPublished.ts に在った。
  // ★★★追補2(2026-09-18 開発者裁定): **そもそも必須ではなくなった**。門も消えた。
  //   ⇒ 空欄＝NULL＝「不問」の 1 状態であり、区別すべきものが無い。
  // ★★本 it を「弾かれる」へ書き換えると、**不問の保存そのものが落ちる**(これは不変)。
  it("★★★開始残量 2 欄が null でも zod は通す(任意であり、null は「不問」)", () => {
    const r = parseComboForm({
      ...base,
      isDraft: false,
      driveAvailableAtStart: null,
      saAvailableAtStart: null,
    });
    expect(r.success).toBe(true);
  });

  // ★★本サブの中心の 1 つ。仮登録は「未確定でも保存できる」入口であり、
  //   ここを塞ぐと存在意義が消える(SUPP-001 §2.1)。
  it("★仮登録では 4 欄が空でも通る", () => {
    const r = parseComboForm({
      characterId: 1,
      isDraft: true,
      steps: [{ stepOrder: 1, moveId: 10 }],
    });
    expect(r.success).toBe(true);
  });

  // ★値域は見ない。0 や負値でも「入っている」なら通る。
  it("0 / 負値は未入力ではない", () => {
    const r = parseComboForm({
      ...base,
      isDraft: false,
      damage: 0,
      knockdownAdvantage: -10,
      driveGaugeConsumed: 0,
      saGaugeConsumed: 0,
    });
    expect(r.success).toBe(true);
  });

  // ★★★【M38-01・射程 3】外した 2 欄の**値域は元から無い**
  //   (DES-006 §2.5「範囲 VAL 非連動」)。⇒ 必須を外しても、外した検査は 1 つも無い。
  //   ★担保は UI クランプ(numericInput.ts の clampNumericString)だけであり、
  //     そちらは ComboEditorBasicFields.test.tsx が固定している。
  it("★消費ゲージ 2 欄は範囲外の値でも zod は通す(範囲 VAL 非連動・不変)", () => {
    const r = parseComboForm({
      ...base,
      isDraft: false,
      driveGaugeConsumed: 999,
      saGaugeConsumed: 999,
    });
    expect(r.success).toBe(true);
  });

  // ★★★対照: 開始残量 2 欄の**値域は生きている**(VAL-C04 / C05 の第一防衛線)。
  //   ⇒ 必須にしたことと値域は別軸であり、どちらも動かしていない。
  it("★★開始残量 2 欄は範囲外だと弾かれる(値域は不変)", () => {
    expect(
      parseComboForm({ ...base, isDraft: false, driveAvailableAtStart: 7 })
        .success,
    ).toBe(false);
    expect(
      parseComboForm({ ...base, isDraft: false, saAvailableAtStart: 4 }).success,
    ).toBe(false);
  });
});
