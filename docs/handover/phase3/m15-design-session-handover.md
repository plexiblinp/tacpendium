# M15 期間 設計セッション継承資料（m15-design-session-handover）

| 項目 | 内容 |
|------|------|
| 文書ID | M15-DESIGN-SESSION-HANDOVER |
| バージョン | 1.0.0 |
| 作成日 | 2026-07-03 |
| 作成者 | 設計担当 Claude（M15 期・前セッション） |
| 対象読者 | 設計担当 Claude（M15 期・新セッション） |
| 用途 | M15（入力・使いやすさ向上＋コマンド入力解決 段階1）の設計セッションを **M15-02 完了後・M15-03 着手前**で分割継承する（前セッションのコンテキスト圧迫回避＋M15-03＝M15 の主眼で新鮮なコンテキスト推奨）。新セッションは **M15-03 指示書作成から着手**する。※本セッションは M15 着手準備に加え**フェーズ3 マイルストーン再編（phase3-overview v1.1.0）**も実施済み |
| 性質 | m12/m7-design-session-handover.md と同型（実装サブ着手前での分割）。**標準ドキュメント（DES 各本体・registry・code-facts・恒久資料）は開発者が最新版を別途添付**するため、本書は **M15 固有の状態・確定判断・設計メモ**に絞る |

---

## 0. 新セッション開始時の最優先作業

1. **受領確認**: 開発者から「開始時 PASTED プロンプト＋最新添付資料一式＋『M15-03 から再開』」が渡される。添付の現行版を正本として扱う（§5 のバージョンと突合）。特に **retrospective-log は起動時未投入が基本**（必要時に開発者が投入）。
2. **現状認識を 1 メッセージで共有**（§1）。
3. **M15-03 指示書＋レビューチェックリスト作成に着手**（§3.1）。開発者の追加指示が無ければ直接着手。
4. M15-03 着手前に **§6 の開発者確認**（DES-005 CHANGE 要否の追認・「英語ロケール除外」文言是正）と **§3.1 の勘所**（コマンド解決 段階1 の非スキーマ性・RecipeBuilder test-id 前提作業）を確認。

---

## 1. M15 完了状態と現況

### 1.1 完了済み（設計・実装・レビュー）
- **M15-01（メタデータ安定 test-id）完了**（2026-07-02）。指示書 v1.0.1・チェックリスト v1.0.1。実装は既存規約 **`combo-editor-<field>`** に整合（§2）。レビュー重大 0 件。**DES 非対象・CHANGE なし**。
- **M15-02（info-mark ヘルプ機構⑤⑩＋「比較対象選択」改称③）完了**（2026-07-03）。指示書 v1.1.0・チェックリスト v1.1.0。レビュー重大 0 件。**DES-005 CHANGE 要否は開発者確認待ち**（§6-1・製造は不要判定）。
- **フェーズ3 再編完遂**: `phase3-overview` **v1.1.0**（コマンド解決の M15/M17/M21 分配・§2.4 スキーマ承認ゲート G-a〜G-k・M18 の materialize 転換/補正則正確化/is_projectile 確定）。`model-allocation` **v1.26.0**（M15 配分）。
- **CHANGE**: M15-01 は起票なし（DES 非対象）。**M15-02 は CHANGE-056 を起票・反映**（DES-005 v2.31.0＝③改称・⑤ info-mark の正典化・三点セット）。**次 CHANGE 番号 = 057**（欠番 008/009/014）。NFR406 移設 CHANGE は M18 着手前（phase3-overview §2.1）。

### 1.2 残作業
- **M15-03**（入力方式＋コマンド解決 段階1＋必殺技直接指定 UI 骨格）: **新セッション最優先**。§3.1。
- **M15-04**（タグ色選択 UI）/ **M15-05**（表示整理・比較画面生 ID バグ）/ **M15-06**（オンボーディング・上級者モード）: §3.2〜3.4。
- **M15-07**（M16 依存表記 ⑥⑨⑪⑬）: **M16 完了後**。§3.5。
- **M15 完了処理**: retrospective-log §6.6.8（M15-1/M15-2 前倒し記録済み）を M15 完了時に確定、一時ノートの残りを転記。

### 1.3 教訓・申し送りメモの扱い（重要）
- **一時ノート `m15-session-notes.md`・製造申し送り `M15-01-handover-to-design.md`/`M15-02-handover-notes.md` は tmp（非永続・gitignore）**。恒久反映は下記へ完了済み:
  - **retrospective-log §6.6.8**（M15-1 命名規約・M15-2 英語ロケール parity を**前倒し記録**・v1.0.44）。M15 完了時に確定。**digest 再蒸留は開発者が `/retrospective-digest-update` 実行**（設計担当は log のみ更新）。
  - **followup-backlog**（§B F12-4 完了マーク／§E に E2E timing flake・memo 移行候補・RecipeBuilder test-id 前提を追記）。
  - **M15-overview §4.7.1**（確定 test-id 規約 `combo-editor-*`）。

---

## 2. M15 で確定した重要判断（再協議不要）

- **サブ分割 M15-01〜07 承認済み**（2026-07-02・playbook §4.12）。連番・実装順は M15-overview §3。
- **test-id 規約 = `combo-editor-<field>`**（M15-overview §4.7.1）。**起き攻め6 は camelCase 無変換**（`combo-editor-okiMeatyNeutralTechThrow` 等）。**`situation` は独立 test-id を付けない**（`buildSituation()` の合成 JSON＝custom-state test-id を使う）。native select 値コードは `web/src/features/combo/labels.ts`。
- **③ = 「比較対象選択」への改称**（info-mark 廃止・ラベル曖昧性の根治）。前提＝当該選択モードが比較専用（実査確認）。**info-mark を付けない・既存ボタン test-id 温存**。
- **⑤ info-mark = 最終 3 配置**（製造申し送り §6・開発者 FB で 3 転した最終形）:
  | 画面 | 位置 | topic / i18n | 表示条件 |
  |---|---|---|---|
  | コンボ編集（`RecipeBuilder`） | 「編集ボタンについて」見出し横 | `recipe-modifier` / `help.recipeModifier` | steps>0 |
  | セットプレイ編集（`SetupRecipeEditor`） | 同上 | `setup-recipe-modifier` / `help.recipeModifier`（共用） | steps>0 |
  | 編集ダイアログ（`ModifiersEditor`） | タイトル横 | `modifier` / `help.modifier` | ダイアログ open 時 |
  - **topic 分離の理由**＝同画面で同時 DOM 存在し得るため test-id 衝突回避。**Popover 採用**（Tooltip は未マウント。**将来 Tooltip を使うなら先に `TooltipProvider` をルート付近へマウント必須**＝製造申し送り §1-1 の地雷）。
- **Q1**（info-mark 適用範囲）= **③⑤ のみ**。**Q2**（⑤ 検証）= **③ 実画面 E2E ＋ ⑤ Vitest**（レシピ E2E は RecipeBuilder に test-id 不在で脆いため）。
- **i18n キーは ja/en 両ロケール必須**（`locales.test.ts` の parity テスト）。「英語ロケール除外」は誤り＝英訳品質は問わないが両ロケール必須（§4・M15-2 教訓）。
- **コマンド入力解決の配置**（phase3-overview §2.3）= 段階1→M15／段階2→M17（取込ヘルパーと共通）／物理→M21。死守契約 3 点（公式表記のみ・モーション解析しない・出口は `move_code`）。**command 源は M14-01 で除去済み＝取込ヘルパー経由で再確立**（G-k・M17）。
- **§6 スキーマ承認ゲート**（phase3-overview §2.4）= G-a〜G-k。recovery（G-a）は M14 充足。**is_projectile は M18 で G-b と同時追加確定**（2026-07-02）。

---

## 3. 残サブの設計メモ

### 3.1 M15-03（入力方式＋コマンド解決 段階1＋必殺技直接指定 UI 骨格）— 新セッション最優先
- **スコープ**: FB④（プルダウン→ボタン）＋コマンド解決 段階1（しゃがみ/ジャンプ攻撃を `move_code` 構造〔`crouching_*`/`jumping_*`〕から決定論引き当て・**非スキーマ**）＋必殺技＝直接指定の UI 骨格（形式委譲・**モーション解決しない**）。ISSUE-002（modifier 専用ボタン化）整合。
- **勘所（最重要）**:
  1. **RecipeBuilder/move セレクタに test-id が無い**＝レシピ系 E2E が脆い（M15-02 で ⑤ を Vitest 担保にした理由）。**M15-03 で RecipeBuilder を触るついでに `recipe-*` 系 test-id を付与**（M15-01 の `combo-editor-*` と同系統）すると、ModifiersEditor/レシピ系 E2E の前提が整う（followup §E 記録）。**この前提作業を M15-03 のスコープに含めるか**を着手時に開発者確認。
  2. **DES-004（move_code 引き当て・表記正典）/ DES-005（入力 UI）に軽微 CHANGE 見込み**。要否は着手時 view で確定・要すれば CHANGE-056 系で設計担当が起票（製造は DES 直接編集しない）。
  3. **段階2（単方向特殊技）・command 源は M17**（本サブ非対象）。段階1 は command 非依存で先行可。
  4. 必殺技直接指定の UI 形式（必殺技ボタン＋強度／ピッカー等）は委譲だが、**仮想で 236 を実演させない**一点は死守。
- **推奨モデル**: Sonnet 4.6 基本だが、**コマンド解決 段階1 は新規決定論ロジック**のため着手時 Plan Mode で複雑度を判断し **Opus 格上げの余地**（model-allocation M15-03）。

### 3.2 M15-04（タグ色選択 UI）
- FB⑭⑮。**着手前に `tags` の色保持形態を code-facts/実コードで確認**（非スキーマなら UI のみ・データ構造変更が要れば §2.4 ゲート判定＝digest M12-1）。Sonnet 4.6。

### 3.3 M15-05（表示整理・縦スクロール軽減＋比較画面生 ID バグ）
- FB①②。**②「始動技#196」生 ID バグは着手前に実画面/実コードで真因特定**（症状のレイヤ≠真因のレイヤ・F12-2 連動・digest M12-1/M10-4）。名称解決経路（一覧/比較/詳細で共有）を grep 全数特定してからスコープ確定。Sonnet 4.6（②真因次第で Opus）。

### 3.4 M15-06（初回オンボーディング＋上級者モード）
- FB⑯⑰。**⑰上級者モードの永続化スコープ**（表示制御 vs 設定永続化）を CLAUDE.md §10.X・Settings 構造で着手前確認（横断要件の取りこぼし防止＝digest §1-E）。暫定＝セッション内表示制御。Sonnet 4.6。

### 3.5 M15-07（M16 依存表記 ⑥⑨⑪⑬）— M16 完了後
- 技/非技ラベル（M16④ taxonomy 後）・ドライブ/SA 始動明示（M16① 後）。M15 期内で未完なら残件明示（M16 のラベル rollout へ移す選択肢＝M15-overview 確認事項5）。Sonnet 4.6。

---

## 4. 本セッション固有の運用ルール

- **出力前チェック必須**: 簡体字検査＋禁則表現 grep（「あれば/必要に応じて/動作するはず」等→playbook §4.2 言い換え）。
- **確認事項は成果物末尾に集約**（番号付き・何を/なぜ/暫定案）。
- 設計担当は **DES 本体を CHANGE 経由で改訂**、製造担当は DES を直接編集しない。**git/commit/push は開発者専任**。
- **CHANGE 対象 = REQ-001＋DES-001〜006 のみ**。「念のため起票」は playbook §16.4.4 違反として回避（digest §6）。
- **i18n を触る指示では「英語ロケール除外」と書かない**＝`locales.test.ts` の parity で ja/en 両ロケール必須（英訳品質は問わない・仮英訳可）。M15-2 教訓＝**指示書テンプレの定型文言を是正する**（§6-2）。
- retrospective-log はトークン重く起動時未投入が基本。教訓は M15 完了時に §6.6.8 を確定・digest 再蒸留は開発者。
- コンテキスト評価は限界が近い/重い作業の後に自己観察（本セッションは再編＋M15-01/02 で分割）。

---

## 5. 関連ドキュメント（現行版・開発者が最新を添付）

| 種類 | ファイル | 現行版 |
|------|---------|--------|
| フェーズ3 正本 | `docs/instructions/phase3-overview.md` | **v1.1.0**（再編第二波反映） |
| M15 正本 | `docs/instructions/phase3/M15-overview.md` | **v1.1.0**（§4.7.1 test-id 規約） |
| モデル配分 | `docs/handover/model-allocation.md` | **v1.26.0**（M15 配分） |
| 採番管理 | `docs/handover/change-number-registry.md` | **次番号 057**（v1.44.0・056 は M15-02 で消化。欠番 008/009/014） |
| 反省記録 | `docs/handover/retrospective-log.md` | **v1.0.44**（§6.6.8 M15 前倒し記録） |
| 後続課題 | `docs/handover/followup-backlog.md` | M15 反映済み（§B F12-4 完了・§E flake/memo/recipe test-id） |
| 画面設計 | `docs/design/05-screen-design.md` | **DES-005 v2.31.0（第42版・CHANGE-056）**＝③改称・⑤ info-mark 正典化 |
| 内部表現 | `docs/design/04-notation-spec.md` | DES-004 現行版（M15-03 で軽微 CHANGE 見込み） |
| 恒久資料（playbook） | `docs/handover/design-instruction-playbook.md` | **v1.12.0**（§4.13 i18n キー追加指示の書き方を新設） |
| 機械的事実 | `docs/handover/code-facts.md` | 最新（開発者添付） |
| 完了済み成果物 | M15-01 指示書 v1.0.1＋チェックリスト v1.0.1／M15-02 指示書 v1.1.0＋チェックリスト v1.1.0 | 参照 |
| 恒久資料 | playbook / retrospective-digest / architecture-patterns / code-facts / docs-map / CLAUDE.md | 各最新 |
| 様式参考 | `m12-design-session-handover.md` / `m7-design-session-handover.md` | セッション継承様式 |

---

## 6. 開発者への申し送り（継承時の確認）

> **状態（2026-07-03 更新）**: 前セッションの申し送り 1〜3 は本セッション内で処理済み。4〜5 のみ残る。

1. **③④⑤ の DES-005 正典化＝処理済み**（CHANGE-056）。開発者判断で「可視ラベル/ヘルプ要素を画面仕様の一部として正典化」とし、**三点セット**（通知書 `CHANGE-056-notification.md`＋改訂 **DES-005 v2.31.0**〔§5.6 改称・§5.7 レシピ見出し info-mark・§6.7 ダイアログ info-mark〕＋`CHANGE-056-change-report.md`）で処理。registry は 056 消化・**次 057**。※後続チャットへの手本として意図的に三点セットで実施。
2. **「英語ロケール除外」文言の是正＝処理済み**（playbook **§4.13** 新設・v1.12.0）。i18n キー追加は ja/en 両ロケール必須（parity）・「英語ロケール除外」と書かない。M15-03 以降の i18n 全サブに適用。M15-02 §4.2 も是正済み。
3. **§6 ⑤ 追加分の再レビュー＝不要**（開発者が手動 E2E で確認済み・2026-07-03）。fresh 再レビューは実施しない。
4. **M15-03 着手タイミング**: M15-03 は**別チャットへ引き継ぐ**（本セッションは items 1〜3 処理まで）。新セッションは §0 に従い M15-03 指示書作成から着手。
5. **M15-01/02 のコミット運用**: 開発者側でコミット（本セッション成果物＝CHANGE-056 三点セット・改訂 DES-005・playbook・registry・handover 等）。製造の docs コミット巻き込みは開発者側で調整。

---

*以上、M15 期間 設計セッション継承資料 v1.0.0。配置 `docs/handover/phase3/m15-design-session-handover.md`。新セッションは §0 に従い M15-03 指示書作成から着手する。*
