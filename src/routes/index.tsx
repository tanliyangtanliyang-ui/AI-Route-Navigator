import { createFileRoute } from "@tanstack/react-router";
import { LogisticsDashboard } from "@/components/LogisticsDashboard";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "AI Logistics Command · Route & Fleet Intelligence" },
      { name: "description", content: "Real-time AI-powered route recommendation, risk analysis, and cold-chain vehicle matching with interactive 3D global network visualization." },
      { property: "og:title", content: "AI Logistics Command · Route & Fleet Intelligence" },
      { property: "og:description", content: "Real-time AI route recommendation, risk analysis, and cold-chain vehicle matching." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LogisticsDashboard,
});
