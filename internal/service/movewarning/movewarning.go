// Package movewarning は保存済み moves から「要確認」(WarningCode)を再導出する中立ロジックを提供する。
//
// 元は取込パッケージ movesimport が WarningCode 型・StoredMove・DeriveStoredWarnings を保持し、
// 技編集(api/move)がそれを逆参照していた(M14-RESEARCH-01-report §B)。M14-02 の取込パイプライン
// 段階削除で逆依存を断つため、技編集が必要とする最小シンボルを本中立パッケージへ移設した。
// 依存方向は技編集 → movewarning の一方向で、取込パッケージへの参照を持たない。
//
// 移設対象は保存済み列値から再導出できる total_null / extra_throw のみ。recovery_word は取込
// プレビュー(CSV 生値)解析でしか判定できず moves に永続化されないため、movesimport と共に消滅した。
package movewarning

import "github.com/plexiblinp/tacpendium/internal/model"

// WarningCode は保存済み move から再導出する要確認理由。行は利用可能だが利用者確認を促す。
type WarningCode string

const (
	// WarnTotalNull は total を算出できなかった(FR703 で手動補正)。
	WarnTotalNull WarningCode = "total_null"
	// WarnExtraThrow は通常投げの 3 件目以降(並び/命名は FR703 で補正)。
	WarnExtraThrow WarningCode = "extra_throw"
)

// StoredMove は保存済み move から要確認(WarningCode)を再導出するための最小入力(M9-04、§4.1)。
//
// commit 済みの正規化済み列値を受け取る。recovery 原文は moves に永続化されないため recovery_word は
// 再導出できず total_null に吸収される(Plan Mode 確定)。M14-01 で properties / combo_scaling 列を
// 削除したため、unknown_properties / unknown_combo_scaling_key の再導出に用いていた両フィールドは持たない。
//
// CharacterID は extra_throw(通常投げ 3 件目以降)をキャラ単位で採番するために用いる。
type StoredMove struct {
	CharacterID int64
	Total       *int
	Category    string
}

// DeriveStoredWarnings は保存済み moves から行ごとの WarningCode を再導出する(M9-04、§4.1)。
// total_null / extra_throw のみを再導出する(M14-01 で unknown_* を撤去済み)。
//
// extra_throw はキャラ内の通常投げ序数(category=throw の 3 件目以降)を要する。CharacterID を
// キーにキャラ単位でカウントするため、複数キャラが混在した入力でもキャラごとに独立採番される。
// キャラ内の採番順は渡されたスライス順(呼出元 List は ID 昇順=取込順を保証)に従う。
// 返り値は moves と同順・同要素数で、各行は空配列(nil ではなく len 0)になり得る。
func DeriveStoredWarnings(moves []StoredMove) [][]WarningCode {
	out := make([][]WarningCode, len(moves))
	throwCount := map[int64]int{}
	for i, m := range moves {
		w := make([]WarningCode, 0)
		if m.Total == nil {
			w = append(w, WarnTotalNull)
		}
		if m.Category == model.MoveCategoryThrow {
			throwCount[m.CharacterID]++
			if throwCount[m.CharacterID] >= 3 {
				w = append(w, WarnExtraThrow)
			}
		}
		out[i] = w
	}
	return out
}
