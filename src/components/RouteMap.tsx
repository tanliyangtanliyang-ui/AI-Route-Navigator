import { useEffect, useMemo } from "react";
import type React from "react";
import { OPTION_COLOURS, colourOf } from "@/components/routeColours";
import { along, differingStretches, splitLegs, type LL } from "@/components/routeLegs";
import { MapContainer, TileLayer, Polyline, Marker, Popup, CircleMarker, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Shipment route map for the AI Route Navigator (browser-only; loaded lazily by SelectedShipment).
// Reading aids: the main route (A) is always the thick blue line on top, each of its legs is labelled in driving
// order ("Hub → 1", "1 → 2", "2 → Hub") with an arrowhead; a selected alternative is drawn underneath as an orange/
// purple dashed line, so it only shows where it uses different roads, and those stretches are labelled.
// Recorded points are shown with timestamps and are never a "current" vehicle position.
export type MapOption = { id: string; label: string; distance_km: number; source: string; source_label: string; stop_refs: string[];
  stop_etas: { ref_id: string; eta_at: string; deadline_at: string | null }[]; geometry: { coordinates: [number, number][] } };
export type MapStop = { ref_id: string; name: string; state: string | null; lat: number | null; lng: number | null; kind?: string; kg?: number | null; recorded?: string | null; outcome?: string | null };
export type MapPoint = { lat: number; lng: number; at: string; label: string };

const ROUTE = OPTION_COLOURS.A;
// Standard OpenStreetMap tiles (no key; light use with attribution). Override with VITE_MAP_TILE_URL for another provider.
const TILE_URL = import.meta.env.VITE_MAP_TILE_URL ?? "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const pin = (html: string, w: number, h = w) => L.divIcon({ html, className: "", iconSize: [w, h], iconAnchor: [w / 2, h / 2] });
const hubIcon = pin(`<div style="width:34px;height:34px;border-radius:10px;background:#0f2a2a;color:#5eead4;border:2px solid #5eead4;display:flex;align-items:center;justify-content:center;font:700 11px system-ui">HUB</div>`, 34);
const stopIcon = (n: number, done: boolean) => pin(`<div style="width:30px;height:30px;border-radius:50%;background:${done ? "#16a34a" : "#fff"};color:${done ? "#fff" : "#0f172a"};border:2px solid ${ROUTE};display:flex;align-items:center;justify-content:center;font:700 13px system-ui;box-shadow:0 2px 6px rgba(0,0,0,.35)">${n}</div>`, 30);
// Plain arrowhead (triangle) pointing the way the truck drives.
const arrowHead = (deg: number, colour: string) => pin(`<svg width="18" height="18" viewBox="0 0 18 18" style="transform:rotate(${deg}deg);filter:drop-shadow(0 0 1px rgba(0,0,0,.5))" aria-hidden="true"><path d="M3 3 L15 9 L3 15 Z" fill="${colour}" stroke="#fff" stroke-width="1.5" stroke-linejoin="round"/></svg>`, 18);
// Text label on the route ("Hub → 1"); a pill so it reads at any zoom.
const legLabel = (text: string, colour: string, dashed = false) => {
  const w = Math.max(48, text.length * 7 + 14);
  return pin(`<div style="white-space:nowrap;display:inline-block;padding:1px 7px;border-radius:999px;background:#fff;color:${colour};border:2px ${dashed ? "dashed" : "solid"} ${colour};font:700 11px system-ui;box-shadow:0 1px 3px rgba(0,0,0,.35)">${text}</div>`, w, 20);
};
const myt = (iso: string | null | undefined) => (iso ? `${new Date(iso).toLocaleString("en-GB", { timeZone: "Asia/Kuala_Lumpur", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false })} MYT` : "—");

function Fit({ points }: { points: [number, number][] }) {
  const map = useMap();
  const key = points.map((p) => p.join(",")).join("|");
  useEffect(() => {
    if (points.length === 1) map.setView(points[0], 11, { animate: false });
    else if (points.length > 1) map.fitBounds(L.latLngBounds(points), { padding: [36, 36], animate: false }); // no animation: switching shipments mid-zoom would otherwise throw
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, key]);
  return null;
}

export default function RouteMap({ hub, stops, options, selected, recorded, attribution, live = true }: {
  hub: { name: string; lat: number; lng: number }; stops: MapStop[]; options: MapOption[]; selected: string; recorded: MapPoint[]; attribution?: string; live?: boolean;
}) {
  const main = options.find((o) => o.id === "A") ?? options[0];
  const alt = options.find((o) => o.id === selected && o !== main) ?? null;
  const line = (o: MapOption) => o.geometry.coordinates.map(([lng, lat]) => [lat, lng] as LL);
  // Stops are numbered in the main route's order, so the numbers never change when comparing options.
  const order = main ? main.stop_refs : stops.map((s) => s.ref_id);
  const pts = stops.filter((s) => s.lat != null && s.lng != null).map((s) => ({ ...s, seq: order.indexOf(s.ref_id) + 1 || 0, pos: [s.lat as number, s.lng as number] as LL }))
    .sort((a, b) => a.seq - b.seq);
  const straight: LL[] = [[hub.lat, hub.lng], ...pts.map((s) => s.pos), [hub.lat, hub.lng]];
  const mainLine = main ? line(main) : straight;
  const isRoad = !!main && main.source !== "straight_line_estimate";
  const legs = useMemo(() => (isRoad ? splitLegs(mainLine, pts.map((p) => p.pos)) : straight.slice(1).map((p, i) => [straight[i], p])),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [main?.id, main?.geometry.coordinates.length, pts.length]);
  const legName = (i: number) => `${i === 0 ? "Hub" : i} → ${i === legs.length - 1 ? "Hub" : i + 1}`;
  const altColour = alt ? colourOf(alt.id) : "#64748b";
  const altDiff = useMemo(() => (alt && main ? differingStretches(line(alt), mainLine) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [alt?.id, main?.id]);
  const all = [[hub.lat, hub.lng] as LL, ...pts.map((p) => p.pos), ...recorded.map((r) => [r.lat, r.lng] as LL), ...mainLine, ...(alt ? line(alt) : [])];
  const mainLabel = live ? "Main route (assigned)" : "Main route (recorded stop order)";
  return (
    <div style={{ position: "relative", height: "100%", width: "100%", minHeight: 360 }}>
    <MapContainer center={[hub.lat, hub.lng]} zoom={9} scrollWheelZoom={false} style={{ height: "100%", width: "100%", minHeight: 360 }}>
      <TileLayer attribution={`&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors${attribution ? ` · ${attribution}` : ""}`} url={TILE_URL} maxZoom={19} />
      {/* Selected alternative first (underneath): it is only visible where it leaves the main route. */}
      {alt && (
        <Polyline positions={line(alt)} pathOptions={{ color: altColour, weight: 6, opacity: 0.95, dashArray: "10 8" }}>
          <Popup>Option {alt.id}: {alt.label} · {alt.distance_km} km (comparison only)</Popup>
        </Polyline>
      )}
      {/* Keyed on the selected option so the main route is re-added after it and always stays on top. */}
      <Polyline key={`casing-${alt?.id ?? "none"}`} positions={mainLine} interactive={false} pathOptions={{ color: "#fff", weight: 10, opacity: 0.9 }} />
      <Polyline key={`main-${alt?.id ?? "none"}`} positions={mainLine} pathOptions={{ color: ROUTE, weight: 6, opacity: 1, dashArray: isRoad ? undefined : "6 8" }}>
        <Popup>{mainLabel}: {main ? `${main.distance_km} km · ${main.source_label}` : "stop order (no road route)"}</Popup>
      </Polyline>
      {legs.map((leg, i) => {
        const a = along(leg, 0.55); const l = along(leg, 0.3);
        return [a && <Marker key={`h${i}`} position={a.pos} icon={arrowHead(a.deg, ROUTE)} interactive={false} zIndexOffset={500} />,
          l && <Marker key={`l${i}`} position={l.pos} icon={legLabel(legName(i), ROUTE)} interactive={false} zIndexOffset={600} />];
      })}
      {alt && altDiff.map((run, i) => {
        const a = along(run, 0.6); const l = along(run, 0.35);
        return [a && <Marker key={`ah${i}`} position={a.pos} icon={arrowHead(a.deg, altColour)} interactive={false} zIndexOffset={400} />,
          l && <Marker key={`al${i}`} position={l.pos} icon={legLabel(`${alt.id}: different road`, altColour, true)} interactive={false} zIndexOffset={450} />];
      })}
      {recorded.map((r, i) => (
        <CircleMarker key={i} center={[r.lat, r.lng]} radius={5} pathOptions={{ color: "#f59e0b", fillOpacity: 0.9 }}>
          <Popup>{r.label} · {myt(r.at)}<br />Recorded point, not a current position.</Popup>
        </CircleMarker>
      ))}
      <Marker position={[hub.lat, hub.lng]} icon={hubIcon} zIndexOffset={1000}><Popup><strong>{hub.name}</strong><br />Start and return point</Popup></Marker>
      {pts.map((s) => {
        const eta = main?.stop_etas.find((e) => e.ref_id === s.ref_id);
        const altEta = alt?.stop_etas.find((e) => e.ref_id === s.ref_id);
        return (
          <Marker key={s.ref_id} position={s.pos} icon={stopIcon(s.seq, !!s.outcome)} zIndexOffset={2000}>
            <Popup><strong>Stop {s.seq} · {s.name}</strong><br />{s.state} · {s.kind === "pickup" ? "collection" : "delivery"} {s.ref_id}{s.kg != null ? ` · ${s.kg} kg` : ""}
              {eta && <><br />Calculated ETA (main route): {myt(eta.eta_at)}</>}
              {altEta && <><br />Calculated ETA (option {alt?.id}): {myt(altEta.eta_at)}</>}
              {eta?.deadline_at && <><br />Deadline: {myt(eta.deadline_at)}</>}
              {s.recorded && <><br />Recorded: {s.recorded}</>}</Popup>
          </Marker>
        );
      })}
      <Fit points={all} />
    </MapContainer>
    <MapKey items={[
      { swatch: <Line colour={ROUTE} />, text: mainLabel },
      { swatch: <Head colour={ROUTE} />, text: "Driving direction; labels such as \"Hub → 1\" show each leg in order" },
      ...(alt ? [{ swatch: <Line colour={altColour} dashed />, text: `Option ${alt.id} (comparison only), shown where it uses different roads` }] : options.length > 1 ? [{ swatch: <span />, text: "Choose B or C above the map to compare" }] : []),
      { swatch: <span style={{ display: "inline-flex", width: 16, height: 16, borderRadius: 8, border: `2px solid ${ROUTE}`, background: "#fff", font: "700 9px system-ui", alignItems: "center", justifyContent: "center", color: "#0f172a" }}>1</span>, text: "Stop number (main route order)" },
      ...(recorded.length ? [{ swatch: <span style={{ display: "inline-block", width: 10, height: 10, borderRadius: 5, background: "#f59e0b" }} />, text: "Recorded point (not a current position)" }] : []),
    ]} />
    </div>
  );
}

// On-map key so the symbols explain themselves. The mouse wheel scrolls the page, not the map (scenario finding 2).
function Line({ colour, dashed }: { colour: string; dashed?: boolean }) {
  return <svg width="26" height="8" aria-hidden><line x1="1" y1="4" x2="25" y2="4" stroke={colour} strokeWidth={dashed ? 3 : 5} strokeDasharray={dashed ? "5 4" : undefined} strokeLinecap="round" /></svg>;
}
function Head({ colour }: { colour: string }) {
  return <svg width="16" height="16" viewBox="0 0 18 18" aria-hidden><path d="M3 3 L15 9 L3 15 Z" fill={colour} stroke="#fff" strokeWidth="1.5" /></svg>;
}
function MapKey({ items }: { items: { swatch: React.ReactNode; text: string }[] }) {
  return (
    <div data-testid="map-key" role="note" aria-label="Map key" style={{ position: "absolute", top: 8, right: 8, zIndex: 1000, background: "rgba(255,255,255,.94)", color: "#0f172a", borderRadius: 8, padding: "6px 8px", font: "500 11px/1.35 system-ui", boxShadow: "0 1px 4px rgba(0,0,0,.25)", maxWidth: 250 }}>
      {items.map((it) => <div key={it.text} style={{ display: "flex", alignItems: "center", gap: 6, padding: "1px 0" }}><span style={{ width: 26, display: "inline-flex", justifyContent: "center" }}>{it.swatch}</span>{it.text}</div>)}
      <div style={{ color: "#64748b", marginTop: 2 }}>Zoom with + / − (scrolling moves the page)</div>
    </div>
  );
}
