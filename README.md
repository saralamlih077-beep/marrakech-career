
# Marrakech Career

Marrakech Career est une application web qui aide les étudiants et candidats à découvrir des opportunités à Marrakech, créer leur CV, analyser leurs compétences et suivre leurs candidatures.

## Fonctionnalités

- Authentification, confirmation d’e-mail et réinitialisation de mot de passe avec Supabase.
- Entreprises, favoris, carte et offres avec compétences, expiration et score de correspondance.
- Studio CV, analyse de CV, matching IA, assistant carrière et lettre de motivation personnalisée.
- Suivi de candidature : envoi, relance, réponse d’entreprise, entretien, acceptation ou refus.
- Alertes e-mail intelligentes avec Brevo, Supabase Edge Functions et n8n.
- Avis utilisateurs et tableau de bord administrateur.

## Lancer le projet localement

```bash
npm install
npm run dev
```

Ouvrez ensuite l’adresse affichée par Vite, habituellement `http://localhost:5173`.

## Variables d’environnement

Créez un fichier `.env` à la racine :

```env
VITE_SUPABASE_URL=votre_url_supabase
VITE_SUPABASE_ANON_KEY=votre_cle_anon_supabase
VITE_GROQ_API_KEY=votre_cle_groq_de_developpement
```

Ne publiez jamais ces clés dans GitHub. Les secrets Brevo, Groq côté serveur et n8n sont configurés dans **Supabase → Edge Functions → Secrets**.

## Services

- **Supabase** : base de données, authentification et fonctions serveur.
- **Groq** : fonctionnalités IA.
- **Brevo** : alertes e-mail.
- **n8n** : import des offres et alertes automatiques.
- **Vercel** : hébergement public.

## Déploiement

1. Envoyez le projet vers un dépôt GitHub privé.
2. Importez ce dépôt dans Vercel.
3. Ajoutez `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY` dans les variables Vercel.
4. Ajoutez l’URL Vercel dans **Supabase → Authentication → URL Configuration**.
  
