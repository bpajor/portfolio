package httpserver

import (
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/bpajor/portfolio/apps/api/internal/auth"
	apidb "github.com/bpajor/portfolio/apps/api/internal/db"
	"github.com/jackc/pgx/v5"
)

type mcpTokenResponse struct {
	ID         string     `json:"id"`
	Name       string     `json:"name"`
	Scope      string     `json:"scope"`
	CreatedAt  time.Time  `json:"createdAt"`
	LastUsedAt *time.Time `json:"lastUsedAt"`
	RevokedAt  *time.Time `json:"revokedAt"`
	Token      string     `json:"token,omitempty"`
}

type mcpTokenRequest struct {
	Name  string `json:"name"`
	Scope string `json:"scope"`
}

func (s Server) adminListMCPTokens(w http.ResponseWriter, r *http.Request) {
	tokens, err := s.queries.AdminListMCPTokens(r.Context())
	if err != nil {
		s.logger.Error("admin list mcp tokens failed", "error", err)
		writeError(w, http.StatusInternalServerError, "mcp_tokens_unavailable", "MCP tokens are temporarily unavailable.")
		return
	}

	out := make([]mcpTokenResponse, 0, len(tokens))
	for _, token := range tokens {
		out = append(out, mcpTokenModelToResponse(token, ""))
	}
	writeJSON(w, http.StatusOK, out)
}

func (s Server) adminCreateMCPToken(w http.ResponseWriter, r *http.Request) {
	var req mcpTokenRequest
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_json", "Request body is invalid.")
		return
	}

	name := strings.TrimSpace(req.Name)
	if len(name) < 2 || len(name) > 80 {
		writeError(w, http.StatusBadRequest, "mcp_token_name_invalid", "Token name must be between 2 and 80 characters.")
		return
	}

	scope, ok := parseMCPTokenScope(req.Scope)
	if !ok {
		writeError(w, http.StatusBadRequest, "mcp_token_scope_invalid", "Token scope must be read or admin.")
		return
	}

	plainToken, err := auth.NewSessionToken()
	if err != nil {
		s.logger.Error("generate mcp token failed", "error", err)
		writeError(w, http.StatusInternalServerError, "mcp_token_create_failed", "MCP token could not be created.")
		return
	}
	plainToken = "mcp_" + string(scope) + "_" + plainToken

	admin := adminFromContext(r.Context())
	token, err := s.queries.CreateMCPToken(r.Context(), apidb.CreateMCPTokenParams{
		Name:      name,
		TokenHash: auth.HashToken(plainToken),
		Scope:     scope,
		CreatedBy: pgUUID(admin.UserID),
	})
	if err != nil {
		s.logger.Error("create mcp token failed", "error", err)
		writeError(w, http.StatusInternalServerError, "mcp_token_create_failed", "MCP token could not be created.")
		return
	}

	writeJSON(w, http.StatusCreated, mcpTokenModelToResponse(token, plainToken))
}

func (s Server) adminRevokeMCPToken(w http.ResponseWriter, r *http.Request) {
	id, ok := parseUUIDParam(w, r, "id")
	if !ok {
		return
	}

	token, err := s.queries.RevokeMCPToken(r.Context(), id)
	if errors.Is(err, pgx.ErrNoRows) {
		writeError(w, http.StatusNotFound, "mcp_token_not_found", "MCP token was not found.")
		return
	}
	if err != nil {
		s.logger.Error("revoke mcp token failed", "error", err)
		writeError(w, http.StatusInternalServerError, "mcp_token_revoke_failed", "MCP token could not be revoked.")
		return
	}

	writeJSON(w, http.StatusOK, mcpTokenModelToResponse(token, ""))
}

func parseMCPTokenScope(raw string) (apidb.McpTokenScope, bool) {
	switch strings.ToLower(strings.TrimSpace(raw)) {
	case "", string(apidb.McpTokenScopeRead):
		return apidb.McpTokenScopeRead, true
	case string(apidb.McpTokenScopeAdmin):
		return apidb.McpTokenScopeAdmin, true
	default:
		return "", false
	}
}

func mcpTokenModelToResponse(token apidb.McpToken, plainToken string) mcpTokenResponse {
	return mcpTokenResponse{
		ID:         token.ID.String(),
		Name:       token.Name,
		Scope:      string(token.Scope),
		CreatedAt:  token.CreatedAt.Time,
		LastUsedAt: pgTimePtr(token.LastUsedAt),
		RevokedAt:  pgTimePtr(token.RevokedAt),
		Token:      plainToken,
	}
}
