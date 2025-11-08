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
      description:
        'Browse our services and click "Book Now" on your preferred treatment. You\'ll be taken to our secure Cal.com booking page.',
    },
    {
      title: 'Select Your Time',
      description:
        "View real-time availability and choose a date and time that works for your schedule. Times are synced with Amy's calendar.",
    },
    {
      title: 'Complete Intake Form',
      description:
        'Fill out a brief intake form with your skin concerns, goals, and any allergies. This helps Amy customize your treatment.',
    },
    {
      title: 'Confirm & Arrive',
      description:
        'Receive confirmation with all the details you need. Then just show up on time and let us take care of the rest.',
    },
  ];

  return (
    <>
      {/* Hero */}
      <Section background="sand" className="relative !py-12 md:!py-20">
        {/* Decorative green line */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-dark-sage/40 to-transparent" />
        {/* Background accents */}
        <div className="absolute inset-0 bg-gradient-to-br from-dark-sage/10 via-transparent to-sage-dark/8" />
        
        <motion.div
          initial={{ opacity: 1, y: 0 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center max-w-3xl mx-auto pt-8 md:pt-2 relative z-10"
        >
          <h1 className="text-h1 md:text-display font-serif text-charcoal mb-4">
            Book Your Treatment
          </h1>
          <p className="text-base md:text-lg text-warm-gray leading-relaxed mb-6 md:mb-8">
            Choose your service below and you&apos;ll be redirected to our secure booking system to select your time and complete your appointment.
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

      {/* How It Works */}
      <Section background="sand" className="relative !py-16">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-dark-sage/40 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-b from-dark-sage/8 via-transparent to-dark-sage/8 opacity-30" />

        <div className="max-w-4xl mx-auto relative z-10 text-center">
          <motion.div
            initial={{ opacity: 1, y: 0 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <h2 className="text-h2 font-serif text-charcoal">How It Works</h2>
            <p className="mt-3 text-sm md:text-base text-warm-gray max-w-2xl mx-auto">
              Booking is quick and transparent. Follow these simple steps and you&apos;ll be ready for your visit.
            </p>

            <div className="mt-10 grid gap-6 md:gap-8 md:grid-cols-2">
              {steps.map((step, index) => (
                <motion.div
                  key={step.title}
                  initial={{ opacity: 0, y: 24 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: index * 0.08 }}
                  className="bg-white/80 backdrop-blur-sm rounded-xl shadow-sm px-6 py-7 text-left border border-dark-sage/20"
                >
                  <div className="flex items-start gap-4">
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-dark-sage/90 text-charcoal font-semibold">
                      {index + 1}
                    </span>
                    <div>
                      <h3 className="text-base md:text-lg font-serif text-charcoal mb-2">
                        {step.title}
                      </h3>
                      <p className="text-sm text-warm-gray leading-relaxed">
                        {step.description}
                      </p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </Section>
    </>
  );
}
