'use client';

import { motion, AnimatePresence } from 'framer-motion';

interface ConfirmationDialogProps {
  isOpen: boolean;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmText?: string;
  cancelText?: string;
}

export default function ConfirmationDialog({
  isOpen,
  message,
  onConfirm,
  onCancel,
  confirmText = 'Yes, I\'m sure',
  cancelText = 'Cancel'
}: ConfirmationDialogProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Overlay */}
          <motion.div
            className="fixed inset-0 bg-charcoal/80 backdrop-blur-sm z-[60]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onCancel}
          />

          {/* Dialog */}
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div
              className="bg-white rounded-xl max-w-sm w-full shadow-2xl relative"
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ duration: 0.2 }}
            >
              <div className="p-6">
                <h3 className="text-lg font-serif text-charcoal mb-3">Wait!</h3>
                <p className="text-sm text-warm-gray mb-6">{message}</p>
                
                <div className="flex gap-3">
                  <button
                    onClick={onCancel}
                    className="flex-1 py-2.5 px-4 border border-charcoal/20 text-charcoal rounded-lg text-sm font-medium hover:bg-sand transition-colors"
                  >
                    {cancelText}
                  </button>
                  <button
                    onClick={onConfirm}
                    className="flex-1 py-2.5 px-4 bg-sage text-charcoal rounded-lg text-sm font-semibold hover:bg-sage/80 transition-colors"
                  >
                    {confirmText}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}

