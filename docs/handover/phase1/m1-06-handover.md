# M1-06 引継ぎ書(WSL → devContainer 移行)

| 項目 | 内容 |
|------|------|
| 文書ID | HANDOVER-M1-06 |
| 作成日 | 2026-05-05 |
| 作成者 | M1-06 製造担当 Claude(WSL チャット) |
| 引継ぎ先 | M1-06 機械レビュー以降担当 Claude(devContainer チャット) |
| 対象指示書 | `docs/instructions/M1-06-combo-editor-page.md` v1.1.0(本書作成時点。開発者が v1.3.0 への更新を並行して進める旨アナウンスあり) |
| 対象レビュー | `docs/instructions/reviews/M1-06-review-checklist.md`(機械レビュー必須) |

---

## 1. 引継ぎが発生した経緯

- 本来 devContainer で進めるべきだったところ、誤って WSL ホスト側で開発を進めてしまった
- WSL ホストには Go と pnpm が未インストールだったため、コンパイル/テスト/lint が一切実行できていない状態
- 機械レビュー以降の工程は引継ぎ先(devContainer 側)で受けてもらう

**引継ぎ先のスコープ:**
1. テスト未実行分の確認(Go テスト、フロント vitest、tsc 型チェック)
2. 機械レビューチェックリスト消化(`docs/instructions/reviews/M1-06-review-checklist.md`)
3. レビュー指摘の修正
4. 開発者への完了報告

---

## 2. 実装ステータス サマリ

| Phase | 内容 | 完了状況 |
|-------|------|---------|
| A | バックエンド moves API 追加 | コード作成完了・**未ビルド未テスト** |
| B | zod 導入(package.json 編集) | 編集のみ完了・**`pnpm install` 未実行** |
| C | フロント共通型・API フック・ユーティリティ | コード作成完了・**未テスト** |
| D | フロントコンポーネント実装 | コード作成完了・**未テスト** |
| E | router.tsx / locales 更新 | 完了 |
| F | テスト・動作確認 | **未実施(本引継ぎの主スコープ)** |

---

## 3. 設計上の決定事項(Plan Mode で開発者と合意済み)

| 論点 | 決定内容 | 反映場所 |
|------|---------|---------|
| 技セレクタの moves データ源 | **GET /api/moves エンドポイントを今回追加**(指示書 §2.3 「変更しないもの」の例外) | `internal/api/move/`、`internal/repository/move/` |
| shadcn/ui 導入 | **見送り**(M1-05 並列作業との衝突回避)。標準 HTML + Tailwind で実装 | 各 `*.tsx` |
| zod 導入 | **採用**(`pnpm add zod`)。フォームバリデーションに使用 | `web/src/features/combo/schema.ts` |
| modifiers 編集 UI 粒度 | **追加時のみ flags / 非技 type / notes を選択**。既存ステップ修正は「削除→再追加」 | `web/src/features/combo/components/RecipeBuilder.tsx` |
| タグ入力 UI | **M1-06 では実装しない**。プレースホルダ一行のみ表示 | `ComboEditorBasicFields.tsx` の最下部 fieldset |

開発者が指示書 v1.3.0 を並行で起こし、§2.4 にライブラリ方針を明示する予定(本書作成時点で未着手)。

---

## 4. 未実行コマンド一覧(devContainer で実行してほしい)

### 4.1 依存関係更新

```bash
cd web && pnpm install
# zod を package.json に追記済みのため、pnpm-lock.yaml 更新が必要。
# 開発者ルール: pnpm 9.13 を使用、npm/yarn 不可(CLAUDE.md §11)
```

### 4.2 バックエンドビルド・テスト

```bash
# 新規 moves API パッケージのテスト
go test ./internal/api/move/... ./internal/repository/move/...

# 全体回帰
go test ./...

# debug ビルドタグでも一応確認(M1-07 と同居している場合)
go build -tags=debug ./...
```

### 4.3 フロントテスト・型チェック

```bash
cd web && pnpm test       # vitest(utils.test.ts のみが新規)
cd web && pnpm run lint   # tsc --noEmit (strict + noUnusedLocals + noUnusedParameters)
```

### 4.4 手動 E2E

```bash
# Terminal 1
go run ./cmd/combomgr

# Terminal 2
cd web && pnpm run dev

# ブラウザ操作:
# 1. http://localhost:5173/combos/new を開く
#    - リュウの技セレクタが表示される(<optgroup> でカテゴリ別)
#    - 通常技 / 必殺技 / SA / 投げ / 固有技 / 連携技 / システム / DI / ラッシュ版 が選択肢にある
#    - 「追加」でステップが下のリストに追加される
#    - 状況コード(position/opponent_stance/hit_type/opponent_size)を選び、ダメージ等を入力
#    - 「保存」を押す → 201 + 自動で /combos/:id へ遷移(M1-05 未マージ環境では遷移先 404 で OK、Network タブで 201 を確認)
#
# 2. http://localhost:5173/combos/<上で作った id>/edit で編集
#    - メタデータのみ変更(damage / memo / 起き攻めチェック等) → PATCH 経路
#    - レシピを変更 → 確認ダイアログ「再登録になります」→ PUT 経路
#
# 3. 重複登録の確認: 同じレシピ+状況で再度新規作成 → VAL-C02 で DuplicateWarning モーダル表示
#
# 4. 仮登録: 「仮登録モード」チェック → レシピ空のまま「保存」 → 201
```

---

## 5. 作成・修正ファイル一覧

### 5.1 バックエンド(新規)

```
internal/repository/move/
├── doc.go
├── queries.go        - listByCharacterSQL(preset_aliases LEFT JOIN で name_ja を取得)
└── repository.go     - MoveListItem 構造体、Repository.ListByCharacter

internal/api/move/
├── doc.go
├── dto.go            - MoveResponse / ListResponse
├── handler.go        - List(c) ハンドラ。character_id 必須クエリパラメタ
├── routes.go         - GET /moves
└── handler_test.go   - 200 / 400(欠落)/ 400(不正値)/ 200(unknown character → 空配列)
```

### 5.2 バックエンド(修正)

- `cmd/combomgr/main.go`
  - import 追加: `movehandler "github.com/plexiblinp/combomgr/internal/api/move"`
  - import 追加: `moverepo "github.com/plexiblinp/combomgr/internal/repository/move"`
  - DI 1 行: `moveHandler := movehandler.NewHandler(moverepo.New(sqlDB))`
  - ルート登録 1 行: `movehandler.RegisterRoutes(apiGroup, moveHandler)`

### 5.3 フロントエンド(新規)

```
web/src/features/combo/
├── types.ts          - Combo, Step, Modifiers, ValidationResult, CreateComboRequest 等の型
├── api.ts            - useCombo, useCreateCombo, useUpdateComboMetadata, useUpdateComboWithKeyChange + ApiError クラス
├── utils.ts          - hasKeyChanges, extractKeyFields, ComboKeyFields(SUPP-001 §2.2 のキー比較)
├── utils.test.ts     - hasKeyChanges のテスト 7 ケース(指示書 §5 必須項目を満たす)
├── labels.ts         - 状況コード値ラベル(POSITION/OPPONENT_STANCE/HIT_TYPE/OPPONENT_SIZE)、modifiers flags、起き攻め 6 BOOLEAN 名
├── schema.ts         - zod の comboFormSchemaPublished / comboFormSchemaDraft、parseComboForm
└── components/
    ├── ValidationDisplay.tsx
    ├── DuplicateWarning.tsx
    ├── StepRow.tsx
    ├── RecipeBuilder.tsx
    ├── ComboEditorBasicFields.tsx
    └── ComboEditor.tsx

web/src/features/moves/
├── types.ts          - Move, MoveCategory, MOVE_CATEGORY_LABEL_JA, MOVE_CATEGORY_ORDER
└── api.ts            - useMovesByCharacter フック

web/src/pages/
└── ComboEditorPage.tsx
```

### 5.4 フロントエンド(修正)

- `web/package.json` — `"zod": "^3.23.8"` を dependencies に追加
- `web/src/router.tsx` — `/combos/new`、`/combos/:id/edit` を 2 行追加
- `web/src/locales/ja.json` — `comboEditor.*` キー(titleNew, titleEdit, loading, loadError)
- `web/src/locales/en.json` — 同上の英語版

### 5.5 ドキュメント

- `docs/progress/progress-log.md` — 新規作成(空ファイルだった)。zod 採用理由、shadcn/ui 見送り判断、moves API 新設の選定理由を記録

---

## 6. 推測で決めた事項(指示書 §9 推奨に従い明示)

引継ぎ先で機械レビュー時に確認・必要なら修正をお願いします。

### 6.1 技セレクタの `<optgroup>` カテゴリ表示順

`web/src/features/moves/types.ts` の `MOVE_CATEGORY_ORDER`:
```ts
["normal", "unique", "target_combo", "throw", "special", "super_art", "system", "drive_impact", "rush_variant"]
```
よく使う順を仮置き。設計書に明示なし。

### 6.2 起き攻め 6 BOOLEAN の表示ラベル(日本語)

`web/src/features/combo/labels.ts` の `OKI_FIELDS`:
- `okiMeatyNeutralTechThrow` → 「重ね・中央受け身・投げ」
- `okiMeatyNeutralTechThrowDr` → 「重ね・中央受け身・投げ + DR」
- `okiMeatyBackTechThrow` → 「重ね・後ろ受け身・投げ」
- `okiMeatyBackTechThrowDr` → 「重ね・後ろ受け身・投げ + DR」
- `okiShimmyNeutralTech` → 「シミー・中央受け身」
- `okiShimmyBackTech` → 「シミー・後ろ受け身」

DES-005 / SUPP-001 にラベル文言の明示なし。CHANGE-001 のフィールド名から文意を読み取って訳した。

### 6.3 starter_move_id の自動推定

ユーザーが明示的に選択しない場合、レシピ最初の move_id 持ちステップを送信する(`ComboEditor.tsx` の `effectiveStarterMoveId`)。VAL-C03 警告の予防のため。指示書 §4.2 の「自動推定 + 手動上書き可能」を解釈した実装。

### 6.4 RYU_CHARACTER_ID = 1 のハードコード

`web/src/features/combo/components/ComboEditor.tsx` で固定。`migrations/000003_seed_characters.up.sql` がリュウしか挿入していないため AUTOINCREMENT で id=1 になる前提。M3 のキャラ API 連携時に外す。

### 6.5 modifiers 編集 UI

ステップ追加時のみ flags / 非技 type / notes を一括指定できるシンプル UI。既存ステップは「削除 → 再追加」で修正(指示書 §4.3.4 の最小実装案、Plan Mode で開発者が承認済み)。

### 6.6 重複(VAL-C02)時の重複先 ID

API レスポンスに重複先 ID が含まれない現状(M1-03 の DTO 観察結果)、`DuplicateWarning.tsx` ではメッセージ表示と「閉じる」ボタンのみ提供。指示書 §4.5.1 の「なければシンプルにエラーメッセージ表示でよい」に従った。

---

## 7. 並列実行 M1-05 とのマージ衝突予測

| ファイル | 衝突可能性 | 備考 |
|---------|-----------|------|
| `cmd/combomgr/main.go` | **低** | 追記範囲を import 1 行・DI 1 行・ルート登録 1 行に最小化済み。M1-05 はフロントのみで触らないはず |
| `web/src/features/combo/api.ts` | **中** | M1-06 と M1-05 両方で新規作成する可能性あり。M1-06 では useCombo / useCreateCombo / useUpdateComboMetadata / useUpdateComboWithKeyChange + ApiError を export。M1-05 が `useCombosList` 等を別 export として書いていれば共存可だが、ApiError や fetch wrapper が重複する可能性あり |
| `web/src/features/combo/types.ts` | **中** | 同様。M1-05 が同じ Combo 型を別形式で定義していれば衝突。すり合わせは開発者マージ作業に委ねる |
| `web/src/router.tsx` | **低** | 既存 health ルートには触らず追加 2 行。M1-05 が `/combos`(一覧)、`/combos/:id`(詳細)を追加する想定で同居可 |
| `web/src/locales/{ja,en}.json` | **低** | M1-06 は `comboEditor.*` 名前空間に閉じている。M1-05 は `comboList.*` / `comboDetail.*` 等別名前空間と推測 |
| `web/package.json` / `pnpm-lock.yaml` | **中** | M1-06 で zod 追加。M1-05 で別ライブラリ追加があれば lockfile が衝突。pnpm の挙動次第 |

---

## 8. 注意点・ハマりポイント

### 8.1 backend handler テスト失敗時のヒント

`internal/api/move/handler_test.go` は `dbtest.Setup(t)` で seed 済み DB を使う。期待値:
- リュウ(character_id=1)の moves は **20 件以上**(seed の通常技 18 件 + 必殺技/SA/システム/ラッシュ版)
- 1 件以上に `NameJa` が設定されている(`000006_seed_aliases_official_ja_move.up.sql` 由来)

もし `NameJa` が全件 nil なら:
- `migrations/000005_seed_presets.up.sql` で `official_ja_move` プリセットが投入されているか
- `migrations/000006_seed_aliases_official_ja_move.up.sql` で alias_text が投入されているか
を確認。SQL JOIN 条件は `pa.preset_id = (SELECT id FROM presets WHERE code = 'official_ja_move')`。

### 8.2 frontend 型エラー

tsconfig は `strict + noUnusedLocals + noUnusedParameters`。WSL 環境で `tsc --noEmit` が走らせられなかったため、未検出の lint エラーが残っている可能性あり。

特に注意:
- `ComboEditorBasicFields.tsx` で `value[f.key]` の index access が strict mode で通るか
- `ComboEditor.tsx` の `useMutation` ジェネリクスが TanStack Query v5 と整合するか(v5 で `mutationFn` の型推論が変わっている)

### 8.3 zod スキーマと payload 型の整合

`web/src/features/combo/schema.ts` は **`buildCreatePayload()` の出力(空文字を null に変換済み)を入力に取る前提**で設計してある。schema 内に `nullable().optional()` が散りばめられているのはそのため。生のフォーム state(string 型ばかり)を直接 parse すると失敗する。

### 8.4 ApiError のキャッチ箇所

`useUpdateComboMetadata`、`useUpdateComboWithKeyChange` の onError では `ApiError` インスタンスでない場合(ネットワーク断等)もハンドリング済み。ただし `useCombo` の onError は未実装(`comboQ.isError` チェックのみ)、必要なら追加。

---

## 9. 機械レビュー時に重点的に見てほしい項目

レビューチェックリスト本体は別ファイルだが、本実装で特に self-review 不足の点:

1. **指示書 §7 「Definition of Done」のチェック** — 仮登録レシピ空保存、PATCH/PUT 経路、確認ダイアログ、重複警告、バリデーション表示それぞれを E2E で確認すること
2. **DES-005 v2.6.0 §5.7 入力項目の網羅性** — 起き攻め 6 BOOLEAN(CHANGE-001)、有利フレームの幅 `w-24`(CHANGE-003)、opponent_stance に `any`(CHANGE-003)、hit_type 命名(CHANGE-006)を確認
3. **SUPP-001 §2.2 の重複判定キー 7 つ** — `web/src/features/combo/utils.ts::ComboKeyFields` がこれと完全一致しているか
4. **TanStack Query キャッシュ無効化** — PATCH/PUT 後の `qc.invalidateQueries({ queryKey: ["combo"] })` で詳細・一覧が両方無効化されるか
5. **CLAUDE.md §10 禁止事項の遵守** — `localStorage`/`sessionStorage` 不使用、`console.log` 残置なし、`fmt.Println` 残置なし、Git 操作なし

---

## 10. 完了後の流れ

1. テスト未実行分を全部通す(§4)
2. 機械レビューチェックリスト消化(`docs/instructions/reviews/M1-06-review-checklist.md`)
3. レビュー指摘を修正、再度 §4 のテスト実行
4. 並列実行中の M1-05 / M1-04 / M1-07 と統合テスト(M1 全体完了確認)
5. 開発者に「M1-06 が完了しました」と報告(指示書 §7 最終項目)

---

## 11. 参考: 計画ファイル(approved)

WSL チャットで作成した計画ファイル: `C:\Users\altle\.claude\plans\workspaces-combomgr-combomgr-m1-06-docs-golden-hammock.md`

devContainer 側からは見えない可能性が高いので、本書 §2〜§5 を「実行済みの作業」のソース・オブ・トゥルースとして参照してください。

---

*以上*
