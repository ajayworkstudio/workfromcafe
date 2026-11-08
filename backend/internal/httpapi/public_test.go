package httpapi

import (
	"database/sql"
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"

	"github.com/ajayworkstudio/workfromcafe/backend/internal/database"
)

// Tes ini butuh PostgreSQL berisi db/00_supabase_shim.sql, db/schema.sql, dan db/01_grants.sql.
//   TEST_DATABASE_URL: koneksi sebagai wfc_api (peran yang dipakai API)
//   TEST_ADMIN_URL:    koneksi superuser, untuk menyiapkan data uji
// Tanpa keduanya, tes dilewati.

const (
	cafePublished = "00000000-0000-0000-0000-0000000000a1"
	cafeHidden    = "00000000-0000-0000-0000-0000000000a2"
	citySemarang  = "6af85a6e-74c7-44ee-8a4d-a8435c742ed8"
)

func setupPublic(t *testing.T) (http.Handler, *sql.DB) {
	t.Helper()
	apiURL, adminURL := os.Getenv("TEST_DATABASE_URL"), os.Getenv("TEST_ADMIN_URL")
	if apiURL == "" || adminURL == "" {
		t.Skip("TEST_DATABASE_URL dan TEST_ADMIN_URL belum diisi")
	}
	admin, err := sql.Open("postgres", adminURL)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { admin.Close() })
	mustExec(t, admin, `
		delete from public.cafes where id in ('`+cafePublished+`', '`+cafeHidden+`');
		insert into public.cities (id, name, slug, province, lat, lng, is_active)
		  values ('`+citySemarang+`', 'Semarang', 'semarang', 'Jawa Tengah', -6.9932, 110.4203, true)
		  on conflict (id) do nothing;
		insert into public.cafes (id, name, slug, city_id, is_published, my_rating, area, short_review, price_range, created_at)
		  values ('`+cafePublished+`', 'Kafe Uji Tayang', 'kafe-uji-tayang', '`+citySemarang+`', true, 4.5, 'Tembalang', 'Colokan banyak', 2, '2026-10-01 10:00:00+07'),
		         ('`+cafeHidden+`', 'Kafe Uji Draf', 'kafe-uji-draf', '`+citySemarang+`', false, 4.9, 'Tembalang', 'Belum tayang', 2, '2026-10-01 10:00:00+07');
		insert into public.cafe_photos (cafe_id, url, is_cover, sort_order) values ('`+cafePublished+`', 'https://contoh.test/a.webp', true, 0);
		insert into public.cafe_tags (cafe_id, tag_id) select '`+cafePublished+`', id from public.tags where name = 'WFC';
		insert into public.cafe_details (cafe_id, full_review, tips) values ('`+cafePublished+`', 'Ulasan lengkap', 'Duduk dekat jendela'),
		                                                                  ('`+cafeHidden+`', 'Rahasia', null);
		insert into public.menu_items (cafe_id, name, price, sort_order) values ('`+cafePublished+`', 'Es kopi susu', 22000, 1),
		                                                                       ('`+cafePublished+`', 'Americano', 18000, 0);
		update public.app_settings set value = 'true' where key = 'free_mode';`)
	t.Cleanup(func() {
		mustExec(t, admin, `delete from public.cafes where id in ('`+cafePublished+`', '`+cafeHidden+`');
			update public.app_settings set value = 'true' where key = 'free_mode';`)
	})

	db, err := database.Open(t.Context(), apiURL)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { db.Close() })
	s := &Server{DB: db, Log: slog.New(slog.NewTextHandler(io.Discard, nil))}
	return s.Routes(), admin
}

func mustExec(t *testing.T, db *sql.DB, q string) {
	t.Helper()
	if _, err := db.Exec(q); err != nil {
		t.Fatal(err)
	}
}

func get(t *testing.T, h http.Handler, path string) (int, []byte) {
	t.Helper()
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, path, nil))
	return rec.Code, rec.Body.Bytes()
}

type cafeOut struct {
	ID        string `json:"id"`
	Slug      string `json:"slug"`
	CreatedAt string `json:"created_at"`
	City      *struct {
		Slug string `json:"slug"`
	} `json:"city"`
	Photos []map[string]any `json:"photos"`
	Tags   []struct {
		Tag struct {
			Name string `json:"name"`
		} `json:"tag"`
	} `json:"tags"`
}

func slugs(t *testing.T, body []byte) []string {
	t.Helper()
	var list []cafeOut
	if err := json.Unmarshal(body, &list); err != nil {
		t.Fatalf("bukan daftar kafe: %s", body)
	}
	var out []string
	for _, c := range list {
		out = append(out, c.Slug)
	}
	return out
}

func TestListCafesOnlyPublished(t *testing.T) {
	h, _ := setupPublic(t)
	code, body := get(t, h, "/v1/cafes")
	if code != 200 {
		t.Fatalf("status %d: %s", code, body)
	}
	got := strings.Join(slugs(t, body), ",")
	if !strings.Contains(got, "kafe-uji-tayang") || strings.Contains(got, "kafe-uji-draf") {
		t.Fatalf("daftar kafe = %s, mau ada yang tayang dan tanpa draf", got)
	}
}

func TestListCafesShapeMatchesSupabase(t *testing.T) {
	h, _ := setupPublic(t)
	_, body := get(t, h, "/v1/cafes?q=uji%20tayang")
	var list []cafeOut
	if err := json.Unmarshal(body, &list); err != nil || len(list) != 1 {
		t.Fatalf("mau 1 kafe, dapat %s", body)
	}
	c := list[0]
	if c.City == nil || c.City.Slug != "semarang" {
		t.Errorf("city = %+v", c.City)
	}
	if len(c.Photos) != 1 || len(c.Tags) != 1 || c.Tags[0].Tag.Name != "WFC" {
		t.Errorf("photos/tags = %v / %+v", c.Photos, c.Tags)
	}
	if !strings.HasSuffix(c.CreatedAt, "+00:00") {
		t.Errorf("created_at = %s, mau zona UTC seperti Supabase", c.CreatedAt)
	}
}

func TestListCafesFilters(t *testing.T) {
	h, _ := setupPublic(t)
	cases := map[string]bool{ // path -> kafe uji harus ada
		"/v1/cafes?kota=semarang":        true,
		"/v1/cafes?kota=kota-tidak-ada":  true, // kota tak dikenal: filter diabaikan, sama seperti Next.js
		"/v1/cafes?kota=jakarta":         false,
		"/v1/cafes?harga=2":              true,
		"/v1/cafes?harga=1":              false,
		"/v1/cafes?q=colokan":            true, // cari di ulasan singkat
		"/v1/cafes?q=tidak-ada-kafe-ini": false,
		"/v1/cafes?q=tem%25lang":         false, // % bukan wildcard: diganti spasi seperti di Next.js
	}
	for path, want := range cases {
		_, body := get(t, h, path)
		has := strings.Contains(strings.Join(slugs(t, body), ","), "kafe-uji-tayang")
		if has != want {
			t.Errorf("%s: ada kafe uji = %v, mau %v", path, has, want)
		}
	}
}

func TestGetCafe(t *testing.T) {
	h, admin := setupPublic(t)

	code, body := get(t, h, "/v1/cafes/kafe-uji-draf")
	if code != 404 || strings.Contains(string(body), "Rahasia") {
		t.Fatalf("kafe draf: status %d, body %s", code, body)
	}

	code, body = get(t, h, "/v1/cafes/kafe-uji-tayang")
	if code != 200 {
		t.Fatalf("status %d: %s", code, body)
	}
	var res struct {
		Cafe    cafeOut          `json:"cafe"`
		Details map[string]any   `json:"details"`
		Menu    []map[string]any `json:"menu"`
	}
	if err := json.Unmarshal(body, &res); err != nil {
		t.Fatal(err)
	}
	if res.Cafe.ID != cafePublished || res.Details["full_review"] != "Ulasan lengkap" {
		t.Errorf("cafe/details = %s / %v", res.Cafe.ID, res.Details)
	}
	if len(res.Menu) != 2 || res.Menu[0]["name"] != "Americano" {
		t.Errorf("menu harus urut sort_order: %v", res.Menu)
	}

	// Mode gratis mati: pengunjung tanpa login tidak boleh melihat ulasan lengkap dan menu
	mustExec(t, admin, `update public.app_settings set value = 'false' where key = 'free_mode'`)
	_, body = get(t, h, "/v1/cafes/kafe-uji-tayang")
	if err := json.Unmarshal(body, &res); err != nil {
		t.Fatal(err)
	}
	if res.Details != nil || len(res.Menu) != 0 {
		t.Errorf("mode berbayar: details = %v, menu = %v, mau kosong", res.Details, res.Menu)
	}
}

func TestCitiesSortedAndActive(t *testing.T) {
	h, _ := setupPublic(t)
	_, body := get(t, h, "/v1/cities")
	var list []struct {
		Name     string `json:"name"`
		IsActive bool   `json:"is_active"`
	}
	if err := json.Unmarshal(body, &list); err != nil || len(list) == 0 {
		t.Fatalf("cities: %s", body)
	}
	for i, c := range list {
		if !c.IsActive || (i > 0 && list[i-1].Name > c.Name) {
			t.Fatalf("urutan/aktif salah di %d: %+v", i, list)
		}
	}
}
