//go:build !embed_web

// dev / test ビルド: フロントエンドを埋め込まないスタブ。web/dist が不在・空でも
// `go build` / `go test` / `go run` が成功する(dev は Vite + proxy で配信するため)。
// 配布(embed)バイナリは embed_web_release.go(//go:build embed_web)を使い、
// `go build -tags=embed_web` で web/dist を同梱する。

package tacpendium

import "io/fs"

// WebEmbedded はフロントエンドがバイナリに埋め込まれているかを示す。
// dev/test ビルドでは false(静的配信ハンドラ・ブラウザ自動起動を登録しない)。
const WebEmbedded = false

// WebFS は dev/test ビルドでは埋め込み FS を持たないため nil を返す。
// 呼び出し側は WebEmbedded で分岐し、本関数を呼ばない想定。
func WebFS() (fs.FS, error) {
	return nil, nil
}
