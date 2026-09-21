import { expect, type APIRequestContext } from "@playwright/test";

// M24-09c §4.3: 干渉を決定論的に起こすための共通ヘルパ。
//
// ★★なぜ「確率」ではなく「決定論」が要るのか————————————————————————
// flake の対策には固有の困難がある——「直った」ことを緑で示せない。元の発生率が
// 178 テスト中 1 件程度なので、対策後に 1 回緑が出ても、それは対策前でも起きたことである。
// ⇒ 干渉を必ず起こす spec を用意し、対策前は必ず赤・対策後は必ず緑になる形へ翻訳する。
//
// ★★仕掛け————————————————————————————————————————————
// 2 本の probe spec が「同じ識別キーの本登録コンボ」を取り合う。識別キーは
// characterId / starterMoveId / position / opponentStance / hitType / opponentSize の 6 項で、
// DB 全体で一意である(internal/service/combo/service.go:duplicateKeyOf)。VAL-C02 は
// 本登録の重複を ERROR で止める(internal/service/validation/combo.go:153)。
//   - 直列(workers=1): 「作る→確かめる→消す」が重ならない ⇒ 必ず緑。
//   - 並列(workers>=2): 2 本が同時に持つ ⇒ 必ず赤。
// ★これは「1 本を 2 回走らせて 2 回目が落ちる」形(＝冪等性)ではない。
//   2 本の別ファイルが同じデータ空間を奪い合う形である。
//
// ★★対象キャラに zangief を使う理由————————————————————————————
// どの既存 spec も触っていない(M24-09c の実査で全 51 spec を走査)。seed 済みでもある。
// ⇒ probe が他 spec を巻き添えにしない。逆に他 spec も probe を壊さない。
//
// ★本ファイルは spec ではない(playwright の既定 testMatch は *.spec.ts / *.test.ts のみ)。

export const PROBE_CHARACTER_CODE = "zangief";

/** PROBE_KEY は 2 本の probe が共有する識別キー(starterMoveId 以外)。 */
export const PROBE_KEY = {
  position: "corner_self",
  opponentStance: "standing",
  hitType: "normal",
  opponentSize: "standard",
} as const;

/**
 * PROBE_HOLD_MS は「作ってから消すまで」保持する時間。
 * ★並列時に 2 本の保持区間が必ず重なるだけの幅が要る。直列時はただの待ちであり、
 *   結果には影響しない(2 本合わせて約 6 秒の増加)。
 *
 * ★余白の根拠: 2 本が「作る」に到達するまでの前置き(キャラ解決 + 始動技の決定)は
 *   実測で 1 秒未満であり、3 秒はその 3 倍以上を見込んである。前置きがこれを超えるほど
 *   環境が遅くなると、並列でも重ならず緑になる(偽陰性)経路が生まれる。その場合は
 *   本値を上げること——probe が緑になったことを「干渉が消えた」と読まないための注記である。
 */
export const PROBE_HOLD_MS = 3000;

type Req = APIRequestContext;

interface Move {
  id: number;
  code: string;
  category: string;
  isAerial: boolean;
}

interface MoveDetail {
  id: number;
  damage: number | null;
  isAerial: boolean;
}

/** probeCharacterId は probe 専用キャラの id を返す。 */
export async function probeCharacterId(request: Req): Promise<number> {
  const res = await request.get("/api/games/1/characters");
  expect(res.ok(), await res.text()).toBeTruthy();
  const items = (await res.json()).items as Array<{ id: number; code: string }>;
  const c = items.find((x) => x.code === PROBE_CHARACTER_CODE);
  expect(c, `${PROBE_CHARACTER_CODE} が seed に無い`).toBeTruthy();
  return c!.id;
}

/**
 * probeStarterMoveId は始動技を 1 つ決める。
 * ★id 昇順で決め打ちする——2 本の probe が必ず同じ技を選ぶ必要があるため、
 *   ここに一意化(Date.now 等)を入れてはいけない。それを入れると干渉が起きなくなる。
 */
export async function probeStarterMoveId(request: Req, characterId: number): Promise<number> {
  const res = await request.get(`/api/moves?character_id=${characterId}`);
  expect(res.ok(), await res.text()).toBeTruthy();
  // ★一覧で落とせる条件はここで落とす。GET /api/moves は isAerial を返すが damage は
  //   返さない(internal/api/move/dto.go の MoveResponse 注記)ため、damage の判定だけは
  //   詳細取得が要る。前置きの所要時間を短くしておくほど、下の PROBE_HOLD_MS の
  //   重なり幅に余裕が出る。
  const moves = ((await res.json()).items as Move[])
    .filter((m) => m.category === "normal" && !m.isAerial)
    .sort((a, b) => a.id - b.id);
  for (const m of moves) {
    const d = await request.get(`/api/moves/${m.id}`);
    if (!d.ok()) continue;
    const detail = (await d.json()) as MoveDetail;
    if ((detail.damage ?? 0) <= 0 || detail.isAerial) continue;
    return detail.id;
  }
  throw new Error(`${PROBE_CHARACTER_CODE} に地上通常技の始動技が見つからない`);
}

/** createProbeCombo は probe の識別キーで本登録コンボを作る。VAL-C02 に当たれば ok() が false になる。 */
export async function createProbeCombo(
  request: Req,
  characterId: number,
  starterMoveId: number,
  memo: string,
): Promise<{ ok: boolean; status: number; body: string; id: number | null }> {
  const res = await request.post("/api/combos", {
    data: {
      characterId,
      isDraft: false,
      starterMoveId,
      // ★M27-02b(VAL-C15) / ★★M38-01 追補2: 本登録の probe が埋める欄。
      //   ★★400 になるのは damage / knockdownAdvantage を欠いたときだけである
      //     (`VAL-C15` の必須は同 2 欄だけになった)。⇒ 消費ゲージは余分だが、
      //   埋めておいても害は無い。★必須欄が欠けると 400 になり、本 probe が見たい
      //   「VAL-C02 に当たったか」と区別が付かなくなる。
      damage: 1000,
      knockdownAdvantage: 30,
      driveGaugeConsumed: 1,
      saGaugeConsumed: 0,
      memo,
      steps: [{ stepOrder: 1, moveId: starterMoveId }],
      ...PROBE_KEY,
    },
  });
  const body = await res.text();
  const id = res.ok() ? (JSON.parse(body).id as number) : null;
  return { ok: res.ok(), status: res.status(), body, id };
}

/**
 * countLiveProbeDuplicates は probe の識別キーに一致する「生きた本登録コンボ」の件数を返す。
 * ★アプリ自身が保存前重複ダイアログで使う経路(POST /api/combos/check-duplicate)を通す。
 *   DB を直接読んで数えない——それでは E2E の干渉を再現したことにならない(教訓 E-217 の型)。
 */
export async function countLiveProbeDuplicates(
  request: Req,
  characterId: number,
  starterMoveId: number,
): Promise<number> {
  const res = await request.post("/api/combos/check-duplicate", {
    data: {
      characterId,
      starterMoveId,
      steps: [{ stepOrder: 1, moveId: starterMoveId }],
      ...PROBE_KEY,
    },
  });
  expect(res.ok(), await res.text()).toBeTruthy();
  return ((await res.json()).duplicates as unknown[]).length;
}

/**
 * removeProbeCombo は作った行を完全削除する(ゴミ箱にも残さない)。
 *
 * ★論理削除の成否だけは検査する。後片付けが黙って失敗すると、次に走る片割れの作成が
 *   VAL-C02 で弾かれ、「干渉している」という誤ったメッセージで赤くなる。
 *   probe の目的は診断であり、後片付けの失敗と干渉は区別できなければならない。
 */
export async function removeProbeCombo(request: Req, id: number): Promise<void> {
  const del = await request.delete(`/api/combos/${id}`);
  expect(del.ok(), `probe の後片付け(論理削除)が失敗した id=${id}: ${await del.text()}`).toBeTruthy();
  await request.delete(`/api/combos/${id}/permanent`);
}

/**
 * runInterferenceProbe は probe 1 本分の本体である。
 *
 * ★★本体をここへ寄せてあるのは、2 本の probe が「同じことを主張する」必要があるためである
 *   (教訓 E-232 / M24-01 §7-6)。各 spec 側へ複製すると、片方だけ直されて静かにずれる
 *   ——本プロジェクトは同じ警告を internal/service/combo/service.go:1017 でも出している
 *   (「2 つの『同じ』が並ぶと、片方だけ直されて静かにずれる」)。
 *
 * @param label 報告用の識別子("A" / "B")。memo に載るだけで、判定には関与しない。
 *              ★ここに一意化を入れないこと。2 本が同じ識別キーを使うことが仕掛けの中心である。
 */
export async function runInterferenceProbe(request: Req, label: string): Promise<void> {
  const characterId = await probeCharacterId(request);
  const starterMoveId = await probeStarterMoveId(request, characterId);

  const created = await createProbeCombo(request, characterId, starterMoveId, `m24-09c-probe-${label}`);

  // 1) 作成が通ること。並列実行では相手が先に作っていると VAL-C02(ERROR)で弾かれる。
  expect(
    created.ok,
    `本登録の作成が失敗した。並列実行で片割れの probe と識別キーが衝突した可能性が高い: ${created.status} ${created.body}`,
  ).toBeTruthy();

  try {
    // 2) 保持している間に相手も作れてしまわないこと。
    //    ★VAL-C02 の判定と INSERT の間に隙があると、双方が作れてしまう。その形はここで捕まる
    //      (M24-09c で実測。完了報告 §9 の本番コードのバグ)。
    await new Promise((resolve) => setTimeout(resolve, PROBE_HOLD_MS));
    const live = await countLiveProbeDuplicates(request, characterId, starterMoveId);
    expect(
      live,
      "同じ識別キーの生きた本登録コンボが自分以外にも在る(=片割れの probe と干渉している)",
    ).toBe(1);
  } finally {
    if (created.id !== null) {
      await removeProbeCombo(request, created.id);
    }
  }
}
