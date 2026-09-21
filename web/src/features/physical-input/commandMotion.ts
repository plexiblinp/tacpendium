// コマンド技入力モードの解決（M21-06 §4.2）。**前方一致 ＋ 最長一致**。
//
// ★本ファイルは純関数だけを持つ。React にも navigator にも索引の取得元にも触らない。
//
// ★契約 F-3 と衝突しない（指示書 §4.3）。**波形・軌跡・タイミングを一切解釈しない**——
//   「押された方向の列」を、索引が持つコマンドの方向列と文字列として突き合わせるだけである。
//   段階 1・2 の決定論解決が「表記 → move_code」であるのに対し、本ファイルは
//   「利用者の実入力 → どの技を指したか」という別の問いを解く。出口が move_code であることは
//   共通で、それは破らない（§4.2-6）。
//
// ★解決規則は FE が持つ（§4.6-5）。バックエンドは表を返すだけである。

import type { NumpadDirection } from "@/features/combo/inputResolutionStage2";
import type { LogicalButton } from "@/features/gamepad/types";

/** 索引 1 行（`GET /api/characters/:id/motion-commands` の 1 要素）。 */
export interface MotionCommand {
  tokenKey: string;
  moveCode: string;
}

/**
 * 解決できなかった理由（★黙って捨てないための粒度＝§4.2-7）。
 *
 * ★`ambiguous` と `no_match` を分ける。前者は「入力は当たったが 1 つに定まらなかった」、
 *   後者は「そもそも当たらなかった」であり、利用者が次に取るべき行動が違う。
 */
export type MotionUnresolvedReason =
  /** 前方一致した候補が同じ長さで複数残った（§4.2-4）。 */
  | "ambiguous"
  /** 前方一致する候補が無い（先頭にゴミがある入力を含む＝§4.2-5）。 */
  | "no_match"
  /**
   * 確定の契機（攻撃ボタン）が無いまま列が破棄された——モードを抜けたときの残り。
   *
   * ★`no_match` と分ける。**解決を試みてすらいない**のであって「一致しなかった」のではない。
   *   混ぜると、読取表示が「一致するコマンドがありません」と嘘をつく。
   */
  | "abandoned"
  /**
   * 索引には載っているが、当該キャラの `moves` に該当 `move_code` が無かった。
   *
   * ★**これは利用者の入力ミスではなくデータの不整合である**（索引と技一覧が食い違っている）。
   *   `no_match` へ丸めると「入力が悪い」と読める文言が出るため分けてある
   *   （`DES-005` §6.4.3 が「理由を取り違えた表示にしない」と定めている流儀）。
   */
  | "move_not_found";

export type MotionResolution =
  | { status: "resolved"; moveCode: string; directions: string; tokenKey: string }
  | {
      status: "unresolved";
      reason: MotionUnresolvedReason;
      /** `ambiguous` のときに残った候補（利用者へ「なぜ定まらなかったか」を出すため）。 */
      candidates: MotionCommand[];
    };

// ---------------------------------------------------------------------------
// token_key の分解
// ---------------------------------------------------------------------------

/**
 * 攻撃ボタン → `token_key` のボタン表記。★索引側の表記に合わせる（`DES-004` §2.4.3）。
 */
const BUTTON_TOKEN: Partial<Record<LogicalButton, string>> = {
  light_punch: "LP",
  medium_punch: "MP",
  heavy_punch: "HP",
  light_kick: "LK",
  medium_kick: "MK",
  heavy_kick: "HK",
};

/** 強度を問わない表記（`236P` は任意のパンチで出る）。 */
const BUTTON_FAMILY: Partial<Record<LogicalButton, string>> = {
  light_punch: "P",
  medium_punch: "P",
  heavy_punch: "P",
  light_kick: "K",
  medium_kick: "K",
  heavy_kick: "K",
};

/**
 * `token_key` の先頭から方向部を切り出す。
 *
 * ★**溜め `[n]` は角括弧を外して方向 1 つとして扱う**（`[4]6HP` → 方向列 `46`）。
 *   **推測: 保持時間は一切見ない**——記法の字句写像にとどめており、契約 F-3 の
 *   「波形・軌跡・タイミングを解釈しない」は破らない。**外すと guile のような溜めキャラの
 *   必殺技がほぼ全滅する**ため、この形を採った（完了報告で当否を問う）。
 *
 * ★`360`（一回転）は方向列として再現できないため、意図的に**方向部として認めない**。
 *   結果として本関数は `null` を返し、当該行はモードの解決に参加しない。
 */
function splitTokenKey(
  tokenKey: string,
): { directions: string; button: string } | null {
  let i = 0;
  let directions = "";
  while (i < tokenKey.length) {
    const ch = tokenKey[i];
    if (ch >= "1" && ch <= "9") {
      // ★`360` は「3」「6」「0」ではなく一回転を表す 1 トークンである。方向列として扱わない。
      if (tokenKey.startsWith("360", i)) return null;
      directions += ch;
      i += 1;
      continue;
    }
    if (ch === "[") {
      const close = tokenKey.indexOf("]", i);
      if (close === -1) return null;
      const inner = tokenKey.slice(i + 1, close);
      if (!/^[1-9]$/.test(inner)) return null;
      directions += inner;
      i = close + 1;
      continue;
    }
    break;
  }
  return { directions, button: tokenKey.slice(i) };
}

/**
 * その `token_key` がモードの解決に参加できるか。
 *
 * ★**推測（§9.2 の範囲）: 次の 4 つは参加させない。** いずれも「押された方向の列 ＋ 攻撃ボタン
 *   1 つ」として再現できない形であり、解決対象に含めると当たらない候補が最長一致を汚す。
 *
 *   1. **方向部が空**（`LP` / `HP+HK` 等の立ち技・マクロ）。**★これが最も重要である**——
 *      長さ 0 は常に前方一致するため、参加させると**先頭にゴミがある入力が立ち技へ解決されて
 *      しまい §4.2-5 に反する**。
 *   2. **ボタン部が単一ボタンでない**（`P+P` / `LP+MP` / `HP+HK`）。確定の契機は攻撃ボタン
 *      1 つである（§4.1-5）。OD が物理から出ないという `DES-005` §6.4.3 の写像とも一致する。
 *   3. **語彙外の記号を含む**——`/`（or）／`|`（alt）／`>`（連鎖）／`(hold)`。
 *   4. **一回転 `360`**（{@link splitTokenKey} が弾く）。
 */
function participates(parsed: { directions: string; button: string }): boolean {
  if (parsed.directions.length === 0) return false;
  return /^(?:L|M|H)?(?:P|K)$/.test(parsed.button);
}

/** 入力ボタンがその `token_key` のボタン部に一致するか。 */
function buttonMatches(button: LogicalButton, tokenButton: string): boolean {
  return (
    tokenButton === BUTTON_TOKEN[button] || tokenButton === BUTTON_FAMILY[button]
  );
}

// ---------------------------------------------------------------------------
// 解決（★前方一致 ＋ 最長一致）
// ---------------------------------------------------------------------------

/**
 * 溜まった方向列 ＋ 攻撃ボタンを 1 技へ解決する（§4.2）。
 *
 * 規則は次の順で効く。
 *
 *  1. **前方一致** — コマンドの方向列が、溜まった方向列の**先頭**に一致すること（§4.2-1）。
 *     ★末尾の余りは無視する。`2 3 6 9 ＋ P` は波動拳として解決する（§4.2-2）。
 *  2. **最長一致** — 候補が複数なら方向列が最も長いものを採る（§4.2-3）。
 *     ★これが無いと `2 3 6 2 3 6 ＋ P` が波動拳になる——SA のコマンドは必殺技のコマンドを
 *       先頭に含むためである。
 *  2.5. **★ボタン具体度の同点判定**（**開発者判断で足した規則。指示書 §4.2 には無い**）。
 *     方向列が同じ長さなら、**押されたボタンに強度まで一致する候補を優先する**
 *     （`214LK` が `214K` に勝つ）。**無いと竜巻旋風脚などが入らない。** 詳細は実装のコメント。
 *  3. **同じ長さで複数残るなら解決しない**（§4.2-4）。`DES-004` §5 の逆引きと同じ流儀で、
 *     1 つに定まるときだけ確定する。★実データでは CA と SA3 が同一コマンドである組が
 *     13 キャラにあり、この分岐は実際に発火する。
 *  4. **先頭のゴミは解決しない**（§4.2-5）。`1 2 3 6 ＋ P` は波動拳にしない——1 で始まる
 *     コマンドが無ければ前方一致する候補が 1 つも残らないためで、補正は一切行わない。
 *
 * @param table 索引（キャラ選択時に 1 回取得したもの。順序に依存しない）
 * @param directions 溜まった方向列（押された順）
 * @param button 確定の契機になった攻撃ボタン
 */
export function resolveCommandMotion(
  table: readonly MotionCommand[],
  directions: readonly NumpadDirection[],
  button: LogicalButton,
): MotionResolution {
  const input = directions.join("");

  // 1. 前方一致 ＋ ボタン一致で候補を絞る。
  const matched: {
    command: MotionCommand;
    length: number;
    buttonToken: string;
  }[] = [];
  for (const command of table) {
    const parsed = splitTokenKey(command.tokenKey);
    if (parsed === null || !participates(parsed)) continue;
    if (!input.startsWith(parsed.directions)) continue;
    if (!buttonMatches(button, parsed.button)) continue;
    matched.push({
      command,
      length: parsed.directions.length,
      buttonToken: parsed.button,
    });
  }
  if (matched.length === 0) {
    return { status: "unresolved", reason: "no_match", candidates: [] };
  }

  // 2. 最長一致。
  let longest = 0;
  for (const m of matched) if (m.length > longest) longest = m.length;
  const longestMatches = matched.filter((m) => m.length === longest);

  // 2.5 ★ボタン具体度の同点判定（**開発者判断で足した規則。指示書 §4.2 には無い**・2026-08-14）。
  //
  // ★**方向列が同じ長さで残ったら、押されたボタンに強度まで一致する候補を優先する。**
  //   完全一致（`214LK`）があれば、強度を問わない候補（`214K`）は落とす。
  //   完全一致が 1 つも無ければ従来どおり全候補を残す（`236236P` のような強度不問だけの組）。
  //
  // ★**なぜ要るか**——索引には「強度を問わない token」と「強度指定 token」が**同じ方向列で
  //   共存する**組がある。実データの例（ryu）——
  //
  //       214K   aerial_tatsumaki_senpu_kyaku   （強度不問・空中版）
  //       214LK  tatsumaki_senpu_kyaku_light    （強度指定・地上版）
  //
  //   `214` ＋ 弱K は**どちらも方向列 3 文字で一致する**ため、本判定が無いと §4.2-4 が発火して
  //   **リュウ・ケンの竜巻旋風脚がモードから入らない**。同型が luke のフラッシュナックル ／
  //   juri の風波刃 ／ kimberly の 3 技 ／ rashid にもあり、**実測で 21 通りが入らなかった**。
  //
  // ★**曖昧一致・入力ミスの補正ではない**（指示書 §9.1-1 に触れない）。押された強度に一致する
  //   コマンドを優先するだけの**決定論的なタイブレーク**であり、設計卓が §4.2-3 の最長一致を
  //   加えたのと同じ性質である。**入力を「直して」いない。**
  //
  // ★**§4.2-4 は生きている。** 本判定で絞ったあとに複数残れば従来どおり解決しない——
  //   CA と SA3 が同一コマンドの組（13 キャラ）はどちらも強度不問であり、絞れないまま残る。
  const exactButton = longestMatches.filter(
    (m) => m.buttonToken === BUTTON_TOKEN[button],
  );
  const finalists = exactButton.length > 0 ? exactButton : longestMatches;

  // 3. 同じ長さで複数残るなら解決しない。
  //    ★同じ move_code が複数行に載ることは無い（PRIMARY KEY(move_id, token_key)）が、
  //      表記違いの同一技を将来入れたときに誤って「曖昧」と判定しないよう code で畳んでから数える。
  const codes = new Set(finalists.map((m) => m.command.moveCode));
  if (codes.size > 1) {
    return {
      status: "unresolved",
      reason: "ambiguous",
      candidates: finalists.map((m) => m.command),
    };
  }

  const winner = finalists[0].command;
  return {
    status: "resolved",
    moveCode: winner.moveCode,
    directions: input.slice(0, longest),
    tokenKey: winner.tokenKey,
  };
}
