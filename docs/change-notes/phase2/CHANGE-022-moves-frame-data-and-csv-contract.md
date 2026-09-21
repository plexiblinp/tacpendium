# CHANGE-022 通知書: moves フレームデータ列追加 + FR704 CSV 契約定義 + 取込エンドポイント是正

| 項目 | 内容 |
|------|------|
| 通知書ID | CHANGE-022 |
| バージョン | 0.3.0(機械レビュー指摘 1〜8 反映の amendment) |
| 起票日 | 2026-06-08 |
| 起票者 | 設計担当 Claude(フェーズ2 キックオフ担当) |
| 承認者 | 開発者(2026-06-08 承認済み) |
| ステータス | 承認済み・反映済み(DES-003 v1.17.0 / DES-002 v1.10.0 へ反映完了 2026-06-08。amendment 後の再反映を含む) |
| 影響範囲(設計書本体) | DES-003 §3.3 / §2(ER図)、DES-002 §4(API表)/ §7.2 / §7.4 + §7.5(新設)。DES-004 は参照のみ・改訂なし(§4.1 参照) |
| 前提文書 | REQ-001 v2.15.0 §7(FR701 / FR702 / FR703 / FR704 / FR202 / NFR104)、DES-004 v1.4.0 §3.1 / §7、phase2-kickoff-handover v1.0.0、DES-003 v1.16.0、DES-002 v1.9.0、CHANGE-021 |

## 改訂履歴

| 版 | 内容 |
|----|------|
| 0.1.0 | 初版ドラフト(recovery を NOT NULL 列として保持) |
| 0.2.0 | 開発者指摘 Q-a/Q-b 反映: recovery を moves 非永続に変更、total(全体硬直)を NOT NULL 正準列として追加、CSV は発生・持続・硬直を保持し本体が取込時に total を算出 |
| 0.3.0 | 機械レビュー指摘 1〜8 反映(下記 §8)。CSV 契約から `name_en → official_en`(存在しないプリセット)を是正、properties をコード値正規化に修正、`is_aerial`(空中判定)列を追加、ラッシュ版の取扱いを明記、§7.4 を NFR104 のみ + サイズ上限記述削除、通知書ステータスを承認済みへ |

---

## 1. 変更の概要

フェーズ2(先行リリース準備)のゲートとなる moves スキーマ見直しを行う。具体的には次の3つを設計書本体に確定する。

1. **moves テーブルにフレームデータ列を追加**(発生 / 持続 / 全体硬直 / 硬直差ヒット / 硬直差ガード / Dゲージ減少ガード)、**空中判定列(is_aerial)**、および将来のセットプレイ自動提案機能のための予約列(setup_only)。
2. **FR704 の CSV フォーマット契約を定義**(公式データ取込ツールの出力 = 本体の取込入力)。
3. **取込まわりのエンドポイント / 動作方針を是正**(別ツール化に伴い陳腐化した記述の更新)。

後続マイルストーン(FR701 取込ツール / FR704 アプリ取込 / FR703 手動修正 / 複数キャラ登録 UI)はすべて本スキーマと CSV 契約に依存するため、フェーズ2 の最初に固める。

---

## 2. 変更の理由

- フェーズ1 完了時点の moves テーブル(DES-003 §3.3)は damage / combo_scaling / ゲージ増減 / properties / raw_data のみを持ち、**発生・持続・硬直・硬直差といったフレームデータの列が存在しない**。先行リリースで実データ(クラシック5体)を扱うには、公式フレームデータを保持する列が必須。
- FR701 取込ツールの出力仕様(CSV)は、本体側で確定した moves 構造に依存する(SUPP-001 §4.3)。よって moves スキーマと CSV 契約は同時に formalize する必要がある(phase2-kickoff-handover §2.6 / §5)。
- DES-002 §7.2 は取込ツール出力を「JSON または SQL 形式」「DB 適用もツール経由」と記述しているが、CHANGE-021 で FR704(本体側 CSV 取込)を新設し、FR701 の出力は CSV、DB 反映は本体の責務と確定済み。よって DES-002 の当該記述が設計と乖離しているため是正する。
- DES-002 §4 の `POST /api/admin/fetch-official` は、本体が公式データを fetch する前提の旧設計の名残であり、別ツール化(FR701)と矛盾するため廃止する。
- ラッシュ版(ドライブラッシュで性能が変わる技)はコンボの要だが、性能が変わるのは**ジャンプ攻撃を除く通常技・特殊技**のみで、必殺技・SA・通常投げ・共通システムは変わらない。地上/空中の判別はジャンプ攻撃の除外に必要で、現状は code 接頭辞(`jump_`)依存のため、明示列(is_aerial)を持たせる。

---

## 3. 変更の内容

### 3.1 DES-003 §3.3 moves テーブル: 列追加

以下8列を追加する(既存列は変更しない)。

| カラム | 型 | 制約 | 説明 |
|--------|-----|------|------|
| startup | INTEGER | NOT NULL | 発生フレーム(公式「発生」)。すべての技が値を持つ前提 |
| active | INTEGER | NULL可 | 持続フレーム数(公式「持続」の範囲表記 `4-6` を本数 `3` に正規化)。弾系等で公式が空欄の場合は NULL |
| total | INTEGER | NOT NULL | 全体硬直(正準の利用値)。本体が取込時に CSV の 発生・持続・硬直 から算出して格納(算出式は格ゲー仕様前提＝開発者定義。M8-01 着手前確認)。備考に空振り時硬直・全体の補足がある場合は手動微修正(FR703)。硬直(recovery)単体は moves に持たない |
| on_hit | INTEGER | NULL可 | 硬直差ヒット(公式「硬直差／ヒット」)。符号付き。公式が空欄の場合は NULL |
| on_block | INTEGER | NULL可 | 硬直差ガード(公式「硬直差／ガード」)。符号付き。公式が空欄の場合は NULL |
| drive_gauge_decrease_guard | INTEGER | NULL可 | ガード時の防御側ドライブゲージ減少量(公式「Dゲージ減少／ガード」) |
| is_aerial | BOOLEAN | NOT NULL, DEFAULT false | 空中判定。ジャンプ攻撃・空中技は true。ラッシュ可否の判定に使う(下記)。取込時に公式名へ「ジャンプ／（ジャンプ中に）」を含む技は true で投入、接頭辞の付かない空中技(ジャンプから出す特殊技等)は利用者が FR703 で手動 true 化する |
| setup_only | BOOLEAN | NOT NULL, DEFAULT false | セットプレイ専用フラグ。true の move はコンボ登録 UI の技選択から除外する。将来のセットプレイ自動提案機能のための予約列。本フェーズではフラグ保持のみで利用ロジックは未実装 |

**変更しない既存列の確認**:

- `properties`(TEXT, NULL可): 列定義は不変。**取込時に公式「属性」をコード値へ正規化**して格納する(下記 §3.3 / §7.5。DES-003 §3.3 既定のコード値 high / mid / low / throw / projectile / air_projectile と整合)。複数値(例「上・弾」= 弾系のみ稀)は主属性をコード値、残りを raw_data へ。
- `category`(TEXT NOT NULL): 不変。既に 通常技 normal / 特殊技 unique / 必殺技 special / SA super_art / 投げ throw / システム system / target_combo / rush_variant / drive_impact を区別する。ラッシュ可否の技種別はこの既存 category で表現する(新たな技種別列は設けない)。
- `combo_scaling`(JSON)/ `drive_gauge_increase` / `drive_gauge_decrease_punish` / `super_art_gauge_increase` / `damage` / `raw_data`: 変更なし。

**moves に持たない項目**:

- 硬直(recovery): moves には永続化しない。CSV が公式の発生・持続・硬直を保持し、本体が取込時に total を算出して格納する(§7.5)。
- パニッシュカウンター時の硬直差(on_punish_counter): 列として持たない(算出可能・利用機能なし、YAGNI)。
- 公式「キャンセル」列(C / SA / SA2 / SA3 / ※): 保持せず raw_data にも入れない(FR306 で成立可否判定を行わないため)。
- 専用の `rush_eligible` フラグ・新規「技種別」enum: 設けない。ラッシュ可否は **`category ∈ {normal, unique}` かつ `is_aerial = false`** で導出する(導出値の重複保存を避ける)。

**§3.3 への追記注記(取込・算出・要確認・ラッシュ可否の前提)**:

- 公式「持続」は範囲表記(`4-6` 等)で、`active` には持続フレーム数(`3`)を格納する。
- 硬直(recovery)は moves に持たない。CSV が公式の発生・持続・硬直を保持し、本体は取込時にこれらから `total` を算出して格納する(算出式は開発者定義、製造工程着手前確認)。`total` の内訳が必要な場合は取込元 CSV を参照する。
- 公式「硬直」の弾系「全体 N」表記、公式「備考」の「空振り時硬直 N フレーム増加」等は、取込プレビューで要確認として強調(該当語 空振り／増加／減少／全体／変化、強調語リストは差し替え可能な形で保持)し、利用者が `total` を手動微修正する(FR703)。算術の自動反映は行わない。
- `properties` は取込時に公式属性をコード値へ正規化(上 / High→`high`、中 / Mid→`mid`、下 / Low→`low`、投 / Throw→`throw`、弾 / Projectile→`projectile`、空弾→`air_projectile`)。
- **ラッシュ可否**: ラッシュで性能が変わるのは `category ∈ {normal, unique}` かつ `is_aerial = false` の技。ラッシュ版(`category = rush_variant` + `original_move_id`)は公式HTMLに独立カテゴリが無いため CSV 取込のスコープ外とし、FR703 編集器で対象の通常技・特殊技を元に生成する(M9-03)。

### 3.2 DES-003 §2 ER図: 反映

§2 の ER 図 moves エンティティに上記8列を追加する(他エンティティとの関連線に変更なし)。

### 3.3 DES-002 §7 + 新小節 §7.5: FR704 CSV フォーマット契約の定義

§7 配下に新小節「7.5 FR704 CSV フォーマット仕様」を新設し、取込ツール出力 = 本体取込入力の契約を定義する。

**基本方針**:

- 取込ツール(FR701)は日本語版・英語版の両 HTML を行対応でマージして 1 キャラ分を 1 つの CSV として出力する。**英語版は属性のコード値正規化(High→`high` が素直)と行マージ整合・code 検証に用い、英語技名はフェーズ2 ではエイリアスとして取り込まない**(英語公式技名用プリセットは DES-004 に存在せず、FR202 / NFR307「言語別エイリアスを持たず多言語は UI ラベルのみ」、英語ロケール整備はフェーズ3以降)。英語技名の格納は英語ロケール着手時(フェーズ3以降)に当該プリセット新設と併せて再取込で対応する。
- 文字コードは UTF-8、1 行目をヘッダ行とする。
- `move_code` / `character_code` はツール側が決定論的に採番する。本体は受領した code を信頼する(再取込の冪等性 = ツールの code 決定論性 + 本体の upsert)。
- CSV は公式の発生・持続・硬直を保持し total は持たない。`recovery` は CSV のみで DB へ永続化しない。

**CSV 列(契約)**:

| CSV列 | 反映先 | 備考 |
|-------|--------|------|
| character_code | characters.code(upsert キー `(game_id, code)`) | |
| move_code | moves.code(upsert キー `(character_id, code)`) | ツール採番 |
| category | moves.category | 公式カテゴリ区切り(通常技 / 特殊技 / 必殺技 / スーパーアーツ / 通常投げ / 共通システム)を enum へ写像 |
| name_ja | preset_aliases(preset = official_ja_move, move_id, alias_text) | 日本語公式技名。official_ja_move の「改善」は連結子・アイコン代替・状況情報が対象で、技名文字列は公式名(DES-004 §3.2 と非衝突) |
| startup / active | moves 同名列 | |
| recovery | (moves 非永続) | 本体が startup・active・recovery から `total` を算出して moves.total へ格納。recovery 自体は DB 保存しない |
| on_hit / on_block | moves 同名列 | |
| drive_gauge_increase / drive_gauge_decrease_guard / drive_gauge_decrease_punish / super_art_gauge_increase | moves 同名列 | |
| damage | moves.damage | |
| combo_scaling | moves.combo_scaling(JSON 文字列セル) | 始動 / コンボ / 即時 / 乗算補正 |
| properties | moves.properties | 公式属性を**コード値へ正規化**して格納(上 / High→`high` 等) |
| is_aerial | moves.is_aerial | ツールが公式名「ジャンプ／（ジャンプ中に）」を含む技を true。接頭辞の付かない空中技は FR703 で手動 true 化 |
| setup_only | moves.setup_only | 既定 false。手動付与を想定 |
| notes | moves.raw_data | 公式「備考」。要確認強調の元データ、total 手修正の参照元 |

> **name_en 列は CSV に含めない**(フェーズ2)。英語公式技名の格納先プリセットが無く、英語ロケールはフェーズ3以降のため。英語版 HTML はツールが属性正規化・整合検証に内部利用する。
>
> ラッシュ版(rush_variant + original_move_id)は本 CSV のスコープ外。公式 HTML に独立カテゴリが無いため、FR703 編集器で対象の通常技・特殊技を元に生成する(M9-03)。

### 3.4 DES-002 §4 API表: エンドポイント是正

| 操作 | 内容 |
|------|------|
| 廃止 | `POST /api/admin/fetch-official`(別ツール化により本体は fetch しない。FR701 = 別ツール、本体反映は FR704 に一本化) |
| 新設 | `POST /api/import/moves`(仮称、FR704、フェーズ2): moves / キャラクターデータの CSV 取込。プレビュー + 行単位 upsert |
| 注記 | `POST /api/import/csv` / `GET /api/export/csv` はコンボ CSV(FR401 / FR405、フェーズ3)である旨を明記し、moves 取込と区別 |

### 3.5 DES-002 §7.2 / §7.4: 動作方針・検証責務の是正

**§7.2**: 出力を「JSON または SQL 形式」から CSV へ是正(日英両ページを行対応マージ)。「DB 適用もツール経由」を削除し、DB 反映は本体 FR704、total 算出も本体側と明記。

**§7.4(検証責務の分割)**: NFR104(改ざんデータ混入防止)対応として責務を分割する。

- ツール側(FR701): 入力 HTML の構造検証、入力 HTML のキャラ同定(ページタイトル照合)、数値妥当性チェック。
- 本体側(FR704 / FR703): 取込プレビューは寛容(正しさのバリデーションを課さず、エラーを含む状態でも表示して手動修正させる)。表示はセキュリティ無害化のみ(セル値を式・コマンドとして解釈・実行しない、描画時エスケープ)。DB 取込時に total を算出のうえ行単位の型チェック + スキーマ制約(NOT NULL / FK / UNIQUE / enum 値域)を実施、SQL はパラメータ化。取込は行単位で全体ロールバックを行わない(失敗行はスルー → 行単位レポート → 失敗行のみ再編集)。依存順は characters → moves。

> NFR103(インターネットとの接点である CSV インポート)は本取込(ローカルファイル入力)と文脈が異なるため引用しない。サイズ上限等の取込制限は M9 設計(m9-overview / SUPP-001)で扱う。

---

## 4. 影響範囲

### 4.1 設計書本体(CHANGE 対象)

| 文書 | 現バージョン | 改訂箇所 |
|------|------------|----------|
| DES-003 | v1.16.0 → v1.17.0 | §3.3 moves(8列追加 + 注記)、§2 ER図 |
| DES-002 | v1.9.0 → v1.10.0 | §4 API表、§7.2、§7.4、§7.5(新設) |

> **DES-004 は改訂しない**(参照のみ)。機械レビュー指摘 1 は「official_en プリセット不在」だが、これは DES-004 の漏れではなく **本通知書 §7.5 の CSV 契約側の誤り**(存在しないプリセットを参照)であり、CSV 契約を `official_ja_move` のみに是正することで解消する。DES-004 §3.1(5プリセット)/ §3.2(改善版の対象=連結子・アイコン・状況情報)/ §7(言語別エイリアスなし)は現状のまま整合する。
>
> REQ-001 も改訂しない。setup_only のトレーサビリティは DES-003 §3.3 列説明 + 開発者の記憶管理(判断 (b)、2026-06-08)。

### 4.2 派生ドキュメント(CHANGE 対象外・自由改訂)

- SUPP-001 v1.19.0 → v1.20.0: §4.1 にフェーズ2以降は phase2-overview を参照する旨を追記 + 前提文書欄を現行版へ更新(機械レビュー指摘 8)。
- change-number-registry v1.9.0 → v1.10.0: 022 を使用済み(次回 023)、§3 改訂表 2 行、§4 履歴。
- change-report-022(新規)。
- phase2-overview / model-allocation / 並列ツール委任 brief: 後続で作成。

### 4.3 実装(製造工程・参考)

- マイグレーション: moves への列追加(SQLite `ALTER TABLE ADD COLUMN`)。
- model / DTO: moves に8フィールド追加。`GET /api/characters/{id}/moves` レスポンス反映。
- 取込 API / UI: `POST /api/import/moves` + 取込プレビュー(グリッド表示 + セル編集)。取込時の total 算出・properties 正規化。
- FR703 編集器: 通常技・特殊技を元にしたラッシュ版生成、is_aerial の手動トグル。
- seed: フェーズ1 検証 seed の移行扱い(§5)。

---

## 5. 移行影響

- データ移行要否: あり(moves への列追加マイグレーション)。
- 既存行の扱い: フェーズ1 の seed 行はフレーム列を持たない。startup / total が NOT NULL のため移行手順(一時デフォルト → backfill、NULL許容 → backfill → 制約強化、または seed 再生成)を製造担当が選択。is_aerial / setup_only は DEFAULT false で既存行は補完される。耐久 seed は M12 で除去、リュウ実データは M9 取込で整備。
- 後方互換: 列追加は加算的。既存 combos / combo_steps / recipe_cache に影響なし。既存 API レスポンスは拡張のみ。is_aerial / setup_only の既存行 false で挙動不変。

---

## 6. リスク

| リスク | 内容 | 緩和策 |
|--------|------|--------|
| 移行不整合 | startup / total の NOT NULL と既存 seed のフレーム欠落 | M8-01 で移行手順を明示。耐久 seed 除去(M12)・リュウ再取込(M9)の順序に留意 |
| total 算出式の未定 | total は取込時算出だが算出式は格ゲー仕様前提 | 算出式は開発者定義(§1.4 開発者領域)。M8-01 着手前確認 |
| recovery 非永続の provenance | total の素の内訳が DB に残らない | 再算出・内訳確認は取込元 CSV を参照。手修正分は moves.total が正 |
| is_aerial の取込漏れ | 接頭辞の付かない空中技(ジャンプから出す特殊技等)は自動 true にできない | FR703 で利用者が手動 true 化(本通知書で運用を明記) |
| 英語技名の未取込 | フェーズ2 で name_en を保存しない | 英語ロケール着手(フェーズ3以降)に official_en 系プリセット新設 + 再取込で対応。公式データは安定で再取込容易 |
| setup_only の孤立列化 | 当面ロジックなしの予約列 | 列注記 + 開発者記憶(判断 (b))。確実に追加する機能の予約で YAGNI 適用外と確認済み |

---

## 7. 承認チェックリスト

- [x] moves 追加8列(startup / active / total / on_hit / on_block / drive_gauge_decrease_guard / is_aerial / setup_only)で問題ないか
- [x] startup / total を NOT NULL とし既存 seed の移行を製造担当に委ねる方針で問題ないか
- [x] recovery を moves 非永続(CSV のみ)とし total を取込時算出する方針で問題ないか
- [x] properties を取込時にコード値へ正規化(DES-003 既定コード値と整合)で問題ないか
- [x] ラッシュ可否を category + is_aerial で導出、ラッシュ版は CSV スコープ外で FR703 生成、で問題ないか
- [x] CSV 契約(name_ja → official_ja_move のみ・name_en は非取込・日英マージ・code ツール採番・notes → raw_data)で問題ないか
- [x] DES-002 §4 / §7.2 / §7.4 / §7.5 の是正・新設で問題ないか
- [x] DES-004 を改訂せず CSV 契約側の是正で解消する整理で問題ないか

> 上記は開発者承認済み(2026-06-08)。

---

## 8. 機械レビュー指摘への対応(amendment 0.3.0)

| 指摘 | 重大度 | 対応 |
|------|--------|------|
| 1. official_en 不在 | 重大 | CSV 契約を `name_ja → official_ja_move` のみに是正。name_en は非取込(EN は属性正規化・検証に内部利用)。DES-004 は改訂せず |
| 2. properties の格納規約矛盾 | 中 | 「素直格納」を撤回し、取込時にコード値へ正規化(DES-003 §3.3 既定値と整合) |
| 3. official_ja_move 改善版との緊張 | 中 | §3.2 の改善対象は連結子・アイコン・状況情報で技名文字列は公式名、と CSV 契約に明記(非衝突) |
| 4. 通知書が未承認のまま | 中 | ヘッダ・ステータスを承認済み・反映済みへ更新 |
| 5. §7.4 サイズ上限の付け過ぎ・誤帰属 | 軽微 | 当該記述を削除(取込制限は M9 設計へ) |
| 6. ラッシュ版の充填未定義 | 軽微 | CSV スコープ外と明記 + is_aerial 追加でラッシュ可否を導出 + FR703 で通常技・特殊技から生成 |
| 7. NFR103 引用の文脈ずれ | 軽微 | §7.4 を NFR104 のみへ是正 |
| 8. SUPP-001 前提文書欄の陳腐化 | 参考 | SUPP-001 §前提文書欄を現行版へ更新(自由改訂) |

---

*以上、CHANGE-022 通知書 v0.3.0(承認済み・反映済み)*
