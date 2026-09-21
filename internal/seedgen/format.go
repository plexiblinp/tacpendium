package seedgen

// 生成 SQL の形式切り替え(M20-03)。
//
// ★なぜ切り替えが要るのか
//   M20-03 が preset_aliases へ character_id を足したため、以後に生成する
//   INSERT は character_id を出さなければならない(出さないと NULL 行が入り、
//   UNIQUE 索引をすり抜ける。★落ちないため気づけない = 指示書 M20-03 §4.5)。
//   一方、既に適用済みのマイグレは改変できない(同 §2.2)。そして golden テストは
//   「生成器の出力がコミット済みマイグレと byte 一致すること」を主張しており、
//   これが手編集ドリフトの唯一の検出経路である。
//   ⇒ 旧形式を名前付きで残し、golden だけがそれを指定する。

// SQLFormat は preset_aliases への INSERT が character_id を含むかを表す。
type SQLFormat int

const (
	// FormatCurrent は character_id を含む現行形式(M20-03 以降)。既定値である。
	//
	// 新しい seed 波(character_data/seed-progress.md の手順)は必ずこちらを使う。
	// cmd/seedgen はオプションを渡さないため自動的に本形式になる。
	FormatCurrent SQLFormat = iota

	// FormatPreM2003 は character_id を含まない旧形式。
	//
	// ★後方互換専用であり、対象は閉じた集合である——M20-03 より前に生成・適用済みの
	// 次の 6 ファイルだけを指す。今後この集合が増えることはない。
	//
	//	000026_seed_moves_first_wave
	//	000030_seed_moves_ryu
	//	000045_seed_moves_manon
	//	000055_seed_moves_third_wave
	//	000072_m20_seed_aliases_numeric
	//	000073_m20_seed_aliases_srk
	//
	// ★★M33-03: この 6 つは *凍結 golden の名前* である(internal/seedgen/testdata/)。
	// ⇒ M33-02 が旧 111 本を新系列 9 本へ潰したため、同名のマイグレは migrations/ に無い。
	// ★綴りは変えていない。由来を辿れるようにするためである。
	//
	// ★新規生成では使わないこと。使うと character_id が NULL の行が入り、
	// UNIQUE(preset_id, character_id, alias_text) をすり抜ける。
	// 指定してよいのは、上記 6 ファイルとの byte 一致を主張する golden テストだけである。
	FormatPreM2003
)

// includesCharacterID は本形式が preset_aliases へ character_id を出すかを返す。
func (f SQLFormat) includesCharacterID() bool { return f == FormatCurrent }

// includesNoInputDerived は本形式が層 C-3(P-34 の 13 件・M20-06)を出すかを返す。
//
// ★FormatPreM2003 で false にする理由は character_id と同じである——上記 6 ファイルは
// 層 C-3 が存在しない時点で生成・適用済みであり、出すと golden テストが主張する
// byte 一致が崩れる。★「規則を足したら適用済みマイグレの再生成結果が変わる」のは
// 生成器を持つ以上つねに起きるため、旧形式を「当時の生成器の挙動」として凍結してある。
func (f SQLFormat) includesNoInputDerived() bool { return f == FormatCurrent }

// Option は生成の任意設定。可変長で受けるため、既存の呼び出しは無改変で
// 既定(FormatCurrent)になる。
type Option func(*options)

type options struct {
	format      SQLFormat
	noInputOnly bool
}

// WithNoInputOnly は層 C-3(P-34 の 13 件)だけを SQL へ出す(M20-06)。
//
// ★用途は「既に seed 済みのキャラへ層 C-3 だけを後から入れる」一度きりの投入である。
// 既存の -mode aliases をそのまま再実行すると、up は NOT EXISTS で skip する一方
// down は無条件 DELETE であるため、旧 000072 / 000073 が入れた行まで消す down ができる。
//
// ★解決そのものは全層で回る(衝突判定の母数を保つため)。絞るのは出力だけである。
func WithNoInputOnly() Option {
	return func(o *options) { o.noInputOnly = true }
}

// WithFormat は生成 SQL の形式を指定する。
//
// ★FormatPreM2003 を渡してよいのは golden テストだけである(理由は同定数の注記)。
func WithFormat(f SQLFormat) Option {
	return func(o *options) { o.format = f }
}

// resolveOptions は可変長オプションを畳む(未指定なら FormatCurrent)。
func resolveOptions(opts []Option) options {
	o := options{format: FormatCurrent}
	for _, apply := range opts {
		apply(&o)
	}
	return o
}
