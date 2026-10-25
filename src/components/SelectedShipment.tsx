import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import { AlertTriangle, MapPin, Package, Route as RouteIcon, Snowflake, Truck, User, RefreshCw } from "lucide-react";
import { ExplorationModeButton } from "@/components/NetworkExplorer";
import type { MapOption } from "@/components/RouteMap";
import { colourOf } from "@/components/routeColours";

// Leaflet needs a browser; the map is loaded only after the page has mounted on the client.
const RouteMap = lazy(() => import("@/components/RouteMap"));
type RoadOption = MapOption & { kind: string; drive_minutes: number; total_minutes: number; service_minutes_per_stop: number; end_at: string; meets_deadlines: boolean; late_refs: string[];
  after_working_day: string | null; stop_names: string[]; vs_assigned: { distance_km: number; drive_minutes: number; total_minutes: number } | null; fetched_at: string | null };
type RoadRoute = { start_at: string; options: RoadOption[]; fallback_note: string | null; road_routing: { attribution: string; note: string };
  dispatch_estimate?: { distance_km: number; minutes: number; basis: string }; recorded?: { actual_distance_km: number | null; planned_distance_km: number | null; basis: string } };

// Shipment selector + everything the Navigator knows about the selected shipment, from the shared FarmXpress API.
// Live dispatches (DSP-…) are the same records the Driver Portal shows; the historical SHP-000006 record stays available.
// Changing the selection clears the previous shipment's data before the new one loads, so nothing stale is shown.
const API = import.meta.env.VITE_FARMXPRESS_API_BASE_URL ?? "http://127.0.0.1:4000/v1";
const HISTORICAL_DEMO = "SHP-000006";

type Summary = { shipment_id: string; job_type: string; status: string; status_label: string; hub_id: string; driver_id: string; driver_name: string | null; vehicle_id: string; planned_start_at: string; destinations: string[] };
type Stop = { stop_id: string; sequence: number; kind?: string; order_id: string; buyer_name: string; buyer_state: string; lat: number | null; lng: number | null; eta_at: string | null; arrived_at: string | null; deadline_at?: string | null; kg?: number; delivered_kg: number | null; status: string;
  delivery_status?: string | null; rejected_kg?: number | null; rejection_reason?: string | null; completed_at?: string | null };
type Journey = {
  shipment: { shipment_id: string; status: string; status_label?: string; hub_id: string; hub_name: string; hub_state: string; hub_lat: number | null; hub_lng: number | null; vehicle_id: string; vehicle_plate: string; vehicle_type: string; vehicle_capacity_kg: number;
    driver_id: string; driver_name: string; loaded_kg: number; planned_distance_km: number | null; planned_minutes: number | null; actual_distance_km: number | null; planned_start_at: string | null; planned_end_at: string | null;
    weather_input: string | null; traffic_input: string | null; data_origin?: string; route_type?: string; route_type_label?: string; required_licences?: string[]; route_version?: number; utilisation_pct?: number; job_type?: string; dispatch_explanation?: string[] };
  stops: Stop[]; cargo: { product_id: string; product_name: string; storage_class: string; temp_min_c: number; temp_max_c: number; kg: number }[];
  observations: { observed_at: string; lat: number | null; lng: number | null; quality: string }[];
  telemetry: { safe_band_c: { min: number; max: number } | null; source: string; gps_points: number };
  issues?: { issue_id: string; kind: string; description: string; status: string; reported_at: string; resolution_note: string | null }[];
  check_ins?: { lat: number; lng: number; source: string; recorded_at: string }[];
  route_versions?: { version: number; reason: string; approved_by: string; approved_at: string }[];
  deviation?: Deviation;
};
type Deviation = { status: string; message: string; tolerance_km: number; data_source: string };

const isLive = (id: string) => id.startsWith("DSP-");
const myt = (iso: string | null | undefined) => (iso ? `${new Date(iso).toLocaleString("en-GB", { timeZone: "Asia/Kuala_Lumpur", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false })} MYT` : "not recorded");
async function get<T>(path: string, signal?: AbortSignal): Promise<T> {
  const r = await fetch(`${API}${path}`, { signal });
  const b = await r.json().catch(() => null);
  if (!r.ok) throw new Error(b?.error?.message ?? `API ${r.status}`);
  return b as T;
}
const readHash = () => (typeof window === "undefined" ? null : new URLSearchParams(window.location.hash.slice(1)).get("shipment"));

function useSelection(list: Summary[] | null) {
  const [id, setId] = useState<string | null>(null);
  useEffect(() => {
    if (id) return;
    const fromHash = readHash();
    if (fromHash) { setId(fromHash); return; }
    if (list) setId(list.find((s) => s.status === "assigned" || s.status === "in_progress")?.shipment_id ?? HISTORICAL_DEMO);
  }, [list, id]);
  useEffect(() => { const f = () => { const h = readHash(); if (h) setId(h); }; window.addEventListener("hashchange", f); return () => window.removeEventListener("hashchange", f); }, []);
  const select = useCallback((next: string) => { setId(next); window.history.replaceState(null, "", `#shipment=${encodeURIComponent(next)}`); }, []);
  return [id, select] as const;
}

// Schematic map: hub, stops and recorded points projected onto the panel (no basemap; positions are relative).
function Schematic({ j }: { j: Journey }) {
  const hub = j.shipment.hub_lat != null ? { lat: j.shipment.hub_lat, lng: j.shipment.hub_lng as number } : null;
  const stops = j.stops.filter((s) => s.lat != null) as (Stop & { lat: number; lng: number })[];
  const recorded = isLive(j.shipment.shipment_id) ? (j.check_ins ?? []) : j.observations.filter((o) => o.lat != null && o.quality !== "missing").map((o) => ({ lat: o.lat as number, lng: o.lng as number }));
  const pts = [...(hub ? [hub] : []), ...stops, ...recorded];
  if (!hub || pts.length < 2) return <p className="text-xs text-muted-foreground">Not enough coordinates to draw the route.</p>;
  const lats = pts.map((p) => p.lat), lngs = pts.map((p) => p.lng);
  const [a, b, c, d] = [Math.min(...lngs), Math.max(...lngs), Math.min(...lats), Math.max(...lats)];
  const W = 520, H = 260, pad = 28, sx = (x: number) => pad + ((x - a) / Math.max(b - a, 0.01)) * (W - 2 * pad), sy = (y: number) => H - pad - ((y - c) / Math.max(d - c, 0.01)) * (H - 2 * pad);
  const path = [hub, ...stops, hub].map((p, i) => `${i ? "L" : "M"}${sx(p.lng).toFixed(1)},${sy(p.lat).toFixed(1)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto rounded-lg bg-[color:var(--color-surface-2,rgba(0,0,0,0.04))]" role="img" aria-label={`Planned stop order for ${j.shipment.shipment_id}`} data-testid="route-schematic">
      <path d={path} fill="none" stroke="currentColor" className="text-primary" strokeWidth={2.5} strokeDasharray={isLive(j.shipment.shipment_id) ? "6 4" : undefined} />
      {recorded.map((p, i) => <circle key={i} cx={sx(p.lng)} cy={sy(p.lat)} r={3} className="fill-amber-500" />)}
      <rect x={sx(hub.lng) - 9} y={sy(hub.lat) - 9} width={18} height={18} rx={4} className="fill-foreground" /><text x={sx(hub.lng)} y={sy(hub.lat) + 4} textAnchor="middle" fontSize={9} fill="white">H</text>
      {stops.map((s) => <g key={s.stop_id}><circle cx={sx(s.lng)} cy={sy(s.lat)} r={10} className="fill-primary" /><text x={sx(s.lng)} y={sy(s.lat) + 4} textAnchor="middle" fontSize={10} fill="white">{s.sequence}</text>
        <text x={sx(s.lng) + 13} y={sy(s.lat) + 4} fontSize={10} className="fill-foreground">{s.buyer_name}</text></g>)}
    </svg>
  );
}

export function SelectedShipment() {
  const [list, setList] = useState<Summary[] | null>(null);
  const [listErr, setListErr] = useState<string | null>(null);
  const [id, select] = useSelection(list);
  const [j, setJ] = useState<Journey | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [histDev, setHistDev] = useState<Deviation | null>(null);
  const [nonce, setNonce] = useState(0);
  const [road, setRoad] = useState<RoadRoute | null>(null);
  const [roadErr, setRoadErr] = useState<string | null>(null);
  const [opt, setOpt] = useState("A");
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const loadList = useCallback(() => get<{ shipments: Summary[] }>("/live/shipments").then((d) => { setList(d.shipments); setListErr(null); }).catch((e) => { setList([]); setListErr((e as Error).message); }), []);
  useEffect(() => { loadList(); const t = setInterval(loadList, 20_000); return () => clearInterval(t); }, [loadList]);
  useEffect(() => {
    if (!id) return;
    const ctl = new AbortController();
    setJ(null); setErr(null); setHistDev(null); setRoad(null); setRoadErr(null); setOpt("A"); // clear the previous shipment before loading the next
    get<RoadRoute>(isLive(id) ? `/live/shipments/${encodeURIComponent(id)}/road-route` : `/shipments/${encodeURIComponent(id)}/road-route`, ctl.signal)
      .then(setRoad).catch((e) => { if (!ctl.signal.aborted) setRoadErr((e as Error).message); });
    const path = isLive(id) ? `/live/shipments/${encodeURIComponent(id)}/journey` : `/shipments/${encodeURIComponent(id)}/journey`;
    get<Journey>(path, ctl.signal).then(setJ).catch((e) => { if (!ctl.signal.aborted) setErr((e as Error).message); });
    if (!isLive(id)) get<Deviation>(`/shipments/${encodeURIComponent(id)}/deviation`, ctl.signal).then(setHistDev).catch(() => setHistDev(null));
    return () => ctl.abort();
  }, [id, nonce]);

  const active = (list ?? []).filter((s) => s.status === "assigned" || s.status === "in_progress");
  const closed = (list ?? []).filter((s) => !(s.status === "assigned" || s.status === "in_progress"));
  const live = id ? isLive(id) : false;
  const s = j?.shipment;
  const dev = live ? j?.deviation : histDev;
  return (
    <section className="col-span-12 panel p-5" data-testid="selected-shipment" aria-labelledby="sel-title">
      <div className="flex flex-wrap items-center gap-3">
        <RouteIcon className="w-4 h-4 text-primary" />
        <h2 id="sel-title" className="text-base font-bold tracking-tight">Shipment</h2>
        <select aria-label="Select shipment" data-testid="shipment-select" value={id ?? ""} onChange={(e) => select(e.target.value)} className="rounded-md border border-border bg-background px-2 py-1.5 text-sm font-mono">
          {id && ![...(list ?? []).map((x) => x.shipment_id), HISTORICAL_DEMO].includes(id) && <option value={id}>{id}</option>}
          {active.length > 0 && <optgroup label="Assigned / in progress (live dispatch)">{active.map((x) => <option key={x.shipment_id} value={x.shipment_id}>{x.shipment_id} · {x.status_label} · {x.driver_id} · {x.destinations.join(" → ")}</option>)}</optgroup>}
          {closed.length > 0 && <optgroup label="Closed live dispatches">{closed.map((x) => <option key={x.shipment_id} value={x.shipment_id}>{x.shipment_id} · {x.status_label}</option>)}</optgroup>}
          <optgroup label="Historical dataset record"><option value={HISTORICAL_DEMO}>{HISTORICAL_DEMO} · historical (Jan–Jun 2026)</option></optgroup>
        </select>
        <button type="button" aria-label="Refresh shipment" onClick={() => { loadList(); setNonce((n) => n + 1); }} className="p-1.5 rounded hover:bg-accent"><RefreshCw className="w-3.5 h-3.5" /></button>
        <span className="text-xs text-muted-foreground">{listErr ? `Live dispatch list unavailable: ${listErr}` : `${active.length} active live dispatch${active.length === 1 ? "" : "es"}`}</span>
        <span className="ml-auto"><ExplorationModeButton /></span>
      </div>

      {err && <p role="alert" className="mt-3 text-sm text-danger">Could not load {id}: {err}. Nothing from another shipment is shown instead.</p>}
      {!err && (!j || !s) && <p className="mt-3 text-sm text-muted-foreground" role="status">Loading {id ?? "shipment"}…</p>}
      {j && s && s.shipment_id === id && (
        <div className="mt-4 grid grid-cols-12 gap-4 text-sm" data-shipment-id={s.shipment_id}>
          <div className="col-span-12 lg:col-span-5 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono font-bold" data-testid="sel-id">{s.shipment_id}</span>
              <span className="rounded-full border border-primary/40 px-2 py-0.5 text-xs" data-testid="sel-status">{s.status_label ?? s.status.replace(/_/g, " ")}</span>
              <span className={`rounded-full px-2 py-0.5 text-xs ${live ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"}`}>{live ? "Live dispatch record" : "Historical record (not live)"}</span>
            </div>
            <p className="flex items-center gap-2" data-testid="sel-assignment"><User className="w-4 h-4" />{s.driver_id} {s.driver_name} · <Truck className="w-4 h-4" />{s.vehicle_id} ({s.vehicle_plate}, {s.vehicle_type}, {s.vehicle_capacity_kg} kg)</p>
            <p className="text-muted-foreground">From {s.hub_name} ({s.hub_state}){s.route_type_label ? ` · ${s.route_type_label} · needs Class ${s.required_licences?.join(" or ")}` : ""}</p>
            <ol className="space-y-1" data-testid="sel-stops">
              {j.stops.map((x) => (
                <li key={x.stop_id} className="flex gap-2"><MapPin className="w-4 h-4 mt-0.5 text-primary shrink-0" />
                  <span><b>{x.sequence}. {x.kind === "pickup" ? "Collect" : "Deliver"}{x.kg ? ` ${x.kg} kg` : ""}</b> · {x.buyer_name} ({x.buyer_state}) · <span className="font-mono text-xs">{x.order_id}</span>
                    <span className="block text-xs text-muted-foreground">{live ? `Calculated ETA ${myt(x.eta_at)} (estimate)${x.arrived_at ? ` · arrival recorded ${myt(x.arrived_at)}` : ""}` : `Recorded arrival ${myt(x.arrived_at)}`}{x.deadline_at ? ` · deadline ${myt(x.deadline_at)}` : ""}</span>
                    {live && x.delivery_status && <span className="block text-xs font-medium" data-testid={`sel-stop-outcome-${x.order_id}`}>Proof of delivery: {x.status.replace(/_/g, " ")} · {x.delivered_kg} of {x.kg} kg{x.rejected_kg ? ` · ${x.rejected_kg} kg outstanding (${x.rejection_reason})` : ""} · {myt(x.completed_at)}</span>}</span></li>
              ))}
            </ol>
            <p className="flex items-start gap-2"><Package className="w-4 h-4 mt-0.5" /><span>{j.cargo.map((c) => `${c.product_name} ${c.kg} kg (${c.storage_class})`).join(", ") || "No cargo lines"} · loaded {s.loaded_kg} kg{s.utilisation_pct != null ? ` · ${s.utilisation_pct}% of weight capacity` : ""}</span></p>
            {j.telemetry.safe_band_c && <p className="flex items-center gap-2"><Snowflake className="w-4 h-4" />Handling: keep between {j.telemetry.safe_band_c.min} and {j.telemetry.safe_band_c.max} °C</p>}
          </div>
          <div className="col-span-12 lg:col-span-7 space-y-3">
            {road && road.options.length > 1 && (
              <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Route options" data-testid="route-options">
                {road.options.map((o) => (
                  <button key={o.id} type="button" role="radio" aria-checked={opt === o.id} onClick={() => setOpt(o.id)} data-testid={`route-option-${o.id}`}
                    className={`rounded-md border px-2.5 py-1.5 text-left text-xs ${opt === o.id ? "border-primary bg-primary/10" : "border-border hover:bg-accent"}`}>
                    <span aria-hidden className="mr-1.5 inline-block align-middle" style={{ display: "inline-block", verticalAlign: "middle", width: 18, height: 0, borderTop: `${o.id === "A" ? 4 : 3}px ${o.id === "A" ? "solid" : "dashed"} ${colourOf(o.id)}` }} />
                    <b>{o.id}</b> · {o.id === "A" ? (live ? "Main route · assigned" : "Main route · recorded order") : `${o.label} · alternative`}<br />
                    <span className="text-muted-foreground">{o.distance_km} km · {o.total_minutes} min{o.vs_assigned ? ` (${o.vs_assigned.distance_km >= 0 ? "+" : ""}${o.vs_assigned.distance_km} km, ${o.vs_assigned.total_minutes >= 0 ? "+" : ""}${o.vs_assigned.total_minutes} min vs A)` : ""}</span>
                  </button>
                ))}
              </div>
            )}
            {road && <RouteSummary road={road} opt={opt} live={live} />}
            <div className="h-[380px] overflow-hidden rounded-lg border border-border/60 isolate" style={{ minHeight: 380 }} data-testid="route-map">
              {mounted && j.shipment.hub_lat != null ? (
                <Suspense fallback={<Schematic j={j} />}>
                  <RouteMap hub={{ name: s.hub_name, lat: s.hub_lat as number, lng: s.hub_lng as number }} selected={opt} live={live} attribution={road?.road_routing.attribution}
                    options={road?.options ?? []}
                    stops={j.stops.map((x) => ({ ref_id: x.order_id, name: x.buyer_name, state: x.buyer_state, lat: x.lat, lng: x.lng, kind: x.kind, kg: x.kg ?? x.delivered_kg,
                      outcome: x.delivery_status ?? null, recorded: x.delivery_status ? `${x.status.replace(/_/g, " ")} ${x.delivered_kg ?? 0} kg at ${myt(x.completed_at)}` : x.arrived_at ? `arrived ${myt(x.arrived_at)}` : null }))}
                    recorded={live ? (j.check_ins ?? []).map((c) => ({ lat: c.lat, lng: c.lng, at: c.recorded_at, label: `Driver check-in (${c.source.replace(/_/g, " ")})` }))
                      : j.observations.filter((o) => o.lat != null && o.lng != null && o.quality !== "missing").map((o) => ({ lat: o.lat as number, lng: o.lng as number, at: o.observed_at, label: "Historical GPS point (dataset)" }))} />
                </Suspense>
              ) : <Schematic j={j} />}
            </div>
            <p className="text-xs text-muted-foreground" data-testid="route-legend">
              Blue line = main route ({live ? "assigned to the driver" : "recorded stop order"}), always on top. Arrowheads and labels such as "Hub → 1" show the driving order. A selected option (B orange, C purple, dashed) is drawn underneath, so it only appears where it uses different roads; comparing is for information only. Numbered circles = stops in the main route's order · amber dots = {live ? "driver check-ins" : "historical GPS points"} (never a current position).
              {road ? ` ${road.road_routing.note}` : roadErr ? ` Road route unavailable (${roadErr}); stops are joined by straight lines.` : " Loading road route…"}
            </p>
            {road?.fallback_note && <p className="text-xs text-warning" role="status">{road.fallback_note}</p>}
            <div className="grid grid-cols-2 gap-2 text-xs" data-testid="sel-route">
              <div className="rounded-md border border-border/60 p-2">Planned distance<br /><b className="text-sm">{s.planned_distance_km ?? "—"} km</b>{live && " (estimate)"}</div>
              <div className="rounded-md border border-border/60 p-2">Planned time<br /><b className="text-sm">{s.planned_minutes ?? "—"} min</b>{live && ` · route v${s.route_version}`}</div>
              <div className="rounded-md border border-border/60 p-2">{live ? "Planned window" : "Actual distance"}<br /><b className="text-sm">{live ? `${myt(s.planned_start_at)} → ${myt(s.planned_end_at)}` : `${s.actual_distance_km ?? "not recorded"} km`}</b></div>
              <div className="rounded-md border border-border/60 p-2">Traffic / weather<br /><b className="text-sm">{live ? "No live feed connected" : `${s.traffic_input ?? "not recorded"} / ${s.weather_input ?? "not recorded"} (recorded inputs)`}</b></div>
            </div>
            {dev && <p className={`text-xs ${dev.status === "possible_deviation" ? "text-warning" : "text-muted-foreground"}`} data-testid="sel-deviation"><AlertTriangle className="inline w-3.5 h-3.5 mr-1" />Route adherence: {dev.message} Source: {dev.data_source}</p>}
            {live && j.issues && j.issues.length > 0 && (
              <div className="text-xs space-y-1" data-testid="sel-issues"><b>Driver reports</b>{j.issues.map((i) => <p key={i.issue_id}>{i.issue_id} · {i.kind.replace(/_/g, " ")} · {i.status.replace(/_/g, " ")} · {i.description}{i.resolution_note ? ` · dispatcher: ${i.resolution_note}` : ""}</p>)}</div>
            )}
            {live && j.route_versions && j.route_versions.length > 1 && <p className="text-xs">Route changes: {j.route_versions.slice(1).map((r) => `v${r.version} ${r.reason} (approved by ${r.approved_by})`).join("; ")}</p>}
            {road && (() => { const o = road.options.find((x) => x.id === opt) ?? road.options[0]; return (
              <div className="text-xs space-y-1" data-testid="sel-alternatives">
                <b>Option {o.id}{o.id === "A" ? "" : " (comparison only)"}:</b> {o.distance_km} km by road · drive {o.drive_minutes} min + {o.service_minutes_per_stop} min per stop · back at hub {myt(o.end_at)} ({o.source_label}{o.fetched_at ? `, fetched ${myt(o.fetched_at)}` : ""})
                <ol className="list-decimal pl-5">{o.stop_etas.map((e, i) => <li key={e.ref_id} className={o.late_refs.includes(e.ref_id) ? "text-danger font-medium" : ""}>{o.stop_names[i]}: calculated ETA {myt(e.eta_at)}{e.deadline_at ? ` · deadline ${myt(e.deadline_at)}` : ""}{o.late_refs.includes(e.ref_id) ? " · would be late" : ""}</li>)}</ol>
                {o.after_working_day && <p className="text-warning">{o.after_working_day}.</p>}
                {road.dispatch_estimate && <p className="text-muted-foreground">Dispatch planning estimate for comparison: {road.dispatch_estimate.distance_km} km, {road.dispatch_estimate.minutes} min ({road.dispatch_estimate.basis}).</p>}
                {road.recorded && <p className="text-muted-foreground">Recorded: {road.recorded.actual_distance_km ?? "—"} km actual vs {road.recorded.planned_distance_km ?? "—"} km planned. {road.recorded.basis}.</p>}
              </div>); })()}
            {live && s.dispatch_explanation && <details className="text-xs"><summary className="cursor-pointer">Why the dispatcher's plan chose this</summary><ul className="list-disc pl-4">{s.dispatch_explanation.map((l) => <li key={l}>{l}</li>)}</ul></details>}
          </div>
        </div>
      )}
    </section>
  );
}

// One plain-language sentence about what the map shows, so the user does not have to decode the lines.
const dur = (m: number) => (m >= 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${m} min`);
const signed = (n: number, u: string) => `${n >= 0 ? "+" : ""}${n} ${u}`;
function RouteSummary({ road, opt, live }: { road: RoadRoute; opt: string; live: boolean }) {
  const a = road.options.find((o) => o.id === "A") ?? road.options[0];
  const b = road.options.find((o) => o.id === opt && o !== a);
  if (!a) return null;
  const sameOrder = b ? b.stop_refs.join() === a.stop_refs.join() : true;
  return (
    <div className="rounded-md border border-border/60 bg-[color:var(--color-surface-2,rgba(0,0,0,0.03))] p-2.5 text-sm space-y-1" data-testid="route-summary">
      <p><b>Main route{live ? " (assigned)" : ""}:</b> Hub → {a.stop_names.map((n, i) => `${i + 1}. ${n}`).join(" → ")} → back to Hub · {a.distance_km} km · about {dur(a.total_minutes)} including stops.</p>
      {b ? (
        <p><b>Option {b.id}</b> ({b.label}): {sameOrder ? "same stops, but a different road for part of the trip (dashed line)" : `visits the stops in a different order: ${b.stop_names.join(" → ")}`}
          {b.vs_assigned ? ` · ${signed(b.vs_assigned.distance_km, "km")}, ${signed(b.vs_assigned.total_minutes, "min")} compared with the main route` : ""}. For comparison only; the assigned route does not change.</p>
      ) : road.options.length > 1 ? <p className="text-muted-foreground">Choose B or C above to see how another route compares.</p> : null}
    </div>
  );
}
