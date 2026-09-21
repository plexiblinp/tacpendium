# M11-02 レビュー報告書

| 項目 | 内容 |
|------|------|
| 対象 | M11-02(nullable メタデータの PATCH クリア一般化 = presence-detection トライステート) |
| レビュー対象コミット | `60ca08f`(BE) / `a19a743`(FE) |
| レビュー日 | 2026-06-21 |
| レビュー担当 | 品質レビュー担当 Claude(read-only) |
| 関連 | CHANGE-043 / DES-002 v1.23.0 §4.2 / M11-RESEARCH-02 / チェックリスト v1.0.0 |

## 総評

設計意図(presence-detection 単一トライステート)を過不足なく、かつ Go の落とし穴(typed-nil)を正しく踏まえて実装できている良質な実装。`Optional[T]` ジェネリック型を新設し、`UnmarshalJSON` で presence を検出、`Arg()` で untyped nil を返すことで「キー不在 / null / 値」の3状態が DTO→Input→repo SET まで一貫して伝播している。最重点の **部分 PATCH 安全(昇格でメタデータ温存)** も repo テスト (7)・handler テストで明示検証されており、誤クリアの恐れはない。situation の `""` センチネルは完全に撤去され単一規約へ統一済み。`go build` / 対象 Go テスト / web 単体(ComboEditor 18件)/ tsc すべて green を確認した。**高優先度の指摘は 0 件**。指摘は軽微・低優先のみ。

## 設計準拠性レビュー結果

### §1 クリア規約の実装(最重要)

- **§1.1 presence-detection トライステート ◎**
  - DTO `UpdateMetadataRequest` の nullable メタデータは全て `comborepo.Optional[T]`(`dto.go:84-98`)。`Optional.UnmarshalJSON`(`optional.go:22-34`)がキー存在時のみ呼ばれ `Present=true` を立てるため、`*T`+`omitempty` では不可能だった3状態判別が成立している。
  - repo `UpdateMetadata`(`repository.go:596-624`)は `if o.Present { add(col, o.Arg()) }` で「present のみ SET / present+null=`Arg()`が nil / present+値=値」を実現。指示書 §4.1 表に一致。
  - `UpdateMetadataInput`(`repository.go:68-93`)が `Optional[T]` で3状態を表現し、`toServiceUpdateMetadataInput`(`dto.go:289-307`)が同一型で素通し伝播。service の `UpdateMetadataInput` は repo 型 alias(`service.go:81`)のままで素通し維持。
  - 対象網羅: memo / damage / drive_damage / drive_available_at_start / sa_available_at_start / knockdown_advantage / situation / 起き攻め6 をすべて網羅。

- **§1.2 situation の統一 ◎**
  - repo の `""→nil` センチネル分岐は完全撤去。`if input.Situation.Present { add("situation", input.Situation.Arg()) }`(`repository.go:611-613`)へ統一。二規約混在なし。
  - FE `buildPatchPayload` の situation は `?? ""` → **`?? null`** へ移行済み(`ComboEditor.tsx:202`)。
  - `buildSituation` の defs 未ロードガード(`customStates.ts:111-113`)との両立も成立。defs 未ロード時は既存 situation を返す(値あり=温存)か、既存なしなら `undefined` → `?? null` で `null` 送信となるが、既存も NULL のため誤クリアは発生しない。
  - コメントも `null` 移行へ整合(`ComboEditor.tsx:200-201`)。

- **§1.3 部分 PATCH 経路の安全(最重点)◎**
  - `PromoteToFinalButton`(`{version, isDraft}` 2キー)は他 Optional キーが不在=`Present=false`=SET されず温存。repo テスト (7)(`repository_test.go:376-393`)で situation 温存を明示検証。
  - `buildPatchPayload` は `isDraft` を送らず、`IsDraft *bool` が nil=不変更で温存(`repository.go:593-595`)。非対称も正しく機能。
  - is_draft は `*bool` のままで null クリア対象外。問題なし。

### §2 API・スキーマ整合性 ◎
- POST/PUT(`CreateRequest` / `toServiceCreateInput`)は `*T`+`omitempty` のまま不変。presence-detection は PATCH のみに限定。スキーマ変更なし。
- `is_draft` は null クリア対象外(`*bool`、不在=不変更 / 値=更新)。
- tagIds は `*[]int64` のまま、service の `ReplaceTagAssociations` 経路を維持(`service.go:357-358`)。SET 対象外。
- DES-002 v1.23.0 §4.2 のトライステート(不在=不変更 / null=クリア / 値=更新)と実装一致。

### §3 既知の挙動変更の確認 ◎
- 起き攻め6は `addOptBool` 経由で present+null=NULL クリア可能になっている(`repository.go:614-624`)。repo テスト (6) で検証。round-trip は不変。
- situation のクリアが `null` 経由(`""` 不使用)へ変更。成果 NULL は不変。

### §4 テストの妥当性 ◎
- BE repo: `TestRepository_UpdateMetadata_Tristate`(`repository_test.go:322-394`)で present+null クリア(memo/damage/起き攻め)、不在=不変更(situation 温存)、部分 PATCH 温存(昇格相当 (7))を網羅。(16)(17)(18) は新規約(`Some`/`Null[T]()`)へ更新済み。
- BE handler: `dto.go` の `c.Bind` が `Optional.UnmarshalJSON` を呼ぶ前提を、`{"version":1,"memo":"hello","damage":null}`(situation 不在)の捕捉テスト(`handler_test.go:561-589`)で実証。presence/null/不在の3状態を JSON Bind レベルで確認できており、設計の要(Echo の json.Decoder で presence 検出)が担保されている。
- FE: (19)(`ComboEditor.test.tsx:364-392`)が `payload.situation === null`(旧 `=== ""` を更新)を検証。
- E2E(A〜E、特に D=昇格で温存)は手動実機ゲート(指示書 §7)。本レビューでは未実施(制約事項参照)。

### §5 設計意図との整合 ◎
full-replace ではなく presence-detection で、送られないフィールドが誤クリアされない設計。situation 特例消滅、スキーマ・POST/PUT 非変更で PATCH クリア規約のみの変更に収まっている。

### §6 コード品質・規約 ◎
- presence 検出は `Optional[T]` ジェネリック1型で簡潔。過剰な抽象化なし。`Some`/`Null[T]()` ヘルパも可読性向上に寄与しテストで活用。
- **typed-nil 罠の回避が正しい**: `Arg()`(`optional.go:39-44`)が `Value==nil` で untyped nil を返し、`*T(nil)` のまま渡す罠を回避。コメントにも明記。SQL NULL バインドが成立。
- camelCase(JSON)・命名規約踏襲。

### §7 既存挙動の温存(非破壊性) ◎
- POST/PUT 登録・識別キー編集の誘導は不変。
- M11-01(custom_states 付与/表示・round-trip)非回帰。`buildSituation` ガード両立。
- 対象 Go テスト・web 単体テスト green。

### §8 ドキュメント ◎(製造担当範囲)
- DES-002 §4.2(CHANGE-043)は設計担当が反映済み(v1.23.0)。製造担当は DES を直接編集していない。
- 完了報告(Plan Mode §3.4 7項目・テストケース数)はレビュー担当の確認範囲外だが、テスト内容から実装は仕様を満たす。

## 設計準拠性以外の指摘事項

1. **[軽微] `repository.go:626-628` のデッドコードブロック**
   ```go
   if len(setParts) == 0 {
       // 何も更新がない場合は version だけインクリメント
   }
   ```
   空ボディの `if` ブロックでコメントのみ。実際の version インクリメントは直後(`:631`)で常時行われるため、この `if` は無動作。可読性のため削除推奨(コメントを `:630` 付近の通常コメントへ移すか単に削除)。lint(`staticcheck` の SA9003 相当)が有効なら検出され得る。本実装で新規追加ではなく既存からの残存だが、本コミットで周辺を改修しているため指摘に含める。

2. **[低] `.gitignore` に本サブと無関係な変更が混入**
   コミット `60ca08f` に `autopilot-combomgr/` の追加(`.gitignore`)が含まれる。M11-02 のスコープ(BE/FE presence 化)とは無関係で、本来は別コミットが望ましい。機能影響はなし。スコープ厳守の観点で記録。

3. **[低] DTO コメントの `dto.go:80` の CHANGE 参照**
   `UpdateMetadataRequest` のコメントに「CHANGE-008: driveAvailableAtStart ...」が残るが、新規約のコメント(`:74-79`)と並存しており実害なし。情報過多気味だが履歴として許容範囲。

## 推奨修正(優先度別)

- **高(M11完了前に修正必須):** なし
- **中(M12着手と並行可):**
  - 指摘1: `repository.go:626-628` の空 `if` ブロック削除(可読性 / lint 対策)。
- **低(将来対応):**
  - 指摘2: `.gitignore` の無関係変更は次回以降コミット粒度に注意。
  - 指摘3: DTO 旧コメントの整理(任意)。

## 良かった点(Claude Code へのフィードバック)

- **typed-nil 罠を正しく設計で封じた**: `Optional.Arg()` を untyped nil 返却の単一窓口にし、コメントで罠を明示。チェックリスト §6・§9 の最大の懸念点を構造的に回避できている。
- **presence の実証テストが秀逸**: handler テストで生 JSON(`damage:null`・situation 不在)を `c.Bind` させ Input の `.Present`/`.Value` を捕捉検証。「Echo の Bind が UnmarshalJSON を呼ぶ」という設計前提を机上でなくテストで担保した点が高評価。
- **最重点の部分 PATCH 安全を専用テストで証明**: repo テスト (7) で昇格相当(IsDraft のみ present)→ situation 温存を明示。誤クリアの非発生を可読に示している。
- **FE 変更を situation の `?? null` 1点に最小化**し、他フィールドは既存挙動(空→null 送信)を活かしてスコープを絞れている。`Some`/`Null[T]()` ヘルパ導入もテスト可読性に貢献。

## 制約事項

- 本レビューはコード上で判定可能な範囲のみ対象。実際の動作確認・パフォーマンス・実機 E2E テスト(指示書 §5.2 A〜E、特に D=昇格で温存)は別途実施が必要。
- 完了報告(Plan Mode §3.4 7項目の実 view 確認結果・テストケース数)はレビュー担当の手元にないため、その記載有無は未確認。前提ゲート(CHANGE-043 反映)は DES-002 v1.23.0 への反映を確認済み。

---

## 取り込み結果(自動トリアージ)

実施者: 製造担当 Claude(implement_plan_full Phase C)。実施日: 2026-06-21。
高優先度の指摘は 0 件のためエスカレーション不要(「高」指摘の不採用時のみ開発者確認が必要)。

| 指摘 | 優先度 | 採否 | 理由 |
|------|--------|------|------|
| 指摘1: `repository.go:626-628` 空 `if` ブロック(デッドコード)削除 | 中 | **採用** | 製造で全面改修した `UpdateMetadata` 関数内の残存デッドコード。空 `if` を削除し、version/updated_at を常時更新する旨を通常コメントへ移設。staticcheck SA9003 相当の回避と可読性向上。修正後 `go build` / 対象 Go テスト green を再確認。 |
| 指摘2: コミット `60ca08f` の `.gitignore` 無関係変更 | 低 | **不採用(対応不可)** | `autopilot-combomgr/` 追加は `git add -A` が既存の未コミット変更を巻き込んだもの。コミット履歴の修正(reset/amend)は CLAUDE.md §7/§10 で開発者専任のため製造担当は実行不可。完了報告で開発者へ明示。以後は明示パス指定で add する運用とする。 |
| 指摘3: DTO `dto.go:80` の CHANGE-008 旧コメント整理 | 低 | **不採用** | レビューも「履歴として許容範囲・任意」と評価。CHANGE-008 はフィールド追加履歴のポインタとして有用で、新規約コメントと並存して実害なし。スコープ厳守の観点から本サブでは変更しない。 |
