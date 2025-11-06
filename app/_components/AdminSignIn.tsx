'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Lock } from 'lucide-react';
import Button from './Button';

export default function AdminSignIn() {
  const [isOpen, setIsOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Check if already authenticated
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const auth = localStorage.getItem('auraAdminAuth');
      if (auth === 'authenticated') {
        setIsAuthenticated(true);
      }
    }
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // For now, using a simple password. In production, this should be more secure
    const correctPassword = process.env.NEXT_PUBLIC_ADMIN_PASSWORD || 'aura2024';

    if (password === correctPassword) {
      localStorage.setItem('auraAdminAuth', 'authenticated');
      // Set cookie for server-side middleware
      document.cookie = 'auraAdminAuth=authenticated; path=/; max-age=86400'; // 24 hours
      setIsAuthenticated(true);
      setIsOpen(false);
      setPassword('');
      // Redirect to home page
      window.location.href = '/';
    } else {
      setError('Incorrect password. Please try again.');
      setPassword('');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('auraAdminAuth');
    // Remove cookie
    document.cookie = 'auraAdminAuth=; path=/; max-age=0';
    setIsAuthenticated(false);
    window.location.href = '/';
  };

  if (isAuthenticated) {
    return (
      <Button
        variant="secondary"
        onClick={handleLogout}
        className="text-sm px-4 py-2"
      >
        Admin
      </Button>
    );
  }

  return (
    <>
      <Button
        variant="secondary"
        onClick={() => setIsOpen(true)}
        className="text-sm px-4 py-2 flex items-center gap-2"
      >
        <Lock size={16} />
        Admin Sign In
      </Button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-charcoal/80 backdrop-blur-sm z-50 flex items-center justify-center p-6"
            onClick={() => setIsOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="text-center mb-6">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-dark-sage/20 rounded-full mb-4">
                  <Lock size={32} className="text-dark-sage" />
                </div>
                <h2 className="text-2xl font-serif text-charcoal mb-2">Admin Sign In</h2>
                <p className="text-sm text-warm-gray">Enter password to access the site</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label htmlFor="password" className="sr-only">Password</label>
                  <input
                    type="password"
                    id="password"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      setError('');
                    }}
                    className={`w-full px-4 py-3 text-sm border ${error ? 'border-red-400' : 'border-charcoal/20'} rounded-lg focus:outline-none focus:ring-2 focus:ring-dark-sage transition-all`}
                    placeholder="Enter admin password"
                    autoFocus
                  />
                  {error && (
                    <p className="text-red-600 text-xs mt-2">{error}</p>
                  )}
                </div>

                <Button
                  variant="primary"
                  type="submit"
                  className="w-full"
                >
                  Sign In
                </Button>
              </form>

              <button
                onClick={() => setIsOpen(false)}
                className="mt-4 w-full text-sm text-warm-gray hover:text-charcoal transition-colors"
                type="button"
              >
                Cancel
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

