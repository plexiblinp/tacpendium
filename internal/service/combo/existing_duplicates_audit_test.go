package combo_test

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"os"
	"sort"
	"testing"

	dbinfra "github.com/plexiblinp/tacpendium/internal/infra/db"
	"github.com/plexiblinp/tacpendium/internal/model"
	combosvc "github.com/plexiblinp/tacpendium/internal/service/combo"
)

// M24-11 §4.5: 既存 DB に入り込んだ同一識別キーの重複を「数えるだけ」の監査。
//
// ★★消さない———————————————————————————————————————————
// 利用者のデータである(CLAUDE.md §10＝データの不可逆な破壊の防止)。どちらを残すかは
// 利用者の判断であり、掃除の手は本サブの射程外である(指示書 M24-11 §4.5)。
// ⇒ 本ファイルは検出しかしない。DELETE も UPDATE も 1 文も書かない。
//
// ★★なぜ SQL 一発ではなく Go なのか———————————————————————————
// recipe_hash は combos の列ではなくサービス層の計算値である(steps を並べ、
// Modifiers.Flags を sort.Strings で正規化してから SHA-256)。SQL の GROUP BY では
// その正規化を再現できず、同じレシピを別物と数えたり逆をやったりする。
// ⇒ 本番と同じ recipehash の実装を通す。
//
// 使い方(★開発者の手番。本実行環境には dev DB が無い):
//
//	TACPENDIUM_AUDIT_DB=/path/to/combomgr-copy.db \
//	    go test ./internal/service/combo/ -run TestAuditExistingDuplicates -count=1 -v
//
// 未指定なら skip する(CI と通常の go test ./... では走らない)。
//
// ★★アプリを止め、DB の「コピー」に対して走らせること———————————————
// 本テストは dbinfra.Open を通すため、DSN の _pragma に journal_mode(WAL) を含む。
// ⇒ 実 DB を直に開くと journal モードの変更が起こりうる(アプリと同じ設定なので実害は
// 考えにくいが、監査のために本番データを触る理由が無い)。
// ★読むだけとはいえ、稼働中の DB を別プロセスから開くこと自体を避ける。
const auditDBEnv = "TACPENDIUM_AUDIT_DB"

// auditNull は NULL を表す番兵。実データに現れない値を選ぶ。
// ★SQL の三値論理を Go 側へ持ち込まないための置き換えである。DES-006 §2.3 の
// 「NULL 同士は一致」を、Go のマップキーの等値でそのまま表現する。
const auditNull = "\x00NULL"

// auditKey は DES-006 §2.3 の識別キー 7 項 + recipe_hash。
//
// ★M37-07 で 6 項 → 7 項になった(starter_meaty を追加・D-874)。
// ★★本ファイルは TACPENDIUM_AUDIT_DB を指定したときだけ走る。⇒ 追随を怠っても
//
//	go test ./... は緑のままであり、実 DB を監査した瞬間に初めて誤報として出る。
//	持続当てだけが違う 2 行を「重複」と報告してしまう。
//
// ★starter_meaty は NOT NULL であるため auditNull の置き換えを通さない。
type auditKey struct {
	characterID    int64
	starterMoveID  string
	position       string
	opponentStance string
	hitType        string
	opponentSize   string
	starterMeaty   bool
	recipeHash     string
}

func TestAuditExistingDuplicates(t *testing.T) {
	path := os.Getenv(auditDBEnv)
	if path == "" {
		t.Skipf("%s が未指定のため skip(実 DB を指すと監査が走る)", auditDBEnv)
	}

	conn, err := dbinfra.Open(path)
	if err != nil {
		t.Fatalf("open %s: %v", path, err)
	}
	defer func() { _ = conn.Close() }()
	ctx := context.Background()

	// --- 母数 ------------------------------------------------------------------
	// ★★母数を必ず出すこと。「重複 3 組」は母数が 10 件か 10,000 件かで意味が違う。
	var total int
	if err := conn.QueryRowContext(ctx,
		`SELECT COUNT(*) FROM combos WHERE is_draft = 0 AND deleted_at IS NULL`).Scan(&total); err != nil {
		t.Fatalf("count total: %v", err)
	}

	groups, err := auditGroups(ctx, conn)
	if err != nil {
		t.Fatalf("audit: %v", err)
	}

	type finding struct {
		key auditKey
		ids []int64
	}
	var findings []finding
	dupRows := 0
	for k, ids := range groups {
		if len(ids) <= 1 {
			continue
		}
		sort.Slice(ids, func(i, j int) bool { return ids[i] < ids[j] })
		findings = append(findings, finding{key: k, ids: ids})
		dupRows += len(ids)
	}
	// 出力順を安定させる(実行のたびに並びが変わると差分が読めない)。
	sort.Slice(findings, func(i, j int) bool { return findings[i].ids[0] < findings[j].ids[0] })

	t.Logf("母数(本登録・未削除のコンボ) = %d 件", total)
	t.Logf("識別キー + recipe_hash が一致する組 = %d 組 / 該当行 = %d 件", len(findings), dupRows)

	if len(findings) == 0 {
		t.Logf("重複なし")
		return
	}

	for _, f := range findings {
		k := f.key
		t.Logf("  character_id=%d starter=%s position=%s stance=%s hit=%s size=%s meaty=%t hash=%s → combo id %v",
			k.characterID, k.starterMoveID, k.position, k.opponentStance,
			k.hitType, k.opponentSize, k.starterMeaty, k.recipeHash[:8], f.ids)
	}

	// ★★失敗にしない。これは監査であって検査ではない———————————————
	// 赤くすると「消して緑にする」動機が生まれる。消すかどうかは利用者の判断である。
	t.Logf("★ 消していない。どちらを残すかは利用者の判断であり、開発者の手番である")
}

// auditGroups は本登録・未削除のコンボを識別キー + recipe_hash でまとめる。
func auditGroups(ctx context.Context, conn *sql.DB) (map[auditKey][]int64, error) {
	rows, err := conn.QueryContext(ctx, `
		SELECT id, character_id, starter_move_id, position, opponent_stance, hit_type, opponent_size, starter_meaty
		FROM combos
		WHERE is_draft = 0 AND deleted_at IS NULL
		ORDER BY id`)
	if err != nil {
		return nil, fmt.Errorf("list combos: %w", err)
	}

	type row struct {
		id  int64
		key auditKey
	}
	var all []row
	for rows.Next() {
		var (
			id, charID             int64
			starter                sql.NullInt64
			pos, stance, hit, size sql.NullString
			meaty                  bool
		)
		if err := rows.Scan(&id, &charID, &starter, &pos, &stance, &hit, &size, &meaty); err != nil {
			rows.Close()
			return nil, fmt.Errorf("scan combo: %w", err)
		}
		all = append(all, row{id: id, key: auditKey{
			characterID:    charID,
			starterMoveID:  auditInt(starter),
			position:       auditStr(pos),
			opponentStance: auditStr(stance),
			hitType:        auditStr(hit),
			opponentSize:   auditStr(size),
			starterMeaty:   meaty,
		}})
	}
	if err := rows.Err(); err != nil {
		rows.Close()
		return nil, err
	}
	rows.Close()

	groups := make(map[auditKey][]int64, len(all))
	for _, r := range all {
		steps, err := auditSteps(ctx, conn, r.id)
		if err != nil {
			return nil, err
		}
		k := r.key
		k.recipeHash = combosvc.CalcRecipeHash(steps) // ★本番と同じ実装を通す
		groups[k] = append(groups[k], r.id)
	}
	return groups, nil
}

func auditSteps(ctx context.Context, conn *sql.DB, comboID int64) ([]model.ComboStep, error) {
	rows, err := conn.QueryContext(ctx,
		`SELECT step_order, move_id, modifiers FROM combo_steps WHERE combo_id = ? ORDER BY step_order`, comboID)
	if err != nil {
		return nil, fmt.Errorf("list steps for combo %d: %w", comboID, err)
	}
	defer rows.Close()

	steps := make([]model.ComboStep, 0)
	for rows.Next() {
		var (
			order   int
			moveID  sql.NullInt64
			modsRaw sql.NullString
		)
		if err := rows.Scan(&order, &moveID, &modsRaw); err != nil {
			return nil, fmt.Errorf("scan step: %w", err)
		}
		s := model.ComboStep{StepOrder: order}
		if moveID.Valid {
			v := moveID.Int64
			s.MoveID = &v
		}
		if modsRaw.Valid && modsRaw.String != "" {
			var m model.Modifiers
			if err := json.Unmarshal([]byte(modsRaw.String), &m); err != nil {
				return nil, fmt.Errorf("unmarshal modifiers of combo %d step %d: %w", comboID, order, err)
			}
			s.Modifiers = &m
		}
		steps = append(steps, s)
	}
	return steps, rows.Err()
}

func auditStr(v sql.NullString) string {
	if !v.Valid {
		return auditNull
	}
	return v.String
}

func auditInt(v sql.NullInt64) string {
	if !v.Valid {
		return auditNull
	}
	return fmt.Sprintf("%d", v.Int64)
}

// TestAuditGroups_DetectsPlantedDuplicate は監査そのものが働くことを確かめる。
//
// ★★これが無いと、実 DB へ向けて「重複 0 件」と出たときに、
// 「本当に 0 件」なのか「監査が何も見ていない」のか区別が付かない
// (計測点 M-78＝壊す対象が実在するか / その壊し方で観測が動くか)。
// ⇒ 仕込んだ重複を検出できること、かつ別キーを重複と数えないことの両方を見る。
func TestAuditGroups_DetectsPlantedDuplicate(t *testing.T) {
	db, svc := newSvc(t)
	ctx := context.Background()
	input := validRyuInput(t, db)

	// 1 件目は正規の経路で作る
	if _, r, err := svc.Create(ctx, input); err != nil || r.HasError() {
		t.Fatalf("first create: err=%v issues=%+v", err, r.Issues)
	}

	// 2 件目は VAL-C02 を迂回して直接仕込む(競合で入り込んだ行を模す)
	tx, err := db.BeginTx(ctx, nil)
	if err != nil {
		t.Fatalf("begin tx: %v", err)
	}
	insertRivalCombo(t, ctx, tx, input)
	if err := tx.Commit(); err != nil {
		t.Fatalf("commit: %v", err)
	}

	// 別キーの行(重複と数えてはいけない対照)
	other := validRyuInput(t, db)
	other.Position = ptr("corner_self")
	if _, r, err := svc.Create(ctx, other); err != nil || r.HasError() {
		t.Fatalf("other create: err=%v issues=%+v", err, r.Issues)
	}

	groups, err := auditGroups(ctx, db)
	if err != nil {
		t.Fatalf("auditGroups: %v", err)
	}

	dupGroups, dupRows := 0, 0
	for _, ids := range groups {
		if len(ids) > 1 {
			dupGroups++
			dupRows += len(ids)
		}
	}
	if dupGroups != 1 || dupRows != 2 {
		t.Errorf("仕込んだ重複を検出できていない: %d 組 / %d 件(期待 1 組 / 2 件)。"+
			"監査が何も見ていない状態で「重複 0 件」と報告する危険がある", dupGroups, dupRows)
	}
	// ★対照: 別キーの行が同じ組へ入っていないこと(全体で 2 組あるはず)
	if len(groups) != 2 {
		t.Errorf("組の数 = %d(期待 2)。識別キーの区別が効いていない", len(groups))
	}
}
