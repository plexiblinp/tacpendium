// Package config の DTO 型定義。
//
// 機微情報除外規約(M22-01 で as-built へ更新): appconfig.Config には機微情報が
// 存在する——SecurityConfig.PasswordHash(簡易パスワードの検証子)である。
//
// ★除外は「json:"-" を付ける」ことではなく、本ファイルの DTO へ足さないことで
// 成立している。ConfigResponse / UpdateConfigRequest は appconfig.Config とは別の
// 手書き型であり、toConfigResponse / ToServiceRequest がフィールド単位で明示的に
// 詰め替える。載せ替えのコードを書かないかぎり値は外へ出ない。
//
// ⇒ appconfig.Config へ新しい機微フィールドを足すときも、本ファイルの DTO へは
// 足さないこと。ConfigResponse へ足したうえで json:"-" を付ける形にはしないこと
// (応答から消えても UpdateConfigRequest 側の入力口が残りうる)。
// SUPP-001 §5.6。固定しているテストは internal/api/config/handler_test.go の
// TestHandler_Get_DoesNotExposePasswordHash / TestHandler_Update_CannotWritePasswordHash。
package config

import configsvc "github.com/plexiblinp/tacpendium/internal/service/config"

// ConfigResponse は GET /api/config および PUT /api/config 成功時のレスポンス DTO。
type ConfigResponse struct {
	Server          ServerDTO   `json:"server"`
	Database        DatabaseDTO `json:"database"`
	Logging         LoggingDTO  `json:"logging"`
	Security        SecurityDTO `json:"security"`
	Network         NetworkDTO  `json:"network"`
	Defaults        DefaultsDTO `json:"defaults"`
	IsInitialized   bool        `json:"isInitialized"`
	RestartRequired bool        `json:"restartRequired"`
}

// ServerDTO は Server 設定のレスポンス表現。
type ServerDTO struct {
	Mode string `json:"mode"`
	Port int    `json:"port"`
}

// DatabaseDTO は Database 設定のレスポンス表現。
type DatabaseDTO struct {
	Path string `json:"path"`
}

// LoggingDTO は Logging 設定のレスポンス表現。JSON タグは camelCase(CLAUDE.md §4 規約)。
type LoggingDTO struct {
	Level      string `json:"level"`
	File       string `json:"file"`
	MaxSizeMB  int    `json:"maxSizeMb"`
	MaxBackups int    `json:"maxBackups"`
	MaxAgeDays int    `json:"maxAgeDays"`
}

// SecurityDTO は Security 設定のレスポンス表現。
type SecurityDTO struct {
	PasswordEnabled bool `json:"passwordEnabled"`
}

// NetworkDTO は LAN 接続情報のレスポンス表現。
type NetworkDTO struct {
	PrimaryLanIp string `json:"primaryLanIp"`
	LanUrl       string `json:"lanUrl"`
}

// DefaultsDTO はデフォルト表示設定のレスポンス表現。
type DefaultsDTO struct {
	CharacterID int64 `json:"characterId"`
	PresetID    int64 `json:"presetId"`
}

// UpdateConfigRequest は PUT /api/config のリクエスト DTO。
// 各フィールドが nil の場合は変更なし(SUPP-001 §5.9 部分更新ポリシー)。
type UpdateConfigRequest struct {
	Server   *ServerUpdateDTO   `json:"server,omitempty"`
	Database *DatabaseUpdateDTO `json:"database,omitempty"`
	Logging  *LoggingUpdateDTO  `json:"logging,omitempty"`
	Security *SecurityUpdateDTO `json:"security,omitempty"`
	Defaults *DefaultsUpdateDTO `json:"defaults,omitempty"`
}

// ServerUpdateDTO は Server 設定の部分更新リクエスト。
type ServerUpdateDTO struct {
	Mode *string `json:"mode,omitempty"`
	Port *int    `json:"port,omitempty"`
}

// DatabaseUpdateDTO は Database 設定の部分更新リクエスト。
type DatabaseUpdateDTO struct {
	Path *string `json:"path,omitempty"`
}

// LoggingUpdateDTO は Logging 設定の部分更新リクエスト。
type LoggingUpdateDTO struct {
	Level      *string `json:"level,omitempty"`
	File       *string `json:"file,omitempty"`
	MaxSizeMB  *int    `json:"maxSizeMb,omitempty"`
	MaxBackups *int    `json:"maxBackups,omitempty"`
	MaxAgeDays *int    `json:"maxAgeDays,omitempty"`
}

// SecurityUpdateDTO は Security 設定の部分更新リクエスト。
type SecurityUpdateDTO struct {
	PasswordEnabled *bool `json:"passwordEnabled,omitempty"`
}

// DefaultsUpdateDTO は Defaults 設定の部分更新リクエスト。
type DefaultsUpdateDTO struct {
	CharacterID *int64 `json:"characterId,omitempty"`
	PresetID    *int64 `json:"presetId,omitempty"`
}

// ToServiceRequest は UpdateConfigRequest をサービス層の UpdateRequest に変換する。
func (r *UpdateConfigRequest) ToServiceRequest() configsvc.UpdateRequest {
	req := configsvc.UpdateRequest{}
	if r.Server != nil {
		req.Server = &configsvc.ServerUpdate{
			Mode: r.Server.Mode,
			Port: r.Server.Port,
		}
	}
	if r.Database != nil {
		req.Database = &configsvc.DatabaseUpdate{
			Path: r.Database.Path,
		}
	}
	if r.Logging != nil {
		req.Logging = &configsvc.LoggingUpdate{
			Level:      r.Logging.Level,
			File:       r.Logging.File,
			MaxSizeMB:  r.Logging.MaxSizeMB,
			MaxBackups: r.Logging.MaxBackups,
			MaxAgeDays: r.Logging.MaxAgeDays,
		}
	}
	if r.Security != nil {
		req.Security = &configsvc.SecurityUpdate{
			PasswordEnabled: r.Security.PasswordEnabled,
		}
	}
	if r.Defaults != nil {
		req.Defaults = &configsvc.DefaultsUpdate{
			CharacterID: r.Defaults.CharacterID,
			PresetID:    r.Defaults.PresetID,
		}
	}
	return req
}
