package datadir

import "net/url"

// urlPath は SQLite の file: URI へ載せるためのパスのエスケープ。
// internal/infra/db の escapeDBPath と同じ規則(非公開なので同型を持つ)。
type urlPath struct{ p string }

func (u *urlPath) escaped() string {
	return (&url.URL{Path: u.p}).EscapedPath()
}
