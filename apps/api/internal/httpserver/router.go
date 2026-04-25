package httpserver

import (
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/bpajor/portfolio/apps/api/internal/config"
	"github.com/bpajor/portfolio/apps/api/internal/content"
	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	"github.com/go-chi/httprate"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Server struct {
	cfg    config.Config
	db     *pgxpool.Pool
	logger *slog.Logger
	repo   content.Repository
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
	if dbStatus == "error" {
		status = http.StatusServiceUnavailable
	}

	writeJSON(w, status, map[string]any{
		"status":   "ok",
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
