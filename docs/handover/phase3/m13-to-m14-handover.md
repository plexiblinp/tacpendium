# M13 → M14 引き継ぎ書(m13-to-m14-handover)

| 項目 | 内容 |
|------|------|
| 文書種別 | マイルストーン引き継ぎ書(設計担当 Claude 作成) |
| 作成日 | 2026-06-28 |
| 前マイルストーン | M13(データ共有・データ保護 = コンボ export/import)— M13-01 完了 / M13-02 着手前 |
| 次マイルストーン | M14(公式データ配布是正・スキーマ整理・取込画面廃止・配布 DB 同梱。正本 = phase3-overview §M14 + 本書 §4) |
| 関連 | M13-overview v1.0.0 / M14-RESEARCH-01-report / model-allocation v1.23.0 / change-number-registry(次番号 **052**) |
| 実パス規約 | 文書ID ⇄ 実パスの正は `docs/handover/docs-map.md`。指示書では文書ID参照に実パスを併記する(retrospective-digest §0 / M10-3)。 |

> **本書の使い方(重要)**: M14 は本プロジェクトで最重量クラスタ(破壊的マイグレ + 取込削除の共有シンボル移設 + 全キャラ seed + 複数 CHANGE)。コンテキスト健全性のため **M14 は新セッションで起票する**ことを設計担当が推奨。本書 §4(M14-RESEARCH-01 評価)・§5(M14 サブ構成骨子)を主要インプットとして、新セッションが full fidelity で着手する。

---

## 1. M13 完了状態

| サブ | 内容 | 状態 |
|------|------|------|
| M13-RESEARCH-01 | 先行 export/import 成果物の統合可否(read-only) | 完了(report 受領) |
| M13-RESEARCH-02 | 破壊的 FS 操作監査 + 依存ライセンススイープ(read-only) | 完了(report 受領・FS クリーン・依存全数寛容) |
| M13-01 | コンボ CSV export/import(FR401/405・案A) | **実装・レビュー完了**。CHANGE-050/051 反映済 |
| M13-02 | コンボ PDF/PNG/クリップボード export(FR402/403/404・正道) | **起票済み・着手前**(指示書 v1.0.0 / チェックリスト v1.0.0) |

反映済み CHANGE(M13): **050**(コンボ CSV 契約の正典化 = DES-002 §7.6 新設・DES-006 VAL-I10 新設)/ **051**(M13-01 実装反映 = DES-005 §5.14 行選択粒度・重複動作段階導入・DES-002 §7.6 setup 4 列・ZIP 配送)。各 change-report・registry 反映済み。

現行版: DES-002 **v1.26.0** / DES-005 **v2.27.0** / DES-006 **v1.14.0** / DES-003 v1.22.0(M13 変更なし)/ DES-001 v1.3.0(M13 変更なし)。**次 CHANGE 番号 = 052**(欠番 008/009/014)。

> **M13-02 の扱い**: 本書作成時点で M13-02 は着手前。M13-02 完了報告(伝達メモ)処理 → 出力契約の DES-005 §5.13 明確化 CHANGE(要否判断)は **M13 のクローズ作業**として現セッション or 別途で処理し、M14 着手とは独立。M14 は M13-02 の完了を待たずに着手可(別系統)。

---

## 2. M13 で確定した設計判断(参照用)

- **意味単位 export**: コンボ CSV は code ベース・DB 管理列除外で出力(物理列直書きしない)。**M14 の moves 列変更に対し export が頑健**(M13↔M14 順序依存リスクなし)。
- **旧形是正**: drive_damage REAL(*float64)・起き攻め nullable(*bool)・starter_move_id は import 再導出(VAL-C02/C03 整合)。
- **重複動作**: skip(既定)+新規追加の 2 択。上書きは段階導入(DES-005 §5.14 で端状態 3 択維持)。
- **VAL-I10(式注入無害化)**: 自由文セル限定(数値・JSON は往復同一性のため非適用)。
- **FS 安全**: in-memory 生成でサーバ FS 書込ゼロ。破壊的 FS 操作は全て管轄内(M13-RESEARCH-02)。

---

## 3. M14 への申し送り(継続課題)

### 3-a. DES-001 §2.1/§4.1 の旧スタック是正 ★M14 で CHANGE 起票
- **重要な訂正**: M13-RESEARCH-01 §F-1 は旧スタック残置を「DES-001 §5」と記したが、**M13-RESEARCH-02 B-3 が実ファイルで訂正** = 旧スタック(Tauri/Rust/SQLx)は **§5 ではなく §2.1(案A:Rust+React 推奨案)/§4.1(総合推奨:案A)** の技術スタック表に残置。**§5 は MIT 方針で現行(案C/Go)と整合・§6 は案C 採用を記録済み**。
- **是正内容**: §2.1/§4.1 の「推奨=案A(Tauri/Rust/SQLx)」表を **§6 の案C(Go + React)採用決定へ同期**する CHANGE。本体ライセンス **MIT 確定**(2026-06-28)も §5 で確認(§5 は推奨→確定の文言調整のみで可)。OSS 健全化の文脈で M14 にまとめる。

### 3-b. 配布健全化(M14-03 関連・ほぼ完了済み)
- 配布禁止 HTML/CSV は全て .gitignore 済み・go:embed 対象外(web/dist + migrations のみ)。**配布物に配布禁止データは現時点で含まれない**(M14-RESEARCH-01 §F)。M14 の除外作業は実質ゼロ。
- **LICENSE 整備**(OSS 前・F13-4): MIT 確定だが LICENSE ファイル未配置・README「未定」。M14 で LICENSE(MIT)追加 + README 更新。
- **MPL 確認**(F13-3): `hashicorp/golang-lru/v2`(MPL-2.0)は require 非掲載・直接 import 0。配布判定前に `go mod why` で非リンク確認。

### 3-c. retrospective-log への M13 教訓の追記(未了・要ファイル)
- M13 期間中、retrospective-log/digest への追記は**未実施**(本セッションで編集対象として渡されていないため)。追記価値のある教訓:
  - **前任の前提記述を疑う**(retrospective-digest §2 の再現): M13-RESEARCH-01 が「DES-001 §5 旧スタック」「本体 MIT(§5 で確定)」と記したが、いずれも不正確 → M13-RESEARCH-02 が実ファイルで訂正(§5 は MIT 方針のみ・旧スタックは §2.1/§4.1・MIT は推奨で README 未定)。**設計担当が引いた前提も後続調査で裏取りされ得る**。
  - **CHANGE 集約パターン**: 製造が起票した CHANGE-051(重複動作)に、同一サブの DES 明確化(行選択・配送・setup 列)を**設計担当が集約**して 1 件で反映(番号節約・関心一貫)。
  - **DES 反映タイミングの二型**: CHANGE-050(着手前=契約を先に正典化し製造が実装)vs CHANGE-051(実装後=具体化を反映)。M13-01 で両方を使用。
  - **レビューチェックリスト commit ギャップ**: 設計担当が作成・提示したチェックリストがリポジトリ未配置で、製造が「不在」と認識(伝達メモ F)。**作成 ≠ commit**。成果物提示後の commit 状態を設計担当が前提にしない。
  - **意味単位 export の設計**: スキーマ非依存(code ベース)export が M14 の破壊的列変更から保護する(M13↔M14 の順序リスク解消)。
- **対応**: retrospective-log(または digest)を渡せば所定様式で追記。M13 クローズ時 or M14 セッション開始時に処理が自然。

### 3-d. M13-02 完了処理(M13 クローズ・M14 と独立)
- M13-02 完了報告(伝達メモ)を受けて、出力契約(クリップボード HTML 形式・比較表/詳細切替・表示項目)の DES-005 §5.13 明確化 CHANGE 要否を判断(M13-01 の CHANGE-051 と同型)。M14 着手とは独立に処理可。

---

## 4. M14-RESEARCH-01 report の評価(設計担当による・M14 起票の主要インプット)

> M14-RESEARCH-01(配布是正・スキーマ整理・取込画面廃止の read-only 調査)は完了済み(report 受領)。以下は設計担当の評価サマリ。詳細は `docs/progress/M14-RESEARCH-01-report.md` を実査すること(新セッションは記憶でなく report 本体を引く)。

### 4-1. 削除安全性の核心(B 群)= M14 最大の論点
- 取込(`movesimport`)と技編集(`move`)は**ディレクトリ/ドメイン分離済み**だが、**コード境界は相互依存**。とくに**逆向き依存**: 技編集(温存)が `service/movesimport` の **`IsKnownProperty`/`WarningCode`/`StoredMove`/`DeriveStoredWarnings`** を参照。**`service/movesimport` をパッケージごと削除すると技編集がコンパイル不能**。
- ⇒ **段階削除が必須**: 共有 3〜4 シンボルを中立/技編集側へ**移設してから**取込を削除。フロントは `web/src/constants/move-warning.ts`(共有 SSOT)を温存すれば `features/import/` + ImportMovesPage + router + Header 導線の除去で完結。

### 4-2. スキーマ(A 群)
- moves = **20 列・取込専用列はゼロ**。削除候補は `raw_data` の 5 サブキー(command/condition_ja/condition_en/properties_extra/import_notes)のみで、**列削除でなく JSON UPDATE**で済む。staging テーブルなし。
- ⇒ M14 の列削除は**極小**(大半の列は手入力・技編集・表示で必要 = 温存)。

### 4-3. 配布 seed ギャップ(E 群)= 工数の長極
- live = characters 5 体・moves は **ryu のみ(56 行)**。aki/jamie/guile は 000017 で完全 DELETE、classic5 の ken/ingrid/c_viper/dhalsim の moves は取込由来(seed に無い)。
- 配布対象 = **SF6 全キャラ(~26 体)**(開発者確定)に対し**大半未投入**。全キャラの characters/moves/custom_states/official_ja_move を**手入力 seed で投入**する必要。手入力ミス防止に**公式 HTML 突合をツールで実施**(HTML は配布せず検証専用)。モダン版は phase3 にモダン対応を含む場合のみ(現 overview ではフェーズ4)。
- ⇒ **開発者の手入力作業が長極**。Claude Code 側は seed 投入インフラ(CSV→seed 変換 or 手書き seed・seed マイグレ構造)を**手入力進捗と非同期に**先行設計できる。

### 4-4. ツール照合(G 群)
- `moves-input-tool` の 22 列 CSV は SPEC(`SPEC-fr704-intake.md`)/コードで一致 = **「旧式」懸念は型/列乖離としては顕在化せず**(moves 列は INTEGER のまま・REAL 化は combos 限定)。突合の入力は HTML でなく既タブ化 CSV(HTML→CSV は `combomgr-importer`)。

### 4-5. マイグレ(D 群)
- 次マイグレ連番 = **000018**。`raw_data` サブキー削除は列削除でなく JSON UPDATE。破壊的列削除が入る場合は 000016 非破壊技法(FK=OFF + 一時名)・`dbtest.Setup` 波及・**FK=OFF と明示 DELETE を同一指示書に同居させない**(retrospective-digest §5 / M12-5)を厳守。

### 4-6. 前提事実の訂正(M14-RESEARCH-01 指示書 §3.2 の誤りを report が是正)
- `dalsim`→正は **`dhalsim`**。aki/jamie/guile は「整理」でなく **000017 で完全 DELETE**。raw_data は notes/notes_tool のみパース(削除候補は 5 キー)。取込 repository は**共有**(逆依存が核心)。→ M14 起票時はこの訂正済み事実を使う。

---

## 5. M14 サブ構成の骨子(新セッションが M14-overview で確定)

> 正本は phase3-overview §M14。新セッションは着手時に **M14-overview**(M12/M13-overview 書式)を作成し、本骨子を具体化する。CHANGE 見込みは 052 から。

| サブ(想定) | 内容 | 主参照 | モデル(見込み) | CHANGE 見込み |
|------|------|------|------|------|
| **M14-01** | スキーマ整理(raw_data 取込専用 5 サブキーの JSON 整理。列削除は極小) | DES-003 §3.3 / code-facts §8/§10 | Opus 4.8 + Plan Mode | DES-003(raw_data キー)で候補 |
| **M14-02** | 取込パイプライン段階削除(共有シンボル移設 → movesimport 削除・画面17 除去・技編集温存) | M14-RESEARCH-01 §B / code-facts §4/§3 | **Opus 4.8 + Plan Mode 必須** | REQ-001 FR704 降格・DES-002 §4.2/§7.5・DES-005 §5.17 で複数 |
| **M14-03** | 配布 DB 同梱(全 SF6 キャラの手入力 seed 投入インフラ + seed) | M14-RESEARCH-01 §E / 手入力ツール CSV | Opus 4.8 + Plan Mode | seed マイグレ(000018〜)・破壊的なら非破壊技法 |
| **M14-CHANGE(DES-001)** | §2.1/§4.1 を案C/Go へ同期 + §5 ライセンス確定(MIT)+ LICENSE 追加/README 更新 | DES-001 §2.1/§4.1/§5/§6 | (設計担当 CHANGE) | DES-001 |

> **進行順序の見込み**: M14-RESEARCH-01 評価(本書 §4)→ M14-01/02 は段階削除の安全性確認(共有シンボル移設)を最優先 → M14-03 の seed は開発者の手入力進捗に依存(インフラ先行設計可)。破壊的マイグレ・取込削除は full fidelity が要るため、各指示書着手前に code-facts/実コードを実査(記憶で進めない)。
>
> **overview 必須**: M14 でも **M14-overview を成果物として作成**する(M12-overview/M13-overview と同様。サブ分割・全 FR/論点処遇・CHANGE 見込みの正本)。

---

## 6. 環境・運用メモ

- **次 CHANGE 番号 = 052**(欠番 008/009/014)。
- **model-allocation v1.23.0**: M13 実績記入済み。M14 サブは着手時記入(実装系 Opus + Plan Mode 必須の見込み)。
- **実パス規約**: 指示書の文書ID参照(DES-002 等)には docs-map 準拠の実パスを併記する(製造担当 Claude Code が解決できるように)。M13 の全指示書で適用済み。
- 設計書本体(REQ-001/DES-001〜006)の改訂は設計担当が **CHANGE 通知書 + 改訂 DES + change-report の三点セット**で反映。SUPP/playbook/handover/overview/followup-backlog/registry/model-allocation は CHANGE 非対象・自由改訂。
- git/commit/push は開発者専任。製造担当は DES を直接編集しない(CLAUDE.md §8)。
- **M13 の未 commit 物**: M13-01 レビューチェックリスト v1.0.1(伝達メモ F の commit 漏れ)。M14 着手前に commit 確認。
- 禁則表現(「適切に」「必要に応じて」等)の grep 除去は出力前の必須チェック。

---

## 7. M14 着手時の最初の一手(新セッション向けチェックリスト)

1. 本書 §4(M14-RESEARCH-01 評価)+ `docs/progress/M14-RESEARCH-01-report.md` 本体を実査(記憶で進めない)。
2. code-facts 最新生成版で §B(共有シンボル `IsKnownProperty`/`WarningCode`/`StoredMove`/`DeriveStoredWarnings` の参照経路)を実コードで再確認(削除安全性の核心)。
3. **M14-overview** を作成(サブ分割・処遇・CHANGE 見込み確定)。
4. retrospective-log を請求し M13 教訓(§3-c)を記録。
5. M14-01/02/03 + DES-001 CHANGE の起票(段階削除の安全性 = 共有シンボル移設を最優先)。各実装は Opus + Plan Mode 必須。

---

*以上、M13 → M14 引き継ぎ書。配置 `docs/handover/phase3/m13-to-m14-handover.md`。M14 は本書 §4(RESEARCH 評価)/§5(サブ構成骨子)を主要インプットとして、新セッションで full fidelity で着手する。*
