# M13-01 レビューチェックリスト

| 項目 | 内容 |
|------|------|
| 対象指示書 | `docs/instructions/phase3/M13-01-combo-csv-export-import.md` v1.0.0(FR401/405 コンボ CSV エクスポート/インポート・案A) |
| 対象指示書ID | M13-01 |
| レビューモデル | Sonnet 4.6(model-allocation 参照。実使用は開発者判断) |
| バージョン | 1.0.1 |
| 作成者・作成日 | 設計担当 Claude(フェーズ3 キックオフ担当)/ 2026-06-28 |

> **文書ID ⇄ 実パスの正は `docs/handover/docs-map.md`(自動生成)**。本書は docs-map 準拠の実パスを併記する。

## 更新履歴

| 版 | 更新日 | 更新内容 |
|----|--------|----------|
| 1.0.0 | 2026-06-28 | 初版(指示書 v1.0.0 と対)。 |
| 1.0.1 | 2026-06-28 | 指示書 v1.0.1 に追従。重複動作を **skip(既定)+新規追加の 2 択**(上書きは本サブ非対象)、export 配送を **ZIP 1 ファイル(in-memory・サーバ FS 非書込)**、import の zip 受理に更新。§9 重大に「上書きをスコープ外実装」「サーバ FS 書込でユーザ入力パス流入」を追加。 |

---

## 0. レビュー担当への前置き

### 0.1 レビュー前の準備

- 必読: `docs/instructions/phase3/M13-01-combo-csv-export-import.md` v1.0.0、DES-002(`docs/design/02-architecture.md`)§4.2/§7.x(CHANGE-050 反映後)/§7.4、DES-005(`docs/design/05-screen-design.md`)§5.13/§5.14、DES-006(`docs/design/06-validation.md`)§6 VAL-I01〜09/§7.4/VAL-C02/VAL-C03、`docs/progress/phase3/M13-RESEARCH-01-report.md`、code-facts(`docs/handover/code-facts.md`)§3/§4/§7/§8/§9。
- 統合元(閲覧可): `autopilot-combomgr/projects/combo-csv-import`・`combo-export-csv`(+ `INTAKE.md`/`CODE-FACTS.md`)。実装の裏取りに使う。
- **Plan Mode 着手前確認結果の確認(必須・playbook §8.4.4)**: 指示書 §3.4 の **8 項目すべて**(1 starter 導出 / 2 重複動作 / 3 タグ解決 / 4 セットプレイ別ファイル / 5 code→id / 6 行数上限 / 7 無害化担保層 / 8 取り込み単位・json タグ)に Plan Mode 質問書 + 開発者回答が残っているか。未確認のまま実装した項目があればその時点で重大(§9 = 推測実装)。**※ #2 重複動作は「skip(既定)+新規追加の 2 択・上書きは繰り延べ」に決定済み(指示書 v1.0.1)**。Plan Mode 確認は check-duplicate 再利用・新規追加経路の実装詳細のみ。export 配送(ZIP)・FS 非書込も決定済み(§4.1/§4.2)。

### 0.2 レビューの基本姿勢
- 機械的チェック(§1〜§4・§6・§7)に加え、設計意図(§5)の精神に沿うかを確認する。
- 症状のレイヤ ≠ 真因のレイヤ(フロント/BE を決めつけない)。

### 0.3 レビュー結果の報告フォーマット
- 各節ごとに「OK / 重大(§9)/ 軽微(§10)/ 質問(§11)」で報告。重大は完了承認を妨げる。

---

## 1. 設計書本体との照合(最重要)

### 1.1 エンドポイント(DES-002 §4.2、指示書 §4.1)
- [ ] `GET /api/export/csv`(FR401)・`POST /api/import/csv/preview`・`POST /api/import/csv`(commit)が新設・ルート登録されているか(実装前は未登録 = code-facts §4)。
- [ ] import が **別経路方式**(preview = DB 書込なし / commit = 取込)で、**解析・検証・無害化が共通サービス層**にあり両経路が呼ぶか(重複していないか)。`dryRun` 単一経路になっていないか。
- [ ] **moves 取込(`/api/import/moves`・movesimport)とは別系統・別ドメイン**で実装され、混在していないか。

### 1.2 CSV 契約・案A(DES-005 §5.13/§5.14、指示書 §4.2/§4.6)
- [ ] コンボ CSV に **`local_id`**、セットプレイ CSV(**別ファイル**)に **`parent_combo_local_id`** があり、両者が紐付くか(案A 準拠)。
- [ ] export が **意味単位**(`character_code`/`move_code` + recipe/tags 埋込)で、**DB 管理列(id/version/created_at/updated_at/deleted_at/step_count/recipe_cache)を出力しない**か(物理列直書きをしない = M13-RESEARCH-01 §C-4。M14 の moves 列変更に頑健)。
- [ ] セットプレイ import で `parent_combo_local_id` を同一バッチの local_id(または既存コンボ ID)へ解決し、親が取込対象外/失敗なら当該 setplay をスキップ + レポートするか。
- [ ] **export 配送 = ZIP 1 ファイル**(`archive/zip`・新規依存なし)で、**in-memory 組み立て(サーバ側ディスク一時ファイルを作らない)**か。import が **ZIP も受理して自動展開**するか(往復対称)。サーバ FS 書込が発生する場合、書込先が appData 管轄に封じ込められ**ユーザ指定ファイル名・CSV セル値がパスに流入しない**か(M13-RESEARCH-02 含意・CHANGE-049 同思想)。

### 1.3 型整合・旧形是正(指示書 §4.9、報告 #2/#4)
- [ ] **`drive_damage`** が **float(本体 REAL・小数 -6〜6)**で往復し、統合元の `*int` による**小数欠落が起きていない**か(DES-003 の REAL・CHANGE-046)。
- [ ] **oki 6 列**が **nullable(`*bool`)**で、**空セル=NULL / `false`=明示 false を区別**して往復するか。

### 1.4 starter 導出(指示書 §3.4-1/§4.2、報告 #3)
- [ ] export が **starter 列を持たず**、import 時に **レシピ先頭ステップから `starter_move_id` を再導出**するか。
- [ ] 再導出が編集器の `autoStarterMoveId`/`extractKeyFields`(レシピ先頭導出)と一致し、**VAL-C03**(starter≠先頭 WARNING)・**VAL-C02 DuplicateKey**(character/starter/position/opponent_stance/hit_type/opponent_size)と整合するか。
- [ ] レガシー「保存 starter≠先頭」が再 import で先頭へ正規化される旨が実装/報告で明示されているか(データ破壊でない)。

### 1.5 code→id・重複・タグ(指示書 §3.4-2/3/5、§4.4/§4.5)
- [ ] `character_code`→`character_id`・`move_code`→`move_id` を解決し、**存在しない code の扱い(ERROR 除外 / WARNING)**が VAL-I06/I07 と整合し Plan Mode 確定どおりか。
- [ ] **重複動作 = skip(既定) + 新規追加の 2 択**で実装され(**上書きは本サブ非対象＝実装していないか**)、既存 `POST /api/combos/check-duplicate`(`DuplicateInfoResponse`)の再利用方針に沿うか。「新規追加」が重複を許容し別コンボとして登録するか。
- [ ] タグが name(+user スコープ)で既存解決、無ければ新規作成(color 既定)か。空 name は WARNING か。

### 1.6 検証・無害化(DES-006 §6/§7.4、指示書 §4.3/§4.8)
- [ ] **NFR103 検証**(VAL-I01〜I09 = サイズ 10MiB/UTF-8/**行数 1000**/カラム構成/行単位型/code 存在/URL 非リンク化/サマリ)が import preview で機能するか。**行数上限が 1000(movesimport の 5000 と混同していない)**か(VAL-I03)。
- [ ] **CSV 無害化**: セル値を式/コマンドとして解釈せず**描画時エスケープ**、**式注入ガード(`= + - @`)**、**再 export 時 `'` 接頭辞**、**URL 非リンク化(VAL-I08)**を、Plan Mode 確定の担保層(service/handler/frontend)に実装したか。統合元の verbatim 保持に**本体側で無害化を付加**したか。

### 1.7 DES 直接編集の禁止
- [ ] コンボ CSV 契約・画面13/14・import VAL の **DES 反映は設計担当が CHANGE-050 で対応**する前提で、製造担当が DES-002/005/006 を直接編集していないか。

---

## 2. API 整合性
- [ ] preview / commit のレスポンス型が分離され流用していないか(preview = 行検証結果 / commit = 行単位レポート)。
- [ ] commit 成功後、コンボ系 queryKey(`["combos"]` 等 code-facts §2 既存規約)が invalidate され一覧へ反映されるか。
- [ ] 成功/部分成功/失敗のステータスコード契約がテストで担保されているか。

---

## 3. フロントエンドの動作仕様(指示書 §4.7)
- [ ] **画面13 エクスポート**(対象選択 全/フィルタ/選択/マイコンボ・形式 CSV・実行 → **ZIP 1 ファイル DL**)が新設・router 登録・Header 導線(DES-005 §228 エクスポートボタン)整合か。
- [ ] **画面14 インポート**(ファイル選択 = コンボ CSV 必須/セットプレイ CSV 任意・プレビュー行チェックボックス〔既定全チェック・個別解除〕・**要確認/エラー強調**・実行 → 行単位レポート)が機能するか。
- [ ] プレビュー表示が **CSV 値を式/コマンド解釈せず描画エスケープ**しているか。
- [ ] 既存 shadcn/ui パターン踏襲(自作再発明していないか・playbook §4.6)。

---

## 4. テストの妥当性(ケース数で確認。指示書 §5 ↔ §7 DoD)

### 4.1 バックエンド(Go test)
- [ ] **export 往復**: export(**ZIP 生成**)→ その ZIP を import で `DeepEqual` 往復 / `local_id`・`parent_combo_local_id` で setplay が紐付く / `drive_damage` 小数が保たれる / oki nil・false が区別保持 / starter が recipe 先頭再導出で DuplicateKey 一致。
- [ ] **import preview**: VAL-I01〜I09 各ケース / 式注入セル(`=`/`+`/`-`/`@`)の無害化 / code→id(存在しない code)。
- [ ] **import commit**: 重複動作(**skip(既定)/新規追加 各。上書きは非対象**)/ タグ解決(既存/新規/空 name WARNING)/ setplay 親解決(同一バッチ local_id・親失敗スキップ)/ 部分成功(不正行スルー + 後続継続 + レポート)/ 冪等(再 import で無秩序増加なし)。
- [ ] フィクスチャに統合元ゴールデン行(本体契約へ拡張)を併用しているか。

### 4.2 フロント(Vitest)
- [ ] import プレビューの行チェックボックス選択 / 要確認・エラー強調 / 行単位レポート表示。

### 4.3 E2E(指示書 §5.2・seed 非依存 self-contained)
- [ ] コンボ(+setplay)作成 → export(**ZIP 1 ファイル**)→ import(ZIP 受理 → プレビュー→一部除外→実行→レポート)→ 一覧反映 が self-contained か。
- [ ] 既存 `combo-crud.spec.ts` 等が引き続き通過するか(`make e2e`)。

---

## 5. 設計意図との整合(精神の確認)
- [ ] **「統合元は verbatim 保持 → 本体側で無害化/検証を付加」**: import が復元目的でも、式注入・URL・型を本体で厳格化しているか(§1.6 の思想)。
- [ ] **「2 段階(preview 寛容 = 表示・無害化 / commit 厳格 = 型・制約・重複)」**の分担が守られているか。
- [ ] **「意味単位 export」**: 物理列直書きでなく code/recipe 単位で、M14 の moves 列変更に壊れない設計か(§1.2)。
- [ ] **「starter 再導出 = 正規化であってデータ破壊でない」**: レガシー starter≠先頭を黙って壊さず、先頭へ正規化 + 必要なら WARNING に上げるか。
- [ ] **「コンボ取込(FR405)は moves 取込(FR704)と別系統」**: 経路・画面・ドメインを混在させていないか。

---

## 6. コード品質・規約遵守
- [ ] 曖昧語(「適切に」「必要に応じて」)に依存した実装判断になっていないか(playbook §4.1)。
- [ ] **統合元の snake_case json タグ ↔ 本体 camelCase 規約(CLAUDE.md §4)** が DTO 変換層 or タグ調整で整合しているか(§3.4-8 確定どおり)。
- [ ] バックエンド列挙定数とフロント定数の同期(playbook §4.8)。
- [ ] ファイル分割・命名が既存パターン(code-facts §2/§4)に整合するか。

---

## 7. 既存挙動の温存(非破壊性)
- [ ] 既存コンボ/タグ/技の **API 契約(`ComboResponse` 等公開フィールド = code-facts §7)が不変**か。
- [ ] moves 取込(`movesimport`)= 別系統・別画面のまま影響していないか。
- [ ] 既存 `combo-crud.spec.ts` 等が引き続き通過するか。

---

## 8. ドキュメント・進捗ログ
- [ ] 完了報告に、Plan Mode 確定方式(重複動作・starter 導出・code→id・無害化担保層・取り込み単位)、テストケース数、既知の制約(PDF/PNG/クリップボード = M13-02、英語ロケール除外)が含まれるか(指示書 §7.5)。
- [ ] コンボ CSV 契約・画面13/14・import VAL の **DES 反映は設計担当が CHANGE-050 で対応**(製造担当は DES を直接編集していないか)。

---

## 9. 重大な問題の判定基準(完了承認を妨げる)
- Plan Mode 8 項目(§3.4)のいずれかが未確認のまま実装されている(推測実装)。
- 既存コンボ/タグ/技の API 契約(公開フィールド)が変わっている。
- CSV 無害化が無く、式/コマンド注入が素通しになる(描画エスケープ・式注入ガード不在)。
- `drive_damage` 往復で小数が欠落する / oki の nil と false を混同する。
- starter 再導出が DuplicateKey(VAL-C02)と不整合で、重複検出が壊れる。
- import が全体ロールバックする / 部分成功しない / 冪等でない(重複動作の規約に反し無秩序に増える)。
- **上書き(既存コンボ置換)をスコープ外で実装している**(本サブは skip+新規追加の 2 択。上書きは繰り延べ・§1.3)。
- **export/import のサーバ FS 書込にユーザ指定ファイル名・CSV セル値由来のパスが流入する**(パストラバーサル。M13-RESEARCH-02 含意。in-memory 実装ならそもそも発生しない)。
- 製造担当が DES 本体を直接編集している。

## 10. 軽微な問題の判定基準(持ち越し許容)
- 要確認/エラー強調の視覚表現の細部(色・アイコン)。
- export ダイアログ/import プレビューのレイアウト微調整。
- 行レポート・ログ文言の体裁。
- フィクスチャの網羅度(代表行で足り、全行網羅は不要)。

## 11. 質問・確認事項のフォーマット
- 「指示書 §X.X / 設計書 DES-00N(実パス)§Y に対し、実装が Z。意図確認したい」の形で、根拠節を併記して設計担当へ。

## 12. レビュー完了の判定
- §1〜§8 が全て OK、§9 重大ゼロ、§0.1 の Plan Mode 着手前確認結果(8 項目)が揃っている。§10 軽微は持ち越し可。

---

*以上、M13-01 レビューチェックリスト v1.0.0。配置 `docs/instructions/phase3/reviews/M13-01-review-checklist.md`。*
