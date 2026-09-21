# future-notes INDEX（棚卸しと正本指針）

作成: 2026-07-02（改善レーン・実整理は開発者承認済み）。
新しいファイルを置いたら本 INDEX に1行追加すること。役目を終えたら `archive/` へ。

## 正本指針（どれが「生きている正」か）

- **未決事項の正本 = `combmgr-pending-decisions.md`**（🔴🟡⚪🔵⏳✅➡️ のステータス体系）。
  旧 `combmgr-open-issues.html` は役割重複のため archive/ へ退避済み。
- **マイルストーン割付の正本 = `docs/instructions/phase3-overview.md`**（v1.0.0 承認済み）。
  本フォルダの計画系メモ（reorg/replan）は同書に吸収済み → archive/。
- **連携技（pressure sequence）の正本 = `combmgr-pressure-sequence-consolidated.md`**。
  派生2本（論理草案・設計プロンプト）は内容包含済みのため archive/。

## 生きているファイル

### 意思決定・バックログ

| ファイル | 役割 |
|---|---|
| `combmgr-pending-decisions.md` | 未決事項スナップショット（**未決の正本**） |
| `combmgr-improvement-lane-fable-report.md` | 改善レーン第一弾（2026-07-02）の引き継ぎ報告書。発見・要判断の詳細と資料不整合レポート |
| `combmgr-improvement-lane-fable2-report.md` | 改善レーン第二弾（2026-07-03）の引き継ぎ報告書。B8/B9/B10 修正・M番号同期・監査コマンド新設の記録＋**未実行分の下位モデル向け実装手順書（§2）** |
| `combmgr-offdesk-lane-backlog.md` | 外出レーン（机外時間）の調査タスクキュー。※「5テーマ追記」のうち実質必要な①②⑤は 2026-07-02 改善レーンで追記済み |
| `combmgr-creator-pivot-summary.html` | 発信者中心戦略の背景（市場構造） |
| `combmgr-creator-benefits.md` | 発信者の乗り換え便益考察（🟡実機検証待ち） |
| `combmgr-fable-improvement-prompt.md` | 改善レーン(一週間の最上位モデル窓)へ投入した起動プロンプトの原本(相談役作成。2026-07-19 相談役チャットからマージ) |
| `combmgr-design-memo-index.md` | 2026-07-27 相談セッションの成果物一覧・横断正本・判断基準をまとめた索引 |

### マイルストーン設計素材（M15〜）

| ファイル | 役割 | 行き先 |
|---|---|---|
| `combmgr-friend-feedback-datamodel-issues.md` | friend FB 起点のデータモデル4論点 | M16 の承認ゲート素材 |
| `combmgr-punish-finder-spec-draft.md` | 確定反撃 仕様イメージ。**注意: §2(materialize=別コンボ登録)と §8/付録(表示のみ)が文書内で矛盾したまま。phase3-overview M18 は旧「表示のみ」を参照。M18 着手前に要確定** | M18 |
| `combmgr-pressure-sequence-consolidated.md` | 連携技の検討集約（**正本**）。**注意: phase3-overview の M13〜M23 に割付が無い=未マイルストーン化** | 未割付（要判断） |
| `combmgr-command-resolution-request.md` | コマンド入力解決（簡易版）依頼。スタンドアロン正 | M15/M21 近辺 |
| `combmgr-prompt-punish-finder.md` | 確反 汎用計算モジュールの自律開発プロンプト | M18 の土台 |
| `combmgr-prompt-moves-input-tool.md` | moves 手入力支援ツール（M14-03b/M17 取込ヘルパーの前提） | M14-03b/M17 |

### 法務・配布・リリース

| ファイル | 役割 |
|---|---|
| `combmgr-framedata-legal-decision.html` | フレームデータ出所・法務の最終結論（M14 配布是正の前提） |
| `combmgr-battlelog-source-decision.md` | バトルログ取込の法務決定（§8 に要確認残） |
| `combmgr-initial-notice-design.html` | 初回通知・免責表示の設計（friend-readme 等へ反映済み） |
| `combmgr-friend-release-checklist.html` | **友人**リリースの最低限チェックリスト（下記包含関係の内側） |
| `combmgr-release-checklist.html` | **知人**リリースまでのチェックリスト（friend 版の上位集合。2026-05-29 版=発信者ピボット前のため一部陳腐化疑い・再点検推奨） |
| `combmgr-update-strategy.html` | アップデート戦略（版管理/ロールバック。M22 と地続き） |

> リリース系の関係: friend-release-checklist ⊂ release-checklist。実成果物（配布 README）は
> `README.txt`（正本は `docs/usermanual/dist-readme.txt`）。
> **★2026-09-12・`M32-01`**: かつてここが指していた `docs/usermanual/combmgr-friend-readme.html` は
> `docs/usermanual/tacpendium-readme.html` へ改名し、中身を**操作説明書の器**へ差し替えた（`D-766`）。
> ⇒ 同ファイルはもう「友人向け配布 README」ではない。

### 将来機能・研究ノート

| ファイル | 役割 |
|---|---|
| `combmgr-future-features.html` | 将来機能の願望リスト（offdesk-lane の種の供給元） |
| `combmgr-features.txt` | 対外向け機能一覧。**注意: 「クラシック/モダン両対応」はモダン非対応方針（ISSUE-007・phase3-overview）と矛盾=過大表示。修正は開発者判断** |
| `combmgr-ai-feature-draft.md` | 知識管理&AI の仮設計（フェーズ4 以降・REQ とは別系統） |
| `combmgr-memo-spine-design.md` | 一人SNSメモ機能の背骨設計メモ(背骨+レンズ=AI返信/可視化。2026-06-26 作成・2026-07-19 相談役チャットからマージ。pending-decisions「確定方針：なりきり/人格プロンプト」と対) |
| `combmgr-player-comparison-design.md` | 他プレイヤー比較分析機能の設計メモ(メモ機能とは別軸の独立機能。2026-06-26 作成・2026-07-19 相談役チャットからマージ) |
| `combmgr-player-comparison-design-resolution.md` | 他プレイヤー比較分析の要設計5点を解決する差し替え資料（原メモ §9 対応） |
| `combmgr-vod-analysis-design-memo.md` | 対戦動画分析の設計メモ。動画/グループ/軸の三層構造、取り込み待ち、AI 統括の境界、体力検出 PoC を整理 |
| `combmgr-html-export-design-memo.md` | 単一ファイル HTML エクスポートの設計メモ（容れ物＋寄稿者構造） |
| `combmgr-ai-integration-design-memo.md` | AI を使う全機能の連携方式に関する横断正本（リレー先行・単一受け口・出自の扱い） |
| `combmgr-prompt-memo-foundation-draft.md` | 一人SNS知識管理プロトの自律開発プロンプト（下書き・投入前に最終確認） |
| `combmgr-prompt-damage-lethal-calc.md` | ダメージ+削りきり計算の独立ツール案（本体は FR307 で自動計算しない方針のため本体組込対象外） |
| `combmgr-persona-analysis-frameworks.html` | ペルソナ/視点分析のリサーチノート |
| `combmgr-knowledge-mgmt-resources.html` | 知識管理メソッドの学習リソース集 |
| `combmgr-performance-strategy.html` | 性能改善方針（handover 昇格候補） |
| `combmgr-dev-methodology.html` | AIオーケストレーション開発手法（handover 昇格候補） |
| `combmgr-autonomous-acceptance-criteria.md` | 自律先行実装の受入判定ルーブリック（handover/playbook 昇格候補） |

### 相談セッション由来の運用・監査資料

| ファイル | 役割 |
|---|---|
| `combmgr-parallel-process-decisions-report.md` | 2026-07-27 時点の並列運用決定事項の原版。現行正本は `docs/process/parallel-ops-decisions.md` |
| `combmgr-parallel-process-playbook-v2.html` | 2026-07-27 時点の人間向け並列運用手順書の原版。現行正本は `docs/process/parallel-ops.html` |
| `combmgr-m18-19-midstream-migration-instruction.md` | M18/M19 途中から新運用を適用した際の移行指示原版。現行版は `docs/process/m18-19-midstream-migration.md` |
| `combmgr-resource-audit-prompt.md` | リソース枯渇リスク監査をレポート限定で依頼する自律調査プロンプト |

### ライセンス戦略素材

| ファイル | 役割 |
|---|---|
| `combmgr-license-strategy-outline.md` | AGPL / CC BY-SA / MIT の三層と段階的公開モデルを整理した骨子（法的レビュー要） |

> 昇格候補3件（performance-strategy / dev-methodology / autonomous-acceptance-criteria）は
> 確立済み運用知のため `docs/handover/` への昇格を提案中（フォルダ跨ぎのため開発者判断待ち。
> pending-decisions 参照）。

## archive/（役目を終えた記録・8件）

- `combmgr-phase3-m15-replan-input.md` / `combmgr-phase3-reorg-request.md` — phase3-overview v1.0.0 に吸収済みの発信元
- `combmgr-prompt-csv-export.md` / `combmgr-prompt-csv-import.md` / `combmgr-prompt-visual-export.md` — M13 実装済みで陳腐化（冒頭に破棄記録あり）
- `combmgr-pressure-sequence-datamodel-draft.md` / `combmgr-prompt-pressure-sequence-design.md` — consolidated に内容包含
- `combmgr-open-issues.html` — pending-decisions.md に一本化
