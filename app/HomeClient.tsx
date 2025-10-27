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
    ['signature-aura-facial', 'hydrafacial', 'brow-lamination', 'lymphatic-drainage', 'buccal-massage', 'dermaplaning'].includes(s.slug)
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
      <Section className="relative overflow-hidden min-h-[40vh] flex items-center" background="sand">
        <div className="absolute inset-0 bg-gradient-to-br from-sand via-ivory to-taupe/20 opacity-60" />
        <motion.div
          className="relative z-10 text-center max-w-4xl mx-auto"
          initial={{ opacity: 1, y: 0 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <h1 className="text-4xl md:text-display font-serif text-charcoal mb-2 text-balance">
            Skin rituals, done gently.
          </h1>
          <p className="text-lg md:text-xl text-warm-gray mb-4 leading-relaxed max-w-2xl mx-auto">
            At Aura Wellness Aesthetics, Amy blends modern technique with a calming, bohemian touch to support healthy, luminous skin.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Link href="/book">
              <Button variant="disabled" tooltip="Booking opens soon">
                Book Online — Coming Soon
              </Button>
            </Link>
            <Button variant="secondary" onClick={handleOpenEmailModal}>
              Join the List
            </Button>
          </div>
        </motion.div>
      </Section>

      {/* Why Aura Aesthetics */}
      <Section background="ivory">
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
          {pillars.map((pillar, index) => (
            <motion.div
              key={pillar.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className="text-center"
            >
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-sage/40 to-sand mx-auto mb-6" />
              <h3 className="text-h3 font-serif text-charcoal mb-3">{pillar.title}</h3>
              <p className="text-warm-gray leading-relaxed">{pillar.description}</p>
            </motion.div>
          ))}
        </div>
      </Section>

      {/* Featured Services */}
      <Section background="sand">
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
          <motion.div
          initial={{ opacity: 1, x: 0 }}
          whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <div className="aspect-square rounded-lg bg-gradient-to-br from-taupe/40 via-sand to-ivory" />
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
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-sage/40 to-taupe/30 mx-auto mb-4 flex items-center justify-center">
                <svg className="w-8 h-8 text-charcoal" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                </svg>
              </div>
              <h3 className="text-xl font-serif text-charcoal mb-2">Google Reviews</h3>
              <p className="text-warm-gray text-sm mb-4">See what clients are saying</p>
              <a 
                href="#" 
                className="text-sage hover:text-charcoal transition-colors text-sm font-medium"
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
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-taupe/40 to-sage/30 mx-auto mb-4 flex items-center justify-center">
                <svg className="w-8 h-8 text-charcoal" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/>
                </svg>
              </div>
              <h3 className="text-xl font-serif text-charcoal mb-2">Yelp Reviews</h3>
              <p className="text-warm-gray text-sm mb-4">Read client experiences</p>
              <a 
                href="#" 
                className="text-sage hover:text-charcoal transition-colors text-sm font-medium"
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
              href="https://instagram.com/auraesthetics" 
              target="_blank"
              rel="noopener noreferrer"
              className="px-6 py-2 bg-charcoal text-ivory rounded hover:bg-sage hover:text-charcoal transition-colors"
            >
              @auraesthetics on Instagram
            </a>
            <a 
              href="https://tiktok.com/@auraesthetics" 
              target="_blank"
              rel="noopener noreferrer"
              className="px-6 py-2 border-2 border-warm-gray text-warm-gray rounded hover:border-charcoal hover:text-charcoal transition-colors"
            >
              @auraesthetics on TikTok
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
          initial={{ opacity: 1, scale: 1 }}
          whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.3, delay: index * 0.05 }}
                className="aspect-square rounded-lg bg-gradient-to-br from-sand via-taupe/20 to-sage/20 flex items-center justify-center group cursor-pointer hover:shadow-lg transition-shadow"
              >
                <svg 
                  className="w-12 h-12 text-warm-gray/40 group-hover:text-sage transition-colors" 
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
            Instagram feed coming soon! Follow us to see treatment highlights, skincare education, and studio vibes.
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
      />
    </>
  );
}

