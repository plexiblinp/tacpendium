package middleware_test

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/labstack/echo/v4"

	mw "github.com/plexiblinp/tacpendium/internal/api/middleware"
)

// M22-02: X-User-Id の解決。★これは認証ではない(DES-002 §8)——
// 入場の可否は簡易パスワードが決め、本ヘッダは「誰として操作するか」の札である。

type stubResolver struct {
	id  int64
	err error
}

func (s stubResolver) DefaultUserID(context.Context) (int64, error) { return s.id, s.err }

// resolve はミドルウェアを通したときに載る利用者 ID を返す。
func resolve(t *testing.T, header string, resolver mw.DefaultUserIDResolver) int64 {
	t.Helper()
	e := echo.New()
	req := httptest.NewRequest(http.MethodGet, "/api/tags", nil)
	if header != "" {
		req.Header.Set(mw.UserIDHeader, header)
	}
	c := e.NewContext(req, httptest.NewRecorder())

	var got int64
	handler := mw.UserContext(resolver)(func(c echo.Context) error {
		got = mw.UserIDFrom(c)
		return nil
	})
	if err := handler(c); err != nil {
		t.Fatalf("handler: %v", err)
	}
	return got
}

func TestUserContext_UsesHeaderWhenPresent(t *testing.T) {
	if got := resolve(t, "7", stubResolver{id: 1}); got != 7 {
		t.Errorf("userID = %d, want 7(ヘッダの値)", got)
	}
}

// ★ヘッダを送らない呼び出し元が実在する(既存の E2E・curl・利用者が 1 人のとき)。
// 既定へ倒すことで、いままでの挙動と 1 バイトも変わらない。
func TestUserContext_FallsBackToDefaultWhenAbsent(t *testing.T) {
	if got := resolve(t, "", stubResolver{id: 1}); got != 1 {
		t.Errorf("userID = %d, want 1(既定)", got)
	}
}

func TestUserContext_FallsBackOnInvalidHeader(t *testing.T) {
	for _, raw := range []string{"abc", "0", "-3", " "} {
		if got := resolve(t, raw, stubResolver{id: 1}); got != 1 {
			t.Errorf("header=%q: userID = %d, want 1(既定へ倒す)", raw, got)
		}
	}
}

// ★解決に失敗しても要求は止めない。ここで 500 にすると、利用者の面と
// 無関係な全 API が巻き添えで落ちる。
func TestUserContext_DoesNotFailRequestWhenResolverErrors(t *testing.T) {
	if got := resolve(t, "", stubResolver{err: errors.New("boom")}); got != 0 {
		t.Errorf("userID = %d, want 0(解決できなかった)", got)
	}
}

// ミドルウェアを通していない文脈では 0 を返す(既定値を偽装しない)。
func TestUserIDFrom_ReturnsZeroWithoutMiddleware(t *testing.T) {
	e := echo.New()
	c := e.NewContext(httptest.NewRequest(http.MethodGet, "/api/tags", nil), httptest.NewRecorder())
	if got := mw.UserIDFrom(c); got != 0 {
		t.Errorf("userID = %d, want 0", got)
	}
}
