package migration_test

import (
	"database/sql"
	"encoding/csv"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"testing"
)

// TestCSVAndDBAgreeOnFrameCostColumns は character_data/*.csv と DB が
// startup_basis / chain_cancel_total / fastest_unreachable / last_changed_game_version の
// 4 列で一致することを固定する。
//
// ★なぜ要るか(2026-09-04・開発者要求)
//
//	アップデート対応は「CSV を外部ツールで取込 → 修正 → 差分のみマイグレで取込」という運びである。
//	CSV 側だけが陳腐化していると、DB にしか無い値が差分に現れず静かに落ちる。
//	実際、本テストを入れる直前の実測では startup_basis 1186 セル / fastest_unreachable 1445 セル /
//	chain_cancel_total 89 セルが CSV 側で空だった(いずれも DB には値がある)。
//	★陳腐化したのはテストが無かったからである。値を揃えるだけでは再発する。
//
// ★先の 3 列は seedgen が「読むだけで SQL へ出力しない」列である(internal/seedgen/csv.go の
//
//	「新列 3 つ(000049)。保全のみ・SQL 非投入」)。したがって CSV を埋めても golden は動かない。
//	裏を返すと、golden が守ってくれないので本テストが唯一のガードである。
//
// ★★2026-09-06(M28-02a)に last_changed_game_version(FR702 のマーカー)を足した。
//
//	★本列は上の 3 列と違い seedgen が SQL へ出力する。⇒ 新しい seed 波では
//	CSV の値がそのまま DB へ入り、一致は構造的に保たれる。
//	★それでも本テストへ足す理由は、既存行の経路が別だからである ——
//	既に投入済みの 3026 行にマーカーを立てるのは DML マイグレであり、
//	そのとき CSV を直し忘れると「DB だけが進む」形になる。それは先の 3 列で実際に起きた。
//	⇒ CSV を「マーカーの正本」として運用するための機械的な担保が本テストである。
//	★followup `csv-db-frame-cost-columns-drift` の「残る運用＝次に列が増えたとき
//	同テストへ足すこと」への回答でもある。
//
// ★★★2026-09-13(M37-04)に first_hit_startup(その技の初段の発生・列は 000114)を足した。
//
//	★本列も seedgen が「読むだけで SQL へ出力しない」列である。⇒ golden は守ってくれない。
//	★M37-04 の着地時点では CSV・DB とも全行が空/NULL であった。⇒ その後（旧系列の）000116 の機械解決で
//	  106 行が入っている(残り 4 行はフレームを持たない空中限定であり投入対象外)。
//	  埋める対象は category='target_combo' ∧ is_derived ∧ startup_basis='standalone' の 106 行。
//	  (★M39-01 で 110 -> 106。D-187 の是正で上の空中限定 4 行が unknown へ移り、
//	   「埋める対象 106」と「実際に入っている 106」が一致した)
//	⇒ 本テストは「開発者が CSV を埋めたのに DB へ入れ忘れた」「DB だけ進んだ」の双方を捕まえる。
//
// ★CSV に行が無い move は対象外にする(意図的な欠落):
//   - zangief の連打版 3 行(000051)と dhalsim の連打版 1 行(000097)
//     … CSV に足すと生成物が変わって golden が壊れ、同じ値が 2 か所に存在する(D-94 / D-99)。
//   - 移動 system move 9 code × 31 キャラ(000025 / 000083)
//     … CSV は攻撃技のみを持つ。
func TestCSVAndDBAgreeOnFrameCostColumns(t *testing.T) {
	m, db := newMigrator(t)
	defer db.Close()
	if err := m.Up(); err != nil {
		t.Fatalf("migrate up: %v", err)
	}

	// ★M37-04 で first_hit_startup を足して 5 列になった(型名は quad のまま据え置くと
	//   次に読む人が 4 列だと思い込むため quint へ改名した)。
	type quint struct{ basis, chain, fastest, gameVersion, firstHit string }
	dbVals := map[[2]string]quint{}
	rows, err := db.Query(`SELECT c.code, m.code, m.startup_basis, m.chain_cancel_total, m.fastest_unreachable,
			m.last_changed_game_version, m.first_hit_startup
		FROM moves m JOIN characters c ON c.id = m.character_id
		JOIN games g ON g.id = c.game_id AND g.code = 'sf6'`)
	if err != nil {
		t.Fatalf("query moves: %v", err)
	}
	defer rows.Close()
	for rows.Next() {
		var ch, mc, basis string
		var chain sql.NullInt64
		var fastest int
		var gameVersion sql.NullString
		var firstHit sql.NullInt64
		if err := rows.Scan(&ch, &mc, &basis, &chain, &fastest, &gameVersion, &firstHit); err != nil {
			t.Fatalf("scan: %v", err)
		}
		v := ""
		if chain.Valid {
			v = fmt.Sprint(chain.Int64)
		}
		fh := ""
		if firstHit.Valid {
			fh = fmt.Sprint(firstHit.Int64)
		}
		// ★NULL(まだ一度も変わっていない / まだ手入力されていない)は CSV の空欄と対応する。
		dbVals[[2]string{ch, mc}] = quint{basis, v, fmt.Sprint(fastest != 0), gameVersion.String, fh}
	}
	if err := rows.Err(); err != nil {
		t.Fatalf("rows: %v", err)
	}
	if len(dbVals) == 0 {
		t.Fatal("DB から 1 行も読めていない(テストが空回りしている)")
	}

	files, err := filepath.Glob(filepath.Join(repoRootForCSV(t), "character_data", "*.csv"))
	if err != nil || len(files) == 0 {
		t.Fatalf("character_data/*.csv が見つからない: %v", err)
	}
	sort.Strings(files)

	const iBasis, iChain, iFastest, iGameVersion, iFirstHit = 20, 21, 22, 23, 24
	var diffs []string
	checked := 0
	for _, path := range files {
		f, err := os.Open(path)
		if err != nil {
			t.Fatalf("open %s: %v", path, err)
		}
		recs, err := csv.NewReader(f).ReadAll()
		_ = f.Close()
		if err != nil {
			t.Fatalf("read %s: %v", path, err)
		}
		hdr := recs[0]
		for i, want := range map[int]string{
			iBasis:       "startup_basis",
			iChain:       "chain_cancel_total",
			iFastest:     "fastest_unreachable",
			iGameVersion: "last_changed_game_version",
			iFirstHit:    "first_hit_startup",
		} {
			if hdr[i] != want {
				t.Fatalf("%s: 列 %d = %q, want %q(CSV 契約が変わった。本テストの添字を直すこと)", path, i, hdr[i], want)
			}
		}
		for _, r := range recs[1:] {
			if len(r) <= iFirstHit {
				continue
			}
			key := [2]string{r[0], r[1]}
			got, ok := dbVals[key]
			if !ok {
				diffs = append(diffs, fmt.Sprintf("%s/%s: CSV に在るが DB に無い", r[0], r[1]))
				continue
			}
			checked++
			for _, c := range []struct{ col, csvV, dbV string }{
				{"startup_basis", r[iBasis], got.basis},
				{"chain_cancel_total", r[iChain], got.chain},
				{"fastest_unreachable", r[iFastest], got.fastest},
				{"last_changed_game_version", r[iGameVersion], got.gameVersion},
				{"first_hit_startup", r[iFirstHit], got.firstHit},
			} {
				if c.csvV != c.dbV {
					diffs = append(diffs, fmt.Sprintf("%s/%s %s: CSV=%q DB=%q", r[0], r[1], c.col, c.csvV, c.dbV))
				}
			}
		}
	}

	// ★実測で固定する。CSV 行数が減ったらテストが空回りしていないかを疑う。
	if checked != 2743 {
		t.Errorf("突合した CSV 行数 = %d, want 2743(第四波までの全キャラ分)", checked)
	}
	if len(diffs) > 0 {
		// ★どちらが新しいかは判定しない。両方を出して人に判断させる。
		//   CSV が正なら DB へ backfill マイグレを、DB が正なら CSV を書き戻すこと。
		show := diffs
		if len(show) > 30 {
			show = append(show[:30], fmt.Sprintf("... 他 %d 件", len(diffs)-30))
		}
		t.Errorf("CSV と DB が %d 件食い違っている:\n%s", len(diffs), strings.Join(show, "\n"))
	}
}

// repoRootForCSV はテスト実行ディレクトリからリポジトリルートを遡って求める。
func repoRootForCSV(t *testing.T) string {
	t.Helper()
	dir, err := os.Getwd()
	if err != nil {
		t.Fatalf("getwd: %v", err)
	}
	for i := 0; i < 8; i++ {
		if _, err := os.Stat(filepath.Join(dir, "go.mod")); err == nil {
			return dir
		}
		dir = filepath.Dir(dir)
	}
	t.Fatal("go.mod が見つからない(リポジトリルートを特定できない)")
	return ""
}

// TestRun_HEAD_SeedValuesMatchCSV は character_data/*.csv と DB が、
// **seedgen が SQL へ投入する側の列**で一致することを固定する。
//
// ★★★なぜ本テストが要るか(M33-03)——着手時点はこの主張を golden が受け持っていた。
// `internal/seedgen` の 17 stem が「CSV から再生成した SQL」と「コミット済みの
// migrations/0000NN_*.sql」を byte 比較しており、**配布されるシードが CSV 由来である
// ことは、その byte 一致が担保していた。**
//
// ★M33-02 が旧 111 本を新系列 9 本へ潰したため、その byte 比較は原理的に再建できない
//
//	(seedgen は `INSERT ... SELECT ... CROSS JOIN` 形式・12 列を出すが、新
//	 000004_data_seed_moves は id 明示の VALUES タプル 22 列である)。
//	⇒ golden の比較先は internal/seedgen/testdata/ へ移した。そこで守れるのは
//	  「CSV → SQL の変換規則がドリフトしていない」ことだけであり、
//	  **「配布されるシードがその出力と一致する」は誰も見なくなる。**
//	⇒ その穴を *意味* で埋めるのが本テストである。byte ではなく値で突き合わせる。
//
// ★★上の TestCSVAndDBAgreeOnFrameCostColumns との分担——同テストは
//
//	「seedgen が読むだけで SQL へ出力しない列」(startup_basis / chain_cancel_total /
//	 fastest_unreachable / first_hit_startup ＋ 例外的に投入する last_changed_game_version)
//	を見る。本テストは seedgen が INSERT する列のうち、CSV に 1 対 1 で対応する 9 列を見る。
//
// ★★★2 本あわせても CSV の全列は覆えない(M33-03 レビュー 中-5 の是正)。
//
//	覆っていない列＝`name_ja`(moves に列が無い。official_ja_move alias 側へ入る) /
//	`is_projectile` / `is_derived`(seedgen は SQL 非投入・seed が値を持つ) /
//	`original_move_code`(id へ解決される) / `command`(move_commands へ入る) /
//	`notes` / `notes_tool` / `condition_ja` / `condition_en`(raw_data へ JSON で畳まれる)。
//	⇒ 「全列を覆った」と書くと、次に列が増えたときに「もう見ている」と誤読される。
//
// ★CSV に行が無い move は対象外(移動 system move・連打版)。上のテストと同じ理由である。
func TestRun_HEAD_SeedValuesMatchCSV(t *testing.T) {
	m, db := newMigrator(t)
	defer db.Close()
	if err := m.Up(); err != nil {
		t.Fatalf("migrate up: %v", err)
	}

	// seedgen が INSERT する列のうち、CSV に対応列を持つもの。
	// ★raw_data は CSV の複数列(notes / condition 等)を JSON へ畳んだ派生値なので外す。
	// ★name_ja は moves に列が無い(official_ja_move alias 側に入る)ので外す。
	type vals struct{ category, damage, startup, active, total, onHit, onBlock, recovery, isAerial string }

	dbVals := map[[2]string]vals{}
	rows, err := db.Query(`SELECT c.code, m.code, m.category, m.damage, m.startup, m.active,
			m.total, m.on_hit, m.on_block, m.recovery, m.is_aerial
		FROM moves m JOIN characters c ON c.id = m.character_id
		JOIN games g ON g.id = c.game_id AND g.code = 'sf6'`)
	if err != nil {
		t.Fatalf("query moves: %v", err)
	}
	defer rows.Close()
	num := func(n sql.NullInt64) string {
		if !n.Valid {
			return ""
		}
		return fmt.Sprint(n.Int64)
	}
	for rows.Next() {
		var ch, mc, category string
		var damage, startup, active, total, onHit, onBlock, recovery sql.NullInt64
		var isAerial int
		if err := rows.Scan(&ch, &mc, &category, &damage, &startup, &active,
			&total, &onHit, &onBlock, &recovery, &isAerial); err != nil {
			t.Fatalf("scan: %v", err)
		}
		dbVals[[2]string{ch, mc}] = vals{
			category: category, damage: num(damage), startup: num(startup), active: num(active),
			total: num(total), onHit: num(onHit), onBlock: num(onBlock), recovery: num(recovery),
			isAerial: fmt.Sprint(isAerial != 0),
		}
	}
	if err := rows.Err(); err != nil {
		t.Fatalf("rows: %v", err)
	}
	if len(dbVals) == 0 {
		t.Fatal("DB から 1 行も読めていない(テストが空回りしている)")
	}

	files, err := filepath.Glob(filepath.Join(repoRootForCSV(t), "character_data", "*.csv"))
	if err != nil || len(files) == 0 {
		t.Fatalf("character_data/*.csv が見つからない: %v", err)
	}
	sort.Strings(files)

	// CSV の列添字(csvColumns の順序)。★契約が変わったら止める。
	const (
		iChar     = 0
		iMove     = 1
		iCategory = 2
		iStartup  = 4
		iActive   = 5
		iRecovery = 6
		iTotal    = 7
		iOnHit    = 8
		iOnBlock  = 9
		iDamage   = 10
		iIsAerial = 11
	)
	wantHeader := map[int]string{
		iChar: "character_code", iMove: "move_code", iCategory: "category",
		iStartup: "startup", iActive: "active", iRecovery: "recovery", iTotal: "total",
		iOnHit: "on_hit", iOnBlock: "on_block", iDamage: "damage", iIsAerial: "is_aerial",
	}

	var diffs []string
	checked := 0
	for _, path := range files {
		f, err := os.Open(path)
		if err != nil {
			t.Fatalf("open %s: %v", path, err)
		}
		recs, err := csv.NewReader(f).ReadAll()
		_ = f.Close()
		if err != nil {
			t.Fatalf("read %s: %v", path, err)
		}
		if len(recs) < 2 {
			t.Fatalf("%s: データ行が無い", path)
		}
		for i, want := range wantHeader {
			if recs[0][i] != want {
				t.Fatalf("%s: 列 %d = %q, want %q(CSV 契約が変わった。本テストの添字を直すこと)",
					path, i, recs[0][i], want)
			}
		}
		for _, rec := range recs[1:] {
			key := [2]string{rec[iChar], rec[iMove]}
			got, ok := dbVals[key]
			if !ok {
				diffs = append(diffs, fmt.Sprintf("%s/%s: CSV に在って DB に無い", key[0], key[1]))
				continue
			}
			checked++
			for _, c := range []struct{ label, csv, db string }{
				{"category", rec[iCategory], got.category},
				{"startup", rec[iStartup], got.startup},
				{"active", rec[iActive], got.active},
				{"recovery", rec[iRecovery], got.recovery},
				{"total", rec[iTotal], got.total},
				{"on_hit", rec[iOnHit], got.onHit},
				{"on_block", rec[iOnBlock], got.onBlock},
				{"damage", rec[iDamage], got.damage},
				{"is_aerial", rec[iIsAerial], got.isAerial},
			} {
				if c.csv != c.db {
					diffs = append(diffs, fmt.Sprintf("%s/%s %s: CSV=%q DB=%q",
						key[0], key[1], c.label, c.csv, c.db))
				}
			}
		}
	}

	if checked == 0 {
		t.Fatal("CSV と DB で突き合わせた行が 0(テストが空回りしている)")
	}
	if len(diffs) != 0 {
		// ★落ちたら、CSV 正本と配布シードのどちらが正しいかを先に特定すること。
		//   ⇒ 「golden を再生成する」だけでは DB は直らない(SUPP-001 §5.5 規約 (19) の 3 点セット)。
		t.Errorf("CSV と配布シードが %d 件食い違う(突き合わせ %d 行):\n  %s",
			len(diffs), checked, strings.Join(capDiffs(diffs), "\n  "))
	}
	t.Logf("CSV と配布シードの一致を %d 行 × 9 列で確認した", checked)
}

// capDiffs は差分の列挙を先頭 30 件へ丸める(全件は件数で示す)。
func capDiffs(diffs []string) []string {
	const max = 30
	if len(diffs) <= max {
		return diffs
	}
	return append(diffs[:max:max], fmt.Sprintf("... 他 %d 件", len(diffs)-max))
}
