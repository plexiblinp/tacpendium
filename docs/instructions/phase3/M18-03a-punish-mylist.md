# 指示書 M18-03a: 確定反撃マイリスト（使う画面）＋隠したもの管理

| 項目 | 内容 |
|------|------|
| 文書ID | M18-03a |
| バージョン | **v1.0.2**（2026-07-26・**as-built 反映＝実装完了後の確定版**。第3セクション新設／curation 登録導線の撤去／レシピ表示／Header degrade／API レスポンス構造を反映。**本版は実装済の内容を正典化したものであり、新たな実装要求は含まない**） |
| 作成者 | M18 指示書担当（playbook §15.6・委任 v1.2.0 §6＝設計から委任） |
| サブ | M18-03a（M18-01／M18-02 完了済に依存・**M18-03b の前提**） |
| 推奨モデル | 製造 = **Opus 4.8 ＋ Plan Mode 必須**（未使用テーブルの初配線・新画面・既存走査画面の改修）。レビュー = Sonnet 4.6 |
| 配置（完成品） | `docs/instructions/phase3/M18-03a-punish-mylist.md` |
| 前提正本 | REQ-001 v2.17.0／DES-002 **v1.36.0**／DES-003 **v1.34.0**／DES-004 **v1.15.0**／DES-005 **v2.50.0**／DES-006 **v1.21.0**／SUPP-001 v1.27.0 |
| 上位文書 | `M18-overview.md` v0.1.9 §2.1-g／`M18-03-design-outline.md` v0.1.0 §2〜§4 |
| CHANGE／マイグレ | **CHANGE ＝ CHANGE-088（中央払い出し済 2026-07-26）**／**マイグレ ＝ 不要・0 本**（新表・新列なし。使う 3 表はすべて M18-01 で作成済み） |

---

## 更新履歴

- **v1.0.2（2026-07-26）**: **as-built 反映**（実装・レビュー・開発者実機確認の完了後）。(1) §4.4-5 「区分を判定できない反撃」セクションを新設＝指示書 v1.0.1 の穴を製造が検出し開発者裁定で確定した仕様。(2) §4.4-3 から curation の登録導線を撤去（開発者裁定）し、**登録導線は M18-03b へ繰越**。(3) §4.4-4 にフィルタ規則表を追加し粒度説明の要求を緩和。(4) §4.5 に「curation・タブのいずれでも絞らない」と**到達不能である事実**を追記。(5) §4.6 にレスポンス構造と query 名の注記。(6) §2.1 に `Header.tsx` の degrade と `model.ExtractDefaultRecipe` を追加。(7) §5 に第3セクションのテストを追加。(8) §10 の事後確認 1 の結論を差し替え。**新たな実装要求は含まない**。
- **v1.0.1（2026-07-26）**: **中央が CHANGE 番号を払い出し＝CHANGE-088**（着手前ゲート＝通知書＋registry まで。DES 本体反映は実装完了後＝M17-D10 の二段分離）。メタ表・§2.1・§7.5 に確定値を反映。**要件・仕様の変更なし**（番号の確定のみ）。**製造投入可**。
- v1.0.0（2026-07-26）: 初版。確定反撃マイリスト（画面21）・`combo_punish_curations` の全レイヤ新設・`combo_punish_prunings` 解除の FE 接続・自動判定できない相手技への既登録表示を実装手順化。開発者確認事項 4（タブ切替）を反映。

---

## 1. 背景と目的

### 1.1 背景

M18-02 で「探す」画面（画面20・`/punish/search`）が完成し、ユーザーは**相手技ごとに反撃候補を検証して `combo_punishes` へ採用**できるようになった。しかし採用したものを**見返す画面が無い**。また DES-005 v2.50.0 §5.20 は「既知の限界（M18-03 で対応予定）」として次の 2 点を明記している。

1. **pruning の解除・再表示 UI が無い**。解除 API（`DELETE /api/combo-punish-prunings`）は実装済みだが FE 導線が無く、誤操作で隠すと DB を触らない限り戻せない（**片道操作**）。
2. **「自動判定できない相手技」に紐づく既登録の確定反撃が見返せない**。当該相手技には始動技→コンボのツリーが出ないため、`combo_punishes` に登録済みでも画面に現れない。

さらに **`M18-RESEARCH-02-report` D-6 の実測**で、次が判明している。**本サブの実装量を決める最重要の事実**である。

| 表 | BE | FE |
|---|---|---|
| `combo_punishes` | フル CRUD 稼働 | `useAddPunish` / `useRemovePunish` |
| `combo_punish_starters` | フル CRUD 稼働 | `useSetStarterVerdict` / `useDeleteStarterVerdict` |
| `combo_punish_prunings` | SELECT／INSERT／DELETE とも稼働 | **POST（`useAddPruning`）のみ。DELETE を呼ぶフックが無い** |
| **`combo_punish_curations`** | **repository／service／api の全レイヤで参照 0 件** | **0 件** |

`combo_punish_curations` は M18-01（マイグレ 000037・CHANGE-079）で**表だけが作られ、以後どこからも触られていない**。**本サブがこの表の初めての消費者**になる。

### 1.2 目的（本サブ完了時の状態）

- **画面21「確定反撃マイリスト」**（`/punish/list`）で、採用済みの確定反撃を**相手技 → コンボの 2 階層**で見返せる。
- **`combo_punish_curations` が BE・FE とも配線され**、マイリストで「使わない反撃」を隠せる。
- **「隠したもの管理」タブ**で、pruning（確定反撃のない技）と curation（使わない反撃）の**両方を一覧・解除**できる。片道操作が残らない。
- 探す画面の「自動判定できない相手技」の配下に、**登録済みの確定反撃が表示される**。
- 既存の探す画面（画面20）の挙動・既存のコンボ機能が**回帰していない**。

### 1.3 スコープ外（M18-03b・本サブで前倒し実装しない）

- **materialize（生成規則・ダメージ加算・出自の保存）**。`combos.materialized_from_combo_id` への読み書き、`model.Combo` / `InsertCombo` / `ComboResponse` への配線は**すべて M18-03b**。本サブでは**生成元バッジを出さない**。
- **FR301 重複防止**（生成前探索）。
- **手動入力導線の拡張**（ジャストパリィ始動の `hit_type` プリフィル）。
- **案C**（`neutral_jumping_heavy_kick` の抽出述語緩和）。
- **export 整合**（E-17 の実出力目視）。
- **新テーブル・新列の追加**。要と判明したら**着手前に中央経由で開発者の個別承認**を取る（委任 §6）。勝手に足さない。

---

## 2. 成果物

### 2.1 作成/修正するファイル

| # | 対象 | 種別 | 備考 |
|---|------|------|------|
| 1 | `internal/repository/punish/`（`queries.go`／`crud.go`／`scan.go`／`repository.go`） | 修正 | `combo_punish_curations` の SELECT／INSERT／DELETE を新設。マイリスト取得クエリを新設 |
| 2 | `internal/service/punishlist/`（新パッケージ） | 新規 | マイリストの組み立て（走査ではなく取得。`punishfinder` とは別責務） |
| 3 | `internal/service/punishfinder/service.go` | 修正 | 「自動判定できない相手技」に既登録 `combo_punishes` を載せる（§4.5） |
| 4 | `internal/api/punish/`（`handler.go`／`routes.go`／`dto.go`） | 修正 | §4.6 の endpoint を追加 |
| 5 | `web/src/features/punish/api.ts`／`types.ts` | 修正 | マイリスト・curation・pruning 解除のフック追加 |
| 6 | `web/src/features/punish/components/PunishList.tsx` | 新規 | 2 階層ツリー本体 |
| 7 | `web/src/features/punish/components/HiddenItemsPanel.tsx` | 新規 | 「隠したもの管理」タブ |
| 8 | `web/src/features/punish/components/PunishTree.tsx` | 修正 | §4.5 の表示追加 |
| 9 | `web/src/pages/PunishListPage.tsx` | 新規 | 画面21 のページ |
| 10 | `web/src/router.tsx` | 修正 | `/punish/list` を追加 |
| 11 | `web/src/components/Header.tsx` | 修正 | `NAV_LINKS` に「確定反撃マイリスト」を追加（M18-02 が「確定反撃サーチ」を足した実装形に倣う。実装形は §3.3-4 で実査）。**＋ デスクトップ nav に `min-w-0 overflow-x-auto whitespace-nowrap` を追加**（v1.0.2 追記＝§2.3 参照） |
| 12 | `internal/model/`（`ExtractDefaultRecipe` 新設） | 修正 | **v1.0.2 追記**。既定プリセットのレシピ表示文字列を `combos.recipe_cache` から抽出する共通関数。画面20・21 のコンボ行にレシピを 1 行表示するため（開発者フィードバック）。**`model.Combo` の構造体定義は不変** |

> **パスは実配置に合わせる**。上表は code-facts と RESEARCH-02 D-1 に基づく想定であり、**実配置と食い違ったら実配置を正とする**（§3.3 で実査）。
>
> **CHANGE-088（中央払い出し済 2026-07-26）**。着手前ゲート＝**通知書＋registry まで**であり、**DES 本体の反映は実装完了後に中央が三点セットで行う**（M17-D10）。製造は **DES 本体を直接編集しない**。
>
> **マイグレは消費しない（0 本）**。使う 3 表（`combo_punishes`／`combo_punish_prunings`／`combo_punish_curations`）はすべて M18-01 で作成済み（000036／000037）。**新規マイグレを作らないこと**。作りたくなったらそれは新スキーマの追加であり、§1.3 のとおり中央経由の個別承認が要る。**`ls migrations/` の末尾が 000041 であることを §3.3 の Plan Mode で確認**し、新規ファイルを追加しないまま進む。

### 2.2 変更しないもの

- **既存マイグレ（000001〜000041）を一切改変しない**。新規マイグレも作らない。
- **`internal/seedgen` を改変しない**（golden green を維持）。
- **`DuplicateKey`（6 項）・`CalcRecipeHash`・`RecomputeComboCache`**。本サブは `combos` の同一性に触れない。
- **`model.Combo` の構造体定義**（`materialized_from_combo_id` の配線は M18-03b）。
- **`combos` の INSERT 列（22 列）**。
- **`ComboEditor` の Props 契約**（`mode`／`initial`／`initialCharacterId`）と `location.state` のキー（`punishReturn`／`punishContext`）。
- **探す画面（画面20）の既存操作**：始動技の採否トグル・pruning 登録・note 入力欄 2 系統・「前提と限界」ヒント・新規登録導線・3 レーンの判定式・相手技の除外規則。§4.5 の追加以外は触らない。
- **既存 3 表の DDL**。

### 2.3 例外条項（**v1.0.2 で追加＝as-built**）

**`web/src/components/Header.tsx` のデスクトップ nav に 1 クラス文字列を追加した**（`min-w-0 overflow-x-auto whitespace-nowrap`）。共有コンポーネントへの変更であり本来スコープ外だが、**§2.1-11 のナビ 1 行追加が全画面のクリックを壊したため**、放置する選択肢が無かった。

- **事象**：nav が **13 本目で 1280px 幅に収まらなくなり、はみ出した nav が本文を覆って全画面のクリックが通らなくなった**（既存 E2E が 15 本失敗）。nav リンクを一時的に外すと全 green に戻ることで因果を確定。
- **対処**：はみ出しを nav 内の横スクロールに閉じ込める degrade。収まる幅では見た目は従来どおり。
- **承認**：開発者が実機確認のうえ **2026-07-26 に承認済み**。
- **残る課題**：**グローバルナビの項目数に事実上の上限がある**という制約が顕在化した。超過時の情報設計（カテゴリ化・ドロワー常用化等）は M18 のスコープ外として中央へ起票。**M18-03b で画面を増やさない**（nav 14 本目を作らない）。

> **教訓（M18 lessons-learned へ）**：共有コンポーネントへの追加は、機能的な依存だけでなく**レイアウトの容量**も E-14 の突合対象になる。「1 行のナビ追加が全画面のクリックを壊す」という因果は、本指示書の突合表では捕捉できなかった。

---

## 3. 前提条件

> 文書ID ⇄ 実パスの正は `docs/handover/docs-map.md`（自動生成）。

### 3.1 必読

- **`M18-03-design-outline.md` v0.1.0** §0.2（RESEARCH-02 の事実 8 点）・§2（マイリスト）・§3（隠したもの管理）・§4（既登録表示）。
- **`M18-RESEARCH-02-report.md`** §D-1（M18-02 資産の実ファイル・行数）・**§D-6（4 表の CRUD 状況）**・§D-5（queryKey と invalidate 元）。
- **DES-003 v1.34.0 §3.15**（`combo_punishes`・**`guard_type` を持たず `hit_type` で判別**）・**§3.16**（`combo_punish_prunings`・マッチアップ単位・コンボ非依存）・**§3.17**（`combo_punish_curations`・個別コンボ単位・keep 側と対称）・**§3.18**（`combo_punish_starters`＝**探す画面の作業状態**。**採用の正は §3.15**。使う画面は `combo_punishes` だけを引く）。
- **DES-005 v2.50.0 §2**（画面一覧）・**§5.20**（探す画面の as-built・レーン表・**既知の限界 1〜3**）・§5.4（ツリー UI イディオム・▶/▼・空状態 CTA）。
- **DES-002 v1.36.0 §4.2**（endpoint の正典節は **§4.2**。§7 ではない）・**「規則は BE に一元化し FE は引くだけ」**の先例（`GET /api/punish-finder`・`GET /api/characters/{id}/command-index`）・**DELETE はキー項目をボディで受ける**（M18-02 で確立した実装形）。
- retrospective-digest（**E-14**／E-15／E-16／E-18／**E-20**／**E-21**／E-22／E-24）・`M18-01-lessons-learned.md` **L-1**（「既存と同型」と書くなら実機序を実コードで 1 回引く）・**L-7**（内部値と表示ラベルを分離して記述する）。
- playbook §4.15（裁量項目の下流を数字で固定しない）・§5.4.1（出力を切らず件数を数える）。
- CLAUDE.md §10.X（ブラウザストレージの許容範囲）。

### 3.2 参照不要

M18-03b（materialize・FR301・案C・export）／M19（セットプレイ自動提案）の設計。**M19-01 の資産（`internal/service/setplay/`・`web/src/features/setplay/`）には触れない**。

### 3.3 着手前の確認（**Plan Mode 必須**・出力を切らず件数を数える＝§5.4.1）

1. **`combo_punish_curations` が本当に未使用か**を自分で引く（**L-1**）。`grep -rn "combo_punish_curations\|ComboPunishCuration" internal/ web/src/ migrations/` を**出力を切らずに**実行し、ヒットが**マイグレ 000037 とそのマイグレテストのみ**であることを確認する。**もし repository／service／api にヒットがあれば、本指示書の §4.2 は「新設」ではなく「拡張」になるため、Plan で差分を提示してから着手する**。
2. **`combo_punish_curations` の実 DDL** を `migrations/000037_*.up.sql` で確認し、DES-003 §3.17 の記述（列・`UNIQUE(combo_id, opponent_move_id)`・`INDEX(opponent_move_id)`・`ON DELETE CASCADE`・timestamps は `TEXT`）と**一致すること**を実 SQL で確かめる。不一致なら実 DDL を正とし、Plan で報告する。
3. **`combo_punishes` に紐づいたまま論理削除されたコンボの件数**を実測する。
   ```sql
   SELECT COUNT(*) FROM combo_punishes cp
   JOIN combos c ON c.id = cp.combo_id
   WHERE c.deleted_at IS NOT NULL;
   ```
   **件数を Plan に出す**（0 件でも報告する）。§4.3 の除外規則の根拠になる。
4. **`Header.tsx` の `NAV_LINKS` の実装形**を view する。M18-02 が「確定反撃サーチ」を追加した箇所（デスクトップ／モバイルドロワー両対応）を確認し、**同じ形で 1 行足す**（新しい流儀を作らない）。
5. **queryKey の実体**：`web/src/features/punish/api.ts` の `PUNISH_FINDER_KEY` と `useInvalidatePunishFinder()`（RESEARCH-02 D-5 によれば 5 つの mutation が共通ヘルパー経由）を view し、**本サブの新規 mutation も同じヘルパーに相乗りできるか**を確認する。マイリスト用の queryKey を新設する場合、**既存ヘルパーを拡張するか別ヘルパーを足すかを Plan で提示**する。
6. **コンボ表示に必要な JOIN**：マイリストのコンボ行に出す項目（名称・始動技・ダメージ・手数・`hit_type`）を、**M18-02 の `internal/repository/punish/scan.go`（151 行）と `queries.go`（81 行）が既にどう解決しているか**を view し、**同じ解決経路を再利用する**（始動技コードの解決を二度実装しない）。
7. **`PunishTree.tsx`（438 行）の構造**：「自動判定できない相手技」セクションの描画箇所を特定し、§4.5 の追加をどこに差し込むかを Plan で提示する。**既存の採否トグル・pruning ボタン・note 入力欄と干渉しないこと**。

---

## 4. 詳細仕様

### 4.1 用語と役割分担（**最初に固定する**）

本サブで扱う 3 表は**目的も粒度も異なる**。混同すると設計が崩れるため、指示書内で次のとおり固定する。

| 表 | 粒度 | 意味 | どの画面が使うか |
|---|---|---|---|
| `combo_punishes` | コンボ × 相手技 | **採用の正**。「この相手技への確定反撃としてこのコンボを使う」 | 探す（登録）／**使う（母集合）** |
| `combo_punish_prunings` | 自キャラ × 相手技 | **物理的に届かない**。マッチアップの事実でコンボ非依存 | **探す（候補から刈る）**／使う（隠したもの管理で一覧・解除のみ） |
| `combo_punish_curations` | コンボ × 相手技 | **届くが使わない**。そのコンボをマイリストに出さない | **使う（表示制御）** |

**重要な帰結を 2 つ、実装前に確定させる。**

- **マイリストは pruning を無視する。** pruning は「探す」画面の作業効率のための刈り込みであり、**採用済みの反撃を隠す権限を持たない**。pruning された相手技に `combo_punishes` があれば、マイリストには**出す**。隠したもの管理では pruning も一覧するが、それは「解除の導線を提供するため」であって表示制御ではない。
- **curation は孤児にしない。** curation は「`combo_punishes` にある組を隠す」指定なので、`combo_punishes` の行が無い組に curation だけが残る状態は意味を持たない。したがって **`combo_punishes` を解除（DELETE）するとき、同一キー（`combo_id`, `opponent_move_id`）の curation も同一トランザクションで削除する**（§4.4）。

### 4.2 `combo_punish_curations` の配線（**本表の初めての消費者**）

DES-003 §3.17 の定義に従い、repository → service → handler → routes → FE を新設する。**M18-02 が `combo_punish_starters`／`combo_punish_prunings` で採った実装形をそのまま踏襲する**（§3.3-1／-6 で実機序を引いてから書くこと＝L-1）。

- **repository**：`combo_punish_curations` の SELECT（自キャラ配下の全件）／INSERT／DELETE。**DELETE はサロゲート id ではなく `UNIQUE(combo_id, opponent_move_id)` で指定**（M18-02 の実装形）。
- **UNIQUE 重複**：同一キーの二重 INSERT は弾く。既存の pruning／starters の重複時の返し方に**合わせる**（実機序は §3.3-1 で確認）。
- **`note`**：DES-003 §3.17 の `note`（NULL 可）を使い、**「隠す理由」の入力欄**を FE に置く。探す画面の pruning note（「隠す理由(任意)」）と**同じラベル流儀**にする（L-7＝内部値と表示ラベルを分離して記述）。

### 4.3 マイリストの取得仕様（BE 一元化）

**母集合＝`combo_punishes`**（DES-003 §3.18 の明記に従う。`materialized_from_combo_id` では絞らない）。

| 段 | 内容 |
|---|---|
| 1 | `combo_punishes` を自キャラ（`combo_id → combos.character_id`）で絞る |
| 2 | **`combos.deleted_at IS NULL` で絞る**（論理削除済みコンボは出さない。件数は §3.3-3 で実測済み） |
| 3 | **`hit_type` で 3 分岐**（§4.4-1・§4.4-5）。タブ 2 値（`punish_counter`／`just_parry_punish_counter`）と、**それ以外（`normal`／`counter`／NULL）＝第3セクション**へ振り分ける。**SQL を 2 回引かずに 1 回の取得結果からサービス層で分岐する**（2 回引くと「どちらのタブにも出ない採用」を数え漏らす） |
| 4 | **curation に一致する組を除外**（表示制御） |
| 5 | 相手技（`opponent_move_id → moves`）でグルーピングし、2 階層に組む |

- **相手キャラでの絞り込み**：URL query `opp` を任意で受ける。未指定なら自キャラの `combo_punishes` を全相手キャラ分まとめて出す。
- **走査は一切しない**。フレーム判定・レーン判定・除外規則 a〜h は本画面に**存在しない**。マイリストは**保存済みの事実を引くだけ**である。この非対称（探す＝走査／使う＝取得）を実装でも保つため、**`punishfinder` に相乗りせず別サービス（`internal/service/punishlist/`）に置く**。
- **未 seed・不存在の有効 ID は 200 ＋空**（M18-02 で確立した「壊れない」優先の流儀）。404／500 にしない。

### 4.4 画面21「確定反撃マイリスト」（DES-005 §2 に**画面21**を追加）

route＝`/punish/list`。Header ナビに導線「確定反撃マイリスト」。**画面5「マイコンボ」とは別系統**（タグ絞り込みのコンボ一覧ビューであり本画面と無関係）。

**1. タブ（開発者確定 2026-07-26）**

ガード／ジャストパリィは**タブ切替**とする。**既定＝ジャストパリィ**（探す画面と一貫）。内部の判別は紐づくコンボの `hit_type`（DES-003 §3.15）。

| タブ | 対象 `hit_type` | 表示ラベル |
|---|---|---|
| ガード | `punish_counter` | ガード |
| ジャストパリィ | `just_parry_punish_counter` | ジャストパリィ |

> **内部値と表示ラベルは分離して実装する**（L-7）。`hit_type` の 4 値リテラルを**新たに追加定義しない**。既存の `HIT_TYPE_LABELS`／`HIT_TYPE_LABEL_JA`（`web/src/constants/combo-list.ts`／`web/src/features/combo/labels.ts`）を**参照する**。RESEARCH-02 A-6 のとおり同じ 4 値が既に 3 箇所以上へリテラル散在しているため、**4 箇所目を作らない**。

**2. 2 階層ツリー**

```
確定反撃マイリスト（タブ: ガード / ジャストパリィ）
└── 相手技（相手キャラ名を併記）
      └── コンボ（始動技・ダメージ・手数・note・「使わないので隠す」）
```

- **第1階層＝相手技**。`combo_punishes` を `opponent_move_id` でグルーピング。
- **第2階層＝コンボ**。**始動技は行の属性表示にとどめ、階層を切らない**（探す画面の 3 階層と意図的に非対称）。
- **UI イディオムは DES-005 §5.4 の ▶/▼ に準拠**。展開のクリック領域は行ヘッダー全体（M18-02 が第2ラウンドで採った形に倣う）。
- **空状態**：0 件のとき「確定反撃サーチで採用するとここに出ます」と案内し、**`/punish/search` へのリンク**を置く（E-20 の 1 本動線を逆向きにも通す）。

**3. 操作**

| # | 操作 | 挙動 |
|---|------|------|
| 1 | 「確定反撃の採用を解除」 | `combo_punishes` を DELETE。**同一キーの curation も同一トランザクションで削除**（§4.1・孤児を作らない） |

> 操作 1 は探す画面の「確定反撃に採用済み(解除)」と**同じ結果**になる。**同じ DELETE endpoint を使う**（`DELETE /api/combo-punishes`）。二重実装しない。

> **【v1.0.2・重要な変更】curation の登録導線（「使わないので隠す」）は撤去された。**
> **開発者裁定（2026-07-26）**：「マイリスト上で隠せると変な事故になる」。**BE（表・API・マイリストからの除外ロジック）と「隠したもの管理」の解除導線はすべて温存**し、**UI の登録導線のみ外した**。
> **帰結**：`POST /api/combo-punish-curations` は通常操作では発火せず、§4.4-4 の「使わない反撃」セクションは**常に空**になる。したがって **M18-overview §2.1-g（curation で非採用を隠す）は本サブでは未達**である。
> **繰越先＝M18-03b**（M18 指示書担当の設計判断・2026-07-26）。§4.4-5 の第3セクションが materialize の入力キューである以上、**「変換する／変換せず使わない」の判断は 03b で同じ画面に並ぶ**。「使わない」の意思表示は変換導線の隣にあるのが自然で、開発者裁定の趣旨（マイリスト本体で隠せると事故）とも矛盾しない。**BE は完成しており、UI を戻せば即機能する。**

**4. 「隠したもの管理」タブ**

マイリストと同一画面の別タブに置く。**pruning と curation を粒度で明示的に分けて表示**する。

| セクション | 表 | 行の内容 | 解除 |
|---|---|---|---|
| 「確定反撃のない技」 | `combo_punish_prunings` | 相手技（相手キャラ名）・note | `DELETE /api/combo-punish-prunings`（**BE 実装済・FE 接続のみ**） |
| 「使わない反撃」 | `combo_punish_curations` | 相手技 ＋ コンボ・note | `DELETE /api/combo-punish-curations`（**本サブで新設**） |

- **粒度の違いを文言で伝える**：pruning は「この相手技には確定反撃がないとして、探す画面から隠したもの」、curation は「この反撃は使わないとして、マイリストから隠したもの」。同じ「隠す」でも意味が違うことをユーザーが誤解しないようにする。
  - **【v1.0.2】括弧書きの併記（「(コンボによらない)」「(このコンボだけ)」）は不自然として削除された**（開発者実機確認 2026-07-26）。**粒度は本文で伝える**形に緩和する。
- 解除後は当該行が一覧から消え、探す画面／マイリストに**再び現れる**。
- **【v1.0.2】フィルタ規則（as-built）**：

| 一覧 | `opp`（相手キャラ）で絞る | `guard`（タブ）で絞る | 論理削除済みコンボ |
|---|---|---|---|
| `hiddenPrunings` | **絞る** | **絞らない** | （コンボ非依存のため対象外） |
| `hiddenCurations` | **絞る** | **絞らない** | **除外する** |

  - `guard` で絞らない理由：pruning は区分（ガード／ジャストパリィ）に依らない事実であり、curation もタブで消えると**「隠したのに管理画面で見つからない」という新たな片道操作**を生むため。
  - `hiddenCurations` から論理削除済みコンボを除外する規則は v1.0.1 に無かった（§4.3-2 と扱いを揃える）。**`ON DELETE CASCADE` は物理削除にのみ効き、論理削除（`deleted_at`）では curation 行が残る**ため明示除外が要る。
- **【v1.0.2】現状「使わない反撃」セクションは常に空**（上記の登録導線撤去による）。空メッセージが正しく出ることを確認する。

**5. 「区分を判定できない反撃」セクション（**v1.0.2 新設・as-built**）**

**v1.0.1 の穴を製造が検出し、開発者裁定（2026-07-26）で確定した仕様。**

- **なぜ要るか**：探す画面の「確定反撃に採用」は `hit_type` を見ない（`PunishTree.tsx` の採用ボタンも、母集合の `combo.List(ListFilter{CharacterID, StarterMoveIDs})` も `hit_type` で絞らない）。したがって **`hit_type` が `normal`／`counter`／NULL のコンボが `combo_punishes` に入り得る**。§4.4-1 のタブ絞りを literal に実装すると、それらは**どちらのタブにも出ず黙って消える**。**M18 の「silent に消さない」思想に正面から反する。**
- **確定した 3 条件**：

| # | 条件 |
|---|---|
| 1 | **件数だけでなく展開して中身が見える**（折りたたみで相手技・コンボ・`hit_type` バッジ） |
| 2 | **理由と次のアクションを書く**（「ガード始動／ジャストパリィ始動のどちらか判定できない記録です。パニッシュカウンター版に変換すると、上の一覧に出ます。**変換機能は M18-03b で対応予定です。**」） |
| 3 | **3 つ目のタブにしない**。`hit_type=normal` は「ガードかジャストパリィか判定できない」＝**タブと同じ軸に並ぶものではない**。**両タブ共通で画面下部に 1 セクション** |

- **見出し**：**「区分を判定できない反撃(N 件)」**。「その他」は理由が伝わらないため不可。
- **ドメイン上の位置づけ**：このバケツは **M18-03b の materialize が処理すべき入力キュー**であり、**ゴミ箱ではない**。確定反撃は相手の硬直中に当てるため本来 PC 系であるべきで、そこを埋めるのが materialize である。
- **API**：`GET /api/punish-list` のレスポンスに **`unclassifiedNodes`**（`nodes` と同じ `MoveNode` 構造）を持つ。**`guard` に依らず内容は同一**。
- **実データ状況**：着手前実測（2026-07-26・dev DB・version 41）で `combo_punishes` は **0 行**＝当該バケツは **0 件**。**テストは合成データで記述する**（`normal`／`counter`／**NULL** の 3 パターン）。

### 4.5 自動判定できない相手技への既登録表示（**探す画面の改修**）

DES-005 §5.20 既知の限界 2 への対応。

> **【v1.0.2・重要】本機能は実装済だが、現状 UI からは到達できない。** 手動確認レーンの「手動で確定反撃を登録」ボタンは `/combos/new` へ遷移するが、**`punishContext` は保存後のトースト文言にしか使われておらず `combo_punishes` を作らない**（`ComboEditor.tsx`）。成立ツリーを持たない相手技に採用を作る導線が他に無いため、**本表示は現状 UI から発火しない**。したがって **DES-005 §5.20 の既知の限界 2 を「解消済み」と書いてはならない**（「表示側は実装済・登録導線は M18-03b」が正）。登録まで繋ぐのは M18-03b（`followup-backlog` §I-(c)）。**ボタン文言は指示書 §2.2 の凍結対象のため 03b まで現状維持**（開発者裁定 2026-07-26）。

- **「自動判定できない相手技」セクション**の各相手技の配下に、**その相手技に登録済みの `combo_punishes`（フレーム判定を経ないもの）を直接表示**する。
- **【v1.0.2】絞り込みを一切かけない**：**curation で絞らない**（curation は「使う」画面の表示制御であり、探す画面では登録済みの事実をそのまま見せる＝§4.1 の役割分担）。**`hit_type`（タブ）でも絞らない**（タブは走査の判定根拠であって手動登録された反撃の区分ではない。絞ると登録済みが黙って消える）。
- **【v1.0.2】型は成立ツリーと分ける**：`registeredCombos` は `adopted`（採否トグルの状態）を持たず「登録済みであること自体」しか意味しないため、成立ツリーの `ComboNode` と**同一型に畳まない**。
- **配信経路＝`GET /api/punish-finder` のレスポンスに含める**。理由は (1) 走査規則の BE 一元化（DES-002 §4.2）に揃う、(2) FE が 2 系統の API を混ぜない、(3) invalidate が既存の `[punish-finder]` 1 本で済む（RESEARCH-02 D-5）。**FE から別 API を叩いて合成しない**。
- **フレーム判定の結果として出しているのではない**ことが分かる表示にする（「登録済みの確定反撃」の見出しを置く）。**成立ツリーの候補と混ぜない**。
- **既存の除外規則は変更しない**。移動 system move 9 種 ＋ `is_aerial = 1` の完全除外（DES-005 §5.20）は不変。

### 4.6 API（**DES-002 §4.2** へ追加。CHANGE は中央払い出し）

| メソッド | パス | 内容 |
|---|---|---|
| GET | `/api/punish-list` | マイリストのツリー ＋ 隠したもの一覧（pruning／curation）を返す。query＝`self`（必須）・`opp`（任意）・`guard`（`block`／`just_parry`・既定 `just_parry`）。**副作用なし** |
| POST | `/api/combo-punish-curations` | curation 登録（`comboId`・`opponentMoveId`・`note`） |
| DELETE | `/api/combo-punish-curations` | curation 解除。**キー項目をボディで受ける**（`comboId`・`opponentMoveId`） |

- **`GET /api/punish-list` に隠したもの一覧を畳む**（別 GET を立てない）。FE が 2 系統の API を混ぜないため。
- **`GET /api/punish-finder` のレスポンスを拡張**（§4.5）。既存フィールドの意味・型は変えない（後方互換）。
- **`DELETE /api/combo-punishes` の挙動を拡張**：同一キーの curation も削除する（§4.1）。**シグネチャは不変**。

**【v1.0.2】`GET /api/punish-list` のレスポンス構造（as-built）**

```
{ selfCharacterId, opponentCharacterId?, guardType, hitType,
  nodes: [ MoveNode ],              // 現タブ（hit_type 一致）
  unclassifiedNodes: [ MoveNode ],  // §4.4-5。guard に依らず同一
  hiddenPrunings:  [ { opponentMoveId, code, nameJa?, opponentCharacterId, opponentCharacterNameJa, note? } ],
  hiddenCurations: [ { comboId, opponentMoveId, code, nameJa?, opponentCharacterId,
                       opponentCharacterNameJa, starterMoveCode?, starterMoveNameJa?, note? } ] }

MoveNode  = { moveId, code, nameJa?, opponentCharacterId, opponentCharacterNameJa, combos: [ ComboNode ] }
ComboNode = { comboId, damage?, stepCount, hitType?, starterMoveId?, starterMoveCode?, starterMoveNameJa?, note?, recipe? }
```

- トップレベルの `hitType` は `guardType` に対応する `combos.hit_type` の実値。**FE が対応表を持たないための配慮**。
- `recipe` は既定プリセットのレシピ表示文字列（`combos.recipe_cache` から `model.ExtractDefaultRecipe` で抽出。**未生成時は行を出さない**＝空文字扱い）。`GET /api/punish-finder` 側の `ComboNode`／`RegisteredComboNode` にも同名で持つ。
- 空配列は `null` でなく `[]` でシリアライズする（既存 `Tree` と同じ流儀）。

> **【v1.0.2・記録】query 名が 2 流儀に割れている。** 既存 `GET /api/punish-finder` は `self_character_id`／`opponent_character_id`／`guard_type`（冗長形）だが、本 endpoint は本指示書 §4.6 の明示指定に従い `self`／`opp`／`guard`（短縮形）になった。**原因は指示書側（既存 endpoint の query 名を引かずに短縮形を指定した）であり、製造の責ではない。** 統一は破壊的変更になるため**現状維持**とし、**punish 系の新規 endpoint は冗長形に揃える方針**を DES-002 §4.2 に明記することを中央へ依頼済み（裁定待ち）。

---

## 5. テスト要件

### 5.1 BE（Go）

- **curation の CRUD**：INSERT／SELECT／DELETE。**UNIQUE(combo_id, opponent_move_id) の二重登録が弾かれる**。存在しないキーの DELETE が壊れない。
- **マイリスト取得**（§4.3 の 5 段を各 1 件以上）：
  - 論理削除済みコンボが**出ない**（§3.3-3 の実測件数を踏まえたケースを作る）。
  - curation に一致する組が**出ない**。
  - **pruning された相手技の採用済み反撃は出る**（§4.1 の帰結。**これを落とすと設計意図が壊れる**）。
  - `hit_type` タブで正しく絞られる（`punish_counter` タブに `just_parry_punish_counter` が混ざらない・逆も同様）。
  - **【v1.0.2】`hit_type` が `normal`／`counter`／**NULL** の採用が、どちらのタブにも出ず `unclassifiedNodes` に出る**（3 パターンとも。**NULL を落とさない**＝`combos.hit_type` は NULL 可）。
  - **未 seed・不存在の有効 ID で 200 ＋空**。
- **`DELETE /api/combo-punishes` で curation が連動削除される**（孤児が残らない）。トランザクションが途中失敗したとき両方とも残る（原子性）。
- **`GET /api/punish-finder` の拡張**：自動判定できない相手技に既登録 `combo_punishes` があるとき配下に出る／無いとき空。**成立ツリー側の内容が不変**であること。

### 5.2 FE

- `PunishList`：2 階層ツリーの展開／タブ切替／空状態の CTA。
- `HiddenItemsPanel`：pruning・curation の 2 セクションが**粒度ラベル付きで**出る／解除ボタンが対応する DELETE を呼ぶ。
- 解除後に対象が一覧から消える（invalidate が効いている）。
- `PunishTree`：§4.5 の追加表示。**既存の採否トグル・pruning ボタン・note 入力欄・「前提と限界」ヒントが回帰していない**。

### 5.3 E2E（`make e2e`・pin 一致環境で実行）

- **A（1 本動線・E-20）**：探す画面で確定反撃に採用 → マイリストに出る → **curation で隠す** → マイリストから消える → 「隠したもの管理」で解除 → マイリストに戻る。**【v1.0.2】curation の登録は UI 導線が撤去されたため API 経由で行う**（BE の表示制御と解除導線は温存されており検証内容は等価）。あわせてレシピ表示と、採用解除で curation が孤児にならないことも検証する。
- **B（片道操作の解消）**：探す画面で相手技を pruning で隠す → 探す画面から消える → マイリストの「隠したもの管理」で解除 → 探す画面に戻る。
- **【v1.0.2】C（第3セクション）**：`hit_type` が `normal` と NULL の採用が**どちらのタブにも出ず**、第3セクションに出る。**実データ 0 件のため合成データで組む**。
- **D（既存機能の非回帰・E-14）**：コンボ CRUD／一覧／比較／エクスポート／CSV import・export／`hit_type` 4 値の表示／探す画面の既存操作。
- **【v1.0.2】E2E 環境の既知の不安定さ**：並列 worker からの SQLite 書き込み競合により、フルスイートは**本サブと無関係に**実行ごと 1〜2 本 flaky/failed になる（本サブ以前から存在）。**追加 spec は `moves` へ一切書き込まない設計**にして決定論を確保する（飛び道具を相手技に使い、書き込みゼロで「自動判定できない相手技」に落とす）。**追加 spec の単独実行結果を完了報告に明記する**こと。

---

## 6. レビュー観点（別ファイル参照）

機械レビューは `M18-03a-review-checklist.md` に従う。

---

## 7. 完了条件（DoD）

### 7.1 機能要件
§1.2 の 5 点がすべて満たされている。

### 7.2 自己テスト結果
Go 全テスト green／FE テスト green／E2E は §5.3 の A・B・C。**pin 不一致環境で実行した場合はその旨と回避手段を完了報告に明記**する（M18-02 と同じ扱い）。

### 7.3 品質チェック
- **新規マイグレを作っていない**（§2.1 の注記）。
- **新テーブル・新列を追加していない**（委任 §6）。
- `DuplicateKey`／`CalcRecipeHash`／`RecomputeComboCache`／`model.Combo`／`combos` の INSERT 列が**不変**（golden green）。
- **`hit_type` の 4 値リテラルを新規に定義していない**（既存ラベル定義を参照している）。
- 走査規則を FE に二重実装していない。

### 7.4 ドキュメント
完了報告に **DES 反映要点**を書く（DES-002 §4.2＝新 endpoint 3 本＋既存 2 本の挙動追記／DES-005＝画面21 の新設・§2 画面一覧への追加・**「画面5 マイコンボとは別系統」の 1 行**・§5.20 既知の限界 1・2 の解消／DES-003 §3.17＝curation の初めての消費者が現れたこと）。**製造は DES 本体を直接編集しない**。CHANGE 起票・DES 反映は中央が行う。

### 7.5 完了報告
`docs/progress/phase3/M18-03a-completion-report.md`。**消費した CHANGE 番号＝CHANGE-088**（中央払い出し値）・**消費したマイグレ連番＝なし（0 本）**と、§3.3 の Plan Mode 実査結果（とくに **-1 の grep 結果**と **-3 の論理削除件数**）を実値で明記する。件数には「何を・どの単位で数えたか・基準時点」を併記する（E-16／E-18／E-24）。

---

## 8. 注意事項

### 8.1 推測で進めてはいけない

- **`combo_punish_curations` の実 DDL と既存 CRUD の有無**（§3.3-1／-2）。「M18-01 で作ったはず」で書き始めない（**L-1**）。
- **既存 punish 系の実装形**（DELETE のキー受け渡し・重複時の返し方・queryKey ヘルパー）。**引いてから同型を名乗る**。
- **新テーブル・新列**。要ると判断したら中央経由で個別承認（委任 §6）。
- **論理削除済みコンボの扱い**（§4.3-2）。§3.3-3 の実測を Plan に出してから実装する。

### 8.2 推測で進めてよい（その旨を明示すること）

- ツリー・タブ・パネルの**細部レイアウト**（DES-005 §5.4 のイディオムに準拠する範囲）。
- 新規ファイルの**配置と分割粒度**（既存 `web/src/features/punish/` の構成に合わせる範囲）。
- テストファイル名・テーブル駆動の書き方。

### 8.3 迷ったら

**実装を止めて Plan で報告する**。とくに §4.1 の 2 つの帰結（pruning はマイリストの表示を制御しない／curation を孤児にしない）に反する実装が自然に見えたときは、**設計意図の取り違えの可能性が高い**ので必ず確認すること。

---

## 9. 完了後の次ステップ

1. 完了報告 → M18 指示書担当が一次受け → **DES 反映要点**を中央へ（採番・改訂は中央）。
2. **M18-03b（materialize＋登録導線）の実装指示書を、本サブ完了後に作成する**。本サブが触った資産（`internal/service/punishfinder/`・`internal/repository/punish/`・`internal/api/punish/`・`web/src/features/punish/`）と M18-03b の改造対象を**突合して回帰ゲートを足す**（**E-14**）。
3. model-allocation に M18-03a／03b を追記。

---

## 10. 開発者への確認事項

開発者確認事項 1〜8 は **2026-07-26 に全て回答済み**（`M18-03-design-outline.md` の確認事項）。本サブに関わるのは **4（タブ切替）** で、§4.4-1 に反映済み。**本サブに未確定事項は無い。**

**【v1.0.2】事後確認 1 件は解決済み。ただし前提が覆りました。**

**論理削除済みコンボの扱い（結論＝マイリストに出さない・実装済み）**

- **v1.0.1 での私の根拠は誤りでした。** 「§3.3-3 の実測件数が 0 件なら実害はありません」と書きましたが、**その 0 件は母数（`combo_punishes`）が 0 行であることに由来しており、将来の実害を否定する根拠になっていません**。レビュー指摘により補強されました。
- **より重要な発見**：**論理削除は「ゴミ箱に入れた場合」だけで起きません。** 識別キー変更を伴う編集（PUT）は、旧コンボを `deleted_at` で論理削除して新コンボを INSERT します。そして **`combo_punishes`／`combo_punish_curations` を新コンボへ引き継ぐコードが存在しません**（`internal/service/combo/`・`internal/repository/combo/` に `combo_punish` 参照 0 件。`setups` は `SetupCarryOptions` で引き継がれるが punish は対象外）。
- **帰結**：**ユーザーがコンボを編集しただけで、その採用がマイリスト・隠したもの管理・探す画面の既登録表示のすべてから同時に消えます。** ゴミ箱にも「反撃として採用されていた」情報は残りません。**ゴミ箱経由より頻度の高い経路で silent-drop が起きます。**
- **本サブでは対処しません**（§2.2 が `model.Combo`・`combos` の INSERT 列・combo サービスを凍結しており、引き継ぎ実装は明確にスコープ外）。`followup-backlog.md` **§I-(b) `combo-punish-carryover-on-edit`** に起票済み。
- **処遇＝M18-03b で決める**。materialize は `combos` の INSERT 経路と `combo_punishes` を同一トランザクションで扱うため、**採用の引き継ぎ規則を設計する自然な場所**です。処遇候補は (1) 引き継ぎ実装 (2) 編集時の注記・警告 (3) 許容の明文化。

**【v1.0.2】M18-03b への申し送り（4 件）**

1. **第3セクション（§4.4-5）からの materialize 導線**。本サブは「変換は M18-03b で対応予定」と告知するのみで変換ボタンが無い。
2. **curation の登録導線の再設計**（§4.4-3 の注記）。materialize の変換導線の隣に置く。
3. **手動確認レーンの登録導線を `combo_punishes` まで繋ぐ**（§4.5 の注記）。`location.state` に `opponentMoveId` を足し、保存成功後に `POST /api/combo-punishes` を呼ぶ。**ボタン文言もこのとき整える**（03b まで現状維持＝開発者裁定）。
4. **生成元バッジ**。`ComboNode` にフィールドを追加するだけで済むよう余地は空けてある。
5. **`Header.tsx` に nav 14 本目を作らない**（§2.3）。増やす必要が出たら情報設計の見直しが先。

---

*以上、M18-03a 製造指示書 **v1.0.2（as-built 確定版）**。配置 `docs/instructions/phase3/M18-03a-punish-mylist.md`。採用済み確定反撃の「使う」画面を新設し、pruning の片道操作を解消した。curation の登録導線と手動確認レーンの登録導線は M18-03b へ繰越。新スキーマ・新マイグレとも消費なし（CHANGE-088）。*
