# M3-03 レビュー報告書

## 総評

M3-03 全体の実装品質は高く、browser-storage.ts の堅牢性・SQL injection 対策・localStorage 使用範囲の制限などは正確に実装されている。バックエンド3層のフィルタ・ソート動作は機能的に妥当であり、Go / TypeScript いずれもビルドエラー・型エラーなし、全テストが通過している。

一方で、指示書 §4.3.1 で必須とされたキャラクター選択プルダウンが `ComboListFilters.tsx` に存在せず、フック単体テスト2件が欠落し、サービス層テストにも複数の欠落がある。`resolveSortClause` の未知フィールドフォールバックも指示書仕様と異なる。これら4点は本マイルストーン完了前に修正が必要と判断する。

---

## 設計準拠性レビュー結果

### §4.1 browser-storage.ts — ◎

- `StorageHelper<T>` インターフェース・`createLocalStorageHelper<T>` のシグネチャが指示書と完全一致
- `save` / `load` / `remove` いずれも try-catch で囲まれ、容量超過・プライベートブラウジングでアプリが落ちない
- JSON シリアライズ / デシリアライズが正確に実装されている
- SSR 対応コードなし（仕様通り）
- **指摘△**: 指示書 §4.1.2 / チェックリスト §1.1 で「キー名に `-v1` suffix が必須であることをコメントで明示」と指定されているが、`createLocalStorageHelper` 関数のコメントにその旨の記載がない

### §4.1.4 browser-storage.test.ts — ◎

save/load 往復・未保存null・不正JSON・QuotaExceededError・remove後null・複数キー独立性を全カバー。テスト全通過。

### §4.2 バックエンドクエリパラメータ拡張 — ○

- `character_id` / `tag_ids` / `position` / `hit_type` / `opponent_stance` / `is_draft` / `sort` / `order` の8種受け取り実装済み
- `only_deleted` は温存（M2-03 回帰なし）
- `tag_ids` の不正値で `400 + INVALID_QUERY_PARAM` が正確に返る
- `INVALID_QUERY_PARAM` の発火が List ハンドラのみに限定されていることを `grep` で確認
- **指摘△(中)**: `is_draft` のパースが `strconv.ParseBool` でなく `switch v { case "true","1":...}` で実装されている。指示書 §4.2.5 に「`strconv.ParseBool` を使用」と明記されており仕様逸脱。`"1"/"0"` も受け付ける副作用があるが機能的影響は軽微

### §4.2.2 ListFilter / ListSort 構造体 — △

- `ListFilter` に7フィールドが正確に定義されている（CharacterID / TagIDs / Position / HitType / OpponentStance / IsDraft / OnlyDeleted）
- **指摘△(中)**: 指示書 §4.2.2 では `type ListSort struct { Field string; Order string }` として独立した構造体を定義するよう指示されていたが、実装では `Sort string` と `Order string` が `ListFilter` に統合されている。機能的には同等だが設計書との乖離

### §4.2.3 / §4.2.4 SQL動的生成とホワイトリスト — △

- WHERE 句動的生成が正確（7種 AND 句、nil/空でない場合のみ追加）
- `tag_ids` OR条件が `AND id IN (SELECT combo_id FROM combo_tags WHERE tag_id IN (?,?,?))` で実装されている
- フィルタ値は全てプレースホルダ経由（SQL injection 対策完備）
- ホワイトリスト6種（default / updated_at / damage / starter_move_id / drive_gauge_consumed_total / sa_gauge_consumed_total）が実装されている
- `drive_gauge_consumed_total` / `sa_gauge_consumed_total` のカラム名が DES-003 §3.4 と一致
- **指摘×(重大)**: 指示書 §4.2.4 の「ホワイトリスト外の値は `default` にフォールバック」に反し、実装は `"updated_at DESC"` にフォールバックしている（`resolveSortClause` の `!ok` 分岐）。`default` ソート（始動状況複合ソート）が期待されるのに異なるソートが適用される
- **指摘△(軽)**: ホワイトリストに指示書外の `"step_count"` が追加されている

### §4.3.1 ComboListFilters コンポーネント — ×（重大欠落）

- 仮登録フィルタ / position / hit_type / opponent_stance プルダウン / タグフィルタ / ソート種別選択 / 昇降ラベル / `<ColumnVisibilityMenu>` 組み込み → **実装済み**
- **指摘×(重大)**: **キャラクター選択プルダウンが実装されていない**。指示書 §4.3.1「キャラクター選択プルダウン(リュウ固定 + 将来の拡張余地)」が必須要素として列挙されているが `ComboListFilters.tsx` に存在しない。`ComboListPage.tsx` では `characterId: filters.characterId ?? INITIAL_CHARACTER_ID` として常にリュウ(ID=1)に固定されており、ユーザーがキャラクターを切り替える手段がない。DES-005 §5.4 のフィルタ要件を部分的に満たしていない
- shadcn/ui 未使用（標準HTML + Tailwind、playbook §4.6 遵守）
- レスポンシブ対応（`flex-col md:flex-row`）実装済み
- Props 名が指示書仕様（`onChange`）でなく `onFilterChange` / `onVisibilityChange` / `onVisibilityReset` になっているが機能的に問題なし

### §4.3.2 useComboListFilters フック — ◎

- `useSearchParams` で URL クエリパラメータ連動
- `useMemo` / `useCallback` で性能考慮
- 既定値（sort=default、order=desc）はクエリに含まれない（URL を短く保つ設計通り）
- `parseIntOrNull` / `parseTagIds` / `parseBoolOrNull` / `isValidSortField` のヘルパが適切に実装されている

### §4.3.3 状況コード値マスタ — ◎

- バックエンド `internal/model/combo.go`: Position 5値 / HitType 3値 / OpponentStance 4値の定数定義済み
- フロント `web/src/constants/combo-list.ts`: 対応する TypeScript 定数 `POSITION_VALUES` / `HIT_TYPE_VALUES` / `OPPONENT_STANCE_VALUES` が定義済み
- バックエンド/フロント両側で値が完全一致（指示書の `any/center/corner` とは異なるが、着手前確認 §3.4.3 で開発者確認済みと progress-log に記録）
- **指摘△(中)**: `POSITION_LABELS` / `OPPONENT_STANCE_LABELS` / `HIT_TYPE_LABELS` が指示書 §4.3.3 で指定された `web/src/constants/combo-list.ts` でなく `web/src/features/combo/utils.ts` に定義されている。M3-04 / M5 での再利用時に `features/combo/` 内部への依存が生まれる。`combo-list.ts` にも同名の定数を定義するか移動することが望ましい

### §4.3.4 昇降ラベル — ◎

`SORT_FIELD_LABELS` が指示書 §4.3.4 の対応表と完全一致。`ComboListFilters.tsx` で動的取得されリテラル文字列の散在なし。

### §4.4.1 ColumnVisibilityMenu — ◎

- Props 設計（visibility / onChange / onReset）が指示書と一致
- 外側クリック検知が `DuplicateRealtimeWarning.tsx` と同パターン（`useRef` + `useEffect` + `document.addEventListener("mousedown")`）で実装
- shadcn/ui 未使用
- リセットボタン実装済み

### §4.4.2 useColumnVisibility フック — ◎

- キー名 `combo-list-columns-v1` で固定
- `createLocalStorageHelper<ColumnVisibility>` 経由（直接 localStorage 呼び出しなし）
- `DEFAULT_COLUMN_VISIBILITY` 6列全 true
- 互換性マージ `{ ...DEFAULT_COLUMN_VISIBILITY, ...loaded }` が正確に実装されている
- `updateVisibility` / `resetVisibility` の両関数で状態更新とストレージ操作が同期している

### §4.4.3 ComboTableRow への visibility 反映 — ◎

- 各 `<td>` が `{visibility.xxx && ...}` で条件付き描画
- `<thead>` の `<th>` も同様に制御されている（列整合確認済み）

### §2.2 ComboList 統合 — ◎

- `ComboListPage.tsx` に `useComboListFilters` / `useColumnVisibility` / `ComboListFilters` / `ComboTable` が統合されている
- queryKey に `["combos", filter]` としてフィルタ条件が含まれている
- `useTagsForSelector({ excludeCategories: ["mycombo_status"] })` の呼び出しが正確

---

## 設計準拠性以外の指摘事項

### localStorage 使用範囲 — ◎

`grep -rn 'localStorage' web/src/` の結果、`browser-storage.ts` 内のみ。各機能からの直接アクセスなし。キー `combo-list-columns-v1` のみ使用。CLAUDE.md §10.X 許容範囲内。

### SQL injection 対策 — ◎

フィルタ値は全てプレースホルダ `?` 経由、ソートはホワイトリスト経由のみ SQL に埋め込まれている。`fmt.Sprintf` や文字列結合でのユーザー入力の直接埋め込みなし。

### console.log / fmt.Println — ◎

本番コードへの残留なし。`browser-storage.ts` の `console.warn` は意図的な実装で許容済み。

---

## 推奨修正（優先度別）

### 高（M3 完了前に修正必須）

1. **キャラクター選択プルダウンの実装**
   - 対象ファイル: `web/src/features/combo/components/ComboListFilters.tsx`
   - 内容: `ComboListFilters.tsx` に `<select>` でキャラクター選択 UI を追加する。指示書 §4.3.1 の記述に従い、M3-03 段階では「リュウ固定」で可（`INITIAL_CHARACTER_ID` を defaultValue とする select で実装し、M3-04 で `useCharacters` フック化）。`filters.characterId` を `onFilterChange` 経由で更新する形にする
   - 根拠: 指示書 §4.3.1、DES-005 §5.4

2. **`useComboListFilters.test.ts` の作成**
   - 対象ファイル: `web/src/features/combo/hooks/useComboListFilters.test.ts`（新規）
   - 内容: 指示書 §5.1.4 の必須テスト4件を実装（URL クエリパラメータからの復元、updateFilters で URL 更新、既定値はクエリに含まれない、複数フィルタの組合せ復元）
   - 根拠: チェックリスト §5.3

3. **`useColumnVisibility.test.ts` の作成**
   - 対象ファイル: `web/src/features/combo/hooks/useColumnVisibility.test.ts`（新規）
   - 内容: 指示書 §5.1.4 の必須テスト4件を実装（初期 mount 時の localStorage からの復元、updateVisibility で保存、resetVisibility で削除、古い構造の保存値が既定値とマージされる）
   - 根拠: チェックリスト §5.3

4. **サービス層テストの追加**
   - 対象ファイル: `internal/service/combo/service_test.go`
   - 内容: 以下の5テストケースを追加
     - `TestService_List_FilterByTagIDs`（tag_ids OR条件: 複数タグのいずれかを持つコンボのみ返る）
     - `TestService_List_FilterByOpponentStance`
     - `TestService_List_CombinedFilters`（character_id + position + is_draft の複合 AND 動作）
     - `TestService_List_SortByDamage_Asc`（order=asc での昇順ソート）
     - `TestService_List_OnlyDeleted`（M2-03 回帰: `only_deleted=true` で削除済みのみ返る）
   - 根拠: 指示書 §5.1.2、チェックリスト §5.2.1

5. **`resolveSortClause` の未知フィールドフォールバック修正**
   - 対象ファイル: `internal/repository/combo/repository.go:374`
   - 内容: `!ok` 時の `return "updated_at DESC"` を `return sortFieldWhitelist["default"]` に変更する
   - 根拠: 指示書 §4.2.4「ホワイトリスト外の値は `default` にフォールバック」、チェックリスト §1.10

### 中（M4 着手と並行可）

1. **`POSITION_LABELS` 等を `constants/combo-list.ts` に移動または再エクスポート**
   - 対象: `web/src/features/combo/utils.ts` → `web/src/constants/combo-list.ts`
   - 内容: `POSITION_LABELS` / `OPPONENT_STANCE_LABELS` / `HIT_TYPE_LABELS` を `combo-list.ts` にも定義（または `utils.ts` からの re-export）し、M3-04 / M5 での定数場所の統一を図る
   - 根拠: 指示書 §4.3.3、CLAUDE.md §4 列挙定数同期ルール

2. **`browser-storage.ts` へのキーバージョニングコメント追加**
   - 対象: `web/src/lib/browser-storage.ts:7`
   - 内容: `createLocalStorageHelper` の JSDoc コメントに「キー名は必ず `-v1` 等のバージョン suffix を付与すること」の旨を追記
   - 根拠: チェックリスト §1.1

3. **`is_draft` のパース方式を `strconv.ParseBool` に統一**
   - 対象: `internal/api/combo/handler.go`
   - 内容: `switch v { case "true","1": ...}` を `strconv.ParseBool` に変更する
   - 根拠: 指示書 §4.2.5

### 低（将来対応）

1. **`step_count` ソートの取り扱い確認**: `sortFieldWhitelist` に指示書外の `"step_count"` が追加されている。将来的にフロント側定数との同期が必要になるため、意図的な追加であれば `combo-list.ts` の `SORT_FIELD_VALUES` にも追加するか、削除するかを開発者と協議する

---

## 良かった点

- **browser-storage.ts の品質**: try-catch、JSON シリアライズ、容量超過対応が指示書仕様通りに実装されており、M6 / M7 での再利用が可能な汎用設計になっている
- **useColumnVisibility の互換性マージ**: `{ ...DEFAULT_COLUMN_VISIBILITY, ...loaded }` が正確に実装されており、将来カラム追加時も既定値で埋まる設計になっている
- **SQL injection 対策の徹底**: フィルタ値は全てプレースホルダ、ソートはホワイトリスト経由のみという2層防御が正確に実装されている
- **localStorage の直接アクセス禁止の遵守**: `browser-storage.ts` 以外でのアクセスが完全にゼロであることを `grep` で確認
- **`ColumnVisibilityMenu` の外側クリック検知パターン**: M2-02 の実装パターンが正確に再利用されており、新規依存が追加されていない
- **状況コード値定数のバックエンド/フロント同期**: `internal/model/combo.go` と `web/src/constants/combo-list.ts` の値が完全一致しており、表記揺れがない
- **playbook §4.6 遵守**: shadcn/ui が1箇所も使われておらず、標準 HTML + Tailwind の一貫した実装になっている
- **`INVALID_QUERY_PARAM` のスコープ管理**: List ハンドラのみに限定されており、playbook §4.7 に従った全ハンドラ列挙が正確に行われている

---

## レビュー結果サマリ

- 重大な問題: **5件**
- 軽微な問題: 3件
- 質問・確認事項: 0件

## レビュー判定

- [ ] 重大な問題なし → 承認
- [x] **重大な問題あり → 製造担当に修正依頼**

---

## 制約事項

- 本レビューはコード上で判定可能な範囲のみ対象。実際の動作確認・パフォーマンス・実機テストは別途実施が必要。
- E2E シナリオ A〜F の実機確認は開発者の責任範囲であり、本レビューでは対象外。
- progress-log.md に「指示書との乖離(開発者確認済み)」として記録された Position 値 / OpponentStance 値の変更（`any/center/corner` → `mid_screen/corner_self` 等）はバックエンドとフロントの一致が確認されているため指摘対象外とした。
