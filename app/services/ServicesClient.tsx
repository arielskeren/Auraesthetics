'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import Section from '../_components/Section';
import ServiceCard from '../_components/ServiceCard';
import BookingModal from '../_components/BookingModal';

interface Service {
  category: string;
  name: string;
  slug: string;
  summary: string;
  description?: string;
  duration: string;
  price: string;
  testPricing?: boolean;
  image_url?: string | null;
}

export default function ServicesClient() {
  const [activeCategory, setActiveCategory] = useState('All');
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  
  const categories = ['All', 'Facials', 'Advanced', 'Brows & Lashes', 'Waxing'];
  
  useEffect(() => {
    const loadServices = async () => {
      try {
        const response = await fetch('/api/services');
        if (!response.ok) {
          throw new Error('Failed to load services');
        }
        const data = await response.json();
        // Map API response to match ServiceCard interface
        const mappedServices: Service[] = data.map((s: any) => ({
          category: (s.category || '') as string,
          name: s.name,
          slug: s.slug,
          summary: (s.summary || '') as string,
          description: s.description || undefined,
          duration: s.duration_display || `${s.duration_minutes} min`,
          price: (s.price || '') as string,
          testPricing: s.test_pricing || false,
          image_url: s.image_url,
        }));
        setServices(mappedServices);
      } catch (error) {
        console.error('Error loading services:', error);
      } finally {
        setLoading(false);
      }
    };
    loadServices();
  }, []);
  
  const filteredServices = activeCategory === 'All' 
    ? services 
    : services.filter(s => s.category === activeCategory);

  const handleServiceClick = (service: Service) => {
    setSelectedService(service);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setTimeout(() => setSelectedService(null), 300);
  };

  return (
    <>
      {/* Hero */}
      <Section background="sand" className="relative !py-12 md:!py-20">
        {/* Decorative green line */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-dark-sage/40 to-transparent" />
        <motion.div
          initial={{ opacity: 1, y: 0 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center max-w-3xl mx-auto pt-8 md:pt-2"
        >
          <h1 className="text-h1 md:text-display font-serif text-charcoal mb-3 md:mb-4">
            Services
          </h1>
          <p className="text-base md:text-lg text-warm-gray leading-relaxed">
            Thoughtfully curated treatments that honor your skin&apos;s unique needs and your personal goals.
          </p>
        </motion.div>
      </Section>

      {/* Pre/Post Care Banner */}
      <Section background="sand" className="relative !py-10">
        <div className="absolute inset-0 bg-gradient-to-r from-dark-sage/10 via-transparent to-dark-sage/10 opacity-50" />
        <div className="max-w-5xl mx-auto relative z-10">
          <div className="rounded-2xl border border-dark-sage/30 bg-white/80 backdrop-blur-sm shadow-sm">
            <div className="flex flex-col gap-6 p-6 md:flex-row md:items-start md:gap-8 md:p-8">
              <div className="flex-1">
                <h2 className="text-h4 font-serif text-charcoal mb-4">Before Your Service</h2>
                <ul className="space-y-2 text-sm text-warm-gray">
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

              <div className="flex-1">
                <h2 className="text-h4 font-serif text-charcoal mb-4">After Your Service</h2>
                <ul className="space-y-2 text-sm text-warm-gray">
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

              <div className="rounded-xl bg-dark-sage/20 p-5 md:max-w-xs md:self-stretch">
                <h3 className="text-base font-serif text-charcoal mb-3">Contraindications</h3>
                <p className="text-sm text-warm-gray leading-relaxed">
                  Some services are not appropriate during pregnancy, while using isotretinoin (Accutane), or with
                  active infections, open lesions, or medical devices (pacemakers, etc.). Share your full health history
                  during intake so Amy can recommend the safest, most effective options for you.
                </p>
              </div>
            </div>
          </div>
        </div>
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
        {loading ? (
          <div className="text-center py-12 text-warm-gray">Loading services...</div>
        ) : (
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
              className="h-full"
            >
              <div 
                onClick={() => handleServiceClick(service as Service)}
                className="cursor-pointer h-full"
              >
                <ServiceCard {...service} />
              </div>
            </motion.div>
          ))}
          </motion.div>
        )}
      </Section>

      {/* Booking Modal */}
      <BookingModal 
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        service={selectedService}
      />
    </>
  );
}

