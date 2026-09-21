package combo

import "encoding/json"

// Optional は PATCH /api/combos/:id の nullable メタデータが取る3状態
// (キー不在 / JSON null / 値あり)を表すジェネリック型。
//
// presence-detection トライステート(CHANGE-043 / DES-002 v1.23.0 §4.2):
//   - Present=false(zero value)        : キー不在 = 不変更(SET 句に含めない)
//   - Present=true,  Value==nil         : JSON null = NULL クリア
//   - Present=true,  Value!=nil         : 値あり = その値で更新
//
// DTO(UpdateMetadataRequest)と repository.UpdateMetadataInput で共有する。
// UnmarshalJSON を持つため Echo の c.Bind(json.Decoder)が「キーが来たか」を検出できる。
type Optional[T any] struct {
	Present bool // JSON にキーが存在した(UnmarshalJSON が呼ばれた)
	Value   *T   // nil ⇒ JSON null(NULL クリア)/ 非 nil ⇒ その値で更新
}

// UnmarshalJSON は JSON のキーが存在したときのみ呼ばれる。
// このため Present=true を立てることでキー不在(=メソッド未呼出)と区別できる。
func (o *Optional[T]) UnmarshalJSON(data []byte) error {
	o.Present = true
	if string(data) == "null" {
		o.Value = nil
		return nil
	}
	var v T
	if err := json.Unmarshal(data, &v); err != nil {
		return err
	}
	o.Value = &v
	return nil
}

// Arg は database/sql のバインド引数を返す。Value==nil のとき untyped nil(=SQL NULL)を返す。
// 型付き nil ポインタ(*T(nil))をそのまま渡すと NULL にならない typed-nil 罠があるため、
// SET 句への値はこのメソッドを経由すること。
func (o Optional[T]) Arg() any {
	if o.Value == nil {
		return nil
	}
	return *o.Value
}

// Some は「present + 値あり」(更新)の Optional を返す。主にテスト・変換の可読性向上用。
func Some[T any](v T) Optional[T] {
	return Optional[T]{Present: true, Value: &v}
}

// Null は「present + null」(NULL クリア)の Optional を返す。
func Null[T any]() Optional[T] {
	return Optional[T]{Present: true}
}
