package move

import (
	"context"
	"database/sql"
	"errors"
	"fmt"

	"github.com/plexiblinp/tacpendium/internal/model"
)

// rushVariantCodePrefix はラッシュ版 move の code 接頭辞(DES-003 §3.3 L287-291、`rush_<元技code>`)。
const rushVariantCodePrefix = "rush_"

// insertRushVariantSQL は rush_variant move を 1 行 INSERT し、id を返す。
// category/original_move_id/code はラッシュ版固有値、フレーム系は元技のコピーを設定する。
// is_derived は常に true(M17-02 §4.7・CHANGE-069 §2.1-c': ドライブラッシュ状態でのみ出る
// =判定原理「単独でいきなり出せるか? 出せない → true」に忠実。seed 由来の rush 行と一貫)。
// startup_basis は rushStartupBasis が決める(元技が startup を持てば 'through'、持たなければ
// 'unknown')。値の根拠と、リテラルからバインドへ変えた経緯は同関数の godoc を見ること。
// ★★【2026-09-19 更新・M39-02】旧記述は「startup_basis は常に 'through'」「is_derived と同じく
// バインドせずリテラルで書く＝どちらも rush 行では定数であり、呼び出し側に選ばせる余地が無い」と
// 書いていたが、**定数ではなかった**。⇒ 元技の startup が NULL のとき 'through' を入れると
// `D-187` の不変条件(startup が NULL なら startup_basis は 'unknown')を実行時に破る。
// その記述は失効した(is_derived が常に 1 であることは変わらない)。
// ★列挙しないと DDL の DEFAULT('unknown')で入り、機械 backfill(旧 000050)は 1 回きりのマイグレなので、
// その後に生成される rush 行だけが unknown で取り残される。型エラーにも実行時エラーにもならない
// 「静かに壊れる」型のため、ここで明示する(M19-04 §4.5 の趣旨。★列は引き続き明示列挙しており、
// 値も常に明示的に与える。DEFAULT へ委ねてはいない)。
// chain_cancel_total(NULL)と fastest_unreachable(0)は DEFAULT のままでよい。
const insertRushVariantSQL = `
INSERT INTO moves (
    character_id, code, category, original_move_id,
    startup, active, total, on_hit, on_block,
    damage, recovery, is_aerial, setup_only, raw_data, is_derived, startup_basis
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
RETURNING id`

// rushStartupBasis は生成するラッシュ版 move の startup_basis を決める。
//
// ラッシュ版の startup は元技のコピーであり、その値は「連携の中で出したときの通し値」である。
// ⇒ 元技が startup を持つなら 'through'(M19-04 §4.5 の設計判断。1 ビットも変えていない)。
//
// ★★元技が startup を持たない場合は 'unknown' を返す(M39-02)。
// `DES-003` §3.3 (i)＝「本列は *格納されている startup の由来* を表すのであって、
// 値が無い行に由来は無い」。⇒ startup が NULL の行で 'through' を主張することは、
// 値が無いのに由来を述べることであり、`D-187` の不変条件
// (startup IS NULL なら startup_basis は 'unknown')を破る。
//
// ★これは M19-04 §4.5 の覆しではない。同判断は「ラッシュ版は通し値である」を述べたもので
// あり、*通し値の元が無い* 場合を扱っていなかった。⇒ 未処理のケースを埋めただけである。
//
// ★HEAD に該当する元技が実在する(category='unique' ∧ is_aerial=0 ∧ startup IS NULL)。
// rushEligible は startup NOT NULL を要求しないため、利用者が押せば到達する経路である。
// ⇒ 仮説ではない。実行時の再現は M39-02 完了報告 段 1 を見ること。
func rushStartupBasis(srcStartup *int) string {
	if srcStartup == nil {
		return model.MoveStartupBasisUnknown
	}
	return model.MoveStartupBasisThrough
}

// existingRushCodeSQL は同一キャラの rush コード(rush_<元技code>)を占有する move の id を取得する
// (無ければ ErrNoRows)。同一 original の rush_variant 既存も、別 move による code 占有も同経路で検出し、
// 重複生成時に既存 id を 409 で返す + 生 UNIQUE(character_id, code) 制約エラー(→ 500)を回避する(CHANGE-032 / レビュー #3)。
const existingRushCodeSQL = `
SELECT id FROM moves
WHERE character_id = ? AND code = ?
LIMIT 1`

// InsertRushVariant は src からラッシュ版 move を派生生成する(M9-03、§4.2)。
// rush コード(rush_<元技code>)が既存の場合は、その既存 id を第一返り値に載せて ErrConflict を返す
// (CHANGE-032。呼び出し側が 409 + 既存 id を返すため)。
//
// 注: ラッシュ版エイリアス(official_ja_move)の自動生成は本 MVP のスコープ外(指示書 §4.4、レビュー #1)。
// rush_variant は moves 行のみ生成し、preset_aliases へは書き込まない。
func (r *repository) InsertRushVariant(ctx context.Context, src *model.Move) (newID int64, err error) {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return 0, fmt.Errorf("begin tx: %w", err)
	}
	defer func() {
		if err != nil {
			_ = tx.Rollback()
		}
	}()

	rushCode := rushVariantCodePrefix + src.Code

	// 事前チェック: rush コードが既に占有されていれば既存 id + ErrConflict。
	// 生 UNIQUE 制約エラー((character_id, code))を漏らさないため、INSERT 前に判定する。
	var existingID int64
	switch scanErr := tx.QueryRowContext(ctx, existingRushCodeSQL, src.CharacterID, rushCode).Scan(&existingID); {
	case scanErr == nil:
		return existingID, ErrConflict
	case errors.Is(scanErr, sql.ErrNoRows):
		// 未占有 → 続行。
	default:
		return 0, fmt.Errorf("check rush code exists (%s): %w", rushCode, scanErr)
	}

	if err = tx.QueryRowContext(ctx, insertRushVariantSQL,
		src.CharacterID, rushCode, model.MoveCategoryRushVariant, src.ID,
		src.Startup, src.Active, src.Total, src.OnHit, src.OnBlock,
		src.Damage, src.Recovery, src.IsAerial, src.SetupOnly, src.RawData,
		rushStartupBasis(src.Startup),
	).Scan(&newID); err != nil {
		return 0, fmt.Errorf("insert rush variant (%s): %w", rushCode, err)
	}

	if err = tx.Commit(); err != nil {
		return 0, fmt.Errorf("commit: %w", err)
	}
	return newID, nil
}
