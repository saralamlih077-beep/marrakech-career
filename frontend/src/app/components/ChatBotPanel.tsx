import { Fragment, useEffect, useRef, type ReactNode, type FormEvent } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { ArrowUpRight, BriefcaseBusiness, FileUser, MessagesSquare, Minus, Send, X } from 'lucide-react';
import { CareerAssistantLogo } from './CareerAssistantLogo';
import './chatbot.css';

export type CareerChatMessage = { text: string; isBot: boolean };

const suggestions = [
  { label: 'Trouver un emploi à Marrakech', icon: BriefcaseBusiness, prompt: 'Aide-moi à trouver un emploi à Marrakech adapté à mon profil.' },
  { label: 'Améliorer mon CV', icon: FileUser, prompt: 'Comment améliorer mon CV pour mes candidatures ?' },
  { label: 'Préparer un entretien', icon: MessagesSquare, prompt: 'Aide-moi à préparer un entretien professionnel.' },
];

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

/** Rend le Markdown courant de l’IA sans injecter de HTML non fiable. */
function ChatMessageContent({ text }: { text: string }) {
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
      blocks.push(
        <div key={`table-${index}`} className="my-2 max-w-full overflow-x-auto rounded-lg border border-[#EAE5E0]">
          <table className="min-w-full text-left text-[11px] leading-relaxed">
            <thead className="bg-[#F5F1ED] text-[#57534E]"><tr>{headers.map((header, cellIndex) => <th key={cellIndex} className="whitespace-nowrap px-2.5 py-2 font-bold">{formatInline(header)}</th>)}</tr></thead>
            <tbody>{rows.map((row, rowIndex) => <tr key={rowIndex} className="border-t border-[#EAE5E0]">{headers.map((_, cellIndex) => <td key={cellIndex} className="px-2.5 py-2 align-top text-[#57534E]">{formatInline(row[cellIndex] || '')}</td>)}</tr>)}</tbody>
          </table>
        </div>,
      );
      continue;
    }
    if (/^#{1,3}\s+/.test(line)) blocks.push(<p key={index} className="mt-2 font-bold text-[#621E3E]">{formatInline(line.replace(/^#{1,3}\s+/, ''))}</p>);
    else if (/^[-*]\s+/.test(line)) blocks.push(<div key={index} className="flex gap-1.5"><span>•</span><span>{formatInline(line.replace(/^[-*]\s+/, ''))}</span></div>);
    else if (/^\d+\.\s+/.test(line)) blocks.push(<div key={index} className="flex gap-1.5"><span>{line.match(/^\d+\./)?.[0]}</span><span>{formatInline(line.replace(/^\d+\.\s+/, ''))}</span></div>);
    else blocks.push(<p key={index} className="mb-1.5">{formatInline(line)}</p>);
    index += 1;
  }
  return <>{blocks}</>;
}

type ChatBotPanelProps = {
  messages: CareerChatMessage[];
  input: string;
  loading: boolean;
  onInput: (value: string) => void;
  onSend: (query: string) => void;
  onClose: () => void;
};

export function ChatBotPanel({ messages, input, loading, onInput, onSend, onClose }: ChatBotPanelProps) {
  const bodyRef = useRef<HTMLDivElement>(null);
  const reducedMotion = useReducedMotion();
  const inputRef = useRef<HTMLInputElement>(null);
  const hasUserMessage = messages.some(message => !message.isBot);
  const openedDate = useRef(new Date());
  const dateLabel = openedDate.current.toLocaleDateString() === new Date().toLocaleDateString()
    ? 'Aujourd’hui'
    : openedDate.current.toLocaleDateString('fr-MA', { day: 'numeric', month: 'long' });

  useEffect(() => { inputRef.current?.focus(); }, []);
  useEffect(() => {
    const body = bodyRef.current;
    if (body && hasUserMessage) body.scrollTop = body.scrollHeight;
  }, [messages, loading, hasUserMessage]);
  useEffect(() => {
    const closeWithEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', closeWithEscape);
    return () => document.removeEventListener('keydown', closeWithEscape);
  }, [onClose]);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!loading && input.trim()) onSend(input.trim());
  };

  return (
    <motion.section id="career-chat-panel" className="career-chat-panel" role="region" aria-labelledby="career-chat-title"
      initial={reducedMotion ? false : { opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: reducedMotion ? 0 : 16 }}
      transition={{ duration: reducedMotion ? 0 : 0.18 }}>
      <header className="career-chat-header">
        <div className="career-chat-logo"><CareerAssistantLogo /></div>
        <div className="career-chat-heading">
          <h2 id="career-chat-title">Marrakech Career</h2>
          <p>Votre assistant carrière</p>
        </div>
        <div className="career-chat-controls">
          <button type="button" onClick={onClose} className="career-chat-icon-button" aria-label="Réduire le chatbot" title="Réduire"><Minus size={17} /></button>
          <button type="button" onClick={onClose} className="career-chat-icon-button" aria-label="Fermer le chatbot" title="Fermer"><X size={18} /></button>
        </div>
      </header>
      <div className="career-chat-body" ref={bodyRef}>
        {!hasUserMessage && <div className="career-chat-arch" aria-hidden="true" />}
        <p className="career-chat-date">{dateLabel}</p>
        <div className="career-chat-messages" role="log" aria-label="Conversation avec l’assistant" aria-live="polite" aria-relevant="additions">
          {messages.map((message, index) => (
            <div key={index} className={`career-chat-message${message.isBot ? '' : ' is-user'}`}>
              <span className="career-chat-author">{message.isBot ? 'Marrakech Career' : 'Vous'}</span>
              <div className="career-chat-bubble">
                {message.isBot ? <ChatMessageContent text={message.text} /> : message.text}
              </div>
            </div>
          ))}
        </div>
        {!hasUserMessage && (
          <div className="career-chat-suggestions">
            <p>Quelques idées pour commencer</p>
            {suggestions.map(({ label, icon: Icon, prompt }) => (
              <button key={label} type="button" className="career-chat-suggestion" disabled={loading} onClick={() => onSend(prompt)}>
                <Icon size={18} /><span>{label}</span><ArrowUpRight size={16} />
              </button>
            ))}
          </div>
        )}
        {loading && <div className="career-chat-loading" role="status"><span>L’assistant prépare sa réponse…</span></div>}
      </div>
      <form onSubmit={handleSubmit} className="career-chat-footer">
        <div className="career-chat-composer">
          <input ref={inputRef} type="text" value={input} onChange={event => onInput(event.target.value)} placeholder="Écrivez votre message…" aria-label="Votre message à l’assistant" autoComplete="off" />
          <button type="submit" disabled={loading || !input.trim()} className="career-chat-send" aria-label="Envoyer le message" title="Envoyer"><Send size={20} /></button>
        </div>
        <p>Un premier pas vers votre avenir professionnel.</p>
      </form>
    </motion.section>
  );
}
