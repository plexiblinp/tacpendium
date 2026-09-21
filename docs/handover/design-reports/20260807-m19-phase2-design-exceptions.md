# M19 Phase 2 設計伝達レポート（例外レポート）

| 項目 | 内容 |
|------|------|
| 文書ID | M19-PHASE2-DESIGN-EXCEPTIONS |
| 宛先 | **親チャット（設計卓）** |
| 発信 | 製造担当 Claude Code（2026-08-07） |
| 対象サブ | **M19-PHASE2**（指示書 `docs/instructions/M19-PHASE2-instruction-v1.0.0.md` v1.0.0） |
| 実装コミット | `feature/m19-phase2` ブランチに 10 コミット（`f16fb3e`〜）。**push 未実施**（リモート反映は開発者） |
| 消費した連番 | **`000064`（①）／ `000065`（②）／ `000066`〜`000068`（追補）**（**着手時に `ls migrations/` を実査**し、末尾が `000063` であることを確認して払い出した。予約帯は作っていない。次は **`000069`**） |
| CHANGE | **新規起票なし**（理由は §6） |
| 関連 | 完了報告 `docs/progress/m19-phase2-completion-report.md` ／ レビュー `docs/progress/m19-phase2-review.md` |
| 作成条件 | 実装直後の同一セッション内で生成。**開発者とのやり取りで確定した裁定 4 件（§3-0 の表）を反映している** |

本レポートは **①製造が独自に確定した仕様 ②契約・設計に反する独自判断 ③製造の判断 ④設計担当が未把握の残課題**に絞った差分である。指示書どおりに実装した部分は書いていない（それらは完了報告にある）。

**★最重要は §3-4（`M19-DESIGN-07` の失効）と §1-1（親参照の採用規則）。** 前者は **M19-05 が同資料を正本として読むため、着手前に直さないと落ちる**。§2 は「契約 F-2 の解除」を指示書が明示的に与えたものであり、**解除範囲を超えた独自判断は 1 件も無い**。

---

## §1 独自に確定した仕様

### 1-1 `move_derivations` の親参照の採用規則（指示書 §1.5「その他」）

指示書は「記入欄に『〜から派生』と書かれている行を全数抽出して報告すること」とし、投入範囲を明示していない。実査すると該当は **11 キャラ側 56 件・第三波側 43 件**あり、性質が 4 つに分かれた。開発者裁定（2026-08-07）により、次の規則で確定した。

**採用**: 記入欄が「〜からのみ／だけ派生」の**断定形**で、かつ**親が `moves` の具体行に一意に解決できる**もの。**63 対（子 37 行）**を投入した。

**不採用**（全数は §3-2 に列挙）:

| # | 類型 | 理由 |
|---|---|---|
| a | 「Quick Dash から最速で」「Sprint から最速で」「ランヴェルセから最速」 | `startup_basis = 'through'` の根拠を述べたもので、親子関係の断定ではない |
| b | 親が移動 system move（`dash_forward` / `jump_*`） | 上と同型。rashid `backup` / `tempest_moon` / `buffed_tempest_moon` / `wall_jump` |
| c | 親が move でない（「ジャンプから出る special / superarts」） | 親行が存在しない |
| d | 親を明示的に否定しているもの | mai `midare_kachousen` 系・manon `renverse_feint` 系 |
| e | 親に対応する `move_code` が存在しない | rashid `nail_assault` / `rolling_assault` / `wing_stroke` の「アサルト・ロール」 |
| f | 親が一意に定まらない | jamie `freeflow_strikes` 系 16 行・lily `condor_dive_follow_up` 系 2 行（§3-2 参照） |

### 1-2 lily `condor_dive` の `fastest_unreachable` の対象行

第三波 §3 の一次源は「Lilyのcondor_dive。これはfastest_unreachable=trueだが会話をしていなかった。」で「一律」表記が無く、対応行が 6 つある。**開発者裁定（2026-08-07）でダイブ本体 4 行**（`condor_dive` / `condor_dive_od` / `windclad_condor_dive` / `windclad_od_condor_dive`）に確定した。`condor_dive_follow_up` / `windclad_od_condor_dive_follow_up`（`startup` 12・ダイブからの派生）は対象外。

### 1-3 rashid `wall_jump` の是正値

指示書 §1.6 (b) 11 番は `startup 34 / active 42` のみを指定するが、**内部整合 `total = startup + active − 1 + recovery` が成立しない**（34+42−1+0 = 75 ≠ 現行 `total` 81）。**開発者裁定（2026-08-07）で `35 / 42 / 0 / 76` を確定値とした**（35+42−1+0 = 76 ✓）。

### 1-4 jamie 流酔拳の `move_code` の反転（**開発者申告の入力ミス**・`000066`）

**飲酒版と非飲酒版で「単発」を指す `move_code` の付き方が反転していた。**`name_ja` は両系統とも正しく、**誤っていたのは `move_code` だけ**である。

| | 飲酒版（正） | 非飲酒版（誤） |
|---|---|---|
| 単発（基底・`standalone` 13F） | `..._1hit_<強度>` | **`..._<強度>`（無印）** |
| 2発止め（`through`） | `..._2hits_<強度>` | `..._2hits_<強度>` |
| フル（`through` 53/78F） | `..._<強度>`（無印） | **`..._1hit_<強度>`** |

**開発者裁定（2026-08-07）で「`_1hit_` 版を既定にする」と確定**し、非飲酒版 4 対 8 行の `move_code` を入れ替えた。これにより §3-2 の 4 番（親が一意に定まらず投入を見送っていた 16 対）が解消し、`000067` で投入した。

**⇒ `DES-004` / seed 規約に「同一技のバリエーション系統は、接尾辞と `name_ja` の対応を系統間で一致させる」を明文化してほしい。** 検出観点は `docs/seed-data/check-criteria.md` §3 に追加済み（§7-7）。

### 1-5 kimberly `elbow_drop` の `startup_basis`（`000067`）

**開発者裁定（2026-08-07）**——「空中で出せる必殺技（jamie `luminous_dive_kick`）と同じ性質を持つ `unique` 技で、**ジャンプからの最速入力という意味で `through`**。前提の技はジャンプ」。`standalone` → `through` へ是正した。

**★親参照（ジャンプ）は付けていない。** 移動 system move を親にしてよいかが未裁定であり（§1-1 の不採用類型 b）、本行は `through` なので **D-227 の除外述語には掛からず、付けなくても消費側の判定は変わらない**ため。**「前提技はジャンプ」という事実の記録先は設計卓の判断が要る**（§4-10）。

### 1-6 `fastest_unreachable` の 5 行を既定値へ戻した（`000068`）

**開発者裁定（2026-08-07）**——「devil_reverse / head_press、および念のため kimberly の elbow drop は**最速入力で当たる**ので、`fastest_unreachable` は `false` である必要がありました」。

**★列の意味の取り違えが一度発生している。** `fastest_unreachable = true` は **「単独で最速入力しても地上の相手に当てられない」**（`000049` の DDL コメント／`DES-003` §3.3）であり、**「当たるか」のフラグではない**。今回の裁定は「当たる」なので `false` が正しい。

| 撤回した行 | 投入元 |
|---|---|
| m_bison `devil_reverse` / `devil_reverse_od` / `head_press` / `head_press_od` | `000067` A（記入欄に埋め込まれた `fastest_unreachable=true`） |
| kimberly `elbow_drop` | `000064` B（B 型一覧の記入値 `true`） |

**⇒ 一次源（記入欄・B 型一覧）の記入値 `true` が、5 行とも誤りだったことになる。** `fastest_unreachable = 1` は 148 → **143**。

**★`startup_basis` は戻していない。** kimberly `elbow_drop` の `through`（§1-5）は維持する。**2 つは別の軸である**——「ジャンプからの通し値か」（`startup_basis`）と「単独最速で地上に当たるか」（`fastest_unreachable`）は独立に決まる。

**⇒ `DES-003` §3.3 の `fastest_unreachable` 欄に「★true は『当てられない』である。『当たる』ではない」を、記入用一覧のテンプレートにも同じ注意書きを入れてほしい。** 一次源の記入段階で 5 行が逆に書かれており、**製造・レビューのどちらもコードからは検出できない**（値域は 0/1 で両方妥当なため）。

---

## §2 契約・設計に反する独自判断

**契約 F-2 の解除**は指示書 §0.2 が明示的に与えたものであり、独自判断ではない。**解除された 21 行以外の凍結列に触れた事実は無い。**

### 2-0 既存マイグレの再生成（要説明）

**`migrations/000026_seed_moves_first_wave.up.sql`（ken 6 行）と `migrations/000055_seed_moves_third_wave.up.sql`（第三波 14 行）を再生成した。** 指示書 §2.2 が要求した三点更新（CSV 正本の是正 → golden 再生成 → 追随マイグレ）の 2 点目であり、`internal/seedgen/` の生成関数には一切触れていない（diff 0）。再生成コマンドは各 golden テストの doc コメントに記載のもの。差分は **20 行ちょうど**で、CSV 側の 20 行と 1 対 1 に対応する（行数・トークン数は不変）。`000030` / `000034` / `000035` / `000045`〜`000047` / `000056` / `000057` は不変（`move_code` を 1 件も変えていないため、code 列挙型の生成物には影響しない）。

### 2-0b 追補で契約 F-4 (2') (c)（既存値の保護）の形を外れた 2 か所

**F-4 (2') (c) は「`WHERE <当該列> IS NULL` / 既定値で既存値を保護する」ことを求める**が、追補の次の 2 か所はガードを持たない。**いずれも「機械規則が付けた誤値の是正」であり、保護すべき人手値ではない**ためである。

| 箇所 | 形 | 理由 |
|---|---|---|
| `000066` 末尾の `startup_basis` 書き直し（8 文） | 無条件 `UPDATE` | **保護すると目的を達成できない。** 新規 DB では `000064` が入れ替わった相手の行に値を入れており、その誤値を上書きするのが本来の目的。既存 DB では同値の再書き込みで無害（冪等） |
| `000067` B の kimberly `elbow_drop` | `AND startup_basis = 'standalone'` で**既存値を指定して上書き** | 保護ではなく「機械付与値からの遷移」を明示する形。人手値（`through`）が既に入っていれば当たらない |

**⇒ 契約違反ではないが、F-4 (2') の文面どおりの形ではないため §2 に明記する。**

**★F-1 の新文言（D-199）の 3 条件**を以下に示す。

### 2-1 (a) 是正の一次源

| 対象 | 一次源 |
|---|---|
| ken 6 行 | `docs/progress/M19-04b-manual-input-list-thirdwave.md` §3 の 1 番目のブロック（CSV 7 行・逐語） |
| 第三波 11 行 | 同 §1 の記入欄（`F2:146` / `150` / `162` / `174` / `176` / `179` / `202` / `221` / `224` / `228` / `247`） |
| jamie 乱酔旋 4 行 | 同 §3 の 2 番目のブロック（CSV 4 行・逐語） |
| rashid `wall_jump` の `total` | 上記 `F2:247` ＋ **開発者裁定 2026-08-07**（§1-3） |

各 UPDATE の直前に「是正前 → 是正後 / 変更列」を provenance コメントとして残してある（`migrations/000065_correct_frame_values_phase2.up.sql`）。

**★一次源の値をそのまま採らずに解釈した箇所（①）**——`M19-04b-manual-input-list-thirdwave.md:240` rashid `buffed_tempest_moon` と `:246` rashid `tempest_moon` の記入値は **`throgh`（タイポ）** である。**推測: 備考「【強化】前方ステップから派生」「前方ステップから派生」および他 60 行で使われている綴りから、`through` の誤記と仮定した**（CLAUDE.md §9-2）。他に解釈の余地のある綴りは無く、`standalone` と読める余地も無い。

### 2-2 (c) 変更した列と行

**変更列は `startup` / `active` / `recovery` / `total`**（＋ m_bison `somersault_skull_diver` のみ `on_hit` / `on_block`）。**`recovery` と `on_block` は契約 F-1 の名指し列**であり、指示書 §0.2 (b) が解除している。

**★21 行を対象に突合し、実際に値が動いたのは 20 行**（`drink_level_4_ransui_haze_2_retreat` は一次源と現行が完全一致）。

| # | character | move_code | 是正前 su/act/rec/tot | 是正後 | 変更列 |
|---|---|---|---|---|---|
| 1 | ken | `kazekama_shin_kick_od` | 6/3/20/28 | 26/3/20/48 | startup, total |
| 2 | ken | `gorai_axe_kick_od` | 17/3/24/43 | 37/3/24/63 | startup, total |
| 3 | ken | `senka_snap_kick_od` | 10/6/18/33 | 28/6/18/51 | startup, total |
| 4 | ken | `kasai_thrust_kick` | 15/3/29/46 | 45/3/29/76 | startup, total |
| 5 | ken | `kasai_thrust_kick_during_od_gorai_axe_kick` | 11/3/29/42 | 54/3/29/85 | startup, total |
| 6 | ken | `kasai_thrust_kick_during_od_senka_snap_kick` | 15/3/37/54 | 54/3/37/93 | startup, total |
| 7 | jamie | `full_moon_kick_drink_and_reach_drink_lv4` | 15/9/53/76 | 15/9/58/81 | recovery, total |
| 8 | jamie | `phantom_sway_drink_and_reach_drink_lv4` | 12/3/56/70 | 12/3/61/75 | recovery, total |
| 9 | jamie | `drink_level_4_ransui_haze_3_immediate` | 14/5/28/46 | 38/5/28/70 | startup, total |
| 10 | jamie | `drink_level_4_ransui_haze_3_delay` | 4/25/27/55 | 53/25/27/104 | startup, total |
| 11 | jamie | `drink_level_4_ransui_haze_3_drink_while_retreating` | 16/2/115/132 | 15/3/115/132 | startup, active |
| 12 | jp | `departure_window_double_warp_od` | 48/20/19/86 | 49/20/19/87 | startup, total |
| 13 | luke | `impaler_od` | 25/8/19/51 | 24/8/19/50 | startup, total |
| 14 | luke | `no_chaser_od` | 24/10/16/49 | 23/10/16/48 | startup, total |
| 15 | luke | `snapback_combo` | 11/2/27/39 | 11/2/24/36 | recovery, total |
| 16 | m_bison | `somersault_skull_diver` | 12/10/11/32（on_hit NULL / on_block 7） | 12/10/12/33（on_hit 8 / on_block 5） | recovery, total, **on_hit**, **on_block** |
| 17 | marisa | `tonitrus` | 20/3/36/58 | 19/3/36/57 | startup, total |
| 18 | marisa | `tonitrus_od` | 20/3/36/58 | 19/3/36/57 | startup, total |
| 19 | rashid | `buffed_dash_forward` | 1/20/0/20 | 1/18/0/18 | active, total |
| 20 | rashid | `wall_jump` | 39/43/0/81 | 35/42/0/76 | startup, active, total |
| — | jamie | `drink_level_4_ransui_haze_2_retreat` | 16/3/75/93 | 同左 | **なし**（一致を実査で確認） |

**触っていないことを実査で確認した近縁の行**: ken `jinrai_kick_od`（13/3/25/40。一次源と完全一致）／ken ノーマル版 3 行（`kazekama_shin_kick` 6/4/19/28・`gorai_axe_kick` 18/3/20/40・`senka_snap_kick` 10/3/25/37）。**内部整合は是正後の全 21 行で成立。**

**`on_hit` / `on_block` / `damage` の差**: ken 6 行 ＋ `jinrai_kick_od` は一次源 CSV と現行が**完全一致で差は無い**（`command` / `notes` / `is_projectile` / `is_derived` も一致）。

### 2-3 (b) canary の全数差分の説明

測定は `TestCanary_PunishScanProjection` と同形の全数射影（31 キャラ総当たり × ガード 2 種）を、**版を固定して 3 点で採取**した。

| 測定点 | SHA256 | 判定 |
|---|---|---|
| v63（着手前 HEAD） | `c26f250f…4c07` | 基準 |
| **v64（①の直後）** | `c26f250f…4c07` | **★v63 と byte 一致。①は候補集合を 1 行も動かしていない** |
| v65（②の直後） | `815d09ee…b21f7` | 差分あり（下記で全数説明） |

**★①の直後で動いていない**——①は新列と `move_derivations` しか触らず、`punishfinder` は新列を 1 つも読まないため（読む本番コードは存在しない）。

**★採取手順（再現用）**——v63 / v64 は**②の CSV 是正と golden 再生成より前のツリー**（コミット `f16fb3e` 時点）で測る必要がある。golden を再生成すると新規 DB は `000026` / `000055` の時点で是正後の値を持つため、以後のツリーではどの版で測っても②の効果が含まれてしまう。手順は (1) 対象コミットのツリーを用意し (2) `TestCanary_PunishScanProjection` と同形の射影を `m.Migrate(<版>)` で版固定して採取し (3) SHA256 と差分を突合する、の 3 段である。**M19-05 で契約 F-1 を解除して `punishfinder` に触るときに、版固定の測定手段を常設にすると以後のサブが楽になる**（§4-5）。

**v64 → v65 の差分の全数**:

| 区分 | 件数 |
|---|---:|
| **相手技ノードの出現** | **0** |
| **相手技ノードの消失** | **0** |
| 手動確認レーン（MR）の変化 | **0** |
| 有利フレームが変化した節点 | 68 |
| 始動技リストが変化した節点 | 3464 |
| **★説明できない差分** | **0** |

**(a) 有利フレームの変化 68 節点 = 4 種 × 17 (self, guard)**。いずれも②で `recovery` を変えた行そのもの。

| 相手技 | adv |
|---|---|
| jamie `full_moon_kick_drink_and_reach_drink_lv4` | 53 → 58（recovery 53→58） |
| jamie `phantom_sway_drink_and_reach_drink_lv4` | 56 → 61（recovery 56→61） |
| luke `snapback_combo` | 27 → 24（recovery 27→24） |
| m_bison `somersault_skull_diver` | 11 → 12（recovery 11→12） |

**(b) 始動技リストの変化 3464 節点**（＝ (a) の 68 節点を除いた集合）。出入りした始動技は**すべて②で是正した 20 行のいずれか**である。

> **★(a) の 68 節点では、上記 20 行以外の始動技も入れ替わる。** 相手技の有利フレームが動く（27→24 / 53→58 / 56→61 / 11→12）と `startup ≦ adv` の閾値が移動するため、閾値近傍にいた無関係な始動技（`drive_impact` 26F・`throw_forward` / `throw_back`・`crouching_medium_kick` 等）が二次効果で出入りする。**これは (a) の 4 行の `recovery` 変更で完全に説明できる**が、再測定した人が「未説明の差分がある」と読まないよう明示しておく。**上の「すべて 20 行のいずれか」は (b) の 3464 節点についての主張である。**

**★締める方向（候補から外れた）— `startup` が遅くなった行**

| 始動技 | 節点 | startup |
|---|---:|---|
| jamie `drink_level_4_ransui_haze_3_delay` | 1626 | 4 → 53 |
| ken `kazekama_shin_kick_od` | 1418 | 6 → 26 |
| ken `kasai_thrust_kick_during_od_gorai_axe_kick` | 1310 | 11 → 54 |
| ken `senka_snap_kick_od` | 1214 | 10 → 28 |
| ken `kasai_thrust_kick_during_od_senka_snap_kick` | 1141 | 15 → 54 |
| jamie `drink_level_4_ransui_haze_3_immediate` | 1127 | 14 → 38 |
| ken `kasai_thrust_kick` | 1126 | 15 → 45 |
| ken `gorai_axe_kick_od` | 985 | 17 → 37 |

**★緩める方向（候補に入った）— `startup` が 1F 速くなった行**

| 始動技 | 節点 | startup |
|---|---:|---|
| luke `no_chaser_od` | 109 | 24 → 23 |
| luke `impaler_od` | 94 | 25 → 24 |
| marisa `tonitrus` | 88 | 20 → 19 |
| marisa `tonitrus_od` | 88 | 19 と同値へ（20 → 19） |
| jamie `drink_level_4_ransui_haze_3_drink_while_retreating` | 58 | 16 → 15 |

**★緩める方向の変化が「実機で入力不可能なレシピを出さない」に反しないか**——反しない。5 行はいずれも**開発者の再計測で `startup` が 1F 速いことが判明した行**であり、実機で 1F 速く出せる以上、その分だけ確定反撃の候補に入るのが正しい。近似値・捏造値は 1 つも入れていない（すべて一次源の実測値）。締める方向の 8 行は、単独値を通し値へ付け替えた結果（ken）と、再計測で `startup` が遅いと判明した結果（jamie）であり、**実機で入力できないレシピが候補から落ちた**方向である。

### 2-4 追補（`000066` / `000067`）の canary

**マイグレの直後では 1 行も動かない。** 現ツリーで版を固定して測った射影は **v65 = v66 = v67 で完全一致**（`000066` の改名は新規 DB では golden 段で既に入っており 0 行に当たる。`000067` が触る `fastest_unreachable` / `startup_basis` / `move_derivations` は `punishfinder` が読まない）。

**ただし改名そのものは golden（`000055` / `000056`）の段で入るため、改名前のツリーと比べると射影は変わる。** その差分を検証した結果:

| 検証 | 結果 |
|---|---|
| 改名前ツリー v65 の射影の `move_code` を**機械的に新 code へ変換**し、現ツリー v65 と突合 | **29655 行が完全一致** |

**⇒ 改名は候補集合の物理的な内容を変えていない。ラベルの入れ替えだけである。** 変換せずに素朴に diff すると大きな差分に見えるが（**測り方＝改名前ツリーの v65 射影と現ツリーの v67 射影を、`(self, opp, guard, 相手技 code)` をキーに結合して比較。有利フレームが変化した節点 244・始動技が入れ替わった節点 1451**。レビューの独立再測定では位置揃え比較で 258 / 1207 と出ており、**キー結合か位置揃えかで数え方が変わる**——数字を引用するときは測り方を添えること）、**これは「13F の単発」と「53F のフル」が code を交換したことによる見かけ上の差**であり、閾値移動に伴う二次効果（§2-3 の (a) と同型）がそこに乗っているだけである。

**★既存 DB（開発者の手元・配布済み）では、`000066` の適用時に実際に code が入れ替わる。** 画面上の技コード表示が入れ替わるのが正しい挙動である（`name_ja` は不変）。

**★測り方の注意（自戒）**——本レポート初稿は改名前に採った `canary-v65` を基準に v67 と比較し、上記の見かけ上の差分を「説明できない差分」と読みかけた。**三点更新を挟むと基準ファイルが陳腐化する。基準は必ず現ツリーで取り直す**（§4-5 の申し送りと同根）。

**期待値は書き換えていない。** `internal/service/punishfinder/service_test.go:387-391` の `wantLegacyJumpHeavy = 37` / `wantOptionC = 39` / `wantUniqueAerial = 16` は無改変で green（`internal/service/` の diff は 0）。この 3 値は `is_aerial` / `code` / `category` から決まり、②が触った 6 列を読まないため動かない。

---

## §3 製造判断

### 3-0 開発者へ確認して確定した点（着手前に報告し、裁定を得た）

**指示書 §3 の 10 項目を Plan Mode で報告した際、4 件が指示書の想定と食い違ったため、実装に入らず裁定を仰いだ**（`PARENT-E21`＝実行できても目的を達成できないなら、実行せずに報告する）。

| # | 論点 | 製造の推奨案 | **開発者裁定（2026-08-07）** |
|---|---|---|---|
| 1 | §1.5「その他」の親参照の範囲が未指定（「〜から派生」の言及が 11 キャラ 56 件・第三波 43 件） | 親が `move_code` に一意解決できる断定形のみ | **推奨案どおり**（63 対）。詳細は §1-1 |
| 2 | rashid `wall_jump` の是正で内部整合が破れる（34+42−1+0 = 75 ≠ 現行 81） | ②から外して保留 | **`35 / 42 / 0 / 76` を確定値とする**（＝推奨案を採らず、②に含めた）。詳細は §1-3 |
| 3 | §1.4 の lily `condor_dive` に「一律」表記が無く対応行が 6 つ | ダイブ本体 4 行 | **推奨案どおり**（`condor_dive` / `_od` / `windclad_` / `windclad_od_`）。詳細は §1-2 |
| 4 | 記入欄に混ざったスコープ外の指示（約 40 行の `through` 主張ほか）の扱い | 投入せず全数報告 | **推奨案どおり**。詳細は §3-2 |

### 3-1 推測で進めた点（1 件のみ）

**一次源の値をそのまま採らずに解釈したのは 1 箇所だけである**（§2-1 に再掲）——`M19-04b-manual-input-list-thirdwave.md:240` rashid `buffed_tempest_moon` と `:246` rashid `tempest_moon` の記入値 **`throgh`**。**推測: 備考「前方ステップから派生」および他 60 行の綴りから `through` の誤記と仮定した**（CLAUDE.md §9-2）。`standalone` と読める余地は無い。

**これ以外に推測で埋めた箇所は無い。** 親が一意に定まらなかった関連（§3-2 の 4〜6）は、推測せず投入を見送って報告に回した。

### 3-2 記入欄に埋め込まれていたスコープ外の指示（**投入していない**）

| # | 内容 | 実査結果 |
|---|---|---|
| **1** | **§1.4 の 13 系統が主張する `startup_basis = 'through'` 約 40 行** | 実体は**すべて `is_derived = 0`** で、000050 / 000062 が既に `standalone` を機械付与している。**308 行の母数に含まれない**ため本サブでは触っていない。対象＝jamie 無影蹴 4 ／ rashid アラビアン・スカイハイ 4 ／ luke Aerial Flash Knuckle 3 ／ ingrid Solar Burst 14 ／ juri Shiku-sen 2 ／ ken 空中竜巻 2 ／ kimberly Nue Twister 2・Aerial Bushin 2・Elbow Drop 1 ／ ryu 空中竜巻 2 ／ lily condor_dive 2・SA2 1 |
| ~~**2**~~ | ~~kimberly `elbow_drop` の `startup_basis`~~ | **【2026-08-07 解消】開発者裁定により `000067` で `through` へ是正済み**（§1-5）。D-225 の「`through` として登録されていない疑い」は**事実だった** |
| ~~**3**~~ | ~~m_bison `devil_reverse` / `devil_reverse_od` / `head_press` / `head_press_od` の `fastest_unreachable = true`~~ | **【2026-08-07 解消】開発者裁定により `000067` で投入済み。** ★非 OD 2 行は `startup_basis = 'through'` のため D-227 の除外述語に掛からず、**`fastest_unreachable` が唯一のガード**になる |
| ~~**4**~~ | ~~jamie `freeflow_strikes` 系 16 行の親参照~~ | **【2026-08-07 解消】反転は開発者の入力ミスだった**（§1-4）。`000066` で `move_code` を是正し、`000067` で 16 対を投入済み。**推測せず報告に回した判断が、データの誤りそのものを掘り当てた形になった** |
| **5** | **lily `condor_dive_follow_up` / `windclad_od_condor_dive_follow_up` の親参照** | 記入欄は「風纏版のノーマル、またはODコンドルダイブからの派生」。「風纏版のノーマル」が `windclad_condor_dive` か `condor_dive` か、「ODコンドルダイブ」が `condor_dive_od` か `windclad_od_condor_dive` かが定まらない |
| **6** | **rashid `nail_assault` / `rolling_assault` / `wing_stroke` の親** | 記入欄の「アサルト・ロール」に対応する `move_code` が **`rashid.csv` に存在しない** |
| **7** | **luke `fatal_shot` のフレーム是正** | 記入欄に「直した版のフレームは startup 33, active 16 recovery 27 total 75」とあるが、**指示書 §1.6 (b) の 15 行に含まれていない**ため②の対象外とした（親参照だけ付けた） |

### 3-3 設計卓へ上げる（指示書 §6.3）

| # | 内容 | 状態 |
|---|---|---|
| 1 | m_bison `somersault_skull_diver` の**備考の書き込み先** | 未決。`condition_ja` は SQL 非投入で書き込む場所が無い（D-152）。**本サブでは書いていない**。値（`on_hit` 8 / `on_block` 5）は投入済み |
| 2 | ken 6 行の `on_hit` / `on_block` / `damage` の差 | **差なし**（実査で確認） |
| 3 | §1.4 の 13 系統で名指しに対応する `move_code` が見つからなかったもの | **なし**。ただし **ryu の「弱中強」に対応する行が存在しない**——ryu の空中竜巻は `aerial_tatsumaki_senpu_kyaku` と `_od` の 2 行のみ。非 OD 1 行を `false`、OD 1 行を `true` と読んだ |
| 4 | `total` の内部整合が是正後に成立しなかった行 | **rashid `wall_jump`**（指示書の値では 75 ≠ 81）。開発者裁定で 35/42/0/76 に確定（§1-3） |
| 5 | canary が緩む方向に動いた場合 | **5 行で緩んだ**。§2-3 で個別に説明済み |

### 3-4 ★`M19-DESIGN-07` の記述が実データと食い違っている（設計書間の矛盾・CLAUDE.md §8）

`M19-DESIGN-07` §4-3 は **「11 キャラ分は人手判断が完了し、`true` は 1 行のみと確定した」「★候補数と投入数を数え分けること——11 キャラ分の `fastest_unreachable` の UPDATE は 1 行であり、件数固定テストは『1 行ちょうど』で書く」** と述べている。

**実データは 4 行である。** 一次源 `docs/progress/20260802-M19-04-manual-input-list-developer-decision.md` §2 の 7 行は、**D-207 の振り替え後**に `true` **4 行**（kimberly `elbow_drop` ／ lily `great_spin` ／ zangief `flying_body_press` ／ `flying_headbutt`）・`非攻撃技` 3 行（kimberly `step_up_*`）である。指示書 §1.2 B は「11 キャラ 4 行」と正しい値へ更新済みだが、**`M19-DESIGN-07` 側が追随していない。**

**本サブは一次源に従って 4 行を投入した**（実装が正しく、設計正本が失効している）。**M19-05 は `M19-DESIGN-07` を正本として読むため、放置すると「1 行ちょうど」の期待値が書かれて落ちる。** 同§の「候補 16 行（11 キャラ 7 ＋ 第三波 9）」は正しい。

**★失効の原因は資料の落ち度ではない。** DESIGN-07 v1.3.0 は 2026-08-04 時点で、そのとき「1 行」は正しい実測だった。その後 **D-207（2026-08-07）**が (a) `非攻撃技` を第 3 の記入値として新設し、(b) lily `great_spin` と zangief 2 行を `false` → `true` へ是正した（記入欄に「**旧記入: false、ただしこれは通常のジャンプ攻撃的に扱うべき。D-207 により是正**」と注記が残っている）。指示書 §1.2 B は追随済み、DESIGN-07 が未追随、という形。

**差し替えの文案**（設計卓が判断しやすいよう、実測値で書いた案を置いておく。採否は設計卓）:

> B 型: **候補 16 行**（seed 済み 11 キャラ **7 行**〔kimberly 4／lily 1／zangief 2〕 ＋ 第三波 6 キャラ **9 行**）。**【2026-08-07 更新・D-207】人手判断の結果は 11 キャラが `true` 4 行 ／ `非攻撃技` 3 行、第三波が `true` 4 行 ／ `非攻撃技` 5 行**（旧記載「`true` は 1 行のみ」は D-207 の振り替え前の値）。**★`非攻撃技` は `false` と DB 状態は同じだが意味が違う**（D-207／D-138）。**★あわせて B 型の抽出条件そのものが不完全である**——空中から出す必殺技が `is_aerial = 0` で入っており B 型にも C 型にも入らないため、**開発者が名指しした 13 系統が一次源**であり網羅の保証は無い（D-225）。Phase 2 の実投入は **39 行**（B 型一覧 8 ＋ 13 系統 27 ＋ 追補 `000067` の m_bison 4）で、`fastest_unreachable = 1` の総数は **148**。**件数固定テストは実測値で書く**（0 件でも成功する形にしない、という趣旨は維持）。

---

## §4 残課題・申し送り

| # | 内容 |
|---|---|
| 1 | **★既知の限界（D-225）**——B 型の対象は**機械判別できない**。`is_aerial` の実セマンティクスが「ラッシュ版を作るか否か」であるため（D-222）、空中から出す必殺技が `is_aerial = 0` で入っており B 型にも C 型にも入らない。**開発者の名指しリスト（13 系統）が一次源であり、網羅の保証は無い。** |
| 2 | **Phase 2 の後に残る `unknown` は 186 行**（M19-05 の入力）——c_viper / dhalsim 18（000050 が明示除外）＋ 移動 system move 153（D-187）＋ 人手で投入しなかった 15。15 の内訳は完了報告 §9 を参照。**追補（`000066`／`000067`）でも 186 のまま**（`elbow_drop` は `standalone` → `through` で `unknown` を経由しない） |
| **10** | **★kimberly `elbow_drop` の「前提技はジャンプ」の記録先が無い**（§1-5）——`through` であることは `startup_basis` に入ったが、**「何からの通し値か」はどこにも記録されていない**。`move_derivations` の親を移動 system move（`jump_forward` 等）にしてよいかは未裁定であり（§1-1 の不採用類型 b）、**ken / kimberly の「Quick Dash・Sprint から最速で」系も同じ形で宙に浮いている**。M19-05 の費用規則 #1（表記用親の cost 0）が効くかどうかに関わるため、**移動 move を親に取れるかの裁定**が要る |
| **12** | **★`check-criteria.md` に追加した観点を既存データへ初回適用した結果、同型の不一致が 6 行残っている**（レビュー §(1) の独立走査。**本追補では是正していない**）——(1) jamie `intoxicated_assault_1hit` ＝ `[酔いレベル3]酩酊襲(2発止め)`（**今回是正したものと同型の直撃**。code は `_1hit` だが名前は「2発止め」、`total` 44 は対の `drink_level_3_intoxicated_assault` の 60 に対し実体が 2 発止めであることを示す。あわせて `drink_level_3_` 接頭辞も欠けている）／(2)(3) jamie `phantom_sway_2hits`・`full_moon_kick_2hits`（`_2hits` が hit 数ではなく「非飲酒版」を指している）／(4) lily `rush_desert_storm_1hits`（非ラッシュ版だけ名前に `(単発)` がある）／(5)(6) marisa `novacula`・`rush_novacula`（名前に `(単発)` があるが code に `_1hit` が無い。フル版が存在しないため実害は薄い）。**★(1) は「反転」ではなく「片側だけ誤り」なので今回の swap 型の是正では拾えない。放置すると `move_derivations` の親決定で同じ罠を踏む。** `_1hit` か `_2hits` かの裁定をお願いしたい |
| **13** | **★「`_1hit_` ＝ 基底」は jamie の裁定であって全キャラ規約ではない**——marisa は `tonitrus_1hit`（単発）が `through` ＋親参照あり、`tonitrus`（無印）が `standalone` で、**jamie とは逆の関係**になっている。`DES-004` へ明文化する際は「系統内で一貫させる」に留め、**接尾辞の意味を全キャラで固定しない**こと |
| ~~**11**~~ | **【2026-08-07 解消】★同型の行の扱いが確定した**——開発者裁定「**`elbow_drop` のみが例外**。空中から出せる jamie の無影蹴のような性質を持つ珍しい `unique` 技。**他の候補は通常のジャンプ攻撃と同じ性質**」。したがって残り 7 行（lily `great_spin` ／ marisa `caelum_arc`・`caelum_arc_holding` ／ rashid `aerial_shot`・`blitz_strike` ／ zangief `flying_body_press`・`flying_headbutt`）は **`startup_basis = 'standalone'` ／ `fastest_unreachable = 1` のままが正しい**（`migrate_m19p2b_test.go` の `m19p2bAerialUntouched` で対固定）。旧文（参考）: **★同型の行が他にもある可能性**——`is_aerial = 1` かつ `code` に `jumping_` を含まない 16 行のうち、`is_derived = 0` の **8 行**が機械規則で `standalone` を付与されており、**その 8 行は `fastest_unreachable = 1` を投入した 8 行と完全に一致する**（kimberly `elbow_drop` ／ lily `great_spin` ／ marisa `caelum_arc`・`caelum_arc_holding` ／ rashid `aerial_shot`・`blitz_strike` ／ zangief `flying_body_press`・`flying_headbutt`）。**`elbow_drop` だけを `through` にしたのは開発者が個別に判断したため**で、残り 7 行は `standalone` のまま。ただし 7 行は `startup` 8〜10F と「空中にいる状態からの発生」として自然な値であり、`elbow_drop` の 27F だけが突出している。**7 行をどう扱うかは設計卓の判断**（D-222 と同根） |
| 3 | **★守ったガードの所在（D-189）**——`internal/infra/migration/migrate_m1904_test.go:33` の `m1904PrefixMissed = 2`（`TestRun_M1904_MechanicalBackfill`）／`migrate_m1801_test.go:76` の `is_projectile = 104`（`TestRun_M1801_IsProjectileBackfill`・**v39 の値**）／`migrate_m1904c_test.go:37` の `m1904cProjectileTotal = 135`（v63）。本サブは `migrate_m19p2_test.go` の `m19p2ProjectileTotal = 135` を **v63〜v65 の値として別に持ち、104 を転用していない** |
| 4 | **followup**: `parent-dependent-frame-variance`（D-226）／`fastest-unreachable-c-type-naming-gap`（D-225）は本サブでは起票していない（設計卓の管理下） |
| 5 | **★案 C の canary 39 をマイグレ側から測れない**——`buildStarters` が非公開で `internal/infra/migration` から呼べず、`internal/service/` に diff 0 が要求されるため測定コードを置けない。本サブは全数射影の突合で代替した。M19-05 で F-1 を解除して `punishfinder` に触るとき、版固定の測定手段を用意すると以後のサブが楽になる |
| **6** | **★CHANGE を新規起票していない**——指示書メタ表は「★起票する（D-227＝`DES-003` §3.3 の述語の改訂）」とするが、`docs/handover/change-number-registry.md` v1.100.0 が **2026-08-07 に CHANGE-093 を D-227 に対して払い出し済み**（内容も「`startup_basis IN ('standalone','unknown')` へ拡張」で一致）。二重起票を避けた。**ただし通知書の実体が未作成**である——`docs/change-notes/` の慣行は通知書が `CHANGE-0NN-notification.md`・反映レポートが `change-report-0NN.md` の 2 本立て（091 / 090 が実例）で、**092・093 はどちらも存在しない**。設計卓で `CHANGE-092-notification.md` / `CHANGE-093-notification.md` の作成をお願いしたい |
| 9 | **CSV 正本と DB の乖離**（将来の整理事項・本サブの範囲外）——DB は `standalone` **1125** / `through` **342**（追補後。v65 時点は 1126 / 341）だが、CSV は人手付与分の 225 / 68 しか持たない（機械付与分は CSV に書かない運用＝指示書 §2.2）。また guile `sonic_cross_2_meter_od` は `000063` が DB 側で `through` を確定させたが CSV は空欄のまま。**★追補で乖離が 5 セル増えた**——kimberly `elbow_drop` の `startup_basis`（DB `through` / CSV 空欄）と m_bison 4 行の `fastest_unreachable`（DB 1 / CSV 空欄）。**`seedgen` はこの 2 列を SQL へ出力しないため、CSV を直しても golden は動かない**（直すこと自体は安全）。**`M19-DESIGN-07` §10-1 が「CSV が正本」と述べている以上、いずれ整合の方針が要る** |
| **7** | **`docs/process/m18-m19-contract.md` §2 F-1 が D-199 の新文言に未追随**——契約側は旧文言（「意味・値・使われ方を変えない」）のまま。本サブは裁定 D-199 を正として扱った。あわせて同 §4 の「CHANGE 次番号 092」も失効（registry は 094） |
| 8 | **指示書とチェックリストの整合**——チェックリスト `M19-PHASE2-review-checklist-v1.0.0.md` のメタ表が対の指示書を `M19-PHASE2-frame-cost-manual-input.md` と書いているが、実体は `M19-PHASE2-instruction-v1.0.0.md` |
| 9 | **指示書 §4-13 の「golden 7 stem」は古い数字**——実測 **10 stem**（000026 / 000030 / 000034 / 000035 / 000045 / 000046 / 000047 / 000055 / 000056 / 000057）。M14-03e で 3 本増えている |

## §5 参考（触れていない＝不変の証跡）

```
go test ./...                                → 全パッケージ green
go run ./cmd/seedgen -check                  → OK: 生成物は既存ファイルと一致
go vet ./... / gofmt -l internal/ cmd/       → 出力なし
git diff --stat internal/service/ internal/seedgen/  → 空（契約 F-1 / F-3 / F-6）
```

CSV 17 本は RFC4180 パーサで HEAD と突合し、**既存 20 列の差分が②の 20 行 43 セルちょうど**（変更列は `startup` / `active` / `recovery` / `total` / `on_hit` / `on_block` の 6 列のみ）、**ヘッダ・列順・行数が不変**、**空欄が `false` で埋まっていない**ことを機械検証した。新列は `startup_basis` 293 行・`fastest_unreachable` 35 行のみに書き、`chain_cancel_total` は設計どおり空欄のまま（`DES-003` §3.3「CSV には転記しない」）。

---

---

## §6 CHANGE 起票のたたき台（設計担当向けチェックリスト）

**本サブは CHANGE を新規起票していない。** 指示書メタ表は「★起票する（D-227＝`DES-003` §3.3 の述語の改訂）」とするが、`docs/handover/change-number-registry.md` v1.100.0 が **2026-08-07 に CHANGE-093 を D-227 に対して払い出し済み**であり（内容も「`startup_basis IN ('standalone','unknown')` へ拡張」で一致）、二重起票になるため。

- [ ] **CHANGE-093 の通知書本体の作成**——`docs/change-notes/` の慣行は通知書 `CHANGE-0NN-notification.md`・反映レポート `change-report-0NN.md` の 2 本立て（090 / 091 が実例）。**092・093 はどちらも存在しない。**
- [ ] **CHANGE-092（ヤスミン追加に伴うキャラ数 30 → 31）も同様に未作成。**
- [ ] **`M19-DESIGN-07` §4-3 / §9-5 の是正**（§3-4）。**マイグレ非消費**。実装は既に正しく、資料側だけが失効している。
- [ ] **`docs/process/m18-m19-contract.md` §2 F-1 を D-199 の新文言へ追随**、同 §4 の CHANGE 次番号を 092 → 094 へ（§4-7）。**マイグレ非消費。**
- [ ] **`DES-003` §3.3 の `fastest_unreachable` 欄**——「11 キャラ分の `true` は 1 行のみと確定した」の記述が同じ失効を抱えていないか確認（本サブでは未確認＝要確認）。

**消費したマイグレ連番は `000064` / `000065`（本体）／ `000066` / `000067` / `000068`（追補）の 5 本で、着手時に `ls migrations/` を実査して払い出した**（予約帯は作らない運用）。**次に払い出すべき連番は `000069`。** **CHANGE 番号は起票時に `change-number-registry` で採番すること**（次の空きは **094**）。

---

## §7 教訓（retrospective 行き）

> **★親チャット（設計卓）は本節を読まなくてよい。** 宛先は反映係で、`retrospective-log` へバッチ反映される。外出先では §1〜§3 だけコピペすれば足りる。

1. **「一次源が自然言語の自由記入欄」であるとき、パーサは値そのものより先に『値以外の書かれ方』を調べる。** 本サブの記入欄は 309 行のうち、タイポ（`throgh` 2 件）・全角スペース混入・セル先頭の空白ゆれ・「`through` が入っているが誤りなので `standalone` に変更したい」という**先頭トークンが意味と逆になる行** 2 件・列ずれ 1 件を含んでいた。**先頭トークンだけを見る素朴なパーサは、最後の 2 件を静かに逆に読む。** 記入欄を機械処理する前に「値の種類を全列挙して件数を出す」工程を必ず挟むと、想定外の書かれ方が件数の異常として先に見える。

2. **「N 行を対象とする」と「N 行が変わる」は別の数である。** 指示書の「②は 21 行」を変更行数と読むと、一次源と現行が一致していた 1 行に気づかず「20 行しか変わっていない＝実装漏れ」と誤判定する。**対象行数と変化行数を最初に分けて数え、一致した行も「一致を実査で確認した」として表に残す**と、以後のレビューが判定に迷わない。

3. **三点更新（CSV 正本 → golden 再生成 → 追随マイグレ）を採ると、その追随マイグレは新規 DB では 0 行に当たる。** 件数で固定するテストは常に成功してしまい何も守らない。**最終状態と down → re-up の往復で固定する**のが唯一の手段である（`000063` が同じ教訓を残していた）。あわせて、**canary を「①の直後」で測るには golden 再生成より前のツリーで測る必要がある**——後から測ると、どの版で測っても②の効果が seed 段に入っている。**時系列に依存する測定は、測る順序そのものを手順として資料に残す。**

4. **「全数差分を説明した」と書くときは、説明の射程を明示する。** 本サブは差分を (a) 有利フレームが動いた節点 (b) 始動技が出入りした節点 (c) 説明できない差分 の 3 分類で数え、(c) = 0 を示した。ところが「出入りした始動技はすべて是正した 20 行のいずれか」という文は (b) についてのみ真で、(a) では閾値移動による二次効果で無関係な技が入れ替わる。**分類して数えた時点で説明は成立しているが、文章が分類の境界をまたぐと再測定者が「未説明の差分がある」と読む。** レビューで実際にそう読まれた。**分類ごとに主張を閉じる。**

5. **設計正本が「N 行」と書いている数は、後続の裁定で動きうる。** `M19-DESIGN-07` §4-3 の「11 キャラの `true` は 1 行のみ」は D-207 の振り替えで 4 行になっていたが、資料が追随していなかった。**指示書は正しい値へ更新されていたのに設計正本が古い**という形は、指示書だけを見て実装すると気づけない。**件数を断定している設計正本は、実装時に一次源と突き合わせて食い違いを報告する**工程を入れると拾える（本サブはレビューで拾われた）。

6. **親が一意に定まらないデータ関連は、埋めずに止まるほうが安い。** jamie `freeflow_strikes` 系は、非飲酒版と飲酒版で「単発」を指す `move_code` の付き方が反転しており親を決められなかった。**`INSERT ... SELECT` 型の関連投入は、親を取り違えてもエラーにならず 0 行でも成功する。** 誤った 16 対が入ると、次に触る人は「入っているのだから正しい」と読む。**推測で埋めるコストは、後で剥がすコストとして必ず戻ってくる。**

---

## 付録 A 全数リスト（指示書 §6.2。完了報告 §2〜§4 と同一）

### A-1 `startup_basis` の投入内訳（キャラ別・§6.2-1）

| character | standalone | through | 投入計 | 投入しない | 内訳 |
|---|---:|---:|---:|---:|---|
| guile | 19 | 0 | 19 | 2 | Phase2 対象外×1, 記入値=unknown×1 |
| ingrid | 3 | 0 | 3 | 1 | D-187×1 |
| jamie | 38 | 20 | 58 | 1 | 記入値=空欄×1 |
| jp | 8 | 0 | 8 | 0 | — |
| juri | 9 | 0 | 9 | 0 | — |
| ken | 3 | 12 | 15 | 3 | D-223/§1.6×3 |
| kimberly | 17 | 8 | 25 | 0 | — |
| lily | 13 | 3 | 16 | 1 | D-187×1 |
| luke | 12 | 5 | 17 | 0 | — |
| m_bison | 13 | 2 | 15 | 4 | D-187×1, D-226×2, 記入値=unknown×1 |
| mai | 29 | 3 | 32 | 0 | — |
| manon | 8 | 4 | 12 | 0 | — |
| marisa | 14 | 6 | 20 | 3 | D-187×3 |
| rashid | 17 | 5 | 22 | 1 | D-187×1 |
| ryu | 11 | 0 | 11 | 0 | — |
| terry | 9 | 0 | 9 | 0 | — |
| zangief | 2 | 0 | 2 | 0 | — |
| **計** | **225** | **68** | **293** | **16** | |

**記入値の 6 分類**（★`unknown` / `保留` / `非攻撃技` / 空欄 を同一視しない＝D-138 / D-207）——`standalone` 238 ／ `through` 62（うち一次源の綴りが `throgh` の 2 行を含む） ／ `unknown` 5 ／ `保留` 1 ／ 空欄 1 ／ 「要相談」2（m_bison の D-226 対象 2 行）＝ 309。`非攻撃技` は `startup_basis` の記入欄には 1 件も出現しない（B 型の記入欄にのみ 8 件）。
投入 293 ＝ `standalone` 238 ＋ `through` 62 − 裁定による除外 7（ken ノーマル版 3 ＋ `startup IS NULL` の 4）。

### A-2 `fastest_unreachable = 1` の全数リスト（§6.2-2・35 行）

| # | character | move_code | name_ja | 出所 |
|---:|---|---|---|---|
| 1 | ingrid | `solar_burst_lv1_forward` | ソーラーフレア(Lv1)（前方） | §1.4 名指し |
| 2 | ingrid | `solar_burst_lv1_forward_od` | ODソーラーフレア(Lv1)（前方） | §1.4 名指し |
| 3 | ingrid | `solar_burst_lv1_neutral` | ソーラーフレア(Lv1)（垂直） | §1.4 名指し |
| 4 | ingrid | `solar_burst_lv1_neutral_od` | ODソーラーフレア(Lv1)（垂直） | §1.4 名指し |
| 5 | ingrid | `solar_burst_lv2_forward` | ソーラーフレア(Lv2)（前方） | §1.4 名指し |
| 6 | ingrid | `solar_burst_lv2_forward_od` | ODソーラーフレア(Lv2)（前方） | §1.4 名指し |
| 7 | ingrid | `solar_burst_lv2_neutral` | ソーラーフレア(Lv2)（垂直） | §1.4 名指し |
| 8 | ingrid | `solar_burst_lv2_neutral_od` | ODソーラーフレア(Lv2)（垂直） | §1.4 名指し |
| 9 | ingrid | `solar_burst_lv3_forward` | ソーラーフレア(Lv3)（前方） | §1.4 名指し |
| 10 | ingrid | `solar_burst_lv3_forward_od` | ODソーラーフレア(Lv3)（前方） | §1.4 名指し |
| 11 | ingrid | `solar_burst_lv3_neutral` | ソーラーフレア(Lv3)（垂直） | §1.4 名指し |
| 12 | ingrid | `solar_burst_lv3_neutral_od` | ODソーラーフレア(Lv3)（垂直） | §1.4 名指し |
| 13 | jamie | `luminous_dive_kick_heavy` | 強無影蹴 | §1.4 名指し |
| 14 | jamie | `luminous_dive_kick_light` | 弱無影蹴 | §1.4 名指し |
| 15 | jamie | `luminous_dive_kick_medium` | 中無影蹴 | §1.4 名指し |
| 16 | jamie | `luminous_dive_kick_od` | OD無影蹴 | §1.4 名指し |
| 17 | juri | `shiku_sen` | 疾空閃 | §1.4 名指し |
| 18 | juri | `shiku_sen_od` | OD疾空閃 | §1.4 名指し |
| 19 | kimberly | `aerial_bushin_senpukyaku` | 空中武神旋風脚 | §1.4 名指し |
| 20 | kimberly | `aerial_bushin_senpukyaku_od` | OD空中武神旋風脚 | §1.4 名指し |
| 21 | kimberly | `elbow_drop` | 肘落とし | B型一覧 |
| 22 | lily | `condor_dive` | コンドルダイブ | §1.4 名指し |
| 23 | lily | `condor_dive_od` | ODコンドルダイブ | §1.4 名指し |
| 24 | lily | `great_spin` | グレートスピン | B型一覧 |
| 25 | lily | `sa2_soaring_thunderbird` | SA2 スカイサンダーバード | §1.4 名指し |
| 26 | lily | `windclad_condor_dive` | [風纏い]コンドルダイブ | §1.4 名指し |
| 27 | lily | `windclad_od_condor_dive` | [風纏い]ODコンドルダイブ | §1.4 名指し |
| 28 | lily | `windclad_sa2_soaring_thunderbird` | SA2 [風纏い]スカイサンダーバード | §1.4 名指し |
| 29 | marisa | `caelum_arc` | カエルムアーク | B型一覧 |
| 30 | marisa | `caelum_arc_holding` | 【ホールド】カエルムアーク | B型一覧 |
| 31 | rashid | `aerial_shot` | エリアルシュート | B型一覧 |
| 32 | rashid | `blitz_strike` | ブリッツストライク | B型一覧 |
| 33 | ryu | `aerial_tatsumaki_senpu_kyaku_od` | OD空中竜巻旋風脚 | §1.4 名指し |
| 34 | zangief | `flying_body_press` | フライングボディプレス | B型一覧 |
| 35 | zangief | `flying_headbutt` | フライングヘッドバット | B型一覧 |

**投入しなかった `非攻撃技` 8 行**（★`false` と DB 状態は同じだが意味が違う＝D-207）: kimberly `step_up_backward` / `step_up_forward` / `step_up_neutral` ／ rashid `buffed_jump_back` / `buffed_jump_forward` / `buffed_jump_neutral` / `front_flip` / `wall_jump`。
**§1.4 の 13 系統で `false` 判定だった 14 行**: rashid `arabian_skyhigh_{light,medium,heavy,od}` ／ luke `aerial_flash_knuckle` / `_od` / `_holding` ／ ingrid `solar_burst_light_neutral` / `_forward` ／ ken `aerial_tatsumaki_senpu_kyaku` / `_od` ／ kimberly `nue_twister` / `_od` ／ ryu `aerial_tatsumaki_senpu_kyaku`。

### A-3 `move_derivations` の追加分の全数（§6.2-4・63 対 / 子 37 行）

| # | character | 子 `move_code` | 親 `move_code` | 一次源の文言 |
|---:|---|---|---|---|
| 1 | guile | `perfect_timing_sonic_cross_od` | `sonic_blade_light` | 同上（記入用コピー上は sonic_cross_2_meter_od） |
| 2 | guile | `perfect_timing_sonic_cross_od` | `sonic_blade_medium` | 同上（記入用コピー上は sonic_cross_2_meter_od） |
| 3 | guile | `perfect_timing_sonic_cross_od` | `sonic_blade_heavy` | 同上（記入用コピー上は sonic_cross_2_meter_od） |
| 4 | guile | `sonic_cross_heavy` | `sonic_blade_light` | 同上 |
| 5 | guile | `sonic_cross_heavy` | `sonic_blade_medium` | 同上 |
| 6 | guile | `sonic_cross_heavy` | `sonic_blade_heavy` | 同上 |
| 7 | guile | `sonic_cross_light` | `sonic_blade_light` | 派生元が複数あるパターン（弱中強のソニックブレイド） |
| 8 | guile | `sonic_cross_light` | `sonic_blade_medium` | 派生元が複数あるパターン（弱中強のソニックブレイド） |
| 9 | guile | `sonic_cross_light` | `sonic_blade_heavy` | 派生元が複数あるパターン（弱中強のソニックブレイド） |
| 10 | guile | `sonic_cross_medium` | `sonic_blade_light` | 同上 |
| 11 | guile | `sonic_cross_medium` | `sonic_blade_medium` | 同上 |
| 12 | guile | `sonic_cross_medium` | `sonic_blade_heavy` | 同上 |
| 13 | guile | `sonic_cross_od` | `sonic_blade_light` | 同上 |
| 14 | guile | `sonic_cross_od` | `sonic_blade_medium` | 同上 |
| 15 | guile | `sonic_cross_od` | `sonic_blade_heavy` | 同上 |
| 16 | jamie | `drink_level_4_ransui_haze_2_retreat` | `drink_level_4_senei_kick` | senei kickから。 |
| 17 | jamie | `drink_level_4_ransui_haze_3_delay` | `drink_level_4_ransui_haze_2_retreat` | 乱酔旋(2段目/後退)から派生 |
| 18 | jamie | `drink_level_4_ransui_haze_3_drink_while_retreating` | `drink_level_4_ransui_haze_2_retreat` | 乱酔旋(2段目/後退)から派生 |
| 19 | jamie | `drink_level_4_ransui_haze_3_immediate` | `drink_level_4_ransui_haze_2_retreat` | 乱酔旋(2段目/後退)から派生 |
| 20 | ken | `gorai_axe_kick` | `jinrai_kick_light` | 同上 |
| 21 | ken | `gorai_axe_kick` | `jinrai_kick_medium` | 同上 |
| 22 | ken | `gorai_axe_kick` | `jinrai_kick_heavy` | 同上 |
| 23 | ken | `gorai_axe_kick_od` | `jinrai_kick_od` | OD迅雷脚からのみ派生できる技 |
| 24 | ken | `kasai_thrust_kick` | `kazekama_shin_kick_od` | OD風鎌蹴りからのみ派生できる技 |
| 25 | ken | `kasai_thrust_kick_during_od_gorai_axe_kick` | `gorai_axe_kick_od` | OD轟雷落としからのみ派生できる技 |
| 26 | ken | `kasai_thrust_kick_during_od_senka_snap_kick` | `senka_snap_kick_od` | OD閃火脚からのみ派生できる技 |
| 27 | ken | `kazekama_shin_kick` | `jinrai_kick_light` | 弱中強の迅雷脚から派生できる技 |
| 28 | ken | `kazekama_shin_kick` | `jinrai_kick_medium` | 弱中強の迅雷脚から派生できる技 |
| 29 | ken | `kazekama_shin_kick` | `jinrai_kick_heavy` | 弱中強の迅雷脚から派生できる技 |
| 30 | ken | `kazekama_shin_kick_od` | `jinrai_kick_od` | OD迅雷脚からのみ派生できる技 |
| 31 | ken | `senka_snap_kick` | `jinrai_kick_light` | 同上 |
| 32 | ken | `senka_snap_kick` | `jinrai_kick_medium` | 同上 |
| 33 | ken | `senka_snap_kick` | `jinrai_kick_heavy` | 同上 |
| 34 | ken | `senka_snap_kick_od` | `jinrai_kick_od` | OD迅雷脚からのみ派生できる技 |
| 35 | kimberly | `step_up_backward` | `hisen_kick` | Hisen Kickからの派生 |
| 36 | kimberly | `step_up_forward` | `hisen_kick` | Hisen Kickからの派生 |
| 37 | kimberly | `step_up_neutral` | `hisen_kick` | Hisen Kickからの派生 |
| 38 | luke | `fatal_shot` | `sand_blast_od` | ODサンドブラスト空のみ派生 |
| 39 | luke | `impaler` | `avenger` | avengerからだけ派生 |
| 40 | luke | `impaler_od` | `avenger_od` | OD avengerからだけ派生 |
| 41 | luke | `no_chaser` | `avenger` | avengerからだけ派生 |
| 42 | luke | `no_chaser_od` | `avenger_od` | OD avengerからだけ派生 |
| 43 | m_bison | `devil_reverse` | `shadow_rise_light` | ノーマルシャドウライズからのみ派生 |
| 44 | m_bison | `devil_reverse` | `shadow_rise_medium` | ノーマルシャドウライズからのみ派生 |
| 45 | m_bison | `devil_reverse` | `shadow_rise_heavy` | ノーマルシャドウライズからのみ派生 |
| 46 | m_bison | `devil_reverse_od` | `shadow_rise_light` | ODシャドウライズだけでなく弱中強からも派生可能（指示書 §1.5） |
| 47 | m_bison | `devil_reverse_od` | `shadow_rise_medium` | ODシャドウライズだけでなく弱中強からも派生可能（指示書 §1.5） |
| 48 | m_bison | `devil_reverse_od` | `shadow_rise_heavy` | ODシャドウライズだけでなく弱中強からも派生可能（指示書 §1.5） |
| 49 | m_bison | `devil_reverse_od` | `shadow_rise_od` | ODシャドウライズだけでなく弱中強からも派生可能（指示書 §1.5） |
| 50 | m_bison | `head_press` | `shadow_rise_light` | ノーマルシャドウライズからのみ派生 |
| 51 | m_bison | `head_press` | `shadow_rise_medium` | ノーマルシャドウライズからのみ派生 |
| 52 | m_bison | `head_press` | `shadow_rise_heavy` | ノーマルシャドウライズからのみ派生 |
| 53 | m_bison | `head_press_od` | `shadow_rise_light` | 同上 |
| 54 | m_bison | `head_press_od` | `shadow_rise_medium` | 同上 |
| 55 | m_bison | `head_press_od` | `shadow_rise_heavy` | 同上 |
| 56 | m_bison | `head_press_od` | `shadow_rise_od` | 同上 |
| 57 | marisa | `enfold` | `scutum` | スクトゥムから |
| 58 | marisa | `enfold_od` | `scutum_od` | ODスクトゥムから |
| 59 | marisa | `procella` | `scutum` | スクトゥムから |
| 60 | marisa | `procella_od` | `scutum_od` | ODスクトゥムから |
| 61 | marisa | `tonitrus_1hit` | `scutum` | スクトゥムから |
| 62 | marisa | `tonitrus_1hit_od` | `scutum_od` | ODスクトゥムから |
| 63 | rashid | `front_flip` | `side_flip` | side_flipから派生 |

**既存 9 行**（zangief 連打版・`000061`）は巻き込んでいない。**保留行**（guile `sonic_cross_2_meter_od`）には付けていない。

---

---

*以上*
