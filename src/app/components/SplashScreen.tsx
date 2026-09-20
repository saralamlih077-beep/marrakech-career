import { motion } from 'motion/react';
import { useEffect, useState } from 'react';

interface SplashScreenProps {
  onComplete: () => void;
}

export function SplashScreen({ onComplete }: SplashScreenProps) {
  const [progress, setProgress] = useState(0);
  const [loadingText, setLoadingText] = useState('Initialisation de Marrakech Career…');

  useEffect(() => {
    const progressInterval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(progressInterval);
          setTimeout(onComplete, 500);
          return 100;
        }
        return prev + 100 / 150; // 15 seconds = 150 frames at 10fps
      });
    }, 100);

    const textTimeout1 = setTimeout(() => setLoadingText('Chargement des opportunités…'), 5000);
    const textTimeout2 = setTimeout(() => setLoadingText('Préparation de votre espace carrière…'), 10000);

    return () => {
      clearInterval(progressInterval);
      clearTimeout(textTimeout1);
      clearTimeout(textTimeout2);
    };
  }, [onComplete]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#621E3E]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(198,201,84,0.28),_transparent_42%)]"></div>

      <motion.div
        className="relative z-10 text-center px-8"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
      >
        <motion.div
          className="mb-6"
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
        >
          <div className="w-20 h-20 mx-auto bg-[#C6C954] rounded-2xl flex items-center justify-center">
            <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 2a7 7 0 0 0-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 0 0-7-7Zm0 10a3 3 0 1 1 0-6 3 3 0 0 1 0 6Z" />
            </svg>
          </div>
        </motion.div>

        <h1 className="text-5xl font-bold text-white mb-4">
          Marrakech Career
        </h1>
        <p className="text-xl text-[#A7BCBD] mb-12">
          Votre prochaine opportunité commence ici
        </p>

        <div className="w-96 mx-auto">
          <div className="h-2 bg-white/20 rounded-full overflow-hidden backdrop-blur-sm">
            <motion.div
            className="h-full bg-[#C6C954] rounded-full"
              style={{ width: `${progress}%` }}
              transition={{ duration: 0.1 }}
            />
          </div>
          <motion.p
            className="mt-4 text-[#EDECDB] text-sm"
            key={loadingText}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
          >
            {loadingText}
          </motion.p>
        </div>
      </motion.div>
    </div>
  );
}
