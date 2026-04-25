package server

import (
	"encoding/json"
	"log/slog"
	"net/http"
	"os"
	"strings"
	"time"
)

const DefaultReadHeaderTimeout = 5 * time.Second

func New(logger *slog.Logger) http.Handler {
	mux := http.NewServeMux()
	token := os.Getenv("MCP_BEARER_TOKEN")

	mux.HandleFunc("GET /healthz", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
	})

	mux.HandleFunc("/mcp", func(w http.ResponseWriter, r *http.Request) {
		if token != "" && !hasBearerToken(r, token) {
			writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
			return
		}

		writeJSON(w, http.StatusNotImplemented, map[string]string{
			"error": "mcp_transport_not_enabled",
			"note":  "official MCP Go SDK integration is planned in TASK-007",
		})
	})

	return withLogging(logger, mux)
}

func hasBearerToken(r *http.Request, token string) bool {
	auth := r.Header.Get("Authorization")
	return strings.TrimPrefix(auth, "Bearer ") == token
}

func withLogging(logger *slog.Logger, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		next.ServeHTTP(w, r)
		logger.Info("request",
			"method", r.Method,
			"path", r.URL.Path,
			"duration_ms", time.Since(start).Milliseconds(),
		)
	})
}

func writeJSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.Header().Set("X-Content-Type-Options", "nosniff")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}
