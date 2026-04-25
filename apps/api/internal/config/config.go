package config

import (
	"os"
	"time"
)

type Config struct {
	Addr              string
	ReadHeaderTimeout time.Duration
}

func Load() Config {
	return Config{
		Addr:              env("API_ADDR", ":8080"),
		ReadHeaderTimeout: 5 * time.Second,
	}
}

func env(key, fallback string) string {
	value := os.Getenv(key)
	if value == "" {
		return fallback
	}
	return value
}
