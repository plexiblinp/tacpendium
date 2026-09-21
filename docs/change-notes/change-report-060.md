# change-report-060: CHANGE-060 設計書本体 反映レポート

| 項目 | 内容 |
|------|------|
| 対象 CHANGE | CHANGE-060（M16-01 実装反映＝ドライブ始動残量 REAL 化・0.5 刻み・G-g） |
| 反映日 | 2026-07-05 |
| 反映担当 | 設計担当 Claude（M16 期） |
| 起票文書 | `docs/change-notes/CHANGE-060-notification.md` |
| ステータス | **反映（DES 改訂を適用・commit は開発者）**。§7 確認事項 1〜3 は開発者承認済み（A-1 暫定案採用・B-1 OK・A-2 OK） |
| 背景 | M16-01（G-g）実装完了・設計伝達メモ受領。始動残量は dup/recipe 非対象（M16-RESEARCH-01 実測裏付け）。全件 型変更＋入力/検証追従で非破壊（既存整数値は無損失昇格）。 |

---

## 1. 反映したファイル（旧→新）

| ファイル | 旧 → 新 |
|--------|---------|
| DES-003 データモデル | v1.23.0 → **v1.24.0**（§3.4 `drive_available_at_start` INTEGER→REAL） |
| DES-005 画面設計 | v2.34.0 → **v2.35.0**（§5.7 0.5 刻み widget・ラベル文言正典化） |
| DES-006 バリデーション | v1.14.0 → **v1.15.0**（VAL-C04 小数許容・BE は範囲のみ・`%g`・VAL-D03 突合注記） |

REQ-001 / DES-002 / DES-004 / SUPP-001 は**変更なし**。

## 2. 修正概要

### DES-003 §3.4（combos・型）
- `drive_available_at_start` の型を **INTEGER → REAL**。付記を「0〜6・**0.5 刻み**・**CHECK 不使用＝BE 範囲検証＋UI 刻み担保**」へ。sequence 側（小数）と粒度統一。前例 `drive_damage`（REAL・CHANGE-046）と同型・同再構築技法（000016）。
- 旧: `drive_available_at_start`（INTEGER・0〜6） → 新: `drive_available_at_start`（REAL・0〜6・0.5 刻み・CHECK 不使用）。

### DES-005 §5.7（登録/編集・入力欄）
- ドライブ始動残量入力を **0.5 刻み widget**（`step=0.5`・非負・0〜6）に。
- **ラベル文言を正典化**: 「ドライブゲージ(0〜6本)」→ **「ドライブゲージ(0〜6本・0.5刻み)」**（`drive_damage`「(-6.0〜6.0)」に倣い刻みを明示・表記ゆれ防止）。M16-06 表記 rollout の語彙と整合。

### DES-006 VAL-C04（drive_available_at_start 範囲検証）
- 「**0〜6 の範囲内か（小数許容）**」へ。**0.5 刻みは UI（widget `step=0.5`）で担保・BE は範囲のみ検証**（VAL-C13 drive_damage と同方針）。エラーメッセージ数値書式 **`%g`**（小数表示・範囲文言「0〜6」不変）。
- **VAL-D03 突合注記を追加**（A-2 承認）: VAL-D03（draft 範囲チェックのみ・NULL 許容）は独立実装関数・定数を持たず、**draft の NULL 許容は VAL-Cxx 側の nil スキップ（`if … == nil { return }`）に畳み込まれた挙動**である旨を明記。M16-02/03 の draft 検証にも同前提が波及。

## 3. 影響範囲に挙がったが「変更しなかった」項目（漏れ検知）

| 項目 | 判断 | 根拠 |
|------|------|------|
| DES-005 §5.8（比較の始動残量表示） | **本 CHANGE では反映せず＝M16-02 の CHANGE で反映**（A-1 決定） | A-1 暫定案採用＝M16-02 の比較改修で drive/SA の**始動・消費を同時に比較軸へ**載せ非対称を一括解消。比較の実装が M16-02 で起きるため §5.8 編集は M16-02 側 |
| DES-005 §5.4（一覧列の始動残量） | **変更なし＝現状維持**（A-1 決定） | 一覧は表示列過密回避・現状維持（暫定案どおり） |
| CSV 契約（DES-002 §7.6） | **変更なし** | B-4 最短表記（`floatPtrToStr`）・旧整数 CSV "2" は往復不変＝列構造不変・後方互換維持 |
| CSV 非正準表記の弾き（"2.0"/"2.50"） | **変更なし** | C-2＝drive_damage 既存挙動踏襲。将来寛容化は drive_damage と一括（followup） |
| REQ/DES-002/004・SUPP-001 | **変更なし** | 型変更＋入力/検証の追従に閉じる |
| recipe_cache・dup（DuplicateKey/VAL-C02） | **変更なし** | 始動残量は非対象（M16-RESEARCH-01 実測裏付け＝`CalcRecipeHash(steps)` に始動残量は入らない） |

## 4. 整合性チェック結果

- **三書の一貫**: DES-003 §3.4（REAL・0.5 刻み・CHECK 不使用）↔ DES-005 §5.7（`step=0.5` widget・ラベル「0.5刻み」）↔ DES-006 VAL-C04（小数許容・範囲のみ・0.5 刻みは UI 担保）が一貫。
- **前例整合**: `drive_damage`（VAL-C13・REAL・小数・BE は範囲のみ）と同方針で、combos の 2 つの drive 系小数列の検証・入力方式が揃う。
- **表記正典整合**: ラベル「0.5刻み」正典化が M16-06 表記 rollout の対象語彙と非衝突（「ドライブラッシュ」正式名称規約とも別語彙で干渉なし）。
- **VAL-D03 整合**: 注記により DES-006 の記述と実装（VAL-Cxx nil スキップ）が一致。M16-02/03 の draft 検証前提と齟齬なし。
- **down 整合**: 000019.down は切り捨て（`CAST AS INTEGER`）＝B-1 承認。REAL→INTEGER down の**標準を「切り捨て」に一本化**（§5・digest へ記録）。

## 5. 派生・後続

| 文書 / アクション | 対応 |
|------|------|
| change-number-registry | **060 反映（次 061）**・§改訂表 3 行（DES-003 v1.23→1.24・DES-005 v2.34→2.35・DES-006 v1.14→1.15）・版ログ追記（v1.48.0） |
| retrospective-log / digest §5 | **B-1 down 丸め＝切り捨てを標準**として記録（TMP 記録済み・log 手交後に転記→ Claude Code 再蒸留）。以後の REAL→INTEGER down は切り捨てに従う。A-2（VAL-D03 の記述と実装乖離）も記録 |
| followup-backlog | **C-2 CSV 非正準表記の寛容化**（drive_damage と一括で将来検討）を記録候補 |
| DES-005 §5.8 | **A-1 決定を M16-02 の CHANGE で反映**（比較に drive/SA の始動・消費を同時掲載） |
| M16-02（投入中）申し送り | 型部品流用（`step=0.5`・`floatPtrToStr`・`formatDriveGauge`・SA は `parseOptInt`/`intField`）＋**比較に始動・消費を同時に載せて非対称解消**（伝達メモ E・A-1） |

## 6. 残ゲート（開発者）

- 本 CHANGE（DES-003 §3.4・DES-005 §5.7・DES-006 VAL-C04）の承認・commit/push。
- down 丸め標準（切り捨て・§7-2 承認済み）を retrospective-digest §5 の標準として反映（log 転記→再蒸留の経路）。

---

*以上、change-report-060。配置 `docs/change-notes/change-report-060.md`。DES 本体の改訂は設計担当が適用（製造は DES/REQ を直接編集していない）。DES-005 §5.8（比較の始動残量）は A-1 決定に基づき M16-02 の CHANGE で反映する。*
