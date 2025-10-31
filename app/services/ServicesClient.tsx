'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import Section from '../_components/Section';
import ServiceCard from '../_components/ServiceCard';
import services from '../_content/services.json';

export default function ServicesClient() {
  const [activeCategory, setActiveCategory] = useState('All');
  
  const categories = ['All', 'Facials', 'Advanced', 'Brows & Lashes', 'Waxing'];
  
  const filteredServices = activeCategory === 'All' 
    ? services 
    : services.filter(s => s.category === activeCategory);

  return (
    <>
      {/* Hero */}
      <Section background="sand">
        {/* Decorative green line */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-dark-sage/40 to-transparent" />
        <motion.div
          initial={{ opacity: 1, y: 0 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center max-w-3xl mx-auto pt-16 md:pt-0"
        >
          <h1 className="text-h1 md:text-display font-serif text-charcoal mb-4">
            Services
          </h1>
          <p className="text-lg text-warm-gray leading-relaxed">
            Thoughtfully curated treatments that honor your skin&apos;s unique needs and your personal goals.
          </p>
        </motion.div>
      </Section>

      {/* Category Filter */}
      <Section background="ivory" className="!py-8 relative">
        {/* Subtle green background */}
        <div className="absolute inset-0 bg-gradient-to-b from-dark-sage/6 to-transparent" />
        <div className="flex flex-wrap justify-center gap-3 relative z-10">
          {categories.map((category) => (
            <button
              key={category}
              onClick={() => setActiveCategory(category)}
              className={`px-6 py-2 rounded-full text-sm font-medium transition-all duration-200 min-h-[44px] ${
                activeCategory === category
                  ? 'bg-charcoal text-ivory'
                  : 'bg-white text-warm-gray hover:bg-dark-sage/20 hover:text-charcoal'
              }`}
            >
              {category}
            </button>
          ))}
        </div>
      </Section>

      {/* Services Grid */}
      <Section background="ivory" className="!pt-8">
        <motion.div
          key={activeCategory}
          initial={{ opacity: 1 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8"
        >
          {filteredServices.map((service, index) => (
            <motion.div
              key={service.slug}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: index * 0.05 }}
            >
              <ServiceCard {...service} />
            </motion.div>
          ))}
        </motion.div>
      </Section>

      {/* Pre/Post Care */}
      <Section background="sand" className="relative">
        {/* Decorative elements */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-dark-sage/50 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-l from-dark-sage/8 via-transparent to-dark-sage/8 opacity-40" />
        <div className="max-w-4xl mx-auto relative z-10">
          <motion.div
          initial={{ opacity: 1, y: 0 }}
          whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <h2 className="text-h2 font-serif text-charcoal mb-6 text-center">
              Pre‑ & Post‑Care Guidelines
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="bg-white p-8 rounded-lg">
                <h3 className="text-h3 font-serif text-charcoal mb-4">Before Your Service</h3>
                <ul className="space-y-3 text-warm-gray">
                  <li className="flex items-start">
                    <span className="mr-2">•</span>
                    <span>Avoid retinoids, exfoliants, or acids 48–72 hours prior</span>
                  </li>
                  <li className="flex items-start">
                    <span className="mr-2">•</span>
                    <span>Minimize sun exposure and tanning</span>
                  </li>
                  <li className="flex items-start">
                    <span className="mr-2">•</span>
                    <span>Arrive with clean, makeup‑free skin when possible</span>
                  </li>
                  <li className="flex items-start">
                    <span className="mr-2">•</span>
                    <span>Communicate any new medications or skin concerns</span>
                  </li>
                </ul>
              </div>

              <div className="bg-white p-8 rounded-lg">
                <h3 className="text-h3 font-serif text-charcoal mb-4">After Your Service</h3>
                <ul className="space-y-3 text-warm-gray">
                  <li className="flex items-start">
                    <span className="mr-2">•</span>
                    <span>Wear SPF daily (non‑negotiable!)</span>
                  </li>
                  <li className="flex items-start">
                    <span className="mr-2">•</span>
                    <span>Skip heat, intense workouts, and actives for 24–48 hours</span>
                  </li>
                  <li className="flex items-start">
                    <span className="mr-2">•</span>
                    <span>Keep skin hydrated and avoid picking</span>
                  </li>
                  <li className="flex items-start">
                    <span className="mr-2">•</span>
                    <span>Follow any customized aftercare instructions provided</span>
                  </li>
                </ul>
              </div>
            </div>

            <div className="mt-8 p-6 bg-dark-sage/40 rounded-lg border-l-4 border-dark-sage">
              <h4 className="text-lg font-serif text-charcoal mb-3">Contraindications</h4>
              <p className="text-sm text-warm-gray leading-relaxed">
                Some services are not appropriate during pregnancy, while using isotretinoin (Accutane), 
                or with active infections, open lesions, or medical devices (pacemakers, etc.). Please share 
                your full health history during intake so Amy can recommend the safest, most effective options 
                for you.
              </p>
            </div>
          </motion.div>
        </div>
      </Section>
    </>
  );
}

