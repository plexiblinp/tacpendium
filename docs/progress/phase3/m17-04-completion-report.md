# M17-04 完了報告書（既存フォーマット取込ヘルパー）

| 項目 | 内容 |
|------|------|
| タスクID | M17-04 |
| 指示書 | `docs/instructions/phase3/M17-04-intake-helper.md` v1.0.2 |
| レビュー報告書 | `docs/progress/phase3/m17-04-review.md`（fresh subagent・独立レビュー） |
| 完了日 | 2026-07-17 |
| 製造 | Claude Code（implement_plan_full 一気通貫） |

## 1. 概要

発信者が自分の形式（メモ／エクセル／テキスト）で蓄積したコンボを本アプリへ取り込むためのヘルパーを実装した。**二段の役割分担**を外していない: ① 表記正規化（自由表記→候補トークン列）は**アプリ外プロンプト**、② コード確定（候補トークン列→`move_code` の厳密照合）は**本サブ（アプリ側）**。**本サブが作ったのは②のみ**。出力は**コンボ CSV** で、既存の import 動線に乗せる。`moves` テーブルへの書込はゼロ（read only）。

## 2. Plan Mode 確認結果（§3.3 の 8 項目・判断記録）

| # | 項目 | 判断・実装 |
|---|------|-----------|
| 1 | 入力の受け口 | **テキスト貼り付け**（確定済）。形式は**開発者判断で「簡易 TSV」**（1 行 1 ステップ・タブ区切り。列: `# / ステップ / 元の表記 / トークン列 / 技名候補 / 確信度 / 備考`）。キャラは**ドロップダウンで明示選択**（AI に推測させない）。moves 一覧は §4.6 の「プロンプトをコピー」が選択中キャラ分だけ同梱＝既存 `GET /api/moves` を使用（新規 API 不要）。 |
| 2 | 出力の落とし先 | **コンボ CSV（`combos.csv`）を生成 → 既存 import プレビューへ**（確定済）。**開発者判断で「同一導線で自動プレビュー」**（生成 CSV を router state で `ComboImportPage` に渡し自動プレビュー）。直接登録せず既存の検証・重複判定を迂回しない。 |
| 3 | 人レビュー動線 | **開発者判断で「新規『取込ヘルパー』画面を新設」**（`/import/combo/helper`）。未解決行を強調＋技セレクタ（全 move＋索引候補）で解決。既存 import 画面は最終プレビュー/取込を担当。 |
| 4 | 照合の実装 | `internal/moveindex` の**消費者拡張**（`movecommand.LoadIndex` → `Lookup`/`LookupAll`）。**フォールバックなし**。**エイリアス照合を含める**（下記 §4）。 |
| 5 | 未投入キャラ | 全行未解決（`MovesAvailable=false`）・**エラーにしない**。キャラ不明も同様。Go/handler/E2E で検証。 |
| 6 | 既知の未解決 2 件 | `guile/sonic_blade_od`・`lily/condor_spire_od`（command 空＝索引に無い）は未解決として扱いエラーにしない（`TestResolve_EmptyCommandMove_Unresolved`）。 |
| 7 | i18n | **キー追加なし**。新画面は日本語直書き（既存 import/export ページの流儀に整合）。locale parity テストは 730 件全 green。 |
| 8 | 非波及 | `internal/moveindex`／`move_commands`／`inputresolve`／`csvcore`／CSV 契約／重複判定キー／`recipe_hash`／`RecomputeComboCache`／スキーマ すべて差分ゼロ（`git diff` で確認）。 |

## 3. 入力の受け口／出力の落とし先／人レビュー動線の最終形と経緯

- **入力**: 取込ヘルパー画面でキャラを選び「プロンプトをコピー」で得たプロンプト（本文＋選択中キャラの moves 一覧）を AI に貼って正規化。AI の TSV 出力をテキストエリアに貼付し「照合」。BE（`POST /api/intake/resolve`）が TSV をパースし各ステップを厳密照合。
- **人レビュー**: 未解決行を強調表示。技セレクタで直接解決。未解決が残る間は「取込プレビューへ進む」を無効化。
- **出力**: 「取込プレビューへ進む」で `POST /api/intake/csv`（`csvcore.ExportCSV` 再利用）が `combos.csv` を生成 → `navigate("/import/combo", { state: { intakeCsvText } })` → 既存 import 画面が自動プレビュー（既存の検証・重複・取込 UI をそのまま再利用）。
- **経緯**: §3.3-1/-2/-3 は開発者判断事項。本チャットで 4 択を提示し、(1)簡易 TSV (2)新画面 (3)同一導線自動プレビュー (4)キャラ内一意な完全一致エイリアス を回答取得のうえ実装した。

## 4. エイリアス照合の実装可否と理由

- **実装した**（開発者確定「含める」）。方式は**キャラ内で一意な完全一致のみ採用**。`preset.FindMoveCodesByAlias`（新規 read-only クエリ）で `alias_text` 完全一致・キャラスコープ・全プリセット横断で `move.code` を逆引きし、**返り値が 1 件のときだけ確定**（0/複数件は未解決）。
- **理由**: `preset_aliases` に `alias_text` の一意制約が無い（UNIQUE は `(preset_id, move_id)`）ため 1:N が起こり得る。曖昧一致・タイブレークを実装しない決定論の要件（§1.2-2）を満たすには「一意のときだけ確定」が必要。全プリセット対象としたのは将来のカスタムプリセット（M20＝ユーザー個人の表記辞書）が来たら自動で効くため（§10）。

## 5. DES 反映要点（設計担当への CHANGE 起票用・製造は DES を直接編集しない）

実装完了後に設計担当が以下を CHANGE として起票・反映すること（承認ゲートなし＝スキーマ変更ゼロ）。

- **DES-002 §7.6（CSV 契約）**: 変更なし（不変）。取込ヘルパーは `csvcore.ExportCSV` を再利用し、契約列をそのまま生成する。CHANGE では「取込ヘルパーが同契約の生成側消費者として加わった」旨の追記のみで足りる。
- **DES-005（画面設計）**: **新画面「取込ヘルパー」（`/import/combo/helper`）を追加**。§5.14（import プレビュー）に「取込ヘルパーからの CSV を router state で受け自動プレビューする連携口」を追記。Header ナビに「取込ヘルパー」導線を追加。
- **新規 API**: `POST /api/intake/resolve`（候補トークン列→`move_code` 厳密照合・未解決は未解決のまま返す）、`POST /api/intake/csv`（解決済みコンボ→`combos.csv`。空 move_code/空コンボは 400）。DES-002 §4.x の API 一覧へ追記。
- **DES-003 §3.9（preset_aliases）**: スキーマ不変。取込の別名照合が `alias_text` を逆引き利用する消費者として加わった旨の注記（将来 M20 の逆引き一意性論点は §10.1 参照）。
- **プロンプト資産**: `docs/human-notes/combo-intake-normalize-prompt.md` を製造が TSV 出力へ調整（v1.1.0）。**本文の正は実装後 `web/src/features/intake/prompt.ts`**（UI ラベルと同性格）。

## 6. 成果物

- BE: `internal/service/intake/`（types/parse/service）、`internal/api/intake/`（dto/handler/routes）、`preset.FindMoveCodesByAlias`、`cmd/combomgr/main.go` DI。
- FE: `web/src/pages/IntakeHelperPage.tsx`、`web/src/features/intake/`（api/types/prompt/review）、`ComboImportPage.tsx` 連携口、router/Header。
- Docs: プロンプトひな形 TSV 調整。
- テスト: Go（service/handler/preset repo）、Vitest（review/prompt/clipboard）、E2E（`m17-04-intake-helper.spec.ts`）。

## 7. テスト結果

- `go test ./...` 全 green。`git diff -- internal/moveindex` 空（エンジン無改変）。
- Vitest 730 件全 green（locale parity 含む）。
- `make e2e` 全 27 件 green（intake 2 件＋非回帰。既知 flaky の m12-03 も本実行では green）。

## 8. レビュー指摘の取り込み（自動トリアージ）

`docs/progress/phase3/m17-04-review.md` 末尾の「## 取り込み結果（自動トリアージ）」に採否と理由を記録。**高 2 件は両方採用**（プロンプトコピーの plain-text 化・本完了報告の作成）。中 2 件採用、低は一部採用・一部見送り（理由は同節参照）。**高の不採用は無し**（エスカレーション不要）。

## 9. 制約・申し送り

- **【最重要・今後のテコ入れ課題（スコープ外）】① プロンプトの表現力が SF6 実コンボに不足**（2026-07-17 開発者の実データ検証で判明）。実メモを Gemini/ChatGPT で正規化させたところ大半が未解決。原因＝(a) 技一覧未注入だと技名候補が全滅（→アプリ経由コピーが必須・要再検証）、(b) DR/CR/R./OD/SA/DI/PC/回数/条件/注記が 24 種トークン語彙で表現不能。**②照合は健全だが①が実コンボを落としきれない**。方向性（技名照合の強化・中間展開の二段化・システム概念の別レイヤ化・M20 個人辞書）は `docs/progress/progress-log.md` の M17-04 課題節、および `tmp/20260717-M17-04-design-handover.md` §4.5 に詳述。**本サブでは実装変更せず据え置き**。
- プロンプトの実 AI 往復での最終確認は開発者（本体から LLM を呼ばない・呼べない）。
- カスタムプリセット（M20）が来たら別名照合が自動で効く。§10.1 の「逆引き一意性（`alias_text` の一意制約）」は M20 設計で要検討（本サブでは書き戻し未実装）。
