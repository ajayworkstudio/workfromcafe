export type City = {
  id: string;
  name: string;
  slug: string;
  province: string;
  lat: number;
  lng: number;
  is_active: boolean;
};

export type Tag = { id: string; name: string; type: "vibe" | "facility" };

export type Photo = { id: string; url: string; is_cover: boolean; sort_order: number };

export type OpeningHours = Partial<Record<DayKey, [string, string] | null>>;
export type DayKey = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";

export type Cafe = {
  id: string;
  slug: string;
  name: string;
  city_id: string;
  area: string | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
  price_range: number;
  opening_hours: OpeningHours;
  my_rating: number | null;
  short_review: string | null;
  is_featured: boolean;
  is_published: boolean;
  visited_at: string | null;
  created_at: string;
  menu_url?: string | null;
  instagram?: string | null;
  city?: City;
  photos?: Photo[];
  tags?: { tag: Tag }[];
};

export type MenuItem = {
  id: string;
  cafe_id: string;
  name: string;
  price: number | null;
  photo_url: string | null;
  note: string | null;
  is_must_try: boolean;
  sort_order: number;
};

export type CafeDetails = {
  cafe_id: string;
  full_review: string | null;
  tips: string | null;
  best_time: string | null;
};

export type Plan = "monthly" | "yearly";
export type SubPlan = Plan | "trial";
