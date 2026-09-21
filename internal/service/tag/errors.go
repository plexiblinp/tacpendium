package tag

import "errors"

// ErrNotFound はタグが見つからない場合のセンチネル。
var ErrNotFound = errors.New("tag: not found")

// ErrTagNameDuplicate は同一ユーザー内でタグ名が重複する場合のセンチネル(VAL-T01)。
var ErrTagNameDuplicate = errors.New("tag: name duplicate")

// ErrTagNameEmpty はタグ名が空文字またはスペースのみの場合のセンチネル(VAL-T02)。
var ErrTagNameEmpty = errors.New("tag: name empty")

// ErrTagInUse はタグが combo_tags で使用中の場合のセンチネル(VAL-T03)。
// UsageCount フィールドで件数を確認できる。
var ErrTagInUse = errors.New("tag: in use")

// TagInUseError は ErrTagInUse の具体型。使用件数を保持する。
type TagInUseError struct {
	UsageCount int
}

func (e *TagInUseError) Error() string { return ErrTagInUse.Error() }
func (e *TagInUseError) Is(target error) bool {
	return target == ErrTagInUse
}
