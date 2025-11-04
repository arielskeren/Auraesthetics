'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import Button from './_components/Button';
import Section from './_components/Section';
import ServiceCard from './_components/ServiceCard';
import ServiceModal from './_components/ServiceModal';
import EmailCaptureModal from './_components/EmailCaptureModal';
import services from './_content/services.json';

export default function HomeClient() {
  const [selectedService, setSelectedService] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  
  const featuredServices = services.filter(s => 
    ['aura-facial', 'hydrafacial', 'brow-lamination', 'lymphatic-drainage-facial', 'dermaplaning', 'biorepeel'].includes(s.slug)
  ).slice(0, 6);

  const handleServiceClick = (service: any) => {
    setSelectedService(service);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    // Delay clearing the service to allow animation to complete
    setTimeout(() => setSelectedService(null), 300);
  };

  const handleOpenEmailModal = () => {
    setIsEmailModalOpen(true);
  };

  const handleCloseEmailModal = () => {
    setIsEmailModalOpen(false);
  };

  const pillars = [
    {
      title: 'Calm First',
      description: 'A serene, sensory experience that lowers stress for happier skin.'
    },
    {
      title: 'Skin‑Health Focused',
      description: 'Ingredient‑smart treatments tailored to your goals.'
    },
    {
      title: 'Thoughtful Craft',
      description: 'Small‑studio care, never rushed.'
    }
  ];

  return (
    <>
      {/* Hero Section */}
      <Section className="relative overflow-hidden min-h-[45vh] md:min-h-[40vh] flex items-center pt-16 md:pt-8" background="sand">
        <div className="absolute inset-0 bg-gradient-to-br from-dark-sage/15 via-sand via-dark-sage/10 to-taupe/20 opacity-60" />
        <div className="absolute top-20 right-10 w-40 h-40 bg-dark-sage/20 rounded-full blur-3xl" />
        <div className="absolute bottom-10 left-5 w-32 h-32 bg-sage-dark/15 rounded-full blur-2xl" />
        <motion.div
          className="relative z-10 text-center max-w-4xl mx-auto w-full"
          initial={{ opacity: 1, y: 0 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <h1 className="text-3xl md:text-4xl lg:text-display font-serif text-charcoal mb-4 md:mb-2 text-balance px-2">
            Skin rituals, done gently.
          </h1>
          <p className="text-base md:text-lg lg:text-xl text-warm-gray mb-5 md:mb-4 leading-relaxed max-w-2xl mx-auto px-4 md:px-0">
            At Aura Wellness Aesthetics, Amy blends modern technique with a calming, bohemian touch to support healthy, luminous skin.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Link href="/book">
              <Button variant="primary">
                Book Online
              </Button>
            </Link>
            <Button variant="secondary" onClick={handleOpenEmailModal}>
              Join the List
            </Button>
          </div>
        </motion.div>
      </Section>

      {/* Why Aura Aesthetics */}
      <Section background="ivory" className="relative">
        {/* Decorative green lines on left and right */}
        <div className="absolute left-6 top-1/4 bottom-1/4 w-0.5 bg-gradient-to-b from-dark-sage/30 via-dark-sage/50 to-dark-sage/30 hidden md:block" />
        <div className="absolute right-6 top-1/4 bottom-1/4 w-0.5 bg-gradient-to-b from-dark-sage/30 via-dark-sage/50 to-dark-sage/30 hidden md:block" />
        <motion.div
          initial={{ opacity: 1, y: 0 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-6"
        >
          <h2 className="text-h1 font-serif text-charcoal mb-2">Why aura aesthetics</h2>
          <p className="text-warm-gray max-w-2xl mx-auto">
            Three pillars that guide every treatment and moment in our studio.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12">
          {/* Calm First - Lotus Petal (1C) */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0 }}
            className="text-center"
          >
            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-dark-sage/60 to-sand mx-auto mb-6 flex items-center justify-center transition-transform duration-300 hover:scale-110 cursor-pointer">
              {/* Heart/Care icon */}
              <svg viewBox="0 0 24 24" fill="none" stroke="#9FAA9A" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-14 h-14">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
              </svg>
            </div>
            <h3 className="text-h3 font-serif text-charcoal mb-3">Calm First</h3>
            <p className="text-warm-gray leading-relaxed">A serene, sensory experience that lowers stress for happier skin.</p>
          </motion.div>

          {/* Skin-Health Focused - Harmonic Balance (2C) */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-center"
          >
            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-dark-sage/60 to-sand mx-auto mb-6 flex items-center justify-center transition-transform duration-300 hover:scale-110 cursor-pointer">
              {/* Shield with medical cross */}
              <svg viewBox="0 0 24 24" fill="none" stroke="#B7C8B1" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-14 h-14">
                <path d="M12 2L4 5v6c0 5.55 3.84 10.74 8 12 4.16-1.26 8-6.45 8-12V5l-8-3z"/>
                <line x1="12" y1="8" x2="12" y2="16" stroke="#B7C8B1" strokeWidth="3"/>
                <line x1="8" y1="12" x2="16" y2="12" stroke="#B7C8B1" strokeWidth="3"/>
              </svg>
            </div>
            <h3 className="text-h3 font-serif text-charcoal mb-3">Skin‑Health Focused</h3>
            <p className="text-warm-gray leading-relaxed">Ingredient‑smart treatments tailored to your goals.</p>
          </motion.div>

          {/* Thoughtful Craft - Knowledge Branch (3A) */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.2 }}
              className="text-center"
            >
            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-dark-sage/60 to-sand mx-auto mb-6 flex items-center justify-center transition-transform duration-300 hover:scale-110 cursor-pointer">
              {/* Open book icon - simpler and clearer */}
              <svg viewBox="0 0 24 24" fill="none" stroke="#9FAA9A" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-14 h-14">
                <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
                <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
              </svg>
            </div>
            <h3 className="text-h3 font-serif text-charcoal mb-3">Thoughtful Craft</h3>
            <p className="text-warm-gray leading-relaxed">Small‑studio care, never rushed.</p>
            </motion.div>
        </div>
      </Section>

      {/* Featured Services */}
      <Section background="sand">
        {/* Decorative green line */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-dark-sage/40 to-transparent" />
        <motion.div
          initial={{ opacity: 1, y: 0 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-6"
        >
          <h2 className="text-h1 font-serif text-charcoal mb-4">Featured Services</h2>
          <p className="text-warm-gray max-w-2xl mx-auto">
            Thoughtfully curated treatments to restore, renew, and enhance your natural glow.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {featuredServices.map((service, index) => (
            <motion.div
              key={service.slug}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className="h-full"
            >
              <div onClick={() => handleServiceClick(service)} className="cursor-pointer h-full">
                <ServiceCard {...service} />
              </div>
            </motion.div>
          ))}
        </div>

        <div className="text-center mt-12">
          <Link href="/services">
            <Button variant="secondary">
              View All Services
            </Button>
          </Link>
        </div>
      </Section>

      {/* Amy Intro Teaser */}
      <Section background="ivory">
        <div className="relative">
          {/* Decorative green bar on the left */}
          <div className="absolute left-0 top-10 bottom-10 w-1 bg-gradient-to-b from-dark-sage/40 via-sage-dark/50 to-dark-sage/40 hidden md:block" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
          <motion.div
          initial={{ opacity: 1, x: 0 }}
          whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <div className="aspect-square rounded-lg bg-gradient-to-br from-taupe/40 via-dark-sage/20 to-sand" />
          </motion.div>

          <motion.div
          initial={{ opacity: 1, x: 0 }}
          whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <h2 className="text-h1 font-serif text-charcoal mb-6">Meet Amy</h2>
            <p className="text-warm-gray leading-relaxed mb-6">
              Amy is an aesthetician with a calm, intuitive approach to skin health. Her studio blends modern modalities with grounded, bohemian design—soft light, natural textures, and unhurried care.
            </p>
            <p className="text-warm-gray leading-relaxed mb-8">
              Sessions are tailored to your skin&apos;s needs with ingredient‑mindful products and gentle technique.
            </p>
            <Link href="/about">
              <Button variant="secondary">
                Learn More About Amy
              </Button>
            </Link>
          </motion.div>
        </div>
      </Section>

      {/* Reviews Section */}
      <Section background="sand">
        {/* Decorative green accents */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-dark-sage/50 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-dark-sage/5 via-transparent to-dark-sage/5 opacity-40" />
        <motion.div
          initial={{ opacity: 1, y: 0 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-4"
        >
          <h2 className="text-h1 font-serif text-charcoal mb-4">Client Love</h2>
          <p className="text-warm-gray max-w-2xl mx-auto">
            Hear what our clients have to say about their experience at Aura Wellness Aesthetics.
          </p>
        </motion.div>

        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
            {/* Google Reviews Placeholder */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              className="bg-white p-8 rounded-lg shadow-sm text-center"
            >
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-dark-sage/60 to-taupe/30 mx-auto mb-4 flex items-center justify-center">
                <svg className="w-8 h-8 text-charcoal" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                </svg>
              </div>
              <h3 className="text-xl font-serif text-charcoal mb-2">Google Reviews</h3>
              <p className="text-warm-gray text-sm mb-4">See what clients are saying</p>
              <a 
                href="#" 
                className="text-dark-sage hover:text-charcoal transition-colors text-sm font-medium"
              >
                Coming Soon
              </a>
            </motion.div>

            {/* Yelp Reviews Placeholder */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="bg-white p-8 rounded-lg shadow-sm text-center"
            >
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-taupe/40 to-dark-sage/50 mx-auto mb-4 flex items-center justify-center">
                <svg className="w-8 h-8 text-charcoal" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/>
                </svg>
              </div>
              <h3 className="text-xl font-serif text-charcoal mb-2">Yelp Reviews</h3>
              <p className="text-warm-gray text-sm mb-4">Read client experiences</p>
              <a 
                href="#" 
                className="text-dark-sage hover:text-charcoal transition-colors text-sm font-medium"
              >
                Coming Soon
              </a>
            </motion.div>
          </div>

          <motion.p
          initial={{ opacity: 1 }}
          whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="text-center text-warm-gray text-sm"
          >
            Reviews will be available after our official launch. Join the list to be among our first clients!
          </motion.p>
        </div>
      </Section>

      {/* Social Media Feed */}
      <Section background="ivory">
        {/* Subtle green background tint */}
        <div className="absolute inset-0 bg-gradient-to-br from-dark-sage/8 via-transparent to-sage-light/8" />
        <motion.div
          initial={{ opacity: 1, y: 0 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-4"
        >
          <h2 className="text-h1 font-serif text-charcoal mb-4">Follow Our Journey</h2>
          <p className="text-warm-gray max-w-2xl mx-auto mb-6">
            Stay connected on Instagram and TikTok for skincare tips, behind-the-scenes, and client transformations.
          </p>
          <div className="flex justify-center gap-4">
            <a 
              href="https://instagram.com/wellnessesthetics_" 
              target="_blank"
              rel="noopener noreferrer"
              className="px-6 py-2 bg-dark-sage text-charcoal rounded hover:bg-sage-dark hover:shadow-lg transition-all duration-200"
            >
              @wellnessesthetics_ on Instagram
            </a>
            <a 
              href="https://tiktok.com/@wellnessaesthetics_" 
              target="_blank"
              rel="noopener noreferrer"
              className="px-6 py-2 bg-white border-2 border-dark-sage text-dark-sage rounded hover:bg-sage-light hover:shadow-md transition-all duration-200"
            >
              @wellnessaesthetics_ on TikTok
            </a>
          </div>
        </motion.div>

        {/* Instagram Feed Placeholder */}
        <motion.div
          initial={{ opacity: 1, y: 0 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="max-w-6xl mx-auto"
        >
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((item, index) => (
              <motion.div
                key={item}
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.3, delay: index * 0.05 }}
                className="aspect-square rounded-lg bg-gradient-to-br from-sand via-taupe/20 to-dark-sage/40 flex items-center justify-center group cursor-pointer hover:shadow-lg transition-shadow"
              >
                <svg 
                  className="w-12 h-12 text-warm-gray/40 group-hover:text-dark-sage transition-colors" 
                  fill="none" 
                  viewBox="0 0 24 24" 
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </motion.div>
            ))}
          </div>
          <p className="text-center text-warm-gray text-sm mt-8">
            Instagram feed coming soon! Follow us{' '}
            <a 
              href="https://instagram.com/wellnessesthetics_"
              target="_blank"
              rel="noopener noreferrer"
              className="text-dark-sage hover:underline font-medium"
            >
              @wellnessesthetics_
            </a>
            {' '}to see treatment highlights, skincare education, and studio vibes.
          </p>
        </motion.div>
      </Section>

      {/* Service Modal */}
      <ServiceModal 
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        service={selectedService}
      />

      {/* Email Capture Modal */}
      <EmailCaptureModal 
        isOpen={isEmailModalOpen}
        onClose={handleCloseEmailModal}
        isWelcomeOffer={false}
        showCloseButton={true}
        signupSource="home-hero"
      />
    </>
  );
}

