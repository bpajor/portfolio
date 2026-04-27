package httpserver

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/bpajor/portfolio/apps/api/internal/config"
	"github.com/bpajor/portfolio/apps/api/internal/content"
)

func TestPublicRoutesWithoutDatabase(t *testing.T) {
	handler := New(testConfig(), testLogger(), nil, fakeRepository{})

	tests := []struct {
		name string
		path string
		want int
	}{
		{name: "health", path: "/api/healthz", want: http.StatusOK},
		{name: "profile", path: "/api/profile", want: http.StatusOK},
		{name: "projects", path: "/api/projects", want: http.StatusOK},
		{name: "known project", path: "/api/projects/pay-management-system", want: http.StatusOK},
		{name: "missing project", path: "/api/projects/missing", want: http.StatusNotFound},
		{name: "published posts empty without db", path: "/api/posts", want: http.StatusOK},
		{name: "published post missing without db", path: "/api/posts/missing", want: http.StatusNotFound},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			res := httptest.NewRecorder()
			req := httptest.NewRequest(http.MethodGet, tt.path, nil)

			handler.ServeHTTP(res, req)

			if res.Code != tt.want {
				t.Fatalf("status = %d, want %d, body = %s", res.Code, tt.want, res.Body.String())
			}
			if got := res.Header().Get("X-Content-Type-Options"); got != "nosniff" {
				t.Fatalf("X-Content-Type-Options = %q, want nosniff", got)
			}
		})
	}
}

func TestAdminRoutesRequireDatabaseOrSession(t *testing.T) {
	handler := New(testConfig(), testLogger(), nil, fakeRepository{})

	tests := []struct {
		method string
		path   string
		body   string
		want   int
		code   string
	}{
		{method: http.MethodPost, path: "/api/admin/auth/login", body: `{"email":"admin@example.com","password":"secret"}`, want: http.StatusServiceUnavailable, code: "database_required"},
		{method: http.MethodGet, path: "/api/admin/me", want: http.StatusServiceUnavailable, code: "database_required"},
		{method: http.MethodGet, path: "/api/admin/posts", want: http.StatusServiceUnavailable, code: "database_required"},
	}

	for _, tt := range tests {
		t.Run(tt.path, func(t *testing.T) {
			res := httptest.NewRecorder()
			req := httptest.NewRequest(tt.method, tt.path, strings.NewReader(tt.body))

			handler.ServeHTTP(res, req)

			if res.Code != tt.want {
				t.Fatalf("status = %d, want %d, body = %s", res.Code, tt.want, res.Body.String())
			}
			assertErrorCode(t, res.Body.Bytes(), tt.code)
		})
	}
}

func TestDecodeJSONRejectsUnknownFields(t *testing.T) {
	var req loginRequest
	httpReq := httptest.NewRequest(http.MethodPost, "/api/admin/auth/login", strings.NewReader(`{"email":"admin@example.com","password":"secret","extra":true}`))

	if err := decodeJSON(httpReq, &req); err == nil {
		t.Fatal("decodeJSON accepted an unknown field")
	}
}

func TestHelpers(t *testing.T) {
	if got := slugify("  MCP as a Portfolio Interface!  "); got != "mcp-as-a-portfolio-interface" {
		t.Fatalf("slugify = %q", got)
	}
	if got := sanitizedHTML("Hello <script>alert(1)</script>"); strings.Contains(got, "<script>") {
		t.Fatalf("sanitizedHTML did not escape script tag: %q", got)
	}
	if got := clientIPFromRemoteAddr("[2001:db8::1]:443"); got != "2001:db8::1" {
		t.Fatalf("clientIPFromRemoteAddr IPv6 = %q", got)
	}
}

func assertErrorCode(t *testing.T, body []byte, want string) {
	t.Helper()
	var payload struct {
		Error struct {
			Code string `json:"code"`
		} `json:"error"`
	}
	if err := json.Unmarshal(body, &payload); err != nil {
		t.Fatalf("invalid error response: %v; body=%s", err, string(body))
	}
	if payload.Error.Code != want {
		t.Fatalf("error code = %q, want %q; body=%s", payload.Error.Code, want, string(body))
	}
}

func testConfig() config.Config {
	cfg := config.Load()
	cfg.AllowedOrigins = []string{"http://localhost:3000"}
	cfg.BodyLimitBytes = 128
	cfg.PrivacyHashSecret = "test-secret"
	cfg.CookieSecure = false
	return cfg
}

func testLogger() *slog.Logger {
	return slog.New(slog.NewTextHandler(io.Discard, nil))
}

type fakeRepository struct{}

func (fakeRepository) GetProfile(context.Context) (content.Profile, error) {
	return content.NewStaticRepository().GetProfile(context.Background())
}

func (fakeRepository) ListFeaturedProjects(context.Context) ([]content.Project, error) {
	return content.NewStaticRepository().ListFeaturedProjects(context.Background())
}

func (fakeRepository) GetProjectBySlug(ctx context.Context, slug string) (content.Project, bool, error) {
	if slug == "error" {
		return content.Project{}, false, errors.New("boom")
	}
	return content.NewStaticRepository().GetProjectBySlug(ctx, slug)
}
