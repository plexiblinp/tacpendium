//go:build embed_web

// 配布(embed)ビルド: フロントエンドのビルド成果物 web/dist を Go バイナリに同梱する。
// dev / test ビルドはこのファイルではなく embed_web_stub.go(//go:build !embed_web)を使い、
// web/dist を必要としない。配布バイナリは `go build -tags=embed_web` でビルドする(Makefile build)。
//
// 本ファイルがリポジトリルートに置かれている理由は embed_migrations.go と同じ:
// //go:embed パターンに `..` を含められないため、web/dist を embed する Go ファイルは
// web/dist の親(リポジトリルート)に存在する必要がある。

package tacpendium

import (
	"embed"
	"io/fs"
)

// distFS は web/dist 配下のフロントエンドビルド成果物を埋め込んだ embed.FS。
// `all:` プレフィックスにより `_` や `.` 始まりのファイルも取り込む。
//
//go:embed all:web/dist
var distFS embed.FS

// WebEmbedded はフロントエンドがバイナリに埋め込まれているかを示す。
// 配布(embed_web タグ)ビルドでは true、dev/test ビルドでは false。
const WebEmbedded = true

// WebFS は埋め込まれた web/dist をルート("/" = index.html)とした fs.FS を返す。
// 静的配信ハンドラ(internal/api/static)に渡して使用する。
func WebFS() (fs.FS, error) {
	return fs.Sub(distFS, "web/dist")
}
