# M14 → M15 引き継ぎ書（m14-to-m15-handover）

| 項目 | 内容 |
|------|------|
| 文書種別 | マイルストーン引き継ぎ書（設計担当 Claude 作成） |
| 作成日 | 2026-07-01 |
| 前マイルストーン | M14（公式データ配布是正・スキーマ整理・取込画面廃止・配布 DB 同梱）— M14-CHANGE/01/02/03a 完了・M14-03b はローリング保留 |
| 次マイルストーン | M15（入力・使いやすさ向上＝friend FB 第一波。正本 = phase3-overview v1.0.0 §M15） |
| 関連 | phase3-overview **v1.0.0（承認済み）** / change-number-registry（次番号 **056**）/ model-allocation **v1.25.0** / followup-backlog §C-1 / retrospective-digest |
| 実パス規約 | 文書ID ⇄ 実パスの正は `docs/handover/docs-map.md`。指示書では文書ID参照に実パスを併記する（retrospective-digest §0 / M10-3）。 |

> **本書の使い方**: M14（本プロジェクト最重量クラスタ＝破壊的マイグレ＋取込削除の逆依存段階削除＋FR704 降格＋複数 CHANGE）が**コード完了**し、以降を新セッションへ引き継ぐ。設計担当は M14 で相当のコンテキストを消費したため、**M15 以降は新セッションで起票**する。本書 §1〜§3（M14 完了状態・確定判断・継続課題）と §5（M15 骨子）を主要インプットに、新セッションが full fidelity で着手する。**記憶で進めず、参照文書と実コードを必ず引く**（digest 中核原則）。

---

## 1. M14 完了状態

| サブ | 内容 | 状態 |
|------|------|------|
| M14-CHANGE(DES-001) | §2.1/§4.1 旧スタック是正（案C/Go 同期）＋§5 MIT 確定＋§6 決定欄 | **完了・反映**（CHANGE-053） |
| M14-01 | moves スキーマ整理（観測不能6列削除＋`recovery` 追加＋raw_data 退避5キー除去） | **実装/レビュー/E2E 完了・反映**（CHANGE-054） |
| M14-02 | 取込パイプライン段階削除（共有シンボル中立移設→`movesimport` 削除→画面17 除去・FR704 降格） | **実装/レビュー/E2E 完了・反映**（CHANGE-055） |
| M14-03a | 画面18 E2E（`moves-edit.spec.ts`）を ryu 対象・import 非依存で再有効化 | **実装/レビュー完了**（2026-07-01。指示書 v1.0.1・冪等な決め打ち実装） |
| M14-03b | 配布 seed データ投入（変換インフラ＋全 30/31 キャラ実データ seed＋全 recovery 入力） | **ローリング保留・M16 後着手推奨**（指示書 v1.1.0。手入力律速） |

反映済み CHANGE（M14）: **053**（DES-001 v1.3.0→v1.4.0）/ **054**（M14-01 実装反映＝DES-003 v1.22.0→v1.23.0・DES-005 v2.28.0→v2.29.0・DES-002 v1.26.0→v1.27.0）/ **055**（M14-02 実装反映＝REQ-001 v2.15.0→v2.16.0・DES-002 v1.27.0→v1.28.0・DES-005 v2.29.0→v2.30.0）。各 change-report・registry 反映済み。

現行版: REQ-001 **v2.16.0** / DES-001 **v1.4.0** / DES-002 **v1.28.0** / DES-003 **v1.23.0** / DES-004（M14 変更なし・版は docs-map）/ DES-005 **v2.30.0** / DES-006 **v1.14.0**（M14 変更なし＝recovery VAL 非新設）。**次 CHANGE 番号 = 056**（欠番 008/009/014）。

> **重要な状態表記**: M14 は**「コード完了・配布データはローリング投入」**。**配布可能 ≠ コード完了**。配布可能の定義は「クラシック全 30（/31）キャラの moves が新スキーマで seed 済み」＝M14-03b 完了時（followup §C-1・phase3-overview §M14）。

---

## 2. M14 で確定した設計判断（参照用）

- **moves スキーマ（M14-01・DES-003 §3.3）**: 観測不能6列（`properties`/`combo_scaling`/`drive_gauge_increase`/`drive_gauge_decrease_guard`/`drive_gauge_decrease_punish`/`super_art_gauge_increase`）を**削除**。`recovery INTEGER`（手入力・NULL 可）を**追加**（**CHANGE-022 の「recovery 非保持」を反転**）。`total` は stored（`startup+active−1+recovery`・seed 時算出・既存行据置）。`raw_data` は `notes`/`notes_tool` のみ温存（退避5キー除去・空→NULL）。
- **FR704 降格（M14-02・REQ-001 §3.8）**: 公式データ取込を**本体ユーザー機能から削除**（画面17・取込エンドポイント `/api/import/moves`・`/preview`・FE 取込一式）。技編集（FR703・画面18）は**温存**。配布 DB は手入力 seed を **SQL マイグレ経路**で同梱（取込非依存）。CSV 取込は dev/test と別ツール（FR701）責務。**本体ランタイムに取込経路を復活させない**。
- **逆依存の中立移設（M14-02）**: 技編集が取込パッケージの `WarningCode`/`StoredMove`/`DeriveStoredWarnings` を参照していた逆依存を、中立パッケージ **`internal/service/movewarning`** へ移設して解消。`IsKnownProperty` は消費者消失（properties 削除）で削除。live warnings は **`total_null`/`extra_throw`** の 2 種のみ。FE SSOT `web/src/constants/move-warning.ts` は温存（2 種へ縮小）。
- **意味単位 export の頑健性（M13→M14 実証）**: コンボ CSV は code ベース・DB 管理列除外のため、M14 の moves 列削除でも**往復不変**（E2E 確認済み）。
- **配布対象**: クラシック全 30 キャラ（遅延で 31・ロスター非依存の seed インフラ）。モダンはフェーズ3 排除。
- **DES-001（M14-CHANGE）**: 採用スタック＝案C（Go + React・§6）。§2.1/§4.1 の候補比較は歴史温存。本体ライセンス **MIT 確定**。

---

## 3. M15 への申し送り（継続課題）

### 3-a. M14-03b（配布 seed・ローリング保留）★配布 blocker
- **M16 後着手推奨**（M16 が moves スキーマを触る可能性＝再入力 churn 回避）。指示書 `M14-03b-distribution-seed-data.md` v1.1.0（※現ファイル名は `M14-03-distribution-seed.md`。commit 時リネーム推奨）。
- **【必須制約】配布 seed はマイグレ由来のクリーン初期状態から構築する。dev DB スナップショット流用は厳禁**。dev DB は旧取込 E2E 由来の残渣で汚染（幽霊 ken moves 73 件・E2E が書いた偽 `recovery=8`/`total=25`〔ryu standing_light_punch〕・E2E 生成 rush）。流用すると配布物へ漏れる（M14-03a 報告 §1）。
- 全 recovery 入力（ryu＋30 キャラ）を本サブに集約（M14-03a で backfill を移設）。HEAD には ryu 56 技のみ（aki/jamie/guile は 000017 で完全 DELETE 済み）。
- **配布完了の定義**: 全 30（/31）キャラ seed 済み。満たすまで配布ブロック。

### 3-b. NFR406 フェーズ移設 CHANGE（M18 着手前）★REQ-001
- phase3-overview 承認（2026-06-30）で **NFR406（確定反撃）が phase3 入り**（旧フェーズ4→3）。REQ-001 の NFR406 フェーズ表記を整合させる**着手前 CHANGE（056〜）**が M18（確定反撃）着手前に必要。着手時に REQ-001 の該当箇所を view 確認して起票（記憶で確定しない）。

### 3-c. retrospective-log への M14 教訓の追記（未了・要ファイル）★
- M14 期間の教訓は retrospective-log/digest へ**未追記**（本セッションで編集対象として渡されていないため）。**retrospective-log を渡せば所定様式で追記**。M14 クローズ時 or M15 開始時が自然。追記価値のある教訓:
  - **過去決定の反転は明示 CHANGE で**: CHANGE-022「recovery 非保持」を M14-01 で反転（列化）。反転を通知書で明記し矛盾回避。
  - **実装後 CHANGE の改訂 DES 適用は必須（オプションでない）**: CHANGE-054 で DES-003 moves 反映を「要請時適用」とオプション扱いし**適用漏れ**→開発者指摘で発覚。三点セット（通知書＋改訂DES＋change-report）の改訂 DES 適用は必須。以降**全 REQ/DES で改訂ファイル既定適用**に統一（DES-001 と同運用）。
  - **前任（自分）の前提記述も実コードで裏取り**（digest §2 の再現）: M14-03a 指示書が「ryu/aki/jamie/guile 存在」を前提にしたが、000017 で ajg 削除済み＝ryu のみ、を製造 Plan Mode が捕捉。phase3-overview 自身が「000017 削除済み」を記録していたのに指示書で矛盾。**設計担当が引いた前提も実コードで再確認する**。
  - **逆依存の段階削除**: 取込削除は共有シンボルを中立へ移設してから削除（一括物理削除は技編集をコンパイル不能にする）。移設縮小の活用（properties 削除で IsKnownProperty 消費者消失）。
  - **REQ-001 を CHANGE 対象とした初事例**（FR704 降格＝CHANGE-055）。
  - **FE E2E は永続 dev DB に走る**（残渣蓄積・潜在失敗の根本原因）。配布 seed は clean DB から・配布前に clean DB で全 E2E（§3-e）。
  - **意味単位 export の頑健性**が M14 破壊的列変更から保護（M13↔M14 順序リスク解消）を実証。

### 3-d. 配布健全性（OSS 前・M14-h/M14-i）
- **LICENSE/README**（M14-h）: MIT 確定（CHANGE-053・DES-001 §5）。**LICENSE ファイル追加・README「未定」→ MIT 更新は repo アクション（開発者）**。CHANGE 対象外。実施状況を配布前に確認。
- **MPL 非リンク確認**（M14-i）: `github.com/hashicorp/golang-lru/v2`（MPL-2.0）は require 非掲載・直接 import 0。配布判定前に `go mod why` で非リンク確認（開発者）。
- 配布禁止 HTML/CSV は .gitignore・go:embed 対象外（web/dist + migrations のみ）＝配布物に含まれない（M14-RESEARCH-01 §F）。

### 3-e. E2E / テストインフラ課題（M14-03a 報告由来）
- **`combo-csv-io.spec.ts` の ken 依存是正**（配布前必須）: ken の moves 件数 >0 を断定（L64-67）するが ken の moves seed は存在せず、現状 dev DB 残渣で通過＝**クリーン DB では 0 件→失敗**。対処: (a) 対象を ryu へ変更 or (b) ken moves を seed（配布方針次第）。
- **FE E2E 専用の使い捨て DB 整備**（優先 中〜低）: FE E2E は永続 dev DB に走る（`reuseExistingServer`＋`go run`）。Go `dbtest`（一時 DB）と異なりテスト履歴依存。使い捨て DB で残渣依存・恒久副作用を根治。
- **配布前ゲート**: 一度**クリーン DB で全 E2E スイート**を実行し残渣依存テストを洗い出す。

---

## 4. 現行版・採番・環境

- **次 CHANGE 番号 = 056**（欠番 008/009/014）。CHANGE 対象 = REQ-001 + DES-001〜006 のみ。
- **現行版**: REQ-001 v2.16.0 / DES-001 v1.4.0 / DES-002 v1.28.0 / DES-003 v1.23.0 / DES-004（M14 変更なし）/ DES-005 v2.30.0 / DES-006 v1.14.0。
- **model-allocation v1.25.0**: M14 実績記入済み（M14-01/02/03a/03b＝Opus 4.8＋Plan Mode 必須／レビュー Sonnet 4.6）。M15 サブは着手時記入。
- **正本の所在**: ロードマップ＝`phase3-overview.md` v1.0.0（承認済み）/ 採番＝`change-number-registry.md`（次 056）/ モデル＝`model-allocation.md` v1.25.0 / 課題台帳＝`followup-backlog.md` §C-1 / 恒久知見＝`retrospective-digest.md` + `code-facts.md`（自動生成・最新版を引く）。
- **設計書本体の改訂**は設計担当が **CHANGE 通知書 + 改訂 DES + change-report の三点セット**で反映（改訂 DES ファイル適用は**必須**＝§3-c 教訓）。SUPP/playbook/handover/overview/followup/registry/model-allocation は CHANGE 非対象・自由改訂。
- git/commit/push は**開発者専任**。製造担当（Claude Code）は DES/REQ を直接編集しない（伝達メモで申し送り→設計担当が CHANGE 起票）。
- **禁則表現**（「適切に」「必要に応じて」等）の grep 除去は出力前必須。
- **ファイル名リネーム（commit 時）**: `M14-03-distribution-seed.md`→`M14-03b-distribution-seed-data.md`、`M14-03-review-checklist.md`→`M14-03b-review-checklist.md`（内部 ID は M14-03b に更新済み）。

---

## 5. M15 骨子（新セッションが M15-overview で確定）

> 正本は phase3-overview v1.0.0 §M15。新セッションは着手時に **M15-overview**（M13/M14-overview 書式）を作成し、本骨子を具体化する。CHANGE 見込みは 056 から。

- **M15 = 入力・使いやすさ向上（friend FB 第一波）**: friend FB のうち**データモデル変更を伴わない**使いやすさ・表記・説明・タグ色・オンボーディングを集約。**M14 と並行可**（早期に体感品質を上げる・発信者の入力摩擦低減）。
- **項目数が多く内部分割見込み**（着手時に連番繰り下げを開発者確定）。
- **依存**: 始動表記・技/非技ラベルは **M16 確定後**（M16 データモデル拡充が taxonomy を触るため、それらに触れる FB 項目は M16 後）。M15 では M16 非依存の項目を先行。
- **CHANGE 見込み**: DES-004/005 小・多くは自由改訂（FB の性質上、DES 規定に触れないものが多い）。
- **主参照**: `combmgr-friend-feedback-datamodel-issues.md`（FB 論点）/ phase3-overview §5 進め方 / followup-backlog。

> **M16 以降の位置づけ（参考）**: M16（データモデル拡充・要ドメイン確認）→ M17（流通基盤＝export/import 強化③＋取込ヘルパー④〔前提＝M14-03b の全 30 キャラ seed〕＋メディア参照⑤）→ M18（確定反撃 NFR406〔§3-b の REQ CHANGE 前置〕）→ M19（セットプレイ提案）→ M20〜（プリセット/物理コントローラ/協調基盤/仕上げ）。詳細は phase3-overview §各節。

---

## 6. 運用メモ（recap）

- **記憶で進めない**: code-facts/実コード・参照文書を必ず引く。指示書着手前に code-facts 最新生成版で実コード実査。
- **破壊的マイグレ規律**（digest §5・M12-5）: FK=OFF と明示 DELETE を同一指示書に同居させない。`dbtest.Setup` 波及。down 整合。既存マイグレ非改変（新規連番で追加）。
- **Plan Mode**: 実装系（Opus 4.8）は Plan Mode 必須。着手前確認結果を指示書 §3.4 の項目でゲート。製造の Plan Mode 質問は「不備の発見」として歓迎（M14-03a の ajg 前提誤り・M14-02 の死蔵ラベル/repository メソッドはこの経路で捕捉・是正）。
- **CHANGE 集約・二型**: 同一サブの複数 DES 明確化は 1 CHANGE に集約（digest M13-4）。DES 反映は着手前正典化（契約先行）と実装後反映の二型。
- **開発者への質問は成果物末尾に集約**。1 応答 1 問を上限に。

---

## 7. M15 着手時の最初の一手（新セッション向けチェックリスト）

1. 本書 §1〜§3（M14 完了状態・確定判断・継続課題）＋ `phase3-overview.md` v1.0.0 §M15/§5 を実査（記憶で進めない）。
2. `combmgr-friend-feedback-datamodel-issues.md`（FB 論点）を実査し、**M16 非依存で M15 に入る FB 項目**を切り分ける（始動表記・技/非技ラベルは M16 後）。
3. **M15-overview** を作成（サブ分割・全 FB 項目の処遇・CHANGE 見込み確定）。項目多数のため内部分割の連番方針を開発者確定。
4. （任意・M14 クローズ）**retrospective-log を請求し M14 教訓（§3-c）を追記**。配布健全性（§3-d）・E2E 課題（§3-e）の状況確認。
5. M15 サブの指示書起票（model-allocation でモデル配分・多くは自由改訂系のため Sonnet 中心の見込み・破壊的やドメイン判断を含むものは Opus + Plan Mode）。

---

*以上、M14 → M15 引き継ぎ書。配置 `docs/handover/phase3/m14-to-m15-handover.md`。M15 は本書 §1〜§3/§5 を主要インプットとして、新セッションで full fidelity で着手する。M14-03b（配布 seed・ローリング）・NFR406 CHANGE（M18 前）・retrospective-log 追記・配布健全性は M14 のクローズ／後続の残タスクとして本書に集約した。*
