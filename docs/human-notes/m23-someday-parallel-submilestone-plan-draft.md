# M23 Someday 未完項目・並列サブマイルストーン一次案

> 状態: **M23 着手前の未承認ドラフト**
> 想定読者: M23 の設計を担当する Claude / 開発者
> 作成日: 2026-08-13
> 独立レビュー: 2026-08-13 の履歴分離サブエージェント review 7 findings を反映済み
> 配置理由: 正式設計資料ではないため `tmp/` に置く。承認前に `docs/` へ転記しない。
> Git: コミットしない。

## メモ
M23-overviewの作成に使う。
正式ファイルが出来たらこのファイルは削除する。
なおMemo_Someday.txtにはこのファイルを作った後にも追加があったので、そちらは再チェックする事。
作業はなるべく並列で進めたい。

## 0. 結論

M23 は、`Memo_Someday.txt` の未完行をそのまま 131 個の実装タスクにせず、次の形で扱うのが安全である。

1. 最初に `M23-RESEARCH-01` で、全未完行を現行実装・M20/M21 完了結果と突合して重複排除する。同時に、Memo とは別母集団である正式 M23 active item も全件 ledger 化する。
2. M23 の実装候補は、衝突面ごとの 9 パッケージにまとめる。
3. M20 が所有中の `preset_aliases` / `recipe_cache` / import 補助、および M21 が所有中の controller/input 契約には、完了引継ぎ前に触れない。M21 の PoC は閾値や focus owner を確定していないため、PoC report だけを handoff とみなさない。
4. M22 実装中は原則として全 M23 実装レーンを停止する。M22 は全 API に触れる横断関心事であり、並行できるのは read-only 調査・文書準備、または非交差を個別立証して承認された例外だけである。
5. M23 内の実装は既定 2 レーン、開発者承認時のみ最大 3 レーンとし、同じ画面・共通 locale・共通 editor を触るパッケージは直列化する。repo 全体の同時レーン上限は M20/M21 を含めて別途承認する。
6. 「未完を片づける」は、全行を M23 で実装する意味ではなく、全行に検証済みの disposition（実装、調査、他マイルストーンへ返却、却下）を与える意味とする。新しいデータモデルや Phase 4 製品機能まで M23 に飲み込ませない。
7. M23 close は、(A) Memo 未完 131 行と、(B) `phase3-overview.md` / `followup-backlog.md` の正式 M23 active item の両 ledger が閉じた場合だけ成立する。

推奨する実装の大きな流れは次である。

```text
M23-RESEARCH-01 ── 開発者承認 / M23 契約確定
                       │
             ┌─────────┼─────────┐
             ▼         ▼         ▼
        01 → 02        03        04
        一覧系          比較系      Editor 安全性
             │         │         │
             ▼         ▼         ▼
             05        06        08（command icon 単独）
             Setup     I/O       command icon
              └────────┴────────┘
                       ▼
                  07 用語・i18n
                       ▼
                  09 運用・負債
                       ▼
                    M23-CLOSE
```

矢印は主な順序制約であり、後述の freeze 条件を満たせば別枝は並行できる。

## 1. この一次案の根拠と限界

### 1.1 参照した資料

- `CLAUDE.md`（共有ルールの正本）
- `docs/handover/docs-map.md`（依頼文の `doc-maps.md` は存在しないため、実在する文書マップを使用）
- `docs/human-notes/Memo_Someday.txt`
- `docs/instructions/phase3-overview.md`
- `docs/instructions/M20-overview.md`
- `docs/process/m21-contract.md`
- `docs/progress/M21-RESEARCH-01-report.md`
- `docs/progress/progress-summary.md`
- `docs/process/parallel-board.md`
- `docs/process/parallel-ops.html`
- `docs/handover/followup-backlog.md`
- `docs/handover/code-facts.md`
- `docs/handover/design-instruction-playbook.md`

### 1.2 前提

- M20 は承認済み 7 サブマイルストーンを実施中で、preset、alias、recipe cache、命名の一部を所有している。
- M21 は PoC report が存在する一方、状態の正本である `parallel-board.md` では overview 未発行・以降のサブ未編成である。PoC の成果は分布であり、判定窓、押下/解放、チャタリング対策、`pressed`/`value`、user gesture、focus owner は本実装契約で確定していない。本一次案では controller/input 面を M21 所有中として扱う。
- M22 は認証、version、同時編集安全性等の横断工程であり、`parallel-ops.html` により単独直列が推奨される。
- `phase3-overview.md` の M23 は暫定スコープである。サブマイルストーン番号、CHANGE 番号、migration 番号をこの資料だけで予約してはならない。
- 本資料は正式な overview / contract / design instruction ではない。M23 開始時に再検証し、開発者承認を得てから正式化する。

### 1.3 スナップショット上の件数

`Memo_Someday.txt` の状態接頭辞を機械的に数えた結果は次のとおり。

| 状態 | 行数 | この案での扱い |
|---|---:|---|
| `[未]` | 88 | 未完集合 |
| `[一部]` | 32 | 未完集合 |
| `[予定 M23]` | 7 | 未完集合 |
| `[予定 M20]` | 3 | 未完集合。ただし M20 へ返す |
| `[不明]` | 1 | 未完集合。先行調査 |
| **未完集合 合計** | **131** | 全行に disposition を付与 |
| `[調査]` | 8 | 実装要求とは別の調査入力 |
| `[済]` | 51 | 原則として回帰確認のみ |

複数行が同じ要求を表しているため、行数は実装タスク数ではない。たとえば default character、tag filter、setup link、controller 表示には重複記載がある。

この 131 行は M23 全スコープの母集団ではない。正式 M23 の E-1～E-3、D-2/D-3、G/H、F12-6、`command-icon-annotation` 等は §6.2 の第二 ledger でも追跡する。

## 2. M23 で先に確定すべき契約

M23 の正式計画を作る際は、サブマイルストーンより先に以下を contract に明記する。

| 契約面 | M23 開始時の扱い | 解凍条件 |
|---|---|---|
| preset ID / `preset_aliases` | M20 所有。M23 は変更禁止 | M20 完了報告と as-built handover |
| recipe text / `recipe_cache` | M20 所有。表示側は既存契約を読むだけ | M20-05～07 完了、再生成・逆引き契約確定 |
| import alias / command lookup | M20-07 所有 | M20-07 完了と回帰テスト合格 |
| controller event / input semantics | M21 所有。PoC は分布のみ | PoC 後の M21 overview/本実装契約、完了 report、as-built handoff。判定窓、押下/解放、チャタリング、`pressed`/`value`、user gesture を明記 |
| focus ownership | 未確定。M21 所有と仮定しない | M21 本実装契約と M23-04 editor state 契約の横断裁定 |
| default character | M23-01 所有候補 | M20 の default preset と設定キーを混同しない設計承認 |
| setup candidate/link API | 原則 read-only | E-1 が API 変更を必要とする場合のみ別 CHANGE 承認 |
| locale keys /表示用語 | M23-07 が最終統合 | M20/M21 の新語彙が確定してから一括整合 |
| shared editor state | M23-04 が一時単独所有 | 04 完了後に 05/08 へ handoff |

設計資料には `parallel-ops.html` の E-14 相当の横断表を置き、最低でも以下を列挙する。

- owner / touched area / read-only area
- migration 有無
- shared file の単独所有期間
- required predecessor と handoff artifact
- 同時実行を禁止する組合せ
- Plan Mode、実装、review、E2E の各実行主体

contract は `parallel-ops.html` の必須 6 項目、すなわち **スコープ、DES 所有権、予約レンジ、触る領域、凍結インターフェース、通信規約**をすべて埋める。どれかが空欄なら Wave 0 は未完である。

## 3. 提案するサブマイルストーン

以下の番号は説明用の仮称であり、承認前に正式発番しない。

### M23-RESEARCH-01 — Someday 全件再照合と scope contract

目的:

- 131 行を現行コード、M20/M21 完了差分、既存設計に照らして再分類する。
- Memo 外の正式 M23 active item を `phase3-overview.md` と `followup-backlog.md` から抽出し、第二の coverage ledger を作る。
- 重複、既に解消済み、再現不能、要追加仕様を分離する。
- 各行に一意な disposition と検証方法を付ける。

主対象: 全 131 行。一次案で再調査・分解扱いの L238, L315, L318 を含む。`[調査]` 8 行も補助入力にする。正式 M23 active item の最低集合は §6.2 とする。

成果物候補:

- 二系統の coverage ledger（Memo 行番号または active slug、要約、owner、実装先、受入条件、証拠、最終状態、defer 時の再開条件）
- M23 overview / contract の差分案
- 開発者判断が必要な decision packet
- M20/M21 からの引継ぎ確認表

並列性: M20/M21 実装中でも、文書・read-only 調査だけは先行可能。実装ファイルを変更しない。

### M23-01 — 一覧・ナビゲーション・default character

目的:

- My Combo の件数、sort、character 表示、作成後遷移を揃える。
- E-2 の default character 優先順位を一箇所で実装する。
- 新規 character 選択の不自然さを解消する。

主対象: L28, L38, L100, L105, L129, L170, L171, L305。

主な touched area: header/navigation、My Combo list、character 初期選択、設定読取。

gate:

- URL/session > configured default > Ryu の優先順位を正式承認する。
- default preset と default character の設定責務を分離する。

並列性: M23-03、M23-04、M23-06 と並行可能。ただし M23-02 とは list / character selector が重なるため `01 → 02` とする。

### M23-02 — filter・tag・character selector

目的:

- opponent stance、character、tag、折りたたみ filter の表示と操作を統一する。
- 長い tag、tag 検索、selector の dropdown 表示を整理する。

主対象: L39, L46, L104, L136, L139, L240, L302, L306, L313, L322。

主な touched area: Combo list/filter、tag UI、CharacterSelector。

gate:

- L139 の stance 表示仕様と L315 の曖昧な filter 要望を RESEARCH で確定する。
- tag データモデル拡張は行わず、既存 tag の UI 改善に限定する。

並列性: 01 完了後に開始。M23-03/06/08 とは touched area 確認後に並行可能。

### M23-03 — compare・detail・recipe 可読性

目的:

- compare/detail の導線、character 名、recipe 表示、長文 layout を揃える。
- 派生状態や消費表示が画面間で欠落しないようにする。

主対象: L35, L54, L58, L60, L61, L62, L132, L176, L224, L316。

主な touched area: compare/detail page、recipe presenter、表示 layout。

gate:

- M20 の recipe text/cache 契約と naming が確定していること。
- recipe 生成規則自体は M23 で変更せず、表示・導線に限定する。
- click-drag scroll（L60）はアクセシビリティと pointer 操作を PoC してから採否を決める。

並列性: M23-01/04/06 と並行可能。locale や共通 recipe component を触る場合は 07 まで仮 key にせず、owner を一人に限定する。

### M23-04 — editor interaction・dirty state・feedback safety

目的:

- E-3 の dirty confirm / editor state preservation を実装する。
- drag、sticky action、警告リンク、toast/dialog、列幅など編集事故につながる UX をまとめて直す。

主対象: L44, L55, L131, L140, L141, L142, L158, L178, L304, L307, L308。正式 M23 scope の E-3 もここに含める。

主な touched area: ComboEditor、RecipeBuilder、editor state、toast/dialog/error boundary。

gate:

- confirm 発火条件、保存済み判定、戻る/route change/browser unload の責務を設計する。
- L140/L141 の sticky UI と L55 の drag は RESEARCH または小 PoC で採否を確定する。
- feedback/error 全体を一度に置換せず、回帰テスト可能な単位に分ける。

並列性: editor 面の単独 owner とする。M23-05/08 が ComboEditor/RecipeBuilder に触る期間とは重ねない。

### M23-05 — setup workflow・link・readability

目的:

- E-1 の setup link UI を M19 の候補選択方式へ統合する。
- setup copy、linked count、memo/modifier 表示、auto-name、filter 表記を整える。

主対象: L18, L50, L52, L59, L117, L128, L133, L143, L175, L226, L325。

主な touched area: SetupRegistration、setup list/detail、setup candidate/link UI。

gate:

- M20 の recipe cache/display contract が確定していること。M20-07 の import reverse lookup は E-1 の直接依存にしない。
- M23-04 から editor state ownership が handoff 済みであること。
- L18 は再現確認を行い、解消済みなら実装せず ledger を閉じる。

並列性: 04 の後。M23-02/03/06 と並行可能だが、共通 recipe component が重なる場合は 03 の後にする。

### M23-06 — import/export UX cleanup

目的:

- file 選択、format、空状態、結果表示、旧 export 導線、用語を整理する。
- backend contract を増やさず、現在の import/export 能力を理解しやすくする。

主対象: L153, L154, L156, L159, L161, L162, L252。

主な touched area: import/export pages、routing/navigation、result/error presentation。

gate:

- M20-07 の import alias lookup と回帰試験が完了していること。
- CSV/JSON 仕様変更、履歴モデル追加、破壊的な route 削除は別 CHANGE とする。

並列性: M23-01/03/04/08 と並行可能。router/header を触る短時間だけ 01 と直列化する。

### M23-07 — terminology・i18n・内部値露出の最終 sweep

目的:

- D-2/D-3 と **Phase 3 M23 の tag/filter 表示項目**をまとめ、ja/en parity、SA gauge 単位、info bar、用語、内部 enum/value の露出を是正する。
- 画面横断で同じ概念に同じ表示名を使う。

主対象: L41, L42, L43, L56, L113, L119, L130, L146, L234, L256, L319。M23-05 等の用語修正も最終確認対象にする。

主な touched area: locale resources、display mapping、InfoBar、tag/label components、関連 docs。

gate:

- M20 の命名成果と M21 の controller 用語が確定していること。
- DB/API 内部値を変更せず、境界 mapping で表示語へ変換するのを原則とする。
- locale key の大規模 rename は同時に一人だけが行う。

並列性: UI 機能パッケージの後に単独の統合 sweep とする。先に部分着手すると locale conflict と手戻りが増える。

### M23-08 — command icon annotation（controller 追補は decision 後）

目的:

- `followup-backlog.md` の正式 M23 active slug `command-icon-annotation` を、技名横への限定的なコマンドアイコン併記として設計する。
- 同じ icon asset を要求し得る controller 追補を混同せず、再利用可能性だけを decision packet に残す。

主対象: Memo の主対象行はなし。正式 M23 active slug `command-icon-annotation` を第二 ledger で追跡する。

主な touched area: command presenter、採用画面の技名表示、command token mapping、icon assets。VirtualController は既定 read-only。

完全修飾した関連項目の disposition:

- **followup controller G-2（9方向パッド仕上げ） / L167**: 実機確認できる時期への割付待ち。M23 吸収は開発者判断。
- **followup controller G-3（仮想controllerアイコン化） / L250**: 将来未割付かつ M15-03 の矢印除去判断を反転する scope expansion。自動吸収しない。
- **followup controller G-4（controller i18n）**: M23-07 の英語 locale 候補として扱う。
- **L248**: 第二波 seed 前の強度なし技 precheck。M14/pre-seed 側へ返す。
- **L180**: 全 character seed 後の modifier/別技ボタン面。M14/update wave の完了条件と再開 trigger を確認する。
- **L168, L174, L232, L321**: 子ウィンドウ、なっちゃってレバー、技一覧省略、target combo 入力という個別新機能。各々を decision packet 化する。

gate:

- command icon を出す画面、command が無い技の fallback、自前 asset とライセンス、DES-005 CHANGE の要否を承認する。
- M21 PoC report だけでは開始しない。VirtualController に触れる案を採る場合は、PoC 後の M21 overview/本実装契約、完了 handoff、判定窓、押下/解放、チャタリング、`pressed`/`value`、user gesture、focus owner の裁定を要求する。
- controller G-3 を束ねる場合は、過去判断反転を明示して再承認する。

並列性: command presenter だけなら touched area 確認後に 03/06 と並行可能。VirtualController/RecipeBuilder を触る scope expansion は M21 完了まで着手禁止で、M23-04 と直列化する。

### M23-09 — operations・CI/E2E・distribution・残存 refactor

目的:

- 正式 M23 scope の G/H、F12-6、E2E flaky、CI、dependency audit を閉じる。
- importer/update command の運用導線と、配布時の task tray/no-console 要望を採否まで含めて整理する。

主対象: L116, L166、および §6.2 に個別展開した M23 の G/H/F12-6 active item。

主な touched area: CI、Playwright、build/distribution、small backend refactor、operational docs。

gate:

- task tray は単なる polish ではなく OS integration なので、設計・実装コストを別 decision packet で承認する。
- migration cleanup は orphan 判定と rollback 方針を先に確定する。
- full E2E は他レーンの負荷試験と同時実行しない。

並列性: 調査や独立した CI 設定は先行可能だが、feature 完了後に全体を統合検証する。repo-wide refactor は他の実装レーン終了後に行う。

### M23-CLOSE — coverage ledger と統合 close

目的:

- Memo 131 行すべてと、正式 M23 active item すべての最終 disposition と証拠を確定する。
- M20/M21 handoff を含む回帰、build、unit、E2E を一度に再確認する。
- `Memo_Someday.txt` の状態更新は、正本側の更新承認を得たうえで行う。

完了条件は §8 を参照。どちらか一方の ledger だけでは close しない。

## 4. 並列実行案

### 4.1 M20/M21 実施中、または M22 実装中に先行してよい作業

現時点では次だけを推奨する。

- `M23-RESEARCH-01` の document/as-built 調査
- M23 coverage ledger の雛形
- decision packet の論点整理
- M20/M21 handoff checklist の作成
- M22 contract との API/DES/touched-area 非交差調査
- 再現手順と受入条件の草案

現時点で避けるもの:

- M20 所有の preset/alias/recipe cache/import 補助の変更
- M21 所有の controller/input component の変更
- M22 実装中の M23 implementation（例外は非交差を個別立証して開発者承認した場合のみ）
- 共通 locale の先行 rename
- M23 番号、CHANGE 番号、migration 番号の独断予約
- 正式 overview/contract の承認前実装

### 4.2 推奨 wave

| Wave | Lane A | Lane B | Lane C | 統合条件 |
|---|---|---|---|---|
| P（現在） | RESEARCH: 二系統 ledger/dedupe | RESEARCH: M20 handoff 論点 | RESEARCH: M21/M22 handoff 論点 | 文書/read-only のみ |
| 0 | 正式 M23 overview/contract | decision 承認 | test baseline | M22 非実装期。ここで正式発番 |
| 1 | M23-01 | M23-03 | M23-04 | M20 完了が 03 の条件 |
| 2 | M23-02 | M23-06 | M23-08 | command icon 単独なら M20 command index handoff。controller を束ねる場合のみ M21 完了も必須 |
| 3 | M23-05 | 03/06 の残件・review | 08 の残件・review | 04→05 handoff 必須 |
| 4 | **M23-07 単独統合** | review のみ | review のみ | locale/用語 owner を単一化 |
| 5 | **M23-09 統合** | review のみ | 軽量 test のみ | repo-wide refactor 中は機能変更停止 |
| Close | full test/E2E | coverage ledger | docs/handover | 重い試験を同時実行しない |

M20 が M21 より先に終了した場合、M23 の正式契約承認後に 01/03/04/06 を進め、VirtualController を触る 08 の scope expansion だけを待機させられる。反対に M21 だけが先に終了しても、M20 依存の recipe/setup/import を避ければ 01/04 と command presenter 限定の 08 は候補になる。ただし、既に M20/M21 が複数レーンを占有している間に M23 implementation を起動するか、既定 2 レーンを 3 レーンへ増やすかは `parallel-board.md` 上で明示承認する。M22 実装中は原則停止する。

### 4.3 同時実行禁止マトリクス

| 組合せ | 理由 | 処置 |
|---|---|---|
| 01 × 02 | list/CharacterSelector overlap | 01→02 |
| 04 × 05 | ComboEditor/SetupRegistration state overlap | 04→05 |
| 04 × 08 の controller scope expansion | RecipeBuilder/input/focus overlap | 04→08。command presenter 限定なら touched area を個別確認 |
| 03 × M20 recipe work | recipe presenter/cache contract overlap | M20 handoff 待ち |
| 06 × M20-07 | import lookup/error contract overlap | M20-07 handoff 待ち |
| M22 × 全 M23 implementation lane | 認証/version/error/API の横断関心事 | 原則 M22 と直列。read-only research のみ可 |
| 07 × 全 UI lane | locale/display mapping 横断 conflict | UI lane 後に統合 |
| 09 repo-wide refactor × 全 feature lane | 広域差分で review と原因分離が崩れる | feature freeze 後 |

## 5. M23 に無条件で取り込まない項目

「Someday の未完を片づける」ためには、実装しない行も正式に行先を決める必要がある。次は M23 の既定スコープにせず、decision または別工程へ返す。

### 5.1 M20 へ返す／M20 完了時に再判定

L53, L57, L108, L112。

- preset/default preset、recipe cache、rush naming/representation に関係する。
- M20 完了結果で解消していれば閉じ、未解消なら M20 followup と M23 display-only の境界を決める。
- L318 は 1 行を二つに分解する。「rush 必殺技の表示命名」は M20-06 との整合を確認するが、「move 追加と setplay filler」は M20 の moves freeze / setplay 除外に反するため、M20 へ一括返却しない。RESEARCH の decision packet で update/setplay の別工程を裁定する。

### 5.2 M14/update wave へ返す

L123, L124, L135, L169, L180, L236, L248, L258, L260, L262, L323。

- seed data、character-specific state、frame data、modifier/別技ボタン面、強度なし技 precheck、hold naming などデータ更新の責務が中心。
- UI で隠蔽せず、update tooling/seed の正しい工程に返す。
- L238 は seed 再作業ではない。Manon seed 投入済みという事実と domain note を RESEARCH で確認し、非 action の close 候補にする。

### 5.3 Phase 4・formal release・新製品機能の decision packet

L66, L67, L68, L70, L71, L73, L77, L78, L79, L83, L84, L85, L86, L103, L111, L114, L115, L164, L168, L174, L219, L220, L221, L222, L228, L230, L232, L242, L244, L250, L264, L309, L310, L311, L312, L320, L321, L324。

含まれるもの:

- modern/別ゲーム対応、standalone setplay、release media、dark mode、中国語
- starter/hit/wakeup/cancel、metadata taxonomy、tag type など schema/domain 拡張
- controller 子ウィンドウ・なっちゃってレバー・技一覧省略・アイコン化・target combo 入力、setplay exercise、AI/random、edit mode、strategy memo など新しい product surface

これらを M23 に取り込む場合は「小改善」ではなく scope expansion として、独立した設計・migration/API 契約・工数承認を行う。

### 5.4 ユーザーフィードバック後に採否を決める

L172, L173, L314, L317。

- shortcut、inline edit、branch、limited combo など、要望の有無や操作モデルが未確定。
- feedback を得ずに M23 の実装必須へ変換しない。

### 5.5 controller G-2 の割付待ち

L167。

- 9方向パッドの主ラベル・aria・スマホ幅確認は、followup controller G-2 が「実機確認できるタイミング」としており M23 割付ではない。
- M23 へ入れる場合は、M21 完了 handoff、開発者の実機確認手番、E2E 追従を明記して再割付する。

## 6. 二系統の一次 coverage

### 6.1 Memo 未完 131 行

この表では、各未完行を重複なく一つの主 disposition に割り当てている。正式 ledger では行本文、再現結果、受入条件、証拠リンクを追加する。

| 主 disposition | Memo 行番号 | 件数 |
|---|---|---:|
| M23-RESEARCH-01 | L238, L315, L318 | 3 |
| M23-01 | L28, L38, L100, L105, L129, L170, L171, L305 | 8 |
| M23-02 | L39, L46, L104, L136, L139, L240, L302, L306, L313, L322 | 10 |
| M23-03 | L35, L54, L58, L60, L61, L62, L132, L176, L224, L316 | 10 |
| M23-04 | L44, L55, L131, L140, L141, L142, L158, L178, L304, L307, L308 | 11 |
| M23-05 | L18, L50, L52, L59, L117, L128, L133, L143, L175, L226, L325 | 11 |
| M23-06 | L153, L154, L156, L159, L161, L162, L252 | 7 |
| M23-07 | L41, L42, L43, L56, L113, L119, L130, L146, L234, L256, L319 | 11 |
| M23-08 | —（Memo 外の正式 active slug のみ） | 0 |
| M23-09 | L116, L166 | 2 |
| M20 へ返却/再判定 | L53, L57, L108, L112 | 4 |
| M14/update wave | L123, L124, L135, L169, L180, L236, L248, L258, L260, L262, L323 | 11 |
| Phase 4 / formal release / scope expansion | L66, L67, L68, L70, L71, L73, L77, L78, L79, L83, L84, L85, L86, L103, L111, L114, L115, L164, L168, L174, L219, L220, L221, L222, L228, L230, L232, L242, L244, L250, L264, L309, L310, L311, L312, L320, L321, L324 | 38 |
| feedback gate | L172, L173, L314, L317 | 4 |
| controller G-2 割付待ち | L167 | 1 |
| **合計** |  | **131** |

`[調査]` 8 行（L90, L91, L92, L93, L96, L118, L246, L254）は合計に含めず、RESEARCH の補助入力にする。特に restore validation、setup edit semantics、命名候補、interview、seed note は該当パッケージの採否判断に利用する。

### 6.2 正式 M23 active item の最低集合

次は Memo 131 行とは別に追跡する最低集合である。RESEARCH 時に最新版の `phase3-overview.md` と `followup-backlog.md` を全件再抽出し、増減を反映する。各 slug に owner、acceptance、証拠、defer 時の再開条件を追加するまで、この表だけで close 判定してはならない。

| Active slug（仮） | 根拠・内容 | 主パッケージ候補 | 一次状態 |
|---|---|---|---|
| `phase3-e1-setup-link-ui` | E-1 setup link UI 統合 | M23-05 | active |
| `phase3-e2-default-character` | E-2 default character 優先順位 | M23-01 | active |
| `phase3-e3-dirty-preservation` | E-3 dirty confirm / state preservation | M23-04 | active |
| `phase3-d2-english-locale` | D-2 英語 locale | M23-07 | active |
| `phase3-d3-i18n-details` | D-3 SA 単位、info bar、tag/filter 等 | M23-07/M23-02 | active |
| `refactor-recipe-cache-api` | recipeCache API 露出 | M23-09 | M20 handoff 待ち |
| `refactor-query-key` | queryKey object/flat 統一 | M23-09 | active |
| `refactor-use-check-duplicate` | `useCheckDuplicate` TanStack 化 | M23-09 | active |
| `refactor-setup-summary-type` | SetupSummary 型集約 | M23-09 | active |
| `refactor-toml-atomic-write` | TOML 全再エンコード＋atomic write 重複 | M23-09 | active |
| `refactor-validation-fetch-lib` | 検証 fetch 共通 lib 昇格 | M23-09 | active |
| `refactor-recipe-builder-warn` | RecipeBuilder `console.warn` | M23-09 | active |
| `e2e-timing-flake-cluster` | 既知 timing flake、G-5/G-6 観察点 | M23-09 | 再現・頻度確認 |
| `distribution-lan-ip` | LAN IP 事前提示 | M23-09 | active |
| `distribution-cross-build-smoke` | mac/Linux cross-build・実機起動 | M23-09 | 開発者手番あり |
| `ci-github-actions` | GitHub Actions CI | M23-09 | active |
| `ci-pr-nightly-split` | PR 高速検査 / nightly cross-build 分離 | M23-09 | 未裁定 |
| `dependency-audit` | 依存 library 棚卸し | M23-09 | active |
| `distribution-fw-av-doc` | LAN FW/AV 制約の運用確認 | M23-09 | as-built 再確認 |
| `f12-6-inline-insert` | test inline INSERT cleanup | M23-09 | 低優先 active |
| `f12-6-000012-down-orphan` | 000012 down orphan 判定 | M23-09 | 低優先・migration gate |
| `command-icon-annotation` | 技名横へのコマンド icon 併記 | M23-08 | 画面未確定・CHANGE 見込み |
| `controller-g4-i18n` | VirtualController の日本語 hard-code 解消 | M23-07 | M21 handoff/英語 locale 連動 |
| `m13-i-export-i18n` | export label の i18n 散在 | M23-06/M23-07 | 英語 locale 連動 |

この表の `phase3-d3-i18n-details` と controller G-4、followup G-3 は番号だけで呼ばない。前者は Phase 3 の tag/filter i18n、後二者は controller followup であり、同じ「G-3/G-4」表記を使うと誤結合する。

## 7. Claude が M23 開始時に行うチェックリスト

### 7.1 baseline 再確認

1. `CLAUDE.md` を最初から最後まで再読する。
2. `docs/handover/docs-map.md` で正本と derived artifact を確認する。
3. `progress-summary.md`、`parallel-board.md`、M20/M21/M22 overview/contract/completion report の最新版を読む。M21 PoC report の存在と board の状態がずれていれば、board/overview 同期を設計卓へ上げる。
4. `Memo_Someday.txt` を再集計する。この一次案との差分を ledger に反映する。
5. `code-facts.md` の generated commit と現在 HEAD を比較し、古ければ所定手順で更新してから as-built を判断する。
6. M20/M21 が残した migration、API、test、known issue、owner handoff を確認する。M21 は判定窓、押下/解放、チャタリング、`pressed`/`value`、user gesture、focus owner の裁定有無を個別確認する。
7. M22 が active なら M23 implementation を開始せず、contract の DES/API 所有面との非交差調査だけを行う。
8. 既に解消した Memo 行は、実装せず証拠を添えて close 候補にする。

### 7.2 正式化の順序

1. RESEARCH report と二系統の coverage ledger を提示する。
2. 開発者に scope/disposition、repo 全体の同時レーン上限、M22 との直列条件を承認してもらう。
3. `phase3-overview.md` と M23 overview/contract の整合案を作る。contract は必須 6 項目を全て埋める。
4. ledger はまず M23 overview/contract 内の表として置く。別ファイルが必要なら既存型を確認し、開発者承認、正式な置き場、寿命「M23 close まで」、close 後の archive/統合先を定義する。
5. 正式な sub-milestone/CHANGE 番号を registry/board と照合して発番する。
6. touched area、migration、dependencies、test budget を E-14 横断表へ記載する。
7. 各 sub は instruction → Plan Mode → implementation → review → completion report の順で実施する。
8. completion report ごとに二系統 ledger、`progress-log.md` 横断 index、`parallel-board.md` を所定 owner が更新する。
9. CHANGE を消費した sub は、通知書、改訂 DES、change-report、registry の一式を照合する。

### 7.3 開発者に確認すべき判断

- 「全未完を片づける」を、本案どおり「全行に disposition を付け、M23 適合分を実装する」と定義してよいか。
- 9 パッケージの境界、既定 2 レーン、例外的な最大 3 レーン、および M20/M21 を含む repo 全体上限を承認するか。
- editor の drag/sticky UI、task tray、click-drag scroll を M23 必須にするか、PoC/feedback gate に置くか。
- metadata/domain/setplay 拡張を Phase 4 へ返すか、M23 の scope expansion として別枠承認するか。
- M20/M21 の終了時期がずれた場合に、依存しない M23 lane を先行実装してよいか。
- M22 中は M23 implementation を全面停止するか。例外を許す場合、どの DES/API 非交差証明を必須にするか。
- controller G-2/G-3/G-4、L168/L174/L232/L250/L321、`command-icon-annotation` の各 owner と M23 吸収範囲。controller G-3 の矢印復活で M15-03 の過去判断を反転するか。
- M21 の判定窓、押下/解放、チャタリング、`pressed`/`value`、user gesture、focus owner と、overview/board 同期時点。
- L318 の命名部分と move/setplay 部分の行先を分けるか。
- CI の PR/nightly 分離、task tray、distribution の必須/任意境界をどうするか。
- coverage ledger の正本上の置き場と寿命をどうするか。
- M23-07 を最後の単独 i18n/terminology sweep にするか。

## 8. M23 全体の完了条件案

M23 は次をすべて満たしたときだけ close する。

- Memo 131 行すべてに一意な最終 disposition、owner、根拠、検証結果がある。
- §6.2 を M23 開始時に再抽出した正式 active item 全件に、owner、acceptance、証拠、最終状態、defer 時の再開条件がある。
- M23 実装対象は acceptance criteria と対象テストを満たす。
- M20/M21 から引き継いだ契約を破っていない。
- ja/en locale parity と内部値非露出を確認している。
- dirty state、navigation、import/export、setup、controller の主要 happy/error path を回帰確認している。
- unit/build と、所定の Playwright shard/full E2E が成功している。
- flaky test、orphan migration、dependency audit、distribution 項目に close または明示的 followup がある。
- deferred/rejected 項目は行先の milestone/backlog と acceptance trigger が明記されている。
- M23 contract の必須 6 項目が最終 as-built と一致し、各 sub に instruction、review、completion report がある。
- 各 sub の `progress-log.md` 横断 index と `parallel-board.md` 状態が同期している。
- 消費した CHANGE は通知書、改訂 DES、change-report、registry の一式が揃い、DES 所有権違反がない。
- `Memo_Someday.txt` と progress/board/handover の更新が相互に矛盾しない。
- temporary draft の記述を正本へ無批判にコピーせず、承認済み事実だけを正式文書へ反映している。

## 9. この一次案を正式資料へ昇格させる際の注意

- 本案は構造提案であり、`design-instruction-playbook.md` が禁じる独断の sub-milestone expansion を行うものではない。
- M23-01～09 は「候補パッケージ名」である。開発者承認後に必要数を統合・分割して正式発番する。
- Memo の行番号は現時点のファイルに対する locator であり、編集後は安定 ID を ledger に持たせる。
- M23 で実装しないことと、要望を無視することは同義ではない。別工程への返却にも owner、理由、再開条件が必要である。
- 競合回避は Git のファイル単位だけでなく、DB/API/display terminology/test environment の契約単位で判定する。
