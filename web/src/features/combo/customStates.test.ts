import { describe, it, expect } from "vitest";

import {
  parseCustomStateDefs,
  parseSituationCustomStates,
  buildSituation,
  resolveCustomStatesForDisplay,
  normalizeIntValue,
  customStateIntLabel,
  customStateValueText,
  hasStateOptions,
  optionLabelFor,
  stateOptions,
  isSingleValueState,
  type CustomStateDef,
} from "./customStates";

const flagDef: CustomStateDef = {
  code: "denjin_charge",
  name_ja: "電刃錬気",
  type: "flag",
  value_definition: { kind: "boolean" },
};

const intDef: CustomStateDef = {
  code: "sun_crest",
  name_ja: "サンシンボル",
  name_en: "Sun Crest",
  type: "level",
  value_definition: { kind: "integer", min: 0, max: 4 },
};

// M16-07: 増減表示ありの int state(方向可変・Ingrid 相当)。
const intDeltaDef: CustomStateDef = { ...intDef, show_delta: true };

const compositeDef: CustomStateDef = {
  code: "drunk_level",
  name_ja: "酔いレベル",
  type: "composite",
  value_definition: { kind: "object" },
};

describe("parseCustomStateDefs", () => {
  it("正常な custom_states を states[] へ解析する", () => {
    const raw = JSON.stringify({ states: [flagDef] });
    expect(parseCustomStateDefs(raw)).toHaveLength(1);
    expect(parseCustomStateDefs(raw)[0].code).toBe("denjin_charge");
  });

  it("NULL/空文字/不正 JSON では空配列(防御)", () => {
    expect(parseCustomStateDefs(null)).toEqual([]);
    expect(parseCustomStateDefs(undefined)).toEqual([]);
    expect(parseCustomStateDefs("")).toEqual([]);
    expect(parseCustomStateDefs("{")).toEqual([]);
    expect(parseCustomStateDefs("{}")).toEqual([]); // states キーなし
    expect(parseCustomStateDefs(JSON.stringify({ states: "x" }))).toEqual([]);
  });
});

describe("parseSituationCustomStates", () => {
  it("custom_states キーの値を取り出す(flag + 構造化 int)", () => {
    const s = JSON.stringify({
      custom_states: { denjin_charge: true, sun_crest: { start_min: 1, end: 3 } },
    });
    expect(parseSituationCustomStates(s)).toEqual({
      denjin_charge: true,
      sun_crest: { start_min: 1, end: 3 },
    });
  });

  it("M16-07: 旧スカラ int も number のまま受理する(§4.7 移行)", () => {
    const s = JSON.stringify({ custom_states: { sun_crest: 3 } });
    expect(parseSituationCustomStates(s)).toEqual({ sun_crest: 3 });
  });

  it("NULL/不正/キー不在では空(後方互換)", () => {
    expect(parseSituationCustomStates(null)).toEqual({});
    expect(parseSituationCustomStates("{bad")).toEqual({});
    expect(parseSituationCustomStates(JSON.stringify({ position: "corner" }))).toEqual({});
  });
});

describe("normalizeIntValue (M16-07)", () => {
  it("構造化は clamp して返す", () => {
    expect(normalizeIntValue({ start_min: 1, end: 3 }, intDef)).toEqual({ start_min: 1, end: 3 });
    // 範囲外は min/max へ丸める(min 0 / max 4)
    expect(normalizeIntValue({ start_min: -2, end: 9 }, intDef)).toEqual({ start_min: 0, end: 4 });
  });

  it("旧スカラは ②(end) へ写像し ① は既定(min)", () => {
    expect(normalizeIntValue(3, intDef)).toEqual({ start_min: 0, end: 3 });
  });

  it("欠損側は既定(min)で補完・未付与は両者 min", () => {
    expect(normalizeIntValue({ end: 2 }, intDef)).toEqual({ start_min: 0, end: 2 });
    expect(normalizeIntValue(undefined, intDef)).toEqual({ start_min: 0, end: 0 });
  });
});

describe("buildSituation", () => {
  const defs = [flagDef, intDef];

  it("(10) boolean は true のみ格納、false は省略", () => {
    expect(buildSituation(undefined, { denjin_charge: true }, defs)).toBe(
      JSON.stringify({ custom_states: { denjin_charge: true } }),
    );
    expect(buildSituation(undefined, { denjin_charge: false }, defs)).toBeUndefined();
  });

  it("(11) M16-07: int は構造化 {start_min,end} で格納、両者 min は省略", () => {
    expect(
      JSON.parse(buildSituation(undefined, { sun_crest: { start_min: 1, end: 3 } }, defs)!),
    ).toEqual({ custom_states: { sun_crest: { start_min: 1, end: 3 } } });
    // 片側のみ付与(①のみ)でも記録する(② は既定 min)
    expect(
      JSON.parse(buildSituation(undefined, { sun_crest: { start_min: 2 } }, defs)!),
    ).toEqual({ custom_states: { sun_crest: { start_min: 2, end: 0 } } });
    // 両者既定(min)は省略
    expect(
      buildSituation(undefined, { sun_crest: { start_min: 0, end: 0 } }, defs),
    ).toBeUndefined();
  });

  it("(11b) M16-07 移行: 旧スカラ入力は構造化 {start_min:min,end:n} へ写像して格納(§4.7)", () => {
    expect(JSON.parse(buildSituation(undefined, { sun_crest: 3 }, defs)!)).toEqual({
      custom_states: { sun_crest: { start_min: 0, end: 3 } },
    });
    expect(buildSituation(undefined, { sun_crest: 0 }, defs)).toBeUndefined();
  });

  it("(12) 全既定なら undefined(未送信)", () => {
    expect(buildSituation(undefined, {}, defs)).toBeUndefined();
    expect(
      buildSituation(undefined, { denjin_charge: false, sun_crest: 0 }, defs),
    ).toBeUndefined();
  });

  it("(13) 既存 situation の他キーを保全する", () => {
    const existing = JSON.stringify({ note: "keep", custom_states: { sun_crest: 1 } });
    const out = buildSituation(existing, { denjin_charge: true }, defs);
    expect(JSON.parse(out!)).toEqual({ note: "keep", custom_states: { denjin_charge: true } });
  });

  it("custom_states が空になると custom_states キーを除去(他キーは残す)", () => {
    const existing = JSON.stringify({ note: "keep", custom_states: { denjin_charge: true } });
    const out = buildSituation(existing, {}, defs);
    expect(JSON.parse(out!)).toEqual({ note: "keep" });
  });

  it("定義にない type(composite)はスキップする", () => {
    expect(
      buildSituation(undefined, { drunk_level: 2 }, [compositeDef]),
    ).toBeUndefined();
  });

  it("定義が空(未ロード等)のときは既存 situation を保持する(誤消去防止)", () => {
    const existing = JSON.stringify({ custom_states: { denjin_charge: true } });
    expect(buildSituation(existing, {}, [])).toBe(existing);
    expect(buildSituation(undefined, {}, [])).toBeUndefined();
    expect(buildSituation("", {}, [])).toBeUndefined();
  });
});

describe("resolveCustomStatesForDisplay", () => {
  it("M16-07: flag は 1 行、int は ①②(show_delta なし)を明示ラベルで返す", () => {
    const s = JSON.stringify({
      custom_states: { denjin_charge: true, sun_crest: { start_min: 1, end: 3 } },
    });
    const r = resolveCustomStatesForDisplay(s, [flagDef, intDef]);
    expect(r).toEqual([
      { code: "denjin_charge", label: "電刃錬気", type: "flag", value: true, kind: "flag" },
      {
        code: "sun_crest",
        label: "サンシンボル：始動時に必要な最低のストック数",
        type: "level",
        value: 1,
        kind: "start_min",
      },
      {
        code: "sun_crest",
        label: "サンシンボル：終了時のストック数",
        type: "level",
        value: 3,
        kind: "end",
      },
    ]);
  });

  it("M16-07: show_delta=true は ③増減(②−①・符号付き)を追加する", () => {
    const s = JSON.stringify({ custom_states: { sun_crest: { start_min: 1, end: 3 } } });
    const r = resolveCustomStatesForDisplay(s, [intDeltaDef]);
    expect(r).toHaveLength(3);
    expect(r[2]).toEqual({
      code: "sun_crest",
      label: "サンシンボル：ストック増減",
      type: "level",
      value: 2,
      kind: "delta",
    });
    // 減る方向(② < ①)は負値
    const s2 = JSON.stringify({ custom_states: { sun_crest: { start_min: 3, end: 1 } } });
    expect(resolveCustomStatesForDisplay(s2, [intDeltaDef])[2].value).toBe(-2);
  });

  it("M16-07: locale=en は name_en + en 固定句(i18n サーフェス境界)", () => {
    const s = JSON.stringify({ custom_states: { sun_crest: { start_min: 1, end: 3 } } });
    const r = resolveCustomStatesForDisplay(s, [intDeltaDef], "en");
    expect(r.map((x) => x.label)).toEqual([
      "Sun Crest: min stock required at start",
      "Sun Crest: stock at end",
      "Sun Crest: stock delta",
    ]);
  });

  it("M16-07 移行: 旧スカラは ②(end) へ写像して表示(① は既定 min)", () => {
    const s = JSON.stringify({ custom_states: { sun_crest: 3 } });
    const r = resolveCustomStatesForDisplay(s, [intDef]);
    expect(r.map((x) => [x.kind, x.value])).toEqual([
      ["start_min", 0],
      ["end", 3],
    ]);
  });

  it("既定値(flag=false / int=両者 min)は含めない", () => {
    const s = JSON.stringify({
      custom_states: { denjin_charge: false, sun_crest: { start_min: 0, end: 0 } },
    });
    expect(resolveCustomStatesForDisplay(s, [flagDef, intDeltaDef])).toEqual([]);
  });

  it("situation=NULL では空(後方互換)", () => {
    expect(resolveCustomStatesForDisplay(null, [flagDef, intDef])).toEqual([]);
  });
});

// ---- M31-05: 選択肢を持つ int state(設置系の変種) ----

// 実データ相当(migrations/000110 の dhalsim `yoga_arch_is_set`)。
const optionDef: CustomStateDef = {
  code: "yoga_arch_is_set",
  name_ja: "ヨガアーチ設置",
  name_en: "Yoga Arch is set",
  type: "level",
  value_definition: {
    kind: "integer",
    min: 0,
    max: 4,
    options: [
      { value: 0, label_ja: "なし", label_en: "None" },
      { value: 1, label_ja: "弱", label_en: "Light" },
      { value: 2, label_ja: "中", label_en: "Medium" },
      { value: 3, label_ja: "強", label_en: "Heavy" },
      { value: 4, label_ja: "OD", label_en: "OD" },
    ],
  },
};

describe("M31-05: value_definition.options", () => {
  it("options を持つ int state は stateOptions / hasStateOptions で判別できる", () => {
    expect(hasStateOptions(optionDef)).toBe(true);
    expect(stateOptions(optionDef)).toHaveLength(5);
  });

  // ★★案 (vi) の前提そのもの。ingrid の sun_crest(as-built で唯一の level)は
  //   options を持たないため、新しい分岐を 1 つも通らない。
  it("★options を持たない level(sun_crest 相当)は「持たない」と判定される", () => {
    expect(hasStateOptions(intDef)).toBe(false);
    expect(stateOptions(intDef)).toEqual([]);
  });

  // ★空配列は「持たない」と同じ。選択肢 0 個の選択 UI は操作できないため。
  it("options が空配列なら「持たない」と同じに扱う", () => {
    const empty: CustomStateDef = {
      ...intDef,
      value_definition: { ...intDef.value_definition, options: [] },
    };
    expect(hasStateOptions(empty)).toBe(false);
  });

  it("optionLabelFor は値に対応するラベルを返し、未定義の値では undefined", () => {
    expect(optionLabelFor(optionDef, 1)).toBe("弱");
    expect(optionLabelFor(optionDef, 4)).toBe("OD");
    expect(optionLabelFor(optionDef, 1, "en")).toBe("Light");
    // 値域外(clamp されていない生の値)は undefined。⇒ 呼び出し側は数値へ落ちる。
    expect(optionLabelFor(optionDef, 9)).toBeUndefined();
    // options を持たない state は常に undefined。
    expect(optionLabelFor(intDef, 1)).toBeUndefined();
  });

  it("★★ラベル固定句がストック語から時点語へ差し替わる(options 付きのときだけ)", () => {
    expect(customStateIntLabel(optionDef, "startMin", "ja")).toBe("ヨガアーチ設置：始動時");
    expect(customStateIntLabel(optionDef, "end", "ja")).toBe("ヨガアーチ設置：終了時");
    expect(customStateIntLabel(optionDef, "startMin", "en")).toBe("Yoga Arch is set: at start");
    // ★陰性対照: options を持たない state は従来どおりストック語のままである。
    expect(customStateIntLabel(intDef, "startMin", "ja")).toBe(
      "サンシンボル：始動時に必要な最低のストック数",
    );
  });

  it("resolveCustomStatesForDisplay が valueLabel を埋める(①②の 2 行)", () => {
    const s = JSON.stringify({
      custom_states: { yoga_arch_is_set: { start_min: 1, end: 3 } },
    });
    const r = resolveCustomStatesForDisplay(s, [optionDef]);
    expect(r.map((x) => [x.kind, x.value, x.valueLabel])).toEqual([
      ["start_min", 1, "弱"],
      ["end", 3, "強"],
    ]);
    expect(r.map(customStateValueText)).toEqual(["弱", "強"]);
  });

  // ★★表示 3 面(詳細 / 比較 / エクスポート)が共有する SSOT の陰性対照。
  //   options を持たない state では従来どおり数値が出る。
  it("★options を持たない int state は valueLabel が undefined で数値のまま", () => {
    const s = JSON.stringify({ custom_states: { sun_crest: { start_min: 1, end: 3 } } });
    const r = resolveCustomStatesForDisplay(s, [intDef]);
    expect(r.map((x) => x.valueLabel)).toEqual([undefined, undefined]);
    expect(r.map(customStateValueText)).toEqual(["1", "3"]);
  });

  it("既定値(両者 min = 「なし」)は表示に含めない(既存の消去意味論のまま)", () => {
    const s = JSON.stringify({
      custom_states: { yoga_arch_is_set: { start_min: 0, end: 0 } },
    });
    expect(resolveCustomStatesForDisplay(s, [optionDef])).toEqual([]);
  });

  it("buildSituation は options 付き state も従来どおり構造化して格納する", () => {
    const out = buildSituation(null, { yoga_arch_is_set: { start_min: 0, end: 2 } }, [
      optionDef,
    ]);
    expect(JSON.parse(out ?? "{}")).toEqual({
      custom_states: { yoga_arch_is_set: { start_min: 0, end: 2 } },
    });
  });
});

// ---- M31-05 追補: single_value(①②へ分けない int state) ----

// 実データ相当(migrations/000110 の kimberly `shuriken_bomb_is_set`)。
const singleStockDef: CustomStateDef = {
  code: "shuriken_bomb_is_set",
  name_ja: "細工手裏剣設置数",
  name_en: "Shuriken Bombs Set",
  type: "stock",
  value_definition: { kind: "integer", min: 0, max: 3, single_value: true },
};

// 実データ相当(migrations/000110 の dhalsim `yoga_arch_is_set`)。選択肢 ＋ single。
const singleOptionDef: CustomStateDef = {
  ...optionDef,
  value_definition: { ...optionDef.value_definition, single_value: true },
};

// ★陰性対照。既存の残弾 state(kimberly `shuriken_bomb_stock`。投入元は 000003_data_seed_characters)。
const stockDef: CustomStateDef = {
  code: "shuriken_bomb_stock",
  name_ja: "手裏剣ストック",
  name_en: "Shuriken Bomb Stocks",
  type: "stock",
  value_definition: { kind: "integer", min: 0, max: 3 },
  show_delta: true,
};

describe("M31-05 追補: single_value", () => {
  it("single_value を持つ int state だけが判定に当たる", () => {
    expect(isSingleValueState(singleStockDef)).toBe(true);
    expect(isSingleValueState(singleOptionDef)).toBe(true);
    // ★陰性対照: 既存のストック系と sun_crest は当たらない。
    expect(isSingleValueState(stockDef)).toBe(false);
    expect(isSingleValueState(intDef)).toBe(false);
    // ★flag は int ではないので当たらない(元から 1 値である)。
    expect(isSingleValueState({ ...flagDef, value_definition: { single_value: true } })).toBe(
      false,
    );
  });

  // ★★ラベルから固定句が消える。⇒ ①②が無いのだから「始動時 / 終了時」を言う相手が居ない。
  it("★★single_value のラベルは state 名だけになる(固定句が付かない)", () => {
    expect(customStateIntLabel(singleStockDef, "end", "ja")).toBe("細工手裏剣設置数");
    expect(customStateIntLabel(singleStockDef, "startMin", "ja")).toBe("細工手裏剣設置数");
    expect(customStateIntLabel(singleOptionDef, "end", "ja")).toBe("ヨガアーチ設置");
    expect(customStateIntLabel(singleStockDef, "end", "en")).toBe("Shuriken Bombs Set");
  });

  // ★★これが中-2(残弾と設置数がラベル上で区別できない)の是正である。
  it("★★同じキャラの残弾 state と設置数 state が、画面上で別の文言になる", () => {
    const stock = customStateIntLabel(stockDef, "startMin", "ja");
    const placed = customStateIntLabel(singleStockDef, "end", "ja");
    expect(stock).toBe("手裏剣ストック：始動時に必要な最低のストック数");
    expect(placed).toBe("細工手裏剣設置数");
    expect(stock).not.toBe(placed);
  });

  // ★陰性対照: single_value を持たない int state は 1 文字も変わらない。
  it("★single_value を持たない int state は従来どおり固定句が付く", () => {
    expect(customStateIntLabel(stockDef, "end", "ja")).toBe("手裏剣ストック：終了時のストック数");
    expect(customStateIntLabel(intDef, "startMin", "ja")).toBe(
      "サンシンボル：始動時に必要な最低のストック数",
    );
    expect(customStateIntLabel(optionDef, "startMin", "ja")).toBe("ヨガアーチ設置：始動時");
  });

  it("normalizeIntValue は single_value を 1 つの値へ畳む", () => {
    // 両方入っている(正規形)。
    expect(normalizeIntValue({ start_min: 2, end: 2 }, singleOptionDef)).toEqual({
      start_min: 2,
      end: 2,
    });
    // ★片方だけの形(手書き JSON・旧データ)も、既定でない側を採って畳む。
    expect(normalizeIntValue({ end: 3 }, singleOptionDef)).toEqual({ start_min: 3, end: 3 });
    expect(normalizeIntValue({ start_min: 1 }, singleOptionDef)).toEqual({
      start_min: 1,
      end: 1,
    });
    // 未付与は既定。
    expect(normalizeIntValue(undefined, singleOptionDef)).toEqual({ start_min: 0, end: 0 });
  });

  it("★★表示は 1 行になる(ラベルは state 名・値はラベル解決)", () => {
    const s = JSON.stringify({
      custom_states: { yoga_arch_is_set: { start_min: 3, end: 3 } },
    });
    const r = resolveCustomStatesForDisplay(s, [singleOptionDef]);
    expect(r).toHaveLength(1);
    expect(r[0].kind).toBe("single");
    expect(r[0].label).toBe("ヨガアーチ設置");
    expect(customStateValueText(r[0])).toBe("強");
  });

  it("★陰性対照: single_value を持たない int state は従来どおり 2 行", () => {
    const s = JSON.stringify({ custom_states: { sun_crest: { start_min: 1, end: 3 } } });
    const r = resolveCustomStatesForDisplay(s, [intDef]);
    expect(r.map((x) => x.kind)).toEqual(["start_min", "end"]);
  });

  it("既定値は表示に含めない(既存の消去意味論のまま)", () => {
    const s = JSON.stringify({
      custom_states: { shuriken_bomb_is_set: { start_min: 0, end: 0 } },
    });
    expect(resolveCustomStatesForDisplay(s, [singleStockDef])).toEqual([]);
  });

  it("buildSituation は single_value も {start_min, end} の同値で格納する", () => {
    const out = buildSituation(null, { yoga_arch_is_set: { start_min: 2, end: 2 } }, [
      singleOptionDef,
    ]);
    expect(JSON.parse(out ?? "{}")).toEqual({
      custom_states: { yoga_arch_is_set: { start_min: 2, end: 2 } },
    });
  });

  // ★低-4: 戻り型を string に固定した(将来 number ガードを外しても "undefined" が出ない)。
  it("customStateValueText は flag(boolean)に対して空文字を返す", () => {
    expect(
      customStateValueText({
        code: "denjin_charge",
        label: "電刃錬気",
        type: "flag",
        value: true,
        kind: "flag",
      }),
    ).toBe("");
  });
});
