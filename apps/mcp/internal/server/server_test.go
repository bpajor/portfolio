package server

import (
	"context"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"

	"github.com/modelcontextprotocol/go-sdk/mcp"
)

func TestMCPRejectsMissingToken(t *testing.T) {
	handler := New(testConfig(), testLogger(), newFakeStore())
	req := httptest.NewRequest(http.MethodPost, "/mcp", strings.NewReader(`{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}`))
	res := httptest.NewRecorder()

	handler.ServeHTTP(res, req)

	if res.Code != http.StatusUnauthorized {
		t.Fatalf("status = %d, want %d", res.Code, http.StatusUnauthorized)
	}
}

func TestMCPRejectsUnexpectedOrigin(t *testing.T) {
	handler := New(testConfig(), testLogger(), newFakeStore())
	req := httptest.NewRequest(http.MethodPost, "/mcp", strings.NewReader(`{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}`))
	req.Header.Set("Authorization", "Bearer read-token")
	req.Header.Set("Origin", "https://evil.example")
	res := httptest.NewRecorder()

	handler.ServeHTTP(res, req)

	if res.Code != http.StatusForbidden {
		t.Fatalf("status = %d, want %d", res.Code, http.StatusForbidden)
	}
}

func TestMCPReadToolsWorkWithReadToken(t *testing.T) {
	session := newTestSession(t, "read-token")
	defer session.Close()

	result, err := session.CallTool(context.Background(), &mcp.CallToolParams{
		Name:      "get_profile",
		Arguments: map[string]any{},
	})
	if err != nil {
		t.Fatalf("CallTool failed: %v", err)
	}
	text := result.Content[0].(*mcp.TextContent).Text
	if !strings.Contains(text, "Blazej Pajor") {
		t.Fatalf("profile result = %q, want public profile", text)
	}

	tools, err := session.ListTools(context.Background(), nil)
	if err != nil {
		t.Fatalf("ListTools failed: %v", err)
	}
	for _, tool := range tools.Tools {
		if tool.Name == "shell" || tool.Name == "read_file" || tool.Name == "write_file" {
			t.Fatalf("dangerous tool exposed: %s", tool.Name)
		}
	}
}

func TestMCPAdminToolsRejectReadToken(t *testing.T) {
	session := newTestSession(t, "read-token")
	defer session.Close()

	result, err := session.CallTool(context.Background(), &mcp.CallToolParams{
		Name: "create_draft_post",
		Arguments: map[string]any{
			"title": "Draft from read token",
		},
	})
	if err != nil {
		return
	}
	if !result.IsError {
		t.Fatal("create_draft_post with read token succeeded, want MCP error result")
	}
}

func TestMCPAdminToolsWorkWithAdminToken(t *testing.T) {
	session := newTestSession(t, "admin-token")
	defer session.Close()

	result, err := session.CallTool(context.Background(), &mcp.CallToolParams{
		Name: "create_draft_post",
		Arguments: map[string]any{
			"title":           "Agentic Systems Notes",
			"contentMarkdown": "Initial draft.",
			"tags":            []string{"AI", "GCP"},
		},
	})
	if err != nil {
		t.Fatalf("create_draft_post failed: %v", err)
	}
	text := result.Content[0].(*mcp.TextContent).Text
	if !strings.Contains(text, "agentic-systems-notes") {
		t.Fatalf("draft result = %q, want generated slug", text)
	}
}

func newTestSession(t *testing.T, token string) *mcp.ClientSession {
	t.Helper()
	httpServer := httptest.NewServer(New(testConfig(), testLogger(), newFakeStore()))
	t.Cleanup(httpServer.Close)

	client := mcp.NewClient(&mcp.Implementation{Name: "mcp-test", Version: "0.1.0"}, nil)
	session, err := client.Connect(context.Background(), &mcp.StreamableClientTransport{
		Endpoint:             httpServer.URL + "/mcp",
		HTTPClient:           &http.Client{Transport: authTransport{token: token, origin: "http://localhost:3000"}},
		DisableStandaloneSSE: true,
		MaxRetries:           -1,
	}, nil)
	if err != nil {
		t.Fatalf("Connect failed: %v", err)
	}
	return session
}

type authTransport struct {
	token  string
	origin string
}

func (t authTransport) RoundTrip(req *http.Request) (*http.Response, error) {
	req.Header.Set("Authorization", "Bearer "+t.token)
	req.Header.Set("Origin", t.origin)
	return http.DefaultTransport.RoundTrip(req)
}

func testConfig() Config {
	return Config{
		ReadToken:      "read-token",
		AdminToken:     "admin-token",
		AllowedOrigins: []string{"http://localhost:3000"},
	}
}

func testLogger() *slog.Logger {
	return slog.New(slog.NewTextHandler(io.Discard, nil))
}

type fakeStore struct {
	mu     sync.Mutex
	drafts []BlogPost
}

func newFakeStore() *fakeStore {
	return &fakeStore{}
}

func (s *fakeStore) GetProfile(context.Context) (Profile, error) {
	return Profile{
		FullName:       "Blazej Pajor",
		Headline:       "Software Engineer for reliable backend and AI-driven systems",
		ShortBio:       "Backend, cloud, and AI systems engineer.",
		CurrentCompany: "WP Engine",
		FocusAreas:     []string{"Backend", "GCP", "Agentic AI"},
		Skills:         []string{"Go", "PostgreSQL", "Kubernetes"},
		GitHubURL:      "https://github.com/bpajor/",
		LinkedInURL:    "https://www.linkedin.com/in/b%C5%82a%C5%BCej-pajor-837974238/",
		Email:          "blazej122@vp.pl",
	}, nil
}

func (s *fakeStore) ListProjects(context.Context) ([]Project, error) {
	return []Project{{Slug: "pay-management-system", Title: "Pay Management System", Summary: "Payroll visibility system."}}, nil
}

func (s *fakeStore) GetProject(_ context.Context, slug string) (Project, error) {
	return Project{Slug: slug, Title: "Pay Management System", Summary: "Payroll visibility system."}, nil
}

func (s *fakeStore) ListBlogPosts(context.Context) ([]BlogPost, error) {
	return []BlogPost{{Slug: "mcp-as-a-portfolio-interface", Title: "MCP as a portfolio interface", Status: "published"}}, nil
}

func (s *fakeStore) GetBlogPost(_ context.Context, slug string) (BlogPost, error) {
	return BlogPost{Slug: slug, Title: "MCP as a portfolio interface", ContentMarkdown: "MCP content.", Status: "published"}, nil
}

func (s *fakeStore) SearchContent(_ context.Context, query string, _ int) ([]SearchResult, error) {
	return []SearchResult{{Type: "profile", Title: "Blazej Pajor", Snippet: query}}, nil
}

func (s *fakeStore) CreateDraftPost(_ context.Context, in DraftPostInput) (BlogPost, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	post := BlogPost{ID: "draft-1", Slug: slugify(in.Title), Title: in.Title, ContentMarkdown: in.ContentMarkdown, Status: "draft", Tags: in.Tags}
	s.drafts = append(s.drafts, post)
	return post, nil
}

func (s *fakeStore) ModerateComment(_ context.Context, in ModerateCommentInput) (CommentModeration, error) {
	return CommentModeration{ID: in.ID, Status: in.Status}, nil
}
