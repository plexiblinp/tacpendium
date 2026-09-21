package migration_test

import (
	"database/sql"
	"testing"
)

// M14-03d(第二波 seed = manon 単独)の seed テスト。
//
// ★★★【M33-03・2026-09-19】終端は HEAD である。着手時点は旧 000043〜000048 の 6 連番を
// 表で列挙していたが、M33-02 が旧 111 本を新系列 9 本へ潰したためその連番は存在しない。
// ⇒ 連番の表は落とした。★manon の seed は新系列では 000003(characters)/ 000004(moves)/
// 000005(move_commands)/ 000008(preset_aliases)が持つ。
//
// ★歴史記録: 旧系列では 000043 characters → 000044 移動 9 種 + alias → 000045 moves 72
// → 000046 is_derived backfill → 000047 move_commands → 000048 移動 total backfill の順で
// 投入していた。manon は旧 000024/000025 の時点で characters に存在せず、移動 9 種も
// 1 行も入っていなかった(旧 000025 の NOT EXISTS は冪等性のためであり、後から追加された
// キャラを遡って埋めるものではない)。そのため専用の 2 本が前提として要った。
const (
	manonDerivedCodes = 27 // CSV で is_derived=true の行数
	manonRushVariants = 15
	manonIndexRows    = 45 // 非派生 45 行(= 72 - 27)。全行 command 非空・語彙内
)

// charMoveCounts は キャラ code → (moves 件数, official_ja_move alias 件数) を返す
// (他キャラ非波及の判定を件数の二重管理なしで行うためのスナップショット)。
func charMoveCounts(t *testing.T, db *sql.DB) map[string][2]int {
	t.Helper()
	rows, err := db.Query(`SELECT c.code, count(m.id),
		count((SELECT pa.id FROM preset_aliases pa
			JOIN presets p ON p.id = pa.preset_id AND p.code = 'official_ja_move'
			WHERE pa.move_id = m.id))
		FROM characters c LEFT JOIN moves m ON m.character_id = c.id
		GROUP BY c.code`)
	if err != nil {
		t.Fatalf("charMoveCounts query: %v", err)
	}
	defer rows.Close()
	out := map[string][2]int{}
	for rows.Next() {
		var code string
		var moves, aliases int
		if err := rows.Scan(&code, &moves, &aliases); err != nil {
			t.Fatalf("scan: %v", err)
		}
		out[code] = [2]int{moves, aliases}
	}
	if err := rows.Err(); err != nil {
		t.Fatalf("rows: %v", err)
	}
	return out
}

// TestRun_M1403d_UpContract は 000043〜000047 の up 契約を検証する。
func TestRun_M1403d_UpContract(t *testing.T) {
	m, db := newMigrator(t)
	defer db.Close()
	if err := m.Up(); err != nil {
		t.Fatalf("up to HEAD: %v", err)
	}

	// characters 行が入っている(これが無いと seedgen 生成 SQL はサイレントに 0 行投入になる)。
	if got := scanInt(t, db, `SELECT count(*) FROM characters WHERE code='manon'
		AND game_id IN (SELECT id FROM games WHERE code='sf6')`); got != 1 {
		t.Fatalf("manon characters = %d, want 1", got)
	}

	// ★★M33-03: 件数(CSV 72 + 移動 9)を CSV との突き合わせへ置き換えた。
	//   ⇒ 「+9」の前提が失効していた(現在の system move は 11 種)。
	assertCharMovesMatchCSV(t, db, "manon")
	if got := scanInt(t, db, `SELECT count(*) FROM moves m JOIN characters c ON c.id=m.character_id
		WHERE c.code='manon' AND NOT EXISTS (
			SELECT 1 FROM preset_aliases pa JOIN presets p ON p.id=pa.preset_id AND p.code='official_ja_move'
			WHERE pa.move_id = m.id)`); got != 0 {
		t.Errorf("alias 欠落の manon moves = %d, want 0", got)
	}

	// 移動 9 種が投入され、total は NULL のまま(実測値未受領＝推測で埋めない。000041 は 10 キャラ限定)。
	for _, code := range movementCodes {
		if got := scanInt(t, db, `SELECT count(*) FROM moves m JOIN characters c ON c.id=m.character_id
			WHERE c.code='manon' AND m.code=? AND m.category='system'`, code); got != 1 {
			t.Errorf("manon 移動 move %q = %d, want 1", code, got)
		}
	}
	// 000048: 移動 5 code の total を backfill(開発者提供の実測値・2026-07-31 受領)。
	// 000041 と同じく forward/back/micro_* の 4 code は対象外＝NULL のまま。
	for _, c := range []struct {
		code string
		want int
	}{
		{"dash_forward", 21},
		{"dash_back", 25},
		{"jump_neutral", 43},
		{"jump_forward", 43},
		{"jump_back", 43},
	} {
		if got := scanInt(t, db, `SELECT COALESCE((SELECT m.total FROM moves m
			JOIN characters c ON c.id=m.character_id
			WHERE c.code='manon' AND m.code=?), -1)`, c.code); got != c.want {
			t.Errorf("manon %s の total = %d, want %d", c.code, got, c.want)
		}
	}
	// drive_parry も category='system' だが CSV 由来で total を持つため、移動 code に限定して判定する。
	if got := scanInt(t, db, `SELECT count(*) FROM moves m JOIN characters c ON c.id=m.character_id
		WHERE c.code='manon' AND m.total IS NOT NULL AND m.code IN
		('forward','back','micro_forward','micro_back')`); got != 0 {
		t.Errorf("manon の forward/back/micro_* で total 非 NULL = %d, want 0 (000041 でも対象外)", got)
	}
	// drive_parry は移動 move ではないので CSV から通過している。
	if got := scanInt(t, db, `SELECT count(*) FROM moves m JOIN characters c ON c.id=m.character_id
		WHERE c.code='manon' AND m.code='drive_parry'`); got != 1 {
		t.Errorf("manon drive_parry = %d, want 1", got)
	}

	// 000046: is_derived backfill。rush は全件 true(索引で通常版と衝突させないため)。
	if got := scanInt(t, db, `SELECT count(*) FROM moves m JOIN characters c ON c.id=m.character_id
		WHERE c.code='manon' AND m.is_derived=1`); got != manonDerivedCodes {
		t.Errorf("manon is_derived=1 = %d, want %d", got, manonDerivedCodes)
	}
	if got := scanInt(t, db, `SELECT count(*) FROM moves m JOIN characters c ON c.id=m.character_id
		WHERE c.code='manon' AND m.category='rush_variant'`); got != manonRushVariants {
		t.Errorf("manon rush_variant = %d, want %d", got, manonRushVariants)
	}
	if got := scanInt(t, db, `SELECT count(*) FROM moves m JOIN characters c ON c.id=m.character_id
		WHERE c.code='manon' AND m.category='rush_variant' AND m.is_derived=0`); got != 0 {
		t.Errorf("manon rush_variant かつ is_derived=0 = %d, want 0", got)
	}
	// rush の元技参照が全解決(original_move_code の typo なら NULL のまま静かに入る)。
	if got := scanInt(t, db, `SELECT count(*) FROM moves m JOIN characters c ON c.id=m.character_id
		WHERE c.code='manon' AND m.category='rush_variant' AND m.original_move_id IS NULL`); got != 0 {
		t.Errorf("original_move_id 未解決の manon rush = %d, want 0", got)
	}

	// 000047: 索引。派生技は載せない・宙吊り参照なし。
	if got := scanInt(t, db, `SELECT count(*) FROM move_commands mc
		JOIN characters c ON c.id=mc.character_id WHERE c.code='manon'`); got != manonIndexRows {
		t.Errorf("manon move_commands = %d, want %d", got, manonIndexRows)
	}
	if got := scanInt(t, db, `SELECT count(*) FROM move_commands mc JOIN moves m ON m.id=mc.move_id
		JOIN characters c ON c.id=mc.character_id WHERE c.code='manon' AND m.is_derived=1`); got != 0 {
		t.Errorf("manon 索引に派生技が混入 = %d, want 0", got)
	}
	if got := scanInt(t, db, `SELECT count(*) FROM move_commands mc
		WHERE NOT EXISTS (SELECT 1 FROM moves m WHERE m.id = mc.move_id)`); got != 0 {
		t.Errorf("move_commands の孤児行 = %d, want 0", got)
	}
	// 代表キー: 4HP=レベランス(単方向+強度付きボタン=段階2 解決表の形状)。
	if got := scanInt(t, db, `SELECT count(*) FROM move_commands mc JOIN moves m ON m.id=mc.move_id
		JOIN characters c ON c.id=mc.character_id
		WHERE c.code='manon' AND mc.token_key='4HP' AND m.code='reverence'`); got != 1 {
		t.Errorf("manon 4HP → reverence = %d, want 1", got)
	}

	fkCheck(t, db)
}
