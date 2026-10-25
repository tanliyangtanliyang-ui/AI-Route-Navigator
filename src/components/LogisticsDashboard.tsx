import { Truck, AlertTriangle, Thermometer, Package, Activity, Bell, Radio, X, CheckCircle2, Snowflake, Route as RouteIcon } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { SelectedShipment } from "@/components/SelectedShipment";
import { ago, needsAck, useLiveNetwork, useNotifications, type Journey, type NetEvent } from "@/lib/live-network";

// Route Navigator home. Everything below the selected-shipment panel comes from FarmXpress records (live trips,
// their cargo and checks, and the hub event streams). The earlier scenario simulator and its sample IDs were removed (C1/C2).

function StatCard({ icon: Icon, label, value, hint, accent, testId }: { icon: typeof Truck; label: string; value: string; hint?: string; accent?: string; testId?: string }) {
  return (
    <div className="panel p-4 relative overflow-hidden" data-testid={testId}>
      <div className="flex items-start justify-between">
        <div>
          <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">{label}</div>
          <div className="mt-1.5 text-2xl font-bold tracking-tight">{value}</div>
          {hint && <div className={`text-xs mt-0.5 ${accent ?? "text-muted-foreground"}`}>{hint}</div>}
        </div>
        <div className="p-2 rounded-lg bg-primary/10 border border-primary/20"><Icon className="w-4 h-4 text-primary" /></div>
      </div>
    </div>
  );
}

const sevDot: Record<NetEvent["severity"], string> = { info: "bg-primary", success: "bg-success", warning: "bg-warning", critical: "bg-danger" };
const sevChip: Record<NetEvent["severity"], string> = { info: "border-primary/30", success: "border-success/30", warning: "border-warning/40", critical: "border-danger/50" };

function Clock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(t); }, []);
  return <span>{now.toLocaleTimeString("en-GB", { timeZone: "Asia/Kuala_Lumpur", hour12: false })} MYT</span>;
}

function NotificationBell({ n }: { n: ReturnType<typeof useNotifications> }) {
  const [open, setOpen] = useState(false);
  useEffect(() => { if (!open) return; const k = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false); window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k); }, [open]);
  return (
    <div className="relative">
      <button onClick={() => setOpen((v) => !v)} className="relative p-2 rounded-lg border border-border hover:border-primary/50 hover:bg-primary/5 transition" aria-label="Notifications" data-testid="nav-notifications">
        <Bell className="w-4 h-4 text-foreground" />
        {n.unread > 0 && <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-danger text-[9px] font-bold text-white flex items-center justify-center">{n.unread > 9 ? "9+" : n.unread}</span>}
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-[360px] max-h-[70vh] overflow-y-auto panel p-0 z-50 shadow-2xl normal-case tracking-normal" data-testid="nav-notification-panel">
          <div className="flex items-center justify-between px-3 py-2 border-b border-border sticky top-0 bg-background/95 backdrop-blur">
            <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Notifications · live FarmXpress records</div>
            <div className="flex items-center gap-2">
              {n.visible.some((e) => !needsAck(e)) && <button onClick={n.dismissAll} className="text-[10px] text-muted-foreground hover:text-foreground">Dismiss all</button>}
              <button onClick={() => setOpen(false)} aria-label="Close" className="text-muted-foreground hover:text-foreground"><X className="w-3.5 h-3.5" /></button>
            </div>
          </div>
          {n.visible.length === 0 && <div className="p-6 text-center text-xs text-muted-foreground">No notifications. New records from the portals appear here.</div>}
          {n.visible.map((e) => (
            <div key={e.id} className="px-3 py-2.5 border-b border-border/40" data-notification-id={e.id}>
              <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                <span className={`w-1.5 h-1.5 rounded-full ${sevDot[e.severity]}`} /><span className="text-primary">{e.module}</span><span>{e.hub_id}</span><span className="ml-auto">{ago(e.at)}</span>
              </div>
              <div className="text-xs font-semibold mt-1">{e.title}</div>
              <div className="text-[11px] text-muted-foreground">{e.detail}</div>
              <div className="mt-1.5 flex gap-2">
                {needsAck(e)
                  ? <button onClick={() => n.acknowledge(e.id)} className="text-[11px] px-2 py-0.5 rounded border border-danger/40 text-danger hover:bg-danger/10" data-testid="acknowledge">Acknowledge (stays until acknowledged)</button>
                  : <button onClick={() => n.dismiss(e.id)} className="text-[11px] px-2 py-0.5 rounded border border-border text-muted-foreground hover:text-foreground" data-testid="dismiss">Dismiss</button>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const PORTALS = ["Farmer", "Hub", "Buyer", "Driver"];
function ModuleSyncStrip({ events }: { events: NetEvent[] }) {
  const last = (m: string) => events.find((e) => e.module === m);
  return (
    <div className="col-span-12 panel px-4 py-2.5 flex items-center gap-3 overflow-x-auto" data-testid="module-sync">
      <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-widest text-muted-foreground shrink-0"><Radio className="w-3 h-3 text-primary" /> Latest record per portal</div>
      <div className="w-px h-4 bg-border" />
      {PORTALS.map((m) => { const e = last(m); const fresh = e && Date.now() - Date.parse(e.at) < 15 * 60_000; return (
        <div key={m} title={e ? `${e.title} · ${e.detail}` : "No records yet"} className={`flex items-center gap-1.5 px-2 py-1 rounded border text-[10px] font-mono shrink-0 ${fresh ? "border-primary/60 bg-primary/10 text-primary" : "border-border text-muted-foreground"}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${fresh ? "bg-primary" : "bg-muted-foreground/40"}`} />{m}: {e ? ago(e.at) : "none"}
        </div>); })}
    </div>
  );
}

// Cargo vs vehicle for every active trip: the products' storage class and temperature range against the assigned vehicle,
// plus the latest temperature the driver typed in and any open alert or issue.
function CargoVehicleCheck({ trips, journeys }: { trips: { shipment_id: string }[]; journeys: Record<string, Journey> }) {
  const rows = trips.map((t) => journeys[t.shipment_id]).filter(Boolean) as Journey[];
  return (
    <section className="col-span-12 panel p-5" data-testid="cargo-vehicle-check">
      <div className="flex items-center gap-2"><Snowflake className="w-4 h-4 text-primary" /><h2 className="text-base font-bold tracking-tight">Cargo & Vehicle Check</h2></div>
      <p className="text-xs text-muted-foreground mt-0.5 mb-4">Active trips: does the vehicle suit the cargo, and what did the driver record? Rule: chilled or cool produce needs a refrigerated vehicle (dispatch-rules.json).</p>
      {rows.length === 0 ? <p className="text-sm text-muted-foreground">No trips are assigned or in progress right now.</p> : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {rows.map((j) => {
            const needsCold = j.cargo.some((c) => ["chilled", "cool"].includes(c.storage_class)); const ok = !needsCold || j.shipment.vehicle_type === "refrigerated";
            const last = j.cargo_checks[j.cargo_checks.length - 1]; const openAlerts = j.cargo_alerts.filter((a) => a.status !== "resolved"); const openIssues = j.issues.filter((i) => i.status === "open");
            const load = j.shipment.vehicle_capacity_kg ? Math.round((j.shipment.loaded_kg * 100) / j.shipment.vehicle_capacity_kg) : null;
            return (
              <div key={j.shipment.shipment_id} className="p-4 rounded-lg bg-background/40 border border-border/60" data-trip={j.shipment.shipment_id}>
                <div className="flex items-center justify-between gap-2">
                  <div className="font-mono text-sm font-bold">{j.shipment.shipment_id}</div>
                  <span className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded border ${ok ? "border-success/40 text-success" : "border-danger/50 text-danger"}`}>{ok ? "Vehicle suits cargo" : "Needs refrigerated vehicle"}</span>
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">{j.shipment.status_label} · {j.shipment.hub_name} · {j.shipment.driver_name ?? "driver"}</div>
                <div className="grid grid-cols-3 gap-2 mt-3 text-xs">
                  <div><div className="text-[10px] font-mono uppercase text-muted-foreground flex items-center gap-1"><Package className="w-3 h-3" /> Cargo</div>{j.cargo.map((c) => <div key={c.product_id}>{c.product_name} {c.kg} kg <span className="text-muted-foreground">({c.storage_class})</span></div>)}</div>
                  <div><div className="text-[10px] font-mono uppercase text-muted-foreground flex items-center gap-1"><Truck className="w-3 h-3" /> Vehicle</div>{j.shipment.vehicle_plate} · {j.shipment.vehicle_type}<div className="text-muted-foreground">{j.shipment.loaded_kg} of {j.shipment.vehicle_capacity_kg} kg{load != null ? ` (${load}%)` : ""}</div></div>
                  <div><div className="text-[10px] font-mono uppercase text-muted-foreground flex items-center gap-1"><Thermometer className="w-3 h-3" /> Temperature</div>Safe {j.telemetry.safe_band_c ? `${j.telemetry.safe_band_c.min}–${j.telemetry.safe_band_c.max} °C` : "—"}<div className="text-muted-foreground">{last ? `Last typed ${last.temperature_c} °C, ${ago(last.recorded_at)}` : "No reading typed yet"}</div></div>
                </div>
                {(openAlerts.length > 0 || openIssues.length > 0) && <div className="mt-2 text-xs text-danger flex items-center gap-1.5"><AlertTriangle className="w-3.5 h-3.5" /> {openAlerts.length} open cargo alert(s) · {openIssues.length} open issue(s)</div>}
              </div>
            );
          })}
        </div>
      )}
      <p className="mt-3 text-[10px] text-muted-foreground">No sensor feed is connected: temperatures are typed by the driver. Product temperature ranges come from the dataset product table.</p>
    </section>
  );
}

function EventFeedPanel({ events }: { events: NetEvent[] }) {
  return (
    <section className="col-span-12 panel p-5" data-testid="event-feed">
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="flex items-center gap-2"><Radio className="w-4 h-4 text-primary" /><h2 className="text-base font-bold tracking-tight">Network Event Feed</h2></div>
          <p className="text-xs text-muted-foreground mt-0.5">Recorded steps from the Farmer, Buyer, Hub and Driver portals at every hub, newest first. Refreshes every 20 s.</p>
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 max-h-[340px] overflow-y-auto pr-1">
        {events.length === 0 && <div className="col-span-full text-center text-xs text-muted-foreground py-8">No records yet. Events appear when the portals create requests, orders and trips.</div>}
        {events.slice(0, 40).map((e) => (
          <div key={e.id} className={`p-3 rounded-lg border ${sevChip[e.severity]} bg-background/40`} data-testid="feed-row">
            <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
              <span className={`w-1.5 h-1.5 rounded-full ${sevDot[e.severity]}`} /><span className="text-primary">{e.module}</span><span>{e.hub_id}</span><span className="ml-auto">{ago(e.at)}</span>
            </div>
            <div className="text-sm font-semibold mt-1 text-foreground">{e.title}</div>
            <div className="text-xs text-muted-foreground">{e.detail}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

export function LogisticsDashboard() {
  const net = useLiveNetwork();
  const onNew = useCallback((e: NetEvent) => { const f = e.severity === "critical" ? toast.error : e.severity === "warning" ? toast.warning : e.severity === "success" ? toast.success : toast; f(e.title, { description: e.detail }); }, []);
  const n = useNotifications(net.events, net.loaded && !net.error, onNew);
  const active = net.trips.filter((t) => ["assigned", "in_progress"].includes(t.status));
  const today = new Date(Date.now() + 8 * 3_600_000).toISOString().slice(0, 10);
  const openAlerts = Object.values(net.journeys).reduce((a, j) => a + j.cargo_alerts.filter((x) => x.status !== "resolved").length, 0);
  const openIssues = net.trips.reduce((a, t) => a + (t.open_issues ?? 0), 0);

  return (
    <div className="min-h-screen">
      <header className="border-b border-border/60 backdrop-blur-xl bg-background/60 sticky top-0 z-30">
        <div className="flex items-center justify-between px-6 py-3 gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center shrink-0"><Activity className="w-5 h-5 text-primary-foreground" /></div>
            <div className="min-w-0">
              <div className="text-sm font-bold tracking-tight truncate">Route Navigator</div>
              <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground truncate">FarmXpress · routes, trips and cargo</div>
            </div>
          </div>
          <div className="flex items-center gap-3 md:gap-6 text-[11px] font-mono uppercase tracking-widest text-muted-foreground">
            <div className="hidden lg:flex items-center gap-1.5" data-testid="api-state"><div className={`w-1.5 h-1.5 rounded-full ${net.error ? "bg-danger" : net.loaded ? "bg-success" : "bg-warning"}`} />{net.error ? "API not reachable" : net.loaded ? "FarmXpress API connected" : "Connecting…"}</div>
            <div className="hidden md:block">Vehicles <span className="text-foreground font-bold">{net.vehicles ?? "—"}</span></div>
            <div className="hidden md:block">Active trips <span className="text-primary font-bold">{active.length}</span></div>
            <div className="hidden sm:block text-primary"><Clock /></div>
            <NotificationBell n={n} />
          </div>
        </div>
      </header>

      <main className="p-4 lg:p-6 grid grid-cols-12 gap-4 lg:gap-6 auto-rows-min">
        <SelectedShipment />
        <ModuleSyncStrip events={net.events} />
        {net.error && <p role="alert" className="col-span-12 text-sm text-danger">Live network data unavailable: {net.error}</p>}
        <div className="col-span-12 grid grid-cols-2 md:grid-cols-4 gap-4" data-testid="nav-stats">
          <StatCard icon={RouteIcon} label="Active trips" value={String(active.length)} hint={`${active.filter((t) => t.status === "in_progress").length} on the road · ${active.filter((t) => t.status === "assigned").length} waiting to start`} testId="stat-active" />
          <StatCard icon={Truck} label="Trips planned today" value={String(net.trips.filter((t) => t.plan_date === today).length)} hint={`${net.trips.length} live trips recorded`} />
          <StatCard icon={Thermometer} label="Open cargo alerts" value={String(openAlerts)} hint={openAlerts ? "temperature outside the safe range" : "none on active trips"} accent={openAlerts ? "text-danger" : "text-success"} />
          <StatCard icon={openIssues ? AlertTriangle : CheckCircle2} label="Open driver issues" value={String(openIssues)} hint={openIssues ? "waiting for the hub" : "none"} accent={openIssues ? "text-warning" : "text-success"} />
        </div>
        <CargoVehicleCheck trips={active} journeys={net.journeys} />
        <EventFeedPanel events={net.events} />
      </main>
    </div>
  );
}
