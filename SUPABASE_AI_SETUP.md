# Déployer l’assistant IA sans exposer la clé Gemini

1. Installez et authentifiez la CLI Supabase.
2. Enregistrez la clé côté serveur :

```bash
supabase secrets set GEMINI_API_KEY="votre-cle-gemini"
```

3. Déployez la fonction :

```bash
supabase functions deploy career-assistant
```

4. Retirez `VITE_GEMINI_API_KEY` de votre fichier `.env`. La clé ne doit jamais commencer par `VITE_`, car Vite l’expose au navigateur.

L’application appelle ensuite `career-assistant` via Supabase. Une session utilisateur valide est requise.
