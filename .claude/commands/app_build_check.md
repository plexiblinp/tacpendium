---
description: アプリビルド前に依存(go.mod / pnpm-lock)の整合性と既知CVEをローカル検査する(AI不要)
allowed-tools: Bash(bash scripts/app-build-supplychain-check.sh), Bash(APP_CHECK_GO_VULN=1 bash scripts/app-build-supplychain-check.sh), Bash(APP_CHECK_FAIL_LEVEL=critical bash scripts/app-build-supplychain-check.sh), Bash(APP_CHECK_FAIL_LEVEL=moderate bash scripts/app-build-supplychain-check.sh), Read
---

`scripts/app-build-supplychain-check.sh` を実行し、出力された総合判定(SAFE / CAUTION / WAIT)を
**そのまま提示** してください。判定や深刻度を勝手に上書き・要約しないこと。

```
bash scripts/app-build-supplychain-check.sh
```

判定が WAIT / CAUTION の場合は、出力に含まれる検出内容(深刻度の内訳・該当パッケージ)を
要点として添え、「ビルド前に対応を推奨」か「確認の上で続行可」かを一言で示してください。

あわせて `docs/process/dependency-pin-ops.md` §2 の台帳を 1 通り読み、記載された版の固定がまだ要るかを
確認して、その結果を 1 行添えてください(設計卓の裁定 `D-766`)。同書 §3.1 が本コマンドを
**台帳を見に行く主たる契機**として定めています ——「既に依存を全部見ている手番であり、台帳を 1 枚めくる
追加コストがほぼ無い」ため。見たときにやることは同書 §4 の 4 段(実物で見る / 壊れ方を台帳へ書き戻す /
壊れなければ外す / 判断が割れたら設計卓へ回す)であり、**台帳の状態欄が「未実査」の行があれば、それを
先に実物で確かめてください**。台帳自体の編集は本コマンドの射程外です(別の手番で行う)。

> 補足:
> - 本コマンドは判定を含まないスクリプトの薄いラッパーです。トークンを使わず実行したい場合は、
>   プロンプト欄で `! bash scripts/app-build-supplychain-check.sh` を直接実行しても同じ出力が得られます。
>   **ただし直接実行では上の台帳確認(`D-766`)が回りません。** 依存の版固定を見に行く契機はこの手番が
>   主であるため(`dependency-pin-ops.md` §3.1)、直接実行で済ませた回は台帳を別途 1 度めくってください。
> - Go の CVE 検査(govulncheck)を含めたい場合は `APP_CHECK_GO_VULN=1` 付きで実行(要 vuln.go.dev の FW 許可)。
> - WAIT の閾値を変えたい場合は `APP_CHECK_FAIL_LEVEL=critical|high|moderate`(既定 high)。
> - 本チェックは「既知 CVE + 整合性」の決定論的検査です。公開直後の速報的なサプライチェーン侵害まで
>   調べたい場合は、devContainer 用の `/devcontainer_rebuild_check`(AI プロンプト版)と同じ発想の
>   AI 併用が必要です(現状そのアプリ依存版は未整備)。
