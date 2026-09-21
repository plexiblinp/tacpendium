#!/usr/bin/env bash
# Claude 応答完了/要対応時の控えめなベル通知(Stop / Notification フックから呼ぶ)。
# devContainer 内は音源を持たないため、制御端末へ BEL を送り、ホスト側 VS Code の
# ベル設定(terminal.integrated.enableBell)に従って控えめに鳴らす。常に exit 0。
#
#   一時オフ : CLAUDE_BELL=0 を環境変数に設定
#   オフ     : touch .claude/.no-bell   （再開: rm .claude/.no-bell）
#   完全停止 : settings.local.json から hooks ブロックを削除
set -uo pipefail   # -e は使わない: 何があっても完走して exit 0

# --- 無効化スイッチ(いずれか該当で無音) ---
[ "${CLAUDE_BELL:-1}" = "0" ] && exit 0
proj="${CLAUDE_PROJECT_DIR:-.}"
[ -f "${proj}/.claude/.no-bell" ] && exit 0

# --- 控えめなターミナルベル ---
# 重要: フックプロセスには制御端末が無く(/dev/tty オープン失敗)、stdout は
# Claude Code がファイルへキャプチャするため、そこへ BEL を出してもユーザーの
# 端末には届かない(これが「鳴らない」原因だった)。
# そこで祖先プロセスをたどり、claude が動作する擬似端末(/dev/pts/N)を特定して
# 直接 BEL を書き込む。端末が見つからない場合は無音(ノイズにせず exit 0)。

ttydev=""
pid=$$
for _ in 1 2 3 4 5 6 7 8 9 10; do
  [ -r "/proc/${pid}/stat" ] || break
  t=$(ps -o tty= -p "${pid}" 2>/dev/null | tr -d ' ')
  case "${t}" in
    pts/*) ttydev="/dev/${t}"; break ;;
  esac
  ppid=$(awk '{print $4}' "/proc/${pid}/stat" 2>/dev/null)
  [ -n "${ppid}" ] && [ "${ppid}" != "0" ] && [ "${ppid}" != "${pid}" ] || break
  pid="${ppid}"
done

if [ -n "${ttydev}" ] && [ -w "${ttydev}" ]; then
  printf '\a' 2>/dev/null > "${ttydev}"
else
  # フォールバック: 制御端末があれば従来どおり(対話実行・ホスト OS 等)
  printf '\a' 2>/dev/null > /dev/tty || true
fi
exit 0
