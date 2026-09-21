# M17-04 レビュー報告書

## 総評

M17-04(既存フォーマット取込ヘルパー)の実装は、本サブの核である **§1.2 死守事項 4 件**(AI にコードを生成・確定させない/決定論照合/フォールバックなし/エンジンを二度作らない)をすべて満たしており、設計準拠性は非常に高い。`internal/moveindex`・`move_commands`・migrations・`internal/service/inputresolve` はいずれも差分ゼロで、索引 IF は共通・消費者は別という原則が守られている。照合サービスは決定論(トークン列 `Lookup` + 別名 1 件完全一致)で、未解決はエラーにせず人レビュー動線へ流す形になっており、Go/Vitest/E2E のテストも網羅的で全 green。一方で、**(1) プロンプトコピーの clipboard 実装が rich-text 入力欄へ空文字を貼り付ける懸念**、**(2) 完了報告(DoD §7.4)未作成による Plan Mode 判断記録の未確認**という 2 点が完了承認前に確認/是正を要する。コード本体の設計逸脱は検出されなかった。

## 設計準拠性レビュー結果

### 0'. スコープの取り違え(指示書 §1.0) — ◎
- 移行対象は「ユーザーのコンボ」。`moves` テーブルへの書込はゼロ(read only)。`internal/service/intake/`・`internal/api/intake/`・`preset/queries.go` に INSERT/UPDATE/DELETE は存在しない(grep 確認済)。
- 出力は `csvcore.ExportCSV` による **コンボ CSV**(`local_id,character_code,...` ヘッダ・DES-002 §7.6 契約)。手入力 CSV(20 列 seed 源)ではない。`handler_test.go:123` が契約ヘッダを検証。
- `moves-input-tool`(別 module)には触れていない。拡張したのは本体の import 突合動線(新規 `IntakeHelperPage` → 既存 `/import/combo`)。
- `move_code` を確定しているのは「コンボのレシピの各ステップ」であり技マスタではない。

### 1. 二段の役割分担(§1.2-1) — ◎
- 本体から LLM を呼ぶ実装は無い。`prompt.ts` はテキストを組み立ててクリップボードへ渡すのみ。
- AI 出力(`nameCandidate`/`tokens`)を `move_code` として信じず、必ず `ix.Lookup` / `FindMoveCodesByAlias` の厳密照合を通す。存在しない code・別キャラ code・綴り違いは照合を通らず未解決に倒れる。
- キャラは `characterCode` で明示的に受ける(空は 400・`handler.go:39`)。AI に推測させていない。

### 2. 決定論照合(§1.2-2) — ◎
- 曖昧一致・編集距離・「たぶんこれ」は不在。別名は SQL で `pa.alias_text = ?`(完全一致)、かつ返り値 1 件のときだけ確定(`service.go:94` `len(codes) == 1`)。0/複数件は未解決(`service_test.go` TestResolve_AliasAmbiguous_Unresolved で検証)。
- 呼び出し側で正規化を再実装していない。`ix.Lookup` が `normalizeToken` を一元管理(`service.go` コメントにも明記)。

### 3. フォールバックなし(§1.2-3) — ◎
- 未解決は `Resolved=false`・`MoveCode=""` のまま返し、通常技へ落とさない(`TestResolve_UnknownToken_NoFallback`)。
- 段階2 の `inputresolve` を流用していない。共有しているのは `movecommandrepo.LoadIndex`(索引 IF)のみで、取込側は別サービス(`main.go` の DI コメントにも明記)。
- 未解決はエラーで止まらず 200 で返る(`handler.go` は照合結果を常に 200)。

### 4. エンジンを二度作らない(§1.2-4) — ◎
- `git diff HEAD~3 -- internal/moveindex` は空。索引データ(`move_commands`)改変なし。消費者拡張のみ。

### 4'. プロンプトひな形の調整(§4.5) — ◎(1 点 △)
- 死守部分は不変: `move_code` を書かせない/`?` を許す(OD・DR の `?` 例を追加)/対象キャラ 1 体/24 種語彙/verbatim。`prompt.ts` の `PROMPT_BODY` と `docs/human-notes/combo-intake-normalize-prompt.md` の双方で維持。
- 1 キャラずつ・moves は選択中キャラ分のみ(`buildIntakePrompt` は選択キャラの moves だけを埋める)。構造的にキャラ取り違えが起きない。
- △ `docs/human-notes/...md` の脚注が「v1.0.0」のまま(ヘッダは 1.1.0)。軽微な版表記の不整合。

### 5. 人レビュー動線 — ◎
- 未解決行は `bg-amber-50` + `未解決` バッジで提示、トークン列・技名候補・元表記を表示。解決手段は技セレクタ(全 move + 索引候補)で直接指定。未解決が残る間は「取込プレビューへ進む」を `disabled`。
- 新画面(`/import/combo/helper`)は §2.3/§3.3-3 が「新画面か既存拡張かを提示」で許容した範囲。

### 6. 未投入キャラ・既知の未解決 — ○
- 未投入(c_viper)・キャラ不明は `MovesAvailable=false`・全行未解決・エラーなし。Go/handler/E2E で検証済。
- △ 既知の未解決 2 件(`guile/sonic_blade_od`・`lily/condor_spire_od`)は「索引に無い→未解決」で一般ロジックにより正しく処理されるが、**明示的な回帰テストは無い**(挙動は汎用のため機能上は問題なし)。

### 7. 出力・非波及 — ◎
- CSV は `csvcore.ExportCSV` を再利用(csvcore に差分なし)。CSV 契約・`recipe_hash`・重複判定・`RecomputeComboCache`・スキーマ・解決表配信 API は不変。
- 公式 HTML 取込(FR704)は作っていない。

### 8. 品質・ドキュメント — △
- `make e2e` は本レビューでは未実行(コミットメッセージは全 27 件 green と記載)。`console.log`/`fmt.Println` の残置なし。i18n キー追加は無く、日本語直書きは既存 import 系の流儀に整合。
- × **完了報告(`docs/progress/phase3/m17-04-completion-report.md`)が存在しない**。DoD §7.4・チェックリスト §8/§0.1 が要求する「Plan Mode 8 項目の判断記録(とくに 1/2/3 は開発者判断)」「入力の受け口/出力の落とし先/人レビュー動線の最終形と経緯」「エイリアス照合の可否と理由」「DES 反映要点」が文書として残っていない。実装内容自体は §11 の確定回答(貼付/combos.csv→import/新画面/エイリアス含む)と一致しているが、判断記録の不在はチェックリスト §9 の「Plan Mode 8 項目のいずれかが未確認」に該当し得るため、完了承認前に補完が必要。

## 設計準拠性以外の指摘事項

1. **[要確認・機能] プロンプトコピーが rich-text 入力欄で空貼り付けになる懸念**
   `IntakeHelperPage.tsx:78` は `copyComboClipboard("", prompt)` を呼ぶ。`copyComboClipboard`(`web/src/features/combo-io/clipboard.ts:113`)はコンボ表用のヘルパで、`ClipboardItem` 対応環境では `text/html`(ここでは **空文字**)と `text/plain`(prompt 本文)の両方を書き込む。contenteditable/ProseMirror ベースの入力欄(claude.ai・ChatGPT 等の Web AI チャット)は貼り付け時に `text/html` を優先するため、**空の HTML blob を貼り付けて本文が入らない**可能性がある。§4.6 の「プロンプトをコピー」は本サブの中核導線であり、対象がまさに Web AI チャットであるため影響が大きい。`navigator.clipboard.writeText(prompt)` 等の plain-text 専用コピーへ変更するのが安全。実機での貼り付け確認を推奨。

2. **[堅牢性] `POST /api/intake/csv` が空 move_code を検証しない**
   `handler.go` の `BuildCSV` は `st.MoveCode` を無検証で `csvcore.Step` へ流す。未解決(空 code)ステップが混ざったリクエストでも 200 で空 code 入り CSV を返す。FE(`review.ts` `buildCsvPayload`)が空 code を除外するため通常フローでは顕在化せず、下流の import プレビュー検証(VAL-I*)も迂回しないので「検証を迂回しない」原則は保たれるが、API 単体としては契約が緩い。空 code・空ステップコンボの拒否(400)を BE 側にも入れると防御が二重化する(スコープ外なら低優先)。

3. **[軽微・デッドコード寄り] 人レビュー UI の候補フィルタが実質無効**
   `IntakeHelperPage.tsx:267` は `step.candidates.filter((c) => !moveOptions.some((o) => o.code === c))` で索引候補を「候補:」オプションとして先頭表示しようとするが、`LookupAll` の候補(当該キャラの非派生 move_code)は `moveOptions`(当該キャラ全 move)に必ず含まれるため、このフィルタは常に空となり「候補:」行はレンダリングされない。候補の優先提示という意図が機能していない(全候補はセレクタ本体から選べるため実害は無い)。

4. **[軽微] `confidence`/`note` が UI に未露出**
   DTO・型・パーサは `confidence`/`note` を保持するが、人レビュー表には列が無い。チェックリスト §4'.3 が観察を求める「確信度 `低`/`?` の多寡」を運用者が画面で参照できない。参考列として表示する余地あり。

5. **[観察] `ComboImportPage` の StrictMode 対策**
   連携プレビューを `setTimeout(0)` + cleanup + `previewMRef` + `previewM.data` 購読で実装しており、コメントで意図は明記されている。E2E も通っているが、`setTimeout(0)` 依存は将来的な脆さを残す。連携値を location.state ではなくルーティング層で 1 回だけ渡す等の代替も検討余地(現状で機能はしているため低優先)。

## 推奨修正(優先度別)

- **高(M17完了前に修正必須)**:
  - 指摘1: プロンプトコピーを plain-text コピー(`writeText`)へ変更し、実際の Web AI 入力欄への貼り付けを確認する。§4.6 中核導線の機能欠陥になり得る。
  - 指摘8(×): `docs/progress/phase3/m17-04-completion-report.md` を作成し、Plan Mode 8 項目の判断記録・入力/出力/人レビュー動線の最終形と経緯・エイリアス照合の可否理由・DES-002 §7.6/DES-005 の CHANGE 反映要点を残す(DoD §7.4/チェックリスト §8 のゲート)。

- **中(M18着手と並行可)**:
  - 指摘2: `POST /api/intake/csv` の空 move_code / 空ステップに対する BE バリデーション(400)追加。
  - 既知未解決 2 件(guile/lily OD)の明示的な未解決回帰テスト追加(挙動は汎用だが死守事項の証跡として有効)。

- **低(将来対応)**:
  - 指摘3: 候補フィルタの意図を復活させる(例: 候補を先頭にソートするだけにする)か、デッドコードを整理。
  - 指摘4: 人レビュー表に `confidence`/`note` 参考列を追加。
  - 指摘(§4' △): human-notes 脚注の版表記(v1.0.0 → 1.1.0)を整合。

## 良かった点

- 死守事項 4 件をコード・コメント・DI 配線・テストの各層で一貫して表現できている。とくに `main.go` と `service/intake/types.go` のコメントで「索引 IF は共通・消費者は別/inputresolve を流用しない」を明記しており、将来の誤流用を予防している。
- 別名照合の一意性担保(`len(codes) == 1` のみ確定・DISTINCT・0/複数は未解決)は決定論の要件を正確に実装。曖昧一致への逸脱が一切ない。
- `ParseInput` が寛容(ヘッダ/散文/空行スキップ・バッククォート除去・列不足許容)で、貼り付け運用の現実に即している。テストも的確。
- 未投入キャラ・キャラ不明・未解決を「壊れない正常結果」として扱う設計思想が、BE(200 応答)・FE(案内文・進行ボタン抑止)・E2E の全レイヤーで一致している。
- スコープ厳守が徹底されており、moveindex/move_commands/inputresolve/csvcore/migrations すべて差分ゼロ。「二度作らない」「契約不変」を実際の diff で証明できる状態。

## 制約事項

- 本レビューはコード上で判定可能な範囲のみ対象。実際の動作確認・パフォーマンス・実機テストは別途実施が必要。
- とくに指摘1(clipboard の rich-text 貼り付け挙動)は環境依存のため、対象 AI(claude.ai・ChatGPT 等)の入力欄での実貼り付け検証を推奨する。
- `make e2e` の全 green は本レビューでは再実行しておらず、コミットメッセージの記載に依拠している。

---

## 取り込み結果(自動トリアージ)

implement_plan_full の Phase C として、製造担当(Claude Code)が採否を自動判断した記録。**高の不採用は無し**(安全弁のエスカレーション不要)。

| 指摘 | 優先度 | 採否 | 理由・対応 |
|------|--------|------|-----------|
| 1. プロンプトコピーが rich-text 欄で空貼り付けになる懸念 | 高 | **採用** | `copyPlainText`(新設・writeText＋textarea/execCommand フォールバック)へ変更。`IntakeHelperPage` は `copyComboClipboard("",…)` を廃止。§4.6 中核導線の機能欠陥のため必須。実 AI 入力欄での貼り付け確認は開発者に依頼(本体からは検証不可)。 |
| 8. 完了報告未作成(DoD §7.4) | 高 | **採用** | `docs/progress/phase3/m17-04-completion-report.md` を作成。Plan Mode 8 項目・入出力/人レビュー動線の経緯・エイリアス照合の可否理由・DES 反映要点を記録。 |
| 2. `POST /api/intake/csv` が空 move_code を検証しない | 中 | **採用** | `BuildCSV` に 400 ガード追加(空 move_code ステップ・空ステップコンボ・空コンボ配列を拒否)。handler test 2 件追加。契約を BE 側でも締める。 |
| 既知未解決 2 件(guile/lily OD)の明示的回帰テスト | 中 | **採用** | `TestResolve_EmptyCommandMove_Unresolved` を追加。command 空 move は索引に無くトークンで引けず未解決(フォールバックしない)を証跡化。 |
| 4. `confidence`/`note` が UI 未露出 | 低 | **採用** | 人レビュー表に「確信度」列を追加(備考は title でホバー参照)。§4'.3 の観察点(低/? の多寡)を画面で参照可能に。 |
| §4' △. human-notes 脚注の版表記 | 低 | **採用** | 脚注を v1.1.0 に整合し、本文の正がコードへ移った旨を明記。 |
| 3. 人レビュー UI の候補フィルタが実質無効 | 低 | **見送り** | `LookupAll` 候補は moves 未ロード時のみ表示される(moves ロード後は moveOptions に含まれ空)＝実質は「moves ロード中のフォールバック提示」として機能しており、完全なデッドコードではない。実害なし・低優先のため現状維持。 |
| 5. 連携プレビューの `setTimeout(0)` 依存 | 低(観察) | **見送り** | StrictMode 二重マウントで per-call callback/observer が落ちる既知事象への標準的対処。コメントで意図明記済・E2E で機能検証済。ルーティング層で 1 回渡す代替は将来検討(現状で機能)。 |

高 2 件・中 2 件を採用し修正・テストを追加、低 2 件採用・2 件見送り。修正後 `go test ./...`・Vitest・`make e2e`(intake 2 件)再実行で green を確認。
