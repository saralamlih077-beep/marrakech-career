# Connexion n8n (à configurer manuellement)

L’application ne déclenche volontairement aucun webhook n8n tant que vous ne l’avez pas connecté. Cela évite les e-mails ou changements de suivi involontaires.

## Workflow recommandé

1. Créez un workflow avec un nœud **Webhook** en `POST` et protégez-le avec une authentification adaptée.
2. Après la validation explicite de l’utilisateur, recevez un objet de ce type :

```json
{
  "approval": true,
  "companyId": 42,
  "recipient": "recrutement@entreprise.ma",
  "subject": "Candidature — Data Analyst — Nom",
  "body": "...",
  "applicationId": "uuid"
}
```

3. Vérifiez impérativement `approval === true` et que l’adresse e-mail correspond à l’entreprise attendue.
4. Branchez votre nœud Gmail ou SMTP, puis mettez à jour la candidature dans Supabase avec le statut `applied` seulement après une réponse d’envoi réussie.
5. Ne placez ni mot de passe, ni clé n8n secrète dans une variable `VITE_*` : ces valeurs sont accessibles depuis le navigateur. Si vous connectez plus tard le front-end à n8n, passez par une Supabase Edge Function.

## État actuel

Le bouton « Ouvrir le brouillon » ouvre le client e-mail local du candidat et crée une candidature au statut `prepared`. Vous gardez donc la validation et l’envoi sous contrôle, jusqu’à l’intégration n8n.

## Campagne groupée avec CV joint

La nouvelle campagne envoie à n8n la liste d’entreprises favorites sélectionnées, l’objet, le message et un CV PDF/DOC/DOCX. L’utilisateur confirme toujours l’envoi final dans l’application.

1. Dans le nœud **Webhook**, utilisez `POST`, le chemin `marrakech-career` et **Respond** → `Using Respond to Webhook Node`.
2. Dans les options du Webhook, activez la réception du champ binaire nommé `cv`.
3. Ajoutez un nœud **Code** : il transforme le tableau JSON `candidates` en un élément par entreprise et conserve le fichier binaire `cv`.

Code à coller dans ce nœud :

```javascript
const input = $input.first();
const body = input.json.body ?? input.json;
const candidates = typeof body.candidates === 'string'
  ? JSON.parse(body.candidates)
  : body.candidates;

return (candidates ?? [])
  .filter((company) => company.email)
  .map((company) => ({
    json: {
      recipient: company.email,
      companyName: company.name,
      subject: body.subject,
      message: body.message,
    },
    binary: input.binary,
  }));
```

4. Ajoutez **Gmail → Send a message**. Connectez vous-même votre compte Gmail, utilisez l’adresse de chaque élément comme destinataire, `subject` et `message` pour le contenu, puis joignez la propriété binaire `cv`.
5. Reliez le résultat au nœud **Respond to Webhook** avec une réponse JSON de succès.

Dans `.env`, ajoutez :

```env
VITE_N8N_WEBHOOK_URL=http://localhost:5678/webhook/marrakech-career
```

Redémarrez `npm run dev`. Cette URL ne fonctionne que sur le même ordinateur ; pour un site publié, n8n doit avoir un domaine HTTPS ou un tunnel sécurisé.
