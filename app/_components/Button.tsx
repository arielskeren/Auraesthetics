'use client';

import { ReactNode } from 'react';
import { motion } from 'framer-motion';

interface ButtonProps {
  variant?: 'primary' | 'secondary' | 'disabled';
  children: ReactNode;
  tooltip?: string;
  className?: string;
  onClick?: () => void;
  type?: 'button' | 'submit' | 'reset';
}

export default function Button({ 
  variant = 'primary', 
  children, 
  tooltip,
  className = '',
  onClick,
  type = 'button'
}: ButtonProps) {
  const baseClasses = "px-8 py-3 rounded font-medium transition-all duration-200 min-h-[44px] inline-flex items-center justify-center";
  
  const variantClasses = {
    primary: "bg-charcoal text-ivory hover:bg-sage hover:text-charcoal",
    secondary: "border-2 border-warm-gray text-warm-gray hover:border-charcoal hover:text-charcoal",
    disabled: "bg-taupe/40 text-warm-gray/60 cursor-not-allowed relative group"
  };

  if (variant === 'disabled') {
    return (
      <motion.button
        className={`${baseClasses} ${variantClasses.disabled} ${className}`}
        aria-disabled="true"
        disabled
        type={type}
        whileHover={{ scale: 1.02 }}
      >
        {children}
        {tooltip && (
          <span className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-charcoal text-ivory text-sm px-3 py-2 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
            {tooltip}
          </span>
        )}
      </motion.button>
    );
  }

  return (
    <motion.button
      className={`${baseClasses} ${variantClasses[variant]} ${className}`}
      onClick={onClick}
      type={type}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
    >
      {children}
    </motion.button>
  );
}

