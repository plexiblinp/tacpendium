# change-report-042: CHANGE-042 設計書本体 反映完了レポート

| 項目 | 内容 |
|------|------|
| 対象 CHANGE | CHANGE-042(custom_states クリア不能バグ修正に伴う PATCH situation トライステート正典化、M11-01 事後修正) |
| 反映日 | 2026-06-20 |
| 反映担当 | 設計担当 Claude(フェーズ2 本流スパイン・M11 担当) |
| 起票文書 | `CHANGE-042-M11-01-patch-situation-clear-sentinel.md`(製造担当ドラフトを設計担当が確定) |
| 背景 | M11-01 事後に判明した「custom_states あり→なし がクリアできない」バグの修正(空文字センチネル方式、開発者 E2E 確認済) |

---

## 1. 反映したファイル(旧→新バージョン)

| 設計書 | 旧 → 新 |
|--------|---------|
| DES-002 アーキテクチャ設計書 | v1.21.0 → **v1.22.0** |

## 2. 修正概要

### DES-002(v1.22.0)
- **§4.2 `PATCH /api/combos/{id}`**: `situation` のトライステートを明文化。未指定／JSON `null`＝不変更、**空文字 `""`＝NULL クリア（custom_states 全 off）**、非空文字列＝更新。CREATE/PUT（INSERT で NULL 保存可）と3経路がクリア挙動でも対称化する旨を追記。CHANGE-041 の `nil=不変更` は維持。
- **ヘッダ**: バージョン 1.22.0、ステータスに CHANGE-042 反映を前置。

## 3. 影響範囲に挙がったが「変更しなかった」ファイル(漏れ検知)

| 設計書 | 判断 | 根拠 |
|--------|------|------|
| DES-005 画面設計書 | **変更なし** | 付与/表示（§5.7 表示項目6・§5.6 表示項目5）は全 off で非表示＝既に規定済み。クリアは API 層の表現で画面仕様は不変 |
| DES-006 バリデーション設計書 | **変更なし** | §2.4（custom_states 入力は検証しない）は不変。クリアは検証ではない |
| DES-003 データモデル設計書 | **変更なし** | `combos.situation` TEXT 既存。スキーマ変更なし。クリアは NULL 保存（既存の NULL 表現） |
| DES-004 / REQ-001 | **変更なし** | recipe notation・要件に影響なし |

## 4. 文言整合(依頼事項2)

- `web/src/features/combo/customStates.ts:103` のコメント「結果が空なら undefined（＝未送信／NULL 保存）」は CHANGE-041「nil=不変更」と意味矛盾していた（undefined→null→nil は実際は不変更で NULL 保存されない）。
- 本 CHANGE-042 で DES-002 §4.2 に「PATCH は空文字センチネル＝NULL クリア」を正典化した。これに合わせ、当該コメントを「全 off → buildPatchPayload で `""`（空文字センチネル）として送り NULL クリア。POST/PUT は undefined で INSERT 時 NULL」と整合させること（コード側＝製造担当。契約は本 DES-002 §4.2 が正典）。

## 5. 派生ドキュメント

| 文書 | 対応 |
|------|------|
| change-number-registry | §1 で 042 を使用済み・次番号 043、§3 に1行追加、§4 履歴 1.30.0 |
| testid-convention.md | flag トグルの `combo-editor-custom-state-{code}` 追加（製造担当・反映済） |

## 6. 整合性チェック結果

- DES-002 §4.2 の situation トライステート（不変更／NULL クリア／更新）が CHANGE-041（nil=不変更）と矛盾せず両立。
- クリア結果 NULL が DES-003 の `combos.situation` NULL 可（既存）と整合。
- 重複判定キー（VAL-C02）誘導記述は不変＝識別キー編集挙動に回帰なし。
- スキーマ・後方互換（未指定/null PATCH は不変更）を確認。

## 7. 申し送り(本 CHANGE 範囲外・設計判断を継続)

- **§5.1 他 nullable メタデータの PATCH クリア不能（同型・未修正）**: memo／damage／ゲージ等も「空に戻すと旧値温存」。一般解（presence-detection トライステート 等）は別スコープの設計判断として継続（本レポートでは未決。設計提案を別途提示）。
- **§5.2 seed `scope` フィールドの正典化/据え置き**: definitions §6 が「CHANGE-040 で設計担当判断」とする領域。継続判断。

---

*以上、change-report-042。配置 `docs/change-notes/change-report-042.md`。*
