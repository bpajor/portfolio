package config

import (
	"reflect"
	"testing"
)

func TestLoadDefaults(t *testing.T) {
	t.Setenv("API_ADDR", "")
	t.Setenv("DATABASE_URL", "")
	t.Setenv("API_ALLOWED_ORIGINS", "")
	t.Setenv("API_BODY_LIMIT_BYTES", "")
	t.Setenv("API_COOKIE_SECURE", "")
	t.Setenv("SESSION_SECRET", "")
	t.Setenv("TURNSTILE_VERIFY_URL", "")

	cfg := Load()

	if cfg.Addr != ":8080" {
		t.Fatalf("Addr = %q, want :8080", cfg.Addr)
	}
	if !reflect.DeepEqual(cfg.AllowedOrigins, []string{"http://localhost:3000"}) {
		t.Fatalf("AllowedOrigins = %#v", cfg.AllowedOrigins)
	}
	if cfg.BodyLimitBytes != 1<<20 {
		t.Fatalf("BodyLimitBytes = %d, want %d", cfg.BodyLimitBytes, 1<<20)
	}
	if !cfg.CookieSecure {
		t.Fatal("CookieSecure default should be true")
	}
	if cfg.PrivacyHashSecret != "development" {
		t.Fatalf("PrivacyHashSecret = %q, want development", cfg.PrivacyHashSecret)
	}
}

func TestLoadParsesEnvironment(t *testing.T) {
	t.Setenv("API_ADDR", ":9090")
	t.Setenv("DATABASE_URL", "postgres://example")
	t.Setenv("API_ALLOWED_ORIGINS", " https://bpajor.dev, http://localhost:3000 ,, ")
	t.Setenv("API_BODY_LIMIT_BYTES", "2048")
	t.Setenv("API_COOKIE_SECURE", "false")
	t.Setenv("SESSION_SECRET", "secret")
	t.Setenv("TURNSTILE_SECRET_KEY", "turnstile")

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
	if cfg.CookieSecure {
		t.Fatal("CookieSecure should parse false")
	}
	if cfg.PrivacyHashSecret != "secret" {
		t.Fatalf("PrivacyHashSecret = %q, want secret", cfg.PrivacyHashSecret)
	}
	if cfg.TurnstileSecretKey != "turnstile" {
		t.Fatalf("TurnstileSecretKey = %q, want turnstile", cfg.TurnstileSecretKey)
	}
}

func TestLoadFallsBackOnInvalidValues(t *testing.T) {
	t.Setenv("API_ALLOWED_ORIGINS", " , , ")
	t.Setenv("API_BODY_LIMIT_BYTES", "-1")
	t.Setenv("API_COOKIE_SECURE", "definitely")

	cfg := Load()

	if !reflect.DeepEqual(cfg.AllowedOrigins, []string{"http://localhost:3000"}) {
		t.Fatalf("AllowedOrigins = %#v", cfg.AllowedOrigins)
	}
	if cfg.BodyLimitBytes != 1<<20 {
		t.Fatalf("BodyLimitBytes = %d, want default", cfg.BodyLimitBytes)
	}
	if !cfg.CookieSecure {
		t.Fatal("CookieSecure should fall back to true")
	}
}
