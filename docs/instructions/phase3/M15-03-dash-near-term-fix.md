# 指示書 M15-03 追補: dash 近手当て（プルダウン区分の dash を system move へ寄せる）

| 項目 | 内容 |
|------|------|
| 指示書ID | M15-03-追補（dash-near-term-fix） |
| バージョン | 1.0.0 |
| 推奨モデル | **Sonnet 4.6**（FE のみ・小規模・新規ロジックなし） |
| Plan Mode | 任意（スコープが極小のため。§3 の実在確認のみ実施） |
| 機械レビュー | 簡易（本書 §5 のチェックで足りる。別チェックリストは作らない） |
| 依存 | M15-03 本体（feature/m15-03）完了後。CHANGE-057 §7-1（近手当ての承認済み方針） |
| 想定所要時間 | 30〜60 分 |
| 作成者・作成日 | 設計担当 Claude（M15 期）/ 2026-07-04 |

---

## 0. この指示書の性格（最重要・先に読む）

**これは「dash 二重表現の一本化」ではありません。** 一本化（modifier.type dash の廃止・既存データ移行）は **M16** の data milestone で行います。本追補は、それまでの間に**新規の不整合データが生まれるのを止めるだけ**の、**フロントエンドのみ・極小スコープ**の近手当てです。

**やること（これだけ）**:
- 全技プルダウン（網羅フォールバック）の「**共通システム（移動・その他）**」区分で **`dash_forward` / `dash_back` を選んだとき、`modifiers.type` ではなく system move（`dash_forward` / `dash_back` の move）として解決**するようにする（＝`{ moveId, moveCode }` で確定）。
- これにより、共通技ボタン（SystemRow・既に system move で解決＝正）と**入力経路が一致**し、dash は常に system move で保存される。

**やってはいけないこと（スコープ厳守・逸脱は重大）**:
1. **`MODIFIER_NON_MOVE_TYPES` から `dash_forward`/`dash_back` を削除しない**（M16 で廃止する。今は定義を残す）。
2. **既存データの移行をしない**（既に `modifiers.type=dash_*` で保存されたステップの変換は M16）。
3. **`parry_drive_rush` に触れない**（これは移動でなく cancel 注釈＝`modifiers.type` のまま正）。
4. **DES 本体（DES-003/004/005・SUPP-001）を編集しない**（canonical=system move は CHANGE-057 で設計担当が反映済み。DES 改訂は設計担当の担当）。
5. **SystemRow（共通技ボタン）を変更しない**（既に system move で解決＝正しい。触ると壊す）。
6. **スキーマ・API・マイグレ・Go 側に触れない**（本件は FE のみ・非スキーマ）。
7. **他の「共通システム」区分エントリ（前入力・微歩き・ダッシュ以外の移動等）の挙動を変えない**（dash の解決先だけ）。
8. **段階1・必殺技・特殊技・ラッシュ・OD 等、M15-03 本体の実装に触れない**。

> 迷ったら**広げず、dash の解決先だけ**を直して完了報告に「dash のみ変更」と明記すること。スコープ拡大は本プロジェクトが最も警戒するアンチパターン。

---

## 1. 背景

`dash_forward`/`dash_back` は **system move**（DES-004 §2.1・category=system・CHANGE-048）と **modifier.type**（SUPP-001 §3.3.3・`MODIFIER_NON_MOVE_TYPES`）の 2 通りで併存している。M15-03 で共通技ボタン（system move）と全技プルダウンの「共通システム」区分（modifier.type）という 2 入力経路が生じ、**同じ「前/後ステップ」が経路により別データで保存され得る**（比較・共有・集計で不整合）。

canonical は **system move**（DES-004 §2.1 line 103 の「移動は 1入力=1move の独立 move。2 通り表現はデータ揺れを生むため不採用」原則）。本追補は新規の modifier.type dash 生成を止める近手当て。恒久一本化は M16（phase3-overview §M16 ④''）。

## 2. 実装

- 全技プルダウンの「共通システム（移動・その他）」区分の選択肢のうち、**`dash_forward` / `dash_back` に対応する項目の解決を system move へ変更**する。
  - 現状: 当該区分は `nonmove:<type>` エンコードで `modifiers.type` として解決している（CHANGE-057 §2）。
  - 変更後: `dash_forward` / `dash_back` は当該キャラの **`moves` から `move_code` 一致で system move を引き当て**、`{ moveId, moveCode }` のステップとして追加する（他の技ボタンと同じ解決）。
- 実装方式（マップの分岐か・区分定義側での振り分けか）は既存構成に合わせて製造裁量。**dash 以外の区分挙動は不変**。

## 3. 着手前の実在確認（§0 の逸脱防止）

1. 全技プルダウン「共通システム」区分が dash をどう解決しているか（`nonmove:dash_forward` 等のエンコード箇所）を grep で特定。
2. SystemRow の共通技ボタンが dash を system move（`{ moveId, moveCode }`）で解決していることを確認（＝寄せ先の正しい形）。
3. 当該キャラ seed に `dash_forward`/`dash_back` の system move が存在するか（現行 HEAD＝ryu 等）。無いキャラでのフォールバック（該当なしは従来どおり／選択不可）は既存 move 引き当ての挙動に合わせる。

## 4. 変更しないもの

- `MODIFIER_NON_MOVE_TYPES` の定義（`dash_forward`/`dash_back`/`parry_drive_rush` の型は残す・M16 で dash のみ廃止）。
- SystemRow・段階1・必殺技/特殊技/ラッシュ/OD・スキーマ・API・Go 側・DES 本体。
- 既存データ（移行しない）。

## 5. テスト・完了条件

- **Vitest**: 全技プルダウン「共通システム」区分で `dash_forward`/`dash_back` を選ぶと、ステップが **`moveId`+`moveCode`（system move）** で追加される（`modifiers.type` にならない）。SystemRow の dash と**同一表現**になる。
- **Vitest**: `parry_drive_rush` は従来どおり `modifiers.type` で解決（不変）。dash 以外の区分エントリも不変。
- **既存 E2E 非回帰**: `make e2e` 全通過（永続 dev DB 残渣非依存）。
- **完了報告**: 「dash（前/後ステップ）の解決先をプルダウン区分でも system move に統一。modifier.type dash の定義・parry_drive_rush・既存データ・DES・スキーマは不変」と明記。DES CHANGE 不要（canonical は CHANGE-057 で反映済み・本追補は UI 解決先の整合のみ）。

---

## 6. スコープ確認（レビュー時の重大判定）

以下は**重大**（完了承認を妨げる）:
- `MODIFIER_NON_MOVE_TYPES` から dash を削除している／既存データを移行している（＝M16 の越境）。
- `parry_drive_rush` を触っている／dash 以外の区分挙動を変えている。
- SystemRow・段階1・スキーマ・API・Go・DES 本体を触っている。
- dash がプルダウン区分で依然 `modifiers.type` で解決される（近手当て未達）。
- 既存 E2E が非回帰でない。

---

*以上、M15-03 追補 dash 近手当て v1.0.0。配置 `docs/instructions/phase3/M15-03-dash-near-term-fix.md`。極小スコープ厳守＝dash の解決先を system move に寄せるのみ。一本化・移行・DES 改訂は M16／設計担当。*
