package server

import (
	"context"
	"crypto/subtle"
	"encoding/json"
	"errors"
	"fmt"
	"html"
	"log/slog"
	"net/http"
	"os"
	"regexp"
	"strings"
	"time"
	"unicode"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/modelcontextprotocol/go-sdk/mcp"
)

const DefaultReadHeaderTimeout = 5 * time.Second

type Role string

const (
	roleRead  Role = "read"
	roleAdmin Role = "admin"
)

type contextKey string

const roleContextKey contextKey = "mcp_role"

type Config struct {
	ReadToken      string
	AdminToken     string
	AllowedOrigins []string
	DatabaseURL    string
}

func LoadConfig() Config {
	return Config{
		ReadToken:      env("MCP_BEARER_TOKEN", ""),
		AdminToken:     env("MCP_ADMIN_BEARER_TOKEN", ""),
		AllowedOrigins: csvEnv("MCP_ALLOWED_ORIGINS", []string{"http://localhost:3000"}),
		DatabaseURL:    env("DATABASE_URL", ""),
	}
}

type Store interface {
	GetProfile(context.Context) (Profile, error)
	ListProjects(context.Context) ([]Project, error)
	GetProject(context.Context, string) (Project, error)
	ListBlogPosts(context.Context) ([]BlogPost, error)
	GetBlogPost(context.Context, string) (BlogPost, error)
	SearchContent(context.Context, string, int) ([]SearchResult, error)
	CreateDraftPost(context.Context, DraftPostInput) (BlogPost, error)
	ModerateComment(context.Context, ModerateCommentInput) (CommentModeration, error)
}

type Profile struct {
	FullName         string   `json:"fullName"`
	Headline         string   `json:"headline"`
	ShortBio         string   `json:"shortBio"`
	LongBio          string   `json:"longBio"`
	Location         string   `json:"location"`
	CurrentCompany   string   `json:"currentCompany"`
	FocusAreas       []string `json:"focusAreas"`
	Skills           []string `json:"skills"`
	GitHubURL        string   `json:"githubUrl"`
	LinkedInURL      string   `json:"linkedinUrl"`
	Email            string   `json:"email"`
	ProfileImagePath string   `json:"profileImagePath"`
}

type Project struct {
	ID          string   `json:"id"`
	Slug        string   `json:"slug"`
	Title       string   `json:"title"`
	Eyebrow     string   `json:"eyebrow"`
	Summary     string   `json:"summary"`
	Description string   `json:"description"`
	Problem     string   `json:"problem"`
	Built       string   `json:"built"`
	Signals     []string `json:"signals"`
	Stack       []string `json:"stack"`
	RepoURL     string   `json:"repoUrl"`
	DemoURL     string   `json:"demoUrl,omitempty"`
}

type BlogPost struct {
	ID              string     `json:"id"`
	Slug            string     `json:"slug"`
	Title           string     `json:"title"`
	Excerpt         string     `json:"excerpt"`
	ContentMarkdown string     `json:"contentMarkdown,omitempty"`
	Status          string     `json:"status"`
	PublishedAt     *time.Time `json:"publishedAt,omitempty"`
	SeoTitle        string     `json:"seoTitle"`
	SeoDescription  string     `json:"seoDescription"`
	Tags            []string   `json:"tags"`
}

type SearchResult struct {
	Type    string `json:"type"`
	Slug    string `json:"slug,omitempty"`
	Title   string `json:"title"`
	Snippet string `json:"snippet"`
	URL     string `json:"url,omitempty"`
}

type ProjectsOutput struct {
	Projects []Project `json:"projects"`
}

type BlogPostsOutput struct {
	Posts []BlogPost `json:"posts"`
}

type SearchOutput struct {
	Results []SearchResult `json:"results"`
}

type DraftPostInput struct {
	Slug            string   `json:"slug,omitempty" jsonschema:"optional slug; generated from title when omitted"`
	Title           string   `json:"title" jsonschema:"draft post title"`
	Excerpt         string   `json:"excerpt,omitempty" jsonschema:"short summary"`
	ContentMarkdown string   `json:"contentMarkdown,omitempty" jsonschema:"draft markdown content"`
	SeoTitle        string   `json:"seoTitle,omitempty" jsonschema:"SEO title"`
	SeoDescription  string   `json:"seoDescription,omitempty" jsonschema:"SEO description"`
	Tags            []string `json:"tags,omitempty" jsonschema:"tags to attach to the draft"`
}

type ModerateCommentInput struct {
	ID     string `json:"id" jsonschema:"comment UUID"`
	Status string `json:"status" jsonschema:"approved, spam, or deleted"`
}

type CommentModeration struct {
	ID          string     `json:"id"`
	PostID      string     `json:"postId"`
	DisplayName string     `json:"displayName"`
	Body        string     `json:"body"`
	Status      string     `json:"status"`
	ModeratedAt *time.Time `json:"moderatedAt,omitempty"`
}

type app struct {
	cfg    Config
	logger *slog.Logger
	store  Store
}

func New(cfg Config, logger *slog.Logger, store Store) http.Handler {
	if logger == nil {
		logger = slog.New(slog.NewJSONHandler(os.Stdout, nil))
	}
	a := &app{cfg: cfg, logger: logger, store: store}

	mux := http.NewServeMux()
	mux.HandleFunc("GET /healthz", a.health)

	readServer := a.mcpServer(roleRead)
	adminServer := a.mcpServer(roleAdmin)
	crossOriginProtection := http.NewCrossOriginProtection()
	for _, origin := range cfg.AllowedOrigins {
		if err := crossOriginProtection.AddTrustedOrigin(origin); err != nil {
			logger.Warn("invalid MCP trusted origin ignored", "origin", origin, "error", err)
		}
	}
	mcpHandler := mcp.NewStreamableHTTPHandler(func(r *http.Request) *mcp.Server {
		if roleFromContext(r.Context()) == roleAdmin {
			return adminServer
		}
		return readServer
	}, &mcp.StreamableHTTPOptions{
		Stateless:             true,
		JSONResponse:          true,
		SessionTimeout:        10 * time.Minute,
		Logger:                logger,
		CrossOriginProtection: crossOriginProtection,
	})
	mux.Handle("/mcp", a.mcpSecurity(mcpHandler))

	return withSecurityHeaders(withLogging(logger, mux))
}

func NewSQLStore(ctx context.Context, databaseURL string) (*SQLStore, func(), error) {
	if strings.TrimSpace(databaseURL) == "" {
		return nil, func() {}, nil
	}
	pool, err := pgxpool.New(ctx, databaseURL)
	if err != nil {
		return nil, nil, err
	}
	if err := pool.Ping(ctx); err != nil {
		pool.Close()
		return nil, nil, err
	}
	return &SQLStore{db: pool}, pool.Close, nil
}

func (a *app) health(w http.ResponseWriter, r *http.Request) {
	dbStatus := "not_configured"
	if a.store != nil {
		dbStatus = "configured"
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"status":          "ok",
		"database":        dbStatus,
		"readAuthEnabled": a.cfg.ReadToken != "",
		"adminAuth":       a.cfg.AdminToken != "",
	})
}

func (a *app) mcpSecurity(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodOptions {
			if !a.allowOrigin(w, r) {
				writeJSON(w, http.StatusForbidden, map[string]string{"error": "origin_not_allowed"})
				return
			}
			w.Header().Set("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS")
			w.Header().Set("Access-Control-Allow-Headers", "Authorization, Content-Type, Mcp-Protocol-Version, Mcp-Session-Id")
			w.WriteHeader(http.StatusNoContent)
			return
		}
		if !a.allowOrigin(w, r) {
			writeJSON(w, http.StatusForbidden, map[string]string{"error": "origin_not_allowed"})
			return
		}
		role, ok := a.authenticate(r)
		if !ok {
			w.Header().Set("WWW-Authenticate", `Bearer realm="portfolio-mcp"`)
			writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
			return
		}
		next.ServeHTTP(w, r.WithContext(context.WithValue(r.Context(), roleContextKey, role)))
	})
}

func (a *app) allowOrigin(w http.ResponseWriter, r *http.Request) bool {
	origin := strings.TrimSpace(r.Header.Get("Origin"))
	if origin == "" {
		return true
	}
	for _, allowed := range a.cfg.AllowedOrigins {
		if origin == allowed {
			w.Header().Set("Access-Control-Allow-Origin", origin)
			w.Header().Set("Vary", "Origin")
			return true
		}
	}
	return false
}

func (a *app) authenticate(r *http.Request) (Role, bool) {
	token := bearerToken(r)
	if token == "" {
		return "", false
	}
	if a.cfg.AdminToken != "" && constantTimeEqual(token, a.cfg.AdminToken) {
		return roleAdmin, true
	}
	if a.cfg.ReadToken != "" && constantTimeEqual(token, a.cfg.ReadToken) {
		return roleRead, true
	}
	return "", false
}

func (a *app) mcpServer(role Role) *mcp.Server {
	server := mcp.NewServer(&mcp.Implementation{Name: "bpajor.dev", Version: "0.1.0"}, &mcp.ServerOptions{
		Instructions: "Portfolio MCP server. Use read tools for public context. Admin tools require the admin token.",
		Logger:       a.logger,
	})

	mcp.AddTool(server, &mcp.Tool{Name: "get_profile", Description: "Return the public professional profile."}, a.getProfile)
	mcp.AddTool(server, &mcp.Tool{Name: "list_projects", Description: "List featured portfolio projects."}, a.listProjects)
	mcp.AddTool(server, &mcp.Tool{Name: "get_project", Description: "Return a project by slug."}, a.getProject)
	mcp.AddTool(server, &mcp.Tool{Name: "list_blog_posts", Description: "List published blog posts."}, a.listBlogPosts)
	mcp.AddTool(server, &mcp.Tool{Name: "get_blog_post", Description: "Return a published blog post by slug."}, a.getBlogPost)
	mcp.AddTool(server, &mcp.Tool{Name: "search_content", Description: "Search public profile, projects, and published blog posts."}, a.searchContent)
	mcp.AddTool(server, &mcp.Tool{Name: "get_site_context", Description: "Return compact site context for AI agents."}, a.getSiteContext)
	mcp.AddTool(server, &mcp.Tool{Name: "create_draft_post", Description: "Admin-only: create a draft blog post."}, func(ctx context.Context, req *mcp.CallToolRequest, in DraftPostInput) (*mcp.CallToolResult, BlogPost, error) {
		if role != roleAdmin {
			return nil, BlogPost{}, errors.New("admin token required")
		}
		return a.createDraftPost(ctx, req, in)
	})
	mcp.AddTool(server, &mcp.Tool{Name: "moderate_comment", Description: "Admin-only: moderate a comment by UUID."}, func(ctx context.Context, req *mcp.CallToolRequest, in ModerateCommentInput) (*mcp.CallToolResult, CommentModeration, error) {
		if role != roleAdmin {
			return nil, CommentModeration{}, errors.New("admin token required")
		}
		return a.moderateComment(ctx, req, in)
	})
	return server
}

type slugInput struct {
	Slug string `json:"slug" jsonschema:"slug identifier"`
}

type searchInput struct {
	Query string `json:"query" jsonschema:"search query"`
	Limit int    `json:"limit,omitempty" jsonschema:"maximum result count"`
}

type emptyInput struct{}

func (a *app) getProfile(ctx context.Context, _ *mcp.CallToolRequest, _ emptyInput) (*mcp.CallToolResult, Profile, error) {
	if err := a.requireStore(); err != nil {
		return nil, Profile{}, err
	}
	profile, err := a.store.GetProfile(ctx)
	return toolResult(profile), profile, err
}

func (a *app) listProjects(ctx context.Context, _ *mcp.CallToolRequest, _ emptyInput) (*mcp.CallToolResult, ProjectsOutput, error) {
	if err := a.requireStore(); err != nil {
		return nil, ProjectsOutput{}, err
	}
	projects, err := a.store.ListProjects(ctx)
	out := ProjectsOutput{Projects: projects}
	return toolResult(out), out, err
}

func (a *app) getProject(ctx context.Context, _ *mcp.CallToolRequest, in slugInput) (*mcp.CallToolResult, Project, error) {
	if err := a.requireStore(); err != nil {
		return nil, Project{}, err
	}
	project, err := a.store.GetProject(ctx, strings.TrimSpace(in.Slug))
	return toolResult(project), project, err
}

func (a *app) listBlogPosts(ctx context.Context, _ *mcp.CallToolRequest, _ emptyInput) (*mcp.CallToolResult, BlogPostsOutput, error) {
	if err := a.requireStore(); err != nil {
		return nil, BlogPostsOutput{}, err
	}
	posts, err := a.store.ListBlogPosts(ctx)
	out := BlogPostsOutput{Posts: posts}
	return toolResult(out), out, err
}

func (a *app) getBlogPost(ctx context.Context, _ *mcp.CallToolRequest, in slugInput) (*mcp.CallToolResult, BlogPost, error) {
	if err := a.requireStore(); err != nil {
		return nil, BlogPost{}, err
	}
	post, err := a.store.GetBlogPost(ctx, strings.TrimSpace(in.Slug))
	return toolResult(post), post, err
}

func (a *app) searchContent(ctx context.Context, _ *mcp.CallToolRequest, in searchInput) (*mcp.CallToolResult, SearchOutput, error) {
	if err := a.requireStore(); err != nil {
		return nil, SearchOutput{}, err
	}
	results, err := a.store.SearchContent(ctx, strings.TrimSpace(in.Query), in.Limit)
	out := SearchOutput{Results: results}
	return toolResult(out), out, err
}

type SiteContext struct {
	Profile       Profile    `json:"profile"`
	Projects      []Project  `json:"projects"`
	LatestPosts   []BlogPost `json:"latestPosts"`
	AllowedTools  []string   `json:"allowedTools"`
	SecurityNotes []string   `json:"securityNotes"`
}

func (a *app) getSiteContext(ctx context.Context, _ *mcp.CallToolRequest, _ emptyInput) (*mcp.CallToolResult, SiteContext, error) {
	if err := a.requireStore(); err != nil {
		return nil, SiteContext{}, err
	}
	profile, err := a.store.GetProfile(ctx)
	if err != nil {
		return nil, SiteContext{}, err
	}
	projects, err := a.store.ListProjects(ctx)
	if err != nil {
		return nil, SiteContext{}, err
	}
	posts, err := a.store.ListBlogPosts(ctx)
	if err != nil {
		return nil, SiteContext{}, err
	}
	if len(posts) > 5 {
		posts = posts[:5]
	}
	out := SiteContext{
		Profile:      profile,
		Projects:     projects,
		LatestPosts:  posts,
		AllowedTools: []string{"get_profile", "list_projects", "get_project", "list_blog_posts", "get_blog_post", "search_content", "get_site_context"},
		SecurityNotes: []string{
			"No shell execution tools are exposed.",
			"No arbitrary filesystem read/write tools are exposed.",
			"Admin tools require a separate bearer token.",
		},
	}
	return toolResult(out), out, nil
}

func (a *app) createDraftPost(ctx context.Context, _ *mcp.CallToolRequest, in DraftPostInput) (*mcp.CallToolResult, BlogPost, error) {
	if err := a.requireStore(); err != nil {
		return nil, BlogPost{}, err
	}
	in.Title = strings.TrimSpace(in.Title)
	in.Slug = strings.TrimSpace(in.Slug)
	in.Excerpt = strings.TrimSpace(in.Excerpt)
	in.ContentMarkdown = strings.TrimSpace(in.ContentMarkdown)
	if in.Title == "" {
		return nil, BlogPost{}, errors.New("title is required")
	}
	post, err := a.store.CreateDraftPost(ctx, in)
	return toolResult(post), post, err
}

func (a *app) moderateComment(ctx context.Context, _ *mcp.CallToolRequest, in ModerateCommentInput) (*mcp.CallToolResult, CommentModeration, error) {
	if err := a.requireStore(); err != nil {
		return nil, CommentModeration{}, err
	}
	in.Status = strings.ToLower(strings.TrimSpace(in.Status))
	if in.Status != "approved" && in.Status != "spam" && in.Status != "deleted" {
		return nil, CommentModeration{}, errors.New("status must be approved, spam, or deleted")
	}
	comment, err := a.store.ModerateComment(ctx, in)
	return toolResult(comment), comment, err
}

func (a *app) requireStore() error {
	if a.store == nil {
		return errors.New("database is not configured")
	}
	return nil
}

type SQLStore struct {
	db *pgxpool.Pool
}

func (s *SQLStore) GetProfile(ctx context.Context) (Profile, error) {
	var p Profile
	err := s.db.QueryRow(ctx, `
SELECT full_name, headline, short_bio, long_bio, location, current_company, focus_areas, skills, github_url, linkedin_url, email, profile_image_path
FROM profile
WHERE id = 1`).Scan(&p.FullName, &p.Headline, &p.ShortBio, &p.LongBio, &p.Location, &p.CurrentCompany, &p.FocusAreas, &p.Skills, &p.GitHubURL, &p.LinkedInURL, &p.Email, &p.ProfileImagePath)
	return p, err
}

func (s *SQLStore) ListProjects(ctx context.Context) ([]Project, error) {
	rows, err := s.db.Query(ctx, `
SELECT id, slug, title, eyebrow, summary, description, problem, built, signals, stack, repo_url, COALESCE(demo_url, '')
FROM projects
WHERE is_featured = true
ORDER BY sort_order ASC, created_at DESC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanProjects(rows)
}

func (s *SQLStore) GetProject(ctx context.Context, slug string) (Project, error) {
	var p Project
	err := s.db.QueryRow(ctx, `
SELECT id, slug, title, eyebrow, summary, description, problem, built, signals, stack, repo_url, COALESCE(demo_url, '')
FROM projects
WHERE slug = $1`, slug).Scan(&p.ID, &p.Slug, &p.Title, &p.Eyebrow, &p.Summary, &p.Description, &p.Problem, &p.Built, &p.Signals, &p.Stack, &p.RepoURL, &p.DemoURL)
	return p, err
}

func (s *SQLStore) ListBlogPosts(ctx context.Context) ([]BlogPost, error) {
	rows, err := s.db.Query(ctx, `
SELECT p.id, p.slug, p.title, p.excerpt, p.status, p.published_at, p.seo_title, p.seo_description,
       COALESCE(array_agg(pt.tag ORDER BY pt.tag) FILTER (WHERE pt.tag IS NOT NULL), '{}')::text[] AS tags
FROM posts p
LEFT JOIN post_tags pt ON pt.post_id = p.id
WHERE p.status = 'published'
GROUP BY p.id
ORDER BY p.published_at DESC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanBlogPosts(rows, false)
}

func (s *SQLStore) GetBlogPost(ctx context.Context, slug string) (BlogPost, error) {
	var post BlogPost
	var publishedAt pgtype.Timestamptz
	err := s.db.QueryRow(ctx, `
SELECT p.id, p.slug, p.title, p.excerpt, p.content_markdown, p.status, p.published_at, p.seo_title, p.seo_description,
       COALESCE(array_agg(pt.tag ORDER BY pt.tag) FILTER (WHERE pt.tag IS NOT NULL), '{}')::text[] AS tags
FROM posts p
LEFT JOIN post_tags pt ON pt.post_id = p.id
WHERE p.slug = $1 AND p.status = 'published'
GROUP BY p.id`, slug).Scan(&post.ID, &post.Slug, &post.Title, &post.Excerpt, &post.ContentMarkdown, &post.Status, &publishedAt, &post.SeoTitle, &post.SeoDescription, &post.Tags)
	post.PublishedAt = timePtr(publishedAt)
	return post, err
}

func (s *SQLStore) SearchContent(ctx context.Context, query string, limit int) ([]SearchResult, error) {
	if query == "" {
		return []SearchResult{}, nil
	}
	if limit <= 0 || limit > 20 {
		limit = 10
	}
	term := "%" + query + "%"
	rows, err := s.db.Query(ctx, `
SELECT type, slug, title, snippet, url
FROM (
  SELECT 'profile' AS type, '' AS slug, full_name AS title, short_bio AS snippet, '/' AS url
  FROM profile
  WHERE full_name ILIKE $1 OR headline ILIKE $1 OR short_bio ILIKE $1 OR long_bio ILIKE $1
  UNION ALL
  SELECT 'project' AS type, slug, title, summary AS snippet, '/projects/' || slug AS url
  FROM projects
  WHERE title ILIKE $1 OR summary ILIKE $1 OR description ILIKE $1 OR array_to_string(stack, ' ') ILIKE $1
  UNION ALL
  SELECT 'blog_post' AS type, slug, title, excerpt AS snippet, '/blog/' || slug AS url
  FROM posts
  WHERE status = 'published' AND (title ILIKE $1 OR excerpt ILIKE $1 OR content_markdown ILIKE $1)
) results
LIMIT $2`, term, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	results := []SearchResult{}
	for rows.Next() {
		var r SearchResult
		if err := rows.Scan(&r.Type, &r.Slug, &r.Title, &r.Snippet, &r.URL); err != nil {
			return nil, err
		}
		results = append(results, r)
	}
	return results, rows.Err()
}

func (s *SQLStore) CreateDraftPost(ctx context.Context, in DraftPostInput) (BlogPost, error) {
	slug := slugify(in.Slug)
	if slug == "" {
		slug = slugify(in.Title)
	}
	if slug == "" {
		return BlogPost{}, errors.New("slug could not be generated")
	}
	tx, err := s.db.Begin(ctx)
	if err != nil {
		return BlogPost{}, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	var post BlogPost
	err = tx.QueryRow(ctx, `
INSERT INTO posts (slug, title, excerpt, content_markdown, content_html_sanitized, status, seo_title, seo_description)
VALUES ($1, $2, $3, $4, $5, 'draft', $6, $7)
RETURNING id, slug, title, excerpt, content_markdown, status, seo_title, seo_description`,
		slug, in.Title, in.Excerpt, in.ContentMarkdown, sanitizedHTML(in.ContentMarkdown), in.SeoTitle, in.SeoDescription,
	).Scan(&post.ID, &post.Slug, &post.Title, &post.Excerpt, &post.ContentMarkdown, &post.Status, &post.SeoTitle, &post.SeoDescription)
	if err != nil {
		return BlogPost{}, err
	}
	post.Tags = cleanTags(in.Tags)
	if len(post.Tags) > 0 {
		if _, err := tx.Exec(ctx, `INSERT INTO post_tags (post_id, tag) SELECT $1, unnest($2::text[]) ON CONFLICT DO NOTHING`, post.ID, post.Tags); err != nil {
			return BlogPost{}, err
		}
	}
	if err := createAuditLog(ctx, tx, "mcp.create_draft_post", "post", post.ID, map[string]any{"slug": post.Slug, "title": post.Title}); err != nil {
		return BlogPost{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return BlogPost{}, err
	}
	return post, nil
}

func (s *SQLStore) ModerateComment(ctx context.Context, in ModerateCommentInput) (CommentModeration, error) {
	id, err := uuid.Parse(in.ID)
	if err != nil {
		return CommentModeration{}, err
	}
	tx, err := s.db.Begin(ctx)
	if err != nil {
		return CommentModeration{}, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	var c CommentModeration
	var moderatedAt pgtype.Timestamptz
	err = tx.QueryRow(ctx, `
UPDATE comments
SET status = $2, moderated_at = now()
WHERE id = $1
RETURNING id, post_id, display_name, body, status, moderated_at`, id, in.Status).Scan(&c.ID, &c.PostID, &c.DisplayName, &c.Body, &c.Status, &moderatedAt)
	if err != nil {
		return CommentModeration{}, err
	}
	c.ModeratedAt = timePtr(moderatedAt)
	if err := createAuditLog(ctx, tx, "mcp.moderate_comment", "comment", c.ID, map[string]any{"status": c.Status}); err != nil {
		return CommentModeration{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return CommentModeration{}, err
	}
	return c, nil
}

func createAuditLog(ctx context.Context, tx pgx.Tx, action, entityType, entityID string, metadata map[string]any) error {
	entityUUID, err := uuid.Parse(entityID)
	if err != nil {
		return err
	}
	payload, err := json.Marshal(metadata)
	if err != nil {
		return err
	}
	_, err = tx.Exec(ctx, `
INSERT INTO audit_log (actor_user_id, action, entity_type, entity_id, metadata)
VALUES ($1, $2, $3, $4, $5)`, nil, action, entityType, entityUUID, payload)
	return err
}

func scanProjects(rows pgx.Rows) ([]Project, error) {
	projects := []Project{}
	for rows.Next() {
		var p Project
		if err := rows.Scan(&p.ID, &p.Slug, &p.Title, &p.Eyebrow, &p.Summary, &p.Description, &p.Problem, &p.Built, &p.Signals, &p.Stack, &p.RepoURL, &p.DemoURL); err != nil {
			return nil, err
		}
		projects = append(projects, p)
	}
	return projects, rows.Err()
}

func scanBlogPosts(rows pgx.Rows, includeContent bool) ([]BlogPost, error) {
	posts := []BlogPost{}
	for rows.Next() {
		var p BlogPost
		var publishedAt pgtype.Timestamptz
		if includeContent {
			if err := rows.Scan(&p.ID, &p.Slug, &p.Title, &p.Excerpt, &p.ContentMarkdown, &p.Status, &publishedAt, &p.SeoTitle, &p.SeoDescription, &p.Tags); err != nil {
				return nil, err
			}
		} else {
			if err := rows.Scan(&p.ID, &p.Slug, &p.Title, &p.Excerpt, &p.Status, &publishedAt, &p.SeoTitle, &p.SeoDescription, &p.Tags); err != nil {
				return nil, err
			}
		}
		p.PublishedAt = timePtr(publishedAt)
		posts = append(posts, p)
	}
	return posts, rows.Err()
}

func toolResult(v any) *mcp.CallToolResult {
	payload, err := json.MarshalIndent(v, "", "  ")
	if err != nil {
		payload = []byte(fmt.Sprintf(`{"error":%q}`, err.Error()))
	}
	return &mcp.CallToolResult{Content: []mcp.Content{&mcp.TextContent{Text: string(payload)}}}
}

func roleFromContext(ctx context.Context) Role {
	role, _ := ctx.Value(roleContextKey).(Role)
	return role
}

func bearerToken(r *http.Request) string {
	auth := strings.TrimSpace(r.Header.Get("Authorization"))
	if !strings.HasPrefix(auth, "Bearer ") {
		return ""
	}
	return strings.TrimSpace(strings.TrimPrefix(auth, "Bearer "))
}

func constantTimeEqual(a, b string) bool {
	if len(a) != len(b) {
		return false
	}
	return subtle.ConstantTimeCompare([]byte(a), []byte(b)) == 1
}

func withSecurityHeaders(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("X-Frame-Options", "DENY")
		w.Header().Set("Referrer-Policy", "strict-origin-when-cross-origin")
		next.ServeHTTP(w, r)
	})
}

func withLogging(logger *slog.Logger, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		next.ServeHTTP(w, r)
		logger.Info("request", "method", r.Method, "path", r.URL.Path, "duration_ms", time.Since(start).Milliseconds())
	})
}

func writeJSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.Header().Set("X-Content-Type-Options", "nosniff")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}

func timePtr(value pgtype.Timestamptz) *time.Time {
	if !value.Valid {
		return nil
	}
	return &value.Time
}

func cleanTags(input []string) []string {
	seen := map[string]struct{}{}
	tags := make([]string, 0, len(input))
	for _, tag := range input {
		tag = strings.TrimSpace(tag)
		if tag == "" {
			continue
		}
		key := strings.ToLower(tag)
		if _, ok := seen[key]; ok {
			continue
		}
		seen[key] = struct{}{}
		tags = append(tags, tag)
	}
	return tags
}

func sanitizedHTML(markdown string) string {
	if strings.TrimSpace(markdown) == "" {
		return ""
	}
	return "<pre>" + html.EscapeString(markdown) + "</pre>"
}

var nonSlugChar = regexp.MustCompile(`[^a-z0-9]+`)

func slugify(value string) string {
	value = strings.ToLower(strings.TrimSpace(value))
	var b strings.Builder
	for _, r := range value {
		if r <= unicode.MaxASCII {
			b.WriteRune(r)
		}
	}
	slug := nonSlugChar.ReplaceAllString(b.String(), "-")
	slug = strings.Trim(slug, "-")
	for strings.Contains(slug, "--") {
		slug = strings.ReplaceAll(slug, "--", "-")
	}
	return slug
}

func env(key, fallback string) string {
	value := os.Getenv(key)
	if value == "" {
		return fallback
	}
	return value
}

func csvEnv(key string, fallback []string) []string {
	value := os.Getenv(key)
	if value == "" {
		return fallback
	}
	parts := strings.Split(value, ",")
	out := make([]string, 0, len(parts))
	for _, part := range parts {
		part = strings.TrimSpace(part)
		if part != "" {
			out = append(out, part)
		}
	}
	if len(out) == 0 {
		return fallback
	}
	return out
}
