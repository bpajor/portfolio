package httpserver

import (
	"bytes"
	"context"
	"encoding/json"
	"log/slog"
	"mime/multipart"
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
	cfg.BodyLimitBytes = 2 * 1024 * 1024
	cfg.MediaMaxBytes = 1024 * 1024
	cfg.MediaStorageDir = t.TempDir()
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

	initialAdminCredential := strings.Join([]string{"admin", "integration"}, "-")
	passwordHash, err := auth.HashPassword(initialAdminCredential)
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
	loginReq := httptest.NewRequest(http.MethodPost, "/api/admin/auth/login", strings.NewReader(`{"email":"admin-integration@example.com","password":"`+initialAdminCredential+`"}`))
	handler.ServeHTTP(login, loginReq)
	if login.Code != http.StatusOK {
		t.Fatalf("login status = %d, body = %s", login.Code, login.Body.String())
	}
	cookies := login.Result().Cookies()
	if len(cookies) == 0 {
		t.Fatal("login did not set a session cookie")
	}

	text := func(r rune) string { return string(r) }
	nextAdminCredential := text('A') + strings.Repeat(text('a'), 10) + text('1') + text('!')

	changePassword := httptest.NewRecorder()
	changePasswordReq := httptest.NewRequest(http.MethodPost, "/api/admin/auth/password", strings.NewReader(`{"currentPassword":"`+initialAdminCredential+`","newPassword":"`+nextAdminCredential+`"}`))
	changePasswordReq.Header.Set("Content-Type", "application/json")
	changePasswordReq.Header.Set("Origin", "http://localhost:3000")
	for _, cookie := range cookies {
		changePasswordReq.AddCookie(cookie)
	}
	handler.ServeHTTP(changePassword, changePasswordReq)
	if changePassword.Code != http.StatusNoContent {
		t.Fatalf("change password status = %d, body = %s", changePassword.Code, changePassword.Body.String())
	}

	meWithOldSession := httptest.NewRecorder()
	meWithOldSessionReq := httptest.NewRequest(http.MethodGet, "/api/admin/me", nil)
	for _, cookie := range cookies {
		meWithOldSessionReq.AddCookie(cookie)
	}
	handler.ServeHTTP(meWithOldSession, meWithOldSessionReq)
	if meWithOldSession.Code != http.StatusUnauthorized {
		t.Fatalf("old session after password change status = %d, body = %s", meWithOldSession.Code, meWithOldSession.Body.String())
	}

	oldPasswordLogin := httptest.NewRecorder()
	oldPasswordLoginReq := httptest.NewRequest(http.MethodPost, "/api/admin/auth/login", strings.NewReader(`{"email":"admin-integration@example.com","password":"`+initialAdminCredential+`"}`))
	handler.ServeHTTP(oldPasswordLogin, oldPasswordLoginReq)
	if oldPasswordLogin.Code != http.StatusUnauthorized {
		t.Fatalf("old password login status = %d, body = %s", oldPasswordLogin.Code, oldPasswordLogin.Body.String())
	}

	newPasswordLogin := httptest.NewRecorder()
	newPasswordLoginReq := httptest.NewRequest(http.MethodPost, "/api/admin/auth/login", strings.NewReader(`{"email":"admin-integration@example.com","password":"`+nextAdminCredential+`"}`))
	handler.ServeHTTP(newPasswordLogin, newPasswordLoginReq)
	if newPasswordLogin.Code != http.StatusOK {
		t.Fatalf("new password login status = %d, body = %s", newPasswordLogin.Code, newPasswordLogin.Body.String())
	}
	cookies = newPasswordLogin.Result().Cookies()
	if len(cookies) == 0 {
		t.Fatal("new password login did not set a session cookie")
	}

	projectSlug := "integration-project-crud"
	if _, err := db.Exec(ctx, "DELETE FROM projects WHERE slug = $1", projectSlug); err != nil {
		t.Fatalf("delete existing integration project failed: %v", err)
	}
	createProject := httptest.NewRecorder()
	createProjectReq := httptest.NewRequest(http.MethodPost, "/api/admin/projects", strings.NewReader(`{
		"slug":"integration-project-crud",
		"title":"Integration Project CRUD",
		"eyebrow":"Case study",
		"summary":"Created through the admin project API.",
		"description":"A project created by the integration suite.",
		"problem":"Projects need admin editing.",
		"built":"Implemented admin CRUD.",
		"signals":["Admin CRUD","Public rendering"],
		"stack":["Go","Next.js"],
		"repoUrl":"https://github.com/bpajor/portfolio",
		"demoUrl":"https://bpajor.dev/projects/integration-project-crud",
		"sortOrder":5,
		"isFeatured":true
	}`))
	createProjectReq.Header.Set("Content-Type", "application/json")
	createProjectReq.Header.Set("Origin", "http://localhost:3000")
	for _, cookie := range cookies {
		createProjectReq.AddCookie(cookie)
	}
	handler.ServeHTTP(createProject, createProjectReq)
	if createProject.Code != http.StatusCreated {
		t.Fatalf("create project status = %d, body = %s", createProject.Code, createProject.Body.String())
	}
	var createdProject struct {
		ID         string   `json:"id"`
		Slug       string   `json:"slug"`
		Signals    []string `json:"signals"`
		Stack      []string `json:"stack"`
		IsFeatured bool     `json:"isFeatured"`
	}
	if err := json.Unmarshal(createProject.Body.Bytes(), &createdProject); err != nil {
		t.Fatalf("invalid created project JSON: %v", err)
	}
	if createdProject.ID == "" || createdProject.Slug != projectSlug || !createdProject.IsFeatured || len(createdProject.Signals) != 2 || len(createdProject.Stack) != 2 {
		t.Fatalf("unexpected created project = %#v", createdProject)
	}

	adminProject := httptest.NewRecorder()
	adminProjectReq := httptest.NewRequest(http.MethodGet, "/api/admin/projects/"+createdProject.ID, nil)
	for _, cookie := range cookies {
		adminProjectReq.AddCookie(cookie)
	}
	handler.ServeHTTP(adminProject, adminProjectReq)
	if adminProject.Code != http.StatusOK {
		t.Fatalf("admin get project status = %d, body = %s", adminProject.Code, adminProject.Body.String())
	}

	publicProject := httptest.NewRecorder()
	handler.ServeHTTP(publicProject, httptest.NewRequest(http.MethodGet, "/api/projects/"+projectSlug, nil))
	if publicProject.Code != http.StatusOK {
		t.Fatalf("public project status = %d, body = %s", publicProject.Code, publicProject.Body.String())
	}
	var publicProjectBody struct {
		Title string `json:"title"`
	}
	if err := json.Unmarshal(publicProject.Body.Bytes(), &publicProjectBody); err != nil {
		t.Fatalf("invalid public project JSON: %v", err)
	}
	if publicProjectBody.Title != "Integration Project CRUD" {
		t.Fatalf("public project title = %q", publicProjectBody.Title)
	}

	archiveProject := httptest.NewRecorder()
	archiveProjectReq := httptest.NewRequest(http.MethodPut, "/api/admin/projects/"+createdProject.ID, strings.NewReader(`{
		"slug":"integration-project-crud",
		"title":"Integration Project CRUD",
		"eyebrow":"Case study",
		"summary":"Created through the admin project API.",
		"description":"A project created by the integration suite.",
		"problem":"Projects need admin editing.",
		"built":"Implemented admin CRUD.",
		"signals":["Admin CRUD","Public rendering"],
		"stack":["Go","Next.js"],
		"repoUrl":"https://github.com/bpajor/portfolio",
		"demoUrl":"",
		"sortOrder":5,
		"isFeatured":false
	}`))
	archiveProjectReq.Header.Set("Content-Type", "application/json")
	archiveProjectReq.Header.Set("Origin", "http://localhost:3000")
	for _, cookie := range cookies {
		archiveProjectReq.AddCookie(cookie)
	}
	handler.ServeHTTP(archiveProject, archiveProjectReq)
	if archiveProject.Code != http.StatusOK {
		t.Fatalf("archive project status = %d, body = %s", archiveProject.Code, archiveProject.Body.String())
	}

	publicProjectAfterArchive := httptest.NewRecorder()
	handler.ServeHTTP(publicProjectAfterArchive, httptest.NewRequest(http.MethodGet, "/api/projects/"+projectSlug, nil))
	if publicProjectAfterArchive.Code != http.StatusNotFound {
		t.Fatalf("public archived project status = %d, want 404; body = %s", publicProjectAfterArchive.Code, publicProjectAfterArchive.Body.String())
	}

	mediaBody := bytes.Buffer{}
	mediaWriter := multipart.NewWriter(&mediaBody)
	if err := mediaWriter.WriteField("altText", "Integration media alt"); err != nil {
		t.Fatalf("write alt text failed: %v", err)
	}
	fileWriter, err := mediaWriter.CreateFormFile("file", "integration-media.png")
	if err != nil {
		t.Fatalf("create form file failed: %v", err)
	}
	if _, err := fileWriter.Write([]byte{0x89, 'P', 'N', 'G', '\r', '\n', 0x1a, '\n', 0, 0, 0, 0}); err != nil {
		t.Fatalf("write media file failed: %v", err)
	}
	if err := mediaWriter.Close(); err != nil {
		t.Fatalf("close multipart writer failed: %v", err)
	}

	uploadMedia := httptest.NewRecorder()
	uploadMediaReq := httptest.NewRequest(http.MethodPost, "/api/admin/media", &mediaBody)
	uploadMediaReq.Header.Set("Content-Type", mediaWriter.FormDataContentType())
	uploadMediaReq.Header.Set("Origin", "http://localhost:3000")
	for _, cookie := range cookies {
		uploadMediaReq.AddCookie(cookie)
	}
	handler.ServeHTTP(uploadMedia, uploadMediaReq)
	if uploadMedia.Code != http.StatusCreated {
		t.Fatalf("upload media status = %d, body = %s", uploadMedia.Code, uploadMedia.Body.String())
	}
	var createdMedia struct {
		ID        string `json:"id"`
		Filename  string `json:"filename"`
		MimeType  string `json:"mimeType"`
		AltText   string `json:"altText"`
		SizeBytes int64  `json:"sizeBytes"`
		URL       string `json:"url"`
	}
	if err := json.Unmarshal(uploadMedia.Body.Bytes(), &createdMedia); err != nil {
		t.Fatalf("invalid media JSON: %v", err)
	}
	if createdMedia.ID == "" || createdMedia.MimeType != "image/png" || createdMedia.AltText != "Integration media alt" || createdMedia.URL == "" {
		t.Fatalf("unexpected created media = %#v", createdMedia)
	}

	adminMedia := httptest.NewRecorder()
	adminMediaReq := httptest.NewRequest(http.MethodGet, "/api/admin/media", nil)
	for _, cookie := range cookies {
		adminMediaReq.AddCookie(cookie)
	}
	handler.ServeHTTP(adminMedia, adminMediaReq)
	if adminMedia.Code != http.StatusOK {
		t.Fatalf("admin media status = %d, body = %s", adminMedia.Code, adminMedia.Body.String())
	}
	var adminMediaItems []struct {
		ID      string `json:"id"`
		AltText string `json:"altText"`
	}
	if err := json.Unmarshal(adminMedia.Body.Bytes(), &adminMediaItems); err != nil {
		t.Fatalf("invalid admin media JSON: %v", err)
	}
	if len(adminMediaItems) == 0 || adminMediaItems[0].ID != createdMedia.ID {
		t.Fatalf("admin media items = %#v, want uploaded media first", adminMediaItems)
	}

	updateMedia := httptest.NewRecorder()
	updateMediaReq := httptest.NewRequest(http.MethodPut, "/api/admin/media/"+createdMedia.ID, strings.NewReader(`{"altText":"Updated integration media alt"}`))
	updateMediaReq.Header.Set("Content-Type", "application/json")
	updateMediaReq.Header.Set("Origin", "http://localhost:3000")
	for _, cookie := range cookies {
		updateMediaReq.AddCookie(cookie)
	}
	handler.ServeHTTP(updateMedia, updateMediaReq)
	if updateMedia.Code != http.StatusOK {
		t.Fatalf("update media status = %d, body = %s", updateMedia.Code, updateMedia.Body.String())
	}
	var updatedMedia struct {
		AltText string `json:"altText"`
	}
	if err := json.Unmarshal(updateMedia.Body.Bytes(), &updatedMedia); err != nil {
		t.Fatalf("invalid updated media JSON: %v", err)
	}
	if updatedMedia.AltText != "Updated integration media alt" {
		t.Fatalf("updated media alt text = %q", updatedMedia.AltText)
	}

	publicMedia := httptest.NewRecorder()
	handler.ServeHTTP(publicMedia, httptest.NewRequest(http.MethodGet, "/api/media/"+createdMedia.ID, nil))
	if publicMedia.Code != http.StatusOK {
		t.Fatalf("public media status = %d, body = %s", publicMedia.Code, publicMedia.Body.String())
	}
	if got := publicMedia.Header().Get("Content-Type"); got != "image/png" {
		t.Fatalf("public media content type = %q, want image/png", got)
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
		"ogImageId":"`+createdMedia.ID+`",
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
		Tags      []string `json:"tags"`
		OgImageID string   `json:"ogImageId"`
	}
	if err := json.Unmarshal(adminGet.Body.Bytes(), &adminPost); err != nil {
		t.Fatalf("invalid admin post JSON: %v", err)
	}
	if len(adminPost.Tags) != 2 {
		t.Fatalf("admin post tags = %#v, want persisted tags", adminPost.Tags)
	}
	if adminPost.OgImageID != createdMedia.ID {
		t.Fatalf("admin post ogImageId = %q, want %q", adminPost.OgImageID, createdMedia.ID)
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

	deleteMedia := httptest.NewRecorder()
	deleteMediaReq := httptest.NewRequest(http.MethodDelete, "/api/admin/media/"+createdMedia.ID, nil)
	deleteMediaReq.Header.Set("Origin", "http://localhost:3000")
	for _, cookie := range cookies {
		deleteMediaReq.AddCookie(cookie)
	}
	handler.ServeHTTP(deleteMedia, deleteMediaReq)
	if deleteMedia.Code != http.StatusNoContent {
		t.Fatalf("delete media status = %d, body = %s", deleteMedia.Code, deleteMedia.Body.String())
	}

	publicMediaAfterDelete := httptest.NewRecorder()
	handler.ServeHTTP(publicMediaAfterDelete, httptest.NewRequest(http.MethodGet, "/api/media/"+createdMedia.ID, nil))
	if publicMediaAfterDelete.Code != http.StatusNotFound {
		t.Fatalf("public media after delete status = %d, want 404; body = %s", publicMediaAfterDelete.Code, publicMediaAfterDelete.Body.String())
	}
}
