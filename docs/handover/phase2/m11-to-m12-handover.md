# M11 → M12 引き継ぎ書(m11-to-m12-handover)

| 項目 | 内容 |
|------|------|
| 文書種別 | マイルストーン引き継ぎ書(設計担当 Claude 作成) |
| 作成日 | 2026-06-21 |
| 前マイルストーン | M11(custom_states 開始時状態の機能化)— **完了** |
| 次マイルストーン | M12(先行リリース準備の仕上げ。正本 = phase2-overview §M12) |
| 関連 | M11-overview v1.1.0 / model-allocation v1.19.0 / change-number-registry(次番号 **044**) |

---

## 1. M11 完了状態

| サブ | 内容 | 状態 |
|------|------|------|
| M11-RESEARCH-01(+FU) | custom_states/situation 現状 + 付与/表示 UI 現状の全数調査 | 完了 |
| M11-01 | custom_states 開始時状態の機能化(seed 3体 + 付与 UI + 表示)。CHANGE-040/041/042 | 完了・開発者 E2E 確認済 |
| M11-RESEARCH-02 | PATCH メタデータ更新経路の現状調査(presence/部分 PATCH) | 完了 |
| M11-02 | nullable メタデータの PATCH クリア一般化(presence-detection)。CHANGE-043 | 完了・E2E 確認済 |

反映済み CHANGE: **040**(custom_states 付与/表示 機能化 = DES-005 §5.6/§5.7 + DES-006 §2.4)/ **041**(PATCH に situation 加算 = DES-002 §4.2)/ **042**(situation `""` センチネル = DES-002 §4.2)/ **043**(PATCH クリア規約を presence-detection 単一トライステートへ一般化、042 の `""` を置換 = DES-002 §4.2)。各 change-report・registry 反映済み。

現行版: DES-002 **v1.23.0** / DES-005 **v2.22.0** / DES-006 **v1.12.0** / DES-003 v1.21.0(M11 変更なし)。

## 2. M11 で確定した設計判断(参照用)

- **D-A**: custom_states UI = 新セクション「キャラ固有状態」(独立カラム「状況」と分離・別 i18n)。
- **D-B**: Int 付与 = 自由入力 + min/max 尊重 + `-`/`e`/`.` 拒否(既存ゲージ踏襲)。専用バリデータなし。全キャラ定義をデータ駆動で先行整備。
- **D-C**: seed 投入 = 先行リリース3体(ryu=denjin_charge / ingrid=sun_crest 0–4 / c_viper=limit_decoupler)。ryu の `'{}'`→電刃 置換。aki/jamie/guile は触らない。
- **消費は非モデル化**: アプリでは構築しない(将来の利用者要望次第での検討にとどめ、現時点では実装しない)。利用者が notes 管理。
- **custom_states はメタデータ**(重複判定 VAL-C02 対象外 = DES-006 §2.4)。PATCH のメタデータ経路で編集。
- **PATCH クリア規約**(CHANGE-043): 全 nullable メタデータが presence-detection 単一トライステート(キー不在=不変更 / null=NULL クリア / 値=更新)。full-replace は部分 PATCH(昇格)の誤クリアリスク(M11-RESEARCH-02 Q6)で却下。

### 製造の独自判断(設計確認済み = 設計意図と一致)

- **B-1 presence 手段 = `Optional[T]` ジェネリック**(`internal/repository/combo/optional.go`、repo 層に定義、`model.Modifiers` の前例に倣う)。**設計意図と一致**。→ 申し送り 3-d 参照(横断昇格の検討余地)。
- **B-2 `is_draft` は `*bool` 据え置き**(非 nullable = クリア対象外。不在=不変更 / 値=更新)。**指示書 §4.1 と一致・確認 OK**。
- **B-3 起き攻め6 の挙動変更**(present+null=NULL クリア可能に。従来は不変更のみ)。**CHANGE-043 §6・指示書 §4.5 で明示済みの想定挙動・確認 OK**。

## 3. M12 への申し送り(継続課題)

### 3-a. seed 整理(M12-02 想定)★主要
- **aki/jamie/guile**(phase-1 耐久 seed 由来・先行リリース対象外)の custom_states/行は M11 で**触っていない**(D-C-2)。M12-02 の seed 整理で扱う。
- **jamie の custom_states は `drunk_level`/composite**(phase-1 seed)で、正典(Drink Level / Int 0–4、m11-custom-states-definitions §2)と乖離。M12 で jamie を再投入・正典化するか、行ごと除去するか判断。
- migration 000012 の耐久 seed 36 件(combos)の無効化も M12-02 の対象(phase2-overview §M12)。

### 3-b. seed `scope` フィールド(確定済み・将来再訪)
- 先行リリース3体は `scope` なしで**据え置き確定**(§5.2、definitions §6)。`scope` は消費セマンティクスのヒントで、**消費を構築する時点**(現状予定なし)で消費モデルと一緒に正典化する。

### 3-c. E2E 回帰ネットの穴(C-2)★設計提案
- presence-detection 化後の最大の回帰リスクは「**通常編集で触っていない項目が消える**」こと。これを検証する **E-1 相当(多項目メタデータのコンボを1項目だけ編集 → 他項目が保持される)** が既存 spec(`combo-crud.spec` は仮登録・メモ中心)の**穴**。
- 製造側で `combo-crud.spec` への E-1 アサーション追加を検討中(別途実施)。**M12 以降の E2E 拡充方針として E-1 の自動 spec 化を優先候補**に。

### 3-d. `Optional[T]` の横断昇格(B-1 将来設計)
- 現状 `Optional[T]` は combo 専用(repo 層)。他エンドポイント(setup 等)の nullable PATCH も同じトライステートを採るなら、**共有ユーティリティ(例 `internal/apiutil`)へ昇格**して再利用する設計余地がある。横断採用の方針が出た時点で検討。

### 3-e. 英語ロケール整備(フェーズ3)
- custom_states 英語名(install 表記・Drink Level 等)の英語コミュニティ整合は英語ロケール整備(フェーズ3)時に再点検(definitions §6)。本フェーズ表示は日本語が主(NFR307)。

### 3-f. 運用(開発者対応)
- **C-1**: コミット `60ca08f`(BE)に無関係な `.gitignore`(`autopilot-combomgr/` 追加)が混入。機能影響なし。コミット履歴整理は**開発者専任**(CLAUDE.md §7/§10)。以後の製造は明示パス add に切替済み。

### 3-g. retrospective への M11 教訓の追記(未了・要ファイル)
- M11 期間中、`retrospective-digest`(教訓集)への**追記は行っていない**(本セッションで編集対象として渡されておらず明示要求もなかったため)。ただし M11 には追記価値のある教訓がある:
  - **PATCH 部分更新のトライステート教訓**(CHANGE-041→042→043 の弧): フロントのみで PATCH に項目追加できると仮定したが BE の `UpdateMetadataRequest` に受け口が無く Plan Mode で発覚(041)→ `null=不変更` と「クリア意図の null 送信」の衝突でクリア不能バグ(042 で `""` センチネル暫定)→ 一般解 presence-detection(043)。**教訓**: 部分更新 PATCH に nullable 項目を足す時は DTO/repo まで経路全体を確認する/「不在・null・値」のトライステートを意識する/部分 PATCH 呼び出し元(例 `PromoteToFinalButton`)があると full-replace は採れない。
  - **局所センチネル vs 一般解の規律**: 042 の `""` 局所対処を 043 の単一規約へ昇格(スコープ規律＝報告された範囲のみ先に直し、一般化は別サブ M11-02 へ)。
  - **前向き注意の再現**(ryu の `'{}'` phase-1 前提)/ **命名衝突**(situation/独立カラム i18n、FU-4)。
- **対応**: `retrospective-digest`(または `retrospective-log`)を渡してもらえれば、上記を所定の様式で追記する。M12 セッション開始時に処理するのが自然。

## 4. M12 のスコープ(着手時に M12-overview で具体化)

- 正本 = **phase2-overview §M12**(先行リリース準備の仕上げ)。想定: 検証データ/seed 整理(M12-02)・先行リリース判定(M12-03)等。
- 着手時に M12-overview を作成し、サブユニット分割・主要設計判断・CHANGE 見込みを確定(§4.12 構造合意)。3-a/3-c が M12 の主要インプット。

## 5. 環境・運用メモ

- **次 CHANGE 番号 = 044**(欠番 008/009/014)。
- **model-allocation v1.19.0**: M11-RESEARCH-01/02 = Sonnet、M11-01/02 = Opus + Plan Mode。M12 サブは着手時記入。
- 設計書本体は設計担当が CHANGE 経由で反映、製造担当は直接編集しない(CLAUDE.md §8.3)。git/commit は開発者専任。
- 禁則表現の grep 除去は出力前の必須チェック。

---

*以上、M11 → M12 引き継ぎ書。配置 `docs/handover/m11-to-m12-handover.md`。M12 は本書 §3(特に 3-a seed 整理 / 3-c E2E 回帰ネット)を主要インプットとして着手する。*
