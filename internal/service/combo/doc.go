// Package combo はコンボのビジネスロジック(CRUD、重複判定、編集方式分離、楽観的排他、
// 論理削除、recipe_hash 計算)を集約する。
//
// M1-03 で実装済み。詳細実装は service.go / duplicate_keys.go を参照。
package combo
