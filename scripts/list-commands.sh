#!/usr/bin/env bash
# カスタムコマンド一覧を要約してページャ表示する(開発者がエイリアス `cmds` で呼ぶ想定)。
# docs/human-notes/custom-commands.md を読み、各コマンドを「ラベル + 起動行」に要約し less で表示。
# less は代替画面を使うため、q で閉じると端末は元に戻り CLI を汚さない。
# 使い方: bash scripts/list-commands.sh   （または alias: cmds）
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DOC="${SCRIPT_DIR}/../docs/human-notes/custom-commands.md"
[[ -f "$DOC" ]] || { echo "エラー: 元ファイルが見つかりません: $DOC" >&2; exit 1; }

if [[ -t 1 ]] && command -v tput >/dev/null 2>&1; then
    BOLD=$(tput bold); RST=$(tput sgr0); ACC=$(tput setaf 4); CMD=$(tput setaf 6); DIM=$(tput setaf 8); PLAN=$(tput setaf 3)
else
    BOLD=; RST=; ACC=; CMD=; DIM=; PLAN=
fi

render() {
    printf '%s  カスタムコマンド一覧%s   %s(↑↓/Space: スクロール   q: 閉じる)%s\n' "$BOLD" "$RST" "$DIM" "$RST"
    local prev="" pending="" pending_done=1 line inv lbl badge
    while IFS= read -r line; do
        case "$line" in
            '## '*) pending="${line#'## '}"; pending_done=0 ;;
            '`'*'`')
                inv="${line//\`/}"
                if [[ -n "$pending" && $pending_done -eq 0 ]]; then
                    printf '\n  %s── %s ──%s\n' "$DIM" "$pending" "$RST"; pending_done=1
                fi
                # Plan Mode 必須かどうかを「プランモード起動後」の有無で判定(「プランモードゲート」等の誤検知を避ける)
                case "$prev" in *プランモード起動後*) badge="  ${PLAN}⏸ 要プランモード${RST}" ;; *) badge="" ;; esac
                # ラベル: コロン前を取り「CLI」の語のみ除去して区別用の(…)を温存。バッジと重複する文言は除去
                lbl="${prev%%:*}"; lbl="${lbl/CLI/}"
                lbl="${lbl/（プランモード起動後）/}"; lbl="${lbl/、プランモード起動後/}"
                printf '  %s•%s %s%s%s%s\n      %s%s%s\n' "$ACC" "$RST" "$BOLD" "$lbl" "$RST" "$badge" "$CMD" "$inv" "$RST" ;;
            ''|'# '*) : ;;
            *) prev="$line" ;;
        esac
    done < "$DOC"
}

if [[ -t 1 ]] && command -v less >/dev/null 2>&1; then
    render | less -R
else
    render
fi
