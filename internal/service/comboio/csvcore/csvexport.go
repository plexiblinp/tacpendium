package csvcore

import (
	"encoding/csv"
	"encoding/json"
	"fmt"
	"strings"
)

// ExportCSV は combos を RFC 4180 準拠の CSV 文字列へ書き出す(コンボ CSV)。
// 1コンボ1行、列順は CSVColumns に従う。memo は VAL-I10 無害化を適用する。
func ExportCSV(combos []Combo) (string, error) {
	var b strings.Builder
	w := csv.NewWriter(&b)
	w.Comma = CSVComma

	if err := w.Write(CSVColumns); err != nil {
		return "", err
	}
	for i := range combos {
		fields, err := encodeCombo(&combos[i])
		if err != nil {
			return "", fmt.Errorf("combo[%d]: %w", i, err)
		}
		rec := make([]string, len(CSVColumns))
		for j, col := range CSVColumns {
			rec[j] = fields[col]
		}
		if err := w.Write(rec); err != nil {
			return "", err
		}
	}
	w.Flush()
	if err := w.Error(); err != nil {
		return "", err
	}
	return b.String(), nil
}

// ExportSetupsCSV は setups をセットプレイ CSV 文字列へ書き出す(別ファイル)。
func ExportSetupsCSV(setups []Setup) (string, error) {
	var b strings.Builder
	w := csv.NewWriter(&b)
	w.Comma = CSVComma

	if err := w.Write(SetupCSVColumns); err != nil {
		return "", err
	}
	for i := range setups {
		fields, err := encodeSetup(&setups[i])
		if err != nil {
			return "", fmt.Errorf("setup[%d]: %w", i, err)
		}
		rec := make([]string, len(SetupCSVColumns))
		for j, col := range SetupCSVColumns {
			rec[j] = fields[col]
		}
		if err := w.Write(rec); err != nil {
			return "", err
		}
	}
	w.Flush()
	if err := w.Error(); err != nil {
		return "", err
	}
	return b.String(), nil
}

// encodeCombo は1コンボを「列名→セル値」へ変換する。
func encodeCombo(c *Combo) (map[string]string, error) {
	tags, err := marshalJSONOrEmpty(c.Tags, len(c.Tags) == 0)
	if err != nil {
		return nil, fmt.Errorf("encode tags: %w", err)
	}
	recipe, err := marshalJSONOrEmpty(c.Steps, len(c.Steps) == 0)
	if err != nil {
		return nil, fmt.Errorf("encode recipe: %w", err)
	}

	return map[string]string{
		ColLocalID:                    c.LocalID,
		ColCharacterCode:              c.CharacterCode,
		ColIsDraft:                    boolToStr(c.IsDraft),
		ColDamage:                     intPtrToStr(c.Damage),
		ColDriveAvailableAtStart:      floatPtrToStr(c.DriveAvailableAtStart),
		ColSAAvailableAtStart:         intPtrToStr(c.SAAvailableAtStart),
		ColDriveDamage:                floatPtrToStr(c.DriveDamage),
		ColPosition:                   c.Position,
		ColOpponentStance:             c.OpponentStance,
		ColHitType:                    c.HitType,
		ColOpponentSize:               c.OpponentSize,
		ColSituation:                  rawToStr(c.Situation),
		ColOkiMeatyNeutralTechThrow:   boolPtrToStr(c.OkiMeatyNeutralTechThrow),
		ColOkiMeatyNeutralTechThrowDR: boolPtrToStr(c.OkiMeatyNeutralTechThrowDR),
		ColOkiMeatyBackTechThrow:      boolPtrToStr(c.OkiMeatyBackTechThrow),
		ColOkiMeatyBackTechThrowDR:    boolPtrToStr(c.OkiMeatyBackTechThrowDR),
		ColOkiShimmyNeutralTech:       boolPtrToStr(c.OkiShimmyNeutralTech),
		ColOkiShimmyBackTech:          boolPtrToStr(c.OkiShimmyBackTech),
		ColKnockdownAdvantage:         intPtrToStr(c.KnockdownAdvantage),
		ColMemo:                       sanitizeFreeText(c.Memo), // VAL-I10
		ColTags:                       tags,
		ColRecipe:                     recipe,
		ColSAGaugeConsumed:            intPtrToStr(c.SAGaugeConsumed),      // M16-02
		ColDriveGaugeConsumed:         floatPtrToStr(c.DriveGaugeConsumed), // M16-02
		// 起き攻め正規化の新オプション列(M16-03)。
		ColOkiShimmyNeutralTechDR:      boolPtrToStr(c.OkiShimmyNeutralTechDR),
		ColOkiShimmyBackTechDR:         boolPtrToStr(c.OkiShimmyBackTechDR),
		ColOkiStrikeMeatyNeutralTech:   boolPtrToStr(c.OkiStrikeMeatyNeutralTech),
		ColOkiStrikeMeatyNeutralTechDR: boolPtrToStr(c.OkiStrikeMeatyNeutralTechDR),
		ColOkiStrikeMeatyBackTech:      boolPtrToStr(c.OkiStrikeMeatyBackTech),
		ColOkiStrikeMeatyBackTechDR:    boolPtrToStr(c.OkiStrikeMeatyBackTechDR),
		ColOkiVerified:                 boolPtrToStr(c.OkiVerified),
		// ★M28-02a: 載せないと出力 → 取込で消える(始動位置は代表値へ丸め戻され、
		//   運び量は逆算できず完全に失われる)。
		ColStartPositionMass: intPtrToStr(c.StartPositionMass),
		ColCarryDistanceMass: intPtrToStr(c.CarryDistanceMass),
		// ★M37-07: 載せないと出力 → 取込で値が消える。しかも本列は重複判定キーであり、
		//   消えると往復のたびに別コンボへ化ける。
		ColStarterMeaty: boolPtrToStr(c.StarterMeaty),
		// メディア 3 列(M17-01)。自由文字列のため memo と同じ VAL-I10 無害化を適用する
		// (import 側の desanitize と対称なので verbatim 往復は保たれる)。
		ColLink:      sanitizeFreeText(c.Link),
		ColVideoPath: sanitizeFreeText(c.VideoPath),
		ColImagePath: sanitizeFreeText(c.ImagePath),
	}, nil
}

// encodeSetup は1セットプレイを「列名→セル値」へ変換する。
func encodeSetup(s *Setup) (map[string]string, error) {
	recipe, err := marshalJSONOrEmpty(s.Steps, len(s.Steps) == 0)
	if err != nil {
		return nil, fmt.Errorf("encode setup recipe: %w", err)
	}
	return map[string]string{
		ColSetupParentComboLocalID: s.ParentComboLocalID,
		ColSetupName:               sanitizeFreeText(s.Name), // VAL-I10
		ColSetupDescription:        sanitizeFreeText(s.Description),
		ColSetupRecipe:             recipe,
	}, nil
}

// marshalJSONOrEmpty は empty が true のとき空セル("")を返し、そうでなければ
// v を JSON 文字列にして返す。空スライスを空セルに正規化することで、import 側で
// 「空セル → nil」と素直に対応づけられる。
func marshalJSONOrEmpty(v any, empty bool) (string, error) {
	if empty {
		return "", nil
	}
	b, err := json.Marshal(v)
	if err != nil {
		return "", err
	}
	return string(b), nil
}

func rawToStr(r json.RawMessage) string {
	if len(r) == 0 {
		return ""
	}
	return string(r)
}
