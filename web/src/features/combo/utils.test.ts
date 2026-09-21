import { describe, expect, it } from "vitest";
import {
  HIT_TYPE_LABEL_KEYS,
  OPPONENT_SIZE_LABEL_KEYS,
  OPPONENT_STANCE_LABEL_KEYS,
  POSITION_LABELS,
  POSITION_LABEL_KEYS,
  driveDamageDirectionLabel,
  formatDamage,
  formatDriveDamage,
  formatDriveGauge,
  formatMemo,
  formatSAGauge,
  formatRecipeLine,
  formatSituationStatus,
  formatStarterStatus,
  getSetupDisplayName,
  hasKeyChanges,
  isFormReadyForDuplicateCheck,
  labelFor,
} from "./utils";
import type { ComboKeyFields } from "./utils";
import type { ComboSummary } from "./types";
import type { Move } from "@/features/moves/types";

describe("getSetupDisplayName", () => {
  it("name が指定されていればそれを返す", () => {
    expect(getSetupDisplayName("我流連携", "立ち弱P > 立ち中P", false)).toBe(
      "我流連携",
    );
  });

  it("name が null かつ recipe が PC 上限 30 文字以内ならレシピそのまま返す", () => {
    const recipe = "立ち弱P > 立ち中P > 中波動拳"; // 18 文字程度
    expect(getSetupDisplayName(null, recipe, false)).toBe(recipe);
  });

  it("name が null かつ recipe が PC 上限を超えたら省略する", () => {
    const recipe = "0123456789".repeat(4); // 40 文字
    const result = getSetupDisplayName(null, recipe, false);
    expect(result.endsWith("…")).toBe(true);
    // 30 文字 + "…" = 31 文字
    expect(result.length).toBe(31);
  });

  it("name が undefined でも null と同じ挙動", () => {
    const recipe = "短いレシピ";
    expect(getSetupDisplayName(undefined, recipe, false)).toBe(recipe);
  });

  it("モバイル時の上限 20 文字で省略する", () => {
    const recipe = "0123456789".repeat(3); // 30 文字
    const result = getSetupDisplayName(null, recipe, true);
    expect(result.endsWith("…")).toBe(true);
    expect(result.length).toBe(21);
  });

  it("name が空文字列のときはフォールバック扱い(falsy判定)", () => {
    expect(getSetupDisplayName("", "代替表示", false)).toBe("代替表示");
  });
});

describe("labelFor", () => {
  // ★★M24-07 レビュー(高-2)で書き直した。以前は第 1 引数へ *_LABELS(日本語の写し)を
  //   渡す形を固定しており、labelFor の契約が「値 → i18n キーの対応表」へ変わったあとも
  //   jaLabel の「引けなければキーをそのまま返す」フォールバックに救われて緑のまま
  //   通っていた。⇒ 主張はそのまま(同じ日本語が出ること)に、渡す物だけを新しい契約へ
  //   合わせる。★型でも止まるようにした(LabelKeyMap)ので、これは二重の網である。
  it("対応するラベルを返す", () => {
    expect(labelFor(POSITION_LABEL_KEYS, "mid_screen")).toBe("画面中央");
    expect(labelFor(OPPONENT_STANCE_LABEL_KEYS, "any")).toBe("不問");
    expect(labelFor(HIT_TYPE_LABEL_KEYS, "punish_counter")).toBe(
      "パニッシュカウンター",
    );
    expect(labelFor(OPPONENT_SIZE_LABEL_KEYS, "large2")).toBe("大2(マリーザ等)");
  });

  it("M18-01: just_parry_punish_counter の新ラベルを返し既存値は不変", () => {
    expect(labelFor(HIT_TYPE_LABEL_KEYS, "just_parry_punish_counter")).toBe(
      "パニッシュカウンター(ジャストパリィ反撃)",
    );
    // 既存 punish_counter ラベルは据置。
    expect(labelFor(HIT_TYPE_LABEL_KEYS, "punish_counter")).toBe(
      "パニッシュカウンター",
    );
  });

  it("未知のコード値はそのまま返す(将来追加への前方互換)", () => {
    expect(labelFor(POSITION_LABEL_KEYS, "unknown_position")).toBe(
      "unknown_position",
    );
  });

  it("undefined/null/空文字はハイフンを返す", () => {
    expect(labelFor(POSITION_LABEL_KEYS, undefined)).toBe("-");
    expect(labelFor(POSITION_LABEL_KEYS, null)).toBe("-");
    expect(labelFor(POSITION_LABEL_KEYS, "")).toBe("-");
  });

  // ★★「*_LABELS は日本語の写しであって、labelFor へ渡す物ではない」ことを
  //   実行時にも 1 本だけ主張しておく。型検査を外した将来にも残る網である。
  it("★*_LABELS(日本語の写し)は i18n キーではない——キーはドットを含む", () => {
    expect(POSITION_LABELS.mid_screen).toBe("画面中央");
    expect(POSITION_LABELS.mid_screen).not.toContain(".");
    expect(POSITION_LABEL_KEYS.mid_screen).toContain(".");
  });
});

describe("formatStarterStatus", () => {
  const base: ComboSummary = {
    id: 1,
    characterId: 1,
    isDraft: false,
    affectedByGameUpdate: false,
    affectedMoves: [],
    stepCount: 0,
    version: 1,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    tags: [],
    defaultRecipe: "",
    starterMoveCode: "",
  };

  it("3情報すべてを中黒区切りで結合する", () => {
    const combo: ComboSummary = {
      ...base,
      starterMoveId: 42,
      hitType: "counter",
      position: "corner_opponent",
    };
    expect(formatStarterStatus(combo)).toBe("始動技#42 / カウンター / 相手画面端");
  });

  it("欠損がある場合はハイフンや「始動技?」で埋める", () => {
    const combo: ComboSummary = { ...base };
    expect(formatStarterStatus(combo)).toBe("始動技? / - / -");
  });

  // ★★M24-07(SM-006 = SM-059): 先頭は**内部の英語 move code ではなく技の表示名**である。
  //   フォールバックは 3 段: 表示名 → move code → 始動技#<id>。
  //   ★move code へ落ちる経路は実在する(ラッシュ版は official_ja_move の alias を持たない)。
  //     隠さずコードを出すのは既存規約(usePreviewNames)と同じで、無言で空にするより情報が多い。
  it("★先頭は技の表示名を出す(内部の move code を画面へ出さない)", () => {
    const combo: ComboSummary = {
      ...base,
      starterMoveId: 42,
      starterMoveCode: "standing_light_punch",
      starterMoveNameJa: "立ち弱P",
      hitType: "normal",
      position: "mid_screen",
    };
    expect(formatStarterStatus(combo)).toBe("立ち弱P / 通常 / 画面中央");
    expect(formatStarterStatus(combo)).not.toContain("standing_light_punch");
  });

  it("★表示名が無いときだけ move code へ落ちる(ラッシュ版など)", () => {
    const combo: ComboSummary = {
      ...base,
      starterMoveId: 42,
      starterMoveCode: "rush_standing_light_punch",
      hitType: "normal",
      position: "mid_screen",
    };
    expect(formatStarterStatus(combo)).toBe(
      "rush_standing_light_punch / 通常 / 画面中央",
    );
  });

  it("★空文字の表示名は「無い」として扱う(空欄で始まる表示を作らない)", () => {
    const combo: ComboSummary = {
      ...base,
      starterMoveId: 42,
      starterMoveCode: "standing_light_punch",
      starterMoveNameJa: "   ",
    };
    expect(formatStarterStatus(combo)).toBe("standing_light_punch / - / -");
  });

  // ★★M27-03(P4M-020): 一覧は始動技を出さない版を使う。
  //   ★消したのは表示だけであり、formatStarterStatus 側は 1 文字も変わっていない
  //     (エクスポートは DES-005 §5.13 が始動技を常時出力と定めているため)。
  describe("formatSituationStatus(始動技を出さない版)", () => {
    it("ヒット種別 / 始動位置 だけを返す", () => {
      const combo: ComboSummary = {
        ...base,
        starterMoveId: 42,
        starterMoveCode: "standing_light_punch",
        starterMoveNameJa: "立ち弱P",
        hitType: "counter",
        position: "corner_opponent",
      };
      expect(formatSituationStatus(combo)).toBe("カウンター / 相手画面端");
    });

    it("★始動技の情報が 1 つも混ざらない(表示名・code・#id のいずれも)", () => {
      const combo: ComboSummary = {
        ...base,
        starterMoveId: 42,
        starterMoveCode: "standing_light_punch",
        starterMoveNameJa: "立ち弱P",
        hitType: "normal",
        position: "mid_screen",
      };
      const out = formatSituationStatus(combo);
      expect(out).not.toContain("立ち弱P");
      expect(out).not.toContain("standing_light_punch");
      expect(out).not.toContain("始動技");
    });

    it("欠損はハイフンで埋める", () => {
      expect(formatSituationStatus({ ...base })).toBe("- / -");
    });

    // ★語の生成は 1 本である——formatStarterStatus は本関数を呼んでいる。
    it("★formatStarterStatus の後半と一致する", () => {
      const combo: ComboSummary = {
        ...base,
        starterMoveId: 42,
        starterMoveNameJa: "立ち弱P",
        hitType: "counter",
        position: "corner_opponent",
      };
      expect(formatStarterStatus(combo)).toBe(
        `立ち弱P / ${formatSituationStatus(combo)}`,
      );
    });
  });
});

describe("数値整形", () => {
  it("formatDamage は undefined をハイフン表示", () => {
    expect(formatDamage(undefined)).toBe("-");
    expect(formatDamage(0)).toBe("0");
    expect(formatDamage(2400)).toBe("2400");
  });

  it("formatDriveGauge は小数の末尾 .0 を除去", () => {
    expect(formatDriveGauge(undefined)).toBe("-");
    expect(formatDriveGauge(2)).toBe("2");
    expect(formatDriveGauge(2.5)).toBe("2.5");
  });

  it("formatSAGauge は整数文字列", () => {
    expect(formatSAGauge(undefined)).toBe("-");
    expect(formatSAGauge(1)).toBe("1");
  });

  // ★★M27-03(SD-009): 符号を明示する。開発者の逐語＝「正負がどっちを表すか
  //   いまは良く分からないので、表示を見直したい。」
  describe("formatDriveDamage(符号の明示)", () => {
    it("★正には + を付ける(有利フレームと同じ作法)", () => {
      expect(formatDriveDamage(2.5)).toBe("+2.5");
      expect(formatDriveDamage(6)).toBe("+6");
    });

    it("負はそのまま", () => {
      expect(formatDriveDamage(-1)).toBe("-1");
      expect(formatDriveDamage(-2.5)).toBe("-2.5");
    });

    it("★0 には符号を付けない(+0 は「削った」と読めるため)", () => {
      expect(formatDriveDamage(0)).toBe("0");
    });

    it("未入力はハイフン", () => {
      expect(formatDriveDamage(undefined)).toBe("-");
      expect(formatDriveDamage(null)).toBe("-");
    });

    it("小数 2 桁の丸めは従来どおり(REAL round-trip の桁あふれ対策)", () => {
      expect(formatDriveDamage(2.5000000001)).toBe("+2.5");
    });
  });

  describe("driveDamageDirectionLabel(符号の向きの語)", () => {
    // ★★2026-09-05 開発者指示で符号の意味を入れ替えた(負 = 削り / 正 = 回復)。
    //   ★既存値はマイグレ 000103 で反転させてある。値と表示は同時に入れ替わる。
    it("負は「削り」・正は「回復」", () => {
      expect(driveDamageDirectionLabel(-2.5)).toBe("削り");
      expect(driveDamageDirectionLabel(1)).toBe("回復");
    });

    it("★0 と未入力には語を付けない(どちらでもないため)", () => {
      expect(driveDamageDirectionLabel(0)).toBeNull();
      expect(driveDamageDirectionLabel(undefined)).toBeNull();
      expect(driveDamageDirectionLabel(null)).toBeNull();
    });

    it("★語は locale から引く(呼び出し側で文字列を組み立てない)", () => {
      const spy = (key: string) => `<<${key}>>`;
      expect(driveDamageDirectionLabel(-1, spy)).toBe(
        "<<comboDetail.driveDamageDirection.cut>>",
      );
      expect(driveDamageDirectionLabel(1, spy)).toBe(
        "<<comboDetail.driveDamageDirection.recover>>",
      );
    });
  });
});

describe("formatMemo", () => {
  it("短いメモはそのまま返す", () => {
    expect(formatMemo("テストメモ")).toBe("テストメモ");
  });
  it("空・undefined は空文字を返す", () => {
    expect(formatMemo(undefined)).toBe("");
    expect(formatMemo("")).toBe("");
  });
  it("30 文字を超えるメモは省略する", () => {
    const memo = "0123456789".repeat(4);
    const result = formatMemo(memo);
    expect(result.endsWith("…")).toBe(true);
    expect(result.length).toBe(31);
  });
});

const baseStep = {
  stepOrder: 1,
  moveId: 100,
  modifiers: undefined,
};

const baseKey: ComboKeyFields = {
  characterId: 1,
  starterMoveId: 100,
  position: "mid_screen",
  opponentStance: "standing",
  hitType: "normal",
  opponentSize: "standard",
  steps: [
    { ...baseStep, stepOrder: 1, moveId: 100 },
    { stepOrder: 2, moveId: 101 },
  ],
};

describe("hasKeyChanges", () => {
  it("position が変わった場合は true を返す", () => {
    const next: ComboKeyFields = { ...baseKey, position: "corner_self" };
    expect(hasKeyChanges(baseKey, next)).toBe(true);
  });

  // ★★M37-07 §5-4: starter_meaty は重複判定キーの 8 つ目である。
  //   ⇒ 変えると PUT(キー変更編集)へ振り分けられなければならない。
  //   ★落ちるときは PATCH へ流れており、同じキーの行が 2 つ並ぶ。
  it("★starterMeaty が変わった場合は true を返す(PUT へ振り分ける)", () => {
    const next: ComboKeyFields = { ...baseKey, starterMeaty: true };
    expect(hasKeyChanges(baseKey, next)).toBe(true);
    // 逆向きも同じ。
    expect(hasKeyChanges(next, baseKey)).toBe(true);
  });

  // ★undefined は false と同値である —— 列が NOT NULL DEFAULT 0 であり
  //   「未設定」という状態を持たない。⇒ 保存済みの行を読み直しただけで
  //   PUT へ流れる(＝旧行を捨てて id を採番し直す)ことがあってはならない。
  it("★starterMeaty の undefined と false は同値(誤って PUT へ流れない)", () => {
    const withUndefined: ComboKeyFields = { ...baseKey };
    const withFalse: ComboKeyFields = { ...baseKey, starterMeaty: false };
    expect(hasKeyChanges(withUndefined, withFalse)).toBe(false);
    expect(hasKeyChanges(withFalse, withUndefined)).toBe(false);
  });

  it("recipe の modifiers のみが変わった場合も true を返す(SUPP-001 §2.2)", () => {
    const next: ComboKeyFields = {
      ...baseKey,
      steps: [
        { stepOrder: 1, moveId: 100, modifiers: { flags: ["just"] } },
        { stepOrder: 2, moveId: 101 },
      ],
    };
    expect(hasKeyChanges(baseKey, next)).toBe(true);
  });

  it("メモだけ変わった場合(キー以外のみ変化)は false を返す", () => {
    // メモは ComboKeyFields に含まれないため、初期値と現在値で steps/キー値が同一なら
    // キー変更は無いと判定される。呼び出し側ではメモは比較対象外。
    const next: ComboKeyFields = { ...baseKey };
    expect(hasKeyChanges(baseKey, next)).toBe(false);
  });

  it("タグだけ変わった想定でも、キー値が同一なら false を返す", () => {
    // タグは ComboKeyFields に含まれない(M1-06 ではタグ UI 自体無し)。
    // キー値同一の clone を渡せば false。
    const next: ComboKeyFields = {
      ...baseKey,
      steps: baseKey.steps.map((s) => ({ ...s })),
    };
    expect(hasKeyChanges(baseKey, next)).toBe(false);
  });

  it("hit_type が変わった場合も true を返す(CHANGE-006)", () => {
    const next: ComboKeyFields = { ...baseKey, hitType: "counter" };
    expect(hasKeyChanges(baseKey, next)).toBe(true);
  });

  it("steps の長さが変わった場合は true を返す", () => {
    const next: ComboKeyFields = {
      ...baseKey,
      steps: [...baseKey.steps, { stepOrder: 3, moveId: 102 }],
    };
    expect(hasKeyChanges(baseKey, next)).toBe(true);
  });

  it("modifiers.flags の順序違いは同一とみなす(true を返さない)", () => {
    const before: ComboKeyFields = {
      ...baseKey,
      steps: [{ stepOrder: 1, moveId: 100, modifiers: { flags: ["just", "delay"] } }],
    };
    const after: ComboKeyFields = {
      ...baseKey,
      steps: [{ stepOrder: 1, moveId: 100, modifiers: { flags: ["delay", "just"] } }],
    };
    expect(hasKeyChanges(before, after)).toBe(false);
  });
});

const fullFields = {
  characterId: 1,
  starterMoveId: 10,
  position: "mid_screen",
  opponentStance: "standing",
  hitType: "normal",
  opponentSize: "standard",
  steps: [{ stepOrder: 1, moveId: 10 }],
};

describe("isFormReadyForDuplicateCheck", () => {
  it("全フィールドが揃っていれば true", () => {
    expect(isFormReadyForDuplicateCheck(fullFields)).toBe(true);
  });

  it("characterId が 0 なら false", () => {
    expect(isFormReadyForDuplicateCheck({ ...fullFields, characterId: 0 })).toBe(false);
  });

  it("starterMoveId が null なら false", () => {
    expect(isFormReadyForDuplicateCheck({ ...fullFields, starterMoveId: null })).toBe(false);
  });

  it("starterMoveId が undefined なら false", () => {
    expect(isFormReadyForDuplicateCheck({ ...fullFields, starterMoveId: undefined })).toBe(false);
  });

  it("steps が空配列なら false", () => {
    expect(isFormReadyForDuplicateCheck({ ...fullFields, steps: [] })).toBe(false);
  });

  it("position が null/空なら false", () => {
    expect(isFormReadyForDuplicateCheck({ ...fullFields, position: null })).toBe(false);
    expect(isFormReadyForDuplicateCheck({ ...fullFields, position: "" })).toBe(false);
  });

  it("opponentStance が null なら false", () => {
    expect(isFormReadyForDuplicateCheck({ ...fullFields, opponentStance: null })).toBe(false);
  });

  it("hitType が null なら false", () => {
    expect(isFormReadyForDuplicateCheck({ ...fullFields, hitType: null })).toBe(false);
  });

  it("opponentSize が null なら false", () => {
    expect(isFormReadyForDuplicateCheck({ ...fullFields, opponentSize: null })).toBe(false);
  });
});

describe("formatRecipeLine", () => {
  const move = (id: number, code: string, nameJa: string | null): Move =>
    ({
      id,
      characterId: 1,
      code,
      category: "normal",
      isAerial: false,
      setupOnly: false,
      isDerived: false,
      nameJa,
    }) as Move;

  const moves: Move[] = [
    move(10, "2MK", "中足"),
    move(20, "236P", "波動拳"),
    move(30, "623P", null), // nameJa 未登録 → code フォールバック
  ];

  it("steps を技名(nameJa)で > 連結する", () => {
    const steps = [
      { moveId: 10, stepOrder: 1 },
      { moveId: 20, stepOrder: 2 },
    ];
    expect(formatRecipeLine(steps, moves)).toBe("中足 > 波動拳");
  });

  it("nameJa 未登録の技は code へフォールバックする", () => {
    expect(formatRecipeLine([{ moveId: 30 }], moves)).toBe("623P");
  });

  it("moves に無い moveId は moveCode → #id の順にフォールバックする", () => {
    expect(formatRecipeLine([{ moveId: 99, moveCode: "5HP" }], moves)).toBe("5HP");
    expect(formatRecipeLine([{ moveId: 99 }], moves)).toBe("#99");
  });

  it("非技ステップは modifiers.type の区分ラベルで表す", () => {
    const steps = [
      { moveId: 10 },
      { moveId: null, modifiers: { type: "parry_drive_rush" } },
    ];
    // dash は M16-04 で system move へ一本化・modifier.type から撤去。非技 type は
    // parry_drive_rush / cancel_drive_rush のみ。
    // ★M37-06 §2.6-3: parry_drive_rush の表記をサーバ側の一般語「生ラッシュ」へ寄せた。
    expect(formatRecipeLine(steps, moves)).toBe("中足 > 生ラッシュ");
  });

  it("空/未定義は空文字を返す", () => {
    expect(formatRecipeLine([], moves)).toBe("");
    expect(formatRecipeLine(undefined, moves)).toBe("");
  });
});
