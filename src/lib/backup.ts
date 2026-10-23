/** Tabel yang ikut di-backup dari Admin → Backup (urutan = urutan restore yang aman). */
export const BACKUP_TABLES = [
  "app_settings", "cities", "tags", "cafes", "cafe_details", "cafe_photos", "menu_items", "cafe_tags",
  "profiles", "favorites", "user_visits", "cafe_unlocks", "subscriptions", "payments",
  "cafe_submissions", "cafe_comments", "cafe_reports", "events", "contact_messages", "notifications",
] as const;
