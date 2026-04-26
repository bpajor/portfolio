package httpserver

import (
	"context"
	"encoding/json"
	"errors"
	"html"
	"log/slog"
	"net/http"
	"regexp"
	"strings"
	"time"

	"github.com/bpajor/portfolio/apps/api/internal/auth"
	"github.com/bpajor/portfolio/apps/api/internal/config"
	"github.com/bpajor/portfolio/apps/api/internal/content"
	apidb "github.com/bpajor/portfolio/apps/api/internal/db"
	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	"github.com/go-chi/httprate"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
)

const adminSessionCookie = "portfolio_admin_session"

type contextKey string

const adminContextKey contextKey = "admin"

type adminSession struct {
	UserID uuid.UUID
	Email  string
	Role   apidb.UserRole
}

type Server struct {
	cfg     config.Config
	db      *pgxpool.Pool
	queries *apidb.Queries
	logger  *slog.Logger
	repo    content.Repository
}

func New(cfg config.Config, logger *slog.Logger, db *pgxpool.Pool, repo content.Repository) http.Handler {
	if repo == nil {
		repo = content.NewStaticRepository()
	}

	server := Server{
		cfg:    cfg,
		db:     db,
		logger: logger,
		repo:   repo,
	}
	if db != nil {
		server.queries = apidb.New(db)
	}

	r := chi.NewRouter()
	r.Use(middleware.RequestID)
	r.Use(middleware.RealIP)
	r.Use(server.recoverer)
	r.Use(server.securityHeaders)
	r.Use(server.bodyLimit)
	r.Use(httprate.LimitByIP(120, time.Minute))
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   cfg.AllowedOrigins,
		AllowedMethods:   []string{http.MethodGet, http.MethodPost, http.MethodPut, http.MethodDelete, http.MethodOptions},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type", "X-CSRF-Token"},
		ExposedHeaders:   []string{"X-Request-ID"},
		AllowCredentials: true,
		MaxAge:           300,
	}))
	r.Use(server.requestLogger)

	r.Route("/api", func(r chi.Router) {
		r.Get("/healthz", server.health)
		r.Get("/profile", server.getProfile)
		r.Get("/projects", server.listProjects)
		r.Get("/projects/{slug}", server.getProject)
		r.Get("/posts", server.listPublishedPosts)
		r.Get("/posts/{slug}", server.getPublishedPost)

		r.Route("/admin", func(r chi.Router) {
			r.Post("/auth/login", server.adminLogin)
			r.Post("/auth/logout", server.adminLogout)

			r.Group(func(r chi.Router) {
				r.Use(server.requireAdmin)
				r.Get("/me", server.adminMe)
				r.Get("/posts", server.adminListPosts)
				r.Post("/posts", server.adminCreatePost)
				r.Get("/posts/{id}", server.adminGetPost)
				r.Put("/posts/{id}", server.adminUpdatePost)
				r.Delete("/posts/{id}", server.adminDeletePost)
			})
		})
	})

	r.NotFound(func(w http.ResponseWriter, r *http.Request) {
		writeError(w, http.StatusNotFound, "not_found", "Route not found.")
	})

	r.MethodNotAllowed(func(w http.ResponseWriter, r *http.Request) {
		writeError(w, http.StatusMethodNotAllowed, "method_not_allowed", "Method not allowed.")
	})

	return r
}

func (s Server) health(w http.ResponseWriter, r *http.Request) {
	dbStatus := "not_configured"
	if s.db != nil {
		ctx, cancel := context.WithTimeout(r.Context(), 2*time.Second)
		defer cancel()
		dbStatus = "ok"
		if err := s.db.Ping(ctx); err != nil {
			dbStatus = "error"
		}
	}

	status := http.StatusOK
	payloadStatus := "ok"
	if dbStatus == "error" {
		status = http.StatusServiceUnavailable
		payloadStatus = "unhealthy"
	}

	writeJSON(w, status, map[string]any{
		"status":   payloadStatus,
		"database": dbStatus,
		"time":     time.Now().UTC().Format(time.RFC3339),
	})
}

func (s Server) getProfile(w http.ResponseWriter, r *http.Request) {
	profile, err := s.repo.GetProfile(r.Context())
	if err != nil {
		s.logger.Error("get profile failed", "error", err)
		writeError(w, http.StatusInternalServerError, "profile_unavailable", "Profile is temporarily unavailable.")
		return
	}

	writeJSON(w, http.StatusOK, profile)
}

func (s Server) listProjects(w http.ResponseWriter, r *http.Request) {
	projects, err := s.repo.ListFeaturedProjects(r.Context())
	if err != nil {
		s.logger.Error("list projects failed", "error", err)
		writeError(w, http.StatusInternalServerError, "projects_unavailable", "Projects are temporarily unavailable.")
		return
	}

	writeJSON(w, http.StatusOK, projects)
}

func (s Server) getProject(w http.ResponseWriter, r *http.Request) {
	slug := strings.TrimSpace(chi.URLParam(r, "slug"))
	if slug == "" {
		writeError(w, http.StatusBadRequest, "missing_slug", "Project slug is required.")
		return
	}

	project, found, err := s.repo.GetProjectBySlug(r.Context(), slug)
	if err != nil {
		s.logger.Error("get project failed", "slug", slug, "error", err)
		writeError(w, http.StatusInternalServerError, "project_unavailable", "Project is temporarily unavailable.")
		return
	}
	if !found {
		writeError(w, http.StatusNotFound, "project_not_found", "Project was not found.")
		return
	}

	writeJSON(w, http.StatusOK, project)
}

func (s Server) listPublishedPosts(w http.ResponseWriter, r *http.Request) {
	if s.queries == nil {
		writeJSON(w, http.StatusOK, []postResponse{})
		return
	}

	posts, err := s.queries.ListPublishedPosts(r.Context())
	if err != nil {
		s.logger.Error("list published posts failed", "error", err)
		writeError(w, http.StatusInternalServerError, "posts_unavailable", "Posts are temporarily unavailable.")
		return
	}

	out := make([]postResponse, 0, len(posts))
	for _, post := range posts {
		out = append(out, publishedPostRowToResponse(post))
	}
	writeJSON(w, http.StatusOK, out)
}

func (s Server) getPublishedPost(w http.ResponseWriter, r *http.Request) {
	if s.queries == nil {
		writeError(w, http.StatusNotFound, "post_not_found", "Post was not found.")
		return
	}

	post, err := s.queries.GetPublishedPostBySlug(r.Context(), chi.URLParam(r, "slug"))
	if errors.Is(err, pgx.ErrNoRows) {
		writeError(w, http.StatusNotFound, "post_not_found", "Post was not found.")
		return
	}
	if err != nil {
		s.logger.Error("get published post failed", "error", err)
		writeError(w, http.StatusInternalServerError, "post_unavailable", "Post is temporarily unavailable.")
		return
	}

	writeJSON(w, http.StatusOK, publishedPostDetailToResponse(post))
}

func (s Server) adminLogin(w http.ResponseWriter, r *http.Request) {
	if s.queries == nil {
		writeNoDatabase(w)
		return
	}

	var req loginRequest
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_json", "Request body is invalid.")
		return
	}

	user, err := s.queries.GetUserByEmail(r.Context(), strings.TrimSpace(strings.ToLower(req.Email)))
	if errors.Is(err, pgx.ErrNoRows) {
		writeError(w, http.StatusUnauthorized, "invalid_credentials", "Email or password is invalid.")
		return
	}
	if err != nil {
		s.logger.Error("admin login failed", "error", err)
		writeError(w, http.StatusInternalServerError, "login_unavailable", "Login is temporarily unavailable.")
		return
	}
	if !auth.CheckPassword(user.PasswordHash, req.Password) {
		writeError(w, http.StatusUnauthorized, "invalid_credentials", "Email or password is invalid.")
		return
	}

	token, err := auth.NewSessionToken()
	if err != nil {
		s.logger.Error("session token generation failed", "error", err)
		writeError(w, http.StatusInternalServerError, "login_unavailable", "Login is temporarily unavailable.")
		return
	}

	expiresAt := time.Now().UTC().Add(14 * 24 * time.Hour)
	if _, err := s.queries.CreateSession(r.Context(), apidb.CreateSessionParams{
		UserID:    user.ID,
		TokenHash: auth.HashToken(token),
		ExpiresAt: pgtype.Timestamptz{Time: expiresAt, Valid: true},
	}); err != nil {
		s.logger.Error("session creation failed", "error", err)
		writeError(w, http.StatusInternalServerError, "login_unavailable", "Login is temporarily unavailable.")
		return
	}
	if err := s.queries.UpdateUserLastLogin(r.Context(), user.ID); err != nil {
		s.logger.Warn("last login update failed", "error", err)
	}

	http.SetCookie(w, s.sessionCookie(token, expiresAt))
	writeJSON(w, http.StatusOK, adminMeResponse{ID: user.ID.String(), Email: user.Email, Role: string(user.Role)})
}

func (s Server) adminLogout(w http.ResponseWriter, r *http.Request) {
	if cookie, err := r.Cookie(adminSessionCookie); err == nil && s.queries != nil {
		if err := s.queries.RevokeSession(r.Context(), auth.HashToken(cookie.Value)); err != nil {
			s.logger.Warn("session revoke failed", "error", err)
		}
	}
	http.SetCookie(w, s.clearSessionCookie())
	w.WriteHeader(http.StatusNoContent)
}

func (s Server) adminMe(w http.ResponseWriter, r *http.Request) {
	session := adminFromContext(r.Context())
	writeJSON(w, http.StatusOK, adminMeResponse{
		ID:    session.UserID.String(),
		Email: session.Email,
		Role:  string(session.Role),
	})
}

func (s Server) adminListPosts(w http.ResponseWriter, r *http.Request) {
	posts, err := s.queries.AdminListPosts(r.Context())
	if err != nil {
		s.logger.Error("admin list posts failed", "error", err)
		writeError(w, http.StatusInternalServerError, "posts_unavailable", "Posts are temporarily unavailable.")
		return
	}

	out := make([]postResponse, 0, len(posts))
	for _, post := range posts {
		out = append(out, adminPostRowToResponse(post))
	}
	writeJSON(w, http.StatusOK, out)
}

func (s Server) adminGetPost(w http.ResponseWriter, r *http.Request) {
	id, ok := parseUUIDParam(w, r, "id")
	if !ok {
		return
	}

	post, err := s.queries.AdminGetPost(r.Context(), id)
	if errors.Is(err, pgx.ErrNoRows) {
		writeError(w, http.StatusNotFound, "post_not_found", "Post was not found.")
		return
	}
	if err != nil {
		s.logger.Error("admin get post failed", "error", err)
		writeError(w, http.StatusInternalServerError, "post_unavailable", "Post is temporarily unavailable.")
		return
	}
	writeJSON(w, http.StatusOK, postModelToResponse(post, nil))
}

func (s Server) adminCreatePost(w http.ResponseWriter, r *http.Request) {
	req, ok := decodePostRequest(w, r)
	if !ok {
		return
	}

	session := adminFromContext(r.Context())
	post, err := s.queries.CreatePost(r.Context(), apidb.CreatePostParams{
		Slug:                 req.slug(),
		Title:                req.Title,
		Excerpt:              req.Excerpt,
		ContentMarkdown:      req.ContentMarkdown,
		ContentHtmlSanitized: sanitizedHTML(req.ContentMarkdown),
		Status:               req.status(),
		PublishedAt:          publishedAt(req.status()),
		AuthorID:             pgUUID(session.UserID),
		SeoTitle:             req.SeoTitle,
		SeoDescription:       req.SeoDescription,
		OgImageID:            pgtype.UUID{},
	})
	if err != nil {
		s.logger.Error("admin create post failed", "error", err)
		writeError(w, http.StatusInternalServerError, "post_create_failed", "Post could not be created.")
		return
	}
	if err := s.replacePostTags(r.Context(), post.ID, req.cleanTags()); err != nil {
		s.logger.Error("admin replace post tags failed", "error", err)
		writeError(w, http.StatusInternalServerError, "post_tags_failed", "Post tags could not be saved.")
		return
	}
	writeJSON(w, http.StatusCreated, postModelToResponse(post, req.cleanTags()))
}

func (s Server) adminUpdatePost(w http.ResponseWriter, r *http.Request) {
	id, ok := parseUUIDParam(w, r, "id")
	if !ok {
		return
	}
	req, ok := decodePostRequest(w, r)
	if !ok {
		return
	}

	post, err := s.queries.UpdatePost(r.Context(), apidb.UpdatePostParams{
		ID:                   id,
		Slug:                 req.slug(),
		Title:                req.Title,
		Excerpt:              req.Excerpt,
		ContentMarkdown:      req.ContentMarkdown,
		ContentHtmlSanitized: sanitizedHTML(req.ContentMarkdown),
		Status:               req.status(),
		PublishedAt:          publishedAt(req.status()),
		SeoTitle:             req.SeoTitle,
		SeoDescription:       req.SeoDescription,
		OgImageID:            pgtype.UUID{},
	})
	if errors.Is(err, pgx.ErrNoRows) {
		writeError(w, http.StatusNotFound, "post_not_found", "Post was not found.")
		return
	}
	if err != nil {
		s.logger.Error("admin update post failed", "error", err)
		writeError(w, http.StatusInternalServerError, "post_update_failed", "Post could not be updated.")
		return
	}
	if err := s.replacePostTags(r.Context(), post.ID, req.cleanTags()); err != nil {
		s.logger.Error("admin replace post tags failed", "error", err)
		writeError(w, http.StatusInternalServerError, "post_tags_failed", "Post tags could not be saved.")
		return
	}
	writeJSON(w, http.StatusOK, postModelToResponse(post, req.cleanTags()))
}

func (s Server) adminDeletePost(w http.ResponseWriter, r *http.Request) {
	id, ok := parseUUIDParam(w, r, "id")
	if !ok {
		return
	}
	if err := s.queries.DeletePost(r.Context(), id); err != nil {
		s.logger.Error("admin delete post failed", "error", err)
		writeError(w, http.StatusInternalServerError, "post_delete_failed", "Post could not be deleted.")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (s Server) replacePostTags(ctx context.Context, postID uuid.UUID, tags []string) error {
	if err := s.queries.DeletePostTags(ctx, postID); err != nil {
		return err
	}
	if len(tags) == 0 {
		return nil
	}
	return s.queries.AddPostTags(ctx, apidb.AddPostTagsParams{PostID: postID, Tags: tags})
}

func (s Server) requireAdmin(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if s.queries == nil {
			writeNoDatabase(w)
			return
		}

		cookie, err := r.Cookie(adminSessionCookie)
		if err != nil || strings.TrimSpace(cookie.Value) == "" {
			writeError(w, http.StatusUnauthorized, "auth_required", "Admin authentication is required.")
			return
		}

		session, err := s.queries.GetSessionByTokenHash(r.Context(), auth.HashToken(cookie.Value))
		if errors.Is(err, pgx.ErrNoRows) {
			writeError(w, http.StatusUnauthorized, "auth_required", "Admin authentication is required.")
			return
		}
		if err != nil {
			s.logger.Error("session lookup failed", "error", err)
			writeError(w, http.StatusInternalServerError, "session_unavailable", "Session is temporarily unavailable.")
			return
		}

		ctx := context.WithValue(r.Context(), adminContextKey, adminSession{
			UserID: session.UserID,
			Email:  session.Email,
			Role:   session.Role,
		})
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

func (s Server) sessionCookie(token string, expiresAt time.Time) *http.Cookie {
	return &http.Cookie{
		Name:     adminSessionCookie,
		Value:    token,
		Path:     "/",
		Expires:  expiresAt,
		HttpOnly: true,
		Secure:   s.cfg.CookieSecure,
		SameSite: http.SameSiteLaxMode,
	}
}

func (s Server) clearSessionCookie() *http.Cookie {
	return &http.Cookie{
		Name:     adminSessionCookie,
		Value:    "",
		Path:     "/",
		MaxAge:   -1,
		HttpOnly: true,
		Secure:   s.cfg.CookieSecure,
		SameSite: http.SameSiteLaxMode,
	}
}

func (s Server) requestLogger(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		ww := middleware.NewWrapResponseWriter(w, r.ProtoMajor)
		next.ServeHTTP(ww, r)
		s.logger.Info("request",
			"request_id", middleware.GetReqID(r.Context()),
			"method", r.Method,
			"path", r.URL.Path,
			"status", ww.Status(),
			"bytes", ww.BytesWritten(),
			"duration_ms", time.Since(start).Milliseconds(),
		)
	})
}

func (s Server) recoverer(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer func() {
			if value := recover(); value != nil {
				s.logger.Error("panic recovered",
					"request_id", middleware.GetReqID(r.Context()),
					"method", r.Method,
					"path", r.URL.Path,
					"panic", value,
				)
				writeError(w, http.StatusInternalServerError, "internal_error", "Internal server error.")
			}
		}()

		next.ServeHTTP(w, r)
	})
}

func (s Server) securityHeaders(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("X-Frame-Options", "DENY")
		w.Header().Set("Referrer-Policy", "strict-origin-when-cross-origin")
		w.Header().Set("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
		next.ServeHTTP(w, r)
	})
}

func (s Server) bodyLimit(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if s.cfg.BodyLimitBytes > 0 {
			r.Body = http.MaxBytesReader(w, r.Body, s.cfg.BodyLimitBytes)
		}
		next.ServeHTTP(w, r)
	})
}

type loginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type postRequest struct {
	Slug            string   `json:"slug"`
	Title           string   `json:"title"`
	Excerpt         string   `json:"excerpt"`
	ContentMarkdown string   `json:"contentMarkdown"`
	Status          string   `json:"status"`
	SeoTitle        string   `json:"seoTitle"`
	SeoDescription  string   `json:"seoDescription"`
	Tags            []string `json:"tags"`
}

func (r postRequest) slug() string {
	slug := slugify(r.Slug)
	if slug != "" {
		return slug
	}
	return slugify(r.Title)
}

func (r postRequest) status() apidb.PostStatus {
	if r.Status == string(apidb.PostStatusPublished) {
		return apidb.PostStatusPublished
	}
	if r.Status == string(apidb.PostStatusArchived) {
		return apidb.PostStatusArchived
	}
	return apidb.PostStatusDraft
}

func (r postRequest) cleanTags() []string {
	seen := map[string]struct{}{}
	tags := make([]string, 0, len(r.Tags))
	for _, tag := range r.Tags {
		tag = strings.TrimSpace(tag)
		if tag == "" {
			continue
		}
		key := strings.ToLower(tag)
		if _, exists := seen[key]; exists {
			continue
		}
		seen[key] = struct{}{}
		tags = append(tags, tag)
	}
	return tags
}

type adminMeResponse struct {
	ID    string `json:"id"`
	Email string `json:"email"`
	Role  string `json:"role"`
}

type postResponse struct {
	ID                   string     `json:"id"`
	Slug                 string     `json:"slug"`
	Title                string     `json:"title"`
	Excerpt              string     `json:"excerpt"`
	ContentMarkdown      string     `json:"contentMarkdown,omitempty"`
	ContentHTMLSanitized string     `json:"contentHtmlSanitized,omitempty"`
	Status               string     `json:"status"`
	PublishedAt          *time.Time `json:"publishedAt,omitempty"`
	SeoTitle             string     `json:"seoTitle"`
	SeoDescription       string     `json:"seoDescription"`
	Tags                 []string   `json:"tags"`
	CreatedAt            time.Time  `json:"createdAt"`
	UpdatedAt            time.Time  `json:"updatedAt"`
}

func decodePostRequest(w http.ResponseWriter, r *http.Request) (postRequest, bool) {
	var req postRequest
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_json", "Request body is invalid.")
		return req, false
	}
	req.Title = strings.TrimSpace(req.Title)
	req.Excerpt = strings.TrimSpace(req.Excerpt)
	req.ContentMarkdown = strings.TrimSpace(req.ContentMarkdown)
	req.SeoTitle = strings.TrimSpace(req.SeoTitle)
	req.SeoDescription = strings.TrimSpace(req.SeoDescription)
	if req.Title == "" {
		writeError(w, http.StatusBadRequest, "title_required", "Post title is required.")
		return req, false
	}
	if req.slug() == "" {
		writeError(w, http.StatusBadRequest, "slug_required", "Post slug is required.")
		return req, false
	}
	if req.status() == apidb.PostStatusPublished && req.ContentMarkdown == "" {
		writeError(w, http.StatusBadRequest, "content_required", "Published posts require content.")
		return req, false
	}
	return req, true
}

func publishedAt(status apidb.PostStatus) pgtype.Timestamptz {
	if status != apidb.PostStatusPublished {
		return pgtype.Timestamptz{}
	}
	return pgtype.Timestamptz{Time: time.Now().UTC(), Valid: true}
}

func sanitizedHTML(markdown string) string {
	if markdown == "" {
		return ""
	}
	return "<pre>" + html.EscapeString(markdown) + "</pre>"
}

func publishedPostRowToResponse(post apidb.ListPublishedPostsRow) postResponse {
	return postResponse{
		ID:             post.ID.String(),
		Slug:           post.Slug,
		Title:          post.Title,
		Excerpt:        post.Excerpt,
		Status:         string(post.Status),
		PublishedAt:    pgTimePtr(post.PublishedAt),
		SeoTitle:       post.SeoTitle,
		SeoDescription: post.SeoDescription,
		Tags:           post.Tags,
		CreatedAt:      post.CreatedAt.Time,
		UpdatedAt:      post.UpdatedAt.Time,
	}
}

func publishedPostDetailToResponse(post apidb.GetPublishedPostBySlugRow) postResponse {
	out := postResponse{
		ID:                   post.ID.String(),
		Slug:                 post.Slug,
		Title:                post.Title,
		Excerpt:              post.Excerpt,
		ContentMarkdown:      post.ContentMarkdown,
		ContentHTMLSanitized: post.ContentHtmlSanitized,
		Status:               string(post.Status),
		PublishedAt:          pgTimePtr(post.PublishedAt),
		SeoTitle:             post.SeoTitle,
		SeoDescription:       post.SeoDescription,
		Tags:                 post.Tags,
		CreatedAt:            post.CreatedAt.Time,
		UpdatedAt:            post.UpdatedAt.Time,
	}
	return out
}

func adminPostRowToResponse(post apidb.AdminListPostsRow) postResponse {
	return postResponse{
		ID:             post.ID.String(),
		Slug:           post.Slug,
		Title:          post.Title,
		Excerpt:        post.Excerpt,
		Status:         string(post.Status),
		PublishedAt:    pgTimePtr(post.PublishedAt),
		SeoTitle:       post.SeoTitle,
		SeoDescription: post.SeoDescription,
		Tags:           []string{},
		CreatedAt:      post.CreatedAt.Time,
		UpdatedAt:      post.UpdatedAt.Time,
	}
}

func postModelToResponse(post apidb.Post, tags []string) postResponse {
	return postResponse{
		ID:                   post.ID.String(),
		Slug:                 post.Slug,
		Title:                post.Title,
		Excerpt:              post.Excerpt,
		ContentMarkdown:      post.ContentMarkdown,
		ContentHTMLSanitized: post.ContentHtmlSanitized,
		Status:               string(post.Status),
		PublishedAt:          pgTimePtr(post.PublishedAt),
		SeoTitle:             post.SeoTitle,
		SeoDescription:       post.SeoDescription,
		Tags:                 tags,
		CreatedAt:            post.CreatedAt.Time,
		UpdatedAt:            post.UpdatedAt.Time,
	}
}

func pgTimePtr(value pgtype.Timestamptz) *time.Time {
	if !value.Valid {
		return nil
	}
	return &value.Time
}

func pgUUID(id uuid.UUID) pgtype.UUID {
	return pgtype.UUID{Bytes: id, Valid: true}
}

func adminFromContext(ctx context.Context) adminSession {
	session, _ := ctx.Value(adminContextKey).(adminSession)
	return session
}

func parseUUIDParam(w http.ResponseWriter, r *http.Request, name string) (uuid.UUID, bool) {
	id, err := uuid.Parse(chi.URLParam(r, name))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid_id", "Identifier is invalid.")
		return uuid.Nil, false
	}
	return id, true
}

func decodeJSON(r *http.Request, target any) error {
	decoder := json.NewDecoder(r.Body)
	decoder.DisallowUnknownFields()
	return decoder.Decode(target)
}

var nonSlugChars = regexp.MustCompile(`[^a-z0-9]+`)

func slugify(value string) string {
	value = strings.ToLower(strings.TrimSpace(value))
	value = nonSlugChars.ReplaceAllString(value, "-")
	value = strings.Trim(value, "-")
	return value
}

func writeJSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(payload); err != nil && !errors.Is(err, http.ErrHandlerTimeout) {
		http.Error(w, "response encoding failed", http.StatusInternalServerError)
	}
}

func writeError(w http.ResponseWriter, status int, code string, message string) {
	writeJSON(w, status, map[string]any{
		"error": map[string]string{
			"code":    code,
			"message": message,
		},
	})
}

func writeNoDatabase(w http.ResponseWriter) {
	writeError(w, http.StatusServiceUnavailable, "database_required", "Database connection is required for this operation.")
}
