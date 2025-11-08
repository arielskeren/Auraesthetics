'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion, useAnimationControls, useReducedMotion } from 'framer-motion';
import Section from '../_components/Section';
import BookingModal from '../_components/BookingModal';
import ServiceCard from '../_components/ServiceCard';

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

  const stepControl1 = useAnimationControls();
  const stepControl2 = useAnimationControls();
  const stepControl3 = useAnimationControls();
  const stepControl4 = useAnimationControls();
  const stepControls = useMemo(
    () => [stepControl1, stepControl2, stepControl3, stepControl4],
    [stepControl1, stepControl2, stepControl3, stepControl4]
  );
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    if (prefersReducedMotion) {
      stepControls.forEach((control) => control.set({ scale: 1 }));
      return;
    }

    let cancelled = false;
    const pulseDuration = 250;
    const restDuration = 6000;

    const sleep = (ms: number) =>
      new Promise<void>((resolve) => {
        setTimeout(() => resolve(), ms);
      });

    const runSequence = async () => {
      while (!cancelled) {
        for (const control of stepControls) {
          if (cancelled) break;
          await control.start({
            scale: 1.05,
            transition: { duration: 0.2, ease: 'easeOut' },
          });
          await control.start({
            scale: 1,
            transition: { duration: 0.25, ease: 'easeInOut' },
          });
          if (cancelled) break;
          await sleep(pulseDuration);
        }

        if (cancelled) break;
        await sleep(restDuration);
      }
    };

    const starter = setTimeout(() => {
      runSequence();
    }, 600);

    return () => {
      cancelled = true;
      clearTimeout(starter);
      stepControls.forEach((control) => control.stop());
    };
  }, [stepControls, prefersReducedMotion]);

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
                animate={stepControls[index]}
              >
                <motion.span
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-dark-sage text-charcoal font-semibold text-sm shadow-sm md:mb-2"
                  animate={stepControls[index]}
                >
                  {index + 1}
                </motion.span>
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
        
        <div className="flex flex-wrap justify-center gap-2 sm:gap-3 relative z-10">
          {categories.map((category) => (
            <button
              key={category}
              onClick={() => setActiveCategory(category)}
              className={`px-4 py-2 sm:px-6 rounded-full text-xs sm:text-sm font-medium transition-all duration-200 min-h-[40px] sm:min-h-[44px] ${
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
            className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4 md:gap-6 lg:gap-8"
          >
            {filteredServices.map((service, index) => (
              <motion.div
                key={service.slug}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: index * 0.05 }}
                className="h-full"
              >
                <ServiceCard
                  {...service}
                  onClick={() => handleBookingClick(service)}
                />
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
