import { Fragment, useState, useRef, useEffect, type ReactNode } from 'react';
import { Bot, Send } from 'lucide-react';
import { useProfile } from '../../hooks/useProfile';
import { useFavorites } from '../../hooks/useFavorites';
import { askGeminiCareerAssistant } from '../../lib/gemini';
import { INITIAL_MESSAGES } from '../constants';
import type { Company, ChatMessage } from '../types';

function formatInline(text: string): ReactNode {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, index) =>
    part.startsWith('**') && part.endsWith('**')
      ? <strong key={index}>{part.slice(2, -2)}</strong>
      : <Fragment key={index}>{part}</Fragment>,
  );
}

function tableCells(line: string) {
  return line.trim().replace(/^\||\|$/g, '').split('|').map(cell => cell.trim());
}

function MarkdownMessage({ text }: { text: string }) {
  const lines = text.split('\n');
  const blocks: ReactNode[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index].trim();
    if (!line) { index += 1; continue; }

    const nextLine = lines[index + 1]?.trim() || '';
    if (line.includes('|') && /^\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?$/.test(nextLine)) {
      const headers = tableCells(line);
      index += 2;
      const rows: string[][] = [];
      while (index < lines.length && lines[index].includes('|')) {
        rows.push(tableCells(lines[index]));
        index += 1;
      }
      blocks.push(<div key={`table-${index}`} className="my-3 overflow-x-auto rounded-lg border border-[#EAE5E0]"><table className="min-w-full text-left text-xs"><thead className="bg-[#F5F1ED] text-[#57534E]"><tr>{headers.map((header, cellIndex) => <th key={cellIndex} className="px-3 py-2 font-bold">{formatInline(header)}</th>)}</tr></thead><tbody>{rows.map((row, rowIndex) => <tr key={rowIndex} className="border-t border-[#EAE5E0]">{headers.map((_, cellIndex) => <td key={cellIndex} className="px-3 py-2 align-top text-[#57534E]">{formatInline(row[cellIndex] || '')}</td>)}</tr>)}</tbody></table></div>);
      continue;
    }

    const heading = line.match(/^(#{1,3})\s+(.+)/);
    if (heading) {
      blocks.push(<p key={`heading-${index}`} className="mt-3 mb-1 text-sm font-bold text-[#621E3E]">{formatInline(heading[2])}</p>);
    } else if (/^[-*]\s+/.test(line)) {
      blocks.push(<div key={`bullet-${index}`} className="flex gap-2"><span>•</span><span>{formatInline(line.replace(/^[-*]\s+/, ''))}</span></div>);
    } else if (/^\d+\.\s+/.test(line)) {
      blocks.push(<div key={`number-${index}`} className="flex gap-2"><span>{line.match(/^\d+\./)?.[0]}</span><span>{formatInline(line.replace(/^\d+\.\s+/, ''))}</span></div>);
    } else {
      blocks.push(<p key={`text-${index}`} className="mb-2">{formatInline(line)}</p>);
    }
    index += 1;
  }

  return <>{blocks}</>;
}

export default function AIAssistantScreen({ companies, loading, error, onView }: { companies: Company[]; loading: boolean; error: string | null; onView: (c: Company) => void }) {
  const [messages, setMessages] = useState<ChatMessage[]>(INITIAL_MESSAGES);
  const [input, setInput] = useState('');
  const [loadingReply, setLoadingReply] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const { profile } = useProfile();
  const { favorites: favs, toggleFavorite: onFav } = useFavorites();

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loadingReply]);

  const send = async (explicitText?: string) => {
    const textToSend = (explicitText || input).trim();
    if (!textToSend || loadingReply) return;

    const userMsg: ChatMessage = { role: 'user', text: textToSend };
    const placeholderAi: ChatMessage = { role: 'ai', text: '' };
    setMessages(prev => [...prev, userMsg, placeholderAi]);
    setInput('');
    setLoadingReply(true);

    try {
      const reply = await askGeminiCareerAssistant({
        message: textToSend,
        history: messages,
        companies,
        profile,
        onChunk: (partial) => {
          setMessages(prev => {
            const next = [...prev];
            const last = next.length - 1;
            if (last >= 0 && next[last].role === 'ai') {
              next[last] = { ...next[last], text: partial };
            }
            return next;
          });
        },
      });

      // Find if any company was mentioned in the reply
      const lowerReply = reply.toLowerCase();
      const mentionedIds = companies
        .filter(c => lowerReply.includes(c.nom.toLowerCase()))
        .slice(0, 3)
        .map(c => c.id);

      setMessages(prev => {
        const next = [...prev];
        const last = next.length - 1;
        if (last >= 0 && next[last].role === 'ai') {
          next[last] = {
            ...next[last],
            text: reply,
            cards: mentionedIds.length > 0 ? mentionedIds : undefined,
          };
        }
        return next;
      });
    } catch (err) {
      console.error('Error in AI assistant:', err);
      const detail = err instanceof Error ? err.message : 'Erreur inconnue.';
      setMessages(prev => [
        ...prev,
        { role: 'ai', text: `L’assistant IA n’a pas pu répondre : ${detail}` },
      ]);
    } finally {
      setLoadingReply(false);
    }
  };

  const suggestions = [
    'Continuer la suite',
    'Quelles entreprises recrutent des stagiaires à Marrakech ?',
    'Comment puis-je améliorer mon CV pour le secteur IT ?',
    'Conseille-moi une entreprise adaptée à mon profil',
  ];

  return (
    <div className="flex-1 flex overflow-hidden">
      {/* Chat area */}
      <div className="flex-1 flex flex-col bg-[#FBF9F7]">
        <div className="flex items-center gap-3 px-6 py-4 bg-white border-b border-[#EAE5E0]">
          <div className="w-9 h-9 rounded-xl bg-[#621E3E]/10 flex items-center justify-center">
            <Bot size={18} className="text-[#621E3E]" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-[#1C1917]">Career Assistant IA</h2>
            <div className="flex items-center gap-1.5 text-xs text-[#15803D]">
              <div className="w-1.5 h-1.5 rounded-full bg-[#15803D] animate-pulse" /> En ligne · Propulsé par Google Gemini
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-auto px-6 py-5 space-y-5">
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-2xl ${msg.role === 'user' ? 'bg-[#621E3E] text-white rounded-2xl rounded-tr-sm' : 'bg-white border border-[#EAE5E0] rounded-2xl rounded-tl-sm'} px-4 py-3 shadow-sm`}>
                {msg.role === 'ai' && (
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <Bot size={12} className="text-[#621E3E]" />
                    <span className="text-[10px] font-bold text-[#621E3E]">Assistant Marrakech Career</span>
                  </div>
                )}
                <div className={`text-sm leading-relaxed ${msg.role === 'user' ? 'text-white' : 'text-[#1C1917]'}`}>
                  <MarkdownMessage text={msg.text} />
                </div>
                {msg.cards && msg.cards.length > 0 && (
                  <div className="mt-3 space-y-2 pt-2 border-t border-[#EAE5E0]/60">
                    <p className="text-[10px] font-bold text-[#78716C] uppercase tracking-wider">Entreprises suggérées :</p>
                    {companies.filter(c => msg.cards!.includes(c.id)).map(c => (
                      <div key={c.id} className="bg-[#FBF9F7] rounded-xl p-3 flex items-center justify-between border border-[#EAE5E0] hover:border-[#621E3E]/40 transition-colors">
                        <div>
                          <p className="text-xs font-bold text-[#1C1917]">{c.nom}</p>
                          <p className="text-[10px] text-[#78716C]">{c.domaine || 'Domaine non renseigné'}</p>
                        </div>
                        <div className="flex gap-1.5">
                          <button onClick={() => onView(c)} className="text-[10px] px-2.5 py-1 bg-[#621E3E] text-white rounded-lg font-semibold hover:bg-[#4e1830] transition-colors">Voir</button>
                          <button onClick={() => onFav(c.id)} className={`text-[10px] px-2.5 py-1 border rounded-lg transition-colors ${favs.has(c.id) ? 'bg-[#D9828D]/20 text-[#D9828D] border-[#D9828D]/40 font-bold' : 'bg-white border-[#EAE5E0] text-[#78716C]'}`}>
                            {favs.has(c.id) ? 'Sauvegardé' : 'Sauvegarder'}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}

          {loadingReply && (
            <div className="flex justify-start">
              <div className="bg-white border border-[#EAE5E0] rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm flex items-center gap-2.5">
                <Bot size={14} className="text-[#621E3E] animate-bounce" />
                <span className="text-xs text-[#78716C]">L'assistant IA prépare votre réponse personnalisée...</span>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        <div className="px-6 py-4 bg-white border-t border-[#EAE5E0]">
          <div className="flex flex-wrap gap-2 mb-3">
            {suggestions.map(s => (
              <button
                key={s}
                disabled={loadingReply}
                onClick={() => send(s)}
                className="text-xs px-3 py-1.5 rounded-full border border-[#EAE5E0] text-[#78716C] hover:border-[#621E3E] hover:text-[#621E3E] transition-colors bg-[#FBF9F7] disabled:opacity-50"
              >
                {s}
              </button>
            ))}
          </div>
          <div className="flex gap-3">
            <input
              value={input}
              disabled={loadingReply}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && send()}
              placeholder="Posez une question sur les entreprises, votre CV, des opportunités à Marrakech..."
              className="flex-1 bg-[#FBF9F7] border border-[#EAE5E0] rounded-xl px-4 py-3 text-sm text-[#1C1917] placeholder:text-[#A8A29E] focus:outline-none focus:border-[#621E3E] disabled:opacity-50"
            />
            <button
              onClick={() => send()}
              disabled={loadingReply || !input.trim()}
              className="px-5 py-3 bg-[#621E3E] text-white rounded-xl hover:bg-[#4e1830] transition-colors disabled:opacity-50 flex items-center justify-center"
            >
              <Send size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
