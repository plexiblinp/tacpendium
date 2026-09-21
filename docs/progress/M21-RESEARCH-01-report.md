# M21-RESEARCH-01 報告: Gamepad 入力の実測 PoC

| 項目 | 内容 |
|------|------|
| 文書ID | M21-RESEARCH-01-REPORT |
| 対応指示書 | `docs/instructions/M21-RESEARCH-01-gamepad-poc.md` **v1.2.0** |
| 作成日 | 2026-08-12 |
| 段 1（ハーネス作成） | 製造担当 Claude Code |
| 段 2（実機計測） | **開発者**（2026-08-12 実施） |
| 段 3（解析） | 製造担当 Claude Code |
| ブランチ | `research/m21-01` |

---

## 0. 結論サマリ

| # | 設計卓が待っていた問い | 実測の答え |
|---|---|---|
| **1** | **経路 (a)(b) で Gamepad が使えるか**（使えなければ M21 は成立しない） | **両経路で使える。** 経路 (c) は**未測定**（**試行したが LAN 経由でページに到達できず、Gamepad API を実行していない**。D-309 によりブロッカーではない） |
| **2** | **同時押しのズレ幅の分布** | **2 機種とも中央値 8.30 ms。**p95 は レバーレス 20.90 ms / パッド 33.30 ms、最大は 20.90 ms / 45.80 ms。**離し始めのズレは押し始めより一貫して大きい** |
| **3** | **チャタリングの実態** | **2 機種とも観測されなかった**（立ち上がり 50 回 / 50 回、多重立ち上がり 0 件、候補値 1〜128 ms すべてで 0 件） |

**★ただし「1 機種のみ」ではないが「2 機種のみ」である。** 一般化しない（指示書 §5）。

**★本報告は閾値・判定方式を提案しない**（指示書 §0.1 / §0.3）。分布と件数のみを出す。

**★フレーム数の解釈に注意。** 計測環境のディスプレイは **約 238 Hz**（rAF 間隔中央値 4.20 ms）である。
**60 Hz 環境では同じ実時間が約 1/4 のフレーム数になる。**判定窓をフレーム単位で置く場合、
本報告のフレーム数をそのまま持ち込めない。**ミリ秒の値が一次で、フレーム数は本環境での換算値である。**

---

## 1. 計測条件

| 項目 | 値 |
|---|---|
| OS | Windows 10（`Windows NT 10.0; Win64; x64`） |
| ブラウザ | **Chrome 151.0.0.0**（`Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36`） |
| 画面 | 1920×1080 / DPR 1 |
| リフレッシュレート | **約 238 Hz**（rAF 間隔中央値 4.20 ms の逆数からの推定。**ブラウザからの直接取得値ではない**） |
| 計測日 | 2026-08-12 |
| ハーネス版 | 1.0.0 |
| **測った機種** | **2 機種**（下表） |
| **ブラウザ** | **1 種のみ**（Chrome。Firefox / Edge は未測定） |

### 1.1 計測機種（★2 機種。合算していない）

| | **レバーレス** | **パッド** |
|---|---|---|
| 機種名（開発者入力） | **RushBox Mini** | **GameSir G7 SE** |
| 接続方式 | USB | USB |
| `Gamepad.id` | `Xbox 360 Controller (XInput STANDARD GAMEPAD)` | `Xbox One Game Controller (STANDARD GAMEPAD)` |
| `mapping` | `standard` | `standard` |
| ボタン数 / 軸数 | 17 / 4 | 17 / 4 |
| 計測時刻 | 17:40:37 〜 17:44:55 | 17:46:06 〜 17:52:03 |
| 生ログ | `m21-poc_RushBox-Mini_USB_2026-08-12T17-44-55.json`（553 KB） | `m21-poc_GameSir--G7-SE_USB_2026-08-12T17-52-03.json`（499 KB） |
| 記録フレーム数 / イベント数 | 19,526 / 568 | 18,630 / 741 |

> **★開発者の申告（計測条件として記録）**: **パッド（GameSir G7 SE）は開発者が普段使っていない機種**であり、
> 「少し入力が下手」との申告があった。**数値は除外していない。**実測上もパッドの方が分布が広く
> （p95 で 33.30 ms 対 20.90 ms）、セット 1 の最大 41.70 ms がセット 2 で 25.10 ms に縮んでいる。
> **レバーレス側にこの傾向はない。**この差が機種の性質か習熟かは本 PoC では切り分けていない。

---

## 2. 各項目の実測値

### A. 経路ごとの取得可否

#### A-1: コントローラが列挙されるか

| 経路 | URL の形 | 実測 origin | secure context | 結果 |
|---|---|---|---|---|
| **(a)** 使い捨てハーネス | `http://localhost:<port>` | `http://localhost:47380` | `true` | **★列挙された**（2 機種とも） |
| **(b)** 本体アプリ | `http://localhost:<port>` | **`http://localhost:47319`** | `true` | **★列挙された** |
| **(c)** LAN 内の別端末 | `http://<LAN IP>:<port>` | — | — | **未測定**（「測ったが 0 件」ではない。§3 参照） |

**経路 (b) の実測値（逐語）**:

```json
{
  "結果": "列挙された",
  "経過ms": 1297,
  "secure": true,
  "origin": "http://localhost:47319",
  "pads": [
    {
      "id": "Xbox One Game Controller (STANDARD GAMEPAD)",
      "index": 0,
      "mapping": "standard",
      "buttons": 17,
      "押されていたボタン": [2]
    }
  ]
}
```

- **経路 (a) と (b) で `Gamepad.id`・`mapping`・ボタン数が一致**している（パッドの場合）。
- **★経路 (b) のポートは 47318 ではなく 47319 だった。** 既定ポート 47318 が使用中だったため
  次の空きポートへ自動探索した結果である（`DES-002` §3.3 の仕様どおり）。
  **⇒ 実運用で origin のポートは固定ではない。**

#### A-2: 列挙に user gesture が要るか

**★3 経路すべてで「要る」。** 判定材料は下表。

| 経路 / 機種 | 静止 5 秒内に列挙されたか | 列挙されたフレームで押されていたボタン | 判定 |
|---|---|---|---|
| (a) レバーレス | されなかった（初回検出 = 読込から 17,215 ms） | `[15]` | **必要** |
| (a) パッド | されなかった（初回検出 = 読込から 6,816 ms） | `[3]` | **必要** |
| (b) パッド | — | `[2]`（ポーリング開始から 1,297 ms） | **必要** |

**★判定方法についての注記（重要）**:
「列挙より前にボタンが押されたか」は**原理的に記録できない**。コントローラが列挙されるまで
ボタンの状態は観測できないためである。したがって本 PoC は
**(1) 何も押さない静止期間 5 秒の間に列挙されるか ／ (2) 列挙されたそのフレームで既にボタンが押されていたか**
の 2 点で判定している。**3 経路とも (1) が「されなかった」かつ (2) が「押されていた」であり、判定は一致している。**

**⇒ 実装上の含意（事実のみ）**: **入力 UI を開いた直後は `navigator.getGamepads()` が空を返す。**
利用者が最初の 1 回を押すまでコントローラは見えない。

#### A-3: `gamepadconnected` / `gamepaddisconnected` の発火

| 機種 | `gamepadconnected` | `gamepaddisconnected` | 検査した記録件数 |
|---|---:|---:|---:|
| レバーレス | **1 回** | 0 回 | 1 件 |
| パッド | **1 回** | 0 回 | 1 件 |

**両機種とも `gamepadconnected` は発火した。** 計測中に切断していないため `gamepaddisconnected` は 0 回である
（**「発火しない」ことの確認ではない**＝切断操作を課題に含めていない）。

#### A-4: 取得できなかった場合のコンソールメッセージ

**経路 (a)(b) では取得できたため、本項に該当する事象は発生していない。**

- ハーネスが捕捉したページ内メッセージ: **レバーレス 0 件 / パッド 0 件**（**検査した記録 各 0 件**）。
- `navigator.getGamepads()` は例外を投げなかった（例外を捕捉して逐語記録する経路を実装済み・発火なし）。
- **★限界**: ブラウザ内部が出す警告（secure context 由来の警告等）は **JS からは取得できない**。
  経路 (c) を測る場合は DevTools の Console を別途逐語で控える必要がある。

---

### B. ポーリング周期と入力遅延

#### B-1: `requestAnimationFrame` の実測間隔

| 区間 | 機種 | 中央値 | p50 | p90 | p95 | p99 | 最小 | 最大 | 標本 |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|
| 全区間 | レバーレス | **4.20 ms** | 4.20 | 4.20 | 4.30 | 4.30 | 3.70 | 8.30 | 19,520 |
| 全区間 | パッド | **4.20 ms** | 4.20 | 4.20 | 4.30 | 4.30 | 3.50 | 4.90 | 18,624 |
| ウォームアップのみ | レバーレス | 4.20 ms | 4.20 | 4.20 | 4.30 | 4.30 | 4.00 | 8.30 | 719 |
| ウォームアップのみ | パッド | 4.20 ms | 4.20 | 4.20 | 4.30 | 4.30 | 4.00 | 4.30 | 720 |

- **リフレッシュレート推定 = 約 238.1 Hz**（中央値の逆数）。**ブラウザからの直接取得値ではない。**
- ウォームアップ（開発者の操作が一切ない 3 秒間）でも同じ中央値であり、**入力の有無で周期は変わらない。**
- **★60 Hz 環境では 16.7 ms 前後になるはずであり、本報告のフレーム数はそのまま移せない。**

#### B-2: 押してから `pressed` が `true` になるまでの遅延

**★直接は測定できなかった。理由**: ボタンが物理的に押された時刻を示す**外部基準が無く**、
ハーネスが観測できるのは rAF で読んだ時刻のみであるため。
（指示書 §4 B-2 が「測れない場合は『測れない』とその理由を書く」として想定している条件そのもの。）

**代理値**として「rAF 時刻 − `Gamepad.timestamp`」＝ **入力が記録されてから rAF が読み取るまでの経過**を出す。

| 機種 | 中央値 | p50 | p90 | p95 | p99 | 最小 | 最大 | 標本 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| レバーレス | **2.30 ms** | 2.30 | 4.00 | 4.20 | 4.50 | 0.20 | 4.50 | 435 |
| パッド | **2.30 ms** | 2.30 | 3.90 | 4.20 | 4.40 | **−0.20** | 4.60 | 773 |

- **`timestamp` が更新されたフレームのみが対象。**
- **両者が同一の時計であることを示す傍証**: 更新直後の差は約 2〜3 ms に収まり、最大が rAF 間隔（4.2 ms）とほぼ一致する。
  **これはポーリング周期の範囲内で読み取っていることと整合する。**（**同一時計であると断定はしない。**ブラウザ実装依存）
- パッドの最小 **−0.20 ms** はごく小さい負値であり、**桁違いの負値ではない**（時計が別系統なら桁で外れる）。

#### B-3: `Gamepad.timestamp` は更新されるか

| 機種 | 更新ありフレーム | 更新なしフレーム | 更新率 | 検査した差分 |
|---|---:|---:|---:|---:|
| レバーレス | 435 | 19,085 | **2.2%** | 19,520 件 |
| パッド | 773 | 17,851 | **4.2%** | 18,624 件 |

**★「B-1 の rAF 間隔と一致するか」への答えは No。**
`timestamp` は**ポーリングのたびではなく、パッドの状態が変化したときだけ更新される。**

非ゼロ差分の分布（＝**ポーリング周期ではなく入力の間隔**を表す）:

| 機種 | 中央値 | p50 | p90 | p95 | p99 | 最小 | 最大 | 標本 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| レバーレス | 91.85 ms | 91.80 | 408.20 | 437.10 | 737.20 | 4.70 | 2,289.90 | 430 |
| パッド | 21.95 ms | 21.70 | 265.80 | 308.30 | 653.70 | 4.40 | 2,160.20 | 768 |

> **★各 run の最初の更新は除外している。** `timestamp` は入力時にしか動かないため、run 開始時の値は
> 「その run より前の最後の入力」を指しており、**最初の非ゼロ差分は計測していない待ち時間を丸ごと含む。**
> **除外しない場合、実測で 236,736 ms（約 3.9 分）という値が混入した**（パッドの T1 セット 1）。
> これは機器の挙動ではなく集計上の副作用である。

---

### C. 同時押しのズレ幅（FR107）

**課題**: 2 ボタン同時押しを **30 回 × 3 セット = 90 回**（機種ごと）。**普段どおりの速さで。**

#### C-1 / C-2: 押し始めのズレの分布

| 機種 | 単位 | 中央値 | p50 | p90 | p95 | p99 | 最小 | 最大 | 標本 |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|
| **レバーレス** | **ms** | **8.30** | 8.30 | 16.70 | **20.90** | **—（N 不足）** | 0.00 | **20.90** | **90** |
| **レバーレス** | フレーム | 2.0 | 2.0 | 4.0 | 5.0 | —（N 不足） | 0.0 | 5.0 | 90 |
| **パッド** | **ms** | **8.30** | 8.30 | 20.80 | **33.30** | **—（N 不足）** | 0.00 | **45.80** | **90** |
| **パッド** | フレーム | 2.0 | 2.0 | 5.0 | 8.0 | —（N 不足） | 0.0 | 11.0 | 90 |

- **p99 は出していない。** 標本 90 件では nearest-rank 法で p99 を出す標本数（100 件）に満たないため
  （指示書 §4.5.4 が「標本 90 ではパーセンタイル 99 は境界的」と予告していたとおり）。
- **最小 0.00 ms（0 フレーム）が両機種で発生している** = 同一ポーリングフレームで両ボタンが `pressed` になった回。
- **中央値は 2 機種で一致（8.30 ms = 2 フレーム）だが、裾がパッドで広い。**

#### C-2 セット別（慣れの影響）

| 機種 | セット | 標本 | 中央値 | p90 | p95 | 最大 |
|---|---:|---:|---:|---:|---:|---:|
| レバーレス | 1 | 30 | 6.25 ms | 16.70 | 20.90 | 20.90 |
| レバーレス | 2 | 30 | 8.40 ms | 20.80 | 20.90 | 20.90 |
| レバーレス | 3 | 30 | 4.20 ms | 16.70 | 20.80 | 20.90 |
| パッド | 1 | 30 | 8.30 ms | 29.20 | 33.40 | **41.70** |
| パッド | 2 | 30 | 8.30 ms | 16.70 | 20.80 | **25.10** |
| パッド | 3 | 30 | 6.25 ms | 16.70 | 33.40 | **45.80** |

- **レバーレスはセット間で最大値がほぼ動かない**（20.90 / 20.90 / 20.90）。
- **パッドは最大値がセットで動く**（41.70 → 25.10 → 45.80）。**単調な改善ではない。**
- **★この差の原因（機種の性質か、開発者の習熟か）は本 PoC では切り分けていない。**

#### C-3: 3 ボタン同時押し

**★該当なし。判断の根拠を以下に示す。**

- **本 PoC は 3 ボタンを押す課題を出していない。**課題 (1) は 2 ボタン同時押しである。
- レバーレス: **3 ボタン以上を含む押下グループ 0 件 / 検査したグループ 90 件。**
- パッド: **3 ボタン以上を含む押下グループ 2 件 / 検査したグループ 90 件。**
  **ただしこの 2 件は「3 ボタン同時押し」ではない**——内訳は次のとおりで、
  **3 つ目が明確に遅れて到達しており、先の 2 つを押したまま 3 つ目を重ねた入力**である。

  | ボタン | 2 つ目の到達 | 3 つ目の到達 |
  |---|---:|---:|
  | `[1, 2, 3]` | +0.0 ms | **+83.3 ms（20 フレーム）** |
  | `[4, 6, 13]` | +0.0 ms | **+25.0 ms（6 フレーム）** |

  **⇒ この 2 件は同時押しの標本として扱っていない。**なお **2 つ目までのズレ（いずれも 0.0 ms）は
  有効な 2 ボタン同時押しの標本として C-2 に算入している**（グループごと捨てると実測を落とすため）。

#### C-4: 押し始めと離し始めを分けた比較

| 機種 | 向き | 単位 | 中央値 | p90 | p95 | 最大 | 標本 |
|---|---|---|---:|---:|---:|---:|---:|
| レバーレス | 押し始め | ms | 8.30 | 16.70 | 20.90 | 20.90 | 90 |
| レバーレス | **離し始め** | ms | **12.50** | **25.00** | **33.30** | **50.00** | 90 |
| レバーレス | 離し始め | フレーム | 3.0 | 6.0 | 8.0 | **12.0** | 90 |
| パッド | 押し始め | ms | 8.30 | 20.80 | 33.30 | 45.80 | 90 |
| パッド | **離し始め** | ms | **12.50** | **29.30** | **37.60** | **83.30** | 90 |
| パッド | 離し始め | フレーム | 3.0 | 7.0 | 9.0 | **20.0** | 90 |

**★離し始めのズレは、押し始めより一貫して大きい。**
中央値で 1.5 倍（12.50 対 8.30 ms）、最大で 2.4 倍〜1.8 倍（50.00 対 20.90 ／ 83.30 対 45.80 ms）。
**2 機種・両方向で同じ向きの差が出ている。**

**どちらを判定に使うかは本 PoC では決めない**（指示書 §4 C-4）。

---

### D. チャタリングの実波形（FR108）

**課題**: 1 ボタンを 1 回だけ押す（素早く 1 回・連打しない）を **50 回**（機種ごと）。

#### D-1: 立ち上がりの回数

| 機種 | 立ち上がり総数 | 画面カウンタ | 指示回数 | 押下グループ内の多重立ち上がり | 検査したグループ |
|---|---:|---:|---:|---:|---:|
| レバーレス | **50 回** | 50 | 50 | **0 件** | 50 件 |
| パッド | **50 回** | 50 | 50 | **0 件** | 50 件 |

**★「多重立ち上がり 0 件」だけでは「チャタリングなし」と読めない。**
この見方は「押しっぱなしのまま同じボタンが再度立ち上がった」場合しか捉えず、
**いったん離れてから跳ね返る型のバウンスはグループ自体を分断するため、ここには現れない。**
そこで下記 D-2 の 3 つの見方を併せて出す。

**★立ち上がり総数が 50 回ちょうどであること自体が判断材料になる。**
チャタリングが起きていれば 1 回の押下で画面カウンタが 2 進むため、**指示 50 回に到達するまでの
物理的な押下回数が 50 回未満になる**（＝立ち上がり総数 > 実際の押下回数）。
**2 機種とも 50 / 50 / 50 で完全に一致した。**

#### D-2: 3 つの見方による分布

| 機種 | 指標 | 中央値 | p90 | p95 | 最小 | 最大 | 標本 |
|---|---|---:|---:|---:|---:|---:|---:|
| レバーレス | 立ち上がり間隔 | 4,062.60 ms | 5,637.60 | 7,229.30 | **108.30** | 8,645.90 | 41 |
| レバーレス | **押下時間 (ON)** | 43.70 ms | 58.30 | 58.40 | **8.30** | 70.90 | 50 |
| レバーレス | **離間時間 (OFF)** | 4,045.90 ms | 5,600.10 | 7,216.90 | **95.80** | 8,612.70 | 41 |
| パッド | 立ち上がり間隔 | 1,445.85 ms | 5,816.80 | 6,546.00 | **633.40** | 8,087.60 | 42 |
| パッド | **押下時間 (ON)** | 89.55 ms | 129.20 | 145.80 | **58.40** | 154.20 | 50 |
| パッド | **離間時間 (OFF)** | 1,337.55 ms | 5,691.70 | 6,391.80 | **541.70** | 7,975.00 | 42 |

**候補値ごとの件数（★閾値の提案ではない。件数の表である）**:

| 値 | レバーレス 立上り間隔<br>(検査 41 件) | レバーレス 押下時間<br>(検査 50 件) | レバーレス 離間時間<br>(検査 41 件) | パッド 立上り間隔<br>(検査 42 件) | パッド 押下時間<br>(検査 50 件) | パッド 離間時間<br>(検査 42 件) |
|---:|---:|---:|---:|---:|---:|---:|
| 1 ms 未満 | 0 | 0 | 0 | 0 | 0 | 0 |
| 2 ms 未満 | 0 | 0 | 0 | 0 | 0 | 0 |
| 4 ms 未満 | 0 | 0 | 0 | 0 | 0 | 0 |
| 8 ms 未満 | 0 | 0 | 0 | 0 | 0 | 0 |
| 16 ms 未満 | 0 | 0 | 0 | 0 | 0 | 0 |
| 32 ms 未満 | 0 | 0 | 0 | 0 | 0 | 0 |
| 64 ms 未満 | 0 | — | — | 0 | — | — |
| 128 ms 未満 | **1** | — | — | 0 | — | — |

最短 10 件（ms）:

| 機種 | 立ち上がり間隔 | 押下時間 | 離間時間 |
|---|---|---|---|
| レバーレス | 108.3, 895.8, 900.0, 916.6, 954.2, 1170.9, 1358.4, 1366.7, 1375.1, 1787.5 | 8.3, 12.4, 12.5, 12.5, 16.6, 16.6, 16.7, 20.9, 20.9, 20.9 | 95.8, 845.7, 845.9, 879.2, 920.8, 1100.0, 1316.7, 1316.7, 1316.7, 1770.9 |
| パッド | 633.4, 691.6, 920.9, 979.1, 1020.9, 1191.7, 1254.1, 1254.2, 1262.5, 1262.6 | 58.4, 58.4, 62.5, 62.5, 62.5, 66.6, 66.7, 70.8, 70.9, 70.9 | 541.7, 629.1, 837.6, 904.1, 954.3, 1104.2, 1162.5, 1183.4, 1183.4, 1191.7 |

**★実測の要旨（事実のみ）**:

- **1 ms〜32 ms の帯に、3 指標とも 2 機種とも 1 件も入っていない。**
  一般にチャタリングは数ミリ秒単位のバウンスとして現れるが、**その帯域は完全に空である。**
- レバーレスの立ち上がり間隔 **最短 108.3 ms** は、離間時間 **95.8 ms** と対応する。
  **95.8 ms の「離している時間」はバウンスの時間スケールではない**（次点は 845.7 ms）。
- レバーレスの押下時間 **最短 8.3 ms（2 フレーム）** は、**素早いタップとして説明できる範囲**であり、
  同機種の押下時間中央値 43.70 ms に対する外れ値ではあるが 1 ms 帯ではない。

**⇒ 事実として: 本計測条件（2 機種・Chrome 151・USB 接続・各 50 回）では、
チャタリングと解釈できる波形は観測されなかった。**

**★これは指示書 §5 が言う `E-41` 型の「対策が不要」という第三の結論の候補である。**
**ただし 2 機種のみであり、一般化しない。**

#### D-3: `buttons[i].value`（アナログ値）

**★機種で明確に分かれた。合算していない。**

| 機種 | 結果 | 検査した長押し |
|---|---|---:|
| **レバーレス** | **0/1 以外の値は観測されなかった**（全長押しで `[0, 1]` の 2 値のみ） | 3 件 |
| **パッド** | **0/1 以外の値を観測した** | 3 件 |

長押し 1 回ごとの内訳:

| 機種 | 回 | ボタン | 押下時間 | 値の変化 | 相異なる値 |
|---|---:|---:|---:|---:|---|
| レバーレス | 1 | 2 | 1,779 ms | 2 回 | 2 種 `[0, 1]` |
| レバーレス | 2 | 3 | 2,292 ms | 2 回 | 2 種 `[0, 1]` |
| レバーレス | 3 | 7 | 2,175 ms | 2 回 | 2 種 `[0, 1]` |
| パッド | 1 | 2 | 2,471 ms | 2 回 | 2 種 `[0, 1]` |
| **パッド** | **2** | **7** | **2,296 ms** | **12 回** | **12 種**（下記） |
| パッド | 3 | 4 | 2,171 ms | 2 回 | 2 種 `[0, 1]` |

パッドの button 7 で観測された値（押下から離すまでの推移）:

```
0, 0.1378299120234604, 0.18866080156402737, 0.30791788856304986,
0.41935483870967744, 0.570869990224829, 0.6647116324535679,
0.7908113391984359, 0.8641251221896383, 0.9374389051808406,
0.9491691104594331, 1
```

- **button 7 は standard mapping の右トリガーであり、アナログ入力である。**
  **押し込みの途中経過が 12 段階で観測されている**（0 → 1 への単調増加）。
- **同じ button 7 でもレバーレスでは `[0, 1]` の 2 値のみ**であり、**押し込みの途中経過が存在しない。**
- **★D-4 が「機種で分かれる蓋然性が高いので合算するな」と指示していた事象が、実際にここで現れた。**

#### D-4: 機種ごとの分離

**2 機種すべてで測定でき、本報告は全項目を機種ごとに分けて出している。合算した数値は 1 つも出していない。**
**片方が測れなかった項目は無い。**

---

## 3. 測れなかった項目と、その理由

**★「未測定」と「測ったが 0 件」を分けて記載する**（`E-84`）。

### 3.1 未測定（測っていない）

| 項目 | 状態 | 理由 |
|---|---|---|
| **経路 (c)**（`http://<LAN IP>`＝非 secure context） | **未測定**（**試行はしたが、ページに到達できなかった**） | **D-309 によりブロッカーではない**（スマホへのコントローラ接続は M21 対象外）。**開発者が試行したが LAN 経由でページへ到達できなかった**（2026-08-12）。**⇒ Gamepad API は一度も実行されておらず、「取得できなかった」ではなく「取得可否を測っていない」。**<br>**★到達しなかった理由の推定**（未検証）: ハーネスの配信サーバは `0.0.0.0` で待ち受けているが、**devContainer は Docker ブリッジ（172.17.0.2）上にあり、VS Code のポート転送は既定でホストの localhost にのみバインドする**ため、LAN の他端末からは届かない。**測るなら Windows 側で静的サーバを立てる等、配信元を変える必要がある** |
| **Chrome 以外のブラウザ**（Firefox / Edge） | **未測定** | 指示書の課題に含まれていない。**本報告の全数値は Chrome 151 単独の実測である** |
| **`gamepaddisconnected` の発火** | **未測定** | 切断操作を課題に含めていないため。**「発火しなかった」ではない** |
| **B-2 の絶対遅延** | **測定不可** | 外部時刻基準が無いため（§2 B-2）。代理値のみ提示 |

### 3.2 測ったが 0 件（測定済み・該当なし）

| 項目 | 結果 | 検査した件数 |
|---|---|---|
| 押下グループ内の多重立ち上がり | **0 件** | 各機種 50 グループ |
| 立ち上がり間隔 32 ms 未満 | **0 件** | レバーレス 41 件 / パッド 42 件 |
| 押下時間 32 ms 未満 | **0 件** | 各機種 50 件 |
| 離間時間 32 ms 未満 | **0 件** | レバーレス 41 件 / パッド 42 件 |
| ページ内のエラー・警告メッセージ | **0 件** | レバーレス 0 件 / パッド 0 件 |
| `navigator.getGamepads()` の例外 | **0 件**（捕捉経路は実装済み） | 全フレーム（レバーレス 19,526 / パッド 18,630） |
| 3 ボタン同時押し | **0 件**（§2 C-3 の根拠参照） | 各機種 90 グループ |

### 3.3 課題の実施状況と、指示との差異

| 課題 | 指示 | レバーレス実績 | パッド実績 |
|---|---|---|---|
| (1) 2 ボタン同時押し | 30 回 × 3 セット | **90 グループ**（30/30/30） | **90 グループ**（30/30/30） |
| (2) 1 ボタン単押し | 50 回 | **50 回** | **50 回** |
| (3) 3 秒長押し | 3 回 | **3 回**（1,779 / 2,292 / 2,175 ms） | **3 回**（2,471 / 2,296 / 2,171 ms） |

**★指示との差異 2 件（事実として記録）**:

1. **(3) の長押しは 3 秒に達していない**（実測 1.78〜2.47 秒）。**D-3 のアナログ値推移の観測には支障がなかった**
   （パッドの button 7 で 12 段階を取得できている）が、**「3 秒間の値の揺れ」としては短い。**
2. **(2) は 1 つのボタンではなく複数のボタンで実施された**（レバーレス 9 ボタン: 0,1,2,3,5,7,13,14,15 ／
   パッド 8 ボタン: 0〜7）。**結果として 1 ボタンあたりの標本が 3〜10 件に分散し、
   ボタン単位の立ち上がり間隔ではパーセンタイルを出せない**（表では「N 不足」と明示）。
   **一方で、より多くの物理スイッチを検査したことになる**（レバーレス 9 個・パッド 8 個）。
   **どちらが望ましいかは本 PoC では判断しない。**

---

## 4. 想定外の発見（§0.3 が許可する事実指摘）

### 4.1 ★配布バイナリが既存 DB のある環境で起動できなかった

**経路 (b) の確認中に発生した実障害である。M21 の範囲外だが、配布（`DES-002` §11.2）に直結するため記録する。**

- **事象**: `make build-windows` で生成した `combomgr-windows-amd64.exe` を Windows で起動したところ、
  **マイグレーション 000026 で失敗して起動できなかった。**

  ```
  fatal: migration: migration: up: constraint failed:
  UNIQUE constraint failed: moves.character_id, moves.code (2067) in line 0:
  -- 000026_seed_moves_first_wave.up.sql
  ```

- **2 回目以降**: golang-migrate が dirty フラグを立てるため、以降は即停止する。

  ```
  fatal: migration: migration: up: Dirty database version 26. Fix and force version.
  ```

- **★マイグレーション自体は正常である（実測で確認）**: devContainer でまっさらな DB に全マイグレーションを
  適用したところ、**`schema_migrations = (68, 0)`（dirty なし）／`moves` 1,653 行／`characters` 19 行／
  `games` 1 行／`terry` は 1 行で 79 技**となり、正常に完了した。
- **⇒ 原因は `%APPDATA%\combomgr\combomgr.db` に残っていた既存 DB**（旧ビルドが作ったもの）である。
- **回避**: `COMBOMGR_DB_PATH` に別ファイルを指定して起動した（PoC はこれで完結）。
- **★既存 DB には製造側から一切触れていない。**
  **【2026-08-12 開発者判断】当該 DB は「もう使っていないので削除してよい」**。
  **⇒ 本件の実インスタンスに保全すべきデータは無かった。削除は開発者が行う**
  （`CLAUDE.md` §10 により Claude Code は `*.db` の直接削除を行わない。加えて当該ファイルは
  Windows 側にありコンテナから到達できない）。
- **★ただし、この開発者判断は事象そのものを消さない。** **本 PoC で観測されたのは
  「旧ビルドの DB が残っている環境では、新しい配布バイナリが起動できない」という挙動**であり、
  **今回のインスタンスが不要だったこととは別の事実である。**

**★事実としての含意**: **既存利用者の環境へ新しい配布バイナリを置くと、DB の状態次第で起動できない。**
本 PoC はこの原因究明・修正を行わない（スコープ外）。

### 4.2 指示書と実ファイルの食い違い 4 件

| # | 内容 |
|---|---|
| 1 | **`DES-002` の参照節がずれている。** 指示書 §3.1 と主参照、および `docs/process/m21-contract.md` の **F-6** は「`02-architecture.md` §11・§14（LAN 利用・バインド）」とするが、**実査では §11 は「対応OSとパッケージング・配布」、§14 は「未決定事項」**であり LAN・バインドの記述は無い。**実体は §3.2（バインドアドレスの制御）・§3.3（ポート番号 47318）・§3.4（公開状態の明示と警告）。** 同じ誤りが 2 文書に入っている |
| 2 | **DoD の項目数が実数と合わない。** 指示書 §6 は「A-1 〜 D-4 の計 **16** 項目」とするが、**v1.1.0 で A-5 を削除したため実数は 15 項目**（A4 + B3 + C4 + D4）。本報告は 15 項目すべてを扱っている |
| 3 | **「開発者への確認事項」2 件が解決済みのまま残置している。** 確認事項 1 は**削除済みの A-5** を参照し、確認事項 2 は**是正済みの「100 回」**を参照する（いずれも更新履歴では D-309 / v1.2.0 で解決済みと記録されている） |
| 4 | **★DoD と禁止事項が直接衝突している（2 本連続で再演）。** 指示書 **§6 DoD** は「`docs/progress/progress-log.md` へ索引行を追記した」を完了条件に置くが、**§0.2' の禁止表と §2.2** は「**`docs/` 配下の他ファイルを変更する**」を禁じている。**同じ指示書の中で、片方を満たすともう片方に違反する。**<br>**⇒ 本報告は追記した**（**M20-RESEARCH-01 で同型の衝突が起き、2026-08-12 の開発者判断で追記を実施した先例**に従った。`progress-log.md` の M20-RESEARCH-01 エントリ 横断課題 1）。<br>**★これは 1 本の指示書の誤記ではなく、read-only 系 RESEARCH 指示書のテンプレートと `CLAUDE.md` §8 の常設要求が両立していないことによる。** **2 本連続で、実行者に「read-only 逸脱かどうか」の判定を独断させている。** 個別の指示書ではなく**テンプレート側の対処が要る**（設計担当宛） |

### 4.3 ★A-2 は「列挙より前の入力」では判定できない

**当初の解析は「初回検出時刻 ≤ 初回ボタン入力時刻なら gesture 不要」と判定していたが、これは構造的に誤りである。**

- **コントローラが列挙されるまで、ボタンの状態は観測できない。**したがって
  **「列挙より前にボタンが押された」という記録は原理的に作れない。**
- 実ブラウザでは**検出と初回ボタン入力が同一フレームに乗る**（実測でレバーレス・パッドとも
  `初回検出 = 初回ボタン入力` の時刻が一致）。当初の判定式ではこれが「gesture 不要」と出てしまう。
- **⇒ 静止期間内の列挙の有無 ＋ 列挙フレームでの押下の有無 で判定するよう是正した**（§2 A-2）。

**この欠陥は、実機計測の前に段 1 の自己検査で検出した**（`selftest_harness_sim.js` が
「押した瞬間に列挙される」実ブラウザの挙動を再現したため）。**実測後に発覚していれば、
A-2 の答えが 3 経路すべてで逆になっていた。**

### 4.4 集計上の副作用を 1 件是正した

`Gamepad.timestamp` の差分集計で **236,736 ms（約 3.9 分）** という値が出た。
**機器の挙動ではなく、各 run の最初の差分が「計測前の待ち時間」を含むことによる副作用**であった。
**各 run の最初の更新を除外して是正済み**（§2 B-3）。

---

## 5. M21 本実装のスコープ確定のための要決定事項

**★以下は事実の提示であり、判断・提案ではない。**

1. **経路 (a)(b) で Gamepad が使えるか** → **使える（実測）。**
   **⇒ M21 は成立する。**
   ただし **user gesture が必須**であり、**入力 UI を開いた直後は列挙されない**という制約が全経路で共通に存在する。
   **経路 (c) は未測定**（**試行したが LAN 経由でページに到達できず、Gamepad API を一度も実行していない**。
   **「取得できなかった」ではない**＝`E-84`。D-309 によりブロッカーではない）。

2. **同時押しのズレ幅の分布** → **判定窓の材料は下記。**
   - **中央値 8.30 ms（2 機種一致）／ p95 は 20.90 ms（レバーレス）〜 33.30 ms（パッド）／
     最大は 20.90 ms 〜 45.80 ms。標本各 90 件。**
   - **p99 は標本不足で出していない。**
   - **押し始めと離し始てで分布が違う**（離し始めが一貫して大きい。中央値 12.50 ms / 最大 50.00〜83.30 ms）。
     **どちらを判定に使うかは未決。**
   - **★フレーム数で決める場合、本計測は約 238 Hz 環境である。**60 Hz 環境への換算が要る。

3. **チャタリングの実態** → **本計測条件では観測されなかった。**
   - 立ち上がり総数 = 指示回数 = 画面カウンタ = **50 / 50 / 50**（2 機種とも）。
   - **1〜32 ms の帯に 3 指標とも 0 件**（検査件数は §2 D-2 の表に明記）。
   - **⇒ 「FR108 の対策が現行 2 機種では不要」という第三の結論の候補**（`E-41` 型）。
   - **★2 機種のみであり一般化しない。** 機種を増やすか、対策の要否を別の根拠で決める必要がある。

4. **アナログ値の扱い**（新たに判明した論点）
   - **パッドのトリガー（button 7）は 12 段階の中間値を返す。レバーレスは 0/1 のみ。**
   - **⇒ `pressed`（デジタル）だけを見るか `value`（アナログ）も見るかで、機種による挙動差が出る面がある。**
   - **本 PoC は「どちらを使うか」を決めない。**

5. **測っていない範囲**（本実装の前提にする場合は追加計測が要る）
   - **ブラウザは Chrome 151 のみ。** Firefox / Edge は未測定。
   - **接続方式は USB のみ。** Bluetooth は未測定。
   - **機種は 2 種のみ。** アケコン・キーボードは未測定
     （`DES-005` §6.2〜§6.5 は 4 レイアウト＝レバーレス／アケコン／PS5 パッド／キーボードを将来仕様として温存している）。

---

## 6. 開発者への操作手順（段 2 で実際に使ったもの）

段 2 で使用した手順書の全文は `tmp/m21-poc/README-developer.md`（**リポジトリ追跡外**）にある。要旨は以下。

1. **準備**: devContainer で `cd /workspaces/combomgr/tmp/m21-poc && python3 serve.py`
   → VS Code の PORTS で **47380** を転送 → Windows のブラウザで `http://localhost:47380/harness.html` を開く。
2. **検出**: コントローラを接続したまま **5 秒間なにも押さない**（A-2 判定用の静止期間）
   → 画面の指示に従いボタンを 1 回押す → `Gamepad.id` が埋まることを確認。
   **埋まらなければそこで止めて報告**（`E-77`）。
3. **機種情報**: **機種名と接続方式のみ**を入力（人が入れる唯一の項目）。
4. **計測**: 画面のカウンタに従って 3 課題を実施（§3.3 の表）。**回数は数えない。所感は申告しない。**
5. **保存**: 「サーバへ送信」または「JSON をダウンロード」。**機種ごとにファイルを分ける。**
6. **経路 (b)**: `make build-windows`（**devContainer 内**）→ Windows で
   `$env:COMBOMGR_DB_PATH = "m21-poc.db"` を設定して exe を起動 → DevTools Console で判定スニペットを実行。

**★段 2 で実際に発生したつまずき 3 件**（同じ手順を再実行する場合の注意。手順書へ反映済み）:

| # | 事象 | 原因 |
|---|---|---|
| 1 | `make: The term 'make' is not recognized` | **`make build-windows` を PowerShell に貼った。**Windows 側に make / Go / pnpm は無い。**devContainer 内で実行するコマンド** |
| 2 | 起動時に `UNIQUE constraint failed` → `Dirty database version 26` | **既存の `%APPDATA%\combomgr\combomgr.db`**（§4.1）。`COMBOMGR_DB_PATH` で回避 |
| 3 | DevTools の「Copy object」が `{}` しか返さない | **スニペットが Promise を返していた。**`copy(JSON.stringify(await (...)(), null, 2))` の形にすれば解決（`copy()` の戻り値が `undefined` と表示されるのは正常） |

---

## 7. 検証状況（段 1 の自己検査）

**ハーネスと解析スクリプトは、実機計測の前に通しで検査してある**（`E-84` ＝ 検査が動いていることを先に確かめる）。

```bash
cd /workspaces/combomgr/tmp/m21-poc
node selftest_harness_sim.js            # harness.html の <script> を実コードのまま Node で実行
python3 analyze.py logs/SIMULATED.json  # その出力を解析へ通す
```

- `selftest_harness_sim.js` は **`harness.html` の `<script>` をそのまま `vm` で実行**し、
  台本どおりに動く偽ゲームパッドを与えて JSON を生成する。**手書きの fixture ではハーネスと解析の
  食い違いを検出できない**（両方を同じ人間が独立に書いていないため）ので、実コードを走らせている。
- 仕込んだ既知の正解（**同時押しのズレ 1〜4 フレーム × 90 回／バウンス 3 回／アナログ値の揺れ**）が
  **解析側で全件復元できること**を確認済み。バウンスは**立ち上がり間隔・押下時間・離間時間の
  3 つの独立した見方すべてで 3 件**として検出された。
- **この自己検査で 2 件の欠陥を検出し、実機計測の前に是正した**（§4.3 の A-2 判定、および
  離してから跳ね返る型のバウンスを取りこぼす件）。
- `serve.py` は配信・アップロード・**パストラバーサル無害化**（`../../../etc/evil name.json` → `logs/evil-name.json`）・
  不正 JSON の拒否（HTTP 400）を実測確認済み。

**★`logs/SIMULATED.json` は合成データであり実測ではない。**`meta.deviceName` が `SIMULATED Leverless`、
`userAgent` が `SIMULATED (node selftest — not a real browser)` で判別できる。**本報告の数値には一切含めていない。**

---

## 8. 成果物と、リポジトリへの影響

### 8.1 本体リポの diff

**本報告 1 本のみ。** 段 1・段 2・段 3 を通じて、**本体リポのソース／マイグレ／seed／テスト／
`DES`・`REQ` 本体／`web/` 配下／`internal/` 配下を 1 バイトも変更していない。**

```
$ git status --short
（本報告と progress-log への索引行を除き 空）
```

### 8.2 リポジトリ外に置いたもの（commit していない）

**すべて `/workspaces/combomgr/tmp/m21-poc/` 配下**（**リポジトリ直下の `tmp`**。
コンテナの `/tmp` ではない。**`.gitignore:19` の `/tmp/` により全ファイル追跡外**）。

| ファイル | 内容 |
|---|---|
| `harness.html` | 計測ハーネス（**全文は §9 付録**） |
| `serve.py` | 配信サーバ ＋ ログ受け口 |
| `analyze.py` | 段 3 の解析スクリプト |
| `selftest_harness_sim.js` | 段 1 の自己検査 |
| `README-developer.md` | 段 2 の手順書 |
| `HANDOVER-stage3.md` | 段 3 起動用の引継ぎ |
| `logs/*.json` | **生ログ（実測 2 件 ＋ 自己検査 1 件）** |

**ビルド成果物**（`dist/combomgr-windows-amd64.exe`・`web/dist/`）も `.gitignore` 対象（`:92` / `:35`）で追跡外。

### 8.3 ■ 併せて更新が要るもの

| 対象 | 要否 |
|---|---|
| CHANGE 通知書 | **なし**（本 PoC は設計書を変更しない） |
| マイグレーション連番 | **なし**（消費していない） |
| `REQ` / `DES` 本体 | **なし**（FR105〜FR108 は `REQ-001` §3.1 に既存・フェーズ3 割付） |
| `docs/progress/progress-log.md` | **あり**（索引行を追記。`CLAUDE.md` §8。**ただし §4.2-4 の衝突あり**） |
| **指示書 `M21-RESEARCH-01` の是正** | **あり（設計担当宛）**。§4.2 の 4 件（`DES-002` 参照節・DoD の項目数・解決済み確認事項の残置・**DoD と §0.2'／§2.2 の衝突**） |
| **RESEARCH 指示書テンプレートの是正**<br>（`docs/instructions/templates/M{N}-RESEARCH-{NN}-{slug}.template.md`） | **あり（設計担当宛）**。**§4.2-4 は個別の指示書の誤記ではない**——**DoD の「progress-log へ索引行」と read-only 系の「`docs/` 配下を変更しない」が、テンプレート由来で両立していない**。**M20-RESEARCH-01 と本件の 2 本連続で再演**し、いずれも実行者が独断で逸脱判定をしている |
| **`docs/process/m21-contract.md` の F-6 是正** | **あり（設計担当宛）**。§4.2-1 と同じ `DES-002` 誤参照 |
| **`docs/handover/followup-backlog.md`** | **検討要（設計担当宛）**。§4.1 の配布バイナリ起動不能は M21 の範囲外だが、`DES-002` §11.2 に直結する |

---

## 9. 付録: ハーネス全文

**★指示書 §2.1 により、開発者が再現できるようハーネスの全文を貼る**（原本はリポジトリ外・commit していない）。

```html
<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>M21-RESEARCH-01 Gamepad 計測ハーネス</title>
<style>
  :root {
    --bg: #14161a; --panel: #1d2026; --line: #2f343d;
    --fg: #e6e8ec; --muted: #9aa3b0; --accent: #4da3ff;
    --ok: #46c07a; --warn: #e0b341; --ng: #e0574c;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0; padding: 24px; background: var(--bg); color: var(--fg);
    font-family: system-ui, -apple-system, "Segoe UI", "Noto Sans JP", sans-serif;
    line-height: 1.7; font-size: 15px;
  }
  .wrap { max-width: 860px; margin: 0 auto; }
  h1 { font-size: 20px; margin: 0 0 4px; }
  h2 { font-size: 16px; margin: 0 0 12px; border-left: 4px solid var(--accent); padding-left: 10px; }
  .sub { color: var(--muted); font-size: 13px; margin: 0 0 20px; }
  .panel { background: var(--panel); border: 1px solid var(--line); border-radius: 10px; padding: 18px; margin-bottom: 16px; }
  .row { display: flex; gap: 16px; flex-wrap: wrap; align-items: center; }
  .kv { display: grid; grid-template-columns: 190px 1fr; gap: 4px 14px; font-size: 13px; }
  .kv dt { color: var(--muted); }
  .kv dd { margin: 0; word-break: break-all; font-family: ui-monospace, monospace; }
  .badge { display: inline-block; padding: 2px 10px; border-radius: 999px; font-size: 12px; font-weight: 700; }
  .b-ok { background: rgba(70,192,122,.15); color: var(--ok); }
  .b-ng { background: rgba(224,87,76,.15); color: var(--ng); }
  .b-warn { background: rgba(224,179,65,.15); color: var(--warn); }
  button {
    background: var(--accent); color: #08121f; border: 0; border-radius: 8px;
    padding: 10px 18px; font-size: 15px; font-weight: 700; cursor: pointer; font-family: inherit;
  }
  button.sec { background: #333a45; color: var(--fg); }
  button:disabled { opacity: .4; cursor: not-allowed; }
  input, select {
    background: #0f1114; color: var(--fg); border: 1px solid var(--line);
    border-radius: 6px; padding: 8px 10px; font-size: 15px; font-family: inherit;
  }
  .counter { font-size: 46px; font-weight: 800; font-variant-numeric: tabular-nums; letter-spacing: -1px; }
  .counter .of { font-size: 22px; color: var(--muted); font-weight: 600; }
  .hint { background: rgba(77,163,255,.08); border-left: 3px solid var(--accent); padding: 10px 14px; border-radius: 4px; font-size: 14px; }
  .steps { list-style: none; padding: 0; margin: 0; }
  .steps li { padding: 8px 0; border-bottom: 1px solid var(--line); display: flex; gap: 12px; align-items: baseline; }
  .steps li:last-child { border-bottom: 0; }
  .steps .st { flex: 0 0 84px; font-size: 12px; font-weight: 700; }
  .st-todo { color: var(--muted); } .st-now { color: var(--accent); } .st-done { color: var(--ok); }
  .live { font-family: ui-monospace, monospace; font-size: 13px; color: var(--muted); }
  .press { display: inline-block; min-width: 30px; padding: 2px 6px; margin: 2px; border-radius: 4px; background: #0f1114; text-align: center; font-family: ui-monospace, monospace; font-size: 12px; }
  .press.on { background: var(--ok); color: #08121f; font-weight: 700; }
  .log { max-height: 160px; overflow-y: auto; font-family: ui-monospace, monospace; font-size: 12px; color: var(--muted); background: #0f1114; border-radius: 6px; padding: 10px; }
  .hide { display: none !important; }
  .note { font-size: 12px; color: var(--muted); margin-top: 10px; }
</style>
</head>
<body>
<div class="wrap">

  <h1>M21-RESEARCH-01 Gamepad 計測ハーネス</h1>
  <p class="sub">
    指示書 <code>docs/instructions/M21-RESEARCH-01-gamepad-poc.md</code> v1.2.0 §4 / §4.5 の段 2 用。
    <strong>記録は機械が取ります。回数を数えたり、体感を申告したりする必要はありません。</strong>
  </p>

  <!-- ============ 0. 環境（全自動取得） ============ -->
  <div class="panel">
    <h2>0. 実行環境（自動取得）</h2>
    <dl class="kv">
      <dt>origin</dt><dd id="m-origin">-</dd>
      <dt>secure context</dt><dd id="m-secure">-</dd>
      <dt>getGamepads()</dt><dd id="m-api">-</dd>
      <dt>User-Agent</dt><dd id="m-ua">-</dd>
      <dt>画面 / DPR</dt><dd id="m-screen">-</dd>
    </dl>
  </div>

  <!-- ============ 1. 検出（A-1 / A-2 / A-3） ============ -->
  <div class="panel">
    <h2>1. コントローラの検出</h2>
    <p class="hint" id="detect-hint">
      <strong>手順 0-a:</strong> コントローラを接続したまま、<strong>この 5 秒間はなにも押さないでください</strong>。
      「押さなくても列挙されるか」を機械が判定します（調査項目 A-2）。
    </p>
    <p class="row">
      <span class="counter" id="detect-timer">5</span>
      <span id="detect-state" class="badge b-warn">待機中</span>
    </p>
    <dl class="kv">
      <dt>Gamepad.id</dt><dd id="p-id">（未検出）</dd>
      <dt>index / mapping</dt><dd id="p-idx">-</dd>
      <dt>ボタン数 / 軸数</dt><dd id="p-cnt">-</dd>
      <dt>初回検出の契機</dt><dd id="p-first">-</dd>
    </dl>
    <div class="log" id="evlog">（gamepadconnected / disconnected イベントをここに記録）</div>
  </div>

  <!-- ============ 2. 機種情報（人が入れる唯一の項目） ============ -->
  <div class="panel" id="panel-device">
    <h2>2. 機種情報の入力</h2>
    <p class="note">
      ★ここが<strong>開発者が入力する唯一の項目</strong>です（§4.5 (2)）。
      機械では取れないため（<code>Gamepad.id</code> は取れますが人が読む製品名と一致しません）。
      これ以外に申告する項目はありません。
    </p>
    <p class="row">
      <label>機種名 <input id="in-device" size="30" placeholder="例: Razer Kitsune / DualSense"></label>
      <label>接続方式
        <select id="in-conn">
          <option value="">選択してください</option>
          <option value="USB">USB</option>
          <option value="Bluetooth">Bluetooth</option>
          <option value="other">その他</option>
        </select>
      </label>
      <button id="btn-device">確定して計測へ</button>
    </p>
  </div>

  <!-- ============ 3. 計測 ============ -->
  <div class="panel hide" id="panel-task">
    <h2>3. 計測</h2>
    <ul class="steps" id="task-steps"></ul>
    <div style="margin-top:18px">
      <p class="hint" id="task-hint">-</p>
      <p class="row">
        <span class="counter"><span id="rep-now">0</span><span class="of"> / <span id="rep-max">0</span></span></span>
        <span id="task-state" class="badge b-warn">-</span>
        <button id="btn-start">このセットを開始</button>
        <button id="btn-next" class="sec hide">次へ</button>
      </p>
      <p class="live" id="live-press">-</p>
      <p class="note" id="task-note"></p>
    </div>
  </div>

  <!-- ============ 4. 保存 ============ -->
  <div class="panel" id="panel-save">
    <h2>4. ログの保存</h2>
    <p class="row">
      <button id="btn-download">JSON をダウンロード</button>
      <button id="btn-upload" class="sec">サーバへ送信</button>
      <span id="save-state" class="live"></span>
    </p>
    <p class="note">
      機種ごとにファイルを分けてください。ファイル名には入力した機種名が入ります。<br>
      「サーバへ送信」は <code>serve.py</code> で配信している場合のみ動きます（保存先はサーバ側の <code>logs/</code>）。
      ファイルを直接開いている場合（<code>file://</code>）はダウンロードを使ってください。
    </p>
  </div>

</div>

<script>
'use strict';
/* =========================================================================
 * M21-RESEARCH-01 Gamepad 計測ハーネス
 *
 * ★設計上の制約（指示書 §0.2'）:
 *   本ハーネスは「入力を渡し、出力を集めるだけの薄いドライバ」に留める。
 *   判定ロジック・フィルタ・閾値を一切持たない。デバウンス、同時押しの
 *   グルーピング、チャタリング除去はここでは行わない —— 行うと「測った分布」
 *   ではなく「ハーネスが通した分布」を測ることになる。
 *
 *   画面の回数カウンタ（§4.5 必須要件 (1)）だけは表示のために計数規則を
 *   持つが、これは <表示専用> であり生ログには一切影響しない。解析
 *   （analyze.py）は生の遷移列から全ての統計値を再計算する。
 * ========================================================================= */

const HARNESS_VERSION = '1.0.0';

/** 計測タスク定義。回数は指示書 §4.5.2 の表に一致させる。 */
const TASKS = [
  { id: 'T1', name: '2ボタン同時押し', sets: 3, reps: 30,
    hint: 'OD 技を出すときの押し方で、<strong>2 つのボタンを同時に</strong>押してください。' +
          '<strong>普段どおりの速さで</strong>。速く押そうとしなくて構いません。',
    note: '調査項目 C-1 / C-2（ズレ幅の分布）。3 セットに分けるのは、慣れで分布が動くかを見るためです。セット間の休憩は任意です。' },
  { id: 'T2', name: '1ボタン単押し', sets: 1, reps: 50,
    hint: '<strong>1 つのボタンを、素早く 1 回だけ</strong>押してください。<strong>連打しないでください。</strong>',
    note: '調査項目 D-1 / D-2（チャタリングの有無と間隔）。※チャタリングが起きるとカウンタが 1 回の押下で 2 進むことがあります。それも観測結果なので、そのまま進めて構いません。' },
  { id: 'T3', name: '3秒の長押し', sets: 1, reps: 3,
    hint: '<strong>ボタンを押しっぱなしにして 3 秒待ってから</strong>離してください。',
    note: '調査項目 D-3（アナログ値の推移）。押している間の値の揺れを見ます。' },
];

const DETECT_QUIET_MS = 5000; // A-2 判定用の「なにも押さない」時間

/* ---------------------------------------------------------------- ログ */
const log = {
  meta: {},
  /** gamepadconnected / disconnected と、初回検出の記録（A-1 / A-2 / A-3） */
  detection: { quietWindowMs: DETECT_QUIET_MS, events: [], firstSeen: null, firstButtonInput: null },
  /** ページ自身が出したエラー・警告（A-4 の一部。ブラウザ内部の警告は取れない） */
  console: [],
  /** 計測ブロック。WARMUP と各タスク×セット */
  runs: [],
};

/* ------------------------------------------------------- 実行時の状態 */
let padIndex = null;          // 記録対象として固定したゲームパッドの index
let padMeta = null;
let run = null;               // 記録中のブロック
let prevBtn = [];             // 直前フレームのボタン状態（差分検出用）
let taskPtr = 0, setPtr = 0;  // 進行位置
let repCount = 0;             // 表示専用カウンタ
let wasZeroPressed = true;    // 表示専用カウンタの状態機械
let pressStartT = null;       // T3 の押下時間表示用
let startedAt = performance.now();

const $ = (id) => document.getElementById(id);

/* ============================================================= 環境情報 */
function collectMeta() {
  const m = {
    harnessVersion: HARNESS_VERSION,
    href: location.href,
    origin: location.origin,
    protocol: location.protocol,
    isSecureContext: window.isSecureContext,
    gamepadApiPresent: typeof navigator.getGamepads === 'function',
    userAgent: navigator.userAgent,
    platform: navigator.platform || null,
    languages: Array.isArray(navigator.languages) ? navigator.languages.slice() : null,
    hardwareConcurrency: navigator.hardwareConcurrency || null,
    screen: { width: screen.width, height: screen.height, dpr: window.devicePixelRatio },
    pageLoadedAtISO: new Date().toISOString(),
    pageLoadedAtPerf: startedAt,
    timeOriginMs: performance.timeOrigin,
    // ↓ 人が入れる 2 項目（§4.5 (2)）。それ以外に自己申告項目は無い。
    deviceName: '',
    connection: '',
  };
  if (navigator.userAgentData) {
    m.userAgentData = {
      brands: navigator.userAgentData.brands,
      mobile: navigator.userAgentData.mobile,
      platform: navigator.userAgentData.platform,
    };
  }
  log.meta = m;

  $('m-origin').textContent = m.origin + '  (' + m.protocol + ')';
  $('m-secure').innerHTML = m.isSecureContext
    ? '<span class="badge b-ok">true</span>'
    : '<span class="badge b-ng">false</span> ← 非 secure context（経路 (c) 相当）';
  $('m-api').innerHTML = m.gamepadApiPresent
    ? '<span class="badge b-ok">あり</span>'
    : '<span class="badge b-ng">なし</span>';
  $('m-ua').textContent = m.userAgent;
  $('m-screen').textContent = m.screen.width + '×' + m.screen.height + ' / DPR ' + m.screen.dpr;
}

/** ページ自身のエラー・console 出力を拾う（A-4 の補助） */
function hookConsole() {
  const rec = (level, args) => {
    try {
      log.console.push({
        t: performance.now(), level,
        text: Array.from(args).map((a) => {
          if (a instanceof Error) return a.stack || String(a);
          if (typeof a === 'object') { try { return JSON.stringify(a); } catch (_) { return String(a); } }
          return String(a);
        }).join(' '),
      });
    } catch (_) { /* 記録の失敗で計測を止めない */ }
  };
  ['error', 'warn', 'info'].forEach((lv) => {
    const orig = console[lv].bind(console);
    console[lv] = function () { rec(lv, arguments); orig.apply(null, arguments); };
  });
  window.addEventListener('error', (e) => {
    log.console.push({ t: performance.now(), level: 'window.onerror', text: String(e.message) + ' @ ' + e.filename + ':' + e.lineno });
  });
  window.addEventListener('unhandledrejection', (e) => {
    log.console.push({ t: performance.now(), level: 'unhandledrejection', text: String(e.reason) });
  });
}

/* ========================================================= Gamepad 取得 */
/**
 * getGamepads() を例外込みで呼ぶ。非 secure context で throw する実装が
 * あるため、投げられた例外文言をそのまま記録する（A-4 が求める逐語記録）。
 */
let getPadsErrLogged = false;
function safeGetGamepads() {
  try {
    if (typeof navigator.getGamepads !== 'function') return [];
    return navigator.getGamepads() || [];
  } catch (err) {
    if (!getPadsErrLogged) {
      getPadsErrLogged = true;
      log.console.push({ t: performance.now(), level: 'getGamepads.throw', text: (err && (err.stack || err.message)) || String(err) });
    }
    return [];
  }
}

function snapshotPad(gp) {
  return {
    id: gp.id, index: gp.index, mapping: gp.mapping,
    buttons: gp.buttons.length, axes: gp.axes.length,
    connected: gp.connected, timestamp: gp.timestamp,
  };
}

window.addEventListener('gamepadconnected', (e) => {
  const s = snapshotPad(e.gamepad);
  log.detection.events.push({ t: performance.now(), type: 'gamepadconnected', pad: s });
  appendEvLog('gamepadconnected: ' + s.id);
});
window.addEventListener('gamepaddisconnected', (e) => {
  const s = snapshotPad(e.gamepad);
  log.detection.events.push({ t: performance.now(), type: 'gamepaddisconnected', pad: s });
  appendEvLog('gamepaddisconnected: ' + s.id);
});

function appendEvLog(text) {
  const el = $('evlog');
  if (el.dataset.clean !== '1') { el.textContent = ''; el.dataset.clean = '1'; }
  const line = document.createElement('div');
  line.textContent = '[' + performance.now().toFixed(0) + 'ms] ' + text;
  el.appendChild(line);
  el.scrollTop = el.scrollHeight;
}

/* ================================================== メインの rAF ループ */
function tick(ts) {
  requestAnimationFrame(tick);

  const pads = safeGetGamepads();
  let pad = null;
  for (let i = 0; i < pads.length; i++) {
    const p = pads[i];
    if (!p || !p.connected) continue;
    if (padIndex === null) { pad = p; break; }        // 未固定なら最初の 1 台
    if (p.index === padIndex) { pad = p; break; }     // 固定済みならその 1 台
  }

  /* --- 初回検出の記録（A-1 / A-2） --- */
  if (pad && log.detection.firstSeen === null) {
    padIndex = pad.index;
    padMeta = snapshotPad(pad);
    const viaEvent = log.detection.events.some((e) => e.type === 'gamepadconnected');
    // ★A-2 の判定材料。
    //   コントローラが列挙されるまでボタンの状態は観測できないため、
    //   「列挙より前にボタンが押されたか」は原理的に記録できない。
    //   代わりに (1) 静止期間(5 秒)の内に列挙されたか (2) 列挙されたその
    //   フレームでボタンが既に押されていたか の 2 つを残す。
    //   多くのブラウザでは「押した瞬間に列挙される」ため (2) が決め手になる。
    const pressedAtDetection = [];
    for (let i = 0; i < pad.buttons.length; i++) {
      if (pad.buttons[i].pressed) pressedAtDetection.push(i);
    }
    log.detection.firstSeen = {
      t: ts, elapsedFromLoadMs: ts - startedAt,
      viaConnectedEvent: viaEvent,
      quietWindowElapsed: (ts - startedAt) >= DETECT_QUIET_MS,
      buttonsPressedAtDetection: pressedAtDetection,
      anyPressedAtDetection: pressedAtDetection.length > 0,
      pad: padMeta,
    };
    renderPad();
  }

  /* --- 「押していないのに列挙されたか」の判定材料 --- */
  if (pad && log.detection.firstButtonInput === null) {
    for (let i = 0; i < pad.buttons.length; i++) {
      if (pad.buttons[i].pressed) {
        log.detection.firstButtonInput = { t: ts, elapsedFromLoadMs: ts - startedAt, button: i };
        renderDetectState();
        break;
      }
    }
  }

  /* --- 記録中なら 1 フレーム分を積む --- */
  if (run && pad) {
    const fi = run.frameT.length;
    run.frameT.push(ts);
    run.frameGT.push(pad.timestamp);

    let pressedNow = 0;
    for (let i = 0; i < pad.buttons.length; i++) {
      const b = pad.buttons[i];
      const p = b.pressed ? 1 : 0;
      const v = b.value;
      if (p) pressedNow++;
      const prev = prevBtn[i];
      // ★ 生の遷移をそのまま積む。閾値・デバウンスは一切かけない。
      if (prev === undefined || prev.p !== p || prev.v !== v) {
        run.events.push({ f: fi, t: ts, gt: pad.timestamp, b: i, p: p, v: v });
        prevBtn[i] = { p: p, v: v };
      }
    }
    updateRepCounter(pressedNow, ts);
    renderLive(pad, pressedNow);
  }

  updateDetectTimer(ts);
}

/* ------------------------------------------- 表示専用カウンタ（§4.5 (1)） */
/**
 * ★表示専用。生ログには影響しない。
 * 規則: 「押下ボタン数 0 → 1 以上」で押し始め、「1 以上 → 0」で 1 回完了。
 * 同時押しが多少ズレても 1 回として数える。チャタリングが起きると
 * 1 回の押下で 2 進むことがあるが、それも観測結果としてそのまま扱う。
 */
function updateRepCounter(pressedNow, ts) {
  // ウォームアップ中は回数の概念が無いので数えない（表示も動かさない）
  if (!run || run.taskId === 'WARMUP') { wasZeroPressed = pressedNow === 0; return; }
  const isZero = pressedNow === 0;
  if (wasZeroPressed && !isZero) {
    pressStartT = ts;
  } else if (!wasZeroPressed && isZero) {
    repCount++;
    const dur = pressStartT === null ? null : (ts - pressStartT);
    pressStartT = null;
    $('rep-now').textContent = repCount;
    if (TASKS[taskPtr].id === 'T3' && dur !== null) {
      $('task-note').textContent = '直前の押下時間: ' + (dur / 1000).toFixed(2) + ' 秒（3 秒に満たない場合はもう一度）';
    }
    if (repCount >= TASKS[taskPtr].reps) finishSet();
  }
  wasZeroPressed = isZero;
}

function renderLive(pad, pressedNow) {
  const parts = [];
  for (let i = 0; i < pad.buttons.length; i++) {
    parts.push('<span class="press' + (pad.buttons[i].pressed ? ' on' : '') + '">' + i + '</span>');
  }
  $('live-press').innerHTML = parts.join('') + ' &nbsp;押下数 ' + pressedNow;
}

/* ----------------------------------------------------------- 検出の表示 */
function updateDetectTimer(ts) {
  const remain = Math.max(0, DETECT_QUIET_MS - (ts - startedAt));
  $('detect-timer').textContent = (remain / 1000).toFixed(1);
  if (remain === 0 && $('detect-hint').dataset.phase !== 'after') {
    $('detect-hint').dataset.phase = 'after';
    $('detect-hint').innerHTML = log.detection.firstSeen
      ? '<strong>手順 0-b:</strong> ボタンを押さずに列挙されました。そのまま「2. 機種情報の入力」へ進んでください。'
      : '<strong>手順 0-b:</strong> まだ列挙されていません。<strong>コントローラのボタンをどれか 1 回押してください。</strong>' +
        'それでも下の「Gamepad.id」が埋まらない場合は、<strong>そこで止めて報告してください</strong>（A-1 が「取れない」で確定します）。';
    renderDetectState();
  }
}

function renderDetectState() {
  const el = $('detect-state');
  if (!log.detection.firstSeen) {
    el.className = 'badge b-warn'; el.textContent = '未検出';
    return;
  }
  const fs = log.detection.firstSeen;
  const inQuiet = fs.elapsedFromLoadMs < DETECT_QUIET_MS;
  el.className = 'badge b-ok';
  el.textContent = '検出';
  $('p-first').textContent = fs.anyPressedAtDetection
    ? 'ボタンを押した瞬間に列挙された（load+' + fs.elapsedFromLoadMs.toFixed(0) +
      'ms / 押されていたボタン: ' + fs.buttonsPressedAtDetection.join(',') + '）'
    : (inQuiet
        ? 'ボタンを押さずに列挙された（load+' + fs.elapsedFromLoadMs.toFixed(0) + 'ms・静止期間内）'
        : '押下なしで列挙されたが静止期間の経過後（load+' + fs.elapsedFromLoadMs.toFixed(0) + 'ms）');
}

function renderPad() {
  if (!padMeta) return;
  $('p-id').textContent = padMeta.id;
  $('p-idx').textContent = padMeta.index + ' / ' + padMeta.mapping;
  $('p-cnt').textContent = padMeta.buttons + ' ボタン / ' + padMeta.axes + ' 軸';
  renderDetectState();
}

/* ================================================================ 進行 */
function renderSteps() {
  const ul = $('task-steps');
  ul.innerHTML = '';
  TASKS.forEach((t, ti) => {
    for (let si = 0; si < t.sets; si++) {
      const li = document.createElement('li');
      const done = ti < taskPtr || (ti === taskPtr && si < setPtr);
      const now = ti === taskPtr && si === setPtr;
      const cls = done ? 'st-done' : (now ? 'st-now' : 'st-todo');
      const mark = done ? '完了' : (now ? '実行中' : '未実施');
      li.innerHTML = '<span class="st ' + cls + '">' + mark + '</span>' +
        '<span>' + t.name + (t.sets > 1 ? '（セット ' + (si + 1) + '/' + t.sets + '）' : '') +
        ' — ' + t.reps + ' 回</span>';
      ul.appendChild(li);
    }
  });
}

function prepareSet() {
  if (taskPtr >= TASKS.length) {
    $('task-hint').innerHTML = '<strong>全ての計測が完了しました。</strong>「4. ログの保存」へ進んでください。';
    $('task-state').className = 'badge b-ok';
    $('task-state').textContent = '全完了';
    $('btn-start').classList.add('hide');
    $('btn-next').classList.add('hide');
    $('rep-now').textContent = '-'; $('rep-max').textContent = '-';
    $('task-note').textContent = '';
    renderSteps();
    return;
  }
  const t = TASKS[taskPtr];
  $('task-hint').innerHTML = t.hint;
  $('task-note').textContent = t.note;
  $('rep-now').textContent = '0';
  $('rep-max').textContent = t.reps;
  $('task-state').className = 'badge b-warn';
  $('task-state').textContent = t.name + (t.sets > 1 ? '（セット ' + (setPtr + 1) + '/' + t.sets + '）' : '') + ' — 未開始';
  $('btn-start').classList.remove('hide');
  $('btn-start').disabled = false;
  $('btn-next').classList.add('hide');
  renderSteps();
}

function startSet() {
  const t = TASKS[taskPtr];
  repCount = 0; wasZeroPressed = true; pressStartT = null; prevBtn = [];
  run = {
    taskId: t.id, taskName: t.name, setIndex: setPtr, targetReps: t.reps,
    startedAtISO: new Date().toISOString(), startedAtPerf: performance.now(),
    padIndex: padIndex, pad: padMeta,
    frameT: [], frameGT: [], events: [],
  };
  $('btn-start').disabled = true;
  $('task-state').className = 'badge b-ok';
  $('task-state').textContent = '記録中 — ' + t.name;
}

function finishSet() {
  if (!run) return;
  run.endedAtPerf = performance.now();
  run.endedAtISO = new Date().toISOString();
  run.displayRepCount = repCount;
  log.runs.push(run);
  run = null;
  $('task-state').className = 'badge b-ok';
  $('task-state').textContent = '完了 — ' + TASKS[taskPtr].name +
    (TASKS[taskPtr].sets > 1 ? '（セット ' + (setPtr + 1) + '/' + TASKS[taskPtr].sets + '）' : '') +
    '  ' + repCount + ' / ' + TASKS[taskPtr].reps;
  $('btn-start').classList.add('hide');
  $('btn-next').classList.remove('hide');
  renderSteps();
}

function nextSet() {
  setPtr++;
  if (setPtr >= TASKS[taskPtr].sets) { taskPtr++; setPtr = 0; }
  prepareSet();
}

/* -------------------------------------------------- ウォームアップ計測 */
/**
 * B-1（rAF 間隔の分布）用に、開発者の操作なしで 3 秒だけフレーム間隔を取る。
 * ボタン入力と無関係な素の周期が要るため、タスクとは別に取る。
 */
function startWarmup() {
  repCount = 0;
  prevBtn = [];
  run = {
    taskId: 'WARMUP', taskName: 'ウォームアップ（rAF 間隔）', setIndex: 0, targetReps: 0,
    startedAtISO: new Date().toISOString(), startedAtPerf: performance.now(),
    padIndex: padIndex, pad: padMeta,
    frameT: [], frameGT: [], events: [],
  };
  setTimeout(() => {
    if (run && run.taskId === 'WARMUP') {
      run.endedAtPerf = performance.now();
      run.endedAtISO = new Date().toISOString();
      run.displayRepCount = null;
      log.runs.push(run);
      run = null;
    }
    repCount = 0;
    prepareSet();
  }, 3000);
  $('task-state').className = 'badge b-warn';
  $('task-state').textContent = 'ウォームアップ計測中（3 秒・操作不要）';
  $('btn-start').classList.add('hide');
}

/* ============================================================== 保存 */
function slug(s) {
  return (s || 'unknown').trim().replace(/[^0-9A-Za-z぀-ヿ一-鿿_-]+/g, '-').slice(0, 40) || 'unknown';
}
function fileName() {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  return 'm21-poc_' + slug(log.meta.deviceName) + '_' + slug(log.meta.connection) + '_' + stamp + '.json';
}
function payload() {
  log.meta.savedAtISO = new Date().toISOString();
  log.meta.runCount = log.runs.length;
  return JSON.stringify(log);
}

$('btn-download').addEventListener('click', () => {
  const blob = new Blob([payload()], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = fileName();
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  $('save-state').textContent = 'ダウンロードしました: ' + a.download;
});

$('btn-upload').addEventListener('click', async () => {
  const name = fileName();
  $('save-state').textContent = '送信中...';
  try {
    const res = await fetch('/upload?name=' + encodeURIComponent(name), {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: payload(),
    });
    const txt = await res.text();
    $('save-state').textContent = res.ok ? ('サーバへ保存しました: ' + txt) : ('失敗 (' + res.status + '): ' + txt);
  } catch (err) {
    $('save-state').textContent = '送信できませんでした（' + err + '）。ダウンロードを使ってください。';
  }
});

/* ============================================================== 起動 */
$('btn-device').addEventListener('click', () => {
  const d = $('in-device').value.trim();
  const c = $('in-conn').value;
  if (!d || !c) { alert('機種名と接続方式を入力してください。'); return; }
  log.meta.deviceName = d;
  log.meta.connection = c;
  $('panel-device').classList.add('hide');
  $('panel-task').classList.remove('hide');
  renderSteps();
  startWarmup();
});

$('btn-start').addEventListener('click', startSet);
$('btn-next').addEventListener('click', nextSet);

hookConsole();
collectMeta();
requestAnimationFrame(tick);
</script>
</body>
</html>

```

---

*以上、M21-RESEARCH-01 報告。*

