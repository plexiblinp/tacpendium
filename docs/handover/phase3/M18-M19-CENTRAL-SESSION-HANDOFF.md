# 中央（設計担当）セッション 引継ぎ資料 — M18/M19 並列期

| 項目 | 内容 |
|------|------|
| 版 | v1.0.0（2026-07-24 作成） |
| 目的 | コンテキスト逼迫のためセッションを再開する。**この 1 枚＋台帳＋uploads の設計書があれば中央業務を即継続できる**ようにする |
| 役割 | **中央＝設計担当 Claude**（playbook §15.6）。M18/M19 を限定的並列で進行中。チャット構成＝中央＋M18 指示書担当＋M19 指示書担当。**チャット間通信なし＝開発者が全リレー** |
| 最優先で読むもの | **`M18-M19-central-working-lessons.md`（内部版 v0.2.6）**＝コンパクション退避を兼ねた LIVE 台帳。付録A に採番台帳・版マニフェスト・払い出しログ、§1 に教訓 G-1〜G-4。**再開直後に必ず全読すること** |

---

## 0. 中央の職務（3 つの共有直列リソースだけを一元管理）

中央が払い出す/管理するのは **(1) マイグレ連番 (2) CHANGE 番号 (3) DES/REQ 本体反映** の 3 つだけ。
- **指示書番号（M{N}-RESEARCH-NN／M{N}-NN）はマイルストーンローカル＝各担当が自採番**（中央対象外）。
- **overview・model-allocation・followup・playbook** も中央が版正本を持つ（自由改訂）。
- 指示書担当は**自採番しない・DES/REQ 本体を直接改訂しない**（読むのは可）。設計変更は「DES 反映要点」を中央へ渡す。
- **着手前ゲート＝通知書＋registry まで／DES 本体＋change-report は実装完了後**（M17-D10）。
- **承認ゲート**（新テーブル・新列・新ドメイン）は着手前に開発者の個別承認が要る。
- CHANGE 反映は並列でも 1 本ずつ直列（§21.4）。

---

## 1. 現在地（2026-07-24 時点）

### 1.1 採番・版（★台帳 付録A が正本。ここは要約）

| リソース | 現在値 | 次 |
|---|---|---|
| **CHANGE 番号** | 072〜082 反映済／083・084・085 起票済 | **086** から（欠番 008/009/014） |
| **マイグレ連番** | 000036〜000041 払い出し済 | **000042** から |
| change-number-registry | **v1.78.0** | — |

**設計書 現行版**: REQ-001 2.17.0／DES-001 1.4.0／DES-002 1.34.0／**DES-003 1.33.0**（第36版＋errata①drive_parry＋errata②KA 意味論）／**DES-004 1.15.0**（第16版＋errata jumping_）／**DES-005 2.48.0**（第59版）／**DES-006 1.21.0**（第23版）／SUPP-001 1.27.0。
**恒久資料**: phase3-overview **1.1.3**／model-allocation **1.39.0**／playbook **2.1.0**／M18-overview 0.1.1／M19-overview 1.3.0（担当メンテ）／M18 物理設計プラン 0.6.0-plan。

### 1.2 CHANGE の状態

| CHANGE | 内容 | 状態 |
|---|---|---|
| 078-082 | M18-01 スキーマ基盤（combo_punishes／prunings／curations／materialized_from／is_projectile／hit_type 拡張） | **反映済**（三点セット完了・change-report-078-082） |
| **083** | M18-02 `combo_punish_starters`（マイグレ 000040） | **起票**（実装完了・実機確認+完了報告待ち） |
| **084 v2** | M18-02 移動 5 code×10 キャラ total backfill・50 行（マイグレ 000041） | **起票**（同上） |
| **085** | M19-01 提案 API/UI（DES-002+005・マイグレ非消費） | **起票**（M19-01 製造投入可・実装後反映待ち） |

---

## 2. いま保留中の中央タスク（再開後に着手する残作業）

**優先度順**。いずれも「担当からの報告が届いたら中央が動く」リレー駆動。

1. **【最優先・M18-02 三点セット確定】** M18-02 の**実機確認 green ＋ 完了報告＋DES 反映要点**が届いたら、**CHANGE-083/084 を一括で三点セット確定**（改訂 DES-003〔combo_punish_starters・total 注記〕・DES-005〔探す画面ツリー〕＋change-report-083-084＋registry 反映）。**今は保留**（完了報告未着・実機確認前。想定で DES を書かない）。084 の付帯条件（DES-003 §3.3 に「移動 total は算出式の検算対象外」明記／マイグレコメントに値の出所／50 行検算）を反映時に必ず入れる。
2. **【M19-01 三点セット確定】** M19-01 の**製造完了報告＋DES 反映要点**が届いたら、**CHANGE-085 を三点セット確定**（DES-002 §4.2 提案エンドポイント・DES-005 §5.6 提案 UI＋change-report-085＋registry）。マイグレ非消費。
3. **【M18-03 着手時】** M18-03（materialize＋マイリスト＋登録導線）の設計・指示書は**M18 担当へ委任済**（M18 全体委任）。担当から DES 反映要点・番号請求が来たら対応。export 整合（E-17）の DoD＝開発者実出力目視。
4. **【M19-02 着手時】** M19-02（派生技 through target・表記展開）は**中央スキーマ（派生技フレームモデル `move_derivations` 等）の反映待ち**。この設計は**中央帰属**（moves 系）。着手時に followup §H の (f) is_derived/is_aerial 実セマンティクス乖離・(a) air-only 除外の専用フラグ要否・(g) code 命名不整合を**併せて判断**。(e) rush_variant 通し値の起点（生ラッシュ前提か）を M19-02 着手前に確認。■5（派生技 startup の通し値 vs 公式値保全）の確定もここで（暫定＝通し値維持・公式値は別列 or raw_data・例外規定で整合）。
5. **【retrospective-log 受領時】** 工程末尾に retrospective-log 実物が届く。**中央がマージ責任**。台帳 §1 の教訓 **G-1〜G-4**（設計担当ミス）と、採番済 **E-21〜E-28**（M18-01/M19-01 由来。E-28 は playbook §4.18 に収載済）を **retrospective-log へマージ→digest 再蒸留**（マージ→再蒸留の順を厳守）。retrospective-pending-M18.md（G-1）も統合。
6. **【テンプレ zip 再作成】** playbook v2.1.0 §4.18/§4.19 を受け、`design-templates-revision-diff.md` の A/B を zip 内テンプレへ適用し **design-templates.zip を再作成→両担当へ配布**（8 テンプレ構成不変・進行中指示書は次回改訂から適用）。
7. **【errata の反映漏れ確認】** DES-003 errata①（drive_parry）・errata②（KA）・DES-004 errata（jumping_）は**版据置で反映済**。M18-02/M19-01 の三点セット時に、これらが差し替え版に含まれていることを確認（担当の手元版との突合）。

### 2.1 開発者へのボール（中央から依頼済・回答待ち）

- **なし**（CHANGE-084 の 12→10 キャラ値は受領済＝通知書 §3.1 に一次源格納済）。
- c_viper/dhalsim の dash total 追送は「将来 seed 本格化時」で保留（現状対象外で確定）。

---

## 3. 再開手順（この順で実行）

1. **台帳 `M18-M19-central-working-lessons.md` を全読**（内部版 v0.2.6）。付録A の採番台帳・版マニフェスト・払い出しログ・§1 教訓を頭に入れる。
2. **uploads の設計書一式**（requirements.md・01〜06・supp-001・playbook・retrospective-digest・code-facts・docs-map・architecture-patterns 等）を必要時に参照（**版は台帳のマニフェストが正**。uploads は初期配布版で古い列がある）。
3. 開発者から届いたリレー内容を**分類**：(a) 番号請求→実査して払い出し (b) 完了報告＋DES 反映要点→三点セット確定 (c) 設計質問/承認請求→回答/個別承認 (d) 指示書ドラフト→（初回のみ）レビュー。
4. **払い出し/反映のたびに台帳を更新**（内部版を上げ、払い出しログに追記＝二重払い出し防止）。
5. コンテキストが再び逼迫したら、**本資料と台帳を最新化してから**引き継ぐ。

---

## 4. 落とし穴（この工程で実際に踏んだ/回避したもの）

- **リポジトリを直接見られない**。マイグレ連番の disk 末尾確認は**製造側 Plan Mode（`ls migrations/`）に委ねる**。中央は台帳＋完了報告＋code-facts で払い出す。不一致なら製造が自採番せず中央へ再請求。
- **DES-005 の古い版（v2.43.0）が出回った前例**（M16-2）。担当へ配布/受領時は**必ず版を突合**（正は v2.48.0）。
- **str_replace/python でのログ追記時、行頭アンカーだけだと既存行と結合するバグ**が頻発した。**安定マーカー（「M18-RESEARCH 主要事実」等）の前に prepend** するか、full-line アンカーを使う。バッククォート入り文字列を bash 二重引用の python に渡すと**シェルがコマンド置換**して欠落する（`setplay-suggestion` パス消失の実例）→ **python heredoc（'PYEOF'）か str_replace ツール**を使う。
- **playbook 参照と retrospective 参照の混同**（§4.7 誤引用の自己ミス）。playbook の節を引くときは実査してから。E-21〜E-28 は retrospective 側、playbook §4.18/§4.19 が対応する収載先。
- **「先行実装がある」系は所在を実コードで確定するまで設計枠を承認しない**（G-4。M19 で FR011 と誤接続）。別リポ（`autopilot-combomgr/projects/`）も grep 対象。
- **撤回・確定した論点は全箇所へ波及**（playbook §4.18・E-28）。改訂時はキーワード全文走査、是正は肯定形＋否定形。

---

## 5. 主要な確定事項（設計の背骨・忘れると事故る）

- **hit_type 4 値**＝normal/counter/**punish_counter**（ガード確反）/**just_parry_punish_counter**（ジャストパリィ確反）。**別コンボ化で一意化**＝combo_punishes に guard_type を持たない。ラベル「パニッシュカウンター(ジャストパリィ反撃)」。正式 DES/コードは**「ジャストパリィ」と略さない**。
- **G-d は 2 表**：`combo_punish_prunings`（マッチアップ単位・物理的に無理）／`combo_punish_curations`（個別コンボ単位・非採用を隠す）。粒度が違うので分離（spec §8-3）。
- **is_projectile**＝飛び道具の自動走査除外の**唯一の一次源**。**backfill 専用・seedgen 非改変**。未 seed キャラは seed 波ごとに backfill（followup C-1 `M14-03-is-projectile-backfill`／`M14-03-dash-total-backfill` の 2 種併走）。
- **materialize**：ノーマル→始動技×1.2＋punish_counter／カウンター→不変／ジャストパリィ→手入力。出自＝`materialized_from_combo_id`（独立フォーク）。
- **G-b 算出式**：有利＝ガード `-(on_block)`／ジャストパリィ `recovery`、成立⟺始動 startup≤有利。projectile と on_block/recovery NULL は自動走査除外だが**管理画面には表示し手入力可**。ガードタブ 0 件は正常（主戦場は JP タブ）。
- **M19 KA 意味論**（DES-003 §3.4 errata②）：KA＝ダウン中の無敵時間・起き上がりは **KA+1**・`S=Σ(filler.total)+target.startup`・`N=KA+2−S`・成立 `1≤N≤active`。受理帯（窓）方式（等値にしない）。
- **M19 先行実装**＝別リポ `autopilot-combomgr/projects/setplay-suggestion` の Go1.24/stdlib フレーム導出エンジン（**要検証**）を `internal/` へ移植。提案は自動確定しない（FR307）・単一コンボ候補面に相乗り・selectedIds 非入口。**FR011 は無関係**。
- **M18-03・M19 提案面・followup E-1 が同一 UI 面**＝中央経由で調整（E-20 の 1 本動線・E-14 突合）。

---

## 6. 成果物ファイル一覧（/mnt/user-data/outputs）

**台帳・引継ぎ**: `M18-M19-central-working-lessons.md`（v0.2.6・LIVE 正本）／本資料。
**設計書 改訂版**: `03-data-model.md`(1.33.0)／`04-notation-spec.md`(1.15.0)／`05-screen-design.md`(2.48.0)／`06-validation.md`(1.21.0)。
**CHANGE 通知書**: `CHANGE-078`〜`085-notification.md`（079 は 2 表版・084 は v2）。
**change-report**: `change-report-078-082.md`。
**registry**: `change-number-registry.md`(v1.78.0)。
**恒久資料**: `phase3-overview.md`(1.1.3)／`model-allocation.md`(1.39.0)／`design-instruction-playbook.md`(2.1.0)／`followup-backlog.md`（§C 2 件・§H 8 件）／`design-templates-revision-diff.md`。
**M18**: `M18-overview.md`(0.1.1)／`M18-physical-design-plan.md`(0.6.0-plan)／`M18-01-delegation-package.md`(1.3.0)／RESEARCH 3 種（`-seed-coverage-...`／`-addendum-...`／`-addendum2-...`）。
**M19**: `M19-RESEARCH-PoC-startup-kit.md`(1.4.0)。

> 注: `M18-RESEARCH-01-skeleton-DRAFT.md` は骨子の旧稿（正式版は `-seed-coverage-and-gb-projectile-survey.md`）。M18-overview／M19-overview の最新メンテは各担当側にある場合があるので、受領時に版を突合。

---

*以上、中央セッション引継ぎ資料 v1.0.0。再開後はまず台帳 v0.2.6 を全読すること。*
