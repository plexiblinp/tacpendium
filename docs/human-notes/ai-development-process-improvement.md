# AI開発プロセス改善手順

## 目的

AIがドキュメント整備・実装・レビューを担うリポジトリにおいて、過去の失敗から得た「教訓」が自然言語ファイルへ無制限に蓄積し、コンテキストを圧迫する状態を避ける。

基本方針は、教訓を永久保存するのではなく、再利用可能な制約を **Lint /
Test / Hook / CI / Agent Eval** へ段階的に昇格させることとする。

人間は重要な設計判断、ルールの妥当性、例外判断、最終的な品質基準を担当する。AIには実装だけでなく、Lint・テスト・ドキュメント・改善用ツールの実装も担当させてよいが、検査機構そのものもレビュー・テストする。

------------------------------------------------------------------------

## 1. 現状の教訓ファイルを「最終保存先」から「一時バッファ」へ変更する

現在の流れ:

``` text
AIが失敗
  ↓
AIレビューですり抜け
  ↓
人間が指摘
  ↓
教訓ファイルへ追記
  ↓
肥大化
  ↓
要約
  ↓
再び肥大化
```

改善後:

``` text
失敗・人間の指摘
  ↓
Failure Registry / Lesson Candidate
  ↓
重要度・再発性・機械化可能性を評価
  ↓
├─ Lint
├─ Test
├─ Hook / CI
├─ Agent Regression Eval
└─ 機械化困難 → Core Lessons
```

Core Lessonsには、以下を満たすものだけを残す。

-   現行モデルでも間違える可能性が十分ある
-   複数タスクで再利用可能
-   Lint/Test/Hook等では適切に表現できない
-   読ませるコストに見合う重要性がある

------------------------------------------------------------------------

## 2. Failure Registryを作る

人間が指摘した失敗を、まず構造化して記録する。

最低限、以下を記録できるようにする。

``` yaml
id: FAILURE-042
title: HandlerからRepositoryを直接呼び出した
created: 2026-08-31
severity: medium

lesson_id: LESSON-042

opportunity_count: 0
violation_count: 1
ai_review_detections: 0
human_detections: 1

status: candidate
graduated_to: null
last_hit: 2026-08-31
```

重要なのは「教訓をAIが何回読んだか」よりも以下を計測すること。

-   そのルールが問題になる機会が何回あったか
-   実際に何回違反したか
-   自動検査で何回捕捉したか
-   AIレビューで何回捕捉したか
-   人間まで何回すり抜けたか
-   最後に違反した日時

一度でも重大事故につながるセキュリティ、データ破壊、権限境界等は、再発を待たず機械化候補とする。

------------------------------------------------------------------------

## 3. 教訓の昇格先を判定する

### 3.1 Lintへ昇格

静的に判定できるもの。

例:

-   禁止された依存方向
-   特定APIの直接利用禁止
-   structured logging必須
-   schema/typeの命名規則
-   ファイルサイズ上限
-   docsの必須メタデータ
-   docsのリンク・構造・配置
-   曖昧表現や禁止表現
-   必須ファイル・必須セクションの欠落

### 3.2 Testへ昇格

実行結果を見れば正誤を判定できるもの。

-   Unit Test
-   Integration Test
-   E2E
-   Structural Test
-   Schema compatibility test
-   データ整合性テスト

### 3.3 Hook / CIへ昇格

「必ず特定処理を通す」こと自体が重要なもの。

例:

-   ファイル変更後のフォーマット
-   コミット前の検査
-   generated fileの更新確認
-   特定ファイル変更時の追加検査
-   PR前のverify実行

### 3.4 Agent Regression Evalへ昇格

コードの完成状態だけでなく、「AIに同種の仕事を再度任せたとき正しく遂行できるか」を検証したいもの。

過去に失敗したタスクを、可能なら以下のセットとして保存する。

``` text
evals/
  failure-042/
    task.md
    repo-before/
    grader/
    expected-properties.md
```

例:

過去の依頼:

> キャラクター削除機能を追加する。

過去の失敗:

> Characterは削除したが関連Comboが残り、orphan dataが発生した。

Regression Eval:

1.  失敗前の状態を用意する。
2.  AIへ同種のタスクを与える。
3.  AI自身に実装させる。
4.  Test / Static Analysis / LLM Grader等で結果を評価する。
5.  関連データの整合性まで維持できていればPASS。

これにより、モデル・プロンプト・ハーネス変更時にも過去の失敗が再発しないか確認できる。

------------------------------------------------------------------------

## 4. Custom Lintを導入する

Custom
Lintは、リポジトリ固有の不変条件を機械的に検査する小さなプログラムとして考える。

必ずしも既存Lintフレームワークのプラグインにする必要はない。独立CLIでもよい。

例:

``` text
tools/
  repolint/
```

実行例:

``` bash
./tools/repolint
```

違反時には、AIがその場で修正できる情報を返す。

``` text
ERROR LINT-ARCH-003

internal/service/foo.go

Service package must not import UI package.

Why:
Dependency direction must remain Service -> Runtime -> UI.

Fix:
Move the shared type to internal/types or introduce the appropriate interface.
```

Lintのエラーは「違反している」だけでなく、可能なら以下を含める。

-   Rule ID
-   対象ファイル・行
-   違反内容
-   なぜ禁止されているか
-   推奨修正方法
-   例外が許可されるか

------------------------------------------------------------------------

## 5. Lintの強度を3段階にする

### ERROR

違反した状態では先へ進めない。

適用条件の目安:

-   deterministicに判定できる
-   false positiveが非常に少ない
-   違反による害が明確
-   正当な例外がほぼ存在しない

候補:

-   セキュリティ境界
-   データ破壊につながる規則
-   禁止依存
-   必須validation
-   壊してはいけない構造
-   CI上必須の生成物

### WARN + Waiver

違反は原則修正するが、正当な理由があれば例外を許す。

AIが無視するだけのWARNにはしない。

``` text
WARN
  ↓
修正
または
Waiver（例外理由）を記録
  ↓
別AI/サブエージェントがWaiverをレビュー
  ↓
Resolved
```

Waiver例:

``` yaml
lint: LINT-SIZE-002
decision: waive
reason: >
  State-machine transitions are intentionally kept together.
  Splitting the file would separate invariants that must be reviewed together.
```

レビューAIはWaiverを承認する前提ではなく、反証担当として以下を確認する。

1.  本当に違反を解消できないか
2.  例外は本当に必要か
3.  将来悪い前例にならないか
4.  Lint自体が間違っていないか
5.  より狭い例外指定にできないか

同一LintのWaiverが頻発した場合は人間へエスカレーションし、Lintまたはアーキテクチャを再評価する。

### ADVICE

まだ根拠が弱いもの、taste、可読性、試験導入中のルール。

新しいLintは原則として以下の成熟経路を検討する。

``` text
Lesson
  ↓
Lint Candidate
  ↓
ADVICE
  ↓
WARN + Waiver
  ↓
十分な実績・低false-positive
  ↓
ERROR
```

ただし重大なセキュリティ・データ保全ルールは即ERRORでもよい。

------------------------------------------------------------------------

## 6. AIにCustom Lintを書かせる

AIにCustom Lintの実装を担当させてよい。

ただし、人間およびレビューAIは「コードが巧妙か」だけでなく、特に以下を確認する。

1.  禁止すべきものを正しく検出するか
2.  正常なものを誤検知しないか
3.  簡単な迂回方法で回避できないか
4.  ルールが将来の設計を不必要に固定しないか
5.  エラーからAI自身が修正方法を理解できるか
6.  例外機構が広すぎないか
7.  Lint自体に十分なテストがあるか

Lintにはpositive/negative fixtureを用意する。

``` text
fixtures/
  valid/
    allowed_dependency.go
    valid_document.md

  invalid/
    forbidden_dependency.go
    missing_doc_metadata.md
```

期待値:

``` text
valid/*   -> PASS
invalid/* -> FAIL
```

Lintを検査するLint/Testも品質保証対象とする。

------------------------------------------------------------------------

## 7. docsにもCustom Lintを適用する

docsもsystem of recordとして扱うなら、機械検査対象にする。

候補:

-   必須front matter
-   Status / Owner / Last-Verified
-   indexへの登録
-   dead link
-   cross-link
-   ファイル配置
-   命名
-   廃止文書への参照
-   コード上存在しないシンボルへの参照
-   必須セクション
-   generated docsとの差分
-   更新対象コード変更時のdocs更新有無

意味的な正しさまで静的に判定できない場合は、Lintだけで解決せずAIレビューやEvalへ回す。

------------------------------------------------------------------------

## 8. 検査を確実に実行する

AIへの自然言語指示だけを保証手段にしない。

### 8.1 単一verifyコマンドを用意

AIに複数コマンドを覚えさせず、可能なら入口を一本化する。

``` bash
./tools/verify
```

内部例:

``` text
format
standard lint
custom lint
doc lint
type check
unit test
integration test
structural test
security checks
```

### 8.2 Hookで早期検出

ファイル変更、コミット等の適切なタイミングで自動検査する。

目的は「AIが覚えていること」ではなく「忘れても実行されること」。

Hookは高速なフィードバックを優先し、必要に応じて変更範囲に限定した検査を行う。

### 8.3 CIを最終ゲートにする

CIで同じ検査を再実行する。

ERROR系はrequired checkとし、失敗時にはmergeできないようにする。

``` text
Agent
  ↓
local verify
  ↓
Hook
  ↓
PR
  ↓
CI required checks
  ↓
Merge
```

Hookは早期検出、CIは最終保証という役割分担にする。

WARNについても単なる表示で終わらせず、

-   修正済み
-   正式なWaiverあり

のどちらかになるまで未解決扱いとする。

------------------------------------------------------------------------

## 9. 教訓・Lint・Evalを定期的に整理する

永久追加方式にしない。

定期的に以下を確認する。

### Lesson

-   現モデルでも必要か
-   最近該当機会があったか
-   違反は発生しているか
-   Lint/Test/Evalへ昇格できないか
-   別のLessonと重複していないか

### Lint

-   false positive率
-   violation数
-   waiver数
-   同一waiverの反復
-   ERROR化できるか
-   逆にルール自体を削除すべきか

### Agent Eval

-   モデル変更後もPASSするか
-   Lessonあり/なしで成功率が変わるか
-   graderが正しいか
-   すでにモデル能力で自然に解決できる問題になっていないか

十分な試行でLessonなしでも安定して成功するなら、自然言語教訓の削除候補とする。

------------------------------------------------------------------------

## 10. 実装優先順位

一度に全面改修しない。

### Phase 1: 可視化

1.  Failure Registryを導入
2.  LessonにIDを付与
3.  人間検出・AIレビュー検出・再発を記録
4.  既存Lessonを分類

### Phase 2: 高価値な機械化

1.  頻出Lessonを抽出
2.  高リスクLessonを抽出
3.  static判定可能なものをCustom Lint化
4.  runtime判定可能なものをTest化
5.  workflow問題をHook/CI化

### Phase 3: Lint成熟度管理

1.  ADVICE / WARN / ERRORを導入
2.  WARNにはWaiverを要求
3.  Waiverを別AIでレビュー
4.  Waiver頻度を計測
5.  安定したLintをERRORへ昇格

### Phase 4: Agent Regression Eval

1.  代表的な過去失敗を少数選ぶ
2.  失敗前状態・タスク・graderを保存
3.  モデル/ハーネス変更時に再実行
4.  Lessonの必要性判断にも利用

### Phase 5: 教訓ファイル縮小

1.  機械化済みLessonを削除または索引化
2.  現行モデルで不要になったLessonを削除
3.  Core Lessonsを小さく維持
4.  AGENTS.md等は詳細マニュアルではなく「どこを見るか」の地図として維持

------------------------------------------------------------------------

## 11. 完了条件

この改善の目的はLintの数を増やすことではない。

以下の状態を目標とする。

-   AIが常時読む自然言語ルールが小さい
-   重大な不変条件はAIの記憶に依存しない
-   過去の人間指摘が再発防止機構へ変換される
-   検査がAIの自主実行に依存しない
-   Lint自身にもテストがある
-   例外は暗黙に無視されずWaiverとして可視化される
-   モデル更新時に過去失敗の再発をEvalで確認できる
-   不要になった教訓を根拠を持って削除できる
-   人間はルール本文の暗記ではなく、重要な設計判断と品質基準に集中できる

------------------------------------------------------------------------

## 参考となる一次情報

-   OpenAI, "Harness engineering: leveraging Codex in an agent-first
    world" (2026-02-11)
    -   約100万行、約1,500 PRのagent-first開発事例
    -   巨大AGENTS.mdから短いmap + structured docsへ移行
    -   custom linters / structural testsによるarchitecture
        invariantの機械的強制
    -   docsのlint/CIとdoc-gardening
    -   agent-generated custom lint
-   Anthropic, "Demystifying evals for AI agents" (2026-01-09)
    -   code-based / model-based / human graderの組み合わせ
    -   static analysis、lint、binary tests等のdeterministic grader
    -   capability evalとregression eval
    -   eval transcriptとgrader自体の検証
-   Anthropic, Context Engineering guidance
    -   長期agentでのcontext肥大化、compaction、memory、tool clearing
    -   contextを有限資源として扱う設計
