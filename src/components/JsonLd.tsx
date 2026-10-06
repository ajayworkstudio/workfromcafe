/** Data terstruktur schema.org untuk Google (rich results). */
export default function JsonLd({ data }: { data: unknown }) {
  return (
    <script
      type="application/ld+json"
      // Escape "<" supaya isi teks pengguna tidak bisa menutup tag <script>
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
    />
  );
}
