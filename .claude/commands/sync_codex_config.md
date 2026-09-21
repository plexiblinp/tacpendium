---
description: Claude 側の正本(CLAUDE.md / settings.json / commands / hooks)の変更を、human-notes/codex/README.md の同期ルールに従って Codex 派生物(AGENTS.md / .codex/rules / .codex/hooks.json / 製造 Skill)へ反映する。逆方向は報告のみ。
argument-hint: "[to-codex | from-codex] [--check]"
allowed-tools: Read, Edit, Write, Grep, Glob, Bash(git rev-parse:*), Bash(git diff:*), Bash(git status:*), Bash(git log:*), Bash(ls:*), Bash(diff:*), Bash(jq:*), Bash(python3:*), Bash(bash:*)
---

# Codex 設定同期(Claude 正本 → Codex 派生物)

Claude 側の正本の変更を Codex 派生物へ反映する。**正本の設計・同期条件は `human-notes/codex/README.md` が持つ**。本コマンドはその手順(§6)を実行する薄い運用ラッパーであり、README とルールが食い違った場合は **README を優先**して停止・報告する。

> 本コマンドは低頻度・判断主体の同期作業である。機械的な文字列コピーをしてはならない(README §7)。Claude と Codex は表現形式が異なるため、意味を理解した上で Codex 形式へ変換する。

## 引数

`$ARGUMENTS` を次のように解釈する(いずれも省略可)。

- 方向: `to-codex`(既定) / `from-codex`
- モード: `--check`(dry-run。検出・報告のみで一切編集しない)

| 指定 | 動作 |
| --- | --- |
| (無指定) / `to-codex` | Claude 正本を正として Codex 派生物を更新する(本コマンドの主用途) |
| `to-codex --check` | Claude→Codex のドリフトを検出し報告するのみ。編集しない |
| `from-codex` | **報告のみ**。Codex 側の独自変更・乖離を検出し「Claude 正本へ取り込むべきか」を開発者へ提案する。**Claude 正本ファイル(CLAUDE.md / .claude/settings.json / .claude/commands / .claude/hooks)は編集しない** |

`from-codex` は README §3・§7 の正本方針に従い、常に提案書止まり。取り込みの実施可否は開発者が判断する。

## 前提の確認(最初に実行)

1. `git rev-parse --show-toplevel` でリポジトリルートを解決し、以降そのルート内のみを対象にする。
2. Codex アダプタの実在を確認する: `AGENTS.md` / `.codex/rules/default.rules` / `.codex/hooks.json` / `.agents/skills/tacpendium-manufacturing-workflow/SKILL.md` / `human-notes/codex/README.md`。
   - **いずれも存在しない場合は停止**し、「Codex アダプタがこのツリーに未マージ(`wt-codex-setup` ブランチにのみ存在)」の可能性を報告する。推測で新規作成しない。
3. `human-notes/codex/README.md` を通読し、正本表(§3)・二重管理の範囲(§4)・同期トリガー表(§5)・手順(§6)・注意事項(§7)を作業の根拠とする。

## 同期対象マップ(README §4「同期が必要なもの」のみ)

**参照共有のため二重管理しておらず、同期不要(コピー・書き換え禁止)**:
- プロジェクト規約本文 → `CLAUDE.md` のみ(`AGENTS.md` は参照)
- ワークフロー本文 → `.claude/commands/*.md` のみ(Skill が直接読む)
- フック実装 → `.claude/hooks/*.sh` のみ(`.codex/hooks.json` が直接呼ぶ)

**Claude/Codex で別形式に二重表現しており、同期が必要な4点**:

| # | Claude 正本 | Codex 派生物 | 変換の要点 |
| --- | --- | --- | --- |
| 1 | `.claude/settings.json` の deny 方針 | `.codex/rules/default.rules` | deny の禁止コマンド群を Codex の `prefix_rule(... decision="forbidden")` として表現。**文字列直写ししない**。allow/deny と sandbox/rules は仕様が違う |
| 2 | `.claude/settings.json` の hook 登録 | `.codex/hooks.json` | イベント→スクリプト対応を移す。**Codex に無いイベント(例: `Notification`)は表現可能なイベントへ寄せる**(現状 `notify-bell.sh` は Claude の `Notification` → Codex では `Stop` の2本目)。呼び出しは `.claude/hooks/*.sh` を直接叩く形を維持 |
| 3 | `.claude/commands/` の**製造系**コマンド集合 | Skill の `description` と許可ワークフロー一覧(`SKILL.md`) | 製造系(add_e2e_spec / app_build_check / audit_validation_coverage / design_handover_report / implement_plan{,_full,_wt,_full_wt} / incorporate_plan{,_wt} / precheck_seed_data / research_plan{,_wt} / review_plan{,_wt})の追加・削除・改名のみ反映。**設計・指示書・kit・プロンプト・ドキュメント保守系は自動追加しない** |
| 4 | `CLAUDE.md` の共通方針(特に §7 Git・§10 危険操作・製造担当範囲) | `AGENTS.md`、`.codex/rules/default.rules` | Git/危険操作ルールを `AGENTS.md`(文章)と `default.rules`(prefix_rule)へ反映。`AGENTS.md` は規約本文を複製せず「Codex 固有の補足・例外」に留める |

## 手順(to-codex、README §6 準拠)

1. 変更された Claude 正本を特定する(`git diff` / `git log` や現物比較で、上表の4系統に絞る)。
2. 同期トリガー表(README §5)から影響する Codex 派生物を特定する。
3. **Claude 側を正として Codex 派生物だけを更新**する。逆流させない。
4. コマンド本文・フックスクリプトを Codex 側へコピーせず、**参照を維持**する。
5. **Codex 固有設定を、対応する Claude 設定が無いという理由だけで削除・上書きしない**(下記「触れないもの」)。
6. 検証を実行する:
   ```bash
   jq -e . .claude/settings.json .codex/hooks.json
   python3 -c 'import tomllib; tomllib.load(open(".codex/config.toml", "rb"))'
   bash -n .claude/hooks/*.sh
   git diff --check
   ```
   `.codex/rules/default.rules`(Codex rule DSL)と `SKILL.md` frontmatter は構文目視で確認する。
7. `git diff` で、正本と対象派生物**以外**の変更が混入していないことを確認する。
8. 1対1変換できない項目・同期不能な項目を**必ず報告**する(強制力は Claude と Codex で完全一致しない前提)。

## 手順(from-codex、報告のみ)

1〜2 と同様に対象を特定した上で、Codex 派生物が Claude 正本から乖離している箇所・Codex 側で独自に加わった変更を列挙する。各項目に (a) 乖離内容 (b) Claude 正本へ取り込むべきかの推奨 (c) 取り込む場合の変更先ファイルを添えた**提案レポート**を出力して停止する。**Claude 正本ファイルは編集しない**。

## 触れないもの(README §7)

- `.codex/config.toml` の sandbox / approval / features、`.devcontainer/*` の Codex 向け設定、`.gitignore` の Codex 除外 → Codex/DevContainer 固有。無条件上書きしない。
- `~/.codex` / `CODEX_HOME` / `auth.json` / トークン / セッション / 個人設定 → **同期・表示・コミットしない**。
- `.claude/` 配下の既存ファイルを Codex 対応だけを理由に削除・改名しない。
- Skill 許可一覧へ設計・指示書系コマンドを自動追加しない。ただし `design_handover_report` は開発者判断で許可済み(2026-07-29)のため、一覧に在ることをドリフトとして扱わない。
- `allowed-tools` 等 Claude 固有 frontmatter を Codex の実行権限として扱わない。

## 完了時

- 変更した Codex 派生物、同期できなかった項目、`from-codex` の場合は提案レポートを要約提示する。
- **Git 操作(add/commit/push 等)は行わない**。コミット要否は開発者の明示指示に従う(README §7)。
