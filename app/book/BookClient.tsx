'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import Section from '../_components/Section';
import BookingModal from '../_components/BookingModal';
import { getServicePhotoPaths } from '../_utils/servicePhotos';

interface Service {
  category: string;
  name: string;
  slug: string;
  summary: string;
  description?: string;
  duration: string;
  price: string;
  calEventId?: number | null;
  calBookingUrl?: string | null;
  testPricing?: boolean;
}

export default function BookClient() {
  const [activeCategory, setActiveCategory] = useState('All');
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Import services dynamically - this will work at build time
  const [services, setServices] = useState<Service[]>([]);

  // Load services on mount
  useEffect(() => {
    import('../_content/services.json').then((module) => {
      setServices(module.default);
    });
  }, []);

  const categories = ['All', 'Facials', 'Advanced', 'Brows & Lashes', 'Waxing'];
  
  const filteredServices = activeCategory === 'All' 
    ? services 
    : services.filter(s => s.category === activeCategory);

  const handleBookingClick = (service: Service) => {
    setSelectedService(service);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setTimeout(() => setSelectedService(null), 300);
  };

  const steps = [
    {
      title: 'Choose Your Service',
      description: 'Browse the menu and tap “Book Now” for the treatment that fits your goals.',
    },
    {
      title: 'Select Your Time',
      description: 'Pick a date and time from Amy’s live calendar—availability updates in real time.',
    },
    {
      title: 'Complete Intake Form',
      description: 'Share your skin goals, preferences, and allergies so Amy can tailor the visit.',
    },
    {
      title: 'Confirm & Arrive',
      description: 'Receive a confirmation email with everything you need. Arrive on time and relax.',
    },
  ];

  return (
    <>
      {/* Hero */}
      <Section background="sand" className="relative !py-7 md:!py-12">
        {/* Decorative green line */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-dark-sage/40 to-transparent" />
        {/* Background accents */}
        <div className="absolute inset-0 bg-gradient-to-br from-dark-sage/10 via-transparent to-sage-dark/8" />
        
        <motion.div
          initial={{ opacity: 1, y: 0 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center max-w-3xl mx-auto pt-5 md:pt-2 relative z-10"
        >
          <h1 className="text-h1 md:text-display font-serif text-charcoal mb-3">
            Book Your Treatment
          </h1>
          <p className="text-base md:text-lg text-warm-gray leading-relaxed mb-4 md:mb-5">
            Choose your service below and you&apos;ll be redirected to our secure booking system to select your time and complete your appointment.
          </p>
        </motion.div>
      </Section>

      {/* How It Works */}
      <Section background="ivory" className="relative !py-10">
        <div className="absolute inset-0 bg-gradient-to-b from-dark-sage/10 via-transparent to-transparent" />
        <motion.div
          initial={{ opacity: 1, y: 0 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="max-w-4xl mx-auto text-center relative z-10"
        >
          <h2 className="text-h3 md:text-h2 font-serif text-charcoal mb-3">How It Works</h2>
          <p className="text-sm md:text-base text-warm-gray leading-relaxed mb-6 md:mb-8">
            Booking is simple. Follow the steps below and we&apos;ll have everything ready for your visit.
          </p>

          <div className="relative pt-2">
            <div className="hidden md:block absolute top-6 left-1/2 w-full -translate-x-1/2 h-px bg-dark-sage/20" />
            <ol className="grid gap-5 md:gap-6 md:grid-cols-4">
            {steps.map((step, index) => (
              <motion.li
                key={step.title}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.3, delay: index * 0.05 }}
                className="flex items-start gap-4 md:flex-col md:items-center md:text-center"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-dark-sage text-charcoal font-semibold text-sm shadow-sm md:mb-2">
                  {index + 1}
                </span>
                <div className="md:max-w-[14rem]">
                  <h3 className="text-base font-serif text-charcoal">{step.title}</h3>
                  <p className="mt-2 text-xs md:text-sm text-warm-gray leading-relaxed">
                    {step.description}
                  </p>
                </div>
              </motion.li>
            ))}
            </ol>
          </div>
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
                  ? 'bg-dark-sage text-charcoal'
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
        {services.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-warm-gray">Loading services...</p>
          </div>
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
                  onClick={() => handleBookingClick(service)}
                  className="h-full bg-white rounded-lg overflow-hidden shadow-sm group-hover:shadow-lg transition-shadow duration-200 cursor-pointer flex flex-col"
                >
                  {/* Service image or gradient placeholder */}
                  {service.slug ? (
                    <div className="h-48 flex-shrink-0 bg-gray-200 relative">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img 
                        src={getServicePhotoPaths(service.slug)[0]} 
                        alt={service.name}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          // Fallback to gradient if image doesn't exist
                          const target = e.target as HTMLImageElement;
                          const photoPaths = getServicePhotoPaths(service.slug);
                          const currentSrc = target.src;
                          const currentIndex = photoPaths.findIndex(path => currentSrc.includes(path.split('/').pop() || ''));
                          
                          if (currentIndex < photoPaths.length - 1) {
                            // Try next fallback path
                            target.src = photoPaths[currentIndex + 1];
                          } else {
                            // No more fallbacks, show gradient
                            target.style.display = 'none';
                            if (target.parentElement) {
                              target.parentElement.className = 'h-48 flex-shrink-0 bg-gradient-to-br from-dark-sage/60 via-taupe/40 to-sand';
                            }
                          }
                        }}
                      />
                    </div>
                  ) : (
                    <div className="h-48 flex-shrink-0 bg-gradient-to-br from-dark-sage/60 via-taupe/40 to-sand" />
                  )}
                  
                  {/* Content - consistent structure */}
                  <div className="p-6 flex flex-col h-full">
                    <h3 className="text-h3 text-charcoal mb-3 flex-shrink-0">{service.name}</h3>
                    <p className="text-warm-gray text-sm leading-relaxed mb-5 min-h-[3rem] flex-grow">{service.summary}</p>
                    
                    <div className="flex justify-between items-center text-sm text-warm-gray mb-4 pt-4 border-t border-sand flex-shrink-0">
                      <span>{service.duration}</span>
                      <span className="font-medium">{service.price}</span>
                    </div>
                    
                    {/* Book Now CTA - Always at bottom */}
                    <button className="w-full bg-dark-sage text-charcoal py-2.5 rounded-lg text-sm font-semibold hover:bg-sage-dark hover:shadow-lg transition-all duration-200 flex-shrink-0">
                      Book Now
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
        </motion.div>
        )}

        {filteredServices.length === 0 && (
          <div className="text-center py-12">
            <p className="text-warm-gray">No services found in this category.</p>
          </div>
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
