// Package move は技マスタの読み取り専用リポジトリを提供する。
//
// M1-06 でフロントエンドの技セレクタが必要としたため、最小実装として
// 「キャラクター ID で全技を取得」のみを提供する。
//
// 表示名(name_ja)は moves テーブルに存在せず preset_aliases.alias_text で管理されるため、
// official_ja_move プリセットの alias を LEFT JOIN で取得する(DES-004 §1.2)。
package move
