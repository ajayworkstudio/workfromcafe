package database

import (
	"context"
	"database/sql"
	"time"

	_ "github.com/lib/pq"
)

// Open membuka pool koneksi PostgreSQL dan memastikan database bisa dijangkau.
func Open(ctx context.Context, url string) (*sql.DB, error) {
	db, err := sql.Open("postgres", url)
	if err != nil {
		return nil, err
	}
	// Batas kecil supaya muat di VPS 1 GB dan tidak menghabiskan jatah koneksi Postgres terkelola.
	db.SetMaxOpenConns(10)
	db.SetMaxIdleConns(5)
	db.SetConnMaxIdleTime(5 * time.Minute)

	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()
	if err := db.PingContext(ctx); err != nil {
		db.Close()
		return nil, err
	}
	return db, nil
}
