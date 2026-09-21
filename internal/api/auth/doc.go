// Package auth は簡易パスワードの HTTP エンドポイントを提供する。
//
// 提供する経路は 4 本(いずれも認証ミドルウェアの保護対象から外す。理由は routes.go)。
//   - POST /api/auth/login    ログインしてセッションを発行する
//   - POST /api/auth/logout   セッションを破棄する
//   - GET  /api/auth/status   パスワードを求めるべきかを画面へ伝える
//   - POST /api/auth/password パスワードを設定・変更する
//
// ★パスワード・検証子・セッション ID を応答本文にもエラーメッセージにも載せない
// (SUPP-001 §5.6)。ログイン失敗は理由を区別せず 1 種類の応答を返す。
package auth
