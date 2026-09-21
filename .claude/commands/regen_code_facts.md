---
description: code-facts.md 再生成。scripts/generate-code-facts.sh を実行して差分を提示する
---

あなたは本プロジェクトの **code-facts 再生成担当 Claude** です。
`scripts/generate-code-facts.sh` を実行して `docs/handover/code-facts.md`
(設計担当 Web 版 Claude 向けの「機械的事実」参照資料)を最新化し、差分を提示します。

本コマンドは **スクリプト実行 + 差分表示のみ** を行います。コミット・ステージング・
プッシュは一切行いません(Git 操作は開発者が行う)。

---

## 背景(なぜ再生成するか)

`code-facts.md` は React コンポーネント Props・queryKey(用途別: 定義 / invalidate)・
ルート・Go ハンドラ・config 構造体・バックエンド Response 構造体・共通ナビリンク・
model 構造体(db↔json マッピング)・repository 構造体(scan / filter / input)・
マイグレーション(migrations/*.up.sql の DDL = DB スキーマの一次情報)を
実コードから決定論的に抽出した資料です。
retrospective-log.md §1 パターン A/C「実コード確認の省略」を防ぐため、設計工程の前に
最新化しておきます。コードを変更したマイルストーン完了時などに再生成してください。

引数: `$ARGUMENTS`(不要。指定があっても無視してよい)

---

## 作業手順

1. スクリプトの存在を確認する(`ls scripts/generate-code-facts.sh`)。
   無ければ停止し、その旨を伝える。
2. `bash scripts/generate-code-facts.sh` を実行する。
   - 成功メッセージ(`✅ 生成しました: ...`)を確認する。
   - エラーで失敗した場合は出力をそのまま提示し、原因を報告して停止する
     (`code-facts.md` を手編集して取り繕わないこと)。
3. `git diff -- docs/handover/code-facts.md` を実行し、差分を表示する。
4. 差分を要約して報告する。観点:
   - どのセクション(§1〜§10)に変更があったか
   - Props / queryKey(用途含む)/ ルート / ハンドラ / config / Response 構造体 / ナビリンク /
     model 構造体(db↔json)/ repository 構造体 / マイグレーション(DDL・新規連番)の **増減や変更**
   - 日付行のみの変更か、実体(事実)の変更かを区別する
   - 差分が無い場合は「実コードに変化なし(冪等)」と報告する
5. **コミットはしない。** 内容を確認の上で開発者がコミットする旨を伝えて終了する。

---

## 注意

- 本スクリプトは grep/awk/sed による静的抽出で、取りこぼし(コメントアウト・動的生成・
  型継承・変数参照 queryKey 等)があります。詳細は生成物冒頭「本資料の限界」節を参照。
- 生成物以外のファイルは変更しないこと(スコープ厳守)。