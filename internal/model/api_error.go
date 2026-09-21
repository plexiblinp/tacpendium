package model

// ErrorCodeVersionConflict は楽観排他の版不一致を表す API エラーコード。
// combos / setups のどちらでも同じ値を返す(M22-03 で統一)。
//
// ★総称の "conflict" を使わない理由: 409 は一意制約違反でも返る
// (プリセットの表記衝突 alias_conflict 等)。総称では、どの衝突かを
// 呼び出し側が読み分けられない。
const ErrorCodeVersionConflict = "version_conflict"

// ErrorCodeSetupNotInTrash はゴミ箱に無いセットプレイへ完全削除が要求されたことを
// 表す API エラーコード(M23-02)。コンボ側の combo_not_in_trash と同型。
const ErrorCodeSetupNotInTrash = "setup_not_in_trash"

// ErrorCodeSetupInUse は、生きたコンボから参照されているセットプレイの完全削除を
// 拒否したことを表す API エラーコード(M23-02・D-484)。
//
// ★details.combos に参照元コンボ([]ComboRef)が入る。★画面はこれを列挙し、
// そこから紐付けを解除できる(M23-07 §4.3。TrashSetupListRow)。
// ⇒ D-485(M23-02＝列挙しない)は M23-07 が上書きした。理由——拒否されたあとに
// 紐付けを解除する導線が画面に無く、拒否された利用者が詰んでいたためである。
// ★画面はこの応答の値だけを使う。解除のために追加の取得を行わない。
const ErrorCodeSetupInUse = "setup_in_use"

// ErrorCodeDatabaseBusy は「今は書き込みが混んでいて処理できなかった」ことを表す
// API エラーコード(M24-11 / CHANGE-136)。HTTP は 503 を返す。
//
// ★★重複エラーとも版不一致とも別の、第 3 の区別である———————————————
//   - 400 validation_failed  入力が悪い(VAL-C02 の重複を含む。DES-006 §11.2 が
//     「重複は 409 ではない」と明記している)
//   - 409 version_conflict   他の人が先に更新した(手元の版が古い)
//   - 503 database_busy      入力も版も正しいが、今は書けなかった
//
// ★409 に寄せなかった理由: DES-006 §11.2 が「409 は 2 種類あり、見分けは
// エラーコードで行う」と定めている。そこへ 3 種目を積むと、ステータスで分岐している
// 読み手をさらに誤らせる。性質としても、これは衝突ではなく一時的な混雑である。
//
// ★利用者にできることは「少し待って再試行」だけであり、入力の修正ではない。
// ⇒ 画面は作り込まない(1 人利用では busy_timeout を使い切ることは実質起きない)。
const ErrorCodeDatabaseBusy = "database_busy"

// ErrorCodeValidationFailed は入力検証で ERROR が出たことを表す API エラーコード。
// 主たる形は 400 である(DES-006 §11.2。★重複 VAL-C02 も 409 ではなく本コードである)。
//
// ★★本コードを返す形は 3 系統ある。「400 ＋ details.validations」だけだと思わないこと。
//
//	(1) 400 ＋ details.validations  … NewValidationFailedError(下記)。combo / setup の 6 経路
//	                                   ★★M31-01 で 5 → 6 になった(materialize が VAL-C15 を
//	                                     通るようになったため。internal/api/combo/materialize_handler.go)。
//	                                     実測は `grep -rn NewValidationFailedError internal/api/`。
//	(2) 422 ＋ 英語文言             … PUT /api/config(internal/api/config/handler.go)
//	                                   issues[] は []map[string]string の手組みで、
//	                                   code / severity を持たない
//	(3) 400 ＋ details.field        … PATCH /api/moves/:id(internal/api/move/handler.go)
//	                                   message は ve.Message で個別に決まる
//
// ★(2)(3) は「統一漏れ」ではなく別系統である。⇒ 揃えに行かないこと。
//
// ★兄弟の ErrorCode* が定数化されているのに本コードだけが 7 か所へリテラル直書き
// されていた(M27-02a の全数調査)。⇒ 定数へ揃えた(値は 1 バイトも変えていない)。
const ErrorCodeValidationFailed = "validation_failed"

// MessageValidationFailed は (1) の形の validation_failed 応答の既定文言。
//
// ★呼び出し側で個別に書かないこと(CLAUDE.md §4 マジックストリングの定数化)。
// ★(2)(3) は本定数を使わない(上記のとおり別系統である)。
const MessageValidationFailed = "バリデーションエラーがあります"

// NewValidationFailedError は検証エラー応答(400 validation_failed)を構築する。
//
// ★★本関数が「400 ＋ details.validations」形の message の唯一の組み立て先である
// (M27-02a §2.1.3-2)。★上記 (2)(3) の 2 系統は本関数を通らない。
// 各ハンドラが model.APIError{...} を直書きしていたため、Message: の行を
// 書き忘れた 2 か所(PUT / PATCH /api/combos/:id)だけが空文字を返していた。
// ★APIError.Message に omitempty は無い。⇒ 書き忘れはキーの消失ではなく
// "message":"" として応答に出る。⇒ 書き忘れようの無い形へ寄せた。
//
// ★validations を any で受けるのは import 循環を避けるためである——
// 実際に渡るのは *validation.ValidationResult だが、internal/service/validation は
// internal/model を import しているため、こちらから型で受けると循環する。
func NewValidationFailedError(validations any) APIErrorResponse {
	return NewAPIErrorWithDetails(
		ErrorCodeValidationFailed,
		MessageValidationFailed,
		map[string]any{"validations": validations},
	)
}

// APIError は API エラーレスポンスのエラー詳細部分の共通型。
// DES-002 §4.3 の JSON フォーマット例の "error" フィールドに対応する。
type APIError struct {
	Code    string         `json:"code"`
	Message string         `json:"message"`
	Details map[string]any `json:"details,omitempty"`
}

// APIErrorResponse は APIError をラップした共通レスポンス型。
// DES-002 §4.3 の JSON フォーマット例のトップレベルに対応する。
type APIErrorResponse struct {
	Error APIError `json:"error"`
}

// NewAPIError は code / message から APIErrorResponse を構築する共通コンストラクタ。
// 各ハンドラパッケージが個別に定義していたエラーヘルパ(comboErrResp / charErrResp /
// errResp 等)の不統一(持ち越し課題 L-03)を解消するため、唯一の正準ビルダとして集約する。
func NewAPIError(code, message string) APIErrorResponse {
	return APIErrorResponse{Error: APIError{Code: code, Message: message}}
}

// NewAPIErrorWithDetails は details(任意の付加情報)付きの APIErrorResponse を構築する。
func NewAPIErrorWithDetails(code, message string, details map[string]any) APIErrorResponse {
	return APIErrorResponse{Error: APIError{Code: code, Message: message, Details: details}}
}
