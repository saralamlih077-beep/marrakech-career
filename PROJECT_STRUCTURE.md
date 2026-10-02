# Structure du projet Marrakech Career

```text
frontend/                 # Interface React/Vite
  src/app/pages/          # Pages : tableau de bord, entreprises, CV, offres…
  src/app/components/     # Composants partagés
  src/assets/             # Logo et ressources visuelles
  src/styles/             # Thème et styles
  public/                 # Favicon et fichiers statiques
backend/
  supabase/functions/     # API Edge Functions
  supabase/migrations/    # Schéma et migrations SQL
data/
  config/                 # Requêtes et paramètres de collecte
  notebooks/              # Collecte, nettoyage, visualisation, offres
  src/                    # Fonctions Python réutilisables
  outputs/                # Exports produits localement, non versionnés
guidelines/               # Références de conception existantes
```

Les outils de projet (`package.json`, `vite.config.ts`, verrouillages) restent à la racine afin que Vercel puisse construire l'application depuis la branche `main`.
