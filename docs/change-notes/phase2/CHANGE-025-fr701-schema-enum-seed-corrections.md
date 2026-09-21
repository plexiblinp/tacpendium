# CHANGE-025 通知書: FR701 実データ反映訂正①(スキーマ・enum・seed)

| 項目 | 内容 |
|------|------|
| 通知書ID | CHANGE-025 |
| バージョン | 0.1.0(起票・承認待ち) |
| 起票日 | 2026-06-11 |
| 起票者 | 設計担当 Claude(フェーズ2 継続担当) |
| 承認者 | 開発者(未承認) |
| ステータス | 起票・承認待ち |
| 影響範囲(設計書本体) | DES-003 §3.3(startup/total 制約・category enum・code 例)、DES-004 §2.1(code 規約) |
| 前提文書 | fr701-mainline-handover v1.0.0 §1-1 / §2-1 / §2-2、fr701-html-survey-report v1.0.0(全30キャラ60ファイル全数調査)、CHANGE-022 v0.3.0(訂正対象)、CHANGE-023 v0.2.0、DES-003 v1.17.0 §3.3、DES-004 v1.5.0 §2.1 |
| 関連 | CHANGE-026 / CHANGE-027(FR701 由来の §7.5 文言群・CSV 契約拡張。本通知書と同一申し送り由来、影響面で分割) |

---

## 1. 変更の概要

FR701 ツール設計の実データ全数調査(30キャラ60ファイル)で判明した事実を、CHANGE-022 / 023 の訂正として設計書本体へ反映する。本通知書は**スキーマ・enum・seed の影響面**を扱う(DES-002 §7.5 の文言群は CHANGE-026、CSV 契約拡張は CHANGE-027)。

1. **startup / total を NULL 可化**(DES-003 §3.3、CHANGE-022 の訂正):実測でフレーム値が空欄の行が存在し、NOT NULL 前提が成立しない。
2. **category enum に `critical_art` を追加**(DES-003 §3.3):クリティカルアーツ(CA)が SA3 と別行で全キャラに存在し、`super_art` と区別が要る。
3. **code 規約を英語表示名の機械変換へ統一**(DES-004 §2.1 + DES-003 §3.3 例):`standing_medium_punch` 形式に確定。
4. **既存 seed の削除・ツール再生成前提化と参照データのクリア**(CHANGE-022 §5 の移行訂正)。

---

## 2. 変更の理由

- **1(NULL 可)**: DES-003 §3.3 は `startup` を「すべての技が値を持つ前提(CHANGE-022)」、`total` を NOT NULL としていたが、実測で**発生が空欄の行が約100件・26キャラ**、さらに**発生・硬直とも空欄でダメージありの行が11件**(サガット SA2 派生、豪鬼 百鬼襲、キャミィ フーリガン、ベガ サイコマイン自動爆発、ザンギエフ SA2 ほか)あり、total の算出(発生・持続・硬直)が成立しない(fr701-mainline-handover §1-1)。
- **2(critical_art)**: CA は SA3 と別行で全キャラに存在する(同 §2-1)。現 enum(`normal/special/unique/super_art/throw/system/target_combo/rush_variant/drive_impact`)に該当値がなく、`super_art` に潰すと SA3 と CA の区別が失われる。
- **3(code 規約)**: ツールが英語表示名から機械変換で code を採番する方式に確定(同 §2-1)。現行の設計書例 `stand_medium_punch` は新形 `standing_medium_punch` に統一する。
- **4(seed 再生成)**: 開発者決定(2026-06-11)で既存 seed(moves 186件・characters)は削除・ツール再生成前提(同 §2-2)。これに伴い CHANGE-022 §5 の backfill 記述が不要化する。

> なぜこれらの変更が必要かの根拠データは開発者が把握済み(本通知書はその設計反映を扱う)。

---

## 3. 変更の内容

### 3.1 DES-003 §3.3: startup / total を NULL 可化

| 列 | 現行(DES-003 v1.17.0) | 訂正後 |
|----|----------------------|--------|
| `startup` | INTEGER **NOT NULL**。「発生フレーム。すべての技が値を持つ前提(CHANGE-022)」 | INTEGER **NULL 可**。「発生フレーム。公式が空欄の場合は NULL(CHANGE-025 で NOT NULL を撤回。発生空欄の行が実在)」 |
| `total` | INTEGER **NOT NULL**。「全体硬直。本体が取込時に算出して格納する正準の利用値」 | INTEGER **NULL 可**。「全体硬直。取込時に発生・持続・硬直から算出。**算出に必要な値が空欄で算出不能の場合は NULL**(CHANGE-025)」 |

> CHANGE-022 の「startup はすべての技が値を持つ前提」という明示前提を撤回する。active / on_hit / on_block / drive_gauge_decrease_guard は既に NULL 可で変更なし。

### 3.2 DES-003 §3.3: category enum に `critical_art` を追加

`category` の列挙値に `critical_art` を追加する。

> 訂正後の列挙値: `normal`, `special`, `unique`, `super_art`, `critical_art`(クリティカルアーツ。SA3 と別行で全キャラに存在。`super_art` と区別), `throw`, `system`, `target_combo`, `rush_variant`, `drive_impact`

- ラッシュ可否導出(`category ∈ {normal, unique}` かつ `is_aerial = false`)は `critical_art` を含まないため**影響しない**。
- `super_art`(SA1〜SA3)と `critical_art`(CA)は別 category とする。code は SA が `sa1_`〜`sa3_`、CA が `ca_` 接頭辞(§3.3)。

### 3.3 DES-004 §2.1 + DES-003 §3.3: code 規約を英語表示名の機械変換へ統一

DES-004 §2.1 の命名規則を、ツールによる**英語表示名の機械変換**へ統一する(`stand_medium_punch` → **`standing_medium_punch`** 形式)。

- 強度は接尾辞 `_light` / `_medium` / `_heavy` / `_od`。
- ピリオド除去・連結でキャラ slug を生成(`aki` / `c_viper` / `m_bison`)。character_code も同規約(slug は同定専用)。
- code 衝突時は英語前提条件サフィックス、なお衝突する場合は `_2` フォールバック。
- 通常投げ 1・2 件目は `throw_forward` / `throw_back` 固定(CHANGE-023 準拠)。**既存 seed の `forward_throw` / `back_throw` とは語順が逆**だが、seed 削除・再生成前提(§3.4)のため問題なし。
- SA は `sa1_`〜`sa3_`、CA は `ca_` 接頭辞。ラッシュ版は `rush_<元技code>`(例 `rush_standing_medium_punch`)。
- DES-003 §3.3 の code 例(`stand_medium_punch` 等)を新形へ更新する。

### 3.4 移行: 既存 seed の削除・ツール再生成前提化(CHANGE-022 §5 の訂正)

- 既存 seed(moves 186件・characters)は**削除し、FR701 ツールが再生成した公式データで投入**する前提に改める(開発者決定 2026-06-11)。
- 既存 seed を参照する **combos / combo_steps / recipe_cache はクリア**する(配布 DB はクリーン初期状態前提、開発 DB も再生成時にクリア。move ID の張り替えは行わない。個人開発規模で張り替えコストに見合わないため)。
- CHANGE-022 §5 の「既存 seed のフレーム列 backfill / 一時デフォルト / seed 再生成のいずれか」という記述は、**再生成前提**に確定したため不要化する。これに伴い M8-01(moves 列追加マイグレーション)は「8 列とも単純な nullable ADD COLUMN(startup/total も NULL 可)・一時 DEFAULT / backfill を廃止」へ改訂する(M8-01 v1.1.0、指示書の自由改訂)。

---

## 4. 影響範囲

### 4.1 設計書本体(CHANGE 対象)

| 文書 | 現バージョン | 改訂箇所 |
|------|------------|----------|
| DES-003 | v1.17.0 → v1.18.0 | §3.3 startup / total を NULL 可化、category enum に `critical_art` 追加、code 例を `standing_` 形へ更新 |
| DES-004 | v1.5.0 → v1.6.0 | §2.1 code 規約を英語表示名機械変換へ統一(`standing_medium_punch` 形式・`ca_` 接頭辞・`_2` フォールバック等) |

> REQ-001 / DES-002 / DES-005 / DES-006 は本通知書では改訂しない(DES-002 §7.5 は CHANGE-026 で扱う)。

### 4.2 派生ドキュメント(CHANGE 対象外・自由改訂)

- M8-01 製造指示書 v1.0.0 → v1.1.0:nullable ADD COLUMN 化・一時 DEFAULT / backfill 廃止(本通知書と同時に改訂)。
- SUPP-001 §3.3.2:seed 管理 move(`jump_neutral` 等、公式 HTML に行なし)とツール取込 move の境界明文化(fr701-mainline-handover §2-3、別途自由改訂)。
- change-number-registry:025 を使用済み(本通知書承認・反映時)。
- change-report-025(新規、反映時)。

### 4.3 実装(製造工程・参考)

- seed クリア + ツール再生成投入のマイグレーション/手順は M9(取込パイプライン)で設計。M8-01 はスキーマ追加(nullable)のみ。
- `critical_art` を category として扱う箇所(取込・表示・FR703)の追従は M9 で確認。

---

## 5. 移行影響

- データ移行: 既存 seed(moves 186件・characters)を削除し、ツール再生成データで投入。既存 combos / combo_steps / recipe_cache はクリア。
- 配布 DB・開発 DB ともクリーン再構築。M8-01 で moves に 8 列(nullable)を追加、M9 で seed クリア + 再生成。
- 既存データへの後方互換は維持しない(seed・参照コンボの作り直し前提)。先行リリース前のため許容。

---

## 6. リスク

| リスク | 内容 | 緩和策 |
|--------|------|--------|
| 既存コンボ消失 | combos クリアで開発中の手動コンボが消える | 先行リリース前・個人開発で許容。残したいコンボは再生成後に手動再登録 |
| total NULL の下流影響 | total によるソート・表示・バリデーションが NOT NULL を前提していると破綻 | DES-005 / DES-006 で total 前提箇所を確認(null は「—」表示等)。CHANGE-026 / M9 設計で追従 |
| code 衝突 | 機械変換で同一 code が生じる | 英語前提条件サフィックス → `_2` フォールバック(§3.3)。取込プレビューで衝突警告 |
| critical_art 追従漏れ | category 使用箇所で CA が未対応 | category を分岐する実装箇所を M9 着手時に grep で網羅 |
| seed 語順差(forward/back throw) | 既存 `forward_throw` と新 `throw_forward` の混在 | seed 削除・再生成前提で旧 code は残らない |

---

## 7. 承認チェックリスト

- [ ] DES-003 §3.3 の `startup` / `total` を NULL 可化し、CHANGE-022 の「全技値を持つ前提」を撤回してよいか。
- [ ] category enum に `critical_art` を追加し、`super_art` と区別してよいか。
- [ ] DES-004 §2.1 code 規約を英語表示名機械変換(`standing_medium_punch` 形式・`ca_` 接頭辞・`_2` フォールバック)へ統一し、DES-003 例を新形へ更新してよいか。
- [ ] 既存 seed 削除・ツール再生成前提化、参照 combos / combo_steps / recipe_cache のクリア(張り替えなし)で問題ないか。
- [ ] 上記に伴い M8-01 を nullable ADD COLUMN 化・backfill 廃止へ改訂してよいか。

---

*以上、CHANGE-025 通知書 v0.1.0(起票・承認待ち)*
