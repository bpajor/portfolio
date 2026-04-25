package main

import (
	"log/slog"
	"net/http"
	"os"

	"github.com/bpajor/portfolio/apps/api/internal/config"
	"github.com/bpajor/portfolio/apps/api/internal/httpserver"
)

func main() {
	cfg := config.Load()
	logger := slog.New(slog.NewJSONHandler(os.Stdout, nil))

	server := &http.Server{
		Addr:              cfg.Addr,
		Handler:           httpserver.New(logger),
		ReadHeaderTimeout: cfg.ReadHeaderTimeout,
	}

	logger.Info("starting api", "addr", cfg.Addr)
	if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		logger.Error("api stopped", "error", err)
		os.Exit(1)
	}
}
