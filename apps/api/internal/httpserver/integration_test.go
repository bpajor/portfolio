package httpserver

import (
	"context"
	"encoding/json"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/bpajor/portfolio/apps/api/internal/auth"
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

	passwordHash, err := auth.HashPassword("admin-password")
	if err != nil {
		t.Fatalf("HashPassword failed: %v", err)
	}
	_, err = db.Exec(ctx, `
		INSERT INTO users (email, password_hash)
		VALUES ('admin-integration@example.com', $1)
		ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash
	`, passwordHash)
	if err != nil {
		t.Fatalf("insert admin user failed: %v", err)
	}

	login := httptest.NewRecorder()
	loginReq := httptest.NewRequest(http.MethodPost, "/api/admin/auth/login", strings.NewReader(`{"email":"admin-integration@example.com","password":"admin-password"}`))
	handler.ServeHTTP(login, loginReq)
	if login.Code != http.StatusOK {
		t.Fatalf("login status = %d, body = %s", login.Code, login.Body.String())
	}
	cookies := login.Result().Cookies()
	if len(cookies) == 0 {
		t.Fatal("login did not set a session cookie")
	}

	slug := "integration-published-post"
	if _, err := db.Exec(ctx, "DELETE FROM posts WHERE slug = $1", slug); err != nil {
		t.Fatalf("delete existing integration post failed: %v", err)
	}
	create := httptest.NewRecorder()
	createReq := httptest.NewRequest(http.MethodPost, "/api/admin/posts", strings.NewReader(`{
		"slug":"integration-published-post",
		"title":"Integration Published Post",
		"excerpt":"Created through the admin API.",
		"contentMarkdown":"## Intro\n\nThis post came from an integration test.",
		"status":"published",
		"seoTitle":"Integration Published Post",
		"seoDescription":"Created through the admin API.",
		"tags":["E2E","Admin"]
	}`))
	createReq.Header.Set("Content-Type", "application/json")
	createReq.Header.Set("Origin", "http://localhost:3000")
	for _, cookie := range cookies {
		createReq.AddCookie(cookie)
	}
	handler.ServeHTTP(create, createReq)
	if create.Code != http.StatusCreated {
		t.Fatalf("create post status = %d, body = %s", create.Code, create.Body.String())
	}
	var createdPost struct {
		ID   string   `json:"id"`
		Tags []string `json:"tags"`
	}
	if err := json.Unmarshal(create.Body.Bytes(), &createdPost); err != nil {
		t.Fatalf("invalid created post JSON: %v", err)
	}
	if len(createdPost.Tags) != 2 {
		t.Fatalf("created post tags = %#v, want 2 tags", createdPost.Tags)
	}

	adminGet := httptest.NewRecorder()
	adminGetReq := httptest.NewRequest(http.MethodGet, "/api/admin/posts/"+createdPost.ID, nil)
	for _, cookie := range cookies {
		adminGetReq.AddCookie(cookie)
	}
	handler.ServeHTTP(adminGet, adminGetReq)
	if adminGet.Code != http.StatusOK {
		t.Fatalf("admin get post status = %d, body = %s", adminGet.Code, adminGet.Body.String())
	}
	var adminPost struct {
		Tags []string `json:"tags"`
	}
	if err := json.Unmarshal(adminGet.Body.Bytes(), &adminPost); err != nil {
		t.Fatalf("invalid admin post JSON: %v", err)
	}
	if len(adminPost.Tags) != 2 {
		t.Fatalf("admin post tags = %#v, want persisted tags", adminPost.Tags)
	}

	publicPost := httptest.NewRecorder()
	handler.ServeHTTP(publicPost, httptest.NewRequest(http.MethodGet, "/api/posts/"+slug, nil))
	if publicPost.Code != http.StatusOK {
		t.Fatalf("published post status = %d, body = %s", publicPost.Code, publicPost.Body.String())
	}
	var post struct {
		Slug            string   `json:"slug"`
		Title           string   `json:"title"`
		ContentMarkdown string   `json:"contentMarkdown"`
		Status          string   `json:"status"`
		Tags            []string `json:"tags"`
	}
	if err := json.Unmarshal(publicPost.Body.Bytes(), &post); err != nil {
		t.Fatalf("invalid public post JSON: %v", err)
	}
	if post.Slug != slug || post.Status != "published" || !strings.Contains(post.ContentMarkdown, "integration test") {
		t.Fatalf("unexpected public post = %#v", post)
	}

	comment := httptest.NewRecorder()
	commentReq := httptest.NewRequest(http.MethodPost, "/api/posts/"+slug+"/comments", strings.NewReader(`{
		"displayName":"Integration Reader",
		"body":"This comment should move through moderation.",
		"turnstileToken":"test-token"
	}`))
	commentReq.Header.Set("Content-Type", "application/json")
	handler.ServeHTTP(comment, commentReq)
	if comment.Code != http.StatusAccepted {
		t.Fatalf("create comment status = %d, body = %s", comment.Code, comment.Body.String())
	}

	adminComments := httptest.NewRecorder()
	adminCommentsReq := httptest.NewRequest(http.MethodGet, "/api/admin/comments?status=pending", nil)
	for _, cookie := range cookies {
		adminCommentsReq.AddCookie(cookie)
	}
	handler.ServeHTTP(adminComments, adminCommentsReq)
	if adminComments.Code != http.StatusOK {
		t.Fatalf("admin comments status = %d, body = %s", adminComments.Code, adminComments.Body.String())
	}
	var pendingComments []struct {
		ID          string `json:"id"`
		DisplayName string `json:"displayName"`
		Body        string `json:"body"`
		Status      string `json:"status"`
	}
	if err := json.Unmarshal(adminComments.Body.Bytes(), &pendingComments); err != nil {
		t.Fatalf("invalid admin comments JSON: %v", err)
	}
	if len(pendingComments) != 1 || pendingComments[0].Status != "pending" {
		t.Fatalf("pending comments = %#v, want one pending comment", pendingComments)
	}

	moderate := httptest.NewRecorder()
	moderateReq := httptest.NewRequest(http.MethodPut, "/api/admin/comments/"+pendingComments[0].ID+"/moderate", strings.NewReader(`{"status":"approved"}`))
	moderateReq.Header.Set("Content-Type", "application/json")
	moderateReq.Header.Set("Origin", "http://localhost:3000")
	for _, cookie := range cookies {
		moderateReq.AddCookie(cookie)
	}
	handler.ServeHTTP(moderate, moderateReq)
	if moderate.Code != http.StatusOK {
		t.Fatalf("moderate comment status = %d, body = %s", moderate.Code, moderate.Body.String())
	}

	pendingAfterModeration := httptest.NewRecorder()
	pendingAfterModerationReq := httptest.NewRequest(http.MethodGet, "/api/admin/comments?status=pending", nil)
	for _, cookie := range cookies {
		pendingAfterModerationReq.AddCookie(cookie)
	}
	handler.ServeHTTP(pendingAfterModeration, pendingAfterModerationReq)
	if pendingAfterModeration.Code != http.StatusOK {
		t.Fatalf("pending comments after moderation status = %d, body = %s", pendingAfterModeration.Code, pendingAfterModeration.Body.String())
	}
	var remainingPending []struct {
		ID string `json:"id"`
	}
	if err := json.Unmarshal(pendingAfterModeration.Body.Bytes(), &remainingPending); err != nil {
		t.Fatalf("invalid pending comments after moderation JSON: %v", err)
	}
	if len(remainingPending) != 0 {
		t.Fatalf("remaining pending comments = %#v, want none", remainingPending)
	}

	publicComments := httptest.NewRecorder()
	handler.ServeHTTP(publicComments, httptest.NewRequest(http.MethodGet, "/api/posts/"+slug+"/comments", nil))
	if publicComments.Code != http.StatusOK {
		t.Fatalf("public comments status = %d, body = %s", publicComments.Code, publicComments.Body.String())
	}
	var approvedComments []struct {
		DisplayName string `json:"displayName"`
		Body        string `json:"body"`
		Status      string `json:"status"`
	}
	if err := json.Unmarshal(publicComments.Body.Bytes(), &approvedComments); err != nil {
		t.Fatalf("invalid public comments JSON: %v", err)
	}
	if len(approvedComments) != 1 || approvedComments[0].DisplayName != "Integration Reader" {
		t.Fatalf("approved comments = %#v, want approved integration comment", approvedComments)
	}
}
