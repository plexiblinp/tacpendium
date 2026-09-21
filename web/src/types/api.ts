// API 型定義(手書き)。Go 側のレスポンス型と目視で対応させる。
// 本格的な型は M1-03 以降で追加する。

export interface HealthResponse {
  status: string;
  version: string;
}
