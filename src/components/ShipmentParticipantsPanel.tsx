import { useEffect, useState } from 'react';

// Read-only participants of the demo shipment from the shared FarmXpress API
// (GET /v1/shipments/{id}/participants). IDs are rendered exactly as returned.
const API = import.meta.env.VITE_FARMXPRESS_API_BASE_URL ?? 'http://127.0.0.1:4000/v1';
const SHIPMENT_ID = 'SHP-000006';

type Participants = { readOnly: boolean; shipment_id: string; hub_id: string; driver_id: string; vehicle_id: string; farmer_ids: string[]; buyer_ids: string[]; order_ids: string[]; batch_ids: string[] };

const list = (ids: string[]) => (ids.length ? ids.join(', ') : 'none returned');

export function ShipmentParticipantsPanel() {
  const [state, setState] = useState<{ loading: boolean; data?: Participants; error?: string }>({ loading: true });
  useEffect(() => {
    let active = true;
    fetch(`${API}/shipments/${SHIPMENT_ID}/participants`)
      .then(async (r) => (r.ok ? r.json() : Promise.reject(new Error(`API ${r.status}`))))
      .then((data: Participants) => { if (active) setState({ loading: false, data }); })
      .catch((e: Error) => { if (active) setState({ loading: false, error: e.message }); });
    return () => { active = false; };
  }, []);

  if (state.error) return <div className="col-span-12 panel border border-danger/50 p-4 text-sm">Shipment participants unavailable from the shared API ({state.error}). No participants are shown in place of the API.</div>;
  if (state.loading || !state.data) return <div className="col-span-12 panel p-4 text-sm">Loading {SHIPMENT_ID} participants from the shared API…</div>;

  const p = state.data;
  return (
    <section className="col-span-12 panel border border-primary/40 p-4 text-sm" data-source="farmxpress-api">
      <b>Who this route serves ({p.shipment_id})</b>
      <div className="mt-1 font-mono text-xs">Hub {p.hub_id} · Driver {p.driver_id} · Vehicle {p.vehicle_id}</div>
      <div className="mt-1 font-mono text-xs">Farmers: {list(p.farmer_ids)} · Buyers: {list(p.buyer_ids)} · Orders: {list(p.order_ids)}</div>
      <div className="mt-1 font-mono text-xs">Batches: {list(p.batch_ids)}</div>
      <div className="mt-2 text-xs text-muted-foreground">Shared API, read-only. The route optimisation, globe and alternative routes below are simulated.</div>
    </section>
  );
}
