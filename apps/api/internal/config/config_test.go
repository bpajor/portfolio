package config

import (
	"reflect"
	"testing"
	"time"
)

func TestLoadDefaults(t *testing.T) {
	t.Setenv("API_ADDR", "")
	t.Setenv("DATABASE_URL", "")
	t.Setenv("API_ALLOWED_ORIGINS", "")
	t.Setenv("API_BODY_LIMIT_BYTES", "")
	t.Setenv("MEDIA_MAX_BYTES", "")
	t.Setenv("MEDIA_STORAGE_DIR", "")
	t.Setenv("API_COOKIE_SECURE", "")
	t.Setenv("SESSION_SECRET", "")
	t.Setenv("TURNSTILE_VERIFY_URL", "")
	t.Setenv("API_READ_HEADER_TIMEOUT_SECONDS", "")
	t.Setenv("API_READ_TIMEOUT_SECONDS", "")
	t.Setenv("API_WRITE_TIMEOUT_SECONDS", "")
	t.Setenv("API_IDLE_TIMEOUT_SECONDS", "")
	t.Setenv("API_SHUTDOWN_TIMEOUT_SECONDS", "")

	cfg := Load()

	if cfg.Addr != ":8080" {
		t.Fatalf("Addr = %q, want :8080", cfg.Addr)
	}
	if !reflect.DeepEqual(cfg.AllowedOrigins, []string{"http://localhost:3000"}) {
		t.Fatalf("AllowedOrigins = %#v", cfg.AllowedOrigins)
	}
	if cfg.BodyLimitBytes != 8<<20 {
		t.Fatalf("BodyLimitBytes = %d, want %d", cfg.BodyLimitBytes, 8<<20)
	}
	if cfg.MediaMaxBytes != 5<<20 {
		t.Fatalf("MediaMaxBytes = %d, want %d", cfg.MediaMaxBytes, 5<<20)
	}
	if cfg.MediaStorageDir != "/tmp/portfolio-media" {
		t.Fatalf("MediaStorageDir = %q, want /tmp/portfolio-media", cfg.MediaStorageDir)
	}
	if !cfg.CookieSecure {
		t.Fatal("CookieSecure default should be true")
	}
	if cfg.PrivacyHashSecret != "development" {
		t.Fatalf("PrivacyHashSecret = %q, want development", cfg.PrivacyHashSecret)
	}
	if cfg.ReadTimeout != 120*time.Second {
		t.Fatalf("ReadTimeout = %s, want 120s", cfg.ReadTimeout)
	}
	if cfg.WriteTimeout != 120*time.Second {
		t.Fatalf("WriteTimeout = %s, want 120s", cfg.WriteTimeout)
	}
}

func TestLoadParsesEnvironment(t *testing.T) {
	t.Setenv("API_ADDR", ":9090")
	t.Setenv("DATABASE_URL", "postgres://example")
	t.Setenv("API_ALLOWED_ORIGINS", " https://bpajor.dev, http://localhost:3000 ,, ")
	t.Setenv("API_BODY_LIMIT_BYTES", "2048")
	t.Setenv("MEDIA_MAX_BYTES", "4096")
	t.Setenv("MEDIA_STORAGE_DIR", "/data/media")
	t.Setenv("API_COOKIE_SECURE", "false")
	t.Setenv("SESSION_SECRET", "secret")
	t.Setenv("TURNSTILE_SECRET_KEY", "turnstile")
	t.Setenv("API_READ_HEADER_TIMEOUT_SECONDS", "7")
	t.Setenv("API_READ_TIMEOUT_SECONDS", "90")
	t.Setenv("API_WRITE_TIMEOUT_SECONDS", "91")
	t.Setenv("API_IDLE_TIMEOUT_SECONDS", "92")
	t.Setenv("API_SHUTDOWN_TIMEOUT_SECONDS", "93")

	cfg := Load()

	if cfg.Addr != ":9090" {
		t.Fatalf("Addr = %q, want :9090", cfg.Addr)
	}
	if cfg.DatabaseURL != "postgres://example" {
		t.Fatalf("DatabaseURL = %q", cfg.DatabaseURL)
	}
	wantOrigins := []string{"https://bpajor.dev", "http://localhost:3000"}
	if !reflect.DeepEqual(cfg.AllowedOrigins, wantOrigins) {
		t.Fatalf("AllowedOrigins = %#v, want %#v", cfg.AllowedOrigins, wantOrigins)
	}
	if cfg.BodyLimitBytes != 2048 {
		t.Fatalf("BodyLimitBytes = %d, want 2048", cfg.BodyLimitBytes)
	}
	if cfg.MediaMaxBytes != 4096 {
		t.Fatalf("MediaMaxBytes = %d, want 4096", cfg.MediaMaxBytes)
	}
	if cfg.MediaStorageDir != "/data/media" {
		t.Fatalf("MediaStorageDir = %q, want /data/media", cfg.MediaStorageDir)
	}
	if cfg.CookieSecure {
		t.Fatal("CookieSecure should parse false")
	}
	if cfg.PrivacyHashSecret != "secret" {
		t.Fatalf("PrivacyHashSecret = %q, want secret", cfg.PrivacyHashSecret)
	}
	if cfg.TurnstileSecretKey != "turnstile" {
		t.Fatalf("TurnstileSecretKey = %q, want turnstile", cfg.TurnstileSecretKey)
	}
	if cfg.ReadHeaderTimeout != 7*time.Second {
		t.Fatalf("ReadHeaderTimeout = %s, want 7s", cfg.ReadHeaderTimeout)
	}
	if cfg.ReadTimeout != 90*time.Second {
		t.Fatalf("ReadTimeout = %s, want 90s", cfg.ReadTimeout)
	}
	if cfg.WriteTimeout != 91*time.Second {
		t.Fatalf("WriteTimeout = %s, want 91s", cfg.WriteTimeout)
	}
	if cfg.IdleTimeout != 92*time.Second {
		t.Fatalf("IdleTimeout = %s, want 92s", cfg.IdleTimeout)
	}
	if cfg.ShutdownTimeout != 93*time.Second {
		t.Fatalf("ShutdownTimeout = %s, want 93s", cfg.ShutdownTimeout)
	}
}

func TestLoadFallsBackOnInvalidValues(t *testing.T) {
	t.Setenv("API_ALLOWED_ORIGINS", " , , ")
	t.Setenv("API_BODY_LIMIT_BYTES", "-1")
	t.Setenv("MEDIA_MAX_BYTES", "-1")
	t.Setenv("API_COOKIE_SECURE", "definitely")
	t.Setenv("API_READ_TIMEOUT_SECONDS", "-1")

	cfg := Load()

	if !reflect.DeepEqual(cfg.AllowedOrigins, []string{"http://localhost:3000"}) {
		t.Fatalf("AllowedOrigins = %#v", cfg.AllowedOrigins)
	}
	if cfg.BodyLimitBytes != 8<<20 {
		t.Fatalf("BodyLimitBytes = %d, want default", cfg.BodyLimitBytes)
	}
	if cfg.MediaMaxBytes != 5<<20 {
		t.Fatalf("MediaMaxBytes = %d, want default", cfg.MediaMaxBytes)
	}
	if !cfg.CookieSecure {
		t.Fatal("CookieSecure should fall back to true")
	}
	if cfg.ReadTimeout != 120*time.Second {
		t.Fatalf("ReadTimeout = %s, want default", cfg.ReadTimeout)
	}
}
