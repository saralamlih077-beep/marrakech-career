import { motion, AnimatePresence } from 'motion/react';
import { Fragment, useState, useRef, useEffect, type ReactNode } from 'react';
import { MessageCircle, X, Send, Bot } from 'lucide-react';
import { askGeminiCareerAssistant } from '../../lib/gemini';
import { useEntreprises } from '../../hooks/useEntreprises';
import { useProfile } from '../../hooks/useProfile';

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

export function ChatBot() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Array<{ text: string; isBot: boolean }>>([
    { text: "Bonjour, je suis l’assistant carrière de Marrakech Career. Comment puis-je vous aider ?", isBot: true },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data: companies } = useEntreprises();
  const { profile } = useProfile();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const query = input.trim();
    if (!query || loading) return;

    const userMessage = { text: query, isBot: false };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const history = messages.map(m => ({
        role: m.isBot ? ('ai' as const) : ('user' as const),
        text: m.text,
      }));

      const reply = await askGeminiCareerAssistant({
        message: query,
        history,
        companies,
        profile,
      });

      setMessages((prev) => [...prev, { text: reply, isBot: true }]);
    } catch (err) {
      console.error('Chatbot error:', err);
      setMessages((prev) => [
        ...prev,
        { text: "Désolé, une erreur est survenue lors de la communication avec l'assistant. Veuillez réessayer.", isBot: true },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Floating Chat Button */}
      <motion.button
        className="fixed bottom-6 right-6 h-14 w-14 rounded-full bg-gradient-to-br from-[#621E3E] to-[#4e1830] shadow-2xl z-50 flex items-center justify-center hover:shadow-[#621E3E]/50 max-sm:bottom-4 max-sm:right-4"
        onClick={() => setIsOpen(!isOpen)}
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.95 }}
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 260, damping: 20 }}
      >
        <AnimatePresence mode="wait">
          {isOpen ? (
            <motion.div
              key="close"
              initial={{ rotate: -90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: 90, opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <X className="w-6 h-6 text-white" />
            </motion.div>
          ) : (
            <motion.div
              key="chat"
              initial={{ rotate: -90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: 90, opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <MessageCircle className="w-6 h-6 text-white" />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Notification Pulse */}
        {!isOpen && (
          <motion.div
            className="absolute inset-0 bg-[#667436] rounded-full -z-10"
            initial={{ scale: 1, opacity: 0.5 }}
            animate={{ scale: 1.4, opacity: 0 }}
            transition={{ duration: 2.5, repeat: Infinity }}
          />
        )}
      </motion.button>

      {/* Chat Window */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            className="fixed bottom-24 right-6 z-40 flex h-[min(560px,calc(100dvh-7rem))] w-96 max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-3xl border border-[#EAE5E0] bg-white shadow-2xl max-sm:bottom-20 max-sm:right-4"
            initial={{ opacity: 0, y: 30, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 30, scale: 0.9 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          >
            {/* Header */}
            <div className="shrink-0 bg-gradient-to-r from-[#621E3E] to-[#4e1830] p-4 flex items-center gap-3">
              <div className="w-10 h-10 bg-white/10 backdrop-blur-sm rounded-full flex items-center justify-center text-white">
                <Bot size={20} />
              </div>
              <div className="flex-1">
                <h3 className="text-white font-bold text-sm">Marrakech Career AI</h3>
                <p className="text-white/80 text-xs">Assistant IA</p>
              </div>
              <button onClick={() => setIsOpen(false)} className="text-white/80 hover:text-white p-1">
                <X size={16} />
              </button>
            </div>

            {/* Messages */}
            <div className="min-h-0 flex-1 overflow-y-auto space-y-3 bg-[#FBF9F7] p-4">
              {messages.map((message, index) => (
                <motion.div
                  key={index}
                  className={`flex ${message.isBot ? 'justify-start' : 'justify-end'}`}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <div
                    className={`max-w-[85%] px-3.5 py-2.5 rounded-2xl text-xs leading-relaxed ${
                      message.isBot
                        ? 'bg-white border border-[#EAE5E0] text-[#1C1917] shadow-sm'
                        : 'whitespace-pre-wrap bg-[#621E3E] text-white'
                    }`}
                  >
                    {message.isBot ? <ChatMessageContent text={message.text} /> : message.text}
                  </div>
                </motion.div>
              ))}
              {loading && (
                <div className="flex justify-start">
                  <div className="bg-white border border-[#EAE5E0] rounded-2xl px-3 py-2 text-xs text-[#78716C] shadow-sm flex items-center gap-2">
                    <Bot size={14} className="text-[#621E3E] animate-bounce" />
                    <span>L'IA réfléchit...</span>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <form onSubmit={handleSend} className="p-3 bg-white border-t border-[#EAE5E0]">
              <div className="flex gap-2">
                <input
                  type="text"
                  disabled={loading}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Posez votre question..."
                  className="flex-1 px-3.5 py-2 text-xs border border-[#EAE5E0] rounded-xl focus:outline-none focus:border-[#621E3E] disabled:opacity-50"
                />
                <motion.button
                  type="submit"
                  disabled={loading || !input.trim()}
                  className="px-3.5 py-2 bg-[#621E3E] text-white rounded-xl hover:bg-[#4e1830] transition-colors disabled:opacity-50"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <Send className="w-4 h-4" />
                </motion.button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
