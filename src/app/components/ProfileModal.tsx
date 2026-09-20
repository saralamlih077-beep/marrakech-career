import { motion, AnimatePresence } from 'motion/react';
import { X, User, Mail, History, DollarSign, MapPin, Calendar } from 'lucide-react';

interface Prediction {
  id: string;
  date: string;
  price: number;
  surface: string;
  bedrooms: string;
  bathrooms: string;
  city: string;
  area: string;
}

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  userName: string;
  userEmail: string;
  predictions: Prediction[];
}

export function ProfileModal({ isOpen, onClose, userName, userEmail, predictions }: ProfileModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            className="fixed inset-0 flex items-center justify-center z-50 p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden border-2 border-[#A7BCBD]"
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              transition={{ type: 'spring', damping: 25 }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="bg-gradient-to-r from-[#6BB1AD] to-[#163832] p-6 relative">
                <button
                  onClick={onClose}
                  className="absolute top-4 right-4 w-10 h-10 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center transition-colors"
                >
                  <X className="w-5 h-5 text-white" />
                </button>

                <div className="flex items-center gap-4">
                  <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center">
                    <span className="text-4xl font-bold text-[#6BB1AD]">
                      {userName.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <h2 className="text-3xl font-bold text-white mb-1">User Profile</h2>
                    <p className="text-white/80">View your information and prediction history</p>
                  </div>
                </div>
              </div>

              {/* Content */}
              <div className="p-6 overflow-y-auto max-h-[calc(90vh-180px)]">
                {/* User Information */}
                <div className="bg-[#EDECDB] rounded-2xl p-6 mb-6">
                  <h3 className="text-xl font-bold text-[#163832] mb-4 flex items-center gap-2">
                    <User className="w-5 h-5 text-[#6BB1AD]" />
                    Personal Information
                  </h3>

                  <div className="space-y-3">
                    <div className="flex items-center gap-3 bg-white p-4 rounded-xl border border-[#A7BCBD]">
                      <User className="w-5 h-5 text-[#6BB1AD]" />
                      <div>
                        <p className="text-sm text-[#6BB1AD]">Username</p>
                        <p className="font-medium text-[#163832]">{userName}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 bg-white p-4 rounded-xl border border-[#A7BCBD]">
                      <Mail className="w-5 h-5 text-[#6BB1AD]" />
                      <div>
                        <p className="text-sm text-[#6BB1AD]">Email Address</p>
                        <p className="font-medium text-[#163832]">{userEmail}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Prediction History */}
                <div>
                  <h3 className="text-xl font-bold text-[#163832] mb-4 flex items-center gap-2">
                    <History className="w-5 h-5 text-[#E6748C]" />
                    Prediction History
                    <span className="text-sm font-normal text-[#6BB1AD] ml-2">
                      ({predictions.length} {predictions.length === 1 ? 'prediction' : 'predictions'})
                    </span>
                  </h3>

                  {predictions.length === 0 ? (
                    <div className="bg-[#EDECDB] rounded-2xl p-8 text-center">
                      <div className="text-6xl mb-4">📊</div>
                      <p className="text-[#6BB1AD] font-medium">No predictions yet</p>
                      <p className="text-sm text-[#163832] mt-2">
                        Make your first property prediction to see it here!
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {predictions.map((prediction, index) => (
                        <motion.div
                          key={prediction.id}
                          className="bg-white border-2 border-[#A7BCBD] rounded-2xl p-5 hover:border-[#6BB1AD] transition-colors"
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: index * 0.1 }}
                        >
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex items-center gap-2">
                              <Calendar className="w-4 h-4 text-[#6BB1AD]" />
                              <span className="text-sm text-[#6BB1AD]">
                                {new Date(prediction.date).toLocaleDateString('fr-FR', {
                                  day: 'numeric',
                                  month: 'long',
                                  year: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 bg-gradient-to-r from-[#6BB1AD] to-[#163832] text-white px-4 py-2 rounded-xl">
                              <DollarSign className="w-4 h-4" />
                              <span className="font-bold">
                                {prediction.price.toLocaleString('fr-MA')} DH
                              </span>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-3">
                            <div className="bg-[#EDECDB] p-3 rounded-xl">
                              <p className="text-xs text-[#6BB1AD] mb-1">Surface</p>
                              <p className="font-medium text-[#163832]">{prediction.surface} m²</p>
                            </div>

                            <div className="bg-[#EDECDB] p-3 rounded-xl">
                              <p className="text-xs text-[#6BB1AD] mb-1">Rooms</p>
                              <p className="font-medium text-[#163832]">
                                {prediction.bedrooms} bed • {prediction.bathrooms} bath
                              </p>
                            </div>

                            <div className="bg-[#EDECDB] p-3 rounded-xl col-span-2">
                              <div className="flex items-center gap-2">
                                <MapPin className="w-4 h-4 text-[#6BB1AD]" />
                                <p className="font-medium text-[#163832]">
                                  {prediction.city}, {prediction.area}
                                </p>
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
