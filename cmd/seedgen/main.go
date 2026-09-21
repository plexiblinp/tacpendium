// Command seedgen は手入力 CSV(character_data/*.csv)から seed マイグレを生成する
// dev/build 時専用ツール。
//
// 本体ランタイムからは呼ばれない(取込 FR704 の復活禁止・M14-03b 指示書 §4.1)。生成物はコミットし、
// 配布ビルドは migrations を適用するのみ。
//
// ★★★【M33-03・2026-09-19】生成物の置き場が 2 つに分かれた。
//
//	M33-02 が旧 111 本を新系列 9 本(000001〜000009)へ潰したため、本ツールが生成していた
//	17 stem に対応する migrations/ のファイルは *存在しない*。⇒ それらは
//	internal/seedgen/testdata/ へ「凍結 golden」として移した。
//
//	(a) 凍結 golden 17 stem の再生成 … ★CLI では行わない。テスト経由で行う:
//	      TACPENDIUM_UPDATE_GOLDEN=1 go test ./internal/seedgen/
//	    ⇒ 生成に使う引数(-chars / -note / 形式)がテスト本体と同一になるため、
//	      下記の「再生成コマンド」を人が転記して誤るという経路が構造的に消える。
//	      ★着手時点は note を Go の定数から人が転記する形であった。
//	(b) 新しい seed 波 … 従来どおり CLI で新しい連番(000010 以降)へ生成する。
//
// 使い方:
//
//	go run ./cmd/seedgen -check                # 生成物と既存ファイルの差分のみ確認(書かない)
//	go run ./cmd/seedgen -index-report out.md  # 索引ダンプ(LookupAll・Skipped)を出力
//	go run ./cmd/seedgen -chars ryu -out 000010_data_seed_moves_xxx -note "..."
//	                                           # 対象キャラ・出力先を指定して生成
//	go run ./cmd/seedgen -mode derived-backfill -chars ... -out ... -note "..."
//	                                           # moves.is_derived の backfill マイグレ生成(M17-02)
//	go run ./cmd/seedgen -mode move-commands -chars ... -out ... -note "..."
//	                                           # command 索引 move_commands の seed マイグレ生成(M17-02)
//	go run ./cmd/seedgen -mode aliases -preset numeric -chars ... -movement-chars ... \
//	  -out ... -note "..." -alias-report tmp/numeric.md
//	                                           # 表記プリセットの preset_aliases seed 生成(M20-02)
//	                                           # ★-movement-chars は移動系 9 code の投入先(省略時は -chars と同じ)。
//	                                           #   up/down を同じ集合で絞るため、波ごとに正しく渡すこと。
//
// ★凍結 golden を CLI から触るときは -migrations で置き場を明示する:
//
//	go run ./cmd/seedgen -check -migrations internal/seedgen/testdata
//
// -chars / -out は対で指定する(片方のみはエラー)。-mode moves(既定)で省略時は第一波
// (FirstWaveOrder→seedgen.FirstWaveStem)を生成し、その出力は byte-identical を
// golden テストで固定している(変換規則の無改変ゲート)。
// -mode derived-backfill / move-commands は -chars/-out 必須。
//
// ★生成形式は出力先 stem から自動で決まる(M20-03)。preset_aliases への INSERT は
// character_id を含む新形式が既定だが、旧形式で生成・適用済みの 6 stem(preM2003Stems)は
// 旧形式で生成する。⇒ 凍結 golden をそのまま再現するために必要である。
package main

import (
	"flag"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"

	"github.com/plexiblinp/tacpendium/internal/moveindex"
	"github.com/plexiblinp/tacpendium/internal/seedgen"
)

func main() {
	if err := run(); err != nil {
		fmt.Fprintln(os.Stderr, "seedgen: "+err.Error())
		os.Exit(1)
	}
}

// preM2003Stems は preset_aliases への INSERT に character_id を含まない旧形式で
// 生成され、既に適用済みのマイグレ stem(M20-03)。
//
// ★閉じた集合であり今後増えない(内訳と理由は internal/seedgen/format.go の FormatPreM2003)。
// M20-03 が character_id を足したため、これらを既定の新形式で生成すると
// ★適用済みマイグレを上書きする形になる(指示書 M20-03 §2.2 / SUPP-001 §5.5 が禁じる操作)。
// かつ -check が恒常的に赤になり、「赤いのが普通」になって実際のドリフトを検出できなくなる。
// ⇒ 出力先 stem がこの集合なら旧形式で生成する。これにより golden テストの再生成が
// そのまま当該ファイルを再現し、-check の byte 一致も維持される(フラグを足す形にすると、
// 付け忘れた実行が凍結 golden を壊す)。
//
// ★★M33-03 で集合の *意味* が変わった。着手時点は「旧形式で生成・適用済みの
// コミット済みマイグレ」を指していたが、M33-02 の統合でその 6 ファイルは
// migrations/ に存在しない。⇒ いまは「旧形式で凍結した golden」の集合である。
// ★集合の中身は 1 つも変えていない(綴りも変えていない)。⇒ 由来を辿れるようにするため。
var preM2003Stems = map[string]bool{
	"000026_seed_moves_first_wave":    true,
	"000030_seed_moves_ryu":           true,
	"000045_seed_moves_manon":         true,
	"000055_seed_moves_third_wave":    true,
	"000072_m20_seed_aliases_numeric": true,
	"000073_m20_seed_aliases_srk":     true,
}

// goldenDirRel は凍結 golden の置き場(リポジトリルート相対)。
//
// ★★M33-03 で 17 stem の置き場が migrations/ から移った。⇒ assertGolden(テスト側)と
// 同じ場所を指す。片方だけ変えると -check が恒常的に赤くなる。
const goldenDirRel = "internal/seedgen/testdata"

// outDirFor は stem から出力先/比較先ディレクトリを決める。
//
// ★★★【M33-03】これが無いと `-check` が恒常赤になる。⇒ 既定 stem は凍結 golden の
// 名前であり、既定の -migrations(=migrations/)にはそのファイルが存在しない。
// ★本ファイル :75 のコメント自身が「-check が恒常的に赤になり『赤いのが普通』になる」形を
// 警告している。⇒ その形を作らないために、stem で置き場を振り分ける。
//
// ★-migrations を明示で渡したときは、それを尊重する(呼び出し側の指定が勝つ)。
func outDirFor(stem, migDirFlag string, migDirExplicit bool) string {
	if migDirExplicit {
		return migDirFlag
	}
	if isFrozenGolden(stem) {
		return goldenDirRel
	}
	return migDirFlag
}

// isFrozenGolden は stem が凍結 golden(internal/seedgen/testdata/)のものかを返す。
//
// ★preM2003Stems は「旧形式で生成する 6 stem」であり、凍結 golden の全数(17)ではない。
// ⇒ 別の集合として持つ。★assertGolden が見る 17 stem と一致させること。
func isFrozenGolden(stem string) bool { return frozenGoldenStems[stem] }

var frozenGoldenStems = map[string]bool{
	"000026_seed_moves_first_wave":                 true,
	"000030_seed_moves_ryu":                        true,
	"000034_backfill_moves_is_derived":             true,
	"000035_seed_move_commands":                    true,
	"000045_seed_moves_manon":                      true,
	"000046_backfill_moves_is_derived_manon":       true,
	"000047_seed_move_commands_manon":              true,
	"000055_seed_moves_third_wave":                 true,
	"000056_backfill_moves_is_derived_third_wave":  true,
	"000057_seed_move_commands_third_wave":         true,
	"000072_m20_seed_aliases_numeric":              true,
	"000073_m20_seed_aliases_srk":                  true,
	"000084_seed_moves_fourth_wave":                true,
	"000085_backfill_moves_is_derived_fourth_wave": true,
	"000086_seed_move_commands_fourth_wave":        true,
	"000090_seed_aliases_numeric_fourth_wave":      true,
	"000091_seed_aliases_srk_fourth_wave":          true,
}

// formatFor は出力先 stem から生成形式を決める。新しい波は必ず新しい連番の stem を
// 使うため、自動的に FormatCurrent(character_id を出す)になる。
func formatFor(stem string) seedgen.SQLFormat {
	if preM2003Stems[stem] {
		return seedgen.FormatPreM2003
	}
	return seedgen.FormatCurrent
}

// diffHint は -check の差分検出時に出す案内。
//
// ★「再生成しろ」とだけ書いてはならない。出力先が凍結 golden の場合、
// 従うと「なぜ変わったか」を特定せずに写しを書き換えることになる(M20-03 §2.2)。
func diffHint(stem string) string {
	if preM2003Stems[stem] {
		return fmt.Sprintf("生成物と既存ファイルに差分あり。★%s は凍結 golden であり、"+
			"理由を特定せずに上書きしてはならない(M20-03 §2.2 / SUPP-001 §5.5)。"+
			"CSV 正本か変換規則が変わったということなので、どちらが変わったかを特定してから "+
			"TACPENDIUM_UPDATE_GOLDEN=1 go test ./internal/seedgen/ で更新すること", stem)
	}
	return "生成物と既存ファイルに差分あり(未適用の生成物であれば再生成してよい)"
}

// migDirExplicit は -migrations がコマンドラインで明示されたかを返す。
//
// ★flag.Visit は「実際に渡されたフラグ」だけを列挙する。⇒ 既定値のままかを判別できる。
func migDirExplicit() bool {
	seen := false
	flag.Visit(func(f *flag.Flag) {
		if f.Name == "migrations" {
			seen = true
		}
	})
	return seen
}

func run() error {
	var (
		dataDir       = flag.String("data", "character_data", "手入力 CSV ディレクトリ")
		migDir        = flag.String("migrations", "migrations", "マイグレ出力ディレクトリ")
		check         = flag.Bool("check", false, "生成物と既存ファイルの差分のみ確認(書かない)")
		indexReport   = flag.String("index-report", "", "索引ダンプの出力先(省略時は出さない)")
		chars         = flag.String("chars", "", "対象キャラ code(カンマ区切り。省略時は第一波固定順)。-out と対で指定")
		outStem       = flag.String("out", "", "出力ファイル名 stem(例 000010_data_seed_moves_xxx)。-chars と対で指定")
		note          = flag.String("note", "", "生成 SQL ヘッダ 2 行目の説明(例 \"M14-03c: ryu 正規再 seed\")。-chars 指定時のみ使用")
		mode          = flag.String("mode", "moves", "生成モード(moves / derived-backfill / move-commands / aliases / game-version。M17-02 §4.6/§4.1、M20-02、M28-02a)")
		preset        = flag.String("preset", "", "-mode aliases の対象プリセット code(numeric / srk)")
		aliasReport   = flag.String("alias-report", "", "-mode aliases の内訳レポート出力先(省略時は出さない)")
		movementChars = flag.String("movement-chars", "", "-mode aliases で移動系 9 code を投入するキャラ code(カンマ区切り。省略時は -chars と同じ)")
		noInputOnly   = flag.Bool("noinput-only", false, "-mode aliases で層 C-3(何も押さずに派生する技・P-34)だけを出す(M20-06)")
	)
	flag.Parse()

	switch *mode {
	case "moves", "derived-backfill", "move-commands", "aliases", "game-version":
	default:
		return fmt.Errorf("不明な -mode %q(moves / derived-backfill / move-commands / aliases / game-version のいずれか)", *mode)
	}
	// -preset / -alias-report は aliases モード専用(単独指定の黙殺を防ぐ)。
	if *mode == "aliases" && *preset == "" {
		return fmt.Errorf("-mode aliases は -preset(numeric / srk)の指定が必須")
	}
	if *mode != "aliases" && (*preset != "" || *aliasReport != "" || *movementChars != "" || *noInputOnly) {
		return fmt.Errorf("-preset / -alias-report / -movement-chars / -noinput-only は -mode aliases 専用")
	}
	// ★-noinput-only は移動系を出さないため -movement-chars を受けない(黙殺を防ぐ)。
	if *noInputOnly && *movementChars != "" {
		return fmt.Errorf("-noinput-only は移動系 9 code を出さないため -movement-chars と併用できない")
	}
	// 新モードは出力先の既定を持たない(第一波 stem への誤出力防止)＝ -chars/-out 必須。
	if *mode != "moves" && *chars == "" {
		return fmt.Errorf("-mode %s は -chars/-out の指定が必須", *mode)
	}

	// -chars / -out は対で指定(片方のみは第一波 stem の誤上書き・別 stem への第一波出力を招くため拒否)。
	if (*chars == "") != (*outStem == "") {
		return fmt.Errorf("-chars と -out は対で指定すること(片方のみは不可)")
	}
	// -note は -chars 指定時のみ有効(単独指定の黙殺を防ぐ)。
	if *note != "" && *chars == "" {
		return fmt.Errorf("-note は -chars/-out と併せて指定すること(既定ヘッダは固定文言)")
	}

	charOrder := seedgen.FirstWaveOrder
	stem := seedgen.FirstWaveStem
	if *chars != "" {
		charOrder = strings.Split(*chars, ",")
		for i := range charOrder {
			charOrder[i] = strings.TrimSpace(charOrder[i])
		}
		stem = *outStem
	}

	rowsByChar := map[string][]seedgen.MoveRow{}
	next := 0
	for _, code := range charOrder {
		path := filepath.Join(*dataDir, code+".csv")
		rows, err := seedgen.ReadFile(path, next)
		if err != nil {
			return err
		}
		rowsByChar[code] = rows
		next += len(rows)
	}

	// aliases モードは成果物の型が違う(AliasResult)ため、ここで分岐して完結させる。
	if *mode == "aliases" {
		// ★移動系 9 code の投入先は -chars と別に指定できる(M20-02 レビュー H-2)。
		//   移動系は CSV に 1 行も無く、投入先は「その波で characters 行が新しく増えたキャラ」
		//   である(攻撃技を入れるキャラ集合とは一致しない。M14-03f は -chars 14 / -movement 12)。
		//   省略時は -chars と同じ集合にする。
		movChars := charOrder
		if *movementChars != "" {
			movChars = strings.Split(*movementChars, ",")
			for i := range movChars {
				movChars[i] = strings.TrimSpace(movChars[i])
			}
		}
		return runAliases(*preset, *aliasReport, outDirFor(stem, *migDir, migDirExplicit()), stem, *note, *check, *noInputOnly,
			charOrder, rowsByChar, movChars)
	}

	var res *seedgen.Result
	var err error
	switch {
	case *mode == "derived-backfill":
		res, err = seedgen.GenerateDerivedBackfill(charOrder, rowsByChar, seedgen.BackfillHeader(stem, *note))
	case *mode == "game-version":
		// FR702 のマーカー(M28-02a)。★moves 波と別モードにしてあるのは、
		//   マーカーを moves 波の出力へ混ぜると golden が落ちるためである
		//   (internal/seedgen/generate_m2802a.go の godoc 参照)。
		res, err = seedgen.GenerateGameVersion(charOrder, rowsByChar,
			seedgen.GameVersionHeader(stem, *note))
	case *mode == "move-commands":
		res, err = seedgen.GenerateMoveCommands(charOrder, rowsByChar, seedgen.MoveCommandsHeader(stem, *note))
	case *chars == "":
		// 既定(第一波→seedgen.FirstWaveStem): 既存挙動そのまま。byte-identical は golden テストで固定。
		res, err = seedgen.Generate(charOrder, rowsByChar, seedgen.WithFormat(formatFor(stem)))
	default:
		res, err = seedgen.GenerateWithHeader(charOrder, rowsByChar, seedgen.CustomHeader(stem, *note),
			seedgen.WithFormat(formatFor(stem)))
	}
	if err != nil {
		return err
	}

	outDir := outDirFor(stem, *migDir, migDirExplicit())
	upPath := filepath.Join(outDir, stem+".up.sql")
	downPath := filepath.Join(outDir, stem+".down.sql")

	if *check {
		diff := false
		for _, c := range []struct {
			path, want string
		}{{upPath, res.UpSQL}, {downPath, res.DownSQL}} {
			got, _ := os.ReadFile(c.path)
			if string(got) != c.want {
				fmt.Printf("DIFF: %s は生成物と一致しません\n", c.path)
				diff = true
			}
		}
		if diff {
			return fmt.Errorf("%s", diffHint(stem))
		}
		fmt.Println("OK: 生成物は既存ファイルと一致")
	} else {
		if err := os.WriteFile(upPath, []byte(res.UpSQL), 0o644); err != nil {
			return fmt.Errorf("write %s: %w", upPath, err)
		}
		if err := os.WriteFile(downPath, []byte(res.DownSQL), 0o644); err != nil {
			return fmt.Errorf("write %s: %w", downPath, err)
		}
		fmt.Printf("wrote %s\nwrote %s\n", upPath, downPath)
	}

	printSummary(*mode, res, charOrder)

	if *indexReport != "" {
		if err := os.WriteFile(*indexReport, []byte(renderIndexReport(res.Index)), 0o644); err != nil {
			return fmt.Errorf("write index report %s: %w", *indexReport, err)
		}
		fmt.Printf("wrote index report %s\n", *indexReport)
	}
	return nil
}

func printSummary(mode string, res *seedgen.Result, charOrder []string) {
	total := 0
	for _, code := range charOrder {
		total += res.Stats[code]
	}
	switch mode {
	case "derived-backfill":
		fmt.Printf("backfill 対象 code 合計 = %d / 対象キャラ数 = %d\n", total, len(res.Stats))
	case "move-commands":
		fmt.Printf("索引投入 合計 = %d / 索引キャラ数 = %d / 索引非搭載(記録)= %d / drop 移動move = %d\n",
			total, len(res.Index.CharKeys()), len(res.Index.Skipped()), len(res.Dropped))
	default:
		fmt.Printf("投入 moves 合計 = %d / 索引キャラ数 = %d / 索引非搭載(記録)= %d / drop 移動move = %d\n",
			total, len(res.Index.CharKeys()), len(res.Index.Skipped()), len(res.Dropped))
	}
}

// renderIndexReport は索引の LookupAll 一覧と Skipped 一覧を Markdown で出力する(人レビュー用)。
func renderIndexReport(ix *moveindex.Index) string {
	var b strings.Builder
	b.WriteString("# M14-03b command 索引ダンプ(seedgen 生成)\n\n")
	b.WriteString("非派生技のみ索引化。1:N は id 昇順(Lookup は先頭を返す)。\n\n")

	skipped := ix.Skipped()
	fmt.Fprintf(&b, "## 索引非搭載 %d 件\n\n", len(skipped))
	counts := map[moveindex.SkipReason]int{}
	for _, s := range skipped {
		counts[s.Reason]++
	}
	reasons := make([]string, 0, len(counts))
	for r, n := range counts {
		reasons = append(reasons, fmt.Sprintf("- %s: %d", r, n))
	}
	sort.Strings(reasons)
	b.WriteString(strings.Join(reasons, "\n"))
	b.WriteString("\n")
	return b.String()
}

// aliasRules は -preset の値から生成規則を引く(M20-02)。
var aliasRules = map[string]seedgen.AliasPresetRule{
	"numeric": seedgen.NumericRule,
	"srk":     seedgen.SRKRule,
}

// runAliases は -mode aliases の処理(preset_aliases seed マイグレの生成)。
//
// ★成果物は「17 キャラ分を入れるマイグレ」ではなく「規則」の出力である(D-181)。
// 新キャラ CSV を投入する seed 波では、本モードを再実行して新しい連番のマイグレを起こす。
func runAliases(preset, reportPath, migDir, stem, note string, check, noInputOnly bool,
	charOrder []string, rowsByChar map[string][]seedgen.MoveRow, movementChars []string) error {

	rule, ok := aliasRules[preset]
	if !ok {
		return fmt.Errorf("不明な -preset %q(numeric / srk のいずれか)", preset)
	}

	opts := []seedgen.Option{seedgen.WithFormat(formatFor(stem))}
	if noInputOnly {
		opts = append(opts, seedgen.WithNoInputOnly())
	}
	// ★ヘッダにも同じ opts を渡す(文面が生成物の中身と食い違わないようにするため)。
	res, err := seedgen.GenerateAliases(rule, charOrder, rowsByChar, movementChars,
		seedgen.AliasHeader(stem, note, opts...), opts...)
	if err != nil {
		return err
	}

	upPath := filepath.Join(migDir, stem+".up.sql")
	downPath := filepath.Join(migDir, stem+".down.sql")

	if check {
		diff := false
		for _, c := range []struct{ path, want string }{{upPath, res.UpSQL}, {downPath, res.DownSQL}} {
			got, _ := os.ReadFile(c.path)
			if string(got) != c.want {
				fmt.Printf("DIFF: %s は生成物と一致しません\n", c.path)
				diff = true
			}
		}
		if diff {
			return fmt.Errorf("%s", diffHint(stem))
		}
		fmt.Println("OK: 生成物は既存ファイルと一致")
	} else {
		if err := os.WriteFile(upPath, []byte(res.UpSQL), 0o644); err != nil {
			return fmt.Errorf("write %s: %w", upPath, err)
		}
		if err := os.WriteFile(downPath, []byte(res.DownSQL), 0o644); err != nil {
			return fmt.Errorf("write %s: %w", downPath, err)
		}
		fmt.Printf("wrote %s\nwrote %s\n", upPath, downPath)
	}

	if noInputOnly {
		fmt.Printf("preset=%s ★層 C-3 のみ投入 = %d 行(解決した全層 = %d / 投入しない = %d)\n",
			preset, len(res.Emitted), len(res.Rows), len(res.Unfilled))
	} else {
		fmt.Printf("preset=%s 投入(キャラ別)= %d / 移動系 = %d code x %d キャラ / 投入しない = %d\n",
			preset, len(res.Emitted), len(res.Movement), len(movementChars), len(res.Unfilled))
	}
	fmt.Printf("  層別: B=%d A=%d C-rush=%d C-noinput=%d\n",
		res.LayerStats[seedgen.LayerB], res.LayerStats[seedgen.LayerA],
		res.LayerStats[seedgen.LayerCRush], res.LayerStats[seedgen.LayerCNoInput])

	if reportPath != "" {
		if err := os.WriteFile(reportPath, []byte(seedgen.RenderAliasReport(rule, res)), 0o644); err != nil {
			return fmt.Errorf("write alias report %s: %w", reportPath, err)
		}
		fmt.Printf("wrote alias report %s\n", reportPath)
	}
	return nil
}
