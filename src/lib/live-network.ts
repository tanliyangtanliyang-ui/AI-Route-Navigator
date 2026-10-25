// Live network data for the Route Navigator: real records from the FarmXpress API (no simulation).
// - trips: GET /v1/live/shipments?hub=… for every hub, plus the journey of each active trip (cargo, vehicle, checks, alerts)
// - events: GET /v1/hubs/{id}/events for every hub (requests, orders, trips, issues, cargo alerts, label checks, PODs)
import { useCallback, useEffect, useRef, useState } from "react";

export const API = import.meta.env.VITE_FARMXPRESS_API_BASE_URL ?? "http://127.0.0.1:4000/v1";
const get = async <T,>(p: string): Promise<T> => { const r = await fetch(`${API}${p}`); const b = await r.json().catch(() => null); if (!r.ok) throw new Error(b?.error?.message ?? `API ${r.status}`); return b as T; };

export type LiveTrip = { shipment_id: string; job_type: string; status: string; status_label: string; hub_id: string; vehicle_id: string; driver_id: string; driver_name: string | null;
  plan_date: string; planned_start_at: string; loaded_kg: number; stop_count: number; destinations: string[]; open_issues: number; stops_with_pod: number };
export type Journey = {
  shipment: { shipment_id: string; status: string; status_label: string; hub_name: string; vehicle_id: string; vehicle_plate: string; vehicle_type: string; vehicle_capacity_kg: number;
    driver_name: string | null; planned_distance_km: number | null; planned_minutes: number | null; loaded_kg: number; route_type_label?: string };
  cargo: { product_id: string; product_name: string; storage_class: string; temp_min_c: number; temp_max_c: number; kg: number }[];
  telemetry: { safe_band_c: { min: number; max: number } | null };
  cargo_checks: { check_id: string; temperature_c: number; result: string; recorded_at: string }[];
  cargo_alerts: { alert_id: string; severity: string; status: string; temperature_c: number; opened_at: string }[];
  issues: { issue_id: string; kind: string; status: string; description: string }[];
};
export type NetEvent = { id: string; at: string; kind: string; ref: string; module: string; severity: "info" | "success" | "warning" | "critical"; title: string; detail: string; hub_id: string };

export function useLiveNetwork(everyMs = 20_000) {
  const [state, setState] = useState<{ hubs: { hub_id: string; name: string }[]; trips: LiveTrip[]; journeys: Record<string, Journey>; events: NetEvent[]; vehicles: number | null;
    loaded: boolean; error: string | null; checkedAt: number | null }>({ hubs: [], trips: [], journeys: {}, events: [], vehicles: null, loaded: false, error: null, checkedAt: null });
  const load = useCallback(async () => {
    try {
      const hubs = (await get<{ hubs: { hub_id: string; name: string }[] }>("/hubs")).hubs;
      const [tripLists, eventLists, summary] = await Promise.all([
        Promise.all(hubs.map((h) => get<{ shipments: LiveTrip[] }>(`/live/shipments?hub=${h.hub_id}`).then((r) => r.shipments))),
        Promise.all(hubs.map((h) => get<{ events: Omit<NetEvent, "hub_id">[] }>(`/hubs/${h.hub_id}/events?limit=60`).then((r) => r.events.map((e) => ({ ...e, id: `${h.hub_id}:${e.id}`, hub_id: h.hub_id }))))),
        get<{ entities: { vehicles: number } }>("/network/summary").catch(() => null),
      ]);
      const trips = tripLists.flat().sort((a, b) => b.planned_start_at.localeCompare(a.planned_start_at));
      const active = trips.filter((t) => ["assigned", "in_progress"].includes(t.status)).slice(0, 8);
      const js = await Promise.all(active.map((t) => get<Journey>(`/live/shipments/${t.shipment_id}/journey`).catch(() => null)));
      const journeys: Record<string, Journey> = {}; active.forEach((t, i) => { if (js[i]) journeys[t.shipment_id] = js[i]!; });
      const events = eventLists.flat().sort((a, b) => b.at.localeCompare(a.at));
      setState({ hubs, trips, journeys, events, vehicles: summary?.entities.vehicles ?? null, loaded: true, error: null, checkedAt: Date.now() });
    } catch (e) { setState((s) => ({ ...s, loaded: true, error: (e as Error).message, checkedAt: Date.now() })); }
  }, []);
  useEffect(() => { load(); const t = setInterval(load, everyMs); return () => clearInterval(t); }, [load, everyMs]);
  return state;
}

// ---- Notification state (C2): one entry per real event id; dismissals and acknowledgements remembered in this browser.
const KEY = "fx.nav.notifications.v1";
type Store = { dismissed: string[]; acked: string[]; seen: string[] };
const read = (): Store => { try { return { dismissed: [], acked: [], seen: [], ...JSON.parse(localStorage.getItem(KEY) ?? "{}") }; } catch { return { dismissed: [], acked: [], seen: [] }; } };
const write = (s: Store) => { try { localStorage.setItem(KEY, JSON.stringify({ dismissed: s.dismissed.slice(-400), acked: s.acked.slice(-400), seen: s.seen.slice(-800) })); } catch { /* convenience only */ } };
export const needsAck = (e: NetEvent) => e.severity === "critical";

export function useNotifications(events: NetEvent[], loaded: boolean, onNew: (e: NetEvent) => void) {
  const [store, setStore] = useState<Store>(() => read());
  const first = useRef(true);
  useEffect(() => {
    if (!loaded) return;
    const s = read(); const seen = new Set(s.seen);
    const fresh = events.filter((e) => !seen.has(e.id));
    // On the first load only remember what exists (no burst of pop-ups); afterwards pop up each new event once.
    if (!first.current) fresh.slice(0, 3).forEach(onNew);
    first.current = false;
    if (fresh.length) { const next = { ...s, seen: [...s.seen, ...fresh.map((e) => e.id)] }; write(next); setStore(next); }
  }, [events, loaded, onNew]);
  const update = (f: (s: Store) => Store) => { const next = f(read()); write(next); setStore(next); };
  const visible = events.filter((e) => (needsAck(e) ? !store.acked.includes(e.id) : !store.dismissed.includes(e.id))).slice(0, 40);
  return {
    visible, unread: visible.filter((e) => needsAck(e) || !store.dismissed.includes(e.id)).length,
    dismiss: (id: string) => update((s) => ({ ...s, dismissed: [...s.dismissed, id] })),
    acknowledge: (id: string) => update((s) => ({ ...s, acked: [...s.acked, id] })),
    dismissAll: () => update((s) => ({ ...s, dismissed: [...s.dismissed, ...visible.filter((e) => !needsAck(e)).map((e) => e.id)] })),
  };
}

export const ago = (iso: string) => {
  const s = Math.max(1, Math.floor((Date.now() - Date.parse(iso)) / 1000));
  if (s < 60) return `${s}s ago`; const m = Math.floor(s / 60); if (m < 60) return `${m} min ago`; const h = Math.floor(m / 60); if (h < 48) return `${h} h ago`;
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "Asia/Kuala_Lumpur" });
};
