# 指示書 M4-03: FR011 転用支援 + knockdown_advantage 確認モーダル

| 項目 | 内容 |
|------|------|
| 指示書ID | M4-03 |
| バージョン | 1.0.2 |
| 対象マイルストーン | M4(セットプレイ系) |
| 推奨モデル | **Opus 4.6** |
| Plan Mode | **必須**(M2-02 編集 2 方式分離との接続点が非自明、Plan Mode で接続方針を協議) |
| 機械レビュー | **必須**(別チェックリスト: `docs/instructions/reviews/M4-03-review-checklist.md`) |
| 並列性 | **単独**(M4 は完全直列、M4-02 完了承認済みが前提) |
| 依存指示書 | M4-01(setup CRUD API + GetSetupCandidates スタブ)、M4-02(コンボ詳細・編集の setup 紐付け UI)、M2-02(編集 2 方式分離) |
| 想定所要時間 | 180〜240 分 |
| 作成者 | 詳細設計・製造準備担当 Claude(M4 期間担当) |
| 作成日 | 2026-05-18 |
| セルフチェック上の注意 | 本書 §4.10.2 はトースト通知文言として DES-005 §5.7 v2.8.0 規定を引用しているため、grep セルフチェック(playbook §4 系禁則表現)で「必要に応じて」が検出されるが、引用部分であり「DES-005 §5.7 規定の引用」と明示済み。指示の曖昧表現ではない |

## 更新履歴

| バージョン | 更新日 | 更新内容 |
|-----------|--------|----------|
| 1.0.0 | 2026-05-18 | 初版作成。M4-overview v1.1.2 §3.4 / DES-005 §5.6 item 9(FR011 候補)/ §5.7 編集保存の動作節(CHANGE-013 v2.8.0 反映後)を踏まえて起票。M4-01 §4.2.7 GetSetupCandidates スタブの本実装と、コンボ更新 API への引き継ぎオプション追加を含む。M4-1〜M4-7 反省踏襲:DES-005 §5.x の表示項目とアクション節をペアで読む(M4-6 由来)、UI 動線から逆算した API エンドポイント網羅性確認(M4-4 由来)、一覧/詳細型分岐の意識(M4-5 由来)、Props 最小化(M4-5 由来)、規定なしも明示(M4-7 由来)、E2E 実機確認を完了判定の必須ゲートに(M4-02 E2E 由来) |
| 1.0.1 | 2026-05-18 | 製造担当 Plan Mode 中の連絡事項を受けたトースト通知実装方針の確定(案 1: 既存 topMessage 流用を採用)。(1) §4.10.2 トースト通知の実装方針を「既存 topMessage パターン流用」に確定(sonner / react-hot-toast 等のライブラリ追加は本指示書スコープ外)。(2) §3.4 着手前確認に §3.4.5「トースト通知用 UI 基盤の既存有無確認」を新設し、ComboEditor 既存 topMessage パターンの構造確認を必須化。§3.4.6 報告と §3.4.7 着手の前提条件の番号を §3.4.6 → §3.4.7、§3.4.7 → §3.4.8 に繰り下げ。(3) §4.11 設計判断事項表に「トースト通知の実装方針: 既存 topMessage 流用、ライブラリ追加なし」を追加。(4) 本件は設計担当(M4 期間担当)の指示書執筆ミス(トースト基盤の未確認、DES-005 §5.7「トースト」表現を実装手段として深く考慮しなかった規定漏れ)として retrospective-log v1.0.9 §5.1 M4-8 に独立記録 |
| 1.0.2 | 2026-05-19 | M4-03 E2E 完了直前の製造担当連絡事項を受けた、§4.4.2 候補抽出 SQL 仕様の規定追加(M4-10 設計担当規定漏れに伴う事後整合修正)。E2E 不具合②(「このコンボにも紐付ける」後、候補欄から消えない)の真因がバックエンド `FindCandidateSetups` の SQL 不備(対象コンボに既に紐付いた setup 自体を除外していなかった)だったことを踏まえ、§4.4.2 リポジトリ層 SQL ベースクエリに「対象コンボに既に紐付く setup を除外する条件」を追加。当初 v1.0.0〜v1.0.1 では `c.id != ?`(対象コンボ「経由のJOIN」のみ除外)で対象コンボ自身が候補に残るシナリオを見落としていた。本件は設計担当(M4 期間担当)の指示書執筆ミス(候補抽出 SQL の論理的完全性確認漏れ)として retrospective-log v1.0.12 §5.1 M4-10 に独立記録。製造担当の実装は v1.0.2 規定通りの SQL に既に修正済み(指示書を実装に整合化する事後修正、製造担当への伝達は不要、M4-04 / M5 以降の指示書執筆観点として活用) |

---

## 1. 背景と目的

### 1.1 背景

M4-01 で setup ドメインのバックエンド CRUD API が完成し、`GET /api/combos/{id}/setup-candidates` の API 形のみが空配列を返すスタブとして実装済み。M4-02 で setup 単体 UI + コンボ詳細・コンボ編集からの紐付け操作 UI が完成し、コンボ詳細画面に紐付き setup 一覧(§5.6 item 8)が表示される状態。

本指示書では DES-005 §5.6 item 9「転用可能なセットプレイ候補」(FR011)を実装し、コンボ詳細画面に「同一キャラ + 同一 `knockdown_advantage` の他コンボに紐付いている setup を候補として表示する」セクションを追加する。あわせて、DES-005 §5.7「編集保存の動作」(CHANGE-013 v2.8.0 反映後)で確定した「knockdown_advantage 変更時の確認モーダル」を実装し、コンボ編集画面で knockdown_advantage が変更された場合に紐付き setup の引き継ぎ方針(すべて引き継ぐ / 紐付けを外す / 個別に選択)をユーザーに確認できるようにする。

M4-03 完了後、M4-04 でコンボ + セットプレイ同時登録 + 統合 E2E + L-01 解消に進む。

### 1.2 目的

- **FR011 転用候補抽出 API の本実装**:
  - M4-01 §4.2.7 のスタブから挙動仕上げ
  - サービス層 / リポジトリ層で「同一キャラ + 同一 knockdown_advantage の他コンボに紐付いている setup」抽出ロジックを実装
  - レスポンスは `SetupSummary[]` 軽量型(M4-02 で確立した規約と整合、M4-5 反省踏襲)
- **FR011 転用候補 UI(DES-005 §5.6 item 9)**:
  - `useSetupCandidates` フック + `SetupCandidateList` 表示専用コンポーネント
  - ComboDetailPage への候補セクション追加(§5.6 item 9 の位置)
  - 「このコンボにも紐付ける」ボタン → 既存の `useCreateSetupLink`(M4-02 実装)経由
  - 候補 0 件時はセクション自体非表示
- **knockdown_advantage 変更時の確認モーダル(DES-005 §5.7、CHANGE-013 v2.8.0 反映後)**:
  - コンボ編集画面で knockdown_advantage 変更検知
  - 紐付き setup ≥ 1 件の場合、保存前にモーダル表示
  - 選択肢 3 つ: 「すべて引き継ぐ」「紐付けを外す」「個別に選択」
  - 「個別に選択」UI: チェックボックス付きセットプレイ一覧
  - 保存時のトランザクションで `combo_setups` の引き継ぎ判断を反映
  - knockdown_advantage が変わらない場合の挙動: (a) 保存方式ではトースト通知、(b) 保存方式では何もしない(DES-005 §5.7 修正後の規定通り)
- **コンボ更新 API への引き継ぎオプション追加**(本指示書のバックエンド追加範囲):
  - 既存 `PATCH /api/combos/{id}` / `PUT /api/combos/{id}` 系統に `setupCarryOptions` パラメータを追加
  - サービス層で combo_setups の引き継ぎ判断を反映

### 1.3 このマイルストーンで作らないもの

- **コンボ + セットプレイ同時登録セクション**(DES-005 §5.7 item 10) — M4-04 で実装
- **持ち越し L-01 オプショナル型整理** — M4-04 で対応
- **セットプレイの削除ボタン UI / ゴミ箱 / 復元 UI** — M4-02 §1.3 と同じく M5 以降または M7 で判断
- **knockdown_advantage 確認モーダルのモック実装** — 2026-05-16 開発者方針で実物実装に確定、モックは作らない
- **セットプレイ独立一覧画面** — DES-005 §2 表(画面一覧)で「独立一覧なし」と明示されている。M4 期間内では作らない
- **既存パターンとの統合リファクタ**(SetupAccordionItem と SetupCandidateList の共通化等) — M4-03 では新規実装に集中、リファクタは M5 以降または M7

---

## 2. 成果物

### 2.1 作成するファイル

#### バックエンド(setup ドメイン、M4-01 完成済みコードへの本実装拡張)

| ファイル | 内容 |
|---------|------|
| `internal/service/setup/service.go`(修正) | `GetSetupCandidates` 本実装(M4-01 のスタブから挙動仕上げ) |
| `internal/service/setup/service_test.go`(修正) | `GetSetupCandidates` の動作テスト追加 |
| `internal/repository/setup/repository.go`(修正) | 候補抽出クエリ追加(`WHERE character_id = ? AND knockdown_advantage = ? AND combos.id != ?`) |
| `internal/repository/setup/repository_test.go`(修正) | 候補抽出クエリのテスト追加 |
| `internal/api/setup/handler.go`(修正) | `GetSetupCandidates` ハンドラの本実装(M4-01 スタブから挙動仕上げ、レスポンス JSON を `SetupSummary[]` 配列で返す) |
| `internal/api/setup/handler_test.go`(修正) | ハンドラのテスト追加 |

#### バックエンド(combo ドメイン、引き継ぎオプション追加)

| ファイル | 内容 |
|---------|------|
| `internal/api/combo/dto.go`(または相当、修正) | `UpdateComboInput` / `PatchComboInput` に `SetupCarryOptions *SetupCarryOptionsInput \`json:"setupCarryOptions,omitempty"\`` を追加(本指示書 §4.5 で型定義詳細) |
| `internal/service/combo/update.go`(または相当、修正) | コンボ更新時に `setupCarryOptions` を解釈、combo_setups の引き継ぎ判断を反映 |
| `internal/service/combo/update_test.go`(または相当、修正) | 引き継ぎ判断のテスト追加 |
| `internal/repository/combo_setup/repository.go`(または相当、修正) | combo_setups の操作関数追加(引き継ぎ・除外) |

#### フロントエンド(setup フィーチャ、新設・修正)

| ファイル | 内容 |
|---------|------|
| `web/src/features/setup/api/setupApi.ts`(修正) | `getCandidates(comboId)` メソッド追加 |
| `web/src/features/setup/api/setupApi.test.ts`(修正) | テスト追加 |
| `web/src/features/setup/hooks/useSetupCandidates.ts`(新設) | `useSetupCandidates(comboId)` フック |
| `web/src/features/setup/hooks/useSetupCandidates.test.ts`(新設) | フックテスト |
| `web/src/features/setup/components/SetupCandidateList.tsx`(新設) | 候補一覧表示専用コンポーネント |
| `web/src/features/setup/components/SetupCandidateList.test.tsx`(新設) | コンポーネントテスト |

#### フロントエンド(combo フィーチャ、knockdown_advantage 確認モーダル)

| ファイル | 内容 |
|---------|------|
| `web/src/features/combo/components/KnockdownAdvantageChangeModal.tsx`(新設) | knockdown_advantage 変更時の確認モーダル |
| `web/src/features/combo/components/KnockdownAdvantageChangeModal.test.tsx`(新設) | モーダルテスト |
| `web/src/features/combo/hooks/useUpdateCombo.ts`(または相当、修正) | `setupCarryOptions` 引数の追加対応 |
| `web/src/features/combo/types.ts`(修正) | `SetupCarryOptions` 型定義追加 |

#### 既存ページの修正

| ファイル | 修正内容 |
|---------|---------|
| `web/src/pages/ComboDetailPage.tsx`(または相当) | §5.6 item 9 「転用可能なセットプレイ候補」セクション追加。`useSetupCandidates(comboId)` + `SetupCandidateList` で表示。候補 0 件時はセクション自体非表示 |
| `web/src/pages/ComboDetailPage.test.tsx`(または相当) | テスト追加 |
| `web/src/pages/ComboEditorPage.tsx`(または相当) | 保存ボタン押下時、knockdown_advantage 変更検知 + 紐付き setup ≥ 1 件で `KnockdownAdvantageChangeModal` を表示する分岐ロジック追加 |
| `web/src/pages/ComboEditorPage.test.tsx`(または相当) | 分岐ロジックのテスト追加 |

### 2.2 変更しないもの(原則)

- M4-01 で実装した setup CRUD API のシグネチャ・既存エンドポイント(本指示書では `GetSetupCandidates` のサービス層・リポジトリ層本実装と、ハンドラのレスポンス形を SetupSummary に切り替えるのみ。エンドポイント自体は M4-01 で定義済み)
- M4-02 で実装した setup フロントエンド既存ファイル(本指示書では追加ファイルと既存 setupApi の `getCandidates` メソッド追加のみ)
- M3 までに確立したフック分離パターン(architecture-patterns.md §1)、TanStack Query queryKey 規約(architecture-patterns.md §1.1、number 正規化)
- 既存の SF6Controller / RecipeBuilder / ModifiersEditor
- M4-02 で確定した `SetupSummary` / `SetupResponse` 型構造
- DES-005 §5.7 (a)(b) 編集 2 方式分離の基本フロー(M2-02 で確立、本指示書では knockdown_advantage 変更時の確認モーダル分岐を **追加** する形)

### 2.3 例外: バックエンドへの追加実装が許容される箇所

本指示書は **フロントエンドとバックエンド両方** を含む(M4-01 でスタブ確定された FR011 候補抽出ロジックの本実装、および combo 更新 API への引き継ぎオプション追加)。許容される追加実装の範囲:

- §4.4 `GetSetupCandidates` の本実装(サービス層 + リポジトリ層 + ハンドラのレスポンス形)
- §4.5 コンボ更新 API への `SetupCarryOptions` パラメータ追加

上記 2 件以外のバックエンド変更は禁止。万一実装中にこれら以外のバックエンド変更が必要と判断した場合、Plan Mode で停止して開発者に相談すること。

---

## 3. 前提条件

### 3.1 必読ドキュメント

製造担当 Claude Code は実装着手前に以下を読む:

| ID / ファイル | 関連節 |
|--------------|--------|
| 本指示書 | 全体 |
| CLAUDE.md | §4 TypeScript / Go 規約、§5 テスト規約、§10 禁止事項 |
| **DES-005 v2.8.0** | **§5.6 item 9 FR011 候補、§5.7 編集保存の動作節(CHANGE-013 反映後、knockdown_advantage 変更時の確認モーダル仕様)** |
| DES-006 v1.9.0 | §3 VAL-S01〜S05(setup バリデーション、本指示書では新規 setup 作成しないため間接参照) |
| **M4-01 指示書 v1.0.2** | **§4.2.7 GetSetupCandidates スタブ実装、§4.2.1 SetupResponse 型、SetupSummary 型(M4-02 v1.0.2 で確定)** |
| **M4-02 指示書 v1.0.4** | **§4.2 setup フロント型定義、§4.4 setup フック群、§4.13.1 SetupSummary 軽量型、§4.10 ComboDetailPage 修正方針** |
| architecture-patterns.md v1.0.1 | §1 フック分離パターン、§1.1 TanStack Query queryKey 規約(number 正規化) |
| CHANGE-013 通知書 v1.1.0 | §5.7 編集保存の動作節における knockdown_advantage 変更時の確認モーダル仕様の節編成整合化 |
| **REQ-001 FR011** | セットプレイ転用支援の要件定義 |
| **REQ-001 FR004** | コンボ編集の保存方式 2 種類分離(編集 2 方式分離) |

### 3.2 任意参照(必要時のみ)

| ID / ファイル | 参照タイミング |
|--------------|--------------|
| M2-02 指示書 | 編集 2 方式分離の実装パターン参照時 |
| M3-04 指示書 | useCharacters フック分離パターンの参考 |
| M3-05 指示書 | recipe_cache 連動の参考(M3 期間で確立、setup でも踏襲) |
| SUPP-001 §3.3.0 / §7.4 / §7.5 | Modifiers 構造体、notation サービス層、recipe_cache 責務 |
| playbook v1.6.0 | §4.5 フローの素直さ原則、§4.6 UI ライブラリ実態確認原則、§14 完了判定 |
| retrospective-log v1.0.8 | M4-1〜M4-7 反省 + M4-02 E2E 由来知見 |

### 3.3 参照不要

- DES-003 §3.11〜§3.13 永続化テーブル定義(本指示書では既存テーブル構造を変更しない)
- DES-004 内部表現仕様(notation 解決は既存ロジックを再利用)

### 3.4 着手前の確認(M4-02 で確立した運用、案 b 採用)

製造担当 Claude Code は §4 詳細仕様の実装に着手する前に、以下を確認する。**結果を Plan Mode で開発者に報告すること**(本指示書は Plan Mode 必須)。

#### 3.4.1 M4-01 / M4-02 setup ドメインの動作確認

```bash
# サーバーを起動した状態で:

# M4-01 で実装済みのスタブ動作確認
curl http://localhost:8080/api/combos/1/setup-candidates
# 期待: 200 + {"items": []}(空配列、スタブ実装)

# M4-02 で実装済みの setup 一覧
curl http://localhost:8080/api/setups?characterId=1
# 期待: 200 + {"items": [SetupSummary, ...]}

# M4-02 で実装済みのコンボ詳細(setups フィールド埋め込み)
curl http://localhost:8080/api/combos/1 | jq '.setups'
# 期待: setups 配列(空配列または SetupResponse[])
```

期待される確認事項:

- M4-01 setup CRUD API が動作している
- `GET /api/combos/{id}/setup-candidates` がスタブとして 200 + 空配列を返す(本指示書で本実装に拡張)
- M4-02 で確定した `SetupSummary` 軽量型(steps なし、createdAt / updatedAt なし、parentComboIds と defaultRecipe を含む)が `GET /api/setups?characterId=X` レスポンスで返る
- M4-02 で確定した `ComboDetailResponse.setups` フィールドが存在する

#### 3.4.2 M2-02 編集 2 方式分離の実装実態確認(最重要)

```bash
# コンボ更新 API のハンドラ・サービス層の実態確認
ls internal/api/combo/
ls internal/service/combo/
cat internal/service/combo/update.go 2>/dev/null | head -80
# または相当ファイル名(grep -rn 'EditCombo\|UpdateCombo' internal/service/combo/ で探索)

# 編集 2 方式分離の判定ロジック
grep -rn '重複判定キー\|isDuplicateKeyChange\|isMetadataOnlyChange\|case.*REPLACE\|case.*PATCH' internal/service/combo/ | head -10

# フロント側 ComboEditorPage の保存フロー
cat web/src/pages/ComboEditorPage.tsx 2>/dev/null | head -60
# または:
grep -rn 'useUpdateCombo\|useEditCombo' web/src/features/combo/hooks/ | head -10
```

期待される確認事項:

- バックエンド側コンボ更新サービスがどのファイル・関数で実装されているか
- 編集 2 方式分離の判定ロジック(レシピ・始動技・position・opponent_stance・hit_type・opponent_size の変更検知)がどう実装されているか
- フロント側 ComboEditorPage の保存フロー(`useUpdateCombo` 等のフックの構造)
- 本指示書 §4.5 で「コンボ更新 API に `setupCarryOptions` パラメータを追加」する際に、既存のどの関数を修正するかの判断材料

**M4-3 / M4-4 反省踏襲**: 既存パターンと API 設計の整合性を実コードで確認してから新規実装に着手する。

#### 3.4.3 M4-02 で確立した setup 関連フックの確認(再利用前提)

```bash
ls web/src/features/setup/
ls web/src/features/setup/hooks/
cat web/src/features/setup/hooks/useSetupLinks.ts 2>/dev/null
cat web/src/features/setup/api/setupApi.ts 2>/dev/null | head -40
```

期待される確認事項:

- `useCreateSetupLink` / `useDeleteSetupLink` が動作する形で M4-02 完了状態を保っている
- `setupApi` の既存メソッドリスト(create / get / update / remove / createLink / deleteLink)
- 本指示書 §4.3 で追加する `setupApi.getCandidates` の命名・配置の整合性

#### 3.4.4 useCombo queryKey 規約(architecture-patterns.md §1.1)の踏襲確認

```bash
cat web/src/features/combo/hooks/useCombo.ts 2>/dev/null
grep -rn 'queryKey.*combo' web/src/features/combo/ | head -5
```

期待される確認事項:

- `useCombo` の queryKey が `['combo', { id: number }]` 形式(number 正規化済み、M4-02 で修正済み)
- 本指示書 §4.3 で追加する `useSetupCandidates` の queryKey も同パターン(`['setupCandidates', { comboId: number }]`)で書く前提

#### 3.4.5 トースト通知用 UI 基盤の既存有無確認(v1.0.1 で新設、M4-8 反省踏襲)

```bash
# トーストライブラリの既存有無
grep -rn 'react-hot-toast\|sonner\|@radix-ui/react-toast' web/package.json
ls web/src/lib/ 2>/dev/null | grep -i 'toast\|notif'

# ComboEditor の既存 topMessage パターン
grep -rn 'topMessage\|setTopMessage\|showMessage' web/src/pages/ComboEditor* web/src/features/combo/ | head -10
cat web/src/pages/ComboEditorPage.tsx 2>/dev/null | grep -A 5 'topMessage'
```

期待される確認事項:

- **トーストライブラリは未導入の前提**(react-hot-toast / sonner / @radix-ui/react-toast 等のインストールが web/package.json に **ない** こと、shadcn/ui エコシステムが M7 まで未導入であることと整合)
- ComboEditor または相当ファイルに **既存の topMessage パターン**(state ベースで画面上部にメッセージを表示する仕組み)が存在することの確認
- 既存 topMessage パターンの型・関数シグネチャの確認(本指示書 §4.10.2 で再利用する前提)

**重要(v1.0.1 で確定)**: 本指示書のトースト通知実装は **既存 topMessage パターンを流用** する(案 1)。トースト系の新規ライブラリ追加は本指示書のスコープ外。万一既存 topMessage パターンが存在しない、または期待される構造と大きく異なる場合は、Plan Mode で停止して開発者に報告すること(代替案: alert / console.log で済ませる、または M5 以降に持ち越す等を協議)。

#### 3.4.6 確認結果の報告

製造担当 Claude Code は §3.4.1〜§3.4.5 の確認コマンド出力を **Plan Mode で開発者に報告すること**。本指示書は Plan Mode 必須。

特に **§3.4.2 M2-02 編集 2 方式分離の実装実態** は本指示書のコア部分(knockdown_advantage 変更時の確認モーダル)の前提条件のため、明示的に報告すること。また **§3.4.5 トースト通知用 UI 基盤の既存有無**(v1.0.1 で追加)も §4.10.2 の前提条件のため、明示的に報告すること。

#### 3.4.7 §4 着手の前提条件

§3.4.1〜§3.4.5 のすべての確認結果が期待通りであることを Plan Mode で開発者と合意してから、§4 詳細仕様の実装に着手する。万一現状が想定と乖離する場合(例: M2-02 編集 2 方式分離の判定ロジックが想定と大きく異なる、`useCombo` の queryKey が string のまま、既存 topMessage パターンが存在しない等)は Plan Mode で停止して開発者に報告する。

---

## 4. 詳細仕様

### 4.1 全体構造

本指示書は以下の 3 層構造で実装する:

1. **バックエンド層**:
   - setup ドメイン: `GetSetupCandidates` の本実装(M4-01 スタブから拡張)
   - combo ドメイン: コンボ更新 API への `SetupCarryOptions` パラメータ追加 + サービス層で combo_setups の引き継ぎ判断反映
2. **フロントエンド フック・API 層**:
   - `useSetupCandidates` フック追加
   - `setupApi.getCandidates` メソッド追加
   - `useUpdateCombo` の `setupCarryOptions` 引数対応
3. **フロントエンド UI 層**:
   - `SetupCandidateList` 表示専用コンポーネント
   - `KnockdownAdvantageChangeModal` モーダル
   - `ComboDetailPage` への候補セクション追加
   - `ComboEditorPage` への確認モーダル分岐追加

### 4.2 setup フロント型定義の追加(`web/src/features/setup/types.ts` 修正)

M4-02 で確立した型に加えて、候補抽出 API のレスポンス型を追加する。

```typescript
// M4-02 v1.0.4 で確定済み(再掲、修正なし):
export interface SetupSummary extends Omit<Setup, 'createdAt' | 'updatedAt'> {
  defaultRecipe: string;
  parentComboIds: number[];
}

// M4-03 で本実装の API レスポンスラッパー(v1.0.0 で追加):
// M4-01 §4.2.7 で API 形のみスタブ実装されていたものを、SetupSummary[] を返す形で本実装する。
export interface ListSetupCandidatesResponse {
  items: SetupSummary[];
}
```

**M4-5 反省踏襲**: 候補一覧 API のレスポンスは `SetupResponse[]`(詳細型)ではなく `SetupSummary[]`(軽量型)を使う。候補表示時に必要なのは name / description / stepCount / defaultRecipe / parentComboIds であり、steps 詳細は不要。「このコンボにも紐付ける」ボタンの動作は `useCreateSetupLink(comboId, setupId)` のみで完結し、steps を参照しない。

### 4.3 setupApi.getCandidates メソッド追加(`web/src/features/setup/api/setupApi.ts` 修正)

```typescript
export const setupApi = {
  // M4-02 で確立済み(再掲、修正なし):
  create: (comboId: number, input: CreateSetupInput): Promise<SetupResponse> => ...,
  createLink: (comboId: number, setupId: number): Promise<void> => ...,
  deleteLink: (comboId: number, setupId: number): Promise<void> => ...,
  get: (id: number): Promise<SetupResponse> => ...,
  update: (id: number, input: UpdateSetupInput): Promise<SetupResponse> => ...,
  remove: (id: number): Promise<void> => ...,

  // M4-03 で追加:
  getCandidates: async (comboId: number): Promise<SetupSummary[]> => {
    const response: ListSetupCandidatesResponse = await apiClient.get(
      `/api/combos/${comboId}/setup-candidates`
    );
    return response.items;
  },
};
```

**設計判断**: フック内で `items` を取り出して `SetupSummary[]` を返す形(M4-02 §4.4.6 useCharacterSetups と同パターン)。

### 4.4 GetSetupCandidates の本実装(バックエンド)

#### 4.4.1 サービス層: `internal/service/setup/service.go` の `GetSetupCandidates` 修正

```go
// M4-01 §4.2.7 ではスタブ実装(空配列を返す)
// M4-03 で本実装(同一キャラ + 同一 knockdown_advantage の他コンボに紐付いている setup を抽出)
func GetSetupCandidates(ctx context.Context, parentComboID int64) ([]SetupSummary, error) {
    // 1. 親コンボの情報を取得(character_id, knockdown_advantage を取得)
    parentCombo, err := repository.combo.Get(ctx, parentComboID)
    if err != nil {
        return nil, err  // not_found の場合も含む
    }
    
    // 2. 同一キャラ + 同一 knockdown_advantage の他コンボに紐付いている setup を取得
    candidates, err := repository.setup.ListCandidatesByCharacterAndKnockdownAdvantage(
        ctx,
        parentCombo.CharacterID,
        parentCombo.KnockdownAdvantage,
        parentComboID,  // 親コンボ自身は除外
    )
    if err != nil {
        return nil, err
    }
    
    // 3. SetupSummary 配列に変換して返す(M4-02 v1.0.2 で確定した軽量型)
    return candidates, nil
}
```

**設計判断**:

- 親コンボが論理削除済み・存在しない場合は `not_found` エラー(M4-01 と整合)
- `knockdown_advantage` が NULL の親コンボの場合の挙動: **候補 0 件**(NULL = NULL は SQL では false になるため、自然に 0 件になる)
- M4-01 で確立した「親コンボ自身を除外」(`WHERE combos.id != ?`)を踏襲

#### 4.4.2 リポジトリ層: `internal/repository/setup/repository.go` への候補抽出クエリ追加

```go
// ListCandidatesByCharacterAndKnockdownAdvantage は FR011 転用候補を取得する。
// - 同一キャラ + 同一 knockdown_advantage の他コンボに紐付いている setup を返す
// - 親コンボ自身は除外
// - 論理削除済みの setup / combo は除外
// - **対象コンボに既に紐付いた setup 自体は除外**(v1.0.2 で追加、最重要)
// - 結果は SetupSummary 配列(steps なし、createdAt / updatedAt なし)
func ListCandidatesByCharacterAndKnockdownAdvantage(
    ctx context.Context,
    characterID int64,
    knockdownAdvantage *int,
    excludeComboID int64,
) ([]SetupSummary, error) {
    // SQL ベースクエリ(N+1 回避のため一括取得、v1.0.2 で対象コンボ既紐付き除外条件を追加):
    //
    // SELECT DISTINCT s.id, s.character_id, s.name, s.description, s.step_count, 
    //        s.version, s.recipe_cache
    // FROM setups s
    // INNER JOIN combo_setups cs ON cs.setup_id = s.id
    // INNER JOIN combos c ON c.id = cs.combo_id
    // WHERE s.character_id = ?
    //   AND c.knockdown_advantage = ?  -- 引数が NULL なら結果 0 件
    //   AND c.id != ?                  -- 対象コンボ経由の JOIN を除外
    //   AND s.deleted_at IS NULL
    //   AND c.deleted_at IS NULL
    //   AND s.id NOT IN (              -- v1.0.2 で追加: 対象コンボに既に紐付いた setup 自体を除外
    //     SELECT cs2.setup_id
    //     FROM combo_setups cs2
    //     WHERE cs2.combo_id = ?
    //   )
    //
    // その後、各 setup の parentComboIds を別クエリで集約(M4-02 で確立した N+1 回避パターン)
}
```

**設計判断**:

- **N+1 問題回避**: 各候補の `parentComboIds` を 1 件ずつ fetch するのではなく、IN 句で一括取得(M4-02 §4.13.1 ListSetupsByCharacter と同パターン、playbook §4.5 フローの素直さ原則)
- **`knockdown_advantage` が NULL の場合**: SQL の `=` 比較は NULL に対して常に false を返すため、自然に「knockdown_advantage が NULL の親コンボでは候補 0 件」となる。明示的なロジック追加は不要(playbook §4.5)
- **`defaultRecipe` 取得**: `setups.recipe_cache` カラム(M4-01 案 R2)から default preset ID = 1 のエントリを抽出(M4-02 §4.13.1 と同パターン)
- **対象コンボ既紐付き除外(v1.0.2 で追加、最重要)**: `c.id != ?` 条件は対象コンボ「経由のJOIN」のみを除外する。`Setup A` が「対象コンボ + 別のコンボ」の両方に紐付いている場合、別のコンボ経由のJOINでヒットして候補に残ってしまう。これを防ぐため `s.id NOT IN (SELECT cs2.setup_id FROM combo_setups cs2 WHERE cs2.combo_id = ?)` を追加し、**対象コンボに既に紐付いた setup 自体を候補から除外** する。本条件が抜けていると、転用候補リストに「既に紐付いた setup」が表示され、紐付けボタンを押しても候補欄から消えない(リロードしても消えない、バックエンドが返し続けるため)現象が発生する(retrospective-log v1.0.12 §5.1 M4-10 参照)

#### 4.4.3 ハンドラ層: `internal/api/setup/handler.go` の `GetSetupCandidates` 修正

```go
// M4-01 ではスタブ(空配列を返す)
// M4-03 で本実装(SetupSummary[] を返す)
func GetSetupCandidates(w http.ResponseWriter, r *http.Request) {
    comboID, err := strconv.ParseInt(chi.URLParam(r, "comboId"), 10, 64)
    if err != nil {
        writeError(w, http.StatusBadRequest, "invalid_combo_id", "コンボ ID が不正です")
        return
    }
    
    candidates, err := service.setup.GetSetupCandidates(r.Context(), comboID)
    if err != nil {
        // not_found / internal_error 等を model.APIErrorResponse で返す
        writeError(...)
        return
    }
    
    writeJSON(w, http.StatusOK, ListSetupCandidatesResponse{Items: candidates})
}
```

#### 4.4.4 レスポンス形式

```json
{
  "items": [
    {
      "id": 5,
      "characterId": 1,
      "name": "投げ抜け後セットアップ",
      "description": null,
      "stepCount": 3,
      "version": 1,
      "defaultRecipe": "立ち弱P > ...",
      "parentComboIds": [2, 8]
    }
  ]
}
```

**設計判断**:

- 要素型は `SetupSummary`(M4-02 v1.0.2 で確定、M4-5 反省踏襲)
- 候補 0 件時: `{"items": []}`(空配列、`null` ではない)
- `parentComboIds`: 当該 setup が紐付いている全コンボ ID(親コンボ自身は除外しないが、検索結果としては親コンボ以外で紐付くコンボがある setup のみが取れる)

### 4.5 コンボ更新 API への引き継ぎオプション追加

#### 4.5.1 入力 DTO 拡張(`internal/api/combo/dto.go` 等)

```go
// UpdateComboInput / PatchComboInput に SetupCarryOptions フィールドを追加
type UpdateComboInput struct {
    // 既存フィールド(M2-02 で確立済み、変更しない)...
    
    // M4-03 で追加: knockdown_advantage 変更時の引き継ぎオプション
    SetupCarryOptions *SetupCarryOptionsInput `json:"setupCarryOptions,omitempty"`
}

// SetupCarryOptionsInput は knockdown_advantage 変更時のセットプレイ引き継ぎ判断を表す。
// DES-005 §5.7 編集保存の動作節(CHANGE-013 反映後)の確認モーダル選択肢に対応。
type SetupCarryOptionsInput struct {
    // Mode は引き継ぎモード: "carry_all" / "unlink_all" / "individual"
    Mode string `json:"mode"`
    
    // CarrySetupIDs は Mode = "individual" の場合に引き継ぐ setup ID 配列。
    // Mode = "carry_all" の場合は不要(nil でよい、全紐付き setup を引き継ぐ)。
    // Mode = "unlink_all" の場合は不要(nil でよい、すべて紐付け解除)。
    CarrySetupIDs []int64 `json:"carrySetupIds,omitempty"`
}
```

**設計判断**:

- `Mode` enum は文字列で 3 値(`"carry_all"` / `"unlink_all"` / `"individual"`)。Go 側で `iota` 定数化を検討してもよいが、JSON シリアライズの観点で文字列のままが簡素(playbook §4.5)
- `SetupCarryOptions` 自体を `*` ポインタにすることで「設定なし」を明示(nil = knockdown_advantage 変更なし、または変更ありだが紐付き setup 0 件で確認モーダル非表示の場合)
- 連動: `Mode == ""` の場合はバリデーションエラー(`invalid_setup_carry_mode`)、`Mode == "individual"` で `CarrySetupIDs == nil` は許容(空配列扱い、すべて紐付け解除と同じ)

#### 4.5.2 サービス層: コンボ更新時の引き継ぎ判断反映

```go
// 既存のコンボ更新サービス関数を修正(関数名は §3.4.2 で実態確認)
func UpdateCombo(ctx context.Context, comboID int64, input UpdateComboInput) (*ComboResponse, error) {
    // 1. 既存のコンボ取得・バリデーション(M2-02 で確立済み、変更しない)
    
    // 2. 編集 2 方式分離の判定(M2-02 で確立済み、変更しない)
    // - (a) 重複判定キー変更編集 / (b) メタデータ編集
    
    // 3. knockdown_advantage 変更検知(M4-03 で追加)
    knockdownAdvantageChanged := /* 元の knockdown_advantage と input.KnockdownAdvantage の比較 */
    
    // 4. knockdown_advantage 変更 + setupCarryOptions が指定されている場合
    if knockdownAdvantageChanged && input.SetupCarryOptions != nil {
        // 引き継ぎモードに従って combo_setups を操作
        switch input.SetupCarryOptions.Mode {
        case "carry_all":
            // 紐付きをすべて維持(現状の combo_setups を変更しない)
        case "unlink_all":
            // 紐付きをすべて解除
            err := repository.comboSetup.DeleteByComboID(ctx, comboID)
            if err != nil { ... }
        case "individual":
            // CarrySetupIDs に含まれる setup のみ維持、それ以外は解除
            err := repository.comboSetup.DeleteByComboIDExcludingSetupIDs(ctx, comboID, input.SetupCarryOptions.CarrySetupIDs)
            if err != nil { ... }
        default:
            return nil, &model.ValidationError{Code: "invalid_setup_carry_mode", ...}
        }
    }
    
    // 5. knockdown_advantage 変更 + setupCarryOptions が nil の場合
    if knockdownAdvantageChanged && input.SetupCarryOptions == nil {
        // 紐付き setup が 0 件なら何もしない
        // 紐付き setup が 1 件以上ある状態で setupCarryOptions が nil で来た場合は、
        // フロント側の実装ミスとしてバリデーションエラー(missing_setup_carry_options)
        setups, err := repository.setup.ListByComboID(ctx, comboID)
        if err != nil { ... }
        if len(setups) > 0 {
            return nil, &model.ValidationError{
                Code:    "missing_setup_carry_options",
                Message: "knockdown_advantage 変更時は setupCarryOptions の指定が必要です",
            }
        }
    }
    
    // 6. (a) 保存方式の場合: 旧コンボ論理削除 + 新コンボ登録 + combo_setups 引き継ぎ(M2-02 既存処理)
    // 7. (b) 保存方式の場合: PATCH 直接更新(M2-02 既存処理)
    // 8. 完了
}
```

**設計判断**:

- 引き継ぎ判断はサービス層で 1 つのトランザクション内で実行(playbook §4.5 フローの素直さ原則、原子性確保)
- knockdown_advantage が変わらない場合の挙動:
  - (a) 保存方式: 既存の自動引き継ぎロジック(M2-02 既存処理)を使う、本指示書では変更しない
  - (b) 保存方式: combo 本体の置き換えが発生しないため combo_setups は変化しない(DES-005 §5.7 修正後の規定通り)
- バリデーションエラー `missing_setup_carry_options` は API 単体使用時の防御(playbook §4.5.2 サーバーサイド防御)。フロント側の UI フローでは knockdown_advantage 変更 + 紐付き setup ≥ 1 件の場合に確認モーダルが必ず表示されるため、本エラーは UI 経由では発生しない

#### 4.5.3 エラーレスポンス

- `invalid_setup_carry_mode`: 400 + `Mode` が不正値("carry_all" / "unlink_all" / "individual" 以外)
- `missing_setup_carry_options`: 400 + knockdown_advantage 変更時に setupCarryOptions が nil で紐付き setup ≥ 1 件
- 既存エラー(M2-02 で確立済み、再掲)はそのまま流用

### 4.6 useSetupCandidates フック追加(`web/src/features/setup/hooks/useSetupCandidates.ts` 新設)

```typescript
import { useQuery } from '@tanstack/react-query';
import { setupApi } from '../api/setupApi';
import type { SetupSummary } from '../types';

export function useSetupCandidates(comboId: number | null | undefined) {
  return useQuery({
    queryKey: ['setupCandidates', { comboId }],
    queryFn: () => setupApi.getCandidates(comboId!),
    enabled: !!comboId && comboId > 0,
  });
}
```

**設計判断**:

- **architecture-patterns.md §1.1 TanStack Query queryKey 規約踏襲**: `comboId` が number 型で確実に number 正規化済み(URL パラメータからの場合は呼び出し側で `Number(useParams().comboId)` する)
- enabled は `!!comboId && comboId > 0`(0 や NaN を弾く)
- 戻り値型は `SetupSummary[]`(M4-02 で確立した軽量型、M4-5 反省踏襲)
- 候補 0 件の場合は空配列が返る(エラーではない)

### 4.7 SetupCandidateList コンポーネント(`web/src/features/setup/components/SetupCandidateList.tsx` 新設)

#### 4.7.1 Props 設計

```typescript
interface SetupCandidateListProps {
  parentComboId: number;            // 親コンボ ID(紐付け追加に使用)
  candidates: SetupSummary[];       // 候補一覧(useSetupCandidates の結果)
}
```

**Props 最小化(M4-5 反省踏襲)**: `candidates` は配列を直接受け取る(候補 0 件時の判定は ComboDetailPage 側で行いセクション自体を非表示にするため、本コンポーネントには 1 件以上の配列のみが渡る前提)。loading 状態の表示は本コンポーネントの責務ではない。

#### 4.7.2 表示仕様

- セクション見出し:「転用可能なセットプレイ候補(N 件)」(N は候補数)
- 各候補を縦に並べて、各候補は「ヘッダー行 + 補助情報 + 紐付け追加ボタン」を持つ
- ヘッダー行: setup 名(`setup.name ?? '(名前なし)'`)+ ステップ数(`setup.stepCount`)
- 補助情報: レシピプレビュー(`setup.defaultRecipe` 文字列)、説明(`setup.description` が存在する場合は表示)
- 「このコンボにも紐付ける」ボタン: クリックで `useCreateSetupLink({ comboId: parentComboId, setupId: candidate.id })` を発火
- 紐付け成功時: TanStack Query キャッシュ無効化により候補一覧と紐付き setup 一覧が連動して更新される

**SetupAccordionItem との対比**:

- SetupAccordionItem(M4-02 §4.7): アコーディオン展開、行クリック = 編集遷移、紐付け解除ボタン付き
- SetupCandidateList(本指示書): フラット表示(アコーディオン不要、`defaultRecipe` を直接表示で十分)、行クリックなし、「紐付け追加」ボタンのみ

両者は「同じ setup の表示」だが用途が異なるため、本指示書では **共通化せず別コンポーネントで実装**(将来 M5 / M7 でリファクタ候補)。M4-5 反省「Props を増やすときは『現時点で内部で使うか』を 1 秒考える」と整合、現時点で共通化メリットが薄い。

#### 4.7.3 文字数制限・console.warn の仕様(M4-7 反省踏襲、「規定なし」を明示)

- 候補表示時の `setup.name` / `setup.description` / `setup.defaultRecipe` には **文字数制限なし、console.warn なし**
- 表示崩れ対策が必要な場合はフロント側で CSS truncate / ellipsis で対応(技術判断、本指示書では指定しない)
- これは M4-02 §4.6.2 で確立した「`Setup.description` / `Setup.name` の文字数制限なし」と整合

### 4.8 KnockdownAdvantageChangeModal コンポーネント(`web/src/features/combo/components/KnockdownAdvantageChangeModal.tsx` 新設)

#### 4.8.1 Props 設計

```typescript
interface KnockdownAdvantageChangeModalProps {
  open: boolean;
  linkedSetups: SetupResponse[];   // 紐付き setup 一覧(combo.setups から取得)
  onConfirm: (options: SetupCarryOptionsInput) => void;  // 保存続行
  onCancel: () => void;            // 保存キャンセル(モーダルを閉じる)
}
```

**Props 最小化(M4-5 反省踏襲)**: モーダル自体はモード選択 + 個別チェックボックスの UI のみを担当。実際の保存処理(`useUpdateCombo` の発火)は ComboEditorPage 側に置く。`linkedSetups` の取得も ComboEditorPage 側の `useCombo` の戻り値から渡す。

#### 4.8.2 表示・動作仕様

- モーダル表示時の本文: 「knockdown_advantage が変わるため、紐づくセットプレイ N 件が成立しなくなる可能性があります。引き継ぎますか?」(DES-005 §5.7 修正後と一致)
- 選択肢ラジオボタン 3 つ:
  - **「すべて引き継ぐ」(carry_all、デフォルト選択)**: 紐付きをすべて維持
  - **「紐付けを外す」(unlink_all)**: 紐付きをすべて解除
  - **「個別に選択」(individual)**: チェックボックス UI を展開
- 「個別に選択」の場合: モーダル内に linkedSetups の各 setup についてチェックボックス + setup 名表示(デフォルトチェック ON、外すと当該 setup を紐付け解除)
- ボタン: 「保存続行」「キャンセル」
- 「保存続行」クリック: 現在の選択肢に基づき `SetupCarryOptionsInput` を構築して `onConfirm` を呼ぶ
  - `Mode = "carry_all"` の場合: `CarrySetupIDs` 不要(nil)
  - `Mode = "unlink_all"` の場合: `CarrySetupIDs` 不要(nil)
  - `Mode = "individual"` の場合: チェックボックス ON の setup ID 配列を `CarrySetupIDs` に設定
- 「キャンセル」クリック: `onCancel` を呼ぶ(モーダルを閉じる、保存処理は実行しない)

#### 4.8.3 モーダル実装方針

- 標準 HTML + Tailwind 自作(playbook §4.6、shadcn/ui 不使用)
- `open` props で開閉、`<div className="fixed inset-0 ...">` で全画面オーバーレイ
- M4-02 で実装した `LinkExistingSetupModal` と同パターン(§3.4.3 で確認)

### 4.9 ComboDetailPage への候補セクション追加(`web/src/pages/ComboDetailPage.tsx` 修正)

#### 4.9.1 追加するセクション

ComboDetailPage(§3.4.2 で確認した実際のファイル名)に以下を追加:

- §5.6 item 9 の位置(item 8 セットプレイ一覧 と item 10 メタデータ の間)に「転用可能なセットプレイ候補」セクションを配置
- `useSetupCandidates(comboId)` で候補一覧を取得
- 候補 0 件時: セクション自体を非表示(DES-005 §5.6 item 9 規定通り)
- 候補 1 件以上: `SetupCandidateList` でレンダリング

```typescript
// ComboDetailPage 内の追加部分(概略)
const { data: candidates, isLoading: candidatesLoading } = useSetupCandidates(comboId);

// レンダリング部分:
{!candidatesLoading && candidates && candidates.length > 0 && (
  <section>
    <h2>転用可能なセットプレイ候補({candidates.length} 件)</h2>
    <SetupCandidateList parentComboId={comboId} candidates={candidates} />
  </section>
)}
```

**設計判断**: ローディング中は表示しない(`candidatesLoading` を見て描画を保留)。これにより「ローディング → 候補 0 件で非表示」のチラつきを回避。candidates が undefined のうちは描画しない。

### 4.10 ComboEditorPage への確認モーダル分岐追加(`web/src/pages/ComboEditorPage.tsx` 修正)

#### 4.10.1 追加する保存フロー分岐

ComboEditorPage(§3.4.2 で確認した実際のファイル名)の保存処理に以下のフローを追加:

```typescript
// 保存ボタン押下時の処理(概略)
const handleSave = async () => {
  // 1. 既存のバリデーション(M2-02 で確立済み、変更しない)
  
  // 2. knockdown_advantage 変更検知(M4-03 で追加)
  const knockdownAdvantageChanged = 
    originalCombo.knockdownAdvantage !== editedKnockdownAdvantage;
  
  // 3. 紐付き setup 一覧を取得(useCombo の戻り値の combo.setups、M4-02 で確立)
  const linkedSetups = originalCombo.setups ?? [];
  
  // 4. 確認モーダル表示条件: knockdown_advantage 変更 + 紐付き setup ≥ 1 件
  if (knockdownAdvantageChanged && linkedSetups.length > 0) {
    setKnockdownModalOpen(true);  // モーダル表示
    return;  // 保存処理を中断、モーダルからの onConfirm を待つ
  }
  
  // 5. それ以外: 既存の保存処理を実行
  await executeSave(/* setupCarryOptions なし */);
};

// モーダルからの onConfirm コールバック
const handleModalConfirm = async (options: SetupCarryOptionsInput) => {
  setKnockdownModalOpen(false);
  await executeSave(options);  // setupCarryOptions 付きで保存実行
};

const executeSave = async (setupCarryOptions?: SetupCarryOptionsInput) => {
  await updateComboMutation.mutateAsync({
    id: comboId,
    input: {
      /* 既存フィールド */,
      setupCarryOptions,  // M4-03 で追加
    },
  });
};

// レンダリング部分に追加:
<KnockdownAdvantageChangeModal
  open={knockdownModalOpen}
  linkedSetups={linkedSetups}
  onConfirm={handleModalConfirm}
  onCancel={() => setKnockdownModalOpen(false)}
/>
```

#### 4.10.2 knockdown_advantage 変更なし時の通知(v1.0.1 で実装方針確定: 既存 topMessage 流用)

DES-005 §5.7 修正後の規定:

- (a) 保存方式 + knockdown_advantage 変わらない場合: 通知を表示。表示文言は DES-005 §5.7 規定の引用「紐づくセットプレイ N 件を引き継ぎました。必要に応じて内容を確認してください」
- (b) 保存方式 + knockdown_advantage 変わらない場合: 通知なし(combo 本体の置き換えなし)

**実装方針(v1.0.1 で確定、案 1 採用)**: **既存 topMessage パターンを流用** する。製造担当 Plan Mode 中の連絡事項(2026-05-18)で「トースト通知ライブラリ(react-hot-toast / sonner 等)が未導入」が判明し、開発者判断で 3 案(既存 topMessage 流用 / sonner 新規追加 / M5 以降持ち越し)から **案 1** を採用。

**根拠**:

- DES-005 §5.7 規定の本質は「ユーザーへのフィードバック」であり、「トースト通知」は実装表現の例示。topMessage で機能要件を満たせる
- playbook §17.1「個人 OSS の規模感、過剰な抽象化・将来対応は避ける」の精神と整合
- shadcn/ui が M7 まで未導入の方針(playbook §4.6)と整合(トーストライブラリも UI ライブラリ依存と同じカテゴリ)
- M5 以降で他箇所(削除完了通知・エラー通知等)のトースト需要が高まったタイミングで本格的なトースト基盤導入をまとめて検討する

**実装範囲**:

- ComboEditor 既存の `topMessage` state パターン(§3.4.5 着手前確認で構造確認済み)を再利用する
- 保存成功直後に「紐づくセットプレイ N 件を引き継ぎました。必要に応じて内容を確認してください」を topMessage として表示
- N は引き継がれたセットプレイ数(レスポンスから取得、または保存前の `linkedSetups.length` を流用)
- 表示時間: ComboEditor 既存 topMessage パターンの自動消去動作に従う(タイムアウト・手動閉じ等は技術判断の範疇)

**setup 詳細画面への遷移リンク**:

- DES-005 §5.7 規定では「トーストからセットプレイ詳細画面への遷移リンクを含めると親切」とあるが、(b) 保存方式の場合は紐付き setup の数が **複数件** あり得るため、単一の遷移リンクを含めることが構造的に難しい
- **v1.0.1 では遷移リンクは含めない**(機能要件外の親切機能、複数 setup 対応で UX 設計が必要、M5 以降で再検討)。完了報告で本判断を明記
- 既存 ComboDetailPage の §5.6 item 8 セットプレイ展開セクションが setup 詳細への入口として既に動作しているため、ユーザーは保存後にコンボ詳細画面に遷移して個別に setup を確認できる

**スコープ外**:

- **トースト系ライブラリの新規追加は本指示書のスコープ外**(`react-hot-toast` / `sonner` / `@radix-ui/react-toast` 等のインストールを伴う変更は禁止)
- M5 / M7 で本格的なトースト基盤を導入する際は別途協議(本指示書 §4.10.2 の topMessage 流用箇所をリファクタする選択肢を残す)

#### 4.10.3 「個別に選択」UI の構造

`KnockdownAdvantageChangeModal` 内のチェックボックス UI(§4.8.2 参照):

- ラジオボタンで「個別に選択」を選択した時のみ、その下に linkedSetups のチェックボックス一覧を展開
- 各チェックボックス: setup 名(`setup.name ?? '(名前なし)'`)+ ステップ数
- デフォルト: すべて ON(carry_all と同等の挙動から個別調整する自然な流れ)
- ON にすると `CarrySetupIDs` に含まれる、OFF にすると含まれない

### 4.11 設計判断事項(本指示書で確定済み)

| 項目 | 確定内容 | 根拠 |
|------|---------|------|
| 候補抽出 API のレスポンス型 | `SetupSummary[]` 軽量型 | M4-02 v1.0.2 SetupSummary 規約踏襲、M4-5 反省 |
| 候補 0 件時の UI | セクション自体を非表示 | DES-005 §5.6 item 9 規定通り |
| 候補抽出のキャラ・knockdown_advantage 一致条件 | 同一キャラ + 同一 knockdown_advantage(NULL の場合は候補 0 件) | DES-005 §5.6 item 9 + SQL `=` 比較の自然な挙動 |
| 親コンボ自身の候補からの除外 | サービス層で除外 | M4-01 設計判断踏襲 |
| 候補一覧の N+1 回避 | `parentComboIds` は IN 句で一括取得 | playbook §4.5 フローの素直さ、M4-02 §4.13.1 と同パターン |
| 確認モーダルの選択肢 | 3 つ(carry_all / unlink_all / individual) | DES-005 §5.7 修正後規定通り |
| 確認モーダルの発火条件 | knockdown_advantage 変更 **かつ** 紐付き setup ≥ 1 件 | DES-005 §5.7 修正後規定通り、(a)(b) 両方の保存方式で同じ判定 |
| 確認モーダルが (a)(b) 両方で発火 | CHANGE-013 通知書 v1.1.0 で確定 | DES-005 §5.7 v2.8.0 |
| 「個別に選択」UI のデフォルト | すべて ON(carry_all と同等から個別調整) | UX 観点、本指示書 §4.10.3 |
| トースト通知の実装範囲 | **v1.0.1 で確定: 既存 ComboEditor topMessage パターンを流用**(案 1)。トースト系ライブラリの新規追加は本指示書のスコープ外。setup 詳細画面への遷移リンクは v1.0.1 では含めない(複数 setup 対応で UX 設計が必要、M5 以降で再検討)| §4.10.2、M4-8 反省踏襲 |
| `SetupCarryOptions` の型 | サーバ側ポインタ(`*SetupCarryOptionsInput`)、`Mode` enum 文字列 | playbook §4.5、SUPP-001 §5.9 PATCH ポリシー |
| `Mode` 不正値のエラーコード | `invalid_setup_carry_mode`(小文字スネーク) | M4-01 で確立した規約踏襲 |
| 紐付き setup ≥ 1 件で setupCarryOptions nil のエラー | `missing_setup_carry_options`(API 単体使用時の防御) | playbook §4.5.2 |
| SetupAccordionItem と SetupCandidateList の共通化 | 共通化しない(M5 以降のリファクタ候補) | M4-5 反省、用途が異なる |
| `setup.name` / `setup.description` / `setup.defaultRecipe` の文字数制限 | 制限なし、console.warn なし | M4-02 §4.6.2 と整合、M4-7 反省踏襲(「規定なし」を明示) |
| モーダル実装 | 標準 HTML + Tailwind 自作、shadcn/ui 不使用 | playbook §4.6、M4-02 LinkExistingSetupModal と同パターン |
| useSetupCandidates の queryKey | `['setupCandidates', { comboId: number }]` | architecture-patterns.md §1.1 number 正規化規約 |

---

## 5. テスト要件

### 5.1 必須テスト

#### 5.1.1 バックエンドテスト

**`GetSetupCandidates` のテスト**:

- [ ] サービス層: 同一キャラ + 同一 knockdown_advantage の他コンボに紐付いた setup のみ返る
- [ ] サービス層: 親コンボ自身に紐付いた setup は除外される(`combos.id != ?`)
- [ ] サービス層: 論理削除済みの setup / combo は除外される
- [ ] サービス層: 親コンボの `knockdown_advantage` が NULL のときは候補 0 件
- [ ] サービス層: 候補 0 件のときに空配列を返す(エラーではない)
- [ ] サービス層: 親コンボが存在しないときに `not_found` エラー
- [ ] ハンドラ層: レスポンス JSON が `{"items": [...]}` 形式、要素型 `SetupSummary`(steps なし、createdAt / updatedAt なし)
- [ ] リポジトリ層: N+1 問題が発生していない(`parentComboIds` の取得が IN 句で一括化)

**コンボ更新 API の `setupCarryOptions` テスト**:

- [ ] `Mode = "carry_all"`: combo_setups が変化しない
- [ ] `Mode = "unlink_all"`: combo_setups がすべて削除される
- [ ] `Mode = "individual"` + `CarrySetupIDs = [1, 2]`: 1, 2 のみ維持、それ以外は削除
- [ ] `Mode = "invalid"`: 400 + `invalid_setup_carry_mode`
- [ ] knockdown_advantage 変更 + setupCarryOptions = nil + 紐付き setup ≥ 1 件: 400 + `missing_setup_carry_options`
- [ ] knockdown_advantage 変更なし + setupCarryOptions = nil: 既存挙動通り(エラーなし、M2-02 既存処理を踏襲)
- [ ] knockdown_advantage 変更 + 紐付き setup 0 件 + setupCarryOptions = nil: エラーなし

#### 5.1.2 フロントエンドテスト(フック層)

- [ ] `useSetupCandidates(comboId)`: comboId 指定で fetch 成功
- [ ] `useSetupCandidates(null)`: disabled(fetch しない)
- [ ] `useSetupCandidates(0)`: disabled
- [ ] queryKey が `['setupCandidates', { comboId: number }]` 形式(number 正規化済み)

#### 5.1.3 フロントエンドテスト(コンポーネント)

- [ ] `SetupCandidateList`: 候補一覧の表示、setup 名 / ステップ数 / レシピプレビュー / 紐付け追加ボタン
- [ ] `SetupCandidateList`: 「このコンボにも紐付ける」ボタンクリックで `useCreateSetupLink` が発火される
- [ ] `KnockdownAdvantageChangeModal`: モード選択ラジオボタン 3 つ
- [ ] `KnockdownAdvantageChangeModal`: 「個別に選択」モード時にチェックボックス UI が展開される
- [ ] `KnockdownAdvantageChangeModal`: デフォルト全 ON
- [ ] `KnockdownAdvantageChangeModal`: 「保存続行」で `onConfirm` が呼ばれる(各モードの `SetupCarryOptionsInput` 構造を確認)
- [ ] `KnockdownAdvantageChangeModal`: 「キャンセル」で `onCancel` が呼ばれる

#### 5.1.4 ページコンポーネントテスト

- [ ] `ComboDetailPage`: §5.6 item 9 セクションが候補 ≥ 1 件で表示される
- [ ] `ComboDetailPage`: §5.6 item 9 セクションが候補 0 件で非表示
- [ ] `ComboDetailPage`: §5.6 item 1〜8、10 は M4-02 完了状態の表示が変わらない(回帰なし)
- [ ] `ComboEditorPage`: knockdown_advantage 変更 + 紐付き setup ≥ 1 件で `KnockdownAdvantageChangeModal` が開く
- [ ] `ComboEditorPage`: knockdown_advantage 変更 + 紐付き setup 0 件でモーダルが開かない(保存が直接実行)
- [ ] `ComboEditorPage`: knockdown_advantage 変更なしでモーダルが開かない
- [ ] `ComboEditorPage`: モーダル「保存続行」で `useUpdateCombo` が `setupCarryOptions` 付きで発火
- [ ] `ComboEditorPage`: M4-02 完了状態の編集機能が変わらない(回帰なし)

#### 5.1.5 ビルド・型チェック

- [ ] `cd web && pnpm test` が全通過する(新規テスト含む、既存テスト回帰なし)
- [ ] `cd web && pnpm build` が成功する
- [ ] TypeScript の型エラーが残っていない
- [ ] `make test` または `go test ./...` が全通過する(setup / combo 系の新規テスト含む、M4-01 / M4-02 完了状態の既存テストが回帰しない)
- [ ] `go build ./...` が成功する
- [ ] `go vet ./...` でエラーなし

### 5.2 E2E シナリオ(開発者の責任範囲、M4-02 E2E 知見踏襲:完了判定の必須ゲート)

製造担当 Claude Code は以下のシナリオを実装完了報告に手順書として記載する(開発者がブラウザで動作確認、playbook §14)。**E2E 実機確認はサブマイルストーン完了判定の必須ゲート**(M4-02 E2E 由来の運用知見)。

#### A. FR011 候補表示(候補あり)

1. 同一キャラ + 同一 knockdown_advantage の別コンボにセットプレイが紐付いた状態を準備
2. 本コンボの詳細画面を開く
3. §5.6 item 9 位置に「転用可能なセットプレイ候補(N 件)」セクションが表示される
4. 各候補の名前・ステップ数・レシピプレビューが表示される

#### B. FR011 候補表示(候補なし)

1. 別コンボに該当する setup がない状態
2. コンボ詳細画面を開く
3. §5.6 item 9 セクション自体が **非表示**(セクションタイトルも表示されない)

#### C. FR011 候補から紐付け追加

1. シナリオ A の状態で候補の「このコンボにも紐付ける」ボタンを押下
2. 紐付け追加成功 → 候補一覧から該当 setup が消える(または §5.6 item 8 セットプレイ一覧に該当 setup が追加される)
3. ページ再読み込みでも状態が永続化されている

#### D. knockdown_advantage 確認モーダル(紐付き setup あり、carry_all)

1. 紐付き setup ≥ 1 件のコンボの編集画面を開く
2. knockdown_advantage を変更
3. 保存ボタン押下 → `KnockdownAdvantageChangeModal` が表示される
4. 「すべて引き継ぐ」を選択 → 「保存続行」
5. 保存成功、コンボ詳細を確認すると紐付き setup がすべて維持されている

#### E. knockdown_advantage 確認モーダル(unlink_all)

1. 同上の状態で「紐付けを外す」を選択 → 「保存続行」
2. 保存成功、コンボ詳細を確認すると紐付き setup がすべて消えている

#### F. knockdown_advantage 確認モーダル(individual)

1. 同上の状態で「個別に選択」を選択 → チェックボックスから一部を OFF にする → 「保存続行」
2. 保存成功、コンボ詳細を確認すると OFF にした setup のみ紐付き解除、ON のものは維持

#### G. knockdown_advantage 確認モーダル(キャンセル)

1. モーダル表示状態で「キャンセル」ボタンを押下
2. モーダルが閉じる、保存処理は実行されない、変更前のコンボ状態のまま

#### H. knockdown_advantage 変更なし(モーダル非表示)

1. コンボ編集画面で knockdown_advantage 以外のメタデータ(ダメージ等)のみ変更
2. 保存ボタン押下 → モーダルは **表示されず**、保存処理が直接実行される
3. (a) 保存方式 + 紐付き setup ≥ 1 件 + knockdown_advantage 変わらない場合: トースト通知「紐づくセットプレイ N 件を引き継ぎました」(§4.10.2 参照)
4. (b) 保存方式 + knockdown_advantage 変わらない場合: トースト通知なし

#### I. 既存機能の回帰

1. M4-02 完了状態のコンボ詳細・コンボ編集・マイコンボ画面が動作する
2. M3-05 統合 E2E シナリオが引き続き通過する
3. M4-02 setup 単体 UI / 既存セットプレイ紐付け追加・解除が引き続き動作する

---

## 6. レビュー観点(別ファイル参照)

機械レビューは別ファイル `docs/instructions/reviews/M4-03-review-checklist.md` に従う。製造担当 Claude Code は本ファイルを読む必要はない。

---

## 7. 完了条件(Definition of Done)

### 7.1 機能要件

- [ ] §2.1 のファイル一覧がすべて作成または修正されている(バックエンド新設・修正 + フロントエンド新設・修正)
- [ ] §3.4 着手前確認の結果(全 4 項目、特に §3.4.2 M2-02 編集 2 方式分離の実態確認)が実装完了報告に含まれている
- [ ] §4.4 `GetSetupCandidates` が本実装されている(M4-01 スタブから挙動仕上げ完了)
- [ ] §4.5 コンボ更新 API への `setupCarryOptions` パラメータ追加が動作する
- [ ] §4.7 `SetupCandidateList` コンポーネントが動作する
- [ ] §4.8 `KnockdownAdvantageChangeModal` が動作する(3 モード + キャンセル)
- [ ] §4.9 ComboDetailPage の §5.6 item 9 セクション追加が動作する
- [ ] §4.10 ComboEditorPage の knockdown_advantage 確認モーダル分岐が動作する
- [ ] §5.2 E2E シナリオ A〜I がすべて通過する
- [ ] **CHANGE-013 (DES-005 §5.7 v2.8.0) の規定通り、knockdown_advantage 変更時の確認モーダルが (a)(b) 両方の保存フローで発火する**(M4-6 反省踏襲)
- [ ] M3-05 統合 E2E シナリオが回帰しない

### 7.2 自己テスト結果(製造担当の責任範囲)

**フロントエンド側**:

- [ ] `cd web && pnpm test` が全通過する
- [ ] `cd web && pnpm build` が成功する
- [ ] TypeScript の型エラーが残っていない
- [ ] §3.4.1〜§3.4.4 着手前確認の出力を含める
- [ ] 開発者向けの「動作確認手順書」(§5.2 E2E シナリオ A〜I の手順を含む)を実装完了報告に含める
- [ ] 開発サーバー起動時にコンソール警告(React の key 警告等)が新規発生していない

**バックエンド側**:

- [ ] `make test` または `go test ./...` が全通過する(新規テスト + 既存テスト回帰なし)
- [ ] 主要 API を `curl` で叩き、レスポンスを報告書に貼付(`GET /api/combos/{id}/setup-candidates`、コンボ更新 API の各モード)
- [ ] エラーケース(400 `invalid_setup_carry_mode` / `missing_setup_carry_options`)を `curl` で再現
- [ ] **M3-05 統合 E2E シナリオを必ず再実施**(`GET /api/combos/{id}` レスポンスや setup 関連 API の回帰確認、M4-02 E2E 由来知見)
- [ ] `go build ./...` が成功する
- [ ] `go vet ./...` でエラーなし

**開発者の責任範囲**:

- E2E 実機確認(playbook §14、M4-02 E2E 由来知見: 完了判定の必須ゲート)

### 7.3 品質チェック

- [ ] CLAUDE.md §4 TypeScript / Go 規約に準拠
- [ ] CLAUDE.md §5 テスト規約に準拠(フック層・コンポーネント層・ページ層・サービス層・リポジトリ層・ハンドラ層が必須カバー)
- [ ] CLAUDE.md §10 禁止事項に抵触していない
- [ ] **architecture-patterns.md §1 フック分離パターン**に準拠
- [ ] **architecture-patterns.md §1.1 TanStack Query queryKey 規約**(number 正規化)に準拠
- [ ] **shadcn/ui を使用していない**(playbook §4.6、標準 HTML + Tailwind 自作)
- [ ] **M4-02 v1.0.4 で確定した `SetupSummary` / `SetupResponse` 型を再利用**(候補一覧は `SetupSummary[]`)
- [ ] **CHANGE-013 (DES-005 §5.7 v2.8.0) の節編成を前提として実装**(確認モーダルは (a)(b) 両方の保存フローで発火)
- [ ] **playbook §4.5 フローの素直さ原則**に抵触していない(エラー駆動再試行禁止、N+1 回避、原子性確保)
- [ ] **playbook §4.5.2 サーバーサイド防御**(`missing_setup_carry_options` を API 単体使用時の防御として実装)
- [ ] setup 系のエラーコードが **小文字スネーク** で統一されている(`invalid_setup_carry_mode` / `missing_setup_carry_options`)
- [ ] **共通エラー型 `model.APIErrorResponse`** を直接呼び出している(architecture-patterns.md §3、独自ヘルパなし)

### 7.4 ドキュメント

- [ ] `docs/progress/progress-log.md` に M4-03 完了報告を追記する
- [ ] §3.4 着手前確認結果を含める(全 4 項目、特に §3.4.2 M2-02 編集 2 方式分離の構造)
- [ ] 設計判断事項表(§4.11)の各項目が指示書通りに実装された旨を明記
- [ ] **§5.2 E2E シナリオ A〜I の実機確認結果**(回帰なし)を明記
- [ ] **M3-05 統合 E2E シナリオの再実行結果**(回帰なし)を明記

### 7.5 完了報告

- [ ] 開発者に「M4-03 が完了しました」と報告
- [ ] §7.1〜§7.4 の自己テスト結果を報告書に含める
- [ ] M4-04 着手の前提条件が整ったことを宣言(FR011 候補抽出が動作、knockdown_advantage 確認モーダルが動作、コンボ + セットプレイ同時登録は M4-04 で着手可能)

---

## 8. 参照ドキュメント

| ID / ファイル | 関連節 |
|--------------|--------|
| CLAUDE.md | §4 規約、§5 テスト規約、§10 禁止事項 |
| **DES-005 v2.8.0** | **§5.6 item 9 FR011 候補、§5.7 編集保存の動作節(CHANGE-013 反映後)** |
| DES-006 v1.9.0 | §3 VAL-S01〜S05(間接参照) |
| **M4-01 指示書 v1.0.2** | **§4.2.7 GetSetupCandidates スタブ実装** |
| **M4-02 指示書 v1.0.4** | **§4.2 setup 型定義、§4.4 setup フック、§4.13 SetupSummary 軽量型** |
| M4-overview v1.1.2 | §3.4 M4-03 詳細、§5 M4 で扱わないもの |
| architecture-patterns.md v1.0.1 | §1 フック分離パターン、§1.1 queryKey 規約 |
| **CHANGE-013 通知書 v1.1.0** | §5.7 節編成整合化 |
| change-report-013 | DES-005 v2.7.0 → v2.8.0 反映完了報告 |
| REQ-001 FR011 / FR004 | FR011 セットプレイ転用支援、FR004 編集保存 2 方式 |
| M2-02 指示書 | 編集 2 方式分離(参考、§3.4.2 で実態確認) |
| M3-04 指示書 | useCharacters フック分離パターン(参考) |
| SUPP-001 §3.3.0 / §5.9 / §7 | Modifiers、PATCH ポリシー、notation サービス層 |
| playbook v1.6.0 | §4.5 / §4.6 / §14 |
| retrospective-log v1.0.8 | M4-1〜M4-7 反省 + M4-02 E2E 知見 |

---

## 9. 注意事項・判断に迷ったら

### 9.1 推測で進めてはいけない事項

以下は推測で進めず、Plan Mode で開発者に確認する:

- §3.4.2 で M2-02 編集 2 方式分離の判定ロジック・関数構造が想定と大きく異なる場合
- §3.4.2 で `useCombo` の queryKey が string のまま(architecture-patterns.md §1.1 未踏襲)で、本指示書の前提と異なる場合
- §4.5 コンボ更新 API への引き継ぎオプション追加で、既存の関数シグネチャ変更が必要な場合の影響範囲(他の呼び出し元等)
- §4.10.2 トースト通知の実装基盤が存在しない場合の対応方針
- §4.4 候補抽出ロジックで N+1 回避ができない構造を見つけた場合
- 既存テストの回帰が発生した場合

### 9.2 推測で進めてよい事項(その旨を明示)

以下は推測で進めてよいが、実装時に「推測:〜と仮定した」とコード内コメントまたは完了報告に明示する:

- 表示文言の細部(「転用可能なセットプレイ候補」「このコンボにも紐付ける」「すべて引き継ぐ」等の和文表現の調整)
- Tailwind クラスの細部(色・余白・タイポグラフィ)
- 確認モーダルのレイアウト細部(チェックボックスのインデント、ボタンの並び順等)
- レシピプレビューの truncate / ellipsis 処理の閾値

### 9.3 不明事項発見時の対応

- 設計書本体(DES-005 §5.6 item 9 / §5.7 v2.8.0)と本指示書の記述が乖離している場合 → 実装を止めて開発者に報告し、CHANGE 通知書起票要否を協議
- 本指示書の §4 詳細仕様で具体化されていない実装判断が必要になった場合 → §9.2 の範囲なら推測で進めて明示、それ以外は Plan Mode で開発者確認
- M4-01 / M4-02 で実装済みの API / 型に変更が必要と判断した場合 → 実装を止めて開発者に報告(本指示書 §2.3 「変更しないもの」原則に抵触)

### 9.4 Plan Mode で計画提示時に含めるべき項目

Plan Mode 必須:

- §3.4 着手前確認の結果(全 4 項目)
- 特に §3.4.2 M2-02 編集 2 方式分離の実装実態(関数名・判定ロジック・既存テスト)
- §3.4.4 useCombo queryKey の number 正規化状態(architecture-patterns.md §1.1 踏襲確認)
- §4.5 コンボ更新 API への `SetupCarryOptions` 追加で修正対象になる既存ファイル
- §4.10.2 トースト通知ライブラリの既存有無、なければ代替案
- 既存ロジック再利用範囲(M4-01 setup API、M4-02 useCreateSetupLink、useCombo、SetupCarryOptions の DTO 設計等)

---

## 10. 完了後の次ステップ

M4-03 完了後、開発者が動作確認・承認したら **M4-04(コンボ + セットプレイ同時登録 + 統合 E2E + L-01 解消)** に進む。

M4-04 着手時の前提条件:

- FR011 候補抽出が動作している(本指示書で実装)
- knockdown_advantage 確認モーダルが動作している(本指示書で実装)
- コンボ + セットプレイ同時登録セクション(§5.7 item 10)は M4-04 で実装可能
- L-01 オプショナル型整理は M4-04 で対応

---

*以上*
