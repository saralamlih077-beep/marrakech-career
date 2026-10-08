# Nouvelles entreprises de Marrakech

Le collecteur `sync-new-companies` découvre des sites d'entreprises dans OpenStreetMap via Overpass, puis lit leurs pages publiques officielles. Le catalogue historique reste intact : le collecteur effectue uniquement des insertions dans `entreprises` et vérifie les doublons contre toutes les fiches, y compris les fiches archivées.

Six informations sont obligatoires pour publier une **nouvelle** entreprise : nom, domaine, adresse complète à Marrakech, téléphone, site HTTPS et e-mail professionnel publié. Aucune adresse e-mail n'est devinée. Les données structurées de l'entreprise et ses liens de contact servent de preuves. Un secteur non identifiable, une coordonnée absente, un site inaccessible ou une identité ambiguë laisse la fiche dans la file privée. Cette exigence ne s'applique pas rétroactivement aux entreprises existantes.

La découverte est limitée à 500 sites dans la zone de Marrakech et à six vérifications par jour, avec deux pages de contact maximum par site. Les fiches incomplètes peuvent être revérifiées après sept jours ; celles jamais vérifiées sont prioritaires. Ce n'est pas un annuaire exhaustif ni une garantie d'ajout chaque jour. Une entreprise trouvée aujourd'hui peut exister depuis longtemps.

État du déploiement au 8 octobre 2026 : fonction déployée dans `rometmtcpaoggerucisc`, tâche `sync-new-companies-daily` active à 05:00 UTC, rafraîchissement du catalogue vérifié sur le site public. Les 443 anciennes fiches sont conservées (436 actives). La source Overpass peut être temporairement indisponible ; une seule nouvelle tentative est faite pour les erreurs HTTP 500, 502, 503 ou 504. Le bilan applicatif permet de distinguer une source indisponible d'une absence de nouveaux candidats.

## Installation

1. Appliquer `202610080003_new_company_discovery.sql`.
2. Déployer la fonction avec vérification JWT **activée**. Elle exige également le secret cron existant `JOOBLE_SYNC_SECRET` ou `JOBSQUARE_SYNC_SECRET`.
3. Vérifier un premier appel authentifié et les journaux applicatifs.
4. Appliquer `202610080004_schedule_new_company_discovery.sql` : chaque jour à **05:00 UTC**, indépendamment du PC ou de n8n Docker.

La planification réutilise le modèle serveur authentifié existant. Les valeurs secrètes ne sont ni exposées dans le code, ni copiées dans le navigateur du site. Toutes les RPC d'import sont réservées au rôle serveur. Les candidats, preuves et résultats sont dans le schéma privé, avec RLS et sans accès aux comptes utilisateurs.

## Contrôles

Le lecteur n'accepte que HTTPS sur le port standard, vérifie le certificat, épingle une adresse DNS publique à la connexion et refuse les adresses privées, les redirections vers un autre domaine, les pages trop grosses et les délais excessifs. Il respecte robots.txt sans contourner de connexion ou de blocage.

Les preuves de contact proviennent des sites officiels. La file de découverte conserve l'identifiant OSM, son URL et l'attribution **© OpenStreetMap contributors, ODbL** : [licence](https://www.openstreetmap.org/copyright). Aucun contenu Google Places n'est collecté par cette fonction et aucun quota payant Places n'est utilisé.

```sql
select jobname,schedule,active from cron.job where jobname='sync-new-companies-daily';
select started_at,finished_at,status,results from private.company_discovery_runs order by started_at desc limit 10;
select status,count(*) from private.company_discovery_candidates group by status;
```

Une exécution Cron réussie ne suffit pas : consulter le résultat applicatif. `published` est le nombre de fiches réellement insérées ; `pending` ne signifie pas publiées. Une collecte peut ajouter zéro entreprise.

L'application recharge le catalogue à l'ouverture, au retour dans l'onglet et toutes les cinq minutes lorsque la page reste visible. Les anciens critères de visibilité et les anciennes fiches sont conservés.

## Tests

`node --test --test-isolation=none tests/new-company-discovery.test.mjs`

Le test PostgreSQL `tests/new-company-database.test.mjs` utilise PGlite via la variable `PGLITE_MODULE` (URL de son module installé), pour vérifier les six champs, l'absence de modifications historiques, les doublons, l'idempotence et l'accès réservé au serveur.
