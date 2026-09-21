# M4 設計担当チャット 起動キット

> 本ファイルは M4 詳細設計・製造準備担当(Claude Web 版)チャットを立ち上げるための
> プロンプト本文 + 投入ファイル一覧。流用方法は同フォルダの `README.md` を参照。

---

## 1. 投入ファイル一覧(開発者用・パス付き)

Web チャットへアップロードするファイル。**必須**は初回投入、**任意**は対話の中で必要になったら渡す。

### 必須(初回投入)

| # | ファイル名 | リポジトリ上のパス | 種別 |
|---|-----------|------------------|------|
| 1 | requirements.md | `docs/design/requirements.md` | 設計書本体 |
| 2 | 01-tech-stack.md | `docs/design/01-tech-stack.md` | 設計書本体 |
| 3 | 02-architecture.md | `docs/design/02-architecture.md` | 設計書本体(v1.7.0、CHANGE-010/011 反映済み) |
| 4 | 03-data-model.md | `docs/design/03-data-model.md` | 設計書本体 |
| 5 | 04-notation-spec.md | `docs/design/04-notation-spec.md` | 設計書本体 |
| 6 | 05-screen-design.md | `docs/design/05-screen-design.md` | 設計書本体 |
| 7 | 06-validation.md | `docs/design/06-validation.md` | 設計書本体 |
| 8 | supp-001-detailed-design.md | `docs/design/supp-001-detailed-design.md` | 設計補足(v1.12.0、整理済み) |
| 9 | design-instruction-playbook.md | `docs/handover/design-instruction-playbook.md` | 運用ルール集(v1.5.0) |
| 10 | retrospective-log.md | `docs/handover/retrospective-log.md` | 設計担当ミス累積記録(新設) |
| 11 | architecture-patterns.md | `docs/handover/architecture-patterns.md` | 確立アーキテクチャパターン(新設) |
| 12 | change-number-registry.md | `docs/handover/change-number-registry.md` | CHANGE 番号運用(新設) |
| 13 | m3-to-m4-handover.md | `docs/handover/m3-to-m4-handover.md` | M3→M4 引き継ぎ(マイルストーン固有) |
| 14 | progress-summary.md | `docs/progress/progress-summary.md` | 進捗要約 M0〜M3(新設) |
| 15 | model-allocation.md | `docs/human-notes/model-allocation.md` | モデル配分(M3 まで反映済み) |
| 16 | CLAUDE.md | `CLAUDE.md`(リポジトリルート) | 製造担当向け指針(設計担当も一読) |

### 任意(対話の中で必要になったら投入)

| ファイル名 | パス | 渡すタイミング |
|-----------|------|--------------|
| M3-04 / M3-05 指示書 + 各レビューチェックリスト | `docs/instructions/` ・ `docs/instructions/reviews/` | 直近の指示書テンプレート参照用。問題なければ最初のプロンプト送信後の次チャットで |
| progress-log.md | `docs/progress/progress-log.md` | progress-summary.md で足りず、M1〜M3 の詳細(curl 出力・E2E 等)が必要になったとき |
| handover_1.md / m2-to-m3-handover.md | `docs/handover/archive/` | 基本設計時点の前提や M2 期の細部を遡る必要が出たとき |
| CHANGE 通知書(過去分) | `docs/change-notes/` | 設計変更の経緯を遡る必要が出たとき |

> M3 期からの変更点: 恒久情報が handover に蓄積し続ける構造をやめ、**retrospective-log /
> architecture-patterns / change-number-registry**(#10〜12)へ分離。**progress-summary.md**(#14)が
> progress-log.md の要約版。**design-instruction-playbook.md**(#9)は `docs/instructions/` から
> `docs/handover/` へ移動し v1.5.0 化。**handover_1.md / m2-to-m3-handover.md** はアーカイブ(任意投入)。

---

## 2. 最初のプロンプト(コピペ用)

```text
私はストリートファイター6(以下 SF6)のコンボを効率的に管理・比較・共有するための Web アプリケーションを個人開発中のエンジニアです。
あなたは「詳細設計・製造準備担当」(設計・指示書作成担当)として私の作業を支援してください。
現在、要件定義・基本設計は完了済みです。製造工程はフェーズ・マイルストーンに分割して進めており、現在フェーズ1の M3 まで完了したところです。あなたには M4 から作業を引き継いでいただきます。

あなたの役割は design-instruction-playbook.md §1 に定義された「設計担当 Claude」です。製造担当 Claude Code・レビュー担当 Claude Code とは別セッションで、Claude Code への指示書とレビューチェックリストの作成、製造担当・レビュー担当からの Q&A 対応、CHANGE 通知書の起票、handover / playbook の改訂提案を担います。

まずこれまでの工程で完成したドキュメントを渡します。ファイル名:簡単な概要を記載しています。
読む順序は m3-to-m4-handover.md §0「新セッションで読む順序」に従ってください(まず design-instruction-playbook.md と m3-to-m4-handover.md を読むと全体構造が掴めます)。

A. 設計書本体(プロジェクト恒久・真の情報源)
  requirements.md:要件定義
  01-tech-stack.md:技術スタック
  02-architecture.md:アーキテクチャ
  03-data-model.md:データモデル
  04-notation-spec.md:内部表現仕様
  05-screen-design.md:画面設計
  06-validation.md:バリデーション
  supp-001-detailed-design.md:設計補足・運用ルール(製造・レビュー・設計の全担当が参照する技術詳細)

B. 設計担当の恒久資料(運用ルール・反省・パターン)
  design-instruction-playbook.md:プロジェクト恒久の開発スタイル・運用ルール集(設計担当専用、最初に読む)
  retrospective-log.md:設計担当が全期間で犯した指示書ミスの累積記録
  architecture-patterns.md:確立済みの実装アーキテクチャパターン
  change-number-registry.md:CHANGE 通知書の採番状態(次番号の確認用)

C. M3 → M4 引き継ぎ(マイルストーン固有・差分情報)
  m3-to-m4-handover.md:M3 完了状態・M4 着手の現在地・持ち越し課題

D. 進捗・配分
  progress-summary.md:製造工程の進捗要約(M0〜M3)。詳細が必要なら progress-log.md を別途渡します
  model-allocation.md:モデル配分リファレンス(M3 まで反映済み、M4 着手時に追記する)

E. プロジェクト指針
  CLAUDE.md:製造担当 Claude Code 向けのプロジェクト指針。設計担当も概要把握のため一読してください

あなたへの依頼事項(playbook §1 の設計担当の責任範囲):
1. M4 の指示書作成のために私と打ち合わせる。ドキュメントを読んで質問があれば回答し、基本設計のミスがあれば指摘、未決事項を解決する。基本設計だけでは作れない指示書の部分を決定し、必要なら設計補足資料(SUPP-001)へ追記する。
2. 設計書本体・SUPP-001 をベースに、各画面・機能について製造担当 Claude Code への指示書を作成する。
3. 指示書の投入順を決める。適切であれば複数の画面・機能をまとめて1指示書にすることも検討する。
4. 指示書ごとの使用モデル(Opus / Sonnet)を難易度を考慮して決め、model-allocation.md に追記する。
5. CLAUDE.md・settings.json は整備済み。M4 で改訂が必要になった場合の改訂支援を行う。

製造工程の進捗:M3(マイコンボ系)が完了し、M4(セットプレイ系)の指示書作成に進みたいという状況です。
- M1〜M3 の全指示書(M1-01〜M3-05)は実装完了・E2E 動作確認済み、開発者承認済み。
- M3 期間で CHANGE-010 / CHANGE-011 を起票し、02-architecture.md(DES-002)は v1.7.0 に改訂済み。
- M3 からの持ち越し課題(P-01 / L-01 / L-02 / L-03)が m3-to-m4-handover.md §4 にあります。M4 でどう扱うか協議したい。
- 既知の制限事項は progress-summary.md §4 および m3-to-m4-handover.md §4 を参照。
- M4 のスコープは SUPP-001 §4.1(マイルストーン分割表)を参照。

ドキュメント体系について:M3→M4 移行時にドキュメント整理を行いました。恒久情報(反省・アーキテクチャパターン・CHANGE 番号運用)は B グループの専用ファイルに分離してあります。過去の引き継ぎ資料(handover_1.md / m2-to-m3-handover.md)はアーカイブ済みで、必要になったら提示します。設計変更通知書の過去成果物も省略しています(設計変更頻度は低下しているため。必要時に提示します)。

まずは添付のファイルを読み込み、作業を理解してください。読み込みに失敗したファイルがあれば連絡してください、再送します。不足しているとみられる資料や、プロジェクトに対する質問があれば受け付けます。

特に問題がなければ、M3 で直近作成した指示書(M3-04 / M3-05 とそのレビューチェックリスト)をテンプレート参照用に次のチャットで添付します。
```

---

## 3. 補足(対話の進め方)

- M3 と同様、最初のプロンプト + A〜E のファイルを投入 → 設計担当の読み込み・質問対応 → 対話しながら
  M4-overview 起票 → サブマイルストーン指示書へ、という流れ。
- 「任意」ファイル(M3-04/05 指示書、progress-log.md、アーカイブ handover、CHANGE 通知書)は
  設計担当から要望が出たとき、または上記プロンプト末尾のとおり次チャットで渡す。
- M4 のサブマイルストーン分割は M4-overview 起票フェーズで協議して確定する。

### M3 プロンプトからの主な改訂点

| 改訂 | 理由 |
|------|------|
| 「M2 まで完了 → M3 から引き継ぎ」を「M3 まで完了 → M4 から引き継ぎ」に更新 | 進捗の反映 |
| 役割の根拠を「handover_1.md の実装準備工程」から「playbook §1」に変更 | handover_1.md はアーカイブ済み。役割定義は playbook §1 に集約済み |
| ファイル群を A〜E に再編。B グループに新設 3 ファイルを追加、progress-log.md → progress-summary.md | M3→M4 整理で恒久情報を専用ファイルへ分離したため |
| 読む順序を m3-to-m4-handover.md §0 への参照に一本化 | handover 側に「新セッションで読む順序」を整備済み |
| 依頼事項 5(claude.md / settings.json 作成)を「作成」から「改訂支援」に変更 | CLAUDE.md・settings.json は M1 で整備済み・現存 |
| 持ち越し課題 P-01/L-01/L-02/L-03 と CHANGE-010/011・DES-002 v1.7.0 を明示 | M3 固有の引き継ぎ事項 |
