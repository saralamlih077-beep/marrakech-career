# Candidatures : Gmail personnel et n8n

## État de cette version

Le parcours local, les trois nouvelles fonctions serveur, la migration et le workflow Docker sont installés. Le lien HTTPS temporaire de test est actif. La connexion personnelle Gmail et un envoi vers un destinataire de test autorisé restent à vérifier avant publication du nouveau frontend.

Ne remplacer la version publique qu’après activation et vérification du serveur. Les tests automatisés utilisent des réponses Google/n8n simulées et n’envoient aucun e-mail réel.

## Instance Docker locale vérifiée le 8 octobre 2026

Le conteneur existant `n8n` (version 2.22.5, volume persistant `n8n_data`) a été redémarré. Le workflow `mcGmailApply2026` est publié avec deux nœuds, Header Auth requis et retries désactivés. L’identifiant interne `webhookId` du nœud Webhook est inclus dans le fichier : sans lui, n8n peut publier le workflow mais enregistrer une autre route que le chemin court attendu.

Éditeur local : `http://localhost:5678/workflow/mcGmailApply2026`.

Le projet Supabase dispose déjà de secrets nommés `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET` et `GMAIL_TOKEN_ENCRYPTION_KEY`. Leur présence ne confirme pas que leur valeur est correcte ni que le callback OAuth est autorisé. Les valeurs n’ont pas été révélées ou remplacées.

Les fonctions `gmail-connection`, `deliver-gmail-application` et `send-personal-gmail-campaign` ont ensuite été déployées depuis l’éditeur Supabase, avec le filtre JWT ancien désactivé après accord explicite de l’utilisateur ; les contrôles d’autorisation sont assurés par le code. Le code de chaque éditeur a été relu par copie et comparé au fichier préparé. La migration `202610080001_personal_gmail_n8n.sql` a été appliquée dans une transaction : les deux tables privées existent et les rôles `anon` et `authenticated` n’ont pas le droit d’exécuter la lecture des connexions Gmail.

`N8N_GMAIL_WEBHOOK_URL`, `N8N_GMAIL_WEBHOOK_SECRET`, `GMAIL_ALLOWED_ORIGINS` et `MARRAKECH_CAREER_APP_URL` sont configurés. Une clé privée aléatoire commune est enregistrée dans Supabase et dans un nouveau credential Header Auth n8n, sans affichage ni inclusion dans Git. Les origines locales autorisées sont `http://127.0.0.1:5173` et `http://localhost:5173`. Aucun e-mail n’a été envoyé. L’ancien endpoint public `send-gmail-campaign` n’a pas été remplacé : le nouveau frontend local utilise `send-personal-gmail-campaign` pour permettre une vérification avant sa publication.

Un tunnel HTTPS temporaire est actif vers le seul webhook, via le proxy local ci-dessous. L’éditeur n8n n’est pas accessible par ce lien ; l’exploitation publique demande une adresse durable et un hôte qui reste disponible. Si Docker tourne sur ce PC, les envois dépendent de ce PC et de Docker en fonctionnement.

## Lien HTTPS du test Docker

`backend/n8n/webhook-proxy.mjs` écoute uniquement sur `127.0.0.1:5679` et transmet seulement `POST /webhook/marrakech-career-personal-gmail` au n8n local. Les routes de l’éditeur, les corps trop volumineux, les champs inattendus et les requêtes sans en-tête d’authentification sont rejetés. La clé est aussi vérifiée par le credential Header Auth du webhook n8n. Seuls `jobId` et `dispatchToken` sont transmis ; le proxy ne journalise pas les clés ni le contenu.

Les 16 tests du parcours Gmail et du proxy passent. Le lien HTTPS réel refuse GET `/`, `/signin`, `/rest/workflows` et le webhook (404), refuse le POST sans clé ou avec une mauvaise clé (401), et accepte une demande synthétique avec la clé correcte (202). Cette demande contient uniquement un UUID inexistant et une capacité aléatoire : elle ne peut envoyer aucun e-mail. Les nouvelles fonctions utilisateur refusent les requêtes sans session (401) ; le worker refuse une demande synthétique non autorisée (409).

L’exécutable officiel Cloudflare 2026.10.0 a été téléchargé dans le dossier temporaire de cette tâche et son SHA256 comparé au digest de la release GitHub officielle. Le tunnel Quick Tunnel a été démarré pour le test autorisé : elle change au redémarrage et dépend du PC et du processus en fonctionnement. La publication permanente demande ensuite un hébergement disponible et une URL stable.

Référence : [Cloudflare Quick Tunnels](https://developers.cloudflare.com/tunnel/get-started/quick-tunnels/).

## Correction OAuth vérifiée le 8 octobre 2026

L’erreur réelle `redirect_uri_mismatch` a été corrigée dans le client existant « n8n Marrakech Career », projet Google `marrakech-career-gmail`. Son ID public correspond au digest du secret `GOOGLE_OAUTH_CLIENT_ID` utilisé par Supabase. Après accord explicite, l’URI `https://rometmtcpaoggerucisc.supabase.co/functions/v1/gmail-connection` a été ajoutée aux deux anciennes URI ; Google confirme « Client OAuth enregistré ». Aucun client ni secret Google n’a été créé ou remplacé.

Le test synthétique du webhook HTTPS a déclenché un POST réel vers `deliver-gmail-application`, visible dans Supabase le 8 octobre à 13:42:33 UTC, refusé avec 409 car aucune demande d’envoi n’existe pour ce UUID. Le credential et le secret Supabase ont été comparés par digest. Les copies temporaires de clé en clair ont ensuite été supprimées.

Il faut relancer une nouvelle connexion depuis les paramètres de l’application locale et laisser l’utilisateur valider son consentement Google. La propagation du réglage Google peut demander un délai. Aucun Gmail personnel n’est encore confirmé pour ce nouveau parcours, aucun CV ni e-mail réel n’a été envoyé et le nouveau frontend n’a pas été publié.

## Parcours utilisateur

- Aucune autorisation Gmail à l’inscription.
- Au premier Apply/Candidature, proposer l’e-mail d’inscription ou un autre Gmail. L’adresse d’inscription sert seulement de suggestion : Google confirme le compte réellement choisi.
- Une fenêtre Google demande `openid`, `email` et `gmail.send` (envoi uniquement). Le compte Marrakech Career reste connecté ; le choix d’un autre Gmail ne crée pas un autre compte dans l’application.
- Après autorisation, afficher le Gmail d’envoi et « Changer de Gmail », puis le formulaire CV/lettre.
- Chaque envoi est confirmé explicitement. Le suivi affiche « en attente » jusqu’à réception de l’identifiant du message fourni par Gmail. Le message et le CV apparaissent alors dans Messages envoyés ; les réponses arrivent dans ce Gmail.

## Architecture

`Candidature → send-personal-gmail-campaign → webhook n8n → deliver-gmail-application → API Gmail`

Les jetons Google sont chiffrés avec AES-GCM dans `private.gmail_connections`, par identifiant de compte Marrakech Career. Ils ne passent jamais dans le navigateur ou dans n8n. Le CV reste dans un bucket privé Supabase et est supprimé après traitement ; sa copie envoyée reste dans Gmail.

n8n reçoit uniquement un identifiant de demande et un jeton aléatoire à usage unique, valable dix minutes. Le worker Supabase trouve le propriétaire de cette demande et son Gmail. Il refuse une demande rejouée, expirée, ou dont le Gmail a changé. Le workflow n’a donc pas de credential Gmail partagé entre utilisateurs, ni besoin d’une clé Supabase `service_role`.

Une coupure réseau ou un succès HTTP sans identifiant Gmail produit un état incertain. Aucun nouvel essai automatique : vérifier Messages envoyés avant de renvoyer. Les confirmations de chaque destinataire sont conservées séparément. Les candidatures confirmées sont suivies dans Supabase avec `statut=applied`, `delivery_status=sent` et l’identifiant Gmail dans les notes.

## 1. Supabase et Google

1. Appliquer les migrations existantes `202609170001_gmail_connections.sql`, `202609290001_n8n_application_delivery.sql`, puis `202610080001_personal_gmail_n8n.sql`.
2. Activer Gmail API dans le projet Google du client OAuth Web.
3. Ajouter cette URI de redirection autorisée au client OAuth Google, en remplaçant le projet :
   `https://YOUR_PROJECT.supabase.co/functions/v1/gmail-connection`
   Conserver les autres URI de connexion Supabase utilisées pour l’inscription.
4. Configurer ces secrets **serveur Supabase**, jamais `VITE_*` :

   ```text
   GOOGLE_OAUTH_CLIENT_ID
   GOOGLE_OAUTH_CLIENT_SECRET
   GMAIL_TOKEN_ENCRYPTION_KEY
   MARRAKECH_CAREER_APP_URL=https://marrakech-career.vercel.app
   N8N_GMAIL_WEBHOOK_URL=https://YOUR_N8N/webhook/marrakech-career-personal-gmail
   N8N_GMAIL_WEBHOOK_SECRET
   ```

   La clé de chiffrement doit contenir 32 octets encodés base64 ; conserver la clé existante si des comptes sont déjà connectés. Le secret webhook doit contenir au moins 32 caractères aléatoires. Pour le test local seulement, ajouter `GMAIL_ALLOWED_ORIGINS=http://127.0.0.1:5173,http://localhost:5173`.
5. Depuis `backend/`, déployer :

   ```powershell
   supabase functions deploy gmail-connection --no-verify-jwt
   supabase functions deploy send-personal-gmail-campaign --no-verify-jwt
   supabase functions deploy deliver-gmail-application --no-verify-jwt
   supabase functions deploy save-gmail-connection
   ```

   `gmail-connection` et `send-personal-gmail-campaign` vérifient eux-mêmes le JWT pour leurs opérations utilisateur. Le callback OAuth vérifie un état aléatoire enregistré et consommé une seule fois. Le worker n8n vérifie sa capacité d’envoi aléatoire. Le code préparé pour l’ancien `save-gmail-connection` renvoie 410, mais cette ancienne fonction publique n’a pas encore été remplacée. Cette migration finale doit accompagner la publication du nouveau frontend ; les nouvelles fonctions ne prennent aucun jeton OAuth fourni par le navigateur avec une adresse auto-déclarée.

Pour une application publique, terminer la configuration et, si Google l’exige, la vérification de l’écran de consentement OAuth. En mode test, seuls les testeurs Google autorisés peuvent utiliser la connexion. Ne jamais demander le mot de passe Gmail aux utilisateurs.

## 2. Instance n8n

1. Importer `backend/n8n/personal-gmail-applications.json` dans l’instance n8n.
2. Créer un credential **Header Auth** nommé « Marrakech Career webhook » : nom d’en-tête `x-marrakech-career-secret`, valeur identique à `N8N_GMAIL_WEBHOOK_SECRET`. Sélectionner ce credential dans le Webhook.
3. Dans HTTP Request, l’URL du projet actuel est déjà renseignée : `https://rometmtcpaoggerucisc.supabase.co/functions/v1/deliver-gmail-application`. Vérifier que ce projet est celui où les fonctions ont été déployées. Conserver les retries désactivés.
4. Vérifier que les exécutions réussies, échouées et manuelles ne sont pas sauvegardées : elles contiendraient la capacité temporaire de dispatch. Le workflow importé applique déjà cette configuration.
5. Publier/activer le workflow et copier son URL **Production**, pas l’URL Test, dans `N8N_GMAIL_WEBHOOK_URL`.

Le Webhook répond immédiatement. Cette réponse signifie « demande acceptée », pas « message envoyé ». L’application consulte ensuite le statut de son propre envoi dans Supabase. Si n8n n’exécute pas la demande avant son expiration, l’application ne la marque pas envoyée.

## 3. Vérification avant publication

Avec deux comptes de test autorisés et des adresses de réception contrôlées :

1. Un compte A inscrit avec une adresse différente du Gmail choisi doit rester connecté au même profil après OAuth.
2. Refuser l’autorisation : le formulaire d’envoi reste fermé et aucun message n’est envoyé.
3. Envoyer un CV depuis A : vérifier l’expéditeur, le texte et la pièce jointe dans Gmail/Messages envoyés, la réception, et le statut Supabase.
4. Répéter depuis B : il doit utiliser uniquement le Gmail de B. Un identifiant de demande de A ne doit pas être lisible par B.
5. Rejouer le même Webhook : aucun deuxième message ne doit partir.
6. Déconnecter/changer le Gmail avant une exécution : aucun message ne doit partir du mauvais compte.
7. Vérifier qu’une erreur n8n ou Gmail ne produit jamais une confirmation « envoyée » fictive.

Publier ensuite le frontend. L’activation des alertes d’offres Brevo est indépendante et reste inchangée.

Références : [OAuth Google côté serveur](https://developers.google.com/identity/protocols/oauth2/web-server), [Gmail messages.send](https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.messages/send), [Webhook n8n](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.webhook/).
