# Frontend

Application React/Vite de Marrakech Career.

- `src/app/pages/` : pages de l'application, centralisées dans `pages/index.ts`.
- `src/app/components/` : composants réutilisables et interface commune.
- `src/app/components/ui/` : composants UI génériques.
- `src/app/lib/` : clients et accès aux services externes.
- `src/app/hooks/` : hooks React.
- `src/assets/` : logos et ressources visuelles.
- `src/styles/` : styles globaux, thème et polices.
- `public/` : fichiers publics, dont le favicon.

## Aperçus des entreprises

Les cartes servent des captures WebP préparées dans `public/company-previews/`.
Le manifeste `src/app/companyWebsitePreviews.json` associe chaque URL publique à
son image. Le navigateur ne demande jamais une génération externe à l'ouverture
d'une carte ; une capture absente ou inaccessible laisse une bannière de secours.
Les noms des images incluent une empreinte du contenu pour permettre un cache
long sur Vercel sans conserver une ancienne version après une mise à jour.

Après un nouvel import de catalogue, préparer les nouvelles captures avant de
compiler et publier (Python avec Pillow) :

```powershell
python data/src/cache_company_previews.py --source data/outputs/entreprises_import_supabase.csv
```

Le script conserve les images existantes et limite la collecte à quatre requêtes
simultanées, avec deux tentatives par nouveau site. Versionner le manifeste et les
images générées avec la modification du catalogue.

## Recherche d'entreprises

La page Entreprises cherche dans le nom, les catégories, les descriptions déjà
présentes et l'index des activités issues des sites publics. Les synonymes
français/anglais sont gérés par `src/app/companySearch.ts`, avec des limites de
mots pour les sigles courts. Les phrases courantes sont analysées localement :
les mots de demande et de recherche de stage sont retirés, les petites fautes
uniques sont corrigées à partir du vocabulaire réel, « ou » propose des alternatives
et « sans / sauf » exclut des activités. L'interface affiche les critères interprétés
et les corrections. Les mots significatifs d'une requête sont combinés,
le domaine sélectionné reste un filtre, et les résultats sont classés par
pertinence. Une catégorie importée « IA & Data » ne suffit pas seule à prouver
une activité d'intelligence artificielle.

Si aucun résultat ne satisfait tous les critères, jusqu'à 24 correspondances
partielles sont proposées séparément (au moins la moitié des critères d'une
alternative), avec les critères non retrouvés sur chaque carte. Un texte sans
activité ni nom n'affiche pas tous les comptes comme une recherche réussie.
Une recherche de stage trouve des entreprises pertinentes, pas une preuve de
recrutement. Aucune entreprise ou activité n'est inventée.

Chaque résultat indique le texte qui correspond et le site source lorsqu'il
est disponible. L'index est chargé une fois, puis la recherche s'effectue
localement sans appel externe ni modèle IA par frappe, après 220 ms de pause.
Les correspondances par champ sont mémorisées et les timers périmés annulés.
Si l'index ne peut pas être chargé, la
page continue à chercher dans le catalogue et le signale.

Après un import ou une actualisation des activités, préparer l'index avant de
compiler et publier :

```powershell
python data/src/build_company_search_index.py --source data/outputs/entreprises_import_supabase.csv
node --test --test-isolation=none tests/company-search.test.mjs
```

Versionner `public/company-search/` et `src/app/companySearchIndexInfo.json`.
Le collecteur lit uniquement les réponses HTML publiques accessibles ; les
sites inaccessibles ne reçoivent aucune description inventée.
