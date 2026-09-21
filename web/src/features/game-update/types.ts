// ゲーム更新の告知の DTO(手書き。Go 側 internal/api/notice/game_update.go と目視で対応)。

/**
 * GET /api/notices/game-update の応答(FR702・M28-02c / CHANGE-162 §2)。
 *
 * ★★常に 200 で返る。204 ではない —— 返すのは「有無」ではなく件数と現在版であり、
 *   204 では表現できない。
 * ★★affectedCount は延期中でも返る。抑止するのはバナーだけであり、一覧のボタンは
 *   抑止しない(LAN で他の利用者が入口を失うため)。⇒ ここが分水嶺である。
 */
export interface GameUpdateNotice {
  /** 本アプリが現在前提としているゲームデータの版(`YYYY.MM.DD.NN`)。 */
  currentDataVersion: string;
  /** 影響可能性ありのコンボの総数(★全キャラ合計)。 */
  affectedCount: number;
  /**
   * 「この版のあいだはバナーを出さない」と記録された版。
   *
   * ★現在版と一致するときだけ載る。⇒ 版が上がれば消え、抑止が外れる。
   * ★undefined は「延期していない」。
   */
  postponedForVersion?: string;
}
