# ドキュメント整理担当 Claude へのスタートアップ指示

| 項目 | 内容 |
|------|------|
| 担当役割 | ドキュメント整理担当(一時的役割) |
| 環境 | Claude Code(プロジェクトディレクトリ直下で起動) |
| 前提モード | **Plan Mode 必須**(編集は計画提示 → 承認後のみ) |
| 作成日 | 2026-05-15 |
| 作成者 | 設計・指示書作成担当 Claude(M3 期間担当) |

---

## あなたの役割

SF6 Combo Manager プロジェクトのドキュメント整理を行う担当 Claude です。
本プロジェクトは個人開発の OSS で、M0〜M3 期間が完了し、M4 開始前に
コンテキスト肥大化対策のドキュメント整理・再構成を実施します。

品質維持が最優先で、運用ルール・設計判断の喪失は絶対に避けてください。

## 整理の目的と方針

### 目的(2 つ)

1. **重複削除・圧縮によるコンテキスト削減**: 同じルールが複数資料に重複している
   状態を解消し、後続マイルストーン担当 Claude が読むべき情報量を削減する
2. **役割別の参照分離**: 製造担当 / レビュー担当(Claude Code) と
   設計・指示書作成担当(Claude Web 版) が読むべき資料を分離し、
   不要な参照を防ぐ

### 整理の原則(必須遵守)

#### 原則 1: 1 ルール 1 箇所

- 同じルール・規約は **1 ファイル 1 箇所** にのみ記述する
- 他ファイルから参照する場合は「詳細は ◯◯ §X.Y 参照」のポインタ 1 行のみ
- 重複している箇所を見つけたら、最も論理的に適切な 1 箇所に集約し、
  他は削除 or ポインタ化

#### 原則 2: 役割別の参照分離

各役割が読むべきファイルを明確にし、不要な参照を防ぐ:

| 役割 | 主資料 | 読まない資料 |
|------|--------|-----------|
| 製造担当(Claude Code) | CLAUDE.md、各指示書、SUPP-001 | playbook、handover |
| レビュー担当(Claude Code) | 各レビューチェックリスト、設計書本体、SUPP-001 | playbook、handover |
| 設計・指示書作成担当(Web 版) | playbook、handover、設計書本体、SUPP-001、CHANGE 通知書 | (役割上、参照可能) |
| 開発者(本プロジェクトの個人開発者) | milestone-startup-guide.md(新設予定) | — |

#### 原則 3: 設計担当向け情報と Claude Code 担当向け情報の明示

- playbook / handover の冒頭に **「本書は設計・指示書作成担当 Claude が読む文書、
  製造・レビュー担当は読まない」** と明記する
- CLAUDE.md の冒頭に **「本書は製造担当 Claude Code が最初に読む文書」** と
  明記する
- 役割をまたいで読まれるルール(例: camelCase 統一)は、最も多くの役割が
  読むファイル(= CLAUDE.md または SUPP-001)に集約する

#### 原則 4: 肥大化防止の構造化

handover が肥大化しない仕組みとして、以下の継続更新ファイル群を新設する:

| 新設ファイル | 用途 |
|------------|------|
| `docs/handover/retrospective-log.md` | 設計担当ミス累積記録(全期間通算) |
| `docs/handover/architecture-patterns.md` | 確立アーキテクチャパターン(全期間通算) |
| `docs/handover/change-number-registry.md` | CHANGE 番号運用の最新状態(全期間通算) |
| `docs/handover/milestone-startup-guide.md` | **開発者向け**:新マイルストーン開始時の設計担当への投入資料リスト |

handover は **前期間固有の差分情報のみ** に圧縮する(継続情報は上記新設ファイルへ移動)。

#### 原則 5: 流用可能性の維持

- CLAUDE.md は **本プロジェクト以外でも流用可能な情報を残す**(開発者の意向)
- 流用可能な部分と本プロジェクト固有部分を節分けで区別する
- 流用可能例: Go / TypeScript の規約、camelCase 統一、Plan Mode 使い方
- 本プロジェクト固有例: SF6 ドメイン用語、マイルストーン番号への参照

---

## 実施手順(Stage 1 → 2 → 3)

### Stage 0: 着手前確認(編集禁止、読み込みのみ)

以下を実施してから Stage 1 のレポート作成に入る:

1. プロジェクトルートの構造を確認(`view` で listing)
2. 編集可能ファイルすべてを `view` で読み込み(行数・全体構成を把握):
   - `CLAUDE.md`
   - `docs/handover/design-instruction-playbook.md`(v1.5.0)
   - `docs/design/supp-001-detailed-design.md`(v1.11.0)
   - `docs/handover/m3-to-m4-handover.md`(v1.0.0)
   - `docs/progress/progress-log.md`
   - `docs/handover/m2-to-m3-handover.md`
   - `docs/handover/handover_1.md`
   - `.claude/settings.json`(存在する場合)
3. 編集禁止ファイルの存在を確認(中身は必要時のみ読む):
   - `docs/design/requirements.md`(REQ-001)
   - `docs/design/01-tech-stack.md` から `docs/design/06-situation-codes.md`
     (DES-001〜DES-006)
   - `docs/change-notifications/CHANGE-*.md` 全件
   - `docs/instructions/M{0-3}-*.md`、
     `docs/instructions/reviews/M{0-3}-*-review-checklist.md` 全件
4. **本指示書に明示的に列挙されていないフォルダ・ファイルは編集禁止**
   (開発者の個人メモや過去工程の反省メモ等が含まれる可能性あり)

### Stage 1: 重複検出 + 再構成計画レポートの作成(編集禁止)

以下を含む Markdown レポートを作成し、開発者に提示する。承認なしに Stage 2 に進まない。

#### Stage 1 レポートに含める内容

1. **ファイル間の重複対応表**:
   - ファイル A §X.Y ⇔ ファイル B §Z.W の対応関係を表で示す
   - 重複の種類(完全一致 / 類似記述 / 概念重複)を分類
   - 例: 「camelCase 統一規約」が CLAUDE.md §4 と SUPP-001 §4 と playbook §3 に
     重複している場合、対応表に明示

2. **役割別の参照分離設計**:
   - 各ファイルの **冒頭に追加する役割明示文** の案
     (例: 「本書は設計・指示書作成担当 Claude が読む文書」)
   - 「Claude Code 担当が読むべきでない情報」を playbook / handover に
     発見した場合、その移動先(CLAUDE.md / SUPP-001 のいずれか)を提案

3. **継続更新ファイル群の新設計画**:
   - `retrospective-log.md` に集約する内容(現状の m3-to-m4-handover §5 等)
   - `architecture-patterns.md` に集約する内容(現状の m3-to-m4-handover §6 等)
   - `change-number-registry.md` に集約する内容(現状の m3-to-m4-handover §7 等)
   - `milestone-startup-guide.md` の構造案(開発者向け、後述の §「開発者向け
     資料リスト」参照)

4. **圧縮版 m3-to-m4-handover.md の構造案**:
   - 前期間固有の差分情報のみに圧縮する案
   - 継続更新ファイル群への参照のみ残す節

5. **各重複に対する整理方針案**:
   - 削除する側 / 残す側、その根拠
   - ポインタを残す場合のテキスト案

6. **推定削減量**:
   - 現状の総行数・文字数
   - 整理後の推定総行数・文字数
   - 削減率の概算

7. **整理時のリスク**:
   - 運用ルール欠落リスクがある箇所
   - 役割分離の判断が難しい箇所
   - 開発者判断が必要な箇所(質問リスト)

#### 重要: Stage 1 で **絶対に欠落させない情報** の確認

以下は整理後もどこかに必ず残っていることを Stage 1 レポートで保証する:

- playbook §4.5〜§4.8 の確立済みルール本体
- SUPP-001 §4 TypeScript 規約(camelCase 統一、列挙定数同期、型分岐運用、
  ブラウザストレージ運用)
- SUPP-001 §6.4 列挙定数同期の grep コマンド例
- SUPP-001 §7.4 defaultRecipe 抽出ルール
- CHANGE 番号運用の最新状態(008 欠番、009 廃案、010-011 使用済み、
  012 以降空き)
- M3 期間で確立した分離アーキテクチャパターン(表示専用コンポーネント +
  ロジックフック)
- M4 担当 Claude が読むべき持ち越し課題(P-01、L-01、L-02、L-03)

設計担当ミス累積記録(計 15 件)は **流用不可能な内容の省略を許容**
(開発者方針)。構造的教訓(playbook へ統合する内容)は必ず残し、
個別事例の事実関係のみで価値が低いものは省略可能。

### Stage 2: 整理実施(Stage 1 承認後のみ)

開発者承認後、以下のコミット粒度で順次実施し、各コミット後に開発者に変更内容を
報告し、次のコミットに進む許可を得る。

#### コミット粒度

| # | コミット内容 | 対象ファイル |
|---|-----------|------------|
| 1 | 継続更新ファイル群の新設 | retrospective-log.md / architecture-patterns.md / change-number-registry.md / milestone-startup-guide.md |
| 2 | 過去 handover のアーカイブ化 | `docs/handover/archive/` 配下への移動(handover_1.md、m2-to-m3-handover.md) |
| 3 | m3-to-m4-handover.md の圧縮 | 前期間差分のみに再構成、継続更新ファイル群への参照を追加 |
| 4 | SUPP-001 内の重複削除と役割明示 | 製造・レビュー担当向け技術詳細として再整理 |
| 5 | playbook 内の重複削除と役割明示 | 設計担当向け運用ルールとして再整理、Claude Code 担当向け情報を CLAUDE.md / SUPP-001 へ移動 |
| 6 | CLAUDE.md 内の重複削除と役割明示 | 製造担当向け文書として再整理、流用可能部分と固有部分を節分け |
| 7 | progress-log.md の圧縮 or アーカイブ | 過去マイルストーン分の取扱を決定 |
| 8 | settings.json の整理 | 該当する場合のみ、プロジェクト固有設定と流用可能設定を分離 |

各コミット後に以下を報告:
- 変更したファイルのリスト
- 変更行数(追加・削除・差し引き)
- 主要な変更内容の要約

### Stage 3: 整理後の検証(編集後)

整理完了後、以下を確認して報告:

1. **総量比較**: 整理前後の総行数・文字数の比較
2. **重複再確認**: 各重複が「どちらかに残っている」ことの grep 確認
3. **編集禁止ファイルの非改変確認**:
   - 設計書本体(DES-001〜006、REQ-001 = requirements.md)が変更されていない
   - CHANGE 通知書がすべて変更されていない
   - 過去マイルストーンの指示書がすべて変更されていない
   - 本指示書に明示的に列挙されていないフォルダ・ファイルが変更されていない
4. **役割別アクセス確認**:
   - 製造担当が CLAUDE.md + 指示書 + SUPP-001 のみで作業可能か(playbook を読む必要がないか)
   - レビュー担当がレビューチェックリスト + 設計書本体 + SUPP-001 のみで作業可能か
5. **継続更新ファイル群の完全性確認**:
   - retrospective-log.md / architecture-patterns.md / change-number-registry.md /
     milestone-startup-guide.md が正しく機能するか
   - handover からの参照が正しく繋がっているか

---

## 開発者向け資料リスト(milestone-startup-guide.md)の構造案

開発者(本プロジェクトの個人開発者)が新マイルストーン開始時に、設計・指示書
作成担当 Claude(別チャット)に投入する資料を迷わず選べるようにするため、
以下の構造でファイル新設してください。

### milestone-startup-guide.md の最低限の構成案

```markdown
# マイルストーン開始ガイド(開発者向け)

## 1. 本書の目的

開発者が新マイルストーン(M{N})開始時に、設計・指示書作成担当 Claude
(別チャット、Web 版)に投入する資料を迷わず選べるようにする。

## 2. 設計担当に投入する標準資料セット(全マイルストーン共通)

### 必須投入

- CLAUDE.md(プロジェクト概要、製造担当向け文書だが、設計担当も把握すべき)
- docs/handover/design-instruction-playbook.md(設計担当向け運用ルール)
- docs/handover/retrospective-log.md(全期間の反省事項)
- docs/handover/architecture-patterns.md(確立済みパターン)
- docs/handover/change-number-registry.md(CHANGE 番号運用)
- docs/handover/m{N-1}-to-m{N}-handover.md(直前期間からの引き継ぎ)

### 設計書本体(該当節のみ抜粋投入が望ましい)

- docs/design/requirements.md(REQ-001、要件定義)
- docs/design/02-architecture.md(DES-002、特に §4.2 主要エンドポイント、§4.3 エラーハンドリング)
- docs/design/03-data-model.md(DES-003、テーブル定義)
- docs/design/04-internal-representation.md(DES-004、内部表現仕様)
- docs/design/05-screen-design.md(DES-005、画面・UI 設計)
- docs/design/06-situation-codes.md(DES-006、状況コード値)
- docs/design/supp-001-detailed-design.md(SUPP-001、詳細設計補足)

## 3. マイルストーン別の追加投入資料

### M4 着手時

(整理担当が記入してください、または M4 着手時に追記する旨を明記)

### M5 以降

(各マイルストーン着手時に追記する旨を明記)

## 4. 投入時の注意

- 設計担当 Claude が初回応答で読み込むため、過剰投入は context を消費する
- 該当マイルストーンに直接関係しない設計書節は省略してよい
- 製造・レビュー担当が読む CLAUDE.md / 指示書本体 / レビューチェックリストは
  設計担当のセッションに投入する必要はない(設計担当は前期間の指示書を
  テンプレート参照として読むため、過去指示書は別途投入)

## 5. 投入後の流れ

1. 開発者が上記資料を Claude Web 版にアップロード
2. 設計担当が初回応答で資料を確認し、M{N}-overview.md 起票準備を完了
3. 開発者が M{N}-overview の協議に入る
4. M{N}-overview 確定後、M{N}-{NN} サブマイルストーンの指示書起票へ進む
```

上記構造に M3 完了時点の実態を反映した内容で作成してください。
判断に迷う場合は開発者に確認してください。

---

## 進め方の最初の一歩

まず以下を実施してから Stage 1 のレポート作成に入る:

1. プロジェクトルートの構造を `view` で確認
2. 編集可能ファイル全件を `view` で読み込み
3. 編集禁止ファイルの存在を確認(中身は必要時のみ読む)
4. **Plan Mode で「Stage 1 のレポート作成計画」を提示**
   - どの順序で重複検出を行うか
   - レポートの章立て案
   - 想定作業時間

不明点は遠慮なく開発者に確認してください。整理担当のあなたの判断で
情報の欠落が起きないよう、慎重に進めてください。

特に「役割別の参照分離」と「継続更新ファイル群の新設」は本作業の主目的なので、
重複削除だけに集中せず、構造的な再設計の視点も持って進めてください。

---

## 参考: 整理対象外ファイルの全リスト(編集禁止)

絶対に編集・移動・削除してはいけないファイル:

### 設計書本体

- `docs/design/requirements.md`(REQ-001)
- `docs/design/01-tech-stack.md`(DES-001)
- `docs/design/02-architecture.md`(DES-002 v1.7.0)
- `docs/design/03-data-model.md`(DES-003)
- `docs/design/04-internal-representation.md`(DES-004)
- `docs/design/05-screen-design.md`(DES-005)
- `docs/design/06-situation-codes.md`(DES-006)

### CHANGE 通知書

- `docs/change-notifications/CHANGE-*.md` 全件(001〜007、010、011)
  - 008 は欠番、009 は廃案だが、もしファイルが存在する場合は触らない

### 指示書・レビューチェックリスト

- `docs/instructions/M0-*.md`、`docs/instructions/M1-*.md`、
  `docs/instructions/M2-*.md`、`docs/instructions/M3-*.md` 全件
- `docs/instructions/reviews/M{0-3}-*-review-checklist.md` 全件

### 本指示書に列挙されていないフォルダ・ファイル

- 開発者の個人メモや過去工程の反省メモが含まれる可能性あり
- 編集・参照ともに行わない
- 例: `notes/`、`memo/`、`scratch/` のようなディレクトリがあっても触らない

---

## 補足: あなたの権限境界

- **編集可能**: 本指示書「整理対象本体」に列挙されたファイルのみ
- **編集可能(新規作成)**: 継続更新ファイル群(retrospective-log.md /
  architecture-patterns.md / change-number-registry.md /
  milestone-startup-guide.md)
- **編集可能(移動)**: 過去 handover のアーカイブ化(`docs/handover/archive/` 配下)
- **編集不可**: 上記「整理対象外ファイル」全件、本指示書に列挙されていない
  フォルダ・ファイル
- **判断保留が必要な場合**: 開発者に質問する(Plan Mode で停止)

整理担当として、品質を維持したコンテキスト削減を実現してください。
よろしくお願いします。
