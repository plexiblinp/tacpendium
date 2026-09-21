import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";

import { describe, expect, it } from "vitest";

// ★★M24-07 レビュー(低-3)で足したガード。
//
// 本サブは開発者判断で語を 1 本に決めた(「インポート」→「取込」、画面名
// 「取込ヘルパー」→「引っ越し取込」)。⇒ 全数を grep で確認したが、**次の担当が
// 旧語を書いても何も赤くならない**状態だった。統一は「一度きれいにする」ことでは
// なく「戻らないようにする」ことなので、機械の網を残す。
//
// ★★★M38-02(2026-09-17・D-892)で、その「引っ越し取込」がさらに「他から引っ越し」へ
//   改称された。⇒ 同じ画面の 2 度目の改名である。連鎖するため、退けた語を足すときは
//   **既存エントリの useInstead が今も生きた語か**も確かめること(下の「取込ヘルパー」は
//   useInstead が 2 度書き換わっている)。
//
// ★★走査対象は locale だけでは足りない —— 取込まわりの画面(ComboImportPage /
//   IntakeHelperPage / Header)は全面直書きであり、画面名・ナビ名に対応するキーは
//   ja.json に 1 件も無い(DES-005 §5.19「i18n キーは追加しない」)。
//   辞書だけを見る forbidden-words.test.ts の型をそのまま流用すると、**この語について
//   は何も守らないテスト**になってしまう。⇒ web/src の実装ファイルも走査する。
//
// ★★走査根は web/src だけである。⇒ Go(internal/ cmd/)・web/e2e・docs/ は 1 バイトも
//   見ない。M24-07 の「取込ヘルパー」が Go 側 19 箇所 ＋ migrations 1 箇所に残ったまま
//   一度も赤くならず、M38-02 で初めて是正されたのはこのためである。
//   ★M38-02 のレビューは、その migrations の 1 件を製造の走査が取りこぼしたことを検出した
//   ——製造も射程を web/ internal/ cmd/ docs/usermanual/ の 4 箱に切っていた。
//   ⇒ 走査根を広げるかは設計卓の判断であり、設計伝達レポート §4 へ申し送ってある。
//
// ★★退けた語を足すときは「代わりに何を使うか」を必ず書くこと。理由の無い禁則は
//   次の担当に「なぜ駄目なのか」を伝えられず、迂回されて終わる。

// ★vitest の cwd は web/ である(vitest.config の root)。import.meta.url は変換後の
//   仮想パスになりうるため使わない。
const SRC_ROOT = join(process.cwd(), "src");

/** 走査対象: web/src 配下の .ts / .tsx / .json(テスト・本ファイル自身は除く)。 */
function collectSources(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) {
      collectSources(p, out);
    } else if (/\.(ts|tsx|json)$/.test(e.name) && !/\.test\.tsx?$/.test(e.name)) {
      out.push(p);
    }
  }
  return out;
}

/** 行コメント・ブロックコメントを落とす。★退けた経緯はコメントに残してよい。 */
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter((l) => !/^\s*(\/\/|\*)/.test(l))
    .map((l) => l.replace(/\s\/\/.*$/, ""))
    .join("\n");
}

interface RetiredWord {
  /** 退けた語(部分文字列として探す)。 */
  word: string;
  /** 代わりに使う語。 */
  useInstead: string;
  /** いつ・なぜ退けたか。 */
  reason: string;
}

const RETIRED: ReadonlyArray<RetiredWord> = [
  {
    word: "インポート",
    useInstead: "取込",
    reason:
      "M24-07(SM-110)・開発者判断 2026-08-30。同一画面で h1 だけ「インポート(CSV)」・本文とボタンは「取込／取り込む」と割れていた",
  },
  {
    word: "取込ヘルパー",
    // ★M38-02(2026-09-17)で「引っ越し取込」→「他から引っ越し」となったため、
    //   ここも書き換えた。旧値のままだと**それ自体が退けた語**を指してしまう。
    useInstead: "他から引っ越し",
    reason:
      "M24-07・開発者判断 2026-08-30。他のアプリ・メモ・表計算で管理していたコンボを本アプリへ移す支援機能であることが「ヘルパー」からは読めなかった",
  },
  {
    word: "引っ越し取込",
    useInstead: "他から引っ越し",
    reason:
      "M38-02・開発者裁定 2026-09-17(D-892)。M24-07 で「取込ヘルパー」から改めた名だが、撮影で一通り触った開発者が「他から引っ越し」を選んだ。⇒ 同じ画面の 2 度目の改名である",
  },
  // ★★M29-01(開発者裁定 2026-09-06・D-742)で退けた語。
  //   統一は「一度きれいにする」ことではなく「戻らないようにする」ことなので、
  //   選ばれなかった側をここへ登録する(M24-07 が作った型)。
  {
    word: "相手スタンス",
    useInstead: "相手の状態",
    reason:
      "M29-01・開発者裁定 4-A(2026-09-06)。同じ opponent_stance の欄が一覧フィルタ・詳細では「相手スタンス」、一覧列・CSV・エディタでは「相手の状態」と割れていた。DES-005 §5.7 と M27-03(CHANGE-155)の as-built が「相手の状態」である",
  },
  {
    word: "相手サイズ",
    useInstead: "相手の大きさ",
    reason:
      "M29-01・開発者裁定 4-A(2026-09-06)。同じ opponent_size の欄が「相手サイズ」「相手の体格」「相手の大きさ」の 3 通りに割れていた。DES-005 §5.7 と M27-01(CHANGE-151)の as-built が「相手の大きさ」である",
  },
  {
    word: "相手の体格",
    useInstead: "相手の大きさ",
    reason:
      "M29-01・開発者裁定 4-A(2026-09-06)。上記と同じ割れ。CSV の列ラベルだけが「体格」だった",
  },
  {
    word: "コピーして作成",
    useInstead: "コピー",
    reason:
      "M29-01・開発者裁定 2-A(2026-09-06)。「既存の 1 件を複製する」動作のラベルが 3 種あり、うち 2 種が既に「コピー」であった。M20-04 の既定名「〜 のコピー」も先行決定側である",
  },
  {
    word: "SA ゲージ",
    useInstead: "SAゲージ",
    reason:
      "M29-01・開発者が 4-A とあわせて選んだ(2026-09-06)。半角スペースの有無で表記が割れていた(詰め 8 か所 / 空き 3 か所)。多数派の詰め形へ寄せた。★本検査の走査対象は web/src だけである——Go 側(validation/combo.go・csvcore/combo.go)と migrations のコメントも詰めへ揃えたが、そちらは本検査の網の外にある",
  },
];

const sources = collectSources(SRC_ROOT).map((path) => ({
  path: relative(SRC_ROOT, path),
  body: stripComments(readFileSync(path, "utf-8")),
}));

describe("退けた語が戻っていない(M24-07 レビュー 低-3)", () => {
  it("★走査対象が空でない(陽性対照)", () => {
    // ★「0 件だった」は「無い」ではなく「走査が壊れている」かもしれない(E-84)。
    expect(sources.length).toBeGreaterThan(100);
  });

  it.each(RETIRED)("★★「$word」を使わない(代わりに「$useInstead」)", ({ word }) => {
    const hits = sources
      .filter((f) => f.body.includes(word))
      .map((f) => f.path);
    expect(hits).toEqual([]);
  });

  it("★すべての禁則語に代替語と理由が書かれている", () => {
    const incomplete = RETIRED.filter(
      (r) => r.useInstead.trim().length === 0 || r.reason.trim().length === 0,
    ).map((r) => r.word);
    expect(incomplete).toEqual([]);
  });

  it("★★走査そのものが働いている(陰性対照: 実在する語は必ず当たる)", () => {
    // ★「どの禁則語も 0 件」は「守れている」かもしれないし「走査が空回りして
    //   いる」かもしれない。⇒ 採った側の語で当たることを確かめる。
    expect(sources.filter((f) => f.body.includes("取込")).length).toBeGreaterThan(0);
    // ★M38-02: 採った側の語は「引っ越し取込」→「他から引っ越し」へ移った。
    //   ⇒ 陰性対照も一緒に移さないと、改名した瞬間にここが 0 件で落ちる。
    expect(
      sources.filter((f) => f.body.includes("他から引っ越し")).length,
    ).toBeGreaterThan(0);
    // ★M29-01 で採った側の語でも当たることを確かめる(禁則語が全部 0 件でも
    //   「守れている」のか「走査が空回りしている」のか区別できないため)。
    for (const adopted of ["相手の状態", "相手の大きさ", "SAゲージ"]) {
      expect(
        sources.filter((f) => f.body.includes(adopted)).length,
        `採った語「${adopted}」が 1 件も当たらない(走査が空回りしている)`,
      ).toBeGreaterThan(0);
    }
  });

  it("★コメントは走査対象から外れている(経緯は残せる)", () => {
    // ★「旧語はこうだった」という注記まで禁じると、改名の経緯が書けなくなる。
    expect(stripComments("// 旧名はインポートだった\nconst a = 1;")).not.toContain(
      "インポート",
    );
    expect(stripComments('const a = "インポート";')).toContain("インポート");
  });
});
