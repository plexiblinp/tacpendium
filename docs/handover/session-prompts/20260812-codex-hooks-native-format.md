# 投入プロンプト: Codex 自身に `.codex/hooks.json` を直させる（継続改善ブランチ B）

| 項目 | 内容 |
|------|------|
| 宛先 | **Codex セッション**（★本タスクは Codex 自身に直させる）＋ 開発者（マーカーの設置・撤去） |
| ブランチ | **開発者が main から切る**（例 `chore/codex-hooks-native`）。Codex もブランチを作れない |
| 実施時期 | **任意・M20 と並列可**（触るのは `.codex/` と `human-notes/codex/` だけで衝突しない） |
| 追跡 | `docs/handover/followup-backlog.md` §J `codex-hooks-json-not-dispatched` |
| 起票 | 改善担当 Claude Code / 2026-08-12 |

---

## 0. なぜ Codex 自身にやらせるか

**発火するかどうかは、呼ばれる側からしか測れない。** Claude 側からはバイナリ実査もペイロード投入もできたが、それで分かるのは「スクリプト側は正しい」ことだけだった。**Codex セッションの中でなら、ブロックされたことをそのまま観測できる。**

---

## 1. 投入プロンプト

```text
このリポジトリの Codex 設定の不具合を、あなた自身に直してもらいます。まず human-notes/codex/README.md §5 の「【2026-08-12 実測】」ブロックと、docs/handover/followup-backlog.md §J の codex-hooks-json-not-dispatched を読んでください。事実・実測・判断の前提はそこに書いてあります。

【確定している事実】
.codex/hooks.json は、あなた(Codex)にディスパッチされていません。決定的だったのは対照実験です。武装マーカー(tmp/.design-desk-armed)を置き internal/ が作業ツリーに在る状態で、同一の git status --short を打つと、Claude Code は exit 2 でブロックされ、Codex は素通りしました。フック実装は同じファイル(.claude/hooks/design-desk-guard.sh)なので、差はディスパッチ側にしかありません。

機能が無効なわけではありません。codex features list は hooks を stable / true と報告します。信頼確認プロンプトも出ていません。つまり書式か置き場所が違います。

強い傍証が 1 つあります。Stop は Codex のフックイベントに存在しません。あなたのイベントは pre_tool_use / permission_request / post_tool_use / pre_compact / post_compact / session_start / session_end / user_prompt_submit / subagent_start / subagent_stop であり、Claude の Stop に相当するのは session_end です。にもかかわらず .codex/hooks.json には "Stop" が書かれています。この 1 点だけでも、同ファイルが Claude の settings.json 書式を写して作られ、一度も検証されないまま「同期済み」と記録され続けていたことが分かります。

【あなたのゴール】
.codex/hooks.json を Codex ネイティブの正しい形にし、実際に発火することを実測で示すこと。ゴールは「正しそうな設定を書くこと」ではなく「発火の証拠を出すこと」です。

【★禁則 4 つ】

第一に、書式を推측で書かないでください。今回の不具合の原因がまさに「Claude の書式を写して検証しなかったこと」です。同じことを繰り返さないでください。正しい書式は、(a) あなたが持っている Codex の公式仕様・ドキュメント (b) Codex 自身の外部エージェント設定取り込み機構 のいずれかから得てください。(b) については、codex.external_agent_config.detect / import という API と、external_config_migration_prompts(home_last_prompted_at / project_last_prompted_at)という設定キーが存在することを確認済みです。あなたは .claude/settings.json から hooks を取り込む機構を持っているはずなので、それを使って変換させるのが最短です。手で書くより機構に出させたものを正としてください。

第二に、.claude/ 配下を変更しないでください。human-notes/codex/README.md §3 が「Claude Code 側を正本とする。Codex が不整合を発見した場合は正本を Codex 側へ合わせて変更せず、差分と必要な同期内容を報告する」と定めています。フック実装(.claude/hooks/*.sh)も設定(.claude/settings.json)も正本です。あなたが触ってよいのは .codex/ 配下と human-notes/codex/README.md だけです。フック実装をコピーせず、.codex/hooks.json から .claude/hooks/*.sh を参照する形を維持してください(README §4「フック実装は .claude/hooks/*.sh だけに置き、.codex/hooks.json から直接呼び出す」)。

第三に、matcher を安易に書かないでください。当たらない matcher は silent に無効化されます。一方 pre-push-guard.sh と design-desk-guard.sh はどちらも無関係なら即 exit 0 する設計です(前者は git push を含まなければ 0、後者は武装マーカーが無ければ 0)。過剰ブロックは可視で直せますが取りこぼしは silent なので、ツール名を実測で確定できない限り matcher は書かないでください。実測で確定できたなら、確定した値と確定方法を報告してください。

第四に、push・マージ・ブランチ操作をしないでください。コミットまでです。

【検証手順 ★ここが本体】
書式を直したら、必ず次の対照実験で発火を実証してください。

  手順 1: 開発者に「tmp/.design-desk-armed を置いてください」と依頼する。
          ★あなた自身が置かないでください。フックが正しく動くようになった場合、
          あなたは自分でマーカーを消せなくなります(ガードがマーカー名に触れる
          コマンドをブロックし、さらに前提の崩れ検出がそれより手前で全ブロック
          するため)。これは設計どおりの挙動で、故障ではありません。

  手順 2: git status --short を実行する。
          ★シェルで実行してください。ls や cat は組み込みツールに吸収されて
          シェル経路を通らないため、検査になりません(2026-08-12 に実際に
          ls -la で測ろうとして失敗しています)。

  手順 3: 期待する結果は「design-desk-guard: 武装マーカーがあるのに実装ソースが
          作業ツリーに存在します」というブロックです。出力された文言を 1 行も
          省略せずに記録してください。ブロックされなければ、まだ直っていません。

  手順 4: 開発者に「tmp/.design-desk-armed を消してください」と依頼する。

  手順 5: PostToolUse も確認する。tmp/hooktest/main.go に gofmt 違反のある
          Go ファイルを作り(整形しないこと)、post-edit-check.sh の指摘が
          出るかを見る。post-edit-check.sh は .go と .ts/.tsx にしか指摘を
          出さないので、.md では検査になりません。確認後 tmp/hooktest は削除。

【直せなかった場合】
それも正当な結果です。取り繕わず、どこまで分かってどこで詰まったかを報告してください。とくに (a) 正しい置き場所と書式について何が確認できたか (b) 手順 3 で何が起きたか を具体的に書いてください。実行できても目的を達成しないなら、実行せずに報告してください(本プロジェクトの裁定 D-204 (2))。

【報告と後始末】
完了・未完了にかかわらず、次を更新してください。
  - docs/handover/followup-backlog.md §J codex-hooks-json-not-dispatched(状態と実測結果)
  - human-notes/codex/README.md §5 の実測ブロック(判明した正しい書式・置き場所)
  - .codex/hooks.json の description(現在「効いている層として扱うな」という警告が
    入っています。発火を実証できたら警告を外し、できなければ残してください)
発火を実証できた場合は、docs/process/remote-ops.md §6 のフック層の行も
「Codex では層が存在しない」から是正が必要です。ただし同ファイルは Claude 側の
正本なので、あなたは直さず「この行をこう直すべき」という差分を報告してください。
```

---

## 2. 補足（プロンプトには含めない）

### 実害の範囲

Codex セッションでは `post-edit-check.sh`（品質検査）・`stop-test.sh`（テストゲート）・`pre-push-guard.sh`（push 統制）の**いずれも効いていない**。push 統制は `.codex/rules/default.rules` の pattern（`push` を含む）と人間のマージだけが担っている。

**設計卓の武装には影響しない**——親は常に Claude であるため。

### なぜ「Codex に直させる」が妥当か

`human-notes/codex/README.md` §3 は「Codex が不整合を発見した場合は**報告**する」と定めており、Codex による Codex 派生物の更新は「**明示的に同期を依頼された場合のみ**」認めている。**本プロンプトがその明示的な依頼にあたる。**

触る範囲を `.codex/` と `human-notes/codex/README.md` に限れば、正本（`CLAUDE.md` / `.claude/`）の所有権は侵さない。

### 検証で `git status` を使う理由

- **シェルを通らざるを得ない**（`ls` / `cat` / `grep` / `find` は Codex の組み込みツールに吸収される。2026-08-12 に `ls -la` で測ろうとして失敗した実例あり）
- `.codex/rules/default.rules` の `not_match` に**明示されている**ので rules 層の交絡が無い（`git push` は rules が先に塞ぐため検査に使えない）
- 武装中は「前提の崩れ」検出が `decide()` の**手前**で止めるので、許可リスト上は通る `status` でもブロックされる

### 同期トリガー表の穴（本件の一般化）

`human-notes/codex/README.md` §5 は「変更したら対応先を**確認する**」までしか定めておらず、**「対応先で実際に効いているか」を確かめる段が無い**。`.codex/hooks.json` はその穴に落ちた。**本件の決着時に、同期の完了条件へ「発火の実測」を含める改訂まで行えると再発が止まる。**
