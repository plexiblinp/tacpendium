import { expect, type APIRequestContext } from "@playwright/test";

// M28-02c: FR702(ゲーム更新への追従)の状態を E2E から作るためのヘルパ。
//
// ★★なぜ要るか ————————————————————————————————————————————————
// 判定は moves.last_changed_game_version が非 NULL であることを要求するが、
// マーカーを立てる経路は本番では DML マイグレしか無い(cmd/seedgen -mode game-version)。
// ⇒ HTTP からは立てられず、素の E2E では「影響コンボが 1 件以上ある状態」を作れない。
//
// ★★しかも初回は必ず 0 件である(D-725 により既存コンボの基準は最新)。
//   「画面を開いても何も出ない」ので、動かして確認したことが証拠にならない。
//   ⇒ 人工的に古い基準を作ってから確かめる必要がある。
//
// ★本ヘルパが叩くのは debug ビルドにしか存在しない経路である
//   (internal/api/debug/game_version.go。本番バイナリには 1 バイトも出ない)。
//   E2E バックエンドは playwright.config.ts が go run -tags=debug で起動する。
//
// ★本ファイルは spec ではない(playwright の既定 testMatch は *.spec.ts / *.test.ts のみ)。

/** 技にマーカーを立てる(配信者の DML マイグレを模す)。version が null なら NULL へ戻す。 */
export async function setMoveGameVersion(
  request: APIRequestContext,
  moveId: number,
  version: string | null,
): Promise<void> {
  const res = await request.post(`/api/debug/moves/${moveId}/game-version`, {
    data: { lastChangedGameVersion: version ?? "" },
  });
  expect(
    res.ok(),
    `マーカーの設定に失敗: ${res.status()} ${await res.text()}` +
      "(★E2E バックエンドが -tags=debug で起動しているか確かめること)",
  ).toBeTruthy();
}

/**
 * コンボの基準を直接書き換える(登録時期の違いを模す)。
 *
 * ★★マーカーは技に立つので、同じ技を使う全コンボへ及ぶ。⇒ 「1 件だけ影響ありにする」
 *   には基準の側を下げる。判定は「基準 < マーカー」であり対称である。
 */
export async function setComboBaselineVersion(
  request: APIRequestContext,
  comboId: number,
  version: string | null,
): Promise<void> {
  const res = await request.post(
    `/api/debug/combos/${comboId}/baseline-version`,
    { data: { baselineVersion: version ?? "" } },
  );
  expect(
    res.ok(),
    `基準の設定に失敗: ${res.status()} ${await res.text()}`,
  ).toBeTruthy();
}

/** games.current_data_version を読む。 */
export async function currentDataVersion(
  request: APIRequestContext,
): Promise<string> {
  const res = await request.get("/api/debug/game-version");
  expect(res.ok(), `現在版の取得に失敗: ${res.status()}`).toBeTruthy();
  return ((await res.json()) as { currentDataVersion: string }).currentDataVersion;
}

/** ゲーム更新の告知(件数・現在版・延期の状態)を読む。 */
export async function gameUpdateNotice(request: APIRequestContext): Promise<{
  currentDataVersion: string;
  affectedCount: number;
  postponedForVersion?: string;
}> {
  const res = await request.get("/api/notices/game-update");
  // ★★常に 200 である(204 ではない)。
  expect(res.status(), "告知は常に 200 で返る").toBe(200);
  return await res.json();
}

/**
 * 延期の記録(`.game-update-notice.json`)を消す。
 *
 * ★★共有状態を元へ戻すために要る(D-399 (1))。★本番に「延期の解除」という操作は
 *   無い(版が上がれば自然に外れる)ため、これも debug ビルドだけの口である。
 * ★`rm -rf web/e2e/.tmp` が run ごとに救ってはいるが、それに頼ると告知を見る spec が
 *   後から増えたときに実行順で黙って落ちる。
 */
export async function clearGameUpdatePostpone(
  request: APIRequestContext,
): Promise<void> {
  const res = await request.delete("/api/debug/notices/game-update");
  expect(
    res.ok(),
    `延期の記録の削除に失敗: ${res.status()} ${await res.text()}`,
  ).toBeTruthy();
}
