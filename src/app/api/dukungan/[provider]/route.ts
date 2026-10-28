import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/server";
import { cleanText } from "@/lib/supporters";

/*
  Webhook donasi. Setiap ada dukungan baru di Saweria/Trakteer, layanan itu memanggil alamat ini,
  lalu pendukung tercatat di tabel supporters dan muncul di halaman /dukung.
  - Saweria:  POST /api/dukungan/saweria  (header Saweria-Callback-Signature, HMAC-SHA256 dengan Stream Key)
  - Trakteer: POST /api/dukungan/trakteer (header X-Webhook-Token = token webhook dari Trakteer)
  Env: SAWERIA_STREAM_KEY, TRAKTEER_WEBHOOK_TOKEN.
*/

type Raw = Record<string, unknown>;

const same = (a: string, b: string) => {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};

function fromSaweria(req: Request, body: Raw) {
  const key = process.env.SAWERIA_STREAM_KEY;
  if (!key) return { status: 503, error: "SAWERIA_STREAM_KEY belum diisi." } as const;
  const sig = req.headers.get("saweria-callback-signature") ?? "";
  // Data yang ditandatangani Saweria: version + id + amount_raw + donator_name + donator_email
  const data = ["version", "id", "amount_raw", "donator_name", "donator_email"].map((k) => body[k] ?? "").join("");
  if (!sig || !same(createHmac("sha256", key).update(data).digest("hex"), sig)) return { status: 401, error: "Tanda tangan tidak valid." } as const;
  if (body.type && body.type !== "donation") return { status: 200, skip: true } as const;
  return {
    status: 200,
    row: {
      source: "saweria", external_id: String(body.id ?? "") || null,
      name: cleanText(body.donator_name, 60) ?? "Seseorang", message: cleanText(body.message, 240),
      amount: Number(body.amount_raw) || null, email: cleanText(body.donator_email, 160),
      created_at: typeof body.created_at === "string" ? body.created_at : undefined,
    },
  } as const;
}

function fromTrakteer(req: Request, body: Raw) {
  const token = process.env.TRAKTEER_WEBHOOK_TOKEN;
  if (!token) return { status: 503, error: "TRAKTEER_WEBHOOK_TOKEN belum diisi." } as const;
  if (!same(req.headers.get("x-webhook-token") ?? "", token)) return { status: 401, error: "Token tidak valid." } as const;
  return {
    status: 200,
    row: {
      source: "trakteer", external_id: String(body.transaction_id ?? "") || null,
      name: cleanText(body.supporter_name, 60) ?? "Seseorang", message: cleanText(body.supporter_message, 240),
      amount: Number(body.price) || null, email: null,
      created_at: typeof body.created_at === "string" ? body.created_at : undefined,
    },
  } as const;
}

export async function POST(req: Request, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  let body: Raw;
  try { body = (await req.json()) as Raw; } catch { return NextResponse.json({ error: "Body bukan JSON." }, { status: 400 }); }

  const res = provider === "saweria" ? fromSaweria(req, body) : provider === "trakteer" ? fromTrakteer(req, body) : { status: 404, error: "Tidak dikenal." } as const;
  if ("error" in res) return NextResponse.json({ error: res.error }, { status: res.status });
  if ("skip" in res) return NextResponse.json({ ok: true, skipped: true });

  const { error } = await createAdminClient().from("supporters").insert({ ...res.row, raw: body });
  // 23505 = sudah tercatat (webhook dikirim ulang): anggap berhasil
  if (error && error.code !== "23505") {
    console.error("[dukungan]", provider, error.message);
    return NextResponse.json({ error: "Gagal menyimpan." }, { status: 500 });
  }
  revalidatePath("/dukung");
  return NextResponse.json({ ok: true });
}
