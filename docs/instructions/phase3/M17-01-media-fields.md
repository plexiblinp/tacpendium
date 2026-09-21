# 指示書 M17-01: G-j メディア 3 フィールド（link・video_path・image_path）

| 項目 | 内容 |
|------|------|
| 指示書ID | M17-01 |
| バージョン | 1.0.3 |
| 推奨モデル | **Opus 4.8（Plan Mode 必須）**（スキーマ追加＋CSV 契約＋PATCH トライステート＋表示。非破壊だが波及先が多く正確さ要） |
| Plan Mode | **必須**（§3.3 の項目を実コード確認のうえ計画提示） |
| 機械レビュー | 必須（別チェックリスト: `M17-01-review-checklist.md`） |
| 承認ゲート | **G-j（着手前個別承認・phase3-overview §2.4）**。CHANGE-068 承認が着手の前提 |
| 並列性 | **独立**（波及が閉じており相互独立＝M17-overview §5 の並列可サブ）。ただし **実運用は直列**（開発者決定 2026-07-16＝worktree 並列を用いない）＝**M14-03c の後**に投入。**マイグレ連番は 000031**（先着調整は不要・**着手時に実ファイルで再確認**・§3.3-1） |
| 依存 | M16 完了（000023）。**CHANGE-068 承認**。M14-03b 非依存 |
| 想定所要時間 | 150〜210 分（Plan Mode 込み） |
| 作成者・作成日 | 設計担当 Claude（M14-03b/M17 期）/ 2026-07-09 |

> **文書ID ⇄ 実パスの正は `docs/handover/docs-map.md`（自動生成）**。

## 更新履歴

| 版 | 更新日 | 更新内容 |
|----|--------|----------|
| 1.0.3 | 2026-07-16 | **Plan Mode 回答の反映（i18n の適用範囲）**。**§4.4-i18n を新設**＝メディア 3 列の i18n サーフェスは **DES-005 の M16-06 境界に従う**（**詳細/比較＝i18n〔ja/en キー必須〕／編集画面のラベル・PDF/PNG エクスポート＝固定 ja**）。v1.0.2 以前の §2.1/§5.3 が「ja/en 両ロケールのラベル」と一括で書き、**エクスポート/入力欄は ja という正典（CHANGE-066/067 で DES-005 に明文化済み）と食い違っていた**ため是正。§11 に回答 4 を追加。**設計変更ではなく正典への整合**。 |
| 1.0.2 | 2026-07-16 | **マイグレ連番を 000031 へ是正**（M14-03c が **000029＋000030 の 2 連番を消費**＝指示書 §2.1/§9.2 の分割裁量。手書きクリア=000029／seedgen 生成 seed=000030。製造の伝達メモ 2026-07-16 §1）。v1.0.1 の「000030」は陳腐化。**着手時に実ファイルで次の空き番号を再確認すること**（§3.3-1）。 |
| 1.0.1 | 2026-07-16 | 着手前の状態同期（内容の設計変更なし）。(1) **マイグレ連番を 000030 に確定**（M14-03b が 000024〜000028・M14-03c が 000029 を消費／直列運用のため先着調整は不要）、(2) §11 確認事項 3 件を回答済みへ反映、(3) 並列性欄を「独立だが実運用は直列」へ同期。 |
| 1.0.0 | 2026-07-09 | 初版。G-j メディア 3 フィールド（link・video_path・image_path）。CHANGE-068 と対。 |

---

## 1. 背景と目的

### 1.1 背景

M17（発信者の流通基盤）で、コンボに解説動画/画像/URL を添付し流通させられるようにする。phase3-overview §M17 ⑤・G-j（§2.4）。スコープは**文字列参照まで**（本体はファイルを開く/配信/再生/存在確認をしない・開発者確認 2026-07-09）。

### 1.2 目的

- combos に `link`・`video_path`・`image_path`（各 TEXT・NULL 可）を追加する（**非破壊・非 dup・非 recipe**）。
- コンボ CSV に 3 列を**任意列末尾追加**（後方互換・verbatim 往復）。
- コンボ詳細/編集/比較にメディア表示・編集を追加する。`link` は http/https のみリンク化、path 2 種は文字列表示のみ。
- 検証は緩（閲覧不可を許容）。

### 1.3 このサブで作らないもの（スコープ外）

- ファイルを開く/配信/再生/プレビュー/存在確認（**文字列参照まで**）。
- リンク切れ検出・ファイル不在検出（許容）。
- 動画実体の配布・容量設計（phase3-overview §M17 ⑤ precedent）。
- dup/recipe への関与（3 列とも非対象）。
- 複数メディア（各 1 件・配列化しない）。

### 1.4 前提

- **CHANGE-068 承認済み**であること（G-j ゲート）。未承認なら着手しない。
- **マイグレ連番＝000031**（M14-03b が 000024〜000028・**M14-03c が 000029〔手書きクリア〕＋000030〔seedgen 生成 seed〕の 2 連番**を消費）。**直列運用のため先着調整は不要**（§3.3-1）。**着手時に実ファイルで次の空き番号を再確認する**（連番は先行サブの分割裁量で動く）。

---

## 2. 成果物

### 2.1 作成/修正するファイル

| ファイル | 内容 |
|---|---|
| マイグレ `000031_add_combo_media.sql`（**連番 000031**・**着手時に実ファイルで再確認**・§3.3-1） | combos に `link`/`video_path`/`image_path`（TEXT・NULL 可）を追加。down で 3 列 drop |
| `internal/model/combo.go` | Combo 構造体に 3 フィールド（`*string`・`omitempty`・db タグ付き） |
| repository（combos CRUD） | SELECT/INSERT/UPDATE に 3 列追従。PATCH は presence-detection トライステート（CHANGE-043）に 3 列追加 |
| DTO（combo request/response） | 3 フィールド加算・presence 検出（PATCH クリア用） |
| comboio（CSV export/import） | 3 列を任意列末尾追加（`requiredImportColumns` に含めない・verbatim） |
| コンボ詳細コンポーネント | 3 フィールド表示。link のスキーム制限リンク化 |
| コンボ編集コンポーネント | 3 フィールド入力欄（空=クリア） |
| 比較表コンポーネント（CompareTable） | 3 フィールド行 |
| i18n（**詳細/比較のみ**・ja/en 両キー必須・§4.4-i18n） | 詳細/比較のメディアラベル。**編集画面・PDF/PNG は固定 ja＝キーを足さない** |
| テスト（Go・Vitest・E2E） | §5 |

### 2.2 変更しないもの

- combos の既存列・他テーブル・スキーマ（3 列追加以外）。
- `DuplicateKey`（VAL-C02）・`recipe_hash`・`RecomputeComboCache`（3 列は非波及）。
- setups（メディアは combos のみ）。
- 既存マイグレ 000001〜000023（新規連番で追加）。

### 2.3 例外条項

- なし（本サブはスキーマ追加＋表示で例外的判断を要しない。code-facts と実コードに差があれば実コードを正とし完了報告に記録）。

---

## 3. 前提条件

### 3.1 必読ドキュメント

- **CHANGE-068 通知書**（本サブの設計判断の正）。
- **DES-003 §3.3**（combos 現行列・situation opaque・recipe_cache・重複判定キー）。
- **DES-002 §7.6**（コンボ CSV 契約・必須列/任意列の 2 種・任意列末尾追加標準・意味単位往復）。
- **DES-005**（コンボ詳細/編集/比較の現行構成・§5.13 export UI・§5.14 import UI）。
- **DES-006 §2.4**（重複判定キー＝メディアは非該当）・**§6**（VAL-I01〜I10・特に I08 URL 無害化）。
- **code-facts** §8（Combo 構造体・現行フィールド）・§9（repository）・§10（マイグレ・PATCH ハンドラ）・Props（ComboTable/CompareTable/詳細/編集）。
- **CHANGE-043**（PATCH presence-detection 単一トライステート＝3 列を同方式で追加）・**CHANGE-061/063**（任意列末尾追加の正典・後方互換）・**CHANGE-049**（パス制限の前例＝本サブは文字列扱いのため path 検証はしないが link スキーム制限は行う）。

### 3.2 前提事実（実ファイルで確認済・Plan Mode で再確認）

- combos 現行列に link/video/image は無い（追加は新規）。situation は opaque JSON（`*string`）。
- Combo 構造体は `internal/model/combo.go`。メタデータは `*string`/`*int` の omitempty ポインタ（memo・situation 等が前例）。
- PATCH `/api/combos/{id}` は presence-detection 単一トライステート（CHANGE-043）＝memo/situation 等と同じ経路に 3 列を足す。
- CSV は必須列/任意列の 2 種（CHANGE-061）＝3 列は任意列（`requiredImportColumns` に含めない）。
- 次マイグレ連番は **000031**（M16-07=000023／**M14-03b=000024〜000028**〔第一波 seed・完了済〕／**M14-03c=000029＋000030**〔ryu クリア＋再 seed・2 連番〕）。**直列運用のため連番競合は起きない**（開発者決定 2026-07-16）。**ただし連番は先行サブの分割裁量で動くため、数字を信用せず実ファイルで確認すること**。

### 3.3 着手前の確認（Plan Mode 必須）

1. **マイグレ連番の確認**: **000031** を使う（先着調整は不要＝直列運用）。**着手時に migrations ディレクトリを実査**し、000030 までが適用済みであることを確認する。**ズレていれば次の空き番号を使う**（本欄の数字より実ファイルが正＝先行サブの分割裁量で連番は動く）。**既存マイグレ 000001〜000030 は非改変**。down で 3 列 drop・冪等。
2. **model/DTO/repository の追従点**: Combo 構造体・combo request/response DTO・combos の SELECT/INSERT/UPDATE・PATCH presence 検出の実位置を実査（memo/situation の実装を範として同型追加）。
3. **CSV 追従点**: comboio の export 列順（末尾追加）・import の列マッピング・`requiredImportColumns` の定義位置。verbatim（解決・書換なし）。
4. **表示の追従点**: コンボ詳細/編集/比較の実コンポーネント（code-facts Props）と、link のリンク化に使える既存の無害化ユーティリティ（VAL-I08 の実装＝スキーム判定に流用できるか）。
5. **dup/recipe 非波及の確認**: `DuplicateKey`・`recipe_hash`・`RecomputeComboCache` が 3 列を参照しないこと（追加後も不変）を実コードで確認。
6. **i18n**: ja/en 両ロケールのラベル追加位置（playbook §4.13）。

---

## 4. 詳細仕様

### 4.1 スキーマ（マイグレ）

- combos に `link TEXT`・`video_path TEXT`・`image_path TEXT`（すべて NULL 可・デフォルト NULL）。
- up=3 列 ADD COLUMN、down=3 列 DROP COLUMN（SQLite の drop column 可否を確認・不可なら table rebuild パターン）。冪等・既存マイグレ非改変。

### 4.2 model/DTO/repository

- Combo 構造体（`internal/model/combo.go`）に `Link *string`（db:link, json:link,omitempty）・`VideoPath *string`（db:video_path, json:videoPath,omitempty）・`ImagePath *string`（db:image_path, json:imagePath,omitempty）。memo/situation の実装を範とする。
- combos の SELECT/INSERT/UPDATE に 3 列追従。
- **PATCH `/api/combos/{id}`**: presence-detection 単一トライステート（CHANGE-043）へ 3 列追加。**キー不在=不変更 / null=NULL クリア / 値=更新**。DTO が presence を検出し repository へ 3 状態を伝える（memo/situation と同一機構）。
- **dup/recipe 非関与**: `DuplicateKey`・`recipe_hash` に 3 列を加えない。PATCH で 3 列変更時も `RecomputeComboCache` を呼ばない（起き攻め CHANGE-063 と同型＝recipe 非対象）。

### 4.3 CSV（comboio）

- export: 既存列の**末尾に** `link`・`video_path`・`image_path` を追加（値なし=空セル）。
- import: 3 列を任意列として受理（`requiredImportColumns` に含めない＝旧 CSV 後方互換）。空セル=NULL・値=文字列を**verbatim**（パス/URL の解決・正規化・書換をしない）。
- 意味単位往復の不変を担保（export→import で 3 列の値が同一）。

### 4.4 表示（DES-005）

- **詳細**: 3 フィールド表示。`link` は値が http:// または https:// で始まる場合のみ `<a href rel="noopener noreferrer" target="_blank">` でリンク化、それ以外はテキスト表示（危険スキーム無害化）。`video_path`/`image_path` は**常にテキスト表示**（リンク化・遷移なし）。値 NULL の項目は非表示または空表示（既存メタデータ表示の流儀に合わせる）。
- **編集**: 3 フィールドの任意入力欄。空入力での保存=クリア（PATCH null）。URL/パスの形式強制はしない（緩検証）。
- **比較表**: 3 フィールド行（各コンボ列に値・無ければ空）。列ペアリング前提（M13-j 既知の前提）を崩さない。
- **PDF/PNG**: 3 フィールドの**文字列**を出力（画像実体の埋め込みはしない＝§1.3）。詳細画面の表示に準ずる。

#### i18n の適用範囲（**DES-005 の M16-06 境界に従う**・製造の Plan Mode 提起への回答 2026-07-16）

本サブは**新しい流儀を作らない**。DES-005（CHANGE-066/CHANGE-067 で正典化）が定める **i18n サーフェスの境界**にそのまま乗る:

| 箇所 | 扱い | 根拠 |
|------|------|------|
| **コンボ詳細・比較表**のメディアラベル | **i18n**（`ja.json`/`en.json` に**キーを ja/en 両方**投入。**英訳の文言品質は問わない＝仮英訳可**） | DES-005「en は詳細/比較の i18n サーフェスのみ」・**playbook §4.13**（キー追加時は parity テスト `locales.test.ts` が ja↔en 双方向を機械強制＝片方だけ足すと即落ちる） |
| **コンボ編集画面**のフィールドラベル・プレースホルダ | **固定 ja（ハードコード）＝i18n キーを足さない** | DES-005「**エクスポート/入力欄は ja（M16-06 境界）**」。既存の memo/situation 等と同一流儀 |
| **PDF/PNG エクスポート**のラベル | **固定 ja** | 同上（§3.3 の「英語参照不要」と整合） |

- **境界を破らないこと**（重大）: 編集画面・エクスポートを i18n 化すると**既存フィールドと不整合**になり、かつ **DES-005 の構成変更＝CHANGE 対象**になる。本サブのスコープ外。
- **「編集画面が i18n でないのは将来課題」**という認識は正しく、**既に登録済み**＝followup **§124(b)「export/入力欄の full en 化」**（別マイルストーン・英語ロケール整備と連動）／**§151 M13-j「export ラベルの i18n 散在」**（M23・英語ロケール連動）。**M17-overview §2.3 で M17 非対象と明記済み**＝本サブで手を付けない。

### 4.5 検証（DES-006 §6）

- 3 列とも緩検証。`link` はスキーム制限（http/https 以外はリンク化しない）で無害化＝保存は任意文字列可。`video_path`/`image_path` はパス検証なし（本体が開かない＝文字列扱い）。閲覧不可（リンク切れ・ファイル不在）は許容（エラーにしない）。
- import 時も 3 列に対する検証エラーを出さない（verbatim 受理）。

---

## 5. テスト要件（ケース数で語る）

### 5.1 Go

- マイグレ up/down（3 列追加・drop・冪等・既存マイグレ非改変）。
- repository: CREATE/GET/PATCH で 3 列の保存・取得・**トライステート**（不在=不変更 / null=クリア / 値=更新）を各列で検証。
- dup: 3 列が異なるだけのコンボが**重複と判定される**（VAL-C02 非関与の確認）。recipe_hash が 3 列変更で不変。
- CSV: export→import 往復で 3 列 verbatim 一致。旧 CSV（3 列なし）を後方互換で取込（3 列 NULL）。

### 5.2 Vitest / E2E

- 詳細: link の http/https リンク化・危険スキーム（`javascript:` 等）非リンク化・path のテキスト表示。
- 編集: 入力→保存→反映・空入力でクリア。
- 比較表: 3 フィールド行の表示。
- `make e2e` 非回帰。

### 5.3 i18n

- **詳細/比較で追加した i18n キーが ja/en 両方に存在**し、`locales.test.ts`（parity）が通ること（playbook §4.13。**仮英訳可**）。
- **編集画面・PDF/PNG のラベルに i18n キーを足していない**こと（固定 ja＝§4.4-i18n の境界）。

---

## 6. レビュー観点（別ファイル）

`M17-01-review-checklist.md` に従う。重点＝非破壊/非 dup/非 recipe・link スキーム制限（XSS 面）・CSV 後方互換・PATCH トライステート。

## 7. 完了条件（DoD）

### 7.1 機能

- combos に 3 列（NULL 可）・model/DTO/repository 追従・PATCH トライステート。
- CSV 任意列末尾 3 列・後方互換・verbatim 往復。
- 詳細/編集/比較のメディア表示・link スキーム制限リンク化・path テキスト表示。
- dup/recipe 非波及（テストで担保）。

### 7.2 自己テスト

- §5 をケース数で報告。`make e2e` 非回帰。

### 7.3 品質

- 禁則表現・簡体字・「起き攻け」誤字・「DR」略記の grep 除去。
- **i18n 境界の遵守**（§4.4-i18n）＝詳細/比較のキーは ja/en 両方（parity 通過）・編集/エクスポートは固定 ja。

### 7.4 ドキュメント

- 完了報告に Plan Mode 確定（連番・トライステート実装・スキーム制限方式）・DES 反映要点（CHANGE-068 の三点セット確定用）を記載。**製造は DES を直接編集しない**。

## 8. 参照ドキュメント

| 文書（実パス） | 節 | 用途 |
|------|-----|------|
| CHANGE-068 `docs/change-notes/CHANGE-068-notification.md` | 全 | 設計判断の正 |
| DES-003 `docs/design/03-data-model.md` | §3.3 | combos 列・dup キー |
| DES-002 `docs/design/02-architecture.md` | §7.6 | CSV 任意列・§4.2 PATCH |
| DES-005 `docs/design/05-screen-design.md` | 詳細/編集/比較 | 表示 |
| DES-006 `docs/design/06-validation.md` | §2.4/§6 | dup キー・緩検証 |
| code-facts `docs/handover/code-facts.md` | §8/§9/§10/Props | model・repository・マイグレ・PATCH・コンポーネント |

## 9. 注意事項・判断に迷ったら

### 9.1 推測で進めてはいけない

- マイグレ連番（M14-03b との調整・§3.3-1）。
- PATCH トライステートの実装位置（memo/situation の実コードを範に）。
- link リンク化の無害化（既存 VAL-I08 実装の流用可否）。

### 9.2 推測で進めてよい（明示のこと）

- 3 フィールドの UI 配置の細部（既存メタデータ表示の流儀に合わせる）。
- ラベル文言（**ja は仮でよい・確定は開発者**／**en は仮英訳で足りる**＝§4.4-i18n）。

### 9.3 不明時

- SQLite で DROP COLUMN が使えない場合の down は table rebuild（既存マイグレの前例に倣う）。
- dup/recipe に 3 列を足したくなったら止める（設計違反＝メディアは同一性に非関与）。

### 9.4 Plan Mode で提示すべき項目

- §3.3 の 6 項目。とくに 1（連番調整）と 5（dup/recipe 非波及の確認）。

## 10. 完了後の次ステップ

- 完了報告を受けて設計担当が CHANGE-068 の三点セット（改訂 DES-003/002/005/006 ＋ change-report-068 ＋ registry 068 反映）を確定。
- M17-01 は独立サブ＝他 M17 サブ（02 系列・05 系列）と非依存。

## 11. 開発者への確認事項

> **状態（2026-07-16）**: **全 3 件 回答済み＝着手を妨げる未確認事項はない**。以下は回答の記録（製造は再確認不要）。

| # | 論点 | 回答（2026-07-16） |
|---|------|-------------------|
| 1 | マイグレ連番 | **000031**。直列運用（M14-03b=000024〜000028 → **M14-03c=000029＋000030**〔2 連番＝クリアと生成 seed を分離〕→ 本サブ）のため**先着ルールは適用しない**。**着手時に実ファイルで再確認**（§3.3-1）。 |
| 2 | `link` のスキーム制限 | **http/https のみリンク化**（他スキームは非リンクのテキスト表示）。CHANGE-068 §2.3-h・§4 の確定どおり（G-j 承認に含まれる）。 |
| 3 | PDF/PNG へのメディア出力 | **URL/パスの文字列のみ**を載せる（画像実体の埋め込みはしない）。CHANGE-068 §2.3-k・§7-3 の暫定案どおり。 |
| 4 | i18n の適用範囲 | **DES-005 の M16-06 境界に従う**＝**詳細/比較のみ i18n**（ja/en 両キー・仮英訳可）／**編集画面・PDF/PNG は固定 ja**（既存流儀と同一・キーを足さない）。編集画面の i18n 化は followup §124(b)/§151 M13-j の別マイルストーン＝**本サブ非対象**。 |

---

*以上、M17-01 製造指示書 v1.0.3。配置 `docs/instructions/phase3/M17-01-media-fields.md`。CHANGE-068 と対。対のレビューチェックリストは `docs/instructions/phase3/reviews/M17-01-review-checklist.md`。*
