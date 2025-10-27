'use client';

import { motion } from 'framer-motion';

interface ServiceCardProps {
  name: string;
  summary: string;
  duration: string;
  price: string;
  category: string;
}

export default function ServiceCard({ name, summary, duration, price, category }: ServiceCardProps) {
  // Create a unique gradient based on category - more distinct from background
  const gradients = {
    'Facials': 'from-sage/60 via-taupe/40 to-sand',
    'Advanced': 'from-taupe/60 via-sage/40 to-sand',
    'Brows & Lashes': 'from-charcoal/20 via-taupe/50 to-sage/40',
    'Waxing': 'from-sand via-taupe/50 to-sage/30',
  };

  const gradient = gradients[category as keyof typeof gradients] || gradients['Facials'];

  return (
    <motion.div
      className="group h-full"
      whileHover={{ y: -4 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
    >
      <div className="bg-white rounded-lg overflow-hidden shadow-sm group-hover:shadow-lg transition-shadow duration-200 h-full flex flex-col">
        {/* Gradient placeholder - fixed height */}
        <div className={`h-48 flex-shrink-0 bg-gradient-to-br ${gradient}`} />
        
        {/* Content - flex to fill remaining space */}
        <div className="p-6 flex flex-col flex-grow">
          <h3 className="text-h3 text-charcoal mb-2">{name}</h3>
          <p className="text-warm-gray text-sm mb-4 leading-relaxed flex-grow">{summary}</p>
          
          <div className="flex justify-between items-center text-sm text-warm-gray pt-4 border-t border-sand mt-auto">
            <span>{duration}</span>
            <span className="font-medium">{price}</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

