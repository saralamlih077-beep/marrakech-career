# Données Marrakech Career

Ce dossier sépare la collecte, le nettoyage, la visualisation et les offres d'emploi.

## Catalogue actuel

`inputs/data_filtrer_final.xlsx` contient les 436 entreprises fournies le 3 octobre 2026.
La migration `backend/supabase/migrations/202610030003_replace_company_catalog.sql`
importe ce catalogue dans la table `entreprises`. Elle conserve les identifiants
des 284 entreprises déjà présentes, ajoute 152 entreprises et archive les 7
entreprises absentes du fichier (`is_active = false`). Le catalogue de l'application
affiche uniquement les entreprises actives. Les références des favoris, candidatures
et offres restent intactes.

La sauvegarde avant import est conservée dans
`company_import_backups.entreprises_before_20261003`, hors des schémas exposés par
l'API. Les colonnes `offre_emploi` et `offre_stage` conservent les valeurs du fichier.
Elles ne créent aucune offre dans la table `job_offers`.

## Structure

```text
data/
  config/       Requêtes Google Places et sources d'offres
  notebooks/    01 collecte, 02 visualisation, 03 offres
  outputs/      Fichiers Excel produits à l'exécution (non versionnés)
  src/          Fonctions partagées et réutilisables
```

## Démarrage

1. Créez un environnement Python et installez `pip install -r data/requirements.txt`.
2. Définissez `GOOGLE_MAP_API` dans vos variables d'environnement. Ne mettez jamais la clé dans un notebook ni dans Git.
3. Exécutez `01_collecte_entreprises_google_places.ipynb` : il crée les deux fichiers Excel dans `data/outputs/`.
4. Exécutez `02_visualisation_et_comparaison.ipynb`.
5. Configurez les clés des sources d'offres, puis exécutez `03_collecte_offres.ipynb`.

## Fichiers produits

- `entreprises_avant_nettoyage.xlsx` : données Google Places brutes, avec les doublons conservés.
- `entreprises_apres_nettoyage.xlsx` : données dédoublonnées, classées et prêtes pour l'application.
- `offres_collectees.xlsx` : offres normalisées, avec la source et l'URL d'origine.

## Règles de collecte

- Google Places est interrogé uniquement avec une clé API personnelle et un champ mask explicite afin de maîtriser le coût.
- Les coordonnées sont filtrées autour de Marrakech et les doublons sont retirés par `place_id`.
- L'enrichissement email est désactivé par défaut. S'il est activé, il consulte seulement les pages publiques des sites d'entreprise, avec délai, cache et respect de `robots.txt`.
- JobSquare propose une API partenaire destinée à publier et gérer ses propres offres ; ce n'est pas une API publique de recherche d'offres. Ne pas contourner cette limitation.
- Pour Stagiaire.ma et Trabajo, le notebook ne doit être exécuté que si leurs règles d'accès autorisent la collecte automatisée. Sinon, utiliser une exportation ou une API fournie par le site.
