'use client';

import { motion } from 'framer-motion';
import { getServicePhotoPaths } from '../_utils/servicePhotos';

interface ServiceCardProps {
  name: string;
  summary: string;
  duration: string;
  price: string;
  category: string;
  slug?: string;
}

export default function ServiceCard({ name, summary, duration, price, category, slug }: ServiceCardProps) {
  // Create a unique gradient based on category - more distinct from background
  const gradients = {
    'Facials': 'from-dark-sage/60 via-taupe/40 to-sand',
    'Advanced': 'from-taupe/60 via-dark-sage/40 to-sand',
    'Brows & Lashes': 'from-charcoal/20 via-taupe/50 to-dark-sage/40',
    'Waxing': 'from-sand via-taupe/50 to-dark-sage/30',
  };

  const gradient = gradients[category as keyof typeof gradients] || gradients['Facials'];
  const photoPaths = slug ? getServicePhotoPaths(slug) : [];

  return (
    <motion.div
      className="group h-full"
      whileHover={{ y: -4 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
    >
      <div className="bg-white rounded-lg overflow-hidden shadow-sm group-hover:shadow-lg transition-shadow duration-200 h-full flex flex-col">
        {/* Service image or gradient placeholder */}
        {slug && photoPaths.length > 0 ? (
          <div className="h-48 flex-shrink-0 bg-gray-200 relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img 
              src={photoPaths[0]} 
              alt={name}
              className="w-full h-full object-cover"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                // Try fallback paths if available
                const currentSrc = target.src;
                const currentIndex = photoPaths.findIndex(path => currentSrc.includes(path.split('/').pop() || ''));
                
                if (currentIndex < photoPaths.length - 1) {
                  // Try next fallback path
                  target.src = photoPaths[currentIndex + 1];
                } else {
                  // No more fallbacks, show gradient
                  target.style.display = 'none';
                  if (target.parentElement) {
                    target.parentElement.className = `h-48 flex-shrink-0 bg-gradient-to-br ${gradient}`;
                  }
                }
              }}
            />
          </div>
        ) : (
        <div className={`h-48 flex-shrink-0 bg-gradient-to-br ${gradient}`} />
        )}
        
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

