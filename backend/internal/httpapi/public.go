package httpapi

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"net/http"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/lib/pq"
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
// Zona waktu UTC dan extra_float_digits = 0 supaya format tanggal (+00:00) dan angka desimal
// (15 digit, misalnya koordinat) sama persis dengan yang dikirim Supabase.
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
	if _, err := tx.ExecContext(ctx, "set local role anon; set local timezone = 'UTC'; set local extra_float_digits = 0"); err != nil {
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
	if errors.Is(err, sql.ErrNoRows) {
		out, err = nil, nil
	}
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

var uuidRe = regexp.MustCompile(`^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$`)

// Urutan yang dipakai halaman Next.js. Sama dengan PostgREST: DESC tanpa "nulls last" berarti
// NULL di depan (default PostgreSQL). Nama dan id menjadi pemecah seri supaya hasilnya stabil.
var cafeSorts = map[string]string{
	"":        "c.my_rating desc nulls last, c.name, c.id",
	"rating":  "c.my_rating desc nulls last, c.name, c.id",
	"visited": "c.visited_at desc, c.name, c.id",
	"created": "c.created_at desc, c.id",
}

// GET /v1/cafes: daftar kafe tayang. Semua parameter opsional dan bisa digabung:
//
//	kota=semarang        kota aktif (slug tak dikenal diabaikan, sama seperti halaman /kafe)
//	city_id=<uuid>       kota berdasarkan id (halaman kota, area, kafe lain sekota)
//	q=teks  harga=1..4   cari di nama/area/ulasan singkat, kisaran harga
//	slug=a,b  id=x,y     kafe tertentu (kartu di artikel, kondisi terbaru di beranda)
//	exclude=<uuid>       kecualikan satu kafe
//	featured=1           hanya kafe unggulan
//	sort=rating|visited|created   limit=1..200
//
// Filter tag, buka sekarang, dan sepi tetap dihitung di Next.js seperti sekarang.
func (s *Server) listCafes(w http.ResponseWriter, r *http.Request) {
	qs := r.URL.Query()
	bad := func(msg string) { writeJSON(w, http.StatusBadRequest, map[string]string{"error": msg}) }
	var where []string
	var args []any
	arg := func(v any) string { args = append(args, v); return "$" + strconv.Itoa(len(args)) }

	if kota := strings.TrimSpace(qs.Get("kota")); kota != "" {
		if len(kota) > 80 {
			bad("kota terlalu panjang")
			return
		}
		k := arg(kota)
		where = append(where, `(not exists (select 1 from public.cities k where k.slug = `+k+` and k.is_active)
			or c.city_id = (select k.id from public.cities k where k.slug = `+k+` and k.is_active))`)
	}
	if v := qs.Get("city_id"); v != "" {
		if !uuidRe.MatchString(v) {
			bad("city_id tidak valid")
			return
		}
		where = append(where, "c.city_id = "+arg(v)+"::uuid")
	}
	if raw := strings.TrimSpace(qs.Get("q")); raw != "" {
		if len(raw) > 200 {
			bad("q terlalu panjang")
			return
		}
		// Sama dengan Next.js: % , ( ) diganti spasi, lalu dicari di nama, area, dan ulasan singkat
		q := arg("%" + strings.NewReplacer("%", " ", ",", " ", "(", " ", ")", " ").Replace(raw) + "%")
		where = append(where, "(c.name ilike "+q+" or c.area ilike "+q+" or c.short_review ilike "+q+")")
	}
	if v := qs.Get("harga"); v != "" {
		n, err := strconv.Atoi(v)
		if err != nil {
			bad("harga tidak valid")
			return
		}
		where = append(where, "c.price_range = "+arg(n))
	}
	for _, f := range []struct{ name, col, cast string }{{"slug", "c.slug", "text"}, {"id", "c.id", "uuid"}} {
		v := qs.Get(f.name)
		if v == "" {
			continue
		}
		list := strings.Split(v, ",")
		if len(list) > 100 {
			bad(f.name + " terlalu banyak")
			return
		}
		for _, x := range list {
			if (f.cast == "uuid" && !uuidRe.MatchString(x)) || len(x) > 120 || x == "" {
				bad(f.name + " tidak valid")
				return
			}
		}
		where = append(where, f.col+" = any("+arg(pq.Array(list))+"::"+f.cast+"[])")
	}
	if v := qs.Get("exclude"); v != "" {
		if !uuidRe.MatchString(v) {
			bad("exclude tidak valid")
			return
		}
		where = append(where, "c.id <> "+arg(v)+"::uuid")
	}
	if qs.Get("featured") == "1" {
		where = append(where, "c.is_featured")
	}
	order, ok := cafeSorts[qs.Get("sort")]
	if !ok {
		bad("sort tidak dikenal")
		return
	}
	limit := ""
	if v := qs.Get("limit"); v != "" {
		n, err := strconv.Atoi(v)
		if err != nil || n < 1 || n > 200 {
			bad("limit harus 1 sampai 200")
			return
		}
		limit = " limit " + strconv.Itoa(n)
	}
	cond := "true"
	if len(where) > 0 {
		cond = strings.Join(where, " and ")
	}
	s.writePublic(w, r, `select coalesce(jsonb_agg(x.j order by x.rn), '[]'::jsonb) from (
		select row_number() over (order by `+order+`) as rn, `+cafeJSON+` as j
		from public.cafes c where `+cond+` order by `+order+limit+`
	) x`, args...)
}

// GET /v1/stats: jumlah kafe yang terlihat pengunjung (angka di beranda).
func (s *Server) stats(w http.ResponseWriter, r *http.Request) {
	s.writePublic(w, r, `select jsonb_build_object('cafes', (select count(*) from public.cafes))`)
}

// GET /v1/cities/{slug}: satu kota, aktif atau tidak (halaman kota dan area).
func (s *Server) getCity(w http.ResponseWriter, r *http.Request) {
	slug := chi.URLParam(r, "slug")
	if len(slug) > 80 {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "tidak ditemukan"})
		return
	}
	s.writePublic(w, r, `select to_jsonb(c) from public.cities c where c.slug = $1`, slug)
}

// GET /v1/articles: artikel tayang, terbaru dulu (published_at kosong di depan, sama seperti Supabase).
func (s *Server) listArticles(w http.ResponseWriter, r *http.Request) {
	s.writePublic(w, r, `select coalesce(jsonb_agg(to_jsonb(a) order by a.published_at desc, a.id), '[]'::jsonb)
		from public.articles a where a.is_published`)
}

// GET /v1/articles/{slug}: satu artikel tayang.
func (s *Server) getArticle(w http.ResponseWriter, r *http.Request) {
	slug := chi.URLParam(r, "slug")
	if len(slug) > 200 {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "tidak ditemukan"})
		return
	}
	s.writePublic(w, r, `select to_jsonb(a) from public.articles a where a.slug = $1 and a.is_published`, slug)
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
