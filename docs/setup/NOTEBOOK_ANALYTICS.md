# Graphiques du notebook dans l'administration

`frontend/src/app/pages/AdminDataScreen.tsx` remplace l'ancienne analyse des
entreprises. Les pages d'analyse du candidat et d'analyse des utilisateurs ne
sont pas modifiées. Les graphiques utilisent les entreprises actives chargées
depuis Supabase, et se recalculent lorsque ces données changent.

Le notebook fourni `visualisation_entreprises (2).ipynb` est transposé en quatre
sections :

- Répartitions : histogrammes des notes (10 intervalles), des scores et du
  logarithme des avis (12 intervalles), barres par domaine, barres empilées par
  priorité, secteurs des cinq premiers domaines et « Autres ».
- Notes et priorité : deux courbes par score (sans chronologie inventée), nuage
  note/avis sur un axe logarithmique, radar des quatre premiers domaines, carte
  de chaleur domaine/score, boîtes des notes, graphique combiné à trois axes.
- Cartographie : cercles colorés par domaine, rayon proportionnel au score,
  popups, puis variante en carte de densité sans pondération par priorité.
- Réseau et 3D : liens domaine/catégorie pour les catégories présentes au moins
  trois fois ; nuage 3D note/log10(avis)/score et variante longitude/latitude/score.

Les quartiles utilisent l'interpolation linéaire de pandas/NumPy. Les moustaches
des boîtes restent à 1,5 écart interquartile et les valeurs extrêmes sont visibles.
La corrélation de Pearson n'est calculée que sur les paires renseignées. Les
avis non positifs sont exclus des logarithmes. Les moyennes ignorent les valeurs
manquantes ; le radar applique le remplissage à zéro prévu dans le notebook,
puis divise chaque critère par le maximum de **tous** les domaines.

Le réseau utilise une disposition bipartite lisible au lieu de Kamada-Kawai,
en conservant les liens et leurs poids. Les valeurs manquantes et les catégories
absentes ne créent pas de relations. Les histogrammes de score suivent les scores
présents dans la base au lieu de supprimer les futurs scores hors de 4–11.

Leaflet et le fond Esri reprennent la cartographie du notebook. Le module de
densité et le paquet Plotly 3D sont locaux, versionnés dans les verrous npm et
pnpm, et chargés uniquement quand leur section est ouverte. Les vues 3D proposent
aussi les données en tableau. Les cartes de chaleur, boîtes et réseaux défilent
horizontalement dans leur carte sur mobile sans élargir la page.

Validation :

```powershell
node --test --test-isolation=none tests/company-analytics.test.mjs tests/admin-data.test.mjs
npm run build
```
