# カスタムコマンド一覧

実装調査担当CLI: RESEARCH 指示書を読み、技術スタックを前提として read-only 厳守 + 事実列挙のみで調査し、docs/instructions/ に結果レポートを作成（実装前の調査工程）。指示書に不足する観点を補足。引数で「指示書 + モード（auto/plan）+ 自由入力指示」を指定可。**`RESEARCH` は省略可**（`M19-01` = `M19-RESEARCH-01`）。番号が重複する場合はどちらを調査するか質問する。docs/progress/ に成果物があれば実施済みとして警告
`/research_plan M19-01 [auto|plan] [自由入力指示 （任意）]`

製造担当CLI（プランモード起動後）: 指示書を読み、計画提示 → 承認後に実装。**引数は接頭語可**（`M20-01` → `M20-01-initial-presets-three.md`）。docs/progress/ に成果物があれば実施済みとして警告。**★本コマンドはレビュー工程を持たないため、完了報告の「レビュー結果を参照する欄」と `progress-log` 索引行の「レビュー」欄はプレースホルダを置き、`/incorporate_plan` で埋める**（`D-510`。**存在しないレビュー報告書へリンクを張らない**）
`/implement_plan M20-01`

レビュー担当CLI: 実装済みコードをレビューし、docs/progress/ に結果ファイルを作成。**引数は接頭語可**。同じサブのレビュー報告書が既にあれば再レビューとして警告
`/review_plan M20-01`

製造担当CLI（レビュー後に継続）: レビュー結果を評価し、修正計画提示 → 承認後に修正実装。**★取り込み完了時に、完了報告のレビュー参照欄（指摘件数・採否・「高」不採用の件数・レビュー報告書へのリンク・往復回数）と、`progress-log` 索引行の「レビュー」欄を実測で埋める**（`D-510`。**索引行は「追記のみ」の例外として書き換える**）。**引数は接頭語可**
`/incorporate_plan M20-01`

製造担当CLI（一気通貫・自動）: （プランモード起動後）指示書を読み 計画提示→承認後に実装 → fresh subagent で自動レビュー（docs/progress/ に報告書生成）→ レビュー指摘を自動トリアージして取り込み。レビュアー独立性のため fork は使わない。取り込み判断は自動だが「高」指摘の不採用のみ開発者確認。採否理由は報告書末尾に追記して事後監査可能にする。**★完了報告のうちレビュー結果を参照する欄は Phase C の後に埋める**（`D-510`。Phase A/B の時点ではプレースホルダを置く）。従来の implement/review/incorporate_plan は手動ゲート版として併存。**引数は接頭語可**（`M20-01` → `M20-01-initial-presets-three.md`）。候補が複数なら番号付きで選択、docs/progress/ に成果物があれば実施済みとして警告
`/implement_plan_full M20-01`

進捗サマリ更新担当CLI（プランモード起動後）: progress-log.md から指定マイルストーンを抽出・要約し、progress-summary.md に新節として追記（マイルストーン完了時に実行）
`/update_progress_summary [M{N+1} 指定 または 追加指示 （任意）]`

起動キット生成担当CLI（プランモード起動後）: 最新の m{N}-startup-kit.md を基に M{N+1} 用の新キットを生成（マイルストーン完了時に実行）。派生資料再生成スクリプト（code-facts/docs-map/template-zip）は frontmatter allowed-tools で許可済み＝承認プロンプトなしで実行される
`/next_milestone_kit [M{N+1} 指定 または 追加指示 （任意）]`

フェーズ起動キット生成担当CLI（プランモード起動後）: 指定したフェーズキックオフ handover を一次資料に、phase{N}-kickoff-startup-kit.md を生成（新フェーズ着手時に実行。最初の仕事はマイルストーン分割策定）。派生資料再生成スクリプトは frontmatter allowed-tools で許可済み＝承認プロンプトなしで実行される
`/next_phase_kit docs/handover/phase{N}-kickoff-handover.md [追加指示 （任意）]`

ドキュメント整理担当CLI（プランモード起動後）: 重複削除・役割別の参照分離・継続更新ファイル化の整理を行い、レポートを docs/progress/ に出力（任意のタイミングで実行）
`/cleanup_docs [追加指示 （任意）]`

code-facts 再生成担当CLI: `scripts/generate-code-facts.sh` を実行し、設計担当（Web版Claude）向けの機械的事実資料 `docs/handover/code-facts.md`（Reactコンポーネント Props／queryKey〔用途別: 定義/invalidate〕／ルート／Goハンドラ／config構造体／バックエンドResponse構造体／共通ナビリンク）を最新化し、`git diff` を表示（コミットはしない）。コードを変更したマイルストーン完了時に実行し、設計工程前に最新化しておく。引数は不要。コマンドを通さずに`scripts/generate-code-facts.sh`は開発者が直接実行しても良い。これはシェルをClaudeに実行させたい時のためのコマンド
`/regen_code_facts`

docs-map 再生成担当CLI: `scripts/generate-docs-map.sh` を実行し、設計担当（Web版Claude、ファイル構成を直接見られない）向けの **文書ID ⇄ 実パス・役割マップ** `docs/handover/docs-map.md`（§1=`DES-002` 等の文書ID→実パス逆引き表〔全ID網羅〕／§2=docs 配下のディレクトリ別役割マップ〔design・handover はファイル単位、change-notes・instructions・progress 等はフォルダ役割、archive/phase1 は件数のみ〕）を最新化し、`git diff` を表示（コミットはしない）。Web版が指示書で文書ID 参照した資料の実パスを解決し、実装担当の無駄な探索・「読まずに着手」による品質低下を防ぐ。ドキュメントを追加・改訂したマイルストーン完了時に実行。引数は不要。コマンドを通さずに`scripts/generate-docs-map.sh`は開発者が直接実行しても良い。これはシェルをClaudeに実行させたい時のためのコマンド
`/regen_docs_map`

プロンプト整形担当CLI: 粗い草案を引数で受け取り、本プロジェクトの「家風」（専門家ロール宣言／背景→目的／禁止事項を先頭に置く制約節／素直な手順／プランモードゲート／出力先パス明示／断定回避と「要相談」エスカレーション／禁則表現の言い換え）に沿った高品質プロンプトへ整形し、コードブロックで提示する（コピーして Web 版や別セッションに貼る用途）。草案にロール・目的・出力先・スコープ等の不足があれば、整形前に確認質問を出す。家風はコマンド本文に直接埋め込んであり実行時に playbook を読まないため、家風が変わったらコマンドファイル自体を改訂して同期する。ファイルは変更せず整形結果の提示のみ
`/prompt-refine [整形したい草案（箇条書き・走り書き可）]`

自動化手段の設計担当CLI（メタコマンド）: 「やりたいこと」を引数で受け取り、それを **シェル / カスタムコマンド / フック**(または組合せ)のどれで実現すべきかをルーブリックで判定する。第一原則は「Claude のコンテキスト・トークンを消費しない手段(シェル/フック)を常に第一候補とし、判断が不要な作業をコマンド化しない」こと。判定フロー＝(1)判断・文章生成・コード理解が不要で入出力固定→シェル、(2)モデルが忘れても毎回強制すべき→フック、(3)判断主体→コマンド、(2.5)判断入力を機械抽出できる→シェル抽出+コマンド判断の組合せ。実行すると、まず `.claude/commands/` と `scripts/` を重複スキャンし、既存と重複/部分重複があれば新規作成ではなく既存の改修・統合を提案。重複が無ければ判定理由を明示し、成果物の全文（コマンドなら frontmatter 込み、シェルなら全文、フックなら settings.json 追加 JSON）を提示する。**承認後に作成**し、フック・settings.json は提示のみで自動適用しない（git 操作もしない）。新しい自動化を追加したくなったら、いきなり作る前にまずこれに相談する用途
`/create_command [作りたいことの説明]`

外部AI調査プロンプト生成CLI: 引数の質問を、Perplexity / Microsoft Copilot のどちらに貼っても成立する「最新情報取得用プロンプト」1本に整形して提示する。Claude では不十分なケース（＝最新情報・ドメイン知識の外部確認）向け。生成プロンプトは冒頭にシニア専門家ロール宣言／低性能・無料モデル前提の簡潔・構造化／出典URLと日付の要求／不明は「不明」と明記（推測禁止）／日本語回答、を備える。プロジェクト外部の一般情報用途のためファイルは読まず、固有ファイル名・機密は載せない。質問が曖昧なら1点だけ確認してから生成
`/ask_external_ai [質問・調べたいこと]`

devContainer リビルド前サプライチェーン調査プロンプト生成CLI: `scripts/devcontainer-supplychain-prompt.sh` を実行し、`.devcontainer/Dockerfile` から依存（ベースイメージ／Go・pnpm・gopls・dlv・golangci-lint の各バージョン／グローバル npm パッケージ）を機械抽出し、当日日付を添えて Perplexity / Copilot 等にそのまま貼れるサプライチェーン調査プロンプトを生成する。whitelist 抽出のみで固有ファイル名や機密は出力しない。リビルド前に最新のサプライチェーン攻撃・重大脆弱性の有無を確認する用途。コマンドを通さず `! bash scripts/devcontainer-supplychain-prompt.sh` の直接実行も可
`/devcontainer_rebuild_check`

アプリビルド前サプライチェーン安全確認CLI: `scripts/app-build-supplychain-check.sh` を実行し、アプリ自身の依存を機械的に検査する。Go 依存の整合性（`go mod verify`＝改ざん/破損検知、オフライン）とフロント依存の既知CVE（`pnpm audit`、深刻度内訳を集計）を検査し、SAFE / CAUTION / WAIT の総合判定と終了コード（WAIT=2）を返す。AI不要・トークン消費なしの決定論的チェックで、devContainer 用の速報的調査（`/devcontainer_rebuild_check`＝AIプロンプト版）と対をなし、こちらは「既知CVE＋整合性」を担当する。閾値は `APP_CHECK_FAIL_LEVEL`（critical|high|moderate、既定 high）、Go の CVE 検査（govulncheck）は `APP_CHECK_GO_VULN=1`（要 vuln.go.dev の FW 許可）で有効化。コマンドを通さず `! bash scripts/app-build-supplychain-check.sh` の直接実行も可
`/app_build_check`

E2E シナリオ spec 追加担当CLI（初版・要検証）: フィーチャー名またはフロー概要を引数で受け取り、対象コンポーネントを読み取ってセレクタを調査 → spec 設計案を提示 → 承認後に `web/e2e/{filename}.spec.ts` を生成し `docs/design/testid-convention.md` を更新する。`combo-crud.spec.ts` のパターン（自前データ作成・削除、`Date.now()` 一意識別子）を踏襲。⚠️ 生成 spec は必ず `make e2e` で実行・検証してください
`/add_e2e_spec タグ作成・編集・削除`

カスタムコマンド・カタログ同期担当CLI: `.claude/commands/` を走査し、custom-commands.md（端末エイリアス `cmds` の元データ）への掲載漏れを家風の体裁で追記し、実体ファイルが消えた掲載を警告する。既存の手書きエントリは原則保持、書き込み前に差分提示・承認。custom-commands.md 以外は編集しない
`/sync_command_catalog [追加指示（任意）]`

retrospective-digest 更新担当CLI: `retrospective-log.md`(全期間アーカイブ＝源泉)から現役教訓を S/T/H/D で再分類して再蒸留し、設計担当が指示書執筆時に毎回読む蒸留版 `docs/handover/retrospective-digest.md`(編集対象はこの1ファイルのみ)を現在の機構化状況に合わせて最新化する。機構化済み教訓は本文から「機構化済み一覧」へ集約(目標150行以内)。retrospective-log 本体・playbook の改訂は「提案」として出力するだけで適用しない。Git 操作はしない。引数は空(全体再蒸留)/マイルストーン指定(M8 等)/補足指示を取れる
`/retrospective-digest-update [M{N} 指定 または 追加指示（任意）]`

バリデーション網羅監査担当CLI: `scripts/audit-validation-coverage.sh` を実行し、DES-006 の VAL コード（50種）× Go実装/Goテスト/FE/E2E の言及マトリクスと、service 層経路別（Create/PATCH/PUT）の validation.* 呼出一覧を機械生成する（read-only・stdout のみ・AI不要）。実装欠落・テストの穴の候補を「疑い」として提示し、修正はしない。改善レーン第一弾の B1（PATCH で VAL-C04/C05/C13 素通り）型のバグを設計段階で検出する用途。バリデーション変更後・指示書作成前に実行。コマンドを通さず `! bash scripts/audit-validation-coverage.sh` の直接実行も可
`/audit_validation_coverage`

リソース枯渇監査担当CLI: `scripts/audit-resource-scan.sh` で観点A〜E（ディスク膨張/リーク/ゲーム同時起動時の資源競合/エラー握りつぶし/静的解析）の機械チェック＋PRAGMA 実証テストを一括実行し、`docs/audits/resource-exhaustion-audit-runbook.md`（正本）§3 のベースライン表と突合。乖離箇所と差分ファイルだけを精読・判定して差分レポート（`docs/audits/YYYYMMDD-…-delta.md`）を生成、ベースライン表を更新し commit まで実施（push はリモートの claude/ ブランチ実行時のみ）。調査のみでアプリコードは変更しない。初回フル監査（20260804）と同じ物差しを機能追加の節目で回す用途。スクリプト単体の直接実行も可（`! bash scripts/audit-resource-scan.sh [<基点コミット>]`）
`/audit_resource_delta [比較基点コミット（省略時は前回レポートから自動特定）]`

派生資料鮮度監査担当CLI: `scripts/check-derived-docs.sh` を実行し、派生4資料（code-facts / docs-map / retrospective-digest / custom-commands）について「源泉の最終コミット > 派生物の最終コミット」を機械判定し、陳腐化疑いと再生成手段（/regen_code_facts 等）を提示する（read-only・stdout のみ・AI不要）。再生成そのものは指示がない限り実行しない。CLAUDE.md 陳腐化・followup-backlog 番号未同期の根因だった「鮮度監視層の欠如」への対策。マイルストーン完了時・設計工程前に実行。コマンドを通さず `! bash scripts/check-derived-docs.sh` の直接実行も可
`/check_derived_docs`

seed データ投入前チェック担当CLI: 手入力 seed CSV（character_data/*.csv）を公式 dist（combomgr-importer/dist/*.csv）と突合し、投入前の入力ミス・command 未割当・意図的差分の弁別を AI がチェック。まずレポート（tmp/YYYYMMDD-…-report.md）のみ作成し承認後に確信度「高」の command 補完＋機械的整形（SA/CA接頭辞・typo修正・condition掃き取り）を適用、判断不能分は一件ずつ確認。`character_data/seed-progress.md`（character_code / precheck / seed_imported の3列）で進捗管理し、未処理キャラ（.csv）を自動対象にする（引数でキャラ名を明示すると済キャラも再チェック可）。既配布（seed_imported=済）キャラを対象に含む場合は警告停止。公式の生値は git 管理ファイルへ転記しない
`/precheck_seed_data [キャラ名 ... （省略で未処理 .csv を自動対象）] [追加指示（任意）]`

設計伝達レポート（例外レポート）生成担当CLI: 実装完了後、完了報告（§1実査/§3推測/§5DES反映/§6申し送り）・レビュー報告・関連CHANGE・セッション知識を源泉に、**親チャット（設計卓）**へ渡す差分レポートを生成する。構成は **§1 製造が独自に確定した実装仕様 / §2 契約・設計に反する独自判断（★独立カテゴリ・最優先＝親は受理して DES・契約を更新するか却下して差し戻すかの二択、未処理で流さない）/ §3 製造の判断 / §4 残課題・申し送り / §5 不変証跡 / §6 CHANGE 起票たたき台 / §7 教訓（宛先は反映係＝親は読まなくてよい）**。指示書どおりの部分は書かない差分主義で、**該当が無い節は「なし」の一行で終える（埋めるために書かない）**。従来開発者が都度手動依頼し `tmp/` で手交していた design-handover レポートの正式化＋docs 昇格（2026-07-20）。出力先は**現在の作業ツリーの `docs/handover/design-reports/`**（コミット対象＝push+Sync 後に Web版が GitHub 直読可能。**OS の `/tmp` や repo の `tmp/` には置かない**）。ファイル名は **`YYYYMMDD-<id>-design-exceptions.md`**（2026-07-30 に `-design-handover.md` から改称。既存 8 本は改名せず新規分のみ）。完了報告が無ければ停止。生成後 `git add`+`git commit` まで実施し、**`claude/` 名前空間ブランチ上なら単一形 `git push origin claude/<branch>` で push まで行う**（2026-08-30 に「push はしない」を削除＝形骸化していたため。クラウド実行では開発者が端末に居らず、レポートは push して初めて Web 版から直読できる）。※完了報告（`docs/progress/m*-completion-report.md`）本文を生成するコマンドは存在せず製造担当の手動作成＝本コマンドが自動化するのは親チャット向けダイジェストのみ
`/design_handover_report M19-04 [補足指示（任意）]`

リモート運用導線CLI（軽量）: 外出先・夜間運用の出発前チェックリスト（devContainer セッション終了・push・Web版ナレッジ Sync now・claude/ ブランチ棚卸し）を表示する。引数 `full` または質問文で正本 `docs/process/remote-ops.md`（web 主軸の運用手順・E2E 前マージ禁止・push 多層防御・V 検証状況）をオンデマンド読込。常駐コンテキストを増やさないための導線で、表示・案内のみ（編集・Git 書込なし）
`/remote_ops [checklist | full | 質問]`

Memo_Someday 整理担当CLI（プランモード起動後）: 開発者が `docs/human-notes/Memo_Someday.txt` の末尾へ構造化・重複排除・組み込み先マイルストーンを考えず書き連ねた思いつきメモを、生きた資料（progress-summary=完了状況／phase{N}-overview=割付／followup-backlog=friend FB・繰越・新規論点）と突合し、各項目へ状態マーカー（`[済]`/`[一部]`/`[未]`/`[予定 M##]`/`[陳腐化]`/`[調査]`/`[不明]`）と根拠注記「／【YYYY-MM-DD …】」を付与して仕分ける。本文は逐語保持・配置は原則そのまま（誤バケットは移動せず注記）・重複は統合せず相互参照・実挙動未確認は断定せず「要確認」を残す。前回パス（冒頭の最新「【…追記】」日付）以降の書き足しを主対象に、Plan Mode で遷移表を提示→承認後に対象1ファイルのみ編集。編集対象は Memo_Someday.txt のみ（他は読み取り専用）
`/memo_someday_cleanup [節指定 または 方針補足 （任意）]`

人間向けドキュメント要約担当CLI: docs 配下の md/HTML（AI 向けに書かれていて人には読みにくい資料）を、指定した分析軸に沿って **ブラウザで開くだけで論点が閉じる単一 HTML** にまとめる。引数は自由入力で、フルパス／相対パス（リポジトリルート基準）／ファイル名のみ／文書ID（`DES-005`・`CHANGE-090`・`M18-03c` 等）を複数指定でき、末尾に分析軸の指示（「画面ごとの状態管理の観点で」等）を自然言語で添えられる。前処理は `scripts/collect-doc-refs.sh`（決定論・AI 不要）が担当し、docs-map §1 の逆引き→全 docs 索引の順で実パス解決／スコープ判定／**1 階層の参照抽出**／本文サイズ計測（HTML はタグ・CSS を除く。本文が `<script>` のデータ配列に入る `html-js` 型も検出）を行う。本プロジェクトの資料は**パス表記ゼロで文書IDだけ**で他資料を指すものが多く（例 `M18-close-report.md`）、この参照解決が本コマンドの核。**参照は膨らむ**ため予算上限つきで自動選抜し（既定 250KB・約8万トークン）、落とした参照は HTML 末尾に必ず列挙する（実測: 24KB の handover が参照 17 件 682KB、DES-005 が参照 139 件 2.68MB）。孫ファイルは既定で追わず重要そうなら質問、ひ孫は追わない。合計 200KB 未満はメインが直読、超えたら参照分だけサブエージェントへ委譲（本体は常に直読）。**フォルダ指定で分析軸なしの場合・曖昧すぎる言葉のみの場合は作業に入らず問い返す**。コード／データ（`.go`/`.ts`/`.sql`/`.csv` 等）はスコープ外として突き返す。出力先は `work_html/YYYYMMDD-<slug>.html`（gitignore 済の使い捨て領域）で、気に入ったものは開発者が手で `docs/human-notes/html-reports/` へ移す運用。生成 HTML は自己完結・単一ファイル・外部リソース参照なし（オフライン可）・light/dark 両対応。原本は一切編集せず Git 操作もしない
`/docs_to_html [ファイルパス/ファイル名/文書ID ...] [分析軸・追加指示（任意）]`

---

## 品質フック（自動発火・全コマンド共通）

`.claude/settings.json` に登録した品質フックが、コマンドの種類によらず全応答で自動発火する（非ブロック・実体は `.claude/hooks/*.sh`）。

- **PreToolUse（Bash 実行前・2026-07-20 追加）**: `pre-push-guard.sh` が `git push` を含むコマンドを実行前に検査し、「`git push origin claude/<ブランチ>`」の単一形以外（main・refspec 形 `HEAD:xxx`・フラグ・複合コマンド）を**ブロックする**（唯一のブロック型フック）。settings の allow/deny はプレフィックス一致のため refspec 形が漏れること、Claude Code on the web では都度確認（ask）が実質機能しないことへの機械的対策。コミット経由でクラウドにも配布・発火する。
- **PostToolUse（ファイル編集直後）**: 編集ファイルだけを高速チェック。`.go` → `gofmt -l` + `go vet`、`.ts`/`.tsx` → `tsc --noEmit`（プロジェクト全体型チェック）。指摘は通知のみで編集は止めない。
- **Stop（応答完了時）**: 作業ツリーの差分（`git diff`/`git ls-files`、read-only）を見て、`*.go` または `migrations/*.sql` 変更があれば `make test-go`（dbtest が全マイグレを適用するため go テストがマイグレの回帰テストを兼ねる）、`web/` の `.ts`/`.tsx` 変更があれば `make test-web` を実行。失敗は警告のみで応答は止めない。
- **Stop 第2ブロック + Notification（通知ベル）**: `notify-bell.sh` が応答完了時および承認待ち等の Notification 発生時に端末ベルを鳴らす（非ブロック・タイムアウト5秒・ファイル変更なし）。離席中でも応答完了・承認待ちに気づけるようにする補助フック。

留意点:
- `.md` 編集・plan モード中の編集・`/regen_code_facts` のような Bash スクリプト経由の生成は対象外（発火しない）。
- Stop は「その応答での変更」ではなく作業ツリー全体の差分を見るため、doc 専任コマンドでも未コミットのコード変更が残っていればテストが走る。逆にコミット済みのコードはゲートを通らずスキップされる。
- **worktree 利用時の前提**: フックが動くのは `.claude/settings.json`（hooks ブロック）と `.claude/hooks/*.sh` を**両方コミット**したブランチのみ。片方だけだとフックが動かない／エラーになる。

---

## git worktree 並列作業用（`*_wt`）

worktree 内で起動した Claude 専用の並列版。実行前に必ず `pwd` を確認し、`wt-<name>` 配下（パスに `/wt-` セグメントを含む）でなければ中断する（プロジェクトルート誤編集の防止）。中身は対応する通常版コマンドを worktree 制約下で実行するだけ（引数・操作感は通常版と同一）。`scripts/wt-new.sh` で worktree を作成し、その中で Claude を起動して使う。詳細は [`worktree-scripts-guide.md`](worktree-scripts-guide.md)。

実装調査担当CLI（worktree版）
`/research_plan_wt M7-RESEARCH-04 [auto|plan] [自由入力指示 （任意）]`

製造担当CLI（worktree版、プランモード起動後）
`/implement_plan_wt M1-03-combo-crud-api.md`

製造担当CLI（一気通貫・自動／worktree版）: 実装→自動レビュー→自動取り込みを worktree 制約下で実行（コミットはせず開発者へ委譲）
`/implement_plan_full_wt M1-03-combo-crud-api.md`

レビュー担当CLI（worktree版）
`/review_plan_wt M1-03-combo-crud-api.md`

製造担当CLI（worktree版、レビュー後に継続）
`/incorporate_plan_wt M1-03-combo-crud-api.md`

---

## `old/` 退避（現役ではない）

`.claude/commands/old/` に置いてあるコマンド。**現役の運用手順ではないが、消していない**ものを集める。
**★置く条件は 2 つ**: (1) 現役の運用手順ではない (2) それでも消さない理由がある（他プロジェクトへの流用・経緯の保存）。
**2 つを満たさないものを入れないこと**——「あとで見る」置き場にすると滞留する。
**★フォルダへ入れても無効化されない**（名前空間になるだけ）。本当に止めたいなら拡張子を変えるか `.claude/commands/` の外へ出す。

【`old/` 退避・現役ではない】マイルストーン内 途中再開キット生成担当CLI（プランモード起動後）: 大きなマイルストーンが途中で分割された際（M17-02 まで実施→M17-03 から再開、等）、base kit `m{N}-startup-kit.md` §2 を変換再生成し、Web設計セッションが執筆済みの design-session-handover（現在状態の正本＝入力・著述しない）を土台に現況・読む順序・タスク・現行版を書き換えた「**単独で成立する投入プロンプト1本**」を resume kit `m{N}-{NN}-resume-startup-kit.md`（§2）として生成する（置換型＝base §2 は投入せず本§2がその代替。2本貼り・PASTED増を回避）。handover は引数優先＋glob候補提示で特定、未作成なら停止。派生資料は軽量リフレッシュ（code-facts／docs-map 再生成＋retrospective-digest 再蒸留、progress-summary は鮮度報告のみ）。`next_milestone_kit`＝マイルストーン境界／`next_phase_kit`＝フェーズ境界に対し、本コマンドはマイルストーン内のセッション分割を担う。**★2026-09-02 に `.claude/commands/old/` へ移した**（`D-682`）。**面の移行（親が Web 版 → Claude Code）で存在理由の核が消えたが、本リポジトリをベースに Web 版を親に据える別プロジェクトを起こすときに要る可能性があるため消さずに残してある。****★サブディレクトリは Claude Code の名前空間になるため、移動は無効化ではなく改名である**——起動名が変わっただけで、実行はできる
`/old:resume_milestone_kit [再開点 例 M17-03][ handover パス（任意）][ 補足指示（任意）]`

---

## 補助ツール（スラッシュコマンドではなく端末エイリアス）

コマンド一覧ビューア: 本ファイル(custom-commands.md)を読み、各コマンドを「ラベル + 起動行」に要約して less でスクロール表示する。q で閉じると端末は元に戻り CLI を汚さない。実体は `scripts/list-commands.sh`、エイリアス `cmds` で呼ぶ（即時有効化は ~/.zshrc / ~/.bashrc へ追記、リビルド永続化は Dockerfile へ追記）。スラッシュコマンドではないが利便のため変則的に本一覧へ掲載
`cmds`

---

## Codex 設定同期(`/sync_codex_config`)

Claude 側の正本(CLAUDE.md / .claude/settings.json / .claude/commands / .claude/hooks)の変更を、`human-notes/codex/README.md` の同期ルールに従って Codex 派生物(AGENTS.md / .codex/rules / .codex/hooks.json / 製造 Skill)へ反映する。二重管理しているのは deny 方針・hook 登録・製造ワークフロー一覧・CLAUDE.md 共通方針の4点のみで、本文・フック実装は参照共有のため同期しない。`--check` で dry-run 検出のみ、`from-codex` は Claude 正本を編集せず「取り込むべきか」の提案レポートを出す(報告のみ)。
`/sync_codex_config [to-codex | from-codex] [--check]`
