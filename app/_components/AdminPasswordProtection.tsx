'use client';

import { useState, useEffect } from 'react';
import { Lock, Unlock } from 'lucide-react';

interface AdminPasswordProtectionProps {
  children: React.ReactNode;
}

const ADMIN_PASSWORD = 'Bamba24!';
const STORAGE_KEY = 'admin_authenticated';

export default function AdminPasswordProtection({ children }: AdminPasswordProtectionProps) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check if already authenticated in this session
    const authenticated = sessionStorage.getItem(STORAGE_KEY) === 'true';
    setIsAuthenticated(authenticated);
    setIsLoading(false);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password === ADMIN_PASSWORD) {
      sessionStorage.setItem(STORAGE_KEY, 'true');
      setIsAuthenticated(true);
      setPassword('');
    } else {
      setError('Incorrect password. Please try again.');
      setPassword('');
    }
  };

  const handleBypass = () => {
    sessionStorage.setItem(STORAGE_KEY, 'true');
    setIsAuthenticated(true);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-sand/20 flex items-center justify-center">
        <div className="text-warm-gray">Loading...</div>
      </div>
    );
  }

  if (isAuthenticated) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-sand/20 flex items-center justify-center p-6">
      <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full">
        <div className="text-center mb-6">
          <Lock className="w-12 h-12 text-dark-sage mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-charcoal mb-2">Admin Access Required</h1>
          <p className="text-warm-gray text-sm">Please enter the password to continue</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-charcoal mb-2">
              Password
            </label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setError('');
              }}
              className="w-full px-4 py-2 border border-sand rounded-lg focus:outline-none focus:ring-2 focus:ring-dark-sage"
              placeholder="Enter password"
              autoFocus
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <button
              type="submit"
              className="w-full px-4 py-2 bg-dark-sage text-charcoal rounded-lg hover:bg-dark-sage/80 transition-colors font-medium"
            >
              <Unlock className="w-4 h-4 inline-block mr-2" />
              Unlock
            </button>
            
            <button
              type="button"
              onClick={handleBypass}
              className="w-full px-4 py-2 border border-sand text-warm-gray rounded-lg hover:bg-sand/20 transition-colors text-sm"
            >
              Bypass Password (Testing Only)
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

