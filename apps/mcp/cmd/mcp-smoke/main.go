package main

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"os"
	"strings"
	"time"

	"github.com/modelcontextprotocol/go-sdk/mcp"
)

const timeout = 20 * time.Second

func main() {
	if err := run(); err != nil {
		fmt.Fprintf(os.Stderr, "MCP smoke failed: %v\n", err)
		os.Exit(1)
	}
	fmt.Println("MCP smoke passed")
}

func run() error {
	baseURL := strings.TrimRight(os.Getenv("MCP_SMOKE_BASE_URL"), "/")
	readToken := strings.TrimSpace(os.Getenv("MCP_SMOKE_READ_TOKEN"))
	adminToken := strings.TrimSpace(os.Getenv("MCP_SMOKE_ADMIN_TOKEN"))
	origin := strings.TrimSpace(os.Getenv("MCP_SMOKE_ORIGIN"))
	if baseURL == "" {
		return errors.New("MCP_SMOKE_BASE_URL is required")
	}
	if readToken == "" {
		return errors.New("MCP_SMOKE_READ_TOKEN is required")
	}
	if adminToken == "" {
		return errors.New("MCP_SMOKE_ADMIN_TOKEN is required")
	}
	if readToken == adminToken {
		return errors.New("read and admin MCP smoke tokens must be different")
	}
	endpoint, err := url.JoinPath(baseURL, "mcp")
	if err != nil {
		return fmt.Errorf("build MCP endpoint: %w", err)
	}

	if err := expectStatus(endpoint, "", origin, http.StatusUnauthorized); err != nil {
		return err
	}
	if err := expectStatus(endpoint, "invalid-mcp-smoke-token", origin, http.StatusUnauthorized); err != nil {
		return err
	}

	ctx, cancel := context.WithTimeout(context.Background(), timeout)
	defer cancel()

	readSession, err := connect(ctx, endpoint, readToken, origin)
	if err != nil {
		return fmt.Errorf("connect with read token: %w", err)
	}
	defer readSession.Close()

	if err := verifyReadSession(ctx, readSession); err != nil {
		return err
	}
	if err := verifyReadTokenCannotWrite(ctx, readSession); err != nil {
		return err
	}

	adminSession, err := connect(ctx, endpoint, adminToken, origin)
	if err != nil {
		return fmt.Errorf("connect with admin token: %w", err)
	}
	defer adminSession.Close()

	if err := verifyAdminSession(ctx, adminSession); err != nil {
		return err
	}
	return nil
}

func expectStatus(endpoint, token, origin string, want int) error {
	ctx, cancel := context.WithTimeout(context.Background(), timeout)
	defer cancel()
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return err
	}
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	if origin != "" {
		req.Header.Set("Origin", origin)
	}
	res, err := http.DefaultClient.Do(req)
	if err != nil {
		return fmt.Errorf("request %s: %w", endpoint, err)
	}
	defer res.Body.Close()
	if res.StatusCode != want {
		return fmt.Errorf("GET /mcp status = %d, want %d", res.StatusCode, want)
	}
	return nil
}

func connect(ctx context.Context, endpoint, token, origin string) (*mcp.ClientSession, error) {
	client := mcp.NewClient(&mcp.Implementation{Name: "portfolio-mcp-smoke", Version: "0.1.0"}, nil)
	return client.Connect(ctx, &mcp.StreamableClientTransport{
		Endpoint:             endpoint,
		HTTPClient:           &http.Client{Transport: authTransport{token: token, origin: origin}},
		DisableStandaloneSSE: true,
		MaxRetries:           -1,
	}, nil)
}

func verifyReadSession(ctx context.Context, session *mcp.ClientSession) error {
	tools, err := session.ListTools(ctx, nil)
	if err != nil {
		return fmt.Errorf("list tools with read token: %w", err)
	}
	requireTools := map[string]bool{
		"get_profile":      false,
		"list_projects":    false,
		"list_blog_posts":  false,
		"get_site_context": false,
	}
	for _, tool := range tools.Tools {
		if _, ok := requireTools[tool.Name]; ok {
			requireTools[tool.Name] = true
		}
		switch tool.Name {
		case "shell", "read_file", "write_file", "query_sql":
			return fmt.Errorf("dangerous tool exposed: %s", tool.Name)
		}
	}
	for name, found := range requireTools {
		if !found {
			return fmt.Errorf("required read tool not listed: %s", name)
		}
	}

	result, err := session.CallTool(ctx, &mcp.CallToolParams{
		Name:      "get_profile",
		Arguments: map[string]any{},
	})
	if err != nil {
		return fmt.Errorf("get_profile with read token: %w", err)
	}
	text, err := textResult(result)
	if err != nil {
		return err
	}
	var profile struct {
		FullName string `json:"fullName"`
	}
	if err := json.Unmarshal([]byte(text), &profile); err != nil {
		return fmt.Errorf("get_profile returned invalid JSON: %w", err)
	}
	if strings.TrimSpace(profile.FullName) == "" {
		return errors.New("get_profile returned an empty fullName")
	}
	return nil
}

func verifyReadTokenCannotWrite(ctx context.Context, session *mcp.ClientSession) error {
	result, err := session.CallTool(ctx, &mcp.CallToolParams{
		Name: "create_draft_post",
		Arguments: map[string]any{
			"title": "MCP smoke should not be created",
		},
	})
	if err != nil {
		return nil
	}
	if result == nil || !result.IsError {
		return errors.New("read token was able to call create_draft_post")
	}
	return nil
}

func verifyAdminSession(ctx context.Context, session *mcp.ClientSession) error {
	tools, err := session.ListTools(ctx, nil)
	if err != nil {
		return fmt.Errorf("list tools with admin token: %w", err)
	}
	hasCreateDraft := false
	for _, tool := range tools.Tools {
		if tool.Name == "create_draft_post" {
			hasCreateDraft = true
		}
	}
	if !hasCreateDraft {
		return errors.New("admin tool create_draft_post is not listed")
	}

	result, err := session.CallTool(ctx, &mcp.CallToolParams{
		Name:      "create_draft_post",
		Arguments: map[string]any{},
	})
	if err == nil {
		if result == nil || !result.IsError {
			return errors.New("admin validation probe unexpectedly created a draft")
		}
		text, _ := textResult(result)
		if strings.Contains(strings.ToLower(text), "admin token required") {
			return errors.New("admin token was treated as read-only for create_draft_post")
		}
		return nil
	}
	if strings.Contains(strings.ToLower(err.Error()), "admin token required") {
		return fmt.Errorf("admin token was rejected by create_draft_post: %w", err)
	}
	return nil
}

func textResult(result *mcp.CallToolResult) (string, error) {
	if result == nil || len(result.Content) == 0 {
		return "", errors.New("tool returned no content")
	}
	text, ok := result.Content[0].(*mcp.TextContent)
	if !ok {
		return "", fmt.Errorf("tool returned %T, want TextContent", result.Content[0])
	}
	return text.Text, nil
}

type authTransport struct {
	token  string
	origin string
}

func (t authTransport) RoundTrip(req *http.Request) (*http.Response, error) {
	req.Header.Set("Authorization", "Bearer "+t.token)
	if t.origin != "" {
		req.Header.Set("Origin", t.origin)
	}
	return http.DefaultTransport.RoundTrip(req)
}
