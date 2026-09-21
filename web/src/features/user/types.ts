// 利用者の API 型。Go 側 internal/api/user/dto.go と目視で対応させる(camelCase 統一)。
//
// ★「ユーザー選択」は認証ではない(DES-002 §8)。名前を選ぶだけであり、
// タグ・プリセットのスコープと「誰の編集か」の札として働く(FR013 / FR501)。

export interface User {
  id: number;
  name: string;
  mainCharacterId?: number;
}

export interface CreateUserRequest {
  name: string;
}

export interface UpdateUserRequest {
  name: string;
}
