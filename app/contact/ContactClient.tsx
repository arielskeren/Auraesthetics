'use client';

import { motion } from 'framer-motion';
import Section from '../_components/Section';
import EmailCapture from '../_components/EmailCapture';

export default function ContactClient() {
  return (
    <>
      {/* Hero */}
      <Section background="sand" className="relative">
        {/* Green decorative elements */}
        <div className="absolute inset-0 bg-gradient-to-br from-dark-sage/10 via-transparent to-sage-dark/8" />
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-dark-sage/50 to-transparent" />
        <motion.div
          initial={{ opacity: 1, y: 0 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center max-w-3xl mx-auto pt-16 md:pt-0"
        >
          <h1 className="text-h1 md:text-display font-serif text-charcoal mb-6">
            Get in Touch
          </h1>
          <p className="text-lg text-warm-gray leading-relaxed">
            We&apos;ll share full contact details at launch. For now, join the list to stay connected.
          </p>
        </motion.div>
      </Section>

      {/* Contact Cards */}
      <Section background="ivory">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="bg-white p-8 rounded-lg"
          >
            <h2 className="text-h3 font-serif text-charcoal mb-4">Studio Location</h2>
            <div className="space-y-3 text-warm-gray">
              <p>
                <span className="font-medium text-charcoal">Address:</span> Fort Lauderdale, FL
              </p>
              <p className="text-xs">Servicing all of South Florida</p>
              <p>
                <span className="font-medium text-charcoal">Parking:</span> Available on-site
              </p>
              <p className="text-sm italic pt-2">
                Exact address will be provided upon booking confirmation.
              </p>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="bg-white p-8 rounded-lg"
          >
            <h2 className="text-h3 font-serif text-charcoal mb-4">Hours & Contact</h2>
            <div className="space-y-3 text-warm-gray">
              <p>
                <span className="font-medium text-charcoal">Hours:</span> By appointment only
              </p>
              <p className="text-xs">Check scheduler for availability</p>
              <p>
                <span className="font-medium text-charcoal">Email:</span> hello@auraesthetics.com
              </p>
              <p>
                <span className="font-medium text-charcoal">Phone:</span> Coming soon
              </p>
              <p className="text-sm italic pt-2">
                Phone number will be available at launch.
              </p>
            </div>
          </motion.div>
        </div>
      </Section>

      {/* Map Placeholder */}
      <Section background="sand" className="relative">
        {/* Background accents */}
        <div className="absolute inset-0 bg-gradient-to-r from-dark-sage/8 via-transparent to-sage-dark/8" />
        <motion.div
          initial={{ opacity: 1, y: 0 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="max-w-4xl mx-auto"
        >
          <h2 className="text-h2 font-serif text-charcoal mb-8 text-center">
            Find Us
          </h2>
          
          <div className="aspect-video rounded-lg bg-gradient-to-br from-sand via-dark-sage/20 to-taupe/30 flex items-center justify-center">
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-white/60 mx-auto mb-4 flex items-center justify-center">
                <svg className="w-8 h-8 text-warm-gray" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <p className="text-warm-gray">Map available at launch</p>
            </div>
          </div>
        </motion.div>
      </Section>

      {/* Email Capture */}
      <Section background="ivory">
        <motion.div
          initial={{ opacity: 1, y: 0 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <EmailCapture 
            title="Stay Connected"
            description="Join our list to receive updates about our launch, including studio location, hours, and how to reach us."
          />
        </motion.div>
      </Section>
    </>
  );
}

