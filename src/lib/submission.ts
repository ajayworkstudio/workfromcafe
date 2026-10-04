import type { Amenities, Scores } from "./review";
import type { OpeningHours } from "./types";

export type Relation = "pengunjung" | "pemilik" | "karyawan";

export const RELATIONS: { value: Relation; label: string; hint: string }[] = [
  { value: "pengunjung", label: "Pengunjung", hint: "Pernah kerja atau nongkrong di sana" },
  { value: "pemilik", label: "Pemilik / pengelola", hint: "Kafe ini milik atau dikelola kamu" },
  { value: "karyawan", label: "Karyawan", hint: "Kamu bekerja di kafe ini" },
];

export type SubmissionMenuItem = { name: string; price: number | null; note: string | null; is_must_try: boolean };

export type SubmissionData = {
  name: string;
  city_id: string | null;
  city_name: string;
  area: string | null;
  address: string | null;
  maps_link: string | null;
  lat: number | null;
  lng: number | null;
  price_range: number;
  opening_hours: OpeningHours | null;
  menu_url: string | null;
  instagram: string | null;
  short_review: string;
  full_review: string | null;
  tips: string | null;
  best_time: string | null;
  visited_at: string | null;
  relation: Relation;
  scores: Scores;
  amenities: Amenities;
  menu: SubmissionMenuItem[];
  photos: string[];
};

export type Submission = {
  id: string;
  user_id: string;
  author_name: string;
  author_instagram: string | null;
  status: "pending" | "approved" | "rejected";
  data: SubmissionData;
  admin_note: string | null;
  cafe_id: string | null;
  created_at: string;
  reviewed_at: string | null;
};

export const STATUS_META: Record<Submission["status"], { label: string; className: string }> = {
  pending: { label: "Menunggu review", className: "bg-gold/20 text-[#8a5a00]" },
  approved: { label: "Diterima", className: "bg-ok/15 text-ok" },
  rejected: { label: "Belum bisa ditayangkan", className: "bg-[#b4533a]/12 text-[#b4533a]" },
};

export const MAX_PHOTOS = 8;
export const MAX_MENU = 15;
