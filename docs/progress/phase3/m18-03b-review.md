# M18-03b レビュー報告書

| 項目 | 内容 |
|------|------|
| 対象 | M18-03b（materialize＝確定反撃のパニッシュカウンター版生成＋採用の引き継ぎ） |
| ブランチ | `claude/m18-03b-design-outline-bjv1ri`（HEAD 5c96db7） |
| 差分範囲 | `aae9ea9`（wt/m18-03a マージ）..HEAD の実装分（`internal/` ＋ `web/src/features/punish` ＋ `web/e2e/m18-03b-*`） |
| レビュー方式 | read-only（コード変更なし）。git 参照系と Read のみ |
| 判定 | 実装は設計準拠。重大問題（§9）は 0 件。**完了報告書が未作成**のため条件付き（§8 参照） |

## 総評

materialize の中核（対象判定・ダメージ加算・コピー範囲・FR301・トランザクション境界）と編集経路の採用引き継ぎ（§4.6）、さらに 2026-07-27 開発者裁定による「基底採用の入力キュー解除」（§5.3-A/§1.1）まで、指示書の要求をほぼ完全に満たしている。凍結していた combo 中核の解放も最小侵襲で、`DuplicateKey`／`CalcRecipeHash`／`RecomputeComboCache` は不変、`CreateRequest` への出自混入なし、CSV 非出力、新マイグレ 0 本、`internal/seedgen`・`Header.tsx`・`ComboEditor`・setplay 資産すべて非改変を確認した。処理順・単一 Tx・FR301 が INSERT より前、NULL 取りこぼしなし、counter 二重計上なし、`combo_setups` 非複製、`model.HitType*` 参照（リテラル非増加）もコードで確認済み。テストも対象判定・縁3・穴2ケース・nil 一致・原子性・引き継ぎ・コピー範囲を網羅している。**唯一の実質的な欠落は完了報告書（`docs/progress/phase3/M18-03b-completion-report.md`）が存在しないこと**で、これにより丸め規則の実測値・PUT 経路機序・E2E 単独実行結果・DES 反映要点が正式記録されていない（DoD §7.6・チェックリスト §8）。丸め規則を整数除算で確定した点は開発者裁定 2026-07-27 に基づくが、その根拠がコードコメントにしか残っていない。

## 設計準拠性レビュー結果

### §1 設計・パターンとの照合

- §1.1 対象判定 … **◎** normal/counter/NULL/未知値が対象、`punish_counter`／`just_parry_punish_counter` は BE で `ErrMaterializeIneligibleHitType`→400＋`hit_type_not_materializable`（service.go 対象判定 switch・materialize_handler.go）。counter はダメージ加算なし（service.go `if baseHit != model.HitTypeCounter` でガード）。テスト `TestMaterialize_IneligibleHitType_Rejected`／`TestMaterialize_Counter_DamageUnchanged`／`TestMaterialize_NullHitType_TreatedAsNormal` で裏取り。
- §1.2 スコープ境界 … **◎** レシピ編集付き materialize は存在せず、`gen := *base` ＋ `base.Steps` 複製のみ。編集導線を足していない（§4.2 準拠）。
- §1.3 ダメージ計算 … **○** 式は `base.damage + starterDamage/5`（整数除算・丸め関数なし）。ただし本来 §3.3-2 は「`damage % 5 <> 0` が 1 件以上なら実装を止めて実測を待つ」。今回は非 0 件（設計側申し送りで投げ/SA/多段の 10 件）だが **開発者裁定 2026-07-27**（該当技は始動技になり得ず整数除算で可）で進行。この裁定の根拠が `service.go`（Materialize step4 のコメント）にしか残らず、**完了報告での該当技全件列挙・後日インゲーム実測依頼が未実施**（下記 §8 参照）。裁定自体は妥当と判断するが記録が不足。縁 3 パターンは生成継続＋理由コード返却で `TestMaterialize_DamageEdges` が検証。
- §1.4 コピー範囲 … **◎** steps/oki/tags を複製し `combo_setups` は非複製、KA・状況系・ゲージ系・drive_damage・memo・メディア 3 列・`is_draft` を `*base` コピーで引き継ぎ、`hit_type` は `model.HitTypePunishCounter`、`materialized_from_combo_id` に基底 id、version/timestamps/deleted_at は初期化。`TestMaterialize_CopyRange` で複製側・非複製側とも検証。子テーブル複製は既存 `InsertSteps`／`ReplaceOkiOptions`／`ReplaceTagAssociations`／`RecomputeComboCache` を再利用（独自実装なし・L-1）。
- §1.5 API とトランザクション … **◎** `POST /api/combos/:id/materialize`（routes.go）、`opponentMoveId` 必須（handler で 0 を 400）。`CreateRequest` に `materializedFromComboId` を足していない（dto.go 確認・grep 0 件）。処理順＝対象判定→FR301→ダメージ→INSERT→子テーブル→combo_punishes で FR301 が INSERT より前。生成経路は単一 Tx（BeginTx→Commit、defer Rollback）。steps はサーバ内複製で往復なし。規則は BE 一元化。
- §1.6 FR301 … **◎** 1 段目は `FindActiveByDuplicateKey`（`hit_type=punish_counter` のみ基底と差、nil は `col IS NULL`）、2 段目は `CalcRecipeHash(base.Steps)` と候補 `RecipeHash` の文字列一致。HTTP 往復なし（`FindActivePublishedDuplicates` を直接再利用）。一致時は生成せず既存 id＋`AlreadyExisted=true`（200・非エラー）。穴 2 ケース（is_draft=1／deleted_at 非 NULL）は `TestMaterialize_FR301_Holes_Generate` で「生成される」を明示。nil 一致は `TestMaterialize_FR301_NilKeyMatch`。
- §1.7 編集経路の引き継ぎ … **○** `UpdateWithKeyChange` に `MovePunishReferences`（combo_punishes／combo_punish_curations の combo_id を旧→新へ UPDATE、opponent_move_id・note 不変）を同一 Tx 内で追加。`SetupCarryOptions`（`UpdateSetupReferences`）と同型。`TestUpdateWithKeyChange_CarriesPunishAndCuration` で移動・note 保存・旧行 0 を検証。**「識別キーが変わらない編集では何も起きない」ケースの明示テストが無い**（構造上 `UpdateWithKeyChange` 以外の経路は `MovePunishReferences` を呼ばないため実害はないが、§5.1 の要求項目としては欠落）。引き継ぎの強制失敗テスト（片方だけ移らないことの証明）も無い（同一 Tx 構造で原子性は担保されるが未カバー）。
- §1.8 FE … **◎** 変換ボタンは第3セクション（PunishList・`section === "unclassified"`）と孫ツリー（PunishTree）の 2 箇所。`PUNISH_COUNTER_HIT_TYPES` で PC 系は非表示。03a の「M18-03b で対応予定です」告知は書き換え済み。成功時 `useInvalidatePunish()`＋`["combos"]`＋`["combo", id]` の 3 系統無効化。加算しなかった理由は `MATERIALIZE_DAMAGE_SKIP_LABELS`（BE コードと 1:1）で表示。生成元バッジは `MATERIALIZED_BADGE_LABEL` 定数（内部値/表示ラベル分離・L-7）。

### §2 データ・API 契約・スキーマの不変

- **◎** 新規マイグレ 0 本（`migrations/` 末尾 000041、追加なし）・既存マイグレ非改変。新テーブル/新列なし。`DuplicateKey`／`CalcRecipeHash`／`RecomputeComboCache` の判定内容不変（`materialized_from_combo_id` 非混入）。`model.Combo` は 1 フィールド追加（→28）。`combos` INSERT は 23 プレースホルダ（22→23）を実測確認。`internal/seedgen` 非改変。CSV export に `materialized_from_combo_id` なし（`internal/service/comboio/` に grep 0 件）。`punishfinder` は `ComboNode.HitType` の出力投影追加のみで走査述語非改変（Scan の struct＋代入のみ）。`ComboEditor` Props・`Header.tsx`・M19-01 setplay 資産すべて aae9ea9..HEAD で非改変を確認。

### §3 テストの妥当性

- **○** §5.1 のほぼ全項目に対応する Go テストが存在（対象判定・ダメージ・counter 不変・縁3・コピー範囲・combo_setups 非複製・FR301 の id 返却/nil 一致/穴2・materialize 原子性 `TestMaterialize_Atomic_RollbackOnPunishFailure`・引き継ぎ・入力キュー解除 `TestMaterialize_DrainsBaseAdoption`/no-op）。handler テスト 5 本（200生成・200既存・400欠落・400非対象・404）。E2E は A/B/C/D を網羅。**欠落**: (1) 「基底自身とは衝突しない」の専用アサーション（`TestMaterialize_FR301_ReturnsExistingID` が暗黙にカバーするが明示なし）、(2) §5.1「識別キー不変の編集で何も起きない」、(3) 引き継ぎ経路の原子性（強制失敗）。いずれも構造上は安全だが検証軸としては未カバー。`divergence_test`（move/repository）は実行未確認だが model.Combo 変更の影響外。

### §4 設計意図との整合

- **◎** silent-drop 回避（縁は生成継続＋理由表示）、到達不能実装なし（endpoint と UI 導線を同一サブで用意）、FR301 の穴を可視化、生成物は独立フォーク（`gen := *base` で切り離し、以降追従なし）、案C・手動 prefill・手動確認レーン登録・curation 登録の前倒しなし。

### §5 出力（E-17）

- **△** materialize コンボは既存 export 経路をそのまま通る設計（新規出力実装なし）で妥当。ただし **DoD §7.4 の開発者実出力目視の記録が完了報告書に無い**（報告書自体が未作成）。チェックリスト §5・§12 のとおり未実施なら条件付き受理。

### §6 コード品質・規約遵守

- **◎** 「ジャストパリィ」略記なし。`hit_type` 4 値リテラルの新規定義なし（`model.HitType*` 参照）。理由コード命名は M19-01 `knockdown_advantage_required` の流儀に沿う（`hit_type_not_materializable`・`base_damage_null` 等）。materialize ロジックは既存 `internal/service/combo/` へ追加（新パッケージ化せず）＝配置判断はコメントに根拠あり。エラー wrap（`%w`）遵守。`console.log`／`fmt.Println` 残置なし。

### §7 既存挙動の温存

- **◎（静的判定）** 既存 combo CRUD・一覧・比較・export・CSV の SQL/DTO は追加列のみで契約不変。M18-01/02/03a の挙動（走査・3 レーン・除外・マイリスト・隠したもの管理・第3セクション振り分け）に破壊的変更なし。実行確認は別途（制約事項参照）。

### §8 ドキュメント

- **×** `docs/progress/phase3/M18-03b-completion-report.md` が**存在しない**。このため以下が正式記録されていない: (a) Plan Mode 実査値（`damage % 5 <> 0` の実測件数と該当技全件列挙・E-16/E-18/E-24）、(b) PUT 経路の子テーブル複製機序の引用、(c) 消費 CHANGE=089・消費マイグレ 0 本の明記、(d) E2E 追加 spec の単独実行結果、(e) DES 反映要点（DES-002 §4.2／DES-003 §3.4／DES-005 §5.13・§5.21／DES-006 FR301・dup 穴の明文化推奨）、(f) 開発者実出力目視の記録。DES 本体の直接編集が無いことは確認済み（◎）。

## 設計準拠性以外の指摘事項

- 丸め規則の裁定根拠が `service.go` の Materialize step4 コメントにのみ存在。開発者裁定（2026-07-27）はプロジェクトの「推測禁止・実測正典」方針上、完了報告に「何を・どの単位で・基準時点」を添えて残すべき。該当 10 件の技名列挙も未実施。
- `RemovePunishLink`／`InsertPunish`／`MovePunishReferences` は combo リポジトリに追加されたが、punish ドメイン（`internal/repository/punish/`）に既に類似操作（`addPunishSQL`／`RemovePunish`）が存在する。コメントで「punish 側と挙動を揃える」と明記されており重複の意図は説明されているが、将来的に punish 側との二重メンテになり得る（低リスク・03c 以降の整理候補）。
- `getMoveDamage` は Tx 外の直接 SQL（`SELECT damage FROM moves`）。moves は参照データで妥当だが、リポジトリ層を経由せずサービスから生 SQL を発行している点は既存の層分離方針とやや不整合（軽微）。
- FR301 既存一致経路の `drainBasePunish` は生成経路とは別の短命 Tx。生成が起きないため他と原子的である必要はなく妥当だが、materialize 内に「単一 Tx」と「別 Tx（drain）」の 2 経路が併存する点はコメントで補足済み。

## 推奨修正（優先度別）

- **高（M18 完了前に修正必須）**:
  - `docs/progress/phase3/M18-03b-completion-report.md` を作成し、丸め規則の実測件数・該当技全件・開発者裁定 2026-07-27・PUT 機序引用・消費 CHANGE089/マイグレ0・E2E 単独実行結果・DES 反映要点・実出力目視結果を記載（DoD §7.6・チェックリスト §8/§12）。**これが無いと完了は条件付き受理どまり**。
- **中（M19 着手と並行可）**:
  - 「識別キー不変の編集では引き継ぎが起きない」ことの明示テストを追加（§5.1・§1.7 の未カバー項目）。
  - 引き継ぎ経路（`MovePunishReferences`）の原子性テスト（強制失敗で片方だけ移らない）を追加。
- **低（将来対応）**:
  - 「基底自身は FR301 で衝突しない」ことの明示アサーション追加。
  - combo リポジトリと punish リポジトリの punish 操作の重複整理（03c で curation 導線再設計時に併せて検討）。

## 良かった点

- 2026-07-27 の入力キュー解除裁定（§5.3-A/§1.1）を生成経路は同一 Tx 内 `RemovePunishLink`、FR301 既存経路は `drainBasePunish` で冪等に実装し、両経路とも `TestMaterialize_DrainsBaseAdoption`／`TestMaterialize_Drain_NoOpWhenBaseNotAdopted` でカバー。
- FR301 の「穴」（is_draft=1／deleted_at 非 NULL）を隠さずテストで「生成される（既存仕様）」と明示（M17-E19 対策の実践）。
- `steps` をサーバ内複製し `recipe_hash` の構造的一致を保証、`CreateRequest` に出自を足さないことで詐称経路を封じた設計判断が指示書の意図どおり。
- BE 理由コードと FE `MATERIALIZE_DAMAGE_SKIP_LABELS` の 1:1 同期をコメントで明記し、内部値/表示ラベルを分離（L-7）。

## 制約事項

- 本レビューはコード上で判定可能な範囲のみ対象。実際の動作確認・`go test ./...`／`pnpm test`／`make e2e` の実行結果・`divergence_test` の green・パフォーマンス・E-17 実出力目視は別途（本レビューでは未実行）。
- 完了報告書が未作成のため、Plan Mode 実査の実測値（`damage % 5` 件数・該当技）は本レビューでは検証できず「未記録」として扱った。

---

## 取り込み結果（自動トリアージ）

`/implement_plan_full` Phase C。採否と理由を以下に記録（事後監査用）。**「高」指摘は全件採用したためエスカレーション無し。**

| 指摘（優先度） | 採否 | 理由・対応 |
|---|---|---|
| **高**: 完了報告書 `M18-03b-completion-report.md` 未作成 | **採用** | 作成した（`docs/progress/phase3/M18-03b-completion-report.md`）。丸め規則の実測 10 件全件・開発者裁定 2026-07-27・PUT 機序引用・消費 CHANGE089/マイグレ0・E2E 単独実行 4/4・DES 反映要点・基底採用解除の裁定・E-17 未実施(条件付き受理)を記録。 |
| **中**: 「識別キー不変の編集で引き継ぎが起きない」明示テスト欠落 | **採用** | `TestUpdateMetadata_DoesNotMovePunish` を追加（PATCH で id 不変・採用が同一コンボに残る）。 |
| **中**: 引き継ぎ経路の原子性（強制失敗）テスト欠落 | **採用** | `TestUpdateWithKeyChange_PunishCarryIsAtomic` を追加（不正タグ id で tx 後半を失敗→ロールバック→旧コンボ有効・採用は旧に残る）。 |
| **低**: 「基底自身は FR301 で衝突しない」明示アサーション | **採用** | `TestMaterialize_FR301_BaseDoesNotCollide` を追加（初回 materialize が生成扱い・生成 id≠基底 id）。 |
| **低/軽微**: 丸め裁定根拠がコードコメントのみ | **採用** | 完了報告 §1-2 に「何を・どの単位で・基準時点」＋該当 10 技＋後日インゲーム実測依頼を記録。 |
| **低**: combo リポジトリと punish リポジトリの punish 操作の重複整理 | **不採用** | **03c へ持ち越し**。本レビュー自身が「03c で curation 導線再設計時に併せて検討」と記載。punish ドメインへ手を入れるのは本サブのスコープ外（案C・curation 登録は 03c）。挙動を揃える意図はコメントで明記済みで低リスク。 |
| **軽微**: `getMoveDamage` がリポジトリ層を経由せずサービスから生 SQL | **不採用** | 本レビューが「軽微」と評価。`moves` は materialize では不変の参照データで、tx 外の単純読取として妥当。リポジトリメソッド新設は限界効用が小さく、既存の層分離への影響も無い。将来 moves 参照が増えた際に整理候補。 |

追加テストは `go test ./internal/service/combo/` green を確認済み。取り込み後の全 Go テスト・FE テストの再確認結果は完了報告 §4 を参照。
