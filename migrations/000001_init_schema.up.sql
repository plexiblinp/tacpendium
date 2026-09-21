-- 000001_init_schema.up.sql
-- M33-02(S01): 最終スキーマ。旧系列 111 本(凍結点 5576126)＋増分 4 本が積み上げた
--   21 表 / 21 明示索引を、1 本の素直な DDL として書き直したもの。
--
-- ★本ファイルは「適用済み DB の sqlite_master をテキストで写したもの」ではない。
--   旧系列は 111 本の ALTER を重ねており、生テキストには次の accretion が残っている:
--     - combos の表名が引用符付き("combos")  ← 000016/000019 の表再構築 → RENAME の跡
--     - moves / combos / games の ALTER ADD COLUMN が 1 行へ連なった形
--     - 旧 SQL の -- コメントが本文として取り込まれた 13 表
--   ⇒ 同一性は「正規化スキーマ」で判定する(SUPP-001 §5.5.4 規約 (18))。
--      pragma table_info / foreign_key_list / index_list から構造だけを取り、
--      sqlite_master.sql のテキストでは比較しない。
--
-- ★層 A(AGPL-3.0-or-later)。ゲームデータ表へ 1 行も書かないため `_data_` を持たない。
--   ⇒ 本ファイルが行うのは DDL と sqlite_sequence の初期化だけである。

-- ===== 参照の根(FK を持たない) =====
CREATE TABLE games (
    id      INTEGER PRIMARY KEY AUTOINCREMENT,
    code    TEXT    NOT NULL UNIQUE,
    name_ja TEXT    NOT NULL,
    name_en TEXT    NOT NULL,
    current_data_version TEXT NOT NULL DEFAULT '2026.08.03.01'
    CHECK (
        current_data_version GLOB '[0-9][0-9][0-9][0-9].[0-9][0-9].[0-9][0-9].[0-9][0-9]'
        AND CAST(substr(current_data_version, 6, 2) AS INTEGER) BETWEEN 1 AND 12
        AND CAST(substr(current_data_version, 9, 2) AS INTEGER) BETWEEN 1 AND 31
    )
);

CREATE TABLE characters (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    game_id       INTEGER NOT NULL REFERENCES games(id),
    code          TEXT    NOT NULL,
    name_ja       TEXT    NOT NULL,
    name_en       TEXT    NOT NULL,
    custom_states TEXT,                            -- JSON、NULL 可
    UNIQUE (game_id, code)
);

CREATE TABLE users (
    id                 INTEGER PRIMARY KEY AUTOINCREMENT,
    name               TEXT    NOT NULL UNIQUE,
    password_hash      TEXT,                                -- NULL 可(認証不要ユーザー)
    main_character_id  INTEGER REFERENCES characters(id),
    created_at         DATETIME NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE moves (
    id                          INTEGER PRIMARY KEY AUTOINCREMENT,
    character_id                INTEGER NOT NULL REFERENCES characters(id),
    code                        TEXT    NOT NULL,
    category                    TEXT    NOT NULL,    -- normal/special/unique/super_art/throw/system/target_combo/rush_variant/drive_impact
    original_move_id            INTEGER REFERENCES moves(id),  -- ラッシュ版のみ参照
    damage                      INTEGER,
    raw_data                    TEXT,                -- JSON
    startup                     INTEGER,
    active                      INTEGER,
    total                       INTEGER,
    on_hit                      INTEGER,
    on_block                    INTEGER,
    is_aerial                   INTEGER NOT NULL DEFAULT 0,
    setup_only                  INTEGER NOT NULL DEFAULT 0,
    recovery                    INTEGER,
    is_derived                  INTEGER NOT NULL DEFAULT 0,
    is_projectile               INTEGER NOT NULL DEFAULT 0,
    startup_basis               TEXT    NOT NULL DEFAULT 'unknown',
    chain_cancel_total          INTEGER,
    fastest_unreachable         INTEGER NOT NULL DEFAULT 0,
    last_changed_game_version   TEXT
    CHECK (
        last_changed_game_version IS NULL OR (
            last_changed_game_version GLOB '[0-9][0-9][0-9][0-9].[0-9][0-9].[0-9][0-9].[0-9][0-9]'
            AND CAST(substr(last_changed_game_version, 6, 2) AS INTEGER) BETWEEN 1 AND 12
            AND CAST(substr(last_changed_game_version, 9, 2) AS INTEGER) BETWEEN 1 AND 31
        )
    ),
    first_hit_startup           INTEGER,
    UNIQUE (character_id, code)
);

CREATE TABLE presets (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id           INTEGER REFERENCES users(id) ON DELETE CASCADE,  -- NULL は組み込み
    code              TEXT    NOT NULL UNIQUE,                         -- CHANGE-007: 機械可読識別子
    name              TEXT    NOT NULL,                                -- 表示用名(日本語)
    base_preset_code  TEXT,                                            -- カスタム時にベースを記録
    is_builtin        INTEGER NOT NULL DEFAULT 0                       -- BOOLEAN
);

CREATE TABLE tags (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name      TEXT    NOT NULL,
    category  TEXT,                                  -- mycombo_status 等
    color     TEXT,                                  -- #HEX
    UNIQUE (user_id, name)
);

CREATE TABLE preset_aliases (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    preset_id    INTEGER NOT NULL REFERENCES presets(id) ON DELETE CASCADE,
    move_id      INTEGER NOT NULL REFERENCES moves(id),
    alias_text   TEXT    NOT NULL,
    alias_text_en TEXT,
    character_id INTEGER,                            -- ★FK ではない(000074 の as-built)
    UNIQUE (preset_id, move_id)
);

CREATE TABLE move_commands (
    move_id      INTEGER NOT NULL REFERENCES moves(id) ON DELETE CASCADE,
    character_id INTEGER NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
    token_key    TEXT    NOT NULL,
    PRIMARY KEY (move_id, token_key)
);

CREATE TABLE move_derivations (
    child_move_id  INTEGER NOT NULL REFERENCES moves(id) ON UPDATE CASCADE,
    parent_move_id INTEGER NOT NULL REFERENCES moves(id) ON UPDATE CASCADE,
    PRIMARY KEY (child_move_id, parent_move_id)
);

CREATE TABLE setups (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    character_id  INTEGER NOT NULL REFERENCES characters(id),
    name          TEXT,
    description   TEXT,
    step_count    INTEGER NOT NULL DEFAULT 0,
    recipe_cache  TEXT,                              -- JSON
    version       INTEGER NOT NULL DEFAULT 1,
    created_at    DATETIME NOT NULL DEFAULT (datetime('now')),
    updated_at    DATETIME NOT NULL DEFAULT (datetime('now')),
    deleted_at    DATETIME
);

-- ===== 利用者データ表 =====
CREATE TABLE combos (
    id                                INTEGER  PRIMARY KEY AUTOINCREMENT,
    character_id                      INTEGER  NOT NULL REFERENCES characters(id),
    is_draft                          INTEGER  NOT NULL DEFAULT 0,    -- BOOLEAN
    damage                            INTEGER,
    drive_available_at_start          REAL,                           -- 0〜6・0.5 刻み(M16-01、旧 INTEGER)
    sa_available_at_start             INTEGER,                        -- 0〜3(アプリ層で制約)
    drive_damage                      REAL,                           -- -6〜6・小数許容(C-11)
    starter_move_id                   INTEGER  REFERENCES moves(id),
    position                          TEXT,
    opponent_stance                   TEXT,
    hit_type                          TEXT,
    opponent_size                     TEXT,
    situation                         TEXT,                           -- JSON
    knockdown_advantage               INTEGER,
    memo                              TEXT,
    step_count                        INTEGER  NOT NULL DEFAULT 0,
    recipe_cache                      TEXT,                           -- JSON: presetId→displayString
    version                           INTEGER  NOT NULL DEFAULT 1,
    created_at                        DATETIME NOT NULL DEFAULT (datetime('now')),
    updated_at                        DATETIME NOT NULL DEFAULT (datetime('now')),
    deleted_at                        DATETIME,
    sa_gauge_consumed                 INTEGER,
    drive_gauge_consumed              REAL,
    link                              TEXT,
    video_path                        TEXT,
    image_path                        TEXT,
    materialized_from_combo_id        INTEGER  REFERENCES combos(id),
    superseded_by_combo_id            INTEGER  REFERENCES combos(id) ON DELETE SET NULL,
    oki_verified                      INTEGER  NOT NULL DEFAULT 0,
    baseline_version                  TEXT
    CHECK (
        baseline_version IS NULL OR (
            baseline_version GLOB '[0-9][0-9][0-9][0-9].[0-9][0-9].[0-9][0-9].[0-9][0-9]'
            AND CAST(substr(baseline_version, 6, 2) AS INTEGER) BETWEEN 1 AND 12
            AND CAST(substr(baseline_version, 9, 2) AS INTEGER) BETWEEN 1 AND 31
        )
    ),
    start_position_mass               INTEGER
    CHECK (start_position_mass IS NULL OR (start_position_mass BETWEEN 0 AND 160)),
    carry_distance_mass               INTEGER
    CHECK (carry_distance_mass IS NULL OR (carry_distance_mass BETWEEN 0 AND 160)),
    starter_meaty                     INTEGER  NOT NULL DEFAULT 0
);

CREATE TABLE combo_steps (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    combo_id    INTEGER NOT NULL REFERENCES combos(id) ON DELETE CASCADE,
    step_order  INTEGER NOT NULL,
    move_id     INTEGER REFERENCES moves(id),       -- NULL 可(非技ステップ等)
    modifiers   TEXT,                                -- JSON: {flags:[],type:"",notes:""}
    UNIQUE (combo_id, step_order)
);

CREATE TABLE setup_steps (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    setup_id    INTEGER NOT NULL REFERENCES setups(id) ON DELETE CASCADE,
    step_order  INTEGER NOT NULL,
    move_id     INTEGER REFERENCES moves(id),
    modifiers   TEXT,                                -- JSON
    UNIQUE (setup_id, step_order)
);

CREATE TABLE combo_tags (
    combo_id INTEGER NOT NULL REFERENCES combos(id) ON DELETE CASCADE,
    tag_id   INTEGER NOT NULL REFERENCES tags(id)   ON DELETE CASCADE,
    PRIMARY KEY (combo_id, tag_id)
);

CREATE TABLE combo_setups (
    combo_id INTEGER NOT NULL REFERENCES combos(id) ON DELETE CASCADE,
    setup_id INTEGER NOT NULL REFERENCES setups(id) ON DELETE CASCADE,
    PRIMARY KEY (combo_id, setup_id)
);

-- ★複合 FK。親が id ではないため、必ず combo_setups の後に置く(M33-01 §4.3)。
CREATE TABLE combo_setup_results (
    combo_id   INTEGER NOT NULL,
    setup_id   INTEGER NOT NULL,
    tech_type  TEXT    NOT NULL,   -- 相手の受け身。'neutral_tech' / 'back_tech'（combo_oki_options の値域を再利用）
    in_corner  BOOLEAN NOT NULL,   -- コンボ終了時に相手が画面端にいるか。combos.position とは意味が違う（開始位置ではない）
    result     TEXT    NOT NULL,   -- 検証結果。'ok' / 'ng'。BOOLEAN にせず将来の値追加余地を残す
    note       TEXT,               -- 不成立の理由・補足。成立の行にも書ける。nullable
    PRIMARY KEY (combo_id, setup_id, tech_type, in_corner),
    FOREIGN KEY (combo_id, setup_id) REFERENCES combo_setups(combo_id, setup_id)
        ON UPDATE CASCADE ON DELETE CASCADE
);

CREATE TABLE combo_oki_options (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    combo_id    INTEGER NOT NULL REFERENCES combos(id) ON DELETE CASCADE,
    attack_type TEXT    NOT NULL,   -- throw_meaty / shimmy / strike_meaty
    tech_type   TEXT    NOT NULL,   -- neutral_tech / back_tech
    uses_dr     INTEGER NOT NULL,   -- 0=ノーゲージ / 1=ドライブラッシュ（BOOLEAN）
    UNIQUE (combo_id, attack_type, tech_type, uses_dr)
);

CREATE TABLE combo_punishes (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    combo_id          INTEGER NOT NULL REFERENCES combos(id) ON DELETE CASCADE,
    opponent_move_id  INTEGER NOT NULL REFERENCES moves(id),
    note              TEXT,                                    -- 採用理由メモ・nullable
    created_at        TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at        TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE (combo_id, opponent_move_id)
);

CREATE TABLE combo_punish_curations (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    combo_id          INTEGER NOT NULL REFERENCES combos(id) ON DELETE CASCADE,
    opponent_move_id  INTEGER NOT NULL REFERENCES moves(id),
    note              TEXT,
    created_at        TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at        TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE (combo_id, opponent_move_id)
);

CREATE TABLE combo_punish_prunings (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    self_character_id INTEGER NOT NULL REFERENCES characters(id),
    opponent_move_id  INTEGER NOT NULL REFERENCES moves(id),
    note              TEXT,
    created_at        TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at        TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE (self_character_id, opponent_move_id)
);

CREATE TABLE combo_punish_starters (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    self_character_id INTEGER NOT NULL REFERENCES characters(id),
    opponent_move_id  INTEGER NOT NULL REFERENCES moves(id),
    starter_move_id   INTEGER NOT NULL REFERENCES moves(id),
    verdict           TEXT NOT NULL,                            -- 'adopted' | 'unreachable'（Go 側 whitelist で担保）
    note              TEXT,                                     -- 検証メモ・nullable
    created_at        TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at        TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE (self_character_id, opponent_move_id, starter_move_id)
);

-- ===== 明示索引(21 本) =====
CREATE INDEX idx_combos_character_id     ON combos(character_id);
CREATE INDEX idx_combos_starter_move_id  ON combos(starter_move_id);
CREATE INDEX idx_combos_situation_filter ON combos(position, opponent_stance, hit_type);
CREATE INDEX idx_combos_updated_at       ON combos(updated_at);
CREATE INDEX idx_combos_deleted_at       ON combos(deleted_at);
CREATE INDEX idx_combo_steps_combo_id_order ON combo_steps(combo_id, step_order);
CREATE INDEX idx_combo_tags_tag_id   ON combo_tags(tag_id);
CREATE INDEX idx_setups_character_id ON setups(character_id);
CREATE INDEX idx_setup_steps_setup_id_order ON setup_steps(setup_id, step_order);
CREATE INDEX idx_combo_setups_setup_id ON combo_setups(setup_id);
CREATE INDEX idx_combo_oki_options_combo_id ON combo_oki_options(combo_id);
CREATE INDEX idx_moves_character_category ON moves(character_id, category);
CREATE INDEX idx_move_commands_char_token ON move_commands (character_id, token_key);
CREATE INDEX idx_move_derivations_parent ON move_derivations (parent_move_id);
CREATE INDEX idx_preset_aliases_preset_move ON preset_aliases(preset_id, move_id);
CREATE UNIQUE INDEX ux_preset_aliases_preset_char_alias
    ON preset_aliases (preset_id, character_id, alias_text);
CREATE UNIQUE INDEX ux_preset_aliases_preset_char_alias_en
    ON preset_aliases (preset_id, character_id, alias_text_en)
 WHERE alias_text_en IS NOT NULL;
CREATE INDEX idx_combo_punishes_opponent_move ON combo_punishes(opponent_move_id);
CREATE INDEX idx_cpc_opponent_move ON combo_punish_curations(opponent_move_id);
CREATE INDEX idx_cpp_opponent_move ON combo_punish_prunings(opponent_move_id);
CREATE INDEX idx_cps_opponent_move ON combo_punish_starters(opponent_move_id);

-- ===== sqlite_sequence の初期化 =====
-- ★旧系列では combos / combo_oki_options が「行数 0 でも sqlite_sequence に seq=0 の行を持つ」。
--   機序: combos は 000016/000019 の表再構築、combo_oki_options は 000021 の 0 行 INSERT。
--   SQLite は AUTOINCREMENT 表への INSERT 文の終端で、0 行しか入らなくても
--   sqlite_sequence へ seq=0 の行を書き戻す。
--   ⇒ 「空の表は飛ばす」と実装すると sequence_equal が静かに落ちる(M33-01 §4.4)。
--   ★本ファイルが明示的に作る。以後の群は自分の表の分だけを受け持つ。
INSERT INTO sqlite_sequence (name, seq) VALUES ('combos', 0);
INSERT INTO sqlite_sequence (name, seq) VALUES ('combo_oki_options', 0);
