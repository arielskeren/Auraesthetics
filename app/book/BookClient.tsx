'use client';

import { motion } from 'framer-motion';
import Section from '../_components/Section';
import EmailCapture from '../_components/EmailCapture';

export default function BookClient() {
  return (
    <>
      {/* Hero */}
      <Section background="sand" className="min-h-[50vh] flex items-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center max-w-3xl mx-auto"
        >
          <h1 className="text-h1 md:text-display font-serif text-charcoal mb-6">
            Online Booking Opens Soon
          </h1>
          <p className="text-lg text-warm-gray leading-relaxed mb-8">
            We&apos;re finalizing our calendar and preparing to welcome you. Join the list below to be notified the moment booking goes live—plus receive exclusive launch‑week perks.
          </p>
          
          <div className="inline-block px-8 py-3 bg-sage/30 rounded-lg border border-sage">
            <p className="text-sm text-charcoal font-medium">
              Expected launch: TBD
            </p>
          </div>
        </motion.div>
      </Section>

      {/* Email Capture */}
      <Section background="ivory">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <EmailCapture 
            title="Be the first to book"
            description="Sign up to receive priority access when online booking opens, plus special offers for our launch week."
          />
        </motion.div>
      </Section>

      {/* What to Expect */}
      <Section background="sand">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="max-w-3xl mx-auto"
        >
          <h2 className="text-h2 font-serif text-charcoal mb-8 text-center">
            What to Expect When Booking Opens
          </h2>
          
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-lg">
              <h3 className="text-xl font-serif text-charcoal mb-3">1. Choose Your Service</h3>
              <p className="text-warm-gray">
                Browse our services and select the treatment that best fits your goals. Not sure? Start with the Signature Aura Facial.
              </p>
            </div>

            <div className="bg-white p-6 rounded-lg">
              <h3 className="text-xl font-serif text-charcoal mb-3">2. Pick Your Time</h3>
              <p className="text-warm-gray">
                View real‑time availability and select a date and time that works for your schedule.
              </p>
            </div>

            <div className="bg-white p-6 rounded-lg">
              <h3 className="text-xl font-serif text-charcoal mb-3">3. Complete Intake</h3>
              <p className="text-warm-gray">
                Fill out a brief intake form so Amy can customize your treatment and ensure your safety and comfort.
              </p>
            </div>

            <div className="bg-white p-6 rounded-lg">
              <h3 className="text-xl font-serif text-charcoal mb-3">4. Confirm & Relax</h3>
              <p className="text-warm-gray">
                Receive a confirmation with everything you need to prepare. Then show up, exhale, and let us take care of the rest.
              </p>
            </div>
          </div>
        </motion.div>
      </Section>
    </>
  );
}

