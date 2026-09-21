package model

// Game はゲームマスタ(DES-003 §3.1)。
//
// DES-003 §3.1 にタイムスタンプカラムは定義されていないため、CreatedAt / UpdatedAt は持たない。
type Game struct {
	ID     int64  `db:"id"      json:"id"`
	Code   string `db:"code"    json:"code"`
	NameJa string `db:"name_ja" json:"nameJa"`
	NameEn string `db:"name_en" json:"nameEn"`
	// CurrentDataVersion は「現在のデータバージョン」(M28-02a・マイグレ 000104)。
	//
	// ★★コンボの基準(combos.baseline_version)へ書く値の出どころである。
	// ★★MAX(moves.last_changed_game_version) で代用してはならない —— move を 1 行も
	//   変えないアップデート(入力ミスの訂正が moves 以外だった / 機能追加で列が増えただけ)
	//   では MAX が動かず、版が上がったことを表せない。`YYYY.MM.DD.NN` の後半 NN は
	//   まさにその型の版である(指示書 §2.2-3-c)。
	// ★games は 1 行(sf6)で DB と一緒に配布されるため、新しいテーブルを作らずに済む。
	// ★形式は internal/gameversion。NOT NULL(「無い」状態を作らない)。
	CurrentDataVersion string `db:"current_data_version" json:"currentDataVersion"`
}
