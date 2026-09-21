package datadir

import (
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"runtime"
	"time"

	"github.com/plexiblinp/tacpendium/internal/infra/db"
)

// stagingPrefix は作業用一時ディレクトリの接頭辞。移行先と同じ親に作るので、
// 最後の rename が同一ファイルシステム内で済む(os.Rename はファイルシステムを
// またぐと EXDEV で失敗し、コピーへフォールバックしない)。
const stagingPrefix = "tacpendium.migrating-"

// stagingStaleAfter を超えて放置された作業ディレクトリは、落ちたプロセスの置き土産と
// みなして取り除く。中身はコピーだけなので、捨てても失われるものは無い。
const stagingStaleAfter = time.Hour

// Params は Migrate の入力。テストが実ディレクトリを渡せるよう、パスは明示的に受け取る。
type Params struct {
	OldDir    string
	NewDir    string
	OldDBName string
	NewDBName string
	Now       time.Time

	// CopyDB は移行元の DB を移行先へ書き出す処理。既定は VACUUM INTO。
	// ★テストが「検証が本当に効いているか」を確かめるための差し込み口である。
	// 本番経路では nil のままにする。
	CopyDB func(srcDBPath, dstDBPath string) error
}

// Result は移行の結果。ログにも API 応答にもこれ 1 つから組み立てる。
type Result struct {
	Status Status `json:"status"`
	Reason Reason `json:"reason,omitempty"`
	// Message は利用者へそのまま見せてよい 1 行。
	Message string `json:"message,omitempty"`

	OldDir     string `json:"-"`
	NewDir     string `json:"-"`
	RetiredDir string `json:"-"`

	// Mapping は「移行元の絶対パス → 移行先の絶対パス」。config.toml の書き換えに使う。
	Mapping map[string]string `json:"-"`

	Tables         []TableCount `json:"-"`
	CopiedFiles    int          `json:"-"`
	SkippedEntries []string     `json:"-"`

	ConfigRewritten bool `json:"-"`
	RetireFailed    bool `json:"-"`

	// RemnantDir / RemnantDB は失敗して止まったとき、移行先に何が残っていたかの**観測**。
	//
	// ★★主張ではなく観測にしてある ————————————————————————————————————
	// 「検証に失敗しても移行先は作られない」は、Migrate の制御フロー
	// (populateStaging の失敗は commitStaging に到達しない)から導かれる*推論*である。
	// 将来 commitStaging を先に呼ぶ形へ変えれば黙って崩れる。
	// ⇒ 失敗の出口で実際に stat して記録し、完了報告とテストが観測値を見られるようにする。
	RemnantDir bool      `json:"-"`
	RemnantDB  bool      `json:"-"`
	At         time.Time `json:"at,omitempty"`

	// Err は Status が StatusFailed / StatusBlocked のときの原因。
	Err error `json:"-"`
}

// Migrated は移行が実際に行われたかを返す。
func (r Result) Migrated() bool { return r.Status == StatusMigrated }

// Fatal は起動を止めるべきかを返す。
//
// ★★止めるのは「別プロセスが移行中」のときだけである ————————————————————
// 検証に失敗した場合(経路 d)は起動を止めない。旧ディレクトリは構成上 1 バイトも
// 動いていないので、そこを使って起動するほうが「起動できない」より安全である。
// M28-01 指示書 §2.3-2 の「何も動かさずに止まり、利用者へ理由を出す」は、
// 止めるのは移行であって、アプリではないと読んだ(利用者へ理由を出すには画面が要る)。
// ★この解釈は完了報告に明記する。
//
// 一方、別プロセスが移行中に走り出すと、勝ったほうが旧ディレクトリをリネームした後も
// 負けたほうが旧を掴んだまま書き続け、その書き込みが利用者から見えなくなる。
// ⇒ この 1 件だけは起動を止める。
func (r Result) Fatal() bool { return r.Status == StatusBlocked }

// DefaultParams は OS 既定パスから Params を組み立てる。
func DefaultParams(now time.Time) (Params, error) {
	oldDir, err := db.LegacyDataDir()
	if err != nil {
		return Params{}, err
	}
	newDir, err := db.DataDir()
	if err != nil {
		return Params{}, err
	}
	return Params{
		OldDir:    oldDir,
		NewDir:    newDir,
		OldDBName: db.LegacyDBFileName(),
		NewDBName: db.DBFileName(),
		Now:       now,
	}, nil
}

// Migrate は旧データディレクトリの中身を新データディレクトリへ複製する。
//
// 手順は「判定 → ロック → WAL 畳み込みと計数 → 複製 → 検証 → 新の確定」まで。
// **旧の退避はここでは行わない**(RetireOld を呼ぶこと)。分けてあるのは、
// 退避の前に config.toml の書き換えを挟まなければならないためである。
// 理由は RetireOld の注記を見よ。
func Migrate(p Params) Result {
	res := Result{OldDir: p.OldDir, NewDir: p.NewDir, At: p.Now}

	decision, err := Decide(p.OldDir, p.NewDir, p.OldDBName, p.NewDBName)
	if err != nil {
		res.Status = StatusFailed
		res.Err = err
		res.Message = "データディレクトリの状態を確認できませんでした: " + err.Error()
		return res
	}
	if !decision.Proceed {
		res.Status = StatusSkipped
		res.Reason = decision.Reason
		res.Message = decision.Detail
		// ★経路 b(新旧の両方が在る)だけは中身を見て、良性か危険かを分ける。
		// 判定に使えるのは行数だけであり、Decide は os.Stat のサイズしか見ていない。
		if decision.Reason == ReasonNewDBExists {
			if check, err := CheckStranded(
				filepath.Join(p.OldDir, p.OldDBName),
				filepath.Join(p.NewDir, p.NewDBName),
			); err == nil && check.Stranded {
				res.Reason = ReasonOldDataStranded
				res.Message = strandedMessage(p.OldDir, check)
			}
		}
		return res
	}

	release, held, err := acquireLock(p.OldDir)
	if err != nil {
		res.Status = StatusFailed
		res.Err = err
		res.Message = "移行ロックを取得できませんでした: " + err.Error()
		return res
	}
	if held {
		res.Status = StatusBlocked
		res.Reason = ReasonLockHeld
		res.Err = errors.New("datadir: 別のプロセスがデータ移行中です")
		res.Message = fmt.Sprintf(
			"別のプロセスがデータ移行中です。終わるまで待ってから起動し直してください。"+
				"移行が中断したまま残っている場合は %s を削除してください",
			filepath.Join(p.OldDir, lockFileName))
		return res
	}
	defer release()

	sweepStaleStaging(filepath.Dir(p.NewDir))

	staging, err := os.MkdirTemp(filepath.Dir(p.NewDir), stagingPrefix+"*")
	if err != nil {
		res.Status = StatusFailed
		res.Err = err
		res.Message = "移行用の作業ディレクトリを作れませんでした: " + err.Error()
		return res
	}
	// 以降どこで失敗しても作業ディレクトリは残さない。旧はこの時点まで無傷である。
	committed := false
	defer func() {
		if !committed {
			_ = os.RemoveAll(staging)
		}
	}()

	if failure := populateStaging(p, staging, &res); failure != nil {
		res.Status = StatusFailed
		res.Reason = ReasonVerifyFailed
		res.Err = failure
		res.Message = "データの移行を検証できなかったため、何も移動せずに中止しました: " + failure.Error()
		observeRemnant(p, &res)
		return res
	}

	if err := commitStaging(staging, p.NewDir, p.NewDBName); err != nil {
		res.Status = StatusFailed
		res.Err = err
		res.Message = "移行先へ確定できませんでした: " + err.Error()
		observeRemnant(p, &res)
		return res
	}
	committed = true
	_ = os.RemoveAll(staging)
	_ = syncDir(filepath.Dir(p.NewDir))

	// 対応表のコピー先を、作業ディレクトリから確定後のパスへ張り替える。
	remapped := make(map[string]string, len(res.Mapping))
	for src, dst := range res.Mapping {
		if rel, relErr := filepath.Rel(staging, dst); relErr == nil {
			remapped[src] = filepath.Join(p.NewDir, rel)
		}
	}
	res.Mapping = remapped

	res.Status = StatusMigrated
	res.Message = fmt.Sprintf("データの保存場所を %s から %s へ移しました", p.OldDir, p.NewDir)
	return res
}

// populateStaging は staging に移行先の中身を作り、検証まで済ませる。
// エラーを返した時点で旧ディレクトリは 1 バイトも動いていない。
func populateStaging(p Params, staging string, res *Result) error {
	oldDBPath := filepath.Join(p.OldDir, p.OldDBName)
	newDBPath := filepath.Join(staging, p.NewDBName)

	srcConn, err := openSource(oldDBPath)
	if err != nil {
		return err
	}
	if err := checkpointWAL(srcConn); err != nil {
		_ = srcConn.Close()
		return err
	}
	tables, err := userTables(srcConn)
	if err != nil {
		_ = srcConn.Close()
		return err
	}
	oldCounts, err := countTables(srcConn, tables)
	if err != nil {
		_ = srcConn.Close()
		return err
	}

	copyDB := p.CopyDB
	if copyDB == nil {
		if err := vacuumInto(srcConn, newDBPath); err != nil {
			_ = srcConn.Close()
			return err
		}
	} else {
		if err := copyDB(oldDBPath, newDBPath); err != nil {
			_ = srcConn.Close()
			return err
		}
	}
	if err := srcConn.Close(); err != nil {
		return fmt.Errorf("datadir: close source: %w", err)
	}

	// WAL / SHM が旧に残っていないことを確かめる(指示書 §2.3-3)。
	for _, suffix := range []string{"-wal", "-shm"} {
		if _, statErr := os.Stat(oldDBPath + suffix); statErr == nil {
			return fmt.Errorf("datadir: 移行元に %s が残っています。DB を閉じきれていません", filepath.Base(oldDBPath+suffix))
		}
	}

	// DB 以外のファイルを運ぶ。DB 本体と WAL/SHM とロックは対象外。
	skip := map[string]bool{
		p.OldDBName:          true,
		p.OldDBName + "-wal": true,
		p.OldDBName + "-shm": true,
		lockFileName:         true,
	}
	mapping, skipped, err := copyTree(p.OldDir, staging, skip)
	if err != nil {
		return err
	}
	if absOld, absErr := filepath.Abs(oldDBPath); absErr == nil {
		mapping[filepath.Clean(absOld)] = filepath.Clean(newDBPath)
	}
	res.Mapping = mapping
	res.CopiedFiles = len(mapping)
	res.SkippedEntries = skipped

	// 検証。ここで初めて移行先の DB を開く。
	newConn, err := db.Open(newDBPath)
	if err != nil {
		return fmt.Errorf("datadir: 移行先の DB を開けませんでした: %w", err)
	}
	if err := integrityCheck(newConn); err != nil {
		_ = newConn.Close()
		return err
	}
	srcConn2, err := openSource(oldDBPath)
	if err != nil {
		_ = newConn.Close()
		return err
	}
	verifyErr := Verify(srcConn2, newConn, oldCounts)
	_ = srcConn2.Close()
	closeErr := newConn.Close()
	if verifyErr != nil {
		return verifyErr
	}
	if closeErr != nil {
		return fmt.Errorf("datadir: close destination: %w", closeErr)
	}

	// ★db.Open は journal_mode(WAL) を当てるため、検証で -wal / -shm が作られる。
	// 閉じれば消えるはずだが、消えていなければ指示書 §2.3-3 に反するので中止する。
	for _, suffix := range []string{"-wal", "-shm"} {
		if _, statErr := os.Stat(newDBPath + suffix); statErr == nil {
			return fmt.Errorf("datadir: 移行先に %s が残りました", filepath.Base(newDBPath+suffix))
		}
	}

	res.Tables = oldCounts
	if err := syncDir(staging); err != nil {
		return fmt.Errorf("datadir: sync staging: %w", err)
	}
	return nil
}

// observeRemnant は失敗して止まったとき、移行先に何が残っているかを実測して Result へ載せる。
//
// ★消したり直したりはしない。**観測するだけ**である。
// 残骸が次回起動で正本として掴まれないことは、Decide が
// 「移行先に**空でない DB ファイル**が在るか」だけを見ることで担保されている
// (commitStaging は DB を最後に置くので、途中失敗では DB が置かれない)。
// ⇒ 本関数は、その担保が崩れたら報告とテストから見えるようにするためにある。
func observeRemnant(p Params, res *Result) {
	if fi, err := os.Stat(p.NewDir); err == nil && fi.IsDir() {
		res.RemnantDir = true
	}
	res.RemnantDB = isNonEmptyFile(filepath.Join(p.NewDir, p.NewDBName))
}

// commitStaging は作業ディレクトリの中身を移行先へ確定させる。
//
// ★★移行先が存在しない場合と、存在するが DB を持たない場合の 2 通りがある ————————
// 後者は普通に起こる。applog.Init / migration.Run / db.Open はいずれも書き込み先の
// 親ディレクトリを MkdirAll するため、移行より先にどれかが走れば
// 「ディレクトリはあるが DB は無い」状態になる。
//
// ★どちらの経路でも「DB ファイルを最後に置く」ことを守る。どちらが正本かは
// 「移行先に DB が在るか」で決まる(Decide がそう判定している)ので、
// 途中で落ちても中途半端な移行先が正本に化けない。
func commitStaging(staging, newDir, newDBName string) error {
	if _, err := os.Stat(newDir); err != nil {
		if !os.IsNotExist(err) {
			return fmt.Errorf("datadir: stat %q: %w", newDir, err)
		}
		// 移行先がまだ無い。ディレクトリごと 1 手で確定できる(同一親なので原子的)。
		if renameErr := os.Rename(staging, newDir); renameErr != nil {
			return fmt.Errorf("datadir: rename %q -> %q: %w", staging, newDir, renameErr)
		}
		return nil
	}

	entries, err := os.ReadDir(staging)
	if err != nil {
		return fmt.Errorf("datadir: read staging %q: %w", staging, err)
	}
	// DB 以外を先に運ぶ。
	for _, e := range entries {
		if e.Name() == newDBName {
			continue
		}
		src := filepath.Join(staging, e.Name())
		dst := filepath.Join(newDir, e.Name())
		if pathExists(dst) {
			return fmt.Errorf(
				"datadir: 移行先に %q が既に在ります。前回の移行が確定の途中で中断した可能性があります。"+
					"旧データは %q に残っているので、%q を消してから起動し直してください",
				dst, staging, dst)
		}
		if renameErr := os.Rename(src, dst); renameErr != nil {
			return fmt.Errorf("datadir: rename %q -> %q: %w", src, dst, renameErr)
		}
	}
	// ★DB は最後。これが置かれた瞬間に移行先が正本になる。
	dbDst := filepath.Join(newDir, newDBName)
	if pathExists(dbDst) {
		return fmt.Errorf("datadir: 移行先に %q が既に在ります。%q を消してから起動し直してください", dbDst, dbDst)
	}
	if renameErr := os.Rename(filepath.Join(staging, newDBName), dbDst); renameErr != nil {
		return fmt.Errorf("datadir: rename db -> %q: %w", dbDst, renameErr)
	}
	return syncDir(newDir)
}

// RetireOld は旧ディレクトリを <旧名>.migrated-<日付> へリネームして残す。
//
// ★★消さない。消すのは開発者の手番である(M28-01 指示書 §4-5 / D-196 境界条件 3)。
//
// ★★呼ぶ順序 —— Migrate → config.toml の書き換え → RetireOld ————————————
// 退避を config の書き換えより先にやると、書き換えに失敗したとき config.toml の
// database.path が「もう存在しない旧パス」を指したまま残る。次の起動で SQLite は
// そこへ**空の DB を新規作成**し、利用者から見るとコンボが全部消えたように見える。
// 逆順(書き換え → 退避)なら、書き換えに失敗しても新旧が両方残り、次回起動は
// 経路 b として旧を使い続けるだけで済む。
//
// ★失敗しても致命ではない。Windows ではツリー内のどれか 1 ファイルを別プロセスが
// 掴んでいるだけでリネームが失敗する。その時点で移行先は検証済みで所定の場所に在り、
// どちらが正本かは「新 DB が在ること」で決まっているので、退避が遅れても害は無い。
func RetireOld(res *Result, now time.Time) error {
	if res.Status != StatusMigrated {
		return nil
	}
	target, err := retirementPath(res.OldDir, now)
	if err != nil {
		res.RetireFailed = true
		return err
	}

	var lastErr error
	for i, backoff := range []time.Duration{0, 100 * time.Millisecond, 300 * time.Millisecond, 700 * time.Millisecond} {
		if i > 0 {
			time.Sleep(backoff)
		}
		if err := os.Rename(res.OldDir, target); err == nil {
			res.RetiredDir = target
			_ = syncDir(filepath.Dir(res.OldDir))
			return nil
		} else {
			lastErr = err
		}
	}
	res.RetireFailed = true
	return fmt.Errorf("datadir: 旧データディレクトリを %q へ退避できませんでした: %w", target, lastErr)
}

// retirementPath は衝突しない退避先の名前を返す。
// ★既存を上書きしない。上書きは「旧を消さない」に反する。
func retirementPath(oldDir string, now time.Time) (string, error) {
	base := oldDir + ".migrated-" + now.Format("20060102")
	if !pathExists(base) {
		return base, nil
	}
	withTime := base + "-" + now.Format("150405")
	if !pathExists(withTime) {
		return withTime, nil
	}
	for n := 2; n < 100; n++ {
		candidate := fmt.Sprintf("%s-%d", withTime, n)
		if !pathExists(candidate) {
			return candidate, nil
		}
	}
	return "", fmt.Errorf("datadir: 退避先の名前を決められませんでした(%s ほか)", base)
}

func pathExists(p string) bool {
	_, err := os.Lstat(p)
	return err == nil
}

// sweepStaleStaging は放置された作業ディレクトリを取り除く。
// これが無いと、中断のたびにゴミが積もる。中身はコピーだけなので捨ててよい。
func sweepStaleStaging(parent string) {
	now := time.Now()
	entries, err := os.ReadDir(parent)
	if err != nil {
		return
	}
	for _, e := range entries {
		if !e.IsDir() || !hasPrefix(e.Name(), stagingPrefix) {
			continue
		}
		info, infoErr := e.Info()
		if infoErr != nil || now.Sub(info.ModTime()) < stagingStaleAfter {
			continue
		}
		_ = os.RemoveAll(filepath.Join(parent, e.Name()))
	}
}

func hasPrefix(s, prefix string) bool {
	return len(s) >= len(prefix) && s[:len(prefix)] == prefix
}

// caseInsensitiveFS は現在の OS のパス比較が大文字小文字を無視するかを返す。
func caseInsensitiveFS() bool {
	return runtime.GOOS == "windows" || runtime.GOOS == "darwin"
}

// SamePath は 2 つのパスが同じ場所を指すかを返す。シンボリックリンクを解決し、
// Windows / macOS では大文字小文字を無視する。
//
// ★「文字列が同じか」ではなく「同じ場所か」を見る。利用者が config.toml へ書くパスは、
// アプリが組み立てる既定パスと綴りが違っても同じ場所を指しうる。
func SamePath(a, b string) bool {
	return samePath(a, b, caseInsensitiveFS())
}

// UsesLegacyDefault は解決済み DB パスが旧既定の DB パスと同じ場所を指すかを返す。
//
// ★★「database.path が空かどうか」で判定してはならない ————————————————————
// リネーム前に書かれた config.toml は database.path に旧既定の絶対パスを
// そのまま持っていることがある。空でないからと移行を飛ばすと、利用者のデータは
// 永久に旧ディレクトリに取り残され、しかも誰も気づかない。
func UsesLegacyDefault(resolvedDBPath, legacyDBPath string) bool {
	return SamePath(resolvedDBPath, legacyDBPath)
}
