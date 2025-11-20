'use client';

import React, { createContext, useContext, useState, useRef, useCallback, useEffect } from 'react';

interface HapioDataContextType {
  // Services
  services: Record<string, { id: string; name: string }>;
  loadServices: () => Promise<void>;
  isLoadingServices: boolean;
  getService: (serviceId: string) => Promise<any | null>;
  getFullServices: () => Promise<any[]>; // Get full service objects (with all fields)
  
  // Resources
  resources: Record<string, { id: string; name: string }>;
  loadResources: () => Promise<void>;
  isLoadingResources: boolean;
  getResource: (resourceId: string) => Promise<any | null>;
  
  // Locations
  locations: Array<{ id: string; name: string }>;
  loadLocations: () => Promise<void>;
  isLoadingLocations: boolean;
  getLocation: (locationId: string) => Promise<any | null>;
  
  // Bookings (cached by month key)
  getBookings: (params: {
    from: string;
    to: string;
    resourceId?: string;
    locationId?: string;
  }) => Promise<any[]>;
  isLoadingBookings: boolean;
  
  // Availability (cached by resource and month)
  getAvailability: (resourceId: string, from: string, to: string) => Promise<Record<string, Array<{ start: string; end: string }>>>;
  getAvailabilityFull: (resourceId: string, from: string, to: string) => Promise<{
    availabilityByDate: Record<string, Array<{ start: string; end: string }>>;
    recurringBlocksByDate: Record<string, Array<{ start: string; end: string; isAllDay: boolean }>>;
  }>;
  isLoadingAvailability: boolean;
  
  // Schedule blocks (cached by resource and date range)
  getScheduleBlocks: (resourceId: string, from: string, to: string) => Promise<any[]>;
  isLoadingScheduleBlocks: boolean;
  
  // Recurring schedules (cached by resource)
  getRecurringSchedules: (resourceId: string) => Promise<any[]>;
  isLoadingRecurringSchedules: boolean;
  
  // Recurring schedule blocks (cached by resource)
  getRecurringScheduleBlocks: (resourceId: string, recurringScheduleId?: string) => Promise<any[]>;
  isLoadingRecurringScheduleBlocks: boolean;
  
  // Clear caches
  clearCache: () => void;
  refreshData: () => Promise<void>;
}

const HapioDataContext = createContext<HapioDataContextType | undefined>(undefined);

// Request deduplication: track in-flight requests
const inFlightRequests = new Map<string, Promise<any>>();

// Simple in-memory cache
const cache = {
  services: null as Record<string, { id: string; name: string }> | null,
  fullServices: null as { data: any[]; timestamp: number } | null, // Full service objects list
  resources: null as Record<string, { id: string; name: string }> | null,
  locations: null as Array<{ id: string; name: string }> | null,
  bookings: new Map<string, { data: any[]; timestamp: number }>(),
  availability: new Map<string, { data: Record<string, Array<{ start: string; end: string }>>; timestamp: number }>(),
  scheduleBlocks: new Map<string, { data: any[]; timestamp: number }>(),
  recurringSchedules: new Map<string, { data: any[]; timestamp: number }>(),
  recurringScheduleBlocks: new Map<string, { data: any[]; timestamp: number }>(),
  serviceDetails: new Map<string, { data: any; timestamp: number }>(),
  resourceDetails: new Map<string, { data: any; timestamp: number }>(),
  locationDetails: new Map<string, { data: any; timestamp: number }>(),
};

// Cache TTL: 30 minutes for static data, 1 minute for dynamic data
const CACHE_TTL_STATIC = 30 * 60 * 1000; // 30 minutes (increased from 5)
const CACHE_TTL_DYNAMIC = 1 * 60 * 1000; // 1 minute

export function HapioDataProvider({ children }: { children: React.ReactNode }) {
  const [services, setServices] = useState<Record<string, { id: string; name: string }>>({});
  const [resources, setResources] = useState<Record<string, { id: string; name: string }>>({});
  const [locations, setLocations] = useState<Array<{ id: string; name: string }>>([]);
  const [isLoadingServices, setIsLoadingServices] = useState(false);
  const [isLoadingResources, setIsLoadingResources] = useState(false);
  const [isLoadingLocations, setIsLoadingLocations] = useState(false);
  const [isLoadingBookings, setIsLoadingBookings] = useState(false);
  const [isLoadingAvailability, setIsLoadingAvailability] = useState(false);
  const [isLoadingScheduleBlocks, setIsLoadingScheduleBlocks] = useState(false);
  const [isLoadingRecurringSchedules, setIsLoadingRecurringSchedules] = useState(false);
  const [isLoadingRecurringScheduleBlocks, setIsLoadingRecurringScheduleBlocks] = useState(false);
  const [hasInitialized, setHasInitialized] = useState(false);

  // Deduplicated fetch helper
  const deduplicatedFetch = useCallback(async <T,>(
    key: string,
    fetcher: () => Promise<T>,
    useCache: boolean = true
  ): Promise<T> => {
    // Check if request is already in flight
    if (inFlightRequests.has(key)) {
      return inFlightRequests.get(key)!;
    }

    // Create the request promise
    const promise = fetcher().finally(() => {
      inFlightRequests.delete(key);
    });

    inFlightRequests.set(key, promise);
    return promise;
  }, []);

  const loadServices = useCallback(async () => {
    // Check cache first - if we have cached data, use it immediately
    if (cache.services && Object.keys(cache.services).length > 0) {
      setServices(cache.services);
      return;
    }

    setIsLoadingServices(true);
    try {
      await deduplicatedFetch('services', async () => {
        const response = await fetch('/api/admin/hapio/services?per_page=100');
        if (!response.ok) {
          throw new Error('Failed to load services');
        }
        const data = await response.json();
        const servicesMap: Record<string, { id: string; name: string }> = {};
        const fullServicesList = data.data || [];
        fullServicesList.forEach((service: any) => {
          servicesMap[service.id] = { id: service.id, name: service.name || 'Unknown Service' };
        });
        cache.services = servicesMap;
        // Also cache full services list
        cache.fullServices = { data: fullServicesList, timestamp: Date.now() };
        setServices(servicesMap);
        return servicesMap;
      });
    } catch (err) {
      console.error('[HapioDataContext] Error loading services:', err);
    } finally {
      setIsLoadingServices(false);
    }
  }, [deduplicatedFetch]);

  const getFullServices = useCallback(async (): Promise<any[]> => {
    // Check cache first
    if (cache.fullServices && Date.now() - cache.fullServices.timestamp < CACHE_TTL_STATIC) {
      return cache.fullServices.data;
    }

    try {
      return await deduplicatedFetch('full-services', async () => {
        const response = await fetch('/api/admin/hapio/services?per_page=100');
        if (!response.ok) {
          throw new Error('Failed to load full services');
        }
        const data = await response.json();
        const fullServicesList = data.data || [];
        cache.fullServices = { data: fullServicesList, timestamp: Date.now() };
        return fullServicesList;
      });
    } catch (err) {
      console.error('[HapioDataContext] Error loading full services:', err);
      return [];
    }
  }, [deduplicatedFetch]);


  const loadResources = useCallback(async () => {
    // Check cache first - if we have cached data, use it immediately
    if (cache.resources && Object.keys(cache.resources).length > 0) {
      setResources(cache.resources);
      return;
    }

    setIsLoadingResources(true);
    try {
      await deduplicatedFetch('resources', async () => {
        const response = await fetch('/api/admin/hapio/resources?per_page=100');
        if (!response.ok) {
          throw new Error('Failed to load resources');
        }
        const data = await response.json();
        const resourcesMap: Record<string, { id: string; name: string }> = {};
        (data.data || []).forEach((resource: any) => {
          resourcesMap[resource.id] = { id: resource.id, name: resource.name || 'Unknown Resource' };
        });
        cache.resources = resourcesMap;
        setResources(resourcesMap);
        return resourcesMap;
      });
    } catch (err) {
      console.error('[HapioDataContext] Error loading resources:', err);
    } finally {
      setIsLoadingResources(false);
    }
  }, [deduplicatedFetch]);

  const loadLocations = useCallback(async () => {
    // Check cache first - if we have cached data, use it immediately
    if (cache.locations && cache.locations.length > 0) {
      setLocations(cache.locations);
      return;
    }

    setIsLoadingLocations(true);
    try {
      await deduplicatedFetch('locations', async () => {
        const response = await fetch('/api/admin/hapio/locations?per_page=100');
        if (!response.ok) {
          throw new Error('Failed to load locations');
        }
        const data = await response.json();
        const locationsList = (data.data || []).map((loc: any) => ({
          id: loc.id,
          name: loc.name || 'Unknown Location',
        }));
        cache.locations = locationsList;
        setLocations(locationsList);
        return locationsList;
      });
    } catch (err) {
      console.error('[HapioDataContext] Error loading locations:', err);
    } finally {
      setIsLoadingLocations(false);
    }
  }, [deduplicatedFetch]);

  const getBookings = useCallback(async (params: {
    from: string;
    to: string;
    resourceId?: string;
    locationId?: string;
  }): Promise<any[]> => {
    const cacheKey = `bookings:${params.from}:${params.to}:${params.resourceId || 'none'}:${params.locationId || 'none'}`;
    
    // Check cache
    const cached = cache.bookings.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_DYNAMIC) {
      return cached.data;
    }

    setIsLoadingBookings(true);
    try {
      return await deduplicatedFetch(cacheKey, async () => {
        const urlParams = new URLSearchParams();
        urlParams.append('from', params.from.split('T')[0]);
        urlParams.append('to', params.to.split('T')[0]);
        if (params.resourceId) urlParams.append('resource_id', params.resourceId);
        if (params.locationId) urlParams.append('location_id', params.locationId);
        urlParams.append('per_page', '100');

        const response = await fetch(`/api/admin/hapio/bookings?${urlParams.toString()}`);
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to load bookings');
        }
        const data = await response.json();
        const activeBookings = (data.data || []).filter((b: any) => !b.isCanceled);
        
        cache.bookings.set(cacheKey, { data: activeBookings, timestamp: Date.now() });
        return activeBookings;
      });
    } catch (err) {
      console.error('[HapioDataContext] Error loading bookings:', err);
      throw err;
    } finally {
      setIsLoadingBookings(false);
    }
  }, [deduplicatedFetch]);

  const getAvailabilityFull = useCallback(async (
    resourceId: string,
    from: string,
    to: string
  ): Promise<{
    availabilityByDate: Record<string, Array<{ start: string; end: string }>>;
    recurringBlocksByDate: Record<string, Array<{ start: string; end: string; isAllDay: boolean }>>;
  }> => {
    const cacheKey = `availability-full:${resourceId}:${from}:${to}`;
    
    // Check cache - use availability cache but store full response
    const cached = cache.availability.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_DYNAMIC) {
      // If cached data has full response, return it
      if ((cached.data as any).availabilityByDate && (cached.data as any).recurringBlocksByDate) {
        return cached.data as any;
      }
    }

    setIsLoadingAvailability(true);
    try {
      return await deduplicatedFetch(cacheKey, async () => {
        const response = await fetch(
          `/api/admin/hapio/resources/${resourceId}/availability?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`
        );
        if (!response.ok) {
          throw new Error('Failed to load availability');
        }
        const data = await response.json();
        const fullResponse = {
          availabilityByDate: data.availabilityByDate || {},
          recurringBlocksByDate: data.recurringBlocksByDate || {},
        };
        
        // Cache the full response
        cache.availability.set(cacheKey, { data: fullResponse, timestamp: Date.now() });
        return fullResponse;
      });
    } catch (err) {
      console.error('[HapioDataContext] Error loading availability:', err);
      return { availabilityByDate: {}, recurringBlocksByDate: {} };
    } finally {
      setIsLoadingAvailability(false);
    }
  }, [deduplicatedFetch]);

  const getAvailability = useCallback(async (
    resourceId: string,
    from: string,
    to: string
  ): Promise<Record<string, Array<{ start: string; end: string }>>> => {
    const fullData = await getAvailabilityFull(resourceId, from, to);
    return fullData.availabilityByDate || {};
  }, [getAvailabilityFull]);

  const getService = useCallback(async (serviceId: string): Promise<any | null> => {
    // Check if in services map first
    if (services[serviceId]) {
      return services[serviceId];
    }

    const cacheKey = `service:${serviceId}`;
    const cached = cache.serviceDetails.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_STATIC) {
      return cached.data;
    }

    try {
      return await deduplicatedFetch(cacheKey, async () => {
        const response = await fetch(`/api/admin/hapio/services/${serviceId}`);
        if (!response.ok) {
          if (response.status === 404) return null;
          throw new Error('Failed to load service');
        }
        const data = await response.json();
        cache.serviceDetails.set(cacheKey, { data, timestamp: Date.now() });
        return data;
      });
    } catch (err) {
      console.error('[HapioDataContext] Error loading service:', err);
      return null;
    }
  }, [deduplicatedFetch, services]);

  const getResource = useCallback(async (resourceId: string): Promise<any | null> => {
    // Check if in resources map first
    if (resources[resourceId]) {
      return resources[resourceId];
    }

    const cacheKey = `resource:${resourceId}`;
    const cached = cache.resourceDetails.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_STATIC) {
      return cached.data;
    }

    try {
      return await deduplicatedFetch(cacheKey, async () => {
        const response = await fetch(`/api/admin/hapio/resources/${resourceId}`);
        if (!response.ok) {
          if (response.status === 404) return null;
          throw new Error('Failed to load resource');
        }
        const data = await response.json();
        cache.resourceDetails.set(cacheKey, { data, timestamp: Date.now() });
        return data;
      });
    } catch (err) {
      console.error('[HapioDataContext] Error loading resource:', err);
      return null;
    }
  }, [deduplicatedFetch, resources]);

  const getLocation = useCallback(async (locationId: string): Promise<any | null> => {
    // Check if in locations array first
    const location = locations.find(loc => loc.id === locationId);
    if (location) {
      return location;
    }

    const cacheKey = `location:${locationId}`;
    const cached = cache.locationDetails.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_STATIC) {
      return cached.data;
    }

    try {
      return await deduplicatedFetch(cacheKey, async () => {
        const response = await fetch(`/api/admin/hapio/locations/${locationId}`);
        if (!response.ok) {
          if (response.status === 404) return null;
          throw new Error('Failed to load location');
        }
        const data = await response.json();
        cache.locationDetails.set(cacheKey, { data, timestamp: Date.now() });
        return data;
      });
    } catch (err) {
      console.error('[HapioDataContext] Error loading location:', err);
      return null;
    }
  }, [deduplicatedFetch, locations]);

  const getScheduleBlocks = useCallback(async (
    resourceId: string,
    from: string,
    to: string
  ): Promise<any[]> => {
    const cacheKey = `schedule-blocks:${resourceId}:${from}:${to}`;
    
    const cached = cache.scheduleBlocks.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_DYNAMIC) {
      return cached.data;
    }

    setIsLoadingScheduleBlocks(true);
    try {
      return await deduplicatedFetch(cacheKey, async () => {
        const response = await fetch(
          `/api/admin/hapio/resources/${resourceId}/schedule-blocks?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&per_page=100`
        );
        if (!response.ok) {
          if (response.status === 404) return [];
          throw new Error('Failed to load schedule blocks');
        }
        const data = await response.json();
        const blocks = data.data || [];
        cache.scheduleBlocks.set(cacheKey, { data: blocks, timestamp: Date.now() });
        return blocks;
      });
    } catch (err) {
      console.error('[HapioDataContext] Error loading schedule blocks:', err);
      return [];
    } finally {
      setIsLoadingScheduleBlocks(false);
    }
  }, [deduplicatedFetch]);

  const getRecurringSchedules = useCallback(async (resourceId: string): Promise<any[]> => {
    const cacheKey = `recurring-schedules:${resourceId}`;
    
    const cached = cache.recurringSchedules.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_STATIC) {
      return cached.data;
    }

    setIsLoadingRecurringSchedules(true);
    try {
      return await deduplicatedFetch(cacheKey, async () => {
        const response = await fetch(
          `/api/admin/hapio/resources/${resourceId}/recurring-schedules?per_page=100`
        );
        if (!response.ok) {
          if (response.status === 404) return [];
          throw new Error('Failed to load recurring schedules');
        }
        const data = await response.json();
        const schedules = data.data || [];
        cache.recurringSchedules.set(cacheKey, { data: schedules, timestamp: Date.now() });
        return schedules;
      });
    } catch (err) {
      console.error('[HapioDataContext] Error loading recurring schedules:', err);
      return [];
    } finally {
      setIsLoadingRecurringSchedules(false);
    }
  }, [deduplicatedFetch]);

  const getRecurringScheduleBlocks = useCallback(async (
    resourceId: string,
    recurringScheduleId?: string
  ): Promise<any[]> => {
    const cacheKey = `recurring-schedule-blocks:${resourceId}:${recurringScheduleId || 'all'}`;
    
    const cached = cache.recurringScheduleBlocks.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_STATIC) {
      return cached.data;
    }

    setIsLoadingRecurringScheduleBlocks(true);
    try {
      return await deduplicatedFetch(cacheKey, async () => {
        let url = `/api/admin/hapio/resources/${resourceId}/recurring-schedule-blocks?list_all=true&per_page=100`;
        if (recurringScheduleId) {
          url += `&recurring_schedule_id=${recurringScheduleId}`;
        }
        const response = await fetch(url);
        if (!response.ok) {
          if (response.status === 404) return [];
          throw new Error('Failed to load recurring schedule blocks');
        }
        const data = await response.json();
        const blocks = data.data || [];
        cache.recurringScheduleBlocks.set(cacheKey, { data: blocks, timestamp: Date.now() });
        return blocks;
      });
    } catch (err) {
      console.error('[HapioDataContext] Error loading recurring schedule blocks:', err);
      return [];
    } finally {
      setIsLoadingRecurringScheduleBlocks(false);
    }
  }, [deduplicatedFetch]);

  const clearCache = useCallback(() => {
    cache.services = null;
    cache.fullServices = null;
    cache.resources = null;
    cache.locations = null;
    cache.bookings.clear();
    cache.availability.clear();
    cache.scheduleBlocks.clear();
    cache.recurringSchedules.clear();
    cache.recurringScheduleBlocks.clear();
    cache.serviceDetails.clear();
    cache.resourceDetails.clear();
    cache.locationDetails.clear();
    setServices({});
    setResources({});
    setLocations([]);
  }, []);

  const refreshData = useCallback(async () => {
    clearCache();
    await Promise.all([
      loadServices(),
      loadResources(),
      loadLocations(),
    ]);
  }, [clearCache, loadServices, loadResources, loadLocations]);

  // Auto-load services, resources, and locations ONCE when provider mounts
  useEffect(() => {
    if (!hasInitialized) {
      setHasInitialized(true);
      // Load all static data once on mount - these will be deduplicated if called multiple times
      // Don't await - let them load in parallel
      loadServices().catch(err => console.error('[HapioDataContext] Error auto-loading services:', err));
      loadResources().catch(err => console.error('[HapioDataContext] Error auto-loading resources:', err));
      loadLocations().catch(err => console.error('[HapioDataContext] Error auto-loading locations:', err));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasInitialized]);

  const value: HapioDataContextType = {
    services,
    loadServices,
    isLoadingServices,
    getService,
    getFullServices,
    resources,
    loadResources,
    isLoadingResources,
    getResource,
    locations,
    loadLocations,
    isLoadingLocations,
    getLocation,
    getBookings,
    isLoadingBookings,
    getAvailability,
    getAvailabilityFull,
    isLoadingAvailability,
    getScheduleBlocks,
    isLoadingScheduleBlocks,
    getRecurringSchedules,
    isLoadingRecurringSchedules,
    getRecurringScheduleBlocks,
    isLoadingRecurringScheduleBlocks,
    clearCache,
    refreshData,
  };

  return (
    <HapioDataContext.Provider value={value}>
      {children}
    </HapioDataContext.Provider>
  );
}

export function useHapioData() {
  const context = useContext(HapioDataContext);
  if (context === undefined) {
    throw new Error('useHapioData must be used within a HapioDataProvider');
  }
  return context;
}

