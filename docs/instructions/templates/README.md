# 設計成果物テンプレート集（design-templates）

このフォルダは、Web 版設計担当チャットに「過去成果物の書式・粒度の手本」として渡すためのテンプレート集です。従来は過去の実物ファイル(M15-overview 実物・直近指示書・review-checklist 等)を個別にアップロードしており、コンテキスト肥大と一部未着リスクを避けるため一時は zip(`design-templates.zip`)集約方式を採っていましたが、**2026-07-20 に GitHub 直読へ切替**: テンプレ実体はコミット済みのため、Web 版チャット(Projects)の GitHub ナレッジで **本フォルダをディレクトリごと直読させる**のが既定です。zip は手動添付フォールバック(直読不能時・PC 手動投入)用として存続します。

## 何のためのものか

- 各テンプレは **骨格(見出し) + 記入指針コメント(`<!-- 記入指針 -->`) + ミニ実例(`<!-- 例 -->`)** で構成され、単体で「その種別の書き方」が分かるよう自己完結しています。
- 設計担当は該当テンプレを読み(直読または zip 展開)、コピーして `{{…}}` を埋め、`<!-- … -->` コメントを削除して完成品を作ります。
- **節構成・運用ルールの正本は `docs/handover/design-instruction-playbook.md`**。テンプレは Playbook と重複させず「型の再掲+記入例」に留めます。矛盾時は Playbook を正とします。

## 収録テンプレート

| ファイル | 対応する成果物 | 配置先(完成品) |
|---|---|---|
| `M{N}-{NN}-{slug}.template.md` | サブマイルストーン製造指示書 | `docs/instructions/M{N}-{NN}-{slug}.md` |
| `M{N}-{NN}-review-checklist.template.md` | レビューチェックリスト(指示書と 1:1) | `docs/instructions/reviews/M{N}-{NN}-review-checklist.md` |
| `M{N}-overview.template.md` | マイルストーン概要(各サブの上位) | `docs/instructions/M{N}-overview.md` |
| `phase{N}-overview.template.md` | フェーズ概要(各 M{N}-overview の上位) | `docs/instructions/phase{N}-overview.md` |
| `M{N}-RESEARCH-{NN}-{slug}.template.md` | read-only 調査指示書(簡易/厳格 2 系統) | `docs/instructions/M{N}-RESEARCH-{NN}-{slug}.md` |
| `CHANGE-{num}-notification.template.md` | 設計変更通知書(CHANGE 三点セット1枚目) | `docs/change-notes/CHANGE-{num}-notification.md` |
| `change-report-{num}.template.md` | CHANGE 反映レポート(三点セット3枚目) | `docs/change-notes/change-report-{num}.md` |

## テンプレで不十分なとき(過去成果物の請求)

テンプレは骨格 + 記入指針 + ミニ実例までで、個別の作業に固有の判断や込み入った書き分けまでは載せていません。設計担当は、あるテンプレでは書式・粒度が足りないと判断した場合、**そのとき書こうとしている成果物と性質が近い過去の実物**(例: 破壊的マイグレを伴う指示書なら M14 系、read-only 調査なら該当 RESEARCH、比較画面まわりの CHANGE なら該当 CHANGE 番号)を**自分で選定し、まず GitHub 直読で読む**(コミット済みの実物はナレッジから読める)。曖昧に「参考が欲しい」ではなく、**どの成果物(ファイル名・マイルストーン)を・なぜ(どのテンプレのどの節が不足か)** を特定する。直読で参照できない場合のみ開発者に投入を請求し、開発者がリポジトリからその実物を投入する。

## 命名規約(今後の「正」)

テンプレは今後作成する成果物の命名を以下に統一します。**既存ファイルのリネームは本テンプレの対象外**(手動 git 操作が必要)であり、過去分の命名揺れはそのまま残ります。テンプレは新規分の命名を pin する役割です。

- 指示書: `M{N}-{NN}-{slug}.md`(slug 必須。phase2 期の `M{N}-{NN}-instruction.md` のような汎用名は使わない)
- レビューチェックリスト: `docs/instructions/reviews/M{N}-{NN}-review-checklist.md`
- 調査指示書: `M{N}-RESEARCH-{NN}-{slug}.md`(`RESEARCH` は大文字・連番 `-01`, `-02`)
- CHANGE 三点セット: `CHANGE-{num}-notification.md` + `change-report-{num}.md`(num は全期間通し連番。`CHANGE-{num}-M{N}-{NN}-{slug}.md` や `CHANGE-{num}-change-report.md` のような旧綴りは使わない)。三点セット目の改訂 DES 本体と `change-number-registry.md` 更新を 1 トランザクションで行う。

## 共通 DNA(全テンプレに埋め込み済み)

1. 先頭に `| 項目 | 内容 |` のメタ情報表(ID・版・作成者・配置パス)
2. 直後に `## 更新履歴`(overview/change 系はヘッダの版ログに畳む場合あり)
3. 末尾に「開発者への確認事項」(overview/instruction/change 通知書)または「残ゲート」(change-report)
4. 末尾に斜体 1 行フッタ(`*以上、… 配置 \`<path>\`。*`)
5. 設計書参照は行レベル(`DES-005 §5.7`。Playbook §5)
6. 禁則表現(「あれば」「適切に」等の曖昧語)は排除(Playbook §4.1)

## zip の生成

```bash
bash scripts/generate-template-zip.sh
```

`docs/instructions/templates/design-templates.zip` を(再)生成します。zip 自体は `.gitignore` 済み(テンプレ本体のみ commit)。**2026-07-20 直読切替後は添付フォールバック時のみ必要**: 手動添付で投入する場合に限り、直前に再生成して最新テンプレを渡してください(`next_milestone_kit` / `next_phase_kit` の Step 3-0e も同様にフォールバック時のみ実行)。
