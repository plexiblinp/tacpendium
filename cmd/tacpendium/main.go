// Command tacpendium は SF6 Combo Manager のサーバーバイナリのエントリポイント。
//
// 起動シーケンス:
//  1. config.toml 読込(無ければデフォルト値)
//  2. ロギング初期化(slog + lumberjack)
//  3. DB ファイルパス解決(M1-02)
//  4. マイグレーション実行(M1-02、未適用分のみ自動適用)
//  5. DB 接続オープン(M1-02、WAL/foreign_keys/busy_timeout/synchronous の PRAGMA 適用)
//  6. bind addr 決定(local→127.0.0.1、lan→0.0.0.0)
//  7. CORS 許可 Origin 構築(SUPP-001 §2.6.1、起動時固定)
//  8. Echo 起動、/api/health のみ登録
package main

import (
	"context"
	"errors"
	"fmt"
	"io"
	"io/fs"
	"log/slog"
	"net"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"time"

	"github.com/labstack/echo/v4"

	tacpendium "github.com/plexiblinp/tacpendium"
	authhandler "github.com/plexiblinp/tacpendium/internal/api/auth"
	charhandler "github.com/plexiblinp/tacpendium/internal/api/character"
	combohandler "github.com/plexiblinp/tacpendium/internal/api/combo"
	comboiohandler "github.com/plexiblinp/tacpendium/internal/api/comboio"
	confighandler "github.com/plexiblinp/tacpendium/internal/api/config"
	debughandler "github.com/plexiblinp/tacpendium/internal/api/debug"
	healthapi "github.com/plexiblinp/tacpendium/internal/api/health"
	inputresolvehandler "github.com/plexiblinp/tacpendium/internal/api/inputresolve"
	intakehandler "github.com/plexiblinp/tacpendium/internal/api/intake"
	mw "github.com/plexiblinp/tacpendium/internal/api/middleware"
	movehandler "github.com/plexiblinp/tacpendium/internal/api/move"
	noticehandler "github.com/plexiblinp/tacpendium/internal/api/notice"
	presethandler "github.com/plexiblinp/tacpendium/internal/api/preset"
	punishhandler "github.com/plexiblinp/tacpendium/internal/api/punish"
	setplayhandler "github.com/plexiblinp/tacpendium/internal/api/setplay"
	setuphandler "github.com/plexiblinp/tacpendium/internal/api/setup"
	staticapi "github.com/plexiblinp/tacpendium/internal/api/static"
	taghandler "github.com/plexiblinp/tacpendium/internal/api/tag"
	userhandler "github.com/plexiblinp/tacpendium/internal/api/user"
	"github.com/plexiblinp/tacpendium/internal/config"
	"github.com/plexiblinp/tacpendium/internal/desktop"
	"github.com/plexiblinp/tacpendium/internal/infra/datadir"
	dbinfra "github.com/plexiblinp/tacpendium/internal/infra/db"
	applog "github.com/plexiblinp/tacpendium/internal/infra/log"
	"github.com/plexiblinp/tacpendium/internal/infra/migration"
	"github.com/plexiblinp/tacpendium/internal/infra/netutil"
	"github.com/plexiblinp/tacpendium/internal/model"
	charrepo "github.com/plexiblinp/tacpendium/internal/repository/character"
	comborepo "github.com/plexiblinp/tacpendium/internal/repository/combo"
	gamerepo "github.com/plexiblinp/tacpendium/internal/repository/game"
	moverepo "github.com/plexiblinp/tacpendium/internal/repository/move"
	movecommandrepo "github.com/plexiblinp/tacpendium/internal/repository/movecommand"
	presetrepo "github.com/plexiblinp/tacpendium/internal/repository/preset"
	punishrepo "github.com/plexiblinp/tacpendium/internal/repository/punish"
	setplayrepo "github.com/plexiblinp/tacpendium/internal/repository/setplay"
	setuprepo "github.com/plexiblinp/tacpendium/internal/repository/setup"
	tagrepo "github.com/plexiblinp/tacpendium/internal/repository/tag"
	userrepo "github.com/plexiblinp/tacpendium/internal/repository/user"
	authsvc "github.com/plexiblinp/tacpendium/internal/service/auth"
	charsvc "github.com/plexiblinp/tacpendium/internal/service/character"
	combosvc "github.com/plexiblinp/tacpendium/internal/service/combo"
	comboiosvc "github.com/plexiblinp/tacpendium/internal/service/comboio"
	configsvc "github.com/plexiblinp/tacpendium/internal/service/config"
	inputresolvesvc "github.com/plexiblinp/tacpendium/internal/service/inputresolve"
	intakesvc "github.com/plexiblinp/tacpendium/internal/service/intake"
	movesvc "github.com/plexiblinp/tacpendium/internal/service/move"
	"github.com/plexiblinp/tacpendium/internal/service/notation"
	presetsvc "github.com/plexiblinp/tacpendium/internal/service/preset"
	punishfindersvc "github.com/plexiblinp/tacpendium/internal/service/punishfinder"
	punishlistsvc "github.com/plexiblinp/tacpendium/internal/service/punishlist"
	setplaysvc "github.com/plexiblinp/tacpendium/internal/service/setplay"
	setupsvc "github.com/plexiblinp/tacpendium/internal/service/setup"
	tagsvc "github.com/plexiblinp/tacpendium/internal/service/tag"
	usersvc "github.com/plexiblinp/tacpendium/internal/service/user"
	"github.com/plexiblinp/tacpendium/internal/service/validation"
)

// defaultConfigPath はアプリ実行ディレクトリ直下の設定ファイル名(SUPP-001 §5.8)。
const defaultConfigPath = "config.toml"

// resolveConfigPath は読み込む設定ファイルのパスを決める。
//
// TACPENDIUM_CONFIG_PATH が設定されていればその値、未設定なら
// config.AppBaseDir() 直下の defaultConfigPath。
//
// ★★M34-02 段 1 で基準を一意にした ————————————————————————————————————————
// 以前は "config.toml" をそのまま返しており、プロセスのカレントディレクトリ基準で
// 解決されていた。⇒ 常駐化して起動経路が増えると(ダブルクリック / ショートカットの
// 「作業フォルダ」/ 将来のスタートアップ登録)設定ファイルが見つからなくなり、
// config.Load は不在をエラーにせず既定値で続行するため、利用者の設定(ポート /
// LAN 共有モード / パスワード)が黙って無視される。黒窓を消すと気づく手掛かりも無い。
// ★設計書は元から「アプリ実行ディレクトリ直下」と書いている(SUPP-001 §5.8 /
// DES-002 §7)。⇒ 本変更は実装を設計へ寄せたものであり、規定の変更ではない。
// ★開発時(go run / go test)は AppBaseDir() がカレントディレクトリを返すため、
// リポジトリ直下の config.toml を読む従来の挙動と一致する。
func resolveConfigPath() string {
	if v, ok := os.LookupEnv(config.EnvConfigPath); ok && strings.TrimSpace(v) != "" {
		return v
	}
	return config.ResolveAppPath(defaultConfigPath)
}

// configFileMissing は設定ファイルが読み込み前の時点で不在かを返す。
//
// ★★不在は「知らせるが止めない」(M34-02 段 1 / 指示書 §2.1.2-4) ————————————
// 初回起動では不在が正常であり、ウィザードの isInitialized も不在を前提にしている。
// ⇒ 従来どおり既定値で続行する(DES-002 の規定は変えない)。
// ★ただし黙らせない —— 解決後のパス付きで起動ログへ 1 行残す。段 1 でログの出先が
// 一意になったので、この 1 行は必ず同じ場所に出る。
func configFileMissing(path string) bool {
	_, err := os.Stat(path)
	return errors.Is(err, fs.ErrNotExist)
}

// prepareDataDir は M28-01(正式名リネーム)にともなう既定データディレクトリの移行を行い、
// 移行結果・(必要なら読み直した)設定・実際に開くべき DB パスを返す。
//
// ★★呼ぶ順序を main 側に置いてある ————————————————————————————————————
// 正しい順序は「複製と検証(datadir.Migrate)→ config.toml の書き換え → 旧の退避」であり、
// internal/infra/datadir の中で完結させると infra が config に依存してしまう。
// ⇒ 順序の責務だけを本関数が持つ。理由は datadir.RetireOld の注記を見よ。
func prepareDataDir(configPath string, cfg *config.Config) (datadir.Result, *config.Config, string, error) {
	params, err := datadir.DefaultParams(time.Now())
	if err != nil {
		// 既定パスを解決できない環境では移行そのものが成立しない。起動は続ける。
		resolved, resolveErr := dbinfra.ResolveDBPath(cfg.Database.Path)
		if resolveErr != nil {
			return datadir.Result{}, cfg, "", fmt.Errorf("resolve db path: %w", resolveErr)
		}
		return datadir.Result{Status: datadir.StatusSkipped}, cfg, resolved, nil
	}
	return prepareDataDirWith(configPath, cfg, params)
}

// prepareDataDirWith は prepareDataDir の本体。移行の入力(Params)を引数で受け取る。
//
// ★分けてあるのはテストのためである。prepareDataDir は OS 既定から Params を組み立てる
// ため、検証を落とす差し込み口(Params.CopyDB)を外から渡せない。本サブで最も順序が効く
// 「複製 → 検証 → config の書き換え → 旧の退避」を、実際に失敗させて確かめられるようにする。
// ★本番の挙動は prepareDataDir 経由と同一である。
func prepareDataDirWith(configPath string, cfg *config.Config, params datadir.Params) (datadir.Result, *config.Config, string, error) {
	legacyDBPath := filepath.Join(params.OldDir, params.OldDBName)
	newDBPath := filepath.Join(params.NewDir, params.NewDBName)

	resolved, err := dbinfra.ResolveDBPath(cfg.Database.Path)
	if err != nil {
		return datadir.Result{}, cfg, "", fmt.Errorf("resolve db path: %w", err)
	}

	// ★★判定を「database.path が空か」でやらない ————————————————————————
	// (1) リネーム前に書かれた config.toml は旧既定の絶対パスをそのまま持ちうる。
	// (2) ★README.txt は新既定のパスを OS 別に印字している。「保存場所を明示しておこう」と
	//     それを書き写す利用者がいる。**移行が要るのはまさにその人たちである。**
	//     明示されているだけで飛ばすと、移行もせず告知も出さないまま
	//     db.Open がそこへ空の DB を作り、旧のデータが黙って取り残される。
	// ⇒ 飛ばすのは「明示先が旧既定でも新既定でもない」ときだけにする。
	//   その場合は利用者が意図して別の場所を使っているので、黙って従う。
	if cfg.Database.Path != "" &&
		!datadir.SamePath(resolved, legacyDBPath) &&
		!datadir.SamePath(resolved, newDBPath) {
		return datadir.Result{Status: datadir.StatusSkipped, Reason: datadir.ReasonExplicitDBPath}, cfg, resolved, nil
	}

	res := datadir.Migrate(params)
	if res.Fatal() {
		// 別プロセスが移行中。ここだけは起動を止める。2 系統から旧を書くと片方の
		// 書き込みが利用者から見えなくなるため(datadir.Result.Fatal の注記)。
		fmt.Fprintln(os.Stderr, res.Message)
		return res, cfg, "", res.Err
	}

	if res.Migrated() {
		changed, rewriteErr := config.RewriteRelocatedPaths(configPath, res.Mapping, params.OldDir, params.NewDir)
		switch {
		case rewriteErr != nil:
			// ★退避しない。config が旧を指したまま旧が消えると、次の起動で
			// SQLite が空の DB を作り、利用者からはデータが消えたように見える。
			// 新旧を両方残しておけば、次の起動は「両方在る」経路で旧を使い続ける。
			res.RetireFailed = true
			res.Message += "(設定ファイルのパスを更新できなかったため、旧データはそのまま残しました: " + rewriteErr.Error() + ")"
		default:
			res.ConfigRewritten = changed
			if changed {
				reloaded, loadErr := config.Load(configPath)
				if loadErr != nil {
					return res, cfg, "", fmt.Errorf("reload config after data dir migration: %w", loadErr)
				}
				cfg = reloaded
			}
			// ★★退避の前に「これから開く DB が移行先に実在する」ことを確かめる。
			// 書き換えが 0 件で済むのが正しい場合(database.path が空)もあれば、
			// 綴りの食い違いで空振りした場合もあり、changed だけでは区別できない。
			// ⇒ 綴りを網羅しにいかず、開く先の実在で判定する(datadir.ReadyToRetire)。
			afterPath, resolveErr := dbinfra.ResolveDBPath(cfg.Database.Path)
			if resolveErr != nil {
				afterPath = ""
			}
			if ok, reason := datadir.ReadyToRetire(afterPath, params.OldDir); !ok {
				res.RetireFailed = true
				res.Message += "(" + reason + "ため、旧データはそのまま残しました)"
			} else if retireErr := datadir.RetireOld(&res, time.Now()); retireErr != nil {
				// 退避の失敗は致命ではない。移行先は検証済みで所定の場所に在る。
				res.Message += "(旧データディレクトリの退避に失敗しました: " + retireErr.Error() + ")"
			}
		}
	}

	dbPath := resolved
	switch {
	case res.Migrated():
		if p, resolveErr := dbinfra.ResolveDBPath(cfg.Database.Path); resolveErr == nil {
			dbPath = p
		}
	case res.Status == datadir.StatusFailed:
		// 検証に失敗した。旧は構成上 1 バイトも動いていないので、そちらで起動する。
		dbPath = legacyDBPath
	}

	// 告知は「実際に使っているデータディレクトリ」の直下へ置く。
	if n, ok := datadir.NoticeFor(res); ok {
		if writeErr := datadir.UpsertNotice(filepath.Dir(dbPath), n); writeErr != nil {
			fmt.Fprintf(os.Stderr, "warn: 移行の告知を保存できませんでした: %v\n", writeErr)
		}
	}
	return res, cfg, dbPath, nil
}

// logDataDirMigration は移行の結果を起動ログへ 1 度だけ出す(M28-01 指示書 §2.3-5)。
// ★移行が起きていないときは何も出さない。毎回出すのは過剰である。
func logDataDirMigration(ctx context.Context, res datadir.Result) {
	switch res.Status {
	case datadir.StatusMigrated:
		slog.InfoContext(ctx, "data directory migrated",
			slog.String("from", res.OldDir),
			slog.String("to", res.NewDir),
			slog.String("retired_to", res.RetiredDir),
			slog.Int("copied_files", res.CopiedFiles),
			slog.Bool("config_rewritten", res.ConfigRewritten),
			slog.Bool("retire_failed", res.RetireFailed))
	case datadir.StatusFailed:
		slog.ErrorContext(ctx, "data directory migration aborted; nothing was moved",
			slog.String("from", res.OldDir),
			slog.String("reason", string(res.Reason)),
			slog.String("err", errText(res.Err)))
	case datadir.StatusSkipped:
		if res.Reason == datadir.ReasonNewDBExists {
			slog.WarnContext(ctx, "legacy data directory still present",
				slog.String("legacy", res.OldDir),
				slog.String("current", res.NewDir))
		}
	}
}

func errText(err error) string {
	if err == nil {
		return ""
	}
	return err.Error()
}

func main() {
	if err := run(); err != nil {
		// ★M34-02 段 4: 致命エラーは必ず利用者へ見せる。-H=windowsgui では
		// 標準エラーの接続先が無いため、stderr だけでは「何も起きない」になる。
		reportFatal(err)
		os.Exit(1)
	}
}

func run() error {
	// ★引数の検査を最初に置く(M34-02 段 2)。設定の読込より前で落とす。
	if err := parseArgs(os.Args[1:]); err != nil {
		return err
	}

	configPath := resolveConfigPath()
	// ★致命エラーの本文へ載せるために控える(reportFatal が読む)。
	configPathForReport = configPath
	// ★Load より前に測る。Load は不在を飲み込んで既定値を返すため、後からは判らない。
	configMissing := configFileMissing(configPath)
	cfg, err := config.Load(configPath)
	if err != nil {
		// ★設定ファイルを直せば直る失敗である。⇒ 目印を付けて reportFatal へ渡す。
		return asConfigProblem(fmt.Errorf("load config: %w", err))
	}

	// ★★M34-02 段 6: 二重起動の判別(M34-overview §4.4)。
	// データディレクトリの移行やロガーの初期化より前に置く ⇒ 後から起動した
	// プロセスは何にも触らずに退く。
	// ★★着手前は L-04 のポート探索が働いて 2 つ目が別ポートで上がり、同じ DB を
	// 2 プロセスで開いていた。黒窓が無いと「もう起動している」ことに気づけないため、
	// 常駐化でこの経路を踏む頻度が上がる。
	if running, existing := detectRunningInstance(cfg.Server.Port); running {
		slog.Info("another instance is already running; opening its window instead",
			slog.String("url", existing))
		openExistingInstance(existing)
		return nil
	}

	// M28-01: 正式名リネームにともなう既定データディレクトリの移行。
	// ★applog.Init より前に置く。ログ出力先が旧データディレクトリ配下の絶対パスで
	// ありうるため、ロガーが旧を掴む前に済ませる必要がある。
	// ⇒ この段ではログを出せないので、結果を受け取ってロガー初期化後に出す。
	dataMigration, cfg, dbPath, err := prepareDataDir(configPath, cfg)
	if err != nil {
		return err
	}

	if err := applog.Init(&cfg.Logging); err != nil {
		// ★level のタイポ・logging.file が空・出先を作れない、のいずれも
		// [logging] を直せば起動できる。
		return asConfigProblem(fmt.Errorf("init log: %w", err))
	}

	ctx := context.Background()
	logDataDirMigration(ctx, dataMigration)

	if configMissing {
		slog.WarnContext(ctx, "config file not found; started with built-in defaults",
			slog.String("path", configPath))
	}

	slog.InfoContext(ctx, "db path resolved", slog.String("path", dbPath))

	if err := migration.Run(ctx, dbPath, tacpendium.MigrationsFS); err != nil {
		// ロガーは初期化済みなのでログファイルにも記録する(レビュー指摘: 失敗時の
		// 痕跡が標準エラー出力にしか残らない問題への対処)。
		slog.ErrorContext(ctx, "migration failed", slog.String("err", err.Error()))
		return fmt.Errorf("migration: %w", err)
	}

	sqlDB, err := dbinfra.Open(dbPath)
	if err != nil {
		return fmt.Errorf("open db: %w", err)
	}
	defer func() {
		if closeErr := sqlDB.Close(); closeErr != nil {
			slog.WarnContext(ctx, "db close", slog.String("err", closeErr.Error()))
		}
	}()
	// M1-03: コンボ CRUD のレイヤーを DI 配線する。
	repo := comborepo.New(sqlDB)
	validDeps := validation.Dependencies{
		CharacterRepo: &combosvc.CharacterAdapter{DB: sqlDB},
		MoveRepo:      &combosvc.MoveAdapter{DB: sqlDB},
		ComboRepo:     &combosvc.ComboDuplicateAdapter{Repo: repo},
	}
	// M1-04: notation サービスと preset リポジトリを DI 配線。
	presetRepo := presetrepo.New(sqlDB)
	sRepo := setuprepo.New(sqlDB)
	notationSvc := notation.New(sqlDB, presetRepo, repo, sRepo)
	// M20-05 §4.3-2/-3: config の [defaults] preset_id が実在しないプリセットを
	// 指している状態を起動時に検出し、組み込みの既定へ倒してログへ残す(D-358)。起動は止めない。
	//
	// ★§4.2 の追随と不可分である——読み出しキーを config へ追随させたため、実在しない ID を
	// 指したままだとレシピ行が黙って消える(キー不在は空文字を返しエラーにならない)。
	// ★config.toml へは書き戻さない(推測: env 上書き値の焼き付き followup
	// `config-toml-write-back-env-asymmetry` に触れないため。倒すのはメモリ上の値だけ)。
	if err := ensureDefaultPresetExists(ctx, presetRepo, cfg); err != nil {
		return fmt.Errorf("resolve default preset: %w", err)
	}
	// M20-05 §4.2-1: 既定プリセット ID の出どころはここ 1 か所である(D-360)。
	// 各サービスへは固定値ではなく本クロージャを注入する——固定値で持つと config を
	// 変えても表示が追随しない(D-313)。ensureDefaultPresetExists と PUT /api/config の
	// 実在検査により、本クロージャは常に実在する ID を返す。
	defaultPresetID := func() int64 { return cfg.Defaults.PresetID }
	// M20-04: プリセットのサービス層を DI 配線(CRUD・保護・上限検査・
	// コピー時のエイリアス実体化・削除時の子行削除)。
	// 第 3 引数は config の [defaults] preset_id の現在値を読むクロージャ。
	// 削除対象が config から参照されている場合に拒否するために要る(D-313)。
	// configsvc.Update は同じ *config.Config を書き換えるため、常に最新値が読める。
	// M20-05: 第 4 引数の notation サービスが再計算の配線先(§4.4)。
	presetService := presetsvc.New(sqlDB, presetRepo, defaultPresetID, notationSvc)
	presetHandler := presethandler.NewHandler(
		presetService,
		// M24-08 第 2 部 B: recipe_cache の作り直し。api 層へ notation の直接依存を
		// 増やさないよう、config サービスと同じく関数で渡す。
		func(ctx context.Context, presetID int64) error {
			return notationSvc.RecomputePresetCache(ctx, presetID)
		},
	)
	// M1-06: 技マスタ読み取り API(技セレクタ用)/ M9-03: 編集・ラッシュ版生成 API(FR703)
	moveRepo := moverepo.New(sqlDB)
	moveHandler := movehandler.NewHandler(moveRepo, movesvc.New(moveRepo))
	// M17-02: 段階2 解決表配信 API(command 索引→畳み済み解決表)の DI 配線
	inputResolveHandler := inputresolvehandler.NewHandler(inputresolvesvc.New(movecommandrepo.New(sqlDB)))
	// M17-04: 「他から引っ越し」API(候補トークン列 → move_code の厳密照合＋取込 CSV 生成)の DI 配線。
	// 索引 IF は段階2 と共通の movecommandrepo だが、取込側はフォールバックを持たない別の消費者。
	intakeHandler := intakehandler.NewHandler(intakesvc.New(movecommandrepo.New(sqlDB), presetRepo))
	// M3-01: タグ CRUD API の DI 配線
	tagRepo := tagrepo.New(sqlDB)
	tagService := tagsvc.New(tagRepo)
	tagHandler := taghandler.NewHandler(tagService)

	// M22-02: 利用者の面。★認証ではない——「誰として操作するか」の札である
	// (DES-002 §8)。利用者を作ると既定タグ(mycombo_status の 3 件)も同時に生成する。
	userService := usersvc.New(sqlDB, userrepo.New(sqlDB), tagRepo)
	userHandler := userhandler.NewHandler(userService)
	// M3-04: キャラクターマスタ読み取り API の DI 配線
	charRepo := charrepo.New(sqlDB)
	charHandler := charhandler.NewHandler(charsvc.New(charRepo))
	// M4-01: セットプレイ CRUD API の DI 配線
	setupValidDeps := setupsvc.ValidationDeps{
		CharacterRepo: &combosvc.CharacterAdapter{DB: sqlDB},
		MoveRepo:      &combosvc.MoveAdapter{DB: sqlDB},
		// ★★M24-13 §4.6: VAL-S04 の判定を書き込み tx の内側で行うためアダプタを挟む。
		//   sRepo を直に渡すと txScopedValidDeps が tx を束ねられず、判定が
		//   *sql.DB 直読みへ落ちる(その場合は起動後に WARN が出る)。
		SetupRepo: &setupsvc.SetupDuplicateAdapter{Repo: sRepo},
	}
	setupService := setupsvc.New(sqlDB, sRepo, setupValidDeps, notationSvc, repo, defaultPresetID)
	setupHandler := setuphandler.NewHandler(setupService)
	// M19-01: セットプレイ自動提案(combo=KA→提案。副作用なし)。
	// comboReader=repo(combo), moveReader=setplayMoveRepo(is_derived 参照), dupChecker=sRepo(VAL-S04 基準)。
	setplayMoveRepo := setplayrepo.New(sqlDB)
	setplayService := setplaysvc.NewService(repo, setplayMoveRepo, sRepo)
	setplayHandler := setplayhandler.NewHandler(setplayService)
	// M4-04: comboService は setupService に依存（同時登録用）
	comboService := combosvc.New(sqlDB, repo, validDeps, notationSvc, setupService, defaultPresetID)
	// M4-02: comboHandler は setupService の DI 後に構築(setup 一覧埋め込み対応、案 B1)
	comboHandler := combohandler.NewHandler(comboService, notationSvc, setupService)
	// M13-01: コンボ CSV export/import API の DI 配線(comboService/setupService/tagService 依存)
	comboIOService := comboiosvc.New(sqlDB, repo, charRepo, moveRepo, comboService, setupService, tagService)
	comboIOHandler := comboiohandler.NewHandler(comboIOService)
	// M18-02: 確定反撃サーチ API の DI 配線(走査規則は BE service に一元化・DES-002 §4.2)。
	// 孫コンボの逆引きは既存 comborepo(repo)の List(ListFilter.StarterMoveIDs)を流用する。
	// M18-03a: マイリスト(使う画面)は走査ではなく取得のため別サービス。リポジトリは共用する。
	punishRepo := punishrepo.New(sqlDB)
	punishHandler := punishhandler.NewHandler(
		punishfindersvc.New(punishRepo, repo, defaultPresetID),
		punishlistsvc.New(punishRepo, defaultPresetID),
	)

	// L-04: ポート競合フォールバック。既定ポートが使用中なら次の空きポートを連番探索する
	// (DES-002 §3.3)。先にリスナを確保してから bind アドレス・CORS Origin を実ポートで構築する。
	host := determineBindHost(cfg.Server.Mode)
	listener, actualPort, err := netutil.ListenAvailable(host, cfg.Server.Port, netutil.DefaultPortScanRange)
	if err != nil {
		return fmt.Errorf("listen: %w", err)
	}
	if actualPort != cfg.Server.Port {
		slog.Warn("configured port is in use; using fallback port",
			slog.Int("configured_port", cfg.Server.Port),
			slog.Int("actual_port", actualPort),
		)
		cfg.Server.Port = actualPort
		// 採用ポートを config.toml に記録(案内用途)。記録失敗は起動を妨げない。
		// ディスク内容を起点に port のみ更新し、env override(ログレベル等)は焼き付けない。
		// TACPENDIUM_PORT による一時上書き中(E2E 等)は、フォールバック先を config.toml に
		// 書くと通常運用のポートを汚すため記録しない。
		if _, portOverridden := os.LookupEnv(config.EnvPort); portOverridden {
			slog.Warn("port came from env override; skip persisting fallback port")
		} else if saveErr := config.PersistPort(configPath, actualPort); saveErr != nil {
			slog.Warn("failed to persist fallback port to config", slog.String("err", saveErr.Error()))
		}
	}

	bindAddr := determineBindAddr(cfg.Server.Mode, cfg.Server.Port)

	allowedOrigins, err := buildAllowedOrigins(cfg.Server.Mode, cfg.Server.Port)
	if err != nil {
		// ★lan モードで LAN IP が見つからない場合。⇒ mode を local へ戻せば起動できる
		// (メッセージ自身が既にそう案内している)。
		return asConfigProblem(fmt.Errorf("build allowed origins: %w", err))
	}

	slog.Info("server starting",
		slog.String("version", healthapi.Version),
		slog.String("mode", cfg.Server.Mode),
		slog.String("addr", bindAddr),
		slog.Int("port", actualPort),
		slog.Any("allowed_origins", allowedOrigins),
	)

	// M7-06: lan モードではスマホ等 LAN 端末からのアクセス手順を起動時に案内する。
	if cfg.Server.Mode == "lan" {
		logLANAccessGuide(actualPort)
	}

	// M6-01: 設定 API のサービス生成。
	// M20-05 §4.3-1 / §4.2-3: 実在検査と、既定プリセット切替時の再計算を関数で注入する。
	// ★config サービスへ preset ドメイン・DB・notation への直接依存を持ち込まない
	// (M20-04 が「config へ DB 依存を持たせる変更になる」として止めた形を、依存の向きを
	// 増やさずに引き取る＝followup `preset-config-preset-id-existence`)。
	// ★M22-01: 認証ミドルウェアが [security] を読むため、ルート登録より前へ移した
	// (生成位置が変わっただけで、引数・注入する関数はいずれも不変である)。
	configService := configsvc.NewService(
		cfg, configPath, netutil.SelectPrimaryLANIP,
		func(presetID int64) (bool, error) {
			if _, findErr := presetRepo.FindPresetByID(ctx, presetID); findErr != nil {
				if errors.Is(findErr, presetrepo.ErrNotFound) {
					return false, nil
				}
				return false, findErr
			}
			return true, nil
		},
		func(presetID int64) error { return notationSvc.RecomputePresetCache(ctx, presetID) },
	)

	// M22-01: 簡易パスワードの照合とセッション管理。[security] は config サービス経由で
	// 読む(直接 cfg を読むと PUT /api/config の書き込みと競合する)。
	authService := authsvc.NewService(configService)
	// ★不整合な [security](password_enabled = true かつパスワード未設定)は
	// 起動時に 1 度だけ警告する。設定はここでしか読まないため、これで検出しきる。
	authService.WarnIfMisconfigured()

	e := echo.New()
	e.HideBanner = true
	e.HidePort = true

	e.Use(mw.RequestID())
	e.Use(mw.Logger())
	e.Use(mw.CORS(allowedOrigins))
	// M22-01 §4.5-3: 認証は CORS の後ろに置く。CORS は OPTIONS を 204 で早期に返して
	// next を呼ばないため、後ろなら プリフライトが 401 にならない。
	// ★password_enabled = false のときは素通しであり、既存 3 本の構成・順序は不変。
	e.Use(mw.Auth(authService))
	// M22-02: 選択中の利用者(X-User-Id)を解決して文脈へ載せる。
	// ★認証の後ろに置く。未認証の要求はここまで来ない。
	// ★ヘッダが無ければ users.id の最小値へ倒すため、送らない呼び出し元の
	//   挙動は変わらない(既存環境では常に 1)。
	e.Use(mw.UserContext(userService))

	e.GET("/api/health", healthapi.Handler)

	// M1-03: コンボ CRUD ルート登録
	apiGroup := e.Group("/api")
	combohandler.RegisterRoutes(apiGroup, comboHandler)
	// M1-04: プリセット読み取りルート登録
	presethandler.RegisterRoutes(apiGroup, presetHandler)
	// M1-06: 技マスタ読み取りルート登録
	movehandler.RegisterRoutes(apiGroup, moveHandler)
	// M3-01: タグ CRUD ルート登録
	taghandler.RegisterRoutes(apiGroup, tagHandler)
	// M22-02: 利用者の一覧・作成・改名(削除は作らない)
	userhandler.RegisterRoutes(apiGroup, userHandler)
	// M3-04: キャラクターマスタ読み取りルート登録
	charhandler.RegisterRoutes(apiGroup, charHandler)
	// M17-02: 段階2 解決表配信ルート登録(GET /api/characters/:characterId/command-index)
	inputresolvehandler.RegisterRoutes(apiGroup, inputResolveHandler)
	// M17-04: 「他から引っ越し」のルート登録(POST /api/intake/resolve, POST /api/intake/csv)
	intakehandler.RegisterRoutes(apiGroup, intakeHandler)
	// M18-02: 確定反撃サーチルート登録(GET /api/punish-finder, POST/DELETE /api/combo-punish-*)
	punishhandler.RegisterRoutes(apiGroup, punishHandler)
	// M13-01: コンボ CSV export/import ルート登録(GET /api/export/csv, POST /api/import/csv[/preview])
	comboiohandler.RegisterRoutes(apiGroup, comboIOHandler)
	// M4-01: セットプレイ CRUD ルート登録
	setuphandler.RegisterRoutes(apiGroup, setupHandler)
	setplayhandler.RegisterRoutes(apiGroup, setplayHandler)
	// M6-01: 設定 API ルート登録(サービスの生成は echo 生成より前へ移した)
	configHandler := confighandler.NewHandler(configService)
	confighandler.RegisterRoutes(apiGroup, configHandler)
	// M22-01: 認証 API ルート登録(ログイン・ログアウト・状態・パスワード設定)。
	// ★4 本とも認証ミドルウェアの保護対象から外れている(internal/api/auth/routes.go)。
	authhandler.RegisterRoutes(apiGroup, authhandler.NewHandler(authService))

	// M28-01: データディレクトリ移行の告知(GET/POST /api/notices/data-migration[/ack])。
	// ★/api グループ配下＝認証の保護対象。素通しの /api/health には載せない
	// (lan モードで未認証の相手へ絶対パスを渡さないため)。
	noticehandler.RegisterRoutes(apiGroup, noticehandler.NewHandler(filepath.Dir(dbPath)))

	// M28-02c: ゲーム更新の告知(GET /api/notices/game-update, POST .../postpone)。
	// ★件数は comborepo.Count を通す —— List と同じ WHERE 組み立てを共有するため、
	//   「件数」と「専用画面に出る行」が別々の述語で決まる状態を作れない。
	// ★延期の保存先は移行告知と同じ filepath.Dir(dbPath) 直下のファイルである
	//   (マイグレもブラウザストレージ台帳も消費しない = CHANGE-162 §2.3)。
	gameRepo := gamerepo.New(sqlDB)
	noticehandler.RegisterGameUpdateRoutes(apiGroup, noticehandler.NewGameUpdateHandler(
		filepath.Dir(dbPath),
		func(c echo.Context) (int, error) {
			affected := true
			return repo.Count(c.Request().Context(), comborepo.ListFilter{
				AffectedByGameUpdate: &affected,
			})
		},
		func(c echo.Context) (string, error) {
			return gameRepo.CurrentDataVersion(c.Request().Context(), gamerepo.CodeSF6)
		},
	))

	// M1-07: デバッグ API ルート登録(ビルドタグ debug 時のみ有効、本番は no-op)
	debugHandler := debughandler.NewHandler(sqlDB, filepath.Dir(dbPath))
	debughandler.RegisterRoutes(apiGroup, debugHandler)

	// M7-06: フロント embed 時のみ SPA 静的配信(未知パス→index.html フォールバック)を
	// 登録する。API ルート登録の後に登録し、catch-all より具体ルートを優先させる。
	// 配布(-tags=embed_web)ビルドでのみ WebEmbedded=true。dev は Vite + proxy で
	// フロントを配信するため登録しない(dev/embed の二系統両立)。
	if tacpendium.WebEmbedded {
		webFS, fsErr := tacpendium.WebFS()
		if fsErr != nil {
			return fmt.Errorf("web fs: %w", fsErr)
		}
		staticapi.Register(e, webFS)

		// A-1: 起動時のユーザー向け案内を stdout にも出す(ログ level 非依存)。
		// slog の file ログ(logLANAccessGuide / launchBrowser)は記録として維持しつつ、
		// 利用者が exe のコンソールだけでアクセス URL を把握できるようにする(NFR303/304)。
		var lanIPs []net.IP
		if cfg.Server.Mode == "lan" {
			lanIPs, _ = netutil.ListPrivateIPv4()
		}
		printStartupNotice(os.Stdout, cfg.Server.Mode, actualPort, lanIPs, trayResident())

		launchBrowser(actualPort)
	}

	// L-04: 競合探索で確保済みのリスナを使う(Echo は e.Listener が非 nil なら新規生成しない)。
	e.Listener = listener

	// M34-02 段 3: 通知領域への常駐。★HTTP サーバを goroutine へ、トレイのメッセージ
	// ループを main の goroutine で回す(RunTray はブロックし、メインスレッドを握る
	// goroutine から呼ぶ契約である)。
	// ★トレイの無い OS(Linux/macOS)では RunTray が ErrUnsupported を返し、従来どおり
	// サーバの終了まで待つ形になる —— 致命エラーにしない(SUPP-001 §5.2 の注記)。
	appURL := localAppURL(actualPort)
	// ★「実際に読んでいる config.toml」の置き場を開く(2026-09-12 開発者要求)。
	// ⇒ TACPENDIUM_CONFIG_PATH で差し替えている場合はそちら側になる。
	// ★env が相対値のときも ResolveAppPath を通して絶対にする(ファイラは
	// カレントディレクトリを共有しないため、相対のまま渡すと別の場所が開く)。
	configDir := filepath.Dir(config.ResolveAppPath(configPath))
	logDir := filepath.Dir(config.ResolveAppPath(cfg.Logging.File))
	dbDir := filepath.Dir(dbPath)
	return runResident(e, bindAddr, appURL, desktopTray{}, notifyProblem, func(quit func()) desktop.TrayMenu {
		return buildTrayMenu(trayDeps{
			AppURL:      appURL,
			SettingsURL: settingsQRURL(actualPort),
			ConfigDir:   configDir,
			LogDir:      logDir,
			DBDir:       dbDir,
			OpenURL:     desktopOpenURL,
			OpenFolder:  desktopOpenFolder,
			Confirm:     desktop.Confirm,
			Notify:      notifyProblem,
			Quit:        quit,
		})
	})
}

// localAppHost はこの PC からアプリを開くときのホスト名。
//
// ★★★localhost のままにしてある(レビュー指摘 高-2。開発者判断待ち) ——————————
// localStorage / sessionStorage は **origin 単位**であり、http://localhost:<port> と
// http://127.0.0.1:<port> は別 origin である。着手前の launchBrowser と
// printStartupNotice はどちらも localhost を案内していたので、127.0.0.1 へ変えると
// web/CLAUDE.md §1 台帳の実装済み 9 キーが既存利用者から見えなくなる。
// ★とくに keyboard-bindings-v1(17 件)は**既定を持たず全件を利用者が登録する**(D-370)。
// ⇒ キーボード入力が丸ごと未割当へ戻る。
//
// ★判断 2(D-790)の文面は「ブラウザで開く URL だけを 127.0.0.1 にする」であり、
// そちらへ揃えることも選べる。★どちらへ揃えるかは開発者の判断であり、
// docs/handover/followup-backlog.md §J の `tray-browser-url-origin-choice` に記録した。
// ⇒ 本サブは「着手前と同じ origin」= 失うものが無い側を暫定で採っている。
//
// ★★判断 2 の実体(待ち受けを 127.0.0.1 へ固定しない)は守っている ——
// determineBindHost / determineBindAddr は無改変である。
// ★CORS 許可 Origin には localhost / 127.0.0.1 の両方が入っている
// (buildAllowedOrigins)。⇒ どちらへ揃えても CORS は通る。
const localAppHost = "localhost"

// localAppURL はこの PC からアプリを開く URL を返す。
//
// ★★起動時の自動起動・トレイの「ブラウザで開く」・起動案内の 3 つが同じ origin を
// 指すこと。⇒ 割れると、どの導線から入ったかで UI 状態が変わる
// (TestAppURLsShareOneOrigin が固定する)。
func localAppURL(port int) string {
	return fmt.Sprintf("http://%s:%d/", localAppHost, port)
}

// settingsQRURL は設定画面のネットワーク節を開き、既存の QR モーダルを出す URL を返す。
//
// ★★トレイ側で QR を描かない(指示書 §3-3) —— Go の QR ライブラリが 1 本増え、
// Win32 で画像を描くウィンドウが要るため、新規依存 0 件の前提が崩れる。
// ⇒ 既に在る web/src/features/config/QRCodeModal.tsx を開くだけにする。
// ★LAN 共有が OFF のとき QR ボタンは「非描画」である(M22-06 が固定)。トレイから
// 開いても QR は出ない。これは仕様どおりであり、出し分けは作らない。
func settingsQRURL(port int) string {
	return fmt.Sprintf("http://%s:%d/settings?qr=1", localAppHost, port)
}

// ensureDefaultPresetExists は config の [defaults] preset_id が実在するプリセットを
// 指していることを保証する(M20-05 §4.3-2/-3・D-358)。
//
// 実在しない場合は起動を止めず、組み込みの既定(official_ja_move)へ倒してログへ残す。
// ★倒すのはメモリ上の値だけで、config.toml へは書き戻さない。
//
// ★入口は 2 つある(followup `preset-config-preset-id-existence`)——(1) config.toml の
// 手編集 (2) 本経路を通らずに消えたプリセット。PUT /api/config 側の実在検査
// (configsvc の presetExists)と対で、実在しない値が入ったまま起動できない状態にする。
//
// ★倒し先を固定値 1 にしない。presets.id は 1 / 3 / 5 と欠番があり(migrations/000007)、
// 番号を直書きすると本サブが撤去した「既定 = ID 1」の暗黙前提が別の形で復活する。
func ensureDefaultPresetExists(ctx context.Context, repo presetrepo.Repository, cfg *config.Config) error {
	_, err := repo.FindPresetByID(ctx, cfg.Defaults.PresetID)
	if err == nil {
		return nil
	}
	if !errors.Is(err, presetrepo.ErrNotFound) {
		return fmt.Errorf("find preset %d: %w", cfg.Defaults.PresetID, err)
	}

	fallback, err := repo.FindPresetByCode(ctx, model.PresetCodeOfficialJaMove)
	if err != nil {
		return fmt.Errorf("find builtin default preset %q: %w", model.PresetCodeOfficialJaMove, err)
	}

	slog.WarnContext(ctx, "config defaults.preset_id points to a preset that does not exist; falling back to the builtin default",
		slog.Int64("configured_preset_id", cfg.Defaults.PresetID),
		slog.Int64("fallback_preset_id", fallback.ID),
		slog.String("fallback_preset_code", fallback.Code),
	)
	cfg.Defaults.PresetID = fallback.ID
	return nil
}

// printStartupNotice は起動時のユーザー向け案内を w に出力する(A-1)。
//
// これは「運用ログでも debug 出力でもない CLI の UX 出力」であり、ログ level に
// 依存せず常に表示する(slog の file ログとは別カテゴリ。利用者は exe のコンソール
// だけでアクセス URL を把握できる必要があるため。NFR303/304・DES-002 §3.4)。
// port は L-04 で確定した実ポート、lanIPs は lan モード時に検出したプライベート IP。
// trayResident は通知領域アイコンが在る OS かどうかで、終了の案内を出し分けるための
// 入力である(M34-02 段 6。呼び出し側は同名の関数で決める)。
//
// ★★本 godoc は着手前 ensureDefaultPresetExists に貼られていた(説明が途中から
// 別の関数の話に切り替わり、本関数には godoc が無い状態だった)。⇒ 第 5 引数を足した
// 手番で貼り直した(レビュー指摘 低-1)。
//
// ★★-H=windowsgui の配布ビルドでは標準出力の接続先が無く、本案内は誰にも見えない。
// ⇒ それでも出し続けるのは、コンソールの在るビルド(開発 / Linux・macOS 配布)では
// 従来どおり唯一の案内であるためである。
func printStartupNotice(w io.Writer, mode string, port int, lanIPs []net.IP, trayResident bool) {
	fmt.Fprintln(w, "============================================================")
	fmt.Fprintln(w, " Tacpendium が起動しました")
	fmt.Fprintf(w, "  この PC からアクセス: http://localhost:%d/\n", port)
	if mode == "lan" {
		if len(lanIPs) > 0 {
			fmt.Fprintln(w, "  スマホ等(同じ Wi-Fi の端末)からアクセス:")
			for _, ip := range lanIPs {
				fmt.Fprintf(w, "    http://%s:%d/\n", ip.String(), port)
			}
		} else {
			fmt.Fprintln(w, "  ※LAN モードですが、この PC のネットワーク IP を検出できませんでした。")
			fmt.Fprintln(w, "    ネットワーク接続を確認してください。")
		}
		fmt.Fprintln(w, "  ※スマホから接続できない場合は、Windows ファイアウォール(プライベート)で")
		fmt.Fprintln(w, "    このアプリの着信を許可してください。サードパーティ製のウイルス対策/")
		fmt.Fprintln(w, "    セキュリティソフト(例: Norton)を使用している場合は、そちら側での許可が")
		fmt.Fprintln(w, "    必要なことがあります。詳細は README.txt を参照してください。")
	}
	// ★★常駐化で文面が失効した(M34-02 段 6 / followup `startup-notice-text-stale-on-tray`)。
	// 通知領域アイコンが在る OS では、閉じる窓はもう無い(-H=windowsgui では窓自体が
	// 出ない)。⇒ 終了の導線はアイコンの右クリックメニューである。
	// ★トレイの無い OS(Linux / macOS 配布)では従来どおりの案内が正しい。
	if trayResident {
		fmt.Fprintln(w, " 終了するには通知領域のアイコンを右クリックし、「終了」を選んでください。")
	} else {
		fmt.Fprintln(w, " 終了するにはこのウィンドウを閉じてください。")
	}
	fmt.Fprintln(w, "============================================================")
}

// trayResident は通知領域アイコンが在る OS かを返す。
//
// ★★判定を runtime.GOOS で持つ理由 —— 権威ある信号は RunTray が返す
// desktop.ErrUnsupported だが、同関数はメッセージループへ入ってブロックするため、
// 起動案内を出す時点ではまだ受け取れない。⇒ internal/desktop の OS 分離
// (desktop_windows.go / desktop_other.go)と同じ境界をここに写す。
// ★境界がずれると文面がずれる。⇒ TestTrayResidentMatchesDesktopContract が
// 非 Windows 側でそれを機械で突き合わせる。
func trayResident() bool { return runtime.GOOS == "windows" }

// launchBrowser は NFR303/304(exe 起動だけで使える)のため、実ポートで
// ブラウザを自動起動する。リスナは既に bind 済みのため接続は成立する。
// 起動失敗時もアプリは継続し、利用者がアクセスできるよう URL をログ案内する
// (利用者は L-04 で変わった実ポートを知らないため案内が必須)。
//
// ★★ブラウザを開く経路は desktop.OpenURL ただ 1 本である(M34-02 段 6 / followup
// `browser-launch-duplication`)。⇒ 以前はここが github.com/pkg/browser を直接呼び、
// トレイ側は desktop.OpenURL(自前の rundll32)を呼ぶ 2 本立てだった。
// ★desktop.OpenURL は ValidateURL を通したうえで pkg/browser へ委譲する。
// ⇒ 依存は増えていない(pkg/browser は元から direct 依存)。
func launchBrowser(port int) {
	accessURL := localAppURL(port)
	slog.Info("open this URL in your browser if it does not open automatically",
		slog.String("url", accessURL))
	go func() {
		if err := desktopOpenURL(accessURL); err != nil {
			slog.Warn("failed to auto-launch browser; open the URL manually",
				slog.String("url", accessURL),
				slog.String("err", err.Error()),
			)
		}
	}()
}

// logLANAccessGuide は lan モード起動時に、LAN 端末(スマホ等)からのアクセス手順を
// 起動ログに出力する。検出した全プライベート IP を列挙し(有線/無線が複数ある環境で
// 利用者が正しい IP を選べるように)、接続できない場合の最有力原因である
// ファイアウォール/ウイルス対策ソフトの inbound 許可を案内する(M7-06 E2E 知見)。
func logLANAccessGuide(port int) {
	ips, err := netutil.ListPrivateIPv4()
	if err != nil || len(ips) == 0 {
		slog.Warn("LAN access: could not detect a private IP address; "+
			"check that this PC is connected to the network",
			slog.Any("err", err))
		return
	}

	urls := make([]string, 0, len(ips))
	for _, ip := range ips {
		urls = append(urls, fmt.Sprintf("http://%s:%d/", ip.String(), port))
	}
	slog.Info("LAN access: open one of these URLs from your phone (same Wi-Fi as this PC)",
		slog.Any("urls", urls))
	slog.Info("LAN access: if a phone cannot connect, allow this app's inbound " +
		"connections in Windows Defender Firewall (Private). If a third-party " +
		"antivirus/security suite (e.g. Norton) manages the firewall, allow it there too")
}

// determineBindHost は mode に応じた bind ホストを返す。
//   - local: 127.0.0.1
//   - lan:   0.0.0.0
func determineBindHost(mode string) string {
	if mode == "lan" {
		return "0.0.0.0"
	}
	return "127.0.0.1"
}

// determineBindAddr は mode に応じた bind アドレスを返す。
//   - local: 127.0.0.1:<port>
//   - lan:   0.0.0.0:<port>
func determineBindAddr(mode string, port int) string {
	return fmt.Sprintf("%s:%d", determineBindHost(mode), port)
}

// buildAllowedOrigins は SUPP-001 §2.6.1 に従い、許可 Origin の固定リストを構築する。
//   - 共通: http://localhost:<port>、http://127.0.0.1:<port>
//   - lan: 上記に加えて SelectPrimaryLANIP() で得た代表 IP の http://<ip>:<port>
//
// lan モードで LAN IP が見つからない場合は fatal(エラー)で起動を中止する。
// (config.toml の mode を local に戻すか、ネットワーク接続を確認するよう促す)
func buildAllowedOrigins(mode string, port int) ([]string, error) {
	origins := []string{
		fmt.Sprintf("http://localhost:%d", port),
		fmt.Sprintf("http://127.0.0.1:%d", port),
	}
	if mode != "lan" {
		return origins, nil
	}
	ip, err := netutil.SelectPrimaryLANIP()
	if err != nil {
		return nil, fmt.Errorf(
			"LAN モードで起動できる IP が見つかりません。"+
				"config.toml の [server].mode を \"local\" に変更するか、"+
				"ネットワーク接続を確認してください: %w", err)
	}
	origins = append(origins, fmt.Sprintf("http://%s:%d", ip.String(), port))
	return origins, nil
}
