# M19-01 → 設計担当 設計伝達レポート(セットプレイ自動提案)

| 項目 | 内容 |
|------|------|
| 対象 | Web 版設計担当 Claude(フェーズ3 継続担当) |
| 発信 | 製造担当 Claude Code / 2026-07-25 |
| 対象指示書 | `docs/instructions/M19-01-setplay-suggestion-engine-and-ui.md` **v1.4.0** |
| 実装コミット | ブランチ `claude/m19-01-setplay-suggestion-atcbdg`・13 コミット(`c838b17`〜`398b465`)・**push 済**・**PR #10** |
| 関連 | 完了報告 `docs/progress/M19-01-report.md`(§1〜§13)/ CHANGE addendum 2 件(`docs/change-notes/CHANGE-085-addendum-setplay-*.md`) |
| 位置づけ | 製造は DES 本体を直接編集しない(CLAUDE.md §8)。本レポートは差分主義=**指示書どおりの部分は割愛**し、①独自確定仕様 ②製造判断 ③残課題に絞る |

本レポートは、指示書 v1.4.0 明記済みの内容(受理帯の式・エンジン移植・golden-case・VAL-S04/05/06・非永続など)は繰り返さず、**設計担当がまだ把握していない差分**のみを扱う。**開発者レビューを 3 ラウンド受けて指示書 §4.2/§4.6.1 を超える確定仕様が生じているのが本サブの特徴**。

> **最重要は §1-3(target 種別フィルタ＋damage 規則=指示書 §4.2 超過)・§1-4(相乗り先が SetupSelectorModal ではなく ComboDetailPage)・§1-1(KA 意味論が DES-003 に未反映)**。

---

## ★ 手動反映チェックリスト(先に結論)

| # | 反映先 | 内容 | 本レポート節 |
|---|--------|------|------------|
| 1 | **DES-003 §3.4** | KA 意味論(無敵時間・起き上がり=KA+1・`N=KA+2−S`・受理帯)を明文化(指示書は「errata② で明文化済み」と書くが**実ファイルに不在**) | §1-1 |
| 2 | **DES-002 §4.2** | 提案エンドポイント＋**実装確定の query パラメータ全量** | §1-2 |
| 3 | **DES-005**(＋DES-003 §3.3) | **target 種別フィルタ・damage 既定除外・system 常時除外**(指示書 §4.2 を超える確定仕様) | §1-3 |
| 4 | **DES-005 §5.6 項目11** | 相乗り先を **ComboDetailPage(FR011 候補面)** に補正(指示書 §2.1 の SetupSelectorModal は誤り) | §1-4 |
| 5 | **DES-005**＋**CLAUDE.md §10.X** | 制約告知(初回のみ)・localStorage キー `setplay-notice-seen-v1`・フレームデータ由来の注意3件 | §1-5 |
| 6 | **DES-005** | UI ラベル「採択」→**「採用」**・**「不採用」**(結果から一時非表示・非永続) | §1-6 |
| 7 | **DES-003 §3.3** | `is_projectile`・`is_derived`・`original_move_id` の consumer 用途に **setplay** を追記 | §1-7 |

これらは全て **CHANGE-085(DES-002＋DES-005 集約)＋その addendum 2 件**に集約起票済み(§5)。マイグレ・スキーマ変更は**ゼロ**。

---

## 1. 製造が独自に確定した実装仕様(DES 反映が要るもの)

### 1-1. KA 意味論・窓方式が DES-003 §3.4 に**未反映**(指示書の「errata② 明文化済み」は事実と乖離)
指示書 §1.1 は「**DES-003 §3.4 に errata② で明文化済み**(KA=無敵時間／起き上がり=KA+1／`N=KA+2−S`／`1≤N≤active`)」と書くが、**実ファイル `docs/design/03-data-model.md` §3.4 の `knockdown_advantage` 定義は「ダウン後の有利フレーム数」の一文のみ**で、errata②・窓方式・N 定義は**存在しない**(製造着手時の全文 grep で確認)。
- 実装はこの意味論を正として `internal/service/setplay/setplay.go` に受理帯 `0≤remaining≤Active−NMin`・`N=remaining+NMin`(=`KA+2−S`)で実装済み。エンジン恒等式テスト `TestWindowIdentity` 他 10 観点で担保。
- ⇒ **DES-003 §3.4 に KA 意味論(無敵時間・起き上がり=KA+1・`S=Σfiller.total+startup`・`N=KA+2−S`・成立 `NMin≤N≤active`)を明文化してほしい**。中央預かりだった論点が実装で確定・使用されている。

### 1-2. 提案エンドポイントと**実装で確定した query パラメータ全量**(DES-002 §4.2)
`GET /api/combos/:comboId/setplay-suggestions`(副作用なし・KA NULL は 400 `knockdown_advantage_required`)。指示書 §4.3 は `n_min`/`sort=n|steps`/`target_move_id` を挙げるが、**実装で確定したのは以下**(`sort=steps` は廃止):

| param | 値 | 既定 | 備考 |
|-------|----|------|------|
| `n_min` | int | 1 | 1 未満は 1 に丸め |
| `sort` | `n` \| `target` | `n` | **`steps`(手数)は廃止**(§2-2)。`n`=持続が深い順、`target`=重ねる技順 |
| `target_types` | カンマ列(下記種別キー) | `normal,unique,special_projectile` | §1-3 |
| `include_zero_damage` | bool | false | §1-3 |
| `target_move_id` | int | — | 明示指定時は種別/damage/is_derived/is_aerial をバイパス(条件1 のみ) |

- レスポンス `{ items:[{steps[{moveId,code,role,counted}], s, n, landing, targetActive, alreadyAdopted}], truncated }`。`role` 値域に `parent` を予約(本サブ未出力)。`s`(発生)は**UI 非表示だが DTO には保持**(§1-6)。
- ⇒ **DES-002 §4.2 に本エンドポイントと上記パラメータを追記**してほしい(実装が一次源)。

### 1-3.【最重要】target 種別フィルタ・damage 既定除外(**指示書 §4.2 を超える確定仕様**)
指示書 §4.2 の target 規則は「startup≥1 ∧ active≥1 ∧ is_derived=false ∧ is_aerial=false」のみ。**開発者レビュー(2026-07-24〜25)で以下が追加確定**した:
- **種別タクソノミー**(`category`＋`is_projectile`＋rush は `original_move_id` の元技カテゴリから BE 算出):

  | 種別キー | 対象 | UI 既定 |
  |---------|------|---------|
  | `normal` | category=normal | ON |
  | `unique` | category=unique | ON |
  | `special_projectile` | special ∧ is_projectile | ON |
  | `special` | special ∧ ¬is_projectile | OFF |
  | `throw` | category=throw | OFF |
  | `normal_rush` | rush_variant(元 normal) | OFF |
  | `unique_rush` | rush_variant(元 unique) | OFF |

  super_art/critical_art/target_combo/drive_impact/system・元 special のラッシュは **種別提供なし**(自動対象外)。
- **damage 既定除外**: 既定で `damage>0` の技のみ target(**ドライブパリィ=`category=system,damage=0` が active≥1 だけで誤 target 化していた実害の是正**)。`include_zero_damage=true` で緩和、ただし **`category=system` は種別 "" のため常に自動対象外**。
- 根拠: `internal/service/setplay/service.go`(`moveTargetType`・`collectTargets`)、`internal/repository/setplay/repository.go`(`category,damage,is_projectile,original_move_id` を SELECT・**API 非露出**)。テスト `TestService_TargetTypeFilter`/`_ZeroDamageExcludedByDefault`/`_SystemNeverTargeted`/`_RushTargetTypes`。
- ⇒ **DES-005 の提案 UI 仕様に「当てたい技の種別」チェック UI と種別定義・damage 既定除外・system 除外を明文化**。**DES-003 §3.3** 側に `is_projectile`/`is_derived`/`original_move_id` の setplay consumer 用途を追記(§1-7)。

### 1-4.【最重要】提案 UI の相乗り先は **ComboDetailPage**(指示書 §2.1 の SetupSelectorModal は誤り)
指示書 §2.1/§4.6.1 は載せ先を `SetupSelectorModal.tsx` と名指すが、**同モーダルはコンボエディタの C-08「既存から紐付け」用で `comboId` を持たず、採択→保存(§4.6.2)が成立しない**。実際の「DES-005 §5.6 項目11 単一コンボ候補面」は **`ComboDetailPage` の FR011 候補(`SetupCandidateList`)側**。**§9.1-1 に従い開発者確認 → ComboDetailPage を相乗り先に決定**(2026-07-24)。
- 実装: `web/src/pages/ComboDetailPage.tsx` に `SetplaySuggestionSection` を FR011 候補セクションの直後へ追加。**既存 FR011(`SetupCandidateList`・setup endpoints)は不変=非破壊**。`selectedIds`(§5.13a)不使用。
- ⇒ **DES-005 §5.6 項目11 の記述を「ComboDetailPage の候補面に提案セクションを相乗り」へ補正**(指示書 §2.1 の SetupSelectorModal 名指しは誤りとして是正)。

### 1-5. 制約告知(§4.6.3)＋ localStorage キー＋フレームデータ由来の注意3件
- 初回のみ自動表示・以降は注意アイコン・保持不可時は非表示に倒す(`web/src/features/setplay/components/SetplayLimitationNotice.tsx`)。
- **localStorage キー `setplay-notice-seen-v1`**(CLAUDE.md §10.X の公認3キー外=**要拡張**。addendum 起票済み)。
- 開発者指示(2026-07-25)で**フレームデータ由来の注意3件**を告知へ追加(ja/en): ①多段技はヒット間の非当たり判定区間も持続に含める(例 かかと落とし)②画面に残る弾は硬直を持続扱い(例 波動拳)③設置系は硬直を持続扱い(例 アラビアンサイクロン)。理由=ゲーム内フレームメーター準拠。
- ⇒ **DES-005 に制約告知の表示仕様を明文化**、**CLAUDE.md §10.X 公認キー表に `setplay-notice-seen-v1` を追加**(§5)。

### 1-6. UI ラベル「採択」→「採用」・「不採用」ボタン(開発者指示 2026-07-25)
- ja ラベルを **「採用」/「採用済み」** へ改称(en は Adopt/Adopted のまま)。
- **「不採用」ボタン**=押した提案行を**結果から一時的に消す**(`suggestionKey`=moveId 列＋N で識別・クライアント状態・**非永続**。「提案を出す」再検索でリセット)。DB 保存はしない。
- **発生(S)表示は行から削除**(DTO の `s` は保持)。
- ⇒ **DES-005 の提案行 UI に「採用/不採用」・S 非表示を反映**。不採用が非永続である点も明記(将来永続化するなら別途 CHANGE)。

### 1-7. `is_projectile`/`is_derived`/`original_move_id` を BE SELECT で consume(API 非露出)
setplay グルーは提案生成のため上記 3 列を **`internal/repository/setplay` の SELECT でのみ参照**(§2.3 例外の最小適用)。`model.Move`/`GET /api/moves` へは**露出していない**(is_projectile/is_derived は元々 DB 専用)。
- ⇒ **DES-003 §3.3 の各列の用途注記に「setplay 提案の種別判定(is_projectile=弾種別・is_derived=派生/rush 判定・original_move_id=rush の元技分類)」を追記**してほしい。

---

## 2. 製造の判断

### 2-1. 開発者へ確認して確定した点

| # | 何を | 確定内容 | 経緯 |
|---|------|----------|------|
| a | 指示書ファイル名 | `M19-01-setplay-suggestion-engine-and-ui.md` 維持 | 開発者確認 2026-07-24 |
| b | 提案 UI 相乗り先 | **ComboDetailPage**(SetupSelectorModal は comboId 無で不可) | §1-4・開発者確認 2026-07-24 |
| c | ラッシュ版 target 種別 | **前倒し実装**(`normal_rush`/`unique_rush`)。**M19-02 の rush 部分を消化** | 開発者指示 2026-07-24。through target 系(target_combo 2nd hit・GC-2・表記展開)は M19-02 継続 |
| d | ラベル・不採用 | 「採択」→「採用」・「不採用」(非永続) | 開発者指示 2026-07-25 |
| e | フレーム注意 3 件 | 制約告知へ追加 | 開発者指示 2026-07-25(§1-5) |

### 2-2. 推測で進めた点(指示書 §9.2 の推測許容に基づく・明示)
- **ファイル配置**: 指示書 §2.1 想定の `internal/handler/`・`SuggestionDTO in model` は実構成に無いため、**`internal/api/setplay`(handler/dto/routes)・`internal/service/setplay`(engine＋glue 同一パッケージ)・`internal/repository/setplay`** へ配置(既存 setup ドメイン流儀)。
- **移植 18 テスト**: `Active=NMin=2` で band=0＝完全一致を再現する構成にしたため、`Suggestion.TotalFrames`(KA→S 意味変更)の**期待値修正は 0 件**で通した(指示書 §4.1.6 は「2 件修正」を想定したが本構成では不要)。窓方式は新規 10 観点で別途検証。
- **ソート**: 指示書 §4.4 の `sort=steps`(手数)を**廃止**し `sort=n|target` に整理(開発者指示 §1-2)。手数はタイブレークのみ。
- **name 自動生成**: 指示書どおり FE で i18n から生成(`{target} 持続{N}F目重ね`)。

---

## 3. 設計担当が未把握の残課題・申し送り

| # | 課題 | 扱い |
|---|------|------|
| 3-a | **ラッシュ版 target のフレーム基準(startup_basis)** | rush 版の格納 startup(例 rush 立ち弱K=16)がドライブラッシュ発動込みの絶対値かは **startup_basis 未反映のまま前倒し実装**。フレームメーター準拠として計算に使用。**実機で N のズレ確認が前提**。ズレるなら rush の startup 解釈を要調整(M19-02 or 別 CHANGE) |
| 3-b | **through target 系**(target_combo 2nd hit・表記展開・親なし子警告・**GC-2**) | M19-02(中央スキーマ `startup_basis` 反映後)。5/5 到達も M19-02 |
| 3-c | **B 型 air-only 技の誤提案** | `is_derived=false ∧ is_aerial=false` を通る「最速でも当たらない空中技」は機械判別不能・出得る(MVP 許容)。恒久対策は人手マーキング(中央判断) |
| 3-d | **技表示名が日本語固定** | レシピ・生成名は `moves.nameJa` 使用のため英語 UI でも技名は日本語。技マスタ ja 単一の割り切り。英語 UX 許容可否は設計判断 |
| 3-e | **弾(projectile)を重ねる提案の実用性** | `special_projectile` を既定 ON にしたが、弾の持続当ては特殊。実用の妥当性は運用後判断 |
| 3-f | 独立レビュー軽微 3 件 | UI 相乗り先(=開発者決定済)・golden テストのコメント(実データ確認は E2E で担保)・`truncated` セマンティクス(指示書準拠)。いずれも対応不要で決着(完了報告 §9) |

---

## 4. 参考(触れていない=不変の証跡)

- **マイグレ 0・新テーブル/新列 0**(`migrations/` は 000039 が最新のまま)。**go.mod 不変**(stdlib のみ)。
- **既存 FR011 非破壊**: `SetupCandidateList`・`GET /api/setups/candidates`・`GET /api/combos/:comboId/setup-candidates`・setup CRUD シグネチャ不変。
- **別リポ `autopilot-combomgr/projects/setplay-suggestion` 不変**(移植元 read-only)。
- **golden-case 4/4**(GC-1/3/4/5・実フレーム値)・**E2E A/B/C 3 件 PASS**・独立 clean-room レビュー §9 重大 0 件。
- `M19-LIMITATION-NOTICE` マーカーが BE(target/filler/KA-null 規則)＋ i18n(ja/en)に付与(`grep -rn` で一覧可能・完了報告 §7)。

---

## 5. CHANGE 起票のたたき台(設計担当向けチェックリスト)

> 番号は起票時に registry で採番。**CHANGE-085 は中央起票済み**(DES-002＋DES-005・マイグレ非消費)。本サブは製造でその**反映範囲が指示書を超えて拡張**したため、下記を CHANGE-085 反映へ含めるか、addendum を正式 CHANGE 化してほしい。

- [ ] **CHANGE-085 / DES-002 §4.2**: 提案エンドポイント＋query パラメータ全量(§1-2)。
- [ ] **CHANGE-085 / DES-005**: target 種別フィルタ UI・damage 既定除外・system 除外(§1-3)/ 相乗り先=ComboDetailPage 補正(§1-4)/ 制約告知＋フレーム注意3件(§1-5)/ 採用・不採用・S 非表示(§1-6)。**参考: `docs/change-notes/CHANGE-085-addendum-setplay-target-filter.md`**。
- [ ] **CLAUDE.md §10.X**: 公認 localStorage キー表に `setplay-notice-seen-v1` を追加(§1-5)。**参考: `docs/change-notes/CHANGE-085-addendum-setplay-localstorage-key.md`**。
- [ ] **DES-003 §3.4**: KA 意味論(窓方式)を明文化(§1-1・中央預かり解消)。
- [ ] **DES-003 §3.3**: `is_projectile`/`is_derived`/`original_move_id` の setplay consumer 用途を追記(§1-7)。
- [ ] **M19-overview / model-allocation**: ラッシュ版 target の M19-01 前倒し消化(§2-1c)・through 系の M19-02 継続を反映。

---

*以上。実装は PR #10(`claude/m19-01-setplay-suggestion-atcbdg`→`main`)で未マージ。本レポートは push 済のため push+Sync 後に Web 版から直読可能。*
