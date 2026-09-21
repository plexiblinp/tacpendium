# 指示書 M9-04: FR703 編集グリッド仕上げ（要確認再導出・ラッシュボタン非活性化・表示順）

| 項目 | 内容 |
|------|------|
| 指示書ID | M9-04 |
| バージョン | 1.0.2 |
| 推奨モデル | Sonnet 4.6（既存 WarningCode 判定の再利用 + クライアント側活性条件・表示ソート。創発判断小。model-allocation v1.12.0） |
| Plan Mode | **必須**（§3.4 / §9.4） |
| 機械レビュー | 必須（別チェックリスト: `M9-04-review-checklist.md`） |
| 並列性 | 単独。M9-03 の編集グリッドに作用 |
| 依存指示書 | M9-03（検収完了）。CHANGE-031/032/033 反映済み |
| 想定所要時間 | 90〜150 分（要確認再導出 + クライアント側 2 項目 + テスト） |
| 作成者・作成日 | 設計担当 Claude（フェーズ2 継続担当・M9 スパイン）/ 2026-06-14 |

## 更新履歴

| バージョン | 更新日 | 更新内容 |
|-----------|--------|----------|
| 1.0.0 | 2026-06-14 | 初版（M9-04-overview v0.1.0 と対） |
| 1.0.1 | 2026-06-14 | 設計 overview を M9-overview §12 に統合（独立 M9-04-overview 廃止）に伴い §3.1/§8 の参照を M9-overview §12 へ張替。中身（B-4 + B-2-light）は不変 |
| 1.0.2 | 2026-06-14 | M9-04 Plan Mode 2 項目を確定反映（CHANGE-034）。§3.4 に確定（接地点=warnings 加算 / 判定一致=movesimport 共有・dedup）、§4.1 に判定の置き場所と文書影響解消を記載 |

---

## 1. 背景と目的

### 1.1 背景

- M9-03（FR703 手動修正）検収後の**仕上げ微修正**。M9-03 検収申し送り（後続課題バックログ）から、準備が整い現在のデータ整備に直接効く軽量項目を M10 前に実施する。
- 取込済 moves は WarningCode を永続化していないため、編集グリッドは要確認シグナルを `total NULL` の代理しか使えていない（バックログ A-2 / B-4）。FR703 は本来「要確認行の手動補正」が目的で、要確認種別を取りこぼすと補正対象を見落とす。

### 1.2 目的

完了時に達成される状態:

- 編集グリッドが、取込プレビュー（画面17、§5.17）と**同じ WarningCode で全要確認種別を強調**する（保存済みデータから再導出）。
- ラッシュ版が生成済みの行は「ラッシュ版」ボタンが事前に非活性。
- 編集グリッドの行を表示上で並び替えできる（DB の並びは不変）。

### 1.3 スコープ外（後続マイルストーン）
- B-1 命名クラスタ（official_ja 編集・ラッシュ命名・投げ命名）→ M9-05。
- B-2-heavy（行追加/削除/コピー・新規行 code/category 編集）→ M9-06。
- B-3 フレーム計算式（ラッシュ/ジャンプ）→ 開発者課題（並行）。
- B-5 複数 CSV 取込、B-6 検証ガード（M9-06 同梱）。

---

## 2. 成果物

### 2.1 作成・修正するファイル（想定。実配置は既存構成に合わせる）

| ファイル | 内容 |
|---|---|
| `internal/service/move/*`（要確認判定の共有化） | 取込プレビューの WarningCode 判定（recovery_word/total_null/unknown_combo_scaling_key/unknown_properties/extra_throw）を、**取込済 move からも再導出できる共有関数**に整理。§4.1 |
| `internal/api/move/dto.go`（MoveResponse 拡張） | `warnings: WarningCode[]` を加算（サーバ算出）。§4.1 |
| `internal/api/move/*`（一覧ハンドラ） | `GET /api/moves` 応答で各行の warnings を算出して返す（extra_throw はキャラの throw 集合が要るため、キャラ単位の集合を使って算出）。§4.1 |
| `web/src/features/moves/MoveEditGrid.tsx` ほか | 要確認強調を warnings 全種に拡張（§5.17 と同表示）。ラッシュボタン非活性化（§4.2）。表示順並び替え（§4.3） |
| `web/src/features/moves/types.ts` | `moveNeedsConfirmation`（現 total==null）を warnings ベースへ |

### 2.2 変更しないもの

- moves スキーマ（列追加なし）。warnings は**永続化せず読取時算出**（バックログ B-4 案2）。
- `PATCH /api/moves/:id` / `POST /api/moves/:id/rush-variant` / `GET /api/moves/:id` の既存契約（CHANGE-031/032）。
- 取込パイプライン（FR704）・取込プレビュー画面17。
- DB の並び順・主キー（表示順並び替えは表示のみ）。

### 2.3 例外条項

- `MoveResponse` への `warnings` 加算は**後方互換の追加**（既存 consumer は無視）。CHANGE-034 で DES-002 §4.2 に明記する。

---

## 3. 前提条件

### 3.1 必読

- M9-overview §12（M9-04 設計）+ §11（M9 完了状況）。設計方針・Plan Mode 接地点はここに統合
- DES-002 v1.17.0 §4.2（MoveResponse / GET /api/moves）、DES-005 v2.18.0 §5.17（取込プレビューの WarningCode 強調）/ §5.18（編集グリッド）
- DES-003 v1.20.0 §3.3（combo_scaling 正準キー initial/combo/immediate/multiplier_scaling、properties 値域、category、is_aerial）
- 取込プレビューの WarningCode 判定実装（再利用元。`internal/service/...` の preview ロジック）、code-facts §2/§4/§7

### 3.2 参照不要
- M9-05/M9-06 の対象（命名・行 CRUD）、取込パイプライン内部。

### 3.3 着手前の確認（Plan Mode 必須。§9.4 と対応）

1. **要確認再導出の接地点**: `MoveResponse` への `warnings: WarningCode[]` 加算（サーバ算出、推奨）で確定してよいか。代替（クライアントで算出可能な 3 種のみ強調 + unknown_combo_scaling_key は編集時 `GET /api/moves/:id` で表示／combo_scaling を narrow に追加）との比較。**recovery_word は保存データから再導出不可で total_null に吸収される**点の確認。
2. **判定ロジックの一致**: 取込プレビュー（§5.17）の WarningCode 判定と編集グリッドの再導出を**同一の共有実装**に寄せる（二重実装の乖離防止）。extra_throw はキャラの throw 集合を要する点の実装方針。

> **Plan Mode 確定（開発者決定 2026-06-14、CHANGE-034 反映済み）**:
> - **1（接地点）**: `MoveResponse` に `warnings: WarningCode[]` を**後方互換加算**（サーバ算出）。combo_scaling 等は算出に**内部使用のみで JSON 非露出**（既存フィールド不変・乖離ガード §4.8 を壊さない）。recovery_word は再導出不可で total_null に吸収。
> - **2（判定一致の置き場所）**: **movesimport を共有元**にする（既存 knownProperties / comboScalingKeys / WarningCode を再利用し、保存済み move からの再導出関数を追加。`move/service.go` の重複 knownProperties を共有参照へ寄せて dedup）。`movewarn` 新パッケージ抽出は将来の clean refactor 候補（今はやらない）。parity は単一ホワイトリスト参照で保証。

---

## 4. 詳細仕様

### 4.1 要確認シグナルの再導出（MoveResponse `warnings` 加算）

- 取込プレビューの WarningCode 判定を**共有関数**に整理し、取込済 move（+ 必要な文脈）からも算出できるようにする。算出種別:
  - `total_null`: `total IS NULL`（recovery_word の取込時要確認はデータに残らず、解析不能行は total NULL に吸収＝total_null で表現）。
  - `unknown_properties`: properties がホワイトリスト（high/mid/low/throw/projectile/air_projectile）外。
  - `unknown_combo_scaling_key`: combo_scaling のキーが正準（initial/combo/immediate/multiplier_scaling）外。
  - `extra_throw`: 通常投げ 3 件目以降（category=throw をキャラ内で数える。**キャラ単位の集合が要る**）。
- `GET /api/moves`（MoveResponse）に `warnings: WarningCode[]`（空配列可）を**加算**して返す。サーバが各行のフルデータ + キャラの throw 集合から算出。
- 編集グリッドは warnings をそのまま強調表示（取込プレビュー §5.17 と同じ WarningCode 表現）。`moveNeedsConfirmation` を warnings ベースへ。
- **判定の置き場所（Plan Mode-2 確定）**: 取込プレビューの WarningCode 判定を **movesimport の共有実装**として整理し、保存済み move からの再導出関数を同パッケージに追加。`move/service.go` の重複 knownProperties は共有参照へ寄せて dedup（検証 select〔#4〕と warnings 判定が単一ホワイトリストを参照＝parity 保証）。`move` ハンドラが movesimport を呼ぶ（循環なきこと）。中立 `movewarn` 抽出は将来の clean refactor 候補（backlog 記録）。
- **文書影響（解消済み）**: `MoveResponse.warnings` 加算と §5.18 要確認強調拡張・表示順は **CHANGE-034 で DES-002 §4.2（v1.18.0）/ DES-005 §5.18（v2.19.0）に記載済み**。判定の置き場所（movesimport 共有）は実装判断で DES 変更なし。

### 4.2 ラッシュ版生成済みボタンの非活性化

- 当該 move の rush_variant（`code = rush_<元技code>`）が**既に一覧に存在**するなら「ラッシュ版」ボタンを disabled（クライアント判定。グリッドはキャラの全 moves を読むため API 追加不要）。
- 既存の活性条件（対象カテゴリ `normal/unique` ∧ `is_aerial=false`、dirty ガード＝レビュー #2）に「未生成」を AND する。
- 後段の 409（既存）経路は保険として残す（事前非活性 + 二重防御）。

### 4.3 表示順の並び替え

- クライアント表示のみ（列ソート or 行ドラッグ）。**主キー・DB の並び順は不変**。API・スキーマ不変。
- DES-005 §5.18 に「表示順の並び替え（表示のみ）」を一文追記（CHANGE-034 に同梱）。

### 4.4 検証ガード（対応不要・注記）

- 現 PATCH 対象に NOT NULL/FK 列がなく制約違反経路がないため、M9-04 では 400 マッピング不要（バックログ B-6 は M9-06 で対応）。

---

## 5. テスト要件

### 5.1 必須テスト

Go test:
- warnings 再導出の各種別（total_null / unknown_properties / unknown_combo_scaling_key / extra_throw）が正しく付与されること。
- **取込プレビューの WarningCode 判定との一致**（同一共有関数を使う、または同一入力で同一結果のパリティテスト）。
- extra_throw がキャラ内の通常投げ 3 件目以降に正しく付くこと。
- warnings 加算後も `GET /api/moves` の既存フィールド（MoveResponse）が不変であること。

Vitest:
- 編集グリッドが warnings 全種を強調すること（total_null 以外も）。
- rush_variant 既存行で「ラッシュ版」ボタンが disabled。
- 表示順並び替えが表示のみで動作（保存・API を呼ばない）。

### 5.2 E2E（seed 非依存）
- 既存 moves-edit / combo-crud / 取込 spec が引き続き通過。視覚/レスポンシブは手動継続。

---

## 6. レビュー観点（別ファイル）

機械レビューは `M9-04-review-checklist.md` に従う（本指示書と対で設計担当が作成）。

---

## 7. 完了条件（DoD）

- 編集グリッドが warnings 全種を §5.17 と同表現で強調する。
- rush_variant 既存行のボタンが非活性。表示順並び替えが表示のみで動作。
- warnings 判定が取込プレビューと一致（パリティテスト通過）。
- `GET /api/moves` の既存契約（warnings 以外）不変。
- §5 のテストが全通過（ケース数で報告）。`make e2e` 通過。
- DES 追記（warnings・§5.18）は設計担当が CHANGE-034 で対応（製造担当は実装のみ）。
- 完了報告に Plan Mode 確定（接地点・判定一致）とテストケース数を含む。

---

## 8. 参照ドキュメント

| 文書 | 節 | 用途 |
|------|-----|------|
| M9-overview | §12（M9-04）・§11 | 設計方針・Plan Mode 接地点（旧 M9-04-overview 統合先） |
| DES-002 v1.17.0 | §4.2 | MoveResponse / GET /api/moves |
| DES-005 v2.18.0 | §5.17 / §5.18 | WarningCode 強調 / 編集グリッド |
| DES-003 v1.20.0 | §3.3 | combo_scaling 正準キー / properties 値域 / category |

---

## 9. 注意事項・判断に迷ったら

### 9.1 推測で進めてはいけない事項
- 接地点（warnings の載せ方）・判定ロジックの一致方針（§3.4 を Plan Mode で確定）。
- `GET /api/moves` の既存フィールド（warnings 以外）は不変。warnings は加算のみ。

### 9.2 推測で進めてよい事項
- 表示ソートの UI（列ソート/ドラッグ）・ハンドラ内部構成は既存パターンに合わせて裁量。

### 9.3 不明事項発見時
- Plan Mode 質問書（playbook §8.4）で開発者へ。

### 9.4 Plan Mode 必須項目
- §3.4 の 2 項目（接地点 / 判定ロジックの一致・extra_throw 文脈）。

---

## 10. 完了後の次ステップ
- **CHANGE-034**（設計担当）: DES-002 §4.2（MoveResponse に `warnings` 加算）+ DES-005 §5.18（要確認強調を warnings 全種へ・表示順並び替え追記）。本指示書 §4.1/§4.3 確定後・着手前に起票。
- M9-05（B-1 命名クラスタ）の策定へ。
- model-allocation に M9-04 を追記済み（v1.12.0）。

---

*以上、M9-04 製造指示書 v1.0.2*
