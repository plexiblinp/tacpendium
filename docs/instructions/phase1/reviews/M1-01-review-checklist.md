# M1-01 レビューチェックリスト

| 項目 | 内容 |
|------|------|
| 文書ID | M1-01-REVIEW |
| バージョン | 1.0.0 |
| 対象指示書 | `docs/instructions/M1-01-project-skeleton.md` |
| 用途 | 品質レビュー担当 Claude が独立レビュー時に使用するチェックリスト |

---

## 0. レビュー担当の作業手順

1. 本ファイル(レビューチェックリスト)、対象指示書本体、CLAUDE.md、SUPP-001 を読む
2. 指示書 §3「前提条件」で必読指定された設計書のうち、レビューに必要な箇所を読む
3. 製造ターミナルで作成されたファイル群を `view` ツールで読む
4. 下記チェックリストに沿ってレビュー実施
5. レビュー結果を `docs/progress/m1-01-review.md` に出力

**重要ルール:**

- コードは一切変更しない(`view` ツールで読取のみ)
- ファイル作成は `docs/progress/m1-01-review.md` のみ
- Git 操作はしない(`.claude/settings.json` で機械強制済み)
- 不明点があれば「不明: ○○について判断できない」と報告書に記載し、推測で進めない

---

## 1. 設計準拠性

- [ ] SUPP-001 §5.2 の Go パッケージ構成と一致しているか(`cmd/`、`internal/api/`、`internal/service/`、`internal/repository/`、`internal/model/`、`internal/config/`、`internal/infra/`)
- [ ] SUPP-001 §5.3 のフロントエンド構成と一致しているか(`pages/`、`features/`、`components/`、`layouts/`、`lib/`、`types/`、`locales/`)
- [ ] SUPP-001 §5.6 のロギング戦略(slog + lumberjack、MaxSize=10MB、MaxBackups=5、MaxAge=30日、Compress=false)が実装されているか
- [ ] SUPP-001 §5.8 の設定ファイルフォーマット(TOML、`[server]/[database]/[logging]/[security]` セクション)が踏襲されているか
- [ ] **SUPP-001 §2.6.1 のCORS実装方針が厳守されているか**:
  - 起動時に固定リスト構築(リクエスト時動的判定なし)
  - ワイルドカード `*` 許可なし
  - LAN内全プライベートIP自動許可なし
  - mode=local では localhost/127.0.0.1 のみ
  - mode=lan では代表IP1つを追加
- [ ] SUPP-001 §2.6.2 の仮想NIC除外パターンが `IsVirtualInterface()` に網羅されているか

## 2. コード品質

- [ ] エラーラップが `fmt.Errorf("...: %w", err)` 形式で実装されているか
- [ ] `context.Context` が必要な箇所に第一引数として導入されているか(M1-01ではサービス層が空なので、ハンドラのみ)
- [ ] 公開関数(大文字始まり)に godoc コメントがあるか
- [ ] `panic` の使用が回避されているか(初期化失敗時の main 以外で使われていないか)
- [ ] TypeScript: `strict` 有効、`any` 使用がないか
- [ ] フロント: ブラウザストレージAPI(`localStorage`等)の使用がないか

## 3. 完成度

- [ ] `make run-server` でサーバーが起動するか(コードレビューで起動可能性を判断)
- [ ] `make run-web` でフロント開発サーバーが起動するか(同上)
- [ ] HealthCheckPage がサーバー接続OKを表示する実装になっているか
- [ ] `make test` のターゲットが Makefile に存在し、Goテスト・フロントテストの両方を実行する内容になっているか
- [ ] **パッケージマネージャ pnpm 9.13** の運用が適切か:
  - `web/package.json` に `"packageManager": "pnpm@9.13.x"` フィールドが設定されている
  - `web/pnpm-lock.yaml` が生成されている
  - `web/package-lock.json` および `web/yarn.lock` が存在しない(`.gitignore` に追加されている)
  - Makefile のフロント関連コマンドが `pnpm run` ベース(`npm run`/`yarn run` ではない)
- [ ] Go バージョンが `1.26.2` である(`go.mod` の `go` ディレクティブ)

## 4. 禁止事項チェック

- [ ] `localStorage`、`sessionStorage`、`IndexedDB` の使用がないか
- [ ] `console.log` / `fmt.Println` の本番コード残存がないか(テストコード・初期化ログは除く)
- [ ] Git 操作の Bash 実行がないか
- [ ] 設計書に記載のない機能が勝手に追加されていないか

## 5. テスト網羅性

- [ ] `internal/config/config_test.go` で Load の正常系・ファイル不在系・不正TOML系・環境変数上書きがテストされているか
- [ ] `internal/infra/netutil/private_ip_test.go` で IsVirtualInterface・IsPrivateIPv4・SelectPrimaryLANIP の主要ケースがテストされているか
- [ ] `web/src/lib/api-client.test.ts` で fetchJSON の正常系・HTTPエラー時の挙動がテストされているか

---

## 6. 出力フォーマット(`docs/progress/m1-01-review.md`)

以下の構成で出力すること。

```markdown
# M1-01 レビュー報告書

## 総評
(全体所感を3〜5行)

## 設計準拠性レビュー結果
| チェック項目 | 結果 | 詳細 |
|-------------|------|------|
| (チェックリスト §1 各項目) | ◎/○/△/× | (具体的な指摘) |

## コード品質レビュー結果
(チェックリスト §2 の項目別評価)

## 完成度レビュー結果
(チェックリスト §3 の項目別評価)

## 禁止事項違反の有無
(チェックリスト §4 の項目別評価)

## テスト網羅性
(チェックリスト §5 の項目別評価)

## 推奨修正(優先度別)
- 高(M1-02 着手前に修正必須):
- 中(M1-02 着手と並行可):
- 低(将来対応):

## 良かった点
(Claude Code へのフィードバックとして残す)

## 制約事項
- 本レビューはコード上で判定可能な範囲のみ対象。実際の動作確認・パフォーマンス・実機テストは別途実施が必要。
```

---

*以上*
