"use client";
import "leaflet/dist/leaflet.css";
import { MapContainer, TileLayer, CircleMarker, Popup } from "react-leaflet";
import { MAP_CENTER } from "@/lib/region";

export type MapCafe = { slug: string; name: string; lat: number; lng: number; city: string; rating: number | null };

export default function CafeMap({ cafes }: { cafes: MapCafe[] }) {
  return (
    <MapContainer
      center={MAP_CENTER}
      zoom={7}
      bounds={cafes.length > 1 ? cafes.map((c) => [c.lat, c.lng] as [number, number]) : undefined}
      boundsOptions={{ padding: [40, 40], maxZoom: 13 }}
      scrollWheelZoom
      className="h-full w-full"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {cafes.map((c) => (
        <CircleMarker key={c.slug} center={[c.lat, c.lng]} radius={9}
          pathOptions={{ color: "#ffffff", weight: 2, fillColor: "#6b4226", fillOpacity: 1 }}>
          <Popup>
            <strong>{c.name}</strong><br />
            {c.city}{c.rating != null ? `, rating ${c.rating}` : ""}<br />
            <a href={`/kafe/${c.slug}`}>Lihat kafe</a>
          </Popup>
        </CircleMarker>
      ))}
    </MapContainer>
  );
}
