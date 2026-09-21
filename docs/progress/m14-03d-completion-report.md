# M14-03d 完了報告（第二波 seed = manon 単独 ＋ アクセント transliteration の実地検証）

| 項目 | 内容 |
|------|------|
| 指示書 | `docs/instructions/M14-03d-second-wave-manon.md` v1.0.2 |
| チェックリスト | `docs/instructions/reviews/M14-03d-review-checklist.md` v1.0.1 |
| 実施日 | 2026-07-31 |
| 作業ツリー | `wt/m14-03d`（git worktree・**コミットは開発者が実施**） |
| 消費マイグレ連番 | **000043 〜 000048**（6 本） |
| スキーマ変更 | **なし**（CHANGE 起票なし） |
| 判定（§4.3） | **【解あり】AI 補正で埋まっている** |

---

## 1. 【本サブの核】§4.3 アクセント transliteration の実地検証

### 1.1 実測表（§3.3-3 (a)〜(e)）

対象: `character_data/manon.csv`（**72 データ行**・20 列・全行フィールド数 20。開発者が 2026-07-31 に最新版へ差し替え済み＝`temps_lie` 追加後）

| 観点 | 件数 | 実例・根拠 |
|---|---|---|
| **(a) 正準形違反**（`^[a-z0-9_]+$` に反する／非 ASCII を含む） | **0** | 全 72 行が正準形。`move_code` 列の非 ASCII は 0 文字 |
| **(b) アクセント由来と推定される破損**（語頭欠落・意味不明な短縮） | **0** | 下表 1.2 のとおり全て完全形。RESEARCH-02 の予測 `À Terre`→`terre`（語頭欠落）は**発生していない** |
| **(c) 過長 code**（40 字超） | **0** | 最長 **27 字**（`rush_crouching_medium_punch`） |
| **(d) 同一キャラ内 `move_code` 重複** | **0** | — |
| **(d′) 同一キャラ内 `name_ja`（alias_text）重複** | **0** | seedgen dup スキャンの第 2 軸。M14-03b で mai が引っかかった軸 |
| **(e) `name_ja` の接頭語欠落**（`CA `・`SA*_`） | **0** | `SA1 アラベスク` / `SA2 エトワール` / `SA3 パ・ド・ドゥ` / `CA パ・ド・ドゥ`。`move_code` 側も `sa1_`/`sa2_`/`sa3_`/`ca_` で揃う |

補助的に確認した seedgen の validate 条件（いずれも通過）: `total` 検算（`startup+active-1+recovery`）**全行一致** / `recovery` **全行整数** / `category` **全 10 種が enum 内** / `character_code` 列 **全行 `manon`** / `original_move_code` の参照先 **15 件すべて実在**。

### 1.2 (b) の根拠 — アクセント語の実測対応表（`move_code` と `name_ja` の対）

| 公式名（仏語） | 実際の `move_code` | `name_ja` | 判定 |
|---|---|---|---|
| À Terre | `a_terre` | ア・テール | ✅ 語頭 `À`→`a` が保持されている |
| Manège Doré | `manege_dore_{light,medium,heavy,od}`（計 **4** 行） | 弱マネージュ・ドレ ほか | ✅ `è`→`e` / `é`→`e` |
| Dégagé | `degage_{light,medium,heavy,od}`（計 **4** 行） | 弱デガジェ ほか | ✅ |
| Renversé | `renverse_{light,medium,heavy,od}` ＋ `renverse_feint_{...}`（計 **8** 行） | 弱ランヴェルセ ほか | ✅ |
| Grand Fouetté | `grand_fouette_{light,medium,heavy,od}`（計 **4** 行） | 弱グラン・フェッテ ほか | ✅ |
| Allongé | `allonge` | アロンジェ | ✅ |
| Révérence | `reverence` | レベランス | ✅ 語頭 `R`＋`é`→`e` |
| Tomoe Derrière | `tomoe_derriere` | トモエ・デリエール | ✅ |
| Étoile | `sa2_etoile` | SA2 エトワール | ✅ **語頭 `É`→`e` が保持** |
| Temps Lié | `temps_lie` | タン・リエ | ✅ |
| Rond-Point | `rond_point_{light,medium,heavy,od}`（計 **4** 行） | 弱ロン・ポワン ほか | ✅ ハイフン→`_` |
| En Haut / Pas de Deux / Arabesque | `en_haut` / `sa3_pas_de_deux` / `sa1_arabesque` | アン・オー / SA3 パ・ド・ドゥ / SA1 アラベスク | ✅ 空白→`_` |

### 1.3 判定

> **【解あり】AI 補正で埋まっている。**

**根拠**: §3.3-3 の (a)(b)(c)(d) が**すべて 0 件**。とくに (b) は、アクセント付き語頭（`À Terre` の `À`、`Étoile` の `É`）が**落ちずに `a`/`e` へ transliteration されている**ことを 1 行ずつ照合して確認した。M14-RESEARCH-02〔T3/F-14〕が報告した「21 行の `move_code` が壊れる」は **combomgr-importer（FR701）側の `assign_codes` の挙動**であり、**配布 seed の源である手入力 CSV には持ち込まれていない**（`findings-analysis` §1.3 の「重要な区別」が実データで裏付けられた）。

**帰結**: **input-tool の codegen 修正は本件については不要**。第三波（M14-03e）以降は**アクセント由来の品質問題なしで進められる**。

### 1.4 第三波（M14-03e = m_bison / rashid / jamie / luke）への申し送り

| 論点 | 見通し | 根拠 |
|---|---|---|
| アクセント transliteration | **顕在化しない**（manon が最も濃い検体で 0 件） | 対象 4 キャラにアクセント付き公式名はほぼ無い |
| **括弧の過長 code（40〜57 字）** | **要注意・別経路**。本サブでは検証できていない | manon の最長は 27 字で 40 字閾値に届かず、**過長 code の経路を踏んでいない**。M14-03e 着手時に同じ実測（(c) 軸）を必ず行うこと |
| **公式英語名の誤り（luke）** | **要注意・別経路**。本サブでは検証できていない | 同上。ただし **luke は precheck 第2バッチ済み**で `aerial_flash_knuckle` の name_ja/damage 入替が**保留(C-2)のまま**＝投入前に解決が要る |
| **前提マイグレ（characters 行＋移動 9 種）** | **4 キャラすべてで必要**（下記 §5 の申し送り） | 現 `characters` 13 行に jamie/luke/m_bison/rashid は**いずれも不在** |
| `move_code` typo の混入 | 第2バッチで **m_bison 8 件・rashid 1 件を修正済み** | `command-correction-history.md` 教訓18 |

---

## 2. §4.5 rush 行の `is_derived` — **既に是正済み・本サブでの対応なし**

- `manon.csv` の `rush_variant` **15 行はすべて `is_derived=true`**（`false` は **0 件**）。
- 是正は **2026-07-22 の precheck 第2バッチ**で、設計担当の暫定案どおり **(1) CSV 側**として適用済み（`character_data/command-correction-history.md` §manon「is_derived 修正: `rush_*` 15 行を false → true」）。
- **全 16 CSV を横断測定しても `rush_variant` かつ `is_derived=false` は 0 件**（terry/guile/zangief/lily/juri/mai/ingrid/kimberly/ken/ryu/jamie/luke/manon/m_bison/rashid/jp）。
- ⇒ 「残り 20 キャラすべてで同じ是正が要るなら (2) seedgen 変換規則へ組込が経済的」という設計担当の条件分岐は**成立しない**。**変換規則は改訂していない**（§2.3 の例外条項を発動する必要がなかった）。
- **`false` のまま seed していない**ことは `TestRun_M1403d_UpContract`（`rush_variant AND is_derived=0` = 0）で機械的に固定した。

---

## 3. §3.3 着手前確認 11 項目の確定結果

| # | 項目 | 結果 |
|---|---|---|
| 1 | マイグレ連番 | 実査で **000042 まで消費**を確認 ⇒ **000043 から使用**。指示書 §1.4/§3.2 の「000035 まで／000036 以降」は 2026-07-18 時点の記録で、**現ツリーでは 7 番ずれていた**（000036〜000042 は M18/M19 系が消費）。§3.3-1 の「実査結果が正」に従った。**既存マイグレは 1 本も改変していない** |
| 2 | seedgen の I/O 拡張 | **拡張不要**。`-chars`/`-out`/`-note`/`-mode` は M14-03c・M17-02 で実装済みで、**既存フラグを使うだけ**で足りた。**変換規則には 1 行も触れていない** |
| 3 | **【核】`move_code` 実測** | §1 のとおり。**(a)〜(d) すべて 0 件 ⇒【解あり】** |
| 4 | dup スキャン通過見込み | **通過**（生成 fail なし）。投入後の clean DB での全域再測定も **4 軸すべて 0 件**（§4.2） |
| 5 | 移動 9 種の drop | **drop 対象 0 件**。`manon.csv` の `category=system` は **`drive_parry` 1 行のみ**で、移動 9 種は CSV に存在しない。`drive_parry` は通過して seed 済み。**移動 9 種の投入元は 000044 のみ**（二重投入なし） |
| 6 | `is_aerial` の検算 | **該当 0 件**。`is_aerial=true` は `jumping_*` **6 行のみ**（すべて `category=normal`）。manon は空中必殺技を持たず、「`is_aerial=false` かつ command が単方向＋ボタン かつ 空中でしか出ない技」は存在しない。**CSV 側の是正提案なし・本体に規則を足していない** |
| 7 | clean 構築 | **`t.TempDir()` の使い捨て DB へ全マイグレ適用**（§4.3）。**dev DB には一切触れていない** |
| 8 | 件数前提テストの波及 | **3 箇所**（当初 2 箇所と見積もったが、実行で 1 箇所を追加検出。§4.4） |
| 9 | `opt_open`/`opt_close` | **0 件**。manon のみならず `character_data/*.csv` **全 16 ファイルで 0 件**。seedgen の索引サマリでも「索引非搭載 27 件」の内訳が **`derived: 27` のみ**＝`unknown-token` は 1 件も出ていない。⇒ **写像方針の確定は第二波では不要**（設計担当へ「顕在化せず」と申し送り） |
| 10 | 強度なし `p`/`k` 単独形（`6P` 型） | **問題となる形は 0 件**（§3.1 に詳述）。bare `p`/`k` を含む行は 9 行あるが、**8 行は多方向モーション**（`236236K` 等）で解決表の形状フィルタの対象外、残る `grand_fouette_od`(cmd=`k`) は **`is_derived=true` ＝索引非搭載**。生成した 000047 の **45 キーに bare-button キー（`^[1-9]?(P\|K\|P+P\|K+K)$`）は 0 件** |
| 11 | 索引の再生成 | **必要と判断し、新規連番 000047 で manon 分のみ追加**。設計担当の見立てどおり（追加しないと manon の段階2 解決表が空になる）。**既存 000035 は非改変**（golden で byte-pin。他キャラ索引 530 件が不変であることをテストで固定） |
| 追 | **`is_projectile` の要否**（000039 の申し送り） | **manon は backfill 不要**＝`manon.csv` の `is_projectile=true` は **0 件**（実測）。000039 は `moves.is_projectile` を `NOT NULL DEFAULT 0` で追加しており、seedgen は当該列を出力しない（`MoveRow.IsProjectile` は「保全のみ・SQL 非投入」）ため、**true 行が 0 なら既定値 0 が正しい姿**。⇒ 本サブでの追加マイグレは不要。**ただし第三波の luke は要対応**（§5-8） |

### 3.1 §3.3-10 の詳細（`6P` 型の実測）

M17-02 実装メモ §1.2 の懸念は「形状フィルタが**強度付きボタンのみ**（`^[1-9]?(LP|MP|HP|LK|MK|HK)$`）許容なので、強度なし `p`/`k` 単独形が入ると**解決表に載らずサイレントに直接指定へ回る**」というもの。

manon の実測:

| move_code | `command` | 正規化 `token_key` | 索引 | 解決表形状 | 評価 |
|---|---|---|---|---|---|
| `manege_dore_od` | `r dr d dl l plus p p` | `63214P+P` | 搭載 | × | 多方向モーション＝**元々スコープ外**（強度の有無と無関係） |
| `rond_point_od` / `degage_od` | `d dr r plus k k` / `d dl l plus k k` | `236K+K` / `214K+K` | 搭載 | × | 同上 |
| `renverse_od` | `d dr r plus p p` | `236P+P` | 搭載 | × | 同上 |
| `sa1_arabesque` / `sa2_etoile` | `d dr r d dr r plus k` / `d dl l d dl l plus k` | `236236K` / `214214K` | 搭載 | × | 同上（既存 ryu `214214P` と同型） |
| `sa3_pas_de_deux` / `ca_pas_de_deux` | `d dr r d dr r plus p` | `236236P` ×2 | 搭載 | × | 同上。**同一キーの 1:N** は設計どおり（`Lookup` は id 最小でタイブレーク・ryu の denjin 系と同型） |
| `grand_fouette_od` | `k` | — | **非搭載** | — | **`is_derived=true`** のため索引に載らない |

**既存 000035（530 キー）と新規 000047（45 キー）の実測**（レビュー指摘 §高-1 を受けて再測定・訂正）:

| 形状 | 000035（既存 10 キャラ・530 キー） | 000047（manon・45 キー） | 段階2 解決表 |
|---|---|---|---|
| **単独 bare `P`/`K`（`^[1-9]?(P\|K)$` ＝真の `6P` 型）** | **0 件** | **0 件** | 載らない（M17-02 §1.2 の懸念そのもの） |
| `P+P` / `K+K`（OD の同時押し） | **3 件** — `lily/condor_dive`(`P+P`)・`ken/quick_dash`(`K+K`)・`zangief/double_lariat`(`P+P`) | **0 件** | 載らない（**形状フィルタの対象外＝設計どおり**。OD 系は段階2 スコープ外） |
| 解決表形状に合致（`^[1-9]?(LP\|MP\|HP\|LK\|MK\|HK)$`） | 220 件 | 21 件 | 載る |

⇒ **M17-02 の「実データ 0 件」は「単独 bare `P`/`K`（`6P` 型）」を指すものとして現時点でも維持されており、manon はこれを壊さない**。`P+P`/`K+K` は既存 seed に 3 件実在するが、これらは**強度指定のない同時押し＝段階2 のスコープ外**として設計上載せない形（`internal/service/inputresolve/service.go` の形状フィルタ）であり、`6P` 型の「サイレントに直接指定へ回る」問題には該当しない。

> **訂正の経緯**: 初版の本報告は「000035 に bare-button キー 0 件」と記載していたが、これは判定に使った正規表現が `PP`/`KK` を想定しており、実際の正規化キー `P+P`/`K+K` に**マッチしていなかった**ための誤り。**結論（`6P` 型 = 0 件）は変わらない**が、第三波の判断材料になる数値のため訂正する。

> **申し送り（設計担当向け）**: `grand_fouette_od` だけが `command=k` を持ち、同族の `grand_fouette_light/medium/heavy` は **command 空**という非対称がある。いずれも `is_derived=true` で索引非搭載のため**現時点で実害はない**が、データとしては不揃い。**是正するならデータ側**（本体は取込値を信頼）。本サブでは §4.2 の原則どおり**報告のみで触っていない**。

---

## 4. 実施内容

### 4.1 成果物

| 連番 | ファイル | 種別 | 内容 |
|---|---|---|---|
| **000043** | `000043_seed_characters_manon.{up,down}.sql` | **手書き** | `characters` へ manon（`マノン`/`Manon`）1 行。`ON CONFLICT DO NOTHING`。`custom_states` は NULL |
| **000044** | `000044_seed_movement_system_moves_manon.{up,down}.sql` | **手書き** | 移動 system move 9 種＋`official_ja_move` alias を manon へ。`NOT EXISTS` ガードで冪等。`total` は NULL で INSERT し、**000048 で backfill** |
| **000045** | `000045_seed_moves_manon.{up,down}.sql` | **seedgen 生成** | manon の moves **72**＋alias 72＋rush の `original_move_id` 解決 |
| **000046** | `000046_backfill_moves_is_derived_manon.{up,down}.sql` | **seedgen 生成** | `is_derived=1` を **27 code** へ backfill |
| **000047** | `000047_seed_move_commands_manon.{up,down}.sql` | **seedgen 生成** | `move_commands` 索引 **45 件** |
| **000048** | `000048_backfill_movement_total_manon.{up,down}.sql` | **手書き** | 移動 5 code の `total` backfill（`dash_forward=21` / `dash_back=25` / `jump_*=43`）。000041 と同型 |

生成コマンド（golden テストの doc コメントにも実値で固定済み）:

```
go run ./cmd/seedgen -chars manon -out 000045_seed_moves_manon \
  -note "M14-03d: manon の moves + official_ja_move alias + recovery を手入力 CSV 由来で投入する(第二波)。"
go run ./cmd/seedgen -mode derived-backfill -chars manon -out 000046_backfill_moves_is_derived_manon \
  -note "M14-03d: manon の is_derived backfill(CSV に載る code のみ UPDATE)"
go run ./cmd/seedgen -mode move-commands -chars manon -out 000047_seed_move_commands_manon \
  -note "M14-03d: manon の command 索引 move_commands の seed(非派生のみ)"
```

### 4.1.1 【重要】指示書の前提が崩れていた点と、その裁定

**`manon` は `characters` テーブルに存在しなかった。**

- 指示書 §3.2 の前提事実「**移動 system move 9 種は M14-03b で全キャラ投入済み＝manon も投入済み＝本サブで再投入しない**」は**現ツリーに対して誤り**。000025 は `NOT EXISTS` ガード付きだが、これは**冪等性のため**であって、後から追加されたキャラを遡って埋めるものではない。000025 適用時点の `characters` は 12 行（ryu/ken/ingrid/c_viper/dhalsim/terry/guile/lily/kimberly/juri/mai/zangief）で、**manon はそこに含まれていない**。
- **危険性**: seedgen の生成 SQL は `FROM characters c ... WHERE c.code='manon'` で解決するため、characters 行が無いと**マイグレは成功したまま 0 行投入される（サイレント no-op）**。テストを書かなければ「投入した」と誤認したまま完了しうる。
- **開発者裁定（2026-07-31・Plan Mode で確認）**: **前提マイグレ（000043/000044）も本サブで追加する**。既存マイグレは非改変・**manon 限定の加算のみ**。
- **移動 move の `total`**: 000041（M18-02/CHANGE-084 v2）の移動 total は**開発者提供の実測値**が一次源で、DB/CSV/マイグレのどこにも manon の値が無い（`manon.csv` に移動 move の行が無い）。Plan Mode 時点では未受領のため「**推測で埋めず NULL 維持**」（c_viper/dhalsim と同じ扱い）を裁定いただいたが、**2026-07-31 に実測値を受領**（`dash_forward=21` / `dash_back=25` / `jump_*=43`）したため、**000048 で backfill して解消済み**。値は既存 10 キャラのレンジ（dash_forward 18〜22 / dash_back 23〜25 / jump 43〜45）内で整合する。
  - **000044 を書き換えず新規連番にした理由**: 既存マイグレ非改変の原則に加え、**000044 の INSERT は `NOT EXISTS` ガード付き**のため、既に 000044 まで適用済みの DB では 000044 を直しても行が再投入されず **total がサイレントに欠落する**。UPDATE 方式なら適用済み・未適用のどちらでも同じ最終状態へ収束する。
  - `forward` / `back` / `micro_forward` / `micro_back` の 4 code は **000041 でも対象外**のため NULL のまま（実測値が存在しない）。
  - **影響**: manon では確定反撃サーチの**ダッシュ経由候補判定**（残り猶予 = 有利F − `dash_forward.total`）が効かない。**実測値の受領後に 000041 と同型の backfill マイグレを別途起票する必要がある**（followup）。

### 4.1.2 `character_data/manon.csv` の誤字修正（開発者承認済み）

`reverence` / `rush_reverence` の **2 行**の `name_ja` を修正:

```
- manon,reverence,unique,レべランス,...
+ manon,reverence,unique,レベランス,...
- manon,rush_reverence,rush_variant,レべランス(ラッシュ),...
+ manon,rush_reverence,rush_variant,レベランス(ラッシュ),...
```

3 文字目が**ひらがなの「べ」(U+3079)** になっていた（正しくはカタカナ「ベ」U+30D9）。この値は `preset_aliases`（`official_ja_move`）として **UI にそのまま出る**ため、投入前に直すのが最も安い（投入後だと UPDATE マイグレが要る）。**開発者の明示承認のうえで製造側が修正**した。

- 修正後、`character_data/*.csv` 全体で「カタカナ列の中にひらがなが混じる」パターンは **0 件**。
- manon.csv は既存 golden（000026＝第一波 9 キャラ／000030＝ryu／000034・000035＝10 キャラ）の**いずれの入力でもない**ため、この修正で既存 golden は壊れない（実際に全 golden green）。
- **`move_code` は 1 文字も変更していない**（§4.2 の原則＝CSV が正・再採番しない）。

> なお `character_data/` 配下には開発者による他の変更（`rashid.csv` 更新・`jp.csv` 追加・`seed-progress.md` に jp 追加・`command-correction-history.md` 更新）が同居しているが、**これらは本サブの成果物ではない**。

### 4.2 dup スキャン結果

**生成時スキャン**: 3 軸（同一キャラ内 `move_code` 衝突 / `alias_text` 衝突 / `(preset_id, move_id)`）すべて検出 0 件 ⇒ **生成 fail せず**。自動リネーム・自動 skip は**一切行っていない**。

**投入後の全域再測定**（clean DB・M14-03b §4.6）:

| 測定軸 | 結果 | 期待値 |
|---|---|---|
| 同一キャラ内 `move_code` 重複 | **0** | 0 |
| 同一キャラ内 `official_ja_move` alias_text 重複 | **0** | 0 |
| `(preset_id, move_id)` 重複 | **0** | 0 |
| `official_ja_move` alias を持たない moves | **0** | 0（＝**生 code フォールバックが出ない**） |

### 4.3 clean マイグレ由来 DB の構築（証跡）

- **構築方法**: `internal/infra/migration` のテストが使う `newMigrator(t)` は **`t.TempDir()` 配下の新規ファイル**に対し embed FS の全マイグレを適用する。`dbtest.Setup` も同じく `t.TempDir()`。⇒ **dev DB 残渣は構造的に混入しない**。
- **実測値**（clean DB・全マイグレ適用後）:

```
version=47  dirty=false
characters=13   moves_total=1025   official_ja_move alias=1025
move_commands=575 (索引キャラ数 11)
```

- **dev DB（`~/.local/share/combomgr/combomgr.db`）には一切触れていない**（本作業は worktree 内で完結。他ツリー・稼働中 dev サーバと共有のため）。
  - **開発者へのお願い**: dev 環境へ反映する際は (1) `combomgr.db{,-wal,-shm}` を `.pre-m14-03d-bak` へ退避、(2) **dev バックエンドを再起動**（稼働中プロセスは起動時にしかマイグレを適用しないため、再起動しないと画面18 は旧 seed のまま表示される＝既知の落とし穴）。

### 4.4 テスト

**新規 golden 3 本**（「生成マイグレ 1 本につき golden 1 本」）＋変換不変条件 1 本 — `internal/seedgen/generate_m1403d_test.go`:

- `TestGolden_ManonMovesMatchesRegeneration` / `TestGolden_ManonDerivedBackfillMatchesRegeneration` / `TestGolden_ManonMoveCommandsMatchesRegeneration`
  — `-note` 文字列を `const` に**実値でピン**、再生成コマンド全文を doc コメントに記載
- `TestManon_ConversionInvariants` — 移動 move の drop が 0 件／索引非搭載の理由が **`derived` のみ**であることを固定
  - 正確な効能: **非派生行に「未知トークン（`opt_open` 等）・条件残留（`cond{…}`）・command 空」が 1 件も無い**ことの固定。データ上は command 空が **22 行**あるが**すべて `is_derived=true`** で、`internal/moveindex/moveindex.go` の `skipReasonFor` が derived を先に判定するため `empty-command` としては現れない（**非派生 45 行はすべて command 非空**＝別途実測済み）
- 既存ヘルパ（`assertGolden` / `repoRoot` / `ReadFile`）を再利用し、**新規ヘルパを作っていない**

**新規 E2E spec** — `web/e2e/m14-03d-manon-seed.spec.ts`（指示書 §5.2。**read-only＝共有 seed を汚さない**。§4.6 参照）

**新規マイグレ契約テスト** — `internal/infra/migration/migrate_m1403d_test.go`:

- `TestRun_M1403d_UpContract` — characters 1 / moves **81**（CSV 72＋移動 9）/ alias **81**・欠落 0 / 移動 9 種の存在と **移動 5 code の total 実測値一致**（`dash_forward=21`/`dash_back=25`/`jump_*=43`）・`forward`/`back`/`micro_*` は NULL 維持 / `drive_parry` 通過 / `is_derived=1` **27** / `rush_variant` **15** かつ `is_derived=0` **0** / `original_move_id` 未解決 **0** / `move_commands` **45**・派生混入 0・孤児 0 / 代表キー `4HP`→`reverence` / FK 違反 0
- `TestRun_M1403d_OtherCharsUnaffected` — v42 → HEAD のスナップショット比較で**他キャラの (moves, alias) が 1 行も増減しない**こと、**移動 9 種を他キャラへ再投入していない**こと（12×9=108）、**既存 000035 の索引 530 件が不変**であることを固定
- `TestRun_M1403d_DownRestoresPreState` — `Steps(-5)` で manon 由来行が全消滅し v42 状態へ戻ること、**再 up の冪等性**、FK 違反 0

**既存テストの追従（件数前提の波及）— 3 箇所**:

| ファイル:行 | 変更 | 理由 |
|---|---|---|
| `internal/infra/migration/migrate_test.go:896` | `characters` **12 → 13** | 000043 で manon が 1 行増える |
| `internal/repository/movecommand/repository_test.go:113` | `CharKeys` **10 → 11** | 000047 で manon の索引が入る |
| `internal/service/punishfinder/service_test.go:377-379` | `wantLegacyJumpHeavy` **21 → 23** / `wantOptionC` **23 → 25** | manon の `jumping_heavy_punch` / `jumping_heavy_kick` が jump レーン候補へ加わる |

> **punishfinder の canary について**: このテストは「seed 追加・是正時は**数字だけを合わせず、案 C の候補差分を再計測**して更新する」と明記されている。指示どおり再計測した結果、**増分は manon の 2 件のみ**で、案 C の増分内訳（`juri/neutral_jumping_heavy_kick`・`ken/neutral_jumping_heavy_kick` の 2 件）と `wantUniqueAerial=7` は**不変**であることを確認した（manon は `neutral_jumping_*` を持たず、`is_aerial=true` は `category=normal` の `jumping_*` 6 件のみ）。あわせて、テスト名に件数が埋め込まれていて seed 追加のたび実態とずれる問題があったため、`TestScan_JumpLane_SeedRegression_Existing21PlusNeutral2` → **`TestScan_JumpLane_SeedRegression_ExistingJumpHeavyPlusNeutral`** へ改名した（判定値は `const` が正）。

**結果**: `go test ./...` **全通過** / `go vet ./...` **クリーン**。

### 4.5 変換規則の無改変（回帰ゲート）

```
$ go run ./cmd/seedgen -check
OK: 生成物は既存ファイルと一致
投入 moves 合計 = 752 / 索引キャラ数 = 9 / 索引非搭載(記録)= 278 / drop 移動move = 0
```

- **000026 は byte-identical**（作業前・作業後の 2 回確認）。既存 golden 4 本（000026 / 000030 / 000034 / 000035）も**全 green**。
- `internal/seedgen/` の**変換規則コードは 1 行も変更していない**（追加したのはテストファイル 1 本のみ）。
- **`internal/moveindex` は無改変**。
- `cmd/seedgen` も無改変（既存フラグのみ使用）。

> **既知の記述ズレ（触っていない）**: `migrations/000045_seed_moves_manon.up.sql:4` の生成ヘッダは「移動 system move 9 種は drop 済(**投入元は 000025**)」と出力するが、**manon の投入元は 000044** である。この文字列は `internal/seedgen/generate.go` の `CustomHeader` にハードコードされており、**直すと変換規則の改変＝§2.3 の停止条件に触れる**ため触っていない（golden の byte-identical も崩れる）。**第三波以降も同じズレが出る**ので、恒久対応（波ごとの投入元をパラメータ化）を設計担当の判断事項として申し送る。

### 4.6 E2E

**新規 spec `web/e2e/m14-03d-manon-seed.spec.ts` を追加**（指示書 §5.2 の直接証跡）。単独実行で **green**:

- manon が `characters` に存在し、`GET /api/moves` が **81 件**（CSV 72＋移動 9）を返す
- **`nameJa`（＝`official_ja_move` alias）欠落が 0 件**＝**生 code フォールバックが出ない**条件そのもの
- 移動 system move 9 種が manon に存在する（000044 の効果）
- 画面18 でキャラ「マノン」を選択 → `reverence` 行に **「レベランス」**（誤字是正後の表記）が出る
- **アクセント由来の技名が生 code ではなく日本語名で表示**（`a_terre`→ア・テール / `manege_dore_light`→弱マネージュ・ドレ / `sa2_etoile`→SA2 エトワール / `temps_lie`→タン・リエ）＝§4.3 の判定を UI 側で裏取り
- グリッド上に alias 欠落を示す `—` セルが **0 件**
- 行の入力欄が編集可能（**保存はしない＝共有 seed を汚さない read-only spec**。再読込で元値に戻ることまで確認）

**スイート全体の非回帰**: `make e2e` を **2 回**実行し、レビュアーも独立に 1 回実行した（計 3 回）。

| 実行 | 結果 |
|---|---|
| 1 回目（製造） | 63 passed / 5 flaky / **0 failed** |
| 2 回目（レビュアー・独立） | 56 passed / 11 flaky / **1 failed**（`m17-05c-pdf-pagination.spec.ts:80`） |
| 3 回目（製造） | 61 passed / 6 flaky / **1 failed**（`m18-03b-materialize.spec.ts:167`） |

**「0 failed」は再現しない**（初版報告の断定は誤りだったため訂正）。ただし:

- **落ちる spec が毎回異なる**（`m17-05c-pdf-pagination` / `m18-03b-materialize`）＝**特定シナリオの回帰ではなく、並列実行時の負荷由来の flakiness**。
- 落ちた 2 spec を**単独実行すると 7 tests すべて green**（再実行で確認済み）。
- **両 spec とも `manon` を 1 箇所も参照していない**（grep 0 件）。失敗内容もフィクスチャ API（`POST /api/combos` / `DELETE /api/combos/:id`）の非 OK で、**seed・manon とは無関係**。

⇒ **本サブによる回帰ではない**と判断する。正確な現状記述は「**全 green ＋ 既知 flaky（高負荷時に一部 spec が retry を使い切ることがある）**」。

> チェックリスト §5 は「18 spec 全 green が現行 baseline」と記載しているが、これは M14-03d 起票時点（2026-07-16）の値。現ツリーは M17〜M19 の spec 追加により **28 spec / 64 test**（本サブの新規 1 spec を含む）まで増えている。**E2E 実行環境の flakiness を followup として起票することを推奨**（本サブのスコープ外）。

---

## 5. 設計担当への申し送り

1. **指示書 §3.2 の前提事実の誤り**（§4.1.1）。「移動 system move は M14-03b で全キャラ投入済み」は**キャラが characters に載っていることが前提**であり、未登録キャラには適用されない。
2. **第三波以降も同じ前提崩れが起きる**。現 `characters` **13 行**に対し、CSV が用意されている **jamie / luke / m_bison / rashid / jp はいずれも未登録**。⇒ **各波で「characters 行＋移動 9 種＋alias」の前提マイグレが 2 本ずつ要る**（本サブの 000043/000044 が雛形）。指示書テンプレートへの反映を推奨。
3. **移動 move の `total`**: 新規投入キャラは 000041 の対象外のため NULL で入る。**実測値の提供フロー**（開発者提供が一次源）を波ごとに組み込む必要がある。放置すると確定反撃サーチのダッシュ経由判定が当該キャラで無効。**manon は 000048 で解消済み**だが、**第三波（jamie/luke/m_bison/rashid）以降も波ごとに同じ backfill が要る**（指示書テンプレートへの反映を推奨）。
4. **`opt_open`/`opt_close` の写像方針**（M17-02 残課題 #2「第二波 seed 前に写像方針確定」）: **全 16 CSV で 0 件**のため**第二波では確定不要**。実データが出るまで先送りできる。
5. **`6P` 型の展開規則**（M17-02 §1.2）: **manon でも 0 件**。ただし他 CSV には bare 単独ボタン（例 `m_bison/head_press`=`k`、`rashid/nail_assault`=`k`、`luke/no_chaser`=`p`）が実在するため、**第三波の precheck で `is_derived` と併せて再測定**すること（`is_derived=true` なら索引非搭載で実害なし）。
6. **`grand_fouette_od` の command 非対称**（§3.1 末尾）。データ側の不揃いとして報告のみ。
7. **`character_data/seed-progress.md` の `seed_imported` 欄が実態と乖離**（全キャラ「未」のまま。第一波 9＋ryu＋manon は投入済み）。**製造は本表を更新していない**（開発者が手動更新する運用のため）。
8. **【第三波の落とし穴】`is_projectile` の backfill が luke で必要**。`000039_add_moves_is_projectile.up.sql:10` は「未 seed の manon/luke(**true 5 件**)は本マイグレ対象外＝**M14-03d/e の seed 投入時に別途 backfill する**」と申し送っている。実測すると:
   - **manon = 0 件** ⇒ 本サブでは backfill 不要（既定値 0 が正）。
   - **luke = 6 件**（`sand_blast_light/medium/heavy/od`・`fatal_shot`・`sa1_vulcan_blast`）⇒ **M14-03e で backfill が必須**。
   - なお 000039 ヘッダの「true 5 件」は**現 CSV に対して古い**（`fatal_shot` は 2026-07-22 の precheck 第2バッチ Phase 4 で `is_projectile` を false→true へ是正済み＝5→6）。
   - **seedgen は `is_projectile` を出力しない**ため、忘れると**エラーにならず静かに全行 false のまま入る**。luke では確定反撃走査の弾属性除外・セットプレイ提案が誤動作する。**M14-03e の指示書へ明示的に落とすことを強く推奨**。
9. **`docs/handover/code-facts.md` §10-1 のマイグレ一覧が 000042 で止まっている**（自動生成物）。同ファイルは「次の連番を調べる場所」として自己記述しており、**本サブが踏んだ前提ずれ（§4.1.1）と同じ罠**を後続へ再生産する。`regen_code_facts` での再生成を推奨（**本サブでは実施していない**＝再生成すると M18/M19 由来の無関係な差分を巻き込み、本サブのスコープを超えるため）。

---

## 6. 残キャラ網羅表（配布 blocker の残状態）

clean DB 実測（`characters` 13 行）:

| 区分 | キャラ | moves 件数 | 状態 |
|---|---|---|---|
| **投入済み（第一波 9）** | terry 79 / guile 97 / lily 90 / ingrid 100 / kimberly 104 / juri 82 / ken 89 / mai 105 / zangief 87 | 79〜105 | ✅ M14-03b（000026） |
| **投入済み（M14-03c）** | ryu | 93 | ✅ 000030 |
| **投入済み（本サブ）** | **manon** | **81** | ✅ **000043〜000048** |
| **仮登録（攻撃技なし）** | c_viper / dhalsim | 各 9（移動のみ） | ⚠️ 最終波で対応 |
| **CSV あり・未投入** | jamie / luke / m_bison / rashid / **jp** | — | ⏳ M14-03e（jamie/luke/m_bison/rashid）／jp は量産波以降。**いずれも characters 未登録** |
| **CSV 未着手** | 上記以外 | — | ⏳ 手入力待ち |

- **手入力 CSV: 16 キャラ分**（`character_data/*.csv`。今回 `jp.csv` が新規追加された）。うち **11 キャラが seed 投入済み**（第一波 9＋ryu＋manon）。
- **配布 blocker は本サブでは解除しない**。解除は**全 30〔/31〕キャラ充足時点**＝M14-03（最終波）の判定サブで行う（M14-overview §4.7）。本サブは**段階投入の第二波**であり、優先度（投入順）はあっても期限は持たない。

---

## 7. 完了条件（DoD）の充足状況

### 7.1 機能

- [x] manon の moves＋alias が投入され、**alias が対**（alias 欠落 0＝生 code フォールバックなし）
- [x] **移動 9 種を再投入していない**（投入元は 000044 のみ・他キャラの移動 move は 12×9=108 で不変）
- [x] **他キャラ非波及**（v42 → HEAD のスナップショット比較で (moves, alias) が全キャラ不変）・**ryu/第一波 非改変**
- [x] **clean マイグレ由来 DB から構築**（`t.TempDir()`・dev DB 残渣なし・証跡は §4.3）

### 7.2 検証（本サブの核）

- [x] **§4.3 の 3 点**（実測表 §1.1・判定 §1.3・第三波への申し送り §1.4）
- [x] **§4.5 の実測と結論**（§2。`false` のまま seed していないことをテストで固定）
- [x] **§3.3-9/-10/-11 の実測結果**（§3 表・§3.1）
- [x] **判定が【解あり】で明示**され、**根拠（実測値）が添えられている**

### 7.3 品質

- [x] **seedgen の変換規則が無改変**（000026 golden byte-identical・`-check` OK）
- [x] **生成マイグレ 1 本につき golden 1 本**（3 本追加）
- [x] `go test ./...` 全通過・`go vet` クリーン・`dbtest.Setup` 経由の全テスト通過
- [x] `make e2e` 非回帰（§4.6。**新規 spec 1 本追加**・スイート全体は「全 green ＋ 既知 flaky」＝**本サブによる回帰なし**）
- [x] **指示書 §5.2（画面18 で manon の moves が表示・編集でき、alias が効いて生 code フォールバックが出ない）を E2E で直接証跡化**（`web/e2e/m14-03d-manon-seed.spec.ts`）
- [x] 禁則表現・簡体字・「起き攻け」誤字・「DR」略記の grep 除去（新規/変更ファイルで 0 件）

### 7.4 ドキュメント

- [x] Plan Mode 確定（§3 の 11 項目）・§4.3 の実測と判定・dup スキャン結果・残キャラ網羅表・`is_aerial` 検算結果を本報告に収録
- [x] **残キャラ網羅表を `docs/handover/followup-backlog.md` §C-1 へ反映**（指示書 §10）。あわせて同節の ★必須 2 項目（`M14-03-is-projectile-backfill` の「true 5 件」／`M14-03-dash-total-backfill`）の**実測との齟齬を訂正**し、**未 seed キャラは `characters` に存在しない**という第三波以降の必須前提を追記した
- [x] **消費連番 000043〜000048 を明記**（分割数は §9.2 の裁量。後続サブは **000049 から**）
- [x] **製造は DES を直接編集していない**

---

## 8. 未実施・持ち越し

| # | 内容 | 理由・対応先 |
|---|---|---|
| ~~1~~ | ~~manon の移動 move `total` backfill~~ | **解消済み**（2026-07-31 に実測値受領 → **000048** で backfill。`dash_forward=21`/`dash_back=25`/`jump_*=43`） |
| 1b | **luke の `is_projectile` backfill（6 件）** | **M14-03e で必須**（§5-8）。本サブの対象外（manon は 0 件で不要） |
| 1c | `docs/handover/code-facts.md` §10-1 のマイグレ一覧再生成 | `regen_code_facts` で実施。本サブでは無関係な差分を巻き込むため見送り（§5-9） |
| 2 | manon の `custom_states`（メダルLv） | 開発者方針でスコープ外（`command-correction-history.md` 教訓20） |
| 3 | `character_data/seed-progress.md` の `seed_imported` 更新 | 開発者が手動更新する運用 |
| 4 | `grand_fouette_od` の command 非対称 | データ側の判断事項として報告のみ（§3.1） |
| 5 | git コミット | **worktree 運用のため製造は git 操作を行わない**。コミット・マージは開発者が実施 |

---

*以上、M14-03d 完了報告。対のレビュー報告書は `docs/progress/m14-03d-review.md`。*
