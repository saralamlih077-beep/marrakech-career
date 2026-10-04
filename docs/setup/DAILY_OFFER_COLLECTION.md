# Actualisation quotidienne des offres

La fonction `sync-career-offers` est appelée par Supabase Cron à **06:00 UTC chaque jour**. L'ancienne tâche `sync-job-opportunities-daily` est conservée à 07:00 UTC.

## Sources

- JobSquare : dernière page publique des offres à Marrakech, puis données structurées JobPosting.
- Joobaz : dernière page publique des offres à Marrakech, puis données structurées JobPosting.
- Maremploi : dernière page publique des offres à Marrakech, puis données structurées JobPosting.
- Jooble : API officielle, avec la clé serveur `JOOBLE_API_KEY`. Une clé absente ou refusée est journalisée sans empêcher les autres sources.
- Trabajo : import de fichier ; ses conditions limitent la collecte automatisée. Un accord ou un flux autorisé est nécessaire pour activer ce connecteur.
- Offres-emploi.ma : import de fichier ; les pages `/offre/` sont interdites dans robots.txt.

La collecte publique respecte les règles robots à chaque exécution, suit uniquement les liens du même site, lit au maximum 30 annonces par source sur la première page (20 JobSquare, 18 Joobaz et 10 Maremploi lors de la validation), et ne contourne ni connexion ni blocage. Ce n'est pas une archive exhaustive des sources : un volume supérieur à la première page nécessite un flux partenaire ou une pagination autorisée supplémentaire.

Seuls les faits structurés sont ajoutés à l'index : titre, employeur, lieu, contrat, dates, compétences et lien original. La description des nouvelles fiches est un résumé factuel produit par le collecteur, pas une copie de la description complète du site. Les descriptions du fichier utilisateur restent conservées.

## Installation et accès

1. Déployer `backend/supabase/functions/sync-career-offers/index.ts` avec la vérification JWT activée.
2. Appliquer `backend/supabase/migrations/202610040001_daily_offer_collection.sql`.

La migration réutilise le modèle HTTP authentifié de la tâche existante et le secret serveur déjà présent dans Vault (`jooble_sync_cron_secret`). Le collecteur vérifie `JOOBLE_SYNC_SECRET` (ou le secret existant `JOBSQUARE_SYNC_SECRET`). Aucune valeur secrète ne figure dans le dépôt ou le navigateur de Marrakech Career. Les fonctions d'import RPC sont réservées au rôle serveur et leur journal est protégé par RLS.

Les URLs évitent les doublons ; les identifiants existants et les relations vers les candidatures sont conservés. Un échec réseau ou un changement de format ne ferme jamais toute une source. Seule une date d'expiration explicite rend une fiche invisible. Un contrat non identifié est ignoré, sans inventer un CDI.

## Vérification

Dans SQL Editor, sans afficher les secrets :

```sql
select jobname, schedule, active
from cron.job where jobname in ('sync-career-offers-daily','sync-job-opportunities-daily');

select started_at, finished_at, status, results
from public.career_offer_sync_runs order by started_at desc limit 10;
```

Un statut `partial` indique qu'au moins une source n'a pas pu être intégralement actualisée ; le champ `results` donne le résultat par source. Une réussite de Cron seule ne prouve pas que l'appel HTTP a réussi : consulter également ce journal applicatif.

La page Offres recharge les données à l'ouverture, au retour dans l'onglet et toutes les cinq minutes lorsque l'application est visible. Aucun redéploiement n'est nécessaire pour afficher de nouvelles fiches en base.

## Validation locale

`node --test tests/daily-offer-collection.test.mjs tests/offer-sources.test.mjs`

Les tests couvrent les restrictions robots, les liens externes, les doublons, les JSON-LD mal formés, Marrakech, les stages à temps plein et les dates d'expiration.
