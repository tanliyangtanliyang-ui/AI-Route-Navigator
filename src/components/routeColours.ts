// Fixed colour per route option, shared by the map and the option buttons (kept leaflet-free so it is safe for SSR).
// A = main route (assigned, or the recorded stop order for historical shipments); B and C = alternatives for comparison.
export const OPTION_COLOURS: Record<string, string> = { A: "#1d4ed8", B: "#ea580c", C: "#9333ea" };
export const colourOf = (id: string) => OPTION_COLOURS[id] ?? "#64748b";
