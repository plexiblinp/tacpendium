# M16 → M17 設計引き継ぎ書（design handover）

| 項目 | 内容 |
|------|------|
| 文書種別 | **マイルストーン境界の設計引き継ぎ書**（m15-to-m16-handover.md 型。次チャットの設計担当へ）。**M16 全工程完了 → 次は M14-03b（配布 blocker・M16 末尾スロット）→ その後 M17（command 解決 段階2）**。※ m16-design-session-handover.md はマイルストーン途中の別物＝本引き継ぎでは参照しない |
| 引き継ぎ元 | M16 期 設計担当 Claude（フェーズ3 継続担当。M16-04〜07 担当・新セッション） |
| 引き継ぎ先 | M14-03b / M17 期 設計担当 Claude（新チャット） |
| 作成日 | 2026-07-08 |
| 位置づけ | **M16 完了（M16-01〜07＋RESEARCH-01・CHANGE-060〜067 全反映）→ M14-03b（全キャラ seed・配布 blocker・M16 の seed 契約が収束）着手**の境界。M14-03b は Opus 4.8＋Plan・破壊的でないが SF6 ドメイン判断＋seed インフラ＋dup スキャンを伴う重量サブ |

---

## 0. まず読む（次担当への要点）

- **M16 は全工程完了**（M16-01 drive REAL／02 消費列＋比較／03 起き攻め正規化／04 taxonomy＋dash 一本化〔破壊的〕／05 target_combo 運用正典化〔doc 限定〕／06 表記 rollout／07 custom_states ストック 2 値化＋RESEARCH-01）。**CHANGE-060〜067 は三点セット〔通知書＋改訂 DES 本体＋change-report〕＋registry まで全反映**（前 handover が懸念した「改訂 DES 本体適用漏れ」は本セッションで解消・pattern-D 反覆なし）。
- **次の実装サブ＝M14-03b**（overview §5-7・model-allocation＝M16 末尾スロット・M17 の前）。M16-04（dash canonical）／05（target_combo passthrough）／07（custom_states show_delta）の **seed 契約が M14-03b に収束**（§3）。配布 blocker。
- **その後 M17**（command 解決 段階2・G-k・判断3 で方針先行決定済＝§4）。
- **現行版・採番・環境＝§5**。**未反映・残タスク＝§6**（開発者の commit/push・仮ラベル確定・digest 再蒸留）。**M16 教訓＝§8**（retrospective-log §6.6.10・v1.0.47 転記済）。

---

## 1. M16 完了状態

### 1.1 サブマイルストーン

| サブ | 内容 | CHANGE | 状態 |
|------|------|--------|------|
| M16-RESEARCH-01 | ④/④'' 実態調査（幽霊仕様・#91・dup 実測） | — | 完了 |
| M16-01 | ② drive 始動 REAL 化（G-g・マイグレ 000019） | 060 | 完了・反映済 |
| M16-02 | ① ゲージ消費列（G-f・000020）＋比較＋F-1(a) | 061 | 完了・反映済 |
| （spec 是正） | 単値 dash 幽霊・high_jump=unique | 062 | 完了・反映済（doc 限定） |
| M16-03 | ③ 起き攻め正規化（G-h・000021） | 063 | 完了・反映済 |
| M16-04 | ④ taxonomy＋移動 move 化＋④'' dash 一本化（G-i・最重・破壊的マイグレ 000022） | 064 | 完了・反映済 |
| M16-05 | ④' target_combo 区分正典化（doc 限定・製造なし） | 065 | 完了・反映済 |
| M16-06 | 表記 rollout（A-3 始動/消費正典・A-1 消費エクスポート・F-1(a) 始動クランプ・FB⑥） | 066 | 完了・反映済 |
| M16-07 | int custom_states ストック 2 値化＋増減（FB⑬ 深掘り・000023） | 067 | 完了・反映済 |

### 1.2 CHANGE 反映状況

- **CHANGE-060〜067 全反映**（通知書＋改訂 DES 本体＋change-report＋registry）。registry v1.56.0・次 **068**。
- 起票順の注記: CHANGE-066（M16-06）は完了報告受領後、文脈都合で **067 の後に起票・反映**（DES-005 v2.38.0〔067〕→v2.39.0〔066〕・番号 066<067 だが適用 067→066・内容独立）。
- **DES 本体の commit/push は開発者作業**（§6-1）。

## 2. M16 で確定した設計判断（M14-03b/M17 に効くもの）

1. **dash canonical＝方向別 system move `dash_forward`/`dash_back`**（DES-004 §2.1/§2.2）。modifier.type 方向別 dash は M16-04 で廃止・移行済（000022）。`parry_drive_rush`/`cancel_drive_rush` は modifier.type のまま正。**移動 move の全キャラ seed＋alias は M14-03b**。
2. **taxonomy 原則（DES-004 §2.2・DES-003 §3.5）**: (a) moves 行〔system 含む〕/ (b) 非技 modifier.type〔parry/cancel のみ〕/ (c) flag。移動＝system move（1入力=1move）。**ユーザー表示語彙**（新規登録/編集）＝「技」／「共通システム（移動・その他）」（CHANGE-057/066・FB⑥）。
3. **target_combo 運用（DES-003 §3.3・CHANGE-065）**: 入力支援ツールで人手付与・本体は取込値を信頼（自動判定しない）。**remap は category=target_combo を通過保存**（M14-03b）。
4. **custom_states int（DES-003 §3.2・CHANGE-067）**: `show_delta` フラグ＋per-combo 2 値構造 `{start_min,end}`。**situation は opaque＝DDL/DTO/BE 不変・dup/recipe 非波及**。**4 キャラ def の show_delta 付与・E2E は M14-03b**。消費セマンティクスの一般構築なし（architecture-patterns §9.1・B-1 据え置き）。
5. **始動/消費正典（DES-005・CHANGE-066）**: 始動 ja=「コンボ開始時の◯◯ゲージ残量」・消費「◯◯ゲージ消費」・en parity。**register 分離**（表示ラベル=正典／検証エラー=簡潔内部表現・BE 不変＝① 方針）。① VAL 非連動（BE/CSV 非強制・UI クランプ担保・DES-006 §2.4/§2.5）。
6. **判断3＝command 索引化方針（M17）**: command は M14-01（000018）で本体除去済。M17 段階2 の索引源は **index-only 推奨**（列復活せず seed/helper から再構築）。**本体 net-new 取込スクリプト＝M14-03b remap＋M17 G-k 索引化**で command 吸収。段階2 スコープ＝単方向＋ボタンの特殊技のみ決定論解決（溜め `charge_*`・一回転 `circle`・空中特殊技は「直接指定」）。

## 3. M14-03b 申し送り（次の実装サブ・M16 の seed 契約が収束）

M14-03b（全キャラ seed 投入・配布 blocker・Opus 4.8＋Plan）の DoD に、M16 由来の次を含める（**正は M16-overview §5-7・followup §C-1 の該当行**）。

- **(a) 移動 system move（`dash_forward`/`dash_back` ほか）を全キャラ seed＋`preset_aliases`（`(preset_id, move_id)` キー）を対で**（無いと生 code フォールバック）。
- **(b) skip 残行の掃き取り follow-up マイグレ**（M16-04 で移行先 dash 不在により skip された modifier.type dash 行は resolver からラベル撤去済＝再計算で生 code 化。clean/user は ryu のみで skip 0＝無害。全キャラ dash seed 後に残行を移行しきり skip をゼロに）。
- **(c) 配布 DB 構築時の dup スキャン（remap 層 Go）＋dup 再測定**（M16-04 はマイグレに dup 検出非搭載＝現行 0 件は RESEARCH 時点値）。
- **(d) target_combo passthrough**（category=target_combo を remap が改変せず通過保存・CHANGE-065）。
- **(e) custom_states int の `show_delta` 付与**（Mai/Lily/Juri/Kimberly の方向性を SF6 ドメイン判断）＋**2 値 situation 構造 `{start_min,end}` の取込**（後方互換で旧スカラ→②写像）＋**Ingrid int①②③・4 キャラの E2E**（M16-07 は単体/コンポーネントで担保・実データ E2E は M14-03b）。
- **(f) command 索引源の再確立**（helper 経由・判断3・M17 G-k と共通化＝「二度作らない」）。
- **ロールバック注記**: M16-04 の 000022 down は native dash も modifier.type dash 化する非対称（marker 不在）。
- **指示書照合**: `M14-03-distribution-seed.md`（過去担当作成・v1.1.0）を **G-i canonical 確定・現行スキーマ（000023 まで）へ照合**してから着手（請求すること）。**clean マイグレ由来 DB から構築**（dev DB 残渣不可・M14-6）。

## 4. M17 申し送り（M14-03b の後）

- **M17＝command 解決 段階2（G-k）**: 入力→`move_code` 決定論ルックアップの索引源＝command（判断3 で方針先行決定済＝§2-6）。**index-only 推奨**（`moves.command` 列は復活せず seed/helper から索引再構築）。段階2 スコープ＝単方向＋ボタンの特殊技のみ決定論解決。
- **索引エンジンは取込ヘルパー（M14-03b remap）と共通化**（「二度作らない」）＝M14-03b seed 契約に「command 索引源の再確立」が乗る（§3-f）。
- CHANGE 見込み: DES-002 §7.6（取込ヘルパー IF）／DES-003（command 索引源＝G-k・列復活なら）／DES-004 §2.1・§6（command 索引・move_code 解決）。phase3-overview §2.3/§2.4 G-k・承認事項7（M17 繰り延べ）と整合（判断3 で前倒し決定）。DES 反映は M17 着手時。**token→索引キー正規化仕様（§9.9→numpad）を M17 で確定**。

## 5. 現行版・採番・環境（2026-07-08 時点）

### 5.1 設計書 現行版
- REQ-001 v2.16.0（不変）／DES-001 v1.4.0／DES-002 v1.30.0／**DES-003 v1.29.0**（CHANGE-067）／**DES-004 v1.11.0**（CHANGE-066）／**DES-005 v2.39.0**（CHANGE-066）／DES-006 v1.17.0（不変・§2.4/§2.5 が custom_states・消費の非連動をカバー）／**SUPP-001 v1.27.0**（CHANGE-064 自由改訂）。

### 5.2 採番・恒久資料
- **change-number-registry v1.56.0**: 次 CHANGE **068**・欠番 008/009/014・**060〜067 全反映済**。
- **model-allocation v1.30.0**: M16-01〜07 反映（M16-07＝Opus 4.8＋Plan 追記済）。M14-03b＝Opus 4.8＋Plan（M14 セクション既載・実行スロット M16 末尾）。
- **M16-overview v1.2.8**: M16 全工程 as-built（CHANGE-060〜067 全反映）。
- **retrospective-log v1.0.47**: §6.6.10「M16-04〜07 完了」（C-1〜C-5）転記済＝**開発者が `/retrospective-digest-update` で digest 再蒸留**（未実行なら次担当が依頼）。digest は次担当にとって読み取り専用。
- **phase3-overview v1.1.2**（承認済）: M13〜M23。M16 に M16-07 を追加した点は overview §3/§4.9 が正（phase3-overview 本体は未改訂＝必要なら次担当が確認事項化）。

### 5.3 環境・実装前提
- マイグレは **000023 まで**（M16-04＝000022・M16-07＝000023）。次マイグレは 000024 以降（M14-03b の skip 掃き取り follow-up 等）。
- 検証: `make e2e`（seed 非依存 self-contained）。Vitest。
- seed: 現行 HEAD は ryu 中心（**M14-03b で全キャラ seed＝配布 blocker**）。custom_states int def は Ingrid のみ（4 キャラ未 seed＝M14-03b）。
- code-facts: 投入版はマイグレ 000021 まで＝**M16-04（000022）/07（000023）反映は次回 `/regen_code_facts` で**（次担当は再生成状況を確認）。
- 製造は DES を直接編集しない（設計担当が CHANGE 起票）。CHANGE 対象＝REQ-001＋DES-001〜006（SUPP-001・overview・followup 等は自由改訂）。
- 出力前チェック: 簡体字＋禁則表現（「必要に応じて」「適切に」）＋**頻出ドメイン用語誤字（`grep 起き攻け`）＋「DR」略記**（画面ラベルは「ドライブラッシュ」・コード定数/規約引用は除く）の grep を毎回（retrospective-log M16-7 の運用強化）。

## 6. 未反映・残タスク（引き継ぎ時点で未了）

1. **DES 本体の commit/push（開発者作業）**: 本セッションで反映した改訂 DES（CHANGE-064〜067＝DES-003 v1.29.0・DES-004 v1.11.0・DES-005 v2.39.0・SUPP-001 v1.27.0）＋M16-06 指示書 v1.0.1 の 2 ファイル（製造未ステージ・差分競合なし）。
2. **仮ラベルの確定**（M16-07・CHANGE-067）: custom_states int の①②③固定句は仮（SSOT `customStateIntLabel`）。開発者が出力確認後に確定句を指定＝SSOT と DES-005 を同期。
3. **retrospective-digest 再蒸留**（§5.2）: 開発者が `/retrospective-digest-update`（未実行なら次担当が依頼）。
4. **リリース前視覚確認**（CHANGE-066・followup）: 長 ja ラベルの実機スマホ・エクスポート画像/PDF スポット確認（静的解析では崩れなし）。
5. **他マイルストーン前提**: M14-03b（§3）／NFR406 移設（M18 前）／export・入力欄 full en 化（別マイルストーン・followup）。

## 7. 最初の一手（次担当）

1. **M14-03b 着手準備**: `M14-03-distribution-seed.md` を請求し、G-i canonical・現行スキーマ（000023）へ照合。§3 の seed 契約（dash seed+alias・skip 掃き取り follow-up マイグレ・dup スキャン/再測定・target_combo passthrough・custom_states show_delta+2値・Ingrid/4 キャラ E2E・command 索引源）を DoD に織り込み指示書化（Opus 4.8＋Plan）。
2. **着手前の確認事項リスト**を提示（4 キャラ show_delta 方向性・skip 掃き取りマイグレの連番〔000024〕・dup 再測定範囲・配布完了定義 followup §C-1・キャラ数 30→絞る可能性）。
3. **retrospective-digest 再蒸留の確認**（§6-3）。code-facts 再生成状況の確認（§5.3）。
4. M14-03b 完了後に **M17（command 段階2・§4）**。

## 8. M16 教訓ダイジェスト（retrospective-log §6.6.10・M14-03b/M17 に効くもの）

- **overview の要決定欄・残タスク欄は実ファイル照合で裏取り**（C-1／M16-1 再確認）。確定判断が出たら overview を同期。
- **起動 PASTED の版数を鵜呑みにせず実添付を handover §5 現行版と grep 突合**（C-2）。
- **破壊的マイグレ設計前に「保存列 vs 都度計算／DB 制約 vs サービス層強制／表示 cache vs alias」を実コードで確定**（C-3）。static 抽出非対象関数（`CalcRecipeHash` 等）は実コード直読み。
- **「トークン撤去」と「そのトークンを持つ全行を移行しきる」はセット**（C-4）。撤去×部分移行では残行ゼロ化の後続（M14-03b 掃き取り）を DoD に紐づけ。
- **「表現を直す」系 FB の rollout は対象の現行 rendered 状態を実査してからスコープを書く**（C-5・先行サブで解消済のことがある）。
- **多段フィードバック（製造 Plan Mode）が設計担当のセルフチェック限界を補う**（正の機構）。指示書 §3.4 Plan Mode 項目・§9.3 差し戻し条項を厚く。
- **反映工程（三点セット）を委譲すると pattern-D（DES 適用漏れ）リスク**（retrospective-log M14-1/M16-1）。委譲時は scope を精密化し、可能なら委譲せず本セッションで反映しきる（本セッションは CHANGE-064〜067 を反映しきった）。

---

*以上、M16 → M17 設計引き継ぎ書。**M16 全工程完了（CHANGE-060〜067 全反映）**。次の実装サブ＝M14-03b（配布 blocker・M16 の seed 契約が収束・§3）→ その後 M17（command 段階2・判断3・§4）。現行版・採番・環境＝§5。未反映＝§6（開発者の commit/push・仮ラベル確定・digest 再蒸留）。教訓＝retrospective-log §6.6.10。*
