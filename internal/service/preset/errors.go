package preset

import (
	"errors"
	"fmt"
)

// M20-04: プリセットのビジネスエラー。DES-006 §5 の VAL-P01〜P07 に対応する。
//
// ★保護(ErrBuiltinProtected / ErrForbidden)は「UI で出さない」ではなくここで拒否する。
// API を直接叩かれても組み込みプリセットが壊れないようにするための多層防御である
// (SUPP-001 §7.3 / 指示書 M20-04 §4.4-4)。

var (
	// ErrNotFound はプリセットが見つからない場合のセンチネル。
	ErrNotFound = errors.New("preset: not found")

	// ErrBuiltinProtected は組み込みプリセット(is_builtin = true)への
	// 編集・削除試行のセンチネル(VAL-P01。ハンドラで 403 に写像する)。
	//
	// ★組み込みは削除だけでなくエイリアス編集も不可である(ボード D-290)。
	// 旧記載「編集は可能」は誤りだった。理由は構造にある——moves に技の表示名
	// カラムは無く、表示名は preset_aliases がプリセット別に保持する。
	// official_ja_move を編集可にすると、技名そのものが利用者ごとに変わる。
	ErrBuiltinProtected = errors.New("preset: builtin preset is protected")

	// ErrForbidden は他ユーザーが作成したカスタムプリセットへの
	// 更新・削除試行のセンチネル(VAL-P07)。
	ErrForbidden = errors.New("preset: not owned by the operating user")

	// ErrNameEmpty はプリセット名が空文字または空白のみの場合のセンチネル。
	ErrNameEmpty = errors.New("preset: name empty")

	// ErrNameDuplicate は同一ユーザー内でプリセット名が重複する場合のセンチネル(VAL-P03)。
	ErrNameDuplicate = errors.New("preset: name duplicate")

	// ErrBaseNotFound はコピー元に指定された base_preset_code が
	// 実在しないか組み込みでない場合のセンチネル(VAL-P04)。
	//
	// ★組み込みに限るのは DES-004 §6.1 の「組み込みプリセットをベースに
	// コピーする」に従うためである。カスタムからのコピーは設計されていない。
	ErrBaseNotFound = errors.New("preset: base preset not found")

	// ErrLimitExceeded は全体プリセット数が上限に達している場合のセンチネル
	// (VAL-P05。組み込み 3 + カスタム 5 = 8 件。★1 ユーザーあたりの上限は設けない)。
	ErrLimitExceeded = errors.New("preset: total limit exceeded")

	// ErrAliasTextEmpty はエイリアス表記が空文字または空白のみの場合の
	// センチネル(VAL-P02)。
	ErrAliasTextEmpty = errors.New("preset: alias text empty")

	// ErrAliasMoveNotFound は指定 move のエイリアス行が当該プリセットに
	// 存在しない場合のセンチネル。
	//
	// ★技の追加・削除はカスタムプリセット側では行わない(DES-004 §6.2)。
	// 未知の move が来たら黙って INSERT せず、エラーで返す。
	ErrAliasMoveNotFound = errors.New("preset: alias row not found for the move")

	// ErrAliasConflict は同一プリセット・同一キャラで 2 つの異なる技が
	// 同じ表記になる編集のセンチネル(DES-003 §3.9 の UNIQUE 制約 2)。
	//
	// ★これは利用者の入力誤りである。500 で返してはならない——監視から見ると
	// 偽の障害として上がる(ボード D-275 と同型)。具体型 AliasConflictError が
	// 衝突した表記を保持しており、どの表記が衝突したかを利用者へ伝えられる。
	ErrAliasConflict = errors.New("preset: alias text conflicts within the same character")

	// ErrInUseByConfig は削除対象が config の [defaults] preset_id から
	// 参照されている場合のセンチネル(ボード D-313)。
	//
	// ★参照されたまま消すと、起動時に実在しない preset を引く。config は
	// TOML ファイル側の状態であり DB の削除に追従しないため、サービス層で止める。
	ErrInUseByConfig = errors.New("preset: referenced by config [defaults] preset_id")
)

// AliasConflictError は ErrAliasConflict の具体型。衝突した表記を保持する。
type AliasConflictError struct {
	AliasText string
}

func (e *AliasConflictError) Error() string {
	return fmt.Sprintf("%s: %q", ErrAliasConflict.Error(), e.AliasText)
}

func (e *AliasConflictError) Is(target error) bool { return target == ErrAliasConflict }
