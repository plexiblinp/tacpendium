package migration_test

// セットプレイ提案(setplay)の候補集合を、版を固定して全数射影する測定ハーネス。
//
// ★用途: M19-05 は filler 候補規則と target 列挙規則の両方を動かす。
//
//	「候補集合が静かに変わっていないか」を変更の前後で突き合わせるために使う。
//	punishfinder 側の canary_punish_scan_test.go と対になる(あちらは確定反撃の候補集合)。
//
// ★D-237(版固定の測定手段を常設化する)への回答である。Phase 2 では
//
//	「案 C の canary 39 をマイグレ側から測れない」「測る順序を手順として残す必要がある」
//	という 2 つの制約が判明した。本ハーネスは次の 3 つを満たす:
//	  (1) 版を指定して射影を採取できる  -- CANARY_SETPLAY_VERSION
//	  (2) SHA256 で突合できる          -- 出力末尾に sha256 行を書く
//	  (3) 規則を二重に持たない          -- setplay.ProjectCandidates(本番と同じ関数)を呼ぶ
//
// ★既定ではスキップする。CI を重くしないため、環境変数 CANARY_SETPLAY_OUT を与えたときだけ走る。
//
//	# 変更前(例: v68 を固定して採取)
//	CANARY_SETPLAY_OUT=/tmp/setplay-before.txt CANARY_SETPLAY_VERSION=68 \
//	  go test ./internal/infra/migration/ -run TestCanary_SetplayProjection -v
//	# 変更後(同じ版で採取して diff / sha256 を突合)
//	CANARY_SETPLAY_OUT=/tmp/setplay-after.txt CANARY_SETPLAY_VERSION=68 \
//	  go test ./internal/infra/migration/ -run TestCanary_SetplayProjection -v
//
//	CANARY_SETPLAY_VERSION 未指定なら最新版まで適用する。
//	差分が出た場合は「その変更で説明できること」を move_code 単位で示す必要がある。
//
// ★出力の読み方(1 行 = 1 判定):
//
//	FILLER <キャラ> <move_code>
//	TARGET <キャラ> <move_code>
//	COUNT  <キャラ> filler=<n> target=<n>
//	sha256 <全行の SHA256>
//
// ★本ファイルを internal/service/setplay/ 配下に置かないこと。
//
//	同型の是正サブでは「setplay の diff が 0」を条件に課され得るため、測定側を
//	マイグレーションテスト側に置けば、規則のパッケージに触れずに測定できる。

import (
	"context"
	"crypto/sha256"
	"database/sql"
	"fmt"
	"os"
	"sort"
	"strconv"
	"strings"
	"testing"

	setplayrepo "github.com/plexiblinp/tacpendium/internal/repository/setplay"
	setplaysvc "github.com/plexiblinp/tacpendium/internal/service/setplay"
)

// canarySetplayTypes は射影で許可する対象種別。UI の既定 ON/OFF に依らず全種別を通し、
// 「種別選択」ではなく「ゲート」の変化だけが射影に出るようにする。
func canarySetplayTypes() []string {
	return []string{
		setplaysvc.TargetTypeNormal, setplaysvc.TargetTypeUnique, setplaysvc.TargetTypeSpecial,
		setplaysvc.TargetTypeSpecialProjectile, setplaysvc.TargetTypeThrow,
		setplaysvc.TargetTypeNormalRush, setplaysvc.TargetTypeUniqueRush,
	}
}

// TestCanary_SetplayProjection は指定版の DB に対して全キャラの候補集合を射影し、
// CANARY_SETPLAY_OUT へ書き出す。未指定ならスキップする。
func TestCanary_SetplayProjection(t *testing.T) {
	out := os.Getenv("CANARY_SETPLAY_OUT")
	if out == "" {
		t.Skip("CANARY_SETPLAY_OUT 未指定のためスキップ(候補集合の測定時のみ実行する)")
	}

	m, db := newMigrator(t)
	defer db.Close()
	if v := os.Getenv("CANARY_SETPLAY_VERSION"); v != "" {
		n, err := strconv.ParseUint(v, 10, 32)
		if err != nil {
			t.Fatalf("CANARY_SETPLAY_VERSION が数値でない: %v", err)
		}
		if err := m.Migrate(uint(n)); err != nil {
			t.Fatalf("migrate to v%d: %v", n, err)
		}
	} else if err := m.Up(); err != nil {
		t.Fatalf("migrate up: %v", err)
	}

	var sb strings.Builder
	for _, c := range canarySetplayCharacters(t, db) {
		proj := canarySetplayProject(t, db, c.id)
		for _, code := range proj.FillerCodes {
			fmt.Fprintf(&sb, "FILLER %s %s\n", c.code, code)
		}
		for _, code := range proj.TargetCodes {
			fmt.Fprintf(&sb, "TARGET %s %s\n", c.code, code)
		}
		fmt.Fprintf(&sb, "COUNT  %s filler=%d target=%d\n", c.code, len(proj.FillerCodes), len(proj.TargetCodes))
	}
	body := sb.String()
	body += fmt.Sprintf("sha256 %x\n", sha256.Sum256([]byte(body)))

	if err := os.WriteFile(out, []byte(body), 0o600); err != nil {
		t.Fatalf("write %s: %v", out, err)
	}
	t.Logf("wrote %d bytes to %s", len(body), out)
}

type canaryChar struct {
	id   int64
	code string
}

func canarySetplayCharacters(t *testing.T, db *sql.DB) []canaryChar {
	t.Helper()
	rows, err := db.Query(`SELECT id, code FROM characters WHERE EXISTS (
		SELECT 1 FROM moves WHERE moves.character_id = characters.id
	) ORDER BY code`)
	if err != nil {
		t.Fatalf("list characters: %v", err)
	}
	defer rows.Close()
	var out []canaryChar
	for rows.Next() {
		var c canaryChar
		if err := rows.Scan(&c.id, &c.code); err != nil {
			t.Fatalf("scan character: %v", err)
		}
		out = append(out, c)
	}
	if err := rows.Err(); err != nil {
		t.Fatalf("iterate characters: %v", err)
	}
	return out
}

// canarySetplayProject は 1 キャラ分の候補集合を本番と同じ規則で射影する。
func canarySetplayProject(t *testing.T, db *sql.DB, characterID int64) setplaysvc.CandidateProjection {
	t.Helper()
	repo := setplayrepo.New(db)
	ctx := context.Background()
	cands, err := repo.ListCharacterMoveCandidates(ctx, characterID)
	if err != nil {
		t.Fatalf("list candidates: %v", err)
	}
	derivs, err := repo.ListCharacterMoveDerivations(ctx, characterID)
	if err != nil {
		t.Fatalf("list derivations: %v", err)
	}
	return setplaysvc.ProjectCandidates(cands, derivs, setplaysvc.SuggestParams{TargetTypes: canarySetplayTypes()})
}

// canarySetplayTotals は全キャラ合計の候補数を返す(件数固定テスト用)。
func canarySetplayTotals(t *testing.T, db *sql.DB) (fillers, targets int) {
	t.Helper()
	for _, c := range canarySetplayCharacters(t, db) {
		proj := canarySetplayProject(t, db, c.id)
		fillers += len(proj.FillerCodes)
		targets += len(proj.TargetCodes)
	}
	return fillers, targets
}

// canarySetplayCodes は述語に一致する move を "character/move_code" で昇順に返す(全数固定用)。
func canarySetplayCodes(t *testing.T, db *sql.DB, where string) []string {
	t.Helper()
	rows, err := db.Query(`SELECT c.code || '/' || m.code
FROM moves m JOIN characters c ON c.id = m.character_id
WHERE ` + where)
	if err != nil {
		t.Fatalf("query %q: %v", where, err)
	}
	defer rows.Close()
	var out []string
	for rows.Next() {
		var s string
		if err := rows.Scan(&s); err != nil {
			t.Fatalf("scan: %v", err)
		}
		out = append(out, s)
	}
	if err := rows.Err(); err != nil {
		t.Fatalf("iterate: %v", err)
	}
	sort.Strings(out)
	return out
}
