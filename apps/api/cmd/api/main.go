package main

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"

	"github.com/bpajor/portfolio/apps/api/internal/auth"
	"github.com/bpajor/portfolio/apps/api/internal/config"
	"github.com/bpajor/portfolio/apps/api/internal/content"
	"github.com/bpajor/portfolio/apps/api/internal/database"
	apidb "github.com/bpajor/portfolio/apps/api/internal/db"
	"github.com/bpajor/portfolio/apps/api/internal/httpserver"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
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
	if db != nil {
		queries := apidb.New(db)
		if err := bootstrapAdmin(ctx, logger, cfg, queries); err != nil {
			logger.Error("admin bootstrap failed", "error", err)
			os.Exit(1)
		}
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

func bootstrapAdmin(ctx context.Context, logger *slog.Logger, cfg config.Config, queries *apidb.Queries) error {
	if cfg.AdminEmail == "" && cfg.AdminPassword == "" {
		return nil
	}
	if cfg.AdminEmail == "" || cfg.AdminPassword == "" {
		return errors.New("ADMIN_EMAIL and ADMIN_PASSWORD must be provided together")
	}

	_, err := queries.GetUserByEmail(ctx, cfg.AdminEmail)
	if err == nil {
		return nil
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		return err
	}

	hash, err := auth.HashPassword(cfg.AdminPassword)
	if err != nil {
		return err
	}
	_, err = queries.CreateAdminUser(ctx, apidb.CreateAdminUserParams{
		Email:               cfg.AdminEmail,
		PasswordHash:        hash,
		TotpSecretEncrypted: pgtype.Text{},
	})
	if err != nil {
		return err
	}
	logger.Info("bootstrapped admin user", "email", cfg.AdminEmail)
	return nil
}
