import { supabase } from './supabaseClient';
import type { Entreprise } from '../types/entreprise';
import type { ProfileData } from '../types/profile';

export interface ChatTurn { role: 'user' | 'ai'; text: string; }
interface CareerAssistantResponse { text?: string; }

const localGroqKey = import.meta.env.VITE_GROQ_API_KEY as string | undefined;

function createRequest(message: string, history: ChatTurn[], companies: Entreprise[], profile?: ProfileData) {
  const companySummary = companies.slice(0, 25).map(company => `- ${company.nom} (${company.domaine || 'Général'}${company.sous_domaine ? ` / ${company.sous_domaine}` : ''})`).join('\n');
  const profileSummary = profile ? `Profil : ${profile.full_name || 'Non renseigné'}, poste recherché : ${profile.job_title || 'Non renseigné'}, compétences : ${profile.skills || 'Non renseignées'}, expérience : ${profile.experience || 'Non renseignée'}.` : 'Profil non renseigné.';
  return {
    system_instruction: { parts: [{ text: `Tu es l’assistant carrière de Marrakech Career Hub. Réponds dans la langue de l’utilisateur, avec des conseils concrets et bienveillants. Utilise du Markdown lisible : titres ##, listes à puces et tableaux uniquement lorsqu’ils apportent de la clarté. Ne recommande jamais plus de 6 entreprises à la fois. Ne prétends pas qu’une entreprise recrute ou propose un stage si cette information ne figure pas dans les données fournies ; présente-la plutôt comme une piste à vérifier. ${profileSummary}\nEntreprises disponibles :\n${companySummary}` }] },
    contents: [...history.slice(-6), { role: 'user' as const, text: message }].map(turn => ({ role: turn.role === 'ai' ? 'model' : 'user', parts: [{ text: turn.text }] })),
    generationConfig: { temperature: 0.7, maxOutputTokens: 1200 },
  };
}

async function callGroqDirectly(message: string, history: ChatTurn[], companies: Entreprise[], profile?: ProfileData) {
  if (!localGroqKey) throw new Error('La clé Groq est absente. Ajoutez VITE_GROQ_API_KEY au fichier .env.');
  const request = createRequest(message, history, companies, profile);
  const systemMessage = request.system_instruction.parts[0].text;
  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localGroqKey}` },
    body: JSON.stringify({
      model: 'openai/gpt-oss-20b',
      temperature: 0.7,
      max_tokens: 1200,
      messages: [
        { role: 'system', content: systemMessage },
        ...request.contents.map(item => ({ role: item.role === 'model' ? 'assistant' : 'user', content: item.parts[0].text })),
      ],
    }),
  });
  if (!response.ok) {
    const detail = await response.json().catch(() => null) as { error?: { message?: string } } | null;
    throw new Error(detail?.error?.message || 'Groq a renvoyé une erreur.');
  }
  const payload = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
  const text = payload.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error("Groq n'a retourné aucune réponse.");
  return text;
}

export async function askGeminiCareerAssistantStream({ message, history = [], companies = [], profile, onChunk }: { message: string; history?: ChatTurn[]; companies?: Entreprise[]; profile?: ProfileData; onChunk?: (partialText: string) => void; }): Promise<string> {
  let text: string;
  try {
    const { data, error } = await supabase.functions.invoke<CareerAssistantResponse>('career-assistant', { body: { message, history, companies, profile } });
    if (error || !data?.text?.trim()) throw new Error('Fonction Supabase indisponible');
    text = data.text.trim();
  } catch {
    // Production requests stay on the protected Supabase Edge Function. A local
    // Groq key is accepted only for development when the function is unavailable.
    if (!localGroqKey) {
      throw new Error("L’assistant IA est momentanément indisponible. Réessayez dans quelques instants.");
    }
    text = await callGroqDirectly(message, history, companies, profile);
  }
  onChunk?.(text);
  return text;
}

export const askGeminiCareerAssistant = askGeminiCareerAssistantStream;
