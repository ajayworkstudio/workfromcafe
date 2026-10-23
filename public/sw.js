// Service worker WorkFromCafe: cache aset statis + halaman offline.
// Proses login (/auth, /masuk, ?code=) dan API tidak pernah disentuh supaya redirect login tidak terganggu.
const CACHE = "wfc-v8";
const OFFLINE_URL = "/offline.html";

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll([OFFLINE_URL, "/icons/icon-192.png"])));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))));
  self.clients.claim();
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;

  // Jangan tangani alur login, API, dan file tes kecepatan wifi sama sekali
  if (url.pathname.startsWith("/auth") || url.pathname.startsWith("/masuk") || url.pathname.startsWith("/api") || url.pathname.startsWith("/speedtest") || url.searchParams.has("code")) return;

  // Aset statis Next.js & ikon: cache-first
  if (url.pathname.startsWith("/_next/static") || url.pathname.startsWith("/icons")) {
    e.respondWith(
      caches.match(req).then((hit) => hit || fetch(req).then((res) => {
        if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
        return res;
      }))
    );
    return;
  }

  // Halaman: selalu ke jaringan; halaman offline hanya kalau HP benar-benar tidak ada koneksi
  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req).catch(async (err) => {
        if (self.navigator && self.navigator.onLine === false) return caches.match(OFFLINE_URL);
        throw err;
      })
    );
  }
});

// ===== Notifikasi push (kafe baru, kondisi di kafe favorit) =====
self.addEventListener("push", (e) => {
  let data = {};
  try { data = e.data ? e.data.json() : {}; } catch { data = { title: "WFC Hunters", body: e.data ? e.data.text() : "" }; }
  const title = data.title || "WFC Hunters";
  e.waitUntil(self.registration.showNotification(title, {
    body: data.body || "",
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    tag: data.tag || undefined,
    data: { url: data.url || "/notifikasi" },
  }));
});

// Ketuk notifikasi: buka (atau fokuskan) WFC Hunters di halaman yang dituju
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = new URL((e.notification.data && e.notification.data.url) || "/", self.location.origin).href;
  e.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const w of wins) {
      if (new URL(w.url).origin === self.location.origin && "focus" in w) {
        await w.focus();
        if ("navigate" in w) return w.navigate(url);
        return;
      }
    }
    return self.clients.openWindow(url);
  })());
});
