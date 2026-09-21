# docs-map.md(自動生成 — **手編集禁止**)

生成: 2026-09-20 / commit `32b17de` / `scripts/generate-docs-map.sh`

本資料は設計担当(Web 版 Claude、リポジトリのファイル構成を直接見られない)向けの
**文書ID ⇄ 実パス対応** と **docs 配下の役割マップ** です。指示書で `DES-002` のように
**文書ID で参照** した資料の実パスをここで確認できます(実装担当 Claude Code の無駄な探索や
「読まずに着手」を防ぐ目的)。

## 本資料の限界

- **静的 grep/awk 抽出** のため、以下は取りこぼし・不正確になりうる:
  - 文書ID/バージョンは各文書 **冒頭メタデータ表**(`| 文書ID |` / `| バージョン |`)の
    最初の行から取る。表が無い文書は §1 に出ない(§2 では出る)
  - 各ファイルの「役割」は **先頭 `# ` 見出し(タイトル)** を採用する。手書きの概要説明は
    持たない(決定論にならないため)。タイトルが説明的でないファイルは役割が読み取りにくい
  - §2 は **フォルダごとに粒度が異なる**(design / handover はファイル単位、その他はフォルダ役割)。
    粒度方針とフォルダ役割文は本スクリプト内の config。フォルダ構成が変わったらスクリプトを更新する
  - `archive/` `phase{N}/`(phase1 / phase2 / …)等のバックアップは件数のみで中身は列挙しない
  - **`docs/instructions/templates/` 配下は §1 の対象外**(プレースホルダ ID のため逆引きが
    成立しない)。**テンプレートは実パスで開くものである。§2 のフォルダ役割マップには残る**
- 最終的な正は常にリポジトリの実ファイル。疑わしい場合は本資料ではなく実パスを確認すること。

---

## 1. 文書ID → 実パス 逆引き表

> Web 版設計担当が指示書で `DES-002` 等の **文書ID で参照** したものを実パスへ解決する表。
> ID は各文書のメタデータ表(`| 文書ID |`)から抽出。タイトルは先頭見出し、Ver は `| バージョン |`。

| 文書ID | バージョン | タイトル | 実パス |
|---|---|---|---|
| `**CHANGE-REPORT-093**` | — | change-report-093: 「単独では出せない」の判定述語の拡張 | `docs/change-notes/change-report-093.md` |
| `**M19-05**` | **1.1.1** | 指示書 M19-05: 消費側 — 費用規則の実装と filler 規則の変更 | `docs/instructions/M19-05-consumption-side.md` |
| `**M19-05-REVIEW**` | **1.1.1** | M19-05 レビューチェックリスト | `docs/instructions/reviews/M19-05-review-checklist.md` |
| `**M19-CLOSE-SESSION-HANDOVER**` | **1.1.0** | 起動プロンプト: M19 クローズ期 設計セッション（親チャット） | `docs/handover/phase3/m19-close-session-handover.md` |
| `**M19-DESIGN-08**（暫定。採番は M19-overview §3 の慣行に従う）` | **1.3.0** | 設計判断: 除外述語の決着（保留 P-16 / P-18 / TP-01）— M19-05 の前提 | `docs/handover/M19-DESIGN-08-exclusion-predicates.md` |
| `**M19-DESIGN-09**` | **1.0.0** | 設計判断: ゲーム側アップデートへの追従 — 割り込み判断と設計判断 4 点 | `docs/handover/M19-DESIGN-09-game-update-followup.md` |
| `**M19-PHASE2**` | **1.0.0** | M19 Phase 2 実装指示書 — フレーム費用 3 列の人手値投入とデータ是正 | `docs/instructions/M19-PHASE2-frame-cost-manual-input.md` |
| `**M19-PHASE2-REVIEW**` | **1.0.0** | M19 Phase 2 レビューチェックリスト | `docs/instructions/reviews/M19-PHASE2-review-checklist.md` |
| `20260902-M14-03f-manual-input-list` | — | M14-03f 第四波 seed — 開発者への記入依頼（第二段の投入材料） | `docs/progress/20260902-M14-03f-manual-input-list.md` |
| `ARCHITECTURE-PATTERNS` | — | 確立アーキテクチャパターン(architecture-patterns) | `docs/handover/architecture-patterns.md` |
| `CHANGE-172` | **1.0.0** | CHANGE-172 設計変更通知書: タグの API 契約を as-built で明文化する（`M35-01`） | `docs/change-notes/CHANGE-172-notification.md` |
| `CHANGE-173` | **1.0.0** | CHANGE-173 設計変更通知書: `internal/desktop/` の新設と Windows 側のビルド検査（`M34-01`） | `docs/change-notes/CHANGE-173-notification.md` |
| `CHANGE-174` | **1.0.0** | CHANGE-174 設計変更通知書: コンボ一覧の列の並びと行内リンクの位置（`M31-03`） | `docs/change-notes/CHANGE-174-notification.md` |
| `CHANGE-175` | **1.0.0** | CHANGE-175 設計変更通知書: 必殺技ファミリー UI が 3 軸になった（`M30-02`） | `docs/change-notes/CHANGE-175-notification.md` |
| `CHANGE-NUMBER-REGISTRY` | — | CHANGE 番号運用レジストリ(change-number-registry) | `docs/handover/change-number-registry.md` |
| `CI-BASELINE-20260810` | — | CI ベースライン計測（工程改善 第一波 P2 ／ harness 計画 Track A Step A0） | `docs/progress/20260810-ci-baseline-measurement.md` |
| `CLEANUP-REPORT-20260607` | — | ドキュメント整理レポート(/cleanup_docs)— 2026-06-07 | `docs/progress/cleanup-report-20260607.md` |
| `CLEANUP-REPORT-20260627` | — | ドキュメント整理レポート(/cleanup_docs)— 2026-06-27 | `docs/progress/cleanup-report-20260627.md` |
| `CONTEXT-LOAD-AB-EXPANSION-20260811` | — | context 読込変更の A/B 拡大（M19-05）結果報告 | `docs/progress/20260811-context-load-ab-expansion.md` |
| `CONTEXT-LOAD-AB-PILOT-20260811` | — | context 読込変更の A/B パイロット 結果報告（工程改善 第二波） | `docs/progress/20260811-context-load-ab-pilot.md` |
| `DENY-RULES-INVENTORY` | — | deny ルール 仕分け表（ヘルメット判定の土台） | `docs/process/deny-rules-inventory.md` |
| `DEPENDENCY-PIN-OPS` | **1.3.0** | dependency-pin-ops — 依存の版固定と、その解除の手順 | `docs/process/dependency-pin-ops.md` |
| `DES-001` | **1.9.0** | 技術スタック選定書 | `docs/design/01-tech-stack.md` |
| `DES-002` | **1.100.0** | アーキテクチャ設計書 | `docs/design/02-architecture.md` |
| `DES-003` | **1.82.0** | データモデル設計書 | `docs/design/03-data-model.md` |
| `DES-004` | **1.35.0** | 内部表現仕様書 | `docs/design/04-notation-spec.md` |
| `DES-005` | **2.125.0** | 画面設計書 | `docs/design/05-screen-design.md` |
| `DES-006` | **1.50.0** | バリデーション設計書 | `docs/design/06-validation.md` |
| `DESIGN-DESK-SURFACE-STUDY-20260811` | — | 設計卓の面（Web / Code）— 決定材料レポート | `docs/progress/20260811-design-desk-surface-study.md` |
| `DESIGN-INSTRUCTION-PLAYBOOK` | **2.53.0** | 詳細設計・指示書作成 Playbook | `docs/handover/design-instruction-playbook.md` |
| `DISK-GROWTH-BASELINE` | — | ディスク増大のベースライン計測（environment-reliability §3） | `docs/process/disk-growth-baseline.md` |
| `FOLLOWUP-BACKLOG（フェーズ3・phase2 版から継承）` | — | 後続課題バックログ（followup-backlog・フェーズ3・マイルストーン横断の生きた計画資料） | `docs/handover/followup-backlog.md` |
| `FOLLOWUP-BACKLOG（旧 M9-03-FOLLOWUP-BACKLOG から改称）` | — | 後続課題バックログ（followup-backlog・マイルストーン横断の生きた計画資料） | `docs/handover/phase2/followup-backlog.md` |
| `HANDOVER-001` | — | SF6コンボ管理アプリ 要件定義〜基本設計 引継ぎ資料 | `docs/handover/phase1/handover_1.md` |
| `HANDOVER-M1-06` | — | M1-06 引継ぎ書(WSL → devContainer 移行) | `docs/handover/phase1/m1-06-handover.md` |
| `IMPROVE-01` | 1.2.0 | 指示書 IMPROVE-01: クリーンなクローンで検査とテストが回る状態を作る（改善レーン） | `docs/instructions/IMPROVE-01-clean-clone-toolchain.md` |
| `IMPROVE-02-COMPLETION-REPORT` | **1.2.0** | 改善レーン 第 2 束 完了報告（フェーズ3 → フェーズ4 の境界） | `docs/progress/improve-02-completion-report.md` |
| `IMPROVEMENT-LANE-HANDOVER-20260810` | — | 工程改善レーン 引き継ぎ書（2026-08-10 停止時点） | `docs/progress/20260810-improvement-lane-handover.md` |
| `IMPROVEMENT-LANE-HANDOVER-20260811` | — | 工程改善レーン 引き継ぎ書（2026-08-11 停止時点・第二波） | `docs/progress/20260811-improvement-lane-handover.md` |
| `INSTRUCTION-GOAL-AUDIT-20260811` | — | 指示書のゴール指向監査（監査タスク B） | `docs/progress/20260811-instruction-goal-orientation-audit.md` |
| `M1-01-REVIEW` | 1.0.0 | M1-01 レビューチェックリスト | `docs/instructions/phase1/reviews/M1-01-review-checklist.md` |
| `M1-02-REVIEW` | 1.0.0 | M1-02 レビューチェックリスト | `docs/instructions/phase1/reviews/M1-02-review-checklist.md` |
| `M1-03-REVIEW` | 1.0.0 | M1-03 レビューチェックリスト | `docs/instructions/phase1/reviews/M1-03-review-checklist.md` |
| `M1-04-REVIEW` | 1.0.0 | M1-04 レビューチェックリスト | `docs/instructions/phase1/reviews/M1-04-review-checklist.md` |
| `M1-05-REVIEW` | 1.0.0 | M1-05 レビューチェックリスト | `docs/instructions/phase1/reviews/M1-05-review-checklist.md` |
| `M1-06-REVIEW` | 1.0.0 | M1-06 レビューチェックリスト | `docs/instructions/phase1/reviews/M1-06-review-checklist.md` |
| `M1-07-REVIEW` | 1.0.0 | M1-07 レビューチェックリスト | `docs/instructions/phase1/reviews/M1-07-review-checklist.md` |
| `M1-OVERVIEW` | 1.0.0 | M1 サブマイルストーン マップ | `docs/instructions/phase1/M1-overview.md` |
| `M1-TO-M2-HANDOVER` | 1.0.0 | M1 → M2 引き継ぎメモ(次セッション用) | `docs/handover/phase1/handover_2_m1-to-m2.md` |
| `M10-OVERVIEW` | 1.0.1 | M10 マイルストーン全体像(M10-overview): 複数キャラ登録 UI | `docs/instructions/phase2/M10-overview.md` |
| `M10-TO-M11-HANDOVER` | 1.0.0 | M10 → M11 引き継ぎ（設計担当チャット継続用） | `docs/handover/phase2/m10-to-m11-handover.md` |
| `M11-OVERVIEW` | 1.1.0 | M11 マイルストーン全体像(M11-overview): custom_states 開始時状態の機能化 | `docs/instructions/phase2/M11-overview.md` |
| `M12-05` | 1.0.0 | 指示書 M12-05: 検証データ / seed 整理 + B-7 move_code 旧形→新形統一(案B) | `docs/instructions/phase2/M12-05-seed-cleanup-and-movecode-unification.md` |
| `M12-06` | 1.0.0 | 指示書 M12-06: フェーズ2 統合 E2E(E-1 回帰穴)+ 先行リリース配布判定 | `docs/instructions/phase2/M12-06-integration-e2e-and-release-decision.md` |
| `M12-DESIGN-SESSION-HANDOVER` | 1.0.0 | M12 期間 設計セッション継承資料(m12-design-session-handover) | `docs/handover/phase2/m12-design-session-handover.md` |
| `M12-RESEARCH-02` | 1.0.0 | 指示書 M12-RESEARCH-02: M12-05(seed 整理 + B-7 move_code 統一・案B)着手前調査 | `docs/instructions/phase2/M12-RESEARCH-02-seed-cleanup-movecode-survey.md` |
| `M12-RESEARCH-02-report` | — | M12-RESEARCH-02 調査報告: M12-05(seed 整理 + B-7 move_code 統一・案B)着手前調査 | `docs/progress/phase2/M12-RESEARCH-02-report.md` |
| `M13-RESEARCH-01` | 1.1.0 | 指示書 M13-RESEARCH-01: 先行 export/import 成果物の統合可否調査 | `docs/instructions/phase3/M13-RESEARCH-01-export-import-artifact-survey.md` |
| `M13-RESEARCH-01-report` | — | M13-RESEARCH-01 調査報告: 先行 export/import 成果物の統合可否 | `docs/progress/phase3/M13-RESEARCH-01-report.md` |
| `M14-03B-M17-DESIGN-SESSION-HANDOVER` | 1.1.0 | M14-03b / M17 期 設計セッション継承資料（m14-03b-m17-design-session-handover） | `docs/handover/phase3/m14-03b-m17-design-session-handover.md` |
| `M14-03f` | **1.1.0** | 指示書 M14-03f: 第四波 seed（残り 14 キャラ） | `docs/instructions/M14-03f-fourth-wave-seed.md` |
| `M14-03f-review-checklist` | **1.1.0** | M14-03f レビューチェックリスト: 第四波 seed（残り 14 キャラ） | `docs/instructions/reviews/M14-03f-review-checklist.md` |
| `M14-RESEARCH-01` | 1.1.0 | 指示書 M14-RESEARCH-01: 公式データ配布是正・スキーマ整理・取込画面廃止の着手前調査 | `docs/instructions/M14-RESEARCH-01-distribution-fix-schema-cleanup-survey.md` |
| `M14-RESEARCH-02` | 1.0.1 | 指示書 M14-RESEARCH-02: 配布 seed 第一波キャラ選定のための特性調査 | `docs/instructions/M14-RESEARCH-02-first-wave-roster.md` |
| `M14-RESEARCH-03` | **1.0.1** | 指示書 M14-RESEARCH-03: seed 波 1 回あたりの工程の全数（第四波の着手前調査） | `docs/instructions/M14-RESEARCH-03-seed-wave-work-inventory.md` |
| `M15-DESIGN-SESSION-HANDOVER` | 1.0.0 | M15 期間 設計セッション継承資料（m15-design-session-handover） | `docs/handover/phase3/m15-design-session-handover.md` |
| `M16-DESIGN-SESSION-HANDOVER` | 1.5.0 | M16 期間 設計セッション継承資料（m16-design-session-handover） | `docs/handover/phase3/m16-design-session-handover.md` |
| `M16-RESEARCH-01` | 1.0.0 | 指示書 M16-RESEARCH-01: ④ 移動 move 化・④'' dash 一本化・レシピ同一性/FR301 dup の着手前調査 | `docs/instructions/phase3/M16-RESEARCH-01-taxonomy-dash-dup-survey.md` |
| `M18-01` | **v0.2.3** | 指示書 M18-01: 確定反撃スキーマ基盤（combo_punishes／距離除外 2 表／materialize 出自／is_projectile／hit_type 拡張） | `docs/instructions/phase3/M18-01-schema-foundation.md` |
| `M18-01-REPORT` | — | M18-01 完了報告（確定反撃スキーマ基盤） | `docs/progress/phase3/M18-01-report.md` |
| `M18-01-REVIEW` | **v0.2.3** | M18-01 レビューチェックリスト | `docs/instructions/phase3/reviews/M18-01-review-checklist.md` |
| `M18-02` | **v1.0.1** | 指示書 M18-02: 確定反撃サーチ（探す画面・走査サービス・3 階層ツリー） | `docs/instructions/phase3/M18-02-punish-search.md` |
| `M18-02-DESIGN（骨子・実装指示書の前段）` | **v0.7.0** | M18-02 設計方針書（骨子）: 確定反撃の探索画面 | `docs/instructions/phase3/M18-02-design-outline.md` |
| `M18-02-RESEARCH-01` | v1.1.0 | M18-02-RESEARCH-01 調査指示書: 移動 system move（前ダッシュ・ジャンプ）のフレーム保持実態 | `docs/instructions/phase3/M18-02-RESEARCH-01-dash-frames.md` |
| `M18-02-REVIEW` | **v1.0.1** | M18-02 レビューチェックリスト | `docs/instructions/phase3/reviews/M18-02-review-checklist.md` |
| `M18-03-DESIGN（骨子・実装指示書の前段）` | **v0.1.0** | M18-03 設計方針書（骨子）: materialize ＋ 確定反撃マイリスト（使う） | `docs/instructions/phase3/M18-03-design-outline.md` |
| `M18-03a` | **v1.0.2** | 指示書 M18-03a: 確定反撃マイリスト（使う画面）＋隠したもの管理 | `docs/instructions/phase3/M18-03a-punish-mylist.md` |
| `M18-03a-REPORT` | — | M18-03a 完了報告: 確定反撃マイリスト（使う画面）＋隠したもの管理 | `docs/progress/phase3/M18-03a-completion-report.md` |
| `M18-03a-REVIEW` | **v1.0.2** | M18-03a レビューチェックリスト | `docs/instructions/phase3/reviews/M18-03a-review-checklist.md` |
| `M18-03b` | **v1.0.2** | 指示書 M18-03b: materialize（パニッシュカウンター版の生成）＋ 採用の引き継ぎ | `docs/instructions/phase3/M18-03b-materialize.md` |
| `M18-03b-DESIGN（骨子・実装指示書の前段）` | **v0.2.0** | M18-03b 設計方針書（骨子）: materialize ＋ 登録導線（生成系） | `docs/instructions/phase3/M18-03b-design-outline.md` |
| `M18-03b-REPORT` | — | M18-03b 完了報告: materialize（パニッシュカウンター版の生成）＋採用の引き継ぎ | `docs/progress/phase3/M18-03b-completion-report.md` |
| `M18-03b-REVIEW` | **v1.0.2** | M18-03b レビューチェックリスト | `docs/instructions/phase3/reviews/M18-03b-review-checklist.md` |
| `M18-03c` | **v1.0.2** | 指示書 M18-03c: 導線整備 ＋ 案C ＋ materialize 後のノーマル版非表示 ＋ ダメージ加算の訂正 | `docs/instructions/phase3/M18-03c-drainage.md` |
| `M18-03c-DESIGN（骨子・実装指示書の前段）` | **v0.2.0** | M18-03c 設計方針書（骨子）: 導線整備 ＋ 案C ＋ materialize 後のノーマル版非表示 ＋ ダメージ加算の訂正 | `docs/instructions/phase3/M18-03c-design-outline.md` |
| `M18-03c-REVIEW` | **v1.0.2** | M18-03c レビューチェックリスト | `docs/instructions/phase3/reviews/M18-03c-review-checklist.md` |
| `M18-CLOSE` | **v1.0.1** | M18 クローズ報告 ＋ CHANGE-090 DES 反映要点（M18 指示書担当 → 新・統合担当） | `docs/handover/phase3/M18-close-report.md` |
| `M18-M19-CONTRACT` | **v1.9.0** | M18/M19 残タスク 軽量契約 | `docs/process/m18-m19-contract.md` |
| `M18-M19-UNIFIED-HANDOFF` | **v1.2.0** | M18/M19 統合セッション 引き継ぎ資料（中央 → 統合担当） | `docs/handover/phase3/M18-M19-UNIFIED-SESSION-HANDOFF.md` |
| `M18-OVERVIEW` | **v1.3.0** | M18 マイルストーン全体像（M18-overview）: 確定反撃記録（別コンボ materialize） | `docs/instructions/phase3/M18-overview.md` |
| `M18-RESEARCH-01` | **1.0.0** | 指示書 M18-RESEARCH-01: 確定反撃 seed 充足の確認 ＋ G-b ジャストパリィ有利算出（飛び道具）の実装前詰め | `docs/instructions/phase3/M18-RESEARCH-01-seed-coverage-and-gb-projectile-survey.md` |
| `M18-RESEARCH-02` | **1.0.0** | 指示書 M18-RESEARCH-02: FR301 重複判定の実機序 ＋ materialize 実装面 ＋ 案C 影響範囲の実測（M18-03 着手前） | `docs/instructions/phase3/M18-RESEARCH-02-dup-key-and-materialize-surface.md` |
| `M19-01` | **1.4.1** | 指示書 M19-01: セットプレイ自動提案（エンジン移植・窓化・提案 API・提案 UI・採択保存） | `docs/instructions/M19-01-setplay-suggestion-engine-and-ui.md` |
| `M19-01-REVIEW` | 1.4.1 | M19-01 レビューチェックリスト | `docs/instructions/reviews/M19-01-review-checklist.md` |
| `M19-02` | 1.2.1 | 指示書 M19-02: セットプレイ自動提案のテコ入れ（filler 規則是正・汚連携モード・打ち切り是正・採用時の条件記録） | `docs/instructions/M19-02-suggestion-refinement.md` |
| `M19-02-REVIEW` | 1.2.1 | M19-02 レビューチェックリスト | `docs/instructions/reviews/M19-02-review-checklist.md` |
| `M19-03` | **1.0.4** | 指示書 M19-03: セットプレイ成立条件の記録（受け身種別・画面端 × 成立/不成立） | `docs/instructions/M19-03-setplay-condition-record.md` |
| `M19-03-REVIEW` | 1.0.1 | M19-03 レビューチェックリスト | `docs/instructions/reviews/M19-03-review-checklist.md` |
| `M19-04` | **1.2.0** | 指示書 M19-04: フレーム費用モデルの列追加（`moves` 新列 3 ＋ 新表 1 ＋ backfill） | `docs/instructions/M19-04-frame-cost-columns.md` |
| `M19-04-report` | 1.0.0 | M19-04 完了報告書（フレーム費用モデルの列追加） | `docs/progress/M19-04-completion-report.md` |
| `M19-04-REVIEW` | **1.2.1** | M19-04 レビューチェックリスト | `docs/instructions/reviews/M19-04-review-checklist.md` |
| `M19-04B` | **1.1.1** | M19-04b 指示書: 第三波 `chain_cancel_total` の投入 ＋ `move_derivations` の親参照 ＋ 第三波 6 キャラの人手判断一覧 | `docs/instructions/M19-04b-chain-cancel-and-derivations.md` |
| `M19-04B-REVIEW` | **1.0.1** | M19-04b レビューチェックリスト | `docs/instructions/reviews/M19-04b-review-checklist.md` |
| `M19-04C` | **1.4.2** | M19-04c 指示書: 既存データの是正（`move_code` / `command` / フレーム値） | `docs/instructions/M19-04c-data-corrections.md` |
| `M19-04C-REVIEW` | **1.2.0** | M19-04c レビューチェックリスト | `docs/instructions/reviews/M19-04c-review-checklist.md` |
| `M19-04D` | **1.1.1** | M19-04d 指示書: 統合追随（第三波への機械 backfill ＋ マイグレ契約テストの比較区間の是正） | `docs/instructions/M19-04d-integration-catchup.md` |
| `M19-04D-REVIEW` | **1.1.3** | M19-04d レビューチェックリスト | `docs/instructions/reviews/M19-04d-review-checklist.md` |
| `M19-05-COMPLETION-REPORT` | 1.0.0 | M19-05 完了報告: 消費側（費用規則の実装と filler 規則の変更） | `docs/progress/m19-05-completion-report.md` |
| `M19-05-DESIGN-EXCEPTIONS` | **1.4.0** | 設計伝達レポート: M19-05 消費側（例外のみ） | `docs/handover/design-reports/20260809-m19-05-design-exceptions.md` |
| `M19-05-REVIEW-REPORT` | 1.0.0 | M19-05 レビュー報告書 | `docs/progress/m19-05-review.md` |
| `M19-06` | **1.1.0** | 指示書 M19-06: 成立条件による絞り込み | `docs/instructions/M19-06-setup-result-filter.md` |
| `M19-06-REVIEW` | **1.1.1** | M19-06 レビューチェックリスト | `docs/instructions/reviews/M19-06-review-checklist.md` |
| `M19-07` | **1.0.0** | 指示書 M19-07: コンボ新規登録時のセットプレイ成立条件の入力 | `docs/instructions/M19-07-bundled-setup-verified-conditions.md` |
| `M19-07-REVIEW` | **1.0.0** | M19-07 レビューチェックリスト | `docs/instructions/reviews/M19-07-review-checklist.md` |
| `M19-CLOSE-REPORT` | **1.1.0** | M19 クローズ報告（セットプレイ自動提案・reorg②） | `docs/handover/m19-close-report.md` |
| `M19-OVERVIEW` | **1.26.1** | M19 マイルストーン全体像（M19-overview）: セットプレイ自動提案（reorg②） | `docs/instructions/M19-overview.md` |
| `M19-PHASE2-DESIGN-EXCEPTIONS` | — | M19 Phase 2 設計伝達レポート（例外レポート） | `docs/handover/design-reports/20260807-m19-phase2-design-exceptions.md` |
| `M19-RESEARCH-01（**M19 ローカル採番**）` | 1.0.3 | 指示書 M19-RESEARCH-01: セットプレイ自動提案エンジン（別リポ）の実体確定と出力品質 PoC | `docs/instructions/M19-RESEARCH-01-setplay-suggestion-engine-poc.md` |
| `M19-RESEARCH-02` | 1.0.0 | 指示書 M19-RESEARCH-02: 窓方式の追試 と 派生技フレーム表現の現況棚卸し | `docs/instructions/M19-RESEARCH-02-window-and-derived-move-survey.md` |
| `M19-RESEARCH-03` | 1.0.0 | 指示書 M19-RESEARCH-03: `is_derived` 実セマンティクスと `target_combo.total` の実データ確定（filler 規則の一次源） | `docs/instructions/M19-RESEARCH-03-is-derived-semantics.md` |
| `M19-RESEARCH-04` | 1.0.0 | 指示書 M19-RESEARCH-04: 新列（M19-04）の CSV → DB 流通経路と backfill 母数の実態調査 | `docs/instructions/M19-RESEARCH-04-csv-new-column-distribution.md` |
| `M19-RESEARCH-04-report` | 1.0.0 | M19-RESEARCH-04 調査報告: 新列（M19-04）の CSV → DB 流通経路と backfill 母数の実態 | `docs/progress/M19-RESEARCH-04-report.md` |
| `M19-RESEARCH-04-report-addendum` | 1.0.0 | M19-RESEARCH-04 追補調査報告（X-1 / X-2） | `docs/progress/M19-RESEARCH-04-report-addendum.md` |
| `M2-OVERVIEW` | 1.1.0 | M2 サブマイルストーン マップ | `docs/instructions/phase1/M2-overview.md` |
| `M2-TO-M3-HANDOVER` | 1.0.0 | 引き継ぎ: M2 → M3(設計担当 Claude セッション間) | `docs/handover/phase1/m2-to-m3-handover.md` |
| `M20-01` | 1.0.1 | 指示書 M20-01: 初期プリセットの 3 種化 | `docs/instructions/M20-01-initial-presets-three.md` |
| `M20-01-REVIEW` | 1.1.0 | M20-01 レビューチェックリスト | `docs/instructions/reviews/M20-01-review-checklist.md` |
| `M20-02` | 1.2.0 | 指示書 M20-02: エイリアス生成規則と実データ投入（`numeric` / `srk`） | `docs/instructions/M20-02-alias-generation-rules.md` |
| `M20-02-REVIEW` | 1.1.0 | M20-02 レビューチェックリスト | `docs/instructions/reviews/M20-02-review-checklist.md` |
| `M20-03` | 1.0.0 | M20-03 製造指示書: `preset_aliases` の一意制約（`character_id` の非正規化 ＋ UNIQUE 2 本） | `docs/instructions/M20-03-alias-uniqueness-constraint.md` |
| `M20-03-COMPLETION-REPORT` | — | M20-03 完了報告: `preset_aliases` の一意制約（`character_id` の非正規化 ＋ UNIQUE 2 本） | `docs/progress/M20-03-completion-report.md` |
| `M20-03-REVIEW-CHECKLIST` | 1.0.0 | M20-03 レビューチェックリスト | `docs/instructions/reviews/M20-03-review-checklist.md` |
| `M20-04` | 1.0.1 | M20-04 製造指示書: プリセット管理 UI ＋ カスタムプリセット作成 | `docs/instructions/M20-04-preset-management-ui.md` |
| `M20-04-REVIEW-CHECKLIST` | 1.0.1 | M20-04 レビューチェックリスト | `docs/instructions/reviews/M20-04-review-checklist.md` |
| `M20-05` | 1.2.0 | M20-05 製造指示書: `recipe_cache` 再計算の配線（eager）＋ 既定プリセットへの追随 | `docs/instructions/M20-05-recipe-cache-wiring.md` |
| `M20-05-REVIEW-CHECKLIST` | 1.2.0 | M20-05 レビューチェックリスト | `docs/instructions/reviews/M20-05-review-checklist.md` |
| `M20-06` | 1.2.0 | M20-06 製造指示書: 命名規則の正典化 ＋ `P-34` 13 件のエイリアス投入 | `docs/instructions/M20-06-naming-canonicalization.md` |
| `M20-06-REVIEW-CHECKLIST` | 1.2.0 | M20-06 レビューチェックリスト | `docs/instructions/reviews/M20-06-review-checklist.md` |
| `M20-07` | 1.0.0 | M20-07 製造指示書: 取込の逆引き活用 ＋ 多候補ハッジの分割 ＋ 逆引き前段の正規化 | `docs/instructions/M20-07-intake-reverse-lookup.md` |
| `M20-07-REVIEW-CHECKLIST` | 1.0.0 | M20-07 レビューチェックリスト | `docs/instructions/reviews/M20-07-review-checklist.md` |
| `M20-CONTRACT` | **v1.14.0** | M20 契約（プリセット管理・カスタムプリセット） | `docs/process/m20-contract.md` |
| `M20-DESK-STARTUP-PROMPT` | — | M20/M21 設計卓 起動プロンプト（セッション交代用） | `docs/handover/phase3/m20-desk-startup-prompt.md` |
| `M20-RESEARCH-01` | 1.1.0 | 指示書 M20-RESEARCH-01: プリセット周辺データの実態調査 | `docs/instructions/M20-RESEARCH-01-preset-data-reality.md` |
| `M20-RESEARCH-01-report-local` | — | M20-RESEARCH-01 ローカル調査レポート（D／F） | `docs/progress/M20-RESEARCH-01-report-local.md` |
| `M20-RESEARCH-01-report-web` | — | M20-RESEARCH-01 調査結果レポート（web セッション：軸 A / B / C / E） | `docs/progress/M20-RESEARCH-01-report-web.md` |
| `M21-01` | 1.0.2 | M21-01 製造指示書: 取得基盤・機種プロファイル・キャリブレーション・接続状態表示 | `docs/instructions/M21-01-gamepad-input-foundation.md` |
| `M21-01-REVIEW-CHECKLIST` | 1.0.2 | M21-01 レビューチェックリスト | `docs/instructions/reviews/M21-01-review-checklist.md` |
| `M21-02` | 1.0.0 | M21-02 製造指示書: 同時押し判定（FR107）とチャタリングの決着（FR108） | `docs/instructions/M21-02-simultaneous-press-and-chatter.md` |
| `M21-02-REVIEW-CHECKLIST` | 1.0.0 | M21-02 レビューチェックリスト | `docs/instructions/reviews/M21-02-review-checklist.md` |
| `M21-03` | 1.2.0 | M21-03 製造指示書: レシピ入力への接続 ＋ 読取表示（`FR105` / `FR106`） | `docs/instructions/M21-03-recipe-input-and-readout.md` |
| `M21-03-REVIEW-CHECKLIST` | 1.2.0 | M21-03 レビューチェックリスト | `docs/instructions/reviews/M21-03-review-checklist.md` |
| `M21-04` | 1.2.0 | M21-04 製造指示書: コントローラ完結入力（`DES-005` §6.5） | `docs/instructions/M21-04-controller-complete-input.md` |
| `M21-04-COMPLETION` | — | M21-04 完了報告: コントローラ完結入力 | `docs/progress/M21-04-completion-report.md` |
| `M21-04-REVIEW-CHECKLIST` | 1.2.0 | M21-04 レビューチェックリスト | `docs/instructions/reviews/M21-04-review-checklist.md` |
| `M21-05` | 1.0.0 | M21-05 製造指示書: キーボード入力（**既定を持たない全キー登録制**） | `docs/instructions/M21-05-keyboard-input.md` |
| `M21-05-REVIEW-CHECKLIST` | 1.0.0 | M21-05 レビューチェックリスト | `docs/instructions/reviews/M21-05-review-checklist.md` |
| `M21-06` | 1.1.0 | M21-06 製造指示書: コマンド技入力モード（必殺技の方向連続入力） | `docs/instructions/M21-06-command-motion-input.md` |
| `M21-06-REVIEW-CHECKLIST` | 1.1.0 | M21-06 レビューチェックリスト | `docs/instructions/reviews/M21-06-review-checklist.md` |
| `M21-07` | 1.0.0 | 指示書 M21-07: モーダル表示中の物理入力の遮断 | `docs/instructions/M21-07-modal-input-suppression.md` |
| `M21-07-REVIEW` | 1.0.0 | M21-07 レビューチェックリスト | `docs/instructions/reviews/M21-07-review-checklist.md` |
| `M21-CONTRACT` | **v1.16.0** | M21 契約（物理コントローラ入力・コマンド実モーション入力） | `docs/process/m21-contract.md` |
| `M21-MEASURE-ASSESS` | — | M21 追加計測の要否判定（m21-measurement-scope-assessment） | `docs/process/archive/m21-measurement-scope-assessment.md` |
| `M21-RESEARCH-01` | 1.2.0 | 指示書 M21-RESEARCH-01: Gamepad 入力の実測 PoC | `docs/instructions/M21-RESEARCH-01-gamepad-poc.md` |
| `M21-RESEARCH-01-REPORT` | — | M21-RESEARCH-01 報告: Gamepad 入力の実測 PoC | `docs/progress/M21-RESEARCH-01-report.md` |
| `M21-TO-M22-HANDOVER` | — | M20 / M21 → M22 引き継ぎ書 | `docs/handover/m21-to-m22-handover.md` |
| `M22-01` | 1.2.0 | 指示書 M22-01: 簡易パスワードとセッションの骨格（`FR501` / `FR502` / `F12-8`） | `docs/instructions/M22-01-auth-skeleton.md` |
| `M22-01-REVIEW` | 1.1.0 | M22-01 レビューチェックリスト | `docs/instructions/reviews/M22-01-review-checklist.md` |
| `M22-02` | 1.5.0 | 指示書 M22-02: ログイン画面・ユーザー選択・ウィザードのパスワード UI（`FR501` / `FR502` / `FR013`） | `docs/instructions/M22-02-login-ui-and-user-select.md` |
| `M22-02-REVIEW` | 1.5.0 | M22-02 レビューチェックリスト | `docs/instructions/reviews/M22-02-review-checklist.md` |
| `M22-03` | 1.0.0 | 指示書 M22-03: 楽観排他の実効化（版の突き合わせを固定し、契約を 1 つに揃える） | `docs/instructions/M22-03-optimistic-locking.md` |
| `M22-03-REVIEW` | 1.0.0 | M22-03 レビューチェックリスト | `docs/instructions/reviews/M22-03-review-checklist.md` |
| `M22-04` | 1.6.0 | 指示書 M22-04: 競合したときの利用者体験（409 の見せ方・編集を失わせない導線） | `docs/instructions/M22-04-conflict-ux.md` |
| `M22-04-REVIEW` | 1.3.0 | M22-04 レビューチェックリスト | `docs/instructions/reviews/M22-04-review-checklist.md` |
| `M22-05` | 1.1.0 | 指示書 M22-05: CORS / CSRF の境界（LAN の他端末を塞がずに、設定変更系を守る） | `docs/instructions/M22-05-cors-csrf-boundary.md` |
| `M22-05-REVIEW` | 1.1.0 | M22-05 レビューチェックリスト（CORS / CSRF の境界） | `docs/instructions/reviews/M22-05-review-checklist.md` |
| `M22-06` | 2.7.0 | 指示書 M22-06: 接続用 QR コードの検証と穴埋め（`FR407`） | `docs/instructions/M22-06-connection-qr-code.md` |
| `M22-06-REVIEW` | 2.4.0 | M22-06 レビューチェックリスト | `docs/instructions/reviews/M22-06-review-checklist.md` |
| `M22-07` | 1.4.0 | 指示書 M22-07: 取込の別名辞書の充実（`G-14b` の残り半分） | `docs/instructions/M22-07-alias-dictionary-enrichment.md` |
| `M22-07-REVIEW` | 1.4.0 | M22-07 レビューチェックリスト | `docs/instructions/reviews/M22-07-review-checklist.md` |
| `M22-07b` | 1.0.0 | 指示書 M22-07b: SA 番号の逆引きを規則で解く（`M22-07` の続き・案 E） | `docs/instructions/M22-07b-sa-number-rule-based-lookup.md` |
| `M22-08` | 1.3.0 | 指示書 M22-08: 入場まわりの仕上げ（パスワードの検証・ログアウトの導線・利用者の改名） | `docs/instructions/M22-08-auth-finishing.md` |
| `M22-08-REVIEW` | 1.1.0 | M22-08 レビューチェックリスト | `docs/instructions/reviews/M22-08-review-checklist.md` |
| `M22-CLOSE-REPORT` | **1.0.0** | M22 クローズ報告（協調基盤 — 簡易ログイン・楽観排他・QR・CORS/CSRF） | `docs/handover/m22-close-report.md` |
| `M22-CONTRACT` | **v1.18.0** | M22 契約（協調基盤 — 簡易ログイン・楽観排他・QR・CORS/CSRF） | `docs/process/m22-contract.md` |
| `M22-RESEARCH-01` | 1.0.0 | 調査指示書 M22-RESEARCH-01: 協調基盤の実態調査（7 軸） | `docs/instructions/M22-RESEARCH-01-collaboration-baseline.md` |
| `M23-01` | 1.0.0 | 指示書 M23-01: ゴミ箱の実態を仕様へ揃える（`PUT` が積む旧行を既定で隠す ＋ 残日数表示の撤回） | `docs/instructions/M23-01-trash-as-built-and-superseded-rows.md` |
| `M23-01-REVIEW` | 1.0.0 | M23-01 レビューチェックリスト | `docs/instructions/reviews/M23-01-review-checklist.md` |
| `M23-02` | 1.3.0 | 指示書 M23-02: セットプレイの復元と完全削除（＋ 論理削除が紐付けを壊すのをやめる） | `docs/instructions/M23-02-setup-restore-and-permanent-delete.md` |
| `M23-02-REVIEW` | 1.3.0 | M23-02 レビューチェックリスト | `docs/instructions/reviews/M23-02-review-checklist.md` |
| `M23-03` | 1.1.0 | 指示書 M23-03: 参照側の `deleted_at` 除外の穴を 1 件ずつ塞ぐ（＋ 削除・復元の契約を as-built で固定する） | `docs/instructions/M23-03-reference-side-exclusion-and-delete-contract.md` |
| `M23-03-REVIEW` | 1.0.0 | M23-03 レビューチェックリスト | `docs/instructions/reviews/M23-03-review-checklist.md` |
| `M23-04` | 1.0.0 | 指示書 M23-04: 復元時のバリデーション（落とさずに戻して警告する） | `docs/instructions/M23-04-restore-validation.md` |
| `M23-04-REVIEW` | 1.0.0 | M23-04 レビューチェックリスト | `docs/instructions/reviews/M23-04-review-checklist.md` |
| `M23-05` | 1.1.0 | 指示書 M23-05: 削除済み行と再登録の衝突（`FR301` の重複判定が見ていない側を、落とさずに知らせる） | `docs/instructions/M23-05-deleted-row-duplicate-collision.md` |
| `M23-05-REVIEW` | 1.1.0 | M23-05 レビューチェックリスト | `docs/instructions/reviews/M23-05-review-checklist.md` |
| `M23-06` | 1.0.0 | 指示書 M23-06: ゴミ箱の列と見せ方（消す列と、出す列を 1 件ずつ決める） | `docs/instructions/M23-06-trash-columns-and-presentation.md` |
| `M23-06-REVIEW` | 1.0.0 | M23-06 レビューチェックリスト | `docs/instructions/reviews/M23-06-review-checklist.md` |
| `M23-07` | 1.1.0 | 指示書 M23-07: ゴミ箱の未達の導線（入口と出口をつなぐ） | `docs/instructions/M23-07-trash-missing-paths.md` |
| `M23-07-REVIEW` | 1.0.1 | M23-07 レビューチェックリスト | `docs/instructions/reviews/M23-07-review-checklist.md` |
| `M23-08` | 1.1.0 | 指示書 M23-08: 削除・完全削除のサーバ側の是正（CASCADE 依存を明示削除へ ＋ 非対称の解消 3 件） | `docs/instructions/M23-08-delete-server-side-corrections.md` |
| `M23-08-REVIEW` | 1.1.0 | M23-08 レビューチェックリスト | `docs/instructions/reviews/M23-08-review-checklist.md` |
| `M23-09` | 1.1.0 | 指示書 M23-09: 登録前の重複ダイアログ（保存する前に、ゴミ箱に同じものがあることを知らせて選ばせる） | `docs/instructions/M23-09-pre-save-duplicate-dialog.md` |
| `M23-09-REVIEW` | 1.0.1 | M23-09 レビューチェックリスト | `docs/instructions/reviews/M23-09-review-checklist.md` |
| `M23-10` | 1.0.0 | 指示書 M23-10: `P-04` の根治（FK をプール全体で有効にする ＋ それを守り続ける回帰ゲート） | `docs/instructions/M23-10-foreign-key-enforcement-root-fix.md` |
| `M23-10-REVIEW` | 1.0.0 | M23-10 レビューチェックリスト | `docs/instructions/reviews/M23-10-review-checklist.md` |
| `M23-CLOSE-REPORT` | **1.0.0** | M23 クローズ報告（データバージョン管理 — `FR601`・ゴミ箱／復元の拡充） | `docs/handover/m23-close-report.md` |
| `M23-RESEARCH-01` | **1.0.0** | 指示書 M23-RESEARCH-01: ゴミ箱・復元の実態調査（8 軸） | `docs/instructions/M23-RESEARCH-01-trash-and-restore-baseline.md` |
| `M23-RESEARCH-01-report` | — | M23-RESEARCH-01 調査報告: ゴミ箱・復元の実態調査（8 軸） | `docs/progress/M23-RESEARCH-01-report.md` |
| `M24-01` | 1.3.0 | 指示書 M24-01: 一覧・ナビゲーション・既定キャラの配線 | `docs/instructions/M24-01-list-navigation-and-default-character.md` |
| `M24-01-REVIEW` | 1.3.0 | M24-01 レビューチェックリスト | `docs/instructions/reviews/M24-01-review-checklist.md` |
| `M24-02` | 1.2.0 | 指示書 M24-02: フィルタ・タグ・キャラ選択 | `docs/instructions/M24-02-filter-tag-character-selection.md` |
| `M24-02-review-checklist` | 1.2.0 | M24-02 レビューチェックリスト: フィルタ・タグ・キャラ選択 | `docs/instructions/reviews/M24-02-review-checklist.md` |
| `M24-03` | 1.1.0 | 指示書 M24-03: 比較・詳細・レシピ可読性 | `docs/instructions/M24-03-compare-detail-recipe-readability.md` |
| `M24-03-review-checklist` | 1.1.0 | M24-03 レビューチェックリスト: 比較・詳細・レシピ可読性 | `docs/instructions/reviews/M24-03-review-checklist.md` |
| `M24-04` | 1.1.0 | 指示書 M24-04: エディタ操作・dirty state・入力事故の防止 | `docs/instructions/M24-04-editor-input-safety.md` |
| `M24-04-review-checklist` | 1.1.0 | M24-04 レビューチェックリスト: エディタ操作・dirty state・入力事故の防止 | `docs/instructions/reviews/M24-04-review-checklist.md` |
| `M24-05` | 1.2.0 | 指示書 M24-05: セットプレイ導線・紐付け UI 統合 | `docs/instructions/M24-05-setup-navigation-and-link-ui.md` |
| `M24-05-review-checklist` | 1.1.0 | M24-05 レビューチェックリスト: セットプレイ導線・紐付け UI 統合 | `docs/instructions/reviews/M24-05-review-checklist.md` |
| `M24-06` | 1.2.0 | 指示書 M24-06: 取込・出力の UX | `docs/instructions/M24-06-import-export-ux.md` |
| `M24-06-review-checklist` | 1.2.0 | M24-06 レビューチェックリスト: 取込・出力の UX | `docs/instructions/reviews/M24-06-review-checklist.md` |
| `M24-07` | 1.1.0 | 指示書 M24-07: 用語・i18n・内部値露出の最終 sweep | `docs/instructions/M24-07-terminology-and-i18n.md` |
| `M24-07-review-checklist` | 1.1.0 | M24-07 レビューチェックリスト: 用語・i18n・内部値露出の最終 sweep | `docs/instructions/reviews/M24-07-review-checklist.md` |
| `M24-08` | 1.0.0 | 指示書 M24-08: `queryKey` の統一 ＋ M24 の繰越 4 件 | `docs/instructions/M24-08-querykey-and-carryover.md` |
| `M24-08-review-checklist` | 1.0.0 | M24-08 レビューチェックリスト: `queryKey` の統一 ＋ M24 の繰越 4 件 | `docs/instructions/reviews/M24-08-review-checklist.md` |
| `M24-09a` | 1.0.0 | 指示書 M24-09a: CI の新設（PR＝高速検査 ／ nightly＝3 OS クロスビルド）と依存の棚卸し | `docs/instructions/M24-09a-ci-distribution-and-dependency-audit.md` |
| `M24-09a-REVIEW` | 1.0.0 | M24-09a レビューチェックリスト | `docs/instructions/reviews/M24-09a-review-checklist.md` |
| `M24-09b` | 1.1.0 | 指示書 M24-09b: テスト資産と残リファクタ | `docs/instructions/M24-09b-test-assets-and-residual-refactor.md` |
| `M24-09b-REVIEW` | 1.1.0 | M24-09b レビューチェックリスト | `docs/instructions/reviews/M24-09b-review-checklist.md` |
| `M24-09c` | 1.4.0 | 指示書 M24-09c: E2E スイートの安定化 | `docs/instructions/M24-09c-e2e-suite-stabilization.md` |
| `M24-09c-review-checklist` | 1.4.0 | M24-09c レビューチェックリスト: E2E スイートの安定化 | `docs/instructions/reviews/M24-09c-review-checklist.md` |
| `M24-09d` | 1.0.0 | 指示書 M24-09d: テスト実行基盤の高速化 | `docs/instructions/M24-09d-test-execution-speedup.md` |
| `M24-09d-review-checklist` | 1.0.0 | M24-09d レビューチェックリスト: テスト実行基盤の高速化 | `docs/instructions/reviews/M24-09d-review-checklist.md` |
| `M24-11` | 1.1.0 | 指示書 M24-11: `VAL-C02` の check-then-act 競合を閉じる | `docs/instructions/M24-11-val-c02-check-then-act-race.md` |
| `M24-11-review-checklist` | 1.1.0 | M24-11 レビューチェックリスト: `VAL-C02` の check-then-act 競合 | `docs/instructions/reviews/M24-11-review-checklist.md` |
| `M24-12` | 1.2.0 | 指示書 M24-12: エディタの作り替え（1 カラム縦積み ＋ タブ ＋ キーボード中心の入力） | `docs/instructions/M24-12-editor-rebuild.md` |
| `M24-12-review-checklist` | 1.2.0 | M24-12 レビューチェックリスト: エディタの作り替え（1 カラム縦積み ＋ タブ ＋ キーボード中心の入力） | `docs/instructions/reviews/M24-12-review-checklist.md` |
| `M24-13` | 1.1.0 | 指示書 M24-13: 仮登録もレシピのステップ 1 本以上を要する | `docs/instructions/M24-13-draft-requires-recipe-step.md` |
| `M24-13-review-checklist` | 1.1.0 | M24-13 レビューチェックリスト: 仮登録もレシピのステップ 1 本以上を要する | `docs/instructions/reviews/M24-13-review-checklist.md` |
| `M24-CLOSE-REPORT` | **1.1.0** | M24 クローズ報告（UX 整理・i18n・繰越・リファクタ ＋ 蓄積した改善要望） | `docs/handover/m24-close-report.md` |
| `M24-DESK-STARTUP-PROMPT` | — | M24 設計卓 起動プロンプト（セッション交代用） | `docs/handover/phase3/m24-desk-startup-prompt.md` |
| `M24-RESEARCH-01` | **1.0.0** | 指示書 M24-RESEARCH-01: `Memo_Someday` 未完行 と 繰越項目の二系統 ledger | `docs/instructions/M24-RESEARCH-01-someday-and-carryover-ledger.md` |
| `M25-RESEARCH-01` | **1.1.0** | 指示書 M25-RESEARCH-01: フェーズ4 スコープ再編のための 3 層 ledger | `docs/instructions/M25-RESEARCH-01-phase4-scope-ledger.md` |
| `M26-01` | **1.0.0** | 指示書 M26-01: 依存ライセンスの棚卸しと三層の割当（`A2` → `A1`） | `docs/instructions/M26-01-license-inventory-and-three-layer.md` |
| `M26-01-review-checklist` | **1.0.0** | M26-01 レビューチェックリスト — **★★欠番。そもそもレビュー不要だった** | `docs/instructions/reviews/M26-01-review-checklist.md` |
| `M26-02` | **1.3.0** | 指示書 M26-02: 公開スナップショット生成の基盤 ＋ ライセンスの配置（`α③` ／ `A1` / `A3` / `A7` / `A8`） | `docs/instructions/M26-02-public-snapshot-and-license-placement.md` |
| `M26-02-review-checklist` | **1.0.3** | M26-02 レビューチェックリスト: 公開スナップショット生成の基盤 ＋ ライセンスの配置 | `docs/instructions/reviews/M26-02-review-checklist.md` |
| `M26-03` | **1.4.0** | 指示書 M26-03: 法務ポスチャの再点検とデータ来歴の切り分け（`A4` ＋ `A3`） | `docs/instructions/M26-03-legal-posture-recheck.md` |
| `M26-03-REVIEW-CHECKLIST` | **1.3.0** | M26-03 レビューチェックリスト（法務ポスチャの再点検とデータ来歴の切り分け） | `docs/instructions/reviews/M26-03-review-checklist.md` |
| `M26-04` | **1.2.0** | 指示書 M26-04: セキュリティ実査と公開前スキャン（`A6` / `A9` / `A7`） | `docs/instructions/M26-04-security-survey-and-prerelease-scan.md` |
| `M26-04-REVIEW-CHECKLIST` | **1.1.0** | M26-04 レビューチェックリスト（セキュリティ実査と公開前スキャン） | `docs/instructions/reviews/M26-04-review-checklist.md` |
| `M26-05` | **1.2.0** | 指示書 M26-05: 初回起動ウィザードの LAN 公開に警告と同意を入れる（`A6` の穴） | `docs/instructions/M26-05-wizard-lan-consent-parity.md` |
| `M26-05-REVIEW-CHECKLIST` | **1.0.0** | M26-05 レビューチェックリスト（ウィザードの LAN 公開に警告と同意を入れる） | `docs/instructions/reviews/M26-05-review-checklist.md` |
| `M27-01` | **1.0.0** | 指示書 M27-01: ヒット種別の追加と区分名の整理 | `docs/instructions/M27-01-hit-type-and-size-labels.md` |
| `M27-01-review-checklist` | **1.0.0** | M27-01 レビューチェックリスト — **★★欠番。作成されなかった** | `docs/instructions/reviews/M27-01-review-checklist.md` |
| `M27-02a` | **1.3.0** | 指示書 M27-02a: 届かないものを届かせる（保存の理由・候補選択の操作） | `docs/instructions/M27-02a-reachability-save-path-and-selectors.md` |
| `M27-02a-review-checklist` | **1.0.0** | M27-02a レビューチェックリスト: 届かないものを届かせる（保存の理由・候補選択の操作） | `docs/instructions/reviews/M27-02a-review-checklist.md` |
| `M27-02b` | **1.2.0** | 指示書 M27-02b: 入力仕様の 3 状態（必須・任意・未検証） | `docs/instructions/M27-02b-required-fields-and-strength-display.md` |
| `M27-03` | **1.2.0** | 指示書 M27-03: 一覧・詳細（欄の除去・フィルタ・符号の見せ方・戻り先） | `docs/instructions/M27-03-list-and-detail.md` |
| `M28-01` | **1.0.1** | 指示書 M28-01: 正式名リネーム（`combomgr` → `Tacpendium`） | `docs/instructions/M28-01-official-name-rename.md` |
| `M28-01-review-checklist` | **1.0.0** | M28-01 レビューチェックリスト: 正式名リネーム（`combomgr` → `Tacpendium`） | `docs/instructions/reviews/M28-01-review-checklist.md` |
| `M28-02a` | **1.6.0** | 指示書 M28-02a: `FR702` 追従のスキーマとバックエンド ＋ 運び量の記録 | `docs/instructions/M28-02a-game-update-schema-and-backend.md` |
| `M28-02a-review-checklist` | **1.0.1** | M28-02a レビューチェックリスト: `FR702` 追従のスキーマとバックエンド ＋ 始動位置・運び量 | `docs/instructions/reviews/M28-02a-review-checklist.md` |
| `M28-02b` | **1.2.0** | 指示書 M28-02b: ゲーム更新の影響コンボを見せる画面 | `docs/instructions/M28-02b-game-update-impact-screen.md` |
| `M28-02b-review-checklist` | **1.0.0** | M28-02b レビューチェックリスト: ゲーム更新の影響コンボを見せる画面 | `docs/instructions/reviews/M28-02b-review-checklist.md` |
| `M28-02c` | **1.0.0** | 指示書 M28-02c: `FR702` のバックエンド追補 ＋ 影響コンボ画面の実装 | `docs/instructions/M28-02c-game-update-backend-remainder.md` |
| `M28-02c-review-checklist` | **1.0.0** | M28-02c レビューチェックリスト: `FR702` のバックエンド追補 ＋ 影響コンボ画面の実装 | `docs/instructions/reviews/M28-02c-review-checklist.md` |
| `M28-03` | **1.0.0** | 指示書 M28-03: ツールチェーンと依存の版上げ | `docs/instructions/M28-03-toolchain-and-dependency-bump.md` |
| `M28-03-review-checklist` | **1.0.0** | M28-03 レビューチェックリスト: ツールチェーンと依存の版上げ | `docs/instructions/reviews/M28-03-review-checklist.md` |
| `M28-04` | **1.2.0** | 指示書 M28-04: `move_code` / `command` / `startup_basis` の是正（guile 3 件） | `docs/instructions/M28-04-move-code-and-command-corrections.md` |
| `M28-04-review-checklist` | **1.0.1** | M28-04 レビューチェックリスト: `move_code` / `command` の是正 ＋ `startup` / `total` の 6 行 | `docs/instructions/reviews/M28-04-review-checklist.md` |
| `M28-05` | **1.0.0** | 指示書 M28-05: terry `quick_burn_light` の `move_code` 是正 | `docs/instructions/M28-05-terry-quick-burn-code-fix.md` |
| `M28-05-review-checklist` | **1.0.0** | M28-05 レビューチェックリスト: terry `quick_burn_light` の `move_code` 是正 | `docs/instructions/reviews/M28-05-review-checklist.md` |
| `M29-01` | **1.0.0** | 指示書 M29-01: 語彙・ラベルの統一（★内訳の実査から始める） | `docs/instructions/M29-01-vocabulary-and-labels.md` |
| `M29-01-review-checklist` | **1.0.0** | M29-01 レビューチェックリスト: 用語・ラベルの統一 | `docs/instructions/reviews/M29-01-review-checklist.md` |
| `M29-02` | **1.1.0** | 指示書 M29-02: 入出力（CSV ／ バックアップ・復元 ／ 下書きの往復） | `docs/instructions/M29-02-io-csv-backup-draft.md` |
| `M29-02-review-checklist` | **1.0.0** | M29-02 レビューチェックリスト: 入出力（CSV・バックアップ・下書き） | `docs/instructions/reviews/M29-02-review-checklist.md` |
| `M3-OVERVIEW` | 1.0.2 | M3 サブマイルストーン マップ | `docs/instructions/phase1/M3-overview.md` |
| `M3-TO-M4-HANDOVER` | 1.1.0 | 引き継ぎ: M3 → M4(設計担当 Claude セッション間) | `docs/handover/phase1/m3-to-m4-handover.md` |
| `M30-01` | **1.2.0** | 指示書 M30-01: 仮想コントローラの技の出し分け（何を出すか） | `docs/instructions/M30-01-controller-move-surfacing.md` |
| `M30-01-completion-report` | **1.3.0** | M30-01 完了報告: 仮想コントローラの技の出し分け（何を出すか） | `docs/progress/M30-01-completion-report.md` |
| `m30-01-review` | — | M30-01 レビュー報告書 | `docs/progress/m30-01-review.md` |
| `M30-01-review-checklist` | **1.0.0** | M30-01 レビューチェックリスト: 仮想コントローラの技の出し分け（何を出すか） | `docs/instructions/reviews/M30-01-review-checklist.md` |
| `M30-02` | **1.0.0** | 指示書 M30-02: 仮想コントローラの技の選び方と見た目（強度・変種 ＋ ボタン名・配置） | `docs/instructions/M30-02-controller-selection-and-labels.md` |
| `M30-02-completion-report` | **2.0.0** | M30-02 完了報告: 仮想コントローラの技の選び方と見た目（強度・変種 ＋ ボタン名・配置） | `docs/progress/M30-02-completion-report.md` |
| `M30-02-review` | 1.0.0 | M30-02 レビュー報告書 | `docs/progress/m30-02-review.md` |
| `M30-02-REVIEW-CHECKLIST` | **1.0.0** | M30-02 レビューチェックリスト（仮想コントローラの技の選び方と見た目） | `docs/instructions/reviews/M30-02-review-checklist.md` |
| `M30-03` | **1.0.0** | 指示書 M30-03: 必殺技ファミリーの導き方を「`code` のどこかにある強度語」へ広げる | `docs/instructions/M30-03-special-family-code-anywhere.md` |
| `M30-03-REVIEW-CHECKLIST` | **1.0.0** | M30-03 レビューチェックリスト（必殺技ファミリーの導き方を「`code` のどこかにある強度語」へ広げる） | `docs/instructions/reviews/M30-03-review-checklist.md` |
| `M30-04` | **1.1.0** | 指示書 M30-04: 必殺技ファミリー行の派生変種を末尾へ回す（`special-family-derived-variants-crowd-the-row`） | `docs/instructions/M30-04-derived-variants-to-row-end.md` |
| `M30-04-REVIEW-CHECKLIST` | **1.0.0** | M30-04 レビューチェックリスト（ファミリー行の派生変種を末尾へ回す） | `docs/instructions/reviews/M30-04-review-checklist.md` |
| `M30-05` | **1.1.0** | 指示書 M30-05: ファミリー行の表示名に残る強度語を落とす（`special-family-label-keeps-strength-word`） | `docs/instructions/M30-05-family-label-strength-word.md` |
| `M30-05-REVIEW-CHECKLIST` | **1.0.0** | M30-05 レビューチェックリスト（ファミリー行の表示名に残る強度語） | `docs/instructions/reviews/M30-05-review-checklist.md` |
| `M30-06` | **1.0.0** | 指示書 M30-06: ファミリー行の代表名が 1 メンバーの名前になっている（cammy 4 行） | `docs/instructions/M30-06-family-label-representative-name.md` |
| `M30-06-REVIEW-CHECKLIST` | **1.0.0** | M30-06 レビューチェックリスト（ファミリー行の代表名が 1 メンバーの名前になっている） | `docs/instructions/reviews/M30-06-review-checklist.md` |
| `M30-07` | **1.0.1** | 指示書 M30-07: 【ジャスト】版の `move_code` を接尾形へ揃える（ガイル 3 ファミリー） | `docs/instructions/M30-07-perfect-variant-code-suffix.md` |
| `M30-07-REVIEW-CHECKLIST` | **1.0.1** | M30-07 レビューチェックリスト（【ジャスト】版の `move_code` を接尾形へ揃える） | `docs/instructions/reviews/M30-07-review-checklist.md` |
| `M30-overview` | **1.12.0** | M30-overview: 仮想コントローラ（`α②` 画面品質） | `docs/instructions/M30-overview.md` |
| `M31-01` | **1.0.0** | 指示書 M31-01: セットプレイ ＋ 確定反撃 ＋ 起き攻めの連動（`materialize` の穴を含む） | `docs/instructions/M31-01-setplay-punish-and-oki.md` |
| `M31-01-review-checklist` | **1.0.0** | M31-01 レビューチェックリスト: セットプレイ ＋ 確定反撃 ＋ 起き攻めの連動 | `docs/instructions/reviews/M31-01-review-checklist.md` |
| `M31-02` | **1.1.0** | 指示書 M31-02: 共通画面部品 — キャラ選択の入力挙動 | `docs/instructions/M31-02-shared-character-picker.md` |
| `M31-02-review-checklist` | **1.1.0** | M31-02 レビューチェックリスト: 共通画面部品 — キャラ選択の入力挙動 | `docs/instructions/reviews/M31-02-review-checklist.md` |
| `M31-03` | **1.1.0** | 指示書 M31-03: 一覧の列の並び ＋ 詳細への行内リンクの位置 | `docs/instructions/M31-03-combo-list-columns-and-row-link.md` |
| `M31-03-REVIEW-CHECKLIST` | **1.0.0** | M31-03 レビューチェックリスト（一覧の列の並び ＋ 詳細への行内リンクの位置） | `docs/instructions/reviews/M31-03-review-checklist.md` |
| `M31-04` | **1.0.0** | 指示書 M31-04: 確定反撃でドライブリバーサルを扱う（`SM-098`） | `docs/instructions/M31-04-drive-reversal-punish.md` |
| `M31-04-REVIEW-CHECKLIST` | **1.0.0** | M31-04 レビューチェックリスト（確定反撃でドライブリバーサルを扱う） | `docs/instructions/reviews/M31-04-review-checklist.md` |
| `M31-05` | **1.3.0** | 指示書 M31-05: 各キャラの設置系 `custom_states` を足す（`P4M-023`） | `docs/instructions/M31-05-custom-states-placement-expansion.md` |
| `M31-05-REVIEW-CHECKLIST` | **1.1.0** | M31-05 レビューチェックリスト（各キャラの設置系 `custom_states` を足す） | `docs/instructions/reviews/M31-05-review-checklist.md` |
| `M31-06` | **1.2.0** | 指示書 M31-06: `setup_only` の技をコンボの入力面から外す経路を作る（`P4M-005` のフェーズ4 分） | `docs/instructions/M31-06-setup-only-input-exclusion.md` |
| `M31-06-REVIEW-CHECKLIST` | **1.0.0** | M31-06 レビューチェックリスト（`setup_only` を入力面 2 面から外す） | `docs/instructions/reviews/M31-06-review-checklist.md` |
| `M31-RESEARCH-01` | **1.0.0** | RESEARCH 指示書 M31-RESEARCH-01: `moves.setup_only` は何を出し分ける列か（`P4M-005`） | `docs/instructions/M31-RESEARCH-01-setup-only-flag.md` |
| `M32-01` | **1.1.1** | 指示書 M32-01: 操作説明書の器と `README` の整理（`B4` の構造 ＋ `B6`） | `docs/instructions/M32-01-usermanual-shell-and-readme.md` |
| `M32-01-REVIEW-CHECKLIST` | **1.0.0** | M32-01 レビューチェックリスト（操作説明書の器と `README` の整理） | `docs/instructions/reviews/M32-01-review-checklist.md` |
| `M32-02` | **1.2.0** | 指示書 M32-02: 操作説明書の本文（`B4` の中身）＋ UI の粗の記録 | `docs/instructions/M32-02-usermanual-body.md` |
| `M32-02-REVIEW-CHECKLIST` | **1.0.0** | M32-02 レビューチェックリスト（操作説明書の本文 ＋ UI の粗の記録） | `docs/instructions/reviews/M32-02-review-checklist.md` |
| `M32-03` | **1.3.0** | 指示書 M32-03: 操作説明書を `M37` の着地へ追随させる（改稿 ＋ 撮影の置き場の点検） | `docs/instructions/M32-03-usermanual-revision-after-m37.md` |
| `M32-03-REVIEW-CHECKLIST` | **1.3.0** | M32-03 レビューチェックリスト（操作説明書を `M37` の着地へ追随させる） | `docs/instructions/reviews/M32-03-review-checklist.md` |
| `M33-01` | **1.1.0** | 指示書 M33-01: 凍結と実測（**統合の前に、消してよいものを数え切る**） | `docs/instructions/M33-01-freeze-and-survey.md` |
| `M33-01-REVIEW-CHECKLIST` | **1.0.0** | M33-01 レビューチェックリスト（凍結と実測） | `docs/instructions/reviews/M33-01-review-checklist.md` |
| `M33-02` | **1.2.0** | 指示書 M33-02: 9 群の生成と同一性の検証 | `docs/instructions/M33-02-generate-and-verify-groups.md` |
| `M33-02-REVIEW-CHECKLIST` | **1.0.0** | M33-02 レビューチェックリスト（9 群の生成と同一性の検証） | `docs/instructions/reviews/M33-02-review-checklist.md` |
| `M33-03` | **1.0.0** | 指示書 M33-03: ガードと資料の作り直し（歴史テスト ／ golden ／ 失効参照 ／ 移行手順） | `docs/instructions/M33-03-guards-docs-and-migration-path.md` |
| `M33-03-REVIEW-CHECKLIST` | **1.0.0** | M33-03 レビューチェックリスト（ガードと資料の作り直し） | `docs/instructions/reviews/M33-03-review-checklist.md` |
| `M34-01` | **1.0.0** | 指示書 M34-01: 実査と移植と OS 分離（**Linux のビルドを壊さずに Windows 用の足場を置く**） | `docs/instructions/M34-01-desktop-port-and-os-split.md` |
| `M34-02` | **1.0.0** | 指示書 M34-02: 常駐ランチャと黒窓の除去（**消す前に、見えなくなるものを塞ぐ**） | `docs/instructions/M34-02-tray-residency-and-no-console.md` |
| `M34-02-REVIEW-CHECKLIST` | **1.0.0** | M34-02 レビューチェックリスト（常駐ランチャと黒窓の除去） | `docs/instructions/reviews/M34-02-review-checklist.md` |
| `M34-OVERVIEW` | **1.6.0** | M34-overview: Windows での起動・常駐方式（**黒いコンソール窓を出さない**） | `docs/instructions/M34-overview.md` |
| `M35-01` | **1.0.0** | 指示書 M35-01: タグまわりの是正 3 件（**公開前**） | `docs/instructions/M35-01-tag-fixes.md` |
| `M35-01-REVIEW-CHECKLIST` | **1.0.0** | M35-01 レビューチェックリスト（タグまわりの是正 3 件） | `docs/instructions/reviews/M35-01-review-checklist.md` |
| `M35-02` | **1.0.0** | 指示書 M35-02: `ryu` の `axe_kick_2` → `axe_kick`（**入力できない技を 1 件直す**） | `docs/instructions/M35-02-ryu-axe-kick-code-fix.md` |
| `M35-02-REVIEW-CHECKLIST` | **1.0.0** | M35-02 レビューチェックリスト（`ryu` の `axe_kick_2` → `axe_kick`） | `docs/instructions/reviews/M35-02-review-checklist.md` |
| `M35-03` | **1.0.0** | 指示書 M35-03: ラッシュ版 4 件の `original_move_code` の誤りを直す（`rush-original-move-code-typo`） | `docs/instructions/M35-03-rush-original-move-code-typo.md` |
| `M35-03-REVIEW-CHECKLIST` | **1.0.0** | M35-03 レビューチェックリスト（ラッシュ版 4 件の `original_move_code`） | `docs/instructions/reviews/M35-03-review-checklist.md` |
| `M35-OVERVIEW` | **1.5.0** | M35-overview: 公開前の是正束（**タグまわり ＋ データ 1 件**） | `docs/instructions/M35-overview.md` |
| `M36-01` | **1.3.0** | 指示書 M36-01: 配布アーカイブの組み立てとチェックサム（射程 1 ＋ 2） | `docs/instructions/M36-01-release-archive-and-checksums.md` |
| `M36-01-REVIEW-CHECKLIST` | **1.3.0** | M36-01 レビューチェックリスト（配布アーカイブの組み立てとチェックサム） | `docs/instructions/reviews/M36-01-review-checklist.md` |
| `M36-02` | **1.1.0** | 指示書 M36-02: リリースの門と来歴（attestation ／ SBOM ／ タグ署名 ／ CI からのリリース） | `docs/instructions/M36-02-release-provenance-and-gate.md` |
| `M36-02-REVIEW-CHECKLIST` | **1.1.0** | M36-02 レビューチェックリスト（リリースの門と来歴） | `docs/instructions/reviews/M36-02-review-checklist.md` |
| `M36-OVERVIEW` | **1.6.0** | M36 overview — リリースパッケージング（配布物の組み立てと来歴） | `docs/instructions/M36-overview.md` |
| `M37-01` | **1.0.0** | 指示書 M37-01: 始動位置・運び量の 3 方式入力 UI（`A`） | `docs/instructions/M37-01-carry-distance-three-way-input.md` |
| `M37-01-REVIEW-CHECKLIST` | **1.0.0** | M37-01 レビューチェックリスト（始動位置・運び量の 3 方式入力 UI） | `docs/instructions/reviews/M37-01-review-checklist.md` |
| `M37-02` | **1.0.0** | 指示書 M37-02: 仮想コントローラ UI の 10 件（`B04` `B05` `B07`〜`B14`） | `docs/instructions/M37-02-virtual-controller-vertical.md` |
| `M37-02-REVIEW-CHECKLIST` | **1.0.0** | M37-02 レビューチェックリスト（仮想コントローラ UI の 10 件） | `docs/instructions/reviews/M37-02-review-checklist.md` |
| `M37-03` | **1.0.0** | 指示書 M37-03: 一覧・マイコンボ・ゴミ箱の 3 件（`B01` / `B03` / `B15`） | `docs/instructions/M37-03-list-mycombo-trash-fixes.md` |
| `M37-03-REVIEW-CHECKLIST` | **1.0.0** | M37-03 レビューチェックリスト（一覧・マイコンボ・ゴミ箱の 3 件） | `docs/instructions/reviews/M37-03-review-checklist.md` |
| `M37-04` | **1.0.3** | 指示書 M37-04: 確定反撃候補の初段発生（`B02` / `B06`） | `docs/instructions/M37-04-punish-candidate-first-hit-startup.md` |
| `M37-04-REVIEW-CHECKLIST` | **1.0.3** | M37-04 レビューチェックリスト（確定反撃候補の初段発生） | `docs/instructions/reviews/M37-04-review-checklist.md` |
| `M37-05` | **1.0.0** | 指示書 M37-05: 始動位置のマス数の不変条件（`P-60` の決着） | `docs/instructions/M37-05-position-mass-null-invariant.md` |
| `M37-05-COMPLETION` | — | M37-05 完了報告: 始動位置のマス数の不変条件（`P-60` の決着） | `docs/progress/M37-05-completion-report.md` |
| `M37-05-REVIEW-CHECKLIST` | **1.0.0** | M37-05 レビューチェックリスト（始動位置のマス数の不変条件） | `docs/instructions/reviews/M37-05-review-checklist.md` |
| `M37-06` | **1.1.0** | 指示書 M37-06: modifier の項目確定と表現形式（`B04` / `B05` の未了分） | `docs/instructions/M37-06-modifier-set-and-display.md` |
| `M37-06-REVIEW-CHECKLIST` | **1.1.0** | M37-06 レビューチェックリスト（modifier の項目確定と表現形式） | `docs/instructions/reviews/M37-06-review-checklist.md` |
| `M37-07` | **1.2.0** | 指示書 M37-07: 始動技の持続当てを重複判定キーへ加える | `docs/instructions/M37-07-starter-meaty-key.md` |
| `M37-07-REVIEW-CHECKLIST` | **1.2.0** | M37-07 レビューチェックリスト（始動技の持続当てを重複判定キーへ） | `docs/instructions/reviews/M37-07-review-checklist.md` |
| `M37-DESIGN-01` | **1.2.0** | M37-DESIGN-01: modifier 12 値の棚卸しと「出し方メモ」の被覆調査 | `docs/handover/M37-DESIGN-01-modifier-and-execution-notes-coverage.md` |
| `M37-OVERVIEW` | **1.14.0** | M37 overview — リリース前要望の束（`A` 運び量 UI ＋ `B01`〜`B15`） | `docs/instructions/M37-overview.md` |
| `M37-RESEARCH-01` | **1.0.0** | RESEARCH 指示書 M37-RESEARCH-01: リリース前要望の実査（`A` の配線 ／ `B05` ／ `B06` ／ `B11`） | `docs/instructions/M37-RESEARCH-01-request-batch-survey.md` |
| `M38-01` | **1.1.0** | 指示書 M38-01: 新規登録・編集の必須と値域の是正（矢印 ／ 並び ／ 必須の入れ替え ／ 不問 ／ ヒット種別） | `docs/instructions/M38-01-combo-editor-required-and-domain.md` |
| `M38-01-REVIEW-CHECKLIST` | **1.1.0** | M38-01 レビューチェックリスト（新規登録・編集の必須と値域の是正） | `docs/instructions/reviews/M38-01-review-checklist.md` |
| `M38-02` | **1.2.0** | 指示書 M38-02: 技編集をメニューから外し、「引っ越し取込」を「他から引っ越し」へ改名する | `docs/instructions/M38-02-moves-grid-hide-and-rename.md` |
| `M38-02-REVIEW-CHECKLIST` | **1.2.0** | M38-02 レビューチェックリスト（技編集の導線除去 ＋ 改名） | `docs/instructions/reviews/M38-02-review-checklist.md` |
| `M38-03` | **1.1.0** | 指示書 M38-03: 説明書へ画像を貼り込み、macOS の名前を寄せ、検査を表へ載せる | `docs/instructions/M38-03-manual-images-and-macos-naming.md` |
| `M38-03-REVIEW-CHECKLIST` | **1.1.0** | M38-03 レビューチェックリスト（説明書の画像貼り込み ＋ macOS の名前寄せ ＋ 検査の表載せ） | `docs/instructions/reviews/M38-03-review-checklist.md` |
| `M38-OVERVIEW` | **1.4.0** | M38 overview — 撮影で出たリリース前要望の第 2 束 | `docs/instructions/M38-overview.md` |
| `M39-01` | **1.1.0** | 指示書 M39-01: `startup_basis` の不変条件の是正（新系列への折り込み ＋ CSV 6 行 ＋ 常設ガード） | `docs/instructions/M39-01-startup-basis-invariant-fix.md` |
| `M39-01-REVIEW-CHECKLIST` | **1.1.0** | M39-01 レビューチェックリスト（`startup_basis` の不変条件の是正） | `docs/instructions/reviews/M39-01-review-checklist.md` |
| `M39-02` | **1.0.0** | 指示書 M39-02: ラッシュ版の生成経路が実行時に `D-187` を破る穴を塞ぐ | `docs/instructions/M39-02-rush-variant-invariant-fix.md` |
| `M39-02-REVIEW-CHECKLIST` | **1.0.0** | M39-02 レビューチェックリスト（ラッシュ版の生成経路が実行時に `D-187` を破る穴） | `docs/instructions/reviews/M39-02-review-checklist.md` |
| `M39-OVERVIEW` | **1.3.0** | M39-overview: `startup_basis` の不変条件の是正（**`D-187` の 132 行 ＋ 常設ガード化**） | `docs/instructions/M39-overview.md` |
| `M4-OVERVIEW` | 1.1.3 | M4 サブマイルストーン マップ | `docs/instructions/phase1/M4-overview.md` |
| `M4-TO-M5-HANDOVER` | 1.0.0 | M4 → M5 Handover: セットプレイ系完了から コンボ比較系開始へ | `docs/handover/phase1/m4-to-m5-handover.md` |
| `M5-OVERVIEW` | 1.0.1 | M5 マイルストーン全体像(M5-overview): コンボ比較系 | `docs/instructions/phase1/M5-overview.md` |
| `M5-TO-M6-HANDOVER` | 1.0.0 | M5 → M6 引き継ぎ資料(m5-to-m6-handover) | `docs/handover/phase1/m5-to-m6-handover.md` |
| `M6-OVERVIEW` | 1.0.0 | M6 マイルストーン全体像(M6-overview): 初期体験系 | `docs/instructions/phase1/M6-overview.md` |
| `m6-to-m7-handover` | 1.0.0 | M6 → M7 引き継ぎ事項 | `docs/handover/phase1/m6-to-m7-handover.md` |
| `M7-DESIGN-SESSION-HANDOVER` | 1.0.0 | M7 期間 設計セッション継承資料(m7-design-session-handover) | `docs/handover/phase1/m7-design-session-handover.md` |
| `M7-OVERVIEW` | 1.0.1 | M7 マイルストーン全体像(M7-overview): 仕上げ + フェーズ 1 完了 | `docs/instructions/phase1/M7-overview.md` |
| `M7-RESEARCH-01-REPORT` | 1.0.0 | 指示書 M7-RESEARCH-01: shadcn/ui 統一導入の前提調査(自作ラッパー UI コンポーネントの網羅) | `docs/instructions/phase1/M7-RESEARCH-01-shadcn-ui-implementation-check.md` |
| `M7-RESEARCH-01-REPORT` | — | M7-RESEARCH-01 調査結果レポート | `docs/progress/phase2/M7-RESEARCH-01-report.md` |
| `M7-RESEARCH-02-REPORT` | 1.0.0 | 指示書 M7-RESEARCH-02: M1〜M4 レスポンシブばらつき調査(R-1 持ち越し対応) | `docs/instructions/phase1/M7-RESEARCH-02-responsive-variability-check.md` |
| `M7-RESEARCH-02-REPORT` | — | M7-RESEARCH-02 調査結果レポート | `docs/progress/phase2/M7-RESEARCH-02-report.md` |
| `m8-to-m9-handover` | 1.2.0 | M8 → M9 引き継ぎ事項 | `docs/handover/phase2/m8-to-m9-handover.md` |
| `M9-TO-M10-HANDOVER` | — | M9 → M10 引き継ぎ（設計担当チャット継続用） | `docs/handover/phase2/m9-to-m10-handover.md` |
| `MIGRATION-LICENSE-REVIEW-20260905` | — | マイグレーション ライセンス割当 レビュー表（2026-09-05） | `docs/progress/20260905-migration-license-assignment.md` |
| `MILESTONE-STARTUP-GUIDE` | — | マイルストーン開始ガイド(開発者向け) | `docs/human-notes/milestone-startup-guide.md` |
| `MODEL-ALLOCATION` | **1.47.0** | マイルストーン別モデル配分 | `docs/human-notes/model-allocation.md` |
| `MODEL-UPGRADE-OPS` | 1.0.0 | モデル更新時の運用手順 | `docs/process/model-upgrade-ops.md` |
| `PARALLEL-BOARD` | **v2.536.0** | 並列運用ボード（parallel-board）— 状態の正本 | `docs/process/parallel-board.md` |
| `PARALLEL-EXEC-GUIDE` | 1.0.0 | 並列実行ガイド(開発者向け運用メモ) | `docs/human-notes/parallel-execution-guide.md` |
| `PHASE2-E2E-PLAYWRIGHT-HANDOVER` | 1.0.0 | フェーズ2 E2E 自動化（Playwright 前倒し）検討 引き継ぎ書 | `docs/handover/phase2/phase2-e2e-playwright-handover.md` |
| `PHASE2-KICKOFF-DESIGN-SESSION-HANDOVER` | 1.0.0 | フェーズ2 キックオフ期間 設計セッション間引き継ぎ書（phase2-kickoff-design-session-handover） | `docs/handover/phase2/phase2-kickoff-design-session-handover.md` |
| `phase2-kickoff-handover` | 1.0.0 | 整理工程 → フェーズ2 キックオフ 引き継ぎ事項 | `docs/handover/phase2/phase2-kickoff-handover.md` |
| `PHASE3-TO-PHASE4-HANDOVER` | **1.1.0** | フェーズ3 → フェーズ4 引き継ぎ書 | `docs/handover/phase3-to-phase4-handover.md` |
| `PROC-001` | — | 夜間・外出先運用 改善提案書(remote-ops-proposal) | `docs/process/remote-ops-proposal.md` |
| `PROC-002` | — | リモート運用手順書(remote-ops)— 外出先・夜間運用の正本 | `docs/process/remote-ops.md` |
| `PROGRESS-DOC-RESPONSIBILITY-RULINGS-20260811` | — | progress 資料の責務整理 — 裁定 5 件（2026-08-11） | `docs/progress/20260811-progress-doc-responsibility-rulings.md` |
| `PROGRESS-LOG` | — | 進捗ログ | `docs/progress/progress-log.md` |
| `PROGRESS-SUMMARY` | — | 進捗サマリ(progress-summary) | `docs/progress/progress-summary.md` |
| `PROMPT-RULE-AUDIT-20260810` | — | プロンプト・ルール体系監査 レポート（工程改善 第一波） | `docs/progress/20260810-prompt-rule-audit.md` |
| `REQ-001` | **2.30.0** | SF6 コンボマネージャー 要件定義書 | `docs/design/requirements.md` |
| `RETRO-001` | — | 要件定義〜基本設計フェーズ 反省会レポート | `docs/human-notes/archive/postmortem/retro-001.md` |
| `RETRO-002` | x.y.z | 実装準備工程(M1)反省会レポート | `docs/human-notes/archive/postmortem/retro-002-M1.md` |
| `RETROSPECTIVE-LOG` | — | 設計担当ミス累積記録(retrospective-log) | `docs/handover/retrospective-log.md` |
| `ROLES-AND-ROUTING` | — | 登場人物と宛先表（roles-and-routing） | `docs/handover/roles-and-routing.md` |
| `SESSION-PROMPT-20260908-IMPROVEMENT-D1-D2` | **1.0.0** | 改善レーン `D1`〜`D2` 投入プロンプト（**マーカー検査の新設 ＋ 旧ポートの雛形**） | `docs/handover/session-prompts/20260908-improvement-lane-d1-d2.md` |
| `SESSION-PROMPT-20260912-CHORE` | **1.0.0** | chore レーン投入プロンプト: 教訓のバッチ反映 ＋ 派生資料メンテ（2026-09-12） | `docs/handover/session-prompts/20260912-chore-lane-derived-docs-and-retrospective.md` |
| `SESSION-PROMPTS-INDEX` | — | 別セッション投入プロンプト置き場（session-prompts） | `docs/handover/session-prompts/README.md` |
| `SUPP-001` | **1.77.0** | 設計補足資料 | `docs/design/supp-001-detailed-design.md` |
| `TRANSPORT-AUDIT-20260725` | — | 搬送段(設計成果物の disk 着地)総点検レポート | `docs/progress/transport-audit-20260725.md` |
| `WORKTREE-SCRIPTS-GUIDE` | 1.1.0 | git worktree スクリプト + 並列コマンド ガイド(開発者向け運用メモ) | `docs/human-notes/worktree-scripts-guide.md` |
| ``M27-01-report`（★当初 `M27-01-hit-type-proposal.md` としたが、`check-doc-inventory` の型「サブ単位のレポート」に合わせて改名した。`phase4-overview` §8.5.2 が名指しした形であり、`M26-01` も同じ 2 本立てである）` | — | M27-01 段 1 成果物: ヒット種別の列挙の確定案と画面モック | `docs/progress/M27-01-report.md` |
| `バージョン` | — | docs-map.md(自動生成 — **手編集禁止**) | `docs/handover/docs-map.md` |
| `実パス` | — | M19 独立監査レポート: 設計書バージョン整合 ＋ M19-01 実装レビュー | `docs/progress/M19-audit-20260725.md` |

---

## 2. ディレクトリ別 役割マップ

> フォルダによって粒度が異なる: **design / handover はファイル単位**で役割(タイトル)を示し、
> change-notes / instructions / progress 等は **フォルダの役割**のみ示す。各バックアップ
> (`archive/` `phase{N}/`)は軽く件数のみ触れる。役割はタイトル準拠で、手書き概要は持たない。

### `docs/design/` — 設計書本体(プロジェクト恒久・真の情報源)

- `01-tech-stack.md` — 技術スタック選定書 (DES-001 v**1.9.0**)
- `02-architecture.md` — アーキテクチャ設計書 (DES-002 v**1.100.0**)
- `03-data-model.md` — データモデル設計書 (DES-003 v**1.82.0**)
- `04-notation-spec.md` — 内部表現仕様書 (DES-004 v**1.35.0**)
- `05-screen-design.md` — 画面設計書 (DES-005 v**2.125.0**)
- `06-validation.md` — バリデーション設計書 (DES-006 v**1.50.0**)
- `requirements.md` — SF6 コンボマネージャー 要件定義書 (REQ-001 v**2.30.0**)
- `supp-001-detailed-design.md` — 設計補足資料 (SUPP-001 v**1.77.0**)
- `testid-convention.md` — test-id 規約

### `docs/handover/` — 引き継ぎ・恒久運用資料(設計担当の参照元)

- `20260909-claude-feature-autonomy-report.md` — Claude 最新機能キャッチアップ調査レポート — 自律化の次の一手（2026-09-09）
- `M19-DESIGN-01-central-requirements.md` — M19-DESIGN-01: 派生技フレームモデルへの利用側要件（中央向け）
- `M19-DESIGN-02-suggestion-logic.md` — M19-DESIGN-02: セットプレイ自動提案ロジック 設計確定案
- `M19-DESIGN-03-des-reflection-points.md` — M19-DESIGN-03: DES 反映要点（中央反映用・直接改訂はしない）
- `M19-DESIGN-04-handoff-to-instruction.md` — M19-DESIGN-04: M19 指示書担当への引き渡し要点（M19-01 指示書化の入力）
- `M19-DESIGN-05-startup-moves-frame-model.md` — M19-DESIGN-05 スタートアップ指示: moves フレーム計上モデル（チェーンキャンセル＋派生技 basis）
- `M19-DESIGN-06-setplay-condition-record.md` — M19-DESIGN-06: セットプレイ成立条件の記録 — データモデルと画面設計（確定案）
- `M19-DESIGN-07-frame-cost-model.md` — M19-DESIGN-07: moves フレーム計上モデル確定案（チェーンキャンセル＋派生技 basis＋空中到達 統合設計）
- `M19-DESIGN-08-exclusion-predicates.md` — 設計判断: 除外述語の決着（保留 P-16 / P-18 / TP-01）— M19-05 の前提 (**M19-DESIGN-08**（暫定。採番は M19-overview §3 の慣行に従う） v**1.3.0**)
- `M19-DESIGN-09-game-update-followup.md` — 設計判断: ゲーム側アップデートへの追従 — 割り込み判断と設計判断 4 点 (**M19-DESIGN-09** v**1.0.0**)
- `M37-DESIGN-01-modifier-and-execution-notes-coverage.md` — M37-DESIGN-01: modifier 12 値の棚卸しと「出し方メモ」の被覆調査 (M37-DESIGN-01 v**1.2.0**)
- `SF6セットプレイ-ドメイン知識集成.md` — SF6 セットプレイ ドメイン知識集成（開発者インプット最終確定版）
- `architecture-patterns.md` — 確立アーキテクチャパターン(architecture-patterns) (ARCHITECTURE-PATTERNS)
- `change-number-registry.md` — CHANGE 番号運用レジストリ(change-number-registry) (CHANGE-NUMBER-REGISTRY)
- `cleanup-assistant-prompt.md` — ドキュメント整理担当 Claude へのスタートアップ指示
- `code-facts.md` — code-facts.md(自動生成 — **手編集禁止**)
- `design-instruction-playbook.md` — 詳細設計・指示書作成 Playbook (DESIGN-INSTRUCTION-PLAYBOOK v**2.53.0**)
- `docs-map.md` — docs-map.md(自動生成 — **手編集禁止**) (バージョン)
- `followup-backlog.md` — 後続課題バックログ（followup-backlog・フェーズ3・マイルストーン横断の生きた計画資料） (FOLLOWUP-BACKLOG（フェーズ3・phase2 版から継承）)
- `m19-close-report.md` — M19 クローズ報告（セットプレイ自動提案・reorg②） (M19-CLOSE-REPORT v**1.1.0**)
- `m19-to-m20-handover.md` — M19 → M20 設計引き継ぎ書（design handover）
- `m21-to-m22-handover.md` — M20 / M21 → M22 引き継ぎ書 (M21-TO-M22-HANDOVER)
- `m22-close-report.md` — M22 クローズ報告（協調基盤 — 簡易ログイン・楽観排他・QR・CORS/CSRF） (M22-CLOSE-REPORT v**1.0.0**)
- `m23-close-report.md` — M23 クローズ報告（データバージョン管理 — `FR601`・ゴミ箱／復元の拡充） (M23-CLOSE-REPORT v**1.0.0**)
- `m24-close-report.md` — M24 クローズ報告（UX 整理・i18n・繰越・リファクタ ＋ 蓄積した改善要望） (M24-CLOSE-REPORT v**1.1.0**)
- `phase2-to-phase3-handover.md` — フェーズ2 完了 → フェーズ3 引き継ぎ(phase2-to-phase3-handover)
- `phase3-to-phase4-handover.md` — フェーズ3 → フェーズ4 引き継ぎ書 (PHASE3-TO-PHASE4-HANDOVER v**1.1.0**)
- `retrospective-digest.md` — 設計担当ミス 蒸留版(retrospective-digest)
- `retrospective-log.md` — 設計担当ミス累積記録(retrospective-log) (RETROSPECTIVE-LOG)
- `roles-and-routing.md` — 登場人物と宛先表（roles-and-routing） (ROLES-AND-ROUTING)

- (archive) `docs/handover/archive/` — 過去マイルストーンの引き継ぎ書アーカイブ(4 件)
- (archive) `docs/handover/phase1/` — phase1 の引き継ぎ書アーカイブ(14 件)
- (archive) `docs/handover/phase2/` — phase2 の引き継ぎ書アーカイブ(11 件)
- (archive) `docs/handover/phase3/` — phase3 の引き継ぎ書アーカイブ(25 件)

### `docs/change-notes/` — 設計変更の通知・レポート置き場

- 設計変更通知書 `CHANGE-{番号}-{サブマイルストーン番号}-{概要}.md` と
  完了レポート `change-report-{番号}.md` の置き場。
  直下 276 件。
- (archive) `docs/change-notes/phase1/` — phase1 の変更通知書・レポートのアーカイブ(28 件)
- (archive) `docs/change-notes/phase2/` — phase2 の変更通知書・レポートのアーカイブ(60 件)

### `docs/instructions/` — 指示書置き場

- マイルストーン指示書 / 調査指示書(`*-RESEARCH-*`) / `*-overview.md` の置き場。
  直下 165 件。
- `docs/instructions/reviews/` — レビューチェックリストの置き場(122 件)。
- `docs/instructions/templates/` — 指示書・チェックリスト・通知書のテンプレート置き場(10 件)。**プレースホルダ ID を持つため §1 の逆引き表には出さない。実パスで開くこと。**
- (archive) `docs/instructions/phase1/` — phase1 の指示書・レビューのアーカイブ(92 件)
- (archive) `docs/instructions/phase2/` — phase2 の指示書・レビューのアーカイブ(42 件)
- (archive) `docs/instructions/phase3/` — phase3 の指示書・レビューのアーカイブ(81 件)

### `docs/progress/` — 進捗・レビュー・調査結果置き場

- `progress-log.md` / `progress-summary.md`、各マイルストーンのレビュー結果、`*-RESEARCH-*-report.md`(調査結果)の置き場。
  直下 299 件。
- (archive) `docs/progress/phase1/` — phase1 の進捗・レビュー・調査のアーカイブ(41 件)
- (archive) `docs/progress/phase2/` — phase2 の進捗・レビュー・調査のアーカイブ(27 件)
- (archive) `docs/progress/phase3/` — phase3 の進捗・レビュー・調査のアーカイブ(62 件)

### `docs/human-notes/` — 開発者向け運用ノート(設計担当の参照対象はほぼ無し)

- 大半は開発者向けのため本マップでは省略(起動キット類・ガイド類・archive を含む)。
- 例外(設計担当も参照): `model-allocation.md` — マイルストーン別モデル配分
