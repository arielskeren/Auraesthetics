import { ReactNode } from 'react';

interface SectionProps {
  children: ReactNode;
  className?: string;
  background?: 'ivory' | 'sand' | 'sage';
  id?: string;
}

export default function Section({ 
  children, 
  className = '', 
  background = 'ivory',
  id 
}: SectionProps) {
  const bgClasses = {
    ivory: 'bg-ivory',
    sand: 'bg-sand',
    sage: 'bg-sage/20'
  };

  return (
    <section 
      id={id}
      className={`py-section-mobile md:py-section-desktop ${bgClasses[background]} ${className}`}
    >
      <div className="container mx-auto px-6 md:px-12 max-w-7xl">
        {children}
      </div>
    </section>
  );
}

