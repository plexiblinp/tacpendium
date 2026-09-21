# CI ベースライン計測（工程改善 第一波 P2 ／ harness 計画 Track A Step A0）

| 項目 | 内容 |
|------|------|
| 文書ID | CI-BASELINE-20260810 |
| 種別・管理 | リポジトリ管理・自由改訂（CHANGE 対象外）。計測証跡 |
| 作成 | 改善担当 Claude Code / 2026-08-10 |
| 対象 commit | `fec7170`（`chore/m19-to-m20`） |
| 位置づけ | `tmp/kaizen_before_M20/harness-ci-and-validation-plan.md` **Step A0**（受入: 全検査の所要と flaky 有無が数値で記録される） |
| 後続 | **Step A1 以降は M23 へ延期**（2026-08-10 開発者裁定・F-1）。本書は M23 着手時の入力。→ `docs/handover/followup-backlog.md` §F |
| 計測環境 | devContainer / Linux 6.18.33.2-microsoft-standard-WSL2 / **24 コア** / 15.9GB RAM / Go 1.26.4 / pnpm 9.13.0 |

> **本書の構成**: 起動プロンプト §3.5 に従い **観測（測定済み事実）／根拠／推論／提案／未決事項**を分離する。
> 推論欄の数値は測定値ではない。CI 実機の値は Step A2 の初回実行で置き換えること。

---

## 1. 観測（測定済み事実）

### 1.1 計測方法

各検査を 3 回連続実行し、所要秒（`date +%s.%N` の差分）と exit code を記録した。生ログは
`/tmp/.../scratchpad/a0-results/` に保存（セッション限り。要点は本書へ転記済み）。

**初回計測は無効だった**: `go test ./...` が 0.4〜0.7 秒で完了し、ログの 46 パッケージすべてに `(cached)` が付いていた。
Go のテスト結果キャッシュを計測していたため、**`-count=1` を付けて再計測した**。

### 1.2 実測値

| 検査 | run1 | run2 | run3 | exit | 備考 |
|---|---|---|---|---|---|
| `go vet ./...`（キャッシュ有） | 0.9s | 0.2s | 0.2s | 0/0/0 | キャッシュヒット |
| **`go vet ./...`（冷 GOCACHE）** | **10.8s** | — | — | 0 | 1 回のみ |
| `go test ./...`（キャッシュ有） | 0.7s | 0.4s | 0.4s | 0/0/0 | **46/46 パッケージが `(cached)`。無効な計測** |
| **`go test -count=1 ./...`** | **130.2s** | **129.4s** | **129.7s** | 0/0/0 | ビルドキャッシュは温 |
| **`go test -count=1`（冷 GOCACHE）** | **143.2s** | — | — | 0 | 冷キャッシュは 228MB を生成 |
| **`GOMAXPROCS=2 go test -count=1 -p 2 ./...`** | **245.6s** | — | — | 0 | 2 コア制約下 |
| `make test-web`（vitest） | 13.2s | 12.6s | 13.1s | 0/0/0 | 結果キャッシュなし |
| `make build`（pnpm build + go build） | 10.9s | 9.9s | 10.0s | 0/0/0 | |
| `bash scripts/check-derived-docs.sh` | 0.0s | 0.0s | 0.0s | 0/0/0 | 常に exit 0 の情報提供型 |

### 1.3 flaky の有無

- **3 回の連続実行で、全検査が全回 exit 0**。失敗・順序依存・タイムアウトは観測されなかった。
- `go test -count=1` の 3 回の分散は **129.4〜130.2 秒（幅 0.8 秒）** で安定していた。
- **本計測は E2E（`make e2e`）を含まない**。E2E は Track B の対象であり、A0 の範囲外とした。

### 1.4 パッケージ別の内訳（`go test -count=1` run3）

パッケージ所要時間の**単純合計は 620.8 秒（46 パッケージ）**だが、実測ウォールクロックは 129.7 秒だった
（24 コアでのパッケージ並列実行による）。上位は次のとおり。

| 所要 | パッケージ |
|---|---|
| 128.5s | `internal/service/combo` |
| 91.3s | `internal/infra/migration` |
| 72.7s | `internal/repository/combo` |
| 47.4s | `internal/service/notation` |
| 45.8s | `internal/service/setup` |
| 42.7s | `internal/repository/setup` |
| 34.1s | `internal/service/tag` |

上位 3 パッケージで合計の **47%** を占める。

### 1.5 Track B（E2E）の開始条件に関わる現状値

`web/playwright.config.ts` の現在値: **`retries: 1`** / **`reporter: "list"`** / **`workers` 未指定**（＝既定値）。

`environment-reliability-plan.md` §1.2 が CI に求める `workers: 1` / `reporter: "dot"` と、
「retry を既知のアプリ欠陥を隠すために使わない」（harness 計画 Step B1）に対し、**現状は 3 点とも未適用**である。

---

## 2. 根拠（外部一次資料）

- DORA は、各変更でビルドと自動テストを起動し、**数分・上限約 10 分**でフィードバックすることを推奨する。長時間テストは別パイプラインへ分ける。 <https://dora.dev/capabilities/continuous-integration/>
- Playwright は CI で `workers: 1` を推奨し、CI では簡潔な `dot` reporter を標準とする。 <https://playwright.dev/docs/ci>

（採否の正本は `tmp/kaizen_before_M20/evidence-based-review.md`。本書では繰り返さない。）

---

## 3. 推論（測定値ではない）

- **本計測は 24 コア環境の値であり、GitHub ホストランナーへそのまま転用できない。** パッケージ所要の単純合計 620.8 秒に対しウォールクロックが 129.7 秒であることは、**時間の大部分がコア数に依存する**ことを示す。
- 2 コア制約下の実測 **245.6 秒（約 4.1 分）** が、ホストランナーに最も近い手元の値である。ただし CPU モデル・I/O・ネットワークが異なるため、**これも推定であり実測ではない**。
- PR 高速検査の総所要は、上記に checkout / setup-go / setup-node / `pnpm install` を加えて **概ね 6〜8 分**と見込まれる。DORA の上限約 10 分には収まるが、**A0 が目標に置いた「可能なら 5 分程度」は Go テスト単体で超える可能性が高い**。
- `go test` が総コストの支配項（推定 60% 超）である。`go vet`（冷 10.8 秒）・web test（13 秒）・build（10 秒）は小さい。
- `internal/infra/migration` が 91.3 秒を要するのは、マイグレーションを反復適用する性質によるものと考えられる（未検証）。

---

## 4. 提案

| # | 提案 | 根拠 | 検証方法 |
|---|---|---|---|
| A0-1 | **Step A2 の初回 CI 実行で実測値を取り直し、本書 §3 の推定を置き換える。** 推定のまま運用判断へ持ち込まない | §3 のとおり手元計測はコア数依存 | CI の job summary の所要秒を本書へ追記 |
| A0-2 | PR CI は **`go vet` + `build` の job と `go test` の job を分けて並列実行**し、ウォールクロックを `go test` の長さへ寄せる | `go test` が支配項（§1.4） | 分割前後の time-to-green 比較 |
| A0-3 | Go のビルドキャッシュを CI でリストアする（冷 143.2s → 温 130.2s、**差 13 秒**）。**ただし cache は高速化であり正しさの根拠にしない**（計画 A2） | §1.2 の冷温比較 | cache hit/miss 別の所要記録 |
| A0-4 | **`go test` に `-count=1` を付ける。** 付けないと CI でも結果キャッシュにより「実行していないのに緑」になりうる | §1.1 で実際に 46/46 が cached だった | 意図的に失敗するテストを入れた学習用 PR（Step A1）で赤になることを確認 |
| A0-5 | 全検査が 3 回とも緑・分散も小さいため、**A0 の「flaky な検査は CI 搭載を見送る」条項に該当する検査はない**（＝ CI 非搭載一覧は空） | §1.3 | — |
| A0-6 | Track B（B1）へ進む前に `playwright.config.ts` の CI 向け設定（`workers: 1` / `dot` / retry の扱い）を決める。**B1 の開始条件は `environment-reliability-plan` §1 の受入（1 worker 連続成功）であり、本 A0 では未達** | §1.5 | 別途 Track B で計測 |

---

## 5. 未決事項

1. **リポジトリの可視性と Actions の可用性・課金**が未確認。private の場合は Actions 実行時間の無料枠に上限がある。→ 開発者確認（`gh repo view` は本セッションで未実行）。
2. **ホストランナーの実コア数**（2 / 4）が未確定。§3 の推定はこれに直結する。
3. **`pnpm install` の CI での所要**が未計測。ローカルでは `node_modules` が既存のため測れない（削除は破壊的なので行わなかった）。A2 の初回実行で判明する。
4. `internal/infra/migration` の 91.3 秒の内訳（マイグレーション反復かどうか）は未調査。短縮余地の有無は未判定。
5. 3 回の実行は flaky 検出としては弱い。**「3 回緑」は「flaky でない」の証明ではない**。継続的な flaky 率は Track D の収集（A2 初日から）で判断する。

---

## 6. Step A0 の受入判定

| 受入条件（harness 計画 A0） | 判定 |
|---|---|
| 全検査の所要と flaky 有無が数値で記録される | **満たす**（§1.2・§1.3） |
| PR の高価値検査を約 10 分以内、可能なら 5 分程度 | **10 分以内は満たす見込み・5 分は未達の見込み**（§3。実測は A2 で確定） |
| 必須 check が赤い場合の責任者・修復優先度・再実行条件を決める | **未実施**（Step A1 の runbook 側で開発者へ提示する） |

**失敗時の扱い（flaky な検査は CI 搭載を見送り一覧に記録）の適用対象は 0 件。**
