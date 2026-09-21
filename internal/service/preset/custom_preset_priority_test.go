package preset_test

import (
	"context"
	"database/sql"
	"testing"

	"github.com/plexiblinp/tacpendium/internal/aliasindex"
	"github.com/plexiblinp/tacpendium/internal/model"
	comborepo "github.com/plexiblinp/tacpendium/internal/repository/combo"
	presetrepo "github.com/plexiblinp/tacpendium/internal/repository/preset"
	setuprepo "github.com/plexiblinp/tacpendium/internal/repository/setup"
	"github.com/plexiblinp/tacpendium/internal/service/notation"
	presetsvc "github.com/plexiblinp/tacpendium/internal/service/preset"
	"github.com/plexiblinp/tacpendium/internal/testutil/dbtest"
)

// M20-06 §5 (c)(d): ★カスタムプリセット優先。本サブで最も落ちやすい項目である。
//
// ★何を守っているか——P-34 の 13 件は「規則で生成できない」ため、コードに
// 「この move_code はこう表示する」という固定表を持ちたくなる。持った瞬間、
// 利用者がカスタムプリセットで別の表記を定義しても組み込みの値が出るようになる。
//
// ★破っても 13 件以外の表示は正しく、テストも型検査も緑になる。露見するのは
// 利用者がカスタムプリセットを作り、しかもこの 13 件のどれかを編集したときだけである。
// ⇒ ここで機械的に固定する。
//
// ★本ファイルは「表示・逆引きがカスタム側の値になる」ことだけを主張する。
// 「英語が表示されること」は主張しない(指示書 §4.9-4)——alias_text_en の表示経路は
// 実装が 0 件であり、通らないテストになる。

const (
	// p34Char / p34MoveCode は P-34 の 13 件の代表(kimberly の弧空)。
	p34Char     = "kimberly"
	p34MoveCode = "arc_step"
	// p34BuiltinText は 000076 が numeric へ投入した値(= CSV の name_ja)。
	p34BuiltinText = "弧空"
	// p34CustomText は利用者がカスタムプリセットで定義しなおした表記。
	// ★組み込みの値とも他のどの表記とも重ならない文字列にする。
	p34CustomText = "カスタム弧空"
)

type p34Env struct {
	db        *sql.DB
	ctx       context.Context
	svc       presetsvc.Service
	pRepo     presetrepo.Repository
	nSvc      notation.Service
	moveID    int64
	numericID int64
}

// newP34Env は本番と同じ配線で preset / notation を用意する。
func newP34Env(t *testing.T) *p34Env {
	t.Helper()
	db := dbtest.Setup(t)
	pRepo := presetrepo.New(db)
	cRepo := comborepo.New(db)
	sRepo := setuprepo.New(db)
	nSvc := notation.New(db, pRepo, cRepo, sRepo)

	charID := characterIDByCode(t, db, p34Char)
	return &p34Env{
		db:        db,
		ctx:       context.Background(),
		svc:       presetsvc.New(db, pRepo, nil, nSvc),
		pRepo:     pRepo,
		nSvc:      nSvc,
		moveID:    moveIDByCode(t, db, charID, p34MoveCode),
		numericID: presetIDByCode(t, db, model.PresetCodeNumeric),
	}
}

// steps は P-34 の 1 件だけを含むステップ列を返す。
//
// ★move_code を必ず入れる。実データのステップは move_code を持っており、入れずに
// 組むと「move_code を鍵にした固定表」を置かれてもテストが素通りする(破壊確認で実証済み)。
func (e *p34Env) steps() []model.ComboStep {
	code := p34MoveCode
	return []model.ComboStep{{StepOrder: 1, MoveID: &e.moveID, MoveCode: &code}}
}

func characterIDByCode(t *testing.T, db *sql.DB, code string) int64 {
	t.Helper()
	var id int64
	if err := db.QueryRow(`SELECT id FROM characters WHERE code = ?`, code).Scan(&id); err != nil {
		t.Fatalf("lookup character id (code=%s): %v", code, err)
	}
	return id
}

// newCustomPresetWithOverride は numeric をベースにカスタムプリセットを作り、
// P-34 の 1 件だけを別の表記へ書き換えて返す。
func (e *p34Env) newCustomPresetWithOverride(t *testing.T) *model.Preset {
	t.Helper()
	created, err := e.svc.Create(e.ctx, testUserID, model.PresetCodeNumeric, "M20-06 カスタム")
	if err != nil {
		t.Fatalf("Create: %v", err)
	}
	// ★前提の確認——コピー直後は組み込みの値をそのまま持っている。
	//   ここが違うと、以後の主張が「そもそも値が違った」で通ってしまう。
	if got := aliasTextOf(t, e.db, created.ID, e.moveID); got != p34BuiltinText {
		t.Fatalf("コピー直後の alias_text = %q, want %q(000076 の投入が効いていない)", got, p34BuiltinText)
	}
	if _, err := e.svc.Update(e.ctx, testUserID, created.ID, nil, []presetsvc.AliasUpdate{
		{MoveID: e.moveID, AliasText: p34CustomText},
	}); err != nil {
		t.Fatalf("Update: %v", err)
	}
	return created
}

// Test_P34_CustomPresetWinsOnDisplay は §5 (c) を固定する。
//
// カスタムプリセットが同じ move_code に別の alias_text を持つとき、
// 表示がカスタム側の値になること。
func Test_P34_CustomPresetWinsOnDisplay(t *testing.T) {
	env := newP34Env(t)
	custom := env.newCustomPresetWithOverride(t)

	// ★move_code を持たせる。実データのステップは持っており、持たせないと
	//   「move_code を鍵にした固定表」を置かれても本テストが素通りする(破壊確認で実証)。
	steps := env.steps()

	// (1) カスタムプリセットで引くとカスタム側の値になる。
	got, err := env.nSvc.RenderSteps(env.ctx, custom.ID, steps)
	if err != nil {
		t.Fatalf("RenderSteps(custom): %v", err)
	}
	if got != p34CustomText {
		t.Errorf("カスタムプリセットの表示 = %q, want %q\n"+
			"★表示経路に move_code 固定の分岐があると、ここが組み込みの値になる(§4.3-2)", got, p34CustomText)
	}

	// (2) 組み込み側は変わっていない(カスタムの編集が組み込みへ漏れていない)。
	gotBuiltin, err := env.nSvc.RenderSteps(env.ctx, env.numericID, steps)
	if err != nil {
		t.Fatalf("RenderSteps(numeric): %v", err)
	}
	if gotBuiltin != p34BuiltinText {
		t.Errorf("numeric の表示 = %q, want %q", gotBuiltin, p34BuiltinText)
	}
}

// Test_P34_CustomPresetWinsOnReverseLookup は §5 (d) を固定する。
//
// ★表示だけ直して逆引きを忘れる形を塞ぐ。逆引きは他から引っ越しが使う経路であり
// (DES-003 §3.9 の消費者)、返り値が 1 件のときだけ確定する決定論に依存している。
func Test_P34_CustomPresetWinsOnReverseLookup(t *testing.T) {
	env := newP34Env(t)
	env.newCustomPresetWithOverride(t)

	// ★M20-07 で逆引きの実体が変わった(1 表記ずつの SQL 完全一致 → 正規化済み索引)。
	//   主張は同じである——カスタムプリセットの行が母数に含まれ、1 件へ解決すること。
	entries, err := env.pRepo.ListAliasEntriesByCharacter(env.ctx, p34Char)
	if err != nil {
		t.Fatalf("ListAliasEntriesByCharacter: %v", err)
	}
	ix := aliasindex.Build(entries)

	// (1) カスタム側の表記が引ける。
	if codes := ix.Lookup(p34CustomText); len(codes) != 1 || codes[0] != p34MoveCode {
		t.Errorf("カスタム表記の逆引き = %v, want [%s]\n"+
			"★カスタムプリセットの行が逆引きの母数から外れていると空になる", codes, p34MoveCode)
	}

	// (2) 組み込み側の表記も同じ move_code へ解決する。
	//     ★13 件の alias_text は official_ja_move の既存値と同一である(name_ja の複製)。
	//       同じ文字列が 3 プリセットにあっても、すべて同じ move を指すため
	//       索引の move.code 集合が 1 件に畳み、取込の決定論は壊れない。
	if codes := ix.Lookup(p34BuiltinText); len(codes) != 1 || codes[0] != p34MoveCode {
		t.Errorf("組み込み表記の逆引き = %v, want [%s]\n"+
			"★複数件に割れると他から引っ越しが「未解決」に倒れる", codes, p34MoveCode)
	}
}

// Test_P34_NoPresetIndependentFixedTable は §4.3-2 / §4.3-3 を固定する。
//
// ★13 件の固定表は「行を作るための入力」であって「表示時に引かれるもの」ではない。
// 表示経路がプリセットに関係なく固定表を引いていたら、preset_aliases から行を消しても
// 同じ値が出続ける。⇒ 行を消して、表示が固定表ではなくフォールバックへ落ちることを見る。
//
// ★本テストは「固定表が表示に効いていない」ことの機械的な担保である。
// 名前だけでは判断できない(チェックリスト §1.2-3 が「呼出元を実際に辿れ」と言うのはこのため)。
func Test_P34_NoPresetIndependentFixedTable(t *testing.T) {
	env := newP34Env(t)
	steps := env.steps()

	if _, err := env.db.Exec(
		`DELETE FROM preset_aliases WHERE preset_id = ? AND move_id = ?`,
		env.numericID, env.moveID,
	); err != nil {
		t.Fatalf("delete alias: %v", err)
	}

	// 行を消したので DES-004 §5.3 の 3 段目(official_ja_move)へ落ちる。
	// ★numeric 固有の値ではなく official_ja_move の値が出る、が正しい姿である。
	// ここでは両者が同一文字列(name_ja の複製)なので、「生の move_code が出ない」ことで
	// フォールバックが働いたことを見る。
	got, err := env.nSvc.RenderSteps(env.ctx, env.numericID, steps)
	if err != nil {
		t.Fatalf("RenderSteps: %v", err)
	}
	if got == p34MoveCode {
		t.Errorf("表示 = %q(生の move_code)。official_ja_move へのフォールバックが働いていない", got)
	}

	// ★official_ja_move の行も消すと、生の move_code まで落ちること。
	//   ここが p34BuiltinText のままなら、どこかに表示用の固定表がある(§4.3-2 違反)。
	officialID := presetIDByCode(t, env.db, model.PresetCodeOfficialJaMove)
	if _, err := env.db.Exec(
		`DELETE FROM preset_aliases WHERE preset_id = ? AND move_id = ?`,
		officialID, env.moveID,
	); err != nil {
		t.Fatalf("delete official alias: %v", err)
	}
	got, err = env.nSvc.RenderSteps(env.ctx, env.numericID, steps)
	if err != nil {
		t.Fatalf("RenderSteps(after official delete): %v", err)
	}
	if got != p34MoveCode {
		t.Errorf("全行を消した後の表示 = %q, want %q(生の move_code)\n"+
			"★行が無いのに値が出るなら、表示経路がコード上の固定表を引いている(§4.3-2 / 重大 2)",
			got, p34MoveCode)
	}
}
