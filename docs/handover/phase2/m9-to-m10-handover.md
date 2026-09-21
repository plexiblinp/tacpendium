# M9 → M10 引き継ぎ（設計担当チャット継続用）

| 項目 | 内容 |
|------|------|
| 文書ID | M9-TO-M10-HANDOVER |
| 種別・管理 | リポジトリ管理・自由改訂の引き継ぎ資料（`docs/handover/`）。CHANGE 対象外。チャット肥大化に伴う**設計担当チャットの引き継ぎ**用。M9-04 完了・M10 着手に応じて新チャットが更新。 |
| 作成者・作成日 | 設計担当 Claude（フェーズ2 継続担当・M9 スパイン）/ 2026-06-14 |
| 状態 | **M9-04 実装・レビュー完了**（開発者 E2E ＝完了ゲートが残）。CHANGE-034/035 反映済み。M9 は M9-04 で終了予定（E2E 通過で M9 完了）。 |

---

## 0. このチャットの役割（新担当へ）

あなたは **設計担当 Claude**（`design-instruction-playbook.md` §1）。製造（Claude Code）・レビューは別チャット。あなたの仕事は: Claude Code 指示書 + レビューチェックリストの作成、CHANGE 通知書の起票・反映、製造の Plan Mode 質問への回答、レビュー/E2E 支援。**実機確認（E2E）が完了の必須ゲート**（レビュー承認 ≠ 完了承認）。

### 守るべき運用（要点）
- **CHANGE 対象は REQ-001 + DES-001〜006 のみ**。SUPP/playbook/overview/handover/instruction/checklist/registry/backlog は自由改訂（CHANGE 不要）。
- **想定で書かない、必ず引く**（code-facts 等で裏取り。SQL/実コードは製造の Plan Mode に委ねる）。
- **CHANGE 承認前に DES 本体を先行編集しない**（playbook §1.3）。承認が実装着手のゲート、反映完了は実装と並列可、Plan Mode は承認前でも可。
- **反映ワークフロー**（playbook §16.4）: DES 改訂 → change-report → registry、すべて `/mnt/user-data/outputs/` に出力し present_files で提示。
- Plan Mode / レビュー Q&A 由来のドキュメント更新は**全件確定までバッチ**（開発者の好み）。
- ファイル名は大文字 M（`M9-04-instruction.md` 等）。
- **マイルストーン構造を勝手に拡張しない**（M9-05/M9-06 を新設して指摘された経緯あり＝後述 retro）。新サブマイルストーンや独立 overview を増やす前に開発者と合意する。

---

## 1. 現在地（2026-06-14）

- **M9（公式データ取込パイプライン）= M9-01〜M9-04。M9-04 で終了**（開発者確定）。
  - M9-01（FR701 取込ツール・別バイナリ・別チャット管理）: 完了。
  - M9-02（FR704 アプリ側取込）: **検収完了**（実装・レビュー・実機ゲート通過）。
  - M9-03（FR703 手動修正・編集グリッド・ラッシュ生成）: **検収完了**（実装・レビュー・開発者 E2E 通過）。
  - **M9-04（FR703 編集グリッド仕上げ・微修正）: 進行中**。指示書 `M9-04-instruction.md` v1.0.1 投入済み。スコープ = B-4 要確認再導出 + B-2-light（ラッシュボタン非活性化・表示順）。設計は `M9-overview §12`。

## 2. このチャットの残作業（新担当が引き継ぐ）

> 進捗（2026-06-14）: M9-04 は **Plan Mode 確定・実装・レビュー完了**。CHANGE-034/035 反映済み。**残るは開発者 E2E（完了ゲート）→ M9 完了処理 → M10**。

1. **M9-04 Plan Mode 支援 ＝完了**（接地点=warnings 加算 / 判定一致=movesimport 共有。指示書 v1.0.2 §3.4 に確定）。
2. **CHANGE-034・035 起票・反映＝完了**（2026-06-14）: 034=MoveResponse に warnings 加算（DES-002 v1.18.0）+ DES-005 §5.18 要確認強調全種・表示順（v2.19.0）。035=unknown_properties 非パリティ脚注（DES-002 v1.19.0、取込済み行では再導出ほぼ発火せず＝PATCH 値域外の防御検出）。**次回採番 036**。
3. **実装・レビュー＝完了**（製造裁量 5 件はすべて等価/改善＝retro M9-6。`M9-04-review-checklist.md` v1.0.0）。**開発者 E2E（完了ゲート）が残**＝必要に応じ支援。
4. **E2E 通過後（M9 完了処理）**: retrospective-log を M9 完了で更新、`M9-overview §11/§12` を完了済みへ、本ハンドオーバを「M9 完了・M10 へ」に更新。
5. **M10 着手の策定**（`phase2-overview.md` 参照）。M9 は M9-04 で閉じる。
6. **コミット運用の注意（再発、retro M9-6 / 申し送り A-3）**: 製造の `git add -A` で設計担当の未コミット DES/CHANGE/指示書/handover が製造コミット（M9-04=`3304c54`、M9-03=`e557fe9`）に同梱される事象が 2 連続。内容は無改変だが、コミット境界の物理分離（別ブランチ/ワークツリー、add 範囲確認）を開発者と検討（開発者 git 課題 B-3）。

## 3. M9 外の後続（M9 のサブにしない・記録済み）

`m9-03-followup-backlog.md`（`docs/handover/`）に永続記録。**旧称 M9-05/M9-06 は撤回**（M9 は M9-04 で終了のため）。M10 との前後は優先で別途判断。
- **B-1 命名クラスタ**（official_ja_move 編集可否〔DES-004 §2.1 read-only 整理〕+ ラッシュ命名 + 投げ命名）。**生成 rush が無名（コード表示）の UX 課題**の解消先。
- **B-2-heavy moves 手動 CRUD**（行追加/削除/コピー + 新規行 code/category 編集 + 検証ガード B-6）。**DES-003 §616「マスタは上書き管理・論理削除なし」との共存**が設計の山。新規 POST/DELETE。
- **B-3 フレーム計算式（開発者ドメイン課題・並行）**: ラッシュ版は全フレーム変化＝変換式の特定が必要。ジャンプ技は決定可能。解け次第 B-1・要確認自動解消へ。
- **B-5 複数 CSV/フォルダ一括取込**（低）。

## 4. 引き継ぐ主要な確定事項（詳細は各 DES / backlog）

- **total 算出式**（CHANGE-028, DES-003 §3.3）: `total = 発生 + 持続 − 1 + 硬直`。recovery 分岐は整数→式 / 「全体 N」→N直接 / 「着地後N」「不明」→NULL+要確認+FR703 手動。
- **model.Move / MoveListItem**（M8-A4）: GET 読取路は不変（開発者確定）。重複保持は後続集約として延期、乖離検出ガード（`MoveListItem→model.Move` 方向の単体テスト）で同期漏れ検出。`MoveDetail`（model.Move 埋め込み）は自動追従でガード対象外。
- **raw_data 確定キー**（CHANGE-030, DES-003 §3.3）: notes/notes_tool/command/condition_ja/condition_en/properties_extra/import_notes。
- **取込責務分担**（CHANGE-030, DES-002 §7.5）: FR701 ツールが一次正規化、本体 FR704 は防御二重化。TOOL-002 側はツールチャットで整合済み（v1.2.6）。
- **編集 API**（CHANGE-031/032）: `PATCH /api/moves/:id`（部分更新・フル返却）、`POST /api/moves/:id/rush-variant`（category∈{normal,unique}∧is_aerial=false 強制・`rush_<code>`・**重複 409+既存 id**・rush_code 占有ベース）、`GET /api/moves/:id`（単一フル）。**楽観ロックなし（last-write-wins）**。
- **name_ja**（CHANGE-032, Q3）: official_ja_move 組み込みプリセットは DES-004 read-only。**編集スコープ外＝表示のみ**。よって**生成 rush は M9-03 で無名**（既知制約、B-1 で解消）。
- **編集グリッド画面18**（CHANGE-031/033）: 取込プレビュー画面17 とは別系統。ナビ導線は主要ナビ非掲載・「設定」配下（CHANGE-033）。
- **M9-04 要確認再導出**（CHANGE-034 見込み）: warnings を読取時算出して MoveResponse に加算（§2-2）。
- **seed**（M9-02, Option 1）: 000014 は加算のみ（破壊的クリア・test/seed 分離は M12-02 へ）。過渡的に旧 seed と取込データが共存（テストは旧コードで通過）。M12-02 申し送りは `M9-overview §5`。

## 5. ドキュメント現況（`/mnt/user-data/outputs/`、配置先は `docs/` 系）

- 設計書本体（CHANGE 管理）: REQ-001 / DES-001 / DES-002（02-architecture）**v1.19.0** / DES-003 **v1.20.0** / DES-004 / DES-005（05-screen-design）**v2.19.0** / DES-006。
- 自由改訂: SUPP-001 / design-instruction-playbook / **M9-overview v0.5.0**（§12 に M9-04 統合）/ **model-allocation v1.13.0** / **change-number-registry v1.22.0**（次回採番 **036**、欠番 008/009/014）/ **retrospective-log v1.0.35** / **m9-03-followup-backlog**（docs/handover）/ phase2-overview / progress-summary。
- M9-04: `M9-04-instruction.md` v1.0.1 / `M9-04-review-checklist.md` v1.0.0。
- CHANGE: 028〜035 反映済み（034=warnings 加算 / 035=unknown_properties 非パリティ脚注）。**次回 036**。
- 製造側の一時申し送りは `tmp/`（.gitignore）にあり散逸する。設計関連は backlog に取り込み済み。

## 6. アップロード元資料

読み取り専用の元設計資料は `/mnt/user-data/uploads/`（requirements.md, 01〜06, supp-001, playbook, retrospective-*, code-facts, architecture-patterns, change-number-registry, progress-summary, phase2-overview, model-allocation, CLAUDE.md, 各 CHANGE/handoff 等）。最新版は `/mnt/user-data/outputs/` の改訂後ファイルを正とする。

## 7. retro（新担当が retrospective-log へ取り込み済みなら不要）

- **マイルストーン構造の独断拡張**: M9-03 後続課題のマイルストーン化で、設計担当（私）が **M9-05/M9-06 を勝手に新設し独立 M9-04-overview も作成**したが、開発者の認識（M9 は M9-04 で終了）と齟齬。開発者の確認で是正（M9-05/06 撤回、overview は M9-overview §12 に統合）。教訓: **マイルストーン構造・新規 overview の増設は、設計担当が独断せず開発者と合意してから**。後続課題は backlog に記録し、マイルストーン化は都度合意する。

---

*以上、M9 → M10 引き継ぎ v1.0.0（M9-04 進行中時点）*
