import { useEffect, useRef, useState } from "react";
import type { CompanyAnalytics } from "../companyAnalytics";

type PlotlyAPI = {
  newPlot: (
    host: HTMLElement,
    traces: unknown[],
    layout: unknown,
    config: unknown,
  ) => Promise<unknown>;
  purge: (host: HTMLElement) => void;
  Plots: { resize: (host: HTMLElement) => void };
};
export default function CompanyAnalytics3D({
  data,
  colors,
}: {
  data: CompanyAnalytics;
  colors: Record<string, string>;
}) {
  const host = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<"ratings" | "geo">("ratings");
  const [status, setStatus] = useState("Chargement du graphique 3D…");
  const rows =
    mode === "ratings"
      ? data.points.filter((row) => row.score !== null)
      : data.geo.filter((row) => row.score !== null);
  useEffect(() => {
    const element = host.current;
    if (!element || !rows.length) return;
    let active = true,
      plot: PlotlyAPI | undefined,
      resize: ResizeObserver | undefined;
    setStatus("Chargement du graphique 3D…");
    void import("plotly.js-gl3d-dist-min")
      .then(async (module) => {
        if (!active) return;
        plot = (module.default || module) as unknown as PlotlyAPI;
        const traces = data.domains.flatMap((domain) => {
          const group = rows.filter((row) => row.domain === domain.name);
          return group.length
            ? [
                {
                  type: "scatter3d",
                  mode: "markers",
                  name: domain.name,
                  x: group.map((row) =>
                    mode === "ratings" ? row.rating : row.lng,
                  ),
                  y: group.map((row) =>
                    mode === "ratings" ? row.logReviews : row.lat,
                  ),
                  z: group.map((row) => row.score),
                  text: group.map((row) => row.name.replace(/[<>&]/g, " ")),
                  hovertemplate:
                    "%{text}<br>%{x:.2f} · %{y:.2f}<br>Score : %{z}<extra>%{fullData.name}</extra>",
                  marker: { size: 4, color: colors[domain.name], opacity: 0.8 },
                },
              ]
            : [];
        });
        await plot.newPlot(
          element,
          traces,
          {
            autosize: true,
            height: 460,
            margin: { l: 0, r: 0, b: 0, t: 10 },
            showlegend: false,
            paper_bgcolor: "#ffffff",
            scene: {
              xaxis: {
                title: {
                  text: mode === "ratings" ? "Note Google" : "Longitude",
                },
              },
              yaxis: {
                title: {
                  text: mode === "ratings" ? "log10(avis)" : "Latitude",
                },
              },
              zaxis: { title: { text: "Score de priorité" } },
            },
          },
          {
            responsive: true,
            displaylogo: false,
            modeBarButtonsToRemove: ["toImage"],
            scrollZoom: false,
          },
        );
        if (!active) {
          plot.purge(element);
          return;
        }
        resize = new ResizeObserver(() => plot?.Plots.resize(element));
        resize.observe(element);
        setStatus("");
      })
      .catch(() => {
        if (active)
          setStatus(
            "Le graphique 3D est indisponible dans ce navigateur. Les données restent disponibles ci-dessous.",
          );
      });
    return () => {
      active = false;
      resize?.disconnect();
      plot?.purge(element);
    };
  }, [data, colors, mode]);
  return (
    <>
      <div className="mb-3 flex flex-wrap gap-2">
        {(["ratings", "geo"] as const).map((value) => (
          <button
            key={value}
            aria-pressed={mode === value}
            onClick={() => setMode(value)}
            className={`rounded-lg border px-3 py-2 text-xs ${mode === value ? "border-[#621E3E] bg-[#621E3E] text-white" : "border-[#EAE5E0] text-[#57534E]"}`}
          >
            {value === "ratings"
              ? "Note · Avis · Priorité"
              : "Localisation · Priorité"}
          </button>
        ))}
      </div>
      {rows.length ? (
        <>
          <div
            ref={host}
            aria-label="Nuage de points en trois dimensions"
            className="min-h-[460px] w-full"
          />
          {status && (
            <p role="status" className="text-sm text-[#78716C]">
              {status}
            </p>
          )}
        </>
      ) : (
        <p className="py-20 text-sm text-[#78716C]">
          Aucune entreprise ne dispose des trois valeurs nécessaires.
        </p>
      )}
      <p className="mt-3 text-xs text-[#78716C]">
        {rows.length} entreprises représentées. Faites glisser pour tourner,
        utilisez les commandes pour zoomer. Couleur : domaine.
      </p>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs text-[#57534E]" aria-label="Couleurs des domaines">
        {data.domains.map((domain) => <span key={domain.name}><span style={{ color: colors[domain.name] }}>●</span> {domain.name}</span>)}
      </div>
      <details className="mt-3 text-xs text-[#57534E]">
        <summary className="cursor-pointer">Voir les données 3D</summary>
        <div className="mt-2 max-h-60 overflow-auto">
          <table className="w-full text-left">
            <thead>
              <tr>
                <th>Entreprise</th>
                <th>{mode === "ratings" ? "Note" : "Longitude"}</th>
                <th>{mode === "ratings" ? "log10(avis)" : "Latitude"}</th>
                <th>Score</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.company.id}>
                  <td className="py-1 pr-3">{row.name}</td>
                  <td>
                    {(mode === "ratings" ? row.rating : row.lng)?.toFixed(2)}
                  </td>
                  <td>
                    {(mode === "ratings" ? row.logReviews : row.lat)?.toFixed(
                      2,
                    )}
                  </td>
                  <td>{row.score}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </>
  );
}
