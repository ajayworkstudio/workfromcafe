"use client";
import "leaflet/dist/leaflet.css";
import { MapContainer, TileLayer, CircleMarker, Popup } from "react-leaflet";

export type MapCafe = { slug: string; name: string; lat: number; lng: number; city: string; rating: number | null };

export default function CafeMap({ cafes }: { cafes: MapCafe[] }) {
  return (
    <MapContainer center={[-7.15, 110.14]} zoom={8} scrollWheelZoom className="h-full w-full">
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {cafes.map((c) => (
        <CircleMarker key={c.slug} center={[c.lat, c.lng]} radius={9}
          pathOptions={{ color: "#fffaf3", weight: 2, fillColor: "#c2552d", fillOpacity: 1 }}>
          <Popup>
            <strong>{c.name}</strong><br />
            {c.city}{c.rating != null ? ` · ★ ${c.rating}` : ""}<br />
            <a href={`/kafe/${c.slug}`}>Lihat detail →</a>
          </Popup>
        </CircleMarker>
      ))}
    </MapContainer>
  );
}
