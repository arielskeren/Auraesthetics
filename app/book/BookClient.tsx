'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import Section from '../_components/Section';
import ServiceCard from '../_components/ServiceCard';
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

  return (
    <>
      {/* Hero */}
      <Section background="sand" className="relative">
        {/* Decorative green line */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-dark-sage/40 to-transparent" />
        {/* Background accents */}
        <div className="absolute inset-0 bg-gradient-to-br from-dark-sage/10 via-transparent to-sage-dark/8" />
        
        <motion.div
          initial={{ opacity: 1, y: 0 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center max-w-3xl mx-auto pt-16 md:pt-0 relative z-10"
        >
          <h1 className="text-h1 md:text-display font-serif text-charcoal mb-6">
            Book Your Treatment
          </h1>
          <p className="text-lg text-warm-gray leading-relaxed mb-8">
            Choose your service below and you&apos;ll be redirected to our secure booking system to select your time and complete your appointment.
          </p>
          
          {/* Test Mode Banner */}
          <div className="inline-block px-6 py-3 bg-dark-sage/30 rounded-lg border-2 border-dark-sage mb-4">
            <p className="text-sm text-charcoal font-medium">
              ⚙️ Booking in test mode - pricing will be set soon
            </p>
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

      {/* Booking Instructions */}
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
          <h2 className="text-h2 font-serif text-charcoal mb-8 text-center">
              How It Works
          </h2>
          
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="bg-white p-8 rounded-lg">
                <h3 className="text-h3 font-serif text-charcoal mb-4">1. Choose Your Service</h3>
              <p className="text-warm-gray">
                  Browse our services and click &quot;Book Now&quot; on your preferred treatment. You&apos;ll be taken to our secure Cal.com booking page.
              </p>
            </div>

              <div className="bg-white p-8 rounded-lg">
                <h3 className="text-h3 font-serif text-charcoal mb-4">2. Select Your Time</h3>
              <p className="text-warm-gray">
                  View real-time availability and choose a date and time that works for your schedule. Times are synced with Amy&apos;s calendar.
              </p>
            </div>

              <div className="bg-white p-8 rounded-lg">
                <h3 className="text-h3 font-serif text-charcoal mb-4">3. Complete Intake Form</h3>
              <p className="text-warm-gray">
                  Fill out a brief intake form with your skin concerns, goals, and any allergies. This helps Amy customize your treatment.
              </p>
            </div>

              <div className="bg-white p-8 rounded-lg">
                <h3 className="text-h3 font-serif text-charcoal mb-4">4. Confirm & Arrive</h3>
              <p className="text-warm-gray">
                  Receive confirmation with all the details you need. Then just show up on time and let us take care of the rest.
              </p>
            </div>
          </div>
        </motion.div>
        </div>
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
