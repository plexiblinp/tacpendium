package comboio

import (
	"archive/zip"
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"strconv"

	"github.com/plexiblinp/tacpendium/internal/model"
	combosvc "github.com/plexiblinp/tacpendium/internal/service/combo"
	"github.com/plexiblinp/tacpendium/internal/service/comboio/csvcore"
)

// exportRowLimit はエクスポート対象コンボの上限(VAL-I03 と対称・往復のため)。
const exportRowLimit = csvcore.DefaultMaxRows

// ExportCSV は対象コンボ + 紐づくセットプレイを 2 CSV にして in-memory zip で返す。
// サーバ側にディスク一時ファイルを作らない(bytes.Buffer 上で完結)。
func (s *service) ExportCSV(ctx context.Context, query ExportQuery) (*ExportResult, error) {
	combos, total, err := s.resolveTargetCombos(ctx, query)
	if err != nil {
		return nil, err
	}
	res := &ExportResult{TotalCombos: total, IncludedCombos: len(combos)}
	// ★★以前はここで slog.WarnContext を書くだけだった。ログはサーバ側にしか出ないため
	//   利用者は一部だけのファイルを完全なものと信じる。⇒ 観測を戻り値へ載せ、
	//   応答ヘッダと画面まで届ける(M29-02 §2.1)。ログは運用のために残す。
	if res.Truncated() {
		slog.WarnContext(ctx, "combo export truncated by row limit",
			slog.Int("limit", exportRowLimit), slog.Int("total", total),
			slog.Int("included", len(combos)), slog.String("range", string(query.Range)))
	}

	resolver, err := newCodeResolver(ctx, s.charRepo, s.moveRepo)
	if err != nil {
		return nil, err
	}

	// combo_id → local_id("c1","c2",…)を採番。
	ids := make([]int64, len(combos))
	localByID := make(map[int64]string, len(combos))
	for i, c := range combos {
		ids[i] = c.ID
		localByID[c.ID] = "c" + strconv.Itoa(i+1)
	}

	// steps バルク取得(レシピ)。
	stepsMap, err := s.comboRepo.FindStepsForCombos(ctx, ids)
	if err != nil {
		return nil, fmt.Errorf("export: load steps: %w", err)
	}

	dtoCombos := make([]csvcore.Combo, 0, len(combos))
	for _, c := range combos {
		dto, err := s.toExportCombo(c, stepsMap[c.ID], localByID[c.ID], resolver)
		if err != nil {
			return nil, err
		}
		dtoCombos = append(dtoCombos, dto)
	}

	// セットプレイ(各コンボに紐づくものを別 CSV へ)。
	dtoSetups, err := s.toExportSetups(ctx, ids, localByID)
	if err != nil {
		return nil, err
	}

	comboCSV, err := csvcore.ExportCSV(dtoCombos)
	if err != nil {
		return nil, fmt.Errorf("export: combo csv: %w", err)
	}
	setupCSV, err := csvcore.ExportSetupsCSV(dtoSetups)
	if err != nil {
		return nil, fmt.Errorf("export: setup csv: %w", err)
	}

	// ★★書出には行数・バイト数の上限が無いのに、取込は上限で弾く(csvcore の
	//   DefaultMaxRows / DefaultMaxBytes)。⇒ 自分が出したファイルを自分の取込が
	//   拒否しうる。その非対称をここで観測する(M29-02 §2.1)。
	//   ★上限そのものは 1 つも変えない。超えたことを言うだけである。
	res.SetupRows = len(dtoSetups)
	res.SetupRowsOverLimit = ExceedsImportRowLimit(len(dtoSetups))
	res.BytesOverLimit = ExceedsImportByteLimit(len(comboCSV)) ||
		ExceedsImportByteLimit(len(setupCSV))
	if res.ReimportBlocked() {
		slog.WarnContext(ctx, "combo export produces a file its own import would reject",
			slog.Int("setupRows", res.SetupRows),
			slog.Bool("setupRowsOverLimit", res.SetupRowsOverLimit),
			slog.Bool("bytesOverLimit", res.BytesOverLimit))
	}

	data, err := zipFiles(map[string]string{
		comboCSVName: comboCSV,
		setupCSVName: setupCSV,
	})
	if err != nil {
		return nil, err
	}
	res.Data = data
	return res, nil
}

// ExceedsImportRowLimit は、その行数が取込側の行数上限を超えるかを返す。
//
// ★★判定を関数にする理由(M29-02 §2.1) —— インラインの比較だと、境界で正しいかを
// 主張するテストが書けない。書けないと、この非対称の観測は「上限の値を書き写した
// リテラル」に依存したまま無検査で残る。⇒ 実際、抽出前は本判定を殺しても
// 全テストが緑のままだった(破壊確認で実測)。
func ExceedsImportRowLimit(rows int) bool {
	return rows > csvcore.DefaultMaxRows
}

// ExceedsImportByteLimit は、そのバイト数が取込側のバイト上限を超えるかを返す。
func ExceedsImportByteLimit(bytes int) bool {
	return bytes > csvcore.DefaultMaxBytes
}

// resolveTargetCombos は ExportQuery から対象コンボ(Tags ロード済み)と、
// 上限を掛けない対象総数を返す。
//
// ★★総数を別に返す理由(M29-02 §2.1) —— 返ってきた件数だけでは
// 「ちょうど上限だった」と「上限を超えて切り捨てた」を区別できない。
// 区別できないまま「>= 上限」で判定していたのが着手前の形であり、
// ちょうど上限のときに偽陽性を出していた。
func (s *service) resolveTargetCombos(ctx context.Context, query ExportQuery) ([]*model.Combo, int, error) {
	switch query.Range {
	case RangeSelected:
		// ★総数は「利用者が指定した ID の数」である。上限で読むのをやめても、
		//   いくつ指定されたかは失われない。
		total := len(query.SelectedIDs)
		out := make([]*model.Combo, 0, len(query.SelectedIDs))
		for _, id := range query.SelectedIDs {
			if len(out) >= exportRowLimit {
				break
			}
			c, err := s.comboSvc.Get(ctx, id, query.UserID)
			if err != nil {
				return nil, 0, fmt.Errorf("export: get combo %d: %w", id, err)
			}
			out = append(out, c)
		}
		return out, total, nil
	default:
		// all / filter / mycombo はいずれも List のフィルタで表現する。
		filter := combosvc.ListFilter{
			CharacterID:    query.CharacterID,
			TagIDs:         query.TagIDs,
			Position:       query.Position,
			HitType:        query.HitType,
			OpponentStance: query.OpponentStance,
			IsDraft:        query.IsDraft,
			Limit:          exportRowLimit,
			// ★載るタグを出力する利用者のものへ絞る(M22-02 §4.5-16)。
			UserID: query.UserID,
		}
		combos, err := s.comboSvc.List(ctx, filter)
		if err != nil {
			return nil, 0, err
		}
		// ★総数は同じ絞り込みで数え直す。数えられなかった場合は「載った件数 = 総数」に
		//   倒す(切り捨て無し扱い)。⇒ 数えられないことを理由に書出そのものを
		//   落とさない。ただし嘘の「切り捨てました」も出さない。
		total := len(combos)
		countFilter := filter
		countFilter.Limit = 0
		countFilter.Offset = 0
		if n, cErr := s.comboSvc.Count(ctx, countFilter); cErr != nil {
			slog.WarnContext(ctx, "export: count target combos failed",
				slog.String("err", cErr.Error()))
		} else {
			total = n
		}
		return combos, total, nil
	}
}

// toExportCombo は model.Combo + steps を csvcore.Combo へ変換する(意味単位)。
func (s *service) toExportCombo(c *model.Combo, steps []model.ComboStep, localID string, resolver *codeResolver) (csvcore.Combo, error) {
	charCode, ok := resolver.characterCode(c.CharacterID)
	if !ok {
		return csvcore.Combo{}, fmt.Errorf("export: unknown character_id %d", c.CharacterID)
	}
	dto := csvcore.Combo{
		LocalID:               localID,
		CharacterCode:         charCode,
		IsDraft:               c.IsDraft,
		Damage:                c.Damage,
		DriveAvailableAtStart: c.DriveAvailableAtStart,
		SAAvailableAtStart:    c.SAAvailableAtStart,
		DriveDamage:           c.DriveDamage,
		SAGaugeConsumed:       c.SAGaugeConsumed,
		DriveGaugeConsumed:    c.DriveGaugeConsumed,
		Position:              derefStr(c.Position),
		OpponentStance:        derefStr(c.OpponentStance),
		HitType:               derefStr(c.HitType),
		OpponentSize:          derefStr(c.OpponentSize),
		KnockdownAdvantage:    c.KnockdownAdvantage,
		OkiVerified:           &c.OkiVerified,
		StartPositionMass:     c.StartPositionMass,
		CarryDistanceMass:     c.CarryDistanceMass,
		StarterMeaty:          &c.StarterMeaty, // M37-07

		Memo:      derefStr(c.Memo),
		Link:      derefStr(c.Link),
		VideoPath: derefStr(c.VideoPath),
		ImagePath: derefStr(c.ImagePath),
		Tags:      toExportTags(c.Tags),
		Steps:     toExportSteps(steps),
	}
	// 起き攻めオプション(正規化)→ CSV フラット 12 列(M16-03)。
	// ★M27-02b: 行なし→nil(未検証) / 成立→true / 不成立→false。
	setOkiFlatFlags(&dto, c.OkiOptions)
	if c.Situation != nil {
		dto.Situation = json.RawMessage(*c.Situation)
	}
	return dto, nil
}

// setOkiFlatFlags は正規化済み起き攻めオプション列を CSV フラット 12 フラグ(*bool)へ写す(M16-03)。
// sparse: オプション行があれば true、無ければ nil(空セル=NULL)。CSV は往復のためフラット列を維持する。
//
// ★M27-02b: 「調べたか」は本関数の担当ではない。combos.oki_verified が別に持つ。
func setOkiFlatFlags(dto *csvcore.Combo, opts []model.OkiOption) {
	has := func(attackType, techType string, usesDR bool) *bool {
		for _, o := range opts {
			if o.AttackType == attackType && o.TechType == techType && o.UsesDR == usesDR {
				b := true
				return &b
			}
		}
		return nil
	}
	dto.OkiMeatyNeutralTechThrow = has(model.OkiAttackTypeThrowMeaty, model.OkiTechTypeNeutral, false)
	dto.OkiMeatyNeutralTechThrowDR = has(model.OkiAttackTypeThrowMeaty, model.OkiTechTypeNeutral, true)
	dto.OkiMeatyBackTechThrow = has(model.OkiAttackTypeThrowMeaty, model.OkiTechTypeBack, false)
	dto.OkiMeatyBackTechThrowDR = has(model.OkiAttackTypeThrowMeaty, model.OkiTechTypeBack, true)
	dto.OkiShimmyNeutralTech = has(model.OkiAttackTypeShimmy, model.OkiTechTypeNeutral, false)
	dto.OkiShimmyNeutralTechDR = has(model.OkiAttackTypeShimmy, model.OkiTechTypeNeutral, true)
	dto.OkiShimmyBackTech = has(model.OkiAttackTypeShimmy, model.OkiTechTypeBack, false)
	dto.OkiShimmyBackTechDR = has(model.OkiAttackTypeShimmy, model.OkiTechTypeBack, true)
	dto.OkiStrikeMeatyNeutralTech = has(model.OkiAttackTypeStrikeMeaty, model.OkiTechTypeNeutral, false)
	dto.OkiStrikeMeatyNeutralTechDR = has(model.OkiAttackTypeStrikeMeaty, model.OkiTechTypeNeutral, true)
	dto.OkiStrikeMeatyBackTech = has(model.OkiAttackTypeStrikeMeaty, model.OkiTechTypeBack, false)
	dto.OkiStrikeMeatyBackTechDR = has(model.OkiAttackTypeStrikeMeaty, model.OkiTechTypeBack, true)
}

// toExportSetups は対象コンボに紐づくセットプレイを csvcore.Setup へ変換する。
func (s *service) toExportSetups(ctx context.Context, comboIDs []int64, localByID map[int64]string) ([]csvcore.Setup, error) {
	setupMap, err := s.setupSvc.ListSetupsByComboIDs(ctx, comboIDs)
	if err != nil {
		return nil, fmt.Errorf("export: list setups: %w", err)
	}
	// 同一セットプレイの steps を 1 回だけ取得するためのキャッシュ。
	stepsCache := make(map[int64][]model.SetupStep)
	out := make([]csvcore.Setup, 0)
	for _, comboID := range comboIDs {
		parentLocal := localByID[comboID]
		for _, resp := range setupMap[comboID] {
			steps, ok := stepsCache[resp.Setup.ID]
			if !ok {
				full, err := s.setupSvc.GetSetup(ctx, resp.Setup.ID)
				if err != nil {
					return nil, fmt.Errorf("export: get setup %d: %w", resp.Setup.ID, err)
				}
				steps = full.Setup.Steps
				stepsCache[resp.Setup.ID] = steps
			}
			out = append(out, csvcore.Setup{
				ParentComboLocalID: parentLocal,
				Name:               derefStr(resp.Setup.Name),
				Description:        derefStr(resp.Setup.Description),
				Steps:              toExportSetupSteps(steps),
			})
		}
	}
	return out, nil
}

func toExportTags(tags []model.Tag) []csvcore.Tag {
	if len(tags) == 0 {
		return nil
	}
	out := make([]csvcore.Tag, len(tags))
	for i, t := range tags {
		out[i] = csvcore.Tag{Name: t.Name, Category: derefStr(t.Category), Color: derefStr(t.Color)}
	}
	return out
}

func toExportSteps(steps []model.ComboStep) []csvcore.Step {
	if len(steps) == 0 {
		return nil
	}
	out := make([]csvcore.Step, len(steps))
	for i, st := range steps {
		out[i] = csvcore.Step{MoveCode: derefStr(st.MoveCode), Modifiers: toExportModifiers(st.Modifiers)}
	}
	return out
}

func toExportSetupSteps(steps []model.SetupStep) []csvcore.Step {
	if len(steps) == 0 {
		return nil
	}
	out := make([]csvcore.Step, len(steps))
	for i, st := range steps {
		out[i] = csvcore.Step{MoveCode: derefStr(st.MoveCode), Modifiers: toExportModifiers(st.Modifiers)}
	}
	return out
}

func toExportModifiers(m *model.Modifiers) csvcore.Modifiers {
	if m == nil {
		return csvcore.Modifiers{}
	}
	return csvcore.Modifiers{Flags: m.Flags, Notes: m.Notes, Type: m.Type}
}

// zipFiles は name→content を in-memory zip にまとめて返す。
func zipFiles(files map[string]string) ([]byte, error) {
	var buf bytes.Buffer
	w := zip.NewWriter(&buf)
	// 決定的順序で書き込む(combos.csv → setups.csv)。
	for _, name := range []string{comboCSVName, setupCSVName} {
		content, ok := files[name]
		if !ok {
			continue
		}
		f, err := w.Create(name)
		if err != nil {
			return nil, fmt.Errorf("zip create %s: %w", name, err)
		}
		if _, err := f.Write([]byte(content)); err != nil {
			return nil, fmt.Errorf("zip write %s: %w", name, err)
		}
	}
	if err := w.Close(); err != nil {
		return nil, fmt.Errorf("zip close: %w", err)
	}
	return buf.Bytes(), nil
}

func derefStr(p *string) string {
	if p == nil {
		return ""
	}
	return *p
}
