# CHANGE-106 addendum: ゲームパッドのキャリブレーション結果の localStorage キー（台帳追記の通知）

| 項目 | 内容 |
|------|------|
| 種別 | 製造→設計担当/開発者 への**通知**（`CLAUDE.md` §10.X ／ `web/CLAUDE.md` §1 準拠） |
| 関連 CHANGE | **CHANGE-106**（`docs/change-notes/CHANGE-106-notification.md`。承認済・**D-333**） |
| 起票 | M21-01 製造担当 / 2026-08-13 |
| ステータス | **台帳追記済み**（`web/CLAUDE.md` §1 #8）。判断の根拠は本書 §2 |
| 対象ルール | `CLAUDE.md` §10.X ／ `web/CLAUDE.md` §1 ブラウザストレージ運用台帳 |

---

## 1. 何を追加したか

M21-01（取得基盤・機種プロファイル・キャリブレーション）で、利用者の機体ごとのボタン対応表を保持する新規 localStorage キー

- **`gamepad-profiles-v1`**（`Record<profileKey, GamepadProfile>`）

を追加した。`web/CLAUDE.md` §1 は「本表に未記載の UI 状態を保持する必要が生じたら、CHANGE 通知書（または CHANGE addendum）経由で本表へ追記してから使う」と定めるため、本書で通知し台帳 #8 へ追記した。

**指示書の根拠**: `M21-01` §4.5-4（「未記載なら `CHANGE-106` の addendum で台帳へ追記してから使う」）／§3.3-8（着手前実査で未記載を確認）。`CHANGE-106` §5 も同じ運用を指定している。

### 保持する値の形

```ts
profileKey = `${browserKey}::${padId}`   // ★Gamepad.id だけを鍵にしない（M21-01 §4.2-7）

interface GamepadProfile {
  version: 1;
  padId: string;      // Gamepad.id
  browserKey: string; // ブラウザ識別（同じ機体でも id がブラウザで異なるため）
  directions: Partial<Record<DirectionCardinal, PhysicalBinding>>;  // up/down/left/right
  buttons: Partial<Record<CalibrationButton, PhysicalBinding>>;     // 6 攻撃 ＋ マクロ
}
```

**★保持するのは物理 index とその読み取り方だけである。** コンボ・タグ・プリセットエイリアス・セットプレイ等の DB 永続化対象データは一切含まない。

## 2. 妥当性（なぜ許容範囲と判断したか）

- **用途はその利用者の環境設定のみ**: 「この機体のこのボタンが弱パンチである」という**利用者のローカル環境固有の対応表**であり、機密情報ではなく、DB 永続化対象のユーザー入力データ（コンボ本体・タグ・プリセットエイリアス・セットプレイ）とは性質が違う。**同じコンボを別の機体・別の PC で参照しても意味が変わらない**——対応表は機体に紐づく設定であって作品データではない。`CLAUDE.md` §10.X の禁止用途に該当しない。
- **DB へ持つと逆に壊れる**: 対応表は「利用者 × 機体 × ブラウザ」で決まる。DB（単一の combomgr インスタンス）へ持つと、同一 DB を別 PC・別ブラウザから使ったときに他環境の対応表を引いてしまう。**localStorage の粒度が用途と一致している。**
- **指示書が明示指定**: `M21-01` §4.5-1（`DES-005` §6.4.1 のとおり localStorage を使う。DB へ永続化しない）／§4.5-5（「キャリブレーション結果は『その利用者の環境設定』であって DB 永続化対象のユーザー入力データではない ⇒ 許容範囲と判断する。判断の根拠を addendum に書くこと」）。
- **既存パターン踏襲**: 専用ヘルパ `web/src/lib/browser-storage.ts` 経由 ／ try-catch ／ `-v1` キーバージョニング ／ JSON シリアライズ。`intake-helper-user-rules-v1`（#4）と同じ「構造化データを 1 キーへ JSON で持つ」形。

## 3. ★既存キー #2 `virtual-controller-layout-v1` を流用しなかった理由

台帳 #2 に `~~virtual-controller-layout-v1~~`（localStorage・**未実装**・`DES-005` §6.4.1 根拠）が既に予約されている。**これを流用していない。** 理由は 3 点。

1. **用途が違う**。#2 は「仮想コントローラの**種類選択**保持（レバーレス/アケコン/PS5パッド/キーボード）」＝**4 択の選択値 1 個**である。本キーが持つのは**機体ごとの物理ボタン対応表**であり、別の情報である。1 キーへ押し込むと用途欄が実態と食い違う。
2. **`CHANGE-106` が #2 の側を別途動かす**。同 §2.2-g が「§6.4.1 の保持対象が変わる——キャリブレーション方式では『その機体のボタン対応表』も保持対象になりうる。as-built で確定」としており、**レイアウト種別の選択保持そのものは M21-04 / M21-05（レイアウト名を提示ラベルとして残す範囲）の側に残る**。本サブが先に消費すると、後続サブが使う予定の枠を奪う。
3. **機械検査に抵触する**。#2 の脚注は「**実装コードに 0 ヒットであることを lint が検査する**」と明記しており、`scripts/check-browser-storage-keys.sh` の判定 (c)（台帳「未実装」だが本番コードに出現）で**即座に赤になる**。#2 は「未実装」のまま残すのが正しい状態である。

**⇒ #2 は状態・取消線とも変更しない。新規 #8 を追加する。**

## 4. 実装箇所

- キー定義・ヘルパ: `web/src/features/gamepad/gamepad-storage.ts`
- 消費: `web/src/features/gamepad/useGamepadProfiles.ts` ／ `components/GamepadCalibrationDialog.tsx`
- 検査: `bash scripts/check-browser-storage-keys.sh`（台帳 #8 と実装の一致）

## 5. 台帳への追記内容（実施済み）

`web/CLAUDE.md` §1 の表へ次の行を追加した。

```
| 8 | `gamepad-profiles-v1` | localStorage | 物理コントローラのキャリブレーション結果（機体×ブラウザごとの論理ボタン→物理ボタン対応表） | DES-005 §6.4.1 | M21-01（CHANGE-106 addendum） | 実装済 |
```

あわせて脚注へ **#8 の採否根拠**（本書 §2）と **#2 を流用しない理由**（本書 §3）の要約を置いた。

---

*本書は `CHANGE-106`（`REQ-001` ＋ `DES-005`）に付随するブラウザストレージ台帳の追記通知であり、設計書本体の追加変更を求めるものではない。`DES-005` §6.4.1 本体の改訂は M21-01 の as-built 確定後に設計卓が `CHANGE-106` 三点セットとして行う。*
