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
