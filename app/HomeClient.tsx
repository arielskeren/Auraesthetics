'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import Image from 'next/image';
import Link from 'next/link';
import Button from './_components/Button';
import Section from './_components/Section';
import ServiceCard from './_components/ServiceCard';
import BookingModal from './_components/BookingModal';
import EmailCaptureModal from './_components/EmailCaptureModal';

export default function HomeClient() {
  const [selectedService, setSelectedService] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [featuredServices, setFeaturedServices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    const loadServices = async () => {
      try {
        const response = await fetch('/api/services');
        if (!response.ok) {
          throw new Error('Failed to load services');
        }
        const data = await response.json();
        // Map API response to match ServiceCard interface
        const mappedServices = data.map((s: any) => ({
          category: s.category || '',
          name: s.name,
          slug: s.slug,
          summary: s.summary || '',
          description: s.description || undefined,
          duration: s.duration_display || `${s.duration_minutes} min`,
          price: s.price || '',
          testPricing: s.test_pricing || false,
          image_url: s.image_url,
          featured: s.featured || false,
          best_seller: s.best_seller || false,
          most_popular: s.most_popular || false,
        }));
        // Filter starred services (up to 6)
        const starred = mappedServices.filter((s: any) => s.starred).slice(0, 6);
        setFeaturedServices(starred);
      } catch (error) {
        console.error('Error loading services:', error);
      } finally {
        setLoading(false);
      }
    };
    loadServices();
  }, []);

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
            At Aura Wellness Aesthetics, Amy blends modern technique with a calming touch to support healthy, luminous skin.
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
            <div className="aspect-square rounded-lg overflow-hidden relative shadow-lg">
              <Image
                src="/amy-photo.jpg"
                alt="Amy - Aura Wellness Aesthetics"
                fill
                className="object-cover"
                sizes="(max-width: 768px) 100vw, 50vw"
              />
            </div>
          </motion.div>

          <motion.div
          initial={{ opacity: 1, x: 0 }}
          whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <h2 className="text-h1 font-serif text-charcoal mb-6">Meet Amy</h2>
            <p className="text-warm-gray leading-relaxed mb-6">
              Amy takes a thoughtful, intuitive approach to skin care, focusing on balance, calm, and long-term skin health. Her studio blends modern aesthetics with natural warmth — soft light, earthy tones, and a sense of calm that defines every treatment.
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

      {/* Social Media Feed */}
      <Section background="ivory">
        {/* Subtle green background tint */}
        <div className="absolute inset-0 bg-gradient-to-br from-dark-sage/8 via-transparent to-sage-light/8" />
        <motion.div
          initial={{ opacity: 1, y: 0 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center"
        >
          <h2 className="text-h1 font-serif text-charcoal mb-4">Follow My Journey</h2>
          <p className="text-warm-gray max-w-2xl mx-auto mb-8">
            Stay connected on Instagram and TikTok for skincare tips, behind-the-scenes, and client transformations.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
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
      </Section>

      {/* Service Modal */}
      <BookingModal 
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

