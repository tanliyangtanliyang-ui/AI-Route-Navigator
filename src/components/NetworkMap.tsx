import { useEffect } from "react";
import type React from "react";
import { MapContainer, TileLayer, Polyline, Marker, CircleMarker, Tooltip, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Network Explorer map (browser-only; loaded lazily). Real hubs, farms and buyers from the dataset.
// Lines are supply / delivery connections, drawn straight on purpose: they are not road routes.
export type Place = { id: string; kind: "hub" | "farm" | "buyer"; name: string; state: string; lat: number; lng: number };
export type Link = { from: string; to: string; kind: "supply" | "delivery"; count: number; kg: number };

const TILE_URL = import.meta.env.VITE_MAP_TILE_URL ?? "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
export const KIND_COLOUR = { hub: "#0f2a2a", farm: "#16a34a", buyer: "#1d4ed8" } as const;
const hubIcon = (selected: boolean) => L.divIcon({ className: "", iconSize: [40, 40], iconAnchor: [20, 20],
  html: `<div style="width:40px;height:40px;border-radius:10px;background:#0f2a2a;color:#5eead4;border:${selected ? "3px solid #f59e0b" : "2px solid #5eead4"};display:flex;align-items:center;justify-content:center;font:700 11px system-ui;box-shadow:0 2px 6px rgba(0,0,0,.35);cursor:pointer">HUB</div>` });

function Fit({ points }: { points: [number, number][] }) {
  const map = useMap();
  useEffect(() => { if (points.length) map.fitBounds(L.latLngBounds(points), { padding: [40, 40], animate: false }); /* once; no animation so closing right away is safe */ // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map]);
  return null;
}

export default function NetworkMap({ places, links, selected, onSelect }: { places: Place[]; links: Link[]; selected: string | null; onSelect: (id: string) => void }) {
  const byId = new Map(places.map((p) => [p.id, p]));
  const related = (l: Link) => selected != null && (l.from === selected || l.to === selected);
  const ordered = [...links].sort((a, b) => Number(related(a)) - Number(related(b)));
  return (
    <div style={{ position: "relative", height: "100%", width: "100%", minHeight: 360 }}>
      <MapContainer center={[4.2, 101.9]} zoom={7} scrollWheelZoom style={{ height: "100%", width: "100%", minHeight: 360 }}>
        <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url={TILE_URL} maxZoom={19} />
        {ordered.map((l) => {
          const a = byId.get(l.from); const b = byId.get(l.to); if (!a || !b) return null;
          const on = related(l);
          return <Polyline key={`${l.from}-${l.to}`} positions={[[a.lat, a.lng], [b.lat, b.lng]]} interactive={false}
            pathOptions={{ color: l.kind === "supply" ? KIND_COLOUR.farm : KIND_COLOUR.buyer, weight: on ? 4 : 2, opacity: selected ? (on ? 0.9 : 0.12) : 0.35, dashArray: l.kind === "supply" ? "4 6" : undefined }} />;
        })}
        {places.filter((p) => p.kind !== "hub").map((p) => (
          <CircleMarker key={p.id} center={[p.lat, p.lng]} radius={p.id === selected ? 11 : 8} eventHandlers={{ click: () => onSelect(p.id) }}
            pathOptions={{ color: p.id === selected ? "#f59e0b" : "#fff", weight: p.id === selected ? 3 : 2, fillColor: KIND_COLOUR[p.kind], fillOpacity: 0.95 }}>
            <Tooltip direction="top" offset={[0, -6]}>{p.name} · {p.state}</Tooltip>
          </CircleMarker>
        ))}
        {places.filter((p) => p.kind === "hub").map((p) => (
          <Marker key={p.id} position={[p.lat, p.lng]} icon={hubIcon(p.id === selected)} zIndexOffset={1000} eventHandlers={{ click: () => onSelect(p.id) }}>
            <Tooltip direction="top" offset={[0, -20]}>{p.name}</Tooltip>
          </Marker>
        ))}
        <Fit points={places.map((p) => [p.lat, p.lng])} />
      </MapContainer>
      <div data-testid="network-key" role="note" aria-label="Map key" style={{ position: "absolute", bottom: 24, right: 8, zIndex: 1000, background: "rgba(255,255,255,.94)", color: "#0f172a", borderRadius: 8, padding: "6px 8px", font: "500 11px/1.4 system-ui", boxShadow: "0 1px 4px rgba(0,0,0,.25)" }}>
        <KeyRow swatch={<span style={{ display: "inline-block", width: 14, height: 14, borderRadius: 4, background: KIND_COLOUR.hub, border: "2px solid #5eead4" }} />} text="Consolidation hub" />
        <KeyRow swatch={<Dot c={KIND_COLOUR.farm} />} text="Farm (supplies a hub)" />
        <KeyRow swatch={<Dot c={KIND_COLOUR.buyer} />} text="Buyer (receives deliveries)" />
        <KeyRow swatch={<svg width="22" height="6" aria-hidden><line x1="1" y1="3" x2="21" y2="3" stroke={KIND_COLOUR.farm} strokeWidth="2" strokeDasharray="4 3" /></svg>} text="Farm → hub supply link" />
        <KeyRow swatch={<svg width="22" height="6" aria-hidden><line x1="1" y1="3" x2="21" y2="3" stroke={KIND_COLOUR.buyer} strokeWidth="2" /></svg>} text="Hub → buyer delivery link" />
        <div style={{ color: "#64748b", marginTop: 2 }}>Straight lines = who works with whom, not roads</div>
      </div>
    </div>
  );
}
const Dot = ({ c }: { c: string }) => <span style={{ display: "inline-block", width: 12, height: 12, borderRadius: 6, background: c, border: "2px solid #fff", boxShadow: "0 0 0 1px rgba(0,0,0,.25)" }} />;
function KeyRow({ swatch, text }: { swatch: React.ReactNode; text: string }) {
  return <div style={{ display: "flex", alignItems: "center", gap: 6 }}><span style={{ width: 22, display: "inline-flex", justifyContent: "center" }}>{swatch}</span>{text}</div>;
}
