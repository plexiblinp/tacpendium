package model

import (
	"encoding/json"
	"strconv"
)

// ExtractDefaultRecipe は combos.recipe_cache / setups.recipe_cache(JSON)から、
// 指定されたプリセットのレシピ表示文字列を取り出す。
//
// recipe_cache は {presetId: displayString} の JSON であり、一覧表示には既定プリセットの
// キーの値を使う。★どのプリセットを既定とするかは呼出側が注入する(M20-05・D-360)。
// 本関数は既定値を自分では持たない——持つと config の [defaults] preset_id と独立した
// 固定値になり、設定を変えても表示が追随しない(D-313)。
//
// cache が nil / 空文字 / JSON として壊れている場合、および当該キーが存在しない場合は
// 空文字を返す(表示側で「レシピ行を出さない」判断ができるようにするため。エラーには
// しない＝表示用キャッシュであり欠損は致命ではない)。
//
// ★キー不在が空文字になるため、実在しないプリセット ID を渡すとレシピ行が黙って消える。
// 呼出側は既定プリセットが実在することを保証すること(M20-05 §4.2 の注記・§4.3 の実在検査)。
func ExtractDefaultRecipe(cache *string, presetID int64) string {
	if cache == nil || *cache == "" {
		return ""
	}
	var m map[string]string
	if err := json.Unmarshal([]byte(*cache), &m); err != nil {
		return ""
	}
	return m[strconv.FormatInt(presetID, 10)]
}
