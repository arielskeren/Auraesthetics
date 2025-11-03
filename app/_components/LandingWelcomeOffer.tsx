'use client';

import { motion } from 'framer-motion';
import EmailCapture from './EmailCapture';

interface LandingWelcomeOfferProps {
  onClose: () => void;
}

export default function LandingWelcomeOffer({ onClose }: LandingWelcomeOfferProps) {
  const handleSuccess = () => {
    // Don't close immediately - the thank you message will be shown
    // The parent component can handle navigation or other actions
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="min-h-screen flex items-center justify-center px-6 py-12 bg-gradient-to-br from-sand via-ivory to-sage-light relative"
    >
      {/* Background decorative elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-dark-sage/50 to-transparent" />
        <div className="absolute top-20 right-10 w-96 h-96 bg-dark-sage/15 rounded-full blur-3xl" />
        <div className="absolute bottom-20 left-10 w-80 h-80 bg-sage-dark/12 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-72 h-72 bg-dark-sage/10 rounded-full blur-3xl" />
      </div>

      {/* Main Content */}
      <div className="relative z-10 w-full max-w-2xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="bg-white/80 backdrop-blur-lg rounded-3xl shadow-2xl p-8 md:p-12"
        >
          <EmailCapture
            title=""
            description=""
            includeSMS={true}
            showCloseLink={false}
            onCloseLinkClick={() => {}}
            isWelcomeOffer={true}
            onSuccess={handleSuccess}
            signupSource="landing-page"
            includeAddressAndBirthday={true}
            showThankYouMessage={true}
          />
        </motion.div>
      </div>
    </motion.div>
  );
}

