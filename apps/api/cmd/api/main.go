package main

import (
	"context"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"

	"github.com/bpajor/portfolio/apps/api/internal/config"
	"github.com/bpajor/portfolio/apps/api/internal/content"
	"github.com/bpajor/portfolio/apps/api/internal/database"
	"github.com/bpajor/portfolio/apps/api/internal/httpserver"
)

func main() {
	cfg := config.Load()
	logger := slog.New(slog.NewJSONHandler(os.Stdout, nil))
	ctx := context.Background()

	db, err := database.Open(ctx, cfg.DatabaseURL)
	if err != nil {
		logger.Error("database connection failed", "error", err)
		os.Exit(1)
	}
	if db != nil {
		defer db.Close()
	}

	server := &http.Server{
		Addr:              cfg.Addr,
		Handler:           httpserver.New(cfg, logger, db, content.NewStaticRepository()),
		ReadHeaderTimeout: cfg.ReadHeaderTimeout,
		ReadTimeout:       cfg.ReadTimeout,
		WriteTimeout:      cfg.WriteTimeout,
		IdleTimeout:       cfg.IdleTimeout,
	}

	go func() {
		logger.Info("starting api", "addr", cfg.Addr)
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			logger.Error("api stopped", "error", err)
			os.Exit(1)
		}
	}()

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, os.Interrupt, syscall.SIGTERM)
	<-stop

	shutdownCtx, cancel := context.WithTimeout(context.Background(), cfg.ShutdownTimeout)
	defer cancel()
	if err := server.Shutdown(shutdownCtx); err != nil {
		logger.Error("api shutdown failed", "error", err)
		os.Exit(1)
	}
	logger.Info("api stopped")
}
