# change-report-022: CHANGE-022 反映完了レポート

| 項目 | 内容 |
|------|------|
| 対応 CHANGE | CHANGE-022 v0.3.0(moves フレームデータ列追加 + is_aerial + setup_only + FR704 CSV 契約定義 + 取込エンドポイント是正) |
| 反映日 | 2026-06-08(機械レビュー指摘 1〜8 反映の amendment を含む) |
| 反映者 | 設計担当 Claude(フェーズ2 キックオフ担当) |
| 起票時期 | M8 着手前(フェーズ2 最初の CHANGE) |
| 承認 | 開発者(2026-06-08 承認。amendment 0.3.0 も承認) |

---

## 1. 修正されたファイル一覧(設計書本体 = CHANGE 対象)

| 文書 | 旧 → 新バージョン | 反映場所 |
|------|-----------------|----------|
| DES-003(03-data-model.md) | v1.16.0 → v1.17.0 | §2 ER図、§3.3 moves |
| DES-002(02-architecture.md) | v1.9.0 → v1.10.0 | §4 API表、§7.2、§7.4、§7.5(新設) |

> DES-004 は改訂なし(参照のみ)。機械レビュー指摘 1(official_en 不在)は DES-004 の漏れではなく CSV 契約側の誤りであり、CSV 契約を official_ja_move のみに是正して解消(下記 §4)。

## 2. 修正概要(ファイル別)

### DES-003 v1.17.0

| 箇所 | 修正内容 |
|------|----------|
| §2 ER図 | moves に `startup` / `active` / `total` / `on_hit` / `on_block` / `drive_gauge_decrease_guard` / `is_aerial` / `setup_only` を追加 |
| §3.3 moves テーブル | 上記8列を追加。`startup` / `total` を NOT NULL、`active` / `on_hit` / `on_block` / `drive_gauge_decrease_guard` を NULL可、`is_aerial` / `setup_only` を BOOLEAN NOT NULL DEFAULT false。既存列(damage / combo_scaling / 各ゲージ / properties / raw_data / category)不変 |
| §3.3 末尾注記 | active=持続フレーム数、recovery は moves 非永続(CSV のみ)・total は取込時算出(式は開発者定義)、全体表記/空振りは要確認強調+FR703 手修正、キャンセル列・on_punish_counter 不採用、**properties は取込時にコード値正規化**、**ラッシュ可否は category + is_aerial で導出**(ラッシュ版は取込スコープ外・FR703 生成) |

### DES-002 v1.10.0

| 箇所 | 修正内容 |
|------|----------|
| §4 API表 | `POST /api/admin/fetch-official` 廃止、`POST /api/import/moves`(FR704)新設、`/api/import/csv` / `/api/export/csv` をコンボ CSV(FR401/FR405)と明記し区別 |
| §7.2 | 出力を CSV へ是正(日英行対応マージ)、DB 反映は本体 FR704・total 算出も本体側 |
| §7.4 | 検証責務をツール側 / 本体側に分割。**NFR104 のみ引用**(NFR103 はローカル入力の本取込と文脈相違のため引用せず)。サイズ上限記述は削除し M9 設計へ送り(DES-001 の 1000 行はコンボ CSV の値で流用しない旨を明記) |
| §7.5(新設) | FR704 CSV フォーマット仕様。**name_ja → official_ja_move のみ**(name_en 列は CSV 非同梱、英語版はツールが属性正規化・検証に内部利用)、**properties はコード値正規化**、**is_aerial 列**(ジャンプ名 true・接頭辞なし空中技は FR703 手動)、recovery は CSV のみ非永続、ラッシュ版は取込スコープ外で FR703 生成、code はツール採番 |

## 3. 派生改訂(CHANGE 対象外・自由改訂、§3 登録対象外)

| 文書 | 旧 → 新バージョン | 内容 |
|------|-----------------|------|
| SUPP-001 | v1.19.0 → v1.20.0 | §4.1 にフェーズ2以降は phase2-overview を正本とする旨を追記 + 前提文書欄を現行版へ更新(機械レビュー指摘 8) |
| change-number-registry.md | v1.9.0 → v1.10.0 | §1 で 022 を使用済み(次回 023)、§3 改訂表に DES-003 / DES-002 の2行、§4 履歴に 1.10.0 |

## 4. 機械レビュー指摘への対応(amendment 0.3.0)

| 指摘 | 重大度 | 対応 |
|------|--------|------|
| 1. official_en プリセット不在 | 重大 | CSV 契約を `name_ja → official_ja_move` のみに是正。name_en は非取込(EN は属性正規化・検証に内部利用)。英語技名格納は英語ロケール着手時(フェーズ3以降)に再取込。DES-004 改訂なし |
| 2. properties 格納規約矛盾 | 中 | 「素直格納」を撤回し取込時にコード値正規化(DES-003 §3.3 既定値と整合) |
| 3. official_ja_move 改善版との緊張 | 中 | §3.2 の改善対象は連結子・アイコン・状況情報で技名文字列は公式名、と CSV 契約に明記(非衝突) |
| 4. 通知書が未承認のまま | 中 | 通知書を v0.3.0 承認済み・反映済みへ更新 |
| 5. §7.4 サイズ上限の付け過ぎ・誤帰属 | 軽微 | 当該記述を削除し M9 設計へ送り。DES-001 の 1000 行はコンボ CSV の値で流用しない旨を明記 |
| 6. ラッシュ版の充填未定義 | 軽微 | CSV スコープ外と明記 + `is_aerial` 追加でラッシュ可否を導出 + FR703 で通常技・特殊技から生成 |
| 7. NFR103 引用の文脈ずれ | 軽微 | §7.4 を NFR104 のみへ是正 |
| 8. SUPP-001 前提文書欄の陳腐化 | 参考 | SUPP-001 前提文書欄を現行版へ更新 |

## 5. 影響範囲表との照合(漏れ検知)

CHANGE-022 v0.3.0 §4.1 影響範囲表の設計書本体は DES-003・DES-002 の2件で、いずれも反映済み。**未反映なし**。DES-004 は参照のみで改訂対象外(指摘 1 の解消は CSV 契約側で完結)。

用語 grep セルフチェック(設計書全体):
- `fetch-official` は API表から除去済み(残存はステータス行・通知書・registry 履歴行のみ = 意図的記録)。
- `JSONまたはSQL` / `official_en`(CSV 反映先としての) 残存なし。
- 新規列(is_aerial 等)は DES-004/005/006/REQ-001 から参照されず追従漏れなし。

## 6. 未反映・後続作業

- model-allocation.md: フェーズ番号注記 + M8 セクション追記は m8-overview / phase2-overview 確定時。
- 並列ツール委任 brief(CSV 契約引き継ぎ): 作成可能。
- phase2-overview ドラフト(M8〜M12 階層構成): 作成可能。
- 製造工程 M8-01: 移行手順(既存 seed のフレーム列 backfill / 一時デフォルト / seed 再生成)と total 算出式(開発者定義)を着手前確認として指示書で明示。

---

*以上、change-report-022 v1.1.0(amendment 0.3.0 反映)*
