# Codex 運用ルール

## 1. 目的

この文書は、Tacpendium で Claude Code を主系、Codex を製造作業の補助系として併用するための人間向け運用メモである。
将来作成する設定同期用カスタムコマンドも、この文書の正本・派生物・同期条件に従う。

Codex の主な担当は、コーディング、テスト、ビルド確認、コードレビューとする。設計、調査計画、指示書作成、マイルストーン／フェーズ管理、設計ドキュメント保守は、明示的な依頼がない限り Claude Code 側で行う。

## 2. 基本的な使い方

### Codex Skill の起動

Codex では、Claude Code の `.claude/commands/*.md` をネイティブなスラッシュコマンドとして直接起動しない。製造作業はリポジトリ Skill `$tacpendium-manufacturing-workflow` を指定し、続けてワークフロー名と引数を伝える。

例:

```text
$tacpendium-manufacturing-workflow を使って implement_plan_wt を実行してください。対象は docs/ ... です。
```

```text
$tacpendium-manufacturing-workflow で review_plan_wt を実行してください。レビュー対象は ... です。
```

```text
$tacpendium-manufacturing-workflow を使い、app_build_check を実行してください。
```

Skill は次の順に参照する。

1. `AGENTS.md`
2. `CLAUDE.md`
3. `.claude/commands/<workflow>.md`

`/implement_plan_wt`のようなClaude用スラッシュコマンドがCodexで直接使えるとは想定しない。

### Codex で利用可能な製造ワークフロー

- `add_e2e_spec`
- `app_build_check`
- `audit_validation_coverage`
- `implement_plan`
- `implement_plan_full`
- `implement_plan_wt`
- `implement_plan_full_wt`
- `incorporate_plan`
- `incorporate_plan_wt`
- `precheck_seed_data`
- `research_plan`
- `research_plan_wt`
- `review_plan`
- `review_plan_wt`
- `design_handover_report`

上記以外の設計、指示書、milestone／phase kit、プロンプト、ドキュメント保守系コマンドはClaude Code側で実行する。

一覧に含めた理由が自明でないものの補足（いずれも 2026-07-29 に開発者判断で確認）:

- `research_plan` / `research_plan_wt`: RESEARCH指示書に基づくread-only厳守の実装調査であり、実装の前工程として製造側で完結する。§1の「調査計画はClaude Code側」はRESEARCH指示書そのものの作成を指し、その実行は含まない。
- `design_handover_report`: 成果物はドキュメントだが、実装完了報告を源泉とする製造工程の後段作業である。

## 3. 正本と同期責任

当面はClaude Code側を正本とする。共有方針やClaude用設定を変更した場合、その変更を行うClaude Code側の作業で、影響するCodex派生設定も同じ変更単位で同期する。

Codexが不整合を発見した場合は、原則として正本をCodex側へ合わせて変更せず、差分と必要な同期内容を報告する。明示的に同期を依頼された場合のみ、Claude側の正本を基準にCodex派生設定を更新する。

### Claude側の正本

| 正本 | 管理する内容 |
| --- | --- |
| `CLAUDE.md` | 共通プロジェクト規約、コーディング・テスト規約、Git・危険操作の方針 |
| `web/CLAUDE.md` | web 固有の判断ルール（ブラウザストレージ台帳、コンボ型の3分岐）。**Claude Code のサブディレクトリ CLAUDE.md で、web 配下のファイルを読んだときに on-demand ロードされる** |
| `.claude/rules/*.md` | 特定パスにスコープした規則（`paths:` frontmatter）。階層をまたぐ規則を置く |
| `.claude/settings.json` | Claudeの権限、禁止操作、フック登録とその意図 |
| `.claude/commands/*.md` | 各ワークフローの具体的な手順 |
| `.claude/hooks/*.sh` | 品質チェック、テスト、通知の実装 |

> **Codex は `web/CLAUDE.md` と `.claude/rules/*.md` を読まない**（Codex が読むのは `AGENTS.md` → `CLAUDE.md` → `.claude/commands/<workflow>.md`）。2026-08-10 に root `CLAUDE.md` から一部規則をこれらへ移設したため、**Codex から見えない規則が生じている**。補償として、移設した規則は `scripts/check-browser-storage-keys.sh` / `scripts/check-enum-sync.sh` で機械検査する設計にしてある（lint は Codex の作業結果に対しても効く）。ただし lint は「書いた後」の検査であり「書く前」の抑止ではない。追跡は followup `web-claude-md-codex-invisibility`。

### Codex側の派生物／アダプター

| 派生物 | 役割 |
| --- | --- |
| `AGENTS.md` | `CLAUDE.md`を共通規約としてCodexへ適用し、Codex固有の担当範囲を追加する |
| `.codex/rules/default.rules` | `.claude/settings.json`と`CLAUDE.md`の危険操作禁止をCodex形式で機械強制する |
| `.codex/hooks.json` | `.claude/hooks/*.sh`をCodexのイベントから呼び出すアダプター |
| `.agents/skills/tacpendium-manufacturing-workflow/SKILL.md` | Codexで許可する製造ワークフローと、Claudeコマンドの参照方法を定義する |

### Codex固有であり、単純同期しないもの

次の設定はClaude設定の複製ではなく、CodexまたはDev Container固有の設定である。同期コマンドで無条件に上書きしない。

- `.codex/config.toml`のsandbox、approval、feature設定
- `.devcontainer/Dockerfile`のCodex CLIバージョンとインストール処理
- `.devcontainer/devcontainer.json`の`CODEX_HOME`と名前付きvolume
- `.devcontainer/init-firewall.sh`のOpenAI通信許可
- `.gitignore`のCodex認証・セッション除外

## 4. 二重管理の範囲

すべてを二重管理しているわけではない。

二重管理を避けて共有参照しているもの:

- プロジェクト規約本文は`CLAUDE.md`だけに置き、`AGENTS.md`から参照する。
- ワークフロー本文は`.claude/commands/*.md`だけに置き、Codex Skillから参照する。
- フック実装は`.claude/hooks/*.sh`だけに置き、`.codex/hooks.json`から直接呼び出す。

Claude/Codexそれぞれの形式で二重表現しているため、同期が必要なもの:

- `.claude/settings.json`の禁止方針と`.codex/rules/default.rules`
- `.claude/settings.json`のフック登録と`.codex/hooks.json`
- `.claude/commands`に存在する製造ワークフローと、Codex Skill内の許可ワークフロー一覧
- `CLAUDE.md`の共通方針と、`AGENTS.md`に記載するCodex固有の補足・例外

## 5. 同期トリガー

Claude側で次の変更を行った場合は、同じ作業内で対応先を確認する。

| Claude側の変更 | 確認・同期するCodex側 |
| --- | --- |
| `CLAUDE.md`のGit・危険操作ルール | `AGENTS.md`、`.codex/rules/default.rules` |
| `CLAUDE.md`の製造担当範囲 | `AGENTS.md`、製造Skill |
| root `CLAUDE.md`から`web/CLAUDE.md`・`.claude/rules/`へ規則を移設 | **Codexからは見えなくなる**。移設した規則に機械検査（lint）が付いているかを確認する。付けられない規則は移設せずrootに残す |
| `.claude/rules/*.md`の追加・変更 | 原則同期不要（Codexは読まない）。ただし上記のとおり、Codexにも効かせたい規則ならlintで補償されているかを確認する |
| `.claude/settings.json`のdeny変更 | `.codex/rules/default.rules` |
| `.claude/settings.json`のhook変更 | `.codex/hooks.json` |
| `.claude/hooks/*.sh`の入力形式や環境変数変更 | `.codex/hooks.json`の呼び出し互換性 |
| 製造系`.claude/commands`の追加・削除・改名 | 製造Skillのdescriptionと許可一覧 |
| 製造系コマンド本文の変更 | 原則同期不要。Skillが同じファイルを直接読むため、Codex互換性だけ確認する |
| 設計・指示書系コマンドの変更 | 原則同期不要。Claude専用のため |

> ## ★★【2026-08-12 実測・解決】`.codex/hooks.json` のネイティブ書式と発火証拠
>
> ### 原因と正しい置き場所・書式
>
> Codex 0.147.0 の公式 app-server API `externalAgentConfig/detect` / `externalAgentConfig/import` に、一時 fixture の `.claude/settings.json` を読ませて生成物を取得した。**正しい置き場所はリポジトリ直下の `.codex/hooks.json` のまま**で、トップレベルは任意の `description` と **`hooks` envelope**、その内側が `PreToolUse` / `PostToolUse` / `Stop`、各イベントの配列要素が `{"hooks":[...]}`、command hook が `type` / `command` / `timeout` である。旧設定は envelope が無く、app-server は次を報告していた。
>
> ```text
> failed to parse hooks config /workspaces/combomgr/.codex/hooks.json: unknown field `PreToolUse`, expected `description` or `hooks` at line 3 column 14
> ```
>
> 生成物を基準に envelope を直し、実装の正本である `.claude/hooks/*.sh` への直接参照だけを維持した。再読込時に信頼確認が出て、許可後の `hooks/list` は **project hook 5 件を enabled / trusted、matcher は全件 null、error / warning なし**と報告した。
>
> ### `Stop` に関する訂正
>
> 旧記録の「Codex に `Stop` は存在しない」は誤りだった。Codex 0.147.0 自身の `/hooks` 画面と app-server API は **`Stop`（turn 終了直前）と `SessionEnd`（session 終了直前）の両方**を列挙し、公式 importer も Claude の `Stop` を `Stop` のまま生成した。そのため `stop-test.sh` / `notify-bell.sh` は `Stop` に維持した。なお `SessionEnd` の command timeout は最大 3 秒へ clamp されるため、最大 300 秒を要する `stop-test.sh` の代替ではない。
>
> ### `PreToolUse` の発火証拠
>
> 開発者が `tmp/.design-desk-armed` を置いた後、信頼済みの新規 Codex セッションから shell 経路で **`git status --short`** を実行し、次の全出力でブロックされた。
>
> ```text
> Command blocked by PreToolUse hook: design-desk-guard: 武装マーカーがあるのに実装ソースが作業ツリーに存在します。
>   物理排除の前提が崩れています。開発者へ報告し、再武装するまで作業を止めてください
>   (bash scripts/design-desk-arm.sh --status で確認できます)。 Command: git status --short
> ```
>
> 旧設定で同じ条件・同じコマンドが素通りした対照実験に対し、**ネイティブ envelope へ直した後は実際に exit 2 で止まった**。検証後、開発者がマーカーを削除した。
>
> ### `PostToolUse` の発火証拠と入力互換
>
> Codex の実ペイロードを一時的に記録すると、`apply_patch` は `.tool_input.file_path` ではなく `.tool_input.command` に `*** Add File:` / `*** Update File:` のパスを持っていた。正本の `post-edit-check.sh` は `file_path` を読むため、`.codex/hooks.json` 側だけで実測した patch パスを `file_path` へ変換して渡す adapter を置いた。matcher は付けず、複数パスを重複排除して正本へ 1 件ずつ渡す。
>
> 未整形の `tmp/hooktest/main.go` を Codex の `apply_patch` で編集した結果、hook 完了表示とともに次が出た。
>
> ```text
> [品質フック] tmp/hooktest/main.go の編集後チェックで指摘:
> gofmt: 未フォーマット (tmp/hooktest/main.go)。`gofmt -w` 相当の整形が必要。
> ```
>
> 検証後に `tmp/hooktest` は削除した。**PreToolUse のブロックと PostToolUse の指摘を実セッションで確認したため、この層は有効として扱う。** ツール名 matcher の値は独立に実測していないため設定せず、無関係な入力を各スクリプトが exit 0 にする設計を使う。同期の完了条件には、今後も設定の保存だけでなく**発火の実測**を含める。

## 6. 同期作業の手順

将来の設定同期用カスタムコマンドは、少なくとも次の順序で動作させる。

1. 変更されたClaude側の正本を特定する。
2. 上の同期トリガー表から影響するCodex派生物を特定する。
3. Claude側を正としてCodex派生物だけを更新する。
4. コマンド本文やフックスクリプトをCodex側へコピーせず、参照を維持する。
5. Codex固有設定を、対応するClaude設定がないという理由だけで削除しない。
6. JSON、TOML、shell、Codex rule、Skill metadataを検証する。
7. `git diff`で正本と派生物以外の変更が混入していないことを確認する。
8. 同期できない項目や1対1変換できない項目を報告する。

最低限の検証例:

```bash
jq -e . .claude/settings.json .codex/hooks.json
python3 -c 'import tomllib; tomllib.load(open(".codex/config.toml", "rb"))'
bash -n .claude/hooks/*.sh
git diff --check
```

## 7. 同期時の注意事項

- `.claude/settings.json`のallow／denyとCodexのsandbox／rulesは仕様が異なるため、機械的な文字列コピーをしない。
- `allowed-tools`などClaude固有のfrontmatterは、Codexに対する実行権限とは扱わない。
- Codex Skillの許可一覧へ設計・指示書系コマンドを自動追加しない。
- `.claude`配下の既存ファイルをCodex対応だけを理由に削除・改名しない。
- `~/.codex`、`CODEX_HOME`、`auth.json`、トークン、セッション、個人設定を同期・表示・コミットしない。
- 同期後もClaude CodeとCodexの両方で完全に同じ強制力になるとは限らない。変換できない制約は文章ルールとして残し、差分を報告する。
- コミットの実施可否は、その作業に対するユーザーの明示指示を優先する。

## 8. 現在の運用方針

- メイン開発と設計作業: Claude Code
- 実装、テスト、ビルド確認、レビューの補助: Codex
- 共通規約の正本: `CLAUDE.md`
- ワークフローの正本: `.claude/commands`
- フック実装の正本: `.claude/hooks`
- 設定同期の責任: Claude側の設定を変更する作業、および将来作成するClaude用同期コマンド
- Codex側での独自変更: Codex固有機能に必要な最小限のみ
