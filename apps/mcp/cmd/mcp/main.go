package main

import (
	"context"
	"log/slog"
	"net/http"
	"os"

	"github.com/bpajor/portfolio/apps/mcp/internal/server"
)

func main() {
	ctx := context.Background()
	cfg := server.LoadConfig()
	addr := env("MCP_ADDR", ":8090")
	logger := slog.New(slog.NewJSONHandler(os.Stdout, nil))
	store, cleanup, err := server.NewSQLStore(ctx, cfg.DatabaseURL)
	if err != nil {
		logger.Error("database connection failed", "error", err)
		os.Exit(1)
	}
	defer cleanup()

	httpServer := &http.Server{
		Addr:              addr,
		Handler:           server.New(cfg, logger, store),
		ReadHeaderTimeout: server.DefaultReadHeaderTimeout,
	}

	logger.Info("starting mcp", "addr", addr)
	if err := httpServer.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		logger.Error("mcp stopped", "error", err)
		os.Exit(1)
	}
}

func env(key, fallback string) string {
	value := os.Getenv(key)
	if value == "" {
		return fallback
	}
	return value
}
