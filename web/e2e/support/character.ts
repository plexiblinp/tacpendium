import { expect, type APIRequestContext, type Page } from "@playwright/test";

// M24-09c 追補 段 2: 画面が出す既定キャラを仮定せず、spec が自分で明示的に選ぶための共通ヘルパ。
//
// ★★なぜ要るのか————————————————————————————————————————————
// 新規登録・一覧の初期キャラは解決順で決まる(web/src/features/combo/defaultCharacter.ts):
//   段 1 URL(?character=) → 段 2 sessionStorage → 段 3b config の defaults.characterId → 段 4 定数
// E2E は test ごとに新規ブラウザコンテキストを使うため段 1・段 2 が空になり、
// **素の goto では段 3b(設定ファイル)が単独で既定キャラを決める**。
// ⇒ 「初期表示は ryu である」と仮定した spec は、設定を変えた環境でだけ落ちる。
//
// ★これは 2 度起きている:
//   - 2026-08-13 開発者機(character_id = 5)。m20-04-preset-management.spec.ts:52-66 が
//     再発防止のヘルパと注記を置いたが、その 1 ファイルに閉じたまま横へ広がらなかった。
//   - 2026-08-26 開発者機(既定キャラ juri)。53 spec 中 15 本・180 テスト中 35 件が落ちた。
//
// ★M24-09c 追補 段 1 で E2E は専用 config を読むようになり、段 3b は空になった。
//   本ヘルパはそのうえで「暗黙の既定に依存しない」ことを構造で担保する(段 2)。
//   ⇒ 段 1 だけだと、専用 config に誰かが [defaults] を書いた瞬間に脆さが戻る。
//
// ★本ファイルは spec ではない(playwright の既定 testMatch は *.spec.ts / *.test.ts のみ)。

interface Character {
  id: number;
  code: string;
  nameJa: string;
}

/** characterOf は seed のキャラクター code から行を引く。★id を直書きしないこと。 */
export async function characterOf(request: APIRequestContext, code: string): Promise<Character> {
  const res = await request.get("/api/games/1/characters");
  expect(res.ok(), await res.text()).toBeTruthy();
  const chars = (await res.json()).items as Character[];
  const c = chars.find((x) => x.code === code);
  expect(c, `character ${code} not seeded`).toBeTruthy();
  return c!;
}

/** characterIdOf は code から id だけを引く。 */
export async function characterIdOf(request: APIRequestContext, code: string): Promise<number> {
  return (await characterOf(request, code)).id;
}

/**
 * gotoNewComboFor は「このキャラで新規登録画面を開く」。
 *
 * ★解決順の段 1(URL)を使うので、設定ファイルの既定キャラに依らない。
 * ★★画面が出来たことの待ちは従来どおり「キャラ名が見えること」で取る。ただし待つ相手は
 *   ハードコードの "リュウ" ではなく、いま要求したキャラの名前である。
 *   ⇒ 待ちの意味は変えずに、既定キャラへの依存だけを外す。
 */
export async function gotoNewComboFor(page: Page, code: string): Promise<number> {
  const c = await characterOf(page.request, code);
  await page.goto(`/combos/new?character=${c.id}`);
  await expect(page.getByText(c.nameJa).first()).toBeVisible();
  return c.id;
}

/**
 * gotoComboListFor は「このキャラの一覧を開く」。
 * ★一覧も既定キャラで絞られるため、作ったデータを掴む spec は同じ id で開く必要がある。
 */
export async function gotoComboListFor(page: Page, code: string): Promise<number> {
  const id = await characterIdOf(page.request, code);
  await page.goto(`/combos?character_id=${id}`);
  return id;
}
