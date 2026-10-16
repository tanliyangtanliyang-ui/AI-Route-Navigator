// FarmXpress shared event bus + canonical IDs.
// This simulates a centralized cloud database and cross-module realtime sync
// between: Farmer Portal, Buyer Portal, Consolidation Hub, Driver Portal,
// Government Dashboard, AI Logistics Recommendation Engine, IoT Sensor Platform.

import { useEffect, useState, useSyncExternalStore } from "react";

export type ModuleId =
  | "farmer"
  | "buyer"
  | "hub"
  | "driver"
  | "gov"
  | "ai"
  | "iot";

export const MODULES: { id: ModuleId; label: string; short: string }[] = [
  { id: "farmer", label: "Farmer Portal", short: "FARM" },
  { id: "buyer", label: "Buyer Portal", short: "BUY" },
  { id: "hub", label: "Consolidation Hub", short: "HUB" },
  { id: "driver", label: "Driver Portal", short: "DRV" },
  { id: "gov", label: "Gov Dashboard", short: "GOV" },
  { id: "ai", label: "AI Recommendation Engine", short: "AI" },
  { id: "iot", label: "IoT Sensor Platform", short: "IOT" },
];

// Canonical shared shipment context (same field names across every module).
export const SHIPMENT = {
  farmerId: "FRM-2481",
  buyerId: "BYR-7730",
  batchId: "BAT-20260725-014",
  orderId: "ORD-88213",
  routeId: "RTE-A-PLUS-KUL-PEN",
  vehicleId: "VEH-CCT-042",
  driverId: "DRV-1177",
  hubId: "HUB-KL-CENTRAL",
} as const;

export type Severity = "info" | "success" | "warning" | "danger";

export type FxEvent = {
  id: string;
  ts: number;
  source: ModuleId;
  targets: ModuleId[];
  severity: Severity;
  kind:
    | "order.created"
    | "batch.consolidated"
    | "route.recommended"
    | "driver.assigned"
    | "vehicle.dispatched"
    | "iot.temp.deviation"
    | "traffic.congestion"
    | "weather.alert"
    | "delay.detected"
    | "qc.failed"
    | "emergency"
    | "delivery.success";
  title: string;
  detail: string;
  ids?: Partial<typeof SHIPMENT>;
};

type Listener = (e: FxEvent) => void;
const listeners = new Set<Listener>();
const history: FxEvent[] = [];

let seq = 0;
function nextId() {
  seq += 1;
  return `EVT-${Date.now().toString(36)}-${seq}`;
}

export function emit(e: Omit<FxEvent, "id" | "ts">) {
  const full: FxEvent = { ...e, id: nextId(), ts: Date.now() };
  history.unshift(full);
  if (history.length > 50) history.pop();
  listeners.forEach((l) => l(full));
  return full;
}

export function subscribe(l: Listener): () => void {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

export function getHistory() {
  return history.slice();
}

// External-store subscription of the whole feed (immutable snapshot).
let snapshot: FxEvent[] = [];
function refreshSnapshot() {
  snapshot = history.slice();
}
subscribe(() => refreshSnapshot());
refreshSnapshot();

export function useFxEvents() {
  return useSyncExternalStore(
    (cb) => subscribe(() => cb()),
    () => snapshot,
    () => snapshot,
  );
}

export function useLatestEvent() {
  const [ev, setEv] = useState<FxEvent | null>(null);
  useEffect(() => {
    const unsub = subscribe(setEv);
    return () => {
      unsub();
    };
  }, []);
  return ev;
}

// ---------- Scenario simulator ----------
// Fires a realistic sequence of cross-module events so the dashboard "breathes".

const SCENARIOS: Array<Omit<FxEvent, "id" | "ts">> = [
  {
    source: "farmer",
    targets: ["hub", "ai", "buyer"],
    severity: "info",
    kind: "batch.consolidated",
    title: "Batch BAT-20260725-014 consolidated",
    detail: "Farmer FRM-2481 handed off 2.4t chilled snapper to Hub HUB-KL-CENTRAL.",
    ids: { farmerId: SHIPMENT.farmerId, batchId: SHIPMENT.batchId, hubId: SHIPMENT.hubId },
  },
  {
    source: "ai",
    targets: ["hub", "driver", "buyer"],
    severity: "success",
    kind: "route.recommended",
    title: "Route RTE-A-PLUS-KUL-PEN recommended",
    detail: "AI selected PLUS Expressway · 96% confidence, ETA 4h 20m.",
    ids: { routeId: SHIPMENT.routeId, orderId: SHIPMENT.orderId },
  },
  {
    source: "hub",
    targets: ["driver", "ai"],
    severity: "info",
    kind: "driver.assigned",
    title: "Driver DRV-1177 assigned to VEH-CCT-042",
    detail: "Cold Chain Truck dispatched from HUB-KL-CENTRAL.",
    ids: { driverId: SHIPMENT.driverId, vehicleId: SHIPMENT.vehicleId },
  },
  {
    source: "iot",
    targets: ["ai", "driver", "hub"],
    severity: "warning",
    kind: "iot.temp.deviation",
    title: "Temp deviation +1.8°C on VEH-CCT-042",
    detail: "Reefer cabin briefly at +3.8°C · outside -2 to +2°C window.",
    ids: { vehicleId: SHIPMENT.vehicleId, batchId: SHIPMENT.batchId },
  },
  {
    source: "gov",
    targets: ["ai", "driver"],
    severity: "warning",
    kind: "traffic.congestion",
    title: "Traffic congestion · Tapah–Ipoh southbound",
    detail: "JPJ reports 6 km slowdown · AI re-scoring alt routes.",
    ids: { routeId: SHIPMENT.routeId },
  },
  {
    source: "iot",
    targets: ["ai", "gov"],
    severity: "warning",
    kind: "weather.alert",
    title: "Weather alert · thunderstorm cell near Ipoh",
    detail: "METMalaysia radar shows storm cell 12 km NE of waypoint.",
  },
  {
    source: "ai",
    targets: ["buyer", "hub"],
    severity: "danger",
    kind: "delay.detected",
    title: "ETA slip +18m on ORD-88213",
    detail: "Buyer BYR-7730 notified · revised arrival 18:58 MYT.",
    ids: { orderId: SHIPMENT.orderId, buyerId: SHIPMENT.buyerId },
  },
  {
    source: "hub",
    targets: ["farmer", "gov"],
    severity: "danger",
    kind: "qc.failed",
    title: "QC flag on sub-batch BAT-…-014-C",
    detail: "3 crates failed freshness index · quarantined at HUB-KL-CENTRAL.",
    ids: { batchId: SHIPMENT.batchId, hubId: SHIPMENT.hubId },
  },
  {
    source: "driver",
    targets: ["hub", "gov", "ai"],
    severity: "danger",
    kind: "emergency",
    title: "Driver DRV-1177 pressed SOS",
    detail: "Minor incident near KM212 · roadside assistance dispatched.",
    ids: { driverId: SHIPMENT.driverId, vehicleId: SHIPMENT.vehicleId },
  },
  {
    source: "driver",
    targets: ["buyer", "hub", "farmer", "ai"],
    severity: "success",
    kind: "delivery.success",
    title: "Delivery ORD-88213 completed",
    detail: "Buyer BYR-7730 signed off · freshness 96% on arrival.",
    ids: { orderId: SHIPMENT.orderId, buyerId: SHIPMENT.buyerId },
  },
];

let simulatorStarted = false;
export function startScenarioSimulator() {
  if (simulatorStarted) return;
  simulatorStarted = true;
  let i = 0;
  // Seed a first event soon after mount so the feed isn't empty.
  const kick = setTimeout(() => emit(SCENARIOS[i++ % SCENARIOS.length]), 800);
  const iv = setInterval(() => {
    emit(SCENARIOS[i++ % SCENARIOS.length]);
  }, 6500);
  // Never cleared — this is a demo module.
  return () => {
    clearTimeout(kick);
    clearInterval(iv);
    simulatorStarted = false;
  };
}
