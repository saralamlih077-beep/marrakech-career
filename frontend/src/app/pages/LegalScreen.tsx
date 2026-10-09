type LegalPage = 'privacy' | 'terms';

export default function LegalScreen({ page }: { page: LegalPage }) {
  const privacy = page === 'privacy';
  return <main className="min-h-screen bg-[#FBF9F7] px-5 py-12 text-[#292524]">
    <article className="mx-auto max-w-3xl rounded-3xl border border-[#EAE5E0] bg-white p-7 shadow-sm sm:p-10">
      <a href="/" className="text-sm font-bold text-[#621E3E]">← Retour à Marrakech Career</a>
      <h1 className="mt-6 text-3xl font-extrabold">{privacy ? 'Politique de confidentialité' : 'Conditions d’utilisation'}</h1>
      <p className="mt-2 text-sm text-[#78716C]">Dernière mise à jour : 27 septembre 2026</p>
      {privacy ? <div className="mt-8 space-y-6 text-sm leading-7 text-[#57534E]">
        <section><h2 className="text-lg font-bold text-[#1C1917]">Données utilisées</h2><p>Marrakech Career utilise les informations de profil, le CV que vous choisissez de téléverser et vos candidatures uniquement pour vous aider à rechercher des offres et à postuler.</p></section>
        <section><h2 className="text-lg font-bold text-[#1C1917]">Connexion Gmail</h2><p>Lorsque vous choisissez de connecter Gmail, l’application demande uniquement l’autorisation d’envoyer des e-mails en votre nom. Elle l’utilise exclusivement lorsque vous confirmez l’envoi d’une candidature, de sa lettre et de son CV. Elle ne lit pas votre boîte de réception.</p></section>
        <section><h2 className="text-lg font-bold text-[#1C1917]">Vos choix</h2><p>Vous décidez toujours de téléverser votre CV et de confirmer chaque envoi. Vous pouvez demander la suppression de vos données ou poser une question à l’adresse d’assistance ci-dessous.</p></section>
        <section><h2 className="text-lg font-bold text-[#1C1917]">Contact</h2><p>Pour toute question relative à vos données : <a className="font-semibold text-[#621E3E]" href="mailto:marrakechcareer@gmail.com">marrakechcareer@gmail.com</a>.</p></section>
      </div> : <div className="mt-8 space-y-6 text-sm leading-7 text-[#57534E]">
        <section><h2 className="text-lg font-bold text-[#1C1917]">Utilisation du service</h2><p>Marrakech Career aide les candidats à découvrir des offres et à préparer leurs candidatures. L’utilisateur reste responsable des informations qu’il saisit et des e-mails qu’il choisit d’envoyer.</p></section>
        <section><h2 className="text-lg font-bold text-[#1C1917]">Candidatures</h2><p>Avant tout envoi, l’utilisateur doit vérifier le destinataire, le CV et la lettre de motivation. Marrakech Career ne garantit ni la disponibilité d’une offre ni une réponse de l’entreprise.</p></section>
        <section><h2 className="text-lg font-bold text-[#1C1917]">Contact</h2><p>Pour toute question concernant le service : <a className="font-semibold text-[#621E3E]" href="mailto:marrakechcareer@gmail.com">marrakechcareer@gmail.com</a>.</p></section>
      </div>}
    </article>
  </main>;
}
