# M11-RESEARCH-02 調査結果レポート: PATCH メタデータ更新経路の現状

| 項目 | 内容 |
|------|------|
| 指示書 | `docs/instructions/M11-RESEARCH-02-patch-metadata-update-current-state.md`(v1.0.0) |
| 調査日 | 2026-06-21 |
| モード | 自動(read-only 全数調査・judgement-free) |
| 種別 | read-only 調査(コード・テスト・設計書の変更なし。本レポートのみ作成) |
| 対象 | M11-02(nullable メタデータの PATCH クリア一般化)方式確定の前提裏取り |

> **姿勢**: 事実とコード断片のみを列挙する。方式(full-replace / presence-detection)の良し悪し・推奨は記載しない(設計判断は設計担当)。

---

## §0 サマリ表(Q1〜Q6 要点)

| Q | 要点(1 行) |
|---|------------|
| **Q1-a** | `buildPatchPayload` は **「その時点の全メタデータフィールドを固定で毎回送る」**(変更分のみ・値ありのみではない)。ただし `isDraft` は含めない。`ComboEditor.tsx:192-210` |
| Q1-b | 空入力は **キー脱落ではなく明示値で送出**: memo/数値5項目=`null`、situation=`""`(空文字センチネル)、起き攻め6=`?? null`、tagIds=配列。すべて JSON にキーが出る。 |
| Q1-c | `JSON.stringify(req)` で送信(`api.ts:177`)。空項目は `undefined` ではなく `null`/`""` を入れているため **脱落せず JSON `null`/`""` として送られる**(「キーを送らない」は現状成立していない)。 |
| **Q2-a** | `UpdateMetadataRequest` は **全フィールド `*T` + `omitempty`**(`Version int` のみ非ポインタ)。`dto.go:77-98` |
| **Q2-b** | `*T` のため Go `json.Unmarshal` は **「キー不在」と「キーあり null」を区別できない**(両方 nil)。`json.RawMessage`/`map`/カスタム `UnmarshalJSON` は **不在**。presence-detection は現 DTO では **不可**。 |
| Q3-a | repo `UpdateMetadata` は **全フィールド `if input.X != nil { add(col, *input.X) }`** の per-field nil チェック(=部分更新 / nil=不変更)。`repository.go:580-635` |
| Q3-b | **situation のみ** `*input.Situation == "" → add("situation", nil)` のセンチネル分岐あり(`repository.go:611-617`、CHANGE-042)。他フィールドに同種分岐は **0 件**。 |
| Q3-c | service `UpdateMetadataInput` は repo 型の **type alias**(`service.go:81`)。DTO→Input は `toServiceUpdateMetadataInput` で **ポインタ素通し**(`dto.go:285-310`)。service は input をそのまま repo へ渡す(`service.go:352`)。 |
| Q4 | PATCH 対象 nullable 列のうち situation 以外(memo/damage/drive_damage/drive_available_at_start/sa_available_at_start/knockdown_advantage)は **空入力→null 送出→nil=不変更で温存(クリア不能)**。起き攻め6は `false`(非 null)送出で **0 に設定可(NULL クリアは不可)**。situation のみ `""` センチネルで NULL クリア可。 |
| Q5 | nil=不変更 / situation `""`=NULL を前提するテストが存在(repo: `TestRepository_UpdateMetadata_Situation` (16)(17)(18) ほか / front: `ComboEditor.test.tsx` (19))。方式変更時に影響し得る。 |
| **Q6** | **別フローの部分 PATCH が存在**: `PromoteToFinalButton` は `{ version, isDraft:false }` の **2 キーのみ**送る(`PromoteToFinalButton.tsx:48-49`)。`buildPatchPayload` も `isDraft` を省く。full-replace(送られない=クリア)に倒すと、これらの経路で **未送出フィールドが誤クリアされ得る**。 |

---

## §1 Q1: フロント `buildPatchPayload` のペイロード構造

### 1-a. どのフィールドを含めるか(全送出 / 変更分)

`web/src/features/combo/components/ComboEditor.tsx:192-210`:

```ts
const buildPatchPayload = (): UpdateMetadataRequest => ({
  version: initial?.version ?? 0,
  damage: parseOptInt(basic.damage),
  driveAvailableAtStart: parseOptInt(basic.driveAvailableAtStart),
  saAvailableAtStart: parseOptInt(basic.saAvailableAtStart),
  driveDamage: parseOptInt(basic.driveDamage),
  knockdownAdvantage: parseOptInt(basic.knockdownAdvantage),
  memo: nullIfEmpty(basic.memo),
  situation: buildSituation(initial?.situation, basic.customStates, customStateDefs) ?? "",
  okiMeatyNeutralTechThrow: basic.okiMeatyNeutralTechThrow ?? null,
  okiMeatyNeutralTechThrowDr: basic.okiMeatyNeutralTechThrowDr ?? null,
  okiMeatyBackTechThrow: basic.okiMeatyBackTechThrow ?? null,
  okiMeatyBackTechThrowDr: basic.okiMeatyBackTechThrowDr ?? null,
  okiShimmyNeutralTech: basic.okiShimmyNeutralTech ?? null,
  okiShimmyBackTech: basic.okiShimmyBackTech ?? null,
  tagIds: basic.tagIds,
});
```

**事実**:
- 含むのは **その時点のフォーム値を全フィールド固定で毎回**。条件分岐による省略は **無い**(「変更されたフィールドのみ」「値があるフィールドのみ」ではない)。
- 含むキー(計 14): `version` / `damage` / `driveAvailableAtStart` / `saAvailableAtStart` / `driveDamage` / `knockdownAdvantage` / `memo` / `situation` / 起き攻め6 BOOLEAN / `tagIds`。
- **含まないキー**: `isDraft`(`UpdateMetadataRequest` には存在するがこの builder では未設定)/ `setupCarryOptions`(`runPatch` で spread 追加、`ComboEditor.tsx:321`)。
- 呼び出し: `runPatch` が `patchMut.mutate({ ...buildPatchPayload(), setupCarryOptions }, ...)`(`ComboEditor.tsx:320-321`)。

### 1-b. 各フィールドの空入力時の送出値

ヘルパ実装(`ComboEditor.tsx:628-639`):
```ts
function nullIfEmpty(s) { if (s == null) return null; const t = s.trim(); return t.length === 0 ? null : t; }
function parseOptInt(s) { const t = s.trim(); if (t.length === 0) return null; const n = Number(t); return Number.isFinite(n) ? Math.trunc(n) : null; }
```

| フィールド | 値生成 | 空入力時の送出値 | キー脱落? |
|-----------|--------|-----------------|-----------|
| memo | `nullIfEmpty(basic.memo)` | **`null`** | 出る(脱落しない) |
| damage | `parseOptInt(...)` | **`null`** | 出る |
| driveDamage | `parseOptInt(...)` | **`null`** | 出る |
| driveAvailableAtStart | `parseOptInt(...)` | **`null`** | 出る |
| saAvailableAtStart | `parseOptInt(...)` | **`null`** | 出る |
| knockdownAdvantage | `parseOptInt(...)` | **`null`** | 出る |
| situation | `buildSituation(...) ?? ""` | **`""`(空文字)** | 出る(CHANGE-042 センチネル) |
| 起き攻め 6 BOOLEAN | `basic.okiX ?? null` | **`null`**(未設定時)/ `false`(オフ設定時) | 出る |
| tagIds | `basic.tagIds` | 配列(空配列なら `[]`) | 出る |
| isDraft | (builder に無い) | — | **キー自体が出ない**(undefined→omit) |

- situation のコメント(`ComboEditor.tsx:200-202`): 「PATCH では空文字 = クリア指示(backend で NULL 化)。null だと backend で nil=不変更 に潰れ、custom_states を全 off にしても旧値が残るため "" を送る」。
- `buildSituation`(`customStates.ts:104-150`)は custom_states が空かつ他キーも無ければ `undefined` を返し、`?? ""` で `""` に変換される。**定義未ロード(`defs.length === 0`)時は既存 situation をそのまま返す**(`customStates.ts:111-113`、誤クリア防止の防御)。

### 1-c. シリアライズと undefined 脱落

- 送信は `JSON.stringify(req)`(`web/src/features/combo/api.ts:174-178`):
```ts
requestJSON<Combo>(`/api/combos/${id}`, { method: "PATCH", body: JSON.stringify(req) });
```
- `JSON.stringify` は値 `undefined` のキーを脱落させるが、`buildPatchPayload` は空項目に **`null` / `""` を明示代入**しているため **脱落しない**。
- 結果として「キーを送らない(undefined→omit)」が技術的に成立するのは、builder に存在しない `isDraft` / `setupCarryOptions`(未指定時)のみ。**他の全メタデータは `null`/`""` として毎回送られる**。

---

## §2 Q2: `UpdateMetadataRequest` DTO 定義

ファイル: `internal/api/combo/dto.go:77-98`

### 2-a. 全フィールドの型と json タグ

```go
type UpdateMetadataRequest struct {
	Version               int     `json:"version"`
	IsDraft               *bool   `json:"isDraft,omitempty"`
	Damage                *int    `json:"damage,omitempty"`
	DriveAvailableAtStart *int    `json:"driveAvailableAtStart,omitempty"`
	SAAvailableAtStart    *int    `json:"saAvailableAtStart,omitempty"`
	DriveDamage           *int    `json:"driveDamage,omitempty"`
	KnockdownAdvantage    *int    `json:"knockdownAdvantage,omitempty"`
	Memo                  *string `json:"memo,omitempty"`
	Situation             *string `json:"situation,omitempty"` // custom_states 格納先(CHANGE-041)。nil=不変更
	OkiMeatyNeutralTechThrow   *bool    `json:"okiMeatyNeutralTechThrow,omitempty"`
	OkiMeatyNeutralTechThrowDr *bool    `json:"okiMeatyNeutralTechThrowDr,omitempty"`
	OkiMeatyBackTechThrow      *bool    `json:"okiMeatyBackTechThrow,omitempty"`
	OkiMeatyBackTechThrowDr    *bool    `json:"okiMeatyBackTechThrowDr,omitempty"`
	OkiShimmyNeutralTech       *bool    `json:"okiShimmyNeutralTech,omitempty"`
	OkiShimmyBackTech          *bool    `json:"okiShimmyBackTech,omitempty"`
	TagIDs                     *[]int64 `json:"tagIds,omitempty"`
	SetupCarryOptions *SetupCarryOptionsRequest `json:"setupCarryOptions,omitempty"`
}
```

**事実**:
- `Version` のみ **非ポインタ `int`**(`json:"version"`、`omitempty` なし)。
- それ以外は **すべてポインタ型 + `omitempty`**: 数値5項目=`*int`、memo/situation=`*string`、起き攻め6=`*bool`、tagIds=`*[]int64`、isDraft=`*bool`。
- `omitempty` は **レスポンス(marshal)側の挙動**であり、受信(unmarshal)時の「不在/null 区別」には影響しない。

### 2-b. 「キー不在」と「キーあり null」の区別可否

- DTO は全フィールド `*T`。Go の `json.Unmarshal` では **「キー不在」「キーあり値 null」のどちらも `nil`** に落ちる(区別不能)。
- `json.RawMessage` / `map[string]any` / カスタム `UnmarshalJSON` の使用は **0 件**(本 DTO・周辺ハンドラに不在)。
- → **presence-detection(フィールド不在=不変更・null=クリア のトライステート)は、現 DTO のままでは実現できない**。

---

## §3 Q3: service / repository の `UpdateMetadata` 実装

### 3-a. SET 句組み立て(per-field nil チェック)

`internal/repository/combo/repository.go:580-635`:
```go
add := func(col string, val any) { setParts = append(setParts, col+" = ?"); args = append(args, val) }
if input.IsDraft != nil               { add("is_draft", *input.IsDraft) }
if input.Damage != nil                { add("damage", *input.Damage) }
if input.DriveAvailableAtStart != nil { add("drive_available_at_start", *input.DriveAvailableAtStart) }
if input.SAAvailableAtStart != nil    { add("sa_available_at_start", *input.SAAvailableAtStart) }
if input.DriveDamage != nil           { add("drive_damage", *input.DriveDamage) }
if input.KnockdownAdvantage != nil    { add("knockdown_advantage", *input.KnockdownAdvantage) }
if input.Memo != nil                  { add("memo", *input.Memo) }
if input.Situation != nil { if *input.Situation == "" { add("situation", nil) } else { add("situation", *input.Situation) } }
if input.OkiMeatyNeutralTechThrow != nil   { add("oki_meaty_neutral_tech_throw", *input.OkiMeatyNeutralTechThrow) }
// … 起き攻め残り5も同型 …
```
- **全フィールドが `if input.X != nil { add(...) }`** の per-field nil チェック(=部分更新 / nil=不変更)。
- コメント(`repository.go:581`): 「COALESCE は使わず、明示的に指定された列のみ UPDATE」。
- 何も SET が無い場合でも `version = version + 1`, `updated_at = datetime('now')` は常に付与(`repository.go:642`)。`tagIds` は SQL では扱わず service が `ReplaceTagAssociations` に渡す(`repository.go:84-87` コメント)。

### 3-b. situation の `""→NULL` センチネル分岐と他フィールドの有無

- センチネル分岐は **situation のみ**(`repository.go:611-617`):
```go
if input.Situation != nil {
	if *input.Situation == "" {
		add("situation", nil) // 空文字 = クリア指示 → NULL 保存
	} else {
		add("situation", *input.Situation)
	}
}
```
- 他フィールド(memo/数値/起き攻め)に「特定値→NULL/別扱い」のセンチネル分岐は **0 件**。すべて素直に `add(col, *input.X)`。
- 仕様コメント(`repository.go:72-76`): situation は「nil=不変更 / ""(空文字)=NULL クリア指示 / 非空=その値で更新」。

### 3-c. service の Input 型と DTO→Input の受け渡し

- service `UpdateMetadataInput` は **repo 型の type alias**(`internal/service/combo/service.go:80-81`):
```go
// UpdateMetadataInput はリポジトリ層と同型を使い回す。
type UpdateMetadataInput = comborepo.UpdateMetadataInput
```
- DTO→Input 変換 `toServiceUpdateMetadataInput`(`internal/api/combo/dto.go:285-310`)は **ポインタを素通し**(`Situation: req.Situation` など)。`IsDraft` も `req.IsDraft` で渡す。
- service `UpdateMetadata`(`service.go:301-353`)は軽量バリデーション・昇格処理・KA/setup チェック後、`s.repo.UpdateMetadata(ctx, tx, id, version, input)` に **input をそのまま渡す**(`service.go:352`)。nil/値の改変は無い。

---

## §4 Q4: クリア対象 nullable メタデータの全数

### 4-a. `combos` の nullable 列(現行スキーマ)

`migrations/000001_init_schema.up.sql` の `CREATE TABLE combos`、`migrations/000008_drop_gauge_consumed_total.up.sql`(`drive_gauge_consumed_total` / `sa_gauge_consumed_total` を DROP)反映後の現行 nullable 列:

| 列 | 型 | PATCH メタデータ更新対象か | 経路 |
|----|----|--------------------------|------|
| `damage` | INTEGER | ○ | PATCH |
| `drive_available_at_start` | INTEGER | ○ | PATCH |
| `sa_available_at_start` | INTEGER | ○ | PATCH |
| `drive_damage` | INTEGER | ○ | PATCH |
| `knockdown_advantage` | INTEGER | ○ | PATCH |
| `memo` | TEXT | ○ | PATCH |
| `situation` | TEXT(JSON) | ○ | PATCH(センチネル対応済) |
| `oki_meaty_neutral_tech_throw` 他 6 | INTEGER(BOOLEAN) | ○ | PATCH |
| `starter_move_id` | INTEGER | ×(識別キー) | PUT |
| `position` | TEXT | ×(識別キー) | PUT |
| `opponent_stance` | TEXT | ×(識別キー) | PUT |
| `hit_type` | TEXT | ×(識別キー) | PUT |
| `opponent_size` | TEXT | ×(識別キー) | PUT |
| `recipe_cache` | TEXT | ×(キャッシュ・非ユーザ入力) | 内部 |
| `deleted_at` | DATETIME | ×(論理削除) | 内部 |

- 非 nullable(参考): `id` / `character_id` / `is_draft` / `step_count` / `version` / `created_at` / `updated_at`。
- フロントが「空に戻し得る」PATCH メタデータ nullable 列 = **memo / damage / drive_damage / drive_available_at_start / sa_available_at_start / knockdown_advantage / situation / 起き攻め6**。

### 4-b. 各列のクリア可否(現状)

| 列 | 空入力時の送出 | repo 挙動 | 現状クリア可否 |
|----|---------------|----------|---------------|
| memo | `null` | `Memo != nil` 偽 → SET せず | **不能(温存)** |
| damage | `null` | `Damage != nil` 偽 → SET せず | **不能(温存)** |
| drive_damage | `null` | 偽 → SET せず | **不能(温存)** |
| drive_available_at_start | `null` | 偽 → SET せず | **不能(温存)** |
| sa_available_at_start | `null` | 偽 → SET せず | **不能(温存)** |
| knockdown_advantage | `null` | 偽 → SET せず | **不能(温存)** |
| situation | `""` | `Situation != nil` 真 +`==""`→ `add("situation", nil)` | **可(NULL クリア)** |
| 起き攻め6 BOOLEAN | `false`(オフ設定時)/ `null`(未設定時) | `false` 送出時は `!= nil` 真 → `add(col, false)` で **0 に更新** / `null` 送出時は SET せず | **`false`(=0)に設定可。NULL への復帰は不能** |

- 確認: 指示書 §4-b の「起き攻め6が `false`(非 null)送出でクリアできている点」は、**「NULL クリア」ではなく「0(false)への設定」**であることを記録(`basic.okiX ?? null` により、オフ=`false` が非 null 値として送られ、`add(col, false)` で 0 が書かれる)。一度値が入った起き攻めを `null`(未設定)へ戻す UI 経路は本 builder には無い。

---

## §5 Q5: 既存テスト・契約への影響材料

### 5-a. repo テスト(nil=不変更 / situation `""`=NULL を前提)

`internal/repository/combo/repository_test.go`:
- `TestRepository_UpdateMetadata_Situation`(:245-318)— 指示書 §5.1 (16)(17)(18):
  - (16):`Situation: ptrStr(...)` のみ指定 → 再取得で保持(:267-281)。
  - (17):**memo のみの PATCH で既存 situation が消えない**(nil=不変更)を明示検証(:283-297)。
  - (18):`Situation: ptrStr("")` → **NULL クリア**を明示検証(:302-317)。
- `TestRepository_UpdateMetadata_OK`(:198-241)— memo のみ更新し version=2 を確認。他フィールド未指定=不変更の前提に依存(暗黙)。

→ (17) は **nil=不変更**、(18) は **`""`=NULL センチネル** を直接前提とする。方式を full-replace(送られた null=クリア)へ変更し、かつ repo 層の判定基準を変えると **(17)(18) の前提が崩れ得る**(事実の指摘のみ。可否判断はしない)。

### 5-b. フロント `ComboEditor.test.tsx` の PATCH 前提

`web/src/features/combo/components/ComboEditor.test.tsx`:
- (19)(:364-392):custom_states を全 off → **`payload.situation === ""`**(空文字クリア指示)を検証。`"" センチネル` 前提。
- (14)(:325-)/(15)(:344 付近)/(18)(:357-362):situation の round-trip 復元・後方互換(NULL 既存コンボで付与値が空)を検証。
- mock(:56-58):`useCreateCombo` / `useUpdateComboMetadata` / `useUpdateComboWithKeyChange` を差し替え、`mockPatchMutate` で PATCH ペイロードを捕捉。

---

## §6 Q6(補足): full-replace 採用時の「誤クリア」リスク経路

`useUpdateComboMetadata`(PATCH)の全呼び出し元を grep(`web/src`、`.test.` 除外):

1. **`ComboEditor.tsx`**(`buildPatchPayload` 経由、:192-210 / :320-321)
   - 全メタデータを毎回送るが、**`isDraft` を含めない**(builder に無い)。`setupCarryOptions` は条件付き spread。
2. **`PromoteToFinalButton.tsx`**(:39, :48-49)— 仮登録→本登録の昇格:
```ts
patchMut.mutate({ version: combo.version, isDraft: false }, { ... });
```
   - 送るのは **`version` と `isDraft` の 2 キーのみ**。damage/memo/situation/起き攻め/数値/tagIds は **一切送らない**。

**事実**:
- 現方式(nil=不変更)では (2) の部分 PATCH は他フィールドを温存するため整合している。
- 仮に full-replace(=「送られなかったフィールドは NULL/初期値へクリア」)へ倒すと、**(2) PromoteToFinalButton 経由の昇格で damage/memo/situation/起き攻め/数値/tagIds が一括クリアされ得る**。また (1) は `isDraft` を送らないため、full-replace の判定に `isDraft` を含めると **昇格状態が誤って巻き戻り得る**。
- これらは「buildPatchPayload が条件付きで一部フィールドを省略しているか / 別フローで部分 PATCH を投げていないか」への該当事実(判断は記載しない)。

---

## §7 想定外の発見・補足(事実のみ)

- **`isDraft` の取り扱いが PATCH の二系統で非対称**: 通常編集(`buildPatchPayload`)は `isDraft` を送らず、昇格(`PromoteToFinalButton`)は `isDraft` のみ(+version)送る。DTO・repo には `isDraft`(`is_draft`)の受け口・SET 句が存在する(`dto.go:79` / `repository.go:590-592`)。
- **DTO の `omitempty` は受信時の不在/null 区別に無関係**(marshal 専用)。Q2-b の区別不能性は `*T` に起因。
- **situation センチネルは値レベル(`""`)で実装**されており、DTO 構造変更を伴わない。memo/数値へ同じ「特定文字列/数値→NULL」を流用する場合、TEXT 列(memo)は `""` と「未入力」が衝突し得る点が situation と異なる(situation は JSON 文字列のため空文字が正規値にならない)。— 構造差の事実指摘のみ。
- gauge 系キャッシュ列(`drive_gauge_consumed_total` / `sa_gauge_consumed_total`)は 000008 で DROP 済み。現行スキーマには **存在しない**(Q4 列挙から除外済み)。

---

## §8 未確認事項

- なし(Q1〜Q6 の調査項目はすべて実コードで確認済み)。
- 補足: PATCH の HTTP ハンドラ層(`internal/api/combo/handler.go` 等)での追加バリデーション/フィールド改変は本調査スコープ外のため未精査(DTO→service の素通しは `dto.go` で確認済み)。必要なら別途調査。

---

*M11-RESEARCH-02 調査結果レポート。read-only・judgement-free。本レポート作成以外のファイル変更なし。*
