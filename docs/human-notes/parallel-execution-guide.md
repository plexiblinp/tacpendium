# 並列実行ガイド(開発者向け運用メモ)

| 項目 | 内容 |
|------|------|
| 文書ID | PARALLEL-EXEC-GUIDE |
| バージョン | 1.0.0 |
| 作成日 | 2026-04-30 |
| 用途 | 開発者個人の運用メモ。並列で複数指示書を実行する際の手順・プロンプト・Git 操作の参考として使う。指示書本体ではないため、Claude Code に必読指定はしない |
| メンテナンス方針 | M1 以降の並列実行で得た知見を随時追記する。形式は自由 |

---

## 1. 段階的並列の基本方針

8並列同時実行は技術的には可能だが、認知負荷とファイル衝突リスクから **2並列×N段階** を推奨。

### M1 後半の例

```
段階1: M1-04 + M1-07
  - M1-04(プリセット解決、Opus 4.6): バックエンド系、依存大
  - M1-07(debug API、Sonnet 4.6): 独立性高、最小

段階2: M1-05 + M1-06
  - M1-05(コンボ一覧・詳細、Sonnet 4.6): フロント系
  - M1-06(コンボ登録・編集、Sonnet 4.6): フロント系

各段階で 製造2 + レビュー2 = 4ターミナル稼働
```

### ペアリングの原則

- バックエンド系 + 独立小規模 を1段階目に(API 安定後にフロント着手)
- 同種(両方フロント等)は後段階に

---

## 2. ターミナル構成

各段階で以下4ターミナルを開く:

| # | 役割 | 担当 | フォルダ | モデル |
|---|------|------|---------|--------|
| 1 | 製造 | M1-XX | worktree A | 指示書指定 |
| 2 | レビュー | M1-XX | worktree A(同フォルダ) | 1段下 |
| 3 | 製造 | M1-YY | worktree B | 指示書指定 |
| 4 | レビュー | M1-YY | worktree B(同フォルダ) | 1段下 |

レビュー担当は読み取り専用なので、製造担当と同じ worktree フォルダを使って問題ない。

---

## 3. Git worktree セットアップ

### 段階1の準備(M1-04 + M1-07 例)

```bash
# 親ブランチ(案C ハイブリッド構成、SUPP-001 §6.1)に移動
cd ~/projects/combomgr
git checkout feature/m1-core-foundation
git pull origin feature/m1-core-foundation

# 並列ブランチ作成
git branch feature/m1-04-presets
git branch feature/m1-07-debug-api

# worktree 作成
git worktree add ../combomgr-m1-04 feature/m1-04-presets
git worktree add ../combomgr-m1-07 feature/m1-07-debug-api

# 確認
git worktree list
```

### 各 worktree の初期化

```bash
# 各 worktree で1回ずつ実行
cd ../combomgr-m1-04
cd web && pnpm install   # node_modules は worktree 別に必要
cd ..

cd ../combomgr-m1-07
cd web && pnpm install
cd ..
```

### 並列開発中の DB 衝突回避

開発時の SQLite DB は OS 別アプリデータディレクトリ(例: `~/Library/Application Support/tacpendium/`)にあるため、worktree 間で**共有される**。並列で別 DB を使いたい場合は `config.toml` で worktree ごとに別パス指定:

```toml
# tacpendium-m1-04/config.toml
[database]
path = "./tacpendium-m1-04.db"

# tacpendium-m1-07/config.toml
[database]
path = "./tacpendium-m1-07.db"
```

このパスは `.gitignore` で `*.db` 除外済みなのでコミットされない。

### 完了後のマージ

```bash
cd ~/projects/combomgr  # 親 worktree
git pull origin feature/m1-core-foundation

# マージ(衝突発生時は手動解決)
git merge feature/m1-04-presets
git merge feature/m1-07-debug-api

git push origin feature/m1-core-foundation
```

### worktree クリーンアップ

```bash
git worktree remove ../combomgr-m1-04
git worktree remove ../combomgr-m1-07

# 不要ブランチを削除する場合(マージ済みなら -d、強制は -D)
git branch -d feature/m1-04-presets feature/m1-07-debug-api
```

---

## 4. プロンプトテンプレート

開発者が各ターミナルに投入するプロンプト例。**指示書本体には含めない**(プロンプトは状況に応じて調整するため)。

### 製造担当向け

```
docs/instructions/M1-XX-{タイトル}.md を読み、Plan Mode で計画を提示してください。

【並列実行中の注意】
現在、以下の指示書が並列で実装中です:
- M1-XX(あなたの担当): {タイトル}
- M1-YY: {タイトル}

あなたの作業範囲:
- 担当: M1-XX
- ブランチ: feature/m1-XX-{タイトル}

他指示書と衝突する可能性のあるファイル:
- cmd/tacpendium/main.go(ルート登録、各指示書から追記される)
  → あなたの追記範囲を最小化、他のルート登録は触らない
- {他に競合可能性のあるファイルがあれば列挙}

不明点があれば実装前に Plan Mode で質問してください。
```

### レビュー担当向け

```
docs/instructions/M1-XX-{タイトル}.md と
docs/instructions/reviews/M1-XX-review-checklist.md を読み、
製造担当が作成したファイル群を view ツールで確認してレビューしてください。

【並列実行中の注意】
他指示書(M1-YY)も並列実装中のため、以下のファイルへの変更が
含まれていてもエラー報告しないでください:
- cmd/tacpendium/main.go(ルート登録の追記は他指示書と並行する)

あなたのレビュー対象は M1-XX の §2 で定義された成果物のみ。
他指示書のスコープに踏み込まないよう注意してください。

レビュー結果を docs/progress/m1-XX-review.md に出力してください。
```

---

## 5. 想定スケジュール(M1 後半の例)

| フェーズ | 所要時間 | 並列 |
|---------|---------|------|
| 段階1 worktree セットアップ | 5〜10分 | - |
| 段階1 製造(M1-04 + M1-07) | 90〜120分 | 2並列 |
| 段階1 レビュー | 30〜60分 | 2並列 |
| 段階1 マージ + クリーンアップ | 10〜15分 | - |
| 段階2 worktree セットアップ | 5〜10分 | - |
| 段階2 製造(M1-05 + M1-06) | 90〜120分 | 2並列 |
| 段階2 レビュー | 30〜60分 | 2並列 |
| 段階2 マージ + クリーンアップ | 10〜15分 | - |
| **合計** | **約4〜5時間** | |

直列実行(6〜8時間)との比較で約 30〜40% の時間短縮、かつ認知負荷は 8並列より大幅に軽い。

---

## 6. トラブルシューティング

### Plan Mode で他ターミナルと矛盾する計画が出てきた場合

両 Plan Mode を比較し、矛盾箇所を特定。後着手の Claude に「先着の Plan ではこう決まったので合わせてください」と指示。

### マージ衝突が頻発する場合

- 両ブランチで `cmd/tacpendium/main.go` の同じ箇所を編集していないか確認
- 衝突箇所はほぼ「import 文」「ルート登録ブロック」のいずれか
- 手動で両方の追記を統合してコミット

### レビュー担当が他指示書のスコープを侵食して指摘してきた場合

レビュー報告書を見て、本指示書 §2「成果物」に含まれない指摘を**無視するか別途対応**として分類。

---

*以上*
