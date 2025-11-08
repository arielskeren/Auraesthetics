import { useEffect } from 'react';

declare global {
  interface Window {
    Cal?: any;
  }
}

export interface CalSlotOptions {
  startTime: string;
  endTime?: string | null;
  timezone?: string | null;
}

export interface CalPrefillOptions {
  name?: string;
  email?: string;
  smsReminderNumber?: string;
  notes?: string;
}

export interface CalOpenOptions {
  namespace?: string;
  calLink: string;
  slot?: CalSlotOptions | null;
  prefill?: CalPrefillOptions | null;
  metadata?: Record<string, any>;
  onClose?: () => void;
}

/**
 * Hook to load Cal.com embed script once globally
 */
export function useCalEmbed() {
  useEffect(() => {
    // Only load if not already loaded
    if (window.Cal?.loaded) {
      return;
    }

    // Load Cal.com embed script
    const script = document.createElement('script');
    script.type = 'text/javascript';
    script.innerHTML = `
      (function (C, A, L) { 
        let p = function (a, ar) { a.q.push(ar); }; 
        let d = C.document; 
        C.Cal = C.Cal || function () { 
          let cal = C.Cal; 
          let ar = arguments; 
          if (!cal.loaded) { 
            cal.ns = {}; 
            cal.q = cal.q || []; 
            d.head.appendChild(d.createElement("script")).src = A; 
            cal.loaded = true; 
          } 
          if (ar[0] === L) { 
            const api = function () { p(api, arguments); }; 
            const namespace = ar[1]; 
            api.q = api.q || []; 
            if(typeof namespace === "string"){
              cal.ns[namespace] = cal.ns[namespace] || api;
              p(cal.ns[namespace], ar);
              p(cal, ["initNamespace", namespace]);
            } else p(cal, ar); 
            return;
          } 
          p(cal, ar); 
        }; 
      })(window, "https://app.cal.com/embed/embed.js", "init");
    `;
    document.head.appendChild(script);

    return () => {
      // Cleanup if needed
    };
  }, []);
}

/**
 * Initialize Cal.com for a specific service
 * @param namespace - Unique namespace for this service (usually the slug)
 * @param calLink - The Cal.com link (e.g., "auraesthetics/lip-wax")
 */
export function initCalService(namespace: string, calLink: string) {
  if (typeof window === 'undefined' || !window.Cal) {
    // Wait for Cal to load
    setTimeout(() => initCalService(namespace, calLink), 100);
    return;
  }

  try {
    // Initialize the service
    window.Cal('init', namespace, { origin: 'https://app.cal.com' });
    
    // Configure UI with month view
    if (window.Cal.ns && window.Cal.ns[namespace]) {
      window.Cal.ns[namespace]('ui', {
        hideEventTypeDetails: false,
        layout: 'month_view'
      });
    }
  } catch (error) {
    console.error('Error initializing Cal.com:', error);
  }
}

/**
 * Open Cal.com booking modal with optional slot reservation and prefill information
 */
export function openCalBooking(options: CalOpenOptions) {
  if (typeof window === 'undefined') {
    return;
  }

  const attemptOpen = (tries = 0) => {
    if (window.Cal) {
      const payload: any = {
        calLink: options.calLink,
      };

      if (options.namespace) {
        try {
          window.Cal('init', options.namespace, { origin: 'https://app.cal.com' });
          payload.namespace = options.namespace;
        } catch (error) {
          console.warn('Failed to initialize Cal namespace', error);
        }
      }

      if (options.slot) {
        payload.slot = {
          startTime: options.slot.startTime,
          endTime: options.slot.endTime ?? undefined,
          timeZone: options.slot.timezone ?? undefined,
        };
      }

      if (options.prefill) {
        const filteredPrefill = Object.fromEntries(
          Object.entries({
            name: options.prefill.name,
            email: options.prefill.email,
            smsReminderNumber: options.prefill.smsReminderNumber,
            notes: options.prefill.notes,
          }).filter(([, value]) => typeof value === 'string' && value.trim().length > 0)
        );
        if (Object.keys(filteredPrefill).length > 0) {
          payload.prefill = filteredPrefill;
        }
      }

      if (options.metadata) {
        payload.metadata = options.metadata;
      }

      if (options.onClose) {
        payload.onClose = options.onClose;
      }

      try {
        window.Cal('open', payload);
      } catch (error) {
        console.error('Failed to open Cal booking modal', error);
      }
      return;
    }

    if (tries > 25) {
      console.error('Cal.com embed not ready after multiple attempts');
      return;
    }

    setTimeout(() => attemptOpen(tries + 1), 150);
  };

  attemptOpen();
}

/**
 * Extract event slug from Cal.com URL
 * @param calBookingUrl - Full Cal.com URL (e.g., "https://cal.com/auraesthetics/lip-wax")
 * @returns Event slug (e.g., "auraesthetics/lip-wax")
 */
export function extractCalLink(calBookingUrl: string | null | undefined): string | null {
  if (!calBookingUrl) return null;
  
  // Extract the path after the domain
  const match = calBookingUrl.match(/cal\.com\/(.+)/);
  if (match && match[1]) {
    return match[1];
  }
  
  return null;
}

