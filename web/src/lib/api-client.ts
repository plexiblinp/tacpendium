// API_BASE: 開発時(Vite dev server)はプロキシに任せて空文字、本番は同一オリジン直接。
// 開発時の Vite proxy 設定により /api/* はバックエンドへ転送される(転送先は vite.config.ts の
// resolveApiTarget が config.toml の [server].port 等から解決。L-04 フォールバックポートに追従)。
const API_BASE = "";

export async function fetchJSON<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: "same-origin",
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`HTTP ${res.status}: ${body}`);
  }
  // 204 No Content は空ボディのため res.json() が SyntaxError を投げる。
  // DELETE 等の void エンドポイント向けに undefined を返す。
  if (res.status === 204) {
    return undefined as T;
  }
  return (await res.json()) as T;
}
