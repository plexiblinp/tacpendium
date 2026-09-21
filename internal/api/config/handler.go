package config

import (
	"net/http"

	"github.com/labstack/echo/v4"
	appconfig "github.com/plexiblinp/tacpendium/internal/config"
	"github.com/plexiblinp/tacpendium/internal/model"
	configsvc "github.com/plexiblinp/tacpendium/internal/service/config"
)

// Handler は設定 API の HTTP ハンドラ。
type Handler struct {
	svc configsvc.Service
}

// NewHandler は Handler を生成する。
func NewHandler(svc configsvc.Service) *Handler {
	return &Handler{svc: svc}
}

// Get は GET /api/config を処理する。
// 現在の設定値と isInitialized(config.toml 存在有無)を返す。
func (h *Handler) Get(c echo.Context) error {
	cfg, network, isInitialized, err := h.svc.Get()
	if err != nil {
		return c.JSON(http.StatusInternalServerError, model.APIErrorResponse{
			Error: model.APIError{
				Code:    "config_read_failed",
				Message: "failed to read config",
			},
		})
	}
	return c.JSON(http.StatusOK, toConfigResponse(cfg, network, isInitialized, false))
}

// Update は PUT /api/config を処理する。
// リクエストボディの設定値で部分更新し、config.toml に書き戻す。
// mode 変更時はアプリ再起動が必要なため restartRequired: true を返す。
// (mode 変更はアプリ再起動後に有効になります)
func (h *Handler) Update(c echo.Context) error {
	var req UpdateConfigRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, model.APIErrorResponse{
			Error: model.APIError{
				Code:    "invalid_request",
				Message: "invalid JSON body",
			},
		})
	}

	updated, network, issues, restart, err := h.svc.Update(req.ToServiceRequest())
	if err != nil {
		return c.JSON(http.StatusInternalServerError, model.APIErrorResponse{
			Error: model.APIError{
				Code:    "config_write_failed",
				Message: "failed to write config.toml",
			},
		})
	}
	if len(issues) > 0 {
		issueList := make([]map[string]string, len(issues))
		for i, issue := range issues {
			issueList[i] = map[string]string{
				"field":   issue.Field,
				"message": issue.Message,
			}
		}
		return c.JSON(http.StatusUnprocessableEntity, model.APIErrorResponse{
			Error: model.APIError{
				Code:    model.ErrorCodeValidationFailed,
				Message: "configuration validation failed",
				Details: map[string]any{
					"validations": map[string]any{
						"issues": issueList,
					},
				},
			},
		})
	}

	// PUT 成功後は必ず config.toml が存在する
	return c.JSON(http.StatusOK, toConfigResponse(updated, network, true, restart))
}

// toConfigResponse は *appconfig.Config を ConfigResponse に変換する。
func toConfigResponse(cfg *appconfig.Config, network configsvc.NetworkInfo, isInitialized bool, restartRequired bool) ConfigResponse {
	return ConfigResponse{
		Server: ServerDTO{
			Mode: cfg.Server.Mode,
			Port: cfg.Server.Port,
		},
		Database: DatabaseDTO{
			Path: cfg.Database.Path,
		},
		Logging: LoggingDTO{
			Level:      cfg.Logging.Level,
			File:       cfg.Logging.File,
			MaxSizeMB:  cfg.Logging.MaxSizeMB,
			MaxBackups: cfg.Logging.MaxBackups,
			MaxAgeDays: cfg.Logging.MaxAgeDays,
		},
		Security: SecurityDTO{
			PasswordEnabled: cfg.Security.PasswordEnabled,
		},
		Network: NetworkDTO{
			PrimaryLanIp: network.PrimaryLanIp,
			LanUrl:       network.LanUrl,
		},
		Defaults: DefaultsDTO{
			CharacterID: cfg.Defaults.CharacterID,
			PresetID:    cfg.Defaults.PresetID,
		},
		IsInitialized:   isInitialized,
		RestartRequired: restartRequired,
	}
}
