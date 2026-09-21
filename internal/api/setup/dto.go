package setup

import (
	"time"

	"github.com/plexiblinp/tacpendium/internal/model"
	setupsvc "github.com/plexiblinp/tacpendium/internal/service/setup"
	"github.com/plexiblinp/tacpendium/internal/service/validation"
)

// ===========================================================================
// リクエスト DTO
// ===========================================================================

// CreateSetupRequest は POST /api/combos/{comboId}/setups の入力。
type CreateSetupRequest struct {
	CharacterID int64              `json:"characterId"`
	Name        *string            `json:"name,omitempty"`
	Description *string            `json:"description,omitempty"`
	Steps       []SetupStepRequest `json:"steps"`
	// VerifiedConditions は提案の採用時にチェックされた「確認できた条件」(M19-03 §4.5)。
	// 省略・空配列でよい(チェックせずに採用できる)。記録されるのは成立(ok)のみで、
	// 不成立と note はここでは扱わない。追加のみの後方互換。
	VerifiedConditions []SetupResultConditionRequest `json:"verifiedConditions,omitempty"`
}

// SetupResultConditionRequest は「確認できた条件」1 セル分の座標。
type SetupResultConditionRequest struct {
	TechType string `json:"techType"`
	InCorner bool   `json:"inCorner"`
}

// UpsertSetupResultRequest は PUT /api/combos/{comboId}/setups/{setupId}/results の入力。
// 「未検証へ戻す」は本 API ではなく DELETE(行の物理削除)で行う(M19-03 §4.1.3)。
//
// **note は全置換の契約**: 省略・null を送ると既存のメモは消える(部分更新ではない)。
// 状態だけを変えてメモを残したい場合は、既存の note を読み直して同送すること。
type UpsertSetupResultRequest struct {
	TechType string  `json:"techType"`
	InCorner bool    `json:"inCorner"`
	Result   string  `json:"result"` // "ok" / "ng"。NULL や「未検証」の値は受け付けない
	Note     *string `json:"note,omitempty"`
}

// 成立条件のレスポンスは model.ComboSetupResult をそのまま返す。
// 同 struct の JSON タグが API 契約(setupId / techType / inCorner / result / note)と
// 一致しており、combo_id は URL 側で表現するため json:"-" になっている。
// SetupStepRequest が model.Modifiers を直接使っているのと同じ流儀。

// CheckSetupDuplicateRequest は POST /api/combos/{comboId}/setups/check-duplicate の入力
// (M23-09 §4.1-2)。
//
// ★名前は送らない。VAL-S04 / VAL-S07 とも名前を見ない(DES-006 §3)。
// ★経路名はコンボ側の実経路(POST /api/combos/check-duplicate)に倣う。セットプレイの
//
//	登録が POST /api/combos/{comboId}/setups であり親コンボ id を要するため、その下へ置く。
type CheckSetupDuplicateRequest struct {
	CharacterID int64              `json:"characterId"`
	Steps       []SetupStepRequest `json:"steps"`
}

// CheckSetupDuplicateResponse は同経路の出力(M23-09 §4.1-2)。
//
// ★形はコンボ側の CheckDuplicateResponse に揃える——生きた側と削除済み側を別のキーで
// 返し、0 件でもキーを出して空配列にする(画面は length で分岐する)。
type CheckSetupDuplicateResponse struct {
	// Duplicates は生きた一致。母集団は VAL-S04 と同一。
	Duplicates []model.SetupRef `json:"duplicates"`
	// DeletedDuplicates はゴミ箱に居る一致。母集団は VAL-S07 と同一。
	DeletedDuplicates []model.SetupRef `json:"deletedDuplicates"`
}

// SetupStepRequest はレシピステップの入力。
type SetupStepRequest struct {
	MoveID    *int64           `json:"moveId,omitempty"`
	Modifiers *model.Modifiers `json:"modifiers,omitempty"`
}

// CreateSetupLinkRequest は POST /api/combos/{comboId}/setup-links の入力。
type CreateSetupLinkRequest struct {
	SetupID int64 `json:"setupId"`
}

// UpdateSetupRequest は PATCH /api/setups/{id} の入力。
type UpdateSetupRequest struct {
	Name        *string             `json:"name,omitempty"`
	Description *string             `json:"description,omitempty"`
	Steps       *[]SetupStepRequest `json:"steps,omitempty"`
	Version     int                 `json:"version"`
}

// ===========================================================================
// レスポンス DTO
// ===========================================================================

// SetupResponse は単一セットプレイの API レスポンス。
type SetupResponse struct {
	ID          int64     `json:"id"`
	CharacterID int64     `json:"characterId"`
	Name        *string   `json:"name,omitempty"`
	Description *string   `json:"description,omitempty"`
	StepCount   int       `json:"stepCount"`
	Version     int       `json:"version"`
	CreatedAt   time.Time `json:"createdAt"`
	UpdatedAt   time.Time `json:"updatedAt"`
	// DeletedAt は論理削除の日時(M23-02)。生きた行では省略される。
	// ★ゴミ箱一覧が「削除日時」を表示項目に持つため必要である(DES-005 §5.15)。
	// 形はコンボ側の ComboResponse.DeletedAt に揃えてある。
	DeletedAt     *time.Time          `json:"deletedAt,omitempty"`
	Steps         []SetupStepResponse `json:"steps,omitempty"`
	DefaultRecipe string              `json:"defaultRecipe"`
	// ParentComboIDs は「このセットプレイが使われている**生存**コンボ」の id。
	// ★論理削除済みのコンボは載らない(M23-03 §4.5)。判定の母集団には使えない——
	//   検証(重複チェック等)は repository/setup.FindComboIDsBySetupIDAllowDeleted を使うこと。
	ParentComboIDs []int64                      `json:"parentComboIds"`
	Validations    *validation.ValidationResult `json:"validations,omitempty"`
	// Warnings は復元の成功応答へ載せる注意事項(M23-04 §4.3・DES-002 §4.2)。
	//
	// ★設定するのは POST /api/setups/{id}/restore(M23-04)と
	// POST /api/combos/{comboId}/setups(M23-05・VAL-S07)の 2 経路である。他の経路は
	// nil のままで omitempty により JSON へ出ない。
	// ★M23-04 §1.6-2 の「遡って足さない」は同サブの射程を守る線であり、M23-05 §4.6 が
	//   登録経路へ解禁した。★コンボ同時登録(CreateSetupInTx)へは足していない
	//   ——内部呼び出しであり警告を返す先が無い(M23-05 §4.5)。
	// ★警告 0 件のときも出さない(§4.3-2)。形はコンボ側の ComboResponse.Warnings と同一。
	Warnings []validation.ValidationIssue `json:"warnings,omitempty"`
}

// SetupStepResponse は API レスポンス用のステップ。
type SetupStepResponse struct {
	ID        int64            `json:"id"`
	StepOrder int              `json:"stepOrder"`
	MoveID    *int64           `json:"moveId,omitempty"`
	MoveCode  *string          `json:"moveCode,omitempty"`
	Modifiers *model.Modifiers `json:"modifiers,omitempty"`
}

// SetupCandidateSummary は候補セットプレイの軽量レスポンス（steps なし）。
type SetupCandidateSummary struct {
	ID            int64   `json:"id"`
	CharacterID   int64   `json:"characterId"`
	Name          *string `json:"name,omitempty"`
	Description   *string `json:"description,omitempty"`
	StepCount     int     `json:"stepCount"`
	Version       int     `json:"version"`
	DefaultRecipe string  `json:"defaultRecipe"`
	// ParentComboIDs は「このセットプレイが使われている**生存**コンボ」の id。
	// ★論理削除済みのコンボは載らない(M23-03 §4.5)。判定の母集団には使えない——
	//   検証(重複チェック等)は repository/setup.FindComboIDsBySetupIDAllowDeleted を使うこと。
	ParentComboIDs []int64 `json:"parentComboIds"`
}

// SetupCandidatesResponse は GET /api/combos/{comboId}/setup-candidates のレスポンス。
type SetupCandidatesResponse struct {
	Items []SetupCandidateSummary `json:"items"`
}

// ComboSetupLinkResponse は POST /api/combos/{comboId}/setup-links のレスポンス。
type ComboSetupLinkResponse struct {
	ComboID int64 `json:"comboId"`
	SetupID int64 `json:"setupId"`
}

// ===========================================================================
// 変換ヘルパ
// ===========================================================================

func toServiceCreateInput(req CreateSetupRequest) setupsvc.CreateSetupInput {
	steps := make([]model.SetupStep, len(req.Steps))
	for i, sr := range req.Steps {
		steps[i] = model.SetupStep{
			StepOrder: i + 1,
			MoveID:    sr.MoveID,
			Modifiers: sr.Modifiers,
		}
	}
	conditions := make([]setupsvc.SetupResultCondition, len(req.VerifiedConditions))
	for i, cr := range req.VerifiedConditions {
		conditions[i] = setupsvc.SetupResultCondition{TechType: cr.TechType, InCorner: cr.InCorner}
	}
	return setupsvc.CreateSetupInput{
		CharacterID:        req.CharacterID,
		Name:               req.Name,
		Description:        req.Description,
		Steps:              steps,
		VerifiedConditions: conditions,
	}
}

// toServiceCheckDuplicateInput は保存前チェックの入力を組む(M23-09 §4.1-2)。
//
// ★StepOrder の採番は toServiceCreateInput と同じ「配列順に 1 起算」でなければならない。
// 違えると CalcSetupRecipeHash が別のハッシュを出し、保存前と保存後で判定がずれる。
func toServiceCheckDuplicateInput(req CheckSetupDuplicateRequest) setupsvc.CheckSetupDuplicateInput {
	steps := make([]model.SetupStep, len(req.Steps))
	for i, sr := range req.Steps {
		steps[i] = model.SetupStep{
			StepOrder: i + 1,
			MoveID:    sr.MoveID,
			Modifiers: sr.Modifiers,
		}
	}
	return setupsvc.CheckSetupDuplicateInput{
		CharacterID: req.CharacterID,
		Steps:       steps,
	}
}

func toServiceUpdateInput(req UpdateSetupRequest) setupsvc.UpdateSetupInput {
	input := setupsvc.UpdateSetupInput{
		Name:        req.Name,
		Description: req.Description,
		Version:     req.Version,
	}
	if req.Steps != nil {
		steps := make([]model.SetupStep, len(*req.Steps))
		for i, sr := range *req.Steps {
			steps[i] = model.SetupStep{
				StepOrder: i + 1,
				MoveID:    sr.MoveID,
				Modifiers: sr.Modifiers,
			}
		}
		input.Steps = &steps
	}
	return input
}

func toSetupResponse(svcResp *setupsvc.SetupResponse, validations *validation.ValidationResult) SetupResponse {
	s := svcResp.Setup
	resp := SetupResponse{
		ID:             s.ID,
		CharacterID:    s.CharacterID,
		Name:           s.Name,
		Description:    s.Description,
		StepCount:      s.StepCount,
		Version:        s.Version,
		CreatedAt:      s.CreatedAt,
		UpdatedAt:      s.UpdatedAt,
		DeletedAt:      s.DeletedAt,
		DefaultRecipe:  svcResp.DefaultRecipe,
		ParentComboIDs: svcResp.ParentComboIDs,
	}
	if resp.ParentComboIDs == nil {
		resp.ParentComboIDs = []int64{}
	}
	if s.Steps != nil {
		resp.Steps = make([]SetupStepResponse, len(s.Steps))
		for i, st := range s.Steps {
			resp.Steps[i] = SetupStepResponse{
				ID:        st.ID,
				StepOrder: st.StepOrder,
				MoveID:    st.MoveID,
				MoveCode:  st.MoveCode,
				Modifiers: st.Modifiers,
			}
		}
	}
	if validations != nil && len(validations.Issues) > 0 {
		resp.Validations = validations
	}
	return resp
}
