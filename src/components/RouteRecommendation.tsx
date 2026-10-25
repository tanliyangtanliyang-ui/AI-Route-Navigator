import { useMemo, useState } from "react";
import { Check, Cloud, Clock, MapPin, Route as RouteIcon, TrendingUp, Zap, ArrowRight, Info } from "lucide-react";

// Route Recommendation with in-place selection.
// The route list stays visible; choosing a route only updates the details panel next to it
// (below it on small screens). Selection state lives here, so the rest of the dashboard
// (map, globe, simulator, other panels) does not re-render or change when a route is chosen.
// Comparisons are calculated from the listed route values only; nothing is added to the data.

export type RouteOption = {
  id: string;
  name: string;
  distance: string;
  eta: string;
  traffic: "Low" | "Medium" | "High";
  weather: string;
  cost: string;
  recommended: boolean;
};

const trafficColor = { Low: "text-success", Medium: "text-warning", High: "text-danger" } as const;
const TRAFFIC_RANK = { Low: 0, Medium: 1, High: 2 } as const;
const km = (s: string) => { const m = s.replace(/,/g, "").match(/([\d.]+)\s*km/i); return m ? Number(m[1]) : null; };
const minutes = (s: string) => { const m = s.match(/(?:(\d+)\s*h)?\s*(?:(\d+)\s*m)?/i); if (!m || (!m[1] && !m[2])) return null; return Number(m[1] ?? 0) * 60 + Number(m[2] ?? 0); };
const ringgit = (s: string) => { const m = s.replace(/,/g, "").match(/([\d.]+)/); return m ? Number(m[1]) : null; };
const fmtMin = (n: number) => `${Math.floor(n / 60)}h ${String(n % 60).padStart(2, "0")}m`;

type Comparison = { label: string; detail: string; good: boolean };

function compare(sel: RouteOption, other: RouteOption): Comparison[] {
  const out: Comparison[] = [];
  const [d1, d2] = [km(sel.distance), km(other.distance)];
  const [t1, t2] = [minutes(sel.eta), minutes(other.eta)];
  const [c1, c2] = [ringgit(sel.cost), ringgit(other.cost)];
  if (t1 !== null && t2 !== null && t1 !== t2) out.push({ label: t1 < t2 ? "Faster" : "Slower", detail: `${fmtMin(Math.abs(t2 - t1))} ${t1 < t2 ? "quicker" : "longer"} than Route ${other.id} (${sel.eta} vs ${other.eta})`, good: t1 < t2 });
  if (d1 !== null && d2 !== null && d1 !== d2) out.push({ label: d1 < d2 ? "Shorter" : "Longer", detail: `${Math.abs(d2 - d1)} km ${d1 < d2 ? "less" : "more"} than Route ${other.id} (${sel.distance} vs ${other.distance})`, good: d1 < d2 });
  if (c1 !== null && c2 !== null && c1 !== c2) out.push({ label: c1 < c2 ? "Cheaper" : "Costlier", detail: `RM ${Math.abs(c2 - c1).toLocaleString()} ${c1 < c2 ? "less" : "more"} than Route ${other.id} (${sel.cost} vs ${other.cost})`, good: c1 < c2 });
  if (sel.traffic !== other.traffic) out.push({ label: TRAFFIC_RANK[sel.traffic] < TRAFFIC_RANK[other.traffic] ? "Lighter traffic" : "Heavier traffic", detail: `${sel.traffic} vs ${other.traffic} on Route ${other.id}`, good: TRAFFIC_RANK[sel.traffic] < TRAFFIC_RANK[other.traffic] });
  if (sel.weather !== other.weather) out.push({ label: "Different weather", detail: `${sel.weather} vs ${other.weather} on Route ${other.id}`, good: sel.weather.toLowerCase() === "clear" });
  return out;
}

function Field({ icon: Icon, label, value, missing }: { icon: typeof Clock; label: string; value?: string; missing?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3 py-1.5 border-b border-border/40 last:border-0">
      <span className="text-xs text-muted-foreground flex items-center gap-1.5"><Icon className="w-3.5 h-3.5" />{label}</span>
      {missing
        ? <span className="text-xs text-muted-foreground italic text-right">Not in route data</span>
        : <span className="text-sm font-mono font-medium text-right">{value}</span>}
    </div>
  );
}

export function RouteRecommendation({ routes }: { routes: RouteOption[] }) {
  const defaultId = (routes.find((r) => r.recommended) ?? routes[0])?.id ?? null;
  const [selectedId, setSelectedId] = useState<string | null>(defaultId);
  const selected = routes.find((r) => r.id === selectedId) ?? null;
  const recommended = routes.find((r) => r.recommended) ?? null;
  const comparisons = useMemo(() => {
    if (!selected) return [];
    const others = selected.recommended ? routes.filter((r) => r.id !== selected.id) : recommended ? [recommended] : [];
    return others.map((o) => ({ other: o, items: compare(selected, o) }));
  }, [selected, recommended, routes]);

  return (
    <>
      <section className="col-span-12 lg:col-span-8 panel p-5" aria-labelledby="route-rec-title">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="flex items-center gap-2">
              <RouteIcon className="w-4 h-4 text-primary" />
              <h2 id="route-rec-title" className="text-base font-bold tracking-tight">Route Recommendation</h2>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">Simulated alternatives · select a route to see its details{routes.length > 1 ? " and trade-offs" : ""}</p>
          </div>
          <div className="text-[10px] font-mono uppercase tracking-widest text-primary flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" /> Model v2.4
          </div>
        </div>

        {routes.length === 0 ? (
          <p className="text-sm text-muted-foreground">No route alternatives are available.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground border-b border-border">
                  <th className="text-left py-2.5 font-normal">Current Route</th>
                  <th className="text-left py-2.5 font-normal"><MapPin className="w-3 h-3 inline mr-1" />Distance</th>
                  <th className="text-left py-2.5 font-normal"><TrendingUp className="w-3 h-3 inline mr-1" />Traffic</th>
                  <th className="text-left py-2.5 font-normal"><Cloud className="w-3 h-3 inline mr-1" />Weather</th>
                  <th className="text-left py-2.5 font-normal"><Clock className="w-3 h-3 inline mr-1" />ETA</th>
                  <th className="text-right py-2.5 font-normal">Cost</th>
                </tr>
              </thead>
              <tbody>
                {routes.map((r) => {
                  const isSel = r.id === selectedId;
                  return (
                    <tr
                      key={r.id}
                      onClick={() => setSelectedId(r.id)}
                      className={`border-b border-border/40 cursor-pointer transition ${isSel ? "bg-primary/15 outline outline-1 outline-primary/60" : "hover:bg-primary/5"}`}
                      data-route-id={r.id}
                      data-selected={isSel}
                    >
                      <td className="py-3">
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setSelectedId(r.id); }}
                          aria-pressed={isSel}
                          aria-controls="route-details"
                          className="flex items-center gap-2.5 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-lg"
                        >
                          <span className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 ${isSel ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>{r.id}</span>
                          <span>
                            <span className="block font-medium">{r.name}</span>
                            <span className="block text-[10px] font-mono uppercase tracking-wider">
                              {r.recommended && <span className="text-primary">◆ Recommended</span>}
                              {r.recommended && isSel && <span className="text-muted-foreground"> · </span>}
                              {isSel && <span className="text-foreground">Selected</span>}
                            </span>
                          </span>
                        </button>
                      </td>
                      <td className="font-mono">{r.distance}</td>
                      <td className={`font-mono font-medium ${trafficColor[r.traffic]}`}>● {r.traffic}</td>
                      <td className="font-mono">{r.weather}</td>
                      <td className="font-mono">{r.eta}</td>
                      <td className="font-mono text-right font-medium">{r.cost}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Details for the selected route: fixed structure so switching routes does not shift the layout. */}
      <section id="route-details" className="col-span-12 lg:col-span-4 panel-glow p-5 relative overflow-hidden min-h-[420px] lg:min-h-[760px]" aria-live="polite" aria-labelledby="route-details-title">
        <div className="absolute -top-16 -right-16 w-40 h-40 rounded-full bg-primary/20 blur-3xl" />
        <div className="relative">
          <div className="flex items-center gap-2 mb-1">
            <Zap className="w-4 h-4 text-primary" />
            <h2 id="route-details-title" className="text-base font-bold tracking-tight">Route Details</h2>
          </div>
          {!selected ? (
            <p className="text-sm text-muted-foreground">Select a route to see its details.</p>
          ) : (
            <>
              <p className="text-xs text-muted-foreground mb-3">
                <span className="text-primary font-semibold">Route {selected.id}</span> · {selected.name}
                {selected.recommended ? <span className="ml-1 text-primary">◆ Recommended</span> : null}
              </p>
              <div className="rounded-lg bg-background/40 border border-border/50 px-3 py-1">
                <Field icon={MapPin} label="Distance" value={selected.distance} />
                <Field icon={Clock} label="Estimated travel time" value={selected.eta} />
                <Field icon={TrendingUp} label="Traffic" value={selected.traffic} />
                <Field icon={Cloud} label="Weather" value={selected.weather} />
                <Field icon={RouteIcon} label="Estimated cost" value={selected.cost} />
                <Field icon={MapPin} label="Origin / destination / stops" missing />
                <Field icon={Info} label="Recommended vehicle" missing />
                <Field icon={Info} label="Freshness impact" missing />
              </div>

              <h3 className="mt-4 mb-2 text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                {selected.recommended ? `Why Route ${selected.id} is recommended` : `Trade-offs vs recommended Route ${recommended?.id ?? "—"}`}
              </h3>
              {comparisons.length === 0 || comparisons.every((c) => c.items.length === 0) ? (
                <p className="text-xs text-muted-foreground">No other route to compare with.</p>
              ) : (
                <ul className="space-y-2">
                  {comparisons.map(({ other, items }) => (
                    <li key={other.id} className="p-2.5 rounded-lg bg-background/40 border border-border/50" data-compare={other.id}>
                      <div className="text-xs font-semibold mb-1.5">vs Route {other.id} <span className="font-normal text-muted-foreground">· {other.name}</span></div>
                      {items.length === 0 ? <div className="text-xs text-muted-foreground">Identical listed values.</div> : (
                        <ul className="space-y-1">
                          {items.map((item) => (
                            <li key={item.label} className="flex items-start gap-2 text-xs">
                              <span className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 mt-px ${item.good ? "bg-success/20 border border-success/40" : "bg-warning/20 border border-warning/40"}`}>
                                {item.good ? <Check className="w-2.5 h-2.5 text-success" /> : <ArrowRight className="w-2.5 h-2.5 text-warning" />}
                              </span>
                              <span><span className="font-medium">{item.label}:</span> <span className="text-muted-foreground">{item.detail.replace(/ than Route [A-Z]+/, "")}</span></span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-3 text-[10px] text-muted-foreground">Comparisons are calculated from the values in the route list. The recommended flag is part of the simulated route data, not a trained model output.</p>
            </>
          )}
        </div>
      </section>
    </>
  );
}
