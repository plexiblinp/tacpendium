package csvcore

import "github.com/plexiblinp/tacpendium/internal/model"

// ── ファイル全体の上限(DES-006 §6 / NFR103・VAL-I01/I03)──────────────
const (
	// DefaultMaxBytes は入力 CSV の最大バイト数(VAL-I01、既定 10MiB)。
	DefaultMaxBytes = 10 << 20 // 10 MiB
	// DefaultMaxRows は許容するデータ行数の上限(VAL-I03、既定 1000 行)。
	DefaultMaxRows = 1000
	// DefaultMaxCellBytes は1セルの最大バイト数(可変長 JSON セルの異常肥大ガード)。
	DefaultMaxCellBytes = 1 << 20 // 1 MiB
)

// IntRange は整数列の許容範囲(両端含む)。
type IntRange struct {
	Min, Max int
}

// Contains は n が範囲内(両端含む)かを返す。
func (r IntRange) Contains(n int) bool { return n >= r.Min && n <= r.Max }

// FloatRange は実数列の許容範囲(両端含む)。
type FloatRange struct {
	Min, Max float64
}

// Contains は n が範囲内(両端含む)かを返す。
func (r FloatRange) Contains(n float64) bool { return n >= r.Min && n <= r.Max }

// ── 数値範囲(DES-006 §2.1)──────────────────────────────────────────
var (
	// DriveAvailableRange は drive_available_at_start の許容範囲(VAL-C04、0〜6・小数許容、ERROR)。
	DriveAvailableRange = FloatRange{Min: 0, Max: 6}
	// SAAvailableRange は sa_available_at_start の許容範囲(VAL-C05、ERROR)。
	SAAvailableRange = IntRange{Min: 0, Max: 3}
	// PositionMassRange は始動位置マス数・運び量の許容範囲(M28-02a・160 マスの物差し)。
	// ★DB の CHECK と同じ値域である。CSV 側でも弾かないと、取込が CHECK 違反で
	//   行ごと落ち、利用者にはどのセルが悪いのか分からない。
	PositionMassRange = IntRange{Min: 0, Max: model.MaxPositionMass}
	// KnockdownRange は knockdown_advantage の現実的範囲(VAL-C10、WARNING)。
	KnockdownRange = IntRange{Min: -600, Max: 600}
	// DriveDamageRange は drive_damage の許容範囲(VAL-C13、-6〜6・小数許容、ERROR)。
	DriveDamageRange = FloatRange{Min: -6, Max: 6}
)

// ── enum シード(DES-003 §3.4 / OPEN-001)──────────────────────────────
// 値マスタは未確定のため、未知値は既定 WARNING(EnumStrict で ERROR)。
var (
	// DefaultPositions は position の許容値。
	//
	// ★★M28-02a で model.PositionBands と揃えた(7 値)。
	//   着手前は 4 値であり corner_self_near が欠けていた —— 本体の値域は 5 値であり、
	//   corner_self_near のコンボを往復させると VAL-ENUM 警告が出る状態だった。
	//   ★新値 2 つ(mid_self / mid_opponent)を足すだけでは、その穴が残ったまま
	//     「新しく足した値だけ通る」ちぐはぐな状態になる。⇒ 同じ手番で揃えた。
	//   ★TestDefaultPositionsMatchesModel が以後のズレを見る
	//     (着手前は position の同期テストが存在しなかった)。
	DefaultPositions       = model.PositionValuesInDisplayOrder()
	DefaultOpponentStances = []string{
		"standing", "crouching", "airborne", "any",
	}
	// M27-01: model.HitType* と同じ 8 値。★リテラルの再定義であり model を参照していない
	// ——同期はここを直す手番でしか保てない(値を足すときは両方直すこと)。
	DefaultHitTypes = []string{
		"normal", "counter", "punish_counter", "just_parry_punish_counter",
		"drive_impact_wall_splat_hit", "drive_impact_wall_splat_block",
		"drive_impact_punish_counter", "stun",
	}
	// ★★本体(model.OpponentSize*)は standard / large / large1 / large2 の 4 値だが、
	// 本リストは 3 値のままである。一致は 2/4。
	//   - small : 本体に存在しない死んだ値
	//   - large1 / large2 : 本体に在るがここに無く、往復すると VAL-ENUM の未知値警告が出る
	// これは followup `csv-import-opponent-size-whitelist-stale` として起票済みで、
	// **開発者裁定でスコープ外**である(逐語＝「これはあなたのミスでもなければスコープ外なので、
	// 対応不要ですが、申し送りにはしておいてください。」)。
	// M27-01 は medium → standard の 1 語だけを追随させた(開発者選択 (a)・2026-09-02)。
	// ⇒ ★残りのズレを直すときは、この行ごと本体の 4 値へ揃えること。
	DefaultOpponentSizes = []string{
		"small", "standard", "large",
	}
)

// CodeLookup は技/キャラのコード存在検証(VAL-I06/I07)を注入するフック。
// 既定(nil)では存在検証をスキップする(本体は実装を注入して有効化する)。
type CodeLookup interface {
	// CharacterExists は character_code が存在するキャラかを返す(VAL-I06)。
	CharacterExists(code string) bool
	// MoveExists は characterCode のキャラに moveCode の技が存在するかを返す(VAL-I07)。
	MoveExists(characterCode, moveCode string) bool
}

// Options は ParseAndValidate の挙動を調整する。ゼロ値で安全な既定が適用される。
type Options struct {
	MaxBytes     int
	MaxRows      int
	MaxCellBytes int

	// EnumStrict が true のとき、許可リスト外の enum 値を ERROR とする(既定 WARNING)。
	EnumStrict bool

	AllowedPositions       []string
	AllowedOpponentStances []string
	AllowedHitTypes        []string
	AllowedOpponentSizes   []string

	// Lookup は技/キャラ存在検証の注入フック。nil で存在検証スキップ。
	Lookup CodeLookup
}

// resolved は Options に既定を適用し、enum を集合化した内部設定。
type resolved struct {
	maxBytes     int
	maxRows      int
	maxCellBytes int
	enumStrict   bool
	positions    map[string]bool
	stances      map[string]bool
	hitTypes     map[string]bool
	sizes        map[string]bool
	lookup       CodeLookup
}

func (o Options) resolve() resolved {
	pick := func(n, def int) int {
		if n <= 0 {
			return def
		}
		return n
	}
	return resolved{
		maxBytes:     pick(o.MaxBytes, DefaultMaxBytes),
		maxRows:      pick(o.MaxRows, DefaultMaxRows),
		maxCellBytes: pick(o.MaxCellBytes, DefaultMaxCellBytes),
		enumStrict:   o.EnumStrict,
		positions:    toSet(o.AllowedPositions, DefaultPositions),
		stances:      toSet(o.AllowedOpponentStances, DefaultOpponentStances),
		hitTypes:     toSet(o.AllowedHitTypes, DefaultHitTypes),
		sizes:        toSet(o.AllowedOpponentSizes, DefaultOpponentSizes),
		lookup:       o.Lookup,
	}
}

func toSet(override, def []string) map[string]bool {
	src := def
	if override != nil {
		src = override
	}
	m := make(map[string]bool, len(src))
	for _, v := range src {
		m[v] = true
	}
	return m
}
