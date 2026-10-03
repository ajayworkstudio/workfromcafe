/** Ambil koordinat dari link Google Maps atau teks "-6.99, 110.42". */
export function parseCoords(text: string): [number, number] | null {
  const patterns = [
    /!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/, // posisi pin persis
    /@(-?\d+\.\d+),(-?\d+\.\d+)/, // tengah peta
    /[?&](?:q|query|ll|destination)=(-?\d+\.\d+),\s*(-?\d+\.\d+)/,
    /^\s*(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)\s*$/,
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (m) return [Number(m[1]), Number(m[2])];
  }
  return null;
}
