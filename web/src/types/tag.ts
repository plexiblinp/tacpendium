export interface Tag {
  id: number;
  userId: number;
  name: string;
  category?: string;
  color?: string;
  usageCount?: number;
}

export interface CreateTagInput {
  name: string;
  category?: string;
  color?: string;
}

export interface UpdateTagInput {
  name?: string;
  category?: string;
  color?: string;
}

// 注: キーは internal/api/tag/handler.go:163-164 が詰めるものと 1 対 1 で対応する。
// ★片側だけ直すと型検査もテストも通ったまま値が undefined になる(M35-01 段 2)。
// 両端は internal/api/tag/handler_test.go の TestDeleteTag_409_InUse_DetailKeysAreCamelCase と
// web/src/features/tag/api/tagApi.test.ts が同一の JSON で留めている。
export interface TagErrorDetail {
  usageCount?: number;
  forceDeleteQuery?: string;
}

export interface TagErrorBody {
  code: string;
  message: string;
  details?: TagErrorDetail;
}

export interface TagErrorResponse {
  error: TagErrorBody;
}
