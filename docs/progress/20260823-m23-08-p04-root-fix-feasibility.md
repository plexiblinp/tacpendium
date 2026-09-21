# P-04 根治の実現可能性 実測レポート（M23-08 追補調査）

| 項目 | 内容 |
|------|------|
| 目的 | **`P-04`（`PRAGMA foreign_keys` が接続プール全体に効かない）の根治サブを起票するかどうかの判断材料**を、推論ではなく実測で揃える |
| 実施 | 製造担当 Claude Code / **2026-08-23** |
| 経緯 | `M23-08` の実測で **実 DB に orphan 19 件**が見つかり、設計卓から「根治サブを作るか」を問われた。**`architecture-patterns` §11 が「独立した調査と全テーブルの回帰ゲートが要る」としている**ため、その調査分を先に実施した |
| 位置づけ | **本レポートは調査のみ。本番コードは 1 行も変更していない**（実測用の一時変更は測定後に復元済み。`git diff cdfcf0c -- internal/infra/db/db.go` が空） |
| 結論 | **根治は可能。コード変更は約 5 行。既存のテスト・E2E は 1 件も落ちない。ただし起票は必要**（理由は §5） |

---

## 1. 何を測ったか

**`internal/infra/db/db.go` の `db.Open` を一時的に DSN 化し、FK が全接続で有効な状態で全テスト・全 E2E を回した。**

```go
// 現行（プールの 1 本にしか効かない）
conn, _ := sql.Open("sqlite", dbPath)
conn.Exec("PRAGMA foreign_keys = ON")     // ← *sql.DB.Exec は 1 接続を借りて実行するだけ

// 実測に使った形（接続が張られるたびに適用される）
dsn := dbPath + "?_pragma=foreign_keys(1)&_pragma=busy_timeout(5000)" +
    "&_pragma=journal_mode(WAL)&_pragma=synchronous(NORMAL)"
conn, _ := sql.Open("sqlite", dsn)
```

**★ドライバ側の裏付け**: `modernc.org/sqlite v1.50.0` は `conn.go:77` で `applyQueryParams` を呼んでおり、これは `newConn`（**接続が張られるたび**に走る関数）の中にある。**⇒ DSN の `_pragma` はプール中の全接続へ効く。**

---

## 2. ★★実測 1: 現行実装では、16 接続中 15 本が FK=OFF だった

プールに 16 本の接続を同時に張り、それぞれで `PRAGMA foreign_keys` を読んだ結果。

| 実装 | FK=OFF の接続数 |
|---|---:|
| **現行**（`conn.Exec` で 1 回） | **16 本中 15 本** |
| **DSN 化** | **16 本中 0 本** |

**⇒ 現行実装で FK が効いているのは、最初に張られた 1 本だけである。**

**★これは `M19-03` 期の実測「16 接続中 7 本が OFF」より悪い**（`repository.go:1295-1303` に記録がある値）。当時と負荷条件が違うためだが、**いずれにせよ「たまに効かない」ではなく「ほぼ効いていない」が実態である。**

**⇒ 実 DB の orphan 19 件は、この状態の当然の帰結である。**

---

## 3. ★★実測 2: FK を全接続で ON にしても、既存のテストも E2E も 1 件も落ちない

```
$ go test ./... -count=1          # db.Open を DSN 化した状態
53 パッケージ ok ／ FAIL 0

$ make e2e                        # 同上
168 passed (3.3m) ／ FAIL 0
```

**`architecture-patterns` §11 が警告していた「FK=OFF 前提で通っていた既存の削除順序を壊し得る」は、テストと E2E がカバーする範囲では 1 件も顕在化しなかった。**

---

## 4. なぜ壊れなかったか（構造的な理由）

**偶然ではない。3 つの理由がある。**

### 4-1. マイグレーションは影響を受けない

**表を作り直すマイグレーション（`000016` / `000019` / `000028`）は FK=ON だと危険だが、そもそも影響を受けない。**

`internal/infra/migration/migrate.go:55` が **`db.Open` を使わず独自に `sql.Open("sqlite", dbPath)` している**ためである。**⇒ `db.Open` を DSN 化しても、マイグレーションは今までどおり FK=OFF で走る。**

**★これが最大のリスクだと想定していたが、構造的に外れていた。**

### 4-2. 実行時に「親」を消す経路は 4 つしかなく、3 つは既に明示削除済み

`grep -rhoE "DELETE FROM [a-z_]+" --include=*.go internal/ | grep -v _test` の実測から、**FK の親になる表を消す実行時経路**を抜き出した。

| 親 | 場所 | 子行の扱い | FK=ON にすると |
|---|---|---|---|
| `combos` | `combo/repository.go` `HardDelete` | **明示削除 7 表 ＋ self-FK 2 本の NULL 化**（`M23-08`） | 影響なし |
| `setups` | `setup/restore.go` `HardDelete` | **明示削除 4 表**（`M23-02`） | 影響なし |
| `presets` | `preset/queries.go:152-154` | **明示削除**（`deleteAliasesByPresetSQL`。コメントに「★CASCADE に頼らず子行を明示削除する(P-04)」） | 影響なし |
| **`tags`** | `tag/repository.go:197` | **明示削除なし。CASCADE 頼み** | **★正しく CASCADE が発火するようになる＝直る** |

**★`DELETE FROM moves` は実行時経路ではない**——`internal/seedgen/generate.go:306` の**コード生成器**が出力するマイグレーション SQL の文字列であり、マイグレーション内（FK=OFF）で走る。

**⇒ FK=ON は既存経路を壊さない。むしろ `tags` 削除経由の orphan 供給（`M23-08` §J に登録した未解決項目）が同時に直る。**

### 4-3. 親キーを UPDATE する経路も、`ON UPDATE CASCADE` か明示再ポイントで守られている

| 経路 | 状態 |
|---|---|
| `UPDATE combo_setups SET combo_id`（3 か所） | `combo_setup_results` が `ON UPDATE CASCADE`。**加えて `MoveSetupResultReferences` が明示再ポイント**（`M19-03`） |
| `UPDATE combo_punishes / combo_punish_curations SET combo_id` | `MovePunishReferences`（`M18-03b`） |
| `UPDATE combo_steps / setup_steps SET move_id` | 参照先は実在する move（`M20` の正規化）。テストで緑 |

---

## 5. ★それでも起票が要る理由

**実測は「壊れない」を強く支持するが、「起票不要」は支持しない。**

| # | 理由 |
|---|---|
| 1 | **テストと E2E は全経路ではない。** 本レポートが言えるのは「**53 パッケージ 1291 テスト関数と 168 E2E がカバーする範囲では**落ちない」まで。**カバー外の経路が無いことは証明していない** |
| 2 | **回帰ゲートが要る**（`architecture-patterns` §11）。**§2 の probe（16 接続を張って全部 FK=ON か見る）を恒久テストとして置かないと、次に誰かが `conn.Exec` へ戻したときに黙って劣化する。** 現状この主張をするテストは 0 件 |
| 3 | **スコープ判断は設計卓の領分である。** `M23-overview` §1.3-5 が「M23 のスコープ外」と明示的に定めており、製造判断で覆さない |
| 4 | **`M23-08` のブランチはレビュー済みで、「射程は `combos` の完全削除だけ／画面を 1 バイトも触らない」という前提で受理待ちである。** 全機能に効く挙動変更を積むと、通ったレビューの前提が変わる |
| 5 | **既存 orphan 19 件の掃除と、`tag.Delete` の明示削除化を同じ手番に置くかどうかの判断が要る**（本レポート §4-2 のとおり、FK=ON は `tags` 経由の供給を止めるが、**既に溜まった分は消えない**） |

---

## 6. 根治サブへの申し送り（起票のたたき台）

### 6-1. 変更対象は 1 ファイル・約 5 行

`internal/infra/db/db.go` の `Open`。**§1 の DSN を使う。** `conn.Exec` の PRAGMA ループは撤去してよい（DSN 側が全接続へ適用するため）。

**★実装上の注意 2 点**

1. **`dbPath` に `?` が含まれると DSN のクエリ境界が壊れる。** 現状 `ResolveDBPath` が返すのは OS 標準パスなので実害は無いが、**利用者が設定ファイルで任意パスを与えられる**（`config`）。**URI エスケープするか、`file:` 形式へ寄せるかを決めること。**
2. **`journal_mode` は DB 単位で永続化される設定であり、接続単位の `foreign_keys` とは性質が違う。** DSN へ混ぜても害は無いが、**「なぜ 4 つとも DSN へ移すのか」を書き残さないと、後任が 1 つずつ戻す。**

### 6-2. ★回帰ゲート（これが本体）

**本調査で使った probe を恒久テストとして置くこと。** 現行実装では**赤になる**ことを確認済み（16 接続中 15 本が OFF）。

```go
// internal/infra/db/ に置く。プールへ複数接続を張り、全部が FK=ON であることを主張する。
// ★1 本だけ見る形にしないこと——現行実装でも最初の 1 本は ON であり、緑で通ってしまう。
func TestOpen_AllPooledConnectionsHaveForeignKeysOn(t *testing.T) {
    conn := dbtest.Setup(t)
    const n = 16
    holds := make([]*sql.Conn, n)
    for i := range holds { holds[i], _ = conn.Conn(t.Context()) }   // 同時に掴む
    for i, c := range holds {
        var fk int
        _ = c.QueryRowContext(t.Context(), "PRAGMA foreign_keys").Scan(&fk)
        if fk != 1 { t.Errorf("接続 %d が FK=OFF", i) }
    }
    for _, c := range holds { _ = c.Close() }
}
```

**★「同時に掴む」ことが要件である。** 順に取って返すとプールが 1 本を使い回すため、**現行実装でも緑になる**（＝何も守らないテストになる）。

### 6-3. 同じ手番に載せるか判断が要るもの

| # | 項目 | 理由 |
|---|---|---|
| 1 | **`tag.Delete` の明示削除化** | FK=ON で CASCADE は発火するようになるが、**`M23-08` が `combos` 側で採った「CASCADE に依存しない」方針と揃わない。** godoc の失効記述（「`combo_tags` は `ON DELETE CASCADE` で自動削除される」）も残っている。**★★この経路の症状は今アクティブである**——**実 DB の `combo_tags` orphan 1 件により、タグ 1 件が「使用 0 件」と表示されたまま画面からは削除できない**（`CountUsage` が orphan を数え、`force` は画面の表示値から決まるため永久に立たない）。**詳細は設計伝達レポート `20260823-m23-08-design-exceptions.md` §4-2。優先度を決めるときはそちらを見ること** |
| 2 | **既存 orphan 19 件の掃除** | **FK=ON にしても既存の残骸は消えない。** 掃除 SQL は `m23-08-completion-report.md` §4.1 |
| 3 | **`SetMaxOpenConns` の設定** | 本調査では触っていない。**FK とは独立の論点**（プール上限が無いこと自体の是非）。混ぜると射程が膨らむ |

### 6-4. 設計上の選択肢: `PRAGMA defer_foreign_keys`

**万一「既存の削除順序が壊れる」経路が後から見つかった場合の緩和策として記録しておく。**

`PRAGMA defer_foreign_keys = ON` は **FK チェックを最も外側のトランザクションのコミット時まで遅らせる**（コミットで自動的に解除される）。**⇒ トランザクション内の途中経過が一時的に不整合でも、最終状態が整合していれば通る。**

**★本調査では不要だった**（何も落ちなかったため）。**採用を推奨するものではなく、逃げ道が存在することの記録である。**

---

## 7. 本調査で本番コードを変更していないことの証跡

```bash
$ git diff --stat cdfcf0c -- internal/infra/db/db.go
# → 空（実測用の一時変更は復元済み）
$ git status --short
# → 本レポート以外の差分なし
```

**実測に使った probe テスト（`internal/infra/db/fkprobe_test.go`）も削除済み。** 現行実装では赤になるため、コミットすると全体が赤になる。**§6-2 に本文を残したので、根治サブが作るときはそこから写せる。**

---

*以上、P-04 根治の実現可能性 実測レポート。**根治は可能で、既存を壊さない。だが「壊れないことを守り続けるテスト」が要るので、サブとして起票する価値がある。***
