// API エラーコードの定数(M22-04)。
//
// バックエンド internal/model/api_error.go の ErrorCodeVersionConflict と同期する
// (CLAUDE.md §4 の列挙同期)。not_found / duplicate_setup はハンドラ側で生リテラル
// のままだが、画面が判定に使う以上フロント側は定数化する(散在させない)。
//
// ★409 は 2 種類ある。ステータスで分岐してはならない(DES-006 §11.2 / CHANGE-115 §2-c)。
//   - 版不一致           = version_conflict     … ほかの人が変更した(M22-04 の対象)
//   - 一意制約違反       = alias_conflict / preset_name_duplicate / tag_name_duplicate /
//                          user_name_duplicate / duplicate_setup … 別物
//   ⇒ ステータスだけで判定すると、プリセット別名の重複が
//     「ほかの人が変更しました」と表示される。

/** 楽観排他の版不一致(HTTP 409)。internal/model.ErrorCodeVersionConflict と同値。 */
export const API_ERROR_CODE_VERSION_CONFLICT = "version_conflict";

/** 対象の行が無い(HTTP 404)。★キー変更編集(PUT)に負けた側もこれを受け取る。 */
export const API_ERROR_CODE_NOT_FOUND = "not_found";

/** 同一レシピのセットプレイが既に紐付いている(HTTP 409)。★版不一致とは別物。 */
export const API_ERROR_CODE_DUPLICATE_SETUP = "duplicate_setup";

/**
 * ゴミ箱に無いセットプレイへ完全削除を要求した(HTTP 409)。
 * internal/model.ErrorCodeSetupNotInTrash と同値(M23-02)。
 */
export const API_ERROR_CODE_SETUP_NOT_IN_TRASH = "setup_not_in_trash";

/**
 * 生きたコンボから参照されているセットプレイの完全削除を拒否した(HTTP 409)。
 * internal/model.ErrorCodeSetupInUse と同値(M23-02・D-484)。
 *
 * ★版不一致とは別物である。ステータスで分岐しないこと。
 *
 * ★★応答の details.combos({id, memo})を画面が列挙する(M23-07 §4.3-1)。
 *   D-485(M23-02)は「拒否されたことが伝われば足りる」として列挙しない形を採ったが、
 *   M23-07 がその判断を上書きした——★拒否されたあとに紐付けを解除する導線が
 *   画面に無く、拒否された利用者が詰むためである。
 *   ⇒ どのコンボが参照しているかを見せ、そこから紐付けを解除できるようにする。
 *   ★新しくデータを取りに行かない。材料は拒否応答の details.combos に既に在る。
 */
export const API_ERROR_CODE_SETUP_IN_USE = "setup_in_use";

/**
 * 書き込みが混み合っていて処理できなかった(HTTP 503)。
 * internal/model.ErrorCodeDatabaseBusy と同値(M24-11 / CHANGE-136)。
 *
 * ★★重複エラー(400 validation_failed)とも版不一致(409)とも別の、第 3 の区別である。
 *   - 400 validation_failed  入力が悪い(VAL-C02 の重複を含む)
 *   - 409 version_conflict   ほかの人が先に更新した
 *   - 503 database_busy      入力も版も正しいが、今は書けなかった
 *
 * ★利用者にできるのは「少し待って再試行」だけで、入力の修正ではない。
 *   ⇒ 専用の画面は作らない。汎用のエラー表示に載るところまでである
 *   (1 人利用では busy_timeout(5 秒)を使い切ることは実質起きない)。
 */
export const API_ERROR_CODE_DATABASE_BUSY = "database_busy";
