package combo

import (
	"time"

	// M19-07: 同時登録セットプレイの「確認できた条件」の DTO を再利用するため
	// ハンドラ層内で api/setup を参照する(型を 2 つ作らない)。
	//
	// ★制約: この参照は combo → setup の一方向に限る。api/setup 側から api/combo を
	// import すると即座に循環する(現時点で api/setup は api/combo を import していない)。
	// setup 側が combo の DTO を要る形になったら、共有パッケージへ切り出すこと。
	setupapi "github.com/plexiblinp/tacpendium/internal/api/setup"
	"github.com/plexiblinp/tacpendium/internal/model"
	comborepo "github.com/plexiblinp/tacpendium/internal/repository/combo"
	combosvc "github.com/plexiblinp/tacpendium/internal/service/combo"
	setupsvc "github.com/plexiblinp/tacpendium/internal/service/setup"
	"github.com/plexiblinp/tacpendium/internal/service/validation"
)

// ===========================================================================
// リクエスト DTO
// ===========================================================================

// CreateRequest は POST /api/combos と PUT /api/combos/:id(キー変更編集)の入力。
//
// Q4 確定: Name フィールドは持たない(combos スキーマに name カラム未定義)。
// 起き攻め BOOLEAN は CHANGE-001 反映後の 6 カラム。CHANGE-006 で counter_type → hit_type。
type CreateRequest struct {
	CharacterID    int64   `json:"characterId"`
	IsDraft        bool    `json:"isDraft"`
	Damage         *int    `json:"damage,omitempty"`
	StarterMoveID  *int64  `json:"starterMoveId,omitempty"`
	Position       *string `json:"position,omitempty"`
	OpponentStance *string `json:"opponentStance,omitempty"`
	// StartPositionMass は始動位置のマス数(0〜160・M28-02a)。
	// ★★保存の正本はこちら。省略時は position の代表値がサーバ側で入る
	//   ⇒ 既存のエディタ(区分だけを送る)は無改修で動く。
	// ★両方送られたときはマス数が勝ち、position はマス数から導出し直される。
	StartPositionMass *int `json:"startPositionMass,omitempty"`
	// CarryDistanceMass は運び量(0〜160・M28-02a)。★始動位置とは別の値であり区分へ丸めない。
	CarryDistanceMass *int    `json:"carryDistanceMass,omitempty"`
	HitType           *string `json:"hitType,omitempty"`
	OpponentSize      *string `json:"opponentSize,omitempty"`
	// StarterMeaty は始動技を持続当てしたか(M37-07・重複判定キーの 8 つ目・D-874)。
	// ★省略は false(通常始動)。列は NOT NULL DEFAULT 0 である。
	// ★★omitempty を付けない —— 同じファイルの ComboResponse / DuplicateInfoResponse が
	//   「false も情報だからキーを消さない」として外している。**同一概念に 2 つの流儀を
	//   並べない**(レビュー 中-7)。要求 DTO を JSON 化して投げる経路で false が落ちるのも防ぐ。
	// ★★PATCH(UpdateMetadataRequest)には**載せない**——識別キーだからである
	//   (CHANGE-195 §2.4＝「本経路が触るのは識別キーが変わらない編集だけである」)。
	//   ⇒ この欄を変える編集は PUT へ行く。
	StarterMeaty          bool     `json:"starterMeaty"`
	DriveAvailableAtStart *float64 `json:"driveAvailableAtStart,omitempty"`
	SAAvailableAtStart    *int     `json:"saAvailableAtStart,omitempty"`
	DriveDamage           *float64 `json:"driveDamage,omitempty"`
	SAGaugeConsumed       *int     `json:"saGaugeConsumed,omitempty"`    // 消費 SA(0〜6・M16-02)。VAL 非連動
	DriveGaugeConsumed    *float64 `json:"driveGaugeConsumed,omitempty"` // 消費 drive(0〜20・0.5 刻み・M16-02)。VAL 非連動
	KnockdownAdvantage    *int     `json:"knockdownAdvantage,omitempty"`
	// OkiVerified は起き攻めを一度でも調べたか(M27-02b)。★省略は false(未検証)。
	OkiVerified bool    `json:"okiVerified,omitempty"`
	Memo        *string `json:"memo,omitempty"`
	Situation   *string `json:"situation,omitempty"` // JSON 文字列
	Link        *string `json:"link,omitempty"`      // 外部リンク URL(M17-01)。緩検証・文字列参照のみ
	VideoPath   *string `json:"videoPath,omitempty"` // 動画の相対パス(M17-01)。本体は解決・再生しない
	ImagePath   *string `json:"imagePath,omitempty"` // 画像の相対パス(M17-01)。本体は解決・表示読込しない
	// 起き攻めオプション(combo_oki_options・M16-03 正規化)。空/nil は成立するオプション無し。★「調べたか」は okiVerified が持つ(M27-02b)。
	OkiOptions []OkiOptionDTO `json:"okiOptions,omitempty"`
	Steps      []StepRequest  `json:"steps,omitempty"`
	TagIDs     []int64        `json:"tagIds,omitempty"`
	// M4-04: コンボ同時登録セットプレイ。未指定/空配列で従来動作。
	Setups []BundledSetupRequest `json:"setups,omitempty"`
	// SetupCarryOptions は knockdownAdvantage 変更時のセットプレイ引き継ぎ方式(M4-03)。
	SetupCarryOptions *SetupCarryOptionsRequest `json:"setupCarryOptions,omitempty"`
}

// OkiOptionDTO は起き攻めオプション 1 件の API 表現(M16-03 正規化)。
// 内部コード値(attackType=throw_meaty/shimmy/strike_meaty、techType=neutral_tech/back_tech、
// usesDr=ドライブラッシュ有無)を保持する。表示ラベルはフロント側で解決する。
type OkiOptionDTO struct {
	AttackType string `json:"attackType"`
	TechType   string `json:"techType"`
	UsesDr     bool   `json:"usesDr"`
}

// okiOptionsToModel は DTO の起き攻めオプション列を model.OkiOption 列へ変換する。
func okiOptionsToModel(dtos []OkiOptionDTO) []model.OkiOption {
	if dtos == nil {
		return nil
	}
	out := make([]model.OkiOption, len(dtos))
	for i, d := range dtos {
		out[i] = model.OkiOption{
			AttackType: d.AttackType,
			TechType:   d.TechType,
			UsesDR:     d.UsesDr,
		}
	}
	return out
}

// okiOptionsToDTO は model.OkiOption 列を DTO 列へ変換する(常に非 nil)。
func okiOptionsToDTO(opts []model.OkiOption) []OkiOptionDTO {
	out := make([]OkiOptionDTO, 0, len(opts))
	for _, o := range opts {
		out = append(out, OkiOptionDTO{
			AttackType: o.AttackType,
			TechType:   o.TechType,
			UsesDr:     o.UsesDR,
		})
	}
	return out
}

// StepRequest はレシピステップの入力(SUPP-001 §3.3.0 型付き Modifiers)。
type StepRequest struct {
	StepOrder int              `json:"stepOrder"`
	MoveID    *int64           `json:"moveId,omitempty"`
	Modifiers *model.Modifiers `json:"modifiers,omitempty"`
}

// BundledSetupRequest は POST /api/combos の同時登録セットプレイ入力（M4-04）。
// parent_combo_id は DTO に含めない（VAL-S05 / CHANGE-012 §6.2 R-2 対策）。
type BundledSetupRequest struct {
	CharacterID int64                     `json:"characterId"`
	Name        *string                   `json:"name,omitempty"`
	Description *string                   `json:"description,omitempty"`
	Steps       []BundledSetupStepRequest `json:"steps"`
	// VerifiedConditions は同時登録時にチェックされた「確認できた条件」(M19-07)。
	// CreateSetupRequest(セットプレイ単独作成)にあった形をこちらへ揃えたものであり、
	// 型は internal/api/setup の同名型をそのまま使う(同名で中身が違う型を 2 つ作らない)。
	// 省略・空配列でよい(チェックせずに登録できる)。記録されるのは成立(ok)のみで、
	// 不成立と note はここでは扱わない。追加のみの後方互換。
	VerifiedConditions []setupapi.SetupResultConditionRequest `json:"verifiedConditions,omitempty"`
}

// BundledSetupStepRequest はセットプレイステップの入力（M4-04）。
type BundledSetupStepRequest struct {
	MoveID    *int64           `json:"moveId,omitempty"`
	Modifiers *model.Modifiers `json:"modifiers,omitempty"`
}

// UpdateMetadataRequest は PATCH /api/combos/:id の入力。
//
// Version は楽観的排他のため必須。nullable メタデータは comborepo.Optional[T] による
// presence-detection トライステート(CHANGE-043 / DES-002 v1.23.0 §4.2):
// キー不在=不変更 / JSON null=NULL クリア / 値あり=更新。Optional.UnmarshalJSON が
// キーの存在を検出するため、c.Bind(json.Decoder)で3状態を判別できる。
// IsDraft は非 nullable(NULL クリア対象外)のため *bool のまま。
// CHANGE-008: driveAvailableAtStart / saAvailableAtStart / driveDamage を追加。
type UpdateMetadataRequest struct {
	Version               int                         `json:"version"`
	IsDraft               *bool                       `json:"isDraft,omitempty"`
	Damage                comborepo.Optional[int]     `json:"damage"`
	DriveAvailableAtStart comborepo.Optional[float64] `json:"driveAvailableAtStart"`
	SAAvailableAtStart    comborepo.Optional[int]     `json:"saAvailableAtStart"`
	DriveDamage           comborepo.Optional[float64] `json:"driveDamage"`
	SAGaugeConsumed       comborepo.Optional[int]     `json:"saGaugeConsumed"`    // 消費 SA(0〜6・M16-02)。VAL 非連動
	DriveGaugeConsumed    comborepo.Optional[float64] `json:"driveGaugeConsumed"` // 消費 drive(0〜20・0.5 刻み・M16-02)。VAL 非連動
	KnockdownAdvantage    comborepo.Optional[int]     `json:"knockdownAdvantage"`
	// StartPositionMass / CarryDistanceMass は始動位置のマス数と運び量(0〜160・M28-02a)。
	//
	// ★★M37-01 で PATCH へ追加した(2026-09-13 開発者裁定)。着手前は POST(CreateRequest)と
	//   PUT(PutRequest)にしか無く、★編集モードでマス数・運び量だけを直すと値が黙って落ちた。
	//   ⇒ 3 方式入力 UI を画面へ出す以上、メタデータ経路でも保存できる必要がある。
	// ★PUT へ載せる案は採らなかった —— PUT は旧行を論理削除して新規行を作る経路であり、
	//   運び量は重複キーではないため、直しただけでコンボ id が変わってしまう。
	// ★区分(position)はここに無い。⇒ 本経路はキー不変の PATCH であり、区分をまたぐ
	//   マス変更はフロントが PUT へ振り分ける(effectivePosition・DES-005 §5.7 (a))。
	StartPositionMass comborepo.Optional[int] `json:"startPositionMass"`
	CarryDistanceMass comborepo.Optional[int] `json:"carryDistanceMass"`
	// ★Optional である。**省略と false を区別するため**——値型だと、本欄を持たない
	//   古い要求本文が「未検証へ戻す」意味になる。
	OkiVerified comborepo.Optional[bool]   `json:"okiVerified"`
	Memo        comborepo.Optional[string] `json:"memo"`
	// Situation は custom_states の格納先(JSON 文字列、CHANGE-041)。
	// custom_states 単独編集(識別キー不変)は PATCH 経路を通る。null=クリア(CHANGE-043)。
	Situation comborepo.Optional[string] `json:"situation"`
	// メディア 3 列(M17-01)。memo と同じ presence-detection トライステート(null=クリア)。
	Link      comborepo.Optional[string] `json:"link"`
	VideoPath comborepo.Optional[string] `json:"videoPath"`
	ImagePath comborepo.Optional[string] `json:"imagePath"`
	// OkiOptions は起き攻めオプションの replace-set(M16-03 正規化)。
	// nil(キー不在) = 変更しない、非 nil(空配列含む) = 全置換。TagIDs と同じ方式。
	OkiOptions *[]OkiOptionDTO `json:"okiOptions"`
	TagIDs     *[]int64        `json:"tagIds,omitempty"`
	// SetupCarryOptions は knockdownAdvantage 変更時のセットプレイ引き継ぎ方式(M4-03)。
	SetupCarryOptions *SetupCarryOptionsRequest `json:"setupCarryOptions,omitempty"`
}

// SetupCarryOptionsRequest は knockdownAdvantage 変更時のセットプレイ引き継ぎ選択肢(M4-03)。
type SetupCarryOptionsRequest struct {
	Mode          string  `json:"mode"`
	CarrySetupIDs []int64 `json:"carrySetupIds,omitempty"`
}

// PutRequest は PUT /api/combos/:id(キー変更編集)の入力。
// Version は旧コンボの楽観的排他確認のため必須。
type PutRequest struct {
	Version int `json:"version"`
	CreateRequest
}

// ===========================================================================
// レスポンス DTO
// ===========================================================================

// SetupSummary はコンボ詳細レスポンス内のセットプレイサマリ(案 B1 対応)。
// フロント側 SetupResponse と同一フィールドを持つ。
type SetupSummary struct {
	ID            int64   `json:"id"`
	CharacterID   int64   `json:"characterId"`
	Name          *string `json:"name,omitempty"`
	Description   *string `json:"description,omitempty"`
	StepCount     int     `json:"stepCount"`
	Version       int     `json:"version"`
	DefaultRecipe string  `json:"defaultRecipe"`
	// ParentComboIDs は「このセットプレイが使われている**生存**コンボ」の id。
	// ★論理削除済みのコンボは載らない(M23-03 §4.5)。判定の母集団には使えない——
	//   検証(重複チェック等)は repository/setup.FindComboIDsBySetupIDAllowDeleted を使うこと。
	ParentComboIds []int64 `json:"parentComboIds"`
	// Results はこのコンボ × このセットプレイの組の成立条件(M19-03 §4.3.1 の (a))。
	// 詳細取得(GET /api/combos/:id)でのみ埋める。一覧では項目10 を描かないため
	// 取得せず、omitempty によりキー自体が出ない。**追加のみの後方互換**。
	//
	// 行が無いセル = 未検証。したがって空配列/キー無しは「全 4 セル未検証」を意味する。
	Results []model.ComboSetupResult `json:"results,omitempty"`
}

// ComboResponse は単一コンボの API レスポンス(POST 201、GET 200、PATCH 200、PUT 201)。
//
// ★PUT /api/combos/:id(キー変更編集)だけが 201 を返す。同経路は旧行を論理削除して
// 新しい id で採番し直すため、返る id はリクエストの :id とは別物である(M23-01 §10-1 の
// as-built。D-413)。
type ComboResponse struct {
	ID             int64   `json:"id"`
	CharacterID    int64   `json:"characterId"`
	IsDraft        bool    `json:"isDraft"`
	Damage         *int    `json:"damage,omitempty"`
	StarterMoveID  *int64  `json:"starterMoveId,omitempty"`
	Position       *string `json:"position,omitempty"`
	OpponentStance *string `json:"opponentStance,omitempty"`
	HitType        *string `json:"hitType,omitempty"`
	OpponentSize   *string `json:"opponentSize,omitempty"`
	// StarterMeaty は始動技を持続当てしたか(M37-07)。
	// ★omitempty を付けない —— false は「通常始動である」という情報であり、
	//   キーごと消えると「持っていない」と区別が付かなくなる(OkiVerified と同じ扱い)。
	StarterMeaty          bool           `json:"starterMeaty"`
	DriveAvailableAtStart *float64       `json:"driveAvailableAtStart,omitempty"`
	SAAvailableAtStart    *int           `json:"saAvailableAtStart,omitempty"`
	DriveDamage           *float64       `json:"driveDamage,omitempty"`
	SAGaugeConsumed       *int           `json:"saGaugeConsumed,omitempty"`    // 消費 SA(0〜6・M16-02)。VAL 非連動
	DriveGaugeConsumed    *float64       `json:"driveGaugeConsumed,omitempty"` // 消費 drive(0〜20・0.5 刻み・M16-02)。VAL 非連動
	KnockdownAdvantage    *int           `json:"knockdownAdvantage,omitempty"`
	OkiVerified           bool           `json:"okiVerified"`
	Memo                  *string        `json:"memo,omitempty"`
	Situation             *string        `json:"situation,omitempty"`
	Link                  *string        `json:"link,omitempty"`      // 外部リンク URL(M17-01)
	VideoPath             *string        `json:"videoPath,omitempty"` // 動画の相対パス(M17-01)
	ImagePath             *string        `json:"imagePath,omitempty"` // 画像の相対パス(M17-01)
	OkiOptions            []OkiOptionDTO `json:"okiOptions"`          // M16-03: 常に非 nil(オプションなしは空配列)
	StepCount             int            `json:"stepCount"`
	DefaultRecipe         string         `json:"defaultRecipe"`
	StarterMoveCode       string         `json:"starterMoveCode"`
	// StarterMoveNameJa は始動技の表示名(公式日本語)。未登録なら省略される(M24-07)。
	// ★画面はこちらを出し、引けないときだけ starterMoveCode へ落ちる。
	StarterMoveNameJa *string    `json:"starterMoveNameJa,omitempty"`
	Version           int        `json:"version"`
	CreatedAt         time.Time  `json:"createdAt"`
	UpdatedAt         time.Time  `json:"updatedAt"`
	DeletedAt         *time.Time `json:"deletedAt,omitempty"` // ゴミ箱 API 用(通常コンボは nil)
	// MaterializedFromComboID は materialize 生成物の出自(基底コンボ id)。生成元バッジ用(M18-03b)。
	// 通常コンボは nil。DES-003 §3.4: dup / recipe 非対象・CSV には出さない。
	MaterializedFromComboID *int64 `json:"materializedFromComboId,omitempty"`
	// SupersededByComboID は「この行を置き換えた後継コンボの id」(M23-01 / CHANGE-121)。
	// PUT(キー変更編集)で積まれた旧行だけが値を持つ。通常コンボ・手動削除行は nil。
	// 推測: DTO へ出す側を採ったと仮定した(指示書 §9.2-2 が製造判断へ委ねている)。理由は
	// 指示書 §2.1 がフロント型 3 分岐への追加を成果物に挙げており、バックエンドが返さない
	// 値をフロント型が持つと型が実態と食い違うため。画面は本値を読まない(§1.3-1 のとおり
	// 変更履歴ビューは作らない)。DES-003 §3.4: dup / recipe 非対象・CSV には出さない。
	SupersededByComboID *int64 `json:"supersededByComboId,omitempty"`
	// BaselineVersion は「このコンボが前提としているゲームバージョン」(FR702・M28-02a)。
	// ★JSON は camelCase(CLAUDE.md §4)。
	// StartPositionMass は始動位置のマス数(0〜160・M28-02a)。
	StartPositionMass *int `json:"startPositionMass,omitempty"`
	// CarryDistanceMass は運び量(0〜160・M28-02a)。
	CarryDistanceMass *int    `json:"carryDistanceMass,omitempty"`
	BaselineVersion   *string `json:"baselineVersion,omitempty"`
	// AffectedByGameUpdate は「このコンボが使っている技のうち、コンボの基準より後に
	// 変わったものが 1 つでもあるか」(FR702 の判定・M28-02a)。
	//
	// ★★保存していない。SELECT のたびに導出する値である。
	// ★★これは「影響可能性」であって破綻の断定ではない(FR307)。
	//   検証は利用者に委ねる。画面側の語も「壊れている」にしないこと。
	// ★omitempty を付けない —— false は「影響なし」という意味を持つ情報であり、
	//   キーごと消えると「判定していない」と区別が付かなくなる。
	AffectedByGameUpdate bool `json:"affectedByGameUpdate"`
	// AffectedMoves は「実際に基準より後に変わった技」の一覧(FR702 の目的そのもの・
	// M28-02c / CHANGE-162 §1)。
	//
	// ★★真偽の正本は AffectedByGameUpdate の 1 本である。
	//   ⇒ 画面側で affectedMoves.length > 0 から影響の有無を判定しないこと。
	//     長さで判定すると真偽が 2 か所で表せてしまい、それ自体が
	//     「判定条件を 2 か所に書く」の再発である。
	// ★omitempty を付けない —— 空でも [] を明示する(AffectedByGameUpdate に
	//   omitempty を付けなかったのと同じ理由。キーが消えると「判定していない」と
	//   区別が付かなくなる)。
	AffectedMoves []model.AffectedMove         `json:"affectedMoves"`
	Steps         []StepResponse               `json:"steps,omitempty"` // 一覧 API では nil(N+1 防止、§4.11)
	Tags          []model.Tag                  `json:"tags"`            // M3-02: 常に非 nil(タグなしは空配列)
	Validations   *validation.ValidationResult `json:"validations,omitempty"`
	Setups        []SetupSummary               `json:"setups"` // 詳細取得時のみ。M4-02(案 B1)
	// Warnings は復元の成功応答へ載せる注意事項(M23-04 §4.3・DES-002 §4.2)。
	//
	// ★設定するのは POST /api/combos/{id}/restore(M23-04)と POST /api/combos(M23-05)の
	// 2 経路である。一覧・詳細・PUT・PATCH は nil のままであり、omitempty で JSON へ出ない。
	// ★M23-04 §1.6-2 は「既存の登録・更新経路へ warnings を遡って足さない」としていたが、
	//   それは同サブの射程を守るための線であって恒久の禁止ではなく、M23-05 §4.6 が
	//   登録経路へ解禁した(VAL-C14)。★PUT へは足していない——PUT は旧行を論理削除して
	//   新行を積む方式であり、走らせると編集のたびに自分の旧行に当たる(M23-05 §4.5-1)。
	// ★警告 0 件のときも出さない。空配列を返すと、フロント側が「警告があった」と
	// 誤って分岐しうる(§4.3-2)。
	// ★Validations とは別フィールドである。あちらは 400 の details.validations と対に
	// なる「登録・更新時の検証結果」であり、こちらは「復元は成功した上での注意」である。
	Warnings []validation.ValidationIssue `json:"warnings,omitempty"`
}

// StepResponse は API レスポンス用のステップ。
type StepResponse struct {
	ID        int64            `json:"id"`
	StepOrder int              `json:"stepOrder"`
	MoveID    *int64           `json:"moveId,omitempty"`
	MoveCode  *string          `json:"moveCode,omitempty"`
	Modifiers *model.Modifiers `json:"modifiers,omitempty"`
}

// ListResponse は GET /api/combos のレスポンス。
type ListResponse struct {
	Items []ComboResponse `json:"items"`
	// Count は items の件数(= この応答に載った数)。
	Count int `json:"count"`
	// Total は絞り込みに一致する総数(LIMIT / OFFSET を掛けない数)。
	//
	// ★★Count と別に持つ理由 —— 一覧は既定 100 件・上限 1000 件でクランプされる
	// (internal/repository/combo)。Count だけでは「ちょうど 100 件だった」と
	// 「100 件で切り捨てた」を区別できず、呼び出し元は切り捨てに気づけない。
	// ⇒ Total > Count が「切り捨てた」の観測である(M29-02 §2.1)。
	// ★上限の値は 1 つも変えていない。数を返すだけである。
	Total int `json:"total"`
}

// RecipeResponse は GET /api/combos/:id/recipe?preset_id=X のレスポンス。
// notation.Service.ResolveComboRecipe を経由してプリセット解決後のレシピ文字列を返す
// (M1-04 §4.5.3 で M1-05 へ繰り越された任意エンドポイント)。
type RecipeResponse struct {
	ComboID  int64  `json:"comboId"`
	PresetID int64  `json:"presetId"`
	Text     string `json:"text"`
}

// CheckDuplicateRequest は POST /api/combos/check-duplicate の入力(M2-02)。
type CheckDuplicateRequest struct {
	CharacterID    int64         `json:"characterId"`
	StarterMoveID  *int64        `json:"starterMoveId,omitempty"`
	Position       *string       `json:"position,omitempty"`
	OpponentStance *string       `json:"opponentStance,omitempty"`
	HitType        *string       `json:"hitType,omitempty"`
	OpponentSize   *string       `json:"opponentSize,omitempty"`
	StarterMeaty   bool          `json:"starterMeaty"` // M37-07: 重複判定キーの 8 つ目
	Steps          []StepRequest `json:"steps"`
	ExcludeComboID *int64        `json:"excludeComboId,omitempty"`
}

// CheckDuplicateResponse は POST /api/combos/check-duplicate の出力(M2-02 / M23-09 §4.1-1)。
//
// ★★生きた側と削除済み側は別のキーで返す。混ぜないこと(M23-09 §4.1-1)——
// 画面は「生きた重複」ではダイアログを出さず(既に VAL-C02 が ERROR で止めている)、
// 「ゴミ箱の重複」でだけ保存前ダイアログを出す(§4.1-4)。
//
// ★0 件でもキーを出し空配列を返す。warnings(omitempty)とは逆であり、意図的である——
// 既存の duplicates が M2-02 からそうであり、画面は length で分岐している。
// omitempty にすると「キーが無い」と「0 件」の 2 通りを画面が扱うことになる。
type CheckDuplicateResponse struct {
	Duplicates []DuplicateInfoResponse `json:"duplicates"`
	// DeletedDuplicates はゴミ箱に居る一致(M23-09 §4.1-1)。母集団は VAL-C14 と同一。
	// ★形は model.ComboRef{id, memo} に揃える(D-417＝新しい見せ方を作らない)。
	DeletedDuplicates []model.ComboRef `json:"deletedDuplicates"`
}

// DuplicateInfoResponse は重複候補の構造化情報(v1.1.0)。
//
// ★キー項目(characterId 〜 starterMeaty)は要求値のエコーバックであり、一致した行から
// 読んだ値ではない。行から来るのは id / stepCount / memo の 3 つである。
type DuplicateInfoResponse struct {
	ID             int64   `json:"id"`
	CharacterID    int64   `json:"characterId"`
	StarterMoveID  *int64  `json:"starterMoveId"`
	Position       *string `json:"position"`
	OpponentStance *string `json:"opponentStance"`
	HitType        *string `json:"hitType"`
	OpponentSize   *string `json:"opponentSize"`
	StarterMeaty   bool    `json:"starterMeaty"` // M37-07。★omitempty を付けない(false も情報)
	StepCount      int     `json:"stepCount"`
	// Memo は「どのコンボか」を人が読める形で示す(M23-09 §4.1-3 / §3.3-4)。
	// ★combos に name 列は無く、memo がその役割を負う(model.ComboRef と同じ扱い)。
	Memo *string `json:"memo"`
}

// MaterializeRequest は POST /api/combos/{id}/materialize の入力(M18-03b §4.4)。
// {id}(パス)＝基底コンボ。opponentMoveId は必須(裁定7 により combo_punishes を同時作成)。
type MaterializeRequest struct {
	OpponentMoveID int64   `json:"opponentMoveId"`
	Note           *string `json:"note,omitempty"`
}

// MaterializeResponse は materialize の出力(M18-03b §4.4)。
// alreadyExisted=true のとき comboId は既存コンボの id(FE はリンクを出す)。
// damageSkipReason は加算しなかった理由コード(空=加算した or counter で不変)。
// NULL 系 3 種に加え、SA / CA の補正対象外を返す。FE が文言へ写像する(L-7)。
type MaterializeResponse struct {
	ComboID          int64  `json:"comboId"`
	AlreadyExisted   bool   `json:"alreadyExisted"`
	DamageAdded      bool   `json:"damageAdded"`
	DamageSkipReason string `json:"damageSkipReason,omitempty"`
}

// ===========================================================================
// 変換ヘルパ
// ===========================================================================

// toServiceCreateInput は CreateRequest をサービス層 CreateInput に変換する。
// toServiceCreateInput は API DTO をサービス層の入力へ変換する。
//
// ★userID は「誰として保存するか」。コンボ本体の所有者ではない
// (コンボは全員で共有する＝FR013 前半)。タグの紐づけをこの利用者の分だけ
// 入れ替えるために要る(M22-02 §4.5-14)。★渡し忘れると 0 になり、
// 「自分の紐づけを消して入れ直す」が空振りして主キー衝突で 500 になる。
func toServiceCreateInput(req CreateRequest, userID int64) combosvc.CreateInput {
	steps := make([]model.ComboStep, len(req.Steps))
	for i, sr := range req.Steps {
		steps[i] = model.ComboStep{
			StepOrder: sr.StepOrder,
			MoveID:    sr.MoveID,
			Modifiers: sr.Modifiers,
		}
	}
	input := combosvc.CreateInput{
		UserID:                userID,
		CharacterID:           req.CharacterID,
		IsDraft:               req.IsDraft,
		Damage:                req.Damage,
		StarterMoveID:         req.StarterMoveID,
		Position:              req.Position,
		StartPositionMass:     req.StartPositionMass,
		CarryDistanceMass:     req.CarryDistanceMass,
		OpponentStance:        req.OpponentStance,
		HitType:               req.HitType,
		OpponentSize:          req.OpponentSize,
		StarterMeaty:          req.StarterMeaty,
		DriveAvailableAtStart: req.DriveAvailableAtStart,
		SAAvailableAtStart:    req.SAAvailableAtStart,
		DriveDamage:           req.DriveDamage,
		SAGaugeConsumed:       req.SAGaugeConsumed,
		DriveGaugeConsumed:    req.DriveGaugeConsumed,
		KnockdownAdvantage:    req.KnockdownAdvantage,
		OkiVerified:           req.OkiVerified,
		Memo:                  req.Memo,
		Situation:             req.Situation,
		Link:                  req.Link,
		VideoPath:             req.VideoPath,
		ImagePath:             req.ImagePath,
		OkiOptions:            okiOptionsToModel(req.OkiOptions),
		Steps:                 steps,
		TagIDs:                req.TagIDs,
	}
	if req.SetupCarryOptions != nil {
		input.SetupCarryOptions = &comborepo.SetupCarryOptionsInput{
			Mode:          req.SetupCarryOptions.Mode,
			CarrySetupIDs: req.SetupCarryOptions.CarrySetupIDs,
		}
	}
	if len(req.Setups) > 0 {
		input.Setups = make([]setupsvc.CreateSetupInput, len(req.Setups))
		for i, sr := range req.Setups {
			setupSteps := make([]model.SetupStep, len(sr.Steps))
			for j, ss := range sr.Steps {
				setupSteps[j] = model.SetupStep{
					MoveID:    ss.MoveID,
					Modifiers: ss.Modifiers,
				}
			}
			// M19-07: 単独作成(api/setup の toServiceCreateInput)と同じ写像。
			// 値域の検証はサービス層(buildVerifiedResults)が行う。
			conditions := make([]setupsvc.SetupResultCondition, len(sr.VerifiedConditions))
			for k, cr := range sr.VerifiedConditions {
				conditions[k] = setupsvc.SetupResultCondition{TechType: cr.TechType, InCorner: cr.InCorner}
			}
			input.Setups[i] = setupsvc.CreateSetupInput{
				CharacterID:        sr.CharacterID,
				Name:               sr.Name,
				Description:        sr.Description,
				Steps:              setupSteps,
				VerifiedConditions: conditions,
			}
		}
	}
	return input
}

// toServiceUpdateMetadataInput は UpdateMetadataRequest をサービス層 UpdateMetadataInput に変換する。
// toServiceUpdateMetadataInput は API DTO をサービス層の入力へ変換する。
// ★userID の意味と、渡し忘れたときの症状は toServiceCreateInput を参照。
func toServiceUpdateMetadataInput(req UpdateMetadataRequest, userID int64) combosvc.UpdateMetadataInput {
	// nullable メタデータは Optional[T] を同一型でそのまま伝播(presence/null/値を保持)。
	input := combosvc.UpdateMetadataInput{
		UserID:                userID,
		IsDraft:               req.IsDraft,
		Damage:                req.Damage,
		DriveAvailableAtStart: req.DriveAvailableAtStart,
		SAAvailableAtStart:    req.SAAvailableAtStart,
		DriveDamage:           req.DriveDamage,
		SAGaugeConsumed:       req.SAGaugeConsumed,
		DriveGaugeConsumed:    req.DriveGaugeConsumed,
		KnockdownAdvantage:    req.KnockdownAdvantage,
		StartPositionMass:     req.StartPositionMass,
		CarryDistanceMass:     req.CarryDistanceMass,
		OkiVerified:           req.OkiVerified,
		Memo:                  req.Memo,
		Situation:             req.Situation,
		Link:                  req.Link,
		VideoPath:             req.VideoPath,
		ImagePath:             req.ImagePath,
		TagIDs:                req.TagIDs,
	}
	// 起き攻めオプションの replace-set(M16-03): nil=不変更 / 非 nil=全置換。
	if req.OkiOptions != nil {
		opts := okiOptionsToModel(*req.OkiOptions)
		if opts == nil {
			opts = []model.OkiOption{}
		}
		input.OkiOptions = &opts
	}
	if req.SetupCarryOptions != nil {
		input.SetupCarryOptions = &comborepo.SetupCarryOptionsInput{
			Mode:          req.SetupCarryOptions.Mode,
			CarrySetupIDs: req.SetupCarryOptions.CarrySetupIDs,
		}
	}
	return input
}

// toComboResponse は model.Combo を API レスポンス DTO に変換する。
// validations が nil でも空でもなく、Issues がある場合のみ Validations フィールドにセット。
func toComboResponse(combo *model.Combo, validations *validation.ValidationResult) ComboResponse {
	resp := ComboResponse{
		ID:                      combo.ID,
		CharacterID:             combo.CharacterID,
		IsDraft:                 combo.IsDraft,
		Damage:                  combo.Damage,
		StarterMoveID:           combo.StarterMoveID,
		Position:                combo.Position,
		OpponentStance:          combo.OpponentStance,
		HitType:                 combo.HitType,
		OpponentSize:            combo.OpponentSize,
		StarterMeaty:            combo.StarterMeaty,
		DriveAvailableAtStart:   combo.DriveAvailableAtStart,
		SAAvailableAtStart:      combo.SAAvailableAtStart,
		DriveDamage:             combo.DriveDamage,
		SAGaugeConsumed:         combo.SAGaugeConsumed,
		DriveGaugeConsumed:      combo.DriveGaugeConsumed,
		KnockdownAdvantage:      combo.KnockdownAdvantage,
		OkiVerified:             combo.OkiVerified,
		Memo:                    combo.Memo,
		Situation:               combo.Situation,
		Link:                    combo.Link,
		VideoPath:               combo.VideoPath,
		ImagePath:               combo.ImagePath,
		OkiOptions:              okiOptionsToDTO(combo.OkiOptions),
		StepCount:               combo.StepCount,
		DefaultRecipe:           combo.DefaultRecipe,
		StarterMoveCode:         derefString(combo.StarterMoveCode),
		StarterMoveNameJa:       combo.StarterMoveNameJa,
		Version:                 combo.Version,
		CreatedAt:               combo.CreatedAt,
		UpdatedAt:               combo.UpdatedAt,
		DeletedAt:               combo.DeletedAt,
		MaterializedFromComboID: combo.MaterializedFromComboID,
		SupersededByComboID:     combo.SupersededByComboID,
		StartPositionMass:       combo.StartPositionMass,
		CarryDistanceMass:       combo.CarryDistanceMass,
		BaselineVersion:         combo.BaselineVersion,
		AffectedByGameUpdate:    combo.AffectedByGameUpdate,
		AffectedMoves:           combo.AffectedMoves,
	}
	if combo.Steps != nil {
		resp.Steps = make([]StepResponse, len(combo.Steps))
		for i, s := range combo.Steps {
			resp.Steps[i] = StepResponse{
				ID:        s.ID,
				StepOrder: s.StepOrder,
				MoveID:    s.MoveID,
				MoveCode:  s.MoveCode,
				Modifiers: s.Modifiers,
			}
		}
	}
	// Tags は常に非 nil で返す(タグなしは空配列)
	if combo.Tags != nil {
		resp.Tags = combo.Tags
	} else {
		resp.Tags = []model.Tag{}
	}
	// AffectedMoves も常に非 nil で返す(空は [] を明示する。M28-02c / CHANGE-162 §1.2-5)。
	if resp.AffectedMoves == nil {
		resp.AffectedMoves = []model.AffectedMove{}
	}
	if validations != nil && len(validations.Issues) > 0 {
		resp.Validations = validations
	}
	return resp
}

func derefString(s *string) string {
	if s == nil {
		return ""
	}
	return *s
}
