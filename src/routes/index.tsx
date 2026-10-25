import { createFileRoute } from "@tanstack/react-router";
import { LogisticsDashboard } from "@/components/LogisticsDashboard";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Route Navigator · FarmXpress" },
      { name: "description", content: "Road routes for FarmXpress trips, live trip status, cargo and vehicle checks, and the network event feed." },
      { property: "og:title", content: "Route Navigator · FarmXpress" },
      { property: "og:description", content: "Road routes, trip status, cargo checks and network events for FarmXpress." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LogisticsDashboard,
});
