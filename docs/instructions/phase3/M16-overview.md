# M16 マイルストーン全体像（M16-overview）: データモデル拡充・スキーマの継ぎ目

| 項目 | 内容 |
|------|------|
| 文書種別 | 補足資料（overview。CHANGE 通知書対象外・自由改訂） |
| バージョン | 1.2.8（**M16-06 as-built・CHANGE-066 反映＝M16 全工程反映完了**。v1.2.8＝§3 サブ表 M16-06 を✅反映済〔CHANGE-066〕・§4.6 as-built。CHANGE-060〜067 全反映。v1.2.7＝**M16-07 as-built・CHANGE-067 反映＋M16 完了**。v1.2.7＝§3 サブ表 M16-07 を✅完了〔Ingrid 実 seed・4 キャラ M14-03b 委譲〕・§4.9 as-built・M16-06 は CHANGE-066 未起票を注記。**M16 全工程完了**。v1.2.6＝**M16-07 追加登録**〔開発者承認 2026-07-08〕。v1.2.6＝§3 サブ表に M16-07〔int custom_states ストック始動/終了/増減〕＋§4.9 新設。M16 末尾を M16-06→M16-07 へ延長。v1.2.5＝M16-06 確定語彙・指示書化反映。v1.2.5＝§4.6 に M16-06 確定〔始動=「コンボ開始時の◯◯ゲージ残量」統一・FB⑥=新規登録/編集のみ・A-1 消費エクスポート対称・F-1(a) 始動クランプ対称・en parity〕＋指示書 v1.0.0 起票を反映。v1.2.4＝M16-05 as-built・CHANGE-065。v1.2.3＝§4.8/§6 の要決定確定反映・CHANGE-064 同トランザクション。v1.2.3＝§4.8 要決定 1〜6 を確定結果〔移行=ryu のみ・dup/cache マイグレ非搭載・#91 汎用 skip・ModifiersEditor 撤去・spec は CHANGE-062 済・ryu alias 既存で INSERT 不発〕へ反映＋§6 G-i 行を as-built〔純 SQL transform＋skip・dup/cache 非搭載・down lossy〕へ訂正。v1.2.2＝§5-7 に M14-03b DoD 申し送り〔(a) 全キャラ dash seed＋alias 対・(b) skip 残行掃き取り follow-up マイグレ・(c) dup 再測定＋down 非対称ロールバック注記〕。v1.2.1＝§5-7 dup スキャン責務追記＋§5-4 訂正。v1.2.0＝§4.6 に M16-02 由来の M16-06 送り事項〔A-3 始動/消費ラベル横断正典化・A-1 エクスポートカード消費追加〕を記録（開発者指示「記録しっかり」）＋ F-1(a) UI クランプ暫定を注記。v1.1.0＝§4.8 RESEARCH 実態確定。v1.0.0＝分割承認。v0.1〜0.3＝ドラフト） |
| 作成日 | 2026-07-05 |
| 作成者 | 設計担当 Claude（フェーズ3 継続担当・M16 期） |
| 位置づけ | phase3-overview v1.1.2 §M16／§2.4（承認ゲート G-f〜G-i）の具体化。M16 = データモデルの根＝**スキーマ変更・§6 承認ゲート・破壊的マイグレ**を扱う（M15 と性格が異なる）。本書がサブ分割・全 FB 処遇・承認ゲート順・CHANGE 見込みの正本。各サブ指示書の上位文書 |
| 前提 | phase3-overview v1.1.2 §M16/§2.2/§2.4/§5／m15-to-m16-handover §1〜§4／combmgr-friend-feedback-datamodel-issues ①〜④・付記／DES-003 §3.3/§3.4/§3.5／DES-004 §2.1/§2.3／SUPP-001 §3.3.0/§3.3.2/§3.3.3／architecture-patterns §9.1/§9.2／code-facts（Combo/Move model・combo DTO・recipe_cache）／CLAUDE.md §10.X |
| 実パス規約 | 文書ID ⇄ 実パスの正は `docs/handover/docs-map.md`。本書は実パス併記。 |
| 配置 | `docs/instructions/phase3/M16-overview.md` |

---

## 1. 目的・位置づけ

M16 はフェーズ3 の**データモデル拡充クラスタ**。datamodel-issues ①〜④の「放置すれば後で破壊的移行になるスキーマの穴」を、上位プレイヤー需要に基づき先回りで埋める。M15（全サブ非スキーマ）が routing した「宿題」を、**§2.4 承認ゲート付き**で回収する。M14 の破壊的整理（列削除）後に着手し、後続の発信者機能（M17 流通基盤・M18 確定反撃・M19 セットプレイ提案）の土台を整える。

M16 の性格（M15 と対照的）：**スキーマ変更・破壊的マイグレ・SF6 ドメイン判断を伴う**。各スキーマ変更は §2.4 承認ゲート（G-f/G-g/G-h/G-i）として**着手前に個別に開発者承認**を得る。破壊的マイグレは M13 export = データ安全網の上で、**意味単位・後方互換 CSV** の順に搬送し、M14 スキーマ整理と衝突させない（次マイグレ連番 = **000019 以降**）。

達成目標：

- **ゲージ属性の器**: SA ゲージ**消費**の手入力列を追加（始動値とは別）。記録・表示・比較のみ・検証（VAL）非連動（① 開発者確定 2026-06-26）。
- **ゲージ粒度の統一**: `combos.drive_available_at_start` を INTEGER→REAL とし、sequence 側（小数）と粒度を揃える（②）。
- **起き攻めモデルの是正**: 打撃重ねの欠落を埋め、6 bool 平置きを `combo_oki_options` 正規化へ前倒し（③）。
- **レシピ taxonomy の正典化**: 「moves 行／非技ステップ／modifier」の振り分け原則を明文化し、移動（ジャンプ・ダッシュ・歩き）を system move へ寄せる（④）。dash 二重表現を一本化（④''）、target_combo 区分を正典化（④'）。
- **表記 rollout**: 上記データ確定後に、FB⑥⑨⑪⑬ の表記ラベルを追従（旧 M15-07）。
- **配布前提の充足**: 全キャラ seed（M14-03b）を M16 スキーマ確定後に投入し、M17 の前提（全キャラ move マスタ）と配布 blocker を解消する。

**順序依存（最重要）**: FB⑥（技/非技ラベル）は ④ taxonomy 確定後、FB⑨⑪⑬（始動/消費表記）は ① 確定後でないと**正しいラベルが書けない**（datamodel-issues 付記）。よって表記 rollout は M16 末尾（データ確定後）に置く。

---

## 2. スコープ全件処遇一覧（本MSの肝）

### 2.1 datamodel-issues ①〜④ と承認ゲートの対応（phase3-overview §2.4）

| 論点 | 内容 | 承認ゲート | ドメイン確度 |
|------|------|-----------|-------------|
| ① | ゲージ消費の手入力列（始動値と別・記録/表示/比較のみ・VAL 非連動）＝**SA 消費〔INTEGER 0〜6〕＋drive 消費〔REAL 0.5・0〜20〕の 2 本**（開発者確定 2026-07-05） | **G-f** | **確定** |
| ② | drive `drive_available_at_start` INTEGER→REAL・combo↔sequence 粒度統一・widget 刻み 0.5 | **G-g** | **確定**（開発者 2026-07-05。0.5 刻み統一） |
| ③ | `combo_oki_options` 正規化前倒し＋**打撃重ね追加**＋**シミー 4 区分化〔uses_dr 一様適用・新依頼〕**＋語彙棚卸し | **G-h** | **確定**（開発者 2026-07-05。既存シミー backfill=`uses_dr=false` 決定論） |
| ④ | taxonomy 明文化＋移動 system move 登録（FB⑦連動） | **G-i** | **確定**（開発者 2026-07-05。原則明文化→system move→dash 移行の順） |
| ④' | target_combo（多段特殊技）区分正典化 | G-i 隣接（category 運用） | **確定**（信頼分類正典化を第一候補） |
| ④'' | dash（前/後）move/modifier.type 二重表現一本化 | **G-i**（一体） | **確定**（canonical = system move。handover §1/§2） |

### 2.2 friend FB 17 件のうち M16 分の処遇（phase3-overview §5）

| # | FB 要旨 | 処遇 | 担当サブ |
|---|---------|------|---------|
| ⑥ | 「技/非技ステップ」表現が分かりにくい | **表記＝M16 末尾 rollout（④ taxonomy 確定後にラベル翻訳）** | M16-06 |
| ⑦ | 前ジャンプ・垂直ジャンプが move 化されていない | **M16 ④（taxonomy/移動 move 化）＋ M21（入力連動）** | M16-04 |
| ⑧ | ドライブゲージも小数に | **M16 ②** | M16-01 |
| ⑨ | ドライブゲージ「始動」明示ラベル | **表記＝M16 末尾 rollout（① 確定後）** | M16-06 |
| ⑪ | SA ゲージ 始動＋消費の両方／現状不明 | **データ＝M16 ①（M16-02）／表記＝M16 末尾 rollout** | M16-02＋M16-06 |
| ⑫ | 起き攻めに打撃重ね可否追加・整理 | **M16 ③** | M16-03 |
| ⑬ | サンシンボル等「始動ゲージ」明示 | **表記＝M16 末尾 rollout（① 確定後・custom_states 表示）** | M16-06 |

> ①②③④⑤⑩⑭⑮⑯⑰は M15 で完了。⑦は M16 ④＋M21 通し（物理は M21）。

### 2.3 後続送り・スコープ外（根拠付き・playbook §4.11）

| 項目 | 処遇 | 根拠 |
|------|------|------|
| `moves.is_projectile`（飛び道具フラグ） | **M18**（G-b と同時追加・M16 バッチ不採用） | phase3-overview 確認事項11（2026-07-02 確定） |
| 一般 custom_states 消費のモデル化 | **非モデル化据え置き**（SA 消費のみ M16 例外） | arch §9.1・followup B-1 |
| バーンアウト独立列（③ の C） | **見送り**（将来の導出表示余地のみ） | datamodel-issues ① 推奨3・開発者確定 |
| recipe_cache のプリセット/エイリアス変更トリガ無効化 | **M20**（プリセット管理 UI 着手時に SUPP-001 §7 実装） | arch §9.2・followup F12-2 |
| メディア 3 フィールド（G-j）・command 源（G-k） | **M17** | phase3-overview §2.4 |

---

## 3. サブユニット構成（フラット連番・**分割承認済み 2026-07-05**）

> サブ分割・連番・実装順は設計担当の提案を**開発者が承認**（playbook §4.12）。M16 は破壊的マイグレ・新ドメインを含むため、実装は原則 **Opus 4.8 ＋ Plan Mode 必須**（model-allocation の M12 注「UX・正しさ・データモデルは Opus」）。表記 rollout（M16-06）のみ非スキーマ表記のため Sonnet 4.6 想定。

| サブ | 内容 | ゲート | モデル | CHANGE 見込み（着手時 view 確定） | 依存 |
|------|------|--------|--------|-----------------------------------|------|
| **M16-RESEARCH-01** | ④/④'' 着手前 read-only 調査＝移動 system move の seed/UI 実態・`modifier.type=dash` 実コード/実データ所在・**modifier.type dash→move 移行の FR301 dup 衝突件数を dev DB で実測** | —（調査） | Sonnet 4.6 | なし（read-only） | read-only・G-g/G-f/G-h と並行可・出力は M16-04 の前提。**分割承認済み 2026-07-05・指示書起票済み**（`M16-RESEARCH-01-taxonomy-dash-dup-survey.md`） |
| **M16-01** | ② drive 小数化（`drive_available_at_start` INTEGER→REAL・widget 0.5 刻み） | **G-g** | Opus 4.8＋Plan | DES-003 §3.4／DES-005（入力 widget）／DES-006（範囲 BE 検証追従） | 先頭（型方針を M16-02 と共有）。**並列可の唯一候補（条件付き・§5）** |
| **M16-02** | ① 消費列追加＝**SA 消費〔INTEGER 0〜6〕＋drive 消費〔REAL 0.5・0〜20〕の 2 本**（始動値と別・記録/表示/比較のみ・VAL 非連動） | **G-f** | Opus 4.8＋Plan | DES-003 §3.4／DES-005 §5.6/§5.7/§5.8（表示・比較軸）／DES-006（**非連動を明記**） | M16-01（drive の型方針を共有） |
| **M16-03** | ③ 起き攻め正規化（`combo_oki_options` 新設＋**打撃重ね**＋**シミー 4 区分化〔uses_dr 一様〕**＋6 bool 移行）＋語彙棚卸し | **G-h** | Opus 4.8＋Plan | DES-003 §3.4（正規化）／DES-005 §5.6/§5.7/§5.8/§5.13（起き攻め表示）／DES-006 | 直列（reader/一覧・比較・editor 波及。§4.3） |
| **M16-04** | ④ taxonomy 明文化＋移動 system move 登録／enable＋④'' dash 一本化（modifier.type dash 廃止＋既存データ移行） | **G-i** | Opus 4.8＋Plan | DES-004 §2.1/§2.3／DES-003 §3.3/§3.5／SUPP-001 §3.3.3 | **直列必須（最重・要移行計画。FR301/recipe_hash 波及。§4.4）** |
| **M16-05** ✅完了 | ④' target_combo 区分正典化（**doc 限定・製造なし**＝分類は入力ツール人手付与・本体は取込値を信頼・0 件・実装非依存） | G-i 隣接 | doc 限定（設計担当 CHANGE-065） | **反映済 DES-003 §3.3／DES-004 §2.1（CHANGE-065）** | 直列（M16-04 taxonomy 確定後） |
| **M16-06** ✅完了 | 表記 rollout（A-3 始動/消費正典「コンボ開始時の◯◯ゲージ残量」・A-1 消費エクスポート対称・F-1(a) 始動クランプ対称・FB⑥ fallback 整合。**FB⑬ は M16-07 へ移設**） | —（非スキーマ表記） | Sonnet 4.6 | **反映済 DES-005 §5.4/§5.6/§5.7/§5.8/§5.13・DES-004 §2.2（CHANGE-066）** | 直列（④・①確定後） |
| **M16-07** ✅完了 | int custom_states ストック 2 値化＋増減（FB⑬ 深掘り）。situation opaque＝スキーマ/DTO/BE 変更なし・dup/recipe 非波及（**CHANGE-067 反映済**）。Ingrid 実 seed・**4 キャラは M14-03b 委譲** | データモデル判断（承認済） | Opus 4.8＋Plan | **反映済 DES-003 §3.2／DES-005 §5.6/§5.7/§5.8/§5.13（CHANGE-067）**・DES-006 不変（§2.4 カバー） | 直列（M16-06 後）。**M16 全工程完了** |

> **番外（M14 lineage・M16 実行スロット）**: **M14-03b（全キャラ seed 投入）** は M16-04（G-i）確定後・M17 前に投入（§5・配布 blocker）。**M14 連番識別子は保持し M16-NN は付さない**。過去指示書 `M14-03-distribution-seed.md` を G-i canonical 確定時に最新スキーマへ照合（設計担当が請求）。

> **採番**: CHANGE は **060 から**（欠番 008/009/014・055 まで消化）。マイグレは **000019 以降**（M14 で 000018 まで）。model-allocation へ本分割承認後に追記（ステップ⑥）。

---

## 4. 主要設計判断・実査結果の反映

### 4.1 承認ゲートの搬送順（phase3-overview §2.4）

**G-g（型変更）→ G-f（列追加）→ G-h（正規化）→ G-i（移動 move 化＝最重・移行計画とセットで最後）**。各ゲートは着手前に個別承認。G-i の後に ④'（M16-05）→ 表記 rollout（M16-06）→ M14-03b 投入。理由＝軽い/波及が閉じたものを先に搬送し、レシピ同一性に波及する最重の G-i を最後に置くことで、マイグレ連番と後方互換 CSV の意味単位搬送を安定させる。

### 4.2 ①② ゲージ属性（G-f/G-g・M16-01/02）

- **② G-g（drive REAL）**: `combos.drive_available_at_start` は現状 `*int`（model.Combo・ComboResponse・CreateRequest・UpdateMetadataRequest〔`comborepo.Optional[int]`〕・DB INTEGER）。REAL 化は **`drive_damage` の CHANGE-046／000016 再構築マイグレ（migrate 接続 FK=OFF・一時名経由で子テーブル連鎖削除と legacy_alter_table の FK 自動書換を回避）の前例**を踏襲する（SQLite は列型を直接変更できないため再構築が要る）。**始動残量は FR301 dup キー非対象**（datamodel-issues ②）のため重複判定への波及なし。範囲（0〜6）は CHECK 不使用＝BE 検証＋UI 担保の既定方針を維持。入力 widget は **0.5 刻み**（開発者確定・他と統一）。
- **① G-f（消費列＝SA＋drive 両方・開発者確定 2026-07-05）**: 消費は **custom_states 非モデル化（arch §9.1）の例外**＝`combos` 専用列として持つ。**記録・表示・比較のみ・VAL 非連動**（開発者確定 2026-06-26。FR303 自動キャッシュは復活させない）。列は始動値（`sa_available_at_start`／`drive_available_at_start`）と別。**新規列 2 本**:
  - **SA 消費 = INTEGER・範囲 0〜6**（本単位）。始動 SA（0〜3）と範囲が異なる＝**コンボ中に SA が溜まり、始動より多く使えるため上限 6**（開発者確定）。UI は本単位（整数）ステッパー。
  - **drive 消費 = REAL・0.5 刻み**（drive は 0.5 本単位で消費するため）。範囲は **0〜20**（開発者確定 2026-07-05＝念のための余裕枠。VAL 非連動のため上限は UI ステッパー/DES-003 記述上の目安）。
- 比較画面で SA/drive 消費を**比較軸に**追加（§M16 ①）。DES-006 には「消費列は検証非連動」を明記（VAL を足さない設計判断を正典化）。DES-005 の editor（§5.7）・比較（§5.8）・詳細（§5.6）に消費入力/表示を追加（**画面改修は本サブ内包**＝§4.7）。

### 4.3 ③ 起き攻め正規化（G-h・M16-03）

- **現状**: `combos` に 6 bool（`oki_meaty_neutral_tech_throw`／`_dr`／`oki_meaty_back_tech_throw`／`_dr`／`oki_shimmy_neutral_tech`／`oki_shimmy_back_tech`）＋`knockdown_advantage`（INTEGER）。DES-003 §3.4 自身が将来 `combo_oki_options(combo_id, tech_type, attack_type, uses_dr, available)` への正規化を予見。
- **方針（開発者確定 (b)・2026-07-05）**: 正規化を前倒し。新表 `combo_oki_options(combo_id, tech_type, attack_type, uses_dr, available)` を新設し、既存 6 bool を行へ移行（backfill）。`knockdown_advantage` は combos に残置。
- **語彙の骨子（開発者確定・要 friend 棚卸しで最終確定）**:
  - `attack_type` = **投げ重ね（throw_meaty）／シミー（shimmy）／打撃重ね（strike_meaty）**。**打撃重ねが新規追加**（#12・現状欠落）。
  - `tech_type` = その場受け身（neutral_tech）／後ろ受け身（back_tech）。
  - `uses_dr` = ノーゲージ（false）／ドライブラッシュ（true）。**この `uses_dr` を全 attack_type に一様適用する**のが正規化の要。
- **シミーの 4 区分化（開発者新依頼 2026-07-05・記録から消えていた可能性）**: 現状 `combos` は 投げ重ねに `_dr` 有無があるのにシミーには無く（`oki_shimmy_neutral_tech`／`oki_shimmy_back_tech` の 2 個のみ）、**シミーがノーゲージかドライブラッシュかを区別できない非対称**（DES-005 §5.8 line 405-406 の比較表にも「シミー: 単一 ✓/✗」として露出）。正規化で `uses_dr` を一様適用すれば、シミーは **その場×ノーゲージ／後ろ×ノーゲージ／その場×ドライブラッシュ／後ろ×ドライブラッシュ の 4 区分**として自然に表現でき、依頼を満たす。**この非対称是正が正規化前倒しの具体的動機の一つ**（平置き設計の破綻の実例）。
- **既存シミー bool の backfill（開発者確定 2026-07-05）**: 既存 `oki_shimmy_neutral_tech`／`oki_shimmy_back_tech`=true は **ドライブラッシュなし（`uses_dr=false`）を表していた**（開発者確定）。よって backfill は**決定論的**＝既存シミー true 行 → `attack_type=shimmy, uses_dr=false, available=true`。ドライブラッシュ版シミーは新規（既存データなし・利用者が追加）。曖昧性なし。
- **波及**: 6 bool を読む箇所＝ComboResponse／CreateRequest／UpdateMetadataRequest（`*bool`×6）・**一覧/比較/詳細/出力表示**・editor UI（M15-01 test-id `combo-editor-okiMeaty*` 6 個）。DES-005 §5.6/§5.7/§5.8/§5.13 の CHANGE（シミーのドライブラッシュ区分化・打撃重ね追加で行数増）。**dup キー非対象・recipe_cache 内容（レシピ文字列）非対象**（起き攻めはレシピに含まれない）＝blast radius は表示/editor/DTO に閉じる（recipe_hash は不変）。editor UI の test-id 体系は正規化後に再設計（製造裁量）。
- **画面ラベル用語規約（重要・全 M16 指示書へ継承）**: 画面（editor/比較/詳細/出力）のユーザー向けラベルは **「ドライブラッシュ」正式名称を使い、「DR」略記を使わない**（DES-005 §5.6 正典語彙＝M12-03 で「略記『DR』」を解消済み・現行画面も準拠）。内部コード識別子（`uses_dr`・`_dr` サフィックス）は不変。指示書執筆時に画面文言を DES-005 §5.6 正典語彙へ突合する。
- **語彙棚卸し**: friend（上位1%）を巻き込み、pressure-sequence（連携技）設計と同席で 1 回実施（上記 attack_type/tech_type/uses_dr の最終確定・打撃重ねの細分要否）。**G-h 実装前に棚卸しを挟む**（開発者承認済み）。

### 4.4 ④ taxonomy／移動 move 化／④'' dash 一本化（G-i・M16-04）＝最重

- **taxonomy 原則（④）**: 「(a) moves 行（system 含む）／(b) 非技ステップ `modifiers.type`／(c) 隣接 move への modifier（flags）」の振り分け原則を **1 枚に明文化**。現状は原則の断片が DES-004 §2.1/§2.3・SUPP-001 §3.3.1〜§3.3.3・DES-003 §3.5 に散在し場当たり（例：drive_parry＝system move／parry_drive_rush＝modifiers.type の役割分担は既存だが原則が未明文）。
- **移動 system move（④・FB⑦）**: 移動（`jump_neutral`/`jump_forward`/`jump_back`・`dash_forward`/`dash_back`・`micro_forward`/`micro_back`・`forward`/`back`）は **DES-004 §2.1／SUPP-001 §3.3.2 で既に system move として定義済み**。FB⑦「move 化されていない」の実体は **定義はあるが seed／入力 UI で未整備**（HEAD は ryu 中心）と推定＝**実査で確認**（確認事項3）。M16-04 は「原則明文化＋seed/UI enable」。レシピ表記ルール（SUPP-001 §3.3.2＝ジャンプ→攻撃は空中技＋flag で表現しジャンプ move は省略、純移動ジャンプのみ move）を原則へ格上げ。
- **④'' dash 一本化**: dash は **canonical = system move `dash_forward`/`dash_back`（DES-004 §2.1）**。**廃止対象 = modifier.type の方向別 dash（SUPP-001 §3.3.3）**。**（M16-RESEARCH-01 で実態確定＝§4.8: DES-004 §2.3 の単値 `dash` は実装ゼロの spec 幽霊・方向不定行の手当て不要・`ModifiersEditor` に再混入経路が残存・ingrid #91 は移行先 move 不在で移行不能）**。`parry_drive_rush` は cancel 注釈のため modifier.type のまま正。
- **核リスク（FR301/recipe_hash）**: modifier.type dash→move ステップ移行は **recipe_hash（`combo.CalcRecipeHash(steps)`・都度計算・modifiers.type/flags/notes をハッシュ）を変える＝FR301 レシピ同一性/dup に波及**。**現行 dev DB では衝突 0 件（要 M14-03b 後再測定）＝§4.8**。移行計画で衝突検出の要否・「移行先 move 不在」データの扱いを設計（§4.8 要決定事項1〜3）。
- **recipe_cache 波及**: 移行は combo 更新扱い＝`RecomputeComboCache`（eager・arch §9.2）で該当コンボの recipe_cache 再生成が要る。再生成は移動 system move を preset alias で描画するため、**各プリセットに移動 move の alias_text が要る**（未定義なら §5.3 フォールバック＝move.code）。alias 整備は M14-03b seed 契約と連動（§5）。

### 4.5 ④' target_combo 区分正典化（M16-05）

- **現状**: `target_combo` は category enum 値として存在するが、段数付き行は所属セグメント（normal/unique）の category で取込・`tc_<番号>` は FR703 手動分類用に温存（DES-003 §3.3・DES-004 §2.1・CHANGE-026）＝**信頼できる分類として未機能**。別技の move_code 命名は既存のため、命名新設ではなく「分類の正典化」が論点。
- **方針**: 多段特殊技を target_combo として信頼分類する（第一候補）。**（M16-RESEARCH-01 で確定＝§4.8: `category='target_combo'`・`tc_<番号>` とも実データ 0 件＝既存データ移行なし。M16-05 は今後の取込に備えた分類基準の明文化が中心）**。**どの多段特殊技を target_combo とするかは SF6 ドメイン判断**（開発者・friend）。category 運用の CHANGE（DES-003 §3.3／DES-004 §2.1）。**recipe_hash 非対象**（category は dup キーでない）＝G-i の step 移行より blast radius は小。
- **as-built（開発者確定 2026-07-07・CHANGE-065）**: スコープ＝**(i) DES 明文化のみ**（FR703 本体 editor 活性化・別手段識別はいずれも不採用）。**分類は入力支援ツール（TOOL-002・外部）で熟練入力者が人手付与し、本体は取込値を信頼**（自動判定・アルゴリズム分類をしない）。多段に見えても target_combo でない特殊技があり得るため人判断が適切・誤分類は非致命（ユーザー指摘→本体編集/再取込で是正）。**本体コード変更ゼロ・製造ラウンドなし**（CHANGE-062 同型の doc 限定 CHANGE を設計担当が直接起票）。DES-003 §3.3／DES-004 §2.1 反映済み。remap の category=target_combo 通過保存は M14-03b DoD 申し送り（§5-7）。

### 4.6 表記 rollout（旧 M15-07・M16-06）

- FB⑥（技/非技ラベル）＝④ taxonomy 原則確定後にユーザー語彙へ翻訳。FB⑨⑬（drive/SA・custom_states 始動明示）＋⑪（表記面）＝① 始動/消費 確定後に「始動」明示ラベルを横断適用。**M16 末尾（M16-04・M16-02 確定後）に配置**（handover §4・順序を逆にすると誤ラベル）。非スキーマ表記＝Sonnet 4.6。
- **M16-02 から回収する送り事項（CHANGE-061・伝達メモ A-3/A-1・開発者指示「記録しっかり」）**:
  - **A-3 始動/消費ラベルの横断正典化**: 比較「始動残量」／詳細「開始残量」の**同一概念 2 表記の並立**（M16-02 追補の意図的暫定）を統一。en の始動 `(start)`／消費 `consumed` の**語法非対称**を解消。**詳細・比較・入力欄・エクスポートを横断**して始動/消費ラベルを一括正典化（ja/en 両ロケール parity）。FB⑨⑬ と同時に実施。
  - **A-1 エクスポートカードへの消費項目追加**: 消費は詳細・比較に出るが**画像/クリップボード・エクスポート（`combo-io`・`ExportItemKey` opt-in）には未掲載**＝「始動はエクスポートできるが消費はできない」非対称。新 `ExportItemKey`（例 `saConsumed`/`driveConsumed`）＋ UI トグル＋ export-model 行を M16-06 で新設（DES-005 エクスポート項目定義に反映）。
- **別系統（M16-06 とは別・M16-02 追補として先行実装）**: **F-1(a) UI 上限クランプ**（消費入力欄の上限を widget で強制・① VAL 非連動は BE/CSV で維持）。実装後に DES-005 §5.7・DES-006 §2.4 を反映（change-report-061 §4-3・§5）。
- **確定・指示書化（2026-07-07・M16-06 v1.0.0 起票）**: 開発者確定＝**始動 ja =「コンボ開始時の◯◯ゲージ残量」に統一**（「始動残量」「開始残量」の並立解消・長いが誤解防止＝**長ラベルの画面崩れ確認が要件**）／消費 ja は「◯◯ゲージ消費」不変／**en parity**（`{Drive/SA} gauge at combo start`／`gauge consumed`・製造が自然さ最終チェック）／**FB⑥ は新規登録・編集画面のみ**（詳細/比較/出力は対象外）／A-1 消費エクスポートは**始動と対称**／**F-1(a) 始動入力欄も消費と対称にクランプ**（BE/CSV 非連動不変）。非スキーマ・Sonnet 4.6。CHANGE 見込み DES-005 §5.4/§5.6/§5.7/§5.8/§5.13・DES-004（→ CHANGE-066）。指示書 `M16-06-notation-rollout.md` v1.0.0。

### 4.7 画面改修の帰属（新規登録・比較画面。開発者確認 2026-07-05・実査回答）

**問い**: ①（消費列）・③（起き攻め正規化・シミー 4 区分・打撃重ね）は新規登録画面・比較画面にも影響するが、この画面改修はどこかのマイルストーンに入っているか。

**回答（実査済み）**: **M16 の各ゲート内に内包されており、別マイルストーンの取りこぼしではない**。データを触るサブと画面改修は不可分の同一成果物として扱う。

| 画面（DES-005） | 改修内容 | 帰属サブ | 実査根拠 |
|-----------------|----------|----------|----------|
| §5.7 新規登録/編集（editor） | SA/drive 消費入力・起き攻め正規化 UI（シミーのドライブラッシュ区分化・打撃重ね追加・6 bool→options） | **M16-02（G-f）／M16-03（G-h）** | phase3-overview §2.4 G-h「6 bool 読替（一覧/比較/recipe_cache）」・§M16 ① |
| §5.8 比較 | 消費を比較軸に・起き攻め比較表のシミー ドライブラッシュ行追加・打撃重ね行追加 | **M16-02／M16-03** | §M16 ①「比較画面で消費を比較軸に」・DES-005 §5.8 line 405-406（現状シミー非対称） |
| §5.6 詳細 | 消費表示・起き攻め詳細のシミー ドライブラッシュ/打撃重ね | **M16-02／M16-03** | DES-005 §5.6 起き攻め正典語彙（重ね/シミー/ドライブラッシュ） |
| §5.13 出力（PDF/PNG/クリップボード） | 起き攻め行数増（シミー ドライブラッシュ区分化・打撃重ね）・消費項目 | **M16-03（＋M16-02）** | DES-005 §5.13（起き攻め 6 行展開の行数が増える） |

- **別マイルストーンに専用の比較画面改修枠は無い**（M15 の比較は②生 ID バグのみ＝完了、M23 の E-1 はセットプレイ紐付けで別物）。よって M16-02/03 の DES-005 §5.6/§5.7/§5.8/§5.13 CHANGE として拾う。
- **DES-006（検証）**: 消費列は VAL 非連動（① 確定）。起き攻め正規化は available/uses_dr の整合（例：available=false の行の扱い）を着手時に判断。

### 4.8 M16-RESEARCH-01 report 反映（2026-07-05・④/④''/④' の実態確定）

`docs/progress/phase3/M16-RESEARCH-01-report.md` を受領。M16-04/05 の前提が実データ・実コードで確定した（本節が正・詳細は report）。

**確定事実**
- **dash 二重表現（④''）**: 実コード（`internal/model/combo.go` の 4 定数・`web/src/features/combo/labels.ts`）は **方向別 `dash_forward`/`dash_back`（SUPP-001 §3.3.3 系）のみ実装**。**DES-004 §2.3 の単値 `dash` はリポジトリ全体で 0 件（spec のみの幽霊）**。よって**廃止対象は modifier.type の方向別 dash のみ**、方向不定行の手当ては不要。ただし `ModifiersEditor` が dash_forward/dash_back を選択肢として温存＝**混在を再発させる経路が残存**（M16-04 で撤去要）。dev DB 実データ＝modifier.type dash は combo 17 件・setup 1 件、system move dash 参照は combo 2 件・setup 1 件（setup 13 は同一レコード内で両表現混在）。
- **dup 衝突（核心）**: **recipe_hash は DB 列でなく `combo.CalcRecipeHash(steps)` の都度計算**（code-facts 非表出＝静的抽出対象外関数）。**modifiers.type/flags/notes すべてハッシュ対象**。published 30 件で dash 移行を仮定した照合＝**dup 衝突 0 件**。**要 M14-03b 後の再測定**（母集団=ryu 中心・少量）。
- **【新規ブロッカー】ingrid combo #91 が移行不能**: ingrid（character_id=6）に system move dash が **0 件**＝置換先 move が無く移行できない。M16-04 は「衝突処理」だけでなく**「移行先 move が無いデータの扱い」も同時にスコープへ含める**必要がある。
- **移動 system move の seed 実態（④・FB⑦）**: system move は **ryu のみ 8 code**（`drive_parry`/`dash_forward`/`dash_back`/`jump_neutral`/`jump_forward`/`jump_back`/`micro_forward`/`micro_back`）。**`forward`/`back` は実装ゼロ**（DES-004 §2.1 の spec のみ）。**classic5（ken/ingrid/c_viper/dhalsim）は system move 0 件**（取込由来・マイグレ未追跡）。jump_* の combo 参照は**実データ 0 件**（レシピ表記ルール＝ジャンプ move 省略・flag 付与が守られている）。
- **alias 連動の実コード裏付け**: `preset_aliases` は `(preset_id, move_id)` キーのため、**新規に system move を seed するキャラは既存 alias を流用できず、alias 行を追加しないと生 code 表示にフォールバック**する。**移動 move の seed と alias seed を対にする**必要（M14-03b seed 契約連動＝§5 の裏付け）。
- **④' target_combo**: `category='target_combo'`・`tc_<番号>` とも **実データ 0 件**（enum 定義はあるが未使用＝CHANGE-026 の「温存」段階どおり）。**M16-05 は既存データ移行を伴わず、今後の取込に備えた分類基準の明文化が中心**。

**RESEARCH が発見した DES 自己矛盾（設計担当が CHANGE で解消）**
- **DES-004 §2.1（方向別 dash）vs §2.3（単値 dash）の自己矛盾**: 実装は方向別のみ。**§2.3 の単値 `dash` を §3.3.3（方向別）に整合させる CHANGE**を M16-04 の CHANGE に含める（旧記述の是正）。
- **`high_jump` の三者不一致**: DES-004 §2.3（flag・未実装）／ SUPP-001 §3.3.1（flag 不採用）／ SUPP-001 §3.3.2（move・共通システム外）が食い違い、実 DB は c_viper の `high_jump_forward`/`high_jump_neutral`（方向別・category=unique）でいずれとも不一致。**M16-04 の taxonomy 明文化で扱うか先送りかを判断**（要決定事項5）。

**M16-04/05 着手前の要決定事項（開発者判断・report §要決定事項に対応）**
1. **移行スコープ**: ingrid の dash_forward/dash_back を M16-04 で追加 seed して #91 を移行するか、ken/c_viper/dhalsim（modifier.type dash 実データなし）と併せ **M14-03b 全キャラ seed へ委譲**するか。`forward`/`back`（実装ゼロ）・`high_jump`（定義不一致）を M16-04 に含めるか除外するか。
2. **dup 検出ロジックの要否**: 現行「衝突 0 件」を根拠に検出なしで一括移行するか、将来の全キャラ seed を見越し移行スクリプトに衝突検出（検出時スキップ＋一覧出力）を組み込むか。draft/trash 分（現状 VAL-C02 対象外）を移行対象に含めるか。
3. **「移行先 move が無い」データ（ingrid #91）の扱い**: seed 追加を待つ／modifier.type のまま据え置く／手動対応のいずれか。
4. **ModifiersEditor の dash 撤去**と、RecipeBuilder/SetupRecipeEditor の「システム」「共通システム(移動・その他)」2 optgroup での dash 重複表示の整理範囲。
5. **spec 矛盾の解消**: DES-004 §2.3 単値 dash の是正・`high_jump` 三者不一致の解消を M16-04 の CHANGE で扱うか、別 CHANGE で先行するか。
6. **alias 整備**: 新規 system move を seed するキャラの alias 行を同一マイグレで対にするか。移行後の `RecomputeComboCache`（全件再計算）を M16-04 に含めるか。

**要決定事項の確定（2026-07-06/07・M16-04 実装完了で反映）**
1. **移行スコープ＝ryu 既存のみ／他キャラ移動 move は M14-03b へ委譲**（ingrid #91 は追加 seed せず・下記3）。`forward`/`back`（実装ゼロ）・`high_jump`（CHANGE-062 で unique 確定）は M16-04 に含めない。
2. **dup 検出はマイグレに積まない**（純 SQL transform）。衝突照合は配布 DB＝M14-03b remap（Go）／既存 user DB＝CRUD 時強制。draft/trash も transform 対象（衝突照合は published のみの概念だが、マイグレに検出自体を積まないため無関係）。現行 dev 0 件・M14-03b 後に再測定。
3. **「移行先 move が無い」データ（ingrid #91）＝汎用 skip（`WHERE EXISTS`・無損失据え置き）**。出荷マイグレに #91 を直書きせず、dev の #91 は dev クリーンアップで削除。恒久解消は M14-03b 全キャラ dash seed＋skip 掃き取り（§5-7 DoD）。
4. **ModifiersEditor の dash 撤去を M16-04 に含める**（配列駆動で自動消滅）。RecipeBuilder/SetupRecipeEditor の 2 optgroup dash 重複は「システム」optgroup（system move）へ一本化。
5. **spec 矛盾は CHANGE-062 で先行解消済み**（単値 dash 幽霊・high_jump=unique）。M16-04（CHANGE-064）は方向別 dash の実撤去・移行のみ。
6. **alias＝ryu dash は既存 alias 実在（`official_ja_move`・`migrations/000006`）＝000022 で INSERT 不発**。他キャラの move+alias 対整備は M14-03b。**`RecomputeComboCache` はマイグレに積まない**（移行前後で表示バイト一致＝regen 不要）。詳細は CHANGE-064／M16-04 指示書 v1.0.1。

> **M16-01/02 への影響**: 本 report は **M16-01（G-g）・M16-02（G-f）の「dup 非対象」前提を実コードで裏付けた**（dup キー＝character/starter/position/stance/hitType/size＋`CalcRecipeHash(steps)`。drive 始動残量・消費列は非対象）。**M16-01/02 の指示書は本 report で修正不要**。

---

### 4.9 M16-07 int custom_states ストック 2 値化＋増減（FB⑬ 深掘り・開発者確定 2026-07-08）

- **背景**: int 型 custom_states（キャラ固有ストック・例 Ingrid の `sun_crest`）を持つ一部キャラで、現状は当該状態の項目を **1 つ**しか出しておらず何を表すか不明。FB⑬ の「始動ゲージ明示」は drive/SA では A-3 で達成したが、custom_states ストックは別データ体系で未達＝本サブで対応（架構 §9.1 の B-1「一般 custom_states 消費モデル化＝据え置き」の限定的再開）。
- **要件**: int custom_states を **①始動時に必要な最低ストック数／②終了時ストック数**の 2 値化＋**③増減（②−①・符号付き）を FE 自動計算**。③は**方向可変フラグ（`show_delta`）が立つ state のみ表示**（Ingrid=可変=表示／Mai・Lily・Juri・Kimberly=一方向=非表示）。ラベルは name_ja/en＋固定文字列で生成（総称「ストック」・③例「{name}：ストック増減」・**初版は仮・気に入らなければ修正指示**）。
- **格納（重要）**: per-combo 値は `combos.situation` の `custom_states` キー（opaque JSON・BE 素通し `situation *string`）。2 値は **`{"code": {"start_min": n, "end": m}}` 構造化**で保持＝**スキーマ/DTO/BE 変更なし**（FE 整形）。situation は `recipe_hash`（steps）・`DuplicateKey`（6 フィールド）**いずれにも非対象＝dup/recipe 非波及**。
- **DEF**: `characters.custom_states` の int state def に **`show_delta: true/false`** を追加（DES-003 §3.2 拡張）。Ingrid=true・他 4 キャラ=false。ラベルは name＋固定句で生成し DEF に 2 値項目は足さない。
- **スコープ切り分け**: M16-07 は**モデル＋Ingrid（唯一の testable）**を実装。他 4 キャラは def フラグ設定のみで **E2E は M14-03b（全キャラ seed）連動で後回し**（開発者確定）。
- **移行**: 既存 situation.custom_states スカラ値は dev-disposable（int 実データは Ingrid のみ）＝移行最小（既存スカラは②へ写像 or クリア＋Ingrid 手動再入力・他 4 キャラは対象なし）。
- **CHANGE 見込み CHANGE-067**: DES-003 §3.2（def `show_delta`）／DES-005 §5.6/§5.7/§5.8/§5.13（2 値・ラベル・増減）／seed（Ingrid def フラグ）／DES-006（2 int 検証・要否）。**Opus 4.8＋Plan**・破壊的 DDL マイグレなし（def フラグは JSON patch・situation は opaque）。着手前承認＝データモデル判断ゲート（G-i 隣接型）。

## 5. 依存関係・進行順序（【重要】worktree 並列可否）

> 私（開発者）の git worktree 並列運用（2〜3 並列）向けに、各サブが「並列可（相互独立）」か「直列必須（先行サブのデータ/スキーマ確定に依存）」かを明示する。**M16 は承認ゲート・スキーマ移行・ドメイン判断の連鎖が多く直列寄り**。安全寄り（無理な並列化でコンフリクト/バグを作らない）を基本とする（開発者方針 2026-07-05）。

1. **M16-01（② drive REAL・G-g）**: 先頭。**並列可の唯一候補（条件付き）**。#21 論点②＝dup キー非対象・blast radius 小。ただし (i) 消費列の型/drive 消費含否（確認事項1）が確定し、(ii) combo 表示層で M16-02 と表示改修が近接しない（実査で独立性確認）した場合に限る。**条件を満たさない/疑わしい場合は直列**（安全寄り）。
2. **M16-02（① SA 消費列・G-f）**: M16-01 の型方針（REAL/0.5）確定後。列追加自体は低リスクだが、型方針とゲージ表示層を M16-01 と共有するため**原則直列**。
3. **M16-03（③ 起き攻め正規化・G-h）**: **直列必須**。reader（一覧/比較/詳細）・editor・DTO 6 bool の同時改修＋語彙棚卸し（G-h 実装前）。recipe_cache/dup 非波及だが表示/editor 波及が広い。
4. **M16-04（④ taxonomy＋移動 move 化＋④'' dash・G-i）**: **直列必須（最重）**。原則明文化（設計）→ dash 一本化の破壊的マイグレ（000022）の内部段階。**マイグレは純 SQL の transform＋skip に限定**（recipe_hash は `CalcRecipeHash(steps)` 都度計算＝保存列なし・dup 検出は M14-03b remap／CRUD 時強制・recipe_cache は既定プリセット表示安定で regen 不要＝マイグレに積まない。alias 無い場合のみ 000022 で SQL INSERT）。詳細は M16-04 指示書 v1.0.1。
5. **M16-05（④' target_combo・category）**: **直列必須**（M16-04 taxonomy 確定後）。ただし step 移行を伴わない category 運用のため M16-04 より軽い。
6. **M16-06（表記 rollout・旧 M15-07）**: **直列必須**（M16-04・M16-02 確定後・M16 末尾）。
7. **M14-03b（全キャラ seed 投入・M14 lineage）**: **直列必須（G-i＝M16-04 確定後・M17 前）**。**配布 blocker**。seed インフラは **G-i canonical（移動 system move 行・dash 一本化後・taxonomy 準拠 move_code・移動 move の preset alias）を出力する seed 契約**とする（M16 の taxonomy/dash 決定が seed 契約になる）。手入力 CSV が見込み前倒しで作られているため、想定と異なる CSV は seed 変換インフラの remap 層で機械整形して canonical へ寄せる（人力再入力なし）。**加えて、配布 DB 構築時の dup スキャン責務を remap 層（Go）が担う**（M16-04 はマイグレに dup 検出を積まない＝純 SQL transform のため。既存 user DB は CRUD 時強制でカバー・配布 DB は remap がビルド時にスキャン。開発者承認 2026-07-07・M16-04 指示書 §3.4-4/§4.5 と対）。検出エンジンは判断3（command 索引化）の取込ヘルパーと同型で remap 層に集約する（「二度作らない」）。**キャラは 30→絞る可能性あり（選定は製造担当裁量）＝M16 taxonomy はキャラ数非依存で不変。配布完了定義（followup §C-1）の閾値のみ調整**。

> **M14-03b DoD 申し送り（M16-04 伝達メモ §3-1/§3-2/§4-2 反映・2026-07-06）**: M16-04 の as-built を受け、M14-03b の DoD に次を含める。(a) **全キャラ system move dash（`dash_forward`/`dash_back`）を seed し、`preset_aliases`（move_id キー）を対で用意**（新 move は alias が無いと生 code フォールバック）。(b) **skip 残行の掃き取り follow-up マイグレ**＝M16-04 で移行先 dash 不在により skip された modifier.type dash 行は、resolver から dash ラベルが撤去済みのため**再計算されると生 code "dash_forward" 表示に化ける潜在バグ**（伝達メモ §3-1。clean/user DB は ryu のみ＝skip 0 で無害・dev の #91 や非 ryy import DB でのみ発生）。全キャラ dash seed 後に残 modifier.type dash を移行しきり skip をゼロにする。(c) **dup 衝突の再測定**（M16-04 の「0 件」は RESEARCH 時点の dev DB 値・M14-03b 後に remap スキャンで再測定）。**ロールバック注記**: M16-04 の 000022 down は native 由来 dash（seed combo 116・setup 13 の native step）も modifier.type dash 化する非対称があり（marker 不在・伝達メモ §3-2）、down を伴う手順を書く際は要明記。(e) **target_combo の通過保存（M16-05・CHANGE-065）**: remap は入力支援ツールで人手付与された `category=target_combo` をそのまま通過保存する（本体は取込値を信頼・自動判定しない）。入力ツール（TOOL-002）側で target_combo 人手付与を可能にする契約は本体 CHANGE 対象外。

> **並列化の結論**: M16-01 のみ条件付き並列可。**M16-03/04/05/06・M14-03b は直列必須**。承認ゲート連鎖・移行連鎖・順序依存（表記 rollout）のため、M16 は直列運用を基本とする。

---

## 6. 承認ゲート・移行計画スケルトン（着手前ゲート・§2.4 準拠）

> 各破壊的マイグレの**着手前ゲート**（digest §5・M12-5）: `dbtest.Setup` 波及・**FK=OFF × 明示 DELETE を同一指示書に同居させない**・down 整合・既存マイグレ非改変（新規連番追加）。マイグレは **000019 以降**。update-strategy 3 点セット（可逆前進マイグレ＋事前バックアップ）に乗せる。

| ゲート | マイグレ方式（スケルトン） | 後方互換 CSV | dup/recipe_hash | 個別承認 |
|--------|---------------------------|--------------|-----------------|----------|
| **G-g** | 000016 型（FK=OFF・一時名経由の**テーブル再構築**）で `drive_available_at_start` を REAL 化。既存整数値は REAL へ無損失昇格。down で INTEGER へ戻す | 意味単位（値のみ・列名不変）＝影響小 | **非対象**（始動残量は dup キー外） | M16-01 着手直前 |
| **G-f** | `ALTER TABLE combos ADD COLUMN` を 2 本（SA 消費 INTEGER〔0〜6〕・drive 消費 REAL〔0〜20・0.5 刻み〕）。既存行 NULL。down で DROP COLUMN | **列末尾追加＝旧 CSV 非破壊**（意味単位） | **非対象**（メタデータ・dup キー外） | M16-02 着手直前 |
| **G-h** | `combo_oki_options` 新設 → 既存 6 bool を行へ backfill（既存シミー true → `uses_dr=false` 決定論）→ 打撃重ね/シミーのドライブラッシュ区分を空で拡張 → 6 bool 列 DROP（段階可）。down で 6 bool へ逆 backfill | 意味単位（tech_type/attack_type コード・列構造変更は往復ロジック改修） | **非対象**（起き攻めは dup キー外・recipe_hash 不変） | M16-03 着手直前 |
| **G-i** | **純 SQL・as-built**：modifier.type 方向別 dash を走査し system move dash ステップへ移行（`move_id` 設定＋dash type 除去・空 `modifiers` は `{}`→`NULL` 正規化で recipe_hash 一致）→ 移行先不在は `WHERE EXISTS` で無損失 skip＋一覧。**dup 検出・`RecomputeComboCache` はマイグレに積まない**（recipe_hash は都度計算・dup は M14-03b remap／CRUD 時・cache は表示バイト一致で regen 不要）。down は逆写像（native も戻す lossy・§5-7 注記） | 意味単位（move_code ベース＝M13-6 頑健性）。ryu dash alias 既存＝INSERT 不発・他キャラ alias は M14-03b | **対象（核）**。recipe_hash は都度計算で移行後に変化・dup は CRUD 時／remap で担保（マイグレ非搭載）。現行衝突 0 件 | M16-04 着手直前（**最重**・承認 2026-07-06） |
| **④'（category）** | 多段特殊技行の `category` を target_combo へ付け替え（step 移行なし） | 意味単位（category コード） | 非対象（category は dup キー外） | M16-05 着手直前 |

---

## 7. 完了の観点（M16 クローズ）

- ② drive 始動残量が REAL（0.5 刻み）で入力・保存でき、sequence 側と粒度が揃う（M16-01）。
- ① SA 消費が手入力列で記録・表示・比較でき、検証は連動しない（M16-02）。
- ③ 起き攻めが `combo_oki_options` へ正規化され、打撃重ねが記録でき、一覧/比較/editor が新構造で不変動作（M16-03）。
- ④ taxonomy 原則が 1 枚に明文化され、移動が system move で扱え、dash 二重表現が一本化され、既存レシピの同一性/dup が移行計画で保全される（M16-04）。
- ④' 多段特殊技が target_combo として信頼分類される（M16-05）。
- FB⑥⑨⑪⑬ の表記ラベルが taxonomy/始動消費 確定後に追従する（M16-06）。
- M14-03b が M16 canonical で全（/絞り込み）キャラ seed 済み＝配布 blocker 解消・M17 前提充足。
- 各ゲートの破壊的マイグレが up/down 整合・`dbtest.Setup` 経由で既存 E2E 非回帰・後方互換 CSV 往復成立。
- DES-003/004/005/006・SUPP-001 の CHANGE が着手時 view で確定し、三点セットで反映。

---

## 開発者への確認事項

> **全確認は解消済み（2026-07-05）**。ドメイン/スコープ確認に加え、**§3 サブ分割の最終承認も取得**（下記 S＝承認済み）。本書は v1.0.0（分割承認済み）。以降の残作業は各サブ指示書の起票・着手時 view 確定。

**確定事項（再協議不要・記録）**
- **①（消費列）**: SA 消費＝**INTEGER・0〜6**（コンボ中に溜まり始動 0〜3 を超えるため上限 6）＋drive 消費＝**REAL・0.5 刻み・0〜20**（念のための余裕枠）。記録/表示/比較のみ・VAL 非連動。
- **②（drive 型）**: `drive_available_at_start` INTEGER→REAL・widget 0.5 刻み・粒度統一。
- **③（起き攻め）**: `combo_oki_options(combo_id, tech_type, attack_type, uses_dr, available)`。**打撃重ね追加＋シミー 4 区分化（`uses_dr` 一様適用）**。**既存シミー true → `uses_dr=false`（ドライブラッシュなし）決定論 backfill**。G-h 実装前に friend 語彙棚卸し（pressure-sequence 同席）。**画面ラベルは「ドライブラッシュ」正式名称・「DR」略記不可**（DES-005 §5.6 正典・§4.3 用語規約）。画面改修は本サブ内包（§4.7）。
- **④''（dash）**: canonical=方向別 system move へ一本化。dup 衝突は検出→提示（自動マージしない）。
- **④（移動 move 化）**: 「定義済み・seed/UI 未整備」想定＋**M16-04 頭に実装前調査**（read-only）。
- **⑤（マイグレ）**: **連番分離**（G-g=000019 再構築／G-f=000020 列追加）。
- **⑥（M14-03b）**: seed 契約＝G-i canonical 出力・見込み CSV は remap 整形。絞り込み確定時に配布完了定義（followup §C-1）調整。

**S. §3 サブ分割・連番・実装順＝承認済み（2026-07-05）**
   M16-01〜06 ＋ 番外 M14-03b の分割・搬送順（G-g→G-f→G-h→G-i→④'→表記 rollout→M14-03b）を開発者承認。model-allocation へ追記し、M16-01（G-g）指示書＋レビューチェックリスト（M14-01/02 書式）を起票する。

---

*以上、M16-overview v1.0.0（分割承認済み・2026-07-05）。配置 `docs/instructions/phase3/M16-overview.md`。本書は M16（データモデル拡充・スキーマの継ぎ目）の正本であり、各サブ指示書の上位文書。承認ゲート G-f/G-g/G-h/G-i は phase3-overview v1.1.2 §2.4 を正とし、搬送順 G-g→G-f→G-h→G-i、末尾に ④' → 表記 rollout → M14-03b。破壊的マイグレは M13 export 安全網の上で意味単位・後方互換で搬送する。全ドメイン/スコープ確認・サブ分割承認とも解消済み。各サブ指示書（Opus 4.8＋Plan Mode）と対のレビューチェックリストを M14-01/02 書式で起票する。*
