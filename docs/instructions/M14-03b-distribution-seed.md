# 指示書 M14-03b: 配布 seed データ投入（変換インフラ＋移動 system move 全キャラ seed＋段階投入・seed 契約 6 件）

| 項目 | 内容 |
|------|------|
| 指示書ID | M14-03b |
| バージョン | 2.3.0 |
| 推奨モデル | **Opus 4.8（Plan Mode 必須）**（配布 seed・SF6 ドメイン判断・dup スキャン・マイグレ順序制御を伴う重量サブ。model-allocation v1.30.0 既載） |
| Plan Mode | **必須**（§3.3 の 10 項目を実コード確認のうえ計画提示。§9.4 と対応） |
| 機械レビュー | 必須（別チェックリスト: `M14-03b-review-checklist.md` v2.0.0） |
| 並列性 | **単独（worktree 直列）**。M17 G-k が本サブの remap/索引モジュールに依存するため、本サブ完了までM17 command 系は着手しない |
| 依存 | M16 全工程完了（マイグレ 000023 まで）。**M14-RESEARCH-02 完了→開発者の第一波確定が本サブ着手の前提**（開発者決定 2026-07-09。§1.4） |
| 想定所要時間 | 240〜360 分（Plan Mode 込み。手入力データ受領状況に依存） |
| 作成者・作成日 | 設計担当 Claude（M14-03b/M17 期）/ 2026-07-09 |

> **文書ID ⇄ 実パスの正は `docs/handover/docs-map.md`（自動生成）**。

## 更新履歴

| 版 | 更新日 | 更新内容 |
|----|--------|----------|
| 1.0.0 | 2026-06-30 | 初版（M14-03 単一時）。 |
| 1.1.0 | 2026-06-30 | M14-03 a/b 分割。ローリング保留（M16 後推奨）。 |
| 2.0.0 | 2026-07-09 | **M16 完了（000023）を受けた全面改訂**。(1) 前提を現行実態へ更新: 次マイグレ 000024・HEAD moves seed は ryu 56 技のみ〔000017 で aki/jamie/guile 完全 DELETE 済〕・recovery backfill は M14-03a から本サブへ再集約〔followup-backlog §C 表 M14-03a-backfill 行〕・画面18 E2E 再有効化は M14-03a 完了済のため削除。(2) **M16 由来の seed 契約 6 件〔(a)〜(f)〕を §4/§7 に織り込み**（handover m16-to-m17 §3）。(3) **段階投入を正式採用**（開発者決定 2026-07-09）: 第一波キャラは M14-RESEARCH-02 の特性調査を受けて開発者が確定。(4) dup スキャン（remap 層 Go）・skip 掃き取り follow-up マイグレ・custom_states show_delta＋2 値取込・command 索引源の器を新規仕様化。 |
| 2.1.0 | 2026-07-09 | 開発者回答（§11 の 3 件）を確定反映: 手入力完成済みはテリー 1 キャラ＝変換系一次サンプル・ryu recovery は NULL 残置・第一波は着手前確定。 |
| 2.2.0 | 2026-07-09 | レポート 20260709（FR701/input-tool 実態）を反映: 入力 CSV の正＝moves-input-tool 19 列・total 検算・is_projectile 保全・ラッシュ版はツール生成行を投入。 |
| 2.3.0 | 2026-07-09 | **M14-RESEARCH-02 の新事実を反映**（開発者回答 A〜F）。(A) 移動 9 種が手入力 CSV にも混入〔H-2〕＝変換系で drop（(a) 静的 seed が唯一の投入元・drive_parry 通過）。(B) recovery 単一値・NULL 過多は充填待ち〔T15〕。(C) **ryu 再 seed（moves 差し替え＋combos クリア）を M14-03c へ分離**〔F-1〕。(D) command 索引は **派生技フラグ `is_derived`＝非派生のみ索引化**・1:N は id 最小タイブレーク・空欄/未知/条件残留行は索引非搭載〔別紙 command-index-resolution-design v2.1.0〕。(E) 第一波＝案 1（terry/guile/lily/ingrid/kimberly）＋友人完成分オプション。(F) **show_delta 4 キャラは custom_states 未定義**〔F-8・重要訂正〕＝UPDATE でなく状態定義の新規 INSERT（第一波は lily/kimberly）。判定源は入力ツール側＋人間。意図的除外の可視化を §5 に追加〔H-5〕。 |

---

## 1. 背景と目的

### 1.1 背景

M14-02 で公式データ取込（FR704）を本体から削除し、配布 DB は**開発者の手入力データを SQL マイグレ経路で同梱**する方針が確定した（CHANGE-055・DES-002 §4.2）。現行 HEAD の moves seed は **ryu 56 技のみ**（aki/jamie/guile は 000017 で完全 DELETE 済＝旧指示書 v1.1.0 の前提は失効）。characters・presets は投入済みだが、大半のキャラの moves・エイリアスが未投入であり、**全キャラ seed 充足が配布リリースの blocker**（followup-backlog §C-1）。

M16（データモデル拡充）の完了により、seed が満たすべき契約が収束した:

- **dash canonical＝方向別 system move**（`dash_forward`/`dash_back`。modifier.type dash は M16-04・マイグレ 000022 で廃止・移行済。DES-004 §2.1/§2.3）
- **taxonomy 原則 (a)/(b)/(c)**（DES-004 §2.2・DES-003 §3.5。移動＝1入力=1move の system move）
- **target_combo は人手付与・取込値信頼**（DES-003 §3.3・CHANGE-065）
- **custom_states int の 2 値構造 `{start_min,end}` ＋ `show_delta` DEF フラグ**（DES-003 §3.2・CHANGE-067）

本サブは、これらの契約を満たす変換インフラと seed マイグレ群を構築し、**第一波キャラ**（M14-RESEARCH-02 の調査を受けて開発者が確定）の実データを投入する。以降のキャラは同一インフラで後続マイグレとして追加する（段階投入・開発者決定 2026-07-09）。

### 1.2 目的

- **変換インフラ**（手入力 CSV → seed SQL。dev/build 時・本体ランタイム非経路）を現行スキーマ（マイグレ 000023 適用後）に対して構築する。remap・`total` 算出・`raw_data` 構築・`recovery` 設定・category 写像・`move_code` 正準採番・**target_combo passthrough〔(d)〕**・**custom_states 2 値 situation の取込写像〔(e) の一部〕**・**dup 検出〔(c)〕**を含む。
- **移動 system move（`forward`/`back`/`micro_forward`/`micro_back`/`dash_forward`/`dash_back`/`jump_neutral`/`jump_forward`/`jump_back`）＋ `preset_aliases` の対を全キャラへ seed する〔(a)〕**。これは手入力 CSV に依存しない（公式データに行が無い seed 管理 move＝SUPP-001 §3.3.2）ため、第一波に限らず**全キャラ分を本サブで投入**する。
- **skip 残行の掃き取り follow-up マイグレ〔(b)〕**: M16-04 で移行先 dash 不在により skip された modifier.type dash 行を、全キャラ dash seed 完了後に移行しきり skip をゼロにする。
- **第一波キャラの moves・エイリアス・recovery を seed する**。recovery backfill は M14-03a から本サブへ再集約済だが、**ryu の recovery 値は未受領のため本サブでは NULL 残置**（寛容方針のため機能影響なし・値受領後の後続マイグレで投入。開発者確定 2026-07-09）。第一波キャラの recovery は手入力 CSV の値をそのまま投入する。
- **custom_states の `show_delta` 付与（Mai/Lily/Juri/Kimberly）〔(e)〕**と、**Ingrid int①②③＋4 キャラの実データ E2E**。
- **command 索引源の器の確立〔(f)〕**: remap 層に「クリーンなトークン→キャラ別 move_code」索引を構築する IF を切り出し、M17 G-k（コントローラ入力解決）が同一モジュールを消費できる形にする（「二度作らない」。本サブでは取込側消費者のみ実装）。
- **配布 DB は clean マイグレ由来で構築**し、dup スキャン＋再測定を実施する。

### 1.3 このマイルストーンで作らないもの（スコープ外）

- **手入力データ自体の完成**＝開発者タスク（非同期）。数値の正しさは開発者が担保。
- **全キャラ moves の充足**＝段階投入。本サブの完了≠配布 blocker 解除（blocker 解除は全キャラ充足時点。§7.1 で区別）。ただし**移動 system move＋alias は例外的に全キャラ分を本サブで完了**する（CSV 非依存のため）。
- **モダン操作キャラ**＝フェーズ3 排除（M14-overview §2.1）。
- **取込（FR704）の再導入**＝禁止。変換系は dev/build 時の seed 生成であり、本体ランタイムに取込経路を復活させない。
- **moves スキーマ変更**＝M14-01 で確定済。本サブはデータ投入と索引 IF のみ。
- **コントローラ入力解決（M17 段階1/段階2）の消費者実装**＝M17。本サブは索引モジュールの器と取込側消費のみ〔(f)〕。
- **消費セマンティクスの一般構築**＝しない（architecture-patterns §9.1・B-1 据え置き。custom_states は表示用 2 値＋派生増減のみ）。

### 1.4 前提（ロスター非依存・段階投入）

- 配布対象はクラシック全 30 キャラ（**遅延で 31 になる可能性**あり）。インフラはロスター数非依存（キャラ追加で機構を変えず行追加で対応）に設計する。
- 第一波キャラの選定は M14-RESEARCH-02（公式データを保持する調査担当が特性を調査）→**開発者確定を経てから本サブへ着手する**（開発者決定 2026-07-09。確定後に入力メンバーで集中投入する運用のため、並行着手はしない）。手入力完成済みはテリー 1 キャラ（例外事項を複数抱えるため先行選定）で、テリーは第一波の既定メンバーかつ変換系の一次サンプル。

---

## 2. 成果物

### 2.1 作成/修正するファイル

| ファイル | 内容 |
|---|---|
| 変換系（例 `tools/seedgen/`。実配置は Plan Mode で確定・既存構成に合わせる） | 手入力 CSV → seed SQL 生成器（Go）。§4.1 |
| 索引モジュール（例 `internal/service/moveindex/` または seedgen 内共有パッケージ。Plan Mode で確定） | トークン→move_code 索引の構築 IF〔(f)〕。**非派生技のみ・id タイブレーク**。§4.8 |
| seed マイグレ 000024〜（連番・分割は Plan Mode で確定） | 移動 system move 全キャラ＋alias〔(a)〕／第一波キャラ moves＋alias＋recovery／custom_states 新規定義＋show_delta〔(e)・lily/kimberly〕。§4.2〜§4.4・§4.7 |
| skip 掃き取りマイグレ（**全キャラ dash seed マイグレより後の連番**） | modifier.type dash 残行の完全移行〔(b)〕。§4.5 |
| テスト fixture | `dbtest.Setup` 波及で件数前提・期待値を持つ既存テストを新 seed へ追従 |
| `web/e2e/combo-csv-io.spec.ts` | ken moves 件数断定（L64-67）の clean DB 整合（followup-backlog §C 表 combo-csv-io-ken 行。第一波に ken が入るなら確認のみ・入らないなら対象キャラ変更）。§4.9 |

### 2.2 変更しないもの（原則）

- moves・characters・combos ほか**全スキーマ**（本サブは INSERT/UPDATE のデータ投入と索引 IF のみ）。
- **既存マイグレ 000001〜000023**（編集禁止＝新規連番で追加）。
- 技編集（画面18・`service/move`・`GET/PATCH /api/moves`）・export/import（comboio）・recipe_hash 算出・dup 判定ロジック（`DuplicateKey`）本体。
- 本体ランタイムに取込経路を復活させない（FR704 降格の維持）。

### 2.3 例外条項

- **2.3.1 索引モジュールの配置**: 〔(f)〕の索引構築 IF を本体パッケージ配下（例 `internal/service/`）に新設することを許容する（M17 G-k が本体から消費するため）。ただし本サブでは**本体ランタイムから呼ばない**（seedgen からの利用のみ。エンドポイント・UI への露出は M17）。
- **2.3.2 それ以外のバックエンド変更は禁止**。code-facts と実コードに差があれば実コードを正とし、相違を完了報告に記録（playbook §4.1）。

---

## 3. 前提条件

> 文書ID ⇄ 実パスの正は `docs/handover/docs-map.md`（自動生成）。

### 3.1 必読ドキュメント

- **DES-003** §3.2（characters・custom_states・`show_delta`・per-combo 2 値構造）/ §3.3（moves 現行スキーマ・recovery・`total = startup + active − 1 + recovery`・raw_data〔notes/notes_tool〕・target_combo 運用）/ §3.5（combo_steps taxonomy）/ §3.9（preset_aliases・UNIQUE `(preset_id, move_id)`）。
- **DES-004** §2.1（move_code 正準採番・移動 system move 9 種の表・official_ja_move）/ §2.2（taxonomy 原則 (a)/(b)/(c)）/ §2.3（dash canonical 注記＝modifier.type の非技種別は `parry_drive_rush`/`cancel_drive_rush` のみ）。
- **DES-002** §4.2（配布 seed は SQL マイグレ経路・取込非依存）/ §7.5（**降格済・参照時の読み替え注意**＝§3.3 参照不要欄の注記）。
- **SUPP-001** §3.3.2（seed 管理 move とツール取込 move の境界＝純粋な入力ジャンプ・移動は公式 HTML に行が無く seed 管理）。
- **code-facts** §10（マイグレ一覧＝000023 まで・次 000024。characters seed = 000003/000009/000014・custom_states = 000015/000023）/ §8 model.Move・model.Character / §9 repository。
- **retrospective-digest** §1-A（実装状態は実査で確定）/ §5（破壊的/大量マイグレ・dbtest.Setup 波及・FK=OFF×明示 DELETE 非同居・掃き取り follow-up の紐づけ）。
- **followup-backlog** §C（C-1 配布完了定義／M14-03a-backfill 移設行／clean-DB blocker 行／combo-csv-io-ken 行）。
- **m16-to-m17-handover** §3（seed 契約 6 件の正）。
- **M14-RESEARCH-02-report**（第一波キャラ選定の入力。§4.3 着手時までに必要）。

### 3.2 前提事実（実ファイルで確認済・Plan Mode で再確認）

- 既存 moves seed = **ryu（000004）のみ**。aki/jamie/guile の moves・alias は 000017 で完全 DELETE 済。characters は 000003＋000009＋000014 で投入（全数は §3.3-1 で実査）。custom_states def は 000015（classic3）＋000023（Ingrid `show_delta`）。
- 次マイグレ連番 = **000024**（000023 が M16-07 で最新）。
- ryu 56 技の `recovery` は clean DB で **全 NULL**（dev DB の値 8 は E2E 残渣の偽値＝流用禁止。followup-backlog §C 表）。
- 移動 system move は ryu には seed 済（000004。DES-004 §2.1 の 9 種の実在は §3.3-1 で実査）。他キャラは未投入。
- M16-04（000022）は移行先 dash 不在の行を**無損失 skip**した。clean/user DB は ryu のみで skip 0 件＝現状無害だが、全キャラ dash seed 後に掃き取りが必要〔(b)〕。
- dup 件数 0 は **M16-RESEARCH-01 時点の実測値**であり、マイグレ 000022 に dup 検出は非搭載。全キャラ seed 後の再測定が必要〔(c)〕。

### 3.3 着手前の確認（Plan Mode 必須。§9.4 と対応）

以下 **11 項目**を Plan Mode で実コード確認のうえ計画提示すること。

1. **roster・seed 実査**: characters 全行（code・全数・30/31 のどこまで存在するか）、moves 投入済みキャラ（ryu のみのはず）、移動 system move 9 種の ryu での実在形（code・category・alias 対）、custom_states def の現状（classic3 の対象キャラ・Ingrid の `show_delta` 形）、preset_aliases の現状件数。**投入済み／未投入／def 未整備の網羅表を提示**。
2. **DB 同梱方式の再確認**: SQL マイグレ経路（既存 000004 と同方式・migrations embed・起動時適用）で確定（CHANGE-055）。`.db` embed へ逸脱しない。
3. **変換系の設計**: 入力＝19 列 seed CSV（§4.1）。テリー CSV 実物＋ツール側 `config/fr704-csv.yaml` で列契約を確認し、現行 moves スキーマ（000018 確定形）への remap を確定。**ラッシュ版行＝ツール生成行を投入（§11-1 で確定）**＝ryu 既存 seed のラッシュ表現と二重にならないことを実査で確認。`is_projectile`/`command`/`condition_*` の非投入・保全経路（§4.1）。**移動 system move 9 種の drop**（§4.1・(a) の静的 seed が唯一の投入元）と **`drive_parry` の通過**。**`is_derived`（派生技フラグ）列の実在確認**（テリー CSV に派生技区分があるか。無ければ保全先を確定＝§4.1）。**取込（削除済み）のロジックを復活させない**（新規最小実装）。
4. **target_combo passthrough〔(d)〕**: CSV 上の category=target_combo 行を remap が**改変せず通過保存**する経路の設計（CHANGE-065＝本体は取込値信頼・自動判定禁止）。
5. **移動 system move seed 方式〔(a)〕**: 9 種 × 全キャラの生成方式（CSV 非依存＝静的生成）。alias（official_ja_move プリセット・`(preset_id, move_id)`）を**対で**投入。ryu 既存行との衝突回避（既存 skip か存在チェック）。
6. **seed マイグレ構成・段階投入**: マイグレ分割（移動 move 全キャラ／第一波キャラ moves／show_delta UPDATE／掃き取り）と連番割付。**掃き取りマイグレは全キャラ dash seed マイグレより後**の連番。down 整合・冪等性。既存マイグレ非改変。
7. **recovery 投入方式**: 第一波キャラの recovery は CSV 値から投入（新規行のため total は生成時算出＝stored との衝突なし）。**ryu の recovery は NULL 残置**（値未受領・開発者確定 2026-07-09）＝ryu の total・フレーム値には一切触れない。将来の ryu recovery 投入時の total 整合方針（recovery のみ補填し total 非改変か・再算術か）だけは Plan Mode で方針提示し開発者承認を得る（後続マイグレの契約として完了報告に残す）。
8. **dup スキャン設計〔(c)〕**: remap 層（Go）での検出キー（同一キャラ内 move_code 衝突・alias_text 衝突・`(preset_id, move_id)` UNIQUE 違反の事前検出）と検出時動作（**seed SQL 生成を fail し一覧報告**。自動リネームしない）。seed 完了後の配布 DB 全域再測定（M16-RESEARCH-01 と同じ測定軸で比較可能に）。
9. **custom_states〔(e)・F-8 訂正〕**: Mai/Lily/Juri/Kimberly は **custom_states 未定義**（RESEARCH §A-補足4 で確認済＝定義済みは ryu/ingrid/c_viper のみ）。よって **state 定義の新規 INSERT** が要る。第一波コアで対象になるのは **lily/kimberly の 2 キャラ**。各 state の種別（level/stock/flag）・値域（min/max）・`show_delta`（方向可変=true／一方向=false・DES-003 §3.2）を **SF6 ドメイン判断で表提示→開発者承認**。取込側は 2 値 situation 構造 `{start_min,end}` を正とし、旧スカラは②(end) へ写像（後方互換・DES-003 §3.2）。
10. **索引器の派生技フラグ〔(f)・確定 D〕**: `is_derived` の保全先（moves 列 or 索引テーブル）・索引が非派生技のみを載せる構成・`Lookup`（id 最小タイブレーク）／`LookupAll`・索引非搭載行（command 空欄/未知トークン/条件残留）の記録方式を計画提示。
11. **dbtest 波及・E2E**: 新 seed マイグレの `dbtest.Setup` 全テスト波及（件数前提テストの追従範囲を列挙）。E2E: Ingrid int①②③・第一波の custom_states（lily/kimberly）の実データ E2E（M16-07 は単体/コンポーネント担保のみ）・`combo-csv-io.spec.ts` の ken 断定の扱い・`make e2e`（seed 非依存 self-contained）の非破壊確認。

---

## 4. 詳細仕様

### 4.1 変換インフラ（手入力 CSV → seed SQL）

- 入力: **moves-input-tool 出力の 19 列 seed CSV**（レポート 20260709 §2.2 の現行契約。旧 22 列は importer〔FR701・照合専用〕側であり seed 源でない）。列構成はテリー CSV 実物と `config/fr704-csv.yaml` で Plan Mode 確認（§3.3-3）。
- **列の行き先が無いもの**: `is_projectile`（本体 moves に列なし＝M18 G-b で追加予定）は**投入せず保全**（seed CSV 原本を repo に保持し M18 で回収）。`command`/`condition_ja`/`condition_en` も同様に列へは投入せず、**CSV 原本を索引源として保全**（§4.8・index-only）。`notes_tool` は raw_data へ（既定どおり）。`original_move_code` の扱い（ラッシュ版リンク）は下記ラッシュ判断に従属。
- **移動 system move 9 種の drop〔H-2・確定 A〕**: 手入力 CSV の `category=system` 行のうち**移動 9 種（`forward`〜`jump_back`）は変換系で除外（drop）**する。移動 move の投入元は §4.2 の全キャラ静的 seed が唯一（二重投入回避）。`drive_parry`（category=system の残り 1 種）は通過保存する。
- **`is_derived`（派生技フラグ）〔確定 D〕**: 手入力 CSV の派生技区分列を読み、moves へ保存する（本体は値を信頼＝導出しない・判定は入力ツール側の人間）。§4.8 の索引が非派生技のみを載せるための源。列の物理配置（moves 本体 or 索引テーブル）は M17-02 G-k で確定するが、**M14-03b は CSV の派生技区分を保全**する（列が無ければ Plan Mode で保全先を確定）。
- 処理: 列 remap（→ moves 現行スキーマ）・`total` は**ツール側算出済み値を同式（`startup + active − 1 + recovery`・素材欠落 NULL）で検算**し、不一致は投入を止め報告（再計算で黙って上書きしない）・`raw_data` 構築（notes/notes_tool のみ・空→NULL）・category 写像（ツール側で写像済みの想定＝enum 検証のみ）・`move_code` はツール側採番値の**正準形検証**（DES-004 §2.1。再採番しない＝CSV が正）。
- **recovery は単一整数〔確定 B〕**: 手入力 CSV の recovery は単一の観測値（空振り時フレーム）で整数前提。非整数情報（注釈・複数併記）は持たない。NULL 行は total NULL（DES-003 §3.3）。**NULL が多い作業途中キャラは投入を待つ**（充填が揃ったキャラ単位で段階投入）。非整数が来たら手入力ミスとして fail・報告。
- **target_combo passthrough〔(d)〕**: category=target_combo の行は区分・値を改変せず通過保存する。多段に見える行の自動再分類・警告付与を行わない（CHANGE-065）。
- 出力: seed SQL（INSERT 群・FK 依存順 characters→moves→preset_aliases）。dev/build 時生成・本体ランタイム非経路。**取込経路を復活させない**。
- **dup スキャン〔(c)〕**: 生成時に §3.3-8 の検出キーで走査し、衝突検出時は SQL を生成せず衝突一覧を出力して fail する。

### 4.2 移動 system move 全キャラ seed＋alias〔(a)〕

- DES-004 §2.1 の移動 system move 9 種（`forward`/`back`/`micro_forward`/`micro_back`/`dash_forward`/`dash_back`/`jump_neutral`/`jump_forward`/`jump_back`）を、characters 全行に対し `category=system` で投入する。手入力 CSV 非依存（SUPP-001 §3.3.2＝seed 管理 move）。
- `preset_aliases`（official_ja_move・`(preset_id, move_id)` キー）を**必ず対で**投入する（alias 不在は表示の生 code フォールバックを招く＝handover §3-(a)）。alias 文字列は ryu 既存 seed の同種 alias と同一の日本語表記を採用（§3.3-1 で実在形を確認して踏襲）。
- ryu の既存 9 種とは重複投入しない（存在チェックまたは対象から除外）。
- **本項は第一波に限らず全キャラ分を本サブで完了**する（掃き取り〔(b)〕の前提条件のため）。

### 4.3 第一波キャラの moves・エイリアス seed（段階投入）

- **第一波コア＝案 1 の 5 キャラ（terry / guile / lily / ingrid / kimberly）**〔確定 E・RESEARCH §E 案 1〕。**本サブの完了条件はコア 5 キャラの投入**。
- **友人完成分はオプション**: 友人がシンプルなキャラ（例外類型 0＝ed/elena 等）の入力を手伝っており、**着手時点で手入力が完成していれば一緒に投入**（間に合わなければ第二波）。友人分待ちで本サブ全体をブロックしない。
- §4.1 の変換系で生成した seed SQL をマイグレとして投入。FK 依存順・down 整合・既存マイグレ非改変。
- 完了報告に**全 30（/31）キャラの投入済み／未投入／def 状況の網羅表**を含める（残範囲の明示＝段階投入の契約）。
- なお **ryu の moves は本サブでは差し替えない**（現行 000004 の仮 seed のまま）。ryu の正規再 seed（手入力 CSV 由来へ差し替え＋combos クリア）は **M14-03c**（§10・別サブ）。

### 4.4 recovery 投入

- 第一波キャラの recovery は手入力 CSV の値をそのまま投入する（新規 INSERT のため total は生成時算出）。
- **ryu の recovery は NULL 残置**（値未受領・開発者確定 2026-07-09）。ryu の total・フレーム値・recovery に本サブでは触れない。値受領後の投入は後続マイグレ（§10）で行い、その total 整合方針は §3.3-7 で提示・承認済みの契約に従う。
- **dev DB の偽値（standing_light_punch の recovery=8/total=25 等）を参照しない**（clean マイグレ由来 DB が正。followup-backlog §C 表）。

### 4.5 skip 残行の掃き取り follow-up マイグレ〔(b)〕

- M16-04（000022）が無損失 skip した modifier.type dash 行を、**全キャラ dash seed（§4.2）完了後**の連番マイグレで system move dash へ移行しきる。
- 移行後、modifier.type dash 残行が**ゼロ**であることをマイグレ内 or テストで検証する（「トークン撤去」と「全行移行」をセットで完了＝digest M16-C4）。
- **ロールバック注記**: 000022 の down は native dash も modifier.type dash 化する非対称（marker 不在）。本掃き取りマイグレの down も同種の非対称を持ち得る。down で完全な逆写像を追求せず、down の挙動と限界を完了報告に明記する。
- FK=OFF と明示 DELETE を同一マイグレに同居させない（digest §5）。

### 4.6 dup スキャン・再測定〔(c)〕

- §4.1 の生成時スキャンに加え、seed 投入後の clean 配布 DB に対し全域 dup 測定（M16-RESEARCH-01 と同一の測定軸）を 1 回実施し、結果（件数・内訳）を完了報告に記載する。0 件が期待値。非 0 なら投入を止め開発者へ報告（自動解消しない）。

### 4.7 custom_states: show_delta 付与＋2 値 situation〔(e)〕

- **def 側〔重要・F-8 で事実誤認を訂正〕**: Mai/Lily/Juri/Kimberly は **custom_states そのものが現行マイグレ（000001〜000023）に未定義**（定義済みは ryu/ingrid/c_viper のみ）。よって「show_delta の UPDATE」ではなく、**状態定義の新規 INSERT（characters.custom_states の JSON へ state 定義を追加）＋ show_delta 付与**を行う。各 state の種別（level/stock/flag）・値域（min/max）・`show_delta`（方向可変=true／一方向=false）は **SF6 ドメイン判断で §3.3-9 の表を開発者が承認**した値を用いる。**第一波コアで対象になるのは lily/kimberly の 2 キャラ**（juri/mai は第一波コア外＝第二波。ただし案 1 に含まれない juri/mai を友人分等で前倒し投入する場合はその時点で def 新規作成）。ingrid は既定義（000023）で show_delta=true 済み。
- **per-combo 側**: 変換系・seed が situation を扱う場合、int state は 2 値構造 `{"<code>": {"start_min": n, "end": m}}` を正とし、旧スカラ入力は end へ写像（DES-003 §3.2）。situation は opaque＝DDL/DTO/BE 不変・dup/recipe 非対象（改変しない）。
- **E2E**: Ingrid int state の①始動最低/②終了/③増減（show_delta 時のみ）表示と、4 キャラの def 反映を実データで確認する（M16-07 の単体担保を実データで補完）。

### 4.8 command 索引源の器〔(f)〕

- remap 層から「クリーンなトークン（正準 command 表記）→キャラ別 `move_code`」の索引を構築する処理を**独立モジュール（IF）として切り出す**。手入力 CSV の command 列（テリー CSV で 55 行充填・公式と完全一致を RESEARCH §C-3-4 で確認。M14-01 で moves.command 列は本体から除去済＝索引は列復活でなく seed/CSV 由来で構築する index-only 方針・handover §2-6）を索引源とする。
- **索引に載せるのは非派生技（`is_derived=false`）のみ**〔確定 D・別紙 command-index-resolution-design v2.1.0〕。派生技は索引に載せない（段階2 で「派生技は簡易解決で満足に入力できない＝非対応」＝直接指定へ）。これにより将来アップデートで後発の本体特殊技が既存派生技と command かぶりで追加されても、非派生技のみで一意化する（priority のような都度運用が不要）。
- **IF 規約**: `Lookup(charKey, token) → move_code`（単一返却）は非派生技候補から、**同一該当が複数残る場合は move.id 最小でタイブレーク**して返す。`LookupAll(charKey, token) → []move_code`（候補一覧・デバッグ/人レビュー用）も持つ。**command 空欄・未知トークン `raw{-}`・条件残留 `cond{…}` の行は索引に載せず記録（fail しない）**〔RESEARCH T8/T9/T10〕。
- 本サブでの消費者は**変換系（表記→move_code 解決）のみ**。M17 G-k（コントローラ入力解決）が同一モジュールを消費する前提で、キャラ別スコープ・入力トークン形式・未解決時の挙動（フォールバックせず未解決を返す）を IF に固定する。**M17 側の要件（単方向＋ボタン特殊技の決定論解決）を本サブで実装しない**（IF が塞がない形にのみ留意）。
- token→索引キー正規化の確定仕様（TOOL-002 §9.9→numpad。レポート §1.7 に語彙転記済み）は M17 で確定するため、本サブは索引キーを「CSV 記載の正準表記そのまま」とし、正規化層を後付けできる位置に置く。
- **1:N の実態**〔RESEARCH T12〕: 同一 command に複数 move が対応するのは全 30 キャラ 442 グループだが大半は必殺技（段階2 スコープ外）。段階2 が扱う「単方向＋ボタン」に絞れば激減する見込み（実測は M17-02）。索引器は 1:N を扱える形（非派生フィルタ＋id タイブレーク）で本サブが器を用意する。

### 4.9 E2E・検証

- 投入 moves は既存 VAL（enum 値域・FK・NOT NULL・move_code 形式）に適合させる。recovery 専用 VAL は無い（寛容方針・M14-01）。
- `combo-csv-io.spec.ts` の ken moves 件数断定（L64-67）: 第一波に ken が含まれるなら clean DB で通過確認のみ。含まれないなら対象キャラを投入済みキャラへ変更（spec 修正）。**dev DB 残渣で通る状態を残さない**。
- `make e2e`（seed 非依存 self-contained）が新 seed 下でも通過することを確認する。

---

## 5. テスト要件（ケース数で語る。§7 DoD と対応）

### 5.1 Go テスト

- **変換系**: サンプル CSV → 期待 seed SQL（remap・total 算出〔欠落 NULL〕・raw_data〔空→NULL〕・recovery・category・move_code 採番・**target_combo passthrough**・**dup 検出で fail**）。境界含めケース数を報告。
- **索引モジュール〔(f)〕**: トークン→move_code 解決（キャラ別スコープ・未解決時の挙動・重複トークン検出）。
- **seed マイグレ**: up で移動 move 9 種×全キャラ＋alias 対・第一波 moves・show_delta def が投入される。down 整合。`dbtest.Setup` 経由の全テスト通過（件数前提テストの追従込み）。
- **掃き取りマイグレ**: modifier.type dash 残行がゼロになる（skip 行を含む fixture で検証）。
- **FK 依存順**: characters→moves→preset_aliases の順で FK 違反が出ない。

### 5.2 E2E

- Ingrid int custom_states ①②③ の表示（詳細/比較/editor）。4 キャラの show_delta def 反映。
- `combo-csv-io.spec.ts` が clean マイグレ DB で通過。
- `make e2e` 全体が通過（seed 非依存 self-contained の維持）。

### 5.3 手順書

- clean マイグレ由来 DB の構築手順（dev DB 非流用）と、起動時マイグレ適用で配布 DB が構築され投入済みキャラの moves が画面18 で表示・編集できることの確認手順。

---

## 6. レビュー観点（別ファイル参照）

機械レビューは `M14-03b-review-checklist.md` v2.0.0 に従う。重大判定は同 §9。

---

## 7. 完了条件（Definition of Done）

### 7.1 機能要件（seed 契約 6 件とのマッピング）

- **(a)** 移動 system move 9 種×**全キャラ**＋ `preset_aliases` 対が投入済み（生 code フォールバックが発生しない）。
- **(b)** 掃き取りマイグレで modifier.type dash 残行ゼロ（検証付き）。
- **(c)** 変換系 dup スキャン実装＋clean 配布 DB の dup 再測定結果（件数・内訳）を報告。
- **(d)** target_combo passthrough がテストで担保。
- **(e)** 4 キャラの show_delta def 付与（開発者承認値）＋2 値 situation 取込写像＋Ingrid・4 キャラ実データ E2E 通過。
- **(f)** 索引モジュール IF が切り出され、変換系が消費し、M17 の消費を塞がない（IF 仕様を完了報告に明記）。
- 第一波キャラの moves・alias・recovery が clean マイグレ DB に投入済み（ryu recovery は NULL 残置＝仕様どおり）。
- 既存マイグレ非改変・スキーマ不変・取込経路非復活。

### 7.2 自己テスト結果（製造担当の責任範囲）

- §5 をケース数で報告。`dbtest.Setup` 全テスト通過・down 整合・件数前提テストの追従を明記。

### 7.3 品質チェック

- 全 30（/31）キャラの投入済み／未投入／def 状況の**網羅表**。禁則表現・簡体字・「起き攻け」誤字・「DR」略記の grep 除去。
- clean マイグレ由来 DB からの構築であること（dev DB 残渣の混入が無いこと）の確認方法と結果。
- **意図的除外の可視化〔H-5〕**: importer CSV（公式変換）と手入力 CSV の move 差分一覧を完了報告に添付（公式にあって手入力に無い行＝意図的除外か漏れかの判別材料）。変換系は手入力 CSV を正とし差分で止めない（報告のみ）。

### 7.4 ドキュメント

- Plan Mode 確定方式（11 項目）・段階投入の残範囲・dup 再測定結果・索引 IF 仕様（非派生のみ・id タイブレーク）・掃き取り down の限界を完了報告に記載。
- DES 反映が要る点（索引モジュールの正典化＝M17 CHANGE 候補等）は設計担当への伝達メモで申し送る（**製造は DES を直接編集しない**）。

### 7.5 完了報告

- 上記＋配布 blocker の残状態（未投入キャラ一覧＝blocker 解除は全キャラ充足時点である旨）を明記。

---

## 8. 参照ドキュメント

| 文書（実パス） | 節 | 用途 |
|------|-----|------|
| DES-003 `docs/design/03-data-model.md` | §3.2/§3.3/§3.5/§3.9 | custom_states・moves・taxonomy・alias の正 |
| DES-004 `docs/design/04-notation-spec.md` | §2.1/§2.2/§2.3 | move_code 採番・移動 move 9 種・dash canonical |
| DES-002 `docs/design/02-architecture.md` | §4.2/§7.5 | seed マイグレ経路／降格 CSV 参照（読み替え注意） |
| SUPP-001 `docs/design/supp-001-detailed-design.md` | §3.3.2 | seed 管理 move の境界 |
| m16-to-m17-handover `docs/handover/phase3/m16-to-m17-handover.md` | §3 | seed 契約 6 件の正 |
| followup-backlog `docs/handover/followup-backlog.md` | §C | 配布完了定義・clean DB 制約・combo-csv-io-ken |
| code-facts `docs/handover/code-facts.md` | §8/§9/§10 | model・repository・マイグレ DDL |
| M14-RESEARCH-02-report（作成後） | 全 | 第一波キャラ選定の入力 |

---

## 9. 注意事項・判断に迷ったら

### 9.1 推測で進めてはいけない事項

- roster・seed の投入済み実態（§3.3-1 の実査。「ryu のみ」も再確認）。
- 手入力 CSV の列構成（実物確認。旧 22 列前提の決め打ち禁止）。
- 将来の ryu recovery 投入時の total 整合方針（§3.3-7・開発者承認）。
- show_delta の方向性（§3.3-9・開発者承認）。
- 第一波キャラ集合（M14-RESEARCH-02→開発者確定リストを正とする。本サブ着手時点で確定済みの前提）。

### 9.2 推測で進めてよい事項（その旨を明示）

- 変換系・索引モジュールの内部実装・ファイル分割（IF と非復活制約が満たされる範囲で）。
- seed マイグレの分割数（順序制約〔掃き取りは dash seed 後〕・FK 順・冪等が満たされる範囲で）。

### 9.3 不明事項発見時の対応

- 取込ロジックの復活が必要に見えた場合は止める（FR704 降格違反）。新規最小実装で代替し設計担当へ相談。
- **DES-002 §7.5 の「前方/後方ステップは modifiers.type で表現・取込対象外」注記、および SUPP-001 §3.3.3 の方向別 modifier.type dash 記述は M16-04 以前の旧方針であり失効している**。dash の正は DES-004 §2.1/§2.3・DES-003 §3.5（system move）。矛盾に遭遇しても旧記述に従わない（是正は設計担当が別途実施）。
- 手入力データの不足で第一波が揃わない場合は、揃った分の投入＋残範囲明示に留める（段階投入の範囲内）。
- dup 検出が非 0 の場合は投入を止め、衝突一覧を添えて設計担当へ報告（自動リネーム・自動 skip をしない）。

### 9.4 Plan Mode で計画提示時に含めるべき項目

- §3.3 の 10 項目すべて。とくに 7（recovery/total 整合）と 9（show_delta 表）は**開発者承認を得てから実装**する。

---

## 10. 完了後の次ステップ

- 完了報告（伝達メモ）を受けて設計担当が: (1) 索引モジュール・seed 由来の DES 反映要否を判断（CHANGE 起票 068〜）、(2) DES-002 §7.5／SUPP-001 §3.3.3 の失効 dash 記述の是正を M17 の DES-002 改訂に同梱するか判断、(3) retrospective 教訓ドラフトを起草。
- 第二波以降のキャラ投入・**投入済みデータの数値是正**（バリデーションをすり抜けた手入力ミスの修正）は、いずれも本インフラ上の**後続 UPDATE/INSERT マイグレ**として手入力データ受領の都度実施（段階投入と同機構。指示書は軽量な追補で足りる見込み）。
- **M14-03c（ryu 正規再 seed）へ**: 本サブと同一の変換インフラで、ryu の moves を手入力 CSV 由来へ差し替え＋ryu の combos/combo_steps/combo_setups/combo_oki_options/combo_tags をクリア（既存 ryu コンボは消えてよい・開発者確定 C）。破壊的マイグレを伴うため別サブ・Opus 4.8＋Plan。連番は本サブの seed マイグレ群の後。clean マイグレ DB 前提（消える実コンボは dev DB のみ）。
- **M17（command 解決 段階2・G-k）へ**: §4.8 の索引モジュールを消費者拡張する（派生技フラグ物理配置の確定・段階2 解決サービス）。

---

## 11. 開発者への確認事項

v2.1.0 で確定済み: (1) 手入力完成済みはテリー 1 キャラ＝変換系一次サンプル、(2) ryu recovery は NULL 残置＝後続マイグレ、(3) 第一波は本サブ着手前に確定（M14-RESEARCH-02→開発者確定→Plan Mode）。

v2.2.0 で確定（レポート 20260709 由来・2026-07-09 開発者承認）: (1) ラッシュ版行＝ツール生成行を投入（FR703 は seed 済みキャラに生成しない＝二重生成回避）、(2) `is_aerial` の system=false 既定＝CSV 値を投入（取込値信頼）。

v2.3.0 で確定（RESEARCH-02・開発者回答 A〜F・2026-07-09）: (A) 移動 9 種 drop、(B) recovery 単一値・NULL 過多は充填待ち、(C) ryu 再 seed は M14-03c 分離、(D) 派生技フラグ `is_derived`・非派生のみ索引・id タイブレーク、(E) 第一波＝案 1＋友人分オプション、(F) 判定源は入力ツール側＋人間（本体は値信頼）。

**未決なし**（着手可・第一波コア 5 キャラ確定済み）。詳細は別紙 `M14-RESEARCH-02-findings-analysis.md` v1.1.0・`command-index-resolution-design.md` v2.1.0。

---

*以上、M14-03b 製造指示書 v2.2.0。配置 `docs/instructions/M14-03b-distribution-seed.md`。M16 の seed 契約 6 件〔(a)〜(f)〕を DoD に織り込んだ全面改訂版。対のレビューチェックリストは `docs/instructions/reviews/M14-03b-review-checklist.md`。*
