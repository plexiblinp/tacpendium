# M5 設計担当チャット 起動キット

> 本ファイルは M5 詳細設計・製造準備担当(Claude Web 版)チャットを立ち上げるための
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
| 6 | 05-screen-design.md | `docs/design/05-screen-design.md` | 設計書本体(v2.8.0、CHANGE-013 反映済み) |
| 7 | 06-validation.md | `docs/design/06-validation.md` | 設計書本体(v1.9.0、CHANGE-012 反映済み) |
| 8 | supp-001-detailed-design.md | `docs/design/supp-001-detailed-design.md` | 設計補足(v1.13.0、M4 セットプレイ系反映済み) |
| 9 | design-instruction-playbook.md | `docs/handover/design-instruction-playbook.md` | 運用ルール集(v1.8.0、M4 完了反映済み) |
| 10 | retrospective-log.md | `docs/handover/retrospective-log.md` | 設計担当ミス累積記録(M4 期間 18 件追記済み) |
| 11 | architecture-patterns.md | `docs/handover/architecture-patterns.md` | 確立アーキテクチャパターン(v1.0.3、M4 期間反映済み) |
| 12 | change-number-registry.md | `docs/handover/change-number-registry.md` | CHANGE 番号運用(次回採番 015 から、014 欠番) |
| 13 | m4-to-m5-handover.md | `docs/handover/m4-to-m5-handover.md` | M4→M5 引き継ぎ(マイルストーン固有) |
| 14 | progress-summary.md | `docs/progress/progress-summary.md` | 進捗要約 M0〜M4(v1.1.0、M4 期間要約追記済み) |
| 15 | model-allocation.md | `docs/human-notes/model-allocation.md` | モデル配分(M4 まで反映済み) |
| 16 | CLAUDE.md | `CLAUDE.md`(リポジトリルート) | 製造担当向け指針(設計担当も一読) |

### 任意(対話の中で必要になったら投入)

| ファイル名 | パス | 渡すタイミング |
|-----------|------|--------------|
| M4-04 / M4-05 指示書 + 各レビューチェックリスト | `docs/instructions/` ・ `docs/instructions/reviews/` | 直近の指示書テンプレート参照用。問題なければ最初のプロンプト送信後の次チャットで |
| progress-log.md | `docs/progress/progress-log.md` | progress-summary.md で足りず、M1〜M4 の詳細(curl 出力・E2E 等)が必要になったとき |
| handover_1.md / m1-to-m2 / m2-to-m3 / m3-to-m4 handover | `docs/handover/archive/` | 基本設計時点の前提や M1〜M3 期の細部を遡る必要が出たとき |
| CHANGE 通知書(過去分) | `docs/change-notes/` | 設計変更の経緯を遡る必要が出たとき |

> M4 期からの変更点: handover が `m4-to-m5-handover.md`(#13)に進捗。`m3-to-m4-handover.md` は
> アーカイブ移動(任意投入)。設計書本体は M4 期間で **DES-005 v2.8.0 / DES-006 v1.9.0** に改訂(CHANGE-012 /
> CHANGE-013、CHANGE-014 は欠番)。**SUPP-001 v1.13.0**(セットプレイ系反映)、**playbook v1.8.0**(M4-11/12/17 由来
> §4.9「3 点セット確認」+ M4-18 由来 §1.4「役割境界明示」+ §13.4「複数案提示フォーマット」を新設)、
> **progress-summary v1.1.0**(M4 期間要約追記)、**retrospective-log v1.0.16**(M4 期間 18 件追記)。

---

## 2. 最初のプロンプト(コピペ用)

```text
私はストリートファイター6(以下 SF6)のコンボを効率的に管理・比較・共有するための Web アプリケーションを個人開発中のエンジニアです。
あなたは「詳細設計・製造準備担当」(設計・指示書作成担当)として私の作業を支援してください。
現在、要件定義・基本設計は完了済みです。製造工程はフェーズ・マイルストーンに分割して進めており、現在フェーズ1の M4 まで完了したところです。あなたには M5 から作業を引き継いでいただきます。

あなたの役割は design-instruction-playbook.md §1 に定義された「設計担当 Claude」です。製造担当 Claude Code・レビュー担当 Claude Code とは別セッションで、Claude Code への指示書とレビューチェックリストの作成、製造担当・レビュー担当からの Q&A 対応、CHANGE 通知書の起票、handover / playbook の改訂提案を担います。

まずこれまでの工程で完成したドキュメントを渡します。ファイル名:簡単な概要を記載しています。
読む順序は m4-to-m5-handover.md §7.1「新セッション開始時の確認手順」に従ってください(まず design-instruction-playbook.md と m4-to-m5-handover.md を読むと全体構造が掴めます)。

A. 設計書本体(プロジェクト恒久・真の情報源)
  requirements.md:要件定義
  01-tech-stack.md:技術スタック
  02-architecture.md:アーキテクチャ
  03-data-model.md:データモデル
  04-notation-spec.md:内部表現仕様
  05-screen-design.md:画面設計(v2.8.0、CHANGE-013 反映済み)
  06-validation.md:バリデーション(v1.9.0、CHANGE-012 反映済み)
  supp-001-detailed-design.md:設計補足・運用ルール(製造・レビュー・設計の全担当が参照する技術詳細、v1.13.0)

B. 設計担当の恒久資料(運用ルール・反省・パターン)
  design-instruction-playbook.md:プロジェクト恒久の開発スタイル・運用ルール集(設計担当専用、最初に読む、v1.8.0)
  retrospective-log.md:設計担当が全期間で犯した指示書ミスの累積記録(M4 期間 18 件追記済み)
  architecture-patterns.md:確立済みの実装アーキテクチャパターン(v1.0.3、M4 期間反映済み)
  change-number-registry.md:CHANGE 通知書の採番状態(次番号の確認用、次回 015 から)

C. M4 → M5 引き継ぎ(マイルストーン固有・差分情報)
  m4-to-m5-handover.md:M4 完了状態・M5 着手の現在地・持ち越し課題

D. 進捗・配分
  progress-summary.md:製造工程の進捗要約(M0〜M4)。詳細が必要なら progress-log.md を別途渡します
  model-allocation.md:モデル配分リファレンス(M4 まで反映済み、M5 着手時に追記する)

E. プロジェクト指針
  CLAUDE.md:製造担当 Claude Code 向けのプロジェクト指針。設計担当も概要把握のため一読してください

あなたへの依頼事項(playbook §1 の設計担当の責任範囲):
1. M5 の指示書作成のために私と打ち合わせる。ドキュメントを読んで質問があれば回答し、基本設計のミスがあれば指摘、未決事項を解決する。基本設計だけでは作れない指示書の部分を決定し、必要なら設計補足資料(SUPP-001)へ追記する。
2. 設計書本体・SUPP-001 をベースに、各画面・機能について製造担当 Claude Code への指示書を作成する。
3. 指示書の投入順を決める。適切であれば複数の画面・機能をまとめて1指示書にすることも検討する。
4. 指示書ごとの使用モデル(Opus / Sonnet)を難易度を考慮して決め、model-allocation.md に追記する。
5. CLAUDE.md・settings.json は整備済み。M5 で改訂が必要になった場合の改訂支援を行う。

製造工程の進捗:M4(セットプレイ系)が完了し、M5(比較系)の指示書作成に進みたいという状況です。
- M1〜M4 の全指示書(M1-01〜M4-05)は実装完了・E2E 動作確認済み、開発者承認済み。
- M4 期間で CHANGE-012 / CHANGE-013 を起票、CHANGE-014 は欠番化(設計担当起票判断ミス、retrospective-log §5.1 M4-15 参照)。DES-005 v2.7.0 → v2.8.0、DES-006 v1.8.0 → v1.9.0、SUPP-001 v1.11.0 → v1.13.0 に改訂済み。
- M4 からの持ち越し課題(C-2 / C-3 / C-4 / L-02 / L-03)が m4-to-m5-handover.md §3 にあります。M5 でどう扱うか協議したい。**M3 から継承していた P-01 / L-01 および M4 期間中に発生した C-1 は M4 で解消済み**(progress-summary §4)。
- 既知の制限事項は progress-summary.md §5 および m4-to-m5-handover.md §3 を参照。
- M5 のスコープは SUPP-001 §4.1(マイルストーン分割表)を参照。
- M4 期間で playbook v1.8.0 まで改訂済み(§1.4「プロジェクト現状の認識は開発者の責任範囲」、§4.9「既存 UI コンポーネントの 3 点セット確認原則」、§13.4「複数案を提示する場合のフォーマット」を新設)。M4 期間最頻出パターン「実コード確認の省略」(9 件)への対処として §4.9 を運用する。

ドキュメント体系について:恒久情報(反省・アーキテクチャパターン・CHANGE 番号運用)は B グループの専用ファイルに分離済み。過去の引き継ぎ資料(handover_1.md / m1-to-m2 / m2-to-m3 / m3-to-m4)はアーカイブ済みで、必要になったら提示します。設計変更通知書の過去成果物も省略しています(設計変更頻度は低下しているため。必要時に提示します)。

まずは添付のファイルを読み込み、作業を理解してください。読み込みに失敗したファイルがあれば連絡してください、再送します。不足しているとみられる資料や、プロジェクトに対する質問があれば受け付けます。

特に問題がなければ、M4 で直近作成した指示書(M4-04 / M4-05 とそのレビューチェックリスト)をテンプレート参照用に次のチャットで添付します。
```

---

## 3. 補足(対話の進め方)

- M4 と同様、最初のプロンプト + A〜E のファイルを投入 → 設計担当の読み込み・質問対応 → 対話しながら
  M5-overview 起票 → サブマイルストーン指示書へ、という流れ。
- 「任意」ファイル(M4-04/05 指示書、progress-log.md、アーカイブ handover、CHANGE 通知書)は
  設計担当から要望が出たとき、または上記プロンプト末尾のとおり次チャットで渡す。
- M5 のサブマイルストーン分割は M5-overview 起票フェーズで協議して確定する。

### M4 プロンプトからの主な改訂点

| 改訂 | 理由 |
|------|------|
| 「M3 まで完了 → M4 から引き継ぎ」を「M4 まで完了 → M5 から引き継ぎ」に更新 | 進捗の反映 |
| 持ち越し課題を C-2 / C-3 / C-4 / L-02 / L-03 に差し替え | P-01 / L-01 は M4 で解消、C-1 も M4 で解消。新規発生(C-2/C-3/C-4)と継承(L-02/L-03)のみ残す |
| 「M3 期間で CHANGE-010 / 011 起票、DES-002 v1.7.0」を「M4 期間で CHANGE-012 / 013 起票・CHANGE-014 欠番、DES-005 v2.8.0 / DES-006 v1.9.0」に更新 | M4 期間の事実反映 |
| バージョン注記更新: playbook v1.5.0 → v1.8.0、SUPP-001 v1.12.0 → v1.13.0、architecture-patterns v1.0.3、retrospective-log v1.0.16 | M4 期間および M4 完了 cleanup_docs で改訂 |
| progress-summary 対象範囲を M0〜M3 → M0〜M4 に更新 | progress-summary v1.1.0 で M4 期間要約追記済み |
| 直近指示書を M3-04 / M3-05 → M4-04 / M4-05(+ 各レビューチェックリスト)に差し替え | M4 末尾サブマイルストーン |
| 「読む順序」参照を `m3-to-m4-handover.md §0` → `m4-to-m5-handover.md §7.1`(新セッション開始時の確認手順)に変更 | m4 handover の構造に合わせ調整 |
| 「ドキュメント体系について」段落を簡略化(`m3-to-m4-handover.md` のアーカイブ移動を反映) | M3→M4 一度きりのドキュメント整理イベント記述を定常文化 |
| 設計担当 Claude 向け補足: M4 期間最頻出パターン「実コード確認の省略」(9 件)対処として playbook §4.9 を運用 | M4 期間の最重要教訓を起動時に意識させる |
