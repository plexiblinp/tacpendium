# M9-02 手動確認手順書（FR704 moves CSV 取込）

> 対象: M9-02 完了ゲート（M9-03 着手前に推奨）。設計担当と合意の上、開発者が手動実施する。
> 自動テスト（Go 26pkg / Vitest 451 / E2E 2 spec）で担保できない範囲を補う。
> 作成: 2026-06-14（製造担当 Claude Code）。実施予定: 翌日。

実施項目: **1（実 CSV 通し）/ 2（UI 反映）/ 3（冪等性）/ 6（サイズ上限）/ 5（make e2e）**。

---

## 0. 事前準備（1 回だけ）

ターミナル 2 枚で dev サーバを起動（リポジトリルートで）。

```bash
# ターミナルA: バックエンド（config.toml の port=47320 で起動／競合時は L-04 で自動採番）
go run ./cmd/combomgr

# ターミナルB: フロントエンド（:5173、/api は config.toml のポートへ自動プロキシ）
cd web && pnpm dev
```

- ブラウザで **http://localhost:5173/** を開く。
- **初回のみ**: 未初期化だと `/wizard` へリダイレクトされるのでウィザードを完了（完了済み dev DB ならスキップ）。
- 起動時に migration が自動適用され、`000014` で `ken/ingrid/c_viper/dhalsim` のキャラ名が入る。
- ヘッダの **「技取込」**（`/import/moves`）が入口。

> 注: 取込は dev DB に実書き込みする（手動での seed 再生成に相当）。本番 DB ではない。
> 注: バックエンドが L-04 でポートを変えた場合、`config.toml` の `port` が実ポートに書き換わる。後述の curl はその値を使う。

---

## 1. 実 CSV 通し確認（total / properties / category / 強調 + review.md 突合）

1. 技取込画面で `combomgr-importer/dist/ryu.csv` を選択 →「プレビュー」。
2. 以下の **spot-check 期待値（ryu.csv 実データ）** を画面で確認:

   | move_code | 入力（発生/持続/硬直） | 期待 total | 期待ハイライト |
   |---|---|---|---|
   | `standing_light_punch` | 4 / 3 / 7 | **13**（4+3-1+7） | なし |
   | `standing_light_kick` | 5 / 3 / 11 | **18** | なし |
   | `hadoken_light` | 16 / 空 / `全体 47` | **47**（全体N→直接） | **あり**（recovery に「全体」→ 要確認語。**total は出るが強調される**のが正常） |
   | `jumping_light_punch` | 4 / 10 / `着地後3` | **—（空欄）** | **あり**（total 未算出） |
   | `denjin_charge` | 空 / 空 / `全体 52` | **52**（全体が発生空欄より優先） | あり |

3. **review.md 突合**: `combomgr-importer/dist/ryu.review.md` を開き、ツールの要確認メモと画面の強調行が **概ね重なる**ことを確認（判定基準が異なるため厳密一致ではなく overlap で OK）。
4. **category 日本語化**: `critical_art` 行（`ca_shin_shoryuken`）が「クリティカルアーツ」と表示されること。
5. 残り 4 CSV も同様に流す（カバレッジ目的）。特に **`dhalsim.csv`**: 3 件目の投げ `yoga_splash` が **「3 件目以降の投げ」で強調**されることを確認。各 CSV に `critical_art`・`drive_impact` が 1 件ずつ存在。

---

## 2. 取込後の UI 反映（name_ja 付き表示）

1. ryu.csv をプレビュー後 →「取込実行」→ レポートで成功件数を確認。
2. **コンボ新規作成**（`/combos/new`）→ キャラ「リュウ」→ 技セレクタを開く → 取り込んだ技が **日本語表示名（例「波動拳」）付き**で並ぶことを確認（= preset_aliases 経由の解決）。
3. API でも確認する場合（バックエンド実ポートは起動ログ or `config.toml` の `port`、既定 47320）:
   ```bash
   curl -s localhost:47320/api/games/1/characters | jq '.items[] | {id,code}'   # ryu の id を確認
   curl -s "localhost:47320/api/moves?character_id=<ryuのid>" | jq '.items | length'
   curl -s "localhost:47320/api/moves?character_id=<ryuのid>" | jq '.items[] | select(.code=="hadoken_light") | {code,nameJa,total}'
   # 期待: nameJa="波動拳", total=47
   ```

---

## 3. 冪等性（2 回取込で件数不変）

1. ryu.csv を取込 → 件数を控える:
   ```bash
   curl -s "localhost:47320/api/moves?character_id=<ryuのid>" | jq '.items | length'
   ```
2. **同じ ryu.csv をもう一度**取込実行 → 同じ件数取得コマンドを再実行。
3. **件数が増えていなければ OK**（upsert キー `(character_id, code)` が有効）。

---

## 6. サイズ上限（5,000 行超で 400）

1. 5,001 データ行の CSV を生成:
   ```bash
   cd /workspaces/combomgr
   { head -1 combomgr-importer/dist/ryu.csv; \
     for i in $(seq 1 5001); do echo "ryu,sizetest_$i,normal,テスト,5,2,11,,,,,,,,,mid,false,false,,,,"; done; } > /tmp/oversize.csv
   wc -l /tmp/oversize.csv   # 5002（ヘッダ1 + データ5001）
   ```
2. 取込画面で `/tmp/oversize.csv` を選択 →「プレビュー」。
3. **エラー表示「取込行数が上限(5000 行)を超えています」**（HTTP 400）になれば OK。
   - 直接叩く場合: `curl -i -F "file=@/tmp/oversize.csv" localhost:47320/api/import/moves/preview` → `400`。

---

## 5. make e2e（開発者環境実走 + リビルド要否）

1. まず Chromium のシステムライブラリ有無を確認（リビルド要否の判定）:
   ```bash
   cd /workspaces/combomgr/web && pnpm exec playwright install --dry-run chromium 2>/dev/null; \
   ldd ~/.cache/ms-playwright/chromium*/chrome-linux/chrome 2>/dev/null | grep -i "not found" || echo "deps OK"
   ```
   - `libnspr4.so ... not found` 等が出たら → **VS Code「Dev Containers: Rebuild Container」でリビルド**（Dockerfile 修正は commit `9c1d353` で適用済み）。`deps OK` なら次へ。
2. 実走:
   ```bash
   make e2e
   ```
   - 期待: `import-moves.spec.ts` と `combo-crud.spec.ts` の **2 spec PASS**。

---

## 補足

- 1〜3 を実行すると dev DB の classic 5 体に取込技が入る。E2E（5）は seed 非依存・self-contained なので 1〜3 の後でも問題なく通る。
- 実装方式の確定事項・残課題は `docs/progress/progress-log.md` の「M9-02」「レビュー取り込み」節を参照。
