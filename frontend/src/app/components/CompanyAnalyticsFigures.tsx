import { useState, type ReactNode } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { CompanyAnalytics } from "../companyAnalytics";
export const analyticsPalette = [
  "#621E3E",
  "#667436",
  "#D9828D",
  "#427C99",
  "#C49B36",
  "#7B65A4",
  "#469588",
  "#D0744A",
  "#8A8F49",
  "#5966A0",
  "#BA6686",
  "#78716C",
];
export const priorityColor = (name: string, index: number) =>
  name === "Haute"
    ? "#D0744A"
    : name === "Moyenne"
      ? "#427C99"
      : analyticsPalette[index % analyticsPalette.length];
export const numberLabel = (number: number | null, digits = 2) =>
  number === null
    ? "n/d"
    : number.toLocaleString("fr-FR", { maximumFractionDigits: digits });
export const domainTick = (name: string) =>
  name.length > 22 ? `${name.slice(0, 21)}…` : name;
export const chartTick = { fontSize: 10, fill: "#78716C" };
export const chartTooltip = {
  borderRadius: 10,
  border: "1px solid #EAE5E0",
  fontSize: 12,
  maxWidth: 300,
};
export function AnalyticsPanel({
  title,
  description,
  children,
  wide = false,
}: {
  title: string;
  description: string;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <section
      className={`min-w-0 rounded-2xl border border-[#EAE5E0] bg-white p-4 shadow-sm sm:p-5 ${wide ? "xl:col-span-2" : ""}`}
      aria-label={title}
    >
      <h2 className="text-sm font-bold text-[#1C1917]">{title}</h2>
      <p className="mb-4 mt-1 text-xs leading-relaxed text-[#78716C]">
        {description}
      </p>
      {children}
    </section>
  );
}
export function AnalyticsHistogram({
  data,
  color,
  axis,
}: {
  data: { label: string; value: number }[];
  color: string;
  axis: string;
}) {
  if (!data.length)
    return (
      <p className="py-16 text-center text-sm text-[#78716C]">
        Aucune valeur disponible.
      </p>
    );
  return (
    <>
      <ResponsiveContainer width="100%" height={230}>
        <BarChart
          data={data}
          margin={{ left: -20, right: 5, bottom: 15 }}
          barCategoryGap={1}
        >
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="label"
            tick={chartTick}
            tickFormatter={(label) => String(label).split("–")[0]}
            minTickGap={20}
            label={{
              value: axis,
              position: "insideBottom",
              offset: -10,
              fontSize: 10,
            }}
          />
          <YAxis allowDecimals={false} tick={chartTick} />
          <Tooltip contentStyle={chartTooltip} />
          <Bar name="Entreprises" dataKey="value" fill={color} />
        </BarChart>
      </ResponsiveContainer>
      <details className="mt-2 text-xs text-[#57534E]">
        <summary className="cursor-pointer">Intervalles et effectifs</summary>
        <ul className="mt-2 space-y-1">
          {data.map((bin) => (
            <li key={bin.label}>
              {bin.label} : <b>{bin.value}</b>
            </li>
          ))}
        </ul>
      </details>
    </>
  );
}
export function AnalyticsBoxPlot({
  data,
  colors,
}: {
  data: CompanyAnalytics;
  colors: Record<string, string>;
}) {
  const height = data.boxes.length * 38 + 55;
  return data.boxes.length ? (
    <div className="overflow-x-auto">
      <svg
        viewBox={`0 0 850 ${height}`}
        className="w-full min-w-[640px]"
        role="img"
        aria-label="Boîtes des notes par domaine : quartiles, médiane, moustaches et valeurs extrêmes"
      >
        {[0, 1, 2, 3, 4, 5].map((value) => (
          <g key={value}>
            <line
              x1={250 + value * 110}
              x2={250 + value * 110}
              y1={15}
              y2={height - 35}
              stroke="#EAE5E0"
            />
            <text
              x={250 + value * 110}
              y={height - 12}
              fontSize={11}
              fill="#78716C"
              textAnchor="middle"
            >
              {value}
            </text>
          </g>
        ))}
        {data.boxes.map((box, i) => {
          const y = 30 + i * 38,
            x = (value: number) => 250 + value * 110;
          return (
            <g key={box.name}>
              <title>{`${box.name} · n=${box.count} · Q1=${numberLabel(box.q1)} · Médiane=${numberLabel(box.median)} · Q3=${numberLabel(box.q3)} · Moustaches=${numberLabel(box.min)}–${numberLabel(box.max)}`}</title>
              <text
                x={235}
                y={y + 4}
                fontSize={11}
                textAnchor="end"
                fill="#57534E"
              >
                {box.name}
              </text>
              <line
                x1={x(box.min)}
                x2={x(box.max)}
                y1={y}
                y2={y}
                stroke={colors[box.name]}
                strokeWidth={2}
              />
              {[box.min, box.max].map((v, j) => (
                <line
                  key={j}
                  x1={x(v)}
                  x2={x(v)}
                  y1={y - 7}
                  y2={y + 7}
                  stroke={colors[box.name]}
                />
              ))}
              <rect
                x={x(box.q1)}
                y={y - 10}
                width={Math.max(1, x(box.q3) - x(box.q1))}
                height={20}
                fill={colors[box.name]}
                fillOpacity={0.25}
                stroke={colors[box.name]}
              />
              <line
                x1={x(box.median)}
                x2={x(box.median)}
                y1={y - 10}
                y2={y + 10}
                stroke={colors[box.name]}
                strokeWidth={3}
              />
              {box.outliers.map((v, j) => (
                <circle
                  key={j}
                  cx={x(v)}
                  cy={y}
                  r={2.5}
                  fill={colors[box.name]}
                />
              ))}
            </g>
          );
        })}
      </svg>
      <p className="text-xs text-[#78716C]">
        Moustaches : dernières valeurs à moins de 1,5 × l’écart interquartile.
        Points : valeurs extrêmes.
      </p>
    </div>
  ) : (
    <p className="py-16 text-sm text-[#78716C]">Aucune note disponible.</p>
  );
}
export function AnalyticsHeatmap({ data }: { data: CompanyAnalytics }) {
  const max = Math.max(1, ...data.heatmap.flatMap((row) => row.values));
  return data.scores.length ? (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[550px] border-separate border-spacing-1 text-xs">
        <caption className="sr-only">
          Nombre d’entreprises par domaine et score de priorité
        </caption>
        <thead>
          <tr>
            <th className="p-2 text-left">Domaine / score</th>
            {data.scores.map((score) => (
              <th key={score} className="px-3">
                {score}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.heatmap.map((row) => (
            <tr key={row.name}>
              <th className="whitespace-nowrap p-2 text-left font-medium text-[#57534E]">
                {row.name}
              </th>
              {row.values.map((value, i) => (
                <td
                  key={data.scores[i]}
                  title={`${row.name} · score ${data.scores[i]} : ${value} entreprises`}
                  className="rounded p-3 text-center font-semibold"
                  style={{
                    backgroundColor: `rgba(66,124,153,${0.06 + (0.94 * value) / max})`,
                    color: value / max > 0.5 ? "white" : "#1C1917",
                  }}
                >
                  {value}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  ) : (
    <p className="py-16 text-sm text-[#78716C]">
      Aucun score de priorité disponible.
    </p>
  );
}
export function AnalyticsNetwork({ data }: { data: CompanyAnalytics }) {
  const [selected, setSelected] = useState("");
  const domains = data.domains.filter((domain) =>
    data.links.some((link) => link.domain === domain.name),
  );
  const height =
    Math.max(domains.length, data.networkCategories.length) * 42 + 35;
  const dy = (name: string) =>
    25 + domains.findIndex((domain) => domain.name === name) * 42;
  const cy = (name: string) =>
    25 +
    data.networkCategories.findIndex((category) => category.name === name) * 42;
  const toggle = (name: string) =>
    setSelected((value) => (value === name ? "" : name));
  if (!data.links.length)
    return (
      <p className="py-16 text-sm text-[#78716C]">
        Aucune catégorie n’atteint le seuil de trois entreprises.
      </p>
    );
  return (
    <>
      <p className="mb-3 text-xs text-[#78716C]">
        Sélectionnez un nœud pour isoler ses liens.
        {selected && (
          <button className="ml-2 underline" onClick={() => setSelected("")}>
            Afficher tout
          </button>
        )}
      </p>
      <div className="overflow-x-auto">
        <svg
          viewBox={`0 0 1000 ${height}`}
          className="w-full min-w-[700px]"
          aria-label="Réseau des domaines et catégories d’entreprises"
        >
          {data.links.map((link) => {
            const active =
              !selected ||
              selected === `d:${link.domain}` ||
              selected === `c:${link.category}`;
            return (
              <g
                key={`${link.domain}:${link.category}`}
                opacity={active ? 0.65 : 0.05}
              >
                <title>{`${link.domain} ↔ ${link.category} : ${link.weight} entreprises`}</title>
                <path
                  d={`M 290 ${dy(link.domain)} C 420 ${dy(link.domain)}, 580 ${cy(link.category)}, 710 ${cy(link.category)}`}
                  fill="none"
                  stroke="#A8A29E"
                  strokeWidth={1 + 2 * Math.log1p(link.weight)}
                />
                {link.weight >= 10 && active && (
                  <text
                    x={500}
                    y={(dy(link.domain) + cy(link.category)) / 2}
                    textAnchor="middle"
                    fontSize={10}
                    fill="#621E3E"
                  >
                    {link.weight}
                  </text>
                )}
              </g>
            );
          })}
          {domains.map((domain) => (
            <g
              key={domain.name}
              role="button"
              tabIndex={0}
              aria-label={`Liens du domaine ${domain.name}`}
              aria-pressed={selected === `d:${domain.name}`}
              onClick={() => toggle(`d:${domain.name}`)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  toggle(`d:${domain.name}`);
                }
              }}
              className="cursor-pointer"
            >
              <circle cx={290} cy={dy(domain.name)} r={10} fill="#D0744A" />
              <text
                x={270}
                y={dy(domain.name) + 4}
                textAnchor="end"
                fontSize={12}
                fill="#57534E"
              >
                {domain.name}
              </text>
            </g>
          ))}
          {data.networkCategories.map((category) => (
            <g
              key={category.name}
              role="button"
              tabIndex={0}
              aria-label={`Liens de la catégorie ${category.name}`}
              aria-pressed={selected === `c:${category.name}`}
              onClick={() => toggle(`c:${category.name}`)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  toggle(`c:${category.name}`);
                }
              }}
              className="cursor-pointer"
            >
              <circle cx={710} cy={cy(category.name)} r={7} fill="#427C99" />
              <text
                x={728}
                y={cy(category.name) + 4}
                fontSize={12}
                fill="#57534E"
              >
                {category.name} ({category.count})
              </text>
            </g>
          ))}
        </svg>
      </div>
      <p className="mt-3 text-xs text-[#78716C]">
        Orange : domaines · Bleu : catégories · Épaisseur : nombre
        d’entreprises. Les catégories présentes au moins 3 fois sont affichées.
      </p>
    </>
  );
}
