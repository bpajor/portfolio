package httpserver

import (
	"context"
	"encoding/json"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"
	"time"

	"github.com/bpajor/portfolio/apps/api/internal/config"
	"github.com/bpajor/portfolio/apps/api/internal/content"
	"github.com/jackc/pgx/v5/pgxpool"
)

func TestAPIIntegrationWithPostgres(t *testing.T) {
	databaseURL := os.Getenv("API_INTEGRATION_DATABASE_URL")
	if databaseURL == "" {
		t.Skip("API_INTEGRATION_DATABASE_URL is not set")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	db, err := pgxpool.New(ctx, databaseURL)
	if err != nil {
		t.Fatalf("pgxpool.New failed: %v", err)
	}
	defer db.Close()

	cfg := config.Load()
	cfg.AllowedOrigins = []string{"http://localhost:3000"}
	handler := New(cfg, slog.Default(), db, content.NewStaticRepository())

	res := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/api/healthz", nil)
	handler.ServeHTTP(res, req)
	if res.Code != http.StatusOK {
		t.Fatalf("health status = %d, body = %s", res.Code, res.Body.String())
	}

	var health struct {
		Status   string `json:"status"`
		Database string `json:"database"`
	}
	if err := json.Unmarshal(res.Body.Bytes(), &health); err != nil {
		t.Fatalf("invalid health JSON: %v", err)
	}
	if health.Status != "ok" || health.Database != "ok" {
		t.Fatalf("health = %#v, want ok database", health)
	}

	posts := httptest.NewRecorder()
	handler.ServeHTTP(posts, httptest.NewRequest(http.MethodGet, "/api/posts", nil))
	if posts.Code != http.StatusOK {
		t.Fatalf("posts status = %d, body = %s", posts.Code, posts.Body.String())
	}
}
