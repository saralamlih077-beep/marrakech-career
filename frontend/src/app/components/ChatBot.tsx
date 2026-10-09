const CHATBOT_INITIAL_MESSAGES = [{ text: '**Bonjour !** Je suis l’assistant de Marrakech Career.\nComment puis-je vous aider ?', isBot: true }];
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { useState, useRef, useCallback } from 'react';
import { X } from 'lucide-react';
import { askGeminiCareerAssistant } from '../../lib/gemini';
import { useEntreprises } from '../../hooks/useEntreprises';
import { useProfile } from '../../hooks/useProfile';
import { CareerAssistantLogo } from './CareerAssistantLogo';
import { ChatBotPanel, type CareerChatMessage } from './ChatBotPanel';

export function ChatBot() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<CareerChatMessage[]>(CHATBOT_INITIAL_MESSAGES);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const launcherRef = useRef<HTMLButtonElement>(null);
  const sendingRef = useRef(false);
  const reducedMotion = useReducedMotion();
  const { data: companies } = useEntreprises();
  const { profile } = useProfile();

  const closeChat = useCallback(() => {
    setIsOpen(false);
    launcherRef.current?.focus();
  }, []);

  const sendMessage = async (text: string) => {
    const query = text.trim();
    if (!query || sendingRef.current) return;
    sendingRef.current = true;
    setMessages(prev => [...prev, { text: query, isBot: false }]);
    setInput('');
    setLoading(true);
    try {
      const history = messages.map(message => ({
        role: message.isBot ? ('ai' as const) : ('user' as const),
        text: message.text,
      }));
      const reply = await askGeminiCareerAssistant({ message: query, history, companies, profile });
      setMessages(prev => [...prev, { text: reply, isBot: true }]);
    } catch (err) {
      console.error('Chatbot error:', err);
      setMessages(prev => [...prev, {
        text: "L’assistant est momentanément indisponible. Vous pouvez réessayer en envoyant votre message à nouveau.",
        isBot: true,
      }]);
    } finally {
      sendingRef.current = false;
      setLoading(false);
    }
  };

  return (
    <>
      <motion.button
        ref={launcherRef}
        type="button"
        className="career-chat-launcher"
        onClick={() => isOpen ? closeChat() : setIsOpen(true)}
        aria-label={isOpen ? 'Réduire le chatbot' : 'Ouvrir l’assistant Marrakech Career'}
        aria-expanded={isOpen}
        aria-controls={isOpen ? 'career-chat-panel' : undefined}
        whileHover={reducedMotion ? undefined : { scale: 1.05 }}
        whileTap={reducedMotion ? undefined : { scale: 0.95 }}
      >
        {isOpen ? <X size={24} /> : <CareerAssistantLogo />}
      </motion.button>
      <AnimatePresence>
        {isOpen && (
          <ChatBotPanel key="career-chat" messages={messages} input={input} loading={loading} onInput={setInput} onSend={sendMessage} onClose={closeChat} />
        )}
      </AnimatePresence>
    </>
  );
}
