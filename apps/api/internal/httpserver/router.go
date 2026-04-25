package httpserver

import (
	"encoding/json"
	"log/slog"
	"net/http"
	"time"
)

type project struct {
	Slug        string   `json:"slug"`
	Title       string   `json:"title"`
	Description string   `json:"description"`
	Stack       []string `json:"stack"`
	RepoURL     string   `json:"repoUrl"`
}

func New(logger *slog.Logger) http.Handler {
	mux := http.NewServeMux()

	mux.HandleFunc("GET /api/healthz", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, map[string]any{
			"status": "ok",
			"time":   time.Now().UTC().Format(time.RFC3339),
		})
	})

	mux.HandleFunc("GET /api/profile", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, map[string]any{
			"name":  "Blazej Pajor",
			"role":  "Software Engineer",
			"email": "blazej122@vp.pl",
			"focus": []string{"Backend engineering", "GCP", "Kubernetes", "AI systems"},
			"links": map[string]string{
				"github":   "https://github.com/bpajor/",
				"linkedin": "https://www.linkedin.com/in/b%C5%82a%C5%BCej-pajor-837974238/",
			},
		})
	})

	mux.HandleFunc("GET /api/projects", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, []project{
			{
				Slug:        "pay-management-system",
				Title:       "Pay Management System",
				Description: "A business application for monitoring and managing employee payouts.",
				Stack:       []string{"Backend", "Business systems", "Data workflows"},
				RepoURL:     "https://github.com/bpajor/pay-man-sys",
			},
			{
				Slug:        "pol-elections-2023-rest-api",
				Title:       "PolElections2023 REST API",
				Description: "REST API exposing Polish parliamentary election results from 2023.",
				Stack:       []string{"Nest.js", "TypeScript", "Mongoose", "JWT"},
				RepoURL:     "https://github.com/bpajor/PolElections2023-rest-api",
			},
		})
	})

	return withLogging(logger, mux)
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
