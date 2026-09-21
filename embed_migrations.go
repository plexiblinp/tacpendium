// Package tacpendium はリポジトリルートに置かれた embed.FS ホルダパッケージ。
//
// 本パッケージの役割は単一: `migrations/*.sql` を Go バイナリに埋め込み、
// `MigrationsFS` として export することのみ。
//
// 本ファイルがプロジェクトルートに置かれている理由:
// Go の `//go:embed` ディレクティブは embed パターンに `..` を含めるとコンパイル
// エラーになるため、`migrations/` を embed する Go ファイルは `migrations/` の
// 親ディレクトリ(つまりリポジトリルート)に存在する必要がある。
// 詳細は M1-02 指示書 §4.1.1 を参照。
//
// 利用方法:
//
//	import tacpendium "github.com/plexiblinp/tacpendium"
//	import "github.com/plexiblinp/tacpendium/internal/infra/migration"
//
//	migration.Run(ctx, dbPath, tacpendium.MigrationsFS)
package tacpendium

import "embed"

// MigrationsFS は migrations/ 配下の .sql ファイルを埋め込んだ embed.FS。
// `internal/infra/migration` パッケージの Run 関数に渡して使用する。
//
//go:embed migrations/*.sql
var MigrationsFS embed.FS
