'use client';

import { motion } from 'framer-motion';

interface ServiceCardProps {
  name: string;
  summary: string;
  duration: string;
  price: string;
  category: string;
  slug?: string;
  image_url?: string | null;
  featured?: boolean;
  best_seller?: boolean;
  most_popular?: boolean;
  onClick?: () => void;
}

export default function ServiceCard({ name, summary, duration, price, category, slug, image_url, featured, best_seller, most_popular, onClick }: ServiceCardProps) {
  // Create a unique gradient based on category - more distinct from background
  const gradients = {
    'Facials': 'from-dark-sage/60 via-taupe/40 to-sand',
    'Advanced': 'from-taupe/60 via-dark-sage/40 to-sand',
    'Brows & Lashes': 'from-charcoal/20 via-taupe/50 to-dark-sage/40',
    'Waxing': 'from-sand via-taupe/50 to-dark-sage/30',
  };

  const gradient = gradients[category as keyof typeof gradients] || gradients['Facials'];
  // ONLY use image_url from blob storage - no fallback to public folder

  return (
    <motion.div
      className={`group h-full ${onClick ? 'cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-dark-sage/60 focus-visible:ring-offset-2 focus-visible:ring-offset-white rounded-xl' : ''}`}
      whileHover={{ y: -4 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={(event) => {
        if (!onClick) return;
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onClick();
        }
      }}
    >
      <div className="bg-white rounded-xl overflow-hidden shadow-sm sm:shadow-sm group-active:shadow-md sm:group-hover:shadow-lg transition-shadow duration-200 h-full flex flex-col">
        {/* Service image or gradient placeholder */}
        <div className="relative">
          {image_url ? (
            <>
              <div className="hidden sm:block h-48 flex-shrink-0 bg-gray-200 relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
                <img 
                  src={image_url} 
                  alt={name}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    // If blob image fails to load, show gradient
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                    if (target.parentElement) {
                      target.parentElement.className = `h-48 flex-shrink-0 bg-gradient-to-br ${gradient}`;
                    }
                  }}
                />
              </div>
              <div className={`sm:hidden h-1.5 w-full bg-gradient-to-r ${gradient}`} />
            </>
          ) : (
            <div className={`h-1.5 sm:h-48 flex-shrink-0 bg-gradient-to-br ${gradient}`} />
          )}
          
          {/* Badges */}
          {(featured || best_seller || most_popular) && (
            <div className="absolute top-2 right-2 flex flex-col gap-1 z-10">
              {featured && (
                <span className="px-2 py-1 bg-dark-sage text-charcoal text-xs font-semibold rounded shadow-sm">
                  Featured
                </span>
              )}
              {best_seller && (
                <span className="px-2 py-1 bg-yellow-500 text-white text-xs font-semibold rounded shadow-sm">
                  Best Seller
                </span>
              )}
              {most_popular && (
                <span className="px-2 py-1 bg-blue-500 text-white text-xs font-semibold rounded shadow-sm">
                  Most Popular
                </span>
              )}
            </div>
          )}
        </div>
        
        {/* Content - flex to fill remaining space */}
        <div className="px-4 py-4 sm:p-6 flex flex-col flex-grow gap-3 sm:gap-4">
          <div>
            <h3 className="text-base font-semibold font-serif text-charcoal sm:text-h3 sm:font-normal mb-1 sm:mb-2 min-h-[38px] sm:min-h-0">
              {name}
            </h3>
            <p className="text-xs sm:text-sm text-warm-gray leading-relaxed">
              {summary}
            </p>
          </div>
          
          <div className="flex items-center justify-between text-xs sm:text-sm text-warm-gray pt-3 sm:pt-4 border-t border-sand mt-auto">
            <span>{duration}</span>
            <span className="font-medium text-charcoal">{price}</span>
          </div>

          <button
            className="inline-flex items-center justify-center px-3 py-2 text-xs sm:text-sm font-semibold bg-dark-sage text-charcoal rounded-lg transition-colors duration-200 hover:bg-sage-dark focus:outline-none focus:ring-2 focus:ring-dark-sage/60 focus:ring-offset-2 focus:ring-offset-white"
            type="button"
            aria-label={`Book ${name}`}
          >
            Book Now
          </button>
        </div>
      </div>
    </motion.div>
  );
}

