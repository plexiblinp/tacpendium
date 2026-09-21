package combo

// ★M37-07 §5-4: starter_meaty が PATCH に載っていないこと(識別キーだからである)。
//
// ★★PATCH が触るのは「識別キーが変わらない編集」だけである
//   (CHANGE-195 §2.4)。本列を PATCH に載せると、重複判定キーを変える編集が
//   旧行を残したまま通ってしまい、同じキーの行が 2 つ並ぶ。
//   ⇒ この列を変える編集は PUT(旧行を論理削除して新 id を採番)へ行く。
//
// ★★本テストは reflect で DTO の形そのものを見る —— 振る舞いのテストでは
//   「たまたま送っていない」と「そもそも受け取らない」を区別できない。
//   ⇒ 受け口が無いことを主張する。

import (
	"encoding/json"
	"reflect"
	"strings"
	"testing"
)

const starterMeatyJSONTag = "starterMeaty"

func hasJSONField(t reflect.Type, name string) bool {
	for i := 0; i < t.NumField(); i++ {
		f := t.Field(i)
		if f.Anonymous {
			if hasJSONField(f.Type, name) {
				return true
			}
			continue
		}
		tag := strings.Split(f.Tag.Get("json"), ",")[0]
		if tag == name {
			return true
		}
	}
	return false
}

// TestStarterMeaty_NotOnPatch は PATCH の入力 DTO に受け口が無いことを押さえる。
func TestStarterMeaty_NotOnPatch(t *testing.T) {
	if hasJSONField(reflect.TypeOf(UpdateMetadataRequest{}), starterMeatyJSONTag) {
		t.Errorf("PATCH(UpdateMetadataRequest)に %s が載っている(識別キーである・M37-07 §2.4-2)",
			starterMeatyJSONTag)
	}
	// ★陽性対照 —— 同じ検査関数が「在る」ものを在ると言えること。
	//   これが無いと、検査が壊れて常に false を返しても緑になる。
	if !hasJSONField(reflect.TypeOf(UpdateMetadataRequest{}), "okiVerified") {
		t.Error("陽性対照が成立していない(okiVerified は PATCH に在るはず)")
	}
}

// TestStarterMeaty_OnPostAndPut は POST / PUT の入力と応答に在ることを押さえる。
//
// ★PutRequest は CreateRequest を埋め込んでおり、片方へ足せば両方に載る。
//
//	⇒ 埋め込みを解いたときに気づけるよう、PutRequest 側も明示的に見る。
func TestStarterMeaty_OnPostAndPut(t *testing.T) {
	for _, tc := range []struct {
		name string
		typ  reflect.Type
	}{
		{"CreateRequest(POST)", reflect.TypeOf(CreateRequest{})},
		{"PutRequest(PUT)", reflect.TypeOf(PutRequest{})},
		{"CheckDuplicateRequest", reflect.TypeOf(CheckDuplicateRequest{})},
		{"ComboResponse", reflect.TypeOf(ComboResponse{})},
		{"DuplicateInfoResponse", reflect.TypeOf(DuplicateInfoResponse{})},
	} {
		if !hasJSONField(tc.typ, starterMeatyJSONTag) {
			t.Errorf("%s に %s が無い", tc.name, starterMeatyJSONTag)
		}
	}
}

// TestStarterMeaty_ResponseKeepsFalse は応答で false がキーごと消えないことを押さえる。
//
// ★★omitempty を付けると false のときキーが消え、画面は「通常始動である」と
//
//	「サーバがこの欄を持っていない」を区別できなくなる(OkiVerified と同じ理由)。
func TestStarterMeaty_ResponseKeepsFalse(t *testing.T) {
	b, err := json.Marshal(ComboResponse{})
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}
	var m map[string]any
	if err := json.Unmarshal(b, &m); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	v, ok := m[starterMeatyJSONTag]
	if !ok {
		t.Fatalf("false のとき %s のキーが消えている(omitempty が付いている)", starterMeatyJSONTag)
	}
	if v != false {
		t.Errorf("%s = %v, want false", starterMeatyJSONTag, v)
	}
}
