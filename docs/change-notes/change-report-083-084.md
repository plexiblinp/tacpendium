# change-report CHANGE-083／084（M18-02 確定反撃サーチ・実装反映報告）

| 項目 | 内容 |
|------|------|
| 対象 CHANGE | **083（`combo_punish_starters` 新設）／084（移動 system move の `total` backfill・v2）** |
| サブマイルストーン | M18-02（確定反撃サーチ・探す画面） |
| 作成日 | 2026-07-26 |
| 作成者 | 設計担当 Claude（M18/M19 並列期・中央／セッション2） |
| 実装 | ブランチ `claude/m18-02-work-47t9ro`（**main 未マージ**・push 済・51 commits・末尾 `1393925`） |
| 指示書 | M18-02 v1.0.1／レビューチェックリスト v1.0.1 |
| 判定 | **受理**（M18 指示書担当の一次受け v1.1.0＝レビュー合格・重大ゼロ・DoD 必須 3 点確認済）。**残ゲート＝E2E の pin 一致環境での再実行**（§6） |
| 消費連番 | **マイグレ 000040（CHANGE-083）／000041（CHANGE-084 v2）**（中央払い出し・搬送順どおり） |

> 2 CHANGE は同一サブ（M18-02）で一体に実装・検証されたため、**change-report を 1 本に集約**する（registry では 083／084 を個別に「反映」へ更新）。CHANGE-078〜082 と同じ扱い。

---

## 1. 実装結果サマリ

| CHANGE | 実装物 | マイグレ |
|---|---|---|
| 083 | `combo_punish_starters`（`self_character_id`／`opponent_move_id`／`starter_move_id`／`verdict`／`note`／timestamps TEXT・**UNIQUE 3 列**・INDEX(opponent_move_id)） | 000040 |
| 084 | 移動 system move の `total` backfill（**UPDATE のみ・DDL なし**） | 000041 |

**あわせて実装された機能**（スキーマ非変更・上記 2 CHANGE の反映範囲に含める＝§3）：確定反撃サーチ画面（`/punish/search`・3 階層ツリー・3 レーン）と API 7 本。

## 2. 件数検算（E-16／E-18・付帯条件 3）

- **CHANGE-084 の更新行数＝50 行**。**数えた対象＝`total IS NOT NULL` になった `moves` 行数**（移動 5 code × 10 キャラ）。
- **内訳＝`dash_forward` 10／`dash_back` 10／`jump_neutral`・`jump_forward`・`jump_back` 計 30**。
- **対象キャラ（10）**＝ryu／ken／ingrid／terry／guile／lily／kimberly／juri／mai／zangief。**c_viper／dhalsim は対象外**＝`total` は NULL のまま（仮登録キャラ・攻撃技 0 件で候補生成に寄与しない）。
- **ジャンプ 3 code は同値**（前・後ろ・垂直で値が変わらない）＝1 キャラ 1 値を 3 行へ投入。
- **代表値の assert**＝ryu 19／23／43・lily 21／24／45・zangief 22／25／44。
- **値の一次源＝CHANGE-084 v2 §3.1 の表**（開発者提供・実測・2026-07-23 受領）。**マイグレ本体のコメントに出所を記載済**（付帯条件 2）。

## 3. 非破壊性の証跡

- **既存マイグレ 000001〜000039 は非改変**（新規 000040／000041 の追加のみ）。
- **`internal/seedgen` 非改変**（`git diff` 空）＝golden（000026／000030 の byte-identical 比較）green。
- **既存 3 表（`combo_punishes`／`combo_punish_prunings`／`combo_punish_curations`）の定義は不変**。
- **`DuplicateKey`・`CalcRecipeHash`・`RecomputeComboCache` 不変**（`combo_punish_starters` は dup／recipe 非対象）。
- **`ComboEditor` の Props 契約（`mode`／`initial`／`initialCharacterId`）不変**（`location.state` の読み取りのみ）。

## 4. 設計判断の実装時確定

| 項目 | 確定内容 |
|---|---|
| 新表の粒度 | **始動技レベル**（`self_character × 相手技 × 始動技`）。既存 3 表（コンボ単位 2／マッチアップ単位 1）と重複しない |
| `verdict` の値域 | **自由 TEXT ＋ VAL 担保・DB CHECK は新設しない**（CHANGE-082 で確立した方針の踏襲） |
| `verdict` のレーン粒度 | **レーン非依存**（`lane` 列なし）＝同一始動技の不採用は全レーン一括。レーン別採否は**見送り確定**（需要が実データで出てから `lane` 列追加＋UNIQUE 4 列化を検討＝早すぎる一般化の回避） |
| ジャンプ攻撃 | 追加スキーマ不要＝`starter_move_id` に空中技 id を入れて本表で吸収 |
| **相手技の除外規則の拡張** | **移動 system move 9 種＋空中攻撃（`is_aerial=1`）を除外規則より前で完全除外**（成立ツリー・手動確認レーンの**双方に出さない**）。「除外は消さず手動確認へ出す」という設計思想に対する**意図的な例外**＝そもそも反撃対象になり得ない技は手動確認する意味もないため。実画面確認に基づく開発者判断 |
| 空中技コードの判別 | **`is_aerial=1`（主）AND `HasPrefix("jumping_heavy_")`（補助）の二重担保**。実データで `is_aerial=1` の 70 件中 **9 件が `jumping_` 接頭辞を持たない**（`elbow_drop`／`flying_body_press` 等の unique 系＋`neutral_jumping_heavy_kick`）ことが着手前実査で判明したため、接頭辞のみ／`is_aerial` のみでは取りこぼし・巻き込みが起きる |
| ジャンプ経由レーンの基準 | **キャラのジャンプ全体（43／44／45）**であって「ジャンプ攻撃 move の `total`」ではない。空中技はツリーの子＝**何を出すかの列挙役**でフレーム判定に関与しない。`JUMP_SLACK=4` は経験則の近似＝**定数 1 箇所定義＋根拠コメント**とし、調整根拠は `combo_punish_starters.verdict` の分布（偽陽性＝`unreachable` 件数）を運用後に見る |
| DELETE のインターフェース | **キー項目をボディで受ける**（サロゲート id ではなく UNIQUE キーで行を特定）＝UI のトグル解除に対応し、FE が id を保持しない設計 |

## 5. DES 本体への反映（中央実施・本 report と同時）

| 文書 | 版 | 反映内容 |
|---|---|---|
| **DES-003** | 1.33.0 → **1.34.0**（第37版） | **§3.18 `combo_punish_starters` 新設**（定義・UNIQUE／INDEX・既存 3 表との粒度差・用途限定・レーン非依存の明記）／**§3.3 に移動 system move の `total` 注記**（直接保持＝**算出式の検算対象外**・50 行の内訳・一次源・seedgen 非改変ゆえ seed 波ごとに backfill が要る旨・ジャンプ攻撃 +3 を保存しない理由）／**§2 ER 図**に関連 3 本／**§4 インデックス方針**に 1 行 |
| **DES-005** | 2.48.0 → **2.49.0**（第60版） | **§5.20「確定反撃サーチ（探す）」新設**（画面20・URL query・3 階層ツリー・3 レーンと表示ラベル・採否トグル・pruning・note 2 系統・「前提と限界」ヒント・除外規則の拡張・**ガードタブ 0 件は正常**・既知の限界 3 件）／**§2 画面一覧に画面20 を追加** |
| **DES-002** | 1.34.0 → **1.35.0**（第37版） | **§4.2 に API 7 本**（`GET /api/punish-finder`＋`combo-punish-starters`／`combo-punishes`／`combo-punish-prunings` の POST・DELETE）／**技編集時の `["punish-finder"]` 無効化**の明記／**CHANGE-078／080 が反映先を「§7」と記した誤りを §4.2 へ是正** |
| DES-004 | 1.15.0（**据置**） | §2.5（`is_projectile`）は M18-01 で正典化済＝**変更なし** |
| DES-006 | 1.21.0（**据置**） | `verdict` は自由 TEXT＋VAL 担保で **CHANGE-082 の既存方針に含まれる**ため新規 VAL を設けない |
| REQ-001 | 2.17.0（**据置**） | NFR406 は CHANGE-077 で正典化済＝**変更なし** |

### 5.1 反映範囲の拡張（中央判断・2026-07-26）

**CHANGE-083 の反映先に DES-002 §4.2 を追加**した。起票時の通知書 §5 は「DES-002 変更なし予定」としていたが、実装は `/api/punish-finder` 他 7 本を新設しており、**反映先が無いまま残ると DES-002 と実装が乖離する**。

- **番号を増やさず 083 の範囲を広げた**理由＝M18-02 は 1 サブで不可分に届き change-report も 1 本になるため（**CHANGE-085 で DES-002＋DES-005 を 1 本に束ねた前例と同じ論理**）。分割は churn を増やすのみ。
- **黙って広げない**ため、本節と registry に拡張の事実を明記する（§4.18＝撤回・確定した論点は全箇所へ波及させる）。**開発者承認済**（2026-07-26）。

### 5.2 あわせて実施した errata（版に含めて記載・スキーマ／機能は不変）

1. **DES-005 の節番号の誤記**：第59版のステータス欄は「§5.4 コンボ登録の hit_type プルダウンを 4 値化」と記していたが、**§5.4 はコンボ一覧でありプルダウンを持たない**。**実体は §5.7（コンボ登録・編集）**。第60版で是正（**否定形の確認**＝§5.4 に 4 値化・表示ラベルの記述は存在しない）。
2. **DES-005 §2 画面一覧の欠落**：**画面19「取込ヘルパー」の行が無かった**（§5.19 本文は第53版・CHANGE-071 で新設済）。第60版で補完。

## 6. 残課題・繰越

| # | 項目 | 処遇 |
|---|------|------|
| 1 | **E2E の pin 一致再実行** | 環境要因（browser 1194／expected 1223）で正規 `make e2e` 未実施。`executablePath` 一時上書きで 2 spec green を実測（設定は revert 済）。**M18-01 と同じ扱い＝開発者環境での再実行を残ゲート**とする |
| 2 | **pruning の解除・再表示 UI** | 解除 API は実装済・FE 導線が未スコープ（**片道操作**）。**M18-03 の「隠したもの管理」へ curation の解除 UI と集約**（開発者承認 2026-07-26）。DES-005 §5.20 既知の限界 1 に明記 |
| 3 | **「自動判定できない相手技」配下の既登録確定反撃の表示** | M18-03 の表示設計とあわせて詰める。DES-005 §5.20 既知の限界 2 |
| 4 | **自技 `startup IS NULL` の静かな脱落** | 相手技側の「消さずに出す」思想と非対称。**件数を実測のうえ** M18-03 で自技側の「データ不足」表示要否を判断。DES-005 §5.20 既知の限界 3 |
| 5 | **`neutral_jumping_heavy_kick` のジャンプ経由レーン除外** | 抽出条件（`jumping_heavy_` 接頭辞）に一致せず落ちる。**開発者ドメイン確認の結果、現状の除外を維持**（2026-07-26） |
| 6 | **未 seed キャラの `total` backfill** | followup-backlog §C `M14-03-dash-total-backfill`。**`M14-03-is-projectile-backfill` と 2 種併走**。本 report により §C の記述を実体（10 キャラ×5 code＝50 行）へ是正 |
| 7 | **E-14 突合（M18-03 着手時）** | M18-02 が触った資産＝`internal/service/punishfinder/`・`combo_punish_starters` リポジトリ・`/api/punish-finder` 他・`web/src/features/punish/`・`ComboEditor` の `location.state` 読み取り・migrations 000040／000041。M18-03 の改造対象と突合し回帰ゲートを足す |
| 8 | **リポジトリ配置の通知書と中央正本の一致確認** | 製造が CHANGE-083／084 通知書テキストを `docs/change-notes/` へ配置した（指示書が必読としたが未配置だったため）。**内容は開発者手交の正典テキスト**とのことだが、配置版と中央正本の突合は開発者管掌 |

---

*以上、change-report CHANGE-083／084（M18-02）。DES 本体反映・registry 更新は中央が同時実施。*
