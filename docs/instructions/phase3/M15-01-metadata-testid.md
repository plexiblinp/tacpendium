# 指示書 M15-01: メタデータ入力の安定 test-id 整備（F12-4・M15 E2E 拡充の前提）

| 項目 | 内容 |
|------|------|
| 指示書ID | M15-01 |
| バージョン | 1.0.1 |
| 推奨モデル | Sonnet 4.6（FE 限定・非破壊・DES 非対象。関心数小。§7・model-allocation v1.26.0 参照） |
| Plan Mode | **必須（軽量）**（§3.3。#2 対象スコープ・#4 既存 E2E 方針は**決定済み**〔v1.0.1〕。残る実査は #1 現行 test-id 被覆・#3 起き攻め6 DOM 構造） |
| 機械レビュー | 必須（別チェックリスト: `M15-01-review-checklist.md`） |
| 並列性 | M15 先頭（他 M15 サブの回帰安全網）。M14 と並行可 |
| 依存 | なし（M15 の前提タスク）。F12-4（followup-backlog §B） |
| 想定所要時間 | 60〜120 分（対象フィールドへの test-id 付与＋命名規約統一＋既存 E2E 非回帰確認＋前提スモーク spec） |
| 作成者・作成日 | 設計担当 Claude（フェーズ3 継続担当・M15 期）/ 2026-07-02 |

## 更新履歴

| 版 | 更新日 | 更新内容 |
|----|--------|----------|
| 1.0.0 | 2026-07-02 | 初版。M15-overview v1.0.0 §3 M15-01・F12-4（メタデータ安定 test-id 整備）。 |
| 1.0.1 | 2026-07-02 | Plan Mode 決定を反映。(1) **対象スコープ＝全メタデータへ拡張**に確定（§3.3-2・§4.1）＝F12-4 11 フィールド＋native select 4 件（position/opponentStance/hitType/opponentSize＝DuplicateKey 構成要素）。**driveDamage は付与済み・新規対象外／custom-state（situation 等）は据え置き**。(2) **既存 E2E の扱い＝併設**に確定（§3.3-4・§4.3）＝既存 spec 不変＋seed 非依存スモーク 1 本追加（非回帰を機械的に保証）。残る Plan Mode 実査は #1 現行 test-id 被覆・#3 起き攻め6 DOM 構造。 |

---

## 1. 背景と目的

### 1.1 背景

- M15（入力・使いやすさ向上）は friend FB 第一波の UX 改修が中心で、**各改修を E2E で回帰検証できる土台**が要る。現状、メタデータ入力の E2E セレクタが不安定（テキスト/ロール依存で、表記変更〔M15-02/03/05〕やレイアウト変更で壊れやすい）で、F12-4（followup-backlog §B）が「メタデータ入力の安定 test-id 整備」を **M15 の前提タスク**として挙げている。
- 対象コンポーネントは **`ComboEditorBasicFields`**（`web/src/features/combo/components/ComboEditorBasicFields.tsx`・Props `value: BasicFieldsValue` / `onChange` / `customStateDefs` 他＝code-facts §1）。メタデータ入力は ComboEditor（`/combos/new`・`/combos/:id/edit` → ComboEditorPage）配下にある。
- 対象フィールド（**v1.0.1 確定＝全メタデータへ拡張**）= F12-4 明示の **damage / driveAvailableAtStart（drive）/ saAvailableAtStart（sa）/ knockdownAdvantage（knockdown）/ memo / 起き攻め6**（`okiMeatyNeutralTechThrow` / `okiMeatyNeutralTechThrowDr` / `okiMeatyBackTechThrow` / `okiMeatyBackTechThrowDr` / `okiShimmyNeutralTech` / `okiShimmyBackTech`＝計 11）＋ **native select 4 件**（`position` / `opponentStance` / `hitType` / `opponentSize`＝DuplicateKey 構成要素・VAL-C02）。いずれも code-facts §7 ComboResponse/§8 model.Combo。**`driveDamage` は既に test-id 付与済み（新規対象外）**、**custom-state（`situation` 等）は据え置き（スコープ外）**。
- **本サブは純 FE 変更・DES 非対象・API/データ契約不変**（`ComboResponse`/`CreateRequest`/`UpdateMetadataRequest` に触れない）。

### 1.2 目的

完了時に達成される状態:

- メタデータ入力の各フィールド（§1.1 の対象）に**安定した `data-testid`** が、**単一の命名規約**で付与される（表記・ラベル・レイアウト変更〔M15-02/03/05〕に影響されないセレクタ）。
- 既存 E2E が、テキスト/ロール依存セレクタから **`data-testid` セレクタへ移行**（または併設）され、以後の M15 改修で壊れにくくなる。
- 既存 E2E スイート（`combo-crud.spec.ts` 等）が**非回帰**で通過する。
- 以後の M15 サブ（M15-02〜06）が本 test-id を土台に E2E を追加できる。

### 1.3 このマイルストーンで作らないもの（スコープ外）

- **メタデータ入力の UI/挙動変更**（フィールド追加・レイアウト刷新・バリデーション変更）。本サブは **test-id 付与のみ**（表示・挙動は不変）。
- **入力方式のボタン化・コマンド解決**（M15-03）／**info-mark 説明機構**（M15-02）／**表示整理・比較バグ**（M15-05）。
- **FE E2E の使い捨て DB 化（fe-e2e-throwaway-db）・配布前クリーン DB 全 E2E**（followup・配布前ゲート＝M14-03a 報告 §4/まとめ4）。本サブは test-id 整備に限り、**残渣依存の根治は扱わない**（混同しない）。
- **DES 本体の改訂**（本サブは DES 非対象。test-id は実装詳細で DES-005 の画面仕様を変えない）。
- API/データ契約（`ComboResponse` 等公開フィールド・`UpdateMetadataRequest`）の変更。

---

## 2. 成果物

### 2.1 作成/修正するファイル（想定パス。実配置は既存構成 code-facts §1 に合わせる）

| ファイル | 内容 |
|---|---|
| `web/src/features/combo/components/ComboEditorBasicFields.tsx` | メタデータ各入力（§1.1）に `data-testid` を規約どおり付与。**表示・onChange 挙動は不変** |
| 起き攻め6 のサブコンポーネント（存在すれば・Plan Mode で特定） | oki 6 bool 入力に `data-testid` 付与（`ComboEditorBasicFields` 内か別コンポーネントかを実査） |
| `web/e2e/`（既存 spec の該当セレクタ更新＋前提スモーク spec） | 既存 E2E のメタデータ操作セレクタを test-id へ移行/併設。§5 |

### 2.2 変更しないもの（原則）

- メタデータ入力の**表示内容・ラベル・レイアウト・onChange 挙動**（test-id 付与は視覚・機能を変えない）。
- API 契約（`ComboResponse`/`CreateRequest`/`UpdateMetadataRequest`＝code-facts §7）・data 契約。
- 他 M15 サブの対象（info-mark・入力方式・タグ色・オンボーディング・比較画面）。
- DES 本体（本サブは DES 非対象）。

### 2.3 例外条項

- 既存に **test-id 命名規約が既にある**場合（Plan Mode §3.4-1 で判明）は、**本指示書の提案規約より既存規約を優先**する（命名衝突・二重規約を避ける＝digest §4「ラベル/キー再利用前の占有調査」）。

---

## 3. 前提条件

### 3.1 必読ドキュメント

> **文書ID ⇄ 実パスの正は `docs/handover/docs-map.md`（自動生成）**。疑わしい場合は docs-map を引く（記憶で書かない・retrospective-digest §0）。

- **code-facts**（`docs/handover/code-facts.md`）§1（`ComboEditorBasicFields`/`ComboEditor` Props）/§3（フロントルート `/combos/new`・`/combos/:id/edit`）/§7（`ComboResponse`/`CreateRequest`/`UpdateMetadataRequest` のメタデータフィールド）。
- **M15-overview**（`docs/instructions/phase3/M15-overview.md`）§3 M15-01・§4.7（F12-4・fe-e2e 残渣との切り分け）。
- **followup-backlog**（`docs/handover/followup-backlog.md`）§B F12-4（本タスクの出所）・M14-03a 報告 §4（fe-e2e-throwaway-db＝スコープ外の根治）。
- **DES-005**（`docs/design/05-screen-design.md`）§5.18/§5.6 相当（メタデータ入力・比較の該当画面。**参照のみ・改訂しない**）。

### 3.2 参照不要

- moves 取込（FR704・M14 で削除済み）／export/import／コマンド解決（M15-03）／info-mark（M15-02）／DES 本体の改訂。

### 3.3 着手前の確認（Plan Mode 必須・§9.4 と対応）

実装着手前に Plan Mode で開発者へ提示し確定する（推測で進めない・digest M12-1/M12-3＝現状を決め打ちしない）:

1. **現行 test-id 被覆の全数実査**: `ComboEditorBasicFields`（＋起き攻め6 のサブコンポーネント）の各メタデータ入力に **既に `data-testid` が付いているか**を grep 全数確認する。**既存の命名規約があればそれを正とし、無ければ §4.1 の提案規約を採る**（二重規約を作らない）。
2. **対象フィールド集合＝決定済み（v1.0.1）**: **全メタデータへ拡張**に確定。F12-4 明示の **damage / drive（driveAvailableAtStart）/ sa（saAvailableAtStart）/ knockdown（knockdownAdvantage）/ memo / 起き攻め6**（計 11）＋ **native select 4 件**（`position` / `opponentStance` / `hitType` / `opponentSize`＝DuplicateKey 構成要素・M15-05 比較や重複系 E2E が操作）。**`driveDamage` は付与済みのため新規対象外／`situation`・custom-state は据え置き（スコープ外）**。Plan Mode では実装詳細（付与先要素の確定）のみ扱う。
3. **起き攻め6 の DOM 構造**: oki 6 bool 入力が `ComboEditorBasicFields` 直下か別サブコンポーネント（trueな真偽入力＝SUPP §2.7 の INTEGER 由来）かを実査し、付与先を確定。
4. **既存 E2E セレクタの扱い＝決定済み（v1.0.1）**: **併設**に確定。既存 spec（`combo-crud.spec.ts` 等）の placeholder/getByText/getByRole セレクタは**不変のまま**とし（＝非回帰を機械的に保証）、source への test-id 追加は純加算。**seed 非依存スモークを 1 本追加**して test-id 解決を検証する。既存 spec を getByTestId へ**移行はしない**（将来のクリーンアップ余地として残す）。Plan Mode では、既存 spec が現にどのセレクタを使うか（併設で干渉しないこと）を実査で確認する。

---

## 4. 詳細仕様

### 4.1 test-id 命名規約（§3.3-1 で既存規約が無い場合の提案）

- **接頭辞 + フィールド名（kebab-case）** を基本とする。フィールド名は `BasicFieldsValue` のキー（＝`ComboResponse`/`CreateRequest` の camelCase）を kebab-case 化して用いる（機械変換で一意・表記変更に不変）。
- 提案する既定値（既存規約が無い場合。Plan Mode で確定）:
  - `combo-meta-damage`
  - `combo-meta-drive-available`（driveAvailableAtStart）
  - `combo-meta-sa-available`（saAvailableAtStart）
  - `combo-meta-knockdown-advantage`（knockdownAdvantage）
  - `combo-meta-memo`
  - `combo-meta-oki-meaty-neutral-tech-throw` / `…-throw-dr` / `combo-meta-oki-meaty-back-tech-throw` / `…-back-tech-throw-dr` / `combo-meta-oki-shimmy-neutral-tech` / `combo-meta-oki-shimmy-back-tech`
- **native select 4 件（v1.0.1 確定で対象）**（同規約）: `combo-meta-position` / `combo-meta-opponent-stance` / `combo-meta-hit-type` / `combo-meta-opponent-size`。**`driveDamage` は付与済みのため新規付与しない**（既存 test-id 名を実査で確認し、規約と齟齬があれば §11 で設計担当へ質問）。**`situation`・custom-state は据え置き（付与しない）**。
- **規約の一貫性**: 同一概念に異なる命名を混在させない（digest §7＝出力前セルフチェック）。付与は **input 要素（または操作可能なコントロール要素）** に対して行い、ラッパー div でなく E2E が値入力/トグルできる要素に置く。

### 4.2 付与方針（表示・挙動不変）

- `data-testid` の**追加のみ**。value/onChange/表示ラベル/バリデーション/レイアウトは一切変えない（純粋な属性付与）。
- 起き攻め6 のトグル（`*bool`。SUPP §2.7 で INTEGER NOT NULL DEFAULT 0 由来）は、**トグルの操作要素**（checkbox/switch 等・shadcn/ui 既存パターン＝playbook §4.6）に付与し、E2E が on/off を切り替えられるようにする。
- new/edit/copy モード（`ComboEditor` Props `mode`）で同一 test-id が使える（モード分岐で id を変えない＝安定性の要）。

### 4.3 既存 E2E の併設（v1.0.1 確定・§3.3-4）

- **併設**とする。既存 spec のメタデータ操作セレクタ（placeholder/getByText 等）は**そのまま不変**とし、source への `data-testid` 追加は純加算にとどめる（既存の通過を機械的に保証＝非回帰最優先）。
- 新規に **seed 非依存スモーク spec を 1 本**追加し、§4.1 の各 test-id が getByTestId で解決・操作できることを検証する（§5）。
- 既存 spec の getByTestId への**移行は本サブでは行わない**（将来のクリーンアップ余地。M15-02 以降で必要に応じ opportunistic に置換可）。

---

## 5. テスト要件

### 5.1 必須テスト（Vitest / E2E）— ケース数で語る

- **既存 E2E 非回帰**: `make e2e` で既存スイート（`combo-crud.spec.ts` 等）が全通過（test-id 移行/併設後も同一挙動）。
- **前提スモーク（E2E or Vitest）**: 新規登録画面（`/combos/new`）で、§4.1 の各 test-id が **DOM に存在し、値入力/トグル/選択できる**ことを確認する最小 spec（damage 入力・memo 入力・oki トグル各1・drive/sa/knockdown 入力・**native select 4 件〔position/opponentStance/hitType/opponentSize〕の選択**）。**ケース数**＝対象フィールド数分のセレクタ解決を確認（存在＋操作可能）。
- **注意（残渣非依存）**: 本スモークは **seed 非依存 self-contained**（新規作成画面のフォーム DOM を対象・既存コンボ seed に依存しない）。永続 dev DB 残渣（M14-6・combo-csv-io ken 依存等）に依存する spec は書かない。使い捨て DB 化（fe-e2e-throwaway-db）は本サブ対象外。

### 5.2 E2E シナリオ（seed 非依存）

- シナリオ: `/combos/new` を開く → 各メタデータ test-id を getByTestId で解決 → damage/drive/sa/knockdown に値入力・memo 入力・oki トグルを操作 → フォーム状態に反映される（送信までは本スモークの必須ではない・既存 combo-crud が送信経路を担保）。`make e2e` 既存 spec 非回帰。

---

## 6. レビュー観点（別ファイル参照）

機械レビューは `M15-01-review-checklist.md`（本指示書と対で設計担当が作成）に従う。

---

## 7. 完了条件（Definition of Done）

### 7.1 機能要件
- §1.1 の対象メタデータ入力（damage/drive/sa/knockdown/memo/起き攻め6）に、単一規約の `data-testid` が付与されている（§3.3-2 で拡張確定分を含む）。
- 表示・onChange 挙動・レイアウトが不変（test-id 付与のみ）。
- 既存 E2E がメタデータ操作を安定セレクタ（test-id）で行える。

### 7.2 自己テスト結果（製造担当の責任範囲）
- §5.1 の Vitest/E2E が全通過（ケース数で報告＝対象フィールド数分の test-id 解決）。

### 7.3 品質チェック
- `make e2e` 通過。既存 `combo-crud.spec.ts` 等が非回帰。API/データ契約（`ComboResponse` 等）に差分なし。表示の視覚差分なし。

### 7.4 ドキュメント
- 本サブは **DES 非対象**（CHANGE 起票なし）。test-id 命名規約を完了報告に記載（後続 M15 サブが参照）。**確定した命名規約は code-facts 再生成では捕捉されない**ため、完了報告に明記し、必要なら M15-overview §4.7 に注記追加（設計担当が自由改訂）。

### 7.5 完了報告
- Plan Mode の実査結果（#1 現行 test-id 被覆〔driveDamage の既存 test-id 名含む〕・#3 起き攻め6 DOM 構造・命名規約〔既存採用 or §4.1 提案採用〕）、**確定方針の反映**（対象＝全メタデータ〔11＋native select 4〕・既存 E2E＝併設）、付与フィールド一覧、テストケース数、既知の制約（fe-e2e 残渣根治はスコープ外）を報告。

---

## 8. 参照ドキュメント

| 文書（実パス） | 節 | 用途 |
|------|-----|------|
| code-facts `docs/handover/code-facts.md` | §1 / §3 / §7 / §8 | ComboEditorBasicFields Props・ルート・メタデータフィールド |
| M15-overview `docs/instructions/phase3/M15-overview.md` | §3 M15-01 / §4.7 | 本サブ位置づけ・fe-e2e 残渣切り分け |
| followup-backlog `docs/handover/followup-backlog.md` | §B F12-4 / §C M14-03a 報告 §4 | 出所・残渣根治（スコープ外） |
| DES-005 `docs/design/05-screen-design.md` | §5.18 / §5.6 相当 | メタデータ入力画面（参照のみ・改訂しない） |
| docs-map `docs/handover/docs-map.md` | §1 | 文書ID ⇄ 実パスの正（疑義時に引く） |

---

## 9. 注意事項・判断に迷ったら

### 9.1 推測で進めてはいけない事項
- 現行 test-id 被覆・命名規約・対象フィールド集合・既存 E2E セレクタの現況（§3.3-1〜4）: Plan Mode 確定前にコード化しない（現状を決め打ちしない＝digest M12-1/M12-3）。
- 既存 API/データ契約・メタデータ入力の表示/挙動の変更: 不可（本サブは test-id 付与のみ）。

### 9.2 推測で進めてよい事項（その旨を明示）
- test-id を付ける DOM 要素の選定（input/コントロール要素）・spec ファイルの分割は既存パターン（code-facts §1・既存 e2e 構成）に合わせ製造担当裁量。命名規約は §4.1 提案を既定とし、既存規約があればそちらを優先（§3.3-1）。

### 9.3 不明事項発見時の対応
- §3.3 以外の不明点は Plan Mode 質問書（playbook §8.4）で開発者へ。

### 9.4 Plan Mode で計画提示時に含めるべき項目
- §3.3 の **#1（現行 test-id 被覆の全数実査＝driveDamage の既存 test-id 名を含む）**・**#3（起き攻め6 の DOM 構造）**。**#2 対象スコープ（全メタデータ拡張）・#4 既存 E2E 方針（併設）は v1.0.1 で決定済み**（Plan Mode では実装詳細＝付与先要素の確定のみ）。

---

## 10. 完了後の次ステップ
- **M15-02**（info-mark ヘルプ機構）: 本 test-id を土台に、説明表示の E2E を追加できる。
- **M15-03**（入力方式＋コマンド解決 段階1）: 入力方式ボタン化の E2E で本 test-id を活用。
- model-allocation に M15-01 実績を追記（着手時・既に v1.26.0 で予定記入済み）。

---

*以上、M15-01 製造指示書 v1.0.1。配置 `docs/instructions/phase3/M15-01-metadata-testid.md`。本サブは DES 非対象（CHANGE なし）・純 FE・M15 E2E 拡充の前提タスク。v1.0.1 で Plan Mode 決定（対象＝全メタデータ拡張・既存 E2E＝併設）を反映。*
