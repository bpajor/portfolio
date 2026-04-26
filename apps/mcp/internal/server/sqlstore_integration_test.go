package server

import (
	"context"
	"os"
	"strings"
	"testing"
	"time"
)

func TestSQLStoreIntegration(t *testing.T) {
	databaseURL := os.Getenv("MCP_INTEGRATION_DATABASE_URL")
	if databaseURL == "" {
		t.Skip("MCP_INTEGRATION_DATABASE_URL is not set")
	}

	ctx := context.Background()
	store, cleanup, err := NewSQLStore(ctx, databaseURL)
	if err != nil {
		t.Fatalf("NewSQLStore failed: %v", err)
	}
	defer cleanup()

	profile, err := store.GetProfile(ctx)
	if err != nil {
		t.Fatalf("GetProfile failed: %v", err)
	}
	if profile.FullName == "" {
		t.Fatal("profile full name is empty")
	}

	projects, err := store.ListProjects(ctx)
	if err != nil {
		t.Fatalf("ListProjects failed: %v", err)
	}
	if len(projects) == 0 {
		t.Fatal("expected seeded projects")
	}

	results, err := store.SearchContent(ctx, "Go", 5)
	if err != nil {
		t.Fatalf("SearchContent failed: %v", err)
	}
	if len(results) == 0 {
		t.Fatal("expected search results")
	}

	title := "Integration Draft " + time.Now().UTC().Format("20060102150405")
	draft, err := store.CreateDraftPost(ctx, DraftPostInput{
		Title:           title,
		ContentMarkdown: "Created by SQLStore integration test.",
		Tags:            []string{"MCP", "Integration"},
	})
	if err != nil {
		t.Fatalf("CreateDraftPost failed: %v", err)
	}
	if draft.Status != "draft" {
		t.Fatalf("draft status = %q, want draft", draft.Status)
	}
	if !strings.HasPrefix(draft.Slug, "integration-draft-") {
		t.Fatalf("draft slug = %q, want generated integration slug", draft.Slug)
	}
}
