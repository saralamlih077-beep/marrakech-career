# Import automatique des offres JobSquare

Cette intégration copie uniquement les offres publiques de Marrakech dans `job_offers`. Une offre conserve son lien JobSquare et n'est visible dans Marrakech Career que tant qu'elle est active.

## Une seule configuration

1. Dans **Supabase > SQL Editor**, exécuter le contenu de `supabase/migrations/202609190005_jobsquare_offer_sync.sql`.
2. Déployer `sync-jobsquare-offers` depuis **Supabase > Edge Functions** en collant le contenu de `supabase/functions/sync-jobsquare-offers/index.ts`.
3. Dans **Edge Functions > Secrets**, créer :
   - `JOBSQUARE_SYNC_SECRET` : une longue valeur secrète créée par vous ;
   - `ADMIN_EMAILS` : l'e-mail administrateur déjà utilisé par l'application.

## Dans n8n (toutes les 6 heures)

1. Ajouter un noeud **Schedule Trigger** : toutes les 6 heures.
2. Ajouter un noeud **HTTP Request** :
   - méthode `POST` ;
   - URL : `https://rometmtcpaoggerucisc.supabase.co/functions/v1/sync-jobsquare-offers` ;
   - en-tête `x-cron-secret` avec la valeur de `JOBSQUARE_SYNC_SECRET` ;
   - en-tête `Content-Type: application/json` ;
   - corps `{}`.
3. Tester une fois, puis activer le workflow.

Le résultat indique `discovered` (annonces lues), `imported` (annonces enregistrées) et `skipped` (annonces non lisibles). Les doublons sont évités par l'URL de l'annonce. Les annonces absentes de la source ou arrivées à leur date d'expiration passent en état `closed` : elles ne sont plus affichées, mais restent dans la base pour l'historique.
# Alertes automatiques après l’import

Après le nœud HTTP qui appelle `sync-jobsquare-offers`, ajoutez un deuxième nœud **HTTP Request** :

- Méthode : `POST`
- URL : `https://rometmtcpaoggerucisc.supabase.co/functions/v1/notify-matching-users`
- Header : `x-cron-secret` avec la même valeur que `JOBSQUARE_SYNC_SECRET`
- Body JSON : `{}`

La fonction envoie un e-mail Brevo uniquement aux utilisateurs ayant activé les alertes et dont le score dépasse leur seuil. Une même offre n’est jamais envoyée deux fois au même utilisateur.
