# Envoi automatique des candidatures avec n8n

Cette intégration envoie les candidatures depuis **marrakechcareer@gmail.com**. Le candidat ne connecte jamais Gmail.

À chaque clic sur « Envoyer » dans la campagne :

1. Supabase archive, de façon privée, le nom et l’e-mail du candidat, la lettre et le CV.
2. Supabase donne à n8n un lien privé valable une heure pour télécharger le CV.
3. n8n joint le CV et envoie le message à l’entreprise.
4. La candidature est marquée `sent` dans Supabase uniquement après le succès de n8n.

## Pré-requis indispensables

- Une instance n8n accessible en HTTPS : n8n Cloud, Render, Railway ou un serveur. `localhost:5678` ne fonctionne pas depuis le site Vercel.
- Le compte Gmail officiel connecté **dans n8n** avec `marrakechcareer@gmail.com`.
- La migration `202609290001_n8n_application_delivery.sql` appliquée dans Supabase.

## Créer le workflow n8n

1. Dans n8n, créez un workflow et ajoutez un nœud **Webhook**.
   - Méthode : `POST`
   - Path : `marrakech-career-application`
   - Response : **Using Respond to Webhook Node**
   - Authentification : **Header Auth**
   - Nom de l’en-tête : `x-marrakech-career-secret`
   - Valeur : créez une longue valeur secrète aléatoire.
2. Ajoutez un nœud **Code** après Webhook et collez :

```javascript
const input = $input.first().json;
const data = input.body ?? input;

if (!data.applicationId || !data.recipient?.email || !data.cv?.downloadUrl) {
  throw new Error('Payload de candidature invalide.');
}

return [{
  json: {
    applicationId: data.applicationId,
    recipient: data.recipient,
    candidate: data.candidate,
    subject: data.subject,
    message: `${data.coverLetter}\n\n---\nCandidat : ${data.candidate.name}\nE-mail : ${data.candidate.email}`,
    cv: data.cv,
  },
}];
```

3. Ajoutez **HTTP Request** après ce Code :
   - Method : `GET`
   - URL : `={{ $json.cv.downloadUrl }}`
   - Response Format : `File`
   - Put Output in Field : `cvFile`
4. Ajoutez **Gmail → Send a message** :
   - Credential : connectez `marrakechcareer@gmail.com`.
   - To : `={{ $json.recipient.email }}`
   - Subject : `={{ $json.subject }}`
   - Message : `={{ $json.message }}`
   - Attachment / Binary property : `cvFile`
5. Ajoutez **Respond to Webhook** après Gmail avec ce JSON :

```json
{ "sent": true }
```

6. Activez le workflow, copiez l’URL **Production URL** du Webhook. Elle ressemble à :

```text
https://votre-n8n.exemple/webhook/marrakech-career-application
```

## Secrets Supabase à ajouter

Dans **Supabase → Edge Functions → Secrets**, ajoutez :

```text
N8N_APPLICATION_WEBHOOK_URL = URL Production du Webhook n8n
N8N_APPLICATION_WEBHOOK_SECRET = la même valeur que Header Auth dans n8n
```

Ne mettez jamais ces valeurs dans `VITE_*`, dans le navigateur ou dans Git.

## Déployer le serveur Supabase

Déployez la fonction puis testez avec une seule entreprise :

```bash
supabase functions deploy submit-n8n-application
```

En cas d’échec n8n, la candidature, la lettre, l’e-mail du candidat et le CV restent enregistrés dans Supabase. Le statut devient `failed` au lieu de perdre la candidature.
