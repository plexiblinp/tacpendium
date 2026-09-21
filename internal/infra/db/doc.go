// Package db は SQLite 接続管理(WAL モード設定、PRAGMA 適用、ファイルパス解決)を提供する。
//
// ★アプリ標準 PRAGMA は接続文字列で指定しており、プール中のすべての接続へ効く
// (M23-10。プール確立後に Exec する形へ戻さないこと。理由は db.go の dsnPragmaParams)。
//
// 詳細実装は db.go を参照。M1-02 で実装、M23-10 で PRAGMA の適用経路を変更。
package db
