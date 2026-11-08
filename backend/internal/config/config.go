package config

import (
	"fmt"
	"os"
	"strings"
)

type Config struct {
	Host           string // kosong = semua alamat; di VPS 127.0.0.1 supaya hanya bisa diakses lewat Caddy
	Port           string
	DatabaseURL    string // kosong = API jalan tanpa database (hanya untuk tes lokal)
	AllowedOrigins []string
}

func Load() (Config, error) {
	c := Config{
		Host:        os.Getenv("HOST"),
		Port:        getenv("PORT", "8080"),
		DatabaseURL: os.Getenv("DATABASE_URL"),
	}
	for _, o := range strings.Split(getenv("ALLOWED_ORIGINS", "https://www.wfchunters.com,http://localhost:3000"), ",") {
		if o = strings.TrimSpace(o); o != "" {
			c.AllowedOrigins = append(c.AllowedOrigins, o)
		}
	}
	if strings.ContainsAny(c.Port, " :/") {
		return c, fmt.Errorf("PORT tidak valid: %q", c.Port)
	}
	return c, nil
}

func getenv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
