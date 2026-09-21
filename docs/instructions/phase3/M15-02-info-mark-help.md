# 指示書 M15-02: info-mark ヘルプ機構（⑤⑩）＋「比較対象選択」ボタン改称（③）

| 項目 | 内容 |
|------|------|
| 指示書ID | M15-02 |
| バージョン | 1.1.0 |
| 推奨モデル | Sonnet 4.6（FE 中心・自由改訂系 UI。関心数小〜中。§7・model-allocation v1.26.0 参照） |
| Plan Mode | **必須（軽量）**（§3.3。#4 適用範囲＝③⑤のみ・検証方法〔③E2E/⑤Vitest〕は**決定済み**〔v1.1.0〕。残る実査は既存ヘルプ UI 有無・選択モードの実在箇所/比較専用性・modifier 付与先・DES-005 CHANGE 要否） |
| 機械レビュー | 必須（別チェックリスト: `M15-02-review-checklist.md`） |
| 並列性 | M15-01 後（test-id 土台）。M14 と並行可 |
| 依存 | M15-01（メタデータ test-id・`combo-editor-*` 規約＝M15-overview §4.7.1）。friend FB ③⑤⑩ |
| 想定所要時間 | 120〜210 分（info-mark 機構＋⑤適用＋③改称＋説明文＋test-id＋テスト） |
| 作成者・作成日 | 設計担当 Claude（フェーズ3 継続担当・M15 期）/ 2026-07-02 |

## 更新履歴

| 版 | 更新日 | 更新内容 |
|----|--------|----------|
| 1.0.0 | 2026-07-02 | 初版。M15-overview v1.0.0 §3 M15-02・friend FB ③⑤⑩（info-mark ヘルプ機構）。 |
| 1.1.0 | 2026-07-02 | **③ の対処を info-mark → ボタン改称（「選択モード」→「比較対象選択」）へ変更**（開発者判断＝ラベル曖昧性の根治。info-mark は ⑤ のみへ適用）。Plan Mode 決定を反映: (1) **適用範囲＝③⑤のみ**（他項目網羅は後続へ切り分け・§3.3-4）、(2) **検証＝③ 選択モード E2E ＋ ⑤ modifier Vitest**（レシピ E2E は move セレクタ test-id 不在で脆いため・§5）。§3.3-2 に「選択モードの比較専用性の実査」を追加。 |

---

## 1. 背景と目的

### 1.1 背景

- friend FB 第一波（followup-backlog §A）で「**説明がなく迷う**」系が複数挙がった: **③「選択モード」ボタンが説明なしで不明**、**⑤ modifier 関連が説明なしで迷う**、**⑩ info-mark で項目説明を出す機構が欲しい**。⑩ が機構、⑤ がその適用先。
- **③ の対処は info-mark でなく「比較対象選択」への改称**（開発者判断 2026-07-02）。「選択モード」というラベルの曖昧さが根因のため、自己説明的なラベルに改称して根治する（info-mark は不要）。**前提＝当該選択モードが「比較対象の選択」専用であること**を Plan Mode §3.3-2 で実査確認（一括削除/タグ等の汎用マルチセレクトを兼ねる場合は名称再考）。
- **⑤ modifier は info-mark で説明**する。modifier は概念説明が要る（改称では解けない）ため、横断的な **info-mark ヘルプ機構（⑩）を新設**し ⑤ へ適用、以後の項目説明もこの機構に載せる。
- modifier UI の実体は **`ModifiersEditor`**（`web/src/features/combo/components/ModifiersEditor.tsx`・Props `open`/`step`/`stepIndex`/`movesById`/`onSave`/`onOpenChange`＝code-facts §1）。「選択モード」ボタンの実在箇所は code-facts §1 に現れず＝**Plan Mode で実査特定**（コンボ一覧＋マイコンボの一括選択導線の疑い・2 箇所）。
- **本サブは純 FE・データ/API 契約不変**（`ComboResponse` 等に触れない）。DES-005（表示機構・ラベル）に軽微 CHANGE の可能性（§3.3-5・着手時 view で確定）。

### 1.2 目的

完了時に達成される状態:

- **③「選択モード」ボタンが「比較対象選択」へ改称**され、ラベルだけで用途が分かる（「説明なしで迷う」の根治。info-mark 不要）。コンボ一覧・マイコンボの両箇所を改称。
- **再利用可能な info-mark ヘルプ機構**（ⓘ アイコン＋Tooltip/Popover で日本語の説明文を表示）が導入され、**⑤ modifier UI** に適用されて説明が表示される。
- 機構・説明・test-id が既存パターン（shadcn/ui・i18n・`combo-editor-*` test-id 規約＝M15-overview §4.7.1）に整合する。
- 既存 E2E が非回帰で、③ 改称（実画面 E2E）・⑤ info-mark（Vitest）を検証する。

### 1.3 このマイルストーンで作らないもの（スコープ外）

- **M16 依存の表記ラベル**（技/非技⑥・ドライブ/SA 始動明示⑨⑪⑬）= **M15-07（M16 完了後）**。info-mark の説明文でも「始動 vs 消費」等のモデル確定前の説明は書かない（誤説明防止）。
- **入力方式のボタン化・コマンド解決**（M15-03）／**タグ色**（M15-04）／**表示整理・比較バグ**（M15-05）／**オンボーディング・上級者モード**（M15-06）。
- **全 UI 項目への info-mark 網羅適用**。本サブは**機構の新設＋⑤の適用＋③の改称**まで（他項目への info-mark 展開は §3.3-4 決定＝後続サブ or opportunistic）。
- データ/API 契約（`ComboResponse` 等）の変更。moves 取込（削除済み）。英語ロケール（日本語説明のみ）。

---

## 2. 成果物

### 2.1 作成/修正するファイル（想定パス。実配置は既存構成 code-facts §1 に合わせる）

| ファイル | 内容 |
|---|---|
| 「選択モード」ボタンの実在コンポーネント（コンボ一覧＋マイコンボ・Plan Mode §3.3-2 で特定） | **ラベルを「比較対象選択」へ改称**（③）。文言は i18n 既存キー体系に整合（§3.3-1） |
| `web/src/components/`（共通）or `web/src/features/*/components/` に info-mark 機構 | 再利用可能な `InfoMark`（仮称）コンポーネント（ⓘ アイコン＋Tooltip/Popover・説明文＋test-id）。**shadcn/ui 既存の Tooltip/Popover を流用**（Plan Mode §3.3-1 で有無確認・無ければ shadcn 追加） |
| `web/src/features/combo/components/ModifiersEditor.tsx`（＋ modifier 起動/表示導線） | info-mark 付与＋説明文（⑤） |
| 説明文の定義（i18n or 定数。Plan Mode §3.3-1 で既存パターン確認） | ⑤ modifier の日本語説明文＋③改称ラベル（既存 i18n キー体系に整合・命名衝突回避＝digest §4） |
| `web/e2e/`（③改称の実画面 spec）＋ Vitest（⑤ info-mark） | §5 |

### 2.2 変更しないもの（原則）

- データ/API 契約（`ComboResponse`/`CreateRequest` 等＝code-facts §7）。
- 既存の入力挙動・レイアウト（info-mark は**付加**で、既存操作を妨げない）。
- M15-01 の test-id（`combo-editor-*`＝M15-overview §4.7）。info-mark の test-id はこれと衝突しない別系統（例 `info-mark-<topic>`・Plan Mode で確定）。
- 他 M15 サブの対象・DES 本体（CHANGE は設計担当が別途）。

### 2.3 例外条項

- 既存に**ヘルプ/説明表示の UI パターン**（Tooltip/Popover 等）があれば、**新設せずそれを流用**する（自作再発明しない＝playbook §4.6）。Plan Mode §3.3-1 で確認。
- 説明文の i18n キー・命名は**既存キーの占有調査後**に決める（「situation/状況」等が独立占有されていた M11-4 の再発防止＝digest §4）。

---

## 3. 前提条件

### 3.1 必読ドキュメント

> **文書ID ⇄ 実パスの正は `docs/handover/docs-map.md`（自動生成）**。疑わしい場合は docs-map を引く（記憶で書かない・retrospective-digest §0）。

- **code-facts**（`docs/handover/code-facts.md`）§1（`ModifiersEditor` Props・共通コンポーネント）/§6（共通ナビ）。
- **M15-overview**（`docs/instructions/phase3/M15-overview.md`）§3 M15-02・**§4.7（M15-01 test-id 規約 `combo-editor-*`）**・§4.3（info-mark の全表示箇所調査＝digest M12-2）。
- **DES-005**（`docs/design/05-screen-design.md`）§5.6/§5.8 相当（項目表示・説明の該当画面）。**改訂は設計担当が CHANGE で対応・製造は直接編集しない**。
- **followup-backlog**（`docs/handover/followup-backlog.md`）§A ③⑤⑩。
- **architecture-patterns**（`docs/handover/architecture-patterns.md`）§1.1（queryKey・該当なければ不要）・shadcn/ui 既存パターン（§該当）。

### 3.2 参照不要

- moves 取込（削除済み）／export/import／コマンド解決（M15-03）／M16 データモデル／英語ロケール／DES 本体の改訂。

### 3.3 着手前の確認（Plan Mode 必須・§9.4 と対応）

実装着手前に Plan Mode で開発者へ提示し確定する（推測で進めない・現状を決め打ちしない＝digest M12-1/M12-3/§4 占有調査）:

1. **既存ヘルプ/説明 UI・shadcn プリミティブの有無**: Tooltip/Popover/HoverCard 等が既存 component set にあるか、既存の説明表示パターン（title 属性・aria 等）があるかを grep 全数確認。**あれば流用・無ければ shadcn 追加**（自作再発明しない＝playbook §4.6）。説明文の**既存 i18n キー体系**（キー命名・占有状況）も確認（digest §4）。
2. **「選択モード」ボタンの実在箇所・比較専用性**（FB③）: code-facts に出ないため実査で特定（**コンボ一覧＋マイコンボの 2 箇所**の疑い）。**当該選択モードが「比較対象の選択」専用か**を実査確認（一括削除/タグ等の汎用マルチセレクトを兼ねる場合は「比較対象選択」名が不正確＝名称再考して開発者へ §11 で確認）。専用なら両箇所を改称。
3. **modifier UI の説明付与先**（FB⑤）: `ModifiersEditor`（ダイアログ）本体か、modifier を起動/表示する導線（RecipeBuilder のステップ modifier 表示・編集ボタン等）か、両方かを実査で確定（info-mark の配置先）。
4. **適用範囲＝決定済み（v1.1.0）**: **③⑤ のみ**（③＝改称・⑤＝info-mark）。他項目（メタデータ・custom-state・起き攻め等）への info-mark 網羅は**後続サブへ切り分け**（playbook §4.11 将来送りの帰結明記）。Plan Mode では実装詳細のみ扱う。
5. **DES-005 CHANGE 要否**: info-mark が DES-005 の画面仕様（表示要素）に該当する新規機構なら、**CHANGE（採番 056〜）要否を着手時 view で判定**。純 UX の付加で画面仕様を変えない範囲なら CHANGE 不要（自由改訂）。要すれば**設計担当が起票**（製造は DES を直接編集しない）。

---

## 4. 詳細仕様

### 4.1 info-mark 機構コンポーネント（⑩）

- **再利用可能な `InfoMark`（仮称）**: ⓘ アイコン（shadcn/ui のアイコン・既存アイコン規約に合わせる）を表示し、**クリック/ホバーで説明文を表示**（Tooltip か Popover は §3.3-1 の既存パターンに合わせて選定。モバイル LAN 利用があるためタップで開く挙動を確認＝arch §10 LAN/モバイル制約）。
- Props（最小・YAGNI＝digest §3）: 説明文（text or i18n キー）＋ 任意の aria-label / test-id。表示専用で、押下しても既存操作に副作用を与えない。
- **test-id**: `info-mark-<topic>`（⑤＝`info-mark-modifier`。**③ は改称のため info-mark test-id を持たず、既存の選択モードボタン test-id を温存**）。M15-01 の `combo-editor-*` と別系統で衝突しない（M15-overview §4.7.1 参照）。命名規約を完了報告に記載（後続参照）。

### 4.2 説明文（日本語・モデル確定前の説明は書かない）

- **⑤ modifier（info-mark 説明文）**: 「modifier とは何か・どう使うか」を平易な日本語で。
- **③ 選択モード（改称ラベル）**: 「選択モード」→「**比較対象選択**」。i18n 既存キーの値を改称（キー命名は既存体系に従い、占有調査後＝digest §4）。
- **M16 依存の概念（始動 vs 消費・技/非技 taxonomy）に踏み込む説明は書かない**（M16 確定前＝誤説明防止・M15-07 で対応）。
- 説明文・ラベルは既存 i18n パターンに載せる。**i18n キー追加時は ja/en 両ロケール必須**（`locales.test.ts` が ja↔en キー parity を機械強制するため。英訳は文言品質を問わず仮英訳可＝「英語ロケール除外」ではなく「英訳品質は問わないが両ロケール必須」が正確）。日本語文言を主とし、英訳は parity 充足のため投入する。

### 4.3 適用（③ 改称・⑤ info-mark）

- **③（改称）**: 「選択モード」ボタン（§3.3-2 で特定・コンボ一覧＋マイコンボ 2 箇所）のラベルを「**比較対象選択**」へ改称。**info-mark は付けない**。既存の選択モード動作・test-id・導線は不変（ラベル文言のみ変更）。
- **⑤（info-mark）**: modifier UI（`ModifiersEditor` ＋起動導線・§3.3-3 で確定）に info-mark を配置し modifier の説明を表示。
- いずれも既存レイアウト・操作を妨げない付加/改称にとどめる（非破壊）。

---

## 5. テスト要件

### 5.1 必須テスト（Vitest / E2E）— ケース数で語る（v1.1.0 決定＝③E2E ＋ ⑤Vitest）

- **③ 選択モード改称（E2E・seed 非依存 self-contained）**: コンボ一覧＋マイコンボで**ボタンラベルが「比較対象選択」**であり、押下で比較対象選択モードが従来どおり機能する（既存導線非回帰）。実画面で堅牢に検証。
- **⑤ modifier info-mark（Vitest）**: **`ModifiersEditor` を props で直接描画**し、info-mark（ⓘ）表示・クリック/ホバーで説明表示・test-id 解決・押下で副作用なしを検証。**レシピ手順を E2E で組む方式は採らない**（move セレクタに test-id が無く脆い・前例なし＝意図的に §5.2 のフル E2E から逸脱）。
- **InfoMark 単体（Vitest）**: 機構コンポーネントの表示・開閉・test-id。
- **既存 E2E 非回帰**: `make e2e` で既存スイート（`combo-crud` 等）が全通過（改称・info-mark 付加が既存操作を壊さない）。

### 5.2 E2E シナリオ（seed 非依存・③ のみ）

- シナリオ: コンボ一覧（＋マイコンボ）を開く → ボタンが「比較対象選択」表示 → 押下 → 比較対象選択モードが従来どおり動作。`make e2e` 既存 spec 非回帰。**⑤ modifier の info-mark は E2E でなく Vitest で担保**（上記 §5.1）。

---

## 6. レビュー観点（別ファイル参照）

機械レビューは `M15-02-review-checklist.md`（本指示書と対で設計担当が作成）に従う。

---

## 7. 完了条件（Definition of Done）

### 7.1 機能要件
- **③**「選択モード」ボタンがコンボ一覧・マイコンボで「比較対象選択」へ改称され、既存動作は不変。
- **⑤** 再利用可能な info-mark 機構が導入され、modifier UI に適用されて説明が表示される。
- 機構が shadcn/ui 既存パターン（Tooltip/Popover）に整合し、自作再発明でない。
- 表示・既存操作が非破壊（改称はラベルのみ・info-mark は付加のみ）。

### 7.2 自己テスト結果（製造担当の責任範囲）
- §5.1 の Vitest/E2E が全通過（ケース数で報告）。

### 7.3 品質チェック
- `make e2e` 通過。既存 spec 非回帰。API/データ契約に差分なし。

### 7.4 ドキュメント
- DES-005 CHANGE 要否（§3.3-5）の判定結果を完了報告に記載。**要の場合は設計担当が起票**（製造は DES を直接編集しない）。
- info-mark の test-id 命名規約（`info-mark-<topic>`）・適用範囲（③⑤＋展開分）を完了報告に明記（後続 M15 サブ参照・code-facts 再生成では捕捉されない）。

### 7.5 完了報告
- Plan Mode で確定した方式（既存ヘルプ UI 流用 or shadcn 追加・選択モード実在箇所・modifier 付与先・適用範囲・i18n キー・DES-005 CHANGE 要否）、適用箇所一覧、テストケース数、既知の制約を報告。

---

## 8. 参照ドキュメント

| 文書（実パス） | 節 | 用途 |
|------|-----|------|
| code-facts `docs/handover/code-facts.md` | §1 / §6 | ModifiersEditor Props・共通コンポーネント・ナビ |
| M15-overview `docs/instructions/phase3/M15-overview.md` | §3 M15-02 / §4.3 / §4.7 | 本サブ位置づけ・全表示箇所調査・test-id 規約 |
| DES-005 `docs/design/05-screen-design.md` | §5.6 / §5.8 相当 | 項目表示・説明画面（参照。改訂は設計担当 CHANGE） |
| followup-backlog `docs/handover/followup-backlog.md` | §A ③⑤⑩ | 出所 |
| architecture-patterns `docs/handover/architecture-patterns.md` | §10 | LAN/モバイル制約（タップ挙動） |
| docs-map `docs/handover/docs-map.md` | §1 | 文書ID ⇄ 実パスの正（疑義時に引く） |

---

## 9. 注意事項・判断に迷ったら

### 9.1 推測で進めてはいけない事項
- 既存ヘルプ UI/shadcn プリミティブの有無・i18n キー占有（§3.3-1）・選択モード実在箇所（§3.3-2）・modifier 付与先（§3.3-3）・適用範囲（§3.3-4）・DES-005 CHANGE 要否（§3.3-5）: Plan Mode 確定前にコード化しない（digest M12-1/M12-3/§4）。
- 既存 API/データ契約・既存操作挙動の変更: 不可（info-mark は付加のみ）。
- M16 依存の概念（始動 vs 消費・技/非技）に踏み込む説明文: 書かない（M16 確定前）。

### 9.2 推測で進めてよい事項（その旨を明示）
- InfoMark の内部実装・アイコン選定・Tooltip/Popover いずれか（§3.3-1 の既存パターンに合わせ製造裁量）。説明文の具体文言（平易・日本語・モデル未確定概念を避ける範囲で裁量）。spec 分割は既存構成に合わせ裁量。

### 9.3 不明事項発見時の対応
- §3.3 以外の不明点は Plan Mode 質問書（playbook §8.4）で開発者へ。

### 9.4 Plan Mode で計画提示時に含めるべき項目
- §3.3 の **#1（既存ヘルプ UI/shadcn・i18n キー占有）**・**#2（選択モード実在箇所〔コンボ一覧＋マイコンボ〕・比較専用性）**・**#3（modifier 付与先）**・**#5（DES-005 CHANGE 要否）**。**#4 適用範囲（③⑤のみ）・検証方法（③E2E/⑤Vitest）は v1.1.0 で決定済み**（Plan Mode では実装詳細のみ）。

---

## 10. 完了後の次ステップ
- **M15-03**（入力方式＋コマンド解決 段階1＋必殺技直接指定 UI 骨格）: info-mark を入力方式の説明に活用可。
- **M15-07**（M16 依存表記）: 始動/消費・技/非技の説明文を info-mark に載せる（M16 完了後）。
- DES-005 CHANGE（info-mark が画面仕様に該当する場合）: 設計担当が起票。
- model-allocation に M15-02 実績を追記（着手時・既に v1.26.0 で予定記入済み）。

---

*以上、M15-02 製造指示書 v1.1.0。配置 `docs/instructions/phase3/M15-02-info-mark-help.md`。③＝「比較対象選択」へ改称（info-mark 不要）・⑤＝info-mark（機構⑩＋Vitest 検証）。DES-005 CHANGE 要否は着手時 view 確定。*
