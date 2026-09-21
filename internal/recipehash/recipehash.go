// Package recipehash はレシピ(ステップ列)から recipe_hash を計算する唯一の実装を提供する。
//
// recipe_hash は保存列ではなく都度計算値であり、重複判定キーの一部として使われる
// (SUPP-001 §2.2 / DES-006 VAL-C02)。したがって「同じレシピからは必ず同じ値が出る」
// ことと「呼ぶ場所によって値が変わらない」ことが本パッケージの契約である。
//
// # 公開しているのは 2 つの入口だけである
//
// CalcCombo(combo_steps 列)と CalcSetup(setup_steps 列)以外は公開しない。
// ★計算の本体を公開すると、この 2 つを経由しない 3 つ目の呼び元が生えうる。
// それは M24-09b 以前の状態(呼ぶ場所ごとに独立実装)へ、別の形で戻ることである。
// 新しいステップ型が増えたときは、本パッケージへ入口を 1 つ足すこと。
//
// # なぜ独立したパッケージなのか
//
// 本計算はコンボ(combo_steps)とセットプレイ(setup_steps)の双方から呼ばれ、かつ
// サービス層とリポジトリ層の双方から呼ばれる。リポジトリ層はサービス層を import
// できない(依存の向きが逆転する)ため、両方より下に置ける場所が要る。
// model 配下ではなくここに置いたのは、ドメインモデルへ暗号ハッシュの都合を
// 持ち込まないためである(推測: internal/aliasnorm・internal/sanumber と同じ
// 「純粋ユーティリティは internal 直下」という既存の型に倣った)。
//
// 設計参照: SUPP-001 §2.1 / §2.2、DES-006 §2。
package recipehash

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"sort"
	"strconv"
	"strings"

	"github.com/plexiblinp/tacpendium/internal/model"
)

// emptyHash は空レシピのハッシュ。sha256("") の hex 表現である。
//
// パッケージ変数ではなく定数にしてある。値が正しいことは
// TestEmptyHash_EqualsSHA256OfEmptyString が計算値と突き合わせて固定する。
const emptyHash = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"

// step はハッシュ計算に使うステップの正規形。
//
// model.ComboStep / model.SetupStep のうち、ハッシュに寄与する 3 フィールドだけを持つ。
// ID・親 ID・JOIN で取得する表示用フィールドは寄与しない(DES-003 §3.4 の dup 非対象)。
type step struct {
	StepOrder int
	MoveID    *int64
	Modifiers *model.Modifiers
}

// CalcCombo は combo_steps 列を正規化して SHA-256 ハッシュの hex 文字列を返す。
func CalcCombo(steps []model.ComboStep) string {
	converted := make([]step, len(steps))
	for i, s := range steps {
		converted[i] = step{StepOrder: s.StepOrder, MoveID: s.MoveID, Modifiers: s.Modifiers}
	}
	return calc(converted)
}

// CalcSetup は setup_steps 列を正規化して SHA-256 ハッシュの hex 文字列を返す。
//
// CalcCombo と同じ計算であり、同じレシピからは同じ値が出る。
func CalcSetup(steps []model.SetupStep) string {
	converted := make([]step, len(steps))
	for i, s := range steps {
		converted[i] = step{StepOrder: s.StepOrder, MoveID: s.MoveID, Modifiers: s.Modifiers}
	}
	return calc(converted)
}

// calc はステップ列を正規化して SHA-256 ハッシュの hex 文字列を返す。
//
// アルゴリズム:
//  1. ステップを StepOrder 昇順にソート(防御的、入力が既ソートでも保証)
//  2. 各ステップで Modifiers.Flags を sort.Strings で正規化(順序非依存にするため)
//  3. 各ステップを `<move_id_or_null>:<json.Marshal(modifiers)>` の形式に文字列化
//  4. ステップ文字列を `\n` で連結
//  5. SHA-256 → hex 文字列
//
// Modifiers は型付き struct(SUPP-001 §3.3.0)のため json.Marshal が決定論的に動く。
// map[string]interface{} のキー順非保証問題は発生しない。
//
// 入力スライスは破壊しない。
func calc(steps []step) string {
	if len(steps) == 0 {
		return emptyHash
	}

	// 入力スライスを破壊しないようコピーしてからソート
	sorted := make([]step, len(steps))
	copy(sorted, steps)
	sort.SliceStable(sorted, func(i, j int) bool {
		return sorted[i].StepOrder < sorted[j].StepOrder
	})

	var sb strings.Builder
	for i, s := range sorted {
		if i > 0 {
			sb.WriteByte('\n')
		}
		// move_id or "null"
		if s.MoveID == nil {
			sb.WriteString("null")
		} else {
			sb.WriteString(strconv.FormatInt(*s.MoveID, 10))
		}
		sb.WriteByte(':')
		// modifiers の JSON
		sb.WriteString(canonicalModifiersJSON(s.Modifiers))
	}

	sum := sha256.Sum256([]byte(sb.String()))
	return hex.EncodeToString(sum[:])
}

// canonicalModifiersJSON は Modifiers を決定論的な JSON 文字列に変換する。
//
// nil の場合は "null" を返す。Flags はソートしてから marshal することで、
// 配列順序の違いがハッシュに影響しないようにする。入力は破壊しない。
func canonicalModifiersJSON(m *model.Modifiers) string {
	if m == nil {
		return "null"
	}

	// Flags を破壊しないようコピーしてソート
	normalized := *m
	if len(m.Flags) > 0 {
		flags := make([]string, len(m.Flags))
		copy(flags, m.Flags)
		sort.Strings(flags)
		normalized.Flags = flags
	}

	bytes, err := json.Marshal(normalized)
	if err != nil {
		// json.Marshal は struct で失敗しないが、防御的に
		return "{}"
	}
	return string(bytes)
}
