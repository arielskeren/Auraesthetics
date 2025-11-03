'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import Image from 'next/image';
import LandingWelcomeOffer from '../_components/LandingWelcomeOffer';
import AdminSignIn from '../_components/AdminSignIn';

export default function LandingClient() {
  const [showWelcomeOffer, setShowWelcomeOffer] = useState(true);

  return (
    <div className="min-h-screen bg-gradient-to-br from-sand via-ivory to-sage-light relative overflow-hidden">
      {/* Background decorative elements */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-dark-sage/50 to-transparent" />
      <div className="absolute top-20 right-10 w-64 h-64 bg-dark-sage/20 rounded-full blur-3xl" />
      <div className="absolute bottom-20 left-10 w-48 h-48 bg-sage-dark/15 rounded-full blur-3xl" />
      
      {/* Admin Sign In Button - Top Right */}
      <div className="absolute top-6 right-6 z-50">
        <AdminSignIn />
      </div>

      {/* Main Content */}
      <div className="relative z-10 min-h-screen flex flex-col">
        {showWelcomeOffer ? (
          <LandingWelcomeOffer onClose={() => setShowWelcomeOffer(false)} />
        ) : (
          <>
            {/* Hero Section with About Info */}
            <section className="flex-1 flex items-center justify-center px-6 py-20">
              <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
                {/* Left: Image */}
                <motion.div
                  initial={{ opacity: 0, x: -30 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.6 }}
                  className="order-2 md:order-1"
                >
                  <div className="aspect-[3/4] rounded-lg overflow-hidden relative shadow-xl">
                    <Image
                      src="/amy-photo.jpg"
                      alt="Amy - Aura Wellness Aesthetics"
                      fill
                      className="object-cover"
                      sizes="(max-width: 768px) 100vw, 50vw"
                      priority
                    />
                  </div>
                </motion.div>

                {/* Right: About Content */}
                <motion.div
                  initial={{ opacity: 0, x: 30 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.6, delay: 0.2 }}
                  className="order-1 md:order-2"
                >
                  <h1 className="text-4xl md:text-5xl font-serif text-charcoal mb-6">
                    Welcome to Aura Wellness Aesthetics
                  </h1>
                  <div className="space-y-4 text-warm-gray leading-relaxed mb-6">
                    <p className="text-lg">
                      An aesthetician who believes in calm, customized care and the beauty of slowing down.
                    </p>
                    <p>
                      Amy is an aesthetician with a calm, intuitive approach to skin health. Her studio blends modern modalities with grounded, bohemian design—soft light, natural textures, and unhurried care.
                    </p>
                    <p>
                      Sessions are tailored to your skin&apos;s needs with ingredient‑mindful products and gentle technique. She believes that healthy skin begins with understanding what your skin actually needs, not what trends dictate.
                    </p>
                  </div>

                  <div className="mt-8 p-6 bg-white/60 backdrop-blur-sm rounded-lg shadow-md">
                    <h3 className="text-lg font-serif text-charcoal mb-3">Philosophy</h3>
                    <p className="text-sm text-warm-gray leading-relaxed">
                      Rooted in skin health, guided by intuition, and delivered with care. 
                      You won&apos;t be rushed. You won&apos;t be upsold. You&apos;ll receive honest guidance, 
                      skilled hands, and a space designed to help you exhale.
                    </p>
                  </div>
                </motion.div>
              </div>
            </section>

            {/* Values Section */}
            <section className="px-6 py-16 bg-white/30 backdrop-blur-sm">
              <div className="max-w-5xl mx-auto">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.6 }}
                  className="text-center mb-12"
                >
                  <h2 className="text-3xl md:text-4xl font-serif text-charcoal mb-4">
                    Care, Calm, Craft
                  </h2>
                  <p className="text-warm-gray max-w-2xl mx-auto leading-relaxed">
                    These three words anchor everything at Aura Wellness Aesthetics.
                  </p>
                </motion.div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                  {[
                    {
                      title: 'Gentle by design',
                      description: 'Barrier‑supportive, mindful touch that respects your skin\'s natural rhythm and resilience.'
                    },
                    {
                      title: 'Customization',
                      description: 'Each service adapts to your current skin state, not a one‑size‑fits‑all protocol.'
                    },
                    {
                      title: 'Education',
                      description: 'Clear guidance for home care that fits your life, budget, and goals.'
                    }
                  ].map((value, index) => (
                    <motion.div
                      key={value.title}
                      initial={{ opacity: 0, y: 20 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.5, delay: index * 0.1 }}
                      className="bg-white/60 backdrop-blur-sm p-6 rounded-lg shadow-md"
                    >
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-dark-sage to-dark-sage/60 mb-4" />
                      <h3 className="text-xl font-serif text-charcoal mb-3">{value.title}</h3>
                      <p className="text-warm-gray leading-relaxed text-sm">{value.description}</p>
                    </motion.div>
                  ))}
                </div>
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}

