---
description: devContainer リビルド前に貼る Perplexity サプライチェーン調査プロンプトを生成する
allowed-tools: Bash(bash scripts/devcontainer-supplychain-prompt.sh)
---

`scripts/devcontainer-supplychain-prompt.sh` を実行し、出力された Perplexity 調査プロンプトを
**そのまま 1 つのコードブロックで提示** してください。内容の加筆・要約・整形はしないこと
(プロンプト本文はスクリプト側で完成しています)。

```
bash scripts/devcontainer-supplychain-prompt.sh
```

提示後、「上記をコピーして Perplexity に貼ってください」と一言添えてください。

> 補足: 本コマンドは判断を含まないスクリプトの薄いラッパーです。トークンを使わず実行したい
> 場合は、プロンプト欄で `! bash scripts/devcontainer-supplychain-prompt.sh` を直接実行しても
> 同じ出力が得られます。
