# CHANGE-040 通知書(ドラフト): custom_states 開始時状態の付与・表示 機能化

| 項目 | 内容 |
|------|------|
| 通知書ID | CHANGE-040 |
| サブマイルストーン | M11-01 |
| 起票日 | 2026-06-20 |
| 起票者 | 設計担当 Claude(フェーズ2 本流スパイン・M11 担当) |
| 承認者 | 開発者(承認待ち) |
| ステータス | **ドラフト(承認待ち)** |
| 影響設計書 | DES-005(v2.21.1→v2.22.0)/ DES-006(v1.11.0→v1.12.0) |

---

## 1. 変更の概要

M11(custom_states 開始時状態の機能化)に伴い、DES-005 の situation 表示・入力規定を「キャラ固有状態」の付与・表示として具体化し、DES-006 に「custom_states 入力は検証しない」方針を明示する。状態の**消費**(コンボ中の減少・レベルによる技変化・バリデーション連動)は**アプリでは構築しない**(モデル化せず、利用者が notes で管理)。将来の利用者要望次第で検討する可能性はあるが、現時点では実装しないと断言する方針(2026-06-20 開発者確定)を反映する。

## 2. 変更の理由

- phase2-overview §M11 に従い custom_states の消費(付与・表示・参照)を有効化する。
- M11-RESEARCH-01 で、DES-005 §5.7 表示項目5「situation(キャラ固有状態、動的に表示)」が**実装上未描画**(situation 入力は ComboEditor に実在せず、独立カラムのみ描画)であることが確定。規定を実装可能な具体形へ落とす必要がある。
- 既存 UI の「状況/Situation」ラベルは**独立カラム(position 等)用に占有済み**(RESEARCH FU-4)。custom_states を別概念として呼称分離する必要がある(設計判断 D-A)。
- 検証を作らない方針(D-B/Q3)を明示しないと、将来「custom_states を検証する」規定が再導入される懸念がある(retrospective-digest §3「規定なしも明示的に書く」)。

## 3. 変更の内容

### 3.1 DES-005 §5.7 表示項目5(コンボ登録・編集の状況入力)

- situation を「**キャラ固有状態**」の動的付与 UI として具体化する。独立カラム(position / opponent_stance / hit_type / opponent_size / drive_available_at_start / sa_available_at_start)とは**別セクション**(D-A=案1)。
- **データ駆動**: 選択キャラの `characters.custom_states` 定義(`states[]`)を読み、`type=flag`→トグル、`type=level`/`stock`(int)→数値入力で動的描画する。状態を持たないキャラでは本セクションを表示しない。
- **Int 入力仕様**(D-B): `value_definition.min`/`max` を入力欄の下限/上限に尊重(スピナー・手動入力とも最大超過させない)。`-` / `e` / `.` を入力不可(既存 drive_available_at_start / sa_available_at_start 入力と同方式)。専用バリデータは設けない(§3.3 と整合)。
- 付与値は `combos.situation`(TEXT, JSON)の `custom_states` キーに格納(DES-003 §3.x 既述の構造)。

### 3.2 DES-005 §5.6 表示項目4(コンボ詳細の状況表示)

- situation(custom_states)の表示を「**キャラ固有状態**」セクションとして、独立カラム「状況」から**分離**して追加する。custom_states を持つコンボのみ表示。コンボ比較画面(§5.x 比較表)にも同様の行を追加する。

### 3.3 DES-006(バリデーション)

- 「**custom_states / situation の custom_states キーは入力検証を行わない**」を明示追記する(値域・必須・型の検証を設けない。アプリでは構築せず利用者管理〔将来の利用者要望次第での検討にとどめ現時点では実装しない〕)。Int 入力欄の min/max・文字制限は UI 入力コントロール上の制約であり、バリデーション規定(VAL-*)としては設けない旨を併記。

### 3.4 DES-003(データモデル)— 変更なし

- `characters.custom_states` / `combos.situation` は既存の論理「JSON」(物理 TEXT)で M11 を表現でき、**スキーマ・構造の変更は不要**(RESEARCH §0.1)。先行リリース3体の定義(code・value_definition)・操作データは seed マイグレーションと補足資料 `m11-custom-states-definitions.md` が保持する。§3.2 の例示(`drunk_level`/composite 等)は器の表現力の例として据え置く(jamie の既存 seed と整合、D-C-2)。

## 4. 影響範囲

| 区分 | 対象 | 内容 |
|------|------|------|
| 設計書本体 | DES-005 §5.6/§5.7(v2.21.1→**v2.22.0**) | 上記 3.1/3.2 |
| 設計書本体 | DES-006(v1.11.0→**v1.12.0**) | 上記 3.3 |
| 設計書本体 | DES-003 / DES-002 / DES-004 | **変更なし**(3.4。スキーマ・API・notation 不変) |
| 派生ドキュメント | M11-overview / m11-custom-states-definitions v0.2.0 / architecture-patterns §9.1(v1.0.16 反映済み・自由改訂) | 参照のみ |
| 実装 | M11-01(seed 定義投入 + 付与/表示 UI) | CHANGE 反映後に指示書投入 |

## 5. 移行影響

- **スキーマ変更なし**(situation/custom_states は TEXT 既存)。マイグレーションは characters.custom_states への**加算的 UPDATE**(ryu の `'{}'`→`denjin_charge` 置換、ingrid/c_viper への新規投入)で、**破壊的 seed クリアを伴わない**(M12-02 へ延期の既定と整合)。
- **後方互換**: 既存コンボの `situation` は現状すべて NULL(UI 未送信・seed 投入 0、RESEARCH §0.3/§1.6)。custom_states を持たないコンボは situation=NULL のまま影響を受けない。
- データ移行: 不要(新規付与値のみ)。

## 6. リスク

- situation の round-trip(create/patch/put + 編集時読込)の経路漏れ → 保存/編集で値消失。M11-01 指示書 §3.4 で4経路を Plan Mode 確認、E2E で編集往復を検証。
- 「状況(独立カラム)」と「キャラ固有状態」の呼称・i18n キー衝突 → 別系統キーで分離。
- ryu の `'{}'`→電刃 は既存値の置換(UPDATE) → 適用後値を E2E 前提で確認。

## 7. 承認チェックリスト

- [ ] DES-005 §5.7/§5.6 の「キャラ固有状態」具体化(呼称分離・データ駆動・Int 入力仕様)で良いか。
- [ ] DES-006 への「custom_states 入力は検証しない」明示追記で良いか。
- [ ] DES-003 変更なし(スキーマ既存で足り、操作データは seed + 補足)で良いか。
- [ ] バージョン: DES-005 v2.22.0 / DES-006 v1.12.0 で良いか。

---

> 承認後、設計担当が DES-005 / DES-006 を改訂(版・ステータス更新)し、change-report-040 作成 + change-number-registry 更新(playbook §16.4)。実装指示書 M11-01 は CHANGE 反映後に投入する。

*以上、CHANGE-040 通知書ドラフト。配置 `docs/change-notes/CHANGE-040-M11-01-custom-states-activation.md`。*
