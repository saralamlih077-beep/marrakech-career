import { lazy, Suspense, useMemo, useState } from "react";
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { CompanyStatus, PageHeader } from "../components/shared";
import type { Company } from "../types";
import { buildCompanyAnalytics } from "../companyAnalytics";
import {
  AnalyticsPanel as Panel,
  AnalyticsHistogram as Histogram,
  AnalyticsBoxPlot,
  AnalyticsHeatmap,
  AnalyticsNetwork,
  analyticsPalette as palette,
  priorityColor,
  numberLabel as format,
  domainTick as short,
  chartTick as tick,
  chartTooltip as tooltip,
} from "../components/CompanyAnalyticsFigures";
const MapChart = lazy(() => import("../components/CompanyAnalyticsMap"));
const ThreeDChart = lazy(() => import("../components/CompanyAnalytics3D"));

export default function AdminDataScreen({
  companies,
  loading,
  error,
}: {
  companies: Company[];
  loading: boolean;
  error: string | null;
}) {
  const data = useMemo(() => buildCompanyAnalytics(companies), [companies]);
  const colors = useMemo(
    () =>
      Object.fromEntries(
        data.domains.map((domain, i) => [
          domain.name,
          palette[i % palette.length],
        ]),
      ),
    [data],
  );
  const [section, setSection] = useState("distribution");
  const tabs = [
    ["distribution", "Répartitions"],
    ["relations", "Notes et priorité"],
    ["map", "Cartographie"],
    ["network", "Réseau et 3D"],
  ];
  const stacked = data.domains.map((domain) =>
    Object.fromEntries([
      ["name", domain.name],
      ...domain.priorities.map((value, i) => [`p${i}`, value]),
    ]),
  );
  const radar = data.radar.map((row) =>
    Object.fromEntries([
      ["axis", row.axis],
      ...row.values.map((value, i) => [`d${i}`, value]),
    ]),
  );
  const minReviews = data.points.length
    ? Math.min(...data.points.map((row) => row.reviews!))
    : 1;
  const maxReviews = data.points.length
    ? Math.max(...data.points.map((row) => row.reviews!))
    : 10;
  const reviewsDomain =
    minReviews === maxReviews
      ? [minReviews / Math.sqrt(10), maxReviews * Math.sqrt(10)]
      : [minReviews, maxReviews];
  const logTicks = Array.from(
    {
      length: Math.max(
        1,
        Math.ceil(Math.log10(reviewsDomain[1])) -
          Math.floor(Math.log10(reviewsDomain[0])) +
          1,
      ),
    },
    (_, i) => 10 ** (Math.floor(Math.log10(reviewsDomain[0])) + i),
  ).filter((value) => value >= reviewsDomain[0] && value <= reviewsDomain[1]);
  return (
    <div className="min-w-0 flex-1 overflow-auto bg-[#FBF9F7] p-4 sm:p-6 lg:p-8">
      <PageHeader
        title="Analyse des données"
        sub="Les visualisations du notebook, calculées sur les entreprises de Marrakech Career."
      />
      <CompanyStatus loading={loading} error={error} />
      {!loading &&
        !error &&
        (data.rows.length ? (
          <>
            <div className="mb-5 flex flex-wrap gap-x-5 gap-y-2 rounded-xl border border-[#EAE5E0] bg-white p-4 text-xs text-[#57534E]">
              <span>
                <b className="text-[#621E3E]">{data.rows.length}</b> entreprises
              </span>
              <span>
                <b>{data.domains.length}</b> domaines
              </span>
              <span>
                <b>{data.missingRatings}</b> notes manquantes
              </span>
              <span>
                <b>{data.missingScores}</b> scores manquants
              </span>
              <span>
                <b>{data.geo.length}</b> coordonnées GPS valides
              </span>
            </div>
            <div
              className="mb-5 flex flex-wrap gap-2"
              aria-label="Sections des visualisations"
            >
              {tabs.map(([value, label]) => (
                <button
                  key={value}
                  aria-pressed={section === value}
                  onClick={() => setSection(value)}
                  className={`rounded-xl border px-4 py-2.5 text-xs font-semibold ${section === value ? "border-[#621E3E] bg-[#621E3E] text-white" : "border-[#EAE5E0] bg-white text-[#57534E] hover:border-[#621E3E]"}`}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="grid min-w-0 gap-5 xl:grid-cols-2">
              {section === "distribution" && (
                <>
                  <Panel
                    title="Distribution des notes"
                    description="Histogramme de la note Google · 10 intervalles. Les notes manquantes sont exclues."
                  >
                    <Histogram
                      data={data.ratingHistogram}
                      color="#427C99"
                      axis="Note Google"
                    />
                  </Panel>
                  <Panel
                    title="Distribution du score de priorité"
                    description="Nombre d’entreprises pour chaque score enregistré. Ce score est celui du jeu de données."
                  >
                    <Histogram
                      data={data.scoreHistogram}
                      color="#D0744A"
                      axis="Score de priorité"
                    />
                  </Panel>
                  <Panel
                    title="Distribution du nombre d’avis"
                    description="Histogramme de log10(nombre d’avis) · 12 intervalles. Les valeurs nulles, absentes ou négatives sont exclues."
                  >
                    <Histogram
                      data={data.reviewsHistogram}
                      color="#667436"
                      axis="log10(nombre d’avis)"
                    />
                  </Panel>
                  <Panel
                    title="Nombre d’entreprises par domaine"
                    description="Tous les domaines, du plus représenté au moins représenté."
                  >
                    <ResponsiveContainer width="100%" height={360}>
                      <BarChart
                        data={data.domains}
                        layout="vertical"
                        margin={{ left: 0, right: 30 }}
                      >
                        <CartesianGrid
                          horizontal={false}
                          strokeDasharray="3 3"
                        />
                        <XAxis
                          type="number"
                          allowDecimals={false}
                          tick={tick}
                        />
                        <YAxis
                          type="category"
                          dataKey="name"
                          width={145}
                          tick={tick}
                          tickFormatter={short}
                        />
                        <Tooltip contentStyle={tooltip} />
                        <Bar
                          name="Entreprises"
                          dataKey="count"
                          label={{ position: "right", fontSize: 10 }}
                          radius={[0, 4, 4, 0]}
                        >
                          {data.domains.map((domain) => (
                            <Cell
                              key={domain.name}
                              fill={colors[domain.name]}
                            />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </Panel>
                  <Panel
                    title="Priorité des entreprises par domaine"
                    description="Barres empilées : effectifs réels par priorité, y compris les priorités non renseignées."
                  >
                    <div className="overflow-x-auto">
                      <div className="min-w-[600px]">
                        <ResponsiveContainer width="100%" height={370}>
                          <BarChart
                            data={stacked}
                            margin={{ bottom: 20, left: -15 }}
                          >
                            <CartesianGrid
                              vertical={false}
                              strokeDasharray="3 3"
                            />
                            <XAxis
                              dataKey="name"
                              tick={tick}
                              tickFormatter={short}
                              angle={-35}
                              textAnchor="end"
                              interval={0}
                              height={80}
                            />
                            <YAxis allowDecimals={false} tick={tick} />
                            <Tooltip contentStyle={tooltip} />
                            <Legend
                              verticalAlign="top"
                              wrapperStyle={{ fontSize: 11, paddingBottom: 12 }}
                            />
                            {data.priorities.map((priority, i) => (
                              <Bar
                                key={priority}
                                name={priority}
                                dataKey={`p${i}`}
                                stackId="priorities"
                                fill={priorityColor(priority, i)}
                              />
                            ))}
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </Panel>
                  <Panel
                    title="Répartition des entreprises par domaine"
                    description="Diagramme en secteurs : les cinq premiers domaines et « Autres ». Les pourcentages couvrent tout le catalogue."
                  >
                    <ResponsiveContainer width="100%" height={245}>
                      <PieChart>
                        <Pie
                          data={data.pie}
                          dataKey="value"
                          nameKey="name"
                          outerRadius={90}
                          label={({ percent }) =>
                            `${(percent * 100).toFixed(1)} %`
                          }
                          labelLine={false}
                        >
                          {data.pie.map((item, i) => (
                            <Cell
                              key={item.name}
                              fill={
                                item.name === "Autres"
                                  ? "#A8A29E"
                                  : colors[item.name] || palette[i]
                              }
                            />
                          ))}
                        </Pie>
                        <Tooltip contentStyle={tooltip} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-[#57534E]">
                      {data.pie.map((item) => (
                        <span key={item.name}>
                          <span
                            style={{ color: colors[item.name] || "#A8A29E" }}
                          >
                            ●
                          </span>{" "}
                          {item.name} : <b>{item.value}</b> (
                          {format((item.value / data.rows.length) * 100, 1)} %)
                        </span>
                      ))}
                    </div>
                  </Panel>
                </>
              )}
              {section === "relations" && (
                <>
                  {(["rating", "count"] as const).map((key) => (
                    <Panel
                      key={key}
                      title={
                        key === "rating"
                          ? "Note moyenne selon le score de priorité"
                          : "Nombre d’entreprises selon le score de priorité"
                      }
                      description="Courbe sur une variable ordonnée : le score. Le jeu de données ne fournit pas de chronologie."
                    >
                      <ResponsiveContainer width="100%" height={240}>
                        <LineChart
                          data={data.trend}
                          margin={{ left: -15, right: 15, bottom: 15 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis
                            dataKey="score"
                            tick={tick}
                            label={{
                              value: "Score de priorité",
                              position: "insideBottom",
                              offset: -10,
                              fontSize: 10,
                            }}
                          />
                          <YAxis
                            domain={
                              key === "rating" ? [0, 5] : ["auto", "auto"]
                            }
                            allowDecimals={key === "rating"}
                            tick={tick}
                          />
                          <Tooltip
                            contentStyle={tooltip}
                            formatter={(value: number) => format(value)}
                          />
                          <Line
                            name={
                              key === "rating" ? "Note moyenne" : "Entreprises"
                            }
                            dataKey={key}
                            stroke={key === "rating" ? "#7B65A4" : "#D0744A"}
                            strokeWidth={2}
                            connectNulls={false}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </Panel>
                  ))}
                  <Panel
                    title="Relation entre nombre d’avis et note"
                    description={`${data.points.length} entreprises avec note et avis positifs. Couleur : priorité. Corrélation note / log10(avis) : ${format(data.correlation, 3)}.`}
                  >
                    {data.points.length ? (
                      <ResponsiveContainer width="100%" height={300}>
                        <ScatterChart
                          margin={{ left: -5, right: 15, bottom: 25 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis
                            type="number"
                            dataKey="reviews"
                            name="Avis"
                            scale="log"
                            domain={reviewsDomain}
                            ticks={logTicks}
                            allowDataOverflow
                            tick={tick}
                            tickFormatter={(value) =>
                              Number(value).toLocaleString("fr-FR")
                            }
                            label={{
                              value: "Nombre d’avis (échelle log)",
                              position: "insideBottom",
                              offset: -15,
                              fontSize: 10,
                            }}
                          />
                          <YAxis
                            type="number"
                            dataKey="rating"
                            name="Note"
                            domain={[0, 5]}
                            tick={tick}
                          />
                          <Tooltip
                            contentStyle={tooltip}
                            content={({ active, payload }) => {
                              const row = payload?.[0]?.payload;
                              return active && row ? (
                                <div className="rounded-lg border bg-white p-3 text-xs">
                                  <b>{row.name}</b>
                                  <p>
                                    {row.priority} · Note : {row.rating} · Avis
                                    : {row.reviews}
                                  </p>
                                </div>
                              ) : null;
                            }}
                          />
                          <Legend
                            verticalAlign="top"
                            height={30}
                            wrapperStyle={{ fontSize: 11 }}
                          />
                          {data.priorities.map((priority, i) => (
                            <Scatter
                              key={priority}
                              name={priority}
                              data={data.points.filter(
                                (row) => row.priority === priority,
                              )}
                              fill={priorityColor(priority, i)}
                              fillOpacity={0.7}
                            />
                          ))}
                        </ScatterChart>
                      </ResponsiveContainer>
                    ) : (
                      <p className="py-20 text-sm text-[#78716C]">
                        Aucune note associée à un nombre d’avis positif.
                      </p>
                    )}
                  </Panel>
                  <Panel
                    title="Profil des quatre principaux domaines"
                    description="Radar sur cinq critères. Échelle relative 0–10 : chaque critère est divisé par le maximum de tous les domaines, comme dans le notebook."
                  >
                    <ResponsiveContainer width="100%" height={330}>
                      <RadarChart data={radar} outerRadius="60%">
                        <PolarGrid />
                        <PolarAngleAxis dataKey="axis" tick={tick} />
                        <PolarRadiusAxis domain={[0, 10]} tick={false} />
                        <Tooltip
                          contentStyle={tooltip}
                          formatter={(value: number) => format(value)}
                        />
                        <Legend wrapperStyle={{ fontSize: 10 }} />
                        {data.domains.slice(0, 4).map((domain, i) => (
                          <Radar
                            key={domain.name}
                            name={domain.name}
                            dataKey={`d${i}`}
                            stroke={colors[domain.name]}
                            fill={colors[domain.name]}
                            fillOpacity={0.12}
                          />
                        ))}
                      </RadarChart>
                    </ResponsiveContainer>
                  </Panel>
                  <Panel
                    title="Entreprises par domaine et score de priorité"
                    description="Carte de chaleur : chaque case indique le nombre d’entreprises. Plus la couleur est foncée, plus l’effectif est élevé."
                    wide
                  >
                    <AnalyticsHeatmap data={data} />
                  </Panel>
                  <Panel
                    title="Répartition des notes par domaine"
                    description="Boîtes : médiane, quartiles et valeurs extrêmes. Les entreprises sans note sont exclues."
                    wide
                  >
                    <AnalyticsBoxPlot data={data} colors={colors} />
                  </Panel>
                  <Panel
                    title="Nombre d’entreprises, note moyenne et priorité"
                    description="Graphique combiné à trois axes : barres pour les effectifs, ligne pour la note moyenne, aire pour le score moyen."
                    wide
                  >
                    <div className="overflow-x-auto">
                      <div className="min-w-[720px]">
                        <ResponsiveContainer width="100%" height={380}>
                          <ComposedChart
                            data={data.domains}
                            margin={{ bottom: 20, left: 0, right: 10 }}
                          >
                            <CartesianGrid
                              vertical={false}
                              strokeDasharray="3 3"
                            />
                            <XAxis
                              dataKey="name"
                              tick={tick}
                              tickFormatter={short}
                              angle={-30}
                              textAnchor="end"
                              interval={0}
                              height={70}
                            />
                            <YAxis
                              yAxisId="count"
                              allowDecimals={false}
                              tick={tick}
                            />
                            <YAxis
                              yAxisId="rating"
                              orientation="right"
                              domain={[0, 5.5]}
                              width={45}
                              tick={{ ...tick, fill: "#D0744A" }}
                            />
                            <YAxis
                              yAxisId="score"
                              orientation="right"
                              width={45}
                              tick={{ ...tick, fill: "#667436" }}
                            />
                            <Tooltip
                              contentStyle={tooltip}
                              formatter={(value: number) => format(value)}
                            />
                            <Legend
                              verticalAlign="top"
                              wrapperStyle={{ fontSize: 11 }}
                            />
                            <Area
                              yAxisId="score"
                              name="Score moyen"
                              dataKey="score"
                              fill="#667436"
                              fillOpacity={0.18}
                              stroke="#667436"
                            />
                            <Bar
                              yAxisId="count"
                              name="Nombre d’entreprises"
                              dataKey="count"
                              fill="#427C99"
                            />
                            <Line
                              yAxisId="rating"
                              name="Note moyenne"
                              dataKey="rating"
                              stroke="#D0744A"
                              strokeWidth={2}
                            />
                          </ComposedChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                    <p className="text-xs text-[#78716C]">
                      Axe gauche : nombre · Axes droits : note (orange) et score
                      (vert).
                    </p>
                  </Panel>
                </>
              )}
              {section === "map" && (
                <Panel
                  title="Cartographie des entreprises"
                  description="Carte interactive des positions géographiques et variante en carte de densité."
                  wide
                >
                  <Suspense
                    fallback={
                      <p className="py-20 text-sm text-[#78716C]">
                        Chargement de la carte…
                      </p>
                    }
                  >
                    <MapChart data={data} colors={colors} />
                  </Suspense>
                </Panel>
              )}
              {section === "network" && (
                <>
                  <Panel
                    title="Réseau domaine ↔ catégorie"
                    description="Chaque lien représente des entreprises partageant un domaine et une catégorie. La disposition sépare les domaines des catégories pour faciliter la lecture."
                    wide
                  >
                    <AnalyticsNetwork data={data} />
                  </Panel>
                  <Panel
                    title="Visualisations 3D interactives"
                    description="Deux vues du notebook : note, popularité et priorité ; puis longitude, latitude et priorité. Les points sans les valeurs nécessaires sont exclus."
                    wide
                  >
                    <Suspense
                      fallback={
                        <p className="py-20 text-sm text-[#78716C]">
                          Chargement des vues 3D…
                        </p>
                      }
                    >
                      <ThreeDChart data={data} colors={colors} />
                    </Suspense>
                  </Panel>
                </>
              )}
            </div>
            <p className="mt-6 text-xs leading-relaxed text-[#78716C]">
              Source : entreprises actives dans la base du projet. Les données
              manquantes ne deviennent pas zéro, sauf dans la normalisation du
              radar prévue par le notebook. Les scores de priorité sont repris
              du catalogue.
            </p>
          </>
        ) : (
          <p className="rounded-xl border border-[#EAE5E0] bg-white p-8 text-sm text-[#78716C]">
            Aucune entreprise disponible pour l’analyse.
          </p>
        ))}
    </div>
  );
}
