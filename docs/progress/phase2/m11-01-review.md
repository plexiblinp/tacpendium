# M11-01 レビュー報告書

| 項目 | 内容 |
|------|------|
| 対象指示書 | `docs/instructions/M11-01-instruction.md` v1.1.0 |
| チェックリスト | `docs/instructions/reviews/M11-01-review-checklist.md` v1.1.0 |
| レビュー実施日 | 2026-06-20 |
| レビューモデル | Sonnet 4.6 |
| 対象コミット範囲 | `4f2f82c..HEAD`（製造コミット 6 件） |

---

## 総評

M11-01「custom_states 開始時状態の機能化(付与・表示・参照)」の実装品質は全体的に高水準。設計書 §4.2〜§4.4 で規定された情報のすべての経路（CREATE/PATCH/PUT + round-trip）に正しく実装されており、CHANGE-041 のバックエンド3点（DTO/Input/UPDATE SET）も指示書のとおり加算的に追加されていた。

seed マイグレーション・フロント付与 UI・詳細/比較表示の3領域とも、データ駆動設計・命名衝突回避・スコープ外（消費・検証）を持ち込まない点を守れている。指示書 §5.1 の 18 テストケースは全件がテストに反映されている。

軽微な問題として、seed の `scope` フィールド欠落（DES-003 例示との乖離）と、`ComboEditor.test.tsx` における `useCharacters` の未モック（動作上は無害だが潜在的な脆弱性）が見られた。いずれも動作を壊すものではなく、完了判定を妨げる重大問題は検出されなかった。

---

## 設計準拠性レビュー結果

### §1 設計書本体との照合（最重要）

#### 1.1 付与 UI（指示書 §4.2、DES-005 §5.7）

| 項目 | 評価 | 詳細 |
|------|------|------|
| 「キャラ固有状態」セクションが独立カラム「状況」とは別に新設 | ◎ | `ComboEditorBasicFields.tsx` の `{supportedStateDefs.length > 0 && <fieldset>}` で独立。i18n キーは `comboDetail.customStates.*` / `compare.row.customStates` と新系統で `comboDetail.situation.*` / `compare.row.situation` と非衝突 |
| useCharacters 戻りからデータ駆動描画 | ◎ | `ComboEditor.tsx:89-96` で `useCharacters()→find→parseCustomStateDefs()` の配線が正しく実装されている。`ComboEditorBasicFields` へ `customStateDefs` prop で渡す設計 |
| type=flag→トグル / type=level/stock→数値入力 / composite→スキップ | ◎ | `ComboEditorBasicFields.tsx:258-308` のレンダリングが指示書 §4.2 どおり。`isSupportedState` でフィルタ済み |
| 状態なしキャラでセクション非表示 | ◎ | `{supportedStateDefs.length > 0 && (...)}` の条件で非表示 |
| Int 入力が `-`/`e`/`.` を入力不可（既存 drive/sa と同方式） | ◎ | `blockNonNumericKeys(false)` を int 入力に適用。専用バリデータは追加していない（DES-006 §2.4 準拠） |

#### 1.2 表示（指示書 §4.3、DES-005 §5.6）

| 項目 | 評価 | 詳細 |
|------|------|------|
| ComboDetailHeader に「キャラ固有状態」セクション追加・独立カラムと分離 | ◎ | `ComboDetailHeader.tsx:97-115` にて `resolvedCustomStates.length > 0` 時のみ表示。独立カラム「状況」セクションとは別 `<h3>` ＋ `<dl>` |
| CompareTable に新 RowDef 追加・custom_states を表示 | ◎ | `CompareTable.tsx:244-246` に `labelKey: "compare.row.customStates"` / `render: renderCustomStates` の RowDef を追加 |
| code→name_ja 解決がキャラ定義由来 | ◎ | `parseCustomStateDefs` + `resolveCustomStatesForDisplay` の組み合わせで、`useCharacters` 戻りの `customStates` を JSON.parse して `name_ja` を解決している |

#### 1.3 situation 組立・round-trip（指示書 §4.2/§4.4）

| 項目 | 評価 | 詳細 |
|------|------|------|
| buildCreatePayload / buildPatchPayload / runPut の3経路すべてに situation 組立 | ◎ | `ComboEditor.tsx:176`（CREATE）/ `200`（PATCH）/ `325-337`（PUT は `buildCreatePayload()` を展開して使用）に `buildSituation(...)` が組み込まれている |
| PATCH の BE 受け口（UpdateMetadataRequest / UpdateMetadataInput / repo UPDATE SET） | ◎ | `dto.go:88`（`UpdateMetadataRequest.Situation *string`）/ `repository.go:74`（`UpdateMetadataInput.Situation *string`）/ `repository.go:609-611`（UPDATE SET に `situation = ?`）が正しく実装されている（CHANGE-041 準拠） |
| initialBasic で edit/copy 時に既存 situation を parse → 復元（round-trip） | ◎ | `ComboEditor.tsx:598-599` にて `customStates: parseSituationCustomStates(initial.situation)` が設定されている |
| 格納規則（boolean true のみ / int は min 以外 / 他キー保全 / 空なら未送信） | ◎ | `customStates.ts:104-151` の `buildSituation` で全規則を実装。単体テスト(10)〜(13)で各規則を検証済み |

#### 1.4 seed 定義投入（指示書 §4.1、definitions §3.1）

| 項目 | 評価 | 詳細 |
|------|------|------|
| ryu=denjin_charge 置換 / ingrid=sun_crest(min0/max4) / c_viper=limit_decoupler | ◎ | `000015_seed_custom_states_classic3.up.sql` の3件の UPDATE が定義どおり |
| .down.sql が ryu='{}' / ingrid・c_viper=NULL へ戻す | ◎ | `000015_seed_custom_states_classic3.down.sql` が正しく実装されている |
| aki/jamie/guile を変更していない / 破壊的クリアなし | ◎ | up.sql / down.sql ともに対象外3体へのSQL文なし。加算的 UPDATE のみ |

---

### §2 API・スキーマ整合性

| 項目 | 評価 | 詳細 |
|------|------|------|
| POST / PUT / check-duplicate の契約は不変 | ◎ | `CreateRequest`・`CheckDuplicateRequest` に変更なし。`UpdateMetadataRequest` への situation 加算のみ |
| PATCH /api/combos/:id に situation が加算 / nil=不変更パターン | ◎ | `repository.go:609-611` の `if input.Situation != nil { add("situation", *input.Situation) }` が既存パターンに整合 |
| 重複判定キー（VAL-C02）は不変 | ◎ | `CheckDuplicateRequest` に situation なし。VAL-C02 ロジックに変更なし |
| situation は *string 素通し / 検証・業務ロジックなし / スキーマ不変 | ◎ | サービス層 `UpdateMetadataInput` は `comborepo.UpdateMetadataInput` の型エイリアスで素通し。スキーマ変更なし |

---

### §3 フロントエンドの動作仕様

| 項目 | 評価 | 詳細 |
|------|------|------|
| flag=トグル / int=数値入力 / 状態なしキャラで非表示 | ◎ | §1.1 参照 |
| キャラ変更時（CHANGE-036）に付与値もリセット | ◎ | `applyCharacterChange` が `setBasic({ ...initialBasic(undefined), characterId: nextCharacterId })` を呼ぶため `customStates: {}` に初期化される |
| 編集/コピーで付与値が往復保持 | ◎ | §1.3 round-trip 参照 |
| 独立カラム「状況」入力・M10 キャラ選択挙動が不変 | ○ | コードを読んだ範囲では変更なし。実機確認は別途必要 |

---

### §4 テストの妥当性

| 項目 | 評価 | 詳細 |
|------|------|------|
| 必須テスト §5.1 の 18 ケース | ○ | 全18ケースがテストに反映されている。ただし指示書番号(7)「int 入力が `-`/`e`/`.` を弾く」は `blockNonNumericKeys` の共通テスト（`ComboEditorBasicFields.test.tsx:87-117`）でカバーされているが、「custom_states の int 入力」として番号を明記したテストケースは存在しない（共通関数のテストで実質カバー済みのため軽微） |
| E2E: A〜E シナリオ | △ | コードテストのみ。実機 E2E は製造担当の完了報告に「実機確認必須」とあり、本レビューはコード確認のみ。機能 DoD の判定には実機確認が別途必要 |

---

### §5 設計意図との整合

| 項目 | 評価 | 詳細 |
|------|------|------|
| 消費を実装していない | ◎ | 減少・解除・バリデーション連動の実装なし |
| データ駆動（定義投入だけで新キャラも動く構造） | ◎ | custom_states の `states[]` を JSON.parse して動的描画しており、ハードコードなし |
| 呼称分離（「状況」独立カラムと「キャラ固有状態」を混同しない） | ◎ | UI ラベル・i18n キーが完全分離されている |
| スキーマ非変更 | ◎ | `combos.situation` TEXT 既存を活用 |
| custom_states はメタデータ（PATCH 経路） | ◎ | CHANGE-041 による加算で対称化済み |
| ryu の `'{}'` → 電刃 置換 | ◎ | 000015 up.sql で置換済み |

---

### §6 コード品質・規約

| 項目 | 評価 | 詳細 |
|------|------|------|
| queryKey 規約（`["characters", { gameId }]`）に整合 | ◎ | `ComboEditor.tsx` / `ComboDetailHeader.tsx` / `CompareTable.tsx` はいずれも `useCharacters()` フックを介して既存 queryKey を使用 |
| i18n キーが新系統で命名衝突を避けているか | ◎ | `comboDetail.customStates.*` / `compare.row.customStates` で既存キーと非衝突 |
| custom_states 格納キーが定義と一致（denjin_charge/sun_crest/limit_decoupler） | ◎ | seed SQL・テスト・コードが一致している |

---

### §7 既存挙動の温存

| 項目 | 評価 | 詳細 |
|------|------|------|
| 独立カラム「状況」入力・表示が不変 | ○ | コードレベルでは変更なし。実機確認推奨 |
| POST/PUT 契約・スキーマが不変 | ◎ | §2 参照 |
| aki/jamie/guile seed が不変 | ◎ | §1.4 参照 |
| situation=NULL の既存コンボが詳細/比較/編集で壊れない | ◎ | `resolveCustomStatesForDisplay(null, defs)` → 空配列 → セクション非表示。テスト(18)で検証済み |

---

### §8 ドキュメント

| 項目 | 評価 | 詳細 |
|------|------|------|
| DES を製造担当が直接編集していないか | ◎ | 変更ファイル一覧に `docs/design/` 配下のファイルなし（CHANGE-041 通知書は `docs/change-notes/` 配下） |
| 完了報告に Plan Mode §3.4(8項目)・推測内容・テストケース数を含むか | 不明 | 本レビュー実施時点で完了報告が存在しない。製造担当が DoD に従い完了報告を記載することを期待する |

---

## 設計準拠性以外の指摘事項

### A. seed の `scope` フィールド欠落（DES-003 §3.2 との乖離）

**ファイル**: `migrations/000015_seed_custom_states_classic3.up.sql`

DES-003 §3.2 の `custom_states` 構造例および既存 seed（`000009_seed_characters_aki_jamie_guile.up.sql`）では `scope: "persistent"` が各状態定義に含まれているが、000015 の3体では `scope` フィールドが欠落している。

フロントエンド側の `CustomStateDef` 型（`customStates.ts:19-26`）に `scope` は定義されていないため、現在の実装では `scope` フィールドを参照・使用しておらず、動作上の問題は生じない。ただし設計書例示との一貫性が損なわれている。

将来的に `scope` を参照するロジックを追加した場合（例: `conditional` 状態の付与制御）、000015 の3体だけ定義が不完全になる。

### B. `ComboEditor.test.tsx` で `useCharacters` が未モック

**ファイル**: `web/src/features/combo/components/ComboEditor.test.tsx`

`ComboEditor.tsx` は `useCharacters()` を内部で直接呼び出しているが、`ComboEditor.test.tsx` に `useCharacters` の vi.mock がない。現状は `ComboEditorBasicFields` がモック化されているため、`customStateDefs` が空配列になっても `buildSituation` が「既存 situation を保持」する動作（`customStates.ts:111-113`）により round-trip テスト(14)(15)は正しく通る。

ただし、将来 `ComboEditor.tsx` が `useCharacters` の戻り値に依存するロジックを追加した場合、テストが意図せず壊れる潜在リスクがある。現在の動作は問題ないが、テストの堅牢性向上のため `useCharacters` を明示的にモックすることを推奨する。

### C. `buildSituation` の `existing` 引数に `initial?.situation` を渡している（新規登録時の懸念）

**ファイル**: `web/src/features/combo/components/ComboEditor.tsx:176`

```typescript
situation: buildSituation(initial?.situation, basic.customStates, customStateDefs) ?? null,
```

`mode="new"` の場合、`initial` は `undefined` のため `initial?.situation` は `undefined`。`buildSituation(undefined, ...)` は正常動作するため問題なし。設計意図（既存 situation の他キー保全）との整合性も取れている。

指摘というより確認事項として記録する。動作上の問題はない。

---

## 推奨修正（優先度別）

### 高（M11完了前に修正必須）

なし。重大判定基準（§9）に該当する問題は検出されなかった。

### 中（M12着手と並行可）

**中-1: `ComboEditor.test.tsx` に `useCharacters` モックを追加**

指摘 B の対応。`ComboDetailHeader.test.tsx` / `CompareTable.test.tsx` と同様に vi.mock を追加することでテストの将来的な安定性を確保できる。現状は動作に影響しないため M12 着手前までに対応すれば十分。

### 低（将来対応）

**低-1: 000015 seed の `scope` フィールド追加**

指摘 A の対応。DES-003 との整合性のため、denjin_charge / sun_crest / limit_decoupler の各定義に `"scope": "persistent"` を追加することを推奨する。ただし現実装では `scope` を参照しないため、動作への影響はない。次回 seed 更新の機会（M12-02 の seed 再整理など）に合わせて対応するのが自然。

---

## 良かった点

1. **データ駆動設計の徹底**: custom_states の `states[]` を JSON.parse して動的に描画するロジックが `customStates.ts` に独立モジュールとして切り出されており、テスト容易性・再利用性が高い。ComboDetailHeader / CompareTable が同モジュールを共有できている。

2. **情報の保全マージ**: `buildSituation` が「既存 situation を parse → custom_states キーのみ差し替え → serialize」の保全マージを実装しており、将来的に situation に他キーが追加されても安全に動作する防衛的設計。

3. **テストの充実度**: 指示書 §5.1 の 18 ケースが各テストファイルに番号付きコメントで明示されており追跡容易。`buildSituation` の単体テストは境界値（true のみ格納・min 省略・他キー保全・composite スキップ・定義空ガード）を網羅している。

4. **CHANGE-041 のスコープ遵守**: バックエンドの変更を「PATCH の situation 加算のみ（DTO/Input/UPDATE SET 3点）」に限定し、サービス層の業務ロジック・重複判定・スキーマに一切手を加えていない点が指示書 §2.4 の設計意図を正確に実現している。

5. **i18n 命名衝突の完全回避**: 既存の `comboDetail.situation.*` / `compare.row.situation`（独立カラム「状況」用）と新規の `comboDetail.customStates.*` / `compare.row.customStates`（キャラ固有状態用）が明確に分離されており、研究調査報告（FU-4）で指摘された命名衝突リスクを適切に解消している。

---

## 制約事項

- 本レビューはコード上で判定可能な範囲のみ対象。実際の動作確認・パフォーマンス・実機テスト（指示書 §5.2 E2E シナリオ A〜E の手動確認）は別途実施が必要。
- 機能 DoD（§7）の達成判定には「実機 E2E が完了の必須ゲート」が含まれており、本レビュー通過のみでは完了条件を満たさない。
- データベースファイルが存在しないため、マイグレーション適用後の実データへの live SELECT による確認は実施していない。テストコードの検証のみ。

---

*M11-01 レビュー報告書。配置 `docs/progress/m11-01-review.md`。*

---

## 取り込み結果(自動トリアージ)

implement_plan_full Phase C により、製造担当が本報告書の指摘を自動トリアージした結果(採否と理由)。優先度「高」はゼロのためエスカレーションなしで自動進行。

| 指摘 | 優先度 | 採否 | 理由・対応 |
|------|--------|------|-----------|
| 中-1: `ComboEditor.test.tsx` に `useCharacters` モック追加 | 中 | **採用** | `vi.mock("@/features/character/hooks/useCharacters", ...)` を ryu(custom_states 定義つき)で追加。ComboEditor.test 17 件全パスを確認。将来 useCharacters 依存ロジック追加時のテスト堅牢性を確保。 |
| 低-1: 000015 seed に `scope:"persistent"` 追加 | 低 | **不採用(持ち越し)** | 指示書 §4.1/§2.1 が definitions §3.1 の確定 JSON を「**逐語**」投入と指示し、その確定 JSON に `scope` は含まれない。DES-003 §3.2 例示・000009 との不整合解消は definitions §6 が「CHANGE-040 で設計担当が判断」と明記する**設計判断領域**。製造が独自に追加すると逐語指示に反するため、設計担当へ申し送り(progress-log 記録済み)。現実装は `scope` 非参照で動作影響なし。 |
| 指摘 A(= 低-1 と同一) | 低 | 上記に同じ | — |
| 指摘 B(= 中-1 と同一) | 中 | 上記に同じ | — |
| 指摘 C: `buildSituation(initial?.situation, …)` 新規時 | 確認 | **対応不要** | レビュアー自身が「`buildSituation(undefined, ...)` は正常動作・問題なし」と結論。新規(`mode="new"`)は `initial` 不在で `undefined` 渡し=設計どおり。 |
| §4 番号(7)「custom_states int 入力の -/e/. 弾き」専用テスト | 軽微 | **持ち越し** | 共通関数 `blockNonNumericKeys(false)` のテストで実質カバー済み(int 入力は同関数を使用)。専用番号テストは将来追加で可。 |

取り込み後の再検証: Go 全テスト / web 513 テスト / tsc / lint / 本番ビルド すべてグリーン。

*取り込み結果 追記。自動トリアージ実施 2026-06-20。*
