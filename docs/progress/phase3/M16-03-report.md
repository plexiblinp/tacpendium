# M16-03 完了報告書（起き攻めの正規化：`combo_oki_options` 新設・シミー 4 区分化・打撃重ね・G-h）

| 項目 | 内容 |
|------|------|
| 対象指示書 | `docs/instructions/phase3/M16-03-normalize-oki-options.md` v1.0.0 |
| 承認ゲート | **G-h**（マイグレ着手前の個別承認）＝ Plan Mode 計画提示 → 開発者承認（ExitPlanMode）で取得済み |
| 実装モデル | Opus 4.8（1M context）＋ Plan Mode |
| 完了日 | 2026-07-05 |
| 対象コミット | バックエンド本体 / FE 追従 / テスト の 3 チェックポイント |
| レビュー | fresh subagent（独立）→ `docs/progress/phase3/m16-03-review.md`（本コマンド Phase B で生成） |

---

## 1. 実施サマリ

起き攻め情報を `combos` の **6 個の平置き bool** から正規化テーブル **`combo_oki_options`** へ移した（マイグレ 000021）。
- **シミーを 4 区分化**（`uses_dr` を全 attack_type に一様適用）。従来シミーには ドライブラッシュ 有無の区別が無かった非対称を解消。
- **打撃重ね（`strike_meaty`）を追加**（friend FB #12）。
- 既存 6 bool は **決定論 backfill**（開発者確定＝既存シミーは `uses_dr=false`）→ **6 bool 列 DROP**。
- 起き攻めは **dup/recipe 非対象**（`DuplicateKey` の WHERE・`CalcRecipeHash`・`RecomputeComboCache` に oki 参照 0 件を実コードで確認）。`recipe_hash` 不変・重複判定不変。blast radius は DDL/model/DTO/repository/FE 型/editor/表示/CSV/VAL-C11 に閉じる。
- `knockdown_advantage` は combos に残置・不変。

---

## 2. Plan Mode 8 項目（§3.4）の確定方式

| # | 項目 | 確定 |
|---|------|------|
| 1 | 語彙（friend 棚卸し） | ベースライン確定（開発者回答 2026-07-05）。attack_type ∈ {throw_meaty, shimmy, strike_meaty}・tech_type ∈ {neutral_tech, back_tech}・uses_dr ∈ {false, true}。下位分類なし |
| 2 | スキーマ・available | **sparse**（開発者確定）。`available` 列を持たず、行の存在＝利用可能。`UNIQUE(combo_id, attack_type, tech_type, uses_dr)`・FK `combo_id`→combos ON DELETE CASCADE。tri-state の false/null 区別は失われる（起き攻めでは無意味・backfill 仕様と整合） |
| 3 | backfill 写像 | §4.1 の 6 通り決定論。既存シミー→`uses_dr=false`。false/NULL は行を作らない |
| 4 | down 損失 | 行→6bool 逆写像。**shimmy-DR / strike_meaty の行は 6bool に受け皿が無く down で消失**（破壊的 down・C-3型）。down SQL コメント + 本報告に明記。マイグレテストで損失を明示検証 |
| 5 | 全接地経路 grep | 下記 §4 に全数。model/DTO(×3)/service(×2)/repository/FE 型/editor/詳細/比較/出力/CSV/VAL-C11(×2) |
| 6 | CSV 後方互換 | フラット 6 列維持（必須）+ 新オプション 6 列（shimmy-DR ×2・strike_meaty ×4）を**任意列として列末尾追加**。旧 CSV（6 起き攻め列のみ）の import 成立を確認 |
| 7 | VAL-C11 | **全 attack_type へ一様適用**（開発者確定）。uses_dr=true の行は同 (attack,tech) の uses_dr=false 行が必要。本体 `validation/combo.go` + CSV `csvcore/validate.go` の両実装を追従。範囲/保存の新規 VAL は足さない |
| 8 | recipe_cache 非依存 | 確認済（0 件）。起き攻め変更で `RecomputeComboCache` を呼ばない |

---

## 3. 決定的な設計判断（開発者確定 2026-07-05）

- **sparse モデル採用**: `combo_oki_options` は `available` 列を持たず、行の存在＝そのオプションが利用可能。`combo_tags` と同じ presence 型。backfill 仕様「false は行を作らない」と最も整合。
- **VAL-C11 uniform**: 従来 meaty 2 ペアのみだった整合性検証を全 attack_type へ一様適用。「非対称是正」の設計意図と整合。
- **PATCH 意味変更**: 従来の per-field `Optional[bool]` merge から **replace-set**（`okiOptions *[]OkiOption`・nil=不変更/非nil=全置換）へ。`TagIDs` と同方式。← **CHANGE 見込み**（§6）。

---

## 4. 全接地経路（6 bool → OkiOptions 波及・grep 全数）

- **DDL/マイグレ**: `migrations/000021_normalize_combo_oki_options.up.sql` / `.down.sql`（新設）。
- **model**: `internal/model/combo.go`（6 `*bool` 撤去 → `OkiOptions []OkiOption` + `OkiOption` 型 + 列挙定数 `OkiAttackType*`/`OkiTechType*`）。
- **DTO**: `internal/api/combo/dto.go`（`ComboResponse`/`CreateRequest`/`UpdateMetadataRequest` を `okiOptions` 化 + `OkiOptionDTO` + 変換関数 + 3 マッピング関数）。
- **service**: `internal/service/combo/service.go`（`CreateInput`/`UpdateMetadataInput` merge・model 構築・create/PUT/PATCH で `ReplaceOkiOptions` 呼び）。
- **repository**: `internal/repository/combo/repository.go`（combos SQL から 6 oki 列除去・`ReplaceOkiOptions`/`FindOkiOptionsByComboID`/`FindOkiOptionsForCombos` 追加・FindByID/List に組込）。
- **CSV**: `csvcore/contract.go`（+6 任意列）・`combo.go`（+6 DTO フィールド）・`csvexport.go`・`validate.go`（decode + C11 uniform）・`comboio/export.go`（`setOkiFlatFlags`）・`import.go`（`okiOptionsFromFlatFlags`）。
- **VAL**: `validation/combo.go` C11 + `csvcore/validate.go` C11。
- **FE 型**: `web/src/features/combo/types.ts`（`OkiOption` + `okiOptions`・3 型 + request 型・`OkiBooleans` mixin → `OkiOptionsHolder`）・`schema.ts`。
- **FE 定数**: `web/src/constants/oki.ts`（新設・バックエンド列挙同期・ラベル正典）。
- **FE editor**: `ComboEditorBasicFields.tsx`（正規化オプション UI）・`ComboEditor.tsx`（初期化/hydrate/payload）・`labels.ts`（旧 `OKI_FIELDS` 撤去）。
- **FE 表示**: `ComboDetailMetadata.tsx`（詳細・sparse リスト）・`CompareTable.tsx`（比較・12 変種行）・`export-model.ts`/`export-items.ts`（出力）・`locales/{en,ja}.json`（per-field キー撤去・`none` 追加・「DR」略記解消）。

**dup/recipe 非対象の確認結果**: `CalcRecipeHash`（`service/combo/duplicate_keys.go`）・`validation.DuplicateKey`・`FindActiveByDuplicateKey` の WHERE・`RecomputeComboCache`（`notation/cache.go`）いずれも oki 非参照（grep 0 件）。正規化前後で recipe_hash・重複判定不変。

---

## 5. 自己テスト結果（ケース数）

### Go（`go test ./...` 全通過）
- **マイグレ 000021**（`migrate_test.go`・1 ケース）: up で `combo_oki_options` 新設・6 通り決定論 backfill（true のみ行・false/NULL は行なし・計 3 行）・6 bool 列 DROP（knockdown_advantage 残置）。down で行→6bool 逆写像 + **shimmy-DR/strike_meaty 行の損失を明示検証**（table DROP 確認）。
- **repository**（`repository_test.go`・1 ケース追加）: `ReplaceOkiOptions`/`FindOkiOptionsByComboID` 往復・打撃重ね/シミー ドライブラッシュ の保存・FindByID 注入・replace-set 差し替え・空で全解除。既存 tristate テストから oki を除去（replace-set へ移行）。
- **VAL-C11**（`combo_test.go`・2 ケース）: uniform 適用（throw_meaty/shimmy/strike_meaty すべてで DR 単独→WARNING）・no-gauge 同席で無警告。
- **dup 非回帰**: 既存 CheckDuplicate/recipe テスト不変（oki 非依存）。

### FE（`pnpm test` 664 件全通過）
- **editor**（`ComboEditorBasicFields.test.tsx`）: 12 変種 test-id 存在・新変種（シミー×ドライブラッシュ）トグルで onChange に `okiOptions` が乗る・**ラベルが「ドライブラッシュ」正式名称で「DR」略記なし**・「打撃重ね」見出し存在。
- **compare**（`CompareTable.test.tsx`）: 12 変種の ✓/✗ 個別行（4✓/8✗）・未設定時 12✗・正規化ラベル表示。
- **export**（`export-model.test.ts`）: oki が 12 変種へ展開・全選択 23 行。

### 型・ビルド
- `go build ./...` 成功・`go vet ./...` クリーン。
- FE `tsc --noEmit` 0 エラー（3 型 + request 型追従）。

---

## 6. 既知の制約・設計担当への伝達メモ（CHANGE 見込み 062〜）

### 6.1 既知の制約
- **down 損失**: shimmy-DR / strike_meaty の行は down で失われる（6 bool に受け皿が無い破壊的 down）。up→down→up の往復で新変種データは復元されない。
- **available dense/sparse**: sparse を採用（`available` 列なし）。tri-state の false/null 区別は保持しない。DES-003 §3.4 の将来正規化スケッチは `available` を列として記していたため、sparse 採用は下記 CHANGE で明記が必要。

### 6.2 設計担当への伝達メモ（三点セット反映は設計担当が起票）
以下の DES 反映が必要。製造担当は DES 本体を直接編集していない。

| CHANGE 見込み | 対象 | 内容 |
|------|------|------|
| 062（例） | DES-003 §3.4 | 起き攻め 6 bool を撤去し `combo_oki_options(combo_id, attack_type, tech_type, uses_dr)` 正規化を確定記載。**sparse 採用**（`available` 列なし・行存在＝利用可能）を明記。語彙 3×2×2（打撃重ね追加・シミー 4 区分化） |
| 063（例） | DES-005 §5.6/§5.7/§5.8/§5.13 | 詳細=利用可能オプションのラベル一覧・editor=正規化オプション UI・比較=12 変種行（非対称解消）・出力=12 変種展開。ラベル正典は「ドライブラッシュ」正式名称 |
| 064（例） | DES-002 §7.6 | CSV 起き攻めの新オプション 6 列（shimmy-DR ×2・strike_meaty ×4）を任意列として列末尾追加。旧 CSV 後方互換 |
| 065（例） | DES-006 VAL-C11 | 正規化後の C11 を**全 attack_type へ一様適用**（uses_dr=true は同 attack/tech の非DR必須）に更新 |
| — | DES-002 §4.2 相当 | **PATCH 意味変更**: 起き攻めは per-field `Optional[bool]` merge から replace-set（`okiOptions` nil=不変更/非nil=全置換・TagIDs と同方式）へ |

---

## 7. 例外条項・code-facts 相違

- code-facts §10 マイグレ一覧は 000018 までで stale（実ツリーは 000020）。次連番は実ツリー基準で **000021** を採番（指示書 §2.4 例外条項に従い実コードを正）。code-facts 再生成は別途 `/regen_code_facts`。
