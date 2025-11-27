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
      <div className="bg-white rounded-xl overflow-hidden shadow-sm sm:shadow-sm group-active:shadow-md sm:group-hover:shadow-lg transition-shadow duration-200 h-full flex flex-col md:flex-col">
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
          
          {/* Badges - Show all applicable badges */}
          {(featured || best_seller || most_popular) && (
            <div className="absolute top-0 left-0 right-0 z-10 flex flex-wrap gap-1 p-1.5">
              {featured && (
                <span className="px-2 py-0.5 bg-dark-sage/95 text-charcoal text-[9px] sm:text-[10px] font-bold uppercase tracking-wider shadow-md border border-dark-sage/30 rounded backdrop-blur-sm">
                  Featured
                </span>
              )}
              {best_seller && (
                <span className="px-2 py-0.5 bg-gradient-to-r from-amber-500/95 to-yellow-500/95 text-white text-[9px] sm:text-[10px] font-bold uppercase tracking-wider shadow-md border border-amber-400/40 rounded backdrop-blur-sm">
                  Best Seller
                </span>
              )}
              {most_popular && (
                <span className="px-2 py-0.5 bg-gradient-to-r from-sky-500/95 to-blue-500/95 text-white text-[9px] sm:text-[10px] font-bold uppercase tracking-wider shadow-md border border-sky-400/40 rounded backdrop-blur-sm">
                  Most Popular
                </span>
              )}
            </div>
          )}
        </div>
        
        {/* Content - flex to fill remaining space */}
        <div className="px-3 pt-10 pb-3 sm:p-6 sm:pt-6 flex flex-col flex-grow gap-2 sm:gap-4">
          <div className="flex-grow min-h-0">
            <h3 className="text-sm font-semibold font-serif text-charcoal sm:text-h3 sm:font-normal mb-1 sm:mb-2 line-clamp-2">
              {name}
            </h3>
            <p className="text-[10px] sm:text-sm text-warm-gray leading-relaxed line-clamp-2 sm:line-clamp-none">
              {summary}
            </p>
          </div>
          
          <div className="flex items-center justify-between text-[10px] sm:text-sm text-warm-gray pt-2 sm:pt-4 border-t border-sand">
            <span className="truncate">{duration}</span>
            <span className="font-medium text-charcoal truncate ml-2">{price}</span>
          </div>

          <button
            className="inline-flex items-center justify-center px-2 py-1.5 text-[10px] sm:text-sm font-semibold bg-dark-sage text-charcoal rounded-lg transition-colors duration-200 hover:bg-sage-dark focus:outline-none focus:ring-2 focus:ring-dark-sage/60 focus:ring-offset-2 focus:ring-offset-white"
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

