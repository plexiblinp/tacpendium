# 指示書 M2-01: 仮想コントローラ(レバーレス)と modifiers 編集 UI 格上げ

| 項目 | 内容 |
|------|------|
| 指示書ID | M2-01 |
| バージョン | 1.3.0 |
| 対象マイルストーン | M2(編集系の本格化) |
| 推奨モデル | **Sonnet 4.6** |
| Plan Mode | **任意**(Plan Mode で計画提示すると安全だが、必須ではない) |
| 機械レビュー | **必須**(別チェックリスト: `docs/instructions/reviews/M2-01-review-checklist.md`) |
| 並列性 | **単独**(M2 は完全直列、M1 完了が前提) |
| 依存指示書 | M1-06(`RecipeBuilder.tsx`、`StepRow.tsx`、`ComboEditor.tsx` を拡張する) |
| 想定所要時間 | 90〜120 分 |
| 作成者 | 詳細設計・製造準備担当Claude(M2 期間担当) |
| 作成日 | 2026-05-07 |
| 更新日 | 2026-05-07 |

## 更新履歴

| バージョン | 更新日 | 更新内容 |
|-----------|--------|----------|
| 1.0.0 | 2026-05-07 | 初版作成 |
| 1.1.0 | 2026-05-07 | §4.2.2 / §4.4.2 修正: `drive_parry` と `throw` の moves 登録方針を案B(全キャラに code 統一でキャラ別個別レコードとして登録、drive_impact と同じ方式)に確定。これに伴い「moveが存在しない場合の例外的フォールバック」表現を排し、9種すべての技ボタンを統一的な code 検索パターンに揃えた |
| 1.2.0 | 2026-05-07 | §3.4「着手前の確認・準備作業」を新設。リュウの moves に `drive_parry` / `throw` が seed されているかを製造担当 Claude Code が着手前に確認し、不足時は新マイグレーションを作成・実行する手順を追加。これに伴い §2.1(成果物にマイグレーション追加)、§2.3(既存マイグレ修正禁止)、§2.4(マイグレ追加を条件付きで許容)、§7.1(DoD 追加)、§9.1 / §9.4、§3.1 / §8(参照ドキュメントに M1-02 追加)を修正。Plan Mode を「任意 → 必須」に格上げ |
| 1.3.0 | 2026-05-07 | SF6 仕様の正確な反映: 投げボタンの解決先が `throw`(存在しない code)ではなく `forward_throw` であることが開発者確認で判明。これに伴い §4.2.2 の throw 行を「投げボタン → `forward_throw` を解決(後ろ投げ `back_throw` は M2 では仮想コントローラから入力不可、技セレクタ経由)」に修正。同時に開発者確認により `drive_parry` / `forward_throw` / `back_throw` がリュウの moves にすべて seed 済みであることが確定したため、§3.4 を「マスタデータ存在確認」のみの軽量化版に縮約(マイグレーション作成手順を削除)。これに伴い §2.1 / §2.3 / §2.4 を seed マイグレーション関連記述なしに戻し、Plan Mode を「必須 → 任意」に再設定。`back_throw` の方向状態保持対応は M7 仕上げ(または将来のマイルストーン)に持ち越し |

---

## 1. 背景と目的

### 1.1 背景

M1-06 で `RecipeBuilder.tsx` を「技セレクタ(`<select>`)+ 追加ボタン + ステップリスト」の最小構成で実装した。当時の指示書(M1-06 §4.3.5)では「仮想コントローラはここに M2 で実装」というプレースホルダを置いており、本指示書(M2-01)はそのプレースホルダを実体化する位置づけ。

加えて M1-06 §4.3.4 では modifiers 編集 UI を「ステップ追加時のオプション選択」レベルに簡素化していた(既存ステップの modifiers を編集する場合は「削除して再追加」で運用)。本指示書では、これを **DES-005 §6.7 で示された「ポップアップ/ドロワー方式」** に格上げする。

### 1.2 目的

- レバーレス配置の **仮想コントローラ** を画面に配置し、クリック操作でステップ追加ができる動作を実現する
- 既存ステップの modifiers(flags / type / notes)を **ステップ行から開けるポップアップ** で編集できるようにする
- 既存の技セレクタ(`<select>`)による技選択は **仮想コントローラと併存させる**(レシピ入力の主導線は仮想コントローラだが、必殺技・SA など複雑な入力は従来のセレクタでフォールバック)

### 1.3 このマイルストーンで作らないもの

- レバーレス以外のレイアウト(アケコン、PS5パッド、キーボード) — M7 仕上げで実装
- 仮想コントローラのビジュアル仕上げ(色・形・余白の統一、SF6 風意匠) — M7 で実装。本指示書では「論理ボタンが押せる」レベルで良い
- 物理コントローラ・キーボードでの直接入力(FR105、Gamepad API) — フェーズ2
- 同時押し判定の時間窓・チャタリング対策(FR107、FR108) — フェーズ2
- modifiers.notes の **画面表示処理**(コンボ詳細画面のレシピで notes を見えるようにする処理) — M2-04 で対応。本指示書では編集 UI 側で notes が **入力・保存** できれば足りる
- 必殺技(波動拳の ↓↘→ 入力)・TC・OD技などの複雑入力の補助UI(DES-005 §6.6) — 「実装フェーズで開発者と Claude Code の協同で決定」とされている領域。本指示書では基本的な単発ボタン入力のみ実装し、複雑入力は従来の技セレクタで対応する形を取る(§4.3.5 で詳述)

---

## 2. 成果物

### 2.1 作成するファイル

```
web/src/
└── features/
    └── combo/
        └── components/
            ├── VirtualController/             # ディレクトリ新設
            │   ├── VirtualController.tsx      # 親コンポーネント、レイアウト切替の窓口(M2 ではレバーレスのみ)
            │   ├── HitBoxLayout.tsx           # レバーレス配置の実体
            │   ├── controllerTypes.ts         # 論理ボタン定義(DES-005 §6.2)、入力イベント型
            │   └── useControllerInput.ts     # 入力をステップ追加に変換するフック
            └── ModifiersEditor.tsx            # ステップ行から開く modifiers 編集ポップアップ
```

各ファイルの責務は §4 で詳述する。

### 2.2 修正するファイル

| ファイル | 修正内容 |
|---------|---------|
| `web/src/features/combo/components/RecipeBuilder.tsx` | プレースホルダ(M1-06 §4.3.5)の位置に `<VirtualController>` を組み込む。技セレクタ(`<select>`)は併存させる(§4.3.5 参照) |
| `web/src/features/combo/components/StepRow.tsx` | 「編集」ボタンを `<ModifiersEditor>` を開くトリガーに変更(現状は「削除して再追加」運用) |
| `web/src/features/combo/components/ComboEditor.tsx` | `useMovesByCharacter` の呼出階層を確認し、`RecipeBuilder` と `VirtualController` の両方で moves が必要な場合は `ComboEditor` で1回呼んで両方に props で渡す。レイアウト変更は不要 |

### 2.3 変更しないもの(原則)

- バックエンド側のコード(API、サービス層、リポジトリ層、マイグレーション)
- M1-05 で実装したコンボ一覧・詳細画面(`ComboList.tsx`、`ComboDetail.tsx` など)
- M1-06 の `ComboEditorBasicFields.tsx`(基本情報入力エリア)
- M1-06 の `ValidationDisplay.tsx`、`DuplicateWarning.tsx`
- 編集の2方式分離(PATCH/PUT)の判定ロジック(M1-06 §4.4)

### 2.4 例外: バックエンドへの最小限の追加が許容される箇所

**該当なし**。本指示書はフロント側の UI 変更のみで完結する。M1-06 までで実装済みの API(`/api/moves`、`/api/combos`)を引き続き使用し、必要なマスタデータ(`drive_parry`、`forward_throw` を含む全 moves)は M1-02 で seed 済みである(§3.4 参照)。

万一、実装中にバックエンド変更が必要と判断した場合、Plan Mode で停止して開発者に相談すること。

---

## 3. 前提条件

### 3.1 必読ドキュメント

- `CLAUDE.md`(全体方針、§8 矛盾検出時の停止ルール)
- `docs/instructions/M2-overview.md`(M2 全体像、§6 運用ルール)
- `docs/design/05-screen-design.md`(画面設計書):
  - **§5.7** コンボ登録・編集画面(全体像、レシピビルダーの位置づけ)
  - **§6.1〜§6.7** 仮想コントローラの論理構成(本指示書の中核、特に §6.2 論理ボタン一覧、§6.3 物理レイアウトマッピング、§6.7 修飾情報の入力)
- `docs/design/supp-001-detailed-design.md`(設計補足):
  - **§3.3.0** Modifiers 構造体全体像(型付き struct の3フィールド: Flags / Type / Notes)
  - **§3.3.1** modifiers.flags 初期値(just / delay / link / low_jump の4種)
  - **§3.3.3** 非技ステップ(modifiers.type)初期値(parry_drive_rush / cancel_drive_rush / dash_forward / dash_back の4種)
  - **§3.3.4** modifiers.notes(自由記述、本指示書では編集 UI のみ実装、表示は M2-04 で対応)
- `docs/instructions/M1-06-combo-editor-page.md`:
  - **§4.3** レシピビルダー(現状の実装、本指示書はこの拡張)
  - **§4.4** 編集の2方式分離(本指示書ではこの判定ロジックを変更しない)

### 3.2 任意参照(必要時のみ参照)

- `docs/design/03-data-model.md` §3.5 combo_steps テーブル定義(modifiers JSON カラムの構造確認用)
- `docs/design/04-notation-spec.md`(レシピ表記、技 code の体系)
- `docs/design/requirements.md` FR105〜FR108(物理コントローラ要件、本指示書ではフェーズ2扱いだが論理ボタン設計の文脈確認用)

### 3.3 参照不要

- DES-002 アーキテクチャ設計書(本指示書はフロント単独完結のため)
- DES-006 バリデーション設計書(本指示書ではバリデーションロジックの変更なし)
- M1-01〜M1-05、M1-07 指示書(本指示書のスコープ外)

### 3.4 着手前の確認(マスタデータの存在確認)

本指示書の §4.2.2 / §4.4.2 で記述した「`drive_parry` / `forward_throw` を `useMovesByCharacter` から code 検索で解決」の前提として、リュウの moves マスタに `drive_parry` および `forward_throw` の code を持つレコードが seed されている必要がある。

**現状**: 開発者からの確認により、リュウの moves には `drive_parry` および `forward_throw` / `back_throw` が既に seed されていることが判明している(M1-02 期間で seed 済み)。本指示書では追加の seed マイグレーション作成は不要だが、製造担当 Claude Code は念のため着手前に存在確認を行うこと。

#### 3.4.1 確認ステップ

製造担当 Claude Code は本指示書の §4 詳細仕様の実装に着手する前に、以下のコマンドで現状を確認する。

```bash
# サーバーが起動していない場合は make run-server-debug などで起動
curl 'http://localhost:47318/api/moves?character_id=1' | jq '.[] | select(.code=="drive_parry" or .code=="forward_throw" or .code=="back_throw") | {code, name_ja}'
```

期待される結果:

```json
{ "code": "drive_parry", "name_ja": "ドライブパリィ" }
{ "code": "forward_throw", "name_ja": "前投げ" }
{ "code": "back_throw", "name_ja": "後ろ投げ" }
```

(name_ja の値は seed 実態によって若干異なる可能性あり、code が一致していれば OK)

#### 3.4.2 確認結果の報告

製造担当 Claude Code は §3.4.1 の確認コマンド出力を実装完了報告に含める。

#### 3.4.3 万一 seed が不足していた場合(緊急時のみ)

万一 §3.4.1 の確認で `drive_parry` または `forward_throw` のいずれかが結果に含まれなかった場合(開発者の事前確認と矛盾するため発生しないはずだが、安全策として):

- Plan Mode で停止して開発者に状況を報告する
- 設計担当 Claude(M2 期間担当)経由で対応方針を確定する
- 製造担当 Claude Code が独断で seed マイグレーションを作成しない(M1 期間の seed 状況と矛盾する事象のため、判断を持ち越す)

#### 3.4.4 §4 着手の前提条件

§3.4.1 の確認で `drive_parry` と `forward_throw` の両方が結果に含まれる状態であることを確認してから、§4 詳細仕様の実装に着手する。`back_throw` は本指示書のスコープでは使用しないが、データとして存在することの確認のみ行う(将来の方向状態保持実装で使用される)。

---

## 4. 詳細仕様

### 4.1 仮想コントローラの全体構造

#### 4.1.1 設計の中核思想

DES-005 §6.2 で定義された **論理ボタン群** を画面に配置し、各ボタンのクリックを「論理ボタン入力イベント」に変換する。論理ボタン入力をステップに変換する責務は `useControllerInput.ts` フックが担う。物理レイアウト(レバーレス、アケコン等)の差異はビジュアルだけの違いで、論理ボタン群と入力変換ロジックは共通化する。

M2 ではレバーレス1種のみ実装するが、将来の拡張(M7 で他レイアウト追加)を見越して、ディレクトリ構造とインターフェースを分離しておく。

#### 4.1.2 ファイル構造と責務

```
VirtualController/
├── VirtualController.tsx     # 親、レイアウト切替の窓口(M2 ではレバーレス固定)
├── HitBoxLayout.tsx          # レバーレス配置の実体(ボタンを並べる JSX)
├── controllerTypes.ts        # 論理ボタン型、イベント型の定義
└── useControllerInput.ts    # 論理ボタン入力 → ステップ追加への変換ロジック
```

各ファイルの責務:

| ファイル | 責務 |
|---------|------|
| `VirtualController.tsx` | レイアウト切替の窓口。M2 ではレバーレス固定、props で `onStepAdd` を受け取り `HitBoxLayout` に渡す |
| `HitBoxLayout.tsx` | レバーレス配置のボタンを並べた JSX。各ボタンの `onClick` が論理ボタン入力イベントを発火する |
| `controllerTypes.ts` | `LogicalButton` 型(DES-005 §6.2 の14種)、`ControllerInputEvent` 型を定義 |
| `useControllerInput.ts` | 論理ボタン入力を受けて、`onStepAdd(step)` を呼び出すロジック。技ボタン入力 → move_id の解決もここで行う |

### 4.2 論理ボタンの定義(DES-005 §6.2 準拠)

#### 4.2.1 controllerTypes.ts

```typescript
// DES-005 §6.2 論理ボタン一覧
export type LogicalButton =
  | "direction_neutral"   // 方向なし(5)
  | "direction_1" | "direction_2" | "direction_3"
  | "direction_4" | "direction_6"
  | "direction_7" | "direction_8" | "direction_9"
  | "light_punch" | "medium_punch" | "heavy_punch"
  | "light_kick" | "medium_kick" | "heavy_kick"
  | "drive_impact"        // 強P+強K
  | "drive_parry"         // 中P+中K
  | "throw"               // 弱P+弱K
  | "parry_drive_rush"    // 中P+中K中に6
  | "step_commit"         // 現在の入力をステップ確定
  | "step_delete";        // 最後のステップを削除

export interface ControllerInputEvent {
  button: LogicalButton;
  timestamp: number;  // フェーズ2の同時押し判定用、M2 では未使用だが構造として持つ
}
```

#### 4.2.2 各ボタンの「クリック→ステップ」マッピング(M2 範囲)

DES-005 §6.4 によると、入力内容はステップリストに順次追加される。M2 では複雑入力(必殺技、TC、OD技)を扱わず、**単発の通常技ボタンクリックでステップを1つ追加する** 単純な動作を実装する。

| 論理ボタン | M2 でのクリック挙動 |
|----------|-----------------|
| `light_punch` 〜 `heavy_kick` | 現在のキャラの「立ち+該当ボタン」技(例: `stand_light_punch`)をステップ追加 |
| `direction_1`〜`direction_9` | M2 では **単独では何もしない**(将来の必殺技入力用に方向状態は保持するが、ステップは生成しない)。設計上の根拠: 「方向だけのステップ」は SF6 のコンボに存在しない |
| `direction_neutral` | M2 では **何もしない**(初期状態に戻る、内部の方向状態をリセット) |
| `drive_impact` | 当該キャラの `drive_impact` move(DES-003 §3.4 L280: category="drive_impact"、code は全キャラ統一でキャラ別個別レコード)をステップ追加 |
| `drive_parry` | 当該キャラの `drive_parry` move(DES-004 §2.1 L75 で共通システム名として定義、案B方針により drive_impact と同じく code は全キャラ統一でキャラ別個別レコードとして登録される)をステップ追加 |
| `throw` | 当該キャラの **`forward_throw` move**(前投げ)をステップ追加。SF6 仕様では「投げボタン単独 = 前投げ」「前+投げ = 前投げ」「後ろ+投げ = 後ろ投げ(`back_throw`)」だが、M2 では方向状態を保持しない方針(§4.4.1)のため、**投げボタンは常に前投げを解決**する。後ろ投げは moves マスタにデータとして存在するが、本指示書では仮想コントローラから直接入力する手段を提供しない。後ろ投げ入力が必要な場合は既存の技セレクタ(`<select>`)から `back_throw` を選択する形でフォールバックする(§4.5.1) |
| `parry_drive_rush` | M2 では `modifiers.type = "parry_drive_rush"` の非技ステップ(move_id = NULL)を追加 |
| `step_commit` | M2 では未使用(将来の必殺技確定ボタン)。クリック時は何もしない |
| `step_delete` | レシピの最後のステップを削除 |

**重要な実装方針**: 上記の各技ボタンに対応する move の解決は、`useControllerInput.ts` 内で現キャラの moves 一覧(`useMovesByCharacter`、M1-06 で実装済)を検索して `move.code` の完全一致で取得する。検索する code は以下のとおり:

| 論理ボタン | 検索する move.code |
|----------|-----------------|
| `light_punch` 〜 `heavy_kick`(6種) | `stand_light_punch` 〜 `stand_heavy_kick` |
| `drive_impact` | `drive_impact` |
| `drive_parry` | `drive_parry` |
| `throw` | `forward_throw`(後ろ投げ `back_throw` は M2 では使用しない) |

該当 move が見つからない場合(キャラのマスタデータに該当 code の move が seed されていない等)は、`console.warn` でログを出してクリックを無視する。これはマスタデータ側の seed 漏れを示唆するため、開発時は警告ログを確認しマスタデータ側に CHANGE 起票することが望ましい(本指示書のスコープ外、M2 期間担当・開発者の協議事項)。

**しゃがみ・ジャンプ攻撃・後ろ投げの扱い(M2 範囲)**:

- しゃがみ攻撃: `direction_2` を押した状態で技ボタンを押した場合、`crouch_light_punch` 等を解決する形が望ましいが、これは「方向状態の保持」が必要で M2 のスコープを超える
- ジャンプ攻撃: 同様に `direction_8` 等を押した状態で技ボタンを押した場合、`jump_heavy_kick` 等を解決する形が望ましいが、M2 のスコープ外
- 後ろ投げ: SF6 仕様では「後ろ+投げ」で `back_throw` が発動するが、これも「方向状態の保持」が必要で M2 のスコープを超える
- **M2 では立ち技と前投げのみ仮想コントローラから入力可能**とし、しゃがみ・ジャンプ・後ろ投げ・必殺技・TC・OD技は **既存の技セレクタ(M1-06 の `<select>`)から選択する形でフォールバック** する。仮想コントローラと技セレクタが併存することで、初期実装の限界を補う

この方針は DES-005 §6.6「実装フェーズで開発者と Claude Code が協同して使い勝手を見ながら決定する」の領域に該当する。**M2 では上記のシンプルな動作で実装し、方向状態の保持を含む使い勝手の改善は M7 仕上げ(または将来のマイルストーン)で再評価する**。方向状態保持の仕組みが入れば、しゃがみ・ジャンプ・後ろ投げが自動的に対応可能になる。

### 4.3 レバーレス配置(HitBoxLayout.tsx)

#### 4.3.1 物理配置の方針

DES-005 §6.3 によると、レバーレスは「8つの方向ボタン(上下左右斜め)+ 6ボタン(P/K弱中強)」の構成。SF6 のレバーレス配置は標準的に以下のような並びになる(参考: 一般的な HitBox / Razer Kitsune / Punkworkshop 等)。

```
                                      [LP] [MP] [HP]
                                      [LK] [MK] [HK]
                  [←] [↓] [→]
                       [↑]
```

(左手側に方向、右手側に技ボタン)

加えて、SF6 のシステム入力(DI、DP、投げ、ラッシュ)とアプリ独自のシステムボタン(ステップ確定、ステップ削除)を画面下部または右端に配置する。

#### 4.3.2 M2 での簡略配置

ビジュアル仕上げは M7 で行うため、M2 では「ボタンが論理的に正しい位置に並んでいる」レベルで良い。具体的には以下の4ブロックに分けてグリッド配置する:

```
┌─ 方向ブロック(左) ──┐  ┌─ 技ブロック(右) ─┐
│  [7] [8] [9]         │  │ [LP] [MP] [HP]    │
│  [4] [5] [6]         │  │ [LK] [MK] [HK]    │
│  [1] [2] [3]         │  │                    │
└─────────────────────┘  └────────────────────┘

┌─ システムブロック(下) ────────────────────┐
│  [DI] [DP] [投げ] [ラッシュ]  [削除]       │
└────────────────────────────────────────┘
```

各ボタンは `<button>` 要素で実装し、`onClick` で論理ボタン入力イベントを発火する。Tailwind CSS のユーティリティクラス(`grid grid-cols-3 gap-1`、`px-3 py-2 border rounded` 等)で配置する。色・サイズの細部は M7 で調整するため、M2 では Tailwind のデフォルト+最小限の調整で構わない。

`direction_5`(中央)は `direction_neutral` に対応する(DES-005 §6.2 で「方向なし(5)」と定義)。

#### 4.3.3 アクセシビリティの最小要件

- 各ボタンに `aria-label` を付ける(例: `aria-label="弱パンチ"`)
- ボタンはキーボードフォーカス可能であること(`<button>` 要素のデフォルト挙動で OK)
- 物理キーボードからのキーバインドは **本指示書では実装しない**(フェーズ2の物理キーボード対応で扱う)

### 4.4 useControllerInput.ts の実装方針

#### 4.4.1 入力 → ステップ変換ロジック

```typescript
// 概念コード(実装は製造担当 Claude Code が決定)
function useControllerInput({
  characterId,
  moves,
  onStepAdd,
  onStepDelete,
}: {
  characterId: number;
  moves: Move[];                 // M1-06 の useMovesByCharacter で取得
  onStepAdd: (step: ComboStep) => void;
  onStepDelete: () => void;
}) {
  const handleButtonClick = (button: LogicalButton) => {
    switch (button) {
      case "light_punch":
        addMoveStep("stand_light_punch");
        break;
      // ... 他の技ボタン
      case "parry_drive_rush":
        // 非技ステップ(move_id = NULL、modifiers.type = "parry_drive_rush")を追加
        onStepAdd({ moveId: null, modifiers: { type: "parry_drive_rush", flags: [], notes: "" } });
        break;
      case "step_delete":
        onStepDelete();
        break;
      // direction_*, step_commit, direction_neutral は M2 では何もしない
    }
  };

  return { handleButtonClick };
}
```

具体的なフック設計(`useState` を使うか、useReducer を使うか、内部に方向状態を持つか等)は製造担当が決定して良い。**M2 では方向状態の保持は不要**(将来の必殺技入力で必要になるが、M2 範囲では使わない)。

#### 4.4.2 該当 move が見つからない場合の挙動

§4.2.2 の表で示した各 move.code(`stand_light_punch` 〜 `stand_heavy_kick` の6種 + `drive_impact` + `drive_parry` + `forward_throw` の合計9種)が当該キャラの moves に存在しない場合、`console.warn` でログを出してクリックを無視する。ユーザー向けエラー表示は M7 で検討する(初期実装ではログのみで十分)。

ログメッセージはデバッグ時にマスタデータ側の seed 漏れを判定できる粒度で出す(例: `"VirtualController: move not found - characterId=1, code=drive_parry"`)。

### 4.5 既存 RecipeBuilder からの差し替え方針

#### 4.5.1 RecipeBuilder.tsx の修正

M1-06 §4.3.5 のプレースホルダ(`「仮想コントローラはここに M2 で実装」`)の位置に `<VirtualController>` を配置する。技セレクタ(`<select>`)は併存させる。

```tsx
// 修正後の RecipeBuilder.tsx 構造(概念)
<div>
  {/* 仮想コントローラ(レバーレス) */}
  <VirtualController
    characterId={characterId}
    moves={moves}
    onStepAdd={handleStepAdd}
    onStepDelete={handleStepDelete}
  />

  {/* 既存の技セレクタ(M2 でも併存、複雑入力のフォールバック) */}
  <div className="mt-4">
    <label>技を直接選択(必殺技・SA・TC など):</label>
    <select onChange={...}>...</select>
    <button onClick={addSelectedMove}>追加</button>
  </div>

  {/* ステップリスト */}
  <StepList steps={steps} onEdit={openModifiersEditor} onDelete={...} />
</div>
```

両方の入力経路から追加されたステップは同じ `steps` state に格納される。

#### 4.5.2 既存挙動を壊さないための注意

- M1-06 で実装した `useMovesByCharacter` フックは仮想コントローラ・技セレクタの両方から使われる。重複呼出を避けるため、`ComboEditor.tsx` または `RecipeBuilder.tsx` の高い階層で1回呼び、結果を子に props で渡すこと
- ステップ追加・削除のロジックは M1-06 で既に存在する(技セレクタ経由)。仮想コントローラ経由の追加も同じ state 更新関数を呼ぶこと

### 4.6 modifiers 編集 UI(ModifiersEditor.tsx)

#### 4.6.1 起動方法

`StepRow.tsx`(M1-06 で実装済)の「編集」ボタンクリックで `ModifiersEditor` をモーダルまたはポップアップとして表示する。M1-06 §4.3.4 では「削除して再追加」運用だったが、本指示書で正式なポップアップ編集に格上げする。

#### 4.6.2 UI 構造

```
┌─ ModifiersEditor(モーダル) ──────────────┐
│ ステップ編集: 立ち中P                       │
│                                            │
│ flags(複数選択):                           │
│  [ ] just (ジャスト入力)                   │
│  [ ] delay (ディレイ入力)                  │
│  [ ] link (目押し)                         │
│  [ ] low_jump (最低空)                     │
│                                            │
│ type(非技ステップの場合のみ表示):          │
│  ( ) parry_drive_rush                      │
│  ( ) cancel_drive_rush                     │
│  ( ) dash_forward                          │
│  ( ) dash_back                             │
│                                            │
│ notes(自由記述、50文字以内目安):           │
│  [_____________________________]           │
│                                            │
│         [キャンセル]  [保存]                │
└────────────────────────────────────────────┘
```

各部の仕様:

- **flags**: チェックボックス4種(SUPP-001 §3.3.1、`just` / `delay` / `link` / `low_jump`)。複数選択可
- **type**: ラジオボタン4種(SUPP-001 §3.3.3、`parry_drive_rush` / `cancel_drive_rush` / `dash_forward` / `dash_back`)。**当該ステップが非技ステップ(`move_id === null`)の場合のみ表示**。技ステップでは type は使わないため非表示
- **notes**: テキスト入力(`<textarea>` または `<input type="text">`)。SUPP-001 §3.3.4 に従い、50文字超で UI 警告(赤色など)を表示するが、入力自体は許可する(DB 制約はない)
- **キャンセル**: 変更を破棄して閉じる
- **保存**: 変更を当該ステップの modifiers に反映して閉じる

#### 4.6.3 状態管理

- モーダル内の入力は **ローカル state**(`useState`)で管理し、「保存」ボタンクリック時に親(`StepRow` または `RecipeBuilder`)の `onSave(stepIndex, newModifiers)` を呼び出して反映する
- 「キャンセル」または背景クリックでモーダルを閉じる際は、ローカル state の変更を破棄する

#### 4.6.4 notes の保存パスと表示パスの分離

本指示書では `notes` を **入力・保存** できれば足りる。`notes` の **画面表示**(コンボ詳細画面のレシピで `(目押し1F)` のように括弧付きで表示する)は M2-04 で実装する(SUPP-001 §3.3.4 の括弧付きインライン表示形式、開発者により採択済み)。

入力した `notes` が `combo_steps.modifiers` JSON に保存され、API レスポンスに含まれることまでは本指示書のスコープ。M1-06 の保存ロジックは modifiers JSON をそのまま API へ送信する実装になっているため、`notes` フィールドを追加した modifiers オブジェクトを構築すれば自動的に保存される想定。製造担当は実装後 §5.2 の E2E シナリオ D で `curl` を使って保存ラウンドトリップを確認すること。

---

## 5. テスト要件

### 5.1 必須テスト(Vitest + React Testing Library)

テスト配置場所は M1 期間で確立した既存の配置パターンに従う。M1-06 で配置された既存テストファイルの場所(例: `web/src/features/combo/components/__tests__/RecipeBuilder.test.tsx`)を確認し、同じパターンで `VirtualController/` 配下のテストを配置すること。以下のテストを配置する。

#### 5.1.1 VirtualController / HitBoxLayout

- 全14論理ボタン(direction系9 + 技系6 + システム系)が画面に存在する(`getByRole("button", { name: "弱パンチ" })` 等)
- 技ボタン(LP)クリック → `onStepAdd` が呼ばれ、引数に `stand_light_punch` の move を含む step が渡される
- DI ボタンクリック → `onStepAdd` が呼ばれ、当該キャラの `drive_impact` move が含まれる
- ラッシュ(parry_drive_rush)クリック → `onStepAdd` が呼ばれ、`{ moveId: null, modifiers: { type: "parry_drive_rush", flags: [], notes: "" } }` が渡される
- 削除ボタンクリック → `onStepDelete` が呼ばれる
- 方向ボタン(direction_2 等)クリック → `onStepAdd` も `onStepDelete` も呼ばれない(M2 範囲では何もしない)

#### 5.1.2 ModifiersEditor

- flags チェックボックス4種が表示される(just / delay / link / low_jump)
- 既存ステップの flags が初期値として反映される(例: `flags: ["just"]` のステップを開くと just にチェックが入る)
- 技ステップ(`moveId !== null`)では type ラジオボタンが表示されない
- 非技ステップ(`moveId === null`)では type ラジオボタンが表示される
- notes textarea に入力でき、50文字超で警告色(クラス名チェックで OK)
- 「保存」クリック → `onSave(stepIndex, newModifiers)` が新しい modifiers で呼ばれる
- 「キャンセル」クリック → `onSave` が呼ばれず、モーダルが閉じる

### 5.2 E2E シナリオ(開発者がブラウザで手動実行)

製造担当 Claude Code は **動作確認手順書** として以下を実装完了報告に含める。開発者がブラウザで以下を実行して動作確認する。

```
## E2E シナリオ A: 仮想コントローラからのレシピ入力

1. /combos/new で新規コンボ画面を開く
2. キャラ「リュウ」を選択
3. 仮想コントローラの [LP] ボタンをクリック → ステップリストに「立ち弱P」が追加される
4. [MP] ボタンをクリック → 「立ち中P」が追加される
5. ラッシュボタン(parry_drive_rush)をクリック → 「ラッシュ(非技)」のようなステップが追加される
6. [HP] ボタンをクリック → 「立ち強P」が追加される
7. ステップリストに4つのステップが順に並んでいることを確認
8. 削除ボタンをクリック → 最後のステップが削除される
9. ステップリストが3つに戻ることを確認

## E2E シナリオ B: 既存技セレクタとの併存

1. 続けて、既存の技セレクタから「波動拳」を選択して「追加」
2. ステップリストに「波動拳」が追加される
3. 仮想コントローラと技セレクタの両方から追加されたステップが同じリストに並ぶことを確認

## E2E シナリオ C: modifiers 編集 UI

1. ステップリストの「立ち中P」の「編集」ボタンをクリック → modifiers 編集モーダルが開く
2. flags の「link」「just」にチェックを入れる
3. notes に「目押し1F」と入力
4. 「保存」をクリック → モーダルが閉じる
5. ステップリストの該当ステップに修飾情報のアイコン/表示が反映されていることを確認(具体的な表示は M1-06 の StepRow.tsx の現状実装に依存)
6. コンボを保存
7. ブラウザリロード後、コンボ詳細画面 → 編集画面に戻り、当該ステップの編集ボタンをクリック → モーダルに「link」「just」チェック、notes に「目押し1F」が反映されていることを確認(=保存ラウンドトリップが正しく動作する)

## E2E シナリオ D: notes の保存(M2-01 範囲、表示は M2-04)

1. シナリオ C の手順 6 でコンボ保存後、ターミナルで以下を実行:
   curl http://localhost:47318/api/combos/<保存したコンボのID> | jq '.steps[].modifiers.notes'
2. 「目押し1F」が JSON レスポンスに含まれていることを確認
3. ※ コンボ詳細画面でこの notes が表示されない件は M2-04 で対応する。本指示書では「保存・取得が動く」までで合格
```

開発者は上記4シナリオを実行して動作確認する。製造担当が実装完了報告に「動作確認手順書」として上記シナリオを再掲することで、開発者の確認作業を支援する。

---

## 6. レビュー観点(別ファイル参照)

製造担当 Claude は本節を読む必要はない。

レビュー観点は以下の別ファイルに分離されている:

- **`docs/instructions/reviews/M2-01-review-checklist.md`**

(本チェックリストファイルは M2-01 指示書とセットで設計担当が別途作成する)

---

## 7. 完了条件(Definition of Done)

### 7.1 機能要件

- [ ] §3.4.1 の確認コマンドを実行し、リュウの moves に `drive_parry` と `forward_throw` の両方が seed されていることを確認する(確認結果を実装完了報告に貼付)
- [ ] §2.1 のファイルが全て作成されている(`VirtualController/`配下4ファイル + `ModifiersEditor.tsx`)
- [ ] §2.2 の修正ファイル(`RecipeBuilder.tsx`、`StepRow.tsx`、`useMovesByCharacter` の階層整理が発生した場合は `ComboEditor.tsx`)が修正されている
- [ ] §5.1 の必須テスト(Vitest)が全通過する
- [ ] §5.2 の E2E シナリオ A〜D が動作する(動作確認手順書として実装完了報告に再掲)

### 7.2 自己テスト結果(製造担当の責任範囲)

製造担当 Claude Code は以下を実施し、結果を実装完了報告に貼付する。

- [ ] `pnpm test` が全通過する(失敗テストの出力をログに残す。失敗が発生した場合は修正して再実行する)
- [ ] `pnpm build` が成功する(ビルドエラーがないこと)
- [ ] TypeScript の型エラーが残っていない(`pnpm tsc --noEmit` でも確認)
- [ ] 新規追加したコンポーネントで React の警告(key 警告等)が新規発生していないこと(開発サーバー起動時のコンソールで確認、確認は製造担当が `pnpm dev` の出力ログで判断)
- [ ] §5.2 の動作確認手順書を実装完了報告に再掲

ブラウザでの実機動作確認・スクリーンショット取得は **開発者の責任範囲** であり、製造担当は実行しない(M2-overview §6.5.2 参照)。

### 7.3 品質チェック

- [ ] CLAUDE.md の禁止事項に抵触していない(localStorage 使用なし、git 操作なし 等)
- [ ] `console.log` を本番コードに残していない(`console.warn` は §4.4.2 の警告ログとして許容)
- [ ] 設計書本体(DES-005 §6.2、§6.7、SUPP-001 §3.3)と実装が一致している。差異がある場合は CHANGE 起票を提案する
- [ ] M1-06 の既存挙動を壊していない(既存技セレクタからの追加、編集2方式の判定ロジック等)

### 7.4 完了報告

- [ ] 開発者に「M2-01 が完了しました」と報告する
- [ ] §7.2 の自己テスト結果と §5.2 の動作確認手順書を報告に含める
- [ ] レビュー担当(別 Claude Code セッション)へ §6 のチェックリストファイルを案内する(レビュー担当の起動は開発者が実施)

---

## 8. 参照ドキュメント

| ID | パス | 参照箇所 |
|----|------|----------|
| CLAUDE.md | `CLAUDE.md` | 全体方針、§8 矛盾検出時の停止ルール |
| M2-overview | `docs/instructions/M2-overview.md` | M2 全体像、§6 運用ルール |
| DES-005 | `docs/design/05-screen-design.md` | §5.7 / §6.1〜§6.7(中核) |
| SUPP-001 | `docs/design/supp-001-detailed-design.md` | §3.3.0〜§3.3.4(modifiers の構造、本指示書の中核) |
| M1-06 | `docs/instructions/M1-06-combo-editor-page.md` | §4.3 / §4.4(現状実装) |
| DES-003 | `docs/design/03-data-model.md` | §3.4 moves テーブル定義(category / properties 列挙値の文脈確認用、任意参照) |
| DES-004 | `docs/design/04-notation-spec.md` | §2.1 共通システム命名(L75 で `drive_parry` 等の code 体系を確認、任意参照) |

---

## 9. 注意事項・判断に迷ったら

### 9.1 推測で進めてはいけない事項

- 論理ボタンの取り得る値(DES-005 §6.2 の14種を厳密に守る、追加・削除しない)
- modifiers の構造(SUPP-001 §3.3.0 の Flags / Type / Notes の3フィールドを厳守、フィールド追加は CHANGE 起票で提案)
- バックエンド API・マイグレーションの変更(本指示書のスコープ外、変更が必要と判断した場合は Plan Mode で停止して開発者に相談)
- `move.code` の命名(DES-004 の規則に従う、勝手な命名を作らない)
- 投げボタンの解決先(本指示書では `forward_throw` 固定。`back_throw` を使用する変更は §4.2.2 の方針変更に該当するため Plan Mode で停止して開発者に相談)

### 9.2 推測で進めてよい事項(その旨を明示)

以下は本指示書で詳細を確定していない領域。製造担当が実装し、判断の根拠を実装完了報告で明示すること。「推測した内容」を明記する。

- ボタンのビジュアル(色、サイズ、余白)— Tailwind CSS のデフォルト + 最小限の調整で良い、M7 で仕上げる
- モーダルの実装方法(`<dialog>` 要素を使うか、独自実装か)— shadcn/ui は M1 では未導入(M1-TO-M2-HANDOVER §3.1 参照)、標準 HTML + Tailwind で実装すること
- アクセシビリティの追加属性(role、aria-* 等)— §4.3.3 の最小要件を超える追加は推奨だが必須ではない
- 内部 state の管理方法(useState / useReducer / 別ライブラリ)— useState で実装可能な範囲なので useState 推奨

### 9.3 不明事項発見時の対応

1. **設計書本体との矛盾を発見した場合**: CLAUDE.md §8 に従い、Plan Mode で停止して開発者に確認する。CHANGE 起票が必要な場合は設計担当の対応となるため、開発者経由で連絡する
2. **M1-06 既存実装と本指示書の矛盾を発見した場合**: 同上、Plan Mode で停止して開発者に確認する
3. **論理ボタンの挙動で判断に迷う場合**(例: `direction_*` 単独クリック時の挙動): §4.2.2 の表に従う。表にない挙動は §9.2 の「推測で進めてよい事項」として最小実装し、報告で明示する

### 9.4 Plan Mode で計画提示時に含めるべき項目(任意推奨)

- §3.4.1 の確認コマンド結果(seed 状況の確認結果)
- ファイル分割方針(`VirtualController/` 配下4ファイル + `ModifiersEditor.tsx`)
- 論理ボタン → ステップ変換のマッピング再確認(§4.2.2 の表通りで良いか、特に投げボタンが `forward_throw` 解決の理解で正しいか)
- モーダル実装方法(`<dialog>` か独自実装か)
- 既存 `useMovesByCharacter` の呼出階層(重複防止のため)

---

## 10. 完了後の次ステップ

M2-01 完了後、開発者の承認を得て M2-02(編集系 UX 改善: コピー機能、重複検知 API、仮登録↔本登録昇格、PUT 確認ダイアログ)に進む。

M2-02 着手時には、本指示書で実装した仮想コントローラと modifiers 編集 UI が安定動作していることが前提となる。M2-01 でバグや改善点が発見された場合、M2-02 着手前に開発者と協議して対応方針を決める(その場で修正する、CHANGE 起票する、後続マイルストーンに送る等)。

---

*以上*
