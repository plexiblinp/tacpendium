// Package aliasindex は他から引っ越しの逆引き(表記 → 内部表現)の索引を構築する(M20-07)。
//
// # なぜ索引を Go 側に持つのか
//
// 逆引きは M17-04 以来 SQL の完全一致(`WHERE pa.alias_text = ?`)で引いていたが、SQLite は
// NFKC を持たないため、辞書側へ正規化を掛けられない。正規化を入力側だけに掛けると
// 「掛けた側だけが揃って一致しなくなる」(指示書 M20-07 §4.1-2)。⇒ 照合を Go 側へ移し、
// 投入時と照会時の両方で internal/aliasnorm を通す。
//
// この形は internal/moveindex がトークン軸で既に採っているものと同じである(同パッケージは
// Add と Lookup の両方で normalizeCommand を通す)。エンジンを二度作らないため索引の作り方を
// 揃えてあるが、moveindex 自体は契約 F-3 で凍結されているため別パッケージにしてある。
//
// # 決定論
//
// 索引は「正規化キー → move.code の集合」である。★キーが複数の move へ当たることは
// 起こりうる——逆引きは全プリセット横断で引くため、プリセットを跨いだ 1:N は
// M20-03 の一意制約(preset_id, character_id, alias_text)の対象外であり成立する
// (DES-003 §3.9)。「一意制約があるから 1 件になる」は誤りである。
//
// 決定論を支えているのは制約ではなく「返り値が 1 件のときだけ確定する」という規則
// そのものであり、その規則は呼び出し側(internal/service/intake)が持つ。本パッケージは
// 当たった move.code をすべて返すだけで、タイブレークも曖昧一致もしない。
package aliasindex

import (
	"sort"

	"github.com/plexiblinp/tacpendium/internal/aliasnorm"
	"github.com/plexiblinp/tacpendium/internal/model"
	"github.com/plexiblinp/tacpendium/internal/sanumber"
)

// Index は 1 キャラ分の逆引き索引。ゼロ値は使わず Build で構築する。
type Index struct {
	// strict は第 1 段(aliasnorm.Normalize)のキー → move.code 集合。
	strict map[string]map[string]struct{}
	// relaxed は第 2 段(aliasnorm.NormalizeRelaxed)のキー → move.code 集合。
	relaxed map[string]map[string]struct{}
	// saNumber は第 3 段(move_code から導いた SA / CA 番号)のキー → move.code 集合(M22-07b)。
	//
	// ★本段だけ「辞書の行」を源にしていない。move_code そのものが答えを持っているため、
	// preset_aliases へ 1 行も足さずに引ける(案 E)。⇒ 新キャラ波で再投入するものが無い。
	saNumber map[string]map[string]struct{}
	// scanned は索引へ投入した「表記」の総数(行数ではない。1 行が日本語と英語の
	// 2 表記を持てば 2 と数える)。★「0 件」が「対象が無い」と「見ていない」の
	// どちらなのかを区別できるようにするため公開する(E-84)。
	scanned int
}

// Collision は同一の正規化キーへ 2 つ以上の異なる move が落ちた組。
type Collision struct {
	// Key は衝突した正規化キー。
	Key string
	// MoveCodes は当該キーへ落ちた move.code(昇順)。
	MoveCodes []string
}

// Build はエントリ列から索引を構築する。
//
// ★AliasTextEn が nil / 空の行は英語キーを持たないだけであり、フォールバックの引き金には
// しない(DES-003 §3.9・指示書 §4.2-2)。日本語キーは通常どおり投入される。
func Build(entries []model.AliasEntry) *Index {
	ix := &Index{
		strict:   make(map[string]map[string]struct{}),
		relaxed:  make(map[string]map[string]struct{}),
		saNumber: make(map[string]map[string]struct{}),
	}
	for _, e := range entries {
		ix.add(e.AliasText, e.MoveCode)
		if e.AliasTextEn != nil {
			ix.add(*e.AliasTextEn, e.MoveCode)
		}
		ix.addSANumber(e.MoveCode)
	}
	return ix
}

// add は 1 表記を両段の索引へ投入する。空表記は投入しない
// (空文字で引ける索引になると、表記の無い行が全件当たってしまう)。
func (ix *Index) add(aliasText, moveCode string) {
	strictKey := aliasnorm.Normalize(aliasText)
	if strictKey == "" || moveCode == "" {
		return
	}
	ix.scanned++
	insert(ix.strict, strictKey, moveCode)

	// ★第 2 段のキーが空になる行は投入しない。注記だけで構成された表記
	// (`(SA1)` 等)があると空キーが生まれ、空入力が全件に当たる索引になる。
	if relaxedKey := aliasnorm.NormalizeRelaxed(aliasText); relaxedKey != "" {
		insert(ix.relaxed, relaxedKey, moveCode)
	}
}

// addSANumber は move_code から導いた SA / CA 番号を第 3 段の索引へ投入する(M22-07b)。
//
// ★辞書の行(alias_text)は一切見ない。源は move_code だけである(DES-004 / D-5)。
// ⇒ 同じ move が複数プリセットの行として何度も渡っても、集合が 1 件に畳む。
//
// ★状態接頭辞つきの move_code(denjin_charge_sa1_… 等)も拾う。落とすと、同じ番号を持つ
// 組が多義でないように見え、「確定してはならないものを確定する」形になる(指示書 §4.2)。
func (ix *Index) addSANumber(moveCode string) {
	if moveCode == "" {
		return
	}
	num, ok := sanumber.Extract(moveCode)
	if !ok {
		return
	}
	// 入力側と同じ正規化を掛けてキーにする(利用者は "sa1" とも "SA1" とも書く)。
	insert(ix.saNumber, aliasnorm.Normalize(num), moveCode)
}

func insert(m map[string]map[string]struct{}, key, moveCode string) {
	set, ok := m[key]
	if !ok {
		set = make(map[string]struct{})
		m[key] = set
	}
	set[moveCode] = struct{}{}
}

// Lookup は入力表記に当たる move.code を昇順で返す。
//
// 3 段構えである(第 1・2 段＝開発者裁定 2026-08-14 / DES-004 §5.6 の 1 件目 / D-331。
// 第 3 段＝M22-07b / D-442)。
//
//	第 1 段: aliasnorm.Normalize を入力側と辞書側の両方へ掛けて引く。ここは実測で同一視 0 組。
//	第 2 段: 第 1 段が 0 件のときだけ、★辞書側だけ SA / CA 注記を落とした索引を引く。
//	第 3 段: 前 2 段がいずれも 0 件のときだけ、★move_code から導いた SA 番号の索引を引く。
//
// ★★段は早期 return で順に評価する。前の段が 1 件でも返したら後ろの段は引かれない。
// ⇒ 「前の段の答えを変えない」(DES-004 §5.0.2 規約 3)は、気をつけて守るのではなく
// 構造上そうなっている。順序を入れ替えると TestThirdStage_DoesNotOverrideEarlierStages が赤くなる。
//
// ★第 3 段だけ源が辞書ではない。move_code そのものが SA 番号を持っているため、
// preset_aliases へ 1 行も足さずに引ける(案 E)。⇒ 新キャラ波で再投入するものが無い。
//
// ★★第 2 段で注記を落とすのは辞書側だけである。入力側の注記は落とさない。
// 落とすと「利用者が書いた注記を捨てて別の技へ確定する」形になる——実例として、
// ryu の SA1 は `236236P (SA1)`・SA3 は `236236K (SA3)` であるため、利用者が
// `236236P (SA3)`(実在しない組み合わせ)と書くと、入力の `(SA3)` を落とした
// `236236p` が SA1 に 1 件で当たり、★書かれていない技へ確定してしまう。
// 第 2 段の目的は「利用者が注記を省いた入力を拾う」ことであり、
// 「利用者が書いた注記を無視する」ことではない。
//
// ★第 2 段では別の技が同じキーへ落ちることが実際に起きる(全 17 キャラで CA と SA3)。
// そのため本メソッドは複数件をそのまま返し、確定させない。確定の可否は呼び出し側の
// 「1 件のときだけ確定」が決める。
//
// 該当が無ければ空スライスを返す(nil ではない)。
func (ix *Index) Lookup(aliasText string) []string {
	key := aliasnorm.Normalize(aliasText)
	if codes := sortedCodes(ix.strict[key]); len(codes) > 0 {
		return codes
	}
	if codes := sortedCodes(ix.relaxed[key]); len(codes) > 0 {
		return codes
	}
	return sortedCodes(ix.saNumber[key])
}

// LookupSANumber は第 3 段だけで引く。段の順序を主張するテストと、第 3 段が何を持っているかの
// 検査に使う。
//
// ★★本番の照合経路から呼ばないこと。段を迂回して第 3 段だけを引くと、
// 「前 2 段が答えを持つ入力を第 3 段の答えで上書きする」形になり、DES-004 §5.0.2 規約 3 を破る。
// 本番が呼ぶのは Lookup だけである（LookupStrict も同じ理由で検査専用）。
func (ix *Index) LookupSANumber(aliasText string) []string {
	return sortedCodes(ix.saNumber[aliasnorm.Normalize(aliasText)])
}

// LookupStrict は第 1 段だけで引く。第 2 段を挟まないことを主張するテストと、
// 「第 1 段には同一視が無い」という不変条件の検査に使う。
func (ix *Index) LookupStrict(aliasText string) []string {
	return sortedCodes(ix.strict[aliasnorm.Normalize(aliasText)])
}

// Scanned は索引へ投入した表記の総数を返す(E-84。「0 件」の意味を区別するため)。
func (ix *Index) Scanned() int { return ix.scanned }

// StrictCollisions は第 1 段の索引で、同一キーへ 2 つ以上の異なる move が落ちた組を
// キー昇順で返す。
//
// ★★これは常に空でなければならない。空でなくなったということは、正規化が別の技を
// 同一視したということである(指示書 §4.1-5・チェックリスト 重大 1)。
//
// ★この形の失敗は赤くならない——別の技が同じものとして解決されても、動作は「解決できた」
// ように見え、テストも型検査も緑のまま利用者のデータへ入る。⇒ 全数の契約テストで固定する
// (internal/aliasindex の全キャラ実データテスト)。
func (ix *Index) StrictCollisions() []Collision {
	return collisionsOf(ix.strict)
}

// RelaxedCollisions は第 2 段の索引の衝突を返す。
//
// ★こちらは空にならない(全 17 キャラで CA と SA3 が同じコマンドを持つため)。
// 空でないこと自体は欠陥ではなく、第 2 段の設計上の前提である——だからこそ
// 「1 件のときだけ確定」が働いて未解決へ倒れ、人が選ぶ。
func (ix *Index) RelaxedCollisions() []Collision {
	return collisionsOf(ix.relaxed)
}

func collisionsOf(m map[string]map[string]struct{}) []Collision {
	var out []Collision
	for key, set := range m {
		if len(set) > 1 {
			out = append(out, Collision{Key: key, MoveCodes: sortedCodes(set)})
		}
	}
	sort.Slice(out, func(i, j int) bool { return out[i].Key < out[j].Key })
	return out
}

func sortedCodes(set map[string]struct{}) []string {
	codes := make([]string, 0, len(set))
	for code := range set {
		codes = append(codes, code)
	}
	sort.Strings(codes)
	return codes
}
