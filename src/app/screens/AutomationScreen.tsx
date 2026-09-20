import { ArrowLeft, Bot, CheckCircle2, Mail, Shield, Webhook, Wrench } from 'lucide-react';

export default function AutomationScreen({ onBack }: { onBack: () => void }) {
  const steps = [
    { icon: Webhook, label: 'Webhook n8n', detail: 'À créer dans votre instance n8n' },
    { icon: Bot, label: 'Génération du message', detail: 'À relier au service IA de votre choix' },
    { icon: Shield, label: 'Validation utilisateur', detail: 'L’application doit envoyer approval: true' },
    { icon: Mail, label: 'Envoi e-mail', detail: 'À configurer dans n8n (Gmail, SMTP, etc.)' },
    { icon: CheckCircle2, label: 'Mise à jour du suivi', detail: 'À renvoyer vers Supabase après envoi' },
  ];

  return <div className="flex-1 overflow-auto p-8 bg-[#FBF9F7]">
    <div className="flex items-center gap-3 mb-6">
      <button onClick={onBack} className="p-1.5 rounded-lg hover:bg-[#EAE5E0] transition-colors" aria-label="Retour"><ArrowLeft size={18} className="text-[#78716C]" /></button>
      <div><h1 className="text-xl font-bold text-[#1C1917]">Centre d’automatisation</h1><p className="text-[#78716C] text-sm">Configuration n8n manuelle — aucune automatisation fictive n’est exécutée.</p></div>
    </div>
    <div className="max-w-2xl mx-auto space-y-5">
      <div className="bg-[#FFEC8E]/30 border border-[#C6C954]/50 rounded-2xl p-5 flex gap-3"><Wrench size={20} className="text-[#6B5500] shrink-0 mt-0.5" /><div><p className="font-bold text-[#4a4d1a] text-sm">En attente de votre configuration n8n</p><p className="text-sm text-[#6B5500] mt-1">Le bouton de simulation a été retiré : il ne déclenchait aucun workflow. Utilisez <code>N8N_SETUP.md</code> à la racine du projet pour connecter votre webhook quand vous serez prêt.</p></div></div>
      <div className="bg-white rounded-2xl border border-[#EAE5E0] shadow-sm p-6 space-y-2">{steps.map(({ icon: Icon, label, detail }, index) => <div key={label} className="flex items-center gap-4 p-3 rounded-xl border border-[#EAE5E0] bg-[#FBF9F7]"><div className="w-9 h-9 rounded-xl bg-[#621E3E]/10 flex items-center justify-center"><Icon size={17} className="text-[#621E3E]" /></div><div><p className="text-sm font-bold text-[#1C1917]">{index + 1}. {label}</p><p className="text-xs text-[#78716C]">{detail}</p></div></div>)}</div>
    </div>
  </div>;
}
