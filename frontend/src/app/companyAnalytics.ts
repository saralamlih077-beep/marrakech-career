import type { Company } from "./types";

const missing = new Set([
  "",
  "-",
  "none",
  "null",
  "nan",
  "non disponible",
  "non renseigne",
  "non precise",
]);
export function available(value: unknown): boolean {
  return (
    typeof value === "string" &&
    !missing.has(
      value
        .trim()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase(),
    )
  );
}
function numeric(value: unknown): number | null {
  if (
    value === null ||
    value === undefined ||
    value === "" ||
    (typeof value !== "number" && typeof value !== "string")
  )
    return null;
  if (typeof value === "string" && !value.trim()) return null;
  const number =
    typeof value === "number" ? value : Number(value.trim().replace(",", "."));
  return Number.isFinite(number) ? number : null;
}
const mean = (numbers: number[]) =>
  numbers.length
    ? numbers.reduce((sum, value) => sum + value, 0) / numbers.length
    : null;
export function quantile(numbers: number[], p: number): number | null {
  if (!numbers.length) return null;
  const sorted = [...numbers].sort((a, b) => a - b);
  const position = (sorted.length - 1) * p;
  const index = Math.floor(position);
  return (
    sorted[index] +
    (sorted[Math.min(index + 1, sorted.length - 1)] - sorted[index]) *
      (position - index)
  );
}
export function histogram(numbers: number[], count: number) {
  if (!numbers.length) return [];
  let min = Math.min(...numbers),
    max = Math.max(...numbers);
  if (min === max) {
    min -= 0.5;
    max += 0.5;
  }
  const width = (max - min) / count;
  const bins = Array.from({ length: count }, (_, i) => ({
    low: min + i * width,
    high: min + (i + 1) * width,
    value: 0,
  }));
  for (const number of numbers)
    bins[Math.min(count - 1, Math.floor((number - min) / width))].value++;
  return bins.map((bin, i) => ({
    ...bin,
    label: `${bin.low.toFixed(2)}–${bin.high.toFixed(2)}${i === count - 1 ? " inclus" : ""}`,
  }));
}
export function correlation(pairs: { x: number; y: number }[]): number | null {
  if (pairs.length < 2) return null;
  const x = mean(pairs.map((pair) => pair.x))!,
    y = mean(pairs.map((pair) => pair.y))!;
  const numerator = pairs.reduce(
    (sum, pair) => sum + (pair.x - x) * (pair.y - y),
    0,
  );
  const denominator = Math.sqrt(
    pairs.reduce((sum, pair) => sum + (pair.x - x) ** 2, 0) *
      pairs.reduce((sum, pair) => sum + (pair.y - y) ** 2, 0),
  );
  return denominator ? numerator / denominator : null;
}

export function buildCompanyAnalytics(companies: Company[]) {
  const rows = companies
    .filter((company) => company.is_active !== false)
    .map((company) => {
      const rating = numeric(company.note),
        reviews = numeric(company.nombre_avis),
        lat = numeric(company.latitude),
        lng = numeric(company.longitude);
      return {
        company,
        name: company.nom,
        domain: available(company.domaine)
          ? company.domaine!.trim()
          : "Non renseigné",
        category: available(company.categorie)
          ? company.categorie!.trim()
          : null,
        rating: rating !== null && rating >= 0 && rating <= 5 ? rating : null,
        score: numeric(company.score_priorite),
        priority: available(company.priorite)
          ? company.priorite!.trim()
          : "Non renseignée",
        reviews: reviews !== null && reviews >= 0 ? reviews : null,
        logReviews:
          reviews !== null && reviews > 0 ? Math.log10(reviews) : null,
        lat: lat !== null && Math.abs(lat) <= 90 ? lat : null,
        lng: lng !== null && Math.abs(lng) <= 180 ? lng : null,
      };
    });
  type Row = (typeof rows)[number];
  const groups = new Map<string, Row[]>();
  for (const row of rows)
    groups.set(row.domain, [...(groups.get(row.domain) || []), row]);
  const priorities = [...new Set(rows.map((row) => row.priority))].sort(
    (a, b) =>
      a === "Haute" ? -1 : b === "Haute" ? 1 : a.localeCompare(b, "fr"),
  );
  const domains = [...groups]
    .map(([name, items]) => ({
      name,
      count: items.length,
      rating: mean(
        items.flatMap((row) => (row.rating === null ? [] : [row.rating])),
      ),
      score: mean(
        items.flatMap((row) => (row.score === null ? [] : [row.score])),
      ),
      popularity: mean(
        items.flatMap((row) =>
          row.logReviews === null ? [] : [row.logReviews],
        ),
      ),
      phone:
        (items.filter((row) => available(row.company.telephone)).length /
          items.length) *
        100,
      address:
        (items.filter((row) => available(row.company.adresse)).length /
          items.length) *
        100,
      priorities: priorities.map(
        (priority) => items.filter((row) => row.priority === priority).length,
      ),
    }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "fr"));
  const scores = [
    ...new Set(rows.flatMap((row) => (row.score === null ? [] : [row.score]))),
  ].sort((a, b) => a - b);
  const trend = scores.map((score) => {
    const items = rows.filter((row) => row.score === score);
    return {
      score,
      count: items.length,
      rating: mean(
        items.flatMap((row) => (row.rating === null ? [] : [row.rating])),
      ),
    };
  });
  const pie = domains
    .slice(0, 5)
    .map((domain) => ({ name: domain.name, value: domain.count }));
  if (domains.length > 5)
    pie.push({
      name: "Autres",
      value: domains.slice(5).reduce((sum, domain) => sum + domain.count, 0),
    });
  const heatmap = domains.map((domain) => ({
    name: domain.name,
    values: scores.map(
      (score) =>
        rows.filter((row) => row.domain === domain.name && row.score === score)
          .length,
    ),
  }));
  const boxes = domains.flatMap((domain) => {
    const values = groups
      .get(domain.name)!
      .flatMap((row) => (row.rating === null ? [] : [row.rating]))
      .sort((a, b) => a - b);
    if (!values.length) return [];
    const q1 = quantile(values, 0.25)!,
      median = quantile(values, 0.5)!,
      q3 = quantile(values, 0.75)!;
    const lower = q1 - 1.5 * (q3 - q1),
      upper = q3 + 1.5 * (q3 - q1);
    const inside = values.filter((value) => value >= lower && value <= upper);
    return [
      {
        name: domain.name,
        count: values.length,
        q1,
        median,
        q3,
        min: inside[0],
        max: inside.at(-1)!,
        outliers: values.filter((value) => value < lower || value > upper),
      },
    ];
  });
  const axes = [
    { label: "Note moyenne", key: "rating" },
    { label: "Score priorité", key: "score" },
    { label: "Popularité (avis)", key: "popularity" },
    { label: "Téléphone dispo", key: "phone" },
    { label: "Adresse dispo", key: "address" },
  ] as const;
  const radar = axes.map((axis) => {
    const max = Math.max(0, ...domains.map((domain) => domain[axis.key] ?? 0));
    return {
      axis: axis.label,
      values: domains
        .slice(0, 4)
        .map((domain) => (max ? ((domain[axis.key] ?? 0) / max) * 10 : 0)),
    };
  });
  const categoryCounts = new Map<string, number>();
  for (const row of rows)
    if (row.category)
      categoryCounts.set(
        row.category,
        (categoryCounts.get(row.category) || 0) + 1,
      );
  const networkCategories = [...categoryCounts]
    .filter(([, count]) => count >= 3)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);
  const links = domains.flatMap((domain) =>
    networkCategories.flatMap((category) => {
      const weight = rows.filter(
        (row) => row.domain === domain.name && row.category === category.name,
      ).length;
      return weight
        ? [{ domain: domain.name, category: category.name, weight }]
        : [];
    }),
  );
  const geo = rows.filter((row) => row.lat !== null && row.lng !== null);
  const points = rows.filter(
    (row) => row.rating !== null && row.logReviews !== null,
  );
  return {
    rows,
    domains,
    priorities,
    scores,
    trend,
    pie,
    heatmap,
    boxes,
    radar,
    networkCategories,
    links,
    geo,
    points,
    ratingHistogram: histogram(
      rows.flatMap((row) => (row.rating === null ? [] : [row.rating])),
      10,
    ),
    scoreHistogram: scores.map((score) => ({
      label: String(score),
      value: rows.filter((row) => row.score === score).length,
    })),
    reviewsHistogram: histogram(
      rows.flatMap((row) => (row.logReviews === null ? [] : [row.logReviews])),
      12,
    ),
    correlation: correlation(
      points.map((row) => ({ x: row.rating!, y: row.logReviews! })),
    ),
    missingRatings: rows.filter((row) => row.rating === null).length,
    missingScores: rows.filter((row) => row.score === null).length,
  };
}
export type CompanyAnalytics = ReturnType<typeof buildCompanyAnalytics>;
