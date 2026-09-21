package comboio

import (
	"context"
	"fmt"
	"strconv"

	"github.com/plexiblinp/tacpendium/internal/model"
	combosvc "github.com/plexiblinp/tacpendium/internal/service/combo"
	"github.com/plexiblinp/tacpendium/internal/service/comboio/csvcore"
	setupsvc "github.com/plexiblinp/tacpendium/internal/service/setup"
	"github.com/plexiblinp/tacpendium/internal/service/validation"
)

// importOptions は csvcore のパース設定(本体は既定上限を採用)。
func importOptions(resolver *codeResolver) csvcore.Options {
	return csvcore.Options{Lookup: resolver}
}

// ParsePreview はコンボ CSV(+任意セットプレイ CSV)を検証・無害化し、行ごとの結果を返す(DB 書込なし)。
func (s *service) ParsePreview(ctx context.Context, comboCSV, setupCSV string) (*PreviewResult, error) {
	resolver, err := newCodeResolver(ctx, s.charRepo, s.moveRepo)
	if err != nil {
		return nil, err
	}
	out := &PreviewResult{}

	comboRes, comboErr := csvcore.ParseAndValidate(comboCSV, importOptions(resolver))
	if comboRes.FileError != nil {
		// ★★行レベルと同じ `[CODE] ...` の形で渡す(M29-02 §2.1)。
		//   着手前はここだけ Message を素で渡しており、コードが落ちるため
		//   フロントの formatIssue が訳に当てられなかった。
		//   ⇒ ja.json に「行数が上限を超えています」が在るのに一度も出ず、
		//     画面には英語の `row count exceeds limit 1000` が出ていた。
		//   ★鳴ってはいたが読めなかった、という形である。
		out.ComboFileError = issueText(*comboRes.FileError)
	} else if comboErr != nil {
		out.ComboFileError = comboErr.Error()
	}

	// 同一バッチで取り込み可能なコンボ local_id 集合(セットプレイ親解決の判定に使う)。
	batchLocals := map[string]bool{}

	for _, rr := range comboRes.RowResults {
		row := ComboPreviewRow{
			RowNumber:  rr.RowNumber,
			Importable: rr.Status != csvcore.StatusError,
		}
		for _, is := range rr.Issues {
			if is.Severity == csvcore.SeverityError {
				row.Errors = append(row.Errors, issueText(is))
			} else {
				row.Warnings = append(row.Warnings, issueText(is))
			}
		}
		if rr.Combo != nil {
			c := rr.Combo
			row.LocalID = localIDOf(c.LocalID, rr.RowNumber)
			row.CharacterCode = c.CharacterCode
			row.IsDraft = c.IsDraft
			row.StepCount = len(c.Steps)
			if len(c.Steps) > 0 {
				row.StarterMoveCode = c.Steps[0].MoveCode
			}
			batchLocals[row.LocalID] = true
			// 重複判定(VAL-C02)。仮登録は重複対象外。
			if !c.IsDraft {
				dupID, err := s.checkDuplicate(ctx, c, resolver)
				if err != nil {
					return nil, err
				}
				if dupID != nil {
					row.Duplicate = true
					row.DuplicateComboID = dupID
					row.Warnings = append(row.Warnings,
						fmt.Sprintf("既存コンボ(ID %d)と重複(VAL-C02)", *dupID))
				}
			}
		} else {
			// Error 行でも local_id を表示できるよう row 番号ベースの ID を割り当てる。
			row.LocalID = localIDOf("", rr.RowNumber)
		}
		out.Combos = append(out.Combos, row)
	}
	out.Summary.ComboTotal = comboRes.Summary.Total
	out.Summary.ComboOK = comboRes.Summary.OK
	out.Summary.ComboWarning = comboRes.Summary.Warning
	out.Summary.ComboError = comboRes.Summary.Error

	// セットプレイ CSV(任意)。
	if setupCSV != "" {
		setupRes, setupErr := csvcore.ParseSetupsCSV(setupCSV, csvcore.Options{})
		if setupRes.FileError != nil {
			// ★コンボ側と同じ形にする(片方だけ直すと非対称が残る)。
			out.SetupFileError = issueText(*setupRes.FileError)
		} else if setupErr != nil {
			out.SetupFileError = setupErr.Error()
		}
		for _, rr := range setupRes.RowResults {
			row := SetupPreviewRow{
				RowNumber:  rr.RowNumber,
				Importable: rr.Status != csvcore.StatusError,
			}
			for _, is := range rr.Issues {
				if is.Severity == csvcore.SeverityError {
					row.Errors = append(row.Errors, issueText(is))
				} else {
					row.Warnings = append(row.Warnings, issueText(is))
				}
			}
			if rr.Setup != nil {
				row.ParentComboLocalID = rr.Setup.ParentComboLocalID
				row.Name = rr.Setup.Name
				row.StepCount = len(rr.Setup.Steps)
				row.ParentResolvable = batchLocals[rr.Setup.ParentComboLocalID] || isNumericID(rr.Setup.ParentComboLocalID)
				if !row.ParentResolvable {
					row.Warnings = append(row.Warnings,
						fmt.Sprintf("親コンボ(%s)が取込対象に見つかりません", rr.Setup.ParentComboLocalID))
				}
			}
			out.Setups = append(out.Setups, row)
		}
		out.Summary.SetupTotal = setupRes.Summary.Total
	}

	return out, nil
}

// Commit は選択 local_id のコンボ(+紐づくセットプレイ)を取り込み、行単位レポートを返す。
func (s *service) Commit(ctx context.Context, comboCSV, setupCSV string, selected []string, action DupAction, userID int64) (*CommitResult, error) {
	resolver, err := newCodeResolver(ctx, s.charRepo, s.moveRepo)
	if err != nil {
		return nil, err
	}
	tags := newTagResolver(s.tagSvc, userID)

	comboRes, comboErr := csvcore.ParseAndValidate(comboCSV, importOptions(resolver))
	if comboRes.FileError != nil {
		// ★確定側もプレビューと同じ形で返す。⇒ 同じ拒否理由が経路によって
		//   違う文字列になる状態を作らない。
		return nil, fmt.Errorf("import: combo csv rejected: %s", issueText(*comboRes.FileError))
	}
	if comboErr != nil {
		return nil, fmt.Errorf("import: combo csv: %w", comboErr)
	}

	selectedSet := make(map[string]bool, len(selected))
	for _, l := range selected {
		selectedSet[l] = true
	}

	out := &CommitResult{}
	// local_id → 作成済みコンボ ID(セットプレイ親解決用)。
	createdByLocal := map[string]int64{}

	for _, rr := range comboRes.RowResults {
		if rr.Combo == nil {
			continue // Error 行はそもそも取り込み候補でない
		}
		localID := localIDOf(rr.Combo.LocalID, rr.RowNumber)
		if !selectedSet[localID] {
			continue // 未選択行はスキップ(レポートにも出さない)
		}
		s.commitOneCombo(ctx, rr.Combo, localID, rr.RowNumber, action, resolver, tags, createdByLocal, out)
	}

	// セットプレイ(任意)。
	if setupCSV != "" {
		setupRes, setupErr := csvcore.ParseSetupsCSV(setupCSV, csvcore.Options{})
		if setupRes.FileError != nil {
			return nil, fmt.Errorf("import: setup csv rejected: %s", issueText(*setupRes.FileError))
		}
		if setupErr != nil {
			return nil, fmt.Errorf("import: setup csv: %w", setupErr)
		}
		for _, rr := range setupRes.RowResults {
			if rr.Setup == nil {
				continue
			}
			s.commitOneSetup(ctx, rr.Setup, rr.RowNumber, resolver, createdByLocal, out, userID)
		}
	}

	return out, nil
}

// commitOneCombo は 1 コンボ行を取り込む(skip / setups_only 動作)。
func (s *service) commitOneCombo(
	ctx context.Context, dto *csvcore.Combo, localID string, rowNum int, action DupAction,
	resolver *codeResolver, tags *tagResolver, createdByLocal map[string]int64, out *CommitResult,
) {
	report := func(status, reason string, comboID *int64) {
		out.Rows = append(out.Rows, CommitRowResult{
			Kind: "combo", RowNumber: rowNum, LocalID: localID, Status: status, Reason: reason, ComboID: comboID,
		})
		switch status {
		case "created":
			out.Summary.Success++
		case "skipped":
			out.Summary.Skipped++
		default:
			out.Summary.Failed++
		}
	}

	// 重複動作(仮登録は VAL-C02 対象外なので常に新規作成へ進む):
	//   - skip(既定): 既存重複ありならコンボを取り込まない。
	//   - setups_only: 既存重複ありならコンボ本体は skip するが、重複相手の既存コンボ id を
	//     親解決 map に登録し、配下セットプレイを既存コンボへ紐づけて取り込ませる(B-6)。
	// いずれも combos の同一性(recipe_hash / RecomputeComboCache / DuplicateKey)には触れない。
	if !dto.IsDraft && (action == DupSkip || action == DupSetupsOnly) {
		dupID, err := s.checkDuplicate(ctx, dto, resolver)
		if err != nil {
			report("failed", "重複判定に失敗: "+err.Error(), nil)
			return
		}
		if dupID != nil {
			if action == DupSetupsOnly {
				createdByLocal[localID] = *dupID // 配下セットプレイを既存コンボへ親解決させる
				report("skipped", fmt.Sprintf("既存コンボ(ID %d)と重複のためコンボはスキップ(セットプレイのみ取込)", *dupID), nil)
			} else {
				report("skipped", fmt.Sprintf("既存コンボ(ID %d)と重複のためスキップ", *dupID), nil)
			}
			return
		}
	}

	input, err := s.toCreateInput(ctx, dto, resolver, tags)
	if err != nil {
		report("failed", err.Error(), nil)
		return
	}
	created, vr, err := s.comboSvc.Create(ctx, input)
	if err != nil {
		report("failed", "作成に失敗: "+err.Error(), nil)
		return
	}
	if vr.HasError() {
		report("failed", "検証エラー: "+validationText(vr), nil)
		return
	}
	createdByLocal[localID] = created.ID
	report("created", "", &created.ID)
}

// commitOneSetup は 1 セットプレイ行を取り込む(親コンボ解決)。
func (s *service) commitOneSetup(
	ctx context.Context, dto *csvcore.Setup, rowNum int,
	resolver *codeResolver, createdByLocal map[string]int64, out *CommitResult, userID int64,
) {
	report := func(status, reason string) {
		out.Rows = append(out.Rows, CommitRowResult{
			Kind: "setup", RowNumber: rowNum, LocalID: dto.ParentComboLocalID, Status: status, Reason: reason,
		})
		switch status {
		case "created":
			out.Summary.Success++
		case "skipped":
			out.Summary.Skipped++
		default:
			out.Summary.Failed++
		}
	}

	parentID, ok := s.resolveSetupParent(dto.ParentComboLocalID, createdByLocal)
	if !ok {
		report("skipped", fmt.Sprintf("親コンボ(%s)が取込対象外/未作成のためスキップ", dto.ParentComboLocalID))
		return
	}
	// 親コンボの character_id を取得(セットプレイは親と同一キャラ)。
	parent, err := s.comboSvc.Get(ctx, parentID, userID)
	if err != nil {
		report("failed", "親コンボ取得に失敗: "+err.Error())
		return
	}
	charCode, _ := resolver.characterCode(parent.CharacterID)
	input := setupsvc.CreateSetupInput{
		CharacterID: parent.CharacterID,
		Name:        strToPtr(dto.Name),
		Description: strToPtr(dto.Description),
		Steps:       s.toSetupSteps(dto.Steps, charCode, resolver),
	}
	_, vr, err := s.setupSvc.CreateSetup(ctx, parentID, input)
	if err != nil {
		report("failed", "作成に失敗: "+err.Error())
		return
	}
	if vr.HasError() {
		// B-6 セットプレイ重複判定: 既存コンボ配下に同一レシピのセットプレイが既にある場合
		// (VAL-S04)は二重登録せず graceful skip 扱いにする(レシピ一致=セットプレイの同一性・
		// 名前非依存＝開発者確定 2026-07-18)。「セットプレイのみ取込」で既存コンボへ解決された
		// 場合に効く(新規作成コンボ配下は既存 0 件のため VAL-S04 は出ず自然に取り込まれる)。
		// combos の同一性(recipe_hash / RecomputeComboCache)には触れない。
		// 併発エラー(VAL-S04 + 別の検証エラー)は真の失敗理由を skip で覆い隠さないよう
		// failed 優先とし、VAL-S04 のみで構成される場合だけ graceful skip する。
		if isOnlySetupDuplicateError(vr) {
			report("skipped", "同一レシピの既存セットプレイのためスキップ")
			return
		}
		report("failed", "検証エラー: "+validationText(vr))
		return
	}
	report("created", "")
}

// resolveSetupParent は parent_combo_local_id を実コンボ ID へ解決する。
// 同一バッチで作成された local_id を優先し、無ければ数値を既存コンボ ID とみなす。
func (s *service) resolveSetupParent(parentLocal string, createdByLocal map[string]int64) (int64, bool) {
	if id, ok := createdByLocal[parentLocal]; ok {
		return id, true
	}
	if id, err := strconv.ParseInt(parentLocal, 10, 64); err == nil {
		return id, true
	}
	return 0, false
}

// isOnlySetupDuplicateError は検証エラーが VAL-S04(同一コンボ配下の同一レシピ重複)のみで
// 構成されるかを返す。レシピ一致=セットプレイの同一性(名前非依存)につき、これ単独なら
// B-6 の graceful skip とする。VAL-S04 に他の検証エラーが併発する場合は false を返し、
// 真の失敗理由を skip で覆い隠さない(failed 優先)。
func isOnlySetupDuplicateError(vr validation.ValidationResult) bool {
	errs := vr.Errors()
	if len(errs) == 0 {
		return false
	}
	for _, e := range errs {
		if e.Code != setupsvc.CodeS04Duplicate {
			return false
		}
	}
	return true
}

// checkDuplicate は dto コンボの VAL-C02 重複先コンボ ID を返す(無ければ nil)。
func (s *service) checkDuplicate(ctx context.Context, dto *csvcore.Combo, resolver *codeResolver) (*int64, error) {
	steps := s.toComboSteps(dto.Steps, dto.CharacterCode, resolver)
	var starter *int64
	if len(steps) > 0 {
		starter = steps[0].MoveID
	}
	charID, ok := resolver.characterID(dto.CharacterCode)
	if !ok {
		return nil, nil // 未知キャラは VAL-I06 で別途 ERROR
	}
	res, err := s.comboSvc.CheckDuplicate(ctx, combosvc.CheckDuplicateInput{
		CharacterID:    charID,
		StarterMoveID:  starter,
		Position:       strToPtr(dto.Position),
		OpponentStance: strToPtr(dto.OpponentStance),
		HitType:        strToPtr(dto.HitType),
		OpponentSize:   strToPtr(dto.OpponentSize),
		// ★M37-07: 重複判定キーの 8 つ目。空セル(旧 CSV)= nil = false(通常始動)。
		StarterMeaty: dto.StarterMeaty != nil && *dto.StarterMeaty,
		Steps:        steps,
	})
	if err != nil {
		return nil, fmt.Errorf("check duplicate: %w", err)
	}
	if res != nil && len(res.Duplicates) > 0 {
		id := res.Duplicates[0].ID
		return &id, nil
	}
	return nil, nil
}

// toCreateInput は csvcore.Combo を combo.Service.Create 入力へ変換する(starter 再導出含む)。
func (s *service) toCreateInput(ctx context.Context, dto *csvcore.Combo, resolver *codeResolver, tags *tagResolver) (combosvc.CreateInput, error) {
	charID, ok := resolver.characterID(dto.CharacterCode)
	if !ok {
		return combosvc.CreateInput{}, fmt.Errorf("未知の character_code %q", dto.CharacterCode)
	}
	steps := s.toComboSteps(dto.Steps, dto.CharacterCode, resolver)
	// starter_move_id はレシピ先頭ステップの解決済 move_id から再導出(VAL-C03 整合)。
	var starter *int64
	if len(steps) > 0 {
		starter = steps[0].MoveID
	}
	tagIDs, err := tags.resolve(ctx, dto.Tags)
	if err != nil {
		return combosvc.CreateInput{}, fmt.Errorf("タグ解決に失敗: %w", err)
	}
	return combosvc.CreateInput{
		// ★取り込む人。タグの紐づけをこの利用者の分だけ入れ替えるために要る
		// (M22-02 §4.5-14)。tagResolver と同じ値を使う——取り違えると
		// 解決したタグと紐づける相手がずれる。
		UserID:                tags.userID,
		CharacterID:           charID,
		IsDraft:               dto.IsDraft,
		Damage:                dto.Damage,
		StarterMoveID:         starter,
		Position:              strToPtr(dto.Position),
		OpponentStance:        strToPtr(dto.OpponentStance),
		HitType:               strToPtr(dto.HitType),
		OpponentSize:          strToPtr(dto.OpponentSize),
		DriveAvailableAtStart: dto.DriveAvailableAtStart,
		SAAvailableAtStart:    dto.SAAvailableAtStart,
		DriveDamage:           dto.DriveDamage,
		SAGaugeConsumed:       dto.SAGaugeConsumed,
		DriveGaugeConsumed:    dto.DriveGaugeConsumed,
		KnockdownAdvantage:    dto.KnockdownAdvantage,
		// ★M27-02b: 空セル(旧 CSV)= nil = false(未検証)。
		OkiVerified:       dto.OkiVerified != nil && *dto.OkiVerified,
		StartPositionMass: dto.StartPositionMass,
		CarryDistanceMass: dto.CarryDistanceMass,
		// ★M37-07: 空セル(旧 CSV)= nil = false(通常始動)。
		StarterMeaty: dto.StarterMeaty != nil && *dto.StarterMeaty,
		Memo:         strToPtr(dto.Memo),
		Situation:    rawToPtr(dto.Situation),
		Link:         strToPtr(dto.Link),
		VideoPath:    strToPtr(dto.VideoPath),
		ImagePath:    strToPtr(dto.ImagePath),
		OkiOptions:   okiOptionsFromFlatFlags(dto),
		Steps:        steps,
		TagIDs:       tagIDs,
	}, nil
}

// okiOptionsFromFlatFlags は CSV フラット 12 フラグ(*bool)を正規化済み起き攻めオプション列へ写す(M16-03)。
// sparse: フラグが true の組合せのみ行を作る("false"/空セルは行なし=旧 CSV 後方互換)。
//
// ★M27-02b: 「調べたか」は本関数の担当ではない。combos.oki_verified が別に持つ
//
//	(CSV では oki_verified 列。okiVerifiedFromCSV)。
func okiOptionsFromFlatFlags(dto *csvcore.Combo) []model.OkiOption {
	var out []model.OkiOption
	addIf := func(p *bool, attackType, techType string, usesDR bool) {
		if p != nil && *p {
			out = append(out, model.OkiOption{AttackType: attackType, TechType: techType, UsesDR: usesDR})
		}
	}
	addIf(dto.OkiMeatyNeutralTechThrow, model.OkiAttackTypeThrowMeaty, model.OkiTechTypeNeutral, false)
	addIf(dto.OkiMeatyNeutralTechThrowDR, model.OkiAttackTypeThrowMeaty, model.OkiTechTypeNeutral, true)
	addIf(dto.OkiMeatyBackTechThrow, model.OkiAttackTypeThrowMeaty, model.OkiTechTypeBack, false)
	addIf(dto.OkiMeatyBackTechThrowDR, model.OkiAttackTypeThrowMeaty, model.OkiTechTypeBack, true)
	addIf(dto.OkiShimmyNeutralTech, model.OkiAttackTypeShimmy, model.OkiTechTypeNeutral, false)
	addIf(dto.OkiShimmyNeutralTechDR, model.OkiAttackTypeShimmy, model.OkiTechTypeNeutral, true)
	addIf(dto.OkiShimmyBackTech, model.OkiAttackTypeShimmy, model.OkiTechTypeBack, false)
	addIf(dto.OkiShimmyBackTechDR, model.OkiAttackTypeShimmy, model.OkiTechTypeBack, true)
	addIf(dto.OkiStrikeMeatyNeutralTech, model.OkiAttackTypeStrikeMeaty, model.OkiTechTypeNeutral, false)
	addIf(dto.OkiStrikeMeatyNeutralTechDR, model.OkiAttackTypeStrikeMeaty, model.OkiTechTypeNeutral, true)
	addIf(dto.OkiStrikeMeatyBackTech, model.OkiAttackTypeStrikeMeaty, model.OkiTechTypeBack, false)
	addIf(dto.OkiStrikeMeatyBackTechDR, model.OkiAttackTypeStrikeMeaty, model.OkiTechTypeBack, true)
	return out
}

// toComboSteps は csvcore.Step 列を model.ComboStep 列へ(move_code→id 解決・VAL-I07 は nil)。
func (s *service) toComboSteps(in []csvcore.Step, charCode string, resolver *codeResolver) []model.ComboStep {
	out := make([]model.ComboStep, 0, len(in))
	for i, st := range in {
		ms := model.ComboStep{StepOrder: i + 1, Modifiers: toModelModifiers(st.Modifiers)}
		if st.MoveCode != "" {
			if id, ok := resolver.moveID(charCode, st.MoveCode); ok {
				ms.MoveID = &id
			}
		}
		out = append(out, ms)
	}
	return out
}

// toSetupSteps は csvcore.Step 列を model.SetupStep 列へ。
func (s *service) toSetupSteps(in []csvcore.Step, charCode string, resolver *codeResolver) []model.SetupStep {
	out := make([]model.SetupStep, 0, len(in))
	for i, st := range in {
		ms := model.SetupStep{StepOrder: i + 1, Modifiers: toModelModifiers(st.Modifiers)}
		if st.MoveCode != "" {
			if id, ok := resolver.moveID(charCode, st.MoveCode); ok {
				ms.MoveID = &id
			}
		}
		out = append(out, ms)
	}
	return out
}

func toModelModifiers(m csvcore.Modifiers) *model.Modifiers {
	if len(m.Flags) == 0 && m.Notes == "" && m.Type == "" {
		return nil
	}
	return &model.Modifiers{Flags: m.Flags, Type: m.Type, Notes: m.Notes}
}

// ── タグ解決(name→既存解決 or 新規作成・キャッシュ)──────────────────────

type tagResolver struct {
	svc    TagService
	userID int64
	byName map[string]int64
	loaded bool
}

// newTagResolver は取込時のタグ解決器を作る。
//
// ★userID は「取り込む人」である。ここを取り違えると、取り込んだタグが
// 別人のものになる(M22-02 §4.5-5)。タグは利用者ごとに閉じており(D-402)、
// 既存タグの引き当ても作成も同じ利用者で行う必要がある。
func newTagResolver(svc TagService, userID int64) *tagResolver {
	return &tagResolver{svc: svc, userID: userID, byName: map[string]int64{}}
}

func (t *tagResolver) resolve(ctx context.Context, tags []csvcore.Tag) ([]int64, error) {
	if len(tags) == 0 {
		return nil, nil
	}
	if !t.loaded {
		existing, err := t.svc.ListTags(ctx, t.userID, "", false, nil)
		if err != nil {
			return nil, fmt.Errorf("list tags: %w", err)
		}
		for _, tg := range existing {
			t.byName[tg.Name] = tg.ID
		}
		t.loaded = true
	}
	out := make([]int64, 0, len(tags))
	for _, tg := range tags {
		if tg.Name == "" {
			continue // 空 name は VAL-T02 WARNING 済み・紐付け対象外
		}
		if id, ok := t.byName[tg.Name]; ok {
			out = append(out, id)
			continue
		}
		created, err := t.svc.CreateTag(ctx, t.userID, model.CreateTagInput{
			Name:     tg.Name,
			Category: strToPtr(tg.Category),
			Color:    strToPtr(tg.Color),
		})
		if err != nil {
			return nil, fmt.Errorf("create tag %q: %w", tg.Name, err)
		}
		t.byName[created.Name] = created.ID
		out = append(out, created.ID)
	}
	return out, nil
}

// ── 小ヘルパ ─────────────────────────────────────────────────────────

func localIDOf(localID string, rowNum int) string {
	if localID != "" {
		return localID
	}
	return "row:" + strconv.Itoa(rowNum)
}

func isNumericID(s string) bool {
	_, err := strconv.ParseInt(s, 10, 64)
	return err == nil
}

func strToPtr(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}

func rawToPtr(r []byte) *string {
	if len(r) == 0 {
		return nil
	}
	s := string(r)
	return &s
}

func issueText(is csvcore.Issue) string {
	if is.Column != "" {
		return fmt.Sprintf("[%s] %s: %s", is.Code, is.Column, is.Message)
	}
	return fmt.Sprintf("[%s] %s", is.Code, is.Message)
}

func validationText(vr validation.ValidationResult) string {
	errs := vr.Errors()
	if len(errs) == 0 {
		return "(詳細なし)"
	}
	out := ""
	for i, e := range errs {
		if i > 0 {
			out += "; "
		}
		out += fmt.Sprintf("[%s] %s", e.Code, e.Message)
	}
	return out
}
