import { motion, AnimatePresence } from 'motion/react';
import { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, Send, Bot } from 'lucide-react';
import { askGeminiCareerAssistant } from '../../lib/gemini';
import { useEntreprises } from '../../hooks/useEntreprises';
import { useProfile } from '../../hooks/useProfile';

export function ChatBot() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Array<{ text: string; isBot: boolean }>>([
    { text: "Bonjour ! 👋 Je suis l'assistant carrière intelligent de Marrakech Career. Comment puis-je vous aider aujourd'hui ?", isBot: true },
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
        className="fixed bottom-8 right-8 w-14 h-14 bg-gradient-to-br from-[#621E3E] to-[#4e1830] rounded-full shadow-2xl flex items-center justify-center z-50 hover:shadow-[#621E3E]/50"
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
            className="fixed bottom-24 right-8 w-96 h-[560px] bg-white rounded-3xl shadow-2xl z-40 flex flex-col overflow-hidden border border-[#EAE5E0]"
            initial={{ opacity: 0, y: 30, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 30, scale: 0.9 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-[#621E3E] to-[#4e1830] p-4 flex items-center gap-3">
              <div className="w-10 h-10 bg-white/10 backdrop-blur-sm rounded-full flex items-center justify-center text-white">
                <Bot size={20} />
              </div>
              <div className="flex-1">
                <h3 className="text-white font-bold text-sm">Marrakech Career AI</h3>
                <p className="text-white/80 text-xs">En ligne · Google Gemini</p>
              </div>
              <button onClick={() => setIsOpen(false)} className="text-white/80 hover:text-white p-1">
                <X size={16} />
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#FBF9F7]">
              {messages.map((message, index) => (
                <motion.div
                  key={index}
                  className={`flex ${message.isBot ? 'justify-start' : 'justify-end'}`}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <div
                    className={`max-w-[85%] px-3.5 py-2.5 rounded-2xl text-xs whitespace-pre-wrap leading-relaxed ${
                      message.isBot
                        ? 'bg-white border border-[#EAE5E0] text-[#1C1917] shadow-sm'
                        : 'bg-[#621E3E] text-white'
                    }`}
                  >
                    {message.text}
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
