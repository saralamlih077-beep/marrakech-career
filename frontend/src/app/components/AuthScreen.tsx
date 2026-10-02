import { motion } from 'motion/react';
import { useState } from 'react';

interface AuthScreenProps {
  onLogin: (name: string, email: string) => void;
}

export function AuthScreen({ onLogin }: AuthScreenProps) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    password: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const name = isSignUp ? formData.fullName : formData.email.split('@')[0];
    onLogin(name, formData.email);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#EDECDB] p-8">
      <motion.div
        className="w-full max-w-md"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
      >
        <div className="bg-white rounded-3xl shadow-2xl p-8 border border-[#A7BCBD]">
          <motion.h2
            className="text-3xl font-bold text-[#163832] mb-2"
            key={isSignUp ? 'signup' : 'signin'}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            {isSignUp ? 'Create Account' : 'Welcome Back 👋'}
          </motion.h2>
          <p className="text-[#6BB1AD] mb-8">
            {isSignUp ? 'Join us to predict your property value' : 'Sign in to continue'}
          </p>

          <form onSubmit={handleSubmit} className="space-y-5">
            {isSignUp && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
              >
                <label className="block text-sm font-medium text-[#163832] mb-2">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  className="w-full px-4 py-3 border border-[#A7BCBD] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#6BB1AD] transition-all"
                  placeholder="John Doe"
                  value={formData.fullName}
                  onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                />
              </motion.div>
            )}

            <div>
              <label className="block text-sm font-medium text-[#163832] mb-2">
                Email
              </label>
              <input
                type="email"
                required
                className="w-full px-4 py-3 border border-[#A7BCBD] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#6BB1AD] transition-all"
                placeholder="you@example.com"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[#163832] mb-2">
                Password
              </label>
              <input
                type="password"
                required
                className="w-full px-4 py-3 border border-[#A7BCBD] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#6BB1AD] transition-all"
                placeholder="••••••••"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              />
            </div>

            <motion.button
              type="submit"
              className="w-full py-3 rounded-xl text-white font-medium transition-all"
              style={{ backgroundColor: isSignUp ? '#E6748C' : '#6BB1AD' }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              {isSignUp ? 'Sign Up' : 'Sign In'}
            </motion.button>
          </form>

          <div className="mt-6 text-center">
            <button
              onClick={() => setIsSignUp(!isSignUp)}
              className="text-[#6BB1AD] hover:text-[#163832] transition-colors text-sm"
            >
              {isSignUp
                ? 'Already have an account? Sign In'
                : "Don't have an account? Sign Up"}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
