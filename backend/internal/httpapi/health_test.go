package httpapi

import (
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"testing"
)

func newTestServer() *Server {
	return &Server{AllowedOrigins: []string{"https://www.wfchunters.com"}, Log: slog.New(slog.NewTextHandler(io.Discard, nil))}
}

func TestHealthWithoutDatabase(t *testing.T) {
	rec := httptest.NewRecorder()
	newTestServer().Routes().ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/health", nil))

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, mau 200", rec.Code)
	}
	var res healthResponse
	if err := json.NewDecoder(rec.Body).Decode(&res); err != nil {
		t.Fatal(err)
	}
	if res.Status != "ok" || res.Database != "not_configured" {
		t.Fatalf("respons = %+v", res)
	}
}

func TestCORSOnlyAllowedOrigins(t *testing.T) {
	h := newTestServer().Routes()
	cases := map[string]string{
		"https://www.wfchunters.com": "https://www.wfchunters.com",
		"https://situs-lain.com":     "",
	}
	for origin, want := range cases {
		req := httptest.NewRequest(http.MethodGet, "/health", nil)
		req.Header.Set("Origin", origin)
		rec := httptest.NewRecorder()
		h.ServeHTTP(rec, req)
		if got := rec.Header().Get("Access-Control-Allow-Origin"); got != want {
			t.Errorf("origin %s: header = %q, mau %q", origin, got, want)
		}
	}
}
