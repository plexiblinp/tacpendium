# M10 マイルストーン全体像(M10-overview): 複数キャラ登録 UI

| 項目 | 内容 |
|------|------|
| 文書ID | M10-OVERVIEW |
| バージョン | 1.0.1 |
| 作成日 | 2026-06-18 |
| 更新日 | 2026-06-18 |
| 作成者 | 設計担当 Claude(フェーズ2 本流スパイン・M10 担当) |
| ステータス | 初版(M9 完了後・M10-01 着手準備)。CHANGE-036 反映済み(DES-005 v2.20.0) |
| 対象読者 | 開発者、後続マイルストーン担当 Claude、製造担当 Claude Code(間接的) |
| 用途 | M10(複数キャラ登録 UI)の全体像を提示し、サブユニット分割(M10-01 / M10-02)・モデル配分・主要設計判断・完了判定基準を確定する。phase2-overview §M10 が正本、本書はその M10 区画を実装着手レベルへ具体化する overview |
| 前提文書 | REQ-001 v2.15.0 / DES-001 v1.3.0 / DES-002 v1.19.0 / DES-003 v1.20.0 / DES-004 v1.6.0 / DES-005 **v2.20.0**(CHANGE-036 反映済み) / DES-006 v1.11.0 / SUPP-001 v1.24.0 / playbook v1.11.0 / code-facts(commit ff0620b、2026-06-18) / architecture-patterns(現行版) / change-number-registry **v1.23.0** / phase2-overview v0.2.0 / m9-to-m10-handover / retrospective-digest / model-allocation **v1.14.0** |

## 更新履歴

| バージョン | 更新日 | 更新内容 |
|-----------|--------|----------|
| 1.0.0 | 2026-06-18 | 初版作成。phase2-overview §M10 の M10-01(A-1)/ M10-02(A-2)分割を実装着手レベルへ具体化。登録系 API が character_id 既存(code-facts §7-2)＝フロント完結スコープ確定、DES-005 §5.7 は選択 UI 既述・実装遅延、切替時 UX を CHANGE-036(DES-005 v2.20.0)で規範化済み、を反映。M10-overview は開発者依頼により作成(playbook §4.12 の独断増設に該当せず) |
| 1.0.1 | 2026-06-18 | §14 関連ドキュメントのパスを docs-map.md(commit 9fd1a69)準拠に確定。overview/指示書 = `docs/instructions/`(複数形)、レビューチェックリスト = `docs/instructions/reviews/`、CHANGE-036 通知書/レポートを確定ファイル名(`CHANGE-036-M10-01-...` / `change-report-036.md`)へ。docs-map.md 自体を関連ドキュメントに追加。内容変更なし(パス整合のみ) |

---

## 0. 本書の位置づけ

本書は M10(複数キャラ登録 UI)の **全体像と方針確定** を目的とする overview 文書。phase2-overview §M10 を正本とし、本書はその区画を「サブユニット分割・モデル配分・主要設計判断・完了判定基準」のレベルまで具体化する。各サブユニットの詳細仕様は各指示書本体(`M10-01-instruction.md` 等)に記述し、差異がある場合は指示書本体が優先される。

playbook の運用ルール(1 マイルストーン = 1 チャット系列、サブユニット分割は関心数で判断、完全直列実行、§4.12 マイルストーン構造の独断拡張禁止)に従う。**本 overview の作成は開発者依頼によるもので、§4.12 が禁じる「設計担当の独断による overview 増設」には該当しない**。

### 0.1 M10 の位置づけ(M9 完了後の本流スパイン)

- M9(公式データ取込パイプライン)完了により、クラシック操作5体(ryu / ken / ingrid / c_viper / dhalsim)の moves フレームデータが取込・編集できる状態になった(開発者 E2E 通過、2026-06-17)。
- **閲覧系(マイコンボ / 一覧 / 比較)は複数キャラ動的化済み**(`useCharacters` + `CharacterSelector`、code-facts §1/§2)。
- **登録系(ComboEditor)はフェーズ1 以来リュウ固定**のまま。M10 はこの登録系のリュウ固定を解消し、クラシック5体を UI から登録できる状態にする(phase2-overview §1 到達点の一つ)。

### 0.2 M9 完了状態からの確定事項(m9-to-m10-handover §4)

- 閲覧系は複数キャラ動的化済み・登録系のみリュウ固定。
- moves スキーマ・取込/編集 API は M9 で確定(model.Move 集約は後続延期 + 乖離検出ガード)。
- 破壊的 seed クリアは M12-02 延期(000014 は加算のみ・旧 seed と取込データ共存)。
- E2E 段階導入(M9 で 3 spec)。M10 の機能追加に合わせ spec を漸進拡充。

---

## 1. M10 のスコープと目的

### 1.1 スコープ(phase2-overview §M10)

| 項目 | 内容 |
|------|------|
| 主スコープ | ComboEditor のリュウ固定解消(キャラクター選択化)+ リュウ固定に依存した UX の画面横断解消 |
| サブユニット | M10-01(A-1 ComboEditor キャラクター選択化)/ M10-02(A-2 リュウ固定依存 UX の解消) |
| 関連 FR / NFR | コンボ登録(FR001 系)、複数キャラ対応(フェーズ2 到達点) |
| 関連設計書 | DES-005 §5.7(登録・編集画面、CHANGE-036 反映済み)/ §4.1 / §4.3、DES-002 §4.2(combos API)、code-facts §1/§2/§7-2 |

### 1.2 目的(M10 完了時に達成される状態)

- ComboEditor の新規登録モードでクラシック5体から登録対象キャラを選択でき、選択に応じて始動技候補・仮想コントローラ・レシピ入力(moves)・束ねたセットプレイ・リアルタイム重複検知が追従する。
- 登録時、選択キャラの `characterId` が `POST /api/combos`(`CreateRequest.characterId`)で保存される。
- 編集モードはキャラ固定表示、コピーモードは選択可。新規モードのキャラ変更時に CHANGE-036 の挙動(確認ダイアログ→破棄で全体リセット／キャンセルで revert)が機能する。
- ComboEditor 外のエントリポイント(フッター新規登録の既定キャラ、選択モード、コンボ追加モーダル等)でリュウ固定/既定キャラ固定が残る箇所が解消され、選択キャラに追従する(M10-02)。

### 1.3 このマイルストーンで作らないもの(スコープ外)

- **M11 custom_states 開始時状態の機能化**: DES-005 §5.7 表示項目5「situation(キャラ固有状態)」の機能化(電刃等の boolean 状態の付与・参照)は M11。custom_states は phase-1 で保存/API のみ・消費未実装(architecture-patterns §9.1)。**§2.5 既知制約**参照。
- **バックエンド変更全般**: 登録系 API は character_id 既存(code-facts §7-2)。本 MS はフロント完結。
- **英語ロケール整備・他ゲーム対応**: フェーズ3 以降(phase2-overview §2)。
- **moves 手動 CRUD(B-2)等の M9 外 backlog**: M10 のサブにしない(m9-03-followup-backlog)。
- **プリセット選択のキャラスコープ化**: `PRESETS_KEY=["presets"]` はキャラ非スコープ(code-facts §2-2)。切替で preset リセットは原則不要(M10-01 Plan Mode で確認)。

---

## 2. 主要設計判断(本 overview で確定)

### 2.1 登録系 API は character_id 既存 → M10 はフロント完結(code-facts §7-2 で確定)

- `POST /api/combos`(`combo.Handler.Create`)のバインド先 `CreateRequest` は `characterId int64`(必須)を保持。`PUT /api/combos/:id`(`UpdateWithKeyChange`)のバインド先 `PutRequest` は `CreateRequest` を embed。`CheckDuplicateRequest` も `characterId` 保持(いずれも code-facts §7-2、commit ff0620b)。
- **帰結**: API は当初からキャラ・パラメータ化されており、フェーズ1 はフロント側で値を固定していただけ。M10 で API 契約変更は不要(DES-002 への CHANGE なし)。M10-01 / M10-02 はともにフロント完結スコープ(指示書 §2.4 例外条項＝該当なし)。
- **留保**: code-facts §7-2 は DTO 形状のみで、Create サービス経路が `CreateRequest.characterId` を実際に永続化するかは別事実(限界節)。各指示書 §3.4 で実コード確認を必須化する。

### 2.2 DES-005 §5.7 は選択 UI を既述・実装が遅延 → 機構は CHANGE 不要

- DES-005 §5.7 は既にキャラ選択を規定済み: 表示項目1「現在選択中キャラクター情報バー」、表示項目2「キャラクター選択プルダウン(新規時のみ、編集時は固定表示)」。§4.3 共通要素にも「キャラクター選択プルダウン(複数画面で使用・デフォルト表示キャラがデフォルト選択)」。
- **帰結**: M10 が目指す UI 仕様は設計書本体に既述で、遅れているのは実装側。選択機構そのものに DES-005 への CHANGE は不要。

### 2.3 新規モードのキャラ変更時 UX = 確認ダイアログ→全体リセット／キャンセルで revert(CHANGE-036、開発者確定 2026-06-18)

- 入力済み(dirty)時にキャラ変更で確認ダイアログ。「変更して入力を破棄」でフォーム全体を新キャラ初期状態へリセット、「キャンセル」でキャラ変更を取り消しプルダウンを変更前へ revert(制御コンポーネント)。初期状態は無確認切替。編集モードは固定、コピーモードは初期 dirty で必ず発火。
- **根拠**: code-facts §7-2 で `steps`(StepRequest.moveId)・`starterMoveId`・束ねた `setups`(BundledSetupRequest)がキャラスコープ＝切替で無効化必須と確認。利用者データ破棄を伴うため確認 UX を規範化。破棄範囲はフォーム全体リセット(残せるメタデータも破棄レシピに紐づき陳腐化するため、選択的保持より正しさ・単純さで優れる)。
- DES-005 §5.7 に CHANGE-036 として反映済み(v2.20.0)。

### 2.4 サブユニット分割(M10-01 / M10-02、A-1 / A-2 対応)

phase2-overview §M10 の A-1 / A-2 に対応する2サブユニット構成。

- **M10-01(A-1)**: ComboEditor **内部**のキャラクター選択化。選択 UI 導入、characterId 状態化、選択キャラの下流連動、CHANGE-036 切替挙動。
- **M10-02(A-2)**: ComboEditor **外**のエントリポイントに残るリュウ固定/既定キャラ固定の画面横断解消(フッター新規登録の既定キャラ、選択モード、コンボ追加モーダル等)。実スコープは着手時に実コードで該当箇所を洗い出して確定する(M7-03 R-3 で `AddComboToCompareModal` のキャラフィルタが既に手当てされた可能性等を含め、想定で実装済み/未実装を決めつけない)。

> 過細分化(コンポーネント単位の細分割)・統合(M10-01 と M10-02 を1サブに統合)は採用しない。前者は完了承認待ちが増え、後者は ComboEditor 内部の選択化(モード分岐・ステートフル UX)と画面横断のエントリ既定値解消で関心が異質なため分離が見通し良い。

### 2.5 §4.11 既知制約(決定の足し算が作る穴、playbook §4.11)

- 「M11 送り(custom_states 消費の機能化)」＋「M10 でキャラ選択解禁」を重ねた帰結: **C.ヴァイパー/ダルシム等を選択しても、表示項目5 の situation「キャラ固有状態」は機能しない**(custom_states は phase-1 で保存/API のみ・消費未実装)。M10 では situation は汎用入力のまま。
- これは **埋めない(その状態のまま残す)ことが正**。製造担当は穴埋めで custom_states 消費ロジック・キャラ別動的状態 UI を実装しないこと(M11 の範囲)。各指示書 §4.11 に明記する。

### 2.6 採用しない案(CHANGE-036 検討時)

| 案 | 内容 | 不採用理由 |
|---|------|----------|
| 選択的リセット | キャラ非依存メタデータ(position/situation/oki/tags/memo 等)を保持しレシピ系のみ破棄 | 破棄したレシピに紐づくメタデータ(damage 等)が陳腐化、部分リセットで中途半端な state が生じやすく仕様・テスト面が増える。先行リリース仕上げ段階では複雑度に見合わない |
| 無確認の自動クリア | キャラ変更で確認なくフォームをクリア | 不意のデータ損失。利用者体験として不可 |
| 切替の完全ブロック | dirty 時はキャラ変更不可(手動クリアを強制) | 過剰に不便。確認ダイアログで足りる |

---

## 3. サブユニット分割

### 3.1 分割方針(M10-01 / M10-02 の2サブユニット構成)

| ID | 名称 | 推奨モデル | Plan Mode | 実行順 | 想定指示書サイズ |
|----|------|-----------|-----------|--------|--------------|
| **M10-01** | ComboEditor キャラクター選択化(A-1) | Opus 4.8(暫定) | 必須(characterId 供給源 / Create 消費経路 / state 機構と CharacterSelector 配置 / 切替 reset 配線 / preset 連動) | 1 | 標準(500〜800 行) |
| **M10-02** | リュウ固定依存 UX の画面横断解消(A-2) | 着手時記入(Sonnet 想定) | 必須想定(対象エントリポイントの実コード洗い出し) | 2 | 着手時確定 |

### 3.2 採用しない案

§2.4 末尾を参照(過細分化・統合いずれも不採用)。

---

## 4. 各サブユニットの概要

本節は M10-overview としての全体像。**詳細仕様・成果物・テスト要件は各指示書本体に記述する**。

### 4.1 M10-01: ComboEditor キャラクター選択化(A-1)

**目的**: ComboEditor のリュウ固定を解消し、DES-005 §5.7 表示項目1・2(情報バー + 選択プルダウン)を実装上も機能させる。選択キャラに応じて moves・始動技候補・仮想コントローラ・束ねたセットプレイ・重複検知を追従させ、CHANGE-036 の切替挙動を実装する。

**スコープに含むもの**:

- `useCharacters` + `CharacterSelector` パターンの登録系への踏襲(新規=プルダウン、編集=固定表示、情報バー)。
- ComboEditor の characterId 状態化(固定供給 → 選択 state)。新規=既定キャラ、編集/コピー=`initial.characterId`。
- 選択キャラの下流連動: `useMovesByCharacter(characterId)` → RecipeBuilder / VirtualController / ComboEditorBasicFields(autoStarterMoveId 再導出)、束ねセットプレイへの characterId 伝播、`CheckDuplicateRequest.characterId`。
- CHANGE-036 切替挙動: dirty 判定→確認ダイアログ→破棄で全体リセット／キャンセルで制御コンポーネント revert。

**スコープに含まないもの**: ComboEditor 外のエントリポイント既定値(M10-02)、custom_states 消費(M11、§2.5 既知制約)、バックエンド変更(API は character_id 既存)。

**前提**: M9 完了(クラシック5体データ投入済み)。CHANGE-036 反映済み(DES-005 v2.20.0)。

**例外条項**: 該当なし(フロント完結。`CreateRequest.characterId` 既存)。

**推奨モデルの根拠**: 関心 = new/edit/copy モード分岐 + キャラ選択 state 化 + 選択キャラの下流連動 + CHANGE-036 のステートフル切替 UX。複数関心が絡むため Opus + Plan Mode 必須(playbook §7.1 Opus 信号、M2-04/M6-02 の統合・仕上げ系と整合)。**着手直前に Plan Mode 結果で最終確定**(state 機構が単純なら Sonnet 再検討の余地あり)。

**Plan Mode 必須項目**: M10-01 指示書 §3.4 の5項目(characterId 供給源 / Create サービス消費経路 / state 機構と CharacterSelector 配置 / 切替 reset 配線 / preset 連動)。

**指示書執筆時の留意点**: code-facts は参考とし実装確認は実コードで(retrospective-digest §1 パターンA)。§4.10 表示項目↔実装対応表を作成(playbook §4.10)。§4.11 既知制約(situation = M11 送り)を明記。

### 4.2 M10-02: リュウ固定依存 UX の画面横断解消(A-2)

**目的**: M10-01 の選択化を画面横断で仕上げる。ComboEditor 外のエントリポイントに残るリュウ固定/既定キャラ固定(新規登録導線の既定キャラ、選択モード、コンボ追加モーダルの既定値・固定表示)を選択キャラ追従へ。

**スコープに含むもの(着手時に実コードで確定)**: フッター/ヘッダの新規登録導線が渡す既定キャラ、選択モード(`useSelectMode` 系)のキャラ依存、`AddComboToCompareModal` 等のモーダルの既定値・固定表示。**実装済み/未実装は code-facts + 実 view で確認してから確定**(M7-03 R-3 で `AddComboToCompareModal` のキャラフィルタが手当て済みの可能性を含め、想定で決めつけない)。

**スコープに含まないもの**: M10-01 で扱う ComboEditor 内部。M11 custom_states。

**前提**: M10-01 完了承認済み。

**推奨モデル**: 着手時記入(M10-01 の確立パターンをエントリポイントへ適用する機械的作業中心なら Sonnet 想定。実スコープ確定後に判断)。

---

## 5. 実行順序と依存関係

```
M10-01(ComboEditor キャラクター選択化、A-1)
  ↓
M10-02(リュウ固定依存 UX の画面横断解消、A-2)
M10 完了
```

**完全直列実行**(playbook、M2 以降から継続)。M10-02 は M10-01 で確立した選択化パターン・CharacterSelector 配置に依存するため、M10-01 完了承認後に着手。各サブユニット完了後に開発者が動作確認・承認してから次へ。同時稼働ターミナルは設計担当(本セッション)+ 製造担当 + レビュー担当の3本を超えない。

---

## 6. M10 で扱わないもの

製造担当が「実装範囲を広げる誘惑」に駆られた際の判断基準。

| 項目 | 扱い |
|------|------|
| custom_states 消費の機能化(situation キャラ固有状態) | M11。M10 では situation は汎用入力のまま(§2.5 既知制約、埋めないことが正) |
| バックエンドの API 変更 | 不要(character_id 既存)。必要が生じたら Plan Mode 停止 + CHANGE 起票判断 |
| プリセット選択のキャラスコープ化 | 原則不要(preset はキャラ非スコープ)。M10-01 Plan Mode で確認 |
| 英語ロケール / 他ゲーム | フェーズ3 以降 |
| moves 手動 CRUD(B-2)等 backlog | M9 外後続候補。M10 のサブにしない |

---

## 7. モデル配分まとめ(model-allocation.md v1.14.0 反映済み)

| ID | 実装モデル | レビューモデル |
|----|----------|--------------|
| M10-01 | Opus 4.8(暫定) | Sonnet 4.6 |
| M10-02 | (着手時記入) | (着手時記入) |

**配分根拠**: playbook §7 判断軸(関心の絡み合い)。M10-01 は new/edit/copy モード分岐 + キャラ選択 state 化 + 下流連動 + CHANGE-036 ステートフル UX で複数関心が絡むため Opus + Plan Mode 必須。着手直前の Plan Mode 結果で最終確定。M10-02 は実スコープ確定後に記入。

**model-allocation.md 反映済み**: 本 overview と同時に `model-allocation.md` v1.13.0 → v1.14.0 として M10 セクションを追記済み(2026-06-18)。

---

## 8. 持ち越し課題の組み込み方針

- progress-summary §10「M10 着手時点の持ち越し課題」を着手時に確認し、M10 スコープに関わるものは各指示書 §1.1 背景へ取り込む。
- M9 完了処理の残(retrospective-log の M9 期間追記)は M10 と並行して設計担当が実施。
- M10 期間で発生した教訓は M10 完了時に retrospective-log へ追記(digest 更新は Claude Code の `/retrospective-digest-update`)。

---

## 9. CHANGE 通知書の起票予定

- **CHANGE-036(反映済み、2026-06-18)**: DES-005 §5.7 に新規モードのキャラ変更時の確認・破棄挙動(確認ダイアログ→全体リセット／キャンセルで revert／dirty 時のみ発火)を追記(DES-005 v2.19.0 → v2.20.0)。次回採番 **037**(欠番 008/009/014)。
- **M10 期間中の追加起票は最小限想定**(retrospective-digest §6 厳格適用、CHANGE 対象 = REQ-001 + DES-001〜006 のみ)。想定シナリオ: M10-01 Plan Mode で DES-005 §5.7 の他項目に乖離が判明した場合、M10-02 でエントリポイント既定値に関し DES-005 の追記が必要な場合。いずれも設計書本体改訂を伴う場合のみ起票。

---

## 10. リスクと対策

### 10.1 ComboEditor の現状 state 機構の不確実性(技術リスク中)

- **リスク**: ComboEditor の characterId 供給源・state 機構(react-hook-form か局所制御か)が code-facts では判別できず、実装位置を誤ると reset/revert 配線が破綻。
- **対策**: M10-01 §3.4 で実 view を Plan Mode 必須化。code-facts は参考に留め実コードを最終根拠とする(retrospective-digest §1 パターンA)。

### 10.2 切替時の制御コンポーネント revert 漏れ(UX リスク中)

- **リスク**: 「キャンセル」時にプルダウン表示を変更前へ戻さないと、表示と state が乖離(arch-patterns §1.2.6 native select / Radix の制御挙動)。
- **対策**: CHANGE-036 / DES-005 §5.7 に「選択を変更前に戻す」を規範化済み。M10-01 §4.4 + テスト要件(キャンセルで選択 revert + 内容保持のケース)で担保。

### 10.3 キャラスコープ無効化の取りこぼし(データ整合リスク中)

- **リスク**: 切替時に steps / starterMoveId / 束ねセットプレイ steps のリセットを取りこぼすと、旧キャラの move ID が新キャラの登録に混入。
- **対策**: 全体リセット採用(§2.3)で取りこぼし面を最小化。E2E シナリオ(破棄で全体リセット)で確認。

### 10.4 M10-02 スコープの実態未確認(スコープリスク中)

- **リスク**: エントリポイントのリュウ固定箇所を想定で列挙すると、実装済み箇所への二重対応や未対応箇所の漏れが生じる。
- **対策**: M10-02 着手時に code-facts + 実 view で該当箇所を洗い出してからスコープ確定(§4.2)。playbook §4.12「枠の独断拡張禁止」と整合。

---

## 11. M10 期間で意識する教訓(retrospective-digest 由来)

- **実コード確認の省略を避ける**(§1 パターンA): characterId 供給源・state 機構・Create 消費経路・M10-02 対象箇所は実 view で裏取り。症状のレイヤ ≠ 真因のレイヤ。
- **ユーザーフロー視点**(§1 B): 初回登録/既存編集/コピー/キャラ切替の各経路がフローで揃うか確認。
- **表示項目↔実装対応表**(§4 / playbook §4.10): §5.7 の全表示項目を既存実装にマッピング(M10-01 §4.10)。
- **将来送り/スコープ外の帰結明記**(§3 / playbook §4.11): situation = M11 送りの既知制約を明記、埋めないことが正と書く。
- **CHANGE 起票規律**(§6): 対象は REQ-001 + DES-001〜006 のみ。補足資料は自由改訂。
- **マイルストーン構造の独断拡張禁止**(playbook §4.12): 新サブユニット・新規 overview・CHANGE 対象拡大は開発者合意の枠内で。

---

## 12. 想定スケジュールと作業順序

playbook 完全直列方針 + ターミナル3本制約に従う。

| # | 工程 | 担当 |
|---|------|------|
| 0 | M10-overview 作成 + model-allocation v1.14.0 追記 | 設計担当(本セッション、実施済み) |
| 1 | M10-overview 開発者承認 | 開発者 |
| 2 | M10-01 指示書(骨子 v0.1.0)→ Plan Mode 後 v1.0.0 確定 + レビューチェックリスト作成 | 設計担当 |
| 3 | M10-01 製造工程(Plan Mode)+ 機械レビュー + 開発者 E2E + 完了承認 | 製造担当(Opus 暫定)+ レビュー担当 + 開発者 |
| 4 | M10-02 指示書 + レビューチェックリスト作成(実スコープ確定 + model-allocation 追記) | 設計担当 |
| 5 | M10-02 製造工程 + 機械レビュー + 開発者 E2E + 完了承認 | 製造担当 + レビュー担当 + 開発者 |
| 6 | M10 完了処理(retrospective-log 追記、handover 更新、M11 着手準備) | 設計担当 + 開発者 |

設計担当の作業並行は可。**実機 E2E が完了の必須ゲート**(レビュー承認 ≠ 完了承認)。

---

## 13. M10 完了判定

以下すべてを満たすことで M10 完了承認:

### 13.1 サブユニット完了承認

- [ ] M10-01 / M10-02 各サブユニット完了承認済み

### 13.2 機能要件

- [ ] ComboEditor 新規モードでクラシック5体を選択して登録でき、選択キャラの `characterId` が保存される
- [ ] 選択キャラに応じて moves・始動技候補・仮想コントローラ・束ねセットプレイ・重複検知が追従する
- [ ] 編集モードはキャラ固定表示、コピーモードは選択可
- [ ] CHANGE-036 切替挙動(dirty 時に確認→破棄で全体リセット／キャンセルで revert／初期状態は無確認)が動作する
- [ ] ComboEditor 外のエントリポイントでリュウ固定/既定キャラ固定が解消され選択キャラに追従(M10-02)

### 13.3 既存機能の回帰なし

- [ ] 閲覧系の複数キャラ動的化(useCharacters)に非回帰
- [ ] M8-02 以降の E2E spec に非回帰、M10 機能の spec を追加

### 13.4 ドキュメント

- [ ] CHANGE-036 反映確認(DES-005 v2.20.0 / change-number-registry v1.23.0)
- [ ] M10-01 / M10-02 指示書・レビューチェックリスト作成済み
- [ ] model-allocation に M10-01 / M10-02 記入済み
- [ ] retrospective-log に M10 期間追記、handover を M11 へ更新

---

## 14. 関連ドキュメント

> パスは docs-map.md(commit 9fd1a69)準拠で確定。設計書本体 = `docs/design/`、設計担当恒久資料・引き継ぎ = `docs/handover/`、**指示書・overview = `docs/instructions/`、レビューチェックリスト = `docs/instructions/reviews/`**、CHANGE = `docs/change-notes/`、モデル配分 = `docs/human-notes/`、進捗 = `docs/progress/`、CLAUDE.md = リポジトリルート。

| 種類 | ファイル | 役割 |
|------|---------|------|
| 設計書本体 | `docs/design/requirements.md` | REQ-001 v2.15.0、§7 フェーズ定義 |
| 設計書本体 | `docs/design/01-tech-stack.md` | DES-001 v1.3.0 |
| 設計書本体 | `docs/design/02-architecture.md` | DES-002 v1.19.0、§4.2 combos / moves API |
| 設計書本体 | `docs/design/03-data-model.md` | DES-003 v1.20.0、moves / combos / characters スキーマ |
| 設計書本体 | `docs/design/04-notation-spec.md` | DES-004 v1.6.0、§2.1 code 規約 |
| 設計書本体 | `docs/design/05-screen-design.md` | DES-005 **v2.20.0**(CHANGE-036 反映)、§5.7 登録・編集 / §4.1 / §4.3 |
| 設計書本体 | `docs/design/06-validation.md` | DES-006 v1.11.0 |
| 設計補足 | `docs/design/supp-001-detailed-design.md` | SUPP-001 v1.24.0、§4.1 フェーズ2 分割は phase2-overview 参照 |
| 設計担当恒久資料 | `docs/handover/design-instruction-playbook.md` | playbook v1.11.0、§4.10 / §4.11 / §4.12 / §7 / §16 |
| 設計担当恒久資料 | `docs/handover/code-facts.md` | commit ff0620b、§1 Props / §2 queryKey / §3 ルート / §4 Go ルート / §7-2 リクエスト DTO |
| 設計担当恒久資料 | `docs/handover/architecture-patterns.md` | 現行版、§1.1 queryKey / §8 react-hook-form / §9.1 custom_states |
| 設計担当恒久資料 | `docs/handover/change-number-registry.md` | **v1.23.0**、次回採番 037 |
| 設計担当恒久資料 | `docs/handover/retrospective-digest.md` | 現役教訓の蒸留版(指示書執筆前に必読) |
| 反省記録 | `docs/handover/retrospective-log.md` | 事例アーカイブ(必要時に参照) |
| マイルストーン引き継ぎ | `docs/handover/m9-to-m10-handover.md` | M9 完了 + M10 着手 |
| CHANGE 通知書 | `docs/change-notes/CHANGE-036-M10-01-combo-editor-character-switch.md` | CHANGE-036(新規モードのキャラ変更挙動) |
| CHANGE 反映レポート | `docs/change-notes/change-report-036.md` | CHANGE-036 反映完了レポート |
| マイルストーン overview | `docs/instructions/phase2-overview.md` | フェーズ2 マイルストーン分割の正本 v0.2.0、§M10 |
| マイルストーン overview | `docs/instructions/M10-overview.md`（本書） | M10 全体像 |
| 製造指示書 | `docs/instructions/M10-01-instruction.md` | M10-01 製造指示書 骨子 v0.1.0 |
| レビューチェックリスト | `docs/instructions/reviews/M10-01-review-checklist.md` | M10-01 レビューチェックリスト 骨子 v0.1.0 |
| パス対応表 | `docs/handover/docs-map.md` | 文書ID ⇄ 実パス逆引き・docs 配下役割マップ(自動生成) |
| モデル配分 | `docs/human-notes/model-allocation.md` | **v1.14.0**(M10 セクション追記済み) |
| 進捗サマリ | `docs/progress/progress-summary.md` | M0〜M9、§10 M10 着手時持ち越し |
| プロジェクト指針 | `CLAUDE.md` | 製造担当 / レビュー担当向け |

---

## 15. 開発者承認チェックリスト

- [ ] §1.1 スコープ(ComboEditor 選択化 + 画面横断 UX 解消、M10-01 / M10-02 の2サブユニット)が妥当
- [ ] §1.3「作らないもの」の除外判断(custom_states 消費 = M11 / BE 変更不要 / 英語・他ゲーム / backlog / preset スコープ化)が妥当
- [ ] §2.1 登録系 API は character_id 既存＝フロント完結(code-facts §7-2)で相違ない
- [ ] §2.3 切替時 UX(確認→全体リセット／キャンセルで revert、CHANGE-036)が確定方針で相違ない
- [ ] §2.4 サブユニット分割(M10-01 内部選択化 / M10-02 画面横断)が妥当
- [ ] §2.5 既知制約(situation = M11 送り、埋めないことが正)が妥当
- [ ] §3.1 / §7 モデル配分(M10-01 = Opus 暫定 + Plan Mode 必須、M10-02 = 着手時記入)が妥当、model-allocation v1.14.0 反映済み確認
- [ ] §13 M10 完了判定基準が妥当

承認後、設計担当 Claude が M10-01 指示書を Plan Mode 結果で v1.0.0 へ確定 + レビューチェックリスト作成に進む。

---

*以上、M10-overview v1.0.0*
