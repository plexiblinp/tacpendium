package user

import "github.com/plexiblinp/tacpendium/internal/model"

// UserResponse は利用者の API 表現。
//
// ★password_hash は載せない。model.User が json:"-" で落としているが、
// ここでも構造として持たないことで二重に担保する(DES-003 §3.10)。
type UserResponse struct {
	ID              int64  `json:"id"`
	Name            string `json:"name"`
	MainCharacterID *int64 `json:"mainCharacterId,omitempty"`
}

// CreateUserRequest は POST /api/users のリクエスト DTO。
type CreateUserRequest struct {
	Name string `json:"name"`
}

// UpdateUserRequest は PATCH /api/users/:id のリクエスト DTO。
type UpdateUserRequest struct {
	Name string `json:"name"`
}

func toUserResponse(u *model.User) UserResponse {
	return UserResponse{
		ID:              u.ID,
		Name:            u.Name,
		MainCharacterID: u.MainCharacterID,
	}
}

func toUserResponses(users []model.User) []UserResponse {
	out := make([]UserResponse, 0, len(users))
	for i := range users {
		out = append(out, toUserResponse(&users[i]))
	}
	return out
}
