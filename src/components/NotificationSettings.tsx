"use client";
import { useEffect, useState } from "react";
import Icon from "./Icon";
import { removePushSubscription, savePushSubscription, sendTestPush, setNotifyPrefs } from "@/app/notifikasi/actions";

type State = "checking" | "unsupported" | "ios-browser" | "denied" | "off" | "on" | "no-key";

const KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

function keyBytes(base64: string) {
  const pad = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const isStandalone = () => window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;

/**
 * Pengaturan notifikasi: nyalakan push di perangkat ini (browser atau aplikasi di layar utama),
 * dan pilih jenisnya (kafe baru, aktivitas di kafe yang disimpan).
 */
export default function NotificationSettings({ prefs, compact = false }: { prefs: { newCafe: boolean; activity: boolean }; compact?: boolean }) {
  const [state, setState] = useState<State>("checking");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [p, setP] = useState(prefs);

  useEffect(() => {
    (async () => {
      if (!KEY) return setState("no-key");
      const supported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
      if (!supported) return setState(isIOS() && !isStandalone() ? "ios-browser" : "unsupported");
      if (Notification.permission === "denied") return setState("denied");
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      setState(sub && Notification.permission === "granted" ? "on" : "off");
    })().catch(() => setState("unsupported"));
  }, []);

  async function enable() {
    setBusy(true); setMsg(null);
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") { setState(perm === "denied" ? "denied" : "off"); return; }
      const reg = (await navigator.serviceWorker.getRegistration()) ?? (await navigator.serviceWorker.register("/sw.js"));
      await navigator.serviceWorker.ready;
      const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(KEY) }));
      const res = await savePushSubscription(sub.toJSON() as Parameters<typeof savePushSubscription>[0], navigator.userAgent);
      if (!res.ok) { setMsg({ ok: false, text: res.error }); return; }
      setState("on");
      setMsg({ ok: true, text: "Notifikasi aktif di perangkat ini." });
    } catch (e) {
      setMsg({ ok: false, text: `Gagal menyalakan notifikasi: ${(e as Error).message}` });
    } finally { setBusy(false); }
  }

  async function disable() {
    setBusy(true); setMsg(null);
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      if (sub) { await removePushSubscription(sub.endpoint); await sub.unsubscribe(); }
      setState("off");
      setMsg({ ok: true, text: "Notifikasi di perangkat ini dimatikan." });
    } finally { setBusy(false); }
  }

  async function test() {
    setBusy(true); setMsg(null);
    const res = await sendTestPush();
    setMsg(res.ok ? { ok: true, text: "Notifikasi uji dikirim. Cek sebentar lagi." } : { ok: false, text: res.error });
    setBusy(false);
  }

  async function toggle(k: "newCafe" | "activity") {
    const next = { ...p, [k]: !p[k] };
    setP(next);
    const res = await setNotifyPrefs(next);
    if (!res.ok) { setP(p); setMsg({ ok: false, text: res.error }); }
  }

  return (
    <section aria-labelledby="notif-judul" className="card space-y-4 p-5">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand"><Icon name="bell" className="h-5 w-5" /></span>
        <div className="min-w-0 flex-1">
          <h2 id="notif-judul" className="font-sans text-base font-bold tracking-normal">Notifikasi di perangkat ini</h2>
          <p className="mt-0.5 text-sm text-muted">
            {state === "on" ? "Aktif. Kabar kafe baru dan kondisi di kafe favoritmu muncul di HP atau laptop ini."
              : state === "ios-browser" ? "Di iPhone dan iPad, notifikasi hanya bisa lewat aplikasi di Layar Utama."
              : state === "denied" ? "Notifikasi diblokir di browser ini."
              : state === "unsupported" ? "Browser ini belum mendukung notifikasi. Coba Chrome, Edge, Firefox, atau Safari terbaru."
              : state === "no-key" ? "Notifikasi perangkat belum diatur di server."
              : "Dapat kabar saat ada kafe baru dan saat ada yang melapor kondisi di kafe yang kamu simpan."}
          </p>
        </div>
      </div>

      {state === "ios-browser" && (
        <ol className="list-decimal space-y-1 rounded-2xl bg-tint p-4 pl-8 text-sm">
          <li>Ketuk tombol <b>Bagikan</b> di Safari.</li>
          <li>Pilih <b>Tambah ke Layar Utama</b>, lalu <b>Tambah</b>.</li>
          <li>Buka WFC Hunters dari ikon di Layar Utama, masuk, lalu nyalakan notifikasi di halaman ini.</li>
        </ol>
      )}
      {state === "denied" && (
        <p className="rounded-2xl bg-tint p-4 text-sm">Buka pengaturan situs di browser (ikon gembok di kolom alamat) → Notifikasi → Izinkan, lalu muat ulang halaman ini.</p>
      )}

      <div className="flex flex-wrap gap-2">
        {state === "off" && <button type="button" onClick={enable} disabled={busy} className="btn-primary min-h-11"><Icon name="bell" className="h-4 w-4" />{busy ? "Menyalakan…" : "Nyalakan notifikasi"}</button>}
        {state === "on" && (
          <>
            <button type="button" onClick={test} disabled={busy} className="btn-ghost min-h-11">Kirim notifikasi uji</button>
            <button type="button" onClick={disable} disabled={busy} className="btn-ghost min-h-11 text-muted">Matikan di perangkat ini</button>
          </>
        )}
      </div>
      {msg && <p role="status" className={`text-sm ${msg.ok ? "text-[#2f7049]" : "text-[#b4533a]"}`}>{msg.text}</p>}

      {!compact && (
        <fieldset className="space-y-1 border-t border-line pt-4">
          <legend className="sr-only">Jenis notifikasi</legend>
          {([
            ["newCafe", "Kafe baru", "Saat ada kafe baru yang tayang di WFC Hunters."],
            ["activity", "Kondisi di kafe favorit", "Saat ada yang melapor seramai apa kafe yang kamu simpan dan seberapa kencang wifinya."],
          ] as const).map(([k, label, hint]) => (
            <label key={k} className="flex cursor-pointer items-start justify-between gap-4 rounded-xl py-2">
              <span><span className="block text-sm font-semibold">{label}</span><span className="block text-sm text-muted">{hint}</span></span>
              <input type="checkbox" role="switch" checked={p[k]} onChange={() => toggle(k)} className="mt-1 h-5 w-5 shrink-0 accent-brand" />
            </label>
          ))}
          <p className="pt-1 text-xs text-muted">Pilihan ini berlaku untuk notifikasi di semua perangkatmu.</p>
        </fieldset>
      )}
    </section>
  );
}
