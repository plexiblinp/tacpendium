// Package user はユーザーに関する SQL クエリを集約する。
//
// ★簡易パスワードは users 表ではなく config.toml の [security] に置く
// (全ユーザー共通の 1 本であるため。DES-002 §8)。users.password_hash 列は
// 未使用のまま残っている。
//
// ★削除は提供しない。tags / presets が ON DELETE CASCADE で users を参照しており、
// 利用者を消すとその人のタグ・プリセットが一括で消えるためである。
package user
