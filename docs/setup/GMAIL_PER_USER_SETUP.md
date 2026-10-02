# Gmail personnel par utilisateur

Chaque candidat connecte son propre Gmail dans **Settings > Gmail personnel**. Les campagnes sont alors envoyées depuis son adresse : n8n ne sert plus à envoyer les e-mails.

## À configurer une seule fois

1. Dans Supabase, connecte-toi au projet puis ouvre **Authentication > Sign In / Providers > Google**.
2. Active Google et ajoute le Client ID et le Client Secret du client OAuth Google prévu pour l’application. Ajoute dans ce client Google l’URI de rappel affichée par Supabase, habituellement `https://rometmtcpaoggerucisc.supabase.co/auth/v1/callback`.
3. Dans **Authentication > URL Configuration**, ajoute `http://localhost:5173` et l’URL publique future du site comme URLs de redirection.
4. Active *Manual linking* dans la configuration Auth de Supabase : l’utilisateur pourra lier Gmail sans remplacer son compte Marrakech Career.
5. Exécute la migration `backend/supabase/migrations/202609170001_gmail_connections.sql` dans le SQL Editor Supabase.
6. Déploie les deux fonctions Edge :

   ```powershell
   supabase functions deploy save-gmail-connection
   supabase functions deploy send-gmail-campaign
   ```

7. Ajoute dans les secrets des fonctions (jamais dans `.env` du navigateur) :

   ```powershell
   supabase secrets set GOOGLE_OAUTH_CLIENT_ID="..."
   supabase secrets set GOOGLE_OAUTH_CLIENT_SECRET="..."
   supabase secrets set GMAIL_TOKEN_ENCRYPTION_KEY="..."
   ```

`GMAIL_TOKEN_ENCRYPTION_KEY` doit être une clé AES-256 encodée base64 (32 octets). Garde-la privée : sans elle les jetons Gmail stockés ne peuvent pas être lus.

## Consentement de chaque utilisateur

Lors du clic sur **Connecter Gmail**, Google demande l’autorisation d’envoyer des e-mails et de lire les réponses. L’utilisateur choisit le Gmail concerné et accepte. Il peut retirer l’accès à tout moment depuis son compte Google.

## Important pour la mise en production

Les autorisations `gmail.send` et surtout `gmail.readonly` sont sensibles. En mode test, seuls les testeurs Google déclarés peuvent utiliser l’application. Pour des utilisateurs publics, Google peut demander une vérification OAuth et une politique de confidentialité avant publication.
