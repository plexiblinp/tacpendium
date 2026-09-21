# M9-03 レビュー報告書

対象指示書: `docs/instructions/M9-03-instruction.md` v1.0.2（FR703 手動修正・moves 編集グリッド・ラッシュ版生成）
対象チェックリスト: `docs/instructions/reviews/M9-03-review-checklist.md` v1.0.1
レビュー日: 2026-06-15 / レビュー対象コミット: `e557fe9`（feature/m9-03）

## 総評

実装は Plan Mode 5 決定（CHANGE-032）におおむね忠実で、`PATCH /api/moves/:id`・`GET /api/moves/:id`（単一フル）・`POST /api/moves/:id/rush-variant`（409 + 既存 id）・last-write-wins・notes_tool のみ編集・要確認のまま保存可、いずれも設計どおり実装されている。`GET /api/moves`（MoveResponse 契約）は不変で、§4.8 乖離検出ガードも reflect ベースの単体テストで担保されている。Go build / move 3 パッケージの test は通過。テストケース数も指示書 §5 を満たす。

ただし **1 点、スコープ違反の重大指摘がある**: ラッシュ版生成（`InsertRushVariant`）が `preset_aliases` へエイリアスを自動生成・書込している。これは指示書 §1.3「ラッシュ版エイリアスの自動生成ルール＝将来」・§4.4「preset_aliases 書込経路は本 MVP では作らない」、およびチェックリスト §1.3「preset_aliases 書込経路を作っていないこと」に明確に反する。CHANGE-031/032 にも当該機能の承認記載はない。本指摘の解消（または開発者承認）を M9 完了前に求める。

## 設計準拠性レビュー結果

### §1.1 編集エンドポイント（DES-002 §4.2 / 指示書 §4.1）— ◎
- `PATCH /api/moves/:id` はポインタ部分更新（`UpdateMoveRequest`、nil 不変更）、COALESCE を使わず明示列のみ UPDATE（`combo.UpdateMetadata` と同方式）。対象フィールド集合も指示書どおり（`edit.go:91-153`）。
- total は手動入力値をそのまま保存（自動算術なし）。`GET /api/moves/:id`（`getByIDSQL`）が narrow 一覧の返さない 6 フィールド + name_ja を返す。`PATCH`/`rush` とも更新後/生成後のフル move（`MoveDetailResponse`）を返す。
- 楽観ロックなし・version 列追加なし（スキーマ不変）。すべて CHANGE-032 確定どおり。

### §1.2 ラッシュ版生成（DES-003 §3.3 / 指示書 §4.2）— ◎（規則・409 部分）
- `category ∈ {normal, unique} ∧ is_aerial=false` をサーバ側 `rushEligible` で強制、違反は `RushTargetError`→400（`service.go:106-110, 122-128`）。
- `code = rush_<元技code>`・`category = rush_variant`・`original_move_id = :id`・フレーム/補正コピー（`rush.go:71-80`）。
- 重複は INSERT 前の事前 SELECT で検出し、既存 id を載せた `ErrConflict`→409 + `existingId`（`rush.go:59-69`、`handler.go:120-124`）。生 UNIQUE 制約エラーを漏らさない設計。

### §1.3 is_aerial トグル・投げ補正・name_ja 表示のみ — ×（重大、後述）
- is_aerial の PATCH 更新・extra_throw 補正は可。
- **name_ja は UI 上「表示のみ」だが、ラッシュ版生成時に `preset_aliases`（official_ja_move）へエイリアスを自動書込している**（`rush.go:82-92`、`sourceAliasSQL` + `UpsertOfficialJaAlias` + `rushAliasSuffix="(ラッシュ)"`）。チェックリスト §1.3 の「preset_aliases 書込経路を作っていないこと」に反する。詳細は「推奨修正・高」を参照。

### §1.4 notes 付記編集（CHANGE-030 / 指示書 §4.5）— ◎
- `notes_tool` のみ編集可、`notes` 原文は表示のみ（`MoveEditGrid.tsx:38-56, 265-278`）。他キー（command 等）は `parsedRaw.obj` を spread して保持（`MoveEditGrid.tsx:110-113`）し、消失しない。

### §1.5 検証強度（DES-006 / 指示書 §4.7）— ○
- properties は単一コード値ホワイトリスト照合、combo_scaling / raw_data は JSON オブジェクト整形式チェック、要確認状態（total NULL 等）のまま保存可（`service.go:130-160`）。
- 留意（低）: 編集対象に NOT NULL/FK 列がほぼ無い（is_aerial は bool）ため実害は小さいが、万一 DB 制約違反が起きた場合は 400 ではなく 500（raw error）になる。現フィールド集合では発火経路がないため許容範囲。

### §2 API 整合性 — ◎
- 一覧用 `MoveResponse` と詳細/編集用 `MoveDetailResponse` は別型で流用なし（`dto.go`）。
- mutation 成功時に `["moves","by-character",characterId]`（+ 詳細 `["move",id]`）を invalidate（`api.ts:52-55, 68-70`、code-facts §2 規約準拠）。
- ステータス契約（200/400 規則違反/404/409/201）がハンドラテストで担保（`TestHandler_RushVariant_201_then_409`、`_400_Ineligible`、`Get_404` 等）。

### §3 フロントエンド（指示書 §4.6 / DES-005 §5.18 画面18）— ○
- 画面18 を `MovesEditGridPage` として新設、`router.tsx:35` に `/moves/edit` 登録、取込画面（画面17）から `ImportMovesPage.tsx:234` で導線あり（§2.2 任意導線を充足）。取込プレビューとは別画面・別系統。
- キャラ選択→グリッド→インライン編集・is_aerial Switch・ラッシュ生成ボタン（`isRushEligible` で活性制御）・notes_tool 編集・保存が一通り動作。要確認行は `data-needs-confirmation` + amber 背景 + Badge で強調。
- React 既定エスケープで CSV/入力値を式・コマンド解釈せず描画（dangerouslySetInnerHTML 不使用）。shadcn/ui 踏襲。
- 留意（低）: 大量行（数百行）は仮想化なしで全行描画。指示書要件は「横スクロール」（`overflow-x-auto` あり）で、仮想化は要求外のため許容だが、実機で行数増大時の描画コストは手動確認継続が望ましい。

### §4 テストの妥当性 — ◎
- Go: handler 10 ケース（List 4 / Get 2 / Update 2 / Rush 2）+ service 9 ケース（Update 5 / Rush 4）+ 乖離ガード `TestMoveListItemSharedFieldsMatchModelMove`。部分更新・enum 違反拒否・total 手動値・raw_data notes_tool・対象外 400・重複 409 をいずれも網羅。
- Vitest: 7 ケース（total 編集で変更フィールドのみ PATCH / is_aerial トグル送信 / 変更なし時非送信 / ラッシュ活性条件 normal・throw・空中切替 / 要確認強調）。
- E2E: 編集→保存→`GET /api/moves` 反映→ラッシュ版生成→グリッド出現（`web/e2e/moves-edit.spec.ts`、seed 非依存 self-contained）。
- §4.8 乖離ガードは MoveListItem の全共有フィールドが model.Move に同名・同型で存在することを reflect で検証（投影方向として正しい）。

### §5 設計意図 — ○（alias 以外）
- 手動補正は寛容（要確認のまま保存可）、ラッシュ規則はサーバ強制、GET 読取路不変・乖離ガードで代替、取込プレビューと編集グリッドは別系統、いずれも意図に沿う。
- alias 自動生成のみ意図（§1.3「将来」）を先取りしている。

### §7 既存挙動の温存 — ◎
- `GET /api/moves`（`listByCharacterSQL`・`MoveResponse`・`toMoveResponse`）は M9-03 で不変。moves スキーマへの列追加なし（original_move_id / is_aerial は既存列）。List ハンドラは従来どおり repo 直叩き（svc 非経由）。

## 設計準拠性以外の指摘事項

- **コーディング規約**: JSON タグ・DTO 型は camelCase 統一（`dto.go` / `types.ts`）。エラー wrap（`%w`）徹底。enum 定数はバックエンド `model.MoveCategory*` とフロント `MoveCategory` union / `MOVE_CATEGORY_*` が同期。`console.log`/`fmt.Println` の混入なし。godoc コメントも公開シンボルに付与済み。規約準拠は良好。
- **フロント型分岐コメント**: `types.ts` 冒頭に「Move（一覧）と MoveDetail（編集）は別 interface、列追加時は両方へ」のコメントあり（CLAUDE.md §4 準拠）。
- **ドキュメント（要確認・低）**: main との diff に `docs/design/02-architecture.md` / `03-data-model.md` / `05-screen-design.md` の変更が含まれる。CLAUDE.md §8 / チェックリスト §8 では DES 本体の追記は設計担当が CHANGE-031/032 経由で行い、製造担当は直接編集しない方針。これらが設計担当コミット（`0408726`/`42f2e59` の docs コミット）由来か、製造工程での直接編集かを確認されたい（製造直接編集なら是正対象）。

## 推奨修正（優先度別）

### 高（M9 完了前に修正必須 / 開発者確認）
1. **ラッシュ版生成の `preset_aliases` 自動書込はスコープ外**（`internal/repository/move/rush.go:38-43, 71-92` の `sourceAliasSQL` / `rushAliasSuffix` / `UpsertOfficialJaAlias` 呼び出し）。
   - 根拠: 指示書 §1.3「ラッシュ版エイリアスの自動生成ルール（`DR>` 前置等）＝将来」、§4.4「preset_aliases 書込経路は本 MVP では作らない」、チェックリスト §1.3「preset_aliases 書込経路を作っていないこと」。DES-003 §3.3 もエイリアス自動生成は「のような自動生成ルール」と将来の例示に留め、確定仕様化していない。CHANGE-031/032 に当該機能の承認記載なし。
   - 影響: 組み込みプリセット official_ja_move（DES-004 §2.1 上 read-only 想定）へ `元技名+"(ラッシュ)"` を書き込んでおり、name_ja「表示のみ・編集スコープ外」という Plan Mode-Q3 決定と相反する。CLAUDE.md §10「設計書に記載のない機能を勝手に追加しない」にも該当。
   - 推奨: 当該エイリアス派生ブロック（`rush.go:82-92`）と `sourceAliasSQL`/`rushAliasSuffix` を削除し、ラッシュ版 move 生成（`moves` 行のみ）に限定する。もしラッシュ版の表示名欠落が UX 上問題で実装意図が妥当と判断する場合は、独自判断で残さず開発者承認 + CHANGE 起票を経ること。

### 中（M10 着手と並行可）
2. **ラッシュ活性判定の未保存 is_aerial デシンク**（`MoveEditGrid.tsx:82` の `isRushEligible({ ..., isAerial })` がローカル未保存トグル値を参照）。指示書 §4.3「トグル後にラッシュ可否が変わる点を UI 反映」の意図には沿うが、is_aerial をトグルしただけで保存前にラッシュ版ボタンを押すと、サーバは永続値（旧 is_aerial）で判定し 400 になり得る。未保存トグル中はラッシュボタンを無効化する、または保存を促す等の整合を検討。

### 低（将来対応）
3. **rush コード衝突の 409 化漏れ（エッジ）**: `InsertRushVariant` の事前チェックは `category='rush_variant' AND original_move_id=?` のみ。万一 rush_variant 以外の move が既に `code=rush_<元技code>` を占有していると、事前チェックを素通りして `UNIQUE(character_id, code)` 違反が raw error→500 になる。通常運用では発生しないが、`code` 重複も事前検出すると堅い。
4. **properties 編集の入力ガイド不足**: フリーテキスト入力で許可値（high/mid/low/throw/projectile/air_projectile）の提示がなく、誤入力は保存時 400 で初めて判明。select 化等の UX 改善余地（仕様要求外）。
5. **共通ヘッダーナビ未追加**: 編集グリッドへの導線は取込画面リンクのみ。Header の NAV_LINKS には未登録（チェックリスト §3「共通ナビ整合」）。導線が任意（§2.2）のため必須ではないが、独立アクセス性を上げるなら追加検討。

## 良かった点

- Plan Mode 5 決定（画面構成 / PATCH+GET 形・楽観ロックなし / rush 409+既存 id / notes_tool のみ / 寛容検証）を取り違えなく実装に落とし込めている。特に rush 重複は INSERT 前 SELECT で先回りし、生 UNIQUE エラーを 409 に確実に変換できている。
- §4.8 乖離ガードを reflect ベースの単体テストで実装し、「列追加時に両構造体を同期せよ」というコメントと併せて将来の同期漏れを機械検出できる形にしているのは良い。MoveDetail（model.Move 埋め込み + NameJa）と MoveListItem の役割分離も明快。
- narrow 一覧（render 時）とフル GET（行展開時のみ）を分け、N+1 を避ける編集グリッド設計が指示書 §4.1 の意図に忠実。raw_data 編集時に未知キーを spread 保持し消失させない配慮も良い。
- camelCase 統一・enum 定数同期・エラー wrap・godoc など規約遵守が徹底しており、`GET /api/moves` 契約も厳密に温存されている。

## 制約事項

- 本レビューはコード上で判定可能な範囲のみを対象とする。実機動作確認・大量行のパフォーマンス・レスポンシブ/視覚確認・`make e2e` 実走（Playwright）は別途実施が必要。
- 上記「中・低」のうちデシンク（2）・コード衝突（3）は静的読解に基づく潜在指摘であり、実機再現確認は未実施。
- 不明: `docs/design/*` の変更が設計担当コミット由来か製造直接編集かは git 履歴のみでは断定できず、開発者確認を要する（§設計準拠性以外・低）。
