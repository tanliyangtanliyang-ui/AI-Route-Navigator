import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { ArrowLeft, Maximize2, X } from "lucide-react";
import type { Link, Place } from "@/components/NetworkMap";

// Exploration Mode = Network Explorer: the real FarmXpress network (dataset hubs, farms and buyers).
// One click on a place shows its figures and recent shipments; one more click opens a shipment on the route map.
const NetworkMap = lazy(() => import("@/components/NetworkMap"));
const API = import.meta.env.VITE_FARMXPRESS_API_BASE_URL ?? "http://127.0.0.1:4000/v1";

type Figures = Record<string, number | null>;
type P = Place & { figures: Figures; type?: string; farmer_id?: string; primary_hub_id?: string; capacity_kg?: number };
type Network = { window: { start: string; end: string }; hubs: P[]; farms: P[]; buyers: P[]; links: (Link & { kg: number })[]; notes: string[] };
type Ship = { shipment_id: string; hub_id: string; status: string; planned_start_at: string; loaded_kg: number; stops: number; delivered_kg: number; rejected_kg: number; late_stops: number | null };
type LiveShip = { shipment_id: string; status_label: string; planned_start_at: string; destinations: string[] };

const get = async <T,>(path: string): Promise<T> => {
  const r = await fetch(`${API}${path}`); const b = await r.json().catch(() => null);
  if (!r.ok) throw new Error(b?.error?.message ?? `API ${r.status}`); return b as T;
};
const day = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { timeZone: "Asia/Kuala_Lumpur", day: "numeric", month: "short", year: "numeric" });
const n = (v: number | null | undefined, unit = "") => (v == null ? "—" : `${v.toLocaleString("en-GB")}${unit}`);
const KIND_LABEL = { hub: "Consolidation hub", farm: "Farm", buyer: "Buyer" } as const;

function openShipment(id: string, close: () => void) {
  window.location.hash = `shipment=${encodeURIComponent(id)}`;
  close();
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return <div className="rounded-md border border-border/60 p-2"><div className="text-[11px] text-muted-foreground">{label}</div><div className="text-sm font-semibold">{value}</div>{hint && <div className="text-[10px] text-muted-foreground">{hint}</div>}</div>;
}

function FiguresFor({ p }: { p: P }) {
  const f = p.figures;
  if (p.kind === "farm") return <div className="grid grid-cols-2 gap-2"><Stat label="Batches sent to hub" value={n(f.batches)} /><Stat label="Declared harvest" value={n(f.declared_kg, " kg")} /><Stat label="Products" value={n(f.products)} /></div>;
  return (
    <div className="grid grid-cols-2 gap-2">
      <Stat label="Shipments" value={n(f.shipments)} />
      <Stat label="On time" value={n(f.on_time_pct, "%")} hint={`${n(f.late_stops)} late stop(s)`} />
      <Stat label="Delivered" value={n(f.delivered_kg, " kg")} />
      <Stat label="Rejected / not delivered" value={n(f.rejected_kg, " kg")} hint={`${n(f.problem_stops)} stop(s) partial, failed or rejected`} />
      {p.kind === "hub" && <><Stat label="Received from farms" value={n(f.received_kg, " kg")} hint={`${n(f.batches_received)} batches`} /><Stat label="Works with" value={`${n(f.farms)} farms · ${n(f.buyers)} buyers`} /></>}
    </div>
  );
}

function Details({ p, net, onSelect, close }: { p: P; net: Network; onSelect: (id: string | null) => void; close: () => void }) {
  const [ships, setShips] = useState<{ total: number; shipments: Ship[] } | null>(null);
  const [live, setLive] = useState<LiveShip[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    setShips(null); setLive(null); setErr(null);
    get<{ total: number; shipments: Ship[] }>(`/network/places/${encodeURIComponent(p.id)}/shipments?limit=10`).then(setShips).catch((e) => setErr((e as Error).message));
    if (p.kind === "hub") get<{ shipments: LiveShip[] }>(`/live/shipments?hub=${encodeURIComponent(p.id)}`).then((d) => setLive(d.shipments)).catch(() => setLive([]));
  }, [p.id, p.kind]);
  const all = [...net.hubs, ...net.farms, ...net.buyers];
  const partners = net.links.filter((l) => l.from === p.id || l.to === p.id)
    .map((l) => ({ link: l, other: all.find((x) => x.id === (l.from === p.id ? l.to : l.from)) }))
    .filter((x): x is { link: typeof x.link; other: P } => !!x.other).sort((a, b) => b.link.count - a.link.count);
  return (
    <div className="space-y-3" data-testid="place-details" data-place-id={p.id}>
      <button type="button" onClick={() => onSelect(null)} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"><ArrowLeft className="w-3.5 h-3.5" />Network overview</button>
      <div>
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{KIND_LABEL[p.kind]}{p.type ? ` · ${p.type}` : ""}</div>
        <h3 className="text-lg font-bold leading-tight">{p.name}</h3>
        <div className="text-xs text-muted-foreground">{p.state} · <span className="font-mono">{p.id}</span>{p.capacity_kg ? ` · capacity ${n(p.capacity_kg, " kg")}` : ""}</div>
      </div>
      <FiguresFor p={p} />
      {live && live.length > 0 && (
        <div data-testid="place-live"><div className="text-xs font-semibold mb-1">Live dispatches</div>
          <ul className="space-y-1">{live.slice(0, 5).map((s) => <li key={s.shipment_id}><button type="button" onClick={() => openShipment(s.shipment_id, close)} className="w-full text-left rounded-md border border-border/60 px-2 py-1 text-xs hover:bg-accent"><span className="font-mono">{s.shipment_id}</span> · {s.status_label} · {s.destinations.join(" → ")}</button></li>)}</ul></div>
      )}
      <div>
        <div className="text-xs font-semibold mb-1">{p.kind === "farm" ? "Supplies" : p.kind === "buyer" ? "Delivered from" : "Works with"}</div>
        <div className="flex flex-wrap gap-1">{partners.map(({ link, other }) => (
          <button key={other.id} type="button" onClick={() => onSelect(other.id)} className="rounded-full border border-border px-2 py-0.5 text-[11px] hover:bg-accent" title={`${link.count} ${link.kind === "supply" ? "batches" : "shipments"}`}>
            {other.name} <span className="text-muted-foreground">({link.count})</span></button>))}</div>
      </div>
      <div data-testid="place-shipments">
        <div className="text-xs font-semibold mb-1">Recent shipments {ships ? <span className="font-normal text-muted-foreground">· latest {ships.shipments.length} of {ships.total} · click to open on the route map</span> : null}</div>
        {err && <p className="text-xs text-danger" role="alert">Could not load shipments ({err}).</p>}
        {!ships && !err && <p className="text-xs text-muted-foreground" role="status">Loading…</p>}
        <ul className="space-y-1">{ships?.shipments.map((s) => (
          <li key={s.shipment_id}><button type="button" onClick={() => openShipment(s.shipment_id, close)} data-testid={`open-${s.shipment_id}`}
            className="w-full text-left rounded-md border border-border/60 px-2 py-1 text-xs hover:bg-accent">
            <span className="font-mono">{s.shipment_id}</span> · {day(s.planned_start_at)} · {s.stops} stop{s.stops === 1 ? "" : "s"} · {n(s.delivered_kg, " kg")} delivered
            {s.rejected_kg > 0 && <span className="text-warning"> · {n(s.rejected_kg, " kg")} not delivered</span>}{(s.late_stops ?? 0) > 0 && <span className="text-warning"> · late</span>}
            <span className="text-muted-foreground"> · {s.status.replace(/_/g, " ")}</span></button></li>))}</ul>
      </div>
    </div>
  );
}

function Overview({ net, onSelect }: { net: Network; onSelect: (id: string) => void }) {
  return (
    <div className="space-y-3" data-testid="network-overview">
      <p className="text-xs text-muted-foreground">Click a hub, farm or buyer, on the map or below, to see its figures and recent shipments.</p>
      {net.hubs.map((h) => (
        <button key={h.id} type="button" onClick={() => onSelect(h.id)} data-testid={`hub-card-${h.id}`} className="w-full text-left rounded-lg border border-border/60 p-3 hover:bg-accent">
          <div className="font-semibold text-sm">{h.name}</div>
          <div className="text-xs text-muted-foreground">{h.state} · {n(h.figures.farms)} farms → hub → {n(h.figures.buyers)} buyers</div>
          <div className="text-xs mt-1">{n(h.figures.shipments)} shipments · {n(h.figures.on_time_pct, "%")} on time · {n(h.figures.delivered_kg, " kg")} delivered</div>
        </button>
      ))}
      {(["buyer", "farm"] as const).map((k) => (
        <div key={k}><div className="text-xs font-semibold mb-1">{k === "buyer" ? `Buyers (${net.buyers.length})` : `Farms (${net.farms.length})`}</div>
          <div className="flex flex-wrap gap-1">{(k === "buyer" ? net.buyers : net.farms).map((p) => (
            <button key={p.id} type="button" onClick={() => onSelect(p.id)} className="rounded-full border border-border px-2 py-0.5 text-[11px] hover:bg-accent">{p.name}</button>))}</div></div>
      ))}
    </div>
  );
}

function NetworkExplorer({ onClose }: { onClose: () => void }) {
  const [net, setNet] = useState<Network | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [sel, setSel] = useState<string | null>(null);
  useEffect(() => { get<Network>("/network/places").then(setNet).catch((e) => setErr((e as Error).message)); }, []);
  // Esc goes back to the overview first, then exits; the selected shipment underneath stays as it was.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { if (sel) setSel(null); else onClose(); } };
    window.addEventListener("keydown", onKey); return () => window.removeEventListener("keydown", onKey);
  }, [onClose, sel]);
  const places = useMemo(() => (net ? [...net.hubs, ...net.farms, ...net.buyers] : []), [net]);
  const current = places.find((p) => p.id === sel) ?? null;
  return (
    <div role="dialog" aria-modal="true" aria-label="Exploration Mode: FarmXpress network" data-testid="exploration-mode" className="fixed inset-0 z-[1000] bg-background flex flex-col lg:flex-row">
      <aside className="lg:w-[380px] shrink-0 border-b lg:border-b-0 lg:border-r border-border p-4 overflow-y-auto max-h-[50vh] lg:max-h-none space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div><div className="text-[11px] uppercase tracking-widest text-primary">Exploration Mode</div><h2 className="text-xl font-bold leading-tight">FarmXpress network</h2></div>
          <button type="button" onClick={onClose} className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1.5 text-xs hover:bg-accent"><X className="w-3.5 h-3.5" />Exit</button>
        </div>
        <p className="text-[11px] text-muted-foreground" data-testid="exploration-disclaimer">
          Places and figures from the FarmXpress dataset{net ? ` (${day(net.window.start)} – ${day(net.window.end)}, synthetic dataset)` : ""}. Live dispatches are listed under each hub. Esc goes back, then exits; your selected shipment stays selected.
        </p>
        {err && <p className="text-sm text-danger" role="alert">Network data unavailable ({err}).</p>}
        {!net && !err && <p className="text-sm text-muted-foreground" role="status">Loading network…</p>}
        {net && (current ? <Details p={current} net={net} onSelect={setSel} close={onClose} /> : <Overview net={net} onSelect={setSel} />)}
      </aside>
      <div className="flex-1 min-h-[360px] isolate" style={{ minHeight: 360 }}>
        {net && <Suspense fallback={<p className="p-4 text-sm text-muted-foreground">Loading map…</p>}><NetworkMap places={places} links={net.links} selected={sel} onSelect={setSel} /></Suspense>}
      </div>
    </div>
  );
}

// Clearly labelled entry point to Exploration Mode.
export function ExplorationModeButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} data-testid="open-exploration"
        className="inline-flex items-center gap-2 rounded-md border border-primary/40 px-3 py-1.5 text-xs font-medium hover:bg-primary/10">
        <Maximize2 className="w-3.5 h-3.5" /> Exploration Mode <span className="text-muted-foreground">· network map</span>
      </button>
      {open && <NetworkExplorer onClose={() => setOpen(false)} />}
    </>
  );
}
