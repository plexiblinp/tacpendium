import type {
  CreateTagInput,
  Tag,
  TagErrorResponse,
  UpdateTagInput,
} from "@/types/tag";

export class TagApiError extends Error {
  status: number;
  body: TagErrorResponse | null;

  constructor(status: number, body: TagErrorResponse | null, message: string) {
    super(message);
    this.status = status;
    this.body = body;
  }

  get code(): string | undefined {
    return this.body?.error.code;
  }

  get usageCount(): number | undefined {
    return this.body?.error.details?.usageCount;
  }
}

async function request<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(path, {
    credentials: "same-origin",
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    let body: TagErrorResponse | null = null;
    try {
      body = (await res.json()) as TagErrorResponse;
    } catch {
      // JSON パース失敗時は body=null のまま
    }
    throw new TagApiError(res.status, body, `HTTP ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const tagApi = {
  list(params?: {
    category?: string;
    includeUsage?: boolean;
    characterId?: number;
  }): Promise<Tag[]> {
    const qs = new URLSearchParams();
    if (params?.category) qs.set("category", params.category);
    if (params?.includeUsage) qs.set("include_usage", "true");
    // E-3: usageCount を選択キャラのコンボのみで集計する。
    if (params?.characterId !== undefined) {
      qs.set("character_id", String(params.characterId));
    }
    const query = qs.toString();
    return request<Tag[]>(`/api/tags${query ? `?${query}` : ""}`);
  },

  get(id: number): Promise<Tag> {
    return request<Tag>(`/api/tags/${id}`);
  },

  create(input: CreateTagInput): Promise<Tag> {
    return request<Tag>("/api/tags", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  update(id: number, input: UpdateTagInput): Promise<Tag> {
    return request<Tag>(`/api/tags/${id}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    });
  },

  delete(id: number, force = false): Promise<void> {
    return request<void>(`/api/tags/${id}${force ? "?force=true" : ""}`, {
      method: "DELETE",
    });
  },
};
