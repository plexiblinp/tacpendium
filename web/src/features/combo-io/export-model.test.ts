import { describe, expect, it } from "vitest";

import { buildComboFields, buildComboHeader } from "./export-model";
import type { ExportItemKey } from "./export-items";
import { ALL_EXPORT_ITEM_KEYS } from "./export-items";
import { makeCombo, TEST_CHARACTERS } from "./export-test-helpers";

const all = (): Set<ExportItemKey> => new Set(ALL_EXPORT_ITEM_KEYS);

describe("buildComboHeader", () => {
  it("キャラ名 + #id を見出しに、始動状況を副題にする", () => {
    const h = buildComboHeader(makeCombo(), TEST_CHARACTERS);
    expect(h.title).toContain("リュウ");
    expect(h.title).toContain("#1");
    // 始動状況 = 始動技 / ヒット種別 / 始動位置
    expect(h.subtitle).toContain("2LK");
    expect(h.subtitle).toContain("パニッシュカウンター");
    expect(h.subtitle).toContain("自分画面端");
  });

  it("キャラ未解決でもフォールバック表示する", () => {
    const h = buildComboHeader(makeCombo({ characterId: 99 }), TEST_CHARACTERS);
    expect(h.title).toContain("キャラ#99");
  });
});

describe("buildComboFields 表示項目選択", () => {
  it("選択した項目のみが行に含まれる", () => {
    const rows = buildComboFields(
      makeCombo(),
      TEST_CHARACTERS,
      new Set<ExportItemKey>(["damage", "memo"]),
    );
    const labels = rows.map((r) => r.label);
    expect(labels).toContain("ダメージ");
    expect(labels).toContain("備考");
    expect(labels).not.toContain("ドライブダメージ");
    expect(labels).not.toContain("セットプレイ");
  });

  it("oki を選ぶと 12 変種の個別行へ展開される(M16-03・✓/✗)", () => {
    const rows = buildComboFields(
      makeCombo(),
      TEST_CHARACTERS,
      new Set<ExportItemKey>(["oki"]),
    );
    expect(rows).toHaveLength(12);
    const byLabel = Object.fromEntries(rows.map((r) => [r.label, r.value]));
    // fixture の okiOptions = throw_meaty/neutral/nogauge + shimmy/neutral/nogauge。
    // ★M24-03 §4.5(SM-097): ノーゲージ版のラベルに「・ノーゲージ」が付いた。
    //   母集合(12 変種)は変えていない。ラベル文字列だけが後状態へ動く。
    expect(byLabel["投げ重ね(その場受け身・ノーゲージ)"]).toBe("✓");
    expect(byLabel["投げ重ね(その場受け身・ドライブラッシュ)"]).toBe("✗");
    expect(byLabel["シミー(その場受け身・ノーゲージ)"]).toBe("✓");
    // 新規 attack_type(打撃重ね)も行として展開される。
    expect(byLabel["打撃重ね(後ろ受け身・ドライブラッシュ)"]).toBe("✗");
  });

  it("セットプレイは名称のみ出力される(M17-05c-fix・レシピは併記しない)", () => {
    const rows = buildComboFields(
      makeCombo(),
      TEST_CHARACTERS,
      new Set<ExportItemKey>(["setups"]),
    );
    const setup = rows.find((r) => r.label === "セットプレイ");
    // 名称が設定されていれば名称のみ(旧「名称: フルレシピ」を見直し)。
    expect(setup?.value).toContain("起き攻めA");
    expect(setup?.value).not.toContain("5LP 重ね");
  });

  it("セットプレイの名称未設定はレシピ流用を表示し、複数は ' / ' 連結する(M17-05c-fix)", () => {
    const rows = buildComboFields(
      makeCombo({
        setups: [
          {
            id: 10,
            characterId: 7,
            name: "起き攻めA",
            description: null,
            stepCount: 1,
            version: 1,
            defaultRecipe: "5LP 重ね",
            parentComboIds: [1],
          },
          {
            id: 11,
            characterId: 7,
            name: "",
            description: null,
            stepCount: 1,
            version: 1,
            defaultRecipe: "2MK 持続",
            parentComboIds: [1],
          },
        ],
      }),
      TEST_CHARACTERS,
      new Set<ExportItemKey>(["setups"]),
    );
    const v = rows.find((r) => r.label === "セットプレイ")?.value ?? "";
    // 名称あり=名称 / 名称なし=レシピ流用、区切りは " / "。
    expect(v).toBe("起き攻めA / 2MK 持続");
  });

  it("M16-07: int custom_states を ①②(③)の明示ラベル + 値で ja 出力する", () => {
    const characters = [
      {
        id: 8,
        gameId: 1,
        code: "ingrid",
        nameJa: "イングリッド",
        nameEn: "Ingrid",
        customStates: JSON.stringify({
          states: [
            {
              code: "sun_crest",
              name_ja: "サンシンボル",
              name_en: "Sun Crest",
              type: "level",
              value_definition: { kind: "integer", min: 0, max: 4 },
              show_delta: true,
            },
          ],
        }),
      },
    ];
    const rows = buildComboFields(
      makeCombo({
        characterId: 8,
        situation: JSON.stringify({ custom_states: { sun_crest: { start_min: 1, end: 3 } } }),
      }),
      characters,
      new Set<ExportItemKey>(["customStates"]),
    );
    const v = rows.find((r) => r.label === "キャラ固有状態")?.value ?? "";
    // ①②③ の明示ラベル(ja 固定)+ 値・③ は符号付き
    expect(v).toContain("サンシンボル：始動時に必要な最低のストック数: 1");
    expect(v).toContain("サンシンボル：終了時のストック数: 3");
    expect(v).toContain("サンシンボル：ストック増減: +2");
  });

  it("状況はラベル解決された値を結合する", () => {
    const rows = buildComboFields(
      makeCombo(),
      TEST_CHARACTERS,
      new Set<ExportItemKey>(["situation"]),
    );
    const v = rows.find((r) => r.label === "状況")?.value ?? "";
    expect(v).toContain("自分画面端");
    expect(v).toContain("しゃがみ");
    expect(v).toContain("パニッシュカウンター");
  });

  it("値が無い項目は '-' になるが行は残る(列ぞろえ)", () => {
    const rows = buildComboFields(
      makeCombo({ damage: undefined, memo: undefined, setups: [] }),
      TEST_CHARACTERS,
      all(),
    );
    expect(rows.find((r) => r.label === "ダメージ")?.value).toBe("-");
    expect(rows.find((r) => r.label === "備考")?.value).toBe("-");
    expect(rows.find((r) => r.label === "セットプレイ")?.value).toBe("-");
  });

  it("全選択時の行数 = 28(M17-01: メディア 3 項目追加で 16 + oki 12 変種)", () => {
    const rows = buildComboFields(makeCombo(), TEST_CHARACTERS, all());
    expect(rows).toHaveLength(28);
  });

  it("メディア 3 項目が文字列として出力され、値なしは '-' になる(M17-01)", () => {
    const rows = buildComboFields(
      makeCombo({
        link: "https://example.com/guide",
        videoPath: "videos/ryu-bnb.mp4",
        // imagePath 未設定 = "-"
      }),
      TEST_CHARACTERS,
      new Set<ExportItemKey>(["link", "videoPath", "imagePath"]),
    );
    const byLabel = Object.fromEntries(rows.map((r) => [r.label, r.value]));
    // URL/パスの文字列のみ(画像実体の埋め込みはしない・CHANGE-068 §2.3-k)。
    expect(byLabel["リンク"]).toBe("https://example.com/guide");
    expect(byLabel["動画パス"]).toBe("videos/ryu-bnb.mp4");
    expect(byLabel["画像パス"]).toBe("-");
    // メディア項目は既定選択(全項目)に含まれる。
    expect(ALL_EXPORT_ITEM_KEYS).toContain("link");
    expect(ALL_EXPORT_ITEM_KEYS).toContain("videoPath");
    expect(ALL_EXPORT_ITEM_KEYS).toContain("imagePath");
  });

  it("消費エクスポート項目が始動と対称に出力される(A-1・M16-06)", () => {
    const rows = buildComboFields(
      makeCombo({ driveGaugeConsumed: 3.5, saGaugeConsumed: 5 }),
      TEST_CHARACTERS,
      new Set<ExportItemKey>(["driveConsumed", "saConsumed"]),
    );
    const byLabel = Object.fromEntries(rows.map((r) => [r.label, r.value]));
    expect(byLabel["ドライブゲージ消費"]).toBe("3.5");
    expect(byLabel["SAゲージ消費"]).toBe("5");
    // 消費項目は ALL_EXPORT_ITEM_KEYS(= 既定選択)に含まれる(始動と対称に既定 ON)。
    expect(ALL_EXPORT_ITEM_KEYS).toContain("driveConsumed");
    expect(ALL_EXPORT_ITEM_KEYS).toContain("saConsumed");
  });

  it("始動ラベルが正典「コンボ開始時の◯◯ゲージ残量」で出力される(A-3・M16-06)", () => {
    const rows = buildComboFields(
      makeCombo(),
      TEST_CHARACTERS,
      new Set<ExportItemKey>(["driveStart", "saStart"]),
    );
    const labels = rows.map((r) => r.label);
    expect(labels).toContain("コンボ開始時のドライブゲージ残量");
    expect(labels).toContain("コンボ開始時のSAゲージ残量");
  });
});

// ★★M27-03(SD-009) レビュー(中-4): エクスポート面の表示を変えたのにテストが 0 件だった。
//
// 完了報告 §2.4 は「面を割らなかった」ことを主張の柱にしている。⇒ **その主張そのものを
// テストにする**。詳細画面とエクスポートで同じ値が別の文字列になる退行を機械で止める。
//
// ★本面は i18n を通らない(jaLabel が既定引数で効く)。⇒ 日本語の実文字列で見る。
describe("buildComboFields ドライブダメージの符号(M27-03 / SD-009)", () => {
  function driveDamageRow(driveDamage: number | undefined) {
    const rows = buildComboFields(
      makeCombo({ driveDamage }),
      TEST_CHARACTERS,
      new Set<ExportItemKey>(["driveDamage"]),
    );
    const row = rows.find((r) => r.key === "driveDamage");
    expect(row, "driveDamage の行が出ていない").toBeTruthy();
    return row!.value;
  }

  it("★負はそのままで「削り」を添える", () => {
    expect(driveDamageRow(-2.5)).toBe("-2.5 削り");
  });

  it("★正は + を付けて「回復」を添える", () => {
    expect(driveDamageRow(1)).toBe("+1 回復");
  });

  it("★0 には符号も語も付けない", () => {
    expect(driveDamageRow(0)).toBe("0");
  });

  it("未入力はハイフンのみ", () => {
    expect(driveDamageRow(undefined)).toBe("-");
  });

  it("★ラベルは「ドライブダメージ」のまま(項目を分けていない)", () => {
    const rows = buildComboFields(
      makeCombo({ driveDamage: 2.5 }),
      TEST_CHARACTERS,
      new Set<ExportItemKey>(["driveDamage"]),
    );
    expect(rows.map((r) => r.label)).toEqual(["ドライブダメージ"]);
  });
});

// M28-02c / CHANGE-162 §5-3: エクスポートには前提バージョンも印も出さない。
//
// ★出すと CSV の列契約に波及する(CHANGE-159 §6 が baseline_version を CSV に載せない
//   と決めている)。⇒ 出る面は詳細の 2 つ(コンボ詳細 / ゴミ箱詳細)で止める。
describe("エクスポートとゲーム更新(M28-02c)", () => {
  it("★前提バージョンも「更新未確認」の印も出さない", () => {
    const rows = buildComboFields(
      makeCombo({
        baselineVersion: "2026.08.03.01",
        affectedByGameUpdate: true,
        affectedMoves: [
          {
            moveId: 10,
            code: "2MK",
            nameJa: "しゃがみ中キック",
            lastChangedGameVersion: "2026.09.10.01",
          },
        ],
      }),
      TEST_CHARACTERS,
      all(),
    );
    const dumped = JSON.stringify(rows);
    expect(dumped).not.toContain("2026.08.03.01");
    expect(dumped).not.toContain("更新未確認");
    expect(dumped).not.toContain("前提バージョン");
    expect(rows.some((r) => r.key === "baselineVersion")).toBe(false);
  });

  it("★見出しにも出さない", () => {
    const h = buildComboHeader(
      makeCombo({ baselineVersion: "2026.08.03.01", affectedByGameUpdate: true }),
      TEST_CHARACTERS,
    );
    expect(`${h.title} ${h.subtitle}`).not.toContain("2026.08.03.01");
    expect(`${h.title} ${h.subtitle}`).not.toContain("更新未確認");
  });
});
