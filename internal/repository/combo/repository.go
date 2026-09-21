// Package combo はコンボに関する SQL クエリを集約する(リポジトリ層)。
//
// 設計方針:
//   - `database/sql` 標準ライブラリのみで実装(M1-03 指示書 §4.6、sqlx 等は使わない)
//   - 集約モデル: FindByID は Steps もロード、List は Steps=nil(N+1 防止、§4.11)
//   - Modifiers の DB ↔ Go 変換は本層で json.Marshal/Unmarshal(案 B、Q2 確定)
//   - 楽観的排他は version カラムで RowsAffected をチェック(M1-03 §4.5)
//   - 論理削除は deleted_at カラム、復元は deleted_at=NULL に戻す
package combo

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"strings"

	"github.com/plexiblinp/tacpendium/internal/model"
)

// ErrNotFound はコンボが見つからない場合のセンチネル。
var ErrNotFound = errors.New("combo: not found")

// ErrConflict は楽観的排他で version 不一致だった場合のセンチネル。
var ErrConflict = errors.New("combo: optimistic lock conflict")

// DuplicateKey は VAL-C02 の重複判定で「同じ状況のコンボ候補」を SQL でフィルタするキー。
//
// 注: 同等のフィールドを持つ `internal/service/validation.DuplicateKey` がサービス層側にも
// 存在するが、層独立性(リポジトリ層がサービス層を import しないこと)を確保するため意図的に
// 別定義としている。両者の変換は `internal/service/combo/deps_adapter.go` の
// `ComboDuplicateAdapter` で行う(M1-03 機械レビュー指摘・高優先の対応)。
// SUPP-001 §2.2、CHANGE-006(counter_type → hit_type)反映済み。
type DuplicateKey struct {
	CharacterID    int64
	StarterMoveID  *int64
	Position       *string
	OpponentStance *string
	HitType        *string
	OpponentSize   *string
	// StarterMeaty は始動技を持続当てしたか(M37-07・重複判定キーの 8 つ目・D-874)。
	//
	// ★★ポインタにしない。列が NOT NULL DEFAULT 0 であり「未設定」という状態が無いため、
	//   他の 5 項のような NULL 一致(`col IS NULL`)の扱いは不要である。
	//   ⇒ 述語は常に `starter_meaty = ?` になる。
	StarterMeaty bool
}

// ListFilter は List の絞り込み条件。
type ListFilter struct {
	CharacterID    *int64
	TagIDs         []int64 // 空=絞り込みなし、非空=OR 条件(いずれかのタグを持つ)
	StarterMoveIDs []int64 // 空=絞り込みなし、非空=IN 条件(始動技からの孫コンボ逆引き・確定反撃サーチ M18-02)
	Position       *string // nil=絞り込みなし
	HitType        *string // nil=絞り込みなし
	OpponentStance *string // nil=絞り込みなし
	IsDraft        *bool
	// SetupResult / SetupTechType / SetupInCorner はセットプレイ成立条件
	// (combo_setup_results)による絞り込み(M19-06)。
	//
	// ★SetupResult が nil のときは SetupTechType / SetupInCorner も効かせない。
	// 軸だけを指定しても絞り込みにはならない(「後ろ受け身の何を絞るのか」が決まらない)
	// ため、成立状態が絞り込みの入口になる(M19-06 §2.2)。
	SetupResult   *string // nil=絞り込みなし。model.SetupResultOK / NG / Unverified
	SetupTechType *string // nil=不問。model.OkiTechTypeNeutral / Back
	SetupInCorner *bool   // nil=不問
	// AffectedByGameUpdate は FR702「影響可能性あり」による絞り込み(M28-02a)。
	// nil=絞り込みなし / true=影響可能性ありのみ / false=影響なしのみ。
	// ★判定そのものは affectedByGameUpdateExprSQL と同じ 1 本を使う ——
	// 条件を書き写すと、SELECT が出す値と WHERE が絞る集合が静かにずれる。
	AffectedByGameUpdate *bool
	// StarterMeaty は始動技の持続当てによる絞り込み(M37-07・開発者裁定 2026-09-14)。
	// ★nil=絞り込みなし。★列は NOT NULL のため true/false の 2 通りだけを絞る。
	StarterMeaty *bool
	// UserID は「誰として見ているか」。コンボに紐づくタグをこの利用者のものだけへ
	// 絞るために使う(M22-02 §4.5-13＝D-405)。コンボ本体の絞り込みには使わない
	// ——コンボは全員で共有する(FR013 前半・契約 F-1)。
	UserID         int64
	IncludeDeleted bool
	OnlyDeleted    bool // true のとき deleted_at IS NOT NULL のみ返す(ゴミ箱画面用)
	// ホワイトリスト参照: "default" / "updated_at" / "damage" / "starter_move_id" / "step_count" /
	// "deleted_at"(M37-03・B01)。★値を足したら sortFieldWhitelist と本コメントの両方を直すこと。
	Sort   string
	Order  string // "asc" / "desc" / 空ならデフォルト
	Limit  int    // 0 ならデフォルト 100、上限 1000
	Offset int
}

// UpdateMetadataInput は PATCH /api/combos/:id でメタデータ部のみ更新する入力。
//
// nullable メタデータは presence-detection トライステート(CHANGE-043 / DES-002 v1.23.0 §4.2):
//   - Optional.Present=false : キー不在 = 不変更
//   - Optional.Present=true, Value==nil : NULL クリア
//   - Optional.Present=true, Value!=nil : その値で更新
//
// IsDraft は非 nullable のため NULL クリア対象外。*bool のまま(nil=不変更 / 非 nil=更新)。
type UpdateMetadataInput struct {
	IsDraft               *bool
	Damage                Optional[int]
	DriveAvailableAtStart Optional[float64]
	SAAvailableAtStart    Optional[int]
	DriveDamage           Optional[float64]
	SAGaugeConsumed       Optional[int]     // 消費 SA(0〜6・M16-02)。VAL 非連動
	DriveGaugeConsumed    Optional[float64] // 消費 drive(0〜20・0.5 刻み・M16-02)。VAL 非連動
	KnockdownAdvantage    Optional[int]
	// StartPositionMass / CarryDistanceMass は始動位置のマス数と運び量(0〜160・M28-02a)。
	// ★M37-01 で PATCH 経路へ追加した。★区分(position)はキーであり本経路では動かさない。
	StartPositionMass Optional[int]
	CarryDistanceMass Optional[int]
	// OkiVerified は起き攻めを一度でも調べたか(M27-02b)。
	// ★Optional である。省略(未指定)と false(未検証へ戻す)を区別する。
	OkiVerified Optional[bool]
	Memo        Optional[string]
	Link        Optional[string] // 外部リンク URL(M17-01)。dup/recipe 非対象
	VideoPath   Optional[string] // 動画の相対パス(M17-01)。文字列参照のみ
	ImagePath   Optional[string] // 画像の相対パス(M17-01)。文字列参照のみ
	// Situation は custom_states の格納先(JSON 文字列、CHANGE-041)。本トライステートに統一
	// (CHANGE-042 の空文字 "" センチネルを撤去。present+null=NULL クリアで custom_states あり→なしを保存)。
	Situation Optional[string]
	// OkiOptions は combo_oki_options の置き換え対象オプション列(M16-03 正規化)。
	// nil = 起き攻めを変更しない、&[]model.OkiOption{} = 全解除、値あり = 置き換え。
	// UpdateMetadata SQL では使わず、サービス層が ReplaceOkiOptions に渡す(TagIDs と同じ replace-set 方式。
	// 従来の per-field Optional[bool] merge から置換＝PATCH 意味変更・CHANGE メモ申送)。
	OkiOptions *[]model.OkiOption
	// UserID は「誰として保存するか」。タグの紐づけをこの利用者の分だけ
	// 入れ替えるために使う(M22-02 §4.5-14)。コンボ本体の所有者ではない。
	UserID int64
	// TagIDs は combo_tags の置き換え対象タグ ID 列(M3-02)。
	// nil = タグ関連を変更しない、&[]int64{} = 全解除、値あり = 置き換え。
	// UpdateMetadata SQL では使わず、サービス層が ReplaceTagAssociations に渡す。
	TagIDs *[]int64
	// SetupCarryOptions は knockdownAdvantage 変更時のセットプレイ引き継ぎ方式(M4-03)。
	// サービス層が処理する。nil = 未指定。
	SetupCarryOptions *SetupCarryOptionsInput
}

// SetupCarryOptionsInput は knockdownAdvantage 変更時のセットプレイ引き継ぎ選択肢(M4-03)。
type SetupCarryOptionsInput struct {
	Mode          string  // "carry_all" / "unlink_all" / "individual"
	CarrySetupIDs []int64 // Mode="individual" 時のみ使用
}

// Repository はコンボデータへのアクセスを提供する。
type Repository interface {
	// InsertCombo は combos に 1 行 INSERT し、新 id を返す。
	// recipe_hash は使わない(SUPP-001 §2.2 はサービス層計算値、Q1 で決定)。
	InsertCombo(ctx context.Context, tx *sql.Tx, combo *model.Combo) (int64, error)

	// InsertSteps は combo_steps に複数行 INSERT する。modifiers は json.Marshal してバインド。
	InsertSteps(ctx context.Context, tx *sql.Tx, comboID int64, steps []model.ComboStep) error

	// FindByID は指定 ID のコンボを Steps 含めて返す(2 クエリ)。
	// 戻り値の Combo.Steps は必ず非 nil(0 件のケース含む)。
	// 見つからない場合は ErrNotFound。論理削除済みコンボは返さない。
	FindByID(ctx context.Context, id int64) (*model.Combo, error)

	// FindByIDAllowDeleted は論理削除済みコンボも含めて指定 ID を返す。
	// 完全削除(PermanentDelete)の前チェックと、FindByIDAllowDeletedWithChildren が使う。
	// 子(steps / tags / okiOptions / starterMoveCode)はロードしない。
	//
	// ★deleted_at の述語を持たないのは意図である(M23-03 §4.1)。詳しい理由は
	// selectComboByIDAllowDeletedSQL の直上に書いてある。塞がないこと。
	FindByIDAllowDeleted(ctx context.Context, id int64) (*model.Combo, error)

	// FindByIDAllowDeletedTx は FindByIDAllowDeleted の tx 版(M23-04 §4.2)。
	// 復元の検証が復元と同じトランザクションの内側でコンボを読むために使う。
	FindByIDAllowDeletedTx(ctx context.Context, tx *sql.Tx, id int64) (*model.Combo, error)

	// FindByIDAllowDeletedWithChildren は FindByIDAllowDeleted に FindByID と同じ
	// 子ロード(steps / tags / okiOptions / starterMoveCode)を足して返す(M23-07 §4.2-2)。
	// ゴミ箱の行から読み取り専用のコンボ詳細を出すための経路である。
	//
	// ★コンボ行を引く SQL を新設していない。FindByIDAllowDeleted をそのまま呼び、
	// 子のロードは FindByID と共通のヘルパ(attachComboChildren)を使う。
	// ⇒ 「求めている集合が違えば入口も別に要る」(M23-06 の教訓)を守りつつ、
	// 述語の重複定義は作らない。
	FindByIDAllowDeletedWithChildren(ctx context.Context, id int64) (*model.Combo, error)

	// List は filter に合うコンボ一覧を返す。Steps はロードしない(nil)。
	// レシピ表示が必要な場合は recipe_cache を使うこと(M1-04 で埋まる)。
	List(ctx context.Context, filter ListFilter) ([]*model.Combo, error)
	// Count は filter に一致する行数を LIMIT / OFFSET を掛けずに数える。
	// List と WHERE 組み立てを共有し、ゲーム更新の影響件数(M28-02c)と
	// 一覧・書き出しの上限による切り捨て判定(M29-02 §2.1)に使う。
	Count(ctx context.Context, filter ListFilter) (int, error)

	// UpdateMetadata は PATCH 用のメタデータ更新。version で楽観的排他。
	// 戻り値は新しい version。version 不一致なら ErrConflict。
	UpdateMetadata(ctx context.Context, tx *sql.Tx, id int64, version int, input UpdateMetadataInput) (int, error)

	// SoftDelete は deleted_at を現在時刻に設定する。tx 任意。
	//
	// ★既に削除済みの行でも冪等に成功する(DES-002 §4.2 の契約。CHANGE-123・M23-03)。
	// ★M23-08 §4.4: ただし deleted_at は上書きしない。2 度目以降は最初に消した日時が
	// そのまま残る(上書きしていると利用者から見て「消した日が後ろへずれる」)。
	// 行そのものが存在しない場合だけ ErrNotFound を返す。
	SoftDelete(ctx context.Context, tx *sql.Tx, id int64) error

	// Restore は deleted_at を NULL に戻す。
	Restore(ctx context.Context, tx *sql.Tx, id int64) error

	// AdvanceBaselineVersion はコンボの基準を「現在のデータバージョン」へ進める(FR702・M28-02a)。
	//
	// ★★これが「確認した」の実体である。利用者が 1 件ずつ影響可能性を潰していける形
	// (部分消化 = 基準の持ち場をコンボ単位にした決め手。M28-overview §3.2.7 の軸 3)。
	// ★アプリは破綻も無事も自動で断定しない(FR307)。進めるのは利用者の明示操作だけである。
	// ★版数は呼び出し側から渡さない —— games から直に読む。
	//   渡せる形にすると、任意の版へ「進めた」ことにできてしまう。
	AdvanceBaselineVersion(ctx context.Context, tx *sql.Tx, id int64, gameCode string) error

	// HardDelete は combos を物理削除する。tx 内で実行すること。
	// 呼び出し前に deleted_at IS NOT NULL であることをサービス層で確認すること。
	//
	// ★M23-08 §4.1: 子表は ON DELETE CASCADE に任せず、すべて明示的に削除する。
	// M23-08 当時は PRAGMA foreign_keys が接続単位であり、FK=OFF の接続では CASCADE が
	// 発火しなかった(P-04)。旧 godoc は「combo_steps は ON DELETE CASCADE で自動削除
	// される」と書いていたが、同じ関数の実装コメントが正反対を書いており失効していた。
	// ★M23-10 で db.Open 経由の接続はすべて FK=ON になり CASCADE も発火するように
	// なったが、明示削除は撤去せず二重の保険として残す(撤去は M23-10 の判断事項ではない)。
	//
	// ★★combos の子表を新設したら、本メソッドへ明示削除を足すこと。足し忘れは
	// hard_delete_children_test.go(スキーマから子表を列挙する)が検出する。
	//
	// ★combos 自身を指す self-FK(materialized_from_combo_id /
	// superseded_by_combo_id)は削除ではなく NULL 化する。参照している行は独立した
	// 利用者のコンボであり、消してはならない。
	HardDelete(ctx context.Context, tx *sql.Tx, id int64) error

	// FindStepsForCombos はバルク取得。複数コンボの combo_steps をまとめて取得する。
	// recipe_hash 重複判定で候補各々の steps を一括ロードする用途。
	FindStepsForCombos(ctx context.Context, comboIDs []int64) (map[int64][]model.ComboStep, error)

	// FindActiveByDuplicateKey は VAL-C02 の候補(同一キーの published コンボ)を返す。
	// recipe_hash 比較は呼び出し側で行う。引数の DuplicateKey はリポジトリ層独自定義で、
	// サービス層の `validation.DuplicateKey` とは別の型(層独立性のため)。
	// ★M24-11: tx を取る。nil なら *sql.DB(runner が振り分ける)。
	// 登録と同じトランザクションの内側で判定するために要る——*sql.DB で読むと
	// 未コミットの行が見えず、tx の内側へ移した意味が無くなる(SUPP-001 §7.1.1-2)。
	FindActiveByDuplicateKey(ctx context.Context, tx *sql.Tx, key DuplicateKey) ([]model.Combo, error)

	// FindDeletedByDuplicateKey は VAL-C14(ゴミ箱に同じものがある)の候補を返す(M23-05 §4.4)。
	// recipe_hash 比較は呼び出し側で行う——FindActiveByDuplicateKey と同じ 2 段である。
	//
	// ★★FindActiveByDuplicateKey の述語を反転しただけの関数ではない。母集団が 3 点で違う。
	//   (a) deleted_at IS NOT NULL —— ゴミ箱に居る行だけを見る。
	//   (b) superseded_by_combo_id IS NULL —— PUT が積んだ旧行を除く(M23-05 §4.2)。
	//       旧行はゴミ箱の一覧に出ず(M23-01)利用者が復元できないため、告げても対処できない。
	//       さらに、キーを変えない PUT の旧行は新行と同じキー + 同じレシピを持ったまま
	//       ゴミ箱へ入るため、除かないと似たコンボを作るたびに警告が出る。
	//   (c) is_draft = 0 は据え置き —— 仮登録は重複判定の対象外(DES-006 §2.3)。
	// ★VAL-C02 の FindActiveByDuplicateKey とは統合しないこと。求める集合が正反対である。
	FindDeletedByDuplicateKey(ctx context.Context, key DuplicateKey) ([]model.Combo, error)

	// FindActiveByDuplicateKeyExcludingTx は VAL-R03(復元したら生きた重複が居た)の候補を返す
	// (M23-05 §4.4)。復元と同じトランザクションの内側から読むため tx を取る。
	//
	// ★★excludeComboID は「復元しようとしている行そのもの」である。復元は deleted_at を
	//   NULL に戻してから検証するため(M23-04 §4.2)、除外しないと自分が自分の重複相手になり
	//   必ず 1 件ヒットする。★ここを落とすと全件で誤検知する。
	//
	// ★★superseded_by_combo_id IS NULL を **意図的に置いていない**(M23-05 レビュー 高-3)。
	//   指示書 §4.2 の散文は「VAL-C14 と VAL-R03 の母集団から旧行を除く」と書くが、
	//   §4.4 の表の VAL-R03 行にはその述語が無い。**指示書の内部矛盾であり、§4.4 を採った。**
	//   理由: (a) §4.2 が挙げる 2 つの根拠——「旧行はゴミ箱の一覧に出ず利用者が復元できない」
	//   「PUT のたびに警告が出る」——は、どちらも**削除済みを見る母集団**にしか当てはまらない。
	//   (b) 本問い合わせの母集団は deleted_at IS NULL であり、PUT が積んだ旧行は論理削除
	//   済みなので原理的に入らない。入りうるのは「隠された旧行を API 直叩きで復元した」
	//   場合だけで、そのとき旧行は**画面に見えている生きたコンボ**である。
	//   ⇒ 述語を足すと、見えている重複を黙って見逃す偽陰性になる。
	//   ★裁定は設計卓の手番(CHANGE-125)。完了報告 §4.2 に報告済み。
	FindActiveByDuplicateKeyExcludingTx(ctx context.Context, tx *sql.Tx, key DuplicateKey, excludeComboID int64) ([]model.Combo, error)

	// UpdateSetupReferences は combo_setups の combo_id を付け替える。
	// PUT(キー変更編集)で旧コンボから新コンボへセットプレイ紐付けを引き継ぐ用途。
	UpdateSetupReferences(ctx context.Context, tx *sql.Tx, oldComboID, newComboID int64) error

	// MovePunishReferences は確定反撃の採用(combo_punishes)と curation(combo_punish_curations)の
	// combo_id を旧→新へ付け替える(M18-03b §4.6・裁定11)。識別キー変更編集で採用が silent に
	// 消える課題(followup §I-(b))の解消。UpdateSetupReferences と同型＝キー変更トランザクション内の
	// 子テーブル FK 再ポイント。opponent_move_id・note は不変。
	MovePunishReferences(ctx context.Context, tx *sql.Tx, oldComboID, newComboID int64) error

	// MoveSetupResultReferences はセットプレイ成立条件の検証結果(combo_setup_results)の
	// combo_id を旧→新へ付け替える(M19-03 §4.2)。MovePunishReferences と同型。
	// ON UPDATE CASCADE が先に効くため通常は no-op になる。M19-03 当時はプール内に
	// FK=OFF の接続が混在する実測があり(P-04)、明示併用が必須だった。M23-10 で
	// 全接続が FK=ON になった後も、二重の保険として明示的に併用する。
	// 必ず UpdateSetupReferences の「後」に呼ぶこと(先に呼ぶと FK 違反になる)。
	MoveSetupResultReferences(ctx context.Context, tx *sql.Tx, oldComboID, newComboID int64) error

	// InsertPunish は materialize 生成物に確定反撃の採用(combo_punishes)を 1 行作る(M18-03b §4.4)。
	// materialize と同一トランザクションで実行するため tx を取る。punish 側 addPunishSQL と同じ
	// ON CONFLICT DO UPDATE 挙動に揃える(新規 combo_id では衝突しないが表記揺れを避ける)。
	InsertPunish(ctx context.Context, tx *sql.Tx, comboID, opponentMoveID int64, note *string) error

	// RemovePunishLink は指定 (combo_id, opponent_move_id) の採用(combo_punishes)と
	// 同キーの curation(combo_punish_curations)を削除する(M18-03b §5.3-A/§1.1)。
	// materialize が基底コンボの採用を「入力キューから処理済みにする」ために同一 Tx から呼ぶ。
	// punish 側 RemovePunish と同じくペアで削除する(採用が消えた組に curation だけ残る孤児を防ぐ)。
	// 対象が無ければ 0 行削除(冪等・探す画面孫ツリー経由の未採用変換では no-op)。
	RemovePunishLink(ctx context.Context, tx *sql.Tx, comboID, opponentMoveID int64) error

	// DeleteComboSetupsByComboID はコンボのセットプレイ紐付けを解除する(M4-03)。
	//
	// ★M23-08 §4.5: 解除するのは「生きたセットプレイ」の紐付けだけである。論理削除された
	// セットプレイの紐付けは残す —— 引き継ぎの選択肢を作る読み取りが削除済みを見せて
	// おらず、利用者が選びようがないため。詳細は liveSetupScope の godoc を参照。
	DeleteComboSetupsByComboID(ctx context.Context, tx *sql.Tx, comboID int64) error

	// DeleteComboSetupsByComboIDExcluding は指定 setup ID 以外の紐付けを解除する(M4-03)。
	// 解除の範囲は DeleteComboSetupsByComboID と同じく生きたセットプレイの紐付けだけ。
	DeleteComboSetupsByComboIDExcluding(ctx context.Context, tx *sql.Tx, comboID int64, keepSetupIDs []int64) error

	// CountComboSetupsByComboID はコンボに紐付く setup 数を返す(M4-03)。
	//
	// ★数えるのは生きた(deleted_at IS NULL)セットプレイの紐付けだけである
	// (M23-02・D-491)。★M23-08 §4.5 以降、本メソッドの値域が引き継ぎ全体の基準に
	// なっている —— 解除側(DeleteComboSetupsByComboID / ...Excluding)も同じ範囲へ
	// 揃えたため、ここを広げると解除の範囲も一緒に広がる。
	CountComboSetupsByComboID(ctx context.Context, comboID int64) (int, error)

	// --- M1-04: recipe_cache カラム操作 ---

	// GetRecipeCache は combos.recipe_cache を返す。NULL の場合は (*string)(nil)。
	// 論理削除済みコンボは対象外で ErrNotFound を返す(M23-03 §4.2)。
	GetRecipeCache(ctx context.Context, comboID int64) (*string, error)

	// UpdateRecipeCache は recipe_cache を更新する���非 tx、遅延計算用）。
	// updated_at も更新するが version はインクリメントしない（キャッシュは排他対象外）。
	UpdateRecipeCache(ctx context.Context, comboID int64, cacheJSON string) error

	// UpdateRecipeCacheTx は recipe_cache を tx 内で更新する。
	// updated_at は更新しない（呼び出し元の tx で既に管理されているため）。
	UpdateRecipeCacheTx(ctx context.Context, tx *sql.Tx, comboID int64, cacheJSON string) error

	// SetRecipeCacheNullTx は recipe_cache を NULL に設定する（論理削除時）。
	SetRecipeCacheNullTx(ctx context.Context, tx *sql.Tx, comboID int64) error

	// ListAllActiveCombosTx は deleted_at IS NULL の全コンボを返す。Steps はロードしない。
	// tx が nil なら DB ハンドルで読む。
	//
	// ★M20-05(§4.4-4・D-360)で tx を取る形へ変えた。呼出元(RecomputePresetCache /
	// DeletePresetCache)がいずれもトランザクション内で recipe_cache を書くため、
	// 読みだけ tx の外に置くと同一トランザクション内で別スナップショットを見ることになる。
	ListAllActiveCombosTx(ctx context.Context, tx *sql.Tx) ([]*model.Combo, error)

	// ReplaceTagAssociations は combo_id に紐付く combo_tags を tagIDs で置き換える(M3-02)。
	// tagIDs が空の場合、既存関連を全削除する。tx は呼び出し側のトランザクションを受け取る。
	// FK 制約違反(存在しないタグ ID)の場合はエラーを返す。
	ReplaceTagAssociations(ctx context.Context, tx *sql.Tx, comboID, userID int64, tagIDs []int64) error

	// ReplaceOkiOptions は combo_id に紐付く combo_oki_options を opts で置き換える(M16-03)。
	// opts が空の場合、既存の起き攻めオプションを全削除する。tx は呼び出し側のトランザクションを受け取る。
	// combo_tags と同じ delete-all-then-insert 方式。sparse: 行の存在＝そのオプションが成立する。
	ReplaceOkiOptions(ctx context.Context, tx *sql.Tx, comboID int64, opts []model.OkiOption) error

	// FindOkiOptionsByComboID は単一コンボの combo_oki_options を返す(詳細取得用)。
	// 戻り値は必ず非 nil(0 件は空スライス)。
	FindOkiOptionsByComboID(ctx context.Context, comboID int64) ([]model.OkiOption, error)

	// FindOkiOptionsForCombos はバルク取得。複数コンボの combo_oki_options をまとめて返す(一覧用)。
	// 戻り値は combo_id → []OkiOption のマップ。
	FindOkiOptionsForCombos(ctx context.Context, comboIDs []int64) (map[int64][]model.OkiOption, error)

	// FindStepsByComboIDTx は tx 内で combo_steps を取得する（moves.code JOIN 含む）。
	// RecomputeComboCache が未コミットの steps を読み取る用途。
	FindStepsByComboIDTx(ctx context.Context, tx *sql.Tx, comboID int64) ([]model.ComboStep, error)
}

// repository は Repository の sql.DB ベース実装。
type repository struct {
	db *sql.DB
}

// New は Repository を構築する。
func New(db *sql.DB) Repository {
	return &repository{db: db}
}

// ---------------------------------------------------------------------------
// InsertCombo / InsertSteps
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// SELECT 句の共有(★scanCombo の Scan 順と 1 対 1)
// ---------------------------------------------------------------------------

// affectedByGameUpdateExprSQL は FR702「影響可能性あり」の判定(M28-02a)。
//
// ★★保存せず導出する(checklist §5.1 確定事項 3)。⇒ 影響コンボを持つ表を作らない。
// ★★判定は「そのコンボが使っている move のうち、マーカーがコンボの基準より新しいものが
//
//	1 つでもあるか」である。飛ばし更新でも「基準 < 最終変更」で正しく出る。
//
// ★combo_steps を経由する。JOIN moves ON m.id = cs.move_id により、move_id が NULL の
//
//	ステップ(非技ステップ)は構造的に判定へ入らない(DES-003 §3.5 の taxonomy)。
//
// ★★NULL の向きは安全側である(指示書 §2.3-3 / FR307 と同じ向き)。
//   - 基準が NULL = 「いつの前提か分からない」⇒ 影響可能性ありに出す。出し漏らさない。
//   - マーカーが NULL = 「まだ一度も変わっていない」という既知の状態(D-725)⇒ 影響なし。
//     ★これは「不明」ではない。2 つを混同しないこと。
//
// ★比較は単純な `>` でよい。`YYYY.MM.DD.NN` は全フィールドが固定幅のゼロ埋めであり、
//
//	TEXT の辞書順が時系列順と一致する(D-728)。⇒ 順序用の列は要らない。
//	★同値は「新しい」ではない ⇒ 基準と同じマーカーは出さない。

// affectedMoveCondSQL は「1 本の move が、そのコンボの基準より後に変わったか」を表す
// 行レベルの述語である。
//
// ★★★ FR702 の判定の中身は本定数にしか無い。⇒ EXISTS(真偽)も、列挙(affectedMoves)も、
// 総数(Count)も、すべてここから組む。書き写した瞬間に「表示と絞り込みが静かにずれる」
// 状態が作れてしまい、しかも普通のテストデータでは両方が同じ答えを返して緑で通る
// (M28-02c チェックリスト §0.4-1)。
//
// ★本述語は m(moves)と combos の 2 つの別名がスコープに居ることを前提とする。
// ⇒ 使う側は必ず combo_steps 経由で moves と combos の両方を join すること。
//
// ★構造での担保: repository_affected_moves_source_test.go が本パッケージの非テストコードを
// go/ast で走査し、last_changed_game_version を含む文字列リテラルが本定数の 1 本しか
// 無いことを主張する。⇒ 式が 2 本ある状態はコンパイルは通ってもテストで赤になる。
const affectedMoveCondSQL = `m.last_changed_game_version IS NOT NULL
          AND (combos.baseline_version IS NULL
               OR m.last_changed_game_version > combos.baseline_version)`

const affectedByGameUpdateCondSQL = `EXISTS (
        SELECT 1 FROM combo_steps cs
        JOIN moves m ON m.id = cs.move_id
        WHERE cs.combo_id = combos.id
          AND ` + affectedMoveCondSQL + `
    )`

// affectedByGameUpdateExprSQL は上の判定式に SELECT 用の別名を付けたもの。
// ★WHERE では別名の付かない affectedByGameUpdateCondSQL を使う。
// ★★2 つに割ってあるのは形式上の都合であり、判定の中身は 1 か所しかない。
const affectedByGameUpdateExprSQL = affectedByGameUpdateCondSQL + ` AS affected_by_game_update`

// comboSelectSQL は combos を読む全クエリが共有する SELECT 句と FROM。
//
// ★★列の並びは scanCombo の Scan 順に一致していること。
// ★★M28-02a まで、この同じ列並びが 6 か所へ写しとして置かれていた
//
//	(FindByID / FindByIDAllowDeleted / List / FindActiveByDuplicateKey /
//	 duplicateKeySelectSQL / ListAllActiveCombosTx)。
//	baseline_version と FR702 の判定式を足すにあたり 1 か所へまとめた
//	—— 6 か所のうち 1 か所でも写し忘れると Scan 順がずれ、
//	**エラーにならずに違う列を読む**(型が合ってしまう組が実在する)。
const comboSelectSQL = `
SELECT
    id, character_id, is_draft, damage,
    drive_available_at_start, sa_available_at_start, drive_damage,
    sa_gauge_consumed, drive_gauge_consumed,
    starter_move_id,
    position, opponent_stance, hit_type, opponent_size,
    starter_meaty,
    situation,
    knockdown_advantage, oki_verified, memo,
    link, video_path, image_path,
    step_count,
    recipe_cache,
    version, created_at, updated_at, deleted_at,
    materialized_from_combo_id,
    superseded_by_combo_id,
    baseline_version,
    start_position_mass, carry_distance_mass,
    ` + affectedByGameUpdateExprSQL + `
FROM combos`

// insertComboSQL は combos への INSERT。
//
// ★★baseline_version(FR702 の基準)は COALESCE で入れる —— 呼び出し側が nil を渡せば
// 「その時点の games.current_data_version」が構造的に入る(M28-02a)。
//
// ★★サービス層で埋める形にしなかった理由は先例である。
//
//	`materialize-bypasses-required-fields`(followup): Materialize が
//	ValidateComboForCreate を通さないため、必須 4 欄が空のままの本登録コンボが在りうる。
//	⇒ 「登録経路が N 本ある」ものを呼び出し側の責務にすると、経路が 1 本増えたときに
//	  静かに抜ける。基準が抜けると そのコンボは永久に「影響可能性あり」側へ出続ける。
//
// ★★M28-overview §3.2.7 も同じことを言っている ——
//
//	「1 回きりの backfill は後から INSERT される行を拾わない。⇒ 登録経路が基準を書くことを、
//	  同じ手番で必ず実装すること。片方だけだと静かに壊れる。」
//	本 INSERT が唯一の登録経路であるため、ここへ置けば全経路が満たされる。
//
// ★明示的に値を渡す経路もある(CSV 取込の復元など、当時の基準を保ちたい場合)。
//
//	その場合は COALESCE の第 1 引数が採られる。
const insertComboSQL = `
INSERT INTO combos (
    character_id, is_draft, damage,
    drive_available_at_start, sa_available_at_start, drive_damage,
    sa_gauge_consumed, drive_gauge_consumed,
    starter_move_id,
    position, opponent_stance, hit_type, opponent_size,
    starter_meaty,
    situation,
    knockdown_advantage, oki_verified, memo,
    link, video_path, image_path,
    step_count,
    recipe_cache,
    version,
    materialized_from_combo_id,
    superseded_by_combo_id,
    baseline_version,
    start_position_mass, carry_distance_mass
) VALUES (
    ?, ?, ?,
    ?, ?, ?,
    ?, ?,
    ?,
    ?, ?, ?, ?,
    ?,
    ?,
    ?, ?, ?,
    ?, ?, ?,
    ?,
    ?,
    ?,
    ?,
    ?,
    COALESCE(?, (SELECT current_data_version FROM games WHERE code = 'sf6')),
    ?, ?
)`

func (r *repository) InsertCombo(ctx context.Context, tx *sql.Tx, combo *model.Combo) (int64, error) {
	exec := r.runner(tx)
	result, err := exec.ExecContext(ctx, insertComboSQL,
		combo.CharacterID, combo.IsDraft, combo.Damage,
		combo.DriveAvailableAtStart, combo.SAAvailableAtStart, combo.DriveDamage,
		combo.SAGaugeConsumed, combo.DriveGaugeConsumed,
		combo.StarterMoveID,
		combo.Position, combo.OpponentStance, combo.HitType, combo.OpponentSize,
		combo.StarterMeaty,
		combo.Situation,
		combo.KnockdownAdvantage, combo.OkiVerified, combo.Memo,
		combo.Link, combo.VideoPath, combo.ImagePath,
		combo.StepCount,
		combo.RecipeCache,
		combo.Version,
		combo.MaterializedFromComboID,
		combo.SupersededByComboID,
		combo.BaselineVersion,
		combo.StartPositionMass, combo.CarryDistanceMass,
	)
	if err != nil {
		return 0, fmt.Errorf("insert combo: %w", err)
	}
	id, err := result.LastInsertId()
	if err != nil {
		return 0, fmt.Errorf("last insert id: %w", err)
	}
	return id, nil
}

const insertStepSQL = `
INSERT INTO combo_steps (combo_id, step_order, move_id, modifiers)
VALUES (?, ?, ?, ?)`

func (r *repository) InsertSteps(ctx context.Context, tx *sql.Tx, comboID int64, steps []model.ComboStep) error {
	if len(steps) == 0 {
		return nil
	}
	exec := r.runner(tx)
	for _, step := range steps {
		modJSON, err := marshalModifiers(step.Modifiers)
		if err != nil {
			return fmt.Errorf("marshal modifiers: %w", err)
		}
		if _, err := exec.ExecContext(ctx, insertStepSQL,
			comboID, step.StepOrder, step.MoveID, modJSON,
		); err != nil {
			return fmt.Errorf("insert step %d: %w", step.StepOrder, err)
		}
	}
	return nil
}

// ---------------------------------------------------------------------------
// FindByID
// ---------------------------------------------------------------------------

const selectComboByIDSQL = comboSelectSQL + `
WHERE id = ? AND deleted_at IS NULL`

func (r *repository) FindByID(ctx context.Context, id int64) (*model.Combo, error) {
	combo, err := r.scanCombo(ctx, r.db.QueryRowContext(ctx, selectComboByIDSQL, id))
	if err != nil {
		return nil, err
	}
	return r.attachComboChildren(ctx, combo)
}

// attachComboChildren は単体詳細向けの子ロード(steps / tags / okiOptions /
// starterMoveCode)をまとめて行う。
//
// ★FindByID と FindByIDAllowDeletedWithChildren の両方から呼ぶ(M23-07 §4.2-2)。
// 生存行と削除済み行で「詳細として揃えるもの」は同じであり、2 か所に書くと
// 片方だけ育って乖離する(E-76)。母集団の違いはコンボ行を引く SQL の側だけに置く。
//
// ★本ヘルパは DB へ書き込まない(読み取りのみ)。
func (r *repository) attachComboChildren(ctx context.Context, combo *model.Combo) (*model.Combo, error) {
	id := combo.ID

	steps, err := r.findStepsByComboID(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("find steps: %w", err)
	}
	combo.Steps = steps

	tagMap, err := r.findTagsByComboIDs(ctx, []int64{id})
	if err != nil {
		return nil, fmt.Errorf("find tags: %w", err)
	}
	if tags, ok := tagMap[id]; ok {
		combo.Tags = tags
	} else {
		combo.Tags = []model.Tag{}
	}

	okiOpts, err := r.FindOkiOptionsByComboID(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("find oki options: %w", err)
	}
	combo.OkiOptions = okiOpts

	// starterMoveCode 補完(M15-05/FB②)。List 経路(findMoveCodesByIDs)と同じ
	// 名称解決を単体詳細でも行う。これを省くと詳細エンドポイント経由の比較画面で
	// starterMoveCode が空となり「始動技#<id>」の生 ID 表示になる。
	if combo.StarterMoveID != nil {
		labelMap, err := r.findMoveLabelsByIDs(ctx, []int64{*combo.StarterMoveID})
		if err != nil {
			return nil, fmt.Errorf("find starter move label: %w", err)
		}
		if label, ok := labelMap[*combo.StarterMoveID]; ok {
			code := label.Code
			combo.StarterMoveCode = &code
			combo.StarterMoveNameJa = label.NameJa
		}
	}

	// FR702「変わった技」の注入(M28-02c)。★詳細の 2 面(通常詳細 / ゴミ箱詳細)と、
	// 書き込み系が最後に通る FindByID がすべてここを通る。⇒ 応答から affectedMoves が
	// 落ちる経路を作らない。
	if err := r.attachAffectedMoves(ctx, []*model.Combo{combo}); err != nil {
		return nil, fmt.Errorf("attach affected moves: %w", err)
	}
	return combo, nil
}

// selectComboByIDAllowDeletedSQL は論理削除済みの行も返す。
//
// ★★deleted_at の述語が無いのは書き漏らしではなく仕様である(M23-03 §4.1)。
// 「ゴミ箱にある行を引くこと」がこの SQL の目的であり、述語を足すと壊れる。
// 残す理由は 2 つある:
//
//  1. 完全削除の前チェック(service/combo.PermanentDelete)が、消そうとしている行が
//     実在するか・本当にゴミ箱にあるかを確かめるために削除済みの行を読む必要がある。
//  2. ゴミ箱の行からの読み取り専用詳細(DES-005 §5.15「行クリック → 詳細表示」)が
//     FindByIDAllowDeletedWithChildren 経由でここを引く(M23-07 §4.2-2 で配線済み)。
//
// ★塞いだ瞬間に壊れるのは完全削除であり、通常操作のテストには出ない
// (削除・復元・一覧はいずれも別の SQL を通るため全部緑のまま通る)。
// 関数名 FindByIDAllowDeleted に意図を出してあるのはセットプレイ側と同じ流儀
// (internal/repository/setup/restore.go の selectSetupByIDAllowDeletedSQL)。
const selectComboByIDAllowDeletedSQL = comboSelectSQL + `
WHERE id = ?`

func (r *repository) FindByIDAllowDeleted(ctx context.Context, id int64) (*model.Combo, error) {
	combo, err := r.scanCombo(ctx, r.db.QueryRowContext(ctx, selectComboByIDAllowDeletedSQL, id))
	if err != nil {
		return nil, err
	}
	return combo, nil
}

// FindByIDAllowDeletedTx は FindByIDAllowDeleted の tx 版。
// 復元の検証(M23-04 §4.2)が復元と同じトランザクションの内側で読むために使う。
// ★述語を持たないのは上と同じ理由である。復元直後は deleted_at が NULL に戻る途中
// (未コミット)であり、生存だけを見る述語を足すと自分で自分を見失う。
func (r *repository) FindByIDAllowDeletedTx(ctx context.Context, tx *sql.Tx, id int64) (*model.Combo, error) {
	combo, err := r.scanCombo(ctx, r.runner(tx).QueryRowContext(ctx, selectComboByIDAllowDeletedSQL, id))
	if err != nil {
		return nil, err
	}
	return combo, nil
}

// FindByIDAllowDeletedWithChildren はゴミ箱の読み取り専用詳細用(M23-07 §4.2-2)。
//
// ★新しい取得処理を作っていない。母集団は FindByIDAllowDeleted に任せ、
// 子は FindByID と共通の attachComboChildren を使う。
// ★combo_steps は論理削除で消えないため(SoftDelete は combos の 1 行しか触らない)、
// 削除済みコンボでも steps は揃う。レシピ文字列の組み立てはサービス層が行う。
func (r *repository) FindByIDAllowDeletedWithChildren(ctx context.Context, id int64) (*model.Combo, error) {
	combo, err := r.FindByIDAllowDeleted(ctx, id)
	if err != nil {
		return nil, err
	}
	return r.attachComboChildren(ctx, combo)
}

const selectStepsByComboIDSQL = `
SELECT
    cs.id, cs.combo_id, cs.step_order, cs.move_id, cs.modifiers,
    m.code AS move_code
FROM combo_steps cs
LEFT JOIN moves m ON cs.move_id = m.id
WHERE cs.combo_id = ?
ORDER BY cs.step_order`

func (r *repository) findStepsByComboID(ctx context.Context, comboID int64) ([]model.ComboStep, error) {
	rows, err := r.db.QueryContext(ctx, selectStepsByComboIDSQL, comboID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	steps := make([]model.ComboStep, 0)
	for rows.Next() {
		step, err := scanStep(rows)
		if err != nil {
			return nil, err
		}
		steps = append(steps, step)
	}
	return steps, rows.Err()
}

// ---------------------------------------------------------------------------
// List
// ---------------------------------------------------------------------------

// sortFieldWhitelist はソートパラメータと SQL カラム式のマッピング。
// SQL injection 対策のため、ここに登録されたフィールドのみ ORDER BY に使用する。
var sortFieldWhitelist = map[string]string{
	"default":         "starter_move_id ASC, position ASC, hit_type ASC, opponent_stance ASC, opponent_size ASC",
	"updated_at":      "updated_at",
	"damage":          "damage",
	"step_count":      "step_count",
	"starter_move_id": "starter_move_id",
	// M37-03(B01): ゴミ箱の並びに使う。明示 sort でも指定できるようにしてある
	// (画面の並び替え UI は足していない＝開発者判断 2026-09-13。指示書 §2.2-3)。
	"deleted_at": "deleted_at",
}

// trashDefaultOrderClause はゴミ箱(only_deleted)の既定の並び(M37-03・B01)。
//
// ★★「削除日時の表示」ではなく「並び順」の要求である(指示書 §0.3)。
//
// 着手前の実測: ゴミ箱のコンボ側は sort を送らないため resolveSortClause の default 分岐へ落ち、
// `starter_move_id ASC, position ASC, ...` ——つまり **削除日時と無関係な始動状況順**で並んでいた。
// 一方セットプレイ側(repository/setup/restore.go)は当初から `deleted_at DESC, id DESC` であり、
// 同じ画面の 2 つの表が食い違っていた。⇒ コンボ側を揃える。
//
// ★id DESC の副次キーは同値行の全順序を確定させるためである。deleted_at は datetime('now')
// の **秒精度**であり、同じ秒に消した 2 行は日時だけでは順序が決まらない。
const trashDefaultOrderClause = "deleted_at DESC, id DESC"

// resolveListSortClause は ListFilter から ORDER BY 句を決める(M37-03・B01)。
//
// ★ゴミ箱(OnlyDeleted)で **sort が指定されていないときだけ** 既定を削除日時降順へ差し替える。
// 明示された sort は従来どおり優先する ——whitelist に在る値なら resolveSortClause がそれを返す。
//
// ★★`sort=default` は「明示指定」として扱う(M37-03 レビュー 中-2 で確認した挙動)。
// ⇒ ゴミ箱で `sort=default` を送ると始動状況順に戻る。**これは意図どおりである**
// ——`default` は whitelist の 1 エントリであり「始動状況順で並べてくれ」という
// 明示の要求だからである(一覧の並び替えで「始動状況順」を選ぶと同じ値が飛ぶ)。
// ★現時点でゴミ箱の画面は sort を一切送らないため実害は無い。将来ゴミ箱へ並び替え UI を
// 足すときは、この挙動を踏まえること ——「既定へ戻す」操作に `sort=default` を使うと
// 削除日時降順ではなく始動状況順になる。
// ★TestList_TrashSortDefaultIsTreatedAsExplicit が本挙動を固定している。
func resolveListSortClause(filter ListFilter) string {
	if filter.OnlyDeleted {
		if _, ok := sortFieldWhitelist[filter.Sort]; !ok {
			return trashDefaultOrderClause
		}
	}
	return resolveSortClause(filter.Sort, filter.Order)
}

func resolveSortClause(field, order string) string {
	sqlExpr, ok := sortFieldWhitelist[field]
	if !ok {
		return sortFieldWhitelist["default"] + ", id ASC"
	}
	if field == "default" {
		return sqlExpr + ", id ASC"
	}
	dir := "DESC"
	if order == "asc" {
		dir = "ASC"
	}
	// id 副次キーで全順序を確定させる。同値行の順序が SQL 上未規定のままだと
	// LIMIT/OFFSET のページ境界で重複・欠落が起こりうる(B9)。
	return sqlExpr + " " + dir + ", id " + dir
}

// setupResultCellCount は軸の指定から「対象セルの数」を返す(M19-06)。
//
// セルは (tech_type, in_corner) の組で、軸を指定するとその軸が 1 値に固定される。
// 不問なら値域の広さぶんだけセルが増える —— tech_type は model.OkiTechTypes、
// in_corner は真偽値の 2 値である。
//
// ★unverified の判定に使う(「未記録のセルが 1 つ以上あるか」を
// 「記録済みセル数 < 対象セル数」で表すため)。値域の広さに結び付く唯一の箇所なので、
// tech_type を増やすときは model.OkiTechTypes を直せば自動で追随する。
func setupResultCellCount(techType *string, inCorner *bool) int {
	n := 1
	if techType == nil {
		n *= len(model.OkiTechTypes)
	}
	if inCorner == nil {
		n *= 2 // in_corner は真偽値の 2 値
	}
	return n
}

// setupResultWhere は成立条件(combo_setup_results)による絞り込みの WHERE 断片と
// バインド引数を返す(M19-06 §2.1)。
//
// # 判定の単位は「セル」である(開発者裁定 2026-08-09)
//
// セル = (tech_type, in_corner) の組で、2×2 の 4 通り。軸を指定すると対象セルが
// 絞られ、不問なら対象セルが増える。★3 つの状態は「対象セルのいずれかで成り立つか」
// を問う —— つまり「不問」は各セルの答えの OR である。
//
//	ok         : いずれかの対象セルに result='ok' の行がある。
//	             ★同じセルで複数セットプレイの一部が ng でも、1 つでも ok があれば該当する
//	             (EXISTS 意味論・§2.1 (a))。セットプレイは選択肢であり、1 つ成立すれば
//	             その状況に対応できるため。
//	ng         : いずれかの対象セルが「ng の行があり、かつ ok の行が 1 つも無い」。
//	             ★セルごとに判定する。ok の単純な否定ではない
//	             (否定にすると unverified と圏外を巻き込む)。
//	unverified : セットプレイを 1 つ以上持ち、対象セルのうち 1 つ以上に行が無い。
//	             ★「行が無い」を「不成立」と読み替えない(DES-003 §3.19 / CHANGE-087 §2-d)。
//
// # なぜセル単位なのか(当初はコンボ単位で評価していた)
//
// 当初はセルを問わず 1 回だけ問う形だった(「ng の行がどこかにあり、ok の行がどこにも
// 無い」)。この形だと ★軸の「不問」が単調でない —— ng と unverified は否定を含む述語
// なので、対象セルを広げると該当しにくくなり、「全て」が最も狭くなる。実機確認で
// 「不成立 × 画面端=全て → 0 件 / 画面中央 → 1 件」「未検証 × 受け身=全て → 1 件 /
// 後ろ受け身 → 3 件」の 2 例が観測された。
//
// セル単位にすると 3 値とも単調増加になり、「全て」は個別に選んだ結果の和集合になる。
// ★代償として 3 値は排他でなくなる(画面端では成立し画面中央では不成立のコンボは
// ok にも ng にも出る)。これは実態そのままであり、説明可能な状態である。
//
// ★セルを (setup_id, tech_type, in_corner) 単位にはしない。あるセットプレイが ok・
// 別が ng のコンボが ng にも出るようになり、§2.1 (a) の EXISTS 意味論と矛盾するため。
//
// # 変わらない性質
//
// ★軸を両方指定したときは対象セルが 1 つに定まるため、コンボ単位で評価していた頃と
// 結果が完全に一致する。★ok は元から EXISTS のみで単調だったため、軸の指定によらず
// 結果が変わらない(EXISTS はセルの OR に対して分配的)。
//
// ★セットプレイを 1 つも持たないコンボは 3 値のどれにも該当しない(§2.1 (c))。
// ok / ng は結果行の存在が組の存在を含意するので構造的に外れ、unverified は
// 「セットプレイを 1 つ以上持つ」を明示の EXISTS で要求することで外す。
// 「該当なし(圏外)」と「未検証」を混ぜると、後からどちらだったのか復元できない。
//
// ★論理削除された setups は 3 述語すべてから除外する(開発者裁定 2026-08-09)。
// setups の SoftDelete は combo_setups の行を消さないため、除外しないと画面上
// 「セットプレイが無い」コンボが unverified に出る/削除済みセットプレイの ok で
// 拾われる、という食い違いが起きる。詳細取得(setup リポジトリの
// ListSetupsByComboIDs)が s.deleted_at IS NULL で見せているのと同じ基準に揃える。
// 論理削除された「コンボ」の扱いは従来どおり IncludeDeleted / OnlyDeleted に従う。
func setupResultWhere(state string, techType *string, inCorner *bool) (string, []any) {
	// 対象セルの指定(軸は独立。nil = 不問)。
	cell := ""
	cellArgs := make([]any, 0, 2)
	if techType != nil {
		cell += " AND csr.tech_type = ?"
		cellArgs = append(cellArgs, *techType)
	}
	if inCorner != nil {
		cell += " AND csr.in_corner = ?"
		cellArgs = append(cellArgs, *inCorner)
	}

	// セットプレイを 1 つ以上持つか(圏外を 3 値から外すための土台)。
	hasSetup := `EXISTS (
    SELECT 1 FROM combo_setups cs
    JOIN setups s ON s.id = cs.setup_id AND s.deleted_at IS NULL
    WHERE cs.combo_id = combos.id)`

	switch state {
	case model.SetupResultOK:
		// いずれかの対象セルに ok の行がある。セル単位に分けても結果は同じなので
		// (EXISTS はセルの OR に対して分配的)、素の EXISTS のままでよい。
		cond := fmt.Sprintf(`EXISTS (
    SELECT 1 FROM combo_setup_results csr
    JOIN setups s ON s.id = csr.setup_id AND s.deleted_at IS NULL
    WHERE csr.combo_id = combos.id AND csr.result = ?%s)`, cell)
		args := make([]any, 0, len(cellArgs)+1)
		args = append(args, model.SetupResultOK)
		args = append(args, cellArgs...)
		return cond, args

	case model.SetupResultNG:
		// セルごとに集約し、「ng があり ok が無い」セルが 1 つでもあるか。
		// GROUP BY はセットプレイ横断でセルをまとめる(同じセルで一方が ok なら
		// そのセルは ng ではない = EXISTS 意味論)。
		cond := fmt.Sprintf(`EXISTS (
    SELECT 1 FROM combo_setup_results csr
    JOIN setups s ON s.id = csr.setup_id AND s.deleted_at IS NULL
    WHERE csr.combo_id = combos.id%s
    GROUP BY csr.tech_type, csr.in_corner
    HAVING SUM(CASE WHEN csr.result = ? THEN 1 ELSE 0 END) > 0
       AND SUM(CASE WHEN csr.result = ? THEN 1 ELSE 0 END) = 0)`, cell)
		args := make([]any, 0, len(cellArgs)+2)
		args = append(args, cellArgs...)
		args = append(args, model.SetupResultNG, model.SetupResultOK)
		return cond, args

	case model.SetupResultUnverified:
		// 「行が無いセルが 1 つ以上ある」は、行が無いのだから行を数えても出てこない。
		// そこで「記録済みセル数 < 対象セル数」で表す。
		recordedCells := fmt.Sprintf(`(
    SELECT COUNT(DISTINCT csr.tech_type || ':' || csr.in_corner)
    FROM combo_setup_results csr
    JOIN setups s ON s.id = csr.setup_id AND s.deleted_at IS NULL
    WHERE csr.combo_id = combos.id%s)`, cell)
		args := make([]any, 0, len(cellArgs)+1)
		args = append(args, cellArgs...)
		args = append(args, setupResultCellCount(techType, inCorner))
		return "(" + hasSetup + " AND " + recordedCells + " < ?)", args

	default:
		// 値域外。API 層で 400 に落とすため通常は到達しないが、リポジトリ層が
		// 単独で呼ばれたときは「1 件も該当しない」に倒す。値域外を「絞り込まない」
		// に倒すと、typo が全件返却として見え、絞り込めているかの区別がつかない
		// (既存の position 等が 'garbage' で 0 件になるのと同じ側へ揃える)。
		return "1 = 0", nil
	}
}

// buildListWhere は List / Count が共有する WHERE 句と束縛値を組み立てる。
// 条件を共有し、ゲーム更新の影響件数(M28-02c)と一覧・書き出しの総数
// (M29-02 §2.1)が、一覧と同じ絞り込み条件で数えられるようにする。
func buildListWhere(filter ListFilter) (string, []any) {
	var (
		whereParts []string
		args       []any
	)

	if filter.CharacterID != nil {
		whereParts = append(whereParts, "character_id = ?")
		args = append(args, *filter.CharacterID)
	}
	if len(filter.TagIDs) > 0 {
		placeholders := make([]string, len(filter.TagIDs))
		for i, id := range filter.TagIDs {
			placeholders[i] = "?"
			args = append(args, id)
		}
		whereParts = append(whereParts, fmt.Sprintf(
			"id IN (SELECT combo_id FROM combo_tags WHERE tag_id IN (%s))",
			strings.Join(placeholders, ",")))
	}
	if len(filter.StarterMoveIDs) > 0 {
		placeholders := make([]string, len(filter.StarterMoveIDs))
		for i, id := range filter.StarterMoveIDs {
			placeholders[i] = "?"
			args = append(args, id)
		}
		whereParts = append(whereParts, fmt.Sprintf(
			"starter_move_id IN (%s)", strings.Join(placeholders, ",")))
	}
	if filter.Position != nil {
		whereParts = append(whereParts, "position = ?")
		args = append(args, *filter.Position)
	}
	if filter.HitType != nil {
		whereParts = append(whereParts, "hit_type = ?")
		args = append(args, *filter.HitType)
	}
	if filter.OpponentStance != nil {
		whereParts = append(whereParts, "opponent_stance = ?")
		args = append(args, *filter.OpponentStance)
	}
	if filter.IsDraft != nil {
		whereParts = append(whereParts, "is_draft = ?")
		args = append(args, *filter.IsDraft)
	}
	if filter.StarterMeaty != nil {
		// ★M37-07: 列は NOT NULL DEFAULT 0 のため NULL 考慮は要らない。
		whereParts = append(whereParts, "starter_meaty = ?")
		args = append(args, *filter.StarterMeaty)
	}
	if filter.AffectedByGameUpdate != nil {
		// ★SELECT 句と同じ式を使う(別々に書くと表示と絞り込みが食い違う)。
		// affectedByGameUpdateExprSQL は末尾に `AS affected_by_game_update` を持つため、
		// WHERE では別名を外した本体だけを使う。
		cond := affectedByGameUpdateCondSQL
		if !*filter.AffectedByGameUpdate {
			cond = "NOT (" + cond + ")"
		}
		whereParts = append(whereParts, cond)
	}
	if filter.SetupResult != nil {
		// ★成立状態が nil のときは SetupTechType / SetupInCorner を読まない
		// (軸だけの指定は絞り込みにならない。M19-06 §2.2)。この if の中でしか
		// 軸を参照しないことが、その扱いの実装上の担保である。
		cond, condArgs := setupResultWhere(*filter.SetupResult, filter.SetupTechType, filter.SetupInCorner)
		whereParts = append(whereParts, cond)
		args = append(args, condArgs...)
	}
	if filter.OnlyDeleted {
		// M23-01 §4.3-1: ゴミ箱は「利用者が消した行」だけを見せる。PUT(キー変更編集)が
		// 積んだ旧行は superseded_by_combo_id に後継 id を持つため、既定から外す。
		// ★手動削除の行は本列が NULL のままであり、これまでどおり出る(指示書 §5-3)。
		// 切り替えの導線は作らない(同 §4.3-2。旧行が到達不能になるのは意図である)。
		whereParts = append(whereParts, "deleted_at IS NOT NULL", "superseded_by_combo_id IS NULL")
	} else if !filter.IncludeDeleted {
		whereParts = append(whereParts, "deleted_at IS NULL")
	}

	where := ""
	if len(whereParts) > 0 {
		where = "WHERE " + strings.Join(whereParts, " AND ")
	}
	return where, args
}

// Count は List と同じ条件に一致する総数を返す。
// LIMIT / OFFSET / ORDER BY は適用しない。ゲーム更新の影響件数(M28-02c)と
// 一覧・書き出しの上限による切り捨て判定(M29-02 §2.1)に使う。
func (r *repository) Count(ctx context.Context, filter ListFilter) (int, error) {
	where, args := buildListWhere(filter)
	query := "SELECT COUNT(*) FROM combos\n" + where
	var n int
	if err := r.db.QueryRowContext(ctx, query, args...).Scan(&n); err != nil {
		return 0, fmt.Errorf("count combos: %w", err)
	}
	return n, nil
}

func (r *repository) List(ctx context.Context, filter ListFilter) ([]*model.Combo, error) {
	where, args := buildListWhere(filter)

	orderByClause := resolveListSortClause(filter)

	limit := filter.Limit
	if limit <= 0 {
		limit = 100
	}
	if limit > 1000 {
		limit = 1000
	}
	offset := filter.Offset
	if offset < 0 {
		offset = 0
	}

	query := fmt.Sprintf(comboSelectSQL+`
%s
ORDER BY %s
LIMIT ? OFFSET ?`, where, orderByClause)

	args = append(args, limit, offset)

	rows, err := r.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("list combos: %w", err)
	}
	defer rows.Close()

	results := make([]*model.Combo, 0)
	for rows.Next() {
		c, err := r.scanCombo(ctx, rows)
		if err != nil {
			return nil, err
		}
		results = append(results, c)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	// 2クエリ方式: combo_ids IN 句でタグを一括取得してマージ(M3-02 §4.4.2)
	if len(results) > 0 {
		comboIDs := make([]int64, len(results))
		for i, c := range results {
			comboIDs[i] = c.ID
		}
		tagMap, err := r.findTagsByComboIDs(ctx, comboIDs)
		if err != nil {
			return nil, fmt.Errorf("find tags for list: %w", err)
		}
		for _, c := range results {
			if tags, ok := tagMap[c.ID]; ok {
				c.Tags = tags
			} else {
				c.Tags = []model.Tag{}
			}
		}

		// 起き攻めオプションを IN 句で一括取得してマージ(M16-03・タグと同じ 2 クエリ方式)
		okiMap, err := r.FindOkiOptionsForCombos(ctx, comboIDs)
		if err != nil {
			return nil, fmt.Errorf("find oki options for list: %w", err)
		}
		for _, c := range results {
			if opts, ok := okiMap[c.ID]; ok {
				c.OkiOptions = opts
			} else {
				c.OkiOptions = []model.OkiOption{}
			}
		}

		// starterMoveCode バッチ取得(M3-05 §4.2)
		moveIDs := make([]int64, 0)
		seen := make(map[int64]bool)
		for _, c := range results {
			if c.StarterMoveID != nil && !seen[*c.StarterMoveID] {
				moveIDs = append(moveIDs, *c.StarterMoveID)
				seen[*c.StarterMoveID] = true
			}
		}
		if len(moveIDs) > 0 {
			labelMap, err := r.findMoveLabelsByIDs(ctx, moveIDs)
			if err != nil {
				return nil, fmt.Errorf("find move labels for list: %w", err)
			}
			for _, c := range results {
				if c.StarterMoveID != nil {
					if label, ok := labelMap[*c.StarterMoveID]; ok {
						code := label.Code
						c.StarterMoveCode = &code
						c.StarterMoveNameJa = label.NameJa
					}
				}
			}
		}

		// FR702「変わった技」のバッチ取得(M28-02c)。★該当行が無ければクエリを撃たない。
		if err := r.attachAffectedMoves(ctx, results); err != nil {
			return nil, fmt.Errorf("attach affected moves for list: %w", err)
		}
	}
	return results, nil
}

// moveLabel は技の内部コードと表示名(公式日本語)の組。
//
// ★★M24-07(SM-006 = SM-059): 一覧の始動状況が内部の英語 move code から始まっていた。
// 画面へ出すのは表示名であり、コードは表示名が引けないときのフォールバックに限る。
// ⇒ 名前解決の経路は internal/repository/punish が既に持っているものと同じ
// (official_ja_move プリセットの alias_text を LEFT JOIN)。名前解決を二度実装しない。
//
// ★NameJa が nil になる経路は実在する —— alias_text は moves の列ではなく
// preset_aliases 由来であり、ラッシュ版(rush_variant)は preset_aliases へ書かない
// (internal/repository/move/rush.go)。⇒ 呼び手はフォールバックを持つこと。
type moveLabel struct {
	Code   string
	NameJa *string
}

// officialJaPresetSubquery は技名(name_ja)解決に使う official_ja_move プリセットの id。
//
// ★★M24-07 レビュー(低-1): 以前は副問い合わせを SQL 文字列へ直接埋め込み、
// プリセットコードもリテラルで書いていた。CLAUDE.md §4「マジックストリングは定数化」に
// 反しており、参照経路の元にした internal/repository/punish は名前付き定数
// (officialJaPresetSubquery)で同じ副問い合わせを共有している。⇒ 同型に揃える。
// ★コードそのものは model.PresetCodeOfficialJaMove が正典であり、ここから組み立てる。
var officialJaPresetSubquery = fmt.Sprintf(
	`(SELECT id FROM presets WHERE code = '%s')`, model.PresetCodeOfficialJaMove)

func (r *repository) findMoveLabelsByIDs(ctx context.Context, ids []int64) (map[int64]moveLabel, error) {
	if len(ids) == 0 {
		return nil, nil
	}
	placeholders := make([]string, len(ids))
	args := make([]any, len(ids))
	for i, id := range ids {
		placeholders[i] = "?"
		args[i] = id
	}
	query := fmt.Sprintf(`
SELECT m.id, m.code, pa.alias_text
FROM moves m
LEFT JOIN preset_aliases pa
    ON pa.move_id = m.id
   AND pa.preset_id = `+officialJaPresetSubquery+`
WHERE m.id IN (%s)`, strings.Join(placeholders, ","))
	rows, err := r.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("find move labels: %w", err)
	}
	defer rows.Close()

	result := make(map[int64]moveLabel)
	for rows.Next() {
		var id int64
		var code string
		var nameJa sql.NullString
		if err := rows.Scan(&id, &code, &nameJa); err != nil {
			return nil, fmt.Errorf("scan move label: %w", err)
		}
		label := moveLabel{Code: code}
		if nameJa.Valid {
			v := nameJa.String
			label.NameJa = &v
		}
		result[id] = label
	}
	return result, rows.Err()
}

// ---------------------------------------------------------------------------
// listAffectedMovesByComboIDs (バッチ取得、N+1 回避)
// ---------------------------------------------------------------------------

// listAffectedMovesSQL は「そのコンボが使っている move のうち、実際に基準より後に
// 変わったもの」を列挙する(FR702 の目的そのもの・CHANGE-162 §1)。
//
// ★★判定の中身は affectedMoveCondSQL の 1 本だけを使う。⇒ 式を書き写さない。
// ★述語が combos.baseline_version を読むため、combo_steps から combos も join する。
// ★DISTINCT —— 同じ技を 2 回使うコンボがあるため(1 行に 1 回だけ出す)。
// ★表示名は moves の列ではない。findMoveLabelsByIDs と同じ LEFT JOIN で解決し、
//
//	引けないときは NULL のまま返す(code へ落とすのは画面側の 1 関数である)。
var listAffectedMovesSQLTemplate = `
SELECT DISTINCT cs.combo_id, m.id, m.code, pa.alias_text, m.last_changed_game_version
FROM combo_steps cs
JOIN moves m ON m.id = cs.move_id
JOIN combos ON combos.id = cs.combo_id
LEFT JOIN preset_aliases pa
    ON pa.move_id = m.id
   AND pa.preset_id = ` + officialJaPresetSubquery + `
WHERE cs.combo_id IN (%s)
  AND ` + affectedMoveCondSQL + `
ORDER BY cs.combo_id, m.id`

// listAffectedMovesByComboIDs は複数コンボぶんの「変わった技」をまとめて返す。
//
// ★★呼び手は AffectedByGameUpdate(真偽)からこの列挙を導くのであって、逆ではない。
// 列挙の長さで影響の有無を判定しないこと(真偽が 2 か所で表せてしまう)。
func (r *repository) listAffectedMovesByComboIDs(ctx context.Context, comboIDs []int64) (map[int64][]model.AffectedMove, error) {
	result := make(map[int64][]model.AffectedMove)
	if len(comboIDs) == 0 {
		return result, nil
	}

	placeholders := make([]string, len(comboIDs))
	args := make([]any, len(comboIDs))
	for i, id := range comboIDs {
		placeholders[i] = "?"
		args[i] = id
	}

	query := fmt.Sprintf(listAffectedMovesSQLTemplate, strings.Join(placeholders, ","))
	rows, err := r.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("list affected moves by combo ids: %w", err)
	}
	defer rows.Close()

	for rows.Next() {
		var comboID int64
		var am model.AffectedMove
		var nameJa sql.NullString
		if err := rows.Scan(&comboID, &am.MoveID, &am.Code, &nameJa, &am.LastChangedGameVersion); err != nil {
			return nil, fmt.Errorf("scan affected move: %w", err)
		}
		if nameJa.Valid {
			v := nameJa.String
			am.NameJa = &v
		}
		result[comboID] = append(result[comboID], am)
	}
	return result, rows.Err()
}

// attachAffectedMoves は結果セットへ「変わった技」を注入する。
//
// ★★引きに行く対象は AffectedByGameUpdate が true の行だけである。false の行の答えは
// 定義上 空 であり、引くまでもない。⇒ 真偽から列挙を導く向きであって、その逆ではない。
// ★1 件も該当が無ければクエリを撃たない(初回は必ず 0 件である = D-725)。
func (r *repository) attachAffectedMoves(ctx context.Context, combos []*model.Combo) error {
	ids := make([]int64, 0, len(combos))
	for _, c := range combos {
		if c.AffectedByGameUpdate {
			ids = append(ids, c.ID)
		}
	}
	for _, c := range combos {
		c.AffectedMoves = []model.AffectedMove{}
	}
	if len(ids) == 0 {
		return nil
	}
	moveMap, err := r.listAffectedMovesByComboIDs(ctx, ids)
	if err != nil {
		return err
	}
	for _, c := range combos {
		if ms, ok := moveMap[c.ID]; ok {
			c.AffectedMoves = ms
		}
	}
	return nil
}

// ---------------------------------------------------------------------------
// UpdateMetadata
// ---------------------------------------------------------------------------

func (r *repository) UpdateMetadata(ctx context.Context, tx *sql.Tx, id int64, version int, input UpdateMetadataInput) (int, error) {
	// SET 句を動的に組み立てる。COALESCE は使わず、明示的に指定された列のみ UPDATE。
	var (
		setParts []string
		args     []any
	)
	add := func(col string, val any) {
		setParts = append(setParts, col+" = ?")
		args = append(args, val)
	}
	// IsDraft は非 nullable(NULL クリア対象外)。nil=不変更 / 非 nil=更新。
	if input.IsDraft != nil {
		add("is_draft", *input.IsDraft)
	}
	// nullable メタデータは presence-detection: present のときのみ SET。
	// present+null は Arg() が untyped nil(=SQL NULL)を返し NULL クリア、present+値は更新。
	addOptInt := func(col string, o Optional[int]) {
		if o.Present {
			add(col, o.Arg())
		}
	}
	addOptFloat := func(col string, o Optional[float64]) {
		if o.Present {
			add(col, o.Arg())
		}
	}
	addOptInt("damage", input.Damage)
	addOptFloat("drive_available_at_start", input.DriveAvailableAtStart)
	addOptInt("sa_available_at_start", input.SAAvailableAtStart)
	addOptFloat("drive_damage", input.DriveDamage)
	addOptInt("sa_gauge_consumed", input.SAGaugeConsumed)
	addOptFloat("drive_gauge_consumed", input.DriveGaugeConsumed)
	addOptInt("knockdown_advantage", input.KnockdownAdvantage)
	addOptInt("start_position_mass", input.StartPositionMass)
	addOptInt("carry_distance_mass", input.CarryDistanceMass)
	// ★M27-02b: NOT NULL の列なので NULL クリアが無い。⇒ addOpt* を使わず、
	//   present かつ値ありのときだけ SET する(Arg() は nil を返しうるため使えない)。
	if input.OkiVerified.Present && input.OkiVerified.Value != nil {
		add("oki_verified", *input.OkiVerified.Value)
	}
	if input.Memo.Present {
		add("memo", input.Memo.Arg())
	}
	if input.Situation.Present {
		add("situation", input.Situation.Arg())
	}
	// メディア 3 列(M17-01)。memo と同じ presence-detection。recipe 非対象のため
	// 変更してもサービス層は RecomputeComboCache を呼ばない。
	if input.Link.Present {
		add("link", input.Link.Arg())
	}
	if input.VideoPath.Present {
		add("video_path", input.VideoPath.Arg())
	}
	if input.ImagePath.Present {
		add("image_path", input.ImagePath.Arg())
	}
	// 起き攻めオプション(combo_oki_options)は combos の UPDATE では扱わず、サービス層が
	// ReplaceOkiOptions で子行を差し替える(TagIDs と同じ replace-set 方式・M16-03)。

	// 楽観的排他: version 一致確認 + +1。
	// 何も SET フィールドがない場合(setParts が空)でも version / updated_at は常時更新する。
	setParts = append(setParts, "version = version + 1", "updated_at = datetime('now')")
	args = append(args, id, version)

	query := fmt.Sprintf(`UPDATE combos SET %s WHERE id = ? AND version = ? AND deleted_at IS NULL`,
		strings.Join(setParts, ", "))

	exec := r.runner(tx)
	res, err := exec.ExecContext(ctx, query, args...)
	if err != nil {
		return 0, fmt.Errorf("update metadata: %w", err)
	}
	rows, err := res.RowsAffected()
	if err != nil {
		return 0, fmt.Errorf("rows affected: %w", err)
	}
	if rows == 0 {
		// 存在チェックで NotFound か Conflict か区別
		var existsActive int
		row := r.runner(tx).QueryRowContext(ctx,
			"SELECT COUNT(*) FROM combos WHERE id = ? AND deleted_at IS NULL", id)
		if err := row.Scan(&existsActive); err != nil {
			return 0, fmt.Errorf("scan exists: %w", err)
		}
		if existsActive == 0 {
			return 0, ErrNotFound
		}
		return 0, ErrConflict
	}
	return version + 1, nil
}

// ---------------------------------------------------------------------------
// SoftDelete / Restore
// ---------------------------------------------------------------------------

// SoftDelete はコンボを論理削除する。詳細は Repository インタフェース側の godoc を参照。
//
// ★M23-08 §4.4: WHERE に deleted_at IS NULL を足し、既に削除済みの行の deleted_at を
// 上書きしないようにした。上書きしていると、利用者から見て「消した日が後ろへずれる」。
//
// ★★2 度目を「見つからない」へ変えてはならない。DES-002 §4.2 が
// 「論理削除は楽観排他を行わず冪等に成功する」を契約として固定しており(CHANGE-123・
// M23-03)、排他を入れると「消したいのに消せない」経路が生まれる。
// ⇒ 0 行のときは「行が存在しない」のか「既に削除済み」なのかを数え直して分け、
// 既に削除済みなら成功(nil)を返す。応答は 204 のままである。
func (r *repository) SoftDelete(ctx context.Context, tx *sql.Tx, id int64) error {
	exec := r.runner(tx)
	res, err := exec.ExecContext(ctx,
		`UPDATE combos SET deleted_at = datetime('now'), updated_at = datetime('now')
		  WHERE id = ? AND deleted_at IS NULL`, id)
	if err != nil {
		return fmt.Errorf("soft delete: %w", err)
	}
	rows, err := res.RowsAffected()
	if err != nil {
		return fmt.Errorf("rows affected: %w", err)
	}
	if rows > 0 {
		return nil
	}

	// 0 行だった理由を分ける。述語を足したことで RowsAffected だけでは
	// 「存在しない」と「既に削除済み」を区別できなくなったため。
	var exists int
	if err = exec.QueryRowContext(ctx,
		`SELECT COUNT(*) FROM combos WHERE id = ?`, id).Scan(&exists); err != nil {
		return fmt.Errorf("soft delete: count existing: %w", err)
	}
	if exists == 0 {
		return ErrNotFound
	}
	// 既に削除済み。冪等に成功する(deleted_at は最初の値のまま)。
	return nil
}

func (r *repository) Restore(ctx context.Context, tx *sql.Tx, id int64) error {
	exec := r.runner(tx)
	res, err := exec.ExecContext(ctx,
		`UPDATE combos SET deleted_at = NULL, updated_at = datetime('now') WHERE id = ? AND deleted_at IS NOT NULL`, id)
	if err != nil {
		return fmt.Errorf("restore: %w", err)
	}
	rows, err := res.RowsAffected()
	if err != nil {
		return fmt.Errorf("rows affected: %w", err)
	}
	if rows == 0 {
		return ErrNotFound
	}
	return nil
}

// advanceBaselineVersionSQL は基準を games の現在版へ進める。
//
// ★版数を games から直に読む(サブクエリ)。⇒ 呼び出し側が任意の版を渡せない。
// ★deleted_at IS NULL を条件に入れる —— ゴミ箱の行を「確認した」にはしない。
// ★version(楽観的排他)は上げない。基準の前進はコンボの内容の変更ではなく、
//
//	利用者が「見た」ことの記録である。⇒ 他端末で編集中の版を無効にしない。
//
// ★★ただし updated_at は進める。⇒ 更新日時順の一覧では並びが動く。
// これは意図した挙動である —— 「確認した」は利用者がそのコンボへ触れた事実であり、
// 最近触ったものが上に来るのは自然だからである。★据え置くと「いつ確認したか」が
// どこにも残らなくなる(基準は版数であって日時ではない)。
const advanceBaselineVersionSQL = `
UPDATE combos
SET baseline_version = (SELECT current_data_version FROM games WHERE code = ?),
    updated_at = datetime('now')
WHERE id = ? AND deleted_at IS NULL`

func (r *repository) AdvanceBaselineVersion(ctx context.Context, tx *sql.Tx, id int64, gameCode string) error {
	res, err := r.runner(tx).ExecContext(ctx, advanceBaselineVersionSQL, gameCode, id)
	if err != nil {
		return fmt.Errorf("advance baseline version: %w", err)
	}
	rows, err := res.RowsAffected()
	if err != nil {
		return fmt.Errorf("rows affected: %w", err)
	}
	if rows == 0 {
		return ErrNotFound
	}
	return nil
}

func (r *repository) HardDelete(ctx context.Context, tx *sql.Tx, id int64) error {
	exec := r.runner(tx)
	// M19-03: combo_setups → combo_setup_results は 2 段の ON DELETE CASCADE で消えるが、
	// 当時は FK=OFF の接続では発火しなかった(db.Open の PRAGMA が接続プール全体に効いて
	// いなかった)。完全削除でこれらが残ると、id 再利用時に他人の検証結果が見えかねない
	// ため明示的に落とす。
	// (combos.id は AUTOINCREMENT で再利用されない想定だが、FK に依存しない形に揃える。)
	//
	// ★M23-08 §4.1: 残り 5 表も同じ形へ揃えた。実測(hard_delete_children_test.go の probe)
	//   では FK=ON の接続なら CASCADE が発火するが、FK=OFF の接続では combo_steps /
	//   combo_tags / combo_oki_options / combo_punishes / combo_punish_curations が
	//   そのまま残った。どちらの接続を引くかは実行時まで分からなかった(P-04)。
	//
	// ★M23-10: db.Open 経由の接続はすべて FK=ON になり、「どちらの接続を引くか」は
	//   もう分からなくない。それでも本関数の明示削除は撤去しない —— 二重の保険であり、
	//   撤去してよいかどうかは M23-10 の判断事項ではない(同 §2.2)。
	//
	// ★★明示削除は「忘れられる形」である。CASCADE 依存なら新しい子表が増えても何も
	//   しなくて消えたが、明示削除では誰かが本関数に 1 行足すのを忘れる。承知のうえで
	//   採っている(M23-overview 確認事項 5・D-514)。忘れたことが分かるように
	//   hard_delete_children_test.go がスキーマから子表を列挙して検査している。
	//   ⇒ combos の子表を足したら、本関数と同テストの fixture の両方を直すこと。
	if _, err := exec.ExecContext(ctx,
		`DELETE FROM combo_setup_results WHERE combo_id = ?`, id); err != nil {
		return fmt.Errorf("hard delete combo_setup_results: %w", err)
	}
	if _, err := exec.ExecContext(ctx,
		`DELETE FROM combo_setups WHERE combo_id = ?`, id); err != nil {
		return fmt.Errorf("hard delete combo_setups: %w", err)
	}
	if _, err := exec.ExecContext(ctx,
		`DELETE FROM combo_steps WHERE combo_id = ?`, id); err != nil {
		return fmt.Errorf("hard delete combo_steps: %w", err)
	}
	if _, err := exec.ExecContext(ctx,
		`DELETE FROM combo_tags WHERE combo_id = ?`, id); err != nil {
		return fmt.Errorf("hard delete combo_tags: %w", err)
	}
	if _, err := exec.ExecContext(ctx,
		`DELETE FROM combo_oki_options WHERE combo_id = ?`, id); err != nil {
		return fmt.Errorf("hard delete combo_oki_options: %w", err)
	}
	if _, err := exec.ExecContext(ctx,
		`DELETE FROM combo_punishes WHERE combo_id = ?`, id); err != nil {
		return fmt.Errorf("hard delete combo_punishes: %w", err)
	}
	if _, err := exec.ExecContext(ctx,
		`DELETE FROM combo_punish_curations WHERE combo_id = ?`, id); err != nil {
		return fmt.Errorf("hard delete combo_punish_curations: %w", err)
	}
	// ★M23-08 §4.2: combos 自身を指す 2 本の self-FK は「消す」のではなく「参照を外す」。
	//   ★★NULL 化であって削除ではない。materialize 生成物は基底とは独立した利用者の
	//     コンボであり、消すとデータが黙って失われる。
	//   - materialized_from_combo_id は ON DELETE 句を持たない(既定の NO ACTION)。
	//     実測: FK=ON の接続では完全削除そのものが FOREIGN KEY constraint failed で
	//     落ち、FK=OFF の接続では dangling 参照が残った。
	//     ★M23-10 で全接続が FK=ON になったため、この NULL 化は「あってもよい」ではなく
	//       「無いと完全削除が落ちる」側に変わった。撤去しないこと。
	//   - superseded_by_combo_id は ON DELETE SET NULL を宣言している(宣言元は
	//     000001_init_schema)。旧 000078(M33-02 が潰す前)自身が「連鎖動作は保証されない」と
	//     書いており、M23-08 の実測でも FK=OFF の接続では
	//     発火しなかった。★M23-10 で全接続が FK=ON になり SET NULL も発火するように
	//     なったが、明示 NULL 化は二重の保険として残す。印が残ると旧行はゴミ箱の一覧(deleted_at IS NOT NULL AND
	//     superseded_by_combo_id IS NULL)からも VAL-C14 の母集団からも外れ、どの画面
	//     からも触れない行になる。⇒ 宣言済みの挙動を接続に依存させないために明示する。
	//   ★スキーマ(FK 句)は変えない。SQLite は制約の ALTER を持たず表の作り直しになる。
	//   ★version / updated_at は動かさない。参照が外れただけで利用者から見たコンボの
	//     内容は変わっていない。UpdateWithKeyChange が superseded_by_combo_id を打刻
	//     するときの判断(service.go の「version は動かさない／updated_at も触らない」)
	//     と同じ形である。
	if _, err := exec.ExecContext(ctx,
		`UPDATE combos SET materialized_from_combo_id = NULL WHERE materialized_from_combo_id = ?`,
		id); err != nil {
		return fmt.Errorf("hard delete: clear materialized_from_combo_id: %w", err)
	}
	if _, err := exec.ExecContext(ctx,
		`UPDATE combos SET superseded_by_combo_id = NULL WHERE superseded_by_combo_id = ?`,
		id); err != nil {
		return fmt.Errorf("hard delete: clear superseded_by_combo_id: %w", err)
	}
	_, err := exec.ExecContext(ctx, `DELETE FROM combos WHERE id = ?`, id)
	if err != nil {
		return fmt.Errorf("hard delete: %w", err)
	}
	return nil
}

// ---------------------------------------------------------------------------
// FindStepsForCombos(バルク取得)
// ---------------------------------------------------------------------------

func (r *repository) FindStepsForCombos(ctx context.Context, comboIDs []int64) (map[int64][]model.ComboStep, error) {
	if len(comboIDs) == 0 {
		return map[int64][]model.ComboStep{}, nil
	}

	placeholders := make([]string, len(comboIDs))
	args := make([]any, len(comboIDs))
	for i, id := range comboIDs {
		placeholders[i] = "?"
		args[i] = id
	}

	query := fmt.Sprintf(`
SELECT
    cs.id, cs.combo_id, cs.step_order, cs.move_id, cs.modifiers,
    m.code AS move_code
FROM combo_steps cs
LEFT JOIN moves m ON cs.move_id = m.id
WHERE cs.combo_id IN (%s)
ORDER BY cs.combo_id, cs.step_order`, strings.Join(placeholders, ","))

	rows, err := r.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("find steps for combos: %w", err)
	}
	defer rows.Close()

	result := map[int64][]model.ComboStep{}
	for rows.Next() {
		step, err := scanStep(rows)
		if err != nil {
			return nil, err
		}
		result[step.ComboID] = append(result[step.ComboID], step)
	}
	return result, rows.Err()
}

// ---------------------------------------------------------------------------
// FindActiveByDuplicateKey(VAL-C02 候補抽出)
// ---------------------------------------------------------------------------

func (r *repository) FindActiveByDuplicateKey(ctx context.Context, tx *sql.Tx, key DuplicateKey) ([]model.Combo, error) {
	whereParts := []string{
		"character_id = ?",
		"is_draft = 0",
		"deleted_at IS NULL",
	}
	args := []any{key.CharacterID}

	addNullable := func(col string, val any, isNil bool) {
		if isNil {
			whereParts = append(whereParts, col+" IS NULL")
		} else {
			whereParts = append(whereParts, col+" = ?")
			args = append(args, val)
		}
	}
	addNullable("starter_move_id", deref(key.StarterMoveID), key.StarterMoveID == nil)
	addNullable("position", derefStr(key.Position), key.Position == nil)
	addNullable("opponent_stance", derefStr(key.OpponentStance), key.OpponentStance == nil)
	addNullable("hit_type", derefStr(key.HitType), key.HitType == nil)
	addNullable("opponent_size", derefStr(key.OpponentSize), key.OpponentSize == nil)
	// ★M37-07: starter_meaty は NOT NULL DEFAULT 0 のため addNullable を通さない。
	//   ⇒ NULL 一致の分岐が存在しない(値は常に 0 か 1 である)。
	whereParts = append(whereParts, "starter_meaty = ?")
	args = append(args, key.StarterMeaty)

	query := fmt.Sprintf(comboSelectSQL+`
WHERE %s`, strings.Join(whereParts, " AND "))

	rows, err := r.runner(tx).QueryContext(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("find active by duplicate key: %w", err)
	}
	defer rows.Close()

	combos := make([]model.Combo, 0)
	for rows.Next() {
		c, err := r.scanCombo(ctx, rows)
		if err != nil {
			return nil, err
		}
		combos = append(combos, *c)
	}
	return combos, rows.Err()
}

// ---------------------------------------------------------------------------
// M23-05: 重複判定の外側を見る問い合わせ(VAL-C14 / VAL-R03)
// ---------------------------------------------------------------------------

// duplicateKeySelectSQL は M23-05 の新規 2 本が共有する SELECT 句。
//
// ★列の並びは scanCombo の Scan 順に一致していること。FindActiveByDuplicateKey は
// 同じ列を自前で持っているが、そちらは触らない(M23-05 §4.4・レビューチェックリスト §6
// が「VAL-C02 の既存問い合わせには触れない」を明示している)。
// ⇒ 本定数を FindActiveByDuplicateKey へ後から適用しないこと。
const duplicateKeySelectSQL = comboSelectSQL + `
WHERE `

// duplicateKeyPredicates は重複判定キー 7 項の WHERE 句と引数を組む(M23-05 §4.4)。
//
// ★M37-07 で 6 項 → 7 項になった(starter_meaty を追加・D-874)。
//
// ★★NULL 同士を一致として扱う。nil のキーには `col IS NULL` を生成する
// (DES-006 §2.3)。ここを `col = ?` + nil 引数にすると SQL の三値論理で常に偽になり、
// position などが未設定のコンボが 1 件も検出されなくなる。
// ★FindActiveByDuplicateKey 内のローカルクロージャ addNullable と同じ意味論である。
// 同関数は M23-05 では改変しないため、実装は 2 か所に並ぶ。片方だけ直さないこと。
func duplicateKeyPredicates(key DuplicateKey) ([]string, []any) {
	parts := []string{"character_id = ?"}
	args := []any{key.CharacterID}

	addNullable := func(col string, val any, isNil bool) {
		if isNil {
			parts = append(parts, col+" IS NULL")
		} else {
			parts = append(parts, col+" = ?")
			args = append(args, val)
		}
	}
	addNullable("starter_move_id", deref(key.StarterMoveID), key.StarterMoveID == nil)
	addNullable("position", derefStr(key.Position), key.Position == nil)
	addNullable("opponent_stance", derefStr(key.OpponentStance), key.OpponentStance == nil)
	addNullable("hit_type", derefStr(key.HitType), key.HitType == nil)
	addNullable("opponent_size", derefStr(key.OpponentSize), key.OpponentSize == nil)
	// ★M37-07: starter_meaty は NOT NULL DEFAULT 0 のため addNullable を通さない
	//   (FindActiveByDuplicateKey 側と同じ扱い。片方だけ直さないこと)。
	parts = append(parts, "starter_meaty = ?")
	args = append(args, key.StarterMeaty)

	return parts, args
}

// queryCombosByDuplicateKey は組み立てた WHERE 句で候補を引く(M23-05 の新規 2 本の共通部)。
func (r *repository) queryCombosByDuplicateKey(ctx context.Context, tx *sql.Tx, whereParts []string, args []any, what string) ([]model.Combo, error) {
	query := duplicateKeySelectSQL + strings.Join(whereParts, " AND ")

	rows, err := r.runner(tx).QueryContext(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("%s: %w", what, err)
	}
	defer rows.Close()

	combos := make([]model.Combo, 0)
	for rows.Next() {
		c, err := r.scanCombo(ctx, rows)
		if err != nil {
			return nil, err
		}
		combos = append(combos, *c)
	}
	return combos, rows.Err()
}

func (r *repository) FindDeletedByDuplicateKey(ctx context.Context, key DuplicateKey) ([]model.Combo, error) {
	whereParts, args := duplicateKeyPredicates(key)
	whereParts = append(whereParts,
		// 仮登録は重複判定の対象外(DES-006 §2.3)。VAL-C02 と同じ扱いを保つ(M23-05 §3.3-4)。
		"is_draft = 0",
		// ゴミ箱に居る行だけを見る。
		"deleted_at IS NOT NULL",
		// ★PUT が積んだ旧行を除く(M23-05 §4.2)。この 1 行を落とすと、キーを変えない
		//   編集をするたびに「ゴミ箱に同じものがあります」が出る形になる。
		"superseded_by_combo_id IS NULL",
	)
	return r.queryCombosByDuplicateKey(ctx, nil, whereParts, args, "find deleted by duplicate key")
}

func (r *repository) FindActiveByDuplicateKeyExcludingTx(ctx context.Context, tx *sql.Tx, key DuplicateKey, excludeComboID int64) ([]model.Combo, error) {
	whereParts, args := duplicateKeyPredicates(key)
	whereParts = append(whereParts, "is_draft = 0", "deleted_at IS NULL", "id <> ?")
	args = append(args, excludeComboID)
	return r.queryCombosByDuplicateKey(ctx, tx, whereParts, args, "find active by duplicate key excluding")
}

// ---------------------------------------------------------------------------
// UpdateSetupReferences
// ---------------------------------------------------------------------------

func (r *repository) UpdateSetupReferences(ctx context.Context, tx *sql.Tx, oldComboID, newComboID int64) error {
	exec := r.runner(tx)
	_, err := exec.ExecContext(ctx,
		`UPDATE combo_setups SET combo_id = ? WHERE combo_id = ?`, newComboID, oldComboID)
	if err != nil {
		return fmt.Errorf("update setup references: %w", err)
	}
	return nil
}

// MovePunishReferences は combo_punishes / combo_punish_curations の combo_id を旧→新へ
// 付け替える(M18-03b §4.6・裁定11)。UpdateSetupReferences と同一の FK 再ポイント方式で、
// キー変更編集の同一トランザクション内から呼ぶ。opponent_move_id・note は不変。
func (r *repository) MovePunishReferences(ctx context.Context, tx *sql.Tx, oldComboID, newComboID int64) error {
	exec := r.runner(tx)
	if _, err := exec.ExecContext(ctx,
		`UPDATE combo_punishes SET combo_id = ? WHERE combo_id = ?`, newComboID, oldComboID); err != nil {
		return fmt.Errorf("move punish references: %w", err)
	}
	if _, err := exec.ExecContext(ctx,
		`UPDATE combo_punish_curations SET combo_id = ? WHERE combo_id = ?`, newComboID, oldComboID); err != nil {
		return fmt.Errorf("move punish curation references: %w", err)
	}
	return nil
}

// MoveSetupResultReferences は combo_setup_results の combo_id を旧→新へ付け替える(M19-03 §4.2)。
//
// 本表の FK 親は combo_setups であり、その親キーは UpdateSetupReferences が
// その場で UPDATE する。FK=ON の接続では ON UPDATE CASCADE が既に子行を追従させて
// いるため、本関数は 0 行更新の no-op になる。
//
// それでも明示的に呼ぶ理由: M19-03 当時、infra/db.Open は PRAGMA foreign_keys=ON を
// プール中の 1 接続にしか適用しておらず、実測で FK=OFF の接続が混在した
// (M19-03 実装時 16 接続中 7 本、M23-10 直前の再実測では 16 本中 15 本)。FK=OFF の
// 接続がキー変更編集を処理すると CASCADE が発火せず、ユーザーが実機で検証した成立条件が
// 旧 combo_id 側に取り残されて画面から消える。combo_punishes の MovePunishReferences と
// 同じ明示再ポイント方式を併用して、接続ごとの FK 差に依存しない形にした。
//
// ★M23-10 で db.Open 経由の接続はすべて FK=ON になり、接続ごとの差は無くなった。
// それでも本関数は撤去しない —— 二重の保険であり、撤去は M23-10 の判断事項ではない。
//
// 呼び出し順は必ず UpdateSetupReferences の「後」。先に子を動かすと、FK=ON の
// 接続では移動先の (新 combo_id, setup_id) がまだ存在せず FK 違反になる。
func (r *repository) MoveSetupResultReferences(ctx context.Context, tx *sql.Tx, oldComboID, newComboID int64) error {
	exec := r.runner(tx)
	if _, err := exec.ExecContext(ctx,
		`UPDATE combo_setup_results SET combo_id = ? WHERE combo_id = ?`, newComboID, oldComboID); err != nil {
		return fmt.Errorf("move setup result references: %w", err)
	}
	return nil
}

// InsertPunish は materialize 生成物へ確定反撃の採用(combo_punishes)を 1 行作る(M18-03b §4.4)。
// punish 側 addPunishSQL と同じ ON CONFLICT DO UPDATE 挙動に揃える。
func (r *repository) InsertPunish(ctx context.Context, tx *sql.Tx, comboID, opponentMoveID int64, note *string) error {
	exec := r.runner(tx)
	_, err := exec.ExecContext(ctx,
		`INSERT INTO combo_punishes (combo_id, opponent_move_id, note)
		 VALUES (?, ?, ?)
		 ON CONFLICT (combo_id, opponent_move_id)
		 DO UPDATE SET note = excluded.note, updated_at = datetime('now')`,
		comboID, opponentMoveID, note)
	if err != nil {
		return fmt.Errorf("insert punish: %w", err)
	}
	return nil
}

// RemovePunishLink は (combo_id, opponent_move_id) の採用と同キー curation をペアで削除する。
func (r *repository) RemovePunishLink(ctx context.Context, tx *sql.Tx, comboID, opponentMoveID int64) error {
	exec := r.runner(tx)
	if _, err := exec.ExecContext(ctx,
		`DELETE FROM combo_punishes WHERE combo_id = ? AND opponent_move_id = ?`, comboID, opponentMoveID); err != nil {
		return fmt.Errorf("remove punish link: %w", err)
	}
	if _, err := exec.ExecContext(ctx,
		`DELETE FROM combo_punish_curations WHERE combo_id = ? AND opponent_move_id = ?`, comboID, opponentMoveID); err != nil {
		return fmt.Errorf("remove punish curation link: %w", err)
	}
	return nil
}

// ---------------------------------------------------------------------------
// combo_setups 操作 (M4-03)
// ---------------------------------------------------------------------------

// liveSetupScope は引き継ぎオプションの解除対象を「生きたセットプレイの紐付け」に限る述語。
//
// ★M23-08 §4.5: 引き継ぎの選択肢を作る読み取り(CountComboSetupsByComboID ／
// setup リポジトリの ListSetupsByComboID(s))はいずれも s.deleted_at IS NULL を持ち、
// ゴミ箱に居るセットプレイの紐付けを利用者に見せない。ところが解除する側の DELETE には
// 述語が無く、combo_setups の全行を対象にしていた。
// ⇒ 利用者が選びようのなかった紐付けが、unlink_all でも individual でも黙って落ちる。
// ⇒ M23-02 の看板「復元すると紐付いていた全コンボへ一斉に戻る」が、利用者に見えない
//
//	条件で成立しなくなる。見えない条件で成立しない約束は、成立しない約束より悪い。
//
// ★読み取り側を「削除済みも見せる」へ変えるのではなく、書き込み側を「見せている範囲」
// へ揃える形を採った。読み取り側を緩めるとゴミ箱のセットプレイがコンボ詳細画面に出て
// しまい、M23-02 / M23-03 が意図して入れた除外を壊す(開発者裁定・2026-08-23)。
const liveSetupScope = ` AND setup_id IN (SELECT id FROM setups WHERE deleted_at IS NULL)`

func (r *repository) DeleteComboSetupsByComboID(ctx context.Context, tx *sql.Tx, comboID int64) error {
	exec := r.runner(tx)
	// M19-03: 紐付けを消す前に成立条件の検証結果も消す。ON DELETE CASCADE でも消えるが、
	// M19-03 当時は FK=OFF の接続では発火しなかったため明示的に落とす(孤児行が
	// 「未検証でない状態」で残らないことの担保＝§4.1.3)。
	// ★M23-10 で全接続が FK=ON になった後も、二重の保険として明示削除を残す。
	if _, err := exec.ExecContext(ctx,
		`DELETE FROM combo_setup_results WHERE combo_id = ?`+liveSetupScope, comboID); err != nil {
		return fmt.Errorf("delete combo_setup_results by combo_id: %w", err)
	}
	_, err := exec.ExecContext(ctx,
		`DELETE FROM combo_setups WHERE combo_id = ?`+liveSetupScope, comboID)
	if err != nil {
		return fmt.Errorf("delete combo_setups by combo_id: %w", err)
	}
	return nil
}

func (r *repository) DeleteComboSetupsByComboIDExcluding(ctx context.Context, tx *sql.Tx, comboID int64, keepSetupIDs []int64) error {
	if len(keepSetupIDs) == 0 {
		return r.DeleteComboSetupsByComboID(ctx, tx, comboID)
	}
	exec := r.runner(tx)
	placeholders := make([]string, len(keepSetupIDs))
	args := make([]any, 0, len(keepSetupIDs)+1)
	args = append(args, comboID)
	for i, id := range keepSetupIDs {
		placeholders[i] = "?"
		args = append(args, id)
	}
	// M19-03: 解除対象の組の検証結果を先に落とす(上記と同じ理由)。
	// ★M23-08 §4.5: 解除対象は生きたセットプレイの紐付けだけ(liveSetupScope の godoc)。
	//   削除済みのセットプレイは選択肢に出ていないため CarrySetupIDs に入りようがなく、
	//   述語が無いと NOT IN に必ず引っかかって黙って落ちる。
	// ★liveSetupScope は fmt.Sprintf の「外」で連結する。フォーマット文字列側へ入れると、
	//   将来この定数へ `%` を含む述語(LIKE '...%' 等)が入ったときに verb として食われ、
	//   コンパイルは通ったまま SQL エラーかサイレントな条件変化になる。
	resultsQ := fmt.Sprintf(
		`DELETE FROM combo_setup_results WHERE combo_id = ? AND setup_id NOT IN (%s)`,
		strings.Join(placeholders, ",")) + liveSetupScope
	if _, err := exec.ExecContext(ctx, resultsQ, args...); err != nil {
		return fmt.Errorf("delete combo_setup_results excluding: %w", err)
	}
	q := fmt.Sprintf(`DELETE FROM combo_setups WHERE combo_id = ? AND setup_id NOT IN (%s)`,
		strings.Join(placeholders, ",")) + liveSetupScope
	_, err := exec.ExecContext(ctx, q, args...)
	if err != nil {
		return fmt.Errorf("delete combo_setups excluding: %w", err)
	}
	return nil
}

func (r *repository) CountComboSetupsByComboID(ctx context.Context, comboID int64) (int, error) {
	var n int
	// ★setups へ結合し deleted_at IS NULL を課す(M23-02・D-491)。
	// M23-02 が案 P1 を撤回したことで「combo_setups の行は必ず生きたセットプレイを
	// 指す」という不変条件が失われたため、結合しないと論理削除済みのセットプレイを
	// 数えてしまう。数えると、紐付いたセットプレイが全部ゴミ箱に居るコンボの
	// knockdown_advantage 変更が ErrMissingSetupCarryOptions で拒まれる一方、画面の
	// 引き継ぎモーダルは生きたセットプレイの件数で発火するため出ず、利用者は
	// 選びようがないまま先へ進めなくなる。
	err := r.db.QueryRowContext(ctx,
		`SELECT COUNT(*) FROM combo_setups cs
		   JOIN setups s ON s.id = cs.setup_id AND s.deleted_at IS NULL
		  WHERE cs.combo_id = ?`, comboID).Scan(&n)
	if err != nil {
		return 0, fmt.Errorf("count combo_setups: %w", err)
	}
	return n, nil
}

// ---------------------------------------------------------------------------
// 共通ヘルパ: scan / runner / modifiers JSON
// ---------------------------------------------------------------------------

// runner は tx が nil なら *sql.DB、非 nil なら *sql.Tx を返す共通の Exec/Query 実行器。
type sqlRunner interface {
	ExecContext(ctx context.Context, query string, args ...any) (sql.Result, error)
	QueryContext(ctx context.Context, query string, args ...any) (*sql.Rows, error)
	QueryRowContext(ctx context.Context, query string, args ...any) *sql.Row
}

func (r *repository) runner(tx *sql.Tx) sqlRunner {
	if tx != nil {
		return tx
	}
	return r.db
}

// scannerRow は QueryRow / Rows どちらでも使える Scan インタフェース。
type scannerRow interface {
	Scan(dest ...any) error
}

// scanCombo は combos テーブルの 1 行を model.Combo にマップする。
func (r *repository) scanCombo(ctx context.Context, row scannerRow) (*model.Combo, error) {
	c := &model.Combo{}
	err := row.Scan(
		&c.ID, &c.CharacterID, &c.IsDraft, &c.Damage,
		&c.DriveAvailableAtStart, &c.SAAvailableAtStart, &c.DriveDamage,
		&c.SAGaugeConsumed, &c.DriveGaugeConsumed,
		&c.StarterMoveID,
		&c.Position, &c.OpponentStance, &c.HitType, &c.OpponentSize,
		&c.StarterMeaty,
		&c.Situation,
		&c.KnockdownAdvantage, &c.OkiVerified, &c.Memo,
		&c.Link, &c.VideoPath, &c.ImagePath,
		&c.StepCount,
		&c.RecipeCache,
		&c.Version, &c.CreatedAt, &c.UpdatedAt, &c.DeletedAt,
		&c.MaterializedFromComboID,
		&c.SupersededByComboID,
		&c.BaselineVersion,
		&c.StartPositionMass, &c.CarryDistanceMass,
		&c.AffectedByGameUpdate,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("scan combo: %w", err)
	}
	_ = ctx
	return c, nil
}

// scanStep は combo_steps の 1 行(JOIN moves.code 含む)を model.ComboStep にマップする。
func scanStep(row scannerRow) (model.ComboStep, error) {
	var s model.ComboStep
	var modifiersJSON sql.NullString
	if err := row.Scan(&s.ID, &s.ComboID, &s.StepOrder, &s.MoveID, &modifiersJSON, &s.MoveCode); err != nil {
		return s, fmt.Errorf("scan step: %w", err)
	}
	if modifiersJSON.Valid {
		mods, err := unmarshalModifiers(modifiersJSON.String)
		if err != nil {
			return s, fmt.Errorf("unmarshal modifiers: %w", err)
		}
		s.Modifiers = mods
	}
	return s, nil
}

// marshalModifiers は *Modifiers を JSON 文字列に変換する(SQL バインド用)。
// nil なら NULL バインドのため *string nil を返す。
func marshalModifiers(m *model.Modifiers) (any, error) {
	if m == nil {
		return nil, nil
	}
	bytes, err := json.Marshal(m)
	if err != nil {
		return nil, err
	}
	return string(bytes), nil
}

// unmarshalModifiers は JSON 文字列を *Modifiers に変換する。
func unmarshalModifiers(jsonStr string) (*model.Modifiers, error) {
	if jsonStr == "" || jsonStr == "null" {
		return nil, nil
	}
	var m model.Modifiers
	if err := json.Unmarshal([]byte(jsonStr), &m); err != nil {
		return nil, err
	}
	return &m, nil
}

// ---------------------------------------------------------------------------
// M1-04: recipe_cache カラム操作
// ---------------------------------------------------------------------------

// GetRecipeCache は combos.recipe_cache を返す。論理削除済みコンボは対象外(ErrNotFound)。
//
// ★M23-03 §4.2: deleted_at IS NULL は「現に実害が出ているから」ではなく
// 「別の経路の副作用に守られているだけの状態をやめるため」に足してある。
// 論理削除時に SetRecipeCacheNullTx がキャッシュを NULL 化しているので、
// 述語が無くても戻り値は (nil, nil) になっていた——が、削除時のキャッシュ削除の
// 扱いが将来変わると、この穴は静かに開く。
// ★setups 側(repository/setup.GetRecipeCache)と対であり、片方だけ塞がないこと。
func (r *repository) GetRecipeCache(ctx context.Context, comboID int64) (*string, error) {
	var cache sql.NullString
	err := r.db.QueryRowContext(ctx,
		`SELECT recipe_cache FROM combos WHERE id = ? AND deleted_at IS NULL`, comboID).Scan(&cache)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("get recipe cache: %w", err)
	}
	if !cache.Valid {
		return nil, nil
	}
	return &cache.String, nil
}

func (r *repository) UpdateRecipeCache(ctx context.Context, comboID int64, cacheJSON string) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE combos SET recipe_cache = ?, updated_at = datetime('now') WHERE id = ?`,
		cacheJSON, comboID)
	if err != nil {
		return fmt.Errorf("update recipe cache: %w", err)
	}
	return nil
}

func (r *repository) UpdateRecipeCacheTx(ctx context.Context, tx *sql.Tx, comboID int64, cacheJSON string) error {
	_, err := tx.ExecContext(ctx,
		`UPDATE combos SET recipe_cache = ? WHERE id = ?`,
		cacheJSON, comboID)
	if err != nil {
		return fmt.Errorf("update recipe cache tx: %w", err)
	}
	return nil
}

func (r *repository) SetRecipeCacheNullTx(ctx context.Context, tx *sql.Tx, comboID int64) error {
	_, err := tx.ExecContext(ctx,
		`UPDATE combos SET recipe_cache = NULL WHERE id = ?`, comboID)
	if err != nil {
		return fmt.Errorf("set recipe cache null: %w", err)
	}
	return nil
}

const listAllActiveCombosSQL = comboSelectSQL + `
WHERE deleted_at IS NULL`

func (r *repository) ListAllActiveCombosTx(ctx context.Context, tx *sql.Tx) ([]*model.Combo, error) {
	rows, err := r.runner(tx).QueryContext(ctx, listAllActiveCombosSQL)
	if err != nil {
		return nil, fmt.Errorf("list all active combos: %w", err)
	}
	defer rows.Close()

	combos := make([]*model.Combo, 0)
	for rows.Next() {
		c, err := r.scanCombo(ctx, rows)
		if err != nil {
			return nil, err
		}
		combos = append(combos, c)
	}
	return combos, rows.Err()
}

func (r *repository) FindStepsByComboIDTx(ctx context.Context, tx *sql.Tx, comboID int64) ([]model.ComboStep, error) {
	exec := r.runner(tx)
	rows, err := exec.QueryContext(ctx, selectStepsByComboIDSQL, comboID)
	if err != nil {
		return nil, fmt.Errorf("find steps by combo id tx: %w", err)
	}
	defer rows.Close()

	steps := make([]model.ComboStep, 0)
	for rows.Next() {
		step, err := scanStep(rows)
		if err != nil {
			return nil, err
		}
		steps = append(steps, step)
	}
	return steps, rows.Err()
}

// ---------------------------------------------------------------------------
// M3-02: combo_tags 操作
// ---------------------------------------------------------------------------

// ReplaceTagAssociations は combo_id に紐付く combo_tags のうち
// 「userID のタグとの紐づけ」だけを tagIDs で置き換える。
// tagIDs が空の場合は当該利用者の関連のみ全削除する。FK 制約違反は呼び出し元に伝播させる。
//
// ★★ 他の利用者の紐づけを消さないこと(M22-02 §4.5-14＝D-405) ★★
// コンボは全員で共有し(FR013 前半)、タグは利用者ごとに閉じている(D-402)。
// combo_tags は (combo_id, tag_id) の 2 列で利用者の列を持たないため、
// combo_id だけで全消しすると、保存した本人には見えていない他人の紐づけまで消える。
// ★消えても双方の画面に何も出ない。1 人目のマイコンボから項目が静かに落ちるだけで、
// テストが無ければ永久に気づかれない。⇒ 破壊確認 C がこの一行を守っている。
//
// ★所有者は tag_id から tags.user_id へたどる。combo_tags に列は足さない(§4.5-17)
// ——足すと tags.user_id と二重に持つことになり、ずれる余地が生まれる。
func (r *repository) ReplaceTagAssociations(ctx context.Context, tx *sql.Tx, comboID, userID int64, tagIDs []int64) error {
	exec := r.runner(tx)

	const deleteOwnTags = `
		DELETE FROM combo_tags
		WHERE combo_id = ?
		  AND tag_id IN (SELECT id FROM tags WHERE user_id = ?)`
	if _, err := exec.ExecContext(ctx, deleteOwnTags, comboID, userID); err != nil {
		return fmt.Errorf("delete combo_tags: %w", err)
	}

	if len(tagIDs) == 0 {
		return nil
	}

	placeholders := make([]string, len(tagIDs))
	args := make([]any, 0, len(tagIDs)*2)
	for i, tagID := range tagIDs {
		placeholders[i] = "(?, ?)"
		args = append(args, comboID, tagID)
	}
	query := fmt.Sprintf(`INSERT INTO combo_tags (combo_id, tag_id) VALUES %s`,
		strings.Join(placeholders, ", "))

	if _, err := exec.ExecContext(ctx, query, args...); err != nil {
		return fmt.Errorf("insert combo_tags: %w", err)
	}
	return nil
}

// findTagsByComboIDs は combo_id IN 句で一括タグ取得する(2クエリ方式の Step2)。
// 戻り値は combo_id → []Tag のマップ。
func (r *repository) findTagsByComboIDs(ctx context.Context, comboIDs []int64) (map[int64][]model.Tag, error) {
	if len(comboIDs) == 0 {
		return map[int64][]model.Tag{}, nil
	}

	placeholders := make([]string, len(comboIDs))
	args := make([]any, len(comboIDs))
	for i, id := range comboIDs {
		placeholders[i] = "?"
		args[i] = id
	}
	query := fmt.Sprintf(`
SELECT ct.combo_id, t.id, t.user_id, t.name, t.category, t.color
FROM combo_tags ct
INNER JOIN tags t ON t.id = ct.tag_id
WHERE ct.combo_id IN (%s)
ORDER BY ct.combo_id, t.id`, strings.Join(placeholders, ","))

	rows, err := r.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("find tags for combos: %w", err)
	}
	defer rows.Close()

	result := map[int64][]model.Tag{}
	for rows.Next() {
		var comboID int64
		var tag model.Tag
		var category, color sql.NullString
		if err := rows.Scan(&comboID, &tag.ID, &tag.UserID, &tag.Name, &category, &color); err != nil {
			return nil, fmt.Errorf("scan tag row: %w", err)
		}
		if category.Valid {
			tag.Category = &category.String
		}
		if color.Valid {
			tag.Color = &color.String
		}
		result[comboID] = append(result[comboID], tag)
	}
	return result, rows.Err()
}

// ---------------------------------------------------------------------------
// M16-03: combo_oki_options 操作(起き攻め正規化)
// ---------------------------------------------------------------------------

// ReplaceOkiOptions は combo_id に紐付く combo_oki_options を opts で置き換える。
// opts が空の場合は既存オプションを全削除する(combo_tags と同じ delete-all-then-insert)。
func (r *repository) ReplaceOkiOptions(ctx context.Context, tx *sql.Tx, comboID int64, opts []model.OkiOption) error {
	exec := r.runner(tx)

	if _, err := exec.ExecContext(ctx, `DELETE FROM combo_oki_options WHERE combo_id = ?`, comboID); err != nil {
		return fmt.Errorf("delete combo_oki_options: %w", err)
	}

	if len(opts) == 0 {
		return nil
	}

	placeholders := make([]string, len(opts))
	args := make([]any, 0, len(opts)*4)
	for i, o := range opts {
		placeholders[i] = "(?, ?, ?, ?)"
		args = append(args, comboID, o.AttackType, o.TechType, o.UsesDR)
	}
	query := fmt.Sprintf(
		`INSERT INTO combo_oki_options (combo_id, attack_type, tech_type, uses_dr) VALUES %s`,
		strings.Join(placeholders, ", "))

	if _, err := exec.ExecContext(ctx, query, args...); err != nil {
		return fmt.Errorf("insert combo_oki_options: %w", err)
	}
	return nil
}

// FindOkiOptionsByComboID は単一コンボの起き攻めオプションを返す。
func (r *repository) FindOkiOptionsByComboID(ctx context.Context, comboID int64) ([]model.OkiOption, error) {
	m, err := r.FindOkiOptionsForCombos(ctx, []int64{comboID})
	if err != nil {
		return nil, err
	}
	if opts, ok := m[comboID]; ok {
		return opts, nil
	}
	return []model.OkiOption{}, nil
}

// FindOkiOptionsForCombos は combo_id IN 句で一括取得する(2クエリ方式の Step2)。
// 戻り値は combo_id → []OkiOption のマップ。
func (r *repository) FindOkiOptionsForCombos(ctx context.Context, comboIDs []int64) (map[int64][]model.OkiOption, error) {
	if len(comboIDs) == 0 {
		return map[int64][]model.OkiOption{}, nil
	}

	placeholders := make([]string, len(comboIDs))
	args := make([]any, len(comboIDs))
	for i, id := range comboIDs {
		placeholders[i] = "?"
		args[i] = id
	}
	query := fmt.Sprintf(`
SELECT combo_id, attack_type, tech_type, uses_dr
FROM combo_oki_options
WHERE combo_id IN (%s)
ORDER BY combo_id, attack_type, tech_type, uses_dr`, strings.Join(placeholders, ","))

	rows, err := r.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("find oki options for combos: %w", err)
	}
	defer rows.Close()

	result := map[int64][]model.OkiOption{}
	for rows.Next() {
		var comboID int64
		var o model.OkiOption
		if err := rows.Scan(&comboID, &o.AttackType, &o.TechType, &o.UsesDR); err != nil {
			return nil, fmt.Errorf("scan oki option row: %w", err)
		}
		result[comboID] = append(result[comboID], o)
	}
	return result, rows.Err()
}

// deref は *int64 を int64 に(nil 安全)。
func deref(p *int64) int64 {
	if p == nil {
		return 0
	}
	return *p
}

// derefStr は *string を string に(nil 安全)。
func derefStr(p *string) string {
	if p == nil {
		return ""
	}
	return *p
}
