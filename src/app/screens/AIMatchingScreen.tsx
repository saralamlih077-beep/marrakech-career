import { MapPin, Sparkles, Eye } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useProfile } from '../../hooks/useProfile';
import { askGeminiCareerAssistant } from '../../lib/gemini';
import { DOMAIN_COLORS } from '../constants';
import { matchColor, companyMatch, companySkills, companyAddress, recommendationScore, userInitials } from '../utils';
import { SectorPill, SkillTag, CompanyStatus } from '../components/shared';
import type { Company } from '../types';

export default function AIMatchingScreen({ companies, loading, error, favs, onFav, onView }: { companies: Company[]; loading: boolean; error: string | null; favs: Set<number>; onFav: (id: number) => void; onView: (c: Company) => void }) {
  const { profile, email } = useProfile();
  const [aiConsent, setAiConsent] = useState(false);
  const [aiRanking, setAiRanking] = useState<Record<number, { score: number; reason: string }>>({});
  const [matching, setMatching] = useState(false);
  const [matchError, setMatchError] = useState('');
  const baseRanked = useMemo(() => [...companies].sort((a, b) => recommendationScore(b, profile) - recommendationScore(a, profile)), [companies, profile]);
  const rankedMatches = useMemo(() => [...baseRanked].sort((a, b) => (aiRanking[b.id]?.score ?? recommendationScore(b, profile)) - (aiRanking[a.id]?.score ?? recommendationScore(a, profile))), [aiRanking, baseRanked, profile]);
  const scoreFor = (company: Company) => aiRanking[company.id]?.score ?? recommendationScore(company, profile);
  const strongMatches = rankedMatches.filter(c => scoreFor(c) >= 35);
  const topMatches = (strongMatches.length > 0 ? strongMatches : rankedMatches).slice(0, 10);
  const profileSkills = profile.skills.split(',').map(skill => skill.trim()).filter(Boolean);

  const runAiMatching = async () => {
    if (!aiConsent) return setMatchError('Cochez l’autorisation IA avant de lancer le matching.');
    if (!profile.job_title && !profile.skills && !profile.education && !profile.experience) return setMatchError('Complétez votre profil avant de lancer le matching IA.');
    setMatching(true); setMatchError('');
    try {
      const candidates = baseRanked.slice(0, 10).map(company => ({ id: company.id, name: company.nom, domain: company.domaine, subdomain: company.sous_domaine, category: company.categorie }));
      const prompt = `Évalue la compatibilité entre ce profil candidat et les entreprises ci-dessous. Ne prétends jamais qu'une entreprise recrute : évalue uniquement la compatibilité avec son secteur. Réponds seulement par un objet JSON compact, sans Markdown, sans retour à la ligne dans reason : {"matches":[{"id":nombre,"score":nombre,"reason":"maximum 12 mots"}]}. Retourne chaque id fourni une seule fois.\nProfil : ${JSON.stringify({ jobTitle: profile.job_title, education: profile.education, experience: profile.experience, skills: profile.skills, projects: profile.projects, languages: profile.languages })}\nEntreprises : ${JSON.stringify(candidates)}`;
      const response = await askGeminiCareerAssistant({ message: prompt, companies: [] });
      const cleanedResponse = response.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
      const start = cleanedResponse.indexOf('{');
      const end = cleanedResponse.lastIndexOf('}');
      if (start === -1 || end <= start) throw new Error('Réponse IA non structurée.');
      const parsed = JSON.parse(cleanedResponse.slice(start, end + 1)) as { matches?: Array<{ id?: number; score?: number; reason?: string }> };
      if (!Array.isArray(parsed.matches)) throw new Error('Réponse IA non structurée.');
      const next: Record<number, { score: number; reason: string }> = {};
      parsed.matches.forEach(match => { if (typeof match.id === 'number' && typeof match.score === 'number' && candidates.some(candidate => candidate.id === match.id)) next[match.id] = { score: Math.max(0, Math.min(100, Math.round(match.score))), reason: typeof match.reason === 'string' ? match.reason : 'Compatibilité évaluée à partir du profil et du secteur.' }; });
      if (Object.keys(next).length === 0) throw new Error('Aucun résultat utilisable.');
      setAiRanking(next);
    } catch {
      const fallback = Object.fromEntries(baseRanked.slice(0, 10).map(company => [company.id, { score: recommendationScore(company, profile), reason: 'Score calculé à partir de votre profil et du secteur.' }]));
      setAiRanking(fallback);
      setMatchError('La réponse IA était incomplète. Les scores fiables de votre profil ont été calculés automatiquement.');
    }
    finally { setMatching(false); }
  };

  return (
    <div className="flex-1 overflow-auto p-8 bg-[#FBF9F7]">
      <div className="mb-6 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-[#C6C954]/20 flex items-center justify-center">
          <Sparkles size={20} className="text-[#667436]" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-[#1C1917]">AI Career Matching</h1>
          <p className="text-[#78716C] text-sm">Companies matching your profile \u2014 updated in real-time</p>
        </div>
        <span className="ml-auto text-xs px-3 py-1.5 rounded-full bg-[#C6C954]/20 text-[#4a4d1a] font-bold border border-[#C6C954]/40">AI Powered</span>
      </div>

      <div className="grid grid-cols-3 gap-5 mb-7">
        {/* Profile summary */}
        <div className="bg-white rounded-xl border border-[#EAE5E0] shadow-sm p-5">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-full bg-[#621E3E] flex items-center justify-center text-white font-bold">{userInitials(profile.full_name, email)}</div>
            <div>
              <p className="text-sm font-bold text-[#1C1917]">{profile.full_name || 'Nom non renseign\u00e9'}</p>
              <p className="text-xs text-[#78716C]">{profile.job_title || 'Poste non renseign\u00e9'}</p>
            </div>
          </div>
          <div className="space-y-3">
            {[
              { label: 'Education', value: profile.education || 'Non renseign\u00e9e' },
              { label: 'Target', value: profile.job_title || 'Non renseign\u00e9' },
              { label: 'Address', value: profile.address || 'Non renseign\u00e9e' },
            ].map(({ label, value }) => (
              <div key={label}>
                <p className="text-[10px] font-semibold text-[#A8A29E] uppercase tracking-wide">{label}</p>
                <p className="text-sm text-[#1C1917] font-medium">{value}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 pt-4 border-t border-[#EAE5E0]">
            <p className="text-xs font-semibold text-[#57534E] mb-2">My Skills</p>
            <div className="flex flex-wrap gap-1.5">
              {profileSkills.length === 0 ? <span className="text-xs text-[#A8A29E]">Ajoutez vos comp\u00e9tences dans Mon Profil.</span> : profileSkills.map(sk => <SkillTag key={sk} label={sk} />)}
            </div>
          </div>
          <label className="mt-4 flex items-start gap-2 text-xs text-[#57534E] cursor-pointer"><input type="checkbox" checked={aiConsent} onChange={event => setAiConsent(event.target.checked)} className="mt-0.5 accent-[#621E3E]" /><span>J’accepte que mon profil soit envoyé au service IA pour calculer les compatibilités.</span></label>
          <button onClick={() => void runAiMatching()} disabled={matching || !aiConsent} className="mt-3 w-full flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-bold border border-[#C6C954]/60 text-[#667436] bg-[#C6C954]/10 hover:bg-[#C6C954]/20 transition-colors disabled:opacity-50">
            <Sparkles size={12} /> {matching ? 'Analyse IA…' : 'Calculer mes matchs IA'}
          </button>
          {matchError && <p className="mt-2 text-xs text-red-700">{matchError}</p>}
        </div>

        {/* Match results */}
        <div className="col-span-2 space-y-4">
          <CompanyStatus loading={loading} error={error} />
          {topMatches.map((c, i) => (
            <div key={c.id} className="bg-white rounded-xl border border-[#EAE5E0] shadow-sm p-5">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-sm shrink-0" style={{ backgroundColor: DOMAIN_COLORS[c.domaine || ''] || '#621E3E' }}>
                  {c.nom.split(' ').slice(0, 2).map(w => w[0]).join('')}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <h3 className="text-sm font-bold text-[#1C1917]">{c.nom}</h3>
                    <SectorPill domaine={c.domaine || 'Domaine non renseign\u00e9'} sousDomaine={c.sous_domaine} />
                    {i === 0 && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#FFEC8E] text-[#6B5500]">Top Match</span>}
                  </div>
                  <p className="text-xs text-[#78716C] mb-3 flex items-center gap-1"><MapPin size={10} />{companyAddress(c)}</p>
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {companySkills(c).map(sk => <SkillTag key={sk} label={sk} />)}
                  </div>
                  <p className="text-xs text-[#78716C]">{aiRanking[c.id]?.reason || 'Score calculé à partir des compétences, du poste et du secteur de l’entreprise.'}</p>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-3xl font-extrabold mb-1" style={{ color: matchColor(scoreFor(c)) }}>{scoreFor(c)}%</div>
                  <div className="w-20 h-2 bg-[#F5F1ED] rounded-full overflow-hidden mb-3">
                    <div className="h-full rounded-full" style={{ width: `${scoreFor(c)}%`, backgroundColor: matchColor(scoreFor(c)) }} />
                  </div>
                  <button onClick={() => onView(c)} className="flex items-center gap-1.5 px-3 py-1.5 bg-[#621E3E] text-white rounded-lg text-xs font-semibold hover:bg-[#4e1830] transition-colors">
                    <Eye size={11} /> View
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
