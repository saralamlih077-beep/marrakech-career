# Candidatures : Gmail personnel et n8n

## État de cette version

Le parcours, les fonctions serveur, la migration et le workflow sont préparés. L’envoi réel exige une instance n8n en HTTPS, la configuration Google OAuth et le déploiement Supabase ci-dessous. Un déploiement du frontend sur Vercel ne déploie pas ces fonctions ni la migration.

Ne remplacer la version publique qu’après activation et vérification du serveur. Les tests automatisés utilisent des réponses Google/n8n simulées et n’envoient aucun e-mail réel.

## Parcours utilisateur

- Aucune autorisation Gmail à l’inscription.
- Au premier Apply/Candidature, proposer l’e-mail d’inscription ou un autre Gmail. L’adresse d’inscription sert seulement de suggestion : Google confirme le compte réellement choisi.
- Une fenêtre Google demande `openid`, `email` et `gmail.send` (envoi uniquement). Le compte Marrakech Career reste connecté ; le choix d’un autre Gmail ne crée pas un autre compte dans l’application.
- Après autorisation, afficher le Gmail d’envoi et « Changer de Gmail », puis le formulaire CV/lettre.
- Chaque envoi est confirmé explicitement. Le suivi affiche « en attente » jusqu’à réception de l’identifiant du message fourni par Gmail. Le message et le CV apparaissent alors dans Messages envoyés ; les réponses arrivent dans ce Gmail.

## Architecture

`Candidature → send-gmail-campaign → webhook n8n → deliver-gmail-application → API Gmail`

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
   supabase functions deploy send-gmail-campaign --no-verify-jwt
   supabase functions deploy deliver-gmail-application --no-verify-jwt
   supabase functions deploy save-gmail-connection
   ```

   `gmail-connection` et `send-gmail-campaign` vérifient eux-mêmes le JWT pour leurs opérations utilisateur. Le callback OAuth vérifie un état aléatoire enregistré et consommé une seule fois. Le worker n8n vérifie sa capacité d’envoi aléatoire. L’ancien `save-gmail-connection` renvoie désormais 410 ; aucun jeton OAuth fourni avec une adresse auto-déclarée n’est accepté.

Pour une application publique, terminer la configuration et, si Google l’exige, la vérification de l’écran de consentement OAuth. En mode test, seuls les testeurs Google autorisés peuvent utiliser la connexion. Ne jamais demander le mot de passe Gmail aux utilisateurs.

## 2. Instance n8n

1. Importer `backend/n8n/personal-gmail-applications.json` dans l’instance n8n.
2. Créer un credential **Header Auth** nommé « Marrakech Career webhook » : nom d’en-tête `x-marrakech-career-secret`, valeur identique à `N8N_GMAIL_WEBHOOK_SECRET`. Sélectionner ce credential dans le Webhook.
3. Dans HTTP Request, remplacer `YOUR_PROJECT` par le projet Supabase effectif. Conserver les retries désactivés.
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
