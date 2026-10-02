import { useState } from 'react';
import { Bot, CalendarPlus, Clock3, Send, Trash2, X, Zap } from 'lucide-react';
import { useCandidatures } from '../../hooks/useCandidatures';
import { CompanyStatus, MatchBadge } from '../components/shared';
import type { Company } from '../types';
import { companyMatch } from '../utils';
import { askGeminiCareerAssistant } from '../../lib/gemini';

export default function ApplicationTrackerScreen({ companies, favs, onCampaign, onAutomation }: { companies: Company[]; favs: Set<number>; onCampaign: () => void; onAutomation: () => void }) {
  const { data: candidatures, loading, error, updateCandidatureStatus, updateCandidature, deleteCandidature } = useCandidatures();
  const [messageCardId, setMessageCardId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [replyConsent, setReplyConsent] = useState(false);
  const [replyLoading, setReplyLoading] = useState(false);
  const [replyError, setReplyError] = useState('');
  const [replyResult, setReplyResult] = useState<{ status: 'interview' | 'accepted' | 'rejected' | 'unknown'; reason: string } | null>(null);
  const statuses = ['saved', 'prepared', 'applied', 'interview', 'accepted', 'rejected'] as const;
  const colors: Record<string, string> = { saved: '#A8A29E', prepared: '#C6C954', applied: '#621E3E', interview: '#667436', accepted: '#15803D', rejected: '#D9828D' };
  const labels: Record<string, string> = { saved: 'Saved', prepared: 'Prepared', applied: 'Applied', interview: 'Interview', accepted: 'Accepted', rejected: 'Rejected' };
  const getCompany = (id: number | null) => companies.find(company => company.id === id);
  const savedCompanies = companies.filter(company => favs.has(company.id));
  const kpis = statuses.map(status => ({
    label: labels[status],
    value: status === 'saved' ? savedCompanies.length : candidatures.filter(item => item.statut.toLowerCase() === status).length,
    color: colors[status],
  }));
  const messageCard = candidatures.find((item) => item.id === messageCardId);
  const closeMessageAnalyzer = () => {
    setMessageCardId(null);
    setReplyText('');
    setReplyConsent(false);
    setReplyLoading(false);
    setReplyError('');
    setReplyResult(null);
  };
  const analyzeReply = async () => {
    if (!replyConsent) {
      setReplyError('Cochez l’autorisation avant d’analyser le message.');
      return;
    }
    if (replyText.trim().length < 10) {
      setReplyError('Collez le message reçu de l’entreprise.');
      return;
    }
    setReplyLoading(true);
    setReplyError('');
    setReplyResult(null);
    try {
      const prompt = `Analyse le message d’une entreprise ci-dessous et détermine uniquement son résultat pour une candidature. Réponds UNIQUEMENT avec un JSON valide sans Markdown : {"status":"interview|accepted|rejected|unknown","reason":"explication brève en français"}. Utilise interview seulement si le message demande ou propose un entretien, accepted seulement s’il confirme une acceptation, rejected seulement s’il refuse clairement. Pour tout autre message, utilise unknown.\n\nMessage :\n${replyText.slice(0, 6000)}`;
      const response = await askGeminiCareerAssistant({ message: prompt, companies: [] });
      const json = response.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
      const parsed = JSON.parse(json) as { status?: string; reason?: string };
      if (!['interview', 'accepted', 'rejected', 'unknown'].includes(parsed.status || '')) throw new Error('Réponse IA non reconnue.');
      setReplyResult({ status: parsed.status as 'interview' | 'accepted' | 'rejected' | 'unknown', reason: typeof parsed.reason === 'string' ? parsed.reason : 'Statut proposé par l’analyse IA.' });
    } catch (analysisError) {
      setReplyError(analysisError instanceof Error ? `Analyse impossible : ${analysisError.message}` : 'Analyse impossible.');
    } finally {
      setReplyLoading(false);
    }
  };

  const columns = [
    { key: 'saved', label: 'Saved', color: '#A8A29E' },
    { key: 'prepared', label: 'Prepared', color: '#C6C954' },
    { key: 'applied', label: 'Applied', color: '#621E3E' },
    { key: 'interview', label: 'Interview', color: '#667436' },
    { key: 'accepted', label: 'Accepted', color: '#15803D' },
    { key: 'rejected', label: 'Rejected', color: '#D9828D' },
  ] as const;

  return (
    <div className="flex-1 overflow-auto p-8 bg-[#FBF9F7]">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-[#1C1917]">My Applications</h1>
          <p className="text-[#78716C] text-sm mt-0.5">Track your internship and job applications</p>
        </div>
        <div className="flex gap-2">
          <button onClick={onCampaign} className="flex items-center gap-2 px-4 py-2 bg-[#667436] text-white rounded-xl text-sm font-semibold hover:bg-[#52592b] transition-colors">
            <Send size={13} /> Campaign
          </button>
          <button onClick={onAutomation} className="flex items-center gap-2 px-4 py-2 bg-[#621E3E] text-white rounded-xl text-sm font-semibold hover:bg-[#4e1830] transition-colors">
            <Zap size={13} /> Automation
          </button>
        </div>
      </div>

      <div className="grid grid-cols-6 gap-3 mb-6">
        {kpis.map(({ label, value, color }) => (
          <div key={label} className="bg-white rounded-xl border border-[#EAE5E0] shadow-sm p-3 text-center">
            <p className="text-2xl font-extrabold" style={{ color }}>{value}</p>
            <p className="text-xs text-[#78716C] mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {loading && <CompanyStatus loading error={null} />}
      {error && <CompanyStatus loading={false} error={error} />}

      {messageCard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-2xl border border-[#EAE5E0] bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div><h2 className="text-lg font-bold text-[#1C1917]">Analyser une réponse d’entreprise</h2><p className="mt-1 text-xs text-[#78716C]">Collez uniquement le contenu utile du message reçu.</p></div>
              <button onClick={closeMessageAnalyzer} className="rounded-lg p-1 text-[#78716C] hover:bg-[#F5F1ED]"><X size={18} /></button>
            </div>
            <textarea value={replyText} onChange={(event) => setReplyText(event.target.value)} rows={8} placeholder="Collez ici la réponse de l’entreprise…" className="w-full resize-none rounded-xl border border-[#EAE5E0] px-3 py-2.5 text-sm text-[#1C1917] outline-none focus:border-[#621E3E]" />
            <label className="mt-3 flex cursor-pointer items-start gap-2 rounded-xl border border-[#EAE5E0] bg-[#FBF9F7] p-3 text-xs leading-relaxed text-[#57534E]"><input type="checkbox" checked={replyConsent} onChange={(event) => setReplyConsent(event.target.checked)} className="mt-0.5 accent-[#621E3E]" /><span>J’accepte que ce message soit envoyé au service IA uniquement pour proposer un statut. Il ne sera pas enregistré.</span></label>
            {replyError && <p className="mt-3 rounded-xl border border-[#C6C954]/40 bg-[#FFEC8E]/30 p-3 text-xs text-[#6B5500]">{replyError}</p>}
            {replyResult && <div className="mt-3 rounded-xl border border-[#667436]/30 bg-[#667436]/10 p-3"><p className="text-sm font-bold text-[#1C1917]">Statut proposé : {replyResult.status === 'interview' ? 'Entretien' : replyResult.status === 'accepted' ? 'Acceptée' : replyResult.status === 'rejected' ? 'Refusée' : 'À vérifier'}</p><p className="mt-1 text-xs text-[#57534E]">{replyResult.reason}</p></div>}
            <div className="mt-4 flex gap-3"><button onClick={closeMessageAnalyzer} className="flex-1 rounded-xl border border-[#EAE5E0] px-4 py-2 text-sm font-semibold text-[#78716C]">Annuler</button>{replyResult && replyResult.status !== 'unknown' ? <button onClick={() => { void updateCandidature(messageCard.id, { statut: replyResult.status, company_reply: replyText, replied_at: new Date().toISOString() }); closeMessageAnalyzer(); }} className="flex-1 rounded-xl bg-[#621E3E] px-4 py-2 text-sm font-semibold text-white">Enregistrer la réponse</button> : <button onClick={() => void analyzeReply()} disabled={!replyConsent || replyLoading} className="flex-1 rounded-xl bg-[#667436] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{replyLoading ? 'Analyse…' : 'Analyser'}</button>}</div>
          </div>
        </div>
      )}

      <div className="flex gap-4 overflow-x-auto pb-4">
        {columns.map(col => {
          const cards = candidatures.filter(item => item.statut.toLowerCase() === col.key);
          return (
            <div key={col.key} className="w-64 shrink-0">
              <div className="flex items-center gap-2 mb-3 bg-white px-3 py-2 rounded-xl border border-[#EAE5E0]">
                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: col.color }} />
                <h3 className="text-xs font-bold text-[#1C1917] uppercase tracking-wide">{col.label}</h3>
                <span className="ml-auto text-xs font-semibold px-2 py-0.5 rounded-full bg-[#F5F1ED] text-[#78716C]">
                  {col.key === 'saved' ? cards.length + savedCompanies.length : cards.length}
                </span>
              </div>
              <div className="space-y-3">
                {col.key === 'saved' && savedCompanies.map(company => (
                  <div key={`favorite-${company.id}`} className="bg-white rounded-xl border border-[#EAE5E0] shadow-sm p-3.5 hover:shadow-md transition-shadow">
                    <p className="text-xs font-bold text-[#1C1917] mb-0.5">{company.nom}</p>
                    <p className="text-[10px] text-[#78716C] mb-2">{company.domaine || 'Domaine non renseigné'}</p>
                    <div className="flex items-center gap-2 mb-2">
                      <MatchBadge pct={companyMatch(company)} />
                      <span className="text-[10px] text-[#A8A29E]">· Favori</span>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[10px]" style={{ backgroundColor: `${col.color}20`, color: col.color, fontWeight: 600 }}>Saved</span>
                  </div>
                ))}
                {cards.map(card => {
                  const company = getCompany(card.entreprise_id);
                  return (
                    <div key={card.id} className="bg-white rounded-xl border border-[#EAE5E0] shadow-sm p-3.5 hover:shadow-md transition-shadow">
                      <div className="flex items-start justify-between gap-1 mb-1">
                        <p className="text-xs font-bold text-[#1C1917] leading-tight">{company?.nom || 'Entreprise'}</p>
                        <button
                          onClick={() => {
                            if (window.confirm('Supprimer cette candidature ?')) {
                              void deleteCandidature(card.id);
                            }
                          }}
                          className="p-1 text-[#A8A29E] hover:text-red-600 hover:bg-red-50 rounded transition-colors shrink-0"
                          title="Supprimer"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                      <p className="text-[11px] font-semibold text-[#621E3E] mb-2">{card.poste}</p>
                      {card.notes && (
                        <p className="text-[10px] text-[#78716C] italic bg-[#FBF9F7] p-1.5 rounded-lg mb-2 border border-[#EAE5E0]/60 line-clamp-2">
                          "{card.notes}"
                        </p>
                      )}
                      <div className="flex items-center gap-2 mb-3">
                        <MatchBadge pct={company ? companyMatch(company) : 0} />
                        <span className="text-[10px] text-[#A8A29E]">· {card.created_at ? new Date(card.created_at).toLocaleDateString() : 'Date'}</span>
                      </div>
                      {card.date_postulee && <p className="mb-2 text-[10px] text-[#78716C]">Envoyée le {new Date(card.date_postulee).toLocaleDateString('fr-FR')}</p>}
                      {card.follow_up_at ? <p className="mb-2 flex items-center gap-1 text-[10px] font-semibold text-[#667436]"><Clock3 size={11} /> Relance : {new Date(card.follow_up_at).toLocaleDateString('fr-FR')}</p> : card.statut.toLowerCase() === 'applied' ? <button onClick={() => void updateCandidature(card.id, { follow_up_at: new Date(Date.now() + 7 * 86400000).toISOString() })} className="mb-2 flex items-center gap-1 text-[10px] font-bold text-[#667436] hover:underline"><CalendarPlus size={11} /> Planifier une relance à 7 jours</button> : null}
                      {card.company_reply && <p className="mb-2 rounded-lg bg-[#F5F1ED] p-1.5 text-[10px] text-[#57534E]">Réponse enregistrée</p>}
                      <button onClick={() => setMessageCardId(card.id)} className="mb-3 flex w-full items-center justify-center gap-1.5 rounded-lg border border-[#C6C954]/40 bg-[#C6C954]/10 px-2 py-1.5 text-[10px] font-bold text-[#4a4d1a] hover:bg-[#C6C954]/20"><Bot size={12} /> Analyser une réponse</button>
                      <div className="flex items-center justify-between pt-1 border-t border-[#EAE5E0]/60">
                        <span className="text-[10px] text-[#78716C]">Changer statut:</span>
                        <select
                          value={card.statut.toLowerCase()}
                          onChange={(e) => void updateCandidatureStatus(card.id, e.target.value)}
                          className="text-[10px] font-semibold rounded-md border border-[#EAE5E0] bg-white px-1.5 py-0.5 text-[#57534E] cursor-pointer hover:border-[#621E3E] focus:outline-none"
                        >
                          <option value="saved">Saved</option>
                          <option value="prepared">Prepared</option>
                          <option value="applied">Applied</option>
                          <option value="interview">Interview</option>
                          <option value="accepted">Accepted</option>
                          <option value="rejected">Rejected</option>
                        </select>
                      </div>
                    </div>
                  );
                })}
                {cards.length === 0 && savedCompanies.length === 0 && col.key === 'saved' && (
                  <div className="text-center py-6 border-2 border-dashed border-[#EAE5E0] rounded-xl text-xs text-[#A8A29E]">
                    Empty
                  </div>
                )}
                {cards.length === 0 && col.key !== 'saved' && (
                  <div className="text-center py-6 border-2 border-dashed border-[#EAE5E0] rounded-xl text-xs text-[#A8A29E]">
                    Empty
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
