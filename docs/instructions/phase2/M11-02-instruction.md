# M11-02 製造指示書 v1.0.0 — nullable メタデータの PATCH クリア一般化(presence-detection)

| 項目 | 内容 |
|------|------|
| 指示書ID | M11-02 |
| バージョン | 1.0.1 |
| 作成日 | 2026-06-21 |
| 作成者 | 設計担当 Claude(フェーズ2 本流スパイン・M11 担当) |
| 対象マイルストーン | M11 / M11-02 |
| 実装モデル | **Opus 4.8**(DTO の presence 検出 + Input 3状態 + repo SET ロジック + situation 移行 + 部分 PATCH 経路の安全担保で横断的に関心が絡む、playbook §7.1 Opus 信号) |
| レビューモデル | Sonnet 4.6 |
| Plan Mode | **必須**(§3.4。presence 検出手段・Input 3状態の型・テスト影響・部分 PATCH 安全確認) |
| 機械レビュー | 必須(別チェックリスト: `M11-02-review-checklist.md`) |
| スコープ種別 | **バックエンド中心 + 軽微フロント**(DTO/Input/repo の presence 化 + buildPatchPayload の situation を `?? null` へ移行。スキーマ不変) |
| 関連 CHANGE | CHANGE-043(DES-002 v1.23.0 §4.2 PATCH クリア規約の一般化。**反映済みを前提**)。CHANGE-042 の situation `""` センチネルを**置換**(成果=NULL クリアは不変) |
| 実装担当 | M11-01 担当(ComboEditor/repository の文脈を持つウォームなセッション) |

## 更新履歴

| 版 | 更新日 | 更新内容 |
|----|--------|----------|
| 1.0.0 | 2026-06-21 | 初版。M11-overview v1.1.0 §3.3・M11-RESEARCH-02 報告・CHANGE-043 に基づく。方式=presence-detection(統一案・situation を null=クリアへ移行) |
| 1.0.1 | 2026-06-21 | 製造完了後 errata(機能変更なし)。§2.1 FE コメント行のファイル参照を `customStates.ts` →`ComboEditor.tsx`(:200-202 buildPatchPayload 内センチネル説明)へ訂正(A-1)。§5.2 A を「spec は wire 形式非依存の挙動ベースのため null 移行後も無修正で有効」へ表現是正(A-2)。製造担当連絡 m11-02-design-handoff-notes 反映 |

---

## §1 背景と目的

### §1.1 背景

- M11-01 事後に、`PATCH /api/combos/:id` で nullable メタデータ(memo / damage / drive_damage / ゲージ / knockdown_advantage / 起き攻め)を**空に戻しても永続化されない**同型バグが判明(伝達レポート §5.1)。M11-01 では situation のみ空文字センチネル(CHANGE-042)で暫定対処していた。
- M11-RESEARCH-02 で現状確定:
  - `buildPatchPayload`(ComboEditor.tsx:192-210)は**全メタデータを毎回送り**、空入力を `null`(situation は `""`)で明示送信(Q1)。`isDraft` は送らない。
  - DTO `UpdateMetadataRequest` は全 `*T`(Q2-a)で、**「キー不在」と「null」を区別できない**(Q2-b)。
  - repo `UpdateMetadata` は `if input.X != nil { add(col, *X) }` の per-field nil チェック=部分更新(Q3-a)。situation のみ `""→nil` センチネル(Q3-b)。
  - **`PromoteToFinalButton` は `{version, isDraft}` の2キーのみ送る部分 PATCH**(Q6)。→ full-replace は採れない。

### §1.2 目的(完了時に達成される状態)

- PATCH の nullable メタデータが **presence-detection トライステート**で統一的に動く:
  - **キー不在＝不変更** / **`null`＝NULL クリア** / **値＝更新**。
- 編集で memo / damage / drive_damage / ゲージ / knockdown_advantage / 起き攻め / situation を**空に戻すと NULL に永続化**される。
- 部分 PATCH(昇格 `PromoteToFinalButton`)は**不在=不変更**で他フィールドを温存(誤クリアしない)。
- situation は `null`=クリアへ統一(CHANGE-042 の `""` センチネルを撤去。クリア成果 NULL は不変)。

### §1.3 このサブユニットで作らないもの(スコープ外)

- 識別キー(レシピ・始動技・position 等)の PATCH 経由編集(従来どおり POST/PUT 誘導)。
- DES-005/006/003 の変更(画面・検証・スキーマは不変)。
- tagIds のクリア機構(service の `ReplaceTagAssociations` で空配列=クリアが既に成立。対象外)。
- custom_states の機能拡張(M11-01 完了済。本サブは PATCH クリア規約のみ)。

---

## §2 成果物

### §2.1 修正するファイル(実パス・行は §3.4 view で最終確認)

| 区分 | ファイル | 修正内容 |
|------|---------|---------|
| BE | `internal/api/combo/dto.go` `UpdateMetadataRequest` + `toServiceUpdateMetadataInput` | **presence 検出を実装**(キーが来たか/null か/値かの3状態を判別)。手段は §3.4 で確定(カスタム `UnmarshalJSON` で present キー集合を保持 / `Optional[T]` ラッパ型 / `map[string]json.RawMessage` 前段 等)。DTO→Input で3状態を伝播 |
| BE | `internal/repository/combo/repository.go` `UpdateMetadataInput` / `UpdateMetadata` | Input を **3状態**(不在/null/値)を表す型へ。`UpdateMetadata` の SET を「**present のみ SET。present+null は `add(col, nil)`(NULL)。present+値は `add(col, *値)`(更新)**」へ。**situation の `""→nil` センチネル分岐を撤去**(present+null で NULL クリアに統一) |
| BE | `internal/service/combo/service.go` `UpdateMetadataInput`(repo 型 alias)・`UpdateMetadata` | 型変更に追従(alias 維持なら repo 側変更が伝播)。input を repo へ素通しする現挙動は維持 |
| FE | `web/src/features/combo/components/ComboEditor.tsx` `buildPatchPayload`(:192-210) | **situation を `?? ""` → `?? null` へ移行**(統一案)。他フィールドは既に空入力を `null` 送信のため**変更不要**。`PromoteToFinalButton` は変更不要(2キー送出=不在=不変更で正しい) |
| FE | `web/src/features/combo/components/ComboEditor.tsx`(`buildPatchPayload` 内センチネル説明コメント:200-202 付近) | situation の送出が `""`→`null` へ変わる旨へコメント整合(CHANGE-043) |

### §2.2 変更しないもの(保護対象)

- 識別キー編集の POST/PUT 誘導、重複判定(VAL-C02)。
- `PromoteToFinalButton`(2キー部分 PATCH)の送出内容。**不在=不変更で温存される**こと(=本変更の安全要件)。
- `is_draft`(非 nullable。クリア対象外。不在=不変更 / 値=更新)。
- tagIds の `ReplaceTagAssociations` 経路。
- スキーマ(対象列はすべて nullable 既存)。

### §2.3 例外条項

本サブは **§2.1 の BE 中心変更そのものが正規スコープ**(CHANGE-043 で承認済)。これを超えるスキーマ変更・新エンドポイント・識別キー周りの変更が必要と判断した場合は Plan Mode で停止し開発者に相談。

---

## §3 前提条件

### §3.1 必読

- **M11-RESEARCH-02 報告**(`docs/progress/M11-RESEARCH-02-report.md`)§1〜§7(特に Q1 全送出 / Q2-b 不在=null 非区別 / Q3 repo SET / Q6 部分 PATCH 経路)。
- **DES-002**(`docs/design/02-architecture.md` **v1.23.0**、CHANGE-043 反映済み)§4.2 `PATCH /api/combos/{id}` のクリア規約(不在=不変更 / null=クリア / 値=更新)。
- **CHANGE-043**(`docs/change-notes/CHANGE-043-M11-02-patch-clear-tristate.md`)。
- M11-overview §3.3、CHANGE-041/042(背景)、code-facts.md commit `3e0f4bf`。

### §3.2 任意

- M11-01 指示書 v1.1.0(situation 組立・round-trip)。`ComboEditor.test.tsx`/`repository_test.go` の既存 PATCH テスト。

### §3.3 参照不要

- custom_states の付与/表示 UI(M11-01 完了)。moves 取込。

### §3.4 着手前の確認(Plan Mode。**結果を開発者へ報告**)

> §9.1 推測 NG を実 view で確認。複数項目のため §8.4.2 質問書ファイル方式を推奨。

1. **presence 検出手段の確定**: `UpdateMetadataRequest` の unmarshal で「キー不在/null/値」を判別する実装を選ぶ。候補: (a) `UnmarshalJSON` で `map[string]json.RawMessage` を前段に取り present キー集合を保持、(b) nullable 各フィールドを `Optional[T]{ Present bool; Value *T }` ラッパ型に。**既存の `*T`+`omitempty` 構造(dto.go:77-98)と DTO→Input 変換(dto.go:285-310)を view し、影響最小の手段を選定**。
2. **Input 3状態の型**: repo `UpdateMetadataInput`(現 `*T`)を3状態へ。service が alias(service.go:80-81)である点・DTO→Input 素通し(dto.go:285-310)・repo SET(repository.go:580-635)への波及を確認。
3. **repo `UpdateMetadata` の SET ロジック**: `if present { if value==nil { add(col, nil) } else { add(col, *value) } }` へ。**situation の `""→nil` センチネル分岐(repository.go:611-617)を撤去**し統一規約へ。Go の typed-nil を `add(col, nil)` で正しく NULL にする点に留意。
4. **フロント situation 移行**: `buildPatchPayload` の situation を `?? ""`→`?? null`(ComboEditor.tsx:200 付近)。`buildSituation` の定義未ロード時ガード(customStates.ts:111-113、既存 situation 保持)と両立する(ガード時は既存文字列を返すため `?? null` 分岐に入らない)ことを確認。
5. **部分 PATCH 経路の安全確認(Q6)**: `PromoteToFinalButton`(`{version, isDraft}` 2キー)が、presence-detection 下で**他フィールド不在=不変更**となり温存されることを確認。`buildPatchPayload` が `isDraft` を送らない非対称(§7)も「不在=不変更」で is_draft が温存されることを確認。
6. **テスト影響の棚卸し**: repo (16)(17)(18) / front (19) が新規約で表す内容(situation `""`→`null`、(17) は situation 不在=不変更)へ更新。
7. **起き攻め6の挙動**: 本規約で `null`=NULL クリアが可能になる(従来は不変更)点を確認しテストへ反映。

---

## §4 詳細仕様

### §4.1 クリア規約(presence-detection トライステート)

PATCH の nullable メタデータ各項目について:

| 受信 | 意味 | repo 動作 |
|------|------|----------|
| キー不在(送信なし) | 不変更 | SET 句に含めない |
| `null`(キーあり null) | NULL クリア | `add(col, nil)` |
| 値あり | 更新 | `add(col, *値)` |

対象: memo / damage / drive_damage / drive_available_at_start / sa_available_at_start / knockdown_advantage / situation / 起き攻め 6 BOOLEAN。`is_draft`(非 nullable)は「不在=不変更 / 値=更新」(null クリアなし)。

### §4.2 バックエンド(presence 化)

- **DTO**: `UpdateMetadataRequest` が「キーが来たか」を判別できるようにする(§3.4-1 で確定した手段)。`Version`(非ポインタ)は対象外。`SetupCarryOptions`/`tagIds` は従来扱い。
- **Input**: repo `UpdateMetadataInput` を3状態表現へ。DTO→Input(`toServiceUpdateMetadataInput`)で present/null/値を伝播。
- **repo `UpdateMetadata`**: §4.1 の表どおり SET。**situation 専用センチネル(`""→nil`)を撤去**。`version+1`・`updated_at` の常時付与は維持(repository.go:642)。

### §4.3 フロント(situation の null 移行のみ)

- `buildPatchPayload`: situation を `buildSituation(...) ?? null` に変更(`?? ""` 撤去)。**他フィールドは既に空→`null` 送信のため変更不要**(presence-detection 下で `null`=クリアが効く)。
- `PromoteToFinalButton`: 変更不要(2キー=不在=不変更)。
- POST/PUT 経路(`buildCreatePayload`/`runPut`)は変更不要(INSERT で NULL 保存、presence-detection 非対象)。

### §4.4 部分 PATCH 経路の安全(Q6)

- `PromoteToFinalButton` は `{version, isDraft}` のみ送る → 他フィールド不在=不変更で温存。**full-replace ではないため誤クリアしない**。これは presence-detection 採用の主目的。実装後、昇格でメタデータが消えないことを E2E で確認。

### §4.5 既知の挙動変更(明示)

- **起き攻め 6 BOOLEAN**: 本規約で `null`=NULL クリアが可能になる(従来は不変更)。フォーム状態を正とする挙動として整合。round-trip(値あり→present+値→同値更新)は不変。
- **situation**: クリア表現が `""`→`null` に変わる(成果 NULL は不変)。CHANGE-042 の `""` センチネルは撤去。

---

## §5 テスト要件

### §5.1 必須テスト(ケース数で確認)

- **BE repo**: (1) memo を `null`(present)で PATCH → NULL クリア、(2) memo 不在の PATCH → memo 不変更(他フィールドのみ更新)、(3) damage / 数値各項目の present+null → NULL クリア、(4) situation present+null → NULL クリア(旧 `""` ケースの置換)、(5) situation 不在 → 不変更、(6) 起き攻め present+null → NULL クリア、の各ケース(既存 (16)(17)(18) を新規約へ更新 + 追加)。
- **BE 部分 PATCH 安全**: (7) `{version, isDraft}` 相当の部分 PATCH で memo/damage/situation/起き攻め/数値が**温存**される。
- **FE 単体**: (8) edit で全 off → `buildPatchPayload` の `situation === null`(旧 `=== ""` を更新)、(9) 空の memo/damage が `null` で送られる(既存挙動の維持確認)。
- **後方互換**: (10) situation=NULL の既存コンボの編集・表示が壊れない。

### §5.2 E2E シナリオ

- **A(situation クリア・null 経路)**: 電刃錬気あり登録 → 編集で off → 保存 → 詳細非表示(situation が `null` で NULL クリアされる)。既存 `combo-custom-states.spec` は **wire 形式(`""`/`null`)に依存しない挙動ベース**(「電刃錬気が詳細で非表示」をアサート)で書かれていれば、null クリア移行後も**無修正で有効**(挙動確認のみで足りる)。
- **B(memo クリア)**: memo ありで登録 → 編集で memo を空に → 保存 → 再取得で memo が空(NULL)。
- **C(数値クリア)**: damage ありで登録 → 編集で空に → 保存 → 再取得で damage 未設定(NULL)。
- **D(昇格で温存)**: 仮登録(damage/memo あり)→ 昇格(`PromoteToFinalButton`)→ damage/memo が**温存**される(誤クリアなし)。
- **E(非回帰)**: POST/PUT 登録・識別キー編集・M10/M11-01 機能が回帰しない。

---

## §6 レビュー観点

別ファイル `docs/instructions/reviews/M11-02-review-checklist.md`(v1.0.0)を参照。

---

## §7 完了条件(DoD)

- **機能要件**: §1.2 の状態。§5.2 A〜E が手動 E2E で通る(特に **D=昇格でメタデータが消えない**)。
- **自己テスト**: §5.1 全ケース通過。Go 全テスト / web 単体 / tsc / lint / `go build ./...` green。
- **品質**: 部分 PATCH(昇格)で誤クリアが起きない。identity 編集の POST/PUT 誘導・M11-01 機能に非回帰。
- **ドキュメント**: 完了報告に Plan Mode §3.4 結果(presence 手段・Input 型・部分 PATCH 安全確認)・テストケース数。DES 変更は設計担当が CHANGE-043 で反映済み(製造担当は DES を直接編集しない)。
- **完了報告**: 実装裁量・乖離・要確認を報告。**実機 E2E が完了の必須ゲート**(A〜E)。

---

## §9 注意事項

### §9.1 推測 NG(必ず view で確認)

- presence 検出手段(DTO の unmarshal 実装)/ Input 3状態の型 / repo `UpdateMetadata` の SET ロジックと situation センチネル撤去位置 / `buildPatchPayload` の situation 移行位置 / `PromoteToFinalButton` ほか PATCH 全呼び出し元の送出内容(部分 PATCH 安全)/ 既存テストの前提。**実装済み/未実装を想定で決めない**(retrospective-digest §1 パターンA)。

### §9.2 推測 OK(M11-RESEARCH-02 で裏取り済み)

- `buildPatchPayload` は全フィールド毎回送出・空は `null`/`""`(Q1)。DTO は全 `*T` で不在/null 非区別・`RawMessage` 等なし(Q2)。repo は per-field nil チェック・situation のみ `""→nil`(Q3)。クリア対象 nullable 列の全数(Q4)。`PromoteToFinalButton` は2キー部分 PATCH(Q6)。スキーマ変更不要(対象列は nullable 既存)。

### §9.4 Plan Mode 必須項目(§3.4 と同一)

§3.4 の 1〜7 を実 view で確認し、§8.4.2 質問書ファイル方式で報告。

---

*M11-02 製造指示書 v1.0.0。配置 `docs/instructions/M11-02-instruction.md`、対のレビューチェックリストは `docs/instructions/reviews/M11-02-review-checklist.md`(v1.0.0)。CHANGE-043 反映済みを前提に投入する。*
