import test from "node:test";
import assert from "node:assert/strict";
import {
  buildCompanyAnalytics,
  histogram,
  correlation,
  quantile,
  available,
} from "../frontend/src/app/companyAnalytics.ts";
const company = (id, extra = {}) => ({
  id,
  nom: `Entreprise ${id}`,
  domaine: "IT & Digital",
  categorie: "Services",
  note: null,
  nombre_avis: null,
  score_priorite: null,
  priorite: null,
  latitude: null,
  longitude: null,
  telephone: null,
  adresse: null,
  ...extra,
});

test("histogram counts maximum once and handles a constant series like numpy", () => {
  const bins = histogram([0, 0.25, 0.5, 0.75, 1], 4);
  assert.deepEqual(
    bins.map((bin) => bin.value),
    [1, 1, 1, 2],
  );
  assert.deepEqual(histogram([], 10), []);
  assert.equal(
    histogram([5, 5, 5], 10).reduce((sum, bin) => sum + bin.value, 0),
    3,
  );
});
test("unknown numeric values are not zero; positive reviews alone enter the logarithmic series", () => {
  const data = buildCompanyAnalytics([
    company(1, { note: 5, nombre_avis: 100, score_priorite: 8 }),
    company(2, { note: " ", nombre_avis: 0 }),
    company(3, { note: "Non disponible", nombre_avis: -1 }),
    company(4, { note: "4,5", nombre_avis: 10, score_priorite: "7" }),
    company(5, { is_active: false, note: 5 }),
  ]);
  assert.equal(data.rows.length, 4);
  assert.equal(data.missingRatings, 2);
  assert.equal(data.missingScores, 2);
  assert.equal(data.points.length, 2);
  assert.equal(
    data.reviewsHistogram.reduce((sum, bin) => sum + bin.value, 0),
    2,
  );
  assert.equal(data.domains[0].rating, 4.75);
  assert.deepEqual(
    data.trend.map((row) => row.score),
    [7, 8],
  );
});
test("domain totals, top-five pie and stacked priority counts preserve the full population", () => {
  const data = buildCompanyAnalytics(
    Array.from({ length: 12 }, (_, i) =>
      company(i, {
        domaine: `D${i % 6}`,
        priorite: i % 2 ? "Haute" : "Moyenne",
        score_priorite: i % 3,
      }),
    ),
  );
  assert.equal(
    data.domains.reduce((sum, domain) => sum + domain.count, 0),
    12,
  );
  assert.equal(
    data.pie.reduce((sum, row) => sum + row.value, 0),
    12,
  );
  assert.equal(data.pie.at(-1).name, "Autres");
  assert.equal(
    data.domains
      .flatMap((domain) => domain.priorities)
      .reduce((a, b) => a + b, 0),
    12,
  );
  assert.equal(
    data.heatmap.flatMap((row) => row.values).reduce((a, b) => a + b, 0),
    12,
  );
});
test("quartiles use linear interpolation and box whiskers exclude 1.5-IQR outliers", () => {
  assert.equal(quantile([1, 2, 3, 4], 0.25), 1.75);
  assert.equal(quantile([], 0.5), null);
  const data = buildCompanyAnalytics(
    [1, 4, 4.5, 5, 5].map((note, id) => company(id, { note })),
  );
  assert.deepEqual(
    data.boxes.map(({ q1, median, q3, min, max, outliers }) => ({
      q1,
      median,
      q3,
      min,
      max,
      outliers,
    })),
    [{ q1: 4, median: 4.5, q3: 5, min: 4, max: 5, outliers: [1] }],
  );
});
test("radar normalizes against every domain, not only the four shown, and handles all-null criteria", () => {
  const rows = [];
  for (let domain = 0; domain < 5; domain++)
    for (let i = 0; i < 5 - domain; i++)
      rows.push(
        company(rows.length, {
          domaine: `D${domain}`,
          note: domain === 4 ? 5 : 4,
        }),
      );
  const data = buildCompanyAnalytics(rows);
  assert.deepEqual(
    data.radar.find((row) => row.axis === "Note moyenne").values,
    [8, 8, 8, 8],
  );
  assert.deepEqual(
    data.radar.find((row) => row.axis === "Score priorité").values,
    [0, 0, 0, 0],
  );
});
test("network threshold applies to category totals while each domain edge retains its actual weight", () => {
  const data = buildCompanyAnalytics([
    company(1),
    company(2),
    company(3, { domaine: "Tourisme" }),
    company(4, { categorie: "Rare" }),
    company(5, { categorie: "Non disponible" }),
  ]);
  assert.deepEqual(data.networkCategories, [{ name: "Services", count: 3 }]);
  assert.equal(
    data.links.find((link) => link.domain === "IT & Digital").weight,
    2,
  );
  assert.equal(data.links.find((link) => link.domain === "Tourisme").weight, 1);
});
test("Pearson correlation rejects insufficient or constant series and preserves direction", () => {
  assert.ok(
    Math.abs(
      correlation([
        { x: 1, y: 2 },
        { x: 2, y: 4 },
        { x: 3, y: 6 },
      ]) - 1,
    ) < 1e-12,
  );
  assert.equal(correlation([{ x: 1, y: 2 }]), null);
  assert.equal(
    correlation([
      { x: 1, y: 2 },
      { x: 1, y: 4 },
    ]),
    null,
  );
});
test("GPS and contact availability exclude invalid ranges and placeholder strings", () => {
  const data = buildCompanyAnalytics([
    company(1, { latitude: 31.63, longitude: -8 }),
    company(2, { latitude: 91, longitude: -8 }),
    company(3, { latitude: " ", longitude: -8 }),
    company(4, { latitude: 31.6, longitude: 181 }),
  ]);
  assert.equal(data.geo.length, 1);
  for (const value of [null, "", " ", "-", "Non disponible", "Non renseigné"])
    assert.equal(available(value), false);
  assert.equal(available("0612345678"), true);
});
