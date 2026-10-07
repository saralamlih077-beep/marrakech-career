# Événements au Maroc — mise à jour automatique

La page candidat « Événements » charge `/api/events`. La fonction Vercel collecte les calendriers publics à la demande, indépendamment de l’ordinateur du propriétaire. Aucun ajout manuel ni redéploiement n’est requis pour une nouvelle annonce publiée sur un calendrier connecté dont la structure reste compatible. Ce mécanisme est déclenché par les visites ; ce n’est pas un cron et il ne recherche pas tout le Web.

## Sources connectées

- L’Étudiant marocain : https://www.etudiant.ma/forums-salons — découverte des cartes des forums, ville, salle et dates.
- Chambre turque de commerce au Maroc : https://ctcim.ma/fr/informations/salons — découverte des salons marocains et des liens officiels.
- GITEX Africa : https://gitexafrica.com/who-attends
- SIAM : https://www.salon-agriculture.ma/en/
- Logismed : https://logismed.ma/
- Morocco SIEMA : https://www.siemamaroc.com/
- Marrakech Air Show : https://marrakechairshow2026.com/

Les calendriers permettent de découvrir de nouvelles annonces. Les pages des organisateurs permettent de suivre leurs dates ; une nouvelle édition qui change d’adresse et n’apparaît pas dans un calendrier connecté nécessite l’ajout de sa source dans `backend/events/collector.ts`. Ajouter une source ou adapter un site qui change sa structure nécessite un déploiement. Les sujets des pages individuelles sont classés selon la série de l’événement ; les catégories des salons du calendrier CTCIM viennent des thèmes de chaque carte. Une catégorie inconnue devient « Non classé ».

## Actualisation et fiabilité

- Cache serveur et CDN : **1 heure maximum depuis la vérification** si les sept sources fonctionnent ; **5 minutes** si une source est indisponible. Le cache de l’instance ne prolonge pas la durée du cache CDN.
- Le navigateur recharge à chaque ouverture, à son retour au premier plan et toutes les 10 minutes lorsque la page est visible. La première collecte peut prendre plusieurs secondes ; les lectures suivantes utilisent le cache.
- Une source inaccessible ou dont la structure n’est plus reconnue est signalée avec son nom. Si toutes échouent : HTTP 502, sans cache. Une actualisation échouée garde les derniers résultats déjà affichés, avec avertissement ; elle ne les présente pas comme récemment vérifiés. Aucune ancienne sélection manuelle n’est injectée à la place.
- Les annonces sont datées explicitement depuis le texte de leur édition, sans déduire d’année du titre HTML, de l’URL ou de la date courante. Les doublons par site d’événement, ville et date sont supprimés ; une annonce directe de l’organisateur prime sur celle du calendrier.
- Les dates sont inclusives, au jour du Maroc (`Africa/Casablanca`). Les événements terminés sont exclus côté serveur et navigateur ; le navigateur recalcule son jour chaque minute.
- Les liens d’inscription et les sources sont séparés. Aucun prix, lieu précis ou annulation n’est inventé. Consulter l’annonce officielle avant de se déplacer reste nécessaire.

## Collecteur

GET/HEAD uniquement. Aucune clé API, donnée de profil, inscription ni envoi de courrier. Collecte bornée aux sept URL configurées : pas de URL fournie par un visiteur. HTTPS, redirections limitées au même domaine, respect des règles robots.txt et du délai de collecte, 2 Mo maximum par réponse et délai de 24 secondes par source. Un délai robots supérieur à 10 secondes entraîne l’indisponibilité de cette source pour cette fenêtre de collecte. `vercel.json` accorde 30 secondes à la fonction. Les requêtes simultanées dans une même instance partagent une collecte.

Le fichier `frontend/public/events/catalog.json` conserve la sélection initiale pour les tests historiques ; il n’alimente plus la page. En développement, `npm run dev` expose aussi `/api/events` via le middleware Vite, sans remplacer l’authentification de l’application.

## Validation

`node --test --test-isolation=none tests/*.test.mjs`, puis `npm run build`. Les tests couvrent nouvelles cartes, éditions, dates impossibles, exclusions des événements passés, doublons, URLs dangereuses, robots, redirections, réponses volumineuses, échecs partiels, méthodes HTTP et expiration du cache. Vérifier le JSON réel de `/api/events`, puis l’affichage et les filtres sur ordinateur et mobile après publication.
