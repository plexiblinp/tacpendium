# 指示書 M3-01: タグ機能(バックエンド + 管理 UI、初期タグ seed 投入)

| 項目 | 内容 |
|------|------|
| 指示書ID | M3-01 |
| バージョン | 1.0.0 |
| 対象マイルストーン | M3(マイコンボ系) |
| 推奨モデル | **Sonnet 4.6** |
| Plan Mode | **任意**(Plan Mode で計画提示すると安全だが、必須ではない) |
| 機械レビュー | **必須**(別チェックリスト: `docs/instructions/reviews/M3-01-review-checklist.md`) |
| 並列性 | **単独**(M3 は完全直列、M2 完了が前提) |
| 依存指示書 | M1-02(`tags` / `combo_tags` テーブルの DDL は M1-02 で整備済み)、M1-03(リスト API のリポジトリ層・サービス層・ハンドラ層パターン) |
| 想定所要時間 | 90〜120 分 |
| 作成者 | 詳細設計・製造準備担当Claude(M3 期間担当) |
| 作成日 | 2026-05-10 |
| 更新日 | 2026-05-10 |

## 更新履歴

| バージョン | 更新日 | 更新内容 |
|-----------|--------|----------|
| 1.0.0 | 2026-05-10 | 初版作成 |

---

## 1. 背景と目的

### 1.1 背景

M3 全体の中核機能となる **タグ機能** のバックエンド・フロントを整備する初回サブマイルストーン。

タグは以下の2つの用途で使われる(REQ-001 / DES-003 §3.6 / DES-005 §5.12):

1. **マイコンボ管理**: 予約カテゴリ `mycombo_status`(値: 使用中・練習中・頻度低下)を持つタグを介して、コンボを「マイコンボ」として分類する(マイコンボ画面は M3-04 で実装)
2. **任意分類**: ユーザーが自由に作成するタグで、コンボを多軸で整理する(用途タグ・難易度タグ等)

M1-02 で `tags` / `combo_tags` テーブルの DDL は整備済み(`migrations/000001_init_schema.up.sql`)だが、API・フロント UI が未実装の状態。M1-05 のコンボ一覧画面では暫定処理として「タグ列ハイフン固定表示」となっている(progress-log.md M1-05 暫定処理2)。

加えて SUPP-001 §3.5 で「マイコンボ用の予約タグ3件(使用中・練習中・頻度低下)を初期データとして投入する」方針が定められているが、本来はウィザード経由(M6 で実装)で生成する想定。M3 期間ではウィザード未実装のため、seed SQL マイグレーションで暫定投入する(M3-overview §3.1 参照)。

### 1.2 目的

- バックエンド: `tags` / `combo_tags` の CRUD API を整備する(M1-03 のコンボ API パターンを踏襲)
- バックエンド: タグカテゴリ別取得 API(`GET /api/tags?category=mycombo_status` 等のクエリパラメータ対応)を実装する
- フロントエンド: 設定画面内に **タグ管理 UI**(新規作成・編集・削除、カテゴリ・色設定、使用コンボ数表示)を追加する(DES-005 §5.12 準拠)
- マイグレーション新設: `migrations/000007_seed_initial_tags_user1.up.sql` で user_id=1 に対して `mycombo_status` カテゴリの3タグ(使用中・練習中・頻度低下)を投入する

### 1.3 このマイルストーンで作らないもの

- 既存コンボへのタグ付与・解除 UI(コンボ編集画面のタグ選択 UI) — M3-02 で実装
- マイコンボタブ機能(タグ `mycombo_status` 系での絞り込み表示) — M3-04 で実装
- コンボ一覧の **タグ列実データ反映**(現状の暫定「-」固定表示を解消する処理) — M3-02 で実装(タグ付与 UI と同時)
- タグ別フィルタ機能(コンボ一覧のフィルタ条件にタグを含める) — M3-03 で実装
- 初回起動ウィザード経由のタグ自動生成 — M6 で実装(本指示書での seed 投入は暫定措置)

---

## 2. 成果物

### 2.1 作成するファイル

```
migrations/
└── 000007_seed_initial_tags_user1.up.sql       # マイグレーション up: user_id=1 に3タグ投入
└── 000007_seed_initial_tags_user1.down.sql     # マイグレーション down: 上記3タグの対称削除

internal/
├── api/
│   └── tag/
│       ├── handler.go                           # タグハンドラ層(CRUD + カテゴリ別取得)
│       └── handler_test.go                      # ハンドラテスト(httptest)
├── service/
│   └── tag/
│       ├── service.go                           # タグサービス層
│       └── service_test.go                      # サービス層テスト
├── repository/
│   └── tag/
│       ├── repository.go                        # タグリポジトリ層
│       └── repository_test.go                   # リポジトリ層テスト(複雑クエリのみ)
└── model/
    └── tag.go                                   # Tag モデル(M1-02 既存ファイルに型定義追加)

web/src/
├── features/
│   └── tag/                                     # ディレクトリ新設
│       ├── api/
│       │   └── tagApi.ts                        # タグ API クライアント
│       ├── hooks/
│       │   └── useTagManagement.ts              # タグ管理用フック(TanStack Query)
│       └── components/
│           ├── TagManagementPage.tsx            # タグ管理ページ本体
│           ├── TagListTable.tsx                 # タグ一覧テーブル(名前・カテゴリ・色・使用コンボ数)
│           ├── TagFormDialog.tsx                # タグ新規作成・編集ダイアログ
│           └── TagDeleteConfirmDialog.tsx       # 削除確認ダイアログ(VAL-T03 警告対応)
├── pages/
│   └── TagManagementPageRoute.tsx               # ルート登録用ラッパー(`/tags/manage`)
└── types/
    └── tag.ts                                   # タグ型定義(API DTO に対応)
```

各ファイルの責務は §4 で詳述する。

### 2.2 修正するファイル

| ファイル | 修正内容 |
|---------|---------|
| `cmd/combomgr/main.go` | タグ API ハンドラのルート登録(`/api/tags` 系)を追加。M1-03 のコンボハンドラ登録と同様のパターン |
| `web/src/App.tsx`(または既存ルーター定義ファイル) | `/tags/manage` ルートの追加 |
| `web/src/components/Layout.tsx`(または既存メニュー定義ファイル) | サイドバー/ヘッダーメニューに「タグ管理」リンク追加(DES-005 §3 画面遷移図準拠) |

### 2.3 変更しないもの(原則)

- 既存のコンボ系 API(M1-03 / M2-02 で実装済み)
- 既存のコンボ一覧画面・コンボ編集画面(M1-05 / M1-06 / M2 系で実装済み)
- M1-02 で整備済みの `tags` / `combo_tags` テーブル DDL(マイグレーション 000001)。これは変更しない
- presets 系のテーブル・API(本指示書のスコープ外)
- `combo_tags` 中間テーブルへの登録・更新処理(M3-02 で実装)

### 2.4 例外: バックエンドへの最小限の追加が許容される箇所

本指示書はバックエンド(タグ CRUD API + カテゴリ別取得 API)とフロント(タグ管理 UI)を同時に整備するため、以下の追加が本指示書のスコープに含まれる:

- **タグ CRUD API の新設**: `GET /api/tags`、`GET /api/tags/{id}`、`POST /api/tags`、`PATCH /api/tags/{id}`、`DELETE /api/tags/{id}` の5エンドポイント(§4.2 で詳述)
- **マイグレーション 000007 の追加**: 初期タグ seed(§4.1 で詳述)
- **internal/api/tag、internal/service/tag、internal/repository/tag パッケージの新設**: M1-03 のコンボ系パッケージ構成を踏襲

DES-002 §4.2 の代表エンドポイント表にはタグ API が記載されていないが、DES-003 §3.6 / §3.7 でテーブルが定義されており、DES-005 §5.12 でタグ管理画面が定義されているため、API 新設は設計書の自然な実装と判断する(M2-02 の重複検知 API 新設と同じスタンス、CHANGE 通知書の起票は不要)。

実装中にこれら以外のバックエンド変更が必要と判断した場合、Plan Mode で停止して開発者に相談すること。

---

## 3. 前提条件

### 3.1 必読ドキュメント

- `CLAUDE.md`(全体方針、§8 矛盾検出時の停止ルール、§10.X ブラウザストレージ運用ルール)
- `docs/instructions/M3-overview.md`(M3 全体像、§6 運用ルール)
- `docs/design/03-data-model.md`(データモデル設計書):
  - **§3.6 tags テーブル定義**(L446-458): カラム構成、UNIQUE 制約 `(user_id, name)`、予約カテゴリ `mycombo_status`
  - **§3.7 combo_tags テーブル定義**(L460-467): 中間テーブル、PK `(combo_id, tag_id)`
- `docs/design/05-screen-design.md`(画面設計書):
  - **§5.12 タグ管理**(L412-420): 表示項目・アクション・レスポンシブ
  - **§3 画面遷移図**(L77 周辺): タグ管理画面の位置づけ
- `docs/design/06-validation.md`(バリデーション設計書):
  - **§5 タグ編集時のバリデーション**(L119-125): VAL-T01(名前ユニーク)、VAL-T02(名前空でない)、VAL-T03(使用中タグ削除警告)
- `docs/design/supp-001-detailed-design.md`(設計補足):
  - **§3.5 初期タグ生成方針**(該当節): mycombo_status カテゴリ予約と3タグ
  - **§3.6 初期データ投入方式**: 本来ウィザード経由だが、M3 期間中は暫定 seed で凌ぐ
  - **§5.4 / §5.5 テスト規約**: サービス層テスト必須、リポジトリ層は複雑クエリのみ
- `docs/instructions/M1-02-database-and-models.md`(M1-02 のファイル名は仮置きで、実際のファイルパスは異なる場合がある): tags / combo_tags の DDL 確認用。実ファイル名が不明な場合は `docs/instructions/M1-02-*.md` を `find` で確認する
- `docs/instructions/M1-03-combo-list-api.md`(M1-03 のファイル名は仮置きで、実際のファイルパスは異なる場合がある): リスト API のリポジトリ層・サービス層・ハンドラ層パターン。実ファイル名が不明な場合は `docs/instructions/M1-03-*.md` を `find` で確認する

### 3.2 任意参照(必要時のみ参照)

- `docs/design/02-architecture.md`(アーキテクチャ設計書):
  - **§4.2 主要エンドポイント**(L126-148): タグ API は記載されていないが既存 API 命名規則の確認用
  - **§4.3 エラーハンドリング**(L149-163): エラーレスポンス共通フォーマット(`{error: {code, message, details}}`)
- `docs/design/requirements.md`(要件定義書): タグ関連 FR(マイコンボ管理関連)
- `docs/instructions/M2-02-edit-ux-improvements.md`: 重複検知 API 新設パターン(本指示書のタグ CRUD API 新設の参考)

### 3.3 参照不要

- DES-004 内部表現仕様書(プリセット・エイリアス系、本指示書のスコープ外)
- M2-01 / M2-03 / M2-04 指示書(本指示書のスコープ外)

### 3.4 着手前の確認(マイグレーション・既存実装の状態確認)

製造担当 Claude Code は §4 詳細仕様の実装に着手する前に、以下を確認する。

#### 3.4.1 tags / combo_tags テーブルの DDL 確認

```bash
# サーバーが起動していない場合は make run-server-debug などで起動
sqlite3 data/combomgr.db ".schema tags"
sqlite3 data/combomgr.db ".schema combo_tags"
```

期待される結果(DES-003 §3.6 / §3.7 準拠):

```
CREATE TABLE tags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  name TEXT NOT NULL,
  category TEXT,
  color TEXT,
  UNIQUE(user_id, name)
);

CREATE TABLE combo_tags (
  combo_id INTEGER NOT NULL REFERENCES combos(id),
  tag_id INTEGER NOT NULL REFERENCES tags(id),
  PRIMARY KEY (combo_id, tag_id)
);
```

カラム名・型・制約が DES-003 §3.6 / §3.7 と一致することを確認する(設計書本体との行レベル照合、playbook §5)。

#### 3.4.2 現在のマイグレーション番号確認

```bash
ls migrations/ | sort
```

期待される結果(M2 完了時点): `000001` 〜 `000006` までが存在し、`000007` が未使用であること。`000007` が既に他用途で使用されている場合は Plan Mode で停止して開発者に相談する。

#### 3.4.3 user_id=1 の存在確認

```bash
sqlite3 data/combomgr.db "SELECT id, name FROM users WHERE id = 1;"
```

期待される結果: `1|default`(または同等の単一レコード)。M2 までの認証スキップ運用(SUPP-001 §2.5)で default ユーザーが存在することを確認する。

#### 3.4.4 確認結果の報告

製造担当 Claude Code は §3.4.1〜§3.4.3 の確認コマンド出力を実装完了報告に含める。

#### 3.4.5 §4 着手の前提条件

§3.4.1〜§3.4.3 の全確認結果が期待通りであることを確認してから、§4 詳細仕様の実装に着手する。

---

## 4. 詳細仕様

### 4.1 マイグレーション 000007: 初期タグ seed 投入

#### 4.1.1 設計の中核思想

SUPP-001 §3.5 で予約カテゴリ `mycombo_status` を定義し、初期タグ「使用中」「練習中」「頻度低下」の3件を user_id=1 に投入する。

**本来の方針との関係(暫定措置である事実の明示)**:

SUPP-001 §3.6 では「ユーザー別データはウィザード経由生成」が原則だが、ウィザード実装は M6。M3 期間ではタグ機能とマイコンボタブ(M3-04)が動作する前提で初期タグが必要なため、seed SQL で暫定投入する。本マイグレーションは **暫定措置** であり、M6 着手時にウィザード経由生成に切り替える。

その移行手順(将来の M6 着手担当向けメモ):

1. M6 で新規マイグレーションを作成し、ウィザード完了処理で「同名タグが既に存在する場合は作成をスキップする」分岐を追加
2. 本マイグレーション(000007)自体は履歴として残す(playbook §11.3 のクローズ記録方針)
3. ウィザード経由生成への切り替え後、新規ユーザーは seed なしで動作する(初回起動ウィザード完了で初めて3タグが生成される)

#### 4.1.2 マイグレーション up 内容

ファイル: `migrations/000007_seed_initial_tags_user1.up.sql`

```sql
-- M3-01 で投入する暫定 seed:
-- マイコンボ管理用の予約カテゴリ mycombo_status のタグ3件を user_id=1 に投入する。
-- 本来は M6 で実装予定の初回起動ウィザード経由で生成すべきデータだが、
-- M3 期間ではウィザード未実装のため暫定的に seed で凌ぐ。
-- M6 着手時にウィザード経由生成へ切り替える(SUPP-001 §3.6、M3-overview.md §3.1 参照)。

INSERT INTO tags (user_id, name, category, color) VALUES
  (1, '使用中',   'mycombo_status', '#10B981'),
  (1, '練習中',   'mycombo_status', '#3B82F6'),
  (1, '頻度低下', 'mycombo_status', '#6B7280');
```

色値の根拠:
- `#10B981`(emerald-500): 「使用中」を表す前向きな緑
- `#3B82F6`(blue-500): 「練習中」を表す中立的な青
- `#6B7280`(gray-500): 「頻度低下」を表す抑え目な灰色

これらは shadcn/ui / Tailwind のデフォルトパレットに沿った値で、フロント側で視認性が確認しやすい。

#### 4.1.3 マイグレーション down 内容

ファイル: `migrations/000007_seed_initial_tags_user1.down.sql`

```sql
-- M3-01 暫定 seed の対称削除。
-- ユーザーが手で追加した独自タグは保護する目的で、user_id=1 かつ category='mycombo_status' の
-- 3件のみを削除条件とする。
-- ユーザーが「使用中」「練習中」「頻度低下」と同名のタグを別カテゴリで作成していた場合、
-- それは本マイグレーションの対象外として保護される。

DELETE FROM tags
WHERE user_id = 1
  AND category = 'mycombo_status'
  AND name IN ('使用中', '練習中', '頻度低下');
```

#### 4.1.4 マイグレーション実行確認

製造担当 Claude Code は実装完了時に以下を確認する:

```bash
# マイグレーション up 実行
make run-server-debug  # 起動時に自動マイグレーション実行
sqlite3 data/combomgr.db "SELECT id, user_id, name, category, color FROM tags WHERE user_id = 1 AND category = 'mycombo_status';"
```

期待される結果(3件、id は AUTOINCREMENT で具体値は環境依存):

```
1|1|使用中|mycombo_status|#10B981
2|1|練習中|mycombo_status|#3B82F6
3|1|頻度低下|mycombo_status|#6B7280
```

### 4.2 タグ API(バックエンド)

#### 4.2.1 エンドポイント一覧

| メソッド | パス | 用途 | クエリ/ボディ |
|---------|------|------|--------------|
| GET | `/api/tags` | タグ一覧取得 | `?category={category}` で絞り込み(任意)、`?include_usage=true` で `usage_count` フィールド付与(任意) |
| GET | `/api/tags/{id}` | タグ詳細取得 | - |
| POST | `/api/tags` | タグ新規作成 | Body: `{name, category, color}` |
| PATCH | `/api/tags/{id}` | タグ編集 | Body: `{name?, category?, color?}`(部分更新) |
| DELETE | `/api/tags/{id}` | タグ削除 | `?force=true` で使用中タグも削除許可(VAL-T03 警告確認後) |

レスポンスの認証コンテキストは default ユーザー固定(SUPP-001 §2.5、M2 までの運用継承)。`user_id` のクエリ指定は受け付けない(セキュリティ観点)。

#### 4.2.2 DTO 定義

**Tag DTO**(`internal/model/tag.go` および `web/src/types/tag.ts`):

```go
// internal/model/tag.go
type Tag struct {
    ID         int64  `json:"id" db:"id"`
    UserID     int64  `json:"user_id" db:"user_id"`
    Name       string `json:"name" db:"name"`
    Category   string `json:"category,omitempty" db:"category"`     // NULL 可、JSON では空文字を omitempty で省略
    Color      string `json:"color,omitempty" db:"color"`           // NULL 可、同上
    UsageCount *int   `json:"usage_count,omitempty" db:"-"`         // include_usage=true 時のみ JOIN で算出、フィールドの存在で含有判定
}
```

```typescript
// web/src/types/tag.ts
export interface Tag {
  id: number;
  user_id: number;
  name: string;
  category?: string;        // undefined 可
  color?: string;           // undefined 可
  usage_count?: number;     // include_usage=true 時のみ
}

export interface CreateTagInput {
  name: string;
  category?: string;
  color?: string;
}

export interface UpdateTagInput {
  name?: string;
  category?: string;
  color?: string;
}
```

DES-003 §3.6 のテーブル定義(L446-458)と一致することを確認(`category` / `color` は NULL 可、`name` は NOT NULL、UNIQUE `(user_id, name)`)。

#### 4.2.3 バリデーション(VAL-T01 / VAL-T02 / VAL-T03)

**VAL-T01 タグ名がユーザー内で一意か**(ERROR、DES-006 §5):
- POST / PATCH 時に `WHERE user_id = ? AND name = ? AND id != ?` で既存確認
- 既存ありの場合: HTTP 409 `{error: {code: "TAG_NAME_DUPLICATE", message: "同名のタグが既に存在します", details: {existing_tag_id: <id>}}}`

**VAL-T02 タグ名が空でないか**(ERROR):
- POST / PATCH 時に `name == ""` または `len(strings.TrimSpace(name)) == 0` を検出
- HTTP 400 `{error: {code: "TAG_NAME_EMPTY", message: "タグ名は必須です"}}`

**VAL-T03 使用中タグの削除試行**(WARNING):
- DELETE 時に `combo_tags` テーブルで `tag_id` の使用件数を確認
- 使用中(1件以上)で `?force=true` クエリなし: HTTP 409 `{error: {code: "TAG_IN_USE", message: "このタグは使用中です。確認の上削除してください", details: {usage_count: <件数>, force_delete_query: "?force=true"}}}`
- 使用中で `?force=true` あり: 削除実行(`combo_tags` の関連レコードも CASCADE 削除されるか、別途 DELETE する)
- 未使用: 通常通り削除

`combo_tags` の CASCADE 削除挙動はテーブル DDL の FK 設定に依存する。M1-02 で `ON DELETE CASCADE` が設定されているか §3.4.1 で確認し、ない場合はサービス層で明示的に `DELETE FROM combo_tags WHERE tag_id = ?` を先に実行する。

#### 4.2.4 サービス層関数

`internal/service/tag/service.go` の公開関数:

```go
// ListTags はユーザーのタグ一覧を返す。
// category が空文字でない場合、その category で絞り込む。
// includeUsage が true の場合、Tag.UsageCount を combo_tags との JOIN で算出する。
func (s *Service) ListTags(ctx context.Context, userID int64, category string, includeUsage bool) ([]model.Tag, error)

// GetTag は単一タグを返す。存在しない場合は ErrNotFound。
func (s *Service) GetTag(ctx context.Context, userID, tagID int64) (*model.Tag, error)

// CreateTag は新規タグを作成する。VAL-T01 / VAL-T02 を検証する。
func (s *Service) CreateTag(ctx context.Context, userID int64, input model.CreateTagInput) (*model.Tag, error)

// UpdateTag は既存タグを部分更新する。VAL-T01 / VAL-T02 を検証する。
func (s *Service) UpdateTag(ctx context.Context, userID, tagID int64, input model.UpdateTagInput) (*model.Tag, error)

// DeleteTag はタグを削除する。force=false かつ使用中の場合 ErrTagInUse を返す。
func (s *Service) DeleteTag(ctx context.Context, userID, tagID int64, force bool) error
```

M1-03 のコンボサービスと同パターン。エラー種別は `errors.Is(err, ErrXxx)` で判定可能な定数として `internal/service/tag/errors.go` に定義する。

#### 4.2.5 リポジトリ層

`internal/repository/tag/repository.go` の公開関数:

```go
List(ctx context.Context, userID int64, category string, includeUsage bool) ([]model.Tag, error)
Get(ctx context.Context, userID, tagID int64) (*model.Tag, error)
Create(ctx context.Context, userID int64, input model.CreateTagInput) (*model.Tag, error)
Update(ctx context.Context, userID, tagID int64, input model.UpdateTagInput) (*model.Tag, error)
Delete(ctx context.Context, userID, tagID int64) error
CountUsage(ctx context.Context, tagID int64) (int, error)  // VAL-T03 用、combo_tags の COUNT(*)
```

`includeUsage=true` 時の List クエリ例(JOIN で `usage_count` を一発取得):

```sql
SELECT
  t.id, t.user_id, t.name, t.category, t.color,
  COUNT(ct.combo_id) AS usage_count
FROM tags t
LEFT JOIN combo_tags ct ON ct.tag_id = t.id
WHERE t.user_id = ?
  AND (? = '' OR t.category = ?)  -- category 空文字なら絞り込みなし
GROUP BY t.id
ORDER BY t.category NULLS LAST, t.name;
```

(SQLite で `NULLS LAST` 動作確認は実装時に。動作しない SQLite バージョンの場合は `ORDER BY t.category IS NULL, t.category, t.name` 形式に変更する)

#### 4.2.6 ハンドラ層

`internal/api/tag/handler.go` のルート登録例(Echo):

```go
func RegisterRoutes(g *echo.Group, h *Handler) {
    g.GET("/tags", h.List)
    g.GET("/tags/:id", h.Get)
    g.POST("/tags", h.Create)
    g.PATCH("/tags/:id", h.Update)
    g.DELETE("/tags/:id", h.Delete)
}
```

レスポンス形式は M1-03 のコンボハンドラと同形式。エラーレスポンスは DES-002 §4.3 の共通フォーマット `{error: {code, message, details}}` に従う。

### 4.3 タグ管理画面(フロントエンド)

#### 4.3.1 ルート設計

- パス: `/tags/manage`(DES-005 §3 画面遷移図準拠、設定画面群の一つ)
- 画面ファイル: `web/src/pages/TagManagementPageRoute.tsx`(ルートラッパー) + `web/src/features/tag/components/TagManagementPage.tsx`(本体)

#### 4.3.2 画面構成(DES-005 §5.12 準拠)

画面は3つのセクションで構成する。

```
┌─────────────────────────────────────────────────┐
│  タグ管理                              [+ 新規作成] │  ← ページヘッダ + 新規作成ボタン
├─────────────────────────────────────────────────┤
│  タグ一覧テーブル                                  │
│  ┌────────┬──────────────────┬──────┬─────────┐  │
│  │ 名前    │ カテゴリ          │ 色   │ 使用数   │  │
│  ├────────┼──────────────────┼──────┼─────────┤  │
│  │ 使用中  │ mycombo_status   │ ●緑  │ 12      │  │
│  │ 練習中  │ mycombo_status   │ ●青  │ 5       │  │
│  │ ...                                          │  │
│  └────────┴──────────────────┴──────┴─────────┘  │
└─────────────────────────────────────────────────┘
```

各行の右端に「編集」「削除」アイコンボタン。

#### 4.3.3 コンポーネント分割

| コンポーネント | 責務 |
|--------------|------|
| `TagManagementPage.tsx` | ページ本体。`useTagManagement` フックで一覧取得、ダイアログ開閉状態管理 |
| `TagListTable.tsx` | タグ一覧テーブルの描画。タグ配列を props で受け取り、編集・削除のコールバックを発火 |
| `TagFormDialog.tsx` | 新規作成・編集ダイアログ。shadcn/ui の Dialog + Form。バリデーションは zod スキーマ |
| `TagDeleteConfirmDialog.tsx` | 削除確認ダイアログ。VAL-T03 で `usage_count > 0` の場合は警告メッセージ + force 削除確認 |

#### 4.3.4 useTagManagement フック

`web/src/features/tag/hooks/useTagManagement.ts`:

```typescript
export function useTagManagement() {
  const queryClient = useQueryClient();

  // 一覧取得(usage_count 付き、カテゴリフィルタなし = 全件)
  const tagsQuery = useQuery({
    queryKey: ['tags', { include_usage: true }],
    queryFn: () => tagApi.list({ includeUsage: true }),
  });

  const createMutation = useMutation({
    mutationFn: (input: CreateTagInput) => tagApi.create(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tags'] }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, input }: { id: number; input: UpdateTagInput }) => tagApi.update(id, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tags'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: ({ id, force }: { id: number; force: boolean }) => tagApi.delete(id, force),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tags'] }),
  });

  return { tagsQuery, createMutation, updateMutation, deleteMutation };
}
```

#### 4.3.5 タグフォームのバリデーション(zod)

```typescript
const tagFormSchema = z.object({
  name: z.string().trim().min(1, 'タグ名は必須です'),                 // VAL-T02
  category: z.string().optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, '色は #RRGGBB 形式で指定してください').optional(),
});
```

サーバー側 VAL-T01(ユニーク制約違反 HTTP 409)はフォーム送信後のレスポンスで判定し、`react-hook-form` の `setError` で name フィールドにエラーメッセージを表示する。

#### 4.3.6 削除フロー(VAL-T03)

1. 一覧の削除ボタンクリック → `TagDeleteConfirmDialog` を開く
2. ダイアログ表示時、対象タグの `usage_count` を確認:
   - `usage_count === 0`: 「このタグを削除しますか?」のシンプル確認
   - `usage_count > 0`: 「このタグは {N} 件のコンボで使用中です。削除すると、これらのコンボからタグが外れます。続行しますか?」の警告確認
3. ユーザーが「削除」を確定 → `deleteMutation.mutate({ id, force: usage_count > 0 })`
4. 削除成功 → ダイアログを閉じて一覧を再取得(TanStack Query の invalidate)

#### 4.3.7 メニュー導線

`web/src/components/Layout.tsx`(または既存メニュー定義ファイル)のサイドバー/ヘッダーに「タグ管理」リンクを追加する。

DES-005 §3 画面遷移図(L77 周辺)で設定画面群の一つとして配置されており、コンボ一覧 → タグ管理 への遷移リンクが明示されている。具体的な配置位置(設定メニュー配下なのか、トップレベルなのか)は M1 期間の Layout.tsx 実装に従う。設計担当 Claude が指示書執筆時に既存 Layout 構造を view で確認した結果、設定メニュー配下に配置する想定で記述しているが、実装時に既存構造と齟齬がある場合は Plan Mode で開発者と確認する。

### 4.4 設計判断事項(本指示書で確定済み)

以下は本指示書で確定済みの設計判断。製造担当 Claude Code は推測で別案を選ばない。

| 項目 | 確定内容 | 根拠 |
|------|---------|------|
| 初期タグ生成方式 | seed SQL マイグレーション(暫定措置) | M3-overview §3.1 開発者承認(2026-05-10) |
| 初期タグの色 | `#10B981` / `#3B82F6` / `#6B7280` | 本指示書 §4.1.2 の根拠記述 |
| API のユーザーコンテキスト | default ユーザー固定 | SUPP-001 §2.5、M2 までの運用継承 |
| `usage_count` の取得方式 | LEFT JOIN + GROUP BY で1クエリ取得 | パフォーマンス、N+1 回避 |
| カスケード削除 | force=true 時のみ。combo_tags の処理は FK 設定に応じて分岐 | DES-006 VAL-T03、§3.4.1 で確認 |
| 画面ルートパス | `/tags/manage` | DES-005 §3 画面遷移図、URL 命名一貫性(`/<feature>/<action>`) |
| フォームバリデーション | zod + react-hook-form | M1-06 / M2-02 で確立した運用 |

---

## 5. テスト要件

### 5.1 必須テスト

#### 5.1.1 バックエンド: サービス層テスト(必須)

`internal/service/tag/service_test.go` で以下のケースを網羅する:

- **CreateTag 正常系**: name のみ、name + category、name + category + color の3パターン
- **CreateTag VAL-T01 違反**: 同一ユーザーで同名タグが既存 → ErrTagNameDuplicate
- **CreateTag VAL-T02 違反**: name が空文字、空白のみ → ErrTagNameEmpty
- **UpdateTag 正常系**: name のみ更新、category のみ更新、color のみ更新、複合更新
- **UpdateTag VAL-T01 違反**: 別タグの name と衝突 → ErrTagNameDuplicate
- **UpdateTag VAL-T02 違反**: name を空文字に更新試行 → ErrTagNameEmpty
- **DeleteTag 未使用**: 正常削除
- **DeleteTag 使用中 force=false**: ErrTagInUse(usage_count を含む)
- **DeleteTag 使用中 force=true**: 正常削除(combo_tags の関連レコードも消える)
- **ListTags カテゴリフィルタなし**: 全件取得
- **ListTags カテゴリフィルタあり**: 該当カテゴリのみ
- **ListTags includeUsage=true**: usage_count フィールドが正しく算出される
- **GetTag 存在**: 正常取得
- **GetTag 不存在**: ErrNotFound

#### 5.1.2 バックエンド: リポジトリ層テスト(複雑クエリのみ)

`internal/repository/tag/repository_test.go` で以下のみ:

- **List includeUsage=true** の JOIN クエリが正しく usage_count を返す(複数コンボに紐付くタグ、未使用タグの両方を含むテストデータで)
- **CountUsage** が `combo_tags` の正しい件数を返す

その他の単純な CRUD クエリはサービス層テストでカバーされるためリポジトリ層では省略(SUPP-001 §5.4 に従う)。

#### 5.1.3 バックエンド: ハンドラ層テスト

`internal/api/tag/handler_test.go` で `httptest` を使い、各エンドポイントの正常系と主要異常系をテスト:

- **GET /api/tags**: 200 で配列レスポンス
- **GET /api/tags?category=mycombo_status**: 200 で絞り込み結果
- **GET /api/tags/:id**: 200 で単一タグ、404 で不存在
- **POST /api/tags**: 201 で作成、400 で VAL-T02、409 で VAL-T01
- **PATCH /api/tags/:id**: 200 で更新、404 で不存在、400 で VAL-T02、409 で VAL-T01
- **DELETE /api/tags/:id**: 204 で削除(未使用)、409 で VAL-T03(使用中、force なし)
- **DELETE /api/tags/:id?force=true**: 204 で強制削除

エラーレスポンスのボディ構造が DES-002 §4.3 の `{error: {code, message, details}}` に従うことを確認。

#### 5.1.4 フロントエンド: コンポーネントテスト(主要ロジックのみ)

`web/src/features/tag/components/*.test.tsx` で以下:

- **TagFormDialog**: zod バリデーション(name 空、color 形式違反)が発火することを React Testing Library で確認
- **TagDeleteConfirmDialog**: usage_count による表示分岐(警告メッセージの有無)
- **TagListTable**: タグ配列を props で渡して、行数・列内容が正しく描画されることを確認

`useTagManagement` フックは TanStack Query の標準動作のため、独自テストは不要(SUPP-001 §5.5「フロントコンポーネント主要ロジックのみ」)。

### 5.2 E2E シナリオ

開発者が実機ブラウザで以下を順に実行し、すべて通ることを確認する。

```
## E2E シナリオ
1. アプリ起動後、サイドバー(または設定メニュー)から「タグ管理」をクリック
2. /tags/manage 画面が開き、初期タグ3件(使用中・練習中・頻度低下)が一覧表示される
   - カテゴリ列に "mycombo_status" が表示される
   - 色列に各色のスウォッチが表示される
   - 使用数列が "0" と表示される(M3-01 時点ではコンボへのタグ付け UI なしのため)
3. 「+ 新規作成」ボタンをクリック → ダイアログが開く
4. name="難易度A" / category="" / color="#FF0000" で「作成」ボタンクリック
5. 一覧に「難易度A」が追加される
6. 「使用中」と同じ name でタグ作成試行 → エラーメッセージ「同名のタグが既に存在します」が表示される
7. 「難易度A」の編集ボタンクリック → ダイアログが開く、name="難易度A+" に変更して「保存」
8. 一覧で名前が更新される
9. 「難易度A+」の削除ボタンクリック → 確認ダイアログ「このタグを削除しますか?」が表示される
10. 「削除」確定 → 一覧から消える
11. (検証目的で SQLite を直接編集して `combo_tags` に手動で1件登録した後)初期タグの「使用中」削除試行 → 警告ダイアログ「このタグは1件のコンボで使用中です」が表示される
12. 「キャンセル」 → 削除されない
```

これが見えるまで DoD 不達成。

---

## 6. レビュー観点(別ファイル参照)

レビュー観点は以下のチェックリストに記載する: `docs/instructions/reviews/M3-01-review-checklist.md`

製造担当 Claude Code は本ファイルを読む必要はない。本指示書本体に集中する。

---

## 7. 完了条件(Definition of Done)

### 7.1 機能要件

- [ ] §2.1 のファイル一覧が全て作成されている
- [ ] §2.2 のファイル修正が実施されている
- [ ] マイグレーション 000007 が起動時に自動実行され、user_id=1 に3タグが投入される
- [ ] タグ CRUD API(`/api/tags` 系5エンドポイント)が動作する
- [ ] タグ管理画面(`/tags/manage`)で一覧表示・新規作成・編集・削除が動作する
- [ ] §5.2 E2E シナリオが全て通過する

### 7.2 自己テスト結果(製造担当の責任範囲)

**バックエンド側**:

- [ ] `make test` または `go test ./...` が全通過する
- [ ] 主要 API を `curl` で叩き、レスポンスを報告書に貼付する:
  - `curl http://localhost:47318/api/tags` → 3タグ返却
  - `curl http://localhost:47318/api/tags?category=mycombo_status` → 3タグ返却
  - `curl http://localhost:47318/api/tags?include_usage=true` → 3タグ + usage_count=0
  - `curl -X POST http://localhost:47318/api/tags -d '{"name":"テスト","color":"#000000"}'` → 201 で作成レスポンス
  - 同一名で再 POST → 409 で VAL-T01 エラー
  - `curl -X POST http://localhost:47318/api/tags -d '{"name":""}'` → 400 で VAL-T02 エラー
- [ ] データ整合性: 登録した内容を `GET` で取り直し、入力と一致することを確認する

**フロントエンド側**:

- [ ] `cd web && pnpm test` が全通過する
- [ ] `cd web && pnpm build` が成功する
- [ ] TypeScript の型エラーが残っていない(`pnpm tsc --noEmit` 等)
- [ ] 開発サーバー起動時にコンソール警告が新規発生していない
- [ ] 開発者向けの「動作確認手順書」を実装完了報告に含める

ブラウザでの実機動作確認・画面遷移確認・スクリーンショット取得は **開発者の責任範囲**。製造担当 Claude Code はターミナル環境のため実行不可。

### 7.3 品質チェック

- [ ] CLAUDE.md の禁止事項(§10 本ルールの目的を踏まえて判断)に抵触していない
- [ ] ブラウザストレージ未使用(M3-01 では使用機会なし、CLAUDE.md §10.X 許容範囲外の使用がないことを確認)
- [ ] `console.log` / `fmt.Println` を本番コードに残していない
- [ ] 設計書本体(DES-003 §3.6 / §3.7、DES-005 §5.12、DES-006 §5)と実装が一致している
- [ ] §3.4 着手前確認の出力を実装完了報告に含めている

### 7.4 ドキュメント

- [ ] `docs/progress/progress-log.md` に M3-01 完了報告を追記する(M2 期間の記録テンプレートに従う、SUPP-001 §6.7)
- [ ] M1-05 暫定処理2(タグ列ハイフン固定表示)について「M3-01 ではタグ API のみ整備、フロント側のタグ列実データ反映は M3-02 で対応」と明記する

### 7.5 完了報告

- [ ] 開発者に「M3-01 が完了しました」と報告
- [ ] 上記 §7.1〜§7.4 の自己テスト結果を報告書に含める

---

## 8. 参照ドキュメント

| ID | パス | 関連節 |
|----|------|-------|
| CLAUDE.md | `CLAUDE.md` | §4 TypeScript 規約、§10 禁止事項、§10.X ブラウザストレージ運用ルール |
| M3-overview | `docs/instructions/M3-overview.md` | §3.1 M3-01 スコープ、§6 運用ルール |
| DES-002 | `docs/design/02-architecture.md` | §4.2 主要エンドポイント、§4.3 エラーハンドリング |
| DES-003 | `docs/design/03-data-model.md` | **§3.6 tags テーブル定義(L446-458)、§3.7 combo_tags テーブル定義(L460-467)** |
| DES-005 | `docs/design/05-screen-design.md` | **§5.12 タグ管理画面(L412-420)、§3 画面遷移図(L77 周辺)** |
| DES-006 | `docs/design/06-validation.md` | **§5 タグ編集時のバリデーション(L119-125、VAL-T01〜T03)** |
| SUPP-001 | `docs/design/supp-001-detailed-design.md` | §3.5 初期タグ生成方針、§3.6 初期データ投入方式、§5.4 / §5.5 テスト規約、§6.7 進捗管理 |
| M1-02 | `docs/instructions/M1-02-*.md` | tags / combo_tags の DDL 整備 |
| M1-03 | `docs/instructions/M1-03-*.md` | リスト API のレイヤー構成パターン |
| M2-02 | `docs/instructions/M2-02-edit-ux-improvements.md` | 重複検知 API 新設パターン(本指示書のタグ CRUD API 新設の参考) |
| playbook | `docs/handover/design-instruction-playbook.md` | 指示書テンプレート、禁則表現、設計書節照合ルール |

---

## 9. 注意事項・判断に迷ったら

### 9.1 推測で進めてはいけない事項

以下は推測で進めず、Plan Mode で開発者に確認する:

- マイグレーション 000007 が既に他用途で使用されている場合(§3.4.2 で発覚した場合)
- §3.4.1 で tags / combo_tags テーブルの DDL が DES-003 §3.6 / §3.7 と一致しない場合
- 既存 Layout.tsx のメニュー構造が指示書の想定(設定メニュー配下にタグ管理を配置)と乖離している場合
- combo_tags テーブルに `ON DELETE CASCADE` が設定されているか不明な場合(§4.2.3)

### 9.2 推測で進めてよい事項(その旨を明示)

以下は推測で進めてよいが、実装時に「推測:〜と仮定した」とコード内コメントまたは PR 説明に明示する:

- shadcn/ui の Dialog / Form / Table コンポーネント API の細部(M1 期間以降の既存利用パターンを踏襲)
- `useTagManagement` フックの内部実装詳細(TanStack Query の標準パターンに従う)
- color フィールドの色選択 UI(プルダウン or カラーピッカー、shadcn/ui の標準コンポーネント有無で判断)

### 9.3 不明事項発見時の対応

- 設計書本体(DES-003 / DES-005 / DES-006)と本指示書の記述が乖離している場合 → 実装を止めて開発者に報告し、CHANGE 通知書起票要否を協議する
- 本指示書内で曖昧と感じる箇所がある場合 → Plan Mode で停止して開発者に確認する
- 本指示書の §4 詳細仕様で具体化されていない実装判断が必要になった場合 → §9.2 の範囲なら推測で進めて明示、それ以外は §9.3 第二段で開発者確認

### 9.4 Plan Mode で計画提示時に含めるべき項目

Plan Mode を使う場合(任意)、以下を計画に含めると安全:

- §3.4 着手前確認の結果(マイグレーション番号空き、テーブル DDL 一致、user_id=1 存在)
- 実装順序(マイグレーション → モデル → リポジトリ → サービス → ハンドラ → ルート登録 → フロント API client → フック → コンポーネント)
- テスト戦略(各層のどこにテストを書くか、サービス層が網羅対象である旨)
- E2E シナリオ §5.2 の各ステップを通すための前提データ準備手順

---

## 10. 完了後の次ステップ

M3-01 完了後、開発者の動作確認・承認を経て M3-02(コンボへのタグ付け UI)に進む。M3-02 では本指示書で整備したタグ API を使い、コンボ登録・編集画面でタグを選択・新規作成・関連付けする UI を実装する。あわせて M1-05 暫定処理2(コンボ一覧のタグ列ハイフン固定表示)を解消する。

---

*以上*
