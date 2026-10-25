import { useEffect, useState } from "react";
import { X, Maximize2, MapPin, Info } from "lucide-react";

// ---------- Hub data ----------

export type HubStyle = "cold" | "tropical" | "port" | "highland" | "central";

export type Hub = {
  id: string;
  name: string;
  region: string;
  location: string;
  x: number; // SVG coord in 800x500 viewBox
  y: number;
  style: HubStyle;
  tagline: string;
  bullets: string[];
  advantages: string[];
};

export const HUBS: Hub[] = [
  {
    id: "HUB-RWG",
    name: "Rawang",
    region: "Selangor · Central Consolidation",
    location: "Rawang Integrated Industrial Park, Selangor",
    x: 358,
    y: 298,
    style: "central",
    tagline: "Central inbound consolidation for the Klang Valley.",
    bullets: [
      "Aggregates farmer batches from Selangor, Pahang, and Negeri Sembilan.",
      "Feeds downstream hubs (Klang for export, Ipoh for northern relay).",
      "Primary staging zone for Kuala Lumpur metro fulfilment.",
    ],
    advantages: [
      "Direct access to the North–South Expressway and KL Outer Ring",
      "Central to Klang Valley demand centres",
      "Large land footprint for cross-docking",
    ],
  },
  {
    id: "HUB-IPH",
    name: "Ipoh, Perak",
    region: "Northern Consolidation",
    location: "Jelapang Industrial Area, Ipoh",
    x: 319,
    y: 212,
    style: "highland",
    tagline: "Strategic agri-consolidation gateway to the north.",
    bullets: [
      "Ipoh sits beside major vegetable-producing regions such as Cameron Highlands and Perak.",
      "Fresh produce from nearby farms flows to Ipoh for sorting and temporary storage.",
      "Supports efficient deliveries to Penang, Kedah, and Perlis.",
      "Cuts transport distance from agricultural areas.",
    ],
    advantages: [
      "Close to agricultural production areas",
      "Lower logistics costs & land prices",
      "Shorter farm-to-hub transportation time",
    ],
  },
  {
    id: "HUB-JHB",
    name: "Johor Bahru",
    region: "Southern Regional Distribution",
    location: "Senai Industrial Area",
    x: 522,
    y: 428,
    style: "tropical",
    tagline: "Southern gateway hub · tropical fruit corridor.",
    bullets: [
      "Functions as the Southern Regional Distribution Hub.",
      "Johor is a major producer of tropical fruits, including pineapples.",
      "Senai connects through the North–South Expressway and sits near Senai International Airport.",
    ],
    advantages: [
      "Close to pineapple and tropical fruit farms",
      "Gateway to Singapore market",
      "Excellent highway and airport connectivity",
    ],
  },
  {
    id: "HUB-PEN",
    name: "Penang",
    region: "Northern Regional Distribution",
    location: "Batu Kawan Industrial Park",
    x: 270,
    y: 160,
    style: "cold",
    tagline: "Northern regional distribution & port relay.",
    bullets: [
      "Northern Regional Distribution hub with modern industrial infrastructure.",
      "Supports fresh produce distribution across Penang, Kedah, Perlis and northern Perak.",
    ],
    advantages: [
      "Serves northern consumer markets",
      "Access to Penang Port",
      "Strong highway connectivity",
    ],
  },
  {
    id: "HUB-KLG",
    name: "Klang",
    region: "Export & International Cold Chain",
    location: "Port Klang Logistics Zone",
    x: 338,
    y: 322,
    style: "port",
    tagline: "Export gateway · international cold-chain node.",
    bullets: [
      "Supports export of Malaysian fruits and vegetables.",
      "Handles container consolidation and customs clearance.",
      "Anchor for international cold-chain logistics.",
    ],
    advantages: [
      "Adjacent to Malaysia's largest seaport",
      "Container handling facilities on site",
      "Direct access to international markets",
    ],
  },
];

// Active tracked routes (source → destination hub IDs)
export const ACTIVE_ROUTES: { id: string; from: string; to: string; via?: string; label: string; progress: number }[] = [
  { id: "RTE-A", from: "HUB-RWG", to: "HUB-PEN", via: "HUB-IPH", label: "Rawang → Ipoh → Penang", progress: 0.62 },
  { id: "RTE-B", from: "HUB-KLG", to: "HUB-JHB", label: "Klang → Johor Bahru", progress: 0.34 },
  { id: "RTE-C", from: "HUB-IPH", to: "HUB-RWG", label: "Ipoh → Rawang return", progress: 0.78 },
];

// ---------- Style helpers per hub ----------

const STYLE_TOKENS: Record<HubStyle, { primary: string; accent: string; label: string; shape: "diamond" | "hex" | "square" | "triangle" | "circle" }> = {
  central:   { primary: "oklch(0.78 0.18 155)", accent: "oklch(0.88 0.14 155)", label: "CENTRAL",  shape: "circle" },
  highland:  { primary: "oklch(0.82 0.16 195)", accent: "oklch(0.92 0.10 195)", label: "HIGHLAND", shape: "hex" },
  cold:      { primary: "oklch(0.72 0.18 240)", accent: "oklch(0.86 0.14 240)", label: "COLD",     shape: "diamond" },
  tropical:  { primary: "oklch(0.80 0.18 55)",  accent: "oklch(0.90 0.14 55)",  label: "TROPICAL", shape: "triangle" },
  port:      { primary: "oklch(0.72 0.18 310)", accent: "oklch(0.86 0.14 310)", label: "PORT",     shape: "square" },
};

function HubMarker({ hub, size = 1, active, onHover, onLeave }: { hub: Hub; size?: number; active?: boolean; onHover?: () => void; onLeave?: () => void }) {
  const s = STYLE_TOKENS[hub.style];
  const r = 9 * size;

  const shape = (() => {
    switch (s.shape) {
      case "diamond":
        return <rect x={-r} y={-r} width={r * 2} height={r * 2} transform="rotate(45)" fill={s.primary} stroke={s.accent} strokeWidth={1.5} />;
      case "hex": {
        const pts = Array.from({ length: 6 }, (_, i) => {
          const a = (Math.PI / 3) * i - Math.PI / 6;
          return `${Math.cos(a) * r},${Math.sin(a) * r}`;
        }).join(" ");
        return <polygon points={pts} fill={s.primary} stroke={s.accent} strokeWidth={1.5} />;
      }
      case "triangle": {
        const pts = `0,${-r} ${r * 0.9},${r * 0.7} ${-r * 0.9},${r * 0.7}`;
        return <polygon points={pts} fill={s.primary} stroke={s.accent} strokeWidth={1.5} />;
      }
      case "square":
        return <rect x={-r} y={-r} width={r * 2} height={r * 2} rx={2} fill={s.primary} stroke={s.accent} strokeWidth={1.5} />;
      default:
        return <circle r={r} fill={s.primary} stroke={s.accent} strokeWidth={1.5} />;
    }
  })();

  return (
    <g
      transform={`translate(${hub.x}, ${hub.y})`}
      style={{ cursor: "pointer" }}
      onMouseEnter={onHover}
      onMouseLeave={onLeave}
      onClick={onHover}
      onFocus={onHover}
      tabIndex={onHover ? 0 : undefined}
    >
      {/* Outer pulse */}
      <circle r={r + 6} fill="none" stroke={s.primary} strokeWidth={1} opacity={0.4}>
        <animate attributeName="r" from={r + 6} to={r + 16} dur="2.4s" repeatCount="indefinite" />
        <animate attributeName="opacity" from="0.5" to="0" dur="2.4s" repeatCount="indefinite" />
      </circle>
      {/* Halo when active */}
      {active && <circle r={r + 10} fill="none" stroke={s.accent} strokeWidth={1.5} opacity={0.8} />}
      {/* Shape */}
      {shape}
      {/* Inner dot */}
      <circle r={r * 0.28} fill="oklch(0.14 0.02 240)" opacity={0.9} />
      {/* Label */}
      <text y={r + 14} textAnchor="middle" fontFamily="monospace" fontSize={10 * size} fontWeight={700} fill={s.primary}>
        {hub.name.toUpperCase()}
      </text>
      <text y={r + 25} textAnchor="middle" fontFamily="monospace" fontSize={8 * size} fill="oklch(0.68 0.03 240)">
        {s.label}
      </text>
    </g>
  );
}

// ---------- Peninsular Malaysia landmass ----------

function LandBase() {
  return (
    <>
      <defs>
        <linearGradient id="pmLand" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="oklch(0.26 0.045 200 / 0.7)" />
          <stop offset="100%" stopColor="oklch(0.20 0.04 250 / 0.6)" />
        </linearGradient>
        <linearGradient id="pmSea" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="oklch(0.16 0.03 240 / 0.4)" />
          <stop offset="100%" stopColor="oklch(0.12 0.025 240 / 0.7)" />
        </linearGradient>
        <pattern id="pmGrid" width="40" height="40" patternUnits="userSpaceOnUse">
          <path d="M 40 0 L 0 0 0 40" fill="none" stroke="oklch(0.82 0.16 195 / 0.07)" strokeWidth="1" />
        </pattern>
        <filter id="pmGlow">
          <feGaussianBlur stdDeviation="3" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
      <rect width="800" height="500" fill="url(#pmSea)" />
      <rect width="800" height="500" fill="url(#pmGrid)" />
      {/* Sumatra sliver */}
      <path d="M 60 470 Q 100 400 180 320 Q 130 380 90 470 Z" fill="oklch(0.20 0.03 250 / 0.35)" stroke="oklch(0.82 0.16 195 / 0.1)" />
      {/* Peninsular Malaysia */}
      <path
        d="M 240 88 L 235 130 L 250 158 L 258 195 L 285 225 L 305 258 L 320 292 L 340 325 L 365 358 L 395 385 L 435 408 L 480 425 L 520 435 L 548 438 L 555 418 L 542 388 L 522 355 L 508 322 L 500 288 L 495 250 L 485 215 L 470 180 L 452 148 L 435 115 L 415 92 L 385 78 L 340 75 L 290 80 Z"
        fill="url(#pmLand)"
        stroke="oklch(0.82 0.16 195 / 0.5)"
        strokeWidth="1.2"
      />
      {/* Singapore */}
      <circle cx="545" cy="448" r="4" fill="oklch(0.20 0.03 250)" stroke="oklch(0.82 0.16 195 / 0.4)" />
    </>
  );
}

function hubById(id: string) {
  return HUBS.find((h) => h.id === id)!;
}

function buildRoutePath(ids: string[]) {
  const pts = ids.map((id) => hubById(id));
  if (pts.length === 2) {
    const [a, b] = pts;
    const mx = (a.x + b.x) / 2;
    const my = (a.y + b.y) / 2 - 20;
    return `M ${a.x} ${a.y} Q ${mx} ${my} ${b.x} ${b.y}`;
  }
  // 3-point smooth
  const [a, b, c] = pts;
  return `M ${a.x} ${a.y} Q ${(a.x + b.x) / 2} ${(a.y + b.y) / 2 - 10} ${b.x} ${b.y} T ${c.x} ${c.y}`;
}

// ---------- Fullscreen exploration modal ----------

function HubsExplorer({ onClose }: { onClose: () => void }) {
  const [hover, setHover] = useState<Hub | null>(null);
  // Esc exits; the dashboard underneath (including the selected shipment) stays as it was.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div role="dialog" aria-modal="true" aria-label="Exploration Mode: hub network" data-testid="exploration-mode" className="fixed inset-0 z-[1000] bg-background/95 backdrop-blur-xl animate-in fade-in duration-300">
      <div className="absolute top-6 left-6 z-10 space-y-1 max-w-md">
        <div className="text-xs font-mono uppercase tracking-widest text-primary/80 flex items-center gap-2">
          <MapPin className="w-3.5 h-3.5" /> Exploration Mode · Peninsular Malaysia
        </div>
        <div className="text-2xl font-bold tracking-tight">FarmXpress Distribution Network</div>
        <div className="text-xs text-muted-foreground font-mono">
          Hover, tap or tab to a hub to inspect its role · Press Esc or Exit to return (your selected shipment stays selected)
        </div>
        <div className="text-[11px] text-warning" data-testid="exploration-disclaimer">
          Illustrative network concept from the original design: these {HUBS.length} hubs are not FarmXpress dataset hubs (the dataset has HUB-001 Cameron Highlands and HUB-002 Klang Valley).
        </div>
      </div>
      <button
        onClick={onClose}
        className="absolute top-6 right-6 z-10 flex items-center gap-2 px-4 py-2 rounded-lg border border-border bg-card/80 hover:bg-card hover:border-primary/50 transition-all text-sm font-mono"
      >
        <X className="w-4 h-4" /> Exit Exploration Mode
      </button>

      {/* Legend */}
      <div className="absolute bottom-6 left-6 z-10 panel px-4 py-3 space-y-2">
        <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Hub Classes</div>
        <div className="grid grid-cols-1 gap-1.5">
          {(Object.keys(STYLE_TOKENS) as HubStyle[]).map((k) => (
            <div key={k} className="flex items-center gap-2 text-[11px] font-mono">
              <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: STYLE_TOKENS[k].primary }} />
              <span className="text-foreground">{STYLE_TOKENS[k].label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="w-full h-full flex items-center justify-center p-4 pt-24">
        <svg viewBox="0 0 800 500" className="w-full h-full max-w-[1200px]" preserveAspectRatio="xMidYMid meet">
          <LandBase />

          {/* Active routes */}
          {ACTIVE_ROUTES.map((r) => {
            const ids = r.via ? [r.from, r.via, r.to] : [r.from, r.to];
            const d = buildRoutePath(ids);
            return (
              <g key={r.id}>
                <path d={d} stroke="oklch(0.82 0.16 195 / 0.35)" strokeWidth="2.5" fill="none" strokeDasharray="6 6" />
                <path d={d} stroke="oklch(0.96 0.01 220)" strokeWidth="1" fill="none" strokeDasharray="2 10" strokeLinecap="round">
                  <animate attributeName="stroke-dashoffset" from="0" to="-48" dur="1.6s" repeatCount="indefinite" />
                </path>
              </g>
            );
          })}

          {/* Hub markers */}
          {HUBS.map((h) => (
            <HubMarker
              key={h.id}
              hub={h}
              size={1.3}
              active={hover?.id === h.id}
              onHover={() => setHover(h)}
              onLeave={() => setHover((c) => (c?.id === h.id ? null : c))}
            />
          ))}
        </svg>
      </div>

      {/* Hover details card */}
      <div className="absolute right-6 top-24 bottom-24 w-[360px] z-10 pointer-events-none">
        <div className={`panel h-full p-5 overflow-y-auto transition-opacity duration-200 ${hover ? "opacity-100" : "opacity-60"}`}>
          {hover ? (
            <div className="space-y-4">
              <div>
                <div className="text-[10px] font-mono uppercase tracking-widest text-primary">
                  {STYLE_TOKENS[hover.style].label} HUB · {hover.id}
                </div>
                <div className="text-xl font-bold tracking-tight mt-1">Distribution Hub: {hover.name}</div>
                <div className="text-xs text-muted-foreground mt-1">{hover.location}</div>
                <div className="text-[11px] font-mono text-primary/80 mt-1">{hover.region}</div>
              </div>
              <div className="text-sm text-foreground/90 italic border-l-2 border-primary/50 pl-3">
                {hover.tagline}
              </div>
              <div>
                <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-1.5">Role</div>
                <ul className="space-y-1.5 text-[12px] text-foreground/90">
                  {hover.bullets.map((b, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="text-primary shrink-0">›</span>
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-1.5">Advantages</div>
                <ul className="space-y-1 text-[12px] text-foreground/90">
                  {hover.advantages.map((a, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="text-success shrink-0">✓</span>
                      <span>{a}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center gap-3 text-muted-foreground">
              <Info className="w-6 h-6 text-primary/60" />
              <div className="text-sm font-mono">Hover any hub icon</div>
              <div className="text-[11px]">Location, role and strategic advantages will appear here.</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------- Compact HUD button (drop-in replacement for GlobeIconButton) ----------

export function GlobeIconButton() {
  const [hover, setHover] = useState(false);
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        onClick={() => setOpen(true)}
        className="group relative w-16 h-16 md:w-20 md:h-20 rounded-2xl border border-primary/40 bg-background/70 backdrop-blur-xl shadow-[0_0_30px_-5px_oklch(0.82_0.16_195/0.5)] hover:border-primary hover:scale-105 transition-all cursor-pointer overflow-hidden"
        aria-label="Explore FarmXpress hubs across Peninsular Malaysia"
      >
        {/* Rotating corner accents */}
        <span className="absolute top-1 left-1 w-2 h-2 border-l border-t border-primary/70" />
        <span className="absolute top-1 right-1 w-2 h-2 border-r border-t border-primary/70" />
        <span className="absolute bottom-1 left-1 w-2 h-2 border-l border-b border-primary/70" />
        <span className="absolute bottom-1 right-1 w-2 h-2 border-r border-b border-primary/70" />

        {/* Mini peninsular Malaysia silhouette with hub dots */}
        <svg viewBox="200 60 380 400" className="absolute inset-1.5">
          <path
            d="M 240 88 L 235 130 L 250 158 L 258 195 L 285 225 L 305 258 L 320 292 L 340 325 L 365 358 L 395 385 L 435 408 L 480 425 L 520 435 L 548 438 L 555 418 L 542 388 L 522 355 L 508 322 L 500 288 L 495 250 L 485 215 L 470 180 L 452 148 L 435 115 L 415 92 L 385 78 L 340 75 L 290 80 Z"
            fill="oklch(0.82 0.16 195 / 0.15)"
            stroke="oklch(0.82 0.16 195 / 0.9)"
            strokeWidth={hover ? 3 : 2}
          />
          {HUBS.map((h) => {
            const s = STYLE_TOKENS[h.style];
            return (
              <g key={h.id} transform={`translate(${h.x}, ${h.y})`}>
                <circle r={hover ? 18 : 12} fill={s.primary} opacity={0.25}>
                  <animate attributeName="r" from={12} to={26} dur="1.8s" repeatCount="indefinite" />
                  <animate attributeName="opacity" from="0.5" to="0" dur="1.8s" repeatCount="indefinite" />
                </circle>
                <circle r={9} fill={s.primary} stroke={s.accent} strokeWidth={2} />
              </g>
            );
          })}
        </svg>

        {/* Ping dot */}
        <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-success">
          <span className="absolute inset-0 rounded-full bg-success animate-ping opacity-75" />
        </span>

        {/* Tooltip */}
        <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 whitespace-nowrap text-[10px] font-mono uppercase tracking-widest text-primary opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 pointer-events-none">
          <Maximize2 className="w-2.5 h-2.5" /> Explore Hubs
        </span>
      </button>

      {open && <HubsExplorer onClose={() => setOpen(false)} />}
    </>
  );
}

// Clearly labelled entry point to Exploration Mode (the small HUD icon remains available elsewhere).
export function ExplorationModeButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} data-testid="open-exploration"
        className="inline-flex items-center gap-2 rounded-md border border-primary/40 px-3 py-1.5 text-xs font-medium hover:bg-primary/10">
        <Maximize2 className="w-3.5 h-3.5" /> Exploration Mode <span className="text-muted-foreground">· hub network</span>
      </button>
      {open && <HubsExplorer onClose={() => setOpen(false)} />}
    </>
  );
}
