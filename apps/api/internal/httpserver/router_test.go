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

func TestAdminCSRFGuard(t *testing.T) {
	tests := []struct {
		name    string
		method  string
		origin  string
		referer string
		host    string
		proto   string
		allowed []string
		want    int
		code    string
	}{
		{name: "safe method without origin", method: http.MethodGet, want: http.StatusNoContent},
		{name: "missing origin", method: http.MethodPost, want: http.StatusForbidden, code: "csrf_required"},
		{name: "allowed origin", method: http.MethodPost, origin: "http://localhost:3000", want: http.StatusNoContent},
		{name: "allowed referer", method: http.MethodPut, referer: "http://localhost:3000/admin/posts", want: http.StatusNoContent},
		{name: "allowed wildcard origin from cloud shell preview", method: http.MethodPost, origin: "https://3000-cs-482b7998-f3ee-4774-b73a-b12df385705f.cs-europe-west4-bhnf.cloudshell.dev", allowed: []string{"https://*.cloudshell.dev"}, want: http.StatusNoContent},
		{name: "forwarded same host through http upstream", method: http.MethodPost, origin: "https://3000-test.cloudshell.dev", host: "3000-test.cloudshell.dev", proto: "http", want: http.StatusNoContent},
		{name: "disallowed origin", method: http.MethodDelete, origin: "https://evil.example", want: http.StatusForbidden, code: "csrf_invalid"},
		{name: "wildcard origin does not allow another suffix", method: http.MethodPost, origin: "https://3000-test.cloudshell.dev.evil.example", allowed: []string{"https://*.cloudshell.dev"}, want: http.StatusForbidden, code: "csrf_invalid"},
		{name: "forwarded different origin still blocked", method: http.MethodPost, origin: "https://evil.example", host: "3000-test.cloudshell.dev", proto: "https", want: http.StatusForbidden, code: "csrf_invalid"},
		{name: "null origin", method: http.MethodPost, origin: "null", want: http.StatusForbidden, code: "csrf_required"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			server := Server{cfg: testConfig()}
			if tt.allowed != nil {
				server.cfg.AllowedOrigins = tt.allowed
			}
			handler := server.requireAdminCSRF(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
				w.WriteHeader(http.StatusNoContent)
			}))

			res := httptest.NewRecorder()
			req := httptest.NewRequest(tt.method, "/api/admin/posts", nil)
			if tt.origin != "" {
				req.Header.Set("Origin", tt.origin)
			}
			if tt.referer != "" {
				req.Header.Set("Referer", tt.referer)
			}
			if tt.host != "" {
				req.Host = tt.host
				req.Header.Set("X-Forwarded-Host", tt.host)
			}
			if tt.proto != "" {
				req.Header.Set("X-Forwarded-Proto", tt.proto)
			}

			handler.ServeHTTP(res, req)

			if res.Code != tt.want {
				t.Fatalf("status = %d, want %d, body = %s", res.Code, tt.want, res.Body.String())
			}
			if tt.code != "" {
				assertErrorCode(t, res.Body.Bytes(), tt.code)
			}
		})
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
