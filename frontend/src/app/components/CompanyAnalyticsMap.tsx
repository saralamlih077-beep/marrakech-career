import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { CompanyAnalytics } from "../companyAnalytics";

type HeatLeaflet = typeof L & {
  heatLayer: (points: number[][], options: Record<string, unknown>) => L.Layer;
};
export default function CompanyAnalyticsMap({
  data,
  colors,
}: {
  data: CompanyAnalytics;
  colors: Record<string, string>;
}) {
  const host = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<"points" | "density">("points");
  const [error, setError] = useState("");
  useEffect(() => {
    if (!host.current || !data.geo.length) return;
    setError("");
    const map = L.map(host.current, { scrollWheelZoom: false }).setView(
      [31.63, -8],
      12,
    );
    L.tileLayer(
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}",
      { attribution: "Tiles &copy; Esri", maxZoom: 19 },
    ).addTo(map);
    const bounds = L.latLngBounds(data.geo.map((row) => [row.lat!, row.lng!]));
    map.fitBounds(bounds, { padding: [25, 25], maxZoom: 13 });
    let active = true;
    if (mode === "points")
      for (const row of data.geo) {
        const popup = document.createElement("div");
        const heading = document.createElement("strong");
        heading.textContent = row.name;
        popup.append(heading);
        const detail = document.createElement("p");
        detail.textContent = `${row.domain} · Note : ${row.rating ?? "n/d"} · Score : ${row.score ?? "n/d"}`;
        popup.append(detail);
        L.circleMarker([row.lat!, row.lng!], {
          radius: row.score === null ? 4 : Math.max(2, row.score / 1.5),
          color: colors[row.domain],
          fillOpacity: 0.65,
          weight: 1,
        })
          .bindPopup(popup)
          .addTo(map);
      }
    else {
      void import("leaflet.heat")
        .then(() => {
          if (active)
            (L as HeatLeaflet)
              .heatLayer(
                data.geo.map((row) => [row.lat!, row.lng!, 1]),
                { radius: 18, blur: 15, maxZoom: 15 },
              )
              .addTo(map);
        })
        .catch(() => {
          if (active)
            setError(
              "La carte de densité est indisponible. Choisissez la vue par entreprise.",
            );
        });
    }
    const resize = new ResizeObserver(() => map.invalidateSize());
    resize.observe(host.current);
    return () => {
      active = false;
      resize.disconnect();
      map.remove();
    };
  }, [data, colors, mode]);
  return (
    <>
      <div className="mb-3 flex flex-wrap gap-2">
        {(["points", "density"] as const).map((value) => (
          <button
            key={value}
            aria-pressed={mode === value}
            onClick={() => setMode(value)}
            className={`rounded-lg border px-3 py-2 text-xs ${mode === value ? "border-[#621E3E] bg-[#621E3E] text-white" : "border-[#EAE5E0] bg-white text-[#57534E]"}`}
          >
            {value === "points" ? "Entreprises" : "Densité"}
          </button>
        ))}
      </div>
      {data.geo.length ? (
        <div
          ref={host}
          aria-label={
            mode === "points"
              ? "Carte interactive des entreprises"
              : "Carte de densité des entreprises"
          }
          className="relative z-0 h-[420px] w-full rounded-xl"
        />
      ) : (
        <p className="py-20 text-center text-sm text-[#78716C]">
          Aucune coordonnée GPS valide.
        </p>
      )}
      {error && (
        <p role="status" className="mt-3 text-sm text-[#621E3E]">
          {error}
        </p>
      )}
      <p className="mt-3 text-xs text-[#78716C]">
        {data.geo.length} entreprises géolocalisées sur {data.rows.length}.{" "}
        {mode === "points"
          ? "Couleur : domaine · Taille : score de priorité. Cliquez sur un cercle pour voir les détails."
          : "La chaleur représente la concentration des entreprises, sans pondération par priorité."}
      </p>
      {mode === "points" && (
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs text-[#57534E]">
          {data.domains.map((domain) => (
            <span key={domain.name}>
              <span style={{ color: colors[domain.name] }}>●</span>{" "}
              {domain.name}
            </span>
          ))}
        </div>
      )}
    </>
  );
}
