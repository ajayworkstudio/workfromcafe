package httpapi

import (
	"context"
	"encoding/json"
	"net/http"
	"time"
)

type healthResponse struct {
	Status   string `json:"status"`
	Database string `json:"database"` // ok | down | not_configured
}

// health dipakai untuk cek dari luar (uptime monitor, deploy). Detail error tidak dikirim ke klien.
func (s *Server) health(w http.ResponseWriter, r *http.Request) {
	res := healthResponse{Status: "ok", Database: "not_configured"}
	code := http.StatusOK
	if s.DB != nil {
		ctx, cancel := context.WithTimeout(r.Context(), 2*time.Second)
		defer cancel()
		if err := s.DB.PingContext(ctx); err != nil {
			s.Log.Error("health: database ping gagal", "err", err)
			res.Status, res.Database, code = "degraded", "down", http.StatusServiceUnavailable
		} else {
			res.Database = "ok"
		}
	}
	writeJSON(w, code, res)
}

func writeJSON(w http.ResponseWriter, code int, v any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.Header().Set("Cache-Control", "no-store")
	w.WriteHeader(code)
	_ = json.NewEncoder(w).Encode(v)
}
