package config

import (
	"os"
	"strconv"
	"strings"
	"time"
)

type Config struct {
	Addr               string
	DatabaseURL        string
	AllowedOrigins     []string
	BodyLimitBytes     int64
	MediaMaxBytes      int64
	MediaStorageDir    string
	AdminEmail         string
	AdminPassword      string
	CookieSecure       bool
	PrivacyHashSecret  string
	TurnstileSecretKey string
	TurnstileVerifyURL string
	ReadHeaderTimeout  time.Duration
	ReadTimeout        time.Duration
	WriteTimeout       time.Duration
	IdleTimeout        time.Duration
	ShutdownTimeout    time.Duration
}

func Load() Config {
	return Config{
		Addr:               env("API_ADDR", ":8080"),
		DatabaseURL:        env("DATABASE_URL", ""),
		AllowedOrigins:     csvEnv("API_ALLOWED_ORIGINS", []string{"http://localhost:3000"}),
		BodyLimitBytes:     int64Env("API_BODY_LIMIT_BYTES", 8<<20),
		MediaMaxBytes:      int64Env("MEDIA_MAX_BYTES", 5<<20),
		MediaStorageDir:    env("MEDIA_STORAGE_DIR", "/tmp/portfolio-media"),
		AdminEmail:         env("ADMIN_EMAIL", ""),
		AdminPassword:      env("ADMIN_PASSWORD", ""),
		CookieSecure:       boolEnv("API_COOKIE_SECURE", true),
		PrivacyHashSecret:  env("SESSION_SECRET", "development"),
		TurnstileSecretKey: env("TURNSTILE_SECRET_KEY", ""),
		TurnstileVerifyURL: env("TURNSTILE_VERIFY_URL", "https://challenges.cloudflare.com/turnstile/v0/siteverify"),
		ReadHeaderTimeout:  durationSecondsEnv("API_READ_HEADER_TIMEOUT_SECONDS", 5*time.Second),
		ReadTimeout:        durationSecondsEnv("API_READ_TIMEOUT_SECONDS", 120*time.Second),
		WriteTimeout:       durationSecondsEnv("API_WRITE_TIMEOUT_SECONDS", 120*time.Second),
		IdleTimeout:        durationSecondsEnv("API_IDLE_TIMEOUT_SECONDS", 60*time.Second),
		ShutdownTimeout:    durationSecondsEnv("API_SHUTDOWN_TIMEOUT_SECONDS", 10*time.Second),
	}
}

func env(key, fallback string) string {
	value := os.Getenv(key)
	if value == "" {
		return fallback
	}
	return value
}

func csvEnv(key string, fallback []string) []string {
	value := os.Getenv(key)
	if value == "" {
		return fallback
	}

	parts := strings.Split(value, ",")
	out := make([]string, 0, len(parts))
	for _, part := range parts {
		trimmed := strings.TrimSpace(part)
		if trimmed != "" {
			out = append(out, trimmed)
		}
	}
	if len(out) == 0 {
		return fallback
	}
	return out
}

func int64Env(key string, fallback int64) int64 {
	value := os.Getenv(key)
	if value == "" {
		return fallback
	}

	parsed, err := strconv.ParseInt(value, 10, 64)
	if err != nil || parsed <= 0 {
		return fallback
	}
	return parsed
}

func durationSecondsEnv(key string, fallback time.Duration) time.Duration {
	value := os.Getenv(key)
	if value == "" {
		return fallback
	}

	parsed, err := strconv.ParseInt(value, 10, 64)
	if err != nil || parsed <= 0 {
		return fallback
	}
	return time.Duration(parsed) * time.Second
}

func boolEnv(key string, fallback bool) bool {
	value := strings.ToLower(strings.TrimSpace(os.Getenv(key)))
	if value == "" {
		return fallback
	}
	switch value {
	case "1", "true", "yes", "y", "on":
		return true
	case "0", "false", "no", "n", "off":
		return false
	default:
		return fallback
	}
}
