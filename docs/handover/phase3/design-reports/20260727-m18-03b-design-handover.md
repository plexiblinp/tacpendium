# M18-03b 設計伝達レポート(materialize＝確定反撃のパニッシュカウンター版生成 ＋ 採用の引き継ぎ)

| 項目 | 内容 |
|------|------|
| 対象 | Web 版設計担当 Claude |
| 発信 | 製造担当 Claude Code / 2026-07-27 |
| 指示書 | `docs/instructions/phase3/M18-03b-materialize.md` **v1.0.1**（`/implement_plan_full` の引数は骨子 `M18-03b-design-outline.md` だったが、開発者確認で製造指示書へ切替。§2-1 参照） |
| 実装コミット | ブランチ `claude/m18-03b-design-outline-bjv1ri`。`aae9ea9`(wt/m18-03a マージ)..HEAD = **15 commits**。**リモート反映済み**（`claude/` 名前空間は CLAUDE.md §7 で機械許可）。GitHub 上は **Unverified**（署名なし・committer は `noreply@anthropic.com` で正・開発者判断でスルー確定） |
| 関連 | 完了報告 `docs/progress/phase3/M18-03b-completion-report.md` / レビュー `docs/progress/phase3/m18-03b-review.md`（**重大問題ゼロ**・「高」は完了報告未作成のみで解消済み・**受理**） |
| 備考 | 実装直後の同一セッションで作成（開発者との Q&A で確定した判断＝丸め実測・基底採用の解除・実装ソース切替を反映）。**E-17 実出力目視は開発者実施済み（2026-07-27）＝DoD 全充足・受理** |

本レポートは **①製造が独自に確定した実装仕様 ②製造の判断 ③設計担当が未把握の残課題** に絞る。指示書どおりに実装した部分（materialize の対象判定・ダメージ式・コピー範囲・FR301・単一 Tx・生成元バッジ・変換導線 2 箇所・マイグレ 0 本）は割愛。

**最重要は §1-1（materialize が基底の採用を入力キューから解除＝指示書 §4.4 に無い挙動を §5.3-A/§1.1 から導出して実装）と §3-1（materialize 済みノーマル版を探す画面の孫から隠す・開発者要望・要設計）**。いずれも DES-005 への反映が要る。

---

## §1 製造が独自に確定した実装仕様(DES 反映が要るもの)

### 1-1【最重要・仕様の明確化】materialize は基底コンボの採用を「入力キュー」から解除する(指示書 §4.4 の処理順に無い)

- **事象**: 指示書 §4.4 の処理順は「生成」のみ（対象判定→FR301→ダメージ→INSERT→子テーブル→`combo_punishes` INSERT）を列挙し、**基底コンボの既存採用をどうするか**を書いていない。一方 **§5.3-A（E2E）と §1.1 は「変換後に基底が第3セクション（区分を判定できない反撃）から消える」「このバケツは materialize の入力キューであり処理する機能」**と明記しており、両者に乖離があった。
- **開発者裁定(2026-07-27)**: 「**基底の採用（`combo_punishes(基底, 相手技)`）と同キー curation を解除して第3セクションから外す。基底コンボ自体は独立フォークとして残す**」。
- **実装**: 生成経路は同一 Tx 内で `RemovePunishLink(基底, 相手技)`、FR301 既存一致経路は `drainBasePunish`（短命 Tx）で解除。いずれも **対象が無ければ no-op（冪等）**＝探す画面孫ツリーからの未採用変換では何も消さない。punish 側 `RemovePunish` と同じく `combo_punishes` と `combo_punish_curations` を**ペアで削除**し孤児を作らない。
- 根拠: `internal/service/combo/service.go`（`Materialize` の `RemovePunishLink` 呼び出し・`drainBasePunish`）、`internal/repository/combo/repository.go`（`RemovePunishLink`）、テスト `TestMaterialize_DrainsBaseAdoption` / `TestMaterialize_Drain_NoOpWhenBaseNotAdopted`、E2E `web/e2e/m18-03b-materialize.spec.ts` test A（第3セクションから消えることを確認）。
- ⇒ **DES-005 §5.21（画面21）／§5.20（探す画面）と §4.4 系の materialize 処理順に「変換時に基底コンボの採用を解除する（基底コンボ自体は残す）」を明文化してほしい。** あわせて指示書 §4.4 の処理順に本ステップを追記推奨。

### 1-2【出力契約の追加】探す画面 孫コンボ `ComboNode` に `hitType` を露出(走査述語は不変)

- **事象**: FE の変換ボタンは「`punish_counter` 系のコンボには出さない」（指示書 §4.8・§4.1）。探す画面の孫ツリー（`PunishTree.tsx`）の `ComboNode` は従来 `hitType` を持たず、表示条件を判定できなかった。
- **実装**: `internal/service/punishfinder/service.go` の孫 `ComboNode` に **出力専用フィールド `HitType *string`** を追加（`c.HitType` の投影）。**走査述語・フレーム/レーン判定・除外規則は一切変更していない**（案C は 03c）。FE 側は `PUNISH_COUNTER_HIT_TYPES`（`web/src/constants/punish.ts`）で PC 系を非表示。
- 根拠: `punishfinder/service.go` の `ComboNode` struct＋`byStarter` 代入箇所、`web/src/features/punish/types.ts`、テスト `PunishTree.test.tsx`（punish_counter には出さない）。
- ⇒ **DES-002 §4.2／DES-005 §5.20 の `GET /api/punish-finder` レスポンスの孫 `ComboNode` に `hitType` を追記してほしい**（後方互換の追加フィールド）。

### 1-3【API 契約の確定】`POST /api/combos/{id}/materialize` の応答・理由コード

指示書 §4.4 はリクエスト（`opponentMoveId` 必須・`note` 任意）と「生成時は id＋加算の有無/理由、既存あり時は既存 id」までを規定。以下で確定した。

- **応答（200・生成でも既存一致でも 200＝非エラー）**: `{ comboId, alreadyExisted, damageAdded, damageSkipReason? }`（`internal/api/combo/dto.go` `MaterializeResponse`）。
- **対象外 hit_type（`punish_counter`／`just_parry_punish_counter`）**: **400 ＋ 理由コード `hit_type_not_materializable`**（BE でも弾く＝FE がボタンを出さないだけでは API 直叩きで二重計上が起こるため）。
- **加算しなかった理由コード（§4.3 の縁・silent に 0 加算しない）**: `base_damage_null` / `starter_move_not_set` / `starter_move_damage_null`。FE は `MATERIALIZE_DAMAGE_SKIP_LABELS`（BE 定数と 1:1）で文言化（内部値/表示ラベル分離・L-7）。
- 根拠: `internal/api/combo/materialize_handler.go`、`internal/service/combo/service.go`（`MaterializeResult`・理由コード定数）、handler テスト 5 本。
- ⇒ **DES-002 §4.2 に本 endpoint の応答契約と理由コード（`hit_type_not_materializable` 等）を明記してほしい。** 理由コードは M19-01 `knockdown_advantage_required` の流儀に合わせた。

### 1-4【編集経路の引き継ぎ実装方式】FK 再ポイント(setups と同型)

- **事象**: 指示書 §4.6・裁定11＝識別キー変更編集で `combo_punishes`／`combo_punish_curations` を新コンボへ引き継ぐ（followup §I-(b) の解消）。実装方式は「`setups` の `SetupCarryOptions` と同型」とだけ指定。
- **実装**: 実コードで PUT 経路（`UpdateWithKeyChange`）の子テーブル機序を引くと、setups は **FK 再ポイント**（`UPDATE combo_setups SET combo_id=?`＝`UpdateSetupReferences`）で引き継がれている。これに合わせ **`MovePunishReferences`（`combo_punishes`／`combo_punish_curations` の `combo_id` を旧→新へ UPDATE）を combo リポジトリに新設**し、同一 Tx 内へ配線（`opponent_move_id`・`note` は不変）。punish リポジトリへの依存注入は行わず、既に combo リポジトリが `combo_setups`（setup ドメイン表）を書いている先例に倣った（§2-2 参照）。
- 根拠: `internal/repository/combo/repository.go`（`MovePunishReferences`）、`internal/service/combo/service.go`（`UpdateWithKeyChange` 内の呼び出し）、テスト `TestUpdateWithKeyChange_CarriesPunishAndCuration` / 原子性 `…_PunishCarryIsAtomic` / PATCH 無変化 `TestUpdateMetadata_DoesNotMovePunish`。
- ⇒ **DES-003 §3.15（`combo_punishes`）／§3.17（`combo_punish_curations`）に「識別キー変更編集で採用は新コンボへ引き継がれる（FK 再ポイント・同一 Tx・原子的）」を明文化してほしい。**

---

## §2 製造の判断

### 2-1 開発者へ確認して確定した点

| 事項 | 確定内容（2026-07-27） | 根拠 |
|---|---|---|
| **実装ソース** | 引数の `M18-03b-design-outline.md`（v0.1.0 骨子）ではなく製造指示書 **`M18-03b-materialize.md` v1.0.1** を実装ソースに確定。骨子は §8 空欄・案C/手入力prefill を含み materialize.md と scope が食い違うため | 開発者チャット確認 |
| **ダメージ丸め規則（裁定1）** | 実査 `moves.damage % 5 <> 0` = **10 件**（≠0）。開発者インゲーム実測の結果、10 技は **throw×3 / special(OD投げ)×1 / target_combo×6** で全て**非始動技**＝ × 0.2 が非整数になる**適用面が存在しない**と確認。**整数除算（`/5`・丸め関数なし）で確定**。DES に丸め規則は書かない | 完了報告 §1・`service.go` コメント（実測確認済） |
| **基底採用の解除** | §1-1 のとおり materialize は基底の採用を解除する（第3セクションから外す。基底コンボ自体は残す） | 完了報告 §3 |

### 2-2 推測で進めた点(指示書 §8.2 の推測許容範囲)

- **materialize ロジックの配置（§3.3-6・指示書は「新パッケージ or combo サービス」の選択を製造に委任）**: **combo サービスへ追加**した。理由＝FR301（`FindActivePublishedDuplicates`＋`CalcRecipeHash`）と子テーブル INSERT 一式が combo サービス内にあり、新パッケージ化すると再エクスポート/重複が生じるため。依存グラフ上 combo→punish の一方向で循環なし。
- **punish 書込メソッドの置き場所**: `MovePunishReferences`／`InsertPunish`／`RemovePunishLink` を**combo リポジトリ**に置いた（punish リポジトリへ tx 対応メソッドを足して注入する案は採らず）。理由＝combo リポジトリは既にキー変更 Tx で `combo_setups`（setup ドメイン表）を FK 再ポイントしており（`UpdateSetupReferences`）、「キー変更/materialize の子テーブル操作は combo リポジトリに集約」する既存の型に合わせたほうが `UpdateSetupReferences と同型` の指示に最も忠実なため。**レビューはこれを低リスクの重複と評価し、03c での整理候補として繰越（§3-3）**。
- 変換ボタン・生成元バッジの細部レイアウト/文言（DES-005 §5.4 のイディオム範囲）。

---

## §3 設計担当が未把握の残課題・申し送り

### 3-1【要設計・開発者要望 2026-07-27】materialize 済みノーマル版を「探す」画面の孫から隠す

- **要望**: 反撃は必ずパニッシュカウンターになるため、ノーマル版は生成候補としては欲しいが、**PC 版を生成したら元のノーマル版は探す画面の孫候補から消えてほしい**。
- **実装骨子（新スキーマ不要）**: `internal/service/punishfinder/` の孫コンボ列（`byStarter[starter]`）から **`EXISTS(active combo Y: Y.materialized_from_combo_id = X.id)` を満たす X を除外**。`materialized_from_combo_id` は本サブで既に消費済み。
- **無設計変更の 03b では実装しなかった理由**: (1) 探す画面の候補集合変更＝**DES-005 §5.20 の挙動変更**、(2) `punishfinder` は 03b §2.2 で凍結・**CHANGE-089 §4 で 03c の案C と同一ファイル＝回帰ゲート必須**、(3) 未決の設計問い＝隠す範囲（全文脈か相手技コンテキスト単位か）／PC 版削除時にノーマルを復活させるか（EXISTS だと自動復活）／ノーマルを単独コンボとして他画面では残す扱い／counter 始動版の扱い。
- ⇒ **punishfinder を開ける M18-03c（案C）にまとめて設計・実装し、DES-005 §5.20 へ addendum してほしい。** `docs/handover/followup-backlog.md` §I-(d) `punish-hide-normal-after-materialize` に起票済み。

### 3-2 FR301 の「穴」の明文化(指示書 §5.2 の推奨・DES 未反映)

- dup 判定 SQL は `is_draft=0` と `deleted_at IS NULL` が固定のため、**既存 PC 版が仮登録／ゴミ箱にあると検出されず二重生成される**（既存の全登録経路と一貫）。テストで「生成される（既存仕様）」と期待値を明示済み（`TestMaterialize_FR301_Holes_Generate`）。
- ⇒ **DES-006 に FR301 の適用面に materialize が加わったこと＋この穴（`is_draft=0`/`deleted_at IS NULL` 固定）を明文化してほしい**（指示書 §5.2 も推奨）。

### 3-3 combo リポジトリと punish リポジトリの punish 操作の重複(レビュー低指摘の繰越)

- §2-2 のとおり combo リポジトリに punish 表への書込（`InsertPunish`/`RemovePunishLink`/`MovePunishReferences`）を置いた。punish リポジトリ側の `addPunishSQL`/`RemovePunish` と挙動を揃える意図はコメントで明記済みだが、二重メンテの芽。**03c の curation 登録導線 再設計時に整理を検討**（低リスク）。

### 3-4 `getMoveDamage` の層分離(レビュー軽微の繰越)

- materialize 内で `SELECT damage FROM moves` をサービスから直接発行（`moves` は不変の参照データのため tx 外で妥当）。リポジトリ層を経由しない点は既存の層分離方針とやや不整合。将来 moves 参照が増えた際の整理候補。

### 3-5【✅ 完了】E-17 実出力目視(DoD §7.4)

- materialize コンボを 1 件、出力正典（DES-005 §5.13＝A4 固定・縮小フィット下限 70%・メディアは link のみ・セットプレイは名称のみ）の条件で出力し目視。**開発者実施済み（2026-07-27）＝目視 OK・DoD §7.4 充足・完了報告は受理**。materialize は既存 export 経路をそのまま通す設計（新規出力実装なし）だったため回帰なしを確認。

### 3-6【move データ精緻化時の申し送り】計測中の実機所見

- **SF6 実機バグ「後ろ投げ +1」**: 一部キャラで後ろ投げのみダメージが +1（PC・通常投げとも）。例 kimberly `throw_back` PC 実測 1839 vs `throw_forward` 1838。**seed は前投げ基準で両者同値(1082)＝バグはデータに反映しない**（開発者方針）。ゲーム側バグで本アプリの欠陥ではない。
- **target_combo のダメージは累積値**: kimberly `bushin_prism_strikes`(1178)等は 1 技ではなくターゲットコンボ合計。**seed の category は既に `target_combo` で正しく是正不要**。materialize の始動技にならないため影響なし。
- いずれも progress-log に記録済み。将来 move データを実機準拠で精緻化する際の参照用。

---

## §4 参考(触れていない＝不変の証跡)

- **`DuplicateKey`／`CalcRecipeHash`／`RecomputeComboCache` の判定内容は不変**（`materialized_from_combo_id` を混ぜていない）。`materialized_from_combo_id` は DES-003 §3.4 のとおり dup/recipe 非対象。
- **`CreateRequest` に出自を足していない**（出自詐称経路を作らない）。**CSV export に `materialized_from_combo_id` は出さない**（裁定6・`internal/service/comboio/` に混入 0 件）。
- **新マイグレ 0 本**（`migrations/` 末尾 000041）。**`internal/seedgen`／`Header.tsx`／`ComboEditor` Props／M19-01 資産（`setplay/`）は非改変**（`aae9ea9..HEAD` で確認）。`model.Combo` は 1 フィールド追加のみ、`combos` INSERT は 22→23 列。
- 回帰: `go test ./...` 全 green・FE 834 tests green・E2E A〜D 4/4 green。

---

## §5 CHANGE 起票のたたき台(設計担当向けチェックリスト)

実装完了に伴う DES 反映。**番号は起票時に registry で採番**（本サブ実装で消費した CHANGE は **089**。以下は 089 の実装後反映＋新規要望分）。

1. **CHANGE-089 実装後反映（三点セット）**: DES-002 §4.2（materialize endpoint の応答契約＋理由コード＋孫 `ComboNode.hitType`／§1-2・1-3）・DES-003 §3.4（`materialized_from_combo_id` 初消費・CSV 非出力）／§3.15・§3.17（編集時の採用引き継ぎ・§1-4）・DES-005 §5.20・§5.21（生成元バッジ・第3セクションの変換導線・**基底採用の解除**／§1-1）・DES-006（FR301 に materialize＋dup の穴の明文化／§3-2）。**ダメージ丸め規則は DES に書かない**（適用面なし・§2-1）。
2. **【新規 CHANGE 候補】materialize 済みノーマル版を探す画面の孫から隠す（§3-1）**: DES-005 §5.20 の候補集合ルール変更。**M18-03c（案C）に同梱を推奨**（同一 punishfinder ファイル・回帰ゲート共有）。未決の設計問い（隠す範囲・PC 版削除時の復活・counter 版）を設計で確定のこと。

---

*以上、M18-03b 設計伝達レポート。①独自確定仕様（基底採用の解除・孫 hitType・endpoint 契約・引き継ぎ方式）②製造判断（配置・punish 書込の置き場所）③残課題（ノーマル版の孫非表示要望・FR301 穴の明文化）に絞った。E-17 実出力目視は開発者実施済み（2026-07-27）＝受理。*
