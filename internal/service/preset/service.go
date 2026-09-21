package preset

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strconv"
	"strings"

	"github.com/plexiblinp/tacpendium/internal/model"
	presetrepo "github.com/plexiblinp/tacpendium/internal/repository/preset"
	"github.com/plexiblinp/tacpendium/internal/service/notation"
)

// PresetTotalLimit は全体プリセット数の上限(DES-006 VAL-P05)。
//
// 組み込み 3 件(M20-01 で 5 種 → 3 種)＋ カスタム 5 件 = 8 件。
// ★1 ユーザーあたりの上限は設けない。数えるのは presets の全行である。
const PresetTotalLimit = 8

// customCodePrefix はカスタムプリセットの code の接頭辞。
//
// presets.code は NOT NULL UNIQUE であり、カスタム作成時にも何かを割り当てざるを
// 得ない。利用者が付ける name とは別に、機械可読識別子として custom_<n> を採る
// (CHANGE-007 が code を「機械可読識別子」と定義している)。
const customCodePrefix = "custom_"

// AliasUpdate は編集画面から送られる 1 件のエイリアス更新。
//
// ★alias_text だけを持つ。alias_text_en は生成規則が入れる列であり編集対象では
// ない(DES-004 §5.4。編集を許すと次の seed 波の再適用で消える)。
type AliasUpdate struct {
	MoveID    int64
	AliasText string
}

// Service はプリセットの参照・作成・更新・削除のビジネスロジックを提供する。
//
// ★本サービス層は M20-04 が新設した。preset_aliases へ書く本番コードは
// 2026-08-13 時点で 1 つも存在せず、本サービスがその最初の 1 本である
// (DES-004 §5.7 の投入経路の規約が初めて適用される箇所)。
//
// ★recipe_cache の再計算は M20-05 で接続済みである。作成・エイリアス更新・削除の
// 3 経路すべてから notation の再計算を呼ぶ(eager＝D-292 / D-303)。呼び出し位置の規約は
// recomputeCache のコメントを見ること(作成・更新はコミット後、削除は同一 tx 内)。
type Service interface {
	// List は全プリセットを ID 昇順で返す。
	List(ctx context.Context) ([]*model.Preset, error)

	// Get は単一プリセットを返す。存在しない場合は ErrNotFound。
	Get(ctx context.Context, id int64) (*model.Preset, error)

	// ListAliases は編集画面向けに、指定プリセット・指定キャラのエイリアスを返す。
	// limit が 0 より大きい場合は先頭 limit 件に切り詰める(一覧画面のプレビュー用)。
	ListAliases(ctx context.Context, presetID, characterID int64, limit int) ([]model.PresetAliasDetail, error)

	// Create は組み込みプリセットをコピーしてカスタムプリセットを作成する。
	// VAL-P03 / P04 / P05 を検証し、ベースの全エイリアスを実体化する。
	Create(ctx context.Context, userID int64, basePresetCode, name string) (*model.Preset, error)

	// Update はプリセット名とエイリアスを更新する。
	// 組み込みは ErrBuiltinProtected(VAL-P01)。VAL-P02 / P03 / P07 を検証する。
	Update(ctx context.Context, userID, id int64, name *string, aliases []AliasUpdate) (*model.Preset, error)

	// Delete はカスタムプリセットを削除する。組み込みは ErrBuiltinProtected。
	// 子行(preset_aliases)を明示的に削除してから親を消す。
	Delete(ctx context.Context, userID, id int64) error
}

type service struct {
	db   *sql.DB
	repo presetrepo.Repository
	// notationSvc は recipe_cache の再計算を持つ(M20-05 §4.4)。
	//
	// ★プリセットが書き換わったら必ず呼ぶ(eager＝D-292 / D-303)。呼び出しを利用者の
	// 操作で分岐させない。nil の場合は再計算を行わない(テスト用。本番配線では必ず渡す)。
	notationSvc notation.Service
	// defaultPresetID は config の [defaults] preset_id の現在値を返す。
	//
	// ★config パッケージへ直接依存させないための関数注入である。preset ドメインに
	// 閉じる(指示書 §2.3)。呼出側(cmd/tacpendium)が main の握る *config.Config を
	// 読むクロージャを渡す。config サービスの Update は同ポインタを書き換えるため、
	// 実行中に設定が変わっても常に最新値が読める。
	defaultPresetID func() int64
}

// New は Service を構築する。
//
// defaultPresetID が nil の場合は「config が何も参照していない」として扱う
// (削除時の D-313 検査を素通りさせる。テストで config を持たない場合に使う)。
//
// notationSvc が nil の場合は recipe_cache の再計算を行わない(テスト用)。
// 本番配線では必ず渡すこと——渡さないとエイリアス編集が表示へ反映されない(M20-05 §4.4)。
func New(db *sql.DB, repo presetrepo.Repository, defaultPresetID func() int64, notationSvc notation.Service) Service {
	return &service{db: db, repo: repo, defaultPresetID: defaultPresetID, notationSvc: notationSvc}
}

// recomputeCache は当該プリセット分の recipe_cache を再計算する(M20-05 §4.4)。
//
// ★★ 呼び出し位置の規約 ★★
// 書き込みトランザクションを「コミットしたあと」に呼ぶこと(§4.4-3・D-360)。
// トランザクションの内側で呼ぶと、再計算のエイリアス解決がコミット前の状態を読み、
// 古い表記を silent に書き込む(エラーにならず、テストも緑のまま通る)。
//
// ⇒ 帰結として「保存は成功したが再計算に失敗した」状態が原理的に生じる。これは設計どおりで
// あり(D-360)、失敗は握り潰さず呼び出し元へ返す(§4.4-2)。キャッシュの stale はデータの
// 不整合ではない——真実は preset_aliases にあり、再実行で回復できる。
func (s *service) recomputeCache(ctx context.Context, presetID int64) error {
	if s.notationSvc == nil {
		return nil
	}
	if err := s.notationSvc.RecomputePresetCache(ctx, presetID); err != nil {
		return fmt.Errorf("recompute recipe cache preset=%d: %w", presetID, err)
	}
	return nil
}

func (s *service) List(ctx context.Context) ([]*model.Preset, error) {
	return s.repo.ListAllPresets(ctx)
}

func (s *service) Get(ctx context.Context, id int64) (*model.Preset, error) {
	p, err := s.repo.FindPresetByID(ctx, id)
	if err != nil {
		if errors.Is(err, presetrepo.ErrNotFound) {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("get preset: %w", err)
	}
	return p, nil
}

func (s *service) ListAliases(ctx context.Context, presetID, characterID int64, limit int) ([]model.PresetAliasDetail, error) {
	if _, err := s.Get(ctx, presetID); err != nil {
		return nil, err
	}
	details, err := s.repo.ListAliasDetails(ctx, presetID, characterID)
	if err != nil {
		return nil, fmt.Errorf("list aliases: %w", err)
	}
	if limit > 0 && len(details) > limit {
		details = details[:limit]
	}
	return details, nil
}

// Create はベースプリセットをコピーしてカスタムプリセットを作成する。
//
// ★全体を 1 トランザクションで行う(指示書 §4.3-4)。途中で失敗したら 1 行も
// 残さない。コピー 1 回で最大 1,653 行を INSERT する(2026-08-13 実測)。
func (s *service) Create(ctx context.Context, userID int64, basePresetCode, name string) (*model.Preset, error) {
	name = strings.TrimSpace(name)
	if name == "" {
		return nil, ErrNameEmpty
	}

	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, fmt.Errorf("begin tx: %w", err)
	}
	defer func() { _ = tx.Rollback() }()

	// VAL-P05: 上限検査。★トランザクション内で数える(検査と INSERT を
	// 分けると、同時作成で 9 件目が通りうる)。
	count, err := s.repo.CountPresets(ctx, tx)
	if err != nil {
		return nil, err
	}
	if count >= PresetTotalLimit {
		return nil, ErrLimitExceeded
	}

	// VAL-P04: ベースが実在し、かつ組み込みであること(DES-004 §6.1)。
	// ★同じトランザクション上で読む(他の検査と揃える)。
	base, err := s.repo.FindPresetByCodeTx(ctx, tx, basePresetCode)
	if err != nil {
		if errors.Is(err, presetrepo.ErrNotFound) {
			return nil, ErrBaseNotFound
		}
		return nil, fmt.Errorf("find base preset: %w", err)
	}
	if !base.IsBuiltin {
		return nil, ErrBaseNotFound
	}

	// VAL-P03: 同一ユーザー内で名前が一意であること。
	dup, err := s.repo.CountPresetsByName(ctx, tx, userID, name, 0)
	if err != nil {
		return nil, err
	}
	if dup > 0 {
		return nil, ErrNameDuplicate
	}

	code, err := s.nextCustomCode(ctx, tx)
	if err != nil {
		return nil, err
	}

	// ★id は AUTOINCREMENT に任せる。欠番(2 / 4)を詰めない——presets.id は
	// preset_aliases / recipe_cache のキー / config / SUPP-001 §7.4.1 の
	// 4 経路から参照されている(M20-01 の最重要ゲート)。
	newID, err := s.repo.CreatePresetTx(ctx, tx, userID, code, name, base.Code)
	if err != nil {
		return nil, err
	}

	// ★エイリアスの実体化。カスタムプリセットは参照ではなく複製を持つ
	// (DES-004 §6.1・§6.2)。character_id と alias_text_en も引き継ぐ。
	if _, err := s.repo.CopyAliasesTx(ctx, tx, base.ID, newID); err != nil {
		return nil, err
	}

	if err := tx.Commit(); err != nil {
		return nil, fmt.Errorf("commit: %w", err)
	}

	// M20-05 §4.4: コピーしたエイリアスがコミットされてから再計算する。
	// ★コミット前に呼ぶと、複製したエイリアスがまだ見えず空の表記を書き込む。
	if err := s.recomputeCache(ctx, newID); err != nil {
		return nil, err
	}

	return s.Get(ctx, newID)
}

// Update はプリセット名とエイリアスを更新する。
func (s *service) Update(ctx context.Context, userID, id int64, name *string, aliases []AliasUpdate) (*model.Preset, error) {
	target, err := s.authorizeMutation(ctx, userID, id)
	if err != nil {
		return nil, err
	}

	var trimmedName string
	if name != nil {
		trimmedName = strings.TrimSpace(*name)
		if trimmedName == "" {
			return nil, ErrNameEmpty
		}
	}
	// VAL-P02: エイリアス表記は空にできない。★DB へ触る前に全件検証する
	// (途中まで書いてから弾くと、トランザクションを巻き戻すまでの間だけ
	//  一貫しない状態が見えるうえ、利用者にどこで失敗したか伝えにくい)。
	for _, a := range aliases {
		if strings.TrimSpace(a.AliasText) == "" {
			return nil, ErrAliasTextEmpty
		}
	}

	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, fmt.Errorf("begin tx: %w", err)
	}
	defer func() { _ = tx.Rollback() }()

	if name != nil && trimmedName != target.Name {
		dup, err := s.repo.CountPresetsByName(ctx, tx, userID, trimmedName, id)
		if err != nil {
			return nil, err
		}
		if dup > 0 {
			return nil, ErrNameDuplicate
		}
		if err := s.repo.UpdatePresetNameTx(ctx, tx, id, trimmedName); err != nil {
			return nil, err
		}
	}

	for _, a := range aliases {
		text := strings.TrimSpace(a.AliasText)

		// ★DB では守れない交差条件を先に見る(D-317)。
		// 「ある技の alias_text が、同一キャラの別の技の alias_text_en と一致する」は
		// 列を跨ぐ条件であるため UNIQUE では表現できない(DES-003 §3.9 / D-317。
		// 旧 000075 のヘッダが明文化していたが M33-02 の統合で消えた)。seed 経路は
		// TestRun_HEAD_NoCrossingAliasTextEn(internal/infra/migration)が守っているが、★M20-04 が作った
		// 利用者編集の経路には検査が無かった。無いと静かに交差した行ができる。
		crossing, err := s.repo.FindCrossingAliasEn(ctx, tx, id, a.MoveID, text)
		if err != nil {
			return nil, err
		}
		if crossing != 0 {
			return nil, &AliasConflictError{AliasText: text}
		}

		n, err := s.repo.UpdateAliasTextTx(ctx, tx, id, a.MoveID, text)
		if err != nil {
			// ★同一プリセット・同一キャラで 2 つの技が同表記になった。
			// 利用者の入力誤りであり、500 ではなく衝突として返す(D-275 同型)。
			if isAliasUniqueViolation(err) {
				return nil, &AliasConflictError{AliasText: text}
			}
			return nil, err
		}
		if n == 0 {
			// 技の追加・削除はカスタムプリセット側では行わない(DES-004 §6.2)。
			return nil, ErrAliasMoveNotFound
		}
	}

	if err := tx.Commit(); err != nil {
		return nil, fmt.Errorf("commit: %w", err)
	}

	// M20-05 §4.4: 更新したエイリアスがコミットされてから再計算する。
	// ★コミット前に呼ぶと、再計算が更新前のエイリアスを読んで古い表記を書き戻す
	// (stale が解消しないまま「再計算した」ことになる。エラーにならない)。
	if err := s.recomputeCache(ctx, id); err != nil {
		return nil, err
	}

	return s.Get(ctx, id)
}

// Delete はカスタムプリセットを削除する。
//
// ★ON DELETE CASCADE に頼らない。サービス層で子行を明示的に削除してから親を消す。
//
// M23-10 以前は PRAGMA foreign_keys が接続プール全体に効いておらず(ボード P-04)、
// preset_aliases.preset_id が DDL 上 CASCADE を持っていても発火しなかった。
// M23-10 で全接続が FK=ON になり CASCADE も効くようになったが、
// ★本実装はそのときも正しいままであり、二重の保険として明示削除を残している。
func (s *service) Delete(ctx context.Context, userID, id int64) error {
	if _, err := s.authorizeMutation(ctx, userID, id); err != nil {
		return err
	}

	// D-313: config の [defaults] preset_id が削除対象を指しているなら拒否する。
	// 参照されたまま消すと、起動時に実在しない preset を引く。
	if s.defaultPresetID != nil && s.defaultPresetID() == id {
		return ErrInUseByConfig
	}

	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("begin tx: %w", err)
	}
	defer func() { _ = tx.Rollback() }()

	// M20-05 §4.4-7: 削除経路は SUPP-001 §7.5.4 の流儀どおり、削除本体と同一 tx 内で
	// キャッシュから当該 preset_id のキーを落とす。DeletePresetCache は読みも書きも
	// この tx を通し、combos / setups しか触らないため read-your-own-write の問題は無い。
	// ★これをやらないと当該キーが JSON 内に孤児として残る(M20-04 時点の as-built)。
	if s.notationSvc != nil {
		if err := s.notationSvc.DeletePresetCache(ctx, tx, id); err != nil {
			return fmt.Errorf("delete recipe cache preset=%d: %w", id, err)
		}
	}

	if _, err := s.repo.DeleteAliasesByPresetTx(ctx, tx, id); err != nil {
		return err
	}
	if err := s.repo.DeletePresetTx(ctx, tx, id); err != nil {
		return err
	}

	if err := tx.Commit(); err != nil {
		return fmt.Errorf("commit: %w", err)
	}
	return nil
}

// authorizeMutation は更新・削除の共通の門番。
//
// ★UI で操作を出さないだけにしない。API を直接叩かれても組み込みが壊れないよう、
// ここで拒否する(指示書 §4.4-4 の多層防御)。
func (s *service) authorizeMutation(ctx context.Context, userID, id int64) (*model.Preset, error) {
	p, err := s.Get(ctx, id)
	if err != nil {
		return nil, err
	}
	// VAL-P01: 組み込みは編集も削除もできない(D-290)。
	if p.IsBuiltin {
		return nil, ErrBuiltinProtected
	}
	// VAL-P07: 他ユーザーが作成したものは参照のみ可。
	if p.UserID == nil || *p.UserID != userID {
		return nil, ErrForbidden
	}
	return p, nil
}

// nextCustomCode は未使用の custom_<n> を返す。
//
// 既存のカスタム code を全件読んで最大 n を採る。プリセットは全体で 8 件までしか
// 存在しないため、全件読みで十分である(VAL-P05)。
func (s *service) nextCustomCode(ctx context.Context, tx *sql.Tx) (string, error) {
	codes, err := s.repo.ListCustomPresetCodes(ctx, tx)
	if err != nil {
		return "", err
	}
	maxSeq := 0
	for _, c := range codes {
		if !strings.HasPrefix(c, customCodePrefix) {
			continue
		}
		n, err := strconv.Atoi(strings.TrimPrefix(c, customCodePrefix))
		if err != nil {
			continue
		}
		if n > maxSeq {
			maxSeq = n
		}
	}
	return customCodePrefix + strconv.Itoa(maxSeq+1), nil
}

// isAliasUniqueViolation は ★狙った制約(preset_id, character_id, alias_text)の
// 違反だけを true にする。
//
// modernc.org/sqlite は次の形のメッセージを返す(2026-08-13 実測):
//
//	constraint failed: UNIQUE constraint failed:
//	  preset_aliases.preset_id, preset_aliases.character_id, preset_aliases.alias_text (2067)
//
// ★構成列まで見るのは、別の制約(preset_id, move_id など)の違反を
// 「表記の衝突」として利用者へ誤って伝えないためである。
func isAliasUniqueViolation(err error) bool {
	if err == nil {
		return false
	}
	msg := err.Error()
	if !strings.Contains(msg, "UNIQUE constraint failed") {
		return false
	}
	return strings.Contains(msg, "preset_aliases.character_id") &&
		strings.Contains(msg, "preset_aliases.alias_text")
}
