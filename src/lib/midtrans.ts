import crypto from "crypto";

const isProd = process.env.MIDTRANS_IS_PRODUCTION === "true";
export const SNAP_API = isProd
  ? "https://app.midtrans.com/snap/v1/transactions"
  : "https://app.sandbox.midtrans.com/snap/v1/transactions";
export const SNAP_JS = isProd
  ? "https://app.midtrans.com/snap/snap.js"
  : "https://app.sandbox.midtrans.com/snap/snap.js";

const authHeader = () => "Basic " + Buffer.from(`${process.env.MIDTRANS_SERVER_KEY}:`).toString("base64");

export async function createSnapTransaction(payload: Record<string, unknown>) {
  const res = await fetch(SNAP_API, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json", Authorization: authHeader() },
    body: JSON.stringify(payload),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error_messages?.join(", ") || "Gagal membuat transaksi Midtrans");
  return json as { token: string; redirect_url: string };
}

/** Verifikasi signature notifikasi: SHA512(order_id + status_code + gross_amount + server_key) */
export function verifySignature(n: { order_id: string; status_code: string; gross_amount: string; signature_key: string }) {
  const expected = crypto
    .createHash("sha512")
    .update(n.order_id + n.status_code + n.gross_amount + process.env.MIDTRANS_SERVER_KEY)
    .digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(n.signature_key ?? "");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
