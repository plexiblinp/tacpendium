# dev-throwaway-db.sh — 使い捨てDBで dev バックエンドを起動する

> `scripts/dev-throwaway-db.sh` の使い方メモ。スクリプト本体と対で `scripts/` に置き、
> git 追跡下にある(2026-07-26 に `tmp/` の退避メモから正式採用へ昇格)。
> 関連: worktree 並列運用は [`docs/human-notes/worktree-scripts-guide.md`](../docs/human-notes/worktree-scripts-guide.md)。

## これは何か

並列ブランチが別々に migration を追加すると、共有 dev DB
(`~/.local/share/tacpendium/tacpendium.db`)の `schema_migrations` が別ブランチの
バージョンまでスタンプされる。その状態でこちら側のブランチで
`go run ./cmd/tacpendium` すると、golang-migrate が DB のバージョンに対応する
migration ファイルを見つけられず、以下で起動 abort する:

```
fatal: migration: migration: up: no migration found for version NN: ...
```

これは**ブランチ跨ぎの DB 状態競合**であり、コードのバグではない。

`dev-throwaway-db.sh` は `TACPENDIUM_DB_PATH` でリポジトリ直下の**使い捨て DB**を
指定して起動する。使い捨て DB にはこのブランチの migration だけが新規適用され、
シードも投入される。**実 dev DB(別ブランチが使う本番相当)には一切触れない**ため、
他ブランチの起動にも影響しない。

## 使い方

```bash
# リポジトリルートで
scripts/dev-throwaway-db.sh              # 既定: scratch-<branch>.db を使う
scripts/dev-throwaway-db.sh --fresh      # 既存の使い捨て DB を消してから作り直す
scripts/dev-throwaway-db.sh my.db        # DB ファイル名を明示(リポジトリ直下・*.db のみ)
```

- 実行権限が無ければ `chmod +x scripts/dev-throwaway-db.sh`、または `bash scripts/dev-throwaway-db.sh`。
- 当セッション(Claude Code)からターミナル実行したい場合は `! scripts/dev-throwaway-db.sh` も可。
  ただし常駐サーバのため、通常は開発者がターミナルで直接起動するのが自然。

### 画面確認まで

1. 上記でバックエンドを起動(migration がこのブランチ分だけ新規適用される)。
2. 別ターミナルでフロント: `cd web && pnpm run dev` → ブラウザで http://localhost:5173/
   - Vite proxy はバックエンドが `config.toml` に書いた採用ポートを読んで自動追従する。
3. 使い捨て DB はシードのみでユーザーデータは空。詳細画面等を見たい場合は
   画面上でテスト用データ(コンボ等)を作ってから確認する。

## 仕様上のポイント(なぜこの作りか)

- **DB ファイル名はブランチ名由来**(`scratch-<sanitized-branch>.db`)。ブランチ毎に
  別ファイルになるので、ブランチを行き来しても使い捨て DB 自体がバージョン競合しない。
- **`*.db` は `.gitignore` 済み**(`.gitignore` の `*.db` / `*.db-wal` / `*.db-shm`)。
  よってリポジトリ直下に置いてもブランチを汚さない。
- **リポジトリ直下の単純ファイル名のみ許可**(パス区切り・`..` を拒否)。バックエンドの
  `ValidateDataPath`(cwd 配下・`..` 不可)を確実に満たすため。
- **`TACPENDIUM_PORT` は設定しない**。設定するとポートフォールバック(L-04)が
  `config.toml` へ採用ポートを書かなくなり、Vite proxy が旧ポートを見て不一致になる。
  既定のままにすることで「バックエンドが `config.toml` に書く → Vite が読む」の追従が働く。
- **git 操作はしない**。履歴改変・push 等は一切行わない。

## 後片付け

```bash
rm -f scratch-<branch>.db scratch-<branch>.db-wal scratch-<branch>.db-shm
```

使い捨て DB は gitignore 済みなので放置してもブランチは汚れないが、環境を綺麗に
保つなら削除する。実 dev DB は終始未変更。

## 判定メモ(create_command ルーブリック)

- 判定: **候補A(シェルスクリプト単体・コマンドラッパー無し)**。
- 理由: 入出力が固定で判断・文章生成・コード理解を含まない。かつ対象が長時間稼働の
  dev サーバで、Claude にコマンド経由で実行させる必然性が無い(トークン浪費回避)。
- 不採用: コマンド化(候補B)=判断不要なためトークン浪費。フック(候補C)=品質ゲート/
  常時強制ルールではなく随時操作のため。
