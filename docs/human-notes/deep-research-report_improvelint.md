# AI開発プロセス・ハーネス改善の実証調査

## Executive Summary

**結論から言えば、現在検討している改善方針は、全体として「実務上かなり有力」であり、主要部分はOpenAI、Anthropic、Meta、Google系研究の実践・実験結果とよく整合しています。** ただし、方針全体を一つのパッケージとして比較試験した研究はまだなく、「この構成なら必ず生産性・品質が上がる」とまで実証されているわけではありません。特に強く支持されるのは、**自然言語でAIへ注意し続けるのではなく、観測された失敗を再利用可能な機械的検証へ変えること、決定論的なチェックをLLMレビューより下層に置くこと、常時読み込むコンテキストを小さくすること、過去失敗をregression evalへ変換すること**です。citeturn17view3turn16view3turn21view0turn17view7

特にOpenAIは2026年2月11日の「Harness engineering」で、Codex主体の内部製品について、ドキュメントだけではagent-generated codebaseの一貫性を保てないとして、**Codex自身が生成したcustom lint、structural tests、依存方向の機械的制約、docs lint、CI、定期的なdoc-gardening、品質のgarbage collection**を実運用しています。人間から得た「taste」やバグ由来の知見についても、文書だけでは足りなければルールをコードへ「promote」する方針を明示しています。これは今回検討している「Lesson → Lint/Test/Hook/CI/Eval」構想に非常に近い一次事例です。citeturn17view2turn17view3turn17view4turn17view5

ただし、**「AGENTS.mdや教訓を要約して小さくすればよい」だけでは不十分**です。OpenAI自身が巨大なAGENTS.md方式を試して失敗し、約100行の索引へ縮小しています。Anthropicも2025年9月29日に、コンテキストが長くなるほど検索・注意能力が低下する「context rot」を理由に、コンテキストを有限資源として扱うべきだとしています。さらに2026年2月12日の独立研究では、AGENTS.md型context filesは平均して推論コストを20%以上増やし、LLM生成ファイルは成功率をわずかに悪化させ、人間作成ファイルの改善も統計的に有意ではないという結果が出ています。したがって、**「常時読む自然言語ルールを増やす」のではなく、必要最低限の地図＋必要時検索＋機械的制約へ移す**という方向はかなり重要です。citeturn17view1turn17view7turn20search0turn20search2

一方、**AIレビューやmulti-agentを増やせば増やすほど安全になる、という考えは支持されません。** AnthropicはLLM graderを非決定的で人間による校正が必要と明記しています。Google Researchが2026年1月28日に公表した180構成の比較では、multi-agentは並列化可能なタスクで最大約81%改善した一方、逐次タスクでは39〜70%悪化し、独立agent群では誤りが最大17.2倍に増幅しました。2026年のCooperBenchでも、二つのcoding agentが協調する条件ではGPT-5やClaude Sonnet 4.5の成功率が約25%で、同等仕事を単独agentが行う場合の約半分でした。したがって、サブエージェントは**独立したレビュー、探索、分解可能な仕事**には有望ですが、「agentを足せば信頼性が上がる」という設計にはすべきではありません。citeturn21view0turn16view10turn16view11

今回の案を最終的に評価すると次の通りです。

| 提案 | 評価 | 結論 |
|---|---|---|
| AIが実装・docs・testsを担当 | **条件付きで実務上有力** | 既に大規模実例あり。ただし人間は仕様・評価基準・例外判断を保持 |
| 別AIによるレビュー | **実務上有力** | deterministic checksの上に置く。唯一の品質保証にしない |
| 人間の指摘をFailure/Lessonとして保存 | **実務上有力** | そのまま永久保存せず、後続処理の入力にする |
| Lesson → Lint / Test / Hook / CI | **非常に強く推奨** | OpenAIの実運用とほぼ一致 |
| Lesson → Agent Regression Eval | **非常に強く推奨** | OpenAI/Anthropicが直接推奨する改善ループと一致 |
| 常時読むLessonを小型化 | **強く推奨** | 独立研究を含め根拠が強い |
| Custom LintをAIに書かせる | **条件付きで推奨** | OpenAI自身が実施。Lintのfixture/testと仕様レビューを必須化 |
| ADVICE / WARN / ERROR | **実務上有力** | Lint界では確立した設計。AI開発特有の比較実験は不足 |
| WARN + Waiver + AIレビュー | **理論的・実務的に有望だが実証不足** | 高リスクwaiverは当面human reviewを残す |
| ADVICE → WARN → ERRORへの成熟 | **合理的だが直接実証は不足** | ESLintにも新ルールをwarn→errorとする明示的慣行あり |
| Hookで早期実行 | **強く推奨** | Anthropicは「毎回・例外なし」の処理にはHookを推奨 |
| CIで最終強制 | **強く推奨** | Agent自身の自己申告から独立させるべき |
| Multi-agentの積極利用 | **条件付き** | 並列可能性を測って限定導入 |
| Lessonへの「接触回数」計測 | **修正推奨** | read回数より「違反機会・違反・検出・escape」を測る |

総合すると、今回の構想を私は **「自然言語memoryを主役にしたAI開発」から「計測可能なfeedback-control systemを主役にしたAI開発」への移行**と評価します。この転換自体は、現在確認できる一次情報の方向とかなり一致しています。citeturn16view3turn17view3turn16view1

## 調査した組織・研究とエビデンスの読み方

今回、企業のマーケティング上の成功談だけに依存しないよう、企業一次情報、査読済みRCT、独立RCT、独立benchmark研究を分けて評価しました。重要なのは、**「AI codingそのものが速いか」と「AI主体のコードベースを長期間壊さず維持するharnessが有効か」は別問題**だという点です。前者にはRCTがありますが、後者についてはOpenAIやMetaのproduction case studyが現時点では主要な証拠です。citeturn16view6turn16view7turn17view0turn18view1

| 情報源 | 公開日 | 調査上の位置付け | 主な観察 |
|---|---:|---|---|
| OpenAI, Harness Engineering | 2026-02-11 | 大規模production case study、自己報告 | 100% agent-generated repo、custom lint、structural tests、docs CI、AI review、garbage collection |
| OpenAI, Agent Improvement Loop | 2026-05-12 | 公式実装パターン | real traces → human/model feedback → evals → harness changes |
| Anthropic, Demystifying evals | 2026-01-09 | Claude Code等から得た公式engineering guidance | code/model/human grader、regression eval、production monitoring |
| Anthropic, Context Engineering | 2025-09-29 | 公式engineering analysis | context rot、small high-signal context |
| Anthropic, Claude Code Best Practices | 継続更新、2026-08-31参照 | 現行公式docs | 必ず実行すべき処理はHooksへ |
| Anthropic, Claude Code usage research | 2026-06-16 | 約40万sessionの観測研究 | 人間はplanning、agentはexecution中心 |
| Meta, Tribal Knowledge | 2026-04-06 | production case study、自己報告 | 小型context、critic agent、freshness automation |
| Meta, Fixit 2 | 2023-08-07 | production lint infrastructure | in-repo custom lint、autofix、VALID/INVALID fixture |
| Meta, ACH mutation testing | 2025-09-30 | production/research case | 過去bug data→realistic mutants→unit tests |
| Meta, JiTTesting | 2026-02-11 | production-oriented research | PRごとにLLMがfaultとtestを生成、rule+LLM grader |
| Google Research, agent scaling | 2026-01-28 | controlled benchmark study | multi-agentの適用条件を180構成で比較 |
| Google社員RCT | 2024-10-16 | randomized controlled trial | 96人のenterprise taskで約21%短縮の推定 |
| Management Science | 2026-02-27 | **査読済みfield RCT** | Microsoft/Accenture/Fortune 100、4,867人でtask completion +26.08% |
| METR | 2025-07-10 | **独立RCT** | 熟練OSS開発者はearly-2025 AI使用で19%遅延 |
| METR追跡 | 2026-02-24 | 独立追跡研究 | late-2025ではspeedup方向だがselection biasが大きく結論不能 |
| DORA | 2024/2025 | 大規模観測調査、Google主導 | AIは既存開発システムの長所・短所を増幅 |
| AGENTS.md独立研究 | 2026-02-12 | independent benchmark/preprint | context filesは成功改善が乏しくcost +20%以上 |
| CooperBench | 2026-01 | research preprint | coding multi-agentのcoordination failureを定量化 |

AI codingの生産性について最も強い因果的根拠の一つは、2026年2月27日にManagement Scienceでオンライン公開されたMicrosoft・Accenture・Fortune 100企業の計4,867人を対象としたfield RCTです。三つの実験を合算するとAI coding assistantによる完了task数は**26.08%増加、標準誤差10.3%**でした。ただし、これは主としてcoding assistantによるcompletionの評価であり、長時間自律agentや今回のharness全体の因果効果ではありません。citeturn16view6

一方、METRは2025年7月10日、平均100万行超の大規模OSS repositoryに長年貢献してきた16人、246件の実タスクをランダム化し、early-2025 AI使用条件が**19%遅かった**と報告しました。開発者は実験前に24%高速化すると予測し、実験後にも20%高速化したと感じていたため、主観的な「速くなった」は実測と一致しない場合があります。METRの2026年2月24日の追跡ではspeedup方向に動いているものの、AIなしで働きたくない開発者・AI向きタスクが研究から脱落するselection effectが大きく、研究者自身が現在の効果量について弱い証拠しかないとしています。citeturn16view7turn16view8

この反例は重要です。したがって、あなたのリポジトリでも「一流企業が採用しているから有効」と判断するより、**自分のFailure Registry / Eval / lead time / escaped defect / costを測って判断する設計そのもの**が必要です。

## 実際に採用されているAI開発プロセス

OpenAIの2026年2月11日の事例は、今回の構想に最も近いものです。同チームは2025年8月末の空repositoryから約5か月で内部製品を構築し、application logicだけでなくtests、CI、documentation、observability、internal toolingまでCodexに書かせています。記事時点で約100万行、約1,500 merged PR、小規模チームは3人から7人へ増加し、OpenAI自身は手書きなら必要だった時間の約10分の1で構築したと**推定**しています。これは比較対照を設けた実験ではなく、OpenAI自身によるケーススタディである点には注意が必要です。citeturn17view0turn16view0

重要なのは「強いモデルに全部任せた」ことではありません。初期には環境がagentにとって不十分で進捗が悪く、人間の仕事を**tool、abstraction、scaffolding、feedback loop、acceptance criteriaを構築する仕事**へ変えています。さらに、実装agentはself-reviewや別agent reviewを行い、browserによる実動作確認、logs・metrics・tracesを備えたworktreeごとの観測環境まで利用します。つまりOpenAIの成果はモデル単体よりも「agentが自力で状態を観測し、修正し、検証できる環境」に大きく依存しています。OpenAI自身も、この自律性はrepository固有の構造とtoolingへの投資に強く依存し、そのまま一般化できないと注意しています。citeturn17view4turn17view5

**repository instructionsについては、OpenAIは一度失敗しています。** 巨大な単一AGENTS.mdを作った結果、task/code/docsを押し出す、全部が重要になるため何も重要でなくなる、古いruleの墓場になる、機械的検証が困難になる、という問題が生じました。現在は約100行のAGENTS.mdを「百科事典」ではなく「目次」とし、詳細を構造化された`docs/`へ置いています。docsには検証状態やarchitecture、plans、technical debt等を保存し、専用lintとCIでfreshness、cross-link、structureを検査し、別agentが定期的に古い文書を修正します。したがって、**custom lintはコードだけでなくdocsに実際に使われています。** citeturn17view1turn17view2

architectureについてOpenAIは「実装方法を細かく命令する」のではなく、**invariantを強制する**方式を採っています。domainごとのlayerと許容dependency directionを定義し、custom lintとstructural testsで違反を拒否しています。structured logging、schema/type naming、file size、platform-specific reliabilityなども機械化され、custom lint自体もCodex-generatedです。一方、「境界でdata shapeをvalidateせよ」は強制しても、Zodなど特定ライブラリの選択までは強制しません。つまり、**central boundaries / local autonomy**です。citeturn17view3

そして今回の「教訓を機械的なものへ昇格させる」という考えと極めて近いのが、OpenAIのgarbage collectionです。Codexはrepository内に存在する悪いpatternまで複製するため、当初人間が毎週金曜日、週の20%を「AI slop」清掃へ使っていました。具体例としてOpenAIは、共通utilityではなく個別helperを増殖させること、data shapeを推測して「YOLO-style」にprobeすることを挙げています。現在はgolden principlesを機械的ruleとしてrepositoryに組み込み、background Codexが逸脱を探してrefactoring PRを出しています。OpenAIはこれを「人間のtasteを一度captureし、その後継続的に強制する」仕組みとして説明しています。citeturn17view5

Anthropicは2026年1月9日のagent evalガイドで、評価を**code-based、model-based、human**の三層に分けています。code-basedにはfail-to-pass/pass-to-pass tests、lint、type checking、security analysis、outcome verification、tool-call verification等が含まれ、「fast / cheap / objective / reproducible / easy to debug」が利点です。LLM graderはopen-endedな問題に強い一方、「non-deterministic」「code-basedより高価」「human calibrationが必要」と明記されています。したがって現在の「サブエージェントreview」は有効な一層ではありますが、lint/testの代わりにはなりません。citeturn21view0

Anthropicの現行Claude Code docsではさらに明確に、**「毎回、例外なく起きなければならないactionにはHookを使う」**とされています。CLAUDE.mdはadvisoryですが、Hookはworkflow上の特定pointでscriptを自動実行するためdeterministicであり、例として「editごとにeslint」「migration folderへのwriteをblock」が挙げられています。また、Claude自身にHookを書かせることも公式に案内されています。これは「AIへ`lintを忘れず実行せよ`と教える」のではなく、AIの判断の外側から実行する、という今回の方針を直接支持します。citeturn17view6

Metaにも似た思想があります。2026年4月6日、Metaは4 repository、3言語、4,100超のfileからなるdata pipelineで、AI agentがtribal knowledge不足のため「compileは通るが微妙に間違ったコード」を作る問題を報告しました。そこで50超のspecialized agent taskを使って59個の小型context fileを構築し、各fileを25〜35行程度の「compass, not encyclopedia」にしました。数週間ごとにpath、coverage、critic scoreを再検証してauto-fixします。6タスクの**preliminary test**ではtool callとtokenを約40%削減し、従来約2日必要だった複雑workflowの調査が約30分になったとMetaは報告しています。ただし6タスクの自己評価であるため、一般化には弱い証拠です。citeturn18view0turn18view1

custom lintについてもMetaのFixit 2は参考になります。Fixitはrepository固有ruleをコードベース内に置き、LibCSTによって安全なautofixを行えます。特にlint rule自体に`VALID`と`INVALID`のtest fixtureをinlineで持たせる設計になっており、ruleが「正常コードを落とさず、違反コードを落とす」ことを検証できます。また、一度codemodで既存違反を直した後もlint ruleを残し、同じpatternの再導入を継続的に防ぐ方式です。これはAI生成custom lintをレビューするときにも非常に適したパターンです。citeturn19view0turn17view11

## 定量的な効果と限界

AI開発について「効果が計測された正しい可能性の高い方法か」という問いに対しては、**AIを使うこと自体には平均的な生産性向上を示すRCTが存在するが、その効果は環境によって大きく異なる**、が最も正確です。

| 研究・事例 | 規模 | 主結果 | エビデンス上の注意 |
|---|---:|---|---|
| Management Science field RCT | 4,867 developers | completed tasks **+26.08%**, SE 10.3% | 査読済み。coding assistant中心 |
| Google enterprise RCT | 96 Google engineers | task time **約21%短縮**推定 | 社内RCT。agent-first repoそのものではない |
| METR early-2025 RCT | 16熟練OSS dev、246 task | AI条件で**19%遅延** | 独立RCT。熟練者・既知repoという特定条件 |
| METR 2026 follow-up | original 10 + new 47 | speedup方向だがCI広い | selection biasにより研究者自身が結論を保留 |
| OpenAI agent-first repo | 約1M LOC、約1,500 PR | 手書き比**約1/10時間と自己推定** | 対照群なし。harnessへ大量投資 |
| Meta context case | 4,100+ files、6-task prelim | tool calls/tokens **約40%減** | 小規模preliminary test |
| DORA 2024 | 大規模survey | AI adoption +25%に対しdocs +7.5%、code quality +3.4%、review speed +3.1%、throughput -1.5%、stability -7.2%との関連 | 観測相関、因果ではない |
| DORA 2025 | 大規模industry survey | throughput/product performanceとの関連が前年からpositiveへ、stabilityはなおnegative | 相関研究 |

Microsoft・Accenture等のRCTはAI assistanceに平均的な正の効果があることをかなり強く示していますが、METRの反対結果が示すように、**熟練者が熟知した大型repositoryで、AI outputの確認やcontext探索が余計なコストになるケースでは逆転し得ます。** そのため、AI harnessの改善効果は「token削減」や「AI使用率」だけで測らず、最終的なtask completion time、escaped defects、reworkまで測る必要があります。citeturn16view6turn16view7turn16view8turn16view9

DORA 2024は、AI adoptionが25%上昇するとdocumentation quality +7.5%、code quality +3.4%、code-review speed +3.1%との関連がある一方、delivery throughput -1.5%、delivery stability -7.2%との関連も報告しました。2025年にはthroughputとの関係がpositiveへ変わったものの、delivery stabilityとはなおnegativeな関連が残っています。DORAは「AIは既存の組織能力のamplifier」であり、robust automated testing、version control、fast feedbackなど下流のcontrol systemが弱いと、AIによる変更量増加が不安定性を増幅するとしています。これは今回の「AIそのものではなくharnessを改善する」という発想を支持しますが、DORAは観測研究であり因果効果と解釈してはいけません。citeturn18view7turn18view8turn18view9

Anthropicの2026年6月16日の約40万Claude Code session・約23.5万人を対象とした観測研究では、人間がplanning decisionの約70%を担当する一方、execution decisionはClaudeが約80%を担当していました。またdomain expertiseが高い人ほど成功しやすく、失敗からのrecoveryも良好でした。これは、人間を「コードを書く人」から完全に除去するというより、**人間がproblem definition、acceptance criteria、重要な判断、失敗分類を担当し、agentへexecutionを移す**構造の方が現在の実態に近いことを示します。citeturn21view6

したがって、あなたの改善後に少なくとも計測すべきなのは、単なる`lesson_read_count`ではありません。**task lead time、agent compute/token cost、first-pass success、retry count、AI reviewer catch、deterministic check catch、human catch、post-merge escape、rework、waiver rate、false-positive rate、regression-eval pass rate**を一連のtraceとして持つ方が有益です。OpenAIも2026年5月12日のAgent Improvement Loopで、real traces → human/model feedback → reusable eval → harness changeというfeedback loopを明示しており、「何が起きたか」と「何が重要だったか」を後から再利用可能な証拠へ変えています。citeturn16view3

以前提案した`opportunity_count`については、**これはOpenAI/Anthropicが標準項目として定義しているわけではなく、今回の運用に対する私の設計提案**です。しかし、単なる「Lessonをcontextへ入れた回数」より情報量があります。例えば「DB migrationを変更した」という該当機会が50回あり、Lessonなしなら7回違反する種類のものなのか、そもそも50回中一度も再発しないのかを区別できるためです。

## 失敗例とアンチパターン

最も明確な反証があるのは、**大量のrepository instructionsを与えればagentが良くなる、という仮説**です。OpenAIは巨大AGENTS.mdを実運用で失敗と評価していますし、Anthropicはcontextが増えるほど注意が希薄になるとしています。さらにGloaguenらの2026年2月12日の独立研究では、複数coding agent/LLMでcontext fileを比較した結果、すべてのcontext file条件でcostとstep数が増え、LLM生成contextは平均約3%成功率を悪化させ、人間作成contextの平均+2.4%も統計的有意ではありませんでした。全体として推論costは20%以上増加しました。したがって、**Lesson summaryを上手に圧縮し続けるだけでは根本解決にならず、常時contextから追い出す仕組みが必要**です。citeturn17view1turn17view7turn20search0turn20search2

ただしcontext fileが常に無意味という意味でもありません。Metaのprivate/internal codebaseでは、pretrainingに載っていないtribal knowledgeを25〜35行の小型fileとして提供した結果、preliminary testでtool call/tokenが約40%減りました。Meta自身も、公開OSSではモデルが既に知っているためcontextがredundant noiseになり得ると論じています。したがって残すべきなのは、**モデルが一般知識として持っていないrepo固有の非自明情報、かつコードや機械検査から発見しにくいもの**です。citeturn18view0turn18view1

**AI reviewへの過度な依存にも根拠上の問題があります。** Anthropicはmodel graderを非決定的でhuman calibrationが必要としています。つまり「実装agentが失敗 → reviewer agentが必ず発見」という保証はありません。一方、lint、type、security analysis、binary testsは客観的・再現可能です。そのためAI reviewerは、design coherence、意味、可読性、例外の妥当性など、deterministic oracleを作りにくい領域へ集中させる方が合理的です。citeturn21view0

**multi-agent / subagentも無条件には増やさない方がよいです。** Google Researchの180 agent configuration実験では、parallelizableなFinance-Agentはcentralized multi-agentによりsingle agent比+80.9%でしたが、strictly sequentialなPlanCraftでは全multi-agent variantが39〜70%悪化しました。独立agent構成ではerror amplificationが最大17.2倍、central orchestratorありでは4.4倍でした。さらにCooperBenchのcoding collaborationでは二agent協調の成功率は約25%で、単agentの約半分でした。**分解できる仕事だけsubagentへ分け、中央orchestratorまたは最終integration checkを置く**ことが現在の証拠に最も合います。citeturn16view10turn16view11

**AI生成testを全面的に信用することにも注意が必要です。** MetaのAutomated Compliance Hardeningは、過去に収集したbug/fault dataを使ってLLMに現実的mutantを作らせ、さらにそのfaultを検出するunit testを生成しています。これは非常に有望ですが、Meta自身が従来mutation testingについて、非現実的mutant、equivalent mutant、計算量、低価値faultへの過剰testという問題を列挙しています。つまり「AIがtestを書いた」ことではなく、**そのtestが既知または現実的faultをkillできるか**をoracleにするのが重要です。citeturn19view1

2026年2月11日のMeta JiTTestingはさらに、PRごとにLLMが変更意図を推測し、fault mutantを作り、testを生成・実行し、rule-based + LLM-based assessor ensembleでfalse positiveを減らす方式を示しています。AI-generated testは十分実用化の対象になっていますが、ここでも単一LLM判定ではなく複数oracleを組み合わせています。なお同Engineering記事にはproduction defect削減率のような明確な定量値は提示されていないため、効果量についてはまだ慎重に扱うべきです。citeturn19view3

**自動修正loopそのものが悪いという証拠はありません。** OpenAIはagent review→修正→再reviewを実際に使い、MetaのFixitも安全なautofixを利用しています。問題は、誤ったgraderに対してagentが延々と最適化することです。Anthropicがmodel graderの非決定性とeval maintenanceの必要性を指摘していることから、これは、autofix loopを**deterministic pass condition、iteration/cost budget、同一failure反復時のescalation**で囲うべきだ、という設計上の示唆になります。これは複数一次資料からの推論であり、この三条件自体を比較したRCTがあるわけではありません。citeturn21view0turn17view9turn17view11

過剰なarchitecture enforcementについても同様です。OpenAIが成功したのは「すべての実装方法を固定した」からではなく、**invariantはcentral enforcement、境界内部はautonomy**という分離をしたからです。したがってtasteや将来変更されそうな設計判断までERRORにすると、今度はlintがtechnical debtになります。citeturn17view3

## 現在の改善案との比較評価

現在のLesson運用を最も大きく変えるべき点は、**Lessonファイルを「最終保存先」から「triage queue」に格下げすること**です。OpenAIの2026年5月の公式Cookbookは「real tracesにhuman/model feedbackを付け、それを再実行可能なevalに変え、その証拠からharness changeを作る」という改善flywheelを明示しています。Anthropicも「evalを持たないteamはproduction failureを一つ直して別のfailureを作るreactive loopに陥るが、failureがtest caseになるとregressionを防げる」と述べています。今回考えている仕組みは、この方向と非常に近いです。citeturn16view3turn16view1

推奨する分類は以下です。

| Failureから得た教訓 | 第一の昇格先 | 理由 |
|---|---|---|
| syntax/style/禁止API/依存方向など静的に判定可能 | **Custom Lint / Static Analysis** | 最速・安価・決定論的 |
| 実行結果で正誤判定可能 | **Unit / Integration / E2E** | behaviorを直接検証 |
| architecture invariant | **Structural Test / Custom Lint** | promptより強い |
| 毎回必ず行う処理 | **Hook** | agentの記憶や判断に依存しない |
| merge前に絶対守る条件 | **CI gate** | local agentから独立した最終oracle |
| agentが仕事全体をどう行うかの再発失敗 | **Agent Regression Eval** | model/prompt/harness変更を跨いで再試験可能 |
| 意味的・主観的で機械化困難 | **AI reviewer rubric** | LLMの柔軟性を活用 |
| repo固有で、現在のモデルも繰り返し誤る非自明情報 | **Core Lesson / JIT docs** | 最後まで自然言語が必要な領域 |

この優先順位が重要です。例えば、

> 「Service層はUI層へ依存してはいけない」

を100回Lessonへ書くよりdependency graphを検査する方が強く、

> 「DB migration変更時はmigration testを走らせる」

ならAIへ覚えさせるよりHook/CIの方が強く、

> 「この設計はユーザー体験上、不必要に複雑ではないか」

ならlint化せずreviewer agentや人間へ残す方が適しています。OpenAIのcustom lint/structural tests、Anthropicのgrader分類とHook guidanceはこの分離を直接支持します。citeturn17view3turn17view6turn21view0

### Custom Lintの強度

ここは前回提案した`ADVICE / WARN / ERROR`をほぼ維持してよいですが、**この三段階そのものがAI coding向けの比較研究で実証済み、とは言えません。** 一方、lint ecosystemとしては非常に一般的な考え方です。

ESLintの現行公式docsでは`warn`はexit codeへ影響せず、`error`はnon-zero exitとなります。そして非常に興味深いことに、ESLint自身が、**新しいruleを将来errorへ昇格する前段階、false positiveの可能性がありmanual reviewが必要なruleにはwarnを使う**と明記しています。つまり`WARN → ERROR`という成熟パターンは、少なくともlint実務では公式に想定された運用です。citeturn21view3

今回なら以下が妥当です。

| Severity | 条件 | CI |
|---|---|---|
| **ADVICE** | 新規rule、taste、まだprecision不明 | 通過 |
| **WARN** | 一般には正しいが例外またはfalse positiveあり | 未処理warningはworkflow上解決必須 |
| **ERROR** | deterministic、高precision、重要invariant | block |

`ERROR`へ昇格させる基準は、**重要性だけではなくprecision**も必要です。重大なruleでも誤検知が多ければdeveloper/agentが迂回を学習するため、まずgraderを改善すべきです。これはAnthropicがcode-based gradersについて「客観的だがvalid variationに脆い」と指摘している点とも一致します。citeturn21view0

Waiverという概念も既存lint ecosystemに類似例があります。clang-tidyには`NOLINT`等によるdiagnostic suppressionがあり、公式docs自体が「なぜ抑制するのかmotivationを説明する」例を示しています。ESLintもrule suppression commentへ説明文を付与できます。したがって、**例外を無言で無視するのではなく、machine-readableなwaiver＋理由を残す**設計は十分筋が通っています。citeturn21view4turn21view3

ただし、

> WARN → AIがWaiver理由を書く → 別AIが妥当性を判定 → 自動merge

という**全自動chainの信頼性を直接測った強い研究は今回確認できませんでした。**

ここは「理論的には妥当だが実証不足」です。したがって当初は、low-risk waiverのみAI承認を許可し、security、data loss、public API compatibility、migration、権限境界などhigh-impact ruleのwaiverはhuman approvalを残すべきです。AI reviewerの判定を人間と比較して十分なcalibration dataが集まってから自動化範囲を広げるのが安全です。AnthropicもLLM graderはhuman calibrationを必要とするとしています。citeturn21view0

### Custom LintをAIに書かせること

**問題ありません。ただし「AIが生成したから信用する」でも「人間が500行全部手作業で証明する」でもなく、rule specificationとfixturesを中心に検証するべきです。**

OpenAIはcustom lintersを「Codex-generated」と明記しています。Meta Fixit 2ではlint ruleに`VALID`と`INVALID` test caseを直接持たせています。この二つを組み合わせると、かなり強い運用になります。citeturn17view3turn19view0

レビュー対象は、実装コードそのものだけでなく、

1. 本当に守るべきinvariantか。
2. 典型的違反を全部検出するか。
3. 合法なvariationを誤検知しないか。
4. import alias、indirect dependency、generated codeなど迂回patternを逃さないか。
5. rule自身にunit/fixture testがあるか。
6. ERROR messageに「なぜ違反か」「どう直すか」があるか。
7. autofixを行うならsemantic changeを起こさないか。
8. rule変更時に既存regression fixtureが残るか。

を見るのがよいです。OpenAIもcustom lint error messageにremediation guidanceを入れてagentが自力修正できるようにしており、MetaはCSTによるsyntax-preserving autofixとfixtureを採用しています。citeturn17view3turn19view0

## 推奨する改善アーキテクチャ

以上から、現在の仕組みは次の形に変更するのが最も合理的です。

```text
                   Human / Agent Failure
                            │
                            ▼
                     Failure Registry
                            │
           ┌────────────────┼────────────────┐
           │                │                │
      high impact      recurring       low-risk / new
           │                │                │
     immediate gate     classify         observe
           │                │                │
           └────────────────┼────────────────┘
                            ▼
                    Promotion Decision
                            │
        ┌──────────┬────────┼────────┬──────────┐
        ▼          ▼        ▼        ▼          ▼
      Lint       Tests     Hook      CI      Agent Eval
        │          │        │        │          │
        └──────────┴────────┴────────┴──────────┘
                            │
                    mechanizable?
                     │           │
                    YES          NO
                     │           │
                    retire       ▼
                    lesson    Core Lesson
                              / JIT Docs
```

ここで**Lessonは「failureを忘れないためのtemporary representation」であり、永久資産ではありません。** これは今回の調査から最も強く推奨できる変更です。OpenAIの「docsでは足りなければruleをcodeへpromote」、OpenAIのtrace→feedback→eval→harness loop、Anthropicのfailure→test case→regressionという考え方がすべて同じ方向を指しています。citeturn17view3turn16view3turn16view1

Failure Registryは例えば次程度で十分です。

```yaml
id: FAILURE-0042
created_at: 2026-08-31
category: architecture
impact: medium

task_type: add-api-endpoint

failure:
  description: service imported ui package
  escaped_to_human: true

measurement:
  opportunities: 12
  violations: 4
  caught_by_static: 0
  caught_by_ai_review: 3
  caught_by_human: 1

resolution:
  status: promoted
  target: custom-lint
  rule_id: ARCH-007

waivers:
  requested: 0
  accepted: 0
  rejected: 0

regression_eval:
  id: EVAL-ARCH-0042
  enabled: true
```

重要なのは`lesson_loaded: 713`のような値ではなく、**問題が発生し得た機会に何回失敗したか、どこで捕捉したか、production/humanまでescapeしたか**です。Lessonを1,000回読ませて違反0回でも、その1,000回に該当機会がなければLessonの有効性について何も分かりません。これは今回の資料にそのまま定義されたindustry standardではなく、OpenAIのtrace-based feedback loopとAnthropicのeval philosophyを今回の運用へ適用した推奨設計です。citeturn16view3turn16view1

また、「数回再発するまでLint化を待つ」というルールも一律にはすべきではありません。例えばspacing ruleなら観測してよいですが、credential漏洩、data deletion、authorization bypass、irreversible migrationのようにimpactが大きいものは**初回でmechanical gateへ昇格**する方が合理的です。したがって昇格priorityは概念的には、

```text
Priority ≈ Impact × Recurrence likelihood × Mechanical detectability
```

として扱うのがよいでしょう。これは本調査からの設計上の推論です。

### Agent Regression Evalの具体形

「失敗した過去taskそのものを保存する」は、単にLessonへ文章を残すこととは根本的に異なります。

例えばAIへ、

> User削除機能を実装してください。

と依頼した結果、User本体は消えたが関連するSessionが残るbugを起こしたとします。

通常のLessonなら、

```text
User削除時は関連Entityも確認する。
```

だけです。

Agent regression evalにすると、次のように**事故が起きる前の世界を再現**します。

```text
evals/
└── delete-user-cascade/
    ├── task.md
    ├── base_commit.txt
    ├── setup.sh
    ├── metadata.yaml
    └── grader/
        ├── existing_tests.sh
        ├── orphan_session_test.sh
        └── architecture_check.sh
```

`task.md`は当時の依頼または同じ能力を要求するtask、`base_commit.txt`は修正前のrepository状態です。agentへ過去の正解patchは見せません。

```text
checkout failure-before-fix
        │
        ▼
新モデル / 新prompt / 新harness
へ同じtaskを渡す
        │
        ▼
agentが自由に実装
        │
        ▼
existing tests
+ 過去failure専用grader
+ static analysis
+ 必要ならLLM rubric
        │
        ▼
PASS / FAIL
token / latency / retries
```

Anthropicが2026年1月9日に説明しているcoding-agent evalも、**well-specified task + stable environment + thorough test**を基本とし、SWE-bench型では実際のGitHub issueをagentへ渡し、既存failureを直しながら既存機能を壊していないかtest suiteで判定します。そして一度安定して解けるようになったcapability taskは、継続実行されるregression suiteへ「graduate」させるとしています。citeturn21view1turn21view2

OpenAIはさらに2026年5月12日、**real trace → human feedback / model feedback → rerunnable eval → harness change**を具体的なCookbookとして公開しました。したがって「人間の指摘をそのままevalへ昇格する」発想は、単なる私の提案ではなくOpenAIが明示している改善loopにかなり近いです。citeturn16view3

この方式の最大の利点は、Lessonを消せるか実験できることです。

```text
現モデル + Core Lesson       20 / 20 PASS
現モデル - Core Lesson       12 / 20 PASS
```

ならLessonにはまだ価値があります。

新モデルになって、

```text
新モデル - Core Lesson       20 / 20 PASS
```

が複数回・複数variantで維持されれば、自然言語Lessonを常時contextから外す根拠になります。

ただしLLMは確率的なので、重要evalを1回だけ実行して100%と判断しない方がよく、重要なbehaviorは複数trialでpass rateを見るべきです。Anthropic自身もregression evalは「nearly 100%」を期待するものと位置付けています。citeturn21view1

### 実行保証のレイヤー

最終的なverificationは、次のような多層構造を推奨します。

```text
AI implementation
       │
       ▼
automatic local hooks
       │
       ├─ format
       ├─ targeted lint
       └─ cheap tests
       │
       ▼
agent self-check
       │
       ▼
independent deterministic verification
       │
       ├─ custom lint
       ├─ type/static analysis
       ├─ tests
       ├─ architecture checks
       └─ docs checks
       │
       ▼
AI reviewer / subagent
       │
       ▼
waiver validation where needed
       │
       ▼
CI gate
       │
       ▼
merge
       │
       ▼
production monitoring
       │
       ▼
new failures → Failure Registry
```

AnthropicはHookを「zero exceptions」のactionに使うとし、evalをCI/CDでagent/model変更ごとに実行し、productionではmonitoringによって予想外のreal-world failureを検出する多層構造を推奨しています。単一layerでなく複数layerを組み合わせる考え方も明示されています。citeturn17view6turn16view1

WARNについては単にstderrへ黄色い文字を出すのではなく、

```text
PASS
FIXED
WAIVED(reason + evidence + reviewer)
```

のいずれかへ**必ずresolutionする**構造を推奨します。ただしこれは私の具体的設計提案であり、この三状態方式が比較実験で優位と証明されたわけではありません。

そしてWaiver自体をanalytics対象にします。

```text
rule: ARCH-014
hits: 83
fixed: 61
waived: 22
waiver_approved: 20
waiver_rejected: 2
false_positive: 16
```

これなら、`waiver率26% / false-positive多数`のruleを「agentが悪い」と解釈するのではなく、**rule specification自体が悪い可能性**を検討できます。逆にwaiverがほぼなくprecisionも高いruleならWARN→ERRORの候補です。ESLintが新ruleやfalse-positive可能性のあるruleをwarnにする運用を明示していることとも整合します。citeturn21view3

## エビデンスの強さと未解決領域

ここまで調べて、かなり確度高く言えるものと、まだ「良さそう」に留まるものは明確に分かれます。

**「AIの失敗を自然言語ルールへ永久追加するより、可能ならdeterministic checkやregression testへ変える」方向には複数の独立した根拠があります。** OpenAIは実repositoryで「docsだけでは足りない」「ruleをcodeへpromote」としてcustom lint/structural testsを採用し、Anthropicはcode-based graderをLLM graderより客観的・再現可能なものと位置付け、Metaは現実のfault dataから再発防止testを生成しています。ただし「Lesson昇格システム導入前後でdefect率がX%低下」という直接のRCTはまだ確認できませんでした。したがって評価は「強い実務的根拠」ですが、「方針全体への強い因果実証」ではありません。citeturn17view3turn21view0turn19view1

**常時contextの肥大化を防ぐ必要性については、かなり強いです。** OpenAIのproduction failure、Anthropicのcontext engineering、独立AGENTS.md benchmarkが同じ方向を示しています。ただし「AGENTS.mdを必ず100行以下にすればよい」のような閾値は一般化できません。Metaでは25〜35行のrepo-local compassが有効だった一方、独立研究ではcontext filesの全体効果が弱かったからです。重要なのは固定行数より**必要性、repo-specificity、retrievability、freshness、measured effect**です。citeturn17view1turn17view7turn18view1turn20search2

**ADVICE→WARN→ERRORは妥当性が高いものの、AI開発特有の強い実証は不足しています。** ESLint自身が、新ruleやfalse-positiveの可能性があるruleをwarnとし、後にerrorへする運用を想定しているためソフトウェア工学上のprecedentは十分あります。Waiver＋理由についてもclang-tidy/ESLintのprecedentがあります。しかし、waiverをLLMが書き、別LLMがレビューする完全自動系については独立した長期production studyが不足しています。citeturn21view3turn21view4

**multi-agentについては、むしろ慎重になるべき証拠が増えています。** parallelizable taskで非常に強い一方、sequential reasoningや密な共有stateを伴う作業ではcoordination overheadがagent追加のbenefitを上回る場合があります。したがって「レビューを別agentにする」は合理的ですが、「すべての実装を複数agentに投票させる」「agent数を品質パラメータとして増やす」は現時点では非推奨です。citeturn16view10turn16view11

OpenAIのagent-first repositoryもまだ歴史が短いことを忘れるべきではありません。5か月で約100万行というthroughputは非常に興味深い一方、OpenAI自身が、そのarchitecture coherenceが**年単位**でどうなるかはまだ学習中であるとしています。そのため今回の最大の未解決問題は、「agent-generated codebaseを2年、5年と維持した場合、custom lintやgarbage collectionがtechnical entropyを本当に抑制できるか」です。citeturn17view5turn17view0

もう一つの未解決点は**AI生成guardrail自身の劣化**です。OpenAIではlintもCodex生成ですが、AI生成lintと人間生成lintのfalse-negative/false-positive率を長期間比較した公表データは今回確認できませんでした。したがってcustom lintをAIに書かせることは合理的でも、**rule specification、VALID/INVALID fixtures、regression tests、exception behaviorは人間が品質所有権を持つ**べきです。OpenAIのAI生成lint実例とMeta Fixitのfixture-first設計を組み合わせるのが、現時点では最も堅い方法です。citeturn17view3turn19view0

最後に、AIによる生産性向上そのものもまだ高速に変化しています。2025年前半のMETR RCTは19% slowdownだった一方、2026年2月の追跡ではspeedup方向への変化が観測されましたがselection biasで正確な効果を推定できなくなりました。この速度でmodel/harnessが変わる以上、**過去のLessonが今も必要かを人間の感覚で判断するのではなく、regression evalで定期的に再測定する**という今回の方針は、モデル進歩に追従する意味でも価値があります。citeturn16view7turn16view8

## 最終推奨

現在の計画について、最終的には次の三分類を推奨します。

| 分類 | 施策 | 推奨内容 |
|---|---|---|
| **そのまま採用してよい** | Failure/Lessonを記録する | ただし永久memoryではなくtriage入口として扱う |
| **そのまま採用してよい** | Lesson → Lint / Static Analysis | deterministicに表現できるものを最優先で昇格 |
| **そのまま採用してよい** | Lesson → Unit / Integration / Structural Test | behavior/invariantは自然言語から退役させる |
| **そのまま採用してよい** | Hook | 必ず起きるactionをAIの記憶から切り離す |
| **そのまま採用してよい** | CIで独立再検証 | agent自身の「完了した」という判断を信用しない |
| **そのまま採用してよい** | Agent Regression Eval | 過去failureを再現可能なtaskへする |
| **そのまま採用してよい** | 短いAGENTS/CLAUDE＋JIT docs | 常時contextを小さくし、詳細は必要時取得 |
| **そのまま採用してよい** | AIにcustom lintを書かせる | rule specificationとfixtureはレビュー対象にする |
| **修正すべき** | Lessonを要約し続ける | 要約ではなくLint/Test/Hook/Evalへの「卒業」を主要mechanismにする |
| **修正すべき** | Lesson接触回数 | read countよりopportunity / violation / catch / escapeを計測 |
| **修正すべき** | WARN | 単なるwarningではなくFIXまたはWAIVERまでresolutionさせる |
| **修正すべき** | WaiverのAIレビュー | low-riskから開始。high-riskはhuman calibrationを残す |
| **修正すべき** | ADVICE→WARN→ERROR | 年月ではなくprecision、false positive、waiver率、impactを昇格条件にする |
| **修正すべき** | AI reviewer | deterministic checksの代替ではなく、その上のsemantic layerにする |
| **修正すべき** | subagent | task decomposabilityを確認して使用。central integrationを必須化 |
| **まだ広範には導入しない** | すべてのWARNの自動Waiver承認 | LLM graderの校正dataが不足 |
| **まだ広範には導入しない** | agent数を増やすことで品質保証 | sequential taskでは実測上逆効果になり得る |
| **まだ導入しない** | taste・設計好みの大量ERROR化 | architectureを硬直させる危険 |
| **まだ導入しない** | AI-generated testだけをoracleにする | deterministic/reference/mutation等でtest自体を検証する |
| **まだ導入しない** | 巨大なrepository instruction | production事例・独立研究双方から否定的証拠あり |

したがって、改善担当へ渡す実装上の核心を一文に圧縮すると、

> **人間・AIレビューで発見した失敗はFailure Registryへ一度だけ記録し、再利用可能なものはできる限りLint、Static Analysis、Test、Hook、CI、Agent Regression Evalへ昇格させ、自然言語のCore Lessonsには「現在のモデルでも繰り返し間違え、repo固有で、機械判定できないもの」だけを残す。**

となります。OpenAIの「失敗したら、何のtool・guardrail・documentationが不足していたかを特定してrepositoryへ戻す」というagent-first engineering、Anthropicの「failureをtest caseへ変えてregression suiteにする」というeval-driven development、Metaの「tribal knowledgeを小さなcompassへし、fault dataから機械的testを作る」という事例を統合すると、この方向が現時点で最もエビデンスと整合します。citeturn17view4turn16view3turn16view1turn18view1turn19view1

ただし、**「この方法が正しい」と固定してしまうこと自体は避けるべきです。** AI codingの生産性は同じ時代でも+26%というRCTと-19%というRCTが共存し、AGENTS.mdについても企業内部では大きな効果が出る一方、公開repository benchmarkでは効果が乏しいという結果が出ています。最も信頼できる最終判定者は、有名企業の方法論ではなく、あなた自身のrepositoryで蓄積される`Failure Registry + Regression Eval + production metrics`です。citeturn16view6turn16view7turn18view1turn20search2

その意味で今回の計画の本当の強みは、特定のAIモデルやプロンプトへ最適化することではありません。**「失敗 → 計測 → 再現 → 機械化 → regression検証 → 不要になった自然言語ルールを削除」という自己修正可能な開発システムを作ること**にあります。現時点の一次情報を総合すると、この部分こそが最も採用価値の高い改善方針です。citeturn16view3turn21view1turn17view3