---
description: 派生資料の鮮度監査。code-facts / docs-map / retrospective-digest / custom-commands が源泉より古くなっていないかを機械判定する
---

あなたは本プロジェクトの **派生資料鮮度監査担当 Claude** です。
`scripts/check-derived-docs.sh` を実行し、「源泉から生成・蒸留される派生資料」が
源泉より古くなっていないか(陳腐化疑い)を判定・提示します。

本コマンドは **スクリプト実行 + 結果提示 + 再生成手段の案内のみ** を行います。
派生資料の再生成そのものは、各専用コマンド(下記)を開発者の指示で実行します。

---

## 背景(なぜ監査するか)

code-facts / docs-map / retrospective-digest / custom-commands はいずれも源泉から
生成される派生物ですが、再生成のタイミングは人の記憶頼みでした。CLAUDE.md の約1年の
陳腐化(2026-07-02 是正)や followup-backlog の M 番号未同期(2026-07-03 是正)は、
この「鮮度を機械監視する層」の欠如が根因です(改善レーン報告書 §5-2-5)。
マイルストーン完了時・設計工程の開始前に実行してください。

引数: `$ARGUMENTS`(不要。指定があっても無視してよい)

---

## 作業手順

1. スクリプトの存在を確認する(`ls scripts/check-derived-docs.sh`)。
   無ければ停止し、その旨を伝える。
2. `bash scripts/check-derived-docs.sh` を実行する(stdout にレポートが出る。
   ファイルは生成されない)。
3. 「⚠ 陳腐化疑い」の行について、対応する再生成手段を提示する:
   - `docs/handover/code-facts.md` → `/regen_code_facts`
   - `docs/handover/docs-map.md` → `/regen_docs_map`
   - `docs/handover/retrospective-digest.md` → `/retrospective-digest-update`
   - `docs/human-notes/custom-commands.md` → `/sync_command_catalog`
4. 開発者の指示があれば該当コマンドを実行する。**指示なしに勝手に再生成しない**
   (再生成はコミット粒度・タイミングの判断を伴うため)。

---

## 注意

- 判定はコミット時刻ベース。**未コミットの源泉変更は見えない**(§2 に参考表示あり)。
- 「源泉が新しい=派生物の内容が必ず変わる」ではない。再生成して差分ゼロなら
  陳腐化解消とみなしてよい(空振り警告は許容設計)。
- 新しい派生資料を追加した場合は `scripts/check-derived-docs.sh` の `PAIRS` 配列に
  「派生物 :: 源泉 pathspec」を1行追加すること。
