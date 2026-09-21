# change-report-057: CHANGE-057 設計書本体 反映レポート

| 項目 | 内容 |
|------|------|
| 対象 CHANGE | CHANGE-057（M15-03 実装反映＝入力方式ボタン化＋段階1＋直接指定＋modifier flags＋UI/UX 追補） |
| 反映日 | 2026-07-04 |
| 反映担当 | 設計担当 Claude（フェーズ3 継続担当・M15 期） |
| 起票文書 | `docs/change-notes/CHANGE-057-notification.md` |
| ステータス | **反映（DES 適用済み・commit は開発者）** |
| 背景 | M15-03 基盤実装＋UI/UX 追補（3 ラウンド・feature/m15-03）完了。追補伝達書（M15-03-uiux-followup-design-handoff）の独自実装・独自判断・要設計判断・CHANGE 追記推奨を DES-004/005 に反映。**全件 FE のみ・データ/API/スキーマ不変**。 |

---

## 1. 反映したファイル（旧→新）

| 設計書 | 旧 → 新 |
|--------|---------|
| DES-004 内部表現仕様 | v1.6.3 → **v1.7.0**（§2.1 必殺技ファミリー名導出〔接頭/末尾両対応〕・§2.3 flags 実値同期） |
| DES-005 画面設計 | v2.31.0 → **v2.32.0**（§5.7 レシピ入力領域・§6.1/§6.4 仮想コントローラを実装形へ・用語・プルダウン統合） |

REQ-001 / DES-002 / DES-003 / DES-006 / SUPP-001 は**変更なし**。

## 2. 修正概要

- **DES-004 §2.1**: 必殺技ファミリー名導出を明記（`official_ja_move` から強度ラベル除去・**接頭形「弱波動拳」/末尾形「波動拳・弱」の両対応**・`stripStrengthLabel` 相当）。
- **DES-004 §2.3**: flags を実装実値へ同期。`link`（目押し）を追記、`high_jump` を未実装（planned）と明示、M15-03 追加分（`first_hit_cancel`/`neutral_jump`/`forward_jump`/`od_lm`/`od_mh`/`od_lh`）を列挙。**表示は短縮表記正・編集ダイアログの英語 value 非表示・flag コードは内部正典**。固定選択式は不変。
- **DES-005 §5.7**: レシピ入力領域を実装形へ（技/非技ラジオ廃止→区分絞り込みプルダウンに「共通システム（移動・その他）」統合＝`nonmove:<type>`・用語是正・両エディタ適用）。
- **DES-005 §6.1/§6.4**: 仮想コントローラをカテゴリタブ式 direct-selection＋段階1 の実装形へ更新（必殺技2段・OD 4種並置・強度色・ラッシュ Switch・共通技エリア・全技プルダウン折りたたみ＆区分統合）。旧「4 レイアウト＋論理ボタン」は物理入力 M21 の将来仕様として温存。

## 3. 影響範囲に挙がったが「変更しなかった」項目（漏れ検知）

| 項目 | 判断 | 根拠 |
|------|------|------|
| DES-003 §3.3（category enum・modifiers 構造） | **変更なし** | 段階1・flags は既存 `modifiers`（JSON・`flags`）に載る非スキーマ。category enum も不変 |
| SUPP-001 §3.3.3（modifier.type 初期値） | **変更なし（本 CHANGE）** | dash 二重表現の一本化（modifier.type dash 廃止・移行）は M16 論点＝data milestone。本 CHANGE では canonical=system move の判断のみ記録 |
| REQ-001 | **変更なし** | 本サブは要件を変えない |
| DES-002（API） | **変更なし** | 新規エンドポイントなし。段階1 は既存 `StepRequest.moveId`、flags は既存 `modifiers` に載る |
| DES-006（バリデーション） | **変更なし** | 段階1・flags は新規バリデーション規定を要さない（着手時判定＝不要確認済み） |
| §6.2/§6.3/§6.4.1/§6.5（4 レイアウト・論理ボタン・選択保持） | **温存（変更なし）** | 物理入力 M21〔旧 M18〕の将来仕様。§6.1 で「M21 の将来仕様として温存」と明示 |
| i18n（レシピ入力サブツリー） | **CHANGE 対象外** | 全面ハードコード JA＝新規 i18n キーゼロ・ja/en parity 非抵触（playbook §4.13）。サブツリー i18n 化は tech debt（followup） |

## 4. 整合性チェック結果

- DES-004 §2.1 の system move（`dash_forward`/`dash_back`＝CHANGE-048・「1入力=1move」原則 line 103）と CHANGE-057 §3-1 の canonical 判断（dash=system move）が一貫。SUPP-001 §3.3.3 の modifier.type dash は原則違反の重複として M16 一本化を明記（本 CHANGE 不変）。
- DES-004 §2.3 flags 実値（`just`/`delay`/`link`/`low_jump`/`first_hit_cancel`/`neutral_jump`/`forward_jump`/`od_lm`/`od_mh`/`od_lh`）と DES-005 §5.7/§6.4 の「補足（入力のコツ・状況）」UI・必殺技 OD 4 種が一致。
- DES-005 §6.1/§6.4 の実装形（カテゴリタブ・段階1・共通技・プルダウン）と DES-004 §2.1（`standing_/crouching_/jumping_*`・`rush_*`・system move）が一致。§6.2〜§6.5 の物理仕様温存が §6.1 の M21 注記と整合。
- 死守契約 3 点（公式表記のみ／モーション解析なし／出口＝`move_code`）が §6.4（モーション実演 UI 不在）で維持。

## 5. 派生・後続

| 文書 / アクション | 対応 |
|------|------|
| change-number-registry | 承認後に 057 反映（次 058）、改訂表に 2 行（DES-004/DES-005）、版ログ追記 |
| phase3-overview §M16 | ④'（target_combo）に加え、**dash 二重表現の一本化**（modifier.type dash 廃止・system move 移行）を M16 論点として追記（④「移動の system move 登録」に紐づけ）＝**別途 overview 追記を推奨**（正本改訂・要承認） |
| followup-backlog | 別技ボタン面（M14-03b 後・データ駆動）記録済み。**レシピ入力サブツリーの i18n 化**を tech debt として追記推奨 |
| SUPP-001 §3.3.3 | M16 で modifier.type dash 廃止・移行時に改訂（本 CHANGE 不変） |
| retrospective-log | M15-03 教訓は一時ノート（`m15-03-retrospective-notes-TMP`）に記載済み。M15 完了時に log へ転記→開発者が digest 再蒸留 |

## 6. 残ゲート（開発者）

- 本 CHANGE（DES-004/DES-005）の承認・commit/push。
- 通知書 §7 の確認 2 件（**dash 近手当ての M15-03 内実施 or M16 現状維持**・反映確定）。
- phase3-overview §M16 への dash 一本化追記の承認（§5 派生）。

---

*以上、change-report-057。配置 `docs/change-notes/change-report-057.md`。*
