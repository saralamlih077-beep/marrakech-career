import { useState } from 'react';
import { AlertTriangle, Bot, CheckCircle, FileSearch, FileText, Sparkles, Upload } from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import pdfWorker from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url';
import * as mammoth from 'mammoth/mammoth.browser';
import { askGeminiCareerAssistant } from '../../lib/gemini';
import { PageHeader, SkillTag } from '../components/shared';
import { useProfile } from '../../hooks/useProfile';

type CvAnalysis = {
  completeness: number;
  skills: string[];
  strengths: string[];
  advice: { type: 'warning' | 'info' | 'success'; text: string }[];
};

export default function CVAnalyzerScreen({ onBack }: { onBack: () => void }) {
  const [fileName, setFileName] = useState('');
  const [fileText, setFileText] = useState('');
  const [fileError, setFileError] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [aiConsent, setAiConsent] = useState(false);
  const [analysis, setAnalysis] = useState<CvAnalysis | null>(null);
  const { profile, saveProfile } = useProfile();
  const extractPdfText = async (file: File) => {
    pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;
    const document = await pdfjsLib.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
    const pages = await Promise.all(Array.from({ length: document.numPages }, async (_, index) => {
      const page = await document.getPage(index + 1);
      const content = await page.getTextContent();
      return content.items.map(item => 'str' in item ? item.str : '').join(' ');
    }));
    return pages.join('\n');
  };
  const handleFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setAnalysis(null);
    setFileText('');
    setFileError('');
    if (file.size > 5 * 1024 * 1024) {
      setFileName('');
      setFileError('Le fichier dépasse la limite de 5 Mo.');
      return;
    }
    try {
      const lowerName = file.name.toLowerCase();
      const text = lowerName.endsWith('.txt')
        ? await file.text()
        : lowerName.endsWith('.pdf')
          ? await extractPdfText(file)
          : lowerName.endsWith('.docx')
            ? (await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() })).value
            : (() => { throw new Error('Format non pris en charge.'); })();
      if (!text.trim()) throw new Error('Aucun texte exploitable.');
      setFileText(text);
      setFileName(file.name);
      setFileError('');
    } catch (error) {
      setFileText('');
      setFileName('');
      const detail = error instanceof Error && error.message ? ` (${error.message})` : '';
      setFileError(`Impossible de lire ce fichier${detail} Utilisez un PDF avec texte sélectionnable, un DOCX ou un fichier TXT.`);
    }
  };
  const analyze = async () => {
    if (!fileText.trim()) {
      setFileError('Chargez d’abord un CV lisible avant de lancer l’analyse.');
      return;
    }
    if (!aiConsent) {
      setFileError('Cochez l’autorisation IA avant de lancer l’analyse.');
      return;
    }
    setAnalyzing(true);
    setFileError('');
    try {
      const prompt = `Analyse uniquement le CV ci-dessous. Ne devine aucune information et ne reprends pas le profil utilisateur. Réponds UNIQUEMENT avec un objet JSON valide, sans Markdown, au format : {"completeness":nombre de 0 à 100,"skills":["compétence réellement présente"],"strengths":["point fort réellement constaté"],"advice":[{"type":"warning ou info ou success","text":"conseil concret lié au CV"}]}. Donne de 3 à 6 conseils en français.\n\nCV téléversé :\n${fileText.slice(0, 7000)}`;
      const response = await askGeminiCareerAssistant({ message: prompt, companies: [] });
      const json = response.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
      const parsed = JSON.parse(json) as Partial<CvAnalysis>;
      if (!Array.isArray(parsed.skills) || !Array.isArray(parsed.advice) || typeof parsed.completeness !== 'number') throw new Error('Réponse IA non structurée.');
      const detectedSkills = parsed.skills.filter((skill): skill is string => typeof skill === 'string').slice(0, 15);
      setAnalysis({
        completeness: Math.max(0, Math.min(100, Math.round(parsed.completeness))),
        skills: detectedSkills,
        strengths: Array.isArray(parsed.strengths) ? parsed.strengths.filter((item): item is string => typeof item === 'string').slice(0, 5) : [],
        advice: parsed.advice.filter((item): item is CvAnalysis['advice'][number] => Boolean(item && typeof item.text === 'string' && ['warning', 'info', 'success'].includes(item.type || ''))).slice(0, 6),
      });
      const existing = profile.skills.split(',').map((skill) => skill.trim()).filter(Boolean);
      const merged = [...existing, ...detectedSkills].reduce<string[]>((all, skill) => all.some((item) => item.toLocaleLowerCase() === skill.toLocaleLowerCase()) ? all : [...all, skill], []);
      void saveProfile({ ...profile, skills: merged.join(', ') });
    } catch (error) {
      setAnalysis(null);
      setFileError(error instanceof Error ? `Analyse IA impossible : ${error.message}` : 'Analyse IA impossible. Vérifiez la configuration Groq.');
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <div className="flex-1 overflow-auto p-8 bg-[#FBF9F7]">
      <PageHeader title="CV Analyzer" sub="AI-powered CV analysis and optimization" back onBack={onBack} />

      <div className="grid grid-cols-3 gap-5">
        <div className="col-span-1 space-y-5">
          {!fileName ? (
            <label className="bg-white rounded-xl border-2 border-dashed border-[#EAE5E0] p-8 flex flex-col items-center text-center cursor-pointer hover:border-[#621E3E] transition-colors group">
              <input type="file" accept=".pdf,.doc,.docx,.txt" onChange={handleFile} className="hidden" />
              <div className="w-14 h-14 rounded-2xl bg-[#FBF9F7] group-hover:bg-[#621E3E]/5 flex items-center justify-center mb-3 transition-colors">
                <Upload size={22} className="text-[#A8A29E]" />
              </div>
              <p className="text-sm font-semibold text-[#1C1917]">Upload CV</p>
              <p className="text-xs text-[#A8A29E] mt-1">PDF, DOCX ou TXT · analyse locale · max 5 Mo</p>
            </label>
          ) : (
            <div className="bg-white rounded-xl border border-[#EAE5E0] shadow-sm p-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-[#621E3E]/10 flex items-center justify-center">
                  <FileText size={18} className="text-[#621E3E]" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-[#1C1917]">{fileName}</p>
                  <p className="text-xs text-[#78716C]">Fichier chargé · analyse prête</p>
                </div>
              </div>
              <div className="text-center py-4">
                <div className="text-4xl font-extrabold text-[#667436] mb-1">{analysis?.completeness ?? 0}%</div>
                <p className="text-xs text-[#78716C]">CV Completeness</p>
                <div className="w-full h-3 bg-[#F5F1ED] rounded-full mt-3 overflow-hidden">
                  <div className="h-full bg-[#667436] rounded-full" style={{ width: `${analysis?.completeness ?? 0}%` }} />
                </div>
              </div>
            </div>
          )}

          <label className="flex items-start gap-2 rounded-xl border border-[#EAE5E0] bg-white p-3 text-xs text-[#57534E] cursor-pointer">
            <input type="checkbox" checked={aiConsent} onChange={event => setAiConsent(event.target.checked)} className="mt-0.5 accent-[#621E3E]" />
            <span>J’accepte que le texte de mon CV soit envoyé au service IA pour obtenir une analyse personnalisée.</span>
          </label>
          <button onClick={() => void analyze()} disabled={!fileText || !aiConsent || analyzing} className="w-full flex items-center justify-center gap-2 py-2 bg-[#667436] text-white rounded-xl text-xs font-bold disabled:opacity-50">
            <FileSearch size={12} /> {analyzing ? 'Analyzing...' : 'Analyze this CV'}
          </button>

          {fileError && <p className="text-xs text-[#6B5500] bg-[#FFEC8E]/30 border border-[#C6C954]/40 rounded-xl p-3">{fileError}</p>}

        </div>

        <div className="col-span-2 space-y-5">
          <div className="bg-white rounded-xl border border-[#EAE5E0] shadow-sm p-5">
            <h3 className="text-sm font-bold text-[#1C1917] mb-3">Detected Skills</h3>
            <div className="flex flex-wrap gap-2">
              {(analysis?.skills ?? []).map(sk => <SkillTag key={sk} label={sk} />)}
              {analysis && analysis.skills.length === 0 && <span className="text-xs text-[#A8A29E]">Aucune compétence détectée.</span>}
            </div>
          </div>

          {analysis && analysis.strengths.length > 0 && <div className="bg-white rounded-xl border border-[#EAE5E0] shadow-sm p-5"><h3 className="text-sm font-bold text-[#1C1917] mb-3">Points forts relevés</h3><ul className="space-y-2 text-sm text-[#57534E]">{analysis.strengths.map((strength) => <li key={strength}>• {strength}</li>)}</ul></div>}

          <div className="bg-white rounded-xl border border-[#EAE5E0] shadow-sm p-5">
            <div className="flex items-center gap-2 mb-3">
              <Bot size={14} className="text-[#667436]" />
              <h3 className="text-sm font-bold text-[#1C1917]">Conseils généraux</h3>
            </div>
            <div className="space-y-3">
              {!analysis && <p className="text-sm text-[#78716C]">Téléversez un CV puis lancez l’analyse pour recevoir des conseils personnalisés.</p>}
              {analysis?.advice.map(({ type, text }, i) => (
                <div key={i} className={`flex items-start gap-2.5 p-3 rounded-xl text-sm ${type === 'warning' ? 'bg-[#FFEC8E]/30 text-[#6B5500]' : type === 'success' ? 'bg-[#667436]/10 text-[#3d4520]' : 'bg-[#FBF9F7] text-[#57534E]'}`}>
                  {type === 'warning' ? <AlertTriangle size={14} className="shrink-0 mt-0.5" /> : type === 'success' ? <CheckCircle size={14} className="shrink-0 mt-0.5 text-[#667436]" /> : <Sparkles size={14} className="shrink-0 mt-0.5 text-[#78716C]" />}
                  {text}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
