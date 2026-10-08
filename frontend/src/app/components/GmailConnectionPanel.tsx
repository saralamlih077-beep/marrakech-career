import { CheckCircle2, Mail, RefreshCw } from 'lucide-react';
import type { PersonalGmail } from '../../hooks/usePersonalGmail';

export default function GmailConnectionPanel({ gmail, registrationEmail, disabled = false }: { gmail: PersonalGmail; registrationEmail: string; disabled?: boolean }) {
  const busy = disabled || gmail.loading || gmail.connecting || !gmail.ready;
  return <section aria-label="Gmail pour vos candidatures" className="mb-5 rounded-2xl border border-[#EAE5E0] bg-white p-5 sm:p-6">
    <div className="flex items-start gap-3">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#621E3E]/10 text-[#621E3E]"><Mail size={22} /></div>
      <div className="min-w-0"><h2 className="text-lg font-bold text-[#1C1917]">{gmail.connected ? 'Votre Gmail d’envoi' : 'Connectez votre Gmail pour postuler'}</h2>
        <p className="mt-1 text-sm leading-relaxed text-[#78716C]">{gmail.connected ? 'Vos candidatures partent de ce compte et apparaissent dans ses Messages envoyés.' : 'Choisissez le Gmail qui enverra votre candidature, puis autorisez l’envoi dans Google. Votre compte Marrakech Career reste le même.'}</p>
      </div>
    </div>
    {gmail.loading ? <p className="mt-4 text-sm text-[#78716C]">Vérification de votre connexion Gmail…</p> : gmail.connected ? <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
      <p className="flex min-w-0 items-center gap-2 break-all text-sm font-semibold text-[#667436]"><CheckCircle2 size={17} className="shrink-0" />{gmail.email}</p>
      <button type="button" disabled={busy} onClick={() => void gmail.connect(false)} className="rounded-xl border border-[#EAE5E0] px-4 py-2.5 text-sm font-semibold text-[#621E3E] disabled:opacity-50">Changer de Gmail</button>
    </div> : <div className="mt-5 grid gap-3 sm:grid-cols-2">
      <button type="button" disabled={busy} onClick={() => void gmail.connect(true)} className="rounded-xl bg-[#621E3E] px-4 py-3 text-left text-sm font-bold text-white disabled:opacity-50">Utiliser mon e-mail d’inscription<span className="mt-1 block break-all text-xs font-normal text-white/80">{registrationEmail}</span></button>
      <button type="button" disabled={busy} onClick={() => void gmail.connect(false)} className="rounded-xl border border-[#EAE5E0] px-4 py-3 text-left text-sm font-bold text-[#621E3E] disabled:opacity-50">Choisir un autre Gmail<span className="mt-1 block text-xs font-normal text-[#78716C]">Sélectionner le compte dans Google</span></button>
    </div>}
    {gmail.connecting && <p role="status" className="mt-3 text-sm text-[#78716C]">Terminez l’autorisation dans la fenêtre Google.</p>}
    {gmail.error && <p role="status" className="mt-3 text-sm text-[#A16207]">{gmail.error}</p>}
    {!gmail.loading && !gmail.error && !gmail.deliveryReady && <p role="status" className="mt-3 text-sm text-[#A16207]">Le service d’envoi est en cours d’activation. Aucune candidature ne sera envoyée avant sa disponibilité.</p>}
    <p className="mt-4 text-xs leading-relaxed text-[#78716C]">L’inscription ne donne pas l’autorisation d’envoyer des e-mails. Cette connexion reste disponible pour vos prochaines candidatures ; vous confirmez chaque envoi.</p>
    {gmail.error && <button type="button" onClick={() => void gmail.refresh()} className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-[#621E3E]"><RefreshCw size={13} />Réessayer la vérification</button>}
  </section>;
}
