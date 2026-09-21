# M17-02 完了報告(G-k command 索引源の確立+段階2 解決エンジン BE)

| 項目 | 内容 |
|------|------|
| 指示書 | `docs/instructions/phase3/M17-02-command-index-stage2.md` v1.1.0 |
| 実施日 | 2026-07-16 |
| 実施形態 | `/implement_plan_full`(Plan Mode → 実装 → fresh subagent レビュー → 自動トリアージ) |
| 関連 | CHANGE-069(v2・起票済み)・M14-03b(moveindex IF)・M14-03c(seedgen golden 定石) |

## 1. Plan Mode 確定事項(指示書 §3.3 の 13 項目)

| # | 項目 | 確定内容 |
|---|------|---------|
| 1 | 索引テーブル | `move_commands(move_id FK CASCADE, character_id FK CASCADE, token_key TEXT, PK(move_id, token_key))`+INDEX `(character_id, token_key)`。UNIQUE(character_id, token_key) は張らない(1:N は索引段階で許容・畳むのは解決表側) |
| 2 | 派生技フラグ配置 | `moves.is_derived`(BOOLEAN NOT NULL DEFAULT false)=G-k 確定どおり moves 本体列(000032) |
| 3 | numpad 正規化 | §9.9 トークン→断片写像(方向=テンキー数字 u8/d2/l4/r6/ul7/ur9/dl1/dr3/n5・ボタン=LP〜HK/P/K・charge_d/l/r=[2]/[4]/[6]・circle=360・or=/・chain=>・alt_sep=\|・hold=(hold))。plus は削除しボタン断片隣接時のみ `+` 挿入。例 `d dr r plus p_l`→`236LP`・`d plus p_m`→`2MP`・`charge_l r plus p_l`→`[4]6LP`。`moveindex.normalizeToken`(M14-03b の後付け位置)へ差し込み。skip の `raw{`/`cond{` 部分文字列判定は維持(cond{…} 内空白対策)+語彙外トークンの Add 時検出を追加 |
| 4 | 段階2 入力モデル | FE は「方向テンキー数字(1-9・ニュートラルは数字なし)+ボタン名(LP/MP/HP/LK/MK/HK)」を連結したキーで解決表を引く(例 `3MK`・`2MP`・`MP`)。キー書式=API 契約(DTO コメントに明記) |
| 5 | 特殊技優先・フォールバック | 畳み込みは BE(service/inputresolve)に一元化: is_aerial 除外→category ガード(normal/unique/special のみ)→形状フィルタ `^[1-9]?(LP\|MP\|HP\|LK\|MK\|HK)$`→特殊技優先(unique/special>normal)→moves.id 最小。**「表に無ければ段階1」の一様フォールバックは FE(M17-03)の分岐**=本サービスはフォールバックを持たない |
| 6 | API | `GET /api/characters/:characterId/command-index` → `{characterId, entries:{token_key: move_code}}`。**数値 ID 採用**(CHANGE-069 案は `{code}` だが既存 FE は moves を `?character_id=N` で引いており数値が一貫)。未 seed キャラ・存在しない ID=200+空(壊れない)。不正 ID=400 |
| 7 | 1:N 実測 | 段階2 スコープのグループ 153・1:N 63=立ち通常 vs ジャンプ通常 60+空中特殊技衝突 3(lily/great_spin・kimberly/elbow_drop・**zangief/flying_body_press=実測での新発見・同型**)。**is_aerial=false フィルタ後の残衝突 0**=解決表は完全 1:1(id タイブレークは規則として実装・実データでは未発動) |
| 8 | recipe_cache 非波及 | 新規 3 パッケージ(repository/movecommand・service/inputresolve・api/inputresolve)は読取のみで `RecomputeComboCache`・combos 同一性(dup/recipe_hash)へ非参照(構造で担保) |
| 9 | 失効記述の是正 2 件 | DES-002 §7.5 の (1) dash=modifiers.type 旧記述・(2) command/condition_* の raw_data 退避記述=**設計担当の DES 改訂(三点セット)で是正**(製造は DES 非編集。§5 参照) |
| 10 | 【実測】rush 現況 | rush_variant 156 行すべて `command` 空=既に索引非搭載。ただし CSV 上 `is_derived=false` だった → **開発者承認(2026-07-16)のうえ CSV を機械是正**(156 行 false→true・他列不変を機械検証・golden 非影響)。差分チェック承認済み・コミット `a1ed022` |
| 11 | 【実測】is_aerial 漏れ | **0 件**(is_aerial=false 同士の token_key 衝突なし)→ 追加規則不要・CSV 是正不要・設計担当への報告事項なし |
| 12 | 【実測】condition_ja | 索引搭載分で非空 **1 件**(ingrid/ca_cosmic_ray「体力25%以下で」・段階2 スコープ外・衝突 0)→ **追加規則を設けない**(§1.5 #3'' どおり) |
| 13 | マイグレ連番 | 実査で 000031 まで存在 → **000032〜000035** を消費 |

補足実測(索引カバレッジ): 総行数 836 / 索引搭載 530 / 非搭載 306(derived 148→CSV 是正後 304・empty 158→是正後 2 ※special 8 のうち 6 行は derived 優先で計上)。**CHANGE-069 §5 記載の「631/278(derived 137・empty 141)」とは乖離**=CSV 是正履歴(command-correction-history)による変動と推定。

## 2. 成果物

| 種別 | ファイル | 内容 |
|------|---------|------|
| マイグレ(手書き) | `000032_add_moves_is_derived.{up,down}.sql` | is_derived 列追加(down=DROP COLUMN・範=000031) |
| マイグレ(手書き) | `000033_create_move_commands.{up,down}.sql` | 索引テーブル+複合 INDEX(down=DROP) |
| マイグレ(生成) | `000034_backfill_moves_is_derived.{up,down}.sql` | 10 キャラ 304 code の UPDATE(down=0 へ)。**ユーザー生成行非接触**(CSV code 列挙のみ) |
| マイグレ(生成) | `000035_seed_move_commands.{up,down}.sql` | 索引 530 件 INSERT(非派生のみ・正規化済みキー・down=精密 DELETE) |
| seed データ | `character_data/*.csv`(10 キャラ) | rush_variant 156 行の is_derived 機械是正(開発者差分承認済み) |
| 索引モジュール | `internal/moveindex/moveindex.go` | numpad 正規化層差し込み・語彙外検出・`Entries()`(seed 列挙)・`AddIndexed()`(runtime 再構築) |
| 生成系 | `internal/seedgen/generate_m1702.go`・`cmd/seedgen/main.go` | `GenerateDerivedBackfill`/`GenerateMoveCommands`+`-mode` フラグ(既定 moves=既存挙動不変) |
| リポジトリ | `internal/repository/movecommand/repository.go` | `ListByCharacter`(moves 属性付き)・`LoadIndex`(**M14-03b IF の本体ランタイム消費=M17-04 の土台**) |
| サービス | `internal/service/inputresolve/service.go` | 畳み込み規則の一元実装(案C) |
| API | `internal/api/inputresolve/`+`cmd/combomgr/main.go` 配線 | 解決表配信エンドポイント |
| rush 一貫性 | `internal/repository/move/rush.go` | `POST /moves/:id/rush-variant` 生成行に `is_derived=1`(§4.7) |
| E2E | `web/e2e/m17-02-command-index-api.spec.ts` | API 疎通(実データ・空中非混入・空応答・400) |

**変更しないものの遵守**: `moves.command` 列は復活していない(index-only)。既存マイグレ 000001〜000031 非改変(golden で機械担保)。段階1(FE `inputResolution.ts`)・直接指定(M15-03)は無変更。model.Move への `IsDerived` フィールド追加は**行わない**(スコープ最小=API 露出は UI 再利用のマイルストーンで。divergence guard 対象外のため既存テスト無影響)。

## 3. 推測で進めた箇所(指示書 §9.2 の許容範囲・Plan 提示済み)

- 解決表の「曖昧は載せない」の具体化=category ガード(normal/unique/special 以外は形状合致でも非掲載)。特殊技優先→id 最小で常に 1 件に畳めるため、残る「意味的に決めきれない」は異カテゴリ混入のみと解釈。
- 段階2 形状フィルタは強度付きボタンのみ許容(強度なし `p`/`k` 単独形は実データ 0 件=展開規則を設けない)。
- 正規化キーの非段階2 トークン写像(hold=(hold)・alt_sep=\| 等)は不透明キーとして確定(M17-04 で人間可読性が必要になれば seedgen 再生成+golden 更新で変更可能)。

## 4. テスト結果(ケース数)

- **Go 全体: FAIL 0**。新規: moveindex 6 本(正規化テーブル 30 ケース・冪等・語彙外 skip・numpad 直クエリ・AddIndexed・Entries)/ seedgen 4 本(backfill・move_commands 生成 unit 2+**golden 2**)/ マイグレ整合 2 本(000032/000033 up/down 往復・000034/000035 seed 整合=304/530/派生混入 0/孤児 0+down 往復)/ movecommand リポジトリ 4 本 / inputresolve サービス 7 本(規則 unit 5+実データ統合=**空中衝突 3 件の除外を能動固定**)/ ハンドラ 3 本(200 実データ・200 空・400)/ rush is_derived 検証(既存 201 テストへ追記)。既存テスト修正 0 件。
- **Vitest: 102 files / 696 tests 全通過**(FE 変更なし=非回帰確認)。
- **make e2e: 22 passed / exit 0**(新規 1 本込み・既存非回帰)。
- 検証補足: 仮データキャラ(classic5 の c_viper 等)への依存はテストから排除(未 seed 系は存在しない ID=同一経路で検証。開発者指摘 2026-07-16)。

## 5. DES 反映要点(CHANGE-069 三点セット確定用・設計担当向け)

- **DES-004 §2.1 近傍(新設)**: 索引源=CSV command(§9.9 語彙)・index-only・**token→索引キー正規化の確定形(§1-3 の写像表)**・段階2 スコープ(地上・単方向+強度付きボタン)・一様フォールバック(表→段階1)・特殊技優先・id 最小・曖昧非掲載・死守 3 契約。
- **DES-003 §3.3**: `is_derived` 列(判定源=CSV 信頼・rush=true・backfill=000034)・`is_aerial` の用途追記(解決表除外条件)。**`move_commands` の新設節番号は要是正**: CHANGE-069/指示書は「§3.13 新設(現行 §3.12 まで=実物確認済み)」とするが、**実物の DES-003 v1.29.0 は §3.13 combo_setups が既に存在**(03-data-model.md L552)→ 新設は **§3.14** が正。
- **DES-002 §4.2**: `GET /api/characters/:characterId/command-index`(**数値 ID**=CHANGE-069 の `{code}` 案から変更・§1-6 の理由)。レスポンス形と FE キー構築契約(§1-4)。
- **DES-002 §7.6**: moveindex IF(`Lookup`/`LookupAll`/`Skipped`/`CharKeys`+M17-02 追加の `Entries`/`AddIndexed`)と `movecommand.LoadIndex` を取込ヘルパー(M17-04)との共通基盤として正典化。**§7.5 失効記述 2 件の同梱是正**(dash・raw_data 退避)。SUPP-001 §3.3.3 は自由改訂。
- **DES-006**: is_derived・move_commands・段階2 解決に VAL-* を設けない旨+VAL-C02 非関与。

## 6. 開発者への申し送り

1. **dev バックエンド再起動が必要**(000032〜000035 適用+新 API 有効化。dev_backend_restart_pitfall)。
2. **DES-003 §3.13 節番号の矛盾**(§5 のとおり)。CHANGE-069 v2 の「実物確認済み」記載と実物が不一致=設計担当での是正が必要。
3. **索引カバレッジ実測の乖離**(§1 補足)。CHANGE-069 §5 の 631/278 は旧 CSV 時点の値と推定。現況 530/306 を正として第二波で再測定。
4. **manon.csv は本サブ対象外**(開発者指示 2026-07-16)。是正・backfill・seed のいずれにも含めていない(生成系は明示的キャラリストで駆動・glob 不使用)。第二波 seed で `-mode` 3 種を manon 込みで再実行する際は、**seedgen の INSERT への is_derived 直接組込(変換規則改訂+golden 更新)**と同時に行うのが経済的(CHANGE-069 §5)。
5. 正規化キーは M17-04(取込ヘルパー)がトークン化→同一 IF で引く前提の不透明キー。ユーザー向け表示に使う場合は別途表示層で(プリセットエイリアスの分担維持=M17-overview §4.8)。
6. **【設計担当へ・実測 §3.3-12 の記録】`condition_ja` 非空は索引搭載分で 1 件のみ**(ingrid/ca_cosmic_ray「体力25%以下で」・段階2 スコープ外・token_key 衝突 0)→ 追加規則は設けていない(CHANGE-069 §4-#3'' の「ゼロなら規則を設けない」に実質合致)。三点セット時の DES-004 記述の参考に(レビュー指摘・低)。
7. **【M17-03 検討事項】ニュートラルキーの非対称**: 正規化は `n`→`5` を写像し解決表の形状 `[1-9]` は 5 を許容するが、FE キー構築契約は「ニュートラル=数字なし」。現 seed に `5X` 単独キーは 0 件だが、M17-03 の FE キー構築設計時に「5 を形状から外す or 5X→X へ畳む」を確定すること(レビュー指摘・低)。
