import { Check, Fish, Snowflake, Truck, Cloud, MapPin, TrendingUp, Zap, AlertTriangle, Route as RouteIcon, Wind, Thermometer, Package, Activity, Clock, DollarSign, Bell, Radio, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { GlobeIconButton, HUBS, ACTIVE_ROUTES } from "./InteractiveGlobe";
import {
  MODULES,
  SHIPMENT,
  startScenarioSimulator,
  subscribe,
  useFxEvents,
  type FxEvent,
  type ModuleId,
  type Severity,
} from "@/lib/farmxpress-events";

type RouteOption = {
  id: string;
  name: string;
  distance: string;
  eta: string;
  traffic: "Low" | "Medium" | "High";
  weather: string;
  cost: string;
  recommended: boolean;
};

const routes: RouteOption[] = [
  { id: "A", name: "PLUS Expressway (KL→Ipoh→Penang)", distance: "355 km", eta: "4h 20m", traffic: "Low", weather: "Clear", cost: "RM 1,240", recommended: true },
  { id: "B", name: "Coastal Rd via Klang", distance: "398 km", eta: "5h 10m", traffic: "High", weather: "Rain", cost: "RM 1,180", recommended: false },
  { id: "C", name: "Inland via Cameron", distance: "445 km", eta: "6h 05m", traffic: "Medium", weather: "Fog", cost: "RM 1,420", recommended: false },
];

const trafficColor = { Low: "text-success", Medium: "text-warning", High: "text-danger" };

function StatCard({ icon: Icon, label, value, hint, accent }: { icon: any; label: string; value: string; hint?: string; accent?: string }) {
  return (
    <div className="panel p-4 relative overflow-hidden group hover:border-primary/40 transition-colors">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
      <div className="flex items-start justify-between">
        <div>
          <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">{label}</div>
          <div className="mt-1.5 text-2xl font-bold tracking-tight">{value}</div>
          {hint && <div className={`text-xs mt-0.5 ${accent ?? "text-muted-foreground"}`}>{hint}</div>}
        </div>
        <div className="p-2 rounded-lg bg-primary/10 border border-primary/20">
          <Icon className="w-4 h-4 text-primary" />
        </div>
      </div>
    </div>
  );
}

const CITIES: { name: string; code: string; x: number; y: number }[] = [
  { name: "Alor Setar", code: "AOR", x: 265, y: 107 },
  { name: "Penang", code: "PEN", x: 263, y: 156 },
  { name: "Kota Bharu", code: "KBR", x: 407, y: 107 },
  { name: "Ipoh", code: "IPH", x: 319, y: 212 },
  { name: "Kuantan", code: "KUA", x: 489, y: 266 },
  { name: "Kuala Lumpur", code: "KUL", x: 365, y: 312 },
  { name: "Melaka", code: "MKZ", x: 407, y: 378 },
  { name: "Johor Bahru", code: "JHB", x: 522, y: 428 },
];

function MapView() {
  return (
    <div className="panel relative h-full w-full overflow-hidden">
      {/* HUD corners */}
      <div className="absolute top-3 left-3 w-6 h-6 border-l-2 border-t-2 border-primary/60 z-20" />
      <div className="absolute top-3 right-3 w-6 h-6 border-r-2 border-t-2 border-primary/60 z-20" />
      <div className="absolute bottom-3 left-3 w-6 h-6 border-l-2 border-b-2 border-primary/60 z-20" />
      <div className="absolute bottom-3 right-3 w-6 h-6 border-r-2 border-b-2 border-primary/60 z-20" />

      <div className="absolute top-4 left-4 z-20 flex items-center gap-2">
        <div className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
        <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Live Route Tracking</span>
        <span className="text-[10px] font-mono uppercase tracking-widest text-primary/60 ml-1">· Semenanjung Malaysia</span>
      </div>

      <div className="absolute top-4 right-4 z-20 flex gap-1.5">
        {["Satellite", "Terrain", "Traffic"].map((v, i) => (
          <button key={v} className={`px-2.5 py-1 text-[10px] font-mono uppercase tracking-wider rounded border transition ${i === 2 ? "border-primary/60 bg-primary/10 text-primary" : "border-border text-muted-foreground hover:text-foreground"}`}>{v}</button>
        ))}
      </div>

      {/* Floating globe icon button (opens fullscreen exploration) */}
      <div className="absolute top-16 right-4 z-20 pt-2">
        <GlobeIconButton />
      </div>

      {/* Compass */}
      <div className="absolute bottom-16 right-4 z-20 w-12 h-12 rounded-full border border-primary/30 bg-background/60 backdrop-blur flex items-center justify-center">
        <div className="relative w-full h-full">
          <span className="absolute top-1 left-1/2 -translate-x-1/2 text-[9px] font-mono text-primary font-bold">N</span>
          <span className="absolute bottom-1 left-1/2 -translate-x-1/2 text-[9px] font-mono text-muted-foreground">S</span>
          <span className="absolute left-1 top-1/2 -translate-y-1/2 text-[9px] font-mono text-muted-foreground">W</span>
          <span className="absolute right-1 top-1/2 -translate-y-1/2 text-[9px] font-mono text-muted-foreground">E</span>
          <div className="absolute inset-3 flex items-center justify-center">
            <div className="w-0 h-0 border-l-[3px] border-l-transparent border-r-[3px] border-r-transparent border-b-[8px] border-b-primary" />
          </div>
        </div>
      </div>

      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 800 500" preserveAspectRatio="xMidYMid meet">
        <defs>
          <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="oklch(0.82 0.16 195 / 0.08)" strokeWidth="1"/>
          </pattern>
          <linearGradient id="routeGrad" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stopColor="oklch(0.82 0.16 195)" />
            <stop offset="100%" stopColor="oklch(0.72 0.18 310)" />
          </linearGradient>
          <linearGradient id="landGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="oklch(0.26 0.045 200 / 0.55)" />
            <stop offset="100%" stopColor="oklch(0.22 0.04 250 / 0.5)" />
          </linearGradient>
          <linearGradient id="seaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="oklch(0.18 0.03 240 / 0.4)" />
            <stop offset="100%" stopColor="oklch(0.14 0.025 240 / 0.6)" />
          </linearGradient>
          <filter id="glow">
            <feGaussianBlur stdDeviation="3" result="b"/>
            <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
          <filter id="landShadow">
            <feDropShadow dx="0" dy="2" stdDeviation="4" floodColor="oklch(0.82 0.16 195)" floodOpacity="0.15"/>
          </filter>
        </defs>

        <rect width="800" height="500" fill="url(#seaGrad)"/>
        <rect width="800" height="500" fill="url(#grid)"/>

        {/* Sea ripple hints */}
        <g opacity="0.15" stroke="oklch(0.82 0.16 195)" fill="none" strokeWidth="0.5">
          <path d="M 80 220 Q 130 215 180 220 T 220 220"/>
          <path d="M 100 260 Q 150 255 200 260"/>
          <path d="M 600 180 Q 650 175 700 180 T 760 180"/>
          <path d="M 620 320 Q 670 315 720 320"/>
        </g>

        {/* Sumatra sliver (SW context) */}
        <path d="M 60 470 Q 100 400 180 320 Q 130 380 90 470 Z" fill="oklch(0.20 0.03 250 / 0.35)" stroke="oklch(0.82 0.16 195 / 0.1)"/>

        {/* Peninsular Malaysia landmass */}
        <path
          d="M 240 88 L 235 130 L 250 158 L 258 195 L 285 225 L 305 258 L 320 292 L 340 325 L 365 358 L 395 385 L 435 408 L 480 425 L 520 435 L 548 438 L 555 418 L 542 388 L 522 355 L 508 322 L 500 288 L 495 250 L 485 215 L 470 180 L 452 148 L 435 115 L 415 92 L 385 78 L 340 75 L 290 80 Z"
          fill="url(#landGrad)"
          stroke="oklch(0.82 0.16 195 / 0.4)"
          strokeWidth="1.2"
          filter="url(#landShadow)"
        />

        {/* Singapore island dot */}
        <circle cx="545" cy="448" r="4" fill="oklch(0.20 0.03 250)" stroke="oklch(0.82 0.16 195 / 0.4)"/>

        {/* Active tracked delivery routes between FarmXpress hubs */}
        {ACTIVE_ROUTES.map((r) => {
          const from = HUBS.find((h) => h.id === r.from)!;
          const to = HUBS.find((h) => h.id === r.to)!;
          const via = r.via ? HUBS.find((h) => h.id === r.via) : undefined;
          const d = via
            ? `M ${from.x} ${from.y} Q ${(from.x + via.x) / 2} ${(from.y + via.y) / 2 - 10} ${via.x} ${via.y} T ${to.x} ${to.y}`
            : `M ${from.x} ${from.y} Q ${(from.x + to.x) / 2} ${(from.y + to.y) / 2 - 20} ${to.x} ${to.y}`;
          const isPrimary = r.id === "RTE-A";
          return (
            <g key={r.id}>
              <path
                d={d}
                stroke={isPrimary ? "url(#routeGrad)" : "oklch(0.55 0.10 250 / 0.55)"}
                strokeWidth={isPrimary ? 4 : 2.2}
                fill="none"
                strokeLinecap="round"
                strokeDasharray={isPrimary ? undefined : "6 6"}
                filter={isPrimary ? "url(#glow)" : undefined}
              />
              <path d={d} stroke="oklch(0.96 0.01 220)" strokeWidth="1" fill="none" strokeDasharray="2 8" strokeLinecap="round">
                <animate attributeName="stroke-dashoffset" from="0" to="-40" dur="1.6s" repeatCount="indefinite" />
              </path>
            </g>
          );
        })}

        {/* Hub markers */}
        {HUBS.map((h) => {
          const isPort = h.style === "port";
          const isCold = h.style === "cold";
          const isTrop = h.style === "tropical";
          const isHigh = h.style === "highland";
          const color = isPort
            ? "oklch(0.72 0.18 310)"
            : isCold
            ? "oklch(0.72 0.18 240)"
            : isTrop
            ? "oklch(0.80 0.18 55)"
            : isHigh
            ? "oklch(0.82 0.16 195)"
            : "oklch(0.78 0.18 155)";
          return (
            <g key={h.id} transform={`translate(${h.x}, ${h.y})`}>
              <circle r="14" fill="none" stroke={color} strokeWidth="1" opacity="0.5">
                <animate attributeName="r" from="10" to="22" dur="2.2s" repeatCount="indefinite" />
                <animate attributeName="opacity" from="0.6" to="0" dur="2.2s" repeatCount="indefinite" />
              </circle>
              {isPort ? (
                <rect x="-7" y="-7" width="14" height="14" rx="2" fill={color} stroke="oklch(0.14 0.02 240)" strokeWidth="1.2" />
              ) : isCold ? (
                <rect x="-7" y="-7" width="14" height="14" transform="rotate(45)" fill={color} stroke="oklch(0.14 0.02 240)" strokeWidth="1.2" />
              ) : isTrop ? (
                <polygon points="0,-8 7,6 -7,6" fill={color} stroke="oklch(0.14 0.02 240)" strokeWidth="1.2" />
              ) : isHigh ? (
                <polygon
                  points={Array.from({ length: 6 }, (_, i) => {
                    const a = (Math.PI / 3) * i - Math.PI / 6;
                    return `${Math.cos(a) * 8},${Math.sin(a) * 8}`;
                  }).join(" ")}
                  fill={color}
                  stroke="oklch(0.14 0.02 240)"
                  strokeWidth="1.2"
                />
              ) : (
                <circle r="8" fill={color} stroke="oklch(0.14 0.02 240)" strokeWidth="1.2" />
              )}
              <text y="-13" textAnchor="middle" fontSize="10" fontFamily="monospace" fontWeight="700" fill={color}>
                {h.name.toUpperCase()}
              </text>
              <text y="22" textAnchor="middle" fontSize="8" fontFamily="monospace" fill="oklch(0.68 0.03 240)">
                {h.id}
              </text>
            </g>
          );
        })}

        {/* Truck in transit near Ipoh (primary route ~62%) */}
        <g transform="translate(319, 212)">
          <circle r="14" fill="oklch(0.16 0.03 250)" stroke="oklch(0.82 0.16 195)" strokeWidth="2" />
          <text textAnchor="middle" y="4" fontSize="14">🚛</text>
        </g>


        {/* Scale bar */}
        <g transform="translate(30, 470)">
          <line x1="0" y1="0" x2="60" y2="0" stroke="oklch(0.82 0.16 195 / 0.6)" strokeWidth="1.5"/>
          <line x1="0" y1="-4" x2="0" y2="4" stroke="oklch(0.82 0.16 195 / 0.6)" strokeWidth="1.5"/>
          <line x1="60" y1="-4" x2="60" y2="4" stroke="oklch(0.82 0.16 195 / 0.6)" strokeWidth="1.5"/>
          <text x="30" y="-6" textAnchor="middle" fill="oklch(0.68 0.03 240)" fontSize="9" fontFamily="monospace">100 km</text>
        </g>
      </svg>

      {/* Bottom telemetry strip */}
      <div className="absolute bottom-4 left-4 right-4 z-20 flex items-center justify-between px-4 py-2.5 rounded-lg bg-background/70 border border-border backdrop-blur">
        <div className="flex items-center gap-4 text-[10px] font-mono uppercase tracking-widest">
          <span className="text-muted-foreground">Speed <span className="text-foreground font-bold">86 km/h</span></span>
          <span className="text-muted-foreground">Progress <span className="text-primary font-bold">62%</span></span>
          <span className="text-muted-foreground">Payload <span className="text-foreground font-bold">2.4t</span></span>
        </div>
        <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-widest text-success">
          <div className="w-1.5 h-1.5 rounded-full bg-success animate-pulse"/>
          On Schedule
        </div>
      </div>
    </div>
  );
}

const severityTone: Record<Severity, { chip: string; dot: string; toast: (t: string, d: string) => void }> = {
  info: { chip: "bg-primary/10 border-primary/30 text-primary", dot: "bg-primary", toast: (t, d) => toast(t, { description: d }) },
  success: { chip: "bg-success/10 border-success/30 text-success", dot: "bg-success", toast: (t, d) => toast.success(t, { description: d }) },
  warning: { chip: "bg-warning/10 border-warning/30 text-warning", dot: "bg-warning", toast: (t, d) => toast.warning(t, { description: d }) },
  danger: { chip: "bg-danger/10 border-danger/30 text-danger", dot: "bg-danger", toast: (t, d) => toast.error(t, { description: d }) },
};

function timeAgo(ts: number) {
  const s = Math.max(1, Math.floor((Date.now() - ts) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  return `${m}m ${s % 60}s ago`;
}

function NotificationBell() {
  const events = useFxEvents();
  const [open, setOpen] = useState(false);
  const seenRef = useRef(0);
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    if (open) {
      seenRef.current = events.length;
      setUnread(0);
    } else {
      setUnread(events.length - seenRef.current);
    }
  }, [events, open]);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative p-2 rounded-lg border border-border hover:border-primary/50 hover:bg-primary/5 transition"
        aria-label="Notifications"
      >
        <Bell className="w-4 h-4 text-foreground" />
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-danger text-[9px] font-bold text-white flex items-center justify-center border border-background animate-pulse">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-[340px] max-h-[70vh] overflow-y-auto panel p-0 z-50 shadow-2xl">
          <div className="flex items-center justify-between px-3 py-2 border-b border-border sticky top-0 bg-background/95 backdrop-blur">
            <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">FarmXpress Feed</div>
            <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground"><X className="w-3.5 h-3.5" /></button>
          </div>
          {events.length === 0 && (
            <div className="p-6 text-center text-xs text-muted-foreground">Awaiting cross-module signals…</div>
          )}
          {events.map((e) => (
            <div key={e.id} className="px-3 py-2.5 border-b border-border/40 hover:bg-primary/5 transition">
              <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                <span className={`w-1.5 h-1.5 rounded-full ${severityTone[e.severity].dot}`} />
                <span className="text-primary">{MODULES.find((m) => m.id === e.source)?.short}</span>
                <span>→</span>
                <span className="truncate">{e.targets.map((t) => MODULES.find((m) => m.id === t)?.short).join(" · ")}</span>
                <span className="ml-auto">{timeAgo(e.ts)}</span>
              </div>
              <div className="text-xs font-semibold mt-1">{e.title}</div>
              <div className="text-[11px] text-muted-foreground">{e.detail}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ModuleSyncStrip() {
  const [pings, setPings] = useState<Record<ModuleId, number>>({} as Record<ModuleId, number>);
  useEffect(() => {
    return subscribe((e) => {
      setPings((p) => {
        const next = { ...p, [e.source]: Date.now() };
        e.targets.forEach((t) => (next[t] = Date.now()));
        return next;
      });
    });
  }, []);
  return (
    <div className="col-span-12 panel px-4 py-2.5 flex items-center gap-3 overflow-x-auto">
      <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-widest text-muted-foreground shrink-0">
        <Radio className="w-3 h-3 text-primary animate-pulse" /> Module Sync
      </div>
      <div className="w-px h-4 bg-border" />
      <div className="flex items-center gap-2">
        {MODULES.map((m) => {
          const ping = pings[m.id];
          const active = ping && Date.now() - ping < 3500;
          return (
            <div
              key={m.id}
              className={`flex items-center gap-1.5 px-2 py-1 rounded border text-[10px] font-mono uppercase tracking-wider transition ${
                active ? "border-primary/60 bg-primary/10 text-primary" : "border-border text-muted-foreground"
              }`}
              title={m.label}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${active ? "bg-primary animate-pulse" : "bg-muted-foreground/40"}`} />
              {m.short}
            </div>
          );
        })}
      </div>
      <div className="ml-auto hidden md:flex items-center gap-3 text-[10px] font-mono uppercase tracking-widest text-muted-foreground shrink-0">
        <span>ORDER <span className="text-foreground">{SHIPMENT.orderId}</span></span>
        <span>BATCH <span className="text-foreground">{SHIPMENT.batchId}</span></span>
        <span>VEH <span className="text-foreground">{SHIPMENT.vehicleId}</span></span>
      </div>
    </div>
  );
}

function EventFeedPanel() {
  const events = useFxEvents();
  return (
    <section className="col-span-12 panel p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="flex items-center gap-2">
            <Radio className="w-4 h-4 text-primary" />
            <h2 className="text-base font-bold tracking-tight">Cross-Module Event Feed</h2>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">Live signals across FarmXpress · shared IDs & synchronized state</p>
        </div>
        <div className="text-[10px] font-mono uppercase tracking-widest text-primary flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" /> Streaming
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 max-h-[340px] overflow-y-auto pr-1">
        {events.length === 0 && (
          <div className="col-span-full text-center text-xs text-muted-foreground py-8">Awaiting cross-module signals…</div>
        )}
        {events.map((e) => (
          <div key={e.id} className={`p-3 rounded-lg border ${severityTone[e.severity].chip} bg-background/40`}>
            <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-widest">
              <span className={`w-1.5 h-1.5 rounded-full ${severityTone[e.severity].dot}`} />
              <span>{MODULES.find((m) => m.id === e.source)?.short}</span>
              <span className="text-muted-foreground">→</span>
              <span className="text-muted-foreground truncate">{e.targets.map((t) => MODULES.find((m) => m.id === t)?.short).join(" · ")}</span>
              <span className="ml-auto text-muted-foreground">{timeAgo(e.ts)}</span>
            </div>
            <div className="text-sm font-semibold mt-1 text-foreground">{e.title}</div>
            <div className="text-xs text-muted-foreground">{e.detail}</div>
            {e.ids && (
              <div className="mt-1.5 flex flex-wrap gap-1">
                {Object.entries(e.ids).map(([k, v]) => (
                  <span key={k} className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-background/60 border border-border text-muted-foreground">
                    {k}:{v}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

function useLiveDashboardState() {
  const events = useFxEvents();
  return useMemo(() => {
    let etaSlipMin = 0;
    let risk: "Low" | "Elevated" | "High" = "Low";
    let tempDeviation = 0.3;
    let trafficLevel: "Low" | "Medium" | "High" = "Low";
    let weather = "Clear";
    let alerts = 0;
    let confidence = 96;
    for (const e of events) {
      if (e.kind === "delay.detected") { etaSlipMin += 18; risk = "Elevated"; alerts++; confidence = Math.min(confidence, 84); }
      if (e.kind === "iot.temp.deviation") { tempDeviation = 1.8; risk = risk === "High" ? risk : "Elevated"; alerts++; }
      if (e.kind === "traffic.congestion") { trafficLevel = "High"; risk = risk === "High" ? risk : "Elevated"; alerts++; confidence = Math.min(confidence, 88); }
      if (e.kind === "weather.alert") { weather = "Storm cell"; alerts++; }
      if (e.kind === "qc.failed") { risk = "High"; alerts++; }
      if (e.kind === "emergency") { risk = "High"; alerts++; confidence = Math.min(confidence, 72); }
      if (e.kind === "delivery.success") { alerts = 0; risk = "Low"; etaSlipMin = 0; tempDeviation = 0.2; trafficLevel = "Low"; weather = "Clear"; confidence = 98; }
    }
    return { etaSlipMin, risk, tempDeviation, trafficLevel, weather, alerts, confidence };
  }, [events]);
}

function formatEta(baseMin: number, slipMin: number) {
  const total = baseMin + slipMin;
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${h}h ${m.toString().padStart(2, "0")}m`;
}

export function LogisticsDashboard() {
  const live = useLiveDashboardState();

  // Kick off the scenario simulator + subscribe to toast pop-ups.
  useEffect(() => {
    const stop = startScenarioSimulator();
    const unsub = subscribe((e: FxEvent) => {
      severityTone[e.severity].toast(e.title, e.detail);
    });
    return () => {
      unsub();
      stop?.();
    };
  }, []);

  const riskAccent = live.risk === "Low" ? "text-success" : live.risk === "Elevated" ? "text-warning" : "text-danger";

  return (
    <div className="min-h-screen">
      {/* Top bar */}
      <header className="border-b border-border/60 backdrop-blur-xl bg-background/60 sticky top-0 z-30">
        <div className="flex items-center justify-between px-6 py-3 gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center shrink-0">
              <Activity className="w-5 h-5 text-primary-foreground"/>
            </div>
            <div className="min-w-0">
              <div className="text-sm font-bold tracking-tight truncate">AI Logistics Management</div>
              <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground truncate">FarmXpress · Module 03 · AI Recommendation Engine</div>
            </div>
          </div>
          <div className="flex items-center gap-3 md:gap-6 text-[11px] font-mono uppercase tracking-widest text-muted-foreground">
            <div className="hidden lg:flex items-center gap-1.5"><div className={`w-1.5 h-1.5 rounded-full ${live.alerts === 0 ? "bg-success" : "bg-warning"} animate-pulse`}/>{live.alerts === 0 ? "All Systems Nominal" : `${live.alerts} Active Alert${live.alerts > 1 ? "s" : ""}`}</div>
            <div className="hidden md:block">Fleet <span className="text-foreground font-bold">247</span></div>
            <div className="hidden md:block">Active <span className="text-primary font-bold">183</span></div>
            <div className="hidden sm:block text-primary text-glow">14:32:07 MYT</div>
            <NotificationBell />
          </div>
        </div>
      </header>

      <main className="p-4 lg:p-6 grid grid-cols-12 gap-4 lg:gap-6 auto-rows-min">
        <ModuleSyncStrip />
        {/* Stats row */}
        <div className="col-span-12 grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard icon={RouteIcon} label="Optimal Route" value="Route A" hint={`AI Confidence ${live.confidence}%`} accent="text-primary" />
          <StatCard icon={Clock} label="ETA" value={formatEta(260, live.etaSlipMin)} hint={live.etaSlipMin === 0 ? "↓ 12% vs baseline" : `↑ +${live.etaSlipMin}m slip`} accent={live.etaSlipMin === 0 ? "text-success" : "text-warning"} />
          <StatCard icon={DollarSign} label="Est. Cost" value="RM 1,240" hint="↓ RM 180 saved" accent="text-success" />
          <StatCard icon={AlertTriangle} label="Risk Level" value={live.risk} hint={live.alerts === 0 ? "No critical alerts" : `${live.alerts} active signal${live.alerts > 1 ? "s" : ""}`} accent={riskAccent} />
        </div>


        {/* Map (full width now — globe lives on it) */}
        <div className="col-span-12 h-[500px]">
          <MapView />
        </div>

        {/* Route Recommendation */}
        <section className="col-span-12 lg:col-span-8 panel p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="flex items-center gap-2">
                <RouteIcon className="w-4 h-4 text-primary"/>
                <h2 className="text-base font-bold tracking-tight">Route Recommendation</h2>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">AI-ranked alternatives · updated 12s ago</p>
            </div>
            <div className="text-[10px] font-mono uppercase tracking-widest text-primary flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"/> Model v2.4
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground border-b border-border">
                  <th className="text-left py-2.5 font-normal">Current Route</th>
                  <th className="text-left py-2.5 font-normal"><MapPin className="w-3 h-3 inline mr-1"/>Distance</th>
                  <th className="text-left py-2.5 font-normal"><TrendingUp className="w-3 h-3 inline mr-1"/>Traffic</th>
                  <th className="text-left py-2.5 font-normal"><Cloud className="w-3 h-3 inline mr-1"/>Weather</th>
                  <th className="text-left py-2.5 font-normal"><Clock className="w-3 h-3 inline mr-1"/>ETA</th>
                  <th className="text-right py-2.5 font-normal">Cost</th>
                </tr>
              </thead>
              <tbody>
                {routes.map(r => (
                  <tr key={r.id} className={`border-b border-border/40 hover:bg-primary/5 transition ${r.recommended ? "bg-primary/5" : ""}`}>
                    <td className="py-3">
                      <div className="flex items-center gap-2.5">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs ${r.recommended ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>{r.id}</div>
                        <div>
                          <div className="font-medium">{r.name}</div>
                          {r.recommended && <div className="text-[10px] font-mono uppercase tracking-wider text-primary">◆ Recommended</div>}
                        </div>
                      </div>
                    </td>
                    <td className="font-mono">{r.distance}</td>
                    <td className={`font-mono font-medium ${trafficColor[r.traffic]}`}>● {r.traffic}</td>
                    <td className="font-mono">{r.weather}</td>
                    <td className="font-mono">{r.eta}</td>
                    <td className="font-mono text-right font-medium">{r.cost}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* AI Explanation Panel */}
        <section className="col-span-12 lg:col-span-4 panel-glow p-5 relative overflow-hidden">
          <div className="absolute -top-16 -right-16 w-40 h-40 rounded-full bg-primary/20 blur-3xl"/>
          <div className="relative">
            <div className="flex items-center gap-2 mb-1">
              <Zap className="w-4 h-4 text-primary"/>
              <h2 className="text-base font-bold tracking-tight">AI Explanation</h2>
            </div>
            <p className="text-xs text-muted-foreground mb-4">Why <span className="text-primary font-semibold">Route A</span>?</p>

            <ul className="space-y-2.5">
              {[
                { label: "Lower Traffic", detail: "42% fewer congestion points" },
                { label: "Better Weather", detail: "Clear skies, 8 km visibility" },
                { label: "Faster ETA", detail: "50 minutes ahead of Route B" },
                { label: "Lower Cost", detail: "$180 savings incl. fuel" },
              ].map(item => (
                <li key={item.label} className="flex items-start gap-3 p-2.5 rounded-lg bg-background/40 border border-border/50 hover:border-primary/40 transition">
                  <div className="w-5 h-5 rounded-full bg-success/20 border border-success/40 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Check className="w-3 h-3 text-success"/>
                  </div>
                  <div>
                    <div className="text-sm font-medium">{item.label}</div>
                    <div className="text-xs text-muted-foreground">{item.detail}</div>
                  </div>
                </li>
              ))}
            </ul>

            <div className="mt-4 pt-4 border-t border-border/50 flex items-center justify-between">
              <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Confidence</div>
              <div className="flex items-center gap-2">
                <div className="w-24 h-1.5 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-primary to-accent" style={{width: "96%"}}/>
                </div>
                <span className="text-sm font-bold text-primary font-mono">96%</span>
              </div>
            </div>
          </div>
        </section>

        {/* Risk Level & Vehicle Recommendation */}
        <section className="col-span-12 panel p-5">
          <div className="flex items-center justify-between mb-5">
            <div>
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-warning"/>
                <h2 className="text-base font-bold tracking-tight">Risk Level & Vehicle Recommendation</h2>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">Cargo-aware AI matching · cold chain & sensitive cargo detection</p>
            </div>
            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-success/10 border border-success/30">
              <div className="w-1.5 h-1.5 rounded-full bg-success animate-pulse"/>
              <span className="text-[10px] font-mono uppercase tracking-widest text-success">Overall Risk: Low</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            {/* Product */}
            <div className="p-4 rounded-lg bg-background/40 border border-border/50">
              <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground flex items-center gap-1.5 mb-2">
                <Package className="w-3 h-3"/> Product
              </div>
              <div className="flex items-center gap-2">
                <Fish className="w-8 h-8 text-primary"/>
                <div>
                  <div className="text-lg font-bold">Fish</div>
                  <div className="text-[10px] text-muted-foreground font-mono">SKU · SF-2481</div>
                </div>
              </div>
            </div>

            {/* Freshness */}
            <div className="p-4 rounded-lg bg-background/40 border border-border/50">
              <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground flex items-center gap-1.5 mb-2">
                <Activity className="w-3 h-3"/> Freshness
              </div>
              <div className="text-lg font-bold text-success">98%</div>
              <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-success to-primary" style={{width: "98%"}}/>
              </div>
              <div className="text-[10px] text-muted-foreground mt-1.5 font-mono">Perishable · 36h window</div>
            </div>

            {/* Temperature Requirement */}
            <div className="p-4 rounded-lg bg-background/40 border border-border/50">
              <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground flex items-center gap-1.5 mb-2">
                <Thermometer className="w-3 h-3"/> Temp Requirement
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-lg font-bold">-2°C</span>
                <span className="text-muted-foreground text-xs">to</span>
                <span className="text-lg font-bold">+2°C</span>
              </div>
              <div className="flex items-center gap-1 mt-1 text-[10px] font-mono text-primary">
                <Snowflake className="w-3 h-3"/> Cold Chain Required
              </div>
            </div>

            {/* Arrow */}
            <div className="flex items-center justify-center">
              <div className="hidden md:flex flex-col items-center gap-1">
                <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">AI Match</div>
                <svg width="60" height="24" viewBox="0 0 60 24" className="text-primary">
                  <defs>
                    <linearGradient id="arrow" x1="0" x2="1">
                      <stop offset="0" stopColor="oklch(0.82 0.16 195)" stopOpacity="0.2"/>
                      <stop offset="1" stopColor="oklch(0.82 0.16 195)"/>
                    </linearGradient>
                  </defs>
                  <line x1="0" y1="12" x2="50" y2="12" stroke="url(#arrow)" strokeWidth="2" strokeDasharray="4 3"/>
                  <path d="M 45 6 L 55 12 L 45 18" fill="none" stroke="currentColor" strokeWidth="2"/>
                </svg>
                <div className="text-[10px] font-mono uppercase tracking-widest text-primary">96% Fit</div>
              </div>
              <div className="md:hidden text-2xl text-primary">↓</div>
            </div>

            {/* Recommended Vehicle */}
            <div className="p-4 rounded-lg bg-gradient-to-br from-primary/15 to-accent/10 border border-primary/40 relative overflow-hidden">
              <div className="absolute -bottom-4 -right-4 opacity-10">
                <Truck className="w-20 h-20"/>
              </div>
              <div className="text-[10px] font-mono uppercase tracking-widest text-primary flex items-center gap-1.5 mb-2">
                <Truck className="w-3 h-3"/> Recommended
              </div>
              <div className="text-lg font-bold text-glow">Cold Chain Truck</div>
              <div className="text-xs text-muted-foreground font-mono mt-0.5">Reefer · Class-B</div>
              <div className="flex gap-1 mt-2 flex-wrap">
                <span className="text-[9px] font-mono uppercase px-1.5 py-0.5 rounded bg-primary/20 text-primary border border-primary/30">-4°C to +4°C</span>
                <span className="text-[9px] font-mono uppercase px-1.5 py-0.5 rounded bg-primary/20 text-primary border border-primary/30">GPS</span>
              </div>
            </div>
          </div>

          {/* Risk factors row */}
          <div className="mt-5 pt-5 border-t border-border/50 grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { icon: Thermometer, label: "Temp Deviation", value: `${live.tempDeviation.toFixed(1)}°C`, high: live.tempDeviation > 1 },
              { icon: Wind, label: "Wind Impact", value: "12 km/h", high: false },
              { icon: Cloud, label: "Precipitation", value: live.weather === "Storm cell" ? "72%" : "8%", high: live.weather === "Storm cell" },
              { icon: AlertTriangle, label: "Incident Rate", value: live.alerts === 0 ? "None" : `${live.alerts} open`, high: live.alerts > 0 },
            ].map(f => (
              <div key={f.label} className="flex items-center gap-2.5 text-xs">
                <div className={`p-1.5 rounded ${f.high ? "bg-warning/10 border border-warning/30" : "bg-success/10 border border-success/30"}`}>
                  <f.icon className={`w-3.5 h-3.5 ${f.high ? "text-warning" : "text-success"}`}/>
                </div>
                <div>
                  <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">{f.label}</div>
                  <div className="font-mono font-medium">{f.value}</div>
                </div>
              </div>
            ))}
          </div>
        </section>


        <EventFeedPanel />
      </main>

    </div>
  );
}
