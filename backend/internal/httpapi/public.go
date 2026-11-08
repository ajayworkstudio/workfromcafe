package httpapi

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
)

// cafeJSON membentuk satu kafe persis seperti select Supabase
// "*, city:cities(*), photos:cafe_photos(*), tags:cafe_tags(tag:tags(*))" (CAFE_LIST_SELECT di Next.js).
const cafeJSON = `to_jsonb(c) || jsonb_build_object(
  'city', (select to_jsonb(ci) from public.cities ci where ci.id = c.city_id),
  'photos', coalesce((select jsonb_agg(to_jsonb(p)) from public.cafe_photos p where p.cafe_id = c.id), '[]'::jsonb),
  'tags', coalesce((select jsonb_agg(jsonb_build_object('tag', to_jsonb(t)))
                    from public.cafe_tags ct join public.tags t on t.id = ct.tag_id where ct.cafe_id = c.id), '[]'::jsonb))`

// publicJSON menjalankan query yang menghasilkan satu nilai JSON sebagai peran anon,
// jadi policy RLS berlaku sama seperti pengunjung yang belum login di Supabase.
// Zona waktu UTC supaya format tanggal sama dengan Supabase (+00:00).
func (s *Server) publicJSON(ctx context.Context, query string, args ...any) (json.RawMessage, error) {
	if s.DB == nil {
		return nil, errNoDB
	}
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()
	tx, err := s.DB.BeginTx(ctx, &sql.TxOptions{ReadOnly: true})
	if err != nil {
		return nil, err
	}
	defer tx.Rollback() //nolint:errcheck // hanya baca, rollback cukup
	if _, err := tx.ExecContext(ctx, "set local role anon; set local timezone = 'UTC'"); err != nil {
		return nil, err
	}
	var out []byte
	if err := tx.QueryRowContext(ctx, query, args...).Scan(&out); err != nil {
		return nil, err
	}
	return out, nil
}

var errNoDB = errors.New("database belum diatur")

func (s *Server) writePublic(w http.ResponseWriter, r *http.Request, query string, args ...any) {
	out, err := s.publicJSON(r.Context(), query, args...)
	if err != nil {
		s.Log.Error("query publik gagal", "path", r.URL.Path, "err", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "gagal memuat data"})
		return
	}
	if out == nil || string(out) == "null" { // NULL dari SQL atau null JSON: data tidak ada atau disembunyikan RLS
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "tidak ditemukan"})
		return
	}
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.Header().Set("Cache-Control", "public, max-age=30")
	_, _ = w.Write(out)
}

// GET /v1/cities: kota aktif, urut nama.
func (s *Server) listCities(w http.ResponseWriter, r *http.Request) {
	s.writePublic(w, r, `select coalesce(jsonb_agg(to_jsonb(c) order by c.name), '[]'::jsonb)
		from public.cities c where c.is_active`)
}

// GET /v1/tags: semua tag, urut nama.
func (s *Server) listTags(w http.ResponseWriter, r *http.Request) {
	s.writePublic(w, r, `select coalesce(jsonb_agg(to_jsonb(t) order by t.name), '[]'::jsonb) from public.tags t`)
}

// GET /v1/cafes?kota=&q=&harga=: sama dengan query daftar kafe di halaman /kafe.
// Filter tag, buka sekarang, dan sepi tetap dihitung di Next.js seperti sekarang.
func (s *Server) listCafes(w http.ResponseWriter, r *http.Request) {
	qs := r.URL.Query()
	kota := strings.TrimSpace(qs.Get("kota"))
	q := ""
	if raw := strings.TrimSpace(qs.Get("q")); raw != "" {
		// Sama dengan Next.js: % , ( ) diganti spasi, lalu dicari di nama, area, dan ulasan singkat
		q = "%" + strings.NewReplacer("%", " ", ",", " ", "(", " ", ")", " ").Replace(raw) + "%"
	}
	harga, _ := strconv.Atoi(qs.Get("harga"))
	if len(kota) > 80 || len(q) > 200 {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "parameter terlalu panjang"})
		return
	}
	s.writePublic(w, r, `select coalesce(jsonb_agg(x.j order by x.my_rating desc nulls last, x.name), '[]'::jsonb) from (
		select c.my_rating, c.name, `+cafeJSON+` as j
		from public.cafes c
		where ($1 = '' or not exists (select 1 from public.cities k where k.slug = $1 and k.is_active)
		       or c.city_id = (select k.id from public.cities k where k.slug = $1 and k.is_active))
		  and ($2 = '' or c.name ilike $2 or c.area ilike $2 or c.short_review ilike $2)
		  and ($3 = 0 or c.price_range = $3)
	) x`, kota, q, harga)
}

// GET /v1/cafes/{slug}: kafe, detail ulasan, dan menu. Detail dan menu ikut aturan RLS
// (misalnya hanya tampil kalau mode gratis atau kafe sudah dibuka).
func (s *Server) getCafe(w http.ResponseWriter, r *http.Request) {
	slug := chi.URLParam(r, "slug")
	if slug == "" || len(slug) > 120 {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "tidak ditemukan"})
		return
	}
	s.writePublic(w, r, `select case when c.id is null then null else jsonb_build_object(
		'cafe', `+cafeJSON+`,
		'details', (select to_jsonb(d) from public.cafe_details d where d.cafe_id = c.id),
		'menu', coalesce((select jsonb_agg(to_jsonb(m) order by m.sort_order) from public.menu_items m where m.cafe_id = c.id), '[]'::jsonb)
	) end
	from (select 1) one left join public.cafes c on c.slug = $1`, slug)
}
