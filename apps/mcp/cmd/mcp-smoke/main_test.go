package main

import (
	"context"
	"errors"
	"io"
	"log/slog"
	"net/http/httptest"
	"testing"

	mcpserver "github.com/bpajor/portfolio/apps/mcp/internal/server"
)

func TestSmokeRunAgainstMCPServer(t *testing.T) {
	handler := mcpserver.New(mcpserver.Config{
		ReadToken:  "read-token",
		AdminToken: "admin-token",
	}, slog.New(slog.NewTextHandler(io.Discard, nil)), smokeStore{})
	httpServer := httptest.NewServer(handler)
	t.Cleanup(httpServer.Close)

	t.Setenv("MCP_SMOKE_BASE_URL", httpServer.URL)
	t.Setenv("MCP_SMOKE_READ_TOKEN", "read-token")
	t.Setenv("MCP_SMOKE_ADMIN_TOKEN", "admin-token")

	if err := run(); err != nil {
		t.Fatalf("run failed: %v", err)
	}
}

type smokeStore struct{}

func (smokeStore) GetProfile(context.Context) (mcpserver.Profile, error) {
	return mcpserver.Profile{FullName: "Blazej Pajor"}, nil
}

func (smokeStore) ListProjects(context.Context) ([]mcpserver.Project, error) {
	return []mcpserver.Project{{Slug: "mcp-smoke-project", Title: "MCP smoke project"}}, nil
}

func (smokeStore) GetProject(_ context.Context, slug string) (mcpserver.Project, error) {
	return mcpserver.Project{Slug: slug, Title: "MCP smoke project"}, nil
}

func (smokeStore) ListBlogPosts(context.Context) ([]mcpserver.BlogPost, error) {
	return []mcpserver.BlogPost{{Slug: "mcp-smoke-post", Title: "MCP smoke post", Status: "published"}}, nil
}

func (smokeStore) GetBlogPost(_ context.Context, slug string) (mcpserver.BlogPost, error) {
	return mcpserver.BlogPost{Slug: slug, Title: "MCP smoke post", Status: "published"}, nil
}

func (smokeStore) SearchContent(context.Context, string, int) ([]mcpserver.SearchResult, error) {
	return []mcpserver.SearchResult{{Type: "profile", Title: "Blazej Pajor"}}, nil
}

func (smokeStore) CreateDraftPost(context.Context, mcpserver.DraftPostInput) (mcpserver.BlogPost, error) {
	return mcpserver.BlogPost{}, errors.New("smoke test must not create drafts")
}

func (smokeStore) ModerateComment(context.Context, mcpserver.ModerateCommentInput) (mcpserver.CommentModeration, error) {
	return mcpserver.CommentModeration{}, errors.New("smoke test must not moderate comments")
}
