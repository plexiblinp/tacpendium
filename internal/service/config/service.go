// Package config は設定 API のビジネスロジックを提供する。
//
// 設計参照: M6-01 指示書 §4.3、SUPP-001 §5.8 / §5.9。
package config

import (
	"fmt"
	"log/slog"
	"net"
	"os"
	"strconv"
	"strings"
	"sync"

	"github.com/BurntSushi/toml"
	appconfig "github.com/plexiblinp/tacpendium/internal/config"
)

// NetworkInfo は LAN 接続情報を表す。
type NetworkInfo struct {
	PrimaryLanIp string
	LanUrl       string
}

// LanIpResolver は LAN IP アドレスを解決する関数型。
type LanIpResolver func() (net.IP, error)

// ValidationIssue はバリデーション失敗の 1 件分を表す。
type ValidationIssue struct {
	Field   string `json:"field"`
	Message string `json:"message"`
}

// UpdateRequest は PUT /api/config のサービス層入力型。
// 各フィールドが nil の場合は変更なし(SUPP-001 §5.9 部分更新ポリシー)。
type UpdateRequest struct {
	Server   *ServerUpdate
	Database *DatabaseUpdate
	Logging  *LoggingUpdate
	Security *SecurityUpdate
	Defaults *DefaultsUpdate
}

// DefaultsUpdate は Defaults 設定の部分更新入力。
type DefaultsUpdate struct {
	CharacterID *int64
	PresetID    *int64
}

// ServerUpdate は Server 設定の部分更新入力。
type ServerUpdate struct {
	Mode *string
	Port *int
}

// DatabaseUpdate は Database 設定の部分更新入力。
type DatabaseUpdate struct {
	Path *string
}

// LoggingUpdate は Logging 設定の部分更新入力。
type LoggingUpdate struct {
	Level      *string
	File       *string
	MaxSizeMB  *int
	MaxBackups *int
	MaxAgeDays *int
}

// SecurityUpdate は Security 設定の部分更新入力。
type SecurityUpdate struct {
	PasswordEnabled *bool
}

// Service は設定 API のビジネスロジックを提供するインターフェース。
type Service interface {
	Get() (cfg *appconfig.Config, network NetworkInfo, isInitialized bool, err error)
	Update(req UpdateRequest) (updated *appconfig.Config, network NetworkInfo, issues []ValidationIssue, restartRequired bool, err error)
	// Security は [security] のスナップショットを返す(M22-01)。
	//
	// ★Get() ではなく本メソッドを使う理由が 2 つある。
	//  1. Get() は resolveNetwork() を呼ぶため、lan モードでは毎回 NIC を解決する。
	//     認証ミドルウェアはリクエストごとに呼ぶので、その代償を払えない。
	//  2. 読み出しを s.mu の保護下に閉じ込める。cfg を直接読む形にすると
	//     Update の `*s.cfg = next` と競合する(followup preset-config-unsynchronized-read)。
	Security() appconfig.SecurityConfig
	// SetPasswordHash は password_hash のみを更新し config.toml へ書き戻す(M22-01)。
	//
	// ★Update と同じ mutex・同じ書き戻し経路を通す。cfg を外から書くと
	// Update の構造体ごとの差し替えに黙って消される。
	SetPasswordHash(hash string) error
}

// PresetExistsFunc は指定 ID のプリセットが実在するかを返す(M20-05 §4.3-1)。
//
// ★config サービスへ preset ドメイン(および DB)への直接依存を持ち込まないための関数注入
// である。preset.New が config を関数で受けるのと対称の形にしてある。
// M20-04 が「config サービスへ DB 依存を持たせる変更になる」として止めた場所を、
// 依存の向きを増やさない形で引き取る(followup `preset-config-preset-id-existence`)。
//
// ★context.Context を取らないのは意図的である。Service.Update が ctx を持たず、
// 公開インタフェースの組み替えは M20-05 §9.4 停止条件 2 で範囲外とされているため、
// 呼出側(cmd/tacpendium)が起動時の ctx をクロージャへ閉じ込める。
// ⇒ 帰結として PUT /api/config のクライアント切断では検査も再計算もキャンセルされない
// (望ましい方向だが、将来 ctx を通すときの判断材料として明記しておく)。
type PresetExistsFunc func(presetID int64) (bool, error)

// DefaultPresetChangedFunc は [defaults] preset_id が変わったときに呼ばれる(M20-05 §4.2-3)。
//
// ★切替先のプリセット分の recipe_cache を再計算するために要る。追随させると
// 「一度もエイリアスを触っていないプリセットへ切り替えるとキーが存在しない」という
// 新しい状態が生まれるため、同じ手番で塞ぐ(D-313)。
type DefaultPresetChangedFunc func(presetID int64) error

// service は Service の実装。
type service struct {
	mu            sync.Mutex
	cfg           *appconfig.Config
	configPath    string
	lanIpResolver LanIpResolver
	// presetExists / onDefaultPresetChanged はいずれも nil 可(テスト用)。
	// nil の場合は実在検査・切替時の再計算を行わない。本番配線では必ず渡すこと。
	presetExists           PresetExistsFunc
	onDefaultPresetChanged DefaultPresetChangedFunc
}

// NewService は Service を生成する。
// cfg は main.go で config.Load により生成済みの値を渡す。
//
// presetExists / onDefaultPresetChanged は M20-05 で追加した(§4.3-1 / §4.2-3)。
// nil を渡すと当該機能が無効になる(テスト用)。
func NewService(
	cfg *appconfig.Config,
	configPath string,
	lanIpResolver LanIpResolver,
	presetExists PresetExistsFunc,
	onDefaultPresetChanged DefaultPresetChangedFunc,
) Service {
	return &service{
		cfg:                    cfg,
		configPath:             configPath,
		lanIpResolver:          lanIpResolver,
		presetExists:           presetExists,
		onDefaultPresetChanged: onDefaultPresetChanged,
	}
}

// Get は現在の設定値のコピーと isInitialized を返す。
// isInitialized は configPath ファイルの存在有無で判定する。
func (s *service) Get() (cfg *appconfig.Config, network NetworkInfo, isInitialized bool, err error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	cfgCopy := *s.cfg
	return &cfgCopy, s.resolveNetwork(), fileExists(s.configPath), nil
}

// Update は設定を部分更新し、config.toml にアトミック書き戻しする。
// バリデーション失敗時は issues を返し、config.toml への書き込みは行わない。
// 成功時は更新後の Config と restartRequired フラグを返す。
func (s *service) Update(req UpdateRequest) (updated *appconfig.Config, network NetworkInfo, issues []ValidationIssue, restartRequired bool, err error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	next := *s.cfg

	// 部分更新: nil でないフィールドのみ上書き
	if req.Server != nil {
		if req.Server.Mode != nil {
			next.Server.Mode = *req.Server.Mode
		}
		if req.Server.Port != nil {
			next.Server.Port = *req.Server.Port
		}
	}
	if req.Database != nil {
		if req.Database.Path != nil {
			next.Database.Path = *req.Database.Path
		}
	}
	if req.Logging != nil {
		if req.Logging.Level != nil {
			next.Logging.Level = *req.Logging.Level
		}
		if req.Logging.File != nil {
			next.Logging.File = *req.Logging.File
		}
		if req.Logging.MaxSizeMB != nil {
			next.Logging.MaxSizeMB = *req.Logging.MaxSizeMB
		}
		if req.Logging.MaxBackups != nil {
			next.Logging.MaxBackups = *req.Logging.MaxBackups
		}
		if req.Logging.MaxAgeDays != nil {
			next.Logging.MaxAgeDays = *req.Logging.MaxAgeDays
		}
	}
	if req.Security != nil {
		if req.Security.PasswordEnabled != nil {
			next.Security.PasswordEnabled = *req.Security.PasswordEnabled
		}
	}
	if req.Defaults != nil {
		if req.Defaults.CharacterID != nil {
			next.Defaults.CharacterID = *req.Defaults.CharacterID
		}
		if req.Defaults.PresetID != nil {
			next.Defaults.PresetID = *req.Defaults.PresetID
		}
	}

	// バリデーション(既存 internal/config.validate() と同等ロジック)
	issues = validateConfig(&next)

	// M20-05 §4.3-1: 値域だけでなく DB 上の実在も見る。
	// ★値域だけで通すと、実在しないプリセットを指した状態が config に入る。
	// 読み出しキーが config へ追随する(§4.2)ため、そのままではレシピ行が黙って消える。
	// 検証コード(DES-006)の番号は設計卓が反映時に確定する。製造は採番しない(§4.3-5)。
	if s.presetExists != nil && next.Defaults.PresetID != s.cfg.Defaults.PresetID {
		exists, existsErr := s.presetExists(next.Defaults.PresetID)
		if existsErr != nil {
			return nil, NetworkInfo{}, nil, false, fmt.Errorf("config: check preset exists: %w", existsErr)
		}
		if !exists {
			issues = append(issues, ValidationIssue{
				Field:   "defaults.presetId",
				Message: fmt.Sprintf("preset %d does not exist", next.Defaults.PresetID),
			})
		}
	}

	// M22-01 §4.1-3: パスワード未設定のまま入場ゲートを ON にはできない。
	// ★「ON にしようとした要求」だけを弾く。既に ON かつハッシュ空(config.toml を手で
	// 書いた状態)のときに、無関係な設定変更まで巻き添えで 422 にしないための条件である。
	// ⇒ アプリからは不整合状態を作れない。手で作られた分は OFF 扱いで受け、
	// 起動時に authsvc.Service.WarnIfMisconfigured が 1 度だけ警告する(main.go で呼ぶ)。
	// 検証コード(DES-006)の番号は設計卓が反映時に確定する。製造は採番しない。
	if req.Security != nil && req.Security.PasswordEnabled != nil && *req.Security.PasswordEnabled &&
		next.Security.PasswordHash == "" {
		issues = append(issues, ValidationIssue{
			Field:   "security.passwordEnabled",
			Message: "password is not set; set a password before enabling password protection",
		})
	}

	if len(issues) > 0 {
		return nil, NetworkInfo{}, issues, false, nil
	}

	presetSwitched := next.Defaults.PresetID != s.cfg.Defaults.PresetID

	// 再起動が必要な変更の検知。mode に加え、database.path / logging.file は
	// 起動時にのみ反映される(DB オープン・ロガー初期化が済んでいる)ため再起動が要る。
	restart := s.cfg.Server.Mode != next.Server.Mode ||
		s.cfg.Database.Path != next.Database.Path ||
		s.cfg.Logging.File != next.Logging.File

	// env override は実行時だけの一時値なので、永続化用のコピーから除外する。
	// ディスク上の値を起点に戻すことで、E2E 用の DB path / port 等が
	// config.toml に焼き付くのを防ぐ。
	persisted, err := s.configForPersistence(&next)
	if err != nil {
		return nil, NetworkInfo{}, nil, false, err
	}
	// ★書き戻しは appconfig.Save ただ 1 つを通す。同じ処理をここに書かないこと
	// (M24-09b 以前は本パッケージが独立の writeAtomic を持っていた＝followup `CO-012`)。
	if err := appconfig.Save(s.configPath, persisted); err != nil {
		return nil, NetworkInfo{}, nil, false, err
	}

	// メモリ上の cfg を更新
	*s.cfg = next

	// M20-05 §4.2-3: 既定プリセットが切り替わったら、切替先のプリセット分を再計算する。
	// ★メモリ上の cfg を更新したあとに呼ぶ——再計算そのものは読み出しキーに依存しないが、
	// 「切り替わった状態で再計算されている」ことを呼び出し順で保証しておく。
	// ★失敗は握り潰さない(§4.4-2)。設定の書き込み自体は成功しているため、利用者には
	// 「設定は変わったが表記の作り直しに失敗した」ことがエラーとして伝わる。
	if presetSwitched && s.onDefaultPresetChanged != nil {
		if cbErr := s.onDefaultPresetChanged(next.Defaults.PresetID); cbErr != nil {
			return nil, NetworkInfo{}, nil, false, fmt.Errorf("config: recompute recipe cache for preset %d: %w", next.Defaults.PresetID, cbErr)
		}
	}

	nextCopy := *s.cfg
	return &nextCopy, s.resolveNetwork(), nil, restart, nil
}

// Security は [security] のスナップショットを s.mu の保護下で返す(M22-01)。
func (s *service) Security() appconfig.SecurityConfig {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.cfg.Security
}

// SetPasswordHash は password_hash のみを更新し config.toml へ書き戻す(M22-01)。
//
// hash が空文字なら未設定へ戻す。書き戻しに失敗した場合はメモリ上の cfg も更新しない
// (ファイルとメモリが食い違ったまま「設定できた」と見えるのを防ぐ)。
func (s *service) SetPasswordHash(hash string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	next := *s.cfg
	next.Security.PasswordHash = hash

	persisted, err := s.configForPersistence(&next)
	if err != nil {
		return err
	}
	if err := appconfig.Save(s.configPath, persisted); err != nil {
		return err
	}

	*s.cfg = next
	return nil
}

// configForPersistence は実行時 Config から config.toml 書き戻し用のコピーを作る。
// env override が有効な項目はディスク上の値（ファイル不在時は既定値）を維持する。
func (s *service) configForPersistence(runtime *appconfig.Config) (*appconfig.Config, error) {
	logLevelOverridden := nonEmptyEnv(appconfig.EnvLogLevel)
	dbPathOverridden := nonEmptyEnv(appconfig.EnvDBPath)
	portOverridden := validPortEnv()
	if !logLevelOverridden && !dbPathOverridden && !portOverridden {
		return runtime, nil
	}

	disk := appconfig.Default()
	data, err := os.ReadFile(s.configPath)
	switch {
	case err == nil:
		if _, decodeErr := toml.Decode(string(data), disk); decodeErr != nil {
			return nil, fmt.Errorf("config: decode %q: %w", s.configPath, decodeErr)
		}
	case os.IsNotExist(err):
		// 初回起動は既定値を土台に、env override 以外の更新だけを永続化する。
	default:
		return nil, fmt.Errorf("config: read %q: %w", s.configPath, err)
	}

	persisted := *runtime
	if logLevelOverridden {
		persisted.Logging.Level = disk.Logging.Level
	}
	if dbPathOverridden {
		persisted.Database.Path = disk.Database.Path
	}
	if portOverridden {
		persisted.Server.Port = disk.Server.Port
	}
	return &persisted, nil
}

func nonEmptyEnv(name string) bool {
	value, ok := os.LookupEnv(name)
	return ok && strings.TrimSpace(value) != ""
}

func validPortEnv() bool {
	value, ok := os.LookupEnv(appconfig.EnvPort)
	if !ok || strings.TrimSpace(value) == "" {
		return false
	}
	_, err := strconv.Atoi(strings.TrimSpace(value))
	return err == nil
}

// resolveNetwork は現在の設定から NetworkInfo を解決する。
// ローカルモード時は空文字、LAN モードで IP 取得失敗時も空文字 + ログ出力。
func (s *service) resolveNetwork() NetworkInfo {
	if s.cfg.Server.Mode != "lan" {
		return NetworkInfo{}
	}
	ip, err := s.lanIpResolver()
	if err != nil {
		slog.Warn("config: failed to resolve LAN IP", "error", err)
		return NetworkInfo{}
	}
	ipStr := ip.String()
	return NetworkInfo{
		PrimaryLanIp: ipStr,
		LanUrl:       fmt.Sprintf("http://%s:%d", ipStr, s.cfg.Server.Port),
	}
}

// validateConfig は Config の内容を検証し、ValidationIssue のスライスを返す。
// 既存 internal/config/config.go の validate() と同等ロジックを実装する(非エクスポートのため再実装)。
func validateConfig(cfg *appconfig.Config) []ValidationIssue {
	var issues []ValidationIssue

	switch cfg.Server.Mode {
	case "local", "lan":
		// ok
	default:
		issues = append(issues, ValidationIssue{
			Field:   "server.mode",
			Message: fmt.Sprintf("invalid server.mode %q (want \"local\" or \"lan\")", cfg.Server.Mode),
		})
	}

	if cfg.Server.Port < 1 || cfg.Server.Port > 65535 {
		issues = append(issues, ValidationIssue{
			Field:   "server.port",
			Message: fmt.Sprintf("invalid server.port %d (want 1-65535)", cfg.Server.Port),
		})
	}

	if cfg.Defaults.CharacterID < 1 {
		issues = append(issues, ValidationIssue{
			Field:   "defaults.characterId",
			Message: fmt.Sprintf("invalid defaults.characterId %d (want >= 1)", cfg.Defaults.CharacterID),
		})
	}
	if cfg.Defaults.PresetID < 1 {
		issues = append(issues, ValidationIssue{
			Field:   "defaults.presetId",
			Message: fmt.Sprintf("invalid defaults.presetId %d (want >= 1)", cfg.Defaults.PresetID),
		})
	}

	// database.path / logging.file がアプリ管轄ディレクトリ外へ脱出しないことを検証する
	// (CHANGE-048)。検証ロジックは appconfig.ValidateDataPath に集約し、config.toml
	// ロード経路(internal/config.validate())と本 API 経路で同一規則を共有する。
	if msg := appconfig.ValidateDataPath(cfg.Database.Path); msg != "" {
		issues = append(issues, ValidationIssue{
			Field:   "database.path",
			Message: msg,
		})
	}
	if msg := appconfig.ValidateDataPath(cfg.Logging.File); msg != "" {
		issues = append(issues, ValidationIssue{
			Field:   "logging.file",
			Message: msg,
		})
	}

	return issues
}

// fileExists は path が存在するファイルかを返す。
func fileExists(path string) bool {
	_, err := os.Stat(path)
	return err == nil
}
