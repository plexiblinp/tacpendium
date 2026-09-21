# CHANGE-030 通知書: M9-02 完成に伴う取込 API/データ契約の確定

| 項目 | 内容 |
|------|------|
| 通知書ID | CHANGE-030 |
| バージョン | 1.0.0（承認・反映済み） |
| 起票日 | 2026-06-14 |
| 起票者 | 設計担当 Claude（フェーズ2 継続担当・M9-02 スパイン） |
| 承認者 | 開発者（2026-06-14 承認） |
| ステータス | 承認・反映済み（DES-002 v1.15.0 / DES-003 v1.20.0 / DES-005 v2.15.0、change-report-030、registry v1.17.0） |
| 影響範囲（設計書本体） | DES-003 §3.3（raw_data の確定キー構造）、DES-002 §4.2（preview/commit のリクエスト形状）+ §7.5（FR701/FR704 正規化責務の明確化注記）、DES-005 §5.17（WarningCode enum と errors[]/importable の分離） |
| 前提文書 | M9-02 製造完了連絡（A-2-1/2-2/2-3・A-3、2026-06-14）、M9-02-instruction v1.0.3 §4.5/§4.6/§4.7、CHANGE-027（raw_data キー）、CHANGE-029（取込エンドポイント）、DES-002 v1.14.0 §4.2/§7.5、DES-003 v1.19.0 §3.3、DES-005 v2.14.0 §5.17 |
| 関連 | M9-02 完成時に確定した、M9-03（FR703 手動修正）・取込 UI が依存する API/データ契約を設計書本体へ確定する。スキーマ・enum・total 式・取込スコープは CHANGE-022/025/026/027/028/029 で確定済みで本 CHANGE では変更しない |

---

## 1. 変更の概要

M9-02（FR704 アプリ取込）の製造で確定した、後続（M9-03 手動修正・取込 UI）が依存する API/データ契約を設計書本体へ確定記載する。実装挙動の変更ではなく、**実装裁量（指示書 §9.2）で確定した契約を暗黙仕様にせず明文化**するもの。

1. **DES-003 §3.3**: `raw_data` の確定 JSON キー構造を明記（M9-03 グリッド編集器がパースするため）。
2. **DES-002 §4.2**: `/preview`・`/api/import/moves`（commit）のリクエスト形状を明記（CHANGE-029 はパスと役割を記載したが、リクエストボディ形状は未記載）。
3. **DES-002 §7.5**: FR701（ツール）/ FR704（本体）の正規化責務分担を注記。
4. **DES-005 §5.17**: 要確認強調の API 表現（WarningCode enum）と、検出エラー（取込不能）の `errors[]` + `importable: false` 分離を明記。

---

## 2. 変更の理由

- **raw_data キー（DES-003）**: M9-03 の手動修正器が raw_data をパースして編集する。キー名が暗黙だと M9-03 が実装詳細に依存することになり、retrospective「暗黙仕様を作らない」に反する。CHANGE-027 で command/condition/properties 残余を §3.3 に記載済みの延長として、確定キー構造を明記する。
- **リクエスト形状（DES-002）**: commit は CSV 再アップロード + 選択行指定という設計（サーバ側プレビューセッションを持たず冪等再解析する）で、M9-03・UI がこの形に依存する。CHANGE-029 で未記載のため補う。
- **責務分担注記（DES-002 §7.5）**: 実 CSV では on_hit/on_block の退避（D/※N/範囲）・properties 正規化・category 写像は FR701 ツール側で一次完了済みで、本体 §4.5 の退避は防御的二重化として機能する（実データではほぼ発火しない）。この責務分担が §7.5 の文面と実態でずれると後続が誤解するため明確化する（A-3）。
- **WarningCode/errors（DES-005）**: §5.17 の要確認強調を、API の WarningCode enum + errors[]/importable で実装した。UI と M9-03 がこの分類に依存する。

---

## 3. 変更の内容

### 3.1 DES-003 §3.3: raw_data の確定キー構造

**現行**:

> | raw_data | JSON | NULL可 | 備考欄や公式HTML由来の生データ一式。コマンド・前提条件の退避値（キー `command` / `condition_ja` / `condition_en`、CHANGE-027）、properties の残余（CHANGE-022）を含む。フェーズ2では保持のみで消費機能は未実装 |

**訂正後**:

> | raw_data | JSON | NULL可 | 備考欄や公式HTML由来の生データ一式を、次の確定キー構造で保持する（いずれも空なら省略、CHANGE-030）。`notes`（notes 原文ブロック）/ `notes_tool`（`【ツール付記】` 以降の付記ブロック）/ `command`・`condition_ja`・`condition_en`（コマンド・前提条件、CHANGE-027）/ `properties_extra`（複数属性の余り＝CHANGE-022 の properties 残余）/ `import_notes`（本体が取込時に付与した on_hit/on_block 等の退避メモ、配列）。FR703 手動修正器（M9-03）はこのキー構造をパースする。フェーズ2では保持のみで消費機能は未実装 |

### 3.2 DES-002 §4.2: preview / commit のリクエスト形状

§4.2 の `/api/import/moves/preview` と `/api/import/moves` の説明に、リクエスト形状を追記する。

> `POST /api/import/moves/preview`（追記）: リクエストは multipart（`file` = 取込 CSV）。
> `POST /api/import/moves`（commit、追記）: リクエストは multipart（`file` = CSV 再アップロード + `selected` = 取込対象行を指定する `[{characterCode, moveCode}]` の JSON 文字列）。サーバ側プレビューセッションを持たず、commit 時に CSV を再解析（preview と共通サービス層）してから選択行のみ upsert する（冪等）。

### 3.3 DES-002 §7.5: FR701 / FR704 の正規化責務分担（注記）

§7.5 に次の注記を追加する。

> **正規化の責務分担（FR701 / FR704）**: on_hit/on_block の値退避（`D`→空欄+付記、`※N`→数値+付記、範囲→空欄+原文退避）・properties のコード値正規化・category 写像は、実運用では **FR701 取込ツール側で一次完了**している（実 CSV で確認）。本体 FR704 はこれらを**防御的に再正規化・退避**する（不正・想定外 CSV に備える二重防御）。したがって §7.5 の本体側退避規則は「ツール出力が想定どおりなら発火しない防御層」であり、両者の責務記述（本書 / TOOL-002）はこの前提で整合させる。

### 3.4 DES-005 §5.17: WarningCode enum と errors[]/importable の分離

§5.17 の「要確認強調」記述を、API 表現として確定する。

> **現行**: 要確認強調：recovery 要確認語（…）を含む行 / `total` が NULL の行 / 未知の combo_scaling キーを含む行 / 未知 properties の行 / 通常投げ 3 件目以降 / 検出エラー行
>
> **訂正後**: 要確認強調は API の `warnings`（WarningCode enum）で表現し、対応行を強調する。値: `recovery_word`（recovery 要確認語＝空振り/増加/減少/全体/変化）/ `total_null`（total 算出不能）/ `unknown_combo_scaling_key`（未知 combo_scaling キー）/ `unknown_properties`（未知 properties）/ `extra_throw`（通常投げ 3 件目以降）。**検出エラー（取込不能の行）は `warnings` ではなく `errors[]` + `importable: false` で表現**し、取込対象から除外する（要確認＝取込可能・要注意、エラー＝取込不可、を区別して強調表示する）。

---

## 4. 影響範囲

### 4.1 設計書本体（CHANGE 対象）

| 文書 | 現バージョン | 改訂箇所 |
|------|------------|----------|
| DES-002 | v1.14.0 → v1.15.0 | §4.2 preview/commit のリクエスト形状追記 + §7.5 FR701/FR704 正規化責務分担の注記 |
| DES-003 | v1.19.0 → v1.20.0 | §3.3 raw_data の確定キー構造（notes/notes_tool/command/condition_ja/condition_en/properties_extra/import_notes、空なら省略）を明記 |
| DES-005 | v2.14.0 → v2.15.0 | §5.17 要確認強調を WarningCode enum + errors[]/importable の分離として確定 |

> REQ-001 / DES-004 / DES-006 は改訂しない。スキーマ・enum・total 式・取込スコープ・combo_scaling キーは既存 CHANGE で確定済み。

### 4.2 派生ドキュメント（CHANGE 対象外・自由改訂）

- change-number-registry: 030 を使用済みへ、次回採番 031（反映時）。
- change-report-030（新規、反映時）。
- M9-overview: §3.x に raw_data キー・commit 形状・WarningCode を反映（M9-03 設計入力として）。

### 4.3 実装（製造工程・参考）

- 本 CHANGE は M9-02 の実装挙動を変えない（確定済み挙動の明文化）。M9-03 はこの契約（raw_data キー・WarningCode・commit 形状）を前提に設計する。

---

## 5. 移行影響

- データ移行要否: なし。実装挙動・データ形式の変更はなく、確定済み契約の明文化のみ。

---

## 6. リスク

| リスク | 内容 | 緩和策 |
|--------|------|--------|
| raw_data キーの将来変更 | M9-03 がキー名に依存し、後で変えると破壊的 | 確定キーとして §3.3 に固定。変更時は CHANGE で M9-03 と同期 |
| 責務分担注記の解釈 | 「本体退避は発火しない」と読んで本体ロジックを削る誤解 | 注記で「防御層として保持」と明記。レビューで本体ロジック削除を禁止 |
| WarningCode の UI 不整合 | enum 値と DES-005 強調仕様のずれ | §5.17 に enum を確定記載し UI と単一化 |

---

## 7. 承認チェックリスト

- [ ] DES-003 §3.3 raw_data に確定キー構造（notes/notes_tool/command/condition_ja/condition_en/properties_extra/import_notes、空なら省略）を明記してよいか。
- [ ] DES-002 §4.2 に preview（multipart file）/ commit（multipart file + selected[]）のリクエスト形状を追記してよいか。
- [ ] DES-002 §7.5 に FR701/FR704 の正規化責務分担注記（ツール一次正規化 + 本体防御二重化）を追加してよいか。
- [ ] DES-005 §5.17 を WarningCode enum（recovery_word/total_null/unknown_combo_scaling_key/unknown_properties/extra_throw）+ errors[]/importable 分離として確定してよいか。
- [ ] 本 CHANGE を **030**、DES-002 v1.14.0→v1.15.0 / DES-003 v1.19.0→v1.20.0 / DES-005 v2.14.0→v2.15.0 とする採番・版上げで問題ないか。

---

*以上、CHANGE-030 通知書 v1.0.0（承認・反映済み）*
