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
  // Create a unique gradient based on category
  const gradients = {
    'Facials': 'from-sand via-taupe/30 to-ivory',
    'Advanced': 'from-sage/40 via-sand to-ivory',
    'Brows & Lashes': 'from-taupe/40 via-sand to-ivory',
    'Waxing': 'from-ivory via-sand to-taupe/30',
  };

  const gradient = gradients[category as keyof typeof gradients] || gradients['Facials'];

  return (
    <motion.div
      className="group cursor-pointer"
      whileHover={{ y: -4 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
    >
      <div className="bg-white rounded-lg overflow-hidden shadow-sm group-hover:shadow-lg transition-shadow duration-200">
        {/* Gradient placeholder */}
        <div className={`h-48 bg-gradient-to-br ${gradient}`} />
        
        {/* Content */}
        <div className="p-6">
          <h3 className="text-h3 text-charcoal mb-2">{name}</h3>
          <p className="text-warm-gray text-sm mb-4 leading-relaxed">{summary}</p>
          
          <div className="flex justify-between items-center text-sm text-warm-gray pt-4 border-t border-sand">
            <span>{duration}</span>
            <span className="font-medium">{price}</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

