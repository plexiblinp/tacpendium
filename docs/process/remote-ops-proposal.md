# 夜間・外出先運用 改善提案書(remote-ops-proposal)

| 項目 | 内容 |
|------|------|
| 文書ID | PROC-001 |
| ステータス | 提案 v1.1(開発者未承認。本書の承認後に Step 単位で実装指示) |
| 作成日 | 2026-07-18(v1.1 改訂: 2026-07-19) |
| 作成者 | Claude Code(プロセス改善担当) |
| 対象 | 開発プロセス・設定資産(`.claude/`、docs 運用)。アプリコード・テストは対象外 |
| 根拠調査 | Remote Control 公式仕様(code.claude.com/docs、2026-07 時点)、`.claude/` 全27コマンド+フック実体、docs/handover・progress・instructions の受け渡し実態、サブプロジェクト autopilot-combomgr の運用モデル |

### 改訂履歴

| 版 | 日付 | 内容 |
|----|------|------|
| v1.0 | 2026-07-18 | 初版 |
| v1.1 | 2026-07-19 | 開発者フィードバック反映: ①「Web版向け課題レポート」の実態訂正(tmp/ に手動作成・手動要請・アーカイブ有り) ②「PC を稼働させたまま外出しない」方針に基づき、外出先の主軸を Remote Control から **Claude Code on the web** へ転換(仮説1は補助へ縮小採用) |
| v1.2 | 2026-07-20 | 実装着手(開発者承認済みプラン): **Step 1 実施済み**(S1-C1〜C5)・**Step 2 実施済み**(S2-C1〜C7。branch protection と Web版 Projects 設定は開発者作業として残)・Step 3 は S3-C1/C2/C4 実施+S3-C3(push 統制改定)は diff 提示のみで開発者再承認待ち。**Step 5(Remote Control 補助)は恒久見送り(開発者決定)**。§4.5 と §7 の Step 5 は記録として残置 |

---

## 1. 目的と適用範囲

### 1.1 解決する問題

Claude Web版(設計・指示書作成)⇔ devContainer 内 Claude Code(製造)の間の受け渡し物(handover 資料・指示書・完了レポート・課題フィードバック)の輸送が **人間+PC に完全依存** しており、外出先(スマホのみ・回線不安定)では開発が完全に停止する。本書は「夜間・外出先でもフローを前進させられる」状態を、品質統制を弱めずに実現するための変更提案である。

**前提方針(v1.1)**: 開発者は PC を稼働させたまま外出しない。したがって外出先運用は「ローカルプロセス常駐を要する仕組み(Remote Control)」ではなく、**クラウド実行の Claude Code on the web を主軸**に組み立てる。

### 1.2 不変条件(本提案が変更しないもの)

以下は本提案のすべての項目で維持する。第5章で提案ごとの適合を論証する。

1. **Plan Mode 承認**: 指示書実装は計画提示→開発者承認が入口ゲート
2. **指示書駆動**: 設計担当(Web版)の指示書・レビューチェックリストが作業の正
3. **人間レビュー**: コミット履歴レビューと手動E2E(品質ゲート。自動化提案はしない)
4. **正史(main)への反映は人間**: main への反映は常に人間の明示的行為による(CLAUDE.md §10 の目的「トレーサビリティの確保」)。なお `claude/` 名前空間のブランチは autopilot-combomgr と同じく「正史ではない作業領域」と位置づけ、そこへの push は本条件に抵触しない(正史化は常に人間マージ)

---

## 2. 現状分析

### 2.1 受け渡しフローの実態(実物調査結果)

Web版⇔リポジトリ間に自動連携は一切なく、GitHub 直読の運用記述も docs/ 全域に存在しない(playbook §12.1 は「開発者が `/mnt/user-data/uploads/` にアップロードし、設計担当が grep/view で読む」前提)。人間+PC が輸送している受け渡し物:

| 方向 | 成果物 | コミット状態 | 輸送方法 |
|------|--------|-------------|----------|
| Web版→repo | 指示書・レビューチェックリスト・CHANGE 通知書・改訂設計書 | outputs から DL 後にコミット | 開発者が DL→配置→commit(PC 必須) |
| repo→Web版 | playbook / code-facts / docs-map / progress-summary / handover / 設計書 | コミット済み | 開発者が uploads へ手動添付(PC 必須) |
| repo→Web版 | 起動キット投入プロンプト(`m*-startup-kit.md` §2) | コミット済み | 開発者が手でコピペ |
| repo→Web版 | `design-templates.zip` | **非コミット**(.gitignore、投入直前生成) | 手動添付 |
| repo→Web版 | tmp/ 手交メモ(例: m12-phase2-memo-triage.md) | **非コミット** | 手交 |
| repo→Web版 | **Web版向け課題レポート**(開発者が都度手動で作成要請。直近は毎回作成) | **非コミット**(`tmp/` 配下、.gitignore 対象。揮発性は高いがアーカイブは別途保持) | 手交(PC 必須) |
| repo→Web版 | 完了報告 §1(実査結果)/§3(独自判断)、レビュー報告書 | コミット済み | 開発者が要点転送/添付 |
| 双方向 | 着手前質問書と回答(playbook §8.4.2) | 任意 | 開発者がコピペ転送 |

補足(v1.1 訂正): 「Web版向け課題レポート」は単一成果物として実在するが、**生成の仕組みは未整備**で、開発者が都度手動で作成を要請し、出力先はコミット対象外の `tmp/` である。源泉情報(completion-report §1/§3、CHANGE 通知書等)から手作業で都度まとめている状態であり、本書 §4.3 でこの既運用の「正式化(コマンド化+出力先の docs 昇格)」を提案する。

### 2.2 Git 統制の現状と目的

- `.claude/settings.json`: allow は `git add`/`git commit`+参照系のみ、deny で push/merge/rebase/reset/checkout/pull/fetch 等を機械強制(150-237行)
- CLAUDE.md §7/§10: push=開発者専権。目的は「トレーサビリティの確保」— 履歴改変・リモート反映を人間に限定すること
- CLAUDE.md §10 には「ルール本文と目的に乖離が生じた場合は Plan Mode で開発者確認」という改定手続きが既に用意されている(§4.4 はこの手続きに則る)

### 2.3 外出先運用(応答遅延・細切れ操作)で破綻する5箇所

以下は devContainer セッションを遠隔操作する場合の破綻点である。v1.1 で外出先主軸を Claude Code on the web に転換したため「外出中の直撃」は減るが、**在宅夜間の細切れ運用・Remote Control 補助利用時(§4.5)には引き続き該当**し、B-2/B-4/B-5 は平時の devContainer 運用改善としても価値がある。

| # | 破綻箇所 | 根拠 |
|---|----------|------|
| B-1 | **Plan Mode 自動タイムアウト→自動承認扱い**。応答が遅いと未承認のまま「編集承認」扱いで進む。防止手段なしと各コマンド自身が明記 | implement_plan_full.md 93-99行、implement_plan.md 65-71行、各キット Step 5 |
| B-2 | **`bash scripts/generate-*.sh` の権限プロンプト滞留**。next_milestone_kit / next_phase_kit は settings.json に `Bash(bash:*)` 許可がなく frontmatter allowed-tools も無いため、スクリプトごとに承認待ちで停止。resume_milestone_kit のみ frontmatter whitelist 済み(4行)という非対称 | settings.json allow 52-148行、next_milestone_kit.md、resume_milestone_kit.md 4行 |
| B-3 | **長大キット生成中のコンパクションによる中間情報喪失**。細切れ進行ほど圧縮確率が上がる(tmp/ephemeral-*.md 退避運用はあるが退避漏れリスクあり) | next_milestone_kit.md 61-73行 |
| B-4 | **AskUserQuestion・「はい」待ちでの完全停止**。cleanup_docs の差分確認質問、各コマンドの引数曖昧時の候補確認 | cleanup_docs.md 184行、implement_plan_full.md 47-53行 |
| B-5 | **_wt 系フックの動作前提**。settings.json と hooks/*.sh の両方がコミット済みブランチでのみフックが動作。外出先で新規 worktree を切ると黙って無効化されうる | custom-commands.md 84行 |

### 2.4 ドキュメント⇔実体の食い違い(指摘事項)

依頼に基づき、実物調査で発見した食い違いを指摘する(是正案は §4.6)。

| # | 食い違い | 実体 | ドキュメント側 |
|---|----------|------|----------------|
| D-1 | **notify-bell フックが未記載** | Stop(第2ブロック)+ Notification の2登録が実在(settings.json 39・46行、`.claude/hooks/notify-bell.sh`) | settings.json の `_hooks_comment`(14-20行)と custom-commands.md §品質フックは PostToolUse と Stop-test の2挙動しか説明していない |
| D-2 | **キット系の権限記述と実態の不整合** | `Bash(bash:*)` は allow に無く、next_milestone_kit / next_phase_kit に frontmatter whitelist も無い→実際は承認プロンプトが出る | next_milestone_kit.md 98行等が「スクリプトは読み取り系コマンドのため Plan Mode 中でも実行してよい」と記述 |
| D-3 | **完了レポート/課題レポートの生成コマンドは存在しない** | `docs/progress/m*-completion-report.md` も「Web版向け課題レポート」(tmp/)も手動作成。コマンドが生成するのは `-review.md` / `-report.md` のみ | 「レポート」という語から自動生成されると誤読しうる導線(今回の改善依頼の初期仮説も「完了レポート生成カスタムコマンドに追加」という誤認を含んでいた) |
| D-4 | **「repo外・開発者手交」表記の二重性** | command-resolution-request 等の一次 spec は実際には `docs/human-notes/future-notes/` にコミット済み | milestone-startup-guide.md が「repo 外・開発者手交」と表記(運用上の区別と物理的所在が乖離) |

なお CLAUDE.md §7/§10 と settings.json の Git 統制記述は完全に整合しており問題なし。

---

## 3. 提案サマリ(仮説の判断)

| 仮説 | 判断 | 理由の要点 |
|------|------|-----------|
| (新)外出先主軸 = Claude Code on the web | **採用**(v1.0 の Step 6 任意試行を主軸に昇格) | クラウド VM 実行のため **PC 電源断で成立**(開発者方針と唯一整合)。autopilot-combomgr で統制モデル(`claude/` ブランチ限定 push+人間マージ)を実証済み。§4.1 |
| 1. Remote Control + tmux でスマホ操作 | **縮小採用(補助)** | 権限統制面は優秀(Bypass 不可)だが、**ローカルプロセス常駐が必須=PC つけっぱなし外出が前提**となり開発者方針と両立しない。在宅時のモバイル操作・例外的に PC を残す日の補助に限定。§4.5 |
| 2a. 受け渡し物の docs 集約 | **採用** | 非コミット3品(design-templates.zip、tmp 手交メモ、**tmp/ 課題レポート**)が直読の障害。§4.2 |
| 2b. Web版は GitHub 連携で直読 | **採用(妥協点明記)** | 鮮度は「最後に push した時点」。web 主軸化により claude/ ブランチ経由の push 頻度が上がり、鮮度問題はむしろ緩和方向。§4.2 |
| 2c. 完了レポート生成コマンドに自動 commit&push 追加 | **変更採用** | 生成コマンドは現存しない(D-3)が、**手動作成の実運用は既に定着**(tmp/ 課題レポート)。この既運用を正式化: 収集・整形コマンド新設+出力先を tmp/ から docs 配下(コミット対象)へ昇格。commit まで自動・push は §4.4 の統制に従う。§4.3 |
| 2c'. 自動 push(無承認で正史へ) | **却下** | 無承認 push は「正史への反映は人間」の目的と正面衝突。代替: サーバ側担保(branch protection)+`claude/` 名前空間限定 push+人間マージ。§4.4 |
| 3. 破綻箇所の洗い出しと対策 | **採用** | B-2/B-4/B-5 は平時の devContainer 運用改善としても価値。B-1/B-3 は在宅細切れ運用・RC 補助時に残る。§4.6 |

---

## 4. 提案詳細

### 4.1 外出先の主軸: Claude Code on the web 併用(v1.1 で昇格)

#### 仕組みと成立条件

- Anthropic クラウド VM 上で Claude Code が実行され、スマホ(claude.ai アプリ/ブラウザ)からセッション開始・指示・追送メッセージ・途中停止が可能。**ローカル PC は不要(電源断で成立)**
- 成果はプラットフォーム既定で **`claude/` 名前空間のブランチ**へ push され、PR として人間がマージ。「Allow unrestricted branch pushes」は OFF のまま維持(autopilot-combomgr と同一設定)
- サブプロジェクト autopilot-combomgr が同方式で既に運用実績あり。メインリポジトリへの適用が今回の新規部分

#### 統制設計(不変条件との整合)

| 統制 | web 併用時の担保 |
|------|-----------------|
| 正史保護 | 第0層 branch protection(§4.4)+ `claude/` 限定 push。main への反映は常に人間マージ |
| Plan Mode / 重要未決 | web セッションでも「計画提示→開発者応答待ち」の対話は可能(挙動差は V-3 で検証)。「重要未決なら保留」規律を web 用注意書きに転記 |
| 人間レビュー | PR 差分レビュー(GitHub モバイルアプリで外出先から可能)+ 帰宅後の PC レビュー |
| 手動E2E | **実装系タスクの PR は帰宅後の手動E2E 通過までマージしない**をルール化。docs 系・調査系 PR はモバイルマージ可 |

#### タスク適性と段階導入

1. **第1段階(環境要件が軽い)**: 調査・docs 整備・提案書類・レビュー系。フレッシュ VM でも即成立
2. **第2段階(環境検証後)**: `go test` / `pnpm test` を伴う実装タスク。VM 上に Go 1.26.x + pnpm 9.13 + 依存取得が再現できること(V-1)が前提。手動E2E は VM では実施不可のため、上記の「帰宅後E2E→マージ」ゲートで担保
3. 指示書駆動は不変: 指示書はコミット済みのため VM からそのまま読める。起動プロンプトはスマホからコピペ可能な形式(§4.2 のキット改修)

#### Web版(設計チャット)⇔ repo の還流(スマホ完結経路)

- **repo→Web版**: GitHub 直読(§4.2)。web セッションの成果も人間マージ後は直読可能
- **Web版→repo**: Web版 outputs の指示書等を **スマホでコピー(または DL→添付)→ web セッションに投入** → VM の Claude Code が命名規則に従い `docs/instructions/` 等へ配置+commit+push(claude/)→ 人間が PR マージで正史化。回線不安定時は分割貼り付けで成立(添付可否は V-3)

#### settings.json との整合(要決定事項)

`.claude/settings.json` はコミット済みのため web VM でも読み込まれ、現行の `git push` deny が web の push 動線と衝突しうる。落としどころは §4.4 第1層を参照(claude/ 名前空間限定の許可へ改定。表現方法・deny 優先順位は V-2 で実機検証)。

### 4.2 受け渡し物の docs 集約 + Web版 GitHub 直読(仮説2a/2b)

#### repo → Web版 方向(自動化の本丸)

Web版チャットの GitHub 連携でリポジトリを直読する前提に切り替え、手動アップロードを廃止する。前提整備:

1. **design-templates.zip の解消**: zip は「複数テンプレを1回の添付で渡す」ための包装であり、直読時代には不要。テンプレ実体(`docs/instructions/templates/`)は既にコミット済みのため、**Web版へは該当ディレクトリを直読させる**。`scripts/generate-template-zip.sh` は PC 手動投入時の後方互換として残置
2. **tmp/ 手交メモ・課題レポートの昇格**: 非コミットの手交メモおよび「Web版向け課題レポート」(§2.1 補足)は、コミット対象の受け渡し領域(例: `docs/handover/` 配下の軽量ファイル)へ昇格させる運用に変更。課題レポートの正式化は §4.3
3. **起動キットの投入プロンプト**: `m*-startup-kit.md` §2 のコピペは従来通り(スマホでも可能な操作)。ただし「添付ファイル一覧」の節は「直読対象パス一覧」へ書き換える(キット生成コマンドの変換規則に1項目追加)
4. **鮮度の妥協を明文化**: Web版が見えるのは「最後に push し、かつ Web版側で GitHub 同期(『Sync now』)を実行した時点」(同期は手動。公式ヘルプ確認済み 2026-07-20。直読対象ブランチの仕様は V-4)。web 併用時は claude/ ブランチ→人間マージの頻度が実質の鮮度を決める。playbook / startup-guide の該当箇所(§12.1 の uploads 前提、§5 の「アップロードする」)は、承認後の実装 Step で改訂を設計担当に依頼する(CHANGE 相当の扱い。playbook は設計担当の管轄文書のため本書では変更対象一覧への掲載に留める)

#### Web版 → repo 方向

- **主経路(外出先・PC 電源断)**: §4.1 の「web セッションへ投入→配置+push(claude/)→人間マージ」
- **補助経路(在宅・PC 稼働時)**: 従来どおり開発者が DL→配置→commit。Remote Control 補助(§4.5)を使う日はモバイル添付経路も可
- 配置先・命名の定型プロンプトを remote-ops.md に用意し、スマホ入力量を最小化

### 4.3 完了ダイジェスト収集コマンド新設(仮説2c 変更版)

- **実態(v1.1 訂正)**: 「Web版向け課題レポート」は開発者の手動要請により都度作成され、`tmp/`(.gitignore)に置かれ、アーカイブは別途保持されている。つまり**需要と型は実運用で実証済み、欠けているのは仕組みと置き場所**
- 提案: この既運用を正式化する
  1. 新設コマンド `/completion_digest`(仮称)が、指定サブマイルストーンの源泉(completion-report §1「実査結果」/§3「独自判断」+ CHANGE 通知書 §4/§7 等、現行レポートの実作成手順に合わせて確定)を収集・整形し、**Web版投入用ダイジェスト(派生ファイル)を docs 配下(コミット対象)に生成**。`git add`+`git commit` まで行う(既存 allow 内)
  2. 出力先が tmp/ から docs へ移ることで、Web版 GitHub 直読(§4.2)の対象になり手交が不要化。アーカイブも Git 履歴に一本化
  3. 源泉の分散構造(completion-report / CHANGE)は維持し、本プロジェクト確立済みの「源泉→派生+鮮度監査(check_derived_docs)」パターンに合致させ、check_derived_docs の監査対象に追加
- これにより D-3(生成コマンドがあるという誤読導線)も解消される
- 揮発性の高い作業用途(レビュー中の一時メモ等)は従来どおり tmp/ を使ってよい。昇格対象は「Web版へ渡す完成版」のみ
- **実装状況(2026-07-20 開発者指示)**: コマンドは `/design_handover_report`(`.claude/commands/design_handover_report.md`)として**実装済み**(自己説明的な名称を採用。スクリプト分離なしの純コマンド=作文・選別が判断主体のため)。出力先は当面 **本体 `combomgr/tmp/`(非コミット)を維持**し、worktree 作業時も本体 tmp へ直接出力する例外を開発者が許可済み(OS の `/tmp` との混同防止の明記をコマンド本文に含む)。上記の docs 昇格(直読対象化+commit)は Step 2 採用時に出力先切替で対応する。なお check_derived_docs への登録は git コミット時刻ベースの鮮度判定であるため、tmp 出力の間は対象外(docs 昇格時に登録)

### 4.4 push の落としどころ(autopilot-combomgr モデルの移植)

無承認での正史 push は却下する。その上で、web 主軸化に必要な push 経路を、autopilot-combomgr で実証済みの **多層防御モデル**(push は許すが行き先をブランチで絞る/真の担保はサーバ側/settings deny は defense-in-depth)で成立させる。

#### 第0層(前提・リスクゼロ): サーバ側担保

- **GitHub branch protection で main を保護**(直 push 禁止・PR 必須・人間マージ)。クライアント(devContainer / web VM / 誤操作)を問わず「正史への反映は人間」がサーバ側で保証される。既存運用への影響なし(現状でも main へは開発者しか push しない。開発者直 push との整合は V-5)
- autopilot-combomgr の設計判断「真の担保はサーバ側、settings.json の deny は defense-in-depth に過ぎない」(同リポジトリ settings.json コメント)の移植

#### 第1層: `claude/` 名前空間限定の push 許可(web 併用の成立条件)

- 現行 settings.json の `git push` 全面 deny を、「**`claude/` 名前空間への push のみ許可、それ以外は deny 維持**」へ改定する(allow/deny のプレフィックス表現と deny 優先順位の実機挙動は V-2 で検証。素直に表現できない場合は「web 専用の設定分離が可能か」も同検証で確認)
- この改定は devContainer 側にも及ぶが、統制目的は保たれる: `claude/` は正史ではない作業領域であり(§1.2 条件4)、main は第0層で保護済み、push 内容は PR として全件人間レビューを通る
- CLAUDE.md §10 の「ルール本文と目的に乖離が生じた場合は Plan Mode で開発者確認」の手続きに則り、**改定自体を開発者承認事項**とする。CLAUDE.md §7/§10 への追記は1〜2行(「例外の詳細は docs/process/remote-ops.md」形式)に留める

#### devContainer 向け sync push ラッパー(v1.0 の Step 5)

- **原則見送りへ格下げ**。web 主軸化により「外出先からの成果還流」は claude/ ブランチ経由で成立するため、devContainer からの遠隔 push 需要はほぼ消失する。Remote Control 補助(§4.5)を常用することになった場合にのみ再検討

### 4.5 Remote Control 補助運用(仮説1・縮小採用)

PC を稼働させたまま外出しない方針のため主軸にはしないが、以下の限定用途で価値が残る:

- **在宅内モバイル操作**: 別室・就寝前などに devContainer セッションの承認プロンプト・Plan 承認へスマホから応答(B-1/B-4 の在宅緩和)
- **例外的に PC を残す日**: 長時間タスク(キット生成等)を仕込んで短時間外出する場合の見守り

仕様の要点(2026-07 時点): `claude remote-control` / `/rc` で接続、権限モードは Manual / Accept edits / Plan のみ(**Bypass 不可**=統制不変)、outbound 443 のみ、ローカルプロセス必須(約10分超オフラインで終了、`claude --continue` で再開)、スマホから承認・Plan 承認・添付(v2.1.202+)・push 通知が可能。

導入する場合の前提整備(Step 5・任意): devContainer firewall の接続先ドメイン実地特定→ `init-firewall.sh` 追加→再適用、CLI バージョン確認、tmux(補助・公式保証なし)の挙動検証(V-6)。

### 4.6 破綻箇所対策 + 文書整合是正(仮説3)

#### 破綻5箇所の対策

| # | 対策 |
|---|------|
| B-1 | 構造対策は「Plan 承認必至のタスクを遠隔で回さない」こと。web 主軸化により外出中の devContainer セッション自体を持たない運用が基本(最良の緩和)。RC 補助時は三層緩和: ①push 通知 ON ②承認密度の低いタスク限定 ③「重要未決なら保留」規律の remote-ops.md 転記 |
| B-2 | next_milestone_kit / next_phase_kit に resume_milestone_kit と同方式の frontmatter allowed-tools whitelist を追加し非対称を解消(D-2 の是正と同時)。在宅運用の平時改善としても有効 |
| B-3 | 既存の tmp/ephemeral-*.md 退避運用を維持しつつ、長大キット生成は在宅・即応可能な時間帯に実施(遠隔で仕込まない) |
| B-4 | cleanup_docs の引数曖昧時挙動を「AskUserQuestion で対話」から「中断+明示引数の要求」へ変更(在宅運用でも放置事故を防ぐ純改善) |
| B-5 | remote-ops.md に「worktree 新設時は settings.json+hooks の両方がコミット済みであることを確認」を明記(_wt 系コマンドの冒頭ガードへの追加は任意) |

#### 文書整合の是正(D-1〜D-4)

| # | 是正 |
|---|------|
| D-1 | settings.json `_hooks_comment` と custom-commands.md に notify-bell(Stop/Notification)の記載を追加(挙動変更なし) |
| D-2 | B-2 の whitelist 追加により記述と実態を一致させる。「実行してよい」の文面は「frontmatter で許可済み」に改める |
| D-3 | §4.3 の `/completion_digest` 新設で導線を実体化。custom-commands.md にも「完了報告本文は製造担当の手動作成、ダイジェストのみ自動」と明記 |
| D-4 | milestone-startup-guide.md の「repo外・開発者手交」表記を「human-notes/ にコミット済み・Web版へは直読(または手動投入)」に改訂 |

### 4.7 CLAUDE.md のコンテキスト消費を増やさない工夫

- **基本方針: CLAUDE.md には原則1行も足さない**。運用正本は新設 `docs/process/remote-ops.md` に置く(web 併用手順・チェックリスト・RC 補助手順・web 実行用注意書きを集約)
- 参照導線は2系統: ①docs-map(`scripts/generate-docs-map.sh` の再生成で自動掲載される生成物) ②軽量カスタムコマンド `/remote_ops`(出発前チェックリスト表示+remote-ops.md のオンデマンド読込のみの数行コマンド)
- 唯一の例外は §4.4 第1層(claude/ 限定 push 許可)導入時の CLAUDE.md §7/§10 への1〜2行追記
- **web VM 用の注意書き(フレッシュ VM 前提、環境セットアップ、E2E 前マージ禁止等)も remote-ops.md 側に隔離**(autopilot の `docs/handoff-web-session.md` 方式)。devContainer の通常セッションが読み込む常駐コンテキストは現状から増えない

---

## 5. 品質統制への影響評価

| 提案 | Plan Mode | 指示書駆動 | 人間レビュー | 正史反映=人間 | 手動E2E |
|------|-----------|-----------|-------------|---------------|---------|
| 4.1 web 併用(主軸) | 計画提示→応答待ちの対話で維持(V-3 検証)。導入自体も承認事項 | 不変(指示書はコミット済みで VM から直読) | **PR 全件レビューで機械的に強化**(モバイル+帰宅後PC) | claude/ 隔離+branch protection+人間マージで維持 | **実装系はE2E通過までマージ禁止**をルール化(ゲート位置がマージ前に明確化) |
| 4.2 docs 集約+直読 | 不変 | 投入経路が変わるだけで内容統制は不変 | 不変 | 不変(鮮度はマージ/push 頻度に従属) | 不変 |
| 4.3 completion_digest | 不変 | 不変(源泉構造維持) | 派生の機械抽出であり判断を代替しない | 不変(commit まで) | 不変 |
| 4.4 push 落としどころ | 第1層の改定自体が Plan Mode 承認事項 | 不変 | branch protection+PR 必須で機械的に強化 | **正史 push は人間のみ(サーバ側担保)。claude/ は作業領域** | 不変 |
| 4.5 RC 補助 | 承認者が PC→スマホに変わるだけ。Bypass 不可 | 不変 | 不変 | 不変 | 不変 |
| 4.6 破綻対策+文書整合 | B-1 対策はタイムアウト空白を縮小(強化方向) | 不変 | 不変 | 不変 | 不変 |

統制に触れるのは 4.4 第1層(push 許可範囲の改定)のみであり、それも「無承認化」ではなく「行き先の名前空間隔離+サーバ側の機械的担保+PR 全件人間レビュー」への置き換えである。総体として統制は弱まらず、branch protection と PR レビューの分だけ強化される。

---

## 6. 変更対象ファイル一覧(概要レベル)

| Step | ファイル | 変更概要 |
|------|----------|----------|
| 1 | `docs/human-notes/custom-commands.md` | notify-bell 記載追加(D-1)、キット権限記述の是正(D-2)、完了報告の手動/自動区分明記(D-3) |
| 1 | `.claude/settings.json` | `_hooks_comment` への notify-bell 説明追記のみ(挙動変更なし) |
| 1 | `.claude/commands/next_milestone_kit.md`、`next_phase_kit.md` | frontmatter allowed-tools whitelist 追加(B-2/D-2) |
| 1 | `.claude/commands/cleanup_docs.md` | 引数曖昧時は中断+明示引数要求へ(B-4) |
| 1 | `docs/human-notes/milestone-startup-guide.md` | 「repo外・開発者手交」表記の是正(D-4) |
| 2 | (GitHub 設定・開発者作業) | main の branch protection 有効化(V-5 の整合判断込み) |
| 2 | キット生成コマンド(変換規則) | 「添付ファイル一覧」→「直読対象パス一覧」への1項目追加 |
| 2 | `docs/handover/` 運用 | tmp 手交メモ・課題レポートの昇格先ルール追加。playbook §12 系の改訂は設計担当へ依頼(CHANGE 相当) |
| 3 | `docs/process/remote-ops.md` **(新設)** | 外出先運用の正本(web 併用手順・チェックリスト・web VM 注意書き・RC 補助手順) |
| 3 | `.claude/commands/remote_ops.md` **(新設)** | チェックリスト表示+手順書オンデマンド読込の軽量コマンド |
| 3 | `.claude/settings.json`、`CLAUDE.md` §7/§10 | push deny を claude/ 名前空間限定許可へ改定(V-2 検証後・Plan Mode 承認事項)+最小追記1〜2行 |
| 3 | (web 環境設定・要 V-1) | メインリポジトリ用の web VM 環境セットアップ(Go/pnpm/依存/ネットワーク許可) |
| 4 | `.claude/commands/design_handover_report.md` **(実装済み 2026-07-20)**+`docs/human-notes/custom-commands.md`(カタログ追記済み) | 課題レポート既運用の正式化。当面は tmp/ 出力・手交。Step 2 採用時に docs 出力+commit へ切替(その際 check_derived_docs 登録) |
| 5(任意) | `.devcontainer/init-firewall.sh` ほか | Remote Control 補助導入(必要ドメイン追加・remote-ops.md へ手順追記) |

---

## 7. 導入順序(リスク低→高。各 Step は独立して価値があり、任意の Step で停止可能)

1. **Step 1: 文書整合+権限非対称の是正** — 外出先運用と無関係にも価値がある純改善。挙動変更は B-2/B-4 のみで局所的
2. **Step 2: branch protection+Web版 GitHub 直読切替+docs 集約** — サーバ側担保を先に敷く(リスクゼロ)。手動アップロード廃止と tmp 品の昇格で「repo→Web版」方向が PC 不要化
3. **Step 3: Claude Code on the web 併用導入(主軸)** — V-1〜V-3 の検証→settings の claude/ 限定 push 整合(Plan Mode 承認)→remote-ops.md 整備→**調査・docs 系タスクから試行**→実績を見て実装系へ拡大(E2E 前マージ禁止ルール適用)
4. **Step 4: completion_digest 新設** — 課題レポート既運用の正式化。「repo→Web版」の最後の手作業を自動化
5. ~~Step 5(任意): Remote Control 補助導入~~ — **恒久見送り(2026-07-20 開発者決定)**。§4.5・V-6 は将来再検討時の記録として残置

(v1.0 の「sync push ラッパー」Step は原則見送りへ変更。§4.4 参照)

---

## 8. 外出先運用の1日の流れ(v1.1: PC 電源 OFF 前提)

### 出発前(PC、5分。`/remote_ops` でチェックリスト表示)

- [ ] 進行中の devContainer セッションをキリの良い所で終了(遠隔で見守れないため中途タスクを残さない)
- [ ] `git status` クリーン確認 → 開発者 push(Web版直読と web セッションの出発点の鮮度確保)
- [ ] 未マージの claude/ ブランチ・未処理 PR の棚卸し(外出中に触るものを決めておく)
- [ ] PC は通常どおり電源 OFF/スリープでよい

### 外出中(スマホのみ)

- **設計**: Web版で設計・指示書作成(GitHub 直読。鮮度=最終 push/マージ時点と認識して作業)
- **製造(軽量)**: Claude Code on the web セッションを開始し、調査・docs 整備・(環境検証後は)独立性の高い実装を指示。計画提示への応答・追送指示もスマホから
- **還流**: Web版成果物(指示書等)をコピー→web セッションへ投入→配置+commit+push(claude/)
- **レビュー**: GitHub モバイルアプリで PR 差分確認。docs 系はモバイルマージ可。**実装系はマージせず帰宅後へ**
- 判断に迷う未決は「保留」を指示(規律は remote-ops.md に明記)

### 帰宅後(PC)

- claude/ ブランチ・PR を PC でレビュー(`git log`/`git diff`。人間レビュー統制はここで最終担保)
- 実装系 PR: 開発者がローカルで checkout →**手動E2E(品質ゲート、従来どおり)**→ 合格後にマージ
- Web版で作った指示書が正史化されていれば、夜の devContainer セッションでそのまま着工可能
- tmp/ の整理、翌日の仕込み

---

## 9. 未解決事項・検証タスク

| # | 項目 | 検証方法 |
|---|------|----------|
| V-1 | **web VM の環境再現性**: Go 1.26.x・pnpm 9.13・依存取得・ネットワーク許可のセットアップで `go test ./...` / `pnpm test` が通るか(第2段階=実装タスク解禁の条件) | メインリポジトリ用の環境設定を作成し web セッションで実地確認 |
| V-2 | **settings.json push deny と web push 動線の整合**: claude/ 限定許可の allow/deny プレフィックス表現・deny 優先順位の実機挙動。素直に表現できない場合の設定分離可否 | テストブランチ+使い捨てコミットで実機検証 |
| V-3 | **web セッションの対話品質**: 計画提示→応答待ちの挙動(Plan Mode 相当が成立するか)、スマホからのファイル添付可否、セッション開始〜完走の操作感 | 調査系タスクで実地試行(Step 3 第1段階を兼ねる) |
| V-4 | **Web版 GitHub コネクタの読取対象**: ブランチ指定可否(claude/ ブランチを読めるか)・private repo・鮮度 | Web版チャットで実地確認 |
| V-5 | **branch protection と開発者直 push の整合**: 開発者のみ bypass 可の設定 or PR 運用への移行 | 開発者判断 |
| V-6 | (Step 5 採用時のみ)Remote Control の必要ドメイン実地特定・CLI バージョン・tmux 挙動 | devContainer 内で `/rc` 実行→firewall ログ確認→init-firewall.sh 追加→再適用。`claude --version` 確認。tmux detach/再接続の実地テスト |

### サブプロジェクト(autopilot-combomgr)への言及(参考・スコープ外)

v1.1 の主軸転換により、メイン側は autopilot-combomgr の統制モデル(claude/ ブランチ限定 push・サーバ側担保・人間マージ・web 専用注意書きのコミット済み別ファイル化)をほぼそのまま移植する構図になった。サブ側で実証済みの運用知見(LESSONS.md、handoff-web-session.md 方式)は Step 3 の remote-ops.md 設計時に参照する。サブ側 individual な改善は本書のスコープ外とする。

---

*以上*
